-- Migration: 066_orchestration_patterns_registry.sql
-- RADIANT v4.18.0 - Comprehensive Orchestration Patterns Registry
-- Architecture: Workflows → Methods (shared, parameterized)

-- ============================================================================
-- ORCHESTRATION METHODS - Shared reusable methods with default parameters
-- ============================================================================

CREATE TABLE IF NOT EXISTS orchestration_methods (
    method_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Method Identity
    method_code VARCHAR(100) UNIQUE NOT NULL,
    method_name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Category
    method_category VARCHAR(100) NOT NULL, -- 'generation', 'evaluation', 'synthesis', 'verification', 'routing'
    
    -- Default Parameters (can be overridden per-workflow)
    default_parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    parameter_schema JSONB NOT NULL DEFAULT '{}'::jsonb, -- JSON Schema for validation
    
    -- Implementation
    implementation_type VARCHAR(50) NOT NULL, -- 'prompt', 'code', 'composite', 'external'
    prompt_template TEXT, -- For prompt-based methods
    code_reference VARCHAR(200), -- For code-based methods
    
    -- Model requirements
    requires_model BOOLEAN DEFAULT true,
    default_model VARCHAR(200),
    recommended_models TEXT[] DEFAULT '{}',
    model_role VARCHAR(100), -- 'generator', 'critic', 'judge', 'verifier', 'router'
    
    -- Execution characteristics
    typical_latency_ms INTEGER,
    typical_cost_multiplier DECIMAL(5,2) DEFAULT 1.0,
    supports_streaming BOOLEAN DEFAULT true,
    is_parallelizable BOOLEAN DEFAULT false,
    
    -- Metrics
    times_used INTEGER DEFAULT 0,
    avg_quality_score DECIMAL(5,4),
    avg_latency_ms INTEGER,
    
    -- Status
    is_system_method BOOLEAN DEFAULT true,
    is_enabled BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orchestration_methods_code ON orchestration_methods(method_code);
CREATE INDEX idx_orchestration_methods_category ON orchestration_methods(method_category);

-- ============================================================================
-- ORCHESTRATION WORKFLOWS - The 49 patterns + user-defined
-- ============================================================================

CREATE TABLE IF NOT EXISTS orchestration_workflows (
    workflow_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Workflow Identity
    workflow_code VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'ARE', 'SOD', 'LAAJE'
    common_name VARCHAR(200) NOT NULL,
    formal_name VARCHAR(200) NOT NULL,
    
    -- Classification
    category VARCHAR(100) NOT NULL,
    category_code VARCHAR(50) NOT NULL,
    pattern_number INTEGER,
    
    -- Description
    description TEXT NOT NULL,
    detailed_description TEXT,
    research_references TEXT[], -- Academic papers, documentation links
    
    -- When to Use (for AGI selection)
    best_for TEXT[] DEFAULT '{}',
    problem_indicators TEXT[] DEFAULT '{}',
    complexity_level VARCHAR(50), -- 'simple', 'moderate', 'complex', 'expert'
    
    -- Performance characteristics
    quality_improvement VARCHAR(200),
    typical_latency VARCHAR(50),
    typical_cost VARCHAR(50),
    min_models_required INTEGER DEFAULT 1,
    
    -- Workflow configuration defaults
    default_config JSONB DEFAULT '{}'::jsonb,
    config_schema JSONB DEFAULT '{}'::jsonb,
    
    -- Metrics (learned from usage)
    times_used INTEGER DEFAULT 0,
    avg_quality_score DECIMAL(5,4),
    avg_latency_ms INTEGER,
    success_rate DECIMAL(5,4),
    
    -- Status
    is_system_workflow BOOLEAN DEFAULT true,
    is_enabled BOOLEAN DEFAULT true,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- NULL for system workflows
    created_by UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orchestration_workflows_code ON orchestration_workflows(workflow_code);
CREATE INDEX idx_orchestration_workflows_category ON orchestration_workflows(category_code);
CREATE INDEX idx_orchestration_workflows_tenant ON orchestration_workflows(tenant_id);

-- ============================================================================
-- WORKFLOW-METHOD BINDINGS - Links methods to workflows with custom parameters
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_method_bindings (
    binding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES orchestration_workflows(workflow_id) ON DELETE CASCADE,
    method_id UUID NOT NULL REFERENCES orchestration_methods(method_id) ON DELETE CASCADE,
    
    -- Step configuration
    step_order INTEGER NOT NULL,
    step_name VARCHAR(200),
    step_description TEXT,
    
    -- Parameter overrides (merged with method defaults)
    parameter_overrides JSONB DEFAULT '{}'::jsonb,
    
    -- Conditional execution
    condition_expression TEXT, -- e.g., "confidence < 0.7", "iteration < max_iterations"
    
    -- Iteration control
    is_iterative BOOLEAN DEFAULT false,
    max_iterations INTEGER DEFAULT 1,
    iteration_condition TEXT, -- When to continue iterating
    
    -- Dependencies
    depends_on_steps INTEGER[] DEFAULT '{}', -- Step numbers this depends on
    
    -- Model assignment for this step
    model_override VARCHAR(200),
    model_role_override VARCHAR(100),
    
    -- Output handling
    output_variable VARCHAR(100), -- Name to store output for later steps
    output_transform TEXT, -- Optional transformation expression
    
    -- Status
    is_enabled BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workflow_id, step_order)
);

CREATE INDEX idx_workflow_method_bindings_workflow ON workflow_method_bindings(workflow_id);
CREATE INDEX idx_workflow_method_bindings_method ON workflow_method_bindings(method_id);

-- ============================================================================
-- USER/TENANT WORKFLOW CUSTOMIZATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_customizations (
    customization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES orchestration_workflows(workflow_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Custom name (optional)
    custom_name VARCHAR(200),
    
    -- Global config overrides for this workflow
    config_overrides JSONB DEFAULT '{}'::jsonb,
    
    -- Enable/disable specific steps
    disabled_steps INTEGER[] DEFAULT '{}',
    
    -- Model preferences
    model_preferences JSONB DEFAULT '{}'::jsonb, -- {"generator": "claude-3-5-sonnet", "judge": "o1"}
    
    is_enabled BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workflow_id, tenant_id)
);

CREATE INDEX idx_workflow_customizations_tenant ON workflow_customizations(tenant_id);

-- ============================================================================
-- WORKFLOW EXECUTION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS orchestration_executions (
    execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES orchestration_workflows(workflow_id),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    
    -- Input
    input_prompt TEXT NOT NULL,
    input_context JSONB DEFAULT '{}'::jsonb,
    
    -- Configuration used
    resolved_config JSONB DEFAULT '{}'::jsonb,
    
    -- Selection
    selection_method VARCHAR(50), -- 'auto', 'user_selected', 'forced'
    selection_reason TEXT,
    selection_confidence DECIMAL(5,4),
    
    -- Result
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    output_response TEXT,
    quality_score DECIMAL(5,4),
    
    -- Performance
    total_latency_ms INTEGER,
    total_cost_cents DECIMAL(10,6),
    models_used TEXT[] DEFAULT '{}',
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orchestration_executions_workflow ON orchestration_executions(workflow_id);
CREATE INDEX idx_orchestration_executions_tenant ON orchestration_executions(tenant_id);
CREATE INDEX idx_orchestration_executions_status ON orchestration_executions(status);

-- ============================================================================
-- STEP EXECUTION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS orchestration_step_executions (
    step_execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES orchestration_executions(execution_id) ON DELETE CASCADE,
    binding_id UUID REFERENCES workflow_method_bindings(binding_id),
    method_id UUID REFERENCES orchestration_methods(method_id),
    
    step_order INTEGER NOT NULL,
    step_name VARCHAR(200),
    
    -- Input/Output
    input_data JSONB DEFAULT '{}'::jsonb,
    output_data JSONB DEFAULT '{}'::jsonb,
    
    -- Execution details
    model_used VARCHAR(200),
    parameters_used JSONB DEFAULT '{}'::jsonb,
    
    -- Iteration info
    iteration_number INTEGER DEFAULT 1,
    
    -- Result
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    
    -- Performance
    latency_ms INTEGER,
    cost_cents DECIMAL(10,6),
    tokens_used INTEGER,
    
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_step_executions_execution ON orchestration_step_executions(execution_id);

-- ============================================================================
-- SEED: CORE ORCHESTRATION METHODS
-- ============================================================================

INSERT INTO orchestration_methods (method_code, method_name, description, method_category, default_parameters, parameter_schema, implementation_type, prompt_template, model_role, recommended_models) VALUES

-- Generation Methods
('GENERATE_RESPONSE', 'Generate Response', 'Generate a response to a prompt using specified model', 'generation',
 '{"temperature": 0.7, "max_tokens": 4096}'::jsonb,
 '{"type": "object", "properties": {"temperature": {"type": "number", "min": 0, "max": 2}, "max_tokens": {"type": "integer"}}}'::jsonb,
 'prompt', 'Generate a response to: {{prompt}}\n\nContext: {{context}}', 'generator',
 ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o', 'deepseek/deepseek-chat']),

('GENERATE_WITH_COT', 'Generate with Chain-of-Thought', 'Generate response using chain-of-thought reasoning', 'generation',
 '{"temperature": 0.3, "max_tokens": 8192, "thinking_budget": 2000}'::jsonb,
 '{"type": "object", "properties": {"temperature": {"type": "number"}, "thinking_budget": {"type": "integer"}}}'::jsonb,
 'prompt', 'Think through this step-by-step before answering:\n\n{{prompt}}\n\nShow your reasoning, then provide your answer.', 'generator',
 ARRAY['openai/o1', 'deepseek/deepseek-reasoner', 'anthropic/claude-3-5-sonnet-20241022']),

-- Critique/Evaluation Methods
('CRITIQUE_RESPONSE', 'Critique Response', 'Critically evaluate a response for flaws and improvements', 'evaluation',
 '{"focus_areas": ["accuracy", "completeness", "clarity", "logic"], "severity_threshold": "medium"}'::jsonb,
 '{"type": "object", "properties": {"focus_areas": {"type": "array"}, "severity_threshold": {"type": "string"}}}'::jsonb,
 'prompt', 'Critically evaluate this response:\n\nOriginal Question: {{original_prompt}}\nResponse: {{response}}\n\nIdentify:\n1. Factual errors\n2. Logical flaws\n3. Missing information\n4. Clarity issues\n\nFor each issue, rate severity (low/medium/high) and suggest fixes.', 'critic',
 ARRAY['openai/o1', 'anthropic/claude-3-5-sonnet-20241022']),

('JUDGE_RESPONSES', 'Judge Multiple Responses', 'Compare and judge multiple responses to select the best', 'evaluation',
 '{"evaluation_mode": "pairwise", "criteria": ["accuracy", "helpfulness", "clarity", "completeness"]}'::jsonb,
 '{"type": "object", "properties": {"evaluation_mode": {"type": "string", "enum": ["pointwise", "pairwise", "listwise"]}}}'::jsonb,
 'prompt', 'Judge these responses to the question:\n\nQuestion: {{original_prompt}}\n\n{{#each responses}}Response {{@index}}: {{this}}\n\n{{/each}}\n\nEvaluate each on: {{criteria}}\n\nOutput: BEST: [number], SCORE: [0-1], REASONING: [explanation]', 'judge',
 ARRAY['openai/o1', 'anthropic/claude-3-5-sonnet-20241022']),

('VERIFY_FACTS', 'Verify Factual Claims', 'Extract and verify factual claims in a response', 'verification',
 '{"extraction_method": "explicit", "verification_depth": "thorough"}'::jsonb,
 '{"type": "object", "properties": {"extraction_method": {"type": "string"}, "verification_depth": {"type": "string"}}}'::jsonb,
 'prompt', 'Extract all factual claims from this response and verify each:\n\nResponse: {{response}}\n\nFor each claim:\n1. State the claim\n2. Verify if true/false/uncertain\n3. Provide evidence or reasoning\n4. Confidence level', 'verifier',
 ARRAY['openai/o1', 'anthropic/claude-3-5-sonnet-20241022']),

-- Synthesis Methods
('SYNTHESIZE_RESPONSES', 'Synthesize Multiple Responses', 'Combine best parts from multiple responses', 'synthesis',
 '{"combination_strategy": "best_parts", "conflict_resolution": "majority"}'::jsonb,
 '{"type": "object", "properties": {"combination_strategy": {"type": "string"}, "conflict_resolution": {"type": "string"}}}'::jsonb,
 'prompt', 'Synthesize these responses into one superior response:\n\nQuestion: {{original_prompt}}\n\n{{#each responses}}Response from {{model}}: {{content}}\n\n{{/each}}\n\nCreate a response that:\n1. Takes the best, most accurate parts from each\n2. Resolves any conflicts\n3. Is comprehensive and well-organized', 'synthesizer',
 ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o']),

('BUILD_CONSENSUS', 'Build Consensus', 'Identify points of agreement across multiple responses', 'synthesis',
 '{"consensus_threshold": 0.7, "include_disputed": true}'::jsonb,
 '{"type": "object", "properties": {"consensus_threshold": {"type": "number"}, "include_disputed": {"type": "boolean"}}}'::jsonb,
 'prompt', 'Analyze these responses and identify consensus:\n\n{{#each responses}}Response {{@index}}: {{this}}\n\n{{/each}}\n\nIdentify:\n1. Points agreed by {{consensus_threshold}}%+ of responses\n2. Disputed points\n3. Unique insights\n\nBuild a response using only consensus points.', 'synthesizer',
 ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o']),

-- Debate/Challenge Methods
('GENERATE_CHALLENGE', 'Generate Challenge', 'Challenge a response by arguing the opposite position', 'evaluation',
 '{"challenge_intensity": "moderate", "focus": "weakest_points"}'::jsonb,
 '{"type": "object", "properties": {"challenge_intensity": {"type": "string"}, "focus": {"type": "string"}}}'::jsonb,
 'prompt', 'Challenge this response by arguing against it:\n\nOriginal Question: {{original_prompt}}\nResponse: {{response}}\n\nProvide strong counter-arguments focusing on:\n1. Weakest logical points\n2. Alternative interpretations\n3. Missing perspectives\n4. Potential errors', 'challenger',
 ARRAY['openai/o1', 'anthropic/claude-3-5-sonnet-20241022']),

('DEFEND_POSITION', 'Defend Position', 'Defend a response against challenges', 'evaluation',
 '{"defense_strategy": "address_all", "concede_valid": true}'::jsonb,
 '{"type": "object", "properties": {"defense_strategy": {"type": "string"}, "concede_valid": {"type": "boolean"}}}'::jsonb,
 'prompt', 'Defend this response against the challenge:\n\nOriginal Response: {{response}}\nChallenge: {{challenge}}\n\n1. Address each challenge point\n2. Concede if the challenge is valid\n3. Strengthen the response where needed\n4. Provide an improved response if necessary', 'defender',
 ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o']),

-- Routing Methods
('DETECT_TASK_TYPE', 'Detect Task Type', 'Analyze prompt to determine task type and complexity', 'routing',
 '{"task_categories": ["coding", "reasoning", "creative", "factual", "math", "research"]}'::jsonb,
 '{"type": "object", "properties": {"task_categories": {"type": "array"}}}'::jsonb,
 'prompt', 'Analyze this prompt and classify it:\n\nPrompt: {{prompt}}\n\nDetermine:\n1. Primary task type: {{task_categories}}\n2. Complexity: trivial/simple/moderate/complex/expert\n3. Required capabilities\n4. Recommended approach', 'router',
 ARRAY['openai/gpt-4o-mini', 'anthropic/claude-3-5-haiku-20241022']),

('SELECT_BEST_MODEL', 'Select Best Model', 'Choose the optimal model for a given task', 'routing',
 '{"consider_cost": true, "consider_latency": true, "quality_priority": 0.7}'::jsonb,
 '{"type": "object", "properties": {"consider_cost": {"type": "boolean"}, "quality_priority": {"type": "number"}}}'::jsonb,
 'code', 'model-selection-service.selectBestModel', 'router',
 ARRAY['openai/gpt-4o-mini']),

-- Refinement Methods
('REFINE_RESPONSE', 'Refine Response', 'Improve a response based on feedback', 'generation',
 '{"refinement_focus": "all", "preserve_structure": true}'::jsonb,
 '{"type": "object", "properties": {"refinement_focus": {"type": "string"}, "preserve_structure": {"type": "boolean"}}}'::jsonb,
 'prompt', 'Improve this response based on the feedback:\n\nOriginal Response: {{response}}\n\nFeedback: {{feedback}}\n\nProvide an improved response that addresses all feedback while maintaining the good parts.', 'generator',
 ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o']),

-- Decomposition Methods
('DECOMPOSE_PROBLEM', 'Decompose Problem', 'Break down a complex problem into sub-problems', 'reasoning',
 '{"max_subproblems": 5, "decomposition_strategy": "functional"}'::jsonb,
 '{"type": "object", "properties": {"max_subproblems": {"type": "integer"}, "decomposition_strategy": {"type": "string"}}}'::jsonb,
 'prompt', 'Decompose this problem into smaller sub-problems:\n\nProblem: {{prompt}}\n\n1. Identify independent components\n2. Order by dependency\n3. Estimate complexity of each\n4. Return structured decomposition', 'reasoner',
 ARRAY['openai/o1', 'anthropic/claude-3-5-sonnet-20241022']),

-- Reflection Methods
('SELF_REFLECT', 'Self Reflect', 'AI reflects on its own response to identify improvements', 'evaluation',
 '{"reflection_depth": "thorough", "aspects": ["accuracy", "completeness", "clarity"]}'::jsonb,
 '{"type": "object", "properties": {"reflection_depth": {"type": "string"}, "aspects": {"type": "array"}}}'::jsonb,
 'prompt', 'Reflect on your response:\n\nQuestion: {{original_prompt}}\nYour Response: {{response}}\n\nCritically evaluate:\n1. What did you do well?\n2. What could be improved?\n3. What might be wrong?\n4. What''s missing?\n\nProvide specific improvements.', 'critic',
 ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/o1']),

-- Aggregation Methods
('MAJORITY_VOTE', 'Majority Vote', 'Select the most common answer from multiple responses', 'aggregation',
 '{"vote_method": "exact_match", "tie_breaker": "first"}'::jsonb,
 '{"type": "object", "properties": {"vote_method": {"type": "string"}, "tie_breaker": {"type": "string"}}}'::jsonb,
 'code', 'aggregation-service.majorityVote', 'aggregator',
 ARRAY[]),

('WEIGHTED_AGGREGATE', 'Weighted Aggregate', 'Combine responses weighted by confidence/expertise', 'aggregation',
 '{"weight_by": "confidence", "normalize": true}'::jsonb,
 '{"type": "object", "properties": {"weight_by": {"type": "string"}, "normalize": {"type": "boolean"}}}'::jsonb,
 'code', 'aggregation-service.weightedAggregate', 'aggregator',
 ARRAY[])

ON CONFLICT (method_code) DO NOTHING;

-- ============================================================================
-- SEED: ALL 49 ORCHESTRATION WORKFLOWS
-- ============================================================================

-- CATEGORY 1: Adversarial & Validation Patterns
INSERT INTO orchestration_workflows (workflow_code, common_name, formal_name, category, category_code, pattern_number, description, best_for, problem_indicators, quality_improvement, typical_latency, typical_cost, min_models_required) VALUES
('ARE', 'Red Team Attack', 'Adversarial Robustness Evaluation', 'Adversarial & Validation', 'adversarial', 1,
 'One AI probes another for vulnerabilities, safety failures, and edge cases',
 ARRAY['security_testing', 'safety_validation', 'edge_case_discovery', 'robustness_testing'],
 ARRAY['safety_critical', 'needs_validation', 'security_concern', 'untrusted_input'],
 'Identifies 80-95% of vulnerabilities', 'high', 'high', 2),

('LM_VS_LM', 'Cross-Examination', 'LM vs LM Factual Verification', 'Adversarial & Validation', 'adversarial', 2,
 'Interrogator AI repeatedly questions responder AI''s claims to expose inconsistencies and hallucinations',
 ARRAY['fact_checking', 'claim_verification', 'hallucination_detection', 'interview_simulation'],
 ARRAY['factual_claims', 'needs_verification', 'potential_hallucination', 'complex_reasoning'],
 'Reduces hallucinations by 40-60%', 'high', 'high', 2),

-- CATEGORY 2: Debate & Deliberation Patterns
('SOD', 'AI Debate', 'Scalable Oversight via Debate', 'Debate & Deliberation', 'debate', 3,
 'Two AIs argue opposing positions to convince a judge; truthful arguments should win',
 ARRAY['controversial_topics', 'decision_making', 'policy_analysis', 'ethical_dilemmas'],
 ARRAY['multiple_viewpoints', 'controversial', 'needs_balanced_view', 'complex_decision'],
 'Improves decision quality by 25-35%', 'very_high', 'very_high', 3),

('MDA', 'Multi-Agent Debate', 'Multiagent Deliberative Alignment', 'Debate & Deliberation', 'debate', 4,
 'Multiple LLM instances propose, critique, and refine until consensus',
 ARRAY['complex_problems', 'consensus_building', 'brainstorming', 'research_synthesis'],
 ARRAY['needs_consensus', 'multiple_approaches', 'collaborative_task', 'complex_problem'],
 'Consensus quality +30-45%', 'very_high', 'very_high', 3),

('ReConcile', 'Round Table Consensus', 'Reconciled Ensemble Deliberation', 'Debate & Deliberation', 'debate', 5,
 'Heterogeneous models from different providers reconcile viewpoints iteratively',
 ARRAY['cross_provider_synthesis', 'bias_reduction', 'comprehensive_analysis', 'balanced_output'],
 ARRAY['provider_bias_concern', 'needs_diversity', 'comprehensive_coverage', 'balanced_perspective'],
 'Reduces provider bias by 50-70%', 'very_high', 'high', 3),

-- CATEGORY 3: Judge & Critic Patterns
('LAAJE', 'AI Judge', 'LLM-as-a-Judge Evaluation', 'Judge & Critic', 'judge', 6,
 'Designated AI evaluates outputs using pointwise, pairwise, or listwise modes',
 ARRAY['quality_evaluation', 'comparison', 'ranking', 'selection'],
 ARRAY['multiple_options', 'needs_ranking', 'quality_assessment', 'best_selection'],
 'Evaluation accuracy 85-95%', 'medium', 'medium', 2),

('RLAIF', 'Constitutional Critic', 'Reinforcement Learning from AI Feedback', 'Judge & Critic', 'judge', 7,
 'AI critiques/revises against explicit principles; Constitutional AI pattern',
 ARRAY['safety_alignment', 'policy_compliance', 'ethical_review', 'guideline_adherence'],
 ARRAY['needs_alignment', 'policy_check', 'ethical_concern', 'compliance_required'],
 'Alignment improvement 60-80%', 'high', 'medium', 2),

('IREF', 'Critique-Revise Loop', 'Iterative Refinement with External Feedback', 'Judge & Critic', 'judge', 8,
 'Generator → Critic identifies flaws → Generator revises; repeats until quality threshold',
 ARRAY['iterative_improvement', 'quality_refinement', 'error_correction', 'polish'],
 ARRAY['needs_refinement', 'quality_critical', 'iterative_task', 'perfectionist'],
 'Quality improvement per iteration: 15-25%', 'high', 'high', 2),

-- CATEGORY 4: Ensemble & Aggregation Patterns
('SCMR', 'Majority Vote', 'Self-Consistency via Marginal Reasoning', 'Ensemble & Aggregation', 'ensemble', 9,
 'Same prompt to N instances, select most common answer',
 ARRAY['factual_questions', 'multiple_choice', 'classification', 'simple_reasoning'],
 ARRAY['objective_answer', 'clear_correct_answer', 'factual_query', 'classification_task'],
 '+15-25% accuracy on factual tasks', 'medium', 'medium', 3),

('CWMA', 'Weighted Ensemble', 'Confidence-Weighted Model Aggregation', 'Ensemble & Aggregation', 'ensemble', 10,
 'Weight model contributions by confidence, accuracy, or domain expertise',
 ARRAY['domain_expertise', 'confidence_critical', 'weighted_synthesis', 'expert_combination'],
 ARRAY['domain_specific', 'expertise_required', 'confidence_matters', 'specialized_knowledge'],
 '+20-35% over simple averaging', 'medium', 'medium', 3),

('SMoE', 'Mixture Router', 'Sparse Mixture-of-Experts Routing', 'Ensemble & Aggregation', 'ensemble', 11,
 'Lightweight router selects specialist AI(s) per input',
 ARRAY['routing', 'specialization', 'efficiency', 'domain_detection'],
 ARRAY['unknown_domain', 'needs_specialist', 'efficiency_critical', 'variable_task_type'],
 'Cost reduction 40-60% with same quality', 'low', 'low', 2),

-- CATEGORY 5: Reflection & Self-Improvement Patterns
('ISFR', 'Self-Refine Loop', 'Iterative Self-Feedback Refinement', 'Reflection & Self-Improvement', 'reflection', 12,
 'AI generates → self-critiques → refines until satisfactory',
 ARRAY['writing', 'code_improvement', 'iterative_tasks', 'quality_improvement'],
 ARRAY['needs_polish', 'iterative_improvement', 'quality_critical', 'refinement_needed'],
 '+20-30% quality per iteration', 'high', 'medium', 1),

('VRL', 'Reflexion Agent', 'Verbal Reinforcement Learning', 'Reflection & Self-Improvement', 'reflection', 13,
 'Agent reflects on failures, stores insights in episodic memory, improves without gradients',
 ARRAY['agentic_tasks', 'learning_from_failure', 'adaptive_behavior', 'long_term_improvement'],
 ARRAY['repeated_task', 'learning_opportunity', 'failure_recovery', 'adaptive_needed'],
 '+30-50% on repeated tasks', 'high', 'medium', 1),

('LATS', 'Tree Search Reasoning', 'Language Agent Tree Search', 'Reflection & Self-Improvement', 'reflection', 14,
 'Monte-Carlo tree search exploring reasoning paths with backpropagation',
 ARRAY['complex_reasoning', 'planning', 'search_problems', 'optimization'],
 ARRAY['search_problem', 'multiple_paths', 'optimization', 'complex_planning'],
 '4%→74% on puzzle tasks', 'very_high', 'very_high', 1),

-- CATEGORY 6: Verification & Fact-Checking Patterns
('CoVe', 'Chain of Verification', 'Stepwise Verification Prompting', 'Verification & Fact-Checking', 'verification', 15,
 'Draft → generate verification questions → answer independently → verified output',
 ARRAY['fact_checking', 'claim_verification', 'accuracy_critical', 'research'],
 ARRAY['factual_claims', 'needs_verification', 'accuracy_critical', 'research_output'],
 'Reduces factual errors by 30-50%', 'high', 'medium', 1),

('SelfRAG', 'Retrieval-Augmented Verification', 'Self-Reflective RAG', 'Verification & Fact-Checking', 'verification', 16,
 'AI self-critiques, fetches documents if needed, validates against evidence',
 ARRAY['research', 'fact_checking', 'document_based', 'evidence_required'],
 ARRAY['needs_sources', 'research_task', 'evidence_based', 'document_analysis'],
 'Factual accuracy +40-60%', 'high', 'medium', 1),

-- CATEGORY 7: Multi-Agent Collaboration Patterns
('LLM_MAS', 'Agent Team', 'LLM-based Multi-Agent Systems', 'Multi-Agent Collaboration', 'collaboration', 17,
 'Specialized agents with distinct roles collaborate via natural language',
 ARRAY['complex_projects', 'multi_skill', 'collaborative', 'project_management'],
 ARRAY['multi_disciplinary', 'complex_project', 'needs_coordination', 'diverse_skills'],
 'Complex task completion +40-60%', 'very_high', 'high', 3),

('MAPR', 'Peer Review Pipeline', 'Multi-Agent Peer Review', 'Multi-Agent Collaboration', 'collaboration', 18,
 'Sequential review chain where each agent reviews prior agent''s work',
 ARRAY['document_review', 'quality_assurance', 'sequential_improvement', 'editorial'],
 ARRAY['needs_review', 'quality_critical', 'sequential_task', 'editorial_process'],
 'Error reduction 50-70%', 'high', 'high', 3),

-- CATEGORY 8: Reasoning Enhancement Patterns
('CoT', 'Chain-of-Thought', 'CoT Prompting', 'Reasoning Enhancement', 'reasoning', 19,
 'Step-by-step reasoning before final answer',
 ARRAY['math', 'logic', 'reasoning', 'problem_solving'],
 ARRAY['requires_reasoning', 'multi_step', 'logical_problem', 'math_problem'],
 '+20-40% on math/logic', 'medium', 'medium', 1),

('ZeroShotCoT', 'Zero-Shot CoT', '"Let''s think step by step"', 'Reasoning Enhancement', 'reasoning', 20,
 'Add "Let''s think step by step" to prompt without examples',
 ARRAY['general_reasoning', 'quick_improvement', 'no_examples_available'],
 ARRAY['reasoning_needed', 'no_examples', 'general_question'],
 '+15-30% without examples', 'low', 'low', 1),

('ToT', 'Tree-of-Thoughts', 'ToT with BFS/DFS', 'Reasoning Enhancement', 'reasoning', 21,
 'Explore multiple reasoning paths with breadth/depth-first search',
 ARRAY['puzzles', 'creative_writing', 'planning', 'exploration'],
 ARRAY['multiple_solutions', 'creative_task', 'exploration_needed', 'puzzle'],
 '4%→74% on puzzles', 'very_high', 'very_high', 1),

('GoT', 'Graph-of-Thoughts', 'GoT Synthesis', 'Reasoning Enhancement', 'reasoning', 22,
 'Thought units as graph nodes with arbitrary connections',
 ARRAY['complex_synthesis', 'interconnected_reasoning', 'sorting', 'complex_logic'],
 ARRAY['complex_relationships', 'synthesis_needed', 'interconnected_concepts'],
 '+62% over ToT on sorting', 'very_high', 'very_high', 1),

('ReAct', 'ReAct', 'Reasoning + Acting', 'Reasoning Enhancement', 'reasoning', 23,
 'Interleave reasoning and acting with external tools',
 ARRAY['tool_use', 'interactive_tasks', 'research', 'agentic'],
 ARRAY['needs_tools', 'interactive', 'external_data', 'agentic_task'],
 '+34% on interactive tasks', 'high', 'medium', 1),

('L2M', 'Least-to-Most', 'Decomposition Prompting', 'Reasoning Enhancement', 'reasoning', 24,
 'Decompose problem into subproblems, solve smallest first',
 ARRAY['compositional', 'hierarchical', 'step_building'],
 ARRAY['compositional_task', 'can_decompose', 'builds_on_previous'],
 '16%→99% on SCAN', 'high', 'medium', 1),

('PS', 'Plan-and-Solve', 'Explicit Planning', 'Reasoning Enhancement', 'reasoning', 25,
 'Devise plan then execute step by step',
 ARRAY['complex_tasks', 'planning', 'structured_problems'],
 ARRAY['needs_planning', 'complex_execution', 'structured_approach'],
 'Matches 8-shot CoT', 'medium', 'medium', 1),

('MCP', 'Metacognitive Prompting', '5-stage reflection', 'Reasoning Enhancement', 'reasoning', 26,
 'Understand, decompose, execute, self-verify, refine',
 ARRAY['nlu', 'comprehension', 'thorough_analysis'],
 ARRAY['comprehension_critical', 'needs_verification', 'thorough_needed'],
 'Beats CoT on NLU', 'high', 'medium', 1),

('PoT', 'Program-of-Thought', 'Code-based Reasoning', 'Reasoning Enhancement', 'reasoning', 27,
 'Generate code to solve math problems',
 ARRAY['math', 'computation', 'algorithmic'],
 ARRAY['mathematical', 'needs_computation', 'algorithmic_solution'],
 'For mathematical computation', 'medium', 'low', 1),

-- CATEGORY 9: Model Routing Strategies
('SINGLE', 'Single Model', 'Primary model only', 'Model Routing Strategies', 'routing', 28,
 'Route to single best model for fastest response',
 ARRAY['simple_tasks', 'speed_critical', 'cost_sensitive'],
 ARRAY['simple_task', 'speed_priority', 'cost_priority'],
 'Fastest, lowest cost', 'low', 'low', 1),

('ENSEMBLE', 'Ensemble', 'Query multiple, synthesize', 'Model Routing Strategies', 'routing', 29,
 'Query multiple models and synthesize results with conflict detection',
 ARRAY['important_decisions', 'quality_critical', 'diverse_perspectives'],
 ARRAY['quality_priority', 'needs_diversity', 'important_task'],
 'Best overall quality', 'high', 'high', 3),

('CASCADE', 'Cascade', 'Escalate on low confidence', 'Model Routing Strategies', 'routing', 30,
 'Start with cheap model, escalate to better if confidence below threshold',
 ARRAY['variable_complexity', 'cost_optimization', 'adaptive'],
 ARRAY['unknown_complexity', 'cost_conscious', 'adaptive_quality'],
 'Cost reduction 40-60%', 'variable', 'low', 2),

('SPECIALIST', 'Specialist Routing', 'Route to domain expert', 'Model Routing Strategies', 'routing', 31,
 'Route to best model per content type/domain',
 ARRAY['domain_specific', 'specialized_tasks', 'expert_needed'],
 ARRAY['specific_domain', 'expert_knowledge', 'specialized_task'],
 'Best domain performance', 'medium', 'medium', 2),

-- CATEGORY 10: Domain-Specific Orchestration
('DOMAIN_INJECT', 'Domain Expert Injection', 'Prepend domain prompts', 'Domain-Specific Orchestration', 'domain', 32,
 'Prepend domain-specific system prompts based on 800+ domain routing',
 ARRAY['domain_tasks', 'specialized_knowledge', 'professional_contexts'],
 ARRAY['domain_specific', 'professional_context', 'specialized_knowledge'],
 'Domain accuracy +20-40%', 'low', 'low', 1),

('MULTI_EXPERT', 'Multi-Expert Consensus', 'Multiple domain experts', 'Domain-Specific Orchestration', 'domain', 33,
 'Route to multiple domain experts, synthesize',
 ARRAY['complex_domain', 'cross_functional', 'expert_consensus'],
 ARRAY['multi_domain', 'expert_critical', 'consensus_needed'],
 'Expert consensus quality +30%', 'high', 'high', 3),

('CHALLENGER_CONSENSUS', 'Challenger + Consensus', 'Baseline then challenge', 'Domain-Specific Orchestration', 'domain', 34,
 'Baseline round → Challenger round questioning assumptions → Synthesis',
 ARRAY['assumption_testing', 'robust_analysis', 'critical_thinking'],
 ARRAY['assumptions_present', 'needs_challenge', 'robust_required'],
 'Removes blind spots +40%', 'high', 'high', 2),

('CROSS_DOMAIN', 'Cross-Domain Synthesis', 'Multi-domain merge', 'Domain-Specific Orchestration', 'domain', 35,
 'Detect multi-domain queries, route to each expert, merge insights',
 ARRAY['interdisciplinary', 'cross_functional', 'holistic_analysis'],
 ARRAY['multi_domain', 'interdisciplinary', 'holistic_needed'],
 'Cross-domain insight +50%', 'high', 'high', 3),

-- CATEGORY 11: Cognitive Frameworks
('FIRST_PRINCIPLES', 'First Principles Thinking', 'Decompose to fundamentals', 'Cognitive Frameworks', 'cognitive', 36,
 'Decompose problem to fundamental truths and rebuild solution',
 ARRAY['innovation', 'fundamental_analysis', 'breakthrough_thinking'],
 ARRAY['needs_innovation', 'fundamental_question', 'conventional_failed'],
 'Novel solutions +60%', 'high', 'medium', 1),

('ANALOGICAL', 'Analogical Reasoning', 'Cross-domain patterns', 'Cognitive Frameworks', 'cognitive', 37,
 'Find analogies from other domains to solve current problem',
 ARRAY['creative_solutions', 'cross_domain', 'pattern_matching'],
 ARRAY['stuck_on_problem', 'needs_creativity', 'pattern_available'],
 'Creative solutions +40%', 'medium', 'medium', 1),

('SYSTEMS', 'Systems Thinking', 'Feedback loops, emergence', 'Cognitive Frameworks', 'cognitive', 38,
 'Analyze as interconnected system with feedback loops and emergent properties',
 ARRAY['complex_systems', 'organizational', 'ecosystem_analysis'],
 ARRAY['complex_system', 'interconnected', 'feedback_present'],
 'System understanding +50%', 'high', 'medium', 1),

('SOCRATIC', 'Socratic Method', 'Dialectical questioning', 'Cognitive Frameworks', 'cognitive', 39,
 'Use probing questions to stimulate critical thinking and illuminate ideas',
 ARRAY['learning', 'clarification', 'deep_understanding'],
 ARRAY['needs_clarity', 'learning_context', 'deep_dive'],
 'Understanding depth +40%', 'medium', 'medium', 1),

('TRIZ', 'TRIZ', 'Contradiction resolution', 'Cognitive Frameworks', 'cognitive', 40,
 'Use contradiction matrices and 40 inventive principles',
 ARRAY['engineering', 'invention', 'contradiction_resolution'],
 ARRAY['contradiction_present', 'engineering_problem', 'invention_needed'],
 'Inventive solutions +70%', 'high', 'medium', 1),

('DESIGN_THINKING', 'Design Thinking', 'Empathize→Define→Ideate→Prototype→Test', 'Cognitive Frameworks', 'cognitive', 41,
 'Human-centered design process with iteration',
 ARRAY['product_design', 'user_experience', 'innovation'],
 ARRAY['user_focused', 'design_problem', 'needs_iteration'],
 'User satisfaction +50%', 'very_high', 'high', 1),

('SCIENTIFIC', 'Scientific Method', 'Hypothesis→Experiment→Analysis', 'Cognitive Frameworks', 'cognitive', 42,
 'Formulate hypothesis, design experiment, analyze results',
 ARRAY['research', 'investigation', 'empirical_questions'],
 ARRAY['testable_question', 'research_needed', 'empirical'],
 'Rigorous conclusions +60%', 'high', 'medium', 1),

('LATERAL', 'Lateral Thinking', 'Random entry, provocation', 'Cognitive Frameworks', 'cognitive', 43,
 'Use random stimuli and provocations to break conventional thinking',
 ARRAY['creativity', 'brainstorming', 'unconventional_solutions'],
 ARRAY['stuck_in_rut', 'needs_creativity', 'brainstorming'],
 'Creative breakthroughs +80%', 'medium', 'low', 1),

('ABDUCTIVE', 'Abductive Reasoning', 'Inference to best explanation', 'Cognitive Frameworks', 'cognitive', 44,
 'Generate and evaluate hypotheses to find best explanation',
 ARRAY['diagnosis', 'investigation', 'hypothesis_generation'],
 ARRAY['unexplained_phenomenon', 'diagnosis_needed', 'mystery'],
 'Explanation quality +40%', 'medium', 'medium', 1),

('COUNTERFACTUAL', 'Counterfactual Thinking', 'What-if analysis', 'Cognitive Frameworks', 'cognitive', 45,
 'Explore alternative scenarios and their implications',
 ARRAY['planning', 'risk_analysis', 'scenario_planning'],
 ARRAY['scenario_analysis', 'risk_assessment', 'planning'],
 'Risk identification +50%', 'high', 'medium', 1),

('DIALECTICAL', 'Dialectical Thinking', 'Thesis-antithesis-synthesis', 'Cognitive Frameworks', 'cognitive', 46,
 'Explore opposing views to reach higher synthesis',
 ARRAY['philosophy', 'conflict_resolution', 'synthesis'],
 ARRAY['opposing_views', 'conflict_present', 'synthesis_needed'],
 'Balanced conclusions +45%', 'high', 'medium', 1),

('MORPHOLOGICAL', 'Morphological Analysis', 'Parameter space exploration', 'Cognitive Frameworks', 'cognitive', 47,
 'Systematically explore all possible parameter combinations',
 ARRAY['systematic_exploration', 'option_generation', 'completeness'],
 ARRAY['many_parameters', 'systematic_needed', 'completeness_required'],
 'Option coverage +70%', 'high', 'medium', 1),

('PREMORTEM', 'Pre-mortem Analysis', 'Prospective hindsight', 'Cognitive Frameworks', 'cognitive', 48,
 'Imagine failure has occurred and work backwards to identify causes',
 ARRAY['risk_management', 'project_planning', 'failure_prevention'],
 ARRAY['project_start', 'risk_critical', 'planning_phase'],
 'Risk mitigation +60%', 'medium', 'low', 1),

('FERMI', 'Fermi Estimation', 'Order of magnitude reasoning', 'Cognitive Frameworks', 'cognitive', 49,
 'Break down estimation into smaller, estimable components',
 ARRAY['estimation', 'quick_analysis', 'order_of_magnitude'],
 ARRAY['unknown_quantity', 'estimation_needed', 'limited_data'],
 'Estimation accuracy +50%', 'low', 'low', 1)

ON CONFLICT (workflow_code) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE orchestration_methods IS 'Shared reusable methods with default parameters that can be used in any workflow';
COMMENT ON TABLE orchestration_workflows IS 'The 49 documented orchestration patterns plus user-defined workflows';
COMMENT ON TABLE workflow_method_bindings IS 'Links methods to workflows with step-specific parameter overrides';
COMMENT ON TABLE workflow_customizations IS 'Tenant-level customizations of system workflows';
