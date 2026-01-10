# RADIANT Orchestration Reference v5.2.2

Complete reference for all **System Workflows** (49) and **System Methods** (70+) with UI names, scientific names, descriptions, parameters, and inputs/outputs.

---

## Table of Contents

1. [System Methods](#system-methods)
   - [Generation Methods](#generation-methods)
   - [Evaluation Methods](#evaluation-methods)
   - [Synthesis Methods](#synthesis-methods)
   - [Verification Methods](#verification-methods)
   - [Debate Methods](#debate-methods)
   - [Aggregation Methods](#aggregation-methods)
   - [Reasoning Methods](#reasoning-methods)
   - [Routing Methods](#routing-methods)
   - [Uncertainty Methods](#uncertainty-methods)
   - [Hallucination Detection Methods](#hallucination-detection-methods)
   - [Human-in-the-Loop Methods](#human-in-the-loop-methods)
   - [Collaboration Methods](#collaboration-methods)
   - [Neural Methods](#neural-methods)
2. [System Workflows](#system-workflows)
   - [Adversarial & Validation](#adversarial--validation)
   - [Debate & Deliberation](#debate--deliberation)
   - [Judge & Critic](#judge--critic)
   - [Ensemble & Aggregation](#ensemble--aggregation)
   - [Reflection & Self-Improvement](#reflection--self-improvement)
   - [Verification & Fact-Checking](#verification--fact-checking)
   - [Multi-Agent Collaboration](#multi-agent-collaboration)
   - [Reasoning Enhancement](#reasoning-enhancement)
   - [Model Routing Strategies](#model-routing-strategies)
   - [Domain-Specific Orchestration](#domain-specific-orchestration)
   - [Cognitive Frameworks](#cognitive-frameworks)

---

# System Methods

All system methods are protected—admins can only modify parameters and enabled status, not method definitions.

---

## Generation Methods

### GENERATE_RESPONSE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Generate |
| **Scientific Name** | Basic Generation |
| **Code** | `GENERATE_RESPONSE` |
| **Description** | Generate a response to a prompt using specified model |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `temperature` | number | 0.7 | Sampling temperature (0-2) |
| `max_tokens` | integer | 4096 | Maximum output tokens |

**Inputs:** `prompt`, `context`
**Outputs:** `response`

---

### GENERATE_WITH_COT
| Attribute | Value |
|-----------|-------|
| **UI Name** | Think Step-by-Step |
| **Scientific Name** | Chain-of-Thought Generation |
| **Code** | `GENERATE_WITH_COT` |
| **Description** | Generate response using chain-of-thought reasoning |
| **Research** | Wei et al. 2022 |
| **Accuracy** | +20-40% on reasoning |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `temperature` | number | 0.3 | Sampling temperature |
| `max_tokens` | integer | 8192 | Maximum output tokens |
| `thinking_budget` | integer | 2000 | Tokens for reasoning |

**Inputs:** `prompt`
**Outputs:** `reasoning`, `response`

---

### REFINE_RESPONSE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Refine |
| **Scientific Name** | Iterative Refinement |
| **Code** | `REFINE_RESPONSE` |
| **Description** | Improve a response based on feedback |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `refinement_focus` | string | "all" | Focus area: all, accuracy, clarity, completeness |
| `preserve_structure` | boolean | true | Maintain response structure |

**Inputs:** `response`, `feedback`
**Outputs:** `refined_response`

---

## Evaluation Methods

### CRITIQUE_RESPONSE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Critique |
| **Scientific Name** | Critical Evaluation |
| **Code** | `CRITIQUE_RESPONSE` |
| **Description** | Critically evaluate a response for flaws and improvements |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `focus_areas` | array | ["accuracy", "completeness", "clarity", "logic"] | Areas to evaluate |
| `severity_threshold` | string | "medium" | Minimum severity to report |

**Inputs:** `original_prompt`, `response`
**Outputs:** `critique`, `issues[]`, `suggestions[]`

---

### JUDGE_RESPONSES
| Attribute | Value |
|-----------|-------|
| **UI Name** | Judge |
| **Scientific Name** | Comparative Judgment |
| **Code** | `JUDGE_RESPONSES` |
| **Description** | Compare and judge multiple responses to select the best |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `evaluation_mode` | enum | "pairwise" | Mode: pointwise, pairwise, listwise |
| `criteria` | array | ["accuracy", "helpfulness", "clarity", "completeness"] | Evaluation criteria |

**Inputs:** `original_prompt`, `responses[]`
**Outputs:** `best_index`, `score`, `reasoning`

---

### POLL_JUDGE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Multi-Judge Panel |
| **Scientific Name** | Panel of LLMs Evaluation |
| **Code** | `POLL_JUDGE` |
| **Description** | Multiple diverse judge models evaluate outputs independently |
| **Research** | Panel of LLMs Evaluation Framework |
| **Accuracy** | Reduces single-model bias 40-60% |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `num_judges` | integer | 3 | Number of judge models |
| `scoring_criteria` | array | ["accuracy", "completeness", "clarity"] | Evaluation dimensions |
| `aggregation` | enum | "mean" | Aggregation: mean, median, weighted |

**Inputs:** `original_prompt`, `response`
**Outputs:** `scores[]`, `aggregate_score`, `per_judge_feedback[]`

---

### G_EVAL
| Attribute | Value |
|-----------|-------|
| **UI Name** | Structured Scoring |
| **Scientific Name** | G-Eval NLG Evaluation Framework |
| **Code** | `G_EVAL` |
| **Description** | Chain-of-thought scoring for NLG across coherence, consistency, fluency, relevance |
| **Research** | G-Eval: NLG Evaluation using GPT-4 |
| **Accuracy** | Correlates 0.5+ with human judgment |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dimensions` | array | ["coherence", "consistency", "fluency", "relevance"] | G-Eval dimensions |
| `use_cot` | boolean | true | Chain-of-thought scoring |
| `score_range` | array | [1, 5] | Score min/max |

**Inputs:** `source`, `generated`
**Outputs:** `dimension_scores{}`, `overall_score`, `reasoning`

---

### PAIRWISE_PREFER
| Attribute | Value |
|-----------|-------|
| **UI Name** | Head-to-Head Compare |
| **Scientific Name** | Pairwise Preference Judgment |
| **Code** | `PAIRWISE_PREFER` |
| **Description** | Compare two outputs head-to-head for reliable relative ranking |
| **Research** | Pairwise Preference Learning |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `comparison_criteria` | array | ["quality", "accuracy", "helpfulness"] | Comparison dimensions |
| `allow_tie` | boolean | true | Allow tie verdicts |

**Inputs:** `response_a`, `response_b`
**Outputs:** `verdict` (A/B/TIE), `key_differentiator`

---

### SELF_REFLECT
| Attribute | Value |
|-----------|-------|
| **UI Name** | Reflect |
| **Scientific Name** | Self-Reflection |
| **Code** | `SELF_REFLECT` |
| **Description** | AI reflects on its own response to identify improvements |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `reflection_depth` | string | "thorough" | Depth: quick, standard, thorough |
| `aspects` | array | ["accuracy", "completeness", "clarity"] | Aspects to reflect on |

**Inputs:** `original_prompt`, `response`
**Outputs:** `strengths[]`, `weaknesses[]`, `improvements[]`

---

### COMPARE_ANALYSIS
| Attribute | Value |
|-----------|-------|
| **UI Name** | Side-by-Side Compare |
| **Scientific Name** | Comparative Analysis |
| **Code** | `COMPARE_ANALYSIS` |
| **Description** | Structured comparison highlighting differences and trade-offs |
| **Accuracy** | Decision clarity +50% |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `comparison_dimensions` | array | ["pros", "cons", "use_cases"] | Dimensions to compare |
| `include_recommendation` | boolean | true | Include final recommendation |

**Inputs:** `options[]`
**Outputs:** `comparison_table`, `recommendation`, `reasoning`

---

## Synthesis Methods

### SYNTHESIZE_RESPONSES
| Attribute | Value |
|-----------|-------|
| **UI Name** | Synthesize |
| **Scientific Name** | Multi-Response Synthesis |
| **Code** | `SYNTHESIZE_RESPONSES` |
| **Description** | Combine best parts from multiple responses |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `combination_strategy` | string | "best_parts" | Strategy: best_parts, weighted, comprehensive |
| `conflict_resolution` | string | "majority" | Conflict handling: majority, note, first |

**Inputs:** `original_prompt`, `responses[]`
**Outputs:** `synthesized_response`

---

### BUILD_CONSENSUS
| Attribute | Value |
|-----------|-------|
| **UI Name** | Consensus |
| **Scientific Name** | Consensus Aggregation |
| **Code** | `BUILD_CONSENSUS` |
| **Description** | Identify points of agreement across multiple responses |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `consensus_threshold` | number | 0.7 | Agreement threshold (0-1) |
| `include_disputed` | boolean | true | Include disputed points |

**Inputs:** `responses[]`
**Outputs:** `consensus_points[]`, `disputed_points[]`, `unique_insights[]`

---

### MOA_LAYERS
| Attribute | Value |
|-----------|-------|
| **UI Name** | Layered Synthesis |
| **Scientific Name** | Mixture of Agents Multi-Layer |
| **Code** | `MOA_LAYERS` |
| **Description** | 3-4 layers of proposer agents feeding into aggregators |
| **Research** | Together AI - Mixture of Agents |
| **Accuracy** | +8% over GPT-4o on AlpacaEval |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `num_layers` | integer | 3 | Number of synthesis layers (2-5) |
| `proposers_per_layer` | integer | 3 | Proposers per layer |
| `aggregator_model` | string | "anthropic/claude-3-5-sonnet-20241022" | Model for aggregation |

**Inputs:** `prompt`
**Outputs:** `layer_outputs[]`, `final_response`

---

### MULTI_SOURCE_SYNTH
| Attribute | Value |
|-----------|-------|
| **UI Name** | Combine & Summarize |
| **Scientific Name** | Multi-Source Synthesis |
| **Code** | `MULTI_SOURCE_SYNTH` |
| **Description** | Combine insights from multiple model responses |
| **Accuracy** | Comprehensive coverage +40% |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `preserve_unique` | boolean | true | Preserve unique insights |
| `conflict_handling` | string | "note" | Conflict handling: note, resolve, ignore |
| `structure_output` | boolean | true | Structure the output |

**Inputs:** `responses[]`
**Outputs:** `synthesized_response`, `conflicts[]`

---

### LLM_BLENDER
| Attribute | Value |
|-----------|-------|
| **UI Name** | Rank & Merge Responses |
| **Scientific Name** | LLM-Blender Pairwise Ranking Fusion |
| **Code** | `LLM_BLENDER` |
| **Description** | PairRanker scores pairs, GenFusion merges top outputs |
| **Research** | ACL 2023 - LLM-Blender |
| **Accuracy** | +12% over best single model |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `num_responses` | integer | 5 | Responses to rank |
| `top_k_for_fusion` | integer | 3 | Top K to fuse |

**Inputs:** `prompt`, `responses[]`
**Outputs:** `rankings[]`, `fused_response`

---

### TOKEN_AUCTION
| Attribute | Value |
|-----------|-------|
| **UI Name** | Fair Multi-Stakeholder Merge |
| **Scientific Name** | Token Auction Mechanism |
| **Code** | `TOKEN_AUCTION` |
| **Description** | Token-by-token auction for fair multi-stakeholder output |
| **Research** | WWW 2024 Best Paper - Token Auction |
| **Complexity** | Expert |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `budget_per_agent` | integer | 100 | Token budget per agent |
| `auction_type` | string | "second_price" | Auction: second_price, first_price |
| `min_bid` | integer | 1 | Minimum bid value |

**Inputs:** `prompt`, `stakeholder_preferences[]`
**Outputs:** `merged_response`, `budget_usage[]`

---

## Verification Methods

### VERIFY_FACTS
| Attribute | Value |
|-----------|-------|
| **UI Name** | Fact Check |
| **Scientific Name** | Factual Verification |
| **Code** | `VERIFY_FACTS` |
| **Description** | Extract and verify factual claims in a response |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `extraction_method` | string | "explicit" | Method: explicit, implicit, all |
| `verification_depth` | string | "thorough" | Depth: quick, standard, thorough |

**Inputs:** `response`
**Outputs:** `claims[]`, `verifications[]`, `confidence_scores[]`

---

### PROCESS_REWARD
| Attribute | Value |
|-----------|-------|
| **UI Name** | Step Verification |
| **Scientific Name** | Process Reward Model Verification |
| **Code** | `PROCESS_REWARD` |
| **Description** | Verify each reasoning step independently |
| **Research** | OpenAI ICLR 2024 - Process Reward Models |
| **Accuracy** | +6% on MATH benchmark |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `verify_each_step` | boolean | true | Verify each step |
| `step_accuracy_threshold` | number | 0.7 | Accuracy threshold |
| `regenerate_on_failure` | boolean | true | Regenerate failed steps |

**Inputs:** `problem`, `reasoning_steps[]`
**Outputs:** `step_verdicts[]`, `overall_valid`, `failed_steps[]`

---

### SELFCHECK_GPT
| Attribute | Value |
|-----------|-------|
| **UI Name** | Internal Consistency |
| **Scientific Name** | SelfCheckGPT Verification Pipeline |
| **Code** | `SELFCHECK_GPT` |
| **Description** | Generate N samples, cross-reference for inconsistencies |
| **Research** | SelfCheckGPT - Zero-Resource Hallucination Detection |
| **Accuracy** | Hallucination F1 +25% |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sample_count` | integer | 5 | Consistency check samples |
| `consistency_threshold` | number | 0.7 | Consistency threshold |
| `check_method` | enum | "nli" | Method: nli, bertscore, exact |

**Inputs:** `claim`, `samples[]`
**Outputs:** `consistency_score`, `inconsistent_claims[]`

---

### CITE_VERIFY
| Attribute | Value |
|-----------|-------|
| **UI Name** | Source Attribution |
| **Scientific Name** | Citation Accuracy Verification |
| **Code** | `CITE_VERIFY` |
| **Description** | Trace claims to source passages, verify citations |
| **Accuracy** | Citation accuracy +40% |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `citation_match_threshold` | number | 0.8 | Match threshold |
| `verify_quotes` | boolean | true | Verify exact quotes |
| `check_context` | boolean | true | Check citation context |

**Inputs:** `response`, `sources[]`
**Outputs:** `citation_verdicts[]`, `fabricated_citations[]`

---

### NATURAL_LOGIC
| Attribute | Value |
|-----------|-------|
| **UI Name** | Logic-Based Fact Check |
| **Scientific Name** | Zero-Shot Natural Logic Verification |
| **Code** | `NATURAL_LOGIC` |
| **Description** | Use set-theoretic operators for logical consistency |
| **Research** | EMNLP 2024 - Zero-Shot Natural Logic |
| **Accuracy** | +8.96 accuracy points |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `operators` | array | ["subset", "superset", "negation", "equivalence"] | Logic operators |
| `require_proof` | boolean | true | Require formal proof |

**Inputs:** `premise`, `claim`
**Outputs:** `relation`, `valid`, `proof`

---

### UNIFACT
| Attribute | Value |
|-----------|-------|
| **UI Name** | Combined Verification |
| **Scientific Name** | UniFact Unified Verification |
| **Code** | `UNIFACT` |
| **Description** | Hybrid model-based and text-based verification |
| **Research** | UniFact 2024 |
| **Accuracy** | Comprehensive verification +20% |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `methods` | array | ["semantic", "textual", "logical"] | Verification methods |
| `combine_strategy` | string | "weighted" | Combination: weighted, majority, all |

**Inputs:** `claim`
**Outputs:** `method_verdicts{}`, `combined_verdict`

---

### EIGENSCORE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Internal State Check |
| **Scientific Name** | EigenScore Hidden State Analysis |
| **Code** | `EIGENSCORE` |
| **Description** | Analyze eigenvalue patterns in hidden states for uncertainty |
| **Research** | ICLR 2024 - EigenScore |
| **Complexity** | Expert |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `threshold` | number | 0.6 | Uncertainty threshold |
| `layer_indices` | array | [-1, -2, -3] | Layers to analyze |
| `aggregate` | string | "mean" | Aggregation: mean, max, min |

**Inputs:** `hidden_states`
**Outputs:** `uncertainty_score`, `layer_scores[]`

---

### REQUERY_CHECK
| Attribute | Value |
|-----------|-------|
| **UI Name** | Re-Query Consistency |
| **Scientific Name** | Iterative Prompting Consistency Check |
| **Code** | `REQUERY_CHECK` |
| **Description** | Black-box detection via paraphrased prompts |
| **Research** | DeepMind NeurIPS 2024 |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `num_rephrasings` | integer | 3 | Number of rephrasings |
| `consistency_threshold` | number | 0.8 | Consistency threshold |
| `rephrase_strategy` | string | "semantic" | Strategy: semantic, syntactic, mixed |

**Inputs:** `original_prompt`
**Outputs:** `responses[]`, `consistency_score`, `inconsistencies[]`

---

## Debate Methods

### GENERATE_CHALLENGE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Challenge |
| **Scientific Name** | Adversarial Challenge |
| **Code** | `GENERATE_CHALLENGE` |
| **Description** | Challenge a response by arguing the opposite position |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `challenge_intensity` | string | "moderate" | Intensity: mild, moderate, aggressive |
| `focus` | string | "weakest_points" | Focus: weakest_points, all, random |

**Inputs:** `original_prompt`, `response`
**Outputs:** `challenges[]`, `counter_arguments[]`

---

### DEFEND_POSITION
| Attribute | Value |
|-----------|-------|
| **UI Name** | Defend |
| **Scientific Name** | Position Defense |
| **Code** | `DEFEND_POSITION` |
| **Description** | Defend a response against challenges |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `defense_strategy` | string | "address_all" | Strategy: address_all, strongest_only, concede_weak |
| `concede_valid` | boolean | true | Concede valid challenges |

**Inputs:** `response`, `challenge`
**Outputs:** `defense`, `concessions[]`, `improved_response`

---

### SPARSE_DEBATE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Efficient Debate |
| **Scientific Name** | Sparse Communication Topology Debate |
| **Code** | `SPARSE_DEBATE` |
| **Description** | Agents connect in sparse patterns (ring, star, tree) to reduce communication cost |
| **Research** | Sparse Communication Networks for Multi-Agent Debate |
| **Accuracy** | -40-60% cost with <5% quality loss |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `topology` | enum | "ring" | Network: ring, star, tree, full |
| `debate_rounds` | integer | 3 | Number of debate rounds (1-10) |
| `temperature` | number | 0.7 | Agent response temperature |

**Inputs:** `prompt`
**Outputs:** `debate_history[]`, `final_position`, `consensus_reached`

---

### ARG_MAPPING
| Attribute | Value |
|-----------|-------|
| **UI Name** | Attack & Support Mapping |
| **Scientific Name** | ArgLLMs Quantitative Bipolar Argumentation |
| **Code** | `ARG_MAPPING` |
| **Description** | Build explicit attack/support relations between arguments with strength scores |
| **Research** | Imperial College London 2024 - ArgLLMs |
| **Accuracy** | Structured argumentation +35% |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `strength_threshold` | number | 0.5 | Min argument strength to include |
| `include_rebuttal` | boolean | true | Generate rebuttals |
| `max_depth` | integer | 3 | Max argument tree depth |

**Inputs:** `claim`
**Outputs:** `argument_graph`, `relations[]`, `strength_scores{}`

---

### HAH_DELPHI
| Attribute | Value |
|-----------|-------|
| **UI Name** | Human-AI Expert Panel |
| **Scientific Name** | HAH-Delphi Human-AI Hybrid Consensus |
| **Code** | `HAH_DELPHI` |
| **Description** | Four-tier Delphi consensus combining AI with human expert oversight |
| **Research** | HAH-Delphi Aug 2025 |
| **Accuracy** | >90% coverage on expert decisions |
| **Complexity** | Expert |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tiers` | integer | 4 | Number of consensus tiers |
| `human_threshold` | number | 0.6 | Escalate to human above this |
| `consensus_target` | number | 0.9 | Target consensus level |
| `max_rounds` | integer | 5 | Maximum Delphi rounds |

**Inputs:** `prompt`, `previous_consensus`
**Outputs:** `consensus`, `confidence`, `human_escalated`

---

### RECONCILE_WEIGHTED
| Attribute | Value |
|-----------|-------|
| **UI Name** | Confidence-Weighted Agreement |
| **Scientific Name** | ReConcile Confidence-Weighted Consensus |
| **Code** | `RECONCILE_WEIGHTED` |
| **Description** | Diverse LLMs weighted by verbalized confidence scores |
| **Research** | ACL 2024 - ReConcile |
| **Accuracy** | +15-25% on diverse model ensembles |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `min_confidence` | number | 0.6 | Minimum confidence to include |
| `weight_by` | string | "confidence" | Weighting strategy |
| `reconciliation_rounds` | integer | 2 | Reconciliation iterations |

**Inputs:** `prompt`
**Outputs:** `weighted_response`, `confidence_scores[]`, `disagreements[]`

---

## Aggregation Methods

### MAJORITY_VOTE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Vote |
| **Scientific Name** | Majority Aggregation |
| **Code** | `MAJORITY_VOTE` |
| **Description** | Select the most common answer from multiple responses |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `vote_method` | string | "exact_match" | Method: exact_match, semantic, fuzzy |
| `tie_breaker` | string | "first" | Tie breaker: first, random, longest |

**Inputs:** `responses[]`
**Outputs:** `winner`, `vote_counts{}`, `confidence`

---

### WEIGHTED_AGGREGATE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Weight |
| **Scientific Name** | Weighted Aggregation |
| **Code** | `WEIGHTED_AGGREGATE` |
| **Description** | Combine responses weighted by confidence/expertise |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `weight_by` | string | "confidence" | Weight source: confidence, expertise, accuracy |
| `normalize` | boolean | true | Normalize weights |

**Inputs:** `responses[]`, `weights[]`
**Outputs:** `aggregated_response`, `contribution_scores[]`

---

### SELF_CONSISTENCY
| Attribute | Value |
|-----------|-------|
| **UI Name** | Multi-Sample Voting |
| **Scientific Name** | Self-Consistency Decoding |
| **Code** | `SELF_CONSISTENCY` |
| **Description** | Generate 5-20 reasoning paths, majority vote on final answers |
| **Research** | Wang et al. 2022 - Self-Consistency |
| **Accuracy** | +17.9% on GSM8K |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sample_count` | integer | 5 | Number of reasoning paths (3-20) |
| `temperature` | number | 0.7 | Sampling temperature |
| `vote_method` | string | "majority" | Vote method: majority, weighted |
| `extract_answer` | boolean | true | Extract final answer |

**Inputs:** `prompt`
**Outputs:** `reasoning_paths[]`, `final_answer`, `confidence`

---

### GEDI_VOTE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Ranked Choice Voting |
| **Scientific Name** | GEDI Electoral Collective Decision Making |
| **Code** | `GEDI_VOTE` |
| **Description** | Ordinal preferential voting with 3+ agents |
| **Research** | EMNLP 2024 - GEDI Electoral CDM |
| **Accuracy** | Consensus +30% |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `num_agents` | integer | 3 | Number of voting agents |
| `ranking_depth` | integer | 3 | Rankings per agent |
| `elimination_rounds` | boolean | true | Use elimination rounds |

**Inputs:** `options[]`
**Outputs:** `winner`, `round_results[]`, `final_rankings[]`

---

## Reasoning Methods

### DECOMPOSE_PROBLEM
| Attribute | Value |
|-----------|-------|
| **UI Name** | Decompose |
| **Scientific Name** | Problem Decomposition |
| **Code** | `DECOMPOSE_PROBLEM` |
| **Description** | Break down a complex problem into sub-problems |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `max_subproblems` | integer | 5 | Maximum sub-problems |
| `decomposition_strategy` | string | "functional" | Strategy: functional, hierarchical, sequential |

**Inputs:** `prompt`
**Outputs:** `subproblems[]`, `dependencies[]`, `complexity_estimates[]`

---

### LOGIC_LM
| Attribute | Value |
|-----------|-------|
| **UI Name** | Translate to Logic & Solve |
| **Scientific Name** | Logic-LM Neuro-Symbolic Reasoning |
| **Code** | `LOGIC_LM` |
| **Description** | Convert to formal logic, solve externally, translate back |
| **Research** | EMNLP 2023 - Logic-LM |
| **Accuracy** | +39.2% over standard prompting |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `target_logic` | string | "prolog" | Target: prolog, z3, fol |
| `solver` | string | "swi-prolog" | External solver |
| `translate_back` | boolean | true | Translate result to natural language |

**Inputs:** `problem`
**Outputs:** `formal_representation`, `solver_output`, `natural_answer`

---

### LLM_MODULO
| Attribute | Value |
|-----------|-------|
| **UI Name** | Generate & Verify Loop |
| **Scientific Name** | LLM-Modulo Framework |
| **Code** | `LLM_MODULO` |
| **Description** | Generate candidates, validate with external critics, iterate |
| **Research** | ICML 2024 Spotlight - LLM-Modulo |
| **Accuracy** | 12%→93.9% plan success |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `max_iterations` | integer | 5 | Maximum iterations |
| `critics` | array | ["syntax", "semantic", "constraint"] | Critic types |
| `require_all_pass` | boolean | true | All critics must pass |

**Inputs:** `problem`
**Outputs:** `solution`, `iterations_used`, `critic_feedback[]`

---

## Routing Methods

### DETECT_TASK_TYPE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Classify |
| **Scientific Name** | Task Classification |
| **Code** | `DETECT_TASK_TYPE` |
| **Description** | Analyze prompt to determine task type and complexity |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `task_categories` | array | ["coding", "reasoning", "creative", "factual", "math", "research"] | Task categories |

**Inputs:** `prompt`
**Outputs:** `task_type`, `complexity`, `capabilities_required[]`

---

### SELECT_BEST_MODEL
| Attribute | Value |
|-----------|-------|
| **UI Name** | Route |
| **Scientific Name** | Model Selection |
| **Code** | `SELECT_BEST_MODEL` |
| **Description** | Choose the optimal model for a given task |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `consider_cost` | boolean | true | Factor in cost |
| `consider_latency` | boolean | true | Factor in latency |
| `quality_priority` | number | 0.7 | Quality weight (0-1) |

**Inputs:** `task_type`, `complexity`, `constraints`
**Outputs:** `selected_model`, `score`, `alternatives[]`

---

### ROUTELLM
| Attribute | Value |
|-----------|-------|
| **UI Name** | Smart Model Selection |
| **Scientific Name** | RouteLLM Adaptive Selection |
| **Code** | `ROUTELLM` |
| **Description** | Trained router predicts which model answers correctly |
| **Research** | LMSYS RouteLLM |
| **Accuracy** | -50% cost, <3% quality loss |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `router_model` | enum | "matrix_factorization" | Router: matrix_factorization, bert, causal_lm |
| `cost_threshold` | number | 0.7 | Max cost relative to baseline |
| `quality_floor` | number | 0.8 | Minimum acceptable quality |

**Inputs:** `prompt`
**Outputs:** `selected_model`, `confidence`, `routing_reason`

---

### FRUGAL_CASCADE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Progressive Escalation |
| **Scientific Name** | FrugalGPT Cascading Selection |
| **Code** | `FRUGAL_CASCADE` |
| **Description** | Try cheap models first, escalate on low confidence |
| **Research** | FrugalGPT 2023 |
| **Accuracy** | -90% cost, maintained quality |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model_cascade` | array | ["gpt-4o-mini", "gpt-4o", "o1"] | Models in escalation order |
| `confidence_threshold` | number | 0.85 | Escalate below this confidence |
| `max_escalations` | integer | 2 | Maximum escalation steps |

**Inputs:** `prompt`
**Outputs:** `response`, `model_used`, `escalations_used`

---

### PARETO_ROUTE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Budget-Aware Routing |
| **Scientific Name** | Cost-Quality Pareto Routing |
| **Code** | `PARETO_ROUTE` |
| **Description** | Route on Pareto-optimal cost/quality trade-off |
| **Research** | Pareto-Optimal Model Selection |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `budget_cents` | number | 10 | Budget constraint per query |
| `quality_weight` | number | 0.7 | Weight for quality (0-1) |
| `latency_weight` | number | 0.1 | Weight for latency (0-1) |

**Inputs:** `prompt`, `budget`
**Outputs:** `selected_model`, `expected_quality`, `expected_cost`

---

### C3PO_CASCADE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Smart Cost Escalation |
| **Scientific Name** | C3PO Self-Supervised Cascade |
| **Code** | `C3PO_CASCADE` |
| **Description** | Self-supervised cascade learning query difficulty |
| **Research** | NeurIPS 2024 - C3PO |
| **Accuracy** | -40% cost, +2% quality |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cascade_levels` | integer | 3 | Number of model tiers |
| `self_supervised` | boolean | true | Enable self-supervised learning |
| `calibration_samples` | integer | 100 | Samples for difficulty calibration |

**Inputs:** `prompt`
**Outputs:** `response`, `difficulty_score`, `tier_used`

---

### AUTOMIX
| Attribute | Value |
|-----------|-------|
| **UI Name** | Self-Routing Selection |
| **Scientific Name** | AutoMix POMDP Routing |
| **Code** | `AUTOMIX` |
| **Description** | POMDP-based self-routing by task difficulty |
| **Research** | Nov 2025 - AutoMix |
| **Complexity** | Expert |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pomdp_horizon` | integer | 3 | POMDP planning horizon |
| `exploration_rate` | number | 0.1 | ε for ε-greedy exploration |
| `self_verification` | boolean | true | Verify own outputs |

**Inputs:** `prompt`
**Outputs:** `response`, `belief_state`, `action_taken`

---

### AFLOW_MCTS
| Attribute | Value |
|-----------|-------|
| **UI Name** | Auto-Discover Best Workflow |
| **Scientific Name** | AFlow MCTS Workflow Discovery |
| **Code** | `AFLOW_MCTS` |
| **Description** | MCTS to discover optimal workflow compositions |
| **Research** | ICLR 2025 - AFlow |
| **Complexity** | Expert |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search_iterations` | integer | 100 | MCTS iterations |
| `exploration_weight` | number | 1.414 | UCB exploration constant |
| `max_depth` | integer | 5 | Max workflow depth |

**Inputs:** `task_description`
**Outputs:** `discovered_workflow`, `expected_performance`, `search_tree`

---

## Uncertainty Methods

### SEMANTIC_ENTROPY
| Attribute | Value |
|-----------|-------|
| **UI Name** | Meaning-Based Uncertainty |
| **Scientific Name** | Semantic Entropy Quantification |
| **Code** | `SEMANTIC_ENTROPY` |
| **Description** | Cluster semantically equivalent answers, compute entropy over meaning clusters |
| **Research** | Nature 2024 - Semantic Uncertainty in LLMs |
| **Accuracy** | AUROC 0.79-0.87 hallucination detection |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sample_count` | integer | 10 | Number of response samples (5-20) |
| `temperature` | number | 0.7 | Sampling temperature |
| `clustering_method` | enum | "nli" | Clustering: nli, embedding, exact |
| `entropy_threshold` | number | 0.5 | Flag uncertainty above this |

**Inputs:** `prompt`
**Outputs:** `entropy_score`, `clusters[]`, `uncertainty_flag`

---

### SE_PROBES
| Attribute | Value |
|-----------|-------|
| **UI Name** | Fast Uncertainty Check |
| **Scientific Name** | Semantic Entropy Probes |
| **Code** | `SE_PROBES` |
| **Description** | Lightweight probes on hidden states for fast entropy estimation (logprob-based) |
| **Research** | ICML 2024 - Semantic Entropy Probes |
| **Accuracy** | 300x faster, 90% accuracy |
| **Complexity** | Expert |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `probe_layers` | array | [-1, -2] | Model layers to probe (logprob-based) |
| `threshold` | number | 0.5 | Uncertainty threshold |
| `fast_mode` | boolean | true | Use fast logprob estimation |
| `sample_count` | integer | 5 | Number of samples for averaging |

**Inputs:** `prompt`
**Outputs:** `entropy_estimate`, `layer_entropies[]`, `uncertainty_flag`

---

### KERNEL_ENTROPY
| Attribute | Value |
|-----------|-------|
| **UI Name** | Detailed Uncertainty Score |
| **Scientific Name** | Kernel Language Entropy |
| **Code** | `KERNEL_ENTROPY` |
| **Description** | Continuous entropy via kernel density estimation on embeddings |
| **Research** | NeurIPS 2024 - Kernel Language Entropy |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `kernel` | enum | "rbf" | Kernel: rbf, linear, polynomial |
| `bandwidth` | string | "auto" | Bandwidth or "auto" for Silverman |
| `sample_count` | integer | 10 | Response samples for KDE |

**Inputs:** `prompt`
**Outputs:** `kde_entropy`, `density_estimate`, `bandwidth_used`

---

### CALIBRATED_CONF
| Attribute | Value |
|-----------|-------|
| **UI Name** | Calibrated Confidence |
| **Scientific Name** | Calibrated Confidence Estimation |
| **Code** | `CALIBRATED_CONF` |
| **Description** | Elicit confidence via prompting and calibrate against accuracy |
| **Research** | Calibrated Confidence Estimation Research |
| **Accuracy** | ECE -15% |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `calibration_method` | enum | "platt_scaling" | Method: platt_scaling, isotonic, temperature_scaling |
| `confidence_prompt` | string | "verbalized" | How to elicit confidence |
| `temperature` | number | 0.3 | Sampling temperature |

**Inputs:** `prompt`
**Outputs:** `response`, `raw_confidence`, `calibrated_confidence`

---

### CONSISTENCY_UQ
| Attribute | Value |
|-----------|-------|
| **UI Name** | Agreement Scoring |
| **Scientific Name** | Consistency-Based Uncertainty Quantification |
| **Code** | `CONSISTENCY_UQ` |
| **Description** | Measure agreement across samples as uncertainty proxy |
| **Research** | Consistency-Based UQ Research |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sample_count` | integer | 5 | Number of response samples |
| `agreement_metric` | enum | "jaccard" | Metric: jaccard, cosine, exact_match, bertscore |
| `threshold` | number | 0.7 | Agreement threshold |

**Inputs:** `prompt`
**Outputs:** `agreement_score`, `responses[]`, `uncertainty_flag`

---

### CONFORMAL_PRED
| Attribute | Value |
|-----------|-------|
| **UI Name** | Guaranteed Accuracy Bounds |
| **Scientific Name** | Enhanced Conformal Prediction |
| **Code** | `CONFORMAL_PRED` |
| **Description** | Prediction sets with statistical guarantees on coverage |
| **Research** | NeurIPS 2024 - Conformal Prediction for LLMs |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `coverage_target` | number | 0.9 | Target coverage (0.5-0.99) |
| `calibration_size` | integer | 500 | Calibration set size |
| `adaptive` | boolean | true | Use adaptive conformal sets |

**Inputs:** `prompt`
**Outputs:** `prediction_set[]`, `coverage_guarantee`, `set_size`

---

## Hallucination Detection Methods

### MULTI_HALLUC
| Attribute | Value |
|-----------|-------|
| **UI Name** | Fact-Check Scanner |
| **Scientific Name** | Multi-Method Hallucination Detection |
| **Code** | `MULTI_HALLUC` |
| **Description** | Ensemble detection: consistency, attribution, semantic entropy |
| **Research** | Multi-Method Hallucination Detection 2025 |
| **Accuracy** | F1 0.85+ |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `methods` | array | ["consistency", "attribution", "semantic_entropy"] | Detection methods |
| `aggregation` | enum | "weighted" | Aggregation: weighted, majority, any |
| `flag_threshold` | number | 0.6 | Flag as hallucination above this |

**Inputs:** `response`
**Outputs:** `hallucination_score`, `method_scores{}`, `flagged_claims[]`

---

### METAQA
| Attribute | Value |
|-----------|-------|
| **UI Name** | Mutation Testing |
| **Scientific Name** | MetaQA Metamorphic Testing |
| **Code** | `METAQA` |
| **Description** | Test consistency via semantically equivalent transformations |
| **Research** | MetaQA Metamorphic Testing 2025 |
| **Accuracy** | Subtle inconsistencies +30% |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `transformations` | array | ["paraphrase", "negation", "entity_swap"] | Mutation types |
| `num_mutations` | integer | 3 | Mutations per claim |
| `consistency_threshold` | number | 0.8 | Consistency threshold |

**Inputs:** `original_prompt`
**Outputs:** `mutations[]`, `responses[]`, `inconsistencies[]`

---

### FACTUAL_GROUND
| Attribute | Value |
|-----------|-------|
| **UI Name** | Source Verification |
| **Scientific Name** | Factual Grounding Verification |
| **Code** | `FACTUAL_GROUND` |
| **Description** | Verify claims against retrieved documents with evidence mapping |
| **Research** | Factual Grounding Research 2025 |
| **Accuracy** | Grounding accuracy +45% |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `retrieval_top_k` | integer | 5 | Documents to retrieve |
| `evidence_threshold` | number | 0.7 | Evidence support threshold |
| `require_explicit_support` | boolean | true | Require explicit evidence |

**Inputs:** `claim`, `documents[]`
**Outputs:** `verdict`, `evidence_mapping[]`, `ungrounded_claims[]`

---

## Human-in-the-Loop Methods

### HITL_REVIEW
| Attribute | Value |
|-----------|-------|
| **UI Name** | Human Review Queue |
| **Scientific Name** | Human-in-the-Loop Review System |
| **Code** | `HITL_REVIEW` |
| **Description** | Route low-confidence or high-stakes outputs to human review |
| **Research** | Human-in-the-Loop ML Systems |
| **Accuracy** | Critical error prevention +90% |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `confidence_threshold` | number | 0.7 | Route to human below this |
| `stake_level` | enum | "medium" | Stake: low, medium, high, critical |
| `auto_approve_above` | number | 0.95 | Auto-approve above this confidence |
| `queue_priority` | enum | "fifo" | Queue ordering: fifo, priority, lifo |

**Inputs:** `response`, `confidence`, `context`
**Outputs:** `queued`, `queue_position`, `estimated_wait`

---

### TIERED_EVAL
| Attribute | Value |
|-----------|-------|
| **UI Name** | Multi-Level Review |
| **Scientific Name** | Tiered Evaluation Architecture |
| **Code** | `TIERED_EVAL` |
| **Description** | Multi-tier: AI auto → AI flag → human → expert |
| **Research** | Tiered Evaluation Architecture |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tiers` | array | ["auto", "ai_flag", "human", "expert"] | Evaluation tiers |
| `escalation_criteria` | string | "confidence" | Escalation trigger |
| `sla_hours` | integer | 24 | SLA for human review |

**Inputs:** `response`, `context`
**Outputs:** `tier_used`, `approvals[]`, `final_decision`

---

### ACTIVE_SAMPLE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Smart Sampling |
| **Scientific Name** | Active Learning Sample Selection |
| **Code** | `ACTIVE_SAMPLE` |
| **Description** | Select most informative samples for human labeling |
| **Research** | Active Learning for NLP |
| **Accuracy** | Labeling efficiency +60% |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `selection_strategy` | enum | "uncertainty" | Strategy: uncertainty, diversity, hybrid |
| `batch_size` | integer | 10 | Samples per batch |
| `diversity_weight` | number | 0.3 | Diversity in selection |

**Inputs:** `candidate_pool[]`
**Outputs:** `selected_samples[]`, `selection_reasons[]`

---

## Collaboration Methods

### ECON_NASH
| Attribute | Value |
|-----------|-------|
| **UI Name** | No-Communication Coordination |
| **Scientific Name** | ECON Bayesian Nash Equilibrium |
| **Code** | `ECON_NASH` |
| **Description** | Agents coordinate without message exchange using game theory |
| **Research** | ICML 2025 - ECON |
| **Accuracy** | +11.2% coordination, -21.4% resources |
| **Complexity** | Expert |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `num_agents` | integer | 3 | Number of agents |
| `equilibrium_type` | string | "bayesian_nash" | Equilibrium type |
| `utility_function` | string | "cooperative" | Utility: cooperative, competitive |

**Inputs:** `prompt`
**Outputs:** `coordinated_response`, `equilibrium_reached`, `agent_strategies[]`

---

## Neural Methods

### CATO_NEURAL
| Attribute | Value |
|-----------|-------|
| **UI Name** | Neural Decision |
| **Scientific Name** | Cato Neural Decision Engine |
| **Code** | `CATO_NEURAL` |
| **Description** | Integrates Cato safety pipeline with consciousness affect state and predictive coding for neural-informed decisions. Uses Control Barrier Functions for safety, affect-to-hyperparameter mapping for dynamic behavior, and active inference for uncertainty handling. |
| **Research** | RADIANT Cato Safety Architecture + Active Inference |
| **Complexity** | Expert |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `safety_mode` | enum | "enforce" | CBF mode: enforce, warn, monitor |
| `use_affect_mapping` | boolean | true | Map affect to hyperparameters |
| `use_predictive_coding` | boolean | true | Enable active inference |
| `precision_governor_enabled` | boolean | true | Limit confidence by epistemic state |
| `cbf_threshold` | number | 0.95 | Safety barrier threshold (0.8-1.0) |
| `affect_influence.frustration_temperature_scale` | number | 0.2 | Temperature reduction when frustrated |
| `affect_influence.curiosity_exploration_boost` | number | 0.3 | Exploration increase when curious |
| `affect_influence.low_efficacy_escalation` | boolean | true | Escalate on low self-efficacy |
| `prediction_config.generate_predictions` | boolean | true | Generate predictions |
| `prediction_config.track_surprise` | boolean | true | Track surprise |
| `prediction_config.learning_threshold` | number | 0.5 | Surprise threshold for learning |
| `escalation_config.auto_escalate_on_uncertainty` | boolean | true | Auto-escalate on uncertainty |
| `escalation_config.uncertainty_threshold` | number | 0.7 | Uncertainty threshold |
| `escalation_config.human_escalation_enabled` | boolean | true | Enable human escalation |

**Inputs:** `prompt`, `context`, `affect_state`
**Outputs:** `response`, `safety_verdict`, `hyperparameters_used`, `predictions[]`

---

# System Workflows

All 49 system workflows are protected—admins can only modify configuration and enabled status, not workflow definitions.

---

## Adversarial & Validation

### ARE - Red Team Attack
| Attribute | Value |
|-----------|-------|
| **UI Name** | Red Team Attack |
| **Scientific Name** | Adversarial Robustness Evaluation |
| **Code** | `ARE` |
| **Category** | Adversarial & Validation |
| **Description** | One AI probes another for vulnerabilities, safety failures, and edge cases |
| **Quality Improvement** | Identifies 80-95% of vulnerabilities |
| **Latency** | High |
| **Cost** | High |
| **Min Models** | 2 |

**Best For:** `security_testing`, `safety_validation`, `edge_case_discovery`, `robustness_testing`
**Problem Indicators:** `safety_critical`, `needs_validation`, `security_concern`, `untrusted_input`

---

### LM_VS_LM - Cross-Examination
| Attribute | Value |
|-----------|-------|
| **UI Name** | Cross-Examination |
| **Scientific Name** | LM vs LM Factual Verification |
| **Code** | `LM_VS_LM` |
| **Category** | Adversarial & Validation |
| **Description** | Interrogator AI repeatedly questions responder AI's claims to expose inconsistencies and hallucinations |
| **Quality Improvement** | Reduces hallucinations by 40-60% |
| **Latency** | High |
| **Cost** | High |
| **Min Models** | 2 |

**Best For:** `fact_checking`, `claim_verification`, `hallucination_detection`, `interview_simulation`
**Problem Indicators:** `factual_claims`, `needs_verification`, `potential_hallucination`, `complex_reasoning`

---

## Debate & Deliberation

### SOD - AI Debate
| Attribute | Value |
|-----------|-------|
| **UI Name** | AI Debate |
| **Scientific Name** | Scalable Oversight via Debate |
| **Code** | `SOD` |
| **Category** | Debate & Deliberation |
| **Description** | Two AIs argue opposing positions to convince a judge; truthful arguments should win |
| **Quality Improvement** | Improves decision quality by 25-35% |
| **Latency** | Very High |
| **Cost** | Very High |
| **Min Models** | 3 |

**Best For:** `controversial_topics`, `decision_making`, `policy_analysis`, `ethical_dilemmas`
**Problem Indicators:** `multiple_viewpoints`, `controversial`, `needs_balanced_view`, `complex_decision`

---

### MDA - Multi-Agent Debate
| Attribute | Value |
|-----------|-------|
| **UI Name** | Multi-Agent Debate |
| **Scientific Name** | Multiagent Deliberative Alignment |
| **Code** | `MDA` |
| **Category** | Debate & Deliberation |
| **Description** | Multiple LLM instances propose, critique, and refine until consensus |
| **Quality Improvement** | Consensus quality +30-45% |
| **Latency** | Very High |
| **Cost** | Very High |
| **Min Models** | 3 |

**Best For:** `complex_problems`, `consensus_building`, `brainstorming`, `research_synthesis`
**Problem Indicators:** `needs_consensus`, `multiple_approaches`, `collaborative_task`, `complex_problem`

---

### ReConcile - Round Table Consensus
| Attribute | Value |
|-----------|-------|
| **UI Name** | Round Table Consensus |
| **Scientific Name** | Reconciled Ensemble Deliberation |
| **Code** | `ReConcile` |
| **Category** | Debate & Deliberation |
| **Description** | Heterogeneous models from different providers reconcile viewpoints iteratively |
| **Quality Improvement** | Reduces provider bias by 50-70% |
| **Latency** | Very High |
| **Cost** | High |
| **Min Models** | 3 |

**Best For:** `cross_provider_synthesis`, `bias_reduction`, `comprehensive_analysis`, `balanced_output`
**Problem Indicators:** `provider_bias_concern`, `needs_diversity`, `comprehensive_coverage`, `balanced_perspective`

---

## Judge & Critic

### LAAJE - AI Judge
| Attribute | Value |
|-----------|-------|
| **UI Name** | AI Judge |
| **Scientific Name** | LLM-as-a-Judge Evaluation |
| **Code** | `LAAJE` |
| **Category** | Judge & Critic |
| **Description** | Designated AI evaluates outputs using pointwise, pairwise, or listwise modes |
| **Quality Improvement** | Evaluation accuracy 85-95% |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 2 |

**Best For:** `quality_evaluation`, `comparison`, `ranking`, `selection`
**Problem Indicators:** `multiple_options`, `needs_ranking`, `quality_assessment`, `best_selection`

---

### RLAIF - Constitutional Critic
| Attribute | Value |
|-----------|-------|
| **UI Name** | Constitutional Critic |
| **Scientific Name** | Reinforcement Learning from AI Feedback |
| **Code** | `RLAIF` |
| **Category** | Judge & Critic |
| **Description** | AI critiques/revises against explicit principles; Constitutional AI pattern |
| **Quality Improvement** | Alignment improvement 60-80% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 2 |

**Best For:** `safety_alignment`, `policy_compliance`, `ethical_review`, `guideline_adherence`
**Problem Indicators:** `needs_alignment`, `policy_check`, `ethical_concern`, `compliance_required`

---

### IREF - Critique-Revise Loop
| Attribute | Value |
|-----------|-------|
| **UI Name** | Critique-Revise Loop |
| **Scientific Name** | Iterative Refinement with External Feedback |
| **Code** | `IREF` |
| **Category** | Judge & Critic |
| **Description** | Generator → Critic identifies flaws → Generator revises; repeats until quality threshold |
| **Quality Improvement** | Quality improvement per iteration: 15-25% |
| **Latency** | High |
| **Cost** | High |
| **Min Models** | 2 |

**Best For:** `iterative_improvement`, `quality_refinement`, `error_correction`, `polish`
**Problem Indicators:** `needs_refinement`, `quality_critical`, `iterative_task`, `perfectionist`

---

## Ensemble & Aggregation

### SCMR - Majority Vote
| Attribute | Value |
|-----------|-------|
| **UI Name** | Majority Vote |
| **Scientific Name** | Self-Consistency via Marginal Reasoning |
| **Code** | `SCMR` |
| **Category** | Ensemble & Aggregation |
| **Description** | Same prompt to N instances, select most common answer |
| **Quality Improvement** | +15-25% accuracy on factual tasks |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 3 |

**Best For:** `factual_questions`, `multiple_choice`, `classification`, `simple_reasoning`
**Problem Indicators:** `objective_answer`, `clear_correct_answer`, `factual_query`, `classification_task`

---

### CWMA - Weighted Ensemble
| Attribute | Value |
|-----------|-------|
| **UI Name** | Weighted Ensemble |
| **Scientific Name** | Confidence-Weighted Model Aggregation |
| **Code** | `CWMA` |
| **Category** | Ensemble & Aggregation |
| **Description** | Weight model contributions by confidence, accuracy, or domain expertise |
| **Quality Improvement** | +20-35% over simple averaging |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 3 |

**Best For:** `domain_expertise`, `confidence_critical`, `weighted_synthesis`, `expert_combination`
**Problem Indicators:** `domain_specific`, `expertise_required`, `confidence_matters`, `specialized_knowledge`

---

### SMoE - Mixture Router
| Attribute | Value |
|-----------|-------|
| **UI Name** | Mixture Router |
| **Scientific Name** | Sparse Mixture-of-Experts Routing |
| **Code** | `SMoE` |
| **Category** | Ensemble & Aggregation |
| **Description** | Lightweight router selects specialist AI(s) per input |
| **Quality Improvement** | Cost reduction 40-60% with same quality |
| **Latency** | Low |
| **Cost** | Low |
| **Min Models** | 2 |

**Best For:** `routing`, `specialization`, `efficiency`, `domain_detection`
**Problem Indicators:** `unknown_domain`, `needs_specialist`, `efficiency_critical`, `variable_task_type`

---

## Reflection & Self-Improvement

### ISFR - Self-Refine Loop
| Attribute | Value |
|-----------|-------|
| **UI Name** | Self-Refine Loop |
| **Scientific Name** | Iterative Self-Feedback Refinement |
| **Code** | `ISFR` |
| **Category** | Reflection & Self-Improvement |
| **Description** | AI generates → self-critiques → refines until satisfactory |
| **Quality Improvement** | +20-30% quality per iteration |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `writing`, `code_improvement`, `iterative_tasks`, `quality_improvement`
**Problem Indicators:** `needs_polish`, `iterative_improvement`, `quality_critical`, `refinement_needed`

---

### VRL - Reflexion Agent
| Attribute | Value |
|-----------|-------|
| **UI Name** | Reflexion Agent |
| **Scientific Name** | Verbal Reinforcement Learning |
| **Code** | `VRL` |
| **Category** | Reflection & Self-Improvement |
| **Description** | Agent reflects on failures, stores insights in episodic memory, improves without gradients |
| **Quality Improvement** | +30-50% on repeated tasks |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `agentic_tasks`, `learning_from_failure`, `adaptive_behavior`, `long_term_improvement`
**Problem Indicators:** `repeated_task`, `learning_opportunity`, `failure_recovery`, `adaptive_needed`

---

### LATS - Tree Search Reasoning
| Attribute | Value |
|-----------|-------|
| **UI Name** | Tree Search Reasoning |
| **Scientific Name** | Language Agent Tree Search |
| **Code** | `LATS` |
| **Category** | Reflection & Self-Improvement |
| **Description** | Monte-Carlo tree search exploring reasoning paths with backpropagation |
| **Quality Improvement** | 4%→74% on puzzle tasks |
| **Latency** | Very High |
| **Cost** | Very High |
| **Min Models** | 1 |

**Best For:** `complex_reasoning`, `planning`, `search_problems`, `optimization`
**Problem Indicators:** `search_problem`, `multiple_paths`, `optimization`, `complex_planning`

---

## Verification & Fact-Checking

### CoVe - Chain of Verification
| Attribute | Value |
|-----------|-------|
| **UI Name** | Chain of Verification |
| **Scientific Name** | Stepwise Verification Prompting |
| **Code** | `CoVe` |
| **Category** | Verification & Fact-Checking |
| **Description** | Draft → generate verification questions → answer independently → verified output |
| **Quality Improvement** | Reduces factual errors by 30-50% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `fact_checking`, `claim_verification`, `accuracy_critical`, `research`
**Problem Indicators:** `factual_claims`, `needs_verification`, `accuracy_critical`, `research_output`

---

### SelfRAG - Retrieval-Augmented Verification
| Attribute | Value |
|-----------|-------|
| **UI Name** | Retrieval-Augmented Verification |
| **Scientific Name** | Self-Reflective RAG |
| **Code** | `SelfRAG` |
| **Category** | Verification & Fact-Checking |
| **Description** | AI self-critiques, fetches documents if needed, validates against evidence |
| **Quality Improvement** | Factual accuracy +40-60% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `research`, `fact_checking`, `document_based`, `evidence_required`
**Problem Indicators:** `needs_sources`, `research_task`, `evidence_based`, `document_analysis`

---

## Multi-Agent Collaboration

### LLM_MAS - Agent Team
| Attribute | Value |
|-----------|-------|
| **UI Name** | Agent Team |
| **Scientific Name** | LLM-based Multi-Agent Systems |
| **Code** | `LLM_MAS` |
| **Category** | Multi-Agent Collaboration |
| **Description** | Specialized agents with distinct roles collaborate via natural language |
| **Quality Improvement** | Complex task completion +40-60% |
| **Latency** | Very High |
| **Cost** | High |
| **Min Models** | 3 |

**Best For:** `complex_projects`, `multi_skill`, `collaborative`, `project_management`
**Problem Indicators:** `multi_disciplinary`, `complex_project`, `needs_coordination`, `diverse_skills`

---

### MAPR - Peer Review Pipeline
| Attribute | Value |
|-----------|-------|
| **UI Name** | Peer Review Pipeline |
| **Scientific Name** | Multi-Agent Peer Review |
| **Code** | `MAPR` |
| **Category** | Multi-Agent Collaboration |
| **Description** | Sequential review chain where each agent reviews prior agent's work |
| **Quality Improvement** | Error reduction 50-70% |
| **Latency** | High |
| **Cost** | High |
| **Min Models** | 3 |

**Best For:** `document_review`, `quality_assurance`, `sequential_improvement`, `editorial`
**Problem Indicators:** `needs_review`, `quality_critical`, `sequential_task`, `editorial_process`

---

## Reasoning Enhancement

### CoT - Chain-of-Thought
| Attribute | Value |
|-----------|-------|
| **UI Name** | Chain-of-Thought |
| **Scientific Name** | CoT Prompting |
| **Code** | `CoT` |
| **Category** | Reasoning Enhancement |
| **Description** | Step-by-step reasoning before final answer |
| **Quality Improvement** | +20-40% on math/logic |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `math`, `logic`, `reasoning`, `problem_solving`
**Problem Indicators:** `requires_reasoning`, `multi_step`, `logical_problem`, `math_problem`

---

### ZeroShotCoT - Zero-Shot CoT
| Attribute | Value |
|-----------|-------|
| **UI Name** | Zero-Shot CoT |
| **Scientific Name** | "Let's think step by step" |
| **Code** | `ZeroShotCoT` |
| **Category** | Reasoning Enhancement |
| **Description** | Add "Let's think step by step" to prompt without examples |
| **Quality Improvement** | +15-30% without examples |
| **Latency** | Low |
| **Cost** | Low |
| **Min Models** | 1 |

**Best For:** `general_reasoning`, `quick_improvement`, `no_examples_available`
**Problem Indicators:** `reasoning_needed`, `no_examples`, `general_question`

---

### ToT - Tree-of-Thoughts
| Attribute | Value |
|-----------|-------|
| **UI Name** | Tree-of-Thoughts |
| **Scientific Name** | ToT with BFS/DFS |
| **Code** | `ToT` |
| **Category** | Reasoning Enhancement |
| **Description** | Explore multiple reasoning paths with breadth/depth-first search |
| **Quality Improvement** | 4%→74% on puzzles |
| **Latency** | Very High |
| **Cost** | Very High |
| **Min Models** | 1 |

**Best For:** `puzzles`, `creative_writing`, `planning`, `exploration`
**Problem Indicators:** `multiple_solutions`, `creative_task`, `exploration_needed`, `puzzle`

---

### GoT - Graph-of-Thoughts
| Attribute | Value |
|-----------|-------|
| **UI Name** | Graph-of-Thoughts |
| **Scientific Name** | GoT Synthesis |
| **Code** | `GoT` |
| **Category** | Reasoning Enhancement |
| **Description** | Thought units as graph nodes with arbitrary connections |
| **Quality Improvement** | +62% over ToT on sorting |
| **Latency** | Very High |
| **Cost** | Very High |
| **Min Models** | 1 |

**Best For:** `complex_synthesis`, `interconnected_reasoning`, `sorting`, `complex_logic`
**Problem Indicators:** `complex_relationships`, `synthesis_needed`, `interconnected_concepts`

---

### ReAct - Reasoning + Acting
| Attribute | Value |
|-----------|-------|
| **UI Name** | ReAct |
| **Scientific Name** | Reasoning + Acting |
| **Code** | `ReAct` |
| **Category** | Reasoning Enhancement |
| **Description** | Interleave reasoning and acting with external tools |
| **Quality Improvement** | +34% on interactive tasks |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `tool_use`, `interactive_tasks`, `research`, `agentic`
**Problem Indicators:** `needs_tools`, `interactive`, `external_data`, `agentic_task`

---

### L2M - Least-to-Most
| Attribute | Value |
|-----------|-------|
| **UI Name** | Least-to-Most |
| **Scientific Name** | Decomposition Prompting |
| **Code** | `L2M` |
| **Category** | Reasoning Enhancement |
| **Description** | Decompose problem into subproblems, solve smallest first |
| **Quality Improvement** | 16%→99% on SCAN |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `compositional`, `hierarchical`, `step_building`
**Problem Indicators:** `compositional_task`, `can_decompose`, `builds_on_previous`

---

### PS - Plan-and-Solve
| Attribute | Value |
|-----------|-------|
| **UI Name** | Plan-and-Solve |
| **Scientific Name** | Explicit Planning |
| **Code** | `PS` |
| **Category** | Reasoning Enhancement |
| **Description** | Devise plan then execute step by step |
| **Quality Improvement** | Matches 8-shot CoT |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `complex_tasks`, `planning`, `structured_problems`
**Problem Indicators:** `needs_planning`, `complex_execution`, `structured_approach`

---

### MCP - Metacognitive Prompting
| Attribute | Value |
|-----------|-------|
| **UI Name** | Metacognitive Prompting |
| **Scientific Name** | 5-stage reflection |
| **Code** | `MCP` |
| **Category** | Reasoning Enhancement |
| **Description** | Understand, decompose, execute, self-verify, refine |
| **Quality Improvement** | Beats CoT on NLU |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `nlu`, `comprehension`, `thorough_analysis`
**Problem Indicators:** `comprehension_critical`, `needs_verification`, `thorough_needed`

---

### PoT - Program-of-Thought
| Attribute | Value |
|-----------|-------|
| **UI Name** | Program-of-Thought |
| **Scientific Name** | Code-based Reasoning |
| **Code** | `PoT` |
| **Category** | Reasoning Enhancement |
| **Description** | Generate code to solve math problems |
| **Quality Improvement** | For mathematical computation |
| **Latency** | Medium |
| **Cost** | Low |
| **Min Models** | 1 |

**Best For:** `math`, `computation`, `algorithmic`
**Problem Indicators:** `mathematical`, `needs_computation`, `algorithmic_solution`

---

## Model Routing Strategies

### SINGLE - Single Model
| Attribute | Value |
|-----------|-------|
| **UI Name** | Single Model |
| **Scientific Name** | Primary model only |
| **Code** | `SINGLE` |
| **Category** | Model Routing Strategies |
| **Description** | Route to single best model for fastest response |
| **Quality Improvement** | Fastest, lowest cost |
| **Latency** | Low |
| **Cost** | Low |
| **Min Models** | 1 |

**Best For:** `simple_tasks`, `speed_critical`, `cost_sensitive`
**Problem Indicators:** `simple_task`, `speed_priority`, `cost_priority`

---

### ENSEMBLE - Ensemble
| Attribute | Value |
|-----------|-------|
| **UI Name** | Ensemble |
| **Scientific Name** | Query multiple, synthesize |
| **Code** | `ENSEMBLE` |
| **Category** | Model Routing Strategies |
| **Description** | Query multiple models and synthesize results with conflict detection |
| **Quality Improvement** | Best overall quality |
| **Latency** | High |
| **Cost** | High |
| **Min Models** | 3 |

**Best For:** `important_decisions`, `quality_critical`, `diverse_perspectives`
**Problem Indicators:** `quality_priority`, `needs_diversity`, `important_task`

---

### CASCADE - Cascade
| Attribute | Value |
|-----------|-------|
| **UI Name** | Cascade |
| **Scientific Name** | Escalate on low confidence |
| **Code** | `CASCADE` |
| **Category** | Model Routing Strategies |
| **Description** | Start with cheap model, escalate to better if confidence below threshold |
| **Quality Improvement** | Cost reduction 40-60% |
| **Latency** | Variable |
| **Cost** | Low |
| **Min Models** | 2 |

**Best For:** `variable_complexity`, `cost_optimization`, `adaptive`
**Problem Indicators:** `unknown_complexity`, `cost_conscious`, `adaptive_quality`

---

### SPECIALIST - Specialist Routing
| Attribute | Value |
|-----------|-------|
| **UI Name** | Specialist Routing |
| **Scientific Name** | Route to domain expert |
| **Code** | `SPECIALIST` |
| **Category** | Model Routing Strategies |
| **Description** | Route to best model per content type/domain |
| **Quality Improvement** | Best domain performance |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 2 |

**Best For:** `domain_specific`, `specialized_tasks`, `expert_needed`
**Problem Indicators:** `specific_domain`, `expert_knowledge`, `specialized_task`

---

## Domain-Specific Orchestration

### DOMAIN_INJECT - Domain Expert Injection
| Attribute | Value |
|-----------|-------|
| **UI Name** | Domain Expert Injection |
| **Scientific Name** | Prepend domain prompts |
| **Code** | `DOMAIN_INJECT` |
| **Category** | Domain-Specific Orchestration |
| **Description** | Prepend domain-specific system prompts based on 800+ domain routing |
| **Quality Improvement** | Domain accuracy +20-40% |
| **Latency** | Low |
| **Cost** | Low |
| **Min Models** | 1 |

**Best For:** `domain_tasks`, `specialized_knowledge`, `professional_contexts`
**Problem Indicators:** `domain_specific`, `professional_context`, `specialized_knowledge`

---

### MULTI_EXPERT - Multi-Expert Consensus
| Attribute | Value |
|-----------|-------|
| **UI Name** | Multi-Expert Consensus |
| **Scientific Name** | Multiple domain experts |
| **Code** | `MULTI_EXPERT` |
| **Category** | Domain-Specific Orchestration |
| **Description** | Route to multiple domain experts, synthesize |
| **Quality Improvement** | Expert consensus quality +30% |
| **Latency** | High |
| **Cost** | High |
| **Min Models** | 3 |

**Best For:** `complex_domain`, `cross_functional`, `expert_consensus`
**Problem Indicators:** `multi_domain`, `expert_critical`, `consensus_needed`

---

### CHALLENGER_CONSENSUS - Challenger + Consensus
| Attribute | Value |
|-----------|-------|
| **UI Name** | Challenger + Consensus |
| **Scientific Name** | Baseline then challenge |
| **Code** | `CHALLENGER_CONSENSUS` |
| **Category** | Domain-Specific Orchestration |
| **Description** | Baseline round → Challenger round questioning assumptions → Synthesis |
| **Quality Improvement** | Removes blind spots +40% |
| **Latency** | High |
| **Cost** | High |
| **Min Models** | 2 |

**Best For:** `assumption_testing`, `robust_analysis`, `critical_thinking`
**Problem Indicators:** `assumptions_present`, `needs_challenge`, `robust_required`

---

### CROSS_DOMAIN - Cross-Domain Synthesis
| Attribute | Value |
|-----------|-------|
| **UI Name** | Cross-Domain Synthesis |
| **Scientific Name** | Multi-domain merge |
| **Code** | `CROSS_DOMAIN` |
| **Category** | Domain-Specific Orchestration |
| **Description** | Detect multi-domain queries, route to each expert, merge insights |
| **Quality Improvement** | Cross-domain insight +50% |
| **Latency** | High |
| **Cost** | High |
| **Min Models** | 3 |

**Best For:** `interdisciplinary`, `cross_functional`, `holistic_analysis`
**Problem Indicators:** `multi_domain`, `interdisciplinary`, `holistic_needed`

---

## Cognitive Frameworks

### FIRST_PRINCIPLES - First Principles Thinking
| Attribute | Value |
|-----------|-------|
| **UI Name** | First Principles Thinking |
| **Scientific Name** | Decompose to fundamentals |
| **Code** | `FIRST_PRINCIPLES` |
| **Category** | Cognitive Frameworks |
| **Description** | Decompose problem to fundamental truths and rebuild solution |
| **Quality Improvement** | Novel solutions +60% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `innovation`, `fundamental_analysis`, `breakthrough_thinking`
**Problem Indicators:** `needs_innovation`, `fundamental_question`, `conventional_failed`

---

### ANALOGICAL - Analogical Reasoning
| Attribute | Value |
|-----------|-------|
| **UI Name** | Analogical Reasoning |
| **Scientific Name** | Cross-domain patterns |
| **Code** | `ANALOGICAL` |
| **Category** | Cognitive Frameworks |
| **Description** | Find analogies from other domains to solve current problem |
| **Quality Improvement** | Creative solutions +40% |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `creative_solutions`, `cross_domain`, `pattern_matching`
**Problem Indicators:** `stuck_on_problem`, `needs_creativity`, `pattern_available`

---

### SYSTEMS - Systems Thinking
| Attribute | Value |
|-----------|-------|
| **UI Name** | Systems Thinking |
| **Scientific Name** | Feedback loops, emergence |
| **Code** | `SYSTEMS` |
| **Category** | Cognitive Frameworks |
| **Description** | Analyze as interconnected system with feedback loops and emergent properties |
| **Quality Improvement** | System understanding +50% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `complex_systems`, `organizational`, `ecosystem_analysis`
**Problem Indicators:** `complex_system`, `interconnected`, `feedback_present`

---

### SOCRATIC - Socratic Method
| Attribute | Value |
|-----------|-------|
| **UI Name** | Socratic Method |
| **Scientific Name** | Dialectical questioning |
| **Code** | `SOCRATIC` |
| **Category** | Cognitive Frameworks |
| **Description** | Use probing questions to stimulate critical thinking and illuminate ideas |
| **Quality Improvement** | Understanding depth +40% |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `learning`, `clarification`, `deep_understanding`
**Problem Indicators:** `needs_clarity`, `learning_context`, `deep_dive`

---

### TRIZ - TRIZ
| Attribute | Value |
|-----------|-------|
| **UI Name** | TRIZ |
| **Scientific Name** | Contradiction resolution |
| **Code** | `TRIZ` |
| **Category** | Cognitive Frameworks |
| **Description** | Use contradiction matrices and 40 inventive principles |
| **Quality Improvement** | Inventive solutions +70% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `engineering`, `invention`, `contradiction_resolution`
**Problem Indicators:** `contradiction_present`, `engineering_problem`, `invention_needed`

---

### DESIGN_THINKING - Design Thinking
| Attribute | Value |
|-----------|-------|
| **UI Name** | Design Thinking |
| **Scientific Name** | Empathize→Define→Ideate→Prototype→Test |
| **Code** | `DESIGN_THINKING` |
| **Category** | Cognitive Frameworks |
| **Description** | Human-centered design process with iteration |
| **Quality Improvement** | User satisfaction +50% |
| **Latency** | Very High |
| **Cost** | High |
| **Min Models** | 1 |

**Best For:** `product_design`, `user_experience`, `innovation`
**Problem Indicators:** `user_focused`, `design_problem`, `needs_iteration`

---

### SCIENTIFIC - Scientific Method
| Attribute | Value |
|-----------|-------|
| **UI Name** | Scientific Method |
| **Scientific Name** | Hypothesis→Experiment→Analysis |
| **Code** | `SCIENTIFIC` |
| **Category** | Cognitive Frameworks |
| **Description** | Formulate hypothesis, design experiment, analyze results |
| **Quality Improvement** | Rigorous conclusions +60% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `research`, `investigation`, `empirical_questions`
**Problem Indicators:** `testable_question`, `research_needed`, `empirical`

---

### LATERAL - Lateral Thinking
| Attribute | Value |
|-----------|-------|
| **UI Name** | Lateral Thinking |
| **Scientific Name** | Random entry, provocation |
| **Code** | `LATERAL` |
| **Category** | Cognitive Frameworks |
| **Description** | Use random stimuli and provocations to break conventional thinking |
| **Quality Improvement** | Creative breakthroughs +80% |
| **Latency** | Medium |
| **Cost** | Low |
| **Min Models** | 1 |

**Best For:** `creativity`, `brainstorming`, `unconventional_solutions`
**Problem Indicators:** `stuck_in_rut`, `needs_creativity`, `brainstorming`

---

### ABDUCTIVE - Abductive Reasoning
| Attribute | Value |
|-----------|-------|
| **UI Name** | Abductive Reasoning |
| **Scientific Name** | Inference to best explanation |
| **Code** | `ABDUCTIVE` |
| **Category** | Cognitive Frameworks |
| **Description** | Generate and evaluate hypotheses to find best explanation |
| **Quality Improvement** | Explanation quality +40% |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `diagnosis`, `investigation`, `hypothesis_generation`
**Problem Indicators:** `unexplained_phenomenon`, `diagnosis_needed`, `mystery`

---

### COUNTERFACTUAL - Counterfactual Thinking
| Attribute | Value |
|-----------|-------|
| **UI Name** | Counterfactual Thinking |
| **Scientific Name** | What-if analysis |
| **Code** | `COUNTERFACTUAL` |
| **Category** | Cognitive Frameworks |
| **Description** | Explore alternative scenarios and their implications |
| **Quality Improvement** | Risk identification +50% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `planning`, `risk_analysis`, `scenario_planning`
**Problem Indicators:** `scenario_analysis`, `risk_assessment`, `planning`

---

### DIALECTICAL - Dialectical Thinking
| Attribute | Value |
|-----------|-------|
| **UI Name** | Dialectical Thinking |
| **Scientific Name** | Thesis-antithesis-synthesis |
| **Code** | `DIALECTICAL` |
| **Category** | Cognitive Frameworks |
| **Description** | Explore opposing views to reach higher synthesis |
| **Quality Improvement** | Balanced conclusions +45% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `philosophy`, `conflict_resolution`, `synthesis`
**Problem Indicators:** `opposing_views`, `conflict_present`, `synthesis_needed`

---

### MORPHOLOGICAL - Morphological Analysis
| Attribute | Value |
|-----------|-------|
| **UI Name** | Morphological Analysis |
| **Scientific Name** | Parameter space exploration |
| **Code** | `MORPHOLOGICAL` |
| **Category** | Cognitive Frameworks |
| **Description** | Systematically explore all possible parameter combinations |
| **Quality Improvement** | Option coverage +70% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `systematic_exploration`, `option_generation`, `completeness`
**Problem Indicators:** `many_parameters`, `systematic_needed`, `completeness_required`

---

### PREMORTEM - Pre-mortem Analysis
| Attribute | Value |
|-----------|-------|
| **UI Name** | Pre-mortem Analysis |
| **Scientific Name** | Prospective hindsight |
| **Code** | `PREMORTEM` |
| **Category** | Cognitive Frameworks |
| **Description** | Imagine failure has occurred and work backwards to identify causes |
| **Quality Improvement** | Risk mitigation +60% |
| **Latency** | Medium |
| **Cost** | Low |
| **Min Models** | 1 |

**Best For:** `risk_management`, `project_planning`, `failure_prevention`
**Problem Indicators:** `project_start`, `risk_critical`, `planning_phase`

---

### FERMI - Fermi Estimation
| Attribute | Value |
|-----------|-------|
| **UI Name** | Fermi Estimation |
| **Scientific Name** | Order of magnitude reasoning |
| **Code** | `FERMI` |
| **Category** | Cognitive Frameworks |
| **Description** | Break down estimation into smaller, estimable components |
| **Quality Improvement** | Estimation accuracy +50% |
| **Latency** | Low |
| **Cost** | Low |
| **Min Models** | 1 |

**Best For:** `estimation`, `quick_analysis`, `order_of_magnitude`
**Problem Indicators:** `unknown_quantity`, `estimation_needed`, `limited_data`

---

# Quick Reference Tables

## Workflows by Category

| Category | Count | Workflows |
|----------|-------|-----------|
| Adversarial & Validation | 2 | ARE, LM_VS_LM |
| Debate & Deliberation | 3 | SOD, MDA, ReConcile |
| Judge & Critic | 3 | LAAJE, RLAIF, IREF |
| Ensemble & Aggregation | 3 | SCMR, CWMA, SMoE |
| Reflection & Self-Improvement | 3 | ISFR, VRL, LATS |
| Verification & Fact-Checking | 2 | CoVe, SelfRAG |
| Multi-Agent Collaboration | 2 | LLM_MAS, MAPR |
| Reasoning Enhancement | 9 | CoT, ZeroShotCoT, ToT, GoT, ReAct, L2M, PS, MCP, PoT |
| Model Routing Strategies | 4 | SINGLE, ENSEMBLE, CASCADE, SPECIALIST |
| Domain-Specific Orchestration | 4 | DOMAIN_INJECT, MULTI_EXPERT, CHALLENGER_CONSENSUS, CROSS_DOMAIN |
| Cognitive Frameworks | 14 | FIRST_PRINCIPLES, ANALOGICAL, SYSTEMS, SOCRATIC, TRIZ, DESIGN_THINKING, SCIENTIFIC, LATERAL, ABDUCTIVE, COUNTERFACTUAL, DIALECTICAL, MORPHOLOGICAL, PREMORTEM, FERMI |

## Workflows by Cost/Latency

| Cost | Low Latency | Medium Latency | High Latency | Very High Latency |
|------|-------------|----------------|--------------|-------------------|
| **Low** | ZeroShotCoT, SINGLE, FERMI, LATERAL | PoT, SMoE | - | - |
| **Medium** | - | CoT, PS, SCMR, CWMA, SOCRATIC, ABDUCTIVE, ANALOGICAL | CoVe, SelfRAG, ReAct, L2M, VRL, MCP, ISFR, RLAIF, FIRST_PRINCIPLES, SYSTEMS, SCIENTIFIC, COUNTERFACTUAL, DIALECTICAL, MORPHOLOGICAL, PREMORTEM, TRIZ | - |
| **High** | - | LAAJE, SPECIALIST | ARE, LM_VS_LM, IREF, MAPR, MULTI_EXPERT, CHALLENGER_CONSENSUS, CROSS_DOMAIN, LLM_MAS | DESIGN_THINKING |
| **Very High** | - | - | - | SOD, MDA, ReConcile, LATS, ToT, GoT |

## Workflows by Minimum Models Required

| Min Models | Workflows |
|------------|-----------|
| 1 | CoT, ZeroShotCoT, ToT, GoT, ReAct, L2M, PS, MCP, PoT, SINGLE, ISFR, VRL, LATS, CoVe, SelfRAG, DOMAIN_INJECT, FIRST_PRINCIPLES, ANALOGICAL, SYSTEMS, SOCRATIC, TRIZ, DESIGN_THINKING, SCIENTIFIC, LATERAL, ABDUCTIVE, COUNTERFACTUAL, DIALECTICAL, MORPHOLOGICAL, PREMORTEM, FERMI |
| 2 | ARE, LM_VS_LM, LAAJE, RLAIF, IREF, SMoE, CASCADE, SPECIALIST, CHALLENGER_CONSENSUS |
| 3 | SOD, MDA, ReConcile, SCMR, CWMA, LLM_MAS, MAPR, ENSEMBLE, MULTI_EXPERT, CROSS_DOMAIN |

---

*Generated for RADIANT v5.2.2 - Complete Orchestration Reference*
