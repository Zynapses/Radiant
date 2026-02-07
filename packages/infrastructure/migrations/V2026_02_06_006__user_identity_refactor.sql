-- =============================================================================
-- RADIANT v4.18.0 — Single-Tenant User Model, Licensing & Auth Config
-- =============================================================================
-- v7.23.0 — Replaces v7.22.0 multi-tenant user model
--
-- ARCHITECTURE:
--   1. Each user belongs to exactly ONE tenant (users.tenant_id NOT NULL)
--   2. Same email can exist in multiple tenants as SEPARATE user records
--   3. UNIQUE(tenant_id, email) — one email per tenant
--   4. UNIQUE(tenant_id, cognito_user_id) — same Cognito identity, different tenants
--   5. Feature access flags directly on users table
--   6. Flexible licensing: tenant_licenses, license_catalog, license_audit
--   7. Per-tenant auth config: tenant_auth_config
--   8. Invitation-only provisioning with seat enforcement
--
-- SAFETY: Infrastructure has never been deployed. Only seed data exists.
-- =============================================================================

-- =============================================================================
-- STEP 1: Restructure `users` as Single-Tenant User Table
-- =============================================================================

-- Remove the global UNIQUE on cognito_user_id (same person can be in multiple tenants)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_cognito_user_id_key;

-- Ensure tenant_id is NOT NULL (every user belongs to exactly one tenant)
-- tenant_id should already be NOT NULL from the original schema
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;

-- Drop old unique constraints that are incompatible
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tenant_id_email_key;

-- Add new unique constraints
-- Same email can exist in different tenants, but not twice in the same tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);
-- Same Cognito user can have records in different tenants
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_cognito ON users(tenant_id, cognito_user_id);

-- Add columns for the consolidated single-tenant user model
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- Tenant role (replaces old role enum)
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_role VARCHAR(50) DEFAULT 'standard_user'
    CHECK (tenant_role IN ('standard_user', 'tenant_admin', 'tenant_owner', 'viewer'));

-- Feature access flags (per-user, admin-configurable)
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_access_think_tank BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_access_curator BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_access_dojo BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_access_cato_trainer BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_access_genesis BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_access_tenant_admin BOOLEAN DEFAULT false;

-- SSO fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_provider VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_provider_user_id VARCHAR(255);

-- MFA
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_methods JSONB DEFAULT '[]';

-- Invitation tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by UUID;

-- Deactivation/deletion
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_by UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_scheduled_for TIMESTAMPTZ;

-- Usage tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_usage BIGINT DEFAULT 0;

-- Soft permissions (JSONB for flexibility — can add/modify/remove without migrations)
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

