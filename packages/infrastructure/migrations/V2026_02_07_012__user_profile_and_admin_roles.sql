-- =============================================================================
-- RADIANT v7.34.0 — Unified User Profile, Multi-Contact & Admin Role Enforcement
-- Migration: V2026_02_07_012
--
-- Feature A: Multi-contact profiles (3 emails + 3 phones) with verification
-- Feature A: SENTINEL contact routing (per-category/severity → specific contacts)
-- Feature B: System administrator role enforcement & bootstrap
-- =============================================================================

BEGIN;

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE contact_type AS ENUM ('email', 'phone');

CREATE TYPE contact_label AS ENUM ('work', 'personal', 'on_call', 'backup', 'custom');

CREATE TYPE contact_verification_status AS ENUM ('unverified', 'pending', 'verified', 'expired');

CREATE TYPE profile_user_type AS ENUM ('end_user', 'platform_admin');

CREATE TYPE system_admin_role AS ENUM ('super_admin', 'admin', 'operator', 'auditor');

CREATE TYPE verification_action AS ENUM (
  'code_sent',
  'code_verified',
  'code_failed',
  'code_expired',
  'max_attempts'
);

-- =============================================================================
-- TABLE: user_contacts
-- Multi-contact directory for both end-users and platform admins
-- Max 3 emails + 3 phones per user (enforced by trigger)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type profile_user_type NOT NULL DEFAULT 'end_user',
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  contact_type contact_type NOT NULL,
  label contact_label NOT NULL DEFAULT 'work',
  custom_label VARCHAR(50),
  value VARCHAR(320) NOT NULL, -- E.164 phone or email (max 320 chars per RFC 5321)
  country_code VARCHAR(2), -- ISO 3166-1 alpha-2, phones only
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_login_contact BOOLEAN NOT NULL DEFAULT false, -- Login email, cannot be deleted
  verification_status contact_verification_status NOT NULL DEFAULT 'unverified',
  verification_code_hash VARCHAR(255), -- bcrypt hash of 6-digit code
  verification_expires_at TIMESTAMPTZ,
  verification_attempts INT NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  last_verification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_user_contact_value UNIQUE (user_id, user_type, contact_type, value),
  CONSTRAINT chk_phone_country_code CHECK (
    contact_type != 'phone' OR country_code IS NOT NULL
  ),
  CONSTRAINT chk_phone_e164 CHECK (
    contact_type != 'phone' OR value ~ '^\+[1-9]\d{1,14}$'
  ),
  CONSTRAINT chk_email_format CHECK (
    contact_type != 'email' OR value ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  CONSTRAINT chk_custom_label CHECK (
    label != 'custom' OR custom_label IS NOT NULL
  )
);

CREATE INDEX idx_user_contacts_user ON user_contacts(user_id, user_type);
CREATE INDEX idx_user_contacts_tenant ON user_contacts(tenant_id);
CREATE INDEX idx_user_contacts_verified ON user_contacts(user_id, user_type, contact_type, verification_status)
  WHERE verification_status = 'verified';
CREATE INDEX idx_user_contacts_primary ON user_contacts(user_id, user_type, contact_type)
  WHERE is_primary = true;

-- =============================================================================
-- TRIGGER: Enforce max 3 emails + 3 phones per user
-- =============================================================================

CREATE OR REPLACE FUNCTION enforce_max_contacts()
RETURNS TRIGGER AS $$
DECLARE
  contact_count INT;
  max_per_type INT := 3;
BEGIN
  SELECT COUNT(*) INTO contact_count
  FROM user_contacts
  WHERE user_id = NEW.user_id
    AND user_type = NEW.user_type
    AND contact_type = NEW.contact_type;

  IF contact_count >= max_per_type THEN
    RAISE EXCEPTION 'Maximum % contacts of type % reached for user %',
      max_per_type, NEW.contact_type, NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_max_contacts
  BEFORE INSERT ON user_contacts
  FOR EACH ROW EXECUTE FUNCTION enforce_max_contacts();

