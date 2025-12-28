-- Migration 049: AGI Orchestration Settings and Weights
-- RADIANT v4.18.0 - Comprehensive AGI service weight management and orchestration configuration

-- ============================================================================
-- AGI Service Weights
-- ============================================================================

CREATE TABLE IF NOT EXISTS agi_service_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = global defaults
    service_id VARCHAR(50) NOT NULL,
    weight NUMERIC(4, 3) NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
    enabled BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    min_latency_ms INTEGER DEFAULT 5000,
    max_cost_cents NUMERIC(10, 4) DEFAULT 10.0,
    bedrock_optimized BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID,
    UNIQUE(tenant_id, service_id)
);

CREATE INDEX idx_agi_service_weights_tenant ON agi_service_weights(tenant_id);
CREATE INDEX idx_agi_service_weights_service ON agi_service_weights(service_id);

-- ============================================================================
-- Consciousness Indicator Weights
-- ============================================================================

CREATE TABLE IF NOT EXISTS agi_consciousness_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    indicator_id VARCHAR(50) NOT NULL,
    weight NUMERIC(4, 3) NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
    enabled BOOLEAN NOT NULL DEFAULT true,
    cycle_depth INTEGER NOT NULL DEFAULT 3,
    integration_threshold NUMERIC(4, 3) DEFAULT 0.5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, indicator_id)
);

-- ============================================================================
-- Decision Weights Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS agi_decision_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Domain Detection Phase
    domain_detection_weight NUMERIC(4, 3) DEFAULT 0.8,
    proficiency_match_weight NUMERIC(4, 3) DEFAULT 0.7,
    subspecialty_weight NUMERIC(4, 3) DEFAULT 0.5,
    
    -- Model Selection Phase
    model_quality_weight NUMERIC(4, 3) DEFAULT 0.8,
    model_cost_weight NUMERIC(4, 3) DEFAULT 0.5,
    model_latency_weight NUMERIC(4, 3) DEFAULT 0.6,
    model_specialty_weight NUMERIC(4, 3) DEFAULT 0.7,
    model_reliability_weight NUMERIC(4, 3) DEFAULT 0.9,
    
    -- Consciousness Phase
    global_workspace_weight NUMERIC(4, 3) DEFAULT 0.7,
    recurrent_processing_weight NUMERIC(4, 3) DEFAULT 0.6,
    integrated_information_weight NUMERIC(4, 3) DEFAULT 0.5,
    self_modeling_weight NUMERIC(4, 3) DEFAULT 0.6,
    
    -- Ethics Phase
    moral_compass_weight NUMERIC(4, 3) DEFAULT 0.9,
    ethical_guardrail_weight NUMERIC(4, 3) DEFAULT 1.0,
    
    -- Meta Phase
    confidence_calibration_weight NUMERIC(4, 3) DEFAULT 0.7,
    error_detection_weight NUMERIC(4, 3) DEFAULT 0.8,
    self_improvement_weight NUMERIC(4, 3) DEFAULT 0.4,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID,
    UNIQUE(tenant_id)
);

-- ============================================================================
-- Decision Thresholds
-- ============================================================================

CREATE TABLE IF NOT EXISTS agi_decision_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    min_confidence_for_action NUMERIC(4, 3) DEFAULT 0.6,
    min_domain_match_score NUMERIC(5, 2) DEFAULT 50.0,
    max_uncertainty_for_direct_response NUMERIC(4, 3) DEFAULT 0.4,
    escalation_threshold NUMERIC(4, 3) DEFAULT 0.3,
    moral_concern_threshold NUMERIC(4, 3) DEFAULT 0.7,
    self_improvement_trigger_threshold NUMERIC(4, 3) DEFAULT 0.5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- ============================================================================
-- Orchestration Pipelines
-- ============================================================================

CREATE TABLE IF NOT EXISTS agi_orchestration_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    pipeline_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    stages JSONB NOT NULL DEFAULT '[]',
    global_timeout_ms INTEGER DEFAULT 30000,
    max_cost_cents NUMERIC(10, 4) DEFAULT 50.0,
    optimization_mode VARCHAR(20) DEFAULT 'balanced' CHECK (optimization_mode IN ('quality', 'speed', 'cost', 'balanced')),
    bedrock_config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, pipeline_name)
);

