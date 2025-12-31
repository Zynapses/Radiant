-- RADIANT v4.18.55 - File Conversion Learning Schema
-- Reinforcement learning for AGI Brain format understanding
-- Tracks model performance with file formats and learns from outcomes

-- ============================================================================
-- Model Format Understanding (Learned from experience)
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_format_understanding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Model identification
    model_id VARCHAR(200) NOT NULL,
    provider_id VARCHAR(100) NOT NULL,
    
    -- Format information
    file_format VARCHAR(50) NOT NULL,
    mime_type VARCHAR(200),
    
    -- Understanding metrics (0.0 to 1.0)
    understanding_score DECIMAL(4,3) NOT NULL DEFAULT 0.5,
    confidence DECIMAL(4,3) NOT NULL DEFAULT 0.1,
    
    -- Tracking
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    total_attempts INTEGER NOT NULL DEFAULT 0,
    
    -- Override flags
    force_convert BOOLEAN NOT NULL DEFAULT false,
    force_convert_reason TEXT,
    force_convert_set_at TIMESTAMPTZ,
    force_convert_set_by UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_evaluated_at TIMESTAMPTZ,
    
    -- Unique constraint per tenant/model/format
    UNIQUE(tenant_id, model_id, file_format)
);

-- Index for lookups
CREATE INDEX idx_model_format_understanding_lookup 
    ON model_format_understanding(tenant_id, model_id, file_format);

CREATE INDEX idx_model_format_understanding_score 
    ON model_format_understanding(tenant_id, understanding_score);

-- ============================================================================
-- Conversion Outcome Feedback
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversion_outcome_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Reference to conversion
    conversion_id UUID NOT NULL,
    conversation_id UUID,
    
    -- Model information
    model_id VARCHAR(200) NOT NULL,
    provider_id VARCHAR(100) NOT NULL,
    
    -- File information
    filename VARCHAR(500) NOT NULL,
    file_format VARCHAR(50) NOT NULL,
    file_size BIGINT,
    
    -- What action was taken
    action_taken VARCHAR(50) NOT NULL, -- 'pass_original', 'convert', 'skip'
    conversion_strategy VARCHAR(50),
    
    -- Outcome feedback
    outcome VARCHAR(50) NOT NULL, -- 'success', 'partial', 'failure', 'unknown'
    outcome_source VARCHAR(50) NOT NULL, -- 'user_feedback', 'model_response', 'error_detection', 'auto_inferred'
    
    -- Detailed feedback
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    user_feedback TEXT,
    
    -- Model's response quality indicators
    model_understood BOOLEAN, -- Did the model understand the content?
    model_hallucinated BOOLEAN, -- Did the model make up content?
    model_asked_for_clarification BOOLEAN,
    model_mentioned_format_issues BOOLEAN,
    
    -- Error information
    error_type VARCHAR(100),
    error_message TEXT,
    
    -- Learning candidate created?
    learning_candidate_id UUID,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one feedback per conversion/model combination
    UNIQUE(conversion_id, model_id)
);

-- Indexes
CREATE INDEX idx_conversion_outcome_feedback_tenant 
    ON conversion_outcome_feedback(tenant_id);

CREATE INDEX idx_conversion_outcome_feedback_model 
    ON conversion_outcome_feedback(model_id, file_format);

CREATE INDEX idx_conversion_outcome_feedback_outcome 
    ON conversion_outcome_feedback(outcome);

-- ============================================================================
-- Format Understanding Events (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS format_understanding_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Reference
    understanding_id UUID NOT NULL REFERENCES model_format_understanding(id) ON DELETE CASCADE,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL, -- 'score_updated', 'override_set', 'override_cleared', 'threshold_crossed'
    previous_score DECIMAL(4,3),
    new_score DECIMAL(4,3),
    
    -- Trigger information
    triggered_by VARCHAR(50) NOT NULL, -- 'feedback', 'auto_evaluation', 'admin_override', 'system'
    trigger_feedback_id UUID REFERENCES conversion_outcome_feedback(id),
    
    -- Details
    details JSONB,
    
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_format_understanding_events_understanding 
    ON format_understanding_events(understanding_id);

-- ============================================================================
-- Global Format Learning (Cross-tenant aggregate insights)
-- ============================================================================

CREATE TABLE IF NOT EXISTS global_format_learning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Model/format identification
    model_id VARCHAR(200) NOT NULL,
    provider_id VARCHAR(100) NOT NULL,
    file_format VARCHAR(50) NOT NULL,
    
    -- Aggregate metrics
    global_understanding_score DECIMAL(4,3) NOT NULL DEFAULT 0.5,
    global_confidence DECIMAL(4,3) NOT NULL DEFAULT 0.1,
    
    -- Counts across all tenants
    total_success_count INTEGER NOT NULL DEFAULT 0,
    total_failure_count INTEGER NOT NULL DEFAULT 0,
    total_attempts INTEGER NOT NULL DEFAULT 0,
    tenant_count INTEGER NOT NULL DEFAULT 0, -- How many tenants have data
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(model_id, file_format)
);

