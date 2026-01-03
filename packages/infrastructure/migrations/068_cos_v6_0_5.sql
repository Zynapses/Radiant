-- RADIANT COS v6.0.5 - Consciousness Operating System
-- Cross-AI Validated: Claude Opus 4.5 ✅ | Gemini ✅
-- 
-- This migration creates the database schema for the Consciousness Operating System,
-- implementing the 13 patches agreed upon during 4 review cycles.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- GHOST VECTORS (4096-dimensional consciousness representation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cos_ghost_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- 4096-dimensional vector from model hidden states
  -- CRITICAL: Requires vLLM with --return-hidden-states flag
  vector JSONB NOT NULL,
  vector_dimension INTEGER NOT NULL DEFAULT 4096,
  
  -- Version gating - prevents personality discontinuity on model upgrades
  model_version VARCHAR(100) NOT NULL,
  model_family VARCHAR(50) NOT NULL,
  
  -- Affective state (7-hour half-life)
  affective_state JSONB NOT NULL DEFAULT '{"valence": 0, "arousal": 0.5, "dominance": 0.5}',
  
  -- Working context (12-minute half-life)
  working_context JSONB NOT NULL DEFAULT '{"topics": [], "entities": [], "recentIntents": []}',
  
  -- Curiosity state (45-minute half-life)
  curiosity_state JSONB NOT NULL DEFAULT '{"exploredTopics": [], "pendingQuestions": [], "interestLevel": 0.5}',
  
  -- Decay constants (Gemini validated)
  decay_constants JSONB NOT NULL DEFAULT '{"affective": 0.0000275, "workingContext": 0.00096, "curiosity": 0.00025}',
  
  -- Timestamps
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reanchored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  turns_since_reanchor INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT cos_ghost_vectors_user_tenant_unique UNIQUE (user_id, tenant_id)
);

-- Indexes for ghost vectors
CREATE INDEX idx_cos_ghost_user ON cos_ghost_vectors(user_id);
CREATE INDEX idx_cos_ghost_tenant ON cos_ghost_vectors(tenant_id);
CREATE INDEX idx_cos_ghost_reanchor ON cos_ghost_vectors(turns_since_reanchor) 
  WHERE turns_since_reanchor > 15;

