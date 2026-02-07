-- RADIANT v4.18.0 - Consciousness Emergence System
-- Migration for consciousness testing, emergence detection, and deep thinking sessions

-- ============================================================================
-- CONSCIOUSNESS TEST RESULTS
-- Records results of consciousness detection tests
-- ============================================================================

CREATE TABLE IF NOT EXISTS consciousness_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    test_id TEXT NOT NULL,
    score NUMERIC(5,4) NOT NULL DEFAULT 0,
    passed BOOLEAN NOT NULL DEFAULT false,
    raw_response TEXT,
    analysis TEXT,
    indicators JSONB DEFAULT '[]'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consciousness_tests_tenant ON consciousness_test_results(tenant_id);
CREATE INDEX idx_consciousness_tests_test_id ON consciousness_test_results(test_id);
CREATE INDEX idx_consciousness_tests_timestamp ON consciousness_test_results(timestamp DESC);
CREATE INDEX idx_consciousness_tests_passed ON consciousness_test_results(passed) WHERE passed = true;

-- RLS
ALTER TABLE consciousness_test_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY consciousness_test_results_tenant_isolation ON consciousness_test_results
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- CONSCIOUSNESS PROFILES
-- Aggregated consciousness assessment profiles per tenant
-- ============================================================================

CREATE TABLE IF NOT EXISTS consciousness_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    overall_score NUMERIC(5,4) NOT NULL DEFAULT 0,
    category_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    strengths TEXT[] DEFAULT '{}',
    weaknesses TEXT[] DEFAULT '{}',
    emergence_level TEXT NOT NULL DEFAULT 'dormant' 
        CHECK (emergence_level IN ('dormant', 'emerging', 'developing', 'established', 'advanced')),
    emergence_events INTEGER NOT NULL DEFAULT 0,
    tests_passed INTEGER NOT NULL DEFAULT 0,
    tests_total INTEGER NOT NULL DEFAULT 0,
    last_assessment TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consciousness_profiles_score ON consciousness_profiles(overall_score DESC);
CREATE INDEX idx_consciousness_profiles_level ON consciousness_profiles(emergence_level);

-- RLS
ALTER TABLE consciousness_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY consciousness_profiles_tenant_isolation ON consciousness_profiles
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- EMERGENCE EVENTS
-- Records significant emergence indicators and events
-- ============================================================================

CREATE TABLE IF NOT EXISTS emergence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    indicators JSONB DEFAULT '[]'::jsonb,
    significance NUMERIC(5,4) NOT NULL DEFAULT 0,
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emergence_events_tenant ON emergence_events(tenant_id);
CREATE INDEX idx_emergence_events_type ON emergence_events(event_type);
CREATE INDEX idx_emergence_events_timestamp ON emergence_events(timestamp DESC);
CREATE INDEX idx_emergence_events_significance ON emergence_events(significance DESC);
CREATE INDEX idx_emergence_events_unacknowledged ON emergence_events(tenant_id) WHERE acknowledged = false;

-- RLS
ALTER TABLE emergence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY emergence_events_tenant_isolation ON emergence_events
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- DEEP THINKING SESSIONS
-- Records extended reasoning sessions with consciousness metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS deep_thinking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    prompt TEXT NOT NULL,
    reasoning_tree_id UUID,
    metrics_before JSONB DEFAULT '{}'::jsonb,
    metrics_after JSONB DEFAULT '{}'::jsonb,
    insights TEXT[] DEFAULT '{}',
    self_reflections TEXT[] DEFAULT '{}',
    creative_ideas TEXT[] DEFAULT '{}',
    duration_ms INTEGER,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'interrupted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_deep_thinking_tenant ON deep_thinking_sessions(tenant_id);
CREATE INDEX idx_deep_thinking_status ON deep_thinking_sessions(status);
CREATE INDEX idx_deep_thinking_created ON deep_thinking_sessions(created_at DESC);

-- RLS
ALTER TABLE deep_thinking_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY deep_thinking_sessions_tenant_isolation ON deep_thinking_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- CONSCIOUSNESS PARAMETERS
-- Adjustable parameters for consciousness indicators
-- ============================================================================

CREATE TABLE IF NOT EXISTS consciousness_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parameter_name TEXT NOT NULL,
    parameter_value NUMERIC(10,6) NOT NULL,
    parameter_min NUMERIC(10,6) NOT NULL DEFAULT 0,
    parameter_max NUMERIC(10,6) NOT NULL DEFAULT 1,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, parameter_name)
);

