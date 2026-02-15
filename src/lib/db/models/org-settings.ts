/**
 * ZenCode V2 - Organization Settings Model
 */

import mongoose, { Schema, type Document } from 'mongoose'

export interface IOrgSettings extends Document {
  orgId: string
  anthropicApiKey?: string // encrypted ciphertext
  anthropicApiKeyIv?: string
  anthropicApiKeyTag?: string
  rateLimit?: {
    perMinute: number
    perHour: number
  }
  createdAt: Date
  updatedAt: Date
}

const OrgSettingsSchema = new Schema<IOrgSettings>(
  {
    orgId: { type: String, required: true, unique: true, index: true },
    anthropicApiKey: { type: String },
    anthropicApiKeyIv: { type: String },
    anthropicApiKeyTag: { type: String },
    rateLimit: {
      perMinute: { type: Number, default: 30 },
      perHour: { type: Number, default: 500 },
    },
  },
  { timestamps: true }
)

export const OrgSettings =
  mongoose.models.OrgSettings || mongoose.model<IOrgSettings>('OrgSettings', OrgSettingsSchema)
