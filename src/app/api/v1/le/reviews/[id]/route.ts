import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { writeAuditLog, getIpFromHeaders } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'

// =============================================================
// PATCH /api/v1/le/reviews/[id] — Approve/reject a face match (HITL)
// Sprint 7 — LE-02
// Auth: law_enforcement or admin required
// Audit: all decisions logged immutably
// =============================================================

const reviewDecisionSchema = z.object({
  decision: z.enum(['confirmed', 'rejected', 'escalated']),
  notes: z.string().max(2000).optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const authResult = requireRole(request, 'law_enforcement')
  if (authResult instanceof NextResponse) return authResult

  try {
    const match = await db.match.findUnique({
      where: { id },
      include: {
        matchedPerson: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            approximateAge: true,
            ageAtDisappearance: true,
            gender: true,
            hairColor: true,
            eyeColor: true,
            skinTone: true,
            distinguishingMarks: true,
            images: {
              select: {
                id: true,
                storageUrl: true,
                thumbnailUrl: true,
                imageType: true,
                isPrimary: true,
              },
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            },
            faceEmbeddings: {
              select: {
                estimatedAge: true,
                estimatedGender: true,
                skinToneCategory: true,
                faceQuality: true,
              },
              take: 1,
            },
          },
        },
        matchedCase: {
          select: {
            id: true,
            caseNumber: true,
            urgency: true,
            status: true,
            source: true,
            lastSeenLocation: true,
            lastSeenAt: true,
            circumstances: true,
          },
        },
        reviewer: {
          select: { id: true, fullName: true },
        },
        requestedBy: {
          select: { id: true, fullName: true },
        },
        sighting: {
          select: {
            id: true,
            description: true,
            locationText: true,
            seenAt: true,
            photoUrl: true,
          },
        },
      },
    })

    if (!match) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Match not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        match: {
          ...match,
          requestedAt: match.requestedAt.toISOString(),
          reviewedAt: match.reviewedAt?.toISOString() ?? null,
          createdAt: match.createdAt.toISOString(),
          updatedAt: match.updatedAt.toISOString(),
          matchedCase: match.matchedCase
            ? {
                ...match.matchedCase,
                lastSeenAt: match.matchedCase.lastSeenAt?.toISOString() ?? null,
              }
            : null,
          sighting: match.sighting
            ? {
                ...match.sighting,
                seenAt: match.sighting.seenAt?.toISOString() ?? null,
              }
            : null,
        },
      },
    })
  } catch (err) {
    logger.error({ err, id }, 'LE Reviews GET[id]: failed')
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

  // Require LE or admin to review matches
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

  const validation = reviewDecisionSchema.safeParse(body)
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

  const { decision, notes } = validation.data

  try {
    // Fetch existing match
    const existing = await db.match.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Match not found' } },
        { status: 404 }
      )
    }

    // Prevent re-review of already decided matches (unless escalated)
    if (existing.reviewStatus !== 'pending' && existing.reviewStatus !== 'escalated') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ErrorCodes.CONFLICT,
            message: `Match already reviewed with status: ${existing.reviewStatus}`,
          },
        },
        { status: 409 }
      )
    }

    // Map decision to review status
    const reviewStatus = decision === 'confirmed'
      ? 'approved' as const
      : decision === 'rejected'
      ? 'rejected' as const
      : 'escalated' as const

    // Determine action taken for confirmed matches
    const actionTaken = decision === 'confirmed' ? 'le_notified' as const : undefined

    const updated = await db.match.update({
      where: { id },
      data: {
        reviewStatus,
        reviewerId: authResult.userId,
        reviewedAt: new Date(),
        reviewNotes: notes ?? null,
        ...(actionTaken ? { actionTaken } : {}),
      },
    })

    // Write immutable audit log — NON-NEGOTIABLE for HITL
    writeAuditLog({
      userId: authResult.userId,
      action: 'hitl.review',
      resourceType: 'match',
      resourceId: id,
      details: {
        decision,
        reviewStatus,
        notes,
        previousStatus: existing.reviewStatus,
        similarityScore: existing.similarityScore,
        confidenceTier: existing.confidenceTier,
        matchedPersonId: existing.matchedPersonId,
        matchedCaseId: existing.matchedCaseId,
      },
      ipAddress: ip,
      userAgent,
    })

    logger.info(
      {
        matchId: id,
        decision,
        reviewerId: authResult.userId,
        similarityScore: existing.similarityScore,
      },
      'HITL review completed'
    )

    return NextResponse.json({
      success: true,
      data: {
        match: {
          id: updated.id,
          reviewStatus: updated.reviewStatus,
          reviewedAt: updated.reviewedAt?.toISOString() ?? null,
          reviewNotes: updated.reviewNotes,
          actionTaken: updated.actionTaken,
        },
        message:
          decision === 'confirmed'
            ? 'Correspondencia confirmada. Autoridades serao notificadas.'
            : decision === 'rejected'
            ? 'Correspondencia rejeitada.'
            : 'Match escalado para supervisor.',
      },
    })
  } catch (err) {
    logger.error({ err, id }, 'LE Reviews PATCH[id]: failed')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to submit review' } },
      { status: 500 }
    )
  }
}
