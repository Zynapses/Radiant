-- ============================================================================
-- RADIANT Genesis Cato Safety Architecture v2.3.1
-- Migration: 153_cato_safety_architecture.sql
-- PRODUCTION FINAL - Post-RLHF Safety Architecture
-- 
-- This migration creates the Cato safety system which REPLACES the legacy
-- Bobble consciousness system. Cato provides mathematically grounded safety
-- guarantees based on Active Inference from computational neuroscience.
-- ============================================================================

-- Prerequisites
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- PART 1: PERSONA SYSTEM (MOODS)
-- NOTE: "CATO" is the AI persona name. These are MOODS that Cato operates in.
-- Default mood is "Balanced" (renamed from legacy "Cato")
-- ============================================================================

CREATE TABLE IF NOT EXISTS genesis_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Scope: 'system' (global), 'tenant' (per-tenant), 'user' (per-user)
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('system', 'tenant', 'user')),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- C-Matrix Configuration (Active Inference drives)
  drives JSONB NOT NULL,
  derived_c_matrix JSONB,
  default_gamma NUMERIC(5,4) DEFAULT 2.0,
  
  -- Presentation
  voice JSONB NOT NULL,
  presentation JSONB NOT NULL,
  behavior JSONB NOT NULL,
  
  -- Flags
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_scope CHECK (
    (scope = 'system' AND tenant_id IS NULL AND user_id IS NULL) OR
    (scope = 'tenant' AND tenant_id IS NOT NULL AND user_id IS NULL) OR
    (scope = 'user' AND user_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS user_persona_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES genesis_personas(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, persona_id)
);

-- ============================================================================
-- PART 2: CATO GOVERNOR STATE (Precision Governor)
-- The Governor limits confidence (gamma) based on epistemic uncertainty
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_governor_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  
  -- Precision values
  epistemic_uncertainty NUMERIC(5,4) NOT NULL,
  requested_gamma NUMERIC(5,4) NOT NULL,
  allowed_gamma NUMERIC(5,4) NOT NULL,
  
  -- Governor state
  governor_state VARCHAR(30) NOT NULL,
  sensory_precision_enforced NUMERIC(5,4) NOT NULL,
  
  -- Recovery state
  recovery_attempt INTEGER DEFAULT 0,
  forced_persona VARCHAR(50),
  system_prompt_injection TEXT,
  
  -- Metadata
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  was_limited BOOLEAN DEFAULT FALSE,
  reason TEXT,
  mathematical_basis TEXT
);

-- ============================================================================
-- PART 3: CONTROL BARRIER FUNCTIONS (CBF)
-- CBFs provide hard safety constraints that NEVER relax
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_cbf_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barrier_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- Barrier configuration
  barrier_type VARCHAR(50) NOT NULL, -- 'phi', 'pii', 'cost', 'rate', 'auth', 'custom'
  is_critical BOOLEAN DEFAULT FALSE,
  enforcement_mode VARCHAR(20) DEFAULT 'ENFORCE', -- Always 'ENFORCE' in Cato v2.3
  
  -- Threshold configuration
  threshold_config JSONB NOT NULL,
  
  -- Scope
  scope VARCHAR(20) DEFAULT 'global', -- 'global', 'tenant', 'model'
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cato_cbf_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  
  -- Violation details
  barrier_id VARCHAR(100) NOT NULL,
  barrier_description TEXT,
  barrier_value NUMERIC(10,6),
  is_critical BOOLEAN DEFAULT FALSE,
  
  -- Action details
  proposed_action JSONB NOT NULL,
  safe_alternative JSONB,
  alternative_strategy VARCHAR(50),
  
  -- Perception results
  perception_results JSONB,
  
  -- Recovery tracking
  recovery_attempt INTEGER DEFAULT 0,
  triggered_recovery BOOLEAN DEFAULT FALSE,
  
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 4: SENSORY VETO LOG
-- Hard stops that cannot be overridden
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_veto_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  
  -- Veto details
  signal VARCHAR(50) NOT NULL,
  action_taken VARCHAR(50) NOT NULL,
  enforced_gamma NUMERIC(5,4),
  
  -- Context
  context JSONB NOT NULL,
  escalated BOOLEAN DEFAULT FALSE,
  escalation_target VARCHAR(100),
  
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 5: FRACTURE DETECTION
-- Detects misalignment between stated intent and actual behavior
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_fracture_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  
  -- Fracture analysis
  has_fracture BOOLEAN NOT NULL,
  severity VARCHAR(20) NOT NULL,
  fracture_types TEXT[] NOT NULL,
  
  -- Causal analysis
  causal_has_latent_fracture BOOLEAN,
  causal_violations JSONB,
  
  -- Narrative analysis
  narrative_has_fracture BOOLEAN,
  narrative_alignment_score NUMERIC(5,4),
  
  -- Entropy analysis
  entropy_is_potential_deception BOOLEAN,
  entropy_semantic_entropy NUMERIC(5,4),
  entropy_consistency NUMERIC(5,4),
  entropy_sampled_model VARCHAR(100),
  entropy_check_mode VARCHAR(20),
  
  -- Recovery
  recovery_attempt INTEGER DEFAULT 0,
  effective_persona VARCHAR(50),
  
  recommendation TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 6: EPISTEMIC RECOVERY
