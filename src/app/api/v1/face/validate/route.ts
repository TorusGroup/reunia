// =============================================================
// ReunIA — POST /api/v1/face/validate
// HITL: Law enforcement confirms/rejects a face match
// Requires: law_enforcement or admin role
// NON-NEGOTIABLE: families are NEVER notified without this step
// =============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAccessToken, extractBearerToken } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { getIpFromHeaders } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { validateMatch } from '@/services/face/validation-queue'
import { db } from '@/lib/db'
import { ErrorCodes } from '@/types'

const bodySchema = z.object({
  match_id: z.string().uuid('match_id must be a valid UUID'),
  action: z.enum(['confirm', 'reject', 'escalate'], {
    required_error: 'action must be one of: confirm, reject, escalate',
  }),
  review_notes: z.string().min(1).max(2000).optional(),
  review_duration_seconds: z.number().int().positive().optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getIpFromHeaders(request.headers)

  // ---------------------------------------------------------------
  // Auth — HITL review requires law_enforcement or admin
  // ---------------------------------------------------------------
  const token = extractBearerToken(request.headers.get('authorization'))

  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.UNAUTHORIZED, message: 'Authentication required' } },
      { status: 401 }
    )
  }

  let userId: string
  try {
    const payload = verifyAccessToken(token)
    userId = payload.sub

    if (!can(payload.role, 'hitl:review')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ErrorCodes.FORBIDDEN,
            message:
              'HITL review requires law_enforcement or admin role',
          },
        },
        { status: 403 }
      )
    }
  } catch {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INVALID_TOKEN, message: 'Invalid token' } },
      { status: 401 }
    )
  }

  // ---------------------------------------------------------------
  // Body validation
  // ---------------------------------------------------------------
  let body: z.infer<typeof bodySchema>
  try {
    const rawBody = await request.json()
    const result = bodySchema.safeParse(rawBody)
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Invalid request body',
            details: result.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }
    body = result.data
  } catch {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid JSON' } },
      { status: 400 }
    )
  }

  // ---------------------------------------------------------------
  // Verify match exists and is pending review
  // ---------------------------------------------------------------
  const match = await db.match.findUnique({
    where: { id: body.match_id },
    select: { id: true, reviewStatus: true, matchedCaseId: true, matchedPersonId: true },
  })

  if (!match) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Match not found' } },
      { status: 404 }
    )
  }

  if (match.reviewStatus !== 'pending' && match.reviewStatus !== 'escalated') {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.CONFLICT,
          message: `Match is already in status: ${match.reviewStatus}. Can only review pending or escalated matches.`,
        },
      },
      { status: 409 }
    )
  }

  // ---------------------------------------------------------------
  // Validate reject requires notes (ethical requirement)
  // ---------------------------------------------------------------
  if (body.action === 'reject' && !body.review_notes) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Review notes are required when rejecting a match',
        },
      },
      { status: 400 }
    )
  }

  // ---------------------------------------------------------------
  // Record the validation outcome
  // ---------------------------------------------------------------
  try {
    await validateMatch({
      matchId: body.match_id,
      reviewerId: userId,
      action: body.action,
      reviewNotes: body.review_notes,
      reviewDurationSeconds: body.review_duration_seconds,
    })

    logger.info(
      {
        matchId: body.match_id,
        reviewerId: userId,
        action: body.action,
        caseId: match.matchedCaseId,
      },
      'HITL: validation recorded via API'
    )

    return NextResponse.json({
      success: true,
      data: {
        match_id: body.match_id,
        action: body.action,
        reviewed_at: new Date().toISOString(),
        reviewer_id: userId,
        // Downstream notification is handled asynchronously
        notification_queued: body.action === 'confirm',
      },
    })
  } catch (err) {
    logger.error({ err, matchId: body.match_id, userId }, 'POST /api/v1/face/validate: failed')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'Failed to record validation',
        },
      },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------
// GET /api/v1/face/validate — list pending validations
// ---------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = extractBearerToken(request.headers.get('authorization'))

  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.UNAUTHORIZED, message: 'Authentication required' } },
      { status: 401 }
    )
  }

  try {
    const payload = verifyAccessToken(token)

    if (!can(payload.role, 'hitl:review')) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.FORBIDDEN, message: 'Access denied' } },
        { status: 403 }
      )
    }
  } catch {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INVALID_TOKEN, message: 'Invalid token' } },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const skip = (page - 1) * limit

  try {
    const [matches, total] = await Promise.all([
      db.match.findMany({
        where: { reviewStatus: 'pending' },
        select: {
          id: true,
          similarityScore: true,
          confidenceTier: true,
          querySource: true,
          requestedAt: true,
          matchedCase: { select: { caseNumber: true, status: true } },
          matchedPerson: {
            select: {
              firstName: true,
              lastName: true,
              approximateAge: true,
              images: {
                where: { isPrimary: true },
                select: { thumbnailUrl: true },
                take: 1,
              },
            },
          },
        },
        orderBy: [{ similarityScore: 'desc' }, { requestedAt: 'asc' }],
        skip,
        take: limit,
      }),
      db.match.count({ where: { reviewStatus: 'pending' } }),
    ])

    return NextResponse.json({
      success: true,
      data: matches,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    logger.error({ err }, 'GET /api/v1/face/validate: failed to list matches')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to retrieve matches' } },
      { status: 500 }
    )
  }
}
