-- ============================================================================
-- PostgreSQL Scaling Migration Part 5: Read Replica Routing & Hot/Cold Path
-- Version: 5.53.0
-- Date: 2026-01-25
-- 
-- Implements intelligent query routing:
-- 1. Read replica routing for read-heavy workloads
-- 2. Hot/Cold path separation for time-series data
-- 3. Connection affinity for session consistency
-- 4. Failover configuration
-- ============================================================================

-- ============================================================================
-- SECTION 1: Read Replica Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS read_replica_config (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    replica_name VARCHAR(100) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    region VARCHAR(50),
    availability_zone VARCHAR(50),
    replica_lag_threshold_ms INTEGER DEFAULT 1000,  -- Max acceptable lag
    weight INTEGER DEFAULT 100,  -- Load balancing weight (0-100)
    is_primary BOOLEAN DEFAULT FALSE,
    is_healthy BOOLEAN DEFAULT TRUE,
    health_check_interval_seconds INTEGER DEFAULT 30,
    last_health_check TIMESTAMPTZ,
    last_lag_ms INTEGER,
    query_types TEXT[] DEFAULT ARRAY['read'],  -- 'read', 'analytics', 'reporting'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id),
    UNIQUE (replica_name)
);

COMMENT ON TABLE read_replica_config IS 'Configuration for Aurora read replicas and routing';

-- Default configuration
INSERT INTO read_replica_config (replica_name, endpoint, is_primary, query_types)
VALUES 
    ('primary', '{{PRIMARY_ENDPOINT}}', TRUE, ARRAY['write', 'read']),
    ('reader-1', '{{READER_ENDPOINT}}', FALSE, ARRAY['read', 'analytics']),
    ('reader-2', '{{READER_ENDPOINT}}', FALSE, ARRAY['read', 'reporting'])
ON CONFLICT (replica_name) DO NOTHING;

-- ============================================================================
-- SECTION 2: Query Routing Rules
-- ============================================================================

CREATE TABLE IF NOT EXISTS query_routing_rules (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    rule_name VARCHAR(100) NOT NULL,
    priority INTEGER DEFAULT 100,  -- Lower = higher priority
    
    -- Match conditions
    query_pattern TEXT,           -- Regex pattern for query matching
    table_patterns TEXT[],        -- Tables this rule applies to
    query_type VARCHAR(20),       -- 'select', 'insert', 'update', 'delete'
    tenant_ids UUID[],            -- Specific tenants (NULL = all)
    
    -- Routing decision
    target_type VARCHAR(20) NOT NULL,  -- 'primary', 'replica', 'any_replica', 'weighted'
    target_replicas TEXT[],       -- Specific replica names
    
    -- Consistency requirements
    require_primary_for_seconds INTEGER DEFAULT 0,  -- Read-after-write: route to primary for N seconds
    max_replica_lag_ms INTEGER DEFAULT 1000,        -- Max acceptable lag
    
    -- Circuit breaker
    error_threshold INTEGER DEFAULT 5,              -- Errors before fallback
    error_window_seconds INTEGER DEFAULT 60,
    fallback_target VARCHAR(20) DEFAULT 'primary',
    
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id),
    UNIQUE (rule_name)
);

COMMENT ON TABLE query_routing_rules IS 'Rules for intelligent query routing to replicas';

-- Default routing rules
INSERT INTO query_routing_rules (rule_name, priority, query_type, target_type, require_primary_for_seconds) VALUES
    -- All writes go to primary
    ('writes_to_primary', 10, 'insert', 'primary', 0),
    ('updates_to_primary', 10, 'update', 'primary', 0),
    ('deletes_to_primary', 10, 'delete', 'primary', 0),
    
    -- Recent data reads go to primary (read-after-write consistency)
    ('recent_reads_primary', 20, 'select', 'primary', 5),
    
    -- Dashboard queries to replicas
    ('dashboard_reads', 50, 'select', 'any_replica', 0),
    
    -- Analytics queries to dedicated replica
    ('analytics_queries', 60, 'select', 'replica', 0),
    
    -- Materialized view reads to any replica
    ('mv_reads', 70, 'select', 'any_replica', 0)
ON CONFLICT (rule_name) DO NOTHING;

