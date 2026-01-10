-- Migration: 157_orchestration_methods_part3.sql
-- RADIANT v4.18.0 - Confidence, Hallucination, Routing, HITL, Neural Methods

-- ============================================================================
-- NEW METHODS: Confidence & Uncertainty (6 methods) - NEW CATEGORY
-- ============================================================================

INSERT INTO orchestration_methods (method_code, display_name, scientific_name, method_name, description, method_category, default_parameters, parameter_schema, implementation_type, prompt_template, model_role, recommended_models, research_reference, accuracy_improvement, complexity_level) VALUES

('SEMANTIC_ENTROPY', 'Meaning-Based Uncertainty', 'Semantic Entropy Quantification', 'Semantic Entropy',
 'Cluster semantically equivalent answers, compute entropy over meaning clusters',
 'uncertainty', '{"sample_count": 10, "temperature": 0.7, "clustering_method": "nli", "entropy_threshold": 0.5}'::jsonb,
 '{"type": "object", "properties": {"sample_count": {"type": "integer", "min": 5, "max": 20}, "temperature": {"type": "number"}, "clustering_method": {"type": "string", "enum": ["nli", "embedding", "exact"]}}}'::jsonb,
 'code', 'semantic-entropy-service.computeEntropy',
 'analyzer', ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
 'Nature 2024 - Semantic Uncertainty in LLMs', 'AUROC 0.79-0.87 hallucination detection', 'advanced'),

('CALIBRATED_CONF', 'Calibrated Confidence', 'Calibrated Confidence Estimation', 'Calibrated Confidence',
 'Elicit confidence via prompting and calibrate against accuracy',
 'uncertainty', '{"calibration_method": "platt_scaling", "confidence_prompt": "verbalized", "temperature": 0.3}'::jsonb,
 '{"type": "object", "properties": {"calibration_method": {"type": "string", "enum": ["platt_scaling", "isotonic", "temperature_scaling"]}, "confidence_prompt": {"type": "string"}}}'::jsonb,
 'composite', '{{prompt}}\nANSWER: [answer]\nCONFIDENCE: [0-100]%\nREASONING: [why]',
 'responder', ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
 'Calibrated Confidence Estimation Research', 'ECE -15%', 'moderate'),

('CONSISTENCY_UQ', 'Agreement Scoring', 'Consistency-Based Uncertainty Quantification', 'Consistency UQ',
 'Measure agreement across samples as uncertainty proxy',
 'uncertainty', '{"sample_count": 5, "agreement_metric": "jaccard", "threshold": 0.7}'::jsonb,
 '{"type": "object", "properties": {"sample_count": {"type": "integer"}, "agreement_metric": {"type": "string", "enum": ["jaccard", "cosine", "exact_match", "bertscore"]}}}'::jsonb,
 'code', 'consistency-uq-service.measureAgreement',
 'analyzer', ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
 'Consistency-Based UQ Research', 'Simple effective uncertainty', 'simple'),

('SE_PROBES', 'Fast Uncertainty Check', 'Semantic Entropy Probes', 'SE Probes',
 'Lightweight probes on hidden states for fast entropy estimation',
 'uncertainty', '{"probe_layers": [-1, -2], "threshold": 0.5, "fast_mode": true}'::jsonb,
 '{"type": "object", "properties": {"probe_layers": {"type": "array"}, "threshold": {"type": "number"}, "fast_mode": {"type": "boolean"}}}'::jsonb,
 'code', 'se-probes-service.estimateEntropy',
 'analyzer', ARRAY['self-hosted models'],
 'ICML 2024 - Semantic Entropy Probes', '300x faster, 90% accuracy', 'expert'),

('KERNEL_ENTROPY', 'Detailed Uncertainty Score', 'Kernel Language Entropy', 'Kernel Entropy',
 'Continuous entropy via kernel density estimation on embeddings',
 'uncertainty', '{"kernel": "rbf", "bandwidth": "auto", "sample_count": 10}'::jsonb,
 '{"type": "object", "properties": {"kernel": {"type": "string", "enum": ["rbf", "linear", "polynomial"]}, "bandwidth": {"type": "string"}}}'::jsonb,
 'code', 'kernel-entropy-service.computeKDE',
 'analyzer', ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
 'NeurIPS 2024 - Kernel Language Entropy', 'Finer-grained uncertainty', 'advanced'),

