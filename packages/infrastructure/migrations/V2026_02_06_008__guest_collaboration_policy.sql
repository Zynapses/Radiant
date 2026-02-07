-- ============================================================================
-- RADIANT v4.18.0 - Guest Collaboration Policy & Cost Attribution
-- Adds compliance gates, explicit prompt execution permissions,
-- cost attribution for guest-originated AI usage, and tenant-level
-- collaboration settings.
-- ============================================================================

-- ============================================================================
-- 1. TENANT COLLABORATION SETTINGS
-- Controls what guests can do and how costs are attributed
-- ============================================================================

CREATE TABLE tenant_collaboration_settings (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Guest access master controls
    guest_access_enabled BOOLEAN NOT NULL DEFAULT true,
    guest_prompt_execution_enabled BOOLEAN NOT NULL DEFAULT false,
    guest_file_upload_enabled BOOLEAN NOT NULL DEFAULT false,
    guest_file_download_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Compliance-driven restrictions
    -- When ANY compliance license is active, these are auto-enforced
    compliance_auto_restrict BOOLEAN NOT NULL DEFAULT true,
    compliance_restricted_features JSONB NOT NULL DEFAULT '["prompt_execution", "file_upload", "file_download", "branch_create", "roundtable_join"]',
    
    -- Cost attribution
    -- 'inviting_user': all guest costs billed to the user who created the invite
    -- 'session_owner': all guest costs billed to the session owner
    -- 'tenant_pool': costs go to a shared tenant pool (no individual attribution)
    guest_cost_attribution VARCHAR(30) NOT NULL DEFAULT 'inviting_user'
        CHECK (guest_cost_attribution IN ('inviting_user', 'session_owner', 'tenant_pool')),
    
    -- Cross-tenant guest settings (when guest is a user from another tenant)
    cross_tenant_guest_enabled BOOLEAN NOT NULL DEFAULT true,
    cross_tenant_cost_split_enabled BOOLEAN NOT NULL DEFAULT false,
    cross_tenant_cost_split_percent INTEGER NOT NULL DEFAULT 50
        CHECK (cross_tenant_cost_split_percent BETWEEN 0 AND 100),
    
    -- Session limits for guests
    guest_max_prompts_per_session INTEGER DEFAULT 20,
    guest_max_tokens_per_session INTEGER DEFAULT 50000,
    guest_session_timeout_minutes INTEGER DEFAULT 120,
    
    -- Notification settings
    notify_guest_on_restriction BOOLEAN NOT NULL DEFAULT true,
    restriction_message TEXT DEFAULT 'Some features are restricted by your organization''s compliance policies.',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. EXTEND GUEST PERMISSIONS
-- Add explicit prompt execution tracking to collaboration_guests
-- ============================================================================

ALTER TABLE collaboration_guests
    ADD COLUMN IF NOT EXISTS can_execute_prompts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS can_upload_files BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS can_download_files BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS prompts_executed INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tokens_consumed INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cost_incurred DECIMAL(10, 6) NOT NULL DEFAULT 0;

-- ============================================================================
-- 3. GUEST COST ATTRIBUTION LOG
-- Every AI action by a guest is logged with cost attribution
-- ============================================================================

CREATE TABLE guest_cost_attribution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who
    guest_id UUID NOT NULL REFERENCES collaboration_guests(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Attribution target
    attributed_to_user_id UUID NOT NULL REFERENCES users(id),
    attribution_type VARCHAR(30) NOT NULL
        CHECK (attribution_type IN ('inviting_user', 'session_owner', 'tenant_pool', 'cross_tenant_split')),
    
    -- Cost details
    model_id VARCHAR(100) NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    provider_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
    billed_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
    
    -- Cross-tenant split (if applicable)
    split_percent INTEGER,
    host_tenant_cost DECIMAL(10, 6),
    guest_tenant_cost DECIMAL(10, 6),
    guest_tenant_id UUID REFERENCES tenants(id),
    
    -- Request context
    request_id VARCHAR(255),
    request_type VARCHAR(50) DEFAULT 'chat',
    latency_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. COMPLIANCE RESTRICTION LOG
-- Audit trail when features are restricted due to compliance
-- ============================================================================

CREATE TABLE guest_compliance_restriction_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES collaboration_guests(id) ON DELETE SET NULL,
    
    -- What was restricted
    restricted_feature VARCHAR(50) NOT NULL,
    restriction_reason VARCHAR(100) NOT NULL,
    compliance_licenses JSONB NOT NULL DEFAULT '[]',
    
    -- Was the guest notified?
    guest_notified BOOLEAN NOT NULL DEFAULT false,
    notification_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. EXTEND GUEST INVITES WITH COMPLIANCE METADATA
-- ============================================================================

ALTER TABLE collaboration_guest_invites
    ADD COLUMN IF NOT EXISTS compliance_acknowledged BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS compliance_restrictions JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS cost_attribution_user_id UUID REFERENCES users(id);

-- ============================================================================
-- 6. FUNCTION: Resolve guest capabilities based on tenant compliance
-- ============================================================================

CREATE OR REPLACE FUNCTION resolve_guest_capabilities(
    p_tenant_id UUID,
    p_permission VARCHAR(20)
)
RETURNS JSONB AS $$
DECLARE
    v_settings tenant_collaboration_settings;
    v_has_compliance_license BOOLEAN;
    v_capabilities JSONB;
BEGIN
    -- Get tenant collaboration settings (or defaults)
    SELECT * INTO v_settings
    FROM tenant_collaboration_settings
    WHERE tenant_id = p_tenant_id;
    
    -- Check if tenant has any compliance licenses active
    SELECT EXISTS (
        SELECT 1 FROM tenant_licenses
        WHERE tenant_id = p_tenant_id
        AND license_type = 'compliance'
        AND status = 'active'
    ) INTO v_has_compliance_license;
    
    -- Start with base capabilities from permission level
    v_capabilities := jsonb_build_object(
        'can_view', true,
        'can_comment', p_permission IN ('commenter', 'editor'),
        'can_edit', p_permission = 'editor',
        'can_execute_prompts', false,
        'can_upload_files', false,
        'can_download_files', true,
        'can_create_branch', p_permission = 'editor',
        'can_join_roundtable', p_permission IN ('commenter', 'editor'),
        'compliance_restricted', false,
        'restriction_reasons', '[]'::jsonb
    );
    
    -- If settings exist, apply tenant preferences
    IF v_settings.tenant_id IS NOT NULL THEN
        -- Guest access must be enabled
        IF NOT v_settings.guest_access_enabled THEN
            RETURN jsonb_build_object(
                'can_view', false,
                'can_comment', false,
                'can_edit', false,
                'can_execute_prompts', false,
                'can_upload_files', false,
                'can_download_files', false,
                'can_create_branch', false,
                'can_join_roundtable', false,
                'compliance_restricted', true,
                'restriction_reasons', '["Guest access is disabled for this organization"]'::jsonb
            );
        END IF;
        
        -- Apply prompt execution permission (only editors, and only if tenant allows)
        IF p_permission = 'editor' AND v_settings.guest_prompt_execution_enabled THEN
            v_capabilities := jsonb_set(v_capabilities, '{can_execute_prompts}', 'true');
        END IF;
        
        -- Apply file permissions
        IF v_settings.guest_file_upload_enabled AND p_permission = 'editor' THEN
            v_capabilities := jsonb_set(v_capabilities, '{can_upload_files}', 'true');
        END IF;
        IF NOT v_settings.guest_file_download_enabled THEN
            v_capabilities := jsonb_set(v_capabilities, '{can_download_files}', 'false');
        END IF;
    END IF;
    
    -- Compliance override: if tenant has compliance licenses AND auto-restrict is on,
    -- force-disable sensitive features for guests
    IF v_has_compliance_license AND (v_settings.tenant_id IS NULL OR v_settings.compliance_auto_restrict) THEN
        v_capabilities := jsonb_set(v_capabilities, '{can_execute_prompts}', 'false');
        v_capabilities := jsonb_set(v_capabilities, '{can_upload_files}', 'false');
        v_capabilities := jsonb_set(v_capabilities, '{can_download_files}', 'false');
        v_capabilities := jsonb_set(v_capabilities, '{can_create_branch}', 'false');
        v_capabilities := jsonb_set(v_capabilities, '{compliance_restricted}', 'true');
        v_capabilities := jsonb_set(v_capabilities, '{restriction_reasons}',
            '["Compliance policies restrict guest capabilities in this organization"]'::jsonb
        );
    END IF;
    
    RETURN v_capabilities;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_tenant_collab_settings ON tenant_collaboration_settings(tenant_id);
CREATE INDEX idx_guest_cost_log_guest ON guest_cost_attribution_log(guest_id);
CREATE INDEX idx_guest_cost_log_session ON guest_cost_attribution_log(session_id);
CREATE INDEX idx_guest_cost_log_attributed ON guest_cost_attribution_log(attributed_to_user_id);
CREATE INDEX idx_guest_cost_log_tenant ON guest_cost_attribution_log(tenant_id, created_at DESC);
CREATE INDEX idx_guest_restriction_log_tenant ON guest_compliance_restriction_log(tenant_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE tenant_collaboration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_cost_attribution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_compliance_restriction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_collab_settings_isolation ON tenant_collaboration_settings
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY guest_cost_log_isolation ON guest_cost_attribution_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY guest_restriction_log_isolation ON guest_compliance_restriction_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
