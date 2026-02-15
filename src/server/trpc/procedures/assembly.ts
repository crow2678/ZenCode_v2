import { z } from 'zod'
import { createTRPCRouter, orgProcedure } from '../trpc'
import { Assembly, WorkOrder, Blueprint, Project } from '@/lib/db/models'
import { TRPCError } from '@trpc/server'
import { auditLog } from '@/lib/audit'
import {
  assembleProject,
  previewAssembly,
  confirmAssembly,
  cancelDryRun,
} from '@/server/services/assembly'
import { generateTests } from '@/server/services/test-generation'

export const assemblyRouter = createTRPCRouter({
  get: orgProcedure
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

      const assembly = await Assembly.findOne({ projectId: input.projectId })
        .sort({ createdAt: -1 })
        .lean()

      if (!assembly) {
        return null
      }

      return {
        id: assembly._id.toString(),
        status: assembly.status,
        outputPath: assembly.outputPath,
        scaffold: assembly.scaffold,
        mergedFiles: assembly.mergedFiles,
        validationErrors: assembly.validationErrors,
        fixAttempts: assembly.fixAttempts,
        logs: assembly.logs,
        error: assembly.error,
        startedAt: assembly.startedAt,
        completedAt: assembly.completedAt,
        createdAt: assembly.createdAt,
      }
    }),

  run: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
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

      // Get approved blueprint
      const blueprint = await Blueprint.findOne({
        projectId: input.projectId,
        status: 'approved',
      }).lean()

      if (!blueprint) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No approved blueprint found' })
      }

      // Run assembly — via queue if enabled, otherwise direct
      try {
        if (process.env.USE_QUEUE === 'true') {
          const { getAssemblyQueue } = await import('@/lib/queue')
          const queue = await getAssemblyQueue()
          const job = await queue.add('assemble', {
            projectId: input.projectId,
            blueprintId: blueprint._id.toString(),
            orgId: ctx.orgId,
            userId: ctx.userId,
            stackId: input.stackId || blueprint.stackId,
          })

          auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'assembly.run', projectId: input.projectId, metadata: { queued: true, jobId: job.id } })

          return {
            id: job.id || '',
            success: false,
            filesCount: 0,
            errorsCount: 0,
            outputPath: '',
            queued: true,
          }
        }

        const assembly = await assembleProject({
          projectId: input.projectId,
          blueprintId: blueprint._id.toString(),
          orgId: ctx.orgId,
          userId: ctx.userId,
          stackId: input.stackId || blueprint.stackId,
        })

        if (!assembly) {
          throw new Error('Assembly creation failed')
        }

        // Mark work orders as completed
        await WorkOrder.updateMany(
          { projectId: input.projectId },
          { $set: { status: 'completed', executedAt: new Date() } }
        )

        const assemblyData = assembly.toObject()

        auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'assembly.run', projectId: input.projectId, resourceId: assemblyData._id.toString() })

        return {
          id: assemblyData._id.toString(),
          success: assemblyData.status === 'completed' && assemblyData.validationErrors.length === 0,
          filesCount: assemblyData.mergedFiles.length,
          errorsCount: assemblyData.validationErrors.length,
          outputPath: assemblyData.outputPath,
        }
      } catch (error) {
        auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'assembly.run', projectId: input.projectId, result: 'failure', error: (error as Error).message })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: (error as Error).message,
        })
      }
    }),

  getFiles: orgProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const fs = await import('fs/promises')
      const path = await import('path')

      // Get the latest assembly for this project
      const assembly = await Assembly.findOne({ projectId: input.projectId })
        .sort({ createdAt: -1 })
        .lean()

      // If we have an assembly with outputPath, read files from disk
      if (assembly?.outputPath && assembly.status === 'completed') {
        try {
          const files: Array<{ path: string; content: string }> = []

          // Recursively read all files from outputPath
          async function readDir(dir: string, basePath: string): Promise<void> {
            const entries = await fs.readdir(dir, { withFileTypes: true })
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name)
              if (entry.isDirectory()) {
                // Skip node_modules and .git
                if (entry.name !== 'node_modules' && entry.name !== '.git') {
                  await readDir(fullPath, basePath)
                }
              } else {
                // Read file content
                const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/')
                try {
                  const content = await fs.readFile(fullPath, 'utf-8')
                  files.push({ path: relativePath, content })
                } catch {
                  // Skip binary or unreadable files
                }
              }
            }
          }

          await readDir(assembly.outputPath, assembly.outputPath)
          return files.sort((a, b) => a.path.localeCompare(b.path))
        } catch (error) {
          console.error('[getFiles] Error reading from outputPath:', error)
          // Fall back to work orders
        }
      }

      // Fallback: read from work orders (missing scaffold files)
      const workOrders = await WorkOrder.find({ projectId: input.projectId })
        .sort({ orderNumber: 1 })
        .lean()

      const files: Array<{ path: string; content: string }> = []

      for (const wo of workOrders) {
        for (const file of wo.files) {
          if (file.action !== 'delete' && file.content) {
            files.push({
              path: file.path,
              content: file.content,
            })
          }
        }
      }

      return files
    }),

  // Dry Run: Preview assembly without saving to DB
  preview: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
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

      // Get approved blueprint
      const blueprint = await Blueprint.findOne({
        projectId: input.projectId,
        status: 'approved',
      }).lean()

      if (!blueprint) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No approved blueprint found' })
      }

      try {
        const result = await previewAssembly({
          projectId: input.projectId,
          blueprintId: blueprint._id.toString(),
          orgId: ctx.orgId,
          userId: ctx.userId,
          stackId: input.stackId || blueprint.stackId,
        })

        return {
          success: result.success,
          files: result.files,
          totalFiles: result.totalFiles,
          validationErrors: result.validationErrors,
          fixesApplied: result.fixesApplied,
          tsErrors: result.tsErrors,
          logs: result.logs,
          tempPath: result.tempPath,
          blueprintId: blueprint._id.toString(),
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: (error as Error).message,
        })
      }
    }),

  // Confirm: Move preview to final output and save to DB
  confirm: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
        blueprintId: z.string(),
        tempPath: z.string(),
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

      try {
        const assembly = await confirmAssembly({
          projectId: input.projectId,
          blueprintId: input.blueprintId,
          tempPath: input.tempPath,
          orgId: ctx.orgId,
          userId: ctx.userId,
        })

        // Mark work orders as completed
        await WorkOrder.updateMany(
          { projectId: input.projectId },
          { $set: { status: 'completed', executedAt: new Date() } }
        )

        const assemblyData = assembly.toObject()
        return {
          id: assemblyData._id.toString(),
          success: assemblyData.status === 'completed' && assemblyData.validationErrors.length === 0,
          filesCount: assemblyData.mergedFiles.length,
          errorsCount: assemblyData.validationErrors.length,
          outputPath: assemblyData.outputPath,
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: (error as Error).message,
        })
      }
    }),

  // Generate Vitest tests for assembled service files
  generateTests: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
        stackId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await Project.findOne({
        _id: input.projectId,
        orgId: ctx.orgId,
      }).lean()

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      try {
        const result = await generateTests({
          projectId: input.projectId,
          orgId: ctx.orgId,
          stackId: input.stackId,
        })

        return {
          totalGenerated: result.totalGenerated,
          tests: result.tests.map((t) => ({
            path: t.path,
            targetFile: t.targetFile,
          })),
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: (error as Error).message,
        })
      }
    }),

  // Cancel: Clean up preview temp files
  cancel: orgProcedure
    .input(
      z.object({
        tempPath: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        await cancelDryRun(input.tempPath)
        return { success: true }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: (error as Error).message,
        })
      }
    }),
})
