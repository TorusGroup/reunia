import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'

// =============================================================
// POST /api/v1/cases/[id]/analyze — AI Case Analyst
// Generates risk profile, pattern analysis, and search suggestions
// Uses heuristic analysis (no external LLM dependency)
// =============================================================

interface CaseAnalysis {
  riskProfile: {
    level: 'critical' | 'high' | 'medium' | 'low'
    score: number
    factors: string[]
  }
  patterns: {
    similarCasesInRegion: number
    similarCasesInPeriod: number
    observations: string[]
  }
  timeline: {
    daysMissing: number
    estimatedPhase: string
    phaseDescription: string
  }
  searchSuggestions: string[]
  summary: string
  generatedAt: string
}

function computeRiskScore(caseData: {
  urgency: string
  caseType: string
  reportedAt: Date
  lastSeenAt: Date | null
  persons: Array<{ approximateAge: number | null; ageAtDisappearance: number | null }>
}): { level: 'critical' | 'high' | 'medium' | 'low'; score: number; factors: string[] } {
  let score = 50
  const factors: string[] = []

  // Age factor — younger = higher risk
  const person = caseData.persons[0]
  const age = person?.approximateAge ?? person?.ageAtDisappearance
  if (age !== null && age !== undefined) {
    if (age < 5) {
      score += 30
      factors.push(`Idade muito baixa (${age} anos) — vulnerabilidade extrema`)
    } else if (age < 10) {
      score += 20
      factors.push(`Criança pequena (${age} anos) — alta vulnerabilidade`)
    } else if (age < 13) {
      score += 10
      factors.push(`Pré-adolescente (${age} anos)`)
    }
  }

  // Time factor
  const lastSeen = caseData.lastSeenAt ?? caseData.reportedAt
  const daysMissing = Math.floor((Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24))
  if (daysMissing > 365) {
    score += 15
    factors.push(`Desaparecido(a) há mais de 1 ano (${daysMissing} dias)`)
  } else if (daysMissing > 90) {
    score += 10
    factors.push(`Desaparecido(a) há mais de 3 meses (${daysMissing} dias)`)
  } else if (daysMissing < 3) {
    score += 5
    factors.push(`Desaparecimento recente (${daysMissing} dias) — janela crítica de busca`)
  }

  // Case type factor
  if (caseData.caseType === 'abduction_nonfamily' || caseData.caseType === 'trafficking_suspected') {
    score += 25
    factors.push(`Tipo de caso de alto risco: ${caseData.caseType === 'abduction_nonfamily' ? 'abdução por não-familiar' : 'suspeita de tráfico'}`)
  } else if (caseData.caseType === 'abduction_family') {
    score += 10
    factors.push('Abdução familiar — risco moderado')
  }

  // Urgency factor
  if (caseData.urgency === 'critical') {
    score += 15
    factors.push('Urgência marcada como CRÍTICA')
  } else if (caseData.urgency === 'high') {
    score += 10
    factors.push('Urgência marcada como ALTA')
  }

  score = Math.min(score, 100)

  const level: 'critical' | 'high' | 'medium' | 'low' =
    score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low'

  return { level, score, factors }
}

function getPhaseDescription(daysMissing: number): { phase: string; description: string } {
  if (daysMissing <= 1) {
    return {
      phase: 'Fase Crítica Imediata (0-24h)',
      description: 'As primeiras 24 horas são as mais críticas. A probabilidade de recuperação é maior neste período. Mobilização máxima recomendada.',
    }
  }
  if (daysMissing <= 3) {
    return {
      phase: 'Fase de Resposta Rápida (1-3 dias)',
      description: 'Período onde alertas comunitários e busca ativa têm maior impacto. Coordenação com autoridades locais é essencial.',
    }
  }
  if (daysMissing <= 14) {
    return {
      phase: 'Fase de Investigação Ativa (3-14 dias)',
      description: 'Expansão do raio de busca, análise de câmeras de segurança, entrevistas com testemunhas.',
    }
  }
  if (daysMissing <= 90) {
    return {
      phase: 'Fase de Investigação Estendida (14-90 dias)',
      description: 'Investigação aprofundada, possível envolvimento de agências especializadas, análise de padrões regionais.',
    }
  }
  if (daysMissing <= 365) {
    return {
      phase: 'Caso de Longo Prazo (3-12 meses)',
      description: 'Monitoramento contínuo, age progression pode ser necessário, cooperação inter-agências.',
    }
  }
  return {
    phase: 'Caso Frio (>1 ano)',
    description: 'Caso requer revisão periódica com novas técnicas. Age progression, correspondência facial com novos ingressos no sistema, e reanálise de evidências.',
  }
}

