-- RADIANT v5.38.0 - Sovereign Mesh Performance Optimization
-- Migration: V2026_01_21_001__sovereign_mesh_performance.sql
-- 
-- Adds performance configuration tables, indexes, and archival support
-- for Sovereign Mesh at scale.

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE scaling_strategy AS ENUM ('fixed', 'auto', 'scheduled');
CREATE TYPE tenant_isolation_mode AS ENUM ('shared', 'dedicated', 'fifo');
CREATE TYPE cache_backend AS ENUM ('memory', 'redis', 'elasticache');
CREATE TYPE artifact_storage_backend AS ENUM ('database', 's3', 'hybrid');
CREATE TYPE performance_alert_type AS ENUM (
  'dlq_threshold', 
  'latency_threshold', 
  'budget_threshold', 
  'error_rate', 
  'queue_backlog'
);
CREATE TYPE performance_alert_severity AS ENUM ('warning', 'critical');

-- ============================================================================
-- PERFORMANCE CONFIGURATION TABLE
-- ============================================================================

CREATE TABLE sovereign_mesh_performance_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Lambda Configuration (Agent Worker)
  agent_worker_reserved_concurrency INTEGER NOT NULL DEFAULT 0,
  agent_worker_provisioned_concurrency INTEGER NOT NULL DEFAULT 5,
  agent_worker_max_concurrency INTEGER NOT NULL DEFAULT 50,
  agent_worker_memory_mb INTEGER NOT NULL DEFAULT 2048,
  agent_worker_timeout_seconds INTEGER NOT NULL DEFAULT 900,
  
  -- Lambda Configuration (Transparency Worker)
  transparency_worker_reserved_concurrency INTEGER NOT NULL DEFAULT 0,
  transparency_worker_provisioned_concurrency INTEGER NOT NULL DEFAULT 0,
  transparency_worker_max_concurrency INTEGER NOT NULL DEFAULT 20,
  transparency_worker_memory_mb INTEGER NOT NULL DEFAULT 512,
  transparency_worker_timeout_seconds INTEGER NOT NULL DEFAULT 300,
  
  -- Queue Configuration (Agent Execution)
  agent_queue_visibility_timeout_seconds INTEGER NOT NULL DEFAULT 900,
  agent_queue_retention_days INTEGER NOT NULL DEFAULT 7,
  agent_queue_max_receive_count INTEGER NOT NULL DEFAULT 3,
  agent_queue_batch_size INTEGER NOT NULL DEFAULT 1,
  agent_queue_fifo_enabled BOOLEAN NOT NULL DEFAULT false,
  agent_queue_content_dedup BOOLEAN NOT NULL DEFAULT false,
  
  -- Queue Configuration (Transparency)
  transparency_queue_visibility_timeout_seconds INTEGER NOT NULL DEFAULT 300,
  transparency_queue_retention_days INTEGER NOT NULL DEFAULT 7,
  transparency_queue_max_receive_count INTEGER NOT NULL DEFAULT 3,
  transparency_queue_batch_size INTEGER NOT NULL DEFAULT 5,
  transparency_queue_fifo_enabled BOOLEAN NOT NULL DEFAULT false,
  transparency_queue_content_dedup BOOLEAN NOT NULL DEFAULT false,
  
  -- Scaling Configuration
  scaling_strategy scaling_strategy NOT NULL DEFAULT 'auto',
  scaling_min_instances INTEGER NOT NULL DEFAULT 1,
  scaling_max_instances INTEGER NOT NULL DEFAULT 100,
  scaling_target_utilization INTEGER NOT NULL DEFAULT 70,
  scaling_scale_in_cooldown_seconds INTEGER NOT NULL DEFAULT 300,
  scaling_scale_out_cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  
  -- Cache Configuration (Agent)
  agent_cache_backend cache_backend NOT NULL DEFAULT 'redis',
  agent_cache_default_ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  agent_cache_max_entries INTEGER NOT NULL DEFAULT 10000,
  agent_cache_compression_enabled BOOLEAN NOT NULL DEFAULT true,
  agent_cache_compression_threshold_bytes INTEGER NOT NULL DEFAULT 1024,
  agent_cache_agent_ttl_seconds INTEGER NOT NULL DEFAULT 300,
  agent_cache_execution_state_ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  agent_cache_working_memory_ttl_seconds INTEGER NOT NULL DEFAULT 86400,
  agent_cache_warm_on_startup BOOLEAN NOT NULL DEFAULT true,
  
  -- Cache Configuration (Execution)
  execution_cache_backend cache_backend NOT NULL DEFAULT 'redis',
  execution_cache_default_ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  execution_cache_max_entries INTEGER NOT NULL DEFAULT 50000,
  execution_cache_compression_enabled BOOLEAN NOT NULL DEFAULT true,
  execution_cache_compression_threshold_bytes INTEGER NOT NULL DEFAULT 1024,
  execution_cache_hot_state_enabled BOOLEAN NOT NULL DEFAULT true,
  execution_cache_write_through_enabled BOOLEAN NOT NULL DEFAULT false,
  execution_cache_write_behind_delay_ms INTEGER NOT NULL DEFAULT 1000,
  execution_cache_write_behind_batch_size INTEGER NOT NULL DEFAULT 100,
  
  -- Artifact Archival Configuration
  artifact_storage_backend artifact_storage_backend NOT NULL DEFAULT 'hybrid',
  artifact_s3_bucket TEXT,
  artifact_s3_prefix TEXT DEFAULT 'sovereign-mesh/artifacts/',
  artifact_archive_after_days INTEGER NOT NULL DEFAULT 7,
  artifact_delete_after_days INTEGER NOT NULL DEFAULT 90,
  artifact_max_db_bytes INTEGER NOT NULL DEFAULT 65536,
  artifact_compression_enabled BOOLEAN NOT NULL DEFAULT true,
  artifact_compression_algorithm TEXT NOT NULL DEFAULT 'gzip',
  
  -- Database Pool Configuration
  db_pool_min_connections INTEGER NOT NULL DEFAULT 2,
  db_pool_max_connections INTEGER NOT NULL DEFAULT 20,
  db_pool_idle_timeout_seconds INTEGER NOT NULL DEFAULT 300,
  db_pool_acquire_timeout_seconds INTEGER NOT NULL DEFAULT 30,
  db_pool_rds_proxy_enabled BOOLEAN NOT NULL DEFAULT true,
  db_pool_rds_proxy_endpoint TEXT,
  
  -- Tenant Isolation Configuration
  tenant_isolation_mode tenant_isolation_mode NOT NULL DEFAULT 'shared',
  tenant_dedicated_queue_threshold INTEGER NOT NULL DEFAULT 1000,
  tenant_rate_limiting_enabled BOOLEAN NOT NULL DEFAULT true,
  tenant_max_concurrent_per_tenant INTEGER NOT NULL DEFAULT 50,
  tenant_max_concurrent_per_user INTEGER NOT NULL DEFAULT 10,
  tenant_priority_queue_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Metrics Configuration
  metrics_cloudwatch_enabled BOOLEAN NOT NULL DEFAULT true,
  metrics_cloudwatch_namespace TEXT NOT NULL DEFAULT 'RADIANT/SovereignMesh',
  metrics_xray_enabled BOOLEAN NOT NULL DEFAULT true,
  metrics_xray_sampling_rate DECIMAL(3,2) NOT NULL DEFAULT 0.10,
  metrics_ooda_phase_enabled BOOLEAN NOT NULL DEFAULT true,
  metrics_flush_interval_seconds INTEGER NOT NULL DEFAULT 60,
  
  -- Alert Configuration
  alert_dlq_enabled BOOLEAN NOT NULL DEFAULT true,
  alert_dlq_threshold INTEGER NOT NULL DEFAULT 10,
  alert_latency_enabled BOOLEAN NOT NULL DEFAULT true,
  alert_latency_threshold_ms INTEGER NOT NULL DEFAULT 30000,
  alert_budget_enabled BOOLEAN NOT NULL DEFAULT true,
  alert_budget_threshold_percent INTEGER NOT NULL DEFAULT 80,
  alert_sns_topic_arn TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  
  CONSTRAINT unique_tenant_config UNIQUE (tenant_id)
);

