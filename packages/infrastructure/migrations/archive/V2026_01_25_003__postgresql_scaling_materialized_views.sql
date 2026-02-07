-- ============================================================================
-- PostgreSQL Scaling Migration Part 3: Materialized Views
-- Version: 5.53.0
-- Date: 2026-01-25
-- 
-- Pre-compute common metrics for tenant dashboards.
-- Real-time aggregation across millions of rows per tenant degrades performance.
-- Materialized views refreshed on schedule solve this efficiently.
-- ============================================================================

-- ============================================================================
-- SECTION 1: Daily Usage Summary per Tenant
-- Refresh: Every 15 minutes
-- Used for: Dashboard usage charts, billing summaries
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tenant_daily_usage AS
SELECT 
    tenant_id,
    DATE_TRUNC('day', created_at) AS day,
    COUNT(*) AS total_requests,
    COUNT(DISTINCT user_id) AS unique_users,
    COUNT(DISTINCT model_id) AS models_used_count,
    array_agg(DISTINCT model_id) AS models_used,
    SUM(prompt_tokens) AS total_prompt_tokens,
    SUM(completion_tokens) AS total_completion_tokens,
    SUM(prompt_tokens + completion_tokens) AS total_tokens,
    AVG(latency_ms) AS avg_latency_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) AS median_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99_latency_ms,
    MIN(latency_ms) AS min_latency_ms,
    MAX(latency_ms) AS max_latency_ms,
    COUNT(*) FILTER (WHERE status = 'completed') AS successful_requests,
    COUNT(*) FILTER (WHERE status = 'error') AS failed_requests,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / 
        NULLIF(COUNT(*), 0) * 100, 2
    ) AS success_rate_pct
FROM model_execution_logs_partitioned
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY tenant_id, DATE_TRUNC('day', created_at);

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tenant_daily_usage_pk 
    ON mv_tenant_daily_usage (tenant_id, day);

CREATE INDEX IF NOT EXISTS idx_mv_tenant_daily_usage_day 
    ON mv_tenant_daily_usage (day DESC);

COMMENT ON MATERIALIZED VIEW mv_tenant_daily_usage IS 
    'Daily usage aggregates per tenant. Refresh every 15 minutes.';

-- ============================================================================
-- SECTION 2: Model Performance Comparison per Tenant
-- Refresh: Every 15 minutes
-- Used for: Model comparison dashboard, SLA monitoring
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tenant_model_performance AS
SELECT 
    tenant_id,
    model_id,
    model_provider,
    DATE_TRUNC('hour', created_at) AS hour,
    COUNT(*) AS request_count,
    SUM(prompt_tokens) AS total_prompt_tokens,
    SUM(completion_tokens) AS total_completion_tokens,
    AVG(latency_ms) AS avg_latency_ms,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99_latency_ms,
    AVG(completion_tokens::NUMERIC / NULLIF(prompt_tokens, 0)) AS avg_expansion_ratio,
    AVG(completion_tokens::NUMERIC / NULLIF(latency_ms, 0) * 1000) AS tokens_per_second,
    COUNT(*) FILTER (WHERE status = 'error') AS error_count,
    array_agg(DISTINCT error_message) FILTER (WHERE error_message IS NOT NULL) AS error_types
