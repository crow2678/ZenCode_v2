/**
 * ZenCode V2 - Agent Service
 *
 * AI-powered work order execution using stack-agnostic prompts.
 * Executes work orders and generates/refines code files.
 */

import { connectDB } from '@/lib/db/connection'
import { WorkOrder, Blueprint, Project } from '@/lib/db/models'
import { chat, parseAiJson, getAnthropicKey } from '@/lib/ai/anthropic'
import { getStack } from '@/stacks'
import { checkAiRateLimit } from '@/lib/rate-limit'
import { sanitizePromptInput } from '@/lib/sanitize'
import { emitProjectEvent } from '@/lib/events'
import type { IWorkOrder, IWorkOrderFile } from '@/lib/db/models'
import mongoose from 'mongoose'

// =============================================================================
// Types
// =============================================================================

export interface ExecuteWorkOrderInput {
  workOrderId: string
  orgId: string
  userId: string
  stackId?: string
  existingFiles?: Map<string, string>
}

export interface ExecutedFile {
  path: string
  action: 'create' | 'modify' | 'delete'
  content: string
  description: string
}

export interface ExecuteWorkOrderResult {
  workOrderId: string
  status: 'completed' | 'failed'
  files: ExecutedFile[]
  error?: string
}

// =============================================================================
// Work Order Execution
// =============================================================================

