-- RADIANT v4.18.0 - Enhanced Learning System
-- 8 Learning Improvements for Better User Experience
-- ============================================================================

-- ============================================================================
-- 1. Enhanced Learning Configuration (configurable thresholds & frequency)
-- ============================================================================

CREATE TABLE IF NOT EXISTS enhanced_learning_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Candidate thresholds (was hardcoded 50)
    min_candidates_for_training INTEGER NOT NULL DEFAULT 25,
    min_positive_candidates INTEGER NOT NULL DEFAULT 15,
    min_negative_candidates INTEGER NOT NULL DEFAULT 5,
    
    -- Training frequency (default: daily with auto-optimal time)
    training_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (training_frequency IN ('daily', 'twice_weekly', 'weekly', 'biweekly', 'monthly')),
    training_day_of_week INTEGER DEFAULT 0, -- 0=Sunday for weekly
    training_hour_utc INTEGER DEFAULT NULL, -- NULL = auto-detect optimal time
    
    -- Intelligent scheduling
    auto_optimal_time BOOLEAN NOT NULL DEFAULT true, -- Auto-detect best training time
    optimal_time_last_calculated TIMESTAMPTZ,
    optimal_time_confidence NUMERIC(3,2), -- 0-1 confidence in prediction
    
    -- Feature toggles
    implicit_feedback_enabled BOOLEAN NOT NULL DEFAULT true,
    negative_learning_enabled BOOLEAN NOT NULL DEFAULT true,
    active_learning_enabled BOOLEAN NOT NULL DEFAULT true,
    domain_adapters_enabled BOOLEAN NOT NULL DEFAULT false,
    pattern_caching_enabled BOOLEAN NOT NULL DEFAULT true,
    conversation_learning_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Implicit feedback weights
    copy_signal_weight NUMERIC(3,2) NOT NULL DEFAULT 0.80,
    followup_signal_weight NUMERIC(3,2) NOT NULL DEFAULT 0.30,
    abandon_signal_weight NUMERIC(3,2) NOT NULL DEFAULT 0.70,
    rephrase_signal_weight NUMERIC(3,2) NOT NULL DEFAULT 0.50,
    dwell_time_threshold_seconds INTEGER NOT NULL DEFAULT 30,
    
    -- Active learning settings
    active_learning_probability NUMERIC(3,2) NOT NULL DEFAULT 0.15, -- 15% of responses
    active_learning_uncertainty_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.60,
    
    -- Pattern cache settings
    pattern_cache_ttl_hours INTEGER NOT NULL DEFAULT 168, -- 1 week
    pattern_cache_min_occurrences INTEGER NOT NULL DEFAULT 3,
    pattern_cache_min_rating NUMERIC(3,2) NOT NULL DEFAULT 4.5, -- Min rating to use cache
    pattern_cache_confidence_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.8, -- Min confidence to use
    
    -- Per-user learning
    per_user_learning_enabled BOOLEAN NOT NULL DEFAULT false,
    
    -- Adapter settings
    adapter_auto_selection_enabled BOOLEAN NOT NULL DEFAULT false,
    adapter_rollback_enabled BOOLEAN NOT NULL DEFAULT true,
    adapter_rollback_threshold INTEGER NOT NULL DEFAULT 10, -- % drop to trigger rollback
    
    -- Redis cache
    redis_cache_enabled BOOLEAN NOT NULL DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_tenant_learning_config UNIQUE (tenant_id)
);

CREATE INDEX idx_learning_config_tenant ON enhanced_learning_config(tenant_id);

ALTER TABLE enhanced_learning_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY enhanced_learning_config_tenant_isolation ON enhanced_learning_config
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- 2. Implicit Feedback Signals
-- ============================================================================