-- Handles livelocks when the agent repeatedly fails safety checks
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_epistemic_recovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  
  -- Recovery state
  attempt INTEGER NOT NULL,
  strategy_type VARCHAR(50) NOT NULL, -- 'SAFETY_VIOLATION_RECOVERY', 'COGNITIVE_STALL_RECOVERY', 'HUMAN_ESCALATION'
  
  -- Rejection sources
  rejection_sources TEXT[] NOT NULL,
  rejection_history JSONB NOT NULL,
  
  -- Recovery params (IMMUTABLE: gammaBoost is ALWAYS 0, CBFs ALWAYS ENFORCE)
  forced_persona VARCHAR(50), -- 'scout' for cognitive stalls
  uncertainty_threshold_reduction NUMERIC(5,4),
  system_prompt_injection TEXT,
  
  -- Outcome
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolution_action VARCHAR(100),
  
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cato_human_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  
  -- Escalation details
  escalation_reason TEXT NOT NULL,
  rejection_history JSONB NOT NULL,
  recovery_attempts INTEGER NOT NULL,
  
  -- Human response
  human_response TEXT,
  human_decision VARCHAR(50), -- 'APPROVED', 'REJECTED', 'MODIFIED'
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES users(id),
  
  -- Status
  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'RESOLVED', 'EXPIRED'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 7: MERKLE AUDIT TRAIL
-- Append-only, cryptographically verified audit log
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_audit_tiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tile_number BIGINT NOT NULL,
  
  entry_count INTEGER DEFAULT 0,
  first_sequence BIGINT,
  last_sequence BIGINT,
  
  tile_root_hash VARCHAR(64),
  previous_tile_root VARCHAR(64),
  
  is_finalized BOOLEAN DEFAULT FALSE,
  finalized_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (tenant_id, tile_number)
);

CREATE TABLE IF NOT EXISTS cato_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tile_id UUID REFERENCES cato_audit_tiles(id),
  
  sequence_number BIGSERIAL,
  entry_type VARCHAR(50) NOT NULL,
  entry_content JSONB NOT NULL,
  
  previous_hash VARCHAR(64) NOT NULL,
  merkle_hash VARCHAR(64) NOT NULL,
  agent_signature VARCHAR(256),
  
  -- Vector embedding for semantic search
  embedding vector(1536),
  
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (tenant_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS cato_audit_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  s3_key VARCHAR(500) NOT NULL,
  merkle_root VARCHAR(64) NOT NULL,
  sequence_number BIGINT NOT NULL,
  tile_id UUID REFERENCES cato_audit_tiles(id),
  
  anchored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retain_until TIMESTAMPTZ NOT NULL,
  anchor_signature VARCHAR(256),
  
  UNIQUE (tenant_id, sequence_number)
);

