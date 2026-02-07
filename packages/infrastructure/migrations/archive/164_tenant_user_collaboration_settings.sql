-- Migration: 164_tenant_user_collaboration_settings.sql
-- Purpose: Tenant and user-level collaboration settings with override hierarchy
-- Version: 5.18.0

-- =============================================================================
-- TENANT-LEVEL COLLABORATION SETTINGS (Master control)
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenant_collaboration_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Core Chat Features
    enable_collaborative_chat BOOLEAN DEFAULT true,
    enable_intra_tenant_chat BOOLEAN DEFAULT true,  -- Chat with co-users in same tenant
    enable_guest_access BOOLEAN DEFAULT true,       -- Allow guests from outside tenant
    
    -- Enhanced Collaboration Features
    enable_ai_facilitator BOOLEAN DEFAULT true,
    enable_branch_merge BOOLEAN DEFAULT true,
    enable_time_shifted_playback BOOLEAN DEFAULT true,
    enable_ai_roundtable BOOLEAN DEFAULT true,
    enable_knowledge_graph BOOLEAN DEFAULT true,
    enable_media_notes BOOLEAN DEFAULT true,
    enable_attachments BOOLEAN DEFAULT true,
    
    -- Guest Access Limits
    max_guests_per_session INTEGER DEFAULT 10,
    max_guest_sessions_per_month INTEGER DEFAULT 100,
    default_guest_permission VARCHAR(20) DEFAULT 'commenter' 
        CHECK (default_guest_permission IN ('viewer', 'commenter', 'editor')),
    guest_invite_expiry_hours INTEGER DEFAULT 168,  -- 7 days
    require_guest_email BOOLEAN DEFAULT false,
    
    -- Session Limits
    max_sessions_per_user INTEGER DEFAULT 50,
    max_participants_per_session INTEGER DEFAULT 50,
    max_branches_per_session INTEGER DEFAULT 10,
    max_recordings_per_session INTEGER DEFAULT 5,
    max_roundtables_per_session INTEGER DEFAULT 3,
    
    -- Storage Limits
    max_attachment_size_mb INTEGER DEFAULT 100,
    max_media_note_duration_seconds INTEGER DEFAULT 300,  -- 5 minutes
    attachment_retention_days INTEGER DEFAULT 90,
    recording_retention_days INTEGER DEFAULT 365,
    
    -- AI Facilitator Defaults
    default_facilitator_persona VARCHAR(20) DEFAULT 'professional',
    facilitator_intervention_frequency VARCHAR(20) DEFAULT 'moderate'
        CHECK (facilitator_intervention_frequency IN ('minimal', 'moderate', 'active')),
    
    -- Viral Growth Settings
    enable_viral_tracking BOOLEAN DEFAULT true,
    guest_conversion_incentive_credits INTEGER DEFAULT 100,
    referrer_bonus_credits INTEGER DEFAULT 50,
    
    -- User Override Permissions (which settings users can override)
    allow_user_override_facilitator BOOLEAN DEFAULT true,
    allow_user_override_branch_merge BOOLEAN DEFAULT true,
    allow_user_override_playback BOOLEAN DEFAULT true,
    allow_user_override_roundtable BOOLEAN DEFAULT true,
    allow_user_override_knowledge_graph BOOLEAN DEFAULT true,
    allow_user_override_guest_invite BOOLEAN DEFAULT true,  -- If false, only admins can invite guests
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_tenant_collab_settings UNIQUE (tenant_id)
);

-- =============================================================================
-- USER-LEVEL COLLABORATION SETTINGS (Personal preferences with override)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_collaboration_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Feature Overrides (null = use tenant default)
    -- These can only be enabled if tenant allows override AND tenant has feature enabled
    enable_ai_facilitator BOOLEAN,          -- null = inherit from tenant
    enable_branch_merge BOOLEAN,
    enable_time_shifted_playback BOOLEAN,
    enable_ai_roundtable BOOLEAN,
    enable_knowledge_graph BOOLEAN,
    
    -- Personal Defaults
    default_session_name_template VARCHAR(255) DEFAULT 'Session {date}',
    default_session_access_type VARCHAR(20) DEFAULT 'invite'
        CHECK (default_session_access_type IN ('invite', 'link', 'public')),
    default_participant_permission VARCHAR(20) DEFAULT 'editor'
        CHECK (default_participant_permission IN ('viewer', 'commenter', 'editor')),
    
    -- AI Facilitator Personal Preferences
    preferred_facilitator_persona VARCHAR(20),
    facilitator_auto_summarize BOOLEAN DEFAULT true,
    facilitator_auto_action_items BOOLEAN DEFAULT true,
    facilitator_ensure_participation BOOLEAN DEFAULT true,
    facilitator_keep_on_topic BOOLEAN DEFAULT true,
    
    -- Notification Preferences
    notify_on_guest_join BOOLEAN DEFAULT true,
    notify_on_branch_created BOOLEAN DEFAULT true,
    notify_on_merge_request BOOLEAN DEFAULT true,
    notify_on_roundtable_complete BOOLEAN DEFAULT true,
    notify_on_annotation BOOLEAN DEFAULT true,
    
    -- Recording Preferences
    auto_start_recording BOOLEAN DEFAULT false,
    default_recording_type VARCHAR(20) DEFAULT 'full'
        CHECK (default_recording_type IN ('full', 'highlights', 'summary')),
    
    -- Display Preferences
    show_knowledge_graph_sidebar BOOLEAN DEFAULT true,
    show_participant_avatars BOOLEAN DEFAULT true,
    collapsed_participants_sidebar BOOLEAN DEFAULT false,
    preferred_view VARCHAR(20) DEFAULT 'chat',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_collab_settings UNIQUE (tenant_id, user_id)
);

