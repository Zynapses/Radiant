-- RADIANT v4.17.0 - Migration 017: Concurrent Chat & Split-Pane
-- Multiple AI conversations simultaneously with split-pane interface

CREATE TABLE concurrent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_name VARCHAR(100),
    layout_config JSONB NOT NULL DEFAULT '{"type": "horizontal", "panes": []}',
    max_panes INTEGER DEFAULT 4 CHECK (max_panes >= 1 AND max_panes <= 8),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE concurrent_panes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES concurrent_sessions(id) ON DELETE CASCADE,
    pane_index INTEGER NOT NULL CHECK (pane_index >= 0),
    chat_id UUID,
    model VARCHAR(100),
    status VARCHAR(20) DEFAULT 'idle' CHECK (status IN ('idle', 'streaming', 'error', 'complete')),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, pane_index)
);

CREATE TABLE concurrent_sync_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES concurrent_sessions(id) ON DELETE CASCADE UNIQUE,
    sync_mode VARCHAR(20) NOT NULL DEFAULT 'independent' CHECK (sync_mode IN ('independent', 'synchronized', 'broadcast')),
    shared_context TEXT,
    sync_cursor INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_concurrent_sessions_user ON concurrent_sessions(tenant_id, user_id);
CREATE INDEX idx_concurrent_sessions_active ON concurrent_sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_concurrent_panes_session ON concurrent_panes(session_id);

ALTER TABLE concurrent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE concurrent_panes ENABLE ROW LEVEL SECURITY;
ALTER TABLE concurrent_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY concurrent_sessions_isolation ON concurrent_sessions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY concurrent_panes_isolation ON concurrent_panes
    FOR ALL USING (
        session_id IN (SELECT id FROM concurrent_sessions WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    );

CREATE POLICY concurrent_sync_isolation ON concurrent_sync_state
    FOR ALL USING (
        session_id IN (SELECT id FROM concurrent_sessions WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    );

CREATE TRIGGER update_concurrent_sessions_updated_at 
    BEFORE UPDATE ON concurrent_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_concurrent_sync_state_updated_at 
    BEFORE UPDATE ON concurrent_sync_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
