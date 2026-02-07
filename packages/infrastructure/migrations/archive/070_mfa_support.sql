-- ============================================================================
-- RADIANT MFA Support Tables
-- Migration: 070_mfa_support.sql
-- Version: 5.52.28 (PROMPT-41B)
-- Date: 2026-01-25
-- Description: Two-Factor Authentication with role-based enforcement
-- ============================================================================

-- ============================================================================
-- ADD MFA COLUMNS TO TENANT_USERS
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_users' AND column_name = 'mfa_enabled') THEN
    ALTER TABLE tenant_users ADD COLUMN mfa_enabled BOOLEAN NOT NULL DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_users' AND column_name = 'mfa_enrolled_at') THEN
    ALTER TABLE tenant_users ADD COLUMN mfa_enrolled_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_users' AND column_name = 'mfa_method') THEN
    ALTER TABLE tenant_users ADD COLUMN mfa_method VARCHAR(20);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_users' AND column_name = 'mfa_totp_secret_encrypted') THEN
    ALTER TABLE tenant_users ADD COLUMN mfa_totp_secret_encrypted TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_users' AND column_name = 'mfa_failed_attempts') THEN
    ALTER TABLE tenant_users ADD COLUMN mfa_failed_attempts INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenant_users' AND column_name = 'mfa_locked_until') THEN
    ALTER TABLE tenant_users ADD COLUMN mfa_locked_until TIMESTAMPTZ;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'tenant_users_mfa_method_check') THEN
    ALTER TABLE tenant_users ADD CONSTRAINT tenant_users_mfa_method_check 
      CHECK (mfa_method IS NULL OR mfa_method IN ('totp', 'sms', 'webauthn'));
  END IF;
END $$;

-- ============================================================================
-- ADD MFA COLUMNS TO PLATFORM_ADMINS
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'platform_admins' AND column_name = 'mfa_enabled') THEN
    ALTER TABLE platform_admins ADD COLUMN mfa_enabled BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'platform_admins' AND column_name = 'mfa_totp_secret_encrypted') THEN
    ALTER TABLE platform_admins ADD COLUMN mfa_totp_secret_encrypted TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'platform_admins' AND column_name = 'mfa_enrolled_at') THEN
    ALTER TABLE platform_admins ADD COLUMN mfa_enrolled_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'platform_admins' AND column_name = 'mfa_method') THEN
    ALTER TABLE platform_admins ADD COLUMN mfa_method VARCHAR(20);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'platform_admins' AND column_name = 'mfa_failed_attempts') THEN
    ALTER TABLE platform_admins ADD COLUMN mfa_failed_attempts INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'platform_admins' AND column_name = 'mfa_locked_until') THEN
    ALTER TABLE platform_admins ADD COLUMN mfa_locked_until TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- MFA BACKUP CODES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mfa_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('tenant_user', 'platform_admin')),
  user_id UUID NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  used_ip INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mfa_backup_codes_user_idx UNIQUE (user_type, user_id, code_hash)
);

CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_user ON mfa_backup_codes(user_type, user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_unused ON mfa_backup_codes(user_type, user_id, is_used) 
  WHERE is_used = false;

-- ============================================================================
-- TRUSTED DEVICES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS mfa_trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('tenant_user', 'platform_admin')),
  user_id UUID NOT NULL,
  device_token_hash VARCHAR(64) NOT NULL,
  device_name VARCHAR(255),
  device_fingerprint VARCHAR(255),
  trusted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  last_used_ip INET,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revoked_reason VARCHAR(100),
  CONSTRAINT mfa_trusted_devices_unique UNIQUE (user_type, user_id, device_token_hash)
);

