import { NextRequest } from 'next/server'
import { verifyAccessToken, extractBearerToken, hasRole } from '@/lib/auth'
import { env } from '@/lib/env'
import { writeAuditLog, getIpFromHeaders } from '@/lib/audit'
import { logger } from '@/lib/logger'
import type { UserRole } from '@/types/auth'

// =============================================================
// Shared Admin Auth Utility (S-01 — Security Hardening)
// Unified admin authentication: JWT (primary) + API Key (fallback)
// =============================================================

export interface AdminAuthResult {
  authorized: boolean
  method: 'jwt' | 'api-key' | 'none'
  userId?: string
  role?: UserRole
}

/**
 * Check admin authentication via two methods:
 * 1. JWT: Bearer token with admin role
 * 2. API Key: x-admin-key header matching ADMIN_INGESTION_KEY env var
 *
 * On failure, logs to audit trail.
 */
export async function checkAdminAuth(request: NextRequest): Promise<AdminAuthResult> {
  const ip = getIpFromHeaders(request.headers) ?? 'unknown'

  // Method 1: JWT Bearer token
  const token = extractBearerToken(request.headers.get('authorization'))
  if (token) {
    try {
      const payload = verifyAccessToken(token)
      if (hasRole(payload.role as UserRole, 'admin')) {
        return {
          authorized: true,
          method: 'jwt',
          userId: payload.sub,
          role: payload.role as UserRole,
        }
      }
      // Valid token but insufficient role
      logger.warn({ userId: payload.sub, role: payload.role, ip }, 'Admin auth: JWT valid but insufficient role')
    } catch {
      // Invalid/expired token — fall through to API key check
      logger.debug({ ip }, 'Admin auth: JWT verification failed, trying API key')
    }
  }

  // Method 1b: JWT from cookie (for admin pages using credentials: 'include')
  const cookieToken = request.cookies.get('access_token')?.value
  if (cookieToken && cookieToken !== token) {
    try {
      const payload = verifyAccessToken(cookieToken)
      if (hasRole(payload.role as UserRole, 'admin')) {
        return {
          authorized: true,
          method: 'jwt',
          userId: payload.sub,
          role: payload.role as UserRole,
        }
      }
    } catch {
      // Invalid cookie token — fall through
    }
  }

  // Method 2: API Key header
  const apiKey = request.headers.get('x-admin-key')
  if (apiKey && apiKey === env.ADMIN_INGESTION_KEY) {
    return {
      authorized: true,
      method: 'api-key',
    }
  }

  // Both methods failed — log the attempt
  writeAuditLog({
    action: 'admin.action',
    resourceType: 'admin_auth',
    details: {
      attemptedMethods: [
        token ? 'jwt' : null,
        cookieToken ? 'jwt-cookie' : null,
        apiKey ? 'api-key' : null,
      ].filter(Boolean),
      reason: 'unauthorized',
    },
    ipAddress: ip,
    userAgent: request.headers.get('user-agent') ?? undefined,
  })

  return {
    authorized: false,
    method: 'none',
  }
}
