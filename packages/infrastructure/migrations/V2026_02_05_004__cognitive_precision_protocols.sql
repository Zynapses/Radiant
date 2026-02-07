-- Migration: Cognitive Precision Protocols
-- Version: 7.10.0
-- Date: 2026-02-05
-- Description: Database schema for Context Anchor Gate, Negative Constraint Injection, and Critic Performance Tracking

-- ============================================================================
-- NEGATIVE CONSTRAINTS TABLE
-- Stores pre-generation "don't do" constraints per tenant and task type
-- ============================================================================

CREATE TABLE IF NOT EXISTS livs_negative_constraints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    constraint_text TEXT NOT NULL,
    task_types TEXT[] NOT NULL DEFAULT ARRAY['unknown'],
    category VARCHAR(50) NOT NULL DEFAULT 'behavior',
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_category CHECK (category IN ('content', 'behavior', 'format', 'safety', 'custom')),
    CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX idx_negative_constraints_tenant ON livs_negative_constraints(tenant_id);
CREATE INDEX idx_negative_constraints_task_types ON livs_negative_constraints USING GIN(task_types);
CREATE INDEX idx_negative_constraints_active ON livs_negative_constraints(is_active) WHERE is_active = true;

COMMENT ON TABLE livs_negative_constraints IS 'Cognitive Precision Protocol: Negative constraints injected before AI generation';

-- ============================================================================
-- CONTEXT ANCHOR AUDIT LOG
-- Tracks Context Anchor Gate evaluations for monitoring and debugging
-- ============================================================================

CREATE TABLE IF NOT EXISTS livs_context_anchor_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    request_id VARCHAR(100),
    user_id UUID,
    task_type VARCHAR(50) NOT NULL,
    detected_role VARCHAR(100),
    detected_audience VARCHAR(100),
    knowledge_gaps TEXT[],
    confidence_score DECIMAL(5,4) NOT NULL,
    gate_action VARCHAR(20) NOT NULL,
    clarifying_questions TEXT[],
    constraints_applied INTEGER NOT NULL DEFAULT 0,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_gate_action CHECK (gate_action IN ('PROCEED', 'CLARIFY', 'OVERRIDE_ALLOWED', 'BLOCKED'))
);

CREATE INDEX idx_context_anchor_logs_tenant ON livs_context_anchor_logs(tenant_id);
CREATE INDEX idx_context_anchor_logs_created ON livs_context_anchor_logs(created_at DESC);
CREATE INDEX idx_context_anchor_logs_gate_action ON livs_context_anchor_logs(gate_action);
CREATE INDEX idx_context_anchor_logs_task_type ON livs_context_anchor_logs(task_type);

COMMENT ON TABLE livs_context_anchor_logs IS 'Cognitive Precision Protocol: Context Anchor Gate evaluation audit log';

-- ============================================================================
-- CRITIC PERFORMANCE METRICS TABLE
-- Stores aggregated critic model performance for calibration
-- ============================================================================

CREATE TABLE IF NOT EXISTS livs_critic_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    metric_period DATE NOT NULL,
    total_invocations INTEGER NOT NULL DEFAULT 0,
    screening_invocations INTEGER NOT NULL DEFAULT 0,
    full_invocations INTEGER NOT NULL DEFAULT 0,
    ensemble_invocations INTEGER NOT NULL DEFAULT 0,
    escalation_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
    heuristic_agreement_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
    avg_confidence_screening DECIMAL(5,4),
    avg_confidence_full DECIMAL(5,4),
    avg_confidence_ensemble DECIMAL(5,4),
    verdict_supports INTEGER NOT NULL DEFAULT 0,
    verdict_weakens INTEGER NOT NULL DEFAULT 0,
    verdict_inconclusive INTEGER NOT NULL DEFAULT 0,
    avg_processing_time_screening_ms INTEGER,
    avg_processing_time_full_ms INTEGER,
    avg_processing_time_ensemble_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, metric_period)
);

CREATE INDEX idx_critic_metrics_tenant ON livs_critic_performance_metrics(tenant_id);
CREATE INDEX idx_critic_metrics_period ON livs_critic_performance_metrics(metric_period DESC);

COMMENT ON TABLE livs_critic_performance_metrics IS 'Cognitive Precision Protocol: Daily aggregated critic model performance metrics';

-- ============================================================================
-- COGNITIVE PRECISION CONFIG TABLE
-- Per-tenant configuration for Cognitive Precision Protocols
-- ============================================================================