-- =============================================================================
-- EFFECTIVE SETTINGS VIEW (Computed from tenant + user with override logic)
-- =============================================================================

CREATE OR REPLACE VIEW effective_collaboration_settings AS
SELECT 
    u.tenant_id,
    u.user_id,
    
    -- Feature availability (tenant must enable AND user must not disable)
    COALESCE(t.enable_collaborative_chat, true) AS enable_collaborative_chat,
    COALESCE(t.enable_intra_tenant_chat, true) AS enable_intra_tenant_chat,
    COALESCE(t.enable_guest_access, true) AS enable_guest_access,
    
    -- Overridable features: user preference if allowed, else tenant default
    CASE 
        WHEN t.allow_user_override_facilitator AND u.enable_ai_facilitator IS NOT NULL 
        THEN u.enable_ai_facilitator AND COALESCE(t.enable_ai_facilitator, true)
        ELSE COALESCE(t.enable_ai_facilitator, true)
    END AS enable_ai_facilitator,
    
    CASE 
        WHEN t.allow_user_override_branch_merge AND u.enable_branch_merge IS NOT NULL 
        THEN u.enable_branch_merge AND COALESCE(t.enable_branch_merge, true)
        ELSE COALESCE(t.enable_branch_merge, true)
    END AS enable_branch_merge,
    
    CASE 
        WHEN t.allow_user_override_playback AND u.enable_time_shifted_playback IS NOT NULL 
        THEN u.enable_time_shifted_playback AND COALESCE(t.enable_time_shifted_playback, true)
        ELSE COALESCE(t.enable_time_shifted_playback, true)
    END AS enable_time_shifted_playback,
    
    CASE 
        WHEN t.allow_user_override_roundtable AND u.enable_ai_roundtable IS NOT NULL 
        THEN u.enable_ai_roundtable AND COALESCE(t.enable_ai_roundtable, true)
        ELSE COALESCE(t.enable_ai_roundtable, true)
    END AS enable_ai_roundtable,
    
    CASE 
        WHEN t.allow_user_override_knowledge_graph AND u.enable_knowledge_graph IS NOT NULL 
        THEN u.enable_knowledge_graph AND COALESCE(t.enable_knowledge_graph, true)
        ELSE COALESCE(t.enable_knowledge_graph, true)
    END AS enable_knowledge_graph,
    
    -- Guest invite permission
    CASE 
        WHEN t.allow_user_override_guest_invite THEN true
        ELSE false
    END AS can_invite_guests,
    
    -- Limits from tenant
    COALESCE(t.max_guests_per_session, 10) AS max_guests_per_session,
    COALESCE(t.max_participants_per_session, 50) AS max_participants_per_session,
    COALESCE(t.max_branches_per_session, 10) AS max_branches_per_session,
    COALESCE(t.max_recordings_per_session, 5) AS max_recordings_per_session,
    COALESCE(t.max_roundtables_per_session, 3) AS max_roundtables_per_session,
    COALESCE(t.default_guest_permission, 'commenter') AS default_guest_permission,
    
    -- User preferences (with tenant defaults)
    COALESCE(u.preferred_facilitator_persona, t.default_facilitator_persona, 'professional') AS facilitator_persona,
    COALESCE(u.facilitator_auto_summarize, true) AS facilitator_auto_summarize,
    COALESCE(u.facilitator_auto_action_items, true) AS facilitator_auto_action_items,
    COALESCE(u.default_session_access_type, 'invite') AS default_session_access_type,
    COALESCE(u.default_participant_permission, 'editor') AS default_participant_permission,
    COALESCE(u.auto_start_recording, false) AS auto_start_recording,
    COALESCE(u.default_recording_type, 'full') AS default_recording_type
    
