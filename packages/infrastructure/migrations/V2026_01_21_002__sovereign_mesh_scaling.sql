-- ============================================================================
-- RADIANT v5.38.0 - Sovereign Mesh Scaling Infrastructure
-- 
-- Comprehensive scaling configuration for 500K+ concurrent sessions
-- with cost tracking, session management, and auto-scaling rules.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE scaling_tier AS ENUM ('development', 'staging', 'production', 'enterprise');
CREATE TYPE scaling_mode AS ENUM ('manual', 'auto', 'scheduled', 'predictive');
CREATE TYPE scaling_operation_type AS ENUM (
  'scale_up', 'scale_down', 'scale_out', 'scale_in',
  'provision', 'deprovision', 'migrate_region', 'enable_feature', 'disable_feature'
);
CREATE TYPE scaling_operation_status AS ENUM (
  'pending', 'in_progress', 'completed', 'failed', 'rolled_back', 'cancelled'
);
CREATE TYPE component_status AS ENUM ('healthy', 'degraded', 'unhealthy');

-- ============================================================================
-- SCALING PROFILES
-- ============================================================================

CREATE TABLE sovereign_mesh_scaling_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  tier scaling_tier NOT NULL DEFAULT 'production',
  target_sessions INTEGER NOT NULL DEFAULT 10000,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  
  -- Lambda Configuration
  lambda_reserved_concurrency INTEGER NOT NULL DEFAULT 100,
  lambda_provisioned_concurrency INTEGER NOT NULL DEFAULT 5,
  lambda_max_concurrency INTEGER NOT NULL DEFAULT 200,
  lambda_memory_mb INTEGER NOT NULL DEFAULT 2048,
  lambda_timeout_seconds INTEGER NOT NULL DEFAULT 900,
  lambda_ephemeral_storage_mb INTEGER NOT NULL DEFAULT 1024,
  lambda_snap_start_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Aurora Configuration
  aurora_min_capacity_acu DECIMAL(5,2) NOT NULL DEFAULT 4.0,
  aurora_max_capacity_acu DECIMAL(5,2) NOT NULL DEFAULT 64.0,
  aurora_read_replica_count INTEGER NOT NULL DEFAULT 2,
  aurora_enable_global_database BOOLEAN NOT NULL DEFAULT false,
  aurora_secondary_regions TEXT[] DEFAULT '{}',
  aurora_connection_pool_size INTEGER NOT NULL DEFAULT 200,
  aurora_enable_pgbouncer BOOLEAN NOT NULL DEFAULT true,
  
  -- Redis Configuration
  redis_node_type VARCHAR(50) NOT NULL DEFAULT 'cache.r6g.large',
  redis_num_shards INTEGER NOT NULL DEFAULT 1,
  redis_replicas_per_shard INTEGER NOT NULL DEFAULT 2,
  redis_enable_cluster_mode BOOLEAN NOT NULL DEFAULT false,
  redis_enable_global_datastore BOOLEAN NOT NULL DEFAULT false,
  redis_secondary_regions TEXT[] DEFAULT '{}',
  redis_max_connections INTEGER NOT NULL DEFAULT 65000,
  
  -- API Gateway Configuration
  api_throttling_rate_limit INTEGER NOT NULL DEFAULT 10000,
  api_throttling_burst_limit INTEGER NOT NULL DEFAULT 20000,
  api_enable_edge_optimized BOOLEAN NOT NULL DEFAULT true,
  api_enable_cloudfront BOOLEAN NOT NULL DEFAULT true,
  api_regional_endpoints TEXT[] DEFAULT ARRAY['us-east-1'],
  
  -- SQS Configuration
  sqs_standard_queue_count INTEGER NOT NULL DEFAULT 10,
  sqs_fifo_queue_count INTEGER NOT NULL DEFAULT 5,
  sqs_max_message_size INTEGER NOT NULL DEFAULT 262144,
  sqs_visibility_timeout_seconds INTEGER NOT NULL DEFAULT 900,
  sqs_message_retention_days INTEGER NOT NULL DEFAULT 14,
  sqs_enable_batching BOOLEAN NOT NULL DEFAULT true,
  sqs_batch_size INTEGER NOT NULL DEFAULT 10,
  
  -- Cost Tracking
  estimated_monthly_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  actual_monthly_cost DECIMAL(10,2),
  cost_last_calculated_at TIMESTAMPTZ,
  
  -- Metadata
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_scaling_profiles_tenant ON sovereign_mesh_scaling_profiles(tenant_id);
CREATE INDEX idx_scaling_profiles_active ON sovereign_mesh_scaling_profiles(tenant_id) WHERE is_active = true;
CREATE INDEX idx_scaling_profiles_tier ON sovereign_mesh_scaling_profiles(tier);

