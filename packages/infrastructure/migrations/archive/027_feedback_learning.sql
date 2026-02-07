-- RADIANT v4.17.0 - Migration 027: Feedback Learning System
-- Execution manifests and feedback tracking for neural learning

CREATE TABLE execution_manifests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    output_id VARCHAR(100) UNIQUE NOT NULL,
    
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    conversation_id UUID,
    message_id UUID,
    
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('chat', 'completion', 'orchestration', 'service')),
    task_type VARCHAR(50),
    domain_mode VARCHAR(50),
    input_prompt_hash VARCHAR(64),
    input_tokens INTEGER,
    input_language VARCHAR(10),
    
    models_used TEXT[] NOT NULL DEFAULT '{}',
    model_versions JSONB DEFAULT '{}',
    orchestration_id UUID,
    orchestration_name VARCHAR(100),
    services_used TEXT[],
    thermal_states_at_execution JSONB DEFAULT '{}',
    provider_health_at_execution JSONB DEFAULT '{}',
    
    brain_reasoning TEXT,
    brain_confidence DECIMAL(3, 2) CHECK (brain_confidence >= 0 AND brain_confidence <= 1),
    was_user_override BOOLEAN DEFAULT false,
    
    output_tokens INTEGER,
    total_latency_ms INTEGER,
    time_to_first_token_ms INTEGER,
    total_cost DECIMAL(10, 6),
    was_streamed BOOLEAN DEFAULT false,
    
    step_count INTEGER DEFAULT 1,
    step_details JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE feedback_rating AS ENUM ('positive', 'negative', 'neutral');
CREATE TYPE feedback_category AS ENUM (
    'accuracy', 'relevance', 'tone', 'format', 'speed', 
    'safety', 'creativity', 'completeness', 'other'
);

CREATE TABLE feedback_explicit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    output_id VARCHAR(100) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    rating feedback_rating NOT NULL,
    categories feedback_category[] DEFAULT '{}',
    text_feedback TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE feedback_implicit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    output_id VARCHAR(100) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    signal_type VARCHAR(50) NOT NULL CHECK (signal_type IN (
        'regenerate', 'copy', 'share', 'abandon', 'switch_model', 
        'edit_response', 'expand', 'continue', 'follow_up'
    )),
    signal_weight DECIMAL(3, 2) NOT NULL,
    signal_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE model_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('user', 'tenant', 'global')),
    scope_id UUID,
    
    model_id VARCHAR(100) NOT NULL,
    task_type VARCHAR(50) NOT NULL,
    
    positive_count INTEGER DEFAULT 0,
    negative_count INTEGER DEFAULT 0,
    neutral_count INTEGER DEFAULT 0,
    total_samples INTEGER DEFAULT 0,
    
    quality_score DECIMAL(5, 4) DEFAULT 0.5,
    confidence DECIMAL(5, 4) DEFAULT 0,
    
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    decay_applied_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(scope, scope_id, model_id, task_type)
);

CREATE INDEX idx_exec_manifest_output ON execution_manifests(output_id);
CREATE INDEX idx_exec_manifest_tenant_user ON execution_manifests(tenant_id, user_id);
CREATE INDEX idx_exec_manifest_models ON execution_manifests USING GIN(models_used);
CREATE INDEX idx_exec_manifest_task ON execution_manifests(task_type);
CREATE INDEX idx_exec_manifest_created ON execution_manifests(created_at DESC);
CREATE INDEX idx_feedback_explicit_output ON feedback_explicit(output_id);
CREATE INDEX idx_feedback_explicit_user ON feedback_explicit(tenant_id, user_id);
CREATE INDEX idx_feedback_implicit_output ON feedback_implicit(output_id);
CREATE INDEX idx_feedback_implicit_signal ON feedback_implicit(signal_type);
CREATE INDEX idx_model_scores_scope ON model_scores(scope, scope_id);
CREATE INDEX idx_model_scores_model ON model_scores(model_id, task_type);

ALTER TABLE execution_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_explicit ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_implicit ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY exec_manifests_isolation ON execution_manifests
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY feedback_explicit_isolation ON feedback_explicit
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY feedback_implicit_isolation ON feedback_implicit
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY model_scores_read ON model_scores FOR SELECT USING (true);
