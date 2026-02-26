-- =============================================================
-- PostgreSQL initialization script for ReunIA
-- Runs ONCE when the container is first created.
-- Run migrations with: npm run db:migrate
-- =============================================================

-- Enable required extensions (must be done as superuser)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
-- PostGIS requires separate install in pgvector image
-- Install via: apt-get install -y postgresql-16-postgis-3
-- Or use postgis/postgis:16-3.4 image instead
-- CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create readonly user for reporting/analytics
CREATE ROLE reunia_readonly LOGIN PASSWORD 'reunia_readonly_password';
GRANT CONNECT ON DATABASE reunia_dev TO reunia_readonly;
GRANT USAGE ON SCHEMA public TO reunia_readonly;
-- Readonly user gets SELECT on all future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO reunia_readonly;

-- Confirm extensions loaded
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('pgcrypto', 'vector', 'pg_trgm', 'unaccent', 'btree_gist');
