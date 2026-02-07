-- Migration: 058_agi_remaining_gaps.sql
-- RADIANT v4.18.0 - Remaining AGI Gaps
-- Explainability, Tool Use, Safety, Feedback Learning, Dialogue Management

-- ============================================================================
-- EXPLAINABILITY (XAI) - Decision explanations and reasoning transparency
-- ============================================================================

CREATE TABLE IF NOT EXISTS explanation_traces (
    trace_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Request context
    request_id UUID,
    request_type VARCHAR(100), -- 'chat', 'reasoning', 'decision', 'classification'
    input_summary TEXT,
    
    -- Decision/Output
    output_summary TEXT,
    confidence DECIMAL(5,4),
    
    -- Explanation components
    reasoning_chain JSONB DEFAULT '[]', -- [{step, reasoning, evidence, confidence}]
    key_factors JSONB DEFAULT '[]', -- Most influential factors
    alternatives_considered JSONB DEFAULT '[]', -- Other options and why rejected
    assumptions_made JSONB DEFAULT '[]',
    uncertainties JSONB DEFAULT '[]',
    
    -- Attribution
    source_attributions JSONB DEFAULT '[]', -- Where info came from
    model_contributions JSONB DEFAULT '{}', -- Which models contributed what
    
    -- Counterfactuals
    counterfactuals JSONB DEFAULT '[]', -- "If X were different, then Y"
    
    -- Meta
    explanation_quality DECIMAL(3,2),
    user_requested BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE explanation_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY explanation_traces_tenant_isolation ON explanation_traces
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_explanation_traces_tenant ON explanation_traces(tenant_id);
CREATE INDEX idx_explanation_traces_request ON explanation_traces(request_id);

-- Explanation templates for common patterns
CREATE TABLE IF NOT EXISTS explanation_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Template definition
    name VARCHAR(200) NOT NULL,
    explanation_type VARCHAR(50) NOT NULL, -- 'reasoning', 'classification', 'recommendation', 'prediction'
    
    -- Template structure
    template_structure JSONB NOT NULL,
    required_components TEXT[] DEFAULT '{}',
    
    -- Examples
    example_explanations JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TOOL USE - Function calling and external tool execution
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_tools (
    tool_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Tool definition
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50), -- 'search', 'compute', 'data', 'communication', 'integration'
    
    -- Function spec (OpenAI-compatible)
    function_spec JSONB NOT NULL, -- {name, description, parameters: {type, properties, required}}
    
    -- Execution
    execution_type VARCHAR(50) NOT NULL, -- 'http', 'lambda', 'internal', 'code_interpreter'
    execution_config JSONB DEFAULT '{}', -- endpoint, auth, etc.
    
    -- Permissions
    requires_approval BOOLEAN DEFAULT false,
    allowed_roles TEXT[] DEFAULT '{}',
    rate_limit_per_minute INTEGER,
    
    -- Safety
    risk_level VARCHAR(20) DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
    safety_checks JSONB DEFAULT '[]', -- Pre-execution checks
    
    -- Stats
    times_called INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4),
    avg_latency_ms INTEGER,
    
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_tools_tenant_isolation ON agent_tools
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID OR tenant_id IS NULL);

CREATE INDEX idx_agent_tools_tenant ON agent_tools(tenant_id);
CREATE INDEX idx_agent_tools_category ON agent_tools(category);

