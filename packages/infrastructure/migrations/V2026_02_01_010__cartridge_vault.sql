-- ============================================================================
-- Cartridge Vault (Keyhole Pattern) Schema
-- Secrets management for cartridges - cartridges declare required secrets
-- but never contain actual credentials. Service Layer fetches from Genesis Vault.
-- 
-- Version: 1.0.0
-- Date: 2026-02-01
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

CREATE TYPE vault_secret_category AS ENUM (
  'api_key',
  'database',
  'oauth',
  'encryption',
  'webhook',
  'custom'
);

CREATE TYPE vault_access_type AS ENUM (
  'read',
  'write',
  'rotate',
  'delete'
);

-- ----------------------------------------------------------------------------
-- Vault Secrets Table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vault_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Secret identity
  key VARCHAR(255) NOT NULL,
  category vault_secret_category NOT NULL DEFAULT 'custom',
  description TEXT,
  
  -- Encrypted value (KMS encrypted)
  encrypted_value TEXT NOT NULL,
  kms_key_arn VARCHAR(512) NOT NULL,
  
  -- Version tracking
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Access tracking
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  
  -- Lifecycle
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  rotation_schedule VARCHAR(100), -- cron expression
  last_rotated_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique key per tenant
  CONSTRAINT vault_secrets_tenant_key_unique UNIQUE (tenant_id, key)
);

-- Enable RLS
ALTER TABLE vault_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY vault_secrets_tenant_isolation ON vault_secrets
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Indexes
CREATE INDEX idx_vault_secrets_tenant ON vault_secrets(tenant_id);
CREATE INDEX idx_vault_secrets_category ON vault_secrets(tenant_id, category);
CREATE INDEX idx_vault_secrets_expiring ON vault_secrets(expires_at) WHERE expires_at IS NOT NULL AND is_active = true;

-- ----------------------------------------------------------------------------
-- Vault Access Log (Partitioned by month)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vault_access_log (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  secret_id UUID NOT NULL,
  secret_key VARCHAR(255) NOT NULL,
  
  -- Access details
  accessed_by VARCHAR(255) NOT NULL,
  access_type vault_access_type NOT NULL,
  
  -- Context
  cartridge_id UUID,
  operation_id UUID,
  
  -- Result
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  
  -- Request info
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create partitions for 12 months
DO $$
DECLARE
  start_date DATE := '2026-01-01';
  end_date DATE;
  partition_name TEXT;
BEGIN
  FOR i IN 0..11 LOOP
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'vault_access_log_' || TO_CHAR(start_date, 'YYYY_MM');
    
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF vault_access_log
       FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );
    
    start_date := end_date;
  END LOOP;
END $$;

-- Indexes on partitioned table
CREATE INDEX idx_vault_access_log_tenant ON vault_access_log(tenant_id, timestamp);
CREATE INDEX idx_vault_access_log_secret ON vault_access_log(secret_id, timestamp);
CREATE INDEX idx_vault_access_log_cartridge ON vault_access_log(cartridge_id, timestamp) WHERE cartridge_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Cartridge Vault Requirements
-- Tracks which secrets each cartridge requires
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cartridge_vault_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cartridge_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Requirement details
  secret_key VARCHAR(255) NOT NULL,
  description TEXT,
  category vault_secret_category NOT NULL DEFAULT 'custom',
  is_required BOOLEAN NOT NULL DEFAULT true,
  
  -- Validation
  validation_pattern TEXT,
  example_format TEXT,
  env_fallback JSONB, -- Array of env var names
  
  -- Status
  is_satisfied BOOLEAN NOT NULL DEFAULT false,
  last_checked_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT cartridge_vault_req_unique UNIQUE (cartridge_id, secret_key)
);

-- Enable RLS
ALTER TABLE cartridge_vault_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY cartridge_vault_requirements_tenant_isolation ON cartridge_vault_requirements
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Indexes
CREATE INDEX idx_cartridge_vault_req_cartridge ON cartridge_vault_requirements(cartridge_id);
CREATE INDEX idx_cartridge_vault_req_tenant ON cartridge_vault_requirements(tenant_id);
CREATE INDEX idx_cartridge_vault_req_unsatisfied ON cartridge_vault_requirements(tenant_id, is_satisfied) WHERE is_satisfied = false;

-- ----------------------------------------------------------------------------
-- Vault Secret History (for rotation tracking)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vault_secret_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID NOT NULL REFERENCES vault_secrets(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Version info
  version INTEGER NOT NULL,
  
  -- Encrypted old value (for rollback if needed)
  encrypted_value TEXT NOT NULL,
  kms_key_arn VARCHAR(512) NOT NULL,
  
  -- Rotation details
  rotated_by VARCHAR(255) NOT NULL,
  rotation_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE vault_secret_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY vault_secret_history_tenant_isolation ON vault_secret_history
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Index
CREATE INDEX idx_vault_secret_history_secret ON vault_secret_history(secret_id, version DESC);

-- ----------------------------------------------------------------------------
-- Update trigger
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_vault_secrets_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vault_secrets_update_timestamp
  BEFORE UPDATE ON vault_secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_vault_secrets_timestamp();

CREATE TRIGGER cartridge_vault_requirements_update_timestamp
  BEFORE UPDATE ON cartridge_vault_requirements
  FOR EACH ROW
  EXECUTE FUNCTION update_vault_secrets_timestamp();

-- ----------------------------------------------------------------------------
-- Helper functions
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_vault_requirements(p_cartridge_id UUID, p_tenant_id UUID)
RETURNS TABLE (
  secret_key VARCHAR,
  is_required BOOLEAN,
  is_satisfied BOOLEAN,
  expires_soon BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.secret_key,
    r.is_required,
    CASE WHEN s.id IS NOT NULL AND s.is_active THEN true ELSE false END as is_satisfied,
    CASE WHEN s.expires_at IS NOT NULL AND s.expires_at < NOW() + INTERVAL '30 days' THEN true ELSE false END as expires_soon
  FROM cartridge_vault_requirements r
  LEFT JOIN vault_secrets s ON s.tenant_id = r.tenant_id AND s.key = r.secret_key AND s.is_active = true
  WHERE r.cartridge_id = p_cartridge_id AND r.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Comments
-- ----------------------------------------------------------------------------

COMMENT ON TABLE vault_secrets IS 'Genesis Vault - encrypted secrets storage for Keyhole Pattern';
COMMENT ON TABLE vault_access_log IS 'Audit log for all vault secret access';
COMMENT ON TABLE cartridge_vault_requirements IS 'Secrets required by each cartridge (vault.req)';
COMMENT ON TABLE vault_secret_history IS 'History of secret rotations for audit and rollback';
