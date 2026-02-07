-- Migration: 054_advanced_agi.sql
-- RADIANT v4.18.0 - Advanced AGI Capabilities
-- Meta-Learning, Active Inference, Neuro-Symbolic, Working Memory, Self-Modification, Common Sense

-- ============================================================================
-- META-LEARNING - Learning to learn better
-- ============================================================================

CREATE TABLE IF NOT EXISTS learning_strategies (
    strategy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Strategy definition
    name VARCHAR(200) NOT NULL,
    description TEXT,
    strategy_type VARCHAR(50) NOT NULL, -- 'prompt_template', 'reasoning_chain', 'retrieval_method', 'composition'
    
    -- Strategy content
    strategy_spec JSONB NOT NULL, -- The actual strategy definition
    parameter_space JSONB DEFAULT '{}', -- Tunable parameters
    
    -- Performance tracking
    times_used INTEGER DEFAULT 0,
    successes INTEGER DEFAULT 0,
    failures INTEGER DEFAULT 0,
    avg_quality_score DECIMAL(5,4),
    avg_latency_ms INTEGER,
    
    -- Meta-learning metrics
    generalization_score DECIMAL(5,4), -- How well it works across domains
    adaptation_rate DECIMAL(5,4), -- How quickly it improves
    sample_efficiency DECIMAL(5,4), -- How few examples needed
    
    -- Evolution
    parent_strategy_id UUID REFERENCES learning_strategies(strategy_id),
    generation INTEGER DEFAULT 0,
    mutation_history JSONB DEFAULT '[]',
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE learning_strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY learning_strategies_tenant_isolation ON learning_strategies
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_learning_strategies_tenant ON learning_strategies(tenant_id);
CREATE INDEX idx_learning_strategies_type ON learning_strategies(strategy_type);
CREATE INDEX idx_learning_strategies_quality ON learning_strategies(avg_quality_score DESC) WHERE is_active = true;

-- Strategy experiments (A/B testing strategies)
CREATE TABLE IF NOT EXISTS strategy_experiments (
    experiment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Experiment setup
    name VARCHAR(200) NOT NULL,
    hypothesis TEXT,
    control_strategy_id UUID REFERENCES learning_strategies(strategy_id),
    variant_strategy_ids UUID[] DEFAULT '{}',
    
    -- Experiment state
    status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'stopped'
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    
    -- Results
    control_metrics JSONB DEFAULT '{}',
    variant_metrics JSONB DEFAULT '{}',
    winner_strategy_id UUID REFERENCES learning_strategies(strategy_id),
    statistical_significance DECIMAL(5,4),
    
    -- Learning
    insights JSONB DEFAULT '[]',
    applied_learnings JSONB DEFAULT '[]'
);

ALTER TABLE strategy_experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY strategy_experiments_tenant_isolation ON strategy_experiments
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Learning transfer records
CREATE TABLE IF NOT EXISTS learning_transfers (
    transfer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Source and target
    source_domain VARCHAR(200) NOT NULL,
    target_domain VARCHAR(200) NOT NULL,
    source_task TEXT,
    target_task TEXT,
    
    -- Transfer method
    transfer_type VARCHAR(50) NOT NULL, -- 'analogy', 'abstraction', 'structure_mapping', 'fine_tuning'
    
    -- What was transferred
    transferred_knowledge JSONB NOT NULL,
    adaptation_needed JSONB DEFAULT '{}',
    
    -- Outcome
    success BOOLEAN,
    transfer_quality DECIMAL(5,4),
    negative_transfer_detected BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE learning_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY learning_transfers_tenant_isolation ON learning_transfers
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- ACTIVE INFERENCE - Predictive processing framework
-- ============================================================================

CREATE TABLE IF NOT EXISTS generative_models (
    model_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Model definition
    name VARCHAR(200) NOT NULL,
    domain VARCHAR(100),
    model_type VARCHAR(50) NOT NULL, -- 'world', 'self', 'other', 'environment'
    
    -- Generative model structure
    state_space JSONB NOT NULL, -- Possible states
    observation_model JSONB NOT NULL, -- P(observation | state)
    transition_model JSONB NOT NULL, -- P(next_state | current_state, action)
    preference_model JSONB DEFAULT '{}', -- Preferred observations/states
    
    -- Beliefs
    current_beliefs JSONB DEFAULT '{}', -- Current probability distribution over states
    belief_precision DECIMAL(5,4) DEFAULT 0.5, -- Confidence in beliefs
    
    -- Performance
    prediction_accuracy DECIMAL(5,4),
    surprise_history JSONB DEFAULT '[]', -- Recent prediction errors
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE generative_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY generative_models_tenant_isolation ON generative_models
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Predictions and prediction errors
CREATE TABLE IF NOT EXISTS active_predictions (
    prediction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    model_id UUID REFERENCES generative_models(model_id),
    
    -- Prediction
    predicted_state JSONB NOT NULL,
    predicted_observation JSONB,
    confidence DECIMAL(5,4),
    
    -- Context
    context_state JSONB,
    action_taken TEXT,
    
    -- Outcome
    actual_state JSONB,
    actual_observation JSONB,
    prediction_error DECIMAL(5,4), -- Free energy / surprise
    
    -- Learning
    belief_update JSONB, -- How beliefs changed
    model_update JSONB, -- How model changed
    
    predicted_at TIMESTAMPTZ DEFAULT NOW(),
    observed_at TIMESTAMPTZ
);

ALTER TABLE active_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY active_predictions_tenant_isolation ON active_predictions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_active_predictions_tenant ON active_predictions(tenant_id);
CREATE INDEX idx_active_predictions_model ON active_predictions(model_id);
CREATE INDEX idx_active_predictions_error ON active_predictions(prediction_error DESC);

-- Action selection (active inference policy)
CREATE TABLE IF NOT EXISTS action_policies (
    policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Policy definition
    name VARCHAR(200) NOT NULL,
    context_pattern JSONB, -- When to use this policy
    
    -- Action sequences
    action_sequence JSONB NOT NULL, -- Sequence of actions
    expected_outcomes JSONB DEFAULT '[]',
    
    -- Expected free energy
    expected_free_energy DECIMAL(10,4), -- Lower is better
    epistemic_value DECIMAL(5,4), -- Information gain
    pragmatic_value DECIMAL(5,4), -- Goal achievement
    
    -- Performance
    times_selected INTEGER DEFAULT 0,
    times_successful INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE action_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY action_policies_tenant_isolation ON action_policies
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- NEURO-SYMBOLIC INTEGRATION - Combining neural and symbolic reasoning
-- ============================================================================

CREATE TABLE IF NOT EXISTS symbolic_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Rule definition
    name VARCHAR(200) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- 'inference', 'constraint', 'default', 'causal', 'deontic'
    domain VARCHAR(100),
    
    -- Formal structure
    antecedent JSONB NOT NULL, -- IF conditions
    consequent JSONB NOT NULL, -- THEN conclusions
    rule_strength DECIMAL(5,4) DEFAULT 1.0, -- For soft rules
    
    -- Natural language
    nl_description TEXT,
    
    -- Provenance
    source VARCHAR(50), -- 'extracted', 'authored', 'learned', 'inherited'
    confidence DECIMAL(5,4) DEFAULT 1.0,
    
    -- Usage
    times_applied INTEGER DEFAULT 0,
    times_successful INTEGER DEFAULT 0,
    exceptions_found JSONB DEFAULT '[]',
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE symbolic_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY symbolic_rules_tenant_isolation ON symbolic_rules
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_symbolic_rules_tenant ON symbolic_rules(tenant_id);
CREATE INDEX idx_symbolic_rules_type ON symbolic_rules(rule_type);
CREATE INDEX idx_symbolic_rules_domain ON symbolic_rules(domain);

-- Concept hierarchy (ontology)
CREATE TABLE IF NOT EXISTS concept_ontology (
    concept_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Concept definition
    name VARCHAR(200) NOT NULL,
    concept_type VARCHAR(50), -- 'class', 'instance', 'property', 'relation'
    
    -- Hierarchy
    parent_id UUID REFERENCES concept_ontology(concept_id),
    children_ids UUID[] DEFAULT '{}',
    
    -- Properties
    properties JSONB DEFAULT '{}',
    constraints JSONB DEFAULT '{}',
    
    -- Neural grounding
    concept_embedding vector(1536),
    prototype_examples JSONB DEFAULT '[]',
    
    -- Relationships
    related_concepts JSONB DEFAULT '[]', -- [{concept_id, relation_type, strength}]
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE concept_ontology ENABLE ROW LEVEL SECURITY;
CREATE POLICY concept_ontology_tenant_isolation ON concept_ontology
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_concept_ontology_tenant ON concept_ontology(tenant_id);
CREATE INDEX idx_concept_ontology_parent ON concept_ontology(parent_id);
CREATE INDEX idx_concept_ontology_embedding ON concept_ontology 
    USING ivfflat (concept_embedding vector_cosine_ops) WITH (lists = 100);

-- Reasoning traces (hybrid reasoning)
CREATE TABLE IF NOT EXISTS reasoning_traces (
    trace_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Problem
    problem_statement TEXT NOT NULL,
    problem_type VARCHAR(50),
    
    -- Reasoning process
    reasoning_steps JSONB NOT NULL, -- [{step_type, content, justification}]
    step_types_used VARCHAR(50)[] DEFAULT '{}', -- 'neural', 'symbolic', 'hybrid'
    
    -- Rules and concepts used
    rules_applied UUID[] DEFAULT '{}',
    concepts_referenced UUID[] DEFAULT '{}',
    
    -- Outcome
    conclusion JSONB,
    confidence DECIMAL(5,4),
    verified BOOLEAN,
    
    -- Meta
    reasoning_time_ms INTEGER,
    backtracking_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reasoning_traces ENABLE ROW LEVEL SECURITY;
CREATE POLICY reasoning_traces_tenant_isolation ON reasoning_traces
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- WORKING MEMORY - Explicit computational working memory
-- ============================================================================

CREATE TABLE IF NOT EXISTS working_memory_state (
    state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Slots (limited capacity)
    slots JSONB DEFAULT '[]', -- [{slot_id, content, activation, timestamp}]
    max_slots INTEGER DEFAULT 7, -- Miller's 7±2
    
    -- Central executive
    current_goal TEXT,
    attention_focus TEXT,
    control_state VARCHAR(50), -- 'idle', 'processing', 'switching', 'rehearsing'
    
    -- Phonological loop (verbal)
    verbal_buffer TEXT[] DEFAULT '{}',
    verbal_rehearsal_active BOOLEAN DEFAULT false,
    
    -- Visuospatial sketchpad
    spatial_buffer JSONB DEFAULT '{}',
    
    -- Episodic buffer
    episodic_buffer JSONB DEFAULT '[]', -- Integrated episodes
    
    -- Metrics
    cognitive_load DECIMAL(3,2) DEFAULT 0,
    interference_level DECIMAL(3,2) DEFAULT 0,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE working_memory_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY working_memory_state_tenant_isolation ON working_memory_state
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Working memory operations log
CREATE TABLE IF NOT EXISTS working_memory_operations (
    operation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Operation
    operation_type VARCHAR(50) NOT NULL, -- 'encode', 'retrieve', 'update', 'delete', 'rehearse', 'chunk'
    target_slot INTEGER,
    
    -- Content
    content_before JSONB,
    content_after JSONB,
    
    -- Result
    success BOOLEAN,
    interference_caused BOOLEAN DEFAULT false,
    decay_prevented BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE working_memory_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY working_memory_operations_tenant_isolation ON working_memory_operations
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Chunking (memory optimization)
CREATE TABLE IF NOT EXISTS memory_chunks (
    chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Chunk content
    chunk_label VARCHAR(200) NOT NULL,
    constituent_items JSONB NOT NULL, -- Items grouped together
    chunk_size INTEGER,
    
    -- Compression
    compression_ratio DECIMAL(5,4), -- How much space saved
    retrieval_cue TEXT,
    
    -- Usage
    times_used INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE memory_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY memory_chunks_tenant_isolation ON memory_chunks
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- SELF-MODIFICATION - Architecture evolution and prompt optimization
-- ============================================================================

CREATE TABLE IF NOT EXISTS prompt_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Template definition
    name VARCHAR(200) NOT NULL,
    purpose VARCHAR(100) NOT NULL, -- 'reasoning', 'creativity', 'analysis', 'planning', etc.
    
    -- Content
    template_text TEXT NOT NULL,
    variables JSONB DEFAULT '[]', -- Required variables
    
    -- Performance
    times_used INTEGER DEFAULT 0,
    avg_quality DECIMAL(5,4),
    avg_latency_ms INTEGER,
    
    -- Evolution
    parent_template_id UUID REFERENCES prompt_templates(template_id),
    generation INTEGER DEFAULT 0,
    mutations JSONB DEFAULT '[]',
    
    -- A/B testing
    is_control BOOLEAN DEFAULT false,
    experiment_group VARCHAR(50),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY prompt_templates_tenant_isolation ON prompt_templates
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Architecture configurations
CREATE TABLE IF NOT EXISTS architecture_configs (
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Configuration
    name VARCHAR(200) NOT NULL,
    config_type VARCHAR(50) NOT NULL, -- 'pipeline', 'model_selection', 'routing', 'integration'
    
    -- Specification
    config_spec JSONB NOT NULL,
    
    -- Performance
    benchmark_results JSONB DEFAULT '{}',
    fitness_score DECIMAL(5,4),
    
    -- Evolution
    parent_config_id UUID REFERENCES architecture_configs(config_id),
    generation INTEGER DEFAULT 0,
    
    is_active BOOLEAN DEFAULT false, -- Only one active per type
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE architecture_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY architecture_configs_tenant_isolation ON architecture_configs
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Self-improvement proposals
CREATE TABLE IF NOT EXISTS improvement_proposals (
    proposal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Proposal
    title VARCHAR(500) NOT NULL,
    description TEXT,
    proposal_type VARCHAR(50) NOT NULL, -- 'prompt', 'architecture', 'strategy', 'rule', 'process'
    
    -- Rationale
    identified_problem TEXT,
    proposed_solution JSONB NOT NULL,
    expected_improvement DECIMAL(5,4),
    
    -- Status
    status VARCHAR(20) DEFAULT 'proposed', -- 'proposed', 'testing', 'approved', 'rejected', 'implemented'
    
    -- Testing
    test_results JSONB,
    actual_improvement DECIMAL(5,4),
    
    -- Approval
    approved_by VARCHAR(200),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE improvement_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY improvement_proposals_tenant_isolation ON improvement_proposals
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- COMMON SENSE KNOWLEDGE BASE
-- ============================================================================

CREATE TABLE IF NOT EXISTS common_sense_facts (
    fact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- NULL for global facts
    
    -- Fact content
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object TEXT NOT NULL,
    
    -- Fact type
    fact_type VARCHAR(50) NOT NULL, -- 'physical', 'social', 'temporal', 'spatial', 'causal', 'functional'
    
    -- Confidence and source
    confidence DECIMAL(5,4) DEFAULT 1.0,
    source VARCHAR(50), -- 'curated', 'extracted', 'inferred', 'crowdsourced'
    
    -- Qualifications
    context_restrictions JSONB DEFAULT '{}',
    exceptions JSONB DEFAULT '[]',
    temporal_scope VARCHAR(50), -- 'always', 'usually', 'sometimes', 'historically'
    
    -- Usage
    times_used INTEGER DEFAULT 0,
    times_helpful INTEGER DEFAULT 0,
    
    -- Embedding for retrieval
    fact_embedding vector(1536),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_common_sense_facts_type ON common_sense_facts(fact_type);
CREATE INDEX idx_common_sense_facts_subject ON common_sense_facts(subject);
CREATE INDEX idx_common_sense_facts_embedding ON common_sense_facts 
    USING ivfflat (fact_embedding vector_cosine_ops) WITH (lists = 100);

-- Physical intuition (naive physics)
CREATE TABLE IF NOT EXISTS physical_intuitions (
    intuition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Intuition
    category VARCHAR(50) NOT NULL, -- 'gravity', 'containment', 'support', 'collision', 'liquid', 'heat'
    principle TEXT NOT NULL,
    
    -- Formalization
    preconditions JSONB DEFAULT '{}',
    effects JSONB DEFAULT '{}',
    
    -- Examples
    examples JSONB DEFAULT '[]',
    counterexamples JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social norms and scripts
CREATE TABLE IF NOT EXISTS social_knowledge (
    knowledge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Knowledge type
    knowledge_type VARCHAR(50) NOT NULL, -- 'norm', 'script', 'role', 'emotion', 'intention'
    
    -- Content
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Structure
    typical_sequence JSONB DEFAULT '[]', -- For scripts
    role_expectations JSONB DEFAULT '{}', -- For roles
    trigger_conditions JSONB DEFAULT '{}', -- For norms
    
    -- Cultural context
    cultural_context VARCHAR(100) DEFAULT 'universal',
    formality_level VARCHAR(20), -- 'formal', 'informal', 'intimate'
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AGI INTEGRATION SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS advanced_agi_settings (
    setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Meta-Learning
    meta_learning_enabled BOOLEAN DEFAULT true,
    strategy_evolution_enabled BOOLEAN DEFAULT true,
    experiment_auto_run BOOLEAN DEFAULT false,
    min_samples_for_evolution INTEGER DEFAULT 100,
    
    -- Active Inference
    active_inference_enabled BOOLEAN DEFAULT true,
    prediction_horizon INTEGER DEFAULT 5,
    free_energy_threshold DECIMAL(5,4) DEFAULT 0.3,
    exploration_exploitation_balance DECIMAL(3,2) DEFAULT 0.3,
    
    -- Neuro-Symbolic
    neuro_symbolic_enabled BOOLEAN DEFAULT true,
    rule_extraction_enabled BOOLEAN DEFAULT true,
    symbolic_verification_required BOOLEAN DEFAULT false,
    max_reasoning_depth INTEGER DEFAULT 10,
    
    -- Working Memory
    working_memory_slots INTEGER DEFAULT 7,
    decay_rate DECIMAL(5,4) DEFAULT 0.1,
    rehearsal_enabled BOOLEAN DEFAULT true,
    chunking_enabled BOOLEAN DEFAULT true,
    
    -- Self-Modification
    self_modification_enabled BOOLEAN DEFAULT false, -- Off by default for safety
    prompt_evolution_enabled BOOLEAN DEFAULT true,
    architecture_search_enabled BOOLEAN DEFAULT false,
    require_approval_for_changes BOOLEAN DEFAULT true,
    
    -- Common Sense
    common_sense_enabled BOOLEAN DEFAULT true,
    physical_reasoning_enabled BOOLEAN DEFAULT true,
    social_reasoning_enabled BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE advanced_agi_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY advanced_agi_settings_tenant_isolation ON advanced_agi_settings
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Evolve a learning strategy based on performance
CREATE OR REPLACE FUNCTION evolve_strategy(
    p_strategy_id UUID,
    p_mutation_type VARCHAR(50),
    p_mutation_params JSONB
)
RETURNS UUID AS $$
DECLARE
    v_parent RECORD;
    v_new_spec JSONB;
    v_new_id UUID;
BEGIN
    SELECT * INTO v_parent FROM learning_strategies WHERE strategy_id = p_strategy_id;
    
    IF v_parent IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Apply mutation (simplified - actual mutation would depend on strategy type)
    v_new_spec := v_parent.strategy_spec || p_mutation_params;
    
    INSERT INTO learning_strategies (
        tenant_id, name, description, strategy_type, strategy_spec,
        parent_strategy_id, generation, mutation_history
    ) VALUES (
        v_parent.tenant_id,
        v_parent.name || ' (gen ' || (v_parent.generation + 1) || ')',
        'Evolved from ' || v_parent.name,
        v_parent.strategy_type,
        v_new_spec,
        p_strategy_id,
        v_parent.generation + 1,
        v_parent.mutation_history || jsonb_build_object(
            'type', p_mutation_type,
            'params', p_mutation_params,
            'timestamp', NOW()
        )
    ) RETURNING strategy_id INTO v_new_id;
    
    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- Update working memory (with decay and capacity limits)
CREATE OR REPLACE FUNCTION update_working_memory(
    p_tenant_id UUID,
    p_operation VARCHAR(50),
    p_content JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    v_state RECORD;
    v_slots JSONB;
    v_max_slots INTEGER;
BEGIN
    SELECT * INTO v_state FROM working_memory_state WHERE tenant_id = p_tenant_id;
    
    IF v_state IS NULL THEN
        INSERT INTO working_memory_state (tenant_id) VALUES (p_tenant_id);
        SELECT * INTO v_state FROM working_memory_state WHERE tenant_id = p_tenant_id;
    END IF;
    
    v_slots := v_state.slots;
    v_max_slots := v_state.max_slots;
    
    -- Apply decay to existing slots
    SELECT jsonb_agg(
        CASE WHEN (slot->>'activation')::DECIMAL > 0.1 THEN
            jsonb_set(slot, '{activation}', to_jsonb((slot->>'activation')::DECIMAL * 0.95))
        ELSE NULL END
    ) INTO v_slots
    FROM jsonb_array_elements(v_slots) slot;
    
    v_slots := COALESCE(v_slots, '[]'::jsonb);
    
    IF p_operation = 'encode' THEN
        -- Remove lowest activation if at capacity
        IF jsonb_array_length(v_slots) >= v_max_slots THEN
            SELECT jsonb_agg(slot ORDER BY (slot->>'activation')::DECIMAL DESC) INTO v_slots
            FROM jsonb_array_elements(v_slots) slot
            LIMIT v_max_slots - 1;
        END IF;
        
        -- Add new item
        v_slots := v_slots || jsonb_build_object(
            'slot_id', gen_random_uuid(),
            'content', p_content,
            'activation', 1.0,
            'timestamp', NOW()
        );
    END IF;
    
    UPDATE working_memory_state SET slots = v_slots, updated_at = NOW()
    WHERE tenant_id = p_tenant_id;
    
    -- Log operation
    INSERT INTO working_memory_operations (tenant_id, operation_type, content_after, success)
    VALUES (p_tenant_id, p_operation, p_content, true);
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Calculate expected free energy for action selection
CREATE OR REPLACE FUNCTION calculate_expected_free_energy(
    p_policy_id UUID
)
RETURNS DECIMAL AS $$
DECLARE
    v_policy RECORD;
    v_efe DECIMAL;
BEGIN
    SELECT * INTO v_policy FROM action_policies WHERE policy_id = p_policy_id;
    
    IF v_policy IS NULL THEN
        RETURN 999999; -- High EFE for unknown policies
    END IF;
    
    -- EFE = -epistemic_value - pragmatic_value (lower is better)
    v_efe := -COALESCE(v_policy.epistemic_value, 0) - COALESCE(v_policy.pragmatic_value, 0);
    
    -- Adjust based on history
    IF v_policy.times_selected > 0 THEN
        v_efe := v_efe * (1 - (v_policy.times_successful::DECIMAL / v_policy.times_selected));
    END IF;
    
    RETURN v_efe;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_advanced_agi_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER learning_strategies_updated BEFORE UPDATE ON learning_strategies
    FOR EACH ROW EXECUTE FUNCTION update_advanced_agi_timestamp();

CREATE TRIGGER generative_models_updated BEFORE UPDATE ON generative_models
    FOR EACH ROW EXECUTE FUNCTION update_advanced_agi_timestamp();

CREATE TRIGGER working_memory_state_updated BEFORE UPDATE ON working_memory_state
    FOR EACH ROW EXECUTE FUNCTION update_advanced_agi_timestamp();

CREATE TRIGGER advanced_agi_settings_updated BEFORE UPDATE ON advanced_agi_settings
    FOR EACH ROW EXECUTE FUNCTION update_advanced_agi_timestamp();

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Initialize settings for existing tenants
INSERT INTO advanced_agi_settings (tenant_id)
SELECT tenant_id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Initialize working memory for existing tenants
INSERT INTO working_memory_state (tenant_id)
SELECT tenant_id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Common physical intuitions
INSERT INTO physical_intuitions (category, principle, preconditions, effects, examples) VALUES
('gravity', 'Unsupported objects fall', '{"object_type": "physical", "support": "none"}', '{"motion": "downward", "acceleration": "9.8m/s²"}', '["dropping a ball", "leaf falling from tree"]'),
('containment', 'Objects inside containers move with the container', '{"relation": "inside", "container": "moving"}', '{"object_motion": "same_as_container"}', '["cup of water in car", "items in moving box"]'),
('support', 'Heavier objects on top can crush lighter objects below', '{"weight_ratio": ">10", "material": "crushable"}', '{"deformation": "likely", "damage": "possible"}', '["standing on cardboard box", "stacking fragile items"]'),
('liquid', 'Liquids take the shape of their container', '{"state": "liquid", "container": "present"}', '{"shape": "container_shape", "level": "horizontal"}', '["water in glass", "oil in bottle"]'),
('heat', 'Heat flows from hot objects to cold objects', '{"temperature_difference": "exists", "contact": "thermal"}', '{"equilibrium": "eventual", "direction": "hot_to_cold"}', '["ice in warm drink", "touching hot stove"]')
ON CONFLICT DO NOTHING;

-- Common social knowledge
INSERT INTO social_knowledge (knowledge_type, name, description, typical_sequence) VALUES
('script', 'Restaurant dining', 'Standard sequence of events when dining at a restaurant', '[{"step": "enter", "action": "wait to be seated"}, {"step": "seated", "action": "receive menu"}, {"step": "order", "action": "tell waiter choices"}, {"step": "eat", "action": "consume food"}, {"step": "pay", "action": "receive and pay bill"}, {"step": "leave", "action": "tip and exit"}]'),
('script', 'Job interview', 'Standard sequence for a job interview', '[{"step": "arrive", "action": "arrive early, check in"}, {"step": "wait", "action": "wait in lobby"}, {"step": "greet", "action": "shake hands, introduce"}, {"step": "interview", "action": "answer questions"}, {"step": "questions", "action": "ask about role"}, {"step": "close", "action": "thank interviewer"}]'),
('norm', 'Turn-taking in conversation', 'People take turns speaking in conversation', '{"trigger": "someone_finishes_speaking", "expected": "wait_for_pause_before_speaking"}'),
('norm', 'Personal space', 'Maintain appropriate physical distance', '{"trigger": "interacting_with_others", "expected": "maintain_arm_length_distance", "varies_by": "culture"}')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE learning_strategies IS 'Meta-learning: strategies that can evolve and improve';
COMMENT ON TABLE strategy_experiments IS 'A/B testing for learning strategies';
COMMENT ON TABLE learning_transfers IS 'Records of knowledge transfer between domains';
COMMENT ON TABLE generative_models IS 'Active inference: internal world models for prediction';
COMMENT ON TABLE active_predictions IS 'Predictions and prediction errors for active inference';
COMMENT ON TABLE action_policies IS 'Active inference: action selection policies';
COMMENT ON TABLE symbolic_rules IS 'Neuro-symbolic: explicit logical rules';
COMMENT ON TABLE concept_ontology IS 'Neuro-symbolic: hierarchical concept structure';
COMMENT ON TABLE reasoning_traces IS 'Hybrid reasoning traces combining neural and symbolic';
COMMENT ON TABLE working_memory_state IS 'Explicit computational working memory model';
COMMENT ON TABLE working_memory_operations IS 'Log of working memory operations';
COMMENT ON TABLE memory_chunks IS 'Chunking for memory efficiency';
COMMENT ON TABLE prompt_templates IS 'Self-modification: evolvable prompts';
COMMENT ON TABLE architecture_configs IS 'Self-modification: evolvable architecture';
COMMENT ON TABLE improvement_proposals IS 'Self-proposed improvements';
COMMENT ON TABLE common_sense_facts IS 'Explicit common sense knowledge';
COMMENT ON TABLE physical_intuitions IS 'Naive physics / physical intuition';
COMMENT ON TABLE social_knowledge IS 'Social norms, scripts, and expectations';
