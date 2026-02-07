-- ============================================================================
-- RADIANT v4.18.0 - Think Tank Shared Conversations Migration
-- Allows users to share conversations via public links
-- ============================================================================

-- Shared conversation links
CREATE TABLE thinktank_shared_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES thinktank_conversations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_token VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(500),
    description TEXT,
    is_public BOOLEAN DEFAULT true,
    allow_copy BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    view_count INTEGER DEFAULT 0,
    max_views INTEGER,
    password_hash VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Access log for shared conversations
CREATE TABLE thinktank_share_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL REFERENCES thinktank_shared_conversations(id) ON DELETE CASCADE,
    accessor_ip VARCHAR(45),
    accessor_user_id UUID REFERENCES users(id),
    user_agent TEXT,
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_shared_conv_token ON thinktank_shared_conversations(share_token);
CREATE INDEX idx_shared_conv_conversation ON thinktank_shared_conversations(conversation_id);
CREATE INDEX idx_shared_conv_tenant ON thinktank_shared_conversations(tenant_id);
CREATE INDEX idx_shared_conv_user ON thinktank_shared_conversations(shared_by);
CREATE INDEX idx_share_access_log ON thinktank_share_access_log(share_id, accessed_at DESC);

-- Row level security
ALTER TABLE thinktank_shared_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE thinktank_share_access_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own shares
CREATE POLICY thinktank_shared_conv_owner ON thinktank_shared_conversations
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id')::UUID AND
        shared_by = current_setting('app.user_id')::UUID
    );

-- Policy: Anyone can view public shares (for public access endpoint)
CREATE POLICY thinktank_shared_conv_public ON thinktank_shared_conversations
    FOR SELECT USING (is_public = true);

CREATE POLICY thinktank_share_access_isolation ON thinktank_share_access_log
    FOR ALL USING (
        share_id IN (
            SELECT id FROM thinktank_shared_conversations 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

-- Function to generate secure share token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS VARCHAR(64) AS $$
DECLARE
    token VARCHAR(64);
BEGIN
    -- Generate a URL-safe base64-like token
    token := encode(gen_random_bytes(32), 'hex');
    RETURN token;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate share token
CREATE OR REPLACE FUNCTION set_share_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.share_token IS NULL THEN
        NEW.share_token := generate_share_token();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thinktank_shared_conv_token_trigger
    BEFORE INSERT ON thinktank_shared_conversations
    FOR EACH ROW EXECUTE FUNCTION set_share_token();

-- Trigger to increment view count
CREATE OR REPLACE FUNCTION increment_share_view_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE thinktank_shared_conversations
    SET view_count = view_count + 1
    WHERE id = NEW.share_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thinktank_share_view_trigger
    AFTER INSERT ON thinktank_share_access_log
    FOR EACH ROW EXECUTE FUNCTION increment_share_view_count();
