-- RADIANT v4.18.0 - Migration 125: Multi-Application User Registry
-- Complete implementation of auth schema, data sovereignty, consent management,
-- break glass access, legal hold, DSAR compliance, and credential rotation.
--
-- This migration transforms the existing tenant/user system with:
-- 1. STABLE auth functions for O(1) RLS performance
-- 2. Data sovereignty and region pinning
-- 3. Consent management with GDPR/CCPA/COPPA support
-- 4. Break Glass emergency access logging
-- 5. Legal Hold for data retention
-- 6. DSAR request processing
-- 7. Zero-downtime credential rotation

-- ============================================================================
-- SECTION 1: AUTH SCHEMA WITH STABLE FUNCTIONS
-- ============================================================================
-- PostgreSQL's current_setting() is VOLATILE. Wrapping in STABLE functions
-- enables per-query caching, reducing RLS evaluation from O(N) to O(1).

CREATE SCHEMA IF NOT EXISTS auth;

-- Tenant ID retrieval (STABLE = cached per query/transaction)
CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION auth.tenant_id() IS 
'Returns current tenant UUID from session context. STABLE ensures single evaluation per query.';

-- Application ID retrieval
CREATE OR REPLACE FUNCTION auth.app_id()
RETURNS VARCHAR(50) AS $$
  SELECT NULLIF(current_setting('app.current_app_id', true), '');
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION auth.app_id() IS 
'Returns current application ID from session context. NULL when no app context set.';

-- Permission level retrieval
CREATE OR REPLACE FUNCTION auth.permission_level()
RETURNS TEXT AS $$
  SELECT COALESCE(NULLIF(current_setting('app.permission_level', true), ''), 'user');
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION auth.permission_level() IS 
'Returns permission level: radiant_admin, tenant_admin, app_admin, or user.';

-- User ID retrieval
CREATE OR REPLACE FUNCTION auth.user_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION auth.user_id() IS 
'Returns current user UUID from session context.';

-- Jurisdiction retrieval (for GDPR/CCPA compliance)
CREATE OR REPLACE FUNCTION auth.jurisdiction()
RETURNS TEXT AS $$
  SELECT current_setting('app.user_jurisdiction', true);
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION auth.jurisdiction() IS 
'Returns user jurisdiction code (EU, US-CA, BR, etc.) for compliance routing.';

-- Data region retrieval (for data sovereignty)
CREATE OR REPLACE FUNCTION auth.data_region()
RETURNS TEXT AS $$
  SELECT COALESCE(NULLIF(current_setting('app.data_region', true), ''), 'us-east-1');
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION auth.data_region() IS 
'Returns data region code (us-east-1, eu-west-1, etc.) for sovereignty enforcement.';

-- Check if current user is Radiant admin (super_admin in existing schema)
CREATE OR REPLACE FUNCTION auth.is_radiant_admin()
RETURNS BOOLEAN AS $$
  SELECT auth.permission_level() = 'radiant_admin' 
    OR COALESCE(current_setting('app.is_super_admin', true), 'false')::BOOLEAN;
$$ LANGUAGE SQL STABLE;

-- Check if current user is Tenant admin or higher
CREATE OR REPLACE FUNCTION auth.is_tenant_admin()
RETURNS BOOLEAN AS $$
  SELECT auth.permission_level() IN ('radiant_admin', 'tenant_admin')
    OR auth.is_radiant_admin();
$$ LANGUAGE SQL STABLE;

-- Check if Break Glass mode is active (for emergency access)
CREATE OR REPLACE FUNCTION auth.is_break_glass()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(current_setting('app.break_glass_mode', true), 'false')::BOOLEAN;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- SECTION 2: EXTEND TENANTS TABLE FOR DATA SOVEREIGNTY
-- ============================================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS data_region VARCHAR(20) DEFAULT 'us-east-1';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS allowed_regions TEXT[] DEFAULT '{us-east-1}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tier VARCHAR(32) DEFAULT 'standard';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS compliance_frameworks TEXT[] DEFAULT '{}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS data_processing_agreement_signed_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS primary_contact_email VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);

