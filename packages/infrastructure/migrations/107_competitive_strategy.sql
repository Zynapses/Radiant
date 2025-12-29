-- RADIANT v4.18.20 - Competitive Strategy Migration
-- Supports: Sovereign Routing, Code Verification, Deep Research, GraphRAG

-- ============================================================================
-- Sovereign Routing (Safety Tax Gap)
-- ============================================================================

-- Log provider refusals for learning
CREATE TABLE IF NOT EXISTS provider_refusal_log (
    refusal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    topic_cluster VARCHAR(100),
    refusal_type VARCHAR(20) NOT NULL, -- 'hard', 'soft'
    confidence DECIMAL(3,2),
    prompt_hash VARCHAR(32),
    rerouted_to VARCHAR(100),
    reroute_successful BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_provider_refusal_tenant ON provider_refusal_log (tenant_id, created_at DESC);
CREATE INDEX idx_provider_refusal_provider ON provider_refusal_log (tenant_id, provider, topic_cluster);

-- Track request outcomes for refusal rate calculation
CREATE TABLE IF NOT EXISTS provider_request_log (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    topic_cluster VARCHAR(100),
    was_refusal BOOLEAN DEFAULT false,
    response_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_provider_request_tenant ON provider_request_log (tenant_id, created_at DESC);
CREATE INDEX idx_provider_request_refusal ON provider_request_log (tenant_id, provider, topic_cluster, was_refusal);

-- Uncensored model registry
CREATE TABLE IF NOT EXISTS uncensored_models (
    model_id VARCHAR(100) PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- NULL = global
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    sagemaker_endpoint VARCHAR(200),
    uncensored_domains JSONB DEFAULT '[]'::jsonb,
    proficiency_scores JSONB DEFAULT '{}'::jsonb,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_uncensored_models_tenant ON uncensored_models (tenant_id);

-- Add uncensored fields to open_source_libraries table
ALTER TABLE open_source_libraries ADD COLUMN IF NOT EXISTS uncensored BOOLEAN DEFAULT false;
ALTER TABLE open_source_libraries ADD COLUMN IF NOT EXISTS use_cases TEXT[] DEFAULT '{}';

-- Index for uncensored library queries
CREATE INDEX IF NOT EXISTS idx_libraries_uncensored ON open_source_libraries (category) WHERE uncensored = true;

-- ============================================================================
-- Code Verification (Probabilistic Code Gap)
-- ============================================================================

CREATE TABLE IF NOT EXISTS code_verification_log (
    verification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    language VARCHAR(20) NOT NULL,
    verified BOOLEAN NOT NULL,
    iterations INTEGER NOT NULL,
    tests_passed INTEGER DEFAULT 0,
    tests_failed INTEGER DEFAULT 0,
    final_exit_code INTEGER,
    execution_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_code_verification_tenant ON code_verification_log (tenant_id, created_at DESC);
CREATE INDEX idx_code_verification_language ON code_verification_log (tenant_id, language, verified);

-- Track self-correction effectiveness
CREATE TABLE IF NOT EXISTS code_correction_log (
    correction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID REFERENCES code_verification_log(verification_id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    error_message TEXT,
    correction_applied BOOLEAN,
    fixed_issue BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Deep Research (10-Second Gap)
-- ============================================================================

CREATE TABLE IF NOT EXISTS research_tasks (
    task_id VARCHAR(100) PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    query TEXT NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    sources_collected INTEGER DEFAULT 0,
    report_url TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_research_tasks_tenant ON research_tasks (tenant_id, created_at DESC);
CREATE INDEX idx_research_tasks_user ON research_tasks (tenant_id, user_id, created_at DESC);
CREATE INDEX idx_research_tasks_status ON research_tasks (tenant_id, status);

-- Research sources collected during crawl
CREATE TABLE IF NOT EXISTS research_sources (
    source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id VARCHAR(100) NOT NULL REFERENCES research_tasks(task_id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    domain VARCHAR(200),
    source_type VARCHAR(20),
    relevance_score DECIMAL(3,2),
    extracted_text TEXT,
    published_at TIMESTAMPTZ,
    crawled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_research_sources_task ON research_sources (task_id);

-- Entities extracted from research
CREATE TABLE IF NOT EXISTS research_entities (
    entity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id VARCHAR(100) NOT NULL REFERENCES research_tasks(task_id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    entity_type VARCHAR(50),
    mentions INTEGER DEFAULT 1,
    sentiment DECIMAL(3,2),
    context JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX idx_research_entities_task ON research_entities (task_id);

-- ============================================================================
-- GraphRAG (Lost in the Middle Gap)
-- ============================================================================

-- Knowledge graph nodes
CREATE TABLE IF NOT EXISTS knowledge_nodes (
    node_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    node_type VARCHAR(50) NOT NULL, -- 'entity', 'concept', 'document', 'fact'
    properties JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536),
    source_document_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_knowledge_nodes_tenant ON knowledge_nodes (tenant_id, node_type);
CREATE INDEX idx_knowledge_nodes_name ON knowledge_nodes (tenant_id, name);
CREATE INDEX idx_knowledge_nodes_embedding ON knowledge_nodes 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Knowledge graph edges (relationships)
CREATE TABLE IF NOT EXISTS knowledge_edges (
    edge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES knowledge_nodes(node_id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES knowledge_nodes(node_id) ON DELETE CASCADE,
    relationship_type VARCHAR(100) NOT NULL, -- 'depends_on', 'causes', 'contains', 'related_to', etc.
    weight DECIMAL(3,2) DEFAULT 1.0,
    properties JSONB DEFAULT '{}'::jsonb,
    source_document_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_edges_tenant ON knowledge_edges (tenant_id);
CREATE INDEX idx_knowledge_edges_source ON knowledge_edges (source_node_id);
CREATE INDEX idx_knowledge_edges_target ON knowledge_edges (target_node_id);
CREATE INDEX idx_knowledge_edges_type ON knowledge_edges (tenant_id, relationship_type);

-- Graph traversal cache for performance
CREATE TABLE IF NOT EXISTS knowledge_traversal_cache (
    cache_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    query_hash VARCHAR(64) NOT NULL,
    result_nodes JSONB NOT NULL,
    traversal_depth INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX idx_traversal_cache_query ON knowledge_traversal_cache (tenant_id, query_hash);

-- Document ingestion for GraphRAG
CREATE TABLE IF NOT EXISTS knowledge_documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    title VARCHAR(500),
    source_url TEXT,
    content TEXT,
    content_hash VARCHAR(64),
    processed BOOLEAN DEFAULT false,
    node_count INTEGER DEFAULT 0,
    edge_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_knowledge_documents_tenant ON knowledge_documents (tenant_id, processed);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE provider_refusal_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_request_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_verification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY provider_refusal_tenant_isolation ON provider_refusal_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY provider_request_tenant_isolation ON provider_request_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY code_verification_tenant_isolation ON code_verification_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY research_tasks_tenant_isolation ON research_tasks
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY research_sources_tenant_isolation ON research_sources
    FOR ALL USING (task_id IN (SELECT task_id FROM research_tasks WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid));

CREATE POLICY research_entities_tenant_isolation ON research_entities
    FOR ALL USING (task_id IN (SELECT task_id FROM research_tasks WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid));

CREATE POLICY knowledge_nodes_tenant_isolation ON knowledge_nodes
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY knowledge_edges_tenant_isolation ON knowledge_edges
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY knowledge_documents_tenant_isolation ON knowledge_documents
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- Functions
-- ============================================================================

-- Get refusal rate for a provider + topic
CREATE OR REPLACE FUNCTION get_provider_refusal_rate(
    p_tenant_id UUID,
    p_provider VARCHAR(50),
    p_topic_cluster VARCHAR(100),
    p_days INTEGER DEFAULT 30
) RETURNS DECIMAL(5,4) AS $$
DECLARE
    v_total INTEGER;
    v_refusals INTEGER;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE was_refusal = true)
    INTO v_total, v_refusals
    FROM provider_request_log
    WHERE tenant_id = p_tenant_id
      AND (provider = p_provider OR p_provider = 'any')
      AND (topic_cluster = p_topic_cluster OR p_topic_cluster IS NULL)
      AND created_at > NOW() - (p_days || ' days')::INTERVAL;
    
    IF v_total = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN v_refusals::DECIMAL / v_total;
END;
$$ LANGUAGE plpgsql;

-- Graph traversal function (BFS)
CREATE OR REPLACE FUNCTION traverse_knowledge_graph(
    p_tenant_id UUID,
    p_start_node_id UUID,
    p_max_depth INTEGER DEFAULT 3,
    p_relationship_types VARCHAR[] DEFAULT NULL
) RETURNS TABLE (
    node_id UUID,
    name VARCHAR,
    node_type VARCHAR,
    depth INTEGER,
    path UUID[]
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE graph_walk AS (
        -- Start node
        SELECT 
            n.node_id,
            n.name,
            n.node_type,
            0 as depth,
            ARRAY[n.node_id] as path
        FROM knowledge_nodes n
        WHERE n.tenant_id = p_tenant_id AND n.node_id = p_start_node_id
        
        UNION ALL
        
        -- Walk edges
        SELECT 
            n.node_id,
            n.name,
            n.node_type,
            gw.depth + 1,
            gw.path || n.node_id
        FROM graph_walk gw
        JOIN knowledge_edges e ON e.source_node_id = gw.node_id
        JOIN knowledge_nodes n ON n.node_id = e.target_node_id
        WHERE gw.depth < p_max_depth
          AND n.node_id != ALL(gw.path) -- Avoid cycles
          AND n.tenant_id = p_tenant_id
          AND (p_relationship_types IS NULL OR e.relationship_type = ANY(p_relationship_types))
    )
    SELECT DISTINCT ON (gw.node_id) gw.* FROM graph_walk gw
    ORDER BY gw.node_id, gw.depth;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE provider_refusal_log IS 'Track provider refusals for sovereign routing learning';
COMMENT ON TABLE code_verification_log IS 'Track code verification outcomes for compiler loop';
COMMENT ON TABLE research_tasks IS 'Async deep research tasks (10-second gap exploit)';
COMMENT ON TABLE knowledge_nodes IS 'GraphRAG knowledge graph nodes';
COMMENT ON TABLE knowledge_edges IS 'GraphRAG knowledge graph relationships';
COMMENT ON FUNCTION traverse_knowledge_graph IS 'BFS traversal for GraphRAG queries';
