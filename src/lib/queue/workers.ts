/**
 * ZenCode V2 - Queue Workers
 *
 * BullMQ workers that process jobs from the queues.
 * Each worker calls the existing service functions.
 */

import { Worker } from 'bullmq'
import { getQueueConnection } from './connection'
import type { DocumentJobData, ExecutionJobData, AssemblyJobData } from './queues'

export async function createWorkers() {
  const connection = await getQueueConnection()

  // Document processing worker
  const documentWorker = new Worker<DocumentJobData>(
    'document-processing',
    async (job) => {
      console.log(`[Worker] Processing document: ${job.data.documentId}`)
      const { processDocument } = await import('@/server/services/document')
      await processDocument({ documentId: job.data.documentId })
      console.log(`[Worker] Document processed: ${job.data.documentId}`)
    },
    {
      connection,
      concurrency: 2,
    }
  )

  // Work order execution worker
  const executionWorker = new Worker<ExecutionJobData>(
    'work-order-execution',
    async (job) => {
      console.log(`[Worker] Executing work orders for project: ${job.data.projectId}`)
      const { executeAllWorkOrders } = await import('@/server/services/agent')
      const result = await executeAllWorkOrders({
        projectId: job.data.projectId,
        orgId: job.data.orgId,
        userId: job.data.userId,
        stackId: job.data.stackId,
        workOrderIds: job.data.workOrderIds,
      })
      console.log(`[Worker] Execution complete: ${result.completed} completed, ${result.failed} failed`)
      return result
    },
    {
      connection,
      concurrency: 1, // Serial execution to manage API rate limits
    }
  )

  // Assembly worker
  const assemblyWorker = new Worker<AssemblyJobData>(
    'assembly',
    async (job) => {
      console.log(`[Worker] Assembling project: ${job.data.projectId}`)
      const { assembleProject } = await import('@/server/services/assembly')
      const result = await assembleProject({
        projectId: job.data.projectId,
        blueprintId: job.data.blueprintId,
        orgId: job.data.orgId,
        userId: job.data.userId,
        stackId: job.data.stackId,
      })
      console.log(`[Worker] Assembly complete: ${job.data.projectId}`)
      return result
    },
    {
      connection,
      concurrency: 1,
    }
  )

  // Error handlers
  for (const worker of [documentWorker, executionWorker, assemblyWorker]) {
    worker.on('failed', (job, error) => {
      console.error(`[Worker] Job ${job?.id} failed:`, error.message)
    })
  }

  console.log('[Workers] All workers started')

  return { documentWorker, executionWorker, assemblyWorker }
}
