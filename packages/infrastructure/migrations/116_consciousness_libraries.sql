-- Migration: 116_consciousness_libraries.sql
-- Description: Database tables for 16 consciousness libraries implementation
-- Based on: Think Tank Consciousness Service Unified Implementation Prompt

-- ============================================================================
-- HippoRAG Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS hipporag_documents (
    doc_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    indexed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (doc_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS hipporag_entities (
    entity_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    embedding VECTOR(1536),
    importance FLOAT DEFAULT 1.0,
    document_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (entity_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS hipporag_relations (
    relation_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    source_entity_id TEXT NOT NULL,
    target_entity_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    weight FLOAT DEFAULT 1.0,
    document_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (relation_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_hipporag_entities_tenant ON hipporag_entities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hipporag_entities_name ON hipporag_entities(tenant_id, LOWER(name));
CREATE INDEX IF NOT EXISTS idx_hipporag_relations_source ON hipporag_relations(tenant_id, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_hipporag_relations_target ON hipporag_relations(tenant_id, target_entity_id);

-- ============================================================================
-- DreamerV3 Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS dreamerv3_trajectories (
    trajectory_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    start_state JSONB NOT NULL,
    steps JSONB NOT NULL,
    total_reward FLOAT NOT NULL,
    confidence FLOAT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS dreamerv3_counterfactuals (
    scenario_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    original_outcome TEXT NOT NULL,
    counterfactual_outcome TEXT NOT NULL,
    divergence_point TEXT,
    causal_factors JSONB DEFAULT '[]',
    confidence FLOAT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dreamerv3_dreams (
    dream_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    synthetic_experiences JSONB NOT NULL,
    memories_reinforced INT DEFAULT 0,
    novel_patterns INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dreamerv3_trajectories_tenant ON dreamerv3_trajectories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dreamerv3_counterfactuals_tenant ON dreamerv3_counterfactuals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dreamerv3_dreams_tenant ON dreamerv3_dreams(tenant_id);

-- ============================================================================
-- SpikingJelly Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS spikingjelly_binding_results (
    binding_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    stream_count INT NOT NULL,
    synchrony_score FLOAT NOT NULL,
    binding_detected BOOLEAN NOT NULL,
    binding_strength FLOAT NOT NULL,
    temporal_window INT NOT NULL,
    unified_percept TEXT,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spikingjelly_binding_tenant ON spikingjelly_binding_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_spikingjelly_binding_detected ON spikingjelly_binding_results(tenant_id, binding_detected);

-- ============================================================================
-- Butlin Consciousness Tests Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS butlin_consciousness_tests (
    suite_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    results JSONB NOT NULL,
    overall_score FLOAT NOT NULL,
    indicators_passed INT NOT NULL,
    indicators_total INT NOT NULL,
    consciousness_level TEXT NOT NULL,
    phi_score FLOAT,
    pci_score FLOAT,
    recommendations JSONB DEFAULT '[]',
    run_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_butlin_tests_tenant ON butlin_consciousness_tests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_butlin_tests_level ON butlin_consciousness_tests(tenant_id, consciousness_level);
CREATE INDEX IF NOT EXISTS idx_butlin_tests_date ON butlin_consciousness_tests(tenant_id, run_at DESC);

-- ============================================================================
-- Consciousness Library Registry Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS consciousness_library_registry (
    library_id TEXT PRIMARY KEY,
    library_name TEXT NOT NULL UNIQUE,
    python_package TEXT NOT NULL,
    version TEXT NOT NULL,
    license TEXT NOT NULL,
    consciousness_function TEXT NOT NULL,
    biological_analog TEXT NOT NULL,
    description TEXT,
    proficiencies JSONB NOT NULL,
    exposed_tools JSONB NOT NULL,
    dependencies JSONB DEFAULT '[]',
    expected_latency_ms INT,
    memory_footprint_mb INT,
    notes TEXT,
    thread_safety TEXT,
    python_version TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the 16 consciousness libraries
INSERT INTO consciousness_library_registry (library_id, library_name, python_package, version, license, consciousness_function, biological_analog, description, proficiencies, exposed_tools, dependencies, expected_latency_ms, memory_footprint_mb)
VALUES
-- Phase 1: Foundation
('letta', 'Letta', 'letta', '0.6.0', 'Apache-2.0', 'identity', 'Hippocampus', 
 'Persistent identity and tiered memory management (core/archival/recall)',
 '{"reasoning_depth":7,"mathematical_quantitative":5,"code_generation":6,"creative_generative":6,"research_synthesis":7,"factual_recall_precision":9,"multi_step_problem_solving":7,"domain_terminology_handling":7,"self_modeling_capability":9,"temporal_integration":8,"causal_reasoning":6,"metacognitive_accuracy":8}',
 '[{"name":"initialize_ego","description":"Bootstrap persistent identity"},{"name":"page_in_memory","description":"Retrieve from archival storage"},{"name":"update_core_memory","description":"Modify active self-model"},{"name":"consolidate_memories","description":"Sleep-cycle consolidation"}]',
 '[]', 100, 200),

('langgraph', 'LangGraph', 'langgraph', '0.2.0', 'MIT', 'cognitiveLoop', 'Thalamocortical Loop',
 'Cyclic cognitive processing with state management and module competition',
 '{"reasoning_depth":8,"mathematical_quantitative":6,"code_generation":7,"creative_generative":7,"research_synthesis":8,"factual_recall_precision":7,"multi_step_problem_solving":9,"domain_terminology_handling":7,"self_modeling_capability":7,"temporal_integration":9,"causal_reasoning":8,"metacognitive_accuracy":7}',
 '[{"name":"process_thought","description":"Run cognitive loop iteration"},{"name":"broadcast","description":"Broadcast to all modules"},{"name":"compete_for_attention","description":"Module competition for workspace"}]',
 '["langchain"]', 50, 100),

('pymdp', 'pymdp', 'inferactively-pymdp', '0.0.8', 'MIT', 'drive', 'Prefrontal Cortex',
 'Active inference with Expected Free Energy minimization for goal-directed behavior',
 '{"reasoning_depth":9,"mathematical_quantitative":9,"code_generation":4,"creative_generative":6,"research_synthesis":7,"factual_recall_precision":7,"multi_step_problem_solving":9,"domain_terminology_handling":8,"self_modeling_capability":8,"temporal_integration":8,"causal_reasoning":9,"metacognitive_accuracy":8}',
 '[{"name":"compute_expected_free_energy","description":"Evaluate action value"},{"name":"select_action","description":"Choose goal-directed action"},{"name":"update_beliefs","description":"Bayesian belief update"}]',
 '["numpy","scipy"]', 30, 50),

('graphrag', 'GraphRAG', 'graphrag', '0.3.0', 'MIT', 'grounding', 'Semantic Memory Networks',
 'Knowledge graph construction and retrieval for reality anchoring',
 '{"reasoning_depth":8,"mathematical_quantitative":6,"code_generation":5,"creative_generative":5,"research_synthesis":9,"factual_recall_precision":9,"multi_step_problem_solving":8,"domain_terminology_handling":9,"self_modeling_capability":6,"temporal_integration":7,"causal_reasoning":8,"metacognitive_accuracy":7}',
 '[{"name":"build_graph","description":"Construct knowledge graph from text"},{"name":"query_graph","description":"Retrieve grounded knowledge"},{"name":"global_search","description":"High-level thematic search"}]',
 '["networkx"]', 200, 300),

-- Phase 2: Consciousness Measurement
('pyphi', 'PyPhi', 'pyphi', '1.2.1', 'GPL-3.0', 'integration', 'Integrated Information Networks',
 'Official IIT implementation for Φ calculation and cause-effect structure analysis',
 '{"reasoning_depth":10,"mathematical_quantitative":10,"code_generation":3,"creative_generative":2,"research_synthesis":8,"factual_recall_precision":10,"multi_step_problem_solving":9,"domain_terminology_handling":9,"self_modeling_capability":8,"temporal_integration":7,"causal_reasoning":10,"metacognitive_accuracy":9}',
 '[{"name":"compute_phi","description":"Calculate integrated information Φ"},{"name":"find_mip","description":"Find minimum information partition"},{"name":"get_main_complex","description":"Identify main complex"},{"name":"compute_cause_effect_structure","description":"Full CES analysis"}]',
 '["numpy","scipy","joblib"]', 5000, 500),

-- Phase 3: Formal Reasoning
('z3', 'Z3', 'z3-solver', '4.15.4.0', 'MIT', 'verification', 'Cerebellum',
 'SMT solver for formal verification, constraint satisfaction, and proof generation',
 '{"reasoning_depth":10,"mathematical_quantitative":10,"code_generation":7,"creative_generative":2,"research_synthesis":6,"factual_recall_precision":10,"multi_step_problem_solving":10,"domain_terminology_handling":8,"self_modeling_capability":3,"temporal_integration":5,"causal_reasoning":10,"metacognitive_accuracy":8}',
 '[{"name":"verify_consistency","description":"Check logical consistency"},{"name":"prove_theorem","description":"Attempt theorem proof"},{"name":"find_model","description":"Find satisfying assignment"},{"name":"verify_with_retry","description":"LLM-Modulo verification loop"}]',
 '[]', 100, 50),

('pyarg', 'PyArg', 'python-argumentation', '2.0.2', 'MIT', 'argumentation', 'Brocas Area',
 'Dungs Abstract Argumentation with grounded/preferred/stable semantics',
 '{"reasoning_depth":9,"mathematical_quantitative":7,"code_generation":3,"creative_generative":5,"research_synthesis":8,"factual_recall_precision":7,"multi_step_problem_solving":9,"domain_terminology_handling":8,"self_modeling_capability":6,"temporal_integration":4,"causal_reasoning":9,"metacognitive_accuracy":8}',
 '[{"name":"create_framework","description":"Create argumentation framework"},{"name":"compute_extensions","description":"Compute acceptable arguments"},{"name":"evaluate_argument","description":"Check argument status"},{"name":"explain_rejection","description":"Explain why argument rejected"}]',
 '[]', 50, 20),

('pyreason', 'PyReason', 'pyreason', '3.2.0', 'BSD-2-Clause', 'temporal_reasoning', 'Prefrontal Cortex',
 'Generalized Annotated Logic with temporal reasoning over knowledge graphs',
 '{"reasoning_depth":9,"mathematical_quantitative":8,"code_generation":4,"creative_generative":3,"research_synthesis":7,"factual_recall_precision":9,"multi_step_problem_solving":9,"domain_terminology_handling":7,"self_modeling_capability":5,"temporal_integration":10,"causal_reasoning":9,"metacognitive_accuracy":7}',
 '[{"name":"add_rule","description":"Add temporal reasoning rule"},{"name":"add_fact","description":"Add fact with temporal bounds"},{"name":"reason","description":"Perform temporal reasoning"},{"name":"explain_inference","description":"Explain conclusion with trace"}]',
 '["networkx","numba"]', 200, 100),

('rdflib', 'RDFLib', 'rdflib', '7.5.0', 'BSD-3-Clause', 'knowledge_representation', 'Semantic Memory',
 'RDF graph storage with complete SPARQL 1.1 support',
 '{"reasoning_depth":7,"mathematical_quantitative":5,"code_generation":4,"creative_generative":3,"research_synthesis":8,"factual_recall_precision":9,"multi_step_problem_solving":7,"domain_terminology_handling":9,"self_modeling_capability":7,"temporal_integration":6,"causal_reasoning":7,"metacognitive_accuracy":6}',
 '[{"name":"query_sparql","description":"Execute SPARQL query"},{"name":"add_triple","description":"Add knowledge triple"},{"name":"export_graph","description":"Serialize to Turtle/JSON-LD"}]',
 '[]', 20, 50),

('owlrl', 'OWL-RL', 'owlrl', '7.1.4', 'W3C', 'ontological_inference', 'Inferential Cortex',
 'Complete W3C OWL 2 RL ruleset with polynomial-time reasoning',
 '{"reasoning_depth":9,"mathematical_quantitative":8,"code_generation":3,"creative_generative":2,"research_synthesis":7,"factual_recall_precision":9,"multi_step_problem_solving":8,"domain_terminology_handling":9,"self_modeling_capability":6,"temporal_integration":5,"causal_reasoning":9,"metacognitive_accuracy":7}',
 '[{"name":"apply_reasoning","description":"Apply OWL-RL inference"},{"name":"check_consistency","description":"Check for owl:Nothing instances"}]',
 '["rdflib"]', 100, 30),

('pyshacl', 'pySHACL', 'pyshacl', '0.30.1', 'Apache-2.0', 'constraint_validation', 'Error Detection Circuits',
 'SHACL Core + Advanced Features validation with SPARQL-based constraints',
 '{"reasoning_depth":8,"mathematical_quantitative":7,"code_generation":4,"creative_generative":2,"research_synthesis":6,"factual_recall_precision":10,"multi_step_problem_solving":7,"domain_terminology_handling":8,"self_modeling_capability":5,"temporal_integration":4,"causal_reasoning":8,"metacognitive_accuracy":8}',
 '[{"name":"validate","description":"Validate against SHACL shapes"},{"name":"get_violations","description":"Extract constraint violations"}]',
 '["rdflib"]', 50, 20),

-- Phase 4: Frontier Technologies
('hipporag', 'HippoRAG', 'hipporag', '0.1.0', 'MIT', 'memory_indexing', 'Hippocampus',
 'Neurobiologically-inspired memory with 20% improvement over RAG on multi-hop QA',
 '{"reasoning_depth":7,"mathematical_quantitative":5,"code_generation":3,"creative_generative":4,"research_synthesis":9,"factual_recall_precision":9,"multi_step_problem_solving":8,"domain_terminology_handling":7,"self_modeling_capability":6,"temporal_integration":8,"causal_reasoning":7,"metacognitive_accuracy":6}',
 '[{"name":"index_document","description":"Index with hippocampal pattern separation"},{"name":"retrieve","description":"Retrieve with Personalized PageRank"},{"name":"multi_hop_query","description":"Multi-hop reasoning over graph"}]',
 '["networkx"]', 100, 200),

('dreamerv3', 'DreamerV3', 'dreamerv3', '1.0.0', 'MIT', 'world_modeling', 'Prefrontal-Hippocampal Circuit',
 'World model for imagination-based planning (Nature 2025)',
 '{"reasoning_depth":8,"mathematical_quantitative":7,"code_generation":3,"creative_generative":9,"research_synthesis":6,"factual_recall_precision":6,"multi_step_problem_solving":9,"domain_terminology_handling":5,"self_modeling_capability":7,"temporal_integration":9,"causal_reasoning":8,"metacognitive_accuracy":6}',
 '[{"name":"imagine_trajectory","description":"Imagine future without environment"},{"name":"counterfactual_simulation","description":"What-if scenario reasoning"},{"name":"dream_consolidation","description":"Generate synthetic experiences"}]',
 '["jax","flax"]', 500, 2000),

('spikingjelly', 'SpikingJelly', 'spikingjelly', '0.0.0.0.14', 'Apache-2.0', 'temporal_binding', 'Thalamocortical Oscillations',
 'Spiking neural networks for temporal integration and phenomenal binding',
 '{"reasoning_depth":6,"mathematical_quantitative":7,"code_generation":4,"creative_generative":5,"research_synthesis":5,"factual_recall_precision":6,"multi_step_problem_solving":6,"domain_terminology_handling":5,"self_modeling_capability":5,"temporal_integration":10,"causal_reasoning":6,"metacognitive_accuracy":5}',
 '[{"name":"encode_temporal","description":"Encode through spiking dynamics"},{"name":"detect_synchrony","description":"Detect phenomenal binding"},{"name":"temporal_integration_test","description":"Test multi-stream binding"}]',
 '["torch"]', 50, 500),

-- Phase 5: Learning & Evolution
('distilabel', 'Distilabel', 'distilabel', '1.0.0', 'Apache-2.0', 'plasticity', 'Hebbian Learning',
 'Generate high-quality synthetic training data for self-improvement',
 '{"reasoning_depth":7,"mathematical_quantitative":6,"code_generation":7,"creative_generative":8,"research_synthesis":8,"factual_recall_precision":7,"multi_step_problem_solving":7,"domain_terminology_handling":8,"self_modeling_capability":6,"temporal_integration":5,"causal_reasoning":7,"metacognitive_accuracy":6}',
 '[{"name":"generate_training_data","description":"Create synthetic examples"},{"name":"distill_knowledge","description":"Compress knowledge from larger models"}]',
 '[]', 1000, 200),

('unsloth', 'Unsloth', 'unsloth', '2024.0', 'Apache-2.0', 'plasticity', 'Synaptic Plasticity',
 '2-5x faster fine-tuning with 70% less memory for neuroplasticity updates',
 '{"reasoning_depth":6,"mathematical_quantitative":7,"code_generation":8,"creative_generative":6,"research_synthesis":6,"factual_recall_precision":7,"multi_step_problem_solving":6,"domain_terminology_handling":7,"self_modeling_capability":5,"temporal_integration":4,"causal_reasoning":6,"metacognitive_accuracy":5}',
 '[{"name":"fine_tune","description":"Apply LoRA fine-tuning"},{"name":"merge_adapter","description":"Merge adapter into base model"}]',
 '["torch","transformers"]', 10000, 4000)

ON CONFLICT (library_id) DO UPDATE SET
    version = EXCLUDED.version,
    proficiencies = EXCLUDED.proficiencies,
    exposed_tools = EXCLUDED.exposed_tools,
    updated_at = NOW();

-- ============================================================================
-- Consciousness Library Invocation Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS consciousness_library_invocations (
    invocation_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    library_id TEXT NOT NULL REFERENCES consciousness_library_registry(library_id),
    method TEXT NOT NULL,
    params JSONB,
    result JSONB,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    latency_ms INT NOT NULL,
    invoked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consciousness_invocations_tenant ON consciousness_library_invocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consciousness_invocations_library ON consciousness_library_invocations(library_id);
CREATE INDEX IF NOT EXISTS idx_consciousness_invocations_date ON consciousness_library_invocations(invoked_at DESC);

-- ============================================================================
-- Consciousness Test History View
-- ============================================================================

CREATE OR REPLACE VIEW consciousness_test_summary AS
SELECT 
    tenant_id,
    COUNT(*) as total_tests,
    AVG(overall_score) as avg_score,
    MAX(overall_score) as best_score,
    MODE() WITHIN GROUP (ORDER BY consciousness_level) as most_common_level,
    MAX(run_at) as last_test_at
FROM butlin_consciousness_tests
GROUP BY tenant_id;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE hipporag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hipporag_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE hipporag_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dreamerv3_trajectories ENABLE ROW LEVEL SECURITY;
ALTER TABLE dreamerv3_counterfactuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE dreamerv3_dreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE spikingjelly_binding_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE butlin_consciousness_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_library_invocations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
DO $$
DECLARE
    tables TEXT[] := ARRAY[
        'hipporag_documents', 'hipporag_entities', 'hipporag_relations',
        'dreamerv3_trajectories', 'dreamerv3_counterfactuals', 'dreamerv3_dreams',
        'spikingjelly_binding_results', 'butlin_consciousness_tests',
        'consciousness_library_invocations'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        EXECUTE format('
            CREATE POLICY %I_tenant_isolation ON %I
            FOR ALL
            USING (tenant_id = current_setting(''app.current_tenant_id'', true))
            WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))
        ', t, t);
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END LOOP;
END $$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO radiant_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO radiant_app;
