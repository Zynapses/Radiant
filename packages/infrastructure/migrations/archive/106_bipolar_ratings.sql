-- RADIANT v4.18.19 - Bipolar Rating System Migration
-- Novel rating system allowing negative ratings (-5 to +5)
-- Unlike 5-star where "1 star" is ambiguous, negative explicitly captures dissatisfaction

-- ============================================================================
-- Core Rating Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS bipolar_ratings (
    rating_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- What is being rated
    target_type VARCHAR(30) NOT NULL, -- 'response', 'plan', 'conversation', 'model', 'feature'
    target_id UUID NOT NULL,
    
    -- The rating: -5 to +5
    value SMALLINT NOT NULL CHECK (value >= -5 AND value <= 5),
    dimension VARCHAR(30) NOT NULL DEFAULT 'overall',
    
    -- Derived fields (computed on insert)
    sentiment VARCHAR(10) NOT NULL, -- 'negative', 'neutral', 'positive'
    intensity VARCHAR(10) NOT NULL, -- 'extreme', 'strong', 'mild', 'neutral'
    
    -- Optional context
    reasons JSONB DEFAULT '[]'::jsonb,
    feedback TEXT,
    
    -- Metadata for analysis
    conversation_id UUID,
    session_id UUID,
    model_used VARCHAR(100),
    domain_detected VARCHAR(100),
    prompt_complexity VARCHAR(20),
    response_time_ms INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    
    -- Prevent duplicate ratings for same target/dimension by same user
    CONSTRAINT unique_user_rating UNIQUE (tenant_id, user_id, target_id, dimension)
);

-- Indexes for efficient querying
CREATE INDEX idx_bipolar_ratings_tenant ON bipolar_ratings (tenant_id, created_at DESC);
CREATE INDEX idx_bipolar_ratings_target ON bipolar_ratings (target_type, target_id);
CREATE INDEX idx_bipolar_ratings_user ON bipolar_ratings (tenant_id, user_id, created_at DESC);
CREATE INDEX idx_bipolar_ratings_sentiment ON bipolar_ratings (tenant_id, sentiment, created_at DESC);
CREATE INDEX idx_bipolar_ratings_value ON bipolar_ratings (tenant_id, value);
CREATE INDEX idx_bipolar_ratings_model ON bipolar_ratings (tenant_id, model_used, created_at DESC) WHERE model_used IS NOT NULL;

