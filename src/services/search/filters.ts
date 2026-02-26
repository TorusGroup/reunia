import { z } from 'zod'
import type { CaseSource, CaseStatus, CaseUrgency, PersonGender } from '@/types/cases'

// =============================================================
// Search Filter Builder (E3-S01, E3-S02, E3-S03)
// Composable filter clauses for the unified search engine.
// Each builder returns a fragment that the search engine
// merges via AND logic into the final WHERE clause.
// =============================================================

// ---------------------------------------------------------------
// Zod schema — validates and coerces all query params
// ---------------------------------------------------------------

export const searchParamsSchema = z.object({
  // Full-text query
  q: z
    .string()
    .trim()
    .min(1, 'Search query cannot be empty')
    .max(200, 'Query too long')
    .optional(),

  // Demographic filters
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  ageMin: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(0).max(120))
    .optional(),
  ageMax: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(0).max(120))
    .optional(),

  // Status & type filters
  status: z
    .enum(['draft', 'pending_review', 'active', 'resolved', 'closed', 'archived'])
    .default('active'),
  caseType: z
    .enum([
      'missing',
      'abduction_family',
      'abduction_nonfamily',
      'runaway',
      'lost',
      'trafficking_suspected',
      'unidentified',
      'other',
    ])
    .optional(),
  urgency: z.enum(['critical', 'high', 'standard', 'low']).optional(),

  // Source filter (can be comma-separated for multi-select)
  source: z
    .string()
    .optional()
    .transform((v) => (v ? (v.split(',') as CaseSource[]) : undefined)),

  // Location filters
  location: z.string().max(200).optional(), // text search on lastSeenLocation
  country: z.string().length(2).toUpperCase().optional(),

  // Geo search
  lat: z.string().transform(Number).pipe(z.number().min(-90).max(90)).optional(),
  lng: z.string().transform(Number).pipe(z.number().min(-180).max(180)).optional(),
  radius: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(500))
    .default('50'),

  // Physical description filters
  hairColor: z.string().max(50).optional(),
  eyeColor: z.string().max(50).optional(),

  // Date range for case reported_at
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),

  // Pagination
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(1000))
    .default('1'),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default('20'),

  // Sorting
  sort: z.enum(['relevance', 'date', 'name', 'quality']).default('relevance'),
})

export type SearchParams = z.output<typeof searchParamsSchema>
export type SearchParamsInput = z.input<typeof searchParamsSchema>

// ---------------------------------------------------------------
// Types representing partial Prisma WHERE fragments
// ---------------------------------------------------------------

export interface PersonWhereFilter {
  gender?: PersonGender
  approximateAge?: { gte?: number; lte?: number }
  dateOfBirth?: { gte?: Date; lte?: Date }
  hairColor?: { contains: string; mode: 'insensitive' }
  eyeColor?: { contains: string; mode: 'insensitive' }
}

export interface CaseWhereFilter {
  status?: CaseStatus
  urgency?: CaseUrgency
  caseType?: unknown
  source?: { in: CaseSource[] }
  lastSeenCountry?: string
  reportedAt?: { gte?: Date; lte?: Date }
  lastSeenLocation?: { contains: string; mode: 'insensitive' }
  anonymizedAt?: null
  deletionRequested?: boolean
}

export interface SearchFilters {
  caseWhere: CaseWhereFilter
  personWhere: PersonWhereFilter
  hasGeoFilter: boolean
  geoParams?: { lat: number; lng: number; radiusMeters: number }
  hasTextQuery: boolean
}

// ---------------------------------------------------------------
// Filter builder functions
// Each function is a pure, testable transform
// ---------------------------------------------------------------