CREATE INDEX idx_global_format_learning_lookup 
    ON global_format_learning(model_id, file_format);

-- ============================================================================
-- Functions
-- ============================================================================

-- Update understanding score based on outcome
CREATE OR REPLACE FUNCTION update_format_understanding(
    p_tenant_id UUID,
    p_model_id VARCHAR(200),
    p_provider_id VARCHAR(100),
    p_file_format VARCHAR(50),
    p_outcome VARCHAR(50), -- 'success', 'partial', 'failure'
    p_weight DECIMAL(4,3) DEFAULT 0.1
)
RETURNS model_format_understanding AS $$
DECLARE
    v_record model_format_understanding;
    v_outcome_value DECIMAL(4,3);
    v_new_score DECIMAL(4,3);
    v_new_confidence DECIMAL(4,3);
BEGIN
    -- Map outcome to value
    v_outcome_value := CASE p_outcome
        WHEN 'success' THEN 1.0
        WHEN 'partial' THEN 0.6
        WHEN 'failure' THEN 0.0
        ELSE 0.5
    END;
    
    -- Insert or update the record
    INSERT INTO model_format_understanding (
        tenant_id, model_id, provider_id, file_format,
        understanding_score, confidence,
        success_count, failure_count, total_attempts,
        last_evaluated_at
    ) VALUES (
        p_tenant_id, p_model_id, p_provider_id, p_file_format,
        v_outcome_value, p_weight,
        CASE WHEN p_outcome = 'success' THEN 1 ELSE 0 END,
        CASE WHEN p_outcome = 'failure' THEN 1 ELSE 0 END,
        1,
        NOW()
    )
    ON CONFLICT (tenant_id, model_id, file_format) DO UPDATE SET
        -- Exponential moving average for score
        understanding_score = model_format_understanding.understanding_score * (1 - p_weight) + v_outcome_value * p_weight,
        -- Increase confidence with more data (asymptotic to 1.0)
        confidence = LEAST(0.95, model_format_understanding.confidence + (1 - model_format_understanding.confidence) * 0.05),
        -- Update counts
        success_count = model_format_understanding.success_count + CASE WHEN p_outcome = 'success' THEN 1 ELSE 0 END,
        failure_count = model_format_understanding.failure_count + CASE WHEN p_outcome = 'failure' THEN 1 ELSE 0 END,
        total_attempts = model_format_understanding.total_attempts + 1,
        -- Timestamps
        updated_at = NOW(),
        last_evaluated_at = NOW()
    RETURNING * INTO v_record;
    
    -- Log the event
    INSERT INTO format_understanding_events (
        tenant_id, understanding_id, event_type,
        previous_score, new_score, triggered_by, details
    ) VALUES (
        p_tenant_id, v_record.id, 'score_updated',
        v_record.understanding_score, v_record.understanding_score,
        'feedback',
        jsonb_build_object('outcome', p_outcome, 'weight', p_weight)
    );
    
    RETURN v_record;
END;
$$ LANGUAGE plpgsql;

-- Get recommended action for model/format
CREATE OR REPLACE FUNCTION get_format_recommendation(
    p_tenant_id UUID,
    p_model_id VARCHAR(200),
    p_file_format VARCHAR(50),
    p_threshold DECIMAL(4,3) DEFAULT 0.7
)
RETURNS TABLE (
    should_convert BOOLEAN,
    understanding_score DECIMAL(4,3),
    confidence DECIMAL(4,3),
    recommendation_reason TEXT,
    total_attempts INTEGER
) AS $$
DECLARE
    v_record model_format_understanding;
    v_global global_format_learning;
