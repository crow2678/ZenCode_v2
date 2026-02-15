import { z } from 'zod'
import { createTRPCRouter, orgProcedure } from '../trpc'
import { Project } from '@/lib/db/models'
import { TRPCError } from '@trpc/server'
import { auditLog } from '@/lib/audit'

export const projectRouter = createTRPCRouter({
  list: orgProcedure.query(async ({ ctx }) => {
    // Only show V2 projects
    const projects = await Project.find({ orgId: ctx.orgId, status: 'active', version: 'v2' })
      .sort({ updatedAt: -1 })
      .lean()

    return projects.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      description: p.description,
      status: p.status,
      techStack: p.metadata?.techStack || [],
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
  }),

  get: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await Project.findOne({
        _id: input.id,
        orgId: ctx.orgId,
        version: 'v2',
      }).lean()

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      return {
        id: project._id.toString(),
        name: project.name,
        description: project.description,
        status: project.status,
        techStack: project.metadata?.techStack || [],
        deploymentTarget: project.metadata?.deploymentTarget,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      }
    }),

  create: orgProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(1000).optional(),
        techStack: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await Project.create({
        orgId: ctx.orgId,
        name: input.name,
        description: input.description || '',
        createdBy: ctx.userId,
        version: 'v2',  // Mark as V2 project
        metadata: {
          techStack: input.techStack || ['Next.js', 'MongoDB', 'tRPC'],
        },
      })

      auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'project.create', projectId: project._id.toString() })

      return {
        id: project._id.toString(),
        name: project.name,
      }
    }),

  update: orgProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(1000).optional(),
        techStack: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const update: Record<string, unknown> = {}

      if (input.name) update.name = input.name
      if (input.description !== undefined) update.description = input.description
      if (input.techStack) update['metadata.techStack'] = input.techStack

      const project = await Project.findOneAndUpdate(
        { _id: input.id, orgId: ctx.orgId, version: 'v2' },
        { $set: update },
        { new: true }
      ).lean()

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'project.update', projectId: project._id.toString() })

      return { id: project._id.toString() }
    }),

  delete: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await Project.findOneAndUpdate(
        { _id: input.id, orgId: ctx.orgId, version: 'v2' },
        { $set: { status: 'archived' } }
      )

      if (!result) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'project.archive', projectId: input.id })

      return { success: true }
    }),

  stats: orgProcedure.query(async ({ ctx }) => {
    const [total, active] = await Promise.all([
      Project.countDocuments({ orgId: ctx.orgId, version: 'v2' }),
      Project.countDocuments({ orgId: ctx.orgId, version: 'v2', status: 'active' }),
    ])

    return { total, active }
  }),
})
