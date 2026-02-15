/**
 * ZenCode V2 - Project Document Model
 *
 * Stores uploaded documents with extracted text, AI analysis, and semantic chunks.
 */

import mongoose, { Document, Schema, Types } from 'mongoose'

export type DocumentStatus = 'uploading' | 'processing' | 'ready' | 'failed'

export type DocumentType =
  | 'spec'
  | 'api_doc'
  | 'architecture'
  | 'wireframe'
  | 'user_research'
  | 'business_req'
  | 'technical'
  | 'other'

export interface IDocumentChunk {
  index: number
  content: string
  heading?: string
  embedding: number[]
  relevance: {
    prd: number
    blueprint: number
    workOrders: number
  }
}

export interface IDocumentMetadata {
  documentType: DocumentType
  topics: string[]
  entities: {
    features: string[]
    techStack: string[]
    apis: string[]
    dataModels: string[]
  }
  summary: string
  keyInsights: string[]
  stageRelevance: {
    prd: number
    blueprint: number
    workOrders: number
    agent: number
  }
}

export interface IProjectDocument extends Document {
  projectId: Types.ObjectId
  orgId: string
  fileName: string
  originalName: string
  mimeType: string
  fileSize: number
  filePath: string
  status: DocumentStatus
  extractedText?: string
  metadata?: IDocumentMetadata
  chunks: IDocumentChunk[]
  error?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const DocumentChunkSchema = new Schema<IDocumentChunk>(
  {
    index: { type: Number, required: true },
    content: { type: String, required: true },
    heading: { type: String },
    embedding: [{ type: Number }],
    relevance: {
      prd: { type: Number, default: 0.5 },
      blueprint: { type: Number, default: 0.5 },
      workOrders: { type: Number, default: 0.5 },
    },
  },
  { _id: false }
)

const DocumentMetadataSchema = new Schema<IDocumentMetadata>(
  {
    documentType: {
      type: String,
      enum: ['spec', 'api_doc', 'architecture', 'wireframe', 'user_research', 'business_req', 'technical', 'other'],
      default: 'other',
    },
    topics: [{ type: String }],
    entities: {
      features: [{ type: String }],
      techStack: [{ type: String }],
      apis: [{ type: String }],
      dataModels: [{ type: String }],
    },
    summary: { type: String },
    keyInsights: [{ type: String }],
    stageRelevance: {
      prd: { type: Number, default: 0.5 },
      blueprint: { type: Number, default: 0.5 },
      workOrders: { type: Number, default: 0.5 },
      agent: { type: Number, default: 0.5 },
    },
  },
  { _id: false }
)

const ProjectDocumentSchema = new Schema<IProjectDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    orgId: { type: String, required: true },
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    filePath: { type: String, required: true },
    status: {
      type: String,
      enum: ['uploading', 'processing', 'ready', 'failed'],
      default: 'uploading',
    },
    extractedText: { type: String },
    metadata: DocumentMetadataSchema,
    chunks: [DocumentChunkSchema],
    error: { type: String },
    createdBy: { type: String, required: true },
  },
  {
    timestamps: true,
  }
)

ProjectDocumentSchema.index({ projectId: 1, status: 1 })
ProjectDocumentSchema.index({ orgId: 1 })

export const ProjectDocument =
  mongoose.models.ProjectDocument ||
  mongoose.model<IProjectDocument>('ProjectDocument', ProjectDocumentSchema)