BEGIN
    -- Check tenant-specific understanding
    SELECT * INTO v_record
    FROM model_format_understanding
    WHERE tenant_id = p_tenant_id
      AND model_id = p_model_id
      AND file_format = p_file_format;
    
    -- If force convert is set, return that
    IF v_record.force_convert THEN
        RETURN QUERY SELECT 
            true AS should_convert,
            v_record.understanding_score,
            v_record.confidence,
            'Admin override: ' || COALESCE(v_record.force_convert_reason, 'Manual override') AS recommendation_reason,
            v_record.total_attempts;
        RETURN;
    END IF;
    
    -- If we have tenant-specific data with good confidence
    IF v_record.id IS NOT NULL AND v_record.confidence >= 0.5 THEN
        RETURN QUERY SELECT
            v_record.understanding_score < p_threshold AS should_convert,
            v_record.understanding_score,
            v_record.confidence,
            CASE 
                WHEN v_record.understanding_score >= p_threshold THEN 
                    'Model understands this format well (score: ' || ROUND(v_record.understanding_score::numeric, 2) || ')'
                ELSE 
                    'Model struggles with this format (score: ' || ROUND(v_record.understanding_score::numeric, 2) || ')'
            END AS recommendation_reason,
            v_record.total_attempts;
        RETURN;
    END IF;
    
    -- Fall back to global learning
    SELECT * INTO v_global
    FROM global_format_learning
    WHERE model_id = p_model_id
      AND file_format = p_file_format;
    
    IF v_global.id IS NOT NULL AND v_global.global_confidence >= 0.3 THEN
        RETURN QUERY SELECT
            v_global.global_understanding_score < p_threshold AS should_convert,
            v_global.global_understanding_score,
            v_global.global_confidence,
            'Based on global learning across ' || v_global.tenant_count || ' tenants' AS recommendation_reason,
            v_global.total_attempts;
        RETURN;
    END IF;
    
    -- No data - return default (don't convert, let model try)
    RETURN QUERY SELECT
        false AS should_convert,
        0.5::DECIMAL(4,3) AS understanding_score,
        0.0::DECIMAL(4,3) AS confidence,
        'No learning data available - assuming model can handle format' AS recommendation_reason,
        0 AS total_attempts;
END;
$$ LANGUAGE plpgsql;

-- Aggregate tenant data to global learning
CREATE OR REPLACE FUNCTION aggregate_global_format_learning()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Aggregate all tenant data to global
    INSERT INTO global_format_learning (
        model_id, provider_id, file_format,
        global_understanding_score, global_confidence,
        total_success_count, total_failure_count, total_attempts, tenant_count,
        updated_at
    )
    SELECT 
        model_id, 
        provider_id, 
        file_format,
        -- Weighted average of understanding scores
        SUM(understanding_score * total_attempts) / NULLIF(SUM(total_attempts), 0) AS global_understanding_score,
        -- Confidence based on data volume
        LEAST(0.95, 0.1 + (LN(SUM(total_attempts) + 1) / 10)) AS global_confidence,
        SUM(success_count) AS total_success_count,
        SUM(failure_count) AS total_failure_count,
        SUM(total_attempts) AS total_attempts,
        COUNT(DISTINCT tenant_id) AS tenant_count,
        NOW() AS updated_at
    FROM model_format_understanding
    GROUP BY model_id, provider_id, file_format
    ON CONFLICT (model_id, file_format) DO UPDATE SET
        global_understanding_score = EXCLUDED.global_understanding_score,
        global_confidence = EXCLUDED.global_confidence,
        total_success_count = EXCLUDED.total_success_count,
        total_failure_count = EXCLUDED.total_failure_count,
        total_attempts = EXCLUDED.total_attempts,
        tenant_count = EXCLUDED.tenant_count,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Views
-- ============================================================================

-- Model format understanding summary
CREATE OR REPLACE VIEW v_model_format_understanding_summary AS
SELECT 
    tenant_id,
    model_id,
    provider_id,
    file_format,
    understanding_score,
    confidence,
    success_count,
    failure_count,
    total_attempts,
    CASE 
        WHEN force_convert THEN 'force_convert'
        WHEN understanding_score >= 0.8 THEN 'excellent'
        WHEN understanding_score >= 0.6 THEN 'good'
        WHEN understanding_score >= 0.4 THEN 'moderate'
        ELSE 'poor'
    END AS understanding_level,
    ROUND((success_count::decimal / NULLIF(total_attempts, 0)) * 100, 1) AS success_rate,
    updated_at,
    last_evaluated_at
FROM model_format_understanding;

-- Recent feedback
CREATE OR REPLACE VIEW v_recent_conversion_feedback AS
SELECT 
    cof.id,
    cof.tenant_id,
    cof.model_id,
    cof.file_format,
    cof.action_taken,
    cof.outcome,
    cof.outcome_source,
    cof.user_rating,
    cof.model_understood,
    cof.created_at,
    mfu.understanding_score AS current_understanding,
    mfu.confidence AS current_confidence
FROM conversion_outcome_feedback cof
LEFT JOIN model_format_understanding mfu 
    ON cof.tenant_id = mfu.tenant_id 
    AND cof.model_id = mfu.model_id 
    AND cof.file_format = mfu.file_format
ORDER BY cof.created_at DESC;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE model_format_understanding ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_outcome_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE format_understanding_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY model_format_understanding_tenant_isolation ON model_format_understanding
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY conversion_outcome_feedback_tenant_isolation ON conversion_outcome_feedback
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY format_understanding_events_tenant_isolation ON format_understanding_events
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE model_format_understanding IS 'Learned understanding of how well each model handles specific file formats';
COMMENT ON TABLE conversion_outcome_feedback IS 'Feedback on file conversion outcomes for reinforcement learning';
COMMENT ON TABLE format_understanding_events IS 'Audit trail of changes to format understanding';
COMMENT ON TABLE global_format_learning IS 'Aggregated format understanding across all tenants';

COMMENT ON FUNCTION update_format_understanding IS 'Updates model format understanding based on conversion outcome feedback';
COMMENT ON FUNCTION get_format_recommendation IS 'Returns recommendation on whether to convert a format for a model';
COMMENT ON FUNCTION aggregate_global_format_learning IS 'Aggregates tenant data to global learning table';
