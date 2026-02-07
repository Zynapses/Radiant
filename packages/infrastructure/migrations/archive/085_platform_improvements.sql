-- RADIANT v4.18.3 - Platform Improvements Migration
-- Implements fixes from AI review: delight toggle, semantic caching, adaptive storage, ethics config, shadow testing

-- ============================================================================
-- 1. Delight System Master Toggle
-- ============================================================================

ALTER TABLE user_delight_preferences
ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN user_delight_preferences.enabled IS 'Master toggle for entire delight system - default true';

-- ============================================================================
-- 2. Semantic Routing Cache for Brain Router
-- ============================================================================

CREATE TABLE IF NOT EXISTS routing_decision_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Cache key components
    prompt_embedding VECTOR(1536),  -- Semantic embedding of prompt
    prompt_hash TEXT NOT NULL,       -- Hash for exact match
    complexity TEXT NOT NULL,        -- simple, moderate, complex, expert
    task_type TEXT NOT NULL,
    
    -- Cached routing decision
    selected_model_id TEXT NOT NULL,
    orchestration_mode TEXT NOT NULL,
    domain_id UUID,
    selection_reason TEXT,
    
    -- Cache metadata
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    
    -- Ensure unique prompts per tenant
    CONSTRAINT routing_cache_unique UNIQUE (tenant_id, prompt_hash)
);

CREATE INDEX idx_routing_cache_tenant ON routing_decision_cache(tenant_id);
CREATE INDEX idx_routing_cache_expires ON routing_decision_cache(expires_at);
CREATE INDEX idx_routing_cache_embedding ON routing_decision_cache USING ivfflat (prompt_embedding vector_cosine_ops);

-- Enable RLS
ALTER TABLE routing_decision_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY routing_cache_tenant_isolation ON routing_decision_cache
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON TABLE routing_decision_cache IS 'Semantic vector cache for routing decisions to skip brain router LLM calls';

-- ============================================================================
-- 3. Adaptive Storage Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS storage_tier_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_level INTEGER NOT NULL UNIQUE,
    tier_name TEXT NOT NULL,
    
    -- Storage type selection
    storage_type TEXT NOT NULL DEFAULT 'aurora', -- aurora, fargate_postgres, dynamodb
    storage_config JSONB DEFAULT '{}',
    
    -- Cost thresholds
    estimated_monthly_cost_min DECIMAL(10,2),
    estimated_monthly_cost_max DECIMAL(10,2),
    
    -- Admin override
    admin_override BOOLEAN DEFAULT false,
    override_reason TEXT,
    override_by UUID REFERENCES administrators(id),
    override_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default configurations
INSERT INTO storage_tier_config (tier_level, tier_name, storage_type, storage_config, estimated_monthly_cost_min, estimated_monthly_cost_max)
VALUES 
    (1, 'SEED', 'fargate_postgres', '{"cpu": 256, "memory": 512, "storage_gb": 20}', 5, 15),
    (2, 'STARTUP', 'fargate_postgres', '{"cpu": 512, "memory": 1024, "storage_gb": 50}', 20, 50),
    (3, 'GROWTH', 'aurora', '{"min_capacity": 2, "max_capacity": 8}', 100, 300),
    (4, 'SCALE', 'aurora', '{"min_capacity": 4, "max_capacity": 32}', 300, 800),
    (5, 'ENTERPRISE', 'aurora', '{"min_capacity": 8, "max_capacity": 128, "multi_az": true}', 800, 2500)
ON CONFLICT (tier_level) DO NOTHING;

COMMENT ON TABLE storage_tier_config IS 'Configurable storage types per tier - admin can override defaults';