-- ============================================================================
-- SESSION TRACKING
-- ============================================================================

CREATE TABLE sovereign_mesh_session_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Current State
  active_sessions INTEGER NOT NULL DEFAULT 0,
  pending_sessions INTEGER NOT NULL DEFAULT 0,
  completed_sessions INTEGER NOT NULL DEFAULT 0,
  failed_sessions INTEGER NOT NULL DEFAULT 0,
  
  -- Capacity
  max_sessions INTEGER NOT NULL DEFAULT 10000,
  utilization_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  
  -- By Region
  sessions_by_region JSONB DEFAULT '{}',
  
  -- Latency
  avg_session_duration_ms INTEGER,
  p50_latency_ms INTEGER,
  p95_latency_ms INTEGER,
  p99_latency_ms INTEGER,
  
  -- Component Utilization
  lambda_utilization DECIMAL(5,2),
  aurora_utilization DECIMAL(5,2),
  redis_utilization DECIMAL(5,2),
  api_gateway_utilization DECIMAL(5,2),
  sqs_utilization DECIMAL(5,2)
);

CREATE INDEX idx_session_metrics_tenant_time ON sovereign_mesh_session_metrics 
  USING BRIN (tenant_id, metric_time);

-- Aggregated hourly metrics for historical analysis
CREATE TABLE sovereign_mesh_session_metrics_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hour_start TIMESTAMPTZ NOT NULL,
  
  total_sessions INTEGER NOT NULL DEFAULT 0,
  peak_concurrent_sessions INTEGER NOT NULL DEFAULT 0,
  avg_concurrent_sessions DECIMAL(10,2) NOT NULL DEFAULT 0,
  completed_sessions INTEGER NOT NULL DEFAULT 0,
  failed_sessions INTEGER NOT NULL DEFAULT 0,
  avg_session_duration_ms INTEGER,
  
  -- Costs incurred during this hour
  lambda_cost DECIMAL(10,4) DEFAULT 0,
  aurora_cost DECIMAL(10,4) DEFAULT 0,
  redis_cost DECIMAL(10,4) DEFAULT 0,
  api_cost DECIMAL(10,4) DEFAULT 0,
  sqs_cost DECIMAL(10,4) DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0,
  
  UNIQUE(tenant_id, hour_start)
);

CREATE INDEX idx_session_metrics_hourly_tenant ON sovereign_mesh_session_metrics_hourly(tenant_id, hour_start DESC);

-- ============================================================================
-- SCALING OPERATIONS
-- ============================================================================

CREATE TABLE sovereign_mesh_scaling_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  operation_type scaling_operation_type NOT NULL,
  status scaling_operation_status NOT NULL DEFAULT 'pending',
  
  -- Profile Changes
  source_profile_id UUID REFERENCES sovereign_mesh_scaling_profiles(id),
  target_profile_id UUID REFERENCES sovereign_mesh_scaling_profiles(id),
  
  -- Change Details
  changes JSONB NOT NULL DEFAULT '[]',
  
  -- Timing
  estimated_duration_seconds INTEGER,
  actual_duration_seconds INTEGER,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Approval Workflow
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  
  -- Error Handling
  error_message TEXT,
  error_details JSONB,
  rollback_available BOOLEAN NOT NULL DEFAULT true,
  rolled_back_at TIMESTAMPTZ,
  
  -- Audit
  initiated_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scaling_operations_tenant ON sovereign_mesh_scaling_operations(tenant_id);
CREATE INDEX idx_scaling_operations_status ON sovereign_mesh_scaling_operations(status);
CREATE INDEX idx_scaling_operations_recent ON sovereign_mesh_scaling_operations(tenant_id, created_at DESC);

