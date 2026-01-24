-- Cortex Memory System v2.0 Features
-- Golden Rules, Stub Nodes, Live Telemetry, Chain of Custody, Entrance Exams, Graph Expansion, Model Migration

-- =============================================================================
-- Golden Rules Override System
-- =============================================================================

CREATE TABLE IF NOT EXISTS cortex_golden_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES cortex_graph_nodes(id) ON DELETE SET NULL,
    rule_type VARCHAR(20) NOT NULL CHECK (rule_type IN ('force_override', 'ignore_source', 'prefer_source', 'deprecate')),
    condition TEXT NOT NULL,
    override TEXT NOT NULL,
    reason TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    verified_by VARCHAR(255) NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signature VARCHAR(128) NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_golden_rules_tenant ON cortex_golden_rules(tenant_id);
CREATE INDEX idx_golden_rules_active ON cortex_golden_rules(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_golden_rules_entity ON cortex_golden_rules(entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_golden_rules_type ON cortex_golden_rules(tenant_id, rule_type);

ALTER TABLE cortex_golden_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY cortex_golden_rules_tenant_isolation ON cortex_golden_rules
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- Chain of Custody Audit Trail
-- =============================================================================

CREATE TABLE IF NOT EXISTS cortex_chain_of_custody (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fact_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('document', 'graph_node', 'golden_rule', 'telemetry', 'user_input')),
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    extracted_by VARCHAR(255),
    verified_by VARCHAR(255),
    verified_at TIMESTAMPTZ,
    signature VARCHAR(128),
    supersedes UUID[],
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chain_of_custody_tenant ON cortex_chain_of_custody(tenant_id);
CREATE INDEX idx_chain_of_custody_fact ON cortex_chain_of_custody(fact_id);
CREATE INDEX idx_chain_of_custody_verified ON cortex_chain_of_custody(tenant_id, verified_by) WHERE verified_by IS NOT NULL;

ALTER TABLE cortex_chain_of_custody ENABLE ROW LEVEL SECURITY;

CREATE POLICY cortex_chain_of_custody_tenant_isolation ON cortex_chain_of_custody
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS cortex_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_of_custody_id UUID NOT NULL REFERENCES cortex_chain_of_custody(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'verified', 'updated', 'superseded', 'deleted')),
    performed_by VARCHAR(255) NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    previous_value TEXT,
    new_value TEXT,
    reason TEXT,
    signature VARCHAR(128) NOT NULL
);

CREATE INDEX idx_audit_trail_custody ON cortex_audit_trail(chain_of_custody_id);
CREATE INDEX idx_audit_trail_performed ON cortex_audit_trail(performed_at DESC);

-- =============================================================================
-- Stub Nodes - Zero-Copy Pointers
-- =============================================================================

CREATE TABLE IF NOT EXISTS cortex_stub_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    mount_id UUID NOT NULL REFERENCES cortex_zero_copy_mounts(id) ON DELETE CASCADE,
    label VARCHAR(500) NOT NULL,
    description TEXT,
    uri TEXT NOT NULL,
    format VARCHAR(20) NOT NULL CHECK (format IN ('csv', 'json', 'parquet', 'pdf', 'docx', 'xlsx', 'txt', 'html')),
    size_bytes BIGINT NOT NULL DEFAULT 0,
    last_modified TIMESTAMPTZ,
    checksum VARCHAR(128),
    extracted_metadata JSONB NOT NULL DEFAULT '{}',
    connected_to UUID[] NOT NULL DEFAULT '{}',
    last_scanned_at TIMESTAMPTZ,
    scan_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'scanning', 'complete', 'error')),
    scan_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stub_nodes_tenant ON cortex_stub_nodes(tenant_id);
CREATE INDEX idx_stub_nodes_mount ON cortex_stub_nodes(mount_id);
CREATE INDEX idx_stub_nodes_format ON cortex_stub_nodes(tenant_id, format);
CREATE INDEX idx_stub_nodes_status ON cortex_stub_nodes(tenant_id, scan_status);
CREATE INDEX idx_stub_nodes_connected ON cortex_stub_nodes USING GIN (connected_to);

ALTER TABLE cortex_stub_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY cortex_stub_nodes_tenant_isolation ON cortex_stub_nodes
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- Live Telemetry Feeds (MQTT/OPC UA)
-- =============================================================================

