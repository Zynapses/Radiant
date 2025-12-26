-- RADIANT v4.17.0 - Migration 032: Dynamic Configuration Management
-- Database-driven configuration with tenant overrides

CREATE TABLE configuration_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 100,
    icon VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE config_value_type AS ENUM (
    'string', 'integer', 'decimal', 'boolean', 'json', 'duration', 'percentage', 'enum'
);

CREATE TABLE system_configuration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL UNIQUE,
    category_id VARCHAR(50) NOT NULL REFERENCES configuration_categories(id),
    
    value_type config_value_type NOT NULL,
    value_string TEXT,
    value_integer BIGINT,
    value_decimal DECIMAL(20, 6),
    value_boolean BOOLEAN,
    value_json JSONB,
    
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    unit VARCHAR(50),
    
    min_value DECIMAL(20, 6),
    max_value DECIMAL(20, 6),
    enum_values TEXT[],
    regex_pattern TEXT,
    
    environment VARCHAR(20) DEFAULT 'all',
    
    is_sensitive BOOLEAN DEFAULT false,
    requires_restart BOOLEAN DEFAULT false,
    is_deprecated BOOLEAN DEFAULT false,
    deprecated_replacement_key VARCHAR(100),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID
);

CREATE TABLE tenant_configuration_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    config_key VARCHAR(100) NOT NULL REFERENCES system_configuration(key),
    
    value_string TEXT,
    value_integer BIGINT,
    value_decimal DECIMAL(20, 6),
    value_boolean BOOLEAN,
    value_json JSONB,
    
    override_reason TEXT,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, config_key)
);

CREATE TABLE configuration_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) NOT NULL,
    tenant_id UUID,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'override', 'revert')),
    previous_value JSONB,
    new_value JSONB,
    changed_by UUID,
    change_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_configuration_key ON system_configuration(key);
CREATE INDEX idx_system_configuration_category ON system_configuration(category_id);
CREATE INDEX idx_tenant_config_overrides_tenant ON tenant_configuration_overrides(tenant_id);
CREATE INDEX idx_tenant_config_overrides_key ON tenant_configuration_overrides(config_key);
CREATE INDEX idx_configuration_audit_key ON configuration_audit_log(config_key, created_at DESC);

ALTER TABLE system_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_configuration_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuration_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_configuration_read ON system_configuration FOR SELECT USING (true);
CREATE POLICY tenant_config_overrides_isolation ON tenant_configuration_overrides
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY configuration_audit_read ON configuration_audit_log FOR SELECT USING (true);

-- Insert configuration categories
INSERT INTO configuration_categories (id, name, description, display_order, icon) VALUES
    ('rate_limits', 'Rate Limits', 'API and service rate limiting configuration', 1, 'Speed'),
    ('timeouts', 'Timeouts', 'Request and processing timeout settings', 2, 'Timer'),
    ('pricing', 'Pricing', 'Margins, markups, and discount configuration', 3, 'AttachMoney'),
    ('tokens', 'Token Limits', 'Token and context window limits', 4, 'Token'),
    ('retry', 'Retry Configuration', 'Retry attempts and backoff settings', 5, 'Refresh'),
    ('cache', 'Cache Settings', 'Cache TTL and invalidation rules', 6, 'Cached'),
    ('thresholds', 'Thresholds', 'Health, confidence, and quality thresholds', 7, 'TrendingUp'),
    ('discounts', 'Volume Discounts', 'Volume-based discount tier configuration', 8, 'Discount'),
    ('session', 'Session & Auth', 'Authentication and session settings', 9, 'Lock'),
    ('translation', 'Translation System', 'i18n and translation service settings', 10, 'Translate'),
    ('workflow', 'Workflow Proposals', 'Dynamic workflow proposal thresholds', 11, 'AccountTree'),
    ('notifications', 'Notifications', 'Alert thresholds and notification channels', 12, 'Notifications');

-- Insert default configurations
INSERT INTO system_configuration (key, category_id, value_type, value_decimal, display_name, description, unit, min_value, max_value) VALUES
    ('pricing.external_provider_margin', 'pricing', 'percentage', 0.40, 'External Provider Margin', 'Markup on external AI provider costs', '%', 0.00, 1.00),
    ('pricing.self_hosted_margin', 'pricing', 'percentage', 0.75, 'Self-Hosted Margin', 'Markup on self-hosted model costs', '%', 0.00, 2.00);