-- Update analytics rule with specific replicas
UPDATE query_routing_rules 
SET target_replicas = ARRAY['reader-1'], table_patterns = ARRAY['mv_%', 'slow_query_log']
WHERE rule_name = 'analytics_queries';

-- ============================================================================
-- SECTION 3: Hot/Cold Path Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS hot_cold_path_config (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    
    -- Hot path (recent data - fast SSD storage)
    hot_threshold_hours INTEGER DEFAULT 24,
    hot_storage_class VARCHAR(50) DEFAULT 'io1',  -- Aurora storage class
    hot_read_iops INTEGER DEFAULT 10000,
    
    -- Warm path (7-90 days - standard storage)
    warm_threshold_days INTEGER DEFAULT 90,
    warm_storage_class VARCHAR(50) DEFAULT 'gp3',
    
    -- Cold path (archive - S3/Glacier)
    cold_archive_enabled BOOLEAN DEFAULT TRUE,
    cold_archive_bucket VARCHAR(255),
    cold_archive_prefix VARCHAR(255),
    cold_compression VARCHAR(20) DEFAULT 'gzip',
    cold_retention_years INTEGER DEFAULT 7,
    
    -- Tiering policies
    auto_tier_enabled BOOLEAN DEFAULT TRUE,
    tier_schedule VARCHAR(50) DEFAULT 'daily',  -- 'hourly', 'daily', 'weekly'
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id),
    UNIQUE (table_name)
);

COMMENT ON TABLE hot_cold_path_config IS 'Configuration for hot/warm/cold data tiering';

-- Default hot/cold configurations
INSERT INTO hot_cold_path_config (table_name, hot_threshold_hours, warm_threshold_days, cold_archive_enabled) VALUES
    ('model_execution_logs_partitioned', 24, 90, TRUE),
    ('usage_records_partitioned', 72, 180, TRUE),
    ('slow_query_log', 168, 30, FALSE),
    ('connection_pool_metrics', 24, 7, FALSE)
ON CONFLICT (table_name) DO NOTHING;

-- ============================================================================
-- SECTION 4: Session Affinity for Read-After-Write Consistency
-- ============================================================================

CREATE TABLE IF NOT EXISTS session_write_tracker (
    session_id VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL,
    table_name TEXT NOT NULL,
    last_write_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    write_lsn pg_lsn,  -- PostgreSQL Log Sequence Number for precise consistency
    
    PRIMARY KEY (session_id, table_name)
);

CREATE INDEX IF NOT EXISTS idx_session_write_tracker_expiry
    ON session_write_tracker (last_write_at)
    WHERE last_write_at > NOW() - INTERVAL '1 minute';

COMMENT ON TABLE session_write_tracker IS 'Tracks recent writes per session for read-after-write consistency';

-- Function to record a write for session affinity
CREATE OR REPLACE FUNCTION record_session_write(
    p_session_id VARCHAR(255),
    p_tenant_id UUID,
    p_table_name TEXT
) RETURNS void AS $$
BEGIN
    INSERT INTO session_write_tracker (session_id, tenant_id, table_name, last_write_at, write_lsn)
    VALUES (p_session_id, p_tenant_id, p_table_name, NOW(), pg_current_wal_lsn())
    ON CONFLICT (session_id, table_name) DO UPDATE SET
        last_write_at = NOW(),
        write_lsn = pg_current_wal_lsn();
END;
$$ LANGUAGE plpgsql;

