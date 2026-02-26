import { checkIpReputation, logSuspiciousActivity } from '@/services/security/ip-reputation'
import { checkRateLimit, buildRateLimitHeaders, rateLimitExceededBody } from '@/services/security/rate-limiter'
import { recordAbuseEvent } from '@/services/security/abuse-report'
import { logger } from '@/lib/logger'
import type { UserRole } from '@/types/auth'
import type { RateLimitEndpoint } from '@/services/security/rate-limiter'

// =============================================================
// Anti-Abuse Core Service (E8-S03 — Sprint 7)
// Orchestrates all abuse detection and blocking mechanisms
// =============================================================

export interface AbuseCheckInput {
  ip: string
  userId?: string
  role: UserRole | 'public'
  endpoint: RateLimitEndpoint
}

export interface AbuseCheckResult {
  allowed: boolean
  rateLimitHeaders: Record<string, string>
  errorResponse?: {
    status: number
    body: Record<string, unknown>
  }
}

// ---------------------------------------------------------------
// Main abuse check — call this at the start of sensitive handlers
// ---------------------------------------------------------------

export async function checkForAbuse(
  input: AbuseCheckInput
): Promise<AbuseCheckResult> {
  const identifier = input.userId ?? input.ip

  // 1. Check IP reputation
  const ipRep = await checkIpReputation(input.ip)
  if (ipRep.score === 'blocked') {
    logger.warn({ ip: input.ip, reason: ipRep.reason }, 'Blocked IP attempted access')
    return {
      allowed: false,
      rateLimitHeaders: {},
      errorResponse: {
        status: 403,
        body: {
          success: false,
          error: 'Acesso negado. Por favor, contate o suporte se acredita que isso é um erro.',
          code: 'IP_BLOCKED',
        },
      },
    }
  }

  // 2. Check rate limits
  const rateLimitResult = await checkRateLimit(
    input.endpoint,
    input.role,
    identifier
  )

  const rateLimitHeaders = buildRateLimitHeaders(rateLimitResult)

  if (!rateLimitResult.allowed) {
    // Record violation if not just a temporary limit
    if (rateLimitResult.blocked) {
      await recordAbuseEvent(identifier, 'excessive_face_match')
    }

    logSuspiciousActivity(input.ip, `Rate limit exceeded: ${input.endpoint}`, {
      role: input.role,
      userId: input.userId,
    })

    return {
      allowed: false,
      rateLimitHeaders,
      errorResponse: {
        status: rateLimitResult.blocked ? 403 : 429,
        body: rateLimitExceededBody(rateLimitResult),
      },
    }
  }

  // 3. Log suspicious IP (but still allow)
  if (ipRep.score === 'suspicious') {
    logger.warn(
      { ip: input.ip, reason: ipRep.reason },
      'Suspicious IP accessing endpoint'
    )
  }

  return {
    allowed: true,
    rateLimitHeaders,
  }
}

// ---------------------------------------------------------------
// Flag a false sighting report
// ---------------------------------------------------------------

export async function flagFalseSighting(
  identifier: string,
  sightingId: string
): Promise<void> {
  const result = await recordAbuseEvent(identifier, 'repeated_false_sightings')

  logger.warn(
    { identifier, sightingId, count: result.count },
    'False sighting flagged'
  )

  if (result.threshold_exceeded) {
    logSuspiciousActivity(identifier, 'repeated_false_sightings', {
      sightingId,
      count: result.count,
    })
  }
}

// ---------------------------------------------------------------
// Check if a request should be treated as a bot/scraper
// ---------------------------------------------------------------

export function detectBotSignatures(userAgent: string | null): boolean {
  if (!userAgent) return true // No UA is suspicious

  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl\//i,
    /python-requests/i,
    /axios\/[0-9]/i,
    /go-http-client/i,
    /java\/[0-9]/i,
    /wget\//i,
    /libwww/i,
    /Jakarta/i,
    /okhttp/i,
  ]

  // Allow legitimate bots (search engines)
  const allowedBots = [
    /Googlebot/i,
    /Bingbot/i,
    /DuckDuckBot/i,
    /Slurp/i, // Yahoo
  ]

  if (allowedBots.some((pattern) => pattern.test(userAgent))) {
    return false
  }

  return botPatterns.some((pattern) => pattern.test(userAgent))
}

// ---------------------------------------------------------------
// Generate a secure request fingerprint for deduplication
// ---------------------------------------------------------------

export function buildRequestFingerprint(
  ip: string,
  userAgent: string | null,
  additionalData?: string
): string {
  const base = [ip, userAgent ?? '', additionalData ?? ''].join('|')
  // Simple hash — not cryptographic, just for deduplication
  let hash = 0
  for (let i = 0; i < base.length; i++) {
    const char = base.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}
