-- ============================================================================
-- RADIANT Semantic Blackboard & Multi-Agent Orchestration
-- Migration: 158_semantic_blackboard_orchestration.sql
-- Version: 5.3.0
-- Date: January 10, 2026
-- 
-- Implements:
-- 1. Semantic Blackboard - Vector DB for question matching/reuse
-- 2. Agent Dependencies - Cycle detection for deadlock prevention
-- 3. Resource Locking - Prevent race conditions on shared resources
-- 4. Process Hydration - State serialization for long-running tasks
-- 5. Question Grouping - Fan-out answers to multiple agents
-- ============================================================================

-- ============================================================================
-- PART 1: RESOLVED DECISIONS (Semantic Blackboard)
-- Questions asked by agents with vector embeddings for semantic matching
-- ============================================================================

CREATE TABLE IF NOT EXISTS resolved_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Question details
  question TEXT NOT NULL,
  question_normalized TEXT NOT NULL, -- Lowercase, trimmed, punctuation removed
  question_embedding vector(1536), -- OpenAI ada-002 embedding
  topic_tag VARCHAR(100), -- e.g., 'budget', 'timeline', 'scope'
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Answer details
  answer TEXT NOT NULL,
  answer_source VARCHAR(50) NOT NULL CHECK (answer_source IN ('user', 'memory', 'default', 'inferred')),
  confidence DECIMAL(5,4) DEFAULT 1.0, -- 1.0 for user-provided, lower for inferred
  
  -- Validity tracking
  is_valid BOOLEAN DEFAULT TRUE,
  invalidated_at TIMESTAMPTZ,
  invalidated_by UUID REFERENCES users(id),
  invalidation_reason TEXT,
  superseded_by UUID REFERENCES resolved_decisions(id),
  
  -- Usage tracking
  times_reused INTEGER DEFAULT 0,
  last_reused_at TIMESTAMPTZ,
  
  -- Original question source
  original_agent VARCHAR(100), -- e.g., 'radiant', 'think_tank', 'cato'
  original_session_id UUID,
  original_decision_id UUID REFERENCES pending_decisions(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- Optional TTL for temporary decisions
);

-- Vector index for semantic search
CREATE INDEX IF NOT EXISTS idx_resolved_decisions_embedding 
  ON resolved_decisions USING ivfflat (question_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_resolved_decisions_tenant ON resolved_decisions(tenant_id);
CREATE INDEX idx_resolved_decisions_topic ON resolved_decisions(topic_tag);
CREATE INDEX idx_resolved_decisions_valid ON resolved_decisions(is_valid) WHERE is_valid = TRUE;
CREATE INDEX idx_resolved_decisions_question_normalized ON resolved_decisions(question_normalized);

-- ============================================================================
-- PART 2: AGENT REGISTRY
-- Track all active agents for dependency and cycle detection
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Agent identity
  agent_type VARCHAR(100) NOT NULL, -- 'radiant', 'think_tank', 'cato', 'artifact_engine', etc.
  agent_instance_id VARCHAR(256) NOT NULL, -- Unique instance ID
  
  -- Execution context
  session_id UUID,
  flyte_execution_id VARCHAR(256),
  flyte_node_id VARCHAR(256),
  
  -- State
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'waiting', 'blocked', 'completed', 'failed', 'hydrated')),
  blocked_reason TEXT,
  blocked_by_agent_id UUID REFERENCES agent_registry(id),
  blocked_by_resource_id UUID,
  
  -- Hydration state (for process serialization)
  is_hydrated BOOLEAN DEFAULT FALSE,
  hydration_state JSONB, -- Serialized agent state
  hydration_checkpoint TEXT, -- Last checkpoint name
  hydrated_at TIMESTAMPTZ,
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  UNIQUE(tenant_id, agent_instance_id)
);

CREATE INDEX idx_agent_registry_tenant ON agent_registry(tenant_id);
CREATE INDEX idx_agent_registry_status ON agent_registry(status);
CREATE INDEX idx_agent_registry_session ON agent_registry(session_id);

