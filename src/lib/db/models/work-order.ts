/**
 * ZenCode V2 - WorkOrder Model
 *
 * Matches V1's WorkOrder model for data compatibility
 */

import mongoose, { Document, Schema, Types } from 'mongoose'

export type WorkOrderPhase =
  | 'scaffold'
  | 'models'
  | 'services'
  | 'procedures'
  | 'components'
  | 'pages'
  | 'integration'

export type WorkOrderStatus =
  | 'pending'
  | 'queued'
  | 'executing'
  | 'completed'
  | 'failed'

export interface IWorkOrderFile {
  path: string
  action: 'create' | 'modify' | 'delete'
  content?: string
  description?: string
}

export interface IExecutionLog {
  timestamp: Date
  message: string
  type: 'info' | 'success' | 'error' | 'progress'
  filePath?: string
}

export interface IWorkOrder extends Document {
  projectId: Types.ObjectId
  blueprintId: Types.ObjectId
  orderNumber: number
  title: string
  description: string
  phase: WorkOrderPhase
  status: WorkOrderStatus
  files: IWorkOrderFile[]
  dependencies: Types.ObjectId[]
  executionLogs: IExecutionLog[]
  executedAt?: Date
  error?: string
  createdAt: Date
  updatedAt: Date
}

const WorkOrderFileSchema = new Schema<IWorkOrderFile>(
  {
    path: { type: String, required: true },
    action: { type: String, enum: ['create', 'modify', 'delete'], required: true },
    content: { type: String },
    description: { type: String },
  },
  { _id: false }
)

const WorkOrderSchema = new Schema<IWorkOrder>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    blueprintId: { type: Schema.Types.ObjectId, ref: 'Blueprint', required: true },
    orderNumber: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    phase: {
      type: String,
      enum: ['scaffold', 'models', 'services', 'procedures', 'components', 'pages', 'integration'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'queued', 'executing', 'completed', 'failed'],
      default: 'pending',
    },
    files: [WorkOrderFileSchema],
    dependencies: [{ type: Schema.Types.ObjectId, ref: 'WorkOrder' }],
    executionLogs: [
      {
        timestamp: { type: Date, default: Date.now },
        message: { type: String, required: true },
        type: { type: String, enum: ['info', 'success', 'error', 'progress'], default: 'info' },
        filePath: { type: String },
        _id: false,
      },
    ],
    executedAt: { type: Date },
    error: { type: String },
  },
  {
    timestamps: true,
  }
)

WorkOrderSchema.index({ projectId: 1, blueprintId: 1 })
WorkOrderSchema.index({ projectId: 1, phase: 1 })

export const WorkOrder =
  mongoose.models.WorkOrder || mongoose.model<IWorkOrder>('WorkOrder', WorkOrderSchema)
