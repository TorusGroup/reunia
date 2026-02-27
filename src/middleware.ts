import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// =============================================================
// Security Middleware (E8-S01 — Sprint 7)
// Applied to all routes: security headers, route protection, CORS
// =============================================================

// Routes that require authentication
// NOTE: /register-case and /admin/ingest are open during test mode (no auth system active yet)
const PROTECTED_ROUTES = [
  '/dashboard',
  '/le-dashboard',
  '/api/v1/face',
  '/api/v1/alerts/broadcast',
  '/api/v1/le',
]

// Routes that should only be accessible to law_enforcement or admin
const LE_ONLY_ROUTES = [
  '/le-dashboard',
  '/api/v1/alerts/broadcast',
]

// Static / public routes that should bypass auth checks
const PUBLIC_ROUTES = [
  '/',
  '/search',
  '/casos',
  '/report-sighting',
  '/api/v1/cases/search',
  '/api/v1/cases/stats',
  '/api/v1/alerts/subscribe',
  '/api/v1/health',
  '/api/auth',
]

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  'https://reunia.org',
  'https://www.reunia.org',
  'https://app.reunia.org',
]

// Security headers applied to every response — NON-NEGOTIABLE in production
const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data: blob: https://res.cloudinary.com https://api.missingkids.org https://www.missingkids.org https://www.fbi.gov https://*.fbi.gov https://ws-public.interpol.int",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' http://localhost:* https://api.reunia.org https://*.railway.app",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Permitted-Cross-Domain-Policies': 'none',
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

function isLeOnlyRoute(pathname: string): boolean {
  return LE_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

function getTokenFromRequest(request: NextRequest): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // Check cookie as fallback (for SSR page routes)
  const cookieToken = request.cookies.get('access_token')?.value
  if (cookieToken) return cookieToken

  return null
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return {}
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  }
}

function applyHeaders(
  response: NextResponse,
  headers: Record<string, string>
): void {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value)
  }
}

// ---------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  const origin = request.headers.get('origin')

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    const corsHeaders = getCorsHeaders(origin)
    const response = new NextResponse(null, { status: 204 })
    applyHeaders(response, corsHeaders)
    applyHeaders(response, SECURITY_HEADERS)
    return response
  }

  // Skip middleware for static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Route protection for UI pages
  if (isProtectedRoute(pathname) && !isPublicRoute(pathname)) {
    const token = getTokenFromRequest(request)

    if (!token) {
      // Redirect to login for UI pages
      if (!pathname.startsWith('/api/')) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        const redirectResponse = NextResponse.redirect(loginUrl)
        applyHeaders(redirectResponse, SECURITY_HEADERS)
        return redirectResponse
      }

      // Return 401 for API routes
      const unauthorizedResponse = NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
      applyHeaders(unauthorizedResponse, SECURITY_HEADERS)
      applyHeaders(unauthorizedResponse, getCorsHeaders(origin))
      return unauthorizedResponse
    }

    // For LE-only routes, we can't easily decode JWT in middleware without
    // importing the full auth library (which pulls in heavy deps). We'll
    // rely on the route handlers for role checking. The middleware provides
    // the authentication gate; authorization is handled in route handlers.
  }

  // Add request ID for tracing
  const requestId =
    request.headers.get('x-request-id') ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  // Build response with security headers
  const response = NextResponse.next({
    request: {
      headers: new Headers({
        ...Object.fromEntries(request.headers.entries()),
        'x-request-id': requestId,
        'x-forwarded-for':
          request.headers.get('x-forwarded-for') ??
          request.headers.get('x-real-ip') ??
          'unknown',
      }),
    },
  })

  // Apply security headers
  applyHeaders(response, SECURITY_HEADERS)

  // Apply CORS headers for API routes
  if (pathname.startsWith('/api/')) {
    applyHeaders(response, getCorsHeaders(origin))
  }

  // Pass through request ID in response
  response.headers.set('x-request-id', requestId)

  return response
}

// Middleware config: match all routes except static files
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|sounds/).*)',
  ],
}
