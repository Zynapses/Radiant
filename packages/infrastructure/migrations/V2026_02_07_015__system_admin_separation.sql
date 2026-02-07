-- =============================================================================
-- RADIANT v7.38.0 — System Administrator Separation
-- Migration: V2026_02_07_015
--
-- Separates system administrators from tenant-scoped users/admins.
-- System admins are GLOBAL — no tenant_id, no RLS.
-- They manage the RADIANT platform, not individual tenants.
--
-- New tables:
--   system_admins              — Global system administrator accounts
--   system_admin_contacts      — Verified email/phone for alert routing
--   system_admin_alert_routing — SENTINEL alert → contact mapping (global)
--   system_admin_audit_log     — All system admin actions
--
-- New functions:
--   resolve_system_admin_contacts()  — Alert dispatch resolution
--   check_system_admin_permission()  — Permission check for middleware
--   bootstrap_system_admin()         — First-time setup helper
-- =============================================================================

BEGIN;

-- =============================================================================
-- TABLE: system_admins
-- Global system administrator accounts — NO tenant_id, NO RLS
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_user_id VARCHAR(128) NOT NULL UNIQUE,
  email VARCHAR(320) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role system_admin_role NOT NULL DEFAULT 'operator',
  is_bootstrap BOOLEAN NOT NULL DEFAULT false,
  mfa_enabled BOOLEAN NOT NULL DEFAULT true,
  mfa_method VARCHAR(20) NOT NULL DEFAULT 'authenticator',

  -- Profile
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  locale VARCHAR(10) NOT NULL DEFAULT 'en-US',
  date_format VARCHAR(10) NOT NULL DEFAULT 'MM/DD/YYYY',
  time_format VARCHAR(3) NOT NULL DEFAULT '12h',
  avatar_url TEXT,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending_setup',
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  mfa_enrolled_at TIMESTAMPTZ,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  setup_completed_at TIMESTAMPTZ,

  -- Audit
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID,

  CONSTRAINT chk_sa_status CHECK (
    status IN ('pending_setup', 'active', 'suspended', 'deactivated')
  ),
  CONSTRAINT chk_sa_mfa_method CHECK (
    mfa_method IN ('authenticator', 'sms')
  ),
  CONSTRAINT chk_sa_date_format CHECK (
    date_format IN ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD')
  ),
  CONSTRAINT chk_sa_time_format CHECK (
    time_format IN ('12h', '24h')
  )
);

CREATE INDEX idx_system_admins_email ON system_admins(email);
CREATE INDEX idx_system_admins_cognito ON system_admins(cognito_user_id);
CREATE INDEX idx_system_admins_role ON system_admins(role) WHERE status = 'active';
CREATE INDEX idx_system_admins_bootstrap ON system_admins(is_bootstrap)
  WHERE is_bootstrap = true AND status = 'active';

-- NO RLS — system admins are global

-- =============================================================================
-- TABLE: system_admin_contacts
-- Verified email/phone for system admin alert routing
-- Max 3 emails + 3 phones per admin (enforced by trigger)
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_admin_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES system_admins(id) ON DELETE CASCADE,
  contact_type contact_type NOT NULL,
  label contact_label NOT NULL DEFAULT 'work',
  custom_label VARCHAR(50),
  value VARCHAR(320) NOT NULL,
  country_code VARCHAR(2),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_login_contact BOOLEAN NOT NULL DEFAULT false,
  verification_status contact_verification_status NOT NULL DEFAULT 'unverified',
  verification_code_hash VARCHAR(255),
  verification_expires_at TIMESTAMPTZ,
  verification_attempts INT NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  last_verification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_sysadmin_contact UNIQUE (admin_id, contact_type, value),
  CONSTRAINT chk_sac_phone_e164 CHECK (
    contact_type != 'phone' OR value ~ '^\+[1-9]\d{1,14}$'
  ),
  CONSTRAINT chk_sac_email CHECK (
    contact_type != 'email' OR value ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  CONSTRAINT chk_sac_phone_cc CHECK (
    contact_type != 'phone' OR country_code IS NOT NULL
  ),
  CONSTRAINT chk_sac_custom_label CHECK (
    label != 'custom' OR custom_label IS NOT NULL
  )
);