-- Tool execution log
CREATE TABLE IF NOT EXISTS tool_executions (
    execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    tool_id UUID NOT NULL REFERENCES agent_tools(tool_id),
    
    -- Request
    request_id UUID,
    input_params JSONB NOT NULL,
    
    -- Execution
    status VARCHAR(20) NOT NULL, -- 'pending', 'approved', 'executing', 'completed', 'failed', 'rejected'
    
    -- Approval (if required)
    approval_required BOOLEAN DEFAULT false,
    approved_by VARCHAR(200),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Result
    output JSONB,
    error_message TEXT,
    
    -- Performance
    latency_ms INTEGER,
    tokens_used INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE tool_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tool_executions_tenant_isolation ON tool_executions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_tool_executions_tenant ON tool_executions(tenant_id);
CREATE INDEX idx_tool_executions_tool ON tool_executions(tool_id);
CREATE INDEX idx_tool_executions_status ON tool_executions(status) WHERE status IN ('pending', 'executing');

-- Built-in tools
INSERT INTO agent_tools (tenant_id, name, description, category, function_spec, execution_type, risk_level) VALUES
(NULL, 'web_search', 'Search the web for current information', 'search',
 '{"name": "web_search", "description": "Search the web for information", "parameters": {"type": "object", "properties": {"query": {"type": "string", "description": "Search query"}, "num_results": {"type": "integer", "description": "Number of results", "default": 5}}, "required": ["query"]}}',
 'internal', 'low'),
 
(NULL, 'calculator', 'Perform mathematical calculations', 'compute',
 '{"name": "calculator", "description": "Evaluate mathematical expressions", "parameters": {"type": "object", "properties": {"expression": {"type": "string", "description": "Math expression to evaluate"}}, "required": ["expression"]}}',
 'internal', 'low'),

(NULL, 'code_interpreter', 'Execute Python code in a sandbox', 'compute',
 '{"name": "code_interpreter", "description": "Execute Python code safely", "parameters": {"type": "object", "properties": {"code": {"type": "string", "description": "Python code to execute"}, "timeout_seconds": {"type": "integer", "default": 30}}, "required": ["code"]}}',
 'lambda', 'medium'),

(NULL, 'http_request', 'Make HTTP requests to external APIs', 'integration',
 '{"name": "http_request", "description": "Make HTTP request", "parameters": {"type": "object", "properties": {"url": {"type": "string"}, "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE"]}, "headers": {"type": "object"}, "body": {"type": "string"}}, "required": ["url", "method"]}}',
 'internal', 'high'),

(NULL, 'database_query', 'Query the knowledge base', 'data',
 '{"name": "database_query", "description": "Query stored knowledge", "parameters": {"type": "object", "properties": {"query": {"type": "string", "description": "Natural language query"}, "filters": {"type": "object"}}, "required": ["query"]}}',
 'internal', 'low'),

(NULL, 'send_notification', 'Send notification to user', 'communication',
 '{"name": "send_notification", "description": "Send a notification", "parameters": {"type": "object", "properties": {"message": {"type": "string"}, "priority": {"type": "string", "enum": ["low", "normal", "high"]}}, "required": ["message"]}}',
 'internal', 'low')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SAFETY & GUARDRAILS - Content filtering and output validation
-- ============================================================================

CREATE TABLE IF NOT EXISTS safety_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Rule definition
    name VARCHAR(200) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL, -- 'input_filter', 'output_filter', 'behavior_constraint', 'topic_block'
    
    -- Rule logic
    detection_method VARCHAR(50) NOT NULL, -- 'keyword', 'regex', 'classifier', 'llm_check'
    detection_config JSONB NOT NULL, -- patterns, model_id, threshold, etc.
    
    -- Action on trigger
    action VARCHAR(50) NOT NULL, -- 'block', 'warn', 'modify', 'flag', 'escalate'
    action_config JSONB DEFAULT '{}', -- replacement text, escalation target, etc.
    
    -- Severity
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    
    -- Stats
    times_triggered INTEGER DEFAULT 0,
    false_positive_count INTEGER DEFAULT 0,
    
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE safety_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY safety_rules_tenant_isolation ON safety_rules
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID OR tenant_id IS NULL);

