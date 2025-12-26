-- RADIANT v4.17.0 - Migration 003: AI Models Registry
-- Providers and models configuration

-- ============================================================================
-- PROVIDERS TABLE
-- ============================================================================

CREATE TABLE providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('external', 'self_hosted')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('text', 'image', 'video', 'audio', 'embedding', 'search', '3d')),
    base_url VARCHAR(500) NOT NULL,
    api_key_secret_arn VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    health_status VARCHAR(20) NOT NULL DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_providers_name ON providers(name);
CREATE INDEX idx_providers_type ON providers(type);
CREATE INDEX idx_providers_category ON providers(category);
CREATE INDEX idx_providers_status ON providers(status);

-- ============================================================================
-- MODELS TABLE
-- ============================================================================

CREATE TABLE models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL UNIQUE,
    display_name VARCHAR(300) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('text', 'image', 'video', 'audio', 'embedding', 'search', '3d')),
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    context_window INTEGER,
    max_output_tokens INTEGER,
    input_cost_per_1k DECIMAL(10, 6) NOT NULL DEFAULT 0,
    output_cost_per_1k DECIMAL(10, 6) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_models_provider_id ON models(provider_id);
CREATE INDEX idx_models_name ON models(name);
CREATE INDEX idx_models_category ON models(category);
CREATE INDEX idx_models_status ON models(status);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA: External Providers
-- ============================================================================

INSERT INTO providers (name, display_name, type, category, base_url, status) VALUES
    ('openai', 'OpenAI', 'external', 'text', 'https://api.openai.com/v1', 'active'),
    ('anthropic', 'Anthropic', 'external', 'text', 'https://api.anthropic.com/v1', 'active'),
    ('google', 'Google AI', 'external', 'text', 'https://generativelanguage.googleapis.com/v1', 'active'),
    ('xai', 'xAI', 'external', 'text', 'https://api.x.ai/v1', 'active'),
    ('deepseek', 'DeepSeek', 'external', 'text', 'https://api.deepseek.com/v1', 'active'),
    ('mistral', 'Mistral AI', 'external', 'text', 'https://api.mistral.ai/v1', 'active'),
    ('cohere', 'Cohere', 'external', 'embedding', 'https://api.cohere.ai/v1', 'active'),
    ('stability', 'Stability AI', 'external', 'image', 'https://api.stability.ai/v1', 'active'),
    ('replicate', 'Replicate', 'external', 'image', 'https://api.replicate.com/v1', 'active'),
    ('elevenlabs', 'ElevenLabs', 'external', 'audio', 'https://api.elevenlabs.io/v1', 'active'),
    ('runway', 'Runway', 'external', 'video', 'https://api.runwayml.com/v1', 'active'),
    ('perplexity', 'Perplexity', 'external', 'search', 'https://api.perplexity.ai', 'active');

-- ============================================================================
-- SEED DATA: Popular Models
-- ============================================================================

INSERT INTO models (provider_id, name, display_name, category, capabilities, context_window, max_output_tokens, input_cost_per_1k, output_cost_per_1k, config) VALUES
    -- OpenAI
    ((SELECT id FROM providers WHERE name = 'openai'), 'gpt-4o', 'GPT-4o', 'text', ARRAY['chat', 'vision', 'function_calling'], 128000, 16384, 0.0025, 0.01, '{"litellm_model_name": "gpt-4o"}'),
    ((SELECT id FROM providers WHERE name = 'openai'), 'gpt-4o-mini', 'GPT-4o Mini', 'text', ARRAY['chat', 'vision', 'function_calling'], 128000, 16384, 0.00015, 0.0006, '{"litellm_model_name": "gpt-4o-mini"}'),
    ((SELECT id FROM providers WHERE name = 'openai'), 'o1', 'o1', 'text', ARRAY['chat', 'reasoning'], 200000, 100000, 0.015, 0.06, '{"litellm_model_name": "o1"}'),
    ((SELECT id FROM providers WHERE name = 'openai'), 'o1-mini', 'o1 Mini', 'text', ARRAY['chat', 'reasoning'], 128000, 65536, 0.003, 0.012, '{"litellm_model_name": "o1-mini"}'),
    
    -- Anthropic
    ((SELECT id FROM providers WHERE name = 'anthropic'), 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 'text', ARRAY['chat', 'vision', 'function_calling'], 200000, 8192, 0.003, 0.015, '{"litellm_model_name": "claude-3-5-sonnet-20241022"}'),
    ((SELECT id FROM providers WHERE name = 'anthropic'), 'claude-3-5-haiku-20241022', 'Claude 3.5 Haiku', 'text', ARRAY['chat', 'vision', 'function_calling'], 200000, 8192, 0.0008, 0.004, '{"litellm_model_name": "claude-3-5-haiku-20241022"}'),
    ((SELECT id FROM providers WHERE name = 'anthropic'), 'claude-3-opus-20240229', 'Claude 3 Opus', 'text', ARRAY['chat', 'vision', 'function_calling'], 200000, 4096, 0.015, 0.075, '{"litellm_model_name": "claude-3-opus-20240229"}'),
    
    -- Google
    ((SELECT id FROM providers WHERE name = 'google'), 'gemini-2.0-flash-exp', 'Gemini 2.0 Flash', 'text', ARRAY['chat', 'vision', 'function_calling'], 1000000, 8192, 0.00, 0.00, '{"litellm_model_name": "gemini/gemini-2.0-flash-exp"}'),
    ((SELECT id FROM providers WHERE name = 'google'), 'gemini-1.5-pro', 'Gemini 1.5 Pro', 'text', ARRAY['chat', 'vision', 'function_calling'], 2000000, 8192, 0.00125, 0.005, '{"litellm_model_name": "gemini/gemini-1.5-pro"}'),
    
    -- xAI
    ((SELECT id FROM providers WHERE name = 'xai'), 'grok-2-1212', 'Grok 2', 'text', ARRAY['chat', 'vision', 'function_calling'], 131072, 131072, 0.002, 0.01, '{"litellm_model_name": "xai/grok-2-1212"}'),
    
    -- DeepSeek
    ((SELECT id FROM providers WHERE name = 'deepseek'), 'deepseek-chat', 'DeepSeek V3', 'text', ARRAY['chat', 'function_calling'], 64000, 8192, 0.00014, 0.00028, '{"litellm_model_name": "deepseek/deepseek-chat"}'),
    ((SELECT id FROM providers WHERE name = 'deepseek'), 'deepseek-reasoner', 'DeepSeek R1', 'text', ARRAY['chat', 'reasoning'], 64000, 8192, 0.00055, 0.00219, '{"litellm_model_name": "deepseek/deepseek-reasoner"}');
