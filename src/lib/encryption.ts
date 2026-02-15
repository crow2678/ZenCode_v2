/**
 * ZenCode V2 - Encryption Utilities
 *
 * AES-256-GCM encryption for sensitive data (API keys).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required')
  }
  // Expect 32-byte hex string (64 hex chars)
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(key, 'hex')
}

export interface EncryptedData {
  ciphertext: string // base64
  iv: string // base64
  tag: string // base64
}

export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const tag = cipher.getAuthTag()

  return {
    ciphertext: encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }
}

export function decrypt(data: EncryptedData): string {
  const key = getEncryptionKey()
  const iv = Buffer.from(data.iv, 'base64')
  const tag = Buffer.from(data.tag, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(data.ciphertext, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
