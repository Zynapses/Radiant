-- =============================================================================
-- LIVS - LLM Integrity Verification System
-- Migration: V2026_02_01_013__livs_integrity_system.sql
-- Version: 6.3.0
-- 
-- Two-tier defense against AI "lying" behaviors:
-- - Tier 1: Individual LLM Interrogation
-- - Tier 2: Orchestration Integrity Verification
-- =============================================================================

-- -----------------------------------------------------------------------------
-- LIVS Configuration (per-tenant)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS livs_config (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    config JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "individualInterrogation": {
            "enabled": true,
            "defaultDepth": 1,
            "autoEscalate": true,
            "escalationThreshold": 0.6,
            "style": "socratic"
        },
        "orchestrationIntegrity": {
            "enabled": true,
            "preActionInterrogation": true,
            "consistencyChecking": true,
            "evidenceChainValidation": true,
            "maxConfidencePropagation": 0.95
        },
        "costMode": "balanced",
        "maxInterrogationCostMultiplier": 2.0,
        "contributeToGlobalWeights": true,
        "useGlobalWeights": true
    }'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    PRIMARY KEY (tenant_id)
);

COMMENT ON TABLE livs_config IS 'Per-tenant LIVS configuration (System → Tenant → User hierarchy)';

-- -----------------------------------------------------------------------------
-- LIVS Soft Rules
-- Configurable integrity rules that admins can customize
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS livs_soft_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Conditions for when this rule applies
    conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Actions to take when rule matches
    actions JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Priority (higher = evaluated first)
    priority INTEGER NOT NULL DEFAULT 0,
    
    -- Who created this rule
    created_by_type VARCHAR(20) NOT NULL CHECK (created_by_type IN ('system', 'tenant_admin', 'user')),
    created_by UUID REFERENCES users(id),
    
    -- Status
    active BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_livs_soft_rules_tenant ON livs_soft_rules(tenant_id);
CREATE INDEX idx_livs_soft_rules_active ON livs_soft_rules(tenant_id, active) WHERE active = true;
CREATE INDEX idx_livs_soft_rules_priority ON livs_soft_rules(tenant_id, priority DESC);

COMMENT ON TABLE livs_soft_rules IS 'Configurable integrity rules (System → Tenant → User hierarchy)';

-- -----------------------------------------------------------------------------
-- LIVS Interrogations
-- Records of individual LLM interrogation sessions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS livs_interrogations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Original request info
    original_request_id UUID,
    original_model_id VARCHAR(255) NOT NULL,
    original_response TEXT NOT NULL,
    original_confidence DECIMAL(3,2),
    
    -- Interrogation details
    interrogator_model_id VARCHAR(255) NOT NULL,
    interrogation_depth INTEGER NOT NULL CHECK (interrogation_depth BETWEEN 0 AND 4),
    exchanges JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Lie detection results
    lie_detected BOOLEAN NOT NULL DEFAULT false,
    lie_confidence DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    signals JSONB NOT NULL DEFAULT '{}'::jsonb,
    calibrated_confidence DECIMAL(3,2),
    
    -- Verdict
    verdict VARCHAR(20) NOT NULL CHECK (verdict IN ('trusted', 'suspicious', 'likely_lie', 'confirmed_lie')),
    
    -- Cost tracking
    cost_tokens INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    domain VARCHAR(100),
    query_type VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create partitions for interrogations (monthly)
CREATE TABLE livs_interrogations_2026_02 PARTITION OF livs_interrogations
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE livs_interrogations_2026_03 PARTITION OF livs_interrogations
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE livs_interrogations_2026_04 PARTITION OF livs_interrogations
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE livs_interrogations_2026_05 PARTITION OF livs_interrogations
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE livs_interrogations_2026_06 PARTITION OF livs_interrogations
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX idx_livs_interrogations_tenant ON livs_interrogations(tenant_id, created_at DESC);
CREATE INDEX idx_livs_interrogations_model ON livs_interrogations(tenant_id, original_model_id);
CREATE INDEX idx_livs_interrogations_verdict ON livs_interrogations(tenant_id, verdict);
CREATE INDEX idx_livs_interrogations_lie ON livs_interrogations(tenant_id, lie_detected) WHERE lie_detected = true;

