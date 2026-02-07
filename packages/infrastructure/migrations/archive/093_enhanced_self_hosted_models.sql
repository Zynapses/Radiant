-- Migration 093: Enhanced Self-Hosted Model Metadata
-- Extends self_hosted_models table with comprehensive metadata for AGI orchestration
-- RADIANT v4.18.0

-- ============================================================================
-- ENHANCED MODEL METADATA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS self_hosted_model_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id VARCHAR(100) NOT NULL UNIQUE,
    family VARCHAR(50) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    version VARCHAR(20) NOT NULL,
    parameter_count VARCHAR(20) NOT NULL,
    
    -- Modalities (stored as arrays)
    input_modalities TEXT[] NOT NULL DEFAULT '{}',
    output_modalities TEXT[] NOT NULL DEFAULT '{}',
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    
    -- Context & Generation
    context_window INTEGER NOT NULL DEFAULT 4096,
    max_output_tokens INTEGER NOT NULL DEFAULT 4096,
    
    -- Hardware Requirements
    instance_type VARCHAR(50) NOT NULL,
    min_vram INTEGER NOT NULL DEFAULT 0,
    quantization VARCHAR(20),
    tensor_parallelism INTEGER DEFAULT 1,
    
    -- Pricing
    input_price_per_1m DECIMAL(10, 4) NOT NULL DEFAULT 0,
    output_price_per_1m DECIMAL(10, 4) NOT NULL DEFAULT 0,
    
    -- Domain Strengths (JSONB for flexibility)
    domain_strengths JSONB NOT NULL DEFAULT '[]',
    
    -- Orchestration Hints (JSONB)
    orchestration JSONB NOT NULL DEFAULT '{}',
    
    -- Media Support (JSONB)
    media_support JSONB DEFAULT NULL,
    
    -- Metadata
    license VARCHAR(50) NOT NULL DEFAULT 'apache-2.0',
    commercial_use BOOLEAN NOT NULL DEFAULT true,
    release_date DATE,
    huggingface_id VARCHAR(200),
    paper_url TEXT,
    
    -- Status
    enabled BOOLEAN NOT NULL DEFAULT true,
    deprecated BOOLEAN NOT NULL DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE self_hosted_model_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self_hosted_model_metadata_read_all" ON self_hosted_model_metadata
    FOR SELECT USING (true);

CREATE POLICY "self_hosted_model_metadata_admin_write" ON self_hosted_model_metadata
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id', true)::uuid
            AND u.role IN ('super_admin', 'admin')
        )
    );

-- Indexes for efficient querying
CREATE INDEX idx_shm_metadata_family ON self_hosted_model_metadata(family);
CREATE INDEX idx_shm_metadata_capabilities ON self_hosted_model_metadata USING GIN(capabilities);
CREATE INDEX idx_shm_metadata_input_modalities ON self_hosted_model_metadata USING GIN(input_modalities);
CREATE INDEX idx_shm_metadata_output_modalities ON self_hosted_model_metadata USING GIN(output_modalities);
CREATE INDEX idx_shm_metadata_domain_strengths ON self_hosted_model_metadata USING GIN(domain_strengths);
CREATE INDEX idx_shm_metadata_orchestration ON self_hosted_model_metadata USING GIN(orchestration);
CREATE INDEX idx_shm_metadata_enabled ON self_hosted_model_metadata(enabled) WHERE enabled = true;

-- ============================================================================
-- MODEL ORCHESTRATION PREFERENCES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_orchestration_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Preferences
    preferred_families TEXT[] DEFAULT '{}',
    excluded_families TEXT[] DEFAULT '{}',
    preferred_models TEXT[] DEFAULT '{}',
    excluded_models TEXT[] DEFAULT '{}',
    
    -- Constraints
    max_cost_per_1m DECIMAL(10, 4),
    require_commercial_use BOOLEAN DEFAULT false,
    prefer_self_hosted BOOLEAN DEFAULT false,
    min_quality_tier VARCHAR(20) DEFAULT 'economy',
    max_latency_class VARCHAR(20) DEFAULT 'slow',
    
    -- Domain preferences
    domain_overrides JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

