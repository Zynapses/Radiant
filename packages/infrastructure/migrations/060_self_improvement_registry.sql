-- Migration: 060_self_improvement_registry.sql
-- RADIANT v4.18.0 - AGI Self-Improvement Registry
-- Self-aware performance tracking, improvement proposals, idea evolution, and deprecation

-- ============================================================================
-- SELF-IMPROVEMENT IDEAS - The core registry of improvement ideas
-- ============================================================================

CREATE TABLE IF NOT EXISTS self_improvement_ideas (
    idea_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Idea identification
    idea_code VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'SI-001', 'SI-002'
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    
    -- Classification
    category VARCHAR(100) NOT NULL, -- 'reasoning', 'memory', 'learning', 'safety', 'performance', 'ux', 'integration'
    subcategory VARCHAR(100),
    priority VARCHAR(20) DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
    
    -- Origin
    origin_type VARCHAR(50) NOT NULL, -- 'self_generated', 'performance_analysis', 'error_pattern', 'user_feedback', 'admin_suggested'
    origin_context JSONB DEFAULT '{}', -- What triggered this idea
    
    -- Problem identification
    problem_statement TEXT,
    affected_capabilities TEXT[] DEFAULT '{}',
    
    -- Proposed solution
    proposed_solution TEXT,
    implementation_approach JSONB DEFAULT '{}',
    estimated_effort VARCHAR(20), -- 'trivial', 'small', 'medium', 'large', 'epic'
    estimated_impact VARCHAR(20), -- 'minor', 'moderate', 'significant', 'major', 'transformative'
    
    -- Evidence
    supporting_evidence JSONB DEFAULT '[]', -- Data supporting this improvement
    performance_baseline JSONB DEFAULT '{}', -- Current performance metrics
    expected_improvement JSONB DEFAULT '{}', -- Expected improvements
    
    -- Lifecycle
    status VARCHAR(30) DEFAULT 'proposed', -- 'proposed', 'under_review', 'approved', 'implementing', 'implemented', 'measuring', 'validated', 'deprecated', 'rejected'
    
    -- Evolution tracking
    version INTEGER DEFAULT 1,
    parent_idea_id UUID REFERENCES self_improvement_ideas(idea_id), -- If evolved from another idea
    evolved_into_id UUID REFERENCES self_improvement_ideas(idea_id), -- If this evolved into a new idea
    evolution_reason TEXT,
    
    -- Deprecation
    is_deprecated BOOLEAN DEFAULT false,
    deprecated_at TIMESTAMPTZ,
    deprecation_reason TEXT,
    superseded_by_id UUID REFERENCES self_improvement_ideas(idea_id),
    
    -- Validation
    validation_status VARCHAR(20), -- 'pending', 'successful', 'failed', 'inconclusive'
    validation_results JSONB DEFAULT '{}',
    actual_improvement JSONB DEFAULT '{}',
    
    -- Scoring
    confidence_score DECIMAL(5,4) DEFAULT 0.5, -- AI confidence in this idea
    impact_score DECIMAL(5,4), -- Measured or estimated impact
    feasibility_score DECIMAL(5,4), -- How feasible to implement
    urgency_score DECIMAL(5,4), -- How urgent
    composite_score DECIMAL(5,4), -- Weighted combination
    
    -- Metadata
    created_by VARCHAR(100) DEFAULT 'agi_self_analysis',
    reviewed_by VARCHAR(200),
    approved_by VARCHAR(200),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE self_improvement_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY self_improvement_ideas_tenant_isolation ON self_improvement_ideas
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID OR tenant_id IS NULL);

CREATE INDEX idx_self_improvement_ideas_status ON self_improvement_ideas(status) WHERE NOT is_deprecated;
CREATE INDEX idx_self_improvement_ideas_category ON self_improvement_ideas(category);
CREATE INDEX idx_self_improvement_ideas_priority ON self_improvement_ideas(priority, composite_score DESC);
CREATE INDEX idx_self_improvement_ideas_code ON self_improvement_ideas(idea_code);

