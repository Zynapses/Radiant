-- ============================================================================
-- RADIANT v5.0 - SOVEREIGN MESH: APP REGISTRY & OPEN DEFINITION BRIDGE
-- Migration: V2026_01_20_004
-- 
-- Registry for 3,000+ apps from Activepieces/n8n with AI enhancement layer.
-- Each app can have parametric AI configuration for disambiguation, 
-- parameter inference, and error recovery.
-- ============================================================================

-- App source systems
CREATE TYPE app_source AS ENUM ('activepieces', 'n8n', 'native', 'custom');

CREATE TYPE app_auth_type AS ENUM ('oauth2', 'api_key', 'basic', 'bearer', 'custom', 'none');

CREATE TYPE app_health_status AS ENUM ('healthy', 'degraded', 'broken', 'unknown');

-- ============================================================================
-- APPS TABLE (The 3,000+ Apps Registry)
-- ============================================================================

CREATE TABLE IF NOT EXISTS apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  documentation_url TEXT,
  
  -- Source (where definition came from)
  source app_source NOT NULL,
  source_version VARCHAR(50),
  definition_hash VARCHAR(64),
  
  -- Versioning
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  previous_version VARCHAR(20),
  
  -- Authentication
  auth_type app_auth_type NOT NULL,
  auth_config JSONB DEFAULT '{}',
  oauth_scopes TEXT[],
  
  -- Capabilities (parsed from source)
  triggers JSONB DEFAULT '[]',
  actions JSONB DEFAULT '[]',
  
  -- AI Enhancement Layer (PARAMETRIC)
  ai_enhancements JSONB NOT NULL DEFAULT '{
    "enabled": false,
    "parameterInference": {
      "enabled": false,
      "model": null,
      "examples": []
    },
    "errorRecovery": {
      "enabled": false,
      "strategies": []
    },
    "preExecutionValidation": {
      "enabled": false,
      "checks": []
    },
    "learningEnabled": false
  }',
  
  -- Health
  health_status app_health_status NOT NULL DEFAULT 'unknown',
  last_health_check TIMESTAMPTZ,
  health_check_error TEXT,
  
  -- Sync
  last_sync TIMESTAMPTZ,
  sync_error TEXT,
  is_sync_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Metrics
  usage_count_30d INTEGER DEFAULT 0,
  error_rate_30d DECIMAL(5,4) DEFAULT 0,
  avg_latency_ms INTEGER,
  
  -- Flags
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  min_tier INTEGER NOT NULL DEFAULT 1,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- APP SYNC LOGS (tracks daily updates from Activepieces/n8n)
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  source app_source NOT NULL,
  source_commit_hash VARCHAR(64),
  
  sync_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_completed_at TIMESTAMPTZ,
  
  apps_added INTEGER DEFAULT 0,
  apps_updated INTEGER DEFAULT 0,
  apps_unchanged INTEGER DEFAULT 0,
  apps_failed INTEGER DEFAULT 0,
  
  changes JSONB DEFAULT '[]',
  errors JSONB DEFAULT '[]',
  
  status VARCHAR(20) NOT NULL DEFAULT 'running'
);

-- ============================================================================
-- APP HEALTH CHECKS (hourly for top apps)
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  auth_endpoint_reachable BOOLEAN,
  auth_endpoint_latency_ms INTEGER,
  test_action_success BOOLEAN,
  test_action_latency_ms INTEGER,
  
  health_status app_health_status NOT NULL,
  error_message TEXT
);

-- ============================================================================
-- APP CONNECTIONS (Per-Tenant OAuth tokens, API keys)
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  
  name VARCHAR(200) NOT NULL,
  
  -- Credentials (reference to Secrets Manager)
  credentials_secret_arn TEXT,
  
  -- OAuth
  oauth_access_token_encrypted TEXT,
  oauth_refresh_token_encrypted TEXT,
  oauth_token_expires_at TIMESTAMPTZ,
  oauth_scopes TEXT[],
  
  -- API Key (encrypted)
  api_key_encrypted TEXT,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  last_refresh_at TIMESTAMPTZ,
  connection_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_connection_name UNIQUE (tenant_id, app_id, name)
);

