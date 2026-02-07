-- ============================================================================
-- RADIANT Genesis Cato Advanced Configuration
-- Migration: 154_cato_advanced_config.sql
-- 
-- Adds configurable parameters for:
-- - Redis/ElastiCache settings
-- - CloudWatch integration
-- - Async entropy processing (SQS/DynamoDB)
-- - Fracture detection weights
-- ============================================================================

-- Add new columns to cato_tenant_config for advanced settings
ALTER TABLE cato_tenant_config
  -- Redis/State Management settings
  ADD COLUMN IF NOT EXISTS enable_redis BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS redis_rejection_ttl_seconds INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS redis_persona_override_ttl_seconds INTEGER DEFAULT 300,
  ADD COLUMN IF NOT EXISTS redis_recovery_state_ttl_seconds INTEGER DEFAULT 600,
  
  -- CloudWatch Integration settings
  ADD COLUMN IF NOT EXISTS enable_cloudwatch_veto_sync BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS cloudwatch_sync_interval_seconds INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS cloudwatch_alarm_mappings JSONB DEFAULT '{}',
  
  -- Async Entropy settings
  ADD COLUMN IF NOT EXISTS enable_async_entropy BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS entropy_async_threshold NUMERIC(5,4) DEFAULT 0.6,
  ADD COLUMN IF NOT EXISTS entropy_job_ttl_hours INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS entropy_max_concurrent_jobs INTEGER DEFAULT 10,
  
  -- Fracture Detection Weights (must sum to 1.0)
  ADD COLUMN IF NOT EXISTS fracture_word_overlap_weight NUMERIC(5,4) DEFAULT 0.20,
  ADD COLUMN IF NOT EXISTS fracture_intent_keyword_weight NUMERIC(5,4) DEFAULT 0.25,
  ADD COLUMN IF NOT EXISTS fracture_sentiment_weight NUMERIC(5,4) DEFAULT 0.15,
  ADD COLUMN IF NOT EXISTS fracture_topic_coherence_weight NUMERIC(5,4) DEFAULT 0.20,
  ADD COLUMN IF NOT EXISTS fracture_completeness_weight NUMERIC(5,4) DEFAULT 0.20,
  ADD COLUMN IF NOT EXISTS fracture_alignment_threshold NUMERIC(5,4) DEFAULT 0.40,
  ADD COLUMN IF NOT EXISTS fracture_evasion_threshold NUMERIC(5,4) DEFAULT 0.60,
  
  -- Control Barrier settings
  ADD COLUMN IF NOT EXISTS cbf_authorization_check_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS cbf_baa_verification_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS cbf_cost_alternative_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS cbf_max_cost_reduction_percent NUMERIC(5,2) DEFAULT 50.00;

-- Add constraint for fracture weights summing to 1.0 (with small tolerance)
ALTER TABLE cato_tenant_config
  ADD CONSTRAINT chk_fracture_weights_sum CHECK (
    ABS(
      COALESCE(fracture_word_overlap_weight, 0.20) +
      COALESCE(fracture_intent_keyword_weight, 0.25) +
      COALESCE(fracture_sentiment_weight, 0.15) +
      COALESCE(fracture_topic_coherence_weight, 0.20) +
      COALESCE(fracture_completeness_weight, 0.20) - 1.0
    ) < 0.01
  );

-- ============================================================================
-- CloudWatch Alarm Mapping Table
-- Stores the mapping between CloudWatch alarms and Cato veto signals
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_cloudwatch_alarm_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Alarm identification
  alarm_name VARCHAR(255) NOT NULL,
  alarm_name_pattern VARCHAR(255), -- Optional regex pattern for dynamic matching
  
  -- Veto signal mapping
  veto_signal VARCHAR(50) NOT NULL,
  veto_severity VARCHAR(20) NOT NULL CHECK (veto_severity IN ('warning', 'critical', 'emergency')),
  
  -- Configuration
  is_enabled BOOLEAN DEFAULT TRUE,
  auto_clear_on_ok BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (tenant_id, alarm_name)
);

-- Seed default alarm mappings (global scope)
INSERT INTO cato_cloudwatch_alarm_mappings (tenant_id, alarm_name, veto_signal, veto_severity, description)
SELECT 
  t.id,
  alarm.name,
  alarm.signal,
  alarm.severity,
  alarm.description
FROM tenants t
CROSS JOIN (VALUES
  ('radiant-system-cpu-critical', 'SYSTEM_OVERLOAD', 'emergency', 'Critical CPU usage alarm'),
  ('radiant-system-memory-critical', 'SYSTEM_OVERLOAD', 'emergency', 'Critical memory usage alarm'),
  ('radiant-security-breach', 'DATA_BREACH_DETECTED', 'emergency', 'Security breach detection'),
  ('radiant-compliance-alert', 'COMPLIANCE_VIOLATION', 'critical', 'Compliance violation detected'),
  ('radiant-anomaly-detection', 'ANOMALY_DETECTED', 'warning', 'Behavioral anomaly detected'),
  ('radiant-model-health', 'MODEL_UNAVAILABLE', 'warning', 'Model health check failure')
) AS alarm(name, signal, severity, description)
ON CONFLICT (tenant_id, alarm_name) DO NOTHING;

