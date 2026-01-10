-- Migration: 157_orchestration_methods_part1.sql
-- RADIANT v4.18.0 - Schema Updates and User Workflow Templates

-- ============================================================================
-- SCHEMA UPDATES: Add display_name and scientific_name to methods
-- ============================================================================

ALTER TABLE orchestration_methods 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS scientific_name VARCHAR(300),
ADD COLUMN IF NOT EXISTS research_reference TEXT,
ADD COLUMN IF NOT EXISTS accuracy_improvement VARCHAR(200),
ADD COLUMN IF NOT EXISTS complexity_level VARCHAR(50) DEFAULT 'moderate';

-- Update existing methods with display/scientific names
UPDATE orchestration_methods SET display_name = 'Generate', scientific_name = 'Basic Generation', complexity_level = 'simple' WHERE method_code = 'GENERATE_RESPONSE';
UPDATE orchestration_methods SET display_name = 'Think Step-by-Step', scientific_name = 'Chain-of-Thought Generation', research_reference = 'Wei et al. 2022', accuracy_improvement = '+20-40% on reasoning', complexity_level = 'moderate' WHERE method_code = 'GENERATE_WITH_COT';
UPDATE orchestration_methods SET display_name = 'Critique', scientific_name = 'Critical Evaluation', complexity_level = 'moderate' WHERE method_code = 'CRITIQUE_RESPONSE';
UPDATE orchestration_methods SET display_name = 'Judge', scientific_name = 'Comparative Judgment', complexity_level = 'moderate' WHERE method_code = 'JUDGE_RESPONSES';
UPDATE orchestration_methods SET display_name = 'Fact Check', scientific_name = 'Factual Verification', complexity_level = 'moderate' WHERE method_code = 'VERIFY_FACTS';
UPDATE orchestration_methods SET display_name = 'Synthesize', scientific_name = 'Multi-Response Synthesis', complexity_level = 'moderate' WHERE method_code = 'SYNTHESIZE_RESPONSES';
UPDATE orchestration_methods SET display_name = 'Consensus', scientific_name = 'Consensus Aggregation', complexity_level = 'moderate' WHERE method_code = 'BUILD_CONSENSUS';
UPDATE orchestration_methods SET display_name = 'Challenge', scientific_name = 'Adversarial Challenge', complexity_level = 'moderate' WHERE method_code = 'GENERATE_CHALLENGE';
UPDATE orchestration_methods SET display_name = 'Defend', scientific_name = 'Position Defense', complexity_level = 'moderate' WHERE method_code = 'DEFEND_POSITION';
UPDATE orchestration_methods SET display_name = 'Classify', scientific_name = 'Task Classification', complexity_level = 'simple' WHERE method_code = 'DETECT_TASK_TYPE';
UPDATE orchestration_methods SET display_name = 'Route', scientific_name = 'Model Selection', complexity_level = 'simple' WHERE method_code = 'SELECT_BEST_MODEL';
UPDATE orchestration_methods SET display_name = 'Refine', scientific_name = 'Iterative Refinement', complexity_level = 'moderate' WHERE method_code = 'REFINE_RESPONSE';
UPDATE orchestration_methods SET display_name = 'Decompose', scientific_name = 'Problem Decomposition', complexity_level = 'moderate' WHERE method_code = 'DECOMPOSE_PROBLEM';
UPDATE orchestration_methods SET display_name = 'Reflect', scientific_name = 'Self-Reflection', complexity_level = 'moderate' WHERE method_code = 'SELF_REFLECT';
UPDATE orchestration_methods SET display_name = 'Vote', scientific_name = 'Majority Aggregation', complexity_level = 'simple' WHERE method_code = 'MAJORITY_VOTE';
UPDATE orchestration_methods SET display_name = 'Weight', scientific_name = 'Weighted Aggregation', complexity_level = 'simple' WHERE method_code = 'WEIGHTED_AGGREGATE';

