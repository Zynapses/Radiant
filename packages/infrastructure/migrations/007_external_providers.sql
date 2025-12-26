-- RADIANT v4.17.0 - Migration 007: External Providers
-- Additional external provider configuration and health monitoring

-- ============================================================================
-- PROVIDER HEALTH CHECKS TABLE
-- ============================================================================

CREATE TABLE provider_health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    latency_ms INTEGER,
    error_message TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_provider_health_checks_provider_id ON provider_health_checks(provider_id);
CREATE INDEX idx_provider_health_checks_checked_at ON provider_health_checks(checked_at);

-- Cleanup old health checks (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_health_checks()
RETURNS void AS $$
BEGIN
    DELETE FROM provider_health_checks WHERE checked_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PROVIDER RATE LIMITS TABLE
-- ============================================================================

CREATE TABLE provider_rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    requests_per_minute INTEGER NOT NULL DEFAULT 60,
    tokens_per_minute INTEGER NOT NULL DEFAULT 100000,
    requests_per_day INTEGER NOT NULL DEFAULT 10000,
    concurrent_requests INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider_id, tenant_id)
);

CREATE INDEX idx_provider_rate_limits_provider_id ON provider_rate_limits(provider_id);
CREATE INDEX idx_provider_rate_limits_tenant_id ON provider_rate_limits(tenant_id);

CREATE TRIGGER update_provider_rate_limits_updated_at BEFORE UPDATE ON provider_rate_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MODEL ALIASES TABLE
-- ============================================================================

CREATE TABLE model_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alias VARCHAR(100) NOT NULL,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (alias, tenant_id)
);

CREATE INDEX idx_model_aliases_alias ON model_aliases(alias);
CREATE INDEX idx_model_aliases_model_id ON model_aliases(model_id);
CREATE INDEX idx_model_aliases_tenant_id ON model_aliases(tenant_id);

-- ============================================================================
-- SEED DATA: Model Aliases
-- ============================================================================

INSERT INTO model_aliases (alias, model_id, is_default) VALUES
    ('gpt-4', (SELECT id FROM models WHERE name = 'gpt-4o'), true),
    ('claude', (SELECT id FROM models WHERE name = 'claude-3-5-sonnet-20241022'), true),
    ('gemini', (SELECT id FROM models WHERE name = 'gemini-2.0-flash-exp'), true);

-- ============================================================================
-- PROVIDER FAILOVER CONFIGURATION
-- ============================================================================

CREATE TABLE provider_failovers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    primary_provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    fallback_provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (primary_provider_id, fallback_provider_id)
);

CREATE INDEX idx_provider_failovers_primary ON provider_failovers(primary_provider_id);
CREATE INDEX idx_provider_failovers_enabled ON provider_failovers(enabled);

-- ============================================================================
-- VIEW: Active Models with Provider Info
-- ============================================================================

CREATE OR REPLACE VIEW v_active_models AS
SELECT 
    m.id,
    m.name,
    m.display_name,
    m.category,
    m.capabilities,
    m.context_window,
    m.max_output_tokens,
    m.input_cost_per_1k * 1.4 as billed_input_cost_per_1k,
    m.output_cost_per_1k * 1.4 as billed_output_cost_per_1k,
    m.status,
    m.config,
    p.id as provider_id,
    p.name as provider_name,
    p.display_name as provider_display_name,
    p.type as provider_type,
    p.health_status as provider_health
FROM models m
JOIN providers p ON m.provider_id = p.id
WHERE m.status = 'active' AND p.status = 'active';

-- ============================================================================
-- VIEW: Usage Summary by Tenant
-- ============================================================================

CREATE OR REPLACE VIEW v_usage_summary AS
SELECT 
    tenant_id,
    DATE_TRUNC('day', created_at) as usage_date,
    COUNT(*) as request_count,
    SUM(total_tokens) as total_tokens,
    SUM(total_cost) as total_cost,
    AVG(latency_ms) as avg_latency_ms,
    COUNT(*) FILTER (WHERE status = 'error') as error_count
FROM usage_events
GROUP BY tenant_id, DATE_TRUNC('day', created_at);
