-- ============================================================================
-- RADIANT Cortex Graph-RAG Knowledge Engine
-- Migration: V2026_01_25_008__cortex_graph_rag.sql
-- 
-- Graph-based knowledge storage with vector embeddings for RAG retrieval
-- ============================================================================

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- CORTEX CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS cortex_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Feature toggles
    enable_graph_rag BOOLEAN NOT NULL DEFAULT true,
    enable_entity_extraction BOOLEAN NOT NULL DEFAULT true,
    enable_relationship_inference BOOLEAN NOT NULL DEFAULT true,
    enable_temporal_tracking BOOLEAN NOT NULL DEFAULT true,
    enable_auto_merge BOOLEAN NOT NULL DEFAULT true,
    
    -- Model configuration
    embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
    embedding_dimensions INTEGER NOT NULL DEFAULT 1536,
    entity_extraction_model VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini',
    reranking_model VARCHAR(100),
    
    -- Chunking configuration
    default_chunk_size INTEGER NOT NULL DEFAULT 512,
    default_chunk_overlap INTEGER NOT NULL DEFAULT 50,
    max_chunks_per_document INTEGER NOT NULL DEFAULT 1000,
    
    -- Retrieval configuration
    default_max_results INTEGER NOT NULL DEFAULT 10,
    default_max_depth INTEGER NOT NULL DEFAULT 3,
    min_relevance_score DECIMAL(5,4) NOT NULL DEFAULT 0.7,
    hybrid_search_alpha DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    
    -- Maintenance
    auto_cleanup_enabled BOOLEAN NOT NULL DEFAULT true,
    cleanup_threshold_days INTEGER NOT NULL DEFAULT 365,
    max_entities_per_tenant INTEGER NOT NULL DEFAULT 100000,
    max_chunks_per_tenant INTEGER NOT NULL DEFAULT 1000000,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES platform_admins(id),
    
    UNIQUE(tenant_id)
);

-- ============================================================================
-- KNOWLEDGE ENTITIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS cortex_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    entity_type VARCHAR(50) NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    aliases TEXT[] DEFAULT '{}',
    properties JSONB NOT NULL DEFAULT '{}',
    
    -- Vector embedding for semantic search
    embedding vector(1536),
    embedding_model VARCHAR(100),
    
    -- Metadata
    confidence DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    source_type VARCHAR(50) NOT NULL,
    source_id UUID,
    source_url TEXT,
    source_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_user_id UUID,
    
    -- Activity tracking
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    merged_into_id UUID REFERENCES cortex_entities(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for cortex_entities
CREATE INDEX idx_cortex_entities_tenant ON cortex_entities(tenant_id);
CREATE INDEX idx_cortex_entities_type ON cortex_entities(tenant_id, entity_type);
CREATE INDEX idx_cortex_entities_name ON cortex_entities(tenant_id, name);
CREATE INDEX idx_cortex_entities_active ON cortex_entities(tenant_id, is_active);
CREATE INDEX idx_cortex_entities_source ON cortex_entities(tenant_id, source_type, source_id);

-- Vector similarity index using HNSW (faster for approximate nearest neighbor)
CREATE INDEX idx_cortex_entities_embedding ON cortex_entities 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Full-text search index
CREATE INDEX idx_cortex_entities_fts ON cortex_entities 
    USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ============================================================================
-- KNOWLEDGE RELATIONSHIPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS cortex_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    source_entity_id UUID NOT NULL REFERENCES cortex_entities(id) ON DELETE CASCADE,
    target_entity_id UUID NOT NULL REFERENCES cortex_entities(id) ON DELETE CASCADE,
    
    relationship_type VARCHAR(50) NOT NULL,
    custom_type VARCHAR(100),
    
    weight DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    confidence DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    properties JSONB NOT NULL DEFAULT '{}',
    bidirectional BOOLEAN NOT NULL DEFAULT false,
    
    -- Temporal validity
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    
    -- Source tracking
    source_type VARCHAR(50) NOT NULL,
    source_id UUID,
    source_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate relationships
    UNIQUE(tenant_id, source_entity_id, target_entity_id, relationship_type)
);

