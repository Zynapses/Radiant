-- ============================================================================
-- MIGRATION: 126_tenant_management_system.sql
-- RADIANT v4.18.55 - Tenant Management System (TMS)
-- ============================================================================
-- Implements comprehensive multi-tenant management with:
-- - Tenant lifecycle (create, update, soft delete, restore, hard delete)
-- - No orphan users rule (database-enforced)
-- - Phantom tenant creation for individual signups
-- - Multi-tenant user support with role-based membership
-- - Configurable retention with restore capability
-- - Full audit trail
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: EXTEND TENANTS TABLE
-- ============================================================================

-- Add new columns to existing tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'organization' 
    CHECK (type IN ('organization', 'individual'));
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 1 CHECK (tier BETWEEN 1 AND 5);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS primary_region VARCHAR(20) DEFAULT 'us-east-1';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS compliance_mode JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS retention_days INTEGER DEFAULT 30 CHECK (retention_days BETWEEN 7 AND 730);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deletion_requested_by UUID;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kms_key_arn VARCHAR(500);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Update status check constraint to include new statuses
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check 
    CHECK (status IN ('active', 'suspended', 'pending', 'pending_deletion', 'deleted'));

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_tenants_type ON tenants(type);
CREATE INDEX IF NOT EXISTS idx_tenants_tier ON tenants(tier);
CREATE INDEX IF NOT EXISTS idx_tenants_deletion ON tenants(deletion_scheduled_at) 
    WHERE status = 'pending_deletion';
CREATE INDEX IF NOT EXISTS idx_tenants_stripe ON tenants(stripe_customer_id) 
    WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN tenants.type IS 'organization = company, individual = phantom tenant for single users';
COMMENT ON COLUMN tenants.compliance_mode IS 'Array of compliance frameworks: hipaa, soc2, gdpr';
COMMENT ON COLUMN tenants.retention_days IS 'Days to retain data after soft delete before hard delete';