-- ============================================================================
-- PERFORMANCE ALERTS TABLE
-- ============================================================================

CREATE TABLE sovereign_mesh_performance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  alert_type performance_alert_type NOT NULL,
  severity performance_alert_severity NOT NULL,
  message TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  threshold_value DECIMAL(15,4) NOT NULL,
  current_value DECIMAL(15,4) NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  auto_resolved BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_perf_alerts_tenant_status ON sovereign_mesh_performance_alerts(tenant_id, resolved_at NULLS FIRST);
CREATE INDEX idx_perf_alerts_triggered ON sovereign_mesh_performance_alerts(triggered_at DESC);

-- ============================================================================
-- PERFORMANCE METRICS TABLE (Time-series)
-- ============================================================================

CREATE TABLE sovereign_mesh_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Execution Metrics
  active_executions INTEGER NOT NULL DEFAULT 0,
  pending_executions INTEGER NOT NULL DEFAULT 0,
  completed_executions INTEGER NOT NULL DEFAULT 0,
  failed_executions INTEGER NOT NULL DEFAULT 0,
  cancelled_executions INTEGER NOT NULL DEFAULT 0,
  
  -- Queue Metrics
  agent_queue_messages INTEGER NOT NULL DEFAULT 0,
  agent_queue_messages_not_visible INTEGER NOT NULL DEFAULT 0,
  agent_queue_dlq_messages INTEGER NOT NULL DEFAULT 0,
  transparency_queue_messages INTEGER NOT NULL DEFAULT 0,
  transparency_queue_dlq_messages INTEGER NOT NULL DEFAULT 0,
  
  -- Cache Metrics
  agent_cache_hits INTEGER NOT NULL DEFAULT 0,
  agent_cache_misses INTEGER NOT NULL DEFAULT 0,
  execution_cache_hits INTEGER NOT NULL DEFAULT 0,
  execution_cache_misses INTEGER NOT NULL DEFAULT 0,
  
  -- Latency Metrics (milliseconds)
  avg_execution_duration_ms DECIMAL(15,2),
  p50_execution_duration_ms DECIMAL(15,2),
  p95_execution_duration_ms DECIMAL(15,2),
  p99_execution_duration_ms DECIMAL(15,2),
  
  -- OODA Phase Metrics
  observe_phase_count INTEGER NOT NULL DEFAULT 0,
  observe_phase_avg_ms DECIMAL(15,2),
  orient_phase_count INTEGER NOT NULL DEFAULT 0,
  orient_phase_avg_ms DECIMAL(15,2),
  decide_phase_count INTEGER NOT NULL DEFAULT 0,
  decide_phase_avg_ms DECIMAL(15,2),
  act_phase_count INTEGER NOT NULL DEFAULT 0,
  act_phase_avg_ms DECIMAL(15,2),
  
  -- Cost Metrics
  lambda_cost_usd DECIMAL(10,4) NOT NULL DEFAULT 0,
  sqs_cost_usd DECIMAL(10,4) NOT NULL DEFAULT 0,
  cache_cost_usd DECIMAL(10,4) NOT NULL DEFAULT 0,
  storage_cost_usd DECIMAL(10,4) NOT NULL DEFAULT 0
);

