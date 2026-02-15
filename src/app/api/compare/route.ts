/**
 * ZenCode V2 - V1 vs V2 Comparison API
 *
 * Fetches projects from shared MongoDB and compares assembly results
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db/connection'
import { Project, WorkOrder, Assembly } from '@/lib/db/models'
import { createAssemblyEngine } from '@/engine'
import type { WorkOrder as WorkOrderInput } from '@/engine/types'

export async function GET(request: NextRequest) {
  try {
    await connectDB()

    // Fetch recent projects
    const projects = await Project.find({ status: 'active' })
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean()

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        description: p.description,
        techStack: p.metadata?.techStack || [],
        updatedAt: p.updatedAt,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json()

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      )
    }

    await connectDB()

    // Fetch project
    const project = await Project.findById(projectId).lean()
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Fetch work orders
    const workOrders = await WorkOrder.find({ projectId })
      .sort({ orderNumber: 1 })
      .lean()

    // Fetch V1 assembly result (latest)
    const v1Assembly = await Assembly.findOne({ projectId })
      .sort({ createdAt: -1 })
      .lean()

    // Run V2 assembly
    const engine = createAssemblyEngine()

    const workOrderInputs: WorkOrderInput[] = workOrders.map((wo) => ({
      id: wo._id.toString(),
      title: wo.title,
      description: wo.description,
      phase: wo.phase,
      files: wo.files.map((f) => ({
        path: f.path,
        action: f.action,
        content: f.content || '',
        description: f.description,
      })),
    }))

    const v2Result = await engine.assemble({
      projectId: projectId,
      projectName: project.name,
      stackId: undefined, // Use default
      workOrders: workOrderInputs,
      options: {
        validateImports: true,
        validateExports: true,
        extractDependencies: true,
      },
    })

    // Compare results
    const comparison = {
      project: {
        id: project._id.toString(),
        name: project.name,
        techStack: project.metadata?.techStack || [],
      },
      workOrderCount: workOrders.length,
      v1: v1Assembly
        ? {
            status: v1Assembly.status,
            filesCount: v1Assembly.mergedFiles?.length || 0,
            errorCount: v1Assembly.validationErrors?.length || 0,
            errors: v1Assembly.validationErrors?.slice(0, 10) || [],
            fixAttempts: v1Assembly.fixAttempts,
          }
        : null,
      v2: {
        success: v2Result.success,
        filesCount: v2Result.stats.totalFiles,
        errorCount: v2Result.validationErrors.length,
        errors: v2Result.validationErrors.slice(0, 10),
        dependencies: v2Result.dependencies.length,
        timeMs: v2Result.stats.timeMs,
      },
      analysis: {
        v2CatchesMore:
          v1Assembly &&
          v2Result.validationErrors.length > (v1Assembly.validationErrors?.length || 0),
        sameFileCount:
          v1Assembly &&
          v2Result.stats.totalFiles === (v1Assembly.mergedFiles?.length || 0),
        missingInV1: v2Result.validationErrors.filter((e) =>
          !v1Assembly?.validationErrors?.some(
            (v1e) => v1e.file === e.file && v1e.message === e.message
          )
        ),
      },
    }

    return NextResponse.json(comparison)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
