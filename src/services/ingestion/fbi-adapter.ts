// =============================================================
// FBI Wanted API Adapter — E2-S02
// Endpoint: GET https://api.fbi.gov/wanted/v1/list
// No auth required — public API
// Rate: 1 req/sec (precautionary)
// =============================================================

import { logger } from '@/lib/logger'
import { BaseAdapter } from '@/services/ingestion/base-adapter'
import { splitFullName } from '@/services/ingestion/normalizer'
import type { NormalizedCase, RawRecord, FetchOptions } from '@/services/ingestion/base-adapter'
import type { CaseSource } from '@prisma/client'

// ---------------------------------------------------------------
// FBI API response types
// ---------------------------------------------------------------
interface FbiApiResponse {
  total: number
  page: number
  items: FbiRecord[]
}

interface FbiRecord {
  uid: string
  title: string
  description?: string
  caution?: string
  classification?: string
  poster_classification?: string
  subjects?: string[]
  dates_of_birth_used?: string[]
  possible_birth_years?: string[]
  height_min?: number
  height_max?: number
  weight_min?: number
  weight_max?: number
  sex?: string
  race?: string
  race_raw?: string[]
  nationality?: string
  age_range?: number[]
  images?: Array<{
    original: string
    thumb?: string
    caption?: string
  }>
  possible_states?: string[]
  locations?: string[]
  url?: string
  missing_persons?: Array<{
    missing_from?: string
    date?: string
    age?: number
    sex?: string
    race?: string
  }>
}

// ---------------------------------------------------------------
// FBI Adapter
// ---------------------------------------------------------------
export class FbiAdapter extends BaseAdapter {
  readonly sourceId: CaseSource = 'fbi'
  readonly sourceName = 'FBI Wanted — Missing Persons'
  readonly pollingIntervalMinutes = 360 // 6 hours

  private readonly baseUrl = 'https://api.fbi.gov/wanted/v1/list'
  private readonly pageSize = 50

  // Client-side heuristic: returns true if a record is a missing/kidnapped person.
  //
  // Uses structured FBI API fields (poster_classification, subjects) instead of
  // free-text search in description/caution — the old approach matched CRIMINALS
  // who committed kidnapping (e.g. Iranian intelligence operatives) rather than
  // the actual missing victims.
  //
  // Relevant poster_classification values: "missing", "kidnapping"
  // Relevant subjects: "Kidnappings and Missing Persons", "ViCAP Missing Persons",
  //                     "ViCAP Unidentified Persons"
  private isMissingPerson(record: FbiRecord): boolean {
    // Explicit missing_persons array (rarely populated but authoritative)
    if (record.missing_persons && record.missing_persons.length > 0) return true

    // poster_classification is the primary structured indicator
    const posterClass = (record.poster_classification ?? '').toLowerCase()
    if (posterClass === 'missing' || posterClass === 'kidnapping') return true

    // subjects array contains category tags
    const subjects = (record.subjects ?? []).map((s) => s.toLowerCase())
    const missingSubjects = [
      'kidnappings and missing persons',
      'vicap missing persons',
      'vicap unidentified persons',
    ]
    if (subjects.some((s) => missingSubjects.includes(s))) return true

    return false
  }

  async fetch(options: FetchOptions = {}): Promise<RawRecord[]> {
    const maxPages = options.maxPages ?? 30
    const allRecords: FbiRecord[] = []

    logger.info({ source: this.sourceId }, 'FBI Adapter: starting fetch')

    let page = options.page ?? 1

    while (page <= maxPages) {
      try {
        // No person_classification filter — the "Missing Persons" value returns 0 results.
        // We fetch all wanted records and apply client-side filtering below.
        const url = `${this.baseUrl}?page=${page}&pageSize=${this.pageSize}`

        // Use shorter retry delays (1s initial) to avoid Railway request timeouts
        const response = await this.fetchWithRetry(url, {}, 3, 1000)
        const data = (await response.json()) as FbiApiResponse

        if (!data.items || data.items.length === 0) {
          logger.info({ source: this.sourceId, page }, 'FBI Adapter: no more records')
          break
        }

        allRecords.push(...data.items)

        // Check if we've fetched all pages
        const totalPages = Math.ceil(data.total / this.pageSize)
        if (page >= totalPages) break

        page++

        // Respect rate limit: 1 req/sec
        await this.sleep(1000)
      } catch (err) {
        logger.error(
          { source: this.sourceId, page, err },
          'FBI Adapter: page fetch failed'
        )
        // Stop pagination on error — return what we have
        break
      }
    }

    // Filter to missing-persons records. If none match (e.g. schema changed),
    // fall back to all records so the platform keeps working.
    const missingOnly = allRecords.filter((r) => this.isMissingPerson(r))
    const finalRecords = missingOnly.length > 0 ? missingOnly : allRecords

    logger.info(
      {
        source: this.sourceId,
        total: allRecords.length,
        missingFiltered: finalRecords.length,
      },
      'FBI Adapter: fetch complete'
    )

    return finalRecords as RawRecord[]
  }

  normalize(raw: RawRecord): NormalizedCase {
    const record = raw as FbiRecord

    // Parse name: FBI uses "LASTNAME, FIRSTNAME" or "FIRSTNAME LASTNAME"
    const { firstName, lastName } = splitFullName(record.title ?? '')

    // Dates
    let dateOfBirth: Date | null = null
    if (record.dates_of_birth_used?.[0]) {
      dateOfBirth = this.parseDate(record.dates_of_birth_used[0])
    }

    // Extract missing date from missing_persons if available
    let missingDate: Date | null = null
    let lastSeenLocation: string | null = null
    let missingPersonAge: number | null = null

    if (record.missing_persons?.[0]) {
      const mp = record.missing_persons[0]
      missingDate = this.parseDate(mp.date ?? null)
      lastSeenLocation = mp.missing_from ?? null
      missingPersonAge = this.parseAge(mp.age)
    }

    // Physical
    const heightCm =
      record.height_min != null ? this.inchesToCm(record.height_min) : null
    const weightKg =
      record.weight_min != null ? this.lbsToKg(record.weight_min) : null

    // Photos
    const photoUrls = (record.images ?? [])
      .map((img) => img.original)
      .filter((url): url is string => Boolean(url))

    // Age range
    let ageRange: { min: number; max: number } | null = null
    if (record.age_range && record.age_range.length >= 2) {
      ageRange = {
        min: record.age_range[0]!,
        max: record.age_range[1]!,
      }
    }

    // Gender
    const rawGender = record.sex ?? record.missing_persons?.[0]?.sex
    const gender = this.normalizeGender(rawGender)

    // Race
    const race =
      record.race_raw?.[0] ??
      record.race ??
      record.missing_persons?.[0]?.race ??
      null

    return {
      externalId: record.uid,
      source: this.sourceId,
      firstName,
      lastName,
      nameNormalized: this.normalizeName(firstName, lastName),
      dateOfBirth,
      missingDate,
      lastSeenLocation,
      lastSeenLat: null,
      lastSeenLng: null,
      lastSeenCountry: 'US',
      description: record.description ?? null,
      gender,
      race,
      age: missingPersonAge,
      ageRange,
      heightCm,
      weightKg,
      photoUrls,
      status: 'missing',
      sourceUrl: record.url ?? `https://www.fbi.gov/wanted/kidnap/${record.uid}`,
      rawData: raw,
    }
  }
}

// Singleton export
export const fbiAdapter = new FbiAdapter()
