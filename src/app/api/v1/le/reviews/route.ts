import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'

// =============================================================
// GET /api/v1/le/reviews — List pending face match reviews (HITL)
// Sprint 7 — LE-02
// Auth: law_enforcement or admin required
// =============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = requireRole(request, 'law_enforcement')
  if (authResult instanceof NextResponse) return authResult

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))
  const status = searchParams.get('status') ?? 'pending'

  try {
    const where = {
      reviewStatus: status as 'pending' | 'approved' | 'rejected' | 'escalated' | 'expired',
    }

    const [total, matches] = await Promise.all([
      db.match.count({ where }),
      db.match.findMany({
        where,
        include: {
          matchedPerson: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              approximateAge: true,
              images: {
                where: { isPrimary: true },
                select: { storageUrl: true, thumbnailUrl: true },
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
            },
          },
          reviewer: {
            select: { id: true, fullName: true },
          },
          requestedBy: {
            select: { id: true, fullName: true },
          },
        },
        orderBy: [
          { requestedAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const serialized = matches.map((m) => ({
      id: m.id,
      queryImageUrl: m.queryImageUrl,
      querySource: m.querySource,
      similarityScore: m.similarityScore,
      confidenceTier: m.confidenceTier,
      thresholdUsed: m.thresholdUsed,
      reviewStatus: m.reviewStatus,
      reviewNotes: m.reviewNotes,
      reviewedAt: m.reviewedAt?.toISOString() ?? null,
      reviewer: m.reviewer,
      requestedBy: m.requestedBy,
      requestedAt: m.requestedAt.toISOString(),
      matchedPerson: m.matchedPerson
        ? {
            id: m.matchedPerson.id,
            name: `${m.matchedPerson.firstName ?? ''} ${m.matchedPerson.lastName ?? ''}`.trim() || 'Desconhecido',
            approximateAge: m.matchedPerson.approximateAge,
            imageUrl: m.matchedPerson.images[0]?.storageUrl ?? m.matchedPerson.images[0]?.thumbnailUrl ?? null,
          }
        : null,
      matchedCase: m.matchedCase
        ? {
            id: m.matchedCase.id,
            caseNumber: m.matchedCase.caseNumber,
            urgency: m.matchedCase.urgency,
            status: m.matchedCase.status,
          }
        : null,
      createdAt: m.createdAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        matches: serialized,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    logger.error({ err }, 'LE Reviews GET: failed to list matches')
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to fetch review queue' },
      },
      { status: 500 }
    )
  }
}
