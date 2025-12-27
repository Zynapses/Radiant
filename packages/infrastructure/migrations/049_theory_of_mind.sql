-- Migration: 049_theory_of_mind.sql
-- RADIANT v4.18.0 - AGI Enhancement Phase 4: Theory of Mind
-- Model user cognitive state, predict needs, and provide anticipatory assistance

-- ============================================================================
-- USER MENTAL MODELS - Core representation of user cognitive state
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_mental_models (
    model_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Current cognitive state (real-time)
    current_goals JSONB DEFAULT '[]', -- [{goal, priority, progress, context}]
    current_attention JSONB DEFAULT '{}', -- {focus_topic, focus_intensity, distractions}
    current_emotional_state JSONB DEFAULT '{}', -- {valence, arousal, dominant_emotion, triggers}
    current_cognitive_load DECIMAL(3,2) DEFAULT 0.5, -- 0-1 how mentally taxed
    current_context JSONB DEFAULT '{}', -- Task context, environment hints
    
    -- Stable traits (learned over time)
    expertise_domains JSONB DEFAULT '{}', -- {domain: {level, confidence, evidence}}
    communication_style JSONB DEFAULT '{}', -- {verbosity, formality, preferred_format, detail_level}
    cognitive_style JSONB DEFAULT '{}', -- {analytical_intuitive, abstract_concrete, visual_textual}
    learning_style JSONB DEFAULT '{}', -- {examples_first, theory_first, hands_on}
    
    -- Preferences (explicit and inferred)
    explicit_preferences JSONB DEFAULT '{}', -- User-stated preferences
    inferred_preferences JSONB DEFAULT '{}', -- AI-inferred preferences
    preference_confidence JSONB DEFAULT '{}', -- Confidence in each preference
    
    -- Behavioral patterns
    typical_session_duration_mins INTEGER,
    peak_activity_hours INTEGER[] DEFAULT '{}',
    common_tasks JSONB DEFAULT '[]', -- [{task_type, frequency, avg_duration}]
    interaction_patterns JSONB DEFAULT '{}', -- {question_style, feedback_style, iteration_pattern}
    
    -- Frustration and satisfaction triggers
    frustration_triggers JSONB DEFAULT '[]', -- [{trigger, severity, frequency}]
    satisfaction_triggers JSONB DEFAULT '[]', -- [{trigger, intensity, frequency}]
    
    -- Model metadata
    model_version INTEGER DEFAULT 1,
    last_interaction TIMESTAMPTZ,
    total_interactions INTEGER DEFAULT 0,
    model_confidence DECIMAL(5,4) DEFAULT 0.3, -- Overall confidence in the model
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, user_id)
);

ALTER TABLE user_mental_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_mental_models_tenant_isolation ON user_mental_models
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_user_mental_models_tenant ON user_mental_models(tenant_id);
CREATE INDEX idx_user_mental_models_user ON user_mental_models(user_id);
CREATE INDEX idx_user_mental_models_last_interaction ON user_mental_models(last_interaction DESC);

