-- RADIANT v4.17.0 - Migration 013: User Neural Engine
-- Personalization with embeddings and learned preferences

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preference_key VARCHAR(100) NOT NULL,
    preference_value JSONB NOT NULL,
    confidence DECIMAL(3, 2) DEFAULT 0.50 CHECK (confidence >= 0 AND confidence <= 1),
    learned_from TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, preference_key)
);

CREATE TABLE user_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    memory_type VARCHAR(50) NOT NULL CHECK (memory_type IN ('fact', 'preference', 'context', 'instruction', 'conversation')),
    content TEXT NOT NULL,
    embedding vector(1536),
    importance DECIMAL(3, 2) DEFAULT 0.50 CHECK (importance >= 0 AND importance <= 1),
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_behavior_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pattern_type VARCHAR(50) NOT NULL,
    pattern_data JSONB NOT NULL DEFAULT '{}',
    occurrence_count INTEGER DEFAULT 1,
    last_occurred TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vector similarity search index
CREATE INDEX idx_user_memory_embedding ON user_memory 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_user_preferences_user ON user_preferences(tenant_id, user_id);
CREATE INDEX idx_user_memory_user ON user_memory(tenant_id, user_id);
CREATE INDEX idx_user_memory_type ON user_memory(memory_type);
CREATE INDEX idx_user_patterns_user ON user_behavior_patterns(tenant_id, user_id);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behavior_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_preferences_isolation ON user_preferences
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY user_memory_isolation ON user_memory
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY user_patterns_isolation ON user_behavior_patterns
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Function to search memories by similarity
CREATE OR REPLACE FUNCTION search_user_memories(
    p_tenant_id UUID,
    p_user_id UUID,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 5
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
        um.id,
        um.content,
        um.memory_type,
        um.importance,
        1 - (um.embedding <=> p_query_embedding) as similarity
    FROM user_memory um
    WHERE um.tenant_id = p_tenant_id 
    AND um.user_id = p_user_id
    AND (um.expires_at IS NULL OR um.expires_at > NOW())
    ORDER BY um.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
