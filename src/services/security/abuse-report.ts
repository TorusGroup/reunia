import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'

// =============================================================
// Abuse Pattern Tracker (E8-S03 — Sprint 7)
// Tracks and surfaces repeated abuse patterns:
// - Repeated false sightings
// - Repeated failed searches with same terms
// - Unusual access patterns
// =============================================================

export type AbusePattern =
  | 'repeated_false_sightings'
  | 'excessive_face_match'
  | 'scraping_pattern'
  | 'credential_stuffing'
  | 'spam_case_registration'
  | 'alert_flood'

export interface AbuseRecord {
  identifier: string // IP or userId
  pattern: AbusePattern
  count: number
  firstSeen: string
  lastSeen: string
}

const ABUSE_KEY = 'abuse:'
const ABUSE_TTL = 7 * 24 * 60 * 60 // 7 days

// Thresholds for each pattern
const ABUSE_THRESHOLDS: Record<AbusePattern, number> = {
  repeated_false_sightings: 3,
  excessive_face_match: 50,
  scraping_pattern: 100,
  credential_stuffing: 20,
  spam_case_registration: 5,
  alert_flood: 10,
}

// ---------------------------------------------------------------
// Record abuse event
// ---------------------------------------------------------------

export async function recordAbuseEvent(
  identifier: string,
  pattern: AbusePattern
): Promise<{ threshold_exceeded: boolean; count: number }> {
  if (!identifier) return { threshold_exceeded: false, count: 0 }

  try {
    const key = `${ABUSE_KEY}${pattern}:${identifier}`
    const now = new Date().toISOString()

    // Increment counter
    const multi = redis.multi()
    multi.hincrby(key, 'count', 1)
    multi.hsetnx(key, 'firstSeen', now)
    multi.hset(key, 'lastSeen', now)
    multi.hset(key, 'pattern', pattern)
    multi.hset(key, 'identifier', identifier)
    multi.expire(key, ABUSE_TTL)

    const results = await multi.exec()
    const count = (results?.[0]?.[1] as number) ?? 0

    const threshold = ABUSE_THRESHOLDS[pattern]
    const threshold_exceeded = count >= threshold

    if (threshold_exceeded) {
      logger.warn(
        { identifier, pattern, count, threshold },
        'Abuse threshold exceeded'
      )
    }

    return { threshold_exceeded, count }
  } catch (err) {
    logger.error({ err, identifier, pattern }, 'Failed to record abuse event')
    return { threshold_exceeded: false, count: 0 }
  }
}

// ---------------------------------------------------------------
// Get abuse record for an identifier
// ---------------------------------------------------------------

export async function getAbuseRecord(
  identifier: string,
  pattern: AbusePattern
): Promise<AbuseRecord | null> {
  try {
    const key = `${ABUSE_KEY}${pattern}:${identifier}`
    const record = await redis.hgetall(key)

    if (!record?.count) return null

    return {
      identifier,
      pattern,
      count: parseInt(record.count, 10),
      firstSeen: record.firstSeen ?? '',
      lastSeen: record.lastSeen ?? '',
    }
  } catch (err) {
    logger.error({ err, identifier, pattern }, 'Failed to get abuse record')
    return null
  }
}

// ---------------------------------------------------------------
// Check if identifier has exceeded threshold
// ---------------------------------------------------------------

export async function hasExceededAbuseThreshold(
  identifier: string,
  pattern: AbusePattern
): Promise<boolean> {
  const record = await getAbuseRecord(identifier, pattern)
  if (!record) return false
  return record.count >= ABUSE_THRESHOLDS[pattern]
}

// ---------------------------------------------------------------
// Clear abuse record (admin action)
// ---------------------------------------------------------------

export async function clearAbuseRecord(
  identifier: string,
  pattern: AbusePattern
): Promise<void> {
  try {
    const key = `${ABUSE_KEY}${pattern}:${identifier}`
    await redis.del(key)
    logger.info({ identifier, pattern }, 'Abuse record cleared')
  } catch (err) {
    logger.error({ err, identifier, pattern }, 'Failed to clear abuse record')
  }
}

// ---------------------------------------------------------------
// Detect scraping pattern based on request frequency
// ---------------------------------------------------------------

export async function detectScrapingPattern(
  identifier: string,
  endpoint: string
): Promise<boolean> {
  const key = `scrape_detect:${identifier}:${endpoint}`
  const count = await redis.incr(key)
  await redis.expire(key, 60) // 1-minute window

  // More than 60 requests/min to same endpoint = scraping
  if (count > 60) {
    await recordAbuseEvent(identifier, 'scraping_pattern')
    return true
  }

  return false
}

// ---------------------------------------------------------------
// Get summary of all abuse events for admin
// ---------------------------------------------------------------

export async function getAbuseStats(): Promise<{
  patterns: Record<AbusePattern, number>
  recentAbusers: string[]
}> {
  try {
    const patterns: Record<string, number> = {}
    const recentAbusers: Set<string> = new Set()

    const allPatterns: AbusePattern[] = [
      'repeated_false_sightings',
      'excessive_face_match',
      'scraping_pattern',
      'credential_stuffing',
      'spam_case_registration',
      'alert_flood',
    ]

    for (const pattern of allPatterns) {
      const keys = await redis.keys(`${ABUSE_KEY}${pattern}:*`)
      patterns[pattern] = keys.length

      // Get top abusers
      for (const key of keys.slice(0, 5)) {
        const identifier = key.replace(`${ABUSE_KEY}${pattern}:`, '')
        recentAbusers.add(identifier)
      }
    }

    return {
      patterns: patterns as Record<AbusePattern, number>,
      recentAbusers: Array.from(recentAbusers).slice(0, 20),
    }
  } catch (err) {
    logger.error({ err }, 'Failed to get abuse stats')
    return {
      patterns: {
        repeated_false_sightings: 0,
        excessive_face_match: 0,
        scraping_pattern: 0,
        credential_stuffing: 0,
        spam_case_registration: 0,
        alert_flood: 0,
      },
      recentAbusers: [],
    }
  }
}
