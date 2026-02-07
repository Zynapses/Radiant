-- RADIANT v4.18.0 - AWS Free Tier Monitoring Schema
-- Migration: 160_aws_monitoring.sql
-- CloudWatch, X-Ray, and Cost Explorer integration tables
-- ============================================================================

-- ============================================================================
-- AWS MONITORING CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS aws_monitoring_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    refresh_interval_minutes INTEGER NOT NULL DEFAULT 5,
    cloudwatch_config JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "lambdaFunctions": [],
        "auroraClusterId": null,
        "ecsClusterName": null,
        "customNamespaces": []
    }'::jsonb,
    xray_config JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "samplingRate": 0.05,
        "filterExpression": null,
        "traceRetentionDays": 30
    }'::jsonb,
    cost_explorer_config JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "budgetAlertThreshold": 80,
        "anomalyDetection": true,
        "forecastEnabled": true
    }'::jsonb,
    alerting_config JSONB NOT NULL DEFAULT '{
        "slackWebhook": null,
        "emailAddresses": [],
        "thresholds": {
            "lambdaErrorRate": 5,
            "lambdaP99Latency": 10000,
            "auroraCpuPercent": 80,
            "costDailyLimit": null,
            "xrayErrorRate": 5
        }
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- Index for quick tenant lookup
CREATE INDEX IF NOT EXISTS idx_aws_monitoring_config_tenant ON aws_monitoring_config(tenant_id);

-- ============================================================================
-- METRICS CACHE (For reducing API calls to AWS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS aws_monitoring_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL, -- 'lambda', 'aurora', 'ecs', 'xray', 'cost', 'health', 'dashboard'
    metric_key VARCHAR(255) NOT NULL, -- function name, cluster id, 'main', etc.
    data JSONB NOT NULL,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    ttl_seconds INTEGER NOT NULL DEFAULT 300,
    UNIQUE(tenant_id, metric_type, metric_key)
);

-- Index for cache expiration cleanup
CREATE INDEX IF NOT EXISTS idx_aws_monitoring_cache_expires ON aws_monitoring_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_aws_monitoring_cache_tenant ON aws_monitoring_cache(tenant_id, metric_type);

-- ============================================================================
-- METRICS AGGREGATIONS (Historical data for trends)
-- ============================================================================

CREATE TABLE IF NOT EXISTS aws_monitoring_aggregations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL, -- 'hourly', 'daily', 'weekly', 'monthly'
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    lambda_summary JSONB, -- {totalInvocations, totalErrors, avgDuration, totalCost}
    aurora_summary JSONB, -- {avgCpu, avgConnections, peakConnections, totalIOPS}
    xray_summary JSONB, -- {totalTraces, errorRate, avgLatency, p99Latency}
    cost_summary JSONB, -- {totalCost, topService, topServiceCost}
    free_tier_summary JSONB, -- {lambdaUsed, xrayUsed, savings}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, period_type, period_start)
);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_aws_monitoring_agg_tenant_period 
    ON aws_monitoring_aggregations(tenant_id, period_type, period_start DESC);

-- ============================================================================
-- COST ANOMALIES (Tracked anomalies from Cost Explorer)
-- ============================================================================

CREATE TABLE IF NOT EXISTS aws_cost_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    anomaly_id VARCHAR(255) NOT NULL, -- AWS anomaly ID
    service VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    actual_cost DECIMAL(12,4) NOT NULL,
    expected_cost DECIMAL(12,4) NOT NULL,
    impact_percentage DECIMAL(8,2) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    root_cause TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'acknowledged', 'resolved'
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, anomaly_id)
);

-- Index for anomaly queries
CREATE INDEX IF NOT EXISTS idx_aws_cost_anomalies_tenant ON aws_cost_anomalies(tenant_id, status, created_at DESC);

-- ============================================================================
-- MONITORING ALERTS (Alert history)
-- ============================================================================