-- =============================================================================
-- TRIGGER: Enforce only one primary per contact type per user
-- =============================================================================

CREATE OR REPLACE FUNCTION enforce_single_primary()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE user_contacts
    SET is_primary = false, updated_at = NOW()
    WHERE user_id = NEW.user_id
      AND user_type = NEW.user_type
      AND contact_type = NEW.contact_type
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_single_primary
  BEFORE INSERT OR UPDATE ON user_contacts
  FOR EACH ROW EXECUTE FUNCTION enforce_single_primary();

-- =============================================================================
-- TABLE: contact_verification_log
-- Audit trail for all verification attempts
-- =============================================================================

CREATE TABLE IF NOT EXISTS contact_verification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES user_contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  contact_type contact_type NOT NULL,
  action verification_action NOT NULL,
  masked_value VARCHAR(320) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verification_log_contact ON contact_verification_log(contact_id);
CREATE INDEX idx_verification_log_user ON contact_verification_log(user_id);
CREATE INDEX idx_verification_log_tenant ON contact_verification_log(tenant_id);

-- =============================================================================
-- TABLE: user_profiles
-- Extended profile fields (bio, timezone, locale) for all users
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type profile_user_type NOT NULL DEFAULT 'end_user',
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  bio TEXT,
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  locale VARCHAR(10) NOT NULL DEFAULT 'en-US',
  date_format VARCHAR(10) NOT NULL DEFAULT 'MM/DD/YYYY',
  time_format VARCHAR(3) NOT NULL DEFAULT '12h',
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  profile_complete BOOLEAN NOT NULL DEFAULT false,
  last_profile_update_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_user_profile UNIQUE (user_id, user_type),
  CONSTRAINT chk_date_format CHECK (date_format IN ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD')),
  CONSTRAINT chk_time_format CHECK (time_format IN ('12h', '24h'))
);

CREATE INDEX idx_user_profiles_tenant ON user_profiles(tenant_id);

-- =============================================================================
-- TABLE: sentinel_contact_routing
-- Maps admin contacts → alert categories/severity for SENTINEL notification
-- =============================================================================

CREATE TABLE IF NOT EXISTS sentinel_contact_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  alert_category VARCHAR(20) NOT NULL DEFAULT '*', -- '*' = all categories
  min_severity INT NOT NULL DEFAULT 3 CHECK (min_severity BETWEEN 1 AND 5),
  contact_id UUID NOT NULL REFERENCES user_contacts(id) ON DELETE CASCADE,
  -- Denormalized snapshot for fast lookup at alert time
  contact_type contact_type NOT NULL,
  contact_value VARCHAR(320) NOT NULL,
  contact_label contact_label NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_routing_rule UNIQUE (admin_id, alert_category, min_severity, contact_id),
  CONSTRAINT chk_alert_category CHECK (
    alert_category IN (
      '*', 'infrastructure', 'security', 'compliance', 'application',
      'ai_model', 'data', 'billing', 'performance', 'availability', 'tenant'
    )
  )
);

CREATE INDEX idx_sentinel_routing_admin ON sentinel_contact_routing(admin_id);
CREATE INDEX idx_sentinel_routing_category ON sentinel_contact_routing(alert_category, min_severity)
  WHERE enabled = true;
CREATE INDEX idx_sentinel_routing_tenant ON sentinel_contact_routing(tenant_id);

-- =============================================================================
-- TABLE: admin_role_assignments
-- Explicit admin role assignments with audit trail
-- Replaces implicit role from administrators.role column
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  role system_admin_role NOT NULL DEFAULT 'operator',
  is_bootstrap_admin BOOLEAN NOT NULL DEFAULT false, -- First admin, auto super_admin
  granted_by UUID, -- NULL for bootstrap admin
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  mfa_required BOOLEAN NOT NULL DEFAULT true,
  phone_verified_required BOOLEAN NOT NULL DEFAULT true,
  last_role_change_at TIMESTAMPTZ,
  last_role_change_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_active_admin_role UNIQUE (admin_id, tenant_id) -- One active role per admin per tenant
);

