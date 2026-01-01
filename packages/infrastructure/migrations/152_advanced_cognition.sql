-- ============================================================================
-- RADIANT v6.1.0 - Advanced Cognition Tables
-- Migration: 152_advanced_cognition.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- DISTILLATION TRAINING DATA (Reasoning Teacher)
-- ============================================================================

CREATE TABLE IF NOT EXISTS distillation_training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  input_prompt TEXT NOT NULL,
  input_context JSONB DEFAULT '{}',
  task_type VARCHAR(50) NOT NULL,
  domain_ids UUID[] DEFAULT '{}',
  teacher_model_id VARCHAR(100) NOT NULL,
  teacher_response TEXT NOT NULL,
  reasoning_trace TEXT NOT NULL,
  confidence_score DECIMAL(3,2),
  alternative_paths JSONB DEFAULT '[]',
  generation_latency_ms INTEGER,
  token_count_input INTEGER,
  token_count_output INTEGER,
  cost_usd DECIMAL(10,6),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'used', 'rejected')),
  quality_score DECIMAL(3,2),
  validated_by UUID REFERENCES users(id),
  used_in_training_job UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_distillation_tenant_status ON distillation_training_data(tenant_id, status);
CREATE INDEX idx_distillation_task_type ON distillation_training_data(tenant_id, task_type);
CREATE INDEX idx_distillation_quality ON distillation_training_data(tenant_id, quality_score DESC) WHERE status = 'validated';

-- ============================================================================
-- INFERENCE STUDENT VERSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS inference_student_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  base_model VARCHAR(100) NOT NULL,
  training_job_id UUID,
  training_examples_count INTEGER DEFAULT 0,
  training_epochs INTEGER DEFAULT 3,
  accuracy_score DECIMAL(5,4),
  latency_p50_ms INTEGER,
  latency_p99_ms INTEGER,
  sagemaker_endpoint_name VARCHAR(200),
  is_active BOOLEAN DEFAULT FALSE,
  promoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, version_number)
);

CREATE INDEX idx_student_active ON inference_student_versions(tenant_id) WHERE is_active = true;

-- ============================================================================
-- DISTILLATION JOBS
-- ============================================================================

CREATE TABLE IF NOT EXISTS distillation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting', 'preparing', 'training', 'evaluating', 'completed', 'failed')),
  examples_collected INTEGER DEFAULT 0,
  training_job_arn VARCHAR(500),
  student_version_id UUID REFERENCES inference_student_versions(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX idx_distillation_jobs_tenant ON distillation_jobs(tenant_id, status);

-- ============================================================================
-- SEMANTIC CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS semantic_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  query_embedding vector(1536) NOT NULL,
  model_id VARCHAR(100) NOT NULL,
  domain_ids UUID[] DEFAULT '{}',
  context_hash VARCHAR(64),
  response TEXT NOT NULL,
  response_embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  user_feedback_avg DECIMAL(3,2),
  feedback_count INTEGER DEFAULT 0,
  was_invalidated BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_semantic_cache_embedding ON semantic_cache USING ivfflat (query_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_semantic_cache_expiry ON semantic_cache(expires_at) WHERE was_invalidated = FALSE;
CREATE INDEX idx_semantic_cache_tenant ON semantic_cache(tenant_id, model_id);

-- ============================================================================
-- SEMANTIC CACHE METRICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS semantic_cache_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  cache_misses INTEGER NOT NULL DEFAULT 0,
  hit_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN total_requests > 0 THEN cache_hits::DECIMAL / total_requests ELSE 0 END
  ) STORED,
  avg_hit_latency_ms INTEGER,
  avg_miss_latency_ms INTEGER,
  estimated_cost_saved DECIMAL(10,4) DEFAULT 0,
  UNIQUE(tenant_id, period_start)
);

