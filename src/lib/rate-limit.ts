/**
 * ZenCode V2 - Rate Limiting
 *
 * Redis sliding window rate limiter per org.
 * Gracefully skips when Redis is unavailable.
 */

import { TRPCError } from '@trpc/server'
import { getRedis } from './redis'

const DEFAULT_LIMIT_PER_MINUTE = 30
const DEFAULT_LIMIT_PER_HOUR = 500

/**
 * Check rate limit for an org's AI requests.
 * Throws TRPCError TOO_MANY_REQUESTS if exceeded.
 * Silently passes through if Redis is unavailable.
 */
export async function checkAiRateLimit(orgId: string): Promise<void> {
  const redis = await getRedis()
  if (!redis) return // No Redis — skip rate limiting

  const now = Date.now()
  const minuteKey = `ratelimit:${orgId}:minute`
  const hourKey = `ratelimit:${orgId}:hour`

  // Check per-minute limit
  const minuteCount = await redis.zcount(minuteKey, now - 60_000, '+inf')
  if (minuteCount >= DEFAULT_LIMIT_PER_MINUTE) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Rate limit exceeded: ${DEFAULT_LIMIT_PER_MINUTE} requests per minute. Please wait.`,
    })
  }

  // Check per-hour limit
  const hourCount = await redis.zcount(hourKey, now - 3600_000, '+inf')
  if (hourCount >= DEFAULT_LIMIT_PER_HOUR) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Rate limit exceeded: ${DEFAULT_LIMIT_PER_HOUR} requests per hour. Please wait.`,
    })
  }

  // Record this request (fire and forget)
  const requestId = `${now}:${Math.random().toString(36).slice(2, 8)}`

  const pipeline = redis.pipeline()
  // Add to minute window
  pipeline.zadd(minuteKey, now, requestId)
  pipeline.expire(minuteKey, 120)
  pipeline.zremrangebyscore(minuteKey, '-inf', now - 60_000)
  // Add to hour window
  pipeline.zadd(hourKey, now, requestId)
  pipeline.expire(hourKey, 7200)
  pipeline.zremrangebyscore(hourKey, '-inf', now - 3600_000)

  await pipeline.exec()
}
