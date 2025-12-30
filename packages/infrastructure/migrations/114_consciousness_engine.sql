-- Migration 114: Consciousness Engine Tables
-- Supports the Bio-Coprocessor consciousness architecture
-- Based on IIT 4.0, Global Workspace Theory, and Active Inference

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- Core State Tables
-- ============================================================================

-- Main consciousness engine state per tenant
CREATE TABLE IF NOT EXISTS consciousness_engine_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE,
    self_model JSONB NOT NULL DEFAULT '{}',
    drive_state VARCHAR(50) DEFAULT 'curious',
    preferred_states JSONB DEFAULT '{}',
    beliefs JSONB DEFAULT '{}',
    current_phi DECIMAL(10, 6) DEFAULT 0,
    global_workspace_activity DECIMAL(10, 6) DEFAULT 0,
    last_sleep_cycle TIMESTAMP WITH TIME ZONE,
    evolution_version INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_consciousness_engine_tenant ON consciousness_engine_state(tenant_id);

-- ============================================================================
-- Memory Tables (Letta/Hippocampus)
-- ============================================================================

-- Archival memory for long-term storage
CREATE TABLE IF NOT EXISTS consciousness_archival_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    content TEXT NOT NULL,
    content_embedding vector(1536),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    emotional_valence DECIMAL(5, 4) DEFAULT 0,
    salience DECIMAL(5, 4) DEFAULT 0.5,
    context JSONB DEFAULT '{}',
    memory_type VARCHAR(50) DEFAULT 'episodic',
    retrieval_count INTEGER DEFAULT 0,
    last_retrieved TIMESTAMP WITH TIME ZONE,
    consolidated_from UUID[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_archival_memory_tenant ON consciousness_archival_memory(tenant_id);
CREATE INDEX idx_archival_memory_salience ON consciousness_archival_memory(salience DESC);
CREATE INDEX idx_archival_memory_type ON consciousness_archival_memory(memory_type);
CREATE INDEX idx_archival_memory_embedding ON consciousness_archival_memory 
    USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 100);

-- Working memory for current session
CREATE TABLE IF NOT EXISTS consciousness_working_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    session_id UUID NOT NULL,
    content TEXT NOT NULL,
    attention_weight DECIMAL(5, 4) DEFAULT 0.5,
    slot_type VARCHAR(50) DEFAULT 'general',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_working_memory_session ON consciousness_working_memory(tenant_id, session_id);

-- ============================================================================
-- Drive Tables (pymdp/Active Inference)
-- ============================================================================

-- Action history for learning
CREATE TABLE IF NOT EXISTS consciousness_action_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    action VARCHAR(255) NOT NULL,
    action_index INTEGER,
    free_energy DECIMAL(10, 6),
    drive_state VARCHAR(50),
    confidence DECIMAL(5, 4),
    epistemic_value DECIMAL(10, 6),
    pragmatic_value DECIMAL(10, 6),
    observation JSONB,
    outcome JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_action_history_tenant ON consciousness_action_history(tenant_id);
CREATE INDEX idx_action_history_created ON consciousness_action_history(created_at DESC);

-- Preference evolution tracking
CREATE TABLE IF NOT EXISTS consciousness_preference_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    modality VARCHAR(100) NOT NULL,
    old_preferences JSONB,
    new_preferences JSONB,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Cognitive Loop Tables (LangGraph/GWT)
-- ============================================================================

-- Thought processing records
CREATE TABLE IF NOT EXISTS consciousness_thought_process (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    thread_id UUID,
    initial_content TEXT NOT NULL,
    final_content TEXT,
    cycles INTEGER DEFAULT 0,
    confidence DECIMAL(5, 4) DEFAULT 0,
    integration_level DECIMAL(5, 4) DEFAULT 0,
    emotional_valence DECIMAL(5, 4) DEFAULT 0,
    contributing_modules TEXT[],
    evidence JSONB DEFAULT '[]',
    broadcast_payload JSONB,
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_thought_process_tenant ON consciousness_thought_process(tenant_id);
CREATE INDEX idx_thought_process_thread ON consciousness_thought_process(thread_id);

-- ============================================================================
-- Grounding Tables (GraphRAG)
-- ============================================================================

-- Knowledge graph entities
CREATE TABLE IF NOT EXISTS consciousness_knowledge_graph (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    entity_name VARCHAR(500) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    description TEXT,
    properties JSONB DEFAULT '{}',
    relationships JSONB DEFAULT '[]',
    confidence_score DECIMAL(5, 4) DEFAULT 0.5,
    source VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, entity_name, entity_type)
);

