-- RADIANT v4.18.0 - Library Execution Tables
-- Multi-tenant concurrent library execution with isolation
-- Migration: 104_library_execution.sql

-- ============================================================================
-- Tenant Execution Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS library_execution_config (
    tenant_id TEXT PRIMARY KEY,
    execution_enabled BOOLEAN NOT NULL DEFAULT true,
    max_concurrent_executions INTEGER NOT NULL DEFAULT 10,
    max_concurrent_per_user INTEGER NOT NULL DEFAULT 3,
    default_constraints JSONB NOT NULL DEFAULT '{
        "maxDurationSeconds": 60,
        "maxMemoryMb": 512,
        "maxOutputBytes": 10485760,
        "allowNetwork": false,
        "allowFileWrites": false
    }'::jsonb,
    library_overrides JSONB,
    daily_budget DECIMAL(12,4),
    monthly_budget DECIMAL(12,4),
    allowed_execution_types TEXT[] NOT NULL DEFAULT ARRAY['code_execution', 'data_transformation', 'analysis', 'visualization'],
    blocked_libraries TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    priority_boost INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_execution_config_enabled ON library_execution_config(execution_enabled) WHERE execution_enabled = true;

COMMENT ON TABLE library_execution_config IS 'Per-tenant configuration for library execution';

-- ============================================================================
-- Library Executions (Active and Completed)
-- ============================================================================

CREATE TABLE IF NOT EXISTS library_executions (
    execution_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    library_id TEXT NOT NULL,
    execution_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    
    -- Execution details
    code TEXT NOT NULL,
    input_data JSONB,
    context_data JSONB,
    constraints JSONB NOT NULL,
    
    -- Output
    output_data JSONB,
    error_data JSONB,
    
    -- Metrics
    queued_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    peak_memory_mb INTEGER,
    cpu_time_ms INTEGER,
    network_bytes_in BIGINT,
    network_bytes_out BIGINT,
    
    -- Billing
    credits_used DECIMAL(12,6) DEFAULT 0,
    pricing_tier TEXT DEFAULT 'standard',
    
    -- Executor info
    executor_type TEXT, -- 'lambda', 'fargate', 'sagemaker'
    executor_id TEXT,
    
    CONSTRAINT valid_status CHECK (status IN ('queued', 'running', 'completed', 'failed', 'timeout', 'cancelled', 'resource_exceeded'))
);

-- Indexes for concurrent execution tracking
CREATE INDEX idx_executions_tenant_status ON library_executions(tenant_id, status);
CREATE INDEX idx_executions_user_status ON library_executions(tenant_id, user_id, status);
CREATE INDEX idx_executions_library ON library_executions(library_id, started_at DESC);
CREATE INDEX idx_executions_started ON library_executions(started_at DESC) WHERE status = 'running';
CREATE INDEX idx_executions_completed ON library_executions(completed_at DESC) WHERE status IN ('completed', 'failed');

COMMENT ON TABLE library_executions IS 'Library execution records with metrics and billing';

-- ============================================================================
-- Execution Queue (Priority-based)
-- ============================================================================

CREATE TABLE IF NOT EXISTS library_execution_queue (
    execution_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    library_id TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    request_data JSONB NOT NULL,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estimated_start_at TIMESTAMPTZ
);

-- Index for efficient queue processing
CREATE INDEX idx_queue_tenant_priority ON library_execution_queue(tenant_id, priority DESC, queued_at ASC);
CREATE INDEX idx_queue_user ON library_execution_queue(tenant_id, user_id);

COMMENT ON TABLE library_execution_queue IS 'Priority queue for pending library executions';