-- ============================================================================
-- METACOGNITION ASSESSMENTS (extends existing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS metacognition_assessments_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  overall_confidence DECIMAL(3,2) NOT NULL,
  logits_entropy DECIMAL(5,4),
  response_consistency DECIMAL(3,2),
  domain_match_score DECIMAL(3,2),
  historical_accuracy DECIMAL(3,2),
  suggested_action VARCHAR(20) NOT NULL CHECK (suggested_action IN ('proceed', 'escalate', 'clarify', 'defer')),
  actual_action_taken VARCHAR(20),
  escalated_to_model VARCHAR(100),
  self_correction_iterations INTEGER DEFAULT 0,
  final_user_satisfaction DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_metacognition_v2_tenant ON metacognition_assessments_v2(tenant_id, created_at DESC);

-- ============================================================================
-- REWARD TRAINING DATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS reward_training_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  prompt TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',
  winning_response TEXT NOT NULL,
  winning_model_id VARCHAR(100),
  losing_response TEXT NOT NULL,
  losing_model_id VARCHAR(100),
  signal_type VARCHAR(50) NOT NULL CHECK (signal_type IN ('explicit_feedback', 'regeneration', 'dwell_time', 'copy', 'share')),
  signal_strength DECIMAL(3,2) NOT NULL,
  domain_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_in_training BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_reward_training_tenant ON reward_training_data(tenant_id, used_in_training);
CREATE INDEX idx_reward_training_signal ON reward_training_data(signal_type, signal_strength DESC);

-- ============================================================================
-- REWARD MODEL VERSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS reward_model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number INTEGER NOT NULL UNIQUE,
  training_examples_count INTEGER NOT NULL,
  accuracy DECIMAL(5,4),
  agreement_with_humans DECIMAL(5,4),
  model_artifact_s3 VARCHAR(500),
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- COUNTERFACTUAL CANDIDATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS counterfactual_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  original_model VARCHAR(100) NOT NULL,
  alternative_models VARCHAR(100)[] NOT NULL,
  prompt TEXT NOT NULL,
  original_response TEXT NOT NULL,
  original_latency_ms INTEGER,
  original_cost DECIMAL(10,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_counterfactual_candidates_tenant ON counterfactual_candidates(tenant_id, created_at DESC);

-- ============================================================================
-- COUNTERFACTUAL SIMULATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS counterfactual_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  original_model VARCHAR(100) NOT NULL,
  original_response TEXT NOT NULL,
  original_latency_ms INTEGER,
  original_cost DECIMAL(10,6),
  original_reward_score DECIMAL(3,2),
  alternative_model VARCHAR(100) NOT NULL,
  alternative_response TEXT,
  alternative_latency_ms INTEGER,
  alternative_cost DECIMAL(10,6),
  alternative_reward_score DECIMAL(3,2),
  preferred_by_reward VARCHAR(20) CHECK (preferred_by_reward IN ('original', 'alternative', 'equal')),
  quality_delta DECIMAL(5,4),
  cost_delta DECIMAL(10,6),
  sample_reason VARCHAR(50) NOT NULL CHECK (sample_reason IN ('regeneration', 'low_confidence', 'high_cost', 'random')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_counterfactual_simulations_tenant ON counterfactual_simulations(tenant_id, created_at DESC);
CREATE INDEX idx_counterfactual_preferred ON counterfactual_simulations(preferred_by_reward) WHERE preferred_by_reward IS NOT NULL;

-- ============================================================================
-- KNOWLEDGE GAPS (Curiosity Engine)
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain VARCHAR(100) NOT NULL,
  topic VARCHAR(500) NOT NULL,
  evidence_of_gap TEXT[] DEFAULT '{}',
  frequency INTEGER DEFAULT 1,
  importance DECIMAL(3,2) DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, domain, topic)
);

CREATE INDEX idx_knowledge_gaps_priority ON knowledge_gaps(tenant_id, (frequency * importance) DESC);

-- ============================================================================
-- CURIOSITY GOALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS curiosity_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('assigned', 'inferred', 'emergent', 'maintenance')),
  description TEXT NOT NULL,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'abandoned')),
  curiosity_source_id UUID REFERENCES knowledge_gaps(id),
  exploration_strategy TEXT,
  progress DECIMAL(3,2) DEFAULT 0,
  milestones JSONB DEFAULT '[]',
  tokens_used INTEGER DEFAULT 0,
  cost_used DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  target_completion_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_curiosity_goals_active ON curiosity_goals(tenant_id, priority DESC) WHERE status IN ('pending', 'active');

