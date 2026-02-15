/**
 * ZenCode V2 - Blueprint Service
 *
 * AI-powered blueprint generation from PRD using stack-agnostic prompts.
 * Supports two modes:
 * - Lean: Fast, high-level architecture (V1 style)
 * - Detailed: Chunked generation with full model/service/route/component specs
 */

import { connectDB } from '@/lib/db/connection'
import { Blueprint, Requirement, Project } from '@/lib/db/models'
import { chat, parseAiJson, getAnthropicKey } from '@/lib/ai/anthropic'
import { getStack } from '@/stacks'
import { checkAiRateLimit } from '@/lib/rate-limit'
import { cacheGet, cacheSet, hashInput } from '@/lib/cache'

// =============================================================================
// Types
// =============================================================================

export type BlueprintMode = 'lean' | 'detailed'

export interface GenerateBlueprintInput {
  projectId: string
  requirementId: string
  orgId: string
  userId: string
  stackId?: string
  mode?: BlueprintMode  // 'lean' (default) or 'detailed'
}

// High-level architecture component
export interface ArchitectureComponent {
  id: string
  name: string
  type: 'frontend' | 'backend' | 'database' | 'service' | 'infrastructure'
  description: string
  techStack: string[]
  dependencies: string[]
}

export interface Architecture {
  overview: string
  components: ArchitectureComponent[]
  dataFlow: string
  securityConsiderations: string[]
}

// Detailed specs (for chunked generation)
export interface ModelField {
  name: string
  type: string
  required?: boolean
  unique?: boolean
  index?: boolean
  ref?: string
  default?: string
}

export interface ModelDefinition {
  name: string
  description: string
  fields: ModelField[]
  relationships: string[]
  indexes?: string[]
}

export interface ServiceMethod {
  name: string
  description: string
  inputs: string[]
  outputs: string
}

export interface ServiceDefinition {
  name: string
  description: string
  methods: ServiceMethod[]
}

export interface RouteEndpoint {
  method: 'query' | 'mutation'
  name: string
  description: string
}

export interface RouteDefinition {
  name: string
  description: string
  endpoints: RouteEndpoint[]
}

export interface ComponentDefinition {
  name: string
  type: 'page' | 'layout' | 'component'
  description: string
  props?: string[]
}

export interface BlueprintResult {
  blueprintId: string
  name: string
  description: string
  architecture: Architecture
  estimatedWorkOrders: number
  // Detailed specs (only in 'detailed' mode)
  models?: ModelDefinition[]
  services?: ServiceDefinition[]
  routes?: RouteDefinition[]
  components?: ComponentDefinition[]
  fileStructure?: string[]
}

// =============================================================================
// Blueprint Generation
// =============================================================================

