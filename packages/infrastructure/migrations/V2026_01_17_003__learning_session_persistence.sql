-- RADIANT v5.12.1 - Learning Session Persistence
-- Ensures in-memory data survives Lambda restarts/reboot
-- Persists: active episodes, recent generations, tool usage sessions

-- ============================================================================
-- 1. ACTIVE EPISODES (Episode Logger in-memory state)
-- ============================================================================

CREATE TABLE IF NOT EXISTS active_episodes_cache (
  episode_id UUID PRIMARY KEY REFERENCES learning_episodes(episode_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL,
  episode_data JSONB NOT NULL,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_active_episodes_tenant ON active_episodes_cache(tenant_id);
CREATE INDEX idx_active_episodes_expires ON active_episodes_cache(expires_at);
CREATE INDEX idx_active_episodes_session ON active_episodes_cache(session_id);

-- RLS
ALTER TABLE active_episodes_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY active_episodes_cache_tenant_isolation ON active_episodes_cache
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 2. RECENT GENERATIONS (Paste-Back Detection tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS recent_generations_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(500) NOT NULL UNIQUE, -- tenant_id:user_id:session_id
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL,
  episode_id UUID REFERENCES learning_episodes(episode_id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recent_generations_key ON recent_generations_cache(cache_key);
CREATE INDEX idx_recent_generations_expires ON recent_generations_cache(expires_at);
CREATE INDEX idx_recent_generations_tenant ON recent_generations_cache(tenant_id);

-- RLS
ALTER TABLE recent_generations_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY recent_generations_cache_tenant_isolation ON recent_generations_cache
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 3. TOOL USAGE SESSIONS (Tool Entropy co-occurrence tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tool_usage_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key VARCHAR(500) NOT NULL, -- tenant_id:user_id:session_id
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL,
  tool_name VARCHAR(255) NOT NULL,
  used_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tool_usage_sessions_key ON tool_usage_sessions(session_key);
CREATE INDEX idx_tool_usage_sessions_expires ON tool_usage_sessions(expires_at);
CREATE INDEX idx_tool_usage_sessions_tenant ON tool_usage_sessions(tenant_id);

-- RLS
ALTER TABLE tool_usage_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tool_usage_sessions_tenant_isolation ON tool_usage_sessions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 4. FEEDBACK LOOP PENDING ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_feedback_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  episode_id UUID REFERENCES learning_episodes(episode_id) ON DELETE CASCADE,
  feedback_type VARCHAR(50) NOT NULL, -- 'skeletonize', 'recipe_check', 'dpo_pair', 'cluster'
  priority INTEGER DEFAULT 0,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pending_feedback_status ON pending_feedback_items(status) WHERE status = 'pending';
CREATE INDEX idx_pending_feedback_tenant ON pending_feedback_items(tenant_id);
CREATE INDEX idx_pending_feedback_type ON pending_feedback_items(feedback_type);
CREATE INDEX idx_pending_feedback_priority ON pending_feedback_items(priority DESC, created_at ASC);

-- RLS
ALTER TABLE pending_feedback_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY pending_feedback_tenant_isolation ON pending_feedback_items
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 5. CLEANUP FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_learning_caches()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Cleanup expired active episodes
  DELETE FROM active_episodes_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  -- Cleanup expired recent generations
  DELETE FROM recent_generations_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  -- Cleanup expired tool usage sessions
  DELETE FROM tool_usage_sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  -- Cleanup completed/failed feedback items older than 7 days
  DELETE FROM pending_feedback_items 
  WHERE status IN ('completed', 'failed') 
  AND updated_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. RESTORE FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_episodes_for_restore()
RETURNS TABLE (
  episode_id UUID,
  episode_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT aec.episode_id, aec.episode_data
  FROM active_episodes_cache aec
  WHERE aec.expires_at > NOW()
  ORDER BY aec.last_activity_at DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_recent_generations_for_restore()
RETURNS TABLE (
  cache_key VARCHAR,
  episode_id UUID,
  generated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT rgc.cache_key, rgc.episode_id, rgc.generated_at
  FROM recent_generations_cache rgc
  WHERE rgc.expires_at > NOW()
  ORDER BY rgc.generated_at DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_tool_usage_for_restore(p_session_key VARCHAR)
RETURNS TABLE (
  tool_name VARCHAR,
  used_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT tus.tool_name, tus.used_at
  FROM tool_usage_sessions tus
  WHERE tus.session_key = p_session_key
  AND tus.expires_at > NOW()
  ORDER BY tus.used_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. TRIGGER FOR AUTO-UPDATING TIMESTAMPS
-- ============================================================================

CREATE TRIGGER trigger_pending_feedback_updated
  BEFORE UPDATE ON pending_feedback_items
  FOR EACH ROW EXECUTE FUNCTION update_enhanced_learning_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE active_episodes_cache IS 'Persists Episode Logger in-memory active episodes for Lambda restart recovery';
COMMENT ON TABLE recent_generations_cache IS 'Persists Paste-Back Detection recent generations for restart recovery';
COMMENT ON TABLE tool_usage_sessions IS 'Persists Tool Entropy session data for co-occurrence tracking across restarts';
COMMENT ON TABLE pending_feedback_items IS 'Queue of unprocessed feedback items for async processing with retry support';
COMMENT ON FUNCTION cleanup_expired_learning_caches IS 'Periodic cleanup of expired cache entries - call via EventBridge every 5 minutes';
