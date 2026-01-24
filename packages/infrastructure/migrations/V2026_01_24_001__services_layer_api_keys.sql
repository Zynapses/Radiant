-- ============================================================================
-- RADIANT v5.52.5 - Services Layer API Keys & Interface Access Control
-- Migration: V2026_01_24_001__services_layer_api_keys.sql
--
-- Implements:
-- 1. PostgreSQL api_keys table with interface_type (A2A, MCP, API)
-- 2. Interface-based access control
-- 3. Key sync mechanism between admin apps
-- 4. Audit logging for key operations
-- ============================================================================

-- ============================================================================
-- 1. API Keys Table (replaces DynamoDB for main operations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Key identification
  name VARCHAR(255) NOT NULL,
  description TEXT,
  key_prefix VARCHAR(20) NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  
  -- Interface type - CRITICAL for access control
  interface_type VARCHAR(20) NOT NULL CHECK (interface_type IN ('api', 'mcp', 'a2a', 'all')),
  
  -- Scopes and permissions
  scopes TEXT[] NOT NULL DEFAULT ARRAY['chat', 'models'],
  allowed_endpoints TEXT[],  -- NULL = all endpoints for interface
  denied_endpoints TEXT[],   -- Explicit denials
  
  -- Rate limiting
  rate_limit_per_minute INTEGER,
  rate_limit_per_hour INTEGER,
  rate_limit_per_day INTEGER,
  
  -- Validity
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  use_count INTEGER NOT NULL DEFAULT 0,
  
  -- A2A specific fields
  a2a_agent_id VARCHAR(255),
  a2a_agent_type VARCHAR(100),
  a2a_allowed_operations TEXT[],
  a2a_mtls_required BOOLEAN DEFAULT true,
  a2a_client_cert_fingerprint VARCHAR(128),
  
  -- MCP specific fields
  mcp_allowed_tools TEXT[],
  mcp_allowed_resources TEXT[],
  mcp_protocol_version VARCHAR(20) DEFAULT '2025-03-26',
  
  -- Metadata
  created_by UUID,
  created_by_app VARCHAR(50) CHECK (created_by_app IN ('radiant_admin', 'thinktank_admin', 'api', 'system')),
  metadata JSONB DEFAULT '{}',
  tags TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  revoked_reason TEXT,
  
  UNIQUE(tenant_id, key_prefix),
  UNIQUE(key_hash)
);

-- Indexes for fast lookups
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_interface ON api_keys(interface_type);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX idx_api_keys_a2a_agent ON api_keys(a2a_agent_id) WHERE interface_type = 'a2a';

-- RLS Policy
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_keys_tenant_isolation ON api_keys
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- 2. API Key Audit Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_key_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  
  -- Action details
  action VARCHAR(50) NOT NULL CHECK (action IN (
    'created', 'updated', 'revoked', 'restored', 'used', 'rate_limited',
    'expired', 'scope_denied', 'interface_denied', 'endpoint_denied',
    'a2a_auth_success', 'a2a_auth_failure', 'mcp_auth_success', 'mcp_auth_failure'
  )),
  
  -- Context
  key_prefix VARCHAR(20),
  interface_type VARCHAR(20),
  endpoint_accessed VARCHAR(500),
  
  -- Request details
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(100),
  
  -- A2A specific
  a2a_agent_id VARCHAR(255),
  a2a_operation VARCHAR(100),
  
  -- Result
  success BOOLEAN NOT NULL DEFAULT true,
  error_code VARCHAR(50),
  error_message TEXT,
  
  -- Actor
  actor_user_id UUID,
  actor_type VARCHAR(50) CHECK (actor_type IN ('user', 'admin', 'system', 'agent')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_api_key_audit_tenant ON api_key_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_api_key_audit_key ON api_key_audit_log(key_id, created_at DESC);
CREATE INDEX idx_api_key_audit_action ON api_key_audit_log(action, created_at DESC);
CREATE INDEX idx_api_key_audit_a2a ON api_key_audit_log(a2a_agent_id) WHERE a2a_agent_id IS NOT NULL;

-- RLS Policy
ALTER TABLE api_key_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_key_audit_tenant_isolation ON api_key_audit_log
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- 3. Interface Access Policies
-- ============================================================================

CREATE TABLE IF NOT EXISTS interface_access_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Policy scope (NULL tenant_id = global policy)
  interface_type VARCHAR(20) NOT NULL CHECK (interface_type IN ('api', 'mcp', 'a2a')),
  
  -- Access rules
  require_authentication BOOLEAN NOT NULL DEFAULT true,
  require_mtls BOOLEAN DEFAULT false,
  allowed_ip_ranges CIDR[],
  blocked_ip_ranges CIDR[],
  
  -- Rate limits (per interface)
  global_rate_limit_per_minute INTEGER,
  global_rate_limit_per_hour INTEGER,
  
  -- A2A specific policies
  a2a_allowed_agent_types TEXT[],
  a2a_require_registration BOOLEAN DEFAULT true,
  a2a_max_concurrent_connections INTEGER DEFAULT 100,
  
  -- MCP specific policies
  mcp_allowed_protocol_versions TEXT[] DEFAULT ARRAY['2024-11-05', '2025-03-26'],
  mcp_require_capability_negotiation BOOLEAN DEFAULT true,
  mcp_max_tools_per_request INTEGER DEFAULT 50,
  
  -- Feature flags
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, interface_type)
);

