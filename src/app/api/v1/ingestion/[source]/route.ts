// =============================================================
// GET /api/v1/ingestion/[source] — Status for a specific source
// =============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { fbiAdapter } from '@/services/ingestion/fbi-adapter'
import { interpolAdapter } from '@/services/ingestion/interpol-adapter'
import { ncmecAdapter } from '@/services/ingestion/ncmec-adapter'
import { amberAdapter } from '@/services/ingestion/amber-adapter'
import type { ISourceAdapter } from '@/services/ingestion/base-adapter'

const ADAPTERS: Record<string, ISourceAdapter> = {
  fbi: fbiAdapter,
  interpol: interpolAdapter,
  ncmec: ncmecAdapter,
  amber: amberAdapter,
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
): Promise<NextResponse> {
  const { source } = await params

  const adapter = ADAPTERS[source]
  if (!adapter) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Unknown source: ${source}. Available: ${Object.keys(ADAPTERS).join(', ')}`,
        },
      },
      { status: 404 }
    )
  }

  try {
    // Get data source from DB
    const dataSource = await db.dataSource.findUnique({
      where: { slug: source },
    })

    // Get recent logs for this source
    const recentLogs = await db.ingestionLog.findMany({
      where: {
        dataSource: { slug: source },
      },
      orderBy: { startedAt: 'desc' },
      take: 10,
    })

    // Get live status from adapter
    const status = await adapter.getStatus()

    return NextResponse.json({
      success: true,
      data: {
        source,
        name: adapter.sourceName,
        pollingIntervalMinutes: adapter.pollingIntervalMinutes,
        adapterStatus: status,
        dataSource: dataSource
          ? {
              isActive: dataSource.isActive,
              lastFetchedAt: dataSource.lastFetchedAt,
              lastSuccessAt: dataSource.lastSuccessAt,
              lastErrorAt: dataSource.lastErrorAt,
              lastErrorMessage: dataSource.lastErrorMessage,
              totalRecordsFetched: dataSource.totalRecordsFetched,
            }
          : null,
        recentRuns: recentLogs.map((log) => ({
          id: log.id,
          startedAt: log.startedAt,
          completedAt: log.completedAt,
          status: log.status,
          recordsFetched: log.recordsFetched,
          recordsInserted: log.recordsInserted,
          recordsUpdated: log.recordsUpdated,
          recordsSkipped: log.recordsSkipped,
          recordsFailed: log.recordsFailed,
          durationMs: log.durationMs,
          errorMessage: log.errorMessage,
        })),
      },
    })
  } catch (err) {
    logger.error({ source, err }, `GET /api/v1/ingestion/${source}: error`)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch source status' },
      },
      { status: 500 }
    )
  }
}
