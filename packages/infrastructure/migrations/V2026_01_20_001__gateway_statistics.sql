-- ============================================================================
-- RADIANT v5.29.0 - Gateway Statistics & Admin Controls
-- Migration: V2026_01_20_001__gateway_statistics.sql
-- 
-- Adds persistent storage for gateway metrics, admin controls, and reporting
-- ============================================================================

-- ============================================================================
-- 1. Gateway Instances Registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS gateway_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id VARCHAR(255) NOT NULL UNIQUE,
  hostname VARCHAR(255) NOT NULL,
  region VARCHAR(50) NOT NULL,
  availability_zone VARCHAR(50),
  instance_type VARCHAR(50) DEFAULT 'c6g.xlarge',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'draining', 'stopped', 'unhealthy')),
  version VARCHAR(20) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gateway_instances_status ON gateway_instances(status);
CREATE INDEX idx_gateway_instances_region ON gateway_instances(region);
CREATE INDEX idx_gateway_instances_heartbeat ON gateway_instances(last_heartbeat_at);

-- ============================================================================
-- 2. Gateway Statistics (Time-Series Summary)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gateway_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id VARCHAR(255) NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Time bucket (5-minute intervals)
  bucket_start TIMESTAMPTZ NOT NULL,
  bucket_end TIMESTAMPTZ NOT NULL,
  
  -- Connection metrics
  active_connections INTEGER NOT NULL DEFAULT 0,
  peak_connections INTEGER NOT NULL DEFAULT 0,
  new_connections INTEGER NOT NULL DEFAULT 0,
  closed_connections INTEGER NOT NULL DEFAULT 0,
  failed_connections INTEGER NOT NULL DEFAULT 0,
  
  -- Protocol breakdown
  connections_mcp INTEGER NOT NULL DEFAULT 0,
  connections_a2a INTEGER NOT NULL DEFAULT 0,
  connections_openai INTEGER NOT NULL DEFAULT 0,
  connections_anthropic INTEGER NOT NULL DEFAULT 0,
  connections_google INTEGER NOT NULL DEFAULT 0,
  
  -- Message metrics
  messages_inbound INTEGER NOT NULL DEFAULT 0,
  messages_outbound INTEGER NOT NULL DEFAULT 0,
  bytes_inbound BIGINT NOT NULL DEFAULT 0,
  bytes_outbound BIGINT NOT NULL DEFAULT 0,
  
  -- Latency metrics (microseconds)
  latency_p50 INTEGER,
  latency_p95 INTEGER,
  latency_p99 INTEGER,
  latency_avg INTEGER,
  
  -- Error metrics
  errors_auth INTEGER NOT NULL DEFAULT 0,
  errors_protocol INTEGER NOT NULL DEFAULT 0,
  errors_timeout INTEGER NOT NULL DEFAULT 0,
  errors_nats INTEGER NOT NULL DEFAULT 0,
  errors_other INTEGER NOT NULL DEFAULT 0,
  
  -- Resume token metrics
  resume_tokens_issued INTEGER NOT NULL DEFAULT 0,
  resume_tokens_used INTEGER NOT NULL DEFAULT 0,
  resume_tokens_expired INTEGER NOT NULL DEFAULT 0,
  
  -- Resource utilization
  cpu_percent NUMERIC(5,2),
  memory_percent NUMERIC(5,2),
  memory_bytes BIGINT,
  goroutines INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(instance_id, tenant_id, bucket_start)
);

CREATE INDEX idx_gateway_stats_bucket ON gateway_statistics(bucket_start DESC);
CREATE INDEX idx_gateway_stats_instance ON gateway_statistics(instance_id, bucket_start DESC);
CREATE INDEX idx_gateway_stats_tenant ON gateway_statistics(tenant_id, bucket_start DESC);