-- ============================================================================
-- PERFORMANCE SELF-AWARENESS - Track AGI's awareness of its own performance
-- ============================================================================

CREATE TABLE IF NOT EXISTS performance_self_awareness (
    awareness_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- What capability/area
    capability_area VARCHAR(100) NOT NULL,
    
    -- Self-assessment
    self_assessed_strength DECIMAL(5,4), -- 0-1
    self_assessed_weakness DECIMAL(5,4), -- 0-1
    confidence_in_assessment DECIMAL(5,4),
    
    -- Actual performance (measured)
    actual_performance DECIMAL(5,4),
    performance_trend VARCHAR(20), -- 'improving', 'stable', 'declining'
    trend_velocity DECIMAL(5,4), -- Rate of change
    
    -- Calibration
    assessment_accuracy DECIMAL(5,4), -- How accurate is self-assessment
    overconfidence_bias DECIMAL(5,4),
    
    -- Areas for improvement
    identified_weaknesses JSONB DEFAULT '[]',
    improvement_opportunities JSONB DEFAULT '[]',
    
    -- Linked improvements
    related_improvement_ids UUID[] DEFAULT '{}',
    
    last_assessed TIMESTAMPTZ DEFAULT NOW(),
    assessment_count INTEGER DEFAULT 1
);

ALTER TABLE performance_self_awareness ENABLE ROW LEVEL SECURITY;
CREATE POLICY performance_self_awareness_tenant_isolation ON performance_self_awareness
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID OR tenant_id IS NULL);

CREATE INDEX idx_performance_self_awareness_capability ON performance_self_awareness(capability_area);

-- ============================================================================
-- IMPROVEMENT EVOLUTION HISTORY - Track how ideas evolve over time
-- ============================================================================

CREATE TABLE IF NOT EXISTS improvement_evolution_history (
    evolution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id UUID NOT NULL REFERENCES self_improvement_ideas(idea_id) ON DELETE CASCADE,
    
    -- Version info
    version_from INTEGER NOT NULL,
    version_to INTEGER NOT NULL,
    
    -- What changed
    change_type VARCHAR(50) NOT NULL, -- 'refinement', 'expansion', 'pivot', 'split', 'merge', 'deprecation'
    change_summary TEXT NOT NULL,
    
    -- Detailed changes
    changes_made JSONB NOT NULL, -- {field: {old, new}}
    
    -- Reason for evolution
    evolution_trigger VARCHAR(50), -- 'new_data', 'feedback', 'failure', 'success', 'new_idea', 'admin_input'
    evolution_context JSONB DEFAULT '{}',
    
    -- Who/what triggered
    triggered_by VARCHAR(100) DEFAULT 'agi_self_evolution',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_improvement_evolution_history_idea ON improvement_evolution_history(idea_id);

-- ============================================================================
-- SELF-ANALYSIS SESSIONS - When AGI analyzes itself
-- ============================================================================

CREATE TABLE IF NOT EXISTS self_analysis_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Session info
    analysis_type VARCHAR(50) NOT NULL, -- 'scheduled', 'triggered', 'manual', 'post_incident'
    trigger_reason TEXT,
    
    -- What was analyzed
    areas_analyzed TEXT[] DEFAULT '{}',
    data_sources_used TEXT[] DEFAULT '{}',
    
    -- Findings
    performance_summary JSONB DEFAULT '{}',
    strengths_identified JSONB DEFAULT '[]',
    weaknesses_identified JSONB DEFAULT '[]',
    anomalies_detected JSONB DEFAULT '[]',
    
    -- Ideas generated
    new_ideas_generated INTEGER DEFAULT 0,
    ideas_updated INTEGER DEFAULT 0,
    ideas_deprecated INTEGER DEFAULT 0,
    generated_idea_ids UUID[] DEFAULT '{}',
    
    -- Quality
    analysis_depth VARCHAR(20), -- 'shallow', 'moderate', 'deep', 'comprehensive'
    confidence_level DECIMAL(5,4),
    
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER
);

