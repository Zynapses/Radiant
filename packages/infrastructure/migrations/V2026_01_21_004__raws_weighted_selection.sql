-- =====================================================
-- RAWS v1.1 - RADIANT AI Weighted Selection System
-- Migration: Core schema, 9 weight profiles, 4 domains
-- =====================================================

-- Enums
CREATE TYPE raws_profile_category AS ENUM ('optimization', 'domain', 'sofai');
CREATE TYPE raws_system_type AS ENUM ('SYSTEM_1', 'SYSTEM_2');
CREATE TYPE raws_domain AS ENUM ('healthcare', 'financial', 'legal', 'scientific', 'creative', 'engineering', 'general');
CREATE TYPE raws_thermal_state AS ENUM ('HOT', 'WARM', 'COLD', 'OFF');
CREATE TYPE raws_model_status AS ENUM ('active', 'deprecated', 'disabled');

-- =====================================================
-- Providers Table
-- =====================================================
CREATE TABLE raws_providers (
    id VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    api_base_url VARCHAR(500),
    auth_type VARCHAR(50) DEFAULT 'api_key',
    
    -- Health tracking
    is_healthy BOOLEAN DEFAULT true,
    last_health_check TIMESTAMPTZ,
    error_rate_1h NUMERIC(6, 4) DEFAULT 0,
    avg_latency_ms INTEGER,
    
    -- Compliance
    hipaa_eligible BOOLEAN DEFAULT false,
    soc2_certified BOOLEAN DEFAULT false,
    gdpr_compliant BOOLEAN DEFAULT false,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Weight Profiles Table (9 profiles)
-- =====================================================
CREATE TABLE raws_weight_profiles (
    id VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    category raws_profile_category NOT NULL,
    
    -- Eight dimension weights (must sum to 1.0)
    weight_quality NUMERIC(4, 3) NOT NULL DEFAULT 0.250,
    weight_cost NUMERIC(4, 3) NOT NULL DEFAULT 0.200,
    weight_latency NUMERIC(4, 3) NOT NULL DEFAULT 0.150,
    weight_capability NUMERIC(4, 3) NOT NULL DEFAULT 0.150,
    weight_reliability NUMERIC(4, 3) NOT NULL DEFAULT 0.100,
    weight_compliance NUMERIC(4, 3) NOT NULL DEFAULT 0.050,
    weight_availability NUMERIC(4, 3) NOT NULL DEFAULT 0.050,
    weight_learning NUMERIC(4, 3) NOT NULL DEFAULT 0.050,
    
    -- Constraints
    min_quality_score NUMERIC(5, 2),
    max_price_multiplier NUMERIC(4, 2),
    max_latency_ms INTEGER,
    required_capabilities TEXT[],
    preferred_capabilities TEXT[],
    required_compliance TEXT[],
    forced_system_type raws_system_type,
    
    -- Domain association
    domain raws_domain,
    
    -- Truth Engine integration
    require_truth_engine BOOLEAN DEFAULT false,
    require_source_citation BOOLEAN DEFAULT false,
    max_ecd_threshold NUMERIC(4, 3),
    
    -- Flags
    is_system_profile BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    
    -- Multi-tenancy
    tenant_id UUID,
    created_by UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT weights_sum_to_one CHECK (
        ABS(weight_quality + weight_cost + weight_latency + weight_capability + 
            weight_reliability + weight_compliance + weight_availability + weight_learning - 1.0) < 0.01
    )
);

CREATE INDEX idx_raws_profiles_category ON raws_weight_profiles(category);
CREATE INDEX idx_raws_profiles_domain ON raws_weight_profiles(domain);
CREATE INDEX idx_raws_profiles_tenant ON raws_weight_profiles(tenant_id);

-- =====================================================
-- Domain Configuration Table
-- =====================================================
CREATE TABLE raws_domain_config (
    id raws_domain PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Weight profile reference
    weight_profile_id VARCHAR(50) REFERENCES raws_weight_profiles(id),
    
    -- Constraints
    min_quality_score NUMERIC(5, 2),
    max_ecd_threshold NUMERIC(4, 3),
    required_compliance TEXT[],
    forced_system_type raws_system_type,
    
    -- Verification requirements
    require_truth_engine BOOLEAN DEFAULT false,
    require_source_citation BOOLEAN DEFAULT false,
    
    -- Model preferences
    preferred_models TEXT[],
    excluded_models TEXT[],
    preferred_capabilities TEXT[],
    
    -- Detection configuration
    detection_keywords TEXT[],
    detection_confidence_threshold NUMERIC(3, 2) DEFAULT 0.70,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- External Models Table
-- =====================================================
CREATE TABLE raws_external_models (
    id VARCHAR(100) PRIMARY KEY,
    provider_id VARCHAR(50) NOT NULL REFERENCES raws_providers(id),
    display_name VARCHAR(255) NOT NULL,
    model_family VARCHAR(100),
    
    -- Capabilities
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    context_window INTEGER NOT NULL,
    max_output_tokens INTEGER NOT NULL,
    supports_streaming BOOLEAN DEFAULT true,
    supports_function_calling BOOLEAN DEFAULT false,
    supports_vision BOOLEAN DEFAULT false,
    supports_reasoning BOOLEAN DEFAULT false,
    
    -- Provider pricing (cost to us)
    input_cost_per_1k_tokens NUMERIC(10, 6) NOT NULL,
    output_cost_per_1k_tokens NUMERIC(10, 6) NOT NULL,
    
    -- Customer pricing
    markup_percent NUMERIC(5, 2) DEFAULT 40.00,
    
    -- Quality score (0-100)
    quality_score NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
    
    -- Benchmarks (stored for reference)
    benchmarks JSONB DEFAULT '{}',
    
    -- Latency metrics
    avg_ttft_ms INTEGER,
    avg_tps NUMERIC(6, 2),
    
    -- Reliability metrics
    uptime_percent_30d NUMERIC(5, 2) DEFAULT 99.90,
    error_rate_7d NUMERIC(6, 4) DEFAULT 0.0001,
    
    -- Compliance (for binary matching)
    compliance_certifications TEXT[] DEFAULT '{}',
    
    -- Status
    status raws_model_status DEFAULT 'active',
    deprecated BOOLEAN DEFAULT false,
    deprecation_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_raws_models_provider ON raws_external_models(provider_id);
CREATE INDEX idx_raws_models_status ON raws_external_models(status);
CREATE INDEX idx_raws_models_quality ON raws_external_models(quality_score DESC);

-- =====================================================
-- Self-Hosted Models Table
-- =====================================================
CREATE TABLE raws_self_hosted_models (
    id VARCHAR(100) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    model_family VARCHAR(100),
    
    -- Deployment
    sagemaker_endpoint VARCHAR(255),
    instance_type VARCHAR(50),
    
    -- Capabilities
    capabilities TEXT[] NOT NULL DEFAULT '{}',
    context_window INTEGER NOT NULL,
    max_output_tokens INTEGER NOT NULL,
    
    -- Pricing (internal cost)
    cost_per_hour NUMERIC(10, 4),
    markup_percent NUMERIC(5, 2) DEFAULT 75.00,
    
    -- Quality
    quality_score NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
    
    -- Thermal state
    thermal_state raws_thermal_state DEFAULT 'COLD',
    min_instances INTEGER DEFAULT 0,
    max_instances INTEGER DEFAULT 1,
    cold_start_ms INTEGER DEFAULT 60000,
    
    -- Status
    status raws_model_status DEFAULT 'active',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Selection Audit Log (tiered retention)
-- =====================================================
CREATE TABLE raws_selection_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    session_id UUID,
    
    -- Request context
    request_id UUID NOT NULL,
    domain raws_domain,
    domain_confidence NUMERIC(3, 2),
    weight_profile_id VARCHAR(50),
    system_type raws_system_type,
    
    -- Selection result
    selected_model_id VARCHAR(100) NOT NULL,
    fallback_models TEXT[],
    composite_score NUMERIC(6, 3),
    
    -- Individual scores
    score_quality NUMERIC(5, 2),
    score_cost NUMERIC(5, 2),
    score_latency NUMERIC(5, 2),
    score_capability NUMERIC(5, 2),
    score_reliability NUMERIC(5, 2),
    score_compliance NUMERIC(5, 2),
    score_availability NUMERIC(5, 2),
    score_learning NUMERIC(5, 2),
    
    -- Performance
    selection_latency_ms INTEGER,
    
    -- Compliance flag (for extended retention)
    requires_compliance_retention BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_raws_audit_tenant ON raws_selection_audit(tenant_id);
CREATE INDEX idx_raws_audit_created ON raws_selection_audit(created_at);
CREATE INDEX idx_raws_audit_model ON raws_selection_audit(selected_model_id);

-- Partitioning for efficient retention management
-- Full audit: 90 days, Compliance: 6 years

-- =====================================================
-- Model Performance Tracking (for Learning score)
-- =====================================================
CREATE TABLE raws_model_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    model_id VARCHAR(100) NOT NULL,
    
    -- Aggregated metrics (rolling 30 days)
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    avg_user_rating NUMERIC(3, 2),
    rating_count INTEGER DEFAULT 0,
    avg_ecd_score NUMERIC(4, 3),
    
    -- Performance
    avg_latency_ms INTEGER,
    p95_latency_ms INTEGER,
    
    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, model_id, period_start)
);

CREATE INDEX idx_raws_perf_tenant_model ON raws_model_performance(tenant_id, model_id);

-- =====================================================
-- Provider Health Tracking
-- =====================================================
CREATE TABLE raws_provider_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id VARCHAR(50) NOT NULL REFERENCES raws_providers(id),
    
    -- Health metrics
    is_healthy BOOLEAN DEFAULT true,
    error_count_1h INTEGER DEFAULT 0,
    success_count_1h INTEGER DEFAULT 0,
    avg_latency_1h_ms INTEGER,
    
    -- Rate limiting
    rate_limit_hits_1h INTEGER DEFAULT 0,
    
    -- Timestamp
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_raws_health_provider ON raws_provider_health(provider_id, checked_at DESC);

-- =====================================================
-- Seed: 9 Weight Profiles
-- =====================================================

-- Optimization Profiles (4)
INSERT INTO raws_weight_profiles (
    id, display_name, description, category,
    weight_quality, weight_cost, weight_latency, weight_capability,
    weight_reliability, weight_compliance, weight_availability, weight_learning,
    is_system_profile, is_default
) VALUES
('BALANCED', 'Balanced', 'Default balanced profile for general use', 'optimization',
 0.250, 0.200, 0.150, 0.150, 0.100, 0.050, 0.050, 0.050, true, true),

('QUALITY_FIRST', 'Quality First', 'Maximum quality, cost secondary', 'optimization',
 0.400, 0.100, 0.100, 0.150, 0.100, 0.050, 0.050, 0.050, true, false),

('COST_OPTIMIZED', 'Cost Optimized', 'Minimize cost while meeting quality threshold', 'optimization',
 0.200, 0.350, 0.150, 0.100, 0.050, 0.050, 0.050, 0.050, true, false),

('LATENCY_CRITICAL', 'Latency Critical', 'Fastest response time priority', 'optimization',
 0.150, 0.100, 0.350, 0.150, 0.100, 0.050, 0.050, 0.050, true, false);

-- Domain Profiles (6)
INSERT INTO raws_weight_profiles (
    id, display_name, description, category,
    weight_quality, weight_cost, weight_latency, weight_capability,
    weight_reliability, weight_compliance, weight_availability, weight_learning,
    domain, min_quality_score, required_compliance, forced_system_type,
    require_truth_engine, require_source_citation, max_ecd_threshold, is_system_profile
) VALUES
('HEALTHCARE', 'Healthcare', 'Medical accuracy and HIPAA compliance mandatory', 'domain',
 0.300, 0.050, 0.100, 0.150, 0.100, 0.200, 0.050, 0.050,
 'healthcare', 80.00, ARRAY['HIPAA'], 'SYSTEM_2', true, false, 0.050, true),

('FINANCIAL', 'Financial', 'Financial accuracy and SOC2 audit trails', 'domain',
 0.300, 0.100, 0.100, 0.150, 0.100, 0.150, 0.050, 0.050,
 'financial', 75.00, ARRAY['SOC2'], 'SYSTEM_2', true, false, 0.050, true),

('LEGAL', 'Legal', 'Citation accuracy and source verification required', 'domain',
 0.350, 0.050, 0.050, 0.200, 0.100, 0.150, 0.050, 0.050,
 'legal', 80.00, ARRAY['SOC2'], 'SYSTEM_2', true, true, 0.050, true),

('SCIENTIFIC', 'Scientific', 'Research accuracy paramount, source citation required', 'domain',
 0.350, 0.100, 0.100, 0.200, 0.080, 0.050, 0.050, 0.070,
 'scientific', 70.00, NULL, NULL, false, true, 0.080, true),

('CREATIVE', 'Creative', 'Subjective quality, fast iteration, cost matters', 'domain',
 0.200, 0.250, 0.200, 0.150, 0.050, 0.000, 0.050, 0.100,
 'creative', NULL, NULL, NULL, false, false, 0.200, true),

('ENGINEERING', 'Engineering', 'Code correctness critical, tool use capability important', 'domain',
 0.300, 0.150, 0.150, 0.200, 0.100, 0.000, 0.050, 0.050,
 'engineering', 70.00, NULL, NULL, false, false, 0.100, true);

-- SOFAI Profiles (3)
INSERT INTO raws_weight_profiles (
    id, display_name, description, category,
    weight_quality, weight_cost, weight_latency, weight_capability,
    weight_reliability, weight_compliance, weight_availability, weight_learning,
    is_system_profile
) VALUES
('SYSTEM_1', 'System 1 (Fast)', 'Fast, intuitive responses for simple tasks', 'sofai',
 0.150, 0.300, 0.300, 0.100, 0.050, 0.000, 0.050, 0.050, true),

('SYSTEM_2', 'System 2 (Deep)', 'Deliberate, accurate responses for complex tasks', 'sofai',
 0.350, 0.100, 0.100, 0.150, 0.100, 0.100, 0.050, 0.050, true),

('SYSTEM_2_5', 'System 2.5 (Maximum)', 'Maximum reasoning for critical decisions', 'sofai',
 0.400, 0.050, 0.050, 0.200, 0.100, 0.100, 0.050, 0.050, true);

-- =====================================================
-- Seed: 7 Domain Configurations
-- =====================================================
INSERT INTO raws_domain_config (
    id, display_name, description, weight_profile_id,
    min_quality_score, max_ecd_threshold, required_compliance, forced_system_type,
    require_truth_engine, require_source_citation, detection_keywords, detection_confidence_threshold
) VALUES
('healthcare', 'Healthcare', 'Medical, clinical, and health-related queries',
 'HEALTHCARE', 80.00, 0.050, ARRAY['HIPAA'], 'SYSTEM_2', true, false,
 ARRAY['medical', 'diagnosis', 'treatment', 'patient', 'clinical', 'health', 'disease', 
       'symptoms', 'medication', 'prescription', 'doctor', 'hospital', 'nurse', 
       'pharmacy', 'surgical', 'therapy', 'vaccine', 'illness', 'prognosis'],
 0.70),

('financial', 'Financial', 'Finance, investment, accounting, and banking queries',
 'FINANCIAL', 75.00, 0.050, ARRAY['SOC2'], 'SYSTEM_2', true, false,
 ARRAY['investment', 'stock', 'trading', 'portfolio', 'tax', 'accounting', 'budget', 
       'financial', 'revenue', 'profit', 'banking', 'audit', 'compliance', 'loan', 
       'mortgage', 'insurance', 'dividend', 'equity', 'securities'],
 0.70),

('legal', 'Legal', 'Legal advice, contracts, litigation, and regulatory queries',
 'LEGAL', 80.00, 0.050, ARRAY['SOC2'], 'SYSTEM_2', true, true,
 ARRAY['legal', 'contract', 'lawsuit', 'litigation', 'attorney', 'court', 'law', 
       'compliance', 'regulation', 'statute', 'liability', 'tort', 'plaintiff', 
       'defendant', 'jurisdiction', 'verdict', 'settlement', 'counsel'],
 0.70),

('scientific', 'Scientific', 'Research, academic, and technical analysis queries',
 'SCIENTIFIC', 70.00, 0.080, NULL, NULL, false, true,
 ARRAY['research', 'experiment', 'hypothesis', 'scientific', 'study', 'methodology', 
       'peer review', 'data analysis', 'thesis', 'academic', 'laboratory', 'journal',
       'citation', 'theory', 'empirical'],
 0.70),

('creative', 'Creative', 'Content writing, storytelling, and creative generation',
 'CREATIVE', NULL, 0.200, NULL, NULL, false, false,
 ARRAY['write', 'story', 'creative', 'fiction', 'poem', 'script', 'novel', 'brainstorm', 
       'content', 'marketing', 'blog', 'narrative', 'character', 'plot', 'dialogue'],
 0.70),

('engineering', 'Engineering', 'Code generation, software development, and DevOps',
 'ENGINEERING', 70.00, 0.100, NULL, NULL, false, false,
 ARRAY['code', 'programming', 'debug', 'software', 'api', 'architecture', 'devops', 
       'deploy', 'git', 'database', 'backend', 'frontend', 'algorithm', 'refactor',
       'function', 'class', 'module', 'test'],
 0.70),

('general', 'General', 'General purpose queries without specific domain requirements',
 'BALANCED', NULL, 0.100, NULL, NULL, false, false, NULL, 0.50);

-- =====================================================
-- Seed: Providers
-- =====================================================
INSERT INTO raws_providers (id, display_name, api_base_url, hipaa_eligible, soc2_certified, gdpr_compliant) VALUES
('openai', 'OpenAI', 'https://api.openai.com/v1', true, true, true),
('anthropic', 'Anthropic', 'https://api.anthropic.com/v1', true, true, true),
('google', 'Google AI', 'https://generativelanguage.googleapis.com/v1', false, true, true),
('xai', 'xAI', 'https://api.x.ai/v1', false, false, false),
('deepseek', 'DeepSeek', 'https://api.deepseek.com/v1', false, false, false),
('mistral', 'Mistral AI', 'https://api.mistral.ai/v1', false, true, true),
('cohere', 'Cohere', 'https://api.cohere.ai/v1', false, true, true);

-- =====================================================
-- Seed: External Models (key models only)
-- =====================================================
INSERT INTO raws_external_models (
    id, provider_id, display_name, model_family,
    capabilities, context_window, max_output_tokens,
    supports_function_calling, supports_vision, supports_reasoning,
    input_cost_per_1k_tokens, output_cost_per_1k_tokens,
    quality_score, compliance_certifications
) VALUES
-- OpenAI
('gpt-4o', 'openai', 'GPT-4o', 'gpt-4',
 ARRAY['chat', 'vision', 'tools'], 128000, 16384, true, true, false,
 0.0025, 0.0100, 79.2, ARRAY['SOC2', 'HIPAA', 'GDPR']),

('gpt-4o-mini', 'openai', 'GPT-4o Mini', 'gpt-4',
 ARRAY['chat', 'vision', 'tools'], 128000, 16384, true, true, false,
 0.00015, 0.0006, 72.0, ARRAY['SOC2', 'HIPAA', 'GDPR']),

('o3-mini', 'openai', 'o3-mini', 'o3',
 ARRAY['chat', 'reasoning'], 200000, 100000, false, false, true,
 0.0011, 0.0044, 80.5, ARRAY['SOC2', 'HIPAA', 'GDPR']),

-- Anthropic
('claude-sonnet-4', 'anthropic', 'Claude Sonnet 4', 'claude-4',
 ARRAY['chat', 'vision', 'tools'], 200000, 64000, true, true, false,
 0.0030, 0.0150, 83.4, ARRAY['SOC2', 'HIPAA', 'GDPR']),

('claude-3-5-haiku', 'anthropic', 'Claude 3.5 Haiku', 'claude-3.5',
 ARRAY['chat', 'tools'], 200000, 8192, true, false, false,
 0.0008, 0.0040, 68.0, ARRAY['SOC2', 'HIPAA', 'GDPR']),

-- Google
('gemini-2.5-pro', 'google', 'Gemini 2.5 Pro', 'gemini-2.5',
 ARRAY['chat', 'vision', 'audio', 'video', 'tools'], 1000000, 65536, true, true, false,
 0.00125, 0.0050, 82.3, ARRAY['SOC2', 'GDPR']),

('gemini-2.5-flash', 'google', 'Gemini 2.5 Flash', 'gemini-2.5',
 ARRAY['chat', 'vision', 'audio', 'tools'], 1000000, 65536, true, true, false,
 0.000125, 0.0005, 75.0, ARRAY['SOC2', 'GDPR']),

-- DeepSeek
('deepseek-v3', 'deepseek', 'DeepSeek V3', 'deepseek',
 ARRAY['chat', 'tools'], 64000, 8192, true, false, false,
 0.00027, 0.0011, 73.3, ARRAY[]),

('deepseek-r1', 'deepseek', 'DeepSeek R1', 'deepseek',
 ARRAY['chat', 'reasoning'], 64000, 8192, false, false, true,
 0.00055, 0.0022, 75.9, ARRAY[]),

-- Mistral
('mistral-large-2', 'mistral', 'Mistral Large 2', 'mistral',
 ARRAY['chat', 'tools'], 128000, 8192, true, false, false,
 0.0020, 0.0060, 76.5, ARRAY['SOC2', 'GDPR']);

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE raws_selection_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE raws_model_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY raws_audit_tenant_isolation ON raws_selection_audit
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY raws_perf_tenant_isolation ON raws_model_performance
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- Cleanup job for tiered retention
-- =====================================================
CREATE OR REPLACE FUNCTION raws_cleanup_audit_logs()
RETURNS void AS $$
BEGIN
    -- Delete non-compliance logs older than 90 days
    DELETE FROM raws_selection_audit
    WHERE requires_compliance_retention = false
      AND created_at < NOW() - INTERVAL '90 days';
    
    -- Delete compliance logs older than 6 years
    DELETE FROM raws_selection_audit
    WHERE requires_compliance_retention = true
      AND created_at < NOW() - INTERVAL '6 years';
END;
$$ LANGUAGE plpgsql;