export async function POST(
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
    // Fetch case with relations
    const caseData = await db.case.findUnique({
      where: { id },
      include: {
        persons: {
          include: {
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
        sightings: { select: { id: true, createdAt: true, status: true, locationText: true } },
        sources: { select: { sourceSlug: true } },
      },
    })

    if (!caseData) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Case not found' } },
        { status: 404 }
      )
    }

    // Compute risk profile
    const riskProfile = computeRiskScore({
      urgency: caseData.urgency,
      caseType: caseData.caseType,
      reportedAt: caseData.reportedAt,
      lastSeenAt: caseData.lastSeenAt,
      persons: caseData.persons.map((p) => ({
        approximateAge: p.approximateAge,
        ageAtDisappearance: p.ageAtDisappearance,
      })),
    })

    // Find similar cases in same region and period
    const lastSeen = caseData.lastSeenAt ?? caseData.reportedAt
    const daysMissing = Math.floor((Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24))
    const threeMonthsBefore = new Date(lastSeen.getTime() - 90 * 24 * 60 * 60 * 1000)
    const threeMonthsAfter = new Date(lastSeen.getTime() + 90 * 24 * 60 * 60 * 1000)

    const [similarRegion, similarPeriod] = await Promise.all([
      caseData.lastSeenCountry
        ? db.case.count({
            where: {
              id: { not: id },
              status: 'active',
              lastSeenCountry: caseData.lastSeenCountry,
            },
          })
        : Promise.resolve(0),
      db.case.count({
        where: {
          id: { not: id },
          status: 'active',
          reportedAt: { gte: threeMonthsBefore, lte: threeMonthsAfter },
        },
      }),
    ])

    const observations: string[] = []
    if (similarRegion > 5) {
      observations.push(`${similarRegion} outros casos ativos na mesma região — possível padrão geográfico`)
    }
    if (similarPeriod > 10) {
      observations.push(`${similarPeriod} casos no mesmo período de 6 meses — volume acima da média`)
    }
    if (caseData.sightings.length > 0) {
      const confirmed = caseData.sightings.filter((s) => s.status === 'confirmed').length
      observations.push(`${caseData.sightings.length} avistamento(s) reportado(s), ${confirmed} confirmado(s)`)
    }
    if (caseData.sources.length > 1) {
      observations.push(`Caso rastreado por ${caseData.sources.length} fontes — alta visibilidade`)
    }

    // Phase
    const phase = getPhaseDescription(daysMissing)

    // Search suggestions
    const suggestions: string[] = []
    const person = caseData.persons[0]
    if (caseData.lastSeenLocation) {
      suggestions.push(`Intensificar busca na região de ${caseData.lastSeenLocation} e arredores (raio de 50km)`)
    }
    if (person?.images?.length === 0) {
      suggestions.push('URGENTE: Adicionar foto ao caso — sem foto, o reconhecimento facial não é possível')
    }
    if (daysMissing < 7) {
      suggestions.push('Verificar câmeras de segurança em locais públicos próximos')
      suggestions.push('Solicitar rastreamento de dispositivos eletrônicos (se aplicável)')
    }
    if (daysMissing > 30) {
      suggestions.push('Considerar age progression para atualizar imagem')
    }
    suggestions.push('Compartilhar caso em redes sociais para ampliar alcance')
    suggestions.push('Verificar registros de hospitais e abrigos na região')

    const personName = person
      ? `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'pessoa desconhecida'
      : 'pessoa desconhecida'

    const summary = [
      `Caso ${caseData.caseNumber} (${personName}):`,
      `Nível de risco ${riskProfile.level.toUpperCase()} (score ${riskProfile.score}/100).`,
      `Desaparecido(a) há ${daysMissing} dia(s) — ${phase.phase}.`,
      similarRegion > 0 ? `${similarRegion} caso(s) ativo(s) na mesma região.` : '',
      caseData.sightings.length > 0
        ? `${caseData.sightings.length} avistamento(s) reportado(s).`
        : 'Nenhum avistamento reportado ainda.',
      riskProfile.score >= 70
        ? 'AÇÃO IMEDIATA RECOMENDADA — priorizar este caso na fila de investigação.'
        : '',
    ]
      .filter(Boolean)
      .join(' ')

    const analysis: CaseAnalysis = {
      riskProfile,
      patterns: {
        similarCasesInRegion: similarRegion,
        similarCasesInPeriod: similarPeriod,
        observations,
      },
      timeline: {
        daysMissing,
        estimatedPhase: phase.phase,
        phaseDescription: phase.description,
      },
      searchSuggestions: suggestions,
      summary,
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json({ success: true, data: analysis })
  } catch (err) {
    logger.error({ err, caseId: id }, 'Case analysis failed')
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Analysis failed' } },
      { status: 500 }
    )
  }
}