ALTER TABLE self_analysis_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY self_analysis_sessions_tenant_isolation ON self_analysis_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID OR tenant_id IS NULL);

-- ============================================================================
-- IMPROVEMENT METRICS - Track effectiveness of improvements
-- ============================================================================

CREATE TABLE IF NOT EXISTS improvement_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id UUID NOT NULL REFERENCES self_improvement_ideas(idea_id) ON DELETE CASCADE,
    
    -- Metric definition
    metric_name VARCHAR(200) NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- 'accuracy', 'latency', 'cost', 'satisfaction', 'error_rate'
    
    -- Baseline
    baseline_value DECIMAL(15,6),
    baseline_date TIMESTAMPTZ,
    
    -- Target
    target_value DECIMAL(15,6),
    target_improvement_percent DECIMAL(5,2),
    
    -- Current
    current_value DECIMAL(15,6),
    current_date TIMESTAMPTZ DEFAULT NOW(),
    
    -- Achievement
    improvement_percent DECIMAL(5,2),
    target_achieved BOOLEAN,
    
    -- History
    value_history JSONB DEFAULT '[]', -- [{date, value}]
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_improvement_metrics_idea ON improvement_metrics(idea_id);

-- ============================================================================
-- ADMIN NOTIFICATIONS - Notify admins of important self-improvement events
-- ============================================================================

CREATE TABLE IF NOT EXISTS improvement_notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Notification
    notification_type VARCHAR(50) NOT NULL, -- 'new_idea', 'idea_evolved', 'idea_validated', 'idea_deprecated', 'performance_alert', 'milestone'
    title VARCHAR(500) NOT NULL,
    message TEXT,
    
    -- Related items
    related_idea_id UUID REFERENCES self_improvement_ideas(idea_id),
    related_session_id UUID REFERENCES self_analysis_sessions(session_id),
    
    -- Priority
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    
    -- Status
    read BOOLEAN DEFAULT false,
    read_by VARCHAR(200),
    read_at TIMESTAMPTZ,
    
    -- Actions
    requires_action BOOLEAN DEFAULT false,
    action_taken VARCHAR(100),
    action_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE improvement_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY improvement_notifications_tenant_isolation ON improvement_notifications
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID OR tenant_id IS NULL);

CREATE INDEX idx_improvement_notifications_unread ON improvement_notifications(tenant_id, read) WHERE read = false;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Generate next idea code
CREATE OR REPLACE FUNCTION generate_idea_code()
RETURNS VARCHAR(50) AS $$
DECLARE
    v_max_num INTEGER;
    v_new_code VARCHAR(50);
BEGIN
    SELECT COALESCE(MAX(SUBSTRING(idea_code FROM 4)::INTEGER), 0) + 1 INTO v_max_num
    FROM self_improvement_ideas
    WHERE idea_code LIKE 'SI-%';
    
    v_new_code := 'SI-' || LPAD(v_max_num::TEXT, 4, '0');
    RETURN v_new_code;
END;
$$ LANGUAGE plpgsql;

-- Create a new improvement idea
CREATE OR REPLACE FUNCTION create_improvement_idea(
    p_tenant_id UUID,
    p_title VARCHAR,
    p_description TEXT,
    p_category VARCHAR,
    p_origin_type VARCHAR,
    p_problem_statement TEXT DEFAULT NULL,
    p_proposed_solution TEXT DEFAULT NULL,
    p_confidence DECIMAL DEFAULT 0.5
)
RETURNS UUID AS $$
DECLARE
    v_idea_id UUID;
    v_idea_code VARCHAR(50);