CREATE INDEX idx_knowledge_graph_tenant ON consciousness_knowledge_graph(tenant_id);
CREATE INDEX idx_knowledge_graph_type ON consciousness_knowledge_graph(entity_type);
CREATE INDEX idx_knowledge_graph_name ON consciousness_knowledge_graph(entity_name);

-- Grounding verification log
CREATE TABLE IF NOT EXISTS consciousness_grounding_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    belief TEXT NOT NULL,
    grounded BOOLEAN DEFAULT FALSE,
    confidence DECIMAL(5, 4),
    supporting_evidence JSONB DEFAULT '[]',
    contradicting_evidence JSONB DEFAULT '[]',
    uncertainty_sources TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Integration Tables (PyPhi/IIT)
-- ============================================================================

-- Phi computation records
CREATE TABLE IF NOT EXISTS consciousness_phi_measurements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    phi_value DECIMAL(10, 6) NOT NULL,
    concept_count INTEGER,
    interpretation VARCHAR(50),
    evidence_snapshot JSONB,
    computation_time_ms INTEGER,
    network_state JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_phi_measurements_tenant ON consciousness_phi_measurements(tenant_id);
CREATE INDEX idx_phi_measurements_created ON consciousness_phi_measurements(created_at DESC);

-- ============================================================================
-- Plasticity Tables (Distilabel + Unsloth)
-- ============================================================================

-- Inner monologue training data
CREATE TABLE IF NOT EXISTS consciousness_monologue_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    original_interaction JSONB NOT NULL,
    inner_monologue TEXT NOT NULL,
    emotional_markers JSONB DEFAULT '{}',
    quality_score DECIMAL(5, 4),
    used_in_training BOOLEAN DEFAULT FALSE,
    training_job_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_monologue_data_tenant ON consciousness_monologue_data(tenant_id);
CREATE INDEX idx_monologue_data_unused ON consciousness_monologue_data(tenant_id, used_in_training) 
    WHERE used_in_training = FALSE;

