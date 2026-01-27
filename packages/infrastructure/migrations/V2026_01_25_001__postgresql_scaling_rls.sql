-- ============================================================================
-- PostgreSQL Scaling Migration Part 1: RLS Optimization
-- Version: 5.53.0
-- Date: 2026-01-25
-- 
-- Based on OpenAI's PostgreSQL scaling patterns (800M users, 50+ read replicas).
-- Key insight: Wrap session variables in SELECT for single evaluation.
-- Bad:  tenant_id = current_setting('app.tenant_id')::uuid  -- evaluated per-row
-- Good: tenant_id = (SELECT current_setting('app.tenant_id', true)::uuid)  -- evaluated once
-- ============================================================================

-- ============================================================================
-- SECTION 1: Model Execution Logs Table with Optimized RLS
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_execution_logs (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    request_id UUID NOT NULL,
    user_id UUID,
    model_id VARCHAR(100) NOT NULL,
    model_provider VARCHAR(50),
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
    latency_ms INTEGER,
    response_hash TEXT,
    status VARCHAR(20) DEFAULT 'completed',
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Composite primary key with tenant_id first for data locality
    PRIMARY KEY (tenant_id, id, created_at)
);

COMMENT ON TABLE model_execution_logs IS 'Logs for AI model executions with optimized RLS for parallel writes';

-- Composite indexes that support RLS filtering efficiently
CREATE INDEX IF NOT EXISTS idx_model_logs_tenant_created 
    ON model_execution_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_model_logs_tenant_request
    ON model_execution_logs (tenant_id, request_id);

