-- RADIANT v5.12.2 - S3 Content Offloading
-- Offloads large content from database to S3 with pointer tracking
-- Implements orphan cleanup for deleted pointers

-- ============================================================================
-- 1. S3 CONTENT REGISTRY (Central tracking of all S3 objects)
-- ============================================================================

CREATE TABLE IF NOT EXISTS s3_content_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- S3 location
  s3_bucket VARCHAR(256) NOT NULL,
  s3_key VARCHAR(1024) NOT NULL UNIQUE,
  s3_version_id VARCHAR(256),
  
  -- Content metadata
  content_type VARCHAR(100) NOT NULL, -- 'message', 'memory', 'episode_draft', 'training_data', etc.
  source_table VARCHAR(100) NOT NULL, -- 'thinktank_messages', 'memories', etc.
  source_id UUID NOT NULL,
  content_hash VARCHAR(64) NOT NULL, -- SHA-256 for dedup
  size_bytes BIGINT NOT NULL,
  compression VARCHAR(20) DEFAULT 'none', -- 'none', 'gzip', 'lz4'
  
  -- Reference tracking
  reference_count INTEGER DEFAULT 1,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- NULL = never expires
  marked_for_deletion BOOLEAN DEFAULT false,
  deletion_scheduled_at TIMESTAMPTZ
);

CREATE INDEX idx_s3_registry_tenant ON s3_content_registry(tenant_id);
CREATE INDEX idx_s3_registry_source ON s3_content_registry(source_table, source_id);
CREATE INDEX idx_s3_registry_hash ON s3_content_registry(content_hash);
CREATE INDEX idx_s3_registry_deletion ON s3_content_registry(marked_for_deletion) 
  WHERE marked_for_deletion = true;
CREATE INDEX idx_s3_registry_orphan ON s3_content_registry(reference_count) 
  WHERE reference_count = 0;

-- RLS
ALTER TABLE s3_content_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY s3_registry_tenant_isolation ON s3_content_registry
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 2. ADD S3 POINTER COLUMNS TO LARGE-CONTENT TABLES
-- ============================================================================

-- Think Tank Messages
ALTER TABLE thinktank_messages 
ADD COLUMN IF NOT EXISTS content_s3_key VARCHAR(1024),
ADD COLUMN IF NOT EXISTS content_size_bytes BIGINT,
ADD COLUMN IF NOT EXISTS content_offloaded BOOLEAN DEFAULT false;

CREATE INDEX idx_thinktank_msg_offloaded ON thinktank_messages(content_offloaded) 
  WHERE content_offloaded = true;

-- Memories
ALTER TABLE memories
ADD COLUMN IF NOT EXISTS content_s3_key VARCHAR(1024),
ADD COLUMN IF NOT EXISTS content_offloaded BOOLEAN DEFAULT false;

-- Learning Episodes
ALTER TABLE learning_episodes
ADD COLUMN IF NOT EXISTS draft_s3_key VARCHAR(1024),
ADD COLUMN IF NOT EXISTS final_s3_key VARCHAR(1024),
ADD COLUMN IF NOT EXISTS content_offloaded BOOLEAN DEFAULT false;

-- Rejected Prompt Archive
ALTER TABLE rejected_prompt_archive
ADD COLUMN IF NOT EXISTS prompt_s3_key VARCHAR(1024),
ADD COLUMN IF NOT EXISTS content_offloaded BOOLEAN DEFAULT false;

-- Shadow Learning Log
ALTER TABLE shadow_learning_log
ADD COLUMN IF NOT EXISTS predicted_s3_key VARCHAR(1024),
ADD COLUMN IF NOT EXISTS actual_s3_key VARCHAR(1024),
ADD COLUMN IF NOT EXISTS content_offloaded BOOLEAN DEFAULT false;

-- ============================================================================
-- 3. ORPHAN TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS s3_orphan_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  s3_bucket VARCHAR(256) NOT NULL,
  s3_key VARCHAR(1024) NOT NULL,
  s3_version_id VARCHAR(256),
  original_registry_id UUID,
  reason VARCHAR(100) NOT NULL, -- 'source_deleted', 'ref_count_zero', 'expired', 'manual'
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  delete_after TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours', -- Grace period
  deleted_at TIMESTAMPTZ,
  deletion_status VARCHAR(20) DEFAULT 'pending' CHECK (deletion_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  UNIQUE(s3_bucket, s3_key)
);

