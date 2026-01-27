-- ============================================================================
-- PostgreSQL Scaling Migration Part 2: Time-Based Partitioning
-- Version: 5.53.0
-- Date: 2026-01-25
-- 
-- Partitioning strategy for time-series data at scale.
-- Model execution logs and usage records are append-heavy.
-- Native PostgreSQL partitioning dramatically improves:
-- - Query performance (partition pruning)
-- - Data lifecycle management (drop old partitions)
-- - Vacuum/maintenance efficiency
-- ============================================================================

-- ============================================================================
-- SECTION 1: Partitioned Model Execution Logs
-- Monthly partitions for efficient time-range queries and archival
-- ============================================================================

-- Create the partitioned table
CREATE TABLE IF NOT EXISTS model_execution_logs_partitioned (
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
    
    -- Composite primary key includes partition key (created_at)
    PRIMARY KEY (tenant_id, id, created_at)
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE model_execution_logs_partitioned IS 'Partitioned model execution logs for time-series queries';

-- Create partitions for current and future months
-- 2025 Q4
CREATE TABLE IF NOT EXISTS model_logs_2025_10 PARTITION OF model_execution_logs_partitioned
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS model_logs_2025_11 PARTITION OF model_execution_logs_partitioned
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS model_logs_2025_12 PARTITION OF model_execution_logs_partitioned
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- 2026 Full Year
CREATE TABLE IF NOT EXISTS model_logs_2026_01 PARTITION OF model_execution_logs_partitioned
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS model_logs_2026_02 PARTITION OF model_execution_logs_partitioned
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS model_logs_2026_03 PARTITION OF model_execution_logs_partitioned
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS model_logs_2026_04 PARTITION OF model_execution_logs_partitioned
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS model_logs_2026_05 PARTITION OF model_execution_logs_partitioned
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS model_logs_2026_06 PARTITION OF model_execution_logs_partitioned
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS model_logs_2026_07 PARTITION OF model_execution_logs_partitioned
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS model_logs_2026_08 PARTITION OF model_execution_logs_partitioned
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS model_logs_2026_09 PARTITION OF model_execution_logs_partitioned
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS model_logs_2026_10 PARTITION OF model_execution_logs_partitioned
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS model_logs_2026_11 PARTITION OF model_execution_logs_partitioned
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS model_logs_2026_12 PARTITION OF model_execution_logs_partitioned
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Default partition for unexpected dates
CREATE TABLE IF NOT EXISTS model_logs_default PARTITION OF model_execution_logs_partitioned DEFAULT;

-- Indexes on the partitioned table (created on each partition automatically)
CREATE INDEX IF NOT EXISTS idx_model_logs_part_tenant_created 
    ON model_execution_logs_partitioned (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_model_logs_part_tenant_request
    ON model_execution_logs_partitioned (tenant_id, request_id);

CREATE INDEX IF NOT EXISTS idx_model_logs_part_tenant_model
    ON model_execution_logs_partitioned (tenant_id, model_id, created_at DESC);

-- Enable RLS on partitioned table
ALTER TABLE model_execution_logs_partitioned ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_execution_logs_partitioned FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_model_logs_part ON model_execution_logs_partitioned;
CREATE POLICY tenant_isolation_model_logs_part ON model_execution_logs_partitioned
    USING (tenant_id = (SELECT current_setting('app.current_tenant_id', true)::uuid))
    WITH CHECK (tenant_id = (SELECT current_setting('app.current_tenant_id', true)::uuid));

-- ============================================================================
-- SECTION 2: Partitioned Usage Records
-- Monthly partitions for billing aggregation
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_records_partitioned (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100),
    quantity BIGINT NOT NULL,
    unit VARCHAR(20) NOT NULL,
    cost_microcents BIGINT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    
    PRIMARY KEY (tenant_id, id, timestamp)
) PARTITION BY RANGE (timestamp);

COMMENT ON TABLE usage_records_partitioned IS 'Partitioned usage records for billing';

-- Create partitions for 2026
CREATE TABLE IF NOT EXISTS usage_2026_01 PARTITION OF usage_records_partitioned
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS usage_2026_02 PARTITION OF usage_records_partitioned
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS usage_2026_03 PARTITION OF usage_records_partitioned
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS usage_2026_04 PARTITION OF usage_records_partitioned
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS usage_2026_05 PARTITION OF usage_records_partitioned
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS usage_2026_06 PARTITION OF usage_records_partitioned
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS usage_2026_07 PARTITION OF usage_records_partitioned
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS usage_2026_08 PARTITION OF usage_records_partitioned
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS usage_2026_09 PARTITION OF usage_records_partitioned
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS usage_2026_10 PARTITION OF usage_records_partitioned
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS usage_2026_11 PARTITION OF usage_records_partitioned
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS usage_2026_12 PARTITION OF usage_records_partitioned
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE TABLE IF NOT EXISTS usage_default PARTITION OF usage_records_partitioned DEFAULT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_usage_part_tenant_timestamp
    ON usage_records_partitioned (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_usage_part_tenant_resource
    ON usage_records_partitioned (tenant_id, resource_type, timestamp DESC);

-- Enable RLS
ALTER TABLE usage_records_partitioned ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records_partitioned FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_usage_part ON usage_records_partitioned;
CREATE POLICY tenant_isolation_usage_part ON usage_records_partitioned
    USING (tenant_id = (SELECT current_setting('app.current_tenant_id', true)::uuid))
    WITH CHECK (tenant_id = (SELECT current_setting('app.current_tenant_id', true)::uuid));

-- ============================================================================
-- SECTION 3: Automated Partition Management Functions
-- ============================================================================

-- Function to create next month's partition
CREATE OR REPLACE FUNCTION create_monthly_partition(
    p_table_name TEXT,
    p_partition_prefix TEXT
) RETURNS TEXT AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    -- Create partition for next month
    partition_date := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
    partition_name := p_partition_prefix || '_' || TO_CHAR(partition_date, 'YYYY_MM');
    start_date := TO_CHAR(partition_date, 'YYYY-MM-DD');
    end_date := TO_CHAR(partition_date + INTERVAL '1 month', 'YYYY-MM-DD');
    
    -- Check if partition already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I 
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, p_table_name, start_date, end_date
        );
        RETURN 'Created partition: ' || partition_name;
    ELSE
        RETURN 'Partition already exists: ' || partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create partitions for multiple months ahead
CREATE OR REPLACE FUNCTION ensure_future_partitions(
    p_months_ahead INTEGER DEFAULT 3
) RETURNS TABLE(partition_name TEXT, status TEXT) AS $$
DECLARE
    i INTEGER;
    result_model TEXT;
    result_usage TEXT;
BEGIN
    FOR i IN 1..p_months_ahead LOOP
        -- Model logs partitions
        SELECT create_monthly_partition(
            'model_execution_logs_partitioned', 
            'model_logs'
        ) INTO result_model;
        
        -- Usage partitions
        SELECT create_monthly_partition(
            'usage_records_partitioned',
            'usage'
        ) INTO result_usage;
        
        partition_name := 'model_logs_' || TO_CHAR(DATE_TRUNC('month', NOW() + (i || ' months')::INTERVAL), 'YYYY_MM');
        status := result_model;
        RETURN NEXT;
        
        partition_name := 'usage_' || TO_CHAR(DATE_TRUNC('month', NOW() + (i || ' months')::INTERVAL), 'YYYY_MM');
        status := result_usage;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to archive old partitions (detach, not drop)
CREATE OR REPLACE FUNCTION archive_old_partition(
    p_table_name TEXT,
    p_partition_name TEXT,
    p_archive_schema TEXT DEFAULT 'archive'
) RETURNS TEXT AS $$
BEGIN
    -- Create archive schema if not exists
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', p_archive_schema);
    
    -- Detach partition
    EXECUTE format(
        'ALTER TABLE %I DETACH PARTITION %I',
        p_table_name, p_partition_name
    );
    
    -- Move to archive schema
    EXECUTE format(
        'ALTER TABLE %I SET SCHEMA %I',
        p_partition_name, p_archive_schema
    );
    
    RETURN 'Archived partition: ' || p_partition_name || ' to schema: ' || p_archive_schema;
END;
$$ LANGUAGE plpgsql;

-- Function to get partition statistics
CREATE OR REPLACE FUNCTION get_partition_stats(p_table_name TEXT)
RETURNS TABLE(
    partition_name TEXT,
    row_count BIGINT,
    total_size TEXT,
    index_size TEXT,
    min_date TIMESTAMPTZ,
    max_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        child.relname::TEXT as partition_name,
        pg_stat_user_tables.n_live_tup as row_count,
        pg_size_pretty(pg_table_size(child.oid)) as total_size,
        pg_size_pretty(pg_indexes_size(child.oid)) as index_size,
        NULL::TIMESTAMPTZ as min_date,
        NULL::TIMESTAMPTZ as max_date
    FROM pg_inherits
    JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
    JOIN pg_class child ON pg_inherits.inhrelid = child.oid
    LEFT JOIN pg_stat_user_tables ON child.relname = pg_stat_user_tables.relname
    WHERE parent.relname = p_table_name
    ORDER BY child.relname;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 4: Data Migration View (for gradual migration)
-- ============================================================================

-- View that unions old and new tables during migration period
CREATE OR REPLACE VIEW v_model_execution_logs AS
SELECT * FROM model_execution_logs_partitioned
UNION ALL
SELECT 
    id, tenant_id, request_id, user_id, model_id, model_provider,
    prompt_tokens, completion_tokens, total_tokens, latency_ms,
    response_hash, status, error_message, metadata, created_at
FROM model_execution_logs
WHERE NOT EXISTS (
    SELECT 1 FROM model_execution_logs_partitioned p
    WHERE p.id = model_execution_logs.id 
    AND p.tenant_id = model_execution_logs.tenant_id
);

CREATE OR REPLACE VIEW v_usage_records AS
SELECT * FROM usage_records_partitioned
UNION ALL
SELECT * FROM usage_records
WHERE NOT EXISTS (
    SELECT 1 FROM usage_records_partitioned p
    WHERE p.id = usage_records.id 
    AND p.tenant_id = usage_records.tenant_id
);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON model_execution_logs_partitioned TO radiant_app;
GRANT SELECT, INSERT, UPDATE ON usage_records_partitioned TO radiant_app;
GRANT SELECT ON v_model_execution_logs TO radiant_app;
GRANT SELECT ON v_usage_records TO radiant_app;
GRANT EXECUTE ON FUNCTION create_monthly_partition TO radiant_app;
GRANT EXECUTE ON FUNCTION ensure_future_partitions TO radiant_app;
GRANT EXECUTE ON FUNCTION get_partition_stats TO radiant_app;