CREATE INDEX idx_admin_roles_admin ON admin_role_assignments(admin_id) WHERE is_active = true;
CREATE INDEX idx_admin_roles_tenant ON admin_role_assignments(tenant_id) WHERE is_active = true;
CREATE INDEX idx_admin_roles_role ON admin_role_assignments(role) WHERE is_active = true;
CREATE INDEX idx_admin_roles_bootstrap ON admin_role_assignments(is_bootstrap_admin)
  WHERE is_bootstrap_admin = true;

-- =============================================================================
-- TABLE: admin_role_audit_log
-- Audit trail for all role changes
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_role_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  action VARCHAR(30) NOT NULL, -- 'role_assigned', 'role_changed', 'role_revoked', 'bootstrap'
  old_role system_admin_role,
  new_role system_admin_role,
  performed_by UUID, -- NULL for system/bootstrap
  reason TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_role_audit_admin ON admin_role_audit_log(admin_id);
CREATE INDEX idx_role_audit_tenant ON admin_role_audit_log(tenant_id);

-- =============================================================================
-- TABLE: admin_app_access
-- Explicit app access grants for non-super_admin roles
-- super_admin has auto-access to all apps
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_app_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  app_id VARCHAR(50) NOT NULL, -- 'radiant_admin', 'think_tank', 'curator', 'genesis', etc.
  granted_by UUID NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_admin_app UNIQUE (admin_id, tenant_id, app_id)
);

CREATE INDEX idx_admin_app_access_admin ON admin_app_access(admin_id) WHERE is_active = true;
CREATE INDEX idx_admin_app_access_app ON admin_app_access(app_id) WHERE is_active = true;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE user_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_verification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_contact_routing ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_role_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_app_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_contacts_tenant_isolation ON user_contacts
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY verification_log_tenant_isolation ON contact_verification_log
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY user_profiles_tenant_isolation ON user_profiles
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY sentinel_routing_tenant_isolation ON sentinel_contact_routing
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY admin_roles_tenant_isolation ON admin_role_assignments
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY role_audit_tenant_isolation ON admin_role_audit_log
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY admin_app_tenant_isolation ON admin_app_access
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- =============================================================================
-- FUNCTION: Check if admin has a specific permission
-- Used by Lambda middleware for route protection
-- =============================================================================

