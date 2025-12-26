-- ============================================================================
-- RADIANT v4.17.0 - Think Tank Conversations Migration
-- Consumer chat conversations and messages for Think Tank platform
-- ============================================================================

-- Think Tank user conversations
CREATE TABLE thinktank_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500),
    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0,
    primary_model VARCHAR(100),
    domain_mode VARCHAR(50),
    persona_id UUID REFERENCES user_personas(id) ON DELETE SET NULL,
    focus_mode_id UUID REFERENCES focus_modes(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Think Tank messages within conversations
CREATE TABLE thinktank_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES thinktank_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    model VARCHAR(100),
    tokens_used INTEGER,
    cost DECIMAL(10, 6),
    latency_ms INTEGER,
    metadata JSONB DEFAULT '{}',
    parent_message_id UUID REFERENCES thinktank_messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_thinktank_conv_tenant ON thinktank_conversations(tenant_id);
CREATE INDEX idx_thinktank_conv_user ON thinktank_conversations(user_id);
CREATE INDEX idx_thinktank_conv_updated ON thinktank_conversations(updated_at DESC);
CREATE INDEX idx_thinktank_conv_status ON thinktank_conversations(status);
CREATE INDEX idx_thinktank_msg_conv ON thinktank_messages(conversation_id);
CREATE INDEX idx_thinktank_msg_created ON thinktank_messages(created_at);

-- Row level security
ALTER TABLE thinktank_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE thinktank_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY thinktank_conversations_isolation ON thinktank_conversations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY thinktank_messages_isolation ON thinktank_messages
    FOR ALL USING (
        conversation_id IN (
            SELECT id FROM thinktank_conversations 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

-- Trigger to update conversation stats
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE thinktank_conversations
    SET 
        message_count = message_count + 1,
        total_tokens = total_tokens + COALESCE(NEW.tokens_used, 0),
        total_cost = total_cost + COALESCE(NEW.cost, 0),
        primary_model = COALESCE(NEW.model, primary_model),
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thinktank_message_stats_trigger
    AFTER INSERT ON thinktank_messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_stats();

-- Auto-generate title from first message if not set
CREATE OR REPLACE FUNCTION auto_title_conversation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'user' THEN
        UPDATE thinktank_conversations
        SET title = COALESCE(title, LEFT(NEW.content, 100))
        WHERE id = NEW.conversation_id AND title IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thinktank_auto_title_trigger
    AFTER INSERT ON thinktank_messages
    FOR EACH ROW EXECUTE FUNCTION auto_title_conversation();
