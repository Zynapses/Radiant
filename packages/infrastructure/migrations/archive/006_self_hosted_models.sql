-- RADIANT v4.17.0 - Migration 006: Self-Hosted Models
-- SageMaker endpoints and self-hosted model configuration

-- ============================================================================
-- SAGEMAKER ENDPOINTS TABLE
-- ============================================================================

CREATE TABLE sagemaker_endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    endpoint_name VARCHAR(200) NOT NULL UNIQUE,
    endpoint_arn VARCHAR(500) NOT NULL,
    model_name VARCHAR(200) NOT NULL,
    instance_type VARCHAR(50) NOT NULL,
    instance_count INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'creating' CHECK (status IN ('creating', 'in_service', 'updating', 'failed', 'deleting', 'deleted')),
    health_status VARCHAR(20) NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
    auto_scaling_enabled BOOLEAN NOT NULL DEFAULT false,
    min_instances INTEGER NOT NULL DEFAULT 1,
    max_instances INTEGER NOT NULL DEFAULT 10,
    config JSONB NOT NULL DEFAULT '{}',
    hourly_cost DECIMAL(10, 4) NOT NULL DEFAULT 0,
    last_health_check_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sagemaker_endpoints_provider_id ON sagemaker_endpoints(provider_id);
CREATE INDEX idx_sagemaker_endpoints_status ON sagemaker_endpoints(status);
CREATE INDEX idx_sagemaker_endpoints_endpoint_name ON sagemaker_endpoints(endpoint_name);

CREATE TRIGGER update_sagemaker_endpoints_updated_at BEFORE UPDATE ON sagemaker_endpoints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SELF-HOSTED MODELS TABLE
-- ============================================================================

CREATE TABLE self_hosted_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    endpoint_id UUID NOT NULL REFERENCES sagemaker_endpoints(id) ON DELETE CASCADE,
    model_variant VARCHAR(100),
    quantization VARCHAR(20),
    tensor_parallelism INTEGER DEFAULT 1,
    max_concurrent_requests INTEGER DEFAULT 128,
    estimated_cost_per_1k_tokens DECIMAL(10, 6) NOT NULL DEFAULT 0,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (model_id, endpoint_id)
);

CREATE INDEX idx_self_hosted_models_model_id ON self_hosted_models(model_id);
CREATE INDEX idx_self_hosted_models_endpoint_id ON self_hosted_models(endpoint_id);

CREATE TRIGGER update_self_hosted_models_updated_at BEFORE UPDATE ON self_hosted_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- THERMAL STATE TABLE (for model load balancing)
-- ============================================================================

CREATE TABLE model_thermal_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE UNIQUE,
    thermal_state VARCHAR(20) NOT NULL DEFAULT 'cold' CHECK (thermal_state IN ('hot', 'warm', 'cold')),
    current_load INTEGER NOT NULL DEFAULT 0,
    max_load INTEGER NOT NULL DEFAULT 100,
    last_request_at TIMESTAMPTZ,
    avg_latency_ms INTEGER,
    requests_per_minute INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_model_thermal_states_model_id ON model_thermal_states(model_id);
CREATE INDEX idx_model_thermal_states_thermal_state ON model_thermal_states(thermal_state);

-- ============================================================================
-- SEED DATA: Self-Hosted Provider
-- ============================================================================

INSERT INTO providers (name, display_name, type, category, base_url, status, config) VALUES
    ('sagemaker', 'AWS SageMaker', 'self_hosted', 'text', 'https://runtime.sagemaker.${AWS_REGION}.amazonaws.com', 'active', '{"markup_percent": 75}');

-- ============================================================================
-- SEED DATA: Self-Hosted Model Templates
-- ============================================================================

INSERT INTO models (provider_id, name, display_name, category, capabilities, context_window, max_output_tokens, input_cost_per_1k, output_cost_per_1k, status, config) VALUES
    -- These are templates - actual endpoints are created dynamically
    ((SELECT id FROM providers WHERE name = 'sagemaker'), 'llama-3.3-70b-instruct', 'Llama 3.3 70B Instruct', 'text', ARRAY['chat', 'function_calling'], 131072, 4096, 0.00065, 0.00275, 'inactive', '{"requires_endpoint": true, "instance_type": "ml.p4d.24xlarge"}'),
    ((SELECT id FROM providers WHERE name = 'sagemaker'), 'qwen2.5-72b-instruct', 'Qwen 2.5 72B Instruct', 'text', ARRAY['chat', 'function_calling'], 131072, 8192, 0.0004, 0.0012, 'inactive', '{"requires_endpoint": true, "instance_type": "ml.p4d.24xlarge"}'),
    ((SELECT id FROM providers WHERE name = 'sagemaker'), 'deepseek-v3', 'DeepSeek V3 (Self-Hosted)', 'text', ARRAY['chat', 'function_calling', 'moe'], 64000, 8192, 0.00027, 0.0011, 'inactive', '{"requires_endpoint": true, "instance_type": "ml.p5.48xlarge"}');