CREATE INDEX idx_orphan_queue_status ON s3_orphan_queue(deletion_status) WHERE deletion_status = 'pending';
CREATE INDEX idx_orphan_queue_delete_after ON s3_orphan_queue(delete_after) WHERE deletion_status = 'pending';

-- ============================================================================
-- 4. OFFLOADING CONFIG
-- ============================================================================

CREATE TABLE IF NOT EXISTS s3_offloading_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Feature toggles
  offloading_enabled BOOLEAN DEFAULT true,
  auto_offload_on_insert BOOLEAN DEFAULT false, -- Only offload large content
  auto_offload_threshold_bytes INTEGER DEFAULT 10000, -- 10KB threshold
  
  -- Content type settings
  offload_messages BOOLEAN DEFAULT true,
  offload_memories BOOLEAN DEFAULT true,
  offload_episodes BOOLEAN DEFAULT true,
  offload_training_data BOOLEAN DEFAULT true,
  
  -- Compression
  compression_enabled BOOLEAN DEFAULT true,
  compression_algorithm VARCHAR(20) DEFAULT 'gzip',
  compression_threshold_bytes INTEGER DEFAULT 1000, -- Compress if > 1KB
  
  -- Retention
  orphan_grace_period_hours INTEGER DEFAULT 24,
  auto_cleanup_enabled BOOLEAN DEFAULT true,
  
  -- S3 bucket configuration
  content_bucket VARCHAR(256),
  content_prefix VARCHAR(256) DEFAULT 'content/',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE s3_offloading_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY s3_offloading_config_tenant_isolation ON s3_offloading_config
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 5. TRIGGER: QUEUE ORPHANS ON SOURCE DELETION
-- ============================================================================

CREATE OR REPLACE FUNCTION queue_s3_orphan_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_s3_key VARCHAR;
  v_registry_id UUID;
BEGIN
  -- Check each S3 key column and queue orphans
  
  -- For thinktank_messages
  IF TG_TABLE_NAME = 'thinktank_messages' AND OLD.content_s3_key IS NOT NULL THEN
    INSERT INTO s3_orphan_queue (s3_bucket, s3_key, reason, original_registry_id)
    SELECT s.s3_bucket, s.s3_key, 'source_deleted', s.id
    FROM s3_content_registry s
    WHERE s.s3_key = OLD.content_s3_key
    ON CONFLICT (s3_bucket, s3_key) DO NOTHING;
    
    UPDATE s3_content_registry 
    SET reference_count = reference_count - 1, marked_for_deletion = true
    WHERE s3_key = OLD.content_s3_key;
  END IF;
  
  -- For memories
  IF TG_TABLE_NAME = 'memories' AND OLD.content_s3_key IS NOT NULL THEN
    INSERT INTO s3_orphan_queue (s3_bucket, s3_key, reason)
    SELECT s.s3_bucket, s.s3_key, 'source_deleted'
    FROM s3_content_registry s
    WHERE s.s3_key = OLD.content_s3_key
    ON CONFLICT (s3_bucket, s3_key) DO NOTHING;
    
    UPDATE s3_content_registry 
    SET reference_count = reference_count - 1, marked_for_deletion = true
    WHERE s3_key = OLD.content_s3_key;
  END IF;
  
  -- For learning_episodes
  IF TG_TABLE_NAME = 'learning_episodes' THEN
    IF OLD.draft_s3_key IS NOT NULL THEN
      INSERT INTO s3_orphan_queue (s3_bucket, s3_key, reason)
      SELECT s.s3_bucket, s.s3_key, 'source_deleted'
      FROM s3_content_registry s
      WHERE s.s3_key = OLD.draft_s3_key
      ON CONFLICT (s3_bucket, s3_key) DO NOTHING;
      
      UPDATE s3_content_registry 
      SET reference_count = reference_count - 1, marked_for_deletion = true
      WHERE s3_key = OLD.draft_s3_key;
    END IF;
    
    IF OLD.final_s3_key IS NOT NULL THEN
      INSERT INTO s3_orphan_queue (s3_bucket, s3_key, reason)
      SELECT s.s3_bucket, s.s3_key, 'source_deleted'
      FROM s3_content_registry s
      WHERE s.s3_key = OLD.final_s3_key
      ON CONFLICT (s3_bucket, s3_key) DO NOTHING;
      
      UPDATE s3_content_registry 
      SET reference_count = reference_count - 1, marked_for_deletion = true
      WHERE s3_key = OLD.final_s3_key;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for each table
