-- RADIANT v4.17.0 - Migration 023: Time Machine
-- Apple Time Machine-inspired chat history versioning

CREATE TABLE time_machine_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    version INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    message_count INTEGER DEFAULT 0,
    file_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    
    trigger VARCHAR(50) NOT NULL CHECK (trigger IN (
        'message_sent', 'message_received', 'message_edited', 'message_deleted',
        'file_uploaded', 'file_generated', 'file_deleted',
        'chat_renamed', 'restore_performed', 'manual_snapshot'
    )),
    trigger_details JSONB DEFAULT '{}',
    
    previous_snapshot_id UUID REFERENCES time_machine_snapshots(id),
    restored_from_snapshot_id UUID REFERENCES time_machine_snapshots(id),
    
    checksum VARCHAR(64) NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE message_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    snapshot_id UUID NOT NULL REFERENCES time_machine_snapshots(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    model_id VARCHAR(100),
    
    version INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_soft_deleted BOOLEAN DEFAULT false,
    
    edit_reason TEXT,
    edited_by UUID,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    superseded_at TIMESTAMPTZ
);

CREATE TABLE media_vault (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    message_id UUID,
    snapshot_id UUID NOT NULL REFERENCES time_machine_snapshots(id) ON DELETE CASCADE,
    
    original_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    
    s3_bucket VARCHAR(100) NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    s3_version_id VARCHAR(100),
    
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    
    thumbnail_s3_key VARCHAR(500),
    preview_generated BOOLEAN DEFAULT false,
    
    version INTEGER NOT NULL DEFAULT 1,
    previous_version_id UUID REFERENCES media_vault(id),
    
    source VARCHAR(20) NOT NULL CHECK (source IN ('user_upload', 'ai_generated', 'system')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'processing', 'archived', 'soft_deleted')),
    
    extracted_text TEXT,
    ai_description TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

CREATE TABLE restore_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    chat_id UUID NOT NULL,
    
    source_snapshot_id UUID NOT NULL REFERENCES time_machine_snapshots(id),
    target_snapshot_id UUID NOT NULL REFERENCES time_machine_snapshots(id),
    
    restore_scope VARCHAR(20) NOT NULL CHECK (restore_scope IN (
        'full_chat', 'single_message', 'single_file', 'message_range', 'files_only'
    )),
    restore_details JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshots_chat ON time_machine_snapshots(chat_id, version DESC);
CREATE INDEX idx_snapshots_tenant ON time_machine_snapshots(tenant_id, timestamp DESC);
CREATE INDEX idx_snapshots_trigger ON time_machine_snapshots(trigger);
CREATE INDEX idx_message_versions_message ON message_versions(message_id, version DESC);
CREATE INDEX idx_message_versions_snapshot ON message_versions(snapshot_id);
CREATE INDEX idx_message_versions_active ON message_versions(is_active) WHERE is_active = true;
CREATE INDEX idx_media_vault_chat ON media_vault(chat_id);
CREATE INDEX idx_media_vault_snapshot ON media_vault(snapshot_id);
CREATE INDEX idx_media_vault_status ON media_vault(status);
CREATE INDEX idx_restore_log_chat ON restore_log(chat_id, created_at DESC);

ALTER TABLE time_machine_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE restore_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY snapshots_isolation ON time_machine_snapshots
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY message_versions_isolation ON message_versions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY media_vault_isolation ON media_vault
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY restore_log_isolation ON restore_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Function to create a snapshot
CREATE OR REPLACE FUNCTION create_time_machine_snapshot(
    p_chat_id UUID,
    p_tenant_id UUID,
    p_trigger VARCHAR(50),
    p_trigger_details JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_snapshot_id UUID;
    v_version INTEGER;
    v_previous_id UUID;
    v_message_count INTEGER;
    v_file_count INTEGER;
    v_checksum VARCHAR(64);
BEGIN
    -- Get next version number
    SELECT COALESCE(MAX(version), 0) + 1, id
    INTO v_version, v_previous_id
    FROM time_machine_snapshots
    WHERE chat_id = p_chat_id
    GROUP BY id
    ORDER BY version DESC
    LIMIT 1;
    
    v_version := COALESCE(v_version, 1);
    
    -- Count current messages and files
    SELECT COUNT(*) INTO v_message_count
    FROM message_versions
    WHERE snapshot_id IN (SELECT id FROM time_machine_snapshots WHERE chat_id = p_chat_id)
    AND is_active = true AND is_soft_deleted = false;
    
    SELECT COUNT(*) INTO v_file_count
    FROM media_vault
    WHERE chat_id = p_chat_id AND status = 'active';
    
    -- Generate checksum (simplified)
    v_checksum := encode(sha256(p_chat_id::text || v_version::text || NOW()::text), 'hex');
    
    INSERT INTO time_machine_snapshots (
        chat_id, tenant_id, version, trigger, trigger_details,
        message_count, file_count, previous_snapshot_id, checksum
    ) VALUES (
        p_chat_id, p_tenant_id, v_version, p_trigger, p_trigger_details,
        v_message_count, v_file_count, v_previous_id, v_checksum
    ) RETURNING id INTO v_snapshot_id;
    
    RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql;
