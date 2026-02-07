-- =============================================================================
-- RADIANT v7.35.0 — Tenant Provisioning & Sign-Up Flow
--
-- Tracks the lifecycle of tenant sign-up from marketing/sales website through
-- email/phone verification, tenant creation, first-user invitation, and activation.
-- First sign-up user is automatically assigned tenant_admin role.
-- =============================================================================

BEGIN;

-- =============================================================================
-- ENUM: Provisioning status
-- =============================================================================

CREATE TYPE tenant_provisioning_status AS ENUM (
  'pending',           -- Sign-up received, awaiting email verification
  'email_verified',    -- Email verified, awaiting phone verification
  'phone_verified',    -- Both verified, ready to provision
  'provisioning',      -- Creating tenant + user records
  'provisioned',       -- Tenant + first user created
  'invitation_sent',   -- Invitation email sent to first user
  'active',            -- First user accepted invitation, tenant active
  'failed',            -- Provisioning failed
  'expired'            -- Sign-up expired (not verified in time)
);

-- =============================================================================
-- TABLE: tenant_provisioning
-- Tracks each sign-up from initial request through activation
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenant_provisioning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sign-up identity
  email VARCHAR(320) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  phone_country_code VARCHAR(2) NOT NULL DEFAULT 'US',
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(200),

  -- Organization
  organization_name VARCHAR(200) NOT NULL,
  organization_slug VARCHAR(100) NOT NULL,
  tier VARCHAR(20) NOT NULL DEFAULT 'FREE'
    CHECK (tier IN ('FREE', 'STARTER', 'PRO', 'SCALE', 'ENTERPRISE')),

  -- Status
  status tenant_provisioning_status NOT NULL DEFAULT 'pending',

  -- Verification tracking
  email_verified BOOLEAN NOT NULL DEFAULT false,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  email_verification_code_hash VARCHAR(255),
  phone_verification_code_hash VARCHAR(255),
  email_verification_sent_at TIMESTAMPTZ,
  phone_verification_sent_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  phone_verified_at TIMESTAMPTZ,
  email_verification_attempts INT NOT NULL DEFAULT 0,
  phone_verification_attempts INT NOT NULL DEFAULT 0,

  -- Provisioned references
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID,
  cognito_user_id VARCHAR(255),

  -- Invitation
  invitation_token VARCHAR(255),
  invitation_sent_at TIMESTAMPTZ,
  invitation_expires_at TIMESTAMPTZ,
  invitation_accepted_at TIMESTAMPTZ,

  -- Metadata
  failure_reason TEXT,
  referral_source VARCHAR(100),
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),

  -- Constraints
  CONSTRAINT chk_phone_e164 CHECK (phone ~ '^\+[1-9]\d{1,14}$'),
  CONSTRAINT chk_country_code CHECK (phone_country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT chk_email_format CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- Prevent duplicate pending sign-ups for same email
CREATE UNIQUE INDEX idx_provisioning_pending_email
  ON tenant_provisioning(email)
  WHERE status IN ('pending', 'email_verified', 'phone_verified', 'provisioning');

-- Prevent duplicate slug
CREATE UNIQUE INDEX idx_provisioning_slug
  ON tenant_provisioning(organization_slug)
  WHERE status NOT IN ('failed', 'expired');

CREATE INDEX idx_provisioning_status ON tenant_provisioning(status);
CREATE INDEX idx_provisioning_email ON tenant_provisioning(email);
CREATE INDEX idx_provisioning_tenant ON tenant_provisioning(tenant_id);
CREATE INDEX idx_provisioning_expires ON tenant_provisioning(expires_at) WHERE status IN ('pending', 'email_verified', 'phone_verified');
CREATE INDEX idx_provisioning_invitation ON tenant_provisioning(invitation_token) WHERE invitation_token IS NOT NULL;

-- =============================================================================
-- TABLE: tenant_provisioning_log
-- Audit trail for provisioning events
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenant_provisioning_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provisioning_id UUID NOT NULL REFERENCES tenant_provisioning(id) ON DELETE CASCADE,
  event VARCHAR(50) NOT NULL,
  old_status tenant_provisioning_status,
  new_status tenant_provisioning_status,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_provisioning_log_prov ON tenant_provisioning_log(provisioning_id);

-- =============================================================================
-- FUNCTION: Auto-update updated_at on provisioning changes
-- =============================================================================

CREATE OR REPLACE FUNCTION update_provisioning_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_provisioning_updated
  BEFORE UPDATE ON tenant_provisioning
  FOR EACH ROW EXECUTE FUNCTION update_provisioning_timestamp();

-- =============================================================================
-- FUNCTION: Expire stale sign-ups
-- Called by a scheduled Lambda or pg_cron
-- =============================================================================

CREATE OR REPLACE FUNCTION expire_stale_signups()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE tenant_provisioning
  SET status = 'expired', updated_at = NOW()
  WHERE status IN ('pending', 'email_verified', 'phone_verified')
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED: Provisioning configuration
-- =============================================================================

INSERT INTO system_configuration (key, category, value, description, is_secret, created_at, updated_at)
VALUES
  ('provisioning.signup_expiry_hours', 'tenant', '"48"', 'Hours before unverified sign-up expires', false, NOW(), NOW()),
  ('provisioning.invitation_expiry_hours', 'tenant', '"72"', 'Hours before first-user invitation expires', false, NOW(), NOW()),
  ('provisioning.first_user_role', 'tenant', '"tenant_admin"', 'Role assigned to first sign-up user', false, NOW(), NOW()),
  ('provisioning.require_email_verification', 'tenant', '"true"', 'Require email verification before provisioning', false, NOW(), NOW()),
  ('provisioning.require_phone_verification', 'tenant', '"true"', 'Require phone verification before provisioning', false, NOW(), NOW()),
  ('provisioning.default_tier', 'tenant', '"FREE"', 'Default tier for new tenants', false, NOW(), NOW()),
  ('provisioning.default_apps', 'tenant', '["think_tank","curator","tenant_admin"]', 'Default app access for first user', false, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

COMMIT;
