// =============================================================
// Quality Scorer — E2-S07
// Score each ingested record 0–100 based on data completeness
// =============================================================

import type { NormalizedCase } from '@/services/ingestion/base-adapter'
import type { CaseSource } from '@prisma/client'

// Source base scores (more trusted sources get higher base)
const SOURCE_BASE_SCORES: Partial<Record<CaseSource, number>> = {
  ncmec: 70,      // Gold standard
  fbi: 60,        // High quality official data
  interpol: 60,   // High quality official data
  amber: 55,      // Real-time but sparse
  platform: 50,   // User-submitted
  other: 30,
}

interface ScoringResult {
  score: number // 0–100
  factors: Array<{ field: string; points: number; reason: string }>
}

// ---------------------------------------------------------------
// Score a single record
// ---------------------------------------------------------------
export function scoreRecord(record: NormalizedCase): ScoringResult {
  const factors: Array<{ field: string; points: number; reason: string }> = []
  let score = SOURCE_BASE_SCORES[record.source] ?? 40

  // Name completeness
  if (record.firstName && record.lastName) {
    factors.push({ field: 'name', points: 10, reason: 'First + last name present' })
    score += 10
  } else if (record.firstName || record.lastName) {
    factors.push({ field: 'name', points: 5, reason: 'Partial name present' })
    score += 5
  } else {
    factors.push({ field: 'name', points: -10, reason: 'No name data' })
    score -= 10
  }

  // Date of birth
  if (record.dateOfBirth) {
    factors.push({ field: 'dateOfBirth', points: 5, reason: 'Date of birth present' })
    score += 5
  }

  // Missing date
  if (record.missingDate) {
    factors.push({ field: 'missingDate', points: 3, reason: 'Missing date present' })
    score += 3
  }

  // Photo
  if (record.photoUrls.length > 0) {
    factors.push({ field: 'photoUrls', points: 8, reason: 'Photo available' })
    score += 8
  }

  // Location
  if (record.lastSeenLat && record.lastSeenLng) {
    factors.push({ field: 'location', points: 5, reason: 'Geo coordinates present' })
    score += 5
  } else if (record.lastSeenLocation) {
    factors.push({ field: 'location', points: 3, reason: 'Location text present' })
    score += 3
  }

  // Description
  if (record.description && record.description.length > 50) {
    factors.push({ field: 'description', points: 3, reason: 'Rich description present' })
    score += 3
  }

  // Gender
  if (record.gender !== 'unknown') {
    factors.push({ field: 'gender', points: 2, reason: 'Gender specified' })
    score += 2
  }

  // Physical attributes
  if (record.heightCm || record.weightKg) {
    factors.push({ field: 'physical', points: 2, reason: 'Physical attributes present' })
    score += 2
  }

  // Country
  if (record.lastSeenCountry) {
    factors.push({ field: 'country', points: 2, reason: 'Country present' })
    score += 2
  }

  // Clamp between 0 and 100
  score = Math.max(0, Math.min(100, score))

  return { score, factors }
}

// ---------------------------------------------------------------
// Batch score multiple records
// ---------------------------------------------------------------
export function batchScore(records: NormalizedCase[]): Map<string, number> {
  const scores = new Map<string, number>()
  for (const record of records) {
    const { score } = scoreRecord(record)
    scores.set(record.externalId, score)
  }
  return scores
}
