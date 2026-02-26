import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { randomBytes } from 'crypto'
import { z } from 'zod'

// =============================================================
// Subscription Manager — CRUD + LGPD consent tracking (Sprint 6)
// =============================================================

export const createSubscriptionSchema = z.object({
  channel: z.enum(['whatsapp', 'sms', 'email', 'push']),
  contactIdentifier: z.string().min(1).max(255),
  radiusKm: z.number().int().min(5).max(500).default(50),
  lat: z.number().optional(),
  lng: z.number().optional(),
  consentIp: z.string().optional(),
})

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>

export interface SubscriptionRecord {
  id: string
  channel: string
  contactIdentifier: string
  radiusKm: number
  isActive: boolean
  consentGivenAt: string
  alertCount: number
  lastAlertedAt: string | null
}

/**
 * Create a new alert subscription with LGPD consent record.
 */
export async function createSubscription(
  input: CreateSubscriptionInput,
  userId?: string
): Promise<SubscriptionRecord> {
  const unsubscribeToken = randomBytes(32).toString('hex')

  const subscription = await db.alertSubscription.create({
    data: {
      channel: input.channel as 'whatsapp' | 'sms' | 'email' | 'push',
      contactIdentifier: input.contactIdentifier,
      radiusKm: input.radiusKm,
      isActive: true,
      consentGivenAt: new Date(),
      consentIp: input.consentIp ?? null,
      unsubscribeToken,
      userId: userId ?? null,
    },
  })

  // LGPD: Record consent for data processing
  await db.consentRecord.create({
    data: {
      dataSubjectId: subscription.id,
      dataSubjectType: 'alert_subscription',
      userId: userId ?? null,
      purpose: 'alert_notifications',
      legalBasis: 'consent',
      consentGiven: true,
      consentGivenAt: new Date(),
      ipAddress: input.consentIp ?? null,
      privacyPolicyVersion: '1.0',
      metadata: {
        channel: input.channel,
        radiusKm: input.radiusKm,
      },
    },
  })

  logger.info(
    { subscriptionId: subscription.id, channel: input.channel, userId },
    'SubscriptionManager: subscription created with LGPD consent'
  )

  return serializeSubscription(subscription)
}

/**
 * Update subscription (radius, active status).
 */
export async function updateSubscription(
  id: string,
  userId: string | undefined,
  updates: { radiusKm?: number; isActive?: boolean }
): Promise<SubscriptionRecord | null> {
  const existing = await db.alertSubscription.findUnique({ where: { id } })

  if (!existing) return null
  if (userId && existing.userId !== userId) {
    throw new Error('Forbidden: not your subscription')
  }

  const updated = await db.alertSubscription.update({
    where: { id },
    data: {
      ...(updates.radiusKm !== undefined ? { radiusKm: updates.radiusKm } : {}),
      ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
    },
  })

  return serializeSubscription(updated)
}

/**
 * Unsubscribe (LGPD: record consent revocation).
 */
export async function unsubscribe(
  id: string,
  userId?: string,
  token?: string
): Promise<boolean> {
  const existing = await db.alertSubscription.findUnique({ where: { id } })
  if (!existing) return false

  // Verify ownership: userId OR unsubscribe token
  const ownedByUser = userId && existing.userId === userId
  const validToken = token && existing.unsubscribeToken === token
  if (!ownedByUser && !validToken) {
    throw new Error('Forbidden: cannot unsubscribe — invalid token or ownership')
  }

  await db.alertSubscription.update({
    where: { id },
    data: { isActive: false, unsubscribedAt: new Date() },
  })

  // LGPD: Record consent revocation
  await db.consentRecord.create({
    data: {
      dataSubjectId: id,
      dataSubjectType: 'alert_subscription',
      userId: userId ?? null,
      purpose: 'alert_notifications',
      legalBasis: 'consent',
      consentGiven: false,
      consentRevokedAt: new Date(),
      metadata: { reason: 'user_unsubscribed' },
    },
  })

  logger.info({ subscriptionId: id, userId }, 'SubscriptionManager: unsubscribed + LGPD consent revoked')
  return true
}

/**
 * List subscriptions for a user.
 */
export async function listUserSubscriptions(userId: string): Promise<SubscriptionRecord[]> {
  const subs = await db.alertSubscription.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'desc' },
  })
  return subs.map(serializeSubscription)
}

// ---------------------------------------------------------------
// Private
// ---------------------------------------------------------------

function serializeSubscription(s: {
  id: string
  channel: string
  contactIdentifier: string
  radiusKm: number
  isActive: boolean
  consentGivenAt: Date
  alertCount: number
  lastAlertedAt: Date | null
}): SubscriptionRecord {
  return {
    id: s.id,
    channel: s.channel,
    contactIdentifier: s.contactIdentifier,
    radiusKm: s.radiusKm,
    isActive: s.isActive,
    consentGivenAt: s.consentGivenAt.toISOString(),
    alertCount: s.alertCount,
    lastAlertedAt: s.lastAlertedAt?.toISOString() ?? null,
  }
}
