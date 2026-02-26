// =============================================================
// Deduplicator — E2-S05
// Detect and merge duplicate records across sources
// Strategy: name_normalized + dateOfBirth + gender fuzzy match
// =============================================================

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { NormalizedCase } from '@/services/ingestion/base-adapter'
import { normalizeNameForSearch } from '@/services/ingestion/normalizer'
import type { CaseSource } from '@prisma/client'

export interface DeduplicationDecision {
  isDuplicate: boolean
  existingCaseId: string | null
  existingPersonId: string | null
  score: number
  reason: string
  action: 'create' | 'update' | 'skip'
}

// ---------------------------------------------------------------
// Levenshtein distance (inline — no external dep needed)
// ---------------------------------------------------------------
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1,     // insertion
          matrix[i - 1]![j]! + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length]![a.length]!
}

// ---------------------------------------------------------------
// Similarity score 0.0–1.0 (1.0 = identical)
// ---------------------------------------------------------------
function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const normalA = normalizeNameForSearch(a)
  const normalB = normalizeNameForSearch(b)
  if (normalA === normalB) return 1.0
  const maxLen = Math.max(normalA.length, normalB.length)
  if (maxLen === 0) return 1.0
  const dist = levenshteinDistance(normalA, normalB)
  return 1 - dist / maxLen
}

// ---------------------------------------------------------------
// DEDUPLICATION_THRESHOLD: min score to consider a match
// ---------------------------------------------------------------
const DEDUP_THRESHOLD = 0.85

// ---------------------------------------------------------------
// Check if a record already exists in the DB for this source
// (exact match: same source + same externalId)
// ---------------------------------------------------------------
export async function findExactMatch(
  externalId: string,
  source: CaseSource
): Promise<{ caseId: string; personId: string } | null> {
  const existing = await db.case.findFirst({
    where: {
      source: source,
      sourceId: externalId,
    },
    select: {
      id: true,
      persons: {
        where: { role: 'missing_child' },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (!existing) return null
  const personId = existing.persons[0]?.id ?? null
  if (!personId) return null

  return { caseId: existing.id, personId }
}

// ---------------------------------------------------------------
// Cross-source deduplication:
// Look for a person with same name + DOB across ALL sources
// ---------------------------------------------------------------
export async function findFuzzyMatch(
  record: NormalizedCase
): Promise<DeduplicationDecision> {
  try {
    const nameNorm = normalizeNameForSearch(
      [record.firstName, record.lastName].filter(Boolean).join(' ')
    )

    if (!nameNorm || nameNorm.length < 3) {
      // Not enough info to deduplicate
      return {
        isDuplicate: false,
        existingCaseId: null,
        existingPersonId: null,
        score: 0,
        reason: 'Insufficient name data for deduplication',
        action: 'create',
      }
    }

    // Build DOB window filter if available
    let dobFilter: { gte: Date; lte: Date } | undefined
    if (record.dateOfBirth) {
      const dob = record.dateOfBirth
      const dobMin = new Date(dob.getTime())
      const dobMax = new Date(dob.getTime())
      dobMin.setDate(dobMin.getDate() - 30)  // ±30 days tolerance
      dobMax.setDate(dobMax.getDate() + 30)
      dobFilter = { gte: dobMin, lte: dobMax }
    }

    // Query candidates cross-source
    const candidates = await db.person.findMany({
      where: {
        role: 'missing_child',
        ...(dobFilter ? { dateOfBirth: dobFilter } : {}),
        case: {
          status: { not: 'archived' },
          source: { not: record.source }, // cross-source only
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        nameNormalized: true,
        case: {
          select: {
            id: true,
            source: true,
            status: true,
          },
        },
      },
      take: 50, // limit candidates
    })

    let bestMatch: { caseId: string; personId: string; score: number } | null = null
    let bestScore = 0

    for (const candidate of candidates) {
      const candidateName = [candidate.firstName, candidate.lastName]
        .filter(Boolean)
        .join(' ')

      const nameSim = nameSimilarity(
        [record.firstName, record.lastName].filter(Boolean).join(' '),
        candidateName
      )

      // Boost score if DOB matches
      let score = nameSim
      if (record.dateOfBirth && candidate.dateOfBirth) {
        const daysDiff =
          Math.abs(record.dateOfBirth.getTime() - candidate.dateOfBirth.getTime()) /
          (1000 * 60 * 60 * 24)
        if (daysDiff === 0) score = Math.min(1, score + 0.1)
        else if (daysDiff <= 7) score = Math.min(1, score + 0.05)
      }

      // Boost if gender matches
      if (
        record.gender !== 'unknown' &&
        candidate.gender &&
        record.gender === candidate.gender
      ) {
        score = Math.min(1, score + 0.05)
      }

      if (score > bestScore) {
        bestScore = score
        bestMatch = {
          caseId: candidate.case.id,
          personId: candidate.id,
          score,
        }
      }
    }

    if (bestMatch && bestScore >= DEDUP_THRESHOLD) {
      logger.info(
        {
          source: record.source,
          externalId: record.externalId,
          score: bestScore,
          existingCaseId: bestMatch.caseId,
        },
        'Deduplicator: cross-source duplicate detected'
      )

      return {
        isDuplicate: true,
        existingCaseId: bestMatch.caseId,
        existingPersonId: bestMatch.personId,
        score: bestScore,
        reason: `Fuzzy name match (score=${bestScore.toFixed(2)}) with existing case ${bestMatch.caseId}`,
        action: 'update',
      }
    }

    return {
      isDuplicate: false,
      existingCaseId: null,
      existingPersonId: null,
      score: bestScore,
      reason: bestScore > 0 ? `Best score ${bestScore.toFixed(2)} below threshold ${DEDUP_THRESHOLD}` : 'No candidates found',
      action: 'create',
    }
  } catch (err) {
    logger.error(
      { err, source: record.source, externalId: record.externalId },
      'Deduplicator: error during fuzzy match'
    )
    // On error: safe default is to create (better to have a dup than miss a case)
    return {
      isDuplicate: false,
      existingCaseId: null,
      existingPersonId: null,
      score: 0,
      reason: `Deduplication error: ${err instanceof Error ? err.message : 'Unknown'}`,
      action: 'create',
    }
  }
}
