/**
 * ZenCode V2 - Audit Log Model
 */

import mongoose, { Schema, type Document } from 'mongoose'

export type AuditAction =
  | 'prd.generate'
  | 'prd.approve'
  | 'prd.enhance'
  | 'blueprint.generate'
  | 'blueprint.approve'
  | 'workorders.generate'
  | 'workorders.execute'
  | 'workorders.executeAll'
  | 'assembly.run'
  | 'assembly.preview'
  | 'assembly.confirm'
  | 'document.upload'
  | 'document.delete'
  | 'settings.update'
  | 'project.create'
  | 'project.update'
  | 'project.archive'

export interface IAuditLog extends Document {
  orgId: string
  userId: string
  action: AuditAction
  projectId?: string
  resourceId?: string
  metadata?: Record<string, unknown>
  result: 'success' | 'failure'
  error?: string
  createdAt: Date
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    orgId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    projectId: { type: String, index: true },
    resourceId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    result: { type: String, enum: ['success', 'failure'], required: true },
    error: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

AuditLogSchema.index({ createdAt: -1 })
AuditLogSchema.index({ orgId: 1, action: 1, createdAt: -1 })

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema)