-- ============================================================================
-- AUTO-SCALING RULES
-- ============================================================================

CREATE TABLE sovereign_mesh_autoscaling_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Trigger Condition
  metric VARCHAR(50) NOT NULL, -- session_count, cpu_utilization, memory_utilization, queue_depth, latency_p99
  condition VARCHAR(20) NOT NULL, -- greater_than, less_than, equals
  threshold DECIMAL(10,2) NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 60, -- Sustained duration before trigger
  
  -- Action
  action scaling_operation_type NOT NULL,
  target_value DECIMAL(10,2),
  
  -- Limits
  cooldown_seconds INTEGER NOT NULL DEFAULT 300,
  min_capacity INTEGER,
  max_capacity INTEGER,
  
  -- Tracking
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_autoscaling_rules_tenant ON sovereign_mesh_autoscaling_rules(tenant_id);
CREATE INDEX idx_autoscaling_rules_enabled ON sovereign_mesh_autoscaling_rules(tenant_id) WHERE enabled = true;

-- ============================================================================
-- SCHEDULED SCALING
-- ============================================================================

CREATE TABLE sovereign_mesh_scheduled_scaling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Schedule (cron format)
  schedule VARCHAR(100) NOT NULL, -- e.g., "0 8 * * MON-FRI"
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  
  -- Target
  target_profile_id UUID REFERENCES sovereign_mesh_scaling_profiles(id),
  
  -- Recurrence
  recurrence VARCHAR(20) NOT NULL DEFAULT 'weekly', -- once, daily, weekly, monthly
  days_of_week INTEGER[], -- 0-6 (Sunday-Saturday)
  day_of_month INTEGER,
  
  -- Tracking
  last_executed_at TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ,
  execution_count INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_scheduled_scaling_tenant ON sovereign_mesh_scheduled_scaling(tenant_id);
CREATE INDEX idx_scheduled_scaling_next ON sovereign_mesh_scheduled_scaling(next_execution_at) WHERE enabled = true;

-- ============================================================================
-- COMPONENT HEALTH
-- ============================================================================

CREATE TABLE sovereign_mesh_component_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  component VARCHAR(50) NOT NULL, -- lambda, aurora, redis, api_gateway, sqs
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  status component_status NOT NULL DEFAULT 'healthy',
  utilization DECIMAL(5,2) NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  error_rate DECIMAL(5,4) DEFAULT 0,
  
  -- Component-specific metrics
  metrics JSONB DEFAULT '{}',
  
  UNIQUE(tenant_id, component, checked_at)
);

CREATE INDEX idx_component_health_tenant ON sovereign_mesh_component_health(tenant_id, checked_at DESC);
CREATE INDEX idx_component_health_status ON sovereign_mesh_component_health(tenant_id, component) 
  WHERE status != 'healthy';

-- ============================================================================
-- SCALING ALERTS
-- ============================================================================

CREATE TABLE sovereign_mesh_scaling_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning', -- info, warning, critical
  alert_type VARCHAR(50) NOT NULL,
  component VARCHAR(50) NOT NULL,
  
  message TEXT NOT NULL,
  metric VARCHAR(50),
  current_value DECIMAL(10,2),
  threshold DECIMAL(10,2),
  
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by VARCHAR(255),
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(255),
  auto_resolved BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_scaling_alerts_tenant ON sovereign_mesh_scaling_alerts(tenant_id);
CREATE INDEX idx_scaling_alerts_active ON sovereign_mesh_scaling_alerts(tenant_id) 
  WHERE resolved_at IS NULL;
CREATE INDEX idx_scaling_alerts_severity ON sovereign_mesh_scaling_alerts(tenant_id, severity)
  WHERE resolved_at IS NULL;

-- ============================================================================
-- COST TRACKING
-- ============================================================================

