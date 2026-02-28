// =============================================================
// Ingestion Pipeline Orchestrator — E2-S06
// Orchestrates: fetch → normalize → dedup → score → upsert → log
// =============================================================

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { writeAuditLog } from '@/lib/audit'
import type { ISourceAdapter, NormalizedCase, IngestionResult, FetchOptions } from '@/services/ingestion/base-adapter'
import { findExactMatch, findFuzzyMatch } from '@/services/ingestion/deduplicator'
import { scoreRecord } from '@/services/ingestion/quality-scorer'
import { mapToCaseFields, mapToPersonFields } from '@/services/ingestion/normalizer'
import type { CaseSource } from '@prisma/client'

// ---------------------------------------------------------------
// Run ingestion for a single source
// Returns detailed IngestionResult with metrics
// ---------------------------------------------------------------
export async function runIngestion(
  adapter: ISourceAdapter,
  options: FetchOptions = {}
): Promise<IngestionResult> {
  const startTime = Date.now()
  const result: IngestionResult = {
    source: adapter.sourceId,
    recordsFetched: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    durationMs: 0,
    errors: [],
  }

  // Ensure data source record exists in DB
  const dataSource = await ensureDataSource(adapter)

  // Create ingestion log entry (status=running)
  const ingestionLog = await db.ingestionLog.create({
    data: {
      dataSourceId: dataSource.id,
      startedAt: new Date(),
      status: 'running',
    },
  })

  logger.info(
    { source: adapter.sourceId, logId: ingestionLog.id },
    'Pipeline: ingestion started'
  )

  try {
    // Step 1: Fetch raw records
    const rawRecords = await adapter.fetch(options)
    result.recordsFetched = rawRecords.length

    logger.info(
      { source: adapter.sourceId, count: rawRecords.length },
      'Pipeline: records fetched'
    )

    // Step 2: Process each record
    for (const raw of rawRecords) {
      try {
        // Normalize
        const normalized = adapter.normalize(raw)

        // Process the normalized record
        const outcome = await processRecord(normalized)

        switch (outcome) {
          case 'inserted':
            result.recordsInserted++
            break
          case 'updated':
            result.recordsUpdated++
            break
          case 'skipped':
            result.recordsSkipped++
            break
        }
      } catch (err) {
        result.recordsFailed++
        const errMsg = err instanceof Error ? err.message : String(err)
        result.errors.push({ error: errMsg })
        logger.error(
          { source: adapter.sourceId, err },
          'Pipeline: record processing failed'
        )
      }
    }

    // Step 3: Update data source stats
    await db.dataSource.update({
      where: { id: dataSource.id },
      data: {
        lastFetchedAt: new Date(),
        lastSuccessAt: new Date(),
        lastErrorMessage: null,
        totalRecordsFetched: {
          increment: result.recordsFetched,
        },
      },
    })

    // Step 4: Complete ingestion log
    result.durationMs = Date.now() - startTime
    await db.ingestionLog.update({
      where: { id: ingestionLog.id },
      data: {
        completedAt: new Date(),
        status: 'success',
        recordsFetched: result.recordsFetched,
        recordsInserted: result.recordsInserted,
        recordsUpdated: result.recordsUpdated,
        recordsSkipped: result.recordsSkipped,
        recordsFailed: result.recordsFailed,
        durationMs: result.durationMs,
      },
    })

    // Audit trail
    writeAuditLog({
      action: 'data_sources.trigger',
      resourceType: 'ingestion_log',
      resourceId: ingestionLog.id,
      details: {
        source: adapter.sourceId,
        recordsFetched: result.recordsFetched,
        recordsInserted: result.recordsInserted,
        recordsUpdated: result.recordsUpdated,
        recordsFailed: result.recordsFailed,
        durationMs: result.durationMs,
      },
    })

    logger.info(
      {
        source: adapter.sourceId,
        recordsFetched: result.recordsFetched,
        recordsInserted: result.recordsInserted,
        recordsUpdated: result.recordsUpdated,
        recordsSkipped: result.recordsSkipped,
        recordsFailed: result.recordsFailed,
        durationMs: result.durationMs,
      },
      `Ingestion complete: ${result.recordsInserted} new, ${result.recordsUpdated} existing, ${result.recordsSkipped} duplicates, ${result.recordsFailed} errors`
    )
  } catch (err) {
    // Top-level failure: log error and mark as failed
    const errMsg = err instanceof Error ? err.message : String(err)
    result.durationMs = Date.now() - startTime

    await db.dataSource.update({
      where: { id: dataSource.id },
      data: {
        lastFetchedAt: new Date(),
        lastErrorAt: new Date(),
        lastErrorMessage: errMsg.slice(0, 500),
      },
    })

    await db.ingestionLog.update({
      where: { id: ingestionLog.id },
      data: {
        completedAt: new Date(),
        status: 'error',
        errorMessage: errMsg.slice(0, 1000),
        errorDetails: { error: errMsg },
        durationMs: result.durationMs,
      },
    })

    logger.error(
      { source: adapter.sourceId, err, durationMs: result.durationMs },
      'Pipeline: ingestion failed'
    )

    throw err
  }

  return result
}

