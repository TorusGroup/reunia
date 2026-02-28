import Redis, { type RedisOptions } from 'ioredis'
import { Queue, type QueueOptions } from 'bullmq'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

// =============================================================
// Redis Client & BullMQ Job Queues (E1-S03)
// ALL connections are LAZY — nothing connects at import time.
// This prevents build hangs during `next build` page collection.
// =============================================================

// ---------------------------------------------------------------
// Build-phase detection
// During `next build`, webpack/Next.js introspects module exports
// which triggers Proxy get traps. We must guard against this.
// ---------------------------------------------------------------

const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build'

// Properties that webpack/Next.js/Node probe during module introspection
const INTROSPECTION_PROPS = new Set<string | symbol>([
  'then',
  'toJSON',
  'toString',
  'valueOf',
  '$$typeof',
  '__esModule',
  Symbol.toPrimitive,
  Symbol.toStringTag,
  Symbol.iterator,
  Symbol.asyncIterator,
  Symbol.hasInstance,
])

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
  lazyConnect: true,
}

// Singleton Redis instances (lazy — created on first access)
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

// ---------------------------------------------------------------
// Public getters — call these to get the Redis instance
// ---------------------------------------------------------------

export function getRedis(): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = createRedisClient(env.REDIS_URL, 'main')
  }
  return globalForRedis.redis
}

export function getRedisQueue(): Redis {
  if (!globalForRedis.redisQueue) {
    globalForRedis.redisQueue = createRedisClient(env.REDIS_QUEUE_URL ?? env.REDIS_URL, 'queue')
  }
  return globalForRedis.redisQueue
}

// Backward compatibility: named exports that lazily resolve
// IMPORTANT: these must only be used in async contexts (redis.get(), redis.setex(), etc.)
// During build phase, all property accesses return undefined to avoid connection attempts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const redis = new Proxy({} as Redis, {
  get: (_t, p) => {
    if (IS_BUILD || INTROSPECTION_PROPS.has(p)) return undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getRedis() as any)[p]
  },
})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const redisQueue = new Proxy({} as Redis, {
  get: (_t, p) => {
    if (IS_BUILD || INTROSPECTION_PROPS.has(p)) return undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getRedisQueue() as any)[p]
  },
})

// ---------------------------------------------------------------
// Cache utilities
// ---------------------------------------------------------------

const DEFAULT_TTL = 300 // 5 minutes

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await getRedis().get(key)
      if (!value) return null
      return JSON.parse(value) as T
    } catch (err) {
      logger.error({ err, key }, 'Cache: get error')
      return null
    }
  },

  async set<T>(key: string, value: T, ttlSeconds: number = DEFAULT_TTL): Promise<void> {
    try {
      await getRedis().setex(key, ttlSeconds, JSON.stringify(value))
    } catch (err) {
      logger.error({ err, key }, 'Cache: set error')
    }
  },

  async del(key: string): Promise<void> {
    try {
      await getRedis().del(key)
    } catch (err) {
      logger.error({ err, key }, 'Cache: del error')
    }
  },

  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await getRedis().keys(pattern)
      if (keys.length > 0) {
        await getRedis().del(...keys)
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
  async set(userId: string, tokenId: string, ttlSeconds: number): Promise<void> {
    const key = `${SESSION_PREFIX}${userId}:${tokenId}`
    await getRedis().setex(key, ttlSeconds, '1')
  },

  async exists(userId: string, tokenId: string): Promise<boolean> {
    const key = `${SESSION_PREFIX}${userId}:${tokenId}`
    const result = await getRedis().exists(key)
    return result === 1
  },

  async invalidate(userId: string, tokenId: string): Promise<void> {
    const key = `${SESSION_PREFIX}${userId}:${tokenId}`
    await getRedis().del(key)
  },

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

  const luaScript = `
    local key = KEYS[1]
    local window_start = tonumber(ARGV[1])
    local now = tonumber(ARGV[2])
    local max_requests = tonumber(ARGV[3])
    local window_seconds = tonumber(ARGV[4])

    redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
    local count = redis.call('ZCARD', key)

    if count < max_requests then
      redis.call('ZADD', key, now, now .. ':' .. tostring(math.random()))
      redis.call('EXPIRE', key, window_seconds)
      return {1, max_requests - count - 1}
    else
      return {0, 0}
    end
  `

  const result = (await getRedis().eval(
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
// BullMQ Queue definitions — LAZY (created on first access)
// ---------------------------------------------------------------

type QueueMap = {
  ingestionFbi: Queue
  ingestionInterpol: Queue
  ingestionNcmec: Queue
  ingestionAmber: Queue
  ingestionOpensanctions: Queue
  ingestionCnpd: Queue
  ingestionDisque100: Queue
  ingestionGdelt: Queue
  embeddingGeneration: Queue
  alertDistribution: Queue
  faceMatch: Queue
  hitlValidation: Queue
}

const QUEUE_NAMES: Record<keyof QueueMap, string> = {
  ingestionFbi: 'ingestion-fbi',
  ingestionInterpol: 'ingestion-interpol',
  ingestionNcmec: 'ingestion-ncmec',
  ingestionAmber: 'ingestion-amber',
  ingestionOpensanctions: 'ingestion-opensanctions',
  ingestionCnpd: 'ingestion-cnpd',
  ingestionDisque100: 'ingestion-disque100',
  ingestionGdelt: 'ingestion-gdelt',
  embeddingGeneration: 'embedding-generation',
  alertDistribution: 'alert-distribution',
  faceMatch: 'face-match',
  hitlValidation: 'hitl-validation',
}

const queueInstances: Partial<Record<keyof QueueMap, Queue>> = {}

function getQueueOptions(): QueueOptions {
  return {
    connection: getRedisQueue(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  }
}

function getQueue(name: keyof QueueMap): Queue {
  if (!queueInstances[name]) {
    queueInstances[name] = new Queue(QUEUE_NAMES[name], getQueueOptions())
  }
  return queueInstances[name]!
}

export const queues: QueueMap = new Proxy({} as QueueMap, {
  get(_target, prop: string | symbol) {
    if (IS_BUILD || INTROSPECTION_PROPS.has(prop)) return undefined
    if (typeof prop === 'string' && prop in QUEUE_NAMES) {
      return getQueue(prop as keyof QueueMap)
    }
    return undefined
  },
})

// Health check for Redis connection
export async function checkRedisHealth(): Promise<{
  status: 'healthy' | 'unhealthy'
  latencyMs: number
  error?: string
}> {
  const start = Date.now()
  try {
    await getRedis().ping()
    return { status: 'healthy', latencyMs: Date.now() - start }
  } catch (err) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
