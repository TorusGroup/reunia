// =============================================================
// ReunIA — POST /api/v1/face/match
// Upload image → find matches in database
// Results ALWAYS go through HITL queue before family notification
// =============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAccessToken, extractBearerToken } from '@/lib/auth'
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
  // Auth — optional for public face search
  //
  // Public (anonymous) users can submit face searches with stricter
  // rate limits (5/min vs 10/min for auth, 30/min for LE).
  // This is critical for a missing children platform — anyone who
  // spots a missing child should be able to search.
  // All matches go through HITL review regardless (NON-NEGOTIABLE).
  // ---------------------------------------------------------------
  const token = extractBearerToken(request.headers.get('authorization'))

  let userId: string | undefined
  let userRole: UserRole = 'public'

  if (token) {
    try {
      const payload = verifyAccessToken(token)
      userId = payload.sub
      userRole = payload.role
    } catch {
      // Invalid token — proceed as public user rather than rejecting.
      // A citizen who happens to have an expired cookie should still
      // be able to search for missing children.
      logger.debug({ ip }, 'POST /api/v1/face/match: invalid token, proceeding as public')
    }
  }

  // ---------------------------------------------------------------
  // Rate limiting:
  //   - Public (anonymous): 5 matches per minute
  //   - Authenticated (volunteer/family): 10 per minute
  //   - Law enforcement / admin: 30 per minute
  // ---------------------------------------------------------------
  const rateLimit =
    userRole === 'law_enforcement' || userRole === 'admin'
      ? 30
      : userId
        ? 10
        : 5
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
        engine: pipelineResult.engine ?? 'unknown',
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
