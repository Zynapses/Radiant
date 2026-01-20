-- ============================================================================
-- RADIANT v5.33.0 - HITL ORCHESTRATION ENHANCEMENTS (PROMPT-37)
-- Migration: V2026_01_20_011
-- 
-- Implements advanced HITL orchestration based on research:
-- - MCP Elicitation schema support
-- - SAGE-Agent Bayesian Value-of-Information
-- - Question batching and deduplication
-- - Abstention detection for AI responses
-- - Rate limiting at global/user/workflow levels
-- ============================================================================

-- ============================================================================
-- NEW TYPES
-- ============================================================================

CREATE TYPE hitl_question_type AS ENUM (
  'yes_no', 'single_choice', 'multiple_choice', 
  'free_text', 'numeric', 'date', 'confirmation',
  'structured' -- For complex JSON Schema responses
);

CREATE TYPE hitl_urgency AS ENUM (
  'blocking',   -- Workflow cannot proceed without answer
  'high',       -- Important, surface immediately
  'normal',     -- Standard priority
  'low',        -- Can be batched
  'optional'    -- Can be skipped with default
);

CREATE TYPE hitl_batch_status AS ENUM (
  'collecting',  -- Still aggregating questions
  'ready',       -- Ready to present to user
  'presented',   -- Shown to user
  'completed',   -- All questions answered
  'expired'      -- Timed out
);

CREATE TYPE abstention_reason AS ENUM (
  'low_confidence',      -- Model confidence below threshold
  'high_semantic_entropy', -- Multiple valid interpretations
  'self_consistency_fail', -- Sampled outputs disagree
  'missing_information',  -- Required context unavailable
  'out_of_scope',         -- Beyond model capabilities
  'false_premise',        -- Question contains incorrect assumptions
  'phi_detected'          -- PHI/PII detected, must escalate
);

-- ============================================================================
-- HITL QUESTION SCHEMA (MCP Elicitation Compatible)
-- ============================================================================

ALTER TABLE hitl_approval_requests ADD COLUMN IF NOT EXISTS question_type hitl_question_type;
ALTER TABLE hitl_approval_requests ADD COLUMN IF NOT EXISTS urgency hitl_urgency DEFAULT 'normal';
ALTER TABLE hitl_approval_requests ADD COLUMN IF NOT EXISTS options JSONB; -- Array of {value, label, description}
ALTER TABLE hitl_approval_requests ADD COLUMN IF NOT EXISTS response_schema JSONB; -- JSON Schema for structured responses
ALTER TABLE hitl_approval_requests ADD COLUMN IF NOT EXISTS default_action VARCHAR(100); -- Action on timeout
ALTER TABLE hitl_approval_requests ADD COLUMN IF NOT EXISTS default_value JSONB; -- Value to use on timeout
ALTER TABLE hitl_approval_requests ADD COLUMN IF NOT EXISTS context_data JSONB; -- Previous responses, related artifacts
ALTER TABLE hitl_approval_requests ADD COLUMN IF NOT EXISTS batch_id UUID; -- For grouped questions
ALTER TABLE hitl_approval_requests ADD COLUMN IF NOT EXISTS voi_score DOUBLE PRECISION; -- Value of Information score

-- ============================================================================
-- QUESTION BATCHING
-- ============================================================================

CREATE TABLE IF NOT EXISTS hitl_question_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id), -- Target user
  
  -- Batch configuration
  batch_type VARCHAR(50) NOT NULL, -- 'time_window', 'correlation', 'semantic'
  correlation_key VARCHAR(255), -- workflow_id, entity_id, etc.
  
  -- Status
  status hitl_batch_status NOT NULL DEFAULT 'collecting',
  
  -- Timing
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_end TIMESTAMPTZ, -- NULL = still collecting
  collection_window_seconds INTEGER NOT NULL DEFAULT 30,
  
  -- Counts
  question_count INTEGER DEFAULT 0,
  answered_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  
  -- Presentation
  presented_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- RATE LIMITING CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS hitl_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Scope
  scope VARCHAR(50) NOT NULL, -- 'global', 'per_user', 'per_workflow'
  scope_key VARCHAR(255), -- user_id or workflow_id (NULL for global)
  
  -- Limits
  max_requests_per_minute INTEGER NOT NULL DEFAULT 50,
  max_concurrent_requests INTEGER NOT NULL DEFAULT 10,
  burst_allowance INTEGER DEFAULT 5,
  
  -- Current state
  current_window_start TIMESTAMPTZ DEFAULT NOW(),
  current_window_count INTEGER DEFAULT 0,
  current_concurrent INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_rate_limit_scope UNIQUE (tenant_id, scope, scope_key)
);

