import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'

// =============================================================
// GET /api/v1/geo-alerts — List recent geo-alerts (simulated)
// POST /api/v1/geo-alerts — Create alert subscription
// =============================================================

const subscriptionSchema = z.object({
  email: z.string().email('Email inválido'),
  region: z.string().min(2, 'Região é obrigatória'),
  alertTypes: z.array(z.enum(['new_case', 'resolved', 'sighting_nearby'])).min(1, 'Selecione ao menos um tipo'),
})

// GET: List recent alerts (cases from last 7 days, simulating alert feed)
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const region = searchParams.get('region')
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50)

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const where: Record<string, unknown> = {
      status: 'active',
      anonymizedAt: null,
      reportedAt: { gte: sevenDaysAgo },
    }

    if (region) {
      where.lastSeenCountry = region.toUpperCase()
    }

    const recentCases = await db.case.findMany({
      where,
      select: {
        id: true,
        caseNumber: true,
        caseType: true,
        urgency: true,
        reportedAt: true,
        lastSeenLocation: true,
        lastSeenCountry: true,
        source: true,
        persons: {
          where: { role: 'missing_child' },
          take: 1,
          select: {
            firstName: true,
            lastName: true,
            approximateAge: true,
            gender: true,
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { thumbnailUrl: true, storageUrl: true },
            },
          },
        },
      },
      orderBy: { reportedAt: 'desc' },
      take: limit,
    })

    // Format as alert items
    const alerts = recentCases.map((c) => {
      const person = c.persons[0]
      const personName = person
        ? `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Nome desconhecido'
        : 'Nome desconhecido'
      const img = person?.images?.[0]

      return {
        id: c.id,
        type: 'new_case' as const,
        caseNumber: c.caseNumber,
        personName,
        approximateAge: person?.approximateAge ?? null,
        gender: person?.gender ?? null,
        location: c.lastSeenLocation,
        country: c.lastSeenCountry,
        urgency: c.urgency,
        reportedAt: c.reportedAt.toISOString(),
        imageUrl: img?.thumbnailUrl ?? img?.storageUrl ?? null,
        message: `Novo caso: ${personName}${person?.approximateAge ? `, ${person.approximateAge} anos` : ''} — ${c.lastSeenLocation ?? 'local desconhecido'}`,
      }
    })

    // Count total subscriptions for social proof
    const totalSubscribers = await db.alertSubscription.count({ where: { isActive: true } })

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        totalSubscribers,
        period: '7 dias',
      },
    })
  } catch (err) {
    logger.error({ err }, 'Geo-alerts query failed')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to fetch alerts' } },
      { status: 500 }
    )
  }
}

// POST: Create a new subscription (conceptual — stores in AlertSubscription)
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const validation = subscriptionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Dados inválidos',
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { email, region, alertTypes } = validation.data

    // Check if already subscribed
    const existing = await db.alertSubscription.findFirst({
      where: {
        contactIdentifier: email,
        channel: 'email',
        isActive: true,
      },
    })

    if (existing) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'Você já está inscrito para receber alertas.',
          subscriptionId: existing.id,
          alreadySubscribed: true,
        },
      })
    }

    // Create subscription
    const subscription = await db.alertSubscription.create({
      data: {
        channel: 'email',
        contactIdentifier: email,
        radiusKm: 100,
        isActive: true,
        consentGivenAt: new Date(),
        consentIp: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown',
        unsubscribeToken: crypto.randomUUID(),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        message: `Inscrição confirmada! Você receberá alertas para a região ${region}.`,
        subscriptionId: subscription.id,
        alertTypes,
        alreadySubscribed: false,
      },
    })
  } catch (err) {
    logger.error({ err }, 'Geo-alert subscription failed')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Falha ao criar inscrição' } },
      { status: 500 }
    )
  }
}
