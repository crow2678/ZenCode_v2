/**
 * ZenCode V2 - Input Sanitization
 *
 * Strips prompt injection patterns and normalizes user input
 * before it reaches the AI pipeline.
 */

const MAX_INPUT_LENGTH = 50_000

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /ignore\s+(all\s+)?above\s+instructions?/gi,
  /disregard\s+(all\s+)?previous/gi,
  /<system>/gi,
  /<\/system>/gi,
  /<\|system\|>/gi,
  /<\|user\|>/gi,
  /<\|assistant\|>/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<<SYS>>/gi,
  /<<\/SYS>>/gi,
  /\{system_message\}/gi,
  /\{instructions\}/gi,
]

/**
 * Sanitize user-provided text before passing to AI prompts.
 * - Strips known prompt injection patterns
 * - Limits length to 50K chars
 * - Normalizes whitespace
 */
export function sanitizePromptInput(text: string): string {
  if (!text) return ''

  let sanitized = text

  // Truncate to max length
  if (sanitized.length > MAX_INPUT_LENGTH) {
    sanitized = sanitized.slice(0, MAX_INPUT_LENGTH)
  }

  // Strip injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '')
  }

  // Normalize whitespace (collapse multiple newlines/spaces, trim)
  sanitized = sanitized
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

  return sanitized
}