-- Default global rate limits
INSERT INTO hitl_rate_limits (tenant_id, scope, max_requests_per_minute, max_concurrent_requests)
SELECT id, 'global', 50, 10 FROM tenants
ON CONFLICT (tenant_id, scope, scope_key) DO NOTHING;

-- ============================================================================
-- QUESTION DEDUPLICATION CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS hitl_question_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Question fingerprint
  question_hash VARCHAR(64) NOT NULL, -- SHA-256 of normalized question
  question_text TEXT NOT NULL,
  context_hash VARCHAR(64), -- Hash of relevant context
  
  -- Cached answer
  cached_response JSONB,
  cached_by UUID REFERENCES users(id),
  
  -- TTL management
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  
  -- Validity
  is_valid BOOLEAN NOT NULL DEFAULT true,
  invalidated_at TIMESTAMPTZ,
  invalidation_reason TEXT,
  
  CONSTRAINT unique_question_hash UNIQUE (tenant_id, question_hash, context_hash)
);

-- ============================================================================
-- BAYESIAN VALUE-OF-INFORMATION (SAGE-Agent)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hitl_voi_aspects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Aspect identification
  workflow_type VARCHAR(100),
  aspect_name VARCHAR(200) NOT NULL, -- e.g., 'user_preference_color', 'budget_constraint'
  aspect_category VARCHAR(100), -- 'preference', 'constraint', 'requirement', 'context'
  
  -- Prior belief (what we know before asking)
  prior_belief JSONB NOT NULL DEFAULT '{}', -- Distribution or known values
  
  -- Impact weights
  decision_impact_weight DOUBLE PRECISION DEFAULT 0.5, -- How much this affects decisions
  error_cost_weight DOUBLE PRECISION DEFAULT 0.5, -- Cost of getting it wrong
  
  -- Learning from history
  ask_count INTEGER DEFAULT 0,
  useful_answer_count INTEGER DEFAULT 0,
  avg_information_gain DOUBLE PRECISION DEFAULT 0.5,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_aspect UNIQUE (tenant_id, workflow_type, aspect_name)
);

