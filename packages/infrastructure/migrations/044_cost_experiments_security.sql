-- ============================================================================
-- RADIANT v4.17.0 - Cost Tracking, Experiments, and Security Migration
-- Phase 28-31: Cost management, A/B testing, compliance, security
-- ============================================================================

-- Cost Events Table
CREATE TABLE IF NOT EXISTS cost_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    model_id VARCHAR(100) NOT NULL,
    provider_id VARCHAR(100),
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    input_cost DECIMAL(12, 8) NOT NULL DEFAULT 0,
    output_cost DECIMAL(12, 8) NOT NULL DEFAULT 0,
    total_cost DECIMAL(12, 8) NOT NULL DEFAULT 0,
    request_id VARCHAR(100),
    session_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cost Daily Aggregates
CREATE TABLE IF NOT EXISTS cost_daily_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_cost DECIMAL(12, 6) NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 0,
    by_model JSONB DEFAULT '{}',
    by_provider JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, date)
);

-- Cost Alerts
CREATE TABLE IF NOT EXISTS cost_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('threshold', 'spike', 'budget')),
    threshold DECIMAL(12, 6) NOT NULL,
    current_value DECIMAL(12, 6) DEFAULT 0,
    is_triggered BOOLEAN DEFAULT FALSE,
    triggered_at TIMESTAMPTZ,
    notification_channels JSONB DEFAULT '["email"]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Experiments Table
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    hypothesis TEXT,
    variants JSONB NOT NULL DEFAULT '[]',
    target_audience JSONB DEFAULT '{"percentage": 100}',
    metrics JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Experiment Assignments
CREATE TABLE IF NOT EXISTS experiment_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    variant_id VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(experiment_id, user_id)
);

-- Experiment Metrics
CREATE TABLE IF NOT EXISTS experiment_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    variant_id VARCHAR(100) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    metric_name VARCHAR(100) NOT NULL,
    value DECIMAL(12, 6) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security Anomalies
CREATE TABLE IF NOT EXISTS security_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    anomaly_type VARCHAR(30) NOT NULL CHECK (anomaly_type IN ('geographic', 'session_hijack', 'brute_force', 'rate_limit', 'credential_stuffing')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    user_id UUID REFERENCES users(id),
    ip_address VARCHAR(45),
    details JSONB DEFAULT '{}',
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- IP Blocklist
CREATE TABLE IF NOT EXISTS ip_blocklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) NOT NULL,
    reason VARCHAR(200),
    blocked_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, ip_address)
);

-- Auth Events for security tracking
CREATE TABLE IF NOT EXISTS auth_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    email VARCHAR(255),
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('login_success', 'login_failed', 'logout', 'password_reset', 'mfa_enabled', 'mfa_disabled')),
    ip_address VARCHAR(45),
    user_agent TEXT,
    geo_location VARCHAR(100),
    session_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance Reports
CREATE TABLE IF NOT EXISTS compliance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    report_type VARCHAR(30) NOT NULL CHECK (report_type IN ('soc2', 'hipaa', 'gdpr', 'iso27001')),
    status VARCHAR(20) DEFAULT 'compliant' CHECK (status IN ('compliant', 'partial', 'non_compliant')),
    score INTEGER DEFAULT 100,
    findings JSONB DEFAULT '[]',
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days'
);

-- Compliance Findings
CREATE TABLE IF NOT EXISTS compliance_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES compliance_reports(id) ON DELETE CASCADE,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    recommendation TEXT,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Operation Timeouts Configuration
CREATE TABLE IF NOT EXISTS operation_timeouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    operation_name VARCHAR(100) NOT NULL,
    timeout_seconds INTEGER NOT NULL DEFAULT 30,
    retry_count INTEGER DEFAULT 3,
    retry_delay_ms INTEGER DEFAULT 1000,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, operation_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cost_events_tenant ON cost_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_user ON cost_events(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_created ON cost_events(created_at);
CREATE INDEX IF NOT EXISTS idx_cost_daily_tenant_date ON cost_daily_aggregates(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_experiments_tenant ON experiments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);
CREATE INDEX IF NOT EXISTS idx_exp_assignments_exp ON experiment_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_exp_assignments_user ON experiment_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_exp_metrics_exp ON experiment_metrics(experiment_id);
CREATE INDEX IF NOT EXISTS idx_security_anomalies_tenant ON security_anomalies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_anomalies_type ON security_anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_auth_events_tenant ON auth_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_user ON auth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_ip ON auth_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant ON compliance_reports(tenant_id);

-- Row Level Security
ALTER TABLE cost_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_daily_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_blocklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_timeouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY cost_events_isolation ON cost_events
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY cost_daily_isolation ON cost_daily_aggregates
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY cost_alerts_isolation ON cost_alerts
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY experiments_isolation ON experiments
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY exp_assignments_isolation ON experiment_assignments
    FOR ALL USING (experiment_id IN (
        SELECT id FROM experiments WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
    ));
CREATE POLICY exp_metrics_isolation ON experiment_metrics
    FOR ALL USING (experiment_id IN (
        SELECT id FROM experiments WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
    ));
CREATE POLICY security_anomalies_isolation ON security_anomalies
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY ip_blocklist_isolation ON ip_blocklist
    FOR ALL USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY auth_events_isolation ON auth_events
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY compliance_reports_isolation ON compliance_reports
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY compliance_findings_isolation ON compliance_findings
    FOR ALL USING (report_id IN (
        SELECT id FROM compliance_reports WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
    ));
CREATE POLICY operation_timeouts_isolation ON operation_timeouts
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Default operation timeouts
INSERT INTO operation_timeouts (tenant_id, operation_name, timeout_seconds, retry_count)
SELECT t.id, op.name, op.timeout, op.retries
FROM tenants t
CROSS JOIN (VALUES
    ('cdk_bootstrap', 600, 2),
    ('cdk_deploy', 1800, 1),
    ('cdk_destroy', 900, 1),
    ('migration_run', 300, 3),
    ('health_check', 30, 5),
    ('model_inference', 120, 2)
) AS op(name, timeout, retries)
ON CONFLICT DO NOTHING;