-- ============================================================================
-- 3. Gateway Configuration (Admin Controls)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gateway_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Connection limits
  max_connections_per_tenant INTEGER DEFAULT 10000,
  max_connections_per_user INTEGER DEFAULT 100,
  max_connections_per_agent INTEGER DEFAULT 50,
  
  -- Rate limits
  rate_limit_messages_per_second INTEGER DEFAULT 100,
  rate_limit_bytes_per_second BIGINT DEFAULT 10485760, -- 10MB/s
  rate_limit_connections_per_minute INTEGER DEFAULT 60,
  
  -- Timeouts (milliseconds)
  timeout_connect_ms INTEGER DEFAULT 5000,
  timeout_idle_ms INTEGER DEFAULT 300000, -- 5 minutes
  timeout_write_ms INTEGER DEFAULT 30000,
  timeout_read_ms INTEGER DEFAULT 30000,
  
  -- Protocol settings
  protocols_enabled TEXT[] DEFAULT ARRAY['mcp', 'a2a', 'openai', 'anthropic', 'google'],
  require_mtls_for_a2a BOOLEAN DEFAULT true,
  allow_anonymous_connections BOOLEAN DEFAULT false,
  
  -- Resume token settings
  resume_token_ttl_seconds INTEGER DEFAULT 3600, -- 1 hour
  resume_token_max_replay_messages INTEGER DEFAULT 1000,
  
  -- Security settings
  ip_allowlist TEXT[],
  ip_blocklist TEXT[],
  require_tls BOOLEAN DEFAULT true,
  min_tls_version VARCHAR(10) DEFAULT 'TLS1.2',
  
  -- Feature flags
  enable_compression BOOLEAN DEFAULT true,
  enable_message_batching BOOLEAN DEFAULT true,
  enable_connection_draining BOOLEAN DEFAULT true,
  drain_timeout_seconds INTEGER DEFAULT 30,
  
  -- Maintenance mode
  maintenance_mode BOOLEAN DEFAULT false,
  maintenance_message TEXT,
  maintenance_allowed_ips TEXT[],
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID,
  
  UNIQUE(tenant_id)
);

-- Global configuration (tenant_id = NULL)
INSERT INTO gateway_configuration (tenant_id) VALUES (NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. Gateway Alerts & Incidents
-- ============================================================================

CREATE TABLE IF NOT EXISTS gateway_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id VARCHAR(255),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
    'connection_limit', 'rate_limit', 'error_spike', 'latency_spike',
    'instance_unhealthy', 'nats_disconnect', 'memory_pressure', 'cpu_pressure'
  )),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Thresholds that triggered the alert
  threshold_value NUMERIC,
  actual_value NUMERIC,
  
  -- Resolution tracking
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'suppressed')),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gateway_alerts_status ON gateway_alerts(status, created_at DESC);
CREATE INDEX idx_gateway_alerts_type ON gateway_alerts(alert_type, created_at DESC);
CREATE INDEX idx_gateway_alerts_tenant ON gateway_alerts(tenant_id, created_at DESC);

-- ============================================================================
-- 5. Gateway Sessions (Active Connection Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gateway_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL UNIQUE,
  instance_id VARCHAR(255) NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID,
  agent_id UUID,
  
  -- Connection details
  protocol VARCHAR(20) NOT NULL,
  client_ip INET,
  client_port INTEGER,
  user_agent TEXT,
  
  -- Authentication
  auth_method VARCHAR(20) CHECK (auth_method IN ('jwt', 'mtls', 'api_key', 'anonymous')),
  auth_subject VARCHAR(255),
  
  -- State
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'idle', 'draining', 'closed')),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  disconnect_reason VARCHAR(100),
  
  -- Metrics
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  bytes_sent BIGINT DEFAULT 0,
  bytes_received BIGINT DEFAULT 0,
  
  -- Resume token
  resume_token_hash VARCHAR(64),
  resume_token_expires_at TIMESTAMPTZ,
  resumed_from_session_id UUID,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gateway_sessions_active ON gateway_sessions(status, tenant_id) WHERE status = 'active';