CREATE TABLE IF NOT EXISTS hitl_voi_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES hitl_approval_requests(id) ON DELETE CASCADE,
  
  -- Decision context
  aspect_id UUID REFERENCES hitl_voi_aspects(id),
  
  -- VOI calculation components
  prior_entropy DOUBLE PRECISION, -- Uncertainty before asking
  expected_posterior_entropy DOUBLE PRECISION, -- Expected uncertainty after
  expected_information_gain DOUBLE PRECISION, -- prior - posterior
  ask_cost DOUBLE PRECISION, -- Cost of asking (user time, delay)
  expected_decision_improvement DOUBLE PRECISION, -- How much better decision will be
  
  -- Final VOI score
  voi_score DOUBLE PRECISION NOT NULL,
  ask_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.3,
  decision VARCHAR(20) NOT NULL, -- 'ask', 'skip_with_default', 'infer'
  
  -- Outcome (filled after resolution)
  actual_answer JSONB,
  answer_matched_prior BOOLEAN,
  actual_information_gain DOUBLE PRECISION,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ABSTENTION DETECTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS hitl_abstention_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Thresholds
  confidence_threshold DOUBLE PRECISION DEFAULT 0.7, -- Below this = escalate
  semantic_entropy_threshold DOUBLE PRECISION DEFAULT 0.8, -- Above this = uncertain
  self_consistency_samples INTEGER DEFAULT 5, -- Number of samples for consistency check
  self_consistency_threshold DOUBLE PRECISION DEFAULT 0.7, -- Agreement needed
  
  -- Detection methods enabled
  enable_confidence_prompting BOOLEAN DEFAULT true,
  enable_self_consistency BOOLEAN DEFAULT true,
  enable_semantic_entropy BOOLEAN DEFAULT true,
  enable_refusal_detection BOOLEAN DEFAULT true,
  
  -- Linear probe placeholder for self-hosted models
  -- FUTURE: Enable when self-hosted model inference supports hidden state extraction
  enable_linear_probe BOOLEAN DEFAULT false,
  linear_probe_model_id UUID, -- Reference to self-hosted model config
  linear_probe_layer INTEGER, -- Which hidden layer to probe
  linear_probe_weights BYTEA, -- Serialized probe weights
  
  -- Actions
  on_abstention_action VARCHAR(50) DEFAULT 'escalate', -- 'escalate', 'ask_user', 'use_default'
  escalation_queue_id UUID REFERENCES hitl_queue_configs(id),
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_abstention_config UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS hitl_abstention_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Source
  request_id UUID REFERENCES hitl_approval_requests(id),
  model_id VARCHAR(100) NOT NULL,
  model_provider VARCHAR(50) NOT NULL, -- 'openai', 'anthropic', 'self_hosted', etc.
  
  -- Detection results
  detection_method VARCHAR(50) NOT NULL, -- 'confidence', 'self_consistency', 'semantic_entropy', 'linear_probe'
  reason abstention_reason NOT NULL,
  
  -- Metrics
  confidence_score DOUBLE PRECISION,
  semantic_entropy_score DOUBLE PRECISION,
  self_consistency_agreement DOUBLE PRECISION,
  linear_probe_score DOUBLE PRECISION,
  
  -- Samples (for self-consistency)
  samples JSONB, -- Array of sampled responses
  
  -- Context
  prompt_hash VARCHAR(64),
  input_tokens INTEGER,
  
  -- Action taken
  action_taken VARCHAR(50) NOT NULL,
  escalated_to UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ESCALATION CHAINS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hitl_escalation_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  name VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- Chain definition
  levels JSONB NOT NULL DEFAULT '[]', -- Array of {level, assignees, timeout_minutes, notification_config}
  
  -- Behavior
  final_action VARCHAR(50) DEFAULT 'reject', -- Action when all levels exhausted
  final_action_params JSONB,
  
  -- Applicability rules
  applies_to_queues UUID[], -- NULL = all queues
  applies_to_request_types VARCHAR(50)[],
  priority_filter hitl_priority[],
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_chain_name UNIQUE (tenant_id, name)
);

-- ============================================================================
-- AI INFERENCE WRAPPER ABSTENTION HOOKS
-- (For future linear probe integration on self-hosted models)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_model_abstention_probes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Model reference
  model_config_id UUID NOT NULL, -- Reference to self-hosted model config
  model_name VARCHAR(200) NOT NULL,
  
  -- Probe configuration
  probe_layer INTEGER NOT NULL, -- Which transformer layer to probe
  probe_type VARCHAR(50) NOT NULL, -- 'linear', 'attention_head', 'residual_stream'
  
  -- Trained weights (serialized numpy/torch)
  weights_format VARCHAR(20) DEFAULT 'numpy', -- 'numpy', 'safetensors'
  weights_blob BYTEA,
  weights_s3_key VARCHAR(500), -- Alternative: S3 storage
  
  -- Training metadata
  trained_on_dataset VARCHAR(200),
  training_accuracy DOUBLE PRECISION,
  validation_accuracy DOUBLE PRECISION,
  training_date TIMESTAMPTZ,
  
  -- Threshold calibration
  abstain_threshold DOUBLE PRECISION DEFAULT 0.5,
  calibration_data JSONB, -- ECE, reliability diagram data
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_model_probe UNIQUE (tenant_id, model_config_id, probe_layer)
);

