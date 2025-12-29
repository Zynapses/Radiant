-- Migration: 083_provider_rejection_handling
-- Description: Track provider/model rejections and enable intelligent fallback
-- When a provider rejects a prompt based on their ethics (not ours), try another model
-- If no models available, reject with explanation to user
-- Author: RADIANT System
-- Date: 2024-12-28

-- ============================================================================
-- Provider Rejection Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_rejections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Request context
    plan_id UUID,  -- AGI Brain plan if applicable
    session_id UUID,
    prompt_hash VARCHAR(64),  -- Hash of prompt for pattern detection
    
    -- Model that rejected
    model_id VARCHAR(100) NOT NULL,
    provider_id VARCHAR(50) NOT NULL,
    hosting_type VARCHAR(20) NOT NULL DEFAULT 'external',  -- external, self_hosted
    
    -- Rejection details
    rejection_type VARCHAR(50) NOT NULL,
    -- Types: content_policy, safety_filter, rate_limit, capability_mismatch, 
    --        provider_ethics, context_length, moderation, unknown
    
    rejection_code VARCHAR(100),  -- Provider-specific error code
    rejection_message TEXT,       -- Raw error message from provider
    rejection_category VARCHAR(50),  -- Categorized reason
    
    -- Our ethics check
    radiant_ethics_passed BOOLEAN NOT NULL DEFAULT true,  -- Did it pass OUR ethics?
    radiant_ethics_score NUMERIC(4,3),
    
    -- Fallback tracking
    fallback_attempted BOOLEAN NOT NULL DEFAULT false,
    fallback_model_id VARCHAR(100),
    fallback_succeeded BOOLEAN,
    fallback_chain JSONB DEFAULT '[]',  -- Array of attempted models
    
    -- Final outcome
    final_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Status: pending, fallback_success, rejected, user_modified, admin_override
    
    final_response_to_user TEXT,  -- Explanation shown to user
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- ============================================================================
-- Rejection Patterns - Learn which prompts get rejected by which providers
-- ============================================================================

CREATE TABLE IF NOT EXISTS rejection_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Pattern identification
    pattern_hash VARCHAR(64) NOT NULL,  -- Hash of rejection characteristics
    pattern_type VARCHAR(50) NOT NULL,  -- keyword, topic, format, length, etc.
    
    -- What triggers rejection
    trigger_keywords TEXT[],
    trigger_topics TEXT[],
    trigger_model_ids TEXT[],
    trigger_provider_ids TEXT[],
    
    -- Statistics
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Recommendations
    recommended_fallback_models TEXT[],
    avoid_models TEXT[],
    success_rate NUMERIC(5,4),
    
    -- Metadata
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- User Rejection History - Show users their rejection history
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_rejection_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rejection_id UUID NOT NULL REFERENCES provider_rejections(id) ON DELETE CASCADE,
    
    -- Notification content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    detailed_reason TEXT,
    
    -- What the user can do
    suggested_actions JSONB DEFAULT '[]',
    -- e.g., [{"action": "rephrase", "description": "Try rephrasing..."}, {"action": "contact_admin", ...}]
    
    -- Status
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_dismissed BOOLEAN NOT NULL DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ
);

-- ============================================================================
-- Model Rejection Stats - Track which models reject most often
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_rejection_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(100) NOT NULL UNIQUE,
    provider_id VARCHAR(50) NOT NULL,
    
    -- Counts
    total_requests INTEGER NOT NULL DEFAULT 0,
    total_rejections INTEGER NOT NULL DEFAULT 0,
    rejection_rate NUMERIC(5,4) GENERATED ALWAYS AS (
        CASE WHEN total_requests > 0 
            THEN total_rejections::NUMERIC / total_requests 
            ELSE 0 
        END
    ) STORED,
    
    -- By rejection type
    content_policy_count INTEGER NOT NULL DEFAULT 0,
    safety_filter_count INTEGER NOT NULL DEFAULT 0,
    provider_ethics_count INTEGER NOT NULL DEFAULT 0,
    other_count INTEGER NOT NULL DEFAULT 0,
    
    -- Fallback success
    fallback_attempts INTEGER NOT NULL DEFAULT 0,
    fallback_successes INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    last_rejection_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_provider_rejections_tenant ON provider_rejections(tenant_id);
