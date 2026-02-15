/**
 * ZenCode V2 - Document tRPC Procedures
 */

import { z } from 'zod'
import { createTRPCRouter, orgProcedure } from '../trpc'
import { ProjectDocument, Project } from '@/lib/db/models'
import { TRPCError } from '@trpc/server'
import { auditLog } from '@/lib/audit'
import {
  deleteDocument,
  listDocuments,
  getDocumentContext,
} from '@/server/services/document'

export const documentRouter = createTRPCRouter({
  // List all documents for a project
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

      return listDocuments(input.projectId)
    }),

  // Get a single document with details (excluding embeddings)
  get: orgProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const doc = await ProjectDocument.findById(input.documentId)
        .select('-chunks.embedding')
        .lean()

      if (!doc) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      }

      // Verify access
      if (doc.orgId !== ctx.orgId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      }

      return {
        id: doc._id.toString(),
        projectId: doc.projectId.toString(),
        fileName: doc.fileName,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        status: doc.status,
        extractedText: doc.extractedText,
        metadata: doc.metadata,
        chunks: doc.chunks?.map((c) => ({
          index: c.index,
          content: c.content,
          heading: c.heading,
          relevance: c.relevance,
        })),
        error: doc.error,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }
    }),

  // Delete a document
  delete: orgProcedure
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteDocument({
        documentId: input.documentId,
        orgId: ctx.orgId,
      })

      auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'document.delete', resourceId: input.documentId })

      return { success: true }
    }),

  // Get semantic context for a query
  getContext: orgProcedure
    .input(
      z.object({
        projectId: z.string(),
        stage: z.enum(['prd', 'blueprint', 'workOrders', 'agent']),
        queryText: z.string().min(1),
        topK: z.number().min(1).max(20).optional().default(8),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify project access
      const project = await Project.findOne({
        _id: input.projectId,
        orgId: ctx.orgId,
      }).lean()

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      const context = await getDocumentContext({
        projectId: input.projectId,
        stage: input.stage,
        queryText: input.queryText,
        topK: input.topK,
      })

      return { context }
    }),

  // Get document processing status (for polling)
  status: orgProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const doc = await ProjectDocument.findById(input.documentId)
        .select('status error orgId')
        .lean()

      if (!doc) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      }

      if (doc.orgId !== ctx.orgId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      }

      return {
        status: doc.status,
        error: doc.error,
      }
    }),
})
