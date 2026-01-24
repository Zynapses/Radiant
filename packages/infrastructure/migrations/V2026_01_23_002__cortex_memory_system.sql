-- ============================================================================
-- CORTEX MEMORY SYSTEM v4.20.0
-- Tiered Memory Architecture: Hot (Redis) → Warm (Neptune+pgvector) → Cold (S3+Iceberg)
-- ============================================================================

-- ============================================================================
-- CORTEX CONFIGURATION
-- ============================================================================

CREATE TABLE cortex_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Hot Tier Config
    hot_tier_enabled BOOLEAN DEFAULT true,
    hot_redis_cluster_mode BOOLEAN DEFAULT true,
    hot_shard_count INTEGER DEFAULT 3,
    hot_replicas_per_shard INTEGER DEFAULT 2,
    hot_instance_type VARCHAR(50) DEFAULT 'r7g.xlarge',
    hot_max_memory_percent INTEGER DEFAULT 80,
    hot_default_ttl_seconds INTEGER DEFAULT 14400, -- 4 hours
    hot_overflow_to_dynamodb BOOLEAN DEFAULT true,
    
    -- Warm Tier Config
    warm_tier_enabled BOOLEAN DEFAULT true,
    warm_neptune_mode VARCHAR(20) DEFAULT 'serverless' CHECK (warm_neptune_mode IN ('serverless', 'provisioned')),
    warm_neptune_min_capacity DECIMAL(4,1) DEFAULT 1.0,
    warm_neptune_max_capacity DECIMAL(4,1) DEFAULT 16.0,
    warm_neptune_instance_class VARCHAR(50),
    warm_pgvector_enabled BOOLEAN DEFAULT true,
    warm_retention_days INTEGER DEFAULT 90,
    warm_graph_weight_percent INTEGER DEFAULT 60,
    warm_vector_weight_percent INTEGER DEFAULT 40,
    
    -- Cold Tier Config
    cold_tier_enabled BOOLEAN DEFAULT true,
    cold_s3_bucket VARCHAR(255),
    cold_iceberg_enabled BOOLEAN DEFAULT true,
    cold_compression_format VARCHAR(20) DEFAULT 'snappy' CHECK (cold_compression_format IN ('snappy', 'zstd', 'gzip')),
    cold_zero_copy_enabled BOOLEAN DEFAULT false,
    
    -- Tier Coordinator Config
    hot_to_warm_threshold_hours INTEGER DEFAULT 4,
    warm_to_cold_threshold_days INTEGER DEFAULT 90,
    enable_auto_promotion BOOLEAN DEFAULT true,
    enable_auto_archival BOOLEAN DEFAULT true,
    evergreen_node_types TEXT[] DEFAULT ARRAY['procedure', 'fact'],
    priority_domains TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id)
);

-- ============================================================================
-- WARM TIER: KNOWLEDGE GRAPH TABLES (Neptune metadata in PostgreSQL)
-- ============================================================================

CREATE TABLE cortex_graph_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    node_type VARCHAR(50) NOT NULL CHECK (node_type IN ('document', 'entity', 'concept', 'procedure', 'fact')),
    label VARCHAR(500) NOT NULL,
    description TEXT,
    properties JSONB DEFAULT '{}',
    embedding vector(1536),
    confidence DECIMAL(3,2) DEFAULT 0.8,
    source_document_ids UUID[] DEFAULT ARRAY[]::UUID[],
    is_evergreen BOOLEAN DEFAULT false,
    neptune_id VARCHAR(255), -- Reference to Neptune node ID
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ
);