-- Update status enum to include deactivated
-- (Original CHECK only allows 'active', 'suspended', 'pending')
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
    CHECK (status IN ('active', 'suspended', 'pending', 'invited', 'deactivated'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant_status ON users(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, tenant_role);
CREATE INDEX IF NOT EXISTS idx_users_cognito ON users(cognito_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_invitation ON users(invitation_token) WHERE invitation_token IS NOT NULL;

COMMENT ON TABLE users IS 'Per-tenant user record. Each user belongs to exactly ONE tenant. Same email can exist in different tenants as separate records.';

-- =============================================================================
-- STEP 2: Drop redundant tables
-- =============================================================================

-- tenant_users is redundant — fields consolidated into users
DROP TABLE IF EXISTS tenant_users CASCADE;

-- tenant_user_memberships is no longer needed for multi-tenant membership
-- since each user IS the membership (one user = one tenant)
-- Keep it but mark deprecated — it may still be referenced by existing code
-- that can be updated incrementally
-- DROP TABLE IF EXISTS tenant_user_memberships CASCADE;  -- TODO: drop after all code updated

-- Drop the backward-compat view (no longer needed)
DROP VIEW IF EXISTS users_by_tenant;

-- =============================================================================
-- STEP 3: Licensing Tables
-- =============================================================================

-- Flexible license records: seats, storage, retention, compliance, add-ons
CREATE TABLE IF NOT EXISTS tenant_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    license_type VARCHAR(50) NOT NULL
        CHECK (license_type IN ('seat', 'storage', 'retention', 'compliance', 'feature', 'api_rate', 'addon')),

    app_id VARCHAR(50) NOT NULL DEFAULT 'platform'
        CHECK (app_id IN ('think_tank', 'curator', 'dojo', 'cato_trainer', 'genesis', 'platform')),

    feature_code VARCHAR(100),

    quantity INTEGER NOT NULL DEFAULT 0,
    used INTEGER NOT NULL DEFAULT 0,
    reserved INTEGER NOT NULL DEFAULT 0,
    unit VARCHAR(20) NOT NULL DEFAULT 'unit'
        CHECK (unit IN ('user', 'gb', 'days', 'requests', 'boolean', 'token', 'unit')),

    included_in_tier INTEGER NOT NULL DEFAULT 0,
    additional_purchased INTEGER NOT NULL DEFAULT 0,
    price_per_unit_cents INTEGER,
    overage_allowed BOOLEAN NOT NULL DEFAULT false,
    overage_price_per_unit_cents INTEGER,

    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,

    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenant_licenses_tenant ON tenant_licenses(tenant_id);
CREATE INDEX idx_tenant_licenses_type ON tenant_licenses(license_type, app_id);
CREATE INDEX idx_tenant_licenses_feature ON tenant_licenses(feature_code) WHERE feature_code IS NOT NULL;
CREATE INDEX idx_tenant_licenses_active ON tenant_licenses(tenant_id, is_active) WHERE is_active = true;

ALTER TABLE tenant_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_licenses_isolation ON tenant_licenses
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE tenant_licenses IS 'Flexible license records. Handles all license types: seats, storage, retention, compliance, add-ons. One row per license_type+app_id+feature_code per tenant.';

-- License catalog: available license types and pricing
CREATE TABLE IF NOT EXISTS license_catalog (
    id VARCHAR(100) PRIMARY KEY,

    license_type VARCHAR(50) NOT NULL,
    app_id VARCHAR(50) NOT NULL DEFAULT 'platform',
    feature_code VARCHAR(100),

    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL
        CHECK (category IN ('app_access', 'capacity', 'compliance', 'addon')),

    unit VARCHAR(20) NOT NULL,
    default_price_per_unit_cents INTEGER,

    included_tier_1 INTEGER NOT NULL DEFAULT 0,
    included_tier_2 INTEGER NOT NULL DEFAULT 0,
    included_tier_3 INTEGER NOT NULL DEFAULT 0,
    included_tier_4 INTEGER NOT NULL DEFAULT 0,
    included_tier_5 INTEGER NOT NULL DEFAULT 0,

    min_quantity INTEGER DEFAULT 0,
    max_quantity INTEGER,
    requires_license_ids TEXT[],

    is_public BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE license_catalog IS 'Available license types with tier defaults and pricing. Used by platform admin and billing system.';

-- License audit: all license changes logged
CREATE TABLE IF NOT EXISTS license_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    license_id UUID REFERENCES tenant_licenses(id) ON DELETE SET NULL,

    action VARCHAR(50) NOT NULL
        CHECK (action IN (
            'created', 'activated', 'deactivated', 'quantity_changed',
            'used_changed', 'reserved_changed', 'expired', 'renewed',
            'overage_triggered', 'tier_upgrade', 'tier_downgrade'
        )),

    old_value JSONB,
    new_value JSONB,

    performed_by UUID,
    performed_by_app VARCHAR(50)
        CHECK (performed_by_app IN ('radiant_admin', 'thinktank_tenant_admin', 'system', 'billing', 'api')),
    reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_license_audit_tenant ON license_audit(tenant_id, created_at DESC);
CREATE INDEX idx_license_audit_license ON license_audit(license_id);

ALTER TABLE license_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY license_audit_isolation ON license_audit
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE license_audit IS 'All license changes logged for compliance and billing reconciliation.';

-- =============================================================================
-- STEP 4: Per-Tenant Auth Config
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenant_auth_config (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,

    allow_password_login BOOLEAN NOT NULL DEFAULT true,
    allow_google_login BOOLEAN NOT NULL DEFAULT true,
    allow_apple_login BOOLEAN NOT NULL DEFAULT true,
    allow_microsoft_login BOOLEAN NOT NULL DEFAULT true,
    require_sso_only BOOLEAN NOT NULL DEFAULT false,
    require_mfa BOOLEAN NOT NULL DEFAULT false,

    sso_provider_type VARCHAR(50),
    sso_metadata_url TEXT,
    sso_entity_id VARCHAR(255),

    session_timeout_minutes INTEGER NOT NULL DEFAULT 60,
    max_failed_attempts INTEGER NOT NULL DEFAULT 5,
    lockout_duration_minutes INTEGER NOT NULL DEFAULT 30,

    invitation_expiry_days INTEGER NOT NULL DEFAULT 7,

    hipaa_mode BOOLEAN NOT NULL DEFAULT false,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID
);

COMMENT ON TABLE tenant_auth_config IS 'Per-tenant authentication settings: allowed login methods, MFA, SSO, session timeouts, HIPAA mode.';

-- =============================================================================
-- STEP 5: Safety Functions (updated for single-tenant model)
-- =============================================================================

-- Function: Deactivate a user (frees their seat license)
CREATE OR REPLACE FUNCTION deactivate_user(
    p_user_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_deactivated_by UUID DEFAULT NULL
) RETURNS TABLE (
    success BOOLEAN,
    seats_freed TEXT[],
    message TEXT
) AS $$
DECLARE
    v_tenant_id UUID;
    v_freed TEXT[] := '{}';
    v_app_id VARCHAR;
BEGIN
    -- Get the user's tenant
    SELECT tenant_id INTO v_tenant_id FROM users WHERE id = p_user_id AND status = 'active';

    IF v_tenant_id IS NULL THEN
        RETURN QUERY SELECT false, '{}'::TEXT[], 'No active user found with this ID'::TEXT;
        RETURN;
    END IF;

    -- Deactivate the user
    UPDATE users
    SET status = 'deactivated',
        deactivated_at = NOW(),
        deactivated_by = p_deactivated_by,
        deactivation_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Release seats for each app the user had access to
    FOR v_app_id IN
        SELECT CASE
            WHEN has_access_think_tank THEN 'think_tank'
            WHEN has_access_curator THEN 'curator'
            WHEN has_access_dojo THEN 'dojo'
            WHEN has_access_cato_trainer THEN 'cato_trainer'
            WHEN has_access_genesis THEN 'genesis'
        END
        FROM users WHERE id = p_user_id
    LOOP
        IF v_app_id IS NOT NULL THEN
            UPDATE tenant_licenses
            SET used = GREATEST(used - 1, 0), updated_at = NOW()
            WHERE tenant_id = v_tenant_id AND license_type = 'seat' AND app_id = v_app_id AND is_active = true;

            IF FOUND THEN
                v_freed := array_append(v_freed, v_app_id);
            END IF;
        END IF;
    END LOOP;

    -- Revoke tenant roles
    UPDATE tenant_user_roles SET is_active = false
    WHERE user_id = p_user_id AND tenant_id = v_tenant_id;

    -- Log action
    INSERT INTO user_admin_actions (user_id, tenant_id, action, details, performed_by, admin_app)
    VALUES (p_user_id, v_tenant_id, 'user_deactivated',
        jsonb_build_object('reason', p_reason, 'seats_freed', v_freed),
        p_deactivated_by, 'thinktank_tenant_admin');

    RETURN QUERY SELECT true, v_freed,
        format('User deactivated. Seats freed: %s', array_to_string(v_freed, ', '));
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION deactivate_user IS
    'Deactivates a user in their tenant. Frees all seat licenses. Data retained for regulatory compliance.';

-- Function: Request user deletion (respects retention licenses)
CREATE OR REPLACE FUNCTION request_user_deletion(
    p_user_id UUID,
    p_requested_by UUID DEFAULT NULL,
    p_reason TEXT DEFAULT 'User requested account deletion'
) RETURNS TABLE (
    success BOOLEAN,
    legal_holds INTEGER,
    retention_days INTEGER,
    blocked_reason TEXT,
    scheduled_for TIMESTAMPTZ,
    message TEXT
) AS $$
DECLARE
    v_tenant_id UUID;
    v_legal_hold_count INTEGER;
    v_retention INTEGER;
    v_schedule_date TIMESTAMPTZ;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM users WHERE id = p_user_id;

    -- Check legal holds
    SELECT COUNT(*) INTO v_legal_hold_count
    FROM data_retention_obligations
    WHERE user_id = p_user_id AND legal_hold = true;

    IF v_legal_hold_count > 0 THEN
        RETURN QUERY SELECT
            false, v_legal_hold_count, 0,
            format('Cannot delete: %s active legal hold(s) exist', v_legal_hold_count),
            NULL::TIMESTAMPTZ,
            'User deletion blocked by legal hold. Resolve legal holds first.'::TEXT;
        RETURN;
    END IF;

    -- Check tenant retention license
    SELECT COALESCE(MAX(tl.quantity), 30) INTO v_retention
    FROM tenant_licenses tl
    WHERE tl.tenant_id = v_tenant_id
      AND tl.license_type = 'retention'
      AND tl.is_active = true;

    -- Schedule deletion after retention period (minimum 30 days for GDPR)
    v_schedule_date := NOW() + (GREATEST(v_retention, 30) || ' days')::INTERVAL;

    UPDATE users
    SET status = 'deactivated',
        deletion_requested_at = NOW(),
        deletion_scheduled_for = v_schedule_date,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Log action
    INSERT INTO user_admin_actions (user_id, tenant_id, action, details, performed_by, admin_app)
    VALUES (p_user_id, v_tenant_id, 'deletion_requested',
        jsonb_build_object('reason', p_reason, 'retention_days', v_retention, 'scheduled_for', v_schedule_date),
        p_requested_by, 'thinktank_tenant_admin');

    RETURN QUERY SELECT
        true, v_legal_hold_count, v_retention, NULL::TEXT, v_schedule_date,
        format('User deletion scheduled for %s (%s-day retention period). Data retained until then.', v_schedule_date, v_retention);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION request_user_deletion IS
    'Schedules user data deletion after verifying no legal holds. Respects tenant retention license (minimum 30 days for GDPR).';

-- Function: Cancel a pending deletion
CREATE OR REPLACE FUNCTION cancel_user_deletion(
    p_user_id UUID,
    p_cancelled_by UUID DEFAULT NULL
) RETURNS TABLE (success BOOLEAN, message TEXT) AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM users WHERE id = p_user_id;

    UPDATE users
    SET deletion_requested_at = NULL,
        deletion_scheduled_for = NULL,
        updated_at = NOW()
    WHERE id = p_user_id AND deletion_scheduled_for IS NOT NULL;

    IF FOUND THEN
        INSERT INTO user_admin_actions (user_id, tenant_id, action, performed_by, admin_app)
        VALUES (p_user_id, v_tenant_id, 'deletion_cancelled', p_cancelled_by, 'thinktank_tenant_admin');

        RETURN QUERY SELECT true, 'User deletion cancelled.'::TEXT;
    ELSE
        RETURN QUERY SELECT false, 'No pending deletion found for this user.'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Check tenant license
CREATE OR REPLACE FUNCTION check_tenant_license(
    p_tenant_id UUID,
    p_license_type VARCHAR,
    p_app_id VARCHAR DEFAULT 'platform',
    p_feature_code VARCHAR DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenant_licenses
        WHERE tenant_id = p_tenant_id
          AND license_type = p_license_type
          AND app_id = p_app_id
          AND (p_feature_code IS NULL OR feature_code = p_feature_code)
          AND is_active = true
          AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_tenant_license IS
    'Checks if a tenant has an active license for a specific type/app/feature.';

-- Function: Get available seats for an app
CREATE OR REPLACE FUNCTION get_available_seats(
    p_tenant_id UUID,
    p_app_id VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    v_license tenant_licenses%ROWTYPE;
BEGIN
    SELECT * INTO v_license FROM tenant_licenses
    WHERE tenant_id = p_tenant_id
      AND license_type = 'seat'
      AND app_id = p_app_id
      AND is_active = true;

    IF NOT FOUND THEN RETURN 0; END IF;

    RETURN v_license.quantity - v_license.used - v_license.reserved;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_available_seats IS
    'Returns the number of available (unused, unreserved) seats for an app in a tenant.';

-- Function: Consume a seat (on user activation)
CREATE OR REPLACE FUNCTION consume_seat(
    p_tenant_id UUID,
    p_app_id VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_available INTEGER;
BEGIN
    v_available := get_available_seats(p_tenant_id, p_app_id);
    IF v_available <= 0 THEN RETURN false; END IF;

    UPDATE tenant_licenses
    SET used = used + 1, updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND license_type = 'seat'
      AND app_id = p_app_id
      AND is_active = true;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function: Release a seat (on user deactivation)
CREATE OR REPLACE FUNCTION release_seat(
    p_tenant_id UUID,
    p_app_id VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE tenant_licenses
    SET used = GREATEST(used - 1, 0), updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND license_type = 'seat'
      AND app_id = p_app_id
      AND is_active = true;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function: Reserve a seat (on invitation)
CREATE OR REPLACE FUNCTION reserve_seat(
    p_tenant_id UUID,
    p_app_id VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_available INTEGER;
BEGIN
    v_available := get_available_seats(p_tenant_id, p_app_id);
    IF v_available <= 0 THEN RETURN false; END IF;

    UPDATE tenant_licenses
    SET reserved = reserved + 1, updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND license_type = 'seat'
      AND app_id = p_app_id
      AND is_active = true;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function: Convert reserved seat to used (invitation accepted)
CREATE OR REPLACE FUNCTION activate_reserved_seat(
    p_tenant_id UUID,
    p_app_id VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE tenant_licenses
    SET reserved = GREATEST(reserved - 1, 0),
        used = used + 1,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND license_type = 'seat'
      AND app_id = p_app_id
      AND is_active = true;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 6: Admin Action Audit Trail
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL
        CHECK (action IN (
            'user_invited', 'user_activated', 'user_deactivated', 'user_reactivated',
            'role_changed', 'feature_toggled', 'app_access_changed',
            'deletion_requested', 'deletion_cancelled', 'deletion_executed',
            'cognito_disabled', 'cognito_enabled',
            'mfa_enabled', 'mfa_disabled',
            'license_created', 'license_changed', 'seat_consumed', 'seat_released'
        )),
    details JSONB DEFAULT '{}',
    performed_by UUID,
    admin_app VARCHAR(50) CHECK (admin_app IN ('radiant_admin', 'thinktank_admin', 'thinktank_tenant_admin', 'system', 'billing', 'api')),
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_uaa_user_id ON user_admin_actions(user_id);
CREATE INDEX idx_uaa_tenant_id ON user_admin_actions(tenant_id);
CREATE INDEX idx_uaa_action ON user_admin_actions(action);
CREATE INDEX idx_uaa_created_at ON user_admin_actions(created_at DESC);

ALTER TABLE user_admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY uaa_tenant_isolation ON user_admin_actions
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid
           OR tenant_id IS NULL);

COMMENT ON TABLE user_admin_actions IS
    'Audit trail for all user and license management actions across all admin apps.';

-- =============================================================================
-- STEP 7: RLS for users table
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =============================================================================
-- STEP 8: Seed license catalog
-- =============================================================================

INSERT INTO license_catalog (id, license_type, app_id, feature_code, display_name, description, category, unit, default_price_per_unit_cents, included_tier_1, included_tier_2, included_tier_3, included_tier_4, included_tier_5) VALUES
-- App seats
('seat:think_tank', 'seat', 'think_tank', NULL, 'Think Tank Seat', 'Access to Think Tank (Web + Mac)', 'app_access', 'user', 1500, 1, 10, 50, 200, 999999),
('seat:curator', 'seat', 'curator', NULL, 'Curator Seat', 'Access to Curator', 'app_access', 'user', 1500, 0, 5, 25, 100, 999999),
('seat:dojo', 'seat', 'dojo', NULL, 'Aurelius Dojo Seat', 'Access to Aurelius Dojo', 'app_access', 'user', 1500, 0, 5, 25, 100, 999999),
('seat:cato_trainer', 'seat', 'cato_trainer', NULL, 'Cato Trainer Seat', 'Access to Cato Trainer', 'app_access', 'user', 2000, 0, 0, 10, 50, 999999),
('seat:genesis', 'seat', 'genesis', NULL, 'Genesis Seat', 'Access to Genesis', 'app_access', 'user', 2000, 0, 0, 10, 50, 999999),
-- Storage
('storage:platform', 'storage', 'platform', NULL, 'Platform Storage', 'Platform-wide storage quota', 'capacity', 'gb', 50, 1, 10, 100, 1000, 10000),
-- Retention
('retention:default', 'retention', 'platform', NULL, 'Default Retention', 'Data retention period', 'capacity', 'days', 0, 30, 90, 365, 365, 730),
-- Compliance
('compliance:hipaa', 'compliance', 'platform', 'hipaa', 'HIPAA Compliance', 'HIPAA compliance features: PHI management, enhanced audit, BAA', 'compliance', 'boolean', 50000, 0, 0, 0, 0, 1),
('compliance:hipaa_retention', 'compliance', 'platform', 'hipaa_retention', 'HIPAA 7-Year Retention', '7-year record retention for HIPAA', 'compliance', 'boolean', 25000, 0, 0, 0, 0, 1),
('compliance:gdpr', 'compliance', 'platform', 'gdpr', 'GDPR Compliance', 'GDPR features: erasure, portability, consent, DSAR', 'compliance', 'boolean', 30000, 0, 0, 0, 1, 1),
('compliance:soc2', 'compliance', 'platform', 'soc2', 'SOC 2 Type II', 'SOC 2 features: self-audit, evidence collection, compliance reports', 'compliance', 'boolean', 40000, 0, 0, 0, 0, 1),
('compliance:ccpa', 'compliance', 'platform', 'ccpa', 'CCPA Compliance', 'CCPA features: consumer privacy rights, opt-out tracking', 'compliance', 'boolean', 20000, 0, 0, 0, 1, 1),
('compliance:iso27001', 'compliance', 'platform', 'iso27001', 'ISO 27001', 'ISO 27001 features: 93 Annex A controls, risk assessment, ISMS', 'compliance', 'boolean', 35000, 0, 0, 0, 0, 1),
('compliance:data_residency', 'compliance', 'platform', 'data_residency', 'Data Residency', 'Region-specific data storage, EU-only mode', 'compliance', 'boolean', 20000, 0, 0, 0, 0, 1),
('compliance:enhanced_audit', 'compliance', 'platform', 'enhanced_audit', 'Enhanced Audit', 'Per-request audit logging, IP tracking, device fingerprinting', 'compliance', 'boolean', 15000, 0, 0, 0, 0, 1),
('compliance:pci_dss', 'compliance', 'platform', 'pci_dss', 'PCI-DSS', 'Cardholder data environment controls', 'compliance', 'boolean', 30000, 0, 0, 0, 0, 1),
('compliance:fedramp', 'compliance', 'platform', 'fedramp', 'FedRAMP', 'Gov cloud compliance, FIPS 140-2', 'compliance', 'boolean', 75000, 0, 0, 0, 0, 0),
('compliance:hitrust', 'compliance', 'platform', 'hitrust', 'HITRUST CSF', 'Healthcare security framework', 'compliance', 'boolean', 40000, 0, 0, 0, 0, 1),
('compliance:eu_ai_act', 'compliance', 'platform', 'eu_ai_act', 'EU AI Act', 'AI risk classification, transparency, human oversight', 'compliance', 'boolean', 25000, 0, 0, 0, 0, 1),
-- Add-ons
('addon:custom_models', 'addon', 'platform', 'custom_models', 'Custom Models', 'Self-hosted custom model support', 'addon', 'boolean', 100000, 0, 0, 0, 0, 1),
('addon:dedicated_support', 'addon', 'platform', 'dedicated_support', 'Dedicated Support', 'Dedicated support channel', 'addon', 'boolean', 50000, 0, 0, 0, 0, 1),
('addon:white_label', 'addon', 'platform', 'white_label', 'White Label', 'Custom branding', 'addon', 'boolean', 75000, 0, 0, 0, 0, 1),
('addon:sso_enterprise', 'addon', 'platform', 'sso_enterprise', 'Enterprise SSO', 'SAML/OIDC SSO', 'addon', 'boolean', 25000, 0, 0, 0, 1, 1),
('addon:advanced_analytics', 'addon', 'platform', 'advanced_analytics', 'Advanced Analytics', 'Advanced analytics dashboard', 'addon', 'boolean', 20000, 0, 0, 0, 0, 1)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- DONE
-- =============================================================================
-- Summary of changes (v7.23.0):
-- 1. `users` table is single-tenant: tenant_id NOT NULL, UNIQUE(tenant_id, email)
-- 2. Feature access flags directly on users (has_access_think_tank, etc.)
-- 3. `tenant_users` table DROPPED (redundant)
-- 4. `tenant_licenses` table: flexible multi-dimension licensing
-- 5. `license_catalog` table: available license types with tier defaults (seeded)
-- 6. `license_audit` table: all license changes logged
-- 7. `tenant_auth_config` table: per-tenant auth settings
-- 8. Safety functions: deactivate_user, request_user_deletion, cancel_user_deletion
-- 9. Licensing functions: check_tenant_license, get_available_seats, consume_seat,
--    release_seat, reserve_seat, activate_reserved_seat
-- 10. `user_admin_actions` audit table with updated action types
-- 11. RLS on all new tables
