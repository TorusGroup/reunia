import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// =============================================================
// POST /api/v1/face-search — DEPRECATED (F-02)
//
// This endpoint previously used browser-side 128-dim face-api.js
// descriptors with brute-force cosine similarity (loads ALL embeddings
// into memory). Replaced by /api/v1/face/match which uses:
//   - Server-side ArcFace (512-dim) via Python face service
//   - pgvector HNSW index for scalable similarity search
//   - Full match pipeline with HITL queue
//
// This route now returns a deprecation notice directing clients
// to the new endpoint.
//
// ADR: docs/architecture/adr-face-search-architecture.md
// =============================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  logger.warn(
    { path: '/api/v1/face-search', method: 'POST' },
    'Deprecated face-search endpoint called. Clients should use /api/v1/face/match instead.'
  )

  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'DEPRECATED',
        message:
          'This endpoint is deprecated. Use POST /api/v1/face/match with image_base64 instead of browser-side descriptors. See /docs for the new API.',
        migration: {
          new_endpoint: '/api/v1/face/match',
          method: 'POST',
          body: {
            image_base64: '<base64-encoded image>',
            threshold: 0.55,
            max_results: 10,
          },
          auth: 'Bearer JWT required (volunteer+ role)',
          description:
            'Server-side ArcFace (512-dim) with pgvector HNSW index. No browser-side face processing needed.',
        },
      },
    },
    { status: 410 } // 410 Gone
  )
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'DEPRECATED',
        message: 'This endpoint is deprecated. Use POST /api/v1/face/match instead.',
      },
    },
    { status: 410 }
  )
}
