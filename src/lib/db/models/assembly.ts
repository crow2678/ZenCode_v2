/**
 * ZenCode V2 - Assembly Model
 *
 * Matches V1's Assembly model for data compatibility
 */

import mongoose, { Document, Schema, Types } from 'mongoose'

export type AssemblyStatus =
  | 'pending'
  | 'scaffolding'
  | 'merging'
  | 'generating'
  | 'wiring'
  | 'validating'
  | 'fixing'
  | 'typescript-validation'
  | 'completed'
  | 'failed'

export interface IAssembly extends Document {
  projectId: Types.ObjectId
  blueprintId: Types.ObjectId
  status: AssemblyStatus
  outputPath: string
  workOrderIds: Types.ObjectId[]
  scaffold: {
    techStack: string[]
    files: string[]
  }
  mergedFiles: string[]
  validationErrors: Array<{
    file: string
    line: number
    message: string
  }>
  fixAttempts: number
  logs: Array<{ timestamp: Date; message: string }>
  error?: string
  startedAt: Date
  completedAt?: Date
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const AssemblySchema = new Schema<IAssembly>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    blueprintId: { type: Schema.Types.ObjectId, ref: 'Blueprint', required: true },
    status: {
      type: String,
      enum: ['pending', 'scaffolding', 'merging', 'generating', 'wiring', 'validating', 'fixing', 'typescript-validation', 'completed', 'failed'],
      default: 'pending',
    },
    outputPath: { type: String, default: '' },
    workOrderIds: [{ type: Schema.Types.ObjectId, ref: 'WorkOrder' }],
    scaffold: {
      techStack: [{ type: String }],
      files: [{ type: String }],
    },
    mergedFiles: [{ type: String }],
    validationErrors: [
      {
        file: { type: String },
        line: { type: Number },
        message: { type: String },
        _id: false,
      },
    ],
    fixAttempts: { type: Number, default: 0 },
    logs: [
      {
        timestamp: { type: Date, default: Date.now },
        message: { type: String },
        _id: false,
      },
    ],
    error: { type: String },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    createdBy: { type: String, required: true },
  },
  {
    timestamps: true,
  }
)

AssemblySchema.index({ projectId: 1, blueprintId: 1 })

export const Assembly =
  mongoose.models.Assembly || mongoose.model<IAssembly>('Assembly', AssemblySchema)
