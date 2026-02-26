// =============================================================
// ReunIA — POST /api/v1/face/match
// Upload image → find matches in database
// Results ALWAYS go through HITL queue before family notification
// =============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAccessToken, extractBearerToken } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { getIpFromHeaders } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { runFaceMatchPipeline } from '@/services/face/match-pipeline'
import { rateLimitCheck } from '@/lib/redis'
import { ErrorCodes } from '@/types'
import type { UserRole } from '@/types/auth'

const MAX_BASE64_SIZE = 14 * 1024 * 1024

const bodySchema = z.object({
  image_base64: z.string().min(100).max(MAX_BASE64_SIZE),
  /** Minimum similarity threshold. Defaults to 0.55 (LOW). */
  threshold: z.number().min(0.3).max(0.99).optional(),
  max_results: z.number().int().min(1).max(50).optional(),
  sighting_id: z.string().uuid().optional(),
  /** Use precise mode (slower, higher recall) */
  precise: z.boolean().optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getIpFromHeaders(request.headers)

  // ---------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------
  const token = extractBearerToken(request.headers.get('authorization'))

  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: ErrorCodes.UNAUTHORIZED, message: 'Authentication required' } },
      { status: 401 }
    )
  }

  let userId: string | undefined
  let userRole: UserRole = 'public'

  try {
    const payload = verifyAccessToken(token)
    userId = payload.sub
    userRole = payload.role

    // Face match requires at minimum 'volunteer' role (can submit photos)
    if (!can(payload.role, 'face_match:submit')) {
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
  // Rate limiting: 10 matches per minute for citizens, 30 for LE
  // ---------------------------------------------------------------
  const rateLimit =
    userRole === 'law_enforcement' || userRole === 'admin' ? 30 : 10
  const rateKey = `face:match:${userId ?? ip ?? 'anon'}`
  const rateResult = await rateLimitCheck(rateKey, 60, rateLimit)

  if (!rateResult.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.RATE_LIMIT_EXCEEDED,
          message: `Too many requests. Max ${rateLimit} face matches per minute.`,
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
  // Determine query source
  // ---------------------------------------------------------------
  const querySource =
    userRole === 'law_enforcement' || userRole === 'admin'
      ? 'le_batch'
      : body.sighting_id
      ? 'sighting_photo'
      : 'citizen_upload'

  // ---------------------------------------------------------------
  // Run face match pipeline
  // ---------------------------------------------------------------
  try {
    const pipelineResult = await runFaceMatchPipeline({
      imageBase64: body.image_base64,
      querySource: querySource as 'citizen_upload',
      requestedById: userId,
      sightingId: body.sighting_id,
      threshold: body.threshold,
      maxResults: body.max_results,
      precise: body.precise,
    })

    if (!pipelineResult.success && !pipelineResult.faceDetected) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: pipelineResult.error ?? 'No face detected in image',
          },
        },
        { status: 422 }
      )
    }

    // ---------------------------------------------------------------
    // Response: NEVER expose raw biometric embeddings to frontend
    // Only return: similarity scores, metadata, HITL status
    // ---------------------------------------------------------------
    return NextResponse.json({
      success: true,
      data: {
        face_detected: pipelineResult.faceDetected,
        face_confidence: pipelineResult.faceConfidence,
        face_quality: pipelineResult.faceQuality,
        match_count: pipelineResult.matchCount,
        matches: pipelineResult.matches.map((m) => ({
          // DO NOT return embedding data
          face_embedding_id: m.faceEmbeddingId,
          person_id: m.personId,
          case_id: m.caseId,
          similarity: m.similarity,
          confidence_tier: m.confidenceTier,
          person_name: m.personName,
          case_number: m.caseNumber,
          primary_photo_url: m.primaryPhotoUrl,
        })),
        hitl_queued: pipelineResult.enqueuedMatchIds.length,
        processing_ms: pipelineResult.processingMs,
        // Reminder visible in all match results
        notice:
          'All matches require human review before family notification. CVV 188 for crisis support.',
      },
    })
  } catch (err) {
    logger.error({ err, userId, querySource }, 'POST /api/v1/face/match: pipeline error')

    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'Face match pipeline failed',
        },
      },
      { status: 500 }
    )
  }
}