CREATE INDEX IF NOT EXISTS idx_model_logs_tenant_model
    ON model_execution_logs (tenant_id, model_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_model_logs_tenant_user
    ON model_execution_logs (tenant_id, user_id, created_at DESC);

-- Enable RLS
ALTER TABLE model_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_execution_logs FORCE ROW LEVEL SECURITY;

-- CRITICAL: Use SELECT wrapper for single evaluation (not per-row)
DROP POLICY IF EXISTS tenant_isolation_model_logs ON model_execution_logs;
CREATE POLICY tenant_isolation_model_logs ON model_execution_logs
    USING (tenant_id = (SELECT current_setting('app.current_tenant_id', true)::uuid))
    WITH CHECK (tenant_id = (SELECT current_setting('app.current_tenant_id', true)::uuid));

-- ============================================================================
-- SECTION 2: Prompt Results Table with Optimized RLS
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompt_results (
    id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    request_id UUID NOT NULL,
    user_id UUID,
    prompt_text TEXT,
    prompt_hash VARCHAR(64),
    result_text TEXT,
    result_hash VARCHAR(64),
    orchestration_mode VARCHAR(50),
    models_used TEXT[],
    total_latency_ms INTEGER,
    cached BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (tenant_id, id)
);

COMMENT ON TABLE prompt_results IS 'Cached prompt results with optimized RLS';

CREATE INDEX IF NOT EXISTS idx_prompt_results_tenant_request
    ON prompt_results (tenant_id, request_id);

CREATE INDEX IF NOT EXISTS idx_prompt_results_tenant_hash
    ON prompt_results (tenant_id, prompt_hash);

CREATE INDEX IF NOT EXISTS idx_prompt_results_tenant_created
    ON prompt_results (tenant_id, created_at DESC);

ALTER TABLE prompt_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_results FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_prompt_results ON prompt_results;
CREATE POLICY tenant_isolation_prompt_results ON prompt_results
    USING (tenant_id = (SELECT current_setting('app.current_tenant_id', true)::uuid))
    WITH CHECK (tenant_id = (SELECT current_setting('app.current_tenant_id', true)::uuid));

-- ============================================================================
-- SECTION 3: Usage Records Table (for billing) with Optimized RLS
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_records (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resource_type VARCHAR(50) NOT NULL, -- 'tokens', 'storage', 'api_calls'
    resource_id VARCHAR(100),
    quantity BIGINT NOT NULL,
    unit VARCHAR(20) NOT NULL, -- 'tokens', 'bytes', 'calls'
    cost_microcents BIGINT DEFAULT 0, -- Cost in 1/10000 of a cent for precision
    metadata JSONB DEFAULT '{}',
    
    PRIMARY KEY (tenant_id, id)
);

COMMENT ON TABLE usage_records IS 'Usage tracking for billing with optimized RLS';

CREATE INDEX IF NOT EXISTS idx_usage_records_tenant_timestamp
    ON usage_records (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_usage_records_tenant_resource
    ON usage_records (tenant_id, resource_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_usage_records_tenant_user
    ON usage_records (tenant_id, user_id, timestamp DESC);

ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_usage_records ON usage_records;
CREATE POLICY tenant_isolation_usage_records ON usage_records
    USING (tenant_id = (SELECT current_setting('app.current_tenant_id', true)::uuid))
    WITH CHECK (tenant_id = (SELECT current_setting('app.current_tenant_id', true)::uuid));

-- ============================================================================
-- SECTION 4: Batch Write Staging Table
-- For high-throughput async writes from SQS batch writer
-- ============================================================================

CREATE TABLE IF NOT EXISTS batch_write_staging (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL,
    target_table VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    
    PRIMARY KEY (id)
);

COMMENT ON TABLE batch_write_staging IS 'Staging table for async batch writes from SQS';

CREATE INDEX IF NOT EXISTS idx_batch_write_staging_status
    ON batch_write_staging (status, created_at);

CREATE INDEX IF NOT EXISTS idx_batch_write_staging_batch
    ON batch_write_staging (batch_id);

-- Cleanup function for processed records
CREATE OR REPLACE FUNCTION cleanup_batch_write_staging()
RETURNS void AS $$
BEGIN
    DELETE FROM batch_write_staging
    WHERE status = 'completed' 
    AND processed_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 5: Connection Pool Metrics Table
-- For monitoring RDS Proxy and connection health
-- ============================================================================

CREATE TABLE IF NOT EXISTS connection_pool_metrics (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    proxy_endpoint VARCHAR(255),
    active_connections INTEGER,
    idle_connections INTEGER,
    waiting_requests INTEGER,
    max_connections INTEGER,
    connection_acquisition_time_ms NUMERIC(10,2),
    query_latency_p50_ms NUMERIC(10,2),
    query_latency_p95_ms NUMERIC(10,2),
    query_latency_p99_ms NUMERIC(10,2),
    errors_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    
    PRIMARY KEY (id)
);

COMMENT ON TABLE connection_pool_metrics IS 'RDS Proxy and connection pool monitoring metrics';

CREATE INDEX IF NOT EXISTS idx_conn_pool_metrics_timestamp
    ON connection_pool_metrics (timestamp DESC);

-- ============================================================================
-- SECTION 6: Update Existing Tables with Optimized RLS Policies
-- Apply SELECT wrapper pattern to existing tenant-scoped tables
-- ============================================================================

-- Helper function to update RLS policies
CREATE OR REPLACE FUNCTION update_rls_policy_optimized(
    p_table_name TEXT,
    p_policy_name TEXT
) RETURNS void AS $$
DECLARE
    policy_exists BOOLEAN;
BEGIN
    -- Check if policy exists
    SELECT EXISTS(
        SELECT 1 FROM pg_policies 
        WHERE tablename = p_table_name AND policyname = p_policy_name
    ) INTO policy_exists;
    
    IF policy_exists THEN
        -- Drop existing policy
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p_policy_name, p_table_name);
    END IF;
    
    -- Create optimized policy with SELECT wrapper
    EXECUTE format(
        'CREATE POLICY %I ON %I 
         USING (tenant_id = (SELECT current_setting(''app.current_tenant_id'', true)::uuid))
         WITH CHECK (tenant_id = (SELECT current_setting(''app.current_tenant_id'', true)::uuid))',
        p_policy_name, p_table_name
    );
END;
$$ LANGUAGE plpgsql;

-- Apply to core tables (only if they exist and have tenant_id)
DO $$
DECLARE
    tables_to_update TEXT[] := ARRAY[
        'tenants',
        'users', 
        'api_keys',
        'brain_plans',
        'conversations',
        'messages',
        'model_configurations',
        'domain_expertise',
        'learning_events'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables_to_update
    LOOP
        -- Check if table exists and has tenant_id column
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = t AND column_name = 'tenant_id'
        ) THEN
            PERFORM update_rls_policy_optimized(t, 'tenant_isolation_' || t);
            RAISE NOTICE 'Updated RLS policy for table: %', t;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- SECTION 7: Query Performance Hints Table
-- For tracking slow queries and optimization opportunities
-- ============================================================================

CREATE TABLE IF NOT EXISTS query_performance_hints (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    query_digest VARCHAR(64) NOT NULL, -- MD5 of normalized query
    query_sample TEXT,
    table_name VARCHAR(100),
    avg_duration_ms NUMERIC(10,2),
    max_duration_ms NUMERIC(10,2),
    call_count BIGINT DEFAULT 0,
    rows_examined_avg BIGINT,
    rows_returned_avg BIGINT,
    suggested_index TEXT,
    optimization_notes TEXT,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id),
    UNIQUE (query_digest)
);

COMMENT ON TABLE query_performance_hints IS 'Tracks slow queries for optimization';

CREATE INDEX IF NOT EXISTS idx_query_hints_duration
    ON query_performance_hints (avg_duration_ms DESC);

CREATE INDEX IF NOT EXISTS idx_query_hints_table
    ON query_performance_hints (table_name);

-- ============================================================================
-- SECTION 8: Rate Limiting State Table
-- For query-level rate limiting (multi-level: app, connection, query digest)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_state (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    limit_key VARCHAR(255) NOT NULL, -- 'tenant:{id}:query:{digest}' or 'tenant:{id}:connection'
    limit_type VARCHAR(50) NOT NULL, -- 'query', 'connection', 'api'
    window_start TIMESTAMPTZ NOT NULL,
    window_size_seconds INTEGER NOT NULL,
    current_count INTEGER DEFAULT 0,
    max_allowed INTEGER NOT NULL,
    last_request TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (id),
    UNIQUE (limit_key, window_start)
);

COMMENT ON TABLE rate_limit_state IS 'Multi-level rate limiting state';

CREATE INDEX IF NOT EXISTS idx_rate_limit_key
    ON rate_limit_state (limit_key, window_start DESC);

-- Cleanup old rate limit windows
CREATE OR REPLACE FUNCTION cleanup_rate_limit_state()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limit_state
    WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON model_execution_logs TO radiant_app;
GRANT SELECT, INSERT, UPDATE ON prompt_results TO radiant_app;
GRANT SELECT, INSERT, UPDATE ON usage_records TO radiant_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON batch_write_staging TO radiant_app;
GRANT SELECT, INSERT ON connection_pool_metrics TO radiant_app;
GRANT SELECT, INSERT, UPDATE ON query_performance_hints TO radiant_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit_state TO radiant_app;