-- Use BRIN index for time-series data (more efficient for append-only)
CREATE INDEX idx_perf_metrics_tenant_time ON sovereign_mesh_performance_metrics 
  USING BRIN (tenant_id, metric_time);

-- ============================================================================
-- ARTIFACT ARCHIVE TABLE
-- ============================================================================

CREATE TABLE sovereign_mesh_artifact_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  execution_id UUID NOT NULL,
  original_snapshot_id UUID,
  
  -- Archive Location
  storage_backend artifact_storage_backend NOT NULL,
  s3_bucket TEXT,
  s3_key TEXT,
  
  -- Artifact Metadata
  artifact_type TEXT NOT NULL,
  original_size_bytes BIGINT NOT NULL,
  compressed_size_bytes BIGINT,
  compression_algorithm TEXT,
  checksum_sha256 TEXT NOT NULL,
  
  -- Archive Metadata
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  
  -- Original data (for small artifacts stored in DB)
  artifact_data BYTEA
);

CREATE INDEX idx_artifact_archives_tenant_execution ON sovereign_mesh_artifact_archives(tenant_id, execution_id);
CREATE INDEX idx_artifact_archives_expires ON sovereign_mesh_artifact_archives(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- DEDICATED TENANT QUEUES TABLE
-- ============================================================================

CREATE TABLE sovereign_mesh_tenant_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  queue_type TEXT NOT NULL, -- 'agent_execution' or 'transparency'
  queue_url TEXT NOT NULL,
  queue_arn TEXT NOT NULL,
  dlq_url TEXT,
  dlq_arn TEXT,
  
  is_fifo BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  
  CONSTRAINT unique_tenant_queue_type UNIQUE (tenant_id, queue_type)
);