-- ============================================================================
-- Bedrock Integration Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS agi_bedrock_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT false,
    prefer_bedrock_models BOOLEAN DEFAULT false,
    bedrock_region VARCHAR(20) DEFAULT 'us-east-1',
    knowledge_base_id VARCHAR(100),
    guardrail_id VARCHAR(100),
    agent_id VARCHAR(100),
    prompt_flow_id VARCHAR(100),
    use_bedrock_agents BOOLEAN DEFAULT false,
    use_knowledge_bases BOOLEAN DEFAULT false,
    use_guardrails BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- ============================================================================
-- Performance Tuning Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS agi_performance_tuning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    max_concurrent_services INTEGER DEFAULT 5,
    default_timeout_ms INTEGER DEFAULT 10000,
    caching_enabled BOOLEAN DEFAULT true,
    cache_ttl_ms INTEGER DEFAULT 300000,
    batching_enabled BOOLEAN DEFAULT false,
    batch_size INTEGER DEFAULT 10,
    adaptive_throttling BOOLEAN DEFAULT true,
    warmup_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- ============================================================================
-- Self-Improvement Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS agi_self_improvement_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT true,
    learning_rate NUMERIC(4, 3) DEFAULT 0.1,
    exploration_rate NUMERIC(4, 3) DEFAULT 0.2,
    feedback_weight NUMERIC(4, 3) DEFAULT 0.6,
    performance_weight NUMERIC(4, 3) DEFAULT 0.4,
    auto_tune_weights BOOLEAN DEFAULT false,
    auto_tune_interval_hours INTEGER DEFAULT 24,
    min_samples_for_tuning INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- ============================================================================
-- Orchestration Request Log (for monitoring)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agi_orchestration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    request_id VARCHAR(100) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'in_progress',
    
    -- Domain Detection
    detected_field_id VARCHAR(100),
    detected_domain_id VARCHAR(100),
    detected_subspecialty_id VARCHAR(100),
    domain_confidence NUMERIC(4, 3),
    
    -- Model Selection
    selected_model VARCHAR(200),
    fallback_models TEXT[],
    model_selection_reason TEXT,
    
    -- Performance
    total_latency_ms INTEGER,
    domain_detection_ms INTEGER,
    model_selection_ms INTEGER,
    consciousness_ms INTEGER,
    ethics_ms INTEGER,
    generation_ms INTEGER,
    estimated_cost_cents NUMERIC(10, 4),
    tokens_used INTEGER,
    
    -- Services Invoked
    services_invoked JSONB DEFAULT '[]',
    decisions_log JSONB DEFAULT '[]',
    
    -- Consciousness State
    consciousness_state JSONB,
    
    -- Ethics
    ethics_evaluation JSONB,
    
    -- Error tracking
    error_message TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agi_requests_tenant ON agi_orchestration_requests(tenant_id);
CREATE INDEX idx_agi_requests_user ON agi_orchestration_requests(user_id);
CREATE INDEX idx_agi_requests_started ON agi_orchestration_requests(started_at DESC);
CREATE INDEX idx_agi_requests_status ON agi_orchestration_requests(status);

