-- ============================================================================
-- RADIANT v5.1.1 - Three-Layer Authentication Schema
-- Migration: V2026_01_25_007__auth_v51_three_layer.sql
-- 
-- Layer 1: End-User Authentication (tenant_users)
-- Layer 2: Platform Administrator Authentication (platform_admins)
-- Layer 3: Service/Machine Authentication (service_api_keys + audit)
-- Plus: Enterprise SSO Federation (tenant_sso_connections)
-- ============================================================================

-- ============================================================================
-- LAYER 1: TENANT USERS (End Users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Cognito integration
  cognito_sub VARCHAR(255) UNIQUE,
  
  -- Basic info
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url VARCHAR(500),
  
  -- Role within tenant
  role VARCHAR(50) NOT NULL DEFAULT 'standard_user'
    CHECK (role IN ('standard_user', 'tenant_admin', 'tenant_owner')),
  
  -- Feature access (Admin Configurable per tenant)
  has_access_think_tank BOOLEAN NOT NULL DEFAULT true,
  has_access_curator BOOLEAN NOT NULL DEFAULT false,
  has_access_tenant_admin BOOLEAN NOT NULL DEFAULT false,
  
  -- SSO
  sso_provider VARCHAR(100),
  sso_provider_user_id VARCHAR(255),
  sso_connection_id UUID,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_email_verified BOOLEAN NOT NULL DEFAULT false,
  
  -- MFA
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  mfa_methods JSONB DEFAULT '[]',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  
  -- Unique email per tenant
  CONSTRAINT tenant_users_email_tenant_unique UNIQUE (tenant_id, email)
);

CREATE INDEX idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_email ON tenant_users(email);
CREATE INDEX idx_tenant_users_cognito ON tenant_users(cognito_sub);
CREATE INDEX idx_tenant_users_sso ON tenant_users(sso_connection_id) WHERE sso_connection_id IS NOT NULL;

-- RLS Policy
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_users_isolation ON tenant_users
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- LAYER 2: PLATFORM ADMINS (Platform Operators)
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Cognito integration (Admin Pool)
  cognito_sub VARCHAR(255) UNIQUE NOT NULL,
  
  -- Basic info
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  
  -- Role
  admin_role VARCHAR(50) NOT NULL DEFAULT 'operator'
    CHECK (admin_role IN ('super_admin', 'admin', 'operator', 'auditor')),
  
  -- Permissions (JSON array of permission strings)
  permissions JSONB NOT NULL DEFAULT '[]',
  
  -- Invitation
  invited_by UUID REFERENCES platform_admins(id),
  invited_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_platform_admins_email ON platform_admins(email);
CREATE INDEX idx_platform_admins_role ON platform_admins(admin_role);

-- NO RLS on platform_admins - they need cross-tenant access

-- ============================================================================
-- LAYER 3: SERVICE API KEYS (Machine Auth)
-- Primary storage in DynamoDB for speed, PostgreSQL for audit/analytics
-- ============================================================================

-- API Key metadata (for admin dashboard queries)
CREATE TABLE IF NOT EXISTS service_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Key identification
  key_prefix VARCHAR(20) NOT NULL, -- e.g., "rk_live_abc123"
  key_hash VARCHAR(255) NOT NULL, -- bcrypt hash
  
  -- Metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Scopes
  scopes JSONB NOT NULL DEFAULT '["chat:read", "chat:write"]',
  
  -- Rate limiting
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  rate_limit_per_day INTEGER NOT NULL DEFAULT 10000,
  
  -- IP/Origin restrictions
  allowed_ips JSONB DEFAULT NULL,
  allowed_origins JSONB DEFAULT NULL,
  
  -- Expiration
  expires_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  usage_count BIGINT NOT NULL DEFAULT 0,
  
  -- Audit
  created_by UUID NOT NULL,
  revoked_by UUID,
  revoked_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_service_api_keys_tenant ON service_api_keys(tenant_id);
