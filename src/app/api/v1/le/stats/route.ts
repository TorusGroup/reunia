import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'

// =============================================================
// GET /api/v1/le/stats — LE Dashboard statistics
// Sprint 7 — LE-01
// Auth: law_enforcement or admin required
// =============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = requireRole(request, 'law_enforcement')
  if (authResult instanceof NextResponse) return authResult

  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [
      activeCases,
      pendingValidations,
      recentMatches,
      resolvedThisMonth,
      recentSightings,
      totalSightingsPending,
    ] = await Promise.all([
      // Active cases count
      db.case.count({
        where: { status: 'active' },
      }),

      // Pending match validations
      db.match.count({
        where: { reviewStatus: 'pending' },
      }),

      // Matches submitted in last 24h
      db.match.count({
        where: {
          requestedAt: { gte: last24h },
        },
      }),

      // Cases resolved this month
      db.case.count({
        where: {
          status: 'resolved',
          resolvedAt: { gte: startOfMonth },
        },
      }),

      // Sightings in last 24h
      db.sighting.count({
        where: {
          createdAt: { gte: last24h },
        },
      }),

      // Pending sightings
      db.sighting.count({
        where: {
          status: { in: ['pending', 'reviewing'] },
        },
      }),
    ])

    // Urgent cases (critical + high, active)
    const urgentCases = await db.case.findMany({
      where: {
        status: 'active',
        urgency: { in: ['critical', 'high'] },
      },
      include: {
        persons: {
          where: { role: 'missing_child' },
          select: {
            firstName: true,
            lastName: true,
            approximateAge: true,
          },
          take: 1,
        },
      },
      orderBy: [
        { urgency: 'asc' }, // critical first (alphabetically before high)
        { reportedAt: 'desc' },
      ],
      take: 10,
    })

    const serializedUrgent = urgentCases.map((c) => {
      const person = c.persons[0]
      const hoursOpen = Math.round(
        (now.getTime() - (c.lastSeenAt ?? c.reportedAt).getTime()) / (1000 * 60 * 60)
      )
      return {
        id: c.id,
        caseNumber: c.caseNumber,
        personName: person
          ? `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Desconhecido'
          : 'Desconhecido',
        urgency: c.urgency,
        lastSeenLocation: c.lastSeenLocation,
        hoursOpen,
        reportedAt: c.reportedAt.toISOString(),
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          activeCases,
          pendingValidations,
          recentMatches,
          resolvedThisMonth,
          recentSightings,
          totalSightingsPending,
        },
        urgentCases: serializedUrgent,
        generatedAt: now.toISOString(),
      },
    })
  } catch (err) {
    logger.error({ err }, 'LE Stats GET: failed')
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to fetch LE stats' },
      },
      { status: 500 }
    )
  }
}