CREATE TABLE IF NOT EXISTS aws_monitoring_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'lambda_error', 'aurora_cpu', 'cost_spike', 'xray_error', 'free_tier'
    severity VARCHAR(20) NOT NULL, -- 'info', 'warning', 'critical'
    service_name VARCHAR(255),
    metric_name VARCHAR(100),
    threshold_value DECIMAL(12,4),
    actual_value DECIMAL(12,4),
    message TEXT NOT NULL,
    notification_sent BOOLEAN NOT NULL DEFAULT false,
    notification_channel VARCHAR(50), -- 'slack', 'email', 'both'
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for alert queries
CREATE INDEX IF NOT EXISTS idx_aws_monitoring_alerts_tenant ON aws_monitoring_alerts(tenant_id, acknowledged, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aws_monitoring_alerts_type ON aws_monitoring_alerts(alert_type, severity, created_at DESC);

-- ============================================================================
-- FREE TIER USAGE TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS aws_free_tier_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    service VARCHAR(100) NOT NULL, -- 'Lambda', 'X-Ray', 'CloudWatch', 'Aurora'
    metric VARCHAR(100) NOT NULL, -- 'Invocations', 'Traces', 'CustomMetrics', 'ACU'
    free_tier_limit BIGINT NOT NULL,
    used_amount BIGINT NOT NULL,
    unit VARCHAR(50) NOT NULL,
    percent_used DECIMAL(8,2) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'ok', 'warning', 'exceeded'
    estimated_overage_cost DECIMAL(12,4),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, period_start, service, metric)
);

-- Index for free tier queries
CREATE INDEX IF NOT EXISTS idx_aws_free_tier_usage_tenant ON aws_free_tier_usage(tenant_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_aws_free_tier_usage_status ON aws_free_tier_usage(status, period_start DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION cleanup_aws_monitoring_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM aws_monitoring_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate free tier savings
CREATE OR REPLACE FUNCTION calculate_free_tier_savings(p_tenant_id UUID, p_period_start DATE)
RETURNS DECIMAL AS $$
DECLARE
    total_savings DECIMAL := 0;
    lambda_savings DECIMAL;
    xray_savings DECIMAL;
BEGIN
    -- Lambda savings: $0.20 per 1M requests (first 1M free)
    SELECT LEAST(used_amount, free_tier_limit) * 0.0000002 INTO lambda_savings
    FROM aws_free_tier_usage
    WHERE tenant_id = p_tenant_id 
      AND period_start = p_period_start 
      AND service = 'Lambda' 
      AND metric = 'Invocations';
    
    -- X-Ray savings: $0.50 per 100K traces (first 100K free)
    SELECT LEAST(used_amount, free_tier_limit) * 0.000005 INTO xray_savings
    FROM aws_free_tier_usage
    WHERE tenant_id = p_tenant_id 
      AND period_start = p_period_start 
      AND service = 'X-Ray' 
      AND metric = 'Traces';
    
    total_savings := COALESCE(lambda_savings, 0) + COALESCE(xray_savings, 0);
    RETURN total_savings;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE aws_monitoring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE aws_monitoring_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE aws_monitoring_aggregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE aws_cost_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE aws_monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE aws_free_tier_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY aws_monitoring_config_tenant_isolation ON aws_monitoring_config
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY aws_monitoring_cache_tenant_isolation ON aws_monitoring_cache
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY aws_monitoring_aggregations_tenant_isolation ON aws_monitoring_aggregations
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY aws_cost_anomalies_tenant_isolation ON aws_cost_anomalies
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY aws_monitoring_alerts_tenant_isolation ON aws_monitoring_alerts
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY aws_free_tier_usage_tenant_isolation ON aws_free_tier_usage
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE aws_monitoring_config IS 'Per-tenant AWS monitoring configuration';
COMMENT ON TABLE aws_monitoring_cache IS 'Cached metrics to reduce AWS API calls';
COMMENT ON TABLE aws_monitoring_aggregations IS 'Aggregated historical metrics for trends';
COMMENT ON TABLE aws_cost_anomalies IS 'Cost anomalies detected by AWS Cost Explorer';
COMMENT ON TABLE aws_monitoring_alerts IS 'Alert history for monitoring thresholds';
COMMENT ON TABLE aws_free_tier_usage IS 'Track free tier usage to avoid unexpected charges';

-- ============================================================================
-- NOTIFICATION TARGETS (Admin-settable phone numbers and emails)
-- ============================================================================

CREATE TABLE IF NOT EXISTS aws_monitoring_notification_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('email', 'sms')),
    value VARCHAR(255) NOT NULL, -- Email address or E.164 phone number
    name VARCHAR(100) NOT NULL, -- Admin display name
    enabled BOOLEAN NOT NULL DEFAULT true,
    verified BOOLEAN NOT NULL DEFAULT false,
    verification_code VARCHAR(10),
    verification_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, type, value)
);

