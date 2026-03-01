import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'

// =============================================================
// GET /api/v1/cases/[id]/similar — Similarity Engine
// Finds similar cases based on geography, age, period, source
// =============================================================

interface SimilarCase {
  id: string
  caseNumber: string
  personName: string
  approximateAge: number | null
  lastSeenLocation: string | null
  lastSeenCountry: string | null
  reportedAt: string
  source: string
  primaryImageUrl: string | null
  similarityScore: number
  matchReasons: string[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid case ID' } },
      { status: 400 }
    )
  }

  try {
    // Get the reference case
    const refCase = await db.case.findUnique({
      where: { id },
      include: {
        persons: {
          where: { role: 'missing_child' },
          take: 1,
          select: {
            approximateAge: true,
            gender: true,
            dateOfBirth: true,
          },
        },
      },
    })

    if (!refCase) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Case not found' } },
        { status: 404 }
      )
    }

    const refPerson = refCase.persons[0]
    const refAge = refPerson?.approximateAge
    const refGender = refPerson?.gender
    const refDate = refCase.lastSeenAt ?? refCase.reportedAt
    const refCountry = refCase.lastSeenCountry

    // Fetch candidate cases (active, not the same case)
    const candidates = await db.case.findMany({
      where: {
        id: { not: id },
        status: 'active',
        anonymizedAt: null,
      },
      include: {
        persons: {
          where: { role: 'missing_child' },
          take: 1,
          select: {
            firstName: true,
            lastName: true,
            approximateAge: true,
            gender: true,
            dateOfBirth: true,
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { thumbnailUrl: true, storageUrl: true },
            },
          },
        },
      },
      take: 200,
      orderBy: { reportedAt: 'desc' },
    })

    // Score each candidate
    const scored: SimilarCase[] = candidates
      .map((c) => {
        let score = 0
        const reasons: string[] = []
        const person = c.persons[0]

        // Geographic similarity
        if (refCountry && c.lastSeenCountry === refCountry) {
          score += 30
          reasons.push('Mesma região geográfica')
        }

        // Age similarity (within 3 years)
        const candidateAge = person?.approximateAge
        if (refAge && candidateAge) {
          const ageDiff = Math.abs(refAge - candidateAge)
          if (ageDiff <= 2) {
            score += 25
            reasons.push(`Faixa etária similar (diferença de ${ageDiff} ano${ageDiff !== 1 ? 's' : ''})`)
          } else if (ageDiff <= 5) {
            score += 15
            reasons.push(`Faixa etária próxima (diferença de ${ageDiff} anos)`)
          }
        }

        // Gender match
        if (refGender && person?.gender === refGender) {
          score += 10
          reasons.push('Mesmo gênero')
        }

        // Temporal proximity (within 6 months)
        const candidateDate = c.lastSeenAt ?? c.reportedAt
        const timeDiff = Math.abs(refDate.getTime() - candidateDate.getTime())
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24)
        if (daysDiff <= 30) {
          score += 25
          reasons.push('Desaparecimento no mesmo mês')
        } else if (daysDiff <= 90) {
          score += 15
          reasons.push('Desaparecimento no mesmo trimestre')
        } else if (daysDiff <= 180) {
          score += 10
          reasons.push('Desaparecimento no mesmo semestre')
        }

        // Same source
        if (c.source === refCase.source) {
          score += 5
          reasons.push('Mesma fonte de dados')
        }

        // Same case type
        if (c.caseType === refCase.caseType) {
          score += 5
          reasons.push('Mesmo tipo de caso')
        }

        const personName = person
          ? `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Nome desconhecido'
          : 'Nome desconhecido'

        const img = person?.images?.[0]

        return {
          id: c.id,
          caseNumber: c.caseNumber,
          personName,
          approximateAge: candidateAge ?? null,
          lastSeenLocation: c.lastSeenLocation,
          lastSeenCountry: c.lastSeenCountry,
          reportedAt: c.reportedAt.toISOString(),
          source: c.source,
          primaryImageUrl: img?.thumbnailUrl ?? img?.storageUrl ?? null,
          similarityScore: Math.min(score, 100),
          matchReasons: reasons,
        }
      })
      .filter((c) => c.similarityScore >= 20) // Min threshold
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 10) // Top 10

    return NextResponse.json({ success: true, data: scored })
  } catch (err) {
    logger.error({ err, caseId: id }, 'Similar cases query failed')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Failed to find similar cases' } },
      { status: 500 }
    )
  }
}