CREATE INDEX idx_service_api_keys_prefix ON service_api_keys(key_prefix);
CREATE INDEX idx_service_api_keys_active ON service_api_keys(is_active) WHERE is_active = true;

-- RLS Policy
ALTER TABLE service_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_api_keys_isolation ON service_api_keys
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- API Key Audit Log (partitioned by month)
CREATE TABLE IF NOT EXISTS service_api_key_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  key_id UUID NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  
  -- Action
  action VARCHAR(50) NOT NULL
    CHECK (action IN ('created', 'used', 'revoked', 'rotated', 'updated', 'rate_limited')),
  
  -- Request details (for 'used' action)
  ip_address INET,
  user_agent TEXT,
  endpoint VARCHAR(255),
  scopes_used JSONB,
  
  -- Result
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create partitions for current and next 3 months
CREATE TABLE service_api_key_audit_2026_01 PARTITION OF service_api_key_audit
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE service_api_key_audit_2026_02 PARTITION OF service_api_key_audit
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE service_api_key_audit_2026_03 PARTITION OF service_api_key_audit
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE service_api_key_audit_2026_04 PARTITION OF service_api_key_audit
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE INDEX idx_api_key_audit_tenant ON service_api_key_audit(tenant_id);
CREATE INDEX idx_api_key_audit_key ON service_api_key_audit(key_id);
CREATE INDEX idx_api_key_audit_created ON service_api_key_audit(created_at);

-- RLS Policy
ALTER TABLE service_api_key_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_api_key_audit_isolation ON service_api_key_audit
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- ENTERPRISE SSO CONNECTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_sso_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Provider info
  provider_type VARCHAR(20) NOT NULL CHECK (provider_type IN ('SAML', 'OIDC')),
  provider_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  
  -- SAML configuration
  saml_metadata_url VARCHAR(500),
  saml_metadata_xml TEXT,
  saml_entity_id VARCHAR(500),
  saml_acs_url VARCHAR(500),
  saml_slo_url VARCHAR(500),
  saml_signature_algorithm VARCHAR(50),
  saml_certificate TEXT,
  
  -- OIDC configuration
  oidc_issuer VARCHAR(500),
  oidc_authorization_endpoint VARCHAR(500),
  oidc_token_endpoint VARCHAR(500),
  oidc_userinfo_endpoint VARCHAR(500),
  oidc_client_id VARCHAR(255),
  oidc_client_secret_arn VARCHAR(500), -- Secrets Manager ARN
  
  -- Attribute mapping
  attribute_mapping JSONB NOT NULL DEFAULT '{
    "userId": "sub",
    "email": "email",
    "firstName": "given_name",
    "lastName": "family_name",
    "groups": "groups"
  }',
  
  -- Group to role mapping
  group_role_mapping JSONB NOT NULL DEFAULT '{}',
  
  -- Domain enforcement
  email_domains TEXT[] NOT NULL DEFAULT '{}',
  enforce_sso_for_domains BOOLEAN NOT NULL DEFAULT false,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT false,
  last_tested_at TIMESTAMPTZ,
  last_test_result VARCHAR(20),
  last_test_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique provider name per tenant
  CONSTRAINT tenant_sso_unique_provider UNIQUE (tenant_id, provider_name)
);

CREATE INDEX idx_tenant_sso_tenant ON tenant_sso_connections(tenant_id);
CREATE INDEX idx_tenant_sso_domains ON tenant_sso_connections USING GIN(email_domains);
CREATE INDEX idx_tenant_sso_active ON tenant_sso_connections(is_active) WHERE is_active = true;

