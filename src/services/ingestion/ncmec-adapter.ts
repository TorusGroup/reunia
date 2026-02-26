// =============================================================
// NCMEC Poster API Adapter — E2-S04
// Endpoint: https://api.missingkids.org/poster/ncmc/
// Requires API key (NCMEC_API_KEY env var)
// MOCK MODE: returns realistic placeholder data until key available
// =============================================================

import { logger } from '@/lib/logger'
import { BaseAdapter } from '@/services/ingestion/base-adapter'
import type { NormalizedCase, RawRecord, FetchOptions } from '@/services/ingestion/base-adapter'
import type { CaseSource } from '@prisma/client'

// ---------------------------------------------------------------
// NCMEC API types
// ---------------------------------------------------------------
interface NcmecRecord {
  caseNumber: string
  orgName: string
  firstName: string
  lastName: string
  middleName?: string
  suffix?: string
  missingDate?: string
  missingCity?: string
  missingState?: string
  missingCountry?: string
  missingAge?: number
  currentMinAge?: number
  currentMaxAge?: number
  race?: string
  sex?: string
  photoUrl?: string
  thumbnail?: string
  height?: string   // Format: "5'4"" or "64 inches"
  weight?: string   // Format: "120 lbs" or "54 kg"
  hairColor?: string
  eyeColor?: string
  url?: string
}

