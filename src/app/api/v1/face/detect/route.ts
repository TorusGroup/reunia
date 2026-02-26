// =============================================================
// ReunIA — POST /api/v1/face/detect
// Upload image and detect faces (bounding boxes + confidence)
// =============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAccessToken, extractBearerToken } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { writeAuditLog, getIpFromHeaders } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { faceClient } from '@/services/face/face-client'
import { rateLimitCheck } from '@/lib/redis'
import { ErrorCodes } from '@/types'

const MAX_BASE64_SIZE = 14 * 1024 * 1024 // ~10MB after decode (base64 overhead ~1.37x)

const bodySchema = z.object({
  image_base64: z.string().min(100).max(MAX_BASE64_SIZE),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getIpFromHeaders(request.headers)

  // ---------------------------------------------------------------
  // Auth — face detection requires any authenticated user
  // ---------------------------------------------------------------
  const token = extractBearerToken(request.headers.get('authorization'))

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.UNAUTHORIZED, message: 'Authentication required' },
      },
      { status: 401 }
    )
  }

  let userId: string | undefined
  try {
    const payload = verifyAccessToken(token)
    userId = payload.sub

    if (!can(payload.role, 'cases:search')) {
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
  // Rate limiting: 20 detections per minute per user
  // ---------------------------------------------------------------
  const rateKey = `face:detect:${userId ?? ip ?? 'anon'}`
  const rateResult = await rateLimitCheck(rateKey, 60, 20)

  if (!rateResult.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.RATE_LIMIT_EXCEEDED,
          message: 'Too many requests. Max 20 face detections per minute.',
        },
      },
      {
        status: 429,
        headers: { 'Retry-After': rateResult.resetAt.toISOString() },
      }
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
  // Call face service
  // ---------------------------------------------------------------
  try {
    const result = await faceClient.detect(body.image_base64)

    writeAuditLog({
      userId,
      action: 'face_match.submit',
      resourceType: 'face_detection',
      details: { faceCount: result.face_count, processingMs: result.processing_ms },
      ipAddress: ip,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    logger.error({ err, userId }, 'POST /api/v1/face/detect: face service error')

    const isServiceUnavailable =
      err instanceof Error &&
      (err.message.includes('timeout') || err.message.includes('ECONNREFUSED'))

    return NextResponse.json(
      {
        success: false,
        error: {
          code: isServiceUnavailable ? ErrorCodes.SERVICE_UNAVAILABLE : ErrorCodes.INTERNAL_ERROR,
          message: isServiceUnavailable
            ? 'Face detection service temporarily unavailable'
            : 'Face detection failed',
        },
      },
      { status: isServiceUnavailable ? 503 : 500 }
    )
  }
}