CREATE TABLE IF NOT EXISTS implicit_feedback_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    message_id UUID NOT NULL,
    conversation_id UUID,
    
    signal_type TEXT NOT NULL CHECK (signal_type IN (
        'copy_response',           -- User copied the response
        'follow_up_question',      -- User asked a follow-up
        'rephrase_question',       -- User rephrased their question
        'abandon_conversation',    -- User left without resolution
        'long_dwell_time',         -- User spent significant time reading
        'quick_dismiss',           -- User quickly moved on
        'regenerate_request',      -- User asked to regenerate
        'thumbs_up',               -- Inline thumbs up (not full rating)
        'thumbs_down',             -- Inline thumbs down
        'share_response',          -- User shared the response
        'save_response'            -- User saved/bookmarked
    )),
    
    signal_value NUMERIC(5,2), -- Optional numeric value (e.g., dwell time in seconds)
    inferred_quality NUMERIC(3,2) NOT NULL, -- -1.0 to 1.0, inferred quality signal
    confidence NUMERIC(3,2) NOT NULL DEFAULT 0.70,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_implicit_signals_tenant ON implicit_feedback_signals(tenant_id);
CREATE INDEX idx_implicit_signals_message ON implicit_feedback_signals(message_id);
CREATE INDEX idx_implicit_signals_user ON implicit_feedback_signals(tenant_id, user_id);
CREATE INDEX idx_implicit_signals_type ON implicit_feedback_signals(signal_type);
CREATE INDEX idx_implicit_signals_quality ON implicit_feedback_signals(inferred_quality) WHERE inferred_quality > 0.5;

ALTER TABLE implicit_feedback_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY implicit_feedback_signals_tenant_isolation ON implicit_feedback_signals
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- 3. Negative Learning Candidates (contrastive learning)
-- ============================================================================

CREATE TABLE IF NOT EXISTS negative_learning_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- The problematic interaction
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    domain TEXT,
    
    -- Why it's negative
    rating INTEGER CHECK (rating BETWEEN -5 AND 2), -- Negative ratings
    negative_signals TEXT[] DEFAULT '{}', -- List of negative signal types
    user_feedback TEXT, -- Optional user explanation
    
    -- For contrastive learning
    corrected_response TEXT, -- If user provided correction
    error_category TEXT CHECK (error_category IN (
        'factual_error',
        'incomplete_answer', 
        'wrong_tone',
        'too_verbose',
        'too_brief',
        'off_topic',
        'harmful_content',
        'formatting_issue',
        'code_error',
        'unclear_explanation',
        'other'
    )),
    
    -- Processing status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'rejected', 'used_in_training')),
    quality_score NUMERIC(3,2) NOT NULL DEFAULT 0.50,
    
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_negative_candidates_tenant ON negative_learning_candidates(tenant_id);
CREATE INDEX idx_negative_candidates_status ON negative_learning_candidates(status) WHERE status = 'pending';
CREATE INDEX idx_negative_candidates_domain ON negative_learning_candidates(domain);

ALTER TABLE negative_learning_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY negative_learning_candidates_tenant_isolation ON negative_learning_candidates
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- 4. Active Learning Requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS active_learning_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    message_id UUID NOT NULL,
    conversation_id UUID,
    
    -- Why we're asking
    request_reason TEXT NOT NULL CHECK (request_reason IN (
        'high_uncertainty',        -- Model was uncertain
        'new_domain',              -- First time seeing this domain
        'complex_query',           -- Complex multi-part query
        'edge_case',               -- Unusual request pattern
        'random_sample',           -- Random sampling for quality
        'domain_calibration',      -- Calibrating domain-specific adapter
        'after_correction'         -- User just corrected us
    )),
    
    -- The request
    request_type TEXT NOT NULL CHECK (request_type IN (
        'binary_helpful',          -- "Was this helpful? Yes/No"
        'rating_scale',            -- "Rate 1-5"
        'specific_feedback',       -- "What could be improved?"
        'correction_request',      -- "Is this correct?"
        'preference_choice'        -- "Which response is better? A/B"
    )),
    
    prompt_shown TEXT NOT NULL, -- The feedback prompt shown to user
    
    -- Response
    user_responded BOOLEAN DEFAULT false,
    user_response JSONB, -- The actual response
    response_timestamp TIMESTAMPTZ,
    
    -- Metadata
    model_confidence NUMERIC(3,2), -- Model's confidence when generating
    uncertainty_score NUMERIC(3,2),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_active_learning_tenant ON active_learning_requests(tenant_id);