CREATE INDEX idx_sac_admin ON system_admin_contacts(admin_id);
CREATE INDEX idx_sac_verified ON system_admin_contacts(admin_id, contact_type, verification_status)
  WHERE verification_status = 'verified';
CREATE INDEX idx_sac_primary ON system_admin_contacts(admin_id, contact_type)
  WHERE is_primary = true;

-- Trigger: max 3 per contact type per admin
CREATE OR REPLACE FUNCTION enforce_max_system_admin_contacts()
RETURNS TRIGGER AS $$
DECLARE
  contact_count INT;
  max_per_type INT := 3;
BEGIN
  SELECT COUNT(*) INTO contact_count
  FROM system_admin_contacts
  WHERE admin_id = NEW.admin_id
    AND contact_type = NEW.contact_type;

  IF contact_count >= max_per_type THEN
    RAISE EXCEPTION 'Maximum % contacts of type % reached for system admin %',
      max_per_type, NEW.contact_type, NEW.admin_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_max_sac
  BEFORE INSERT ON system_admin_contacts
  FOR EACH ROW EXECUTE FUNCTION enforce_max_system_admin_contacts();

-- Trigger: only one primary per contact type
CREATE OR REPLACE FUNCTION enforce_single_primary_sac()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE system_admin_contacts
    SET is_primary = false, updated_at = NOW()
    WHERE admin_id = NEW.admin_id
      AND contact_type = NEW.contact_type
      AND id != NEW.id
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_single_primary_sac
  BEFORE INSERT OR UPDATE ON system_admin_contacts
  FOR EACH ROW EXECUTE FUNCTION enforce_single_primary_sac();

-- =============================================================================
-- TABLE: system_admin_contact_verification_log
-- Audit trail for verification attempts
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_admin_contact_verification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES system_admin_contacts(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES system_admins(id),
  contact_type contact_type NOT NULL,
  action verification_action NOT NULL,
  masked_value VARCHAR(320) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sacvl_contact ON system_admin_contact_verification_log(contact_id);
CREATE INDEX idx_sacvl_admin ON system_admin_contact_verification_log(admin_id);

-- =============================================================================
-- TABLE: system_admin_alert_routing
-- SENTINEL alert → system admin contact routing (GLOBAL, no tenant scope)
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_admin_alert_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES system_admins(id) ON DELETE CASCADE,
  alert_category VARCHAR(20) NOT NULL DEFAULT '*',
  min_severity INT NOT NULL DEFAULT 3 CHECK (min_severity BETWEEN 1 AND 5),
  contact_id UUID NOT NULL REFERENCES system_admin_contacts(id) ON DELETE CASCADE,
  -- Denormalized snapshot for fast lookup at alert time
  contact_type contact_type NOT NULL,
  contact_value VARCHAR(320) NOT NULL,
  contact_label contact_label NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_sa_routing UNIQUE (admin_id, alert_category, min_severity, contact_id),
  CONSTRAINT chk_sa_alert_category CHECK (
    alert_category IN (
      '*', 'infrastructure', 'security', 'compliance', 'application',
      'ai_model', 'data', 'billing', 'performance', 'availability', 'tenant'
    )
  )
);

CREATE INDEX idx_sar_admin ON system_admin_alert_routing(admin_id);
CREATE INDEX idx_sar_category ON system_admin_alert_routing(alert_category, min_severity)
  WHERE enabled = true;

-- =============================================================================
-- TABLE: system_admin_audit_log
-- All system admin lifecycle and action events
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES system_admins(id),
  action VARCHAR(50) NOT NULL,
  old_role system_admin_role,
  new_role system_admin_role,
  performed_by UUID,
  reason TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saal_admin ON system_admin_audit_log(admin_id);
CREATE INDEX idx_saal_action ON system_admin_audit_log(action);
CREATE INDEX idx_saal_created ON system_admin_audit_log(created_at DESC);

-- =============================================================================
-- FUNCTION: Resolve system admin contacts for SENTINEL alert dispatch
-- Returns all matching system admin contacts for a given alert category + severity
-- Called by SentinelNotifierService — GLOBAL, no tenant scope
-- =============================================================================

