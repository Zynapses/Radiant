-- Migration: 048_metacognition.sql
-- RADIANT v4.18.0 - AGI Enhancement Phase 3: Metacognition
-- Self-awareness, confidence monitoring, error detection, and continuous improvement

-- ============================================================================
-- CONFIDENCE ASSESSMENTS - Track confidence in outputs
-- ============================================================================

CREATE TABLE IF NOT EXISTS confidence_assessments (
    assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Context
    session_id UUID,
    cognitive_session_id UUID,
    user_id UUID,
    
    -- What was assessed
    subject_type VARCHAR(50) NOT NULL, -- 'response', 'plan', 'decision', 'fact', 'prediction'
    subject_id UUID,
    subject_content TEXT NOT NULL,
    
    -- Confidence breakdown
    overall_confidence DECIMAL(5,4) NOT NULL,
    confidence_factors JSONB DEFAULT '{}', -- {knowledge: 0.8, reasoning: 0.7, evidence: 0.9}
    
    -- Uncertainty analysis
    known_unknowns JSONB DEFAULT '[]', -- Things we know we don't know
    potential_errors JSONB DEFAULT '[]', -- Potential error types
    assumptions JSONB DEFAULT '[]', -- Assumptions made
    
    -- Calibration data (for improving calibration over time)
    predicted_accuracy DECIMAL(5,4),
    actual_accuracy DECIMAL(5,4), -- Filled in later if feedback received
    calibration_error DECIMAL(5,4), -- predicted - actual
    
    -- Source of assessment
    assessment_method VARCHAR(50), -- 'self_eval', 'peer_review', 'user_feedback', 'verification'
    assessed_by UUID, -- Agent ID if peer review
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE confidence_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY confidence_assessments_tenant_isolation ON confidence_assessments
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_confidence_assessments_tenant ON confidence_assessments(tenant_id);
CREATE INDEX idx_confidence_assessments_session ON confidence_assessments(session_id);
CREATE INDEX idx_confidence_assessments_subject ON confidence_assessments(subject_type, subject_id);
CREATE INDEX idx_confidence_assessments_time ON confidence_assessments(created_at DESC);

-- ============================================================================
-- ERROR DETECTION LOG - Track detected errors and corrections
-- ============================================================================

CREATE TABLE IF NOT EXISTS detected_errors (
    error_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Context
    session_id UUID,
    user_id UUID,
    
    -- Error details
    error_type VARCHAR(50) NOT NULL, -- 'factual', 'logical', 'consistency', 'hallucination', 'incomplete', 'misunderstanding'
    severity VARCHAR(20) NOT NULL, -- 'critical', 'major', 'minor', 'trivial'
    
    -- What contained the error
    source_type VARCHAR(50) NOT NULL, -- 'response', 'plan', 'reasoning', 'memory_retrieval', 'entity_extraction'
    source_id UUID,
    source_content TEXT NOT NULL,
    
    -- Error specifics
    error_description TEXT NOT NULL,
    error_location TEXT, -- Where in the content
    error_evidence JSONB DEFAULT '{}', -- Evidence for why this is an error
    
    -- Correction
    correction_proposed TEXT,
    correction_applied BOOLEAN DEFAULT false,
    correction_confidence DECIMAL(5,4),
    
    -- Detection method
    detection_method VARCHAR(50), -- 'self_check', 'consistency_check', 'fact_verification', 'user_feedback', 'peer_review'
    detected_by UUID, -- Agent ID if peer detected
    
    -- Impact assessment
    impact_description TEXT,
    downstream_effects JSONB DEFAULT '[]',
    
    -- Resolution
    resolution_status VARCHAR(20) DEFAULT 'detected', -- 'detected', 'analyzing', 'corrected', 'accepted', 'dismissed'
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE detected_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY detected_errors_tenant_isolation ON detected_errors
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_detected_errors_tenant ON detected_errors(tenant_id);
CREATE INDEX idx_detected_errors_session ON detected_errors(session_id);
CREATE INDEX idx_detected_errors_type ON detected_errors(error_type);
CREATE INDEX idx_detected_errors_severity ON detected_errors(severity);
CREATE INDEX idx_detected_errors_status ON detected_errors(resolution_status);

-- ============================================================================
-- KNOWLEDGE BOUNDARIES - Track what the system knows and doesn't know
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_boundaries (
    boundary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    
    -- Domain/Topic
    domain VARCHAR(200) NOT NULL,
    topic VARCHAR(500) NOT NULL,
    topic_embedding vector(1536),
    
    -- Knowledge level
    knowledge_level VARCHAR(20) NOT NULL, -- 'expert', 'proficient', 'familiar', 'limited', 'unknown'
    confidence_in_assessment DECIMAL(5,4),
    
    -- Evidence
    evidence_for_level JSONB DEFAULT '{}', -- Why we think we have this level
    last_demonstrated TIMESTAMPTZ,
    demonstration_count INTEGER DEFAULT 0,
    
    -- Improvement tracking
    improvement_goal VARCHAR(20), -- Target knowledge level
    improvement_plan JSONB DEFAULT '{}',
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE knowledge_boundaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY knowledge_boundaries_tenant_isolation ON knowledge_boundaries
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_knowledge_boundaries_tenant ON knowledge_boundaries(tenant_id);
CREATE INDEX idx_knowledge_boundaries_domain ON knowledge_boundaries(domain);
CREATE INDEX idx_knowledge_boundaries_level ON knowledge_boundaries(knowledge_level);
CREATE INDEX idx_knowledge_boundaries_embedding ON knowledge_boundaries 
    USING ivfflat (topic_embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- STRATEGY PERFORMANCE - Track effectiveness of different strategies
-- ============================================================================

CREATE TABLE IF NOT EXISTS strategy_performance (
    performance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Strategy identification
    strategy_type VARCHAR(100) NOT NULL, -- 'reasoning', 'planning', 'retrieval', 'generation', 'collaboration'
    strategy_name VARCHAR(200) NOT NULL,
    strategy_params JSONB DEFAULT '{}',
    
    -- Context where used
    task_type VARCHAR(100),
    task_complexity VARCHAR(20), -- 'simple', 'moderate', 'complex', 'very_complex'
    
    -- Performance metrics
    times_used INTEGER DEFAULT 0,
    times_successful INTEGER DEFAULT 0,
    avg_confidence DECIMAL(5,4),
    avg_user_satisfaction DECIMAL(5,4),
    avg_latency_ms DECIMAL(10,2),
    avg_token_cost INTEGER,
    
    -- Comparison
    better_than_baseline BOOLEAN,
    improvement_vs_baseline DECIMAL(5,4),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE strategy_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY strategy_performance_tenant_isolation ON strategy_performance
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_strategy_performance_tenant ON strategy_performance(tenant_id);
CREATE INDEX idx_strategy_performance_type ON strategy_performance(strategy_type);
CREATE INDEX idx_strategy_performance_task ON strategy_performance(task_type);

-- ============================================================================
-- SELF IMPROVEMENT PLANS - Identified weaknesses and improvement goals
-- ============================================================================

CREATE TABLE IF NOT EXISTS self_improvement_plans (
    plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Weakness identification
    weakness_type VARCHAR(50) NOT NULL, -- 'knowledge_gap', 'skill_deficiency', 'bias', 'calibration', 'efficiency'
    weakness_description TEXT NOT NULL,
    weakness_evidence JSONB DEFAULT '[]', -- Evidence of the weakness
    severity VARCHAR(20), -- 'critical', 'significant', 'moderate', 'minor'
    
    -- Improvement plan
    improvement_goal TEXT NOT NULL,
    improvement_strategy TEXT,
    action_items JSONB DEFAULT '[]', -- [{action, status, due_date}]
    success_criteria JSONB DEFAULT '{}',
    
    -- Progress tracking
    status VARCHAR(20) DEFAULT 'identified', -- 'identified', 'planning', 'in_progress', 'completed', 'abandoned'
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    progress_notes JSONB DEFAULT '[]',
    
    -- Results
    improvement_measured DECIMAL(5,4), -- Quantified improvement
    verification_method VARCHAR(100),
    verified_at TIMESTAMPTZ,
    
    priority INTEGER DEFAULT 5, -- 1-10, higher = more important
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE self_improvement_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY self_improvement_plans_tenant_isolation ON self_improvement_plans
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_self_improvement_plans_tenant ON self_improvement_plans(tenant_id);
CREATE INDEX idx_self_improvement_plans_type ON self_improvement_plans(weakness_type);
CREATE INDEX idx_self_improvement_plans_status ON self_improvement_plans(status);
CREATE INDEX idx_self_improvement_plans_priority ON self_improvement_plans(priority DESC);

-- ============================================================================
-- REFLECTION LOG - Self-reflection sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS reflection_log (
    reflection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Context
    session_id UUID,
    trigger_type VARCHAR(50), -- 'scheduled', 'error_triggered', 'low_confidence', 'user_request', 'post_task'
    
    -- Reflection content
    reflection_focus VARCHAR(100), -- What was reflected on
    thought_process TEXT NOT NULL, -- The actual reflection
    
    -- Insights gained
    insights JSONB DEFAULT '[]', -- [{insight, confidence, actionable}]
    patterns_noticed JSONB DEFAULT '[]',
    
    -- Self-assessment
    performance_rating DECIMAL(5,4), -- Self-rated performance
    areas_for_improvement TEXT[] DEFAULT '{}',
    
    -- Actions taken
    actions_triggered JSONB DEFAULT '[]', -- Actions initiated as result of reflection
    
    -- Meta-metrics
    reflection_quality_score DECIMAL(5,4), -- How useful was this reflection
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reflection_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY reflection_log_tenant_isolation ON reflection_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_reflection_log_tenant ON reflection_log(tenant_id);
CREATE INDEX idx_reflection_log_session ON reflection_log(session_id);
CREATE INDEX idx_reflection_log_trigger ON reflection_log(trigger_type);
CREATE INDEX idx_reflection_log_time ON reflection_log(created_at DESC);

-- ============================================================================
-- CALIBRATION HISTORY - Track confidence calibration over time
-- ============================================================================

CREATE TABLE IF NOT EXISTS calibration_history (
    calibration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Time period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Calibration metrics
    total_predictions INTEGER DEFAULT 0,
    predictions_with_feedback INTEGER DEFAULT 0,
    
    -- By confidence bucket
    bucket_0_20 JSONB DEFAULT '{"predicted": 0, "actual": 0}',
    bucket_20_40 JSONB DEFAULT '{"predicted": 0, "actual": 0}',
    bucket_40_60 JSONB DEFAULT '{"predicted": 0, "actual": 0}',
    bucket_60_80 JSONB DEFAULT '{"predicted": 0, "actual": 0}',
    bucket_80_100 JSONB DEFAULT '{"predicted": 0, "actual": 0}',
    
    -- Overall calibration score (lower = better calibrated)
    calibration_score DECIMAL(5,4), -- Brier score or similar
    overconfidence_tendency DECIMAL(5,4), -- Positive = overconfident
    underconfidence_tendency DECIMAL(5,4), -- Positive = underconfident
    
    -- By domain/task type
    calibration_by_domain JSONB DEFAULT '{}',
    calibration_by_task_type JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE calibration_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY calibration_history_tenant_isolation ON calibration_history
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_calibration_history_tenant ON calibration_history(tenant_id);
CREATE INDEX idx_calibration_history_period ON calibration_history(period_start, period_end);

-- ============================================================================
-- METACOGNITIVE SETTINGS - Per-tenant metacognition configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS metacognitive_settings (
    setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Enable/disable features
    confidence_monitoring_enabled BOOLEAN DEFAULT true,
    error_detection_enabled BOOLEAN DEFAULT true,
    self_reflection_enabled BOOLEAN DEFAULT true,
    strategy_optimization_enabled BOOLEAN DEFAULT true,
    knowledge_boundary_tracking BOOLEAN DEFAULT true,
    
    -- Thresholds
    low_confidence_threshold DECIMAL(3,2) DEFAULT 0.5, -- Below this triggers extra scrutiny
    high_confidence_threshold DECIMAL(3,2) DEFAULT 0.9, -- Above this might indicate overconfidence
    error_severity_for_correction VARCHAR(20) DEFAULT 'major', -- Minimum severity to auto-correct
    
    -- Reflection schedule
    reflection_frequency VARCHAR(20) DEFAULT 'post_session', -- 'never', 'post_task', 'post_session', 'hourly', 'daily'
    max_reflections_per_day INTEGER DEFAULT 10,
    
    -- Self-improvement
    auto_generate_improvement_plans BOOLEAN DEFAULT true,
    max_active_improvement_plans INTEGER DEFAULT 5,
    
    -- Calibration
    calibration_window_days INTEGER DEFAULT 7,
    target_calibration_score DECIMAL(3,2) DEFAULT 0.1, -- Brier score target
    
    -- "I don't know" behavior
    admit_uncertainty_threshold DECIMAL(3,2) DEFAULT 0.3, -- Below this, admit uncertainty
    uncertainty_escalation_enabled BOOLEAN DEFAULT true, -- Escalate to human when uncertain
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE metacognitive_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY metacognitive_settings_tenant_isolation ON metacognitive_settings
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Calculate calibration score for a period
CREATE OR REPLACE FUNCTION calculate_calibration_score(
    p_tenant_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS DECIMAL AS $$
DECLARE
    v_brier_score DECIMAL;
BEGIN
    SELECT AVG(POWER(predicted_accuracy - COALESCE(actual_accuracy, predicted_accuracy), 2))
    INTO v_brier_score
    FROM confidence_assessments
    WHERE tenant_id = p_tenant_id
      AND created_at BETWEEN p_start_date AND p_end_date
      AND actual_accuracy IS NOT NULL;
    
    RETURN COALESCE(v_brier_score, 0);
END;
$$ LANGUAGE plpgsql;

-- Get knowledge level for a topic
CREATE OR REPLACE FUNCTION get_knowledge_level(
    p_tenant_id UUID,
    p_topic VARCHAR
)
RETURNS VARCHAR AS $$
DECLARE
    v_level VARCHAR;
BEGIN
    SELECT knowledge_level INTO v_level
    FROM knowledge_boundaries
    WHERE tenant_id = p_tenant_id
      AND LOWER(topic) = LOWER(p_topic)
      AND is_active = true
    ORDER BY updated_at DESC
    LIMIT 1;
    
    RETURN COALESCE(v_level, 'unknown');
END;
$$ LANGUAGE plpgsql;

-- Update strategy performance
CREATE OR REPLACE FUNCTION update_strategy_performance(
    p_tenant_id UUID,
    p_strategy_type VARCHAR,
    p_strategy_name VARCHAR,
    p_success BOOLEAN,
    p_confidence DECIMAL,
    p_latency_ms DECIMAL
)
RETURNS void AS $$
BEGIN
    INSERT INTO strategy_performance (
        tenant_id, strategy_type, strategy_name, times_used, times_successful, avg_confidence, avg_latency_ms
    ) VALUES (
        p_tenant_id, p_strategy_type, p_strategy_name, 1, 
        CASE WHEN p_success THEN 1 ELSE 0 END,
        p_confidence, p_latency_ms
    )
    ON CONFLICT (tenant_id, strategy_type, strategy_name) DO UPDATE SET
        times_used = strategy_performance.times_used + 1,
        times_successful = strategy_performance.times_successful + CASE WHEN p_success THEN 1 ELSE 0 END,
        avg_confidence = (strategy_performance.avg_confidence * strategy_performance.times_used + p_confidence) / (strategy_performance.times_used + 1),
        avg_latency_ms = (strategy_performance.avg_latency_ms * strategy_performance.times_used + p_latency_ms) / (strategy_performance.times_used + 1),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_metacognition_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_boundaries_updated
    BEFORE UPDATE ON knowledge_boundaries
    FOR EACH ROW EXECUTE FUNCTION update_metacognition_timestamp();

CREATE TRIGGER strategy_performance_updated
    BEFORE UPDATE ON strategy_performance
    FOR EACH ROW EXECUTE FUNCTION update_metacognition_timestamp();

CREATE TRIGGER self_improvement_plans_updated
    BEFORE UPDATE ON self_improvement_plans
    FOR EACH ROW EXECUTE FUNCTION update_metacognition_timestamp();

CREATE TRIGGER metacognitive_settings_updated
    BEFORE UPDATE ON metacognitive_settings
    FOR EACH ROW EXECUTE FUNCTION update_metacognition_timestamp();

-- Auto-create improvement plan for critical errors
CREATE OR REPLACE FUNCTION auto_improvement_plan_for_error()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.severity IN ('critical', 'major') AND NEW.resolution_status = 'detected' THEN
        INSERT INTO self_improvement_plans (
            tenant_id, weakness_type, weakness_description, weakness_evidence,
            severity, improvement_goal, status, priority
        ) VALUES (
            NEW.tenant_id,
            'error_pattern',
            'Detected ' || NEW.error_type || ' error: ' || NEW.error_description,
            jsonb_build_array(jsonb_build_object('error_id', NEW.error_id, 'source', NEW.source_content)),
            NEW.severity,
            'Reduce ' || NEW.error_type || ' errors through improved ' || 
                CASE NEW.error_type 
                    WHEN 'factual' THEN 'fact verification'
                    WHEN 'logical' THEN 'reasoning chains'
                    WHEN 'consistency' THEN 'context tracking'
                    WHEN 'hallucination' THEN 'grounding and verification'
                    ELSE 'processing'
                END,
            'identified',
            CASE NEW.severity WHEN 'critical' THEN 9 WHEN 'major' THEN 7 ELSE 5 END
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER error_creates_improvement_plan
    AFTER INSERT ON detected_errors
    FOR EACH ROW EXECUTE FUNCTION auto_improvement_plan_for_error();

-- ============================================================================
-- DEFAULT SETTINGS
-- ============================================================================

INSERT INTO metacognitive_settings (tenant_id)
SELECT tenant_id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE strategy_performance 
    ADD CONSTRAINT unique_strategy_per_tenant 
    UNIQUE (tenant_id, strategy_type, strategy_name);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE confidence_assessments IS 'Track confidence levels and calibration for system outputs';
COMMENT ON TABLE detected_errors IS 'Log of detected errors with corrections and resolution status';
COMMENT ON TABLE knowledge_boundaries IS 'Track what domains/topics the system knows well vs poorly';
COMMENT ON TABLE strategy_performance IS 'Performance metrics for different reasoning/generation strategies';
COMMENT ON TABLE self_improvement_plans IS 'Plans for addressing identified weaknesses';
COMMENT ON TABLE reflection_log IS 'Self-reflection sessions and insights gained';
COMMENT ON TABLE calibration_history IS 'Historical calibration data for confidence scores';
COMMENT ON TABLE metacognitive_settings IS 'Per-tenant configuration for metacognition features';
