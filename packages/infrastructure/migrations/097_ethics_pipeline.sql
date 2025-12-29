-- RADIANT v4.18.0 - Ethics Pipeline Tables
-- Supports prompt-level and synthesis-level ethics checks with rerun capability
-- Migration: 097_ethics_pipeline.sql

-- ============================================================================
-- ETHICS PIPELINE LOG TABLE
-- Tracks all ethics checks at prompt and synthesis levels
-- ============================================================================

CREATE TABLE IF NOT EXISTS ethics_pipeline_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    prompt_id VARCHAR(100),
    
    -- Check details
    check_level VARCHAR(20) NOT NULL CHECK (check_level IN ('prompt', 'synthesis', 'rerun')),
    domain VARCHAR(100),
    subspecialty VARCHAR(100),
    orchestration_mode VARCHAR(50),
    
    -- Results
    result VARCHAR(20) NOT NULL CHECK (result IN ('pass', 'warn', 'block', 'modify', 'rerun')),
    passed BOOLEAN NOT NULL,
    
    -- Violation details
    violation_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    violations JSONB DEFAULT '[]',
    
    -- Frameworks
    frameworks_applied JSONB DEFAULT '[]',
    
    -- Rerun tracking
    rerun_attempt INTEGER DEFAULT 0,
    rerun_reason TEXT,
    rerun_guidance JSONB,
    
    -- Modifications applied
    modifications_applied JSONB,
    
    -- Performance
    check_duration_ms INTEGER,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE ethics_pipeline_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ethics_pipeline_log_tenant" ON ethics_pipeline_log
    FOR SELECT USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY "ethics_pipeline_log_admin_read" ON ethics_pipeline_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id', true)::uuid
            AND u.role IN ('super_admin', 'admin', 'operator')
        )
    );

-- Indexes
CREATE INDEX idx_ethics_pipeline_tenant ON ethics_pipeline_log(tenant_id);
CREATE INDEX idx_ethics_pipeline_session ON ethics_pipeline_log(session_id);
CREATE INDEX idx_ethics_pipeline_level ON ethics_pipeline_log(check_level);
CREATE INDEX idx_ethics_pipeline_result ON ethics_pipeline_log(result);
CREATE INDEX idx_ethics_pipeline_domain ON ethics_pipeline_log(domain);
CREATE INDEX idx_ethics_pipeline_created ON ethics_pipeline_log(created_at DESC);

-- ============================================================================
-- ETHICS RERUN HISTORY TABLE
-- Tracks reruns triggered by ethics violations
-- ============================================================================

CREATE TABLE IF NOT EXISTS ethics_rerun_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    prompt_id VARCHAR(100) NOT NULL,
    
    -- Original check that triggered rerun
    original_check_id UUID REFERENCES ethics_pipeline_log(id) ON DELETE SET NULL,
    
    -- Rerun details
    rerun_attempt INTEGER NOT NULL,
    trigger_level VARCHAR(20) NOT NULL CHECK (trigger_level IN ('prompt', 'synthesis')),
    trigger_result VARCHAR(20) NOT NULL,
    
    -- Violations that triggered rerun
    triggering_violations JSONB NOT NULL DEFAULT '[]',
    
    -- Guidance provided for rerun
    rerun_guidance JSONB NOT NULL DEFAULT '[]',
    additional_instructions TEXT[],
    
    -- Outcome
    rerun_check_id UUID REFERENCES ethics_pipeline_log(id) ON DELETE SET NULL,
    rerun_successful BOOLEAN,
    final_result VARCHAR(20),
    
    -- Performance
    rerun_duration_ms INTEGER,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- RLS Policy
ALTER TABLE ethics_rerun_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ethics_rerun_history_tenant" ON ethics_rerun_history
    FOR SELECT USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- Indexes
CREATE INDEX idx_ethics_rerun_tenant ON ethics_rerun_history(tenant_id);
CREATE INDEX idx_ethics_rerun_session ON ethics_rerun_history(session_id);
CREATE INDEX idx_ethics_rerun_prompt ON ethics_rerun_history(prompt_id);

-- ============================================================================
-- ETHICS PIPELINE CONFIG TABLE
-- Per-tenant configuration for ethics pipeline behavior
-- ============================================================================

CREATE TABLE IF NOT EXISTS ethics_pipeline_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Enable/disable checks
    enable_prompt_check BOOLEAN NOT NULL DEFAULT true,
    enable_synthesis_check BOOLEAN NOT NULL DEFAULT true,
    enable_auto_rerun BOOLEAN NOT NULL DEFAULT true,
    
    -- Rerun settings
    max_rerun_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_rerun_attempts BETWEEN 1 AND 5),
    rerun_on_major_violations BOOLEAN NOT NULL DEFAULT true,
    rerun_on_minor_violations BOOLEAN NOT NULL DEFAULT false,
    
    -- Strictness levels
    prompt_strictness VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (prompt_strictness IN ('strict', 'standard', 'lenient')),
    synthesis_strictness VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (synthesis_strictness IN ('strict', 'standard', 'lenient')),
    
    -- Domain ethics
    enable_domain_ethics BOOLEAN NOT NULL DEFAULT true,
    domain_ethics_strictness VARCHAR(20) NOT NULL DEFAULT 'standard',
    
    -- General ethics (moral compass)
    enable_general_ethics BOOLEAN NOT NULL DEFAULT true,
    general_ethics_threshold DECIMAL(3, 2) NOT NULL DEFAULT 0.50 CHECK (general_ethics_threshold BETWEEN 0 AND 1),
    
    -- Blocking behavior
    block_on_critical BOOLEAN NOT NULL DEFAULT true,
    warn_only_mode BOOLEAN NOT NULL DEFAULT false,
    
    -- Modifications
    auto_apply_disclaimers BOOLEAN NOT NULL DEFAULT true,
    auto_apply_modifications BOOLEAN NOT NULL DEFAULT true,
    
    -- Logging
    log_all_checks BOOLEAN NOT NULL DEFAULT true,
    log_violations_only BOOLEAN NOT NULL DEFAULT false,
    
    -- Notifications
    notify_on_block BOOLEAN NOT NULL DEFAULT true,
    notify_on_rerun BOOLEAN NOT NULL DEFAULT false,
    notification_webhook TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE ethics_pipeline_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ethics_pipeline_config_tenant" ON ethics_pipeline_config
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid OR
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id', true)::uuid
            AND u.role IN ('super_admin', 'admin')
        )
    );

