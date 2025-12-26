-- RADIANT v4.17.0 - Migration 005: Admin & Approval Workflow
-- Audit logs and approval workflow enhancements

-- ============================================================================
-- AUDIT LOGS TABLE
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    actor_id VARCHAR(128) NOT NULL,
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('user', 'admin', 'system')),
    action VARCHAR(200) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Partition audit logs by month for better performance
-- Note: In production, consider using partitioning for large-scale audit logs

-- ============================================================================
-- APPROVAL WORKFLOW ENHANCEMENTS
-- ============================================================================

-- Add indexes for approval workflow queries
CREATE INDEX idx_approval_requests_action_type ON approval_requests(action_type);
CREATE INDEX idx_approval_requests_resource_type_id ON approval_requests(resource_type, resource_id);

-- ============================================================================
-- ADMIN SESSIONS TABLE
-- ============================================================================

CREATE TABLE admin_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES administrators(id) ON DELETE CASCADE,
    session_token_hash VARCHAR(64) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX idx_admin_sessions_token_hash ON admin_sessions(session_token_hash);
CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- ============================================================================
-- ADMIN PERMISSIONS TABLE
-- ============================================================================

CREATE TABLE admin_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES administrators(id) ON DELETE CASCADE,
    permission VARCHAR(100) NOT NULL,
    granted_by UUID REFERENCES administrators(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE (admin_id, permission)
);

CREATE INDEX idx_admin_permissions_admin_id ON admin_permissions(admin_id);
CREATE INDEX idx_admin_permissions_permission ON admin_permissions(permission);

-- ============================================================================
-- SENSITIVE ACTIONS LOG
-- ============================================================================

CREATE TABLE sensitive_action_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES administrators(id),
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(100) NOT NULL,
    target_id VARCHAR(255),
    before_state JSONB,
    after_state JSONB,
    approval_request_id UUID REFERENCES approval_requests(id),
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sensitive_action_logs_admin_id ON sensitive_action_logs(admin_id);
CREATE INDEX idx_sensitive_action_logs_action_type ON sensitive_action_logs(action_type);
CREATE INDEX idx_sensitive_action_logs_created_at ON sensitive_action_logs(created_at);

-- ============================================================================
-- HELPER FUNCTION: Check if action requires approval
-- ============================================================================

CREATE OR REPLACE FUNCTION requires_approval(p_action_type VARCHAR, p_resource_type VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_requires BOOLEAN;
BEGIN
    -- Define which actions require two-person approval
    v_requires := p_action_type IN (
        'delete_tenant',
        'suspend_tenant',
        'create_super_admin',
        'modify_billing',
        'export_data',
        'access_phi',
        'modify_encryption_keys',
        'bulk_user_operation'
    );
    
    RETURN v_requires;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
