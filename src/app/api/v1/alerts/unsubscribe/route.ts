import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'

// =============================================================
// GET /api/v1/alerts/unsubscribe?token=xxx  — Token-based unsubscribe
// Designed for one-click unsubscribe from email/SMS links.
// No auth required — the unsubscribe token IS the auth.
// Sprint 6 — AL-01
// =============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token || token.length < 16) {
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid or missing unsubscribe token' },
      },
      { status: 400 }
    )
  }

  try {
    const subscription = await db.alertSubscription.findUnique({
      where: { unsubscribeToken: token },
      select: { id: true, isActive: true, channel: true, contactIdentifier: true },
    })

    if (!subscription) {
      return NextResponse.json(
        {
          success: false,
          error: { code: ErrorCodes.NOT_FOUND, message: 'Subscription not found or already unsubscribed' },
        },
        { status: 404 }
      )
    }

    if (!subscription.isActive) {
      // Already unsubscribed — idempotent success
      return NextResponse.json({
        success: true,
        data: { message: 'Inscrição já foi cancelada anteriormente.' },
      })
    }

    // Deactivate subscription
    await db.alertSubscription.update({
      where: { id: subscription.id },
      data: {
        isActive: false,
        unsubscribedAt: new Date(),
      },
    })

    // LGPD: Record consent revocation
    await db.consentRecord.create({
      data: {
        dataSubjectId: subscription.id,
        dataSubjectType: 'alert_subscription',
        purpose: 'alert_notifications',
        legalBasis: 'consent',
        consentGiven: false,
        consentRevokedAt: new Date(),
        metadata: { reason: 'one_click_unsubscribe', channel: subscription.channel },
      },
    })

    logger.info(
      { subscriptionId: subscription.id, channel: subscription.channel },
      'Unsubscribe: one-click unsubscribe via token'
    )

    return NextResponse.json({
      success: true,
      data: {
        message: 'Inscrição cancelada com sucesso. Você não receberá mais alertas neste canal.',
        channel: subscription.channel,
      },
    })
  } catch (err) {
    logger.error({ err }, 'Unsubscribe GET: failed')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
