// =============================================================
// Unit tests for search cache utilities
// =============================================================

import {
  buildSearchCacheKey,
  buildPagedSearchCacheKey,
  buildSuggestCacheKey,
} from '@/services/search/cache'
import type { SearchParams } from '@/services/search/filters'

// Helper
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

describe('buildSearchCacheKey', () => {
  it('should produce a deterministic key for identical params', () => {
    const params = makeParams({ q: 'João', country: 'BR' })
    const key1 = buildSearchCacheKey(params)
    const key2 = buildSearchCacheKey(params)
    expect(key1).toBe(key2)
  })

  it('should produce different keys for different queries', () => {
    const key1 = buildSearchCacheKey(makeParams({ q: 'João' }))
    const key2 = buildSearchCacheKey(makeParams({ q: 'Maria' }))
    expect(key1).not.toBe(key2)
  })

  it('should produce the same key regardless of source array order', () => {
    const key1 = buildSearchCacheKey(makeParams({ source: ['fbi', 'interpol'] }))
    const key2 = buildSearchCacheKey(makeParams({ source: ['interpol', 'fbi'] }))
    expect(key1).toBe(key2)
  })

  it('should produce different keys for different countries', () => {
    const key1 = buildSearchCacheKey(makeParams({ country: 'BR' }))
    const key2 = buildSearchCacheKey(makeParams({ country: 'US' }))
    expect(key1).not.toBe(key2)
  })

  it('should NOT include page or limit in base key (for shared cache across pages)', () => {
    // Base key is the same regardless of page — pages use paged key
    const key1 = buildSearchCacheKey(makeParams({ page: 1 }))
    const key2 = buildSearchCacheKey(makeParams({ page: 2 }))
    expect(key1).toBe(key2)
  })

  it('should start with the search cache prefix', () => {
    const key = buildSearchCacheKey(makeParams())
    expect(key).toMatch(/^search:results:/)
  })
})

describe('buildPagedSearchCacheKey', () => {
  it('should produce different keys for different pages', () => {
    const key1 = buildPagedSearchCacheKey(makeParams({ page: 1 }))
    const key2 = buildPagedSearchCacheKey(makeParams({ page: 2 }))
    expect(key1).not.toBe(key2)
  })

  it('should produce different keys for different limits', () => {
    const key1 = buildPagedSearchCacheKey(makeParams({ limit: 20 }))
    const key2 = buildPagedSearchCacheKey(makeParams({ limit: 50 }))
    expect(key1).not.toBe(key2)
  })

  it('should start with the base search cache key', () => {
    const baseKey = buildSearchCacheKey(makeParams())
    const pagedKey = buildPagedSearchCacheKey(makeParams({ page: 1, limit: 20 }))
    expect(pagedKey).toContain(baseKey.replace('search:results:', ''))
  })
})

describe('buildSuggestCacheKey', () => {
  it('should produce deterministic keys', () => {
    expect(buildSuggestCacheKey('jo')).toBe(buildSuggestCacheKey('jo'))
  })

  it('should be case-insensitive (same key for different cases)', () => {
    // The function normalizes to lowercase
    expect(buildSuggestCacheKey('Jo')).toBe(buildSuggestCacheKey('jo'))
  })

  it('should produce different keys for different queries', () => {
    expect(buildSuggestCacheKey('jo')).not.toBe(buildSuggestCacheKey('ma'))
  })

  it('should start with suggest prefix', () => {
    expect(buildSuggestCacheKey('jo')).toMatch(/^search:suggest:/)
  })
})