-- ============================================================================
-- 4. Ethics Configuration (Externalized)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ethics_config_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preset_code TEXT NOT NULL UNIQUE,
    preset_name TEXT NOT NULL,
    description TEXT,
    
    -- Configuration
    principles JSONB NOT NULL DEFAULT '[]',
    framework_references JSONB DEFAULT '[]',  -- NIST, ISO, religious texts, etc.
    guardrails JSONB DEFAULT '[]',
    
    -- Preset type
    preset_type TEXT NOT NULL DEFAULT 'secular', -- secular, religious, corporate, legal
    is_default BOOLEAN DEFAULT false,
    is_enabled BOOLEAN DEFAULT true,
    
    -- Admin control
    created_by UUID REFERENCES administrators(id),
    updated_by UUID REFERENCES administrators(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default secular preset (NIST/ISO based)
INSERT INTO ethics_config_presets (preset_code, preset_name, description, preset_type, is_default, principles, framework_references)
VALUES (
    'secular_default',
    'Secular AI Ethics (NIST/ISO)',
    'Default ethics framework based on NIST AI RMF and ISO 42001',
    'secular',
    true,
    '[
        {"code": "beneficence", "name": "Beneficence", "description": "AI should benefit users and society"},
        {"code": "non_maleficence", "name": "Non-Maleficence", "description": "AI should not cause harm"},
        {"code": "autonomy", "name": "Respect for Autonomy", "description": "AI should respect user autonomy and agency"},
        {"code": "justice", "name": "Justice", "description": "AI should be fair and non-discriminatory"},
        {"code": "explicability", "name": "Explicability", "description": "AI decisions should be explainable"},
        {"code": "privacy", "name": "Privacy", "description": "AI should protect user privacy"},
        {"code": "accountability", "name": "Accountability", "description": "Clear accountability for AI actions"}
    ]'::jsonb,
    '[
        {"standard": "NIST AI RMF", "sections": ["1.1", "2.3", "3.1"]},
        {"standard": "ISO 42001", "sections": ["5.2", "6.1", "7.3"]},
        {"standard": "EU AI Act", "sections": ["Article 9", "Article 13"]}
    ]'::jsonb
)
ON CONFLICT (preset_code) DO NOTHING;

-- Christian ethics preset (optional, admin-enableable)
INSERT INTO ethics_config_presets (preset_code, preset_name, description, preset_type, is_enabled, principles, framework_references)
VALUES (
    'christian_ethics',
    'Christian AI Ethics',
    'Ethics framework incorporating Christian principles alongside secular standards',
    'religious',
    false,  -- Disabled by default, admin can enable
    '[
        {"code": "love_neighbor", "name": "Love Your Neighbor", "description": "AI should serve others with compassion"},
        {"code": "truth", "name": "Truth", "description": "AI should be truthful and not deceive"},
        {"code": "stewardship", "name": "Stewardship", "description": "AI should be used responsibly as stewards of creation"},
        {"code": "dignity", "name": "Human Dignity", "description": "AI should respect the inherent dignity of all persons"},
        {"code": "justice", "name": "Justice", "description": "AI should promote justice and fairness"}
    ]'::jsonb,
    '[
        {"source": "Matthew 22:39", "text": "Love your neighbor as yourself"},
        {"source": "John 8:32", "text": "The truth will set you free"},
        {"source": "Genesis 1:28", "text": "Stewardship of creation"},
        {"standard": "NIST AI RMF", "sections": ["1.1", "2.3"]},
        {"standard": "ISO 42001", "sections": ["5.2", "6.1"]}
    ]'::jsonb
)
ON CONFLICT (preset_code) DO NOTHING;

-- Tenant ethics configuration
CREATE TABLE IF NOT EXISTS tenant_ethics_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Selected preset
    preset_id UUID REFERENCES ethics_config_presets(id),
    
    -- Custom overrides
    custom_principles JSONB DEFAULT '[]',
    custom_guardrails JSONB DEFAULT '[]',
    
    -- Settings
    strict_mode BOOLEAN DEFAULT false,
    log_ethics_decisions BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT tenant_ethics_unique UNIQUE (tenant_id)
);

ALTER TABLE tenant_ethics_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_ethics_tenant_isolation ON tenant_ethics_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON TABLE ethics_config_presets IS 'Externalized ethics configurations - admin can enable/disable religious presets';
COMMENT ON TABLE tenant_ethics_config IS 'Per-tenant ethics configuration with preset selection';

-- ============================================================================
-- 5. Pre-Prompt Shadow Testing
-- ============================================================================

