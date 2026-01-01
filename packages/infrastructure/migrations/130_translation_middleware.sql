-- RADIANT v4.18.0 - Translation Middleware
-- Automatic translation layer for multilingual model routing
-- Migration: 130_translation_middleware.sql

-- ============================================================================
-- TRANSLATION CONFIGURATION (Per-Tenant)
-- ============================================================================

CREATE TABLE IF NOT EXISTS translation_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    translation_model VARCHAR(100) NOT NULL DEFAULT 'qwen2.5-7b-instruct',
    cache_enabled BOOLEAN NOT NULL DEFAULT true,
    cache_ttl_hours INTEGER NOT NULL DEFAULT 168, -- 7 days
    max_cache_size INTEGER NOT NULL DEFAULT 10000,
    confidence_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.70,
    max_input_length INTEGER NOT NULL DEFAULT 50000,
    preserve_code_blocks BOOLEAN NOT NULL DEFAULT true,
    preserve_urls BOOLEAN NOT NULL DEFAULT true,
    preserve_mentions BOOLEAN NOT NULL DEFAULT true,
    fallback_to_english BOOLEAN NOT NULL DEFAULT true,
    cost_limit_per_day_cents INTEGER NOT NULL DEFAULT 1000, -- $10/day
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE translation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY translation_config_tenant_isolation ON translation_config
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- MODEL LANGUAGE MATRICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_language_matrices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(100) NOT NULL UNIQUE,
    primary_language VARCHAR(10) NOT NULL DEFAULT 'en',
    translate_threshold VARCHAR(20) NOT NULL DEFAULT 'moderate', -- native, good, moderate, poor, none
    is_external BOOLEAN NOT NULL DEFAULT false, -- External API models (Claude, GPT-4)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Model language capabilities (per-language support for each model)
CREATE TABLE IF NOT EXISTS model_language_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matrix_id UUID NOT NULL REFERENCES model_language_matrices(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL,
    support_level VARCHAR(20) NOT NULL, -- native, good, moderate, poor, none
    quality_score INTEGER NOT NULL CHECK (quality_score >= 0 AND quality_score <= 100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(matrix_id, language_code)
);

CREATE INDEX idx_model_lang_cap_matrix ON model_language_capabilities(matrix_id);
CREATE INDEX idx_model_lang_cap_language ON model_language_capabilities(language_code);

-- ============================================================================
-- TRANSLATION CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS translation_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_hash VARCHAR(64) NOT NULL, -- SHA256 hash of source text + languages
    source_language VARCHAR(10) NOT NULL,
    target_language VARCHAR(10) NOT NULL,
    source_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    confidence NUMERIC(3,2) NOT NULL,
    model_used VARCHAR(100) NOT NULL,
    hit_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE(tenant_id, source_hash)
);

CREATE INDEX idx_translation_cache_tenant ON translation_cache(tenant_id);
CREATE INDEX idx_translation_cache_hash ON translation_cache(source_hash);
CREATE INDEX idx_translation_cache_expires ON translation_cache(expires_at);

-- Enable RLS
ALTER TABLE translation_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY translation_cache_tenant_isolation ON translation_cache
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- TRANSLATION METRICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS translation_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    source_language VARCHAR(10) NOT NULL,
    target_language VARCHAR(10) NOT NULL,
    input_length INTEGER NOT NULL,
    output_length INTEGER NOT NULL,
    tokens_input INTEGER NOT NULL,
    tokens_output INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    confidence NUMERIC(3,2) NOT NULL,
    model_used VARCHAR(100) NOT NULL,
    cached BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_translation_metrics_tenant ON translation_metrics(tenant_id);
CREATE INDEX idx_translation_metrics_created ON translation_metrics(created_at);
CREATE INDEX idx_translation_metrics_langs ON translation_metrics(source_language, target_language);

-- Partitioned by month for better performance
-- (Optional: implement partitioning in production)

