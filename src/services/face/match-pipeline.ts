// =============================================================
// ReunIA — Face Match Pipeline
// Orchestrates: detect → embed → search → rank → enqueue HITL
// =============================================================

import { faceClient } from './face-client'
import {
  searchSimilarFaces,
  searchSimilarFacesPrecise,
  getConfidenceTier,
  SIMILARITY_THRESHOLDS,
  type SimilarFaceResult,
  type ConfidenceTier,
} from './embedding-store'
import { validationQueue } from './validation-queue'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit'

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export interface FaceMatchInput {
  imageBase64: string
  querySource: 'citizen_upload' | 'sighting_photo' | 'le_batch' | 'operator_manual'
  requestedById?: string
  sightingId?: string
  /** Minimum similarity threshold — defaults to LOW (0.55) */
  threshold?: number
  /** Max results to return */
  maxResults?: number
  /** Use precise search (HITL validation mode — slower but higher recall) */
  precise?: boolean
}

export interface RankedMatch {
  faceEmbeddingId: string
  personId: string
  caseId: string
  similarity: number
  confidenceTier: ConfidenceTier
  /** Person's display name */
  personName: string | null
  /** Case number */
  caseNumber: string
  /** Primary photo URL for display */
  primaryPhotoUrl: string | null
}

export interface FaceMatchPipelineResult {
  success: boolean
  queryEmbeddingId?: string
  matches: RankedMatch[]
  matchCount: number
  faceDetected: boolean
  faceConfidence: number | null
  faceQuality: number | null
  processingMs: number
  /** Match IDs enqueued for HITL review */
  enqueuedMatchIds: string[]
  error?: string
}

// ---------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------

/**
 * Full face match pipeline.
 *
 * Steps:
 * 1. Detect face in uploaded image
 * 2. Generate ArcFace embedding
 * 3. Search pgvector HNSW index for similar embeddings
 * 4. Enrich results with person/case metadata
 * 5. Enqueue ALL matches for HITL review (NON-NEGOTIABLE)
 * 6. Return ranked match list (WITHOUT exposing raw biometric data)
 */