CREATE INDEX idx_active_learning_pending ON active_learning_requests(tenant_id, user_id) 
    WHERE user_responded = false AND expires_at > NOW();
CREATE INDEX idx_active_learning_responded ON active_learning_requests(user_responded) WHERE user_responded = true;

ALTER TABLE active_learning_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY active_learning_requests_tenant_isolation ON active_learning_requests
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- 5. Domain-Specific LoRA Adapters
-- ============================================================================

CREATE TABLE IF NOT EXISTS domain_lora_adapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Domain identification
    domain TEXT NOT NULL, -- e.g., 'medical', 'legal', 'code', 'creative'
    subdomain TEXT, -- e.g., 'cardiology', 'contract_law', 'python'
    
    -- Adapter info
    adapter_name TEXT NOT NULL,
    base_model TEXT NOT NULL, -- e.g., 'llama-3-8b'
    adapter_version INTEGER NOT NULL DEFAULT 1,
    
    -- S3 location
    s3_bucket TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    adapter_size_bytes BIGINT,
    
    -- Training info
    training_candidates_count INTEGER NOT NULL DEFAULT 0,
    last_training_job_id TEXT,
    last_trained_at TIMESTAMPTZ,
    
    -- Performance metrics
    accuracy_score NUMERIC(4,3),
    domain_relevance_score NUMERIC(4,3),
    user_satisfaction_score NUMERIC(4,3),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'training' CHECK (status IN ('training', 'validating', 'active', 'deprecated', 'failed')),
    is_default BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_tenant_domain_adapter UNIQUE (tenant_id, domain, subdomain, adapter_version)
);

CREATE INDEX idx_domain_adapters_tenant ON domain_lora_adapters(tenant_id);
CREATE INDEX idx_domain_adapters_domain ON domain_lora_adapters(domain, subdomain);
CREATE INDEX idx_domain_adapters_active ON domain_lora_adapters(tenant_id, domain) WHERE status = 'active';

ALTER TABLE domain_lora_adapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY domain_lora_adapters_tenant_isolation ON domain_lora_adapters
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Domain adapter training queue
CREATE TABLE IF NOT EXISTS domain_adapter_training_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    subdomain TEXT,
    
    -- Candidates waiting
    positive_candidates_count INTEGER NOT NULL DEFAULT 0,
    negative_candidates_count INTEGER NOT NULL DEFAULT 0,
    
    -- Thresholds
    min_candidates_required INTEGER NOT NULL DEFAULT 25,
    
    -- Status
    ready_for_training BOOLEAN GENERATED ALWAYS AS (
        positive_candidates_count >= min_candidates_required
    ) STORED,
    
    last_checked_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_domain_queue UNIQUE (tenant_id, domain, subdomain)
);

ALTER TABLE domain_adapter_training_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY domain_adapter_training_queue_tenant_isolation ON domain_adapter_training_queue
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- 6. Real-Time Pattern Cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS successful_pattern_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Pattern identification
    prompt_hash TEXT NOT NULL, -- Hash of normalized prompt
    prompt_embedding vector(1536), -- For semantic matching
    domain TEXT,
    
    -- The successful pattern
    normalized_prompt TEXT NOT NULL,
    successful_response TEXT NOT NULL,
    response_metadata JSONB DEFAULT '{}',
    
    -- Quality signals
    average_rating NUMERIC(3,2) NOT NULL,
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    positive_signal_count INTEGER NOT NULL DEFAULT 0,
    
    -- Model info
    model_used TEXT,
    temperature_used NUMERIC(3,2),
    
    -- Cache management
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    cache_hits INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_pattern_hash UNIQUE (tenant_id, prompt_hash)
);