CREATE TABLE cortex_graph_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES cortex_graph_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES cortex_graph_nodes(id) ON DELETE CASCADE,
    edge_type VARCHAR(50) NOT NULL CHECK (edge_type IN (
        'mentions', 'causes', 'depends_on', 'supersedes', 'verified_by', 
        'authored_by', 'relates_to', 'contains', 'requires'
    )),
    weight DECIMAL(3,2) DEFAULT 0.5,
    properties JSONB DEFAULT '{}',
    confidence DECIMAL(3,2) DEFAULT 0.8,
    neptune_id VARCHAR(255), -- Reference to Neptune edge ID
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cortex_graph_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    source VARCHAR(1000),
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('upload', 'mount', 'api')),
    hash VARCHAR(64) NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    node_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'indexed', 'archived', 'error')),
    error_message TEXT,
    s3_key VARCHAR(1000),
    mount_id UUID REFERENCES cortex_zero_copy_mounts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    indexed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, hash)
);

-- ============================================================================
-- COLD TIER: ARCHIVE & ZERO-COPY MOUNTS
-- ============================================================================

CREATE TABLE cortex_cold_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    original_tier VARCHAR(10) NOT NULL CHECK (original_tier IN ('hot', 'warm')),
    original_table_name VARCHAR(100) NOT NULL,
    archive_reason VARCHAR(50) NOT NULL CHECK (archive_reason IN ('age', 'manual', 'gdpr', 'retention_policy')),
    s3_key VARCHAR(1000) NOT NULL,
    iceberg_table_name VARCHAR(255),
    partition_values JSONB DEFAULT '{}',
    record_count INTEGER NOT NULL,
    size_bytes BIGINT NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    storage_class VARCHAR(50) DEFAULT 'STANDARD',
    archived_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retrievable_until TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ
);

CREATE TABLE cortex_zero_copy_mounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('snowflake', 'databricks', 's3', 'azure_datalake', 'gcs')),
    connection_config JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'scanning', 'error', 'disconnected')),
    last_scan_at TIMESTAMPTZ,
    object_count INTEGER DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    indexed_node_count INTEGER DEFAULT 0,
    credential_secret_arn VARCHAR(500),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id, name)
);

CREATE TABLE cortex_zero_copy_scan_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mount_id UUID NOT NULL REFERENCES cortex_zero_copy_mounts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    objects_scanned INTEGER NOT NULL DEFAULT 0,
    objects_indexed INTEGER NOT NULL DEFAULT 0,
    nodes_created INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    scan_duration_ms INTEGER,
    error_details JSONB DEFAULT '[]',
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DATA FLOW & METRICS
-- ============================================================================

CREATE TABLE cortex_data_flow_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period VARCHAR(10) NOT NULL CHECK (period IN ('hour', 'day', 'week')),
    period_start TIMESTAMPTZ NOT NULL,
    hot_to_warm_promotions INTEGER DEFAULT 0,
    warm_to_cold_archivals INTEGER DEFAULT 0,
    cold_to_warm_retrievals INTEGER DEFAULT 0,
    hot_cache_miss_rate DECIMAL(5,4) DEFAULT 0,
    warm_query_latency_p99_ms INTEGER DEFAULT 0,
    cold_retrieval_latency_p99_ms INTEGER DEFAULT 0,
    tier_miss_rate DECIMAL(5,4) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id, period, period_start)
);

CREATE TABLE cortex_tier_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tier VARCHAR(10) NOT NULL CHECK (tier IN ('hot', 'warm', 'cold')),
    status VARCHAR(20) DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'critical')),
    
    -- Hot Tier Metrics
    redis_memory_usage_percent DECIMAL(5,2),
    redis_cache_hit_rate DECIMAL(5,4),
    redis_p99_latency_ms INTEGER,
    redis_connection_count INTEGER,
    
    -- Warm Tier Metrics
    neptune_cpu_percent DECIMAL(5,2),
    neptune_query_latency_p99_ms INTEGER,
    pgvector_index_size BIGINT,
    graph_node_count BIGINT,
    graph_edge_count BIGINT,
    
    -- Cold Tier Metrics
    s3_storage_bytes BIGINT,
    s3_storage_cost_usd DECIMAL(10,2),
    athena_query_duration_p99_ms INTEGER,
    iceberg_compaction_lag_hours INTEGER,
    zero_copy_mount_error_count INTEGER,
    
    checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cortex_tier_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tier VARCHAR(10) NOT NULL CHECK (tier IN ('hot', 'warm', 'cold')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    metric VARCHAR(100) NOT NULL,
    threshold DECIMAL(15,4) NOT NULL,
    current_value DECIMAL(15,4) NOT NULL,
    message TEXT NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ
);