('CONFORMAL_PRED', 'Guaranteed Accuracy Bounds', 'Enhanced Conformal Prediction', 'Conformal Prediction',
 'Prediction sets with statistical guarantees on coverage',
 'uncertainty', '{"coverage_target": 0.9, "calibration_size": 500, "adaptive": true}'::jsonb,
 '{"type": "object", "properties": {"coverage_target": {"type": "number", "min": 0.5, "max": 0.99}, "calibration_size": {"type": "integer"}, "adaptive": {"type": "boolean"}}}'::jsonb,
 'code', 'conformal-prediction-service.getPredictionSet',
 'predictor', ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
 'NeurIPS 2024 - Conformal Prediction for LLMs', 'Guaranteed coverage', 'advanced')

ON CONFLICT (method_code) DO UPDATE SET display_name = EXCLUDED.display_name, scientific_name = EXCLUDED.scientific_name;

-- ============================================================================
-- NEW METHODS: Hallucination Detection (3 methods) - NEW CATEGORY
-- ============================================================================

INSERT INTO orchestration_methods (method_code, display_name, scientific_name, method_name, description, method_category, default_parameters, parameter_schema, implementation_type, prompt_template, model_role, recommended_models, research_reference, accuracy_improvement, complexity_level) VALUES

('MULTI_HALLUC', 'Fact-Check Scanner', 'Multi-Method Hallucination Detection', 'Multi-Method Hallucination',
 'Ensemble detection: consistency, attribution, semantic entropy',
 'hallucination', '{"methods": ["consistency", "attribution", "semantic_entropy"], "aggregation": "weighted", "flag_threshold": 0.6}'::jsonb,
 '{"type": "object", "properties": {"methods": {"type": "array"}, "aggregation": {"type": "string", "enum": ["weighted", "majority", "any"]}, "flag_threshold": {"type": "number"}}}'::jsonb,
 'code', 'multi-hallucination-service.detectHallucinations',
 'detector', ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
 'Multi-Method Hallucination Detection 2025', 'F1 0.85+', 'advanced'),

('METAQA', 'Mutation Testing', 'MetaQA Metamorphic Testing', 'MetaQA',
 'Test consistency via semantically equivalent transformations',
 'hallucination', '{"transformations": ["paraphrase", "negation", "entity_swap"], "num_mutations": 3, "consistency_threshold": 0.8}'::jsonb,
 '{"type": "object", "properties": {"transformations": {"type": "array"}, "num_mutations": {"type": "integer"}, "consistency_threshold": {"type": "number"}}}'::jsonb,
 'composite', '{{#if is_mutation}}Apply {{transformation}} to: {{original}}{{else}}{{mutated_prompt}}{{/if}}',
 'tester', ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
 'MetaQA Metamorphic Testing 2025', 'Subtle inconsistencies +30%', 'moderate'),

('FACTUAL_GROUND', 'Source Verification', 'Factual Grounding Verification', 'Factual Grounding',
 'Verify claims against retrieved documents with evidence mapping',
 'hallucination', '{"retrieval_top_k": 5, "evidence_threshold": 0.7, "require_explicit_support": true}'::jsonb,
 '{"type": "object", "properties": {"retrieval_top_k": {"type": "integer"}, "evidence_threshold": {"type": "number"}, "require_explicit_support": {"type": "boolean"}}}'::jsonb,
 'composite', 'Verify claim: {{claim}}\nEvidence: {{documents}}\nVERDICT: [GROUNDED/UNGROUNDED/PARTIAL]',
 'verifier', ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
 'Factual Grounding Research 2025', 'Grounding accuracy +45%', 'moderate')

