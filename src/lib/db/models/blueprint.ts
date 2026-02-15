/**
 * ZenCode V2 - Blueprint Model
 */

import mongoose, { Document, Schema, Types } from 'mongoose'

export interface IBlueprint extends Document {
  projectId: Types.ObjectId
  requirementId: Types.ObjectId
  version: number
  status: 'draft' | 'approved' | 'archived'
  stackId: string
  name?: string  // V1-style: blueprint name
  description?: string  // V1-style: blueprint description
  estimatedWorkOrders?: number  // V1-style: estimated work order count
  architecture: {
    overview?: string
    components?: Array<{
      id?: string
      name: string
      type: 'model' | 'service' | 'router' | 'component' | 'page' | 'util' | 'frontend' | 'backend' | 'database' | 'infrastructure'
      description: string
      techStack?: string[]  // V1-style
      dependencies?: string[]
    }>
    dataFlow?: string
    securityConsiderations?: string[]  // V1-style
    integrations?: string[]
  }
  models?: Array<{
    name: string
    description?: string
    fields: Array<{
      name: string
      type: string
      required?: boolean
      unique?: boolean
      index?: boolean
      default?: string
    }>
    relationships?: string[]
    indexes?: string[]
  }>
  services?: Array<{
    name: string
    methods: Array<{
      name: string
      description: string
      inputs?: string[]
      outputs?: string
    }>
  }>
  routes?: Array<{
    name: string
    description?: string
    endpoints: Array<{
      method: 'query' | 'mutation'
      name: string
      description: string
    }>
  }>
  components?: Array<{
    name: string
    type: 'page' | 'layout' | 'component'
    description: string
    props?: string[]
  }>
  fileStructure?: string[]
  dependencies?: string[]
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

const BlueprintSchema = new Schema<IBlueprint>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    requirementId: { type: Schema.Types.ObjectId, ref: 'Requirement', required: true },
    version: { type: Number, default: 1 },
    status: { type: String, enum: ['draft', 'approved', 'archived'], default: 'draft' },
    stackId: { type: String, default: 'nextjs-mongodb' },
    name: { type: String },  // V1-style
    description: { type: String },  // V1-style
    estimatedWorkOrders: { type: Number },  // V1-style
    architecture: {
      overview: { type: String },
      components: [
        {
          id: { type: String },
          name: { type: String },
          type: { type: String, enum: ['model', 'service', 'router', 'component', 'page', 'util', 'frontend', 'backend', 'database', 'infrastructure'] },
          description: { type: String },
          techStack: [{ type: String }],  // V1-style
          dependencies: [{ type: String }],
          _id: false,
        },
      ],
      dataFlow: { type: String },
      securityConsiderations: [{ type: String }],  // V1-style
      integrations: [{ type: String }],
    },
    models: [
      {
        name: { type: String },
        description: { type: String },
        fields: [
          {
            name: { type: String },
            type: { type: String },
            required: { type: Boolean },
            unique: { type: Boolean },
            index: { type: Boolean },
            default: { type: String },
            _id: false,
          },
        ],
        relationships: [{ type: String }],
        indexes: [{ type: String }],
        _id: false,
      },
    ],
    services: [
      {
        name: { type: String },
        methods: [
          {
            name: { type: String },
            description: { type: String },
            inputs: [{ type: String }],
            outputs: { type: String },
            _id: false,
          },
        ],
        _id: false,
      },
    ],
    routes: [
      {
        name: { type: String },
        description: { type: String },
        endpoints: [
          {
            method: { type: String, enum: ['query', 'mutation'] },
            name: { type: String },
            description: { type: String },
            _id: false,
          },
        ],
        _id: false,
      },
    ],
    components: [
      {
        name: { type: String },
        type: { type: String, enum: ['page', 'layout', 'component'] },
        description: { type: String },
        props: [{ type: String }],
        _id: false,
      },
    ],
    fileStructure: [{ type: String }],
    dependencies: [{ type: String }],
    createdBy: { type: String, required: true },
  },
  {
    timestamps: true,
  }
)

BlueprintSchema.index({ projectId: 1, version: -1 })

export const Blueprint =
  mongoose.models.Blueprint || mongoose.model<IBlueprint>('Blueprint', BlueprintSchema)