CREATE INDEX IF NOT EXISTS idx_notification_targets_tenant ON aws_monitoring_notification_targets(tenant_id, enabled);

-- ============================================================================
-- SPEND THRESHOLDS (Admin-settable hourly/daily/weekly/monthly limits)
-- ============================================================================

CREATE TABLE IF NOT EXISTS aws_monitoring_spend_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period VARCHAR(20) NOT NULL CHECK (period IN ('hourly', 'daily', 'weekly', 'monthly')),
    threshold_amount DECIMAL(12,4) NOT NULL,
    warning_percent INTEGER NOT NULL DEFAULT 80, -- Warn at this % of threshold
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    last_warning_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, period)
);

CREATE INDEX IF NOT EXISTS idx_spend_thresholds_tenant ON aws_monitoring_spend_thresholds(tenant_id, enabled);

-- ============================================================================
-- METRIC THRESHOLDS (Admin-settable metric-based alerts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS aws_monitoring_metric_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN (
        'lambda_error_rate', 'lambda_p99_latency', 'aurora_cpu', 
        'xray_error_rate', 'free_tier_usage'
    )),
    threshold_value DECIMAL(12,4) NOT NULL,
    comparison VARCHAR(10) NOT NULL DEFAULT 'gt' CHECK (comparison IN ('gt', 'lt', 'gte', 'lte')),
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_metric_thresholds_tenant ON aws_monitoring_metric_thresholds(tenant_id, enabled);

-- ============================================================================
-- NOTIFICATION LOG (Audit trail for sent notifications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS aws_monitoring_notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    target_id UUID REFERENCES aws_monitoring_notification_targets(id) ON DELETE SET NULL,
    threshold_id UUID, -- Can reference spend or metric threshold
    type VARCHAR(30) NOT NULL CHECK (type IN (
        'spend_warning', 'spend_exceeded', 'metric_exceeded', 
        'free_tier_warning', 'free_tier_exceeded'
    )),
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_notification_log_tenant ON aws_monitoring_notification_log(tenant_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_status ON aws_monitoring_notification_log(delivery_status, sent_at DESC);

-- ============================================================================
-- FREE TIER SERVICE SETTINGS (Admin toggles for each AWS service)
-- ============================================================================

CREATE TABLE IF NOT EXISTS aws_free_tier_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service VARCHAR(30) NOT NULL CHECK (service IN (
        'lambda', 'aurora', 'xray', 'cloudwatch', 'cost_explorer',
        'api_gateway', 'sqs', 's3', 'dynamodb', 'sns', 'ses'
    )),
    free_tier_enabled BOOLEAN NOT NULL DEFAULT true,  -- ON by default
    paid_tier_enabled BOOLEAN NOT NULL DEFAULT false, -- Admin must explicitly enable
    auto_scale_to_paid BOOLEAN NOT NULL DEFAULT false, -- Auto-upgrade when free tier exceeded
    max_paid_budget DECIMAL(12,4),  -- Optional budget cap for paid tier
    enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    enabled_by VARCHAR(255),  -- Admin who enabled paid tier
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, service)
);