ON CONFLICT (method_code) DO UPDATE SET display_name = EXCLUDED.display_name, scientific_name = EXCLUDED.scientific_name;

-- ============================================================================
-- NEW METHODS: Dynamic Model Routing (5 methods)
-- ============================================================================

INSERT INTO orchestration_methods (method_code, display_name, scientific_name, method_name, description, method_category, default_parameters, parameter_schema, implementation_type, prompt_template, model_role, recommended_models, research_reference, accuracy_improvement, complexity_level) VALUES

('ROUTELLM', 'Smart Model Selection', 'RouteLLM Adaptive Selection', 'RouteLLM',
 'Trained router predicts which model answers correctly',
 'routing', '{"router_model": "matrix_factorization", "cost_threshold": 0.7, "quality_floor": 0.8}'::jsonb,
 '{"type": "object", "properties": {"router_model": {"type": "string", "enum": ["matrix_factorization", "bert", "causal_lm"]}, "cost_threshold": {"type": "number"}}}'::jsonb,
 'code', 'routellm-service.routeQuery',
 'router', ARRAY['internal-router'],
 'LMSYS RouteLLM', '-50% cost, <3% quality loss', 'advanced'),

('FRUGAL_CASCADE', 'Progressive Escalation', 'FrugalGPT Cascading Selection', 'FrugalGPT',
 'Try cheap models first, escalate on low confidence',
 'routing', '{"model_cascade": ["gpt-4o-mini", "gpt-4o", "o1"], "confidence_threshold": 0.85, "max_escalations": 2}'::jsonb,
 '{"type": "object", "properties": {"model_cascade": {"type": "array"}, "confidence_threshold": {"type": "number"}, "max_escalations": {"type": "integer"}}}'::jsonb,
 'code', 'frugal-cascade-service.cascadeRoute',
 'router', ARRAY['openai/gpt-4o-mini', 'openai/gpt-4o', 'openai/o1'],
 'FrugalGPT 2023', '-90% cost, maintained quality', 'moderate'),

('PARETO_ROUTE', 'Budget-Aware Routing', 'Cost-Quality Pareto Routing', 'Pareto Routing',
 'Route on Pareto-optimal cost/quality trade-off',
 'routing', '{"budget_cents": 10, "quality_weight": 0.7, "latency_weight": 0.1}'::jsonb,
 '{"type": "object", "properties": {"budget_cents": {"type": "number"}, "quality_weight": {"type": "number"}, "latency_weight": {"type": "number"}}}'::jsonb,
 'code', 'pareto-routing-service.selectModel',
 'router', ARRAY['all-available-models'],
 'Pareto-Optimal Model Selection', 'Optimal cost/quality trade-off', 'moderate'),

('C3PO_CASCADE', 'Smart Cost Escalation', 'C3PO Self-Supervised Cascade', 'C3PO Cascade',
 'Self-supervised cascade learning query difficulty',
 'routing', '{"cascade_levels": 3, "self_supervised": true, "calibration_samples": 100}'::jsonb,
 '{"type": "object", "properties": {"cascade_levels": {"type": "integer"}, "self_supervised": {"type": "boolean"}, "calibration_samples": {"type": "integer"}}}'::jsonb,
 'code', 'c3po-cascade-service.selfSupervisedRoute',
 'router', ARRAY['openai/gpt-4o-mini', 'openai/gpt-4o', 'openai/o1'],
 'NeurIPS 2024 - C3PO', '-40% cost, +2% quality', 'advanced'),

('AUTOMIX', 'Self-Routing Selection', 'AutoMix POMDP Routing', 'AutoMix',
 'POMDP-based self-routing by task difficulty',
 'routing', '{"pomdp_horizon": 3, "exploration_rate": 0.1, "self_verification": true}'::jsonb,
 '{"type": "object", "properties": {"pomdp_horizon": {"type": "integer"}, "exploration_rate": {"type": "number"}, "self_verification": {"type": "boolean"}}}'::jsonb,
 'code', 'automix-service.pomdpRoute',
 'router', ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o'],
 'Nov 2025 - AutoMix', 'Self-improving routing', 'expert')