CREATE TABLE sovereign_mesh_cost_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  
  -- Component Costs
  lambda_cost DECIMAL(10,4) NOT NULL DEFAULT 0,
  aurora_cost DECIMAL(10,4) NOT NULL DEFAULT 0,
  redis_cost DECIMAL(10,4) NOT NULL DEFAULT 0,
  api_gateway_cost DECIMAL(10,4) NOT NULL DEFAULT 0,
  sqs_cost DECIMAL(10,4) NOT NULL DEFAULT 0,
  cloudfront_cost DECIMAL(10,4) NOT NULL DEFAULT 0,
  data_transfer_cost DECIMAL(10,4) NOT NULL DEFAULT 0,
  
  -- Usage Metrics
  lambda_invocations BIGINT DEFAULT 0,
  lambda_duration_ms BIGINT DEFAULT 0,
  aurora_acu_hours DECIMAL(10,2) DEFAULT 0,
  aurora_io_requests BIGINT DEFAULT 0,
  redis_node_hours DECIMAL(10,2) DEFAULT 0,
  api_requests BIGINT DEFAULT 0,
  sqs_requests BIGINT DEFAULT 0,
  data_transfer_gb DECIMAL(10,4) DEFAULT 0,
  
  -- Totals
  total_cost DECIMAL(10,4) NOT NULL DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,
  cost_per_session DECIMAL(10,6) DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, record_date)
);

