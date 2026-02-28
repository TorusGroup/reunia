#!/usr/bin/env npx tsx
// =============================================================
// Full NCMEC Ingestion Script — DS-01 (Sprint 5)
// Ingests ALL available pages from NCMEC public endpoint
// Usage: npx tsx scripts/full-ncmec-ingest.ts [--max-pages N] [--batch-size N] [--delay-ms N]
// =============================================================

import { PrismaClient, type Prisma } from '@prisma/client'

// ---------------------------------------------------------------
// Configuration (CLI args or defaults)
// ---------------------------------------------------------------
const args = process.argv.slice(2)
function getArg(name: string, defaultValue: number): number {
  const idx = args.indexOf(`--${name}`)
  if (idx !== -1 && args[idx + 1]) {
    return parseInt(args[idx + 1]!, 10)
  }
  return defaultValue
}

const MAX_PAGES = getArg('max-pages', 999)   // effectively unlimited
const BATCH_SIZE = getArg('batch-size', 10)  // pages per batch before pause
const DELAY_MS = getArg('delay-ms', 2500)    // delay between requests (be respectful)
const BATCH_PAUSE_MS = getArg('batch-pause-ms', 5000) // pause between batches

const NCMEC_BASE_URL = 'https://api.missingkids.org/missingkids/servlet/JSONDataServlet'
const NCMEC_PHOTO_BASE = 'https://api.missingkids.org'

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------
interface NcmecPublicCase {
  id?: number
  caseNumber?: string
  orgPrefix?: string
  orgName?: string
  firstName?: string
  middleName?: string
  lastName?: string
  missingDate?: string
  missingCity?: string
  missingCounty?: string
  missingState?: string
  missingCountry?: string
  age?: number
  approxAge?: string
  race?: string
  sex?: string
  height?: string
  weight?: string
  hairColor?: string
  eyeColor?: string
  hasThumbnail?: boolean
  hasPoster?: boolean
  thumbnailUrl?: string
  imageUrl?: string
  caseType?: string
  isChild?: boolean
  url?: string
}

interface NcmecApiResponse {
  persons?: NcmecPublicCase[]
  subject?: NcmecPublicCase[]
  cases?: NcmecPublicCase[]
  totalRecords?: number
  totalPages?: number
  thisPage?: number
}

// ---------------------------------------------------------------
// Logging
// ---------------------------------------------------------------
function log(msg: string) {
  const ts = new Date().toISOString()
  console.log(`[ncmec-ingest ${ts}] ${msg}`)
}

function logError(msg: string) {
  const ts = new Date().toISOString()
  console.error(`[ncmec-ingest ${ts}] ERROR: ${msg}`)
}

// ---------------------------------------------------------------
// Height/Weight parsers
// ---------------------------------------------------------------
function parseHeightString(height: string | null | undefined): number | null {
  if (!height) return null
  const feetInchesMatch = height.match(/(\d+)['′]\s*(\d+)?["″]?/)
  if (feetInchesMatch) {
    const feet = parseInt(feetInchesMatch[1]!, 10)
    const inches = parseInt(feetInchesMatch[2] ?? '0', 10)
    return Math.round((feet * 12 + inches) * 2.54)
  }
  const inchesMatch = height.match(/(\d+)\s*inch/)
  if (inchesMatch) return Math.round(parseInt(inchesMatch[1]!, 10) * 2.54)
  const cmMatch = height.match(/(\d+)\s*cm/)
  if (cmMatch) return parseInt(cmMatch[1]!, 10)
  return null
}

function parseWeightString(weight: string | null | undefined): number | null {
  if (!weight) return null
  const lbsMatch = weight.match(/(\d+(?:\.\d+)?)\s*lbs?/i)
  if (lbsMatch) return Math.round(parseFloat(lbsMatch[1]!) * 0.453592)
  const kgMatch = weight.match(/(\d+(?:\.\d+)?)\s*kg/i)
  if (kgMatch) return Math.round(parseFloat(kgMatch[1]!))
  return null
}

function normalizeGender(gender: string | null | undefined): 'male' | 'female' | 'other' | null {
  if (!gender) return null
  const g = gender.toLowerCase().trim()
  if (g === 'm' || g === 'male' || g === 'man') return 'male'
  if (g === 'f' || g === 'female' || g === 'woman') return 'female'
  if (g === 'other') return 'other'
  return null
}

function normalizeName(first: string | null, last: string | null): string {
  return [first, last]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

// ---------------------------------------------------------------
// Fetch with retry
// ---------------------------------------------------------------
async function fetchWithRetry(url: string, maxAttempts = 3, initialDelay = 3000): Promise<Response> {
  let lastError: Error = new Error('Unknown')
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30_000)
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ReunIA/1.0 (Missing Children Search Platform; contact@reunia.org)',
          Accept: 'application/json',
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
        const delay = initialDelay * Math.pow(2, attempt - 1)
        log(`  Retry ${attempt}/${maxAttempts} in ${delay}ms...`)
        await sleep(delay)
      }
    }
  }
  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------
