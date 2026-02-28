import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'
import type { Prisma } from '@prisma/client'

// =============================================================
// GET /api/v1/le/cases — LE dashboard: list cases with filters
// Sprint 7 — LE-01
// Auth: law_enforcement or admin required
// =============================================================

const casesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  status: z.enum(['draft', 'pending_review', 'active', 'resolved', 'closed', 'archived']).optional(),
  urgency: z.enum(['critical', 'high', 'standard', 'low']).optional(),
  source: z.string().optional(),
  sortBy: z.enum(['reportedAt', 'urgency', 'status', 'caseNumber']).default('reportedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = requireRole(request, 'law_enforcement')
  if (authResult instanceof NextResponse) return authResult

  const { searchParams } = new URL(request.url)
  const rawParams = Object.fromEntries(searchParams.entries())

  const validation = casesQuerySchema.safeParse(rawParams)
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

  const { page, limit, search, status, urgency, source, sortBy, sortOrder } = validation.data

  try {
    const where: Prisma.CaseWhereInput = {
      ...(status ? { status: status as Prisma.EnumCaseStatusFilter } : {}),
      ...(urgency ? { urgency: urgency as Prisma.EnumCaseUrgencyFilter } : {}),
      ...(source ? { source: source as Prisma.EnumCaseSourceFilter } : {}),
      ...(search
        ? {
            OR: [
              { caseNumber: { contains: search, mode: 'insensitive' } },
              {
                persons: {
                  some: {
                    OR: [
                      { firstName: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
              { lastSeenLocation: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    // Build orderBy — urgency sorts by priority, not alphabetically
    let orderBy: Prisma.CaseOrderByWithRelationInput | Prisma.CaseOrderByWithRelationInput[]
    if (sortBy === 'urgency') {
      // We need to sort by urgency level, then by reportedAt
      orderBy = [{ urgency: sortOrder }, { reportedAt: 'desc' }]
    } else {
      orderBy = { [sortBy]: sortOrder }
    }

    const [total, cases] = await Promise.all([
      db.case.count({ where }),
      db.case.findMany({
        where,
        include: {
          persons: {
            where: { role: 'missing_child' },
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
            take: 1,
          },
          assignedOrg: {
            select: { id: true, name: true, shortName: true },
          },
          _count: {
            select: {
              sightings: true,
              matches: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const serialized = cases.map((c) => {
      const person = c.persons[0]
      return {
        id: c.id,
        caseNumber: c.caseNumber,
        personName: person
          ? `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Desconhecido'
          : 'Desconhecido',
        personAge: person?.approximateAge ?? null,
        personImageUrl:
          person?.images[0]?.thumbnailUrl ?? person?.images[0]?.storageUrl ?? null,
        status: c.status,
        urgency: c.urgency,
        caseType: c.caseType,
        source: c.source,
        lastSeenLocation: c.lastSeenLocation,
        lastSeenAt: c.lastSeenAt?.toISOString() ?? null,
        reportedAt: c.reportedAt.toISOString(),
        assignedOrg: c.assignedOrg
          ? { id: c.assignedOrg.id, name: c.assignedOrg.shortName ?? c.assignedOrg.name }
          : null,
        sightingsCount: c._count.sightings,
        matchesCount: c._count.matches,
        createdAt: c.createdAt.toISOString(),
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        cases: serialized,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    logger.error({ err }, 'LE Cases GET: failed')
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to fetch cases' },
      },
      { status: 500 }
    )
  }
}
