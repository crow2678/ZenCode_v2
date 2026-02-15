/**
 * ZenCode V2 - Anthropic AI Integration
 *
 * Core chat function with prompt caching for 90% cost reduction.
 * Supports per-request API keys (BYOK) and token usage tracking.
 */

import Anthropic from '@anthropic-ai/sdk'

// In-memory cache for org API keys (avoids DB lookup on every call)
const keyCache = new Map<string, { key: string; expiresAt: number }>()
const KEY_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export interface ChatOptions {
  system?: string
  maxTokens?: number
  temperature?: number
  useCache?: boolean
  stream?: boolean
  apiKey?: string // BYOK: per-request API key
  onChunk?: (text: string) => void // SSE: streaming callback
  trackUsage?: {
    orgId: string
    projectId?: string
    operation: string
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Look up the Anthropic API key for an org, with 5-min in-memory cache.
 * Returns undefined if no custom key is set (falls back to env var).
 */
export async function getAnthropicKey(orgId: string): Promise<string | undefined> {
  // Check cache first
  const cached = keyCache.get(orgId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key
  }

  try {
    // Dynamic import to avoid circular dependency
    const { OrgSettings } = await import('@/lib/db/models/org-settings')
    const { decrypt } = await import('@/lib/encryption')

    const settings = await OrgSettings.findOne({ orgId }).lean()
    if (!settings?.anthropicApiKey || !settings.anthropicApiKeyIv || !settings.anthropicApiKeyTag) {
      return undefined
    }

    const decryptedKey = decrypt({
      ciphertext: settings.anthropicApiKey,
      iv: settings.anthropicApiKeyIv,
      tag: settings.anthropicApiKeyTag,
    })

    keyCache.set(orgId, { key: decryptedKey, expiresAt: Date.now() + KEY_CACHE_TTL })
    return decryptedKey
  } catch (error) {
    console.error('[Anthropic] Failed to get org API key:', error)
    return undefined
  }
}

/**
 * Create an Anthropic client with the appropriate API key.
 */
function createClient(apiKey?: string): Anthropic {
  return new Anthropic({
    apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
  })
}

/**
 * Send a chat message to Claude with optional prompt caching and streaming
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const {
    system,
    maxTokens = 8192,
    temperature = 0.3,
    useCache = true,
    stream = false,
    apiKey,
    onChunk,
    trackUsage,
  } = options

  const client = createClient(apiKey)

  // Build system message with optional caching
  const systemMessages: Anthropic.MessageCreateParams['system'] = system
    ? useCache
      ? [
          {
            type: 'text' as const,
            text: system,
            cache_control: { type: 'ephemeral' as const },
          },
        ]
      : system
    : undefined

  // Use streaming for large token requests or if onChunk callback is provided
  const shouldStream = stream || maxTokens > 8192 || !!onChunk

  if (shouldStream) {
    return chatWithStreaming(client, messages, systemMessages, maxTokens, temperature, onChunk, trackUsage)
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    temperature,
    system: systemMessages,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  })

  // Track token usage if requested
  if (trackUsage) {
    trackTokenUsage(trackUsage, response.usage, response.model)
  }

  const textBlock = response.content.find((block) => block.type === 'text')
  return textBlock?.type === 'text' ? textBlock.text : ''
}

/**
 * Streaming chat for long operations
 */
async function chatWithStreaming(
  client: Anthropic,
  messages: ChatMessage[],
  systemMessages: Anthropic.MessageCreateParams['system'],
  maxTokens: number,
  temperature: number,
  onChunk?: (text: string) => void,
  trackUsage?: ChatOptions['trackUsage']
): Promise<string> {
  let result = ''

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    temperature,
    system: systemMessages,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      result += event.delta.text
      if (onChunk) {
        onChunk(event.delta.text)
      }
    }
  }

  // Track usage from the final message
  if (trackUsage) {
    const finalMessage = await stream.finalMessage()
    trackTokenUsage(trackUsage, finalMessage.usage, finalMessage.model)
  }

  return result
}

/**
 * Fire-and-forget token usage tracking
 */
function trackTokenUsage(
  trackUsage: NonNullable<ChatOptions['trackUsage']>,
  usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number },
  model: string
): void {
  // Dynamic import to avoid circular dependencies
  import('@/lib/db/models/token-usage').then(({ TokenUsage }) => {
    TokenUsage.create({
      orgId: trackUsage.orgId,
      projectId: trackUsage.projectId,
      operation: trackUsage.operation,
      model,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheCreationTokens: usage.cache_creation_input_tokens,
      cacheReadTokens: usage.cache_read_input_tokens,
    }).catch((err: unknown) => {
      console.error('[Anthropic] Failed to track token usage:', err)
    })
  }).catch(() => {
    // TokenUsage model not available yet — skip
  })
}

/**
 * Try to parse JSON from AI response, handling markdown code blocks
 */
export function tryParseJsonResponse(response: string): unknown | null {
  // Try direct parse first
  try {
    return JSON.parse(response)
  } catch {
    // Continue to other methods
  }

  // Try extracting from markdown code blocks
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim())
    } catch {
      // Continue
    }
  }

  // Try extracting JSON object or array
  const jsonMatch = response.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1])
    } catch {
      // Continue
    }
  }

  return null
}

/**
 * Attempt to repair truncated JSON responses
 * Handles common AI truncation issues like:
 * - Unclosed strings
 * - Missing closing braces/brackets
 * - Trailing commas
 */
export function repairTruncatedJson(response: string): unknown | null {
  // Extract JSON portion
  let json = response
  const jsonMatch = response.match(/(\{[\s\S]*|\[[\s\S]*)/)
  if (jsonMatch) {
    json = jsonMatch[1]
  }

  // Count brackets
  let openBraces = 0
  let openBrackets = 0
  let inString = false
  let lastChar = ''

  for (let i = 0; i < json.length; i++) {
    const char = json[i]

    if (char === '"' && lastChar !== '\\') {
      inString = !inString
    } else if (!inString) {
      if (char === '{') openBraces++
      else if (char === '}') openBraces--
      else if (char === '[') openBrackets++
      else if (char === ']') openBrackets--
    }

    lastChar = char
  }

  // If in string, close it
  if (inString) {
    json += '"'
  }

  // Remove trailing comma
  json = json.replace(/,\s*$/, '')

  // Close brackets and braces
  while (openBrackets > 0) {
    json += ']'
    openBrackets--
  }
  while (openBraces > 0) {
    json += '}'
    openBraces--
  }

  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Parse AI response as JSON with retry and repair fallback
 */
export async function parseAiJson<T>(
  promptFn: () => Promise<string>,
  errorLabel: string
): Promise<T> {
  const response = await promptFn()

  // Try direct parse
  const parsed = tryParseJsonResponse(response)
  if (parsed) return parsed as T

  // Try repair
  const repaired = repairTruncatedJson(response)
  if (repaired) return repaired as T

  // Retry with exponential backoff
  console.warn(`${errorLabel}: first response failed to parse, retrying after delay...`)
  await sleep(2000) // 2 second delay before retry
  const retryResponse = await promptFn()

  const retryParsed = tryParseJsonResponse(retryResponse)
  if (retryParsed) return retryParsed as T

  const retryRepaired = repairTruncatedJson(retryResponse)
  if (retryRepaired) return retryRepaired as T

  throw new Error(`Failed to parse ${errorLabel} JSON from AI response`)
}
