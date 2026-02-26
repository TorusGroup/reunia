// =============================================================
// ReunIA — Face Services Index
// =============================================================

export { faceClient, FaceServiceClient } from './face-client'
export type {
  FaceBoundingBox,
  DetectedFace,
  DetectResult,
  EmbedResult,
  MatchCandidate,
  MatchResult,
  BatchEmbedItem,
  BatchEmbedResultItem,
  BatchEmbedResult,
  FaceServiceHealth,
} from './face-client'

export {
  storeEmbedding,
  searchSimilarFaces,
  searchSimilarFacesPrecise,
  disableEmbedding,
  deleteEmbedding,
  countSearchableEmbeddings,
  getConfidenceTier,
  SIMILARITY_THRESHOLDS,
} from './embedding-store'
export type {
  StoredEmbedding,
  SimilarFaceResult,
  StoreEmbeddingInput,
  ConfidenceTier,
} from './embedding-store'

export { runFaceMatchPipeline } from './match-pipeline'
export type { FaceMatchInput, FaceMatchPipelineResult, RankedMatch } from './match-pipeline'

export {
  validationQueue,
  validateMatch,
  hitlQueue,
  HITL_QUEUE_NAME,
} from './validation-queue'
export type { EnqueueInput, QueueStatus, ValidateMatchInput, ValidationAction } from './validation-queue'
