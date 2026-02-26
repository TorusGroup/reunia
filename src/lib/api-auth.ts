import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken, extractBearerToken, hasRole } from '@/lib/auth'
import { ErrorCodes } from '@/types'
import type { JwtPayload, UserRole } from '@/types/auth'

// =============================================================
// API Auth Helper — Extract and validate JWT from requests
// Sprint 6 — shared by alerts, sightings, LE dashboard
// =============================================================

export interface AuthContext {
  userId: string
  email: string
  role: UserRole
  orgId?: string
}

/**
 * Attempt to resolve auth from request — returns null if no token (anonymous).
 * Returns 401/403 NextResponse on malformed/expired token.
 */
export function extractAuth(
  request: NextRequest
): AuthContext | null | NextResponse {
  const token = extractBearerToken(request.headers.get('authorization'))
  if (!token) return null

  try {
    const payload = verifyAccessToken(token)
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role as UserRole,
      orgId: payload.orgId,
    }
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
}

/**
 * Require authentication — returns 401 if anonymous.
 */
export function requireAuth(
  request: NextRequest
): AuthContext | NextResponse {
  const result = extractAuth(request)
  if (result === null) {
    return NextResponse.json(
      {
        success: false,
        error: { code: ErrorCodes.UNAUTHORIZED, message: 'Authentication required' },
      },
      { status: 401 }
    )
  }
  return result
}

/**
 * Require a minimum role — returns 401/403 if unauthorized.
 */
export function requireRole(
  request: NextRequest,
  minRole: UserRole
): AuthContext | NextResponse {
  const authResult = requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const auth = authResult as AuthContext
  if (!hasRole(auth.role, minRole)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: `This operation requires ${minRole} role or higher`,
        },
      },
      { status: 403 }
    )
  }

  return auth
}

/**
 * Check if auth context has a required role (non-throwing).
 */
export function authHasRole(auth: AuthContext, role: UserRole): boolean {
  return hasRole(auth.role, role)
}
