-- ============================================================================
-- RADIANT Artifact Engine - GenUI Pipeline
-- Migration: 032b_artifact_genui_engine.sql
-- Version: 4.19.0
-- Depends On: 032_canvas_artifacts.sql
-- 
-- This migration creates the core GenUI tables for artifact generation.
-- The artifact_generation_sessions table tracks the full lifecycle of each
-- generation request, while artifact_generation_logs provides real-time
-- progress updates for the streaming UI.
-- ============================================================================

-- ============================================================================
-- ARTIFACT GENERATION SESSIONS
-- Tracks the lifecycle of each artifact generation request
-- Status transitions:
-- pending -> planning -> generating -> streaming -> validating -> [reflexion] -> completed|rejected|failed
-- ============================================================================

CREATE TABLE artifact_generation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
    canvas_id UUID REFERENCES canvases(id) ON DELETE SET NULL,
    
    -- Request
    prompt TEXT NOT NULL,
    intent_classification VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Valid intents: 'calculator', 'chart', 'form', 'dashboard', 
    -- 'game', 'visualization', 'utility', 'custom', 'pending'
    
    -- Planning
    plan JSONB,
    estimated_complexity VARCHAR(20),
    selected_model VARCHAR(100),
    
    -- Generation State
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    -- Status values:
    -- 'pending'    - Request received, not started
    -- 'planning'   - Intent classification in progress
    -- 'generating' - Code generation started (non-streaming)
    -- 'streaming'  - Code streaming to client
    -- 'validating' - Cato CBF validation in progress
    -- 'reflexion'  - Self-correction attempt in progress
    -- 'completed'  - Successfully generated and validated
    -- 'failed'     - Generation error (not validation failure)
    -- 'rejected'   - Failed Cato validation after max reflexion attempts
    
    -- Streaming Progress
    tokens_generated INTEGER DEFAULT 0,
    stream_chunks_sent INTEGER DEFAULT 0,
    
    -- Validation
    cato_validation_result JSONB,
    reflexion_attempts INTEGER DEFAULT 0,
    max_reflexion_attempts INTEGER DEFAULT 3,
    
    -- Output
    artifact_id UUID,
    final_code TEXT,
    verification_status VARCHAR(20) DEFAULT 'unverified',
    -- 'unverified' (in progress), 'validated' (passed CBFs), 'rejected' (failed CBFs)
    
    -- Cost Tracking
    total_tokens_used INTEGER DEFAULT 0,
    estimated_cost DECIMAL(10, 6) DEFAULT 0,
    
    -- Timing
    planning_started_at TIMESTAMPTZ,
    generation_started_at TIMESTAMPTZ,
    validation_started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ARTIFACT GENERATION LOGS
-- Stream of thoughts/progress for real-time UI updates
-- ============================================================================

CREATE TABLE artifact_generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES artifact_generation_sessions(id) ON DELETE CASCADE,
    
    log_type VARCHAR(30) NOT NULL,
    -- Log types for UI rendering:
    -- 'thinking'        - Blue text, shows AI reasoning
    -- 'planning'        - White text, shows plan steps
    -- 'generating'      - White text, shows generation progress
    -- 'streaming_chunk' - Hidden, internal tracking only
    -- 'validating'      - White text, shows validation progress
    -- 'reflexion'       - Yellow text, shows self-correction
    -- 'error'           - Red text, shows errors
    -- 'success'         - Green text, shows completion
    
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ARTIFACT CODE PATTERNS
-- Semantic memory of successful code patterns
-- ============================================================================

CREATE TABLE artifact_code_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- NULL tenant_id = global/system patterns available to all
    
    pattern_name VARCHAR(200) NOT NULL,
    pattern_type VARCHAR(50) NOT NULL,
    -- Types match intent_classification values
    
    description TEXT,
    template_code TEXT NOT NULL,
    dependencies JSONB DEFAULT '[]',
    
    -- Semantic embedding for similarity search (1536 dimensions)
    embedding vector(1536),
    
    -- Quality metrics
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5, 4) DEFAULT 1.0,
    average_generation_time_ms INTEGER,
    
    scope VARCHAR(20) DEFAULT 'system',
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ARTIFACT DEPENDENCY ALLOWLIST
-- Security: Only these npm packages can be used in generated artifacts
-- ============================================================================

CREATE TABLE artifact_dependency_allowlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- NULL tenant_id = global allowlist (applies to all tenants)
    
    package_name VARCHAR(200) NOT NULL,
    package_version VARCHAR(50),
    
    reason TEXT,
    security_reviewed BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id),
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, package_name)
);

-- ============================================================================
-- ARTIFACT VALIDATION RULES
-- Cato CBFs (Control Barrier Functions) for code generation
-- ============================================================================

CREATE TABLE artifact_validation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    rule_name VARCHAR(100) NOT NULL UNIQUE,
    rule_type VARCHAR(50) NOT NULL,
    -- Rule types:
    -- 'injection_prevention' - Blocks code injection vectors (eval, Function)
    -- 'api_restriction'      - Blocks dangerous browser APIs
    -- 'resource_limit'       - Enforces size/complexity limits
    -- 'dependency_check'     - Validates imports against allowlist
    -- 'content_policy'       - Content-based restrictions
    
    description TEXT,
    validation_pattern TEXT,
    validation_function VARCHAR(100),
    
    severity VARCHAR(20) NOT NULL DEFAULT 'block',
    error_message TEXT,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_artifact_gen_sessions_tenant ON artifact_generation_sessions(tenant_id);
CREATE INDEX idx_artifact_gen_sessions_user ON artifact_generation_sessions(user_id);
CREATE INDEX idx_artifact_gen_sessions_status ON artifact_generation_sessions(status);
CREATE INDEX idx_artifact_gen_sessions_chat ON artifact_generation_sessions(chat_id);
CREATE INDEX idx_artifact_gen_sessions_created ON artifact_generation_sessions(created_at DESC);

CREATE INDEX idx_artifact_gen_logs_session ON artifact_generation_logs(session_id);
CREATE INDEX idx_artifact_gen_logs_created ON artifact_generation_logs(created_at DESC);

CREATE INDEX idx_artifact_patterns_type ON artifact_code_patterns(pattern_type);
CREATE INDEX idx_artifact_patterns_embedding ON artifact_code_patterns 
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_artifact_dep_allowlist_package ON artifact_dependency_allowlist(package_name);
CREATE INDEX idx_artifact_dep_allowlist_tenant ON artifact_dependency_allowlist(tenant_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE artifact_generation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_code_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_dependency_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_validation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY artifact_gen_sessions_isolation ON artifact_generation_sessions
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY artifact_gen_logs_isolation ON artifact_generation_logs
    USING (session_id IN (
        SELECT id FROM artifact_generation_sessions 
        WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
    ));

CREATE POLICY artifact_patterns_isolation ON artifact_code_patterns
    USING (scope = 'system' OR tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY artifact_dep_allowlist_isolation ON artifact_dependency_allowlist
    USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY artifact_validation_rules_read ON artifact_validation_rules
    FOR SELECT USING (TRUE);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_artifact_gen_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER artifact_gen_sessions_updated
    BEFORE UPDATE ON artifact_generation_sessions
    FOR EACH ROW EXECUTE FUNCTION update_artifact_gen_session_timestamp();