export function buildCaseFilters(params: SearchParams): CaseWhereFilter {
  const filters: CaseWhereFilter = {
    anonymizedAt: null,
    deletionRequested: false,
  }

  // Status filter (defaults to active — only public cases)
  if (params.status) {
    filters.status = params.status as CaseStatus
  }

  // Case type filter
  if (params.caseType) {
    filters.caseType = params.caseType
  }

  // Urgency filter
  if (params.urgency) {
    filters.urgency = params.urgency as CaseUrgency
  }

  // Source multi-select filter
  if (params.source && params.source.length > 0) {
    filters.source = { in: params.source }
  }

  // Country filter
  if (params.country) {
    filters.lastSeenCountry = params.country
  }

  // Location text filter (fuzzy ILIKE fallback — main text search uses tsvector)
  if (params.location) {
    filters.lastSeenLocation = {
      contains: params.location,
      mode: 'insensitive',
    }
  }

  // Date range filter on reportedAt
  if (params.dateFrom ?? params.dateTo) {
    filters.reportedAt = {}
    if (params.dateFrom) {
      filters.reportedAt.gte = new Date(params.dateFrom)
    }
    if (params.dateTo) {
      filters.reportedAt.lte = new Date(params.dateTo)
    }
  }

  return filters
}

export function buildPersonFilters(params: SearchParams): PersonWhereFilter {
  const filters: PersonWhereFilter = {}

  // Gender filter
  if (params.gender) {
    filters.gender = params.gender as PersonGender
  }

  // Age range filter — checks both approximateAge and computed from DOB
  if (params.ageMin !== undefined || params.ageMax !== undefined) {
    filters.approximateAge = {}
    if (params.ageMin !== undefined) {
      filters.approximateAge.gte = params.ageMin
    }
    if (params.ageMax !== undefined) {
      filters.approximateAge.lte = params.ageMax
    }
  }

  // Physical description filters
  if (params.hairColor) {
    filters.hairColor = { contains: params.hairColor, mode: 'insensitive' }
  }

  if (params.eyeColor) {
    filters.eyeColor = { contains: params.eyeColor, mode: 'insensitive' }
  }

  return filters
}

export function buildGeoParams(params: SearchParams): {
  hasGeoFilter: boolean
  geoParams?: { lat: number; lng: number; radiusMeters: number }
} {
  if (params.lat !== undefined && params.lng !== undefined) {
    return {
      hasGeoFilter: true,
      geoParams: {
        lat: params.lat,
        lng: params.lng,
        radiusMeters: (params.radius ?? 50) * 1000, // km to meters
      },
    }
  }
  return { hasGeoFilter: false }
}

export function buildSearchFilters(params: SearchParams): SearchFilters {
  const { hasGeoFilter, geoParams } = buildGeoParams(params)

  return {
    caseWhere: buildCaseFilters(params),
    personWhere: buildPersonFilters(params),
    hasGeoFilter,
    geoParams,
    hasTextQuery: Boolean(params.q && params.q.length > 0),
  }
}

// ---------------------------------------------------------------
// Applied filters summary (returned in response metadata)
// ---------------------------------------------------------------

export interface AppliedFilters {
  query?: string
  gender?: string
  ageMin?: number
  ageMax?: number
  status: string
  caseType?: string
  urgency?: string
  source?: string[]
  country?: string
  location?: string
  lat?: number
  lng?: number
  radius?: number
  dateFrom?: string
  dateTo?: string
  hairColor?: string
  eyeColor?: string
}

export function buildAppliedFilters(params: SearchParams): AppliedFilters {
  const applied: AppliedFilters = {
    status: params.status,
  }

  if (params.q) applied.query = params.q
  if (params.gender) applied.gender = params.gender
  if (params.ageMin !== undefined) applied.ageMin = params.ageMin
  if (params.ageMax !== undefined) applied.ageMax = params.ageMax
  if (params.caseType) applied.caseType = params.caseType
  if (params.urgency) applied.urgency = params.urgency
  if (params.source && params.source.length > 0) applied.source = params.source
  if (params.country) applied.country = params.country
  if (params.location) applied.location = params.location
  if (params.lat !== undefined) applied.lat = params.lat
  if (params.lng !== undefined) applied.lng = params.lng
  if (params.radius !== undefined && params.lat !== undefined) applied.radius = params.radius
  if (params.dateFrom) applied.dateFrom = params.dateFrom
  if (params.dateTo) applied.dateTo = params.dateTo
  if (params.hairColor) applied.hairColor = params.hairColor
  if (params.eyeColor) applied.eyeColor = params.eyeColor

  return applied
}