-- ============================================================================
-- RATE LIMITING TABLE
-- ============================================================================

CREATE TABLE sovereign_mesh_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  
  window_start TIMESTAMPTZ NOT NULL,
  window_size_seconds INTEGER NOT NULL DEFAULT 60,
  
  execution_count INTEGER NOT NULL DEFAULT 0,
  token_count BIGINT NOT NULL DEFAULT 0,
  
  CONSTRAINT unique_rate_limit_window UNIQUE (tenant_id, user_id, window_start, window_size_seconds)
);

CREATE INDEX idx_rate_limits_tenant_window ON sovereign_mesh_rate_limits(tenant_id, window_start DESC);

-- ============================================================================
-- CONFIG CHANGE HISTORY TABLE
-- ============================================================================

CREATE TABLE sovereign_mesh_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  config_snapshot JSONB NOT NULL,
  change_description TEXT,
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  
  applied_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ,
  rollback_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_config_history_tenant ON sovereign_mesh_config_history(tenant_id, created_at DESC);

-- ============================================================================
-- PERFORMANCE INDEXES ON EXISTING TABLES
-- ============================================================================

-- Index for fast tenant+status queries on agent_executions
CREATE INDEX IF NOT EXISTS idx_agent_executions_tenant_status 
  ON agent_executions(tenant_id, status);

-- Index for fast agent+status queries on agent_executions
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_status 
  ON agent_executions(agent_id, status);

-- Index for time-based queries on agent_executions
CREATE INDEX IF NOT EXISTS idx_agent_executions_created_at 
  ON agent_executions(created_at DESC);

-- Partial index for running executions only (very efficient for monitoring)
CREATE INDEX IF NOT EXISTS idx_agent_executions_running 
  ON agent_executions(tenant_id, started_at) 
  WHERE status = 'running';

-- Partial index for pending executions
CREATE INDEX IF NOT EXISTS idx_agent_executions_pending 
  ON agent_executions(tenant_id, created_at) 
  WHERE status = 'pending';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to calculate cache hit rate
CREATE OR REPLACE FUNCTION calculate_cache_hit_rate(hits INTEGER, misses INTEGER)
RETURNS DECIMAL(5,4) AS $$
BEGIN
  IF hits + misses = 0 THEN
    RETURN 0;
  END IF;
  RETURN hits::DECIMAL / (hits + misses);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get active execution count for rate limiting
