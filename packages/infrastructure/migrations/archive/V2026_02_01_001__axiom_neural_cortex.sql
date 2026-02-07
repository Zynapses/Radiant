-- AXIOM Neural Cortex Tables
-- Migration: V2026_02_01_001__axiom_neural_cortex.sql
-- 
-- Tables for the 8 AXIOM Neural Cortex networks:
-- 1. Domain Network - Classifies queries into 800+ domains
-- 2. CLARION Network - Scores question relevance
-- 3. Pattern Network - Ranks prompt patterns
-- 4. Model Network - Scores models for task suitability
-- 5. Topology Network - Evaluates orchestration strategies
-- 6. Combination Network - Scores multi-model combinations
-- 7. Variant Network - Scores prompt variants
-- 8. User Network - Personalizes via Ghost Vector

-- Network thermal state enum
CREATE TYPE axiom_network_thermal_state AS ENUM ('cold', 'warm', 'hot');

-- Network status table - tracks thermal state and metrics for each network
CREATE TABLE IF NOT EXISTS axiom_network_status (
    network_id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    thermal_state axiom_network_thermal_state NOT NULL DEFAULT 'cold',
    version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    sagemaker_endpoint VARCHAR(256),
    onnx_model_path VARCHAR(512),
    
    -- Network architecture
    parameters INTEGER NOT NULL DEFAULT 0,
    input_dim INTEGER NOT NULL,
    output_dim INTEGER NOT NULL,
    hidden_layers JSONB NOT NULL DEFAULT '[]',
    activation_function VARCHAR(32) NOT NULL DEFAULT 'gelu',
    
    -- Metrics
    requests_per_minute DECIMAL(10,2) NOT NULL DEFAULT 0,
    error_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
    last_inference_ms INTEGER,
    avg_latency_ms DECIMAL(10,2),
    total_inferences BIGINT NOT NULL DEFAULT 0,
    
    -- Thermal management
    warmed_at TIMESTAMP WITH TIME ZONE,
    last_request_at TIMESTAMP WITH TIME ZONE,
    auto_cool_after_minutes INTEGER DEFAULT 30,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for thermal state queries
CREATE INDEX IF NOT EXISTS idx_axiom_network_status_thermal 
    ON axiom_network_status(thermal_state);

-- Network inference log - tracks individual inferences for training
CREATE TABLE IF NOT EXISTS axiom_network_inference_log (
    inference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id VARCHAR(32) NOT NULL REFERENCES axiom_network_status(network_id),
    tenant_id UUID,
    session_id UUID,
    
    -- Input/Output
    input_features_hash VARCHAR(64),  -- SHA-256 of input for deduplication
    output_scores JSONB NOT NULL,
    
    -- Performance
    latency_ms INTEGER NOT NULL,
    used_fallback BOOLEAN NOT NULL DEFAULT false,
    model_version VARCHAR(32) NOT NULL,
    
    -- Feedback for training
    feedback_score DECIMAL(3,2),  -- 0-1, set after observing outcome
    feedback_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Partition by month for efficient cleanup
CREATE INDEX IF NOT EXISTS idx_axiom_inference_log_network_time 
    ON axiom_network_inference_log(network_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_axiom_inference_log_session 
    ON axiom_network_inference_log(session_id) WHERE session_id IS NOT NULL;

-- Network training batches - tracks CATO training cycles
CREATE TABLE IF NOT EXISTS axiom_network_training_batches (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id VARCHAR(32) NOT NULL REFERENCES axiom_network_status(network_id),
    
    -- Training parameters
    training_samples_count INTEGER NOT NULL,
    validation_samples_count INTEGER NOT NULL,
    epochs INTEGER NOT NULL DEFAULT 10,
    learning_rate DECIMAL(10,8) NOT NULL DEFAULT 0.001,
    
    -- Status
    status VARCHAR(32) NOT NULL DEFAULT 'pending',  -- pending, training, validating, deployed, failed
    sagemaker_training_job VARCHAR(256),
    
    -- Metrics
    training_loss DECIMAL(10,6),
    validation_loss DECIMAL(10,6),
    accuracy_before DECIMAL(5,4),
    accuracy_after DECIMAL(5,4),
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_axiom_training_batches_network 
    ON axiom_network_training_batches(network_id, created_at DESC);

-- Domain taxonomy embeddings for Domain Network fallback
CREATE TABLE IF NOT EXISTS domain_taxonomy_embeddings (
    domain_id VARCHAR(128) PRIMARY KEY,
    field_id VARCHAR(64),
    subspecialty_id VARCHAR(128),
    
    -- Embeddings
    centroid_embedding vector(1536),  -- Average embedding of domain examples
    example_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    last_computed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Vector index for domain similarity search
CREATE INDEX IF NOT EXISTS idx_domain_taxonomy_embeddings_vector 
    ON domain_taxonomy_embeddings USING ivfflat (centroid_embedding vector_cosine_ops) WITH (lists = 100);

-- Seed the 8 networks
INSERT INTO axiom_network_status (network_id, name, description, input_dim, output_dim, parameters, hidden_layers, activation_function, version)
VALUES 
    ('domain', 'Domain Network', 'Classifies queries into 800+ domain taxonomy', 1536, 800, 1000000, '[512, 256]', 'gelu', '1.0.0'),
    ('clarion', 'CLARION Network', 'Scores question relevance for adaptive questioning', 1536, 1, 400000, '[512, 256]', 'gelu', '1.0.0'),
    ('pattern', 'Pattern Network', 'Ranks prompt patterns for retrieval', 3072, 1, 500000, '[512, 256]', 'gelu', '1.0.0'),
    ('model', 'Model Network', 'Scores individual models for task suitability', 1536, 106, 200000, '[256, 128]', 'gelu', '1.0.0'),
    ('topology', 'Topology Network', 'Evaluates orchestration strategies (single/multi/chain)', 512, 9, 800000, '[256, 128, 64]', 'gelu', '1.0.0'),
    ('combination', 'Combination Network', 'Scores multi-model combinations for ensemble tasks', 640, 1, 150000, '[256, 128, 64]', 'gelu', '1.0.0'),
    ('variant', 'Variant Network', 'Scores prompt variants for model-specific optimization', 1536, 1, 200000, '[256, 128]', 'gelu', '1.0.0'),
    ('user', 'User Network', 'Personalizes scores via Ghost Vector integration', 128, 64, 50000, '[64, 32]', 'relu', '1.0.0')
ON CONFLICT (network_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    input_dim = EXCLUDED.input_dim,
    output_dim = EXCLUDED.output_dim,
    parameters = EXCLUDED.parameters,
    hidden_layers = EXCLUDED.hidden_layers,
    activation_function = EXCLUDED.activation_function,
    updated_at = NOW();

-- Function to update network metrics after inference
CREATE OR REPLACE FUNCTION update_axiom_network_metrics(
    p_network_id VARCHAR(32),
    p_latency_ms INTEGER,
    p_used_fallback BOOLEAN
) RETURNS VOID AS $$
DECLARE
    v_current_rpm DECIMAL(10,2);
    v_current_error_rate DECIMAL(5,4);
BEGIN
    -- Get current metrics
    SELECT requests_per_minute, error_rate INTO v_current_rpm, v_current_error_rate
    FROM axiom_network_status WHERE network_id = p_network_id;
    
    -- Update with exponential moving average
    UPDATE axiom_network_status
    SET 
        last_inference_ms = p_latency_ms,
        avg_latency_ms = COALESCE(avg_latency_ms * 0.95 + p_latency_ms * 0.05, p_latency_ms),
        total_inferences = total_inferences + 1,
        last_request_at = NOW(),
        error_rate = CASE WHEN p_used_fallback THEN LEAST(1.0, error_rate * 0.95 + 0.05) ELSE GREATEST(0.0, error_rate * 0.95) END,
        -- Promote to warm if cold and getting traffic
        thermal_state = CASE 
            WHEN thermal_state = 'cold' AND total_inferences > 10 THEN 'warm'::axiom_network_thermal_state
            ELSE thermal_state
        END,
        updated_at = NOW()
    WHERE network_id = p_network_id;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-cool idle networks
CREATE OR REPLACE FUNCTION auto_cool_axiom_networks() RETURNS INTEGER AS $$
DECLARE
    v_cooled_count INTEGER := 0;
BEGIN
    UPDATE axiom_network_status
    SET thermal_state = 'cold'::axiom_network_thermal_state,
        updated_at = NOW()
    WHERE thermal_state IN ('warm', 'hot')
      AND last_request_at < NOW() - (auto_cool_after_minutes || ' minutes')::INTERVAL;
    
    GET DIAGNOSTICS v_cooled_count = ROW_COUNT;
    RETURN v_cooled_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE axiom_network_status IS 'Status and configuration for the 8 AXIOM Neural Cortex networks';
COMMENT ON TABLE axiom_network_inference_log IS 'Inference log for training data collection';
COMMENT ON TABLE axiom_network_training_batches IS 'CATO training batch tracking';
COMMENT ON TABLE domain_taxonomy_embeddings IS 'Precomputed domain embeddings for Domain Network fallback';
