import { z } from 'zod'
import { createTRPCRouter, orgProcedure } from '../trpc'
import { WorkOrder, Blueprint, Project } from '@/lib/db/models'
import { TRPCError } from '@trpc/server'
import { auditLog } from '@/lib/audit'
import { generateWorkOrdersFromBlueprint } from '@/server/services/work-orders'
import { executeWorkOrderWithAgent, executeAllWorkOrders } from '@/server/services/agent'
import { quickValidate } from '@/server/services/validation'

export const workOrderRouter = createTRPCRouter({
  list: orgProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify project access
      const project = await Project.findOne({
        _id: input.projectId,
        orgId: ctx.orgId,
      }).lean()

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      const workOrders = await WorkOrder.find({ projectId: input.projectId })
        .sort({ orderNumber: 1 })
        .lean()

      return workOrders.map((wo) => ({
        id: wo._id.toString(),
        orderNumber: wo.orderNumber,
        title: wo.title,
        description: wo.description,
        phase: wo.phase,
        status: wo.status,
        filesCount: wo.files?.length || 0,
        executionLogs: wo.executionLogs || [],
        error: wo.error,
        createdAt: wo.createdAt,
      }))
    }),

  get: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const workOrder = await WorkOrder.findById(input.id).lean()

      if (!workOrder) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Work order not found' })
      }

      // Verify project access
      const project = await Project.findOne({
        _id: workOrder.projectId,
        orgId: ctx.orgId,
      }).lean()

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      return {
        id: workOrder._id.toString(),
        projectId: workOrder.projectId.toString(),
        blueprintId: workOrder.blueprintId.toString(),
        orderNumber: workOrder.orderNumber,
        title: workOrder.title,
        description: workOrder.description,
        phase: workOrder.phase,
        status: workOrder.status,
        files: workOrder.files,
        executionLogs: workOrder.executionLogs || [],
        error: workOrder.error,
        createdAt: workOrder.createdAt,
        updatedAt: workOrder.updatedAt,
      }
    }),

  createBatch: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
        workOrders: z.array(z.object({
          title: z.string(),
          description: z.string(),
          phase: z.enum(['scaffold', 'models', 'services', 'procedures', 'components', 'pages', 'integration']),
          files: z.array(z.object({
            path: z.string(),
            action: z.enum(['create', 'modify', 'delete']),
            content: z.string().optional(),
            description: z.string().optional(),
          })),
        })),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify project access
      const project = await Project.findOne({
        _id: input.projectId,
        orgId: ctx.orgId,
      }).lean()

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      // Get approved blueprint
      const blueprint = await Blueprint.findOne({
        projectId: input.projectId,
        status: 'approved',
      }).lean()

      if (!blueprint) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No approved blueprint found' })
      }

      // Delete existing work orders
      await WorkOrder.deleteMany({ projectId: input.projectId })

      // Create new work orders
      const workOrders = await WorkOrder.insertMany(
        input.workOrders.map((wo, index) => ({
          projectId: input.projectId,
          blueprintId: blueprint._id,
          orderNumber: index + 1,
          title: wo.title,
          description: wo.description,
          phase: wo.phase,
          status: 'pending',
          files: wo.files,
        }))
      )

      return {
        count: workOrders.length,
        ids: workOrders.map((wo) => wo._id.toString()),
      }
    }),

  updateStatus: orgProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['pending', 'queued', 'executing', 'completed', 'failed']),
        error: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workOrder = await WorkOrder.findById(input.id).lean()

      if (!workOrder) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Work order not found' })
      }

      // Verify project access
      const project = await Project.findOne({
        _id: workOrder.projectId,
        orgId: ctx.orgId,
      }).lean()

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      await WorkOrder.updateOne(
        { _id: input.id },
        {
          $set: {
            status: input.status,
            error: input.error,
            executedAt: input.status === 'completed' ? new Date() : undefined,
          },
        }
      )

      return { success: true }
    }),

  // AI-powered work order generation
  generate: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
        blueprintId: z.string(),
        stackId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify project access
      const project = await Project.findOne({
        _id: input.projectId,
        orgId: ctx.orgId,
      }).lean()

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      // Verify blueprint exists and is approved
      const blueprint = await Blueprint.findOne({
        _id: input.blueprintId,
        projectId: input.projectId,
        status: 'approved',
      }).lean()

      if (!blueprint) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Approved blueprint not found' })
      }

      const result = await generateWorkOrdersFromBlueprint({
        projectId: input.projectId,
        blueprintId: input.blueprintId,
        orgId: ctx.orgId,
        userId: ctx.userId,
        stackId: input.stackId,
      })

      auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'workorders.generate', projectId: input.projectId, metadata: { count: result.workOrders.length } })

      return {
        workOrderIds: result.workOrderIds,
        count: result.workOrders.length,
        totalFiles: result.totalFiles,
      }
    }),

  // Execute a single work order with AI
  execute: orgProcedure
    .input(
      z.object({
        workOrderId: z.string(),
        stackId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const workOrder = await WorkOrder.findById(input.workOrderId).lean()
      if (!workOrder) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Work order not found' })
      }

      // Verify project access
      const project = await Project.findOne({
        _id: workOrder.projectId,
        orgId: ctx.orgId,
      }).lean()

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      const result = await executeWorkOrderWithAgent({
        workOrderId: input.workOrderId,
        orgId: ctx.orgId,
        userId: ctx.userId,
        stackId: input.stackId,
      })

      auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'workorders.execute', resourceId: input.workOrderId, metadata: { status: result.status } })

      return {
        workOrderId: result.workOrderId,
        status: result.status,
        filesCount: result.files.length,
        error: result.error,
      }
    }),

  // Pre-assembly validation of work order files
  validate: orgProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await Project.findOne({
        _id: input.projectId,
        orgId: ctx.orgId,
      }).lean()

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      // Collect all files from completed work orders
      const workOrders = await WorkOrder.find({
        projectId: input.projectId,
        status: 'completed',
      }).sort({ orderNumber: 1 }).lean()

      if (workOrders.length === 0) {
        return { valid: true, errors: [], fileCount: 0, importCount: 0, workOrderCount: 0 }
      }

      const files = new Map<string, string>()
      for (const wo of workOrders) {
        for (const file of wo.files || []) {
          if (file.action === 'delete') {
            files.delete(file.path)
          } else if (file.content) {
            files.set(file.path, file.content)
          }
        }
      }

      const result = quickValidate(files)

      return {
        ...result,
        workOrderCount: workOrders.length,
      }
    }),

  // Execute selected or all pending work orders
  executeAll: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
        workOrderIds: z.array(z.string()).optional(), // Optional: execute only these
        stackId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify project access
      const project = await Project.findOne({
        _id: input.projectId,
        orgId: ctx.orgId,
      }).lean()

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      if (process.env.USE_QUEUE === 'true') {
        const { getExecutionQueue } = await import('@/lib/queue')
        const queue = await getExecutionQueue()
        const job = await queue.add('executeAll', {
          projectId: input.projectId,
          orgId: ctx.orgId,
          userId: ctx.userId,
          stackId: input.stackId,
          workOrderIds: input.workOrderIds,
        })

        auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'workorders.executeAll', projectId: input.projectId, metadata: { queued: true, jobId: job.id } })

        return {
          completed: 0,
          failed: 0,
          total: 0,
          queued: true,
          jobId: job.id,
        }
      }

      const result = await executeAllWorkOrders({
        projectId: input.projectId,
        orgId: ctx.orgId,
        userId: ctx.userId,
        stackId: input.stackId,
        workOrderIds: input.workOrderIds,
      })

      auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'workorders.executeAll', projectId: input.projectId, metadata: { completed: result.completed, failed: result.failed } })

      return {
        completed: result.completed,
        failed: result.failed,
        total: result.results.length,
      }
    }),
})
