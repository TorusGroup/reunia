import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cache } from '@/lib/redis'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'

// =============================================================
// GET /api/v1/analytics — Public Analytics Dashboard Data
// Aggregated statistics, no PII exposed
// Cache: 5 minutes
// =============================================================

const ANALYTICS_CACHE_KEY = 'analytics:dashboard'
const ANALYTICS_TTL = 300

interface AnalyticsData {
  overview: {
    totalActiveCases: number
    totalResolvedCases: number
    totalSightings: number
    totalAlertsSent: number
    casesWithPhotos: number
  }
  byCountry: Array<{
    countryCode: string
    count: number
  }>
  bySource: Array<{
    source: string
    count: number
  }>
  byMonth: Array<{
    month: string
    count: number
  }>
  byAgeGroup: Array<{
    group: string
    count: number
  }>
  byGender: Array<{
    gender: string
    count: number
  }>
  byCaseType: Array<{
    caseType: string
    count: number
  }>
  lastUpdated: string
}

export async function GET(): Promise<NextResponse> {
  try {
    // Check cache
    const cached = await cache.get<AnalyticsData>(ANALYTICS_CACHE_KEY)
    if (cached) {
      return NextResponse.json({ success: true, data: cached })
    }

    // Fetch all data in parallel
    const [
      totalActive,
      totalResolved,
      totalSightings,
      totalAlertsSent,
      casesWithPhotos,
      bySourceRaw,
      byCountryRaw,
      byMonthRaw,
      byAgeRaw,
      byGenderRaw,
      byCaseTypeRaw,
    ] = await Promise.all([
      db.case.count({ where: { status: 'active', anonymizedAt: null } }),
      db.case.count({ where: { status: 'resolved', anonymizedAt: null } }),
      db.sighting.count(),
      db.alert.count({ where: { status: 'sent' } }),
      db.case.count({
        where: {
          status: 'active',
          anonymizedAt: null,
          persons: { some: { role: 'missing_child', images: { some: {} } } },
        },
      }),

      // By source
      db.case.groupBy({
        by: ['source'],
        where: { anonymizedAt: null },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      // By country
      db.$queryRaw<Array<{ last_seen_country: string; cnt: bigint }>>`
        SELECT last_seen_country, COUNT(*) as cnt
        FROM cases
        WHERE last_seen_country IS NOT NULL
          AND anonymized_at IS NULL
          AND status = 'active'
        GROUP BY last_seen_country
        ORDER BY cnt DESC
        LIMIT 20
      `,

      // By month (last 12 months)
      db.$queryRaw<Array<{ month: string; cnt: bigint }>>`
        SELECT TO_CHAR(reported_at, 'YYYY-MM') as month, COUNT(*) as cnt
        FROM cases
        WHERE reported_at >= NOW() - INTERVAL '12 months'
          AND anonymized_at IS NULL
        GROUP BY TO_CHAR(reported_at, 'YYYY-MM')
        ORDER BY month ASC
      `,

      // By age group
      db.$queryRaw<Array<{ age_group: string; cnt: bigint }>>`
        SELECT
          CASE
            WHEN approximate_age IS NULL THEN 'Desconhecida'
            WHEN approximate_age < 5 THEN '0-4'
            WHEN approximate_age < 10 THEN '5-9'
            WHEN approximate_age < 13 THEN '10-12'
            WHEN approximate_age < 16 THEN '13-15'
            WHEN approximate_age < 18 THEN '16-17'
            ELSE '18+'
          END AS age_group,
          COUNT(*) as cnt
        FROM persons p
        JOIN cases c ON c.id = p.case_id
        WHERE p.role = 'missing_child'
          AND c.status = 'active'
          AND c.anonymized_at IS NULL
        GROUP BY age_group
        ORDER BY
          CASE age_group
            WHEN '0-4' THEN 1
            WHEN '5-9' THEN 2
            WHEN '10-12' THEN 3
            WHEN '13-15' THEN 4
            WHEN '16-17' THEN 5
            WHEN '18+' THEN 6
            ELSE 7
          END
      `,

      // By gender
      db.$queryRaw<Array<{ gender: string; cnt: bigint }>>`
        SELECT COALESCE(gender, 'unknown') as gender, COUNT(*) as cnt
        FROM persons p
        JOIN cases c ON c.id = p.case_id
        WHERE p.role = 'missing_child'
          AND c.status = 'active'
          AND c.anonymized_at IS NULL
        GROUP BY gender
        ORDER BY cnt DESC
      `,

      // By case type
      db.case.groupBy({
        by: ['caseType'],
        where: { status: 'active', anonymizedAt: null },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ])

    const data: AnalyticsData = {
      overview: {
        totalActiveCases: totalActive,
        totalResolvedCases: totalResolved,
        totalSightings,
        totalAlertsSent,
        casesWithPhotos,
      },
      byCountry: byCountryRaw.map((r) => ({
        countryCode: r.last_seen_country,
        count: Number(r.cnt),
      })),
      bySource: bySourceRaw.map((r) => ({
        source: r.source,
        count: r._count.id,
      })),
      byMonth: byMonthRaw.map((r) => ({
        month: r.month,
        count: Number(r.cnt),
      })),
      byAgeGroup: byAgeRaw.map((r) => ({
        group: r.age_group,
        count: Number(r.cnt),
      })),
      byGender: byGenderRaw.map((r) => ({
        gender: r.gender,
        count: Number(r.cnt),
      })),
      byCaseType: byCaseTypeRaw.map((r) => ({
        caseType: r.caseType,
        count: r._count.id,
      })),
      lastUpdated: new Date().toISOString(),
    }

    await cache.set(ANALYTICS_CACHE_KEY, data, ANALYTICS_TTL)

    return NextResponse.json({ success: true, data })
  } catch (err) {
    logger.error({ err }, 'Analytics query failed')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to fetch analytics' } },
      { status: 500 }
    )
  }
}
