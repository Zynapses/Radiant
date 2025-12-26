-- RADIANT v4.17.0 - Migration 015: External Credentials Registry
-- Secure credential storage with encryption and auditing

CREATE TABLE credential_vaults (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vault_name VARCHAR(100) NOT NULL,
    description TEXT,
    encryption_key_arn VARCHAR(500) NOT NULL,
    created_by UUID REFERENCES administrators(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, vault_name)
);

CREATE TABLE stored_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vault_id UUID NOT NULL REFERENCES credential_vaults(id) ON DELETE CASCADE,
    credential_name VARCHAR(100) NOT NULL,
    credential_type VARCHAR(50) NOT NULL CHECK (credential_type IN ('api_key', 'oauth_token', 'password', 'certificate', 'ssh_key', 'other')),
    encrypted_value BYTEA NOT NULL,
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    last_rotated TIMESTAMPTZ,
    rotation_schedule VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(vault_id, credential_name)
);

CREATE TABLE credential_access_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credential_id UUID NOT NULL REFERENCES stored_credentials(id) ON DELETE CASCADE,
    accessed_by UUID REFERENCES users(id),
    access_type VARCHAR(50) NOT NULL CHECK (access_type IN ('read', 'create', 'update', 'rotate', 'delete')),
    access_reason TEXT,
    source_ip VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vaults_tenant ON credential_vaults(tenant_id);
CREATE INDEX idx_credentials_vault ON stored_credentials(vault_id);
CREATE INDEX idx_credentials_active ON stored_credentials(is_active) WHERE is_active = true;
CREATE INDEX idx_credentials_expiring ON stored_credentials(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_credential_access_log ON credential_access_log(credential_id, created_at DESC);

ALTER TABLE credential_vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE stored_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY vault_isolation ON credential_vaults
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY credentials_isolation ON stored_credentials
    FOR ALL USING (
        vault_id IN (
            SELECT id FROM credential_vaults 
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

CREATE POLICY access_log_isolation ON credential_access_log
    FOR ALL USING (
        credential_id IN (
            SELECT sc.id FROM stored_credentials sc
            JOIN credential_vaults cv ON sc.vault_id = cv.id
            WHERE cv.tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

-- View for expiring credentials
CREATE OR REPLACE VIEW v_expiring_credentials AS
SELECT 
    cv.tenant_id,
    cv.vault_name,
    sc.credential_name,
    sc.credential_type,
    sc.expires_at,
    sc.last_rotated,
    EXTRACT(DAY FROM sc.expires_at - NOW()) as days_until_expiry
FROM stored_credentials sc
JOIN credential_vaults cv ON sc.vault_id = cv.id
WHERE sc.is_active = true
AND sc.expires_at IS NOT NULL
AND sc.expires_at < NOW() + INTERVAL '30 days'
ORDER BY sc.expires_at;

CREATE TRIGGER update_credential_vaults_updated_at 
    BEFORE UPDATE ON credential_vaults
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stored_credentials_updated_at 
    BEFORE UPDATE ON stored_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