CREATE INDEX idx_pattern_cache_tenant ON successful_pattern_cache(tenant_id);
CREATE INDEX idx_pattern_cache_hash ON successful_pattern_cache(prompt_hash);
CREATE INDEX idx_pattern_cache_domain ON successful_pattern_cache(tenant_id, domain);
CREATE INDEX idx_pattern_cache_expires ON successful_pattern_cache(expires_at);
CREATE INDEX idx_pattern_cache_embedding ON successful_pattern_cache USING ivfflat (prompt_embedding vector_cosine_ops);

ALTER TABLE successful_pattern_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY successful_pattern_cache_tenant_isolation ON successful_pattern_cache
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- 7. Conversation-Level Learning
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversation_learning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    
    -- Conversation summary
    message_count INTEGER NOT NULL,
    total_tokens INTEGER,
    domains_discussed TEXT[] DEFAULT '{}',
    
    -- Outcome signals
    conversation_rating INTEGER CHECK (conversation_rating BETWEEN -5 AND 5),
    goal_achieved BOOLEAN,
    user_satisfaction_inferred NUMERIC(3,2), -- -1 to 1
    
    -- Signals aggregated from messages
    positive_signals_count INTEGER NOT NULL DEFAULT 0,
    negative_signals_count INTEGER NOT NULL DEFAULT 0,
    corrections_count INTEGER NOT NULL DEFAULT 0,
    regenerations_count INTEGER NOT NULL DEFAULT 0,
    
    -- Learning value
    learning_value_score NUMERIC(3,2), -- How valuable for training
    selected_for_training BOOLEAN DEFAULT false,
    
    -- Key interactions to learn from
    best_interaction_ids UUID[] DEFAULT '{}',
    worst_interaction_ids UUID[] DEFAULT '{}',
    
    -- Timing
    conversation_start TIMESTAMPTZ NOT NULL,
    conversation_end TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversation_learning_tenant ON conversation_learning(tenant_id);
CREATE INDEX idx_conversation_learning_conv ON conversation_learning(conversation_id);
CREATE INDEX idx_conversation_learning_value ON conversation_learning(learning_value_score DESC) 
    WHERE learning_value_score > 0.7;
CREATE INDEX idx_conversation_learning_training ON conversation_learning(selected_for_training) 
    WHERE selected_for_training = true;

ALTER TABLE conversation_learning ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversation_learning_tenant_isolation ON conversation_learning
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- 8. Learning Analytics & Metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS learning_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Candidate counts
    positive_candidates_created INTEGER NOT NULL DEFAULT 0,
    negative_candidates_created INTEGER NOT NULL DEFAULT 0,
    implicit_signals_captured INTEGER NOT NULL DEFAULT 0,
    
    -- Active learning
    active_learning_requests_sent INTEGER NOT NULL DEFAULT 0,
    active_learning_responses_received INTEGER NOT NULL DEFAULT 0,
    active_learning_response_rate NUMERIC(4,3),
    
    -- Pattern cache
    pattern_cache_hits INTEGER NOT NULL DEFAULT 0,
    pattern_cache_misses INTEGER NOT NULL DEFAULT 0,
    pattern_cache_hit_rate NUMERIC(4,3),
    
    -- Training
    training_jobs_completed INTEGER NOT NULL DEFAULT 0,
    candidates_used_in_training INTEGER NOT NULL DEFAULT 0,
    
    -- Quality improvements
    avg_rating_before NUMERIC(3,2),
    avg_rating_after NUMERIC(3,2),
    rating_improvement NUMERIC(4,3),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_learning_analytics_period UNIQUE (tenant_id, period_start)
);

CREATE INDEX idx_learning_analytics_tenant ON learning_analytics(tenant_id);
CREATE INDEX idx_learning_analytics_period ON learning_analytics(period_start DESC);

ALTER TABLE learning_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY learning_analytics_tenant_isolation ON learning_analytics
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- Functions
-- ============================================================================

