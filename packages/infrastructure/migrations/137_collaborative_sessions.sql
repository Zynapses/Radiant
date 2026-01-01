-- ============================================================================
-- RADIANT v4.18.0 - Collaborative Sessions Migration
-- Real-time collaborative conversation sharing (Google Docs-style)
-- ============================================================================

-- Collaborative sessions - a shared workspace for conversations
CREATE TABLE collaborative_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES thinktank_conversations(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Session metadata
    name VARCHAR(255),
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366f1', -- Session accent color
    
    -- Access settings
    access_type VARCHAR(20) DEFAULT 'invite' CHECK (access_type IN ('invite', 'link', 'public')),
    link_token VARCHAR(64) UNIQUE,
    default_permission VARCHAR(20) DEFAULT 'viewer' CHECK (default_permission IN ('viewer', 'commenter', 'editor')),
    
    -- Session state
    is_active BOOLEAN DEFAULT true,
    max_participants INTEGER DEFAULT 50,
    allow_anonymous BOOLEAN DEFAULT false,
    require_approval BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_conversation_session UNIQUE (conversation_id)
);

-- Session participants
CREATE TABLE session_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Anonymous participant support
    anonymous_id VARCHAR(64),
    anonymous_name VARCHAR(100),
    
    -- Permissions
    permission VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (permission IN ('owner', 'editor', 'commenter', 'viewer')),
    
    -- Invitation tracking
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    joined_at TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined', 'removed', 'left')),
    
    -- Presence (updated by WebSocket)
    is_online BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMPTZ,
    cursor_position JSONB, -- { messageId, offset }
    
    -- Participant color for presence indicators
    color VARCHAR(7),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_session_user UNIQUE (session_id, user_id),
    CONSTRAINT unique_session_anonymous UNIQUE (session_id, anonymous_id),
    CONSTRAINT require_user_or_anonymous CHECK (user_id IS NOT NULL OR anonymous_id IS NOT NULL)
);

