-- Migration 050: AGI Brain Plans
-- RADIANT v4.18.0 - Real-time planning system for transparent AGI decision-making

CREATE TABLE IF NOT EXISTS agi_brain_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id VARCHAR(100) NOT NULL UNIQUE,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    session_id VARCHAR(100),
    conversation_id VARCHAR(100),
    
    -- Original request
    prompt TEXT NOT NULL,
    prompt_analysis JSONB NOT NULL DEFAULT '{}',
    
    -- Plan status
    status VARCHAR(20) NOT NULL DEFAULT 'planning',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_duration_ms INTEGER,
    
    -- Plan steps
    steps JSONB NOT NULL DEFAULT '[]',
    current_step_index INTEGER DEFAULT 0,
    
    -- Orchestration configuration
    orchestration_mode VARCHAR(30) NOT NULL,
    orchestration_reason TEXT,
    
    -- Model selection
    primary_model JSONB NOT NULL DEFAULT '{}',
    fallback_models JSONB DEFAULT '[]',
    
    -- Domain detection
    domain_detection JSONB,
    
    -- Consciousness state
    consciousness_active BOOLEAN DEFAULT true,
    consciousness_state JSONB,
    
    -- Ethics evaluation
    ethics_evaluation JSONB,
    
    -- Performance estimates
    estimated_duration_ms INTEGER,
    estimated_cost_cents NUMERIC(10, 4),
    estimated_tokens INTEGER,
    
    -- Quality targets
    quality_targets JSONB DEFAULT '{}',
    
    -- Self-improvement
    learning_enabled BOOLEAN DEFAULT true,
    feedback_requested BOOLEAN DEFAULT true,
    user_feedback JSONB,
    
    -- Result
    final_response TEXT,
    actual_tokens_used INTEGER,
    actual_cost_cents NUMERIC(10, 4),
    final_confidence NUMERIC(4, 3),
    
    CONSTRAINT chk_status CHECK (status IN ('planning', 'ready', 'executing', 'completed', 'failed', 'cancelled'))
);

-- Indexes for efficient queries
CREATE INDEX idx_brain_plans_tenant ON agi_brain_plans(tenant_id);
CREATE INDEX idx_brain_plans_user ON agi_brain_plans(user_id);
CREATE INDEX idx_brain_plans_session ON agi_brain_plans(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_brain_plans_conversation ON agi_brain_plans(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_brain_plans_status ON agi_brain_plans(status);
CREATE INDEX idx_brain_plans_created ON agi_brain_plans(created_at DESC);

-- Plan step events for real-time tracking
CREATE TABLE IF NOT EXISTS agi_brain_plan_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id VARCHAR(100) NOT NULL REFERENCES agi_brain_plans(plan_id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL,
    step_id VARCHAR(100),
    step_number INTEGER,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data JSONB DEFAULT '{}',
    
    CONSTRAINT chk_event_type CHECK (event_type IN (
        'plan_created', 'plan_started', 'step_started', 'step_completed', 
        'step_failed', 'step_skipped', 'plan_completed', 'plan_failed', 'plan_cancelled'
    ))
);

CREATE INDEX idx_plan_events_plan ON agi_brain_plan_events(plan_id);
CREATE INDEX idx_plan_events_timestamp ON agi_brain_plan_events(timestamp DESC);

-- User plan preferences
CREATE TABLE IF NOT EXISTS agi_brain_plan_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    -- Display preferences
    show_plan_before_execution BOOLEAN DEFAULT true,
    show_step_details BOOLEAN DEFAULT true,
    show_model_selection BOOLEAN DEFAULT true,
    show_domain_detection BOOLEAN DEFAULT true,
    show_ethics_check BOOLEAN DEFAULT true,
    show_timing_estimates BOOLEAN DEFAULT true,
    show_cost_estimates BOOLEAN DEFAULT true,
    
    -- Execution preferences
    auto_approve_simple BOOLEAN DEFAULT false,
    auto_approve_threshold NUMERIC(4, 3) DEFAULT 0.8,
    preferred_mode VARCHAR(30),
    preferred_model VARCHAR(200),
    max_wait_seconds INTEGER DEFAULT 30,
    
    -- Notification preferences
    notify_on_completion BOOLEAN DEFAULT false,
    notify_on_failure BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, user_id)
);

-- Plan templates for common tasks
CREATE TABLE IF NOT EXISTS agi_brain_plan_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,  -- NULL = global template
    template_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Template configuration
    task_type VARCHAR(50) NOT NULL,
    orchestration_mode VARCHAR(30) NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]',
    quality_targets JSONB DEFAULT '{}',
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    avg_success_rate NUMERIC(4, 3),
    avg_duration_ms INTEGER,
    
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, template_name)
);

-- Insert default templates
INSERT INTO agi_brain_plan_templates (tenant_id, template_name, description, task_type, orchestration_mode, steps, is_default)
VALUES 
(NULL, 'Quick Answer', 'Fast response for simple questions', 'simple', 'thinking', 
 '[{"stepType": "analyze", "title": "Analyze"}, {"stepType": "generate", "title": "Generate"}, {"stepType": "calibrate", "title": "Calibrate"}]', true),

(NULL, 'Deep Reasoning', 'Extended thinking for complex problems', 'complex', 'extended_thinking',
 '[{"stepType": "analyze", "title": "Analyze"}, {"stepType": "detect_domain", "title": "Detect Domain"}, {"stepType": "select_model", "title": "Select Model"}, {"stepType": "prepare_context", "title": "Prepare Context"}, {"stepType": "generate", "title": "Generate with Extended Thinking"}, {"stepType": "reflect", "title": "Self-Reflection"}, {"stepType": "verify", "title": "Verify"}, {"stepType": "calibrate", "title": "Calibrate"}]', false),

(NULL, 'Code Generation', 'Optimized for programming tasks', 'coding', 'coding',
 '[{"stepType": "analyze", "title": "Analyze Requirements"}, {"stepType": "detect_domain", "title": "Detect Tech Stack"}, {"stepType": "select_model", "title": "Select Coding Model"}, {"stepType": "generate", "title": "Generate Code"}, {"stepType": "verify", "title": "Verify Syntax"}, {"stepType": "calibrate", "title": "Calibrate"}]', false),

(NULL, 'Research Synthesis', 'For research and analysis tasks', 'research', 'research',
 '[{"stepType": "analyze", "title": "Analyze Query"}, {"stepType": "detect_domain", "title": "Identify Research Domain"}, {"stepType": "prepare_context", "title": "Gather Sources"}, {"stepType": "ethics_check", "title": "Source Validation"}, {"stepType": "generate", "title": "Synthesize Research"}, {"stepType": "verify", "title": "Fact Check"}, {"stepType": "calibrate", "title": "Confidence Assessment"}]', false),

(NULL, 'Creative Writing', 'For creative content generation', 'creative', 'creative',
 '[{"stepType": "analyze", "title": "Understand Brief"}, {"stepType": "prepare_context", "title": "Gather Inspiration"}, {"stepType": "generate", "title": "Creative Generation"}, {"stepType": "refine", "title": "Polish & Refine"}, {"stepType": "calibrate", "title": "Quality Check"}]', false)

ON CONFLICT DO NOTHING;
