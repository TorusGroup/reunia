import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// =============================================================
// GET /api/v1/proxy-image?url=...
// Server-side image proxy to bypass CORS when loading external
// images (fbi.gov, missingkids.org) for face detection in the
// browser via face-api.js.
//
// Security: Only allowed domains are proxied. CORS restricted (S-04).
// Cache: 24h via Cache-Control header.
// =============================================================

// Allowed origins for CORS (S-04 — no more wildcard)
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  'https://reunia.org',
  'https://www.reunia.org',
  'https://app.reunia.org',
]

const ALLOWED_HOSTNAMES = [
  'api.fbi.gov',
  'vault.fbi.gov',
  'www.fbi.gov',
  'api.missingkids.org',
  'www.missingkids.org',
  'ws-public.interpol.int',
  'res.cloudinary.com',
  'cloudinary.com',
  'images.interpol.int',
]

function isAllowedUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      ALLOWED_HOSTNAMES.some(
        (host) =>
          parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
      )
    )
  } catch {
    return false
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const imageUrl = searchParams.get('url')

  if (!imageUrl) {
    return NextResponse.json(
      { success: false, error: 'Missing url parameter' },
      { status: 400 }
    )
  }

  if (!isAllowedUrl(imageUrl)) {
    return NextResponse.json(
      { success: false, error: 'URL not in allowed domains' },
      { status: 403 }
    )
  }

  try {
    const upstream = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'ReunIA/1.0 (missing children search platform)',
        Accept: 'image/*',
      },
      // 15 second timeout
      signal: AbortSignal.timeout(15_000),
    })

    if (!upstream.ok) {
      logger.warn({ url: imageUrl, status: upstream.status }, 'proxy-image: upstream failed')
      return NextResponse.json(
        { success: false, error: `Upstream returned ${upstream.status}` },
        { status: 502 }
      )
    }

    const contentType =
      upstream.headers.get('content-type') ?? 'image/jpeg'

    // Only forward image content types
    if (!contentType.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'Upstream response is not an image' },
        { status: 422 }
      )
    }

    const arrayBuffer = await upstream.arrayBuffer()

    // Build CORS headers — restricted to allowed origins (S-04)
    const requestOrigin = request.headers.get('origin')
    const corsHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, immutable',
      'X-Proxy-Source': 'reunia-image-proxy',
      'Vary': 'Origin',
    }
    if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
      corsHeaders['Access-Control-Allow-Origin'] = requestOrigin
    }

    return new NextResponse(arrayBuffer, { status: 200, headers: corsHeaders })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      logger.warn({ url: imageUrl }, 'proxy-image: timeout')
      return NextResponse.json(
        { success: false, error: 'Upstream request timed out' },
        { status: 504 }
      )
    }

    logger.error({ err, url: imageUrl }, 'proxy-image: unexpected error')
    return NextResponse.json(
      { success: false, error: 'Failed to fetch image' },
      { status: 500 }
    )
  }
}
