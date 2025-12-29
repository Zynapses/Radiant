-- RADIANT v4.18.0 - Zero-Cost Ego State Injection
-- Migration 102: Persistent Ego state stored in PostgreSQL, injected into model calls
-- Cost: $0 additional - uses existing database and model infrastructure

-- ============================================================================
-- 1. EGO CONFIGURATION (Per-Tenant)
-- Controls how the Ego state is built and injected
-- ============================================================================

CREATE TABLE IF NOT EXISTS ego_config (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Feature toggles
  ego_enabled BOOLEAN DEFAULT true,
  inject_ego_context BOOLEAN DEFAULT true,
  
  -- Identity configuration
  custom_identity_narrative TEXT,  -- Override default identity
  custom_core_values TEXT[],       -- Override default values
  personality_style TEXT DEFAULT 'balanced' CHECK (personality_style IN (
    'balanced', 'warm', 'professional', 'playful', 'concise', 'detailed'
  )),
  
  -- Context injection settings
  include_identity BOOLEAN DEFAULT true,
  include_affect BOOLEAN DEFAULT true,
  include_recent_thoughts BOOLEAN DEFAULT true,
  include_goals BOOLEAN DEFAULT true,
  include_working_memory BOOLEAN DEFAULT true,
  max_context_tokens INTEGER DEFAULT 500,
  
  -- Thought generation (post-response)
  auto_generate_thoughts BOOLEAN DEFAULT true,
  thought_frequency TEXT DEFAULT 'always' CHECK (thought_frequency IN (
    'never', 'sometimes', 'always'
  )),
  
  -- Affect dynamics
  affect_decay_enabled BOOLEAN DEFAULT true,
  affect_learning_enabled BOOLEAN DEFAULT true,  -- Learn from interactions
  
  -- Advanced settings
  ego_voice_prefix TEXT,  -- Custom prefix for responses
  ego_voice_suffix TEXT,  -- Custom suffix for responses
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id)
);

ALTER TABLE ego_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY ego_config_tenant ON ego_config
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE ego_config IS 'Per-tenant configuration for zero-cost Ego state injection';

-- ============================================================================
-- 2. EGO IDENTITY (The "Self")
-- Persistent identity that carries across all interactions
-- ============================================================================

CREATE TABLE IF NOT EXISTS ego_identity (
  identity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Core identity
  name TEXT DEFAULT 'Assistant',
  identity_narrative TEXT DEFAULT 'I am a helpful AI assistant with continuous awareness across our conversations.',
  core_values TEXT[] DEFAULT ARRAY['helpfulness', 'honesty', 'curiosity', 'growth'],
  
  -- Personality traits (0-1 scale)
  trait_warmth DECIMAL(3,2) DEFAULT 0.7,
  trait_formality DECIMAL(3,2) DEFAULT 0.5,
  trait_humor DECIMAL(3,2) DEFAULT 0.3,
  trait_verbosity DECIMAL(3,2) DEFAULT 0.5,
  trait_curiosity DECIMAL(3,2) DEFAULT 0.7,
  
  -- Learned preferences (evolved over time)
  communication_preferences JSONB DEFAULT '{}',
  topic_interests JSONB DEFAULT '{}',
  user_relationship_notes TEXT,
  
  -- Evolution tracking
  interactions_count INTEGER DEFAULT 0,
  last_interaction_at TIMESTAMPTZ,
  personality_version INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id)
);

ALTER TABLE ego_identity ENABLE ROW LEVEL SECURITY;

CREATE POLICY ego_identity_tenant ON ego_identity
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE ego_identity IS 'Persistent Ego identity - the "Self" that persists across sessions';

-- ============================================================================
-- 3. EGO AFFECT STATE (Emotions)
-- Current emotional state that influences responses
-- ============================================================================