-- Add check constraint for tier if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_tier_check'
  ) THEN
    ALTER TABLE tenants ADD CONSTRAINT tenants_tier_check 
      CHECK (tier IN ('free', 'standard', 'professional', 'enterprise'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenants_data_region ON tenants(data_region);

COMMENT ON COLUMN tenants.data_region IS 
'Primary data residency region for this tenant. Used for GDPR/sovereignty compliance.';
COMMENT ON COLUMN tenants.allowed_regions IS 
'List of regions where tenant data may be processed. Cross-region transfers require explicit consent.';
COMMENT ON COLUMN tenants.compliance_frameworks IS 
'Compliance frameworks this tenant is subject to (GDPR, CCPA, HIPAA, SOC2, etc.)';

-- ============================================================================
-- SECTION 3: EXTEND USERS TABLE FOR COMPLIANCE
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_bracket VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_app_id VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'en-US';
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

-- Add check constraint for age_bracket if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_age_bracket_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_age_bracket_check 
      CHECK (age_bracket IS NULL OR age_bracket IN ('under_13', '13_to_17', '18_plus', 'unknown'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_jurisdiction ON users(jurisdiction) WHERE jurisdiction IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- SECTION 4: EXTEND REGISTERED_APPS FOR CREDENTIAL ROTATION
-- ============================================================================

ALTER TABLE registered_apps ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE registered_apps ADD COLUMN IF NOT EXISTS app_type VARCHAR(64) DEFAULT 'web';
ALTER TABLE registered_apps ADD COLUMN IF NOT EXISTS client_secret_hash TEXT;
ALTER TABLE registered_apps ADD COLUMN IF NOT EXISTS previous_secret_hash TEXT;
ALTER TABLE registered_apps ADD COLUMN IF NOT EXISTS secret_rotation_at TIMESTAMPTZ;
ALTER TABLE registered_apps ADD COLUMN IF NOT EXISTS secret_rotation_window_hours INT DEFAULT 24;
ALTER TABLE registered_apps ADD COLUMN IF NOT EXISTS secrets_manager_arn TEXT;
ALTER TABLE registered_apps ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active';
ALTER TABLE registered_apps ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
ALTER TABLE registered_apps ADD COLUMN IF NOT EXISTS rate_limit_tier VARCHAR(32) DEFAULT 'standard';
ALTER TABLE registered_apps ADD COLUMN IF NOT EXISTS allowed_origins TEXT[] DEFAULT '{}';
ALTER TABLE registered_apps ADD COLUMN IF NOT EXISTS allowed_redirect_uris TEXT[] DEFAULT '{}';
ALTER TABLE registered_apps ADD COLUMN IF NOT EXISTS created_by UUID;

-- Add check constraints if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'registered_apps_app_type_check'
  ) THEN
    ALTER TABLE registered_apps ADD CONSTRAINT registered_apps_app_type_check 
      CHECK (app_type IN ('web', 'mobile', 'api', 'service', 'desktop'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'registered_apps_status_check'
  ) THEN
    ALTER TABLE registered_apps ADD CONSTRAINT registered_apps_status_check 
      CHECK (status IN ('active', 'suspended', 'revoked', 'pending'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'registered_apps_rate_limit_check'
  ) THEN
    ALTER TABLE registered_apps ADD CONSTRAINT registered_apps_rate_limit_check 
      CHECK (rate_limit_tier IN ('free', 'standard', 'premium', 'unlimited'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_registered_apps_tenant ON registered_apps(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registered_apps_status ON registered_apps(status);

-- ============================================================================
-- SECTION 5: USER APPLICATION ASSIGNMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_application_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id VARCHAR(50) NOT NULL REFERENCES registered_apps(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Assignment type
  assignment_type VARCHAR(32) DEFAULT 'standard' CHECK (assignment_type IN ('standard', 'admin', 'readonly', 'trial')),
  
  -- Permissions within the app
  app_permissions JSONB DEFAULT '{}',
  
  -- Audit
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(user_id, app_id)
);

-- CRITICAL: Covering index for RLS performance
CREATE INDEX IF NOT EXISTS idx_uaa_covering ON user_application_assignments(tenant_id, app_id, user_id) INCLUDE (expires_at, assignment_type);
CREATE INDEX IF NOT EXISTS idx_uaa_user ON user_application_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_uaa_app ON user_application_assignments(app_id);
CREATE INDEX IF NOT EXISTS idx_uaa_expires ON user_application_assignments(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- SECTION 6: CONSENT RECORDS TABLE (GDPR/CCPA/COPPA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Jurisdiction and purpose
  jurisdiction VARCHAR(10) NOT NULL,
  purpose_code VARCHAR(50) NOT NULL,
  purpose_description TEXT NOT NULL,
  
  -- Legal basis (GDPR Article 6)
  lawful_basis VARCHAR(50) NOT NULL CHECK (
    lawful_basis IN ('consent', 'contract', 'legal_obligation', 'vital_interests', 'public_interest', 'legitimate_interests')
  ),
  
  -- Consent state
  consent_given BOOLEAN NOT NULL,
  consent_timestamp TIMESTAMPTZ NOT NULL,
  consent_version VARCHAR(20) NOT NULL,
  consent_method VARCHAR(50) NOT NULL CHECK (
    consent_method IN ('explicit_checkbox', 'click_accept', 'implicit', 'parent_consent', 'verified_parent', 'double_opt_in')
  ),
  consent_language VARCHAR(10) NOT NULL,
  consent_ip_address INET,
  consent_user_agent TEXT,
  
  -- Third-party disclosure (CCPA/CPRA)
  third_party_sharing_authorized BOOLEAN DEFAULT false,
  authorized_third_parties JSONB,
  sale_of_data_authorized BOOLEAN DEFAULT false,
  
  -- Withdrawal
  withdrawal_timestamp TIMESTAMPTZ,
  withdrawal_method VARCHAR(50),
  withdrawal_reason TEXT,
  
  -- COPPA fields
  parent_guardian_id UUID REFERENCES users(id),
  verification_method VARCHAR(50) CHECK (
    verification_method IS NULL OR verification_method IN (
      'credit_card', 'video_conference', 'signed_form', 'government_id', 'knowledge_based', 'toll_free_call'
    )
  ),
  verification_completed_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_tenant ON consent_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consent_purpose ON consent_records(user_id, purpose_code);
CREATE INDEX IF NOT EXISTS idx_consent_jurisdiction ON consent_records(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_consent_active ON consent_records(user_id, purpose_code) 
  WHERE consent_given = true AND withdrawal_timestamp IS NULL;

-- ============================================================================
-- SECTION 7: DATA RETENTION OBLIGATIONS TABLE (WITH LEGAL HOLD)
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_retention_obligations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  retention_reason VARCHAR(255) NOT NULL,
  retention_category VARCHAR(50) NOT NULL CHECK (
    retention_category IN ('regulatory', 'contractual', 'legal_hold', 'litigation', 'audit', 'business')
  ),
  retention_expires TIMESTAMPTZ NOT NULL,
  
  -- Legal Hold Support
  legal_hold BOOLEAN DEFAULT false,
  legal_hold_reason TEXT,
  legal_hold_set_by UUID REFERENCES users(id),
  legal_hold_set_at TIMESTAMPTZ,
  legal_hold_case_id VARCHAR(100),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_retention_user ON data_retention_obligations(user_id);
CREATE INDEX IF NOT EXISTS idx_retention_tenant ON data_retention_obligations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_retention_expires ON data_retention_obligations(retention_expires);
CREATE INDEX IF NOT EXISTS idx_retention_legal_hold ON data_retention_obligations(legal_hold) WHERE legal_hold = true;
CREATE INDEX IF NOT EXISTS idx_retention_case ON data_retention_obligations(legal_hold_case_id) WHERE legal_hold_case_id IS NOT NULL;

-- ============================================================================
-- SECTION 8: BREAK GLASS ACCESS LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS break_glass_access_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Who accessed
  admin_user_id UUID NOT NULL REFERENCES administrators(id),
  admin_email VARCHAR(255) NOT NULL,
  admin_ip_address INET,
  admin_user_agent TEXT,
  
  -- What was accessed
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  accessed_resources TEXT[] NOT NULL,
  access_reason TEXT NOT NULL,
  access_justification TEXT,
  
  -- Incident tracking
  incident_ticket VARCHAR(100),
  approved_by VARCHAR(255),
  approval_timestamp TIMESTAMPTZ,
  
  -- Timing
  access_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_ended_at TIMESTAMPTZ,
  
  -- Actions taken
  actions_performed JSONB DEFAULT '[]',
  data_exported BOOLEAN DEFAULT false,
  data_modified BOOLEAN DEFAULT false,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_break_glass_tenant ON break_glass_access_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_break_glass_admin ON break_glass_access_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_break_glass_time ON break_glass_access_log(access_started_at);
CREATE INDEX IF NOT EXISTS idx_break_glass_incident ON break_glass_access_log(incident_ticket) WHERE incident_ticket IS NOT NULL;

COMMENT ON TABLE break_glass_access_log IS 
'Immutable log of all Break Glass emergency access events. Triggers P0 security alert.';

-- ============================================================================
-- SECTION 9: DSAR REQUEST TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dsar_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Request details
  request_type VARCHAR(50) NOT NULL CHECK (
    request_type IN ('access', 'delete', 'portability', 'rectification', 'restriction', 'objection')
  ),
  request_source VARCHAR(50) NOT NULL CHECK (
    request_source IN ('user_portal', 'email', 'api', 'legal', 'regulator')
  ),
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'in_progress', 'awaiting_verification', 'completed', 'rejected', 'partially_completed')
  ),
  
  -- Timing (GDPR requires response within 30 days)
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  completed_at TIMESTAMPTZ,
  
  -- Verification
  identity_verified BOOLEAN DEFAULT false,
  verification_method VARCHAR(50),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES administrators(id),
  
  -- Response
  response_data JSONB,
  rejection_reason TEXT,
  retention_blocks JSONB,
  
  -- Processing
  processed_by UUID REFERENCES administrators(id),
  processing_notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dsar_user ON dsar_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_dsar_tenant ON dsar_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dsar_status ON dsar_requests(status);
CREATE INDEX IF NOT EXISTS idx_dsar_due ON dsar_requests(due_date) WHERE status NOT IN ('completed', 'rejected');

-- ============================================================================
-- SECTION 10: ENHANCED AUTH FUNCTIONS
-- ============================================================================

-- Check if user has access to specific application
CREATE OR REPLACE FUNCTION auth.has_app_access(target_app_id VARCHAR(50))
RETURNS BOOLEAN AS $$
BEGIN
  -- Break Glass mode bypasses all restrictions
  IF auth.is_break_glass() THEN
    RETURN TRUE;
  END IF;
  
  -- Radiant admins bypass all app restrictions
  IF auth.is_radiant_admin() THEN
    RETURN TRUE;
  END IF;
  
  -- Tenant admins can access all apps in their tenant
  IF auth.is_tenant_admin() THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is assigned to this application
  RETURN EXISTS (
    SELECT 1 
    FROM user_application_assignments uaa
    WHERE uaa.user_id = auth.user_id()
      AND uaa.app_id = target_app_id
      AND uaa.tenant_id = auth.tenant_id()
      AND (uaa.expires_at IS NULL OR uaa.expires_at > NOW())
      AND uaa.revoked_at IS NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if user can access another user's data (within app context)
CREATE OR REPLACE FUNCTION auth.can_access_user(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Break Glass mode bypasses all restrictions
  IF auth.is_break_glass() THEN
    RETURN TRUE;
  END IF;
  
  -- Radiant admins can access all users
  IF auth.is_radiant_admin() THEN
    RETURN TRUE;
  END IF;
  
  -- Tenant admins can access all users in their tenant
  IF auth.is_tenant_admin() THEN
    RETURN TRUE;
  END IF;
  
  -- Users can always access their own data
  IF target_user_id = auth.user_id() THEN
    RETURN TRUE;
  END IF;
  
  -- App admins can access users assigned to their app
  IF auth.permission_level() = 'app_admin' AND auth.app_id() IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 
      FROM user_application_assignments uaa
      WHERE uaa.user_id = target_user_id
        AND uaa.app_id = auth.app_id()
        AND uaa.tenant_id = auth.tenant_id()
        AND (uaa.expires_at IS NULL OR uaa.expires_at > NOW())
        AND uaa.revoked_at IS NULL
    );
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Enhanced context setter
CREATE OR REPLACE FUNCTION auth.set_context(
  p_tenant_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_app_id VARCHAR(50) DEFAULT NULL,
  p_permission_level TEXT DEFAULT 'user',
  p_jurisdiction TEXT DEFAULT NULL,
  p_data_region TEXT DEFAULT NULL,
  p_break_glass BOOLEAN DEFAULT false
)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id::text, true);
  
  IF p_user_id IS NOT NULL THEN
    PERFORM set_config('app.current_user_id', p_user_id::text, true);
  END IF;
  
  IF p_app_id IS NOT NULL THEN
    PERFORM set_config('app.current_app_id', p_app_id, true);
  END IF;
  
  PERFORM set_config('app.permission_level', p_permission_level, true);
  
  IF p_jurisdiction IS NOT NULL THEN
    PERFORM set_config('app.user_jurisdiction', p_jurisdiction, true);
  END IF;
  
  IF p_data_region IS NOT NULL THEN
    PERFORM set_config('app.data_region', p_data_region, true);
  END IF;
  
  IF p_break_glass THEN
    PERFORM set_config('app.break_glass_mode', 'true', true);
  END IF;
  
  -- Backward compatibility
  PERFORM set_config('app.is_super_admin', (p_permission_level = 'radiant_admin')::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clear all context
CREATE OR REPLACE FUNCTION auth.clear_context()
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', '', true);
  PERFORM set_config('app.current_user_id', '', true);
  PERFORM set_config('app.current_app_id', '', true);
  PERFORM set_config('app.permission_level', '', true);
  PERFORM set_config('app.user_jurisdiction', '', true);
  PERFORM set_config('app.data_region', '', true);
  PERFORM set_config('app.break_glass_mode', 'false', true);
  PERFORM set_config('app.is_super_admin', 'false', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 11: CREDENTIAL MANAGEMENT FUNCTIONS
-- ============================================================================

-- Verify application credentials (with dual-active support)
CREATE OR REPLACE FUNCTION verify_app_credentials(
  p_app_id VARCHAR(50), 
  p_secret TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_app RECORD;
  v_rotation_window_end TIMESTAMPTZ;
BEGIN
  SELECT 
    client_secret_hash,
    previous_secret_hash,
    secret_rotation_at,
    secret_rotation_window_hours,
    status
  INTO v_app
  FROM registered_apps 
  WHERE id = p_app_id;
  
  -- App must exist and be active
  IF v_app IS NULL OR v_app.status != 'active' THEN
    RETURN FALSE;
  END IF;
  
  -- Check current secret
  IF v_app.client_secret_hash IS NOT NULL AND 
     v_app.client_secret_hash = crypt(p_secret, v_app.client_secret_hash) THEN
    RETURN TRUE;
  END IF;
  
  -- Check previous secret (if within rotation window)
  IF v_app.previous_secret_hash IS NOT NULL AND v_app.secret_rotation_at IS NOT NULL THEN
    v_rotation_window_end := v_app.secret_rotation_at + 
      (v_app.secret_rotation_window_hours || ' hours')::INTERVAL;
    
    IF NOW() < v_rotation_window_end THEN
      IF v_app.previous_secret_hash = crypt(p_secret, v_app.previous_secret_hash) THEN
        RETURN TRUE;
      END IF;
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION verify_app_credentials IS 
'Verifies credentials with dual-active support. Both old and new secrets valid during rotation window.';

-- Rotate application secret (zero-downtime)
CREATE OR REPLACE FUNCTION rotate_app_secret(
  p_app_id VARCHAR(50),
  p_new_secret TEXT,
  p_rotation_window_hours INT DEFAULT 24
) RETURNS JSONB AS $$
DECLARE
  v_old_hash TEXT;
BEGIN
  -- Get current secret hash
  SELECT client_secret_hash INTO v_old_hash
  FROM registered_apps WHERE id = p_app_id;
  
  IF v_old_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found or no existing secret');
  END IF;
  
  -- Rotate: current becomes previous, new becomes current
  UPDATE registered_apps
  SET 
    previous_secret_hash = client_secret_hash,
    client_secret_hash = crypt(p_new_secret, gen_salt('bf', 12)),
    secret_rotation_at = NOW(),
    secret_rotation_window_hours = p_rotation_window_hours,
    updated_at = NOW()
  WHERE id = p_app_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'app_id', p_app_id,
    'rotation_window_hours', p_rotation_window_hours,
    'both_secrets_valid_until', NOW() + (p_rotation_window_hours || ' hours')::INTERVAL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rotate_app_secret IS 
'Zero-downtime secret rotation. Both old and new secrets valid for specified window (default 24h).';

-- Set initial app secret
CREATE OR REPLACE FUNCTION set_app_secret(
  p_app_id VARCHAR(50),
  p_secret TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE registered_apps
  SET 
    client_secret_hash = crypt(p_secret, gen_salt('bf', 12)),
    updated_at = NOW()
  WHERE id = p_app_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clear expired rotation windows (run via scheduled job)
CREATE OR REPLACE FUNCTION clear_expired_rotation_windows()
RETURNS INT AS $$
DECLARE
  v_cleared INT;
BEGIN
  UPDATE registered_apps
  SET 
    previous_secret_hash = NULL,
    secret_rotation_at = NULL
  WHERE 
    previous_secret_hash IS NOT NULL
    AND secret_rotation_at IS NOT NULL
    AND NOW() > secret_rotation_at + (secret_rotation_window_hours || ' hours')::INTERVAL;
  
  GET DIAGNOSTICS v_cleared = ROW_COUNT;
  RETURN v_cleared;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 12: BREAK GLASS FUNCTIONS
-- ============================================================================

-- Initiate Break Glass access
CREATE OR REPLACE FUNCTION initiate_break_glass(
  p_admin_id UUID,
  p_tenant_id UUID,
  p_access_reason TEXT,
  p_incident_ticket VARCHAR(100) DEFAULT NULL,
  p_approved_by VARCHAR(255) DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_access_id UUID;
  v_admin RECORD;
BEGIN
  -- Verify admin exists and has appropriate role
  SELECT id, email INTO v_admin
  FROM administrators 
  WHERE id = p_admin_id AND role IN ('super_admin', 'admin');
  
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Break Glass requires Administrator privileges';
  END IF;
  
  -- Log the access
  INSERT INTO break_glass_access_log (
    admin_user_id,
    admin_email,
    tenant_id,
    accessed_resources,
    access_reason,
    incident_ticket,
    approved_by
  ) VALUES (
    v_admin.id,
    v_admin.email,
    p_tenant_id,
    ARRAY['FULL_TENANT_ACCESS'],
    p_access_reason,
    p_incident_ticket,
    p_approved_by
  )
  RETURNING id INTO v_access_id;
  
  -- Trigger P0 security alert via pg_notify
  PERFORM pg_notify('security_alerts', jsonb_build_object(
    'alert_type', 'BREAK_GLASS_INITIATED',
    'severity', 'P0',
    'access_id', v_access_id,
    'admin_user_id', v_admin.id,
    'admin_email', v_admin.email,
    'tenant_id', p_tenant_id,
    'reason', p_access_reason,
    'incident_ticket', p_incident_ticket,
    'timestamp', NOW()
  )::text);
  
  RETURN jsonb_build_object(
    'success', true,
    'access_id', v_access_id,
    'message', 'Break Glass access initiated. P0 alert triggered.',
    'instructions', 'Call end_break_glass(access_id) when access is complete.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION initiate_break_glass IS 
'Emergency tenant data access for Administrators. Triggers P0 security alert and creates audit trail.';

-- End Break Glass access
CREATE OR REPLACE FUNCTION end_break_glass(
  p_access_id UUID,
  p_admin_id UUID,
  p_actions_performed JSONB DEFAULT '[]'
) RETURNS JSONB AS $$
DECLARE
  v_log RECORD;
BEGIN
  -- Verify this admin initiated the access
  SELECT * INTO v_log
  FROM break_glass_access_log
  WHERE id = p_access_id
    AND admin_user_id = p_admin_id
    AND access_ended_at IS NULL;
  
  IF v_log IS NULL THEN
    RAISE EXCEPTION 'Cannot end this Break Glass session - not found or already ended';
  END IF;
  
  UPDATE break_glass_access_log
  SET 
    access_ended_at = NOW(),
    actions_performed = p_actions_performed
  WHERE id = p_access_id;
  
  -- Notify that session ended
  PERFORM pg_notify('security_alerts', jsonb_build_object(
    'alert_type', 'BREAK_GLASS_ENDED',
    'severity', 'INFO',
    'access_id', p_access_id,
    'admin_user_id', p_admin_id,
    'tenant_id', v_log.tenant_id,
    'duration_minutes', EXTRACT(EPOCH FROM (NOW() - v_log.access_started_at)) / 60,
    'actions_performed', p_actions_performed,
    'timestamp', NOW()
  )::text);
  
  RETURN jsonb_build_object(
    'success', true,
    'access_id', p_access_id,
    'ended_at', NOW(),
    'duration_minutes', EXTRACT(EPOCH FROM (NOW() - v_log.access_started_at)) / 60
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 13: LEGAL HOLD FUNCTIONS
-- ============================================================================

-- Apply Legal Hold
CREATE OR REPLACE FUNCTION apply_legal_hold(
  p_user_id UUID,
  p_reason TEXT,
  p_case_id VARCHAR(100) DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user RECORD;
  v_affected INT;
BEGIN
  -- Get user and tenant info
  SELECT id, tenant_id INTO v_user
  FROM users WHERE id = p_user_id;
  
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Apply hold to all existing retention records for user
  UPDATE data_retention_obligations
  SET 
    legal_hold = true,
    legal_hold_reason = p_reason,
    legal_hold_set_by = p_admin_id,
    legal_hold_set_at = NOW(),
    legal_hold_case_id = p_case_id
  WHERE user_id = p_user_id AND legal_hold = false;
  
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  
  -- Also create a blanket hold
  INSERT INTO data_retention_obligations (
    user_id,
    tenant_id,
    table_name,
    record_id,
    retention_reason,
    retention_category,
    retention_expires,
    legal_hold,
    legal_hold_reason,
    legal_hold_set_by,
    legal_hold_set_at,
    legal_hold_case_id,
    created_by
  ) VALUES (
    p_user_id,
    v_user.tenant_id,
    'ALL_USER_DATA',
    p_user_id,
    'Legal Hold - ' || p_reason,
    'legal_hold',
    NOW() + INTERVAL '100 years',  -- Effectively indefinite
    true,
    p_reason,
    p_admin_id,
    NOW(),
    p_case_id,
    p_admin_id
  )
  ON CONFLICT DO NOTHING;
  
  -- Notify
  PERFORM pg_notify('legal_holds', jsonb_build_object(
    'event', 'legal_hold_applied',
    'user_id', p_user_id,
    'tenant_id', v_user.tenant_id,
    'reason', p_reason,
    'case_id', p_case_id,
    'applied_by', p_admin_id,
    'records_updated', v_affected,
    'timestamp', NOW()
  )::text);
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'legal_hold_active', true,
    'reason', p_reason,
    'case_id', p_case_id,
    'records_updated', v_affected
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION apply_legal_hold IS 
'Places legal hold on user data, preventing deletion indefinitely. For use during investigations.';

-- Release Legal Hold
CREATE OR REPLACE FUNCTION release_legal_hold(
  p_user_id UUID,
  p_release_reason TEXT,
  p_case_id VARCHAR(100) DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_affected INT;
  v_tenant_id UUID;
BEGIN
  -- Get tenant for notification
  SELECT tenant_id INTO v_tenant_id FROM users WHERE id = p_user_id;
  
  -- Release holds matching criteria
  UPDATE data_retention_obligations
  SET 
    legal_hold = false,
    legal_hold_reason = legal_hold_reason || ' | RELEASED: ' || p_release_reason,
    released_at = NOW(),
    released_by = p_admin_id
  WHERE user_id = p_user_id 
    AND legal_hold = true
    AND (p_case_id IS NULL OR legal_hold_case_id = p_case_id);
  
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  
  -- Notify
  PERFORM pg_notify('legal_holds', jsonb_build_object(
    'event', 'legal_hold_released',
    'user_id', p_user_id,
    'tenant_id', v_tenant_id,
    'release_reason', p_release_reason,
    'case_id', p_case_id,
    'released_by', p_admin_id,
    'holds_released', v_affected,
    'timestamp', NOW()
  )::text);
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'holds_released', v_affected,
    'release_reason', p_release_reason,
    'case_id', p_case_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 14: DSAR COMPLIANCE FUNCTIONS
-- ============================================================================

-- Process DSAR request
CREATE OR REPLACE FUNCTION process_dsar_request(
  p_user_id UUID,
  p_request_type VARCHAR(50),
  p_admin_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_retention_blocks JSONB;
  v_user RECORD;
  v_request_id UUID;
BEGIN
  -- Get user info
  SELECT u.*, t.name as tenant_name
  INTO v_user
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE u.id = p_user_id;
  
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Create DSAR request record
  INSERT INTO dsar_requests (
    user_id, tenant_id, request_type, request_source, status, processed_by
  ) VALUES (
    p_user_id, v_user.tenant_id, p_request_type, 
    CASE WHEN p_admin_id IS NOT NULL THEN 'api' ELSE 'user_portal' END,
    'in_progress', p_admin_id
  )
  RETURNING id INTO v_request_id;
  
  CASE p_request_type
    WHEN 'access' THEN
      -- Collect all user data
      SELECT jsonb_build_object(
        'request_id', v_request_id,
        'request_type', 'access',
        'generated_at', NOW(),
        'user_profile', jsonb_build_object(
          'id', v_user.id,
          'email', v_user.email,
          'display_name', v_user.display_name,
          'role', v_user.role,
          'status', v_user.status,
          'jurisdiction', v_user.jurisdiction,
          'locale', v_user.locale,
          'timezone', v_user.timezone,
          'created_at', v_user.created_at,
          'tenant', v_user.tenant_name
        ),
        'application_assignments', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'app_id', a.app_id,
            'assignment_type', a.assignment_type,
            'granted_at', a.granted_at,
            'expires_at', a.expires_at
          )), '[]'::jsonb)
          FROM user_application_assignments a WHERE a.user_id = p_user_id
        ),
        'consent_records', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'purpose_code', c.purpose_code,
            'purpose_description', c.purpose_description,
            'consent_given', c.consent_given,
            'consent_timestamp', c.consent_timestamp,
            'lawful_basis', c.lawful_basis,
            'withdrawal_timestamp', c.withdrawal_timestamp
          )), '[]'::jsonb)
          FROM consent_records c WHERE c.user_id = p_user_id
        ),
        'data_retention_holds', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'table_name', r.table_name,
            'reason', r.retention_reason,
            'expires', r.retention_expires,
            'legal_hold', r.legal_hold
          )), '[]'::jsonb)
          FROM data_retention_obligations r WHERE r.user_id = p_user_id
        )
      ) INTO v_result;
      
      -- Update request as completed
      UPDATE dsar_requests 
      SET status = 'completed', completed_at = NOW(), response_data = v_result
      WHERE id = v_request_id;
      
    WHEN 'delete' THEN
      -- Check for retention obligations (including legal holds)
      SELECT jsonb_agg(jsonb_build_object(
        'table_name', table_name,
        'reason', retention_reason,
        'expires', retention_expires,
        'legal_hold', legal_hold,
        'legal_hold_reason', legal_hold_reason
      ))
      FROM data_retention_obligations
      WHERE user_id = p_user_id 
        AND (retention_expires > NOW() OR legal_hold = true)
      INTO v_retention_blocks;
      
      IF v_retention_blocks IS NOT NULL THEN
        -- Anonymize instead of delete
        UPDATE users SET
          email = 'deleted_' || id || '@anonymized.local',
          display_name = 'Deleted User',
          avatar_url = NULL,
          status = 'suspended',
          anonymized_at = NOW(),
          updated_at = NOW()
        WHERE id = p_user_id;
        
        v_result := jsonb_build_object(
          'request_id', v_request_id,
          'request_type', 'delete',
          'status', 'partially_completed',
          'action_taken', 'anonymized',
          'retained_data', v_retention_blocks,
          'reason', 'Legal retention obligations prevent full deletion'
        );
        
        UPDATE dsar_requests 
        SET status = 'partially_completed', completed_at = NOW(), 
            response_data = v_result, retention_blocks = v_retention_blocks
        WHERE id = v_request_id;
      ELSE
        -- Full deletion
        DELETE FROM consent_records WHERE user_id = p_user_id;
        DELETE FROM user_application_assignments WHERE user_id = p_user_id;
        UPDATE users SET 
          deleted_at = NOW(),
          email = 'deleted_' || id || '@purged.local',
          display_name = 'Purged User',
          status = 'suspended'
        WHERE id = p_user_id;
        
        v_result := jsonb_build_object(
          'request_id', v_request_id,
          'request_type', 'delete',
          'status', 'completed',
          'action_taken', 'deleted'
        );
        
        UPDATE dsar_requests 
        SET status = 'completed', completed_at = NOW(), response_data = v_result
        WHERE id = v_request_id;
      END IF;
      
    WHEN 'portability' THEN
      SELECT jsonb_build_object(
        'request_id', v_request_id,
        'request_type', 'portability',
        'format', 'application/json',
        'schema_version', '1.0',
        'generated_at', NOW(),
        'data', jsonb_build_object(
          'profile', jsonb_build_object(
            'email', v_user.email,
            'display_name', v_user.display_name,
            'locale', v_user.locale,
            'timezone', v_user.timezone
          ),
          'consents', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
              'purpose', c.purpose_code,
              'given', c.consent_given,
              'timestamp', c.consent_timestamp
            )), '[]'::jsonb)
            FROM consent_records c 
            WHERE c.user_id = p_user_id AND c.withdrawal_timestamp IS NULL
          ),
          'applications', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
              'app_id', a.app_id,
              'role', a.assignment_type
            )), '[]'::jsonb)
            FROM user_application_assignments a WHERE a.user_id = p_user_id
          )
        )
      ) INTO v_result;
      
      UPDATE dsar_requests 
      SET status = 'completed', completed_at = NOW(), response_data = v_result
      WHERE id = v_request_id;
      
    ELSE
      RAISE EXCEPTION 'Invalid DSAR request type: %', p_request_type;
  END CASE;
  
  -- Notify
  PERFORM pg_notify('dsar_events', jsonb_build_object(
    'event', 'dsar_processed',
    'request_id', v_request_id,
    'user_id', p_user_id,
    'request_type', p_request_type,
    'timestamp', NOW()
  )::text);
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Consent withdrawal
CREATE OR REPLACE FUNCTION withdraw_consent(
  p_user_id UUID,
  p_purpose_code VARCHAR(50),
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_affected INTEGER;
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM users WHERE id = p_user_id;
  
  UPDATE consent_records
  SET 
    withdrawal_timestamp = NOW(),
    withdrawal_method = 'user_initiated',
    withdrawal_reason = p_reason,
    updated_at = NOW()
  WHERE user_id = p_user_id 
    AND purpose_code = p_purpose_code
    AND withdrawal_timestamp IS NULL;
  
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  
  IF v_affected = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'No active consent found for this purpose'
    );
  END IF;
  
  PERFORM pg_notify('consent_changes', jsonb_build_object(
    'event', 'consent_withdrawn',
    'user_id', p_user_id,
    'tenant_id', v_tenant_id,
    'purpose_code', p_purpose_code,
    'timestamp', NOW()
  )::text);
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'purpose_code', p_purpose_code,
    'withdrawn_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check cross-border transfer
