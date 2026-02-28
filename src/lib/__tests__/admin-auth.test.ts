// =============================================================
// Admin Auth module unit tests (Q-01)
// Tests: JWT admin auth, API key auth, cookie auth, failure audit
// =============================================================

import { checkAdminAuth, type AdminAuthResult } from '@/lib/admin-auth'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------

// Mock @/lib/auth
const mockVerifyAccessToken = jest.fn()
const mockExtractBearerToken = jest.fn()
const mockHasRole = jest.fn()
jest.mock('@/lib/auth', () => ({
  verifyAccessToken: (...args: unknown[]) => mockVerifyAccessToken(...args),
  extractBearerToken: (...args: unknown[]) => mockExtractBearerToken(...args),
  hasRole: (...args: unknown[]) => mockHasRole(...args),
}))

// Mock @/lib/env
jest.mock('@/lib/env', () => ({
  env: {
    ADMIN_INGESTION_KEY: 'test-admin-key-1234567890',
  },
}))

// Mock @/lib/audit
const mockWriteAuditLog = jest.fn()
jest.mock('@/lib/audit', () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
  getIpFromHeaders: () => '127.0.0.1',
}))

// Mock @/lib/logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}))

// Helper: build a minimal NextRequest
function buildRequest(headers: Record<string, string> = {}, cookies: Record<string, string> = {}): NextRequest {
  const url = 'http://localhost/api/admin/test'
  const req = new NextRequest(url, {
    headers: new Headers(headers),
  })

  // Patch cookies for test — NextRequest cookies are read-only from headers
  // We use the Cookie header convention instead
  if (Object.keys(cookies).length > 0) {
    const cookieStr = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
    return new NextRequest(url, {
      headers: new Headers({ ...headers, cookie: cookieStr }),
    })
  }

  return req
}

describe('admin-auth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ---------------------------------------------------------------
  // JWT Bearer token auth
  // ---------------------------------------------------------------
  describe('JWT bearer auth', () => {
    it('should authorize valid admin JWT token', async () => {
      mockExtractBearerToken.mockReturnValue('valid-admin-jwt')
      mockVerifyAccessToken.mockReturnValue({
        sub: 'user-123',
        role: 'admin',
        email: 'admin@test.com',
      })
      mockHasRole.mockReturnValue(true)

      const req = buildRequest({ authorization: 'Bearer valid-admin-jwt' })
      const result = await checkAdminAuth(req)

      expect(result.authorized).toBe(true)
      expect(result.method).toBe('jwt')
      expect(result.userId).toBe('user-123')
      expect(result.role).toBe('admin')
    })

    it('should reject valid JWT with insufficient role', async () => {
      mockExtractBearerToken.mockReturnValue('valid-family-jwt')
      mockVerifyAccessToken.mockReturnValue({
        sub: 'user-456',
        role: 'family',
        email: 'family@test.com',
      })
      mockHasRole.mockReturnValue(false) // family < admin

      const req = buildRequest({ authorization: 'Bearer valid-family-jwt' })
      const result = await checkAdminAuth(req)

      expect(result.authorized).toBe(false)
      expect(result.method).toBe('none')
    })

    it('should fall through to API key when JWT is invalid', async () => {
      mockExtractBearerToken.mockReturnValue('expired-jwt')
      mockVerifyAccessToken.mockImplementation(() => {
        throw new Error('Token expired')
      })

      const req = buildRequest({
        authorization: 'Bearer expired-jwt',
        'x-admin-key': 'test-admin-key-1234567890',
      })
      const result = await checkAdminAuth(req)

      expect(result.authorized).toBe(true)
      expect(result.method).toBe('api-key')
    })
  })

  // ---------------------------------------------------------------
  // API key auth
  // ---------------------------------------------------------------
  describe('API key auth', () => {
    it('should authorize valid API key', async () => {
      mockExtractBearerToken.mockReturnValue(null) // no JWT

      const req = buildRequest({ 'x-admin-key': 'test-admin-key-1234567890' })
      const result = await checkAdminAuth(req)

      expect(result.authorized).toBe(true)
      expect(result.method).toBe('api-key')
      expect(result.userId).toBeUndefined()
    })

    it('should reject invalid API key', async () => {
      mockExtractBearerToken.mockReturnValue(null)

      const req = buildRequest({ 'x-admin-key': 'wrong-key' })
      const result = await checkAdminAuth(req)

      expect(result.authorized).toBe(false)
      expect(result.method).toBe('none')
    })
  })

  // ---------------------------------------------------------------
  // No credentials
  // ---------------------------------------------------------------
  describe('no credentials', () => {
    it('should reject and log audit when no auth is provided', async () => {
      mockExtractBearerToken.mockReturnValue(null)

      const req = buildRequest()
      const result = await checkAdminAuth(req)

      expect(result.authorized).toBe(false)
      expect(result.method).toBe('none')
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'admin.action',
          resourceType: 'admin_auth',
          details: expect.objectContaining({
            reason: 'unauthorized',
          }),
        })
      )
    })
  })

  // ---------------------------------------------------------------
  // Cookie-based JWT auth
  // ---------------------------------------------------------------
  describe('cookie-based JWT auth', () => {
    it('should authorize via access_token cookie when bearer header is absent', async () => {
      mockExtractBearerToken.mockReturnValue(null) // no Bearer header
      mockVerifyAccessToken.mockReturnValue({
        sub: 'cookie-user-789',
        role: 'admin',
        email: 'cookie-admin@test.com',
      })
      mockHasRole.mockReturnValue(true)

      const req = buildRequest({}, { access_token: 'valid-cookie-jwt' })
      const result = await checkAdminAuth(req)

      expect(result.authorized).toBe(true)
      expect(result.method).toBe('jwt')
      expect(result.userId).toBe('cookie-user-789')
    })
  })
})
