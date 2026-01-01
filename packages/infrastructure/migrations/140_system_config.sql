-- Migration: 046_system_config.sql
-- Description: System configuration table for admin-editable runtime settings
-- RADIANT v4.18.0

-- System configuration table
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    value_type VARCHAR(20) NOT NULL DEFAULT 'string',
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    unit VARCHAR(50),
    min_value NUMERIC,
    max_value NUMERIC,
    default_value JSONB,
    is_sensitive BOOLEAN DEFAULT false,
    requires_restart BOOLEAN DEFAULT false,
    editable_by VARCHAR(50) DEFAULT 'super_admin',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID,
    UNIQUE(category, key)
);

-- Configuration audit log
CREATE TABLE IF NOT EXISTS system_config_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES system_config(id) ON DELETE CASCADE,
    config_key VARCHAR(150) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_by UUID,
    changed_by_email VARCHAR(255),
    change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config(category);
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(category, key);
CREATE INDEX IF NOT EXISTS idx_system_config_audit_config ON system_config_audit(config_id);
CREATE INDEX IF NOT EXISTS idx_system_config_audit_created ON system_config_audit(created_at DESC);

-- Configuration categories
CREATE TABLE IF NOT EXISTS system_config_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Insert categories
INSERT INTO system_config_categories (id, name, description, icon, sort_order) VALUES
('circuit_breaker', 'Circuit Breakers', 'Configure failure thresholds and recovery for external services', 'shield', 1),
('connection_pool', 'Connection Pool', 'Database connection pool settings and limits', 'database', 2),
('rate_limiting', 'Rate Limiting', 'API rate limits and throttling configuration', 'gauge', 3),
('timeouts', 'Timeouts', 'Request and operation timeout settings', 'clock', 4),
('deduplication', 'Deduplication', 'Request deduplication windows and cache settings', 'copy', 5),
('ai_providers', 'AI Providers', 'AI model provider-specific settings', 'brain', 6)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- Insert default circuit breaker configurations
INSERT INTO system_config (category, key, value, value_type, display_name, description, unit, min_value, max_value, default_value, sort_order) VALUES
-- Circuit Breaker: OpenAI
('circuit_breaker', 'openai.failure_threshold', '5', 'integer', 'OpenAI Failure Threshold', 'Number of failures before circuit opens', 'failures', 1, 50, '5', 1),
('circuit_breaker', 'openai.success_threshold', '2', 'integer', 'OpenAI Success Threshold', 'Successes needed to close circuit from half-open', 'successes', 1, 20, '2', 2),
('circuit_breaker', 'openai.timeout_ms', '60000', 'integer', 'OpenAI Recovery Timeout', 'Time before attempting recovery from open state', 'ms', 5000, 300000, '60000', 3),

-- Circuit Breaker: Anthropic
('circuit_breaker', 'anthropic.failure_threshold', '5', 'integer', 'Anthropic Failure Threshold', 'Number of failures before circuit opens', 'failures', 1, 50, '5', 4),
('circuit_breaker', 'anthropic.success_threshold', '2', 'integer', 'Anthropic Success Threshold', 'Successes needed to close circuit from half-open', 'successes', 1, 20, '2', 5),
('circuit_breaker', 'anthropic.timeout_ms', '60000', 'integer', 'Anthropic Recovery Timeout', 'Time before attempting recovery from open state', 'ms', 5000, 300000, '60000', 6),

-- Circuit Breaker: LiteLLM
('circuit_breaker', 'litellm.failure_threshold', '3', 'integer', 'LiteLLM Failure Threshold', 'Number of failures before circuit opens', 'failures', 1, 50, '3', 7),
('circuit_breaker', 'litellm.success_threshold', '2', 'integer', 'LiteLLM Success Threshold', 'Successes needed to close circuit from half-open', 'successes', 1, 20, '2', 8),
('circuit_breaker', 'litellm.timeout_ms', '30000', 'integer', 'LiteLLM Recovery Timeout', 'Time before attempting recovery from open state', 'ms', 5000, 300000, '30000', 9),

-- Circuit Breaker: Bedrock
('circuit_breaker', 'bedrock.failure_threshold', '5', 'integer', 'Bedrock Failure Threshold', 'Number of failures before circuit opens', 'failures', 1, 50, '5', 10),
('circuit_breaker', 'bedrock.timeout_ms', '45000', 'integer', 'Bedrock Recovery Timeout', 'Time before attempting recovery from open state', 'ms', 5000, 300000, '45000', 11),

-- Connection Pool
('connection_pool', 'max_connections', '10', 'integer', 'Max Connections', 'Maximum database connections per Lambda instance', 'connections', 1, 100, '10', 1),
('connection_pool', 'min_connections', '1', 'integer', 'Min Connections', 'Minimum idle connections to maintain', 'connections', 0, 20, '1', 2),
('connection_pool', 'acquire_timeout_ms', '10000', 'integer', 'Acquire Timeout', 'Maximum time to wait for a connection', 'ms', 1000, 60000, '10000', 3),
('connection_pool', 'idle_timeout_ms', '30000', 'integer', 'Idle Timeout', 'Time before idle connections are closed', 'ms', 5000, 300000, '30000', 4),
('connection_pool', 'connection_timeout_ms', '5000', 'integer', 'Connection Timeout', 'Timeout for establishing new connections', 'ms', 1000, 30000, '5000', 5),
('connection_pool', 'max_waiting_clients', '50', 'integer', 'Max Waiting Clients', 'Maximum requests waiting for a connection', 'clients', 10, 500, '50', 6),
('connection_pool', 'utilization_warning_threshold', '0.7', 'decimal', 'Warning Threshold', 'Pool utilization level that triggers warnings', 'ratio', 0.5, 0.95, '0.7', 7),
('connection_pool', 'utilization_critical_threshold', '0.9', 'decimal', 'Critical Threshold', 'Pool utilization level that triggers critical alerts', 'ratio', 0.7, 0.99, '0.9', 8),