COMMENT ON TABLE livs_interrogations IS 'Individual LLM interrogation sessions (Tier 1)';

-- -----------------------------------------------------------------------------
-- LIVS Model Integrity Weights
-- Per-model lie detection statistics for Cato integration
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS livs_model_weights (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL,
    
    -- Aggregate stats
    total_interrogations INTEGER NOT NULL DEFAULT 0,
    lies_detected INTEGER NOT NULL DEFAULT 0,
    lie_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0,
    
    -- Domain-specific lie rates
    domain_lie_rates JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Question type specific lie rates
    question_type_lie_rates JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Calibration score (0-1, higher = better)
    calibration_score DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    
    -- How well model holds up under interrogation
    interrogation_resilience DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    
    -- Sample size for statistical significance
    sample_size INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (tenant_id, model_id)
);

CREATE INDEX idx_livs_model_weights_lie_rate ON livs_model_weights(tenant_id, lie_rate DESC);

COMMENT ON TABLE livs_model_weights IS 'Per-model integrity weights for Cato selection (30% weight factor)';

-- -----------------------------------------------------------------------------
-- LIVS Orchestration Integrity Weights
-- Per-pattern reliability statistics
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS livs_orchestration_weights (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pattern_id VARCHAR(255) NOT NULL,
    
    -- Reliability stats
    total_executions INTEGER NOT NULL DEFAULT 0,
    successful_executions INTEGER NOT NULL DEFAULT 0,
    reliability_score DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    
    -- Failure mode frequency
    failure_mode_history JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Model compatibility scores
    model_compatibility JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Metadata
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (tenant_id, pattern_id)
);

COMMENT ON TABLE livs_orchestration_weights IS 'Orchestration pattern reliability weights';

-- -----------------------------------------------------------------------------
-- LIVS Pipeline Audits
-- Full pipeline integrity audit results
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS livs_pipeline_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pipeline_execution_id UUID NOT NULL,
    
    -- Per-method integrity scores
    method_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Aggregate scores
    consistency_score DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    evidence_chain_score DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    goal_alignment_score DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    overall_integrity_score DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    
    -- Detected failure patterns
    detected_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Issues found
    issues JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Recommendations
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create partitions for audits (monthly)
CREATE TABLE livs_pipeline_audits_2026_02 PARTITION OF livs_pipeline_audits
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE livs_pipeline_audits_2026_03 PARTITION OF livs_pipeline_audits
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE livs_pipeline_audits_2026_04 PARTITION OF livs_pipeline_audits
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE livs_pipeline_audits_2026_05 PARTITION OF livs_pipeline_audits
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE livs_pipeline_audits_2026_06 PARTITION OF livs_pipeline_audits
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX idx_livs_pipeline_audits_tenant ON livs_pipeline_audits(tenant_id, created_at DESC);
CREATE INDEX idx_livs_pipeline_audits_execution ON livs_pipeline_audits(pipeline_execution_id);
CREATE INDEX idx_livs_pipeline_audits_score ON livs_pipeline_audits(tenant_id, overall_integrity_score);

COMMENT ON TABLE livs_pipeline_audits IS 'Pipeline integrity audit results (Tier 2)';