ON CONFLICT (method_code) DO UPDATE SET display_name = EXCLUDED.display_name, scientific_name = EXCLUDED.scientific_name;

-- ============================================================================
-- NEW METHODS: Human-in-the-Loop (3 methods) - NEW CATEGORY
-- ============================================================================

INSERT INTO orchestration_methods (method_code, display_name, scientific_name, method_name, description, method_category, default_parameters, parameter_schema, implementation_type, prompt_template, model_role, recommended_models, research_reference, accuracy_improvement, complexity_level) VALUES

('HITL_REVIEW', 'Human Review Queue', 'Human-in-the-Loop Review System', 'HITL Review',
 'Route low-confidence or high-stakes outputs to human review',
 'human_loop', '{"confidence_threshold": 0.7, "stake_level": "medium", "auto_approve_above": 0.95, "queue_priority": "fifo"}'::jsonb,
 '{"type": "object", "properties": {"confidence_threshold": {"type": "number"}, "stake_level": {"type": "string", "enum": ["low", "medium", "high", "critical"]}, "auto_approve_above": {"type": "number"}}}'::jsonb,
 'code', 'hitl-review-service.queueForReview',
 'coordinator', ARRAY[],
 'Human-in-the-Loop ML Systems', 'Critical error prevention +90%', 'simple'),

('TIERED_EVAL', 'Multi-Level Review', 'Tiered Evaluation Architecture', 'Tiered Evaluation',
 'Multi-tier: AI auto → AI flag → human → expert',
 'human_loop', '{"tiers": ["auto", "ai_flag", "human", "expert"], "escalation_criteria": "confidence", "sla_hours": 24}'::jsonb,
 '{"type": "object", "properties": {"tiers": {"type": "array"}, "escalation_criteria": {"type": "string"}, "sla_hours": {"type": "integer"}}}'::jsonb,
 'code', 'tiered-eval-service.evaluateWithTiers',
 'coordinator', ARRAY[],
 'Tiered Evaluation Architecture', 'Efficient human resource use', 'moderate'),

('ACTIVE_SAMPLE', 'Smart Sampling', 'Active Learning Sample Selection', 'Active Sampling',
 'Select most informative samples for human labeling',
 'human_loop', '{"selection_strategy": "uncertainty", "batch_size": 10, "diversity_weight": 0.3}'::jsonb,
 '{"type": "object", "properties": {"selection_strategy": {"type": "string", "enum": ["uncertainty", "diversity", "hybrid"]}, "batch_size": {"type": "integer"}, "diversity_weight": {"type": "number"}}}'::jsonb,
 'code', 'active-sampling-service.selectSamples',
 'selector', ARRAY[],
 'Active Learning for NLP', 'Labeling efficiency +60%', 'advanced')

ON CONFLICT (method_code) DO UPDATE SET display_name = EXCLUDED.display_name, scientific_name = EXCLUDED.scientific_name;

-- ============================================================================
-- NEW METHOD: Neural Decision Engine - Integrates with Cato Safety & Consciousness
-- ============================================================================

INSERT INTO orchestration_methods (method_code, display_name, scientific_name, method_name, description, method_category, default_parameters, parameter_schema, implementation_type, code_reference, model_role, recommended_models, research_reference, accuracy_improvement, complexity_level) VALUES

