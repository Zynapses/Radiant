-- ============================================================================
-- PostgreSQL Scaling Migration Part 4: Strategic Indexes & Query Optimization
-- Version: 5.53.0
-- Date: 2026-01-25
-- 
-- This migration adds:
-- 1. BRIN indexes for time-series data (drastically smaller than B-tree)
-- 2. Partial indexes for hot-path queries
-- 3. Covering indexes to eliminate table lookups
-- 4. GIN indexes for JSONB metadata queries
-- 5. Expression indexes for common computed columns
-- 6. Index maintenance and analysis functions
-- 7. Query plan cache and slow query tracking
-- 8. Connection and query timeout configuration
-- ============================================================================

-- ============================================================================
-- SECTION 1: BRIN Indexes for Time-Series Data
-- BRIN (Block Range Index) - 100x smaller than B-tree for sorted data
-- Perfect for append-only tables like logs where data arrives in time order
-- ============================================================================

-- BRIN index on model execution logs (time-series optimized)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_logs_brin_created
    ON model_execution_logs_partitioned USING BRIN (created_at)
    WITH (pages_per_range = 128);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_logs_part_brin_created
    ON model_execution_logs_partitioned USING BRIN (created_at)
    WITH (pages_per_range = 128);

-- BRIN index on usage records
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_brin_timestamp
    ON usage_records_partitioned USING BRIN (timestamp)
    WITH (pages_per_range = 128);

-- BRIN index on batch write staging
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batch_staging_brin_created
    ON batch_write_staging USING BRIN (created_at)
    WITH (pages_per_range = 64);

-- BRIN index on connection pool metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conn_metrics_brin_timestamp
    ON connection_pool_metrics USING BRIN (timestamp)
    WITH (pages_per_range = 64);

COMMENT ON INDEX idx_model_logs_brin_created IS 
    'BRIN index for efficient time-range scans on model logs. 100x smaller than B-tree.';

-- ============================================================================
-- SECTION 2: Partial Indexes for Hot-Path Queries
-- Index only the subset of data that's frequently queried
-- ============================================================================

-- Recent active model logs (last 24 hours, successful only)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_logs_recent_success
    ON model_execution_logs_partitioned (tenant_id, model_id, created_at DESC)
    WHERE status = 'completed' AND created_at > NOW() - INTERVAL '24 hours';

-- Pending batch writes only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batch_staging_pending
    ON batch_write_staging (created_at, target_table)
    WHERE status = 'pending';

-- Failed batch writes for retry
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batch_staging_failed
    ON batch_write_staging (retry_count, created_at)
    WHERE status = 'failed' AND retry_count < 3;

-- High latency queries for investigation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_logs_slow_queries
    ON model_execution_logs_partitioned (tenant_id, model_id, latency_ms DESC)
    WHERE latency_ms > 5000;  -- > 5 seconds

-- Error logs for debugging
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_logs_errors
    ON model_execution_logs_partitioned (tenant_id, created_at DESC, error_message)
    WHERE status = 'error';

-- Active rate limit windows
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_limit_active
    ON rate_limit_state (limit_key)
    WHERE window_start > NOW() - INTERVAL '1 hour';

COMMENT ON INDEX idx_model_logs_recent_success IS 
    'Partial index for hot-path dashboard queries on recent successful requests.';

-- ============================================================================
-- SECTION 3: Covering Indexes (Index-Only Scans)
-- Include frequently accessed columns to avoid table lookups
-- ============================================================================

-- Dashboard summary queries - token counts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_logs_covering_tokens
    ON model_execution_logs_partitioned (tenant_id, created_at DESC)
    INCLUDE (prompt_tokens, completion_tokens, latency_ms, status);

-- Usage billing queries - cost data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_covering_billing
    ON usage_records_partitioned (tenant_id, timestamp DESC)
    INCLUDE (resource_type, quantity, cost_microcents);

-- Model performance queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_logs_covering_perf
    ON model_execution_logs_partitioned (tenant_id, model_id, created_at DESC)
    INCLUDE (latency_ms, prompt_tokens, completion_tokens, status);

