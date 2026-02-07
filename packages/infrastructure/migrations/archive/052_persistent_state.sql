-- Migration: 052_persistent_state.sql
-- RADIANT v4.18.0 - Persistent State for AWS Lambda Cold Starts
-- Ensures critical runtime state survives Lambda restarts

-- ============================================================================
-- PROVIDER HEALTH - Track AI provider health across restarts
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_health (
    provider VARCHAR(50) PRIMARY KEY,
    is_healthy BOOLEAN DEFAULT true,
    latency_ms INTEGER DEFAULT 0,
    last_checked TIMESTAMPTZ DEFAULT NOW(),
    error_count INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,
    last_success TIMESTAMPTZ,
    last_failure TIMESTAMPTZ,
    failure_reason TEXT,
    
    -- Rolling averages for better routing decisions
    avg_latency_ms DECIMAL(10,2) DEFAULT 0,
    success_rate DECIMAL(5,4) DEFAULT 1.0,
    samples_count INTEGER DEFAULT 0,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize default providers
INSERT INTO provider_health (provider, is_healthy, latency_ms, success_rate) VALUES
    ('bedrock', true, 500, 1.0),
    ('litellm', true, 600, 1.0),
    ('openai', true, 700, 1.0),
    ('groq', true, 300, 1.0),
    ('perplexity', true, 800, 1.0),
    ('xai', true, 900, 1.0),
    ('together', true, 600, 1.0)
ON CONFLICT (provider) DO NOTHING;

-- ============================================================================
-- MODEL PERFORMANCE - Track per-model performance for routing optimization
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_performance (
    model_id VARCHAR(200) PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    
    -- Performance metrics
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    
    -- Latency tracking
    avg_latency_ms DECIMAL(10,2) DEFAULT 0,
    min_latency_ms INTEGER,
    max_latency_ms INTEGER,
    p50_latency_ms INTEGER,
    p95_latency_ms INTEGER,
    p99_latency_ms INTEGER,
    
    -- Token tracking
    total_input_tokens BIGINT DEFAULT 0,
    total_output_tokens BIGINT DEFAULT 0,
    avg_tokens_per_request DECIMAL(10,2) DEFAULT 0,
    
    -- Cost tracking
    total_cost_cents BIGINT DEFAULT 0,
    avg_cost_per_request_cents DECIMAL(10,4) DEFAULT 0,
    
    -- Quality metrics (from user feedback/metacognition)
    quality_score DECIMAL(5,4),
    quality_samples INTEGER DEFAULT 0,
    
    -- Availability
    is_available BOOLEAN DEFAULT true,
    last_available_check TIMESTAMPTZ,
    downtime_count INTEGER DEFAULT 0,
    
    first_used TIMESTAMPTZ DEFAULT NOW(),
    last_used TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_model_performance_provider ON model_performance(provider);
CREATE INDEX idx_model_performance_available ON model_performance(is_available);

-- ============================================================================
-- CACHE STATE - Persist critical cache entries
-- ============================================================================

CREATE TABLE IF NOT EXISTS persistent_cache (
    cache_key VARCHAR(500) PRIMARY KEY,
    cache_type VARCHAR(50) NOT NULL, -- 'config', 'localization', 'brain_region', 'entity', 'agent'
    tenant_id UUID,
    
    cache_value JSONB NOT NULL,
    value_hash VARCHAR(64), -- For detecting stale entries
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_persistent_cache_type ON persistent_cache(cache_type);
CREATE INDEX idx_persistent_cache_tenant ON persistent_cache(tenant_id);
CREATE INDEX idx_persistent_cache_expires ON persistent_cache(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- LAMBDA STATE - Track Lambda instance state for continuity
-- ============================================================================

CREATE TABLE IF NOT EXISTS lambda_state (
    instance_id VARCHAR(100) PRIMARY KEY,
    function_name VARCHAR(200) NOT NULL,
    
    -- State
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    requests_handled INTEGER DEFAULT 0,
    
    -- Memory state snapshot (for debugging)
    cache_size_bytes INTEGER DEFAULT 0,
    memory_used_mb INTEGER,
    
    -- Environment
    aws_region VARCHAR(50),
    runtime_version VARCHAR(50),
    
    is_warm BOOLEAN DEFAULT true,
    cold_starts INTEGER DEFAULT 0
);

CREATE INDEX idx_lambda_state_function ON lambda_state(function_name);
CREATE INDEX idx_lambda_state_heartbeat ON lambda_state(last_heartbeat);

-- ============================================================================
-- ROUTING DECISIONS - Audit trail for model routing
-- ============================================================================

CREATE TABLE IF NOT EXISTS routing_decisions (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    
    -- Request info
    requested_model VARCHAR(200) NOT NULL,
    requested_capability VARCHAR(100),
    
    -- Routing result
    selected_model VARCHAR(200) NOT NULL,
    selected_provider VARCHAR(50) NOT NULL,
    fallback_used BOOLEAN DEFAULT false,
    fallbacks_tried TEXT[] DEFAULT '{}',
    
    -- Why this decision
    decision_reason TEXT, -- 'primary_healthy', 'fallback_latency', etc.
    
    -- Outcome
    success BOOLEAN,
    latency_ms INTEGER,
    cost_cents DECIMAL(10,4),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_routing_decisions_tenant ON routing_decisions(tenant_id);
CREATE INDEX idx_routing_decisions_model ON routing_decisions(requested_model);
CREATE INDEX idx_routing_decisions_time ON routing_decisions(created_at DESC);

-- Partition by month for large-scale deployments
-- (keeping recent data fast, archiving old decisions)

-- ============================================================================
-- FUNCTIONS - Update health and performance atomically
-- ============================================================================

-- Update provider health on success
CREATE OR REPLACE FUNCTION record_provider_success(
    p_provider VARCHAR(50),
    p_latency_ms INTEGER
)
RETURNS void AS $$
BEGIN
    INSERT INTO provider_health (provider, is_healthy, latency_ms, last_checked, last_success, avg_latency_ms, samples_count, success_rate)
    VALUES (p_provider, true, p_latency_ms, NOW(), NOW(), p_latency_ms, 1, 1.0)
    ON CONFLICT (provider) DO UPDATE SET
        is_healthy = true,
        latency_ms = p_latency_ms,
        last_checked = NOW(),
        last_success = NOW(),
        consecutive_failures = 0,
        -- Rolling average (weighted toward recent)
        avg_latency_ms = (provider_health.avg_latency_ms * 0.9 + p_latency_ms * 0.1),
        samples_count = provider_health.samples_count + 1,
        success_rate = (provider_health.success_rate * provider_health.samples_count + 1) / (provider_health.samples_count + 1),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Update provider health on failure
CREATE OR REPLACE FUNCTION record_provider_failure(
    p_provider VARCHAR(50),
    p_reason TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_failures INTEGER;
BEGIN
    INSERT INTO provider_health (provider, is_healthy, last_checked, last_failure, failure_reason, error_count, consecutive_failures, success_rate)
    VALUES (p_provider, true, NOW(), NOW(), p_reason, 1, 1, 0.0)
    ON CONFLICT (provider) DO UPDATE SET
        error_count = provider_health.error_count + 1,
        consecutive_failures = provider_health.consecutive_failures + 1,
        last_checked = NOW(),
        last_failure = NOW(),
        failure_reason = COALESCE(p_reason, provider_health.failure_reason),
        -- Mark unhealthy after 3 consecutive failures
        is_healthy = CASE WHEN provider_health.consecutive_failures >= 2 THEN false ELSE provider_health.is_healthy END,
        samples_count = provider_health.samples_count + 1,
        success_rate = (provider_health.success_rate * provider_health.samples_count) / (provider_health.samples_count + 1),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Update model performance
CREATE OR REPLACE FUNCTION record_model_usage(
    p_model_id VARCHAR(200),
    p_provider VARCHAR(50),
    p_success BOOLEAN,
    p_latency_ms INTEGER,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER,
    p_cost_cents DECIMAL
)
RETURNS void AS $$
BEGIN
    INSERT INTO model_performance (
        model_id, provider, total_requests, successful_requests, failed_requests,
        avg_latency_ms, min_latency_ms, max_latency_ms,
        total_input_tokens, total_output_tokens, total_cost_cents, last_used
    ) VALUES (
        p_model_id, p_provider, 1, 
        CASE WHEN p_success THEN 1 ELSE 0 END,
        CASE WHEN p_success THEN 0 ELSE 1 END,
        p_latency_ms, p_latency_ms, p_latency_ms,
        p_input_tokens, p_output_tokens, p_cost_cents, NOW()
    )
    ON CONFLICT (model_id) DO UPDATE SET
        total_requests = model_performance.total_requests + 1,
        successful_requests = model_performance.successful_requests + CASE WHEN p_success THEN 1 ELSE 0 END,
        failed_requests = model_performance.failed_requests + CASE WHEN p_success THEN 0 ELSE 1 END,
        avg_latency_ms = (model_performance.avg_latency_ms * model_performance.total_requests + p_latency_ms) / (model_performance.total_requests + 1),
        min_latency_ms = LEAST(COALESCE(model_performance.min_latency_ms, p_latency_ms), p_latency_ms),
        max_latency_ms = GREATEST(COALESCE(model_performance.max_latency_ms, p_latency_ms), p_latency_ms),
        total_input_tokens = model_performance.total_input_tokens + p_input_tokens,
        total_output_tokens = model_performance.total_output_tokens + p_output_tokens,
        total_cost_cents = model_performance.total_cost_cents + p_cost_cents,
        avg_cost_per_request_cents = (model_performance.total_cost_cents + p_cost_cents) / (model_performance.total_requests + 1),
        avg_tokens_per_request = (model_performance.total_input_tokens + model_performance.total_output_tokens + p_input_tokens + p_output_tokens) / (model_performance.total_requests + 1),
        last_used = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Get healthy providers for fallback
CREATE OR REPLACE FUNCTION get_healthy_providers()
RETURNS TABLE(provider VARCHAR, latency_ms INTEGER, success_rate DECIMAL) AS $$
BEGIN
    RETURN QUERY
    SELECT ph.provider, ph.latency_ms::INTEGER, ph.success_rate
    FROM provider_health ph
    WHERE ph.is_healthy = true
      AND ph.consecutive_failures < 3
    ORDER BY ph.consecutive_failures ASC, ph.avg_latency_ms ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS - Auto-update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_persistent_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER provider_health_updated
    BEFORE UPDATE ON provider_health
    FOR EACH ROW EXECUTE FUNCTION update_persistent_state_timestamp();

CREATE TRIGGER model_performance_updated
    BEFORE UPDATE ON model_performance
    FOR EACH ROW EXECUTE FUNCTION update_persistent_state_timestamp();

CREATE TRIGGER persistent_cache_updated
    BEFORE UPDATE ON persistent_cache
    FOR EACH ROW EXECUTE FUNCTION update_persistent_state_timestamp();

-- ============================================================================
-- CLEANUP - Remove stale data periodically
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_persistent_state()
RETURNS void AS $$
BEGIN
    -- Remove expired cache entries
    DELETE FROM persistent_cache WHERE expires_at < NOW();
    
    -- Remove old routing decisions (keep 30 days)
    DELETE FROM routing_decisions WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Remove stale lambda instances (no heartbeat in 1 hour)
    DELETE FROM lambda_state WHERE last_heartbeat < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE provider_health IS 'Persists AI provider health state across Lambda cold starts';
COMMENT ON TABLE model_performance IS 'Tracks per-model performance metrics for routing optimization';
COMMENT ON TABLE persistent_cache IS 'Stores critical cache entries that should survive restarts';
COMMENT ON TABLE lambda_state IS 'Tracks Lambda instance state for debugging and continuity';
COMMENT ON TABLE routing_decisions IS 'Audit trail of model routing decisions for analysis';