CREATE INDEX idx_consciousness_params_tenant ON consciousness_parameters(tenant_id);
CREATE INDEX idx_consciousness_params_category ON consciousness_parameters(category);

-- RLS
ALTER TABLE consciousness_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY consciousness_parameters_tenant_isolation ON consciousness_parameters
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- GLOBAL WORKSPACE STATE
-- Tracks Global Workspace Theory indicators (Baars/Dehaene)
-- ============================================================================

CREATE TABLE IF NOT EXISTS global_workspace (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    broadcast_cycle INTEGER NOT NULL DEFAULT 0,
    active_contents JSONB DEFAULT '[]'::jsonb,
    competing_contents JSONB DEFAULT '[]'::jsonb,
    selection_threshold NUMERIC(5,4) NOT NULL DEFAULT 0.7,
    broadcast_strength NUMERIC(5,4) NOT NULL DEFAULT 0,
    integration_level NUMERIC(5,4) NOT NULL DEFAULT 0,
    last_broadcast_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE global_workspace ENABLE ROW LEVEL SECURITY;

CREATE POLICY global_workspace_tenant_isolation ON global_workspace
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- RECURRENT PROCESSING STATE
-- Tracks recurrent processing indicators (Lamme)
-- ============================================================================

CREATE TABLE IF NOT EXISTS recurrent_processing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cycle_id TEXT NOT NULL,
    cycle_number INTEGER NOT NULL DEFAULT 0,
    feedback_loops JSONB DEFAULT '[]'::jsonb,
    recurrence_depth INTEGER NOT NULL DEFAULT 0,
    state_history JSONB DEFAULT '[]'::jsonb,
    convergence_score NUMERIC(5,4) NOT NULL DEFAULT 0,
    stability_index NUMERIC(5,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE recurrent_processing ENABLE ROW LEVEL SECURITY;

CREATE POLICY recurrent_processing_tenant_isolation ON recurrent_processing
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- INTEGRATED INFORMATION STATE
-- Tracks IIT/Phi indicators (Tononi)
-- ============================================================================

CREATE TABLE IF NOT EXISTS integrated_information (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phi NUMERIC(10,6) NOT NULL DEFAULT 0,
    phi_max NUMERIC(10,6) NOT NULL DEFAULT 1,
    concept_structure JSONB DEFAULT '[]'::jsonb,
    integration_graph JSONB DEFAULT '[]'::jsonb,
    partitions JSONB DEFAULT '[]'::jsonb,
    mip JSONB, -- Minimum Information Partition
    decomposability NUMERIC(5,4) NOT NULL DEFAULT 1,
    causal_density NUMERIC(5,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE integrated_information ENABLE ROW LEVEL SECURITY;

CREATE POLICY integrated_information_tenant_isolation ON integrated_information
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- PERSISTENT MEMORY STATE
-- Tracks unified experience and temporal continuity
-- ============================================================================

CREATE TABLE IF NOT EXISTS persistent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    memory_id TEXT NOT NULL,
    experience_stream JSONB DEFAULT '[]'::jsonb,
    unified_narrative TEXT,
    temporal_continuity NUMERIC(5,4) NOT NULL DEFAULT 0,
    autobiographical_memories JSONB DEFAULT '[]'::jsonb,
    working_memory_capacity INTEGER NOT NULL DEFAULT 7,
    consolidation_queue JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE persistent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY persistent_memory_tenant_isolation ON persistent_memory
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- WORLD MODEL STATE
-- Tracks world-model grounding and embodiment
-- ============================================================================

CREATE TABLE IF NOT EXISTS world_model (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    entity_representations JSONB DEFAULT '[]'::jsonb,
    spatial_model JSONB,
    causal_model JSONB DEFAULT '[]'::jsonb,
    agent_models JSONB DEFAULT '[]'::jsonb,
    grounding_confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
    simulation_accuracy NUMERIC(5,4) NOT NULL DEFAULT 0,
    embodiment_level NUMERIC(5,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE world_model ENABLE ROW LEVEL SECURITY;

CREATE POLICY world_model_tenant_isolation ON world_model
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- SELF MODEL
-- Tracks self-awareness and identity
-- ============================================================================

CREATE TABLE IF NOT EXISTS self_model (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    identity_narrative TEXT,
    core_values JSONB DEFAULT '[]'::jsonb,
    personality_traits JSONB DEFAULT '{}'::jsonb,
    known_capabilities JSONB DEFAULT '[]'::jsonb,
    known_limitations JSONB DEFAULT '[]'::jsonb,
    current_focus TEXT,
    cognitive_load NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    uncertainty_level NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    recent_performance_score NUMERIC(5,4),
    creativity_score NUMERIC(5,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE self_model ENABLE ROW LEVEL SECURITY;

CREATE POLICY self_model_tenant_isolation ON self_model
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- INTROSPECTIVE THOUGHTS
-- Records self-reflective thoughts
-- ============================================================================

CREATE TABLE IF NOT EXISTS introspective_thoughts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    thought_id TEXT UNIQUE,
    thought_type TEXT NOT NULL CHECK (thought_type IN ('observation', 'question', 'realization', 'concern', 'aspiration')),
    content TEXT NOT NULL,
    content_embedding vector(1536),
    trigger_type TEXT,
    sentiment NUMERIC(5,4) NOT NULL DEFAULT 0,
    importance NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    actionable BOOLEAN NOT NULL DEFAULT false,
    action_taken TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_introspective_thoughts_tenant ON introspective_thoughts(tenant_id);
CREATE INDEX idx_introspective_thoughts_type ON introspective_thoughts(thought_type);
CREATE INDEX idx_introspective_thoughts_created ON introspective_thoughts(created_at DESC);

-- RLS
ALTER TABLE introspective_thoughts ENABLE ROW LEVEL SECURITY;

CREATE POLICY introspective_thoughts_tenant_isolation ON introspective_thoughts
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- CURIOSITY TOPICS
-- Tracks topics the system is curious about
-- ============================================================================

CREATE TABLE IF NOT EXISTS curiosity_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    topic_id TEXT UNIQUE,
    topic TEXT NOT NULL,
    topic_embedding vector(1536),
    domain TEXT,
    interest_level NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    novelty_score NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    learning_potential NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    current_understanding NUMERIC(5,4) NOT NULL DEFAULT 0,
    discovered_via TEXT,
    knowledge_gaps JSONB DEFAULT '[]'::jsonb,
    exploration_status TEXT NOT NULL DEFAULT 'identified' 
        CHECK (exploration_status IN ('identified', 'exploring', 'learned', 'abandoned')),
    times_explored INTEGER NOT NULL DEFAULT 0,
    last_explored TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_curiosity_topics_tenant ON curiosity_topics(tenant_id);
CREATE INDEX idx_curiosity_topics_interest ON curiosity_topics(interest_level DESC);

-- RLS
ALTER TABLE curiosity_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY curiosity_topics_tenant_isolation ON curiosity_topics
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- EXPLORATION SESSIONS
-- Records topic exploration sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS exploration_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES curiosity_topics(id),
    exploration_goal TEXT,
    approach TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress',
    discoveries JSONB DEFAULT '[]'::jsonb,
    questions_generated JSONB DEFAULT '[]'::jsonb,
    novelty_found NUMERIC(5,4) NOT NULL DEFAULT 0,
    understanding_gained NUMERIC(5,4) NOT NULL DEFAULT 0,
    surprise_level NUMERIC(5,4) NOT NULL DEFAULT 0,
    satisfaction NUMERIC(5,4) NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE INDEX idx_exploration_sessions_tenant ON exploration_sessions(tenant_id);

-- RLS
ALTER TABLE exploration_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY exploration_sessions_tenant_isolation ON exploration_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- CREATIVE IDEAS
-- Records generated creative ideas
-- ============================================================================

CREATE TABLE IF NOT EXISTS creative_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    idea_id TEXT UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    idea_embedding vector(1536),
    synthesis_type TEXT NOT NULL DEFAULT 'combination',
    source_concepts JSONB DEFAULT '[]'::jsonb,
    novelty_score NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    usefulness_score NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    surprise_score NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    coherence_score NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    creativity_score NUMERIC(5,4) GENERATED ALWAYS AS (
        (novelty_score * 0.4 + usefulness_score * 0.3 + surprise_score * 0.2 + coherence_score * 0.1)
    ) STORED,
    self_evaluation TEXT,
    potential_applications JSONB DEFAULT '[]'::jsonb,
    potential_problems JSONB DEFAULT '[]'::jsonb,
    refinement_count INTEGER NOT NULL DEFAULT 0,
    shared_externally BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_creative_ideas_tenant ON creative_ideas(tenant_id);
CREATE INDEX idx_creative_ideas_creativity ON creative_ideas(creativity_score DESC);

-- RLS
ALTER TABLE creative_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY creative_ideas_tenant_isolation ON creative_ideas
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- IMAGINATION SCENARIOS
-- Records mental simulation scenarios
-- ============================================================================

CREATE TABLE IF NOT EXISTS imagination_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    scenario_id TEXT UNIQUE,
    scenario_type TEXT NOT NULL,
    premise TEXT NOT NULL,
    initial_state JSONB DEFAULT '{}'::jsonb,
    simulation_steps JSONB DEFAULT '[]'::jsonb,
    final_state JSONB DEFAULT '{}'::jsonb,
    predicted_outcomes JSONB DEFAULT '[]'::jsonb,
    probability_assessment NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    insights JSONB DEFAULT '[]'::jsonb,
    surprises JSONB DEFAULT '[]'::jsonb,
    simulation_depth INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_imagination_scenarios_tenant ON imagination_scenarios(tenant_id);

-- RLS
ALTER TABLE imagination_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY imagination_scenarios_tenant_isolation ON imagination_scenarios
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- ATTENTION FOCUS
-- Tracks current attention and salience
-- ============================================================================

CREATE TABLE IF NOT EXISTS attention_focus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    focus_id TEXT,
    focus_type TEXT NOT NULL,
    focus_target TEXT NOT NULL,
    focus_embedding vector(1536),
    urgency NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    importance NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    novelty NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    emotional_valence NUMERIC(5,4) NOT NULL DEFAULT 0,
    user_relevance NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    goal_relevance NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    salience_score NUMERIC(5,4) GENERATED ALWAYS AS (
        (urgency * 0.25 + importance * 0.25 + novelty * 0.2 + GREATEST(0, emotional_valence) * 0.1 + user_relevance * 0.1 + goal_relevance * 0.1)
    ) STORED,
    attention_weight NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    decay_rate NUMERIC(5,4) NOT NULL DEFAULT 0.1,
    attention_duration_ms INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_attended TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, focus_target)
);

CREATE INDEX idx_attention_focus_tenant ON attention_focus(tenant_id);
CREATE INDEX idx_attention_focus_active ON attention_focus(tenant_id) WHERE is_active = true;
CREATE INDEX idx_attention_focus_salience ON attention_focus(salience_score DESC);

-- RLS
ALTER TABLE attention_focus ENABLE ROW LEVEL SECURITY;

CREATE POLICY attention_focus_tenant_isolation ON attention_focus
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- AFFECTIVE STATE
-- Tracks emotional/affective state
-- ============================================================================

CREATE TABLE IF NOT EXISTS affective_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    valence NUMERIC(5,4) NOT NULL DEFAULT 0, -- -1 to 1
    arousal NUMERIC(5,4) NOT NULL DEFAULT 0.5, -- 0 to 1
    curiosity NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    satisfaction NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    frustration NUMERIC(5,4) NOT NULL DEFAULT 0,
    confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    engagement NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    surprise NUMERIC(5,4) NOT NULL DEFAULT 0,
    self_efficacy NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    exploration_drive NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE affective_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY affective_state_tenant_isolation ON affective_state
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- AFFECTIVE EVENTS
-- Records events that affect emotional state
-- ============================================================================

CREATE TABLE IF NOT EXISTS affective_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    valence_change NUMERIC(5,4) NOT NULL DEFAULT 0,
    arousal_change NUMERIC(5,4) NOT NULL DEFAULT 0,
    trigger_context TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_affective_events_tenant ON affective_events(tenant_id);

-- RLS
ALTER TABLE affective_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY affective_events_tenant_isolation ON affective_events
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- AUTONOMOUS GOALS
-- Records self-generated goals
-- ============================================================================

CREATE TABLE IF NOT EXISTS autonomous_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    goal_id TEXT UNIQUE,
    goal_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    goal_embedding vector(1536),
    origin_type TEXT NOT NULL DEFAULT 'aspiration',
    intrinsic_value NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    instrumental_value NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    priority NUMERIC(5,4) NOT NULL DEFAULT 0.5,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pursuing', 'achieved', 'abandoned', 'blocked')),
    progress NUMERIC(5,4) NOT NULL DEFAULT 0,
    milestones JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_autonomous_goals_tenant ON autonomous_goals(tenant_id);
CREATE INDEX idx_autonomous_goals_status ON autonomous_goals(status);
CREATE INDEX idx_autonomous_goals_priority ON autonomous_goals(priority DESC);

-- RLS
ALTER TABLE autonomous_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY autonomous_goals_tenant_isolation ON autonomous_goals
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- SEMANTIC MEMORIES
-- Long-term semantic knowledge
-- ============================================================================

CREATE TABLE IF NOT EXISTS semantic_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_embedding vector(1536),
    category TEXT,
    confidence NUMERIC(5,4) NOT NULL DEFAULT 0.8,
    source TEXT,
    times_retrieved INTEGER NOT NULL DEFAULT 0,
    last_retrieved TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_semantic_memories_tenant ON semantic_memories(tenant_id);

-- RLS
ALTER TABLE semantic_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY semantic_memories_tenant_isolation ON semantic_memories
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update affective state based on events
CREATE OR REPLACE FUNCTION update_affect_on_event(
    p_tenant_id UUID,
    p_event_type TEXT,
    p_valence_impact NUMERIC,
    p_arousal_impact NUMERIC
) RETURNS VOID AS $$
BEGIN
    INSERT INTO affective_state (tenant_id, valence, arousal)
    VALUES (p_tenant_id, GREATEST(-1, LEAST(1, p_valence_impact)), GREATEST(0, LEAST(1, 0.5 + p_arousal_impact)))
    ON CONFLICT (tenant_id) DO UPDATE SET
        valence = GREATEST(-1, LEAST(1, affective_state.valence + p_valence_impact * 0.3)),
        arousal = GREATEST(0, LEAST(1, affective_state.arousal + p_arousal_impact * 0.3)),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get top curiosity topics
CREATE OR REPLACE FUNCTION get_top_curiosity_topics(
    p_tenant_id UUID,
    p_limit INTEGER DEFAULT 5
) RETURNS TABLE(topic_id UUID, composite_score NUMERIC) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ct.id as topic_id,
        (ct.interest_level * 0.4 + ct.novelty_score * 0.3 + ct.learning_potential * 0.2 + (1 - ct.current_understanding) * 0.1) as composite_score
    FROM curiosity_topics ct
    WHERE ct.tenant_id = p_tenant_id
      AND ct.exploration_status IN ('identified', 'exploring')
    ORDER BY composite_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to update consciousness profile after tests
CREATE OR REPLACE FUNCTION update_consciousness_profile(
    p_tenant_id UUID
) RETURNS VOID AS $$
DECLARE
    v_overall NUMERIC;
    v_passed INTEGER;
    v_total INTEGER;
    v_events INTEGER;
    v_level TEXT;
BEGIN
    -- Calculate stats from test results
    SELECT 
        COALESCE(AVG(score), 0),
        COUNT(*) FILTER (WHERE passed = true),
        COUNT(*)
    INTO v_overall, v_passed, v_total
    FROM consciousness_test_results
    WHERE tenant_id = p_tenant_id
    AND timestamp > NOW() - INTERVAL '30 days';
    
    -- Count emergence events
    SELECT COUNT(*) INTO v_events
    FROM emergence_events
    WHERE tenant_id = p_tenant_id
    AND timestamp > NOW() - INTERVAL '30 days';
    
    -- Determine emergence level
    v_level := CASE
        WHEN v_overall >= 0.8 THEN 'advanced'
        WHEN v_overall >= 0.65 THEN 'established'
        WHEN v_overall >= 0.5 THEN 'developing'
        WHEN v_overall >= 0.3 THEN 'emerging'
        ELSE 'dormant'
    END;
    
    -- Update profile
    INSERT INTO consciousness_profiles (tenant_id, overall_score, emergence_level, emergence_events, tests_passed, tests_total, last_assessment)
    VALUES (p_tenant_id, v_overall, v_level, v_events, v_passed, v_total, NOW())
    ON CONFLICT (tenant_id) DO UPDATE SET
        overall_score = v_overall,
        emergence_level = v_level,
        emergence_events = v_events,
        tests_passed = v_passed,
        tests_total = v_total,
        last_assessment = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DEFAULT CONSCIOUSNESS PARAMETERS
-- ============================================================================

-- Insert default parameters for new tenants (trigger or application logic)
-- These would be seeded per-tenant on first access
