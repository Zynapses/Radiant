-- ============================================================================
-- RADIANT v7.24.0 - Model Weights, Drift Correction & Admin AI Helper
-- 
-- Tables:
--   1. model_weight_config         - Per-tenant per-model weight configuration + computed scores
--   2. model_weight_history        - Weight calculation history for audit trail
--   3. drift_correction_actions    - Log of all drift correction actions taken
--   4. bedrock_model_registry      - Discovered Bedrock models (global, not per-tenant)
--   5. admin_ai_helper_config      - Per-tenant AI helper configuration (Bedrock model, auto-upgrade, polling)
--   6. admin_ai_helper_conversations - AI helper conversation history
--
-- Functions:
--   - calculate_composite_weight()  - Compute model composite weight from factor scores
--   - apply_drift_penalty()         - Apply drift-based weight penalty to a model
--   - quarantine_model()            - Quarantine a drifted model
--   - unquarantine_model()          - Remove quarantine from a model
--   - get_weighted_models()         - Get models sorted by composite weight for routing
-- ============================================================================

-- ============================================================================
-- 1. model_weight_config
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_weight_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id VARCHAR(200) NOT NULL,

    -- Manual weight override (NULL = auto-calculated from factors)
    manual_weight_override DOUBLE PRECISION,

    -- Factor weights (how much each factor contributes to composite score)
    drift_factor_weight DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    quality_factor_weight DOUBLE PRECISION NOT NULL DEFAULT 0.30,
    latency_factor_weight DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    cost_factor_weight DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    availability_factor_weight DOUBLE PRECISION NOT NULL DEFAULT 0.15,

    -- Current computed factor scores (0.0 = worst, 1.0 = best)
    current_drift_score DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    current_quality_score DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    current_latency_score DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    current_cost_score DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    current_availability_score DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    -- Final composite weight (product of factor weights and scores)
    current_composite_weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    -- Drift correction settings
    drift_quarantine_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    drift_penalty_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    drift_auto_quarantine BOOLEAN NOT NULL DEFAULT true,
    drift_auto_fallback_model_id VARCHAR(200),
    drift_temperature_correction DOUBLE PRECISION,
    drift_prompt_prefix_correction TEXT,

    -- Quarantine state
    is_quarantined BOOLEAN NOT NULL DEFAULT false,
    quarantined_at TIMESTAMPTZ,
    quarantine_reason TEXT,
    quarantine_expires_at TIMESTAMPTZ,
    quarantine_auto_release BOOLEAN NOT NULL DEFAULT true,

    -- Metadata
    last_weight_calculation_at TIMESTAMPTZ,
    last_drift_check_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, model_id)
);

ALTER TABLE model_weight_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY model_weight_config_tenant_isolation ON model_weight_config
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX idx_model_weight_config_tenant ON model_weight_config(tenant_id);
CREATE INDEX idx_model_weight_config_quarantined ON model_weight_config(tenant_id, is_quarantined) WHERE is_quarantined = true;
CREATE INDEX idx_model_weight_config_composite ON model_weight_config(tenant_id, current_composite_weight DESC);

-- ============================================================================
-- 2. model_weight_history
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_weight_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id VARCHAR(200) NOT NULL,

    drift_score DOUBLE PRECISION,
    quality_score DOUBLE PRECISION,
    latency_score DOUBLE PRECISION,
    cost_score DOUBLE PRECISION,
    availability_score DOUBLE PRECISION,
    composite_weight DOUBLE PRECISION NOT NULL,

    calculation_method VARCHAR(50) NOT NULL DEFAULT 'auto',
    factors JSONB NOT NULL DEFAULT '{}',
    trigger_source VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE model_weight_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY model_weight_history_tenant_isolation ON model_weight_history
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX idx_model_weight_history_tenant_model ON model_weight_history(tenant_id, model_id, created_at DESC);
CREATE INDEX idx_model_weight_history_created ON model_weight_history(created_at DESC);

