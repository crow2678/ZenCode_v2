/**
 * ZenCode V2 - Work Orders Service
 *
 * AI-powered work order generation from blueprint using stack-agnostic prompts.
 */

import { connectDB } from '@/lib/db/connection'
import { WorkOrder, Blueprint, Project, Requirement } from '@/lib/db/models'
import { chat, parseAiJson, getAnthropicKey } from '@/lib/ai/anthropic'
import { getStack } from '@/stacks'
import { checkAiRateLimit } from '@/lib/rate-limit'
import type { WorkOrderPhase } from '@/lib/db/models'

// =============================================================================
// Types
// =============================================================================

export interface GenerateWorkOrdersInput {
  projectId: string
  blueprintId: string
  orgId: string
  userId: string
  stackId?: string
}

export interface WorkOrderFile {
  path: string
  action: 'create' | 'modify' | 'delete'
  content: string
  description: string
}

export interface GeneratedWorkOrder {
  orderNumber: number
  title: string
  description: string
  phase: WorkOrderPhase
  files: WorkOrderFile[]
}

export interface GenerateWorkOrdersResult {
  workOrderIds: string[]
  workOrders: GeneratedWorkOrder[]
  totalFiles: number
}

// =============================================================================
// Work Order Generation
// =============================================================================

export async function generateWorkOrdersFromBlueprint(
  input: GenerateWorkOrdersInput
): Promise<GenerateWorkOrdersResult> {
  console.log('[WorkOrders] Starting generation for project:', input.projectId)
  await connectDB()

  await checkAiRateLimit(input.orgId)

  const project = await Project.findById(input.projectId)
  if (!project) throw new Error('Project not found')

  const blueprint = await Blueprint.findById(input.blueprintId)
  if (!blueprint) throw new Error('Blueprint not found')

  if (blueprint.status !== 'approved') {
    throw new Error('Blueprint must be approved before generating work orders')
  }

  const requirement = await Requirement.findById(blueprint.requirementId)

  const stackId = input.stackId || blueprint.stackId || 'nextjs-mongodb'
  const stack = getStack(stackId)

  // Build system prompt from stack (metadata-only, no agent-execution needed)
  const stackPrompt = stack.getPromptSection('work-orders')

  // Build architecture summary from components
  const archComponents = (blueprint.architecture?.components || [])
    .map((c: { id?: string; name: string; type: string; description: string; techStack?: string[] }) =>
      `- ${c.name} (${c.type}): ${c.description}${c.techStack ? ` [${c.techStack.join(', ')}]` : ''}`
    )
    .join('\n')

  // Build features list from PRD
  const featureList = (requirement?.features || [])
    .map((f: { name: string; description: string; priority?: string }) =>
      `- ${f.name} (${f.priority || 'medium'}): ${f.description}`
    )
    .join('\n')

  // Build file path mapping from stack handler (works for any stack)
  const fs = stack.fileStructure
  const filePathRules = `FILE PATH RULES (CRITICAL — use these exact directories):
- Models:     ${fs.models}/       (e.g. ${fs.models}/task.ts)
- Services:   ${fs.services}/     (e.g. ${fs.services}/task.ts)
- Routes:     ${fs.routes}/       (e.g. ${fs.routes}/task.ts)
- Pages:      ${fs.pages}/        (e.g. ${fs.pages}/tasks/page.tsx)
- Components: ${fs.components}/   (e.g. ${fs.components}/tasks/task-list.tsx)
- Utils:      ${fs.utils}/        (e.g. ${fs.utils}/utils.ts)
Use singular, kebab-case file names (task.ts not tasks.ts, task-form.tsx not TaskForm.tsx).`

  const systemPrompt = `You are an expert code generator creating work orders for a software project.

${stackPrompt}

${filePathRules}

CRITICAL: Generate work orders that implement ALL features from the PRD.

NOTE: Generate work order METADATA only (title, description, file paths). DO NOT include file content - code will be generated during execution.

Return your response as a JSON object:
{
  "workOrders": [
    {
      "orderNumber": 1,
      "title": "Create data models",
      "description": "Mongoose schemas for Task (title String required, status String enum, ...) and Tag (name String required, color String). Include TypeScript interfaces and indexes.",
      "phase": "models",
      "files": [
        {
          "path": "${fs.models}/task.ts",
          "action": "create",
          "description": "Task model with ITask interface, TaskSchema with all fields, indexes on userId and status"
        },
        {
          "path": "${fs.models}/tag.ts",
          "action": "create",
          "description": "Tag model with ITag interface, TagSchema"
        }
      ]
    }
  ]
}

WORK ORDER PHASES (generate in this order):
1. models - Data models (include field specifications in description)
2. services - Business logic (list all methods in description)
3. procedures - API routers (list all endpoints in description)
4. components - UI components (describe props and functionality)
5. pages - Application pages
6. integration - Barrel exports, root router registration

REQUIREMENTS:
1. STRICTLY 8-15 work orders total — group related files together
2. Include DETAILED descriptions — these guide code generation
3. For models: list all fields with types in description
4. For services: list all methods with inputs/outputs
5. For procedures: list all query/mutation endpoints
6. For components: describe props and behavior
7. Each work order can have 1-5 files
8. NO content field — only path, action, description
9. Return ONLY valid JSON, no markdown wrapping`

  // Build compact blueprint summaries to minimize token usage
  const modelSummary = (blueprint.models || [])
    .map((m: { name: string; fields: Array<{ name: string; type: string; required?: boolean; index?: boolean }> }) =>
      `- ${m.name}: ${m.fields.map(f => `${f.name}(${f.type}${f.required ? '!' : ''}${f.index ? ',idx' : ''})`).join(', ')}`
    )
    .join('\n')

  const serviceSummary = (blueprint.services || [])
    .map((s: { name: string; methods: Array<{ name: string; description: string }> }) =>
      `- ${s.name}: ${s.methods.map(m => m.name).join(', ')}`
    )
    .join('\n')

  const routeSummary = (blueprint.routes || [])
    .map((r: { name: string; endpoints: Array<{ method: string; name: string }> }) =>
      `- ${r.name}: ${r.endpoints.map(e => `${e.method}:${e.name}`).join(', ')}`
    )
    .join('\n')

  const componentSummary = (blueprint.components || [])
    .map((c: { name: string; type: string; description: string }) =>
      `- ${c.name} (${c.type}): ${c.description}`
    )
    .join('\n')

  // Use detailed specs if available, otherwise use architecture + features
  const hasDetailedSpecs = blueprint.models?.length > 0

  const userPrompt = hasDetailedSpecs ?
    // Detailed blueprint - use compact summaries
    `Generate work orders from this blueprint:

**Project:** ${project.name}

**Architecture Overview:**
${blueprint.architecture?.overview || 'Not provided'}

**Models:** ${blueprint.models?.length || 0} defined
${modelSummary}

**Services:** ${blueprint.services?.length || 0} defined
${serviceSummary}

**Routes:** ${blueprint.routes?.length || 0} defined
${routeSummary}

**Components:** ${blueprint.components?.length || 0} defined
${componentSummary}

**PRD Features:**
${featureList}

IMPORTANT: Group related items into 8-15 work orders total. For example, combine ALL models into 1-2 work orders, ALL services into 1-2 work orders, etc. Do NOT create one work order per file.`
    :
    // Lean blueprint - infer from architecture + features
    `Generate work orders from this blueprint and PRD:

**Project:** ${project.name}

**Architecture Overview:**
${blueprint.architecture?.overview || 'Not provided'}

**Architecture Components:**
${archComponents || 'Not provided'}

**Data Flow:**
${blueprint.architecture?.dataFlow || 'Not provided'}

**PRD Features to Implement:**
${featureList}

**Stack:** ${stackId}

IMPORTANT: Generate 8-15 work orders total, grouping related items. For example:
- 1 work order for ALL data models (list all field names, types in description)
- 1 work order for ALL services (list all methods in description)
- 1 work order for ALL tRPC routers (list all endpoints in description)
- 2-3 work orders for UI components grouped by feature
- 1-2 work orders for pages
- 1 work order for integration (barrel exports, root router)`

  // Look up org API key for BYOK
  const apiKey = await getAnthropicKey(input.orgId)

  const result = await parseAiJson<{ workOrders: GeneratedWorkOrder[] }>(
    () => chat([{ role: 'user', content: userPrompt }], {
      system: systemPrompt,
      maxTokens: 8192,  // Metadata only - no code content
      temperature: 0.3,
      apiKey,
      trackUsage: { orgId: input.orgId, projectId: input.projectId, operation: 'workorders.generate' },
    }),
    'generateWorkOrders'
  )

  // Validate and fix work orders
  const validatedWorkOrders = result.workOrders.map((wo: GeneratedWorkOrder, index: number) => ({
    ...wo,
    orderNumber: wo.orderNumber || index + 1,
    phase: validatePhase(wo.phase),
    files: wo.files.map((f: WorkOrderFile) => ({
      ...f,
      action: validateFileAction(f.action),
      content: f.content || '',
    })),
  }))

  // Sort by phase order
  const phaseOrder: Record<WorkOrderPhase, number> = {
    scaffold: 1,
    models: 2,
    services: 3,
    procedures: 4,
    components: 5,
    pages: 6,
    integration: 7,
  }

  validatedWorkOrders.sort((a, b) => {
    const orderA = phaseOrder[a.phase] || 99
    const orderB = phaseOrder[b.phase] || 99
    return orderA - orderB
  })

  // Reassign order numbers after sorting
  validatedWorkOrders.forEach((wo, i) => {
    wo.orderNumber = i + 1
  })

  // Delete existing work orders for this project
  const deleteResult = await WorkOrder.deleteMany({ projectId: input.projectId })
  console.log('[WorkOrders] Deleted existing work orders:', deleteResult.deletedCount)

  // Create work orders in database
  console.log('[WorkOrders] Creating', validatedWorkOrders.length, 'new work orders')
  const createdWorkOrders = await WorkOrder.insertMany(
    validatedWorkOrders.map((wo) => ({
      projectId: input.projectId,
      blueprintId: input.blueprintId,
      orderNumber: wo.orderNumber,
      title: wo.title,
      description: wo.description,
      phase: wo.phase,
      status: 'pending',
      files: wo.files,
    }))
  )

  const totalFiles = validatedWorkOrders.reduce(
    (sum, wo) => sum + wo.files.length,
    0
  )

  console.log('[WorkOrders] Generation complete:', {
    count: createdWorkOrders.length,
    totalFiles,
    ids: createdWorkOrders.map((wo) => wo._id.toString()),
  })

  return {
    workOrderIds: createdWorkOrders.map((wo) => wo._id.toString()),
    workOrders: validatedWorkOrders,
    totalFiles,
  }
}

