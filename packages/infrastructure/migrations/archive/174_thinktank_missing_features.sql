-- Migration 174: Think Tank Missing Features
-- Adds tables for GDPR consent, rejections, UI feedback, multipage apps, and user preferences

-- ============================================================================
-- GDPR CONSENT MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS thinktank_user_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN ('data_processing', 'marketing', 'analytics', 'ai_training')),
    granted BOOLEAN NOT NULL DEFAULT true,
    granted_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, consent_type)
);

CREATE INDEX idx_thinktank_consents_tenant ON thinktank_user_consents(tenant_id);
CREATE INDEX idx_thinktank_consents_user ON thinktank_user_consents(user_id);
CREATE INDEX idx_thinktank_consents_type ON thinktank_user_consents(consent_type);

-- RLS for consent table
ALTER TABLE thinktank_user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY thinktank_consents_tenant_isolation ON thinktank_user_consents
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- GDPR DATA REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS thinktank_gdpr_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('export', 'delete', 'access', 'rectify', 'restrict')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processed_by UUID,
    notes TEXT,
    export_file_url TEXT,
    export_file_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gdpr_requests_tenant ON thinktank_gdpr_requests(tenant_id);
CREATE INDEX idx_gdpr_requests_user ON thinktank_gdpr_requests(user_id);
CREATE INDEX idx_gdpr_requests_status ON thinktank_gdpr_requests(status);

ALTER TABLE thinktank_gdpr_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY gdpr_requests_tenant_isolation ON thinktank_gdpr_requests
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- SECURITY CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS thinktank_security_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    rate_limit_enabled BOOLEAN NOT NULL DEFAULT true,
    rate_limit_requests_per_minute INTEGER NOT NULL DEFAULT 60,
    rate_limit_tokens_per_minute INTEGER NOT NULL DEFAULT 100000,
    ip_whitelist TEXT[] DEFAULT '{}',
    ip_blacklist TEXT[] DEFAULT '{}',
    content_filtering_enabled BOOLEAN NOT NULL DEFAULT true,
    content_filtering_level VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (content_filtering_level IN ('minimal', 'standard', 'strict')),
    pii_detection_enabled BOOLEAN NOT NULL DEFAULT true,
    pii_redaction_enabled BOOLEAN NOT NULL DEFAULT false,
    audit_logging_enabled BOOLEAN NOT NULL DEFAULT true,
    session_timeout_minutes INTEGER NOT NULL DEFAULT 60,
    max_concurrent_sessions INTEGER NOT NULL DEFAULT 5,
    require_2fa BOOLEAN NOT NULL DEFAULT false,
    allowed_domains TEXT[] DEFAULT '{}',
    blocked_keywords TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE thinktank_security_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_config_tenant_isolation ON thinktank_security_config
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- REJECTION NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS thinktank_rejections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    conversation_id UUID,
    message_id UUID,
    rejection_type VARCHAR(50) NOT NULL CHECK (rejection_type IN ('content_policy', 'rate_limit', 'token_limit', 'model_unavailable', 'safety_filter', 'domain_restriction', 'cost_limit', 'other')),
    rejection_reason TEXT NOT NULL,
    original_prompt TEXT,
    model_id VARCHAR(100),
    severity VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_dismissed BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rejections_tenant ON thinktank_rejections(tenant_id);
CREATE INDEX idx_rejections_user ON thinktank_rejections(user_id);
CREATE INDEX idx_rejections_unread ON thinktank_rejections(user_id, is_read) WHERE NOT is_read;

ALTER TABLE thinktank_rejections ENABLE ROW LEVEL SECURITY;

CREATE POLICY rejections_tenant_isolation ON thinktank_rejections
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- USER MODEL PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS thinktank_user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    favorite_models TEXT[] DEFAULT '{}',
    default_model VARCHAR(100),
    preferred_response_length VARCHAR(20) DEFAULT 'balanced' CHECK (preferred_response_length IN ('concise', 'balanced', 'detailed')),
    preferred_tone VARCHAR(20) DEFAULT 'professional' CHECK (preferred_tone IN ('casual', 'professional', 'academic', 'creative')),
    auto_save_conversations BOOLEAN DEFAULT true,
    show_token_usage BOOLEAN DEFAULT false,
    show_cost_estimates BOOLEAN DEFAULT false,
    keyboard_shortcuts_enabled BOOLEAN DEFAULT true,
    sound_effects_enabled BOOLEAN DEFAULT false,
    haptic_feedback_enabled BOOLEAN DEFAULT true,
    theme VARCHAR(20) DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_user_prefs_tenant ON thinktank_user_preferences(tenant_id);
CREATE INDEX idx_user_prefs_user ON thinktank_user_preferences(user_id);

ALTER TABLE thinktank_user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_prefs_tenant_isolation ON thinktank_user_preferences
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- UI FEEDBACK
-- ============================================================================

CREATE TABLE IF NOT EXISTS thinktank_ui_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    session_id UUID,
    app_id VARCHAR(100),
    component_path TEXT,
    feedback_type VARCHAR(30) NOT NULL CHECK (feedback_type IN ('bug', 'improvement', 'feature_request', 'confusion', 'delight', 'frustration', 'other')),
    feedback_text TEXT,
    suggestion TEXT,
    screenshot_url TEXT,
    viewport_width INTEGER,
    viewport_height INTEGER,
    user_agent TEXT,
    url_path TEXT,
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'accepted', 'rejected', 'implemented')),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ui_feedback_tenant ON thinktank_ui_feedback(tenant_id);
CREATE INDEX idx_ui_feedback_user ON thinktank_ui_feedback(user_id);
CREATE INDEX idx_ui_feedback_type ON thinktank_ui_feedback(feedback_type);
CREATE INDEX idx_ui_feedback_status ON thinktank_ui_feedback(status);