CREATE INDEX idx_gateway_sessions_instance ON gateway_sessions(instance_id, status);
CREATE INDEX idx_gateway_sessions_user ON gateway_sessions(user_id, connected_at DESC);
CREATE INDEX idx_gateway_sessions_agent ON gateway_sessions(agent_id, connected_at DESC);

-- ============================================================================
-- 6. Gateway Audit Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS gateway_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id UUID,
  actor_type VARCHAR(20) CHECK (actor_type IN ('admin', 'system', 'api')),
  
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255),
  
  changes JSONB,
  metadata JSONB DEFAULT '{}',
  
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gateway_audit_tenant ON gateway_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_gateway_audit_action ON gateway_audit_log(action, created_at DESC);

-- ============================================================================
-- 7. Aggregated Statistics Views
-- ============================================================================

-- Hourly aggregates for reporting
CREATE OR REPLACE VIEW gateway_statistics_hourly AS
SELECT
  date_trunc('hour', bucket_start) AS hour,
  instance_id,
  tenant_id,
  MAX(peak_connections) AS peak_connections,
  AVG(active_connections)::INTEGER AS avg_connections,
  SUM(new_connections) AS total_new_connections,
  SUM(closed_connections) AS total_closed_connections,
  SUM(messages_inbound) AS total_messages_inbound,
  SUM(messages_outbound) AS total_messages_outbound,
  SUM(bytes_inbound) AS total_bytes_inbound,
  SUM(bytes_outbound) AS total_bytes_outbound,
  AVG(latency_avg)::INTEGER AS avg_latency,
  MAX(latency_p99) AS max_latency_p99,
  SUM(errors_auth + errors_protocol + errors_timeout + errors_nats + errors_other) AS total_errors,
  AVG(cpu_percent)::NUMERIC(5,2) AS avg_cpu,
  AVG(memory_percent)::NUMERIC(5,2) AS avg_memory
FROM gateway_statistics
GROUP BY date_trunc('hour', bucket_start), instance_id, tenant_id;

-- Daily aggregates for long-term reporting
CREATE OR REPLACE VIEW gateway_statistics_daily AS
SELECT
  date_trunc('day', bucket_start) AS day,
  tenant_id,
  MAX(peak_connections) AS peak_connections,
  AVG(active_connections)::INTEGER AS avg_connections,
  SUM(new_connections) AS total_new_connections,
  SUM(messages_inbound + messages_outbound) AS total_messages,
  SUM(bytes_inbound + bytes_outbound) AS total_bytes,
  AVG(latency_avg)::INTEGER AS avg_latency,
  SUM(errors_auth + errors_protocol + errors_timeout + errors_nats + errors_other) AS total_errors,
  COUNT(DISTINCT instance_id) AS instances_used
FROM gateway_statistics
GROUP BY date_trunc('day', bucket_start), tenant_id;

-- ============================================================================
-- 8. Report Type Registration
-- ============================================================================

INSERT INTO admin_report_types (id, name, description, category, query_template, parameters_schema, created_at)
VALUES (
  'gateway-statistics',
  'Gateway Statistics Report',
  'Comprehensive report of gateway connection and message statistics',
  'infrastructure',
  $query$
    SELECT
      gs.bucket_start,
      gs.bucket_end,
      gi.hostname,
      gi.region,
      t.name AS tenant_name,
      gs.active_connections,
      gs.peak_connections,
      gs.messages_inbound,
      gs.messages_outbound,
      gs.bytes_inbound,
      gs.bytes_outbound,
      gs.latency_avg,
      gs.latency_p99,
      (gs.errors_auth + gs.errors_protocol + gs.errors_timeout + gs.errors_nats + gs.errors_other) AS total_errors,
      gs.cpu_percent,
      gs.memory_percent
    FROM gateway_statistics gs
    LEFT JOIN gateway_instances gi ON gs.instance_id = gi.instance_id
    LEFT JOIN tenants t ON gs.tenant_id = t.id
    WHERE gs.bucket_start >= :start_date
      AND gs.bucket_end <= :end_date
      AND (:tenant_id IS NULL OR gs.tenant_id = :tenant_id::uuid)
    ORDER BY gs.bucket_start DESC
  $query$,
  '{
    "type": "object",
    "properties": {
      "start_date": {"type": "string", "format": "date-time", "description": "Start date for the report"},
      "end_date": {"type": "string", "format": "date-time", "description": "End date for the report"},
      "tenant_id": {"type": "string", "format": "uuid", "description": "Filter by tenant (optional)"}
    },
    "required": ["start_date", "end_date"]
  }',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  query_template = EXCLUDED.query_template,
  parameters_schema = EXCLUDED.parameters_schema;