COMMENT ON INDEX idx_model_logs_covering_tokens IS 
    'Covering index enabling index-only scans for dashboard token summaries.';

-- ============================================================================
-- SECTION 4: GIN Indexes for JSONB Metadata Queries
-- Enable efficient queries on metadata fields
-- ============================================================================

-- GIN index on model logs metadata
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_logs_metadata_gin
    ON model_execution_logs_partitioned USING GIN (metadata jsonb_path_ops);

-- GIN index on usage records metadata
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_metadata_gin
    ON usage_records_partitioned USING GIN (metadata jsonb_path_ops);

-- GIN index on prompt results metadata
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_results_metadata_gin
    ON prompt_results USING GIN (metadata jsonb_path_ops);

-- GIN index for array columns (models_used in prompt_results)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prompt_results_models_gin
    ON prompt_results USING GIN (models_used);

COMMENT ON INDEX idx_model_logs_metadata_gin IS 
    'GIN index for efficient JSONB containment queries on metadata.';

-- ============================================================================
-- SECTION 5: Expression Indexes for Computed Columns
-- Pre-compute commonly filtered expressions
-- ============================================================================

-- Date truncation for daily aggregations (avoid computing on every query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_logs_day
    ON model_execution_logs_partitioned ((DATE_TRUNC('day', created_at)), tenant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_day
    ON usage_records_partitioned ((DATE_TRUNC('day', timestamp)), tenant_id);

-- Hour truncation for hourly dashboards
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_logs_hour
    ON model_execution_logs_partitioned ((DATE_TRUNC('hour', created_at)), tenant_id);

-- Lowercase model_id for case-insensitive lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_logs_model_lower
    ON model_execution_logs_partitioned (tenant_id, (LOWER(model_id)));

-- Total tokens expression (for sorting by total token usage)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_model_logs_total_tokens
    ON model_execution_logs_partitioned (tenant_id, (prompt_tokens + completion_tokens) DESC);

COMMENT ON INDEX idx_model_logs_day IS 
    'Expression index for pre-computed daily aggregation grouping.';

-- ============================================================================
-- SECTION 6: Slow Query Tracking & Analysis
-- ============================================================================

-- Slow query log table with automatic capture
CREATE TABLE IF NOT EXISTS slow_query_log (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    query_hash VARCHAR(64) NOT NULL,
    query_text TEXT,
    duration_ms NUMERIC(12,2) NOT NULL,
    rows_examined BIGINT,
    rows_returned BIGINT,
    tenant_id UUID,
    user_id UUID,
    execution_plan TEXT,
    wait_events JSONB DEFAULT '{}',
    io_timing JSONB DEFAULT '{}',
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_slow_query_log_duration
    ON slow_query_log (duration_ms DESC, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_slow_query_log_hash
    ON slow_query_log (query_hash, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_slow_query_log_tenant
    ON slow_query_log (tenant_id, captured_at DESC);

COMMENT ON TABLE slow_query_log IS 'Captured slow queries for performance analysis';

-- Function to log slow queries (called from application or pg_stat_statements)
CREATE OR REPLACE FUNCTION log_slow_query(
    p_query_text TEXT,
    p_duration_ms NUMERIC,
    p_rows_examined BIGINT DEFAULT NULL,
    p_rows_returned BIGINT DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL,
    p_execution_plan TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_hash VARCHAR(64);
BEGIN
    -- Generate hash of normalized query
    v_hash := MD5(REGEXP_REPLACE(p_query_text, '\s+', ' ', 'g'));
    
    INSERT INTO slow_query_log (
        query_hash, query_text, duration_ms, rows_examined, 
        rows_returned, tenant_id, execution_plan
    ) VALUES (
        v_hash, LEFT(p_query_text, 10000), p_duration_ms, 
        p_rows_examined, p_rows_returned, p_tenant_id, p_execution_plan
    ) RETURNING id INTO v_id;
    
    -- Update query_performance_hints with aggregated stats
    INSERT INTO query_performance_hints (
        query_digest, query_sample, avg_duration_ms, max_duration_ms,
        call_count, rows_examined_avg, rows_returned_avg
    ) VALUES (
        v_hash, LEFT(p_query_text, 5000), p_duration_ms, p_duration_ms,
        1, p_rows_examined, p_rows_returned
    )
    ON CONFLICT (query_digest) DO UPDATE SET
        avg_duration_ms = (query_performance_hints.avg_duration_ms * query_performance_hints.call_count + p_duration_ms) 
                          / (query_performance_hints.call_count + 1),
        max_duration_ms = GREATEST(query_performance_hints.max_duration_ms, p_duration_ms),
        call_count = query_performance_hints.call_count + 1,
        rows_examined_avg = COALESCE(
            (query_performance_hints.rows_examined_avg * query_performance_hints.call_count + COALESCE(p_rows_examined, 0))
            / (query_performance_hints.call_count + 1),
            p_rows_examined
        ),
        last_seen = NOW();
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 7: Index Health Monitoring
-- ============================================================================

-- Table to track index usage and bloat
CREATE TABLE IF NOT EXISTS index_health_metrics (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    index_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    index_size_bytes BIGINT,
    index_scans BIGINT,
    tuples_read BIGINT,
    tuples_fetched BIGINT,
    bloat_ratio NUMERIC(5,2),
    last_used TIMESTAMPTZ,
    recommendation TEXT,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_index_health_unique
    ON index_health_metrics (index_name, captured_at);

-- Function to analyze index health
CREATE OR REPLACE FUNCTION analyze_index_health()
RETURNS TABLE(
    index_name TEXT,
    table_name TEXT,
    index_size TEXT,
    index_scans BIGINT,
    usage_ratio NUMERIC,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.indexrelname::TEXT,
        i.relname::TEXT,
        pg_size_pretty(pg_relation_size(i.indexrelid)),
        i.idx_scan,
        CASE 
            WHEN i.idx_scan = 0 THEN 0
            ELSE ROUND(i.idx_tup_read::NUMERIC / NULLIF(i.idx_scan, 0), 2)
        END,
        CASE
            WHEN i.idx_scan = 0 AND pg_relation_size(i.indexrelid) > 10485760 
                THEN 'UNUSED: Consider dropping (> 10MB, 0 scans)'
            WHEN i.idx_scan < 100 AND pg_relation_size(i.indexrelid) > 104857600 
                THEN 'LOW USAGE: Review necessity (> 100MB, < 100 scans)'
            WHEN i.idx_tup_read::NUMERIC / NULLIF(i.idx_scan, 0) > 10000 
                THEN 'INEFFICIENT: High tuples per scan, consider narrower index'
            ELSE 'OK'
        END
    FROM pg_stat_user_indexes i
    WHERE i.schemaname = 'public'
    ORDER BY pg_relation_size(i.indexrelid) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to suggest missing indexes based on slow queries
CREATE OR REPLACE FUNCTION suggest_indexes()
RETURNS TABLE(
    table_name TEXT,
    column_suggestion TEXT,
    query_count BIGINT,
    avg_duration_ms NUMERIC,
    priority TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qph.table_name,
        qph.suggested_index,
        qph.call_count,
        qph.avg_duration_ms,
        CASE
            WHEN qph.avg_duration_ms > 1000 AND qph.call_count > 100 THEN 'HIGH'
            WHEN qph.avg_duration_ms > 500 AND qph.call_count > 50 THEN 'MEDIUM'
            ELSE 'LOW'
        END
    FROM query_performance_hints qph
    WHERE qph.suggested_index IS NOT NULL
    ORDER BY qph.avg_duration_ms * qph.call_count DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 8: Connection and Query Timeout Configuration
-- ============================================================================

-- Connection pool configuration table
CREATE TABLE IF NOT EXISTS connection_pool_config (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    pool_name VARCHAR(100) NOT NULL,
    min_connections INTEGER DEFAULT 5,
    max_connections INTEGER DEFAULT 100,
    connection_timeout_ms INTEGER DEFAULT 30000,  -- 30 seconds
    idle_timeout_ms INTEGER DEFAULT 600000,       -- 10 minutes
    max_lifetime_ms INTEGER DEFAULT 1800000,      -- 30 minutes
    statement_timeout_ms INTEGER DEFAULT 60000,   -- 1 minute
    lock_timeout_ms INTEGER DEFAULT 10000,        -- 10 seconds
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id),
    UNIQUE (pool_name)
);

-- Default pool configurations
INSERT INTO connection_pool_config (pool_name, min_connections, max_connections, statement_timeout_ms, lock_timeout_ms)
VALUES 
    ('default', 10, 100, 60000, 10000),
    ('batch_writer', 5, 20, 120000, 30000),
    ('analytics', 2, 10, 300000, 60000),
    ('admin', 2, 10, 30000, 5000)
ON CONFLICT (pool_name) DO NOTHING;

-- Function to get optimal timeout settings based on query type
CREATE OR REPLACE FUNCTION get_query_timeout(p_query_type TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_timeout INTEGER;
BEGIN
    CASE p_query_type
        WHEN 'realtime' THEN v_timeout := 5000;      -- 5 seconds
        WHEN 'dashboard' THEN v_timeout := 15000;    -- 15 seconds
        WHEN 'report' THEN v_timeout := 60000;       -- 1 minute
        WHEN 'batch' THEN v_timeout := 300000;       -- 5 minutes
        WHEN 'migration' THEN v_timeout := 3600000;  -- 1 hour
        ELSE v_timeout := 30000;                     -- 30 seconds default
    END CASE;
    
    RETURN v_timeout;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- SECTION 9: Query Statistics Functions
-- ============================================================================

-- Get table statistics for capacity planning
CREATE OR REPLACE FUNCTION get_table_statistics()
RETURNS TABLE(
    table_name TEXT,
    row_count BIGINT,
    total_size TEXT,
    index_size TEXT,
    toast_size TEXT,
    rows_inserted BIGINT,
    rows_updated BIGINT,
    rows_deleted BIGINT,
    last_vacuum TIMESTAMPTZ,
    last_analyze TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.relname::TEXT,
        COALESCE(s.n_live_tup, 0),
        pg_size_pretty(pg_total_relation_size(t.oid)),
        pg_size_pretty(pg_indexes_size(t.oid)),
        pg_size_pretty(pg_total_relation_size(t.oid) - pg_relation_size(t.oid) - pg_indexes_size(t.oid)),
        COALESCE(s.n_tup_ins, 0),
        COALESCE(s.n_tup_upd, 0),
        COALESCE(s.n_tup_del, 0),
        s.last_vacuum,
        s.last_analyze
    FROM pg_class t
    LEFT JOIN pg_stat_user_tables s ON t.relname = s.relname
    WHERE t.relkind = 'r'
    AND t.relnamespace = 'public'::regnamespace
    ORDER BY pg_total_relation_size(t.oid) DESC;
END;
$$ LANGUAGE plpgsql;

-- Get query patterns by tenant for optimization targeting
CREATE OR REPLACE FUNCTION get_tenant_query_patterns(p_tenant_id UUID)
RETURNS TABLE(
    query_type TEXT,
    query_count BIGINT,
    avg_duration_ms NUMERIC,
    total_duration_ms NUMERIC,
    optimization_opportunity TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE
            WHEN sq.query_text ILIKE '%SELECT%FROM%model_execution_logs%' THEN 'model_logs_read'
            WHEN sq.query_text ILIKE '%INSERT%INTO%model_execution_logs%' THEN 'model_logs_write'
            WHEN sq.query_text ILIKE '%SELECT%FROM%usage_records%' THEN 'usage_read'
            WHEN sq.query_text ILIKE '%INSERT%INTO%usage_records%' THEN 'usage_write'
            WHEN sq.query_text ILIKE '%SELECT%FROM%mv_%' THEN 'materialized_view'
            ELSE 'other'
        END,
        COUNT(*),
        AVG(sq.duration_ms),
        SUM(sq.duration_ms),
        CASE
            WHEN AVG(sq.duration_ms) > 1000 THEN 'HIGH: Consider caching or query optimization'
            WHEN AVG(sq.duration_ms) > 500 THEN 'MEDIUM: Review indexes and query plan'
            WHEN COUNT(*) > 1000 THEN 'VOLUME: Consider batching or rate limiting'
            ELSE 'OK'
        END
    FROM slow_query_log sq
    WHERE sq.tenant_id = p_tenant_id
    AND sq.captured_at > NOW() - INTERVAL '24 hours'
    GROUP BY 1
    ORDER BY SUM(sq.duration_ms) DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 10: Vacuum and Maintenance Scheduling
-- ============================================================================

-- Table to track maintenance operations
CREATE TABLE IF NOT EXISTS maintenance_log (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    operation_type TEXT NOT NULL,  -- 'vacuum', 'analyze', 'reindex', 'partition_create'
    table_name TEXT,
    partition_name TEXT,
    duration_ms NUMERIC,
    rows_affected BIGINT,
    dead_tuples_removed BIGINT,
    status TEXT NOT NULL,  -- 'success', 'failed', 'skipped'
    error_message TEXT,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_log_type
    ON maintenance_log (operation_type, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_maintenance_log_table
    ON maintenance_log (table_name, executed_at DESC);

-- Function to perform scheduled maintenance
CREATE OR REPLACE FUNCTION perform_scheduled_maintenance()
RETURNS TABLE(operation TEXT, table_name TEXT, status TEXT, duration_ms NUMERIC) AS $$
DECLARE
    v_start TIMESTAMPTZ;
    v_table RECORD;
    v_duration NUMERIC;
BEGIN
    -- Vacuum high-churn tables
    FOR v_table IN 
        SELECT relname FROM pg_stat_user_tables 
        WHERE n_dead_tup > 10000 
        ORDER BY n_dead_tup DESC 
        LIMIT 5
    LOOP
        v_start := clock_timestamp();
        BEGIN
            EXECUTE format('VACUUM (VERBOSE, ANALYZE) %I', v_table.relname);
            v_duration := EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;
            
            INSERT INTO maintenance_log (operation_type, table_name, duration_ms, status)
            VALUES ('vacuum_analyze', v_table.relname, v_duration, 'success');
            
            operation := 'vacuum_analyze';
            table_name := v_table.relname;
            status := 'success';
            duration_ms := v_duration;
            RETURN NEXT;
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO maintenance_log (operation_type, table_name, status, error_message)
            VALUES ('vacuum_analyze', v_table.relname, 'failed', SQLERRM);
            
            operation := 'vacuum_analyze';
            table_name := v_table.relname;
            status := 'failed: ' || SQLERRM;
            duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start)) * 1000;
            RETURN NEXT;
        END;
    END LOOP;
    
    -- Ensure future partitions exist
    PERFORM ensure_future_partitions(3);
    
    -- Cleanup old batch staging
    PERFORM cleanup_batch_write_staging();
    
    -- Cleanup old rate limit state
    PERFORM cleanup_rate_limit_state();
    
    -- Log completion
    INSERT INTO maintenance_log (operation_type, status)
    VALUES ('scheduled_maintenance', 'success');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT ON slow_query_log TO radiant_app;
GRANT SELECT, INSERT ON index_health_metrics TO radiant_app;
GRANT SELECT ON connection_pool_config TO radiant_app;
GRANT SELECT, INSERT ON maintenance_log TO radiant_app;

GRANT EXECUTE ON FUNCTION log_slow_query TO radiant_app;
GRANT EXECUTE ON FUNCTION analyze_index_health TO radiant_app;
GRANT EXECUTE ON FUNCTION suggest_indexes TO radiant_app;
GRANT EXECUTE ON FUNCTION get_query_timeout TO radiant_app;
GRANT EXECUTE ON FUNCTION get_table_statistics TO radiant_app;
GRANT EXECUTE ON FUNCTION get_tenant_query_patterns TO radiant_app;
GRANT EXECUTE ON FUNCTION perform_scheduled_maintenance TO radiant_app;
