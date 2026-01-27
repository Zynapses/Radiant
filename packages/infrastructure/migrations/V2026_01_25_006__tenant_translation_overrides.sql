-- RADIANT v4.18.0 - Tenant Translation Overrides
-- Allows tenant admins to override system translations with custom text
-- Overridden strings are protected from automatic translation updates

-- App identifier enum for scoping translations
CREATE TYPE localization_app_id AS ENUM (
    'radiant_admin',
    'thinktank_admin',
    'thinktank',
    'curator',
    'common'
);

-- Add app_id to localization_registry if not exists
ALTER TABLE localization_registry 
ADD COLUMN IF NOT EXISTS app_id localization_app_id DEFAULT 'common';

-- Add is_active flag to registry
ALTER TABLE localization_registry 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Tenant translation overrides table
CREATE TABLE IF NOT EXISTS tenant_translation_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    registry_id INTEGER NOT NULL REFERENCES localization_registry(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL,
    override_text TEXT NOT NULL,
    -- When TRUE, this override will NOT be updated by automatic translation processes
    is_protected BOOLEAN DEFAULT TRUE,
    -- Who made this override
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Unique per tenant/registry/language combination
    UNIQUE(tenant_id, registry_id, language_code)
);

-- Tenant translation config (per-tenant localization settings)
CREATE TABLE IF NOT EXISTS tenant_localization_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL UNIQUE,
    -- Default language for the tenant
    default_language VARCHAR(10) DEFAULT 'en',
    -- Enabled languages for the tenant (subset of 18 supported)
    enabled_languages VARCHAR(10)[] DEFAULT ARRAY['en'],
    -- Allow users to change their language preference
    allow_user_language_selection BOOLEAN DEFAULT TRUE,
    -- Use AI translation for missing strings
    enable_ai_translation BOOLEAN DEFAULT TRUE,
    -- Brand customization
    brand_name VARCHAR(255),
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Translation audit log for tracking changes
CREATE TABLE IF NOT EXISTS translation_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    registry_id INTEGER REFERENCES localization_registry(id) ON DELETE SET NULL,
    language_code VARCHAR(10) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'override_created', 'override_updated', 'override_deleted', 'protection_toggled', 'system_translation_updated'
    old_value TEXT,
    new_value TEXT,
    performed_by VARCHAR(255),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_translation_overrides_tenant 
    ON tenant_translation_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_translation_overrides_registry 
    ON tenant_translation_overrides(registry_id);
CREATE INDEX IF NOT EXISTS idx_tenant_translation_overrides_language 
    ON tenant_translation_overrides(language_code);
CREATE INDEX IF NOT EXISTS idx_tenant_translation_overrides_protected 
    ON tenant_translation_overrides(is_protected);
CREATE INDEX IF NOT EXISTS idx_translation_audit_log_tenant 
    ON translation_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_translation_audit_log_registry 
    ON translation_audit_log(registry_id);
CREATE INDEX IF NOT EXISTS idx_localization_registry_app_id 
    ON localization_registry(app_id);

-- RLS policies for tenant isolation
ALTER TABLE tenant_translation_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_localization_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_audit_log ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy for overrides
CREATE POLICY tenant_translation_overrides_isolation ON tenant_translation_overrides
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- Tenant isolation policy for config
CREATE POLICY tenant_localization_config_isolation ON tenant_localization_config
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- Tenant isolation policy for audit log
CREATE POLICY translation_audit_log_isolation ON translation_audit_log
    USING (tenant_id = current_setting('app.current_tenant_id', true) OR tenant_id IS NULL)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true) OR tenant_id IS NULL);

-- Function to get translation with tenant override fallback
CREATE OR REPLACE FUNCTION get_translation(
    p_key VARCHAR(255),
    p_language_code VARCHAR(10),
    p_tenant_id VARCHAR(255) DEFAULT NULL,
    p_app_id localization_app_id DEFAULT 'common'
) RETURNS TEXT AS $$
DECLARE
    v_result TEXT;
    v_registry_id INTEGER;