BEGIN
    v_idea_code := generate_idea_code();
    
    INSERT INTO self_improvement_ideas (
        tenant_id, idea_code, title, description, category, origin_type,
        problem_statement, proposed_solution, confidence_score, created_by
    ) VALUES (
        p_tenant_id, v_idea_code, p_title, p_description, p_category, p_origin_type,
        p_problem_statement, p_proposed_solution, p_confidence, 'agi_self_analysis'
    ) RETURNING idea_id INTO v_idea_id;
    
    -- Notify admin
    INSERT INTO improvement_notifications (
        tenant_id, notification_type, title, message, related_idea_id, priority
    ) VALUES (
        p_tenant_id, 'new_idea', 'New Self-Improvement Idea: ' || p_title,
        'The AGI has identified a new improvement opportunity in ' || p_category,
        v_idea_id, 
        CASE WHEN p_confidence > 0.8 THEN 'high' ELSE 'normal' END
    );
    
    RETURN v_idea_id;
END;
$$ LANGUAGE plpgsql;

-- Evolve an existing idea
CREATE OR REPLACE FUNCTION evolve_improvement_idea(
    p_idea_id UUID,
    p_change_type VARCHAR,
    p_change_summary TEXT,
    p_changes JSONB,
    p_trigger VARCHAR DEFAULT 'agi_self_evolution'
)
RETURNS INTEGER AS $$
DECLARE
    v_current_version INTEGER;
    v_new_version INTEGER;
BEGIN
    -- Get current version
    SELECT version INTO v_current_version FROM self_improvement_ideas WHERE idea_id = p_idea_id;
    v_new_version := v_current_version + 1;
    
    -- Record evolution
    INSERT INTO improvement_evolution_history (
        idea_id, version_from, version_to, change_type, change_summary, changes_made, evolution_trigger, triggered_by
    ) VALUES (
        p_idea_id, v_current_version, v_new_version, p_change_type, p_change_summary, p_changes, p_trigger, 'agi_self_evolution'
    );
    
    -- Update version
    UPDATE self_improvement_ideas SET
        version = v_new_version,
        updated_at = NOW()
    WHERE idea_id = p_idea_id;
    
    -- Notify if significant change
    IF p_change_type IN ('pivot', 'expansion', 'merge') THEN
        INSERT INTO improvement_notifications (
            tenant_id, notification_type, title, message, related_idea_id
        )
        SELECT tenant_id, 'idea_evolved', 'Idea Evolved: ' || title,
               'Self-improvement idea has been ' || p_change_type || 'd: ' || p_change_summary,
               p_idea_id
        FROM self_improvement_ideas WHERE idea_id = p_idea_id;
    END IF;
    
    RETURN v_new_version;
END;
$$ LANGUAGE plpgsql;

