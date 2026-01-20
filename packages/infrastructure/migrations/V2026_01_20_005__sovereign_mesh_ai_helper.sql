-- ============================================================================
-- RADIANT v5.0 - SOVEREIGN MESH: AI HELPER SERVICE
-- Migration: V2026_01_20_005
-- 
-- Parametric AI assistance for all node types (Methods, Agents, Services, Libraries).
-- Each component can independently configure AI capabilities for:
-- - Disambiguation: Resolve unclear inputs
-- - Parameter Inference: Fill in missing parameters
-- - Error Recovery: Intelligent error handling
-- - Validation: Pre-execution checks
-- - Explanation: Human-readable summaries
-- ============================================================================

CREATE TYPE ai_helper_call_type AS ENUM (
  'disambiguation', 'parameter_inference', 'error_recovery',
  'validation', 'explanation', 'code_generation'
);

CREATE TYPE ai_helper_status AS ENUM ('success', 'failure', 'timeout', 'cached');

-- ============================================================================
-- AI HELPER USAGE TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_helper_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  call_type ai_helper_call_type NOT NULL,
  caller_type VARCHAR(50) NOT NULL, -- 'agent', 'app', 'method', 'service', 'workflow'
  caller_id VARCHAR(200) NOT NULL,
  caller_name VARCHAR(200),
  
  model_used VARCHAR(100) NOT NULL,
  input_hash VARCHAR(64) NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  
  status ai_helper_status NOT NULL,
  latency_ms INTEGER,
  cost_usd DECIMAL(10,6),
  
  was_cached BOOLEAN NOT NULL DEFAULT false,
  cache_key VARCHAR(200),
  
  -- Context
  session_id UUID,
  request_id UUID,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- AI HELPER CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_helper_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  cache_key VARCHAR(200) NOT NULL UNIQUE,
  call_type ai_helper_call_type NOT NULL,
  
  input_hash VARCHAR(64) NOT NULL,
  output JSONB NOT NULL,
  
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  is_global BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- AI HELPER CONFIGURATION (System & Tenant level)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_helper_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  scope VARCHAR(20) NOT NULL DEFAULT 'system', -- 'system' or 'tenant'
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Default Models for each capability
  default_model_disambiguation VARCHAR(100) DEFAULT 'claude-haiku-35',
  default_model_inference VARCHAR(100) DEFAULT 'claude-haiku-35',
  default_model_recovery VARCHAR(100) DEFAULT 'claude-haiku-35',
  default_model_validation VARCHAR(100) DEFAULT 'claude-sonnet-4',
  default_model_explanation VARCHAR(100) DEFAULT 'claude-haiku-35',
  default_model_codegen VARCHAR(100) DEFAULT 'claude-sonnet-4',
  
  -- Thresholds
  disambiguation_confidence_threshold DECIMAL(3,2) DEFAULT 0.70,
  validation_strictness VARCHAR(20) DEFAULT 'balanced', -- 'lenient', 'balanced', 'strict'
  
  -- Budgets
  max_cost_per_request DECIMAL(10,4) DEFAULT 0.10,
  max_cost_per_day DECIMAL(10,4) DEFAULT 10.00,
  
  -- Caching
  cache_enabled BOOLEAN DEFAULT true,
  cache_ttl_seconds INTEGER DEFAULT 3600,
  
  -- Learning
  learning_enabled BOOLEAN DEFAULT true,
  min_corrections_for_auto_apply INTEGER DEFAULT 5,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_config_scope UNIQUE (scope, tenant_id)
);