-- Calculate inferred quality from implicit signals
CREATE OR REPLACE FUNCTION calculate_inferred_quality(
    p_tenant_id UUID,
    p_message_id UUID
) RETURNS NUMERIC AS $$
DECLARE
    v_config enhanced_learning_config%ROWTYPE;
    v_quality NUMERIC := 0;
    v_signal_count INTEGER := 0;
BEGIN
    SELECT * INTO v_config FROM enhanced_learning_config WHERE tenant_id = p_tenant_id;
    
    IF NOT FOUND THEN
        RETURN 0.5; -- Default neutral
    END IF;
    
    SELECT 
        SUM(
            CASE signal_type
                WHEN 'copy_response' THEN v_config.copy_signal_weight
                WHEN 'follow_up_question' THEN v_config.followup_signal_weight
                WHEN 'abandon_conversation' THEN -v_config.abandon_signal_weight
                WHEN 'rephrase_question' THEN -v_config.rephrase_signal_weight
                WHEN 'thumbs_up' THEN 0.9
                WHEN 'thumbs_down' THEN -0.9
                WHEN 'share_response' THEN 0.85
                WHEN 'save_response' THEN 0.80
                WHEN 'regenerate_request' THEN -0.6
                WHEN 'quick_dismiss' THEN -0.4
                WHEN 'long_dwell_time' THEN 0.3
                ELSE 0
            END
        ),
        COUNT(*)
    INTO v_quality, v_signal_count
    FROM implicit_feedback_signals
    WHERE tenant_id = p_tenant_id AND message_id = p_message_id;
    
    IF v_signal_count = 0 THEN
        RETURN 0.5;
    END IF;
    
    -- Normalize to 0-1 range
    RETURN GREATEST(0, LEAST(1, (v_quality / v_signal_count + 1) / 2));
END;
$$ LANGUAGE plpgsql;

-- Check if conversation is valuable for learning
CREATE OR REPLACE FUNCTION assess_conversation_learning_value(
    p_tenant_id UUID,
    p_conversation_id UUID
) RETURNS NUMERIC AS $$
DECLARE
    v_value NUMERIC := 0.5;
    v_conv conversation_learning%ROWTYPE;
BEGIN
    SELECT * INTO v_conv FROM conversation_learning 
    WHERE tenant_id = p_tenant_id AND conversation_id = p_conversation_id;
    
    IF NOT FOUND THEN
        RETURN 0.5;
    END IF;
    
    -- Start with rating if available
    IF v_conv.conversation_rating IS NOT NULL THEN
        v_value := (v_conv.conversation_rating + 5) / 10.0;
    END IF;
    
    -- Boost for corrections (valuable learning)
    IF v_conv.corrections_count > 0 THEN
        v_value := v_value + 0.15;
    END IF;
    
    -- Boost for goal achieved
    IF v_conv.goal_achieved THEN
        v_value := v_value + 0.1;
    END IF;
    
    -- Penalize for many regenerations
    IF v_conv.regenerations_count > 2 THEN
        v_value := v_value - 0.1;
    END IF;
    
    -- Consider signal ratio
    IF (v_conv.positive_signals_count + v_conv.negative_signals_count) > 0 THEN
        v_value := v_value + 0.2 * (
            v_conv.positive_signals_count::NUMERIC / 
            (v_conv.positive_signals_count + v_conv.negative_signals_count)
        ) - 0.1;
    END IF;
    
    RETURN GREATEST(0, LEAST(1, v_value));
END;
$$ LANGUAGE plpgsql;