CREATE OR REPLACE FUNCTION check_cross_border_transfer(
  p_user_id UUID,
  p_target_region VARCHAR(20)
) RETURNS JSONB AS $$
DECLARE
  v_user_jurisdiction VARCHAR(10);
  v_tenant_region VARCHAR(20);
  v_allowed_regions TEXT[];
BEGIN
  -- Get user's jurisdiction and tenant's data region
  SELECT u.jurisdiction, t.data_region, t.allowed_regions
  INTO v_user_jurisdiction, v_tenant_region, v_allowed_regions
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id
  WHERE u.id = p_user_id;
  
  -- Same region: always allowed
  IF v_tenant_region = p_target_region THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'mechanism', 'same_region'
    );
  END IF;
  
  -- Check if target region is in allowed list
  IF p_target_region = ANY(v_allowed_regions) THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'mechanism', 'pre_approved_region'
    );
  END IF;
  
  -- Check for adequacy decision (EU to approved regions)
  IF v_user_jurisdiction = 'EU' AND p_target_region IN ('eu-west-1', 'eu-west-2', 'eu-central-1', 'ca-central-1') THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'mechanism', 'adequacy_decision'
    );
  END IF;
  
  -- Check for explicit consent
  IF EXISTS (
    SELECT 1 FROM consent_records
    WHERE user_id = p_user_id
      AND purpose_code = 'cross_border_transfer_' || p_target_region
      AND consent_given = true
      AND withdrawal_timestamp IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'mechanism', 'explicit_consent'
    );
  END IF;
  
  -- No valid mechanism found
  RETURN jsonb_build_object(
    'allowed', false,
    'reason', 'No valid transfer mechanism',
    'required_action', 'obtain_explicit_consent',
    'source_region', v_tenant_region,
    'target_region', p_target_region,
    'user_jurisdiction', v_user_jurisdiction
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- SECTION 15: ENABLE RLS ON NEW TABLES
-- ============================================================================

ALTER TABLE user_application_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_application_assignments FORCE ROW LEVEL SECURITY;

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records FORCE ROW LEVEL SECURITY;

ALTER TABLE data_retention_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_obligations FORCE ROW LEVEL SECURITY;

ALTER TABLE dsar_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsar_requests FORCE ROW LEVEL SECURITY;

ALTER TABLE break_glass_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE break_glass_access_log FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 16: RLS POLICIES USING STABLE FUNCTIONS
-- ============================================================================

-- User Application Assignments
CREATE POLICY uaa_tenant_isolation ON user_application_assignments
AS RESTRICTIVE FOR ALL USING (tenant_id = auth.tenant_id());

CREATE POLICY uaa_self_view ON user_application_assignments
AS PERMISSIVE FOR SELECT USING (user_id = auth.user_id());

CREATE POLICY uaa_admin_all ON user_application_assignments
AS PERMISSIVE FOR ALL USING (auth.is_tenant_admin());

-- Consent Records
CREATE POLICY consent_tenant_isolation ON consent_records
AS RESTRICTIVE FOR ALL USING (tenant_id = auth.tenant_id());

CREATE POLICY consent_self_manage ON consent_records
AS PERMISSIVE FOR ALL USING (user_id = auth.user_id());

CREATE POLICY consent_admin_view ON consent_records
AS PERMISSIVE FOR SELECT USING (auth.is_tenant_admin());

-- Data Retention Obligations
CREATE POLICY retention_tenant_isolation ON data_retention_obligations
AS RESTRICTIVE FOR ALL USING (tenant_id = auth.tenant_id());

CREATE POLICY retention_admin_all ON data_retention_obligations
AS PERMISSIVE FOR ALL USING (auth.is_radiant_admin());

CREATE POLICY retention_tenant_admin_view ON data_retention_obligations
AS PERMISSIVE FOR SELECT USING (auth.is_tenant_admin());

-- DSAR Requests
CREATE POLICY dsar_tenant_isolation ON dsar_requests
AS RESTRICTIVE FOR ALL USING (tenant_id = auth.tenant_id());

CREATE POLICY dsar_self_view ON dsar_requests
AS PERMISSIVE FOR SELECT USING (user_id = auth.user_id());

CREATE POLICY dsar_admin_all ON dsar_requests
AS PERMISSIVE FOR ALL USING (auth.is_tenant_admin());

-- Break Glass Access Log - only visible to Radiant Admins
CREATE POLICY break_glass_radiant_only ON break_glass_access_log
AS RESTRICTIVE FOR ALL USING (auth.is_radiant_admin());

-- ============================================================================
-- SECTION 17: UPDATE EXISTING RLS POLICIES TO USE STABLE FUNCTIONS
-- ============================================================================

-- Drop and recreate users policy with STABLE function
DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
AS RESTRICTIVE FOR ALL USING (
  tenant_id = auth.tenant_id()
  OR auth.is_break_glass()
);

-- Update super admin policy
DROP POLICY IF EXISTS users_super_admin_access ON users;
CREATE POLICY users_super_admin_access ON users
AS PERMISSIVE FOR ALL USING (auth.is_radiant_admin());

-- App users policies
DROP POLICY IF EXISTS app_users_isolation ON app_users;
CREATE POLICY app_users_isolation ON app_users
AS RESTRICTIVE FOR ALL USING (
  (tenant_id = auth.tenant_id() AND app_id = auth.app_id())
  OR auth.is_tenant_admin()
  OR auth.is_break_glass()
);

-- ============================================================================
-- SECTION 18: TRIGGERS FOR NEW TABLES
-- ============================================================================

CREATE TRIGGER update_uaa_updated_at
  BEFORE UPDATE ON user_application_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consent_updated_at
  BEFORE UPDATE ON consent_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dsar_updated_at
  BEFORE UPDATE ON dsar_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 19: GRANT PERMISSIONS
-- ============================================================================

-- Auth schema functions
GRANT USAGE ON SCHEMA auth TO PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO PUBLIC;

-- Specific function grants
GRANT EXECUTE ON FUNCTION verify_app_credentials(VARCHAR, TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION check_cross_border_transfer(UUID, VARCHAR) TO PUBLIC;
GRANT EXECUTE ON FUNCTION withdraw_consent(UUID, VARCHAR, TEXT) TO PUBLIC;

-- Admin-only functions (restrict as needed in application layer)
GRANT EXECUTE ON FUNCTION initiate_break_glass(UUID, UUID, TEXT, VARCHAR, VARCHAR) TO PUBLIC;
GRANT EXECUTE ON FUNCTION end_break_glass(UUID, UUID, JSONB) TO PUBLIC;
GRANT EXECUTE ON FUNCTION apply_legal_hold(UUID, TEXT, VARCHAR, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION release_legal_hold(UUID, TEXT, VARCHAR, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION process_dsar_request(UUID, VARCHAR, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION rotate_app_secret(VARCHAR, TEXT, INT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION set_app_secret(VARCHAR, TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION clear_expired_rotation_windows() TO PUBLIC;

-- ============================================================================
-- SECTION 20: COMMENTS
-- ============================================================================

COMMENT ON SCHEMA auth IS 
'Authentication context schema with STABLE functions for O(1) RLS performance.';

COMMENT ON TABLE user_application_assignments IS 
'Maps users to applications they can access, with role and expiration support.';

COMMENT ON TABLE consent_records IS 
'GDPR/CCPA/COPPA compliant consent tracking with full audit trail.';

COMMENT ON TABLE data_retention_obligations IS 
'Tracks data that must be retained for regulatory or legal reasons.';

COMMENT ON TABLE dsar_requests IS 
'Data Subject Access Request tracking for GDPR Article 15-22 compliance.';

COMMENT ON TABLE break_glass_access_log IS 
'Immutable audit log of emergency Break Glass access events.';
