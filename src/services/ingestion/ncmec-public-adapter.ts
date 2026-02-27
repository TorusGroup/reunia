// =============================================================
// NCMEC Public Search Adapter — No API key required
// Endpoint: https://api.missingkids.org/missingkids/servlet/JSONDataServlet
// Rate: 1 req/2s (conservative to avoid rate limits)
// Returns: public poster data from missingkids.org
// =============================================================

import { logger } from '@/lib/logger'
import { BaseAdapter } from '@/services/ingestion/base-adapter'
import type { NormalizedCase, RawRecord, FetchOptions } from '@/services/ingestion/base-adapter'
import type { CaseSource } from '@prisma/client'

// ---------------------------------------------------------------
// NCMEC Public API response types
// ---------------------------------------------------------------
interface NcmecPublicCase {
  id?: number
  caseNumber?: string
  orgName?: string
  firstName?: string
  middleName?: string
  lastName?: string
  missingDate?: string
  missingCity?: string
  missingState?: string
  missingCountry?: string
  missingAge?: number
  currentMinAge?: number
  currentMaxAge?: number
  race?: string
  sex?: string
  height?: string
  weight?: string
  hairColor?: string
  eyeColor?: string
  hasPhoto?: boolean
  photoUrl?: string
  thumbnailUrl?: string
  url?: string
}

interface NcmecPublicApiResponse {
  subject?: NcmecPublicCase[]
  total?: number
  totalCount?: number
  cases?: NcmecPublicCase[]
}