INSERT INTO admin_report_types (id, name, description, category, query_template, parameters_schema, created_at)
VALUES (
  'gateway-alerts',
  'Gateway Alerts Report',
  'Summary of gateway alerts and incidents',
  'infrastructure',
  $query$
    SELECT
      ga.created_at,
      ga.alert_type,
      ga.severity,
      ga.title,
      ga.description,
      ga.status,
      ga.threshold_value,
      ga.actual_value,
      gi.hostname,
      t.name AS tenant_name,
      ga.resolved_at,
      ga.resolution_notes
    FROM gateway_alerts ga
    LEFT JOIN gateway_instances gi ON ga.instance_id = gi.instance_id
    LEFT JOIN tenants t ON ga.tenant_id = t.id
    WHERE ga.created_at >= :start_date
      AND ga.created_at <= :end_date
      AND (:severity IS NULL OR ga.severity = :severity)
      AND (:status IS NULL OR ga.status = :status)
    ORDER BY ga.created_at DESC
  $query$,
  '{
    "type": "object",
    "properties": {
      "start_date": {"type": "string", "format": "date-time"},
      "end_date": {"type": "string", "format": "date-time"},
      "severity": {"type": "string", "enum": ["info", "warning", "critical"]},
      "status": {"type": "string", "enum": ["open", "acknowledged", "resolved", "suppressed"]}
    },
    "required": ["start_date", "end_date"]
  }',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  query_template = EXCLUDED.query_template,
  parameters_schema = EXCLUDED.parameters_schema;

-- ============================================================================
-- 9. Row Level Security
-- ============================================================================

ALTER TABLE gateway_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_audit_log ENABLE ROW LEVEL SECURITY;

-- Platform admins can see all
CREATE POLICY gateway_stats_platform_admin ON gateway_statistics
  FOR ALL USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR current_setting('app.is_platform_admin', true) = 'true'
  );

CREATE POLICY gateway_config_platform_admin ON gateway_configuration
  FOR ALL USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR current_setting('app.is_platform_admin', true) = 'true'
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY gateway_alerts_platform_admin ON gateway_alerts
  FOR ALL USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR current_setting('app.is_platform_admin', true) = 'true'
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY gateway_sessions_tenant ON gateway_sessions
  FOR ALL USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR current_setting('app.is_platform_admin', true) = 'true'
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY gateway_audit_tenant ON gateway_audit_log
  FOR ALL USING (
    current_setting('app.current_tenant_id', true) IS NULL
    OR current_setting('app.is_platform_admin', true) = 'true'
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

-- ============================================================================
-- 10. Cleanup Function (Data Retention)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_gateway_statistics(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM gateway_statistics
  WHERE bucket_start < NOW() - (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  DELETE FROM gateway_sessions
  WHERE status = 'closed' AND disconnected_at < NOW() - INTERVAL '7 days';
  
  DELETE FROM gateway_alerts
  WHERE status = 'resolved' AND resolved_at < NOW() - (retention_days || ' days')::INTERVAL;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. Triggers for Updated Timestamps
-- ============================================================================

CREATE TRIGGER gateway_instances_updated_at
  BEFORE UPDATE ON gateway_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER gateway_configuration_updated_at
  BEFORE UPDATE ON gateway_configuration
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER gateway_alerts_updated_at
  BEFORE UPDATE ON gateway_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER gateway_sessions_updated_at
  BEFORE UPDATE ON gateway_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration Complete
-- ============================================================================