-- ============================================================================
-- Rating Aggregates (Pre-computed for performance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bipolar_rating_aggregates (
    aggregate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Aggregation period
    period_type VARCHAR(10) NOT NULL, -- 'day', 'week', 'month', 'all'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Optional filters (NULL = all)
    target_type VARCHAR(30),
    model_id VARCHAR(100),
    dimension VARCHAR(30),
    
    -- Core metrics
    total_ratings INTEGER NOT NULL DEFAULT 0,
    average_rating DECIMAL(4,2), -- -5.00 to +5.00
    
    -- Sentiment distribution
    negative_count INTEGER NOT NULL DEFAULT 0,
    neutral_count INTEGER NOT NULL DEFAULT 0,
    positive_count INTEGER NOT NULL DEFAULT 0,
    
    -- Net Sentiment Score: (positive% - negative%) * 100
    -- Ranges from -100 (all negative) to +100 (all positive)
    net_sentiment_score SMALLINT,
    
    -- Distribution by value (-5 to +5)
    rating_distribution JSONB DEFAULT '{}'::jsonb,
    
    -- Top reasons
    top_positive_reasons JSONB DEFAULT '[]'::jsonb,
    top_negative_reasons JSONB DEFAULT '[]'::jsonb,
    
    -- Trend
    trend VARCHAR(20), -- 'improving', 'stable', 'declining'
    trend_percentage DECIMAL(5,2),
    
    -- Timestamps
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_aggregate UNIQUE (tenant_id, period_type, period_start, target_type, model_id, dimension)
);

CREATE INDEX idx_rating_aggregates_tenant ON bipolar_rating_aggregates (tenant_id, period_type, period_start DESC);
CREATE INDEX idx_rating_aggregates_model ON bipolar_rating_aggregates (tenant_id, model_id, period_start DESC) WHERE model_id IS NOT NULL;

-- ============================================================================
-- User Rating Patterns (For calibration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_rating_patterns (
    pattern_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- User's rating tendencies
    average_rating DECIMAL(4,2),
    rating_variance DECIMAL(4,2),
    total_ratings INTEGER NOT NULL DEFAULT 0,
    
    -- Rater type classification
    rater_type VARCHAR(20), -- 'harsh', 'balanced', 'generous'
    
    -- Calibration factor: multiply user's rating by this to normalize
    -- e.g., harsh rater (avg -2) might have factor 1.3 to adjust up
    calibration_factor DECIMAL(4,2) DEFAULT 1.0,
    
    -- Recent behavior
    recent_average DECIMAL(4,2), -- Last 30 days
    recent_count INTEGER DEFAULT 0,
    
    -- Timestamps
    first_rating_at TIMESTAMPTZ,
    last_rating_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_user_pattern UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_user_rating_patterns_tenant ON user_rating_patterns (tenant_id);

-- ============================================================================
-- Model Rating Summary (Per-model performance)
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_rating_summary (
    summary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    model_id VARCHAR(100) NOT NULL,
    model_name VARCHAR(200),
    
    -- Overall metrics
    total_ratings INTEGER NOT NULL DEFAULT 0,
    average_rating DECIMAL(4,2),
    net_sentiment_score SMALLINT,
    
    -- Dimension breakdown
    dimension_averages JSONB DEFAULT '{}'::jsonb,
    
    -- Strengths and weaknesses
    strength_dimensions JSONB DEFAULT '[]'::jsonb,
    weakness_dimensions JSONB DEFAULT '[]'::jsonb,
    
    -- Ranking
    rank_among_models INTEGER,
    percentile DECIMAL(5,2),
    
    -- Trend
    trend VARCHAR(20),
    trend_percentage DECIMAL(5,2),
    
    -- Timestamps
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_model_summary UNIQUE (tenant_id, model_id)
);

CREATE INDEX idx_model_rating_summary_tenant ON model_rating_summary (tenant_id, average_rating DESC);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE bipolar_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bipolar_rating_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rating_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_rating_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY bipolar_ratings_tenant_isolation ON bipolar_ratings
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY bipolar_rating_aggregates_tenant_isolation ON bipolar_rating_aggregates
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY user_rating_patterns_tenant_isolation ON user_rating_patterns
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY model_rating_summary_tenant_isolation ON model_rating_summary
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- Functions
-- ============================================================================

-- Compute sentiment from rating value
CREATE OR REPLACE FUNCTION compute_rating_sentiment(rating_value SMALLINT)
RETURNS VARCHAR(10) AS $$
BEGIN
    IF rating_value < 0 THEN RETURN 'negative';
    ELSIF rating_value > 0 THEN RETURN 'positive';
    ELSE RETURN 'neutral';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Compute intensity from rating value
CREATE OR REPLACE FUNCTION compute_rating_intensity(rating_value SMALLINT)
RETURNS VARCHAR(10) AS $$
DECLARE
    abs_value SMALLINT;
BEGIN
    abs_value := ABS(rating_value);
    IF abs_value = 0 THEN RETURN 'neutral';
    ELSIF abs_value <= 2 THEN RETURN 'mild';
    ELSIF abs_value <= 4 THEN RETURN 'strong';
    ELSE RETURN 'extreme';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Submit a bipolar rating
CREATE OR REPLACE FUNCTION submit_bipolar_rating(
    p_tenant_id UUID,
    p_user_id UUID,
    p_target_type VARCHAR(30),
    p_target_id UUID,
    p_value SMALLINT,
    p_dimension VARCHAR(30) DEFAULT 'overall',
    p_reasons JSONB DEFAULT '[]'::jsonb,
    p_feedback TEXT DEFAULT NULL,
    p_conversation_id UUID DEFAULT NULL,
    p_session_id UUID DEFAULT NULL,
    p_model_used VARCHAR(100) DEFAULT NULL,
    p_domain_detected VARCHAR(100) DEFAULT NULL,
    p_prompt_complexity VARCHAR(20) DEFAULT NULL,
    p_response_time_ms INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_rating_id UUID;
    v_sentiment VARCHAR(10);
    v_intensity VARCHAR(10);
BEGIN
    -- Validate rating value
    IF p_value < -5 OR p_value > 5 THEN
        RAISE EXCEPTION 'Rating value must be between -5 and +5';
    END IF;
    
    -- Compute derived fields
    v_sentiment := compute_rating_sentiment(p_value);
    v_intensity := compute_rating_intensity(p_value);
    
    -- Insert or update rating
    INSERT INTO bipolar_ratings (
        tenant_id, user_id, target_type, target_id,
        value, dimension, sentiment, intensity,
        reasons, feedback,
        conversation_id, session_id, model_used,
        domain_detected, prompt_complexity, response_time_ms
    ) VALUES (
        p_tenant_id, p_user_id, p_target_type, p_target_id,
        p_value, p_dimension, v_sentiment, v_intensity,
        p_reasons, p_feedback,
        p_conversation_id, p_session_id, p_model_used,
        p_domain_detected, p_prompt_complexity, p_response_time_ms
    )
    ON CONFLICT (tenant_id, user_id, target_id, dimension)
    DO UPDATE SET
        value = EXCLUDED.value,
        sentiment = EXCLUDED.sentiment,
        intensity = EXCLUDED.intensity,
        reasons = EXCLUDED.reasons,
        feedback = EXCLUDED.feedback,
        updated_at = NOW()
    RETURNING rating_id INTO v_rating_id;
    
    -- Update user rating pattern
    PERFORM update_user_rating_pattern(p_tenant_id, p_user_id);
    
    RETURN v_rating_id;
END;
$$ LANGUAGE plpgsql;

-- Update user rating pattern after new rating
CREATE OR REPLACE FUNCTION update_user_rating_pattern(
    p_tenant_id UUID,
    p_user_id UUID
) RETURNS VOID AS $$
DECLARE
    v_avg DECIMAL(4,2);
    v_var DECIMAL(4,2);
    v_count INTEGER;
    v_recent_avg DECIMAL(4,2);
    v_recent_count INTEGER;
    v_rater_type VARCHAR(20);
    v_calibration DECIMAL(4,2);
    v_first_at TIMESTAMPTZ;
    v_last_at TIMESTAMPTZ;
BEGIN
    -- Calculate overall stats
    SELECT 
        AVG(value)::DECIMAL(4,2),
        VARIANCE(value)::DECIMAL(4,2),
        COUNT(*),
        MIN(created_at),
        MAX(created_at)
    INTO v_avg, v_var, v_count, v_first_at, v_last_at
    FROM bipolar_ratings
    WHERE tenant_id = p_tenant_id AND user_id = p_user_id;
    
    -- Calculate recent stats (last 30 days)
    SELECT 
        AVG(value)::DECIMAL(4,2),
        COUNT(*)
    INTO v_recent_avg, v_recent_count
    FROM bipolar_ratings
    WHERE tenant_id = p_tenant_id 
      AND user_id = p_user_id
      AND created_at > NOW() - INTERVAL '30 days';
    
    -- Determine rater type
    IF v_avg IS NULL THEN
        v_rater_type := 'balanced';
        v_calibration := 1.0;
    ELSIF v_avg < -1 THEN
        v_rater_type := 'harsh';
        v_calibration := 1.0 + (ABS(v_avg) * 0.1); -- Adjust up
    ELSIF v_avg > 1 THEN
        v_rater_type := 'generous';
        v_calibration := 1.0 - (v_avg * 0.1); -- Adjust down
    ELSE
        v_rater_type := 'balanced';
        v_calibration := 1.0;
    END IF;
    
    -- Clamp calibration factor
    v_calibration := GREATEST(0.5, LEAST(1.5, v_calibration));
    
    -- Upsert pattern
    INSERT INTO user_rating_patterns (
        tenant_id, user_id,
        average_rating, rating_variance, total_ratings,
        rater_type, calibration_factor,
        recent_average, recent_count,
        first_rating_at, last_rating_at
    ) VALUES (
        p_tenant_id, p_user_id,
        v_avg, v_var, v_count,
        v_rater_type, v_calibration,
        v_recent_avg, v_recent_count,
        v_first_at, v_last_at
    )
    ON CONFLICT (tenant_id, user_id)
    DO UPDATE SET
        average_rating = EXCLUDED.average_rating,
        rating_variance = EXCLUDED.rating_variance,
        total_ratings = EXCLUDED.total_ratings,
        rater_type = EXCLUDED.rater_type,
        calibration_factor = EXCLUDED.calibration_factor,
        recent_average = EXCLUDED.recent_average,
        recent_count = EXCLUDED.recent_count,
        last_rating_at = EXCLUDED.last_rating_at,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Calculate Net Sentiment Score for a set of ratings
CREATE OR REPLACE FUNCTION calculate_net_sentiment_score(
    p_tenant_id UUID,
    p_target_type VARCHAR(30) DEFAULT NULL,
    p_model_id VARCHAR(100) DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
) RETURNS SMALLINT AS $$
DECLARE
    v_positive INTEGER;
    v_negative INTEGER;
    v_total INTEGER;
    v_score SMALLINT;
BEGIN
    SELECT 
        COUNT(*) FILTER (WHERE value > 0),
        COUNT(*) FILTER (WHERE value < 0),
        COUNT(*)
    INTO v_positive, v_negative, v_total
    FROM bipolar_ratings
    WHERE tenant_id = p_tenant_id
      AND (p_target_type IS NULL OR target_type = p_target_type)
      AND (p_model_id IS NULL OR model_used = p_model_id)
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date);
    
    IF v_total = 0 THEN
        RETURN 0;
    END IF;
    
    v_score := ROUND(((v_positive - v_negative)::DECIMAL / v_total) * 100)::SMALLINT;
    RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- Get rating analytics for a tenant
CREATE OR REPLACE FUNCTION get_rating_analytics(
    p_tenant_id UUID,
    p_period VARCHAR(10) DEFAULT 'month',
    p_target_type VARCHAR(30) DEFAULT NULL,
    p_model_id VARCHAR(100) DEFAULT NULL
) RETURNS TABLE (
    total_ratings BIGINT,
    average_rating DECIMAL(4,2),
    net_sentiment_score SMALLINT,
    negative_count BIGINT,
    neutral_count BIGINT,
    positive_count BIGINT,
    rating_distribution JSONB
) AS $$
DECLARE
    v_start_date TIMESTAMPTZ;
BEGIN
    -- Determine start date based on period
    v_start_date := CASE p_period
        WHEN 'day' THEN NOW() - INTERVAL '1 day'
        WHEN 'week' THEN NOW() - INTERVAL '7 days'
        WHEN 'month' THEN NOW() - INTERVAL '30 days'
        ELSE '1970-01-01'::TIMESTAMPTZ
    END;
    
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_ratings,
        AVG(r.value)::DECIMAL(4,2) as average_rating,
        calculate_net_sentiment_score(p_tenant_id, p_target_type, p_model_id, v_start_date, NULL) as net_sentiment_score,
        COUNT(*) FILTER (WHERE r.value < 0)::BIGINT as negative_count,
        COUNT(*) FILTER (WHERE r.value = 0)::BIGINT as neutral_count,
        COUNT(*) FILTER (WHERE r.value > 0)::BIGINT as positive_count,
        jsonb_object_agg(
            r.value::TEXT,
            (SELECT COUNT(*) FROM bipolar_ratings r2 
             WHERE r2.tenant_id = p_tenant_id 
               AND r2.value = r.value
               AND (p_target_type IS NULL OR r2.target_type = p_target_type)
               AND (p_model_id IS NULL OR r2.model_used = p_model_id)
               AND r2.created_at >= v_start_date)
        ) as rating_distribution
    FROM bipolar_ratings r
    WHERE r.tenant_id = p_tenant_id
      AND (p_target_type IS NULL OR r.target_type = p_target_type)
      AND (p_model_id IS NULL OR r.model_used = p_model_id)
      AND r.created_at >= v_start_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE bipolar_ratings IS 'Novel rating system with -5 to +5 scale allowing explicit negative feedback';
COMMENT ON COLUMN bipolar_ratings.value IS 'Rating from -5 (harmful) to +5 (exceptional). 0 = neutral.';
COMMENT ON COLUMN bipolar_ratings.sentiment IS 'Derived: negative (<0), neutral (0), positive (>0)';
COMMENT ON COLUMN bipolar_ratings.intensity IS 'Derived: neutral (0), mild (1-2), strong (3-4), extreme (5)';
COMMENT ON TABLE user_rating_patterns IS 'Track user rating tendencies for calibration';
COMMENT ON COLUMN user_rating_patterns.calibration_factor IS 'Multiply ratings by this to normalize harsh/generous raters';
COMMENT ON TABLE model_rating_summary IS 'Per-model rating performance summary';
