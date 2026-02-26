-- =============================================================
-- Migration 001: pgvector extensions and custom indexes
-- Run AFTER prisma migrate dev creates the base schema
-- =============================================================

-- Enable extensions (may already be done in docker/postgres/init.sql)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
-- PostGIS optional (requires postgis package in docker image)
-- CREATE EXTENSION IF NOT EXISTS "postgis";

-- ---------------------------------------------------------------
-- HNSW Index for face_embeddings
-- pgvector approximate nearest neighbor search
-- ---------------------------------------------------------------
-- Drop if exists to allow re-running
DROP INDEX IF EXISTS idx_embeddings_hnsw;

-- HNSW index: m=16 (connections per layer), ef_construction=128 (build quality)
-- vector_cosine_ops: ArcFace embeddings are L2-normalized → cosine ≡ inner product
CREATE INDEX idx_embeddings_hnsw ON face_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

-- ---------------------------------------------------------------
-- persons.name_normalized — GENERATED ALWAYS column
-- Prisma creates it as a regular text column; alter to make it generated
-- ---------------------------------------------------------------
-- First, drop the column Prisma created (if it exists as plain text)
-- Then recreate as a generated column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'persons' AND column_name = 'name_normalized'
    ) THEN
        -- Check if it's already a generated column
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'persons'
              AND column_name = 'name_normalized'
              AND is_generated = 'ALWAYS'
        ) THEN
            -- Drop and recreate as generated
            ALTER TABLE persons DROP COLUMN name_normalized;
            ALTER TABLE persons
                ADD COLUMN name_normalized TEXT GENERATED ALWAYS AS (
                    LOWER(UNACCENT(
                        COALESCE(first_name, '') || ' ' ||
                        COALESCE(last_name, '') || ' ' ||
                        COALESCE(nickname, '')
                    ))
                ) STORED;
        END IF;
    ELSE
        -- Column doesn't exist, create it
        ALTER TABLE persons
            ADD COLUMN name_normalized TEXT GENERATED ALWAYS AS (
                LOWER(UNACCENT(
                    COALESCE(first_name, '') || ' ' ||
                    COALESCE(last_name, '') || ' ' ||
                    COALESCE(nickname, '')
                ))
            ) STORED;
    END IF;
END $$;

-- Rebuild full-text index on name_normalized
DROP INDEX IF EXISTS idx_persons_name_tsvector;
CREATE INDEX idx_persons_name_tsvector ON persons
    USING GIN(to_tsvector('simple', COALESCE(name_normalized, '')));

-- Rebuild trigram index for fuzzy name matching
DROP INDEX IF EXISTS idx_persons_name_trgm;
CREATE INDEX idx_persons_name_trgm ON persons
    USING GIN(COALESCE(name_normalized, '') gin_trgm_ops);

-- ---------------------------------------------------------------
-- Geography columns for PostGIS (optional — requires PostGIS)
-- ---------------------------------------------------------------
-- Uncomment when PostGIS is enabled:
--
-- ALTER TABLE cases ADD COLUMN IF NOT EXISTS last_seen_geo GEOGRAPHY(POINT, 4326);
-- ALTER TABLE sightings ADD COLUMN IF NOT EXISTS geo GEOGRAPHY(POINT, 4326);
-- ALTER TABLE alerts ADD COLUMN IF NOT EXISTS geo_center GEOGRAPHY(POINT, 4326);
-- ALTER TABLE alert_subscriptions ADD COLUMN IF NOT EXISTS geo GEOGRAPHY(POINT, 4326);
--
-- CREATE INDEX IF NOT EXISTS idx_cases_geo ON cases USING GIST(last_seen_geo);
-- CREATE INDEX IF NOT EXISTS idx_sightings_geo ON sightings USING GIST(geo);
-- CREATE INDEX IF NOT EXISTS idx_alerts_geo ON alerts USING GIST(geo_center);
-- CREATE INDEX IF NOT EXISTS idx_subscriptions_geo ON alert_subscriptions USING GIST(geo);

-- ---------------------------------------------------------------
-- audit_log partitioning (PostgreSQL 16 native partitioning)
-- Creates current month partition and next month partition
-- ---------------------------------------------------------------
-- NOTE: Full partitioning requires converting the table to partitioned
-- This is done as a separate migration step in Sprint 1 E1-S07
-- For now, the audit_log is a regular table; partitioning added later.

-- ---------------------------------------------------------------
-- Performance: set pgvector search parameters
-- ---------------------------------------------------------------
-- These can also be set per-session in application code
-- ef_search=64 is the default; increase for higher recall at cost of speed
-- ALTER DATABASE reunia_dev SET hnsw.ef_search = 100;

-- Confirm setup
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('face_embeddings', 'persons')
  AND indexname IN ('idx_embeddings_hnsw', 'idx_persons_name_tsvector', 'idx_persons_name_trgm')
ORDER BY tablename, indexname;