CREATE INDEX IF NOT EXISTS idx_free_tier_settings_tenant ON aws_free_tier_settings(tenant_id);

-- Initialize default free tier settings for common services
-- This trigger creates default rows when a tenant is first configured
CREATE OR REPLACE FUNCTION init_free_tier_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO aws_free_tier_settings (tenant_id, service, free_tier_enabled, paid_tier_enabled)
    VALUES 
        (NEW.tenant_id, 'lambda', true, false),
        (NEW.tenant_id, 'aurora', true, false),
        (NEW.tenant_id, 'xray', true, false),
        (NEW.tenant_id, 'cloudwatch', true, false),
        (NEW.tenant_id, 'cost_explorer', true, false),
        (NEW.tenant_id, 'api_gateway', true, false),
        (NEW.tenant_id, 'sqs', true, false),
        (NEW.tenant_id, 's3', true, false),
        (NEW.tenant_id, 'dynamodb', true, false),
        (NEW.tenant_id, 'sns', true, false),
        (NEW.tenant_id, 'ses', true, false)
    ON CONFLICT (tenant_id, service) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_init_free_tier_settings ON aws_monitoring_config;
CREATE TRIGGER trigger_init_free_tier_settings
    AFTER INSERT ON aws_monitoring_config
    FOR EACH ROW
    EXECUTE FUNCTION init_free_tier_settings();

-- ============================================================================
-- CHARGEABLE TIER TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS aws_chargeable_tier_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service VARCHAR(30) NOT NULL,
    is_chargeable BOOLEAN NOT NULL DEFAULT false,
    became_chargeable_at TIMESTAMPTZ,
    reason TEXT,
    current_usage DECIMAL(12,4),
    free_tier_limit DECIMAL(12,4),
    usage_percent DECIMAL(5,2),
    estimated_monthly_cost DECIMAL(12,4),
    recommendation TEXT,
    admin_acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by VARCHAR(255),
    last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, service)
);

-- ============================================================================
-- RLS FOR NEW TABLES
-- ============================================================================

ALTER TABLE aws_monitoring_notification_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE aws_monitoring_spend_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE aws_monitoring_metric_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE aws_monitoring_notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE aws_free_tier_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE aws_chargeable_tier_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_targets_tenant_isolation ON aws_monitoring_notification_targets
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY spend_thresholds_tenant_isolation ON aws_monitoring_spend_thresholds
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY metric_thresholds_tenant_isolation ON aws_monitoring_metric_thresholds
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY notification_log_tenant_isolation ON aws_monitoring_notification_log
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY chargeable_tier_status_tenant_isolation ON aws_chargeable_tier_status
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY free_tier_settings_tenant_isolation ON aws_free_tier_settings
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- COMMENTS FOR NEW TABLES
-- ============================================================================

COMMENT ON TABLE aws_monitoring_notification_targets IS 'Admin-settable phone numbers and email addresses for alerts';
COMMENT ON TABLE aws_monitoring_spend_thresholds IS 'Spend thresholds per hour/day/week/month with warning levels';
COMMENT ON TABLE aws_monitoring_metric_thresholds IS 'Metric-based alert thresholds (error rates, latency, etc.)';
COMMENT ON TABLE aws_monitoring_notification_log IS 'Audit log of all sent notifications';
COMMENT ON TABLE aws_chargeable_tier_status IS 'Track when usage exceeds free tier and becomes chargeable';
COMMENT ON TABLE aws_free_tier_settings IS 'Per-service free/paid tier toggle settings with admin controls';

-- ============================================================================
-- CONFIGURABLE FREE TIER LIMITS (per-tenant overrides for AWS free tier)
-- ============================================================================