-- ============================================================================
-- PART 3: AGENT DEPENDENCIES
-- Track dependencies between agents for cycle detection
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Dependency relationship
  dependent_agent_id UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  dependency_agent_id UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  
  -- Dependency type
  dependency_type VARCHAR(50) NOT NULL CHECK (dependency_type IN (
    'data', -- Agent A needs data from Agent B
    'approval', -- Agent A needs approval from Agent B
    'resource', -- Agent A needs a resource held by Agent B
    'sequence' -- Agent A must run after Agent B
  )),
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'satisfied', 'failed', 'timeout')),
  satisfied_at TIMESTAMPTZ,
  
  -- What's being waited for
  wait_key VARCHAR(256), -- e.g., 'budget_approval', 'file:/path/to/file'
  wait_value JSONB, -- The value received when satisfied
  
  -- Timeout
  timeout_seconds INTEGER DEFAULT 3600,
  expires_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(dependent_agent_id, dependency_agent_id, wait_key)
);

CREATE INDEX idx_agent_dependencies_dependent ON agent_dependencies(dependent_agent_id);
CREATE INDEX idx_agent_dependencies_dependency ON agent_dependencies(dependency_agent_id);
CREATE INDEX idx_agent_dependencies_status ON agent_dependencies(status);

-- ============================================================================
-- PART 4: RESOURCE LOCKS
-- Prevent race conditions on shared resources
-- ============================================================================

CREATE TABLE IF NOT EXISTS resource_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Resource identification
  resource_type VARCHAR(100) NOT NULL, -- 'file', 'database_row', 'api_endpoint', 'conversation'
  resource_uri VARCHAR(1024) NOT NULL, -- e.g., 'file:/path/to/file', 'db:table:id'
  resource_hash VARCHAR(64), -- SHA256 of resource URI for fast lookup
  
  -- Lock holder
  holder_agent_id UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  holder_agent_type VARCHAR(100) NOT NULL,
  
  -- Lock type
  lock_type VARCHAR(20) NOT NULL CHECK (lock_type IN ('read', 'write', 'exclusive')),
  
  -- Lock state
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  
  -- Queue for waiting agents
  wait_queue UUID[] DEFAULT '{}', -- Array of agent_registry IDs waiting for this lock
  
  UNIQUE(tenant_id, resource_hash) WHERE released_at IS NULL
);

CREATE INDEX idx_resource_locks_tenant ON resource_locks(tenant_id);
CREATE INDEX idx_resource_locks_resource ON resource_locks(resource_hash);
CREATE INDEX idx_resource_locks_holder ON resource_locks(holder_agent_id);
CREATE INDEX idx_resource_locks_active ON resource_locks(tenant_id, resource_hash) WHERE released_at IS NULL;

-- ============================================================================
-- PART 5: QUESTION GROUPS
-- Group similar questions from multiple agents for single-answer fan-out
-- ============================================================================

CREATE TABLE IF NOT EXISTS question_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Group identity
  canonical_question TEXT NOT NULL, -- The "best" version of the question
  topic_tag VARCHAR(100),
  question_embedding vector(1536),
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'expired', 'cancelled')),
  
  -- Answer (when provided)
  answer TEXT,
  answered_by UUID REFERENCES users(id),
  answered_at TIMESTAMPTZ,
  
  -- Decision tracking
  decision_id UUID REFERENCES pending_decisions(id), -- The single HITL decision for this group
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_question_groups_tenant ON question_groups(tenant_id);
CREATE INDEX idx_question_groups_status ON question_groups(status);
CREATE INDEX idx_question_groups_embedding 
  ON question_groups USING ivfflat (question_embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================================
-- PART 6: QUESTION GROUP MEMBERS
-- Individual questions that belong to a group
-- ============================================================================

CREATE TABLE IF NOT EXISTS question_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES question_groups(id) ON DELETE CASCADE,
  
  -- Original question
  agent_id UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  similarity_score DECIMAL(5,4), -- How similar to canonical question
  
  -- Fan-out tracking
  answer_delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_question_group_members_group ON question_group_members(group_id);
CREATE INDEX idx_question_group_members_agent ON question_group_members(agent_id);

-- ============================================================================
-- PART 7: PROCESS HYDRATION SNAPSHOTS
-- Store serialized agent state for long-running tasks
-- ============================================================================

CREATE TABLE IF NOT EXISTS hydration_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  
  -- Snapshot identity
  checkpoint_name VARCHAR(256) NOT NULL,
  checkpoint_version INTEGER DEFAULT 1,
  
  -- Serialized state
  state_data JSONB NOT NULL, -- Full agent state
  state_hash VARCHAR(64) NOT NULL, -- For integrity verification
  state_size_bytes INTEGER NOT NULL,
  
  -- Compression
  is_compressed BOOLEAN DEFAULT FALSE,
  compression_type VARCHAR(20), -- 'gzip', 'lz4', etc.
  compressed_data BYTEA, -- If compressed, store here instead of state_data
  
  -- S3 storage for large states
  s3_bucket VARCHAR(256),
  s3_key VARCHAR(1024),
  
  -- Resume information
  resume_point VARCHAR(256), -- Where to resume from
  resume_context JSONB, -- Additional context for resumption
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Auto-cleanup old snapshots
  restored_at TIMESTAMPTZ,
  restored_count INTEGER DEFAULT 0
);

