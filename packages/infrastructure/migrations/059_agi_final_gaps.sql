-- Migration: 059_agi_final_gaps.sql
-- RADIANT v4.18.0 - Final AGI Gaps
-- Proactive Assistance, Analogical Reasoning, Confidence Calibration, Knowledge Graph, Contextual Adaptation

-- ============================================================================
-- PROACTIVE ASSISTANCE - Anticipating user needs
-- ============================================================================

-- User behavior patterns for prediction
CREATE TABLE IF NOT EXISTS user_behavior_patterns (
    pattern_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    
    -- Pattern definition
    pattern_type VARCHAR(50) NOT NULL, -- 'temporal', 'sequential', 'contextual', 'preference'
    pattern_name VARCHAR(200),
    
    -- Pattern data
    trigger_conditions JSONB NOT NULL, -- When this pattern activates
    predicted_action TEXT, -- What user likely wants
    confidence DECIMAL(5,4) DEFAULT 0.5,
    
    -- Evidence
    occurrence_count INTEGER DEFAULT 1,
    last_occurrence TIMESTAMPTZ,
    example_instances JSONB DEFAULT '[]',
    
    -- Timing
    typical_time_of_day TIME,
    typical_day_of_week INTEGER, -- 0=Sunday
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_behavior_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_behavior_patterns_tenant_isolation ON user_behavior_patterns
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_user_behavior_patterns_user ON user_behavior_patterns(tenant_id, user_id);
CREATE INDEX idx_user_behavior_patterns_type ON user_behavior_patterns(pattern_type);

-- Proactive triggers (what triggers suggestions)
CREATE TABLE IF NOT EXISTS proactive_triggers (
    trigger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Trigger definition
    name VARCHAR(200) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL, -- 'time_based', 'event_based', 'pattern_based', 'context_based'
    
    -- Conditions
    trigger_conditions JSONB NOT NULL,
    cooldown_minutes INTEGER DEFAULT 60,
    
    -- Action
    suggestion_template JSONB NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',
    
    -- Stats
    times_triggered INTEGER DEFAULT 0,
    times_accepted INTEGER DEFAULT 0,
    acceptance_rate DECIMAL(5,4),
    
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anticipation queue (pending proactive actions)
CREATE TABLE IF NOT EXISTS anticipation_queue (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    
    -- Anticipation
    anticipation_type VARCHAR(50) NOT NULL, -- 'task', 'information', 'reminder', 'suggestion', 'warning'
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Timing
    anticipated_need_time TIMESTAMPTZ,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    
    -- Priority and confidence
    priority INTEGER DEFAULT 5, -- 1-10
    confidence DECIMAL(5,4),
    relevance_score DECIMAL(5,4),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'delivered', 'accepted', 'dismissed', 'expired'
    delivered_at TIMESTAMPTZ,
    user_response VARCHAR(20),
    
    -- Source
    source_pattern_id UUID REFERENCES user_behavior_patterns(pattern_id),
    source_trigger_id UUID REFERENCES proactive_triggers(trigger_id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE anticipation_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY anticipation_queue_tenant_isolation ON anticipation_queue
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_anticipation_queue_pending ON anticipation_queue(tenant_id, user_id, status) 
    WHERE status = 'pending';

-- ============================================================================
-- ANALOGICAL REASONING - Finding analogies between domains
-- ============================================================================

CREATE TABLE IF NOT EXISTS analogical_mappings (
    mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Source domain
    source_domain VARCHAR(200) NOT NULL,
    source_concept TEXT NOT NULL,
    source_structure JSONB NOT NULL, -- Relational structure
    
    -- Target domain
    target_domain VARCHAR(200) NOT NULL,
    target_concept TEXT,
    target_structure JSONB,
    
    -- Mapping
    structural_alignment JSONB DEFAULT '{}', -- {source_element: target_element}
    relational_matches JSONB DEFAULT '[]', -- Matching relations
    
    -- Quality
    mapping_quality DECIMAL(5,4),
    systematicity DECIMAL(5,4), -- Higher-order relation matches
    surface_similarity DECIMAL(5,4), -- Object attribute matches
    
    -- Inference
    candidate_inferences JSONB DEFAULT '[]', -- What we can infer in target
    
    -- Usage
    times_used INTEGER DEFAULT 0,
    usefulness_rating DECIMAL(5,4),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE analogical_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY analogical_mappings_tenant_isolation ON analogical_mappings
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID OR tenant_id IS NULL);

CREATE INDEX idx_analogical_mappings_source ON analogical_mappings(source_domain);
CREATE INDEX idx_analogical_mappings_target ON analogical_mappings(target_domain);

-- Known analogies library
CREATE TABLE IF NOT EXISTS analogy_library (
    analogy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Analogy definition
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Domains
    domain_a VARCHAR(200) NOT NULL,
    domain_b VARCHAR(200) NOT NULL,
    
    -- Core mapping
    core_mapping JSONB NOT NULL, -- The fundamental structural correspondence
    
    -- Common uses
    typical_uses JSONB DEFAULT '[]', -- What this analogy is good for explaining
    
    -- Limitations
    where_breaks_down JSONB DEFAULT '[]', -- Where the analogy fails
    
    -- Quality
    explanatory_power DECIMAL(5,4),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed some common analogies
INSERT INTO analogy_library (name, domain_a, domain_b, core_mapping, typical_uses, explanatory_power) VALUES
('Atom-Solar System', 'atomic structure', 'solar system',
 '{"nucleus": "sun", "electrons": "planets", "orbital": "orbit", "attraction": "gravity"}',
 '["teaching atomic structure", "visualizing electron shells"]', 0.6),
 
('Brain-Computer', 'human brain', 'computer',
 '{"neurons": "transistors", "memory": "RAM/storage", "thinking": "processing", "learning": "programming"}',
 '["explaining cognition", "AI concepts"]', 0.5),

('Electricity-Water', 'electrical circuits', 'plumbing',
 '{"voltage": "pressure", "current": "flow_rate", "resistance": "pipe_narrowing", "wire": "pipe"}',
 '["teaching electronics", "intuitive understanding"]', 0.8),

('Evolution-Algorithm', 'biological evolution', 'genetic algorithms',
 '{"mutation": "random_change", "selection": "fitness_function", "reproduction": "crossover", "population": "solution_set"}',
 '["explaining optimization", "teaching evolution"]', 0.85),

('Company-Organism', 'business organization', 'living organism',
 '{"departments": "organs", "employees": "cells", "CEO": "brain", "money": "blood", "growth": "growth"}',
 '["organizational design", "business strategy"]', 0.6)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CONFIDENCE CALIBRATION - Knowing what you don't know
-- ============================================================================

CREATE TABLE IF NOT EXISTS confidence_assessments (
    assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Context
    request_id UUID,
    task_type VARCHAR(100),
    domain VARCHAR(100),
    
    -- Prediction
    predicted_answer TEXT,
    stated_confidence DECIMAL(5,4), -- What the model said
    
    -- Calibration
    calibrated_confidence DECIMAL(5,4), -- Adjusted confidence
    calibration_adjustment DECIMAL(5,4), -- How much we adjusted
    
    -- Verification (if available)
    was_correct BOOLEAN,
    actual_answer TEXT,
    
    -- Uncertainty sources
    uncertainty_sources JSONB DEFAULT '[]', -- Why uncertain
    knowledge_gaps JSONB DEFAULT '[]', -- What's missing
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE confidence_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY confidence_assessments_tenant_isolation ON confidence_assessments
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_confidence_assessments_domain ON confidence_assessments(domain, task_type);

-- Calibration curves per domain
CREATE TABLE IF NOT EXISTS calibration_curves (
    curve_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Scope
    domain VARCHAR(100) NOT NULL,
    task_type VARCHAR(100),
    model_id VARCHAR(200),
    
    -- Curve data
    buckets JSONB NOT NULL, -- [{confidence_range, accuracy, count}]
    
    -- Metrics
    expected_calibration_error DECIMAL(5,4),
    max_calibration_error DECIMAL(5,4),
    brier_score DECIMAL(5,4),
    
    -- Bias
    overconfidence_rate DECIMAL(5,4), -- How often too confident
    underconfidence_rate DECIMAL(5,4), -- How often too cautious
    
    -- Recommendations
    adjustment_function JSONB, -- How to adjust raw confidence
    
    sample_count INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, domain, task_type, model_id)
);

-- Epistemic state tracking
CREATE TABLE IF NOT EXISTS epistemic_state (
    state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Knowledge boundaries
    known_domains JSONB DEFAULT '[]', -- Domains with good knowledge
    weak_domains JSONB DEFAULT '[]', -- Domains with limited knowledge
    unknown_domains JSONB DEFAULT '[]', -- Explicitly unknown areas
    
    -- Recent performance
    recent_accuracy_by_domain JSONB DEFAULT '{}',
    
    -- Meta-knowledge
    knows_what_it_knows DECIMAL(5,4) DEFAULT 0.5, -- Meta-accuracy
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE epistemic_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY epistemic_state_tenant_isolation ON epistemic_state
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- KNOWLEDGE GRAPH - Explicit relational knowledge
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_nodes (
    node_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Node identity
    name VARCHAR(500) NOT NULL,
    node_type VARCHAR(100) NOT NULL, -- 'entity', 'concept', 'event', 'attribute', 'action'
    
    -- Properties
    properties JSONB DEFAULT '{}',
    
    -- Embedding for similarity
    embedding vector(1536),
    
    -- Provenance
    source VARCHAR(100), -- 'extracted', 'inferred', 'user_provided', 'curated'
    confidence DECIMAL(5,4) DEFAULT 1.0,
    
    -- Usage
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE knowledge_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY knowledge_nodes_tenant_isolation ON knowledge_nodes
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID OR tenant_id IS NULL);

CREATE INDEX idx_knowledge_nodes_type ON knowledge_nodes(node_type);
CREATE INDEX idx_knowledge_nodes_name ON knowledge_nodes(name);
CREATE INDEX idx_knowledge_nodes_embedding ON knowledge_nodes 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Knowledge edges (relations)
CREATE TABLE IF NOT EXISTS knowledge_edges (
    edge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Edge endpoints
    source_node_id UUID NOT NULL REFERENCES knowledge_nodes(node_id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES knowledge_nodes(node_id) ON DELETE CASCADE,
    
    -- Relation
    relation_type VARCHAR(100) NOT NULL, -- 'is_a', 'has_part', 'causes', 'located_in', 'created_by', etc.
    relation_properties JSONB DEFAULT '{}',
    
    -- Strength and confidence
    weight DECIMAL(5,4) DEFAULT 1.0,
    confidence DECIMAL(5,4) DEFAULT 1.0,
    
    -- Temporal
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    
    -- Provenance
    source VARCHAR(100),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE knowledge_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY knowledge_edges_tenant_isolation ON knowledge_edges
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID OR tenant_id IS NULL);

CREATE INDEX idx_knowledge_edges_source ON knowledge_edges(source_node_id);
CREATE INDEX idx_knowledge_edges_target ON knowledge_edges(target_node_id);
CREATE INDEX idx_knowledge_edges_relation ON knowledge_edges(relation_type);

-- Standard relation types
CREATE TABLE IF NOT EXISTS relation_types (
    relation_type VARCHAR(100) PRIMARY KEY,
    description TEXT,
    inverse_relation VARCHAR(100),
    transitivity VARCHAR(20), -- 'none', 'full', 'partial'
    symmetry VARCHAR(20), -- 'none', 'symmetric', 'antisymmetric'
    domain_constraints TEXT[] DEFAULT '{}',
    range_constraints TEXT[] DEFAULT '{}'
);

INSERT INTO relation_types (relation_type, description, inverse_relation, transitivity, symmetry) VALUES
('is_a', 'Type/subclass relationship', 'has_subtype', 'full', 'antisymmetric'),
('has_part', 'Composition relationship', 'part_of', 'partial', 'antisymmetric'),
('causes', 'Causal relationship', 'caused_by', 'partial', 'antisymmetric'),
('related_to', 'General association', 'related_to', 'none', 'symmetric'),
('located_in', 'Spatial containment', 'contains', 'full', 'antisymmetric'),
('created_by', 'Creation/authorship', 'created', 'none', 'antisymmetric'),
('used_for', 'Purpose/function', 'used_by', 'none', 'antisymmetric'),
('similar_to', 'Similarity relation', 'similar_to', 'none', 'symmetric'),
('opposite_of', 'Antonym/contrast', 'opposite_of', 'none', 'symmetric'),
('precedes', 'Temporal ordering', 'follows', 'full', 'antisymmetric'),
('requires', 'Dependency', 'required_by', 'partial', 'antisymmetric'),
('influences', 'Causal influence', 'influenced_by', 'partial', 'antisymmetric')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CONTEXTUAL ADAPTATION - Adapting to different contexts
-- ============================================================================

CREATE TABLE IF NOT EXISTS context_profiles (
    profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Profile definition
    name VARCHAR(200) NOT NULL,
    context_type VARCHAR(50) NOT NULL, -- 'user', 'domain', 'task', 'channel', 'time'
    
    -- Context characteristics
    characteristics JSONB NOT NULL,
    
    -- Adaptation rules
    style_adaptations JSONB DEFAULT '{}', -- How to adapt response style
    content_adaptations JSONB DEFAULT '{}', -- What content to include/exclude
    format_adaptations JSONB DEFAULT '{}', -- How to format responses
    
    -- When to apply
    activation_conditions JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 5,
    
    -- Stats
    times_applied INTEGER DEFAULT 0,
    effectiveness_score DECIMAL(5,4),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE context_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY context_profiles_tenant_isolation ON context_profiles
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Active context (current context state)
CREATE TABLE IF NOT EXISTS active_contexts (
    context_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    session_id UUID,
    user_id UUID,
    
    -- Current context
    context_stack JSONB DEFAULT '[]', -- Stack of active contexts
    
    -- Detected contexts
    user_context JSONB DEFAULT '{}', -- User-specific context
    task_context JSONB DEFAULT '{}', -- Current task context
    domain_context JSONB DEFAULT '{}', -- Domain-specific context
    temporal_context JSONB DEFAULT '{}', -- Time-based context
    emotional_context JSONB DEFAULT '{}', -- Emotional/tone context
    
    -- Adaptation state
    current_adaptations JSONB DEFAULT '{}', -- Active adaptations
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE active_contexts ENABLE ROW LEVEL SECURITY;
CREATE POLICY active_contexts_tenant_isolation ON active_contexts
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_active_contexts_session ON active_contexts(session_id);

-- Context transitions
CREATE TABLE IF NOT EXISTS context_transitions (
    transition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Transition
    from_context JSONB NOT NULL,
    to_context JSONB NOT NULL,
    trigger TEXT,
    
    -- Timing
    transition_time TIMESTAMPTZ DEFAULT NOW(),
    
    -- Quality
    smoothness DECIMAL(3,2), -- How smooth was the transition
    user_noticed BOOLEAN DEFAULT false
);

-- ============================================================================
-- TEMPORAL REASONING - Time-based reasoning
-- ============================================================================

CREATE TABLE IF NOT EXISTS temporal_facts (
    fact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Fact
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object TEXT NOT NULL,
    
    -- Temporal scope
    valid_time_start TIMESTAMPTZ,
    valid_time_end TIMESTAMPTZ,
    temporal_type VARCHAR(50), -- 'point', 'interval', 'recurring', 'eternal'
    
    -- For recurring
    recurrence_pattern JSONB, -- Cron-like pattern
    
    -- Confidence
    confidence DECIMAL(5,4) DEFAULT 1.0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE temporal_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY temporal_facts_tenant_isolation ON temporal_facts
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID OR tenant_id IS NULL);

CREATE INDEX idx_temporal_facts_time ON temporal_facts(valid_time_start, valid_time_end);

-- Temporal relations
CREATE TABLE IF NOT EXISTS temporal_relations (
    relation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Events/intervals
    event_a_id UUID,
    event_b_id UUID,
    
    -- Allen's interval algebra relations
    relation VARCHAR(50) NOT NULL, -- 'before', 'after', 'meets', 'overlaps', 'during', 'starts', 'finishes', 'equals'
    
    confidence DECIMAL(5,4) DEFAULT 1.0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Detect patterns in user behavior
CREATE OR REPLACE FUNCTION detect_user_pattern(
    p_tenant_id UUID,
    p_user_id UUID,
    p_action TEXT,
    p_context JSONB
)
RETURNS void AS $$
DECLARE
    v_existing RECORD;
BEGIN
    -- Check for existing pattern
    SELECT * INTO v_existing
    FROM user_behavior_patterns
    WHERE tenant_id = p_tenant_id
      AND (user_id = p_user_id OR user_id IS NULL)
      AND predicted_action = p_action
    LIMIT 1;
    
    IF v_existing IS NOT NULL THEN
        -- Update existing pattern
        UPDATE user_behavior_patterns SET
            occurrence_count = occurrence_count + 1,
            last_occurrence = NOW(),
            confidence = LEAST(1.0, confidence + 0.05),
            example_instances = (
                SELECT jsonb_agg(inst) FROM (
                    SELECT inst FROM jsonb_array_elements(example_instances) inst
                    ORDER BY inst->>'timestamp' DESC
                    LIMIT 9
                ) sub
            ) || jsonb_build_object('context', p_context, 'timestamp', NOW()),
            updated_at = NOW()
        WHERE pattern_id = v_existing.pattern_id;
    ELSE
        -- Create new pattern
        INSERT INTO user_behavior_patterns (
            tenant_id, user_id, pattern_type, predicted_action, trigger_conditions, example_instances
        ) VALUES (
            p_tenant_id, p_user_id, 'contextual', p_action, p_context,
            jsonb_build_array(jsonb_build_object('context', p_context, 'timestamp', NOW()))
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Find analogies for a concept
CREATE OR REPLACE FUNCTION find_analogies(
    p_source_domain VARCHAR,
    p_source_concept TEXT,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE(
    analogy_id UUID,
    target_domain VARCHAR,
    mapping JSONB,
    quality DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        am.mapping_id,
        am.target_domain::VARCHAR,
        am.structural_alignment,
        am.mapping_quality
    FROM analogical_mappings am
    WHERE am.source_domain = p_source_domain
      AND am.source_concept ILIKE '%' || p_source_concept || '%'
    ORDER BY am.mapping_quality DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Calibrate confidence
CREATE OR REPLACE FUNCTION calibrate_confidence(
    p_tenant_id UUID,
    p_domain VARCHAR,
    p_raw_confidence DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    v_curve RECORD;
    v_adjustment DECIMAL;
BEGIN
    -- Get calibration curve for domain
    SELECT * INTO v_curve
    FROM calibration_curves
    WHERE (tenant_id = p_tenant_id OR tenant_id IS NULL)
      AND domain = p_domain
    ORDER BY sample_count DESC
    LIMIT 1;
    
    IF v_curve IS NULL THEN
        -- No calibration data, return raw confidence
        RETURN p_raw_confidence;
    END IF;
    
    -- Apply adjustment based on overconfidence rate
    IF v_curve.overconfidence_rate > 0.3 THEN
        v_adjustment := -0.1 * v_curve.overconfidence_rate;
    ELSIF v_curve.underconfidence_rate > 0.3 THEN
        v_adjustment := 0.1 * v_curve.underconfidence_rate;
    ELSE
        v_adjustment := 0;
    END IF;
    
    RETURN GREATEST(0, LEAST(1, p_raw_confidence + v_adjustment));
END;
$$ LANGUAGE plpgsql;

-- Find related nodes in knowledge graph
CREATE OR REPLACE FUNCTION find_related_knowledge(
    p_node_id UUID,
    p_max_depth INTEGER DEFAULT 2,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
    node_id UUID,
    name VARCHAR,
    node_type VARCHAR,
    relation_path TEXT[],
    depth INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE related AS (
        -- Start node
        SELECT 
            kn.node_id,
            kn.name,
            kn.node_type,
            ARRAY[]::TEXT[] as relation_path,
            0 as depth
        FROM knowledge_nodes kn
        WHERE kn.node_id = p_node_id
        
        UNION ALL
        
        -- Traverse edges
        SELECT 
            kn2.node_id,
            kn2.name,
            kn2.node_type,
            r.relation_path || ke.relation_type,
            r.depth + 1
        FROM related r
        JOIN knowledge_edges ke ON (ke.source_node_id = r.node_id OR ke.target_node_id = r.node_id)
        JOIN knowledge_nodes kn2 ON (
            (ke.target_node_id = kn2.node_id AND ke.source_node_id = r.node_id) OR
            (ke.source_node_id = kn2.node_id AND ke.target_node_id = r.node_id)
        )
        WHERE r.depth < p_max_depth
          AND kn2.node_id != p_node_id
    )
    SELECT DISTINCT ON (related.node_id)
        related.node_id,
        related.name::VARCHAR,
        related.node_type::VARCHAR,
        related.relation_path,
        related.depth
    FROM related
    WHERE related.depth > 0
    ORDER BY related.node_id, related.depth
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Detect context changes
CREATE OR REPLACE FUNCTION detect_context_change(
    p_tenant_id UUID,
    p_session_id UUID,
    p_new_content TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_current RECORD;
    v_changes JSONB := '{}';
BEGIN
    -- Get current context
    SELECT * INTO v_current
    FROM active_contexts
    WHERE tenant_id = p_tenant_id AND session_id = p_session_id;
    
    -- Detect changes (simplified - would use ML in production)
    IF p_new_content ILIKE '%technical%' OR p_new_content ILIKE '%code%' THEN
        v_changes := v_changes || '{"domain": "technical"}'::jsonb;
    ELSIF p_new_content ILIKE '%creative%' OR p_new_content ILIKE '%story%' THEN
        v_changes := v_changes || '{"domain": "creative"}'::jsonb;
    END IF;
    
    IF p_new_content ILIKE '%urgent%' OR p_new_content ILIKE '%asap%' THEN
        v_changes := v_changes || '{"urgency": "high"}'::jsonb;
    END IF;
    
    RETURN v_changes;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INITIALIZE DATA
-- ============================================================================

-- Initialize epistemic state for existing tenants
INSERT INTO epistemic_state (tenant_id, known_domains, weak_domains)
SELECT tenant_id, 
       '["general", "coding", "analysis"]'::jsonb,
       '["specialized_medical", "legal_advice"]'::jsonb
FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Default proactive triggers
INSERT INTO proactive_triggers (tenant_id, name, trigger_type, trigger_conditions, suggestion_template, priority) VALUES
(NULL, 'Daily Summary', 'time_based',
 '{"time": "09:00", "days": [1,2,3,4,5]}',
 '{"type": "summary", "title": "Your daily briefing", "template": "Here is what happened since yesterday..."}',
 'low'),
 
(NULL, 'Idle Reminder', 'event_based',
 '{"event": "idle_detected", "idle_minutes": 30, "has_pending_tasks": true}',
 '{"type": "reminder", "title": "Pending tasks", "template": "You have {{count}} pending tasks..."}',
 'normal'),

(NULL, 'Error Pattern', 'pattern_based',
 '{"pattern": "repeated_errors", "threshold": 3}',
 '{"type": "help", "title": "Need help?", "template": "I noticed you might be having trouble with..."}',
 'high')
ON CONFLICT DO NOTHING;

-- Default context profiles
INSERT INTO context_profiles (tenant_id, name, context_type, characteristics, style_adaptations) VALUES
(NULL, 'Technical Expert', 'user',
 '{"expertise_level": "expert", "prefers_detail": true}',
 '{"verbosity": "detailed", "jargon": "allowed", "examples": "code"}'),
 
(NULL, 'Casual User', 'user',
 '{"expertise_level": "beginner", "prefers_simplicity": true}',
 '{"verbosity": "concise", "jargon": "avoided", "examples": "analogies"}'),

(NULL, 'Urgent Context', 'task',
 '{"urgency": "high", "time_sensitive": true}',
 '{"verbosity": "minimal", "format": "bullet_points", "skip_explanations": true}')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_behavior_patterns IS 'Proactive: Detected patterns in user behavior';
COMMENT ON TABLE proactive_triggers IS 'Proactive: Triggers for suggestions';
COMMENT ON TABLE anticipation_queue IS 'Proactive: Pending proactive suggestions';
COMMENT ON TABLE analogical_mappings IS 'Analogical: Mappings between domains';
COMMENT ON TABLE analogy_library IS 'Analogical: Library of known analogies';
COMMENT ON TABLE confidence_assessments IS 'Calibration: Individual confidence assessments';
COMMENT ON TABLE calibration_curves IS 'Calibration: Domain-specific calibration data';
COMMENT ON TABLE epistemic_state IS 'Calibration: Overall knowledge state';
COMMENT ON TABLE knowledge_nodes IS 'KG: Entities and concepts';
COMMENT ON TABLE knowledge_edges IS 'KG: Relations between nodes';
COMMENT ON TABLE context_profiles IS 'Contextual: Adaptation profiles';
COMMENT ON TABLE active_contexts IS 'Contextual: Current context state';
COMMENT ON TABLE temporal_facts IS 'Temporal: Time-scoped facts';
