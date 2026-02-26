import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { extractAuth, requireRole } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { rateLimitCheck } from '@/lib/redis'
import { writeAuditLog, getIpFromHeaders } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'
import { triggerAlert } from '@/services/alerts/alert-engine'

// =============================================================
// POST /api/v1/sightings  — Public: report a sighting (rate limited)
// GET  /api/v1/sightings  — volunteer+: list sightings (with filters)
// Sprint 6 — E6-S06
// =============================================================

const createSightingSchema = z.object({
  caseId: z.string().uuid().optional(),
  description: z.string().min(10).max(2000),
  seenAt: z.string().datetime().optional(),
  locationText: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  photoUrl: z.string().url().optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getIpFromHeaders(request.headers)
  const userAgent = request.headers.get('user-agent') ?? undefined

  // Rate limit: 3 sightings per 15 minutes per IP (prevent spam)
  const rl = await rateLimitCheck(`sightings:create:${ip ?? 'unknown'}`, 900, 3)
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.RATE_LIMIT_EXCEEDED, message: 'Too many sighting reports. Please wait before submitting again.' } },
      { status: 429 }
    )
  }

  // Optional auth — public can report anonymously
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

  const validation = createSightingSchema.safeParse(body)
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

  const data = validation.data

  try {
    const sighting = await db.sighting.create({
      data: {
        caseId: data.caseId ?? null,
        reportedById: userId ?? null,
        description: data.description,
        seenAt: data.seenAt ? new Date(data.seenAt) : null,
        locationText: data.locationText ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        photoUrl: data.photoUrl ?? null,
        isAnonymous: !userId,
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
        status: 'pending',
      },
      select: {
        id: true,
        caseId: true,
        status: true,
        description: true,
        locationText: true,
        seenAt: true,
        isAnonymous: true,
        createdAt: true,
      },
    })

    writeAuditLog({
      userId,
      action: 'sightings.create',
      resourceType: 'sighting',
      resourceId: sighting.id,
      details: { caseId: data.caseId, isAnonymous: !userId },
      ipAddress: ip,
      userAgent,
    })

    // Trigger sighting alert if linked to a case
    if (data.caseId) {
      triggerAlert({
        type: 'SIGHTING_REPORT',
        caseId: data.caseId,
        sightingId: sighting.id,
      }).catch((err: unknown) => logger.error({ err, sightingId: sighting.id }, 'Sightings: failed to trigger alert'))
    }

    logger.info({ sightingId: sighting.id, caseId: data.caseId, userId }, 'Sighting reported')

    return NextResponse.json(
      {
        success: true,
        data: {
          sighting: {
            ...sighting,
            seenAt: sighting.seenAt?.toISOString() ?? null,
            createdAt: sighting.createdAt.toISOString(),
          },
          message: 'Avistamento registrado. Nossa equipe irá verificar em breve. Obrigado por ajudar.',
        },
      },
      { status: 201 }
    )
  } catch (err) {
    logger.error({ err }, 'Sightings POST: failed to create sighting')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to create sighting' } },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Require volunteer+ to view sightings
  const authResult = requireRole(request, 'volunteer')
  if (authResult instanceof NextResponse) return authResult

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))
  const status = searchParams.get('status') ?? undefined
  const caseId = searchParams.get('caseId') ?? undefined

  try {
    const where = {
      ...(status ? { status: status as 'pending' | 'reviewing' | 'confirmed' | 'rejected' | 'duplicate' } : {}),
      ...(caseId ? { caseId } : {}),
    }

    const [total, sightings] = await Promise.all([
      db.sighting.count({ where }),
      db.sighting.findMany({
        where,
        include: {
          case: {
            select: { id: true, caseNumber: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        sightings: sightings.map((s) => ({
          ...s,
          // Redact IP from non-admin users
          ipAddress: authResult.role === 'admin' ? s.ipAddress : undefined,
          seenAt: s.seenAt?.toISOString() ?? null,
          reviewedAt: s.reviewedAt?.toISOString() ?? null,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    logger.error({ err }, 'Sightings GET: failed to list sightings')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