CREATE INDEX idx_cost_records_tenant ON sovereign_mesh_cost_records(tenant_id, record_date DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Calculate estimated monthly cost for a scaling profile
CREATE OR REPLACE FUNCTION calculate_scaling_cost(profile_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  profile RECORD;
  monthly_cost DECIMAL(10,2) := 0;
  lambda_cost DECIMAL(10,2);
  aurora_cost DECIMAL(10,2);
  redis_cost DECIMAL(10,2);
  api_cost DECIMAL(10,2);
  sqs_cost DECIMAL(10,2);
BEGIN
  SELECT * INTO profile FROM sovereign_mesh_scaling_profiles WHERE id = profile_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Lambda costs (provisioned concurrency)
  -- $0.000004167 per GB-second of provisioned concurrency
  lambda_cost := profile.lambda_provisioned_concurrency * (profile.lambda_memory_mb / 1024.0) * 0.000004167 * 3600 * 24 * 30;
  
  -- Aurora costs (ACU-hours)
  -- $0.12 per ACU-hour
  aurora_cost := (profile.aurora_min_capacity_acu + profile.aurora_max_capacity_acu) / 2 * 0.12 * 24 * 30;
  -- Add read replicas
  aurora_cost := aurora_cost * (1 + profile.aurora_read_replica_count * 0.5);
  
  -- Redis costs (node-hours)
  -- Approximate based on node type
  redis_cost := CASE profile.redis_node_type
    WHEN 'cache.t4g.micro' THEN 0.016
    WHEN 'cache.t4g.small' THEN 0.032
    WHEN 'cache.r6g.large' THEN 0.182
    WHEN 'cache.r6g.xlarge' THEN 0.364
    WHEN 'cache.r6g.2xlarge' THEN 0.728
    ELSE 0.182
  END * 24 * 30 * profile.redis_num_shards * (1 + profile.redis_replicas_per_shard);
  
  -- API Gateway (estimated based on rate limit)
  -- $1.00 per million HTTP API requests
  api_cost := (profile.api_throttling_rate_limit * 3600 * 24 * 30 / 1000000.0) * 1.00 * 0.1; -- 10% average utilization
  
  -- SQS costs
  -- $0.40 per million standard, $0.50 per million FIFO
  sqs_cost := (profile.sqs_standard_queue_count * 0.40 + profile.sqs_fifo_queue_count * 0.50) * 10; -- 10M messages/queue/month estimate
  
  monthly_cost := lambda_cost + aurora_cost + redis_cost + api_cost + sqs_cost;
  
  -- Update the profile
  UPDATE sovereign_mesh_scaling_profiles 
  SET estimated_monthly_cost = monthly_cost, cost_last_calculated_at = NOW()
  WHERE id = profile_id;
  
  RETURN monthly_cost;
END;
$$ LANGUAGE plpgsql;

-- Get current session capacity
CREATE OR REPLACE FUNCTION get_session_capacity(p_tenant_id UUID)
RETURNS TABLE(
  max_sessions INTEGER,
  current_sessions INTEGER,
  utilization_percent DECIMAL(5,2),
  bottleneck VARCHAR(50),
  headroom INTEGER
) AS $$
DECLARE
  profile RECORD;
  lambda_max INTEGER;
  aurora_max INTEGER;
  redis_max INTEGER;
  api_max INTEGER;
  min_max INTEGER;
  current_count INTEGER;
BEGIN
  -- Get active profile
  SELECT * INTO profile FROM sovereign_mesh_scaling_profiles 
  WHERE tenant_id = p_tenant_id AND is_active = true
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 10000, 0, 0.0::DECIMAL(5,2), 'none'::VARCHAR(50), 10000;
    RETURN;
  END IF;
  
  -- Calculate max sessions per component
  lambda_max := profile.lambda_max_concurrency * 10;
  aurora_max := profile.aurora_connection_pool_size * 50;
  redis_max := profile.redis_max_connections;
  api_max := profile.api_throttling_rate_limit;
  
  -- Find bottleneck
  min_max := LEAST(lambda_max, aurora_max, redis_max, api_max);
  
  -- Get current session count
  SELECT COALESCE(active_sessions, 0) INTO current_count
  FROM sovereign_mesh_session_metrics
  WHERE tenant_id = p_tenant_id
  ORDER BY metric_time DESC
  LIMIT 1;
  
  RETURN QUERY SELECT 
    min_max,
    COALESCE(current_count, 0),
    CASE WHEN min_max > 0 THEN (COALESCE(current_count, 0)::DECIMAL / min_max * 100) ELSE 0 END,
    CASE 
      WHEN min_max = lambda_max THEN 'lambda'::VARCHAR(50)
      WHEN min_max = aurora_max THEN 'aurora'::VARCHAR(50)
      WHEN min_max = redis_max THEN 'redis'::VARCHAR(50)
      WHEN min_max = api_max THEN 'api_gateway'::VARCHAR(50)
      ELSE 'none'::VARCHAR(50)
    END,
    min_max - COALESCE(current_count, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps
CREATE TRIGGER update_scaling_profiles_timestamp
  BEFORE UPDATE ON sovereign_mesh_scaling_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scaling_operations_timestamp
  BEFORE UPDATE ON sovereign_mesh_scaling_operations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_autoscaling_rules_timestamp
  BEFORE UPDATE ON sovereign_mesh_autoscaling_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_scaling_timestamp
  BEFORE UPDATE ON sovereign_mesh_scheduled_scaling
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE sovereign_mesh_scaling_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_mesh_session_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_mesh_session_metrics_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_mesh_scaling_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_mesh_autoscaling_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_mesh_scheduled_scaling ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_mesh_component_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_mesh_scaling_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sovereign_mesh_cost_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON sovereign_mesh_scaling_profiles
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON sovereign_mesh_session_metrics
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON sovereign_mesh_session_metrics_hourly
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON sovereign_mesh_scaling_operations
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON sovereign_mesh_autoscaling_rules
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON sovereign_mesh_scheduled_scaling
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON sovereign_mesh_component_health
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON sovereign_mesh_scaling_alerts
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation ON sovereign_mesh_cost_records
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- SEED DEFAULT PROFILES (per tenant, created on-demand)
-- ============================================================================

COMMENT ON TABLE sovereign_mesh_scaling_profiles IS 'Scaling profiles with infrastructure configuration for different capacity tiers';
COMMENT ON TABLE sovereign_mesh_session_metrics IS 'Real-time session metrics (1-minute granularity)';
COMMENT ON TABLE sovereign_mesh_session_metrics_hourly IS 'Aggregated hourly session metrics for historical analysis';
COMMENT ON TABLE sovereign_mesh_scaling_operations IS 'Scaling operation history and status tracking';
COMMENT ON TABLE sovereign_mesh_autoscaling_rules IS 'Auto-scaling rules based on metrics';
COMMENT ON TABLE sovereign_mesh_scheduled_scaling IS 'Scheduled scaling events (e.g., scale up for business hours)';
COMMENT ON TABLE sovereign_mesh_component_health IS 'Health status of infrastructure components';
COMMENT ON TABLE sovereign_mesh_scaling_alerts IS 'Scaling-related alerts and notifications';
COMMENT ON TABLE sovereign_mesh_cost_records IS 'Daily cost records for cost tracking and analysis';