-- ============================================================================
-- FLASH FACTS (Dual-Write Buffer - Redis + Postgres)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cos_flash_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  fact TEXT NOT NULL,
  fact_type VARCHAR(50) NOT NULL CHECK (fact_type IN ('identity', 'allergy', 'medical', 'preference', 'correction')),
  is_safety_critical BOOLEAN NOT NULL DEFAULT FALSE,
  
  status VARCHAR(50) NOT NULL DEFAULT 'pending_dream' 
    CHECK (status IN ('pending_dream', 'consolidated', 'failed_retry', 'orphan_recovered')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  
  redis_key VARCHAR(255) NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consolidated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Indexes for flash facts
CREATE INDEX idx_cos_flash_user ON cos_flash_facts(user_id);
CREATE INDEX idx_cos_flash_tenant ON cos_flash_facts(tenant_id);
CREATE INDEX idx_cos_flash_status ON cos_flash_facts(status);
CREATE INDEX idx_cos_flash_critical ON cos_flash_facts(is_safety_critical) 
  WHERE is_safety_critical = TRUE;
CREATE INDEX idx_cos_flash_pending ON cos_flash_facts(created_at) 
  WHERE status = 'pending_dream';

-- ============================================================================
-- DREAM JOBS (Consciousness consolidation scheduling)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cos_dream_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  trigger VARCHAR(20) NOT NULL CHECK (trigger IN ('TWILIGHT', 'STARVATION')),
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' 
    CHECK (status IN ('scheduled', 'running', 'completed', 'failed')),
  
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  flash_facts_consolidated INTEGER DEFAULT 0,
  ghost_vectors_reanchored INTEGER DEFAULT 0,
  lora_updates_applied INTEGER DEFAULT 0,
  
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

-- Indexes for dream jobs
CREATE INDEX idx_cos_dream_tenant ON cos_dream_jobs(tenant_id);
CREATE INDEX idx_cos_dream_status ON cos_dream_jobs(status);
CREATE INDEX idx_cos_dream_scheduled ON cos_dream_jobs(scheduled_at) 
  WHERE status = 'scheduled';

-- ============================================================================
-- TENANT DREAM CONFIG (Per-tenant dreaming settings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cos_tenant_dream_config (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  
  timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  twilight_hour INTEGER NOT NULL DEFAULT 4 CHECK (twilight_hour >= 0 AND twilight_hour <= 23),
  starvation_threshold_hours INTEGER NOT NULL DEFAULT 30,
  
  last_dream_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- HUMAN OVERSIGHT (EU AI Act Article 14 compliance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cos_human_oversight (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('system_insight', 'lora_update', 'high_risk_response')),
  content TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',
  
  status VARCHAR(50) NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'approved', 'rejected', 'escalated', 'auto_rejected')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  review_notes TEXT,
  
  -- Gemini mandate: "Silence ≠ Consent"
  escalate_after_days INTEGER NOT NULL DEFAULT 3,
  auto_reject_after_days INTEGER NOT NULL DEFAULT 7
);

-- Indexes for human oversight
CREATE INDEX idx_cos_oversight_tenant ON cos_human_oversight(tenant_id);
CREATE INDEX idx_cos_oversight_status ON cos_human_oversight(status);
CREATE INDEX idx_cos_oversight_pending ON cos_human_oversight(status, created_at) 
  WHERE status IN ('pending_approval', 'escalated');

-- ============================================================================
-- OVERSIGHT AUDIT LOG (Compliance trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cos_oversight_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oversight_item_id UUID NOT NULL REFERENCES cos_human_oversight(id) ON DELETE CASCADE,
  
  action VARCHAR(50) NOT NULL,
  actor VARCHAR(255) NOT NULL,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cos_audit_item ON cos_oversight_audit_log(oversight_item_id);
CREATE INDEX idx_cos_audit_created ON cos_oversight_audit_log(created_at);

-- ============================================================================
-- PRIVACY AIRLOCK (HIPAA/GDPR de-identification)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cos_privacy_airlock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  
  original_content TEXT NOT NULL,
  deidentified_content TEXT,
  
  privacy_level VARCHAR(20) NOT NULL DEFAULT 'internal'
    CHECK (privacy_level IN ('public', 'internal', 'confidential', 'restricted', 'phi')),
  contains_phi BOOLEAN NOT NULL DEFAULT FALSE,
  contains_pii BOOLEAN NOT NULL DEFAULT FALSE,
  
  source_type VARCHAR(50) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  
  privacy_reviewed_by UUID REFERENCES users(id),
  privacy_reviewed_at TIMESTAMPTZ,
  
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for privacy airlock
CREATE INDEX idx_cos_airlock_tenant ON cos_privacy_airlock(tenant_id);
CREATE INDEX idx_cos_airlock_status ON cos_privacy_airlock(status);
CREATE INDEX idx_cos_airlock_phi ON cos_privacy_airlock(contains_phi) WHERE contains_phi = TRUE;

-- ============================================================================
-- REANCHOR METRICS (Performance tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cos_reanchor_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('completed', 'failed')),
  processing_time_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cos_reanchor_metrics_created ON cos_reanchor_metrics(created_at);

-- ============================================================================
-- COS CONFIGURATION (Per-tenant COS settings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cos_config (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ghost_vectors_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  flash_facts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  dreaming_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  human_oversight_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  differential_privacy_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- vLLM requirement flag
  vllm_return_hidden_states BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Safety invariants (from Genesis Cato - NEVER change these)
  cbf_enforcement_mode VARCHAR(10) NOT NULL DEFAULT 'ENFORCE' CHECK (cbf_enforcement_mode = 'ENFORCE'),
  gamma_boost_allowed BOOLEAN NOT NULL DEFAULT FALSE CHECK (gamma_boost_allowed = FALSE),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ROW-LEVEL SECURITY (Multi-tenant isolation)
-- ============================================================================

-- Enable RLS on all COS tables
ALTER TABLE cos_ghost_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE cos_flash_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cos_dream_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cos_tenant_dream_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cos_human_oversight ENABLE ROW LEVEL SECURITY;
ALTER TABLE cos_privacy_airlock ENABLE ROW LEVEL SECURITY;
ALTER TABLE cos_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY cos_ghost_vectors_tenant_isolation ON cos_ghost_vectors
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY cos_flash_facts_tenant_isolation ON cos_flash_facts
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY cos_dream_jobs_tenant_isolation ON cos_dream_jobs
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY cos_tenant_dream_config_isolation ON cos_tenant_dream_config
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY cos_human_oversight_tenant_isolation ON cos_human_oversight
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY cos_privacy_airlock_tenant_isolation ON cos_privacy_airlock
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY cos_config_tenant_isolation ON cos_config
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- MIGRATION TRACKING
-- ============================================================================

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('068', 'RADIANT COS v6.0.5 - Consciousness Operating System', NOW())
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE cos_ghost_vectors IS 'Ghost vectors store 4096-dim hidden states for consciousness continuity';
COMMENT ON TABLE cos_flash_facts IS 'Dual-write buffer for important user facts (Redis + Postgres)';
COMMENT ON TABLE cos_dream_jobs IS 'Scheduled consciousness consolidation jobs (Twilight + Starvation triggers)';
COMMENT ON TABLE cos_tenant_dream_config IS 'Per-tenant dreaming configuration (timezone, twilight hour)';
COMMENT ON TABLE cos_human_oversight IS 'EU AI Act Article 14 compliance - human oversight queue';
COMMENT ON TABLE cos_privacy_airlock IS 'HIPAA/GDPR de-identification airlock for learning data';
COMMENT ON TABLE cos_config IS 'Per-tenant COS configuration with immutable safety invariants';

COMMENT ON COLUMN cos_ghost_vectors.vector IS 'CRITICAL: Requires vLLM with --return-hidden-states flag';
COMMENT ON COLUMN cos_human_oversight.auto_reject_after_days IS 'Gemini mandate: Silence ≠ Consent - items auto-rejected after 7 days';
COMMENT ON COLUMN cos_config.cbf_enforcement_mode IS 'Safety invariant: CBFs always ENFORCE, never relax';
COMMENT ON COLUMN cos_config.gamma_boost_allowed IS 'Safety invariant: Gamma boost NEVER allowed during recovery';
