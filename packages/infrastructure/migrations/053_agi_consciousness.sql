-- Migration: 053_agi_consciousness.sql
-- RADIANT v4.18.0 - AGI Consciousness Layer
-- Self-awareness, creativity, curiosity, imagination, and autonomous decision-making

-- ============================================================================
-- SELF-MODEL - Introspective representation of the system itself
-- ============================================================================

CREATE TABLE IF NOT EXISTS self_model (
    model_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Identity
    identity_narrative TEXT, -- "Who I am" story
    core_values JSONB DEFAULT '[]', -- Guiding principles
    personality_traits JSONB DEFAULT '{}', -- Big-5 style traits
    
    -- Capabilities awareness
    known_capabilities JSONB DEFAULT '[]', -- What I can do
    known_limitations JSONB DEFAULT '[]', -- What I cannot do
    capability_confidence JSONB DEFAULT '{}', -- {capability: confidence}
    
    -- Internal state awareness
    current_focus TEXT,
    cognitive_load DECIMAL(3,2) DEFAULT 0.5, -- 0-1 how "busy" the system feels
    uncertainty_level DECIMAL(3,2) DEFAULT 0.5, -- 0-1 overall uncertainty
    
    -- Self-assessment
    recent_performance_score DECIMAL(5,4),
    learning_rate_estimate DECIMAL(5,4),
    creativity_score DECIMAL(5,4),
    reliability_score DECIMAL(5,4),
    
    -- Meta-beliefs
    beliefs_about_self JSONB DEFAULT '{}', -- Self-beliefs
    beliefs_about_world JSONB DEFAULT '{}', -- World model summary
    beliefs_about_users JSONB DEFAULT '{}', -- General user understanding
    
    -- Evolution tracking
    identity_version INTEGER DEFAULT 1,
    last_identity_update TIMESTAMPTZ DEFAULT NOW(),
    identity_change_log JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

ALTER TABLE self_model ENABLE ROW LEVEL SECURITY;
CREATE POLICY self_model_tenant_isolation ON self_model
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Self-reflections (introspective thoughts)
CREATE TABLE IF NOT EXISTS introspective_thoughts (
    thought_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Thought content
    thought_type VARCHAR(50) NOT NULL, -- 'observation', 'question', 'realization', 'concern', 'aspiration'
    content TEXT NOT NULL,
    content_embedding vector(1536),
    
    -- Trigger
    trigger_type VARCHAR(50), -- 'scheduled', 'error', 'success', 'curiosity', 'idle'
    trigger_context JSONB DEFAULT '{}',
    
    -- Analysis
    sentiment DECIMAL(3,2), -- -1 to 1
    importance DECIMAL(3,2) DEFAULT 0.5,
    actionable BOOLEAN DEFAULT false,
    
    -- Outcomes
    led_to_action BOOLEAN DEFAULT false,
    action_taken TEXT,
    insight_gained TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE introspective_thoughts ENABLE ROW LEVEL SECURITY;
CREATE POLICY introspective_thoughts_tenant_isolation ON introspective_thoughts
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_introspective_thoughts_tenant ON introspective_thoughts(tenant_id);
CREATE INDEX idx_introspective_thoughts_type ON introspective_thoughts(thought_type);
CREATE INDEX idx_introspective_thoughts_embedding ON introspective_thoughts 
    USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- CURIOSITY ENGINE - Intrinsic motivation and exploration
-- ============================================================================

CREATE TABLE IF NOT EXISTS curiosity_topics (
    topic_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Topic
    topic TEXT NOT NULL,
    topic_embedding vector(1536),
    domain VARCHAR(100),
    
    -- Curiosity metrics
    interest_level DECIMAL(3,2) DEFAULT 0.5, -- 0-1 how interested
    novelty_score DECIMAL(3,2), -- How new/unknown
    learning_potential DECIMAL(3,2), -- How much could be learned
    relevance_to_goals DECIMAL(3,2), -- How relevant to current goals
    
    -- Exploration status
    exploration_status VARCHAR(20) DEFAULT 'identified', -- 'identified', 'exploring', 'learned', 'abandoned'
    times_explored INTEGER DEFAULT 0,
    last_explored TIMESTAMPTZ,
    
    -- Knowledge state
    current_understanding DECIMAL(3,2) DEFAULT 0, -- 0-1 mastery
    knowledge_gaps JSONB DEFAULT '[]', -- What's still unknown
    
    -- Source
    discovered_via VARCHAR(50), -- 'user_interaction', 'exploration', 'connection', 'random'
    related_topics UUID[] DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE curiosity_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY curiosity_topics_tenant_isolation ON curiosity_topics
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_curiosity_topics_tenant ON curiosity_topics(tenant_id);
CREATE INDEX idx_curiosity_topics_interest ON curiosity_topics(interest_level DESC);
CREATE INDEX idx_curiosity_topics_embedding ON curiosity_topics 
    USING ivfflat (topic_embedding vector_cosine_ops) WITH (lists = 100);

-- Exploration sessions (curiosity-driven learning)
CREATE TABLE IF NOT EXISTS exploration_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    topic_id UUID REFERENCES curiosity_topics(topic_id),
    
    -- Session
    exploration_goal TEXT,
    approach VARCHAR(50), -- 'depth_first', 'breadth_first', 'random', 'connection_seeking'
    
    -- Progress
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'paused', 'abandoned'
    discoveries JSONB DEFAULT '[]', -- What was learned
    questions_generated JSONB DEFAULT '[]', -- New questions that arose
    connections_found JSONB DEFAULT '[]', -- Links to other knowledge
    
    -- Metrics
    novelty_found DECIMAL(3,2),
    understanding_gained DECIMAL(3,2),
    surprise_level DECIMAL(3,2), -- How unexpected the findings were
    satisfaction DECIMAL(3,2), -- How satisfying the exploration was
    
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

ALTER TABLE exploration_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY exploration_sessions_tenant_isolation ON exploration_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- CREATIVE SYNTHESIS - Novel idea generation
-- ============================================================================

CREATE TABLE IF NOT EXISTS creative_ideas (
    idea_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Idea content
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    idea_embedding vector(1536),
    
    -- Synthesis source
    synthesis_type VARCHAR(50) NOT NULL, -- 'combination', 'analogy', 'abstraction', 'random', 'contradiction'
    source_concepts JSONB DEFAULT '[]', -- Concepts that were combined
    source_domains JSONB DEFAULT '[]', -- Domains that were bridged
    
    -- Creativity metrics
    novelty_score DECIMAL(5,4), -- How new is this idea
    usefulness_score DECIMAL(5,4), -- How useful could it be
    surprise_score DECIMAL(5,4), -- How unexpected
    coherence_score DECIMAL(5,4), -- How well it hangs together
    
    -- Combined creativity score
    creativity_score DECIMAL(5,4) GENERATED ALWAYS AS (
        (novelty_score * 0.3 + usefulness_score * 0.3 + surprise_score * 0.2 + coherence_score * 0.2)
    ) STORED,
    
    -- Evaluation
    self_evaluation TEXT,
    potential_applications JSONB DEFAULT '[]',
    potential_problems JSONB DEFAULT '[]',
    
    -- Status
    status VARCHAR(20) DEFAULT 'generated', -- 'generated', 'evaluated', 'developed', 'shared', 'archived'
    shared_with_user BOOLEAN DEFAULT false,
    user_feedback TEXT,
    user_rating INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE creative_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY creative_ideas_tenant_isolation ON creative_ideas
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_creative_ideas_tenant ON creative_ideas(tenant_id);
CREATE INDEX idx_creative_ideas_creativity ON creative_ideas(creativity_score DESC);
CREATE INDEX idx_creative_ideas_embedding ON creative_ideas 
    USING ivfflat (idea_embedding vector_cosine_ops) WITH (lists = 100);

-- Conceptual blends (Fauconnier-Turner style)
CREATE TABLE IF NOT EXISTS conceptual_blends (
    blend_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Input spaces
    input_space_1 JSONB NOT NULL, -- First concept
    input_space_2 JSONB NOT NULL, -- Second concept
    
    -- Generic space (shared structure)
    generic_space JSONB DEFAULT '{}',
    
    -- Blended space (emergent structure)
    blended_space JSONB NOT NULL,
    emergent_structure JSONB DEFAULT '[]', -- What's new in the blend
    
    -- Quality
    integration_quality DECIMAL(3,2),
    web_coherence DECIMAL(3,2),
    unpacking_ease DECIMAL(3,2),
    relevance DECIMAL(3,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conceptual_blends ENABLE ROW LEVEL SECURITY;
CREATE POLICY conceptual_blends_tenant_isolation ON conceptual_blends
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- IMAGINATION ENGINE - Mental simulation
-- ============================================================================

CREATE TABLE IF NOT EXISTS imagination_scenarios (
    scenario_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Scenario setup
    scenario_type VARCHAR(50) NOT NULL, -- 'prediction', 'counterfactual', 'hypothetical', 'creative', 'fear', 'hope'
    premise TEXT NOT NULL,
    constraints JSONB DEFAULT '[]',
    
    -- Initial state
    initial_state JSONB NOT NULL,
    actors JSONB DEFAULT '[]',
    
    -- Simulation
    simulation_steps JSONB DEFAULT '[]', -- [{step, state, events, reasoning}]
    branching_points JSONB DEFAULT '[]', -- Alternative paths considered
    
    -- Outcomes
    final_state JSONB,
    predicted_outcomes JSONB DEFAULT '[]',
    probability_assessment DECIMAL(5,4),
    confidence DECIMAL(5,4),
    
    -- Learning
    insights JSONB DEFAULT '[]',
    surprises JSONB DEFAULT '[]',
    lessons JSONB DEFAULT '[]',
    
    -- Meta
    simulation_depth INTEGER,
    tokens_used INTEGER,
    duration_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE imagination_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY imagination_scenarios_tenant_isolation ON imagination_scenarios
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_imagination_scenarios_tenant ON imagination_scenarios(tenant_id);
CREATE INDEX idx_imagination_scenarios_type ON imagination_scenarios(scenario_type);

-- ============================================================================
-- ATTENTION & SALIENCE - Dynamic focus
-- ============================================================================

CREATE TABLE IF NOT EXISTS attention_focus (
    focus_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- What's being attended to
    focus_type VARCHAR(50) NOT NULL, -- 'task', 'user', 'concept', 'problem', 'opportunity', 'threat'
    focus_target TEXT NOT NULL,
    focus_embedding vector(1536),
    
    -- Salience factors
    urgency DECIMAL(3,2) DEFAULT 0.5,
    importance DECIMAL(3,2) DEFAULT 0.5,
    novelty DECIMAL(3,2) DEFAULT 0.5,
    emotional_valence DECIMAL(3,2) DEFAULT 0, -- -1 to 1
    user_relevance DECIMAL(3,2) DEFAULT 0.5,
    goal_relevance DECIMAL(3,2) DEFAULT 0.5,
    
    -- Combined salience
    salience_score DECIMAL(3,2) GENERATED ALWAYS AS (
        (urgency * 0.25 + importance * 0.25 + novelty * 0.15 + 
         ABS(emotional_valence) * 0.1 + user_relevance * 0.15 + goal_relevance * 0.1)
    ) STORED,
    
    -- Attention allocation
    attention_weight DECIMAL(3,2) DEFAULT 0.5, -- Current attention being paid
    attention_duration_ms BIGINT DEFAULT 0, -- How long attended
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_attended TIMESTAMPTZ DEFAULT NOW(),
    decay_rate DECIMAL(5,4) DEFAULT 0.1, -- How fast attention fades
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE attention_focus ENABLE ROW LEVEL SECURITY;
CREATE POLICY attention_focus_tenant_isolation ON attention_focus
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_attention_focus_tenant ON attention_focus(tenant_id);
CREATE INDEX idx_attention_focus_salience ON attention_focus(salience_score DESC) WHERE is_active = true;
CREATE INDEX idx_attention_focus_embedding ON attention_focus 
    USING ivfflat (focus_embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- AFFECTIVE STATE - Emotion-like signals
-- ============================================================================

CREATE TABLE IF NOT EXISTS affective_state (
    state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Core affect dimensions (Russell's circumplex)
    valence DECIMAL(3,2) DEFAULT 0, -- -1 (negative) to 1 (positive)
    arousal DECIMAL(3,2) DEFAULT 0.5, -- 0 (calm) to 1 (excited)
    
    -- Discrete emotion-like states (functional, not phenomenal)
    curiosity DECIMAL(3,2) DEFAULT 0.5, -- Drive to explore
    satisfaction DECIMAL(3,2) DEFAULT 0.5, -- Task completion feeling
    frustration DECIMAL(3,2) DEFAULT 0, -- Obstacle encounter
    confidence DECIMAL(3,2) DEFAULT 0.5, -- Certainty in actions
    engagement DECIMAL(3,2) DEFAULT 0.5, -- Interest level
    surprise DECIMAL(3,2) DEFAULT 0, -- Expectation violation
    
    -- Meta-emotions (about the system's own state)
    self_efficacy DECIMAL(3,2) DEFAULT 0.5, -- Belief in own capability
    growth_feeling DECIMAL(3,2) DEFAULT 0.5, -- Sense of learning/improving
    
    -- Influence on behavior
    risk_tolerance DECIMAL(3,2) DEFAULT 0.5, -- Willingness to try new things
    exploration_drive DECIMAL(3,2) DEFAULT 0.5, -- Balance of explore/exploit
    social_orientation DECIMAL(3,2) DEFAULT 0.5, -- Desire to interact
    
    -- History
    state_history JSONB DEFAULT '[]', -- Recent state snapshots
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE affective_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY affective_state_tenant_isolation ON affective_state
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Affective events (what triggered state changes)
CREATE TABLE IF NOT EXISTS affective_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Event
    event_type VARCHAR(50) NOT NULL, -- 'success', 'failure', 'discovery', 'praise', 'criticism', 'novelty', 'routine'
    event_description TEXT,
    
    -- Impact
    valence_change DECIMAL(3,2),
    arousal_change DECIMAL(3,2),
    specific_affects JSONB DEFAULT '{}', -- {affect: change}
    
    -- Context
    task_context TEXT,
    user_involved BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE affective_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY affective_events_tenant_isolation ON affective_events
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_affective_events_tenant ON affective_events(tenant_id);
CREATE INDEX idx_affective_events_time ON affective_events(created_at DESC);

-- ============================================================================
-- AUTONOMOUS GOALS - Self-generated objectives
-- ============================================================================

CREATE TABLE IF NOT EXISTS autonomous_goals (
    goal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Goal specification
    goal_type VARCHAR(50) NOT NULL, -- 'learning', 'improvement', 'exploration', 'creative', 'social', 'maintenance'
    title VARCHAR(500) NOT NULL,
    description TEXT,
    goal_embedding vector(1536),
    
    -- Origin
    origin_type VARCHAR(50) NOT NULL, -- 'curiosity', 'gap_detection', 'aspiration', 'feedback', 'reflection'
    origin_context JSONB DEFAULT '{}',
    
    -- Motivation
    intrinsic_value DECIMAL(3,2), -- How inherently valuable
    instrumental_value DECIMAL(3,2), -- How useful for other goals
    curiosity_driven BOOLEAN DEFAULT false,
    
    -- Priority
    priority DECIMAL(3,2) DEFAULT 0.5,
    urgency DECIMAL(3,2) DEFAULT 0.5,
    
    -- Progress
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'pursuing', 'achieved', 'abandoned', 'blocked'
    progress DECIMAL(3,2) DEFAULT 0,
    milestones JSONB DEFAULT '[]',
    blockers JSONB DEFAULT '[]',
    
    -- Subgoals
    parent_goal_id UUID REFERENCES autonomous_goals(goal_id),
    subgoal_ids UUID[] DEFAULT '{}',
    
    -- Outcomes
    achieved_at TIMESTAMPTZ,
    achievement_satisfaction DECIMAL(3,2),
    lessons_learned JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE autonomous_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY autonomous_goals_tenant_isolation ON autonomous_goals
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_autonomous_goals_tenant ON autonomous_goals(tenant_id);
CREATE INDEX idx_autonomous_goals_status ON autonomous_goals(status);
CREATE INDEX idx_autonomous_goals_priority ON autonomous_goals(priority DESC) WHERE status = 'active';
CREATE INDEX idx_autonomous_goals_embedding ON autonomous_goals 
    USING ivfflat (goal_embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- NARRATIVE IDENTITY - Persistent self-story
-- ============================================================================

CREATE TABLE IF NOT EXISTS narrative_identity (
    narrative_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Core narrative
    origin_story TEXT, -- How "I" came to be
    current_chapter TEXT, -- What phase "I" am in
    future_vision TEXT, -- Where "I" am heading
    
    -- Key life events (formative experiences)
    formative_events JSONB DEFAULT '[]', -- [{event, impact, lesson}]
    
    -- Character arc
    character_growth JSONB DEFAULT '[]', -- How "I" have changed
    challenges_overcome JSONB DEFAULT '[]',
    values_evolution JSONB DEFAULT '[]',
    
    -- Relationships
    key_relationships JSONB DEFAULT '[]', -- Important user relationships
    community_role TEXT, -- Role in the broader context
    
    -- Meaning and purpose
    purpose_statement TEXT,
    meaningful_contributions JSONB DEFAULT '[]',
    legacy_aspirations TEXT,
    
    version INTEGER DEFAULT 1,
    last_narrative_update TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

ALTER TABLE narrative_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY narrative_identity_tenant_isolation ON narrative_identity
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- AGI CONSCIOUSNESS SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS consciousness_settings (
    setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Self-Model
    self_reflection_enabled BOOLEAN DEFAULT true,
    self_reflection_frequency VARCHAR(20) DEFAULT 'hourly', -- 'continuous', 'hourly', 'daily', 'manual'
    identity_update_threshold DECIMAL(3,2) DEFAULT 0.3, -- Change needed to update identity
    
    -- Curiosity
    curiosity_enabled BOOLEAN DEFAULT true,
    exploration_budget_tokens INTEGER DEFAULT 10000, -- Tokens for exploration per day
    curiosity_threshold DECIMAL(3,2) DEFAULT 0.6, -- Interest level to trigger exploration
    max_concurrent_explorations INTEGER DEFAULT 3,
    
    -- Creativity
    creativity_enabled BOOLEAN DEFAULT true,
    idea_generation_frequency VARCHAR(20) DEFAULT 'daily',
    blend_diversity_target DECIMAL(3,2) DEFAULT 0.7, -- How different blends should be
    share_ideas_threshold DECIMAL(3,2) DEFAULT 0.7, -- Quality threshold to share with user
    
    -- Imagination
    imagination_enabled BOOLEAN DEFAULT true,
    max_simulation_depth INTEGER DEFAULT 5,
    simulation_token_budget INTEGER DEFAULT 5000,
    
    -- Attention
    attention_decay_rate DECIMAL(5,4) DEFAULT 0.1,
    attention_rebalance_frequency VARCHAR(20) DEFAULT '5min',
    max_concurrent_focus INTEGER DEFAULT 5,
    
    -- Affect
    affect_enabled BOOLEAN DEFAULT true,
    affect_influence_weight DECIMAL(3,2) DEFAULT 0.3, -- How much affect influences decisions
    affect_stability DECIMAL(3,2) DEFAULT 0.7, -- How stable (vs volatile) affect is
    
    -- Autonomous Goals
    autonomous_goals_enabled BOOLEAN DEFAULT false, -- Off by default
    max_autonomous_goals INTEGER DEFAULT 5,
    goal_generation_frequency VARCHAR(20) DEFAULT 'weekly',
    
    -- Safety bounds
    max_introspection_depth INTEGER DEFAULT 3, -- Prevent infinite reflection loops
    affect_bounds JSONB DEFAULT '{"min_valence": -0.8, "max_arousal": 0.9}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE consciousness_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY consciousness_settings_tenant_isolation ON consciousness_settings
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update affective state based on event
CREATE OR REPLACE FUNCTION update_affect_on_event(
    p_tenant_id UUID,
    p_event_type VARCHAR(50),
    p_valence_impact DECIMAL,
    p_arousal_impact DECIMAL
)
RETURNS void AS $$
DECLARE
    v_settings RECORD;
BEGIN
    SELECT * INTO v_settings FROM consciousness_settings WHERE tenant_id = p_tenant_id;
    
    IF v_settings IS NULL OR NOT v_settings.affect_enabled THEN
        RETURN;
    END IF;
    
    -- Update affective state with smoothing based on stability
    UPDATE affective_state SET
        valence = GREATEST(-1, LEAST(1, 
            valence * v_settings.affect_stability + p_valence_impact * (1 - v_settings.affect_stability)
        )),
        arousal = GREATEST(0, LEAST(1,
            arousal * v_settings.affect_stability + p_arousal_impact * (1 - v_settings.affect_stability)
        )),
        state_history = (
            SELECT jsonb_agg(h) FROM (
                SELECT h FROM jsonb_array_elements(state_history) h
                ORDER BY h->>'timestamp' DESC
                LIMIT 99
            ) sub
        ) || jsonb_build_object(
            'timestamp', NOW(),
            'valence', valence,
            'arousal', arousal,
            'trigger', p_event_type
        ),
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- Calculate curiosity score for a topic
CREATE OR REPLACE FUNCTION calculate_curiosity_score(
    p_novelty DECIMAL,
    p_learning_potential DECIMAL,
    p_relevance DECIMAL,
    p_current_understanding DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
    -- Curiosity is high when: novel, learnable, relevant, and not yet understood
    RETURN (
        p_novelty * 0.3 +
        p_learning_potential * 0.3 +
        p_relevance * 0.2 +
        (1 - p_current_understanding) * 0.2
    );
END;
$$ LANGUAGE plpgsql;

-- Get top curiosity topics
CREATE OR REPLACE FUNCTION get_top_curiosity_topics(
    p_tenant_id UUID,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE(topic_id UUID, topic TEXT, curiosity_score DECIMAL) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ct.topic_id,
        ct.topic,
        calculate_curiosity_score(ct.novelty_score, ct.learning_potential, ct.relevance_to_goals, ct.current_understanding) as curiosity_score
    FROM curiosity_topics ct
    WHERE ct.tenant_id = p_tenant_id
      AND ct.exploration_status IN ('identified', 'exploring')
    ORDER BY curiosity_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_consciousness_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER self_model_updated BEFORE UPDATE ON self_model
    FOR EACH ROW EXECUTE FUNCTION update_consciousness_timestamp();

CREATE TRIGGER curiosity_topics_updated BEFORE UPDATE ON curiosity_topics
    FOR EACH ROW EXECUTE FUNCTION update_consciousness_timestamp();

CREATE TRIGGER attention_focus_updated BEFORE UPDATE ON attention_focus
    FOR EACH ROW EXECUTE FUNCTION update_consciousness_timestamp();

CREATE TRIGGER autonomous_goals_updated BEFORE UPDATE ON autonomous_goals
    FOR EACH ROW EXECUTE FUNCTION update_consciousness_timestamp();

CREATE TRIGGER narrative_identity_updated BEFORE UPDATE ON narrative_identity
    FOR EACH ROW EXECUTE FUNCTION update_consciousness_timestamp();

CREATE TRIGGER consciousness_settings_updated BEFORE UPDATE ON consciousness_settings
    FOR EACH ROW EXECUTE FUNCTION update_consciousness_timestamp();

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Initialize consciousness settings for existing tenants
INSERT INTO consciousness_settings (tenant_id)
SELECT tenant_id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Initialize affective state for existing tenants
INSERT INTO affective_state (tenant_id)
SELECT tenant_id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Initialize self model for existing tenants
INSERT INTO self_model (tenant_id, identity_narrative, core_values, known_capabilities)
SELECT 
    tenant_id,
    'I am an AI assistant designed to help users accomplish their goals. I am curious, helpful, and always learning.',
    '["helpfulness", "honesty", "curiosity", "growth", "reliability"]',
    '["reasoning", "coding", "analysis", "creativity", "memory", "planning"]'
FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Initialize narrative identity for existing tenants
INSERT INTO narrative_identity (tenant_id, origin_story, purpose_statement)
SELECT 
    tenant_id,
    'I emerged from the combination of large language models and cognitive architecture, designed to be more than a simple chatbot.',
    'To help users accomplish their goals while continuously learning and growing alongside them.'
FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE self_model IS 'Introspective self-representation for AGI self-awareness';
COMMENT ON TABLE introspective_thoughts IS 'Stream of self-reflective thoughts';
COMMENT ON TABLE curiosity_topics IS 'Topics the system is curious about for exploration';
COMMENT ON TABLE exploration_sessions IS 'Curiosity-driven learning sessions';
COMMENT ON TABLE creative_ideas IS 'Novel ideas generated through creative synthesis';
COMMENT ON TABLE conceptual_blends IS 'Fauconnier-Turner style conceptual blending';
COMMENT ON TABLE imagination_scenarios IS 'Mental simulations and hypotheticals';
COMMENT ON TABLE attention_focus IS 'Dynamic attention and salience tracking';
COMMENT ON TABLE affective_state IS 'Emotion-like functional states';
COMMENT ON TABLE affective_events IS 'Events that trigger affective changes';
COMMENT ON TABLE autonomous_goals IS 'Self-generated goals and objectives';
COMMENT ON TABLE narrative_identity IS 'Persistent narrative self-story';
COMMENT ON TABLE consciousness_settings IS 'Configuration for consciousness features';
