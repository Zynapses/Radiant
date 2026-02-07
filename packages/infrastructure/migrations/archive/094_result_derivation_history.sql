-- Migration 094: Result Derivation History
-- Comprehensive tracking of how Think Tank results are derived
-- RADIANT v4.18.0

-- ============================================================================
-- RESULT DERIVATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS result_derivations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    prompt_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Original prompt and final response
    original_prompt TEXT NOT NULL,
    final_response TEXT,
    
    -- Plan details
    plan JSONB,
    plan_mode VARCHAR(50),
    plan_generated_at TIMESTAMPTZ,
    plan_generation_latency_ms INTEGER,
    
    -- Domain detection
    domain_detection JSONB,
    detected_field VARCHAR(100),
    detected_domain VARCHAR(100),
    detected_subspecialty VARCHAR(100),
    domain_confidence DECIMAL(5, 4),
    
    -- Orchestration
    orchestration JSONB,
    model_selection_strategy VARCHAR(50),
    complexity_score DECIMAL(5, 2),
    
    -- Workflow
    workflow JSONB,
    workflow_type VARCHAR(50),
    workflow_status VARCHAR(20),
    
    -- Quality metrics
    quality_metrics JSONB,
    overall_quality_score DECIMAL(5, 2),
    
    -- Timing
    timing JSONB,
    total_duration_ms INTEGER,
    
    -- Costs
    costs JSONB,
    total_cost DECIMAL(10, 6),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- RLS Policy
ALTER TABLE result_derivations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "result_derivations_tenant" ON result_derivations
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- Indexes
CREATE INDEX idx_rd_tenant_created ON result_derivations(tenant_id, created_at DESC);
CREATE INDEX idx_rd_session ON result_derivations(session_id);
CREATE INDEX idx_rd_prompt ON result_derivations(prompt_id);
CREATE INDEX idx_rd_user ON result_derivations(user_id, created_at DESC);
CREATE INDEX idx_rd_status ON result_derivations(status);
CREATE INDEX idx_rd_mode ON result_derivations(plan_mode);
CREATE INDEX idx_rd_domain ON result_derivations(detected_domain);

-- ============================================================================
-- DERIVATION STEPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS derivation_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    derivation_id UUID NOT NULL REFERENCES result_derivations(id) ON DELETE CASCADE,
    step_id VARCHAR(100) NOT NULL,
    step_number INTEGER NOT NULL,
    step_type VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    
    -- Model used
    model_id VARCHAR(100),
    model_display_name VARCHAR(200),
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Details
    details JSONB,
    error TEXT,
    
    UNIQUE(derivation_id, step_id)
);

-- RLS Policy
ALTER TABLE derivation_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "derivation_steps_via_parent" ON derivation_steps
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM result_derivations rd
            WHERE rd.id = derivation_steps.derivation_id
            AND rd.tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

-- Indexes
CREATE INDEX idx_ds_derivation ON derivation_steps(derivation_id, step_number);
CREATE INDEX idx_ds_type ON derivation_steps(step_type);
CREATE INDEX idx_ds_model ON derivation_steps(model_id);

-- ============================================================================
-- DERIVATION MODEL USAGE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS derivation_model_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    derivation_id UUID NOT NULL REFERENCES result_derivations(id) ON DELETE CASCADE,
    
    -- Model info
    model_id VARCHAR(100) NOT NULL,
    model_display_name VARCHAR(200) NOT NULL,
    model_family VARCHAR(50) NOT NULL,
    provider VARCHAR(20) NOT NULL,
    
    -- Purpose and context
    purpose VARCHAR(50) NOT NULL,
    step_id VARCHAR(100),
    
    -- Token usage
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    
    -- Timing
    latency_ms INTEGER NOT NULL DEFAULT 0,
    
    -- Costs
    input_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
    output_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
    total_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
    
    -- Selection details
    selection_reason TEXT,
    selection_score DECIMAL(5, 2),
    alternatives_considered TEXT[],
    
    -- Quality
    quality_tier VARCHAR(20),
    
    -- Response details
    response_length INTEGER,
    truncated BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE derivation_model_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "derivation_model_usage_via_parent" ON derivation_model_usage
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM result_derivations rd
            WHERE rd.id = derivation_model_usage.derivation_id
            AND rd.tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

-- Indexes
CREATE INDEX idx_dmu_derivation ON derivation_model_usage(derivation_id);
CREATE INDEX idx_dmu_model ON derivation_model_usage(model_id);
CREATE INDEX idx_dmu_purpose ON derivation_model_usage(purpose);
CREATE INDEX idx_dmu_provider ON derivation_model_usage(provider);

-- ============================================================================
-- DERIVATION TIMELINE EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS derivation_timeline_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    derivation_id UUID NOT NULL REFERENCES result_derivations(id) ON DELETE CASCADE,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    details JSONB,
    
    -- Timing
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INTEGER,
    
    -- Related entities
    model_id VARCHAR(100),
    step_id VARCHAR(100)
);

-- RLS Policy
ALTER TABLE derivation_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "derivation_timeline_events_via_parent" ON derivation_timeline_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM result_derivations rd
            WHERE rd.id = derivation_timeline_events.derivation_id
            AND rd.tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