CREATE INDEX idx_provider_rejections_user ON provider_rejections(user_id);
CREATE INDEX idx_provider_rejections_plan ON provider_rejections(plan_id);
CREATE INDEX idx_provider_rejections_model ON provider_rejections(model_id);
CREATE INDEX idx_provider_rejections_type ON provider_rejections(rejection_type);
CREATE INDEX idx_provider_rejections_status ON provider_rejections(final_status);
CREATE INDEX idx_provider_rejections_created ON provider_rejections(created_at DESC);

CREATE INDEX idx_rejection_patterns_hash ON rejection_patterns(pattern_hash);
CREATE INDEX idx_rejection_patterns_models ON rejection_patterns USING GIN(trigger_model_ids);

CREATE INDEX idx_user_rejection_notifications_user ON user_rejection_notifications(user_id);
CREATE INDEX idx_user_rejection_notifications_unread ON user_rejection_notifications(user_id, is_read) WHERE is_read = false;

CREATE INDEX idx_model_rejection_stats_model ON model_rejection_stats(model_id);
CREATE INDEX idx_model_rejection_stats_rate ON model_rejection_stats(rejection_rate DESC);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE provider_rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rejection_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY provider_rejections_tenant_isolation ON provider_rejections
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY user_rejection_notifications_user_isolation ON user_rejection_notifications
    FOR ALL USING (user_id = current_setting('app.current_user_id')::UUID);

-- ============================================================================
-- Functions
-- ============================================================================

-- Record a rejection and get fallback recommendations
CREATE OR REPLACE FUNCTION record_provider_rejection(
    p_tenant_id UUID,
    p_user_id UUID,
    p_model_id VARCHAR,
    p_provider_id VARCHAR,
    p_rejection_type VARCHAR,
    p_rejection_message TEXT,
    p_plan_id UUID DEFAULT NULL,
    p_prompt_hash VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    rejection_id UUID,
    recommended_fallbacks TEXT[],
    models_to_avoid TEXT[],
    similar_pattern_id UUID
) AS $$
DECLARE
    v_rejection_id UUID;
    v_pattern_id UUID;
    v_recommended TEXT[];
    v_avoid TEXT[];
BEGIN
    -- Insert rejection record
    INSERT INTO provider_rejections (
        tenant_id, user_id, model_id, provider_id, hosting_type,
        rejection_type, rejection_message, plan_id, prompt_hash
    ) VALUES (
        p_tenant_id, p_user_id, p_model_id, p_provider_id, 
        CASE WHEN p_provider_id = 'self_hosted' THEN 'self_hosted' ELSE 'external' END,
        p_rejection_type, p_rejection_message, p_plan_id, p_prompt_hash
    ) RETURNING id INTO v_rejection_id;
    
    -- Update model stats
    INSERT INTO model_rejection_stats (model_id, provider_id, total_requests, total_rejections, last_rejection_at)
    VALUES (p_model_id, p_provider_id, 1, 1, NOW())
    ON CONFLICT (model_id) DO UPDATE SET
        total_rejections = model_rejection_stats.total_rejections + 1,
        last_rejection_at = NOW(),
        updated_at = NOW(),
        content_policy_count = model_rejection_stats.content_policy_count + 
            CASE WHEN p_rejection_type = 'content_policy' THEN 1 ELSE 0 END,
        safety_filter_count = model_rejection_stats.safety_filter_count + 
            CASE WHEN p_rejection_type = 'safety_filter' THEN 1 ELSE 0 END,
        provider_ethics_count = model_rejection_stats.provider_ethics_count + 
            CASE WHEN p_rejection_type = 'provider_ethics' THEN 1 ELSE 0 END,
        other_count = model_rejection_stats.other_count + 
            CASE WHEN p_rejection_type NOT IN ('content_policy', 'safety_filter', 'provider_ethics') THEN 1 ELSE 0 END;
    
    -- Find similar patterns
    SELECT id, recommended_fallback_models, avoid_models 
    INTO v_pattern_id, v_recommended, v_avoid
    FROM rejection_patterns
    WHERE p_model_id = ANY(trigger_model_ids)
       OR p_provider_id = ANY(trigger_provider_ids)
    ORDER BY success_rate DESC NULLS LAST
    LIMIT 1;
    
    -- If no pattern found, get general fallbacks (models with low rejection rates)
    IF v_recommended IS NULL THEN
        SELECT ARRAY_AGG(model_id) INTO v_recommended
        FROM model_rejection_stats
        WHERE model_id != p_model_id
          AND rejection_rate < 0.1
        ORDER BY rejection_rate ASC
        LIMIT 5;
    END IF;
    
    RETURN QUERY SELECT v_rejection_id, v_recommended, v_avoid, v_pattern_id;
