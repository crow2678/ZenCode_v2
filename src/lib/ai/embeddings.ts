/**
 * ZenCode V2 - Embedding Generation & Semantic Search
 *
 * Generates semantic embeddings and provides similarity search functionality.
 */

import { chat } from './anthropic'

const EMBEDDING_DIMENSION = 384

/**
 * Generate a semantic embedding for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const truncatedText = text.slice(0, 2000)

  const systemPrompt = `You are an embedding generator. Convert the given text into a semantic embedding.
Return ONLY a JSON array of exactly ${EMBEDDING_DIMENSION} numbers between -1 and 1.
The numbers should capture the semantic meaning of the text.
No explanation, just the JSON array.`

  try {
    const response = await chat(
      [{ role: 'user', content: truncatedText }],
      { system: systemPrompt, maxTokens: 4096, temperature: 0 }
    )

    // Try to parse the embedding
    const jsonMatch = response.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Normalize to EMBEDDING_DIMENSION
        return normalizeEmbedding(parsed)
      }
    }

    // Fallback to simple embedding
    return generateSimpleEmbedding(truncatedText)
  } catch (error) {
    console.error('Embedding generation error:', error)
    return generateSimpleEmbedding(truncatedText)
  }
}

/**
 * Simple fallback embedding based on character codes
 */
function generateSimpleEmbedding(text: string): number[] {
  const embedding = new Array(EMBEDDING_DIMENSION).fill(0)
  const normalized = text.toLowerCase()

  for (let i = 0; i < normalized.length && i < 1000; i++) {
    const charCode = normalized.charCodeAt(i)
    const idx = (charCode + i) % EMBEDDING_DIMENSION
    embedding[idx] += Math.sin(charCode * 0.1) * 0.1
  }

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  if (magnitude > 0) {
    return embedding.map((val) => val / magnitude)
  }
  return embedding
}

/**
 * Normalize embedding to target dimension
 */
function normalizeEmbedding(embedding: number[]): number[] {
  if (embedding.length === EMBEDDING_DIMENSION) {
    return embedding
  }

  const result = new Array(EMBEDDING_DIMENSION).fill(0)

  if (embedding.length > EMBEDDING_DIMENSION) {
    // Downsample by averaging
    const ratio = embedding.length / EMBEDDING_DIMENSION
    for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
      const start = Math.floor(i * ratio)
      const end = Math.floor((i + 1) * ratio)
      let sum = 0
      for (let j = start; j < end; j++) {
        sum += embedding[j]
      }
      result[i] = sum / (end - start)
    }
  } else {
    // Upsample by interpolation
    const ratio = (embedding.length - 1) / (EMBEDDING_DIMENSION - 1)
    for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
      const pos = i * ratio
      const lower = Math.floor(pos)
      const upper = Math.min(lower + 1, embedding.length - 1)
      const weight = pos - lower
      result[i] = embedding[lower] * (1 - weight) + embedding[upper] * weight
    }
  }

  return result
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimension')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  if (magnitude === 0) return 0

  return dotProduct / magnitude
}

/**
 * Find top K similar items from a list
 */
export function findSimilar<T extends { embedding: number[] }>(
  queryEmbedding: number[],
  items: T[],
  topK: number = 5
): Array<T & { similarity: number }> {
  const scored = items.map((item) => ({
    ...item,
    similarity: cosineSimilarity(queryEmbedding, item.embedding),
  }))

  scored.sort((a, b) => b.similarity - a.similarity)

  return scored.slice(0, topK)
}

export { EMBEDDING_DIMENSION }