INSERT INTO system_configuration (key, category_id, value_type, value_integer, display_name, description, unit, min_value, max_value) VALUES
    ('rate_limits.requests_per_minute', 'rate_limits', 'integer', 100, 'Requests per Minute', 'Maximum API requests per minute per user', 'requests', 10, 10000),
    ('rate_limits.concurrent_requests', 'rate_limits', 'integer', 10, 'Concurrent Requests', 'Maximum concurrent requests per user', 'requests', 1, 100),
    ('timeouts.lambda_timeout_seconds', 'timeouts', 'duration', 30, 'Lambda Timeout', 'Default Lambda function timeout', 'seconds', 5, 900),
    ('timeouts.request_timeout_seconds', 'timeouts', 'duration', 60, 'Request Timeout', 'Maximum time for API request completion', 'seconds', 10, 300),
    ('tokens.max_tokens_per_request', 'tokens', 'integer', 128000, 'Max Tokens per Request', 'Maximum tokens allowed per request', 'tokens', 1000, 500000),
    ('retry.max_attempts', 'retry', 'integer', 3, 'Max Retry Attempts', 'Maximum number of retry attempts', 'attempts', 1, 10),
    ('cache.translation_bundle_ttl', 'cache', 'duration', 3600, 'Translation Bundle TTL', 'Time-to-live for cached translation bundles', 'seconds', 60, 86400),
    ('session.token_expiry_hours', 'session', 'integer', 24, 'Token Expiry', 'JWT token expiration time', 'hours', 1, 168);

INSERT INTO system_configuration (key, category_id, value_type, value_decimal, display_name, description, unit, min_value, max_value) VALUES
    ('thresholds.health_check_threshold', 'thresholds', 'percentage', 0.95, 'Health Check Threshold', 'Minimum success rate for healthy status', '%', 0.50, 1.00),
    ('thresholds.confidence_minimum', 'thresholds', 'percentage', 0.70, 'Minimum Confidence', 'Minimum confidence score for auto-approval', '%', 0.50, 1.00);

-- Function to get configuration value with tenant override
CREATE OR REPLACE FUNCTION get_config_value(
    p_key VARCHAR(100),
    p_tenant_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_config system_configuration%ROWTYPE;
    v_override tenant_configuration_overrides%ROWTYPE;
    v_value JSONB;
BEGIN
    -- Get base config
    SELECT * INTO v_config FROM system_configuration WHERE key = p_key;
    IF NOT FOUND THEN RETURN NULL; END IF;
    
    -- Check for tenant override
    IF p_tenant_id IS NOT NULL THEN
        SELECT * INTO v_override 
        FROM tenant_configuration_overrides 
        WHERE tenant_id = p_tenant_id AND config_key = p_key AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW());
        
        IF FOUND THEN
            CASE v_config.value_type
                WHEN 'string' THEN v_value := to_jsonb(v_override.value_string);
                WHEN 'integer' THEN v_value := to_jsonb(v_override.value_integer);
                WHEN 'decimal' THEN v_value := to_jsonb(v_override.value_decimal);
                WHEN 'boolean' THEN v_value := to_jsonb(v_override.value_boolean);
                WHEN 'json' THEN v_value := v_override.value_json;
                WHEN 'duration' THEN v_value := to_jsonb(v_override.value_integer);
                WHEN 'percentage' THEN v_value := to_jsonb(v_override.value_decimal);
                ELSE v_value := to_jsonb(v_override.value_string);
            END CASE;
            RETURN v_value;
        END IF;
    END IF;
    
    -- Return base config value
    CASE v_config.value_type
        WHEN 'string' THEN v_value := to_jsonb(v_config.value_string);
        WHEN 'integer' THEN v_value := to_jsonb(v_config.value_integer);
        WHEN 'decimal' THEN v_value := to_jsonb(v_config.value_decimal);
        WHEN 'boolean' THEN v_value := to_jsonb(v_config.value_boolean);
        WHEN 'json' THEN v_value := v_config.value_json;
        WHEN 'duration' THEN v_value := to_jsonb(v_config.value_integer);
        WHEN 'percentage' THEN v_value := to_jsonb(v_config.value_decimal);
        ELSE v_value := to_jsonb(v_config.value_string);
    END CASE;
    
    RETURN v_value;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE TRIGGER update_system_configuration_updated_at 
    BEFORE UPDATE ON system_configuration
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_config_overrides_updated_at 
    BEFORE UPDATE ON tenant_configuration_overrides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
