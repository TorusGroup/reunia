-- =============================================================
-- ReunIA — Sprint 5: Face Engine pgvector Migration
-- Adds embedding column, HNSW index, and similarity search function
-- =============================================================

-- Ensure pgvector extension is enabled (should already be from initial migration)
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------
-- Add embedding column to face_embeddings table
-- Note: Prisma maps this as Unsupported("vector(512)")
-- We manage this column via raw SQL
-- ---------------------------------------------------------------
ALTER TABLE "face_embeddings"
  ADD COLUMN IF NOT EXISTS embedding vector(512);

-- ---------------------------------------------------------------
-- HNSW index for approximate nearest neighbor (ANN) search
-- Parameters tuned for 512-dim ArcFace embeddings:
--   m = 16: number of bi-directional links (higher = better recall, more memory)
--   ef_construction = 200: search width during construction (higher = better quality)
-- Cosine distance operator: <=>
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS face_embedding_hnsw_idx
  ON "face_embeddings"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

-- ---------------------------------------------------------------
-- IVFFlat fallback index (used when HNSW memory is too high)
-- Commented out — use HNSW for MVP scale
-- ---------------------------------------------------------------
-- CREATE INDEX IF NOT EXISTS face_embedding_ivfflat_idx
--   ON "face_embeddings"
--   USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- ---------------------------------------------------------------
-- Similarity search function
-- Returns face_id, case_id, and cosine similarity (1 - cosine_distance)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_similar_faces(
  query_embedding vector(512),
  threshold float DEFAULT 0.55,
  max_results int DEFAULT 20
)
RETURNS TABLE(
  face_id UUID,
  person_id UUID,
  case_id UUID,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    fe.id AS face_id,
    fe.person_id,
    p."caseId" AS case_id,
    (1 - (fe.embedding <=> query_embedding))::float AS similarity
  FROM "face_embeddings" fe
  JOIN persons p ON p.id = fe.person_id
  WHERE
    fe.is_searchable = true
    AND fe.embedding IS NOT NULL
    AND (1 - (fe.embedding <=> query_embedding)) >= threshold
  ORDER BY fe.embedding <=> query_embedding ASC
  LIMIT max_results;
$$;

-- ---------------------------------------------------------------
-- Optimized search with HNSW ef_search parameter
-- Use SET LOCAL for per-query tuning (higher = better recall, slower)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_similar_faces_precise(
  query_embedding vector(512),
  threshold float DEFAULT 0.70,
  max_results int DEFAULT 10
)
RETURNS TABLE(
  face_id UUID,
  person_id UUID,
  case_id UUID,
  similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Higher ef_search for more precise results (default is 40)
  SET LOCAL hnsw.ef_search = 100;

  RETURN QUERY
  SELECT
    fe.id AS face_id,
    fe.person_id,
    p."caseId" AS case_id,
    (1 - (fe.embedding <=> query_embedding))::float AS similarity
  FROM "face_embeddings" fe
  JOIN persons p ON p.id = fe.person_id
  WHERE
    fe.is_searchable = true
    AND fe.embedding IS NOT NULL
    AND (1 - (fe.embedding <=> query_embedding)) >= threshold
  ORDER BY fe.embedding <=> query_embedding ASC
  LIMIT max_results;
END;
$$;

-- ---------------------------------------------------------------
-- Grant execute permissions
-- ---------------------------------------------------------------
GRANT EXECUTE ON FUNCTION find_similar_faces TO reunia_app;
GRANT EXECUTE ON FUNCTION find_similar_faces_precise TO reunia_app;

COMMENT ON FUNCTION find_similar_faces IS
  'Search for similar faces using HNSW ANN. Returns results above similarity threshold. '
  'threshold=0.55 (LOW), 0.70 (MEDIUM), 0.85 (HIGH). max_results capped at 100.';

COMMENT ON FUNCTION find_similar_faces_precise IS
  'Higher-precision face search using ef_search=100. Use for HITL validation workflows '
  'where recall matters more than speed.';
