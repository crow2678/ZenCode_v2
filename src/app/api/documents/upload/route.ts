/**
 * ZenCode V2 - Document Upload API
 *
 * Handles file uploads for project documents.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { connectDB } from '@/lib/db/connection'
import { Project, ProjectDocument } from '@/lib/db/models'
import { processDocument } from '@/server/services/document'
import { getStorage } from '@/lib/storage'
import { auditLog } from '@/lib/audit'
import path from 'path'
import { nanoid } from 'nanoid'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md']

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const { userId, orgId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const effectiveOrgId = orgId || userId

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const projectId = formData.get('projectId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: 'No projectId provided' }, { status: 400 })
    }

    // Validate file type
    const ext = path.extname(file.name).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `File type not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    // Connect to database
    await connectDB()

    // Verify project access
    const project = await Project.findOne({
      _id: projectId,
      orgId: effectiveOrgId,
    }).lean()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Determine MIME type
    let mimeType = file.type
    if (!mimeType || mimeType === 'application/octet-stream') {
      // Infer from extension
      const mimeMap: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.txt': 'text/plain',
        '.md': 'text/markdown',
      }
      mimeType = mimeMap[ext] || 'application/octet-stream'
    }

    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: 'File type not supported' },
        { status: 400 }
      )
    }

    // Sanitize filename
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')

    // Generate unique filename
    const uniqueId = nanoid(10)
    const fileName = `${uniqueId}_${sanitizedName}`

    // Write file to storage
    const storageKey = `${projectId}/${fileName}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const storage = getStorage()
    await storage.write(storageKey, buffer)
    const filePath = storageKey // Store the key, not absolute path

    // Create document record
    const doc = await ProjectDocument.create({
      projectId,
      orgId: effectiveOrgId,
      fileName,
      originalName: file.name,
      mimeType,
      fileSize: file.size,
      filePath,
      status: 'uploading',
      createdBy: userId,
    })

    // Start async processing (non-blocking)
    if (process.env.USE_QUEUE === 'true') {
      const { getDocumentQueue } = await import('@/lib/queue')
      const queue = await getDocumentQueue()
      await queue.add('process', { documentId: doc._id.toString() })
    } else {
      processDocument({ documentId: doc._id.toString() }).catch((error) => {
        console.error('Document processing error:', error)
      })
    }

    auditLog({ orgId: effectiveOrgId, userId, action: 'document.upload', projectId, resourceId: doc._id.toString() })

    return NextResponse.json({
      id: doc._id.toString(),
      fileName: doc.fileName,
      originalName: doc.originalName,
      status: 'uploading',
      message: 'Document uploaded and processing started',
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
