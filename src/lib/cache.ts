/**
 * ZenCode V2 - Cache Manager
 *
 * Redis-backed caching with content-hash keys.
 * Gracefully degrades when Redis is unavailable.
 */

import { createHash } from 'crypto'
import { getRedis } from './redis'

const DEFAULT_TTL = 3600 // 1 hour in seconds

/**
 * SHA-256 content hash for cache keys.
 */
export function hashInput(...parts: string[]): string {
  const hash = createHash('sha256')
  for (const part of parts) {
    hash.update(part)
  }
  return hash.digest('hex')
}

/**
 * Get a value from cache.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = await getRedis()
  if (!redis) return null

  try {
    const value = await redis.get(`cache:${key}`)
    if (!value) return null
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

/**
 * Set a value in cache with TTL.
 */
export async function cacheSet<T>(key: string, value: T, ttl = DEFAULT_TTL): Promise<void> {
  const redis = await getRedis()
  if (!redis) return

  try {
    await redis.setex(`cache:${key}`, ttl, JSON.stringify(value))
  } catch (error) {
    console.error('[Cache] Failed to set:', error)
  }
}

/**
 * Invalidate a cache key.
 */
export async function cacheInvalidate(key: string): Promise<void> {
  const redis = await getRedis()
  if (!redis) return

  try {
    await redis.del(`cache:${key}`)
  } catch (error) {
    console.error('[Cache] Failed to invalidate:', error)
  }
}
