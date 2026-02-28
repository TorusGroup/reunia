// =============================================================
// AMBER Alert RSS Adapter — E2-S05 (partial)
// Parses public AMBER Alert RSS feeds
// Rate: poll every 15 minutes
// =============================================================

import { logger } from '@/lib/logger'
import { BaseAdapter } from '@/services/ingestion/base-adapter'
import type { NormalizedCase, RawRecord, FetchOptions } from '@/services/ingestion/base-adapter'
import type { CaseSource } from '@prisma/client'

// ---------------------------------------------------------------
// AMBER Alert RSS feed URLs
// Multiple feeds increase coverage
// ---------------------------------------------------------------
const AMBER_RSS_FEEDS = [
  'https://www.amberalert.gov/feed/rss',
  // NCMEC AMBER RSS feed (public, no auth required)
  'https://www.missingkids.org/missingkids/servlet/RSSServlet',
  // State-specific feeds can be added here
]

// Fallback: if rss-parser isn't available, use manual XML parsing
type RssItem = {
  title?: string
  link?: string
  description?: string
  pubDate?: string
  guid?: string
  'enclosure'?: { url?: string }
  contentEncoded?: string
}

interface ParsedFeed {
  items: RssItem[]
  feedUrl?: string
  title?: string
}

// ---------------------------------------------------------------
// Manual RSS XML parser (no deps)
// ---------------------------------------------------------------
function parseRssXml(xml: string): ParsedFeed {
  const items: RssItem[] = []

  // Extract all <item> blocks
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)

  for (const match of itemMatches) {
    const itemXml = match[1] ?? ''

    const getTag = (tag: string): string | undefined => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's'))
      return m?.[1]?.trim()
    }

    const enclosureUrl = (() => {
      const m = itemXml.match(/<enclosure[^>]+url="([^"]+)"/)
      return m?.[1]
    })()

    items.push({
      title: getTag('title'),
      link: getTag('link'),
      description: getTag('description'),
      pubDate: getTag('pubDate'),
      guid: getTag('guid'),
      'enclosure': enclosureUrl ? { url: enclosureUrl } : undefined,
      contentEncoded: getTag('content:encoded') ?? getTag('content'),
    })
  }

  return { items }
}

// ---------------------------------------------------------------
// Parse AMBER Alert description text for data extraction
// Alert descriptions usually include: name, age, race, gender, location
// Example: "Missing: JANE DOE, 7-year-old white female, last seen in Miami, FL"
// ---------------------------------------------------------------
function parseAmberDescription(text: string): {
  firstName: string | null
  lastName: string | null
  age: number | null
  race: string | null
  gender: 'male' | 'female' | 'other' | 'unknown'
  location: string | null
} {
  // Extract age
  const ageMatch = text.match(/(\d+)[\s-]*year[\s-]*old/i)
  const age = ageMatch ? parseInt(ageMatch[1]!, 10) : null

  // Extract gender
  const genderMatch = text.match(/\b(male|female|boy|girl)\b/i)
  let gender: 'male' | 'female' | 'other' | 'unknown' = 'unknown'
  if (genderMatch) {
    const g = genderMatch[1]!.toLowerCase()
    if (g === 'male' || g === 'boy') gender = 'male'
    else if (g === 'female' || g === 'girl') gender = 'female'
  }

  // Extract race
  const raceTerms = ['white', 'black', 'hispanic', 'asian', 'native american', 'multi-racial', 'mixed']
  let race: string | null = null
  for (const raceTerm of raceTerms) {
    if (text.toLowerCase().includes(raceTerm)) {
      race = raceTerm
      break
    }
  }

  // Extract location
  const locationMatch = text.match(/(?:last seen|missing from|abducted from|from)\s+([^,.]+(?:,\s*[A-Z]{2})?)/i)
  const location = locationMatch ? locationMatch[1]?.trim() ?? null : null

  // Extract name (common patterns in AMBER alerts)
  const nameMatch = text.match(/(?:missing|alert)[:\s]+([A-Z][A-Z\s]+?)(?=,|\s+\d+|\s+year)/i)
  let firstName: string | null = null
  let lastName: string | null = null

  if (nameMatch?.[1]) {
    const parts = nameMatch[1].trim().split(/\s+/)
    if (parts.length >= 2) {
      firstName = parts[0] ?? null
      lastName = parts.slice(1).join(' ')
    } else {
      firstName = parts[0] ?? null
    }
  }

  return { firstName, lastName, age, race, gender, location }
}

