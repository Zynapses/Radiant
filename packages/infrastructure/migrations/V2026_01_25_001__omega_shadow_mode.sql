-- RADIANT v4.18.0 - OMEGA Shadow Mode Tables
-- Migration for parallel OMEGA brain inference alongside standard orchestration

-- ============================================================================
-- OMEGA Shadow Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS omega_shadow_config (
    tenant_id VARCHAR(255) PRIMARY KEY,
    config JSONB NOT NULL DEFAULT '{
        "enabled": false,
        "shadowPercentage": 10,
        "captureResponses": true,
        "compareResponses": true
    }',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE omega_shadow_config IS 'Configuration for OMEGA shadow mode per tenant';
COMMENT ON COLUMN omega_shadow_config.config IS 'JSON config: enabled, shadowPercentage, captureResponses, compareResponses, tenantAllowlist, tenantDenylist';

-- Insert global default config
INSERT INTO omega_shadow_config (tenant_id, config) VALUES (
    'global',
    '{
        "enabled": false,
        "omegaApiUrl": "",
        "shadowPercentage": 10,
        "captureResponses": true,
        "compareResponses": true
    }'
) ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- OMEGA Shadow Comparisons
-- ============================================================================

CREATE TABLE IF NOT EXISTS omega_shadow_comparisons (
    comparison_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    prompt_hash VARCHAR(64) NOT NULL,
    standard_response TEXT,
    omega_response TEXT,
    standard_latency_ms INTEGER,
    omega_latency_ms INTEGER,
    similarity_score DECIMAL(5,4) DEFAULT 0,
    omega_coherence DECIMAL(5,4) DEFAULT 0,
    omega_entropy DECIMAL(5,4) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_omega_shadow_comparisons_tenant 
    ON omega_shadow_comparisons(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_omega_shadow_comparisons_prompt 
    ON omega_shadow_comparisons(tenant_id, prompt_hash);

CREATE INDEX IF NOT EXISTS idx_omega_shadow_comparisons_date 
    ON omega_shadow_comparisons(created_at);

COMMENT ON TABLE omega_shadow_comparisons IS 'Shadow mode comparison results between standard and OMEGA responses';
COMMENT ON COLUMN omega_shadow_comparisons.prompt_hash IS 'Hash of prompt for deduplication analysis';
COMMENT ON COLUMN omega_shadow_comparisons.similarity_score IS 'Jaccard similarity between standard and OMEGA responses';
COMMENT ON COLUMN omega_shadow_comparisons.omega_coherence IS 'OMEGA brain coherence score at time of response';
COMMENT ON COLUMN omega_shadow_comparisons.omega_entropy IS 'OMEGA brain entropy level at time of response';

-- ============================================================================
-- OMEGA Shadow Failures
-- ============================================================================

CREATE TABLE IF NOT EXISTS omega_shadow_failures (
    failure_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    error_type VARCHAR(50) NOT NULL,
    error_detail TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_omega_shadow_failures_tenant 
    ON omega_shadow_failures(tenant_id, created_at DESC);

COMMENT ON TABLE omega_shadow_failures IS 'Tracking of OMEGA shadow mode failures for monitoring';

-- ============================================================================
-- OMEGA Brain State Cache (for warm start optimization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS omega_brain_cache (
    tenant_id VARCHAR(255) PRIMARY KEY,
    thermal_status VARCHAR(20) DEFAULT 'frozen',
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    coherence_score DECIMAL(5,4) DEFAULT 0.5,
    entropy_level DECIMAL(5,4) DEFAULT 0.2,
    cycle_count INTEGER DEFAULT 0,
    firmware_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE omega_brain_cache IS 'Cached OMEGA brain state for quick lookups without EFS access';

-- ============================================================================
-- Shadow Mode Analytics View
-- ============================================================================

CREATE OR REPLACE VIEW omega_shadow_analytics AS
SELECT 
    tenant_id,
    DATE_TRUNC('day', created_at) as day,
    COUNT(*) as total_comparisons,
    AVG(similarity_score) as avg_similarity,
    AVG(omega_coherence) as avg_coherence,
    AVG(omega_entropy) as avg_entropy,
    AVG(omega_latency_ms) as avg_omega_latency,
    AVG(standard_latency_ms) as avg_standard_latency,
    AVG(omega_latency_ms - standard_latency_ms) as avg_latency_diff,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY similarity_score) as median_similarity,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY omega_latency_ms) as p95_omega_latency
FROM omega_shadow_comparisons
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY tenant_id, DATE_TRUNC('day', created_at)
ORDER BY tenant_id, day DESC;

COMMENT ON VIEW omega_shadow_analytics IS 'Daily analytics for OMEGA shadow mode performance';

-- ============================================================================
-- Functions
-- ============================================================================

-- Get shadow mode stats for a tenant
CREATE OR REPLACE FUNCTION get_omega_shadow_stats(
    p_tenant_id VARCHAR(255),
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    total_requests BIGINT,
    successful_responses BIGINT,
    failed_responses BIGINT,
    avg_latency_ms NUMERIC,
    avg_similarity NUMERIC,
    avg_coherence NUMERIC,
    latency_improvement_pct NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH comparisons AS (
        SELECT * FROM omega_shadow_comparisons
        WHERE tenant_id = p_tenant_id
        AND created_at > NOW() - (p_days || ' days')::INTERVAL
    ),
    failures AS (
        SELECT COUNT(*) as count FROM omega_shadow_failures
        WHERE tenant_id = p_tenant_id
        AND created_at > NOW() - (p_days || ' days')::INTERVAL
    )
    SELECT 
        (SELECT COUNT(*) FROM comparisons) + (SELECT count FROM failures) as total_requests,
        (SELECT COUNT(*) FROM comparisons WHERE omega_response IS NOT NULL) as successful_responses,
        (SELECT count FROM failures) as failed_responses,
        (SELECT AVG(omega_latency_ms) FROM comparisons) as avg_latency_ms,
        (SELECT AVG(similarity_score) FROM comparisons) as avg_similarity,
        (SELECT AVG(omega_coherence) FROM comparisons) as avg_coherence,
        (SELECT 
            CASE 
                WHEN AVG(standard_latency_ms) > 0 
                THEN ((AVG(standard_latency_ms) - AVG(omega_latency_ms)) / AVG(standard_latency_ms)) * 100
                ELSE 0 
            END 
         FROM comparisons) as latency_improvement_pct;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old shadow data
CREATE OR REPLACE FUNCTION cleanup_omega_shadow_data(p_retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM omega_shadow_comparisons
        WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL
        RETURNING 1
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;

    DELETE FROM omega_shadow_failures
    WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE omega_shadow_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE omega_shadow_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE omega_shadow_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE omega_brain_cache ENABLE ROW LEVEL SECURITY;

-- Config policies
CREATE POLICY omega_shadow_config_tenant_isolation ON omega_shadow_config
    FOR ALL
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)
        OR tenant_id = 'global'
        OR current_setting('app.is_admin', true) = 'true'
    );

-- Comparisons policies
CREATE POLICY omega_shadow_comparisons_tenant_isolation ON omega_shadow_comparisons
    FOR ALL
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)
        OR current_setting('app.is_admin', true) = 'true'
    );

-- Failures policies
CREATE POLICY omega_shadow_failures_tenant_isolation ON omega_shadow_failures
    FOR ALL
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)
        OR current_setting('app.is_admin', true) = 'true'
    );

-- Brain cache policies
CREATE POLICY omega_brain_cache_tenant_isolation ON omega_brain_cache
    FOR ALL
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)
        OR current_setting('app.is_admin', true) = 'true'
    );

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON omega_shadow_config TO radiant_app;
GRANT SELECT, INSERT, DELETE ON omega_shadow_comparisons TO radiant_app;
GRANT SELECT, INSERT ON omega_shadow_failures TO radiant_app;
GRANT SELECT, INSERT, UPDATE ON omega_brain_cache TO radiant_app;
GRANT SELECT ON omega_shadow_analytics TO radiant_app;
GRANT EXECUTE ON FUNCTION get_omega_shadow_stats TO radiant_app;
GRANT EXECUTE ON FUNCTION cleanup_omega_shadow_data TO radiant_app;
