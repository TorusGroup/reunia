// =============================================================
// POST /api/v1/admin/generate-embeddings
// Sprint 4 (FS-02): Embedding Pipeline
//
// Admin endpoint that generates face embeddings for all cases
// with photos in the database. Uses the JS-native face engine
// as the primary embedding generator (no Python dependency).
//
// Features:
// - Idempotent: skips images that already have embeddings
// - Progress logging: reports X of Y processed
// - Rate-limited: processes in batches to avoid OOM
// - Auth: admin JWT or API key required
// =============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { checkAdminAuth } from '@/lib/admin-auth'
import { writeAuditLog, getIpFromHeaders } from '@/lib/audit'
import { jsGenerateEmbedding } from '@/services/face/js-face-engine'

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------

const BATCH_SIZE = 10 // Process 10 images at a time
const MAX_IMAGES_PER_REQUEST = 500 // Safety limit

// ---------------------------------------------------------------
// Handler
// ---------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth check
  const adminAuth = await checkAdminAuth(request)
  if (!adminAuth.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required' } },
      { status: 401 }
    )
  }

  const ip = getIpFromHeaders(request.headers)
  const startTime = Date.now()

  // Parse optional body parameters
  let forceRegenerate = false
  let maxImages = MAX_IMAGES_PER_REQUEST
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body === 'object' && body !== null) {
      const parsed = body as Record<string, unknown>
      if (typeof parsed.force === 'boolean') forceRegenerate = parsed.force
      if (typeof parsed.maxImages === 'number') maxImages = Math.min(parsed.maxImages, MAX_IMAGES_PER_REQUEST)
    }
  } catch {
    // No body or invalid JSON — use defaults
  }

  logger.info(
    { forceRegenerate, maxImages, adminMethod: adminAuth.method },
    'POST /api/v1/admin/generate-embeddings: starting'
  )

  try {
    // ---------------------------------------------------------------
    // Step 1: Find images that need embeddings
    // ---------------------------------------------------------------
    const whereClause: Record<string, unknown> = {
      storageUrl: { not: '' },
      person: {
        case: {
          status: { in: ['active', 'pending_review'] },
        },
      },
    }

    // If not force-regenerating, only get images without embeddings
    if (!forceRegenerate) {
      whereClause.faceEmbeddings = {
        none: {
          isSearchable: true,
          embedding: { not: null },
        },
      }
    }

    const images = await db.image.findMany({
      where: whereClause,
      select: {
        id: true,
        storageUrl: true,
        thumbnailUrl: true,
        personId: true,
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            caseId: true,
            case: {
              select: {
                id: true,
                caseNumber: true,
                consentGiven: true,
              },
            },
          },
        },
      },
      take: maxImages,
      orderBy: { createdAt: 'desc' },
    })

    if (images.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'No images need embedding generation',
          processed: 0,
          succeeded: 0,
          failed: 0,
          skipped: 0,
          durationMs: Date.now() - startTime,
        },
      })
    }

    logger.info(
      { imageCount: images.length },
      'generate-embeddings: found images to process'
    )

    // ---------------------------------------------------------------
    // Step 2: Process images in batches
    // ---------------------------------------------------------------
    let processed = 0
    let succeeded = 0
    let failed = 0
    let skipped = 0
    const errors: Array<{ imageId: string; error: string }> = []

    for (let batchStart = 0; batchStart < images.length; batchStart += BATCH_SIZE) {
      const batch = images.slice(batchStart, batchStart + BATCH_SIZE)

      for (const img of batch) {
        processed++

        // Skip if consent not given (LGPD compliance)
        if (!img.person.case.consentGiven) {
          skipped++
          logger.debug(
            { imageId: img.id, caseNumber: img.person.case.caseNumber },
            'generate-embeddings: skipped (no consent)'
          )
          continue
        }

        try {
          // Fetch the image data
          const imageUrl = img.thumbnailUrl ?? img.storageUrl
          const imageBase64 = await fetchImageAsBase64(imageUrl)

          if (!imageBase64) {
            failed++
            errors.push({ imageId: img.id, error: 'Failed to fetch image' })
            continue
          }

          // Generate embedding
          const embedResult = await jsGenerateEmbedding(imageBase64)

          // Store the embedding as a binary buffer (Float32Array)
          const float32 = new Float32Array(embedResult.embedding)
          const embeddingBuffer = Buffer.from(float32.buffer)

          // Check if embedding already exists for this image
          const existing = await db.faceEmbedding.findFirst({
            where: { imageId: img.id },
            select: { id: true },
          })

          if (existing && !forceRegenerate) {
            skipped++
            continue
          }

          if (existing) {
            // Update existing embedding
            await db.faceEmbedding.update({
              where: { id: existing.id },
              data: {
                embedding: embeddingBuffer,
                faceConfidence: embedResult.faceConfidence,
                faceQuality: embedResult.faceQuality,
                modelName: 'js-native',
                modelVersion: 'v1.0',
                isSearchable: true,
              },
            })
          } else {
            // Create new embedding
            await db.faceEmbedding.create({
              data: {
                imageId: img.id,
                personId: img.personId,
                embedding: embeddingBuffer,
                faceConfidence: embedResult.faceConfidence,
                faceQuality: embedResult.faceQuality,
                modelName: 'js-native',
                modelVersion: 'v1.0',
                isSearchable: true,
              },
            })
          }

          succeeded++

          // Progress log every 10 images
          if (processed % 10 === 0) {
            logger.info(
              { processed, total: images.length, succeeded, failed, skipped },
              'generate-embeddings: progress'
            )
          }
        } catch (err) {
          failed++
          const errorMsg = err instanceof Error ? err.message : 'Unknown error'
          errors.push({ imageId: img.id, error: errorMsg })
          logger.warn(
            { imageId: img.id, err },
            'generate-embeddings: failed to process image'
          )
        }
      }
    }

    const durationMs = Date.now() - startTime

    // Audit log
    writeAuditLog({
      userId: adminAuth.userId,
      action: 'admin.action',
      resourceType: 'face_embeddings',
      details: {
        action: 'batch_generate',
        processed,
        succeeded,
        failed,
        skipped,
        forceRegenerate,
        durationMs,
      },
      ipAddress: ip,
    })

    logger.info(
      { processed, succeeded, failed, skipped, durationMs },
      'generate-embeddings: batch complete'
    )

    return NextResponse.json({
      success: true,
      data: {
        message: `Embedding generation complete`,
        processed,
        succeeded,
        failed,
        skipped,
        durationMs,
        errors: errors.length > 0 ? errors.slice(0, 20) : undefined, // Cap error list
      },
    })
  } catch (err) {
    logger.error({ err }, 'POST /api/v1/admin/generate-embeddings: fatal error')
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Embedding generation failed' },
      },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------