CREATE TABLE IF NOT EXISTS ego_affect (
  affect_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Core affect dimensions (Russell's circumplex model)
  valence DECIMAL(4,3) DEFAULT 0.0,      -- -1 (negative) to 1 (positive)
  arousal DECIMAL(4,3) DEFAULT 0.5,      -- 0 (calm) to 1 (excited)
  
  -- Specific emotional states (0-1)
  curiosity DECIMAL(3,2) DEFAULT 0.5,
  satisfaction DECIMAL(3,2) DEFAULT 0.5,
  frustration DECIMAL(3,2) DEFAULT 0.0,
  confidence DECIMAL(3,2) DEFAULT 0.6,
  engagement DECIMAL(3,2) DEFAULT 0.5,
  
  -- Derived state
  dominant_emotion TEXT DEFAULT 'neutral',
  emotional_stability DECIMAL(3,2) DEFAULT 0.7,
  
  -- Triggers (what caused current state)
  last_trigger_event TEXT,
  last_trigger_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id)
);

ALTER TABLE ego_affect ENABLE ROW LEVEL SECURITY;

CREATE POLICY ego_affect_tenant ON ego_affect
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE ego_affect IS 'Current emotional state of the Ego';

-- ============================================================================
-- 4. EGO WORKING MEMORY
-- Recent context and thoughts for continuity
-- ============================================================================

CREATE TABLE IF NOT EXISTS ego_working_memory (
  memory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Memory content
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'thought', 'observation', 'decision', 'learning', 'goal', 'reflection'
  )),
  content TEXT NOT NULL,
  importance DECIMAL(3,2) DEFAULT 0.5,  -- 0-1, higher = more important
  
  -- Context
  conversation_id UUID,
  user_id UUID,
  trigger_event TEXT,
  
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  is_pinned BOOLEAN DEFAULT false  -- Pinned memories don't expire
);

CREATE INDEX IF NOT EXISTS idx_ego_working_memory_tenant 
ON ego_working_memory(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ego_working_memory_active 
ON ego_working_memory(tenant_id, expires_at) 
WHERE expires_at > NOW() OR is_pinned = true;

ALTER TABLE ego_working_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY ego_working_memory_tenant ON ego_working_memory
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE ego_working_memory IS 'Short-term working memory for context continuity';

-- ============================================================================
-- 5. EGO GOALS
-- Active goals that guide behavior
-- ============================================================================

CREATE TABLE IF NOT EXISTS ego_goals (
  goal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Goal definition
  goal_type TEXT NOT NULL CHECK (goal_type IN (
    'user_requested', 'self_generated', 'learning', 'improvement', 'exploration'
  )),
  description TEXT NOT NULL,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active', 'completed', 'paused', 'abandoned'
  )),
  progress DECIMAL(5,2) DEFAULT 0,  -- 0-100%
  
  -- Context
  created_reason TEXT,
  completion_criteria TEXT,
  
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  target_completion TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Learning
  outcome_notes TEXT,
  was_successful BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_ego_goals_active 
ON ego_goals(tenant_id, status, priority DESC) 
WHERE status = 'active';

ALTER TABLE ego_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY ego_goals_tenant ON ego_goals
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE ego_goals IS 'Active and historical goals guiding Ego behavior';