-- RLS Policy
ALTER TABLE model_orchestration_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_orchestration_preferences_tenant" ON model_orchestration_preferences
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- ============================================================================
-- MODEL USAGE ANALYTICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS self_hosted_model_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id VARCHAR(100) NOT NULL REFERENCES self_hosted_model_metadata(model_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Usage metrics
    request_count INTEGER NOT NULL DEFAULT 0,
    total_input_tokens BIGINT NOT NULL DEFAULT 0,
    total_output_tokens BIGINT NOT NULL DEFAULT 0,
    total_latency_ms BIGINT NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    
    -- Quality metrics
    avg_quality_score DECIMAL(5, 2),
    user_rating_sum INTEGER DEFAULT 0,
    user_rating_count INTEGER DEFAULT 0,
    
    -- Aggregation period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(model_id, tenant_id, period_start)
);

-- RLS Policy
ALTER TABLE self_hosted_model_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self_hosted_model_usage_tenant" ON self_hosted_model_usage
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- Index for efficient aggregation
CREATE INDEX idx_shm_usage_model_period ON self_hosted_model_usage(model_id, period_start);
CREATE INDEX idx_shm_usage_tenant_period ON self_hosted_model_usage(tenant_id, period_start);

-- ============================================================================
-- MODEL SELECTION HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_selection_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID,
    
    -- Selection context
    prompt_domain VARCHAR(100),
    prompt_subspecialty VARCHAR(100),
    required_capabilities TEXT[],
    input_modality VARCHAR(50),
    output_modality VARCHAR(50),
    
    -- Selection result
    selected_model_id VARCHAR(100) NOT NULL,
    selection_reason TEXT,
    alternatives_considered TEXT[],
    
    -- Orchestration details
    orchestration_mode VARCHAR(50),
    quality_tier VARCHAR(20),
    latency_class VARCHAR(20),
    
    -- Performance
    selection_latency_ms INTEGER,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE model_selection_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_selection_history_tenant" ON model_selection_history
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- Indexes
CREATE INDEX idx_model_selection_tenant ON model_selection_history(tenant_id, created_at DESC);
CREATE INDEX idx_model_selection_domain ON model_selection_history(prompt_domain, prompt_subspecialty);
CREATE INDEX idx_model_selection_model ON model_selection_history(selected_model_id);

-- ============================================================================
-- THINK TANK MEDIA SUPPORT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS thinktank_media_capabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id VARCHAR(100) NOT NULL REFERENCES self_hosted_model_metadata(model_id) ON DELETE CASCADE,
    
    -- Input capabilities
    supports_image_input BOOLEAN DEFAULT false,
    supports_audio_input BOOLEAN DEFAULT false,
    supports_video_input BOOLEAN DEFAULT false,
    supports_document_input BOOLEAN DEFAULT false,
    
    -- Output capabilities
    supports_image_output BOOLEAN DEFAULT false,
    supports_audio_output BOOLEAN DEFAULT false,
    supports_video_output BOOLEAN DEFAULT false,
    supports_3d_output BOOLEAN DEFAULT false,
    
    -- Limits
    max_image_size INTEGER,
    max_audio_length INTEGER,
    max_video_length INTEGER,
    max_file_size_mb INTEGER,
    
    -- Supported formats
    supported_image_formats TEXT[] DEFAULT '{}',
    supported_audio_formats TEXT[] DEFAULT '{}',
    supported_video_formats TEXT[] DEFAULT '{}',
    supported_3d_formats TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(model_id)
);

-- RLS Policy
ALTER TABLE thinktank_media_capabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "thinktank_media_capabilities_read_all" ON thinktank_media_capabilities
    FOR SELECT USING (true);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get models by capability
