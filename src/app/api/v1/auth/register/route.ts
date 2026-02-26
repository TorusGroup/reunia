import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword, generateEmailVerifyToken, getEmailVerifyExpiry } from '@/lib/auth'
import { rateLimitCheck } from '@/lib/redis'
import { writeAuditLog, getIpFromHeaders } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { ErrorCodes } from '@/types'
import type { RegisterResponse } from '@/types/auth'

// =============================================================
// POST /api/v1/auth/register (E1-S04)
// =============================================================

const registerSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  fullName: z
    .string()
    .min(2, 'Full name is required')
    .max(200, 'Name too long'),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Phone must be E.164 format (e.g. +5511999999999)')
    .optional(),
  countryCode: z.string().length(2).toUpperCase().optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getIpFromHeaders(request.headers)
  const userAgent = request.headers.get('user-agent') ?? undefined

  // Rate limit: 10 registration attempts per 10 minutes per IP
  if (ip) {
    const rateLimit = await rateLimitCheck(
      `register:${ip}`,
      600, // 10 minutes
      10
    )
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ErrorCodes.RATE_LIMIT_EXCEEDED,
            message: 'Too many registration attempts. Please try again later.',
          },
        },
        { status: 429 }
      )
    }
  }

  // Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Invalid JSON body',
        },
      },
      { status: 400 }
    )
  }

  const validation = registerSchema.safeParse(body)
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

  const { email, password, fullName, phone, countryCode } = validation.data

  try {
    // Check if email already exists
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ErrorCodes.ALREADY_EXISTS,
            message: 'An account with this email already exists',
          },
        },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Generate email verification token
    const emailVerifyToken = generateEmailVerifyToken()
    const emailVerifyExpiresAt = getEmailVerifyExpiry()

    // Create user (default role: 'family' for self-registration)
    // Public role is for anonymous/read-only access; registered users get 'family'
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        phone,
        countryCode: countryCode ?? null,
        role: 'family',
        emailVerifyToken,
        emailVerifyExpiresAt,
        privacyAcceptedAt: new Date(),
      },
    })

    // TODO (Sprint 2): Send verification email via email service

    // Audit log
    writeAuditLog({
      userId: user.id,
      action: 'auth.register',
      resourceType: 'user',
      resourceId: user.id,
      details: { email, role: 'family' },
      ipAddress: ip,
      userAgent,
    })

    logger.info({ userId: user.id, email }, 'User registered')

    const response: RegisterResponse = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: 'family',
      emailVerified: false,
      createdAt: user.createdAt.toISOString(),
    }

    return NextResponse.json({ success: true, data: response }, { status: 201 })
  } catch (err) {
    logger.error({ err, email }, 'Registration failed')
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'Registration failed. Please try again.',
        },
      },
      { status: 500 }
    )
  }
}
