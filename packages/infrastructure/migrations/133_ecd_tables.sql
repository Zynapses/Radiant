-- =============================================================================
-- RADIANT v6.0.4-S1 - ECD Tables
-- Entity-Context Divergence for hallucination prevention
-- Project TRUTH - Trustworthy Reasoning Using Thorough Hallucination-prevention
-- =============================================================================

-- ECD Metrics Log (for monitoring and improvement)
CREATE TABLE IF NOT EXISTS ecd_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    request_id UUID,
    ecd_score FLOAT NOT NULL,
    divergent_entities JSONB DEFAULT '[]'::jsonb,
    grounded_entities_count INTEGER DEFAULT 0,
    refinement_attempts INTEGER DEFAULT 1,
    passed BOOLEAN DEFAULT true,
    blocked BOOLEAN DEFAULT false,
    domain VARCHAR(50),
    threshold_used FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecd_metrics_score ON ecd_metrics(ecd_score);
CREATE INDEX IF NOT EXISTS idx_ecd_metrics_tenant ON ecd_metrics(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ecd_metrics_passed ON ecd_metrics(passed);
CREATE INDEX IF NOT EXISTS idx_ecd_metrics_blocked ON ecd_metrics(blocked) WHERE blocked = true;
CREATE INDEX IF NOT EXISTS idx_ecd_metrics_domain ON ecd_metrics(domain);
CREATE INDEX IF NOT EXISTS idx_ecd_metrics_created ON ecd_metrics(created_at);

-- ECD Audit Log (detailed records for compliance)
CREATE TABLE IF NOT EXISTS ecd_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metrics_id UUID REFERENCES ecd_metrics(id) ON DELETE CASCADE,
    original_response TEXT NOT NULL,
    final_response TEXT NOT NULL,
    all_divergent_entities JSONB NOT NULL,
    all_hallucinations JSONB NOT NULL,
    refinement_history JSONB DEFAULT '[]'::jsonb,
    anchoring_result JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecd_audit_metrics ON ecd_audit_log(metrics_id);
CREATE INDEX IF NOT EXISTS idx_ecd_audit_created ON ecd_audit_log(created_at);

-- ECD Entity Type Stats (aggregated stats by entity type)
CREATE TABLE IF NOT EXISTS ecd_entity_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_count INTEGER DEFAULT 0,
    grounded_count INTEGER DEFAULT 0,
    divergent_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, entity_type, date)
);