CREATE INDEX IF NOT EXISTS idx_mfa_trusted_devices_user ON mfa_trusted_devices(user_type, user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_trusted_devices_active ON mfa_trusted_devices(user_type, user_id, expires_at) 
  WHERE is_revoked = false;

-- ============================================================================
-- MFA AUDIT LOG (PARTITIONED)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mfa_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type VARCHAR(20) NOT NULL,
  user_id UUID NOT NULL,
  tenant_id UUID,
  event_type VARCHAR(50) NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create partitions for 2026
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'mfa_audit_log_2026_01') THEN
    CREATE TABLE mfa_audit_log_2026_01 PARTITION OF mfa_audit_log
      FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'mfa_audit_log_2026_02') THEN
    CREATE TABLE mfa_audit_log_2026_02 PARTITION OF mfa_audit_log
      FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'mfa_audit_log_2026_03') THEN
    CREATE TABLE mfa_audit_log_2026_03 PARTITION OF mfa_audit_log
      FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'mfa_audit_log_2026_04') THEN
    CREATE TABLE mfa_audit_log_2026_04 PARTITION OF mfa_audit_log
      FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'mfa_audit_log_2026_05') THEN
    CREATE TABLE mfa_audit_log_2026_05 PARTITION OF mfa_audit_log
      FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'mfa_audit_log_2026_06') THEN
    CREATE TABLE mfa_audit_log_2026_06 PARTITION OF mfa_audit_log
      FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mfa_audit_user ON mfa_audit_log(user_type, user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_audit_event ON mfa_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_mfa_audit_created ON mfa_audit_log(created_at);

-- ============================================================================
-- MFA CONFIGURATION IN SYSTEM_CONFIGURATION
-- ============================================================================

INSERT INTO system_configuration_metadata (category, key, display_name, description, value_type, default_value, is_tenant_overridable, validation_rules)
VALUES 
  ('authentication', 'mfa_required_roles', 'MFA Required Roles', 
   'Roles that require MFA enrollment (cannot be disabled by users)', 'json', 
   '["tenant_admin", "tenant_owner", "super_admin", "admin", "operator", "auditor"]', 
   false, NULL),
  
  ('authentication', 'mfa_ui_visible_roles', 'MFA UI Visible Roles',
   'Roles that can see MFA settings in their profile', 'json',
   '["tenant_admin", "tenant_owner", "super_admin", "admin", "operator", "auditor"]', 
   false, NULL),
   
  ('authentication', 'mfa_methods_allowed', 'Allowed MFA Methods',
   'MFA methods available for enrollment', 'json',
   '["totp"]', 
   false, NULL),
   
  ('authentication', 'mfa_totp_issuer', 'TOTP Issuer Name',
   'Name shown in authenticator apps', 'string',
   '"RADIANT"', 
   false, NULL),
   
  ('authentication', 'mfa_backup_codes_count', 'Backup Codes Count',
   'Number of backup codes to generate', 'number',
   '10', 
   false, '{"min": 5, "max": 20}'),
   
  ('authentication', 'mfa_device_trust_days', 'Device Trust Duration (Days)',
   'How long a trusted device remains trusted', 'number',
   '30', 
   false, '{"min": 1, "max": 90}'),
   
  ('authentication', 'mfa_max_trusted_devices', 'Max Trusted Devices',
   'Maximum trusted devices per user', 'number',
   '5', 
   false, '{"min": 1, "max": 20}'),
   
  ('authentication', 'mfa_max_attempts', 'Max Verification Attempts',
   'Failed attempts before lockout', 'number',
   '3', 
   false, '{"min": 3, "max": 10}'),
   
  ('authentication', 'mfa_lockout_minutes', 'Lockout Duration (Minutes)',
   'How long to lock out after failed attempts', 'number',
   '5', 
   false, '{"min": 1, "max": 60}')
ON CONFLICT (category, key) DO NOTHING;

-- ============================================================================
-- RLS POLICIES FOR MFA TABLES
-- ============================================================================

ALTER TABLE mfa_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY mfa_backup_codes_tenant_policy ON mfa_backup_codes
  FOR ALL USING (
    user_type = 'tenant_user' AND 
    user_id IN (SELECT id FROM tenant_users WHERE tenant_id = current_setting('app.current_tenant_id')::uuid)
  );

CREATE POLICY mfa_trusted_devices_tenant_policy ON mfa_trusted_devices
  FOR ALL USING (
    user_type = 'tenant_user' AND 
    user_id IN (SELECT id FROM tenant_users WHERE tenant_id = current_setting('app.current_tenant_id')::uuid)
  );

CREATE POLICY mfa_audit_log_tenant_policy ON mfa_audit_log
  FOR ALL USING (
    tenant_id = current_setting('app.current_tenant_id')::uuid OR tenant_id IS NULL
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE mfa_backup_codes IS 'One-time backup codes for MFA recovery (v5.52.28)';
COMMENT ON TABLE mfa_trusted_devices IS 'Devices trusted for 30-day MFA bypass (v5.52.28)';
COMMENT ON TABLE mfa_audit_log IS 'Audit log for all MFA events (v5.52.28)';

COMMENT ON COLUMN tenant_users.mfa_enabled IS 'Whether MFA is enabled for this user';
COMMENT ON COLUMN tenant_users.mfa_totp_secret_encrypted IS 'AES-256-GCM encrypted TOTP secret';
COMMENT ON COLUMN tenant_users.mfa_failed_attempts IS 'Failed MFA verification attempts (resets on success)';
COMMENT ON COLUMN tenant_users.mfa_locked_until IS 'Lockout timestamp after max failed attempts';
