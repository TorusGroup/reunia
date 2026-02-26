// =============================================================
// GET /api/v1/data-sources — List all configured data sources
// =============================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(): Promise<NextResponse> {
  try {
    const dataSources = await db.dataSource.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { ingestionLogs: true },
        },
        ingestionLogs: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          select: {
            startedAt: true,
            completedAt: true,
            status: true,
            recordsFetched: true,
            recordsInserted: true,
            durationMs: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        dataSources: dataSources.map((ds) => ({
          id: ds.id,
          slug: ds.slug,
          name: ds.name,
          description: ds.description,
          url: ds.url,
          apiType: ds.apiType,
          authRequired: ds.authRequired,
          pollingIntervalMinutes: ds.pollingIntervalMinutes,
          isActive: ds.isActive,
          lastFetchedAt: ds.lastFetchedAt,
          lastSuccessAt: ds.lastSuccessAt,
          lastErrorAt: ds.lastErrorAt,
          lastErrorMessage: ds.lastErrorMessage,
          totalRecordsFetched: ds.totalRecordsFetched,
          totalRuns: ds._count.ingestionLogs,
          lastRun: ds.ingestionLogs[0] ?? null,
        })),
        total: dataSources.length,
      },
    })
  } catch (err) {
    logger.error({ err }, 'GET /api/v1/data-sources: error')
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch data sources' },
      },
      { status: 500 }
    )
  }
}