CREATE INDEX idx_hydration_snapshots_agent ON hydration_snapshots(agent_id);
CREATE INDEX idx_hydration_snapshots_checkpoint ON hydration_snapshots(agent_id, checkpoint_name);

-- ============================================================================
-- PART 8: BLACKBOARD EVENTS
-- Audit trail for all blackboard operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS blackboard_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Event type
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'question_asked', 'question_matched', 'question_grouped',
    'answer_provided', 'answer_reused', 'answer_invalidated',
    'lock_acquired', 'lock_released', 'lock_denied', 'lock_timeout',
    'dependency_created', 'dependency_satisfied', 'cycle_detected',
    'agent_registered', 'agent_hydrated', 'agent_restored', 'agent_completed'
  )),
  
  -- Related entities
  agent_id UUID REFERENCES agent_registry(id),
  decision_id UUID REFERENCES resolved_decisions(id),
  group_id UUID REFERENCES question_groups(id),
  lock_id UUID REFERENCES resource_locks(id),
  dependency_id UUID REFERENCES agent_dependencies(id),
  
  -- Event details
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blackboard_events_tenant ON blackboard_events(tenant_id);
CREATE INDEX idx_blackboard_events_type ON blackboard_events(event_type);
CREATE INDEX idx_blackboard_events_agent ON blackboard_events(agent_id);
CREATE INDEX idx_blackboard_events_created ON blackboard_events(created_at);

-- ============================================================================
-- PART 9: BLACKBOARD CONFIGURATION
-- Per-tenant configuration for the blackboard system
-- ============================================================================

CREATE TABLE IF NOT EXISTS blackboard_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Semantic matching
  similarity_threshold DECIMAL(5,4) DEFAULT 0.85, -- Minimum similarity for question matching
  embedding_model VARCHAR(100) DEFAULT 'text-embedding-ada-002',
  
  -- Question grouping
  enable_question_grouping BOOLEAN DEFAULT TRUE,
  grouping_window_seconds INTEGER DEFAULT 60, -- How long to wait for similar questions
  max_group_size INTEGER DEFAULT 10,
  
  -- Answer reuse
  enable_answer_reuse BOOLEAN DEFAULT TRUE,
  answer_ttl_seconds INTEGER DEFAULT 3600, -- How long answers are valid
  max_reuse_count INTEGER DEFAULT 100,
  
  -- Resource locking
  default_lock_timeout_seconds INTEGER DEFAULT 300,
  max_lock_wait_seconds INTEGER DEFAULT 60,
  enable_lock_queue BOOLEAN DEFAULT TRUE,
  
  -- Process hydration
  enable_auto_hydration BOOLEAN DEFAULT TRUE,
  hydration_threshold_seconds INTEGER DEFAULT 300, -- Hydrate after waiting this long
  max_hydration_size_mb INTEGER DEFAULT 50,
  hydration_s3_bucket VARCHAR(256),
  
  -- Cycle detection
  enable_cycle_detection BOOLEAN DEFAULT TRUE,
  max_dependency_depth INTEGER DEFAULT 10,
  cycle_check_interval_seconds INTEGER DEFAULT 30,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default config
