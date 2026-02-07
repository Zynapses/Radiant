-- ============================================================================
-- RADIANT v4.18.0 - System Configuration Migration
-- Centralizes all hardcoded parameters into database-backed configuration
-- ============================================================================

-- System configuration categories
CREATE TABLE config_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    display_order INTEGER DEFAULT 0,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System configuration parameters
CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id VARCHAR(50) NOT NULL REFERENCES config_categories(id),
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    default_value JSONB NOT NULL,
    value_type VARCHAR(20) NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'array')),
    
    -- Validation
    min_value NUMERIC,
    max_value NUMERIC,
    allowed_values JSONB,
    validation_regex VARCHAR(500),
    
    -- Metadata
    name VARCHAR(200) NOT NULL,
    description TEXT,
    unit VARCHAR(50),
    is_sensitive BOOLEAN DEFAULT false,
    requires_restart BOOLEAN DEFAULT false,
    
    -- Tenant override support
    allow_tenant_override BOOLEAN DEFAULT false,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID,
    
    CONSTRAINT unique_config_key UNIQUE (category_id, key)
);

-- Tenant-specific config overrides
CREATE TABLE tenant_config_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    config_id UUID NOT NULL REFERENCES system_config(id) ON DELETE CASCADE,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID,
    
    CONSTRAINT unique_tenant_config UNIQUE (tenant_id, config_id)
);

-- Configuration change audit log
CREATE TABLE config_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID REFERENCES system_config(id),
    tenant_id UUID REFERENCES tenants(id),
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'override')),
    old_value JSONB,
    new_value JSONB,
    changed_by UUID,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    change_reason TEXT,
    ip_address VARCHAR(45)
);

-- Indexes
CREATE INDEX idx_system_config_category ON system_config(category_id);
CREATE INDEX idx_system_config_key ON system_config(key);
CREATE INDEX idx_tenant_overrides_tenant ON tenant_config_overrides(tenant_id);
CREATE INDEX idx_config_audit_config ON config_audit_log(config_id, changed_at DESC);
CREATE INDEX idx_config_audit_tenant ON config_audit_log(tenant_id, changed_at DESC);

-- Insert configuration categories
INSERT INTO config_categories (id, name, description, icon, display_order, is_system) VALUES
    ('timeouts', 'Operation Timeouts', 'Configure timeout durations for various operations', 'Clock', 1, true),
    ('rate_limits', 'Rate Limiting', 'API rate limiting and throttling settings', 'Gauge', 2, true),
    ('thermal', 'Thermal Management', 'Model warm-up and thermal state thresholds', 'Thermometer', 3, true),
    ('ai', 'AI Settings', 'AI model defaults and inference parameters', 'Brain', 4, true),
    ('security', 'Security', 'Security policies and authentication settings', 'Shield', 5, true),
    ('billing', 'Billing & Limits', 'Credit limits, pricing multipliers, and quotas', 'CreditCard', 6, true),
    ('workflows', 'Workflow Engine', 'Neural workflow thresholds and evidence weights', 'GitBranch', 7, true),
    ('notifications', 'Notifications', 'Alert thresholds and notification settings', 'Bell', 8, false),
    ('ui', 'UI Preferences', 'Default UI settings and display options', 'Layout', 9, false),
    ('integrations', 'Integrations', 'Third-party integration settings', 'Plug', 10, false);

-- Insert default configuration values

