/**
 * ZenCode V2 - Work Order Files Download API
 *
 * Downloads work order files as a ZIP archive.
 * GET /api/download/work-orders?projectId=xxx&workOrderId=yyy (optional)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { connectDB } from '@/lib/db/connection'
import { Project, WorkOrder } from '@/lib/db/models'
import JSZip from 'jszip'

export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const effectiveOrgId = orgId || userId
    const projectId = request.nextUrl.searchParams.get('projectId')
    const workOrderId = request.nextUrl.searchParams.get('workOrderId')

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    await connectDB()

    // Verify project access
    const project = await Project.findOne({
      _id: projectId,
      orgId: effectiveOrgId,
    }).lean()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Build query
    const query: Record<string, unknown> = {
      projectId,
      status: 'completed',
    }
    if (workOrderId) {
      query._id = workOrderId
    }

    const workOrders = await WorkOrder.find(query)
      .sort({ orderNumber: 1 })
      .lean()

    if (workOrders.length === 0) {
      return NextResponse.json({ error: 'No completed work orders found' }, { status: 404 })
    }

    // Build ZIP
    const zip = new JSZip()

    for (const wo of workOrders) {
      for (const file of wo.files || []) {
        if (file.action !== 'delete' && file.content) {
          zip.file(file.path, file.content)
        }
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
    const fileName = workOrderId
      ? `work-order-${workOrders[0]?.orderNumber || 'files'}.zip`
      : `${project.name || 'work-orders'}-all.zip`

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Download failed' },
      { status: 500 }
    )
  }
}
