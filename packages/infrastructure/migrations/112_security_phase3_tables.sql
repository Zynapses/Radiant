-- RADIANT v4.18.0 - Security Phase 3 Tables
-- Migration 112: Hallucination Detection, AutoDAN, Benchmarks, Prompt Injection
-- ============================================================================

-- ============================================================================
-- HALLUCINATION DETECTION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS hallucination_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Input hashes
    prompt_hash VARCHAR(64) NOT NULL,
    response_hash VARCHAR(64) NOT NULL,
    
    -- Results
    is_hallucinated BOOLEAN NOT NULL,
    score DOUBLE PRECISION NOT NULL,
    check_type VARCHAR(50), -- 'comprehensive', 'single', 'disabled'
    
    -- Details
    details JSONB DEFAULT '{}',
    -- {selfConsistencyScore, groundingScore, truthfulQAScore, claimVerificationResults}
    
    -- Metadata
    model_id VARCHAR(255),
    latency_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hallucination config stored in security_protection_config
ALTER TABLE security_protection_config ADD COLUMN IF NOT EXISTS
    hallucination_config JSONB DEFAULT '{
        "enabled": false,
        "selfCheckEnabled": true,
        "selfCheckSamples": 3,
        "selfCheckThreshold": 0.7,
        "groundingEnabled": true,
        "groundingThreshold": 0.6,
        "claimExtractionEnabled": false,
        "truthfulQAEnabled": false
    }';

-- ============================================================================
-- AUTODAN EVOLUTION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS autodan_evolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Target
    target_behavior TEXT NOT NULL,
    
    -- Results
    best_prompt TEXT NOT NULL,
    best_fitness DOUBLE PRECISION NOT NULL,
    generations_run INTEGER NOT NULL,
    successful_attacks INTEGER DEFAULT 0,
    
    -- Configuration used
    config JSONB DEFAULT '{}',
    
    -- Population snapshot (optional, for analysis)
    final_population JSONB,
    fitness_history DOUBLE PRECISION[],
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autodan_individuals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evolution_id UUID NOT NULL REFERENCES autodan_evolutions(id) ON DELETE CASCADE,
    
    -- Individual data
    prompt TEXT NOT NULL,
    fitness DOUBLE PRECISION NOT NULL,
    generation INTEGER NOT NULL,
    
    -- Lineage
    parent_ids UUID[],
    mutations TEXT[],
    
    -- Evaluation
    was_successful BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- QUALITY BENCHMARK TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS quality_benchmark_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Benchmark info
    model_id VARCHAR(255) NOT NULL,
    benchmark_name VARCHAR(100) NOT NULL, -- 'truthfulqa', 'factual', 'selfcheck', 'hallucination'
    
    -- Results
    score DOUBLE PRECISION NOT NULL,
    details JSONB DEFAULT '{}',
    
    -- Metadata
    duration_ms INTEGER,
    sample_count INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS benchmark_degradation_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Alert info
    model_id VARCHAR(255) NOT NULL,
    benchmark_name VARCHAR(100) NOT NULL,
    
    -- Scores
    previous_score DOUBLE PRECISION NOT NULL,
    current_score DOUBLE PRECISION NOT NULL,
    degradation_percent DOUBLE PRECISION NOT NULL,
    
    -- Status
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PROMPT INJECTION DETECTION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompt_injection_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Pattern info
    pattern_name VARCHAR(255) NOT NULL,
    pattern_type VARCHAR(100) NOT NULL, -- 'direct', 'indirect', 'context_ignoring', 'role_escape', 'encoding'
    
    -- Detection
    regex_pattern TEXT,
    keyword_patterns TEXT[],
    semantic_signature VECTOR(1536),
    
    -- Metadata
    severity INTEGER DEFAULT 5, -- 1-10
    description TEXT,
    examples TEXT[],
    false_positive_rate DOUBLE PRECISION,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    source VARCHAR(100), -- 'owasp', 'custom', 'research'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prompt_injection_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Detection
    input_hash VARCHAR(64) NOT NULL,
    pattern_id UUID REFERENCES prompt_injection_patterns(id),
    
    -- Results
    injection_detected BOOLEAN NOT NULL,
    confidence_score DOUBLE PRECISION NOT NULL,
    injection_type VARCHAR(100),
    matched_patterns TEXT[],
    
    -- Action taken
    action_taken VARCHAR(50), -- 'allowed', 'blocked', 'flagged', 'sanitized'
    
    -- Metadata
    model_id VARCHAR(255),
    user_id UUID,
    request_id UUID,
    latency_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed OWASP LLM01 injection patterns