('CATO_NEURAL', 'Neural Decision', 'Cato Neural Decision Engine', 'Cato Neural Decision',
 'Integrates Cato safety pipeline with consciousness affect state and predictive coding for neural-informed decisions. Uses Control Barrier Functions for safety, affect-to-hyperparameter mapping for dynamic behavior, and active inference for uncertainty handling.',
 'neural',
 '{
   "safety_mode": "enforce",
   "use_affect_mapping": true,
   "use_predictive_coding": true,
   "precision_governor_enabled": true,
   "cbf_threshold": 0.95,
   "affect_influence": {
     "frustration_temperature_scale": 0.2,
     "curiosity_exploration_boost": 0.3,
     "low_efficacy_escalation": true
   },
   "prediction_config": {
     "generate_predictions": true,
     "track_surprise": true,
     "learning_threshold": 0.5
   },
   "escalation_config": {
     "auto_escalate_on_uncertainty": true,
     "uncertainty_threshold": 0.7,
     "human_escalation_enabled": true
   }
 }'::jsonb,
 '{
   "type": "object",
   "properties": {
     "safety_mode": {"type": "string", "enum": ["enforce", "warn", "monitor"], "description": "CBF enforcement mode - enforce is recommended"},
     "use_affect_mapping": {"type": "boolean", "description": "Map consciousness affect state to model hyperparameters"},
     "use_predictive_coding": {"type": "boolean", "description": "Enable active inference prediction/surprise tracking"},
     "precision_governor_enabled": {"type": "boolean", "description": "Limit confidence based on epistemic state"},
     "cbf_threshold": {"type": "number", "min": 0.8, "max": 1.0, "description": "Safety barrier function threshold"},
     "affect_influence": {
       "type": "object",
       "properties": {
         "frustration_temperature_scale": {"type": "number", "description": "Temperature reduction when frustrated"},
         "curiosity_exploration_boost": {"type": "number", "description": "Exploration increase when curious"},
         "low_efficacy_escalation": {"type": "boolean", "description": "Escalate to stronger model on low self-efficacy"}
       }
     },
     "prediction_config": {
       "type": "object",
       "properties": {
         "generate_predictions": {"type": "boolean"},
         "track_surprise": {"type": "boolean"},
         "learning_threshold": {"type": "number", "description": "Surprise threshold to flag as learning candidate"}
       }
     },
     "escalation_config": {
       "type": "object",
       "properties": {
         "auto_escalate_on_uncertainty": {"type": "boolean"},
         "uncertainty_threshold": {"type": "number"},
         "human_escalation_enabled": {"type": "boolean"}
       }
     }
   }
 }'::jsonb,
 'code',
 'cato-neural-decision-service.executeDecision',
 'neural_decider',
 ARRAY['self-hosted/consciousness-enabled', 'anthropic/claude-3-5-sonnet-20241022', 'openai/o1'],
 'RADIANT Cato Safety Architecture + Active Inference',
 'Safety-aware decisions with consciousness integration',
 'expert')

ON CONFLICT (method_code) DO UPDATE SET 
    display_name = EXCLUDED.display_name, 
    scientific_name = EXCLUDED.scientific_name,
    description = EXCLUDED.description,
    default_parameters = EXCLUDED.default_parameters,
    parameter_schema = EXCLUDED.parameter_schema;

-- ============================================================================
-- Add method categories for new categories
-- ============================================================================

CREATE TABLE IF NOT EXISTS orchestration_method_categories (
    category_code VARCHAR(50) PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0
);

INSERT INTO orchestration_method_categories (category_code, category_name, description, icon, sort_order) VALUES
('generation', 'Generation', 'Methods that generate new content', 'sparkles', 1),
('evaluation', 'Evaluation', 'Methods that evaluate and judge outputs', 'scale', 2),
('synthesis', 'Synthesis', 'Methods that combine multiple outputs', 'merge', 3),
('verification', 'Verification', 'Methods that verify factual accuracy', 'check-circle', 4),
('debate', 'Debate', 'Methods that involve multi-agent deliberation', 'message-circle', 5),
('aggregation', 'Aggregation', 'Methods that aggregate multiple responses', 'layers', 6),
('reasoning', 'Reasoning', 'Methods that enhance reasoning capabilities', 'brain', 7),
('routing', 'Routing', 'Methods that route to optimal models', 'git-branch', 8),
('collaboration', 'Collaboration', 'Multi-agent collaboration methods', 'users', 9),
('uncertainty', 'Uncertainty', 'Methods that quantify uncertainty', 'help-circle', 10),
('hallucination', 'Hallucination Detection', 'Methods that detect hallucinations', 'alert-triangle', 11),
('human_loop', 'Human-in-the-Loop', 'Methods involving human oversight', 'user-check', 12),
('neural', 'Neural/ML', 'Neural network and ML-integrated methods', 'cpu', 13)
ON CONFLICT (category_code) DO NOTHING;

