// =============================================================
// POST /api/v1/ingestion/backfill-photos
// Backfill Interpol image URLs for OpenSanctions records
// that were ingested without photos.
//
// The OpenSanctions CSV dump doesn't include photos, but the
// Interpol API serves images at a predictable URL pattern:
//   https://ws-public.interpol.int/notices/v1/yellow/{id}/images/default
//
// This endpoint adds Image records for OpenSanctions persons
// that currently have zero images.
//
// Auth: admin API key required
// =============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { checkAdminAuth } from '@/lib/admin-auth'

export const maxDuration = 300

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth check
  const auth = await checkAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  logger.info('backfill-photos: starting OpenSanctions photo URL backfill')

  try {
    // Find all OpenSanctions cases where the person has zero images
    // The case.source = 'opensanctions' and case.sourceId starts with 'interpol-yellow-'
    const casesWithoutPhotos = await db.$queryRaw<
      Array<{
        case_id: string
        person_id: string
        source_id: string
      }>
    >`
      SELECT c.id AS case_id, p.id AS person_id, c.source_id
      FROM cases c
      JOIN persons p ON p.case_id = c.id
      LEFT JOIN images i ON i.person_id = p.id
      WHERE c.source = 'opensanctions'
        AND c.source_id LIKE 'interpol-yellow-%'
        AND i.id IS NULL
    `

    logger.info(
      { count: casesWithoutPhotos.length },
      'backfill-photos: found OpenSanctions persons without images'
    )

    let created = 0
    let skipped = 0
    let failed = 0

    // Process in batches to avoid memory issues
    const BATCH_SIZE = 500
    for (let offset = 0; offset < casesWithoutPhotos.length; offset += BATCH_SIZE) {
      const batch = casesWithoutPhotos.slice(offset, offset + BATCH_SIZE)

      const createData = batch
        .map((row) => {
          // Extract notice ID: "interpol-yellow-1987-11591" -> "1987-11591"
          const match = row.source_id.match(/^interpol-yellow-(\d+-\d+)$/)
          if (!match) {
            skipped++
            return null
          }

          const noticeSlug = match[1]
          const imageUrl = `https://ws-public.interpol.int/notices/v1/yellow/${noticeSlug}/images/default`

          return {
            personId: row.person_id,
            storageUrl: imageUrl,
            storageKey: `opensanctions/${row.source_id}/photo-0`,
            imageType: 'photo' as const,
            isPrimary: true,
            sourceAttribution: 'opensanctions',
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)

      if (createData.length > 0) {
        try {
          const result = await db.image.createMany({
            data: createData,
            skipDuplicates: true,
          })
          created += result.count
        } catch (err) {
          logger.error(
            { err, offset, batchSize: createData.length },
            'backfill-photos: batch insert failed'
          )
          failed += createData.length
        }
      }

      // Log progress
      if ((offset + BATCH_SIZE) % 2000 === 0 || offset + BATCH_SIZE >= casesWithoutPhotos.length) {
        logger.info(
          { processed: offset + batch.length, total: casesWithoutPhotos.length, created, skipped, failed },
          'backfill-photos: progress'
        )
      }
    }

    logger.info(
      { total: casesWithoutPhotos.length, created, skipped, failed },
      'backfill-photos: complete'
    )

    return NextResponse.json({
      success: true,
      data: {
        totalCasesWithoutPhotos: casesWithoutPhotos.length,
        imagesCreated: created,
        skipped,
        failed,
      },
    })
  } catch (err) {
    logger.error({ err }, 'backfill-photos: failed')
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
