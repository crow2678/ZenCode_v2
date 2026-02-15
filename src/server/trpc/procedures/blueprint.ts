import { z } from 'zod'
import { createTRPCRouter, orgProcedure } from '../trpc'
import { Blueprint, Requirement, Project } from '@/lib/db/models'
import { TRPCError } from '@trpc/server'
import { auditLog } from '@/lib/audit'
import { generateBlueprintFromRequirement } from '@/server/services/blueprint'

export const blueprintRouter = createTRPCRouter({
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

      const blueprint = await Blueprint.findOne({
        projectId: input.projectId,
        status: { $ne: 'archived' },
      })
        .sort({ version: -1 })
        .lean()

      if (!blueprint) {
        return null
      }

      return {
        id: blueprint._id.toString(),
        requirementId: blueprint.requirementId.toString(),
        version: blueprint.version,
        status: blueprint.status,
        stackId: blueprint.stackId,
        name: blueprint.name,  // V1-style
        description: blueprint.description,  // V1-style
        estimatedWorkOrders: blueprint.estimatedWorkOrders,  // V1-style
        architecture: blueprint.architecture,
        // Legacy fields (for backward compatibility)
        models: blueprint.models,
        services: blueprint.services,
        routes: blueprint.routes,
        components: blueprint.components,
        fileStructure: blueprint.fileStructure,
        dependencies: blueprint.dependencies,
        createdAt: blueprint.createdAt,
        updatedAt: blueprint.updatedAt,
      }
    }),

  create: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
        stackId: z.string().optional(),
        architecture: z.object({
          overview: z.string().optional(),
          components: z.array(z.object({
            name: z.string(),
            type: z.enum(['model', 'service', 'router', 'component', 'page', 'util']),
            description: z.string(),
            dependencies: z.array(z.string()).optional(),
          })).optional(),
          dataFlow: z.string().optional(),
          integrations: z.array(z.string()).optional(),
        }).optional(),
        models: z.array(z.object({
          name: z.string(),
          fields: z.array(z.object({
            name: z.string(),
            type: z.string(),
            required: z.boolean().optional(),
            unique: z.boolean().optional(),
          })),
          relationships: z.array(z.string()).optional(),
        })).optional(),
        services: z.array(z.object({
          name: z.string(),
          methods: z.array(z.object({
            name: z.string(),
            description: z.string(),
            inputs: z.array(z.string()).optional(),
            outputs: z.string().optional(),
          })),
        })).optional(),
        routes: z.array(z.object({
          name: z.string(),
          endpoints: z.array(z.object({
            method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
            path: z.string(),
            description: z.string(),
          })),
        })).optional(),
        components: z.array(z.object({
          name: z.string(),
          type: z.enum(['page', 'layout', 'component']),
          description: z.string(),
          props: z.array(z.string()).optional(),
        })).optional(),
        fileStructure: z.array(z.string()).optional(),
        dependencies: z.array(z.string()).optional(),
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

      // Get approved requirement
      const requirement = await Requirement.findOne({
        projectId: input.projectId,
        status: 'approved',
      }).lean()

      if (!requirement) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No approved PRD found' })
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

      const blueprint = await Blueprint.create({
        projectId: input.projectId,
        requirementId: requirement._id,
        version,
        status: 'draft',
        stackId: input.stackId || 'nextjs-mongodb',
        architecture: input.architecture || {},
        models: input.models || [],
        services: input.services || [],
        routes: input.routes || [],
        components: input.components || [],
        fileStructure: input.fileStructure || [],
        dependencies: input.dependencies || [],
        createdBy: ctx.userId,
      })

      return {
        id: blueprint._id.toString(),
        version: blueprint.version,
      }
    }),

  // List all versions for a project
  listVersions: orgProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await Project.findOne({
        _id: input.projectId,
        orgId: ctx.orgId,
      }).lean()

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      const versions = await Blueprint.find({ projectId: input.projectId })
        .select('version status stackId createdAt name description')
        .sort({ version: -1 })
        .lean()

      return versions.map((v) => ({
        id: v._id.toString(),
        version: v.version,
        status: v.status,
        stackId: v.stackId,
        name: v.name,
        description: v.description?.slice(0, 100),
        createdAt: v.createdAt,
      }))
    }),

  // Get a specific version by ID
  getVersion: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const blueprint = await Blueprint.findById(input.id).lean()
      if (!blueprint) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' })
      }

      const project = await Project.findOne({
        _id: blueprint.projectId,
        orgId: ctx.orgId,
      }).lean()

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      return {
        id: blueprint._id.toString(),
        version: blueprint.version,
        status: blueprint.status,
        stackId: blueprint.stackId,
        name: blueprint.name,
        description: blueprint.description,
        architecture: blueprint.architecture,
        models: blueprint.models,
        services: blueprint.services,
        routes: blueprint.routes,
        components: blueprint.components,
        createdAt: blueprint.createdAt,
      }
    }),

  // Rollback to a specific version
  rollback: orgProcedure
    .input(z.object({ projectId: z.string(), versionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const oldVersion = await Blueprint.findById(input.versionId).lean()
      if (!oldVersion) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' })
      }

      await Blueprint.updateMany(
        { projectId: input.projectId, status: { $ne: 'archived' } },
        { $set: { status: 'archived' } }
      )

      const latest = await Blueprint.findOne({ projectId: input.projectId })
        .sort({ version: -1 })
        .lean()
      const newVersion = (latest?.version || 0) + 1

      const restored = await Blueprint.create({
        projectId: input.projectId,
        requirementId: oldVersion.requirementId,
        version: newVersion,
        status: 'draft',
        stackId: oldVersion.stackId,
        name: oldVersion.name,
        description: oldVersion.description,
        architecture: oldVersion.architecture,
        models: oldVersion.models,
        services: oldVersion.services,
        routes: oldVersion.routes,
        components: oldVersion.components,
        fileStructure: oldVersion.fileStructure,
        dependencies: oldVersion.dependencies,
        createdBy: ctx.userId,
      })

      auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'blueprint.generate', projectId: input.projectId, resourceId: restored._id.toString(), metadata: { rolledBackFrom: input.versionId } })

      return { id: restored._id.toString(), version: newVersion }
    }),

  approve: orgProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const blueprint = await Blueprint.findOneAndUpdate(
        {
          projectId: input.projectId,
          status: 'draft',
        },
        { $set: { status: 'approved' } },
        { new: true }
      ).lean()

      if (!blueprint) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No draft blueprint found' })
      }

      auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'blueprint.approve', projectId: input.projectId, resourceId: blueprint._id.toString() })

      return { id: blueprint._id.toString() }
    }),

  // AI-powered blueprint generation
  generate: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
        requirementId: z.string(),
        stackId: z.string().optional(),
        mode: z.enum(['lean', 'detailed']).optional(),  // 'lean' = fast, 'detailed' = chunked
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

      // Verify requirement exists and is approved
      const requirement = await Requirement.findOne({
        _id: input.requirementId,
        projectId: input.projectId,
        status: 'approved',
      }).lean()

      if (!requirement) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Approved requirement not found' })
      }

      const result = await generateBlueprintFromRequirement({
        projectId: input.projectId,
        requirementId: input.requirementId,
        orgId: ctx.orgId,
        userId: ctx.userId,
        stackId: input.stackId,
        mode: input.mode,
      })

      auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'blueprint.generate', projectId: input.projectId, resourceId: result.blueprintId })

      return {
        id: result.blueprintId,
        name: result.name,
        description: result.description,
        architecture: result.architecture,
        estimatedWorkOrders: result.estimatedWorkOrders,
        // Detailed specs (only present in 'detailed' mode)
        models: result.models,
        services: result.services,
        routes: result.routes,
        components: result.components,
        fileStructure: result.fileStructure,
      }
    }),
})