// Main ingestion logic
// ---------------------------------------------------------------
async function main() {
  log('=== NCMEC Full Ingestion Starting ===')
  log(`Config: max-pages=${MAX_PAGES}, batch-size=${BATCH_SIZE}, delay=${DELAY_MS}ms`)

  const prisma = new PrismaClient()

  try {
    // Verify DB connection
    const caseCount = await prisma.case.count()
    log(`DB connected. Current total cases: ${caseCount}`)

    // Ensure DataSource exists
    const dataSource = await prisma.dataSource.upsert({
      where: { slug: 'ncmec' },
      update: { name: 'NCMEC Public Search' },
      create: {
        slug: 'ncmec',
        name: 'NCMEC Public Search',
        apiType: 'rest',
        pollingIntervalMinutes: 120,
        isActive: true,
      },
    })

    // Create ingestion log
    const ingestionLog = await prisma.ingestionLog.create({
      data: {
        dataSourceId: dataSource.id,
        startedAt: new Date(),
        status: 'running',
      },
    })

    let totalFetched = 0
    let totalInserted = 0
    let totalUpdated = 0
    let totalSkipped = 0
    let totalFailed = 0
    let totalPages = 0
    let page = 1
    const startTime = Date.now()

    // Step 1: Discovery — find out how many pages exist
    log('Step 1: Discovering total pages...')
    const discoveryUrl = `${NCMEC_BASE_URL}?action=publicSearch&searchLang=en&goToPage=1&pageSize=25`
    const discoveryResp = await fetchWithRetry(discoveryUrl)
    const discoveryData = (await discoveryResp.json()) as NcmecApiResponse
    totalPages = discoveryData.totalPages ?? 0
    const totalRecords = discoveryData.totalRecords ?? 0

    log(`Discovery complete: ${totalRecords} total records across ${totalPages} pages`)

    if (totalPages === 0) {
      log('No pages found. Exiting.')
      await prisma.ingestionLog.update({
        where: { id: ingestionLog.id },
        data: { completedAt: new Date(), status: 'success', recordsFetched: 0 },
      })
      await prisma.$disconnect()
      return
    }

    const effectiveMaxPages = Math.min(MAX_PAGES, totalPages)
    log(`Will process ${effectiveMaxPages} of ${totalPages} pages`)

    // Step 2: Ingest page by page
    while (page <= effectiveMaxPages) {
      const batchEnd = Math.min(page + BATCH_SIZE - 1, effectiveMaxPages)
      log(`--- Batch: pages ${page}-${batchEnd} of ${effectiveMaxPages} ---`)

      for (; page <= batchEnd; page++) {
        try {
          const url = `${NCMEC_BASE_URL}?action=publicSearch&searchLang=en&goToPage=${page}&pageSize=25`
          const response = await fetchWithRetry(url)
          const data = (await response.json()) as NcmecApiResponse
          const cases = data.persons ?? data.subject ?? data.cases ?? []

          if (cases.length === 0) {
            log(`  Page ${page}: 0 records (empty page — stopping)`)
            page = effectiveMaxPages + 1 // break outer
            break
          }

          totalFetched += cases.length

          // Process each case
          for (const rawCase of cases) {
            try {
              const result = await upsertCase(prisma, rawCase)
              if (result === 'inserted') totalInserted++
              else if (result === 'updated') totalUpdated++
              else totalSkipped++
            } catch (err) {
              totalFailed++
              const msg = err instanceof Error ? err.message : String(err)
              if (totalFailed <= 10) {
                logError(`  Record failed: ${rawCase.caseNumber ?? rawCase.id} — ${msg}`)
              }
            }
          }

          log(`  Page ${page}/${effectiveMaxPages} — ${cases.length} records — Running totals: ${totalInserted} inserted, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalFailed} failed`)

          // Respect rate limits
          await sleep(DELAY_MS)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          logError(`  Page ${page} fetch failed: ${msg}`)
          totalFailed++

          // If we get rate limited (429), wait longer and retry
          if (msg.includes('429')) {
            log('  Rate limited! Waiting 30s...')
            await sleep(30000)
          }
        }
      }

      // Batch pause
      if (page <= effectiveMaxPages) {
        log(`  Batch complete. Pausing ${BATCH_PAUSE_MS}ms...`)
        await sleep(BATCH_PAUSE_MS)
      }
    }

    const durationMs = Date.now() - startTime
    const durationMinutes = (durationMs / 60000).toFixed(1)

    // Update ingestion log
    await prisma.ingestionLog.update({
      where: { id: ingestionLog.id },
      data: {
        completedAt: new Date(),
        status: 'success',
        recordsFetched: totalFetched,
        recordsInserted: totalInserted,
        recordsUpdated: totalUpdated,
        recordsSkipped: totalSkipped,
        recordsFailed: totalFailed,
        durationMs,
      },
    })

    // Update data source
    await prisma.dataSource.update({
      where: { id: dataSource.id },
      data: {
        lastFetchedAt: new Date(),
        lastSuccessAt: new Date(),
        lastErrorMessage: null,
        isActive: true,
        totalRecordsFetched: { increment: totalFetched },
      },
    })

    // Final stats
    const finalCaseCount = await prisma.case.count()
    const ncmecCaseCount = await prisma.case.count({ where: { source: 'ncmec' } })

    log('=== NCMEC Full Ingestion Complete ===')
    log(`Duration: ${durationMinutes} minutes (${durationMs}ms)`)
    log(`Total fetched: ${totalFetched}`)
    log(`Inserted: ${totalInserted}`)
    log(`Updated: ${totalUpdated}`)
    log(`Skipped (dedup): ${totalSkipped}`)
    log(`Failed: ${totalFailed}`)
    log(`NCMEC cases in DB: ${ncmecCaseCount}`)
    log(`Total cases in DB: ${finalCaseCount}`)

    await prisma.$disconnect()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logError(`Fatal error: ${msg}`)
    await prisma.$disconnect()
    process.exit(1)
  }
}