-- Indexes
CREATE INDEX idx_dte_derivation ON derivation_timeline_events(derivation_id, timestamp);
CREATE INDEX idx_dte_type ON derivation_timeline_events(event_type);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get full derivation with all related data
CREATE OR REPLACE FUNCTION get_full_derivation(p_derivation_id UUID)
RETURNS TABLE (
    derivation JSONB,
    steps JSONB,
    model_usage JSONB,
    timeline JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        row_to_json(rd.*)::JSONB as derivation,
        COALESCE(
            (SELECT json_agg(ds.* ORDER BY ds.step_number)::JSONB 
             FROM derivation_steps ds 
             WHERE ds.derivation_id = rd.id),
            '[]'::JSONB
        ) as steps,
        COALESCE(
            (SELECT json_agg(dmu.*)::JSONB 
             FROM derivation_model_usage dmu 
             WHERE dmu.derivation_id = rd.id),
            '[]'::JSONB
        ) as model_usage,
        COALESCE(
            (SELECT json_agg(dte.* ORDER BY dte.timestamp)::JSONB 
             FROM derivation_timeline_events dte 
             WHERE dte.derivation_id = rd.id),
            '[]'::JSONB
        ) as timeline
    FROM result_derivations rd
    WHERE rd.id = p_derivation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get derivation summary for a session
CREATE OR REPLACE FUNCTION get_session_derivations(
    p_session_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    prompt_preview TEXT,
    response_preview TEXT,
    mode VARCHAR(50),
    domain VARCHAR(100),
    models_count BIGINT,
    primary_model VARCHAR(200),
    duration_ms INTEGER,
    total_cost DECIMAL,
    quality_score DECIMAL,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        rd.id,
        LEFT(rd.original_prompt, 100) as prompt_preview,
        LEFT(rd.final_response, 200) as response_preview,
        rd.plan_mode as mode,
        rd.detected_domain as domain,
        (SELECT COUNT(*) FROM derivation_model_usage dmu WHERE dmu.derivation_id = rd.id) as models_count,
        (SELECT dmu.model_display_name FROM derivation_model_usage dmu 
         WHERE dmu.derivation_id = rd.id AND dmu.purpose = 'primary_generation' LIMIT 1) as primary_model,
        rd.total_duration_ms as duration_ms,
        rd.total_cost,
        rd.overall_quality_score as quality_score,
        rd.created_at
    FROM result_derivations rd
    WHERE rd.session_id = p_session_id
    ORDER BY rd.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get derivation analytics
CREATE OR REPLACE FUNCTION get_derivation_analytics(
    p_tenant_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    total_derivations BIGINT,
    avg_duration_ms DECIMAL,
    avg_cost DECIMAL,
    avg_quality DECIMAL,
    mode_distribution JSONB,
    domain_distribution JSONB,
    top_models JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_derivations,
        AVG(rd.total_duration_ms)::DECIMAL as avg_duration_ms,
        AVG(rd.total_cost)::DECIMAL as avg_cost,
        AVG(rd.overall_quality_score)::DECIMAL as avg_quality,
        (SELECT json_object_agg(plan_mode, cnt)::JSONB
         FROM (SELECT plan_mode, COUNT(*) as cnt FROM result_derivations 
               WHERE tenant_id = p_tenant_id AND created_at BETWEEN p_start_date AND p_end_date
               GROUP BY plan_mode) sub) as mode_distribution,
        (SELECT json_object_agg(detected_domain, cnt)::JSONB
         FROM (SELECT detected_domain, COUNT(*) as cnt FROM result_derivations 
               WHERE tenant_id = p_tenant_id AND created_at BETWEEN p_start_date AND p_end_date
               AND detected_domain IS NOT NULL
               GROUP BY detected_domain) sub) as domain_distribution,
        (SELECT json_agg(json_build_object('model_id', model_id, 'count', usage_count, 'avg_quality', avg_qual))::JSONB
         FROM (SELECT dmu.model_id, COUNT(*) as usage_count, AVG(rd.overall_quality_score) as avg_qual
               FROM derivation_model_usage dmu
               JOIN result_derivations rd ON dmu.derivation_id = rd.id
               WHERE rd.tenant_id = p_tenant_id AND rd.created_at BETWEEN p_start_date AND p_end_date
               GROUP BY dmu.model_id
               ORDER BY usage_count DESC
               LIMIT 10) sub) as top_models
    FROM result_derivations rd
    WHERE rd.tenant_id = p_tenant_id
    AND rd.created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update completed_at when status changes to completed or failed
CREATE OR REPLACE FUNCTION update_derivation_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('completed', 'failed') AND OLD.status NOT IN ('completed', 'failed') THEN
        NEW.completed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_derivation_completed
    BEFORE UPDATE ON result_derivations
    FOR EACH ROW
    EXECUTE FUNCTION update_derivation_completed_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE result_derivations IS 'Comprehensive history of how Think Tank results are derived';
COMMENT ON TABLE derivation_steps IS 'Individual steps in the execution plan';
COMMENT ON TABLE derivation_model_usage IS 'Models used during result generation with token and cost tracking';
COMMENT ON TABLE derivation_timeline_events IS 'Timeline events for visualization of execution flow';
