/**
 * ZenCode V2 - Document Service
 *
 * Handles document processing, analysis, chunking, and context retrieval.
 */

import { connectDB } from '@/lib/db/connection'
import { ProjectDocument, Project } from '@/lib/db/models'
import type { IDocumentChunk, IDocumentMetadata, IProjectDocument } from '@/lib/db/models/project-document'
import { chat, parseAiJson } from '@/lib/ai/anthropic'
import { generateEmbedding, cosineSimilarity } from '@/lib/ai/embeddings'
import { getStorage } from '@/lib/storage'
import path from 'path'

// =============================================================================
// Types
// =============================================================================

export interface ProcessDocumentInput {
  documentId: string
}

export interface DeleteDocumentInput {
  documentId: string
  orgId: string
}

export interface GetDocumentContextInput {
  projectId: string
  stage: 'prd' | 'blueprint' | 'workOrders' | 'agent'
  queryText: string
  topK?: number
}

// =============================================================================
// Document Processing
// =============================================================================

export async function processDocument(input: ProcessDocumentInput): Promise<void> {
  await connectDB()

  const doc = await ProjectDocument.findById(input.documentId)
  if (!doc) throw new Error('Document not found')

  try {
    // Update status to processing
    await ProjectDocument.updateOne(
      { _id: input.documentId },
      { $set: { status: 'processing' } }
    )

    // Step 1: Extract text from document
    const extractedText = await extractText(doc.filePath, doc.mimeType)
    if (!extractedText || extractedText.length < 10) {
      throw new Error('Failed to extract text from document')
    }

    // Step 2: Analyze document with AI
    const metadata = await analyzeDocument(extractedText, doc.originalName)

    // Step 3: Chunk the document
    const chunks = chunkDocument(extractedText)

    // Step 4: Rate chunk relevance
    const ratedChunks = await rateChunkRelevance(chunks, metadata)

    // Step 5: Generate embeddings for chunks
    const embeddedChunks = await embedChunks(ratedChunks)

    // Update document with processed data
    await ProjectDocument.updateOne(
      { _id: input.documentId },
      {
        $set: {
          status: 'ready',
          extractedText,
          metadata,
          chunks: embeddedChunks,
        },
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`Document processing error: ${errorMessage}`)

    await ProjectDocument.updateOne(
      { _id: input.documentId },
      {
        $set: {
          status: 'failed',
          error: errorMessage,
        },
      }
    )
  }
}

// =============================================================================
// Text Extraction
// =============================================================================

async function extractText(filePath: string, mimeType: string): Promise<string> {
  const storage = getStorage()
  const content = await storage.read(filePath)

  switch (mimeType) {
    case 'application/pdf':
      return extractPdfText(content)

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractDocxText(content)

    case 'text/plain':
    case 'text/markdown':
      return content.toString('utf-8')

    default:
      throw new Error(`Unsupported file type: ${mimeType}`)
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import for pdf-parse
    const pdfParse = (await import('pdf-parse')).default
    const data = await pdfParse(buffer)
    return data.text
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error('Failed to extract text from PDF')
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import for mammoth
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch (error) {
    console.error('DOCX extraction error:', error)
    throw new Error('Failed to extract text from DOCX')
  }
}

// =============================================================================
// AI Document Analysis
// =============================================================================

async function analyzeDocument(
  text: string,
  fileName: string
): Promise<IDocumentMetadata> {
  const truncated = text.slice(0, 8000)

  const systemPrompt = `You are a document analyzer. Analyze the document and extract metadata.

Return a JSON object:
{
  "documentType": "spec|api_doc|architecture|wireframe|user_research|business_req|technical|other",
  "topics": ["main topics covered"],
  "entities": {
    "features": ["feature names mentioned"],
    "techStack": ["technologies mentioned"],
    "apis": ["API endpoints mentioned"],
    "dataModels": ["data models/entities mentioned"]
  },
  "summary": "2-3 sentence summary",
  "keyInsights": ["top 5 actionable insights"],
  "stageRelevance": {
    "prd": 0.0-1.0,
    "blueprint": 0.0-1.0,
    "workOrders": 0.0-1.0,
    "agent": 0.0-1.0
  }
}

Return ONLY valid JSON.`

  const userPrompt = `Analyze this document:

**File Name:** ${fileName}

**Content:**
${truncated}`

  try {
    const result = await parseAiJson<IDocumentMetadata>(
      () => chat([{ role: 'user', content: userPrompt }], {
        system: systemPrompt,
        maxTokens: 4096,
        temperature: 0.2
      }),
      'analyzeDocument'
    )

    return {
      documentType: result.documentType || 'other',
      topics: result.topics || [],
      entities: {
        features: result.entities?.features || [],
        techStack: result.entities?.techStack || [],
        apis: result.entities?.apis || [],
        dataModels: result.entities?.dataModels || [],
      },
      summary: result.summary || '',
      keyInsights: result.keyInsights || [],
      stageRelevance: {
        prd: result.stageRelevance?.prd ?? 0.5,
        blueprint: result.stageRelevance?.blueprint ?? 0.5,
        workOrders: result.stageRelevance?.workOrders ?? 0.5,
        agent: result.stageRelevance?.agent ?? 0.5,
      },
    }
  } catch (error) {
    console.error('Document analysis error:', error)
    return {
      documentType: 'other',
      topics: [],
      entities: { features: [], techStack: [], apis: [], dataModels: [] },
      summary: '',
      keyInsights: [],
      stageRelevance: { prd: 0.5, blueprint: 0.5, workOrders: 0.5, agent: 0.5 },
    }
  }
}

// =============================================================================
// Document Chunking
// =============================================================================

interface RawChunk {
  index: number
  content: string
  heading?: string
}

function chunkDocument(text: string): RawChunk[] {
  const chunks: RawChunk[] = []
  const MIN_CHUNK_SIZE = 200
  const MAX_CHUNK_SIZE = 1500

  // Split by markdown headings first
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const sections: Array<{ heading?: string; content: string }> = []

  let lastIndex = 0
  let match

  while ((match = headingRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const content = text.slice(lastIndex, match.index).trim()
      if (content) {
        sections.push({ content })
      }
    }
    lastIndex = match.index + match[0].length
    sections.push({ heading: match[2], content: '' })
  }

  // Add remaining content
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim()
    if (sections.length > 0 && sections[sections.length - 1].heading) {
      sections[sections.length - 1].content = remaining
    } else if (remaining) {
      sections.push({ content: remaining })
    }
  }

  // If no headings found, treat entire text as one section
  if (sections.length === 0) {
    sections.push({ content: text })
  }

  // Process sections into chunks
  let currentHeading: string | undefined
  let chunkIndex = 0

  for (const section of sections) {
    if (section.heading) {
      currentHeading = section.heading
    }

    if (!section.content) continue

    // Split long sections by paragraphs
    const paragraphs = section.content.split(/\n\n+/)

    for (const para of paragraphs) {
      if (para.length < MIN_CHUNK_SIZE) {
        // Too small, try to merge with previous
        if (chunks.length > 0 && chunks[chunks.length - 1].content.length + para.length < MAX_CHUNK_SIZE) {
          chunks[chunks.length - 1].content += '\n\n' + para
          continue
        }
      }

      if (para.length > MAX_CHUNK_SIZE) {
        // Too large, split by sentences
        const sentences = para.split(/(?<=[.!?])\s+/)
        let buffer = ''

        for (const sentence of sentences) {
          if (buffer.length + sentence.length > MAX_CHUNK_SIZE) {
            if (buffer) {
              chunks.push({ index: chunkIndex++, content: buffer.trim(), heading: currentHeading })
            }
            buffer = sentence
          } else {
            buffer += (buffer ? ' ' : '') + sentence
          }
        }

        if (buffer) {
          chunks.push({ index: chunkIndex++, content: buffer.trim(), heading: currentHeading })
        }
      } else {
        chunks.push({ index: chunkIndex++, content: para.trim(), heading: currentHeading })
      }
    }
  }

  return chunks
}

// =============================================================================
// Chunk Relevance Rating
// =============================================================================

async function rateChunkRelevance(
  chunks: RawChunk[],
  metadata: IDocumentMetadata
): Promise<Array<RawChunk & { relevance: { prd: number; blueprint: number; workOrders: number } }>> {
  // For efficiency, use document-level relevance as base
  const baseRelevance = {
    prd: metadata.stageRelevance.prd,
    blueprint: metadata.stageRelevance.blueprint,
    workOrders: metadata.stageRelevance.workOrders,
  }

  // Adjust relevance based on chunk content keywords
  return chunks.map((chunk) => {
    const content = chunk.content.toLowerCase()
    const relevance = { ...baseRelevance }

    // PRD indicators
    if (/requirement|user story|feature|goal|objective|persona/i.test(content)) {
      relevance.prd = Math.min(1, relevance.prd + 0.2)
    }

    // Blueprint indicators
    if (/architecture|component|design|structure|diagram|flow/i.test(content)) {
      relevance.blueprint = Math.min(1, relevance.blueprint + 0.2)
    }

    // Work order indicators
    if (/implement|code|function|api|endpoint|database|schema/i.test(content)) {
      relevance.workOrders = Math.min(1, relevance.workOrders + 0.2)
    }

    return { ...chunk, relevance }
  })
}

// =============================================================================
// Embedding Generation
// =============================================================================

async function embedChunks(
  chunks: Array<RawChunk & { relevance: { prd: number; blueprint: number; workOrders: number } }>
): Promise<IDocumentChunk[]> {
  const embeddedChunks: IDocumentChunk[] = []

  // Process in batches to avoid rate limits
  const BATCH_SIZE = 5
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)

    const embeddings = await Promise.all(
      batch.map((chunk) => generateEmbedding(chunk.content))
    )

    for (let j = 0; j < batch.length; j++) {
      embeddedChunks.push({
        index: batch[j].index,
        content: batch[j].content,
        heading: batch[j].heading,
        embedding: embeddings[j],
        relevance: batch[j].relevance,
      })
    }
  }

  return embeddedChunks
}

