// =============================================================
// POST /api/v1/ingestion/trigger
// Synchronous ingestion trigger — NO BullMQ, runs inline
// Auth: x-admin-key header (simple shared secret)
// =============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { runIngestion } from '@/services/ingestion/pipeline'
import { fbiAdapter } from '@/services/ingestion/fbi-adapter'
import { interpolAdapter } from '@/services/ingestion/interpol-adapter'
import { ncmecPublicAdapter } from '@/services/ingestion/ncmec-public-adapter'
import type { ISourceAdapter } from '@/services/ingestion/base-adapter'

// Extend Railway's default 30s timeout — ingestion can take a few minutes
// Railway Pro supports up to 300s; Hobby plan up to 60s
export const maxDuration = 300

// ---------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------
const triggerSchema = z.object({
  source: z.enum(['fbi', 'interpol', 'ncmec', 'all']),
  // FBI: 1 page = 50 records, ~2s | Interpol: blocked (403), returns 0 gracefully
  // NCMEC public: 1 page = 25 records, ~5s
  // Default 1 page to avoid HTTP timeouts on Railway Hobby plan (60s limit)
  // Use maxPages:5-20 only if you have Railway Pro (300s) and need bulk import
  maxPages: z.number().int().min(1).max(50).optional().default(1),
})

// ---------------------------------------------------------------
// Adapter map
// ---------------------------------------------------------------
const ADAPTERS: Record<string, ISourceAdapter> = {
  fbi: fbiAdapter,
  interpol: interpolAdapter,
  ncmec: ncmecPublicAdapter,
}

// ---------------------------------------------------------------
// Admin key check (simple shared secret)
// Header: x-admin-key: <value of ADMIN_INGESTION_KEY env var>
// Falls back to "reunia-admin" if env var not set — for Railway
// ---------------------------------------------------------------
function checkAdminAuth(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_INGESTION_KEY ?? 'reunia-admin'
  const headerKey = request.headers.get('x-admin-key')
  return headerKey === adminKey
}

// ---------------------------------------------------------------
// POST /api/v1/ingestion/trigger
// ---------------------------------------------------------------
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth check
  if (!checkAdminAuth(request)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid x-admin-key header',
        },
      },
      { status: 401 }
    )
  }

  // Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const validation = triggerSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: validation.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    )
  }

  const { source, maxPages } = validation.data
  const startedAt = new Date()

  logger.info({ source, maxPages }, 'POST /api/v1/ingestion/trigger: starting sync ingestion')

  try {
    // Determine which adapters to run
    const adaptersToRun: Array<{ name: string; adapter: ISourceAdapter }> =
      source === 'all'
        ? Object.entries(ADAPTERS).map(([name, adapter]) => ({ name, adapter }))
        : [{ name: source, adapter: ADAPTERS[source]! }]

    const results: Array<{
      source: string
      recordsFetched: number
      recordsInserted: number
      recordsUpdated: number
      recordsSkipped: number
      recordsFailed: number
      durationMs: number
      errors: Array<{ error: string; externalId?: string }>
    }> = []

    // Run adapters sequentially (sync, no BullMQ)
    for (const { name, adapter } of adaptersToRun) {
      logger.info({ source: name }, `Trigger: running ingestion for ${name}`)

      try {
        const result = await runIngestion(adapter, { maxPages })
        results.push({
          source: name,
          recordsFetched: result.recordsFetched,
          recordsInserted: result.recordsInserted,
          recordsUpdated: result.recordsUpdated,
          recordsSkipped: result.recordsSkipped,
          recordsFailed: result.recordsFailed,
          durationMs: result.durationMs,
          errors: result.errors.slice(0, 10), // cap error details in response
        })

        logger.info(
          {
            source: name,
            inserted: result.recordsInserted,
            updated: result.recordsUpdated,
            skipped: result.recordsSkipped,
            failed: result.recordsFailed,
          },
          `Trigger: ${name} ingestion complete`
        )
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        logger.error({ source: name, err }, `Trigger: ${name} ingestion failed`)
        results.push({
          source: name,
          recordsFetched: 0,
          recordsInserted: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          recordsFailed: -1,
          durationMs: 0,
          errors: [{ error: errMsg }],
        })
      }
    }

    const totalInserted = results.reduce((sum, r) => sum + r.recordsInserted, 0)
    const totalUpdated = results.reduce((sum, r) => sum + r.recordsUpdated, 0)
    const totalFetched = results.reduce((sum, r) => sum + r.recordsFetched, 0)
    const totalDurationMs = Date.now() - startedAt.getTime()

    logger.info(
      { source, totalFetched, totalInserted, totalUpdated, totalDurationMs },
      'POST /api/v1/ingestion/trigger: all ingestions complete'
    )

    return NextResponse.json({
      success: true,
      data: {
        source,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        totalDurationMs,
        summary: {
          totalFetched,
          totalInserted,
          totalUpdated,
          totalSkipped: results.reduce((sum, r) => sum + r.recordsSkipped, 0),
          totalFailed: results.reduce((sum, r) => sum + r.recordsFailed, 0),
        },
        results,
      },
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error({ source, err }, 'POST /api/v1/ingestion/trigger: top-level failure')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: errMsg,
        },
      },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------
// GET /api/v1/ingestion/trigger — health check / info
// ---------------------------------------------------------------
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    data: {
      description: 'Synchronous ingestion trigger endpoint (no BullMQ required)',
      usage: 'POST /api/v1/ingestion/trigger with body { source: "fbi" | "interpol" | "ncmec" | "all", maxPages?: number }',
      auth: 'Header: x-admin-key: <ADMIN_INGESTION_KEY env var>',
      availableSources: Object.keys(ADAPTERS),
      defaultMaxPages: 1,
      notes: [
        'FBI: 1 page = 50 records, ~2s. Filters missing persons client-side.',
        'Interpol: blocked by cloud IP (403), returns 0 gracefully.',
        'NCMEC: public endpoint, no auth, 1 page = 25 records, ~5s.',
        'Use maxPages conservatively to avoid Railway 60s timeout (Hobby) or 300s (Pro).',
      ],
    },
  })
}