-- Initialize default config for tenant
CREATE OR REPLACE FUNCTION initialize_enhanced_learning_config(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO enhanced_learning_config (tenant_id)
    VALUES (p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. Hourly Activity Tracking (for optimal training time prediction)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hourly_activity_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Time bucket
    hour_utc INTEGER NOT NULL CHECK (hour_utc >= 0 AND hour_utc <= 23),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
    
    -- Activity metrics (aggregated over rolling 30 days)
    avg_requests_per_hour NUMERIC(10,2) NOT NULL DEFAULT 0,
    avg_tokens_per_hour BIGINT NOT NULL DEFAULT 0,
    avg_active_users INTEGER NOT NULL DEFAULT 0,
    sample_count INTEGER NOT NULL DEFAULT 0, -- Number of days in aggregate
    
    -- Derived metrics
    activity_score NUMERIC(5,2) NOT NULL DEFAULT 0, -- 0-100, higher = more active
    is_low_activity_window BOOLEAN GENERATED ALWAYS AS (activity_score < 20) STORED,
    
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_tenant_hour_day UNIQUE (tenant_id, hour_utc, day_of_week)
);

CREATE INDEX idx_hourly_activity_tenant ON hourly_activity_stats(tenant_id);
CREATE INDEX idx_hourly_activity_low ON hourly_activity_stats(tenant_id, is_low_activity_window) 
    WHERE is_low_activity_window = true;

ALTER TABLE hourly_activity_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY hourly_activity_stats_tenant_isolation ON hourly_activity_stats
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Predict optimal training time for a tenant
CREATE OR REPLACE FUNCTION predict_optimal_training_time(p_tenant_id UUID)
RETURNS TABLE (
    optimal_hour_utc INTEGER,
    optimal_day_of_week INTEGER,
    activity_score NUMERIC,
    confidence NUMERIC,
    recommendation TEXT
) AS $$
DECLARE
    v_sample_count INTEGER;
    v_min_activity NUMERIC;
    v_avg_activity NUMERIC;
BEGIN
    -- Check if we have enough data
    SELECT COUNT(*), MIN(has.activity_score), AVG(has.activity_score)
    INTO v_sample_count, v_min_activity, v_avg_activity
    FROM hourly_activity_stats has
    WHERE has.tenant_id = p_tenant_id AND has.sample_count >= 7;
    
    -- Not enough data - return default (3 AM UTC)
    IF v_sample_count < 24 THEN
        RETURN QUERY SELECT 
            3::INTEGER AS optimal_hour_utc,
            -1::INTEGER AS optimal_day_of_week, -- -1 = any day
            0::NUMERIC AS activity_score,
            0.1::NUMERIC AS confidence,
            'Insufficient data (< 7 days). Using default 3 AM UTC.'::TEXT AS recommendation;
        RETURN;
    END IF;
    
    -- Find the hour with lowest activity
    RETURN QUERY
    SELECT 
        has.hour_utc AS optimal_hour_utc,
        CASE 
            WHEN MIN(has.activity_score) = MAX(has.activity_score) THEN -1 -- Same all days
            ELSE (SELECT has2.day_of_week FROM hourly_activity_stats has2 
                  WHERE has2.tenant_id = p_tenant_id AND has2.hour_utc = has.hour_utc
                  ORDER BY has2.activity_score ASC LIMIT 1)
        END AS optimal_day_of_week,
        MIN(has.activity_score) AS activity_score,
        CASE 
            WHEN v_sample_count >= 168 THEN 0.95 -- Full week of hourly data
            WHEN v_sample_count >= 72 THEN 0.80  -- 3+ days
            WHEN v_sample_count >= 24 THEN 0.60  -- 1+ day
            ELSE 0.40
        END::NUMERIC AS confidence,
        'Predicted based on ' || v_sample_count || ' hourly samples. Activity score ' || 
        ROUND(MIN(has.activity_score), 1) || '% vs avg ' || ROUND(v_avg_activity, 1) || '%.'::TEXT AS recommendation
    FROM hourly_activity_stats has
    WHERE has.tenant_id = p_tenant_id
    GROUP BY has.hour_utc
    ORDER BY MIN(has.activity_score) ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Update hourly activity stats from usage data
CREATE OR REPLACE FUNCTION update_hourly_activity_stats(
    p_tenant_id UUID,
    p_hour_utc INTEGER,
    p_day_of_week INTEGER,
    p_requests INTEGER,
    p_tokens BIGINT,
    p_active_users INTEGER
) RETURNS void AS $$
BEGIN
    INSERT INTO hourly_activity_stats (
        tenant_id, hour_utc, day_of_week, 
        avg_requests_per_hour, avg_tokens_per_hour, avg_active_users, 
        sample_count, activity_score
    )
    VALUES (
        p_tenant_id, p_hour_utc, p_day_of_week,
        p_requests, p_tokens, p_active_users,
        1,
        -- Activity score: normalize requests to 0-100 scale
        LEAST(100, (p_requests::NUMERIC / GREATEST(1, p_active_users)) * 10)
    )
    ON CONFLICT (tenant_id, hour_utc, day_of_week) DO UPDATE SET
        avg_requests_per_hour = (
            hourly_activity_stats.avg_requests_per_hour * hourly_activity_stats.sample_count + p_requests
        ) / (hourly_activity_stats.sample_count + 1),
        avg_tokens_per_hour = (
            hourly_activity_stats.avg_tokens_per_hour * hourly_activity_stats.sample_count + p_tokens
        ) / (hourly_activity_stats.sample_count + 1),
        avg_active_users = (
            hourly_activity_stats.avg_active_users * hourly_activity_stats.sample_count + p_active_users
        ) / (hourly_activity_stats.sample_count + 1),
        sample_count = LEAST(30, hourly_activity_stats.sample_count + 1), -- Cap at 30 days rolling
        activity_score = LEAST(100, (
            (hourly_activity_stats.avg_requests_per_hour * hourly_activity_stats.sample_count + p_requests) /
            (hourly_activity_stats.sample_count + 1)
        )::NUMERIC / GREATEST(1, (
            (hourly_activity_stats.avg_active_users * hourly_activity_stats.sample_count + p_active_users) /
            (hourly_activity_stats.sample_count + 1)
        )) * 10),
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-initialize learning config for new tenants
CREATE OR REPLACE FUNCTION trigger_init_learning_config()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM initialize_enhanced_learning_config(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS init_learning_config_on_tenant ON tenants;
CREATE TRIGGER init_learning_config_on_tenant
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION trigger_init_learning_config();

-- Update conversation learning value on signal insert
CREATE OR REPLACE FUNCTION trigger_update_conversation_learning()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.conversation_id IS NOT NULL THEN
        UPDATE conversation_learning
        SET 
            learning_value_score = assess_conversation_learning_value(NEW.tenant_id, NEW.conversation_id),
            positive_signals_count = positive_signals_count + CASE WHEN NEW.inferred_quality > 0.5 THEN 1 ELSE 0 END,
            negative_signals_count = negative_signals_count + CASE WHEN NEW.inferred_quality < 0.5 THEN 1 ELSE 0 END
        WHERE tenant_id = NEW.tenant_id AND conversation_id = NEW.conversation_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_conversation_learning_on_signal ON implicit_feedback_signals;
CREATE TRIGGER update_conversation_learning_on_signal
    AFTER INSERT ON implicit_feedback_signals
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_conversation_learning();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE enhanced_learning_config IS 'Per-tenant configuration for all 8 enhanced learning features';
COMMENT ON TABLE implicit_feedback_signals IS 'Captures implicit user signals (copy, follow-up, abandon, etc.)';
COMMENT ON TABLE negative_learning_candidates IS 'Stores negative examples for contrastive learning';
COMMENT ON TABLE active_learning_requests IS 'Tracks proactive feedback requests sent to users';
COMMENT ON TABLE domain_lora_adapters IS 'Domain-specific LoRA adapters (medical, legal, code, etc.)';
COMMENT ON TABLE successful_pattern_cache IS 'Redis-backed cache of successful prompt→response patterns';
COMMENT ON TABLE conversation_learning IS 'Aggregates learning signals at conversation level';
COMMENT ON TABLE learning_analytics IS 'Analytics and metrics for the learning system';