-- ============================================================================
-- USER WORKFLOW TEMPLATES - Allow users to save and reuse workflows
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_workflow_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    template_name VARCHAR(200) NOT NULL,
    template_description TEXT,
    
    base_workflow_id UUID REFERENCES orchestration_workflows(workflow_id),
    base_workflow_code VARCHAR(100),
    
    workflow_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    
    is_shared BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    share_approved_at TIMESTAMPTZ,
    share_approved_by UUID,
    
    times_used INTEGER DEFAULT 0,
    avg_quality_score DECIMAL(5,4),
    last_used_at TIMESTAMPTZ,
    
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, user_id, template_name)
);

CREATE INDEX IF NOT EXISTS idx_user_workflow_templates_tenant ON user_workflow_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_workflow_templates_user ON user_workflow_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workflow_templates_base ON user_workflow_templates(base_workflow_code);

-- ============================================================================
-- NEW METHODS: Debate & Deliberation (4 methods)
-- ============================================================================

INSERT INTO orchestration_methods (method_code, display_name, scientific_name, method_name, description, method_category, default_parameters, parameter_schema, implementation_type, prompt_template, model_role, recommended_models, research_reference, accuracy_improvement, complexity_level) VALUES

('SPARSE_DEBATE', 'Efficient Debate', 'Sparse Communication Topology Debate', 'Sparse Debate', 
 'Agents connect in sparse patterns (ring, star, tree) to reduce communication cost',
 'debate', '{"topology": "ring", "debate_rounds": 3, "temperature": 0.7}'::jsonb,
 '{"type": "object", "properties": {"topology": {"type": "string", "enum": ["ring", "star", "tree", "full"]}, "debate_rounds": {"type": "integer", "min": 1, "max": 10}}}'::jsonb,
 'composite', 'Debate topology: {{topology}}\nQuestion: {{prompt}}\nYou are Agent {{agent_id}}. Previous: {{history}}\nProvide your argument.',
 'debater', ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o'],
 'Sparse Communication Networks for Multi-Agent Debate', '-40-60% cost with <5% quality loss', 'advanced'),

('ARG_MAPPING', 'Attack & Support Mapping', 'ArgLLMs Quantitative Bipolar Argumentation', 'Argument Mapping',
 'Build explicit attack/support relations between arguments with strength scores',
 'debate', '{"strength_threshold": 0.5, "include_rebuttal": true, "max_depth": 3}'::jsonb,
 '{"type": "object", "properties": {"strength_threshold": {"type": "number"}, "include_rebuttal": {"type": "boolean"}, "max_depth": {"type": "integer"}}}'::jsonb,
 'composite', 'Analyze arguments:\nClaim: {{claim}}\nFor each pair: relation type, strength 0-1, reasoning.',
 'analyst', ARRAY['openai/o1', 'anthropic/claude-3-5-sonnet-20241022'],
 'Imperial College London 2024 - ArgLLMs', 'Structured argumentation +35%', 'advanced'),

('HAH_DELPHI', 'Human-AI Expert Panel', 'HAH-Delphi Human-AI Hybrid Consensus', 'Human-AI Delphi',
 'Four-tier Delphi consensus combining AI with human expert oversight',
 'debate', '{"tiers": 4, "human_threshold": 0.6, "consensus_target": 0.9, "max_rounds": 5}'::jsonb,
 '{"type": "object", "properties": {"tiers": {"type": "integer"}, "human_threshold": {"type": "number"}, "consensus_target": {"type": "number"}}}'::jsonb,
 'composite', 'HAH-Delphi Round {{round}}\nQuestion: {{prompt}}\nPrevious consensus: {{prev_consensus}}',
 'expert', ARRAY['openai/o1', 'anthropic/claude-3-5-sonnet-20241022'],
 'HAH-Delphi Aug 2025', '>90% coverage on expert decisions', 'expert'),

