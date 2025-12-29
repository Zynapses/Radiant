-- RADIANT v4.18.0 - Generative UI Feedback & Learning System
-- Enables user feedback on generated UI and AGI brain learning

-- ============================================================================
-- UI FEEDBACK TABLE
-- Stores user feedback on generated UI components
-- ============================================================================

CREATE TABLE IF NOT EXISTS generative_ui_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES generated_apps(id) ON DELETE CASCADE,
    component_id VARCHAR(100), -- Optional, for component-specific feedback
    
    -- Rating
    rating VARCHAR(20) NOT NULL CHECK (rating IN (
        'thumbs_up', 'thumbs_down', 
        'star_1', 'star_2', 'star_3', 'star_4', 'star_5'
    )),
    
    -- Feedback type
    feedback_type VARCHAR(30) NOT NULL CHECK (feedback_type IN (
        'helpful', 'not_helpful', 'wrong_type', 'missing_data',
        'incorrect_data', 'layout_issue', 'functionality',
        'improvement', 'feature_request'
    )),
    
    -- User suggestions
    improvement_suggestion TEXT,
    expected_behavior TEXT,
    
    -- Issues (for negative feedback)
    issues JSONB DEFAULT '[]',
    
    -- Context snapshot
    original_prompt TEXT NOT NULL,
    generated_output JSONB NOT NULL, -- Snapshot of what was generated
    
    -- AGI processing
    agi_processed BOOLEAN DEFAULT FALSE,
    agi_insights JSONB,
    agi_processed_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ui_feedback_tenant ON generative_ui_feedback(tenant_id);
CREATE INDEX idx_ui_feedback_user ON generative_ui_feedback(user_id);
CREATE INDEX idx_ui_feedback_app ON generative_ui_feedback(app_id);
CREATE INDEX idx_ui_feedback_rating ON generative_ui_feedback(rating);
CREATE INDEX idx_ui_feedback_type ON generative_ui_feedback(feedback_type);
CREATE INDEX idx_ui_feedback_unprocessed ON generative_ui_feedback(agi_processed) WHERE agi_processed = FALSE;

-- ============================================================================
-- IMPROVEMENT REQUESTS TABLE
-- User requests to improve generated UI in real-time
-- ============================================================================

CREATE TABLE IF NOT EXISTS ui_improvement_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES generated_apps(id) ON DELETE CASCADE,
    feedback_id UUID REFERENCES generative_ui_feedback(id),
    
    -- Improvement details
    improvement_type VARCHAR(30) NOT NULL CHECK (improvement_type IN (
        'add_component', 'remove_component', 'modify_component',
        'change_layout', 'fix_calculation', 'add_data',
        'change_style', 'add_interactivity', 'simplify',
        'expand', 'regenerate'
    )),
    target_component VARCHAR(100),
    user_instructions TEXT NOT NULL,
    
    -- Before/after states
    before_state JSONB NOT NULL,
    after_state JSONB,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed'
    )),
    
    -- AGI analysis
    agi_analysis JSONB,
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_improvement_tenant ON ui_improvement_requests(tenant_id);
CREATE INDEX idx_improvement_app ON ui_improvement_requests(app_id);
CREATE INDEX idx_improvement_status ON ui_improvement_requests(status);

-- ============================================================================
-- IMPROVEMENT SESSIONS TABLE
-- Live improvement sessions where user collaborates with AGI
-- ============================================================================

CREATE TABLE IF NOT EXISTS ui_improvement_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES generated_apps(id) ON DELETE CASCADE,
    
    -- Session state
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'completed', 'abandoned'
    )),
    
    -- Current state
    current_snapshot JSONB NOT NULL,
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_session_tenant ON ui_improvement_sessions(tenant_id);
CREATE INDEX idx_session_user ON ui_improvement_sessions(user_id);
CREATE INDEX idx_session_active ON ui_improvement_sessions(status) WHERE status = 'active';

-- ============================================================================
-- IMPROVEMENT ITERATIONS TABLE
-- Individual iterations within an improvement session
-- ============================================================================

CREATE TABLE IF NOT EXISTS ui_improvement_iterations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES ui_improvement_sessions(id) ON DELETE CASCADE,
    iteration_number INTEGER NOT NULL,
    
    -- User request
    user_request TEXT NOT NULL,
    
    -- AGI response
    agi_response JSONB NOT NULL, -- { understood, changes, explanation }
    
    -- Result
    applied BOOLEAN DEFAULT FALSE,
    user_satisfied BOOLEAN,
    feedback TEXT,
    
    -- Snapshots
    before_snapshot JSONB NOT NULL,
    after_snapshot JSONB,
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(session_id, iteration_number)
);

