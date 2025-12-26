-- RADIANT v4.17.0 - Migration 014: Centralized Error Logging
-- Error tracking, patterns, and resolution

CREATE TABLE error_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    error_code VARCHAR(50) NOT NULL,
    error_type VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    request_id VARCHAR(100),
    source_service VARCHAR(100),
    source_function VARCHAR(200),
    context JSONB DEFAULT '{}',
    severity VARCHAR(20) NOT NULL DEFAULT 'error' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES administrators(id),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE error_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_name VARCHAR(100) NOT NULL UNIQUE,
    error_code_pattern VARCHAR(100),
    message_pattern TEXT,
    occurrence_count INTEGER DEFAULT 1,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    auto_resolve_enabled BOOLEAN DEFAULT false,
    auto_resolve_action JSONB,
    notification_threshold INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_error_logs_tenant ON error_logs(tenant_id, created_at DESC);
CREATE INDEX idx_error_logs_code ON error_logs(error_code);
CREATE INDEX idx_error_logs_severity ON error_logs(severity);
CREATE INDEX idx_error_logs_unresolved ON error_logs(resolved, created_at DESC) WHERE resolved = false;
CREATE INDEX idx_error_logs_service ON error_logs(source_service);
CREATE INDEX idx_error_patterns_code ON error_patterns(error_code_pattern);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Admins can see all errors, users only their own tenant
CREATE POLICY error_logs_isolation ON error_logs
    FOR SELECT USING (
        current_setting('app.is_super_admin', true)::boolean = true OR
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY error_logs_insert ON error_logs
    FOR INSERT WITH CHECK (true);

-- View for error summary by service
CREATE OR REPLACE VIEW v_error_summary AS
SELECT 
    source_service,
    error_code,
    severity,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE resolved = false) as unresolved_count,
    MAX(created_at) as last_occurrence,
    MIN(created_at) as first_occurrence
FROM error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY source_service, error_code, severity
ORDER BY unresolved_count DESC, total_count DESC;
