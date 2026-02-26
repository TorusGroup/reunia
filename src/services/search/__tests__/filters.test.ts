// =============================================================
// Unit tests for search filter builders
// =============================================================

import {
  searchParamsSchema,
  buildCaseFilters,
  buildPersonFilters,
  buildGeoParams,
  buildSearchFilters,
  buildAppliedFilters,
  type SearchParams,
} from '@/services/search/filters'

// Helper to build valid SearchParams with defaults
function makeParams(overrides: Partial<SearchParams> = {}): SearchParams {
  return {
    status: 'active',
    radius: 50,
    page: 1,
    limit: 20,
    sort: 'relevance',
    ...overrides,
  }
}

describe('searchParamsSchema', () => {
  it('should apply defaults when no params given', () => {
    const result = searchParamsSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('active')
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
      expect(result.data.sort).toBe('relevance')
      expect(result.data.radius).toBe(50)
    }
  })

  it('should coerce string numbers to numbers', () => {
    const result = searchParamsSchema.safeParse({
      ageMin: '5',
      ageMax: '12',
      page: '3',
      limit: '50',
      lat: '48.8566',
      lng: '2.3522',
      radius: '100',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.ageMin).toBe(5)
      expect(result.data.ageMax).toBe(12)
      expect(result.data.page).toBe(3)
      expect(result.data.limit).toBe(50)
      expect(result.data.lat).toBe(48.8566)
      expect(result.data.lng).toBe(2.3522)
      expect(result.data.radius).toBe(100)
    }
  })

  it('should parse comma-separated source into array', () => {
    const result = searchParamsSchema.safeParse({ source: 'fbi,interpol,ncmec' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.source).toEqual(['fbi', 'interpol', 'ncmec'])
    }
  })

  it('should reject limit > 100', () => {
    const result = searchParamsSchema.safeParse({ limit: '200' })
    expect(result.success).toBe(false)
  })

  it('should reject invalid status value', () => {
    const result = searchParamsSchema.safeParse({ status: 'nonexistent' })
    expect(result.success).toBe(false)
  })

  it('should reject query longer than 200 chars', () => {
    const result = searchParamsSchema.safeParse({ q: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('should reject invalid datetime for dateFrom', () => {
    const result = searchParamsSchema.safeParse({ dateFrom: 'not-a-date' })
    expect(result.success).toBe(false)
  })
})

describe('buildCaseFilters', () => {
  it('should always include anonymizedAt: null and deletionRequested: false', () => {
    const params = makeParams()
    const filters = buildCaseFilters(params)
    expect(filters.anonymizedAt).toBeNull()
    expect(filters.deletionRequested).toBe(false)
  })

  it('should set status filter', () => {
    const params = makeParams({ status: 'resolved' })
    const filters = buildCaseFilters(params)
    expect(filters.status).toBe('resolved')
  })

  it('should set source filter as IN array', () => {
    const params = makeParams({ source: ['fbi', 'interpol'] })
    const filters = buildCaseFilters(params)
    expect(filters.source).toEqual({ in: ['fbi', 'interpol'] })
  })

  it('should set country filter', () => {
    const params = makeParams({ country: 'BR' })
    const filters = buildCaseFilters(params)
    expect(filters.lastSeenCountry).toBe('BR')
  })

  it('should set date range filter', () => {
    const params = makeParams({
      dateFrom: '2024-01-01T00:00:00Z',
      dateTo: '2024-12-31T23:59:59Z',
    })
    const filters = buildCaseFilters(params)
    expect(filters.reportedAt?.gte).toEqual(new Date('2024-01-01T00:00:00Z'))
    expect(filters.reportedAt?.lte).toEqual(new Date('2024-12-31T23:59:59Z'))
  })

  it('should set location filter with mode insensitive', () => {
    const params = makeParams({ location: 'São Paulo' })
    const filters = buildCaseFilters(params)
    expect(filters.lastSeenLocation).toEqual({
      contains: 'São Paulo',
      mode: 'insensitive',
    })
  })

  it('should not set source filter when source is undefined', () => {
    const params = makeParams({ source: undefined })
    const filters = buildCaseFilters(params)
    expect(filters.source).toBeUndefined()
  })
})

describe('buildPersonFilters', () => {
  it('should return empty object when no person filters given', () => {
    const params = makeParams()
    const filters = buildPersonFilters(params)
    expect(filters).toEqual({})
  })

  it('should set gender filter', () => {
    const params = makeParams({ gender: 'female' })
    const filters = buildPersonFilters(params)
    expect(filters.gender).toBe('female')
  })

  it('should set age range filter', () => {
    const params = makeParams({ ageMin: 5, ageMax: 15 })
    const filters = buildPersonFilters(params)
    expect(filters.approximateAge).toEqual({ gte: 5, lte: 15 })
  })

  it('should set only ageMin when ageMax not provided', () => {
    const params = makeParams({ ageMin: 5 })
    const filters = buildPersonFilters(params)
    expect(filters.approximateAge).toEqual({ gte: 5 })
    expect(filters.approximateAge?.lte).toBeUndefined()
  })

  it('should set hair and eye color filters as insensitive contains', () => {
    const params = makeParams({ hairColor: 'brown', eyeColor: 'blue' })
    const filters = buildPersonFilters(params)
    expect(filters.hairColor).toEqual({ contains: 'brown', mode: 'insensitive' })
    expect(filters.eyeColor).toEqual({ contains: 'blue', mode: 'insensitive' })
  })
})

describe('buildGeoParams', () => {
  it('should return hasGeoFilter: false when lat/lng absent', () => {
    const params = makeParams()
    const result = buildGeoParams(params)
    expect(result.hasGeoFilter).toBe(false)
    expect(result.geoParams).toBeUndefined()
  })

  it('should return hasGeoFilter: true with correct radius in meters', () => {
    const params = makeParams({ lat: -23.5505, lng: -46.6333, radius: 100 })
    const result = buildGeoParams(params)
    expect(result.hasGeoFilter).toBe(true)
    expect(result.geoParams?.lat).toBe(-23.5505)
    expect(result.geoParams?.lng).toBe(-46.6333)
    expect(result.geoParams?.radiusMeters).toBe(100_000) // 100 km * 1000
  })

  it('should use default radius of 50km when not specified', () => {
    const params = makeParams({ lat: 0, lng: 0 })
    const result = buildGeoParams(params)
    expect(result.geoParams?.radiusMeters).toBe(50_000)
  })

  it('should return hasGeoFilter: false when only lat present (lng missing)', () => {
    const params = makeParams({ lat: -23.5505, lng: undefined })
    const result = buildGeoParams(params)
    expect(result.hasGeoFilter).toBe(false)
  })
})

describe('buildAppliedFilters', () => {
  it('should always include status', () => {
    const params = makeParams()
    const applied = buildAppliedFilters(params)
    expect(applied.status).toBe('active')
  })

  it('should include all provided filters', () => {
    const params = makeParams({
      q: 'João Silva',
      gender: 'male',
      ageMin: 5,
      ageMax: 10,
      country: 'BR',
      source: ['fbi'],
    })
    const applied = buildAppliedFilters(params)
    expect(applied.query).toBe('João Silva')
    expect(applied.gender).toBe('male')
    expect(applied.ageMin).toBe(5)
    expect(applied.ageMax).toBe(10)
    expect(applied.country).toBe('BR')
    expect(applied.source).toEqual(['fbi'])
  })

  it('should not include radius without lat/lng', () => {
    const params = makeParams({ radius: 100 })
    const applied = buildAppliedFilters(params)
    expect(applied.radius).toBeUndefined()
  })

  it('should include radius when geo filter is active', () => {
    const params = makeParams({ lat: 0, lng: 0, radius: 100 })
    const applied = buildAppliedFilters(params)
    expect(applied.radius).toBe(100)
    expect(applied.lat).toBe(0)
    expect(applied.lng).toBe(0)
  })
})

describe('buildSearchFilters (integration)', () => {
  it('should produce consistent output combining all filter builders', () => {
    const params = makeParams({
      q: 'Maria',
      gender: 'female',
      ageMin: 3,
      ageMax: 10,
      status: 'active',
      country: 'BR',
      lat: -23.5505,
      lng: -46.6333,
      radius: 50,
    })

    const result = buildSearchFilters(params)

    expect(result.hasTextQuery).toBe(true)
    expect(result.hasGeoFilter).toBe(true)
    expect(result.geoParams?.radiusMeters).toBe(50_000)
    expect(result.caseWhere.status).toBe('active')
    expect(result.caseWhere.lastSeenCountry).toBe('BR')
    expect(result.personWhere.gender).toBe('female')
    expect(result.personWhere.approximateAge).toEqual({ gte: 3, lte: 10 })
  })

  it('should set hasTextQuery: false when q is absent', () => {
    const params = makeParams({ q: undefined })
    const result = buildSearchFilters(params)
    expect(result.hasTextQuery).toBe(false)
  })
})