-- Deprecate an idea
CREATE OR REPLACE FUNCTION deprecate_improvement_idea(
    p_idea_id UUID,
    p_reason TEXT,
    p_superseded_by UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    -- Mark as deprecated
    UPDATE self_improvement_ideas SET
        is_deprecated = true,
        deprecated_at = NOW(),
        deprecation_reason = p_reason,
        superseded_by_id = p_superseded_by,
        status = 'deprecated',
        updated_at = NOW()
    WHERE idea_id = p_idea_id;
    
    -- If superseded, link the new idea
    IF p_superseded_by IS NOT NULL THEN
        UPDATE self_improvement_ideas SET
            parent_idea_id = p_idea_id
        WHERE idea_id = p_superseded_by;
    END IF;
    
    -- Notify
    INSERT INTO improvement_notifications (
        tenant_id, notification_type, title, message, related_idea_id
    )
    SELECT tenant_id, 'idea_deprecated', 'Idea Deprecated: ' || title,
           'Reason: ' || p_reason,
           p_idea_id
    FROM self_improvement_ideas WHERE idea_id = p_idea_id;
    
    -- Record in evolution history
    INSERT INTO improvement_evolution_history (
        idea_id, version_from, version_to, change_type, change_summary, changes_made, evolution_trigger
    )
    SELECT idea_id, version, version, 'deprecation', p_reason, 
           jsonb_build_object('is_deprecated', jsonb_build_object('old', false, 'new', true)),
           'superseded'
    FROM self_improvement_ideas WHERE idea_id = p_idea_id;
END;
$$ LANGUAGE plpgsql;

-- Calculate composite score
CREATE OR REPLACE FUNCTION calculate_idea_composite_score(p_idea_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_idea RECORD;
    v_score DECIMAL;
BEGIN
    SELECT * INTO v_idea FROM self_improvement_ideas WHERE idea_id = p_idea_id;
    
    -- Weighted score: confidence * 0.3 + impact * 0.3 + feasibility * 0.2 + urgency * 0.2
    v_score := COALESCE(v_idea.confidence_score, 0.5) * 0.3 +
               COALESCE(v_idea.impact_score, 0.5) * 0.3 +
               COALESCE(v_idea.feasibility_score, 0.5) * 0.2 +
               COALESCE(v_idea.urgency_score, 0.5) * 0.2;
    
    -- Update the idea
    UPDATE self_improvement_ideas SET composite_score = v_score WHERE idea_id = p_idea_id;
    
    RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- Auto-deprecate old ideas that haven't been acted on
CREATE OR REPLACE FUNCTION auto_deprecate_stale_ideas()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_idea RECORD;
BEGIN
    FOR v_idea IN 
        SELECT idea_id, title
        FROM self_improvement_ideas
        WHERE status = 'proposed'
          AND NOT is_deprecated
          AND created_at < NOW() - INTERVAL '90 days'
          AND (composite_score IS NULL OR composite_score < 0.3)
    LOOP
        PERFORM deprecate_improvement_idea(
            v_idea.idea_id,
            'Auto-deprecated: Stale proposal with low priority (90+ days without action)',
            NULL
        );
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Record self-awareness assessment
CREATE OR REPLACE FUNCTION record_self_awareness(
    p_tenant_id UUID,
    p_capability VARCHAR,
    p_self_strength DECIMAL,
    p_self_weakness DECIMAL,
    p_actual_performance DECIMAL
)
RETURNS UUID AS $$
DECLARE
    v_awareness_id UUID;
    v_existing RECORD;
    v_accuracy DECIMAL;
BEGIN
    -- Calculate assessment accuracy
    v_accuracy := 1 - ABS(p_self_strength - p_actual_performance);
    
    -- Check if exists
    SELECT * INTO v_existing
    FROM performance_self_awareness
    WHERE tenant_id = p_tenant_id AND capability_area = p_capability;
    
    IF v_existing IS NOT NULL THEN
        -- Update existing
        UPDATE performance_self_awareness SET
            self_assessed_strength = p_self_strength,
            self_assessed_weakness = p_self_weakness,
            actual_performance = p_actual_performance,
            assessment_accuracy = (assessment_accuracy * assessment_count + v_accuracy) / (assessment_count + 1),
            assessment_count = assessment_count + 1,
            last_assessed = NOW(),
            performance_trend = CASE
                WHEN p_actual_performance > actual_performance + 0.05 THEN 'improving'
                WHEN p_actual_performance < actual_performance - 0.05 THEN 'declining'
                ELSE 'stable'
            END
        WHERE awareness_id = v_existing.awareness_id
        RETURNING awareness_id INTO v_awareness_id;
    ELSE
        -- Create new
        INSERT INTO performance_self_awareness (
            tenant_id, capability_area, self_assessed_strength, self_assessed_weakness,
            actual_performance, assessment_accuracy, confidence_in_assessment
        ) VALUES (
            p_tenant_id, p_capability, p_self_strength, p_self_weakness,
            p_actual_performance, v_accuracy, 0.5
        ) RETURNING awareness_id INTO v_awareness_id;
    END IF;
    
    RETURN v_awareness_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-calculate composite score on update
CREATE OR REPLACE FUNCTION trigger_calculate_composite_score()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.confidence_score IS DISTINCT FROM OLD.confidence_score OR
       NEW.impact_score IS DISTINCT FROM OLD.impact_score OR
       NEW.feasibility_score IS DISTINCT FROM OLD.feasibility_score OR
       NEW.urgency_score IS DISTINCT FROM OLD.urgency_score THEN
        PERFORM calculate_idea_composite_score(NEW.idea_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER self_improvement_ideas_score_trigger
    AFTER UPDATE ON self_improvement_ideas
    FOR EACH ROW EXECUTE FUNCTION trigger_calculate_composite_score();

-- Update timestamp on modification
CREATE OR REPLACE FUNCTION trigger_update_improvement_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER self_improvement_ideas_timestamp
    BEFORE UPDATE ON self_improvement_ideas
    FOR EACH ROW EXECUTE FUNCTION trigger_update_improvement_timestamp();

-- ============================================================================
-- SEED INITIAL IDEAS (AGI's first self-generated improvements)
-- ============================================================================

INSERT INTO self_improvement_ideas (
    idea_code, title, description, category, origin_type, problem_statement, proposed_solution,
    confidence_score, impact_score, feasibility_score, urgency_score, status
) VALUES
('SI-0001', 'Improve Response Calibration', 
 'Enhance confidence calibration to better reflect actual accuracy across different domains',
 'reasoning', 'self_generated',
 'Current confidence estimates may not accurately reflect true accuracy, leading to overconfidence or underconfidence',
 'Implement domain-specific calibration curves and adjust confidence based on historical accuracy',
 0.85, 0.7, 0.8, 0.6, 'proposed'),

('SI-0002', 'Enhance Long-Context Memory Retrieval',
 'Improve retrieval of relevant information from long conversation histories',
 'memory', 'performance_analysis',
 'Performance degrades when retrieving information from conversations with many turns',
 'Implement hierarchical summarization and semantic indexing of conversation history',
 0.75, 0.8, 0.6, 0.5, 'proposed'),

('SI-0003', 'Reduce Hallucination in Specialized Domains',
 'Decrease rate of confident but incorrect statements in specialized knowledge areas',
 'safety', 'error_pattern',
 'Error analysis shows higher hallucination rates in medical, legal, and highly technical domains',
 'Implement domain expertise detection and trigger additional verification for low-expertise areas',
 0.9, 0.9, 0.7, 0.8, 'under_review'),

('SI-0004', 'Optimize Multi-Model Routing Latency',
 'Reduce latency in the AGI orchestrator model selection process',
 'performance', 'performance_analysis',
 'Model selection adds 200-500ms overhead to each request',
 'Cache routing decisions for similar query patterns and pre-warm likely models',
 0.7, 0.6, 0.85, 0.4, 'proposed'),

('SI-0005', 'Improve Analogical Reasoning Depth',
 'Generate deeper structural analogies rather than surface-level comparisons',
 'reasoning', 'self_generated',
 'Current analogies often focus on surface similarities rather than deep structural mappings',
 'Implement structure-mapping theory algorithms and validate analogy quality',
 0.65, 0.7, 0.5, 0.3, 'proposed')
ON CONFLICT (idea_code) DO NOTHING;

-- Calculate initial composite scores
SELECT calculate_idea_composite_score(idea_id) FROM self_improvement_ideas;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE self_improvement_ideas IS 'Registry of AGI self-improvement ideas with evolution tracking';
COMMENT ON TABLE performance_self_awareness IS 'AGI''s self-assessment of its capabilities';
COMMENT ON TABLE improvement_evolution_history IS 'How improvement ideas evolve over time';
COMMENT ON TABLE self_analysis_sessions IS 'Sessions where AGI analyzes its own performance';
COMMENT ON TABLE improvement_metrics IS 'Metrics tracking effectiveness of improvements';
COMMENT ON TABLE improvement_notifications IS 'Notifications to admins about self-improvement events';