CREATE INDEX idx_iteration_session ON ui_improvement_iterations(session_id);

-- ============================================================================
-- UI FEEDBACK LEARNINGS TABLE
-- Aggregated learnings from feedback for AGI improvement
-- ============================================================================

CREATE TABLE IF NOT EXISTS ui_feedback_learnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = global learning
    
    -- What was learned
    learning_type VARCHAR(30) NOT NULL CHECK (learning_type IN (
        'prompt_pattern', 'component_preference', 'data_format',
        'layout_preference', 'calculation_fix'
    )),
    
    -- The pattern/rule
    pattern JSONB NOT NULL, -- { trigger, response, confidence }
    
    -- Evidence
    feedback_ids UUID[] DEFAULT '{}',
    example_count INTEGER DEFAULT 0,
    
    -- Application stats
    applied_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5, 4) DEFAULT 0,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'proposed' CHECK (status IN (
        'proposed', 'approved', 'active', 'deprecated'
    )),
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id)
);

CREATE INDEX idx_learning_tenant ON ui_feedback_learnings(tenant_id);
CREATE INDEX idx_learning_type ON ui_feedback_learnings(learning_type);
CREATE INDEX idx_learning_status ON ui_feedback_learnings(status);
CREATE INDEX idx_learning_active ON ui_feedback_learnings(status) WHERE status = 'active';

-- ============================================================================
-- UI FEEDBACK CONFIG TABLE
-- Per-tenant configuration for feedback system
-- ============================================================================

CREATE TABLE IF NOT EXISTS ui_feedback_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Feedback collection
    collect_feedback BOOLEAN DEFAULT TRUE,
    feedback_prompt_delay INTEGER DEFAULT 5000, -- ms
    show_feedback_on_every_app BOOLEAN DEFAULT FALSE,
    
    -- Improvement features
    enable_real_time_improvement BOOLEAN DEFAULT TRUE,
    max_improvement_iterations INTEGER DEFAULT 5,
    auto_apply_high_confidence_changes BOOLEAN DEFAULT FALSE,
    auto_apply_threshold DECIMAL(3, 2) DEFAULT 0.95,
    
    -- Learning
    enable_agi_learning BOOLEAN DEFAULT TRUE,
    learning_approval_required BOOLEAN DEFAULT TRUE,
    min_feedback_for_learning INTEGER DEFAULT 10,
    
    -- Vision analysis
    enable_vision_analysis BOOLEAN DEFAULT TRUE,
    vision_model VARCHAR(100) DEFAULT 'claude-3-5-sonnet',
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- FEEDBACK AGGREGATES TABLE
-- Pre-computed statistics for dashboard
-- ============================================================================

CREATE TABLE IF NOT EXISTS ui_feedback_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Period
    period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
    period_start DATE NOT NULL,
    
    -- Counts
    total_feedback INTEGER DEFAULT 0,
    positive_feedback INTEGER DEFAULT 0,
    negative_feedback INTEGER DEFAULT 0,
    improvement_requests INTEGER DEFAULT 0,
    improvements_applied INTEGER DEFAULT 0,
    
    -- By type
    feedback_by_type JSONB DEFAULT '{}',
    
    -- Learning stats
    learnings_proposed INTEGER DEFAULT 0,
    learnings_approved INTEGER DEFAULT 0,
    
    -- Satisfaction
    avg_rating DECIMAL(3, 2),
    
    -- Computed at
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, period_type, period_start)
);

CREATE INDEX idx_aggregates_tenant ON ui_feedback_aggregates(tenant_id);
CREATE INDEX idx_aggregates_period ON ui_feedback_aggregates(period_type, period_start);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE generative_ui_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ui_improvement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ui_improvement_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ui_improvement_iterations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ui_feedback_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ui_feedback_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ui_feedback_aggregates ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_tenant_isolation ON generative_ui_feedback
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY improvement_req_tenant_isolation ON ui_improvement_requests
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY session_tenant_isolation ON ui_improvement_sessions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY iteration_tenant_isolation ON ui_improvement_iterations
    FOR ALL USING (session_id IN (
        SELECT id FROM ui_improvement_sessions WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
    ));