CREATE INDEX IF NOT EXISTS idx_ecd_entity_stats_tenant ON ecd_entity_stats(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_ecd_entity_stats_type ON ecd_entity_stats(entity_type);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE ecd_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecd_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecd_entity_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_ecd_metrics ON ecd_metrics
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_ecd_audit ON ecd_audit_log
    FOR ALL USING (
        metrics_id IN (
            SELECT id FROM ecd_metrics 
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
        )
    );

CREATE POLICY tenant_isolation_ecd_entity_stats ON ecd_entity_stats
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- =============================================================================
-- ECD Configuration Parameters
-- =============================================================================

INSERT INTO system_config (key, value, category, name, description, type, dangerous, default_value, constraints_json) VALUES
-- Core ECD settings
('ECD_ENABLED', 'true', 'reasoning', 'ECD Enabled', 'Enable Entity-Context Divergence verification loop', 'boolean', false, 'true', NULL),
('ECD_THRESHOLD', '0.1', 'reasoning', 'ECD Threshold', 'Maximum acceptable divergence score (0-1). Lower = stricter.', 'number', false, '0.1', '{"min": 0.01, "max": 0.5, "step": 0.01}'),
('ECD_MAX_REFINEMENTS', '2', 'reasoning', 'Max Refinements', 'Maximum refinement attempts before giving up', 'number', false, '2', '{"min": 1, "max": 5, "step": 1}'),
('ECD_BLOCK_ON_FAILURE', 'false', 'reasoning', 'Block on Failure', 'Block responses that fail ECD verification after max refinements', 'boolean', true, 'false', NULL),

-- Domain-specific thresholds
('ECD_HEALTHCARE_THRESHOLD', '0.05', 'reasoning', 'Healthcare Threshold', 'Stricter ECD threshold for healthcare domain', 'number', false, '0.05', '{"min": 0.01, "max": 0.2, "step": 0.01}'),
('ECD_FINANCIAL_THRESHOLD', '0.05', 'reasoning', 'Financial Threshold', 'Stricter ECD threshold for financial domain', 'number', false, '0.05', '{"min": 0.01, "max": 0.2, "step": 0.01}'),
('ECD_LEGAL_THRESHOLD', '0.05', 'reasoning', 'Legal Threshold', 'Stricter ECD threshold for legal domain', 'number', false, '0.05', '{"min": 0.01, "max": 0.2, "step": 0.01}'),

-- Anchoring settings
('ECD_ANCHORING_ENABLED', 'true', 'reasoning', 'Anchoring Enabled', 'Enable critical fact anchoring for high-risk domains', 'boolean', false, 'true', NULL),
('ECD_ANCHORING_OVERSIGHT', 'true', 'reasoning', 'Anchoring Oversight', 'Send unanchored critical facts to human oversight queue', 'boolean', false, 'true', NULL)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Aggregated Metrics View
-- =============================================================================

CREATE OR REPLACE VIEW ecd_daily_metrics AS
SELECT 
    tenant_id,
    DATE(created_at) as date,
    COUNT(*) as total_requests,
    AVG(ecd_score) as avg_score,
    COUNT(*) FILTER (WHERE refinement_attempts = 1 AND passed) as first_pass_success,
    COUNT(*) FILTER (WHERE refinement_attempts > 1) as refinements_needed,
    COUNT(*) FILTER (WHERE blocked) as blocked_count,
    COUNT(*) FILTER (WHERE NOT passed AND NOT blocked) as failed_not_blocked,
    SUM(refinement_attempts) - COUNT(*) as total_refinements
FROM ecd_metrics
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY tenant_id, DATE(created_at);

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to get ECD stats for admin dashboard
CREATE OR REPLACE FUNCTION get_ecd_stats(p_tenant_id UUID, p_days INTEGER DEFAULT 7)
RETURNS TABLE (
    avg_score FLOAT,
    first_pass_rate FLOAT,
    refinements_today INTEGER,
    blocked_today INTEGER,
    total_requests INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(AVG(ecd_score), 0)::FLOAT as avg_score,
        COALESCE(
            (COUNT(*) FILTER (WHERE refinement_attempts = 1 AND passed)::FLOAT / NULLIF(COUNT(*), 0)) * 100,
            100
        )::FLOAT as first_pass_rate,
        COALESCE(SUM(refinement_attempts - 1) FILTER (WHERE created_at::DATE = CURRENT_DATE), 0)::INTEGER as refinements_today,
        COALESCE(COUNT(*) FILTER (WHERE blocked AND created_at::DATE = CURRENT_DATE), 0)::INTEGER as blocked_today,
        COUNT(*)::INTEGER as total_requests
    FROM ecd_metrics
    WHERE tenant_id = p_tenant_id
      AND created_at > NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to log ECD metrics
CREATE OR REPLACE FUNCTION log_ecd_metrics(
    p_user_id UUID,
    p_tenant_id UUID,
    p_request_id UUID,
    p_ecd_score FLOAT,
    p_divergent_entities JSONB,
    p_grounded_count INTEGER,
    p_refinement_attempts INTEGER,
    p_passed BOOLEAN,
    p_blocked BOOLEAN,
    p_domain VARCHAR,
    p_threshold FLOAT
)
RETURNS UUID AS $$
DECLARE
    v_metrics_id UUID;
BEGIN
    INSERT INTO ecd_metrics (
        user_id, tenant_id, request_id, ecd_score, divergent_entities,
        grounded_entities_count, refinement_attempts, passed, blocked, domain, threshold_used
    ) VALUES (
        p_user_id, p_tenant_id, p_request_id, p_ecd_score, p_divergent_entities,
        p_grounded_count, p_refinement_attempts, p_passed, p_blocked, p_domain, p_threshold
    )
    RETURNING id INTO v_metrics_id;
    
    RETURN v_metrics_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update entity type stats
CREATE OR REPLACE FUNCTION update_ecd_entity_stats(
    p_tenant_id UUID,
    p_entity_type VARCHAR,
    p_grounded INTEGER,
    p_divergent INTEGER
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO ecd_entity_stats (tenant_id, entity_type, total_count, grounded_count, divergent_count)
    VALUES (p_tenant_id, p_entity_type, p_grounded + p_divergent, p_grounded, p_divergent)
    ON CONFLICT (tenant_id, entity_type, date) DO UPDATE SET
        total_count = ecd_entity_stats.total_count + EXCLUDED.total_count,
        grounded_count = ecd_entity_stats.grounded_count + EXCLUDED.grounded_count,
        divergent_count = ecd_entity_stats.divergent_count + EXCLUDED.divergent_count,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get entity type breakdown
CREATE OR REPLACE FUNCTION get_ecd_entity_breakdown(p_tenant_id UUID, p_days INTEGER DEFAULT 7)
RETURNS TABLE (
    entity_type VARCHAR,
    total_count BIGINT,
    grounded_count BIGINT,
    divergent_count BIGINT,
    divergence_rate FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.entity_type,
        SUM(e.total_count)::BIGINT as total_count,
        SUM(e.grounded_count)::BIGINT as grounded_count,
        SUM(e.divergent_count)::BIGINT as divergent_count,
        CASE 
            WHEN SUM(e.total_count) > 0 
            THEN (SUM(e.divergent_count)::FLOAT / SUM(e.total_count)::FLOAT) * 100
            ELSE 0
        END as divergence_rate
    FROM ecd_entity_stats e
    WHERE e.tenant_id = p_tenant_id
      AND e.date > CURRENT_DATE - p_days
    GROUP BY e.entity_type
    ORDER BY divergence_rate DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get ECD trend data
CREATE OR REPLACE FUNCTION get_ecd_trend(p_tenant_id UUID, p_days INTEGER DEFAULT 7)
RETURNS TABLE (
    date DATE,
    avg_score FLOAT,
    pass_rate FLOAT,
    total_requests BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(m.created_at) as date,
        AVG(m.ecd_score)::FLOAT as avg_score,
        (COUNT(*) FILTER (WHERE m.passed)::FLOAT / NULLIF(COUNT(*), 0) * 100)::FLOAT as pass_rate,
        COUNT(*)::BIGINT as total_requests
    FROM ecd_metrics m
    WHERE m.tenant_id = p_tenant_id
      AND m.created_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY DATE(m.created_at)
    ORDER BY date;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE ecd_metrics IS 'ECD verification metrics for hallucination detection';
COMMENT ON TABLE ecd_audit_log IS 'Detailed audit trail for ECD verification (compliance)';
COMMENT ON TABLE ecd_entity_stats IS 'Aggregated entity type statistics for ECD monitoring';
COMMENT ON FUNCTION get_ecd_stats IS 'Get ECD statistics for admin dashboard';
COMMENT ON FUNCTION log_ecd_metrics IS 'Log ECD verification result';
COMMENT ON FUNCTION get_ecd_entity_breakdown IS 'Get divergence rates by entity type';
COMMENT ON FUNCTION get_ecd_trend IS 'Get ECD score trend over time';