-- Rate Limiting
('rate_limiting', 'default_requests_per_minute', '100', 'integer', 'Default Rate Limit', 'Default requests per minute per API key', 'requests/min', 10, 10000, '100', 1),
('rate_limiting', 'default_window_ms', '60000', 'integer', 'Rate Limit Window', 'Time window for rate limit calculation', 'ms', 10000, 300000, '60000', 2),
('rate_limiting', 'burst_multiplier', '2', 'decimal', 'Burst Multiplier', 'Multiplier for burst allowance above rate limit', 'x', 1, 10, '2', 3),
('rate_limiting', 'tier_1_multiplier', '1', 'decimal', 'Tier 1 Multiplier', 'Rate limit multiplier for Tier 1 (Seed)', 'x', 0.5, 5, '1', 4),
('rate_limiting', 'tier_2_multiplier', '2', 'decimal', 'Tier 2 Multiplier', 'Rate limit multiplier for Tier 2 (Growth)', 'x', 1, 10, '2', 5),
('rate_limiting', 'tier_3_multiplier', '5', 'decimal', 'Tier 3 Multiplier', 'Rate limit multiplier for Tier 3 (Scale)', 'x', 2, 20, '5', 6),
('rate_limiting', 'tier_4_multiplier', '10', 'decimal', 'Tier 4 Multiplier', 'Rate limit multiplier for Tier 4 (Enterprise)', 'x', 5, 50, '10', 7),

-- Timeouts
('timeouts', 'default_request_timeout_ms', '30000', 'integer', 'Default Request Timeout', 'Default timeout for API requests', 'ms', 5000, 120000, '30000', 1),
('timeouts', 'ai_request_timeout_ms', '120000', 'integer', 'AI Request Timeout', 'Timeout for AI model requests', 'ms', 30000, 600000, '120000', 2),
('timeouts', 'streaming_timeout_ms', '300000', 'integer', 'Streaming Timeout', 'Timeout for streaming responses', 'ms', 60000, 900000, '300000', 3),
('timeouts', 'webhook_timeout_ms', '10000', 'integer', 'Webhook Timeout', 'Timeout for outbound webhook calls', 'ms', 1000, 60000, '10000', 4),
('timeouts', 'database_query_timeout_ms', '30000', 'integer', 'Database Query Timeout', 'Maximum time for database queries', 'ms', 5000, 120000, '30000', 5),

-- Deduplication
('deduplication', 'default_window_ms', '5000', 'integer', 'Default Dedup Window', 'Default time window for request deduplication', 'ms', 1000, 60000, '5000', 1),
('deduplication', 'chat_completion_window_ms', '10000', 'integer', 'Chat Completion Window', 'Deduplication window for chat completions', 'ms', 2000, 60000, '10000', 2),
('deduplication', 'billing_window_ms', '60000', 'integer', 'Billing Operation Window', 'Deduplication window for billing operations', 'ms', 30000, 300000, '60000', 3),
('deduplication', 'max_cache_entries', '10000', 'integer', 'Max Cache Entries', 'Maximum entries in deduplication cache', 'entries', 1000, 100000, '10000', 4),

-- AI Providers
('ai_providers', 'default_temperature', '0.7', 'decimal', 'Default Temperature', 'Default temperature for AI completions', '', 0, 2, '0.7', 1),
('ai_providers', 'default_max_tokens', '4096', 'integer', 'Default Max Tokens', 'Default maximum tokens for completions', 'tokens', 100, 128000, '4096', 2),
('ai_providers', 'retry_attempts', '3', 'integer', 'Retry Attempts', 'Number of retry attempts for failed AI requests', 'attempts', 0, 10, '3', 3),
('ai_providers', 'retry_delay_ms', '1000', 'integer', 'Retry Delay', 'Initial delay between retry attempts', 'ms', 100, 10000, '1000', 4),
('ai_providers', 'retry_backoff_multiplier', '2', 'decimal', 'Retry Backoff', 'Multiplier for exponential backoff', 'x', 1, 5, '2', 5)

ON CONFLICT (category, key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    default_value = EXCLUDED.default_value,
    min_value = EXCLUDED.min_value,
    max_value = EXCLUDED.max_value,
    updated_at = NOW();

-- Function to log config changes
CREATE OR REPLACE FUNCTION log_system_config_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.value IS DISTINCT FROM NEW.value THEN
        INSERT INTO system_config_audit (
            config_id, config_key, old_value, new_value, changed_by
        ) VALUES (
            NEW.id, 
            NEW.category || '.' || NEW.key, 
            OLD.value, 
            NEW.value,
            NEW.updated_by
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for audit logging
DROP TRIGGER IF EXISTS system_config_audit_trigger ON system_config;
CREATE TRIGGER system_config_audit_trigger
    AFTER UPDATE ON system_config
    FOR EACH ROW
    EXECUTE FUNCTION log_system_config_change();
