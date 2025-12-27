-- Migration: 046_agi_world_model.sql
-- RADIANT v4.18.0 - AGI Enhancement Phase 1: World Model & Enhanced Memory
-- Implements episodic memory, world model entities/relations, and temporal reasoning

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================================
-- EPISODIC MEMORY - Events with temporal context and causal links
-- ============================================================================

CREATE TABLE IF NOT EXISTS episodic_memories (
    memory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    session_id UUID,
    conversation_id UUID,
    
    -- Temporal context
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INTEGER,
    
    -- Memory classification
    memory_type VARCHAR(50) NOT NULL, -- 'input', 'output', 'action', 'observation', 'decision', 'emotion'
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    
    -- Content
    content TEXT NOT NULL,
    summary TEXT, -- AI-generated summary
    content_embedding vector(1536),
    
    -- Extracted information
    entities JSONB DEFAULT '[]', -- [{id, type, name, role}]
    relations JSONB DEFAULT '[]', -- [{subject, predicate, object}]
    emotions JSONB DEFAULT '{}', -- {sentiment, valence, arousal}
    intentions JSONB DEFAULT '[]', -- Detected user intentions
    
    -- Temporal links (for narrative/causal reasoning)
    temporal_before UUID[], -- Memory IDs that occurred before
    temporal_after UUID[], -- Memory IDs that occurred after
    caused_by UUID[], -- Memories that caused this one
    caused UUID[], -- Memories this one caused
    related_to UUID[], -- Semantically related memories
    
    -- Context at time of memory
    context_snapshot JSONB DEFAULT '{}', -- Active goals, emotional state, etc.
    
    -- Importance and decay
    base_importance DECIMAL(5,4) DEFAULT 0.5, -- Initial importance
    current_importance DECIMAL(5,4) DEFAULT 0.5, -- Decayed importance
    decay_rate DECIMAL(5,4) DEFAULT 0.001, -- Per-hour decay
    reinforcement_count INTEGER DEFAULT 0, -- Times this memory was recalled
    last_reinforced TIMESTAMPTZ,
    
    -- Retrieval tracking
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ,
    avg_retrieval_relevance DECIMAL(5,4),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE episodic_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY episodic_memories_tenant_isolation ON episodic_memories
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_episodic_memories_tenant_user ON episodic_memories(tenant_id, user_id);
CREATE INDEX idx_episodic_memories_session ON episodic_memories(session_id);
CREATE INDEX idx_episodic_memories_time ON episodic_memories(occurred_at DESC);
CREATE INDEX idx_episodic_memories_type ON episodic_memories(memory_type);
CREATE INDEX idx_episodic_memories_importance ON episodic_memories(current_importance DESC);
CREATE INDEX idx_episodic_memories_embedding ON episodic_memories 
    USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- SEMANTIC MEMORY - Facts, concepts, and general knowledge
-- ============================================================================

CREATE TABLE IF NOT EXISTS semantic_memories (
    memory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID, -- NULL = tenant-wide knowledge
    
    -- Knowledge classification
    knowledge_type VARCHAR(50) NOT NULL, -- 'fact', 'concept', 'rule', 'preference', 'skill'
    domain VARCHAR(100),
    category VARCHAR(100),
    
    -- Content
    subject VARCHAR(500) NOT NULL,
    predicate VARCHAR(200),
    object TEXT,
    full_statement TEXT NOT NULL,
    
    -- Embeddings
    subject_embedding vector(1536),
    statement_embedding vector(1536),
    
    -- Confidence and validation
    confidence DECIMAL(5,4) DEFAULT 0.5,
    source_type VARCHAR(50), -- 'explicit', 'inferred', 'learned'
    source_memories UUID[], -- Episodic memories this was derived from
    validation_count INTEGER DEFAULT 0,
    contradiction_count INTEGER DEFAULT 0,
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    usefulness_score DECIMAL(5,4),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE semantic_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY semantic_memories_tenant_isolation ON semantic_memories
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_semantic_memories_tenant ON semantic_memories(tenant_id);
CREATE INDEX idx_semantic_memories_user ON semantic_memories(user_id);
CREATE INDEX idx_semantic_memories_domain ON semantic_memories(domain, category);
CREATE INDEX idx_semantic_memories_subject_embedding ON semantic_memories 
    USING ivfflat (subject_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_semantic_memories_statement_embedding ON semantic_memories 
    USING ivfflat (statement_embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- PROCEDURAL MEMORY - Skills, workflows, and learned procedures
-- ============================================================================

CREATE TABLE IF NOT EXISTS procedural_memories (
    memory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    
    -- Procedure identity
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    
    -- Procedure definition
    trigger_conditions JSONB DEFAULT '[]', -- When to apply this procedure
    steps JSONB NOT NULL, -- [{action, parameters, expected_outcome}]
    preconditions JSONB DEFAULT '[]',
    postconditions JSONB DEFAULT '[]',
    
    -- Embedding for matching
    description_embedding vector(1536),
    
    -- Performance metrics
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    avg_execution_time_ms DECIMAL(10,2),
    last_executed TIMESTAMPTZ,
    
    -- Learning
    learned_from_episodes UUID[], -- Episodic memories this was learned from
    refinement_history JSONB DEFAULT '[]', -- How the procedure evolved
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

ALTER TABLE procedural_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY procedural_memories_tenant_isolation ON procedural_memories
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_procedural_memories_tenant ON procedural_memories(tenant_id);
CREATE INDEX idx_procedural_memories_category ON procedural_memories(category);
CREATE INDEX idx_procedural_memories_embedding ON procedural_memories 
    USING ivfflat (description_embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- WORLD MODEL - Entity-Relation Knowledge Graph
-- ============================================================================

CREATE TABLE IF NOT EXISTS world_model_entities (
    entity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID, -- NULL = shared across users
    
    -- Entity identity
    entity_type VARCHAR(50) NOT NULL, -- 'person', 'organization', 'object', 'concept', 'location', 'event', 'time'
    canonical_name VARCHAR(500) NOT NULL,
    aliases TEXT[] DEFAULT '{}',
    
    -- Attributes
    attributes JSONB DEFAULT '{}',
    
    -- Embeddings
    name_embedding vector(1536),
    description_embedding vector(1536),
    
    -- Confidence and provenance
    confidence DECIMAL(5,4) DEFAULT 0.5,
    source_memories UUID[], -- Where we learned about this entity
    first_mentioned TIMESTAMPTZ,
    last_mentioned TIMESTAMPTZ,
    mention_count INTEGER DEFAULT 1,
    
    -- State tracking (for temporal reasoning)
    current_state JSONB DEFAULT '{}',
    state_history JSONB DEFAULT '[]', -- [{timestamp, state, source}]
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE world_model_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY world_model_entities_tenant_isolation ON world_model_entities
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_world_model_entities_tenant ON world_model_entities(tenant_id);
CREATE INDEX idx_world_model_entities_type ON world_model_entities(entity_type);
CREATE INDEX idx_world_model_entities_name ON world_model_entities(canonical_name);
CREATE INDEX idx_world_model_entities_name_embedding ON world_model_entities 
    USING ivfflat (name_embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- WORLD MODEL RELATIONS - Connections between entities
-- ============================================================================

CREATE TABLE IF NOT EXISTS world_model_relations (
    relation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Relation triple
    subject_id UUID NOT NULL REFERENCES world_model_entities(entity_id) ON DELETE CASCADE,
    predicate VARCHAR(200) NOT NULL, -- e.g., 'works_at', 'is_located_in', 'owns', 'prefers'
    object_id UUID NOT NULL REFERENCES world_model_entities(entity_id) ON DELETE CASCADE,
    
    -- Predicate embedding for semantic matching
    predicate_embedding vector(1536),
    
    -- Temporal validity
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    is_current BOOLEAN DEFAULT true,
    
    -- Confidence and provenance
    confidence DECIMAL(5,4) DEFAULT 0.5,
    source_memories UUID[],
    evidence_count INTEGER DEFAULT 1,
    
    -- Attributes of the relation
    attributes JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE world_model_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY world_model_relations_tenant_isolation ON world_model_relations
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_world_model_relations_subject ON world_model_relations(subject_id);
CREATE INDEX idx_world_model_relations_object ON world_model_relations(object_id);
CREATE INDEX idx_world_model_relations_predicate ON world_model_relations(predicate);
CREATE INDEX idx_world_model_relations_current ON world_model_relations(is_current) WHERE is_current = true;
CREATE INDEX idx_world_model_relations_temporal ON world_model_relations USING gist (tstzrange(valid_from, valid_to));

-- ============================================================================
-- WORLD STATE SNAPSHOTS - Point-in-time captures for simulation
-- ============================================================================

CREATE TABLE IF NOT EXISTS world_state_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    session_id UUID,
    
    -- Snapshot metadata
    snapshot_type VARCHAR(50) NOT NULL, -- 'periodic', 'event_triggered', 'manual', 'simulation'
    description TEXT,
    
    -- State capture
    entities_snapshot JSONB NOT NULL, -- {entity_id: {attributes, state}}
    relations_snapshot JSONB NOT NULL, -- [{subject, predicate, object, confidence}]
    active_goals JSONB DEFAULT '[]',
    context JSONB DEFAULT '{}',
    
    -- For simulation/counterfactual
    is_hypothetical BOOLEAN DEFAULT false,
    derived_from_snapshot UUID REFERENCES world_state_snapshots(snapshot_id),
    simulation_parameters JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE world_state_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY world_state_snapshots_tenant_isolation ON world_state_snapshots
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_world_state_snapshots_tenant ON world_state_snapshots(tenant_id);
CREATE INDEX idx_world_state_snapshots_session ON world_state_snapshots(session_id);
CREATE INDEX idx_world_state_snapshots_time ON world_state_snapshots(created_at DESC);

-- ============================================================================
-- CAUSAL LINKS - For temporal/causal reasoning
-- ============================================================================

CREATE TABLE IF NOT EXISTS causal_links (
    link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Causal relationship
    cause_type VARCHAR(50) NOT NULL, -- 'memory', 'entity_state', 'action', 'external'
    cause_id UUID NOT NULL,
    effect_type VARCHAR(50) NOT NULL,
    effect_id UUID NOT NULL,
    
    -- Causal strength
    causal_strength DECIMAL(5,4) DEFAULT 0.5, -- How strongly cause leads to effect
    temporal_delay_ms INTEGER, -- Typical time between cause and effect
    
    -- Evidence
    observation_count INTEGER DEFAULT 1,
    source_memories UUID[],
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE causal_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY causal_links_tenant_isolation ON causal_links
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_causal_links_cause ON causal_links(cause_type, cause_id);
CREATE INDEX idx_causal_links_effect ON causal_links(effect_type, effect_id);

-- ============================================================================
-- USER MENTAL MODELS - Theory of Mind
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_mental_models (
    model_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL UNIQUE,
    
    -- Current cognitive state (updated in real-time)
    current_goals JSONB DEFAULT '[]', -- [{goal, priority, progress}]
    current_attention JSONB DEFAULT '{}', -- What user is focused on
    current_emotional_state JSONB DEFAULT '{}', -- {valence, arousal, dominant_emotion}
    current_context JSONB DEFAULT '{}',
    
    -- Stable traits (learned over time)
    knowledge_domains JSONB DEFAULT '{}', -- {domain: expertise_level}
    communication_style JSONB DEFAULT '{}', -- {verbosity, formality, preferred_format}
    cognitive_style JSONB DEFAULT '{}', -- {analytical_vs_intuitive, detail_oriented, etc}
    
    -- Preferences
    preferences JSONB DEFAULT '{}',
    frustration_triggers TEXT[] DEFAULT '{}',
    delight_triggers TEXT[] DEFAULT '{}',
    
    -- Behavioral patterns
    typical_session_duration_mins INTEGER,
    peak_activity_hours INTEGER[] DEFAULT '{}',
    common_tasks TEXT[] DEFAULT '{}',
    
    -- Prediction tracking
    predictions_made INTEGER DEFAULT 0,
    predictions_correct INTEGER DEFAULT 0,
    prediction_accuracy DECIMAL(5,4),
    
    -- Learning
    last_model_update TIMESTAMPTZ,
    model_version INTEGER DEFAULT 1,
    training_memories UUID[], -- Memories used to build this model
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_mental_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_mental_models_tenant_isolation ON user_mental_models
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_user_mental_models_tenant_user ON user_mental_models(tenant_id, user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Decay episodic memory importance over time
CREATE OR REPLACE FUNCTION decay_episodic_memories()
RETURNS void AS $$
BEGIN
    UPDATE episodic_memories
    SET current_importance = GREATEST(
        0.01, -- Minimum importance
        current_importance * (1 - decay_rate * EXTRACT(EPOCH FROM (NOW() - COALESCE(last_reinforced, created_at))) / 3600)
    ),
    updated_at = NOW()
    WHERE current_importance > 0.01;
END;
$$ LANGUAGE plpgsql;

-- Reinforce memory on access
CREATE OR REPLACE FUNCTION reinforce_memory(p_memory_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE episodic_memories
    SET 
        access_count = access_count + 1,
        last_accessed = NOW(),
        reinforcement_count = reinforcement_count + 1,
        last_reinforced = NOW(),
        current_importance = LEAST(1.0, current_importance * 1.2), -- 20% boost
        updated_at = NOW()
    WHERE memory_id = p_memory_id;
END;
$$ LANGUAGE plpgsql;

-- Find temporally related memories
CREATE OR REPLACE FUNCTION find_temporal_neighbors(
    p_memory_id UUID,
    p_window_minutes INTEGER DEFAULT 30
)
RETURNS TABLE(memory_id UUID, occurred_at TIMESTAMPTZ, temporal_distance INTERVAL) AS $$
DECLARE
    v_occurred_at TIMESTAMPTZ;
    v_tenant_id UUID;
    v_user_id UUID;
BEGIN
    SELECT em.occurred_at, em.tenant_id, em.user_id 
    INTO v_occurred_at, v_tenant_id, v_user_id
    FROM episodic_memories em WHERE em.memory_id = p_memory_id;
    
    RETURN QUERY
    SELECT 
        em.memory_id,
        em.occurred_at,
        em.occurred_at - v_occurred_at as temporal_distance
    FROM episodic_memories em
    WHERE em.tenant_id = v_tenant_id
      AND em.user_id = v_user_id
      AND em.memory_id != p_memory_id
      AND em.occurred_at BETWEEN (v_occurred_at - (p_window_minutes || ' minutes')::INTERVAL) 
                              AND (v_occurred_at + (p_window_minutes || ' minutes')::INTERVAL)
    ORDER BY ABS(EXTRACT(EPOCH FROM (em.occurred_at - v_occurred_at)));
END;
$$ LANGUAGE plpgsql;

-- Find causal chain from a memory
CREATE OR REPLACE FUNCTION find_causal_chain(
    p_memory_id UUID,
    p_direction VARCHAR DEFAULT 'both', -- 'causes', 'effects', 'both'
    p_max_depth INTEGER DEFAULT 3
)
RETURNS TABLE(
    chain_depth INTEGER,
    memory_id UUID,
    relation_type VARCHAR,
    causal_strength DECIMAL
) AS $$
WITH RECURSIVE causal_chain AS (
    -- Base case
    SELECT 
        0 as depth,
        p_memory_id as memory_id,
        'origin'::VARCHAR as relation_type,
        1.0::DECIMAL as strength
    
    UNION ALL
    
    -- Recursive case
    SELECT 
        cc.depth + 1,
        CASE 
            WHEN p_direction IN ('causes', 'both') AND cl.cause_id = cc.memory_id THEN cl.effect_id
            WHEN p_direction IN ('effects', 'both') AND cl.effect_id = cc.memory_id THEN cl.cause_id
        END,
        CASE 
            WHEN cl.cause_id = cc.memory_id THEN 'caused'
            ELSE 'caused_by'
        END,
        cl.causal_strength
    FROM causal_chain cc
    JOIN causal_links cl ON (
        (p_direction IN ('causes', 'both') AND cl.cause_id = cc.memory_id AND cl.cause_type = 'memory')
        OR 
        (p_direction IN ('effects', 'both') AND cl.effect_id = cc.memory_id AND cl.effect_type = 'memory')
    )
    WHERE cc.depth < p_max_depth
)
SELECT depth, memory_id, relation_type, strength
FROM causal_chain
WHERE memory_id IS NOT NULL
ORDER BY depth, strength DESC;
$$ LANGUAGE sql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_agi_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER episodic_memories_updated
    BEFORE UPDATE ON episodic_memories
    FOR EACH ROW EXECUTE FUNCTION update_agi_timestamp();

CREATE TRIGGER semantic_memories_updated
    BEFORE UPDATE ON semantic_memories
    FOR EACH ROW EXECUTE FUNCTION update_agi_timestamp();

CREATE TRIGGER procedural_memories_updated
    BEFORE UPDATE ON procedural_memories
    FOR EACH ROW EXECUTE FUNCTION update_agi_timestamp();

CREATE TRIGGER world_model_entities_updated
    BEFORE UPDATE ON world_model_entities
    FOR EACH ROW EXECUTE FUNCTION update_agi_timestamp();

CREATE TRIGGER world_model_relations_updated
    BEFORE UPDATE ON world_model_relations
    FOR EACH ROW EXECUTE FUNCTION update_agi_timestamp();

CREATE TRIGGER user_mental_models_updated
    BEFORE UPDATE ON user_mental_models
    FOR EACH ROW EXECUTE FUNCTION update_agi_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE episodic_memories IS 'Events and experiences with temporal context, importance decay, and causal links';
COMMENT ON TABLE semantic_memories IS 'Facts, concepts, and general knowledge derived from experience';
COMMENT ON TABLE procedural_memories IS 'Learned skills, workflows, and procedures';
COMMENT ON TABLE world_model_entities IS 'Entity nodes in the world knowledge graph';
COMMENT ON TABLE world_model_relations IS 'Relationships between entities in the world model';
COMMENT ON TABLE world_state_snapshots IS 'Point-in-time captures of world state for simulation';
COMMENT ON TABLE causal_links IS 'Causal relationships for temporal reasoning';
COMMENT ON TABLE user_mental_models IS 'Theory of Mind - models of user cognitive state and preferences';