('RECONCILE_WEIGHTED', 'Confidence-Weighted Agreement', 'ReConcile Confidence-Weighted Consensus', 'Weighted Reconciliation',
 'Diverse LLMs weighted by verbalized confidence scores',
 'debate', '{"min_confidence": 0.6, "weight_by": "confidence", "reconciliation_rounds": 2}'::jsonb,
 '{"type": "object", "properties": {"min_confidence": {"type": "number"}, "weight_by": {"type": "string"}}}'::jsonb,
 'composite', 'Question: {{prompt}}\nRESPONSE: [answer]\nCONFIDENCE: [0-1]\nREASONING: [why]',
 'responder', ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o'],
 'ACL 2024 - ReConcile', '+15-25% on diverse model ensembles', 'moderate')

ON CONFLICT (method_code) DO UPDATE SET display_name = EXCLUDED.display_name, scientific_name = EXCLUDED.scientific_name;

-- ============================================================================
-- NEW METHODS: Judge & Critic (3 methods)
-- ============================================================================

INSERT INTO orchestration_methods (method_code, display_name, scientific_name, method_name, description, method_category, default_parameters, parameter_schema, implementation_type, prompt_template, model_role, recommended_models, research_reference, accuracy_improvement, complexity_level) VALUES

('POLL_JUDGE', 'Multi-Judge Panel', 'Panel of LLMs Evaluation', 'PoLL Judge',
 'Multiple diverse judge models evaluate outputs independently',
 'evaluation', '{"num_judges": 3, "scoring_criteria": ["accuracy", "completeness", "clarity"], "aggregation": "mean"}'::jsonb,
 '{"type": "object", "properties": {"num_judges": {"type": "integer"}, "scoring_criteria": {"type": "array"}, "aggregation": {"type": "string"}}}'::jsonb,
 'composite', 'You are Judge {{judge_id}}.\nQuestion: {{original_prompt}}\nResponse: {{response}}\nScore each criterion 1-10.',
 'judge', ARRAY['openai/o1', 'anthropic/claude-3-5-sonnet-20241022'],
 'Panel of LLMs Evaluation Framework', 'Reduces single-model bias 40-60%', 'moderate'),

('G_EVAL', 'Structured Scoring', 'G-Eval NLG Evaluation Framework', 'G-Eval Scoring',
 'Chain-of-thought scoring for NLG across coherence, consistency, fluency, relevance',
 'evaluation', '{"dimensions": ["coherence", "consistency", "fluency", "relevance"], "use_cot": true, "score_range": [1, 5]}'::jsonb,
 '{"type": "object", "properties": {"dimensions": {"type": "array"}, "use_cot": {"type": "boolean"}, "score_range": {"type": "array"}}}'::jsonb,
 'prompt', 'Evaluate using G-Eval:\nSource: {{source}}\nGenerated: {{generated}}\nFor each dimension, think then score.',
 'evaluator', ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
 'G-Eval: NLG Evaluation using GPT-4', 'Correlates 0.5+ with human judgment', 'moderate'),

('PAIRWISE_PREFER', 'Head-to-Head Compare', 'Pairwise Preference Judgment', 'Pairwise Comparison',
 'Compare two outputs head-to-head for reliable relative ranking',
 'evaluation', '{"comparison_criteria": ["quality", "accuracy", "helpfulness"], "allow_tie": true}'::jsonb,
 '{"type": "object", "properties": {"comparison_criteria": {"type": "array"}, "allow_tie": {"type": "boolean"}}}'::jsonb,
 'prompt', 'Compare:\nA: {{response_a}}\nB: {{response_b}}\nVERDICT: [A/B/TIE]\nKEY DIFFERENTIATOR: [reason]',
 'judge', ARRAY['openai/o1', 'anthropic/claude-3-5-sonnet-20241022'],
 'Pairwise Preference Learning', 'More reliable for subtle differences', 'simple')

ON CONFLICT (method_code) DO UPDATE SET display_name = EXCLUDED.display_name, scientific_name = EXCLUDED.scientific_name;
