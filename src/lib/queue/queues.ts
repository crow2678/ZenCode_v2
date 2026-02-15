/**
 * ZenCode V2 - Job Queues
 *
 * BullMQ queue definitions for background job processing.
 * Queues: document processing, work order execution, assembly.
 */

import { Queue } from 'bullmq'
import { getQueueConnection } from './connection'

// =============================================================================
// Job Data Types
// =============================================================================

export interface DocumentJobData {
  documentId: string
}

export interface ExecutionJobData {
  projectId: string
  orgId: string
  userId: string
  stackId?: string
  workOrderIds?: string[]
}

export interface AssemblyJobData {
  projectId: string
  blueprintId: string
  orgId: string
  userId: string
  stackId?: string
}

// =============================================================================
// Queue Instances (lazy initialized)
// =============================================================================

let documentQueue: Queue<DocumentJobData> | null = null
let executionQueue: Queue<ExecutionJobData> | null = null
let assemblyQueue: Queue<AssemblyJobData> | null = null

export async function getDocumentQueue(): Promise<Queue<DocumentJobData>> {
  if (!documentQueue) {
    const connection = await getQueueConnection()
    documentQueue = new Queue<DocumentJobData>('document-processing', { connection })
  }
  return documentQueue
}

export async function getExecutionQueue(): Promise<Queue<ExecutionJobData>> {
  if (!executionQueue) {
    const connection = await getQueueConnection()
    executionQueue = new Queue<ExecutionJobData>('work-order-execution', { connection })
  }
  return executionQueue
}

export async function getAssemblyQueue(): Promise<Queue<AssemblyJobData>> {
  if (!assemblyQueue) {
    const connection = await getQueueConnection()
    assemblyQueue = new Queue<AssemblyJobData>('assembly', { connection })
  }
  return assemblyQueue
}
