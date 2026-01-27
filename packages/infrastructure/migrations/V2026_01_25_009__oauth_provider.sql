-- ============================================================================
-- RADIANT OAuth 2.0 Provider
-- Migration: V2026_01_25_009__oauth_provider.sql
-- 
-- RFC 6749 compliant OAuth Authorization Server for third-party app integration.
-- Enables MCP servers, Zapier, partner apps, and other integrations.
-- ============================================================================

-- ============================================================================
-- OAUTH CLIENTS (Registered Applications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Client identification
    client_id VARCHAR(64) NOT NULL UNIQUE,
    client_secret_hash VARCHAR(255),
    
    -- App info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url VARCHAR(500),
    homepage_url VARCHAR(500),
    privacy_policy_url VARCHAR(500),
    terms_of_service_url VARCHAR(500),
    
    -- Client type
    app_type VARCHAR(50) NOT NULL DEFAULT 'web_application'
        CHECK (app_type IN (
            'web_application',
            'native_application',
            'single_page_application',
            'machine_to_machine',
            'mcp_server'
        )),
    is_confidential BOOLEAN NOT NULL DEFAULT true,
    
    -- Redirect URIs (JSON array)
    redirect_uris JSONB NOT NULL DEFAULT '[]',
    
    -- Scopes
    allowed_scopes JSONB NOT NULL DEFAULT '["openid", "profile"]',
    default_scopes JSONB NOT NULL DEFAULT '["openid"]',
    
    -- Grant types allowed
    allowed_grant_types JSONB NOT NULL DEFAULT '["authorization_code", "refresh_token"]',
    
    -- Token settings
    access_token_ttl_seconds INTEGER DEFAULT 3600,
    refresh_token_ttl_seconds INTEGER DEFAULT 2592000,
    
    -- Rate limiting
    rate_limit_requests_per_minute INTEGER DEFAULT 60,
    rate_limit_tokens_per_day INTEGER DEFAULT 100000,
    
    -- Ownership
    created_by_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    created_by_user_id UUID,
    
    -- Approval status
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Tenant restrictions
    allowed_tenant_ids JSONB,
    blocked_tenant_ids JSONB DEFAULT '[]',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_oauth_clients_client_id ON oauth_clients(client_id);
CREATE INDEX idx_oauth_clients_status ON oauth_clients(status);
CREATE INDEX idx_oauth_clients_app_type ON oauth_clients(app_type);
CREATE INDEX idx_oauth_clients_created_by ON oauth_clients(created_by_tenant_id);

-- ============================================================================
-- OAUTH AUTHORIZATION CODES (Short-lived, 5 min TTL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Code
    code VARCHAR(128) NOT NULL UNIQUE,
    
    -- Client
    client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    
    -- User who authorized
    user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Authorization details
    redirect_uri VARCHAR(500) NOT NULL,
    scopes JSONB NOT NULL,
    state VARCHAR(500),
    
    -- PKCE
    code_challenge VARCHAR(128),
    code_challenge_method VARCHAR(10),
    
    -- Nonce (for OIDC)
    nonce VARCHAR(255),
    
    -- Status
    is_used BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMPTZ,
    
    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_codes_code ON oauth_authorization_codes(code);
CREATE INDEX idx_oauth_codes_client ON oauth_authorization_codes(client_id);
CREATE INDEX idx_oauth_codes_expires ON oauth_authorization_codes(expires_at);

-- ============================================================================
-- OAUTH ACCESS TOKENS
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Token (we store a hash, not the actual token)
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    token_prefix VARCHAR(16) NOT NULL,
    
    -- Client
    client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    
    -- User (NULL for client_credentials grant)
    user_id UUID REFERENCES tenant_users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Scopes granted
    scopes JSONB NOT NULL,
    
    -- Token metadata
    token_type VARCHAR(20) NOT NULL DEFAULT 'Bearer',
    
    -- Linked refresh token
    refresh_token_id UUID,
    
    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Revocation
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(100),
    
    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    use_count INTEGER NOT NULL DEFAULT 0,
    
    -- Client info
    client_ip INET,
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_access_tokens_hash ON oauth_access_tokens(token_hash);
CREATE INDEX idx_oauth_access_tokens_prefix ON oauth_access_tokens(token_prefix);
CREATE INDEX idx_oauth_access_tokens_client ON oauth_access_tokens(client_id);
CREATE INDEX idx_oauth_access_tokens_user ON oauth_access_tokens(user_id);
CREATE INDEX idx_oauth_access_tokens_expires ON oauth_access_tokens(expires_at);
CREATE INDEX idx_oauth_access_tokens_revoked ON oauth_access_tokens(is_revoked) WHERE is_revoked = false;

-- ============================================================================
-- OAUTH REFRESH TOKENS
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Token (we store a hash)
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    token_prefix VARCHAR(16) NOT NULL,
    
    -- Client
    client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    
    -- User
    user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Scopes granted
    scopes JSONB NOT NULL,
    
    -- Token chain (for rotation detection)
    generation INTEGER NOT NULL DEFAULT 1,
    previous_token_id UUID REFERENCES oauth_refresh_tokens(id),
    
    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Revocation
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(100),
    
    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    use_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_refresh_tokens_hash ON oauth_refresh_tokens(token_hash);
CREATE INDEX idx_oauth_refresh_tokens_prefix ON oauth_refresh_tokens(token_prefix);
CREATE INDEX idx_oauth_refresh_tokens_client ON oauth_refresh_tokens(client_id);
CREATE INDEX idx_oauth_refresh_tokens_user ON oauth_refresh_tokens(user_id);
CREATE INDEX idx_oauth_refresh_tokens_expires ON oauth_refresh_tokens(expires_at);

-- ============================================================================
-- USER AUTHORIZATIONS (Consent records)
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_user_authorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User
    user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Client
    client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    
    -- Granted scopes
    scopes JSONB NOT NULL,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    
    -- Unique constraint
    UNIQUE(user_id, client_id)
);

CREATE INDEX idx_oauth_user_auth_user ON oauth_user_authorizations(user_id);
CREATE INDEX idx_oauth_user_auth_client ON oauth_user_authorizations(client_id);
CREATE INDEX idx_oauth_user_auth_active ON oauth_user_authorizations(is_active) WHERE is_active = true;

-- ============================================================================
-- OAUTH SCOPE DEFINITIONS (Admin-configurable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_scope_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Scope identifier
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    
    -- Display
    display_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    -- Risk level
    risk_level VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (risk_level IN ('low', 'medium', 'high')),
    
    -- Allowed endpoints (JSON array)
    allowed_endpoints JSONB NOT NULL DEFAULT '[]',
    
    -- Admin controls
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    allowed_app_types JSONB NOT NULL DEFAULT '["web_application", "native_application"]',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_scopes_name ON oauth_scope_definitions(name);
CREATE INDEX idx_oauth_scopes_category ON oauth_scope_definitions(category);

-- ============================================================================
-- OAUTH AUDIT LOG (Partitioned by month)
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_audit_log (
    id UUID DEFAULT gen_random_uuid(),
    
    -- Event type
    event_type VARCHAR(50) NOT NULL,
    
    -- Context
    client_id UUID,
    user_id UUID,
    tenant_id UUID,
    
    -- Details
    scopes JSONB,
    details JSONB DEFAULT '{}',
    
    -- Request info
    ip_address INET,
    user_agent TEXT,
    
    -- Status
    success BOOLEAN NOT NULL DEFAULT true,
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for current and next months
CREATE TABLE oauth_audit_log_2026_01 PARTITION OF oauth_audit_log
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE oauth_audit_log_2026_02 PARTITION OF oauth_audit_log
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE oauth_audit_log_2026_03 PARTITION OF oauth_audit_log
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE INDEX idx_oauth_audit_client ON oauth_audit_log(client_id, created_at);
CREATE INDEX idx_oauth_audit_user ON oauth_audit_log(user_id, created_at);
CREATE INDEX idx_oauth_audit_type ON oauth_audit_log(event_type, created_at);

-- ============================================================================
-- TENANT OAUTH SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_oauth_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    
    -- Feature toggles
    oauth_enabled BOOLEAN NOT NULL DEFAULT true,
    allow_third_party_apps BOOLEAN NOT NULL DEFAULT true,
    require_app_approval BOOLEAN NOT NULL DEFAULT true,
    
    -- Restrictions
    allowed_app_types JSONB DEFAULT '["web_application", "native_application", "mcp_server"]',
    blocked_scopes JSONB DEFAULT '[]',
    max_authorizations_per_user INTEGER DEFAULT 50,
    
    -- Token settings
    default_access_token_ttl_seconds INTEGER DEFAULT 3600,
    default_refresh_token_ttl_seconds INTEGER DEFAULT 2592000,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SIGNING KEYS (For JWT signing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_signing_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Key identifier
    kid VARCHAR(64) NOT NULL UNIQUE,
    
    -- Key type
    algorithm VARCHAR(10) NOT NULL DEFAULT 'RS256',
    
    -- Key material (encrypted in Secrets Manager, this stores the ARN)
    private_key_secret_arn VARCHAR(500) NOT NULL,
    public_key_pem TEXT NOT NULL,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_oauth_signing_keys_active ON oauth_signing_keys(is_active) WHERE is_active = true;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_user_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_oauth_settings ENABLE ROW LEVEL SECURITY;

-- Clients: visible to admins and their creators
CREATE POLICY oauth_clients_admin_policy ON oauth_clients
    FOR ALL USING (
        created_by_tenant_id IS NULL 
        OR created_by_tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- Authorization codes: tenant isolation
CREATE POLICY oauth_auth_codes_tenant_policy ON oauth_authorization_codes
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Access tokens: tenant isolation
CREATE POLICY oauth_access_tokens_tenant_policy ON oauth_access_tokens
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Refresh tokens: tenant isolation
CREATE POLICY oauth_refresh_tokens_tenant_policy ON oauth_refresh_tokens
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- User authorizations: tenant isolation
CREATE POLICY oauth_user_auth_tenant_policy ON oauth_user_authorizations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Tenant settings: tenant isolation
CREATE POLICY tenant_oauth_settings_policy ON tenant_oauth_settings
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Cleanup expired tokens and codes
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_data()
RETURNS void AS $$
BEGIN
    -- Delete expired authorization codes (older than 1 hour)
    DELETE FROM oauth_authorization_codes
    WHERE expires_at < NOW() - INTERVAL '1 hour';
    
    -- Delete expired access tokens (older than their expiry + 7 days)
    DELETE FROM oauth_access_tokens
    WHERE expires_at < NOW() - INTERVAL '7 days';
    
    -- Delete expired refresh tokens (older than their expiry + 30 days)
    DELETE FROM oauth_refresh_tokens
    WHERE expires_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Revoke all tokens for a user-client pair
CREATE OR REPLACE FUNCTION revoke_oauth_authorization(
    p_user_id UUID,
    p_client_id UUID,
    p_reason VARCHAR DEFAULT 'user_revoked'
)
RETURNS void AS $$
BEGIN
    -- Revoke user authorization
    UPDATE oauth_user_authorizations
    SET is_active = false, revoked_at = NOW(), revoked_reason = p_reason
    WHERE user_id = p_user_id AND client_id = p_client_id;
    
    -- Revoke all access tokens
    UPDATE oauth_access_tokens
    SET is_revoked = true, revoked_at = NOW(), revoked_reason = p_reason
    WHERE user_id = p_user_id AND client_id = p_client_id AND is_revoked = false;
    
    -- Revoke all refresh tokens
    UPDATE oauth_refresh_tokens
    SET is_revoked = true, revoked_at = NOW(), revoked_reason = p_reason
    WHERE user_id = p_user_id AND client_id = p_client_id AND is_revoked = false;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_oauth_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER oauth_clients_updated_at
    BEFORE UPDATE ON oauth_clients
    FOR EACH ROW EXECUTE FUNCTION update_oauth_updated_at();

CREATE TRIGGER oauth_user_auth_updated_at
    BEFORE UPDATE ON oauth_user_authorizations
    FOR EACH ROW EXECUTE FUNCTION update_oauth_updated_at();

CREATE TRIGGER oauth_scope_definitions_updated_at
    BEFORE UPDATE ON oauth_scope_definitions
    FOR EACH ROW EXECUTE FUNCTION update_oauth_updated_at();

CREATE TRIGGER tenant_oauth_settings_updated_at
    BEFORE UPDATE ON tenant_oauth_settings
    FOR EACH ROW EXECUTE FUNCTION update_oauth_updated_at();

-- ============================================================================
-- SEED DEFAULT SCOPES
-- ============================================================================

INSERT INTO oauth_scope_definitions (name, category, display_name, description, risk_level, allowed_endpoints, requires_approval, allowed_app_types)
VALUES
    ('openid', 'profile', 'OpenID', 'Verify your identity', 'low', '[{"method": "GET", "path": "/oauth/userinfo"}]', false, '["web_application", "native_application", "single_page_application", "mcp_server"]'),
    ('profile', 'profile', 'Profile', 'Read your basic profile information', 'low', '[{"method": "GET", "path": "/oauth/userinfo"}, {"method": "GET", "path": "/api/v2/users/me"}]', false, '["web_application", "native_application", "single_page_application", "mcp_server"]'),
    ('email', 'profile', 'Email', 'Read your email address', 'low', '[{"method": "GET", "path": "/oauth/userinfo"}]', false, '["web_application", "native_application", "single_page_application", "mcp_server"]'),
    ('offline_access', 'profile', 'Offline Access', 'Access your data when you are not actively using the app', 'medium', '[]', false, '["web_application", "native_application", "mcp_server"]'),
    ('chat:read', 'chat', 'Read Conversations', 'View your conversations and messages', 'medium', '[{"method": "GET", "path": "/api/v2/conversations"}, {"method": "GET", "path": "/api/v2/conversations/*"}]', false, '["web_application", "native_application", "single_page_application", "mcp_server"]'),
    ('chat:write', 'chat', 'Send Messages', 'Create conversations and send messages', 'high', '[{"method": "POST", "path": "/api/v2/conversations"}, {"method": "POST", "path": "/api/v2/chat/completions"}]', true, '["web_application", "native_application", "mcp_server"]'),
    ('chat:delete', 'chat', 'Delete Conversations', 'Delete your conversations', 'high', '[{"method": "DELETE", "path": "/api/v2/conversations/*"}]', true, '["web_application", "native_application"]'),
    ('knowledge:read', 'knowledge', 'Query Knowledge Base', 'Search your knowledge base', 'medium', '[{"method": "POST", "path": "/api/v2/cortex/query"}, {"method": "GET", "path": "/api/v2/cortex/entities"}]', false, '["web_application", "native_application", "single_page_application", "mcp_server"]'),
    ('knowledge:write', 'knowledge', 'Add to Knowledge Base', 'Add information to your knowledge base', 'high', '[{"method": "POST", "path": "/api/v2/cortex/ingest"}, {"method": "POST", "path": "/api/v2/cortex/entities"}]', true, '["web_application", "native_application", "mcp_server"]'),
    ('models:read', 'models', 'List AI Models', 'View available AI models', 'low', '[{"method": "GET", "path": "/api/v2/models"}]', false, '["web_application", "native_application", "single_page_application", "machine_to_machine", "mcp_server"]'),
    ('usage:read', 'usage', 'View Usage', 'View your API usage', 'low', '[{"method": "GET", "path": "/api/v2/usage"}]', false, '["web_application", "native_application", "single_page_application"]'),
    ('files:read', 'files', 'Read Files', 'View your uploaded files', 'medium', '[{"method": "GET", "path": "/api/v2/files"}]', false, '["web_application", "native_application", "mcp_server"]'),
    ('files:write', 'files', 'Upload Files', 'Upload files on your behalf', 'high', '[{"method": "POST", "path": "/api/v2/files"}, {"method": "DELETE", "path": "/api/v2/files/*"}]', true, '["web_application", "native_application", "mcp_server"]'),
    ('agents:execute', 'agents', 'Execute Agents', 'Run AI agents on your behalf', 'high', '[{"method": "POST", "path": "/api/v2/agents/*/execute"}]', true, '["web_application", "native_application", "mcp_server"]')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE oauth_clients IS 'Registered third-party OAuth applications';
COMMENT ON TABLE oauth_authorization_codes IS 'Short-lived authorization codes for OAuth flow';
COMMENT ON TABLE oauth_access_tokens IS 'OAuth access tokens (JWT hashes)';
COMMENT ON TABLE oauth_refresh_tokens IS 'OAuth refresh tokens with rotation support';
COMMENT ON TABLE oauth_user_authorizations IS 'User consent records for OAuth apps';
COMMENT ON TABLE oauth_scope_definitions IS 'Admin-configurable OAuth scope definitions';
COMMENT ON TABLE oauth_audit_log IS 'Partitioned audit log for OAuth events';
COMMENT ON TABLE tenant_oauth_settings IS 'Per-tenant OAuth configuration';
COMMENT ON TABLE oauth_signing_keys IS 'RSA keys for JWT signing';
