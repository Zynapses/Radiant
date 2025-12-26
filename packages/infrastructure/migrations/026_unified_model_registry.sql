-- RADIANT v4.17.0 - Migration 026: Unified Model Registry
-- Self-hosted models catalog and provider health monitoring

CREATE TABLE self_hosted_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    category VARCHAR(50) NOT NULL CHECK (category IN ('vision', 'audio', 'scientific', 'medical', 'geospatial', '3d', 'llm', 'multimodal')),
    specialty VARCHAR(50) NOT NULL,
    
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    input_modalities TEXT[] NOT NULL DEFAULT '{text}',
    output_modalities TEXT[] NOT NULL DEFAULT '{text}',
    primary_mode VARCHAR(20) NOT NULL DEFAULT 'inference',
    
    sagemaker_image VARCHAR(500),
    instance_type VARCHAR(50),
    gpu_memory_gb INTEGER DEFAULT 0,
    environment JSONB NOT NULL DEFAULT '{}',
    model_data_url TEXT,
    
    parameters BIGINT,
    accuracy VARCHAR(100),
    benchmark VARCHAR(255),
    context_window INTEGER,
    max_output INTEGER,
    
    input_formats TEXT[] NOT NULL DEFAULT '{}',
    output_formats TEXT[] NOT NULL DEFAULT '{}',
    
    license VARCHAR(100) NOT NULL DEFAULT 'Apache-2.0',
    license_url TEXT,
    commercial_use_allowed BOOLEAN NOT NULL DEFAULT true,
    commercial_use_notes TEXT,
    attribution_required BOOLEAN NOT NULL DEFAULT false,
    
    hourly_rate DECIMAL(10, 4) NOT NULL DEFAULT 0,
    per_request DECIMAL(10, 6),
    per_image DECIMAL(10, 6),
    per_minute_audio DECIMAL(10, 6),
    markup_percent DECIMAL(5, 2) NOT NULL DEFAULT 75.00,
    
    min_tier INTEGER NOT NULL DEFAULT 3,
    
    default_thermal_state VARCHAR(20) NOT NULL DEFAULT 'cold',
    warmup_time_seconds INTEGER NOT NULL DEFAULT 60,
    scale_to_zero_minutes INTEGER NOT NULL DEFAULT 15,
    min_instances INTEGER NOT NULL DEFAULT 0,
    max_instances INTEGER NOT NULL DEFAULT 3,
    
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    is_active BOOLEAN NOT NULL DEFAULT true,
    deprecated BOOLEAN NOT NULL DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE provider_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id VARCHAR(50) NOT NULL,
    region VARCHAR(50) NOT NULL DEFAULT 'us-east-1',
    
    status VARCHAR(20) NOT NULL DEFAULT 'unknown' CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
    avg_latency_ms INTEGER,
    p95_latency_ms INTEGER,
    p99_latency_ms INTEGER,
    error_rate DECIMAL(5, 2),
    success_rate DECIMAL(5, 2),
    
    last_check_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    last_error TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(provider_id, region)
);

CREATE TABLE registry_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('full', 'health', 'pricing', 'models')),
    
    providers_updated INTEGER NOT NULL DEFAULT 0,
    models_added INTEGER NOT NULL DEFAULT 0,
    models_updated INTEGER NOT NULL DEFAULT 0,
    models_deprecated INTEGER NOT NULL DEFAULT 0,
    errors TEXT[],
    
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    error_message TEXT
);

CREATE INDEX idx_self_hosted_category ON self_hosted_models(category);
CREATE INDEX idx_self_hosted_specialty ON self_hosted_models(specialty);
CREATE INDEX idx_self_hosted_status ON self_hosted_models(status);
CREATE INDEX idx_self_hosted_active ON self_hosted_models(is_active) WHERE is_active = true;
CREATE INDEX idx_provider_health_provider ON provider_health(provider_id);
CREATE INDEX idx_provider_health_status ON provider_health(status);
CREATE INDEX idx_registry_sync_type ON registry_sync_log(sync_type);
CREATE INDEX idx_registry_sync_status ON registry_sync_log(status);

ALTER TABLE self_hosted_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY self_hosted_models_read ON self_hosted_models FOR SELECT USING (true);
CREATE POLICY provider_health_read ON provider_health FOR SELECT USING (true);

CREATE TRIGGER update_self_hosted_models_updated_at 
    BEFORE UPDATE ON self_hosted_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_health_updated_at 
    BEFORE UPDATE ON provider_health
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