CREATE TABLE IF NOT EXISTS aws_free_tier_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service VARCHAR(30) NOT NULL CHECK (service IN (
        'lambda', 'aurora', 'xray', 'cloudwatch', 'cost_explorer',
        'api_gateway', 'sqs', 's3', 'dynamodb', 'sns', 'ses'
    )),
    limit_name VARCHAR(50) NOT NULL,  -- e.g., 'invocations', 'compute_gb_seconds', 'storage_gb'
    limit_value DECIMAL(18,4) NOT NULL,
    unit VARCHAR(30) NOT NULL,  -- e.g., 'requests', 'gb_seconds', 'gb', 'acu_hours'
    description TEXT,
    is_custom BOOLEAN NOT NULL DEFAULT false,  -- true if overridden from AWS defaults
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, service, limit_name)
);

CREATE INDEX IF NOT EXISTS idx_free_tier_limits_tenant ON aws_free_tier_limits(tenant_id);

-- Initialize default AWS free tier limits (these are the official AWS values as of 2024)
-- Tenants can override these with custom values
INSERT INTO aws_free_tier_limits (tenant_id, service, limit_name, limit_value, unit, description, is_custom)
SELECT t.id, limits.service, limits.limit_name, limits.limit_value, limits.unit, limits.description, false
FROM tenants t
CROSS JOIN (VALUES
    ('lambda', 'invocations', 1000000, 'requests', 'Monthly Lambda invocations'),
    ('lambda', 'compute_gb_seconds', 400000, 'gb_seconds', 'Monthly compute time (GB-seconds)'),
    ('aurora', 'acu_hours', 750, 'acu_hours', 'Monthly Aurora ACU hours'),
    ('aurora', 'storage_gb', 10, 'gb', 'Aurora storage'),
    ('xray', 'traces', 100000, 'traces', 'Monthly X-Ray traces'),
    ('cloudwatch', 'metrics', 10, 'metrics', 'Custom CloudWatch metrics'),
    ('cloudwatch', 'dashboards', 3, 'dashboards', 'CloudWatch dashboards'),
    ('cloudwatch', 'alarms', 10, 'alarms', 'CloudWatch alarms'),
    ('cloudwatch', 'api_requests', 1000000, 'requests', 'CloudWatch API requests'),
    ('cost_explorer', 'api_requests', 1000, 'requests', 'Cost Explorer API requests'),
    ('api_gateway', 'requests', 1000000, 'requests', 'Monthly REST API calls'),
    ('sqs', 'requests', 1000000, 'requests', 'Monthly SQS requests'),
    ('s3', 'storage_gb', 5, 'gb', 'S3 standard storage'),
    ('s3', 'get_requests', 20000, 'requests', 'S3 GET requests'),
    ('s3', 'put_requests', 2000, 'requests', 'S3 PUT requests'),
    ('dynamodb', 'storage_gb', 25, 'gb', 'DynamoDB storage'),
    ('dynamodb', 'read_capacity_units', 25, 'rcu', 'DynamoDB read capacity'),
    ('dynamodb', 'write_capacity_units', 25, 'wcu', 'DynamoDB write capacity'),
    ('sns', 'publishes', 1000000, 'publishes', 'SNS publishes'),
    ('sns', 'http_deliveries', 100000, 'deliveries', 'SNS HTTP/S deliveries'),
    ('ses', 'outbound_emails', 62000, 'emails', 'SES outbound emails (from EC2)')
) AS limits(service, limit_name, limit_value, unit, description)
ON CONFLICT (tenant_id, service, limit_name) DO NOTHING;

ALTER TABLE aws_free_tier_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY free_tier_limits_tenant_isolation ON aws_free_tier_limits
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

COMMENT ON TABLE aws_free_tier_limits IS 'Configurable AWS free tier limits with per-tenant override support';