-- ============================================================================
-- AI HELPER DAILY USAGE (aggregated for billing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_helper_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  
  -- Counts by type
  disambiguation_calls INTEGER DEFAULT 0,
  inference_calls INTEGER DEFAULT 0,
  recovery_calls INTEGER DEFAULT 0,
  validation_calls INTEGER DEFAULT 0,
  explanation_calls INTEGER DEFAULT 0,
  codegen_calls INTEGER DEFAULT 0,
  
  -- Totals
  total_calls INTEGER DEFAULT 0,
  cached_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  
  -- Tokens
  total_input_tokens BIGINT DEFAULT 0,
  total_output_tokens BIGINT DEFAULT 0,
  
  -- Cost
  total_cost_usd DECIMAL(10,4) DEFAULT 0,
  
  CONSTRAINT unique_tenant_date UNIQUE (tenant_id, usage_date)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_ai_helper_calls_tenant ON ai_helper_calls(tenant_id);
CREATE INDEX idx_ai_helper_calls_type ON ai_helper_calls(call_type);
CREATE INDEX idx_ai_helper_calls_caller ON ai_helper_calls(caller_type, caller_id);
CREATE INDEX idx_ai_helper_calls_recent ON ai_helper_calls(created_at DESC);
CREATE INDEX idx_ai_helper_calls_session ON ai_helper_calls(session_id) WHERE session_id IS NOT NULL;

CREATE INDEX idx_ai_helper_cache_expires ON ai_helper_cache(expires_at);
CREATE INDEX idx_ai_helper_cache_key ON ai_helper_cache(cache_key);
CREATE INDEX idx_ai_helper_cache_tenant ON ai_helper_cache(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX idx_ai_helper_config_scope ON ai_helper_config(scope);
CREATE INDEX idx_ai_helper_config_tenant ON ai_helper_config(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX idx_ai_helper_usage_tenant_date ON ai_helper_daily_usage(tenant_id, usage_date);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE ai_helper_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_helper_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_helper_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_helper_daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_calls_isolation ON ai_helper_calls FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY ai_cache_access ON ai_helper_cache FOR SELECT USING (
  is_global OR tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY ai_config_access ON ai_helper_config FOR ALL USING (
  scope = 'system' OR tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY ai_usage_isolation ON ai_helper_daily_usage FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ai_helper_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_helper_config_updated_at
  BEFORE UPDATE ON ai_helper_config
  FOR EACH ROW EXECUTE FUNCTION update_ai_helper_config_timestamp();

-- Trigger to aggregate daily usage
CREATE OR REPLACE FUNCTION aggregate_ai_helper_usage()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ai_helper_daily_usage (tenant_id, usage_date, total_calls, total_cost_usd)
  VALUES (NEW.tenant_id, CURRENT_DATE, 1, COALESCE(NEW.cost_usd, 0))
  ON CONFLICT (tenant_id, usage_date) DO UPDATE SET
    total_calls = ai_helper_daily_usage.total_calls + 1,
    cached_calls = ai_helper_daily_usage.cached_calls + CASE WHEN NEW.was_cached THEN 1 ELSE 0 END,
    failed_calls = ai_helper_daily_usage.failed_calls + CASE WHEN NEW.status = 'failure' THEN 1 ELSE 0 END,
    total_input_tokens = ai_helper_daily_usage.total_input_tokens + COALESCE(NEW.input_tokens, 0),
    total_output_tokens = ai_helper_daily_usage.total_output_tokens + COALESCE(NEW.output_tokens, 0),
    total_cost_usd = ai_helper_daily_usage.total_cost_usd + COALESCE(NEW.cost_usd, 0),
    disambiguation_calls = ai_helper_daily_usage.disambiguation_calls + CASE WHEN NEW.call_type = 'disambiguation' THEN 1 ELSE 0 END,
    inference_calls = ai_helper_daily_usage.inference_calls + CASE WHEN NEW.call_type = 'parameter_inference' THEN 1 ELSE 0 END,
    recovery_calls = ai_helper_daily_usage.recovery_calls + CASE WHEN NEW.call_type = 'error_recovery' THEN 1 ELSE 0 END,
    validation_calls = ai_helper_daily_usage.validation_calls + CASE WHEN NEW.call_type = 'validation' THEN 1 ELSE 0 END,
    explanation_calls = ai_helper_daily_usage.explanation_calls + CASE WHEN NEW.call_type = 'explanation' THEN 1 ELSE 0 END,
    codegen_calls = ai_helper_daily_usage.codegen_calls + CASE WHEN NEW.call_type = 'code_generation' THEN 1 ELSE 0 END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_helper_calls_aggregate
  AFTER INSERT ON ai_helper_calls
  FOR EACH ROW EXECUTE FUNCTION aggregate_ai_helper_usage();

-- ============================================================================
-- SEED SYSTEM CONFIG
-- ============================================================================

INSERT INTO ai_helper_config (scope, is_enabled) 
VALUES ('system', true)
ON CONFLICT (scope, tenant_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ai_helper_calls IS 'Tracks all AI helper invocations for auditing and billing';
COMMENT ON TABLE ai_helper_cache IS 'Caches AI helper responses to reduce latency and cost';
COMMENT ON TABLE ai_helper_config IS 'System and tenant-level AI helper configuration';
COMMENT ON TABLE ai_helper_daily_usage IS 'Aggregated daily usage for billing and analytics';