-- RLS Policy
ALTER TABLE tenant_sso_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_sso_connections_isolation ON tenant_sso_connections
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- LITELLM GATEWAY CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS litellm_gateway_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- ECS Configuration
  min_tasks INTEGER NOT NULL DEFAULT 2,
  max_tasks INTEGER NOT NULL DEFAULT 50,
  desired_tasks INTEGER NOT NULL DEFAULT 2,
  task_cpu INTEGER NOT NULL DEFAULT 2048,
  task_memory INTEGER NOT NULL DEFAULT 4096,
  
  -- Auto-scaling
  target_cpu_utilization INTEGER NOT NULL DEFAULT 70,
  target_memory_utilization INTEGER NOT NULL DEFAULT 80,
  target_requests_per_target INTEGER NOT NULL DEFAULT 1000,
  scale_out_cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  scale_in_cooldown_seconds INTEGER NOT NULL DEFAULT 300,
  
  -- Health Check
  health_check_path VARCHAR(100) NOT NULL DEFAULT '/health',
  health_check_interval_seconds INTEGER NOT NULL DEFAULT 30,
  health_check_timeout_seconds INTEGER NOT NULL DEFAULT 10,
  unhealthy_threshold_count INTEGER NOT NULL DEFAULT 3,
  
  -- Load Balancer
  deregistration_delay_seconds INTEGER NOT NULL DEFAULT 30,
  idle_timeout_seconds INTEGER NOT NULL DEFAULT 60,
  
  -- Rate Limiting
  global_rate_limit_per_second INTEGER NOT NULL DEFAULT 10000,
  per_tenant_rate_limit_per_minute INTEGER NOT NULL DEFAULT 1000,
  
  -- Caching
  enable_response_caching BOOLEAN NOT NULL DEFAULT true,
  cache_ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  
  -- Retry
  max_retries INTEGER NOT NULL DEFAULT 3,
  retry_delay_ms INTEGER NOT NULL DEFAULT 1000,
  
  -- Timeouts
  request_timeout_seconds INTEGER NOT NULL DEFAULT 600,
  connection_timeout_seconds INTEGER NOT NULL DEFAULT 30,
  
  -- Timestamps
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL
);

-- Insert default configuration
INSERT INTO litellm_gateway_config (id, updated_by) 
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SYSTEM COMPONENT HEALTH (for dashboard)
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_component_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  current_capacity INTEGER,
  max_capacity INTEGER,
  utilization_percent DECIMAL(5,2),
  latency_ms INTEGER,
  error_rate DECIMAL(5,4),
  metrics JSONB DEFAULT '[]',
  last_checked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed components
INSERT INTO system_component_health (component, display_name) VALUES
  ('litellm_gateway', 'LiteLLM Gateway'),
  ('aurora_postgresql', 'Aurora PostgreSQL'),
  ('neptune_graph', 'Neptune Graph'),
  ('elasticache_redis', 'ElastiCache Redis'),
  ('lambda_chat', 'Lambda Chat'),
  ('lambda_ingestion', 'Lambda Ingestion'),
  ('lambda_admin', 'Lambda Admin'),
  ('api_gateway', 'API Gateway'),
  ('cognito_user_pool', 'Cognito User Pool'),
  ('cognito_admin_pool', 'Cognito Admin Pool'),
  ('s3_storage', 'S3 Storage'),
  ('sqs_queues', 'SQS Queues')
ON CONFLICT (component) DO NOTHING;

-- ============================================================================
-- SYSTEM ALERTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  component VARCHAR(50) NOT NULL,
  metric VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  current_value DECIMAL(20,6),
  threshold DECIMAL(20,6),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_alerts_component ON system_alerts(component);
CREATE INDEX idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX idx_system_alerts_active ON system_alerts(resolved_at) WHERE resolved_at IS NULL;

-- ============================================================================
-- ADD AUTH CONFIG TO SYSTEM_CONFIGURATION
-- ============================================================================

-- Add new configuration categories if not exists
INSERT INTO configuration_categories (id, name, description, display_order, icon) VALUES
  ('authentication', 'Authentication', 'User authentication and MFA settings', 0, 'Key'),
  ('api_keys', 'API Keys', 'Service API key configuration', 0.5, 'Lock'),
  ('litellm', 'LiteLLM Gateway', 'AI Gateway scaling and configuration', 0.6, 'Zap'),
  ('sso', 'Enterprise SSO', 'SAML and OIDC federation settings', 0.7, 'Users')