export async function generateBlueprintFromRequirement(
  input: GenerateBlueprintInput
): Promise<BlueprintResult> {
  await connectDB()

  await checkAiRateLimit(input.orgId)

  const project = await Project.findById(input.projectId)
  if (!project) throw new Error('Project not found')

  const requirement = await Requirement.findById(input.requirementId)
  if (!requirement) throw new Error('Requirement not found')

  if (requirement.status !== 'approved') {
    throw new Error('Requirement must be approved before generating blueprint')
  }

  const mode = input.mode || 'lean'
  const stackId = input.stackId || 'nextjs-mongodb'
  const stack = getStack(stackId)
  const existingStack = stack.name

  // Format features for the prompt
  const featureList = (requirement.features || [])
    .map((f: { name: string; description: string; priority?: string }) =>
      `- ${f.name} (${f.priority || 'medium'}): ${f.description}`
    )
    .join('\n')

  const prdContent = requirement.content?.raw || JSON.stringify(requirement.content, null, 2)

  // Look up org API key for BYOK
  const apiKey = await getAnthropicKey(input.orgId)
  const trackUsage = { orgId: input.orgId, projectId: input.projectId, operation: 'blueprint.generate' }

  // Check cache for identical input
  const prdContentStr = typeof prdContent === 'string' ? prdContent : JSON.stringify(prdContent)
  const cacheKey = hashInput(prdContentStr, stackId, mode)
  const cachedResult = await cacheGet<Omit<BlueprintResult, 'blueprintId'>>(cacheKey)

  // Generate based on mode
  const result = cachedResult || (mode === 'detailed'
    ? await generateDetailedBlueprint(project, prdContent, featureList, existingStack, stackId, apiKey, trackUsage)
    : await generateLeanBlueprint(project, prdContent, featureList, existingStack, apiKey, trackUsage))

  if (!cachedResult) {
    cacheSet(cacheKey, result, 3600) // Cache for 1 hour
  }

  // Validate component dependencies
  const componentIds = new Set(result.architecture.components.map((c) => c.id))
  for (const comp of result.architecture.components) {
    for (const dep of comp.dependencies || []) {
      if (!componentIds.has(dep)) {
        console.warn(`Component "${comp.name}" references non-existent dependency: ${dep}`)
      }
    }
  }

  // Get latest version
  const latest = await Blueprint.findOne({ projectId: input.projectId })
    .sort({ version: -1 })
    .lean()

  const version = (latest?.version || 0) + 1

  // Archive old version
  if (latest) {
    await Blueprint.updateOne(
      { _id: latest._id },
      { $set: { status: 'archived' } }
    )
  }

  // Create new blueprint
  const blueprint = await Blueprint.create({
    projectId: input.projectId,
    requirementId: input.requirementId,
    version,
    status: 'draft',
    stackId,
    name: result.name,
    description: result.description,
    architecture: result.architecture,
    estimatedWorkOrders: result.estimatedWorkOrders,
    models: result.models,
    services: result.services,
    routes: result.routes,
    components: result.components,
    fileStructure: result.fileStructure,
    createdBy: input.userId,
  })

  return {
    blueprintId: blueprint._id.toString(),
    ...result,
  }
}

// =============================================================================
// Lean Generation (V1-style: ~5K tokens, 10-20s)
// =============================================================================

async function generateLeanBlueprint(
  project: { name: string; description?: string },
  prdContent: string,
  featureList: string,
  existingStack: string,
  apiKey?: string,
  trackUsage?: { orgId: string; projectId: string; operation: string }
): Promise<Omit<BlueprintResult, 'blueprintId'>> {
  const systemPrompt = `You are a practical software architect. Design a focused technical blueprint that builds on the project's EXISTING technology stack.

CRITICAL RULES:
- Design components that integrate with the existing stack, NOT a new app from scratch
- Only include components directly needed to implement the listed features
- Do NOT over-engineer. Keep it simple (3-8 components)
- Each component should map to actual code (a model, service, page, API route)

Return JSON:
{
  "name": "Blueprint name",
  "description": "Brief description",
  "architecture": {
    "overview": "High-level overview in markdown",
    "components": [
      {
        "id": "unique-id",
        "name": "Component Name",
        "type": "frontend|backend|database|service|infrastructure",
        "description": "What this component does",
        "techStack": ["technologies used"],
        "dependencies": ["other-component-id"]
      }
    ],
    "dataFlow": "How data flows through the system",
    "securityConsiderations": ["Security items specific to these features"]
  },
  "estimatedWorkOrders": 5
}`

  const userPrompt = `Design a blueprint for: **${project.name}**
${project.description ? `Description: ${project.description}\n` : ''}
Stack: ${existingStack}

PRD:
${prdContent}

Features:
${featureList}

Return only JSON.`

  const result = await parseAiJson<{
    name: string
    description: string
    architecture: Architecture
    estimatedWorkOrders: number
  }>(
    () => chat([{ role: 'user', content: userPrompt }], {
      system: systemPrompt,
      maxTokens: 8192,
      temperature: 0.3,
      apiKey,
      trackUsage,
    }),
    'generateLeanBlueprint'
  )

  return result
}

// =============================================================================
// Detailed Generation (Chunked: ~25K tokens, 40-80s)
// =============================================================================

