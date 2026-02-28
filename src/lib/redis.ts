import Redis, { type RedisOptions } from 'ioredis'
import { Queue, type QueueOptions } from 'bullmq'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

// =============================================================
// Redis Client & BullMQ Job Queues (E1-S03)
// =============================================================

// ---------------------------------------------------------------
// Redis connection configuration
// ---------------------------------------------------------------

const REDIS_OPTIONS: RedisOptions = {
  retryStrategy: (times: number) => {
    if (times > 10) {
      logger.error('Redis: max reconnection attempts reached')
      return null // Stop retrying
    }
    const delay = Math.min(times * 100, 3000)
    logger.warn({ attempt: times, delay }, 'Redis: retrying connection')
    return delay
  },
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true, // Don't connect until needed
}

// Singleton Redis instance (shared cache/session store)
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
  redisQueue: Redis | undefined
}

function createRedisClient(url: string, name: string): Redis {
  const client = new Redis(url, REDIS_OPTIONS)

  client.on('connect', () => logger.info({ name }, 'Redis: connected'))
  client.on('ready', () => logger.info({ name }, 'Redis: ready'))
  client.on('error', (err) => logger.error({ name, err }, 'Redis: error'))
  client.on('close', () => logger.warn({ name }, 'Redis: connection closed'))
  client.on('reconnecting', () => logger.info({ name }, 'Redis: reconnecting'))

  return client
}

export const redis: Redis =
  globalForRedis.redis ??
  createRedisClient(env.REDIS_URL, 'main')

// Separate connection for BullMQ queues (recommended by BullMQ)
export const redisQueue: Redis =
  globalForRedis.redisQueue ??
  createRedisClient(env.REDIS_QUEUE_URL ?? env.REDIS_URL, 'queue')

if (env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis
  globalForRedis.redisQueue = redisQueue
}

// ---------------------------------------------------------------
// Cache utilities
// ---------------------------------------------------------------

const DEFAULT_TTL = 300 // 5 minutes

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key)
      if (!value) return null
      return JSON.parse(value) as T
    } catch (err) {
      logger.error({ err, key }, 'Cache: get error')
      return null
    }
  },

  async set<T>(key: string, value: T, ttlSeconds: number = DEFAULT_TTL): Promise<void> {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value))
    } catch (err) {
      logger.error({ err, key }, 'Cache: set error')
    }
  },

  async del(key: string): Promise<void> {
    try {
      await redis.del(key)
    } catch (err) {
      logger.error({ err, key }, 'Cache: del error')
    }
  },

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (err) {
      logger.error({ err, pattern }, 'Cache: delPattern error')
    }
  },
}

// ---------------------------------------------------------------
// Session store (refresh tokens)
// ---------------------------------------------------------------

const SESSION_PREFIX = 'refresh:'

export const sessionStore = {
  // Store refresh token: key = refresh:{userId}:{tokenId}
  async set(userId: string, tokenId: string, ttlSeconds: number): Promise<void> {
    const key = `${SESSION_PREFIX}${userId}:${tokenId}`
    await redis.setex(key, ttlSeconds, '1')
  },

  // Validate refresh token exists
  async exists(userId: string, tokenId: string): Promise<boolean> {
    const key = `${SESSION_PREFIX}${userId}:${tokenId}`
    const exists = await redis.exists(key)
    return exists === 1
  },

  // Invalidate single refresh token (logout)
  async invalidate(userId: string, tokenId: string): Promise<void> {
    const key = `${SESSION_PREFIX}${userId}:${tokenId}`
    await redis.del(key)
  },

  // Invalidate all refresh tokens for a user (logout all devices)
  async invalidateAll(userId: string): Promise<void> {
    await cache.delPattern(`${SESSION_PREFIX}${userId}:*`)
  },
}

// ---------------------------------------------------------------
// Rate limiting (sliding window counter)
// ---------------------------------------------------------------

export async function rateLimitCheck(
  key: string,
  windowSeconds: number,
  maxRequests: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = Date.now()
  const windowStart = now - windowSeconds * 1000

  // Lua script for atomic sliding window rate limit
  const luaScript = `
    local key = KEYS[1]
    local window_start = tonumber(ARGV[1])
    local now = tonumber(ARGV[2])
    local max_requests = tonumber(ARGV[3])
    local window_seconds = tonumber(ARGV[4])

    -- Remove old entries outside the window
    redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

    -- Count current requests
    local count = redis.call('ZCARD', key)

    if count < max_requests then
      -- Add current request (use now + random suffix to prevent millisecond collisions — S-04)
      redis.call('ZADD', key, now, now .. ':' .. tostring(math.random()))
      redis.call('EXPIRE', key, window_seconds)
      return {1, max_requests - count - 1}
    else
      return {0, 0}
    end
  `

  const result = (await redis.eval(
    luaScript,
    1,
    key,
    windowStart.toString(),
    now.toString(),
    maxRequests.toString(),
    windowSeconds.toString()
  )) as [number, number]

  return {
    allowed: result[0] === 1,
    remaining: result[1] ?? 0,
    resetAt: new Date(now + windowSeconds * 1000),
  }
}

// ---------------------------------------------------------------
// BullMQ Queue definitions (E1-S03)
// ---------------------------------------------------------------

const QUEUE_OPTIONS: QueueOptions = {
  connection: redisQueue,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
}

export const queues = {
  // Data ingestion queues (one per external source)
  ingestionFbi: new Queue('ingestion-fbi', QUEUE_OPTIONS),
  ingestionInterpol: new Queue('ingestion-interpol', QUEUE_OPTIONS),
  ingestionNcmec: new Queue('ingestion-ncmec', QUEUE_OPTIONS),
  ingestionAmber: new Queue('ingestion-amber', QUEUE_OPTIONS),
  ingestionOpensanctions: new Queue('ingestion-opensanctions', QUEUE_OPTIONS),
  ingestionCnpd: new Queue('ingestion-cnpd', QUEUE_OPTIONS),
  ingestionDisque100: new Queue('ingestion-disque100', QUEUE_OPTIONS),
  ingestionGdelt: new Queue('ingestion-gdelt', QUEUE_OPTIONS),
  // Processing queues
  embeddingGeneration: new Queue('embedding-generation', QUEUE_OPTIONS),
  alertDistribution: new Queue('alert-distribution', QUEUE_OPTIONS),
  faceMatch: new Queue('face-match', QUEUE_OPTIONS),
  // HITL validation queue (Sprint 5) — managed by validation-queue.ts
  hitlValidation: new Queue('hitl-validation', QUEUE_OPTIONS),
}

// Health check for Redis connection
export async function checkRedisHealth(): Promise<{
  status: 'healthy' | 'unhealthy'
  latencyMs: number
  error?: string
}> {
  const start = Date.now()
  try {
    await redis.ping()
    return { status: 'healthy', latencyMs: Date.now() - start }
  } catch (err) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