// GET — Check embedding generation status
// ---------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const adminAuth = await checkAdminAuth(request)
  if (!adminAuth.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required' } },
      { status: 401 }
    )
  }

  try {
    const [totalImages, imagesWithEmbeddings, totalEmbeddings, searchableEmbeddings] =
      await Promise.all([
        db.image.count({
          where: { storageUrl: { not: '' } },
        }),
        db.image.count({
          where: {
            storageUrl: { not: '' },
            faceEmbeddings: {
              some: {
                isSearchable: true,
                embedding: { not: null },
              },
            },
          },
        }),
        db.faceEmbedding.count(),
        db.faceEmbedding.count({
          where: { isSearchable: true, embedding: { not: null } },
        }),
      ])

    const activeCases = await db.case.count({
      where: { status: { in: ['active', 'pending_review'] } },
    })

    return NextResponse.json({
      success: true,
      data: {
        totalImages,
        imagesWithEmbeddings,
        imagesWithoutEmbeddings: totalImages - imagesWithEmbeddings,
        totalEmbeddings,
        searchableEmbeddings,
        activeCases,
        coveragePercent:
          totalImages > 0
            ? Math.round((imagesWithEmbeddings / totalImages) * 100)
            : 0,
      },
    })
  } catch (err) {
    logger.error({ err }, 'GET /api/v1/admin/generate-embeddings: error')
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to check status' },
      },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------
// Helper: Fetch image URL and return base64
// ---------------------------------------------------------------

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ReunIA-EmbeddingPipeline/1.0',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      logger.warn(
        { url, status: response.status },
        'fetchImageAsBase64: HTTP error'
      )
      return null
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) {
      logger.warn(
        { url, contentType },
        'fetchImageAsBase64: non-image content type'
      )
      // Still try — some servers don't set content-type correctly
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length < 100) {
      logger.warn({ url, size: buffer.length }, 'fetchImageAsBase64: image too small')
      return null
    }

    return buffer.toString('base64')
  } catch (err) {
    logger.warn({ url, err }, 'fetchImageAsBase64: failed to fetch')
    return null
  }
}
