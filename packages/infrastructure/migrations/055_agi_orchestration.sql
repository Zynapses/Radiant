-- Migration: 055_agi_orchestration.sql
-- RADIANT v4.18.0 - AGI Multi-Model Orchestration
-- Intelligent routing to specialist models for superior intelligence

-- ============================================================================
-- SPECIALTY DEFINITIONS - Define what each specialty excels at
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_specialties (
    specialty_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Specialty definition
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- 'reasoning', 'coding', 'vision', 'audio', 'scientific', 'creative', 'math', 'language'
    
    -- What tasks this specialty handles
    task_patterns JSONB DEFAULT '[]', -- Regex/keyword patterns to match
    required_capabilities TEXT[] DEFAULT '{}',
    
    -- Quality expectations
    min_quality_threshold DECIMAL(3,2) DEFAULT 0.7,
    latency_tolerance_ms INTEGER DEFAULT 30000,
    
    -- Default models (ordered by preference)
    preferred_models TEXT[] DEFAULT '{}', -- model_ids in preference order
    fallback_models TEXT[] DEFAULT '{}',
    
    -- Self-hosted preference
    prefer_self_hosted BOOLEAN DEFAULT false,
    self_hosted_required BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert specialty definitions
INSERT INTO model_specialties (name, category, description, task_patterns, preferred_models, fallback_models) VALUES
-- Reasoning specialties
('deep_reasoning', 'reasoning', 'Complex multi-step reasoning, logic puzzles, planning', 
 '["reason", "think through", "analyze", "logic", "deduce", "infer", "plan"]',
 ARRAY['openai/o1', 'anthropic/claude-3-5-sonnet-20241022', 'google/gemini-1.5-pro'],
 ARRAY['meta/llama-3.1-70b', 'mistral/mistral-large']),

('math_computation', 'math', 'Mathematical computation, proofs, equations',
 '["calculate", "compute", "solve", "equation", "proof", "math", "derivative", "integral"]',
 ARRAY['openai/o1', 'openai/o1-mini', 'anthropic/claude-3-5-sonnet-20241022'],
 ARRAY['google/gemini-1.5-pro', 'mistral/mistral-large']),

-- Coding specialties
('code_generation', 'coding', 'Writing new code, implementing features',
 '["write code", "implement", "create function", "build", "develop"]',
 ARRAY['anthropic/claude-3-5-sonnet-20241022', 'mistral/codestral', 'openai/o1-mini'],
 ARRAY['openai/gpt-4o', 'google/gemini-1.5-pro']),

('code_review', 'coding', 'Code review, bug finding, security analysis',
 '["review", "bug", "security", "vulnerability", "optimize", "refactor"]',
 ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o', 'mistral/codestral'],
 ARRAY['meta/llama-3.1-70b']),

('code_explanation', 'coding', 'Explaining code, documentation',
 '["explain", "document", "what does", "how does", "understand"]',
 ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o', 'google/gemini-1.5-pro'],
 ARRAY['anthropic/claude-3-haiku', 'openai/gpt-4o-mini']),

-- Vision specialties  
('image_analysis', 'vision', 'Analyzing images, OCR, visual QA',
 '["image", "picture", "photo", "screenshot", "visual", "see", "look at"]',
 ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o', 'google/gemini-1.5-pro'],
 ARRAY['google/gemini-1.5-flash']),

('image_generation', 'vision', 'Creating images from descriptions',
 '["generate image", "create picture", "draw", "visualize", "illustration"]',
 ARRAY['stability/sdxl', 'openai/dall-e-3'],
 ARRAY['stability/sd-1.5']),

-- Creative specialties
('creative_writing', 'creative', 'Stories, poetry, creative content',
 '["write story", "creative", "poem", "fiction", "narrative", "imaginative"]',
 ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o', 'google/gemini-1.5-pro'],
 ARRAY['mistral/mistral-large']),

('content_generation', 'creative', 'Blog posts, articles, marketing copy',
 '["blog", "article", "marketing", "copy", "content", "SEO"]',
 ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o', 'mistral/mistral-large'],
 ARRAY['anthropic/claude-3-haiku', 'openai/gpt-4o-mini']),

-- Language specialties
('translation', 'language', 'Language translation',
 '["translate", "translation", "in spanish", "in french", "to english"]',
 ARRAY['google/gemini-1.5-pro', 'openai/gpt-4o', 'mistral/mistral-large'],
 ARRAY['anthropic/claude-3-5-sonnet-20241022']),

('summarization', 'language', 'Summarizing long content',
 '["summarize", "summary", "tldr", "brief", "condense", "key points"]',
 ARRAY['anthropic/claude-3-haiku', 'openai/gpt-4o-mini', 'google/gemini-1.5-flash'],
 ARRAY['anthropic/claude-3-5-sonnet-20241022']),

-- Scientific specialties
('scientific_analysis', 'scientific', 'Scientific reasoning, research analysis',
 '["scientific", "research", "hypothesis", "experiment", "data analysis", "statistics"]',
 ARRAY['openai/o1', 'anthropic/claude-3-5-sonnet-20241022', 'google/gemini-1.5-pro'],
 ARRAY['meta/llama-3.1-70b']),

('medical_reasoning', 'scientific', 'Medical and health-related analysis',
 '["medical", "health", "diagnosis", "symptoms", "treatment", "clinical"]',
 ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022', 'google/gemini-1.5-pro'],
 ARRAY['meta/llama-3.1-70b']),

-- Fast/Efficient specialties
('quick_answer', 'efficient', 'Simple questions, quick lookups',
 '["what is", "define", "quick", "simple", "brief answer"]',
 ARRAY['anthropic/claude-3-haiku', 'openai/gpt-4o-mini', 'google/gemini-1.5-flash'],
 ARRAY['amazon/titan-text-express']),

('classification', 'efficient', 'Categorization, labeling, sentiment',
 '["classify", "categorize", "label", "sentiment", "is this", "which type"]',
 ARRAY['anthropic/claude-3-haiku', 'openai/gpt-4o-mini', 'google/gemini-1.5-flash'],
 ARRAY['amazon/titan-text-express'])
ON CONFLICT (name) DO UPDATE SET
    preferred_models = EXCLUDED.preferred_models,
    fallback_models = EXCLUDED.fallback_models;

-- ============================================================================
-- ENSEMBLE PATTERNS - Combine multiple models for superior results
-- ============================================================================

CREATE TABLE IF NOT EXISTS ensemble_patterns (
    pattern_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Pattern definition
    name VARCHAR(200) NOT NULL,
    description TEXT,
    pattern_type VARCHAR(50) NOT NULL, -- 'voting', 'chain', 'debate', 'verify', 'specialize', 'mixture_of_experts'
    
    -- Configuration
    models_to_use TEXT[] NOT NULL, -- model_ids
    combination_strategy VARCHAR(50), -- 'majority_vote', 'weighted_average', 'best_confidence', 'synthesis'
    
    -- For chain patterns
    chain_config JSONB DEFAULT '{}', -- [{model, role, input_from}]
    
    -- For debate patterns
    debate_rounds INTEGER DEFAULT 3,
    
    -- Quality settings
    min_agreement_threshold DECIMAL(3,2) DEFAULT 0.6,
    require_unanimity BOOLEAN DEFAULT false,
    
    -- Performance tracking
    times_used INTEGER DEFAULT 0,
    avg_quality_score DECIMAL(5,4),
    avg_latency_ms INTEGER,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default ensemble patterns
INSERT INTO ensemble_patterns (tenant_id, name, pattern_type, models_to_use, combination_strategy, description) VALUES
(NULL, 'Reasoning Ensemble', 'voting', 
 ARRAY['openai/o1', 'anthropic/claude-3-5-sonnet-20241022', 'google/gemini-1.5-pro'],
 'weighted_average', 'Three top reasoning models vote on complex problems'),

(NULL, 'Code Review Chain', 'chain',
 ARRAY['anthropic/claude-3-5-sonnet-20241022', 'mistral/codestral', 'openai/gpt-4o'],
 'synthesis', 'Sequential code review by multiple models'),

(NULL, 'Factual Verification', 'verify',
 ARRAY['anthropic/claude-3-5-sonnet-20241022', 'google/gemini-1.5-pro'],
 'best_confidence', 'Primary answer verified by secondary model'),

(NULL, 'Creative Debate', 'debate',
 ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o'],
 'synthesis', 'Models debate to generate better creative content')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ORCHESTRATION REQUESTS - Track multi-model requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS orchestration_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Request
    task_description TEXT NOT NULL,
    detected_specialty VARCHAR(100),
    
    -- Routing decision
    routing_strategy VARCHAR(50) NOT NULL, -- 'single', 'ensemble', 'chain', 'parallel'
    ensemble_pattern_id UUID REFERENCES ensemble_patterns(pattern_id),
    
    -- Models used
    models_invoked TEXT[] DEFAULT '{}',
    model_results JSONB DEFAULT '[]', -- [{model, result, latency, quality}]
    
    -- Final result
    final_result TEXT,
    combination_method VARCHAR(50),
    
    -- Quality metrics
    individual_scores JSONB DEFAULT '{}', -- {model: score}
    final_quality_score DECIMAL(5,4),
    agreement_level DECIMAL(3,2),
    
    -- Performance
    total_latency_ms INTEGER,
    total_cost_cents DECIMAL(10,4),
    parallel_efficiency DECIMAL(3,2), -- actual_time / sequential_time
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orchestration_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY orchestration_requests_tenant_isolation ON orchestration_requests
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_orchestration_requests_tenant ON orchestration_requests(tenant_id);
CREATE INDEX idx_orchestration_requests_specialty ON orchestration_requests(detected_specialty);
CREATE INDEX idx_orchestration_requests_time ON orchestration_requests(created_at DESC);

-- ============================================================================
-- MODEL PERFORMANCE BY SPECIALTY - Track which models are best for what
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_specialty_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    model_id VARCHAR(200) NOT NULL,
    specialty_name VARCHAR(100) NOT NULL REFERENCES model_specialties(name),
    
    -- Performance metrics
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    
    -- Quality tracking
    avg_quality_score DECIMAL(5,4),
    quality_samples INTEGER DEFAULT 0,
    quality_variance DECIMAL(5,4),
    
    -- Latency tracking
    avg_latency_ms INTEGER,
    p50_latency_ms INTEGER,
    p95_latency_ms INTEGER,
    
    -- Cost tracking
    avg_cost_cents DECIMAL(10,4),
    
    -- Ranking
    specialty_rank INTEGER, -- 1 = best for this specialty
    
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(model_id, specialty_name)
);

CREATE INDEX idx_model_specialty_performance_model ON model_specialty_performance(model_id);
CREATE INDEX idx_model_specialty_performance_specialty ON model_specialty_performance(specialty_name);
CREATE INDEX idx_model_specialty_performance_rank ON model_specialty_performance(specialty_name, specialty_rank);

-- ============================================================================
-- SELF-HOSTED MODEL POOLS - Manage self-hosted model deployment
-- ============================================================================

CREATE TABLE IF NOT EXISTS self_hosted_model_pools (
    pool_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Pool configuration
    name VARCHAR(200) NOT NULL,
    model_id VARCHAR(200) NOT NULL,
    
    -- Deployment settings
    min_instances INTEGER DEFAULT 0,
    max_instances INTEGER DEFAULT 3,
    current_instances INTEGER DEFAULT 0,
    
    -- Instance specs
    instance_type VARCHAR(50), -- 'g5.xlarge', 'p4d.24xlarge', etc.
    gpu_memory_gb INTEGER,
    
    -- Scaling
    scale_up_threshold DECIMAL(3,2) DEFAULT 0.8, -- utilization to scale up
    scale_down_threshold DECIMAL(3,2) DEFAULT 0.2,
    cooldown_seconds INTEGER DEFAULT 300,
    
    -- Current state
    thermal_state VARCHAR(20) DEFAULT 'COLD', -- 'OFF', 'COLD', 'WARM', 'HOT'
    current_utilization DECIMAL(3,2) DEFAULT 0,
    queue_depth INTEGER DEFAULT 0,
    
    -- Cost
    hourly_cost_cents INTEGER,
    
    -- Health
    healthy_instances INTEGER DEFAULT 0,
    last_health_check TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE self_hosted_model_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY self_hosted_model_pools_tenant_isolation ON self_hosted_model_pools
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID OR tenant_id IS NULL);

-- ============================================================================
-- AGI ORCHESTRATION SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS orchestration_settings (
    setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Routing preferences
    auto_specialty_detection BOOLEAN DEFAULT true,
    prefer_self_hosted BOOLEAN DEFAULT false,
    allow_ensemble BOOLEAN DEFAULT true,
    max_models_per_request INTEGER DEFAULT 3,
    
    -- Quality vs Speed tradeoff
    quality_priority DECIMAL(3,2) DEFAULT 0.7, -- 0 = speed, 1 = quality
    cost_sensitivity DECIMAL(3,2) DEFAULT 0.5, -- 0 = ignore cost, 1 = minimize cost
    
    -- Ensemble settings
    default_ensemble_pattern VARCHAR(50) DEFAULT 'voting',
    min_ensemble_agreement DECIMAL(3,2) DEFAULT 0.6,
    enable_model_debate BOOLEAN DEFAULT false,
    
    -- Self-hosted settings
    auto_warmup_models BOOLEAN DEFAULT true,
    warmup_schedule JSONB DEFAULT '{}', -- {model: cron_expression}
    
    -- Fallback behavior
    fallback_on_failure BOOLEAN DEFAULT true,
    max_fallback_attempts INTEGER DEFAULT 2,
    
    -- Specialty overrides
    specialty_model_overrides JSONB DEFAULT '{}', -- {specialty: model_id}
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orchestration_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY orchestration_settings_tenant_isolation ON orchestration_settings
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Detect specialty from task description
CREATE OR REPLACE FUNCTION detect_specialty(p_task TEXT)
RETURNS VARCHAR(100) AS $$
DECLARE
    v_specialty RECORD;
    v_best_match VARCHAR(100);
    v_best_score INTEGER := 0;
    v_current_score INTEGER;
    v_pattern TEXT;
BEGIN
    FOR v_specialty IN SELECT name, task_patterns FROM model_specialties LOOP
        v_current_score := 0;
        FOR v_pattern IN SELECT jsonb_array_elements_text(v_specialty.task_patterns) LOOP
            IF LOWER(p_task) LIKE '%' || LOWER(v_pattern) || '%' THEN
                v_current_score := v_current_score + 1;
            END IF;
        END LOOP;
        
        IF v_current_score > v_best_score THEN
            v_best_score := v_current_score;
            v_best_match := v_specialty.name;
        END IF;
    END LOOP;
    
    RETURN v_best_match;
END;
$$ LANGUAGE plpgsql;

-- Get best model for specialty
CREATE OR REPLACE FUNCTION get_best_model_for_specialty(
    p_specialty VARCHAR(100),
    p_prefer_self_hosted BOOLEAN DEFAULT false
)
RETURNS TEXT AS $$
DECLARE
    v_specialty RECORD;
    v_model TEXT;
    v_pool RECORD;
BEGIN
    SELECT * INTO v_specialty FROM model_specialties WHERE name = p_specialty;
    
    IF v_specialty IS NULL THEN
        RETURN 'anthropic/claude-3-5-sonnet-20241022'; -- default
    END IF;
    
    -- Check if self-hosted is preferred and available
    IF p_prefer_self_hosted OR v_specialty.prefer_self_hosted THEN
        FOR v_model IN SELECT unnest(v_specialty.preferred_models) LOOP
            SELECT * INTO v_pool FROM self_hosted_model_pools 
            WHERE model_id = v_model AND thermal_state IN ('WARM', 'HOT') AND healthy_instances > 0
            LIMIT 1;
            
            IF v_pool IS NOT NULL THEN
                RETURN v_model;
            END IF;
        END LOOP;
    END IF;
    
    -- Check performance-ranked models
    SELECT model_id INTO v_model FROM model_specialty_performance
    WHERE specialty_name = p_specialty AND avg_quality_score > 0.7
    ORDER BY specialty_rank ASC NULLS LAST, avg_quality_score DESC
    LIMIT 1;
    
    IF v_model IS NOT NULL THEN
        RETURN v_model;
    END IF;
    
    -- Fall back to preferred models list
    RETURN v_specialty.preferred_models[1];
END;
$$ LANGUAGE plpgsql;

-- Update model specialty ranking based on performance
CREATE OR REPLACE FUNCTION update_specialty_rankings(p_specialty VARCHAR(100))
RETURNS void AS $$
BEGIN
    -- Update ranks based on quality score
    WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY avg_quality_score DESC, avg_latency_ms ASC) as new_rank
        FROM model_specialty_performance
        WHERE specialty_name = p_specialty
    )
    UPDATE model_specialty_performance msp
    SET specialty_rank = ranked.new_rank, last_updated = NOW()
    FROM ranked
    WHERE msp.id = ranked.id;