INSERT INTO blackboard_config (tenant_id) VALUES (NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PART 10: ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE resolved_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE hydration_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE blackboard_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE blackboard_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY resolved_decisions_tenant_isolation ON resolved_decisions
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY agent_registry_tenant_isolation ON agent_registry
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY agent_dependencies_tenant_isolation ON agent_dependencies
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY resource_locks_tenant_isolation ON resource_locks
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY question_groups_tenant_isolation ON question_groups
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY question_group_members_tenant_isolation ON question_group_members
  FOR ALL USING (
    group_id IN (SELECT id FROM question_groups WHERE tenant_id = current_setting('app.current_tenant_id')::UUID)
  );

CREATE POLICY hydration_snapshots_tenant_isolation ON hydration_snapshots
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY blackboard_events_tenant_isolation ON blackboard_events
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY blackboard_config_tenant_isolation ON blackboard_config
  FOR ALL USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- PART 11: HELPER FUNCTIONS
-- ============================================================================

-- Function to detect cycles in agent dependencies
CREATE OR REPLACE FUNCTION detect_dependency_cycle(
  p_dependent_agent_id UUID,
  p_dependency_agent_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_cycle BOOLEAN := FALSE;
  v_visited UUID[] := ARRAY[p_dependent_agent_id];
  v_current UUID := p_dependency_agent_id;
  v_next UUID;
BEGIN
  -- BFS to detect cycle
  WHILE v_current IS NOT NULL AND NOT v_has_cycle LOOP
    -- Check if we've reached the original agent
    IF v_current = p_dependent_agent_id THEN
      v_has_cycle := TRUE;
      EXIT;
    END IF;
    
    -- Check if already visited
    IF v_current = ANY(v_visited) THEN
      EXIT;
    END IF;
    
    v_visited := array_append(v_visited, v_current);
    
    -- Get next dependency
    SELECT dependency_agent_id INTO v_next
    FROM agent_dependencies
    WHERE dependent_agent_id = v_current
      AND status = 'pending'
    LIMIT 1;
    
    v_current := v_next;
  END LOOP;
  
  RETURN v_has_cycle;
END;
$$ LANGUAGE plpgsql;

-- Function to find semantic matches for a question
CREATE OR REPLACE FUNCTION find_similar_decisions(
  p_tenant_id UUID,
  p_question_embedding vector(1536),
  p_similarity_threshold DECIMAL DEFAULT 0.85,
  p_limit INTEGER DEFAULT 5
) RETURNS TABLE (
  decision_id UUID,
  question TEXT,
  answer TEXT,
  similarity DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rd.id,
    rd.question,
    rd.answer,
    (1 - (rd.question_embedding <=> p_question_embedding))::DECIMAL AS similarity
  FROM resolved_decisions rd
  WHERE rd.tenant_id = p_tenant_id
    AND rd.is_valid = TRUE
    AND (rd.expires_at IS NULL OR rd.expires_at > NOW())
    AND (1 - (rd.question_embedding <=> p_question_embedding)) >= p_similarity_threshold
  ORDER BY rd.question_embedding <=> p_question_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to acquire a resource lock
CREATE OR REPLACE FUNCTION acquire_resource_lock(
  p_tenant_id UUID,
  p_resource_uri VARCHAR,
  p_agent_id UUID,
  p_agent_type VARCHAR,
  p_lock_type VARCHAR,
  p_timeout_seconds INTEGER DEFAULT 300
) RETURNS TABLE (
  success BOOLEAN,
  lock_id UUID,
  wait_position INTEGER,
  holder_agent_id UUID
) AS $$
DECLARE
  v_resource_hash VARCHAR(64);
  v_existing_lock RECORD;
  v_lock_id UUID;
  v_wait_position INTEGER;
BEGIN
  v_resource_hash := encode(sha256(p_resource_uri::bytea), 'hex');
  
  -- Check for existing lock
  SELECT * INTO v_existing_lock
  FROM resource_locks
  WHERE tenant_id = p_tenant_id
    AND resource_hash = v_resource_hash
    AND released_at IS NULL
    AND expires_at > NOW()
  FOR UPDATE;
  
  IF v_existing_lock IS NULL THEN
    -- No existing lock, acquire it
    INSERT INTO resource_locks (
      tenant_id, resource_type, resource_uri, resource_hash,
      holder_agent_id, holder_agent_type, lock_type, expires_at
    ) VALUES (
      p_tenant_id,
      CASE 
        WHEN p_resource_uri LIKE 'file:%' THEN 'file'
        WHEN p_resource_uri LIKE 'db:%' THEN 'database_row'
        ELSE 'other'
      END,
      p_resource_uri,
      v_resource_hash,
      p_agent_id,
      p_agent_type,
      p_lock_type,
      NOW() + (p_timeout_seconds || ' seconds')::INTERVAL
    )
    RETURNING id INTO v_lock_id;
    
    RETURN QUERY SELECT TRUE, v_lock_id, 0::INTEGER, NULL::UUID;
  ELSE
    -- Lock exists, check compatibility
    IF v_existing_lock.lock_type = 'read' AND p_lock_type = 'read' THEN
      -- Multiple readers allowed
      RETURN QUERY SELECT TRUE, v_existing_lock.id, 0::INTEGER, v_existing_lock.holder_agent_id;
    ELSE
      -- Add to wait queue
      v_wait_position := COALESCE(array_length(v_existing_lock.wait_queue, 1), 0) + 1;
      
      UPDATE resource_locks
      SET wait_queue = array_append(wait_queue, p_agent_id)
      WHERE id = v_existing_lock.id;
      
      RETURN QUERY SELECT FALSE, v_existing_lock.id, v_wait_position, v_existing_lock.holder_agent_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to release a resource lock
CREATE OR REPLACE FUNCTION release_resource_lock(
  p_lock_id UUID,
  p_agent_id UUID
) RETURNS TABLE (
  success BOOLEAN,
  next_agent_id UUID
) AS $$
DECLARE
  v_lock RECORD;
  v_next_agent UUID;
BEGIN
  SELECT * INTO v_lock
  FROM resource_locks
  WHERE id = p_lock_id
    AND holder_agent_id = p_agent_id
    AND released_at IS NULL
  FOR UPDATE;
  
  IF v_lock IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;
  
  -- Get next agent from wait queue
  IF array_length(v_lock.wait_queue, 1) > 0 THEN
    v_next_agent := v_lock.wait_queue[1];
  END IF;
  
  -- Release the lock
  UPDATE resource_locks
  SET released_at = NOW(),
      wait_queue = wait_queue[2:array_length(wait_queue, 1)]
  WHERE id = p_lock_id;
  
  RETURN QUERY SELECT TRUE, v_next_agent;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 12: TRIGGERS
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_blackboard_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_resolved_decisions_timestamp
  BEFORE UPDATE ON resolved_decisions
  FOR EACH ROW EXECUTE FUNCTION update_blackboard_timestamp();

CREATE TRIGGER update_blackboard_config_timestamp
  BEFORE UPDATE ON blackboard_config
  FOR EACH ROW EXECUTE FUNCTION update_blackboard_timestamp();

-- Log blackboard events automatically
CREATE OR REPLACE FUNCTION log_resolved_decision_event()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO blackboard_events (tenant_id, event_type, decision_id, details)
    VALUES (NEW.tenant_id, 'answer_provided', NEW.id, 
      jsonb_build_object('question', NEW.question, 'answer_source', NEW.answer_source));
  ELSIF TG_OP = 'UPDATE' AND OLD.is_valid = TRUE AND NEW.is_valid = FALSE THEN
    INSERT INTO blackboard_events (tenant_id, event_type, decision_id, details)
    VALUES (NEW.tenant_id, 'answer_invalidated', NEW.id,
      jsonb_build_object('reason', NEW.invalidation_reason, 'invalidated_by', NEW.invalidated_by));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_resolved_decision_changes
  AFTER INSERT OR UPDATE ON resolved_decisions
  FOR EACH ROW EXECUTE FUNCTION log_resolved_decision_event();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE resolved_decisions IS 'Semantic Blackboard: Stores resolved questions with vector embeddings for matching and reuse';
COMMENT ON TABLE agent_registry IS 'Registry of active agents for dependency tracking and cycle detection';
COMMENT ON TABLE agent_dependencies IS 'Dependencies between agents for deadlock prevention';
COMMENT ON TABLE resource_locks IS 'Resource locks to prevent race conditions between agents';
COMMENT ON TABLE question_groups IS 'Groups of similar questions for single-answer fan-out';
COMMENT ON TABLE question_group_members IS 'Individual questions belonging to a question group';
COMMENT ON TABLE hydration_snapshots IS 'Serialized agent state for long-running task resumption';
COMMENT ON TABLE blackboard_events IS 'Audit trail for all blackboard operations';
COMMENT ON TABLE blackboard_config IS 'Per-tenant configuration for the blackboard system';

COMMENT ON FUNCTION detect_dependency_cycle IS 'Detects circular dependencies between agents to prevent deadlocks';
COMMENT ON FUNCTION find_similar_decisions IS 'Finds semantically similar resolved decisions using vector search';
COMMENT ON FUNCTION acquire_resource_lock IS 'Attempts to acquire a resource lock, returns wait position if blocked';
COMMENT ON FUNCTION release_resource_lock IS 'Releases a resource lock and returns next waiting agent';
