/**
 * ZenCode V2 - Requirement (PRD) Model
 */

import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IRequirement extends Document {
  projectId: Types.ObjectId
  version: number
  status: 'draft' | 'approved' | 'archived'
  content: {
    overview?: string
    goals?: string[]
    userPersonas?: string[]
    functionalRequirements?: string[]
    nonFunctionalRequirements?: string[]
    dataModels?: string[]
    apiEndpoints?: string[]
    uiRequirements?: string[]
    authRequirements?: string[]
    securityConsiderations?: string[]
    successMetrics?: string[]
  }
  rawText?: string
  features?: Array<{
    id?: string
    name: string
    description: string
    priority: 'high' | 'medium' | 'low'
    userStories?: string[]
    acceptanceCriteria?: string[]
  }>
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const RequirementSchema = new Schema<IRequirement>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    version: { type: Number, default: 1 },
    status: { type: String, enum: ['draft', 'approved', 'archived'], default: 'draft' },
    content: {
      overview: { type: String },
      goals: [{ type: String }],
      userPersonas: [{ type: String }],
      functionalRequirements: [{ type: String }],
      nonFunctionalRequirements: [{ type: String }],
      dataModels: [{ type: String }],
      apiEndpoints: [{ type: String }],
      uiRequirements: [{ type: String }],
      authRequirements: [{ type: String }],
      securityConsiderations: [{ type: String }],
      successMetrics: [{ type: String }],
    },
    rawText: { type: String },
    features: [
      {
        id: { type: String },
        name: { type: String, required: true },
        description: { type: String },
        priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
        userStories: [{ type: String }],
        acceptanceCriteria: [{ type: String }],
        _id: false,
      },
    ],
    createdBy: { type: String, required: true },
  },
  {
    timestamps: true,
  }
)

RequirementSchema.index({ projectId: 1, version: -1 })

export const Requirement =
  mongoose.models.Requirement || mongoose.model<IRequirement>('Requirement', RequirementSchema)
