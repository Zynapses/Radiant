-- RADIANT v4.17.0 - Migration 012: Metrics & Analytics
-- Usage metrics and aggregation tables

CREATE TABLE usage_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('api_request', 'token_usage', 'model_inference', 'billing', 'error', 'latency')),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20, 6) NOT NULL,
    dimensions JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE aggregated_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('hourly', 'daily', 'weekly', 'monthly')),
    metric_type VARCHAR(50) NOT NULL,
    total_requests BIGINT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    total_cost DECIMAL(20, 6) DEFAULT 0,
    avg_latency_ms DECIMAL(10, 2),
    p50_latency_ms DECIMAL(10, 2),
    p95_latency_ms DECIMAL(10, 2),
    p99_latency_ms DECIMAL(10, 2),
    error_count INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    model_breakdown JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, period_start, period_type, metric_type)
);

CREATE INDEX idx_usage_metrics_tenant_time ON usage_metrics(tenant_id, recorded_at DESC);
CREATE INDEX idx_usage_metrics_type ON usage_metrics(metric_type);
CREATE INDEX idx_usage_metrics_user ON usage_metrics(user_id);
CREATE INDEX idx_aggregated_period ON aggregated_metrics(tenant_id, period_start DESC, period_type);

ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregated_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_metrics_isolation ON usage_metrics
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY aggregated_metrics_isolation ON aggregated_metrics
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY usage_metrics_super_admin ON usage_metrics
    FOR SELECT USING (current_setting('app.is_super_admin', true)::boolean = true);

CREATE POLICY aggregated_metrics_super_admin ON aggregated_metrics
    FOR SELECT USING (current_setting('app.is_super_admin', true)::boolean = true);

-- Function to aggregate metrics
CREATE OR REPLACE FUNCTION aggregate_hourly_metrics(p_tenant_id UUID, p_hour TIMESTAMPTZ)
RETURNS void AS $$
BEGIN
    INSERT INTO aggregated_metrics (
        tenant_id, period_start, period_end, period_type, metric_type,
        total_requests, total_tokens, total_cost, avg_latency_ms,
        error_count, unique_users
    )
    SELECT 
        tenant_id,
        date_trunc('hour', p_hour),
        date_trunc('hour', p_hour) + INTERVAL '1 hour',
        'hourly',
        metric_type,
        COUNT(*),
        SUM(CASE WHEN metric_name = 'tokens' THEN metric_value ELSE 0 END)::BIGINT,
        SUM(CASE WHEN metric_name = 'cost' THEN metric_value ELSE 0 END),
        AVG(CASE WHEN metric_name = 'latency_ms' THEN metric_value END),
        COUNT(*) FILTER (WHERE metric_name = 'error'),
        COUNT(DISTINCT user_id)
    FROM usage_metrics
    WHERE tenant_id = p_tenant_id
    AND recorded_at >= date_trunc('hour', p_hour)
    AND recorded_at < date_trunc('hour', p_hour) + INTERVAL '1 hour'
    GROUP BY tenant_id, metric_type
    ON CONFLICT (tenant_id, period_start, period_type, metric_type) 
    DO UPDATE SET
        total_requests = EXCLUDED.total_requests,
        total_tokens = EXCLUDED.total_tokens,
        total_cost = EXCLUDED.total_cost,
        avg_latency_ms = EXCLUDED.avg_latency_ms,
        error_count = EXCLUDED.error_count,
        unique_users = EXCLUDED.unique_users;
END;
$$ LANGUAGE plpgsql;
