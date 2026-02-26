import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  verifyPassword,
  signAccessToken,
  generateRefreshToken,
  shouldLockAccount,
  getLockoutExpiry,
  isAccountLocked,
} from '@/lib/auth'
import { sessionStore, rateLimitCheck } from '@/lib/redis'
import { writeAuditLog, getIpFromHeaders } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { env } from '@/lib/env'
import { ErrorCodes } from '@/types'
import type { LoginResponse } from '@/types/auth'

// =============================================================
// POST /api/v1/auth/login (E1-S04)
// Returns JWT access token (RS256) + refresh token
// =============================================================

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getIpFromHeaders(request.headers)
  const userAgent = request.headers.get('user-agent') ?? undefined

  // Rate limit: 10 login attempts per minute per IP
  if (ip) {
    const rateLimit = await rateLimitCheck(`login:${ip}`, 60, 10)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ErrorCodes.RATE_LIMIT_EXCEEDED,
            message: 'Too many login attempts. Please wait 1 minute.',
          },
        },
        { status: 429 }
      )
    }
  }

  // Parse body
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

  const validation = loginSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    )
  }

  const { email, password } = validation.data

  try {
    // Find user
    const user = await db.user.findUnique({ where: { email } })

    // Generic error for non-existent users (don't reveal if account exists)
    if (!user) {
      writeAuditLog({
        action: 'auth.login_failed',
        resourceType: 'user',
        details: { email, reason: 'user_not_found' },
        ipAddress: ip,
        userAgent,
      })
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ErrorCodes.INVALID_CREDENTIALS,
            message: 'Invalid email or password',
          },
        },
        { status: 401 }
      )
    }

    // Check account lockout
    if (isAccountLocked(user.accountLocked, user.lockedUntil)) {
      writeAuditLog({
        userId: user.id,
        action: 'auth.login_failed',
        resourceType: 'user',
        resourceId: user.id,
        details: { reason: 'account_locked', lockedUntil: user.lockedUntil },
        ipAddress: ip,
        userAgent,
      })
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ErrorCodes.ACCOUNT_LOCKED,
            message: 'Account temporarily locked due to too many failed attempts. Try again later.',
          },
        },
        { status: 403 }
      )
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.passwordHash)

    if (!passwordValid) {
      // Increment failed attempts
      const newFailedAttempts = user.failedAttempts + 1
      const shouldLock = shouldLockAccount(newFailedAttempts)

      await db.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: newFailedAttempts,
          ...(shouldLock
            ? {
                accountLocked: true,
                lockedUntil: getLockoutExpiry(),
              }
            : {}),
        },
      })

      if (shouldLock) {
        writeAuditLog({
          userId: user.id,
          action: 'auth.account_locked',
          resourceType: 'user',
          resourceId: user.id,
          details: { failedAttempts: newFailedAttempts },
          ipAddress: ip,
          userAgent,
        })
      }

      writeAuditLog({
        userId: user.id,
        action: 'auth.login_failed',
        resourceType: 'user',
        resourceId: user.id,
        details: { reason: 'invalid_password', failedAttempts: newFailedAttempts },
        ipAddress: ip,
        userAgent,
      })

      return NextResponse.json(
        {
          success: false,
          error: {
            code: ErrorCodes.INVALID_CREDENTIALS,
            message: 'Invalid email or password',
          },
        },
        { status: 401 }
      )
    }

    // Check if MFA is required (law_enforcement and admin)
    if (
      user.mfaEnabled &&
      (user.role === 'law_enforcement' || user.role === 'admin')
    ) {
      // Return partial auth — client must complete MFA step
      const mfaSessionToken = generateRefreshToken()
      await sessionStore.set(user.id, `mfa:${mfaSessionToken}`, 300) // 5 min

      return NextResponse.json({
        success: true,
        data: {
          mfaRequired: true,
          mfaSessionToken,
        } satisfies Partial<LoginResponse>,
      })
    }

    // Reset failed attempts on successful login
    // Generate tokens
    const tokenId = generateRefreshToken()
    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role as LoginResponse['user']['role'],
      orgId: user.orgId ?? undefined,
    })

    await sessionStore.set(user.id, tokenId, env.JWT_REFRESH_TOKEN_TTL)

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip ?? null,
        failedAttempts: 0,
        accountLocked: false,
        lockedUntil: null,
      },
    })

    writeAuditLog({
      userId: user.id,
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user.id,
      details: { role: user.role },
      ipAddress: ip,
      userAgent,
    })

    logger.info({ userId: user.id, role: user.role }, 'User logged in')

    const response: LoginResponse = {
      accessToken,
      refreshToken: `${user.id}:${tokenId}`,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role as LoginResponse['user']['role'],
        orgId: user.orgId ?? undefined,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
      },
    }

    return NextResponse.json({ success: true, data: response })
  } catch (err) {
    logger.error({ err, email }, 'Login failed')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'Login failed. Please try again.',
        },
      },
      { status: 500 }
    )
  }
}
