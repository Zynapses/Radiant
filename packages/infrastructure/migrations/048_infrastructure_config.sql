-- ============================================================================
-- RADIANT v4.18.0 - Infrastructure Configuration Migration
-- Adds configurable parameters for DB pools, logging, error handling, etc.
-- ============================================================================

-- Add infrastructure-related config categories
INSERT INTO config_categories (id, name, description, icon, display_order, is_system) VALUES
    ('connection_pool', 'Connection Pool', 'Database connection pool settings', 'Database', 11, true),
    ('logging', 'Logging', 'Logging and observability settings', 'FileText', 12, true),
    ('error_handling', 'Error Handling', 'Error response and retry settings', 'AlertTriangle', 13, true),
    ('request_handling', 'Request Handling', 'Request ID, sanitization, and validation settings', 'Shield', 14, true),
    ('circuit_breaker', 'Circuit Breaker', 'Circuit breaker thresholds per provider', 'Zap', 15, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- CONNECTION POOL SETTINGS
-- ============================================================================
INSERT INTO system_config (category_id, key, value, default_value, value_type, min_value, max_value, name, description, unit, requires_restart) VALUES
    ('connection_pool', 'max_connections', '10', '10', 'number', 1, 100, 'Max Connections', 'Maximum number of connections in the pool', 'connections', true),
    ('connection_pool', 'min_connections', '1', '1', 'number', 0, 50, 'Min Connections', 'Minimum number of connections to maintain', 'connections', true),
    ('connection_pool', 'acquire_timeout_ms', '10000', '10000', 'number', 1000, 60000, 'Acquire Timeout', 'Time to wait for available connection', 'ms', false),
    ('connection_pool', 'idle_timeout_ms', '30000', '30000', 'number', 5000, 300000, 'Idle Timeout', 'Time before idle connections are closed', 'ms', false),
    ('connection_pool', 'connection_timeout_ms', '5000', '5000', 'number', 1000, 30000, 'Connection Timeout', 'Time to establish new connection', 'ms', false),
    ('connection_pool', 'max_waiting_clients', '50', '50', 'number', 10, 500, 'Max Waiting Clients', 'Maximum clients waiting for connection', 'clients', false),
    ('connection_pool', 'utilization_warning_threshold', '0.7', '0.7', 'number', 0.5, 0.95, 'Warning Threshold', 'Pool utilization to trigger warning', 'percentage', false),
    ('connection_pool', 'utilization_critical_threshold', '0.9', '0.9', 'number', 0.7, 0.99, 'Critical Threshold', 'Pool utilization to trigger critical alert', 'percentage', false),
    ('connection_pool', 'statement_timeout_ms', '30000', '30000', 'number', 5000, 300000, 'Statement Timeout', 'Maximum time for query execution', 'ms', false),
    ('connection_pool', 'health_check_interval_ms', '30000', '30000', 'number', 5000, 120000, 'Health Check Interval', 'Time between pool health checks', 'ms', false)
ON CONFLICT (category_id, key) DO NOTHING;

-- ============================================================================
-- LOGGING SETTINGS
-- ============================================================================
INSERT INTO system_config (category_id, key, value, default_value, value_type, name, description, allow_tenant_override) VALUES
    ('logging', 'default_log_level', '"info"', '"info"', 'string', 'Default Log Level', 'Default logging level (debug, info, warn, error)', false),
    ('logging', 'include_stack_traces', 'true', 'true', 'boolean', 'Include Stack Traces', 'Include stack traces in error logs', false),
    ('logging', 'log_request_body', 'false', 'false', 'boolean', 'Log Request Body', 'Log request bodies (may contain sensitive data)', false),
    ('logging', 'log_response_body', 'false', 'false', 'boolean', 'Log Response Body', 'Log response bodies (may contain sensitive data)', false),
    ('logging', 'redact_sensitive_fields', 'true', 'true', 'boolean', 'Redact Sensitive Fields', 'Automatically redact sensitive fields in logs', false),
    ('logging', 'sensitive_field_patterns', '["password", "token", "secret", "key", "authorization", "cookie", "credit_card", "ssn"]', '["password", "token", "secret", "key", "authorization", "cookie", "credit_card", "ssn"]', 'array', 'Sensitive Field Patterns', 'Field name patterns to redact from logs', false),
    ('logging', 'max_log_message_length', '10000', '10000', 'number', 'Max Log Message Length', 'Maximum characters per log message', false),
    ('logging', 'structured_logging_enabled', 'true', 'true', 'boolean', 'Structured Logging', 'Enable JSON structured logging', false),
    ('logging', 'performance_logging_enabled', 'true', 'true', 'boolean', 'Performance Logging', 'Log request duration and metrics', false),
    ('logging', 'slow_request_threshold_ms', '5000', '5000', 'number', 'Slow Request Threshold', 'Duration to flag as slow request', false)
ON CONFLICT (category_id, key) DO NOTHING;

-- ============================================================================
-- ERROR HANDLING SETTINGS
-- ============================================================================
INSERT INTO system_config (category_id, key, value, default_value, value_type, min_value, max_value, name, description) VALUES
    ('error_handling', 'include_error_details_in_response', 'false', 'false', 'boolean', NULL, NULL, 'Include Error Details', 'Include detailed error info in API responses'),
    ('error_handling', 'include_stack_in_dev', 'true', 'true', 'boolean', NULL, NULL, 'Stack Traces in Dev', 'Include stack traces in dev environment'),
    ('error_handling', 'default_retry_count', '3', '3', 'number', 0, 10, 'Default Retry Count', 'Default number of retries for retryable errors'),
    ('error_handling', 'default_retry_delay_ms', '1000', '1000', 'number', 100, 30000, 'Default Retry Delay', 'Base delay between retries'),
    ('error_handling', 'retry_backoff_multiplier', '2.0', '2.0', 'number', 1.0, 5.0, 'Retry Backoff Multiplier', 'Exponential backoff multiplier'),
    ('error_handling', 'max_retry_delay_ms', '30000', '30000', 'number', 5000, 120000, 'Max Retry Delay', 'Maximum delay between retries'),
    ('error_handling', 'error_aggregation_window_ms', '60000', '60000', 'number', 10000, 300000, 'Error Aggregation Window', 'Window for grouping similar errors'),
    ('error_handling', 'error_rate_alert_threshold', '0.05', '0.05', 'number', 0.01, 0.5, 'Error Rate Alert', 'Error rate percentage to trigger alert'),
    ('error_handling', 'preserve_error_context', 'true', 'true', 'boolean', NULL, NULL, 'Preserve Error Context', 'Preserve original error context in wrapped errors'),
    ('error_handling', 'localize_error_messages', 'true', 'true', 'boolean', NULL, NULL, 'Localize Errors', 'Enable i18n for error messages')
ON CONFLICT (category_id, key) DO NOTHING;

-- ============================================================================
-- REQUEST HANDLING SETTINGS
-- ============================================================================
INSERT INTO system_config (category_id, key, value, default_value, value_type, min_value, max_value, name, description) VALUES
    ('request_handling', 'generate_request_id', 'true', 'true', 'boolean', NULL, NULL, 'Generate Request ID', 'Auto-generate request ID if not provided'),
    ('request_handling', 'request_id_header', '"x-request-id"', '"x-request-id"', 'string', NULL, NULL, 'Request ID Header', 'Header name for request ID'),
    ('request_handling', 'propagate_request_id', 'true', 'true', 'boolean', NULL, NULL, 'Propagate Request ID', 'Include request ID in downstream calls'),
    ('request_handling', 'sanitize_html_input', 'true', 'true', 'boolean', NULL, NULL, 'Sanitize HTML', 'Sanitize HTML in text inputs'),
    ('request_handling', 'sanitize_sql_input', 'true', 'true', 'boolean', NULL, NULL, 'Sanitize SQL', 'Check for SQL injection patterns'),
    ('request_handling', 'max_request_body_size_mb', '10', '10', 'number', 1, 100, 'Max Request Body Size', 'Maximum request body size in MB'),
    ('request_handling', 'max_string_field_length', '10000', '10000', 'number', 100, 100000, 'Max String Field Length', 'Maximum length for string fields'),
    ('request_handling', 'max_array_items', '1000', '1000', 'number', 10, 10000, 'Max Array Items', 'Maximum items in array fields'),
    ('request_handling', 'trim_string_inputs', 'true', 'true', 'boolean', NULL, NULL, 'Trim String Inputs', 'Automatically trim whitespace from strings'),
    ('request_handling', 'normalize_unicode', 'true', 'true', 'boolean', NULL, NULL, 'Normalize Unicode', 'Normalize unicode input to NFC form'),
    ('request_handling', 'block_null_bytes', 'true', 'true', 'boolean', NULL, NULL, 'Block Null Bytes', 'Reject inputs containing null bytes'),
    ('request_handling', 'cors_allowed_origins', '["*"]', '["*"]', 'array', NULL, NULL, 'CORS Allowed Origins', 'Allowed origins for CORS'),
    ('request_handling', 'cors_max_age_seconds', '86400', '86400', 'number', 0, 604800, 'CORS Max Age', 'Max age for CORS preflight cache')
ON CONFLICT (category_id, key) DO NOTHING;

-- ============================================================================
-- CIRCUIT BREAKER SETTINGS (per provider)
-- ============================================================================
INSERT INTO system_config (category_id, key, value, default_value, value_type, min_value, max_value, name, description, allow_tenant_override) VALUES
    ('circuit_breaker', 'default_failure_threshold', '5', '5', 'number', 1, 20, 'Default Failure Threshold', 'Failures before circuit opens', false),
    ('circuit_breaker', 'default_success_threshold', '2', '2', 'number', 1, 10, 'Default Success Threshold', 'Successes to close circuit', false),
    ('circuit_breaker', 'default_timeout_ms', '30000', '30000', 'number', 5000, 120000, 'Default Timeout', 'Request timeout before failure', false),
    ('circuit_breaker', 'default_reset_timeout_ms', '60000', '60000', 'number', 10000, 300000, 'Default Reset Timeout', 'Time before half-open state', false),
    ('circuit_breaker', 'openai_failure_threshold', '5', '5', 'number', 1, 20, 'OpenAI Failure Threshold', 'OpenAI failures before circuit opens', true),
    ('circuit_breaker', 'openai_timeout_ms', '60000', '60000', 'number', 10000, 180000, 'OpenAI Timeout', 'OpenAI request timeout', true),
    ('circuit_breaker', 'anthropic_failure_threshold', '5', '5', 'number', 1, 20, 'Anthropic Failure Threshold', 'Anthropic failures before circuit opens', true),
    ('circuit_breaker', 'anthropic_timeout_ms', '90000', '90000', 'number', 10000, 180000, 'Anthropic Timeout', 'Anthropic request timeout', true),
    ('circuit_breaker', 'google_failure_threshold', '5', '5', 'number', 1, 20, 'Google Failure Threshold', 'Google failures before circuit opens', true),
    ('circuit_breaker', 'google_timeout_ms', '60000', '60000', 'number', 10000, 180000, 'Google Timeout', 'Google request timeout', true),
    ('circuit_breaker', 'enable_half_open_requests', 'true', 'true', 'boolean', NULL, NULL, 'Enable Half-Open', 'Allow test requests in half-open state', false),
    ('circuit_breaker', 'half_open_max_requests', '3', '3', 'number', 1, 10, 'Half-Open Max Requests', 'Test requests allowed in half-open', false)
ON CONFLICT (category_id, key) DO NOTHING;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_system_config_category_key ON system_config(category_id, key);
CREATE INDEX IF NOT EXISTS idx_config_audit_timestamp ON config_audit_log(changed_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE system_config IS 'Centralized configuration store for all runtime parameters';
COMMENT ON TABLE config_categories IS 'Configuration categories for UI organization';
COMMENT ON TABLE config_audit_log IS 'Audit trail for all configuration changes';