-- Function to check if session needs primary (had recent write)
CREATE OR REPLACE FUNCTION session_needs_primary(
    p_session_id VARCHAR(255),
    p_table_name TEXT,
    p_consistency_window_seconds INTEGER DEFAULT 5
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM session_write_tracker
        WHERE session_id = p_session_id
        AND table_name = p_table_name
        AND last_write_at > NOW() - (p_consistency_window_seconds || ' seconds')::INTERVAL
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Cleanup old session write records
CREATE OR REPLACE FUNCTION cleanup_session_write_tracker()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM session_write_tracker
    WHERE last_write_at < NOW() - INTERVAL '5 minutes';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 5: Replica Health Monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS replica_health_history (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    replica_name VARCHAR(100) NOT NULL,
    check_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_healthy BOOLEAN NOT NULL,
    replica_lag_ms INTEGER,
    connections_active INTEGER,
    connections_idle INTEGER,
    cpu_percent NUMERIC(5,2),
    memory_percent NUMERIC(5,2),
    iops_read INTEGER,
    iops_write INTEGER,
    error_message TEXT,
    
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_replica_health_name_time
    ON replica_health_history (replica_name, check_time DESC);

-- Partition by month for efficient cleanup
-- (In production, this would be partitioned similarly to other tables)

COMMENT ON TABLE replica_health_history IS 'Historical health metrics for read replicas';

-- Function to record replica health check
CREATE OR REPLACE FUNCTION record_replica_health(
    p_replica_name VARCHAR(100),
    p_is_healthy BOOLEAN,
    p_lag_ms INTEGER DEFAULT NULL,
    p_connections_active INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
    -- Record history
    INSERT INTO replica_health_history (
        replica_name, is_healthy, replica_lag_ms, 
        connections_active, error_message
    ) VALUES (
        p_replica_name, p_is_healthy, p_lag_ms,
        p_connections_active, p_error_message
    );
    
    -- Update current status
    UPDATE read_replica_config SET
        is_healthy = p_is_healthy,
        last_health_check = NOW(),
        last_lag_ms = COALESCE(p_lag_ms, last_lag_ms),
        updated_at = NOW()
    WHERE replica_name = p_replica_name;
END;
$$ LANGUAGE plpgsql;

-- Function to get best replica for a query type
CREATE OR REPLACE FUNCTION get_best_replica(
    p_query_type TEXT DEFAULT 'read',
    p_max_lag_ms INTEGER DEFAULT 1000
) RETURNS TABLE(
    replica_name VARCHAR(100),
    endpoint VARCHAR(255),
    current_lag_ms INTEGER,
    weight INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.replica_name,
        r.endpoint,
        r.last_lag_ms,
        r.weight
    FROM read_replica_config r
    WHERE r.is_healthy = TRUE
    AND (r.last_lag_ms IS NULL OR r.last_lag_ms <= p_max_lag_ms)
    AND p_query_type = ANY(r.query_types)
    ORDER BY 
        r.last_lag_ms NULLS FIRST,
        r.weight DESC
    LIMIT 3;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- SECTION 6: Query Routing Decision Function
-- ============================================================================

CREATE OR REPLACE FUNCTION route_query(
    p_query_type VARCHAR(20),
    p_table_name TEXT,
    p_session_id VARCHAR(255) DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL
) RETURNS TABLE(
    target_endpoint VARCHAR(255),
    target_replica VARCHAR(100),
    routing_reason TEXT,
    consistency_mode TEXT
) AS $$
DECLARE
    v_rule query_routing_rules%ROWTYPE;
    v_needs_primary BOOLEAN := FALSE;
    v_replica RECORD;
BEGIN
    -- Check session affinity first
    IF p_session_id IS NOT NULL THEN
        SELECT session_needs_primary(p_session_id, p_table_name, 5) INTO v_needs_primary;
        IF v_needs_primary THEN
            SELECT r.endpoint, r.replica_name INTO target_endpoint, target_replica
            FROM read_replica_config r WHERE r.is_primary = TRUE LIMIT 1;
            
            routing_reason := 'Read-after-write consistency (session affinity)';
            consistency_mode := 'strong';
            RETURN NEXT;
            RETURN;
        END IF;
    END IF;
    
    -- Find matching routing rule
    SELECT * INTO v_rule
    FROM query_routing_rules
    WHERE is_enabled = TRUE
    AND (query_type IS NULL OR query_type = p_query_type)
    AND (table_patterns IS NULL OR 
         EXISTS (SELECT 1 FROM unnest(table_patterns) tp WHERE p_table_name LIKE tp))
    AND (tenant_ids IS NULL OR p_tenant_id = ANY(tenant_ids))
    ORDER BY priority
    LIMIT 1;
    
    -- Apply routing decision
    IF v_rule.target_type = 'primary' OR v_rule IS NULL THEN
        SELECT r.endpoint, r.replica_name INTO target_endpoint, target_replica
        FROM read_replica_config r WHERE r.is_primary = TRUE LIMIT 1;
        
        routing_reason := COALESCE('Rule: ' || v_rule.rule_name, 'Default to primary');
        consistency_mode := 'strong';
        
    ELSIF v_rule.target_type = 'any_replica' THEN
        SELECT r.endpoint, r.replica_name INTO target_endpoint, target_replica
        FROM get_best_replica('read', v_rule.max_replica_lag_ms) r
        LIMIT 1;
        
        routing_reason := 'Rule: ' || v_rule.rule_name || ' (load balanced)';
        consistency_mode := 'eventual';
        
    ELSIF v_rule.target_type = 'replica' AND v_rule.target_replicas IS NOT NULL THEN
        SELECT r.endpoint, r.replica_name INTO target_endpoint, target_replica
        FROM read_replica_config r
        WHERE r.replica_name = ANY(v_rule.target_replicas)
        AND r.is_healthy = TRUE
        ORDER BY r.last_lag_ms NULLS FIRST
        LIMIT 1;
        
        routing_reason := 'Rule: ' || v_rule.rule_name || ' (dedicated replica)';
        consistency_mode := 'eventual';
    END IF;
    
    -- Fallback to primary if no healthy replica found
    IF target_endpoint IS NULL THEN
        SELECT r.endpoint, r.replica_name INTO target_endpoint, target_replica
        FROM read_replica_config r WHERE r.is_primary = TRUE LIMIT 1;
        
        routing_reason := 'Fallback to primary (no healthy replica)';
        consistency_mode := 'strong';
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- SECTION 7: Cold Data Archival Functions
-- ============================================================================

-- Track archived data ranges
CREATE TABLE IF NOT EXISTS cold_archive_manifest (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    partition_name TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    row_count BIGINT,
    compressed_size_bytes BIGINT,
    s3_bucket VARCHAR(255) NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    checksum VARCHAR(64),
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at DATE,
    status VARCHAR(20) DEFAULT 'active',  -- 'active', 'restored', 'expired'
    
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_cold_archive_table_date
    ON cold_archive_manifest (table_name, start_date, end_date);

COMMENT ON TABLE cold_archive_manifest IS 'Manifest of data archived to cold storage (S3)';

-- Function to get archival candidates
CREATE OR REPLACE FUNCTION get_archival_candidates()
RETURNS TABLE(
    table_name TEXT,
    partition_name TEXT,
    row_count BIGINT,
    size_bytes BIGINT,
    oldest_record DATE,
    days_old INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hc.table_name,
        ps.partition_name,
        ps.row_count,
        pg_table_size(ps.partition_name::regclass)::BIGINT as size_bytes,
        ps.min_date::DATE,
        (CURRENT_DATE - ps.min_date::DATE) as days_old
    FROM hot_cold_path_config hc
    CROSS JOIN LATERAL get_partition_stats(hc.table_name) ps
    WHERE hc.cold_archive_enabled = TRUE
    AND hc.auto_tier_enabled = TRUE
    AND ps.min_date < CURRENT_DATE - hc.warm_threshold_days
    AND NOT EXISTS (
        SELECT 1 FROM cold_archive_manifest cam
        WHERE cam.table_name = hc.table_name
        AND cam.partition_name = ps.partition_name
        AND cam.status = 'active'
    )
    ORDER BY ps.min_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON read_replica_config TO radiant_app;
GRANT SELECT ON query_routing_rules TO radiant_app;
GRANT SELECT ON hot_cold_path_config TO radiant_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON session_write_tracker TO radiant_app;
GRANT SELECT, INSERT ON replica_health_history TO radiant_app;
GRANT SELECT ON cold_archive_manifest TO radiant_app;

GRANT EXECUTE ON FUNCTION record_session_write TO radiant_app;
GRANT EXECUTE ON FUNCTION session_needs_primary TO radiant_app;
GRANT EXECUTE ON FUNCTION cleanup_session_write_tracker TO radiant_app;
GRANT EXECUTE ON FUNCTION record_replica_health TO radiant_app;
GRANT EXECUTE ON FUNCTION get_best_replica TO radiant_app;
GRANT EXECUTE ON FUNCTION route_query TO radiant_app;
GRANT EXECUTE ON FUNCTION get_archival_candidates TO radiant_app;
