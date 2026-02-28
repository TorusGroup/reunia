// =============================================================
// Auth module unit tests (Q-01)
// Tests: password hashing, JWT, token extraction, role checking,
//        account lockout, email verification
// =============================================================

import {
  hashPassword,
  verifyPassword,
  extractBearerToken,
  hasRole,
  isAdmin,
  isLawEnforcement,
  shouldLockAccount,
  getLockoutExpiry,
  isAccountLocked,
  generateRefreshToken,
  generateEmailVerifyToken,
  getEmailVerifyExpiry,
} from '@/lib/auth'
import type { UserRole } from '@/types/auth'

describe('auth', () => {
  // ---------------------------------------------------------------
  // Password hashing
  // ---------------------------------------------------------------
  describe('hashPassword / verifyPassword', () => {
    it('should hash a password and verify it correctly', async () => {
      const password = 'S3cureP@ssw0rd!'
      const hash = await hashPassword(password)

      expect(hash).not.toBe(password)
      expect(hash).toMatch(/^\$2[aby]?\$/) // bcrypt format
      expect(await verifyPassword(password, hash)).toBe(true)
    }, 30000)

    it('should reject incorrect passwords', async () => {
      const hash = await hashPassword('correct-password')
      expect(await verifyPassword('wrong-password', hash)).toBe(false)
    }, 30000)

    it('should generate different hashes for same password (salt)', async () => {
      const password = 'same-password'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)
      expect(hash1).not.toBe(hash2)
    }, 30000)
  })

  // ---------------------------------------------------------------
  // Token extraction
  // ---------------------------------------------------------------
  describe('extractBearerToken', () => {
    it('should extract a valid bearer token', () => {
      expect(extractBearerToken('Bearer abc123')).toBe('abc123')
    })

    it('should return null for null header', () => {
      expect(extractBearerToken(null)).toBeNull()
    })

    it('should return null for non-bearer scheme', () => {
      expect(extractBearerToken('Basic abc123')).toBeNull()
    })

    it('should return null for malformed header', () => {
      expect(extractBearerToken('Bearer')).toBeNull()
      expect(extractBearerToken('Bearer a b c')).toBeNull()
    })

    it('should handle case-insensitive bearer prefix', () => {
      expect(extractBearerToken('bearer token123')).toBe('token123')
      expect(extractBearerToken('BEARER TOKEN456')).toBe('TOKEN456')
    })
  })

  // ---------------------------------------------------------------
  // Role hierarchy
  // ---------------------------------------------------------------
  describe('hasRole', () => {
    it('should respect role hierarchy (admin >= everything)', () => {
      expect(hasRole('admin', 'public')).toBe(true)
      expect(hasRole('admin', 'family')).toBe(true)
      expect(hasRole('admin', 'volunteer')).toBe(true)
      expect(hasRole('admin', 'ngo')).toBe(true)
      expect(hasRole('admin', 'law_enforcement')).toBe(true)
      expect(hasRole('admin', 'admin')).toBe(true)
    })

    it('should deny lower roles accessing higher', () => {
      expect(hasRole('public', 'admin')).toBe(false)
      expect(hasRole('family', 'law_enforcement')).toBe(false)
      expect(hasRole('volunteer', 'admin')).toBe(false)
    })

    it('should allow same-level access', () => {
      const roles: UserRole[] = ['public', 'family', 'volunteer', 'ngo', 'law_enforcement', 'admin']
      for (const role of roles) {
        expect(hasRole(role, role)).toBe(true)
      }
    })
  })

  describe('isAdmin / isLawEnforcement', () => {
    it('should identify admin correctly', () => {
      expect(isAdmin('admin')).toBe(true)
      expect(isAdmin('law_enforcement')).toBe(false)
      expect(isAdmin('family')).toBe(false)
    })

    it('should identify law enforcement correctly', () => {
      expect(isLawEnforcement('law_enforcement')).toBe(true)
      expect(isLawEnforcement('admin')).toBe(true) // admin is also LE
      expect(isLawEnforcement('volunteer')).toBe(false)
    })
  })

  // ---------------------------------------------------------------
  // Account lockout
  // ---------------------------------------------------------------
  describe('account lockout', () => {
    it('should lock after 5 failed attempts', () => {
      expect(shouldLockAccount(4)).toBe(false)
      expect(shouldLockAccount(5)).toBe(true)
      expect(shouldLockAccount(10)).toBe(true)
    })

    it('should not lock with fewer than 5 attempts', () => {
      expect(shouldLockAccount(0)).toBe(false)
      expect(shouldLockAccount(3)).toBe(false)
    })

    it('should generate a lockout expiry in the future', () => {
      const now = Date.now()
      const expiry = getLockoutExpiry()
      expect(expiry.getTime()).toBeGreaterThan(now)
      // Should be ~30 minutes in the future
      const diffMinutes = (expiry.getTime() - now) / (1000 * 60)
      expect(diffMinutes).toBeCloseTo(30, 0)
    })

    it('should detect locked account with future expiry', () => {
      const futureDate = new Date(Date.now() + 60000) // 1 min in future
      expect(isAccountLocked(true, futureDate)).toBe(true)
    })

    it('should auto-unlock if lockout period has passed', () => {
      const pastDate = new Date(Date.now() - 60000) // 1 min in past
      expect(isAccountLocked(true, pastDate)).toBe(false)
    })

    it('should return false if not locked', () => {
      expect(isAccountLocked(false, null)).toBe(false)
      expect(isAccountLocked(false, new Date())).toBe(false)
    })

    it('should return true if locked without expiry', () => {
      expect(isAccountLocked(true, null)).toBe(true)
    })
  })

  // ---------------------------------------------------------------
  // Token generation helpers
  // ---------------------------------------------------------------
  describe('token generation', () => {
    it('should generate a UUID refresh token', () => {
      const token = generateRefreshToken()
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
    })

    it('should generate unique refresh tokens', () => {
      const tokens = new Set(Array.from({ length: 10 }, () => generateRefreshToken()))
      expect(tokens.size).toBe(10)
    })

    it('should generate a hex email verify token', () => {
      const token = generateEmailVerifyToken()
      expect(token).toMatch(/^[0-9a-f]{64}$/) // 32 bytes = 64 hex chars
    })

    it('should generate email verify expiry 24h in future', () => {
      const now = Date.now()
      const expiry = getEmailVerifyExpiry()
      const diffHours = (expiry.getTime() - now) / (1000 * 60 * 60)
      expect(diffHours).toBeCloseTo(24, 0)
    })
  })
})
