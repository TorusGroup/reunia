import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { extractAuth, requireAuth } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'
import { updateSubscription, unsubscribe } from '@/services/alerts/subscription-manager'

// =============================================================
// GET    /api/v1/alerts/[id]  — Get subscription details
// PATCH  /api/v1/alerts/[id]  — Update subscription
// DELETE /api/v1/alerts/[id]  — Unsubscribe
// Sprint 6 — E6-S05
// =============================================================

const patchSchema = z.object({
  radiusKm: z.number().int().min(5).max(500).optional(),
  isActive: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const authResult = requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const subscription = await db.alertSubscription.findUnique({
      where: { id },
      select: {
        id: true,
        channel: true,
        contactIdentifier: true,
        radiusKm: true,
        isActive: true,
        consentGivenAt: true,
        alertCount: true,
        lastAlertedAt: true,
        userId: true,
      },
    })

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Subscription not found' } },
        { status: 404 }
      )
    }

    // Users can only see their own subscriptions (admins can see all)
    if (subscription.userId !== authResult.userId && authResult.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.FORBIDDEN, message: 'Forbidden' } },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true, data: { subscription } })
  } catch (err) {
    logger.error({ err, id }, 'Alerts GET[id]: failed')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
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

  const validation = patchSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.VALIDATION_ERROR, message: 'Validation failed' } },
      { status: 400 }
    )
  }

  try {
    const updated = await updateSubscription(id, authResult.userId, validation.data)
    if (!updated) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Subscription not found' } },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, data: { subscription: updated } })
  } catch (err) {
    if (err instanceof Error && err.message.includes('Forbidden')) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.FORBIDDEN, message: err.message } },
        { status: 403 }
      )
    }
    logger.error({ err, id }, 'Alerts PATCH[id]: failed')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params

  // Support unsubscribe via token (no auth required)
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token') ?? undefined

  const authResult = extractAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const userId = authResult?.userId

  if (!userId && !token) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.UNAUTHORIZED, message: 'Authentication or unsubscribe token required' } },
      { status: 401 }
    )
  }

  try {
    const success = await unsubscribe(id, userId, token)
    if (!success) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Subscription not found' } },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true, data: { message: 'Unsubscribed successfully' } })
  } catch (err) {
    if (err instanceof Error && err.message.includes('Forbidden')) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.FORBIDDEN, message: err.message } },
        { status: 403 }
      )
    }
    logger.error({ err, id }, 'Alerts DELETE[id]: failed')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