-- ============================================================================
-- TIMEOUTS
-- ============================================================================
INSERT INTO system_config (category_id, key, value, default_value, value_type, min_value, max_value, name, description, unit, requires_restart) VALUES
    ('timeouts', 'cdk_bootstrap', '600', '600', 'number', 60, 1800, 'CDK Bootstrap Timeout', 'Time allowed for CDK bootstrap operation', 'seconds', false),
    ('timeouts', 'cdk_deploy', '1800', '1800', 'number', 300, 7200, 'CDK Deploy Timeout', 'Time allowed for CDK stack deployment', 'seconds', false),
    ('timeouts', 'cdk_destroy', '900', '900', 'number', 120, 3600, 'CDK Destroy Timeout', 'Time allowed for CDK stack destruction', 'seconds', false),
    ('timeouts', 'migration_step', '300', '300', 'number', 30, 1800, 'Migration Step Timeout', 'Time allowed for single database migration', 'seconds', false),
    ('timeouts', 'migration_total', '1800', '1800', 'number', 300, 7200, 'Migration Total Timeout', 'Total time for all migrations', 'seconds', false),
    ('timeouts', 'health_check', '30', '30', 'number', 5, 120, 'Health Check Timeout', 'Time for single health check request', 'seconds', false),
    ('timeouts', 'health_check_total', '120', '120', 'number', 30, 600, 'Health Check Total', 'Total time for all health checks', 'seconds', false),
    ('timeouts', 'ai_inference', '120', '120', 'number', 10, 600, 'AI Inference Timeout', 'Time for AI model inference requests', 'seconds', false),
    ('timeouts', 'api_request', '30', '30', 'number', 5, 120, 'API Request Timeout', 'Default timeout for API requests', 'seconds', false),
    ('timeouts', 'file_upload', '300', '300', 'number', 60, 1800, 'File Upload Timeout', 'Time allowed for file uploads', 'seconds', false),
    ('timeouts', 'websocket_idle', '300', '300', 'number', 60, 900, 'WebSocket Idle Timeout', 'Time before idle WebSocket disconnection', 'seconds', false),
    ('timeouts', 'session_duration', '86400', '86400', 'number', 3600, 604800, 'Session Duration', 'User session timeout', 'seconds', false);

-- ============================================================================
-- RATE LIMITS
-- ============================================================================
INSERT INTO system_config (category_id, key, value, default_value, value_type, min_value, max_value, name, description, unit, allow_tenant_override) VALUES
    ('rate_limits', 'api_window_ms', '60000', '60000', 'number', 1000, 300000, 'Rate Limit Window', 'Time window for rate limiting', 'milliseconds', false),
    ('rate_limits', 'free_tier_requests', '100', '100', 'number', 10, 500, 'Free Tier Requests', 'Requests per window for free tier', 'requests', true),
    ('rate_limits', 'starter_tier_requests', '500', '500', 'number', 100, 2000, 'Starter Tier Requests', 'Requests per window for starter tier', 'requests', true),
    ('rate_limits', 'professional_tier_requests', '2000', '2000', 'number', 500, 10000, 'Professional Tier Requests', 'Requests per window for professional tier', 'requests', true),
    ('rate_limits', 'business_tier_requests', '5000', '5000', 'number', 1000, 20000, 'Business Tier Requests', 'Requests per window for business tier', 'requests', true),
    ('rate_limits', 'enterprise_tier_requests', '20000', '20000', 'number', 5000, 100000, 'Enterprise Tier Requests', 'Requests per window for enterprise tier', 'requests', true),
    ('rate_limits', 'burst_multiplier', '1.5', '1.5', 'number', 1, 5, 'Burst Multiplier', 'Temporary burst allowance multiplier', 'multiplier', true);

-- ============================================================================
-- THERMAL MANAGEMENT
-- ============================================================================
INSERT INTO system_config (category_id, key, value, default_value, value_type, min_value, max_value, name, description, unit) VALUES
    ('thermal', 'warm_duration_minutes', '30', '30', 'number', 5, 120, 'Warm Duration', 'Default model warm-up duration', 'minutes'),
    ('thermal', 'hot_threshold_rpm', '10', '10', 'number', 1, 100, 'Hot Threshold', 'Requests/minute to trigger hot state', 'rpm'),
    ('thermal', 'cold_threshold_idle', '15', '15', 'number', 5, 60, 'Cold Threshold', 'Idle minutes before transitioning to cold', 'minutes'),
    ('thermal', 'auto_scale_min_instances', '0', '0', 'number', 0, 10, 'Auto Scale Min', 'Minimum instances for auto-scaling', 'instances'),
    ('thermal', 'auto_scale_max_instances', '5', '5', 'number', 1, 50, 'Auto Scale Max', 'Maximum instances for auto-scaling', 'instances');

