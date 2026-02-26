import { redis } from '@/lib/redis'
import { logger } from '@/lib/logger'

// =============================================================
// IP Reputation Service (E8-S03 — Sprint 7)
// Basic IP reputation tracking — mock in MVP, logs suspicious
// activity for future threat intelligence integration
// =============================================================

export type IpReputationScore = 'clean' | 'suspicious' | 'blocked'

export interface IpReputationResult {
  ip: string
  score: IpReputationScore
  reason?: string
  lastSeen?: Date
  violationCount?: number
}

// Redis key prefixes
const IP_VIOLATION_KEY = 'ip:violations:'
const IP_BLOCKED_KEY = 'ip:blocked:'
const IP_SUSPICIOUS_KEY = 'ip:suspicious:'

// Thresholds
const SUSPICIOUS_THRESHOLD = 10  // violations before flagging suspicious
const BLOCKED_THRESHOLD = 50     // violations before blocking
const BLOCK_TTL = 24 * 60 * 60  // 24 hours block duration

// Known bad IP ranges (placeholder — in production use threat intel feeds)
const KNOWN_BAD_RANGES: RegExp[] = [
  // Tor exit nodes (simplified example)
  // Real implementation would pull from Tor exit node list
]

// ---------------------------------------------------------------
// Check IP reputation
// ---------------------------------------------------------------

export async function checkIpReputation(ip: string): Promise<IpReputationResult> {
  if (!ip || ip === 'unknown') {
    return { ip, score: 'clean' }
  }

  try {
    // Check if explicitly blocked
    const blocked = await redis.get(`${IP_BLOCKED_KEY}${ip}`)
    if (blocked) {
      return {
        ip,
        score: 'blocked',
        reason: JSON.parse(blocked).reason ?? 'Policy violation',
        lastSeen: new Date(),
      }
    }

    // Check violation count
    const violationCount = await redis.get(`${IP_VIOLATION_KEY}${ip}`)
    const count = violationCount ? parseInt(violationCount, 10) : 0

    if (count >= BLOCKED_THRESHOLD) {
      // Auto-block on threshold exceed
      await blockIp(ip, 'Automatic block: violation threshold exceeded')
      return { ip, score: 'blocked', reason: 'Threshold exceeded', violationCount: count }
    }

    if (count >= SUSPICIOUS_THRESHOLD) {
      return { ip, score: 'suspicious', reason: 'Multiple violations', violationCount: count }
    }

    // Check against known bad ranges
    for (const badRange of KNOWN_BAD_RANGES) {
      if (badRange.test(ip)) {
        return { ip, score: 'suspicious', reason: 'Known bad range' }
      }
    }

    return { ip, score: 'clean', violationCount: count }
  } catch (err) {
    logger.error({ err, ip }, 'IP reputation check failed')
    // Fail open — don't block on error
    return { ip, score: 'clean' }
  }
}

// ---------------------------------------------------------------
// Record violation
// ---------------------------------------------------------------

export async function recordIpViolation(
  ip: string,
  reason: string,
  ttlSeconds = 86400
): Promise<void> {
  if (!ip || ip === 'unknown') return

  try {
    const key = `${IP_VIOLATION_KEY}${ip}`
    await redis.multi()
      .incr(key)
      .expire(key, ttlSeconds)
      .exec()

    logger.warn({ ip, reason }, 'IP violation recorded')
  } catch (err) {
    logger.error({ err, ip }, 'Failed to record IP violation')
  }
}

// ---------------------------------------------------------------
// Block IP explicitly
// ---------------------------------------------------------------

export async function blockIp(ip: string, reason: string): Promise<void> {
  if (!ip || ip === 'unknown') return

  try {
    await redis.setex(
      `${IP_BLOCKED_KEY}${ip}`,
      BLOCK_TTL,
      JSON.stringify({ reason, blockedAt: new Date().toISOString() })
    )

    logger.warn({ ip, reason }, 'IP blocked')
  } catch (err) {
    logger.error({ err, ip }, 'Failed to block IP')
  }
}

// ---------------------------------------------------------------
// Unblock IP (admin action)
// ---------------------------------------------------------------

export async function unblockIp(ip: string): Promise<void> {
  try {
    await redis.del(`${IP_BLOCKED_KEY}${ip}`)
    await redis.del(`${IP_VIOLATION_KEY}${ip}`)
    logger.info({ ip }, 'IP unblocked')
  } catch (err) {
    logger.error({ err, ip }, 'Failed to unblock IP')
  }
}

// ---------------------------------------------------------------
// Log suspicious activity (non-blocking)
// ---------------------------------------------------------------

export function logSuspiciousActivity(
  ip: string,
  activity: string,
  details?: Record<string, unknown>
): void {
  logger.warn(
    { ip, activity, details, timestamp: new Date().toISOString() },
    'Suspicious activity detected'
  )

  // Non-blocking: record violation in background
  recordIpViolation(ip, activity).catch(() => {
    // ignore
  })
}