// =============================================================================
// Document Context Retrieval
// =============================================================================

export async function getDocumentContext(
  input: GetDocumentContextInput
): Promise<string> {
  await connectDB()

  const { projectId, stage, queryText, topK = 8 } = input

  // Get all ready documents for the project
  const documents = await ProjectDocument.find({
    projectId,
    status: 'ready',
  }).lean()

  if (documents.length === 0) {
    return ''
  }

  // Collect all chunks with sufficient relevance
  const relevanceKey = stage === 'agent' ? 'workOrders' : stage
  const MIN_RELEVANCE = 0.3

  const allChunks: Array<{
    chunk: IDocumentChunk
    docName: string
  }> = []

  for (const doc of documents) {
    for (const chunk of doc.chunks || []) {
      const relevanceScore = chunk.relevance?.[relevanceKey as keyof typeof chunk.relevance] ?? 0.5
      if (relevanceScore >= MIN_RELEVANCE) {
        allChunks.push({
          chunk,
          docName: doc.originalName,
        })
      }
    }
  }

  if (allChunks.length === 0) {
    return ''
  }

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(queryText)

  // Score and rank chunks
  const scoredChunks = allChunks.map(({ chunk, docName }) => {
    const similarity = cosineSimilarity(queryEmbedding, chunk.embedding)
    const relevanceScore = chunk.relevance?.[relevanceKey as keyof typeof chunk.relevance] ?? 0.5

    // Hybrid score: 70% semantic, 30% stage relevance
    const score = 0.7 * similarity + 0.3 * relevanceScore

    return { chunk, docName, score }
  })

  // Sort by score and take top K
  scoredChunks.sort((a, b) => b.score - a.score)
  const topChunks = scoredChunks.slice(0, topK)

  // Format context
  const contextParts = topChunks.map(({ chunk, docName }) => {
    const heading = chunk.heading ? ` (Section: ${chunk.heading})` : ''
    return `--- From: ${docName}${heading} ---\n${chunk.content}`
  })

  return contextParts.join('\n\n')
}