CREATE OR REPLACE FUNCTION resolve_system_admin_contacts(
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
    sar.admin_id,
    sar.contact_type,
    sar.contact_value,
    sar.contact_label
  FROM system_admin_alert_routing sar
  JOIN system_admins sa ON sa.id = sar.admin_id AND sa.status = 'active'
  WHERE sar.enabled = true
    AND sar.min_severity >= p_severity
    AND (sar.alert_category = p_alert_category OR sar.alert_category = '*')
  ORDER BY sar.contact_type, sar.admin_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- FUNCTION: Check system admin permission (used by Lambda middleware)
-- =============================================================================

CREATE OR REPLACE FUNCTION check_system_admin_permission(
  p_admin_id UUID,
  p_permission VARCHAR(50)
) RETURNS BOOLEAN AS $$
DECLARE
  v_role system_admin_role;
  v_status VARCHAR(20);
BEGIN
  SELECT role, status INTO v_role, v_status
  FROM system_admins
  WHERE id = p_admin_id;

  IF v_role IS NULL OR v_status != 'active' THEN
    RETURN false;
  END IF;

  -- super_admin has all permissions
  IF v_role = 'super_admin' THEN
    RETURN true;
  END IF;

  -- Role-based permission check (mirrors SYSTEM_ADMIN_PERMISSIONS in TypeScript)
  CASE p_permission
    -- super_admin only
    WHEN 'canCreateAdmins' THEN RETURN false;
    WHEN 'canDeleteAdmins' THEN RETURN false;
    WHEN 'canChangeAdminRoles' THEN RETURN false;
    WHEN 'canCreateSuperAdmins' THEN RETURN false;
    WHEN 'canDeleteTenants' THEN RETURN false;
    WHEN 'canManageSecurityPolicies' THEN RETURN false;
    WHEN 'canManageSentinel' THEN RETURN false;

    -- admin+
    WHEN 'canCreateTenants' THEN RETURN v_role = 'admin';
    WHEN 'canManageTenants' THEN RETURN v_role = 'admin';
    WHEN 'canManageUsers' THEN RETURN v_role = 'admin';
    WHEN 'canManageSystemConfig' THEN RETURN v_role = 'admin';
    WHEN 'canManageBilling' THEN RETURN v_role = 'admin';
    WHEN 'canExportAuditLogs' THEN RETURN v_role IN ('admin', 'auditor');

    -- operator+
    WHEN 'canManageModels' THEN RETURN v_role IN ('admin', 'operator');
    WHEN 'canManageProviders' THEN RETURN v_role IN ('admin', 'operator');
    WHEN 'canDeploy' THEN RETURN v_role IN ('admin', 'operator');

    -- read permissions (all active admins)
    WHEN 'canViewTenants' THEN RETURN true;
    WHEN 'canViewUsers' THEN RETURN true;
    WHEN 'canViewModels' THEN RETURN true;
    WHEN 'canViewConfig' THEN RETURN v_role IN ('admin', 'operator');
    WHEN 'canViewBilling' THEN RETURN v_role IN ('admin', 'auditor');
    WHEN 'canAccessSentinel' THEN RETURN v_role IN ('admin', 'operator');
    WHEN 'canViewAuditLogs' THEN RETURN true;
    WHEN 'canApprove' THEN RETURN v_role = 'admin';

    ELSE RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- FUNCTION: Bootstrap first system admin
-- Called once during initial deployment. Fails if any active admin exists.
-- =============================================================================

CREATE OR REPLACE FUNCTION bootstrap_system_admin(
  p_cognito_user_id VARCHAR(128),
  p_email VARCHAR(320),
  p_display_name VARCHAR(255),
  p_first_name VARCHAR(100) DEFAULT NULL,
  p_last_name VARCHAR(100) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_existing_count INT;
  v_admin_id UUID;
BEGIN
  SELECT COUNT(*) INTO v_existing_count
  FROM system_admins WHERE status IN ('active', 'pending_setup');

  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'Cannot bootstrap: % active/pending system admin(s) already exist', v_existing_count;
  END IF;

  INSERT INTO system_admins (
    cognito_user_id, email, display_name, first_name, last_name,
    role, is_bootstrap, mfa_enabled, status
  ) VALUES (
    p_cognito_user_id, p_email, p_display_name, p_first_name, p_last_name,
    'super_admin', true, true, 'pending_setup'
  ) RETURNING id INTO v_admin_id;

  -- Audit log
  INSERT INTO system_admin_audit_log (
    admin_id, action, new_role, reason
  ) VALUES (
    v_admin_id, 'bootstrap', 'super_admin',
    'First system admin bootstrap during initial deployment'
  );

  RETURN v_admin_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Prevent deletion of last super_admin
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_last_super_admin_removal()
RETURNS TRIGGER AS $$
DECLARE
  v_super_count INT;
BEGIN
  IF OLD.role = 'super_admin' AND OLD.status = 'active' THEN
    IF NEW.status != 'active' OR NEW.role != 'super_admin' THEN
      SELECT COUNT(*) INTO v_super_count
      FROM system_admins
      WHERE role = 'super_admin' AND status = 'active' AND id != OLD.id;

      IF v_super_count = 0 THEN
        RAISE EXCEPTION 'Cannot remove or demote the last active super_admin';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_last_super_admin
  BEFORE UPDATE ON system_admins
  FOR EACH ROW EXECUTE FUNCTION prevent_last_super_admin_removal();

-- =============================================================================
-- SEED: System configuration entries
-- =============================================================================

INSERT INTO system_configuration (key, category, value, description, is_secret, created_at, updated_at)
VALUES
  ('system_admin.session_timeout_minutes', 'authorization', '"30"', 'System admin session idle timeout in minutes', false, NOW(), NOW()),
  ('system_admin.session_absolute_timeout_hours', 'authorization', '"8"', 'System admin absolute session timeout in hours', false, NOW(), NOW()),
  ('system_admin.failed_login_lockout_threshold', 'authorization', '"5"', 'Failed logins before 15-min lockout', false, NOW(), NOW()),
  ('system_admin.failed_login_deactivate_threshold', 'authorization', '"20"', 'Failed logins before auto-deactivation', false, NOW(), NOW()),
  ('system_admin.require_mfa', 'authorization', '"true"', 'All system admins must have MFA enabled', false, NOW(), NOW()),
  ('system_admin.require_verified_phone', 'authorization', '"true"', 'System admins must have at least one verified phone', false, NOW(), NOW()),
  ('system_admin.require_verified_email', 'authorization', '"true"', 'System admin login email must be verified', false, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- MIGRATE: Copy existing system-level admins from admin_role_assignments
-- to system_admins (if any exist from v7.34.0)
-- =============================================================================

INSERT INTO system_admins (
  cognito_user_id, email, display_name, first_name, last_name,
  role, is_bootstrap, mfa_enabled, status, created_at
)
SELECT
  a.cognito_user_id,
  a.email,
  a.display_name,
  a.first_name,
  a.last_name,
  ara.role,
  ara.is_bootstrap_admin,
  a.mfa_enabled,
  CASE WHEN a.status = 'active' THEN 'active' ELSE 'pending_setup' END,
  a.created_at
FROM administrators a
JOIN admin_role_assignments ara ON ara.admin_id = a.id AND ara.is_active = true
WHERE ara.role IN ('super_admin', 'admin', 'operator', 'auditor')
ON CONFLICT (email) DO NOTHING;

-- Migrate contacts for system admins
INSERT INTO system_admin_contacts (
  admin_id, contact_type, label, custom_label, value, country_code,
  is_primary, is_login_contact, verification_status, verified_at, created_at
)
SELECT
  sa.id,
  uc.contact_type,
  uc.label,
  uc.custom_label,
  uc.value,
  uc.country_code,
  uc.is_primary,
  uc.is_login_contact,
  uc.verification_status,
  uc.verified_at,
  uc.created_at
FROM user_contacts uc
JOIN administrators a ON a.id = uc.user_id AND uc.user_type = 'platform_admin'
JOIN system_admins sa ON sa.email = a.email
ON CONFLICT (admin_id, contact_type, value) DO NOTHING;

-- Migrate SENTINEL routing for system admins
INSERT INTO system_admin_alert_routing (
  admin_id, alert_category, min_severity, contact_id,
  contact_type, contact_value, contact_label, enabled
)
SELECT
  sa.id,
  scr.alert_category,
  scr.min_severity,
  sac.id,
  scr.contact_type,
  scr.contact_value,
  scr.contact_label,
  scr.enabled
FROM sentinel_contact_routing scr
JOIN administrators a ON a.id = scr.admin_id
JOIN system_admins sa ON sa.email = a.email
JOIN system_admin_contacts sac ON sac.admin_id = sa.id AND sac.value = scr.contact_value
ON CONFLICT DO NOTHING;

COMMIT;