CREATE OR REPLACE FUNCTION get_models_by_capability(
    p_capability TEXT,
    p_min_tier INTEGER DEFAULT 1,
    p_quality_tier TEXT DEFAULT NULL
)
RETURNS TABLE (
    model_id VARCHAR(100),
    display_name VARCHAR(200),
    family VARCHAR(50),
    quality_tier TEXT,
    latency_class TEXT,
    input_price DECIMAL,
    output_price DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        shm.model_id,
        shm.display_name,
        shm.family,
        (shm.orchestration->>'qualityTier')::TEXT,
        (shm.orchestration->>'latencyClass')::TEXT,
        shm.input_price_per_1m,
        shm.output_price_per_1m
    FROM self_hosted_model_metadata shm
    WHERE shm.enabled = true
    AND p_capability = ANY(shm.capabilities)
    AND (shm.orchestration->>'minTier')::INTEGER <= p_min_tier
    AND (p_quality_tier IS NULL OR shm.orchestration->>'qualityTier' = p_quality_tier)
    ORDER BY 
        shm.input_price_per_1m ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get models by domain
CREATE OR REPLACE FUNCTION get_models_by_domain(
    p_domain TEXT,
    p_min_strength TEXT DEFAULT 'basic'
)
RETURNS TABLE (
    model_id VARCHAR(100),
    display_name VARCHAR(200),
    domain_strength TEXT,
    subspecialties TEXT[]
) AS $$
DECLARE
    v_strength_order TEXT[] := ARRAY['excellent', 'good', 'moderate', 'basic'];
    v_min_index INTEGER;
BEGIN
    v_min_index := array_position(v_strength_order, p_min_strength);
    
    RETURN QUERY
    SELECT 
        shm.model_id,
        shm.display_name,
        ds->>'strength',
        ARRAY(SELECT jsonb_array_elements_text(ds->'subspecialties'))
    FROM self_hosted_model_metadata shm,
         jsonb_array_elements(shm.domain_strengths) AS ds
    WHERE shm.enabled = true
    AND ds->>'domain' = p_domain
    AND array_position(v_strength_order, ds->>'strength') <= v_min_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get models by modality
CREATE OR REPLACE FUNCTION get_models_by_modality(
    p_input_modality TEXT DEFAULT NULL,
    p_output_modality TEXT DEFAULT NULL
)
RETURNS TABLE (
    model_id VARCHAR(100),
    display_name VARCHAR(200),
    input_modalities TEXT[],
    output_modalities TEXT[],
    capabilities TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        shm.model_id,
        shm.display_name,
        shm.input_modalities,
        shm.output_modalities,
        shm.capabilities
    FROM self_hosted_model_metadata shm
    WHERE shm.enabled = true
    AND (p_input_modality IS NULL OR p_input_modality = ANY(shm.input_modalities))
    AND (p_output_modality IS NULL OR p_output_modality = ANY(shm.output_modalities));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_shm_metadata_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_shm_metadata_updated
    BEFORE UPDATE ON self_hosted_model_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_shm_metadata_timestamp();

CREATE TRIGGER trigger_orchestration_prefs_updated
    BEFORE UPDATE ON model_orchestration_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_shm_metadata_timestamp();

CREATE TRIGGER trigger_media_capabilities_updated
    BEFORE UPDATE ON thinktank_media_capabilities
    FOR EACH ROW
    EXECUTE FUNCTION update_shm_metadata_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE self_hosted_model_metadata IS 'Comprehensive metadata for 56 self-hosted AI models with orchestration hints';
COMMENT ON TABLE model_orchestration_preferences IS 'Tenant-specific model selection preferences';
COMMENT ON TABLE self_hosted_model_usage IS 'Usage analytics for self-hosted models per tenant';
COMMENT ON TABLE model_selection_history IS 'History of model selections by the orchestration engine';
COMMENT ON TABLE thinktank_media_capabilities IS 'Media input/output capabilities for Think Tank integration';

-- ============================================================================
-- MODEL PROFICIENCY RANKINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_proficiency_rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id VARCHAR(100) NOT NULL REFERENCES self_hosted_model_metadata(model_id) ON DELETE CASCADE,
    
    -- Domain proficiencies (0-100 scores)
    domain VARCHAR(100) NOT NULL,
    subspecialty VARCHAR(100),
    proficiency_score DECIMAL(5, 2) NOT NULL DEFAULT 0,
    rank_in_domain INTEGER NOT NULL DEFAULT 0,
    strength_level VARCHAR(20) NOT NULL DEFAULT 'basic',
    
    -- Orchestration mode proficiencies
    orchestration_mode VARCHAR(50),
    mode_score DECIMAL(5, 2),
    rank_in_mode INTEGER,
    
    -- Computed metrics
    capability_match_count INTEGER DEFAULT 0,
    total_capabilities INTEGER DEFAULT 0,
    
    -- Timestamps
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(model_id, domain, subspecialty, orchestration_mode)
);

-- RLS Policy
ALTER TABLE model_proficiency_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_proficiency_rankings_read_all" ON model_proficiency_rankings
    FOR SELECT USING (true);

-- Indexes for efficient querying
CREATE INDEX idx_mpr_model_domain ON model_proficiency_rankings(model_id, domain);
CREATE INDEX idx_mpr_domain_rank ON model_proficiency_rankings(domain, rank_in_domain);
CREATE INDEX idx_mpr_mode_rank ON model_proficiency_rankings(orchestration_mode, rank_in_mode);
CREATE INDEX idx_mpr_score ON model_proficiency_rankings(proficiency_score DESC);

-- ============================================================================
-- MODEL DISCOVERY LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_discovery_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id VARCHAR(100) NOT NULL,
    discovery_source VARCHAR(50) NOT NULL, -- 'admin', 'registry_sync', 'huggingface', 'auto'
    discovered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Discovery details
    model_family VARCHAR(50),
    parameter_count VARCHAR(20),
    capabilities_detected TEXT[],
    
    -- Proficiency generation
    proficiencies_generated BOOLEAN DEFAULT false,
    generation_timestamp TIMESTAMPTZ,
    generation_duration_ms INTEGER,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE model_discovery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_discovery_log_admin_only" ON model_discovery_log
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id', true)::uuid
            AND u.role IN ('super_admin', 'admin')
        )
    );

