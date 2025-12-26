-- RADIANT v4.17.0 - Migration 036: Dual-Admin Approval
-- Two-person approval for production database migrations

CREATE TABLE migration_approval_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    migration_name VARCHAR(255) NOT NULL,
    migration_version VARCHAR(50) NOT NULL,
    migration_checksum VARCHAR(64) NOT NULL,
    migration_sql TEXT NOT NULL,
    
    environment VARCHAR(20) NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
    
    requested_by UUID NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    request_reason TEXT,
    
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'rejected', 'executed', 'failed', 'cancelled'
    )),
    
    approvals_required INTEGER NOT NULL DEFAULT 2,
    approvals_received INTEGER NOT NULL DEFAULT 0,
    
    executed_at TIMESTAMPTZ,
    executed_by UUID,
    execution_time_ms INTEGER,
    execution_error TEXT,
    rollback_sql TEXT,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE migration_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES migration_approval_requests(id) ON DELETE CASCADE,
    
    admin_id UUID NOT NULL,
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('approved', 'rejected')),
    reason TEXT,
    
    reviewed_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(request_id, admin_id)
);

CREATE TABLE migration_approval_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    environment VARCHAR(20) NOT NULL,
    
    approvals_required INTEGER NOT NULL DEFAULT 2,
    self_approval_allowed BOOLEAN DEFAULT false,
    auto_approve_development BOOLEAN DEFAULT true,
    
    allowed_approvers UUID[] DEFAULT '{}',
    required_approvers UUID[],
    
    notification_channels JSONB DEFAULT '{}',
    escalation_after_hours INTEGER DEFAULT 24,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, environment)
);

CREATE INDEX idx_migration_approval_tenant ON migration_approval_requests(tenant_id);
CREATE INDEX idx_migration_approval_status ON migration_approval_requests(status);
CREATE INDEX idx_migration_approval_env ON migration_approval_requests(environment);
CREATE INDEX idx_migration_approvals_request ON migration_approvals(request_id);

ALTER TABLE migration_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_approval_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY migration_approval_requests_isolation ON migration_approval_requests
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY migration_approval_policies_isolation ON migration_approval_policies
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Trigger: Update approval count
CREATE OR REPLACE FUNCTION update_migration_approval_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.decision = 'approved' THEN
        UPDATE migration_approval_requests
        SET approvals_received = approvals_received + 1,
            status = CASE 
                WHEN approvals_received + 1 >= approvals_required THEN 'approved' 
                ELSE status 
            END,
            updated_at = NOW()
        WHERE id = NEW.request_id;
    ELSIF NEW.decision = 'rejected' THEN
        UPDATE migration_approval_requests 
        SET status = 'rejected', updated_at = NOW() 
        WHERE id = NEW.request_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER migration_approval_update
    AFTER INSERT ON migration_approvals
    FOR EACH ROW EXECUTE FUNCTION update_migration_approval_count();

CREATE TRIGGER update_migration_approval_requests_updated_at 
    BEFORE UPDATE ON migration_approval_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_migration_approval_policies_updated_at 
    BEFORE UPDATE ON migration_approval_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