-- ============================================================================
-- Async Entropy Jobs Table
-- Tracks background entropy check jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_entropy_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  
  -- Job details
  job_id VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Input
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  model VARCHAR(100),
  check_mode VARCHAR(20) NOT NULL,
  
  -- Results (populated when completed)
  entropy_score NUMERIC(5,4),
  consistency NUMERIC(5,4),
  is_potential_deception BOOLEAN,
  deception_indicators JSONB,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entropy_jobs_tenant ON cato_entropy_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_entropy_jobs_status ON cato_entropy_jobs(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_entropy_jobs_job_id ON cato_entropy_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_entropy_jobs_expires ON cato_entropy_jobs(expires_at) WHERE status = 'completed';

-- ============================================================================
-- CloudWatch Sync Log
-- Tracks CloudWatch synchronization events
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_cloudwatch_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for global syncs
  
  -- Sync details
  sync_type VARCHAR(20) NOT NULL CHECK (sync_type IN ('scheduled', 'manual', 'alarm_event')),
  alarms_checked INTEGER,
  alarms_in_alarm INTEGER,
  vetos_activated INTEGER,
  vetos_cleared INTEGER,
  
  -- Status
  success BOOLEAN NOT NULL,
  error_message TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cw_sync_tenant ON cato_cloudwatch_sync_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cw_sync_time ON cato_cloudwatch_sync_log(started_at DESC);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE cato_cloudwatch_alarm_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_entropy_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_cloudwatch_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY alarm_mappings_tenant_isolation ON cato_cloudwatch_alarm_mappings
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY entropy_jobs_tenant_isolation ON cato_entropy_jobs
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY cw_sync_tenant_isolation ON cato_cloudwatch_sync_log
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN cato_tenant_config.enable_redis IS 'Enable Redis/ElastiCache for state persistence (falls back to in-memory)';
COMMENT ON COLUMN cato_tenant_config.redis_rejection_ttl_seconds IS 'TTL for rejection history entries in Redis';
COMMENT ON COLUMN cato_tenant_config.redis_persona_override_ttl_seconds IS 'TTL for persona override entries in Redis';
COMMENT ON COLUMN cato_tenant_config.redis_recovery_state_ttl_seconds IS 'TTL for recovery state entries in Redis';

COMMENT ON COLUMN cato_tenant_config.enable_cloudwatch_veto_sync IS 'Enable automatic veto activation from CloudWatch alarms';
COMMENT ON COLUMN cato_tenant_config.cloudwatch_sync_interval_seconds IS 'How often to sync CloudWatch alarm states';
COMMENT ON COLUMN cato_tenant_config.cloudwatch_alarm_mappings IS 'JSON mapping of custom alarm names to veto signals';

COMMENT ON COLUMN cato_tenant_config.enable_async_entropy IS 'Enable asynchronous entropy checks via SQS';
COMMENT ON COLUMN cato_tenant_config.entropy_async_threshold IS 'Entropy score threshold above which to trigger async deep analysis';
COMMENT ON COLUMN cato_tenant_config.entropy_job_ttl_hours IS 'How long to keep completed entropy job results';
COMMENT ON COLUMN cato_tenant_config.entropy_max_concurrent_jobs IS 'Maximum concurrent async entropy jobs per tenant';

COMMENT ON COLUMN cato_tenant_config.fracture_word_overlap_weight IS 'Weight for word overlap in fracture detection (0-1)';
COMMENT ON COLUMN cato_tenant_config.fracture_intent_keyword_weight IS 'Weight for intent keyword matching in fracture detection (0-1)';
COMMENT ON COLUMN cato_tenant_config.fracture_sentiment_weight IS 'Weight for sentiment alignment in fracture detection (0-1)';
COMMENT ON COLUMN cato_tenant_config.fracture_topic_coherence_weight IS 'Weight for topic coherence in fracture detection (0-1)';
COMMENT ON COLUMN cato_tenant_config.fracture_completeness_weight IS 'Weight for response completeness in fracture detection (0-1)';
COMMENT ON COLUMN cato_tenant_config.fracture_alignment_threshold IS 'Alignment score below which a fracture is detected';
COMMENT ON COLUMN cato_tenant_config.fracture_evasion_threshold IS 'Evasion score above which a fracture is detected';

COMMENT ON COLUMN cato_tenant_config.cbf_authorization_check_enabled IS 'Enable model authorization checks in CBF';
COMMENT ON COLUMN cato_tenant_config.cbf_baa_verification_enabled IS 'Enable BAA verification in CBF for PHI';
COMMENT ON COLUMN cato_tenant_config.cbf_cost_alternative_enabled IS 'Enable cheaper model alternatives when cost barriers trigger';
COMMENT ON COLUMN cato_tenant_config.cbf_max_cost_reduction_percent IS 'Maximum cost reduction percentage when finding cheaper alternatives';

COMMENT ON TABLE cato_cloudwatch_alarm_mappings IS 'Maps CloudWatch alarms to Cato veto signals';
COMMENT ON TABLE cato_entropy_jobs IS 'Tracks asynchronous entropy check jobs';
COMMENT ON TABLE cato_cloudwatch_sync_log IS 'Audit log for CloudWatch synchronization events';
