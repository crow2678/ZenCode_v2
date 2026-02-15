import { z } from 'zod'
import { createTRPCRouter, orgProcedure } from '../trpc'
import { Requirement, Project } from '@/lib/db/models'
import { TRPCError } from '@trpc/server'
import { auditLog } from '@/lib/audit'
import {
  generateRequirementPRD,
  enhanceRequirementPRD,
  extractFeaturesFromPRD,
} from '@/server/services/requirement'

export const requirementRouter = createTRPCRouter({
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

      const requirement = await Requirement.findOne({
        projectId: input.projectId,
        status: { $ne: 'archived' },
      })
        .sort({ version: -1 })
        .lean()

      if (!requirement) {
        return null
      }

      return {
        id: requirement._id.toString(),
        version: requirement.version,
        status: requirement.status,
        content: requirement.content,
        rawText: requirement.rawText,
        features: requirement.features,
        createdAt: requirement.createdAt,
        updatedAt: requirement.updatedAt,
      }
    }),

  create: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
        rawText: z.string(),
        content: z.object({
          overview: z.string().optional(),
          goals: z.array(z.string()).optional(),
          userPersonas: z.array(z.string()).optional(),
          functionalRequirements: z.array(z.string()).optional(),
          nonFunctionalRequirements: z.array(z.string()).optional(),
          dataModels: z.array(z.string()).optional(),
          apiEndpoints: z.array(z.string()).optional(),
          uiRequirements: z.array(z.string()).optional(),
          securityConsiderations: z.array(z.string()).optional(),
          successMetrics: z.array(z.string()).optional(),
        }).optional(),
        features: z.array(z.object({
          name: z.string(),
          description: z.string(),
          priority: z.enum(['high', 'medium', 'low']).optional(),
          userStories: z.array(z.string()).optional(),
        })).optional(),
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

      const requirement = await Requirement.create({
        projectId: input.projectId,
        version,
        status: 'draft',
        content: input.content || {},
        rawText: input.rawText,
        features: input.features || [],
        createdBy: ctx.userId,
      })

      return {
        id: requirement._id.toString(),
        version: requirement.version,
      }
    }),

  approve: orgProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const requirement = await Requirement.findOneAndUpdate(
        {
          projectId: input.projectId,
          status: 'draft',
        },
        { $set: { status: 'approved' } },
        { new: true }
      ).lean()

      if (!requirement) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No draft PRD found' })
      }

      auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'prd.approve', projectId: input.projectId, resourceId: requirement._id.toString() })

      return { id: requirement._id.toString() }
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

      const versions = await Requirement.find({ projectId: input.projectId })
        .select('version status createdAt rawText')
        .sort({ version: -1 })
        .lean()

      return versions.map((v) => ({
        id: v._id.toString(),
        version: v.version,
        status: v.status,
        createdAt: v.createdAt,
        rawTextPreview: v.rawText?.slice(0, 100),
      }))
    }),

  // Get a specific version by ID
  getVersion: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const requirement = await Requirement.findById(input.id).lean()
      if (!requirement) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' })
      }

      const project = await Project.findOne({
        _id: requirement.projectId,
        orgId: ctx.orgId,
      }).lean()

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      return {
        id: requirement._id.toString(),
        version: requirement.version,
        status: requirement.status,
        content: requirement.content,
        rawText: requirement.rawText,
        features: requirement.features,
        createdAt: requirement.createdAt,
      }
    }),

  // Rollback to a specific version
  rollback: orgProcedure
    .input(z.object({ projectId: z.string(), versionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const oldVersion = await Requirement.findById(input.versionId).lean()
      if (!oldVersion) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' })
      }

      // Archive current active version
      await Requirement.updateMany(
        { projectId: input.projectId, status: { $ne: 'archived' } },
        { $set: { status: 'archived' } }
      )

      // Create new version from old content
      const latest = await Requirement.findOne({ projectId: input.projectId })
        .sort({ version: -1 })
        .lean()
      const newVersion = (latest?.version || 0) + 1

      const restored = await Requirement.create({
        projectId: input.projectId,
        version: newVersion,
        status: 'draft',
        content: oldVersion.content,
        rawText: oldVersion.rawText,
        features: oldVersion.features,
        createdBy: ctx.userId,
      })

      auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'prd.generate', projectId: input.projectId, resourceId: restored._id.toString(), metadata: { rolledBackFrom: input.versionId } })

      return { id: restored._id.toString(), version: newVersion }
    }),

  // AI-powered PRD generation
  generate: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
        rawText: z.string().min(10),
        documentIds: z.array(z.string()).optional(),
        options: z.object({
          authType: z.enum(['none', 'clerk', 'auth0', 'firebase', 'custom']).optional(),
          deploymentTarget: z.string().optional(),
        }).optional(),
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

      const result = await generateRequirementPRD({
        projectId: input.projectId,
        rawText: input.rawText,
        orgId: ctx.orgId,
        userId: ctx.userId,
        documentIds: input.documentIds,
        options: input.options,
      })

      auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'prd.generate', projectId: input.projectId, resourceId: result.requirementId })

      return {
        id: result.requirementId,
        content: result.content,
        features: result.features,
      }
    }),

  // AI-powered PRD enhancement
  enhance: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
        requirementId: z.string(),
        feedback: z.string().min(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await enhanceRequirementPRD({
        projectId: input.projectId,
        requirementId: input.requirementId,
        feedback: input.feedback,
      })

      auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'prd.enhance', projectId: input.projectId, resourceId: result.requirementId })

      return {
        id: result.requirementId,
        content: result.content,
        features: result.features,
      }
    }),

  // AI-powered feature extraction
  extractFeatures: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
        requirementId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const features = await extractFeaturesFromPRD({
        projectId: input.projectId,
        requirementId: input.requirementId,
      })

      return { features }
    }),
})
