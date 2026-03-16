import { NextRequest, NextResponse } from 'next/server'
import { search } from '@/services/search/search-engine'
import { searchParamsSchema } from '@/services/search/filters'
import { writeAuditLog, getIpFromHeaders } from '@/lib/audit'
import { rateLimitCheck } from '@/lib/redis'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'

// =============================================================
// GET /api/v1/search
// Unified search: full-text + trigram + geo + filters + pagination
// Sprint 3 — E3-S01, E3-S02, E3-S03, E3-S04, E3-S06
//
// Query params:
//   q, gender, ageMin, ageMax, status, caseType, urgency,
//   source (csv), location, country, lat, lng, radius,
//   hairColor, eyeColor, dateFrom, dateTo,
//   page, limit, sort
// =============================================================

// Rate limits per tier (E3-S04)
const RATE_LIMITS = {
  anonymous:     { window: 60, max: 60 },
  authenticated: { window: 60, max: 120 },
  ngo:           { window: 60, max: 300 },
  law_enforcement: { window: 60, max: 600 },
  admin:         { window: 60, max: 600 },
  family:        { window: 60, max: 120 },
  volunteer:     { window: 60, max: 120 },
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ip = getIpFromHeaders(request.headers)
  const startMs = Date.now()

  // ---------------------------------------------------------------
  // Rate limiting (E3-S04)
  // ---------------------------------------------------------------
  const rateLimitKey = `ratelimit:search:${ip ?? 'unknown'}`
  const limits = RATE_LIMITS.anonymous // anonymous by default (no auth in Sprint 3 search)

  const { allowed, remaining, resetAt } = await rateLimitCheck(
    rateLimitKey,
    limits.window,
    limits.max
  )

  if (!allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.RATE_LIMIT_EXCEEDED,
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil((resetAt.getTime() - Date.now()) / 1000),
        },
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limits.max.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(resetAt.getTime() / 1000).toString(),
          'Retry-After': Math.ceil((resetAt.getTime() - Date.now()) / 1000).toString(),
        },
      }
    )
  }

  // ---------------------------------------------------------------
  // Validate input params
  // ---------------------------------------------------------------
  const { searchParams } = new URL(request.url)
  const rawParams = Object.fromEntries(searchParams.entries())

  const validation = searchParamsSchema.safeParse(rawParams)
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Invalid search parameters',
          details: validation.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    )
  }

  const params = validation.data

  // ---------------------------------------------------------------
  // Execute search
  // ---------------------------------------------------------------
  try {
    const response = await search(params)

    const durationMs = Date.now() - startMs

    // ---------------------------------------------------------------
    // Audit logging (E3-S06, E1-S07)
    // ---------------------------------------------------------------
    writeAuditLog({
      action: 'cases.search',
      resourceType: 'case',
      details: {
        query: params.q ? params.q.slice(0, 50) : null,
        filters: response.filters,
        resultCount: response.total,
        durationMs,
        page: params.page,
        limit: params.limit,
        fromCache: response.fromCache,
        hasGeoFilter: Boolean(params.lat),
      },
      ipAddress: ip,
    })

    // Search log for analytics (async, non-blocking)
    db.searchLog
      .create({
        data: {
          searchType: 'text',
          query: params.q ? params.q.slice(0, 200) : null,
          filters: response.filters as Record<string, unknown>,
          resultCount: response.total,
          durationMs,
          ipAddress: ip,
        },
      })
      .catch((err: unknown) => logger.error({ err }, 'Failed to write search log'))

    return NextResponse.json(
      {
        success: true,
        data: {
          results: response.results,
          total: response.total,
          page: response.page,
          totalPages: response.totalPages,
          took: durationMs,
          fromCache: response.fromCache,
          filters: response.filters,
        },
      },
      {
        headers: {
          'X-RateLimit-Limit': limits.max.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(resetAt.getTime() / 1000).toString(),
          'X-Search-Took': durationMs.toString(),
          ...(response.fromCache ? { 'X-Cache': 'HIT' } : { 'X-Cache': 'MISS' }),
        },
      }
    )
  } catch (err) {
    const durationMs = Date.now() - startMs
    logger.error({ err, params, durationMs }, 'Search failed')

    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'Search failed. Please try again.',
        },
      },
      { status: 500 }
    )
  }
}
