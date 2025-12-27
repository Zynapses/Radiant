-- Migration: 063_ml_training_pipeline.sql
-- RADIANT v4.18.0 - Machine Learning Training Pipeline
-- Collects training data for routing model and enables continuous learning

-- ============================================================================
-- ML TRAINING DATA - Routing Decisions
-- ============================================================================

CREATE TABLE IF NOT EXISTS ml_routing_training_data (
    sample_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Input features
    task_text TEXT NOT NULL,
    task_embedding VECTOR(1536), -- For semantic similarity
    detected_specialty VARCHAR(100),
    detected_complexity VARCHAR(20), -- 'simple', 'moderate', 'complex'
    detected_modalities TEXT[] DEFAULT '{}', -- 'text', 'code', 'math', 'vision'
    context_features JSONB DEFAULT '{}', -- user history, session context
    
    -- Routing decision
    models_considered TEXT[] NOT NULL,
    model_selected VARCHAR(200) NOT NULL,
    routing_strategy VARCHAR(50), -- 'single', 'ensemble', 'chain'
    selection_reason TEXT,
    
    -- Outcome (for supervised learning)
    quality_score DECIMAL(5,4),
    latency_ms INTEGER,
    cost_cents DECIMAL(10,4),
    user_feedback VARCHAR(20), -- 'positive', 'negative', 'neutral', NULL
    user_feedback_text TEXT,
    was_retry BOOLEAN DEFAULT false,
    
    -- Computed label for training
    was_good_choice BOOLEAN, -- Computed from quality + feedback
    optimal_model VARCHAR(200), -- What model SHOULD have been used (hindsight)
    
    -- Training metadata
    used_for_training BOOLEAN DEFAULT false,
    training_batch_id UUID,
    exported_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ml_routing_training_tenant ON ml_routing_training_data(tenant_id);
CREATE INDEX idx_ml_routing_training_created ON ml_routing_training_data(created_at DESC);
CREATE INDEX idx_ml_routing_training_specialty ON ml_routing_training_data(detected_specialty);
CREATE INDEX idx_ml_routing_training_unused ON ml_routing_training_data(used_for_training) WHERE used_for_training = false;

-- ============================================================================
-- ML TRAINING BATCHES - Track training runs
-- ============================================================================

CREATE TABLE IF NOT EXISTS ml_training_batches (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Batch info
    batch_name VARCHAR(200) NOT NULL,
    model_type VARCHAR(100) NOT NULL, -- 'routing', 'quality_prediction', 'specialty_detection'
    
    -- Data stats
    samples_count INTEGER NOT NULL,
    train_samples INTEGER,
    validation_samples INTEGER,
    test_samples INTEGER,
    
    -- Training config
    base_model VARCHAR(200), -- 'mistral-7b', 'llama-3-8b', etc.
    hyperparameters JSONB DEFAULT '{}',
    
    -- Status
    status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'exporting', 'training', 'evaluating', 'completed', 'failed'
    
    -- S3 locations
    training_data_s3 TEXT,
    model_artifact_s3 TEXT,
    
    -- SageMaker
    sagemaker_training_job VARCHAR(200),
    sagemaker_endpoint VARCHAR(200),
    
    -- Results
    training_metrics JSONB DEFAULT '{}',
    evaluation_metrics JSONB DEFAULT '{}',
    
    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ML MODEL VERSIONS - Track deployed models
-- ============================================================================

CREATE TABLE IF NOT EXISTS ml_model_versions (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    model_type VARCHAR(100) NOT NULL,
    version_number INTEGER NOT NULL,
    
    -- Training info
    training_batch_id UUID REFERENCES ml_training_batches(batch_id),
    
    -- Deployment
    sagemaker_endpoint VARCHAR(200),
    is_active BOOLEAN DEFAULT false,
    
    -- Performance
    accuracy DECIMAL(5,4),
    latency_p50_ms INTEGER,
    latency_p99_ms INTEGER,
    
    -- A/B testing
    traffic_percentage INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,
    
    UNIQUE(model_type, version_number)
);

-- ============================================================================
-- ML INFERENCE LOG - Track predictions and outcomes
-- ============================================================================

CREATE TABLE IF NOT EXISTS ml_inference_log (
    inference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    model_type VARCHAR(100) NOT NULL,
    model_version_id UUID REFERENCES ml_model_versions(version_id),
    
    -- Input
    input_features JSONB NOT NULL,
    
    -- Prediction
    prediction JSONB NOT NULL,
    confidence DECIMAL(5,4),
    latency_ms INTEGER,
    
    -- Outcome (filled in later)
    actual_outcome JSONB,
    was_correct BOOLEAN,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ml_inference_log_model ON ml_inference_log(model_type, model_version_id);
CREATE INDEX idx_ml_inference_log_created ON ml_inference_log(created_at DESC);

-- ============================================================================
-- MODEL REGISTRY - Current available AI models (auto-updated)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_model_registry (
    registry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Model identification
    model_id VARCHAR(200) NOT NULL UNIQUE,
    provider VARCHAR(100) NOT NULL,
    model_name VARCHAR(300) NOT NULL,
    model_family VARCHAR(100),
    
    -- Versioning
    version VARCHAR(50),
    release_date DATE,
    is_latest BOOLEAN DEFAULT true,
    predecessor_model_id VARCHAR(200),
    
    -- Capabilities (normalized 0-1)
    cap_reasoning DECIMAL(5,4) DEFAULT 0.5,
    cap_coding DECIMAL(5,4) DEFAULT 0.5,
    cap_math DECIMAL(5,4) DEFAULT 0.5,
    cap_creative DECIMAL(5,4) DEFAULT 0.5,
    cap_vision DECIMAL(5,4) DEFAULT 0.5,
    cap_audio DECIMAL(5,4) DEFAULT 0.5,
    cap_speed DECIMAL(5,4) DEFAULT 0.5,
    cap_cost_efficiency DECIMAL(5,4) DEFAULT 0.5,
    
    -- Technical specs
    context_window INTEGER,
    max_output_tokens INTEGER,
    supports_functions BOOLEAN DEFAULT false,
    supports_vision BOOLEAN DEFAULT false,
    supports_audio BOOLEAN DEFAULT false,
    
    -- Pricing (per 1M tokens)
    input_price DECIMAL(10,4),
    output_price DECIMAL(10,4),
    
    -- Status
    is_available BOOLEAN DEFAULT true,
    is_deprecated BOOLEAN DEFAULT false,
    deprecation_date DATE,
    
    -- Auto-update tracking
    last_verified TIMESTAMPTZ,
    auto_discovered BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_model_registry_provider ON ai_model_registry(provider);
CREATE INDEX idx_ai_model_registry_available ON ai_model_registry(is_available, is_deprecated);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Record a routing decision for training
CREATE OR REPLACE FUNCTION record_routing_for_training(
    p_tenant_id UUID,
    p_task_text TEXT,
    p_specialty VARCHAR,
    p_models_considered TEXT[],
    p_model_selected VARCHAR,
    p_strategy VARCHAR,
    p_quality_score DECIMAL,
    p_latency_ms INTEGER,
    p_cost_cents DECIMAL
)
RETURNS UUID AS $$
DECLARE
    v_sample_id UUID;
    v_complexity VARCHAR;
BEGIN
    -- Detect complexity based on task length and keywords
    v_complexity := CASE
        WHEN length(p_task_text) > 1000 OR p_task_text ~* 'complex|detailed|comprehensive|analyze' THEN 'complex'
        WHEN length(p_task_text) > 300 OR p_task_text ~* 'explain|describe|compare' THEN 'moderate'
        ELSE 'simple'
    END;
    
    INSERT INTO ml_routing_training_data (
        tenant_id, task_text, detected_specialty, detected_complexity,
        models_considered, model_selected, routing_strategy,
        quality_score, latency_ms, cost_cents,
        was_good_choice
    ) VALUES (
        p_tenant_id, p_task_text, p_specialty, v_complexity,
        p_models_considered, p_model_selected, p_strategy,
        p_quality_score, p_latency_ms, p_cost_cents,
        p_quality_score >= 0.7 -- Good choice if quality >= 70%
    )
    RETURNING sample_id INTO v_sample_id;
    
    RETURN v_sample_id;
END;
$$ LANGUAGE plpgsql;

-- Update training sample with user feedback
CREATE OR REPLACE FUNCTION update_training_feedback(
    p_sample_id UUID,
    p_feedback VARCHAR,
    p_feedback_text TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE ml_routing_training_data SET
        user_feedback = p_feedback,
        user_feedback_text = p_feedback_text,
        was_good_choice = CASE
            WHEN p_feedback = 'positive' THEN true
            WHEN p_feedback = 'negative' THEN false
            ELSE was_good_choice
        END
    WHERE sample_id = p_sample_id;
END;
$$ LANGUAGE plpgsql;

-- Export training data for SageMaker
CREATE OR REPLACE FUNCTION export_training_batch(
    p_batch_name VARCHAR,
    p_model_type VARCHAR,
    p_min_samples INTEGER DEFAULT 1000
)
RETURNS TABLE(
    batch_id UUID,
    samples_exported INTEGER
) AS $$
DECLARE
    v_batch_id UUID;
    v_count INTEGER;
BEGIN
    -- Count available samples
    SELECT COUNT(*) INTO v_count
    FROM ml_routing_training_data
    WHERE used_for_training = false
      AND quality_score IS NOT NULL;
    
    IF v_count < p_min_samples THEN
        RAISE EXCEPTION 'Not enough training samples. Have %, need %', v_count, p_min_samples;
    END IF;
    
    -- Create batch
    INSERT INTO ml_training_batches (batch_name, model_type, samples_count, status)
    VALUES (p_batch_name, p_model_type, v_count, 'exporting')
    RETURNING ml_training_batches.batch_id INTO v_batch_id;
    
    -- Mark samples as used
    UPDATE ml_routing_training_data SET
        used_for_training = true,
        training_batch_id = v_batch_id,
        exported_at = NOW()
    WHERE used_for_training = false
      AND quality_score IS NOT NULL;
    
    RETURN QUERY SELECT v_batch_id, v_count;
END;
$$ LANGUAGE plpgsql;

-- Get current best model for a specialty
CREATE OR REPLACE FUNCTION get_ml_best_model(
    p_specialty VARCHAR,
    p_complexity VARCHAR DEFAULT 'moderate'
)
RETURNS VARCHAR AS $$
DECLARE
    v_model VARCHAR;
BEGIN
    -- Use historical performance to pick best model
    SELECT model_selected INTO v_model
    FROM ml_routing_training_data
    WHERE detected_specialty = p_specialty
      AND detected_complexity = p_complexity
      AND was_good_choice = true
    GROUP BY model_selected
    ORDER BY AVG(quality_score) DESC, COUNT(*) DESC
    LIMIT 1;
    
    -- Fallback to best overall
    IF v_model IS NULL THEN
        SELECT model_id INTO v_model
        FROM ai_model_registry
        WHERE is_available = true AND is_deprecated = false
        ORDER BY cap_reasoning DESC
        LIMIT 1;
    END IF;
    
    RETURN v_model;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED CURRENT MODELS (keeping up to date!)
-- ============================================================================

INSERT INTO ai_model_registry (
    model_id, provider, model_name, model_family, version, release_date,
    cap_reasoning, cap_coding, cap_math, cap_creative, cap_vision, cap_speed, cap_cost_efficiency,
    context_window, max_output_tokens, supports_functions, supports_vision, input_price, output_price
) VALUES
-- OpenAI Models (Latest)
('openai/gpt-4o', 'openai', 'GPT-4o', 'gpt-4', '2024-11-20', '2024-11-20', 0.92, 0.90, 0.88, 0.90, 0.92, 0.85, 0.70, 128000, 16384, true, true, 2.50, 10.00),
('openai/gpt-4o-mini', 'openai', 'GPT-4o Mini', 'gpt-4', '2024-07-18', '2024-07-18', 0.82, 0.80, 0.78, 0.82, 0.85, 0.95, 0.95, 128000, 16384, true, true, 0.15, 0.60),
('openai/o1', 'openai', 'o1', 'o1', '2024-12-17', '2024-12-17', 0.98, 0.96, 0.98, 0.75, 0.90, 0.40, 0.30, 200000, 100000, true, true, 15.00, 60.00),
('openai/o1-mini', 'openai', 'o1-mini', 'o1', '2024-09-12', '2024-09-12', 0.92, 0.94, 0.96, 0.70, 0.00, 0.60, 0.60, 128000, 65536, true, false, 3.00, 12.00),
('openai/o3-mini', 'openai', 'o3-mini', 'o3', '2025-01-31', '2025-01-31', 0.96, 0.97, 0.98, 0.72, 0.00, 0.70, 0.55, 200000, 100000, true, false, 1.10, 4.40),

-- Anthropic Models (Latest)
('anthropic/claude-3-5-sonnet-20241022', 'anthropic', 'Claude 3.5 Sonnet', 'claude-3.5', '20241022', '2024-10-22', 0.94, 0.96, 0.90, 0.92, 0.90, 0.88, 0.75, 200000, 8192, true, true, 3.00, 15.00),
('anthropic/claude-3-5-haiku-20241022', 'anthropic', 'Claude 3.5 Haiku', 'claude-3.5', '20241022', '2024-10-22', 0.82, 0.85, 0.80, 0.80, 0.80, 0.95, 0.92, 200000, 8192, true, true, 0.80, 4.00),
('anthropic/claude-3-opus-20240229', 'anthropic', 'Claude 3 Opus', 'claude-3', '20240229', '2024-02-29', 0.95, 0.93, 0.92, 0.95, 0.88, 0.60, 0.40, 200000, 4096, true, true, 15.00, 75.00),

-- Google Models (Latest)
('google/gemini-2.0-flash', 'google', 'Gemini 2.0 Flash', 'gemini-2.0', '2.0', '2024-12-11', 0.88, 0.85, 0.85, 0.85, 0.90, 0.95, 0.90, 1000000, 8192, true, true, 0.075, 0.30),
('google/gemini-2.0-flash-thinking', 'google', 'Gemini 2.0 Flash Thinking', 'gemini-2.0', '2.0-thinking', '2024-12-19', 0.94, 0.92, 0.95, 0.80, 0.90, 0.70, 0.75, 1000000, 8192, true, true, 0.075, 0.30),
('google/gemini-1.5-pro', 'google', 'Gemini 1.5 Pro', 'gemini-1.5', '1.5', '2024-05-14', 0.90, 0.88, 0.88, 0.88, 0.92, 0.80, 0.80, 2000000, 8192, true, true, 1.25, 5.00),
('google/gemini-1.5-flash', 'google', 'Gemini 1.5 Flash', 'gemini-1.5', '1.5-flash', '2024-05-14', 0.82, 0.80, 0.80, 0.82, 0.88, 0.95, 0.95, 1000000, 8192, true, true, 0.075, 0.30),

-- Meta Models (Latest)
('meta/llama-3.3-70b', 'meta', 'Llama 3.3 70B', 'llama-3.3', '3.3', '2024-12-06', 0.88, 0.85, 0.85, 0.85, 0.00, 0.75, 0.85, 128000, 4096, true, false, 0.90, 0.90),
('meta/llama-3.2-90b-vision', 'meta', 'Llama 3.2 90B Vision', 'llama-3.2', '3.2', '2024-09-25', 0.86, 0.82, 0.82, 0.84, 0.88, 0.70, 0.80, 128000, 4096, true, true, 1.00, 1.00),

-- Mistral Models (Latest)
('mistral/mistral-large-2411', 'mistral', 'Mistral Large', 'mistral-large', '2411', '2024-11-18', 0.90, 0.88, 0.88, 0.88, 0.00, 0.80, 0.75, 128000, 4096, true, false, 2.00, 6.00),
('mistral/codestral-2501', 'mistral', 'Codestral', 'codestral', '2501', '2025-01-14', 0.80, 0.96, 0.85, 0.70, 0.00, 0.90, 0.85, 256000, 8192, true, false, 0.30, 0.90),
('mistral/pixtral-large-2411', 'mistral', 'Pixtral Large', 'pixtral', '2411', '2024-11-18', 0.88, 0.85, 0.85, 0.85, 0.92, 0.75, 0.70, 128000, 4096, true, true, 2.00, 6.00),

-- xAI Models (Latest)
('xai/grok-2', 'xai', 'Grok 2', 'grok-2', '2.0', '2024-12-12', 0.90, 0.88, 0.88, 0.92, 0.90, 0.80, 0.70, 131072, 4096, true, true, 2.00, 10.00),
('xai/grok-2-vision', 'xai', 'Grok 2 Vision', 'grok-2', '2.0-vision', '2024-12-12', 0.88, 0.85, 0.85, 0.90, 0.92, 0.78, 0.68, 32768, 4096, true, true, 2.00, 10.00),

-- DeepSeek Models (Latest)
('deepseek/deepseek-chat', 'deepseek', 'DeepSeek V3', 'deepseek-v3', '3.0', '2024-12-26', 0.92, 0.94, 0.92, 0.85, 0.00, 0.85, 0.95, 64000, 8192, true, false, 0.27, 1.10),
('deepseek/deepseek-reasoner', 'deepseek', 'DeepSeek R1', 'deepseek-r1', '1.0', '2025-01-20', 0.96, 0.95, 0.97, 0.80, 0.00, 0.50, 0.90, 64000, 8192, true, false, 0.55, 2.19),

-- Cohere Models
('cohere/command-r-plus', 'cohere', 'Command R+', 'command-r', 'plus', '2024-04-04', 0.88, 0.82, 0.80, 0.85, 0.00, 0.80, 0.80, 128000, 4096, true, false, 2.50, 10.00),

-- Amazon Models
('amazon/nova-pro', 'amazon', 'Nova Pro', 'nova', 'pro', '2024-12-03', 0.86, 0.82, 0.82, 0.84, 0.88, 0.85, 0.85, 300000, 5000, true, true, 0.80, 3.20),
('amazon/nova-lite', 'amazon', 'Nova Lite', 'nova', 'lite', '2024-12-03', 0.78, 0.75, 0.75, 0.78, 0.82, 0.95, 0.95, 300000, 5000, true, true, 0.06, 0.24)

ON CONFLICT (model_id) DO UPDATE SET
    model_name = EXCLUDED.model_name,
    version = EXCLUDED.version,
    release_date = EXCLUDED.release_date,
    cap_reasoning = EXCLUDED.cap_reasoning,
    cap_coding = EXCLUDED.cap_coding,
    cap_math = EXCLUDED.cap_math,
    cap_creative = EXCLUDED.cap_creative,
    cap_vision = EXCLUDED.cap_vision,
    cap_speed = EXCLUDED.cap_speed,
    cap_cost_efficiency = EXCLUDED.cap_cost_efficiency,
    context_window = EXCLUDED.context_window,
    max_output_tokens = EXCLUDED.max_output_tokens,
    supports_functions = EXCLUDED.supports_functions,
    supports_vision = EXCLUDED.supports_vision,
    input_price = EXCLUDED.input_price,
    output_price = EXCLUDED.output_price,
    updated_at = NOW();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ml_routing_training_data IS 'Collects routing decisions for training the routing model';
COMMENT ON TABLE ml_training_batches IS 'Tracks ML training runs and their results';
COMMENT ON TABLE ml_model_versions IS 'Tracks deployed ML model versions for A/B testing';
COMMENT ON TABLE ai_model_registry IS 'Current registry of available AI models with capabilities';