CREATE OR REPLACE FUNCTION check_admin_permission(
  p_admin_id UUID,
  p_permission VARCHAR(50),
  p_tenant_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_role system_admin_role;
BEGIN
  SELECT role INTO v_role
  FROM admin_role_assignments
  WHERE admin_id = p_admin_id
    AND is_active = true
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- super_admin has all permissions
  IF v_role = 'super_admin' THEN
    RETURN true;
  END IF;

  -- Role-based permission check
  CASE p_permission
    WHEN 'canCreateAdmins' THEN RETURN false;
    WHEN 'canDeleteAdmins' THEN RETURN false;
    WHEN 'canChangeAdminRoles' THEN RETURN false;
    WHEN 'canCreateSuperAdmins' THEN RETURN false;
    WHEN 'canDeleteTenants' THEN RETURN false;
    WHEN 'canManageSecurityPolicies' THEN RETURN false;
    WHEN 'canAccessAllApps' THEN RETURN false;

    WHEN 'canCreateTenants' THEN RETURN v_role = 'admin';
    WHEN 'canManageTenants' THEN RETURN v_role = 'admin';
    WHEN 'canManageUsers' THEN RETURN v_role IN ('admin');
    WHEN 'canManageSystemConfig' THEN RETURN v_role = 'admin';
    WHEN 'canManageBilling' THEN RETURN v_role IN ('admin');
    WHEN 'canManageSentinel' THEN RETURN false;
    WHEN 'canExportAuditLogs' THEN RETURN v_role IN ('admin', 'auditor');

    WHEN 'canManageModels' THEN RETURN v_role IN ('admin', 'operator');
    WHEN 'canManageProviders' THEN RETURN v_role IN ('admin', 'operator');
    WHEN 'canDeploy' THEN RETURN v_role IN ('admin', 'operator');

    -- Read permissions
    WHEN 'canViewTenants' THEN RETURN true;
    WHEN 'canViewUsers' THEN RETURN true;
    WHEN 'canViewModels' THEN RETURN true;
    WHEN 'canViewConfig' THEN RETURN v_role IN ('admin', 'operator');
    WHEN 'canViewBilling' THEN RETURN v_role IN ('admin', 'auditor');
    WHEN 'canAccessSentinel' THEN RETURN v_role IN ('admin', 'operator');
    WHEN 'canViewAuditLogs' THEN RETURN true;
    WHEN 'canApprove' THEN RETURN v_role = 'admin';
    WHEN 'canAccessGrantedApps' THEN RETURN true;

    ELSE RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- FUNCTION: Get admin role for JWT claim
-- =============================================================================

CREATE OR REPLACE FUNCTION get_admin_role(
  p_admin_id UUID,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS system_admin_role AS $$
BEGIN
  RETURN (
    SELECT role FROM admin_role_assignments
    WHERE admin_id = p_admin_id
      AND is_active = true
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- FUNCTION: Resolve SENTINEL contacts for an alert
-- Given an alert category + severity, returns all matching admin contacts
-- =============================================================================

CREATE OR REPLACE FUNCTION resolve_sentinel_contacts(
  p_tenant_id UUID,
  p_alert_category VARCHAR(20),
  p_severity INT
) RETURNS TABLE (
  admin_id UUID,
  contact_type contact_type,
  contact_value VARCHAR(320),
  contact_label contact_label
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    scr.admin_id,
    scr.contact_type,
    scr.contact_value,
    scr.contact_label
  FROM sentinel_contact_routing scr
  WHERE scr.tenant_id = p_tenant_id
    AND scr.enabled = true
    AND scr.min_severity >= p_severity  -- severity 1 is most severe, so >= matches
    AND (scr.alert_category = p_alert_category OR scr.alert_category = '*')
  ORDER BY scr.contact_type, scr.admin_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- SEED: Profile completion requirements (stored as system config)
-- =============================================================================

INSERT INTO system_configuration (key, category, value, description, is_secret, created_at, updated_at)
VALUES
  ('profile.require_verified_phone', 'authentication', '"true"', 'Require all users to have at least one verified phone number (MFA)', false, NOW(), NOW()),
  ('profile.require_verified_email', 'authentication', '"true"', 'Require login email to be verified', false, NOW(), NOW()),
  ('profile.max_emails_per_user', 'authentication', '"3"', 'Maximum email addresses per user', false, NOW(), NOW()),
  ('profile.max_phones_per_user', 'authentication', '"3"', 'Maximum phone numbers per user', false, NOW(), NOW()),
  ('profile.verification_code_expiry_minutes', 'authentication', '"10"', 'Verification code expiry in minutes', false, NOW(), NOW()),
  ('profile.verification_max_attempts', 'authentication', '"3"', 'Maximum verification attempts before cooldown', false, NOW(), NOW()),
  ('profile.verification_cooldown_minutes', 'authentication', '"10"', 'Cooldown after max failed verification attempts', false, NOW(), NOW()),
  ('admin.bootstrap_require_mfa', 'authorization', '"true"', 'Bootstrap admin must have MFA enabled', false, NOW(), NOW()),
  ('admin.bootstrap_require_phone', 'authorization', '"true"', 'Bootstrap admin must have verified phone', false, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

COMMIT;
