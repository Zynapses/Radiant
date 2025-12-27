-- Migration: 061_model_metadata_engine.sql
-- RADIANT v4.18.0 - Comprehensive Model Metadata Engine
-- Auto-updating metadata with internet research and AI integration

-- ============================================================================
-- MODEL METADATA - Comprehensive information about each model
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_metadata (
    metadata_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(200) NOT NULL UNIQUE,
    
    -- Basic identification
    provider VARCHAR(100) NOT NULL,
    model_name VARCHAR(300) NOT NULL,
    model_family VARCHAR(100), -- 'gpt', 'claude', 'llama', 'gemini', etc.
    version VARCHAR(50),
    release_date DATE,
    
    -- Capabilities
    capabilities JSONB DEFAULT '{}', -- {reasoning, coding, vision, etc.}
    supported_modalities JSONB DEFAULT '{}', -- {input: [], output: []}
    specialties TEXT[] DEFAULT '{}', -- What it's particularly good at
    weaknesses TEXT[] DEFAULT '{}', -- Known limitations
    
    -- Technical specs
    context_window INTEGER,
    max_output_tokens INTEGER,
    training_cutoff DATE,
    parameter_count BIGINT, -- In billions
    architecture VARCHAR(100), -- 'transformer', 'moe', etc.
    
    -- Performance benchmarks
    benchmarks JSONB DEFAULT '{}', -- {mmlu: 0.89, humaneval: 0.85, etc.}
    benchmark_date DATE,
    
    -- Pricing
    input_price_per_1m DECIMAL(10,4),
    output_price_per_1m DECIMAL(10,4),
    price_currency VARCHAR(10) DEFAULT 'USD',
    price_updated_at TIMESTAMPTZ,
    
    -- Availability
    regions_available TEXT[] DEFAULT '{}',
    api_endpoints JSONB DEFAULT '{}',
    rate_limits JSONB DEFAULT '{}', -- {rpm, tpm, rpd}
    
    -- Usage guidelines
    best_use_cases JSONB DEFAULT '[]',
    not_recommended_for JSONB DEFAULT '[]',
    prompt_tips JSONB DEFAULT '[]',
    system_prompt_support BOOLEAN DEFAULT true,
    function_calling_support BOOLEAN DEFAULT false,
    json_mode_support BOOLEAN DEFAULT false,
    streaming_support BOOLEAN DEFAULT true,
    
    -- Safety & Compliance
    content_filtering JSONB DEFAULT '{}',
    safety_settings JSONB DEFAULT '{}',
    compliance_certifications TEXT[] DEFAULT '{}', -- 'SOC2', 'HIPAA', etc.
    data_retention_policy TEXT,
    
    -- Documentation links
    official_docs_url TEXT,
    api_reference_url TEXT,
    changelog_url TEXT,
    
    -- Quality indicators
    reliability_score DECIMAL(5,4), -- Based on uptime/errors
    quality_score DECIMAL(5,4), -- Based on user feedback
    speed_score DECIMAL(5,4), -- Based on latency
    value_score DECIMAL(5,4), -- Quality per cost
    
    -- Metadata status
    metadata_completeness DECIMAL(5,4) DEFAULT 0, -- How complete is this metadata
    metadata_confidence DECIMAL(5,4) DEFAULT 0.5, -- Confidence in accuracy
    last_verified TIMESTAMPTZ,
    verification_source VARCHAR(100),
    
    -- Admin control
    admin_notes TEXT,
    admin_override JSONB DEFAULT '{}', -- Admin can override any field
    
    -- Flags
    is_available BOOLEAN DEFAULT true,
    is_deprecated BOOLEAN DEFAULT false,
    deprecation_date DATE,
    successor_model_id VARCHAR(200),
    requires_approval BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_model_metadata_model ON model_metadata(model_id);
CREATE INDEX idx_model_metadata_provider ON model_metadata(provider);
CREATE INDEX idx_model_metadata_family ON model_metadata(model_family);
CREATE INDEX idx_model_metadata_available ON model_metadata(is_available) WHERE is_available = true;

-- ============================================================================
-- METADATA SOURCES - Where metadata comes from
-- ============================================================================

CREATE TABLE IF NOT EXISTS metadata_sources (
    source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source identification
    name VARCHAR(200) NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- 'official_api', 'documentation', 'benchmark', 'news', 'research_paper'
    url TEXT,
    
    -- Reliability
    trust_score DECIMAL(5,4) DEFAULT 0.5, -- How reliable is this source
    is_official BOOLEAN DEFAULT false,
    
    -- Access
    requires_auth BOOLEAN DEFAULT false,
    api_key_env_var VARCHAR(100),
    rate_limit_per_hour INTEGER,
    
    -- Parsing
    parser_type VARCHAR(50), -- 'json', 'html', 'rss', 'api'
    parser_config JSONB DEFAULT '{}',
    
    -- Schedule
    refresh_interval_hours INTEGER DEFAULT 24,
    last_fetched TIMESTAMPTZ,
    next_fetch TIMESTAMPTZ,
    
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed official sources
INSERT INTO metadata_sources (name, source_type, url, trust_score, is_official, parser_type, refresh_interval_hours) VALUES
('OpenAI API Models', 'official_api', 'https://api.openai.com/v1/models', 1.0, true, 'api', 24),
('Anthropic Models', 'official_api', 'https://docs.anthropic.com/models', 1.0, true, 'html', 24),
('Google AI Models', 'official_api', 'https://ai.google.dev/models', 1.0, true, 'html', 24),
('Hugging Face Hub', 'documentation', 'https://huggingface.co/models', 0.9, false, 'api', 12),
('Papers With Code', 'benchmark', 'https://paperswithcode.com/sota', 0.85, false, 'html', 168),
('AI News Sources', 'news', 'https://www.artificialintelligence-news.com', 0.6, false, 'rss', 6)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- METADATA RESEARCH HISTORY - Track all metadata updates
-- ============================================================================

CREATE TABLE IF NOT EXISTS metadata_research_history (
    research_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- What was researched
    model_id VARCHAR(200),
    research_type VARCHAR(50) NOT NULL, -- 'scheduled', 'manual', 'new_model', 'triggered'
    
    -- Sources used
    sources_queried UUID[] DEFAULT '{}',
    sources_successful UUID[] DEFAULT '{}',
    
    -- Findings
    raw_findings JSONB DEFAULT '{}', -- Raw data from sources
    ai_synthesis JSONB DEFAULT '{}', -- AI-processed findings
    
    -- Changes made
    fields_updated TEXT[] DEFAULT '{}',
    previous_values JSONB DEFAULT '{}',
    new_values JSONB DEFAULT '{}',
    
    -- AI reasoning
    ai_confidence DECIMAL(5,4),
    ai_reasoning TEXT,
    conflicts_detected JSONB DEFAULT '[]', -- Conflicting info from sources
    conflict_resolution TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'completed', -- 'pending', 'in_progress', 'completed', 'failed'
    error_message TEXT,
    
    -- Admin review
    requires_review BOOLEAN DEFAULT false,
    reviewed_by VARCHAR(200),
    review_decision VARCHAR(20), -- 'approved', 'rejected', 'modified'
    review_notes TEXT,
    
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER
);

CREATE INDEX idx_metadata_research_history_model ON metadata_research_history(model_id);
CREATE INDEX idx_metadata_research_history_pending ON metadata_research_history(status) WHERE status IN ('pending', 'in_progress');

-- ============================================================================
-- METADATA REFRESH SCHEDULE - Admin-configurable schedule
-- ============================================================================

CREATE TABLE IF NOT EXISTS metadata_refresh_schedule (
    schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Schedule name
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- What to refresh
    scope VARCHAR(50) NOT NULL, -- 'all', 'provider', 'model', 'category'
    scope_filter JSONB DEFAULT '{}', -- {provider: 'openai'} or {models: [...]}
    
    -- When to refresh
    schedule_type VARCHAR(20) NOT NULL, -- 'cron', 'interval', 'manual'
    cron_expression VARCHAR(100), -- e.g., '0 0 * * *' for daily at midnight
    interval_hours INTEGER,
    
    -- Research settings
    research_depth VARCHAR(20) DEFAULT 'standard', -- 'quick', 'standard', 'deep'
    include_benchmarks BOOLEAN DEFAULT true,
    include_pricing BOOLEAN DEFAULT true,
    include_availability BOOLEAN DEFAULT true,
    
    -- Notification
    notify_on_changes BOOLEAN DEFAULT true,
    notify_email TEXT,
    
    -- Status
    enabled BOOLEAN DEFAULT true,
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    last_run_status VARCHAR(20),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default schedules
INSERT INTO metadata_refresh_schedule (tenant_id, name, scope, schedule_type, cron_expression, research_depth) VALUES
(NULL, 'Daily Quick Refresh', 'all', 'cron', '0 6 * * *', 'quick'),
(NULL, 'Weekly Deep Research', 'all', 'cron', '0 2 * * 0', 'deep'),
(NULL, 'Pricing Update', 'all', 'cron', '0 0 * * 1', 'standard')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- METADATA VALIDATION RULES - Gate for model addition
-- ============================================================================

CREATE TABLE IF NOT EXISTS metadata_validation_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Rule definition
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- What to validate
    field_name VARCHAR(100) NOT NULL,
    validation_type VARCHAR(50) NOT NULL, -- 'required', 'min_value', 'max_value', 'pattern', 'enum', 'custom'
    validation_config JSONB NOT NULL,
    
    -- Severity
    severity VARCHAR(20) DEFAULT 'error', -- 'error', 'warning', 'info'
    
    -- When to apply
    applies_to_providers TEXT[] DEFAULT '{}', -- Empty = all
    applies_to_categories TEXT[] DEFAULT '{}',
    
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default validation rules
INSERT INTO metadata_validation_rules (name, field_name, validation_type, validation_config, severity) VALUES
('Model name required', 'model_name', 'required', '{}', 'error'),
('Provider required', 'provider', 'required', '{}', 'error'),
('Context window required', 'context_window', 'required', '{}', 'error'),
('Pricing required', 'input_price_per_1m', 'required', '{}', 'warning'),
('Capabilities required', 'capabilities', 'required', '{"min_items": 1}', 'warning'),
('Valid context window', 'context_window', 'min_value', '{"min": 1024}', 'error'),
('Benchmark data recommended', 'benchmarks', 'required', '{"min_items": 1}', 'info'),
('Documentation URL', 'official_docs_url', 'pattern', '{"pattern": "^https://"}', 'info')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Calculate metadata completeness
CREATE OR REPLACE FUNCTION calculate_metadata_completeness(p_model_id VARCHAR)
RETURNS DECIMAL AS $$
DECLARE
    v_metadata RECORD;
    v_total_fields INTEGER := 20;
    v_filled_fields INTEGER := 0;
BEGIN
    SELECT * INTO v_metadata FROM model_metadata WHERE model_id = p_model_id;
    
    IF v_metadata IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Count filled fields
    IF v_metadata.model_name IS NOT NULL THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.provider IS NOT NULL THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.model_family IS NOT NULL THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.context_window IS NOT NULL THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.max_output_tokens IS NOT NULL THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.capabilities != '{}' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.supported_modalities != '{}' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF array_length(v_metadata.specialties, 1) > 0 THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.benchmarks != '{}' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.input_price_per_1m IS NOT NULL THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.output_price_per_1m IS NOT NULL THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF array_length(v_metadata.regions_available, 1) > 0 THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.rate_limits != '{}' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.best_use_cases != '[]' THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.official_docs_url IS NOT NULL THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.reliability_score IS NOT NULL THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.quality_score IS NOT NULL THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.training_cutoff IS NOT NULL THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.release_date IS NOT NULL THEN v_filled_fields := v_filled_fields + 1; END IF;
    IF v_metadata.architecture IS NOT NULL THEN v_filled_fields := v_filled_fields + 1; END IF;
    
    -- Update the metadata record
    UPDATE model_metadata 
    SET metadata_completeness = v_filled_fields::DECIMAL / v_total_fields
    WHERE model_id = p_model_id;
    
    RETURN v_filled_fields::DECIMAL / v_total_fields;
END;
$$ LANGUAGE plpgsql;

-- Validate model metadata before addition
CREATE OR REPLACE FUNCTION validate_model_metadata(p_model_id VARCHAR)
RETURNS TABLE(
    rule_name VARCHAR,
    field_name VARCHAR,
    severity VARCHAR,
    passed BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_metadata RECORD;
    v_rule RECORD;
    v_value TEXT;
    v_passed BOOLEAN;
    v_message TEXT;
BEGIN
    SELECT * INTO v_metadata FROM model_metadata WHERE model_id = p_model_id;
    
    FOR v_rule IN SELECT * FROM metadata_validation_rules WHERE enabled = true LOOP
        v_passed := true;
        v_message := 'OK';
        
        -- Get field value dynamically
        EXECUTE format('SELECT ($1).%I::TEXT', v_rule.field_name) INTO v_value USING v_metadata;
        
        CASE v_rule.validation_type
            WHEN 'required' THEN
                IF v_value IS NULL OR v_value = '' OR v_value = '{}' OR v_value = '[]' THEN
                    v_passed := false;
                    v_message := v_rule.field_name || ' is required';
                END IF;
            WHEN 'min_value' THEN
                IF v_value IS NOT NULL AND v_value::NUMERIC < (v_rule.validation_config->>'min')::NUMERIC THEN
                    v_passed := false;
                    v_message := v_rule.field_name || ' must be at least ' || (v_rule.validation_config->>'min');
                END IF;
            WHEN 'pattern' THEN
                IF v_value IS NOT NULL AND v_value !~ (v_rule.validation_config->>'pattern') THEN
                    v_passed := false;
                    v_message := v_rule.field_name || ' does not match required pattern';
                END IF;
            ELSE
                NULL;
        END CASE;
        
        RETURN QUERY SELECT 
            v_rule.name::VARCHAR,
            v_rule.field_name::VARCHAR,
            v_rule.severity::VARCHAR,
            v_passed,
            v_message;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Check if model can be added (has sufficient metadata)
CREATE OR REPLACE FUNCTION can_add_model(p_model_id VARCHAR)
RETURNS JSONB AS $$
DECLARE
    v_validation RECORD;
    v_errors INTEGER := 0;
    v_warnings INTEGER := 0;
    v_messages JSONB := '[]';
BEGIN
    FOR v_validation IN SELECT * FROM validate_model_metadata(p_model_id) LOOP
        IF NOT v_validation.passed THEN
            IF v_validation.severity = 'error' THEN
                v_errors := v_errors + 1;
            ELSIF v_validation.severity = 'warning' THEN
                v_warnings := v_warnings + 1;
            END IF;
            
            v_messages := v_messages || jsonb_build_object(
                'rule', v_validation.rule_name,
                'field', v_validation.field_name,
                'severity', v_validation.severity,
                'message', v_validation.message
            );
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'can_add', v_errors = 0,
        'errors', v_errors,
        'warnings', v_warnings,
        'validation_messages', v_messages,
        'completeness', (SELECT metadata_completeness FROM model_metadata WHERE model_id = p_model_id)
    );
END;
$$ LANGUAGE plpgsql;

-- Merge new metadata with existing (AI-assisted)
CREATE OR REPLACE FUNCTION merge_metadata(
    p_model_id VARCHAR,
    p_new_data JSONB,
    p_source VARCHAR,
    p_confidence DECIMAL DEFAULT 0.7
)
RETURNS JSONB AS $$
DECLARE
    v_existing RECORD;
    v_merged JSONB := '{}';
    v_changes JSONB := '{}';
    v_key TEXT;
    v_new_value JSONB;
    v_existing_value JSONB;
BEGIN
    SELECT * INTO v_existing FROM model_metadata WHERE model_id = p_model_id;
    
    -- For each key in new data
    FOR v_key IN SELECT jsonb_object_keys(p_new_data) LOOP
        v_new_value := p_new_data->v_key;
        
        -- Get existing value
        EXECUTE format('SELECT to_jsonb(($1).%I)', v_key) INTO v_existing_value USING v_existing;
        
        -- Decide whether to use new value
        -- Use new if: existing is null, or new has higher confidence, or is from official source
        IF v_existing_value IS NULL OR v_existing_value = 'null'::jsonb OR 
           (p_source LIKE '%official%' AND p_confidence > 0.8) THEN
            v_merged := v_merged || jsonb_build_object(v_key, v_new_value);
            v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object(
                'old', v_existing_value,
                'new', v_new_value,
                'source', p_source
            ));
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'merged_data', v_merged,
        'changes', v_changes,
        'fields_updated', (SELECT array_agg(key) FROM jsonb_object_keys(v_changes) key)
    );
END;
$$ LANGUAGE plpgsql;

-- Get models needing metadata refresh
CREATE OR REPLACE FUNCTION get_models_needing_refresh(p_max_age_hours INTEGER DEFAULT 168)
RETURNS TABLE(model_id VARCHAR, last_verified TIMESTAMPTZ, completeness DECIMAL) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mm.model_id::VARCHAR,
        mm.last_verified,
        mm.metadata_completeness
    FROM model_metadata mm
    WHERE mm.is_available = true
      AND (mm.last_verified IS NULL OR mm.last_verified < NOW() - (p_max_age_hours || ' hours')::INTERVAL)
    ORDER BY mm.last_verified NULLS FIRST, mm.metadata_completeness ASC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-calculate completeness on update
CREATE OR REPLACE FUNCTION trigger_calculate_completeness()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM calculate_metadata_completeness(NEW.model_id);
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER model_metadata_completeness
    AFTER INSERT OR UPDATE ON model_metadata
    FOR EACH ROW EXECUTE FUNCTION trigger_calculate_completeness();

-- Block model addition without sufficient metadata
CREATE OR REPLACE FUNCTION trigger_validate_before_registry_add()
RETURNS TRIGGER AS $$
DECLARE
    v_validation JSONB;
BEGIN
    -- Check if metadata exists and is sufficient
    SELECT can_add_model(NEW.model_id) INTO v_validation;
    
    IF v_validation IS NULL THEN
        RAISE EXCEPTION 'Model % has no metadata. Metadata must be added before registering a model.', NEW.model_id;
    END IF;
    
    IF NOT (v_validation->>'can_add')::BOOLEAN THEN
        RAISE EXCEPTION 'Model % cannot be added due to incomplete metadata: %', 
            NEW.model_id, v_validation->>'validation_messages';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to unified_model_registry (optional - can be enabled by admin)
-- CREATE TRIGGER unified_model_registry_metadata_gate
--     BEFORE INSERT ON unified_model_registry
--     FOR EACH ROW EXECUTE FUNCTION trigger_validate_before_registry_add();

-- ============================================================================
-- SEED INITIAL METADATA
-- ============================================================================

INSERT INTO model_metadata (
    model_id, provider, model_name, model_family, context_window, max_output_tokens,
    capabilities, specialties, input_price_per_1m, output_price_per_1m,
    function_calling_support, json_mode_support, official_docs_url
) VALUES
-- OpenAI Models
('openai/gpt-4o', 'openai', 'GPT-4o', 'gpt', 128000, 4096,
 '{"reasoning": 0.9, "coding": 0.85, "vision": 0.9, "language": 0.95}',
 ARRAY['multimodal', 'reasoning', 'coding', 'analysis'],
 5.00, 15.00, true, true, 'https://platform.openai.com/docs/models/gpt-4o'),

('openai/gpt-4o-mini', 'openai', 'GPT-4o Mini', 'gpt', 128000, 16384,
 '{"reasoning": 0.8, "coding": 0.75, "language": 0.85}',
 ARRAY['fast', 'efficient', 'general'],
 0.15, 0.60, true, true, 'https://platform.openai.com/docs/models/gpt-4o-mini'),

('openai/o1', 'openai', 'o1', 'o1', 128000, 32768,
 '{"reasoning": 0.98, "math": 0.95, "coding": 0.9, "planning": 0.95}',
 ARRAY['deep reasoning', 'math', 'complex problems'],
 15.00, 60.00, false, false, 'https://platform.openai.com/docs/models/o1'),

-- Anthropic Models
('anthropic/claude-3-5-sonnet-20241022', 'anthropic', 'Claude 3.5 Sonnet', 'claude', 200000, 8192,
 '{"reasoning": 0.92, "coding": 0.95, "vision": 0.85, "language": 0.93}',
 ARRAY['coding', 'analysis', 'reasoning', 'long context'],
 3.00, 15.00, true, true, 'https://docs.anthropic.com/claude/docs/models-overview'),

('anthropic/claude-3-haiku', 'anthropic', 'Claude 3 Haiku', 'claude', 200000, 4096,
 '{"reasoning": 0.75, "coding": 0.7, "language": 0.8}',
 ARRAY['fast', 'efficient', 'summarization'],
 0.25, 1.25, true, true, 'https://docs.anthropic.com/claude/docs/models-overview'),

-- Google Models
('google/gemini-1.5-pro', 'google', 'Gemini 1.5 Pro', 'gemini', 2000000, 8192,
 '{"reasoning": 0.88, "coding": 0.82, "vision": 0.9, "long_context": 0.95}',
 ARRAY['long context', 'multimodal', 'reasoning'],
 1.25, 5.00, true, true, 'https://ai.google.dev/models/gemini'),

('google/gemini-1.5-flash', 'google', 'Gemini 1.5 Flash', 'gemini', 1000000, 8192,
 '{"reasoning": 0.75, "coding": 0.7, "vision": 0.8}',
 ARRAY['fast', 'efficient', 'multimodal'],
 0.075, 0.30, true, true, 'https://ai.google.dev/models/gemini'),

-- Meta Models
('meta/llama-3.1-70b', 'meta', 'Llama 3.1 70B', 'llama', 128000, 4096,
 '{"reasoning": 0.82, "coding": 0.78, "language": 0.85}',
 ARRAY['open source', 'general', 'reasoning'],
 0.99, 0.99, true, false, 'https://llama.meta.com/'),

-- Mistral Models
('mistral/mistral-large', 'mistral', 'Mistral Large', 'mistral', 128000, 4096,
 '{"reasoning": 0.85, "coding": 0.82, "multilingual": 0.9}',
 ARRAY['multilingual', 'reasoning', 'coding'],
 3.00, 9.00, true, true, 'https://docs.mistral.ai/'),

('mistral/codestral', 'mistral', 'Codestral', 'mistral', 32000, 4096,
 '{"coding": 0.92, "reasoning": 0.75}',
 ARRAY['code generation', 'code completion', 'code review'],
 1.00, 3.00, true, false, 'https://docs.mistral.ai/')

ON CONFLICT (model_id) DO UPDATE SET
    capabilities = EXCLUDED.capabilities,
    input_price_per_1m = EXCLUDED.input_price_per_1m,
    output_price_per_1m = EXCLUDED.output_price_per_1m,
    updated_at = NOW();

-- Calculate initial completeness
SELECT calculate_metadata_completeness(model_id) FROM model_metadata;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE model_metadata IS 'Comprehensive metadata for each AI model';
COMMENT ON TABLE metadata_sources IS 'Sources for metadata research (official APIs, docs, benchmarks)';
COMMENT ON TABLE metadata_research_history IS 'History of metadata updates from research';
COMMENT ON TABLE metadata_refresh_schedule IS 'Admin-configurable schedules for metadata refresh';
COMMENT ON TABLE metadata_validation_rules IS 'Rules that must pass before a model can be added';
COMMENT ON FUNCTION can_add_model IS 'Check if model has sufficient metadata to be added';
COMMENT ON FUNCTION validate_model_metadata IS 'Validate model metadata against all rules';