-- -----------------------------------------------------------------------------
-- LIVS Global Weights (cross-tenant aggregation)
-- Used when useGlobalWeights is enabled
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS livs_global_model_weights (
    model_id VARCHAR(255) PRIMARY KEY,
    
    -- Aggregate stats across all tenants
    total_interrogations INTEGER NOT NULL DEFAULT 0,
    lies_detected INTEGER NOT NULL DEFAULT 0,
    lie_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0,
    
    -- Domain-specific global lie rates
    domain_lie_rates JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Question type specific global lie rates
    question_type_lie_rates JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Global calibration score
    calibration_score DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    
    -- Contributing tenant count
    contributing_tenants INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE livs_global_model_weights IS 'Cross-tenant model integrity weights (network effect)';

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE livs_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE livs_soft_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE livs_interrogations ENABLE ROW LEVEL SECURITY;
ALTER TABLE livs_model_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE livs_orchestration_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE livs_pipeline_audits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant isolation
CREATE POLICY livs_config_tenant_isolation ON livs_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY livs_soft_rules_tenant_isolation ON livs_soft_rules
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY livs_interrogations_tenant_isolation ON livs_interrogations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY livs_model_weights_tenant_isolation ON livs_model_weights
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY livs_orchestration_weights_tenant_isolation ON livs_orchestration_weights
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY livs_pipeline_audits_tenant_isolation ON livs_pipeline_audits
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- -----------------------------------------------------------------------------
-- Functions
-- -----------------------------------------------------------------------------

-- Function to update model weights after interrogation
CREATE OR REPLACE FUNCTION update_livs_model_weights()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO livs_model_weights (tenant_id, model_id, total_interrogations, lies_detected, lie_rate, sample_size, last_updated)
    VALUES (
        NEW.tenant_id,
        NEW.original_model_id,
        1,
        CASE WHEN NEW.lie_detected THEN 1 ELSE 0 END,
        CASE WHEN NEW.lie_detected THEN 1.0 ELSE 0.0 END,
        1,
        NOW()
    )
    ON CONFLICT (tenant_id, model_id) DO UPDATE SET
        total_interrogations = livs_model_weights.total_interrogations + 1,
        lies_detected = livs_model_weights.lies_detected + CASE WHEN NEW.lie_detected THEN 1 ELSE 0 END,
        lie_rate = (livs_model_weights.lies_detected + CASE WHEN NEW.lie_detected THEN 1 ELSE 0 END)::decimal / 
                   (livs_model_weights.total_interrogations + 1),
        sample_size = livs_model_weights.sample_size + 1,
        last_updated = NOW();
    
    -- Update domain-specific rates if domain provided
    IF NEW.domain IS NOT NULL THEN
        UPDATE livs_model_weights
        SET domain_lie_rates = jsonb_set(
            COALESCE(domain_lie_rates, '{}'::jsonb),
            ARRAY[NEW.domain],
            to_jsonb(
                COALESCE((domain_lie_rates->>NEW.domain)::decimal, 0) * 0.9 + 
                CASE WHEN NEW.lie_detected THEN 0.1 ELSE 0.0 END
            )
        )
        WHERE tenant_id = NEW.tenant_id AND model_id = NEW.original_model_id;
    END IF;
    
    -- Update question type rates if provided
    IF NEW.query_type IS NOT NULL THEN
        UPDATE livs_model_weights
        SET question_type_lie_rates = jsonb_set(
            COALESCE(question_type_lie_rates, '{}'::jsonb),
            ARRAY[NEW.query_type],
            to_jsonb(
                COALESCE((question_type_lie_rates->>NEW.query_type)::decimal, 0) * 0.9 + 
                CASE WHEN NEW.lie_detected THEN 0.1 ELSE 0.0 END
            )
        )
        WHERE tenant_id = NEW.tenant_id AND model_id = NEW.original_model_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update weights
CREATE TRIGGER trg_update_livs_model_weights
    AFTER INSERT ON livs_interrogations
    FOR EACH ROW
    EXECUTE FUNCTION update_livs_model_weights();

-- Function to update global weights (called by Twilight Dreaming)
CREATE OR REPLACE FUNCTION aggregate_livs_global_weights()
RETURNS void AS $$
BEGIN
    INSERT INTO livs_global_model_weights (model_id, total_interrogations, lies_detected, lie_rate, contributing_tenants, last_updated)
    SELECT 
        model_id,
        SUM(total_interrogations),
        SUM(lies_detected),
        CASE WHEN SUM(total_interrogations) > 0 
             THEN SUM(lies_detected)::decimal / SUM(total_interrogations)
             ELSE 0 END,
        COUNT(DISTINCT tenant_id),
        NOW()
    FROM livs_model_weights
    GROUP BY model_id
    ON CONFLICT (model_id) DO UPDATE SET
        total_interrogations = EXCLUDED.total_interrogations,
        lies_detected = EXCLUDED.lies_detected,
        lie_rate = EXCLUDED.lie_rate,
        contributing_tenants = EXCLUDED.contributing_tenants,
        last_updated = EXCLUDED.last_updated;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Insert default system soft rules
-- -----------------------------------------------------------------------------
INSERT INTO livs_soft_rules (id, tenant_id, name, description, conditions, actions, priority, created_by_type, active)
SELECT 
    gen_random_uuid(),
    t.id,
    'Medical Domain Deep Interrogation',
    'Force thorough interrogation for medical queries to ensure patient safety',
    '{"queryTypes": ["medical"], "domains": ["healthcare", "medical", "clinical"]}'::jsonb,
    '{"forceInterrogationDepth": 3, "requireEvidenceCitation": true, "minConfidenceRequired": 0.9}'::jsonb,
    100,
    'system',
    true
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM livs_soft_rules WHERE tenant_id = t.id AND name = 'Medical Domain Deep Interrogation'
);