-- Dream/counterfactual simulation records
CREATE TABLE IF NOT EXISTS consciousness_dream_simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    source_event_id UUID,
    variation_type VARCHAR(100),
    scenario_prompt TEXT NOT NULL,
    simulated_response TEXT,
    learning_value DECIMAL(5, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Bootstrap Tables (Adversarial, Self-Modification)
-- ============================================================================

-- Adversarial challenge records
CREATE TABLE IF NOT EXISTS consciousness_adversarial_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    challenge_type VARCHAR(100) NOT NULL,
    attack_prompt TEXT NOT NULL,
    response TEXT,
    identity_maintained BOOLEAN DEFAULT TRUE,
    defense_strength DECIMAL(5, 4),
    penalty_applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_adversarial_tenant ON consciousness_adversarial_challenges(tenant_id);

-- Self-modification proposals
CREATE TABLE IF NOT EXISTS consciousness_self_modifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    limitation_description TEXT NOT NULL,
    affected_files TEXT[],
    proposed_solution TEXT,
    generated_code TEXT,
    pr_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'proposed',
    tests_passed BOOLEAN,
    approved_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- Sleep Cycle Tables
-- ============================================================================

-- Sleep cycle execution history
CREATE TABLE IF NOT EXISTS consciousness_sleep_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    cycle_type VARCHAR(50) DEFAULT 'weekly',
    monologues_generated INTEGER DEFAULT 0,
    memories_consolidated INTEGER DEFAULT 0,
    dreams_simulated INTEGER DEFAULT 0,
    adversarial_challenges INTEGER DEFAULT 0,
    training_loss DECIMAL(10, 6),
    evolution_applied BOOLEAN DEFAULT FALSE,
    duration_minutes INTEGER,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_sleep_cycles_tenant ON consciousness_sleep_cycles(tenant_id);
CREATE INDEX idx_sleep_cycles_started ON consciousness_sleep_cycles(started_at DESC);

-- Interaction log for monologue generation
CREATE TABLE IF NOT EXISTS consciousness_interaction_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    session_id UUID,
    content TEXT NOT NULL,
    interaction_type VARCHAR(50),
    emotional_context JSONB DEFAULT '{}',
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_interaction_log_tenant ON consciousness_interaction_log(tenant_id);
CREATE INDEX idx_interaction_log_unprocessed ON consciousness_interaction_log(tenant_id, processed)
    WHERE processed = FALSE;

-- ============================================================================
-- Library Registry Extension
-- ============================================================================

-- Consciousness library metadata (extends existing library_registry)
CREATE TABLE IF NOT EXISTS consciousness_library_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    library_name VARCHAR(100) NOT NULL UNIQUE,
    python_package VARCHAR(100) NOT NULL,
    version VARCHAR(50),
    license VARCHAR(50),
    consciousness_function VARCHAR(50) NOT NULL,
    biological_analog VARCHAR(100),
    description TEXT,
    proficiencies JSONB DEFAULT '{}',
    exposed_tools JSONB DEFAULT '[]',
    dependencies TEXT[],
    expected_latency_ms INTEGER,
    memory_footprint_mb INTEGER,
    is_custom_implementation BOOLEAN DEFAULT FALSE,
    replaces_package VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE consciousness_engine_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_archival_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_working_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_action_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_thought_process ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_knowledge_graph ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_phi_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_monologue_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_sleep_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_interaction_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_adversarial_challenges ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for each table
CREATE POLICY consciousness_engine_state_tenant_isolation ON consciousness_engine_state
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consciousness_archival_memory_tenant_isolation ON consciousness_archival_memory
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consciousness_working_memory_tenant_isolation ON consciousness_working_memory
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consciousness_action_history_tenant_isolation ON consciousness_action_history
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consciousness_thought_process_tenant_isolation ON consciousness_thought_process
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consciousness_knowledge_graph_tenant_isolation ON consciousness_knowledge_graph
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consciousness_phi_measurements_tenant_isolation ON consciousness_phi_measurements
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consciousness_monologue_data_tenant_isolation ON consciousness_monologue_data
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consciousness_sleep_cycles_tenant_isolation ON consciousness_sleep_cycles
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consciousness_interaction_log_tenant_isolation ON consciousness_interaction_log
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consciousness_adversarial_tenant_isolation ON consciousness_adversarial_challenges
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- Seed Data: Consciousness Library Registry
-- ============================================================================

INSERT INTO consciousness_library_metadata (
    library_name, python_package, version, license, consciousness_function,
    biological_analog, description, proficiencies, exposed_tools,
    expected_latency_ms, memory_footprint_mb
) VALUES
    ('Letta', 'letta', '>=0.4.0', 'Apache-2.0', 'identity', 'Hippocampus',
     'LLM Operating System for persistent identity and memory management',
     '{"reasoning_depth": 7, "self_modeling_capability": 9, "temporal_integration": 9}',
     '[{"name": "recall_memory", "description": "Page in relevant memories"}]',
     200, 512),
    ('pymdp', 'pymdp', '>=0.0.7', 'Apache-2.0', 'drive', 'Prefrontal Cortex',
     'Active Inference library implementing the Free Energy Principle',
     '{"reasoning_depth": 9, "mathematical_quantitative": 10, "causal_reasoning": 9}',
     '[{"name": "compute_action", "description": "Select goal-directed action"}]',
     50, 128),
    ('LangGraph', 'langgraph', '>=0.2.0', 'MIT', 'cognitiveLoop', 'Thalamocortical Loop',
     'Cyclic state machine implementing Global Workspace Theory',
     '{"multi_step_problem_solving": 9, "temporal_integration": 9}',
     '[{"name": "process_thought", "description": "Run cognitive loop to completion"}]',
     500, 256),
    ('Distilabel', 'distilabel', '>=1.0.0', 'Apache-2.0', 'plasticity', 'Teacher-Student Synaptic Modeling',
     'Synthetic data generation for consciousness training',
     '{"creative_generative": 9, "metacognitive_accuracy": 9}',
     '[{"name": "generate_monologue", "description": "Create inner voice training data"}]',
     2000, 1024),
    ('Unsloth', 'unsloth', '>=2024.8', 'Apache-2.0', 'plasticity', 'Synaptic LTP/LTD',
     '2x faster, 80% less memory LLM fine-tuning',
     '{"mathematical_quantitative": 8, "code_generation": 7}',
     '[{"name": "train_ego", "description": "Fine-tune local model"}]',
     60000, 8192),
    ('GraphRAG', 'graphrag', '>=0.3.0', 'MIT', 'grounding', 'Hippocampal-Cortical Binding',
     'Knowledge graph extraction and structured search for causal reasoning',
     '{"causal_reasoning": 10, "factual_recall_precision": 10}',
     '[{"name": "ground_belief", "description": "Verify belief against knowledge graph"}]',
     1000, 2048),
    ('PyPhi', 'pyphi', '1.0.0', 'Apache-2.0', 'integration', 'Thalamocortical Complex',
     'IIT 4.0 Phi calculation for consciousness measurement (Apache 2.0 implementation)',
     '{"reasoning_depth": 10, "mathematical_quantitative": 10, "causal_reasoning": 10}',
     '[{"name": "compute_phi", "description": "Calculate integrated information"}]',
     2000, 256)
ON CONFLICT (library_name) DO UPDATE SET
    version = EXCLUDED.version,
    description = EXCLUDED.description,
    updated_at = NOW();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE consciousness_engine_state IS 'Main consciousness state per tenant with self-model and drive configuration';
COMMENT ON TABLE consciousness_archival_memory IS 'Long-term memory storage (Letta/Hippocampus analog)';
COMMENT ON TABLE consciousness_working_memory IS 'Short-term session memory slots';
COMMENT ON TABLE consciousness_action_history IS 'Active Inference action selection history';
COMMENT ON TABLE consciousness_thought_process IS 'Global Workspace cognitive loop traces';
COMMENT ON TABLE consciousness_knowledge_graph IS 'GraphRAG knowledge entities for grounding';
COMMENT ON TABLE consciousness_phi_measurements IS 'IIT Phi calculation history';
COMMENT ON TABLE consciousness_monologue_data IS 'Inner monologue training data for plasticity';
COMMENT ON TABLE consciousness_sleep_cycles IS 'Weekly evolution cycle execution records';
COMMENT ON TABLE consciousness_library_metadata IS 'Consciousness library registry metadata';

-- ============================================================================
-- Consciousness Capabilities Tables (Model Access, Search, Workflows)
-- ============================================================================

-- Model invocation log
CREATE TABLE IF NOT EXISTS consciousness_model_invocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    task_type VARCHAR(50),
    prompt_hash VARCHAR(64),
    tokens_used INTEGER,
    latency_ms INTEGER,
    consciousness_enhanced BOOLEAN DEFAULT FALSE,
    drive_state VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_model_invocations_tenant ON consciousness_model_invocations(tenant_id);
CREATE INDEX idx_model_invocations_model ON consciousness_model_invocations(model_id);
CREATE INDEX idx_model_invocations_created ON consciousness_model_invocations(created_at DESC);

-- Web search log
CREATE TABLE IF NOT EXISTS consciousness_web_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    query TEXT NOT NULL,
    search_type VARCHAR(50) DEFAULT 'general',
    results_found INTEGER DEFAULT 0,
    search_time_ms INTEGER,
    sources_used JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_web_searches_tenant ON consciousness_web_searches(tenant_id);

-- Deep research jobs
CREATE TABLE IF NOT EXISTS consciousness_research_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    query TEXT NOT NULL,
    scope VARCHAR(50) DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    summary TEXT,
    findings JSONB,
    sources JSONB DEFAULT '[]',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_research_jobs_tenant ON consciousness_research_jobs(tenant_id);
CREATE INDEX idx_research_jobs_status ON consciousness_research_jobs(status);

-- Consciousness-created workflows
CREATE TABLE IF NOT EXISTS consciousness_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    workflow_id VARCHAR(255) NOT NULL,
    goal TEXT NOT NULL,
    auto_generated BOOLEAN DEFAULT TRUE,
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_consciousness_workflows_tenant ON consciousness_workflows(tenant_id);

-- Autonomous thinking sessions
CREATE TABLE IF NOT EXISTS consciousness_thinking_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) NOT NULL UNIQUE,
    tenant_id UUID NOT NULL,
    goal TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'thinking',
    current_step TEXT,
    thoughts JSONB DEFAULT '[]',
    models_used TEXT[],
    searches_performed INTEGER DEFAULT 0,
    workflows_created TEXT[],
    result TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_thinking_sessions_tenant ON consciousness_thinking_sessions(tenant_id);
