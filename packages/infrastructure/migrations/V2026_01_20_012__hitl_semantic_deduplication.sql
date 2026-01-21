-- RADIANT v5.34.0 - HITL Semantic Deduplication
-- Adds pgvector embedding column to hitl_question_cache for semantic matching
-- ============================================================================

-- Add question_embedding column for semantic deduplication
ALTER TABLE hitl_question_cache
ADD COLUMN IF NOT EXISTS question_embedding vector(1536);

-- Create HNSW index for efficient similarity search
-- Using cosine distance for normalized embeddings
CREATE INDEX IF NOT EXISTS idx_hitl_question_cache_embedding 
ON hitl_question_cache 
USING hnsw (question_embedding vector_cosine_ops)
WHERE question_embedding IS NOT NULL AND is_valid = true;

-- Add semantic match statistics columns
ALTER TABLE hitl_question_cache
ADD COLUMN IF NOT EXISTS match_type VARCHAR(20) DEFAULT 'exact',
ADD COLUMN IF NOT EXISTS semantic_similarity DECIMAL(5,4);

-- Add index for semantic match type analytics
CREATE INDEX IF NOT EXISTS idx_hitl_question_cache_match_type 
ON hitl_question_cache (tenant_id, match_type, created_at DESC)
WHERE is_valid = true;

-- Update hitl_dedup_config table for semantic settings
ALTER TABLE hitl_rate_limits
ADD COLUMN IF NOT EXISTS semantic_matching_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS semantic_similarity_threshold DECIMAL(3,2) DEFAULT 0.85,
ADD COLUMN IF NOT EXISTS semantic_max_candidates INTEGER DEFAULT 20;

COMMENT ON COLUMN hitl_question_cache.question_embedding IS 
'OpenAI text-embedding-3-small vector (1536 dimensions) for semantic deduplication';

COMMENT ON COLUMN hitl_question_cache.match_type IS 
'How this cache entry was matched: exact, fuzzy, or semantic';

COMMENT ON COLUMN hitl_question_cache.semantic_similarity IS 
'Cosine similarity score when matched semantically (0.0-1.0)';
