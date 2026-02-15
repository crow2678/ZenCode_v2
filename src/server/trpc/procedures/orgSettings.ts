/**
 * ZenCode V2 - Org Settings tRPC Procedures
 */

import { z } from 'zod'
import { createTRPCRouter, orgProcedure } from '../trpc'
import { OrgSettings } from '@/lib/db/models'
import { encrypt, decrypt } from '@/lib/encryption'
import { auditLog } from '@/lib/audit'
import Anthropic from '@anthropic-ai/sdk'

export const orgSettingsRouter = createTRPCRouter({
  get: orgProcedure.query(async ({ ctx }) => {
    const settings = await OrgSettings.findOne({ orgId: ctx.orgId }).lean()

    return {
      hasApiKey: !!(settings?.anthropicApiKey),
      rateLimit: settings?.rateLimit || { perMinute: 30, perHour: 500 },
    }
  }),

  update: orgProcedure
    .input(
      z.object({
        anthropicApiKey: z.string().optional(),
        clearApiKey: z.boolean().optional(),
        rateLimit: z.object({
          perMinute: z.number().min(1).max(1000),
          perHour: z.number().min(1).max(10000),
        }).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const update: Record<string, unknown> = {}

      if (input.clearApiKey) {
        update.anthropicApiKey = null
        update.anthropicApiKeyIv = null
        update.anthropicApiKeyTag = null
      } else if (input.anthropicApiKey) {
        const encrypted = encrypt(input.anthropicApiKey)
        update.anthropicApiKey = encrypted.ciphertext
        update.anthropicApiKeyIv = encrypted.iv
        update.anthropicApiKeyTag = encrypted.tag
      }

      if (input.rateLimit) {
        update.rateLimit = input.rateLimit
      }

      await OrgSettings.findOneAndUpdate(
        { orgId: ctx.orgId },
        { $set: update },
        { upsert: true, new: true }
      )

      auditLog({ orgId: ctx.orgId, userId: ctx.userId, action: 'settings.update' })

      return { success: true }
    }),

  testKey: orgProcedure
    .input(z.object({ apiKey: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        const client = new Anthropic({ apiKey: input.apiKey })
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say "ok"' }],
        })

        const textBlock = response.content.find((b) => b.type === 'text')
        return {
          valid: true,
          message: textBlock?.type === 'text' ? textBlock.text : 'Connected',
        }
      } catch (error) {
        return {
          valid: false,
          message: error instanceof Error ? error.message : 'Invalid API key',
        }
      }
    }),
})
