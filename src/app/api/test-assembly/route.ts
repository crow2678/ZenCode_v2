/**
 * ZenCode V2 - Test Assembly API
 *
 * Test the assembly engine with sample work orders
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAssemblyEngine } from '@/engine'
import type { WorkOrder } from '@/engine/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stackId, workOrders } = body as {
      stackId?: string
      workOrders: WorkOrder[]
    }

    const engine = createAssemblyEngine(stackId)

    const result = await engine.assemble({
      projectId: 'test-project',
      projectName: 'Test Project',
      stackId,
      workOrders,
      options: {
        validateImports: true,
        validateExports: true,
        extractDependencies: true,
      },
    })

    return NextResponse.json({
      success: result.success,
      stackId: result.stackId,
      stats: result.stats,
      dependencies: result.dependencies,
      errors: result.validationErrors,
      files: Array.from(result.files.keys()),
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

// Sample test endpoint
export async function GET() {
  const sampleWorkOrders: WorkOrder[] = [
    {
      id: 'wo-1',
      title: 'Create User model',
      description: 'Create the User mongoose model',
      files: [
        {
          path: 'src/lib/db/models/user.ts',
          action: 'create',
          content: `import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  name: string
  email: string
  createdAt: Date
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
}, { timestamps: true })

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
`,
        },
      ],
    },
    {
      id: 'wo-2',
      title: 'Create models barrel',
      description: 'Create index.ts for models',
      files: [
        {
          path: 'src/lib/db/models/index.ts',
          action: 'create',
          content: `export { User, type IUser } from './user'
`,
        },
      ],
    },
    {
      id: 'wo-3',
      title: 'Create user service',
      description: 'Create user service',
      files: [
        {
          path: 'src/server/services/user.ts',
          action: 'create',
          content: `import { connectDB } from '@/lib/db/connection'
import { User, type IUser } from '@/lib/db/models'

export async function getUsers(): Promise<IUser[]> {
  await connectDB()
  return User.find().lean()
}

export async function createUser(data: { name: string; email: string }): Promise<IUser> {
  await connectDB()
  const user = await User.create(data)
  return user.toObject()
}
`,
        },
      ],
    },
  ]

  const engine = createAssemblyEngine()

  const result = await engine.assemble({
    projectId: 'sample-test',
    projectName: 'Sample Test',
    workOrders: sampleWorkOrders,
    options: {
      validateImports: true,
      validateExports: true,
      extractDependencies: true,
    },
  })

  // Also analyze the files
  const analysis = engine.analyzeFiles()
  const missingFiles = engine.findMissingFiles()

  return NextResponse.json({
    success: result.success,
    stackId: result.stackId,
    stats: result.stats,
    dependencies: result.dependencies,
    errors: result.validationErrors,
    files: Array.from(result.files.keys()),
    analysis: analysis.map((a) => ({
      path: a.path,
      imports: a.imports.length,
      exports: a.exports.length,
      externalDeps: a.externalDeps,
      unresolvedImports: a.imports.filter((i) => !i.resolved).length,
    })),
    missingFiles,
  })
}