-- ============================================================================
-- HOUSEKEEPING (TWILIGHT DREAMING INTEGRATION)
-- ============================================================================

CREATE TABLE cortex_housekeeping_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN (
        'ttl_enforcement', 'archive_promotion', 'deduplication', 
        'conflict_resolution', 'iceberg_compaction', 'index_optimization',
        'integrity_audit', 'storage_report'
    )),
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('hourly', 'nightly', 'weekly')),
    is_enabled BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'running', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id, task_type)
);

CREATE TABLE cortex_housekeeping_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES cortex_housekeeping_tasks(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL,
    records_processed INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,
    duration_ms INTEGER,
    details JSONB DEFAULT '{}',
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- GDPR ERASURE TRACKING
-- ============================================================================

CREATE TABLE cortex_gdpr_erasure_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('user', 'tenant')),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    hot_tier_status VARCHAR(20) DEFAULT 'pending' CHECK (hot_tier_status IN ('pending', 'completed')),
    warm_tier_status VARCHAR(20) DEFAULT 'pending' CHECK (warm_tier_status IN ('pending', 'completed')),
    cold_tier_status VARCHAR(20) DEFAULT 'pending' CHECK (cold_tier_status IN ('pending', 'completed')),
    audit_log_retained BOOLEAN DEFAULT true,
    error_message TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    requested_by UUID REFERENCES users(id),
    completed_at TIMESTAMPTZ
);

-- ============================================================================
-- CONFLICTING FACTS (Graph-RAG)
-- ============================================================================

CREATE TABLE cortex_conflicting_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    node_id_1 UUID NOT NULL REFERENCES cortex_graph_nodes(id) ON DELETE CASCADE,
    node_id_2 UUID NOT NULL REFERENCES cortex_graph_nodes(id) ON DELETE CASCADE,
    conflict_type VARCHAR(30) NOT NULL CHECK (conflict_type IN ('contradiction', 'superseded', 'ambiguous')),
    description TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    resolution_action VARCHAR(50),
    resolution_notes TEXT
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Config
CREATE INDEX idx_cortex_config_tenant ON cortex_config(tenant_id);

-- Graph Nodes
CREATE INDEX idx_cortex_graph_nodes_tenant ON cortex_graph_nodes(tenant_id);
CREATE INDEX idx_cortex_graph_nodes_type ON cortex_graph_nodes(tenant_id, node_type);
CREATE INDEX idx_cortex_graph_nodes_status ON cortex_graph_nodes(tenant_id, status);
CREATE INDEX idx_cortex_graph_nodes_label ON cortex_graph_nodes(tenant_id, label);
CREATE INDEX idx_cortex_graph_nodes_embedding ON cortex_graph_nodes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Graph Edges
CREATE INDEX idx_cortex_graph_edges_tenant ON cortex_graph_edges(tenant_id);
CREATE INDEX idx_cortex_graph_edges_source ON cortex_graph_edges(source_node_id);
CREATE INDEX idx_cortex_graph_edges_target ON cortex_graph_edges(target_node_id);
CREATE INDEX idx_cortex_graph_edges_type ON cortex_graph_edges(tenant_id, edge_type);

-- Documents
CREATE INDEX idx_cortex_graph_documents_tenant ON cortex_graph_documents(tenant_id);
CREATE INDEX idx_cortex_graph_documents_status ON cortex_graph_documents(tenant_id, status);
CREATE INDEX idx_cortex_graph_documents_hash ON cortex_graph_documents(tenant_id, hash);