-- ============================================================================
-- Execution Logs (for debugging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS library_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id TEXT NOT NULL REFERENCES library_executions(execution_id) ON DELETE CASCADE,
    log_level TEXT NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_execution_logs_execution ON library_execution_logs(execution_id, timestamp);

COMMENT ON TABLE library_execution_logs IS 'Execution logs for debugging';

-- ============================================================================
-- Executor Pool Status
-- ============================================================================

CREATE TABLE IF NOT EXISTS library_executor_pool (
    executor_type TEXT PRIMARY KEY,
    available INTEGER NOT NULL DEFAULT 0,
    busy INTEGER NOT NULL DEFAULT 0,
    max_capacity INTEGER NOT NULL DEFAULT 100,
    scaling_in_progress BOOLEAN NOT NULL DEFAULT false,
    target_capacity INTEGER,
    last_scale_action TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initialize executor pool
INSERT INTO library_executor_pool (executor_type, available, max_capacity) VALUES
    ('lambda', 100, 1000),
    ('fargate', 10, 50),
    ('sagemaker', 5, 20)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE library_executor_pool IS 'Status of executor pools for auto-scaling';

-- ============================================================================
-- Usage Aggregates (for billing and analytics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS library_execution_aggregates (
    tenant_id TEXT NOT NULL,
    library_id TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_type TEXT NOT NULL, -- 'hourly', 'daily', 'monthly'
    
    execution_count INTEGER NOT NULL DEFAULT 0,
    successful_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    total_duration_ms BIGINT NOT NULL DEFAULT 0,
    total_credits DECIMAL(12,6) NOT NULL DEFAULT 0,
    avg_duration_ms INTEGER,
    peak_concurrent INTEGER,
    
    PRIMARY KEY (tenant_id, library_id, period_start, period_type)
);

CREATE INDEX idx_exec_aggregates_tenant ON library_execution_aggregates(tenant_id, period_start DESC);

COMMENT ON TABLE library_execution_aggregates IS 'Pre-computed execution statistics for billing and analytics';

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE library_execution_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_execution_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_execution_aggregates ENABLE ROW LEVEL SECURITY;

-- Config policies
CREATE POLICY execution_config_tenant_isolation ON library_execution_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Execution policies
CREATE POLICY executions_tenant_isolation ON library_executions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Queue policies
CREATE POLICY queue_tenant_isolation ON library_execution_queue
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Logs policies
CREATE POLICY logs_tenant_isolation ON library_execution_logs
    FOR ALL USING (
        execution_id IN (
            SELECT execution_id FROM library_executions 
            WHERE tenant_id = current_setting('app.current_tenant_id', true)
        )
    );

-- Aggregates policies
CREATE POLICY aggregates_tenant_isolation ON library_execution_aggregates
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- Functions
-- ============================================================================

-- Get current concurrency for tenant
CREATE OR REPLACE FUNCTION get_tenant_concurrency(p_tenant_id TEXT)
RETURNS TABLE (
    total_active INTEGER,
    user_counts JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_active,
        jsonb_object_agg(user_id, user_count) as user_counts
    FROM (
        SELECT user_id, COUNT(*) as user_count
        FROM library_executions
        WHERE tenant_id = p_tenant_id AND status = 'running'
        GROUP BY user_id
    ) sub;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if execution can start
CREATE OR REPLACE FUNCTION can_start_execution(
    p_tenant_id TEXT,
    p_user_id TEXT
)
RETURNS TABLE (
    allowed BOOLEAN,
    reason TEXT
) AS $$
DECLARE
    v_config library_execution_config%ROWTYPE;
    v_tenant_active INTEGER;
    v_user_active INTEGER;
BEGIN
    -- Get config
    SELECT * INTO v_config FROM library_execution_config WHERE tenant_id = p_tenant_id;
    
    IF v_config IS NULL THEN
        RETURN QUERY SELECT true, NULL::TEXT;
        RETURN;
    END IF;
    
    IF NOT v_config.execution_enabled THEN
        RETURN QUERY SELECT false, 'Library execution is disabled';
        RETURN;
    END IF;
    
    -- Count active executions
    SELECT COUNT(*) INTO v_tenant_active
    FROM library_executions
    WHERE tenant_id = p_tenant_id AND status = 'running';
    
    IF v_tenant_active >= v_config.max_concurrent_executions THEN
        RETURN QUERY SELECT false, format('Tenant limit reached (%s/%s)', v_tenant_active, v_config.max_concurrent_executions);
        RETURN;
    END IF;
    
    SELECT COUNT(*) INTO v_user_active
    FROM library_executions
    WHERE tenant_id = p_tenant_id AND user_id = p_user_id AND status = 'running';
    
    IF v_user_active >= v_config.max_concurrent_per_user THEN
        RETURN QUERY SELECT false, format('User limit reached (%s/%s)', v_user_active, v_config.max_concurrent_per_user);
        RETURN;
    END IF;
    
    RETURN QUERY SELECT true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aggregate hourly stats
CREATE OR REPLACE FUNCTION aggregate_hourly_execution_stats()
RETURNS void AS $$
BEGIN
    INSERT INTO library_execution_aggregates (
        tenant_id, library_id, period_start, period_type,
        execution_count, successful_count, failed_count,
        total_duration_ms, total_credits, avg_duration_ms
    )
    SELECT 
        tenant_id,
        library_id,
        date_trunc('hour', started_at) as period_start,
        'hourly',
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed'),
        COUNT(*) FILTER (WHERE status = 'failed'),
        COALESCE(SUM(duration_ms), 0),
        COALESCE(SUM(credits_used), 0),
        AVG(duration_ms)::INTEGER
    FROM library_executions
    WHERE started_at >= NOW() - INTERVAL '2 hours'
      AND started_at < date_trunc('hour', NOW())
      AND status IN ('completed', 'failed')
    GROUP BY tenant_id, library_id, date_trunc('hour', started_at)
    ON CONFLICT (tenant_id, library_id, period_start, period_type) DO UPDATE SET
        execution_count = EXCLUDED.execution_count,
        successful_count = EXCLUDED.successful_count,
        failed_count = EXCLUDED.failed_count,
        total_duration_ms = EXCLUDED.total_duration_ms,
        total_credits = EXCLUDED.total_credits,
        avg_duration_ms = EXCLUDED.avg_duration_ms;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_tenant_concurrency(TEXT) IS 'Get current execution concurrency for a tenant';
COMMENT ON FUNCTION can_start_execution(TEXT, TEXT) IS 'Check if a new execution can be started';
COMMENT ON FUNCTION aggregate_hourly_execution_stats() IS 'Aggregate execution statistics hourly';

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_execution_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_execution_config_timestamp
    BEFORE UPDATE ON library_execution_config
    FOR EACH ROW EXECUTE FUNCTION update_execution_config_timestamp();

-- ============================================================================
-- Cleanup
-- ============================================================================

-- Clean up old executions (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_executions()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM library_executions
    WHERE completed_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_executions() IS 'Remove executions older than 30 days';