CREATE OR REPLACE FUNCTION get_active_execution_count(
  p_tenant_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM agent_executions
    WHERE tenant_id = p_tenant_id
      AND status IN ('pending', 'running', 'paused');
  ELSE
    SELECT COUNT(*) INTO v_count
    FROM agent_executions
    WHERE tenant_id = p_tenant_id
      AND user_id = p_user_id
      AND status IN ('pending', 'running', 'paused');
  END IF;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if execution is allowed (rate limiting)
CREATE OR REPLACE FUNCTION can_start_execution(
  p_tenant_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT,
  current_count INTEGER,
  max_allowed INTEGER
) AS $$
DECLARE
  v_config sovereign_mesh_performance_config%ROWTYPE;
  v_tenant_count INTEGER;
  v_user_count INTEGER;
BEGIN
  -- Get config
  SELECT * INTO v_config
  FROM sovereign_mesh_performance_config
  WHERE tenant_id = p_tenant_id;
  
  -- Use defaults if no config
  IF v_config.id IS NULL THEN
    v_config.tenant_max_concurrent_per_tenant := 50;
    v_config.tenant_max_concurrent_per_user := 10;
    v_config.tenant_rate_limiting_enabled := true;
  END IF;
  
  -- Skip if rate limiting disabled
  IF NOT v_config.tenant_rate_limiting_enabled THEN
    RETURN QUERY SELECT true, NULL::TEXT, 0, 0;
    RETURN;
  END IF;
  
  -- Check tenant limit
  v_tenant_count := get_active_execution_count(p_tenant_id);
  IF v_tenant_count >= v_config.tenant_max_concurrent_per_tenant THEN
    RETURN QUERY SELECT 
      false, 
      'Tenant concurrent execution limit reached',
      v_tenant_count,
      v_config.tenant_max_concurrent_per_tenant;
    RETURN;
  END IF;
  
  -- Check user limit if user specified
  IF p_user_id IS NOT NULL THEN
    v_user_count := get_active_execution_count(p_tenant_id, p_user_id);
    IF v_user_count >= v_config.tenant_max_concurrent_per_user THEN
      RETURN QUERY SELECT 
        false, 
        'User concurrent execution limit reached',
        v_user_count,
        v_config.tenant_max_concurrent_per_user;
      RETURN;
    END IF;
  END IF;
  
  RETURN QUERY SELECT true, NULL::TEXT, v_tenant_count, v_config.tenant_max_concurrent_per_tenant;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on config changes
CREATE OR REPLACE FUNCTION update_perf_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_perf_config_timestamp
  BEFORE UPDATE ON sovereign_mesh_performance_config
  FOR EACH ROW
  EXECUTE FUNCTION update_perf_config_timestamp();

-- Auto-create performance alert when DLQ threshold exceeded
CREATE OR REPLACE FUNCTION check_dlq_threshold()
RETURNS TRIGGER AS $$
DECLARE
  v_config sovereign_mesh_performance_config%ROWTYPE;
BEGIN
  -- Only check on DLQ increase
  IF NEW.agent_queue_dlq_messages <= OLD.agent_queue_dlq_messages THEN
    RETURN NEW;
  END IF;
  
  SELECT * INTO v_config
  FROM sovereign_mesh_performance_config
  WHERE tenant_id = NEW.tenant_id;
  
  IF v_config.alert_dlq_enabled AND 
     NEW.agent_queue_dlq_messages >= v_config.alert_dlq_threshold THEN
    INSERT INTO sovereign_mesh_performance_alerts (
      tenant_id, alert_type, severity, message, metric_name,
      threshold_value, current_value
    ) VALUES (
      NEW.tenant_id,
      'dlq_threshold',
      CASE WHEN NEW.agent_queue_dlq_messages >= v_config.alert_dlq_threshold * 2 
           THEN 'critical' ELSE 'warning' END,
      format('DLQ message count (%s) exceeded threshold (%s)', 
             NEW.agent_queue_dlq_messages, v_config.alert_dlq_threshold),
      'agent_queue_dlq_messages',
      v_config.alert_dlq_threshold,
      NEW.agent_queue_dlq_messages
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_dlq_threshold
  AFTER UPDATE ON sovereign_mesh_performance_metrics
  FOR EACH ROW
  EXECUTE FUNCTION check_dlq_threshold();

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE sovereign_mesh_performance_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_mesh_performance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_mesh_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_mesh_artifact_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_mesh_tenant_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_mesh_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_mesh_config_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_perf_config ON sovereign_mesh_performance_config
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_perf_alerts ON sovereign_mesh_performance_alerts
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_perf_metrics ON sovereign_mesh_performance_metrics
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_artifact_archives ON sovereign_mesh_artifact_archives
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_tenant_queues ON sovereign_mesh_tenant_queues
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_rate_limits ON sovereign_mesh_rate_limits
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_config_history ON sovereign_mesh_config_history
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- SEED DEFAULT SYSTEM CONFIG
-- ============================================================================

-- Insert default system-level configuration (for reference/fallback)
INSERT INTO sovereign_mesh_performance_config (
  id,
  tenant_id,
  created_by
) SELECT 
  '00000000-0000-0000-0000-000000000001'::UUID,
  id,
  NULL
FROM tenants 
WHERE slug = 'system'
ON CONFLICT DO NOTHING;