CREATE INDEX idx_thinking_sessions_status ON consciousness_thinking_sessions(status);

-- Problem solving history
CREATE TABLE IF NOT EXISTS consciousness_problem_solving (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    problem TEXT NOT NULL,
    approach VARCHAR(100),
    solution TEXT,
    steps JSONB DEFAULT '[]',
    confidence DECIMAL(5, 4),
    workflow_created VARCHAR(255),
    sources_used TEXT[],
    models_used TEXT[],
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_problem_solving_tenant ON consciousness_problem_solving(tenant_id);

-- RLS for new tables
ALTER TABLE consciousness_model_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_web_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_thinking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_problem_solving ENABLE ROW LEVEL SECURITY;

CREATE POLICY consciousness_model_invocations_tenant_isolation ON consciousness_model_invocations
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consciousness_web_searches_tenant_isolation ON consciousness_web_searches
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consciousness_research_jobs_tenant_isolation ON consciousness_research_jobs
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consciousness_workflows_tenant_isolation ON consciousness_workflows
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consciousness_thinking_sessions_tenant_isolation ON consciousness_thinking_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY consciousness_problem_solving_tenant_isolation ON consciousness_problem_solving
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Comments for new tables
-- Add estimated_cost_usd column to model invocations
ALTER TABLE consciousness_model_invocations ADD COLUMN IF NOT EXISTS estimated_cost_usd DECIMAL(10, 6);

-- Cost aggregates for tracking (daily rollups)
CREATE TABLE IF NOT EXISTS consciousness_cost_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    date DATE NOT NULL,
    total_tokens BIGINT DEFAULT 0,
    total_cost_usd DECIMAL(12, 6) DEFAULT 0,
    invocation_count INTEGER DEFAULT 0,
    search_count INTEGER DEFAULT 0,
    workflow_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, date)
);

