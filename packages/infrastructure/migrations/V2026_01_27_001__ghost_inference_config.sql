-- RADIANT v5.52.40 - Ghost Inference Configuration
-- Admin-configurable vLLM settings for ghost vector extraction
-- Enables runtime tuning of self-hosted LLaMA inference parameters

-- ============================================================================
-- Enums
-- ============================================================================

CREATE TYPE ghost_inference_dtype AS ENUM ('float16', 'bfloat16', 'float32');
CREATE TYPE ghost_inference_status AS ENUM ('active', 'warming', 'scaling', 'error', 'disabled');

-- ============================================================================
-- Configuration Table
-- ============================================================================

CREATE TABLE ghost_inference_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Model Configuration
    model_name TEXT NOT NULL DEFAULT 'meta-llama/Llama-3-70B-Instruct',
    model_version TEXT DEFAULT 'latest',
    
    -- vLLM Parameters
    tensor_parallel_size INTEGER NOT NULL DEFAULT 4 CHECK (tensor_parallel_size IN (1, 2, 4, 8)),
    max_model_len INTEGER NOT NULL DEFAULT 8192 CHECK (max_model_len BETWEEN 1024 AND 131072),
    dtype ghost_inference_dtype NOT NULL DEFAULT 'float16',
    gpu_memory_utilization DECIMAL(3,2) NOT NULL DEFAULT 0.90 CHECK (gpu_memory_utilization BETWEEN 0.50 AND 0.99),
    
    -- Hidden State Extraction (Ghost Vectors)
    return_hidden_states BOOLEAN NOT NULL DEFAULT true,
    hidden_state_layer INTEGER NOT NULL DEFAULT -1 CHECK (hidden_state_layer BETWEEN -80 AND 0),
    ghost_vector_dimension INTEGER NOT NULL DEFAULT 8192,
    
    -- Performance Tuning
    max_num_seqs INTEGER NOT NULL DEFAULT 256 CHECK (max_num_seqs BETWEEN 1 AND 1024),
    max_num_batched_tokens INTEGER DEFAULT NULL,
    swap_space_gb INTEGER NOT NULL DEFAULT 4 CHECK (swap_space_gb BETWEEN 0 AND 64),
    enforce_eager BOOLEAN NOT NULL DEFAULT false,
    
    -- Quantization
    quantization TEXT DEFAULT NULL CHECK (quantization IN (NULL, 'awq', 'gptq', 'squeezellm', 'fp8')),
    
    -- Infrastructure
    instance_type TEXT NOT NULL DEFAULT 'ml.g5.12xlarge',
    min_instances INTEGER NOT NULL DEFAULT 1 CHECK (min_instances >= 0),
    max_instances INTEGER NOT NULL DEFAULT 4 CHECK (max_instances >= min_instances),
    scale_to_zero BOOLEAN NOT NULL DEFAULT false,
    warmup_instances INTEGER NOT NULL DEFAULT 1,
    
    -- Async Inference
    max_concurrent_invocations INTEGER NOT NULL DEFAULT 4 CHECK (max_concurrent_invocations BETWEEN 1 AND 32),
    startup_health_check_timeout_seconds INTEGER NOT NULL DEFAULT 600 CHECK (startup_health_check_timeout_seconds BETWEEN 120 AND 1800),
    
    -- Endpoint naming
    endpoint_name_prefix TEXT NOT NULL DEFAULT 'radiant-ghost',
    
    -- Status tracking
    status ghost_inference_status NOT NULL DEFAULT 'disabled',
    last_deployment_at TIMESTAMPTZ,
    last_error TEXT,
    last_error_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    UNIQUE(tenant_id)
);

-- ============================================================================
-- Deployment History
-- ============================================================================

