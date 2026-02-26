import { createHash } from 'crypto'
import { cache } from '@/lib/redis'
import { logger } from '@/lib/logger'
import type { SearchParams } from '@/services/search/filters'
import type { SearchEngineResult } from '@/services/search/search-engine'

// =============================================================
// Search Cache Layer (E3-S01)
// Redis-backed cache for search results.
// TTL: 60 seconds for regular searches (can be configured per call)
// Cache key: SHA256 hash of normalized query params
// Invalidated on new ingestion via pattern delete
// =============================================================

const SEARCH_CACHE_PREFIX = 'search:results:'
const SUGGEST_CACHE_PREFIX = 'search:suggest:'

export const SEARCH_CACHE_TTL = 60         // 60 seconds
export const STATS_CACHE_TTL = 300         // 5 minutes
export const SUGGEST_CACHE_TTL = 120       // 2 minutes

// ---------------------------------------------------------------
// Cache key generation
// Produces a deterministic key from search params
// ---------------------------------------------------------------

export function buildSearchCacheKey(params: SearchParams): string {
  // Only include params that affect results (exclude pagination for hit ratio)
  const keyParts: Record<string, unknown> = {
    q: params.q ?? '',
    gender: params.gender ?? '',
    ageMin: params.ageMin ?? '',
    ageMax: params.ageMax ?? '',
    status: params.status,
    caseType: params.caseType ?? '',
    urgency: params.urgency ?? '',
    source: params.source ? [...params.source].sort().join(',') : '',
    country: params.country ?? '',
    location: params.location ?? '',
    lat: params.lat ?? '',
    lng: params.lng ?? '',
    radius: params.radius ?? '',
    dateFrom: params.dateFrom ?? '',
    dateTo: params.dateTo ?? '',
    hairColor: params.hairColor ?? '',
    eyeColor: params.eyeColor ?? '',
    sort: params.sort,
  }

  const normalized = JSON.stringify(keyParts, Object.keys(keyParts).sort())
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 16)
  return `${SEARCH_CACHE_PREFIX}${hash}`
}

export function buildPagedSearchCacheKey(params: SearchParams): string {
  // Include page + limit for full result caching
  const base = buildSearchCacheKey(params)
  return `${base}:p${params.page}:l${params.limit}`
}

export function buildSuggestCacheKey(query: string): string {
  const normalized = query.toLowerCase().trim()
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 16)
  return `${SUGGEST_CACHE_PREFIX}${hash}`
}

// ---------------------------------------------------------------
// Cache operations
// ---------------------------------------------------------------

export interface CachedSearchResult {
  results: SearchEngineResult[]
  total: number
  fromCache: boolean
}

export async function getCachedSearch(
  params: SearchParams
): Promise<CachedSearchResult | null> {
  try {
    const key = buildPagedSearchCacheKey(params)
    const cached = await cache.get<CachedSearchResult>(key)
    if (cached) {
      logger.debug({ key }, 'Search cache hit')
      return { ...cached, fromCache: true }
    }
    logger.debug({ key }, 'Search cache miss')
    return null
  } catch (err) {
    // Cache failure should never block search
    logger.warn({ err }, 'Search cache get error — proceeding without cache')
    return null
  }
}

export async function setCachedSearch(
  params: SearchParams,
  result: Omit<CachedSearchResult, 'fromCache'>,
  ttlSeconds: number = SEARCH_CACHE_TTL
): Promise<void> {
  try {
    const key = buildPagedSearchCacheKey(params)
    await cache.set(key, { ...result, fromCache: false }, ttlSeconds)
    logger.debug({ key, ttlSeconds }, 'Search result cached')
  } catch (err) {
    // Non-blocking — cache write failure is acceptable
    logger.warn({ err }, 'Search cache set error — result not cached')
  }
}

export async function getCachedSuggestions(query: string): Promise<string[] | null> {
  try {
    const key = buildSuggestCacheKey(query)
    return await cache.get<string[]>(key)
  } catch (err) {
    logger.warn({ err }, 'Suggest cache get error')
    return null
  }
}

export async function setCachedSuggestions(
  query: string,
  suggestions: string[]
): Promise<void> {
  try {
    const key = buildSuggestCacheKey(query)
    await cache.set(key, suggestions, SUGGEST_CACHE_TTL)
  } catch (err) {
    logger.warn({ err }, 'Suggest cache set error')
  }
}

// ---------------------------------------------------------------
// Cache invalidation
// Called from the ingestion pipeline when new data arrives
// ---------------------------------------------------------------

export async function invalidateSearchCache(): Promise<void> {
  try {
    // Import lazily to avoid circular dep
    const { redis } = await import('@/lib/redis')
    const pattern = `${SEARCH_CACHE_PREFIX}*`
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
      logger.info({ count: keys.length }, 'Search cache invalidated')
    }
  } catch (err) {
    logger.warn({ err }, 'Search cache invalidation error')
  }
}