-- Indexes for cortex_relationships
CREATE INDEX idx_cortex_relationships_tenant ON cortex_relationships(tenant_id);
CREATE INDEX idx_cortex_relationships_source ON cortex_relationships(source_entity_id);
CREATE INDEX idx_cortex_relationships_target ON cortex_relationships(target_entity_id);
CREATE INDEX idx_cortex_relationships_type ON cortex_relationships(tenant_id, relationship_type);

-- ============================================================================
-- KNOWLEDGE CHUNKS (for RAG retrieval)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cortex_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    entity_id UUID REFERENCES cortex_entities(id) ON DELETE SET NULL,
    
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    
    -- Vector embedding
    embedding vector(1536) NOT NULL,
    embedding_model VARCHAR(100) NOT NULL,
    
    -- Metadata
    document_id UUID,
    conversation_id UUID,
    message_id UUID,
    page_number INTEGER,
    section_title VARCHAR(500),
    language VARCHAR(10) DEFAULT 'en',
    word_count INTEGER NOT NULL,
    token_count INTEGER NOT NULL,
    
    -- Source tracking
    source_type VARCHAR(50) NOT NULL,
    source_id UUID,
    source_url TEXT,
    source_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_user_id UUID,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for cortex_chunks
CREATE INDEX idx_cortex_chunks_tenant ON cortex_chunks(tenant_id);
CREATE INDEX idx_cortex_chunks_entity ON cortex_chunks(entity_id);
CREATE INDEX idx_cortex_chunks_document ON cortex_chunks(tenant_id, document_id);
CREATE INDEX idx_cortex_chunks_conversation ON cortex_chunks(tenant_id, conversation_id);
CREATE INDEX idx_cortex_chunks_hash ON cortex_chunks(tenant_id, content_hash);

-- Vector similarity index for chunks
CREATE INDEX idx_cortex_chunks_embedding ON cortex_chunks 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- ACTIVITY LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS cortex_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    activity_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    user_id UUID,
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cortex_activity_tenant ON cortex_activity_log(tenant_id, created_at DESC);