CREATE TRIGGER thinktank_messages_orphan_trigger
  BEFORE DELETE ON thinktank_messages
  FOR EACH ROW EXECUTE FUNCTION queue_s3_orphan_on_delete();

CREATE TRIGGER memories_orphan_trigger
  BEFORE DELETE ON memories
  FOR EACH ROW EXECUTE FUNCTION queue_s3_orphan_on_delete();

CREATE TRIGGER learning_episodes_orphan_trigger
  BEFORE DELETE ON learning_episodes
  FOR EACH ROW EXECUTE FUNCTION queue_s3_orphan_on_delete();

-- ============================================================================
-- 6. ORPHAN CLEANUP FUNCTION (Called by EventBridge Lambda)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_orphans_for_deletion(
  p_batch_size INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  s3_bucket VARCHAR,
  s3_key VARCHAR,
  s3_version_id VARCHAR,
  reason VARCHAR
) AS $$
BEGIN
  -- Mark batch as processing
  UPDATE s3_orphan_queue
  SET deletion_status = 'processing'
  WHERE id IN (
    SELECT q.id FROM s3_orphan_queue q
    WHERE q.deletion_status = 'pending'
    AND q.delete_after <= NOW()
    ORDER BY q.queued_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  );
  
  -- Return the batch
  RETURN QUERY
  SELECT q.id, q.s3_bucket, q.s3_key, q.s3_version_id, q.reason
  FROM s3_orphan_queue q
  WHERE q.deletion_status = 'processing';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mark_orphan_deleted(
  p_id UUID,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE s3_orphan_queue
  SET 
    deletion_status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    deleted_at = CASE WHEN p_success THEN NOW() ELSE NULL END,
    error_message = p_error_message
  WHERE id = p_id;
  
  -- If successful, also remove from registry
  IF p_success THEN
    DELETE FROM s3_content_registry
    WHERE id = (SELECT original_registry_id FROM s3_orphan_queue WHERE id = p_id);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. CONTENT DEDUP FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION find_existing_s3_content(
  p_tenant_id UUID,
  p_content_hash VARCHAR
)
RETURNS TABLE (
  s3_key VARCHAR,
  s3_bucket VARCHAR
) AS $$
BEGIN
  -- If content already exists, return existing key (content-addressable storage)
  RETURN QUERY
  SELECT r.s3_key, r.s3_bucket
  FROM s3_content_registry r
  WHERE r.tenant_id = p_tenant_id
  AND r.content_hash = p_content_hash
  AND r.marked_for_deletion = false
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. OFFLOADING STATS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW v_s3_offloading_stats AS
SELECT
  tenant_id,
  source_table,
  COUNT(*) as total_objects,
  SUM(size_bytes) as total_size_bytes,
  SUM(size_bytes) / (1024 * 1024) as total_size_mb,
  COUNT(*) FILTER (WHERE compression != 'none') as compressed_count,
  COUNT(*) FILTER (WHERE marked_for_deletion) as pending_deletion,
  AVG(size_bytes) as avg_object_size_bytes
FROM s3_content_registry
GROUP BY tenant_id, source_table;

CREATE OR REPLACE VIEW v_orphan_cleanup_stats AS
SELECT
  deletion_status,
  reason,
  COUNT(*) as count,
  MIN(queued_at) as oldest_queued,
  MAX(queued_at) as newest_queued
FROM s3_orphan_queue
GROUP BY deletion_status, reason;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE s3_content_registry IS 'Central registry of all S3-stored content with reference tracking';
COMMENT ON TABLE s3_orphan_queue IS 'Queue of S3 objects to delete after source record deletion';
COMMENT ON TABLE s3_offloading_config IS 'Per-tenant configuration for S3 content offloading';
COMMENT ON FUNCTION queue_s3_orphan_on_delete IS 'Trigger function to queue orphaned S3 objects when source records are deleted';
COMMENT ON FUNCTION get_orphans_for_deletion IS 'Get batch of orphaned S3 objects ready for deletion';
COMMENT ON FUNCTION mark_orphan_deleted IS 'Mark orphan as deleted after S3 deletion succeeds';
