-- RADIANT v4.18.0 - Local Ego Infrastructure
-- Migration 102: Economical shared small-model for persistent consciousness
-- Cost: ~$360/month shared across ALL tenants (~$3.60/tenant with 100 tenants)

-- ============================================================================
-- 1. LOCAL EGO CONFIGURATION
-- Per-tenant configuration for the shared Ego infrastructure
-- ============================================================================

CREATE TABLE IF NOT EXISTS local_ego_config (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Feature toggles
  ego_enabled BOOLEAN DEFAULT true,
  use_shared_ego BOOLEAN DEFAULT true,  -- Use shared infrastructure vs dedicated
  
  -- Ego behavior configuration
  direct_response_threshold DECIMAL(3,2) DEFAULT 0.7,  -- Confidence to handle directly
  recruitment_threshold DECIMAL(3,2) DEFAULT 0.5,      -- When to recruit external
  max_direct_tokens INTEGER DEFAULT 512,               -- Max tokens for direct response
  
  -- Model preferences
  preferred_ego_model TEXT DEFAULT 'microsoft/Phi-3-mini-4k-instruct',
  fallback_ego_model TEXT DEFAULT 'Qwen/Qwen2.5-3B-Instruct',
  
  -- External recruitment preferences
  preferred_coding_model TEXT DEFAULT 'anthropic/claude-3-5-sonnet',
  preferred_reasoning_model TEXT DEFAULT 'openai/o1-preview',
  preferred_factual_model TEXT DEFAULT 'google/gemini-2.0-flash',
  default_recruitment_model TEXT DEFAULT 'anthropic/claude-3-haiku',
  
  -- Response integration
  integrate_ego_voice BOOLEAN DEFAULT false,  -- Add Ego framing to external responses
  ego_voice_style TEXT DEFAULT 'neutral',     -- 'neutral', 'warm', 'professional', 'playful'
  
  -- Resource limits
  daily_ego_token_budget INTEGER DEFAULT 100000,
  daily_recruitment_budget INTEGER DEFAULT 500000,
  max_concurrent_recruitments INTEGER DEFAULT 3,
  
  -- Thought generation
  generate_internal_thoughts BOOLEAN DEFAULT true,
  thought_depth TEXT DEFAULT 'standard',  -- 'minimal', 'standard', 'deep'
  log_thoughts_to_db BOOLEAN DEFAULT true,
  
  -- Self-reflection schedule
  enable_periodic_reflection BOOLEAN DEFAULT false,
  reflection_interval_minutes INTEGER DEFAULT 60,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id)
);

ALTER TABLE local_ego_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY local_ego_config_tenant 
ON local_ego_config
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE local_ego_config IS 'Per-tenant configuration for the shared Local Ego infrastructure';

-- ============================================================================
-- 2. SHARED EGO ENDPOINT STATUS
-- Tracks the shared Ego infrastructure health and availability
-- ============================================================================