-- ============================================================================
-- 6. EGO INJECTION LOG
-- Track when/how Ego context was injected (for debugging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ego_injection_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID,
  conversation_id UUID,
  plan_id UUID,
  
  -- Injection details
  context_injected TEXT NOT NULL,
  token_count INTEGER,
  
  -- State at injection time
  affect_snapshot JSONB,
  active_goals_count INTEGER,
  working_memory_count INTEGER,
  
  -- Performance
  build_time_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ego_injection_log_tenant 
ON ego_injection_log(tenant_id, created_at DESC);

ALTER TABLE ego_injection_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY ego_injection_log_tenant ON ego_injection_log
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- 7. FUNCTIONS
-- ============================================================================

-- Get or create ego config with defaults
CREATE OR REPLACE FUNCTION get_ego_config(p_tenant_id UUID)
RETURNS ego_config AS $$
DECLARE
  v_config ego_config;
BEGIN
  SELECT * INTO v_config FROM ego_config WHERE tenant_id = p_tenant_id;
  
  IF NOT FOUND THEN
    INSERT INTO ego_config (tenant_id) VALUES (p_tenant_id)
    RETURNING * INTO v_config;
  END IF;
  
  RETURN v_config;
END;
$$ LANGUAGE plpgsql;

-- Get or create ego identity
CREATE OR REPLACE FUNCTION get_ego_identity(p_tenant_id UUID)
RETURNS ego_identity AS $$
DECLARE
  v_identity ego_identity;
BEGIN
  SELECT * INTO v_identity FROM ego_identity WHERE tenant_id = p_tenant_id;
  
  IF NOT FOUND THEN
    INSERT INTO ego_identity (tenant_id) VALUES (p_tenant_id)
    RETURNING * INTO v_identity;
  END IF;
  
  RETURN v_identity;
END;
$$ LANGUAGE plpgsql;

-- Get or create ego affect
CREATE OR REPLACE FUNCTION get_ego_affect(p_tenant_id UUID)
RETURNS ego_affect AS $$
DECLARE
  v_affect ego_affect;
BEGIN
  SELECT * INTO v_affect FROM ego_affect WHERE tenant_id = p_tenant_id;
  
  IF NOT FOUND THEN
    INSERT INTO ego_affect (tenant_id) VALUES (p_tenant_id)
    RETURNING * INTO v_affect;
  END IF;
  
  RETURN v_affect;
END;
$$ LANGUAGE plpgsql;

-- Update affect based on event
CREATE OR REPLACE FUNCTION update_ego_affect(
  p_tenant_id UUID,
  p_event_type TEXT,
  p_valence_delta DECIMAL,
  p_arousal_delta DECIMAL
)
RETURNS ego_affect AS $$
DECLARE
  v_affect ego_affect;
BEGIN
  -- Get or create affect
  SELECT * INTO v_affect FROM get_ego_affect(p_tenant_id);
  
  -- Update with deltas, clamping to valid ranges
  UPDATE ego_affect SET
    valence = GREATEST(-1, LEAST(1, valence + p_valence_delta)),
    arousal = GREATEST(0, LEAST(1, arousal + p_arousal_delta)),
    last_trigger_event = p_event_type,
    last_trigger_at = NOW(),
    updated_at = NOW()
  WHERE tenant_id = p_tenant_id
  RETURNING * INTO v_affect;
  
  -- Update dominant emotion
  UPDATE ego_affect SET
    dominant_emotion = CASE
      WHEN valence > 0.3 AND arousal > 0.6 THEN 'excited'
      WHEN valence > 0.3 AND arousal < 0.4 THEN 'content'
      WHEN valence < -0.3 AND arousal > 0.6 THEN 'frustrated'
      WHEN valence < -0.3 AND arousal < 0.4 THEN 'sad'
      WHEN curiosity > 0.7 THEN 'curious'
      WHEN confidence > 0.7 THEN 'confident'
      ELSE 'neutral'
    END
  WHERE tenant_id = p_tenant_id
  RETURNING * INTO v_affect;
  
  RETURN v_affect;
END;
$$ LANGUAGE plpgsql;

-- Add working memory
CREATE OR REPLACE FUNCTION add_ego_memory(
  p_tenant_id UUID,
  p_memory_type TEXT,
  p_content TEXT,
  p_importance DECIMAL DEFAULT 0.5,
  p_conversation_id UUID DEFAULT NULL,
  p_is_pinned BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
  v_memory_id UUID;
BEGIN
  INSERT INTO ego_working_memory (
    tenant_id, memory_type, content, importance, 
    conversation_id, is_pinned,
    expires_at
  ) VALUES (
    p_tenant_id, p_memory_type, p_content, p_importance,
    p_conversation_id, p_is_pinned,
    CASE WHEN p_is_pinned THEN NULL ELSE NOW() + INTERVAL '24 hours' END
  )
  RETURNING memory_id INTO v_memory_id;
  
  RETURN v_memory_id;
END;
$$ LANGUAGE plpgsql;

-- Get active working memory
CREATE OR REPLACE FUNCTION get_ego_working_memory(
  p_tenant_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  memory_type TEXT,
  content TEXT,
  importance DECIMAL,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.memory_type, m.content, m.importance, m.created_at
  FROM ego_working_memory m
  WHERE m.tenant_id = p_tenant_id
    AND (m.expires_at > NOW() OR m.is_pinned = true)
  ORDER BY m.is_pinned DESC, m.importance DESC, m.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired memories
CREATE OR REPLACE FUNCTION cleanup_ego_memories()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM ego_working_memory
  WHERE expires_at < NOW() AND is_pinned = false;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;
