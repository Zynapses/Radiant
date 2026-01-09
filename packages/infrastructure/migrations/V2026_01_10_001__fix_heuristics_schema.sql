-- ============================================================================
-- RADIANT v5.0.3 - Heuristics Schema Fix
-- Migration: V2026_01_10_001
-- 
-- Fixes:
-- 1. Index row size crash - Uses SHA-256 hash instead of raw TEXT for uniqueness
-- 2. Vector index performance - Switches from IVFFlat to HNSW
-- 
-- Compliance: SHA-256 chosen over MD5 to avoid compliance scanner flags
--             (Veracode, AWS Inspector, SOC2)
-- ============================================================================

-- 1. Add SHA-256 hash column for safe uniqueness constraint
-- Using CHAR(64) for hex-encoded SHA-256 (256 bits = 64 hex chars)
ALTER TABLE knowledge_heuristics 
ADD COLUMN IF NOT EXISTS heuristic_hash CHAR(64) 
GENERATED ALWAYS AS (encode(sha256(heuristic_text::bytea), 'hex')) STORED;

-- 2. Drop the risky text-based constraint that can exceed B-Tree index limits
-- This constraint fails on heuristic_text > ~2700 bytes
ALTER TABLE knowledge_heuristics 
DROP CONSTRAINT IF EXISTS unique_heuristic_per_domain;

-- 3. Add the safe hash-based constraint
-- SHA-256 hash is always exactly 64 chars, well within B-Tree limits
ALTER TABLE knowledge_heuristics 
ADD CONSTRAINT unique_heuristic_per_domain 
UNIQUE (tenant_id, domain, heuristic_hash);

-- 4. Create index on hash column for fast lookups
CREATE INDEX IF NOT EXISTS idx_heuristics_hash 
ON knowledge_heuristics(heuristic_hash);

-- 5. Optimize Vector Index - Switch from IVFFlat to HNSW
-- HNSW advantages over IVFFlat:
--   - No pre-training required (IVFFlat needs lists parameter tuning)
--   - Better recall at same query speed
--   - Better performance for dynamic inserts (no need to rebuild)
--   - More predictable latency
DROP INDEX IF EXISTS idx_heuristics_embedding;

-- HNSW parameters:
--   m = 16 (connections per node, default is fine for most cases)
--   ef_construction = 64 (build-time quality, higher = better recall but slower build)
CREATE INDEX idx_heuristics_embedding 
ON knowledge_heuristics 
USING hnsw (context_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 6. Add comment documenting the change
COMMENT ON COLUMN knowledge_heuristics.heuristic_hash IS 
'SHA-256 hash of heuristic_text for safe uniqueness constraint. Avoids B-Tree index size limits on TEXT columns.';

-- 7. Update statistics for query planner
ANALYZE knowledge_heuristics;