// ---------------------------------------------------------------
// Process a single normalized record
// Returns: 'inserted' | 'updated' | 'skipped'
// ---------------------------------------------------------------
async function processRecord(
  normalized: NormalizedCase
): Promise<'inserted' | 'updated' | 'skipped'> {
  // Step 1: Check for exact match (same source + externalId)
  const exactMatch = await findExactMatch(normalized.externalId, normalized.source)

  if (exactMatch) {
    // Update existing case with latest data
    await updateExistingCase(exactMatch.caseId, exactMatch.personId, normalized)
    return 'updated'
  }

  // Step 2: Cross-source deduplication
  const deduplication = await findFuzzyMatch(normalized)

  if (deduplication.isDuplicate && deduplication.existingCaseId) {
    // Add this source as additional provenance but don't create duplicate case
    // Check if provenance record already exists
    const existing = await db.caseSourceRecord.findFirst({
      where: {
        caseId: deduplication.existingCaseId,
        sourceSlug: String(normalized.source),
        sourceId: normalized.externalId,
      },
      select: { id: true },
    })

    if (existing) {
      await db.caseSourceRecord.update({
        where: { id: existing.id },
        data: {
          fetchedAt: new Date(),
          rawData: normalized.rawData,
        },
      })
    } else {
      await db.caseSourceRecord.create({
        data: {
          caseId: deduplication.existingCaseId,
          sourceSlug: String(normalized.source),
          sourceId: normalized.externalId,
          sourceUrl: normalized.sourceUrl ?? null,
          fetchedAt: new Date(),
          rawData: normalized.rawData,
        },
      })
    }

    return 'skipped'
  }

  // Step 3: Score data quality
  const { score } = scoreRecord(normalized)

  // Step 4: Create new case + person + images
  await createNewCase(normalized, score)

  return 'inserted'
}

// ---------------------------------------------------------------
// Create a new case, person, images, and provenance record
// ---------------------------------------------------------------
async function createNewCase(normalized: NormalizedCase, qualityScore: number): Promise<void> {
  const caseFields = mapToCaseFields(normalized)
  const personFields = mapToPersonFields(normalized)

  // Generate case number: SOURCE-EXTERNALID (truncated)
  const caseNumber = `${String(normalized.source).toUpperCase()}-${normalized.externalId.slice(0, 30)}`

  await db.$transaction(async (tx) => {
    // Create case
    const newCase = await tx.case.create({
      data: {
        ...caseFields,
        caseNumber,
        dataQuality: qualityScore,
        sources: {
          create: {
            sourceSlug: String(normalized.source),
            sourceId: normalized.externalId,
            sourceUrl: normalized.sourceUrl ?? null,
            fetchedAt: new Date(),
            rawData: normalized.rawData,
          },
        },
      },
    })

    // Create person
    const newPerson = await tx.person.create({
      data: {
        ...personFields,
        caseId: newCase.id,
      },
    })

    // Create image records (photo URLs)
    if (normalized.photoUrls.length > 0) {
      for (let i = 0; i < normalized.photoUrls.length; i++) {
        const url = normalized.photoUrls[i]!
        await tx.image.create({
          data: {
            personId: newPerson.id,
            storageUrl: url,
            storageKey: `${normalized.source}/${normalized.externalId}/photo-${i}`,
            imageType: 'photo',
            isPrimary: i === 0,
            sourceAttribution: String(normalized.source),
          },
        })
      }
    }
  })
}

// ---------------------------------------------------------------
// Update an existing case with fresh data from the same source
// ---------------------------------------------------------------
async function updateExistingCase(
  caseId: string,
  personId: string,
  normalized: NormalizedCase
): Promise<void> {
  const { score } = scoreRecord(normalized)

  await db.$transaction(async (tx) => {
    await tx.case.update({
      where: { id: caseId },
      data: {
        lastSyncedAt: new Date(),
        dataQuality: score,
        circumstances: normalized.description ?? undefined,
        lastSeenLocation: normalized.lastSeenLocation ?? undefined,
      },
    })

    await tx.person.update({
      where: { id: personId },
      data: {
        heightCm: normalized.heightCm ?? undefined,
        weightKg: normalized.weightKg ?? undefined,
      },
    })
  })
}

// ---------------------------------------------------------------
// Ensure data source record exists (upsert by slug)
// ---------------------------------------------------------------
async function ensureDataSource(
  adapter: ISourceAdapter
): Promise<{ id: string }> {
  const slug = String(adapter.sourceId)

  return db.dataSource.upsert({
    where: { slug },
    update: {
      name: adapter.sourceName,
      pollingIntervalMinutes: adapter.pollingIntervalMinutes,
    },
    create: {
      slug,
      name: adapter.sourceName,
      apiType: 'rest',
      pollingIntervalMinutes: adapter.pollingIntervalMinutes,
      isActive: true,
    },
    select: { id: true },
  })
}

// ---------------------------------------------------------------
// Run all adapters sequentially (called by scheduler)
// ---------------------------------------------------------------
export async function runAllIngestions(
  adapters: ISourceAdapter[]
): Promise<Map<CaseSource, IngestionResult>> {
  const results = new Map<CaseSource, IngestionResult>()

  for (const adapter of adapters) {
    try {
      logger.info({ source: adapter.sourceId }, 'Pipeline: starting ingestion for source')
      const result = await runIngestion(adapter)
      results.set(adapter.sourceId, result)
    } catch (err) {
      logger.error(
        { source: adapter.sourceId, err },
        'Pipeline: ingestion failed for source'
      )
    }
  }

  return results
}