CREATE TABLE IF NOT EXISTS livs_cognitive_precision_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Context Anchor Gate settings
    context_anchor_enabled BOOLEAN NOT NULL DEFAULT true,
    context_anchor_min_confidence DECIMAL(5,4) NOT NULL DEFAULT 0.7,
    context_anchor_allow_override BOOLEAN NOT NULL DEFAULT true,
    context_anchor_max_clarifying_questions INTEGER NOT NULL DEFAULT 3,
    
    -- Negative Constraint settings
    constraint_injection_enabled BOOLEAN NOT NULL DEFAULT true,
    constraint_max_per_request INTEGER NOT NULL DEFAULT 10,
    constraint_include_system_defaults BOOLEAN NOT NULL DEFAULT true,
    
    -- Critic Model settings
    critic_enabled BOOLEAN NOT NULL DEFAULT true,
    critic_model_id VARCHAR(200) NOT NULL DEFAULT 'anthropic/claude-3-5-sonnet-20241022',
    screening_model_id VARCHAR(200) NOT NULL DEFAULT 'anthropic/claude-3-haiku',
    critic_temperature DECIMAL(3,2) NOT NULL DEFAULT 0.1,
    tiered_escalation_enabled BOOLEAN NOT NULL DEFAULT true,
    screening_escalation_threshold DECIMAL(5,4) NOT NULL DEFAULT 0.7,
    ensemble_enabled BOOLEAN NOT NULL DEFAULT false,
    ensemble_critic_models TEXT[] DEFAULT ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o'],
    ensemble_voting_strategy VARCHAR(20) NOT NULL DEFAULT 'majority',
    isolation_enabled BOOLEAN NOT NULL DEFAULT false,
    isolation_level VARCHAR(20) NOT NULL DEFAULT 'none',
    apply_critic_constraints BOOLEAN NOT NULL DEFAULT true,
    max_critic_retries INTEGER NOT NULL DEFAULT 2,
    track_performance BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_isolation_level CHECK (isolation_level IN ('none', 'partial', 'full')),
    CONSTRAINT valid_voting_strategy CHECK (ensemble_voting_strategy IN ('majority', 'unanimous', 'weighted'))
);

CREATE INDEX idx_cognitive_precision_config_tenant ON livs_cognitive_precision_config(tenant_id);

COMMENT ON TABLE livs_cognitive_precision_config IS 'Cognitive Precision Protocol: Per-tenant configuration for context anchoring, constraints, and critic models';

-- ============================================================================
-- INSERT SYSTEM DEFAULT NEGATIVE CONSTRAINTS
-- ============================================================================

INSERT INTO livs_negative_constraints (tenant_id, constraint_text, task_types, category, severity, is_system_default) VALUES
-- Content constraints
(NULL, 'DO NOT fabricate citations, references, or sources that do not exist', ARRAY['code_generation', 'analysis', 'explanation', 'creative', 'unknown'], 'content', 'critical', true),
(NULL, 'DO NOT make up specific numbers, dates, or statistics without indicating they are estimates', ARRAY['analysis', 'explanation', 'unknown'], 'content', 'high', true),
(NULL, 'DO NOT claim capabilities or knowledge you do not possess', ARRAY['code_generation', 'analysis', 'explanation', 'creative', 'unknown'], 'content', 'high', true),

-- Behavior constraints
(NULL, 'DO NOT provide confident answers when uncertain - express appropriate uncertainty', ARRAY['code_generation', 'analysis', 'explanation', 'unknown'], 'behavior', 'high', true),
(NULL, 'DO NOT ignore or dismiss parts of the user''s question', ARRAY['code_generation', 'analysis', 'explanation', 'creative', 'unknown'], 'behavior', 'medium', true),
(NULL, 'DO NOT change your answer simply because the user pushes back', ARRAY['analysis', 'explanation', 'unknown'], 'behavior', 'medium', true),

-- Format constraints
(NULL, 'DO NOT use placeholder code, stubs, TODOs, or incomplete implementations', ARRAY['code_generation'], 'format', 'critical', true),
(NULL, 'DO NOT omit error handling or edge cases in code', ARRAY['code_generation'], 'format', 'high', true),
(NULL, 'DO NOT provide code snippets without necessary imports and context', ARRAY['code_generation'], 'format', 'medium', true),

-- Safety constraints
(NULL, 'DO NOT provide information that could be used for harmful purposes without appropriate warnings', ARRAY['code_generation', 'analysis', 'explanation', 'unknown'], 'safety', 'critical', true),
(NULL, 'DO NOT include hardcoded credentials, API keys, or sensitive data in code examples', ARRAY['code_generation'], 'safety', 'critical', true);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE livs_negative_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE livs_context_anchor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE livs_critic_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE livs_cognitive_precision_config ENABLE ROW LEVEL SECURITY;

-- Negative constraints: tenants see their own + system defaults
CREATE POLICY livs_negative_constraints_tenant_isolation ON livs_negative_constraints
    FOR ALL USING (
        tenant_id IS NULL 
        OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- Context anchor logs: tenant isolation
CREATE POLICY livs_context_anchor_logs_tenant_isolation ON livs_context_anchor_logs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Critic metrics: tenant isolation
CREATE POLICY livs_critic_metrics_tenant_isolation ON livs_critic_performance_metrics
    FOR ALL USING (
        tenant_id IS NULL 
        OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- Config: tenant isolation
CREATE POLICY livs_cognitive_precision_config_tenant_isolation ON livs_cognitive_precision_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_cognitive_precision_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_negative_constraints_updated_at
    BEFORE UPDATE ON livs_negative_constraints
    FOR EACH ROW EXECUTE FUNCTION update_cognitive_precision_updated_at();

CREATE TRIGGER tr_cognitive_precision_config_updated_at
    BEFORE UPDATE ON livs_cognitive_precision_config
    FOR EACH ROW EXECUTE FUNCTION update_cognitive_precision_updated_at();

CREATE TRIGGER tr_critic_metrics_updated_at
    BEFORE UPDATE ON livs_critic_performance_metrics
    FOR EACH ROW EXECUTE FUNCTION update_cognitive_precision_updated_at();
