-- Migration: Add S3 offloading columns to tables storing large content
-- This enables the S3 content offload service to store large content in S3
-- while keeping references in the database for querying
-- RADIANT v5.52.58

-- ============================================================================
-- internet_content table - stores scraped web content (up to 50KB per URL!)
-- ============================================================================
ALTER TABLE internet_content 
  ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500),
  ADD COLUMN IF NOT EXISTS s3_bucket VARCHAR(100),
  ADD COLUMN IF NOT EXISTS content_size INTEGER;

CREATE INDEX IF NOT EXISTS idx_internet_content_s3 
  ON internet_content(s3_key) WHERE s3_key IS NOT NULL;

COMMENT ON COLUMN internet_content.s3_key IS 'S3 key for offloaded content (content > 10KB)';
COMMENT ON COLUMN internet_content.s3_bucket IS 'S3 bucket for offloaded content';
COMMENT ON COLUMN internet_content.content_size IS 'Original content size in bytes';

-- ============================================================================
-- reward_training_data table - stores full AI responses for reward model training
-- ============================================================================
ALTER TABLE reward_training_data 
  ADD COLUMN IF NOT EXISTS winning_s3_key VARCHAR(500),
  ADD COLUMN IF NOT EXISTS losing_s3_key VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_reward_training_winning_s3 
  ON reward_training_data(winning_s3_key) WHERE winning_s3_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reward_training_losing_s3 
  ON reward_training_data(losing_s3_key) WHERE losing_s3_key IS NOT NULL;

COMMENT ON COLUMN reward_training_data.winning_s3_key IS 'S3 key for offloaded winning response';
COMMENT ON COLUMN reward_training_data.losing_s3_key IS 'S3 key for offloaded losing response';

-- ============================================================================
-- artifacts table - stores code/markdown/html artifacts (can be very large)
-- ============================================================================
ALTER TABLE artifacts 
  ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_artifacts_s3 
  ON artifacts(s3_key) WHERE s3_key IS NOT NULL;

COMMENT ON COLUMN artifacts.s3_key IS 'S3 key for offloaded artifact content';

-- ============================================================================
-- artifact_versions table - stores version history of artifacts
-- ============================================================================
ALTER TABLE artifact_versions 
  ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_artifact_versions_s3 
  ON artifact_versions(s3_key) WHERE s3_key IS NOT NULL;

COMMENT ON COLUMN artifact_versions.s3_key IS 'S3 key for offloaded version content';

-- ============================================================================
-- consciousness_dreams table - stores dream content from consciousness engine
-- ============================================================================
ALTER TABLE consciousness_dreams 
  ADD COLUMN IF NOT EXISTS original_s3_key VARCHAR(500),
  ADD COLUMN IF NOT EXISTS dream_s3_key VARCHAR(500);

COMMENT ON COLUMN consciousness_dreams.original_s3_key IS 'S3 key for offloaded original content';
COMMENT ON COLUMN consciousness_dreams.dream_s3_key IS 'S3 key for offloaded dream content';

-- ============================================================================
-- consciousness_monologue_data table - stores inner monologue training data
-- ============================================================================
ALTER TABLE consciousness_monologue_data 
  ADD COLUMN IF NOT EXISTS interaction_s3_key VARCHAR(500),
  ADD COLUMN IF NOT EXISTS monologue_s3_key VARCHAR(500);

COMMENT ON COLUMN consciousness_monologue_data.interaction_s3_key IS 'S3 key for offloaded interaction';
COMMENT ON COLUMN consciousness_monologue_data.monologue_s3_key IS 'S3 key for offloaded monologue';

-- ============================================================================
-- distillation_training_data table - stores teacher model responses
-- ============================================================================
ALTER TABLE distillation_training_data 
  ADD COLUMN IF NOT EXISTS teacher_response_s3_key VARCHAR(500),
  ADD COLUMN IF NOT EXISTS reasoning_trace_s3_key VARCHAR(500);

COMMENT ON COLUMN distillation_training_data.teacher_response_s3_key IS 'S3 key for offloaded teacher response';
COMMENT ON COLUMN distillation_training_data.reasoning_trace_s3_key IS 'S3 key for offloaded reasoning trace';

-- ============================================================================
-- semantic_memories table - stores semantic memory content
-- ============================================================================
ALTER TABLE semantic_memories 
  ADD COLUMN IF NOT EXISTS content_s3_key VARCHAR(500);

COMMENT ON COLUMN semantic_memories.content_s3_key IS 'S3 key for offloaded memory content';

-- ============================================================================
-- user_memory table - stores user memory content
-- ============================================================================
ALTER TABLE user_memory 
  ADD COLUMN IF NOT EXISTS content_s3_key VARCHAR(500);

COMMENT ON COLUMN user_memory.content_s3_key IS 'S3 key for offloaded memory content';

-- ============================================================================
-- liquid_ghost_events table - stores ghost event payloads
-- ============================================================================
ALTER TABLE liquid_ghost_events 
  ADD COLUMN IF NOT EXISTS payload_s3_key VARCHAR(500);

COMMENT ON COLUMN liquid_ghost_events.payload_s3_key IS 'S3 key for offloaded event payload';

-- ============================================================================
-- council_debates table - stores debate topics and context
-- ============================================================================
ALTER TABLE council_debates 
  ADD COLUMN IF NOT EXISTS topic_s3_key VARCHAR(500),
  ADD COLUMN IF NOT EXISTS context_s3_key VARCHAR(500);

COMMENT ON COLUMN council_debates.topic_s3_key IS 'S3 key for offloaded debate topic';
COMMENT ON COLUMN council_debates.context_s3_key IS 'S3 key for offloaded debate context';

-- ============================================================================
-- Create helper function to retrieve content (from DB or S3)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_offloaded_content(
  p_inline_content TEXT,
  p_s3_key VARCHAR(500)
) RETURNS TEXT AS $$
BEGIN
  -- If no S3 key, return inline content
  IF p_s3_key IS NULL THEN
    RETURN p_inline_content;
  END IF;
  
  -- If S3 key exists, content is offloaded - return placeholder
  -- Actual retrieval happens in application layer via S3ContentOffloadService
  RETURN '[OFFLOADED:' || p_s3_key || ']';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_offloaded_content IS 
  'Returns inline content or S3 reference placeholder. Actual S3 retrieval happens in app layer.';

-- ============================================================================
-- Add RLS policies for new columns (they inherit from parent table policies)
-- ============================================================================
-- No additional RLS needed - columns inherit from table-level RLS policies

-- ============================================================================
-- Summary of changes
-- ============================================================================
-- Tables modified:
-- 1. internet_content - web scraping content (up to 50KB/URL)
-- 2. reward_training_data - AI response pairs for RLHF
-- 3. artifacts - code/markdown/html content
-- 4. artifact_versions - version history
-- 5. consciousness_dreams - dream content
-- 6. consciousness_monologue_data - monologue training
-- 7. distillation_training_data - teacher responses
-- 8. semantic_memories - semantic memory
-- 9. user_memory - user memory
-- 10. liquid_ghost_events - event payloads
-- 11. council_debates - debate content
--
-- All large content (>10KB) will be offloaded to S3 automatically by the
-- S3ContentOffloadService, with only references stored in the database.
-- This prevents database bloat and improves query performance.
