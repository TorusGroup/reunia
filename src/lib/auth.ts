import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { randomUUID, randomBytes } from 'crypto'
import { env } from '@/lib/env'
import type { JwtPayload, UserRole } from '@/types/auth'

// =============================================================
// JWT Auth Utilities (E1-S04)
// RS256 asymmetric key pair
// =============================================================

const BCRYPT_ROUNDS = 12

// Normalize PEM keys — env vars may have \n as literal backslash-n
function normalizePem(pem: string): string {
  return pem.replace(/\\n/g, '\n')
}

// ---------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ---------------------------------------------------------------
// JWT Access Tokens (RS256, short-lived)
// ---------------------------------------------------------------

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, normalizePem(env.JWT_PRIVATE_KEY), {
    algorithm: 'RS256',
    expiresIn: env.JWT_ACCESS_TOKEN_TTL,
    issuer: 'reunia',
    audience: 'reunia-api',
  })
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, normalizePem(env.JWT_PUBLIC_KEY), {
    algorithms: ['RS256'],
    issuer: 'reunia',
    audience: 'reunia-api',
  })
  return decoded as JwtPayload
}

// ---------------------------------------------------------------
// Refresh Tokens
// ---------------------------------------------------------------

export function generateRefreshToken(): string {
  return randomUUID()
}

// ---------------------------------------------------------------
// Token extraction from request headers
// ---------------------------------------------------------------

export function extractBearerToken(
  authorizationHeader: string | null
): string | null {
  if (!authorizationHeader) return null
  const parts = authorizationHeader.split(' ')
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null
  return parts[1] ?? null
}

// ---------------------------------------------------------------
// Permission checking
// ---------------------------------------------------------------

// Role hierarchy: public < family < volunteer < ngo < law_enforcement < admin
const ROLE_HIERARCHY: Record<UserRole, number> = {
  public: 0,
  family: 1,
  volunteer: 2,
  ngo: 3,
  law_enforcement: 4,
  admin: 5,
}

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export function isAdmin(role: UserRole): boolean {
  return role === 'admin'
}

export function isLawEnforcement(role: UserRole): boolean {
  return role === 'law_enforcement' || role === 'admin'
}

// ---------------------------------------------------------------
// Account lockout helpers
// ---------------------------------------------------------------

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 30 * 60 * 1000 // 30 minutes

export function shouldLockAccount(failedAttempts: number): boolean {
  return failedAttempts >= MAX_FAILED_ATTEMPTS
}

export function getLockoutExpiry(): Date {
  return new Date(Date.now() + LOCKOUT_DURATION_MS)
}

export function isAccountLocked(
  accountLocked: boolean,
  lockedUntil: Date | null
): boolean {
  if (!accountLocked) return false
  if (!lockedUntil) return true
  // Auto-unlock if lockout period has passed
  return lockedUntil > new Date()
}

// ---------------------------------------------------------------
// Email verification token
// ---------------------------------------------------------------

export function generateEmailVerifyToken(): string {
  return randomBytes(32).toString('hex')
}

export function getEmailVerifyExpiry(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
}
