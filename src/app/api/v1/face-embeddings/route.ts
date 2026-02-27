import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// =============================================================
// POST /api/v1/face-embeddings — Save a face embedding
// GET  /api/v1/face-embeddings — Count searchable embeddings
// Used by the admin embeddings generator page.
// Auth: x-admin-key header required for POST
// =============================================================

const postBodySchema = z.object({
  imageId: z.string().uuid(),
  personId: z.string().uuid(),
  descriptor: z.array(z.number()).length(128),
  faceBbox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  faceConfidence: z.number().min(0).max(1).optional(),
})

function checkAdminKey(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key') ?? ''
  const expectedKey = process.env.ADMIN_INGESTION_KEY ?? 'reunia-admin'
  return adminKey === expectedKey
}

export async function GET(): Promise<NextResponse> {
  try {
    const [total, searchable] = await Promise.all([
      db.faceEmbedding.count(),
      db.faceEmbedding.count({
        where: {
          isSearchable: true,
          embedding: { not: null },
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: { total, searchable },
    })
  } catch (err) {
    logger.error({ err }, 'GET /api/v1/face-embeddings: error')
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to count embeddings' },
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!checkAdminKey(request)) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin key required' } },
      { status: 401 }
    )
  }

  let body: z.infer<typeof postBodySchema>
  try {
    const rawBody = await request.json()
    const result = postBodySchema.safeParse(rawBody)
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: result.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      )
    }
    body = result.data
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' } },
      { status: 400 }
    )
  }

  try {
    // Encode the 128-dim descriptor as a binary Buffer (Float32Array layout)
    const float32 = new Float32Array(body.descriptor)
    const embeddingBuffer = Buffer.from(float32.buffer)

    // Create-or-update by imageId
    const existing = await db.faceEmbedding.findFirst({
      where: { imageId: body.imageId },
      select: { id: true },
    })

    let embeddingId: string
    if (existing) {
      await db.faceEmbedding.update({
        where: { id: existing.id },
        data: {
          embedding: embeddingBuffer,
          faceBbox: body.faceBbox ?? undefined,
          faceConfidence: body.faceConfidence ?? undefined,
          modelName: 'face-api.js',
          modelVersion: 'ssd_mobilenetv1',
          isSearchable: true,
        },
      })
      embeddingId = existing.id
    } else {
      const created = await db.faceEmbedding.create({
        data: {
          imageId: body.imageId,
          personId: body.personId,
          modelName: 'face-api.js',
          modelVersion: 'ssd_mobilenetv1',
          embedding: embeddingBuffer,
          faceBbox: body.faceBbox ?? undefined,
          faceConfidence: body.faceConfidence ?? undefined,
          isSearchable: true,
        },
      })
      embeddingId = created.id
    }

    return NextResponse.json({
      success: true,
      data: { id: embeddingId, action: existing ? 'updated' : 'created' },
    })
  } catch (err) {
    logger.error({ err }, 'POST /api/v1/face-embeddings: failed to save')
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to save embedding' },
      },
      { status: 500 }
    )
  }
}