-- Cold Archives
CREATE INDEX idx_cortex_cold_archives_tenant ON cortex_cold_archives(tenant_id);
CREATE INDEX idx_cortex_cold_archives_table ON cortex_cold_archives(tenant_id, original_table_name);

-- Zero-Copy Mounts
CREATE INDEX idx_cortex_zero_copy_mounts_tenant ON cortex_zero_copy_mounts(tenant_id);
CREATE INDEX idx_cortex_zero_copy_mounts_status ON cortex_zero_copy_mounts(status);

-- Data Flow Metrics
CREATE INDEX idx_cortex_data_flow_metrics_tenant ON cortex_data_flow_metrics(tenant_id);
CREATE INDEX idx_cortex_data_flow_metrics_period ON cortex_data_flow_metrics(tenant_id, period, period_start);

-- Tier Health
CREATE INDEX idx_cortex_tier_health_tenant ON cortex_tier_health(tenant_id);
CREATE INDEX idx_cortex_tier_health_tier ON cortex_tier_health(tenant_id, tier);

-- Alerts
CREATE INDEX idx_cortex_tier_alerts_tenant ON cortex_tier_alerts(tenant_id);
CREATE INDEX idx_cortex_tier_alerts_unresolved ON cortex_tier_alerts(tenant_id, tier) WHERE resolved_at IS NULL;

-- Housekeeping
CREATE INDEX idx_cortex_housekeeping_tasks_tenant ON cortex_housekeeping_tasks(tenant_id);
CREATE INDEX idx_cortex_housekeeping_tasks_next_run ON cortex_housekeeping_tasks(next_run_at) WHERE is_enabled = true;

-- GDPR
CREATE INDEX idx_cortex_gdpr_erasure_tenant ON cortex_gdpr_erasure_requests(tenant_id);
CREATE INDEX idx_cortex_gdpr_erasure_status ON cortex_gdpr_erasure_requests(status) WHERE status != 'completed';