BEGIN
    -- Get registry ID
    SELECT id INTO v_registry_id 
    FROM localization_registry 
    WHERE key = p_key AND (app_id = p_app_id OR app_id = 'common') AND is_active = TRUE
    ORDER BY CASE WHEN app_id = p_app_id THEN 0 ELSE 1 END
    LIMIT 1;
    
    IF v_registry_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Check for tenant override first
    IF p_tenant_id IS NOT NULL THEN
        SELECT override_text INTO v_result
        FROM tenant_translation_overrides
        WHERE tenant_id = p_tenant_id 
          AND registry_id = v_registry_id 
          AND language_code = p_language_code;
        
        IF v_result IS NOT NULL THEN
            RETURN v_result;
        END IF;
    END IF;
    
    -- Fall back to system translation
    SELECT translated_text INTO v_result
    FROM localization_translations
    WHERE registry_id = v_registry_id AND language_code = p_language_code;
    
    IF v_result IS NOT NULL THEN
        RETURN v_result;
    END IF;
    
    -- Fall back to default text
    SELECT default_text INTO v_result
    FROM localization_registry
    WHERE id = v_registry_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get all translations for a language (with tenant overrides)
CREATE OR REPLACE FUNCTION get_translation_bundle(
    p_language_code VARCHAR(10),
    p_tenant_id VARCHAR(255) DEFAULT NULL,
    p_app_id localization_app_id DEFAULT NULL,
    p_category VARCHAR(100) DEFAULT NULL
) RETURNS TABLE (
    key VARCHAR(255),
    text TEXT,
    is_override BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.key,
        COALESCE(
            tto.override_text,
            lt.translated_text,
            r.default_text
        ) AS text,
        (tto.id IS NOT NULL) AS is_override
    FROM localization_registry r
    LEFT JOIN localization_translations lt 
        ON lt.registry_id = r.id AND lt.language_code = p_language_code
    LEFT JOIN tenant_translation_overrides tto 
        ON tto.registry_id = r.id 
        AND tto.language_code = p_language_code 
        AND tto.tenant_id = p_tenant_id
    WHERE r.is_active = TRUE
      AND (p_app_id IS NULL OR r.app_id = p_app_id OR r.app_id = 'common')
      AND (p_category IS NULL OR r.category = p_category);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if a translation is protected from auto-update
CREATE OR REPLACE FUNCTION is_translation_protected(
    p_registry_id INTEGER,
    p_language_code VARCHAR(10),
    p_tenant_id VARCHAR(255)
) RETURNS BOOLEAN AS $$
DECLARE
    v_protected BOOLEAN;
BEGIN
    SELECT is_protected INTO v_protected
    FROM tenant_translation_overrides
    WHERE tenant_id = p_tenant_id 
      AND registry_id = p_registry_id 
      AND language_code = p_language_code;
    
    RETURN COALESCE(v_protected, FALSE);
END;
$$ LANGUAGE plpgsql STABLE;

-- Add more comprehensive localization registry entries for all apps
INSERT INTO localization_registry (key, default_text, context, category, app_id) VALUES
-- Radiant Admin common strings
('admin.dashboard.title', 'Admin Dashboard', 'Main dashboard page title', 'admin', 'radiant_admin'),
('admin.dashboard.welcome', 'Welcome to RADIANT Admin', 'Dashboard welcome message', 'admin', 'radiant_admin'),
('admin.sidebar.system', 'System', 'Sidebar section label', 'navigation', 'radiant_admin'),
('admin.sidebar.ai_models', 'AI & Models', 'Sidebar section label', 'navigation', 'radiant_admin'),
('admin.sidebar.orchestration', 'Orchestration', 'Sidebar section label', 'navigation', 'radiant_admin'),
('admin.sidebar.memory', 'Memory', 'Sidebar section label', 'navigation', 'radiant_admin'),
('admin.sidebar.analytics', 'Analytics', 'Sidebar section label', 'navigation', 'radiant_admin'),
('admin.sidebar.security', 'Security', 'Sidebar section label', 'navigation', 'radiant_admin'),
('admin.sidebar.billing', 'Billing', 'Sidebar section label', 'navigation', 'radiant_admin'),
('admin.sidebar.settings', 'Settings', 'Sidebar section label', 'navigation', 'radiant_admin'),

-- Think Tank Admin strings
('thinktank_admin.dashboard.title', 'Think Tank Administration', 'Main dashboard title', 'admin', 'thinktank_admin'),
('thinktank_admin.dashboard.tenant_overview', 'Tenant Overview', 'Tenant overview card title', 'admin', 'thinktank_admin'),
('thinktank_admin.users.title', 'User Management', 'Users page title', 'admin', 'thinktank_admin'),
('thinktank_admin.users.invite', 'Invite User', 'Invite user button', 'admin', 'thinktank_admin'),
('thinktank_admin.conversations.title', 'Conversations', 'Conversations page title', 'admin', 'thinktank_admin'),
('thinktank_admin.settings.title', 'Tenant Settings', 'Settings page title', 'admin', 'thinktank_admin'),

-- Think Tank user-facing strings
('thinktank.chat.placeholder', 'Type your message...', 'Chat input placeholder', 'chat', 'thinktank'),
('thinktank.chat.send', 'Send', 'Send button label', 'chat', 'thinktank'),
('thinktank.chat.thinking', 'Thinking...', 'AI thinking indicator', 'chat', 'thinktank'),
('thinktank.chat.error', 'Something went wrong. Please try again.', 'Chat error message', 'chat', 'thinktank'),
('thinktank.chat.new_conversation', 'New Conversation', 'New conversation button', 'chat', 'thinktank'),
('thinktank.chat.clear_history', 'Clear History', 'Clear history button', 'chat', 'thinktank'),
('thinktank.sidebar.history', 'Chat History', 'Sidebar history section', 'navigation', 'thinktank'),
('thinktank.sidebar.artifacts', 'Artifacts', 'Sidebar artifacts section', 'navigation', 'thinktank'),
('thinktank.sidebar.settings', 'Settings', 'Sidebar settings link', 'navigation', 'thinktank'),
('thinktank.sidebar.profile', 'Profile', 'Sidebar profile link', 'navigation', 'thinktank'),
('thinktank.profile.title', 'Your Profile', 'Profile page title', 'profile', 'thinktank'),
('thinktank.profile.edit', 'Edit Profile', 'Edit profile button', 'profile', 'thinktank'),
('thinktank.artifacts.title', 'Your Artifacts', 'Artifacts page title', 'artifacts', 'thinktank'),
('thinktank.artifacts.empty', 'No artifacts yet', 'Empty artifacts message', 'artifacts', 'thinktank'),
('thinktank.history.title', 'Conversation History', 'History page title', 'history', 'thinktank'),
('thinktank.history.empty', 'No conversations yet', 'Empty history message', 'history', 'thinktank'),
('thinktank.rules.title', 'My Rules', 'Rules page title', 'rules', 'thinktank'),
('thinktank.rules.description', 'Configure how the AI should behave in your conversations', 'Rules description', 'rules', 'thinktank'),

-- Curator strings
('curator.dashboard.title', 'Curator Dashboard', 'Main dashboard title', 'admin', 'curator'),
('curator.content.title', 'Content Management', 'Content page title', 'admin', 'curator'),
('curator.review.title', 'Content Review', 'Review page title', 'admin', 'curator'),
('curator.publish.title', 'Publish Content', 'Publish page title', 'admin', 'curator'),

-- Common error messages
('error.generic', 'An unexpected error occurred', 'Generic error message', 'errors', 'common'),
('error.network', 'Network error. Please check your connection.', 'Network error message', 'errors', 'common'),
('error.unauthorized', 'You are not authorized to perform this action', 'Unauthorized error', 'errors', 'common'),
('error.forbidden', 'Access denied', 'Forbidden error', 'errors', 'common'),
('error.not_found', 'The requested resource was not found', 'Not found error', 'errors', 'common'),
('error.validation', 'Please check your input and try again', 'Validation error', 'errors', 'common'),
('error.session_expired', 'Your session has expired. Please sign in again.', 'Session expired error', 'errors', 'common'),
('error.rate_limited', 'Too many requests. Please wait and try again.', 'Rate limit error', 'errors', 'common'),
('error.server', 'Server error. Our team has been notified.', 'Server error', 'errors', 'common'),

-- Common dialog/modal strings
('dialog.confirm.title', 'Confirm Action', 'Confirmation dialog title', 'dialogs', 'common'),
('dialog.confirm.message', 'Are you sure you want to proceed?', 'Confirmation dialog message', 'dialogs', 'common'),
('dialog.confirm.yes', 'Yes, proceed', 'Confirmation dialog confirm button', 'dialogs', 'common'),
('dialog.confirm.no', 'No, cancel', 'Confirmation dialog cancel button', 'dialogs', 'common'),
('dialog.delete.title', 'Delete Confirmation', 'Delete dialog title', 'dialogs', 'common'),
('dialog.delete.message', 'This action cannot be undone. Are you sure?', 'Delete dialog message', 'dialogs', 'common'),
('dialog.delete.confirm', 'Delete', 'Delete dialog confirm button', 'dialogs', 'common'),
('dialog.unsaved.title', 'Unsaved Changes', 'Unsaved changes dialog title', 'dialogs', 'common'),
('dialog.unsaved.message', 'You have unsaved changes. Do you want to save before leaving?', 'Unsaved changes message', 'dialogs', 'common'),
('dialog.unsaved.save', 'Save changes', 'Save changes button', 'dialogs', 'common'),
('dialog.unsaved.discard', 'Discard changes', 'Discard changes button', 'dialogs', 'common'),

-- Common form validation messages
('validation.required', 'This field is required', 'Required field error', 'validation', 'common'),
('validation.email', 'Please enter a valid email address', 'Invalid email error', 'validation', 'common'),
('validation.min_length', 'Must be at least {min} characters', 'Min length error with placeholder', 'validation', 'common'),
('validation.max_length', 'Must be no more than {max} characters', 'Max length error with placeholder', 'validation', 'common'),
('validation.pattern', 'Invalid format', 'Pattern mismatch error', 'validation', 'common'),
('validation.number', 'Please enter a valid number', 'Invalid number error', 'validation', 'common'),
('validation.url', 'Please enter a valid URL', 'Invalid URL error', 'validation', 'common'),
('validation.date', 'Please enter a valid date', 'Invalid date error', 'validation', 'common'),
('validation.password_match', 'Passwords do not match', 'Password mismatch error', 'validation', 'common'),

-- Common toast/notification messages
('toast.success.saved', 'Changes saved successfully', 'Save success toast', 'toasts', 'common'),
('toast.success.created', 'Created successfully', 'Create success toast', 'toasts', 'common'),
('toast.success.deleted', 'Deleted successfully', 'Delete success toast', 'toasts', 'common'),
('toast.success.updated', 'Updated successfully', 'Update success toast', 'toasts', 'common'),
('toast.success.copied', 'Copied to clipboard', 'Copy success toast', 'toasts', 'common'),
('toast.error.save_failed', 'Failed to save changes', 'Save error toast', 'toasts', 'common'),
('toast.error.load_failed', 'Failed to load data', 'Load error toast', 'toasts', 'common'),
('toast.error.delete_failed', 'Failed to delete', 'Delete error toast', 'toasts', 'common'),
('toast.info.loading', 'Loading...', 'Loading toast', 'toasts', 'common'),
('toast.info.processing', 'Processing...', 'Processing toast', 'toasts', 'common'),

-- Time/date relative strings
('time.just_now', 'Just now', 'Just now time indicator', 'time', 'common'),
('time.minutes_ago', '{count} minutes ago', 'Minutes ago with placeholder', 'time', 'common'),
('time.hours_ago', '{count} hours ago', 'Hours ago with placeholder', 'time', 'common'),
('time.days_ago', '{count} days ago', 'Days ago with placeholder', 'time', 'common'),
('time.weeks_ago', '{count} weeks ago', 'Weeks ago with placeholder', 'time', 'common'),
('time.months_ago', '{count} months ago', 'Months ago with placeholder', 'time', 'common'),
('time.years_ago', '{count} years ago', 'Years ago with placeholder', 'time', 'common'),

-- Pagination strings
('pagination.showing', 'Showing {from} to {to} of {total}', 'Pagination showing text', 'pagination', 'common'),
('pagination.previous', 'Previous', 'Previous page button', 'pagination', 'common'),
('pagination.next', 'Next', 'Next page button', 'pagination', 'common'),
('pagination.first', 'First', 'First page button', 'pagination', 'common'),
('pagination.last', 'Last', 'Last page button', 'pagination', 'common'),
('pagination.per_page', 'Per page', 'Per page selector label', 'pagination', 'common'),

-- Table/list strings
('table.no_data', 'No data available', 'Empty table message', 'tables', 'common'),
('table.loading', 'Loading data...', 'Table loading message', 'tables', 'common'),
('table.error', 'Error loading data', 'Table error message', 'tables', 'common'),
('table.search', 'Search...', 'Table search placeholder', 'tables', 'common'),
('table.filter', 'Filter', 'Filter button label', 'tables', 'common'),
('table.export', 'Export', 'Export button label', 'tables', 'common'),
('table.refresh', 'Refresh', 'Refresh button label', 'tables', 'common'),
('table.actions', 'Actions', 'Actions column header', 'tables', 'common'),

-- File upload strings
('upload.drag_drop', 'Drag and drop files here, or click to browse', 'File upload area text', 'upload', 'common'),
('upload.max_size', 'Maximum file size: {size}', 'Max file size message', 'upload', 'common'),
('upload.allowed_types', 'Allowed file types: {types}', 'Allowed types message', 'upload', 'common'),
('upload.uploading', 'Uploading...', 'Upload in progress', 'upload', 'common'),
('upload.complete', 'Upload complete', 'Upload complete message', 'upload', 'common'),
('upload.failed', 'Upload failed', 'Upload failed message', 'upload', 'common'),
('upload.remove', 'Remove file', 'Remove file button', 'upload', 'common'),

-- Auth-related strings
('auth.sign_in', 'Sign In', 'Sign in button', 'auth', 'common'),
('auth.sign_out', 'Sign Out', 'Sign out button', 'auth', 'common'),
('auth.sign_up', 'Sign Up', 'Sign up button', 'auth', 'common'),
('auth.forgot_password', 'Forgot Password?', 'Forgot password link', 'auth', 'common'),
('auth.reset_password', 'Reset Password', 'Reset password button', 'auth', 'common'),
('auth.email_label', 'Email', 'Email field label', 'auth', 'common'),
('auth.password_label', 'Password', 'Password field label', 'auth', 'common'),
('auth.remember_me', 'Remember me', 'Remember me checkbox', 'auth', 'common'),
('auth.signing_in', 'Signing in...', 'Sign in loading state', 'auth', 'common')

ON CONFLICT (key) DO UPDATE SET
    default_text = EXCLUDED.default_text,
    context = EXCLUDED.context,
    category = EXCLUDED.category,
    app_id = EXCLUDED.app_id,
    updated_at = NOW();

-- Grant permissions
GRANT SELECT ON localization_registry TO authenticated;
GRANT SELECT ON localization_translations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_translation_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE ON tenant_localization_config TO authenticated;
GRANT INSERT ON translation_audit_log TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