-- ============================================================================
-- SECTION 2: TENANT USER MEMBERSHIPS (Multi-Tenant Users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_user_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' 
        CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    status VARCHAR(20) DEFAULT 'active' 
        CHECK (status IN ('active', 'suspended', 'invited')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    invited_by UUID REFERENCES users(id),
    invitation_token VARCHAR(255),
    invitation_expires_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON tenant_user_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON tenant_user_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_role ON tenant_user_memberships(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_memberships_invitation ON tenant_user_memberships(invitation_token) 
    WHERE invitation_token IS NOT NULL;

COMMENT ON TABLE tenant_user_memberships IS 'Junction table for many-to-many user-tenant relationships';

-- ============================================================================
-- SECTION 3: RISK ACCEPTANCES (Compliance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tms_risk_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    control_id VARCHAR(50) NOT NULL,
    control_framework VARCHAR(20) CHECK (control_framework IN ('hipaa', 'soc2', 'gdpr', 'nist')),
    risk_description TEXT NOT NULL,
    mitigating_controls TEXT,
    business_justification TEXT NOT NULL,
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    accepted_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'renewed')),
    renewal_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risks_tenant ON tms_risk_acceptances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_risks_status ON tms_risk_acceptances(status);
CREATE INDEX IF NOT EXISTS idx_risks_expires ON tms_risk_acceptances(expires_at) WHERE status = 'approved';

-- ============================================================================
-- SECTION 4: TENANT AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS tms_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    admin_id UUID REFERENCES administrators(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    trace_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tms_audit_tenant ON tms_audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tms_audit_user ON tms_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tms_audit_action ON tms_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tms_audit_trace ON tms_audit_log(trace_id) WHERE trace_id IS NOT NULL;

COMMENT ON TABLE tms_audit_log IS 'Immutable audit log for all TMS operations';

-- ============================================================================
-- SECTION 5: GLOBAL RETENTION SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tms_retention_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES administrators(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO tms_retention_settings (setting_key, setting_value, description) VALUES
    ('default_retention_days', '30', 'Default retention period for soft-deleted tenants'),
    ('min_retention_days', '7', 'Minimum allowed retention period'),
    ('max_retention_days', '730', 'Maximum allowed retention period'),
    ('hipaa_min_retention_days', '90', 'Minimum retention for HIPAA-compliant tenants'),
    ('hard_delete_batch_size', '10', 'Number of tenants to hard delete per scheduled run'),
    ('deletion_notification_days', '[7, 3, 1]', 'Days before deletion to send notifications')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- SECTION 6: VERIFICATION CODES (2FA for sensitive operations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tms_verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES administrators(id) ON DELETE CASCADE,
    operation VARCHAR(50) NOT NULL CHECK (operation IN ('restore_tenant', 'hard_delete', 'transfer_ownership', 'compliance_override')),
    resource_id UUID NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_user_or_admin CHECK (user_id IS NOT NULL OR admin_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_user ON tms_verification_codes(user_id, operation) 
    WHERE verified_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_verification_codes_admin ON tms_verification_codes(admin_id, operation) 
    WHERE verified_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON tms_verification_codes(expires_at) 
    WHERE verified_at IS NULL;

COMMENT ON TABLE tms_verification_codes IS 'Time-limited verification codes for sensitive TMS operations';

-- ============================================================================
-- SECTION 7: DELETION NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tms_deletion_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('7_day', '3_day', '1_day', 'deleted')),
    sent_to JSONB NOT NULL, -- Array of email addresses
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'bounced')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deletion_notifications_tenant ON tms_deletion_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deletion_notifications_type ON tms_deletion_notifications(notification_type, sent_at);

-- ============================================================================
-- SECTION 8: ORPHAN USER PREVENTION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION tms_prevent_orphan_users()
RETURNS TRIGGER AS $$
DECLARE
    remaining_memberships INTEGER;
    v_user_record RECORD;
BEGIN
    -- Get user info before we check memberships
    SELECT id, email, display_name INTO v_user_record
    FROM users WHERE id = OLD.user_id;
    
    -- Count remaining active memberships for this user (excluding the one being deleted)
    SELECT COUNT(*) INTO remaining_memberships 
    FROM tenant_user_memberships 
    WHERE user_id = OLD.user_id 
    AND id != OLD.id
    AND status != 'invited';  -- Don't count pending invitations
    
    IF remaining_memberships = 0 THEN
        -- This is the last active membership
        -- Mark user as deleted (soft delete, preserve for audit)
        UPDATE users SET 
            status = 'deleted', 
            updated_at = NOW() 
        WHERE id = OLD.user_id;
        
        -- Log the automatic deletion
        INSERT INTO tms_audit_log (tenant_id, user_id, action, resource_type, resource_id, old_value, new_value)
        VALUES (
            OLD.tenant_id, 
            OLD.user_id, 
            'user_auto_deleted_orphan', 
            'user', 
            OLD.user_id::text, 
            jsonb_build_object(
                'email', v_user_record.email,
                'display_name', v_user_record.display_name,
                'last_tenant_id', OLD.tenant_id
            ),
            jsonb_build_object('reason', 'last_membership_removed', 'previous_role', OLD.role)
        );
        
        RAISE NOTICE 'Auto-deleted orphan user: % (%)', OLD.user_id, v_user_record.email;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tms_check_orphan_on_membership_delete ON tenant_user_memberships;
CREATE TRIGGER tms_check_orphan_on_membership_delete
AFTER DELETE ON tenant_user_memberships
FOR EACH ROW EXECUTE FUNCTION tms_prevent_orphan_users();

-- ============================================================================
-- SECTION 9: TIMESTAMP UPDATE TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS tms_memberships_updated_at ON tenant_user_memberships;
CREATE TRIGGER tms_memberships_updated_at
    BEFORE UPDATE ON tenant_user_memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tms_risks_updated_at ON tms_risk_acceptances;
CREATE TRIGGER tms_risks_updated_at
    BEFORE UPDATE ON tms_risk_acceptances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tms_retention_updated_at ON tms_retention_settings;
CREATE TRIGGER tms_retention_updated_at
    BEFORE UPDATE ON tms_retention_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 10: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE tenant_user_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms_risk_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE tms_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for memberships
DROP POLICY IF EXISTS tms_tenant_isolation_memberships ON tenant_user_memberships;
CREATE POLICY tms_tenant_isolation_memberships ON tenant_user_memberships
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

DROP POLICY IF EXISTS tms_super_admin_memberships ON tenant_user_memberships;
CREATE POLICY tms_super_admin_memberships ON tenant_user_memberships
    FOR ALL
    USING (current_setting('app.is_super_admin', true)::boolean = true);

-- RLS Policies for risk acceptances
DROP POLICY IF EXISTS tms_tenant_isolation_risks ON tms_risk_acceptances;
CREATE POLICY tms_tenant_isolation_risks ON tms_risk_acceptances
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

DROP POLICY IF EXISTS tms_super_admin_risks ON tms_risk_acceptances;
CREATE POLICY tms_super_admin_risks ON tms_risk_acceptances
    FOR ALL
    USING (current_setting('app.is_super_admin', true)::boolean = true);

-- RLS Policies for audit log (read-only for tenants, full for super admin)
DROP POLICY IF EXISTS tms_tenant_isolation_audit ON tms_audit_log;
CREATE POLICY tms_tenant_isolation_audit ON tms_audit_log
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

DROP POLICY IF EXISTS tms_super_admin_audit ON tms_audit_log;
CREATE POLICY tms_super_admin_audit ON tms_audit_log
    FOR ALL
    USING (current_setting('app.is_super_admin', true)::boolean = true);

-- ============================================================================
-- SECTION 11: SCHEDULED DELETION PROCESSING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION tms_process_scheduled_deletions()
RETURNS TABLE (
    deleted_tenant_id UUID,
    deleted_tenant_name VARCHAR,
    deleted_at TIMESTAMPTZ,
    users_deleted INTEGER,
    users_retained INTEGER
) AS $$
DECLARE
    tenant_record RECORD;
    v_users_deleted INTEGER;
    v_users_retained INTEGER;
    v_batch_size INTEGER;
BEGIN
    -- Get batch size from settings
    SELECT (setting_value::TEXT)::INTEGER INTO v_batch_size
    FROM tms_retention_settings 
    WHERE setting_key = 'hard_delete_batch_size';
    
    v_batch_size := COALESCE(v_batch_size, 10);
    
    FOR tenant_record IN 
        SELECT t.id, t.name, t.kms_key_arn
        FROM tenants t
        WHERE t.status = 'pending_deletion' 
        AND t.deletion_scheduled_at < NOW()
        ORDER BY t.deletion_scheduled_at ASC
        LIMIT v_batch_size
    LOOP
        -- Count users that will be deleted (only in this tenant) vs retained (in multiple tenants)
        SELECT 
            COUNT(*) FILTER (WHERE membership_count = 1),
            COUNT(*) FILTER (WHERE membership_count > 1)
        INTO v_users_deleted, v_users_retained
        FROM (
            SELECT 
                tum.user_id,
                (SELECT COUNT(*) FROM tenant_user_memberships m2 
                 WHERE m2.user_id = tum.user_id AND m2.status = 'active') as membership_count
            FROM tenant_user_memberships tum
            WHERE tum.tenant_id = tenant_record.id
        ) subq;
        
        -- Log before deletion (preserve audit trail)
        INSERT INTO tms_audit_log (tenant_id, action, resource_type, resource_id, new_value)
        VALUES (
            tenant_record.id, 
            'tenant_hard_deleted', 
            'tenant', 
            tenant_record.id::text,
            jsonb_build_object(
                'name', tenant_record.name,
                'users_deleted', v_users_deleted,
                'users_retained', v_users_retained,
                'kms_key_arn', tenant_record.kms_key_arn
            )
        );
        
        -- Delete memberships first (triggers orphan check)
        DELETE FROM tenant_user_memberships WHERE tenant_id = tenant_record.id;
        
        -- Update tenant status to deleted
        UPDATE tenants 
        SET status = 'deleted', updated_at = NOW()
        WHERE id = tenant_record.id;
        
        -- Return result row
        deleted_tenant_id := tenant_record.id;
        deleted_tenant_name := tenant_record.name;
        deleted_at := NOW();
        users_deleted := COALESCE(v_users_deleted, 0);
        users_retained := COALESCE(v_users_retained, 0);
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION tms_process_scheduled_deletions IS 'Processes tenants past their retention period for hard deletion';

-- ============================================================================
-- SECTION 12: PHANTOM TENANT CREATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION tms_create_phantom_tenant(
    p_user_email VARCHAR(255),
    p_user_display_name VARCHAR(255),
    p_cognito_user_id VARCHAR(128)
)
RETURNS TABLE (
    tenant_id UUID,
    user_id UUID,
    tenant_name VARCHAR
) AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_tenant_name VARCHAR(255);
    v_existing_user RECORD;
BEGIN
    -- Check if user already exists
    SELECT id, tenant_id INTO v_existing_user
    FROM users 
    WHERE email = p_user_email OR cognito_user_id = p_cognito_user_id
    LIMIT 1;
    
    IF v_existing_user.id IS NOT NULL THEN
        -- User exists, return their primary tenant
        RETURN QUERY 
        SELECT 
            v_existing_user.tenant_id,
            v_existing_user.id,
            t.name::VARCHAR
        FROM tenants t WHERE t.id = v_existing_user.tenant_id;
        RETURN;
    END IF;
    
    -- Generate tenant name from user's display name or email
    v_tenant_name := COALESCE(p_user_display_name, split_part(p_user_email, '@', 1)) || '''s Workspace';
    
    -- Create phantom tenant (individual type)
    INSERT INTO tenants (name, display_name, type, status, tier, retention_days)
    VALUES (
        'phantom_' || gen_random_uuid()::text, -- Unique internal name
        v_tenant_name,
        'individual', 
        'active', 
        1,
        30
    )
    RETURNING id INTO v_tenant_id;
    
    -- Create user
    INSERT INTO users (tenant_id, cognito_user_id, email, display_name, role, status)
    VALUES (v_tenant_id, p_cognito_user_id, p_user_email, p_user_display_name, 'admin', 'active')
    RETURNING id INTO v_user_id;
    
    -- Create membership with owner role
    INSERT INTO tenant_user_memberships (tenant_id, user_id, role, status, joined_at)
    VALUES (v_tenant_id, v_user_id, 'owner', 'active', NOW());
    
    -- Log creation
    INSERT INTO tms_audit_log (tenant_id, user_id, action, resource_type, resource_id, new_value)
    VALUES (
        v_tenant_id, 
        v_user_id, 
        'phantom_tenant_created', 
        'tenant', 
        v_tenant_id::text,
        jsonb_build_object('name', v_tenant_name, 'email', p_user_email, 'type', 'individual')
    );
    
    RETURN QUERY SELECT v_tenant_id, v_user_id, v_tenant_name::VARCHAR;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION tms_create_phantom_tenant IS 'Creates individual tenant for new user signups (phantom tenant pattern)';

-- ============================================================================
-- SECTION 13: VERIFICATION CODE FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION tms_create_verification_code(
    p_user_id UUID,
    p_admin_id UUID,
    p_operation VARCHAR(50),
    p_resource_id UUID,
    p_expires_minutes INTEGER DEFAULT 15
)
RETURNS VARCHAR(6) AS $$
DECLARE
    v_code VARCHAR(6);
    v_code_hash VARCHAR(64);
BEGIN
    -- Generate 6-digit code
    v_code := LPAD((floor(random() * 1000000)::integer)::text, 6, '0');
    
    -- Hash the code for storage
    v_code_hash := encode(digest(v_code, 'sha256'), 'hex');
    
    -- Delete any existing unused codes for this operation
    DELETE FROM tms_verification_codes
    WHERE (user_id = p_user_id OR admin_id = p_admin_id)
    AND operation = p_operation
    AND resource_id = p_resource_id
    AND verified_at IS NULL;
    
    -- Insert new code
    INSERT INTO tms_verification_codes (
        user_id, admin_id, operation, resource_id, code_hash, expires_at
    ) VALUES (
        p_user_id, p_admin_id, p_operation, p_resource_id, v_code_hash,
        NOW() + (p_expires_minutes || ' minutes')::interval
    );
    
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION tms_verify_code(
    p_user_id UUID,
    p_admin_id UUID,
    p_operation VARCHAR(50),
    p_resource_id UUID,
    p_code VARCHAR(6)
)
RETURNS JSONB AS $$
DECLARE
    v_record RECORD;
    v_code_hash VARCHAR(64);
BEGIN
    v_code_hash := encode(digest(p_code, 'sha256'), 'hex');
    
    -- Find matching code
    SELECT * INTO v_record
    FROM tms_verification_codes
    WHERE (user_id = p_user_id OR admin_id = p_admin_id)
    AND operation = p_operation
    AND resource_id = p_resource_id
    AND verified_at IS NULL
    AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
    
    IF v_record IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'error', 'no_code_found', 'message', 'No valid verification code found');
    END IF;
    
    -- Check attempts
    IF v_record.attempts >= v_record.max_attempts THEN
        RETURN jsonb_build_object('valid', false, 'error', 'max_attempts', 'message', 'Maximum verification attempts exceeded');
    END IF;
    
    -- Increment attempts
    UPDATE tms_verification_codes SET attempts = attempts + 1 WHERE id = v_record.id;
    
    -- Check code
    IF v_record.code_hash != v_code_hash THEN
        RETURN jsonb_build_object(
            'valid', false, 
            'error', 'invalid_code', 
            'message', 'Invalid verification code',
            'attempts_remaining', v_record.max_attempts - v_record.attempts - 1
        );
    END IF;
    
    -- Mark as verified
    UPDATE tms_verification_codes SET verified_at = NOW() WHERE id = v_record.id;
    
    RETURN jsonb_build_object('valid', true, 'verified_at', NOW());
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 14: HELPER VIEWS
-- ============================================================================

-- Tenant summary view
CREATE OR REPLACE VIEW v_tms_tenant_summary AS
SELECT 
    t.id as tenant_id,
    t.name,
    t.display_name,
    t.type,
    t.status,
    t.tier,
    t.primary_region,
    t.compliance_mode,
    t.retention_days,
    t.deletion_scheduled_at,
    t.stripe_customer_id,
    t.created_at,
    t.updated_at,
    COUNT(DISTINCT tum.user_id) FILTER (WHERE tum.status = 'active') as active_users,
    COUNT(DISTINCT tum.user_id) FILTER (WHERE tum.status = 'suspended') as suspended_users,
    COUNT(DISTINCT tum.user_id) FILTER (WHERE tum.status = 'invited') as invited_users,
    COUNT(DISTINCT tum.user_id) FILTER (WHERE tum.role = 'owner') as owners,
    COUNT(DISTINCT tum.user_id) FILTER (WHERE tum.role = 'admin') as admins
FROM tenants t
LEFT JOIN tenant_user_memberships tum ON t.id = tum.tenant_id
GROUP BY t.id;

-- User memberships view
CREATE OR REPLACE VIEW v_tms_user_memberships AS
SELECT 
    u.id as user_id,
    u.email,
    u.display_name,
    u.status as user_status,
    COUNT(tum.id) as tenant_count,
    jsonb_agg(jsonb_build_object(
        'tenant_id', t.id,
        'tenant_name', t.display_name,
        'role', tum.role,
        'status', tum.status,
        'joined_at', tum.joined_at
    ) ORDER BY tum.joined_at) as memberships
FROM users u
LEFT JOIN tenant_user_memberships tum ON u.id = tum.user_id
LEFT JOIN tenants t ON tum.tenant_id = t.id
GROUP BY u.id, u.email, u.display_name, u.status;

-- Pending deletions view
CREATE OR REPLACE VIEW v_tms_pending_deletions AS
SELECT 
    t.id as tenant_id,
    t.name,
    t.display_name,
    t.deletion_scheduled_at,
    t.retention_days,
    EXTRACT(DAY FROM (t.deletion_scheduled_at - NOW()))::integer as days_remaining,
    COUNT(DISTINCT tum.user_id) as affected_users,
    COUNT(DISTINCT tum.user_id) FILTER (
        WHERE (SELECT COUNT(*) FROM tenant_user_memberships m2 WHERE m2.user_id = tum.user_id AND m2.status = 'active') = 1
    ) as users_to_be_deleted,
    (
        SELECT jsonb_agg(DISTINCT dn.notification_type)
        FROM tms_deletion_notifications dn
        WHERE dn.tenant_id = t.id
    ) as notifications_sent
FROM tenants t
LEFT JOIN tenant_user_memberships tum ON t.id = tum.tenant_id
WHERE t.status = 'pending_deletion'
GROUP BY t.id, t.name, t.display_name, t.deletion_scheduled_at, t.retention_days;

-- ============================================================================
-- SECTION 15: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION tms_create_phantom_tenant(VARCHAR, VARCHAR, VARCHAR) TO PUBLIC;
GRANT EXECUTE ON FUNCTION tms_process_scheduled_deletions() TO PUBLIC;
GRANT EXECUTE ON FUNCTION tms_create_verification_code(UUID, UUID, VARCHAR, UUID, INTEGER) TO PUBLIC;
GRANT EXECUTE ON FUNCTION tms_verify_code(UUID, UUID, VARCHAR, UUID, VARCHAR) TO PUBLIC;
GRANT EXECUTE ON FUNCTION tms_prevent_orphan_users() TO PUBLIC;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================
-- SELECT * FROM tenants LIMIT 5;
-- SELECT * FROM tenant_user_memberships LIMIT 5;
-- SELECT * FROM tms_retention_settings;
-- SELECT * FROM v_tms_tenant_summary LIMIT 5;
-- SELECT * FROM v_tms_pending_deletions;
