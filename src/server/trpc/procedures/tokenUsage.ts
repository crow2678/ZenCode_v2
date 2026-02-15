/**
 * ZenCode V2 - Token Usage tRPC Procedures
 */

import { z } from 'zod'
import { createTRPCRouter, orgProcedure } from '../trpc'
import { TokenUsage } from '@/lib/db/models'

export const tokenUsageRouter = createTRPCRouter({
  summary: orgProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).optional().default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const since = new Date()
      since.setDate(since.getDate() - input.days)

      const usage = await TokenUsage.aggregate([
        { $match: { orgId: ctx.orgId, createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            inputTokens: { $sum: '$inputTokens' },
            outputTokens: { $sum: '$outputTokens' },
            cacheCreationTokens: { $sum: { $ifNull: ['$cacheCreationTokens', 0] } },
            cacheReadTokens: { $sum: { $ifNull: ['$cacheReadTokens', 0] } },
            requests: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])

      const totals = await TokenUsage.aggregate([
        { $match: { orgId: ctx.orgId, createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            inputTokens: { $sum: '$inputTokens' },
            outputTokens: { $sum: '$outputTokens' },
            cacheCreationTokens: { $sum: { $ifNull: ['$cacheCreationTokens', 0] } },
            cacheReadTokens: { $sum: { $ifNull: ['$cacheReadTokens', 0] } },
            requests: { $sum: 1 },
          },
        },
      ])

      return {
        daily: usage.map((u) => ({
          date: u._id,
          inputTokens: u.inputTokens,
          outputTokens: u.outputTokens,
          cacheCreationTokens: u.cacheCreationTokens,
          cacheReadTokens: u.cacheReadTokens,
          requests: u.requests,
        })),
        totals: totals[0] || {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          requests: 0,
        },
      }
    }),

  byProject: orgProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).optional().default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const since = new Date()
      since.setDate(since.getDate() - input.days)

      const usage = await TokenUsage.aggregate([
        { $match: { orgId: ctx.orgId, createdAt: { $gte: since }, projectId: { $ne: null } } },
        {
          $group: {
            _id: '$projectId',
            inputTokens: { $sum: '$inputTokens' },
            outputTokens: { $sum: '$outputTokens' },
            requests: { $sum: 1 },
          },
        },
        { $sort: { inputTokens: -1 } },
        { $limit: 20 },
      ])

      return usage.map((u) => ({
        projectId: u._id,
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        requests: u.requests,
      }))
    }),
})