CREATE TABLE IF NOT EXISTS cortex_telemetry_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    protocol VARCHAR(20) NOT NULL CHECK (protocol IN ('mqtt', 'opc_ua', 'kafka', 'websocket', 'http_poll')),
    endpoint TEXT NOT NULL,
    node_ids TEXT[],
    topics TEXT[],
    poll_interval_ms INTEGER DEFAULT 1000,
    context_injection BOOLEAN NOT NULL DEFAULT true,
    transform_script TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    auth_config JSONB,
    last_data_at TIMESTAMPTZ,
    error_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_telemetry_feeds_tenant ON cortex_telemetry_feeds(tenant_id);
CREATE INDEX idx_telemetry_feeds_active ON cortex_telemetry_feeds(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_telemetry_feeds_protocol ON cortex_telemetry_feeds(tenant_id, protocol);

ALTER TABLE cortex_telemetry_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY cortex_telemetry_feeds_tenant_isolation ON cortex_telemetry_feeds
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS cortex_telemetry_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_id UUID NOT NULL REFERENCES cortex_telemetry_feeds(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    node_id VARCHAR(255) NOT NULL,
    value_numeric DOUBLE PRECISION,
    value_text TEXT,
    value_boolean BOOLEAN,
    quality VARCHAR(20) NOT NULL DEFAULT 'good' CHECK (quality IN ('good', 'bad', 'uncertain')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX idx_telemetry_data_feed ON cortex_telemetry_data(feed_id);
CREATE INDEX idx_telemetry_data_tenant ON cortex_telemetry_data(tenant_id);
CREATE INDEX idx_telemetry_data_time ON cortex_telemetry_data(tenant_id, timestamp DESC);
CREATE INDEX idx_telemetry_data_node ON cortex_telemetry_data(feed_id, node_id, timestamp DESC);

ALTER TABLE cortex_telemetry_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY cortex_telemetry_data_tenant_isolation ON cortex_telemetry_data
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- Curator Entrance Exams
-- =============================================================================

CREATE TABLE IF NOT EXISTS cortex_entrance_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain_id UUID NOT NULL,
    domain_path VARCHAR(500) NOT NULL,
    questions JSONB NOT NULL DEFAULT '[]',
    passing_score INTEGER NOT NULL DEFAULT 80,
    timeout_minutes INTEGER NOT NULL DEFAULT 60,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'passed', 'failed', 'expired')),
    assigned_to VARCHAR(255),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    score INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entrance_exams_tenant ON cortex_entrance_exams(tenant_id);
CREATE INDEX idx_entrance_exams_domain ON cortex_entrance_exams(tenant_id, domain_id);
CREATE INDEX idx_entrance_exams_status ON cortex_entrance_exams(tenant_id, status);
CREATE INDEX idx_entrance_exams_assigned ON cortex_entrance_exams(assigned_to) WHERE assigned_to IS NOT NULL;

ALTER TABLE cortex_entrance_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY cortex_entrance_exams_tenant_isolation ON cortex_entrance_exams
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS cortex_exam_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES cortex_entrance_exams(id) ON DELETE CASCADE,
    question_id UUID NOT NULL,
    answer TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    correction TEXT,
    notes TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(exam_id, question_id)
);

CREATE INDEX idx_exam_submissions_exam ON cortex_exam_submissions(exam_id);

-- =============================================================================
-- Graph Expansion Tasks (Twilight Dreaming v2)
-- =============================================================================

CREATE TABLE IF NOT EXISTS cortex_graph_expansion_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_type VARCHAR(30) NOT NULL CHECK (task_type IN ('infer_links', 'cluster_entities', 'detect_patterns', 'merge_duplicates')),
    source_node_ids UUID[] NOT NULL DEFAULT '{}',
    target_scope VARCHAR(20) NOT NULL DEFAULT 'local' CHECK (target_scope IN ('local', 'domain', 'global')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    progress INTEGER NOT NULL DEFAULT 0,
    discovered_links JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT
);

CREATE INDEX idx_graph_expansion_tenant ON cortex_graph_expansion_tasks(tenant_id);
CREATE INDEX idx_graph_expansion_status ON cortex_graph_expansion_tasks(tenant_id, status);
CREATE INDEX idx_graph_expansion_type ON cortex_graph_expansion_tasks(tenant_id, task_type);