FROM user_collaboration_settings u
LEFT JOIN tenant_collaboration_settings t ON u.tenant_id = t.tenant_id;

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_tenant_collab_settings_tenant ON tenant_collaboration_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_collab_settings_tenant ON user_collaboration_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_collab_settings_user ON user_collaboration_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_collab_settings_tenant_user ON user_collaboration_settings(tenant_id, user_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE tenant_collaboration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_collaboration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_collab_settings_isolation ON tenant_collaboration_settings
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY user_collab_settings_isolation ON user_collaboration_settings
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get effective settings for a user, creating defaults if needed
CREATE OR REPLACE FUNCTION get_effective_collaboration_settings(
    p_tenant_id UUID,
    p_user_id UUID
) RETURNS TABLE (
    enable_collaborative_chat BOOLEAN,
    enable_intra_tenant_chat BOOLEAN,
    enable_guest_access BOOLEAN,
    enable_ai_facilitator BOOLEAN,
    enable_branch_merge BOOLEAN,
    enable_time_shifted_playback BOOLEAN,
    enable_ai_roundtable BOOLEAN,
    enable_knowledge_graph BOOLEAN,
    can_invite_guests BOOLEAN,
    max_guests_per_session INTEGER,
    max_participants_per_session INTEGER,
    max_branches_per_session INTEGER,
    facilitator_persona VARCHAR,
    default_guest_permission VARCHAR
) AS $$
DECLARE
    v_tenant tenant_collaboration_settings%ROWTYPE;
    v_user user_collaboration_settings%ROWTYPE;
BEGIN
    -- Get or create tenant settings
    SELECT * INTO v_tenant FROM tenant_collaboration_settings WHERE tenant_id = p_tenant_id;
    IF NOT FOUND THEN
        INSERT INTO tenant_collaboration_settings (tenant_id) VALUES (p_tenant_id)
        RETURNING * INTO v_tenant;
    END IF;
    
    -- Get or create user settings
    SELECT * INTO v_user FROM user_collaboration_settings WHERE tenant_id = p_tenant_id AND user_id = p_user_id;
    IF NOT FOUND THEN
        INSERT INTO user_collaboration_settings (tenant_id, user_id) VALUES (p_tenant_id, p_user_id)
        RETURNING * INTO v_user;
    END IF;
    
    RETURN QUERY SELECT 
        COALESCE(v_tenant.enable_collaborative_chat, true),
        COALESCE(v_tenant.enable_intra_tenant_chat, true),
        COALESCE(v_tenant.enable_guest_access, true),
        
        CASE 
            WHEN v_tenant.allow_user_override_facilitator AND v_user.enable_ai_facilitator IS NOT NULL 
            THEN v_user.enable_ai_facilitator AND COALESCE(v_tenant.enable_ai_facilitator, true)
            ELSE COALESCE(v_tenant.enable_ai_facilitator, true)
        END,
        
        CASE 
            WHEN v_tenant.allow_user_override_branch_merge AND v_user.enable_branch_merge IS NOT NULL 
            THEN v_user.enable_branch_merge AND COALESCE(v_tenant.enable_branch_merge, true)
            ELSE COALESCE(v_tenant.enable_branch_merge, true)
        END,
        
        CASE 
            WHEN v_tenant.allow_user_override_playback AND v_user.enable_time_shifted_playback IS NOT NULL 
            THEN v_user.enable_time_shifted_playback AND COALESCE(v_tenant.enable_time_shifted_playback, true)
            ELSE COALESCE(v_tenant.enable_time_shifted_playback, true)
        END,
        
        CASE 
            WHEN v_tenant.allow_user_override_roundtable AND v_user.enable_ai_roundtable IS NOT NULL 
            THEN v_user.enable_ai_roundtable AND COALESCE(v_tenant.enable_ai_roundtable, true)
            ELSE COALESCE(v_tenant.enable_ai_roundtable, true)
        END,
        
        CASE 
            WHEN v_tenant.allow_user_override_knowledge_graph AND v_user.enable_knowledge_graph IS NOT NULL 
            THEN v_user.enable_knowledge_graph AND COALESCE(v_tenant.enable_knowledge_graph, true)
            ELSE COALESCE(v_tenant.enable_knowledge_graph, true)
        END,
        
        COALESCE(v_tenant.allow_user_override_guest_invite, true),
        COALESCE(v_tenant.max_guests_per_session, 10),
        COALESCE(v_tenant.max_participants_per_session, 50),
        COALESCE(v_tenant.max_branches_per_session, 10),
        COALESCE(v_user.preferred_facilitator_persona, v_tenant.default_facilitator_persona, 'professional'),
        COALESCE(v_tenant.default_guest_permission, 'commenter');
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_collaboration_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenant_collab_settings_updated
    BEFORE UPDATE ON tenant_collaboration_settings
    FOR EACH ROW EXECUTE FUNCTION update_collaboration_settings_timestamp();

CREATE TRIGGER user_collab_settings_updated
    BEFORE UPDATE ON user_collaboration_settings
    FOR EACH ROW EXECUTE FUNCTION update_collaboration_settings_timestamp();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE tenant_collaboration_settings IS 'Master collaboration settings at tenant level - controls what features are available';
COMMENT ON TABLE user_collaboration_settings IS 'User-level collaboration preferences - can override tenant defaults where allowed';
COMMENT ON VIEW effective_collaboration_settings IS 'Computed view showing final effective settings for each user based on tenant + user preferences';
COMMENT ON FUNCTION get_effective_collaboration_settings IS 'Get or create effective collaboration settings for a user, respecting tenant restrictions';
