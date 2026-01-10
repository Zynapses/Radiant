-- Migration: 157_orchestration_methods_part2.sql
-- RADIANT v4.18.0 - Ensemble, Verification, Multi-Agent Methods

-- ============================================================================
-- NEW METHODS: Ensemble & Aggregation (6 methods)
-- ============================================================================

INSERT INTO orchestration_methods (method_code, display_name, scientific_name, method_name, description, method_category, default_parameters, parameter_schema, implementation_type, prompt_template, model_role, recommended_models, research_reference, accuracy_improvement, complexity_level) VALUES

('MOA_LAYERS', 'Layered Synthesis', 'Mixture of Agents Multi-Layer', 'MoA Synthesis',
 '3-4 layers of proposer agents feeding into aggregators',
 'synthesis', '{"num_layers": 3, "proposers_per_layer": 3, "aggregator_model": "anthropic/claude-3-5-sonnet-20241022"}'::jsonb,
 '{"type": "object", "properties": {"num_layers": {"type": "integer", "min": 2, "max": 5}, "proposers_per_layer": {"type": "integer"}}}'::jsonb,
 'composite', 'Layer {{layer}}/{{num_layers}} - {{role}}\nQuestion: {{prompt}}\n{{#if is_aggregator}}Previous outputs: {{previous_outputs}}\nSynthesize.{{/if}}',
 'proposer', ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o'],
 'Together AI - Mixture of Agents', '+8% over GPT-4o on AlpacaEval', 'advanced'),

('SELF_CONSISTENCY', 'Multi-Sample Voting', 'Self-Consistency Decoding', 'Self-Consistency',
 'Generate 5-20 reasoning paths, majority vote on final answers',
 'aggregation', '{"sample_count": 5, "temperature": 0.7, "vote_method": "majority", "extract_answer": true}'::jsonb,
 '{"type": "object", "properties": {"sample_count": {"type": "integer", "min": 3, "max": 20}, "temperature": {"type": "number"}}}'::jsonb,
 'composite', '{{prompt}}\nThink step-by-step. ANSWER: [your answer]',
 'reasoner', ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
 'Wang et al. 2022 - Self-Consistency', '+17.9% on GSM8K', 'moderate'),

('MULTI_SOURCE_SYNTH', 'Combine & Summarize', 'Multi-Source Synthesis', 'Source Synthesis',
 'Combine insights from multiple model responses',
 'synthesis', '{"preserve_unique": true, "conflict_handling": "note", "structure_output": true}'::jsonb,
 '{"type": "object", "properties": {"preserve_unique": {"type": "boolean"}, "conflict_handling": {"type": "string"}}}'::jsonb,
 'prompt', 'Synthesize responses:\n{{#each responses}}Source {{@index}}: {{content}}\n{{/each}}\nCombine, preserve unique insights, note conflicts.',
 'synthesizer', ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o'],
 'Multi-Source Synthesis Patterns', 'Comprehensive coverage +40%', 'simple'),

('COMPARE_ANALYSIS', 'Side-by-Side Compare', 'Comparative Analysis', 'Side-by-Side',
 'Structured comparison highlighting differences and trade-offs',
 'evaluation', '{"comparison_dimensions": ["pros", "cons", "use_cases"], "include_recommendation": true}'::jsonb,
 '{"type": "object", "properties": {"comparison_dimensions": {"type": "array"}, "include_recommendation": {"type": "boolean"}}}'::jsonb,
 'prompt', 'Compare alternatives:\n{{#each options}}{{name}}: {{description}}\n{{/each}}\nProvide structured comparison.',
 'analyst', ARRAY['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o'],
 'Structured Comparison Methodology', 'Decision clarity +50%', 'simple'),

('GEDI_VOTE', 'Ranked Choice Voting', 'GEDI Electoral Collective Decision Making', 'GEDI Voting',
 'Ordinal preferential voting with 3+ agents',
 'aggregation', '{"num_agents": 3, "ranking_depth": 3, "elimination_rounds": true}'::jsonb,
 '{"type": "object", "properties": {"num_agents": {"type": "integer"}, "ranking_depth": {"type": "integer"}}}'::jsonb,
 'composite', 'Options:\n{{#each options}}{{@index}}. {{this}}\n{{/each}}\nRank best to worst with reasons.',
 'voter', ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
 'EMNLP 2024 - GEDI Electoral CDM', 'Consensus +30%', 'moderate'),

('LLM_BLENDER', 'Rank & Merge Responses', 'LLM-Blender Pairwise Ranking Fusion', 'LLM Blender',
 'PairRanker scores pairs, GenFusion merges top outputs',
 'synthesis', '{"num_responses": 5, "top_k_for_fusion": 3}'::jsonb,
 '{"type": "object", "properties": {"num_responses": {"type": "integer"}, "top_k_for_fusion": {"type": "integer"}}}'::jsonb,
 'composite', '{{#if is_ranking}}Compare A vs B. Which is better?{{else}}Fuse top responses into optimal answer.{{/if}}',
 'ranker', ARRAY['openai/gpt-4o-mini', 'anthropic/claude-3-5-sonnet-20241022'],
 'ACL 2023 - LLM-Blender', '+12% over best single model', 'advanced')