CREATE TABLE ghost_inference_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    config_snapshot JSONB NOT NULL,
    
    -- Deployment details
    endpoint_name TEXT NOT NULL,
    endpoint_arn TEXT,
    sagemaker_model_name TEXT,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'deploying', 'active', 'failed', 'terminated')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    terminated_at TIMESTAMPTZ,
    
    -- Metrics
    startup_duration_seconds INTEGER,
    total_invocations BIGINT DEFAULT 0,
    total_errors BIGINT DEFAULT 0,
    avg_latency_ms DECIMAL(10,2),
    
    -- Error tracking
    error_message TEXT,
    error_details JSONB,
    
    -- Cost tracking
    estimated_hourly_cost DECIMAL(10,4),
    actual_cost_usd DECIMAL(12,4) DEFAULT 0,
    
    created_by UUID REFERENCES users(id)
);

-- ============================================================================
-- Metrics Table
-- ============================================================================

CREATE TABLE ghost_inference_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    deployment_id UUID REFERENCES ghost_inference_deployments(id) ON DELETE CASCADE,
    
    -- Time window
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    
    -- Request metrics
    total_requests INTEGER NOT NULL DEFAULT 0,
    successful_requests INTEGER NOT NULL DEFAULT 0,
    failed_requests INTEGER NOT NULL DEFAULT 0,
    
    -- Latency metrics (ms)
    avg_latency_ms DECIMAL(10,2),
    p50_latency_ms DECIMAL(10,2),
    p95_latency_ms DECIMAL(10,2),
    p99_latency_ms DECIMAL(10,2),
    max_latency_ms DECIMAL(10,2),
    
    -- Throughput
    tokens_processed BIGINT DEFAULT 0,
    hidden_states_extracted BIGINT DEFAULT 0,
    
    -- Resource utilization
    avg_gpu_utilization DECIMAL(5,2),
    avg_gpu_memory_utilization DECIMAL(5,2),
    avg_cpu_utilization DECIMAL(5,2),
    
    -- Instance count
    active_instances INTEGER DEFAULT 0,
    
    -- Cost
    cost_usd DECIMAL(10,4) DEFAULT 0
);

-- ============================================================================
-- Instance Type Registry
-- ============================================================================

CREATE TABLE ghost_inference_instance_types (
    instance_type TEXT PRIMARY KEY,
    gpu_count INTEGER NOT NULL,
    gpu_type TEXT NOT NULL,
    gpu_memory_gb INTEGER NOT NULL,
    vcpu_count INTEGER NOT NULL,
    memory_gb INTEGER NOT NULL,
    hourly_cost_usd DECIMAL(8,4) NOT NULL,
    max_tensor_parallel INTEGER NOT NULL,
    recommended_for TEXT[],
    is_available BOOLEAN NOT NULL DEFAULT true
);