-- ============================================================================
-- AI SETTINGS
-- ============================================================================
INSERT INTO system_config (category_id, key, value, default_value, value_type, min_value, max_value, name, description, unit, allow_tenant_override) VALUES
    ('ai', 'default_temperature', '0.7', '0.7', 'number', 0, 2, 'Default Temperature', 'Default temperature for AI models', '', true),
    ('ai', 'default_max_tokens', '4096', '4096', 'number', 256, 32768, 'Default Max Tokens', 'Default max tokens for responses', 'tokens', true),
    ('ai', 'default_top_p', '0.9', '0.9', 'number', 0, 1, 'Default Top P', 'Default nucleus sampling parameter', '', true),
    ('ai', 'streaming_chunk_size', '100', '100', 'number', 10, 1000, 'Streaming Chunk Size', 'Characters per streaming chunk', 'chars', false),
    ('ai', 'retry_count', '3', '3', 'number', 0, 10, 'Retry Count', 'Number of retries for failed AI requests', 'attempts', false),
    ('ai', 'retry_delay_ms', '1000', '1000', 'number', 100, 10000, 'Retry Delay', 'Delay between retries', 'milliseconds', false),
    ('ai', 'context_window_default', '128000', '128000', 'number', 4096, 200000, 'Context Window', 'Default context window size', 'tokens', false);

-- ============================================================================
-- SECURITY
-- ============================================================================
INSERT INTO system_config (category_id, key, value, default_value, value_type, min_value, max_value, name, description, unit, is_sensitive) VALUES
    ('security', 'token_refresh_threshold', '300', '300', 'number', 60, 900, 'Token Refresh Threshold', 'Seconds before expiry to refresh token', 'seconds', false),
    ('security', 'max_login_attempts', '5', '5', 'number', 3, 20, 'Max Login Attempts', 'Failed attempts before lockout', 'attempts', false),
    ('security', 'lockout_duration', '900', '900', 'number', 60, 3600, 'Lockout Duration', 'Account lockout duration', 'seconds', false),
    ('security', 'password_min_length', '12', '12', 'number', 8, 32, 'Password Min Length', 'Minimum password length', 'characters', false),
    ('security', 'mfa_required', 'false', 'false', 'boolean', NULL, NULL, 'MFA Required', 'Require MFA for all users', '', false),
    ('security', 'session_concurrent_max', '5', '5', 'number', 1, 20, 'Max Concurrent Sessions', 'Maximum concurrent sessions per user', 'sessions', false),
    ('security', 'api_key_expiry_days', '90', '90', 'number', 7, 365, 'API Key Expiry', 'Default API key expiration', 'days', false);

-- ============================================================================
-- WORKFLOW ENGINE
-- ============================================================================
INSERT INTO system_config (category_id, key, value, default_value, value_type, min_value, max_value, name, description, unit) VALUES
    ('workflows', 'evidence_threshold_count', '10', '10', 'number', 3, 50, 'Evidence Threshold Count', 'Occurrences needed for proposal', 'count'),
    ('workflows', 'evidence_threshold_users', '3', '3', 'number', 1, 20, 'Unique Users Threshold', 'Unique users needed for proposal', 'users'),
    ('workflows', 'evidence_total_score', '2.0', '2.0', 'number', 0.5, 10, 'Total Evidence Score', 'Minimum score to trigger proposal', 'score'),
    ('workflows', 'neural_confidence_threshold', '0.7', '0.7', 'number', 0.1, 1, 'Neural Confidence', 'Minimum confidence for auto-approval', '', false),
    ('workflows', 'weight_workflow_failure', '0.40', '0.40', 'number', 0, 1, 'Workflow Failure Weight', 'Evidence weight for workflow failures', 'weight'),
    ('workflows', 'weight_negative_feedback', '0.35', '0.35', 'number', 0, 1, 'Negative Feedback Weight', 'Evidence weight for negative feedback', 'weight'),
    ('workflows', 'weight_manual_override', '0.15', '0.15', 'number', 0, 1, 'Manual Override Weight', 'Evidence weight for manual overrides', 'weight'),
    ('workflows', 'weight_explicit_request', '0.50', '0.50', 'number', 0, 1, 'Explicit Request Weight', 'Evidence weight for explicit requests', 'weight');