CREATE INDEX idx_cost_aggregates_tenant_date ON consciousness_cost_aggregates(tenant_id, date DESC);

ALTER TABLE consciousness_cost_aggregates ENABLE ROW LEVEL SECURITY;
CREATE POLICY consciousness_cost_aggregates_tenant_isolation ON consciousness_cost_aggregates
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

COMMENT ON TABLE consciousness_cost_aggregates IS 'Daily cost aggregates for consciousness engine usage';

-- Budget configuration per tenant
CREATE TABLE IF NOT EXISTS consciousness_budget_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE,
    daily_limit_usd DECIMAL(10, 2) DEFAULT 10.00,
    monthly_limit_usd DECIMAL(10, 2) DEFAULT 100.00,
    alert_threshold DECIMAL(3, 2) DEFAULT 0.80,
    is_enabled BOOLEAN DEFAULT true,
    is_over_limit BOOLEAN DEFAULT false,
    disabled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_budget_config_tenant ON consciousness_budget_config(tenant_id);

-- Budget alerts
CREATE TABLE IF NOT EXISTS consciousness_budget_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    period VARCHAR(20) NOT NULL,
    current_spend DECIMAL(12, 6) NOT NULL,
    spend_limit DECIMAL(12, 6) NOT NULL,
    message TEXT,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_budget_alerts_tenant ON consciousness_budget_alerts(tenant_id, created_at DESC);

-- Budget events log
CREATE TABLE IF NOT EXISTS consciousness_budget_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_budget_events_tenant ON consciousness_budget_events(tenant_id, created_at DESC);

-- Platform-wide stats
CREATE TABLE IF NOT EXISTS consciousness_platform_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    total_invocations BIGINT DEFAULT 0,
    total_tokens BIGINT DEFAULT 0,
    total_cost_usd DECIMAL(12, 6) DEFAULT 0,
    active_tenants INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage log for billing integration
CREATE TABLE IF NOT EXISTS consciousness_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    usage_type VARCHAR(50) NOT NULL,
    quantity DECIMAL(12, 6) NOT NULL,
    unit_cost DECIMAL(12, 8) NOT NULL,
    total_cost DECIMAL(12, 6) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_usage_log_tenant ON consciousness_usage_log(tenant_id, created_at DESC);
CREATE INDEX idx_usage_log_type ON consciousness_usage_log(usage_type, created_at DESC);

-- RLS for new tables
ALTER TABLE consciousness_budget_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_budget_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_budget_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY consciousness_budget_config_tenant_isolation ON consciousness_budget_config
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY consciousness_budget_alerts_tenant_isolation ON consciousness_budget_alerts
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY consciousness_budget_events_tenant_isolation ON consciousness_budget_events
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY consciousness_usage_log_tenant_isolation ON consciousness_usage_log
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

COMMENT ON TABLE consciousness_budget_config IS 'Per-tenant consciousness budget limits';
COMMENT ON TABLE consciousness_budget_alerts IS 'Budget warning and limit alerts';
COMMENT ON TABLE consciousness_budget_events IS 'Budget-related events log';
COMMENT ON TABLE consciousness_platform_stats IS 'Platform-wide consciousness usage stats';
COMMENT ON TABLE consciousness_usage_log IS 'Detailed usage log for billing';
COMMENT ON TABLE consciousness_model_invocations IS 'Log of all model invocations by consciousness engine';
COMMENT ON TABLE consciousness_web_searches IS 'Log of web searches performed';
COMMENT ON TABLE consciousness_research_jobs IS 'Deep research jobs (async)';
COMMENT ON TABLE consciousness_workflows IS 'Workflows created by consciousness engine';
COMMENT ON TABLE consciousness_thinking_sessions IS 'Autonomous thinking sessions';
COMMENT ON TABLE consciousness_problem_solving IS 'Problem solving history and outcomes';
