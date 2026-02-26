import { rateLimitCheck } from '@/lib/redis'
import type { UserRole } from '@/types/auth'

// =============================================================
// Granular Rate Limiter per Endpoint per Role (E8-S03)
// All limits are server-side only — never trust the client
// =============================================================

export type RateLimitEndpoint =
  | 'search'
  | 'face_match'
  | 'register_case'
  | 'report_sighting'
  | 'broadcast_alert'
  | 'auth_login'
  | 'auth_register'
  | 'api_general'

// Rate limit configuration: [requests, windowSeconds]
// null means unlimited
type RateLimitConfig = [number, number] | null

// Matrix: endpoint -> role -> [limit, windowSeconds]
const RATE_LIMITS: Record<RateLimitEndpoint, Partial<Record<UserRole | 'public', RateLimitConfig>>> = {
  search: {
    public: [30, 60],          // 30/min
    family: [60, 60],           // 60/min
    volunteer: [60, 60],        // 60/min
    ngo: [120, 60],             // 120/min
    law_enforcement: null,      // unlimited
    admin: null,                // unlimited
  },
  face_match: {
    public: [0, 3600],          // 0/hr (blocked)
    family: [5, 3600],          // 5/hr
    volunteer: [10, 3600],      // 10/hr
    ngo: [20, 3600],            // 20/hr
    law_enforcement: null,      // unlimited
    admin: null,                // unlimited
  },
  register_case: {
    public: [0, 86400],         // 0/day (blocked)
    family: [3, 86400],         // 3/day
    volunteer: [0, 86400],      // 0/day (blocked)
    ngo: [10, 86400],           // 10/day
    law_enforcement: null,      // unlimited
    admin: null,                // unlimited
  },
  report_sighting: {
    public: [3, 900],           // 3/15min
    family: [10, 3600],         // 10/hr
    volunteer: [20, 3600],      // 20/hr
    ngo: [20, 3600],            // 20/hr
    law_enforcement: null,      // unlimited
    admin: null,                // unlimited
  },
  broadcast_alert: {
    public: [0, 86400],         // 0/day (blocked)
    family: [0, 86400],         // 0/day (blocked)
    volunteer: [0, 86400],      // 0/day (blocked)
    ngo: [0, 86400],            // 0/day (blocked)
    law_enforcement: [5, 86400], // 5/day
    admin: null,                // unlimited
  },
  auth_login: {
    public: [10, 900],          // 10 attempts/15min per IP
    family: [10, 900],
    volunteer: [10, 900],
    ngo: [10, 900],
    law_enforcement: [10, 900],
    admin: [10, 900],
  },
  auth_register: {
    public: [3, 3600],          // 3 registrations/hr per IP
    family: [3, 3600],
    volunteer: [3, 3600],
    ngo: [3, 3600],
    law_enforcement: [3, 3600],
    admin: null,
  },
  api_general: {
    public: [100, 60],          // 100/min general
    family: [200, 60],
    volunteer: [200, 60],
    ngo: [500, 60],
    law_enforcement: null,
    admin: null,
  },
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  blocked: boolean // explicitly blocked (limit = 0)
}

// Check rate limit for a given endpoint and role
export async function checkRateLimit(
  endpoint: RateLimitEndpoint,
  role: UserRole | 'public',
  identifier: string // IP address or userId
): Promise<RateLimitResult> {
  const endpointConfig = RATE_LIMITS[endpoint]
  const config = endpointConfig[role] ?? endpointConfig['public']

  // null or undefined = unlimited
  if (config === null || config === undefined) {
    return {
      allowed: true,
      remaining: 999999,
      resetAt: new Date(Date.now() + 60000),
      blocked: false,
    }
  }

  const [limit, windowSeconds] = config as [number, number]

  // limit = 0 means explicitly blocked for this role
  if (limit === 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + windowSeconds * 1000),
      blocked: true,
    }
  }

  const key = `rl:${endpoint}:${role}:${identifier}`
  const result = await rateLimitCheck(key, windowSeconds, limit)

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt: result.resetAt,
    blocked: false,
  }
}

// Build rate limit response headers
export function buildRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(result.resetAt.getTime() / 1000).toString(),
    'X-RateLimit-Policy': result.blocked ? 'blocked' : 'sliding-window',
  }
}

// Helper: returns 429 response body
export function rateLimitExceededBody(result: RateLimitResult): {
  success: false
  error: string
  code: string
  retryAfter: number
} {
  const retryAfter = Math.max(
    0,
    Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
  )

  return {
    success: false,
    error: result.blocked
      ? 'Esta operação não está disponível para o seu nível de acesso.'
      : 'Muitas requisições. Por favor, aguarde antes de tentar novamente.',
    code: result.blocked ? 'OPERATION_BLOCKED' : 'RATE_LIMIT_EXCEEDED',
    retryAfter,
  }
}
