/**
 * ZenCode V2 - Requirement Service
 *
 * AI-powered PRD generation using stack-agnostic prompts.
 */

import { connectDB } from '@/lib/db/connection'
import { Requirement, Project } from '@/lib/db/models'
import { chat, parseAiJson, getAnthropicKey } from '@/lib/ai/anthropic'
import { getStack } from '@/stacks'
import { getDocumentContext } from './document'
import { sanitizePromptInput } from '@/lib/sanitize'
import { checkAiRateLimit } from '@/lib/rate-limit'
import { cacheGet, cacheSet, hashInput } from '@/lib/cache'

// =============================================================================
// Types
// =============================================================================

export interface GeneratePRDInput {
  projectId: string
  rawText: string
  orgId: string
  userId: string
  stackId?: string
  documentIds?: string[]
  options?: {
    authType?: 'none' | 'clerk' | 'auth0' | 'firebase' | 'custom'
    deploymentTarget?: string
  }
}

export interface PRDContent {
  overview: string
  goals: string[]
  userPersonas: string[]
  functionalRequirements: string[]
  nonFunctionalRequirements: string[]
  dataModels: string[]
  apiEndpoints: string[]
  uiRequirements: string[]
  authRequirements?: string[]
  securityConsiderations: string[]
  successMetrics: string[]
}

export interface Feature {
  id: string
  name: string
  description: string
  priority: 'high' | 'medium' | 'low'
  userStories: string[]
  acceptanceCriteria: string[]
}

export interface GeneratePRDResult {
  requirementId: string
  content: PRDContent
  features: Feature[]
}

// =============================================================================
// PRD Generation
// =============================================================================

export async function generateRequirementPRD(
  input: GeneratePRDInput
): Promise<GeneratePRDResult> {
  await connectDB()

  await checkAiRateLimit(input.orgId)

  const project = await Project.findById(input.projectId)
  if (!project) throw new Error('Project not found')

  const stackId = input.stackId || 'nextjs-mongodb'
  const stack = getStack(stackId)

  // Build system prompt from stack
  const stackPrompt = stack.getPromptSection('prd')
  const systemPrompt = `You are an expert product manager and software architect.

${stackPrompt}

Return your response as a JSON object with this exact structure:
{
  "content": {
    "overview": "string",
    "goals": ["string"],
    "userPersonas": ["string"],
    "functionalRequirements": ["string"],
    "nonFunctionalRequirements": ["string"],
    "dataModels": ["string - describe each entity and its fields"],
    "apiEndpoints": ["string - describe each API endpoint"],
    "uiRequirements": ["string - describe pages and components"],
    "authRequirements": ["string - auth requirements if applicable"],
    "securityConsiderations": ["string"],
    "successMetrics": ["string"]
  },
  "features": [
    {
      "id": "feature-1",
      "name": "Feature Name",
      "description": "What this feature does",
      "priority": "high|medium|low",
      "userStories": ["As a user, I want..."],
      "acceptanceCriteria": ["Given..., When..., Then..."]
    }
  ]
}

IMPORTANT:
- Be comprehensive but focused
- Each feature should be independently implementable
- Data models should include field types and relationships
- API endpoints should map to tRPC procedures
- If document context is provided, incorporate relevant information
- Return ONLY valid JSON, no markdown`

  // Get document context if documentIds provided
  let documentContext = ''
  if (input.documentIds && input.documentIds.length > 0) {
    try {
      documentContext = await getDocumentContext({
        projectId: input.projectId,
        stage: 'prd',
        queryText: input.rawText,
        topK: 8,
      })
    } catch (error) {
      console.error('Failed to get document context:', error)
    }
  }

  // Look up org API key for BYOK
  const apiKey = await getAnthropicKey(input.orgId)

  const sanitizedRawText = sanitizePromptInput(input.rawText)

  const userPrompt = `Generate a PRD for this application:

**Project Name:** ${project.name}
**Description:** ${project.description || 'Not provided'}

**User Requirements:**
${sanitizedRawText}

${input.options?.authType ? `**Authentication:** ${input.options.authType}` : ''}
${input.options?.deploymentTarget ? `**Deployment:** ${input.options.deploymentTarget}` : ''}
${documentContext ? `\n**Reference Documents:**\n${documentContext}` : ''}

Generate a comprehensive PRD with all features extracted.`

  // Check cache for identical input
  const cacheKey = hashInput(sanitizedRawText, stackId, documentContext)
  const cached = await cacheGet<{ content: PRDContent; features: Feature[] }>(cacheKey)

  const result = cached || await parseAiJson<{ content: PRDContent; features: Feature[] }>(
    () => chat([{ role: 'user', content: userPrompt }], {
      system: systemPrompt,
      maxTokens: 16384,
      apiKey,
      trackUsage: { orgId: input.orgId, projectId: input.projectId, operation: 'prd.generate' },
    }),
    'generatePRD'
  )

  if (!cached) {
    cacheSet(cacheKey, result, 3600) // Cache for 1 hour
  }

  // Ensure feature IDs are unique
  const features = result.features.map((f: Feature, i: number) => ({
    ...f,
    id: f.id || `feature-${i + 1}`,
  }))

  // Get latest version
  const latest = await Requirement.findOne({ projectId: input.projectId })
    .sort({ version: -1 })
    .lean()

  const version = (latest?.version || 0) + 1

  // Archive old version
  if (latest) {
    await Requirement.updateOne(
      { _id: latest._id },
      { $set: { status: 'archived' } }
    )
  }

  // Create new requirement
  const requirement = await Requirement.create({
    projectId: input.projectId,
    version,
    status: 'draft',
    content: result.content,
    rawText: input.rawText,
    features,
    createdBy: input.userId,
  })

  return {
    requirementId: requirement._id.toString(),
    content: result.content,
    features,
  }
}