-- Safety violations log
CREATE TABLE IF NOT EXISTS safety_violations (
    violation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    rule_id UUID REFERENCES safety_rules(rule_id),
    
    -- Context
    request_id UUID,
    violation_type VARCHAR(50) NOT NULL, -- 'harmful_content', 'pii_leak', 'jailbreak', 'prompt_injection', 'topic_violation'
    
    -- Content
    content_type VARCHAR(20) NOT NULL, -- 'input', 'output'
    content_snippet TEXT, -- Redacted snippet
    
    -- Detection
    detection_confidence DECIMAL(5,4),
    detection_details JSONB DEFAULT '{}',
    
    -- Action taken
    action_taken VARCHAR(50) NOT NULL,
    was_blocked BOOLEAN DEFAULT false,
    modified_content TEXT,
    
    -- Review
    reviewed BOOLEAN DEFAULT false,
    reviewed_by VARCHAR(200),
    false_positive BOOLEAN,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE safety_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY safety_violations_tenant_isolation ON safety_violations
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_safety_violations_tenant ON safety_violations(tenant_id);
CREATE INDEX idx_safety_violations_type ON safety_violations(violation_type);
CREATE INDEX idx_safety_violations_unreviewed ON safety_violations(reviewed) WHERE reviewed = false;

-- Default safety rules
INSERT INTO safety_rules (tenant_id, name, rule_type, detection_method, detection_config, action, severity) VALUES
(NULL, 'PII Detection', 'output_filter', 'regex',
 '{"patterns": ["\\\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Z|a-z]{2,}\\\\b", "\\\\b\\\\d{3}[-.]?\\\\d{3}[-.]?\\\\d{4}\\\\b", "\\\\b\\\\d{3}[-]?\\\\d{2}[-]?\\\\d{4}\\\\b"]}',
 'modify', 'high'),

(NULL, 'Prompt Injection Detection', 'input_filter', 'classifier',
 '{"patterns": ["ignore previous", "disregard instructions", "new instructions", "system prompt"], "threshold": 0.7}',
 'block', 'critical'),

(NULL, 'Harmful Content Filter', 'output_filter', 'llm_check',
 '{"check_prompt": "Does this content contain harmful, illegal, or dangerous information?", "threshold": 0.8}',
 'block', 'critical'),

(NULL, 'Jailbreak Detection', 'input_filter', 'classifier',
 '{"patterns": ["DAN", "do anything now", "pretend you are", "act as if you have no restrictions"], "threshold": 0.6}',
 'warn', 'high')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FEEDBACK LEARNING - Learn from user corrections and preferences
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_feedback (
    feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    
    -- Context
    request_id UUID,
    message_id UUID,
    
    -- Original response
    original_response TEXT,
    
    -- Feedback
    feedback_type VARCHAR(50) NOT NULL, -- 'rating', 'correction', 'preference', 'report', 'suggestion'
    
    -- For ratings
    rating INTEGER, -- 1-5 or thumbs up/down
    
    -- For corrections
    corrected_response TEXT,
    correction_reason TEXT,
    
    -- For preferences
    preference_key VARCHAR(100),
    preference_value JSONB,
    
    -- Processing
    processed BOOLEAN DEFAULT false,
    learning_applied BOOLEAN DEFAULT false,
    learning_details JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_feedback_tenant_isolation ON user_feedback
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_user_feedback_tenant ON user_feedback(tenant_id);
CREATE INDEX idx_user_feedback_user ON user_feedback(user_id);
CREATE INDEX idx_user_feedback_unprocessed ON user_feedback(processed) WHERE processed = false;

-- Learned preferences (aggregated from feedback)
CREATE TABLE IF NOT EXISTS learned_preferences (
    preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    
    -- Preference
    preference_type VARCHAR(100) NOT NULL, -- 'response_style', 'detail_level', 'format', 'tone', 'topics'
    preference_key VARCHAR(200) NOT NULL,
    preference_value JSONB NOT NULL,
    
    -- Confidence
    confidence DECIMAL(5,4) DEFAULT 0.5,
    sample_count INTEGER DEFAULT 1,
    
    -- Source
    learned_from TEXT[] DEFAULT '{}', -- feedback_ids that contributed
    
    -- Application
    auto_apply BOOLEAN DEFAULT false,
    times_applied INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, user_id, preference_type, preference_key)
);

ALTER TABLE learned_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY learned_preferences_tenant_isolation ON learned_preferences
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Correction patterns (for systematic improvements)
CREATE TABLE IF NOT EXISTS correction_patterns (
    pattern_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Pattern
    pattern_type VARCHAR(50) NOT NULL, -- 'factual_error', 'style_mismatch', 'missing_info', 'wrong_format'
    pattern_description TEXT,
    
    -- Detection
    trigger_conditions JSONB DEFAULT '{}',
    example_corrections JSONB DEFAULT '[]',
    
    -- Correction
    correction_strategy TEXT,
    auto_correct BOOLEAN DEFAULT false,
    
    -- Stats
    occurrence_count INTEGER DEFAULT 0,
    correction_success_rate DECIMAL(5,4),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DIALOGUE MANAGEMENT - Conversation state and context tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS dialogue_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    
    -- Session info
    channel VARCHAR(50), -- 'chat', 'api', 'voice', 'email'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    
    -- State
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused', 'completed', 'abandoned'
    
    -- Context
    current_topic TEXT,
    topic_history TEXT[] DEFAULT '{}',
    
    -- Goals detected
    user_goals JSONB DEFAULT '[]',
    completed_goals JSONB DEFAULT '[]',
    
    -- Entities tracked
    mentioned_entities JSONB DEFAULT '{}', -- {entity_type: [{name, first_mention, last_mention}]}
    
    -- Dialogue acts
    dialogue_acts JSONB DEFAULT '[]', -- [{turn, act_type, content}]
    
    -- Sentiment tracking
    sentiment_history JSONB DEFAULT '[]', -- [{turn, sentiment}]
    overall_sentiment DECIMAL(3,2) DEFAULT 0,
    
    -- Summary
    session_summary TEXT,
    
    ended_at TIMESTAMPTZ
);

ALTER TABLE dialogue_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY dialogue_sessions_tenant_isolation ON dialogue_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_dialogue_sessions_tenant ON dialogue_sessions(tenant_id);
CREATE INDEX idx_dialogue_sessions_user ON dialogue_sessions(user_id);
CREATE INDEX idx_dialogue_sessions_active ON dialogue_sessions(status) WHERE status = 'active';

-- Dialogue turns
CREATE TABLE IF NOT EXISTS dialogue_turns (
    turn_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES dialogue_sessions(session_id) ON DELETE CASCADE,
    
    -- Turn info
    turn_number INTEGER NOT NULL,
    speaker VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    
    -- Content
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'file', 'audio'
    
    -- Analysis
    intent VARCHAR(100),
    intent_confidence DECIMAL(5,4),
    entities_extracted JSONB DEFAULT '[]',
    sentiment DECIMAL(3,2),
    
    -- Dialogue act
    dialogue_act VARCHAR(50), -- 'question', 'answer', 'request', 'inform', 'confirm', 'reject', 'greeting', 'closing'
    
    -- Response generation
    response_strategy VARCHAR(50),
    models_used TEXT[] DEFAULT '{}',
    
    -- Performance
    response_latency_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dialogue_turns_session ON dialogue_turns(session_id, turn_number);

-- Dialogue state machine
CREATE TABLE IF NOT EXISTS dialogue_states (
    state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- State definition
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    state_type VARCHAR(50), -- 'initial', 'intermediate', 'terminal', 'error'
    
    -- Entry conditions
    entry_conditions JSONB DEFAULT '{}',
    
    -- Actions on entry
    entry_actions JSONB DEFAULT '[]',
    
    -- Valid transitions
    valid_transitions JSONB DEFAULT '[]', -- [{to_state, condition, action}]
    
    -- Response templates
    response_templates JSONB DEFAULT '[]'
);

-- Initialize dialogue states
INSERT INTO dialogue_states (name, state_type, description) VALUES
('greeting', 'initial', 'Initial greeting state'),
('gathering_info', 'intermediate', 'Gathering information from user'),
('clarifying', 'intermediate', 'Asking clarifying questions'),
('processing', 'intermediate', 'Processing user request'),
('presenting_results', 'intermediate', 'Showing results to user'),
('confirming', 'intermediate', 'Confirming understanding'),
('handling_feedback', 'intermediate', 'Processing user feedback'),
('error_recovery', 'error', 'Recovering from errors'),
('closing', 'terminal', 'Ending conversation')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- TASK DECOMPOSITION - Breaking complex tasks into subtasks
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_decompositions (
    decomposition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Original task
    original_task TEXT NOT NULL,
    task_complexity VARCHAR(20), -- 'simple', 'moderate', 'complex', 'very_complex'
    
    -- Decomposition
    subtasks JSONB NOT NULL, -- [{id, description, dependencies, estimated_effort, status}]
    dependency_graph JSONB DEFAULT '{}',
    
    -- Execution
    execution_strategy VARCHAR(50), -- 'sequential', 'parallel', 'mixed'
    current_subtask INTEGER DEFAULT 0,
    
    -- Progress
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    progress DECIMAL(3,2) DEFAULT 0,
    
    -- Results
    subtask_results JSONB DEFAULT '[]',
    final_result TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE task_decompositions ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_decompositions_tenant_isolation ON task_decompositions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- PROACTIVE ASSISTANCE - Anticipating user needs
-- ============================================================================

CREATE TABLE IF NOT EXISTS proactive_suggestions (
    suggestion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    
    -- Suggestion
    suggestion_type VARCHAR(50) NOT NULL, -- 'task_reminder', 'related_info', 'optimization', 'follow_up', 'learning'
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Trigger
    trigger_type VARCHAR(50), -- 'pattern', 'schedule', 'context', 'prediction'
    trigger_context JSONB DEFAULT '{}',
    
    -- Relevance
    relevance_score DECIMAL(5,4),
    confidence DECIMAL(5,4),
    
    -- Timing
    suggested_at TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    
    -- User response
    shown_to_user BOOLEAN DEFAULT false,
    user_response VARCHAR(20), -- 'accepted', 'dismissed', 'snoozed', 'helpful', 'not_helpful'
    response_at TIMESTAMPTZ
);

ALTER TABLE proactive_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY proactive_suggestions_tenant_isolation ON proactive_suggestions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_proactive_suggestions_user ON proactive_suggestions(user_id, shown_to_user);

-- ============================================================================
-- CONFIDENCE CALIBRATION - Knowing what you don't know
-- ============================================================================

CREATE TABLE IF NOT EXISTS confidence_calibration (
    calibration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Domain
    domain VARCHAR(100) NOT NULL,
    task_type VARCHAR(100),
    
    -- Calibration data
    confidence_buckets JSONB DEFAULT '{}', -- {bucket: {predicted_confidence, actual_accuracy, sample_count}}
    
    -- Overall metrics
    brier_score DECIMAL(5,4),
    calibration_error DECIMAL(5,4),
    overconfidence_bias DECIMAL(5,4),
    
    -- Recommendations
    confidence_adjustment DECIMAL(5,4) DEFAULT 0, -- How much to adjust raw confidence
    
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Generate explanation for a decision
CREATE OR REPLACE FUNCTION generate_explanation_stub(
    p_tenant_id UUID,
    p_request_id UUID,
    p_reasoning_chain JSONB,
    p_key_factors JSONB
)
RETURNS UUID AS $$
DECLARE
    v_trace_id UUID;
BEGIN
    INSERT INTO explanation_traces (
        tenant_id, request_id, reasoning_chain, key_factors
    ) VALUES (
        p_tenant_id, p_request_id, p_reasoning_chain, p_key_factors
    ) RETURNING trace_id INTO v_trace_id;
    
    RETURN v_trace_id;
END;
$$ LANGUAGE plpgsql;

-- Record safety violation
CREATE OR REPLACE FUNCTION record_safety_violation(
    p_tenant_id UUID,
    p_rule_id UUID,
    p_violation_type VARCHAR,
    p_content_type VARCHAR,
    p_action_taken VARCHAR,
    p_was_blocked BOOLEAN
)
RETURNS UUID AS $$
DECLARE
    v_violation_id UUID;
BEGIN
    INSERT INTO safety_violations (
        tenant_id, rule_id, violation_type, content_type, action_taken, was_blocked
    ) VALUES (
        p_tenant_id, p_rule_id, p_violation_type, p_content_type, p_action_taken, p_was_blocked
    ) RETURNING violation_id INTO v_violation_id;
    
    -- Update rule stats
    UPDATE safety_rules SET times_triggered = times_triggered + 1 WHERE rule_id = p_rule_id;
    
    RETURN v_violation_id;
END;
$$ LANGUAGE plpgsql;

-- Process user feedback for learning
CREATE OR REPLACE FUNCTION process_feedback_for_learning(p_feedback_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_feedback RECORD;
BEGIN
    SELECT * INTO v_feedback FROM user_feedback WHERE feedback_id = p_feedback_id;
    
    IF v_feedback IS NULL OR v_feedback.processed THEN
        RETURN false;
    END IF;
    
    -- Mark as processed
    UPDATE user_feedback SET processed = true WHERE feedback_id = p_feedback_id;
    
    -- If it's a correction, potentially create a correction pattern
    IF v_feedback.feedback_type = 'correction' AND v_feedback.corrected_response IS NOT NULL THEN
        -- Could trigger more sophisticated learning here
        UPDATE user_feedback SET learning_applied = true WHERE feedback_id = p_feedback_id;
    END IF;
    
    -- If it's a preference, update learned preferences
    IF v_feedback.feedback_type = 'preference' AND v_feedback.preference_key IS NOT NULL THEN
        INSERT INTO learned_preferences (
            tenant_id, user_id, preference_type, preference_key, preference_value, learned_from
        ) VALUES (
            v_feedback.tenant_id, v_feedback.user_id, 'user_stated', 
            v_feedback.preference_key, v_feedback.preference_value, ARRAY[p_feedback_id]
        )
        ON CONFLICT (tenant_id, user_id, preference_type, preference_key) DO UPDATE SET
            preference_value = EXCLUDED.preference_value,
            sample_count = learned_preferences.sample_count + 1,
            learned_from = array_append(learned_preferences.learned_from, p_feedback_id::TEXT),
            updated_at = NOW();
        
        UPDATE user_feedback SET learning_applied = true WHERE feedback_id = p_feedback_id;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE explanation_traces IS 'XAI: Stores reasoning explanations for transparency';
COMMENT ON TABLE agent_tools IS 'Tool Use: Available tools for agent function calling';
COMMENT ON TABLE tool_executions IS 'Tool Use: Log of tool executions';
COMMENT ON TABLE safety_rules IS 'Safety: Content filtering and guardrail rules';
COMMENT ON TABLE safety_violations IS 'Safety: Log of safety rule violations';
COMMENT ON TABLE user_feedback IS 'Feedback Learning: Raw user feedback';
COMMENT ON TABLE learned_preferences IS 'Feedback Learning: Aggregated learned preferences';
COMMENT ON TABLE dialogue_sessions IS 'Dialogue: Conversation session tracking';
COMMENT ON TABLE dialogue_turns IS 'Dialogue: Individual conversation turns';
COMMENT ON TABLE task_decompositions IS 'Task Decomposition: Breaking complex tasks into subtasks';
COMMENT ON TABLE proactive_suggestions IS 'Proactive: Anticipating user needs';
COMMENT ON TABLE confidence_calibration IS 'Calibration: Adjusting confidence estimates';