// =============================================================================
// Helpers
// =============================================================================

function validatePhase(phase: string): WorkOrderPhase {
  const validPhases: WorkOrderPhase[] = [
    'scaffold',
    'models',
    'services',
    'procedures',
    'components',
    'pages',
    'integration',
  ]

  if (validPhases.includes(phase as WorkOrderPhase)) {
    return phase as WorkOrderPhase
  }

  // Map common variations
  const phaseMap: Record<string, WorkOrderPhase> = {
    model: 'models',
    service: 'services',
    procedure: 'procedures',
    router: 'procedures',
    route: 'procedures',
    component: 'components',
    page: 'pages',
    ui: 'components',
    api: 'procedures',
    database: 'models',
    setup: 'scaffold',
    config: 'scaffold',
    wiring: 'integration',
    barrel: 'integration',
  }

  return phaseMap[phase.toLowerCase()] || 'integration'
}

function validateFileAction(action: string | undefined): 'create' | 'modify' | 'delete' {
  if (!action) return 'create'

  const normalized = action.toLowerCase()

  // Map common variations
  const actionMap: Record<string, 'create' | 'modify' | 'delete'> = {
    create: 'create',
    add: 'create',
    new: 'create',
    modify: 'modify',
    update: 'modify',
    edit: 'modify',
    change: 'modify',
    delete: 'delete',
    remove: 'delete',
  }

  return actionMap[normalized] || 'create'
}

// =============================================================================
// Work Order Status Update
// =============================================================================

export interface UpdateWorkOrderStatusInput {
  workOrderId: string
  status: 'pending' | 'queued' | 'executing' | 'completed' | 'failed'
  error?: string
  files?: WorkOrderFile[]
}

export async function updateWorkOrderStatus(
  input: UpdateWorkOrderStatusInput
): Promise<void> {
  await connectDB()

  const update: Record<string, unknown> = {
    status: input.status,
  }

  if (input.error) {
    update.error = input.error
  }

  if (input.files) {
    update.files = input.files
  }

  if (input.status === 'completed') {
    update.executedAt = new Date()
  }

  await WorkOrder.updateOne({ _id: input.workOrderId }, { $set: update })
}