-- Insert default global policies
INSERT INTO interface_access_policies (tenant_id, interface_type, require_authentication, require_mtls)
VALUES
  (NULL, 'api', true, false),
  (NULL, 'mcp', true, false),
  (NULL, 'a2a', true, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. A2A Agent Registry (for agent authentication)
-- ============================================================================

CREATE TABLE IF NOT EXISTS a2a_registered_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Agent identification
  agent_id VARCHAR(255) NOT NULL,
  agent_name VARCHAR(255) NOT NULL,
  agent_type VARCHAR(100) NOT NULL,
  agent_version VARCHAR(50),
  
  -- Authentication
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  mtls_cert_fingerprint VARCHAR(128),
  mtls_cert_expires_at TIMESTAMPTZ,
  
  -- Capabilities
  supported_operations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  supported_protocols TEXT[] DEFAULT ARRAY['a2a-v1'],
  max_concurrent_requests INTEGER DEFAULT 10,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked', 'pending')),
  last_heartbeat_at TIMESTAMPTZ,
  last_request_at TIMESTAMPTZ,
  total_requests INTEGER NOT NULL DEFAULT 0,
  
  -- Contact
  owner_email VARCHAR(255),
  webhook_url VARCHAR(500),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, agent_id)
);

CREATE INDEX idx_a2a_agents_tenant ON a2a_registered_agents(tenant_id);
CREATE INDEX idx_a2a_agents_status ON a2a_registered_agents(status) WHERE status = 'active';
CREATE INDEX idx_a2a_agents_type ON a2a_registered_agents(agent_type);

-- RLS Policy
ALTER TABLE a2a_registered_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY a2a_agents_tenant_isolation ON a2a_registered_agents
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- 5. Key Sync Log (for admin app synchronization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_key_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  
  -- Sync details
  source_app VARCHAR(50) NOT NULL CHECK (source_app IN ('radiant_admin', 'thinktank_admin')),
  target_app VARCHAR(50) NOT NULL CHECK (target_app IN ('radiant_admin', 'thinktank_admin')),
  sync_type VARCHAR(20) NOT NULL CHECK (sync_type IN ('create', 'update', 'revoke', 'delete')),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed', 'skipped')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  
  -- Metadata
  changes JSONB
);

CREATE INDEX idx_key_sync_pending ON api_key_sync_log(status, created_at) WHERE status = 'pending';

-- ============================================================================
-- 6. Functions for API Key Operations
-- ============================================================================

-- Function to validate API key and check interface access
CREATE OR REPLACE FUNCTION validate_api_key_for_interface(
  p_key_hash VARCHAR,
  p_interface_type VARCHAR,
  p_endpoint VARCHAR DEFAULT NULL
) RETURNS TABLE (
  is_valid BOOLEAN,
  key_id UUID,
  tenant_id UUID,
  scopes TEXT[],
  error_code VARCHAR,
  error_message TEXT
) AS $$
DECLARE
  v_key RECORD;
  v_policy RECORD;
