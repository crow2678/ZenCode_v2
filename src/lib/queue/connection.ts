/**
 * ZenCode V2 - Queue Connection
 *
 * Shared IORedis connection for BullMQ queues and workers.
 * Reuses the REDIS_URL env var from the main Redis module.
 */

import type IORedis from 'ioredis'

let connection: IORedis | null = null

/**
 * Get shared IORedis connection for BullMQ.
 * BullMQ requires a raw ioredis instance (not the wrapped one from redis.ts).
 */
export async function getQueueConnection(): Promise<IORedis> {
  if (connection) return connection

  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    throw new Error('REDIS_URL is required for job queues')
  }

  const Redis = (await import('ioredis')).default
  connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
  })

  return connection
}
