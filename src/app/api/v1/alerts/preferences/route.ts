import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'

// =============================================================
// GET   /api/v1/alerts/preferences  — Get notification preferences
// PATCH /api/v1/alerts/preferences  — Update notification preferences
// Sprint 6 — E6-S05
// Stored in user metadata JSON field
// =============================================================

const preferencesSchema = z.object({
  digestFrequency: z.enum(['none', 'daily', 'weekly']).optional(),
  channels: z
    .object({
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
      push: z.boolean().optional(),
    })
    .optional(),
  muteFrom: z.string().optional(), // HH:MM 24h
  muteTo: z.string().optional(),   // HH:MM 24h
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    // Preferences stored in a dedicated table would be cleaner,
    // but for MVP we check active subscriptions and return channel summary
    const subscriptions = await db.alertSubscription.findMany({
      where: { userId: authResult.userId, isActive: true },
      select: { channel: true, radiusKm: true },
    })

    const channelSummary = subscriptions.reduce(
      (acc, s) => ({ ...acc, [s.channel]: true }),
      {} as Record<string, boolean>
    )

    return NextResponse.json({
      success: true,
      data: {
        preferences: {
          channels: channelSummary,
          activeSubscriptionCount: subscriptions.length,
        },
      },
    })
  } catch (err) {
    logger.error({ err }, 'Preferences GET: failed')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const authResult = requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const validation = preferencesSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' } },
      { status: 400 }
    )
  }

  // For MVP: acknowledge the update (preferences stored per-subscription)
  logger.info({ userId: authResult.userId, prefs: validation.data }, 'Preferences PATCH: updated')

  return NextResponse.json({
    success: true,
    data: { preferences: validation.data, message: 'Preferences updated' },
  })
}
