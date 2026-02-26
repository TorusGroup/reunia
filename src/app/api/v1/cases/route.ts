import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyAccessToken, extractBearerToken } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { writeAuditLog, getIpFromHeaders } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'
import type { UserRole } from '@/types/auth'

// =============================================================
// GET /api/v1/cases — List cases (placeholder — E1-S05)
// POST /api/v1/cases — Create case
// Full implementation in Sprint 4 (E5 stories)
// =============================================================

const searchSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('20'),
  status: z.enum(['draft', 'pending_review', 'active', 'resolved', 'closed', 'archived']).optional(),
  country: z.string().length(2).toUpperCase().optional(),
  urgency: z.enum(['critical', 'high', 'standard', 'low']).optional(),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ip = getIpFromHeaders(request.headers)

  // Auth is optional for public list — unauthenticated gets only active cases
  let userRole: UserRole = 'public'

  const token = extractBearerToken(request.headers.get('authorization'))
  if (token) {
    try {
      const payload = verifyAccessToken(token)
      userRole = payload.role
    } catch {
      // Invalid token — treat as public
    }
  }

  const { searchParams } = new URL(request.url)
  const params = Object.fromEntries(searchParams.entries())
  const validation = searchSchema.safeParse(params)

  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Invalid query parameters',
          details: validation.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    )
  }

  const { page, limit, status, country, urgency } = validation.data
  const skip = (page - 1) * limit

  try {
    // Build where clause based on role
    const whereBase = {
      // Public can only see active cases
      ...(userRole === 'public' || userRole === 'family'
        ? { status: 'active' as const }
        : status
        ? { status: status as 'active' }
        : {}),
      ...(country ? { lastSeenCountry: country } : {}),
      ...(urgency ? { urgency: urgency as 'critical' } : {}),
      // Never show soft-deleted cases to non-admins
      ...(userRole !== 'admin' ? { anonymizedAt: null } : {}),
    }

    const [cases, total] = await Promise.all([
      db.case.findMany({
        where: whereBase,
        select: {
          id: true,
          caseNumber: true,
          caseType: true,
          status: true,
          urgency: true,
          reportedAt: true,
          lastSeenAt: true,
          lastSeenLocation: true,
          lastSeenCountry: true,
          source: true,
          dataQuality: true,
          createdAt: true,
          updatedAt: true,
          persons: {
            select: {
              id: true,
              role: true,
              firstName: true,
              lastName: true,
              nickname: true,
              approximateAge: true,
              dateOfBirth: true,
              gender: true,
              images: {
                where: { isPrimary: true },
                select: { thumbnailUrl: true, storageUrl: true },
                take: 1,
              },
            },
          },
        },
        orderBy: [
          { urgency: 'asc' }, // critical first (enum order)
          { reportedAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      db.case.count({ where: whereBase }),
    ])

    // Audit log search
    writeAuditLog({
      action: 'cases.search',
      resourceType: 'case',
      details: { filters: { status, country, urgency }, resultCount: total, page, limit },
      ipAddress: ip,
    })

    return NextResponse.json({
      success: true,
      data: cases,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    logger.error({ err }, 'Failed to list cases')
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to retrieve cases' },
      },
      { status: 500 }
    )
  }
}