FROM model_execution_logs_partitioned
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY tenant_id, model_id, model_provider, DATE_TRUNC('hour', created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tenant_model_perf_pk 
    ON mv_tenant_model_performance (tenant_id, model_id, hour);

CREATE INDEX IF NOT EXISTS idx_mv_tenant_model_perf_hour 
    ON mv_tenant_model_performance (hour DESC);

COMMENT ON MATERIALIZED VIEW mv_tenant_model_performance IS 
    'Hourly model performance per tenant. Refresh every 15 minutes.';

-- ============================================================================
-- SECTION 3: Tenant Cost Summary
-- Refresh: Every hour
-- Used for: Billing dashboard, cost alerts
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tenant_cost_summary AS
SELECT 
    tenant_id,
    DATE_TRUNC('day', timestamp) AS day,
    resource_type,
    SUM(quantity) AS total_quantity,
    unit,
    SUM(cost_microcents) AS total_cost_microcents,
    SUM(cost_microcents) / 10000.0 AS total_cost_dollars,
    COUNT(*) AS transaction_count,
    COUNT(DISTINCT user_id) AS users_contributing
FROM usage_records_partitioned
WHERE timestamp > NOW() - INTERVAL '90 days'
GROUP BY tenant_id, DATE_TRUNC('day', timestamp), resource_type, unit;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tenant_cost_pk 
    ON mv_tenant_cost_summary (tenant_id, day, resource_type, unit);

CREATE INDEX IF NOT EXISTS idx_mv_tenant_cost_day 
    ON mv_tenant_cost_summary (day DESC);

COMMENT ON MATERIALIZED VIEW mv_tenant_cost_summary IS 
    'Daily cost summary per tenant and resource type. Refresh every hour.';

-- ============================================================================
-- SECTION 4: User Activity Summary
-- Refresh: Every 30 minutes
-- Used for: User analytics, engagement tracking
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_activity_summary AS
SELECT 
    tenant_id,
    user_id,
    DATE_TRUNC('day', created_at) AS day,
    COUNT(*) AS request_count,
    COUNT(DISTINCT model_id) AS models_used,
    SUM(prompt_tokens + completion_tokens) AS total_tokens,
    AVG(latency_ms) AS avg_latency_ms,
    MIN(created_at) AS first_request,
    MAX(created_at) AS last_request,
    COUNT(DISTINCT DATE_TRUNC('hour', created_at)) AS active_hours
FROM model_execution_logs_partitioned
WHERE created_at > NOW() - INTERVAL '30 days'
    AND user_id IS NOT NULL
GROUP BY tenant_id, user_id, DATE_TRUNC('day', created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_activity_pk 
    ON mv_user_activity_summary (tenant_id, user_id, day);

CREATE INDEX IF NOT EXISTS idx_mv_user_activity_tenant_day 
    ON mv_user_activity_summary (tenant_id, day DESC);

COMMENT ON MATERIALIZED VIEW mv_user_activity_summary IS 
    'Daily user activity per tenant. Refresh every 30 minutes.';

-- ============================================================================
-- SECTION 5: Platform-Wide Statistics (Admin Only)
-- Refresh: Every hour
-- Used for: Admin dashboard, capacity planning
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_platform_statistics AS
SELECT 
    DATE_TRUNC('hour', created_at) AS hour,
    COUNT(DISTINCT tenant_id) AS active_tenants,
    COUNT(DISTINCT user_id) AS active_users,
    COUNT(*) AS total_requests,
    SUM(prompt_tokens + completion_tokens) AS total_tokens,
    AVG(latency_ms) AS avg_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
    COUNT(DISTINCT model_id) AS models_used,
    array_agg(DISTINCT model_id) AS model_list,
    COUNT(*) FILTER (WHERE status = 'error') AS error_count,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'error')::NUMERIC / 
        NULLIF(COUNT(*), 0) * 100, 2
    ) AS error_rate_pct
FROM model_execution_logs_partitioned
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_platform_stats_pk 
    ON mv_platform_statistics (hour);

COMMENT ON MATERIALIZED VIEW mv_platform_statistics IS 
    'Platform-wide hourly statistics. Admin only. Refresh every hour.';

-- ============================================================================
-- SECTION 6: Model Popularity Ranking
-- Refresh: Every hour
-- Used for: Model recommendations, inventory management
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_model_popularity AS
SELECT 
    model_id,
    model_provider,
    DATE_TRUNC('day', created_at) AS day,
    COUNT(*) AS request_count,
    COUNT(DISTINCT tenant_id) AS tenant_count,
    COUNT(DISTINCT user_id) AS user_count,
    SUM(prompt_tokens + completion_tokens) AS total_tokens,
    AVG(latency_ms) AS avg_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
    COUNT(*) FILTER (WHERE status = 'error') AS error_count,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / 
        NULLIF(COUNT(*), 0) * 100, 2
    ) AS success_rate_pct,
    RANK() OVER (
        PARTITION BY DATE_TRUNC('day', created_at) 
        ORDER BY COUNT(*) DESC
    ) AS daily_rank
