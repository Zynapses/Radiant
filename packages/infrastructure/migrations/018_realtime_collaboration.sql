-- RADIANT v4.17.0 - Migration 018: Real-time Collaboration
-- Collaborative editing using Yjs CRDT

CREATE TABLE collaboration_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    room_name VARCHAR(100) NOT NULL,
    room_type VARCHAR(50) NOT NULL DEFAULT 'document' CHECK (room_type IN ('document', 'canvas', 'whiteboard', 'code')),
    created_by UUID NOT NULL REFERENCES users(id),
    yjs_document BYTEA,
    is_active BOOLEAN DEFAULT true,
    max_participants INTEGER DEFAULT 10 CHECK (max_participants >= 1 AND max_participants <= 50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE room_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES collaboration_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(20) NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
    cursor_position JSONB,
    is_online BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

CREATE TABLE collaboration_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES collaboration_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL,
    action_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_collab_rooms_tenant ON collaboration_rooms(tenant_id);
CREATE INDEX idx_collab_rooms_creator ON collaboration_rooms(created_by);
CREATE INDEX idx_room_participants_room ON room_participants(room_id);
CREATE INDEX idx_room_participants_user ON room_participants(user_id);
CREATE INDEX idx_room_participants_online ON room_participants(is_online) WHERE is_online = true;
CREATE INDEX idx_collab_history ON collaboration_history(room_id, created_at DESC);

ALTER TABLE collaboration_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY collab_rooms_isolation ON collaboration_rooms
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY room_participants_isolation ON room_participants
    FOR ALL USING (
        room_id IN (SELECT id FROM collaboration_rooms WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    );

CREATE POLICY collab_history_isolation ON collaboration_history
    FOR ALL USING (
        room_id IN (SELECT id FROM collaboration_rooms WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    );

CREATE TRIGGER update_collaboration_rooms_updated_at 
    BEFORE UPDATE ON collaboration_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
