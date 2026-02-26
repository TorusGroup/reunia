// =============================================================
// ReunIA — POST /api/v1/face/embed
// Generate ArcFace embedding for a case photo
// Requires: ngo or admin role (used by ingestion pipeline)
// =============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAccessToken, extractBearerToken } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { writeAuditLog, getIpFromHeaders } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { faceClient } from '@/services/face/face-client'
import { storeEmbedding } from '@/services/face/embedding-store'
import { db } from '@/lib/db'
import { rateLimitCheck } from '@/lib/redis'
import { ErrorCodes } from '@/types'

const MAX_BASE64_SIZE = 14 * 1024 * 1024

const bodySchema = z.object({
  image_id: z.string().uuid('image_id must be a valid UUID'),
  image_base64: z.string().min(100).max(MAX_BASE64_SIZE),
  /** Optional bounding box to skip auto-detection */
  face_bbox: z
    .object({
      x: z.number().int().min(0),
      y: z.number().int().min(0),
      w: z.number().int().min(1),
      h: z.number().int().min(1),
    })
    .optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getIpFromHeaders(request.headers)

  // ---------------------------------------------------------------
  // Auth — embedding generation requires ngo or higher
  // ---------------------------------------------------------------
  const token = extractBearerToken(request.headers.get('authorization'))

  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.UNAUTHORIZED, message: 'Authentication required' } },
      { status: 401 }
    )
  }

  let userId: string | undefined
  try {
    const payload = verifyAccessToken(token)
    userId = payload.sub

    if (!can(payload.role, 'ingestion:trigger')) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.FORBIDDEN, message: 'Access denied' } },
        { status: 403 }
      )
    }
  } catch {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.INVALID_TOKEN, message: 'Invalid token' } },
      { status: 401 }
    )
  }

  // ---------------------------------------------------------------
  // Rate limiting: 100 embeds per minute
  // ---------------------------------------------------------------
  const rateKey = `face:embed:${userId ?? 'anon'}`
  const rateResult = await rateLimitCheck(rateKey, 60, 100)

  if (!rateResult.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.RATE_LIMIT_EXCEEDED,
          message: 'Too many requests. Max 100 embeddings per minute.',
        },
      },
      { status: 429 }
    )
  }

  // ---------------------------------------------------------------
  // Body validation
  // ---------------------------------------------------------------
  let body: z.infer<typeof bodySchema>
  try {
    const rawBody = await request.json()
    const result = bodySchema.safeParse(rawBody)
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Invalid request body',
            details: result.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }
    body = result.data
  } catch {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid JSON' } },
      { status: 400 }
    )
  }

  // ---------------------------------------------------------------
  // Verify image exists and get personId
  // ---------------------------------------------------------------
  const image = await db.image.findUnique({
    where: { id: body.image_id },
    select: { id: true, personId: true, consentForProcessing: true },
  })

  if (!image) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.NOT_FOUND, message: 'Image not found' } },
      { status: 404 }
    )
  }

  if (!image.consentForProcessing) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: 'Consent for biometric processing not given for this image',
        },
      },
      { status: 403 }
    )
  }

  // ---------------------------------------------------------------
  // Generate embedding via face service
  // ---------------------------------------------------------------
  try {
    const embedResult = await faceClient.embed(body.image_base64, body.face_bbox)

    // Store embedding in pgvector
    const embeddingId = await storeEmbedding({
      imageId: body.image_id,
      personId: image.personId,
      embedding: embedResult.embedding,
      faceBbox: body.face_bbox ?? null,
      faceConfidence: embedResult.face_confidence,
      faceQuality: embedResult.face_quality,
    })

    // Update image hasFace flag
    await db.image.update({
      where: { id: body.image_id },
      data: {
        hasFace: true,
        faceCount: 1,
        faceQualityScore: embedResult.face_quality ?? undefined,
      },
    })

    writeAuditLog({
      userId,
      action: 'images.upload',
      resourceType: 'face_embedding',
      resourceId: embeddingId,
      details: {
        imageId: body.image_id,
        personId: image.personId,
        faceConfidence: embedResult.face_confidence,
        faceQuality: embedResult.face_quality,
        processingMs: embedResult.processing_ms,
      },
      ipAddress: ip,
    })

    return NextResponse.json({
      success: true,
      data: {
        embedding_id: embeddingId,
        embedding_dims: embedResult.embedding_dims,
        face_confidence: embedResult.face_confidence,
        face_quality: embedResult.face_quality,
        processing_ms: embedResult.processing_ms,
      },
    })
  } catch (err) {
    logger.error({ err, imageId: body.image_id }, 'POST /api/v1/face/embed: failed')

    const isServiceUnavailable =
      err instanceof Error &&
      (err.message.includes('timeout') || err.message.includes('ECONNREFUSED'))

    return NextResponse.json(
      {
        success: false,
        error: {
          code: isServiceUnavailable ? ErrorCodes.SERVICE_UNAVAILABLE : ErrorCodes.INTERNAL_ERROR,
          message: isServiceUnavailable
            ? 'Face embedding service temporarily unavailable'
            : 'Failed to generate face embedding',
        },
      },
      { status: isServiceUnavailable ? 503 : 500 }
    )
  }
}
