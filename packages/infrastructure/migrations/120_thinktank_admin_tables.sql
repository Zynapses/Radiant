-- RADIANT v4.18.0 - Think Tank Admin Tables Migration
-- Creates tables for user rules and shadow testing features

BEGIN;

-- ============================================================================
-- User Rules Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    is_active BOOLEAN DEFAULT TRUE,
    times_applied INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_rules_tenant ON user_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_rules_user ON user_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_user_rules_active ON user_rules(tenant_id, is_active);

-- RLS for user_rules
ALTER TABLE user_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_rules_tenant_isolation ON user_rules
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- Shadow Tests Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS shadow_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    test_name VARCHAR(255) NOT NULL,
    baseline_template_name VARCHAR(255) NOT NULL,
    candidate_template_name VARCHAR(255) NOT NULL,
    test_mode VARCHAR(50) DEFAULT 'auto',
    traffic_percentage DECIMAL(5, 2) DEFAULT 10.0,
    min_samples INTEGER DEFAULT 100,
    samples_collected INTEGER DEFAULT 0,
    baseline_avg_score DECIMAL(5, 4),
    candidate_avg_score DECIMAL(5, 4),
    winner VARCHAR(50),
    confidence_level DECIMAL(5, 4),
    status VARCHAR(50) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'promoted', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_shadow_tests_tenant ON shadow_tests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shadow_tests_status ON shadow_tests(tenant_id, status);

-- RLS for shadow_tests
ALTER TABLE shadow_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY shadow_tests_tenant_isolation ON shadow_tests
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- Shadow Test Samples Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS shadow_test_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES shadow_tests(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID,
    baseline_response_quality DECIMAL(5, 4),
    candidate_response_quality DECIMAL(5, 4),
    baseline_latency_ms INTEGER,
    candidate_latency_ms INTEGER,
    baseline_tokens INTEGER,
    candidate_tokens INTEGER,
    user_preference VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shadow_samples_test ON shadow_test_samples(test_id);
CREATE INDEX IF NOT EXISTS idx_shadow_samples_tenant ON shadow_test_samples(tenant_id);

-- RLS for shadow_test_samples
ALTER TABLE shadow_test_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY shadow_samples_tenant_isolation ON shadow_test_samples
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- API Request Logs Table (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    response_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_tenant ON api_request_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_request_logs(tenant_id, created_at);

-- RLS for api_request_logs
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_logs_tenant_isolation ON api_request_logs
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

COMMIT;