-- ============================================================================
-- FUNCTIONS FOR PROFICIENCY MANAGEMENT
-- ============================================================================

-- Function to get top N models for a domain
CREATE OR REPLACE FUNCTION get_top_models_for_domain(
    p_domain TEXT,
    p_subspecialty TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    model_id VARCHAR(100),
    display_name VARCHAR(200),
    rank INTEGER,
    score DECIMAL,
    strength_level VARCHAR(20),
    quality_tier TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mpr.model_id,
        shm.display_name,
        mpr.rank_in_domain,
        mpr.proficiency_score,
        mpr.strength_level,
        (shm.orchestration->>'qualityTier')::TEXT
    FROM model_proficiency_rankings mpr
    JOIN self_hosted_model_metadata shm ON mpr.model_id = shm.model_id
    WHERE mpr.domain = p_domain
    AND (p_subspecialty IS NULL OR mpr.subspecialty = p_subspecialty)
    AND shm.enabled = true
    ORDER BY mpr.rank_in_domain ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top N models for an orchestration mode
CREATE OR REPLACE FUNCTION get_top_models_for_mode(
    p_mode TEXT,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    model_id VARCHAR(100),
    display_name VARCHAR(200),
    rank INTEGER,
    score DECIMAL,
    quality_tier TEXT,
    latency_class TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mpr.model_id,
        shm.display_name,
        mpr.rank_in_mode,
        mpr.mode_score,
        (shm.orchestration->>'qualityTier')::TEXT,
        (shm.orchestration->>'latencyClass')::TEXT
    FROM model_proficiency_rankings mpr
    JOIN self_hosted_model_metadata shm ON mpr.model_id = shm.model_id
    WHERE mpr.orchestration_mode = p_mode
    AND shm.enabled = true
    ORDER BY mpr.rank_in_mode ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to trigger proficiency generation for a new model
CREATE OR REPLACE FUNCTION trigger_proficiency_generation(
    p_model_id TEXT,
    p_source TEXT DEFAULT 'admin'
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO model_discovery_log (model_id, discovery_source, status)
    VALUES (p_model_id, p_source, 'pending')
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete proficiency generation
CREATE OR REPLACE FUNCTION complete_proficiency_generation(
    p_log_id UUID,
    p_duration_ms INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE model_discovery_log
    SET 
        proficiencies_generated = true,
        generation_timestamp = NOW(),
        generation_duration_ms = p_duration_ms,
        status = 'completed'
    WHERE id = p_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE model_proficiency_rankings IS 'Ranked proficiency scores for models across domains and orchestration modes';
COMMENT ON TABLE model_discovery_log IS 'Log of model discoveries with proficiency generation status';
