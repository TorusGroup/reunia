import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { extractAuth, requireAuth } from '@/lib/api-auth'
import { rateLimitCheck, queues } from '@/lib/redis'
import { getIpFromHeaders } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'
import {
  createSubscription,
  createSubscriptionSchema,
  listUserSubscriptions,
} from '@/services/alerts/subscription-manager'

// =============================================================
// GET  /api/v1/alerts  — List my alert subscriptions (auth)
// POST /api/v1/alerts  — Create alert subscription (public)
// Sprint 6 — E6-S05
// =============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const subscriptions = await listUserSubscriptions(authResult.userId)
    return NextResponse.json({ success: true, data: { subscriptions } })
  } catch (err) {
    logger.error({ err, userId: authResult.userId }, 'Alerts GET: failed to list subscriptions')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getIpFromHeaders(request.headers)

  // Rate limit: 5 subscriptions per hour per IP
  if (ip) {
    const rl = await rateLimitCheck(`alerts:subscribe:${ip}`, 3600, 5)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.RATE_LIMIT_EXCEEDED, message: 'Too many subscription requests' } },
        { status: 429 }
      )
    }
  }

  // Optional auth — subscription can be anonymous
  const authResult = extractAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const userId = authResult?.userId

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const validation = createSubscriptionSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    )
  }

  try {
    const subscription = await createSubscription(
      { ...validation.data, consentIp: ip },
      userId
    )

    return NextResponse.json(
      { success: true, data: { subscription } },
      { status: 201 }
    )
  } catch (err) {
    logger.error({ err }, 'Alerts POST: failed to create subscription')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to create subscription' } },
      { status: 500 }
    )
  }
}