// ---------------------------------------------------------------
// Parse height string to cm
// Handles: "5'4"", "64 inches", "163 cm", "4' 0"", plain numbers
// ---------------------------------------------------------------
function parseHeightString(height: string | null | undefined): number | null {
  if (!height) return null

  // Format: 5'4" or 5' 4"
  const feetInchesMatch = height.match(/(\d+)['′]\s*(\d+)?["″]?/)
  if (feetInchesMatch) {
    const feet = parseInt(feetInchesMatch[1]!, 10)
    const inches = parseInt(feetInchesMatch[2] ?? '0', 10)
    return Math.round((feet * 12 + inches) * 2.54)
  }

  // Format: "64 inches"
  const inchesMatch = height.match(/(\d+)\s*inch/)
  if (inchesMatch) {
    return Math.round(parseInt(inchesMatch[1]!, 10) * 2.54)
  }

  // Format: "163 cm"
  const cmMatch = height.match(/(\d+)\s*cm/)
  if (cmMatch) {
    return parseInt(cmMatch[1]!, 10)
  }

  return null
}

// ---------------------------------------------------------------
// Parse weight string to kg
// Handles: "120 lbs", "54 kg"
// ---------------------------------------------------------------
function parseWeightString(weight: string | null | undefined): number | null {
  if (!weight) return null

  const lbsMatch = weight.match(/(\d+(?:\.\d+)?)\s*lbs?/i)
  if (lbsMatch) {
    return Math.round(parseFloat(lbsMatch[1]!) * 0.453592)
  }

  const kgMatch = weight.match(/(\d+(?:\.\d+)?)\s*kg/i)
  if (kgMatch) {
    return Math.round(parseFloat(kgMatch[1]!))
  }

  return null
}

// ---------------------------------------------------------------
// NCMEC Public Adapter
// ---------------------------------------------------------------
export class NcmecPublicAdapter extends BaseAdapter {
  readonly sourceId: CaseSource = 'ncmec'
  readonly sourceName = 'NCMEC Public Search'
  readonly pollingIntervalMinutes = 120 // 2 hours (public, no auth)

  // Public JSONDataServlet endpoint
  private readonly baseUrl =
    'https://api.missingkids.org/missingkids/servlet/JSONDataServlet'

  async fetch(options: FetchOptions = {}): Promise<RawRecord[]> {
    const maxPages = options.maxPages ?? 5
    const pageSize = 25
    const allRecords: NcmecPublicCase[] = []

    logger.info({ source: this.sourceId }, 'NCMEC Public Adapter: starting fetch')

    let page = options.page ?? 1

    while (page <= maxPages) {
      try {
        // Public search: action=publicSearch returns poster cases
        const params = new URLSearchParams({
          action: 'publicSearch',
          searchLang: 'en',
          goToPage: String(page),
          pageSize: String(pageSize),
        })

        const url = `${this.baseUrl}?${params.toString()}`

        // Public endpoint — shorter retry, 1s initial delay
        const response = await this.fetchWithRetry(url, {}, 2, 1000)

        let data: NcmecPublicApiResponse
        try {
          data = (await response.json()) as NcmecPublicApiResponse
        } catch {
          logger.warn({ source: this.sourceId, page }, 'NCMEC Public: invalid JSON response')
          break
        }

        // The API may return cases in 'subject', 'cases', or other fields
        const cases: NcmecPublicCase[] =
          data.subject ?? data.cases ?? []

        if (cases.length === 0) {
          logger.info({ source: this.sourceId, page }, 'NCMEC Public: no more records')
          break
        }

        allRecords.push(...cases)

        const total = data.total ?? data.totalCount ?? 0
        if (total > 0) {
          const totalPages = Math.ceil(total / pageSize)
          if (page >= totalPages) break
        }

        page++
        await this.sleep(2000) // 1 req/2s to be conservative
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.warn(
          { source: this.sourceId, page, msg },
          'NCMEC Public Adapter: page fetch failed — stopping'
        )
        break
      }
    }

    logger.info(
      { source: this.sourceId, count: allRecords.length },
      'NCMEC Public Adapter: fetch complete'
    )

    return allRecords as RawRecord[]
  }

  normalize(raw: RawRecord): NormalizedCase {
    const record = raw as NcmecPublicCase

    // External ID: use caseNumber or fall back to id
    const externalId =
      record.caseNumber ??
      (record.id != null ? `NCMEC-${record.id}` : `NCMEC-${Date.now()}`)

    // Build photo URL — NCMEC poster images follow a predictable pattern
    let photoUrls: string[] = []
    if (record.photoUrl) {
      photoUrls.push(record.photoUrl)
    } else if (record.thumbnailUrl) {
      photoUrls.push(record.thumbnailUrl)
    } else if (record.hasPhoto && record.caseNumber) {
      // Construct the poster image URL from the case number
      const numericId = record.caseNumber.replace(/[^0-9]/g, '')
      if (numericId) {
        photoUrls.push(
          `https://www.missingkids.org/content/dam/poster/ncmc/ncmc${numericId.padStart(6, '0')}.jpg`
        )
      }
    }

    const lastSeenLocation =
      [record.missingCity, record.missingState]
        .filter(Boolean)
        .join(', ') || null

    return {
      externalId,
      source: this.sourceId,
      firstName: record.firstName ?? null,
      lastName: record.lastName ?? null,
      nameNormalized: this.normalizeName(record.firstName ?? null, record.lastName ?? null),
      dateOfBirth: null, // NCMEC public API doesn't expose exact DOB
      missingDate: this.parseDate(record.missingDate ?? null),
      lastSeenLocation,
      lastSeenLat: null,
      lastSeenLng: null,
      lastSeenCountry: this.normalizeCountryCode(record.missingCountry ?? null) ?? 'US',
      description: null,
      gender: this.normalizeGender(record.sex ?? null),
      race: record.race ?? null,
      age: record.missingAge ?? null,
      ageRange:
        record.currentMinAge != null && record.currentMaxAge != null
          ? { min: record.currentMinAge, max: record.currentMaxAge }
          : null,
      heightCm: parseHeightString(record.height),
      weightKg: parseWeightString(record.weight),
      photoUrls,
      status: 'missing',
      sourceUrl:
        record.url ??
        (record.caseNumber
          ? `https://www.missingkids.org/case/${record.caseNumber}`
          : null),
      rawData: raw,
    }
  }
}

// Singleton export
export const ncmecPublicAdapter = new NcmecPublicAdapter()