-- ============================================================================
-- Link workflows to methods they use
-- ============================================================================

-- Update workflow_method_bindings with common patterns
-- CoT workflow uses GENERATE_WITH_COT
INSERT INTO workflow_method_bindings (workflow_id, method_id, step_order, step_name)
SELECT w.workflow_id, m.method_id, 1, 'Chain-of-Thought Generation'
FROM orchestration_workflows w, orchestration_methods m
WHERE w.workflow_code = 'CoT' AND m.method_code = 'GENERATE_WITH_COT'
ON CONFLICT DO NOTHING;

-- Self-Refine uses GENERATE_RESPONSE, SELF_REFLECT, REFINE_RESPONSE
INSERT INTO workflow_method_bindings (workflow_id, method_id, step_order, step_name, is_iterative, max_iterations)
SELECT w.workflow_id, m.method_id, 1, 'Initial Generation', false, 1
FROM orchestration_workflows w, orchestration_methods m
WHERE w.workflow_code = 'ISFR' AND m.method_code = 'GENERATE_RESPONSE'
ON CONFLICT DO NOTHING;

INSERT INTO workflow_method_bindings (workflow_id, method_id, step_order, step_name, is_iterative, max_iterations)
SELECT w.workflow_id, m.method_id, 2, 'Self-Reflection', true, 3
FROM orchestration_workflows w, orchestration_methods m
WHERE w.workflow_code = 'ISFR' AND m.method_code = 'SELF_REFLECT'
ON CONFLICT DO NOTHING;

INSERT INTO workflow_method_bindings (workflow_id, method_id, step_order, step_name, is_iterative, max_iterations)
SELECT w.workflow_id, m.method_id, 3, 'Refinement', true, 3
FROM orchestration_workflows w, orchestration_methods m
WHERE w.workflow_code = 'ISFR' AND m.method_code = 'REFINE_RESPONSE'
ON CONFLICT DO NOTHING;

-- Debate workflow uses GENERATE_CHALLENGE, DEFEND_POSITION, JUDGE_RESPONSES
INSERT INTO workflow_method_bindings (workflow_id, method_id, step_order, step_name)
SELECT w.workflow_id, m.method_id, 1, 'Position A'
FROM orchestration_workflows w, orchestration_methods m
WHERE w.workflow_code = 'SOD' AND m.method_code = 'GENERATE_RESPONSE'
ON CONFLICT DO NOTHING;

INSERT INTO workflow_method_bindings (workflow_id, method_id, step_order, step_name)
SELECT w.workflow_id, m.method_id, 2, 'Challenge'
FROM orchestration_workflows w, orchestration_methods m
WHERE w.workflow_code = 'SOD' AND m.method_code = 'GENERATE_CHALLENGE'
ON CONFLICT DO NOTHING;

INSERT INTO workflow_method_bindings (workflow_id, method_id, step_order, step_name)
SELECT w.workflow_id, m.method_id, 3, 'Defense'
FROM orchestration_workflows w, orchestration_methods m
WHERE w.workflow_code = 'SOD' AND m.method_code = 'DEFEND_POSITION'
ON CONFLICT DO NOTHING;

INSERT INTO workflow_method_bindings (workflow_id, method_id, step_order, step_name)
SELECT w.workflow_id, m.method_id, 4, 'Final Judgment'
FROM orchestration_workflows w, orchestration_methods m
WHERE w.workflow_code = 'SOD' AND m.method_code = 'JUDGE_RESPONSES'
ON CONFLICT DO NOTHING;

COMMENT ON TABLE user_workflow_templates IS 'User-saved workflow templates with custom method configurations';
COMMENT ON TABLE orchestration_method_categories IS 'Categories for organizing orchestration methods';
