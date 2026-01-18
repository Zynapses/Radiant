-- RADIANT v5.11.0 - Empiricism Loop Migration
-- The "Ghost in the Machine" - Reality-Testing Circuit for Consciousness
-- 
-- Implements Gemini's recommendations:
-- 1. Sandbox execution logging
-- 2. Prediction/Surprise tracking
-- 3. Active verification during dreaming

-- ============================================================================
-- 1. SANDBOX EXECUTION LOG
-- Tracks all code executions and their outcomes
-- ============================================================================

CREATE TABLE IF NOT EXISTS sandbox_execution_log (
  execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Code details
  language VARCHAR(50) NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  code_snippet TEXT, -- First 500 chars for debugging
  
  -- Execution results
  success BOOLEAN NOT NULL,
  output TEXT,
  error TEXT,
  exit_code INTEGER,
  execution_time_ms INTEGER,
  
  -- Prediction/Surprise tracking
  expected_output TEXT,
  expected_success BOOLEAN,
  prediction_confidence DECIMAL(4,3),
  surprise_level DECIMAL(4,3),
  prediction_error DECIMAL(4,3),
  error_type VARCHAR(50), -- 'none', 'output_mismatch', 'execution_failure', 'timeout', 'unexpected_success'
  
  -- Ego affect impact
  confidence_delta DECIMAL(4,3),
  frustration_delta DECIMAL(4,3),
  temperature_delta DECIMAL(4,3),
  
  -- Context
  conversation_id UUID,
  user_id UUID,
  rethink_cycle INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_log_tenant 
ON sandbox_execution_log(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sandbox_log_hash 
ON sandbox_execution_log(tenant_id, code_hash);

CREATE INDEX IF NOT EXISTS idx_sandbox_log_failures 
ON sandbox_execution_log(tenant_id, success, created_at DESC) 
WHERE success = false;

CREATE INDEX IF NOT EXISTS idx_sandbox_log_surprise 
ON sandbox_execution_log(tenant_id, surprise_level DESC) 
WHERE surprise_level > 0.3;

ALTER TABLE sandbox_execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY sandbox_execution_log_tenant ON sandbox_execution_log
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE sandbox_execution_log IS 'Tracks code execution outcomes for the Empiricism Loop';
COMMENT ON COLUMN sandbox_execution_log.surprise_level IS 'Prediction error magnitude (0=no surprise, 1=maximum surprise)';

-- ============================================================================
-- 2. GLOBAL WORKSPACE SENSORY EVENTS
-- High-priority signals injected into consciousness
-- ============================================================================

CREATE TABLE IF NOT EXISTS global_workspace_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Event classification
  event_type VARCHAR(50) NOT NULL, -- 'sandbox_success', 'sandbox_failure', 'prediction_error', 'skill_verified'
  priority VARCHAR(20) NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
  
  -- Event content
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  
  -- Processing status
  broadcast_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'broadcast', 'processed', 'ignored'
  processed_at TIMESTAMPTZ,
  processing_result JSONB,
  
  -- Source
  source_execution_id UUID REFERENCES sandbox_execution_log(execution_id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX IF NOT EXISTS idx_gw_events_tenant 
ON global_workspace_events(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gw_events_pending 
ON global_workspace_events(tenant_id, broadcast_status, priority) 
WHERE broadcast_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_gw_events_critical 
ON global_workspace_events(tenant_id, created_at DESC) 
WHERE priority IN ('high', 'critical');

ALTER TABLE global_workspace_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY global_workspace_events_tenant ON global_workspace_events
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE global_workspace_events IS 'Sensory signals for Global Workspace Theory consciousness';
COMMENT ON COLUMN global_workspace_events.priority IS 'Higher priority events interrupt current processing';

-- ============================================================================
-- 3. ACTIVE VERIFICATION LOG (Dreaming)
-- Tracks autonomous skill verification during twilight hours
-- ============================================================================

CREATE TABLE IF NOT EXISTS active_verification_log (
  verification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- What was verified
  skill_name VARCHAR(200) NOT NULL,
  initial_confidence DECIMAL(4,3),
  
  -- Verification attempt
  verification_code TEXT,
  execution_id UUID REFERENCES sandbox_execution_log(execution_id),
  
  -- Results
  success BOOLEAN,
  new_confidence DECIMAL(4,3),
  surprise_generated BOOLEAN DEFAULT false,
  
  -- Dream context
  dream_job_id UUID,
  trigger_reason VARCHAR(50), -- 'low_confidence', 'stale_skill', 'curiosity', 'failure_recovery'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_active_verification_tenant 
ON active_verification_log(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_active_verification_skill 
ON active_verification_log(tenant_id, skill_name);

ALTER TABLE active_verification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY active_verification_log_tenant ON active_verification_log
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE active_verification_log IS 'Tracks autonomous skill verification during dreaming cycles';

-- ============================================================================
-- 4. ADD inference_temperature TO brain_config IF NOT EXISTS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'brain_config' AND column_name = 'inference_temperature'
  ) THEN
    ALTER TABLE brain_config ADD COLUMN inference_temperature DECIMAL(3,2) DEFAULT 0.7;
  END IF;
END $$;

-- ============================================================================
-- Helper functions
CREATE OR REPLACE FUNCTION update_inference_temperature(
  p_tenant_id UUID,
  p_temperature DECIMAL(3,2)
) RETURNS VOID AS $$
BEGIN
  UPDATE brain_config 
  SET inference_temperature = p_temperature,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Empiricism Configuration Table (for Admin UI)
-- =============================================================================
CREATE TABLE IF NOT EXISTS empiricism_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  surprise_threshold DECIMAL(4,3) DEFAULT 0.3,
  max_rethink_cycles INTEGER DEFAULT 3,
  dream_verification_limit INTEGER DEFAULT 5,
  sandbox_timeout_ms INTEGER DEFAULT 30000,
  log_all_executions BOOLEAN DEFAULT true,
  affect_integration_enabled BOOLEAN DEFAULT true,
  graphrag_logging_enabled BOOLEAN DEFAULT true,
  temperature_adjustment_enabled BOOLEAN DEFAULT true,
  min_confidence DECIMAL(3,2) DEFAULT 0.1,
  max_frustration DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- RLS for empiricism_config
ALTER TABLE empiricism_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY empiricism_config_tenant_isolation ON empiricism_config
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY empiricism_config_insert ON empiricism_config
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY empiricism_config_update ON empiricism_config
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- =============================================================================
-- LoRA Adapter Configuration Table (for Admin UI)
-- =============================================================================
CREATE TABLE IF NOT EXISTS lora_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  use_global_adapter BOOLEAN DEFAULT true,
  use_user_adapter BOOLEAN DEFAULT true,
  global_scale DECIMAL(3,2) DEFAULT 1.0,
  user_scale DECIMAL(3,2) DEFAULT 1.0,
  auto_selection_enabled BOOLEAN DEFAULT true,
  rollback_enabled BOOLEAN DEFAULT true,
  warmup_enabled BOOLEAN DEFAULT true,
  warmup_interval_minutes INTEGER DEFAULT 15,
  max_adapters_in_memory INTEGER DEFAULT 50,
  lru_eviction_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- RLS for lora_config
ALTER TABLE lora_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY lora_config_tenant_isolation ON lora_config
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY lora_config_insert ON lora_config
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY lora_config_update ON lora_config
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- =============================================================================
-- LoRA Adapters Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS lora_adapters (
  adapter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  adapter_name VARCHAR(255) NOT NULL,
  adapter_layer VARCHAR(50) NOT NULL CHECK (adapter_layer IN ('global', 'user', 'domain')),
  base_model VARCHAR(255) NOT NULL,
  s3_key TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  scale DECIMAL(3,2) DEFAULT 1.0,
  load_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lora_adapters_tenant ON lora_adapters(tenant_id);
CREATE INDEX idx_lora_adapters_layer ON lora_adapters(adapter_layer);
CREATE INDEX idx_lora_adapters_active ON lora_adapters(is_active) WHERE is_active = true;

-- RLS for lora_adapters
ALTER TABLE lora_adapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY lora_adapters_tenant_isolation ON lora_adapters
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- =============================================================================
-- LoRA Invocations Log
-- =============================================================================
CREATE TABLE IF NOT EXISTS lora_invocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  adapter_id UUID REFERENCES lora_adapters(adapter_id) ON DELETE SET NULL,
  user_id UUID,
  model_id VARCHAR(255) NOT NULL,
  adapters_used INTEGER DEFAULT 1,
  global_adapter_id UUID,
  user_adapter_id UUID,
  latency_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lora_invocations_tenant ON lora_invocations(tenant_id);
CREATE INDEX idx_lora_invocations_adapter ON lora_invocations(adapter_id);
CREATE INDEX idx_lora_invocations_created ON lora_invocations(created_at);

-- RLS for lora_invocations
ALTER TABLE lora_invocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY lora_invocations_tenant_isolation ON lora_invocations
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- =============================================================================
-- LoRA Warmup Log
-- =============================================================================
CREATE TABLE IF NOT EXISTS lora_warmup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger_type VARCHAR(50) NOT NULL, -- 'boot', 'schedule', 'manual'
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  adapters_warmed INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_lora_warmup_tenant ON lora_warmup_log(tenant_id);
CREATE INDEX idx_lora_warmup_created ON lora_warmup_log(created_at);

-- RLS for lora_warmup_log
ALTER TABLE lora_warmup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY lora_warmup_tenant_isolation ON lora_warmup_log
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 5. ADD UNIQUE CONSTRAINT TO knowledge_entities FOR SKILL UPSERTS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_entities_tenant_type_name_unique'
  ) THEN
    -- Create a partial unique index for skills
    CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_entities_skill_unique 
    ON knowledge_entities(tenant_id, entity_type, name) 
    WHERE entity_type = 'skill';
  END IF;
END $$;

-- ============================================================================
-- 6. EMPIRICISM METRICS VIEW
-- Dashboard view for consciousness metrics
-- ============================================================================

CREATE OR REPLACE VIEW empiricism_metrics AS
SELECT 
  tenant_id,
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE success) as successful,
  COUNT(*) FILTER (WHERE NOT success) as failed,
  AVG(surprise_level) as avg_surprise,
  AVG(prediction_error) as avg_prediction_error,
  AVG(confidence_delta) as avg_confidence_impact,
  AVG(frustration_delta) as avg_frustration_impact,
  COUNT(*) FILTER (WHERE rethink_cycle > 0) as rethink_triggered
FROM sandbox_execution_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY tenant_id, DATE_TRUNC('hour', created_at);

COMMENT ON VIEW empiricism_metrics IS 'Hourly consciousness metrics for the Empiricism Loop';