ALTER TABLE thinktank_ui_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY ui_feedback_tenant_isolation ON thinktank_ui_feedback
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- UI IMPROVEMENT SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS thinktank_ui_improvement_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    app_id VARCHAR(100) NOT NULL,
    initial_snapshot JSONB NOT NULL,
    current_snapshot JSONB,
    improvements_applied JSONB[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ui_sessions_tenant ON thinktank_ui_improvement_sessions(tenant_id);
CREATE INDEX idx_ui_sessions_user ON thinktank_ui_improvement_sessions(user_id);
CREATE INDEX idx_ui_sessions_app ON thinktank_ui_improvement_sessions(app_id);

ALTER TABLE thinktank_ui_improvement_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ui_sessions_tenant_isolation ON thinktank_ui_improvement_sessions
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- MULTIPAGE APPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS thinktank_multipage_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT '📱',
    theme JSONB DEFAULT '{"primaryColor": "#3B82F6", "mode": "light"}',
    pages JSONB NOT NULL DEFAULT '[]',
    navigation JSONB DEFAULT '{"type": "tabs", "position": "bottom"}',
    shared_state JSONB DEFAULT '{}',
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1,
    parent_id UUID REFERENCES thinktank_multipage_apps(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_multipage_apps_tenant ON thinktank_multipage_apps(tenant_id);
CREATE INDEX idx_multipage_apps_user ON thinktank_multipage_apps(user_id);
CREATE INDEX idx_multipage_apps_published ON thinktank_multipage_apps(is_published) WHERE is_published;

ALTER TABLE thinktank_multipage_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY multipage_apps_tenant_isolation ON thinktank_multipage_apps
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- VOICE INPUT SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS thinktank_voice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    conversation_id UUID,
    audio_file_url TEXT,
    audio_duration_ms INTEGER,
    language VARCHAR(10) DEFAULT 'en',
    transcript TEXT,
    confidence DECIMAL(5,4),
    model_used VARCHAR(50) DEFAULT 'whisper-1',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_voice_sessions_tenant ON thinktank_voice_sessions(tenant_id);
CREATE INDEX idx_voice_sessions_user ON thinktank_voice_sessions(user_id);

ALTER TABLE thinktank_voice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY voice_sessions_tenant_isolation ON thinktank_voice_sessions
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- FILE ATTACHMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS thinktank_file_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    conversation_id UUID,
    message_id UUID,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100),
    s3_key TEXT NOT NULL,
    s3_bucket VARCHAR(255) NOT NULL,
    thumbnail_s3_key TEXT,
    is_image BOOLEAN DEFAULT false,
    is_processed BOOLEAN DEFAULT false,
    extracted_text TEXT,
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_tenant ON thinktank_file_attachments(tenant_id);
CREATE INDEX idx_attachments_user ON thinktank_file_attachments(user_id);
CREATE INDEX idx_attachments_conversation ON thinktank_file_attachments(conversation_id);

ALTER TABLE thinktank_file_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY attachments_tenant_isolation ON thinktank_file_attachments
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_thinktank_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thinktank_consents_updated_at
    BEFORE UPDATE ON thinktank_user_consents
    FOR EACH ROW EXECUTE FUNCTION update_thinktank_updated_at();

CREATE TRIGGER gdpr_requests_updated_at
    BEFORE UPDATE ON thinktank_gdpr_requests
    FOR EACH ROW EXECUTE FUNCTION update_thinktank_updated_at();

CREATE TRIGGER security_config_updated_at
    BEFORE UPDATE ON thinktank_security_config
    FOR EACH ROW EXECUTE FUNCTION update_thinktank_updated_at();

CREATE TRIGGER user_prefs_updated_at
    BEFORE UPDATE ON thinktank_user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_thinktank_updated_at();

CREATE TRIGGER ui_sessions_updated_at
    BEFORE UPDATE ON thinktank_ui_improvement_sessions
    FOR EACH ROW EXECUTE FUNCTION update_thinktank_updated_at();

CREATE TRIGGER multipage_apps_updated_at
    BEFORE UPDATE ON thinktank_multipage_apps
    FOR EACH ROW EXECUTE FUNCTION update_thinktank_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE thinktank_user_consents IS 'GDPR consent records for Think Tank users';
COMMENT ON TABLE thinktank_gdpr_requests IS 'GDPR data subject requests (export, delete, etc.)';
COMMENT ON TABLE thinktank_security_config IS 'Per-tenant security configuration for Think Tank';
COMMENT ON TABLE thinktank_rejections IS 'Rejection notifications for users when requests are blocked';
COMMENT ON TABLE thinktank_user_preferences IS 'User preferences for models, UI, and behavior';
COMMENT ON TABLE thinktank_ui_feedback IS 'User feedback on UI components and experiences';
COMMENT ON TABLE thinktank_ui_improvement_sessions IS 'AI-assisted UI improvement sessions';
COMMENT ON TABLE thinktank_multipage_apps IS 'User-generated multipage applications';
COMMENT ON TABLE thinktank_voice_sessions IS 'Voice input transcription sessions';
COMMENT ON TABLE thinktank_file_attachments IS 'File attachments for conversations';
