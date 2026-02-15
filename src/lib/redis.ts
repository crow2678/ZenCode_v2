/**
 * ZenCode V2 - Redis Connection
 *
 * Shared Redis connection for rate limiting, caching, and job queues.
 * Gracefully degrades when Redis is unavailable (dev without Redis).
 */

import type IORedis from 'ioredis'

// Persist across hot-reloads in dev via globalThis
const globalRedis = globalThis as unknown as {
  __redisClient?: IORedis | null
  __redisConnectionFailed?: boolean
}

/**
 * Get shared Redis connection. Returns null if Redis is unavailable.
 */
export async function getRedis(): Promise<IORedis | null> {
  if (globalRedis.__redisConnectionFailed) return null
  if (globalRedis.__redisClient) return globalRedis.__redisClient

  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    globalRedis.__redisConnectionFailed = true
    return null
  }

  try {
    const Redis = (await import('ioredis')).default
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 2000, // Fail fast: 2s instead of default 10s
      retryStrategy() {
        // Don't retry on initial connect — fail immediately
        globalRedis.__redisConnectionFailed = true
        return null
      },
    })

    // Suppress unhandled error events
    client.on('error', () => {})

    // Explicitly connect and test
    await client.connect()
    await client.ping()
    globalRedis.__redisClient = client
    return client
  } catch {
    console.warn('[Redis] Connection failed, features requiring Redis will be disabled.')
    globalRedis.__redisConnectionFailed = true
    globalRedis.__redisClient = null
    return null
  }
}
