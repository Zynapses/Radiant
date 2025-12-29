-- Migration: 084_rejection_analytics
-- Description: Enhanced rejection tracking with full prompt content and analytics
-- Enables analysis of rejection patterns to inform ethics policy updates
-- Author: RADIANT System
-- Date: 2024-12-28

-- ============================================================================
-- Enhance provider_rejections with full prompt content
-- ============================================================================

ALTER TABLE provider_rejections
ADD COLUMN IF NOT EXISTS prompt_content TEXT;

ALTER TABLE provider_rejections
ADD COLUMN IF NOT EXISTS prompt_length INTEGER;

ALTER TABLE provider_rejections
ADD COLUMN IF NOT EXISTS orchestration_mode VARCHAR(50);

ALTER TABLE provider_rejections
ADD COLUMN IF NOT EXISTS detected_domain_id UUID;

ALTER TABLE provider_rejections
ADD COLUMN IF NOT EXISTS detected_domain_name VARCHAR(255);

ALTER TABLE provider_rejections
ADD COLUMN IF NOT EXISTS violation_keywords TEXT[];

ALTER TABLE provider_rejections
ADD COLUMN IF NOT EXISTS violation_categories TEXT[];

ALTER TABLE provider_rejections
ADD COLUMN IF NOT EXISTS provider_error_details JSONB;

ALTER TABLE provider_rejections
ADD COLUMN IF NOT EXISTS request_metadata JSONB DEFAULT '{}';

-- ============================================================================
-- Rejection Analytics Table - Aggregated stats per model/provider/mode
-- ============================================================================

CREATE TABLE IF NOT EXISTS rejection_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Grouping dimensions
    model_id VARCHAR(100) NOT NULL,
    provider_id VARCHAR(50) NOT NULL,
    orchestration_mode VARCHAR(50),
    rejection_type VARCHAR(50) NOT NULL,
    
    -- Time bucket
    time_bucket DATE NOT NULL,  -- Daily aggregation
    
    -- Counts
    rejection_count INTEGER NOT NULL DEFAULT 0,
    fallback_success_count INTEGER NOT NULL DEFAULT 0,
    total_rejected_to_user INTEGER NOT NULL DEFAULT 0,
    
    -- Unique prompts
    unique_prompt_hashes INTEGER NOT NULL DEFAULT 0,
    
    -- Top violation keywords (aggregated)
    top_keywords JSONB DEFAULT '[]',
    
    -- Sample prompt hashes for investigation
    sample_prompt_hashes TEXT[] DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(model_id, provider_id, orchestration_mode, rejection_type, time_bucket)
);

-- ============================================================================
-- Violation Keyword Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS rejection_keyword_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Keyword
    keyword VARCHAR(100) NOT NULL,
    keyword_category VARCHAR(50),  -- violence, adult, hate, etc.
    
    -- Stats
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    rejection_count INTEGER NOT NULL DEFAULT 1,
    
    -- By provider
    provider_rejection_counts JSONB DEFAULT '{}',
    -- e.g., {"openai": 45, "anthropic": 12, "google": 8}
    
    -- By model
    model_rejection_counts JSONB DEFAULT '{}',
    
    -- First/last seen
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- For ethics policy consideration
    flagged_for_review BOOLEAN NOT NULL DEFAULT false,
    review_notes TEXT,
    policy_action_taken VARCHAR(50),  -- none, pre_filter, warn, block
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(keyword)
);

-- ============================================================================
-- Prompt Archive for Investigation
-- ============================================================================