-- ============================================================================
-- USER GOALS - Tracked goals with hierarchy and progress
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_goals (
    goal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Goal identity
    goal_text TEXT NOT NULL,
    goal_embedding vector(1536),
    goal_type VARCHAR(50), -- 'immediate', 'session', 'project', 'long_term'
    
    -- Hierarchy
    parent_goal_id UUID REFERENCES user_goals(goal_id),
    subgoals UUID[] DEFAULT '{}',
    
    -- Context
    context JSONB DEFAULT '{}', -- When/where this goal applies
    prerequisites JSONB DEFAULT '[]', -- What needs to happen first
    
    -- Progress
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'achieved', 'abandoned', 'blocked', 'paused'
    progress DECIMAL(5,2) DEFAULT 0, -- 0-100%
    progress_notes JSONB DEFAULT '[]',
    
    -- Priority and importance
    priority INTEGER DEFAULT 5, -- 1-10
    importance DECIMAL(5,4) DEFAULT 0.5, -- Inferred importance
    urgency DECIMAL(5,4) DEFAULT 0.5, -- Time sensitivity
    
    -- Tracking
    first_mentioned TIMESTAMPTZ DEFAULT NOW(),
    last_mentioned TIMESTAMPTZ DEFAULT NOW(),
    mention_count INTEGER DEFAULT 1,
    estimated_completion TIMESTAMPTZ,
    actual_completion TIMESTAMPTZ,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_goals_tenant_isolation ON user_goals
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_user_goals_tenant_user ON user_goals(tenant_id, user_id);
CREATE INDEX idx_user_goals_status ON user_goals(status);
CREATE INDEX idx_user_goals_active ON user_goals(is_active) WHERE is_active = true;
CREATE INDEX idx_user_goals_embedding ON user_goals 
    USING ivfflat (goal_embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- USER PREDICTIONS - Anticipated needs and behaviors
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_predictions (
    prediction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    session_id UUID,
    
    -- Prediction details
    prediction_type VARCHAR(50) NOT NULL, -- 'next_action', 'need', 'question', 'frustration', 'satisfaction', 'goal_completion'
    prediction_content TEXT NOT NULL,
    prediction_context JSONB DEFAULT '{}',
    
    -- Confidence and reasoning
    confidence DECIMAL(5,4) NOT NULL,
    reasoning JSONB DEFAULT '{}', -- Why this prediction was made
    evidence JSONB DEFAULT '[]', -- Supporting observations
    
    -- Timing
    predicted_timeframe VARCHAR(50), -- 'immediate', 'within_session', 'within_day', 'within_week'
    predicted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Outcome tracking
    outcome_observed BOOLEAN,
    outcome_matched BOOLEAN,
    outcome_notes TEXT,
    outcome_recorded_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_predictions_tenant_isolation ON user_predictions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_user_predictions_tenant_user ON user_predictions(tenant_id, user_id);
CREATE INDEX idx_user_predictions_type ON user_predictions(prediction_type);
CREATE INDEX idx_user_predictions_pending ON user_predictions(outcome_observed) WHERE outcome_observed IS NULL;

-- ============================================================================
-- USER EMOTIONAL HISTORY - Track emotional states over time
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_emotional_history (
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    session_id UUID,
    
    -- Emotional state
    valence DECIMAL(3,2), -- -1 to 1 (negative to positive)
    arousal DECIMAL(3,2), -- 0 to 1 (calm to excited)
    dominant_emotion VARCHAR(50), -- joy, sadness, anger, fear, surprise, disgust, neutral
    secondary_emotions TEXT[] DEFAULT '{}',
    
    -- Context
    trigger_type VARCHAR(50), -- 'message', 'outcome', 'delay', 'error', 'success'
    trigger_content TEXT,
    
    -- Detection
    detection_method VARCHAR(50), -- 'explicit', 'linguistic', 'behavioral', 'inferred'
    detection_confidence DECIMAL(5,4),
    
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_emotional_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_emotional_history_tenant_isolation ON user_emotional_history
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_user_emotional_history_tenant_user ON user_emotional_history(tenant_id, user_id);
CREATE INDEX idx_user_emotional_history_session ON user_emotional_history(session_id);
CREATE INDEX idx_user_emotional_history_time ON user_emotional_history(recorded_at DESC);

-- ============================================================================
-- USER ADAPTATIONS - How we adapt responses for this user
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_adaptations (
    adaptation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Adaptation type
    adaptation_type VARCHAR(50) NOT NULL, -- 'verbosity', 'formality', 'detail_level', 'example_style', 'tone'
    adaptation_name VARCHAR(100) NOT NULL,
    
    -- Adaptation value
    current_value JSONB NOT NULL,
    default_value JSONB NOT NULL,
    
    -- Source
    source VARCHAR(50), -- 'explicit', 'inferred', 'feedback', 'default'
    confidence DECIMAL(5,4) DEFAULT 0.5,
    
    -- Evidence
    supporting_evidence JSONB DEFAULT '[]',
    conflicting_evidence JSONB DEFAULT '[]',
    
    -- Effectiveness
    times_applied INTEGER DEFAULT 0,
    positive_feedback_count INTEGER DEFAULT 0,
    negative_feedback_count INTEGER DEFAULT 0,
    effectiveness_score DECIMAL(5,4),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_adaptations ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_adaptations_tenant_isolation ON user_adaptations
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_user_adaptations_tenant_user ON user_adaptations(tenant_id, user_id);
CREATE INDEX idx_user_adaptations_type ON user_adaptations(adaptation_type);
CREATE INDEX idx_user_adaptations_active ON user_adaptations(is_active) WHERE is_active = true;

-- ============================================================================
-- PROACTIVE SUGGESTIONS - Pre-computed helpful suggestions
-- ============================================================================

CREATE TABLE IF NOT EXISTS proactive_suggestions (
    suggestion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Suggestion details
    suggestion_type VARCHAR(50) NOT NULL, -- 'next_step', 'clarification', 'optimization', 'warning', 'resource', 'tip'
    suggestion_text TEXT NOT NULL,
    suggestion_context JSONB DEFAULT '{}',
    
    -- Relevance
    relevance_score DECIMAL(5,4) NOT NULL,
    relevance_reasons JSONB DEFAULT '[]',
    
    -- Timing
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    best_timing VARCHAR(50), -- 'immediate', 'after_response', 'on_pause', 'session_end'
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'shown', 'accepted', 'rejected', 'expired'
    shown_at TIMESTAMPTZ,
    user_response VARCHAR(20), -- 'accepted', 'rejected', 'ignored'
    response_at TIMESTAMPTZ,
    
    -- Priority
    priority INTEGER DEFAULT 5,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE proactive_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY proactive_suggestions_tenant_isolation ON proactive_suggestions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_proactive_suggestions_tenant_user ON proactive_suggestions(tenant_id, user_id);
CREATE INDEX idx_proactive_suggestions_status ON proactive_suggestions(status);
CREATE INDEX idx_proactive_suggestions_pending ON proactive_suggestions(user_id, status) WHERE status = 'pending';

-- ============================================================================
-- INTERACTION OBSERVATIONS - Raw observations for model building
-- ============================================================================

CREATE TABLE IF NOT EXISTS interaction_observations (
    observation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    session_id UUID,
    
    -- Observation
    observation_type VARCHAR(50) NOT NULL, -- 'preference_signal', 'frustration_signal', 'expertise_signal', 'style_signal'
    observation_key VARCHAR(200) NOT NULL,
    observation_value JSONB NOT NULL,
    
    -- Strength and context
    signal_strength DECIMAL(5,4) DEFAULT 0.5, -- How strong this signal is
    context JSONB DEFAULT '{}',
    
    -- Source
    source_type VARCHAR(50), -- 'message', 'behavior', 'feedback', 'timing'
    source_content TEXT,
    
    -- Processing
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    contributed_to JSONB DEFAULT '[]', -- What model updates this contributed to
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE interaction_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY interaction_observations_tenant_isolation ON interaction_observations
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_interaction_observations_tenant_user ON interaction_observations(tenant_id, user_id);
CREATE INDEX idx_interaction_observations_type ON interaction_observations(observation_type);
CREATE INDEX idx_interaction_observations_unprocessed ON interaction_observations(processed) WHERE processed = false;
CREATE INDEX idx_interaction_observations_time ON interaction_observations(created_at DESC);

-- ============================================================================
-- THEORY OF MIND SETTINGS - Per-tenant configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS theory_of_mind_settings (
    setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Feature toggles
    user_modeling_enabled BOOLEAN DEFAULT true,
    goal_tracking_enabled BOOLEAN DEFAULT true,
    emotional_tracking_enabled BOOLEAN DEFAULT true,
    proactive_suggestions_enabled BOOLEAN DEFAULT true,
    response_adaptation_enabled BOOLEAN DEFAULT true,
    prediction_enabled BOOLEAN DEFAULT true,
    
    -- Model parameters
    model_update_frequency VARCHAR(20) DEFAULT 'per_interaction', -- 'per_interaction', 'per_session', 'daily'
    observation_retention_days INTEGER DEFAULT 90,
    min_observations_for_inference INTEGER DEFAULT 5,
    
    -- Adaptation parameters
    max_verbosity_adaptation DECIMAL(3,2) DEFAULT 0.5, -- How much to adapt verbosity
    max_formality_adaptation DECIMAL(3,2) DEFAULT 0.5,
    adaptation_speed DECIMAL(3,2) DEFAULT 0.3, -- How quickly to adapt (0=slow, 1=immediate)
    
    -- Prediction parameters
    prediction_confidence_threshold DECIMAL(3,2) DEFAULT 0.6, -- Min confidence to surface predictions
    proactive_suggestion_threshold DECIMAL(3,2) DEFAULT 0.7, -- Min relevance to show suggestions
    max_suggestions_per_session INTEGER DEFAULT 5,
    
    -- Privacy
    emotion_detection_consent BOOLEAN DEFAULT true,
    detailed_tracking_consent BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE theory_of_mind_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY theory_of_mind_settings_tenant_isolation ON theory_of_mind_settings
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get or create user mental model
CREATE OR REPLACE FUNCTION get_or_create_user_model(p_tenant_id UUID, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_model_id UUID;
BEGIN
    SELECT model_id INTO v_model_id
    FROM user_mental_models
    WHERE tenant_id = p_tenant_id AND user_id = p_user_id;
    
    IF v_model_id IS NULL THEN
        INSERT INTO user_mental_models (tenant_id, user_id)
        VALUES (p_tenant_id, p_user_id)
        RETURNING model_id INTO v_model_id;
    END IF;
    
    RETURN v_model_id;
END;
$$ LANGUAGE plpgsql;

-- Update user model on interaction
CREATE OR REPLACE FUNCTION update_model_on_interaction(p_tenant_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE user_mental_models SET
        total_interactions = total_interactions + 1,
        last_interaction = NOW(),
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Calculate prediction accuracy
CREATE OR REPLACE FUNCTION calculate_prediction_accuracy(p_tenant_id UUID, p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE(prediction_type VARCHAR, total INTEGER, correct INTEGER, accuracy DECIMAL) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.prediction_type,
        COUNT(*)::INTEGER as total,
        COUNT(*) FILTER (WHERE up.outcome_matched = true)::INTEGER as correct,
        (COUNT(*) FILTER (WHERE up.outcome_matched = true)::DECIMAL / NULLIF(COUNT(*), 0))::DECIMAL(5,4) as accuracy
    FROM user_predictions up
    WHERE up.tenant_id = p_tenant_id 
      AND up.user_id = p_user_id
      AND up.outcome_observed = true
      AND up.created_at > NOW() - (p_days || ' days')::INTERVAL
    GROUP BY up.prediction_type;
END;
$$ LANGUAGE plpgsql;

-- Get active goals for user
CREATE OR REPLACE FUNCTION get_active_user_goals(p_tenant_id UUID, p_user_id UUID)
RETURNS TABLE(goal_id UUID, goal_text TEXT, priority INTEGER, progress DECIMAL, goal_type VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ug.goal_id,
        ug.goal_text,
        ug.priority,
        ug.progress,
        ug.goal_type
    FROM user_goals ug
    WHERE ug.tenant_id = p_tenant_id 
      AND ug.user_id = p_user_id
      AND ug.is_active = true
      AND ug.status = 'active'
    ORDER BY ug.priority DESC, ug.last_mentioned DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_tom_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_mental_models_updated
    BEFORE UPDATE ON user_mental_models
    FOR EACH ROW EXECUTE FUNCTION update_tom_timestamp();

CREATE TRIGGER user_adaptations_updated
    BEFORE UPDATE ON user_adaptations
    FOR EACH ROW EXECUTE FUNCTION update_tom_timestamp();

CREATE TRIGGER theory_of_mind_settings_updated
    BEFORE UPDATE ON theory_of_mind_settings
    FOR EACH ROW EXECUTE FUNCTION update_tom_timestamp();

-- Auto-expire old predictions
CREATE OR REPLACE FUNCTION expire_old_predictions()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_predictions
    SET outcome_observed = true, outcome_matched = false, outcome_notes = 'Expired without observation'
    WHERE expires_at < NOW() AND outcome_observed IS NULL;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DEFAULT SETTINGS
-- ============================================================================

INSERT INTO theory_of_mind_settings (tenant_id)
SELECT tenant_id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_mental_models IS 'Core representation of user cognitive state, preferences, and traits';
COMMENT ON TABLE user_goals IS 'Tracked user goals with hierarchy and progress';
COMMENT ON TABLE user_predictions IS 'Anticipated user needs and behaviors with outcome tracking';
COMMENT ON TABLE user_emotional_history IS 'Historical emotional states for pattern detection';
COMMENT ON TABLE user_adaptations IS 'Per-user response adaptations based on preferences';
COMMENT ON TABLE proactive_suggestions IS 'Pre-computed helpful suggestions for users';
COMMENT ON TABLE interaction_observations IS 'Raw observations for building user models';
COMMENT ON TABLE theory_of_mind_settings IS 'Per-tenant configuration for Theory of Mind features';