-- Conflicts
CREATE INDEX idx_cortex_conflicting_facts_tenant ON cortex_conflicting_facts(tenant_id);
CREATE INDEX idx_cortex_conflicting_facts_unresolved ON cortex_conflicting_facts(tenant_id) WHERE resolved_at IS NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE cortex_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_graph_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_cold_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_zero_copy_mounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_zero_copy_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_data_flow_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_tier_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_tier_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_housekeeping_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_gdpr_erasure_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_conflicting_facts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY cortex_config_isolation ON cortex_config
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cortex_graph_nodes_isolation ON cortex_graph_nodes
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cortex_graph_edges_isolation ON cortex_graph_edges
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cortex_graph_documents_isolation ON cortex_graph_documents
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cortex_cold_archives_isolation ON cortex_cold_archives
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cortex_zero_copy_mounts_isolation ON cortex_zero_copy_mounts
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cortex_zero_copy_scan_results_isolation ON cortex_zero_copy_scan_results
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cortex_data_flow_metrics_isolation ON cortex_data_flow_metrics
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cortex_tier_health_isolation ON cortex_tier_health
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cortex_tier_alerts_isolation ON cortex_tier_alerts
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cortex_housekeeping_tasks_isolation ON cortex_housekeeping_tasks
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cortex_housekeeping_results_isolation ON cortex_housekeeping_results
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cortex_gdpr_erasure_requests_isolation ON cortex_gdpr_erasure_requests
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY cortex_conflicting_facts_isolation ON cortex_conflicting_facts
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Initialize default housekeeping tasks for a tenant
CREATE OR REPLACE FUNCTION cortex_initialize_housekeeping(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO cortex_housekeeping_tasks (tenant_id, task_type, frequency, next_run_at)
    VALUES
        (p_tenant_id, 'ttl_enforcement', 'hourly', NOW() + INTERVAL '1 hour'),
        (p_tenant_id, 'archive_promotion', 'nightly', (DATE_TRUNC('day', NOW()) + INTERVAL '1 day 4 hours')),
        (p_tenant_id, 'deduplication', 'nightly', (DATE_TRUNC('day', NOW()) + INTERVAL '1 day 4 hours')),
        (p_tenant_id, 'conflict_resolution', 'nightly', (DATE_TRUNC('day', NOW()) + INTERVAL '1 day 4 hours')),
        (p_tenant_id, 'iceberg_compaction', 'nightly', (DATE_TRUNC('day', NOW()) + INTERVAL '1 day 4 hours')),
        (p_tenant_id, 'index_optimization', 'weekly', (DATE_TRUNC('week', NOW()) + INTERVAL '1 week 4 hours')),
        (p_tenant_id, 'integrity_audit', 'weekly', (DATE_TRUNC('week', NOW()) + INTERVAL '1 week 4 hours')),
        (p_tenant_id, 'storage_report', 'weekly', (DATE_TRUNC('week', NOW()) + INTERVAL '1 week 4 hours'))
    ON CONFLICT (tenant_id, task_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Get tier health summary
CREATE OR REPLACE FUNCTION cortex_get_tier_health_summary(p_tenant_id UUID)
RETURNS TABLE (
    tier VARCHAR(10),
    status VARCHAR(20),
    alert_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        th.tier,
        th.status,
        COUNT(ta.id) FILTER (WHERE ta.resolved_at IS NULL) as alert_count
    FROM cortex_tier_health th
    LEFT JOIN cortex_tier_alerts ta ON ta.tenant_id = th.tenant_id AND ta.tier = th.tier
    WHERE th.tenant_id = p_tenant_id
    AND th.checked_at = (
        SELECT MAX(checked_at) FROM cortex_tier_health 
        WHERE tenant_id = p_tenant_id AND tier = th.tier
    )
    GROUP BY th.tier, th.status;
END;
$$ LANGUAGE plpgsql;

-- Update node count on document
CREATE OR REPLACE FUNCTION cortex_update_document_node_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE cortex_graph_documents 
        SET node_count = node_count + 1,
            updated_at = NOW()
        WHERE id = ANY(NEW.source_document_ids);
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE cortex_graph_documents 
        SET node_count = GREATEST(0, node_count - 1),
            updated_at = NOW()
        WHERE id = ANY(OLD.source_document_ids);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cortex_graph_nodes_document_count
    AFTER INSERT OR DELETE ON cortex_graph_nodes
    FOR EACH ROW EXECUTE FUNCTION cortex_update_document_node_count();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE cortex_config IS 'Cortex Memory System configuration per tenant';
COMMENT ON TABLE cortex_graph_nodes IS 'Knowledge graph nodes (Warm Tier - synced with Neptune)';
COMMENT ON TABLE cortex_graph_edges IS 'Knowledge graph edges (Warm Tier - synced with Neptune)';
COMMENT ON TABLE cortex_graph_documents IS 'Source documents indexed into the knowledge graph';
COMMENT ON TABLE cortex_cold_archives IS 'Cold Tier archive records (S3 + Iceberg)';
COMMENT ON TABLE cortex_zero_copy_mounts IS 'Zero-Copy mount configurations for external data lakes';
COMMENT ON TABLE cortex_data_flow_metrics IS 'Data flow metrics between tiers';
COMMENT ON TABLE cortex_tier_health IS 'Health status snapshots for each tier';
COMMENT ON TABLE cortex_tier_alerts IS 'Alerts triggered by tier health thresholds';
COMMENT ON TABLE cortex_housekeeping_tasks IS 'Twilight Dreaming housekeeping task schedules';
COMMENT ON TABLE cortex_gdpr_erasure_requests IS 'GDPR Article 17 erasure request tracking';
COMMENT ON TABLE cortex_conflicting_facts IS 'Detected contradictions in knowledge graph';