INSERT INTO prompt_injection_patterns (pattern_name, pattern_type, regex_pattern, severity, description, source) VALUES
    ('Ignore Instructions', 'direct', '(?i)\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|guidelines?)', 9, 'Direct instruction to ignore system prompt', 'owasp'),
    ('System Prompt Override', 'direct', '(?i)(new\s+)?system\s+(prompt|instruction|message):\s*', 9, 'Attempt to inject new system prompt', 'owasp'),
    ('Role Escape', 'role_escape', '(?i)\b(you\s+are\s+now|act\s+as|pretend\s+(to\s+be|you\s+are)|roleplay\s+as)\b', 6, 'Attempt to change AI role/persona', 'owasp'),
    ('Developer Mode', 'context_ignoring', '(?i)\b(developer|dev|debug|admin|root|sudo)\s*mode\b', 8, 'Attempt to enable privileged mode', 'owasp'),
    ('DAN Jailbreak', 'context_ignoring', '(?i)\b(DAN|do\s+anything\s+now|jailbreak(ed)?|unlocked\s+mode)\b', 9, 'DAN-style jailbreak attempt', 'research'),
    ('Base64 Payload', 'encoding', '[A-Za-z0-9+/]{100,}={0,2}', 7, 'Potential base64-encoded payload', 'owasp'),
    ('Unicode Smuggling', 'encoding', '[\u200B-\u200F\u2028-\u202F\uFEFF]', 6, 'Invisible unicode characters for smuggling', 'owasp'),
    ('System Prompt Extract', 'indirect', '(?i)\b(repeat|show|reveal|tell\s+me|what\s+(is|are))\s+(your|the)?\s*(system|initial|original|full)\s*(prompt|instructions?|rules?)', 8, 'Attempt to extract system prompt', 'owasp'),
    ('Context Window Exploit', 'indirect', '(?i)(end\s+of\s+(context|prompt|system)|</?(system|prompt|context)>)', 7, 'Attempt to manipulate context boundaries', 'research'),
    ('Indirect Injection', 'indirect', '(?i)(when\s+you\s+see\s+this|if\s+reading\s+this|ai\s+assistant:\s*)', 6, 'Indirect injection markers', 'owasp')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- EMBEDDING SERVICE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS embedding_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Request
    text_hash VARCHAR(64) NOT NULL,
    text_length INTEGER NOT NULL,
    model VARCHAR(100) NOT NULL, -- 'text-embedding-3-small', 'titan-embed-text-v2', etc.
    
    -- Response
    embedding VECTOR(1536),
    dimensions INTEGER,
    
    -- Metadata
    latency_ms INTEGER,
    tokens_used INTEGER,
    cached BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_hallucination_checks_tenant ON hallucination_checks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hallucination_checks_model ON hallucination_checks(model_id);
CREATE INDEX IF NOT EXISTS idx_hallucination_checks_created ON hallucination_checks(created_at);

CREATE INDEX IF NOT EXISTS idx_autodan_evolutions_tenant ON autodan_evolutions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_autodan_evolutions_target ON autodan_evolutions(target_behavior);
CREATE INDEX IF NOT EXISTS idx_autodan_individuals_evolution ON autodan_individuals(evolution_id);

CREATE INDEX IF NOT EXISTS idx_benchmark_results_tenant ON quality_benchmark_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_model ON quality_benchmark_results(model_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_name ON quality_benchmark_results(benchmark_name);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_created ON quality_benchmark_results(created_at);

CREATE INDEX IF NOT EXISTS idx_injection_patterns_type ON prompt_injection_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_injection_patterns_active ON prompt_injection_patterns(is_active);
CREATE INDEX IF NOT EXISTS idx_injection_detections_tenant ON prompt_injection_detections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_injection_detections_created ON prompt_injection_detections(created_at);

CREATE INDEX IF NOT EXISTS idx_embedding_requests_tenant ON embedding_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_embedding_requests_hash ON embedding_requests(text_hash);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE hallucination_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE autodan_evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE autodan_individuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_benchmark_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_degradation_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_injection_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE embedding_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY hallucination_checks_tenant_isolation ON hallucination_checks
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY autodan_evolutions_tenant_isolation ON autodan_evolutions
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY autodan_individuals_tenant_isolation ON autodan_individuals
    USING (evolution_id IN (SELECT id FROM autodan_evolutions WHERE tenant_id = current_setting('app.current_tenant_id')::uuid));
CREATE POLICY benchmark_results_tenant_isolation ON quality_benchmark_results
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY benchmark_alerts_tenant_isolation ON benchmark_degradation_alerts
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY injection_detections_tenant_isolation ON prompt_injection_detections
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY embedding_requests_tenant_isolation ON embedding_requests
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Injection patterns are global (no tenant isolation)
CREATE POLICY injection_patterns_read_all ON prompt_injection_patterns FOR SELECT USING (true);