BEGIN
  -- Find the key
  SELECT * INTO v_key FROM api_keys
  WHERE key_hash = p_key_hash AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::TEXT[], 'INVALID_KEY'::VARCHAR, 'API key not found or inactive'::TEXT;
    RETURN;
  END IF;
  
  -- Check expiration
  IF v_key.expires_at IS NOT NULL AND v_key.expires_at < NOW() THEN
    RETURN QUERY SELECT false, v_key.id, v_key.tenant_id, v_key.scopes, 'KEY_EXPIRED'::VARCHAR, 'API key has expired'::TEXT;
    RETURN;
  END IF;
  
  -- Check interface type
  IF v_key.interface_type != 'all' AND v_key.interface_type != p_interface_type THEN
    RETURN QUERY SELECT false, v_key.id, v_key.tenant_id, v_key.scopes, 'INTERFACE_DENIED'::VARCHAR, 
      format('Key not authorized for %s interface', p_interface_type)::TEXT;
    RETURN;
  END IF;
  
  -- Check endpoint restrictions
  IF p_endpoint IS NOT NULL THEN
    -- Check denied endpoints
    IF v_key.denied_endpoints IS NOT NULL AND p_endpoint = ANY(v_key.denied_endpoints) THEN
      RETURN QUERY SELECT false, v_key.id, v_key.tenant_id, v_key.scopes, 'ENDPOINT_DENIED'::VARCHAR, 
        format('Endpoint %s is explicitly denied', p_endpoint)::TEXT;
      RETURN;
    END IF;
    
    -- Check allowed endpoints (if specified)
    IF v_key.allowed_endpoints IS NOT NULL AND array_length(v_key.allowed_endpoints, 1) > 0 THEN
      IF NOT p_endpoint = ANY(v_key.allowed_endpoints) THEN
        RETURN QUERY SELECT false, v_key.id, v_key.tenant_id, v_key.scopes, 'ENDPOINT_DENIED'::VARCHAR, 
          format('Endpoint %s is not in allowed list', p_endpoint)::TEXT;
        RETURN;
      END IF;
    END IF;
  END IF;
  
  -- Update usage
  UPDATE api_keys SET
    last_used_at = NOW(),
    use_count = use_count + 1,
    updated_at = NOW()
  WHERE id = v_key.id;
  
  -- Success
  RETURN QUERY SELECT true, v_key.id, v_key.tenant_id, v_key.scopes, NULL::VARCHAR, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to create API key with interface type