-- Session messages (separate from main conversation for collaboration features)
CREATE TABLE session_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    conversation_message_id UUID REFERENCES thinktank_messages(id) ON DELETE SET NULL,
    
    -- Author
    participant_id UUID NOT NULL REFERENCES session_participants(id) ON DELETE CASCADE,
    
    -- Message content
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    model VARCHAR(100),
    
    -- Collaboration metadata
    is_typing BOOLEAN DEFAULT false,
    typing_content TEXT, -- Partial content while typing
    
    -- Thread support
    parent_message_id UUID REFERENCES session_messages(id) ON DELETE SET NULL,
    thread_count INTEGER DEFAULT 0,
    
    -- Reactions
    reactions JSONB DEFAULT '{}', -- { "👍": ["user1", "user2"], "❤️": ["user3"] }
    
    -- Token/cost tracking
    tokens_used INTEGER,
    cost DECIMAL(10, 6),
    latency_ms INTEGER,
    
    -- Status
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('typing', 'sent', 'delivered', 'edited', 'deleted')),
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments on messages (Google Docs-style commenting)
CREATE TABLE session_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES session_messages(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES session_participants(id) ON DELETE CASCADE,
    
    -- Comment content
    content TEXT NOT NULL,
    
    -- Selection range (for highlighting specific text)
    selection_start INTEGER,
    selection_end INTEGER,
    selected_text TEXT,
    
    -- Thread support
    parent_comment_id UUID REFERENCES session_comments(id) ON DELETE CASCADE,
    
    -- Resolution
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES session_participants(id),
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log for audit trail
CREATE TABLE session_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES session_participants(id) ON DELETE SET NULL,
    
    -- Activity details
    activity_type VARCHAR(50) NOT NULL,
    activity_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WebSocket connections (for presence tracking)
CREATE TABLE session_connections (
    connection_id VARCHAR(128) PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES session_participants(id) ON DELETE CASCADE,
    
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_ping_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Connection metadata
    user_agent TEXT,
    ip_address VARCHAR(45)
);

-- Indexes
CREATE INDEX idx_collab_sessions_tenant ON collaborative_sessions(tenant_id);
CREATE INDEX idx_collab_sessions_owner ON collaborative_sessions(owner_id);
CREATE INDEX idx_collab_sessions_conversation ON collaborative_sessions(conversation_id);
CREATE INDEX idx_collab_sessions_link ON collaborative_sessions(link_token) WHERE link_token IS NOT NULL;
CREATE INDEX idx_collab_sessions_active ON collaborative_sessions(is_active, last_activity_at DESC);

CREATE INDEX idx_session_participants_session ON session_participants(session_id);
CREATE INDEX idx_session_participants_user ON session_participants(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_session_participants_online ON session_participants(session_id, is_online) WHERE is_online = true;

CREATE INDEX idx_session_messages_session ON session_messages(session_id, created_at DESC);
CREATE INDEX idx_session_messages_participant ON session_messages(participant_id);
CREATE INDEX idx_session_messages_parent ON session_messages(parent_message_id) WHERE parent_message_id IS NOT NULL;

CREATE INDEX idx_session_comments_message ON session_comments(message_id);
CREATE INDEX idx_session_comments_unresolved ON session_comments(session_id, is_resolved) WHERE is_resolved = false;

CREATE INDEX idx_session_activity ON session_activity_log(session_id, created_at DESC);
CREATE INDEX idx_session_connections ON session_connections(session_id);

-- Row Level Security
ALTER TABLE collaborative_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_connections ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY collab_sessions_isolation ON collaborative_sessions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY session_participants_isolation ON session_participants
    FOR ALL USING (
        session_id IN (
            SELECT id FROM collaborative_sessions 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

CREATE POLICY session_messages_isolation ON session_messages
    FOR ALL USING (
        session_id IN (
            SELECT id FROM collaborative_sessions 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

CREATE POLICY session_comments_isolation ON session_comments
    FOR ALL USING (
        session_id IN (
            SELECT id FROM collaborative_sessions 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

CREATE POLICY session_activity_isolation ON session_activity_log
    FOR ALL USING (
        session_id IN (
            SELECT id FROM collaborative_sessions 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

CREATE POLICY session_connections_isolation ON session_connections
    FOR ALL USING (
        session_id IN (
            SELECT id FROM collaborative_sessions 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

-- Triggers
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE collaborative_sessions 
    SET last_activity_at = NOW(), updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_message_activity
    AFTER INSERT ON session_messages
    FOR EACH ROW EXECUTE FUNCTION update_session_activity();

-- Generate link token
CREATE OR REPLACE FUNCTION generate_session_link_token()
RETURNS VARCHAR(64) AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Assign participant colors
CREATE OR REPLACE FUNCTION assign_participant_color()
RETURNS TRIGGER AS $$
DECLARE
    colors TEXT[] := ARRAY['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];
    participant_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO participant_count FROM session_participants WHERE session_id = NEW.session_id;
    NEW.color := colors[(participant_count % array_length(colors, 1)) + 1];
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assign_color_trigger
    BEFORE INSERT ON session_participants
    FOR EACH ROW EXECUTE FUNCTION assign_participant_color();

-- Log activities
CREATE OR REPLACE FUNCTION log_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'session_participants' THEN
        INSERT INTO session_activity_log (session_id, participant_id, activity_type, activity_data)
        VALUES (NEW.session_id, NEW.id, 'participant_joined', jsonb_build_object('status', NEW.status));
    ELSIF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'session_messages' THEN
        INSERT INTO session_activity_log (session_id, participant_id, activity_type, activity_data)
        VALUES (NEW.session_id, NEW.participant_id, 'message_sent', jsonb_build_object('message_id', NEW.id, 'role', NEW.role));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_participant_activity
    AFTER INSERT ON session_participants
    FOR EACH ROW EXECUTE FUNCTION log_session_activity();

CREATE TRIGGER log_message_activity
    AFTER INSERT ON session_messages
    FOR EACH ROW EXECUTE FUNCTION log_session_activity();
