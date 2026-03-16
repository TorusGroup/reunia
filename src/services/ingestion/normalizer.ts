// =============================================================
// Normalizer — E2-S01
// Pure functions to normalize NormalizedCase records to DB entities
// (cases + persons + images)
// =============================================================

import type { NormalizedCase } from '@/services/ingestion/base-adapter'

// ---------------------------------------------------------------
// Normalized name without accents (for deduplication + indexing)
// ---------------------------------------------------------------
export function normalizeNameForSearch(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9\s]/g, '')     // strip remaining non-alphanumeric
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------
// Normalize a full name: split into first/last if needed
// Handles "LASTNAME, FIRSTNAME" or "FIRSTNAME LASTNAME" patterns
// ---------------------------------------------------------------
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()

  // Pattern: "LASTNAME, FIRSTNAME MIDDLENAME"
  if (trimmed.includes(',')) {
    const [last, ...rest] = trimmed.split(',')
    return {
      firstName: rest.join(',').trim(),
      lastName: (last ?? '').trim(),
    }
  }

  // Pattern: "FIRSTNAME LASTNAME"
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return { firstName: trimmed, lastName: '' }
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1] ?? '',
  }
}

// ---------------------------------------------------------------
// Normalize phone to E.164 format
// ---------------------------------------------------------------
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  // If it starts with country code (more than 11 digits), assume it already has it
  if (digits.length > 11) return `+${digits}`
  // Default to Brazil if 11 digits starting with 0
  if (digits.startsWith('0')) return `+55${digits.slice(1)}`
  return `+${digits}`
}

// ---------------------------------------------------------------
// Map NormalizedCase to Prisma case fields
// ---------------------------------------------------------------
export function mapToCaseFields(record: NormalizedCase) {
  return {
    caseType: 'missing' as const,
    status: record.status === 'found' ? ('resolved' as const) : ('active' as const),
    urgency: 'standard' as const,
    reportedAt: record.missingDate ?? new Date(),
    source: record.source,
    sourceId: record.externalId,
    sourceUrl: record.sourceUrl ?? null,
    lastSeenAt: record.missingDate ?? null,
    lastSeenLocation: record.lastSeenLocation ?? null,
    lastSeenLat: record.lastSeenLat ?? null,
    lastSeenLng: record.lastSeenLng ?? null,
    lastSeenCountry: record.lastSeenCountry ?? null,
    circumstances: record.description ?? null,
    lastSyncedAt: new Date(),
    consentGiven: true,
    consentType: 'public_interest' as const,
  }
}

// ---------------------------------------------------------------
// Map NormalizedCase to Prisma person fields
// ---------------------------------------------------------------
export function mapToPersonFields(record: NormalizedCase) {
  return {
    role: 'missing_child' as const,
    firstName: record.firstName ?? null,
    lastName: record.lastName ?? null,
    dateOfBirth: record.dateOfBirth ?? null,
    approximateAge: record.age ?? null,
    gender: record.gender !== 'unknown' ? record.gender : null,
    nationality: record.lastSeenCountry ? [record.lastSeenCountry] : [],
    ethnicity: record.race ?? null,
    heightCm: record.heightCm ?? null,
    weightKg: record.weightKg ?? null,
    // nameNormalized is a generated column in PostgreSQL — do NOT set via Prisma
  }
}