-- ============================================================================
-- QUERY LOG (for analytics and optimization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cortex_query_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    query_text TEXT NOT NULL,
    query_embedding vector(1536),
    
    filters JSONB DEFAULT '{}',
    options JSONB DEFAULT '{}',
    
    results_count INTEGER NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    
    user_id UUID,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cortex_query_log_tenant ON cortex_query_log(tenant_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE cortex_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cortex_query_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cortex_config
CREATE POLICY cortex_config_tenant_isolation ON cortex_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- RLS Policies for cortex_entities
CREATE POLICY cortex_entities_tenant_isolation ON cortex_entities
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- RLS Policies for cortex_relationships
CREATE POLICY cortex_relationships_tenant_isolation ON cortex_relationships
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- RLS Policies for cortex_chunks
CREATE POLICY cortex_chunks_tenant_isolation ON cortex_chunks
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- RLS Policies for cortex_activity_log
CREATE POLICY cortex_activity_log_tenant_isolation ON cortex_activity_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- RLS Policies for cortex_query_log
CREATE POLICY cortex_query_log_tenant_isolation ON cortex_query_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to search entities by vector similarity
CREATE OR REPLACE FUNCTION search_cortex_entities(
    p_tenant_id UUID,
    p_embedding vector(1536),
    p_limit INTEGER DEFAULT 10,
    p_min_similarity DECIMAL DEFAULT 0.7,
    p_entity_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    entity_type VARCHAR,
    name VARCHAR,
    description TEXT,
    similarity DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.entity_type,
        e.name,
        e.description,
        1 - (e.embedding <=> p_embedding) AS similarity
    FROM cortex_entities e
    WHERE e.tenant_id = p_tenant_id
        AND e.is_active = true
        AND e.embedding IS NOT NULL
        AND (p_entity_types IS NULL OR e.entity_type = ANY(p_entity_types))
        AND 1 - (e.embedding <=> p_embedding) >= p_min_similarity
    ORDER BY e.embedding <=> p_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to search chunks by vector similarity
CREATE OR REPLACE FUNCTION search_cortex_chunks(
    p_tenant_id UUID,
    p_embedding vector(1536),
    p_limit INTEGER DEFAULT 10,
    p_min_similarity DECIMAL DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    entity_id UUID,
    similarity DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.content,
        c.entity_id,
        1 - (c.embedding <=> p_embedding) AS similarity
    FROM cortex_chunks c
    WHERE c.tenant_id = p_tenant_id
        AND 1 - (c.embedding <=> p_embedding) >= p_min_similarity
    ORDER BY c.embedding <=> p_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get entity neighbors (graph traversal)
CREATE OR REPLACE FUNCTION get_entity_neighbors(
    p_tenant_id UUID,
    p_entity_id UUID,
    p_depth INTEGER DEFAULT 1,
    p_relationship_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    entity_id UUID,
    entity_type VARCHAR,
    entity_name VARCHAR,
    relationship_id UUID,
    relationship_type VARCHAR,
    direction VARCHAR,
    depth INTEGER
) AS $$
WITH RECURSIVE neighbors AS (
    -- Base case: direct neighbors
    SELECT 
        CASE WHEN r.source_entity_id = p_entity_id THEN r.target_entity_id ELSE r.source_entity_id END AS entity_id,
        r.id AS relationship_id,
        r.relationship_type,
        CASE WHEN r.source_entity_id = p_entity_id THEN 'outgoing' ELSE 'incoming' END AS direction,
        1 AS depth
    FROM cortex_relationships r
    WHERE r.tenant_id = p_tenant_id
        AND (r.source_entity_id = p_entity_id OR (r.target_entity_id = p_entity_id AND r.bidirectional))
        AND (p_relationship_types IS NULL OR r.relationship_type = ANY(p_relationship_types))
    
    UNION ALL
    
    -- Recursive case: neighbors of neighbors
    SELECT 
        CASE WHEN r.source_entity_id = n.entity_id THEN r.target_entity_id ELSE r.source_entity_id END,
        r.id,
        r.relationship_type,
        CASE WHEN r.source_entity_id = n.entity_id THEN 'outgoing' ELSE 'incoming' END,
        n.depth + 1
    FROM cortex_relationships r
    JOIN neighbors n ON (r.source_entity_id = n.entity_id OR (r.target_entity_id = n.entity_id AND r.bidirectional))
    WHERE r.tenant_id = p_tenant_id
        AND n.depth < p_depth
        AND (p_relationship_types IS NULL OR r.relationship_type = ANY(p_relationship_types))
)
SELECT 
    n.entity_id,
    e.entity_type,
    e.name AS entity_name,
    n.relationship_id,
    n.relationship_type,
    n.direction,
    n.depth
FROM neighbors n
JOIN cortex_entities e ON e.id = n.entity_id
WHERE e.is_active = true;
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_cortex_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cortex_config_updated_at
    BEFORE UPDATE ON cortex_config
    FOR EACH ROW EXECUTE FUNCTION update_cortex_updated_at();

CREATE TRIGGER cortex_entities_updated_at
    BEFORE UPDATE ON cortex_entities
    FOR EACH ROW EXECUTE FUNCTION update_cortex_updated_at();

CREATE TRIGGER cortex_relationships_updated_at
    BEFORE UPDATE ON cortex_relationships
    FOR EACH ROW EXECUTE FUNCTION update_cortex_updated_at();

CREATE TRIGGER cortex_chunks_updated_at
    BEFORE UPDATE ON cortex_chunks
    FOR EACH ROW EXECUTE FUNCTION update_cortex_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE cortex_config IS 'Per-tenant configuration for Cortex Graph-RAG';
COMMENT ON TABLE cortex_entities IS 'Knowledge graph entities with vector embeddings';
COMMENT ON TABLE cortex_relationships IS 'Typed relationships between entities';
COMMENT ON TABLE cortex_chunks IS 'Text chunks with embeddings for RAG retrieval';
COMMENT ON TABLE cortex_activity_log IS 'Activity log for Cortex operations';
COMMENT ON TABLE cortex_query_log IS 'Query log for analytics and optimization';
