import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyAccessToken, extractBearerToken } from '@/lib/auth'
import { writeAuditLog, getIpFromHeaders } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'
import type { MeResponse } from '@/types/auth'

// =============================================================
// GET /api/v1/auth/me (E1-S04)
// Returns current authenticated user
// =============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ip = getIpFromHeaders(request.headers)
  const userAgent = request.headers.get('user-agent') ?? undefined

  // Extract and verify JWT
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
  } catch (err) {
    const isExpired = err instanceof Error && err.message.includes('expired')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: isExpired ? ErrorCodes.TOKEN_EXPIRED : ErrorCodes.INVALID_TOKEN,
          message: isExpired ? 'Token expired' : 'Invalid token',
        },
      },
      { status: 401 }
    )
  }

  try {
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        orgId: true,
        emailVerified: true,
        mfaEnabled: true,
        createdAt: true,
        lastLoginAt: true,
        accountLocked: true,
        lockedUntil: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: ErrorCodes.NOT_FOUND, message: 'User not found' },
        },
        { status: 404 }
      )
    }

    // Check if account is locked (in case it was locked after token was issued)
    if (user.accountLocked) {
      return NextResponse.json(
        {
          success: false,
          error: { code: ErrorCodes.ACCOUNT_LOCKED, message: 'Account is locked' },
        },
        { status: 403 }
      )
    }

    const response: MeResponse = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as MeResponse['role'],
      orgId: user.orgId ?? undefined,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString(),
    }

    return NextResponse.json({ success: true, data: response })
  } catch (err) {
    logger.error({ err, userId: payload.sub }, 'Failed to fetch current user')
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.INTERNAL_ERROR, message: 'Internal server error' },
      },
      { status: 500 }
    )
  }
}