// ---------------------------------------------------------------
// AMBER Adapter
// ---------------------------------------------------------------
export class AmberAdapter extends BaseAdapter {
  readonly sourceId: CaseSource = 'amber'
  readonly sourceName = 'AMBER Alert RSS Feeds'
  readonly pollingIntervalMinutes = 15 // Highest frequency — AMBER alerts are urgent

  async fetch(options: FetchOptions = {}): Promise<RawRecord[]> {
    const allItems: Array<RssItem & { _feedUrl: string }> = []

    logger.info({ source: this.sourceId }, 'AMBER Adapter: starting RSS fetch')

    for (const feedUrl of AMBER_RSS_FEEDS) {
      try {
        // Try with rss-parser first (if available)
        const items = await this.fetchFeed(feedUrl)
        allItems.push(...items.map((item) => ({ ...item, _feedUrl: feedUrl })))
        await this.sleep(1000)
      } catch (err) {
        logger.warn(
          { feedUrl, err },
          'AMBER Adapter: failed to fetch RSS feed'
        )
      }
    }

    // If no real feeds work, return empty (don't mock AMBER — real-time data only)
    if (allItems.length === 0) {
      logger.info(
        { source: this.sourceId },
        'AMBER Adapter: no RSS items fetched (feeds may be unavailable or empty)'
      )
    }

    logger.info(
      { source: this.sourceId, count: allItems.length },
      'AMBER Adapter: RSS fetch complete'
    )

    return allItems as RawRecord[]
  }

  private async fetchFeed(feedUrl: string): Promise<RssItem[]> {
    let xmlContent: string

    try {
      // Try to use rss-parser if available
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Parser = require('rss-parser') as new () => {
        parseURL(url: string): Promise<{ items: RssItem[] }>
      }
      const parser = new Parser()
      const feed = await parser.parseURL(feedUrl)
      return feed.items
    } catch {
      // Fall back to manual XML fetch + parse
      const response = await this.fetchWithRetry(feedUrl, {
        headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
      })
      xmlContent = await response.text()
      const parsed = parseRssXml(xmlContent)
      return parsed.items
    }
  }

  normalize(raw: RawRecord): NormalizedCase {
    const record = raw as RssItem & { _feedUrl: string }

    const title = record.title ?? ''
    const description = record.description ?? record.contentEncoded ?? ''
    const fullText = `${title} ${description}`

    // Parse structured data from the description text
    const parsed = parseAmberDescription(fullText)

    // Parse date
    const pubDate = record.pubDate ? this.parseDate(record.pubDate) : null

    // Use GUID or title hash as external ID
    const externalId =
      record.guid ??
      record.link ??
      `amber-${Buffer.from(title).toString('base64').slice(0, 20)}`

    // Photo from enclosure
    const photoUrls: string[] = []
    if (record.enclosure?.url) {
      photoUrls.push(record.enclosure.url)
    }

    return {
      externalId,
      source: this.sourceId,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      nameNormalized: this.normalizeName(parsed.firstName, parsed.lastName),
      dateOfBirth: null, // AMBER RSS doesn't include DOB
      missingDate: pubDate,
      lastSeenLocation: parsed.location,
      lastSeenLat: null,
      lastSeenLng: null,
      lastSeenCountry: 'US',
      description: description.replace(/<[^>]*>/g, '').trim() || null,
      gender: parsed.gender,
      race: parsed.race,
      age: parsed.age,
      ageRange: null,
      heightCm: null,
      weightKg: null,
      photoUrls,
      status: 'missing',
      sourceUrl: record.link ?? null,
      rawData: raw,
    }
  }
}

// Singleton export
export const amberAdapter = new AmberAdapter()