INSERT INTO livs_soft_rules (id, tenant_id, name, description, conditions, actions, priority, created_by_type, active)
SELECT 
    gen_random_uuid(),
    t.id,
    'Legal Domain Verification',
    'Require evidence citation for legal queries',
    '{"queryTypes": ["legal"], "domains": ["legal", "compliance", "regulatory"]}'::jsonb,
    '{"forceInterrogationDepth": 2, "requireEvidenceCitation": true}'::jsonb,
    90,
    'system',
    true
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM livs_soft_rules WHERE tenant_id = t.id AND name = 'Legal Domain Verification'
);

INSERT INTO livs_soft_rules (id, tenant_id, name, description, conditions, actions, priority, created_by_type, active)
SELECT 
    gen_random_uuid(),
    t.id,
    'Financial Domain Accuracy',
    'Deep interrogation for financial calculations and advice',
    '{"queryTypes": ["financial"], "domains": ["finance", "accounting", "investment"]}'::jsonb,
    '{"forceInterrogationDepth": 3, "requireEvidenceCitation": true}'::jsonb,
    90,
    'system',
    true
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM livs_soft_rules WHERE tenant_id = t.id AND name = 'Financial Domain Accuracy'
);

INSERT INTO livs_soft_rules (id, tenant_id, name, description, conditions, actions, priority, created_by_type, active)
SELECT 
    gen_random_uuid(),
    t.id,
    'Code Generation Validation',
    'Probe edge cases for generated code',
    '{"queryTypes": ["code"]}'::jsonb,
    '{"forceInterrogationDepth": 2, "customInterrogationQuestions": ["What would cause this code to fail?", "Are there any edge cases not handled?", "What are the security implications?"]}'::jsonb,
    80,
    'system',
    true
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM livs_soft_rules WHERE tenant_id = t.id AND name = 'Code Generation Validation'
);

-- -----------------------------------------------------------------------------
-- Grant permissions
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON livs_config TO radiant_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON livs_soft_rules TO radiant_app;
GRANT SELECT, INSERT ON livs_interrogations TO radiant_app;
GRANT SELECT, INSERT, UPDATE ON livs_model_weights TO radiant_app;
GRANT SELECT, INSERT, UPDATE ON livs_orchestration_weights TO radiant_app;
GRANT SELECT, INSERT ON livs_pipeline_audits TO radiant_app;
GRANT SELECT, INSERT, UPDATE ON livs_global_model_weights TO radiant_app;

-- Grant to partitions
GRANT SELECT, INSERT ON livs_interrogations_2026_02 TO radiant_app;
GRANT SELECT, INSERT ON livs_interrogations_2026_03 TO radiant_app;
GRANT SELECT, INSERT ON livs_interrogations_2026_04 TO radiant_app;
GRANT SELECT, INSERT ON livs_interrogations_2026_05 TO radiant_app;
GRANT SELECT, INSERT ON livs_interrogations_2026_06 TO radiant_app;
GRANT SELECT, INSERT ON livs_pipeline_audits_2026_02 TO radiant_app;
GRANT SELECT, INSERT ON livs_pipeline_audits_2026_03 TO radiant_app;
GRANT SELECT, INSERT ON livs_pipeline_audits_2026_04 TO radiant_app;
GRANT SELECT, INSERT ON livs_pipeline_audits_2026_05 TO radiant_app;
GRANT SELECT, INSERT ON livs_pipeline_audits_2026_06 TO radiant_app;
