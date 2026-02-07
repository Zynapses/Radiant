-- Migration: 047_system_config_additional.sql
-- Description: Additional system configuration settings found during code review
-- RADIANT v4.18.0

-- Add new configuration categories
INSERT INTO system_config_categories (id, name, description, icon, sort_order) VALUES
('caching', 'Caching', 'Cache TTL and memory settings', 'hard-drive', 7),
('buffering', 'Buffering', 'Buffer sizes and flush intervals for batch operations', 'layers', 8),
('data_retention', 'Data Retention', 'Data retention periods and cleanup settings', 'archive', 9),
('security', 'Security', 'Security thresholds and anomaly detection settings', 'lock', 10),
('invitations', 'Invitations', 'User invitation settings and expiration', 'mail', 11),
('batch_processing', 'Batch Processing', 'Batch job limits and processing settings', 'package', 12)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- Caching configurations
INSERT INTO system_config (category, key, value, value_type, display_name, description, unit, min_value, max_value, default_value, sort_order) VALUES
('caching', 'redis_default_ttl_seconds', '300', 'integer', 'Redis Default TTL', 'Default time-to-live for Redis cache entries', 'seconds', 60, 3600, '300', 1),
('caching', 'memory_cache_ttl_ms', '60000', 'integer', 'Memory Cache TTL', 'TTL for in-memory cache entries', 'ms', 10000, 300000, '60000', 2),
('caching', 'feature_flag_cache_ttl_ms', '60000', 'integer', 'Feature Flag Cache TTL', 'Cache duration for feature flag lookups', 'ms', 10000, 300000, '60000', 3),
('caching', 'config_cache_ttl_ms', '60000', 'integer', 'Config Cache TTL', 'Cache duration for configuration values', 'ms', 10000, 300000, '60000', 4),
('caching', 'model_registry_cache_ttl_ms', '300000', 'integer', 'Model Registry Cache TTL', 'Cache duration for model registry data', 'ms', 60000, 900000, '300000', 5)
ON CONFLICT (category, key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    default_value = EXCLUDED.default_value;

-- Buffering configurations
INSERT INTO system_config (category, key, value, value_type, display_name, description, unit, min_value, max_value, default_value, sort_order) VALUES
('buffering', 'audit_buffer_size', '25', 'integer', 'Audit Buffer Size', 'Number of audit entries to buffer before flush', 'entries', 10, 100, '25', 1),
('buffering', 'audit_flush_interval_ms', '5000', 'integer', 'Audit Flush Interval', 'Time between automatic audit buffer flushes', 'ms', 1000, 30000, '5000', 2),
('buffering', 'metrics_buffer_size', '20', 'integer', 'Metrics Buffer Size', 'Number of metric events to buffer before flush', 'entries', 10, 100, '20', 3),
('buffering', 'metrics_flush_interval_ms', '10000', 'integer', 'Metrics Flush Interval', 'Time between automatic metrics buffer flushes', 'ms', 1000, 60000, '10000', 4),
('buffering', 'cost_events_buffer_size', '50', 'integer', 'Cost Events Buffer Size', 'Number of cost events to buffer', 'entries', 10, 200, '50', 5)
ON CONFLICT (category, key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    default_value = EXCLUDED.default_value;

-- Data retention configurations
INSERT INTO system_config (category, key, value, value_type, display_name, description, unit, min_value, max_value, default_value, sort_order) VALUES
('data_retention', 'usage_events_retention_days', '90', 'integer', 'Usage Events Retention', 'Days to retain usage/billing events', 'days', 30, 365, '90', 1),
('data_retention', 'notifications_retention_days', '30', 'integer', 'Notifications Retention', 'Days to retain user notifications', 'days', 7, 90, '30', 2),
('data_retention', 'audit_logs_retention_days', '365', 'integer', 'Audit Logs Retention', 'Days to retain audit log entries', 'days', 90, 2555, '365', 3),
('data_retention', 'session_data_retention_days', '30', 'integer', 'Session Data Retention', 'Days to retain session/conversation data', 'days', 7, 365, '30', 4),
('data_retention', 'analytics_retention_days', '90', 'integer', 'Analytics Retention', 'Days to retain analytics data', 'days', 30, 365, '90', 5),
('data_retention', 'temp_files_retention_hours', '24', 'integer', 'Temp Files Retention', 'Hours to retain temporary uploaded files', 'hours', 1, 168, '24', 6)
ON CONFLICT (category, key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    default_value = EXCLUDED.default_value;

-- Security configurations
INSERT INTO system_config (category, key, value, value_type, display_name, description, unit, min_value, max_value, default_value, sort_order) VALUES
('security', 'anomaly_suppression_window_minutes', '60', 'integer', 'Anomaly Alert Suppression', 'Minutes to suppress duplicate anomaly alerts for same user/type', 'minutes', 15, 1440, '60', 1),
('security', 'brute_force_threshold', '5', 'integer', 'Brute Force Threshold', 'Failed login attempts before triggering alert', 'attempts', 3, 20, '5', 2),
('security', 'brute_force_window_minutes', '15', 'integer', 'Brute Force Window', 'Time window for counting failed login attempts', 'minutes', 5, 60, '15', 3),
('security', 'session_timeout_minutes', '60', 'integer', 'Session Timeout', 'Idle session timeout duration', 'minutes', 15, 480, '60', 4),
('security', 'ip_block_duration_hours', '24', 'integer', 'IP Block Duration', 'Duration to block suspicious IP addresses', 'hours', 1, 168, '24', 5),
('security', 'geographic_anomaly_distance_km', '500', 'integer', 'Geographic Anomaly Distance', 'Distance threshold for geographic login anomaly detection', 'km', 100, 5000, '500', 6),
('security', 'max_concurrent_sessions', '5', 'integer', 'Max Concurrent Sessions', 'Maximum concurrent sessions per user', 'sessions', 1, 20, '5', 7),
('security', 'api_key_max_age_days', '365', 'integer', 'API Key Max Age', 'Maximum age for API keys before requiring rotation', 'days', 30, 730, '365', 8)
ON CONFLICT (category, key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    default_value = EXCLUDED.default_value;

-- Invitation configurations
INSERT INTO system_config (category, key, value, value_type, display_name, description, unit, min_value, max_value, default_value, sort_order) VALUES
('invitations', 'default_expiry_hours', '72', 'integer', 'Default Invitation Expiry', 'Default hours until invitation expires', 'hours', 24, 168, '72', 1),
('invitations', 'max_expiry_hours', '168', 'integer', 'Max Invitation Expiry', 'Maximum hours an invitation can be valid', 'hours', 48, 720, '168', 2),
('invitations', 'max_resend_count', '3', 'integer', 'Max Resend Count', 'Maximum times an invitation can be resent', 'times', 1, 10, '3', 3),
('invitations', 'cooldown_between_resends_minutes', '15', 'integer', 'Resend Cooldown', 'Minimum time between invitation resends', 'minutes', 5, 60, '15', 4)
ON CONFLICT (category, key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    default_value = EXCLUDED.default_value;

-- Batch processing configurations
INSERT INTO system_config (category, key, value, value_type, display_name, description, unit, min_value, max_value, default_value, sort_order) VALUES
('batch_processing', 'max_events_per_batch', '100', 'integer', 'Max Events Per Batch', 'Maximum events in a single batch request', 'events', 10, 1000, '100', 1),
('batch_processing', 'max_items_per_chunk', '50', 'integer', 'Max Items Per Chunk', 'Maximum items in a batch processing chunk', 'items', 10, 500, '50', 2),
('batch_processing', 'chunk_timeout_seconds', '300', 'integer', 'Chunk Processing Timeout', 'Timeout for processing a single batch chunk', 'seconds', 60, 900, '300', 3),
('batch_processing', 'max_concurrent_chunks', '10', 'integer', 'Max Concurrent Chunks', 'Maximum chunks processed concurrently', 'chunks', 1, 50, '10', 4),
('batch_processing', 'retry_failed_chunks', 'true', 'boolean', 'Retry Failed Chunks', 'Automatically retry failed batch chunks', '', NULL, NULL, 'true', 5),
('batch_processing', 'max_chunk_retries', '3', 'integer', 'Max Chunk Retries', 'Maximum retry attempts for failed chunks', 'attempts', 1, 10, '3', 6)
ON CONFLICT (category, key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    default_value = EXCLUDED.default_value;

-- Additional AI provider configurations
INSERT INTO system_config (category, key, value, value_type, display_name, description, unit, min_value, max_value, default_value, sort_order) VALUES
('ai_providers', 'streaming_chunk_size', '1024', 'integer', 'Streaming Chunk Size', 'Size of chunks for streaming responses', 'bytes', 256, 8192, '1024', 6),
('ai_providers', 'max_context_tokens', '128000', 'integer', 'Max Context Tokens', 'Maximum tokens allowed in context window', 'tokens', 4096, 200000, '128000', 7),
('ai_providers', 'default_system_prompt_max_tokens', '2000', 'integer', 'System Prompt Max Tokens', 'Maximum tokens for system prompts', 'tokens', 500, 10000, '2000', 8),
('ai_providers', 'fallback_enabled', 'true', 'boolean', 'Enable Model Fallback', 'Automatically fallback to alternative models on failure', '', NULL, NULL, 'true', 9),
('ai_providers', 'content_filter_enabled', 'true', 'boolean', 'Content Filter Enabled', 'Enable content safety filtering', '', NULL, NULL, 'true', 10)
ON CONFLICT (category, key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    default_value = EXCLUDED.default_value;

-- Additional rate limiting configurations
INSERT INTO system_config (category, key, value, value_type, display_name, description, unit, min_value, max_value, default_value, sort_order) VALUES
('rate_limiting', 'concurrent_request_limit', '10', 'integer', 'Concurrent Request Limit', 'Max concurrent requests per API key', 'requests', 1, 100, '10', 8),
('rate_limiting', 'daily_request_limit', '10000', 'integer', 'Daily Request Limit', 'Max requests per day per tenant (0 = unlimited)', 'requests', 0, 1000000, '10000', 9),
('rate_limiting', 'tokens_per_minute_limit', '100000', 'integer', 'Tokens Per Minute Limit', 'Max tokens per minute per tenant', 'tokens', 1000, 10000000, '100000', 10),
('rate_limiting', 'cost_per_day_limit', '100', 'decimal', 'Daily Cost Limit', 'Max cost per day per tenant in USD (0 = unlimited)', 'USD', 0, 10000, '100', 11)
ON CONFLICT (category, key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    default_value = EXCLUDED.default_value;