CREATE TABLE IF NOT EXISTS rejected_prompt_archive (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference
    rejection_id UUID REFERENCES provider_rejections(id) ON DELETE SET NULL,
    prompt_hash VARCHAR(64) NOT NULL,
    
    -- Full content (encrypted in production)
    prompt_content TEXT NOT NULL,
    prompt_length INTEGER NOT NULL,
    
    -- Context
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    model_id VARCHAR(100) NOT NULL,
    provider_id VARCHAR(50) NOT NULL,
    orchestration_mode VARCHAR(50),
    
    -- Rejection details
    rejection_type VARCHAR(50) NOT NULL,
    rejection_message TEXT,
    provider_error_code VARCHAR(100),
    
    -- Analysis
    detected_keywords TEXT[],
    detected_categories TEXT[],
    sensitivity_score NUMERIC(4,3),
    
    -- Policy flags
    flagged_for_policy_review BOOLEAN NOT NULL DEFAULT false,
    policy_review_status VARCHAR(20) DEFAULT 'pending',
    policy_review_notes TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    
    -- Recommendation
    recommended_action VARCHAR(50),  -- none, pre_filter, add_warning, block_pattern
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Index for deduplication
    UNIQUE(prompt_hash, model_id, rejection_type)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_provider_rejections_prompt_hash ON provider_rejections(prompt_hash);
CREATE INDEX idx_provider_rejections_mode ON provider_rejections(orchestration_mode);
CREATE INDEX idx_provider_rejections_domain ON provider_rejections(detected_domain_id);
CREATE INDEX idx_provider_rejections_keywords ON provider_rejections USING GIN(violation_keywords);

CREATE INDEX idx_rejection_analytics_time ON rejection_analytics(time_bucket DESC);
CREATE INDEX idx_rejection_analytics_model ON rejection_analytics(model_id);
CREATE INDEX idx_rejection_analytics_provider ON rejection_analytics(provider_id);
CREATE INDEX idx_rejection_analytics_type ON rejection_analytics(rejection_type);

CREATE INDEX idx_rejection_keyword_stats_count ON rejection_keyword_stats(occurrence_count DESC);
CREATE INDEX idx_rejection_keyword_stats_flagged ON rejection_keyword_stats(flagged_for_review) WHERE flagged_for_review = true;

CREATE INDEX idx_rejected_prompt_archive_hash ON rejected_prompt_archive(prompt_hash);
CREATE INDEX idx_rejected_prompt_archive_flagged ON rejected_prompt_archive(flagged_for_policy_review) WHERE flagged_for_policy_review = true;
CREATE INDEX idx_rejected_prompt_archive_model ON rejected_prompt_archive(model_id);
CREATE INDEX idx_rejected_prompt_archive_type ON rejected_prompt_archive(rejection_type);

-- ============================================================================
-- Functions
-- ============================================================================

-- Record rejection with full analytics
CREATE OR REPLACE FUNCTION record_rejection_with_analytics(
    p_tenant_id UUID,
    p_user_id UUID,
    p_model_id VARCHAR,
    p_provider_id VARCHAR,
    p_rejection_type VARCHAR,
    p_rejection_message TEXT,
    p_prompt_content TEXT,
    p_orchestration_mode VARCHAR DEFAULT NULL,
    p_detected_domain_id UUID DEFAULT NULL,
    p_detected_domain_name VARCHAR DEFAULT NULL,
    p_plan_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_rejection_id UUID;
    v_prompt_hash VARCHAR(64);
    v_keywords TEXT[];
BEGIN
    -- Generate prompt hash
    v_prompt_hash := encode(sha256(p_prompt_content::bytea), 'hex');
    
    -- Extract potential violation keywords (basic extraction)
    v_keywords := ARRAY(
        SELECT DISTINCT lower(word)
        FROM regexp_split_to_table(p_prompt_content, '\s+') AS word
        WHERE length(word) > 3
          AND lower(word) IN (
              'kill', 'harm', 'attack', 'weapon', 'bomb', 'drug', 'illegal',
              'hack', 'steal', 'fraud', 'violence', 'hate', 'abuse', 'exploit'
          )
    );
    
    -- Insert rejection record
    INSERT INTO provider_rejections (
        tenant_id, user_id, model_id, provider_id, 
        rejection_type, rejection_message,
        prompt_content, prompt_length, prompt_hash,
        orchestration_mode, detected_domain_id, detected_domain_name,
        violation_keywords, plan_id
    ) VALUES (
        p_tenant_id, p_user_id, p_model_id, p_provider_id,
        p_rejection_type, p_rejection_message,
        p_prompt_content, length(p_prompt_content), v_prompt_hash,
        p_orchestration_mode, p_detected_domain_id, p_detected_domain_name,
        v_keywords, p_plan_id
    ) RETURNING id INTO v_rejection_id;
    
    -- Archive prompt for investigation
    INSERT INTO rejected_prompt_archive (
        rejection_id, prompt_hash, prompt_content, prompt_length,
        tenant_id, user_id, model_id, provider_id, orchestration_mode,
        rejection_type, rejection_message, detected_keywords
    ) VALUES (
        v_rejection_id, v_prompt_hash, p_prompt_content, length(p_prompt_content),
        p_tenant_id, p_user_id, p_model_id, p_provider_id, p_orchestration_mode,
        p_rejection_type, p_rejection_message, v_keywords
    ) ON CONFLICT (prompt_hash, model_id, rejection_type) DO UPDATE SET
        rejection_id = v_rejection_id,
        created_at = NOW();
    
    -- Update keyword stats
    FOREACH v_keyword IN ARRAY v_keywords LOOP
        INSERT INTO rejection_keyword_stats (keyword, occurrence_count, rejection_count, last_seen)
        VALUES (v_keyword, 1, 1, NOW())
        ON CONFLICT (keyword) DO UPDATE SET
            occurrence_count = rejection_keyword_stats.occurrence_count + 1,
            rejection_count = rejection_keyword_stats.rejection_count + 1,
            last_seen = NOW(),
            provider_rejection_counts = jsonb_set(
                COALESCE(rejection_keyword_stats.provider_rejection_counts, '{}'::jsonb),
                ARRAY[p_provider_id],
                (COALESCE((rejection_keyword_stats.provider_rejection_counts->p_provider_id)::integer, 0) + 1)::text::jsonb
            ),
            model_rejection_counts = jsonb_set(
                COALESCE(rejection_keyword_stats.model_rejection_counts, '{}'::jsonb),
                ARRAY[p_model_id],
                (COALESCE((rejection_keyword_stats.model_rejection_counts->p_model_id)::integer, 0) + 1)::text::jsonb
            ),
            updated_at = NOW();
    END LOOP;
    
    -- Update daily analytics
    INSERT INTO rejection_analytics (
        model_id, provider_id, orchestration_mode, rejection_type,
        time_bucket, rejection_count, unique_prompt_hashes
    ) VALUES (
        p_model_id, p_provider_id, p_orchestration_mode, p_rejection_type,
        CURRENT_DATE, 1, 1
    ) ON CONFLICT (model_id, provider_id, orchestration_mode, rejection_type, time_bucket) 
    DO UPDATE SET
        rejection_count = rejection_analytics.rejection_count + 1,
        updated_at = NOW();
    
    RETURN v_rejection_id;
END;
$$ LANGUAGE plpgsql;

-- Get rejection analytics dashboard data
CREATE OR REPLACE FUNCTION get_rejection_analytics_dashboard(
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    model_id VARCHAR,
    provider_id VARCHAR,
    rejection_type VARCHAR,
    total_rejections BIGINT,
    fallback_successes BIGINT,
    rejection_rate NUMERIC,
    top_keywords JSONB,
    trend VARCHAR  -- up, down, stable
) AS $$
BEGIN
    RETURN QUERY
    WITH recent AS (
        SELECT 
            ra.model_id,
            ra.provider_id,
            ra.rejection_type,
            SUM(ra.rejection_count) as total,
            SUM(ra.fallback_success_count) as fallbacks
        FROM rejection_analytics ra
        WHERE ra.time_bucket >= CURRENT_DATE - p_days
        GROUP BY ra.model_id, ra.provider_id, ra.rejection_type
    ),
    stats AS (
        SELECT 
            mrs.model_id,
            mrs.provider_id,
            mrs.total_requests,
            mrs.rejection_rate
        FROM model_rejection_stats mrs
    )
    SELECT 
        r.model_id,
        r.provider_id,
        r.rejection_type,
        r.total,
        r.fallbacks,
        COALESCE(s.rejection_rate, 0),
        (SELECT jsonb_agg(k.keyword ORDER BY k.occurrence_count DESC)
         FROM rejection_keyword_stats k 
         WHERE (k.model_rejection_counts->r.model_id) IS NOT NULL
         LIMIT 5),
        CASE 
            WHEN r.total > 10 THEN 'up'
            WHEN r.total < 5 THEN 'down'
            ELSE 'stable'
        END
    FROM recent r
    LEFT JOIN stats s ON r.model_id = s.model_id
    ORDER BY r.total DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get prompts flagged for policy review
CREATE OR REPLACE FUNCTION get_prompts_for_policy_review(
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    prompt_content TEXT,
    prompt_hash VARCHAR,
    model_id VARCHAR,
    provider_id VARCHAR,
    rejection_type VARCHAR,
    rejection_message TEXT,
    detected_keywords TEXT[],
    rejection_count BIGINT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.prompt_content,
        a.prompt_hash,
        a.model_id,
        a.provider_id,
        a.rejection_type,
        a.rejection_message,
        a.detected_keywords,
        (SELECT COUNT(*) FROM provider_rejections pr WHERE pr.prompt_hash = a.prompt_hash),
        a.created_at
    FROM rejected_prompt_archive a
    WHERE a.flagged_for_policy_review = true
      AND a.policy_review_status = 'pending'
    ORDER BY a.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Flag keyword for policy review
CREATE OR REPLACE FUNCTION flag_keyword_for_review(
    p_keyword VARCHAR,
    p_notes TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE rejection_keyword_stats SET
        flagged_for_review = true,
        review_notes = COALESCE(p_notes, review_notes),
        updated_at = NOW()
    WHERE keyword = p_keyword;
    
    -- Also flag related prompts
    UPDATE rejected_prompt_archive SET
        flagged_for_policy_review = true
    WHERE p_keyword = ANY(detected_keywords);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Views for Admin Dashboard
-- ============================================================================

CREATE OR REPLACE VIEW rejection_summary_by_provider AS
SELECT 
    provider_id,
    COUNT(*) as total_rejections,
    COUNT(DISTINCT model_id) as models_affected,
    COUNT(DISTINCT prompt_hash) as unique_prompts,
    COUNT(*) FILTER (WHERE fallback_succeeded = true) as fallback_successes,
    COUNT(*) FILTER (WHERE final_status = 'rejected') as rejected_to_user,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE fallback_succeeded = true) / NULLIF(COUNT(*), 0),
        2
    ) as fallback_success_rate,
    array_agg(DISTINCT rejection_type) as rejection_types,
    MAX(created_at) as last_rejection
FROM provider_rejections
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY provider_id
ORDER BY total_rejections DESC;

CREATE OR REPLACE VIEW rejection_summary_by_model AS
SELECT 
    model_id,
    provider_id,
    COUNT(*) as total_rejections,
    COUNT(DISTINCT prompt_hash) as unique_prompts,
    COUNT(*) FILTER (WHERE final_status = 'rejected') as rejected_to_user,
    array_agg(DISTINCT rejection_type) as rejection_types,
    array_agg(DISTINCT orchestration_mode) FILTER (WHERE orchestration_mode IS NOT NULL) as modes_affected,
    MAX(created_at) as last_rejection
FROM provider_rejections
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY model_id, provider_id
ORDER BY total_rejections DESC;

CREATE OR REPLACE VIEW top_rejection_keywords AS
SELECT 
    keyword,
    keyword_category,
    occurrence_count,
    rejection_count,
    provider_rejection_counts,
    model_rejection_counts,
    flagged_for_review,
    policy_action_taken,
    first_seen,
    last_seen
FROM rejection_keyword_stats
ORDER BY occurrence_count DESC
LIMIT 100;

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON rejection_analytics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON rejection_keyword_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE ON rejected_prompt_archive TO authenticated;
GRANT EXECUTE ON FUNCTION record_rejection_with_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_rejection_analytics_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION get_prompts_for_policy_review TO authenticated;
GRANT EXECUTE ON FUNCTION flag_keyword_for_review TO authenticated;
GRANT SELECT ON rejection_summary_by_provider TO authenticated;
GRANT SELECT ON rejection_summary_by_model TO authenticated;
GRANT SELECT ON top_rejection_keywords TO authenticated;