-- ============================================================================
-- 3. drift_correction_actions
-- ============================================================================

CREATE TABLE IF NOT EXISTS drift_correction_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id VARCHAR(200) NOT NULL,

    action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
        'quarantine', 'unquarantine', 'weight_penalty', 'weight_restore',
        'fallback_activated', 'fallback_deactivated',
        'temperature_adjust', 'temperature_restore',
        'prompt_adjust', 'prompt_restore',
        'manual_override', 'auto_correction'
    )),
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN (
        'auto_drift', 'manual', 'scheduled', 'ai_recommendation', 'threshold_breach', 'quarantine_expiry'
    )),

    previous_state JSONB NOT NULL DEFAULT '{}',
    new_state JSONB NOT NULL DEFAULT '{}',
    drift_report JSONB,
    reason TEXT,

    performed_by UUID,
    reverted_at TIMESTAMPTZ,
    reverted_by UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE drift_correction_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY drift_correction_actions_tenant_isolation ON drift_correction_actions
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX idx_drift_correction_actions_tenant ON drift_correction_actions(tenant_id, created_at DESC);
CREATE INDEX idx_drift_correction_actions_model ON drift_correction_actions(tenant_id, model_id, created_at DESC);

-- ============================================================================
-- 4. bedrock_model_registry (global — not tenant-scoped)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bedrock_model_registry (
    id VARCHAR(200) PRIMARY KEY,
    model_name VARCHAR(200) NOT NULL,
    provider_name VARCHAR(100) NOT NULL,
    model_arn VARCHAR(500),

    input_modalities TEXT[] DEFAULT '{}',
    output_modalities TEXT[] DEFAULT '{}',
    response_streaming_supported BOOLEAN DEFAULT false,
    customizations_supported TEXT[] DEFAULT '{}',
    inference_types_supported TEXT[] DEFAULT '{}',
    model_lifecycle_status VARCHAR(50),

    model_version VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_available_for_inference BOOLEAN NOT NULL DEFAULT true,

    input_price_per_1k_tokens DOUBLE PRECISION,
    output_price_per_1k_tokens DOUBLE PRECISION,

    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_bedrock_model_registry_provider ON bedrock_model_registry(provider_name);
CREATE INDEX idx_bedrock_model_registry_active ON bedrock_model_registry(is_active, is_available_for_inference);

-- ============================================================================
-- 5. admin_ai_helper_config
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_ai_helper_config (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,

    enabled BOOLEAN NOT NULL DEFAULT true,
    bedrock_model_id VARCHAR(200) NOT NULL DEFAULT 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    bedrock_region VARCHAR(50) NOT NULL DEFAULT 'us-east-1',

    auto_upgrade_model BOOLEAN NOT NULL DEFAULT true,
    preferred_model_family VARCHAR(100) DEFAULT 'anthropic.claude',
    max_tokens INTEGER NOT NULL DEFAULT 4096,
    temperature DOUBLE PRECISION NOT NULL DEFAULT 0.3,

    model_poll_interval_hours INTEGER NOT NULL DEFAULT 24,
    last_model_poll_at TIMESTAMPTZ,
    last_auto_upgrade_at TIMESTAMPTZ,
    last_auto_upgrade_from VARCHAR(200),
    last_auto_upgrade_to VARCHAR(200),

    include_page_data BOOLEAN NOT NULL DEFAULT true,
    include_system_metrics BOOLEAN NOT NULL DEFAULT true,
    max_context_tokens INTEGER NOT NULL DEFAULT 8000,

    system_prompt_override TEXT,

    total_requests INTEGER NOT NULL DEFAULT 0,
    total_input_tokens BIGINT NOT NULL DEFAULT 0,
    total_output_tokens BIGINT NOT NULL DEFAULT 0,
    total_cost_cents DOUBLE PRECISION NOT NULL DEFAULT 0,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID
);

-- ============================================================================
-- 6. admin_ai_helper_conversations
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_ai_helper_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID,
    admin_page VARCHAR(200) NOT NULL,
    
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    
    model_id VARCHAR(200),
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    cost_cents DOUBLE PRECISION,

    page_context JSONB,
    metadata JSONB NOT NULL DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_ai_helper_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_ai_helper_conversations_tenant_isolation ON admin_ai_helper_conversations
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE INDEX idx_admin_ai_helper_conversations_tenant ON admin_ai_helper_conversations(tenant_id, admin_page, created_at DESC);
CREATE INDEX idx_admin_ai_helper_conversations_user ON admin_ai_helper_conversations(tenant_id, user_id, admin_page, created_at DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Calculate composite weight from factor scores and weights
CREATE OR REPLACE FUNCTION calculate_composite_weight(
    p_tenant_id UUID,
    p_model_id VARCHAR
) RETURNS DOUBLE PRECISION AS $$
DECLARE
    v_config model_weight_config%ROWTYPE;
    v_composite DOUBLE PRECISION;
BEGIN
    SELECT * INTO v_config FROM model_weight_config
    WHERE tenant_id = p_tenant_id AND model_id = p_model_id;

    IF NOT FOUND THEN
        RETURN 1.0;
    END IF;

    -- If manual override is set, use it directly
    IF v_config.manual_weight_override IS NOT NULL THEN
        RETURN v_config.manual_weight_override;
    END IF;

    -- If quarantined, weight is 0
    IF v_config.is_quarantined THEN
        -- Check if quarantine has expired
        IF v_config.quarantine_expires_at IS NOT NULL AND v_config.quarantine_expires_at < NOW() AND v_config.quarantine_auto_release THEN
            UPDATE model_weight_config SET is_quarantined = false, quarantined_at = NULL, quarantine_reason = NULL, quarantine_expires_at = NULL, updated_at = NOW()
            WHERE tenant_id = p_tenant_id AND model_id = p_model_id;
        ELSE
            RETURN 0.0;
        END IF;
    END IF;

    -- Calculate weighted composite score
    v_composite := (
        v_config.current_drift_score * v_config.drift_factor_weight +
        v_config.current_quality_score * v_config.quality_factor_weight +
        v_config.current_latency_score * v_config.latency_factor_weight +
        v_config.current_cost_score * v_config.cost_factor_weight +
        v_config.current_availability_score * v_config.availability_factor_weight
    );

    -- Clamp to [0, 1]
    v_composite := GREATEST(0.0, LEAST(1.0, v_composite));

    -- Update stored composite
    UPDATE model_weight_config
    SET current_composite_weight = v_composite, last_weight_calculation_at = NOW(), updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND model_id = p_model_id;

    -- Record history
    INSERT INTO model_weight_history (tenant_id, model_id, drift_score, quality_score, latency_score, cost_score, availability_score, composite_weight, calculation_method, factors, trigger_source)
    VALUES (p_tenant_id, p_model_id, v_config.current_drift_score, v_config.current_quality_score, v_config.current_latency_score, v_config.current_cost_score, v_config.current_availability_score, v_composite, 'auto', jsonb_build_object('drift_factor_weight', v_config.drift_factor_weight, 'quality_factor_weight', v_config.quality_factor_weight, 'latency_factor_weight', v_config.latency_factor_weight, 'cost_factor_weight', v_config.cost_factor_weight, 'availability_factor_weight', v_config.availability_factor_weight), 'calculate_composite_weight');

    RETURN v_composite;
END;
$$ LANGUAGE plpgsql;

-- Apply drift penalty to a model
CREATE OR REPLACE FUNCTION apply_drift_penalty(
    p_tenant_id UUID,
    p_model_id VARCHAR,
    p_drift_score DOUBLE PRECISION,
    p_performed_by UUID DEFAULT NULL
) RETURNS TABLE(success BOOLEAN, action_taken VARCHAR, new_weight DOUBLE PRECISION, message TEXT) AS $$
DECLARE
    v_config model_weight_config%ROWTYPE;
    v_old_drift DOUBLE PRECISION;
    v_new_composite DOUBLE PRECISION;
    v_action VARCHAR;
BEGIN
    -- Ensure config exists
    INSERT INTO model_weight_config (tenant_id, model_id)
    VALUES (p_tenant_id, p_model_id)
    ON CONFLICT (tenant_id, model_id) DO NOTHING;

    SELECT * INTO v_config FROM model_weight_config
    WHERE tenant_id = p_tenant_id AND model_id = p_model_id;

    v_old_drift := v_config.current_drift_score;

    -- Update drift score
    UPDATE model_weight_config SET current_drift_score = p_drift_score, last_drift_check_at = NOW(), updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND model_id = p_model_id;

    -- Check if quarantine needed
    IF p_drift_score < v_config.drift_quarantine_threshold AND v_config.drift_auto_quarantine AND NOT v_config.is_quarantined THEN
        v_action := 'quarantine';
        UPDATE model_weight_config
        SET is_quarantined = true, quarantined_at = NOW(), quarantine_reason = 'Auto-quarantined: drift score ' || p_drift_score::text || ' below threshold ' || v_config.drift_quarantine_threshold::text,
            quarantine_expires_at = NOW() + INTERVAL '24 hours', updated_at = NOW()
        WHERE tenant_id = p_tenant_id AND model_id = p_model_id;

        INSERT INTO drift_correction_actions (tenant_id, model_id, action_type, trigger_type, previous_state, new_state, reason, performed_by)
        VALUES (p_tenant_id, p_model_id, 'quarantine', CASE WHEN p_performed_by IS NULL THEN 'auto_drift' ELSE 'manual' END,
                jsonb_build_object('drift_score', v_old_drift, 'is_quarantined', false),
                jsonb_build_object('drift_score', p_drift_score, 'is_quarantined', true),
                'Drift score ' || p_drift_score::text || ' below quarantine threshold ' || v_config.drift_quarantine_threshold::text,
                p_performed_by);

        RETURN QUERY SELECT true, 'quarantine'::VARCHAR, 0.0::DOUBLE PRECISION, ('Model quarantined: drift score ' || p_drift_score::text)::TEXT;
        RETURN;

    ELSIF p_drift_score < v_config.drift_penalty_threshold THEN
        v_action := 'weight_penalty';
        INSERT INTO drift_correction_actions (tenant_id, model_id, action_type, trigger_type, previous_state, new_state, reason, performed_by)
        VALUES (p_tenant_id, p_model_id, 'weight_penalty', CASE WHEN p_performed_by IS NULL THEN 'auto_drift' ELSE 'manual' END,
                jsonb_build_object('drift_score', v_old_drift),
                jsonb_build_object('drift_score', p_drift_score),
                'Drift penalty applied: score ' || p_drift_score::text || ' below penalty threshold ' || v_config.drift_penalty_threshold::text,
                p_performed_by);
    ELSE
        v_action := 'none';
    END IF;

    -- Recalculate composite weight
    v_new_composite := calculate_composite_weight(p_tenant_id, p_model_id);

    RETURN QUERY SELECT true, v_action, v_new_composite, ('Drift score updated to ' || p_drift_score::text || ', composite weight: ' || v_new_composite::text)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Quarantine a model explicitly
CREATE OR REPLACE FUNCTION quarantine_model(
    p_tenant_id UUID,
    p_model_id VARCHAR,
    p_reason TEXT,
    p_duration_hours INTEGER DEFAULT 24,
    p_performed_by UUID DEFAULT NULL
) RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
BEGIN
    INSERT INTO model_weight_config (tenant_id, model_id) VALUES (p_tenant_id, p_model_id)
    ON CONFLICT (tenant_id, model_id) DO NOTHING;

    UPDATE model_weight_config
    SET is_quarantined = true, quarantined_at = NOW(), quarantine_reason = p_reason,
        quarantine_expires_at = NOW() + (p_duration_hours || ' hours')::INTERVAL,
        current_composite_weight = 0.0, updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND model_id = p_model_id;

    INSERT INTO drift_correction_actions (tenant_id, model_id, action_type, trigger_type, previous_state, new_state, reason, performed_by)
    VALUES (p_tenant_id, p_model_id, 'quarantine', CASE WHEN p_performed_by IS NULL THEN 'auto_drift' ELSE 'manual' END,
            '{}', jsonb_build_object('is_quarantined', true, 'quarantine_expires_at', (NOW() + (p_duration_hours || ' hours')::INTERVAL)::text),
            p_reason, p_performed_by);

    RETURN QUERY SELECT true, ('Model ' || p_model_id || ' quarantined for ' || p_duration_hours || ' hours: ' || p_reason)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Unquarantine a model
CREATE OR REPLACE FUNCTION unquarantine_model(
    p_tenant_id UUID,
    p_model_id VARCHAR,
    p_performed_by UUID DEFAULT NULL
) RETURNS TABLE(success BOOLEAN, new_weight DOUBLE PRECISION, message TEXT) AS $$
DECLARE
    v_composite DOUBLE PRECISION;
BEGIN
    UPDATE model_weight_config
    SET is_quarantined = false, quarantined_at = NULL, quarantine_reason = NULL, quarantine_expires_at = NULL, updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND model_id = p_model_id;

    INSERT INTO drift_correction_actions (tenant_id, model_id, action_type, trigger_type, previous_state, new_state, reason, performed_by)
    VALUES (p_tenant_id, p_model_id, 'unquarantine', CASE WHEN p_performed_by IS NULL THEN 'quarantine_expiry' ELSE 'manual' END,
            jsonb_build_object('is_quarantined', true), jsonb_build_object('is_quarantined', false),
            'Quarantine released', p_performed_by);

    v_composite := calculate_composite_weight(p_tenant_id, p_model_id);

    RETURN QUERY SELECT true, v_composite, ('Model ' || p_model_id || ' unquarantined, new weight: ' || v_composite::text)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Get models sorted by composite weight for routing decisions
CREATE OR REPLACE FUNCTION get_weighted_models(
    p_tenant_id UUID,
    p_capability VARCHAR DEFAULT NULL,
    p_exclude_quarantined BOOLEAN DEFAULT true
) RETURNS TABLE(
    model_id VARCHAR,
    composite_weight DOUBLE PRECISION,
    drift_score DOUBLE PRECISION,
    quality_score DOUBLE PRECISION,
    latency_score DOUBLE PRECISION,
    cost_score DOUBLE PRECISION,
    availability_score DOUBLE PRECISION,
    is_quarantined BOOLEAN,
    manual_override DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mwc.model_id::VARCHAR,
        COALESCE(mwc.manual_weight_override, mwc.current_composite_weight) as composite_weight,
        mwc.current_drift_score,
        mwc.current_quality_score,
        mwc.current_latency_score,
        mwc.current_cost_score,
        mwc.current_availability_score,
        mwc.is_quarantined,
        mwc.manual_weight_override
    FROM model_weight_config mwc
    WHERE mwc.tenant_id = p_tenant_id
        AND (NOT p_exclude_quarantined OR NOT mwc.is_quarantined)
    ORDER BY COALESCE(mwc.manual_weight_override, mwc.current_composite_weight) DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger: auto-update updated_at on model_weight_config
-- ============================================================================

CREATE OR REPLACE FUNCTION update_model_weight_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER model_weight_config_updated
    BEFORE UPDATE ON model_weight_config
    FOR EACH ROW EXECUTE FUNCTION update_model_weight_config_timestamp();
