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

    // Fetch overview stats with Prisma (safe)
    const [
      totalActive,
      totalResolved,
      totalSightings,
      totalAlertsSent,
      casesWithPhotos,
      bySourceRaw,
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
      db.case.groupBy({
        by: ['source'],
        where: { anonymizedAt: null },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      db.case.groupBy({
        by: ['caseType'],
        where: { status: 'active', anonymizedAt: null },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ])

    // By country — use Prisma groupBy
    let byCountry: Array<{ countryCode: string; count: number }> = []
    try {
      const countryGroups = await db.case.groupBy({
        by: ['lastSeenCountry'],
        where: { status: 'active', anonymizedAt: null, lastSeenCountry: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      })
      byCountry = countryGroups
        .filter((g) => g.lastSeenCountry != null)
        .map((g) => ({
          countryCode: g.lastSeenCountry!,
          count: g._count.id,
        }))
    } catch (err) {
      logger.warn({ err }, 'Analytics: byCountry query failed')
    }

    // By month — use raw SQL with proper enum casting
    let byMonth: Array<{ month: string; count: number }> = []
    try {
      const monthResults = await db.$queryRaw<Array<{ month: string; cnt: bigint }>>`
        SELECT TO_CHAR(reported_at, 'YYYY-MM') as month, COUNT(*) as cnt
        FROM cases
        WHERE reported_at >= NOW() - INTERVAL '12 months'
          AND anonymized_at IS NULL
        GROUP BY TO_CHAR(reported_at, 'YYYY-MM')
        ORDER BY month ASC
      `
      byMonth = monthResults.map((r) => ({
        month: r.month,
        count: Number(r.cnt),
      }))
    } catch (err) {
      logger.warn({ err }, 'Analytics: byMonth query failed')
    }

    // By age group — use raw SQL
    let byAgeGroup: Array<{ group: string; count: number }> = []
    try {
      const ageResults = await db.$queryRaw<Array<{ age_group: string; cnt: bigint }>>`
        SELECT
          CASE
            WHEN p.approximate_age IS NULL THEN 'Desconhecida'
            WHEN p.approximate_age < 5 THEN '0-4'
            WHEN p.approximate_age < 10 THEN '5-9'
            WHEN p.approximate_age < 13 THEN '10-12'
            WHEN p.approximate_age < 16 THEN '13-15'
            WHEN p.approximate_age < 18 THEN '16-17'
            ELSE '18+'
          END AS age_group,
          COUNT(*) as cnt
        FROM persons p
        JOIN cases c ON c.id = p.case_id
        WHERE p.role = 'missing_child'::person_role
          AND c.status = 'active'::case_status
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
      `
      byAgeGroup = ageResults.map((r) => ({
        group: r.age_group,
        count: Number(r.cnt),
      }))
    } catch (err) {
      logger.warn({ err }, 'Analytics: byAgeGroup query failed')
    }

    // By gender — use raw SQL with proper enum casting
    let byGender: Array<{ gender: string; count: number }> = []
    try {
      const genderResults = await db.$queryRaw<Array<{ gender: string; cnt: bigint }>>`
        SELECT COALESCE(p.gender::text, 'unknown') as gender, COUNT(*) as cnt
        FROM persons p
        JOIN cases c ON c.id = p.case_id
        WHERE p.role = 'missing_child'::person_role
          AND c.status = 'active'::case_status
          AND c.anonymized_at IS NULL
        GROUP BY p.gender
        ORDER BY cnt DESC
      `
      byGender = genderResults.map((r) => ({
        gender: r.gender,
        count: Number(r.cnt),
      }))
    } catch (err) {
      logger.warn({ err }, 'Analytics: byGender query failed')
    }

    const data: AnalyticsData = {
      overview: {
        totalActiveCases: totalActive,
        totalResolvedCases: totalResolved,
        totalSightings,
        totalAlertsSent,
        casesWithPhotos,
      },
      byCountry,
      bySource: bySourceRaw.map((r) => ({
        source: r.source,
        count: r._count.id,
      })),
      byMonth,
      byAgeGroup,
      byGender,
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