END;
$$ LANGUAGE plpgsql;

-- Record fallback result
CREATE OR REPLACE FUNCTION record_fallback_result(
    p_rejection_id UUID,
    p_fallback_model_id VARCHAR,
    p_succeeded BOOLEAN,
    p_fallback_chain JSONB DEFAULT '[]'
)
RETURNS void AS $$
BEGIN
    UPDATE provider_rejections SET
        fallback_attempted = true,
        fallback_model_id = p_fallback_model_id,
        fallback_succeeded = p_succeeded,
        fallback_chain = p_fallback_chain,
        final_status = CASE WHEN p_succeeded THEN 'fallback_success' ELSE 'rejected' END,
        resolved_at = NOW()
    WHERE id = p_rejection_id;
    
    -- Update model stats for fallback
    UPDATE model_rejection_stats SET
        fallback_attempts = fallback_attempts + 1,
        fallback_successes = fallback_successes + CASE WHEN p_succeeded THEN 1 ELSE 0 END,
        updated_at = NOW()
    WHERE model_id = (SELECT model_id FROM provider_rejections WHERE id = p_rejection_id);
END;
$$ LANGUAGE plpgsql;

-- Get user's rejection notifications
CREATE OR REPLACE FUNCTION get_user_rejection_notifications(
    p_user_id UUID,
    p_include_read BOOLEAN DEFAULT false,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    notification_id UUID,
    title VARCHAR,
    message TEXT,
    detailed_reason TEXT,
    suggested_actions JSONB,
    is_read BOOLEAN,
    created_at TIMESTAMPTZ,
    rejection_type VARCHAR,
    model_id VARCHAR,
    final_status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.title,
        n.message,
        n.detailed_reason,
        n.suggested_actions,
        n.is_read,
        n.created_at,
        r.rejection_type,
        r.model_id,
        r.final_status
    FROM user_rejection_notifications n
    JOIN provider_rejections r ON n.rejection_id = r.id
    WHERE n.user_id = p_user_id
      AND n.is_dismissed = false
      AND (p_include_read OR n.is_read = false)
    ORDER BY n.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create notification for user
CREATE OR REPLACE FUNCTION create_rejection_notification(
    p_rejection_id UUID,
    p_title VARCHAR,
    p_message TEXT,
    p_detailed_reason TEXT DEFAULT NULL,
    p_suggested_actions JSONB DEFAULT '[]'
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
    v_tenant_id UUID;
    v_user_id UUID;
BEGIN
    SELECT tenant_id, user_id INTO v_tenant_id, v_user_id
    FROM provider_rejections WHERE id = p_rejection_id;
    
    INSERT INTO user_rejection_notifications (
        tenant_id, user_id, rejection_id, title, message, detailed_reason, suggested_actions
    ) VALUES (
        v_tenant_id, v_user_id, p_rejection_id, p_title, p_message, p_detailed_reason, p_suggested_actions
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON provider_rejections TO authenticated;
GRANT SELECT, INSERT, UPDATE ON rejection_patterns TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_rejection_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON model_rejection_stats TO authenticated;
GRANT EXECUTE ON FUNCTION record_provider_rejection TO authenticated;
GRANT EXECUTE ON FUNCTION record_fallback_result TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_rejection_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION create_rejection_notification TO authenticated;