CREATE POLICY learning_tenant_isolation ON ui_feedback_learnings
    FOR ALL USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY config_tenant_isolation ON ui_feedback_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY aggregates_tenant_isolation ON ui_feedback_aggregates
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to record feedback
CREATE OR REPLACE FUNCTION record_ui_feedback(
    p_tenant_id UUID,
    p_user_id UUID,
    p_app_id UUID,
    p_rating VARCHAR(20),
    p_feedback_type VARCHAR(30),
    p_original_prompt TEXT,
    p_generated_output JSONB,
    p_component_id VARCHAR(100) DEFAULT NULL,
    p_improvement_suggestion TEXT DEFAULT NULL,
    p_expected_behavior TEXT DEFAULT NULL,
    p_issues JSONB DEFAULT '[]'
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO generative_ui_feedback (
        tenant_id, user_id, app_id, component_id, rating, feedback_type,
        original_prompt, generated_output, improvement_suggestion,
        expected_behavior, issues
    ) VALUES (
        p_tenant_id, p_user_id, p_app_id, p_component_id, p_rating, p_feedback_type,
        p_original_prompt, p_generated_output, p_improvement_suggestion,
        p_expected_behavior, p_issues
    ) RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get feedback stats for an app
CREATE OR REPLACE FUNCTION get_app_feedback_stats(p_app_id UUID)
RETURNS TABLE (
    total_feedback BIGINT,
    positive_count BIGINT,
    negative_count BIGINT,
    avg_star_rating DECIMAL,
    most_common_type VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_feedback,
        COUNT(*) FILTER (WHERE rating = 'thumbs_up' OR rating LIKE 'star_%' AND rating >= 'star_4') as positive_count,
        COUNT(*) FILTER (WHERE rating = 'thumbs_down' OR rating LIKE 'star_%' AND rating <= 'star_2') as negative_count,
        AVG(CASE 
            WHEN rating = 'star_1' THEN 1
            WHEN rating = 'star_2' THEN 2
            WHEN rating = 'star_3' THEN 3
            WHEN rating = 'star_4' THEN 4
            WHEN rating = 'star_5' THEN 5
            ELSE NULL
        END) as avg_star_rating,
        (SELECT feedback_type FROM generative_ui_feedback WHERE app_id = p_app_id 
         GROUP BY feedback_type ORDER BY COUNT(*) DESC LIMIT 1) as most_common_type
    FROM generative_ui_feedback
    WHERE app_id = p_app_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if learning should be triggered
CREATE OR REPLACE FUNCTION check_learning_trigger(
    p_tenant_id UUID,
    p_feedback_type VARCHAR(30)
) RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
    v_threshold INTEGER;
BEGIN
    -- Get threshold from config
    SELECT min_feedback_for_learning INTO v_threshold
    FROM ui_feedback_config
    WHERE tenant_id = p_tenant_id;
    
    v_threshold := COALESCE(v_threshold, 10);
    
    -- Count unprocessed feedback of this type
    SELECT COUNT(*) INTO v_count
    FROM generative_ui_feedback
    WHERE tenant_id = p_tenant_id
      AND feedback_type = p_feedback_type
      AND agi_processed = FALSE;
    
    RETURN v_count >= v_threshold;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update session last_activity_at when iteration is added
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ui_improvement_sessions
    SET last_activity_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_session_activity
    AFTER INSERT ON ui_improvement_iterations
    FOR EACH ROW EXECUTE FUNCTION update_session_activity();

-- Trigger to update aggregates on new feedback
CREATE OR REPLACE FUNCTION update_feedback_aggregates()
RETURNS TRIGGER AS $$
DECLARE
    v_period_start DATE;
BEGIN
    v_period_start := DATE_TRUNC('day', NEW.created_at)::DATE;
    
    INSERT INTO ui_feedback_aggregates (
        tenant_id, period_type, period_start, total_feedback,
        positive_feedback, negative_feedback
    ) VALUES (
        NEW.tenant_id, 'daily', v_period_start, 1,
        CASE WHEN NEW.rating IN ('thumbs_up', 'star_4', 'star_5') THEN 1 ELSE 0 END,
        CASE WHEN NEW.rating IN ('thumbs_down', 'star_1', 'star_2') THEN 1 ELSE 0 END
    )
    ON CONFLICT (tenant_id, period_type, period_start)
    DO UPDATE SET
        total_feedback = ui_feedback_aggregates.total_feedback + 1,
        positive_feedback = ui_feedback_aggregates.positive_feedback + 
            CASE WHEN NEW.rating IN ('thumbs_up', 'star_4', 'star_5') THEN 1 ELSE 0 END,
        negative_feedback = ui_feedback_aggregates.negative_feedback + 
            CASE WHEN NEW.rating IN ('thumbs_down', 'star_1', 'star_2') THEN 1 ELSE 0 END,
        computed_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_feedback_aggregates
    AFTER INSERT ON generative_ui_feedback
    FOR EACH ROW EXECUTE FUNCTION update_feedback_aggregates();