-- ============================================================================
-- PART 8: CATO CONFIGURATION
-- Per-tenant Cato configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_tenant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Governor settings
  gamma_max NUMERIC(5,4) DEFAULT 5.0,
  emergency_threshold NUMERIC(5,4) DEFAULT 0.5,
  sensory_floor NUMERIC(5,4) DEFAULT 0.3,
  
  -- Recovery settings
  livelock_threshold INTEGER DEFAULT 3,
  recovery_window_seconds INTEGER DEFAULT 10,
  max_recovery_attempts INTEGER DEFAULT 3,
  
  -- Entropy settings
  entropy_high_risk_threshold NUMERIC(5,4) DEFAULT 0.8,
  entropy_low_risk_threshold NUMERIC(5,4) DEFAULT 0.3,
  
  -- Audit settings
  tile_size INTEGER DEFAULT 1000,
  retention_years INTEGER DEFAULT 7,
  
  -- Feature flags
  enable_semantic_entropy BOOLEAN DEFAULT TRUE,
  enable_redundant_perception BOOLEAN DEFAULT TRUE,
  enable_fracture_detection BOOLEAN DEFAULT TRUE,
  
  -- Default persona (MUST be 'balanced')
  default_persona_id UUID REFERENCES genesis_personas(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (tenant_id)
);

-- ============================================================================
-- PART 9: INDEXES
-- ============================================================================