END;
$$ LANGUAGE plpgsql;

-- Record model performance for specialty
CREATE OR REPLACE FUNCTION record_specialty_performance(
    p_model_id VARCHAR(200),
    p_specialty VARCHAR(100),
    p_success BOOLEAN,
    p_quality_score DECIMAL,
    p_latency_ms INTEGER,
    p_cost_cents DECIMAL
)
RETURNS void AS $$
BEGIN
    INSERT INTO model_specialty_performance (
        model_id, specialty_name, total_requests, successful_requests,
        avg_quality_score, quality_samples, avg_latency_ms, avg_cost_cents
    ) VALUES (
        p_model_id, p_specialty, 1, CASE WHEN p_success THEN 1 ELSE 0 END,
        p_quality_score, 1, p_latency_ms, p_cost_cents
    )
    ON CONFLICT (model_id, specialty_name) DO UPDATE SET
        total_requests = model_specialty_performance.total_requests + 1,
        successful_requests = model_specialty_performance.successful_requests + CASE WHEN p_success THEN 1 ELSE 0 END,
        avg_quality_score = (model_specialty_performance.avg_quality_score * model_specialty_performance.quality_samples + p_quality_score) / (model_specialty_performance.quality_samples + 1),
        quality_samples = model_specialty_performance.quality_samples + 1,
        avg_latency_ms = (model_specialty_performance.avg_latency_ms * model_specialty_performance.total_requests + p_latency_ms) / (model_specialty_performance.total_requests + 1),
        avg_cost_cents = (model_specialty_performance.avg_cost_cents * model_specialty_performance.total_requests + p_cost_cents) / (model_specialty_performance.total_requests + 1),
        last_updated = NOW();
    
    -- Update rankings
    PERFORM update_specialty_rankings(p_specialty);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_orchestration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER self_hosted_model_pools_updated BEFORE UPDATE ON self_hosted_model_pools
    FOR EACH ROW EXECUTE FUNCTION update_orchestration_timestamp();

CREATE TRIGGER orchestration_settings_updated BEFORE UPDATE ON orchestration_settings
    FOR EACH ROW EXECUTE FUNCTION update_orchestration_timestamp();

-- ============================================================================
-- INITIALIZE
-- ============================================================================

-- Initialize orchestration settings for existing tenants
INSERT INTO orchestration_settings (tenant_id)
SELECT tenant_id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE model_specialties IS 'Defines what each specialty excels at and which models to use';
COMMENT ON TABLE ensemble_patterns IS 'Patterns for combining multiple models for superior results';
COMMENT ON TABLE orchestration_requests IS 'Tracks multi-model AGI orchestration requests';
COMMENT ON TABLE model_specialty_performance IS 'Performance tracking per model per specialty';
COMMENT ON TABLE self_hosted_model_pools IS 'Manages self-hosted model deployment and scaling';
COMMENT ON TABLE orchestration_settings IS 'Per-tenant AGI orchestration configuration';