ON CONFLICT (method_code) DO UPDATE SET display_name = EXCLUDED.display_name, scientific_name = EXCLUDED.scientific_name;

-- ============================================================================
-- NEW METHODS: Verification & Fact-Checking (7 methods)
-- ============================================================================

INSERT INTO orchestration_methods (method_code, display_name, scientific_name, method_name, description, method_category, default_parameters, parameter_schema, implementation_type, prompt_template, model_role, recommended_models, research_reference, accuracy_improvement, complexity_level) VALUES

('PROCESS_REWARD', 'Step Verification', 'Process Reward Model Verification', 'PRM Verify',
 'Verify each reasoning step independently',
 'verification', '{"verify_each_step": true, "step_accuracy_threshold": 0.7, "regenerate_on_failure": true}'::jsonb,
 '{"type": "object", "properties": {"verify_each_step": {"type": "boolean"}, "step_accuracy_threshold": {"type": "number"}}}'::jsonb,
 'composite', 'Verify step:\nProblem: {{problem}}\nPrevious: {{previous_steps}}\nCurrent: {{current_step}}\nVERDICT: [VALID/INVALID]',
 'verifier', ARRAY['openai/o1', 'deepseek/deepseek-reasoner'],
 'OpenAI ICLR 2024 - Process Reward Models', '+6% on MATH benchmark', 'advanced'),

('SELFCHECK_GPT', 'Internal Consistency', 'SelfCheckGPT Verification Pipeline', 'SelfCheck',
 'Generate N samples, cross-reference for inconsistencies',
 'verification', '{"sample_count": 5, "consistency_threshold": 0.7, "check_method": "nli"}'::jsonb,
 '{"type": "object", "properties": {"sample_count": {"type": "integer"}, "consistency_threshold": {"type": "number"}}}'::jsonb,
 'composite', 'Check claim consistency:\nClaim: {{claim}}\nSamples: {{samples}}\nCONSISTENCY SCORE: [0-1]',
 'checker', ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
 'SelfCheckGPT - Zero-Resource Hallucination Detection', 'Hallucination F1 +25%', 'moderate'),

('CITE_VERIFY', 'Source Attribution', 'Citation Accuracy Verification', 'CiteFix',
 'Trace claims to source passages, verify citations',
 'verification', '{"citation_match_threshold": 0.8, "verify_quotes": true, "check_context": true}'::jsonb,
 '{"type": "object", "properties": {"citation_match_threshold": {"type": "number"}, "verify_quotes": {"type": "boolean"}}}'::jsonb,
 'prompt', 'Verify citations:\nResponse: {{response}}\nSources: {{sources}}\nReport: VERIFIED/UNVERIFIED/FABRICATED',
 'verifier', ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
 'Citation Accuracy in LLM Outputs', 'Citation accuracy +40%', 'moderate'),

('NATURAL_LOGIC', 'Logic-Based Fact Check', 'Zero-Shot Natural Logic Verification', 'Natural Logic',
 'Use set-theoretic operators for logical consistency',
 'verification', '{"operators": ["subset", "superset", "negation", "equivalence"], "require_proof": true}'::jsonb,
 '{"type": "object", "properties": {"operators": {"type": "array"}, "require_proof": {"type": "boolean"}}}'::jsonb,
 'prompt', 'Apply natural logic:\nPremise: {{premise}}\nClaim: {{claim}}\nRelation: [operator]\nVALID: [true/false]',
 'logician', ARRAY['openai/o1', 'deepseek/deepseek-reasoner'],
 'EMNLP 2024 - Zero-Shot Natural Logic', '+8.96 accuracy points', 'advanced'),

('UNIFACT', 'Combined Verification', 'UniFact Unified Verification', 'UniFact',
 'Hybrid model-based and text-based verification',
 'verification', '{"methods": ["semantic", "textual", "logical"], "combine_strategy": "weighted"}'::jsonb,
 '{"type": "object", "properties": {"methods": {"type": "array"}, "combine_strategy": {"type": "string"}}}'::jsonb,
 'composite', 'Unified verification:\nClaim: {{claim}}\nSemantic/Textual/Logical checks.\nCOMBINED VERDICT: [result]',
 'verifier', ARRAY['openai/o1', 'anthropic/claude-3-5-sonnet-20241022'],
 'UniFact 2024', 'Comprehensive verification +20%', 'advanced'),

('EIGENSCORE', 'Internal State Check', 'EigenScore Hidden State Analysis', 'EigenScore',
 'Analyze eigenvalue patterns in hidden states for uncertainty',
 'verification', '{"threshold": 0.6, "layer_indices": [-1, -2, -3], "aggregate": "mean"}'::jsonb,
 '{"type": "object", "properties": {"threshold": {"type": "number"}, "layer_indices": {"type": "array"}}}'::jsonb,
 'code', 'eigenscore-service.analyzeHiddenStates',
 'analyzer', ARRAY['self-hosted models'],
 'ICLR 2024 - EigenScore', 'Uncertainty via hidden states', 'expert'),

