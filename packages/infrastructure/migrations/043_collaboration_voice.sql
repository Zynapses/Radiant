-- ============================================================================
-- RADIANT v4.17.0 - Collaboration & Voice/Video Migration
-- Real-time collaboration sessions and voice/video support
-- ============================================================================

-- Collaboration sessions
CREATE TABLE collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_id UUID NOT NULL,
    document_type VARCHAR(20) NOT NULL CHECK (document_type IN ('chat', 'canvas', 'artifact')),
    created_by UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collaboration participants
CREATE TABLE collaboration_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    display_name VARCHAR(200),
    color VARCHAR(20),
    cursor_position JSONB,
    selection JSONB,
    is_online BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, user_id)
);

-- Collaboration updates (CRDT operations)
CREATE TABLE collaboration_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    update_type VARCHAR(30) NOT NULL CHECK (update_type IN ('insert', 'delete', 'format', 'cursor', 'selection')),
    payload JSONB NOT NULL,
    vector_clock JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Result merge log for concurrent queries
CREATE TABLE result_merge_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID,
    strategy VARCHAR(30) NOT NULL CHECK (strategy IN ('best', 'consensus', 'synthesis', 'weighted', 'chain')),
    sources JSONB NOT NULL,
    total_tokens INTEGER,
    processing_time_ms INTEGER,
    confidence DECIMAL(4, 3),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User preferences table (if not exists)
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    preference_key VARCHAR(100) NOT NULL,
    preference_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, preference_key)
);

-- Indexes
CREATE INDEX idx_collab_sessions_tenant ON collaboration_sessions(tenant_id);
CREATE INDEX idx_collab_sessions_document ON collaboration_sessions(document_id);
CREATE INDEX idx_collab_participants_session ON collaboration_participants(session_id);
CREATE INDEX idx_collab_participants_user ON collaboration_participants(user_id);
CREATE INDEX idx_collab_updates_session ON collaboration_updates(session_id);
CREATE INDEX idx_collab_updates_created ON collaboration_updates(created_at);
CREATE INDEX idx_result_merge_tenant ON result_merge_log(tenant_id);
CREATE INDEX idx_user_prefs_user ON user_preferences(user_id);

-- Row level security
ALTER TABLE collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_merge_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY collab_sessions_isolation ON collaboration_sessions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY collab_participants_isolation ON collaboration_participants
    FOR ALL USING (
        session_id IN (
            SELECT id FROM collaboration_sessions 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

CREATE POLICY collab_updates_isolation ON collaboration_updates
    FOR ALL USING (
        session_id IN (
            SELECT id FROM collaboration_sessions 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

CREATE POLICY result_merge_isolation ON result_merge_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY user_prefs_isolation ON user_preferences
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Triggers for updated_at
CREATE TRIGGER update_collab_sessions_timestamp
    BEFORE UPDATE ON collaboration_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_prefs_timestamp
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