// =============================================================================
// PRD Enhancement
// =============================================================================

export interface EnhancePRDInput {
  projectId: string
  requirementId: string
  feedback: string
  orgId?: string
  stackId?: string
}

export async function enhanceRequirementPRD(
  input: EnhancePRDInput
): Promise<GeneratePRDResult> {
  await connectDB()

  const requirement = await Requirement.findById(input.requirementId)
  if (!requirement) throw new Error('Requirement not found')

  const stackId = input.stackId || 'nextjs-mongodb'
  const stack = getStack(stackId)

  const stackPrompt = stack.getPromptSection('prd')
  const systemPrompt = `You are an expert product manager enhancing an existing PRD.

${stackPrompt}

Return the COMPLETE enhanced PRD as JSON with the same structure.
Include ALL original content plus enhancements based on feedback.`

  const sanitizedFeedback = sanitizePromptInput(input.feedback)

  const userPrompt = `Enhance this PRD based on feedback:

**Current PRD:**
${JSON.stringify(requirement.content, null, 2)}

**Current Features:**
${JSON.stringify(requirement.features, null, 2)}

**Enhancement Feedback:**
${sanitizedFeedback}

Return the complete enhanced PRD as JSON.`

  const apiKey = input.orgId ? await getAnthropicKey(input.orgId) : undefined

  const result = await parseAiJson<{ content: PRDContent; features: Feature[] }>(
    () => chat([{ role: 'user', content: userPrompt }], {
      system: systemPrompt,
      maxTokens: 16384,
      apiKey,
      trackUsage: input.orgId ? { orgId: input.orgId, projectId: input.projectId, operation: 'prd.enhance' } : undefined,
    }),
    'enhancePRD'
  )

  // Update requirement
  await Requirement.updateOne(
    { _id: input.requirementId },
    {
      $set: {
        content: result.content,
        features: result.features,
      },
    }
  )

  return {
    requirementId: input.requirementId,
    content: result.content,
    features: result.features,
  }
}

// =============================================================================
// Feature Extraction (standalone)
// =============================================================================

export interface ExtractFeaturesInput {
  projectId: string
  requirementId: string
  stackId?: string
}

export async function extractFeaturesFromPRD(
  input: ExtractFeaturesInput
): Promise<Feature[]> {
  await connectDB()

  const requirement = await Requirement.findById(input.requirementId)
  if (!requirement) throw new Error('Requirement not found')

  const stackId = input.stackId || 'nextjs-mongodb'
  const stack = getStack(stackId)

  const systemPrompt = `You are an expert at breaking down PRDs into implementable features.

Extract atomic, independently implementable features from the PRD.
Each feature should:
- Have a clear scope
- Be testable
- Have defined acceptance criteria

Return as JSON array of features.`

  const userPrompt = `Extract features from this PRD:

${JSON.stringify(requirement.content, null, 2)}

Return as JSON: { "features": [...] }`

  const result = await parseAiJson<{ features: Feature[] }>(
    () => chat([{ role: 'user', content: userPrompt }], {
      system: systemPrompt,
      maxTokens: 8192
    }),
    'extractFeatures'
  )

  // Update requirement with extracted features
  await Requirement.updateOne(
    { _id: input.requirementId },
    { $set: { features: result.features } }
  )

  return result.features
}