COMMENT ON TABLE ai_model_abstention_probes IS 
  'Linear probe weights for abstention detection on self-hosted models. ' ||
  'These probes are trained on hidden layer activations to detect when a model is uncertain. ' ||
  'FUTURE: Requires model inference wrapper to extract hidden states during inference.';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_hitl_batches_tenant ON hitl_question_batches(tenant_id);
CREATE INDEX idx_hitl_batches_status ON hitl_question_batches(status) WHERE status IN ('collecting', 'ready');
CREATE INDEX idx_hitl_batches_user ON hitl_question_batches(user_id);
CREATE INDEX idx_hitl_batches_correlation ON hitl_question_batches(correlation_key) WHERE correlation_key IS NOT NULL;

CREATE INDEX idx_hitl_rate_limits_scope ON hitl_rate_limits(tenant_id, scope, scope_key);
CREATE INDEX idx_hitl_rate_limits_active ON hitl_rate_limits(is_active) WHERE is_active;

CREATE INDEX idx_hitl_cache_hash ON hitl_question_cache(tenant_id, question_hash);
CREATE INDEX idx_hitl_cache_expires ON hitl_question_cache(expires_at) WHERE is_valid;

CREATE INDEX idx_hitl_voi_aspects_tenant ON hitl_voi_aspects(tenant_id);
CREATE INDEX idx_hitl_voi_aspects_workflow ON hitl_voi_aspects(tenant_id, workflow_type);

CREATE INDEX idx_hitl_voi_decisions_request ON hitl_voi_decisions(request_id);
CREATE INDEX idx_hitl_voi_decisions_aspect ON hitl_voi_decisions(aspect_id);

CREATE INDEX idx_hitl_abstention_tenant ON hitl_abstention_events(tenant_id);
CREATE INDEX idx_hitl_abstention_model ON hitl_abstention_events(model_id);
CREATE INDEX idx_hitl_abstention_reason ON hitl_abstention_events(reason);

CREATE INDEX idx_hitl_chains_tenant ON hitl_escalation_chains(tenant_id);
CREATE INDEX idx_hitl_chains_active ON hitl_escalation_chains(is_active) WHERE is_active;

CREATE INDEX idx_ai_probes_model ON ai_model_abstention_probes(model_config_id);
CREATE INDEX idx_ai_probes_active ON ai_model_abstention_probes(is_active) WHERE is_active;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE hitl_question_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_question_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_voi_aspects ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_voi_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_abstention_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_abstention_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitl_escalation_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_abstention_probes ENABLE ROW LEVEL SECURITY;

CREATE POLICY hitl_batches_isolation ON hitl_question_batches FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY hitl_rate_limits_isolation ON hitl_rate_limits FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY hitl_cache_isolation ON hitl_question_cache FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY hitl_voi_aspects_isolation ON hitl_voi_aspects FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY hitl_voi_decisions_isolation ON hitl_voi_decisions FOR ALL USING (
  request_id IN (
    SELECT id FROM hitl_approval_requests 
    WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
  )
);

CREATE POLICY hitl_abstention_config_isolation ON hitl_abstention_config FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY hitl_abstention_events_isolation ON hitl_abstention_events FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY hitl_chains_isolation ON hitl_escalation_chains FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY ai_probes_isolation ON ai_model_abstention_probes FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE hitl_question_batches IS 'Groups related questions to reduce user interruptions';
COMMENT ON TABLE hitl_rate_limits IS 'Rate limiting configuration to prevent question storms';
COMMENT ON TABLE hitl_question_cache IS 'TTL cache for deduplicating repeated questions';
COMMENT ON TABLE hitl_voi_aspects IS 'Tracked aspects for Bayesian Value-of-Information calculation';
COMMENT ON TABLE hitl_voi_decisions IS 'Individual VOI decisions and outcomes for learning';
COMMENT ON TABLE hitl_abstention_config IS 'Configuration for AI abstention detection per tenant';
COMMENT ON TABLE hitl_abstention_events IS 'Logged abstention events for audit and improvement';
COMMENT ON TABLE hitl_escalation_chains IS 'Configurable multi-level escalation paths';
COMMENT ON TABLE ai_model_abstention_probes IS 'Linear probe weights for self-hosted model abstention detection';