-- Seed instance types
INSERT INTO ghost_inference_instance_types (instance_type, gpu_count, gpu_type, gpu_memory_gb, vcpu_count, memory_gb, hourly_cost_usd, max_tensor_parallel, recommended_for) VALUES
('ml.g5.xlarge', 1, 'A10G', 24, 4, 16, 1.41, 1, ARRAY['testing', '7b-models']),
('ml.g5.2xlarge', 1, 'A10G', 24, 8, 32, 1.52, 1, ARRAY['testing', '7b-models']),
('ml.g5.4xlarge', 1, 'A10G', 24, 16, 64, 2.03, 1, ARRAY['7b-models', '13b-models']),
('ml.g5.8xlarge', 1, 'A10G', 24, 32, 128, 3.06, 1, ARRAY['13b-models']),
('ml.g5.12xlarge', 4, 'A10G', 96, 48, 192, 7.09, 4, ARRAY['70b-models', 'ghost-vectors']),
('ml.g5.24xlarge', 4, 'A10G', 96, 96, 384, 10.18, 4, ARRAY['70b-models', 'ghost-vectors', 'high-throughput']),
('ml.g5.48xlarge', 8, 'A10G', 192, 192, 768, 20.36, 8, ARRAY['70b-models', 'production']),
('ml.p4d.24xlarge', 8, 'A100', 320, 96, 1152, 32.77, 8, ARRAY['70b-models', 'production', 'low-latency']),
('ml.p4de.24xlarge', 8, 'A100-80GB', 640, 96, 1152, 40.97, 8, ARRAY['70b-models', 'production', '100b-models']);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_ghost_inference_config_tenant ON ghost_inference_config(tenant_id);
CREATE INDEX idx_ghost_inference_config_status ON ghost_inference_config(status);
CREATE INDEX idx_ghost_inference_deployments_tenant ON ghost_inference_deployments(tenant_id);
CREATE INDEX idx_ghost_inference_deployments_status ON ghost_inference_deployments(status);
CREATE INDEX idx_ghost_inference_metrics_tenant_time ON ghost_inference_metrics(tenant_id, recorded_at DESC);
CREATE INDEX idx_ghost_inference_metrics_deployment ON ghost_inference_metrics(deployment_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE ghost_inference_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghost_inference_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghost_inference_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY ghost_inference_config_tenant_isolation ON ghost_inference_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY ghost_inference_deployments_tenant_isolation ON ghost_inference_deployments
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY ghost_inference_metrics_tenant_isolation ON ghost_inference_metrics
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION get_ghost_inference_dashboard(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_config RECORD;
    v_deployment RECORD;
    v_metrics JSONB;
    v_result JSONB;
BEGIN
    -- Get current config
    SELECT * INTO v_config FROM ghost_inference_config WHERE tenant_id = p_tenant_id;
    
    -- Get active deployment
    SELECT * INTO v_deployment FROM ghost_inference_deployments 
    WHERE tenant_id = p_tenant_id AND status = 'active'
    ORDER BY started_at DESC LIMIT 1;
    
    -- Get recent metrics (last 24h aggregated)
    SELECT jsonb_build_object(
        'total_requests', COALESCE(SUM(total_requests), 0),
        'successful_requests', COALESCE(SUM(successful_requests), 0),
        'failed_requests', COALESCE(SUM(failed_requests), 0),
        'avg_latency_ms', ROUND(AVG(avg_latency_ms)::NUMERIC, 2),
        'p95_latency_ms', MAX(p95_latency_ms),
        'tokens_processed', COALESCE(SUM(tokens_processed), 0),
        'hidden_states_extracted', COALESCE(SUM(hidden_states_extracted), 0),
        'cost_usd', ROUND(COALESCE(SUM(cost_usd), 0)::NUMERIC, 4)
    ) INTO v_metrics
    FROM ghost_inference_metrics 
    WHERE tenant_id = p_tenant_id 
    AND recorded_at > NOW() - INTERVAL '24 hours';
    
    -- Build result
    v_result := jsonb_build_object(
        'config', CASE WHEN v_config IS NULL THEN NULL ELSE to_jsonb(v_config) END,
        'activeDeployment', CASE WHEN v_deployment IS NULL THEN NULL ELSE to_jsonb(v_deployment) END,
        'metrics24h', COALESCE(v_metrics, '{}'::JSONB),
        'instanceTypes', (SELECT jsonb_agg(to_jsonb(t)) FROM ghost_inference_instance_types t WHERE is_available = true)
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ghost_inference_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ghost_inference_config_updated
    BEFORE UPDATE ON ghost_inference_config
    FOR EACH ROW EXECUTE FUNCTION update_ghost_inference_config_timestamp();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE ghost_inference_config IS 'Admin-configurable vLLM settings for ghost vector extraction';
COMMENT ON TABLE ghost_inference_deployments IS 'History of SageMaker endpoint deployments';
COMMENT ON TABLE ghost_inference_metrics IS 'Performance and cost metrics for ghost inference';
COMMENT ON TABLE ghost_inference_instance_types IS 'Available SageMaker instance types for ghost inference';
COMMENT ON COLUMN ghost_inference_config.tensor_parallel_size IS 'Number of GPUs for tensor parallelism (must match instance GPU count)';
COMMENT ON COLUMN ghost_inference_config.hidden_state_layer IS 'Layer to extract hidden states from (-1 = last layer)';
COMMENT ON COLUMN ghost_inference_config.gpu_memory_utilization IS 'Fraction of GPU memory to use (0.90 = 90%)';
