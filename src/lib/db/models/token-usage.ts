/**
 * ZenCode V2 - Token Usage Model
 */

import mongoose, { Schema, type Document } from 'mongoose'

export interface ITokenUsage extends Document {
  orgId: string
  projectId?: string
  operation: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens?: number
  cacheReadTokens?: number
  cost?: number
  createdAt: Date
}

const TokenUsageSchema = new Schema<ITokenUsage>(
  {
    orgId: { type: String, required: true, index: true },
    projectId: { type: String, index: true },
    operation: { type: String, required: true },
    model: { type: String, required: true },
    inputTokens: { type: Number, required: true, default: 0 },
    outputTokens: { type: Number, required: true, default: 0 },
    cacheCreationTokens: { type: Number },
    cacheReadTokens: { type: Number },
    cost: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

TokenUsageSchema.index({ orgId: 1, createdAt: -1 })
TokenUsageSchema.index({ orgId: 1, projectId: 1, createdAt: -1 })

export const TokenUsage =
  mongoose.models.TokenUsage || mongoose.model<ITokenUsage>('TokenUsage', TokenUsageSchema)
