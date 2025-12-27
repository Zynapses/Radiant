-- Migration: 064_learning_persistence.sql
-- RADIANT v4.18.0 - Comprehensive Learning Persistence System
-- Captures ALL data needed for continuous learning and improvement

-- ============================================================================
-- CORE INTERACTION LOG - Every AI interaction captured
-- ============================================================================

CREATE TABLE IF NOT EXISTS learning_interactions (
    interaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    session_id VARCHAR(200),
    
    -- Request Details
    request_type VARCHAR(100) NOT NULL, -- 'chat', 'completion', 'embedding', 'image', 'audio', 'think_tank', etc.
    request_source VARCHAR(100), -- 'api', 'sdk', 'admin', 'think_tank', 'autonomous_agent'
    request_text TEXT,
    request_tokens INTEGER,
    request_embedding VECTOR(1536), -- For semantic similarity analysis
    
    -- Context
    detected_specialty VARCHAR(100),
    detected_intent VARCHAR(200),
    detected_complexity VARCHAR(20), -- 'trivial', 'simple', 'moderate', 'complex', 'expert'
    detected_modalities TEXT[] DEFAULT '{}',
    context_metadata JSONB DEFAULT '{}', -- session history, user preferences, etc.
    
    -- Routing Decision
    models_considered TEXT[] DEFAULT '{}',
    model_selected VARCHAR(200) NOT NULL,
    routing_strategy VARCHAR(50),
    routing_reason TEXT,
    routing_confidence DECIMAL(5,4),
    was_fallback BOOLEAN DEFAULT false,
    
    -- Response Details
    response_text TEXT,
    response_tokens INTEGER,
    response_embedding VECTOR(1536),
    
    -- Performance Metrics
    total_latency_ms INTEGER,
    model_latency_ms INTEGER,
    routing_latency_ms INTEGER,
    preprocessing_latency_ms INTEGER,
    postprocessing_latency_ms INTEGER,
    
    -- Cost
    input_cost_cents DECIMAL(10,6),
    output_cost_cents DECIMAL(10,6),
    total_cost_cents DECIMAL(10,6),
    
    -- Quality Assessment (auto-computed)
    auto_quality_score DECIMAL(5,4),
    auto_relevance_score DECIMAL(5,4),
    auto_coherence_score DECIMAL(5,4),
    auto_helpfulness_score DECIMAL(5,4),
    
    -- IRH (Intelligent Request Handler) Features Used
    irh_moral_compass_checked BOOLEAN DEFAULT false,
    irh_moral_approved BOOLEAN,
    irh_moral_reasoning TEXT,
    irh_confidence_calibrated BOOLEAN DEFAULT false,
    irh_calibrated_confidence DECIMAL(5,4),
    irh_context_detected BOOLEAN DEFAULT false,
    irh_adaptations_applied TEXT[] DEFAULT '{}',
    irh_knowledge_queried BOOLEAN DEFAULT false,
    irh_knowledge_used TEXT[] DEFAULT '{}',
    
    -- Error Tracking
    had_error BOOLEAN DEFAULT false,
    error_type VARCHAR(100),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learning_interactions_tenant ON learning_interactions(tenant_id);
CREATE INDEX idx_learning_interactions_user ON learning_interactions(user_id);
CREATE INDEX idx_learning_interactions_session ON learning_interactions(session_id);
CREATE INDEX idx_learning_interactions_created ON learning_interactions(created_at DESC);
CREATE INDEX idx_learning_interactions_model ON learning_interactions(model_selected);
CREATE INDEX idx_learning_interactions_specialty ON learning_interactions(detected_specialty);
CREATE INDEX idx_learning_interactions_type ON learning_interactions(request_type);

-- ============================================================================
-- USER FEEDBACK - Explicit feedback from users
-- ============================================================================

CREATE TABLE IF NOT EXISTS learning_feedback (
    feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interaction_id UUID REFERENCES learning_interactions(interaction_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    
    -- Explicit Feedback
    rating INTEGER CHECK (rating BETWEEN 1 AND 5), -- 1-5 star rating
    thumbs VARCHAR(10) CHECK (thumbs IN ('up', 'down')), -- Simple thumbs up/down
    feedback_text TEXT, -- Written feedback
    feedback_categories TEXT[] DEFAULT '{}', -- 'inaccurate', 'unhelpful', 'too_long', 'perfect', etc.
    
    -- Specific Aspects (optional detailed feedback)
    accuracy_rating INTEGER CHECK (accuracy_rating BETWEEN 1 AND 5),
    helpfulness_rating INTEGER CHECK (helpfulness_rating BETWEEN 1 AND 5),
    clarity_rating INTEGER CHECK (clarity_rating BETWEEN 1 AND 5),
    completeness_rating INTEGER CHECK (completeness_rating BETWEEN 1 AND 5),
    
    -- What user did with the response
    response_action VARCHAR(50), -- 'accepted', 'edited', 'rejected', 'regenerated', 'copied'
    edited_response TEXT, -- If user edited the response
    
    -- Feedback metadata
    feedback_source VARCHAR(50), -- 'inline', 'modal', 'email', 'api'
    time_to_feedback_ms INTEGER, -- How long after response user gave feedback
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learning_feedback_interaction ON learning_feedback(interaction_id);
CREATE INDEX idx_learning_feedback_tenant ON learning_feedback(tenant_id);
CREATE INDEX idx_learning_feedback_user ON learning_feedback(user_id);
CREATE INDEX idx_learning_feedback_rating ON learning_feedback(rating);
CREATE INDEX idx_learning_feedback_thumbs ON learning_feedback(thumbs);

-- ============================================================================
-- IMPLICIT SIGNALS - Behavioral indicators of quality
-- ============================================================================

CREATE TABLE IF NOT EXISTS learning_implicit_signals (
    signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interaction_id UUID REFERENCES learning_interactions(interaction_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    
    -- Time-based signals
    time_reading_response_ms INTEGER, -- How long user spent reading
    time_before_next_action_ms INTEGER, -- Time before next request
    
    -- Action signals
    did_regenerate BOOLEAN DEFAULT false,
    regenerate_count INTEGER DEFAULT 0,
    did_copy_response BOOLEAN DEFAULT false,
    did_share_response BOOLEAN DEFAULT false,
    did_bookmark_response BOOLEAN DEFAULT false,
    
    -- Session signals
    did_continue_session BOOLEAN DEFAULT false,
    did_abandon_session BOOLEAN DEFAULT false,
    messages_after_in_session INTEGER DEFAULT 0,
    
    -- Follow-up signals
    did_ask_followup BOOLEAN DEFAULT false,
    followup_was_clarification BOOLEAN DEFAULT false, -- Asked for clarification = maybe unclear
    followup_was_deeper BOOLEAN DEFAULT false, -- Asked to go deeper = good sign
    
    -- Comparison signals (if A/B testing)
    was_ab_test BOOLEAN DEFAULT false,
    ab_variant VARCHAR(50),
    ab_chosen BOOLEAN,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learning_signals_interaction ON learning_implicit_signals(interaction_id);
CREATE INDEX idx_learning_signals_tenant ON learning_implicit_signals(tenant_id);

-- ============================================================================
-- LEARNING OUTCOMES - Computed labels for training
-- ============================================================================

CREATE TABLE IF NOT EXISTS learning_outcomes (
    outcome_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interaction_id UUID REFERENCES learning_interactions(interaction_id) ON DELETE CASCADE,
    
    -- Computed outcome scores (0-1, computed from feedback + signals)
    outcome_score DECIMAL(5,4), -- Overall computed quality
    routing_was_optimal BOOLEAN, -- Was the right model chosen?
    suggested_better_model VARCHAR(200), -- What model might have been better
    
    -- Ground truth (when available)
    ground_truth_available BOOLEAN DEFAULT false,
    ground_truth_correct BOOLEAN,
    ground_truth_source VARCHAR(100), -- 'human_review', 'test_case', 'user_correction'
    
    -- Training labels
    include_in_training BOOLEAN DEFAULT true,
    training_weight DECIMAL(5,4) DEFAULT 1.0, -- Weight for this sample
    excluded_reason VARCHAR(200),
    
    -- Used in training
    used_in_batch_id UUID,
    used_at TIMESTAMPTZ,
    
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learning_outcomes_interaction ON learning_outcomes(interaction_id);
CREATE INDEX idx_learning_outcomes_score ON learning_outcomes(outcome_score DESC);
CREATE INDEX idx_learning_outcomes_include ON learning_outcomes(include_in_training) WHERE include_in_training = true;

-- ============================================================================
-- MODEL PERFORMANCE TRACKING - Per-model statistics
-- ============================================================================

CREATE TABLE IF NOT EXISTS learning_model_performance (
    performance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(200) NOT NULL,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    specialty VARCHAR(100),
    
    -- Aggregation period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    period_type VARCHAR(20) NOT NULL, -- 'hourly', 'daily', 'weekly'
    
    -- Volume
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    
    -- Quality metrics
    avg_quality_score DECIMAL(5,4),
    avg_user_rating DECIMAL(5,4),
    positive_feedback_ratio DECIMAL(5,4),
    
    -- Performance metrics
    avg_latency_ms INTEGER,
    p50_latency_ms INTEGER,
    p95_latency_ms INTEGER,
    p99_latency_ms INTEGER,
    
    -- Cost metrics
    total_cost_cents DECIMAL(12,4),
    avg_cost_per_request DECIMAL(10,6),
    
    -- Comparison
    vs_average_quality DECIMAL(5,4), -- How this model compares to average
    vs_best_quality DECIMAL(5,4), -- How this model compares to best
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(model_id, tenant_id, specialty, period_start, period_type)
);

CREATE INDEX idx_learning_model_perf_model ON learning_model_performance(model_id);
CREATE INDEX idx_learning_model_perf_period ON learning_model_performance(period_start DESC);
CREATE INDEX idx_learning_model_perf_specialty ON learning_model_performance(specialty);

-- ============================================================================
-- SPECIALTY LEARNING - Learn what models are best for what
-- ============================================================================

CREATE TABLE IF NOT EXISTS learning_specialty_insights (
    insight_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specialty VARCHAR(100) NOT NULL,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Best models for this specialty
    best_model_quality VARCHAR(200), -- Best for quality
    best_model_speed VARCHAR(200), -- Best for speed
    best_model_cost VARCHAR(200), -- Best for cost
    best_model_balanced VARCHAR(200), -- Best overall balance
    
    -- Performance data
    model_rankings JSONB DEFAULT '[]', -- [{model, avg_quality, avg_latency, avg_cost, sample_count}]
    
    -- Patterns
    avg_request_complexity DECIMAL(5,4),
    common_request_patterns TEXT[] DEFAULT '{}',
    common_failure_modes TEXT[] DEFAULT '{}',
    
    -- Recommendations
    recommended_routing_strategy VARCHAR(50),
    recommended_fallback_chain TEXT[] DEFAULT '{}',
    
    samples_analyzed INTEGER DEFAULT 0,
    last_computed TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(specialty, tenant_id)
);

CREATE INDEX idx_learning_specialty_insights ON learning_specialty_insights(specialty);

-- ============================================================================
-- THINK TANK LEARNING - Specific learning for Think Tank conversations
-- ============================================================================

CREATE TABLE IF NOT EXISTS learning_think_tank (
    think_tank_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    
    -- Conversation metadata
    conversation_topic VARCHAR(500),
    participants TEXT[] DEFAULT '{}', -- AI participants
    total_turns INTEGER DEFAULT 0,
    
    -- Quality signals
    user_engagement_score DECIMAL(5,4), -- How engaged was user
    conversation_coherence DECIMAL(5,4), -- How coherent was multi-AI conversation
    goal_achieved BOOLEAN,
    goal_achievement_score DECIMAL(5,4),
    
    -- User feedback
    overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
    feedback_text TEXT,
    
    -- Participant performance
    participant_scores JSONB DEFAULT '{}', -- {model: {quality, helpfulness, relevance}}
    best_contributor VARCHAR(200),
    
    -- Learning insights
    effective_strategies TEXT[] DEFAULT '{}',
    ineffective_strategies TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learning_think_tank_conversation ON learning_think_tank(conversation_id);
CREATE INDEX idx_learning_think_tank_tenant ON learning_think_tank(tenant_id);

-- ============================================================================
-- FEATURE METRICS - Track metrics for all features
-- ============================================================================

CREATE TABLE IF NOT EXISTS learning_feature_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name VARCHAR(200) NOT NULL, -- 'moral_compass', 'confidence_calibration', 'think_tank', etc.
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Time period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Usage metrics
    times_invoked INTEGER DEFAULT 0,
    times_succeeded INTEGER DEFAULT 0,
    times_failed INTEGER DEFAULT 0,
    
    -- Performance
    avg_latency_ms INTEGER,
    total_cost_cents DECIMAL(12,4),
    
    -- Impact metrics
    impact_on_quality DECIMAL(5,4), -- How much this feature improved quality
    user_satisfaction_with_feature DECIMAL(5,4),
    
    -- Feature-specific metrics (flexible JSON)
    custom_metrics JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(feature_name, tenant_id, period_start)
);

CREATE INDEX idx_learning_feature_metrics_feature ON learning_feature_metrics(feature_name);
CREATE INDEX idx_learning_feature_metrics_period ON learning_feature_metrics(period_start DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Record a complete interaction
CREATE OR REPLACE FUNCTION record_learning_interaction(
    p_tenant_id UUID,
    p_user_id UUID,
    p_session_id VARCHAR,
    p_request_type VARCHAR,
    p_request_source VARCHAR,
    p_request_text TEXT,
    p_model_selected VARCHAR,
    p_response_text TEXT,
    p_total_latency_ms INTEGER,
    p_total_cost_cents DECIMAL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_interaction_id UUID;
BEGIN
    INSERT INTO learning_interactions (
        tenant_id, user_id, session_id, request_type, request_source,
        request_text, model_selected, response_text,
        total_latency_ms, total_cost_cents, context_metadata
    ) VALUES (
        p_tenant_id, p_user_id, p_session_id, p_request_type, p_request_source,
        p_request_text, p_model_selected, p_response_text,
        p_total_latency_ms, p_total_cost_cents, p_metadata
    )
    RETURNING interaction_id INTO v_interaction_id;
    
    -- Create empty outcome record for later computation
    INSERT INTO learning_outcomes (interaction_id)
    VALUES (v_interaction_id);
    
    RETURN v_interaction_id;
END;
$$ LANGUAGE plpgsql;

-- Record user feedback
CREATE OR REPLACE FUNCTION record_learning_feedback(
    p_interaction_id UUID,
    p_rating INTEGER DEFAULT NULL,
    p_thumbs VARCHAR DEFAULT NULL,
    p_feedback_text TEXT DEFAULT NULL,
    p_response_action VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_feedback_id UUID;
    v_tenant_id UUID;
    v_user_id UUID;
BEGIN
    -- Get tenant and user from interaction
    SELECT tenant_id, user_id INTO v_tenant_id, v_user_id
    FROM learning_interactions WHERE interaction_id = p_interaction_id;
    
    INSERT INTO learning_feedback (
        interaction_id, tenant_id, user_id, rating, thumbs, feedback_text, response_action
    ) VALUES (
        p_interaction_id, v_tenant_id, v_user_id, p_rating, p_thumbs, p_feedback_text, p_response_action
    )
    RETURNING feedback_id INTO v_feedback_id;
    
    -- Update outcome score based on feedback
    PERFORM compute_learning_outcome(p_interaction_id);
    
    RETURN v_feedback_id;
END;
$$ LANGUAGE plpgsql;

-- Compute learning outcome from feedback and signals
CREATE OR REPLACE FUNCTION compute_learning_outcome(p_interaction_id UUID)
RETURNS VOID AS $$
DECLARE
    v_feedback_score DECIMAL;
    v_signal_score DECIMAL;
    v_auto_score DECIMAL;
    v_final_score DECIMAL;
BEGIN
    -- Get explicit feedback score (if any)
    SELECT 
        COALESCE(
            AVG(CASE 
                WHEN thumbs = 'up' THEN 1.0
                WHEN thumbs = 'down' THEN 0.0
                WHEN rating IS NOT NULL THEN (rating - 1) / 4.0
                ELSE NULL
            END),
            -1 -- No feedback
        )
    INTO v_feedback_score
    FROM learning_feedback WHERE interaction_id = p_interaction_id;
    
    -- Get implicit signal score (if any)
    SELECT 
        CASE 
            WHEN did_regenerate THEN 0.3
            WHEN did_copy_response THEN 0.9
            WHEN did_continue_session THEN 0.7
            WHEN did_abandon_session THEN 0.2
            ELSE 0.5 -- Neutral
        END
    INTO v_signal_score
    FROM learning_implicit_signals WHERE interaction_id = p_interaction_id;
    
    -- Get auto quality score
    SELECT auto_quality_score INTO v_auto_score
    FROM learning_interactions WHERE interaction_id = p_interaction_id;
    
    -- Compute final score (weighted average)
    v_final_score := CASE
        WHEN v_feedback_score >= 0 THEN 
            v_feedback_score * 0.6 + COALESCE(v_signal_score, 0.5) * 0.2 + COALESCE(v_auto_score, 0.5) * 0.2
        ELSE
            COALESCE(v_signal_score, 0.5) * 0.4 + COALESCE(v_auto_score, 0.5) * 0.6
    END;
    
    UPDATE learning_outcomes SET
        outcome_score = v_final_score,
        routing_was_optimal = v_final_score >= 0.7,
        last_updated = NOW()
    WHERE interaction_id = p_interaction_id;
END;
$$ LANGUAGE plpgsql;

-- Aggregate model performance
CREATE OR REPLACE FUNCTION aggregate_model_performance(
    p_period_type VARCHAR DEFAULT 'daily'
)
RETURNS INTEGER AS $$
DECLARE
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
    v_count INTEGER := 0;
BEGIN
    -- Determine period
    IF p_period_type = 'hourly' THEN
        v_period_start := date_trunc('hour', NOW() - INTERVAL '1 hour');
        v_period_end := date_trunc('hour', NOW());
    ELSIF p_period_type = 'daily' THEN
        v_period_start := date_trunc('day', NOW() - INTERVAL '1 day');
        v_period_end := date_trunc('day', NOW());
    ELSE
        v_period_start := date_trunc('week', NOW() - INTERVAL '1 week');
        v_period_end := date_trunc('week', NOW());
    END IF;
    
    INSERT INTO learning_model_performance (
        model_id, tenant_id, specialty, period_start, period_end, period_type,
        total_requests, successful_requests, failed_requests,
        avg_quality_score, avg_latency_ms, total_cost_cents
    )
    SELECT 
        li.model_selected,
        li.tenant_id,
        li.detected_specialty,
        v_period_start,
        v_period_end,
        p_period_type,
        COUNT(*),
        COUNT(*) FILTER (WHERE NOT li.had_error),
        COUNT(*) FILTER (WHERE li.had_error),
        AVG(lo.outcome_score),
        AVG(li.total_latency_ms),
        SUM(li.total_cost_cents)
    FROM learning_interactions li
    LEFT JOIN learning_outcomes lo ON li.interaction_id = lo.interaction_id
    WHERE li.created_at >= v_period_start AND li.created_at < v_period_end
    GROUP BY li.model_selected, li.tenant_id, li.detected_specialty
    ON CONFLICT (model_id, tenant_id, specialty, period_start, period_type) DO UPDATE SET
        total_requests = EXCLUDED.total_requests,
        successful_requests = EXCLUDED.successful_requests,
        failed_requests = EXCLUDED.failed_requests,
        avg_quality_score = EXCLUDED.avg_quality_score,
        avg_latency_ms = EXCLUDED.avg_latency_ms,
        total_cost_cents = EXCLUDED.total_cost_cents;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Update specialty insights
CREATE OR REPLACE FUNCTION update_specialty_insights(p_specialty VARCHAR, p_tenant_id UUID DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    INSERT INTO learning_specialty_insights (specialty, tenant_id, model_rankings, samples_analyzed, last_computed)
    SELECT 
        p_specialty,
        p_tenant_id,
        jsonb_agg(jsonb_build_object(
            'model', model_id,
            'avg_quality', avg_quality_score,
            'avg_latency', avg_latency_ms,
            'total_cost', total_cost_cents,
            'samples', total_requests
        ) ORDER BY avg_quality_score DESC NULLS LAST),
        SUM(total_requests),
        NOW()
    FROM learning_model_performance
    WHERE specialty = p_specialty 
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
      AND period_type = 'daily'
      AND period_start >= NOW() - INTERVAL '30 days'
    GROUP BY specialty
    ON CONFLICT (specialty, tenant_id) DO UPDATE SET
        model_rankings = EXCLUDED.model_rankings,
        samples_analyzed = EXCLUDED.samples_analyzed,
        last_computed = NOW();
    
    -- Update best models
    UPDATE learning_specialty_insights lsi SET
        best_model_quality = (model_rankings->0->>'model'),
        best_model_balanced = (model_rankings->0->>'model')
    WHERE specialty = p_specialty 
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-compute outcomes when feedback is added
CREATE OR REPLACE FUNCTION trigger_compute_outcome()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM compute_learning_outcome(NEW.interaction_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_feedback_compute_outcome
AFTER INSERT ON learning_feedback
FOR EACH ROW EXECUTE FUNCTION trigger_compute_outcome();

CREATE TRIGGER trg_signals_compute_outcome
AFTER INSERT OR UPDATE ON learning_implicit_signals
FOR EACH ROW EXECUTE FUNCTION trigger_compute_outcome();

-- ============================================================================
-- SCHEDULED JOBS (run via pg_cron or external scheduler)
-- ============================================================================

-- Function to run all learning aggregations
CREATE OR REPLACE FUNCTION run_learning_aggregations()
RETURNS JSONB AS $$
DECLARE
    v_hourly INTEGER;
    v_daily INTEGER;
    v_specialties TEXT[];
    v_spec TEXT;
BEGIN
    -- Aggregate hourly
    SELECT aggregate_model_performance('hourly') INTO v_hourly;
    
    -- Aggregate daily (if it's a new day)
    IF EXTRACT(HOUR FROM NOW()) = 0 THEN
        SELECT aggregate_model_performance('daily') INTO v_daily;
        
        -- Update all specialty insights
        SELECT ARRAY_AGG(DISTINCT detected_specialty) INTO v_specialties
        FROM learning_interactions
        WHERE detected_specialty IS NOT NULL;
        
        FOREACH v_spec IN ARRAY COALESCE(v_specialties, ARRAY[]::TEXT[])
        LOOP
            PERFORM update_specialty_insights(v_spec, NULL);
        END LOOP;
    END IF;
    
    RETURN jsonb_build_object(
        'hourly_aggregated', v_hourly,
        'daily_aggregated', COALESCE(v_daily, 0),
        'timestamp', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE learning_interactions IS 'Core table capturing every AI interaction for learning';
COMMENT ON TABLE learning_feedback IS 'Explicit user feedback (ratings, thumbs, comments)';
COMMENT ON TABLE learning_implicit_signals IS 'Implicit behavioral signals indicating quality';
COMMENT ON TABLE learning_outcomes IS 'Computed outcomes combining feedback and signals for training';
COMMENT ON TABLE learning_model_performance IS 'Aggregated per-model performance metrics';
COMMENT ON TABLE learning_specialty_insights IS 'Learned insights about best models per specialty';
COMMENT ON TABLE learning_think_tank IS 'Specific learning data for Think Tank conversations';
COMMENT ON TABLE learning_feature_metrics IS 'Metrics tracking for all system features';
