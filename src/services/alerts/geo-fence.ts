import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// =============================================================
// Geo-Fence — Find subscribers within radius (Sprint 6, E6-S02)
// PostGIS: ST_DWithin on alert_subscriptions.geo
// =============================================================

export interface GeoPoint {
  lat: number
  lng: number
}

export interface SubscriberTarget {
  id: string
  channel: string
  contactIdentifier: string
  userId: string | null
}

/**
 * Find all active alert subscriptions within radiusKm of a point.
 * Falls back to all active subscriptions if no geo data is available.
 */
export async function findSubscribersInRadius(
  center: GeoPoint,
  alertType?: string
): Promise<SubscriberTarget[]> {
  try {
    // Raw SQL to use PostGIS ST_DWithin on the geo GEOGRAPHY column
    // The alert_subscriptions.geo column is managed via raw SQL migration
    const rawSubscribers = await db.$queryRaw<
      Array<{
        id: string
        channel: string
        contact_identifier: string
        user_id: string | null
      }>
    >`
      SELECT
        s.id,
        s.channel,
        s.contact_identifier,
        s.user_id
      FROM alert_subscriptions s
      WHERE s.is_active = true
        AND (
          s.geo IS NULL
          OR ST_DWithin(
            s.geo::geography,
            ST_MakePoint(${center.lng}, ${center.lat})::geography,
            s.radius_km * 1000
          )
        )
      ORDER BY s.created_at ASC
    `

    const subscribers: SubscriberTarget[] = rawSubscribers.map((r) => ({
      id: r.id,
      channel: r.channel,
      contactIdentifier: r.contact_identifier,
      userId: r.user_id,
    }))

    logger.info(
      { subscriberCount: subscribers.length, lat: center.lat, lng: center.lng, alertType },
      'GeoFence: found subscribers in radius'
    )

    return subscribers
  } catch (err) {
    logger.error({ err, center, alertType }, 'GeoFence: query failed, falling back to all active')

    // Fallback: return all active subscriptions (no geo filter)
    const fallback = await db.alertSubscription.findMany({
      where: { isActive: true },
      select: {
        id: true,
        channel: true,
        contactIdentifier: true,
        userId: true,
      },
    })

    return fallback.map((s) => ({
      id: s.id,
      channel: s.channel,
      contactIdentifier: s.contactIdentifier,
      userId: s.userId,
    }))
  }
}

/**
 * Find subscribers for a specific alert based on its geo center.
 * Used by the alert worker to fan-out.
 */
export async function findSubscribersForAlert(alertId: string): Promise<SubscriberTarget[]> {
  const alert = await db.alert.findUnique({
    where: { id: alertId },
    select: { geoCenterLat: true, geoCenterLng: true, alertType: true },
  })

  if (!alert) {
    logger.warn({ alertId }, 'GeoFence: alert not found')
    return []
  }

  if (!alert.geoCenterLat || !alert.geoCenterLng) {
    // No geo — broadcast to all
    logger.info({ alertId }, 'GeoFence: no geo data, broadcasting to all subscribers')
    const all = await db.alertSubscription.findMany({
      where: { isActive: true },
      select: { id: true, channel: true, contactIdentifier: true, userId: true },
    })
    return all.map((s) => ({
      id: s.id,
      channel: s.channel,
      contactIdentifier: s.contactIdentifier,
      userId: s.userId,
    }))
  }

  return findSubscribersInRadius(
    { lat: alert.geoCenterLat, lng: alert.geoCenterLng },
    alert.alertType
  )
}
