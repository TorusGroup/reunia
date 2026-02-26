import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { suggestNames } from '@/services/search/search-engine'
import { getCachedSuggestions, setCachedSuggestions } from '@/services/search/cache'
import { rateLimitCheck } from '@/lib/redis'
import { getIpFromHeaders } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'

// =============================================================
// GET /api/v1/search/suggest?q=
// Autocomplete for person name search
// Sprint 3 — E3-S01 (autocomplete requirement)
//
// Performance target: < 100ms p95
// Returns up to 5 name suggestions with case ID
// =============================================================

const suggestSchema = z.object({
  q: z.string().min(2, 'Query must be at least 2 characters').max(100).trim(),
})

// Suggest has a stricter rate limit (it's called per keystroke)
const SUGGEST_RATE_LIMIT = { window: 60, max: 120 }

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ip = getIpFromHeaders(request.headers)
  const startMs = Date.now()

  // Rate limit suggest endpoint (higher frequency due to debounced typing)
  const rateLimitKey = `ratelimit:suggest:${ip ?? 'unknown'}`
  const { allowed, remaining, resetAt } = await rateLimitCheck(
    rateLimitKey,
    SUGGEST_RATE_LIMIT.window,
    SUGGEST_RATE_LIMIT.max
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
      { status: 429 }
    )
  }

  // Validate input
  const { searchParams } = new URL(request.url)
  const rawParams = Object.fromEntries(searchParams.entries())

  const validation = suggestSchema.safeParse(rawParams)
  if (!validation.success) {
    // Return empty suggestions for invalid queries (don't error — user is still typing)
    return NextResponse.json({
      success: true,
      data: { suggestions: [] },
    })
  }

  const { q } = validation.data

  try {
    // Try cache first
    const cached = await getCachedSuggestions(q)
    if (cached) {
      return NextResponse.json(
        {
          success: true,
          data: {
            suggestions: cached,
            took: Date.now() - startMs,
            fromCache: true,
          },
        },
        {
          headers: {
            'X-RateLimit-Remaining': remaining.toString(),
            'X-Cache': 'HIT',
          },
        }
      )
    }

    // Execute suggest query
    const results = await suggestNames(q)

    // Deduplicate by name (keep highest similarity)
    const seen = new Set<string>()
    const suggestions: string[] = []
    for (const result of results) {
      const normalized = result.name.toLowerCase()
      if (!seen.has(normalized) && suggestions.length < 5) {
        seen.add(normalized)
        suggestions.push(result.name)
      }
    }

    // Cache suggestions (async)
    setCachedSuggestions(q, suggestions).catch((err) =>
      logger.warn({ err }, 'Failed to cache suggestions')
    )

    const durationMs = Date.now() - startMs

    return NextResponse.json(
      {
        success: true,
        data: {
          suggestions,
          took: durationMs,
          fromCache: false,
        },
      },
      {
        headers: {
          'X-RateLimit-Remaining': remaining.toString(),
          'X-Cache': 'MISS',
          'X-Search-Took': durationMs.toString(),
        },
      }
    )
  } catch (err) {
    logger.error({ err, query: q }, 'Suggest failed')
    // Return empty rather than error — autocomplete failures should be silent
    return NextResponse.json({
      success: true,
      data: { suggestions: [], took: Date.now() - startMs, fromCache: false },
    })
  }
}