FROM model_execution_logs_partitioned
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY model_id, model_provider, DATE_TRUNC('day', created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_model_popularity_pk 
    ON mv_model_popularity (model_id, day);

CREATE INDEX IF NOT EXISTS idx_mv_model_popularity_rank 
    ON mv_model_popularity (day, daily_rank);

COMMENT ON MATERIALIZED VIEW mv_model_popularity IS 
    'Daily model popularity rankings. Refresh every hour.';

-- ============================================================================
-- SECTION 7: Refresh Functions and Scheduling
-- ============================================================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS TABLE(view_name TEXT, refresh_status TEXT, duration_ms NUMERIC) AS $$
DECLARE
    start_time TIMESTAMPTZ;
    view_record RECORD;
BEGIN
    FOR view_record IN 
        SELECT matviewname 
        FROM pg_matviews 
        WHERE schemaname = 'public' 
        AND matviewname LIKE 'mv_%'
    LOOP
        start_time := clock_timestamp();
        BEGIN
            EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', view_record.matviewname);
            view_name := view_record.matviewname;
            refresh_status := 'success';
            duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
        EXCEPTION WHEN OTHERS THEN
            view_name := view_record.matviewname;
            refresh_status := 'error: ' || SQLERRM;
            duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
        END;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh high-priority views (15-minute schedule)
CREATE OR REPLACE FUNCTION refresh_priority_materialized_views()
RETURNS TABLE(view_name TEXT, refresh_status TEXT, duration_ms NUMERIC) AS $$
DECLARE
    start_time TIMESTAMPTZ;
    view_names TEXT[] := ARRAY[
        'mv_tenant_daily_usage',
        'mv_tenant_model_performance'
    ];
    v TEXT;
BEGIN
    FOREACH v IN ARRAY view_names
    LOOP
        start_time := clock_timestamp();
        BEGIN
            EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', v);
            view_name := v;
            refresh_status := 'success';
            duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
        EXCEPTION WHEN OTHERS THEN
            view_name := v;
            refresh_status := 'error: ' || SQLERRM;
            duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000;
        END;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Materialized view refresh log
CREATE TABLE IF NOT EXISTS mv_refresh_log (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    view_name TEXT NOT NULL,
    refresh_status TEXT NOT NULL,
    duration_ms NUMERIC,
    rows_affected BIGINT,
    refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_mv_refresh_log_view 
    ON mv_refresh_log (view_name, refreshed_at DESC);

-- Function to log refresh results
CREATE OR REPLACE FUNCTION log_mv_refresh(
    p_view_name TEXT,
    p_status TEXT,
    p_duration_ms NUMERIC
) RETURNS void AS $$
BEGIN
    INSERT INTO mv_refresh_log (view_name, refresh_status, duration_ms)
    VALUES (p_view_name, p_status, p_duration_ms);
    
    -- Cleanup old logs (keep 7 days)
    DELETE FROM mv_refresh_log 
    WHERE refreshed_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 8: Query Helper Functions
-- ============================================================================

-- Get tenant usage summary for a date range
CREATE OR REPLACE FUNCTION get_tenant_usage_summary(
    p_tenant_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE(
    day DATE,
    total_requests BIGINT,
    total_tokens BIGINT,
    avg_latency_ms NUMERIC,
    success_rate_pct NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mv.day::DATE,
        mv.total_requests,
        mv.total_tokens,
        mv.avg_latency_ms,
        mv.success_rate_pct
    FROM mv_tenant_daily_usage mv
    WHERE mv.tenant_id = p_tenant_id
    AND mv.day >= p_start_date
    AND mv.day <= p_end_date
    ORDER BY mv.day;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get model performance comparison
CREATE OR REPLACE FUNCTION get_model_performance_comparison(
    p_tenant_id UUID,
    p_hours INTEGER DEFAULT 24
) RETURNS TABLE(
    model_id VARCHAR(100),
    model_provider VARCHAR(50),
    request_count BIGINT,
    avg_latency_ms NUMERIC,
    p95_latency_ms NUMERIC,
    tokens_per_second NUMERIC,
    error_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mv.model_id,
        mv.model_provider,
        SUM(mv.request_count)::BIGINT,
        AVG(mv.avg_latency_ms),
        AVG(mv.p95_latency_ms),
        AVG(mv.tokens_per_second),
        SUM(mv.error_count)::NUMERIC / NULLIF(SUM(mv.request_count), 0) * 100
    FROM mv_tenant_model_performance mv
    WHERE mv.tenant_id = p_tenant_id
    AND mv.hour > NOW() - (p_hours || ' hours')::INTERVAL
    GROUP BY mv.model_id, mv.model_provider
    ORDER BY SUM(mv.request_count) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON mv_tenant_daily_usage TO radiant_app;
GRANT SELECT ON mv_tenant_model_performance TO radiant_app;
GRANT SELECT ON mv_tenant_cost_summary TO radiant_app;
GRANT SELECT ON mv_user_activity_summary TO radiant_app;
GRANT SELECT ON mv_platform_statistics TO radiant_app;
GRANT SELECT ON mv_model_popularity TO radiant_app;
GRANT SELECT, INSERT ON mv_refresh_log TO radiant_app;

GRANT EXECUTE ON FUNCTION refresh_all_materialized_views TO radiant_app;
GRANT EXECUTE ON FUNCTION refresh_priority_materialized_views TO radiant_app;
GRANT EXECUTE ON FUNCTION log_mv_refresh TO radiant_app;
GRANT EXECUTE ON FUNCTION get_tenant_usage_summary TO radiant_app;
GRANT EXECUTE ON FUNCTION get_model_performance_comparison TO radiant_app;