async function generateDetailedBlueprint(
  project: { name: string; description?: string },
  prdContent: string,
  featureList: string,
  existingStack: string,
  stackId: string,
  apiKey?: string,
  trackUsage?: { orgId: string; projectId: string; operation: string }
): Promise<Omit<BlueprintResult, 'blueprintId'>> {
  console.log('[Blueprint] Starting detailed chunked generation...')

  // Chunk 1: Architecture + Models (~3-4K tokens)
  console.log('[Blueprint] Chunk 1: Generating architecture and models...')
  const chatOpts = { apiKey, trackUsage }
  const chunk1 = await generateChunk1_ArchitectureModels(project, prdContent, featureList, existingStack, chatOpts)

  // Chunk 2: Services (~3-4K tokens)
  console.log('[Blueprint] Chunk 2: Generating services...')
  const chunk2 = await generateChunk2_Services(prdContent, featureList, chunk1.models, chatOpts)

  // Chunk 3: Routes (~2-3K tokens)
  console.log('[Blueprint] Chunk 3: Generating routes...')
  const chunk3 = await generateChunk3_Routes(featureList, chunk2.services, chatOpts)

  // Chunk 4: UI Components (~3-4K tokens)
  console.log('[Blueprint] Chunk 4: Generating UI components...')
  const chunk4 = await generateChunk4_Components(featureList, chunk3.routes, stackId, chatOpts)

  console.log('[Blueprint] Detailed generation complete!')

  return {
    name: chunk1.name,
    description: chunk1.description,
    architecture: chunk1.architecture,
    estimatedWorkOrders: chunk1.estimatedWorkOrders,
    models: chunk1.models,
    services: chunk2.services,
    routes: chunk3.routes,
    components: chunk4.components,
    fileStructure: chunk4.fileStructure,
  }
}

// Chunk 1: Architecture + Models
async function generateChunk1_ArchitectureModels(
  project: { name: string; description?: string },
  prdContent: string,
  featureList: string,
  existingStack: string,
  opts?: { apiKey?: string; trackUsage?: { orgId: string; projectId: string; operation: string } }
): Promise<{
  name: string
  description: string
  architecture: Architecture
  estimatedWorkOrders: number
  models: ModelDefinition[]
}> {
  const systemPrompt = `You are a software architect. Generate the architecture overview AND all data models for this project.

Return JSON:
{
  "name": "Blueprint name",
  "description": "Brief description",
  "architecture": {
    "overview": "High-level architecture overview",
    "components": [
      { "id": "id", "name": "Name", "type": "frontend|backend|database|service", "description": "desc", "techStack": ["tech"], "dependencies": [] }
    ],
    "dataFlow": "Data flow description",
    "securityConsiderations": ["security items"]
  },
  "estimatedWorkOrders": 8,
  "models": [
    {
      "name": "Task",
      "description": "Task entity",
      "fields": [
        { "name": "title", "type": "String", "required": true },
        { "name": "status", "type": "String", "required": true, "default": "'pending'" },
        { "name": "userId", "type": "String", "required": true, "index": true }
      ],
      "relationships": ["belongs to User"],
      "indexes": ["userId", "status"]
    }
  ]
}`

  const userPrompt = `Project: ${project.name}
Stack: ${existingStack}

PRD:
${prdContent}

Features:
${featureList}

Generate architecture overview and ALL data models with complete field definitions.`

  return parseAiJson(
    () => chat([{ role: 'user', content: userPrompt }], {
      system: systemPrompt,
      maxTokens: 8192,
      temperature: 0.3,
      apiKey: opts?.apiKey,
      trackUsage: opts?.trackUsage,
    }),
    'chunk1_models'
  )
}