export async function runFaceMatchPipeline(
  input: FaceMatchInput
): Promise<FaceMatchPipelineResult> {
  const pipelineStart = Date.now()
  const {
    imageBase64,
    querySource,
    requestedById,
    sightingId,
    threshold = SIMILARITY_THRESHOLDS.REJECT,
    maxResults = 20,
    precise = false,
  } = input

  logger.info(
    { querySource, requestedById, threshold, maxResults },
    'FaceMatchPipeline: starting'
  )

  // ---------------------------------------------------------------
  // Step 1: Detect face
  // ---------------------------------------------------------------
  let faceDetected = false
  let faceConfidence: number | null = null
  let faceQuality: number | null = null
  let embedding: number[] | null = null

  try {
    const detectResult = await faceClient.detect(imageBase64)

    if (detectResult.face_count === 0) {
      logger.warn({ querySource }, 'FaceMatchPipeline: no face detected in image')
      return {
        success: false,
        matches: [],
        matchCount: 0,
        faceDetected: false,
        faceConfidence: null,
        faceQuality: null,
        processingMs: Date.now() - pipelineStart,
        enqueuedMatchIds: [],
        error: 'No face detected in the uploaded image',
      }
    }

    faceDetected = true
    const primaryFace = detectResult.faces[0]!

    // ---------------------------------------------------------------
    // Step 2: Generate embedding
    // ---------------------------------------------------------------
    const embedResult = await faceClient.embed(imageBase64, primaryFace.bounding_box)
    embedding = embedResult.embedding
    faceConfidence = embedResult.face_confidence
    faceQuality = embedResult.face_quality

    logger.info(
      {
        querySource,
        faceConfidence,
        faceQuality,
        embeddingDims: embedding.length,
      },
      'FaceMatchPipeline: embedding generated'
    )
  } catch (err) {
    logger.error({ err, querySource }, 'FaceMatchPipeline: detect/embed step failed')
    return {
      success: false,
      matches: [],
      matchCount: 0,
      faceDetected,
      faceConfidence,
      faceQuality: null,
      processingMs: Date.now() - pipelineStart,
      enqueuedMatchIds: [],
      error: err instanceof Error ? err.message : 'Face processing failed',
    }
  }

  // ---------------------------------------------------------------
  // Step 3: Search pgvector HNSW index
  // ---------------------------------------------------------------
  let similarFaces: SimilarFaceResult[] = []

  try {
    similarFaces = precise
      ? await searchSimilarFacesPrecise(embedding, threshold, maxResults)
      : await searchSimilarFaces(embedding, threshold, maxResults)

    logger.info(
      { querySource, candidateCount: similarFaces.length },
      'FaceMatchPipeline: similarity search complete'
    )
  } catch (err) {
    logger.error({ err, querySource }, 'FaceMatchPipeline: similarity search failed')
    return {
      success: false,
      matches: [],
      matchCount: 0,
      faceDetected,
      faceConfidence,
      faceQuality,
      processingMs: Date.now() - pipelineStart,
      enqueuedMatchIds: [],
      error: 'Database search failed',
    }
  }

  // ---------------------------------------------------------------
  // Step 4: Enrich matches with person/case metadata
  // ---------------------------------------------------------------
  const enrichedMatches: RankedMatch[] = []
  const matchRecordIds: string[] = []

  for (const candidate of similarFaces) {
    try {
      const person = await db.person.findUnique({
        where: { id: candidate.personId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          case: { select: { id: true, caseNumber: true } },
          images: {
            where: { isPrimary: true },
            select: { thumbnailUrl: true, storageUrl: true },
            take: 1,
          },
        },
      })

      if (!person) {
        logger.warn({ personId: candidate.personId }, 'FaceMatchPipeline: person not found, skipping')
        continue
      }

      const confidenceTier = getConfidenceTier(candidate.similarity)

      // ---------------------------------------------------------------
      // Step 5: Create Match record in DB (every match goes through HITL)
      // NON-NEGOTIABLE: families are NEVER notified without human review
      // ---------------------------------------------------------------
      const matchRecord = await db.match.create({
        data: {
          querySource: querySource as 'citizen_upload',
          matchedEmbeddingId: candidate.faceId,
          matchedPersonId: candidate.personId,
          matchedCaseId: candidate.caseId,
          similarityScore: candidate.similarity,
          thresholdUsed: threshold,
          confidenceTier: mapConfidenceTierToPrisma(confidenceTier),
          reviewStatus: 'pending',
          requestedById: requestedById ?? null,
          sightingId: sightingId ?? null,
          requestedAt: new Date(),
        },
      })

      matchRecordIds.push(matchRecord.id)

      enrichedMatches.push({
        faceEmbeddingId: candidate.faceId,
        personId: candidate.personId,
        caseId: candidate.caseId,
        similarity: candidate.similarity,
        confidenceTier,
        personName:
          [person.firstName, person.lastName].filter(Boolean).join(' ') || null,
        caseNumber: person.case.caseNumber,
        primaryPhotoUrl:
          person.images[0]?.thumbnailUrl ?? person.images[0]?.storageUrl ?? null,
      })
    } catch (err) {
      logger.warn({ err, candidatePersonId: candidate.personId }, 'FaceMatchPipeline: enrichment failed for candidate')
    }
  }

  // ---------------------------------------------------------------
  // Step 6: Enqueue matches for HITL review
  // ---------------------------------------------------------------
  const enqueuedMatchIds: string[] = []

  for (const matchId of matchRecordIds) {
    try {
      await validationQueue.enqueue({
        matchId,
        priority: determinePriority(
          enrichedMatches.find((m) => m.faceEmbeddingId)?.confidenceTier ?? 'LOW'
        ),
      })
      enqueuedMatchIds.push(matchId)
    } catch (err) {
      logger.warn({ err, matchId }, 'FaceMatchPipeline: failed to enqueue match for HITL')
    }
  }

  // ---------------------------------------------------------------
  // Audit log
  // ---------------------------------------------------------------
  writeAuditLog({
    userId: requestedById,
    action: 'face_match.submit',
    resourceType: 'match',
    details: {
      querySource,
      candidateCount: similarFaces.length,
      enqueuedCount: enqueuedMatchIds.length,
      faceConfidence,
      faceQuality,
    },
  })

  const totalMs = Date.now() - pipelineStart

  logger.info(
    {
      querySource,
      matchCount: enrichedMatches.length,
      enqueuedCount: enqueuedMatchIds.length,
      totalMs,
    },
    'FaceMatchPipeline: complete'
  )

  return {
    success: true,
    matches: enrichedMatches,
    matchCount: enrichedMatches.length,
    faceDetected: true,
    faceConfidence,
    faceQuality,
    processingMs: totalMs,
    enqueuedMatchIds,
  }
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function mapConfidenceTierToPrisma(
  tier: ConfidenceTier
): 'possible' | 'likely' | 'confident' | 'very_confident' {
  switch (tier) {
    case 'HIGH':
      return 'very_confident'
    case 'MEDIUM':
      return 'confident'
    case 'LOW':
      return 'likely'
    default:
      return 'possible'
  }
}

function determinePriority(tier: ConfidenceTier): 'high' | 'normal' | 'low' {
  switch (tier) {
    case 'HIGH':
      return 'high'
    case 'MEDIUM':
      return 'normal'
    default:
      return 'low'
  }
}
