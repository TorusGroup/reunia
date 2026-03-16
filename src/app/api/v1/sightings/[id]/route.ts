import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { writeAuditLog, getIpFromHeaders } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'

// =============================================================
// GET   /api/v1/sightings/[id]  — Get sighting detail (volunteer+)
// PATCH /api/v1/sightings/[id]  — LE/Admin: verify or dismiss sighting
// Sprint 6 — E6-S06
// =============================================================

const patchSightingSchema = z.object({
  status: z.enum(['reviewing', 'confirmed', 'rejected', 'duplicate']),
  reviewNotes: z.string().max(1000).optional(),
  caseId: z.string().uuid().optional(), // Link to case if not already linked
})

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const authResult = requireRole(request, 'volunteer')
  if (authResult instanceof NextResponse) return authResult

  try {
    const sighting = await db.sighting.findUnique({
      where: { id },
      include: {
        case: { select: { id: true, caseNumber: true, urgency: true } },
        reporter: { select: { id: true, fullName: true, role: true } },
        reviewer: { select: { id: true, fullName: true } },
      },
    })

    if (!sighting) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Sighting not found' } },
        { status: 404 }
      )
    }

    // Redact sensitive fields for non-LE users
    const isLE = authResult.role === 'law_enforcement' || authResult.role === 'admin'

    return NextResponse.json({
      success: true,
      data: {
        sighting: {
          ...sighting,
          ipAddress: isLE ? sighting.ipAddress : undefined,
          userAgent: undefined, // Never expose
          seenAt: sighting.seenAt?.toISOString() ?? null,
          reviewedAt: sighting.reviewedAt?.toISOString() ?? null,
          createdAt: sighting.createdAt.toISOString(),
          updatedAt: sighting.updatedAt.toISOString(),
        },
      },
    })
  } catch (err) {
    logger.error({ err, id }, 'Sightings GET[id]: failed')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const ip = getIpFromHeaders(request.headers)
  const userAgent = request.headers.get('user-agent') ?? undefined

  // Require LE or admin to review sightings
  const authResult = requireRole(request, 'law_enforcement')
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

  const validation = patchSightingSchema.safeParse(body)
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

  const { status, reviewNotes, caseId } = validation.data

  try {
    const existing = await db.sighting.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Sighting not found' } },
        { status: 404 }
      )
    }

    const updated = await db.sighting.update({
      where: { id },
      data: {
        status,
        reviewNotes: reviewNotes ?? null,
        reviewerId: authResult.userId,
        reviewedAt: new Date(),
        ...(caseId ? { caseId } : {}),
      },
    })

    writeAuditLog({
      userId: authResult.userId,
      action: 'sightings.review',
      resourceType: 'sighting',
      resourceId: id,
      details: { status, reviewNotes, caseId, previousStatus: existing.status },
      ipAddress: ip,
      userAgent,
    })

    logger.info({ sightingId: id, status, reviewerId: authResult.userId }, 'Sighting reviewed')

    return NextResponse.json({
      success: true,
      data: {
        sighting: {
          ...updated,
          seenAt: updated.seenAt?.toISOString() ?? null,
          reviewedAt: updated.reviewedAt?.toISOString() ?? null,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      },
    })
  } catch (err) {
    logger.error({ err, id }, 'Sightings PATCH[id]: failed')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