-- ============================================================================
-- TRANSLATION EVENTS (Audit Log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS translation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id UUID,
    session_id UUID,
    event_type VARCHAR(50) NOT NULL, -- 'input_translated', 'output_translated', 'cache_hit', 'error'
    source_language VARCHAR(10) NOT NULL,
    target_language VARCHAR(10) NOT NULL,
    model_id VARCHAR(100), -- Target model being used
    input_length INTEGER,
    output_length INTEGER,
    latency_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_translation_events_tenant ON translation_events(tenant_id);
CREATE INDEX idx_translation_events_created ON translation_events(created_at);
CREATE INDEX idx_translation_events_type ON translation_events(event_type);

-- ============================================================================
-- SEED DATA: Model Language Matrices
-- ============================================================================

-- External Models (excellent multilingual, never translate)
INSERT INTO model_language_matrices (model_id, primary_language, translate_threshold, is_external) VALUES
    ('claude-3-5-sonnet', 'en', 'none', true),
    ('claude-3-5-haiku', 'en', 'none', true),
    ('claude-3-opus', 'en', 'none', true),
    ('gpt-4o', 'en', 'none', true),
    ('gpt-4-turbo', 'en', 'none', true),
    ('gpt-4', 'en', 'none', true),
    ('gemini-1.5-pro', 'en', 'none', true),
    ('gemini-1.5-flash', 'en', 'none', true)
ON CONFLICT (model_id) DO NOTHING;

-- Self-Hosted Models
INSERT INTO model_language_matrices (model_id, primary_language, translate_threshold, is_external) VALUES
    ('qwen2.5-72b-instruct', 'en', 'moderate', false),
    ('qwen2.5-32b-instruct', 'en', 'moderate', false),
    ('qwen2.5-7b-instruct', 'en', 'good', false),
    ('qwen2.5-coder-32b', 'en', 'good', false),
    ('mistral-large-2411', 'en', 'moderate', false),
    ('mistral-nemo-12b', 'en', 'good', false),
    ('llama-3.3-70b-instruct', 'en', 'good', false),
    ('llama-3.2-8b-instruct', 'en', 'native', false),
    ('llama-3.2-3b-instruct', 'en', 'native', false),
    ('deepseek-v3', 'en', 'moderate', false),
    ('deepseek-coder-33b', 'en', 'good', false)
ON CONFLICT (model_id) DO NOTHING;

-- ============================================================================
-- SEED DATA: Language Capabilities for Key Models
-- ============================================================================

-- Helper function to insert capabilities
CREATE OR REPLACE FUNCTION insert_model_capabilities(
    p_model_id VARCHAR(100),
    p_capabilities JSONB
) RETURNS VOID AS $$
DECLARE
    matrix_id UUID;
    cap JSONB;
BEGIN
    SELECT id INTO matrix_id FROM model_language_matrices WHERE model_id = p_model_id;
    IF matrix_id IS NULL THEN
        RETURN;
    END IF;
    
    FOR cap IN SELECT * FROM jsonb_array_elements(p_capabilities)
    LOOP
        INSERT INTO model_language_capabilities (matrix_id, language_code, support_level, quality_score)
        VALUES (
            matrix_id,
            cap->>'lang',
            cap->>'level',
            (cap->>'score')::INTEGER
        )
        ON CONFLICT (matrix_id, language_code) DO UPDATE SET
            support_level = EXCLUDED.support_level,
            quality_score = EXCLUDED.quality_score;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Claude 3.5 Sonnet (excellent all languages)
SELECT insert_model_capabilities('claude-3-5-sonnet', '[
    {"lang": "en", "level": "native", "score": 100},
    {"lang": "es", "level": "native", "score": 95},
    {"lang": "fr", "level": "native", "score": 95},
    {"lang": "de", "level": "native", "score": 95},
    {"lang": "pt", "level": "native", "score": 93},
    {"lang": "it", "level": "native", "score": 93},
    {"lang": "nl", "level": "native", "score": 90},
    {"lang": "pl", "level": "native", "score": 90},
    {"lang": "ru", "level": "native", "score": 92},
    {"lang": "tr", "level": "native", "score": 88},
    {"lang": "ja", "level": "native", "score": 92},
    {"lang": "ko", "level": "native", "score": 90},
    {"lang": "zh-CN", "level": "native", "score": 92},
    {"lang": "zh-TW", "level": "native", "score": 90},
    {"lang": "ar", "level": "good", "score": 85},
    {"lang": "hi", "level": "good", "score": 82},
    {"lang": "th", "level": "good", "score": 80},
    {"lang": "vi", "level": "good", "score": 80}
]'::JSONB);

-- GPT-4o (excellent all languages)
SELECT insert_model_capabilities('gpt-4o', '[
    {"lang": "en", "level": "native", "score": 100},
    {"lang": "es", "level": "native", "score": 95},
    {"lang": "fr", "level": "native", "score": 95},
    {"lang": "de", "level": "native", "score": 95},
    {"lang": "pt", "level": "native", "score": 93},
    {"lang": "it", "level": "native", "score": 93},
    {"lang": "nl", "level": "native", "score": 90},
    {"lang": "pl", "level": "native", "score": 90},
    {"lang": "ru", "level": "native", "score": 92},
    {"lang": "tr", "level": "native", "score": 88},
    {"lang": "ja", "level": "native", "score": 92},
    {"lang": "ko", "level": "native", "score": 90},
    {"lang": "zh-CN", "level": "native", "score": 92},
    {"lang": "zh-TW", "level": "native", "score": 90},
    {"lang": "ar", "level": "good", "score": 85},
    {"lang": "hi", "level": "good", "score": 82},
    {"lang": "th", "level": "good", "score": 80},
    {"lang": "vi", "level": "good", "score": 80}
]'::JSONB);

-- Qwen 2.5 72B (excellent Chinese/Japanese)
SELECT insert_model_capabilities('qwen2.5-72b-instruct', '[
    {"lang": "en", "level": "native", "score": 95},
    {"lang": "zh-CN", "level": "native", "score": 98},
    {"lang": "zh-TW", "level": "native", "score": 95},
    {"lang": "ja", "level": "native", "score": 90},
    {"lang": "ko", "level": "good", "score": 85},
    {"lang": "es", "level": "good", "score": 80},
    {"lang": "fr", "level": "good", "score": 80},
    {"lang": "de", "level": "good", "score": 78},
    {"lang": "pt", "level": "good", "score": 75},
    {"lang": "it", "level": "moderate", "score": 70},
    {"lang": "ru", "level": "good", "score": 75},
    {"lang": "nl", "level": "moderate", "score": 65},
    {"lang": "pl", "level": "moderate", "score": 60},
    {"lang": "tr", "level": "moderate", "score": 55},
    {"lang": "ar", "level": "moderate", "score": 60},
    {"lang": "hi", "level": "poor", "score": 45},
    {"lang": "th", "level": "poor", "score": 40},
    {"lang": "vi", "level": "moderate", "score": 55}
]'::JSONB);

-- Mistral Large (excellent European languages)
SELECT insert_model_capabilities('mistral-large-2411', '[
    {"lang": "en", "level": "native", "score": 95},
    {"lang": "fr", "level": "native", "score": 95},
    {"lang": "de", "level": "native", "score": 92},
    {"lang": "es", "level": "native", "score": 90},
    {"lang": "it", "level": "good", "score": 85},
    {"lang": "pt", "level": "good", "score": 82},
    {"lang": "nl", "level": "good", "score": 80},
    {"lang": "pl", "level": "moderate", "score": 70},
    {"lang": "ru", "level": "good", "score": 75},
    {"lang": "tr", "level": "moderate", "score": 55},
    {"lang": "ja", "level": "moderate", "score": 60},
    {"lang": "ko", "level": "moderate", "score": 55},
    {"lang": "zh-CN", "level": "moderate", "score": 55},
    {"lang": "zh-TW", "level": "moderate", "score": 50},
    {"lang": "ar", "level": "poor", "score": 40},
    {"lang": "hi", "level": "poor", "score": 35},
    {"lang": "th", "level": "poor", "score": 30},
    {"lang": "vi", "level": "poor", "score": 35}
]'::JSONB);

-- Llama 3.3 70B (good English, moderate others)
SELECT insert_model_capabilities('llama-3.3-70b-instruct', '[
    {"lang": "en", "level": "native", "score": 98},
    {"lang": "es", "level": "good", "score": 78},
    {"lang": "fr", "level": "good", "score": 78},
    {"lang": "de", "level": "good", "score": 75},
    {"lang": "pt", "level": "moderate", "score": 70},
    {"lang": "it", "level": "moderate", "score": 68},
    {"lang": "nl", "level": "moderate", "score": 60},
    {"lang": "pl", "level": "moderate", "score": 55},
    {"lang": "ru", "level": "moderate", "score": 60},
    {"lang": "tr", "level": "poor", "score": 45},
    {"lang": "ja", "level": "moderate", "score": 55},
    {"lang": "ko", "level": "moderate", "score": 50},
    {"lang": "zh-CN", "level": "moderate", "score": 55},
    {"lang": "zh-TW", "level": "moderate", "score": 50},
    {"lang": "ar", "level": "poor", "score": 40},
    {"lang": "hi", "level": "poor", "score": 35},
    {"lang": "th", "level": "poor", "score": 30},
    {"lang": "vi", "level": "poor", "score": 35}
]'::JSONB);

-- Llama 3.2 8B (English-centric, translate everything else)
SELECT insert_model_capabilities('llama-3.2-8b-instruct', '[
    {"lang": "en", "level": "native", "score": 90},
    {"lang": "es", "level": "moderate", "score": 55},
    {"lang": "fr", "level": "moderate", "score": 55},
    {"lang": "de", "level": "moderate", "score": 50},
    {"lang": "pt", "level": "poor", "score": 45},
    {"lang": "it", "level": "poor", "score": 45},
    {"lang": "nl", "level": "poor", "score": 35},
    {"lang": "pl", "level": "poor", "score": 30},
    {"lang": "ru", "level": "poor", "score": 40},
    {"lang": "tr", "level": "poor", "score": 25},
    {"lang": "ja", "level": "poor", "score": 35},
    {"lang": "ko", "level": "poor", "score": 30},
    {"lang": "zh-CN", "level": "poor", "score": 35},
    {"lang": "zh-TW", "level": "poor", "score": 30},
    {"lang": "ar", "level": "none", "score": 20},
    {"lang": "hi", "level": "none", "score": 15},
    {"lang": "th", "level": "none", "score": 10},
    {"lang": "vi", "level": "none", "score": 15}
]'::JSONB);

-- Qwen 2.5 7B (good multilingual for its size, used for translation)
SELECT insert_model_capabilities('qwen2.5-7b-instruct', '[
    {"lang": "en", "level": "native", "score": 88},
    {"lang": "zh-CN", "level": "native", "score": 92},
    {"lang": "zh-TW", "level": "good", "score": 85},
    {"lang": "ja", "level": "good", "score": 78},
    {"lang": "ko", "level": "moderate", "score": 65},
    {"lang": "es", "level": "good", "score": 72},
    {"lang": "fr", "level": "good", "score": 72},
    {"lang": "de", "level": "moderate", "score": 68},
    {"lang": "pt", "level": "moderate", "score": 65},
    {"lang": "it", "level": "moderate", "score": 60},
    {"lang": "ru", "level": "moderate", "score": 62},
    {"lang": "nl", "level": "moderate", "score": 55},
    {"lang": "pl", "level": "poor", "score": 45},
    {"lang": "tr", "level": "poor", "score": 42},
    {"lang": "ar", "level": "moderate", "score": 50},
    {"lang": "hi", "level": "poor", "score": 38},
    {"lang": "th", "level": "poor", "score": 35},
    {"lang": "vi", "level": "moderate", "score": 48}
]'::JSONB);

-- Clean up helper function
DROP FUNCTION IF EXISTS insert_model_capabilities(VARCHAR, JSONB);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_translation_config_tenant ON translation_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_model_lang_matrices_model ON model_language_matrices(model_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_translation_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_translation_config_updated
    BEFORE UPDATE ON translation_config
    FOR EACH ROW
    EXECUTE FUNCTION update_translation_config_timestamp();

-- Update cache hit count on access
CREATE OR REPLACE FUNCTION update_cache_hit_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.last_used_at != NEW.last_used_at THEN
        NEW.hit_count = OLD.hit_count + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_translation_cache_hit
    BEFORE UPDATE ON translation_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_cache_hit_count();

-- ============================================================================
-- CLEANUP JOB (to be scheduled via EventBridge)
-- ============================================================================

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_translation_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM translation_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to enforce max cache size per tenant
CREATE OR REPLACE FUNCTION enforce_translation_cache_limit()
RETURNS INTEGER AS $$
DECLARE
    tenant RECORD;
    max_size INTEGER;
    current_count INTEGER;
    to_delete INTEGER;
    deleted_total INTEGER := 0;
BEGIN
    FOR tenant IN SELECT DISTINCT tenant_id FROM translation_cache LOOP
        SELECT COALESCE(tc.max_cache_size, 10000) INTO max_size
        FROM translation_config tc WHERE tc.tenant_id = tenant.tenant_id;
        
        SELECT COUNT(*) INTO current_count
        FROM translation_cache WHERE tenant_id = tenant.tenant_id;
        
        IF current_count > max_size THEN
            to_delete := current_count - max_size;
            
            DELETE FROM translation_cache
            WHERE id IN (
                SELECT id FROM translation_cache
                WHERE tenant_id = tenant.tenant_id
                ORDER BY last_used_at ASC
                LIMIT to_delete
            );
            
            deleted_total := deleted_total + to_delete;
        END IF;
    END LOOP;
    
    RETURN deleted_total;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON translation_config TO radiant_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON translation_cache TO radiant_app;
GRANT SELECT, INSERT ON translation_metrics TO radiant_app;
GRANT SELECT, INSERT ON translation_events TO radiant_app;
GRANT SELECT ON model_language_matrices TO radiant_app;
GRANT SELECT ON model_language_capabilities TO radiant_app;
