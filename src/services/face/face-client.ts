// =============================================================
// ReunIA — Face Service HTTP Client
// Communicates with Python FastAPI face microservice
// =============================================================

import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

// ---------------------------------------------------------------
// Types mirroring Python service schemas
// ---------------------------------------------------------------

export interface FaceBoundingBox {
  x: number
  y: number
  w: number
  h: number
}

export interface DetectedFace {
  face_index: number
  bounding_box: FaceBoundingBox
  confidence: number
  face_area_px: number
}

export interface DetectResult {
  success: boolean
  faces: DetectedFace[]
  face_count: number
  image_width: number
  image_height: number
  processing_ms: number
}

export interface EmbedResult {
  success: boolean
  embedding: number[]
  embedding_dims: number
  face_confidence: number | null
  face_quality: number | null
  processing_ms: number
}

export interface MatchCandidate {
  face_embedding_id: string
  person_id: string
  case_id: string
  similarity: number
  confidence_tier: 'HIGH' | 'MEDIUM' | 'LOW' | 'REJECTED'
}

export interface MatchResult {
  success: boolean
  matches: MatchCandidate[]
  match_count: number
  query_threshold: number
  processing_ms: number
}

export interface BatchEmbedItem {
  image_id: string
  image_base64: string
}

export interface BatchEmbedResultItem {
  image_id: string
  success: boolean
  embedding?: number[]
  face_confidence?: number
  face_quality?: number
  error?: string
}

export interface BatchEmbedResult {
  success: boolean
  results: BatchEmbedResultItem[]
  processed: number
  succeeded: number
  failed: number
  processing_ms: number
}

export interface FaceServiceHealth {
  status: string
  service: string
  version: string
  model: string
  detector: string
}

// ---------------------------------------------------------------
// Client
// ---------------------------------------------------------------

export class FaceServiceClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly timeoutMs: number

  constructor() {
    this.baseUrl = env.FACE_ENGINE_URL
    this.apiKey = env.FACE_ENGINE_API_KEY
    this.timeoutMs = env.FACE_ENGINE_TIMEOUT
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    }
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST',
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(url, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorDetail: string
        try {
          const errBody = (await response.json()) as { detail?: { error?: string } }
          errorDetail = errBody.detail?.error ?? `HTTP ${response.status}`
        } catch {
          errorDetail = `HTTP ${response.status}`
        }
        throw new Error(`Face service error: ${errorDetail}`)
      }

      return (await response.json()) as T
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Face service timeout after ${this.timeoutMs}ms`)
      }
      throw err
    }
  }

  /**
   * Detect faces in an image (base64-encoded).
   * Returns bounding boxes and confidence scores.
   */
  async detect(imageBase64: string): Promise<DetectResult> {
    try {
      return await this.request<DetectResult>('/detect', 'POST', {
        image_base64: imageBase64,
      })
    } catch (err) {
      logger.error({ err }, 'FaceServiceClient: /detect failed')
      throw err
    }
  }

  /**
   * Generate a 512-dim ArcFace embedding from an image.
   * Optionally provide a bounding box to skip auto-detection.
   */
  async embed(
    imageBase64: string,
    faceBbox?: FaceBoundingBox
  ): Promise<EmbedResult> {
    try {
      return await this.request<EmbedResult>('/embed', 'POST', {
        image_base64: imageBase64,
        face_bbox: faceBbox ?? null,
      })
    } catch (err) {
      logger.error({ err }, 'FaceServiceClient: /embed failed')
      throw err
    }
  }

  /**
   * Match a query embedding against candidate embeddings.
   * For large-scale search, use embeddingStore.searchSimilar() with pgvector HNSW instead.
   */
  async match(
    queryEmbedding: number[],
    candidates: Array<{
      face_embedding_id: string
      person_id: string
      case_id: string
      embedding: number[]
    }>,
    threshold = 0.55,
    maxResults = 20
  ): Promise<MatchResult> {
    try {
      return await this.request<MatchResult>('/match', 'POST', {
        query_embedding: queryEmbedding,
        candidates,
        threshold,
        max_results: maxResults,
      })
    } catch (err) {
      logger.error({ err }, 'FaceServiceClient: /match failed')
      throw err
    }
  }

  /**
   * Generate embeddings for multiple images in a single request.
   * Used by the ingestion pipeline for batch processing.
   */
  async batchEmbed(images: BatchEmbedItem[]): Promise<BatchEmbedResult> {
    try {
      return await this.request<BatchEmbedResult>('/batch-embed', 'POST', {
        images,
      })
    } catch (err) {
      logger.error({ err }, 'FaceServiceClient: /batch-embed failed')
      throw err
    }
  }

  /**
   * Health check — returns service status.
   * Does NOT require auth.
   */
  async health(): Promise<FaceServiceHealth> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      return (await response.json()) as FaceServiceHealth
    } catch {
      clearTimeout(timeoutId)
      return {
        status: 'unhealthy',
        service: 'reunia-face-service',
        version: 'unknown',
        model: 'unknown',
        detector: 'unknown',
      }
    }
  }
}

// Singleton instance
export const faceClient = new FaceServiceClient()
