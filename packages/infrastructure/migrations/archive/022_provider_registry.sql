-- RADIANT v4.17.0 - Migration 022: Dynamic Provider Registry
-- Database-driven AI provider and model management

CREATE TABLE ai_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    api_base VARCHAR(500) NOT NULL,
    auth_type VARCHAR(20) NOT NULL CHECK (auth_type IN ('api_key', 'oauth', 'iam', 'service_account')),
    auth_header VARCHAR(100) DEFAULT 'Authorization',
    auth_prefix VARCHAR(20) DEFAULT 'Bearer ',
    rate_limit_rpm INTEGER,
    rate_limit_tpm INTEGER,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100,
    health_check_url VARCHAR(500),
    last_health_check TIMESTAMPTZ,
    health_status VARCHAR(20) DEFAULT 'unknown',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id VARCHAR(100) NOT NULL UNIQUE,
    provider_id UUID NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('flagship', 'balanced', 'fast', 'budget', 'specialized', 'embedding', 'vision', 'audio')),
    specialty VARCHAR(50),
    
    context_window INTEGER NOT NULL DEFAULT 4096,
    max_output_tokens INTEGER DEFAULT 4096,
    supported_modalities TEXT[] DEFAULT '{text}',
    capabilities TEXT[] DEFAULT '{}',
    
    input_cost_per_1m DECIMAL(10, 4) NOT NULL DEFAULT 0,
    output_cost_per_1m DECIMAL(10, 4) NOT NULL DEFAULT 0,
    
    is_novel BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    min_tier INTEGER DEFAULT 1,
    
    performance_metrics JSONB DEFAULT '{}',
    default_parameters JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE provider_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
    credential_type VARCHAR(50) NOT NULL DEFAULT 'api_key',
    encrypted_value BYTEA NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_used TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, provider_id)
);

CREATE INDEX idx_ai_providers_active ON ai_providers(is_active) WHERE is_active = true;
CREATE INDEX idx_ai_models_provider ON ai_models(provider_id);
CREATE INDEX idx_ai_models_category ON ai_models(category);
CREATE INDEX idx_ai_models_active ON ai_models(is_active) WHERE is_active = true;
CREATE INDEX idx_provider_credentials_tenant ON provider_credentials(tenant_id);

ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_credentials ENABLE ROW LEVEL SECURITY;

-- Models are visible to all
CREATE POLICY ai_providers_read ON ai_providers FOR SELECT USING (true);
CREATE POLICY ai_models_read ON ai_models FOR SELECT USING (true);

-- Credentials are tenant-isolated
CREATE POLICY provider_credentials_isolation ON provider_credentials
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Insert default providers
INSERT INTO ai_providers (provider_id, display_name, api_base, auth_type) VALUES
    ('anthropic', 'Anthropic', 'https://api.anthropic.com/v1', 'api_key'),
    ('openai', 'OpenAI', 'https://api.openai.com/v1', 'api_key'),
    ('google', 'Google (Gemini)', 'https://generativelanguage.googleapis.com/v1', 'api_key'),
    ('xai', 'xAI (Grok)', 'https://api.x.ai/v1', 'api_key'),
    ('mistral', 'Mistral AI', 'https://api.mistral.ai/v1', 'api_key'),
    ('cohere', 'Cohere', 'https://api.cohere.ai/v1', 'api_key'),
    ('groq', 'Groq', 'https://api.groq.com/openai/v1', 'api_key'),
    ('bedrock', 'AWS Bedrock', 'https://bedrock-runtime.amazonaws.com', 'iam'),
    ('together', 'Together AI', 'https://api.together.xyz/v1', 'api_key'),
    ('fireworks', 'Fireworks AI', 'https://api.fireworks.ai/inference/v1', 'api_key');

CREATE TRIGGER update_ai_providers_updated_at 
    BEFORE UPDATE ON ai_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_models_updated_at 
    BEFORE UPDATE ON ai_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
