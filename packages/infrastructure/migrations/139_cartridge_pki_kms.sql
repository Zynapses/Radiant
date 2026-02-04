-- ============================================================================
-- RADIANT v5.1.0 - Cartridge PKI KMS Integration
-- Migration: 139_cartridge_pki_kms.sql
-- 
-- Adds KMS key tracking columns to existing PKI tables for real KMS integration.
-- Replaces placeholder strings with actual AWS KMS key references.
-- ============================================================================

-- Add KMS columns to tenant_ca_certificates if they don't exist
DO $$
BEGIN
  -- Add key_id column (KMS Key ID)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_ca_certificates' AND column_name = 'key_id'
  ) THEN
    ALTER TABLE tenant_ca_certificates ADD COLUMN key_id VARCHAR(64);
  END IF;

  -- Add key_arn column (KMS Key ARN)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_ca_certificates' AND column_name = 'key_arn'
  ) THEN
    ALTER TABLE tenant_ca_certificates ADD COLUMN key_arn VARCHAR(256);
  END IF;
END $$;

-- Add KMS columns to cartridge_signing_keys if they don't exist
DO $$
BEGIN
  -- Add key_arn column (KMS Key ARN)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cartridge_signing_keys' AND column_name = 'key_arn'
  ) THEN
    ALTER TABLE cartridge_signing_keys ADD COLUMN key_arn VARCHAR(256);
  END IF;

  -- Add ca_signature column (Signature from Tenant CA)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cartridge_signing_keys' AND column_name = 'ca_signature'
  ) THEN
    ALTER TABLE cartridge_signing_keys ADD COLUMN ca_signature TEXT;
  END IF;
END $$;

-- Update algorithm enum to include ECDSA P-256 (used by KMS)
DO $$
BEGIN
  -- Check if the enum value exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'ecdsa_p256' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'key_algorithm')
  ) THEN
    -- Add the new enum value if it doesn't exist
    ALTER TYPE key_algorithm ADD VALUE IF NOT EXISTS 'ecdsa_p256';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- key_algorithm enum doesn't exist, that's okay
    NULL;
END $$;

-- Create indexes for KMS key lookups
CREATE INDEX IF NOT EXISTS idx_tenant_ca_key_id ON tenant_ca_certificates(key_id) WHERE key_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_signing_keys_key_arn ON cartridge_signing_keys(key_arn) WHERE key_arn IS NOT NULL;

-- Create PKI audit log table if it doesn't exist
CREATE TABLE IF NOT EXISTS pki_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64),
  
  -- Operation
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(64) NOT NULL,
  
  -- Actor
  performed_by VARCHAR(128),
  performed_by_email VARCHAR(256),
  
  -- Result
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  
  -- Details
  details JSONB DEFAULT '{}',
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(64),
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_pki_audit_tenant ON pki_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pki_audit_action ON pki_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_pki_audit_target ON pki_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_pki_audit_created ON pki_audit_log(created_at);

-- Add RLS to audit log
ALTER TABLE pki_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy for tenant isolation
DROP POLICY IF EXISTS pki_audit_tenant_isolation ON pki_audit_log;
CREATE POLICY pki_audit_tenant_isolation ON pki_audit_log
  FOR ALL USING (
    tenant_id IS NULL OR 
    tenant_id = current_setting('app.current_tenant_id', true)
  );

-- RLS Policy for platform admin access
DROP POLICY IF EXISTS pki_audit_admin_access ON pki_audit_log;
CREATE POLICY pki_audit_admin_access ON pki_audit_log
  FOR ALL USING (current_setting('app.is_platform_admin', true)::BOOLEAN = true);

-- Comments
COMMENT ON COLUMN tenant_ca_certificates.key_id IS 'AWS KMS Key ID for the tenant CA asymmetric signing key';
COMMENT ON COLUMN tenant_ca_certificates.key_arn IS 'AWS KMS Key ARN for the tenant CA asymmetric signing key';
COMMENT ON COLUMN cartridge_signing_keys.key_arn IS 'AWS KMS Key ARN for the signing key';
COMMENT ON COLUMN cartridge_signing_keys.ca_signature IS 'Base64-encoded signature from the Tenant CA';
COMMENT ON TABLE pki_audit_log IS 'Audit log for all PKI operations including key generation, signing, and verification';
