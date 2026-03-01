// =============================================================
// OpenSanctions Adapter — Interpol Yellow Notices via CSV dump
// Endpoint: https://data.opensanctions.org/datasets/latest/interpol_yellow_notices/targets.simple.csv
// No auth required — public dataset
// Workaround: Interpol's own API blocks cloud IPs (403)
// =============================================================

import { logger } from '@/lib/logger'
import { BaseAdapter } from '@/services/ingestion/base-adapter'
import type { NormalizedCase, RawRecord, FetchOptions } from '@/services/ingestion/base-adapter'
import type { CaseSource } from '@prisma/client'

// ---------------------------------------------------------------
// CSV row shape after parsing
// ---------------------------------------------------------------
interface OpenSanctionsRow {
  id: string
  schema: string
  name: string
  aliases: string
  birth_date: string
  countries: string
  addresses: string
  identifiers: string
  sanctions: string
  phones: string
  emails: string
  dataset: string
  first_seen: string
  last_seen: string
  last_change: string
}

// ---------------------------------------------------------------
// OpenSanctions Adapter
// ---------------------------------------------------------------
export class OpenSanctionsAdapter extends BaseAdapter {
  readonly sourceId: CaseSource = 'opensanctions'
  readonly sourceName = 'OpenSanctions — Interpol Yellow Notices'
  readonly pollingIntervalMinutes = 1440 // 24 hours (daily dump)

  private readonly csvUrl =
    'https://data.opensanctions.org/datasets/latest/interpol_yellow_notices/targets.simple.csv'

  async fetch(_options: FetchOptions = {}): Promise<RawRecord[]> {
    logger.info(
      { source: this.sourceId, url: this.csvUrl },
      'OpenSanctions Adapter: starting CSV fetch'
    )

    const response = await this.fetchWithRetry(
      this.csvUrl,
      {
        headers: {
          'User-Agent': 'ReunIA/1.0 (Missing Children Search Platform; contact@reunia.org)',
          Accept: 'text/csv, text/plain, */*',
        },
      },
      3,
      5000
    )

    const csvText = await response.text()
    const lines = csvText.split('\n')

    if (lines.length < 2) {
      logger.warn({ source: this.sourceId }, 'OpenSanctions: CSV has no data rows')
      return []
    }

    // Parse header
    const headerLine = lines[0]
    if (!headerLine) {
      logger.warn({ source: this.sourceId }, 'OpenSanctions: empty header line')
      return []
    }
    const headers = this.parseCsvLine(headerLine)

    // Parse rows
    const records: OpenSanctionsRow[] = []
    let parseErrors = 0

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line || line.trim() === '') continue

      try {
        const fields = this.parseCsvLine(line)
        const row: Record<string, string> = {}
        for (let j = 0; j < headers.length; j++) {
          row[headers[j]!] = fields[j] ?? ''
        }

        // Filter: only Person schema
        if (row['schema'] !== 'Person') continue

        records.push(row as unknown as OpenSanctionsRow)
      } catch {
        parseErrors++
        if (parseErrors <= 5) {
          logger.warn(
            { source: this.sourceId, line: i },
            'OpenSanctions: failed to parse CSV line'
          )
        }
      }

      // Progress logging every 1000 records
      if (records.length > 0 && records.length % 1000 === 0) {
        logger.info(
          { source: this.sourceId, parsed: records.length, lineIndex: i },
          `OpenSanctions: parsed ${records.length} Person records so far`
        )
      }
    }

    logger.info(
      {
        source: this.sourceId,
        totalLines: lines.length,
        personRecords: records.length,
        parseErrors,
      },
      'OpenSanctions Adapter: CSV parsing complete'
    )

    return records as RawRecord[]
  }

  normalize(raw: RawRecord): NormalizedCase {
    const record = raw as OpenSanctionsRow

    const externalId = record.id || `opensanctions-${Date.now()}`

    // Parse name: "FIRSTNAME LASTNAME" format
    const nameParts = (record.name || '').trim().split(/\s+/)
    let firstName: string | null = null
    let lastName: string | null = null

    if (nameParts.length === 1) {
      firstName = nameParts[0] ?? null
    } else if (nameParts.length >= 2) {
      firstName = nameParts.slice(0, -1).join(' ')
      lastName = nameParts[nameParts.length - 1] ?? null
    }

    // Parse country (comma-separated ISO-2 codes)
    const countries = (record.countries || '').split(';').filter(Boolean)
    const primaryCountry = countries[0]?.trim().toUpperCase() ?? null

    // Parse birth date
    const dateOfBirth = this.parseDate(record.birth_date || null)

    // Estimate age from birth date
    let age: number | null = null
    if (dateOfBirth) {
      const now = new Date()
      age = now.getFullYear() - dateOfBirth.getFullYear()
      const monthDiff = now.getMonth() - dateOfBirth.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dateOfBirth.getDate())) {
        age--
      }
    }

    // Source URL for Interpol Yellow Notice
    // Extract notice number from ID: "interpol-yellow-YYYY-NNNNN" -> YYYY/NNNNN
    const idMatch = externalId.match(/interpol-yellow-(\d+)-(\d+)/)
    const sourceUrl = idMatch
      ? `https://www.interpol.int/en/How-we-work/Notices/View-Yellow-Notices#${idMatch[1]}-${idMatch[2]}`
      : `https://www.interpol.int/en/How-we-work/Notices/View-Yellow-Notices`

    return {
      externalId,
      source: this.sourceId,
      firstName,
      lastName,
      nameNormalized: this.normalizeName(firstName, lastName),
      dateOfBirth,
      missingDate: this.parseDate(record.first_seen || null),
      lastSeenLocation: null,
      lastSeenLat: null,
      lastSeenLng: null,
      lastSeenCountry: primaryCountry,
      description: record.aliases
        ? `Aliases: ${record.aliases}`
        : null,
      gender: 'unknown', // CSV does not include gender
      race: null,
      age,
      ageRange: null,
      heightCm: null,
      weightKg: null,
      photoUrls: [], // CSV doesn't include photos
      status: 'missing',
      sourceUrl,
      rawData: raw,
    }
  }

  // ---------------------------------------------------------------
  // Simple CSV line parser that handles quoted fields
  // ---------------------------------------------------------------
  private parseCsvLine(line: string): string[] {
    const fields: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]!

      if (inQuotes) {
        if (char === '"') {
          // Check for escaped quote ("")
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"'
            i++ // Skip the next quote
          } else {
            inQuotes = false
          }
        } else {
          current += char
        }
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === ',') {
          fields.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
    }

    // Push the last field
    fields.push(current.trim())

    return fields
  }
}

// Singleton export
export const openSanctionsAdapter = new OpenSanctionsAdapter()
