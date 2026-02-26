// =============================================================
// GET  /api/v1/ingestion    — Get ingestion status for all sources
// POST /api/v1/ingestion    — Trigger manual ingestion
// =============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { triggerManualIngestion, getScheduleStatus } from '@/services/jobs/scheduler'
import type { CaseSource } from '@prisma/client'

// ---------------------------------------------------------------
// POST body schema
// ---------------------------------------------------------------
const triggerSchema = z.object({
  source: z.enum(['fbi', 'interpol', 'ncmec', 'amber']),
  options: z
    .object({
      maxPages: z.number().int().min(1).max(100).optional(),
    })
    .optional(),
})

// ---------------------------------------------------------------
// GET /api/v1/ingestion — Status overview
// ---------------------------------------------------------------
export async function GET(): Promise<NextResponse> {
  try {
    // Get recent ingestion logs per source
    const recentLogs = await db.ingestionLog.findMany({
      where: {
        startedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // last 24h
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 40,
      include: {
        dataSource: {
          select: {
            slug: true,
            name: true,
            lastSuccessAt: true,
            lastErrorAt: true,
            totalRecordsFetched: true,
            isActive: true,
          },
        },
      },
    })

    // Get schedule status
    const schedules = await getScheduleStatus()

    // Aggregate by source
    const sourceMap = new Map<
      string,
      {
        slug: string
        name: string
        isActive: boolean
        lastSuccessAt: Date | null
        lastErrorAt: Date | null
        totalRecordsFetched: number
        recentRuns: Array<{
          id: string
          startedAt: Date
          completedAt: Date | null
          status: string
          recordsFetched: number
          recordsInserted: number
          recordsUpdated: number
          durationMs: number | null
        }>
        nextRunAt: Date | null
      }
    >()

    for (const log of recentLogs) {
      const slug = log.dataSource.slug
      if (!sourceMap.has(slug)) {
        const schedule = schedules.find((s) => String(s.source) === slug)
        sourceMap.set(slug, {
          slug,
          name: log.dataSource.name,
          isActive: log.dataSource.isActive,
          lastSuccessAt: log.dataSource.lastSuccessAt,
          lastErrorAt: log.dataSource.lastErrorAt,
          totalRecordsFetched: log.dataSource.totalRecordsFetched,
          recentRuns: [],
          nextRunAt: schedule?.nextRunAt ?? null,
        })
      }

      sourceMap.get(slug)!.recentRuns.push({
        id: log.id,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        status: log.status,
        recordsFetched: log.recordsFetched,
        recordsInserted: log.recordsInserted,
        recordsUpdated: log.recordsUpdated,
        durationMs: log.durationMs,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        sources: Array.from(sourceMap.values()),
        updatedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    logger.error({ err }, 'GET /api/v1/ingestion: error')
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch ingestion status' } },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------
// POST /api/v1/ingestion — Trigger manual ingestion
// Note: In production, restrict to admin/system roles
// ---------------------------------------------------------------
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
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

    const { source, options } = validation.data

    const jobId = await triggerManualIngestion(source as CaseSource, options)

    logger.info({ source, jobId }, 'POST /api/v1/ingestion: manual ingestion triggered')

    return NextResponse.json({
      success: true,
      data: {
        source,
        jobId,
        message: `Ingestion job queued for ${source}`,
        triggeredAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ err }, 'POST /api/v1/ingestion: error')

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: errMsg } },
      { status: 500 }
    )
  }
}
