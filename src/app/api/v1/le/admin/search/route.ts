import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { cache } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'

// =============================================================
// GET /api/v1/le/admin/search/analytics
// Search analytics for admins — top queries, zero-result queries,
// latency distribution, searches per day.
// Sprint 3 — E3-S06
//
// Auth: admin or law_enforcement role required
// Cache: 15 minutes TTL
// =============================================================

const ANALYTICS_CACHE_KEY = 'admin:search:analytics'
const ANALYTICS_TTL = 900 // 15 minutes

const analyticsSchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
})

interface SearchAnalytics {
  topQueries: Array<{ query: string; count: number; avgDurationMs: number }>
  zeroResultQueries: Array<{ query: string; count: number }>
  avgLatencyMs: number
  p95LatencyMs: number
  searchesPerDay: Array<{ date: string; count: number }>
  totalSearches: number
  totalZeroResults: number
  generatedAt: string
}

async function buildAnalytics(
  fromDate: Date,
  toDate: Date
): Promise<SearchAnalytics> {
  const cacheKey = `${ANALYTICS_CACHE_KEY}:${fromDate.toISOString().slice(0, 10)}:${toDate.toISOString().slice(0, 10)}`
  const cached = await cache.get<SearchAnalytics>(cacheKey)
  if (cached) return cached

  const [topQueries, zeroResultQueries, latencyStats, searchesPerDay, totalStats] =
    await Promise.all([
      // Top 20 queries by frequency
      db.$queryRaw<
        Array<{ query: string; count: bigint; avg_duration: number }>
      >`
        SELECT
          query,
          COUNT(*) AS count,
          AVG(duration_ms) AS avg_duration
        FROM search_logs
        WHERE
          query IS NOT NULL
          AND query != ''
          AND timestamp BETWEEN ${fromDate} AND ${toDate}
        GROUP BY query
        ORDER BY count DESC
        LIMIT 20
      `,

      // Top 20 zero-result queries
      db.$queryRaw<
        Array<{ query: string; count: bigint }>
      >`
        SELECT
          query,
          COUNT(*) AS count
        FROM search_logs
        WHERE
          query IS NOT NULL
          AND query != ''
          AND result_count = 0
          AND timestamp BETWEEN ${fromDate} AND ${toDate}
        GROUP BY query
        ORDER BY count DESC
        LIMIT 20
      `,

      // Latency percentiles
      db.$queryRaw<
        Array<{ avg_ms: number; p95_ms: number }>
      >`
        SELECT
          AVG(duration_ms) AS avg_ms,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms
        FROM search_logs
        WHERE
          duration_ms IS NOT NULL
          AND timestamp BETWEEN ${fromDate} AND ${toDate}
      `,

      // Searches per day
      db.$queryRaw<
        Array<{ date: string; count: bigint }>
      >`
        SELECT
          TO_CHAR(DATE_TRUNC('day', timestamp), 'YYYY-MM-DD') AS date,
          COUNT(*) AS count
        FROM search_logs
        WHERE timestamp BETWEEN ${fromDate} AND ${toDate}
        GROUP BY DATE_TRUNC('day', timestamp)
        ORDER BY date DESC
        LIMIT 30
      `,

      // Totals
      db.$queryRaw<
        Array<{ total: bigint; zero_results: bigint }>
      >`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE result_count = 0) AS zero_results
        FROM search_logs
        WHERE timestamp BETWEEN ${fromDate} AND ${toDate}
      `,
    ])

  const analytics: SearchAnalytics = {
    topQueries: topQueries.map((r) => ({
      query: r.query,
      count: Number(r.count),
      avgDurationMs: Math.round(r.avg_duration ?? 0),
    })),
    zeroResultQueries: zeroResultQueries.map((r) => ({
      query: r.query,
      count: Number(r.count),
    })),
    avgLatencyMs: Math.round(latencyStats[0]?.avg_ms ?? 0),
    p95LatencyMs: Math.round(latencyStats[0]?.p95_ms ?? 0),
    searchesPerDay: searchesPerDay.map((r) => ({
      date: r.date,
      count: Number(r.count),
    })),
    totalSearches: Number(totalStats[0]?.total ?? 0),
    totalZeroResults: Number(totalStats[0]?.zero_results ?? 0),
    generatedAt: new Date().toISOString(),
  }

  await cache.set(cacheKey, analytics, ANALYTICS_TTL)
  return analytics
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // TODO: In Sprint 4+, add proper auth middleware check for admin/LE role
  // For now, this endpoint is accessible; auth enforcement added with E1-S04 integration

  const { searchParams } = new URL(request.url)
  const rawParams = Object.fromEntries(searchParams.entries())

  const validation = analyticsSchema.safeParse(rawParams)
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Invalid date parameters',
          details: validation.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    )
  }

  // Default: last 30 days
  const toDate = validation.data.to
    ? new Date(validation.data.to)
    : new Date()
  const fromDate = validation.data.from
    ? new Date(validation.data.from)
    : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000)

  try {
    const analytics = await buildAnalytics(fromDate, toDate)
    return NextResponse.json({ success: true, data: analytics })
  } catch (err) {
    logger.error({ err }, 'Search analytics failed')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'Failed to fetch search analytics',
        },
      },
      { status: 500 }
    )
  }
}
