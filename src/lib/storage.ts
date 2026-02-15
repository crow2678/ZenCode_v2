/**
 * ZenCode V2 - Storage Abstraction
 *
 * Pluggable storage with Local and S3 providers.
 * Set STORAGE_PROVIDER=s3 to use S3, defaults to local.
 */

import { writeFile, readFile, unlink, mkdir, stat } from 'fs/promises'
import path from 'path'

const UPLOADS_DIR = path.join(process.cwd(), '.uploads')

export interface IStorageProvider {
  write(key: string, data: Buffer): Promise<void>
  read(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

// ============================================================================
// Local Storage Provider
// ============================================================================

class LocalStorageProvider implements IStorageProvider {
  async write(key: string, data: Buffer): Promise<void> {
    const filePath = path.join(UPLOADS_DIR, key)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, data)
  }

  async read(key: string): Promise<Buffer> {
    const filePath = path.join(UPLOADS_DIR, key)
    return readFile(filePath)
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(UPLOADS_DIR, key)
    try {
      await unlink(filePath)
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = path.join(UPLOADS_DIR, key)
    try {
      await stat(filePath)
      return true
    } catch {
      return false
    }
  }
}

// ============================================================================
// S3 Storage Provider
// ============================================================================

class S3StorageProvider implements IStorageProvider {
  private bucket: string

  constructor() {
    this.bucket = process.env.AWS_S3_BUCKET || ''
    if (!this.bucket) {
      throw new Error('AWS_S3_BUCKET environment variable is required for S3 storage')
    }
  }

  private async getClient() {
    // Dynamic import to avoid requiring @aws-sdk/client-s3 when not using S3
    const { S3Client } = await import('@aws-sdk/client-s3')
    return new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    })
  }

  async write(key: string, data: Buffer): Promise<void> {
    const client = await this.getClient()
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    await client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
    }))
  }

  async read(key: string): Promise<Buffer> {
    const client = await this.getClient()
    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    const response = await client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }))
    const stream = response.Body as ReadableStream
    const chunks: Uint8Array[] = []
    const reader = stream.getReader()
    let done = false
    while (!done) {
      const result = await reader.read()
      done = result.done
      if (result.value) chunks.push(result.value)
    }
    return Buffer.concat(chunks)
  }

  async delete(key: string): Promise<void> {
    const client = await this.getClient()
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
    await client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }))
  }

  async exists(key: string): Promise<boolean> {
    const client = await this.getClient()
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3')
    try {
      await client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }))
      return true
    } catch {
      return false
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

let storageInstance: IStorageProvider | null = null

export function getStorage(): IStorageProvider {
  if (storageInstance) return storageInstance

  const provider = process.env.STORAGE_PROVIDER || 'local'

  if (provider === 's3') {
    storageInstance = new S3StorageProvider()
  } else {
    storageInstance = new LocalStorageProvider()
  }

  return storageInstance
}