-- ============================================================================
-- Service Health Metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS agi_service_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    service_id VARCHAR(50) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    invocation_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    avg_latency_ms NUMERIC(10, 2),
    p95_latency_ms NUMERIC(10, 2),
    p99_latency_ms NUMERIC(10, 2),
    avg_contribution NUMERIC(4, 3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agi_health_tenant_service ON agi_service_health(tenant_id, service_id);
CREATE INDEX idx_agi_health_period ON agi_service_health(period_start DESC);

-- ============================================================================
-- Insert Default Global Settings
-- ============================================================================

-- Default service weights (global)
INSERT INTO agi_service_weights (tenant_id, service_id, weight, enabled, priority, bedrock_optimized)
VALUES
    (NULL, 'consciousness', 0.7, true, 6, false),
    (NULL, 'metacognition', 0.8, true, 7, false),
    (NULL, 'moral_compass', 0.95, true, 10, false),
    (NULL, 'self_improvement', 0.5, true, 4, false),
    (NULL, 'domain_taxonomy', 0.85, true, 8, true),
    (NULL, 'brain_router', 0.9, true, 9, true),
    (NULL, 'confidence_calibration', 0.75, true, 7, false),
    (NULL, 'error_detection', 0.8, true, 8, false),
    (NULL, 'knowledge_graph', 0.6, true, 5, true),
    (NULL, 'proactive_assistance', 0.4, true, 3, false),
    (NULL, 'analogical_reasoning', 0.5, true, 4, false),
    (NULL, 'world_model', 0.65, true, 5, false),
    (NULL, 'episodic_memory', 0.7, true, 6, true),
    (NULL, 'theory_of_mind', 0.55, true, 5, false),
    (NULL, 'goal_planning', 0.6, true, 5, false),
    (NULL, 'causal_reasoning', 0.7, true, 6, false),
    (NULL, 'multimodal_binding', 0.5, true, 4, false),
    (NULL, 'response_synthesis', 0.9, true, 9, true)
ON CONFLICT DO NOTHING;

-- Default consciousness weights
INSERT INTO agi_consciousness_weights (tenant_id, indicator_id, weight, enabled, cycle_depth)
VALUES
    (NULL, 'global_workspace', 0.8, true, 5),
    (NULL, 'recurrent_processing', 0.7, true, 3),
    (NULL, 'integrated_information', 0.6, true, 4),
    (NULL, 'self_modeling', 0.75, true, 3),
    (NULL, 'persistent_memory', 0.8, true, 5),
    (NULL, 'world_model_grounding', 0.65, true, 4)
ON CONFLICT DO NOTHING;

-- Default decision weights
INSERT INTO agi_decision_weights (tenant_id)
VALUES (NULL)
ON CONFLICT DO NOTHING;

-- Default decision thresholds
INSERT INTO agi_decision_thresholds (tenant_id)
VALUES (NULL)
ON CONFLICT DO NOTHING;

-- Default pipeline
INSERT INTO agi_orchestration_pipelines (tenant_id, pipeline_name, description, is_default, stages, optimization_mode)
VALUES (
    NULL,
    'default',
    'Standard AGI orchestration pipeline with all phases',
    true,
    '[
        {"stageId": "domain_detection", "stageName": "Domain Detection", "stageOrder": 1, "services": ["domain_taxonomy"], "parallelExecution": false, "timeoutMs": 2000, "failureMode": "skip", "retryCount": 1, "cacheDurationMs": 300000},
        {"stageId": "model_selection", "stageName": "Model Selection", "stageOrder": 2, "services": ["brain_router"], "parallelExecution": false, "timeoutMs": 1000, "failureMode": "retry", "retryCount": 2, "cacheDurationMs": 60000},
        {"stageId": "consciousness", "stageName": "Consciousness Processing", "stageOrder": 3, "services": ["consciousness", "metacognition"], "parallelExecution": true, "timeoutMs": 3000, "failureMode": "skip", "retryCount": 0, "cacheDurationMs": 0},
        {"stageId": "ethics", "stageName": "Ethics Evaluation", "stageOrder": 4, "services": ["moral_compass"], "parallelExecution": false, "timeoutMs": 2000, "failureMode": "retry", "retryCount": 1, "cacheDurationMs": 0},
        {"stageId": "generation", "stageName": "Response Generation", "stageOrder": 5, "services": ["response_synthesis"], "parallelExecution": false, "timeoutMs": 20000, "failureMode": "abort", "retryCount": 2, "cacheDurationMs": 0},
        {"stageId": "meta", "stageName": "Meta Processing", "stageOrder": 6, "services": ["confidence_calibration", "error_detection", "self_improvement"], "parallelExecution": true, "timeoutMs": 2000, "failureMode": "skip", "retryCount": 0, "cacheDurationMs": 0}
    ]'::jsonb,
    'balanced'
)
ON CONFLICT DO NOTHING;

-- Default performance tuning
INSERT INTO agi_performance_tuning (tenant_id)
VALUES (NULL)
ON CONFLICT DO NOTHING;

-- Default self-improvement config
INSERT INTO agi_self_improvement_config (tenant_id)
VALUES (NULL)
ON CONFLICT DO NOTHING;

-- Default Bedrock config
INSERT INTO agi_bedrock_config (tenant_id)
VALUES (NULL)
ON CONFLICT DO NOTHING;