-- ============================================================================
-- CAUSAL LINKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS causal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  source_turn_id UUID NOT NULL,
  target_turn_id UUID NOT NULL,
  causal_type VARCHAR(20) NOT NULL CHECK (causal_type IN ('reference', 'elaboration', 'correction', 'consequence', 'contradiction', 'continuation')),
  strength DECIMAL(3,2) DEFAULT 0.8,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_turn_id, target_turn_id)
);

CREATE INDEX idx_causal_links_conversation ON causal_links(tenant_id, conversation_id);

-- ============================================================================
-- CONVERSATION TURNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversation_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  summary VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversation_turns ON conversation_turns(tenant_id, conversation_id, created_at);

-- ============================================================================
-- REASONING TRACES (partitioned by month)
-- ============================================================================

CREATE TABLE IF NOT EXISTS reasoning_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  original_prompt TEXT NOT NULL,
  detected_intent VARCHAR(100),
  detected_domains UUID[],
  detected_entities JSONB,
  confidence_scores JSONB,
  selected_model VARCHAR(100) NOT NULL,
  alternative_models JSONB,
  learning_hierarchy_scores JSONB,
  thermal_state VARCHAR(20),
  cost_estimate DECIMAL(10,6),
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  latency_ms INTEGER,
  raw_response TEXT,
  reward_model_score DECIMAL(3,2),
  metacognition_confidence DECIMAL(3,2),
  was_escalated BOOLEAN DEFAULT FALSE,
  final_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create partitions for 2026
CREATE TABLE IF NOT EXISTS reasoning_traces_y2026m01 PARTITION OF reasoning_traces FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS reasoning_traces_y2026m02 PARTITION OF reasoning_traces FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS reasoning_traces_y2026m03 PARTITION OF reasoning_traces FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS reasoning_traces_y2026m04 PARTITION OF reasoning_traces FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS reasoning_traces_y2026m05 PARTITION OF reasoning_traces FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS reasoning_traces_y2026m06 PARTITION OF reasoning_traces FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX idx_reasoning_traces_tenant ON reasoning_traces(tenant_id, created_at DESC);
CREATE INDEX idx_reasoning_traces_request ON reasoning_traces(request_id);

-- ============================================================================
-- REASONING OUTCOMES
-- ============================================================================

CREATE TABLE IF NOT EXISTS reasoning_outcomes (
  trace_id UUID NOT NULL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_feedback VARCHAR(20),
  was_regenerated BOOLEAN DEFAULT FALSE,
  was_edited BOOLEAN DEFAULT FALSE,
  dwell_time_ms INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reasoning_outcomes_tenant ON reasoning_outcomes(tenant_id);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO radiant_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO radiant_api;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE distillation_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE inference_student_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE distillation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_cache_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE metacognition_assessments_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE counterfactual_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE counterfactual_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE curiosity_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE causal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_distillation ON distillation_training_data
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_student ON inference_student_versions
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_jobs ON distillation_jobs
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_cache ON semantic_cache
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_cache_metrics ON semantic_cache_metrics
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_metacognition ON metacognition_assessments_v2
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_reward ON reward_training_data
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_counterfactual_candidates ON counterfactual_candidates
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_counterfactual ON counterfactual_simulations
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_gaps ON knowledge_gaps
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_goals ON curiosity_goals
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_causal ON causal_links
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_turns ON conversation_turns
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE reasoning_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE reasoning_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_traces ON reasoning_traces
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_outcomes ON reasoning_outcomes
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
