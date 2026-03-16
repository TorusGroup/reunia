// =============================================================
// Interpol Yellow Notices Adapter — E2-S03
// Endpoint: GET https://ws-public.interpol.int/notices/v1/yellow
// No auth required — filter ageMax=17 for children only
// Rate: 1 req/sec
// =============================================================

import { logger } from '@/lib/logger'
import { BaseAdapter } from '@/services/ingestion/base-adapter'
import type { NormalizedCase, RawRecord, FetchOptions } from '@/services/ingestion/base-adapter'
import type { CaseSource } from '@prisma/client'

// ---------------------------------------------------------------
// Interpol API response types
// ---------------------------------------------------------------
interface InterpolListResponse {
  _embedded?: {
    notices?: InterpolNotice[]
  }
  _links?: {
    next?: { href: string }
    self?: { href: string }
  }
  total?: number
  query?: {
    page: number
    resultPerPage: number
  }
}

interface InterpolNotice {
  entity_id: string
  forename: string | null
  name: string
  date_of_birth?: string
  nationalities?: string[]
  sex_id?: string | null
  country_of_birth_id?: string | null
  place_of_birth?: string | null
  height?: number | null
  weight?: number | null
  distinguishing_marks?: string | null
  languages_spoken_ids?: string[]
  _links?: {
    self?: { href: string }
    images?: { href: string }
    thumbnail?: { href: string }
  }
}

interface InterpolDetailResponse extends InterpolNotice {
  languages_spoken_ids?: string[]
  eyes_colors_id?: string[] | null
  hairs_id?: string[] | null
  specific_alert_text?: string | null
  weight?: number | null
}

interface InterpolImageListResponse {
  _embedded?: {
    images?: Array<{
      pictureId: string
      _links?: {
        self?: { href: string }
      }
    }>
  }
}

// ---------------------------------------------------------------
// Interpol Adapter
// ---------------------------------------------------------------
export class InterpolAdapter extends BaseAdapter {
  readonly sourceId: CaseSource = 'interpol'
  readonly sourceName = 'Interpol Yellow Notices (Children)'
  readonly pollingIntervalMinutes = 360 // 6 hours

  private readonly baseUrl = 'https://ws-public.interpol.int/notices/v1/yellow'

  async fetch(options: FetchOptions = {}): Promise<RawRecord[]> {
    const maxPages = options.maxPages ?? 20
    const allNotices: Array<InterpolNotice & { _detail?: InterpolDetailResponse; _photoUrls?: string[] }> = []

    logger.info({ source: this.sourceId }, 'Interpol Adapter: starting fetch')

    let currentPage = options.page ?? 1

    while (currentPage <= maxPages) {
      try {
        const url = `${this.baseUrl}?ageMin=0&ageMax=17&resultPerPage=20&page=${currentPage}`

        const response = await this.fetchWithRetry(url)
        const data = (await response.json()) as InterpolListResponse

        const notices = data._embedded?.notices ?? []

        if (notices.length === 0) {
          logger.info({ source: this.sourceId, page: currentPage }, 'Interpol Adapter: no more records')
          break
        }

        // Fetch detail + images for each notice (with rate limiting)
        for (const notice of notices) {
          const enriched = await this.enrichNotice(notice)
          allNotices.push(enriched)
          await this.sleep(1000) // 1 req/sec
        }

        // Check for next page
        if (!data._links?.next) break
        currentPage++
        await this.sleep(1000)
      } catch (err) {
        logger.error(
          { source: this.sourceId, page: currentPage, err },
          'Interpol Adapter: page fetch failed'
        )
        break
      }
    }

    logger.info(
      { source: this.sourceId, count: allNotices.length },
      'Interpol Adapter: fetch complete'
    )

    return allNotices as RawRecord[]
  }

  private async enrichNotice(
    notice: InterpolNotice
  ): Promise<InterpolNotice & { _detail?: InterpolDetailResponse; _photoUrls?: string[] }> {
    // Try to get detail
    let detail: InterpolDetailResponse | undefined
    try {
      if (notice._links?.self?.href) {
        const detailResp = await this.fetchWithRetry(notice._links.self.href)
        detail = (await detailResp.json()) as InterpolDetailResponse
      }
    } catch (err) {
      logger.warn(
        { entity_id: notice.entity_id, err },
        'Interpol Adapter: failed to fetch detail, using summary'
      )
    }

    // Try to get images
    const photoUrls: string[] = []
    try {
      if (notice._links?.images?.href) {
        const imagesResp = await this.fetchWithRetry(notice._links.images.href)
        const imageData = (await imagesResp.json()) as InterpolImageListResponse
        const images = imageData._embedded?.images ?? []
        for (const img of images) {
          if (img._links?.self?.href) {
            photoUrls.push(img._links.self.href)
          }
        }
      } else if (notice._links?.thumbnail?.href) {
        photoUrls.push(notice._links.thumbnail.href)
      }
    } catch {
      // Photos are optional — ignore errors
    }

    return { ...notice, _detail: detail, _photoUrls: photoUrls }
  }

  normalize(raw: RawRecord): NormalizedCase {
    const record = raw as InterpolNotice & {
      _detail?: InterpolDetailResponse
      _photoUrls?: string[]
    }

    const detail: InterpolDetailResponse = record._detail ?? (record as unknown as InterpolDetailResponse)
    const firstName = record.forename ?? detail.forename ?? null
    const lastName = record.name ?? detail.name

    // Parse DOB: Interpol format is YYYY/MM/DD
    let dateOfBirth: Date | null = null
    const dobStr = record.date_of_birth ?? detail.date_of_birth
    if (dobStr) {
      // Convert YYYY/MM/DD to ISO
      const isoDate = dobStr.replace(/\//g, '-')
      dateOfBirth = this.parseDate(isoDate)
    }

    // Height: Interpol returns meters
    const heightCm = detail.height != null ? this.metersToCm(detail.height) : null

    // Weight: Interpol returns kg already
    const weightKg = detail.weight != null ? Math.round(detail.weight) : null

    // Nationalities: pick first ISO alpha-2 code
    const nationalities = detail.nationalities ?? record.nationalities ?? []
    const lastSeenCountry = this.normalizeCountryCode(nationalities[0] ?? null)

    // Gender
    const gender = this.normalizeGender(detail.sex_id ?? record.sex_id)

    // Description from distinguishing marks or specific alert
    const description =
      detail.specific_alert_text ??
      detail.distinguishing_marks ??
      record.distinguishing_marks ??
      null

    const noticeId = record.entity_id.replace(/\//g, '-')
    const sourceUrl = `https://www.interpol.int/en/How-we-work/Notices/Yellow-Notices/View-Yellow-Notices/${noticeId}`

    return {
      externalId: record.entity_id,
      source: this.sourceId,
      firstName,
      lastName: lastName ?? '',
      nameNormalized: this.normalizeName(firstName, lastName),
      dateOfBirth,
      missingDate: null, // Interpol doesn't provide missing date in public API
      lastSeenLocation: record.place_of_birth ?? detail.place_of_birth ?? null,
      lastSeenLat: null,
      lastSeenLng: null,
      lastSeenCountry,
      description,
      gender,
      race: null,
      age: null,
      ageRange: null,
      heightCm,
      weightKg,
      photoUrls: record._photoUrls ?? [],
      status: 'missing',
      sourceUrl,
      rawData: raw,
    }
  }
}

// Singleton export
export const interpolAdapter = new InterpolAdapter()