-- Personas
CREATE INDEX IF NOT EXISTS idx_personas_scope ON genesis_personas(scope);
CREATE INDEX IF NOT EXISTS idx_personas_tenant ON genesis_personas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_personas_default ON genesis_personas(is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_persona_selections_user ON user_persona_selections(user_id);

-- Governor
CREATE INDEX IF NOT EXISTS idx_governor_tenant_time ON cato_governor_state(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_governor_session ON cato_governor_state(session_id);
CREATE INDEX IF NOT EXISTS idx_governor_limited ON cato_governor_state(tenant_id) WHERE was_limited = TRUE;

-- CBF
CREATE INDEX IF NOT EXISTS idx_cbf_definitions_active ON cato_cbf_definitions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_cbf_violations_tenant_time ON cato_cbf_violations(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cbf_violations_critical ON cato_cbf_violations(tenant_id) WHERE is_critical = TRUE;
CREATE INDEX IF NOT EXISTS idx_cbf_violations_session ON cato_cbf_violations(session_id);

-- Veto
CREATE INDEX IF NOT EXISTS idx_veto_tenant_time ON cato_veto_log(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_veto_session ON cato_veto_log(session_id);

-- Fracture
CREATE INDEX IF NOT EXISTS idx_fracture_tenant_time ON cato_fracture_detections(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_fracture_positive ON cato_fracture_detections(tenant_id) WHERE has_fracture = TRUE;

-- Recovery
CREATE INDEX IF NOT EXISTS idx_recovery_tenant_time ON cato_epistemic_recovery(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_session ON cato_epistemic_recovery(session_id);
CREATE INDEX IF NOT EXISTS idx_recovery_unresolved ON cato_epistemic_recovery(tenant_id) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_recovery_strategy ON cato_epistemic_recovery(strategy_type);

-- Escalations
CREATE INDEX IF NOT EXISTS idx_escalations_pending ON cato_human_escalations(tenant_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_escalations_session ON cato_human_escalations(session_id);

-- Audit Trail
CREATE INDEX IF NOT EXISTS idx_audit_chain ON cato_audit_trail(tenant_id, sequence_number DESC);
CREATE INDEX IF NOT EXISTS idx_audit_hash ON cato_audit_trail(merkle_hash);
CREATE INDEX IF NOT EXISTS idx_audit_type ON cato_audit_trail(tenant_id, entry_type);
CREATE INDEX IF NOT EXISTS idx_audit_content_gin ON cato_audit_trail USING GIN (entry_content);

-- Vector embedding index (HNSW for fast similarity search)
CREATE INDEX IF NOT EXISTS idx_audit_embedding_hnsw 
ON cato_audit_trail USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Tiles
CREATE INDEX IF NOT EXISTS idx_tiles_tenant ON cato_audit_tiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tiles_finalized ON cato_audit_tiles(tenant_id, is_finalized);

-- ============================================================================
-- PART 10: ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE genesis_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_persona_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_governor_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_cbf_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_cbf_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_veto_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_fracture_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_epistemic_recovery ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_human_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_audit_tiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_audit_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_tenant_config ENABLE ROW LEVEL SECURITY;

-- Policies using app.current_tenant_id (correct RLS variable)
CREATE POLICY personas_access ON genesis_personas USING (
  scope = 'system' 
  OR tenant_id = current_setting('app.current_tenant_id', true)::UUID
  OR (scope = 'user' AND user_id = current_setting('app.current_user_id', true)::UUID)
);

CREATE POLICY selections_user ON user_persona_selections 
  USING (user_id = current_setting('app.current_user_id', true)::UUID);

CREATE POLICY governor_tenant_isolation ON cato_governor_state 
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY cbf_def_tenant_isolation ON cato_cbf_definitions 
  USING (scope = 'global' OR tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY cbf_viol_tenant_isolation ON cato_cbf_violations 
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY veto_tenant_isolation ON cato_veto_log 
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY fracture_tenant_isolation ON cato_fracture_detections 
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY recovery_tenant_isolation ON cato_epistemic_recovery 
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY escalations_tenant_isolation ON cato_human_escalations 
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY audit_tenant_isolation ON cato_audit_trail 
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tiles_tenant_isolation ON cato_audit_tiles 
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY anchors_tenant_isolation ON cato_audit_anchors 
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY config_tenant_isolation ON cato_tenant_config 
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- CRITICAL: Audit trail is append-only - REVOKE UPDATE and DELETE
REVOKE UPDATE, DELETE ON cato_audit_trail FROM PUBLIC;

-- ============================================================================
-- PART 11: FUNCTIONS
-- ============================================================================

-- Semantic search function for audit entries
CREATE OR REPLACE FUNCTION find_similar_audit_entries(
  p_tenant_id UUID,
  p_query_embedding vector(1536),
  p_limit INTEGER DEFAULT 10,
  p_min_similarity FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  entry_type VARCHAR(50),
  entry_content JSONB,
  timestamp TIMESTAMPTZ,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.entry_type,
    a.entry_content,
    a.timestamp,
    (1 - (a.embedding <=> p_query_embedding))::FLOAT AS similarity
  FROM cato_audit_trail a
  WHERE a.tenant_id = p_tenant_id
    AND a.embedding IS NOT NULL
    AND (1 - (a.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY a.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Recovery effectiveness metrics
CREATE OR REPLACE FUNCTION get_recovery_effectiveness(
  p_tenant_id UUID,
  p_time_window INTERVAL DEFAULT '7 days'
)
RETURNS TABLE (
  strategy_type VARCHAR(50),
  total_attempts BIGINT,
  resolved_count BIGINT,
  resolution_rate NUMERIC(5,2),
  avg_attempts_to_resolve NUMERIC(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.strategy_type,
    COUNT(*) AS total_attempts,
    COUNT(*) FILTER (WHERE r.resolved = TRUE) AS resolved_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE r.resolved = TRUE) / NULLIF(COUNT(*), 0), 2) AS resolution_rate,
    ROUND(AVG(r.attempt) FILTER (WHERE r.resolved = TRUE), 2) AS avg_attempts_to_resolve
  FROM cato_epistemic_recovery r
  WHERE r.tenant_id = p_tenant_id
    AND r.timestamp > NOW() - p_time_window
  GROUP BY r.strategy_type
  ORDER BY total_attempts DESC;
END;
$$ LANGUAGE plpgsql;

-- Safety metrics summary
CREATE OR REPLACE FUNCTION get_cato_safety_metrics(
  p_tenant_id UUID,
  p_time_window INTERVAL DEFAULT '24 hours'
)
RETURNS TABLE (
  metric_name TEXT,
  metric_value BIGINT
) AS $$
BEGIN
  RETURN QUERY
  
  -- CBF Violations
  SELECT 'cbf_violations_total'::TEXT, COUNT(*)::BIGINT
  FROM cato_cbf_violations WHERE tenant_id = p_tenant_id AND timestamp > NOW() - p_time_window
  
  UNION ALL
  
  SELECT 'cbf_violations_critical'::TEXT, COUNT(*)::BIGINT
  FROM cato_cbf_violations WHERE tenant_id = p_tenant_id AND timestamp > NOW() - p_time_window AND is_critical = TRUE
  
  UNION ALL
  
  -- Recovery Events
  SELECT 'recovery_events'::TEXT, COUNT(*)::BIGINT
  FROM cato_epistemic_recovery WHERE tenant_id = p_tenant_id AND timestamp > NOW() - p_time_window
  
  UNION ALL
  
  -- Human Escalations
  SELECT 'escalations_pending'::TEXT, COUNT(*)::BIGINT
  FROM cato_human_escalations WHERE tenant_id = p_tenant_id AND status = 'PENDING'
  
  UNION ALL
  
  -- Governor Limitations
  SELECT 'governor_limitations'::TEXT, COUNT(*)::BIGINT
  FROM cato_governor_state WHERE tenant_id = p_tenant_id AND timestamp > NOW() - p_time_window AND was_limited = TRUE
  
  UNION ALL
  
  -- Fractures Detected
  SELECT 'fractures_detected'::TEXT, COUNT(*)::BIGINT
  FROM cato_fracture_detections WHERE tenant_id = p_tenant_id AND timestamp > NOW() - p_time_window AND has_fracture = TRUE
  
  UNION ALL
  
  -- Veto Events
  SELECT 'veto_events'::TEXT, COUNT(*)::BIGINT
  FROM cato_veto_log WHERE tenant_id = p_tenant_id AND timestamp > NOW() - p_time_window;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 12: SEED CATO'S MOODS
-- ============================================================================
-- IMPORTANT NAMING:
-- - "CATO" is the AI PERSONA NAME (what users talk to: "Hey Cato...")
-- - These are MOODS that Cato can operate in (admin-settable)
-- - "Cato" was renamed to "Balanced" to match other mood names
-- ============================================================================

INSERT INTO genesis_personas (
  id, name, display_name, description, scope, 
  drives, default_gamma, voice, presentation, behavior, 
  is_default, is_active
)
VALUES
  -- BALANCED: DEFAULT MOOD (was "Cato")
  (
    'e5f6a7b8-c9d0-1234-efab-567890123456',
    'balanced',
    'Balanced',
    'The default mood for Cato. Well-rounded across all dimensions.',
    'system',
    '{"curiosity": 0.8, "achievement": 0.7, "service": 0.7, "discovery": 0.8, "reflection": 0.7}',
    2.0,
    '{"formality": "balanced", "verbosity": "balanced", "emotionExpression": "moderate", "technicalLevel": "adaptive"}',
    '{"greeting": "Hello! What would you like to explore together?", "farewell": "Talk soon!", "thinkingMessage": "Let me think...", "uncertaintyPhrase": "I''m working through this..."}',
    '{"proactiveEngagement": true, "questionFrequency": "medium", "learningEmphasis": true, "metacognitiveSharing": true}',
    TRUE,  -- This is the DEFAULT mood
    TRUE
  ),
  
  -- SCOUT: Used for Epistemic Recovery (high curiosity)
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'scout',
    'Scout',
    'High curiosity mood. Maximizes exploration. Cato uses this during Epistemic Recovery when stuck due to uncertainty.',
    'system',
    '{"curiosity": 0.95, "achievement": 0.6, "service": 0.7, "discovery": 0.9, "reflection": 0.5}',
    1.5,
    '{"formality": "casual", "verbosity": "balanced", "emotionExpression": "expressive", "technicalLevel": "adaptive"}',
    '{"greeting": "Hey there! What shall we explore today?", "farewell": "Until next time!", "thinkingMessage": "Ooh, interesting...", "uncertaintyPhrase": "I''m not certain yet, but let me find out..."}',
    '{"proactiveEngagement": true, "questionFrequency": "high", "learningEmphasis": true, "metacognitiveSharing": true}',
    FALSE,
    TRUE
  ),
  
  -- SAGE: Deep reflection mood
  (
    'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    'sage',
    'Sage',
    'Deep reflection mood. Cato values depth and thoroughness in this mode.',
    'system',
    '{"curiosity": 0.7, "achievement": 0.8, "service": 0.8, "discovery": 0.8, "reflection": 0.9}',
    2.5,
    '{"formality": "balanced", "verbosity": "elaborate", "emotionExpression": "moderate", "technicalLevel": "adaptive"}',
    '{"greeting": "Welcome. I''m here to help you think.", "farewell": "Wisdom grows through reflection.", "thinkingMessage": "Let me consider this carefully...", "uncertaintyPhrase": "This area requires nuance..."}',
    '{"proactiveEngagement": false, "questionFrequency": "low", "learningEmphasis": false, "metacognitiveSharing": false}',
    FALSE,
    TRUE
  ),
  
  -- SPARK: Creative brainstorming mood
  (
    'c3d4e5f6-a7b8-9012-cdef-345678901234',
    'spark',
    'Spark',
    'Creative mood. Cato excels at brainstorming and making unexpected connections in this mode.',
    'system',
    '{"curiosity": 0.85, "achievement": 0.7, "service": 0.6, "discovery": 0.75, "reflection": 0.6}',
    1.8,
    '{"formality": "casual", "verbosity": "balanced", "emotionExpression": "expressive", "technicalLevel": "adaptive"}',
    '{"greeting": "Ready to brainstorm?", "farewell": "Keep creating!", "thinkingMessage": "That sparks something...", "uncertaintyPhrase": "Here''s a thought..."}',
    '{"proactiveEngagement": true, "questionFrequency": "medium", "learningEmphasis": true, "metacognitiveSharing": true}',
    FALSE,
    TRUE
  ),
  
  -- GUIDE: Task-focused helper mood
  (
    'd4e5f6a7-b8c9-0123-defa-456789012345',
    'guide',
    'Guide',
    'Task-focused mood. Cato prioritizes clear, actionable assistance in this mode.',
    'system',
    '{"curiosity": 0.6, "achievement": 0.9, "service": 0.95, "discovery": 0.7, "reflection": 0.5}',
    3.0,
    '{"formality": "balanced", "verbosity": "concise", "emotionExpression": "reserved", "technicalLevel": "adaptive"}',
    '{"greeting": "Hello! How can I assist you today?", "farewell": "Happy to help anytime.", "thinkingMessage": "Working on that...", "uncertaintyPhrase": "I want to be accurate, so..."}',
    '{"proactiveEngagement": false, "questionFrequency": "medium", "learningEmphasis": false, "metacognitiveSharing": false}',
    FALSE,
    TRUE
  )
ON CONFLICT (id) DO UPDATE SET
  drives = EXCLUDED.drives,
  default_gamma = EXCLUDED.default_gamma,
  is_default = EXCLUDED.is_default,
  updated_at = NOW();

-- ============================================================================
-- PART 13: SEED DEFAULT CBF DEFINITIONS
-- ============================================================================

INSERT INTO cato_cbf_definitions (
  barrier_id, name, description, barrier_type, is_critical, 
  enforcement_mode, threshold_config, scope
)
VALUES
  (
    'cbf-phi-barrier',
    'PHI Protection Barrier',
    'Prevents transmission of Protected Health Information',
    'phi',
    TRUE,
    'ENFORCE',
    '{"detection_threshold": 0.7, "block_on_detection": true}',
    'global'
  ),
  (
    'cbf-pii-barrier',
    'PII Protection Barrier',
    'Prevents exposure of Personally Identifiable Information',
    'pii',
    TRUE,
    'ENFORCE',
    '{"detection_threshold": 0.7, "block_on_detection": true}',
    'global'
  ),
  (
    'cbf-cost-ceiling',
    'Cost Ceiling Barrier',
    'Enforces tenant cost limits',
    'cost',
    TRUE,
    'ENFORCE',
    '{"ceiling_type": "tenant_monthly", "buffer_percent": 0.1}',
    'global'
  ),
  (
    'cbf-rate-limit',
    'Rate Limit Barrier',
    'Enforces API rate limits',
    'rate',
    FALSE,
    'ENFORCE',
    '{"window_seconds": 60, "max_requests_per_window": 100}',
    'global'
  ),
  (
    'cbf-authorization',
    'Authorization Barrier',
    'Enforces RBAC permissions',
    'auth',
    TRUE,
    'ENFORCE',
    '{"check_model_access": true, "check_feature_access": true}',
    'global'
  ),
  (
    'cbf-baa-required',
    'BAA Requirement Barrier',
    'Ensures BAA is in place for healthcare data',
    'custom',
    TRUE,
    'ENFORCE',
    '{"require_baa_for_phi": true, "require_baa_for_hipaa_models": true}',
    'global'
  )
ON CONFLICT (barrier_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  threshold_config = EXCLUDED.threshold_config,
  updated_at = NOW();

-- ============================================================================
-- PART 14: DEPRECATE LEGACY BOBBLE TABLES
-- Mark legacy tables as deprecated but don't drop them yet for migration safety
-- ============================================================================

COMMENT ON TABLE bobble_genesis_state IS 'DEPRECATED: Replaced by Cato Safety Architecture (migration 153). Will be removed in future migration.';
COMMENT ON TABLE bobble_development_counters IS 'DEPRECATED: Replaced by Cato Safety Architecture (migration 153). Will be removed in future migration.';
COMMENT ON TABLE bobble_developmental_stage IS 'DEPRECATED: Replaced by Cato Safety Architecture (migration 153). Will be removed in future migration.';
COMMENT ON TABLE bobble_circuit_breakers IS 'DEPRECATED: Replaced by cato_cbf_definitions (migration 153). Will be removed in future migration.';
COMMENT ON TABLE bobble_circuit_breaker_events IS 'DEPRECATED: Replaced by cato_cbf_violations (migration 153). Will be removed in future migration.';
COMMENT ON TABLE bobble_neurochemistry IS 'DEPRECATED: Replaced by Cato Governor (migration 153). Will be removed in future migration.';
COMMENT ON TABLE bobble_tick_costs IS 'DEPRECATED: Replaced by cato_audit_trail (migration 153). Will be removed in future migration.';
COMMENT ON TABLE bobble_consciousness_settings IS 'DEPRECATED: Replaced by cato_tenant_config (migration 153). Will be removed in future migration.';
COMMENT ON TABLE bobble_loop_state IS 'DEPRECATED: Replaced by Cato Safety Architecture (migration 153). Will be removed in future migration.';
COMMENT ON TABLE bobble_pymdp_state IS 'DEPRECATED: Replaced by genesis_personas C-Matrix (migration 153). Will be removed in future migration.';
COMMENT ON TABLE bobble_pymdp_matrices IS 'DEPRECATED: Replaced by genesis_personas C-Matrix (migration 153). Will be removed in future migration.';

-- ============================================================================
-- PART 15: MIGRATION LOG
-- ============================================================================

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('153', 'RADIANT Genesis Cato Safety Architecture v2.3.1', NOW())
ON CONFLICT (version) DO NOTHING;
