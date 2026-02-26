// =============================================================
// ReunIA — Face Embedding Store
// pgvector storage and retrieval via HNSW index
// =============================================================

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { FaceBoundingBox } from './face-client'

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export interface StoredEmbedding {
  id: string
  imageId: string
  personId: string
  caseId: string
  modelName: string
  modelVersion: string
  faceBbox: FaceBoundingBox | null
  faceConfidence: number | null
  faceQuality: number | null
  isSearchable: boolean
  createdAt: Date
}

export interface SimilarFaceResult {
  faceId: string
  personId: string
  caseId: string
  similarity: number
}

export interface StoreEmbeddingInput {
  imageId: string
  personId: string
  embedding: number[]
  faceBbox?: FaceBoundingBox | null
  faceConfidence?: number | null
  faceQuality?: number | null
  modelName?: string
  modelVersion?: string
  estimatedAge?: number | null
  estimatedGender?: string | null
  skinToneCategory?: string | null
}

// ---------------------------------------------------------------
// Confidence tier thresholds (mirror Python service config)
// ---------------------------------------------------------------

export const SIMILARITY_THRESHOLDS = {
  HIGH: 0.85,
  MEDIUM: 0.70,
  LOW: 0.55,
  REJECT: 0.55,
} as const

export type ConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'REJECTED'

export function getConfidenceTier(similarity: number): ConfidenceTier {
  if (similarity >= SIMILARITY_THRESHOLDS.HIGH) return 'HIGH'
  if (similarity >= SIMILARITY_THRESHOLDS.MEDIUM) return 'MEDIUM'
  if (similarity >= SIMILARITY_THRESHOLDS.LOW) return 'LOW'
  return 'REJECTED'
}

// ---------------------------------------------------------------
// Store embedding
// ---------------------------------------------------------------

/**
 * Store a face embedding in the database with pgvector column.
 * Uses raw SQL for the vector insert since Prisma doesn't natively support pgvector.
 */
export async function storeEmbedding(input: StoreEmbeddingInput): Promise<string> {
  const {
    imageId,
    personId,
    embedding,
    faceBbox = null,
    faceConfidence = null,
    faceQuality = null,
    modelName = 'ArcFace',
    modelVersion = 'buffalo_l',
    estimatedAge = null,
    estimatedGender = null,
    skinToneCategory = null,
  } = input

  if (embedding.length !== 512) {
    throw new Error(`Expected 512-dim embedding, got ${embedding.length}`)
  }

  // Format as pgvector literal: [v1,v2,...,v512]
  const vectorLiteral = `[${embedding.join(',')}]`

  try {
    // Use Prisma executeRaw to insert with the vector type
    const result = await db.$executeRaw`
      INSERT INTO face_embeddings (
        id,
        image_id,
        person_id,
        model_name,
        model_version,
        embedding,
        face_bbox,
        face_confidence,
        face_quality,
        estimated_age,
        estimated_gender,
        is_searchable,
        created_at
      ) VALUES (
        gen_random_uuid(),
        ${imageId}::uuid,
        ${personId}::uuid,
        ${modelName},
        ${modelVersion},
        ${vectorLiteral}::vector(512),
        ${faceBbox ? JSON.stringify(faceBbox) : null}::jsonb,
        ${faceConfidence}::real,
        ${faceQuality}::real,
        ${estimatedAge}::smallint,
        ${estimatedGender},
        true,
        now()
      )
      RETURNING id
    `

    logger.info(
      { imageId, personId, embeddingDims: embedding.length },
      'EmbeddingStore: stored face embedding'
    )

    // Prisma executeRaw returns row count, not the ID
    // Fetch the newly created embedding ID
    const created = await db.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM face_embeddings
      WHERE image_id = ${imageId}::uuid
        AND person_id = ${personId}::uuid
      ORDER BY created_at DESC
      LIMIT 1
    `

    return created[0]?.id ?? ''
  } catch (err) {
    logger.error({ err, imageId, personId }, 'EmbeddingStore: failed to store embedding')
    throw new Error(
      `Failed to store face embedding: ${err instanceof Error ? err.message : 'Unknown error'}`
    )
  }
}

// ---------------------------------------------------------------
// Search similar faces (pgvector HNSW)
// ---------------------------------------------------------------

/**
 * Find similar faces using pgvector HNSW cosine search.
 * Returns results sorted by similarity (highest first).
 *
 * This is the primary search path for production — much faster than
 * in-process cosine similarity for large databases.
 */
export async function searchSimilarFaces(
  queryEmbedding: number[],
  threshold = 0.55,
  maxResults = 20
): Promise<SimilarFaceResult[]> {
  if (queryEmbedding.length !== 512) {
    throw new Error(`Expected 512-dim embedding, got ${queryEmbedding.length}`)
  }

  const vectorLiteral = `[${queryEmbedding.join(',')}]`

  try {
    const rows = await db.$queryRaw<
      Array<{ face_id: string; person_id: string; case_id: string; similarity: number }>
    >`
      SELECT * FROM find_similar_faces(
        ${vectorLiteral}::vector(512),
        ${threshold}::float,
        ${maxResults}::int
      )
    `

    return rows.map((row) => ({
      faceId: row.face_id,
      personId: row.person_id,
      caseId: row.case_id,
      similarity: row.similarity,
    }))
  } catch (err) {
    logger.error({ err, threshold, maxResults }, 'EmbeddingStore: similarity search failed')
    throw new Error(
      `Face similarity search failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    )
  }
}

/**
 * Precise search with higher ef_search for HITL validation workflows.
 */
export async function searchSimilarFacesPrecise(
  queryEmbedding: number[],
  threshold = 0.70,
  maxResults = 10
): Promise<SimilarFaceResult[]> {
  if (queryEmbedding.length !== 512) {
    throw new Error(`Expected 512-dim embedding, got ${queryEmbedding.length}`)
  }

  const vectorLiteral = `[${queryEmbedding.join(',')}]`

  try {
    const rows = await db.$queryRaw<
      Array<{ face_id: string; person_id: string; case_id: string; similarity: number }>
    >`
      SELECT * FROM find_similar_faces_precise(
        ${vectorLiteral}::vector(512),
        ${threshold}::float,
        ${maxResults}::int
      )
    `

    return rows.map((row) => ({
      faceId: row.face_id,
      personId: row.person_id,
      caseId: row.case_id,
      similarity: row.similarity,
    }))
  } catch (err) {
    logger.error({ err, threshold, maxResults }, 'EmbeddingStore: precise search failed')
    throw new Error(
      `Precise face similarity search failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    )
  }
}

// ---------------------------------------------------------------
// Mark embedding as non-searchable (LGPD deletion request)
// ---------------------------------------------------------------

export async function disableEmbedding(faceEmbeddingId: string): Promise<void> {
  await db.faceEmbedding.update({
    where: { id: faceEmbeddingId },
    data: { isSearchable: false },
  })
}

// ---------------------------------------------------------------
// Delete embedding (LGPD hard delete)
// ---------------------------------------------------------------

export async function deleteEmbedding(faceEmbeddingId: string): Promise<void> {
  await db.faceEmbedding.delete({
    where: { id: faceEmbeddingId },
  })
}

// ---------------------------------------------------------------
// Count searchable embeddings
// ---------------------------------------------------------------

export async function countSearchableEmbeddings(): Promise<number> {
  return db.faceEmbedding.count({
    where: { isSearchable: true },
  })
}