// ---------------------------------------------------------------
// Upsert a single NCMEC case into the database
// Returns: 'inserted' | 'updated' | 'skipped'
// ---------------------------------------------------------------
async function upsertCase(
  prisma: PrismaClient,
  rawCase: NcmecPublicCase
): Promise<'inserted' | 'updated' | 'skipped'> {
  const prefix = rawCase.orgPrefix ?? 'NCMC'
  const externalId = rawCase.caseNumber
    ? `${prefix}${rawCase.caseNumber}`
    : rawCase.id != null
      ? `NCMEC-${rawCase.id}`
      : `NCMEC-${Date.now()}`

  // Build photo URL
  const photoUrls: string[] = []
  if (rawCase.imageUrl) {
    photoUrls.push(rawCase.imageUrl.startsWith('http') ? rawCase.imageUrl : `${NCMEC_PHOTO_BASE}${rawCase.imageUrl}`)
  } else if (rawCase.thumbnailUrl) {
    photoUrls.push(rawCase.thumbnailUrl.startsWith('http') ? rawCase.thumbnailUrl : `${NCMEC_PHOTO_BASE}${rawCase.thumbnailUrl}`)
  }

  const lastSeenLocation = [rawCase.missingCity, rawCase.missingState]
    .filter(Boolean)
    .join(', ') || null

  // Check for exact match (same source + externalId)
  const existing = await prisma.case.findFirst({
    where: { source: 'ncmec', sourceId: externalId },
    select: {
      id: true,
      persons: {
        where: { role: 'missing_child' },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (existing) {
    // Update existing
    await prisma.case.update({
      where: { id: existing.id },
      data: {
        lastSyncedAt: new Date(),
        lastSeenLocation: lastSeenLocation ?? undefined,
      },
    })

    if (existing.persons[0]) {
      await prisma.person.update({
        where: { id: existing.persons[0].id },
        data: {
          heightCm: parseHeightString(rawCase.height) ?? undefined,
          weightKg: parseWeightString(rawCase.weight) ?? undefined,
        },
      })
    }

    return 'updated'
  }

  // Create new case + person + image
  const caseNumber = `NCMEC-${externalId.slice(0, 30)}`
  const missingDate = parseDate(rawCase.missingDate)
  const sourceUrl = rawCase.url ??
    (rawCase.caseNumber
      ? `https://www.missingkids.org/poster/${prefix}/${rawCase.caseNumber}`
      : null)

  await prisma.$transaction(async (tx) => {
    const newCase = await tx.case.create({
      data: {
        caseNumber,
        caseType: 'missing',
        status: 'active',
        urgency: 'standard',
        reportedAt: missingDate ?? new Date(),
        source: 'ncmec',
        sourceId: externalId,
        sourceUrl,
        lastSeenAt: missingDate ?? null,
        lastSeenLocation,
        lastSeenLat: null,
        lastSeenLng: null,
        lastSeenCountry: 'US',
        circumstances: null,
        lastSyncedAt: new Date(),
        consentGiven: true,
        consentType: 'public_interest',
        dataQuality: computeQualityScore(rawCase, photoUrls),
        sources: {
          create: {
            sourceSlug: 'ncmec',
            sourceId: externalId,
            sourceUrl,
            fetchedAt: new Date(),
            rawData: rawCase as unknown as Prisma.InputJsonValue,
          },
        },
      },
    })

    const newPerson = await tx.person.create({
      data: {
        caseId: newCase.id,
        role: 'missing_child',
        firstName: rawCase.firstName ?? null,
        lastName: rawCase.lastName ?? null,
        dateOfBirth: null,
        approximateAge: rawCase.age ?? null,
        gender: normalizeGender(rawCase.sex),
        nationality: ['US'],
        ethnicity: rawCase.race ?? null,
        heightCm: parseHeightString(rawCase.height),
        weightKg: parseWeightString(rawCase.weight),
      },
    })

    // Create image records
    for (let i = 0; i < photoUrls.length; i++) {
      await tx.image.create({
        data: {
          personId: newPerson.id,
          storageUrl: photoUrls[i]!,
          storageKey: `ncmec/${externalId}/photo-${i}`,
          imageType: 'photo',
          isPrimary: i === 0,
          sourceAttribution: 'ncmec',
        },
      })
    }
  })

  return 'inserted'
}

// ---------------------------------------------------------------
// Simple quality score (0-100)
// ---------------------------------------------------------------
function computeQualityScore(rawCase: NcmecPublicCase, photoUrls: string[]): number {
  let score = 0
  if (rawCase.firstName) score += 15
  if (rawCase.lastName) score += 15
  if (rawCase.missingDate) score += 10
  if (rawCase.missingCity || rawCase.missingState) score += 10
  if (rawCase.age != null) score += 10
  if (rawCase.sex) score += 5
  if (rawCase.race) score += 5
  if (rawCase.height) score += 5
  if (rawCase.weight) score += 5
  if (photoUrls.length > 0) score += 20
  return Math.min(score, 100)
}

// ---------------------------------------------------------------
// Run
// ---------------------------------------------------------------
main().catch((err) => {
  logError(`Unhandled: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
