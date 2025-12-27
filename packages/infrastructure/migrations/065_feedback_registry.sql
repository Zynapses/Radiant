-- Migration: 065_feedback_registry.sql
-- RADIANT v4.18.0 - Comprehensive Feedback Registry
-- Captures ALL feedback (thumbs, comments, ratings) for continuous learning

-- ============================================================================
-- FEEDBACK REGISTRY - Central store for all feedback
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_registry (
    feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    
    -- What this feedback is for
    target_type VARCHAR(50) NOT NULL, -- 'response', 'conversation', 'think_tank', 'model', 'feature'
    target_id VARCHAR(200) NOT NULL, -- The ID of what's being rated
    
    -- Link to learning interaction (if applicable)
    interaction_id UUID REFERENCES learning_interactions(interaction_id) ON DELETE SET NULL,
    
    -- The feedback itself
    thumbs VARCHAR(10) CHECK (thumbs IN ('up', 'down')),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    
    -- Detailed ratings (optional)
    accuracy_score INTEGER CHECK (accuracy_score BETWEEN 1 AND 5),
    helpfulness_score INTEGER CHECK (helpfulness_score BETWEEN 1 AND 5),
    clarity_score INTEGER CHECK (clarity_score BETWEEN 1 AND 5),
    completeness_score INTEGER CHECK (completeness_score BETWEEN 1 AND 5),
    creativity_score INTEGER CHECK (creativity_score BETWEEN 1 AND 5),
    
    -- What the user did with the response
    user_action VARCHAR(50), -- 'accepted', 'edited', 'rejected', 'regenerated', 'copied', 'shared'
    edited_content TEXT, -- If user edited, what they changed it to
    
    -- Context - Store everything that could help learning
    original_prompt TEXT,
    original_response TEXT,
    model_used VARCHAR(200),
    models_considered TEXT[] DEFAULT '{}',
    workflow_used VARCHAR(100), -- 'single', 'best_of_n', 'synthesis', 'debate', 'think_tank'
    
    -- Quality metrics at time of feedback
    auto_quality_score DECIMAL(5,4),
    confidence_score DECIMAL(5,4),
    latency_ms INTEGER,
    cost_cents DECIMAL(10,6),
    
    -- Tags for categorization
    feedback_tags TEXT[] DEFAULT '{}', -- 'inaccurate', 'too_long', 'too_short', 'off_topic', 'perfect', etc.
    issue_category VARCHAR(100), -- 'factual_error', 'format_issue', 'missing_info', 'wrong_tone', etc.
    
    -- Metadata
    feedback_source VARCHAR(50) DEFAULT 'inline', -- 'inline', 'modal', 'think_tank', 'api', 'email'
    device_type VARCHAR(50),
    session_id VARCHAR(200),
    
    -- Processing status
    processed_for_learning BOOLEAN DEFAULT false,
    learning_batch_id UUID,
    processed_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_registry_tenant ON feedback_registry(tenant_id);
CREATE INDEX idx_feedback_registry_user ON feedback_registry(user_id);
CREATE INDEX idx_feedback_registry_target ON feedback_registry(target_type, target_id);
CREATE INDEX idx_feedback_registry_interaction ON feedback_registry(interaction_id);
CREATE INDEX idx_feedback_registry_thumbs ON feedback_registry(thumbs);
CREATE INDEX idx_feedback_registry_created ON feedback_registry(created_at DESC);
CREATE INDEX idx_feedback_registry_unprocessed ON feedback_registry(processed_for_learning) WHERE processed_for_learning = false;

-- ============================================================================
-- THINK TANK FEEDBACK - Specific feedback for Think Tank conversations
-- ============================================================================

CREATE TABLE IF NOT EXISTS think_tank_feedback (
    feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    message_id UUID, -- Specific message being rated (null = whole conversation)
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    
    -- Feedback
    thumbs VARCHAR(10) CHECK (thumbs IN ('up', 'down')),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    
    -- Per-participant feedback (which AI was best/worst)
    best_participant VARCHAR(200),
    worst_participant VARCHAR(200),
    participant_ratings JSONB DEFAULT '{}', -- {model_id: {rating, comment}}
    
    -- Conversation context
    conversation_topic VARCHAR(500),
    participants TEXT[] DEFAULT '{}',
    message_count INTEGER,
    
    -- The actual content
    message_content TEXT, -- The specific message if rating a message
    full_conversation_snapshot JSONB, -- Snapshot of conversation at feedback time
    
    -- What was the goal and was it achieved
    user_goal TEXT,
    goal_achieved BOOLEAN,
    
    -- Suggestions
    improvement_suggestions TEXT,
    
    -- Processing
    processed_for_learning BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_think_tank_feedback_conversation ON think_tank_feedback(conversation_id);
CREATE INDEX idx_think_tank_feedback_tenant ON think_tank_feedback(tenant_id);
CREATE INDEX idx_think_tank_feedback_thumbs ON think_tank_feedback(thumbs);

-- ============================================================================
-- FEEDBACK AGGREGATES - Pre-computed aggregates for quick access
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_aggregates (
    aggregate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- What this aggregate is for
    aggregate_type VARCHAR(50) NOT NULL, -- 'model', 'workflow', 'feature', 'specialty'
    aggregate_key VARCHAR(200) NOT NULL, -- e.g., model_id, workflow_name
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Time period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    period_type VARCHAR(20) NOT NULL, -- 'hourly', 'daily', 'weekly', 'monthly'
    
    -- Counts
    total_feedback INTEGER DEFAULT 0,
    thumbs_up INTEGER DEFAULT 0,
    thumbs_down INTEGER DEFAULT 0,
    ratings_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    
    -- Averages
    avg_rating DECIMAL(5,4),
    avg_accuracy DECIMAL(5,4),
    avg_helpfulness DECIMAL(5,4),
    avg_clarity DECIMAL(5,4),
    
    -- Sentiment
    positive_ratio DECIMAL(5,4),
    negative_ratio DECIMAL(5,4),
    
    -- Common issues
    top_issues TEXT[] DEFAULT '{}',
    top_tags TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(aggregate_type, aggregate_key, tenant_id, period_start, period_type)
);

CREATE INDEX idx_feedback_aggregates_type ON feedback_aggregates(aggregate_type, aggregate_key);
CREATE INDEX idx_feedback_aggregates_period ON feedback_aggregates(period_start DESC);

-- ============================================================================
-- FEEDBACK TO LEARNING - Track which feedback items trained which models
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_learning_usage (
    usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id UUID REFERENCES feedback_registry(feedback_id) ON DELETE CASCADE,
    
    -- What it was used for
    learning_type VARCHAR(50) NOT NULL, -- 'routing_model', 'quality_model', 'preference_model'
    training_batch_id UUID,
    
    -- Impact
    sample_weight DECIMAL(5,4) DEFAULT 1.0,
    contributed_to_improvement BOOLEAN,
    
    used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_learning_usage_feedback ON feedback_learning_usage(feedback_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Submit feedback with full context
CREATE OR REPLACE FUNCTION submit_feedback(
    p_tenant_id UUID,
    p_user_id UUID,
    p_target_type VARCHAR,
    p_target_id VARCHAR,
    p_thumbs VARCHAR DEFAULT NULL,
    p_rating INTEGER DEFAULT NULL,
    p_comment TEXT DEFAULT NULL,
    p_interaction_id UUID DEFAULT NULL,
    p_original_prompt TEXT DEFAULT NULL,
    p_original_response TEXT DEFAULT NULL,
    p_model_used VARCHAR DEFAULT NULL,
    p_workflow_used VARCHAR DEFAULT NULL,
    p_feedback_tags TEXT[] DEFAULT NULL,
    p_user_action VARCHAR DEFAULT NULL,
    p_session_id VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_feedback_id UUID;
BEGIN
    INSERT INTO feedback_registry (
        tenant_id, user_id, target_type, target_id,
        thumbs, rating, comment, interaction_id,
        original_prompt, original_response, model_used, workflow_used,
        feedback_tags, user_action, session_id
    ) VALUES (
        p_tenant_id, p_user_id, p_target_type, p_target_id,
        p_thumbs, p_rating, p_comment, p_interaction_id,
        p_original_prompt, p_original_response, p_model_used, p_workflow_used,
        COALESCE(p_feedback_tags, '{}'), p_user_action, p_session_id
    )
    RETURNING feedback_id INTO v_feedback_id;
    
    -- Update learning outcome if interaction_id provided
    IF p_interaction_id IS NOT NULL THEN
        UPDATE learning_outcomes SET
            outcome_score = CASE
                WHEN p_thumbs = 'up' THEN GREATEST(COALESCE(outcome_score, 0.5) + 0.2, 1.0)
                WHEN p_thumbs = 'down' THEN LEAST(COALESCE(outcome_score, 0.5) - 0.2, 0.0)
                WHEN p_rating IS NOT NULL THEN (p_rating - 1) / 4.0
                ELSE outcome_score
            END,
            routing_was_optimal = CASE
                WHEN p_thumbs = 'up' OR (p_rating IS NOT NULL AND p_rating >= 4) THEN true
                WHEN p_thumbs = 'down' OR (p_rating IS NOT NULL AND p_rating <= 2) THEN false
                ELSE routing_was_optimal
            END,
            last_updated = NOW()
        WHERE interaction_id = p_interaction_id;
    END IF;
    
    RETURN v_feedback_id;
END;
$$ LANGUAGE plpgsql;

-- Submit Think Tank specific feedback
CREATE OR REPLACE FUNCTION submit_think_tank_feedback(
    p_conversation_id UUID,
    p_tenant_id UUID,
    p_user_id UUID,
    p_thumbs VARCHAR DEFAULT NULL,
    p_rating INTEGER DEFAULT NULL,
    p_comment TEXT DEFAULT NULL,
    p_message_id UUID DEFAULT NULL,
    p_best_participant VARCHAR DEFAULT NULL,
    p_worst_participant VARCHAR DEFAULT NULL,
    p_participant_ratings JSONB DEFAULT NULL,
    p_goal_achieved BOOLEAN DEFAULT NULL,
    p_improvement_suggestions TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_feedback_id UUID;
BEGIN
    INSERT INTO think_tank_feedback (
        conversation_id, tenant_id, user_id, message_id,
        thumbs, rating, comment,
        best_participant, worst_participant, participant_ratings,
        goal_achieved, improvement_suggestions
    ) VALUES (
        p_conversation_id, p_tenant_id, p_user_id, p_message_id,
        p_thumbs, p_rating, p_comment,
        p_best_participant, p_worst_participant, COALESCE(p_participant_ratings, '{}'),
        p_goal_achieved, p_improvement_suggestions
    )
    RETURNING feedback_id INTO v_feedback_id;
    
    -- Also record in main feedback registry
    INSERT INTO feedback_registry (
        tenant_id, user_id, target_type, target_id,
        thumbs, rating, comment, workflow_used,
        feedback_source
    ) VALUES (
        p_tenant_id, p_user_id, 'think_tank', p_conversation_id::VARCHAR,
        p_thumbs, p_rating, p_comment, 'think_tank',
        'think_tank'
    );
    
    RETURN v_feedback_id;
END;
$$ LANGUAGE plpgsql;

-- Aggregate feedback for a time period
CREATE OR REPLACE FUNCTION aggregate_feedback(p_period_type VARCHAR DEFAULT 'daily')
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
    
    -- Aggregate by model
    INSERT INTO feedback_aggregates (
        aggregate_type, aggregate_key, tenant_id, period_start, period_end, period_type,
        total_feedback, thumbs_up, thumbs_down, ratings_count, comments_count,
        avg_rating, positive_ratio
    )
    SELECT 
        'model',
        model_used,
        tenant_id,
        v_period_start,
        v_period_end,
        p_period_type,
        COUNT(*),
        COUNT(*) FILTER (WHERE thumbs = 'up'),
        COUNT(*) FILTER (WHERE thumbs = 'down'),
        COUNT(*) FILTER (WHERE rating IS NOT NULL),
        COUNT(*) FILTER (WHERE comment IS NOT NULL AND comment != ''),
        AVG(rating),
        AVG(CASE WHEN thumbs = 'up' THEN 1.0 WHEN thumbs = 'down' THEN 0.0 ELSE NULL END)
    FROM feedback_registry
    WHERE created_at >= v_period_start AND created_at < v_period_end
      AND model_used IS NOT NULL
    GROUP BY model_used, tenant_id
    ON CONFLICT (aggregate_type, aggregate_key, tenant_id, period_start, period_type) DO UPDATE SET
        total_feedback = EXCLUDED.total_feedback,
        thumbs_up = EXCLUDED.thumbs_up,
        thumbs_down = EXCLUDED.thumbs_down,
        avg_rating = EXCLUDED.avg_rating,
        positive_ratio = EXCLUDED.positive_ratio;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Aggregate by workflow
    INSERT INTO feedback_aggregates (
        aggregate_type, aggregate_key, tenant_id, period_start, period_end, period_type,
        total_feedback, thumbs_up, thumbs_down, avg_rating, positive_ratio
    )
    SELECT 
        'workflow',
        workflow_used,
        tenant_id,
        v_period_start,
        v_period_end,
        p_period_type,
        COUNT(*),
        COUNT(*) FILTER (WHERE thumbs = 'up'),
        COUNT(*) FILTER (WHERE thumbs = 'down'),
        AVG(rating),
        AVG(CASE WHEN thumbs = 'up' THEN 1.0 WHEN thumbs = 'down' THEN 0.0 ELSE NULL END)
    FROM feedback_registry
    WHERE created_at >= v_period_start AND created_at < v_period_end
      AND workflow_used IS NOT NULL
    GROUP BY workflow_used, tenant_id
    ON CONFLICT (aggregate_type, aggregate_key, tenant_id, period_start, period_type) DO UPDATE SET
        total_feedback = EXCLUDED.total_feedback,
        thumbs_up = EXCLUDED.thumbs_up,
        thumbs_down = EXCLUDED.thumbs_down,
        avg_rating = EXCLUDED.avg_rating,
        positive_ratio = EXCLUDED.positive_ratio;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Get feedback stats for learning
CREATE OR REPLACE FUNCTION get_feedback_for_learning(p_limit INTEGER DEFAULT 1000)
RETURNS TABLE (
    feedback_id UUID,
    original_prompt TEXT,
    original_response TEXT,
    model_used VARCHAR,
    workflow_used VARCHAR,
    thumbs VARCHAR,
    rating INTEGER,
    comment TEXT,
    feedback_tags TEXT[],
    is_positive BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fr.feedback_id,
        fr.original_prompt,
        fr.original_response,
        fr.model_used,
        fr.workflow_used,
        fr.thumbs,
        fr.rating,
        fr.comment,
        fr.feedback_tags,
        (fr.thumbs = 'up' OR (fr.rating IS NOT NULL AND fr.rating >= 4)) as is_positive
    FROM feedback_registry fr
    WHERE fr.processed_for_learning = false
      AND fr.original_prompt IS NOT NULL
      AND (fr.thumbs IS NOT NULL OR fr.rating IS NOT NULL)
    ORDER BY fr.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Mark feedback as processed for learning
CREATE OR REPLACE FUNCTION mark_feedback_processed(p_feedback_ids UUID[], p_batch_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE feedback_registry SET
        processed_for_learning = true,
        learning_batch_id = p_batch_id,
        processed_at = NOW()
    WHERE feedback_id = ANY(p_feedback_ids);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE feedback_registry IS 'Central registry for all user feedback (thumbs, ratings, comments)';
COMMENT ON TABLE think_tank_feedback IS 'Specific feedback for Think Tank conversations';
COMMENT ON TABLE feedback_aggregates IS 'Pre-computed feedback aggregates for dashboards';
COMMENT ON TABLE feedback_learning_usage IS 'Tracks which feedback contributed to which training runs';