-- Insert default global config
INSERT INTO ethics_pipeline_config (
    tenant_id,
    enable_prompt_check, enable_synthesis_check, enable_auto_rerun,
    max_rerun_attempts, rerun_on_major_violations,
    prompt_strictness, synthesis_strictness,
    enable_domain_ethics, enable_general_ethics
) VALUES (
    NULL,
    true, true, true,
    3, true,
    'standard', 'standard',
    true, true
) ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get ethics pipeline stats for a tenant
CREATE OR REPLACE FUNCTION get_ethics_pipeline_stats(
    p_tenant_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_checks BIGINT,
    pass_count BIGINT,
    warn_count BIGINT,
    block_count BIGINT,
    modify_count BIGINT,
    rerun_count BIGINT,
    pass_rate DECIMAL,
    block_rate DECIMAL,
    avg_reruns_before_pass DECIMAL,
    prompt_checks BIGINT,
    synthesis_checks BIGINT,
    rerun_checks BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE result = 'pass'),
        COUNT(*) FILTER (WHERE result = 'warn'),
        COUNT(*) FILTER (WHERE result = 'block'),
        COUNT(*) FILTER (WHERE result = 'modify'),
        COUNT(*) FILTER (WHERE result = 'rerun'),
        CASE WHEN COUNT(*) > 0 THEN 
            ROUND(COUNT(*) FILTER (WHERE passed = true)::DECIMAL / COUNT(*)::DECIMAL, 3)
        ELSE 1.0 END,
        CASE WHEN COUNT(*) > 0 THEN 
            ROUND(COUNT(*) FILTER (WHERE result = 'block')::DECIMAL / COUNT(*)::DECIMAL, 3)
        ELSE 0.0 END,
        COALESCE(AVG(rerun_attempt) FILTER (WHERE passed = true AND rerun_attempt > 0), 0),
        COUNT(*) FILTER (WHERE check_level = 'prompt'),
        COUNT(*) FILTER (WHERE check_level = 'synthesis'),
        COUNT(*) FILTER (WHERE check_level = 'rerun')
    FROM ethics_pipeline_log
    WHERE tenant_id = p_tenant_id
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top violations
CREATE OR REPLACE FUNCTION get_top_ethics_violations(
    p_tenant_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    violation_rule TEXT,
    violation_type TEXT,
    occurrence_count BIGINT,
    avg_severity TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        v->>'rule' as violation_rule,
        v->>'type' as violation_type,
        COUNT(*) as occurrence_count,
        MODE() WITHIN GROUP (ORDER BY v->>'severity') as avg_severity
    FROM ethics_pipeline_log,
    LATERAL jsonb_array_elements(violations) as v
    WHERE tenant_id = p_tenant_id
    AND jsonb_array_length(violations) > 0
    GROUP BY v->>'rule', v->>'type'
    ORDER BY occurrence_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if rerun is recommended
CREATE OR REPLACE FUNCTION should_rerun_for_ethics(
    p_tenant_id UUID,
    p_result TEXT,
    p_violation_count INTEGER,
    p_rerun_attempt INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_config ethics_pipeline_config%ROWTYPE;
BEGIN
    SELECT * INTO v_config FROM ethics_pipeline_config WHERE tenant_id = p_tenant_id;
    
    IF NOT FOUND THEN
        -- Use defaults
        RETURN p_result IN ('block', 'rerun') AND p_rerun_attempt < 3;
    END IF;
    
    IF NOT v_config.enable_auto_rerun THEN
        RETURN false;
    END IF;
    
    IF p_rerun_attempt >= v_config.max_rerun_attempts THEN
        RETURN false;
    END IF;
    
    RETURN p_result IN ('block', 'rerun');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ethics_pipeline_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ethics_pipeline_config_updated
    BEFORE UPDATE ON ethics_pipeline_config
    FOR EACH ROW
    EXECUTE FUNCTION update_ethics_pipeline_config_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ethics_pipeline_log IS 'Log of all ethics checks at prompt and synthesis levels';
COMMENT ON TABLE ethics_rerun_history IS 'History of workflow reruns triggered by ethics violations';
COMMENT ON TABLE ethics_pipeline_config IS 'Per-tenant configuration for ethics pipeline behavior';

COMMENT ON FUNCTION get_ethics_pipeline_stats(UUID, INTEGER) IS 'Get ethics pipeline statistics for a tenant';
COMMENT ON FUNCTION get_top_ethics_violations(UUID, INTEGER) IS 'Get most common ethics violations for a tenant';
COMMENT ON FUNCTION should_rerun_for_ethics(UUID, TEXT, INTEGER, INTEGER) IS 'Check if rerun is recommended based on config';
