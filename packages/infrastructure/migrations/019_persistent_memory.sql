-- RADIANT v4.17.0 - Migration 019: Persistent Memory
-- Long-term memory with pgvector embeddings

CREATE TABLE memory_stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_name VARCHAR(100) NOT NULL DEFAULT 'default',
    embedding_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
    total_memories INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, store_name)
);

CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES memory_stores(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536),
    memory_type VARCHAR(50) DEFAULT 'fact' CHECK (memory_type IN ('fact', 'preference', 'context', 'instruction', 'conversation', 'skill')),
    source VARCHAR(100),
    importance DECIMAL(3, 2) DEFAULT 0.50 CHECK (importance >= 0 AND importance <= 1),
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE memory_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    target_memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN ('related', 'contradicts', 'supports', 'supersedes', 'derived_from')),
    strength DECIMAL(3, 2) DEFAULT 0.50 CHECK (strength >= 0 AND strength <= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_memory_id, target_memory_id, relationship_type)
);

CREATE INDEX idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_memories_store ON memories(store_id);
CREATE INDEX idx_memories_type ON memories(memory_type);
CREATE INDEX idx_memories_importance ON memories(importance DESC);
CREATE INDEX idx_memory_stores_user ON memory_stores(tenant_id, user_id);
CREATE INDEX idx_memory_relationships_source ON memory_relationships(source_memory_id);
CREATE INDEX idx_memory_relationships_target ON memory_relationships(target_memory_id);

ALTER TABLE memory_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY memory_stores_isolation ON memory_stores
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY memories_isolation ON memories
    FOR ALL USING (
        store_id IN (SELECT id FROM memory_stores WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    );

CREATE POLICY memory_relationships_isolation ON memory_relationships
    FOR ALL USING (
        source_memory_id IN (
            SELECT m.id FROM memories m 
            JOIN memory_stores ms ON m.store_id = ms.id 
            WHERE ms.tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

-- Function to search memories by similarity
CREATE OR REPLACE FUNCTION search_memories_by_embedding(
    p_store_id UUID,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 5,
    p_min_similarity FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    memory_type VARCHAR(50),
    importance DECIMAL(3, 2),
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.content,
        m.memory_type,
        m.importance,
        (1 - (m.embedding <=> p_query_embedding))::FLOAT as similarity
    FROM memories m
    WHERE m.store_id = p_store_id
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
    AND (1 - (m.embedding <=> p_query_embedding)) >= p_min_similarity
    ORDER BY m.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
