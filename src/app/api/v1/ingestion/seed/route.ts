// =============================================================
// GET /api/v1/ingestion/seed
// Seeds the DataSource table with the known ingestion sources.
// Idempotent — skips sources that already exist (upsert by slug).
// Auth: admin required (S-03)
// =============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { checkAdminAuth } from '@/lib/admin-auth'

const SEED_SOURCES = [
  {
    slug: 'fbi',
    name: 'FBI Wanted — Missing Persons',
    description: 'FBI Most Wanted list filtered for Missing Persons classification.',
    url: 'https://api.fbi.gov/wanted/v1/list',
    apiType: 'rest_json',
    authRequired: false,
    pollingIntervalMinutes: 360,
    isActive: true,
  },
  {
    slug: 'interpol',
    name: 'Interpol Yellow Notices',
    description: 'Interpol Yellow Notices for missing children (ages 0–17).',
    url: 'https://ws-public.interpol.int/notices/v1/yellow',
    apiType: 'rest_json',
    authRequired: false,
    pollingIntervalMinutes: 720,
    isActive: true,
  },
  {
    slug: 'ncmec',
    name: 'NCMEC — National Center for Missing & Exploited Children',
    description: 'US national database for missing and exploited children.',
    url: 'https://www.missingkids.org',
    apiType: 'rest_json',
    authRequired: true,
    pollingIntervalMinutes: 1440,
    isActive: false, // pending API credentials
  },
  {
    slug: 'amber',
    name: 'AMBER Alert',
    description: 'AMBER Alert system for child abduction emergency alerts.',
    url: 'https://www.amberalert.gov',
    apiType: 'rest_json',
    authRequired: true,
    pollingIntervalMinutes: 60,
    isActive: false, // pending API credentials
  },
  {
    slug: 'opensanctions',
    name: 'OpenSanctions — Interpol Yellow Notices',
    description: 'Interpol Yellow Notices via OpenSanctions daily CSV dump. Workaround for Interpol API cloud IP blocks.',
    url: 'https://data.opensanctions.org/datasets/latest/interpol_yellow_notices/targets.simple.csv',
    apiType: 'csv',
    authRequired: false,
    pollingIntervalMinutes: 1440,
    isActive: true,
  },
  {
    slug: 'cnpd-brasil',
    name: 'CNPD Brasil — Disque 100',
    description: 'Brazilian national database — Disque 100 Direitos Humanos.',
    url: 'https://www.gov.br/mdh',
    apiType: 'rest_json',
    authRequired: true,
    pollingIntervalMinutes: 1440,
    isActive: false, // pending API credentials
  },
]

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Auth check — admin required (S-03)
  const adminAuth = await checkAdminAuth(request)
  if (!adminAuth.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required' } },
      { status: 401 }
    )
  }

  try {
    const results: Array<{ slug: string; action: 'created' | 'exists' }> = []

    for (const source of SEED_SOURCES) {
      const existing = await db.dataSource.findUnique({ where: { slug: source.slug } })

      if (existing) {
        results.push({ slug: source.slug, action: 'exists' })
      } else {
        await db.dataSource.create({ data: source })
        results.push({ slug: source.slug, action: 'created' })
        logger.info({ slug: source.slug }, 'Seed: DataSource created')
      }
    }

    const created = results.filter((r) => r.action === 'created').length
    const existed = results.filter((r) => r.action === 'exists').length

    logger.info({ created, existed }, 'GET /api/v1/ingestion/seed: complete')

    return NextResponse.json({
      success: true,
      data: {
        message: `Seed complete: ${created} created, ${existed} already existed`,
        created,
        existed,
        sources: results,
      },
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error({ err }, 'GET /api/v1/ingestion/seed: error')
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errMsg },
      },
      { status: 500 }
    )
  }
}
