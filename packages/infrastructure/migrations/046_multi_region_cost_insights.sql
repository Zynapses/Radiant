-- ============================================================================
-- RADIANT v4.18.0 - Multi-Region, Cost Insights, and VPN Whitelist Migration
-- Phase 32-33: Additional tables for PROMPT-33 features
-- ============================================================================

-- IP Whitelist (for VPN false positive prevention)
CREATE TABLE IF NOT EXISTS ip_whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    ip_range VARCHAR(50), -- CIDR notation: "10.0.0.0/8"
    description VARCHAR(200),
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ip_whitelist_check CHECK (ip_address IS NOT NULL OR ip_range IS NOT NULL)
);

-- Tenant Security Configuration
CREATE TABLE IF NOT EXISTS tenant_security_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    vpn_ip_ranges JSONB DEFAULT '[]', -- Array of CIDR ranges
    mfa_required BOOLEAN DEFAULT FALSE,
    session_timeout_minutes INTEGER DEFAULT 60,
    max_failed_logins INTEGER DEFAULT 5,
    lockout_duration_minutes INTEGER DEFAULT 30,
    ip_restriction_enabled BOOLEAN DEFAULT FALSE,
    geo_restriction_enabled BOOLEAN DEFAULT FALSE,
    allowed_countries JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cost Insights (for Neural Engine recommendations)
CREATE TABLE IF NOT EXISTS cost_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    insight_type VARCHAR(30) NOT NULL CHECK (insight_type IN ('model_switch', 'usage_pattern', 'budget_alert', 'efficiency', 'anomaly')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    recommendation TEXT,
    estimated_savings DECIMAL(12, 6) DEFAULT 0,
    confidence DECIMAL(5, 4) DEFAULT 0, -- 0.0 to 1.0
    affected_users JSONB DEFAULT '[]',
    affected_models JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'applied')),
    applied_at TIMESTAMPTZ,
    applied_by UUID REFERENCES users(id),
    dismissed_at TIMESTAMPTZ,
    dismissed_by UUID REFERENCES users(id),
    dismiss_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- Multi-Region Configurations
CREATE TABLE IF NOT EXISTS multi_region_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    region VARCHAR(30) NOT NULL,
    display_name VARCHAR(100),
    is_primary BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT TRUE,
    endpoint VARCHAR(255),
    stack_prefix VARCHAR(100),
    health_status VARCHAR(20) DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'unhealthy', 'unknown', 'deploying')),
    last_deployed_version VARCHAR(20),
    last_deployed_at TIMESTAMPTZ,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, region)
);

-- Multi-Region Deployments
CREATE TABLE IF NOT EXISTS multi_region_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    package_version VARCHAR(20) NOT NULL,
    strategy VARCHAR(20) NOT NULL CHECK (strategy IN ('sequential', 'parallel', 'canary', 'blue_green')),
    target_regions JSONB NOT NULL DEFAULT '[]',
    region_statuses JSONB NOT NULL DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    started_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deployment Locks (for concurrent deployment prevention)
CREATE TABLE IF NOT EXISTS deployment_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    app_id VARCHAR(100) NOT NULL,
    environment VARCHAR(30) NOT NULL,
    owner VARCHAR(100) NOT NULL,
    owner_id VARCHAR(100) NOT NULL,
    hostname VARCHAR(255),
    pid INTEGER,
    acquired_at TIMESTAMPTZ DEFAULT NOW(),
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '120 seconds',
    metadata JSONB DEFAULT '{}',
    UNIQUE(tenant_id, app_id, environment)
);

-- Snapshots
CREATE TABLE IF NOT EXISTS deployment_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    app_id VARCHAR(100) NOT NULL,
    environment VARCHAR(30) NOT NULL,
    version VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'creating' CHECK (status IN ('creating', 'available', 'restoring', 'deleting', 'failed', 'expired')),
    resources JSONB DEFAULT '{}', -- Aurora, DynamoDB, S3, Lambda snapshots
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
    metadata JSONB DEFAULT '{}'
);

-- Audit Logs (for compliance)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    performed_by UUID REFERENCES users(id),
    performed_by_email VARCHAR(255),
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Settings (for model lock, SLA exclusions)
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_tenant ON ip_whitelist(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_ip ON ip_whitelist(ip_address);
CREATE INDEX IF NOT EXISTS idx_cost_insights_tenant ON cost_insights(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cost_insights_status ON cost_insights(status);
CREATE INDEX IF NOT EXISTS idx_cost_insights_type ON cost_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_multi_region_tenant ON multi_region_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_multi_region_region ON multi_region_configs(region);
CREATE INDEX IF NOT EXISTS idx_mr_deployments_tenant ON multi_region_deployments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deployment_locks_tenant ON deployment_locks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deployment_locks_app ON deployment_locks(app_id, environment);
CREATE INDEX IF NOT EXISTS idx_deployment_locks_heartbeat ON deployment_locks(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_snapshots_tenant ON deployment_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_app ON deployment_snapshots(app_id, environment);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_settings_tenant ON user_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- Row Level Security
ALTER TABLE ip_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_security_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE multi_region_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE multi_region_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ip_whitelist_isolation ON ip_whitelist
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_security_config_isolation ON tenant_security_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY cost_insights_isolation ON cost_insights
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY multi_region_configs_isolation ON multi_region_configs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY multi_region_deployments_isolation ON multi_region_deployments
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY deployment_locks_isolation ON deployment_locks
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY snapshots_isolation ON deployment_snapshots
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY audit_logs_isolation ON audit_logs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY user_settings_isolation ON user_settings
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Function to cleanup stale locks (120s without heartbeat)
CREATE OR REPLACE FUNCTION cleanup_stale_deployment_locks()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM deployment_locks
    WHERE last_heartbeat < NOW() - INTERVAL '120 seconds';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired snapshots
CREATE OR REPLACE FUNCTION cleanup_expired_snapshots()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE deployment_snapshots
    SET status = 'expired'
    WHERE status = 'available' AND expires_at < NOW();
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;