CREATE OR REPLACE FUNCTION create_api_key(
  p_tenant_id UUID,
  p_name VARCHAR,
  p_interface_type VARCHAR,
  p_key_prefix VARCHAR,
  p_key_hash VARCHAR,
  p_scopes TEXT[] DEFAULT ARRAY['chat', 'models'],
  p_created_by UUID DEFAULT NULL,
  p_created_by_app VARCHAR DEFAULT 'api',
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_a2a_agent_id VARCHAR DEFAULT NULL,
  p_mcp_allowed_tools TEXT[] DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_key_id UUID;
BEGIN
  INSERT INTO api_keys (
    tenant_id, name, interface_type, key_prefix, key_hash, scopes,
    created_by, created_by_app, expires_at, a2a_agent_id, mcp_allowed_tools
  ) VALUES (
    p_tenant_id, p_name, p_interface_type, p_key_prefix, p_key_hash, p_scopes,
    p_created_by, p_created_by_app, p_expires_at, p_a2a_agent_id, p_mcp_allowed_tools
  ) RETURNING id INTO v_key_id;
  
  -- Log creation
  INSERT INTO api_key_audit_log (
    tenant_id, key_id, action, key_prefix, interface_type,
    actor_user_id, actor_type, success
  ) VALUES (
    p_tenant_id, v_key_id, 'created', p_key_prefix, p_interface_type,
    p_created_by, CASE WHEN p_created_by IS NOT NULL THEN 'admin' ELSE 'system' END, true
  );
  
  -- Queue sync if created from admin app
  IF p_created_by_app IN ('radiant_admin', 'thinktank_admin') THEN
    INSERT INTO api_key_sync_log (key_id, source_app, target_app, sync_type, changes)
    VALUES (
      v_key_id,
      p_created_by_app,
      CASE WHEN p_created_by_app = 'radiant_admin' THEN 'thinktank_admin' ELSE 'radiant_admin' END,
      'create',
      jsonb_build_object('name', p_name, 'interface_type', p_interface_type, 'scopes', p_scopes)
    );
  END IF;
  
  RETURN v_key_id;
END;
$$ LANGUAGE plpgsql;

-- Function to revoke API key
CREATE OR REPLACE FUNCTION revoke_api_key(
  p_key_id UUID,
  p_revoked_by UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_key RECORD;
BEGIN
  SELECT * INTO v_key FROM api_keys WHERE id = p_key_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  UPDATE api_keys SET
    is_active = false,
    revoked_at = NOW(),
    revoked_by = p_revoked_by,
    revoked_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_key_id;
  
  -- Log revocation
  INSERT INTO api_key_audit_log (
    tenant_id, key_id, action, key_prefix, interface_type,
    actor_user_id, actor_type, success, metadata
  ) VALUES (
    v_key.tenant_id, p_key_id, 'revoked', v_key.key_prefix, v_key.interface_type,
    p_revoked_by, 'admin', true, jsonb_build_object('reason', p_reason)
  );
  
  -- Queue sync
  INSERT INTO api_key_sync_log (key_id, source_app, target_app, sync_type, changes)
  VALUES (
    p_key_id,
    'radiant_admin',
    'thinktank_admin',
    'revoke',
    jsonb_build_object('revoked_by', p_revoked_by, 'reason', p_reason)
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Triggers
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_api_keys_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_api_keys_timestamp();

CREATE TRIGGER interface_policies_updated_at
  BEFORE UPDATE ON interface_access_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_api_keys_timestamp();

CREATE TRIGGER a2a_agents_updated_at
  BEFORE UPDATE ON a2a_registered_agents
  FOR EACH ROW
  EXECUTE FUNCTION update_api_keys_timestamp();

-- ============================================================================
-- 8. Views for Admin Dashboard
-- ============================================================================

CREATE OR REPLACE VIEW v_api_keys_summary AS
SELECT
  ak.tenant_id,
  ak.interface_type,
  COUNT(*) AS total_keys,
  COUNT(*) FILTER (WHERE ak.is_active) AS active_keys,
  COUNT(*) FILTER (WHERE NOT ak.is_active) AS revoked_keys,
  COUNT(*) FILTER (WHERE ak.expires_at < NOW()) AS expired_keys,
  SUM(ak.use_count) AS total_uses,
  MAX(ak.last_used_at) AS last_used_at
FROM api_keys ak
GROUP BY ak.tenant_id, ak.interface_type;

CREATE OR REPLACE VIEW v_a2a_agents_summary AS
SELECT
  aa.tenant_id,
  aa.agent_type,
  COUNT(*) AS total_agents,
  COUNT(*) FILTER (WHERE aa.status = 'active') AS active_agents,
  SUM(aa.total_requests) AS total_requests,
  MAX(aa.last_request_at) AS last_request_at
FROM a2a_registered_agents aa
GROUP BY aa.tenant_id, aa.agent_type;

-- ============================================================================
-- 9. Comments
-- ============================================================================

COMMENT ON TABLE api_keys IS 'API keys with interface type separation (API, MCP, A2A)';
COMMENT ON COLUMN api_keys.interface_type IS 'Interface this key is authorized for: api, mcp, a2a, or all';
COMMENT ON COLUMN api_keys.a2a_agent_id IS 'For A2A keys, the registered agent ID';
COMMENT ON COLUMN api_keys.mcp_allowed_tools IS 'For MCP keys, list of allowed tool names';
COMMENT ON TABLE a2a_registered_agents IS 'Registry of external agents authorized for A2A communication';
COMMENT ON TABLE interface_access_policies IS 'Per-interface access control policies';