('REQUERY_CHECK', 'Re-Query Consistency', 'Iterative Prompting Consistency Check', 'Re-Query',
 'Black-box detection via paraphrased prompts',
 'verification', '{"num_rephrasings": 3, "consistency_threshold": 0.8, "rephrase_strategy": "semantic"}'::jsonb,
 '{"type": "object", "properties": {"num_rephrasings": {"type": "integer"}, "consistency_threshold": {"type": "number"}}}'::jsonb,
 'composite', '{{#if is_rephrasing}}Rephrase preserving meaning: {{original}}{{else}}{{rephrased_prompt}}{{/if}}',
 'checker', ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
 'DeepMind NeurIPS 2024', 'Black-box hallucination detection', 'moderate')

ON CONFLICT (method_code) DO UPDATE SET display_name = EXCLUDED.display_name, scientific_name = EXCLUDED.scientific_name;

-- ============================================================================
-- NEW METHODS: Multi-Agent Collaboration (5 methods)
-- ============================================================================

INSERT INTO orchestration_methods (method_code, display_name, scientific_name, method_name, description, method_category, default_parameters, parameter_schema, implementation_type, prompt_template, model_role, recommended_models, research_reference, accuracy_improvement, complexity_level) VALUES

('ECON_NASH', 'No-Communication Coordination', 'ECON Bayesian Nash Equilibrium', 'ECON Coordination',
 'Agents coordinate without message exchange using game theory',
 'collaboration', '{"num_agents": 3, "equilibrium_type": "bayesian_nash", "utility_function": "cooperative"}'::jsonb,
 '{"type": "object", "properties": {"num_agents": {"type": "integer"}, "equilibrium_type": {"type": "string"}}}'::jsonb,
 'composite', 'Agent {{agent_id}} coordination game.\nTask: {{prompt}}\nNo communication. Model others, maximize joint utility.',
 'agent', ARRAY['openai/o1', 'anthropic/claude-3-5-sonnet-20241022'],
 'ICML 2025 - ECON', '+11.2% coordination, -21.4% resources', 'expert'),

('TOKEN_AUCTION', 'Fair Multi-Stakeholder Merge', 'Token Auction Mechanism', 'Token Auction',
 'Token-by-token auction for fair multi-stakeholder output',
 'synthesis', '{"budget_per_agent": 100, "auction_type": "second_price", "min_bid": 1}'::jsonb,
 '{"type": "object", "properties": {"budget_per_agent": {"type": "integer"}, "auction_type": {"type": "string"}}}'::jsonb,
 'code', 'token-auction-service.runAuction',
 'bidder', ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
 'WWW 2024 Best Paper - Token Auction', 'Fair aggregation for diverse stakeholders', 'expert'),

('LOGIC_LM', 'Translate to Logic & Solve', 'Logic-LM Neuro-Symbolic Reasoning', 'Logic-LM',
 'Convert to formal logic, solve externally, translate back',
 'reasoning', '{"target_logic": "prolog", "solver": "swi-prolog", "translate_back": true}'::jsonb,
 '{"type": "object", "properties": {"target_logic": {"type": "string"}, "solver": {"type": "string"}}}'::jsonb,
 'composite', '{{#if is_translation}}Convert to {{target_logic}}: {{problem}}{{else}}Translate result: {{solver_output}}{{/if}}',
 'translator', ARRAY['openai/o1', 'deepseek/deepseek-reasoner'],
 'EMNLP 2023 - Logic-LM', '+39.2% over standard prompting', 'advanced'),

('LLM_MODULO', 'Generate & Verify Loop', 'LLM-Modulo Framework', 'LLM-Modulo',
 'Generate candidates, validate with external critics, iterate',
 'collaboration', '{"max_iterations": 5, "critics": ["syntax", "semantic", "constraint"], "require_all_pass": true}'::jsonb,
 '{"type": "object", "properties": {"max_iterations": {"type": "integer"}, "critics": {"type": "array"}}}'::jsonb,
 'composite', '{{#if is_generation}}Solve: {{problem}}{{else}}Verify: {{solution}}\nChecks: {{critics}}{{/if}}',
 'generator', ARRAY['openai/o1', 'anthropic/claude-3-5-sonnet-20241022'],
 'ICML 2024 Spotlight - LLM-Modulo', '12%→93.9% plan success', 'advanced'),

('AFLOW_MCTS', 'Auto-Discover Best Workflow', 'AFlow MCTS Workflow Discovery', 'AFlow Discovery',
 'MCTS to discover optimal workflow compositions',
 'routing', '{"search_iterations": 100, "exploration_weight": 1.414, "max_depth": 5}'::jsonb,
 '{"type": "object", "properties": {"search_iterations": {"type": "integer"}, "exploration_weight": {"type": "number"}}}'::jsonb,
 'code', 'aflow-mcts-service.searchWorkflow',
 'discoverer', ARRAY['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022'],
 'ICLR 2025 - AFlow', 'Auto-discovers workflows beating human designs', 'expert')

ON CONFLICT (method_code) DO UPDATE SET display_name = EXCLUDED.display_name, scientific_name = EXCLUDED.scientific_name;
