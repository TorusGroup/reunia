import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// =============================================================
// POST /api/v1/face-search
// Browser-side face-api.js generates 128-dim descriptor.
// Server receives descriptor, compares with stored embeddings
// via cosine similarity, returns top matches.
// NO auth required — public endpoint (no biometrics stored).
// =============================================================

const bodySchema = z.object({
  descriptor: z.array(z.number()).length(128),
  threshold: z.number().min(0.1).max(0.99).optional().default(0.4),
  maxResults: z.number().int().min(1).max(20).optional().default(10),
})

// Cosine similarity between two equal-length float arrays
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  return dotProduct / denom
}

// Decode a stored Buffer (Float32Array bytes) back to number[]
function decodeEmbedding(bytes: Buffer): number[] {
  const float32 = new Float32Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / 4
  )
  return Array.from(float32)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()

  // ---- Parse & validate body -----------------------------------
  let body: z.infer<typeof bodySchema>
  try {
    const rawBody = await request.json()
    const result = bodySchema.safeParse(rawBody)
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

  const { descriptor, threshold, maxResults } = body

  try {
    // ---- Load all searchable embeddings from DB ---------------
    const embeddings = await db.faceEmbedding.findMany({
      where: {
        isSearchable: true,
        embedding: { not: null },
      },
      select: {
        id: true,
        embedding: true,
        personId: true,
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            approximateAge: true,
            case: {
              select: {
                id: true,
                caseNumber: true,
                lastSeenLocation: true,
                source: true,
                status: true,
              },
            },
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { storageUrl: true, thumbnailUrl: true },
            },
          },
        },
      },
    })

    const totalCompared = embeddings.length

    // ---- Brute-force cosine similarity for ~100 cases ---------
    const scored: Array<{
      similarity: number
      embeddingId: string
      caseId: string
      caseNumber: string
      personId: string
      firstName: string | null
      lastName: string | null
      approximateAge: number | null
      lastSeenLocation: string | null
      photoUrl: string | null
      source: string
    }> = []

    for (const emb of embeddings) {
      if (!emb.embedding) continue

      let storedDescriptor: number[]
      try {
        storedDescriptor = decodeEmbedding(emb.embedding as Buffer)
      } catch {
        // Skip corrupt entries
        continue
      }

      // Only compare if dimensions match (128-dim face-api.js)
      if (storedDescriptor.length !== 128) continue

      const sim = cosineSimilarity(descriptor, storedDescriptor)

      if (sim >= threshold) {
        const person = emb.person
        const photo = person.images[0]
        scored.push({
          similarity: Math.round(sim * 1000) / 1000,
          embeddingId: emb.id,
          caseId: person.case.id,
          caseNumber: person.case.caseNumber,
          personId: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          approximateAge: person.approximateAge,
          lastSeenLocation: person.case.lastSeenLocation,
          photoUrl: photo?.thumbnailUrl ?? photo?.storageUrl ?? null,
          source: person.case.source,
        })
      }
    }

    // Sort by similarity descending, take top N
    scored.sort((a, b) => b.similarity - a.similarity)
    const topMatches = scored.slice(0, maxResults)

    const processingTimeMs = Date.now() - startTime

    logger.info(
      {
        totalCompared,
        matchesFound: topMatches.length,
        threshold,
        processingTimeMs,
      },
      'face-search: completed'
    )

    return NextResponse.json({
      success: true,
      data: {
        matches: topMatches.map((m) => ({
          similarity: m.similarity,
          caseId: m.caseId,
          caseNumber: m.caseNumber,
          personId: m.personId,
          firstName: m.firstName,
          lastName: m.lastName,
          approximateAge: m.approximateAge,
          lastSeenLocation: m.lastSeenLocation,
          photoUrl: m.photoUrl,
          source: m.source,
        })),
        totalCompared,
        processingTimeMs,
        notice:
          'All matches require human review before any action. CVV 188 for crisis support.',
      },
    })
  } catch (err) {
    logger.error({ err }, 'POST /api/v1/face-search: error')
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Face search failed' },
      },
      { status: 500 }
    )
  }
}
