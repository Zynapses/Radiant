-- RADIANT v4.18.0 - User Persistent Context
-- Migration 100: Solves LLM's fundamental problem of forgetting context
-- Provides user-level persistent storage that works across all sessions

-- ============================================================================
-- User Persistent Context Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_persistent_context (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  context_type TEXT NOT NULL CHECK (context_type IN (
    'fact', 'preference', 'instruction', 'relationship', 
    'project', 'skill', 'history', 'correction'
  )),
  content TEXT NOT NULL,
  content_embedding vector(1536),
  importance DECIMAL(3,2) DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  confidence DECIMAL(3,2) DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT DEFAULT 'explicit' CHECK (source IN ('explicit', 'inferred', 'conversation')),
  source_conversation_id UUID,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient retrieval
CREATE INDEX IF NOT EXISTS idx_user_context_user 
ON user_persistent_context(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_context_type 
ON user_persistent_context(tenant_id, user_id, context_type);

CREATE INDEX IF NOT EXISTS idx_user_context_importance 
ON user_persistent_context(tenant_id, user_id, importance DESC);

CREATE INDEX IF NOT EXISTS idx_user_context_embedding 
ON user_persistent_context USING ivfflat (content_embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_user_context_expires 
ON user_persistent_context(expires_at) WHERE expires_at IS NOT NULL;

-- RLS Policy
ALTER TABLE user_persistent_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_persistent_context_tenant_isolation 
ON user_persistent_context
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE user_persistent_context IS 'User-level persistent context that survives across sessions';
COMMENT ON COLUMN user_persistent_context.context_type IS 'Type: fact, preference, instruction, relationship, project, skill, history, correction';
COMMENT ON COLUMN user_persistent_context.importance IS 'How important to include (0-1). 0.9+ always included';
COMMENT ON COLUMN user_persistent_context.confidence IS 'How confident we are this is accurate (0-1)';
COMMENT ON COLUMN user_persistent_context.source IS 'How this was learned: explicit, inferred, conversation';

-- ============================================================================
-- Context Extraction Log (for learning audit)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_context_extraction_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  extracted_count INTEGER DEFAULT 0,
  corrections_count INTEGER DEFAULT 0,
  extraction_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_context_extraction_user 
ON user_context_extraction_log(tenant_id, user_id, created_at DESC);

ALTER TABLE user_context_extraction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_context_extraction_log_tenant 
ON user_context_extraction_log
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- User Context Preferences
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_context_preferences (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  auto_learn_enabled BOOLEAN DEFAULT true,
  min_confidence_threshold DECIMAL(3,2) DEFAULT 0.7,
  max_context_entries INTEGER DEFAULT 100,
  context_injection_enabled BOOLEAN DEFAULT true,
  allowed_context_types TEXT[] DEFAULT ARRAY['fact', 'preference', 'instruction', 'relationship', 'project', 'skill', 'history', 'correction'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_id)
);

ALTER TABLE user_context_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_context_preferences_tenant 
ON user_context_preferences
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE user_context_preferences IS 'Per-user settings for context learning and injection';

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to get context injection for a user
CREATE OR REPLACE FUNCTION get_user_context_injection(
  p_tenant_id UUID,
  p_user_id UUID,
  p_prompt_embedding vector(1536),
  p_max_entries INTEGER DEFAULT 10,
  p_min_relevance DECIMAL DEFAULT 0.3
)
RETURNS TABLE (
  entry_id UUID,
  context_type TEXT,
  content TEXT,
  importance DECIMAL,
  relevance DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH relevant_context AS (
    SELECT 
      upc.entry_id,
      upc.context_type,
      upc.content,
      upc.importance,
      upc.confidence,
      1 - (upc.content_embedding <=> p_prompt_embedding) as relevance
    FROM user_persistent_context upc
    WHERE upc.tenant_id = p_tenant_id 
      AND upc.user_id = p_user_id
      AND (upc.expires_at IS NULL OR upc.expires_at > NOW())
  ),
  high_importance AS (
    SELECT * FROM relevant_context WHERE importance >= 0.9
  ),
  semantically_relevant AS (
    SELECT * FROM relevant_context 
    WHERE relevance >= p_min_relevance
    ORDER BY (relevance * importance * confidence) DESC
    LIMIT p_max_entries
  )
  SELECT DISTINCT ON (combined.entry_id)
    combined.entry_id,
    combined.context_type,
    combined.content,
    combined.importance,
    combined.relevance
  FROM (
    SELECT * FROM high_importance
    UNION ALL
    SELECT * FROM semantically_relevant
  ) combined
  ORDER BY combined.entry_id, combined.importance DESC
  LIMIT p_max_entries;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to clean up expired and low-confidence context
CREATE OR REPLACE FUNCTION cleanup_user_context(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM user_persistent_context
    WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    AND (
      -- Expired entries
      (expires_at IS NOT NULL AND expires_at < NOW())
      -- Very low confidence entries older than 30 days
      OR (confidence < 0.3 AND updated_at < NOW() - INTERVAL '30 days')
      -- Never used entries older than 90 days
      OR (last_used_at IS NULL AND created_at < NOW() - INTERVAL '90 days')
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_context_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_persistent_context_timestamp
  BEFORE UPDATE ON user_persistent_context
  FOR EACH ROW EXECUTE FUNCTION update_user_context_timestamp();

CREATE TRIGGER update_user_context_preferences_timestamp
  BEFORE UPDATE ON user_context_preferences
  FOR EACH ROW EXECUTE FUNCTION update_user_context_timestamp();