-- ============================================================================
-- APP LEARNED INFERENCES (AI learning loop)
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_learned_inferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  inference_type VARCHAR(50) NOT NULL,
  input_context JSONB NOT NULL,
  inferred_value JSONB NOT NULL,
  
  was_corrected BOOLEAN NOT NULL DEFAULT false,
  corrected_value JSONB,
  corrected_by UUID REFERENCES users(id),
  corrected_at TIMESTAMPTZ,
  
  confidence DECIMAL(5,4),
  times_used INTEGER DEFAULT 1,
  times_successful INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- APP ACTION EXECUTIONS (tracking for metrics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_action_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES app_connections(id),
  
  action_name VARCHAR(200) NOT NULL,
  
  -- Execution details
  input_params JSONB,
  output_result JSONB,
  
  -- Status
  status VARCHAR(20) NOT NULL, -- 'success', 'failure', 'timeout'
  error_code VARCHAR(50),
  error_message TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- AI Helper usage
  ai_helper_used BOOLEAN DEFAULT false,
  ai_helper_type VARCHAR(50), -- 'disambiguation', 'inference', 'recovery'
  
  -- Context
  workflow_id UUID,
  agent_execution_id UUID REFERENCES agent_executions(id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_apps_source ON apps(source);
CREATE INDEX idx_apps_health ON apps(health_status);
CREATE INDEX idx_apps_active ON apps(is_active) WHERE is_active;
CREATE INDEX idx_apps_featured ON apps(is_featured) WHERE is_featured;
CREATE INDEX idx_apps_search ON apps USING gin(
  to_tsvector('english', display_name || ' ' || COALESCE(description, ''))
);

CREATE INDEX idx_app_sync_source ON app_sync_logs(source);
CREATE INDEX idx_app_sync_status ON app_sync_logs(status);

CREATE INDEX idx_app_health_app ON app_health_checks(app_id);
CREATE INDEX idx_app_health_recent ON app_health_checks(checked_at DESC);

CREATE INDEX idx_app_connections_tenant ON app_connections(tenant_id);
CREATE INDEX idx_app_connections_app ON app_connections(app_id);
CREATE INDEX idx_app_connections_active ON app_connections(tenant_id, is_active) WHERE is_active;

CREATE INDEX idx_app_learned_app ON app_learned_inferences(app_id);
CREATE INDEX idx_app_learned_tenant ON app_learned_inferences(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_app_learned_type ON app_learned_inferences(app_id, inference_type);

CREATE INDEX idx_app_exec_tenant ON app_action_executions(tenant_id);
CREATE INDEX idx_app_exec_app ON app_action_executions(app_id);
CREATE INDEX idx_app_exec_recent ON app_action_executions(started_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE app_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_learned_inferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_action_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_conn_isolation ON app_connections FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY app_learned_isolation ON app_learned_inferences FOR ALL USING (
  tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY app_exec_isolation ON app_action_executions FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_apps_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER apps_updated_at
  BEFORE UPDATE ON apps
  FOR EACH ROW EXECUTE FUNCTION update_apps_timestamp();

CREATE TRIGGER app_connections_updated_at
  BEFORE UPDATE ON app_connections
  FOR EACH ROW EXECUTE FUNCTION update_apps_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE apps IS 'Registry of 3,000+ apps from Activepieces/n8n with AI enhancement layer';
COMMENT ON TABLE app_sync_logs IS 'Logs of daily sync operations from source registries';
COMMENT ON TABLE app_health_checks IS 'Hourly health checks for top apps';
COMMENT ON TABLE app_connections IS 'Per-tenant OAuth/API credentials for apps';
COMMENT ON TABLE app_learned_inferences IS 'AI learning loop - corrections improve future inferences';
COMMENT ON TABLE app_action_executions IS 'Execution tracking for metrics and debugging';