ALTER TABLE cortex_graph_expansion_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY cortex_graph_expansion_tenant_isolation ON cortex_graph_expansion_tasks
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS cortex_inferred_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES cortex_graph_expansion_tasks(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL,
    target_node_id UUID NOT NULL,
    edge_type VARCHAR(50) NOT NULL,
    confidence DECIMAL(5,4) NOT NULL,
    evidence JSONB NOT NULL DEFAULT '[]',
    is_approved BOOLEAN,
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inferred_links_task ON cortex_inferred_links(task_id);
CREATE INDEX idx_inferred_links_tenant ON cortex_inferred_links(tenant_id);
CREATE INDEX idx_inferred_links_approval ON cortex_inferred_links(tenant_id, is_approved) WHERE is_approved IS NULL;

ALTER TABLE cortex_inferred_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY cortex_inferred_links_tenant_isolation ON cortex_inferred_links
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE TABLE IF NOT EXISTS cortex_pattern_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pattern_type VARCHAR(20) NOT NULL CHECK (pattern_type IN ('sequence', 'correlation', 'anomaly', 'cluster')),
    description TEXT NOT NULL,
    affected_nodes UUID[] NOT NULL DEFAULT '{}',
    confidence DECIMAL(5,4) NOT NULL,
    suggested_action TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pattern_detections_tenant ON cortex_pattern_detections(tenant_id);
CREATE INDEX idx_pattern_detections_type ON cortex_pattern_detections(tenant_id, pattern_type);

ALTER TABLE cortex_pattern_detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY cortex_pattern_detections_tenant_isolation ON cortex_pattern_detections
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- Model Migration
-- =============================================================================

CREATE TABLE IF NOT EXISTS cortex_model_migrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_model JSONB NOT NULL,
    target_model JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validating', 'migrating', 'testing', 'completed', 'failed', 'rolled_back')),
    validation_results JSONB,
    test_results JSONB NOT NULL DEFAULT '[]',
    rollback_available BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT
);

CREATE INDEX idx_model_migrations_tenant ON cortex_model_migrations(tenant_id);
CREATE INDEX idx_model_migrations_status ON cortex_model_migrations(tenant_id, status);

ALTER TABLE cortex_model_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY cortex_model_migrations_tenant_isolation ON cortex_model_migrations
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- Helper Functions
-- =============================================================================

CREATE OR REPLACE FUNCTION check_golden_rule_match(
    p_tenant_id UUID,
    p_query TEXT,
    p_entity_id UUID DEFAULT NULL
) RETURNS TABLE (
    rule_id UUID,
    rule_type VARCHAR(20),
    override TEXT,
    priority INTEGER,
    verified_by VARCHAR(255),
    verified_at TIMESTAMPTZ,
    signature VARCHAR(128)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gr.id,
        gr.rule_type,
        gr.override,
        gr.priority,
        gr.verified_by,
        gr.verified_at,
        gr.signature
    FROM cortex_golden_rules gr
    WHERE gr.tenant_id = p_tenant_id
      AND gr.is_active = true
      AND (gr.expires_at IS NULL OR gr.expires_at > NOW())
      AND (p_entity_id IS NULL OR gr.entity_id = p_entity_id OR gr.entity_id IS NULL)
      AND p_query ILIKE '%' || gr.condition || '%'
    ORDER BY gr.priority DESC, gr.verified_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION generate_signature(
    p_content TEXT,
    p_user VARCHAR(255)
) RETURNS VARCHAR(128) AS $$
BEGIN
    RETURN encode(sha256((p_content || p_user || NOW()::text)::bytea), 'hex');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_stub_node_content_url(
    p_stub_node_id UUID,
    p_range_start INTEGER DEFAULT NULL,
    p_range_end INTEGER DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_stub cortex_stub_nodes%ROWTYPE;
    v_mount cortex_zero_copy_mounts%ROWTYPE;
BEGIN
    SELECT * INTO v_stub FROM cortex_stub_nodes WHERE id = p_stub_node_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stub node not found: %', p_stub_node_id;
    END IF;
    
    SELECT * INTO v_mount FROM cortex_zero_copy_mounts WHERE id = v_stub.mount_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Mount not found for stub node: %', p_stub_node_id;
    END IF;
    
    -- Return the URI (actual signed URL generation happens in application layer)
    RETURN v_stub.uri;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_golden_rule_match TO authenticated;
GRANT EXECUTE ON FUNCTION generate_signature TO authenticated;
GRANT EXECUTE ON FUNCTION get_stub_node_content_url TO authenticated;