ON CONFLICT (id) DO NOTHING;

-- Add authentication configurations
INSERT INTO system_configuration (key, category_id, value_type, value_integer, display_name, description, unit, min_value, max_value) VALUES
  ('authentication.password_min_length', 'authentication', 'integer', 12, 'Minimum Password Length', 'Minimum characters required for passwords', 'chars', 8, 128),
  ('authentication.mfa_required_tier', 'authentication', 'integer', 3, 'MFA Required From Tier', 'Tier level at which MFA becomes mandatory', 'tier', 1, 5),
  ('authentication.session_timeout_minutes', 'authentication', 'integer', 60, 'Session Timeout', 'Inactive session expiration time', 'minutes', 5, 1440),
  ('authentication.max_login_attempts', 'authentication', 'integer', 5, 'Max Login Attempts', 'Failed attempts before lockout', 'attempts', 3, 10),
  ('authentication.lockout_duration_minutes', 'authentication', 'integer', 15, 'Lockout Duration', 'Account lockout time after failed attempts', 'minutes', 5, 60)
ON CONFLICT (key) DO NOTHING;

-- Add API key configurations
INSERT INTO system_configuration (key, category_id, value_type, value_integer, display_name, description, unit, min_value, max_value) VALUES
  ('api_keys.max_per_tenant', 'api_keys', 'integer', 50, 'Max API Keys Per Tenant', 'Maximum API keys a tenant can create', 'keys', 5, 500),
  ('api_keys.default_rate_limit_per_minute', 'api_keys', 'integer', 60, 'Default Rate Limit (per minute)', 'Default requests per minute for new API keys', 'requests', 10, 10000),
  ('api_keys.default_rate_limit_per_day', 'api_keys', 'integer', 10000, 'Default Rate Limit (per day)', 'Default requests per day for new API keys', 'requests', 100, 1000000)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at for new tables
CREATE TRIGGER update_tenant_users_updated_at 
  BEFORE UPDATE ON tenant_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_admins_updated_at 
  BEFORE UPDATE ON platform_admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_api_keys_updated_at 
  BEFORE UPDATE ON service_api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_sso_connections_updated_at 
  BEFORE UPDATE ON tenant_sso_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_litellm_gateway_config_updated_at 
  BEFORE UPDATE ON litellm_gateway_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_component_health_updated_at 
  BEFORE UPDATE ON system_component_health
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to increment API key usage count
CREATE OR REPLACE FUNCTION increment_api_key_usage(p_key_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE service_api_keys 
  SET usage_count = usage_count + 1,
      last_used_at = NOW()
  WHERE id = p_key_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if SSO is enforced for an email domain
CREATE OR REPLACE FUNCTION is_sso_enforced_for_email(p_tenant_id UUID, p_email VARCHAR)
RETURNS TABLE(enforced BOOLEAN, connection_id UUID, provider_name VARCHAR) AS $$
DECLARE
  v_domain VARCHAR;
BEGIN
  -- Extract domain from email
  v_domain := split_part(p_email, '@', 2);
  
  RETURN QUERY
  SELECT 
    sso.enforce_sso_for_domains,
    sso.id,
    sso.provider_name
  FROM tenant_sso_connections sso
  WHERE sso.tenant_id = p_tenant_id
    AND sso.is_active = true
    AND v_domain = ANY(sso.email_domains)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- GRANTS (adjust based on your IAM roles)
-- ============================================================================

-- Grant access to application role
-- GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_users TO radiant_app;
-- GRANT SELECT ON platform_admins TO radiant_app;
-- GRANT SELECT, INSERT, UPDATE ON service_api_keys TO radiant_app;
-- GRANT INSERT ON service_api_key_audit TO radiant_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_sso_connections TO radiant_app;
-- GRANT SELECT, UPDATE ON litellm_gateway_config TO radiant_admin;
-- GRANT SELECT, UPDATE ON system_component_health TO radiant_admin;