export async function executeWorkOrderWithAgent(
  input: ExecuteWorkOrderInput
): Promise<ExecuteWorkOrderResult> {
  await connectDB()

  const workOrder = await WorkOrder.findById(input.workOrderId)
  if (!workOrder) throw new Error('Work order not found')

  const blueprint = await Blueprint.findById(workOrder.blueprintId)
  if (!blueprint) throw new Error('Blueprint not found')

  const project = await Project.findById(workOrder.projectId)
  if (!project) throw new Error('Project not found')

  const stackId = input.stackId || blueprint.stackId || 'nextjs-mongodb'
  const stack = getStack(stackId)

  // Mark as executing and clear previous logs
  await WorkOrder.updateOne(
    { _id: input.workOrderId },
    { $set: { status: 'executing', executionLogs: [], error: null } }
  )

  // Look up org API key for BYOK
  const apiKey = await getAnthropicKey(input.orgId)
  await checkAiRateLimit(input.orgId)

  try {
    // Helper to append a log entry to the work order in DB + emit SSE event
    const addLog = async (message: string, type: 'info' | 'success' | 'error' | 'progress', filePath?: string) => {
      console.log(`[Agent] [${type}] ${message}${filePath ? ` (${filePath})` : ''}`)
      await WorkOrder.updateOne(
        { _id: input.workOrderId },
        { $push: { executionLogs: { timestamp: new Date(), message, type, filePath } } }
      )
      emitProjectEvent({
        type: 'execution',
        projectId: workOrder.projectId.toString(),
        status: type === 'error' ? 'failed' : type === 'success' ? 'completed' : 'progress',
        message,
        data: { workOrderId: input.workOrderId, filePath },
        timestamp: new Date(),
      })
    }

    await addLog(`Starting execution: ${workOrder.title} (${workOrder.files.length} files)`, 'info')

    // Build system prompt
    const agentPrompt = stack.getPromptSection('agent-execution')
    const filePathRules = `FILE PATH RULES:
- Models: ${stack.fileStructure.models}/
- Services: ${stack.fileStructure.services}/
- Routes: ${stack.fileStructure.routes}/
- Pages: ${stack.fileStructure.pages}/
- Components: ${stack.fileStructure.components}/`

    const systemPrompt = `You are an expert code generator.

${agentPrompt}

${filePathRules}

CRITICAL REQUIREMENTS:
1. Generate COMPLETE, PRODUCTION-READY code for the SINGLE file requested
2. NO placeholders, NO TODOs, NO "implement this"
3. ALL imports must be correct and complete
4. ALL TypeScript types must be explicit
5. Follow the stack's patterns exactly

Return your response as JSON:
{
  "path": "file/path.ts",
  "action": "create",
  "content": "// Complete file content",
  "description": "Brief description"
}

Return ONLY valid JSON, no markdown wrapping.`

    const workOrderContext = buildWorkOrderContext(workOrder, blueprint)

    // Build existing files context (from previously generated files in this session)
    const existingFilesContext = input.existingFiles
      ? Array.from(input.existingFiles.entries())
          .slice(0, 20)
          .map(([path, content]) => `--- ${path} ---\n${content.slice(0, 500)}`)
          .join('\n\n')
      : ''

    // Per-file token limits
    const phaseTokensPerFile: Record<string, number> = {
      models: 3072,
      services: 4096,
      procedures: 3072,
      components: 4096,
      pages: 4096,
      integration: 2048,
      scaffold: 2048,
    }
    const maxTokensPerFile = phaseTokensPerFile[workOrder.phase] || 4096

    // Generate each file individually
    const allFiles: ExecutedFile[] = []
    const totalFiles = workOrder.files.length

    for (let i = 0; i < totalFiles; i++) {
      const file = workOrder.files[i] as IWorkOrderFile
      await addLog(`Generating file ${i + 1}/${totalFiles}: ${file.path}`, 'progress', file.path)

      // Build per-file prompt with context of sibling files in same work order
      const siblingFiles = workOrder.files
        .filter((_: IWorkOrderFile, idx: number) => idx !== i)
        .map((f: IWorkOrderFile) => `- ${f.path}: ${f.description || f.action}`)
        .join('\n')

      // Include already-generated files from this work order as context
      const generatedSoFar = allFiles
        .map(f => `--- ${f.path} ---\n${f.content.slice(0, 800)}`)
        .join('\n\n')

      const userPrompt = `Generate this file for work order: "${workOrder.title}"

**Work Order Description:** ${workOrder.description}
**Phase:** ${workOrder.phase}

**File to Generate:**
- Path: ${file.path}
- Action: ${file.action}
- Description: ${file.description || 'No description'}

**Sibling files in this work order:**
${siblingFiles || 'None'}

${workOrderContext}

${generatedSoFar ? `**Already generated (use for consistency):**\n${generatedSoFar}` : ''}

${existingFilesContext ? `**Existing project files:**\n${existingFilesContext}` : ''}

Generate COMPLETE code for ${file.path}. Return ONLY JSON.`

      const MAX_FILE_RETRIES = 2
      let fileSuccess = false

      for (let attempt = 1; attempt <= MAX_FILE_RETRIES; attempt++) {
        try {
          const result = await parseAiJson<ExecutedFile>(
            () => chat([{ role: 'user', content: userPrompt }], {
              system: systemPrompt,
              maxTokens: maxTokensPerFile,
              apiKey,
              trackUsage: { orgId: input.orgId, projectId: workOrder.projectId.toString(), operation: `agent.execute:${file.path}` },
            }),
            `executeFile:${file.path}`
          )

          const validatedFile: ExecutedFile = {
            path: result.path || file.path,
            action: result.action || file.action || 'create',
            content: result.content || '',
            description: result.description || file.description || '',
          }

          allFiles.push(validatedFile)

          // Update the specific file in DB with generated content
          await WorkOrder.updateOne(
            { _id: input.workOrderId, 'files.path': file.path },
            { $set: { 'files.$.content': validatedFile.content } }
          )

          await addLog(`Completed: ${file.path} (${validatedFile.content.length} chars)`, 'success', file.path)
          fileSuccess = true
          break
        } catch (fileError) {
          const errMsg = fileError instanceof Error ? fileError.message : 'Unknown error'
          if (attempt < MAX_FILE_RETRIES) {
            await addLog(`Retry ${attempt}/${MAX_FILE_RETRIES}: ${file.path} — ${errMsg}`, 'progress', file.path)
            await new Promise((r) => setTimeout(r, 1000)) // 1s backoff
          } else {
            await addLog(`Failed after ${MAX_FILE_RETRIES} attempts: ${file.path} — ${errMsg}`, 'error', file.path)
          }
        }
      }

      if (!fileSuccess) {
        // All retries exhausted
        allFiles.push({
          path: file.path,
          action: file.action || 'create',
          content: `// ERROR: Failed to generate after ${MAX_FILE_RETRIES} attempts`,
          description: file.description || '',
        })
      }
    }

    // Mark work order completed
    const hasErrors = allFiles.some(f => f.content.startsWith('// ERROR:'))
    const finalStatus = hasErrors ? 'failed' : 'completed'

    await WorkOrder.updateOne(
      { _id: input.workOrderId },
      {
        $set: {
          status: finalStatus,
          files: allFiles,
          executedAt: new Date(),
          ...(hasErrors ? { error: `Some files failed to generate` } : {}),
        },
      }
    )

    await addLog(`Execution ${finalStatus}: ${allFiles.length} files`, finalStatus === 'completed' ? 'success' : 'error')

    return {
      workOrderId: input.workOrderId,
      status: finalStatus as 'completed' | 'failed',
      files: allFiles,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await WorkOrder.updateOne(
      { _id: input.workOrderId },
      {
        $set: {
          status: 'failed',
          error: errorMessage,
        },
        $push: {
          executionLogs: { timestamp: new Date(), message: `Fatal error: ${errorMessage}`, type: 'error' },
        },
      }
    )

    return {
      workOrderId: input.workOrderId,
      status: 'failed',
      files: [],
      error: errorMessage,
    }
  }
}

// =============================================================================
// Batch Execution
// =============================================================================

export interface ExecuteAllWorkOrdersInput {
  projectId: string
  orgId: string
  userId: string
  stackId?: string
  workOrderIds?: string[]  // Optional: execute only these specific work orders
}

export interface ExecuteAllWorkOrdersResult {
  completed: number
  failed: number
  results: ExecuteWorkOrderResult[]
}

export async function executeAllWorkOrders(
  input: ExecuteAllWorkOrdersInput
): Promise<ExecuteAllWorkOrdersResult> {
  await connectDB()

  console.log('[Agent] Finding pending work orders for project:', input.projectId)
  if (input.workOrderIds?.length) {
    console.log('[Agent] Filtering to specific IDs:', input.workOrderIds)
  }

  // Convert string to ObjectId for query
  const projectObjectId = new mongoose.Types.ObjectId(input.projectId)

  // Build query - filter by specific IDs if provided
  // Include 'executing' for stuck work orders, and 'completed' for re-runs
  const query: Record<string, unknown> = {
    projectId: projectObjectId,
  }

  // If specific IDs provided, allow any status (user explicitly selected them)
  // Otherwise, only run pending/queued/failed/executing
  if (!input.workOrderIds?.length) {
    query.status = { $in: ['pending', 'queued', 'failed', 'executing'] }
  }

  if (input.workOrderIds?.length) {
    query._id = { $in: input.workOrderIds.map(id => new mongoose.Types.ObjectId(id)) }
  }

  const workOrders = await WorkOrder.find(query).sort({ orderNumber: 1 })

  console.log('[Agent] Found', workOrders.length, 'pending work orders')

  if (workOrders.length === 0) {
    // Check if there are any work orders at all for this project
    const allWorkOrders = await WorkOrder.find({ projectId: projectObjectId }).lean()
    console.log('[Agent] Total work orders for project:', allWorkOrders.length)
    if (allWorkOrders.length > 0) {
      console.log('[Agent] Work order statuses:', allWorkOrders.map(wo => wo.status))
    }
  }

  const results: ExecuteWorkOrderResult[] = []
  const existingFiles = new Map<string, string>()
  let completed = 0
  let failed = 0

  for (const wo of workOrders) {
    console.log('[Agent] Executing work order:', wo.orderNumber, '-', wo.title, '(status:', wo.status, ')')

    try {
      const result = await executeWorkOrderWithAgent({
        workOrderId: wo._id.toString(),
        orgId: input.orgId,
        userId: input.userId,
        stackId: input.stackId,
        existingFiles,
      })

      results.push(result)

      if (result.status === 'completed') {
        completed++
        console.log('[Agent] Work order completed:', wo.orderNumber)
        // Add generated files to context for next work orders
        for (const file of result.files) {
          if (file.action !== 'delete') {
            existingFiles.set(file.path, file.content)
          }
        }
      } else {
        failed++
        console.log('[Agent] Work order failed:', wo.orderNumber, result.error)
      }
    } catch (error) {
      failed++
      console.error('[Agent] Error executing work order:', wo.orderNumber, error)
      results.push({
        workOrderId: wo._id.toString(),
        status: 'failed',
        files: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  console.log('[Agent] Execution complete. Completed:', completed, 'Failed:', failed)
  return { completed, failed, results }
}

// =============================================================================
// Helpers
// =============================================================================

function buildWorkOrderContext(
  workOrder: IWorkOrder,
  blueprint: { models?: Array<{ name: string; fields: Array<{ name: string; type: string; required?: boolean; index?: boolean }>; relationships?: string[] }>; services?: Array<{ name: string; methods: Array<{ name: string; description: string; inputs?: string[]; outputs?: string }> }>; routes?: Array<{ name: string; endpoints: Array<{ method: string; name: string; description: string }> }> }
): string {
  const parts: string[] = []

  // Add compact blueprint context based on phase
  if (workOrder.phase === 'models' && blueprint.models) {
    const modelLines = blueprint.models.map(m =>
      `- ${m.name}: ${m.fields.map(f => `${f.name}(${f.type}${f.required ? '!' : ''}${f.index ? ',idx' : ''})`).join(', ')}${m.relationships?.length ? ` | rels: ${m.relationships.join(', ')}` : ''}`
    )
    parts.push(`**Model Definitions:**\n${modelLines.join('\n')}`)
  }

  if (workOrder.phase === 'services' && blueprint.services) {
    const svcLines = blueprint.services.map(s =>
      `- ${s.name}: ${s.methods.map(m => `${m.name}(${(m.inputs || []).join(',')})→${m.outputs || 'void'}`).join(', ')}`
    )
    parts.push(`**Service Definitions:**\n${svcLines.join('\n')}`)
  }

  if (workOrder.phase === 'procedures' && blueprint.routes) {
    const routeLines = blueprint.routes.map(r =>
      `- ${r.name}: ${r.endpoints.map(e => `${e.method}:${e.name}`).join(', ')}`
    )
    parts.push(`**Route Definitions:**\n${routeLines.join('\n')}`)
  }

  return parts.join('\n\n')
}

// =============================================================================
// Code Refinement
// =============================================================================

export interface RefineCodeInput {
  workOrderId: string
  filePath: string
  currentContent: string
  feedback: string
  orgId?: string
  stackId?: string
}

export interface RefineCodeResult {
  path: string
  content: string
  changes: string[]
}

export async function refineWorkOrderCode(
  input: RefineCodeInput
): Promise<RefineCodeResult> {
  await connectDB()

  const workOrder = await WorkOrder.findById(input.workOrderId)
  if (!workOrder) throw new Error('Work order not found')

  const blueprint = await Blueprint.findById(workOrder.blueprintId)
  const stackId = input.stackId || blueprint?.stackId || 'nextjs-mongodb'
  const stack = getStack(stackId)

  const agentPrompt = stack.getPromptSection('agent-execution')
  const systemPrompt = `You are refining generated code based on feedback.

${agentPrompt}

Return the complete refined file content as JSON:
{
  "path": "file/path.ts",
  "content": "// Complete refined content",
  "changes": ["List of changes made"]
}

Apply ALL feedback while maintaining code quality.
Return ONLY valid JSON.`

  const sanitizedFeedback = sanitizePromptInput(input.feedback)

  const userPrompt = `Refine this code based on feedback:

**File:** ${input.filePath}

**Current Content:**
\`\`\`typescript
${input.currentContent}
\`\`\`

**Feedback:**
${sanitizedFeedback}

Return the complete refined file.`

  const refineApiKey = input.orgId ? await getAnthropicKey(input.orgId) : undefined

  const result = await parseAiJson<RefineCodeResult>(
    () => chat([{ role: 'user', content: userPrompt }], {
      system: systemPrompt,
      maxTokens: 16384,
      apiKey: refineApiKey,
      trackUsage: input.orgId ? { orgId: input.orgId, operation: 'agent.refine' } : undefined,
    }),
    'refineCode'
  )

  // Update the file in the work order
  const fileIndex = workOrder.files.findIndex((f: IWorkOrderFile) => f.path === input.filePath)
  if (fileIndex >= 0) {
    workOrder.files[fileIndex].content = result.content
    await workOrder.save()
  }

  return result
}