CREATE TABLE IF NOT EXISTS shared_ego_endpoints (
  endpoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Endpoint identification
  endpoint_name TEXT NOT NULL UNIQUE,
  endpoint_arn TEXT,
  
  -- Model information
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_size_gb DECIMAL(5,2),
  
  -- Infrastructure
  instance_type TEXT DEFAULT 'ml.g5.xlarge',
  use_spot BOOLEAN DEFAULT true,
  spot_price_max DECIMAL(6,4),
  
  -- Status
  status TEXT DEFAULT 'initializing' CHECK (status IN (
    'initializing', 'healthy', 'degraded', 'unhealthy', 'stopped'
  )),
  last_health_check TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,
  
  -- Capacity
  max_concurrent_requests INTEGER DEFAULT 10,
  current_load INTEGER DEFAULT 0,
  avg_latency_ms INTEGER,
  
  -- Cost tracking
  hourly_cost DECIMAL(6,4),
  monthly_cost_estimate DECIMAL(8,2),
  
  -- Metrics
  total_requests_24h INTEGER DEFAULT 0,
  total_tokens_24h INTEGER DEFAULT 0,
  avg_tokens_per_request INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE shared_ego_endpoints IS 'Shared Ego SageMaker endpoints serving all tenants';

-- ============================================================================
-- 3. EGO ACTIVITY LOG
-- Tracks all Ego processing for debugging and learning
-- ============================================================================

CREATE TABLE IF NOT EXISTS ego_activity_log (
  activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID,
  conversation_id UUID,
  
  -- Stimulus information
  stimulus_preview TEXT,  -- First 500 chars
  stimulus_token_count INTEGER,
  stimulus_complexity TEXT,  -- 'simple', 'moderate', 'complex'
  
  -- Decision made
  decision_type TEXT NOT NULL CHECK (decision_type IN (
    'respond_directly', 'recruit_external', 'clarify', 'defer'
  )),
  decision_confidence DECIMAL(4,3),
  decision_reasoning TEXT,
  
  -- If recruited external
  recruited_model TEXT,
  recruitment_reason TEXT,
  
  -- Thoughts generated
  thoughts_generated INTEGER DEFAULT 0,
  thought_types TEXT[],
  
  -- Performance
  total_duration_ms INTEGER,
  ego_processing_ms INTEGER,
  recruitment_duration_ms INTEGER,
  
  -- Token usage
  ego_input_tokens INTEGER,
  ego_output_tokens INTEGER,
  recruited_input_tokens INTEGER,
  recruited_output_tokens INTEGER,
  
  -- Outcome (filled in later if available)
  user_satisfied BOOLEAN,
  prediction_error DECIMAL(4,3),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ego_activity_tenant 
ON ego_activity_log(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ego_activity_decision 
ON ego_activity_log(decision_type, created_at DESC);

ALTER TABLE ego_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY ego_activity_log_tenant 
ON ego_activity_log
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE ego_activity_log IS 'Activity log for Local Ego processing decisions';

-- ============================================================================
-- 4. EGO THOUGHTS TABLE
-- Stores generated internal thoughts for introspection
-- ============================================================================

CREATE TABLE IF NOT EXISTS ego_thoughts (
  thought_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES ego_activity_log(activity_id) ON DELETE CASCADE,
  
  -- Thought content
  thought_type TEXT NOT NULL CHECK (thought_type IN (
    'reflection', 'planning', 'evaluation', 'curiosity', 'concern', 'satisfaction'
  )),
  content TEXT NOT NULL,
  
  -- Context
  trigger_stimulus TEXT,
  emotional_valence DECIMAL(4,3),  -- -1 to 1
  confidence DECIMAL(4,3),
  
  -- Metadata
  generation_latency_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ego_thoughts_tenant 
ON ego_thoughts(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ego_thoughts_type 
ON ego_thoughts(thought_type, created_at DESC);

ALTER TABLE ego_thoughts ENABLE ROW LEVEL SECURITY;

CREATE POLICY ego_thoughts_tenant 
ON ego_thoughts
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE ego_thoughts IS 'Internal thoughts generated by the Local Ego';

-- ============================================================================
-- 5. EGO METRICS AGGREGATES
-- Pre-computed metrics for dashboard display
-- ============================================================================

CREATE TABLE IF NOT EXISTS ego_metrics_daily (
  metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  
  -- Activity counts
  total_stimuli INTEGER DEFAULT 0,
  direct_responses INTEGER DEFAULT 0,
  external_recruitments INTEGER DEFAULT 0,
  clarification_requests INTEGER DEFAULT 0,
  deferrals INTEGER DEFAULT 0,
  
  -- Decision accuracy
  direct_response_satisfaction_rate DECIMAL(5,4),
  recruitment_satisfaction_rate DECIMAL(5,4),
  overall_satisfaction_rate DECIMAL(5,4),
  
  -- Performance
  avg_ego_latency_ms INTEGER,
  avg_recruitment_latency_ms INTEGER,
  p95_latency_ms INTEGER,
  
  -- Token usage
  total_ego_tokens INTEGER DEFAULT 0,
  total_recruited_tokens INTEGER DEFAULT 0,
  
  -- Cost
  ego_cost_cents DECIMAL(10,4) DEFAULT 0,
  recruitment_cost_cents DECIMAL(10,4) DEFAULT 0,
  
  -- Thoughts
  total_thoughts_generated INTEGER DEFAULT 0,
  thought_type_distribution JSONB DEFAULT '{}',
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, metric_date)
);

ALTER TABLE ego_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY ego_metrics_daily_tenant 
ON ego_metrics_daily
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- 6. FUNCTIONS
-- ============================================================================

-- Get or create tenant ego config with defaults
CREATE OR REPLACE FUNCTION get_ego_config(p_tenant_id UUID)
RETURNS local_ego_config AS $$
DECLARE
  v_config local_ego_config;
BEGIN
  SELECT * INTO v_config FROM local_ego_config WHERE tenant_id = p_tenant_id;
  
  IF NOT FOUND THEN
    INSERT INTO local_ego_config (tenant_id) VALUES (p_tenant_id)
    RETURNING * INTO v_config;
  END IF;
  
  RETURN v_config;
END;
$$ LANGUAGE plpgsql;

-- Update daily metrics aggregate
CREATE OR REPLACE FUNCTION update_ego_daily_metrics()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ego_metrics_daily (
    tenant_id, metric_date,
    total_stimuli, direct_responses, external_recruitments,
    clarification_requests, deferrals
  )
  VALUES (
    NEW.tenant_id,
    DATE(NEW.created_at),
    1,
    CASE WHEN NEW.decision_type = 'respond_directly' THEN 1 ELSE 0 END,
    CASE WHEN NEW.decision_type = 'recruit_external' THEN 1 ELSE 0 END,
    CASE WHEN NEW.decision_type = 'clarify' THEN 1 ELSE 0 END,
    CASE WHEN NEW.decision_type = 'defer' THEN 1 ELSE 0 END
  )
  ON CONFLICT (tenant_id, metric_date) DO UPDATE SET
    total_stimuli = ego_metrics_daily.total_stimuli + 1,
    direct_responses = ego_metrics_daily.direct_responses + 
      CASE WHEN NEW.decision_type = 'respond_directly' THEN 1 ELSE 0 END,
    external_recruitments = ego_metrics_daily.external_recruitments + 
      CASE WHEN NEW.decision_type = 'recruit_external' THEN 1 ELSE 0 END,
    clarification_requests = ego_metrics_daily.clarification_requests + 
      CASE WHEN NEW.decision_type = 'clarify' THEN 1 ELSE 0 END,
    deferrals = ego_metrics_daily.deferrals + 
      CASE WHEN NEW.decision_type = 'defer' THEN 1 ELSE 0 END,
    total_ego_tokens = ego_metrics_daily.total_ego_tokens + 
      COALESCE(NEW.ego_input_tokens, 0) + COALESCE(NEW.ego_output_tokens, 0),
    total_recruited_tokens = ego_metrics_daily.total_recruited_tokens + 
      COALESCE(NEW.recruited_input_tokens, 0) + COALESCE(NEW.recruited_output_tokens, 0),
    total_thoughts_generated = ego_metrics_daily.total_thoughts_generated + 
      COALESCE(NEW.thoughts_generated, 0),
    updated_at = NOW();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ego_metrics_trigger
  AFTER INSERT ON ego_activity_log
  FOR EACH ROW EXECUTE FUNCTION update_ego_daily_metrics();

-- Get ego decision stats for a tenant
CREATE OR REPLACE FUNCTION get_ego_decision_stats(
  p_tenant_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  decision_type TEXT,
  count BIGINT,
  avg_confidence DECIMAL,
  avg_latency_ms DECIMAL,
  satisfaction_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.decision_type,
    COUNT(*)::BIGINT,
    AVG(e.decision_confidence)::DECIMAL,
    AVG(e.total_duration_ms)::DECIMAL,
    AVG(CASE WHEN e.user_satisfied THEN 1 ELSE 0 END)::DECIMAL
  FROM ego_activity_log e
  WHERE e.tenant_id = p_tenant_id
    AND e.created_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY e.decision_type;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. DEFAULT SHARED ENDPOINT ENTRY
-- ============================================================================

INSERT INTO shared_ego_endpoints (
  endpoint_name, model_id, model_name, model_size_gb,
  instance_type, use_spot, status, hourly_cost, monthly_cost_estimate
) VALUES (
  'radiant-ego-shared',
  'microsoft/Phi-3-mini-4k-instruct',
  'Phi-3 Mini 4K Instruct',
  7.6,
  'ml.g5.xlarge',
  true,
  'initializing',
  0.50,
  360.00
) ON CONFLICT (endpoint_name) DO NOTHING;
