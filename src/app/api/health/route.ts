import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRedisHealth } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { faceClient } from '@/services/face/face-client'
import type { HealthCheckResponse } from '@/types'

// =============================================================
// GET /api/health
// Health check for all services (E1-S08)
// =============================================================

export async function GET(): Promise<NextResponse<HealthCheckResponse>> {
  const start = Date.now()

  // Check all services in parallel
  const [dbHealth, redisHealth, faceEngineHealth] = await Promise.allSettled([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkFaceEngineHealth(),
  ])

  const services = {
    database:
      dbHealth.status === 'fulfilled'
        ? dbHealth.value
        : { status: 'unhealthy' as const, error: String(dbHealth.reason) },
    redis:
      redisHealth.status === 'fulfilled'
        ? redisHealth.value
        : { status: 'unhealthy' as const, error: String(redisHealth.reason) },
    faceEngine:
      faceEngineHealth.status === 'fulfilled'
        ? faceEngineHealth.value
        : { status: 'unhealthy' as const, error: String(faceEngineHealth.reason) },
  }

  // Overall status: unhealthy if DB is down, degraded if other services are down
  const overallStatus =
    services.database.status === 'unhealthy'
      ? 'unhealthy'
      : services.redis.status === 'unhealthy' || services.faceEngine.status === 'unhealthy'
      ? 'degraded'
      : 'healthy'

  const response: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
    services,
  }

  if (overallStatus !== 'healthy') {
    logger.warn({ services, duration: Date.now() - start }, 'Health check: degraded')
  }

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200
  return NextResponse.json(response, { status: statusCode })
}

async function checkDatabaseHealth() {
  const start = Date.now()
  try {
    await db.$queryRaw`SELECT 1`
    return { status: 'healthy' as const, latencyMs: Date.now() - start }
  } catch (err) {
    return {
      status: 'unhealthy' as const,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Database unreachable',
    }
  }
}

async function checkFaceEngineHealth() {
  const start = Date.now()
  try {
    const health = await faceClient.health()
    const latencyMs = Date.now() - start

    if (health.status === 'healthy') {
      return { status: 'healthy' as const, latencyMs }
    }

    return {
      status: 'unhealthy' as const,
      latencyMs,
      error: `Face service returned status: ${health.status}`,
    }
  } catch (err) {
    return {
      status: 'unhealthy' as const,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Face engine unreachable',
    }
  }
}
