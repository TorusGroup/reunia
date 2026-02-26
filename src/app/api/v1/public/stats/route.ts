import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cache } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'

// =============================================================
// GET /api/v1/public/stats
// Aggregated, anonymized statistics — no PII
// Sprint 3 — E3-S05
//
// Sub-routes:
//   /api/v1/public/stats                → overview
//   /api/v1/public/stats?by=country     → cases by country
//   /api/v1/public/stats?by=source      → cases by source
//
// Cache: 5 minutes TTL
// Auth: none required
// =============================================================

const STATS_OVERVIEW_CACHE_KEY = 'stats:overview'
const STATS_COUNTRY_CACHE_KEY = 'stats:by-country'
const STATS_SOURCE_CACHE_KEY = 'stats:by-source'
const STATS_TTL = 300 // 5 minutes

interface StatsOverview {
  totalActiveCases: number
  totalResolvedCases: number
  totalCases: number
  totalSources: number
  totalFaceMatchesToday: number
  totalAlertsSent: number
  activeCasesWithPhotos: number
  activeCasesWithEmbeddings: number
  lastUpdated: string
}

interface StatsByCountry {
  countryCode: string
  activeCases: number
  resolvedCases: number
}

interface StatsBySource {
  source: string
  activeCases: number
  resolvedCases: number
  totalCases: number
}

async function getOverviewStats(): Promise<StatsOverview> {
  const cached = await cache.get<StatsOverview>(STATS_OVERVIEW_CACHE_KEY)
  if (cached) return cached

  const [
    totalActive,
    totalResolved,
    totalCases,
    totalSources,
    alertsSent,
    casesWithPhotos,
    casesWithEmbeddings,
    faceMatchesToday,
  ] = await Promise.all([
    db.case.count({ where: { status: 'active', anonymizedAt: null } }),
    db.case.count({ where: { status: 'resolved', anonymizedAt: null } }),
    db.case.count({ where: { anonymizedAt: null, deletionRequested: false } }),
    db.dataSource.count({ where: { isActive: true } }),
    db.alert.count({ where: { status: 'sent' } }),
    db.case.count({
      where: {
        status: 'active',
        anonymizedAt: null,
        persons: {
          some: {
            role: 'missing_child',
            images: { some: {} },
          },
        },
      },
    }),
    db.case.count({
      where: {
        status: 'active',
        anonymizedAt: null,
        persons: {
          some: {
            role: 'missing_child',
            faceEmbeddings: { some: { isSearchable: true } },
          },
        },
      },
    }),
    db.match.count({
      where: {
        requestedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
  ])

  const stats: StatsOverview = {
    totalActiveCases: totalActive,
    totalResolvedCases: totalResolved,
    totalCases,
    totalSources,
    totalFaceMatchesToday: faceMatchesToday,
    totalAlertsSent: alertsSent,
    activeCasesWithPhotos: casesWithPhotos,
    activeCasesWithEmbeddings: casesWithEmbeddings,
    lastUpdated: new Date().toISOString(),
  }

  await cache.set(STATS_OVERVIEW_CACHE_KEY, stats, STATS_TTL)
  return stats
}

async function getStatsByCountry(): Promise<StatsByCountry[]> {
  const cached = await cache.get<StatsByCountry[]>(STATS_COUNTRY_CACHE_KEY)
  if (cached) return cached

  const results = await db.$queryRaw<
    Array<{ last_seen_country: string; status: string; count: bigint }>
  >`
    SELECT
      last_seen_country,
      status,
      COUNT(*) AS count
    FROM cases
    WHERE
      last_seen_country IS NOT NULL
      AND anonymized_at IS NULL
      AND deletion_requested = FALSE
      AND status IN ('active', 'resolved')
    GROUP BY last_seen_country, status
    ORDER BY COUNT(*) DESC
    LIMIT 100
  `

  // Aggregate into per-country objects
  const countryMap = new Map<string, StatsByCountry>()
  for (const row of results) {
    if (!row.last_seen_country) continue
    const existing = countryMap.get(row.last_seen_country) ?? {
      countryCode: row.last_seen_country,
      activeCases: 0,
      resolvedCases: 0,
    }
    if (row.status === 'active') {
      existing.activeCases = Number(row.count)
    } else if (row.status === 'resolved') {
      existing.resolvedCases = Number(row.count)
    }
    countryMap.set(row.last_seen_country, existing)
  }

  const stats = Array.from(countryMap.values()).sort(
    (a, b) => b.activeCases - a.activeCases
  )

  await cache.set(STATS_COUNTRY_CACHE_KEY, stats, STATS_TTL)
  return stats
}

async function getStatsBySource(): Promise<StatsBySource[]> {
  const cached = await cache.get<StatsBySource[]>(STATS_SOURCE_CACHE_KEY)
  if (cached) return cached

  const results = await db.$queryRaw<
    Array<{ source: string; active: bigint; resolved: bigint; total: bigint }>
  >`
    SELECT
      source,
      COUNT(*) FILTER (WHERE status = 'active') AS active,
      COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
      COUNT(*) AS total
    FROM cases
    WHERE
      anonymized_at IS NULL
      AND deletion_requested = FALSE
    GROUP BY source
    ORDER BY COUNT(*) DESC
  `

  const stats: StatsBySource[] = results.map((row) => ({
    source: row.source,
    activeCases: Number(row.active),
    resolvedCases: Number(row.resolved),
    totalCases: Number(row.total),
  }))

  await cache.set(STATS_SOURCE_CACHE_KEY, stats, STATS_TTL)
  return stats
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const by = searchParams.get('by')

  try {
    if (by === 'country') {
      const stats = await getStatsByCountry()
      return NextResponse.json({ success: true, data: stats })
    }

    if (by === 'source') {
      const stats = await getStatsBySource()
      return NextResponse.json({ success: true, data: stats })
    }

    // Default: overview
    const stats = await getOverviewStats()
    return NextResponse.json({ success: true, data: stats })
  } catch (err) {
    logger.error({ err }, 'Stats request failed')
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to fetch statistics' },
      },
      { status: 500 }
    )
  }
}
