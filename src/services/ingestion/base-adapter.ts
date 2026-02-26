// =============================================================
// Base Adapter Interface & Shared Types — E2-S01
// Contract that all data source connectors must implement
// =============================================================

import type { CaseSource } from '@prisma/client'

// ---------------------------------------------------------------
// Raw record: what the external API returns (untyped)
// ---------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawRecord = Record<string, any>

// ---------------------------------------------------------------
// Normalized case: unified schema across all sources
// ---------------------------------------------------------------
export interface NormalizedCase {
  externalId: string
  source: CaseSource
  firstName: string | null
  lastName: string | null
  // nameNormalized is computed by normalizer: LOWER + remove accents
  nameNormalized: string
  dateOfBirth: Date | null
  missingDate: Date | null
  lastSeenLocation: string | null
  lastSeenLat: number | null
  lastSeenLng: number | null
  lastSeenCountry: string | null
  description: string | null
  gender: 'male' | 'female' | 'other' | 'unknown'
  race: string | null
  age: number | null
  ageRange: { min: number; max: number } | null
  heightCm: number | null
  weightKg: number | null
  photoUrls: string[]
  status: 'missing' | 'found' | 'unknown'
  sourceUrl: string | null
  rawData: RawRecord
}

// ---------------------------------------------------------------
// Source status: adapter health report
// ---------------------------------------------------------------
export interface SourceStatus {
  sourceId: string
  sourceName: string
  isAvailable: boolean
  lastCheckedAt: Date
  latencyMs?: number
  error?: string
}

// ---------------------------------------------------------------
// Ingestion result: what a run returns
// ---------------------------------------------------------------
export interface IngestionResult {
  source: CaseSource
  recordsFetched: number
  recordsInserted: number
  recordsUpdated: number
  recordsSkipped: number
  recordsFailed: number
  durationMs: number
  errors: Array<{ externalId?: string; error: string }>
}

// ---------------------------------------------------------------
// Fetch options
// ---------------------------------------------------------------
export interface FetchOptions {
  page?: number
  since?: Date
  maxPages?: number
}

// ---------------------------------------------------------------
// ISourceAdapter: every connector implements this
// ---------------------------------------------------------------
export interface ISourceAdapter {
  /** Unique identifier matching CaseSource enum */
  readonly sourceId: CaseSource

  /** Human-readable name */
  readonly sourceName: string

  /** Default polling interval in minutes */
  readonly pollingIntervalMinutes: number

  /** Fetch raw records from the external API */
  fetch(options?: FetchOptions): Promise<RawRecord[]>

  /** Normalize a raw record to the unified NormalizedCase schema */
  normalize(raw: RawRecord): NormalizedCase

  /** Get timestamp of last successful sync */
  getLastSyncTimestamp(): Promise<Date | null>

  /** Health check: is the external source reachable? */
  getStatus(): Promise<SourceStatus>
}

// ---------------------------------------------------------------
// Abstract base class with shared utilities
// ---------------------------------------------------------------
export abstract class BaseAdapter implements ISourceAdapter {
  abstract readonly sourceId: CaseSource
  abstract readonly sourceName: string
  abstract readonly pollingIntervalMinutes: number

  abstract fetch(options?: FetchOptions): Promise<RawRecord[]>
  abstract normalize(raw: RawRecord): NormalizedCase

  async getLastSyncTimestamp(): Promise<Date | null> {
    return null // Override in subclasses if needed
  }

  async getStatus(): Promise<SourceStatus> {
    const start = Date.now()
    try {
      // Default: try to fetch 1 record to verify connectivity
      await this.fetch({ maxPages: 1 })
      return {
        sourceId: String(this.sourceId),
        sourceName: this.sourceName,
        isAvailable: true,
        lastCheckedAt: new Date(),
        latencyMs: Date.now() - start,
      }
    } catch (err) {
      return {
        sourceId: String(this.sourceId),
        sourceName: this.sourceName,
        isAvailable: false,
        lastCheckedAt: new Date(),
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  }

  // ---------------------------------------------------------------
  // Shared helper: rate-limited fetch with retry + backoff
  // ---------------------------------------------------------------
  protected async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    maxAttempts = 3,
    initialDelayMs = 5000
  ): Promise<Response> {
    let lastError: Error = new Error('Unknown error')

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30_000)

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'User-Agent': 'ReunIA/1.0 (Missing Children Search Platform; contact@reunia.org)',
            Accept: 'application/json',
            ...options.headers,
          },
        })
        clearTimeout(timeout)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return response
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))

        if (attempt < maxAttempts) {
          const delay = initialDelayMs * Math.pow(2, attempt - 1)
          await this.sleep(delay)
        }
      }
    }

    throw lastError
  }

  // Respect API rate limits — default 1 req/sec
  protected async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Normalize height from inches to cm
  protected inchesToCm(inches: number | null | undefined): number | null {
    if (inches == null) return null
    return Math.round(inches * 2.54)
  }

  // Normalize height from meters to cm
  protected metersToCm(meters: number | null | undefined): number | null {
    if (meters == null) return null
    return Math.round(meters * 100)
  }

  // Normalize weight from lbs to kg
  protected lbsToKg(lbs: number | null | undefined): number | null {
    if (lbs == null) return null
    return Math.round(lbs * 0.453592)
  }

  // Normalize gender string to enum
  protected normalizeGender(
    gender: string | null | undefined
  ): 'male' | 'female' | 'other' | 'unknown' {
    if (!gender) return 'unknown'
    const g = gender.toLowerCase().trim()
    if (g === 'm' || g === 'male' || g === 'man' || g === 'masculino') return 'male'
    if (g === 'f' || g === 'female' || g === 'woman' || g === 'feminino') return 'female'
    if (g === 'other' || g === 'outros') return 'other'
    return 'unknown'
  }

  // Normalize country code to ISO 3166-1 alpha-2
  protected normalizeCountryCode(code: string | null | undefined): string | null {
    if (!code) return null
    const c = code.toUpperCase().trim()
    // If already 2-char ISO code, return as-is
    if (/^[A-Z]{2}$/.test(c)) return c
    return null
  }

  // Normalize name: LOWER + strip accents
  protected normalizeName(first: string | null, last: string | null): string {
    const full = [first, last]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
    return full
  }

  // Parse a date string safely
  protected parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null
    try {
      const d = new Date(dateStr)
      return isNaN(d.getTime()) ? null : d
    } catch {
      return null
    }
  }

  // Parse an age string / number safely
  protected parseAge(age: number | string | null | undefined): number | null {
    if (age == null) return null
    const n = typeof age === 'string' ? parseInt(age, 10) : age
    return isNaN(n) || n < 0 || n > 120 ? null : n
  }
}