interface NcmecApiResponse {
  cases: NcmecRecord[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

// ---------------------------------------------------------------
// Mock data generator (realistic for testing)
// Deterministic based on index for reproducibility
// ---------------------------------------------------------------
function generateMockNcmecRecords(count: number): NcmecRecord[] {
  const firstNames = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'William', 'Sophia', 'James', 'Isabella', 'Oliver']
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Martinez']
  const states = ['CA', 'TX', 'FL', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI']
  const races = ['White', 'Black', 'Hispanic', 'Asian', 'Native American', 'Multi-racial']
  const hairColors = ['Brown', 'Black', 'Blonde', 'Red', 'Auburn']
  const eyeColors = ['Brown', 'Blue', 'Green', 'Hazel', 'Gray']

  const records: NcmecRecord[] = []

  for (let i = 0; i < count; i++) {
    const year = 2020 + (i % 5)
    const month = String((i % 12) + 1).padStart(2, '0')
    const day = String((i % 28) + 1).padStart(2, '0')
    const age = 3 + (i % 15)

    records.push({
      caseNumber: `NCMEC-MOCK-${String(i + 1).padStart(6, '0')}`,
      orgName: 'National Center for Missing & Exploited Children',
      firstName: firstNames[i % firstNames.length]!,
      lastName: lastNames[i % lastNames.length]!,
      missingDate: `${year}-${month}-${day}`,
      missingCity: ['Miami', 'Houston', 'Los Angeles', 'New York', 'Chicago'][i % 5],
      missingState: states[i % states.length],
      missingCountry: 'US',
      missingAge: age,
      race: races[i % races.length],
      sex: i % 2 === 0 ? 'Female' : 'Male',
      photoUrl: `https://www.missingkids.org/content/dam/poster/ncmc/ncmc${String(i + 1).padStart(6, '0')}.jpg`,
      height: `${4 + Math.floor(age / 5)}'${i % 12}"`,
      weight: `${60 + age * 3} lbs`,
      hairColor: hairColors[i % hairColors.length],
      eyeColor: eyeColors[i % eyeColors.length],
      url: `https://www.missingkids.org/case/${String(i + 1).padStart(6, '0')}`,
    })
  }

  return records
}

// ---------------------------------------------------------------
// Parse height string to cm
// Handles: "5'4"", "64 inches", "163 cm"
// ---------------------------------------------------------------
function parseHeightString(height: string): number | null {
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
function parseWeightString(weight: string): number | null {
  if (!weight) return null

  const lbsMatch = weight.match(/(\d+)\s*lbs?/)
  if (lbsMatch) {
    return Math.round(parseInt(lbsMatch[1]!, 10) * 0.453592)
  }

  const kgMatch = weight.match(/(\d+)\s*kg/)
  if (kgMatch) {
    return parseInt(kgMatch[1]!, 10)
  }

  return null
}

// ---------------------------------------------------------------
// NCMEC Adapter
// ---------------------------------------------------------------
export class NcmecAdapter extends BaseAdapter {
  readonly sourceId: CaseSource = 'ncmec'
  readonly sourceName = 'NCMEC Poster API'
  readonly pollingIntervalMinutes = 60 // 1 hour (30 min when live)

  private readonly baseUrl = 'https://api.missingkids.org/poster/ncmc'

  get isMockMode(): boolean {
    return !process.env.NCMEC_API_KEY
  }

  async fetch(options: FetchOptions = {}): Promise<RawRecord[]> {
    if (this.isMockMode) {
      return this.fetchMock(options)
    }
    return this.fetchLive(options)
  }

  private async fetchMock(options: FetchOptions = {}): Promise<RawRecord[]> {
    logger.warn(
      { source: this.sourceId },
      'NCMEC Adapter: running in MOCK MODE — NCMEC_API_KEY not set'
    )

    const page = options.page ?? 1
    const pageSize = 20
    const totalMockRecords = 100

    if (page > Math.ceil(totalMockRecords / pageSize)) {
      return []
    }

    const start = (page - 1) * pageSize
    const records = generateMockNcmecRecords(totalMockRecords).slice(start, start + pageSize)

    // Simulate API latency
    await this.sleep(200)

    return records as RawRecord[]
  }

  private async fetchLive(options: FetchOptions = {}): Promise<RawRecord[]> {
    const apiKey = process.env.NCMEC_API_KEY!
    const maxPages = options.maxPages ?? 50
    const allRecords: NcmecRecord[] = []

    logger.info({ source: this.sourceId }, 'NCMEC Adapter: starting live fetch')

    let page = options.page ?? 1

    while (page <= maxPages) {
      try {
        const url = `${this.baseUrl}?pageNumber=${page}&pageSize=20`

        const response = await this.fetchWithRetry(
          url,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          },
          5,       // 5 retries for critical source
          10_000   // 10s initial backoff
        )

        const data = (await response.json()) as NcmecApiResponse

        if (!data.cases || data.cases.length === 0) break

        allRecords.push(...data.cases)

        const totalPages = Math.ceil(data.totalCount / data.pageSize)
        if (page >= totalPages) break

        page++
        await this.sleep(1000)
      } catch (err) {
        logger.error(
          { source: this.sourceId, page, err },
          'NCMEC Adapter: fetch failed'
        )
        break
      }
    }

    logger.info(
      { source: this.sourceId, count: allRecords.length },
      'NCMEC Adapter: live fetch complete'
    )

    return allRecords as RawRecord[]
  }

  normalize(raw: RawRecord): NormalizedCase {
    const record = raw as NcmecRecord

    return {
      externalId: record.caseNumber,
      source: this.sourceId,
      firstName: record.firstName ?? null,
      lastName: record.lastName ?? null,
      nameNormalized: this.normalizeName(record.firstName, record.lastName),
      dateOfBirth: null, // NCMEC doesn't expose exact DOB
      missingDate: this.parseDate(record.missingDate),
      lastSeenLocation: [record.missingCity, record.missingState]
        .filter(Boolean)
        .join(', ') || null,
      lastSeenLat: null,
      lastSeenLng: null,
      lastSeenCountry: this.normalizeCountryCode(record.missingCountry),
      description: null,
      gender: this.normalizeGender(record.sex),
      race: record.race ?? null,
      age: record.missingAge ?? null,
      ageRange:
        record.currentMinAge != null && record.currentMaxAge != null
          ? { min: record.currentMinAge, max: record.currentMaxAge }
          : null,
      heightCm: record.height ? parseHeightString(record.height) : null,
      weightKg: record.weight ? parseWeightString(record.weight) : null,
      photoUrls: record.photoUrl ? [record.photoUrl] : [],
      status: 'missing',
      sourceUrl: record.url ?? `https://www.missingkids.org/case/${record.caseNumber}`,
      rawData: raw,
    }
  }
}

// Singleton export
export const ncmecAdapter = new NcmecAdapter()