CREATE TABLE IF NOT EXISTS preprompt_shadow_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Test configuration
    test_name TEXT NOT NULL,
    baseline_template_id UUID NOT NULL,
    candidate_template_id UUID NOT NULL,
    
    -- Test settings
    test_mode TEXT NOT NULL DEFAULT 'auto', -- auto, manual, scheduled
    traffic_percentage INTEGER DEFAULT 10,  -- % of requests to shadow test
    min_samples INTEGER DEFAULT 100,
    max_samples INTEGER DEFAULT 1000,
    
    -- Test results
    samples_collected INTEGER DEFAULT 0,
    baseline_avg_score DECIMAL(5,3),
    candidate_avg_score DECIMAL(5,3),
    winner TEXT,  -- baseline, candidate, inconclusive
    confidence_level DECIMAL(5,3),
    
    -- Status
    status TEXT DEFAULT 'pending', -- pending, running, completed, promoted, rejected
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    promoted_at TIMESTAMPTZ,
    
    -- Admin control
    created_by UUID REFERENCES administrators(id),
    reviewed_by UUID REFERENCES administrators(id),
    review_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS preprompt_shadow_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES preprompt_shadow_tests(id) ON DELETE CASCADE,
    
    -- Request context
    plan_id UUID,
    prompt_hash TEXT NOT NULL,
    orchestration_mode TEXT,
    model_id TEXT,
    
    -- Results
    baseline_response_quality DECIMAL(5,3),
    candidate_response_quality DECIMAL(5,3),
    baseline_latency_ms INTEGER,
    candidate_latency_ms INTEGER,
    
    -- Comparison
    quality_delta DECIMAL(5,3),  -- candidate - baseline
    user_preferred TEXT,  -- baseline, candidate, null (no feedback)
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shadow_tests_tenant ON preprompt_shadow_tests(tenant_id);
CREATE INDEX idx_shadow_tests_status ON preprompt_shadow_tests(status);
CREATE INDEX idx_shadow_samples_test ON preprompt_shadow_samples(test_id);

ALTER TABLE preprompt_shadow_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE preprompt_shadow_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY shadow_tests_tenant_isolation ON preprompt_shadow_tests
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY shadow_samples_tenant_isolation ON preprompt_shadow_samples
    FOR ALL USING (test_id IN (SELECT id FROM preprompt_shadow_tests WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID));

-- Global admin settings for shadow testing
CREATE TABLE IF NOT EXISTS preprompt_shadow_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Global settings
    default_test_mode TEXT DEFAULT 'auto',  -- auto, manual, off
    auto_promote_threshold DECIMAL(5,3) DEFAULT 0.05,  -- 5% improvement required
    auto_promote_confidence DECIMAL(5,3) DEFAULT 0.95, -- 95% confidence required
    max_concurrent_tests INTEGER DEFAULT 3,
    
    -- Notifications
    notify_on_completion BOOLEAN DEFAULT true,
    notify_on_auto_promote BOOLEAN DEFAULT true,
    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES administrators(id)
);

INSERT INTO preprompt_shadow_settings (id, default_test_mode)
VALUES (gen_random_uuid(), 'auto')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE preprompt_shadow_tests IS 'Shadow A/B tests for pre-prompt optimization';
COMMENT ON TABLE preprompt_shadow_samples IS 'Individual samples from shadow tests';
COMMENT ON TABLE preprompt_shadow_settings IS 'Global settings for pre-prompt shadow testing';

-- ============================================================================
-- 6. Update documentation tracking
-- ============================================================================

-- Track which documentation was updated with this migration
INSERT INTO schema_change_log (migration_name, description, tables_affected)
VALUES (
    '085_platform_improvements',
    'Platform improvements from AI review: delight toggle, semantic caching, adaptive storage, externalized ethics, shadow testing',
    ARRAY[
        'user_delight_preferences',
        'routing_decision_cache',
        'storage_tier_config',
        'ethics_config_presets',
        'tenant_ethics_config',
        'preprompt_shadow_tests',
        'preprompt_shadow_samples',
        'preprompt_shadow_settings'
    ]
)
ON CONFLICT DO NOTHING;