-- ============================================================================
-- BILLING & LIMITS
-- ============================================================================
INSERT INTO system_config (category_id, key, value, default_value, value_type, min_value, max_value, name, description, unit, allow_tenant_override) VALUES
    ('billing', 'free_tier_credits', '10', '10', 'number', 0, 100, 'Free Tier Credits', 'Monthly credits for free tier', 'credits', false),
    ('billing', 'credit_low_threshold', '0.2', '0.2', 'number', 0.05, 0.5, 'Low Credit Alert', 'Credit percentage to trigger alert', 'percentage', true),
    ('billing', 'cost_alert_threshold', '100', '100', 'number', 10, 10000, 'Cost Alert Threshold', 'Daily cost to trigger alert', 'USD', true),
    ('billing', 'storage_limit_gb', '10', '10', 'number', 1, 1000, 'Storage Limit', 'Default storage limit per tenant', 'GB', true),
    ('billing', 'max_models_per_tenant', '20', '20', 'number', 5, 100, 'Max Models', 'Maximum models per tenant', 'models', true),
    ('billing', 'max_users_per_tenant', '50', '50', 'number', 5, 1000, 'Max Users', 'Maximum users per tenant', 'users', true);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
INSERT INTO system_config (category_id, key, value, default_value, value_type, name, description, allow_tenant_override) VALUES
    ('notifications', 'email_enabled', 'true', 'true', 'boolean', 'Email Notifications', 'Enable email notifications', true),
    ('notifications', 'slack_enabled', 'false', 'false', 'boolean', 'Slack Notifications', 'Enable Slack notifications', true),
    ('notifications', 'webhook_enabled', 'false', 'false', 'boolean', 'Webhook Notifications', 'Enable webhook notifications', true),
    ('notifications', 'digest_frequency', '"daily"', '"daily"', 'string', 'Digest Frequency', 'How often to send digest emails', true),
    ('notifications', 'critical_alert_channels', '["email"]', '["email"]', 'array', 'Critical Alert Channels', 'Channels for critical alerts', false);

-- ============================================================================
-- UI PREFERENCES
-- ============================================================================
INSERT INTO system_config (category_id, key, value, default_value, value_type, name, description, allow_tenant_override) VALUES
    ('ui', 'default_theme', '"system"', '"system"', 'string', 'Default Theme', 'Default UI theme (light/dark/system)', true),
    ('ui', 'default_language', '"en"', '"en"', 'string', 'Default Language', 'Default interface language', true),
    ('ui', 'items_per_page', '25', '25', 'number', 'Items Per Page', 'Default pagination size', true),
    ('ui', 'date_format', '"MMM d, yyyy"', '"MMM d, yyyy"', 'string', 'Date Format', 'Default date display format', true),
    ('ui', 'time_format', '"h:mm a"', '"h:mm a"', 'string', 'Time Format', 'Default time display format', true),
    ('ui', 'compact_mode', 'false', 'false', 'boolean', 'Compact Mode', 'Enable compact UI mode', true);

-- Trigger for config updates
CREATE OR REPLACE FUNCTION log_config_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO config_audit_log (config_id, action, old_value, new_value, changed_by, changed_at)
    VALUES (
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN OLD.value ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN NEW.value ELSE NULL END,
        COALESCE(NEW.updated_by, OLD.updated_by),
        NOW()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_config_audit
    AFTER INSERT OR UPDATE OR DELETE ON system_config
    FOR EACH ROW EXECUTE FUNCTION log_config_change();

CREATE TRIGGER tenant_config_audit
    AFTER INSERT OR UPDATE OR DELETE ON tenant_config_overrides
    FOR EACH ROW EXECUTE FUNCTION log_config_change();

-- Function to get effective config value (with tenant override)
CREATE OR REPLACE FUNCTION get_config_value(p_category_id VARCHAR, p_key VARCHAR, p_tenant_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_value JSONB;
    v_config_id UUID;
BEGIN
    -- Get base config
    SELECT id, value INTO v_config_id, v_value
    FROM system_config
    WHERE category_id = p_category_id AND key = p_key;
    
    -- Check for tenant override if tenant provided
    IF p_tenant_id IS NOT NULL THEN
        SELECT tco.value INTO v_value
        FROM tenant_config_overrides tco
        JOIN system_config sc ON sc.id = tco.config_id
        WHERE sc.category_id = p_category_id 
          AND sc.key = p_key 
          AND tco.tenant_id = p_tenant_id
          AND sc.allow_tenant_override = true;
    END IF;
    
    RETURN v_value;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON system_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_config_overrides TO authenticated;
GRANT SELECT ON config_categories TO authenticated;
GRANT INSERT ON config_audit_log TO authenticated;
