import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAccessToken, extractBearerToken } from '@/lib/auth'
import { sessionStore } from '@/lib/redis'
import { writeAuditLog, getIpFromHeaders } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'

// =============================================================
// POST /api/v1/auth/logout (E1-S04)
// Invalidates refresh token
// =============================================================

const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getIpFromHeaders(request.headers)
  const userAgent = request.headers.get('user-agent') ?? undefined

  // Must be authenticated to logout
  const token = extractBearerToken(request.headers.get('authorization'))
  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.UNAUTHORIZED, message: 'Authorization token required' },
      },
      { status: 401 }
    )
  }

  let payload
  try {
    payload = verifyAccessToken(token)
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.INVALID_TOKEN, message: 'Invalid token' },
      },
      { status: 401 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.VALIDATION_ERROR, message: 'Invalid JSON body' },
      },
      { status: 400 }
    )
  }

  const validation = logoutSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'refreshToken is required',
        },
      },
      { status: 400 }
    )
  }

  const { refreshToken } = validation.data

  // refreshToken format: {userId}:{tokenId}
  const parts = refreshToken.split(':')
  if (parts.length < 2) {
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.INVALID_TOKEN, message: 'Invalid refresh token format' },
      },
      { status: 400 }
    )
  }

  const [userId, ...tokenParts] = parts
  const tokenId = tokenParts.join(':')

  // Only allow users to invalidate their own tokens
  if (userId !== payload.sub) {
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.FORBIDDEN, message: 'Cannot invalidate another user\'s token' },
      },
      { status: 403 }
    )
  }

  try {
    await sessionStore.invalidate(userId!, tokenId)

    writeAuditLog({
      userId: payload.sub,
      action: 'auth.logout',
      resourceType: 'user',
      resourceId: payload.sub,
      ipAddress: ip,
      userAgent,
    })

    logger.info({ userId: payload.sub }, 'User logged out')

    return NextResponse.json({ success: true, data: { message: 'Logged out successfully' } })
  } catch (err) {
    logger.error({ err, userId: payload.sub }, 'Logout failed')
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Logout failed' },
      },
      { status: 500 }
    )
  }
}