// =============================================================================
// Document Deletion
// =============================================================================

export async function deleteDocument(input: DeleteDocumentInput): Promise<void> {
  await connectDB()

  const doc = await ProjectDocument.findById(input.documentId)
  if (!doc) throw new Error('Document not found')

  if (doc.orgId !== input.orgId) {
    throw new Error('Unauthorized')
  }

  // Delete file from storage
  try {
    const storage = getStorage()
    await storage.delete(doc.filePath)
  } catch (error) {
    console.error('Failed to delete file:', error)
  }

  // Delete document record
  await ProjectDocument.deleteOne({ _id: input.documentId })
}

// =============================================================================
// Document Listing
// =============================================================================

export async function listDocuments(projectId: string): Promise<Array<{
  id: string
  fileName: string
  originalName: string
  fileSize: number
  status: string
  documentType?: string
  summary?: string
  error?: string
  createdAt: Date
}>> {
  await connectDB()

  const documents = await ProjectDocument.find({ projectId })
    .select('-chunks -extractedText -metadata.entities')
    .sort({ createdAt: -1 })
    .lean()

  return documents.map((doc) => ({
    id: doc._id.toString(),
    fileName: doc.fileName,
    originalName: doc.originalName,
    fileSize: doc.fileSize,
    status: doc.status,
    documentType: doc.metadata?.documentType,
    summary: doc.metadata?.summary,
    error: doc.error,
    createdAt: doc.createdAt,
  }))
}