// Chunk 2: Services
async function generateChunk2_Services(
  prdContent: string,
  featureList: string,
  models: ModelDefinition[],
  opts?: { apiKey?: string; trackUsage?: { orgId: string; projectId: string; operation: string } }
): Promise<{ services: ServiceDefinition[] }> {
  const modelNames = models.map(m => m.name).join(', ')
  const modelSummary = models.map(m => `${m.name}: ${m.fields.map(f => f.name).join(', ')}`).join('\n')

  const systemPrompt = `You are a software architect. Generate service definitions with all methods.

Return JSON:
{
  "services": [
    {
      "name": "task",
      "description": "Task business logic",
      "methods": [
        { "name": "create", "description": "Create task", "inputs": ["userId", "data"], "outputs": "ITask" },
        { "name": "list", "description": "List tasks", "inputs": ["userId", "filters"], "outputs": "ITask[]" },
        { "name": "update", "description": "Update task", "inputs": ["taskId", "userId", "data"], "outputs": "ITask" },
        { "name": "delete", "description": "Delete task", "inputs": ["taskId", "userId"], "outputs": "void" }
      ]
    }
  ]
}`

  const userPrompt = `Based on these models, generate all service definitions:

Models: ${modelNames}
${modelSummary}

Features:
${featureList}

PRD excerpt:
${prdContent.slice(0, 2000)}

Generate services with ALL CRUD + feature-specific methods.`

  return parseAiJson(
    () => chat([{ role: 'user', content: userPrompt }], {
      system: systemPrompt,
      maxTokens: 8192,
      temperature: 0.3,
      apiKey: opts?.apiKey,
      trackUsage: opts?.trackUsage,
    }),
    'chunk2_services'
  )
}

// Chunk 3: Routes
async function generateChunk3_Routes(
  featureList: string,
  services: ServiceDefinition[],
  opts?: { apiKey?: string; trackUsage?: { orgId: string; projectId: string; operation: string } }
): Promise<{ routes: RouteDefinition[] }> {
  const serviceSummary = services.map(s =>
    `${s.name}: ${s.methods.map(m => m.name).join(', ')}`
  ).join('\n')

  const systemPrompt = `You are a software architect. Generate tRPC route definitions.

Return JSON:
{
  "routes": [
    {
      "name": "task",
      "description": "Task tRPC router",
      "endpoints": [
        { "method": "query", "name": "list", "description": "List tasks with filters" },
        { "method": "query", "name": "getById", "description": "Get task by ID" },
        { "method": "mutation", "name": "create", "description": "Create task" },
        { "method": "mutation", "name": "update", "description": "Update task" },
        { "method": "mutation", "name": "delete", "description": "Delete task" }
      ]
    }
  ]
}`

  const userPrompt = `Based on these services, generate tRPC route definitions:

Services:
${serviceSummary}

Features:
${featureList}

Generate routes with query/mutation endpoints for each service method.`

  return parseAiJson(
    () => chat([{ role: 'user', content: userPrompt }], {
      system: systemPrompt,
      maxTokens: 8192,
      temperature: 0.3,
      apiKey: opts?.apiKey,
      trackUsage: opts?.trackUsage,
    }),
    'chunk3_routes'
  )
}

// Chunk 4: UI Components + File Structure
async function generateChunk4_Components(
  featureList: string,
  routes: RouteDefinition[],
  stackId: string,
  opts?: { apiKey?: string; trackUsage?: { orgId: string; projectId: string; operation: string } }
): Promise<{ components: ComponentDefinition[]; fileStructure: string[] }> {
  const routeSummary = routes.map(r =>
    `${r.name}: ${r.endpoints.map(e => e.name).join(', ')}`
  ).join('\n')

  const systemPrompt = `You are a software architect. Generate UI component definitions and file structure.

Return JSON:
{
  "components": [
    { "name": "TaskList", "type": "component", "description": "Displays list of tasks", "props": ["tasks", "onEdit", "onDelete"] },
    { "name": "TaskForm", "type": "component", "description": "Create/edit task form", "props": ["task", "onSubmit"] },
    { "name": "TasksPage", "type": "page", "description": "Main tasks page with list and filters" }
  ],
  "fileStructure": [
    "src/lib/db/models/task.ts",
    "src/server/services/task.ts",
    "src/server/trpc/procedures/task.ts",
    "src/components/tasks/task-list.tsx",
    "src/components/tasks/task-form.tsx",
    "src/app/(dashboard)/tasks/page.tsx"
  ]
}`

  const userPrompt = `Generate UI components and file structure for these features:

Features:
${featureList}

Routes:
${routeSummary}

Stack: ${stackId}

Generate components (pages, layouts, components) and complete file structure.`

  return parseAiJson(
    () => chat([{ role: 'user', content: userPrompt }], {
      system: systemPrompt,
      maxTokens: 8192,
      temperature: 0.3,
      apiKey: opts?.apiKey,
      trackUsage: opts?.trackUsage,
    }),
    'chunk4_components'
  )
}
