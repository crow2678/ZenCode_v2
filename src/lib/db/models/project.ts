/**
 * ZenCode V2 - Project Model
 *
 * Matches V1's Project model for data compatibility
 */

import mongoose, { Document, Schema } from 'mongoose'

export interface IGitHubIntegration {
  repoOwner?: string
  repoName?: string
  installationId?: string
  defaultBranch?: string
}

export type DeploymentTarget = 'vercel' | 'aws' | 'gcp' | 'azure' | 'railway' | 'fly' | 'docker'

export interface IProject extends Document {
  orgId: string  // Clerk user/org ID (string, not ObjectId)
  name: string
  description: string
  repoUrl: string | null
  status: 'active' | 'archived'
  version: 'v1' | 'v2'  // Differentiates V1 and V2 projects
  integrations: {
    github?: IGitHubIntegration
  }
  metadata: {
    techStack?: string[]
    targetPlatform?: string[]
    estimatedComplexity?: 'low' | 'medium' | 'high'
    deploymentTarget?: DeploymentTarget
  }
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const GitHubIntegrationSchema = new Schema<IGitHubIntegration>(
  {
    repoOwner: { type: String },
    repoName: { type: String },
    installationId: { type: String },
    defaultBranch: { type: String, default: 'main' },
  },
  { _id: false }
)

const ProjectSchema = new Schema<IProject>(
  {
    orgId: { type: String, required: true },  // Clerk user/org ID
    name: { type: String, required: true },
    description: { type: String, default: '' },
    repoUrl: { type: String, default: null },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    version: { type: String, enum: ['v1', 'v2'], default: 'v2' },  // V2 projects by default
    integrations: {
      github: GitHubIntegrationSchema,
    },
    metadata: {
      techStack: [{ type: String }],
      targetPlatform: [{ type: String }],
      estimatedComplexity: { type: String, enum: ['low', 'medium', 'high'] },
      deploymentTarget: { type: String, enum: ['vercel', 'aws', 'gcp', 'azure', 'railway', 'fly', 'docker'], default: 'docker' },
    },
    createdBy: { type: String, required: true },
  },
  {
    timestamps: true,
  }
)

ProjectSchema.index({ orgId: 1 })
ProjectSchema.index({ orgId: 1, status: 1 })
ProjectSchema.index({ orgId: 1, version: 1, status: 1 })

export const Project =
  mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema)
