-- Migration: 051_advanced_cognition.sql
-- RADIANT v4.18.0 - Advanced Cognition: Causal Reasoning, Memory Consolidation, Multimodal Binding, Skill Execution, Bounded Autonomy

-- ============================================================================
-- CAUSAL KNOWLEDGE GRAPH - Typed causal relationships with interventions
-- ============================================================================

CREATE TABLE IF NOT EXISTS causal_nodes (
    node_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Node identity
    name VARCHAR(500) NOT NULL,
    node_type VARCHAR(50) NOT NULL, -- 'variable', 'event', 'state', 'action', 'outcome'
    description TEXT,
    node_embedding vector(1536),
    
    -- Variable properties (for causal inference)
    is_observable BOOLEAN DEFAULT true,
    is_manipulable BOOLEAN DEFAULT true, -- Can be intervened on
    domain_type VARCHAR(50), -- 'continuous', 'discrete', 'binary', 'categorical'
    possible_values JSONB DEFAULT '[]',
    
    -- Current state
    current_value JSONB,
    value_confidence DECIMAL(5,4),
    last_observed TIMESTAMPTZ,
    
    -- Statistics
    observation_count INTEGER DEFAULT 0,
    intervention_count INTEGER DEFAULT 0,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE causal_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY causal_nodes_tenant_isolation ON causal_nodes
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_causal_nodes_tenant ON causal_nodes(tenant_id);
CREATE INDEX idx_causal_nodes_type ON causal_nodes(node_type);
CREATE INDEX idx_causal_nodes_embedding ON causal_nodes 
    USING ivfflat (node_embedding vector_cosine_ops) WITH (lists = 100);

-- Causal edges with typed relationships
CREATE TABLE IF NOT EXISTS causal_edges (
    edge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Edge endpoints
    cause_node_id UUID NOT NULL REFERENCES causal_nodes(node_id) ON DELETE CASCADE,
    effect_node_id UUID NOT NULL REFERENCES causal_nodes(node_id) ON DELETE CASCADE,
    
    -- Causal properties
    causal_type VARCHAR(50) NOT NULL, -- 'direct', 'indirect', 'confounded', 'mediated', 'moderated'
    mechanism TEXT, -- Description of how cause produces effect
    
    -- Strength and confidence
    causal_strength DECIMAL(5,4), -- -1 to 1 (negative = inhibitory)
    confidence DECIMAL(5,4) DEFAULT 0.5,
    
    -- Temporal properties
    time_lag_mins INTEGER, -- Expected delay between cause and effect
    is_instantaneous BOOLEAN DEFAULT false,
    
    -- Conditional relationships
    conditions JSONB DEFAULT '[]', -- [{variable, operator, value}] for when this edge is active
    moderators JSONB DEFAULT '[]', -- Variables that affect edge strength
    
    -- Evidence
    evidence_type VARCHAR(50), -- 'observed', 'experimental', 'inferred', 'theoretical'
    evidence_count INTEGER DEFAULT 0,
    supporting_observations UUID[] DEFAULT '{}',
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT no_self_loops CHECK (cause_node_id != effect_node_id)
);

ALTER TABLE causal_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY causal_edges_tenant_isolation ON causal_edges
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_causal_edges_tenant ON causal_edges(tenant_id);
CREATE INDEX idx_causal_edges_cause ON causal_edges(cause_node_id);
CREATE INDEX idx_causal_edges_effect ON causal_edges(effect_node_id);

-- Causal interventions (do-calculus operations)
CREATE TABLE IF NOT EXISTS causal_interventions (
    intervention_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    session_id UUID,
    
    -- Intervention specification
    intervention_type VARCHAR(50) NOT NULL, -- 'do', 'observe', 'counterfactual'
    target_node_id UUID NOT NULL REFERENCES causal_nodes(node_id),
    intervention_value JSONB NOT NULL,
    
    -- Context
    context_snapshot JSONB DEFAULT '{}', -- State of other variables
    query_node_ids UUID[] DEFAULT '{}', -- Nodes we're querying about
    
    -- Results
    predicted_effects JSONB DEFAULT '{}', -- {node_id: {value, confidence}}
    actual_effects JSONB DEFAULT '{}', -- Observed outcomes
    prediction_error DECIMAL(5,4),
    
    -- Counterfactual specific
    counterfactual_premise TEXT, -- "What if X had been Y instead?"
    counterfactual_conclusion TEXT,
    
    -- Metadata
    reasoning_trace JSONB DEFAULT '[]', -- Steps of causal inference
    
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ
);

ALTER TABLE causal_interventions ENABLE ROW LEVEL SECURITY;
CREATE POLICY causal_interventions_tenant_isolation ON causal_interventions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_causal_interventions_tenant ON causal_interventions(tenant_id);
CREATE INDEX idx_causal_interventions_target ON causal_interventions(target_node_id);
CREATE INDEX idx_causal_interventions_type ON causal_interventions(intervention_type);

-- ============================================================================
-- MEMORY CONSOLIDATION - Compression, decay, and conflict resolution
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_consolidation_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Job specification
    job_type VARCHAR(50) NOT NULL, -- 'compress', 'decay', 'conflict_resolve', 'transfer', 'prune'
    target_memory_type VARCHAR(50), -- 'episodic', 'semantic', 'procedural', 'all'
    
    -- Scope
    time_range_start TIMESTAMPTZ,
    time_range_end TIMESTAMPTZ,
    memory_ids UUID[] DEFAULT '{}', -- Specific memories to process
    
    -- Configuration
    compression_ratio DECIMAL(3,2), -- Target compression (0.5 = 50% reduction)
    importance_threshold DECIMAL(3,2), -- Below this importance, memories are pruned
    conflict_resolution_strategy VARCHAR(50), -- 'newer_wins', 'higher_confidence', 'merge', 'flag_for_review'
    
    -- Results
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    memories_processed INTEGER DEFAULT 0,
    memories_compressed INTEGER DEFAULT 0,
    memories_pruned INTEGER DEFAULT 0,
    conflicts_found INTEGER DEFAULT 0,
    conflicts_resolved INTEGER DEFAULT 0,
    
    -- Outputs
    consolidated_memories UUID[] DEFAULT '{}', -- New consolidated memories created
    pruned_memories UUID[] DEFAULT '{}', -- Memories that were removed
    
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE memory_consolidation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY memory_consolidation_jobs_tenant_isolation ON memory_consolidation_jobs
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_memory_consolidation_jobs_tenant ON memory_consolidation_jobs(tenant_id);
CREATE INDEX idx_memory_consolidation_jobs_status ON memory_consolidation_jobs(status);

-- Memory conflicts detected during consolidation
CREATE TABLE IF NOT EXISTS memory_conflicts (
    conflict_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Conflicting memories
    memory_a_id UUID NOT NULL,
    memory_a_type VARCHAR(50) NOT NULL,
    memory_a_content TEXT NOT NULL,
    memory_a_confidence DECIMAL(5,4),
    
    memory_b_id UUID NOT NULL,
    memory_b_type VARCHAR(50) NOT NULL,
    memory_b_content TEXT NOT NULL,
    memory_b_confidence DECIMAL(5,4),
    
    -- Conflict details
    conflict_type VARCHAR(50) NOT NULL, -- 'contradiction', 'inconsistency', 'redundancy', 'temporal_conflict'
    conflict_description TEXT NOT NULL,
    severity VARCHAR(20), -- 'critical', 'major', 'minor'
    
    -- Resolution
    resolution_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'auto_resolved', 'manual_resolved', 'flagged'
    resolution_strategy VARCHAR(50),
    resolution_result JSONB,
    resolved_by VARCHAR(50), -- 'system', 'user', agent_id
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE memory_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY memory_conflicts_tenant_isolation ON memory_conflicts
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_memory_conflicts_tenant ON memory_conflicts(tenant_id);
CREATE INDEX idx_memory_conflicts_status ON memory_conflicts(resolution_status);

-- ============================================================================
-- MULTIMODAL BINDING - Shared embedding space across modalities
-- ============================================================================

CREATE TABLE IF NOT EXISTS multimodal_representations (
    representation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    
    -- Source modality
    source_modality VARCHAR(50) NOT NULL, -- 'text', 'image', 'audio', 'code', 'structured_data'
    source_content_hash VARCHAR(64) NOT NULL, -- SHA256 of original content
    source_metadata JSONB DEFAULT '{}',
    
    -- Unified embedding (lingua franca)
    unified_embedding vector(1536) NOT NULL,
    embedding_model VARCHAR(100) NOT NULL,
    embedding_version INTEGER DEFAULT 1,
    
    -- Modality-specific embeddings
    text_embedding vector(1536),
    visual_embedding vector(512), -- CLIP visual
    audio_embedding vector(512),
    code_embedding vector(768),
    
    -- Grounding links
    linked_entities UUID[] DEFAULT '{}', -- world_model_entities
    linked_memories UUID[] DEFAULT '{}', -- episodic_memories
    linked_concepts UUID[] DEFAULT '{}', -- semantic_memories
    
    -- Cross-modal associations
    associated_representations UUID[] DEFAULT '{}',
    association_strengths JSONB DEFAULT '{}', -- {rep_id: strength}
    
    -- Quality metrics
    embedding_quality DECIMAL(5,4),
    grounding_confidence DECIMAL(5,4),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE multimodal_representations ENABLE ROW LEVEL SECURITY;
CREATE POLICY multimodal_representations_tenant_isolation ON multimodal_representations
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_multimodal_representations_tenant ON multimodal_representations(tenant_id);
CREATE INDEX idx_multimodal_representations_modality ON multimodal_representations(source_modality);
CREATE INDEX idx_multimodal_representations_unified ON multimodal_representations 
    USING ivfflat (unified_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_multimodal_representations_hash ON multimodal_representations(source_content_hash);

-- Cross-modal retrieval queries
CREATE TABLE IF NOT EXISTS crossmodal_queries (
    query_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    
    -- Query specification
    query_modality VARCHAR(50) NOT NULL, -- Input modality
    query_content TEXT NOT NULL,
    query_embedding vector(1536),
    
    target_modalities TEXT[] NOT NULL, -- Which modalities to search
    
    -- Results
    results JSONB DEFAULT '[]', -- [{representation_id, modality, similarity, content_preview}]
    result_count INTEGER DEFAULT 0,
    
    -- Performance
    latency_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crossmodal_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY crossmodal_queries_tenant_isolation ON crossmodal_queries
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- SKILL EXECUTION - Procedural memory replay and skill learning
-- ============================================================================

CREATE TABLE IF NOT EXISTS executable_skills (
    skill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Skill identity
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    skill_embedding vector(1536),
    
    -- Skill definition
    skill_type VARCHAR(50) NOT NULL, -- 'procedure', 'workflow', 'pattern', 'heuristic'
    trigger_conditions JSONB DEFAULT '[]', -- When to suggest/apply this skill
    
    -- Execution specification
    steps JSONB NOT NULL, -- [{action, params, expected_outcome, fallback}]
    required_inputs JSONB DEFAULT '[]', -- [{name, type, description}]
    expected_outputs JSONB DEFAULT '[]',
    
    -- Parameterization
    parameters JSONB DEFAULT '[]', -- Configurable parameters
    default_params JSONB DEFAULT '{}',
    
    -- Dependencies
    required_skills UUID[] DEFAULT '{}', -- Skills needed as prerequisites
    required_capabilities TEXT[] DEFAULT '{}', -- System capabilities needed
    
    -- Learning source
    learned_from VARCHAR(50), -- 'demonstration', 'instruction', 'exploration', 'template'
    source_memories UUID[] DEFAULT '{}', -- Procedural memories this was derived from
    
    -- Performance tracking
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    avg_execution_time_ms DECIMAL(10,2),
    avg_quality_score DECIMAL(5,4),
    
    -- Versioning
    version INTEGER DEFAULT 1,
    previous_version_id UUID REFERENCES executable_skills(skill_id),
    
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

ALTER TABLE executable_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY executable_skills_tenant_isolation ON executable_skills
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_executable_skills_tenant ON executable_skills(tenant_id);
CREATE INDEX idx_executable_skills_type ON executable_skills(skill_type);
CREATE INDEX idx_executable_skills_embedding ON executable_skills 
    USING ivfflat (skill_embedding vector_cosine_ops) WITH (lists = 100);

-- Skill executions
CREATE TABLE IF NOT EXISTS skill_executions (
    execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES executable_skills(skill_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID,
    session_id UUID,
    
    -- Execution context
    trigger_type VARCHAR(50), -- 'user_request', 'auto_suggested', 'scheduled', 'chained'
    input_params JSONB DEFAULT '{}',
    context JSONB DEFAULT '{}',
    
    -- Execution tracking
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    current_step INTEGER DEFAULT 0,
    step_results JSONB DEFAULT '[]', -- Results from each step
    
    -- Output
    output JSONB,
    output_quality DECIMAL(5,4),
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Errors
    error_step INTEGER,
    error_message TEXT,
    recovery_attempted BOOLEAN DEFAULT false,
    
    -- Learning feedback
    user_rating INTEGER, -- 1-5
    user_feedback TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE skill_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY skill_executions_tenant_isolation ON skill_executions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_skill_executions_skill ON skill_executions(skill_id);
CREATE INDEX idx_skill_executions_tenant ON skill_executions(tenant_id);
CREATE INDEX idx_skill_executions_status ON skill_executions(status);

-- ============================================================================
-- AUTONOMOUS AGENT - Bounded proactive behavior
-- ============================================================================

CREATE TABLE IF NOT EXISTS autonomous_tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Task identity
    task_type VARCHAR(50) NOT NULL, -- 'suggestion', 'background_learning', 'maintenance', 'exploration', 'monitoring'
    name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Trigger
    trigger_type VARCHAR(50) NOT NULL, -- 'scheduled', 'event', 'threshold', 'pattern'
    trigger_config JSONB DEFAULT '{}', -- {schedule: "0 * * * *"} or {event: "...", threshold: 0.8}
    
    -- Scope and bounds
    target_users UUID[] DEFAULT '{}', -- Empty = all users
    resource_budget JSONB DEFAULT '{}', -- {max_tokens: 10000, max_api_calls: 50, max_duration_ms: 60000}
    
    -- Action specification
    action_type VARCHAR(50) NOT NULL, -- 'generate_suggestions', 'consolidate_memory', 'update_model', 'analyze_patterns'
    action_config JSONB DEFAULT '{}',
    
    -- Safety constraints
    requires_approval BOOLEAN DEFAULT true,
    max_impact_level VARCHAR(20) DEFAULT 'low', -- 'none', 'low', 'medium', 'high'
    allowed_actions TEXT[] DEFAULT '{}', -- Whitelist of permitted actions
    forbidden_actions TEXT[] DEFAULT '{}', -- Blacklist
    
    -- Schedule
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    run_count INTEGER DEFAULT 0,
    
    -- Status
    is_enabled BOOLEAN DEFAULT true,
    is_paused BOOLEAN DEFAULT false,
    pause_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE autonomous_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY autonomous_tasks_tenant_isolation ON autonomous_tasks
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_autonomous_tasks_tenant ON autonomous_tasks(tenant_id);
CREATE INDEX idx_autonomous_tasks_type ON autonomous_tasks(task_type);
CREATE INDEX idx_autonomous_tasks_next_run ON autonomous_tasks(next_run_at) WHERE is_enabled = true AND is_paused = false;

-- Autonomous task executions
CREATE TABLE IF NOT EXISTS autonomous_executions (
    execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES autonomous_tasks(task_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Execution
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'awaiting_approval', 'approved', 'rejected', 'completed', 'failed'
    
    -- Proposed actions (for approval workflow)
    proposed_actions JSONB DEFAULT '[]', -- [{action, target, params, impact_assessment}]
    approval_required BOOLEAN DEFAULT true,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Results
    actions_taken JSONB DEFAULT '[]',
    outcomes JSONB DEFAULT '{}',
    
    -- Resource usage
    tokens_used INTEGER DEFAULT 0,
    api_calls_made INTEGER DEFAULT 0,
    duration_ms INTEGER,
    
    -- Timing
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Errors
    error_message TEXT
);

ALTER TABLE autonomous_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY autonomous_executions_tenant_isolation ON autonomous_executions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_autonomous_executions_task ON autonomous_executions(task_id);
CREATE INDEX idx_autonomous_executions_tenant ON autonomous_executions(tenant_id);
CREATE INDEX idx_autonomous_executions_status ON autonomous_executions(status);
CREATE INDEX idx_autonomous_executions_pending ON autonomous_executions(status) WHERE status = 'awaiting_approval';

-- ============================================================================
-- ADVANCED COGNITION SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS advanced_cognition_settings (
    setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Causal Reasoning
    causal_reasoning_enabled BOOLEAN DEFAULT true,
    causal_confidence_threshold DECIMAL(3,2) DEFAULT 0.6,
    max_causal_chain_depth INTEGER DEFAULT 5,
    counterfactual_enabled BOOLEAN DEFAULT true,
    
    -- Memory Consolidation
    consolidation_enabled BOOLEAN DEFAULT true,
    consolidation_schedule VARCHAR(50) DEFAULT 'daily', -- 'hourly', 'daily', 'weekly', 'manual'
    consolidation_time VARCHAR(10) DEFAULT '03:00', -- UTC time for scheduled consolidation
    default_compression_ratio DECIMAL(3,2) DEFAULT 0.7,
    importance_decay_rate DECIMAL(5,4) DEFAULT 0.05, -- Per day
    auto_prune_threshold DECIMAL(3,2) DEFAULT 0.1, -- Prune below this importance
    conflict_auto_resolve BOOLEAN DEFAULT true,
    
    -- Multimodal Binding
    multimodal_binding_enabled BOOLEAN DEFAULT true,
    auto_embed_uploads BOOLEAN DEFAULT true,
    cross_modal_search_enabled BOOLEAN DEFAULT true,
    binding_quality_threshold DECIMAL(3,2) DEFAULT 0.7,
    
    -- Skill Execution
    skill_execution_enabled BOOLEAN DEFAULT true,
    auto_skill_suggestion BOOLEAN DEFAULT true,
    skill_learning_enabled BOOLEAN DEFAULT true,
    max_skill_chain_depth INTEGER DEFAULT 3,
    
    -- Autonomous Agent
    autonomous_enabled BOOLEAN DEFAULT false, -- Off by default for safety
    autonomous_approval_required BOOLEAN DEFAULT true,
    max_autonomous_actions_per_day INTEGER DEFAULT 10,
    autonomous_resource_budget JSONB DEFAULT '{"max_tokens_per_day": 100000, "max_api_calls_per_day": 500}',
    allowed_autonomous_tasks TEXT[] DEFAULT ARRAY['suggestion', 'maintenance'],
    
    -- Global safety bounds
    max_tokens_per_operation INTEGER DEFAULT 50000,
    max_api_calls_per_operation INTEGER DEFAULT 100,
    operation_timeout_ms INTEGER DEFAULT 300000,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE advanced_cognition_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY advanced_cognition_settings_tenant_isolation ON advanced_cognition_settings
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Find causal path between two nodes
CREATE OR REPLACE FUNCTION find_causal_path(
    p_tenant_id UUID,
    p_source_node_id UUID,
    p_target_node_id UUID,
    p_max_depth INTEGER DEFAULT 5
)
RETURNS TABLE(path UUID[], total_strength DECIMAL, edge_count INTEGER) AS $$
WITH RECURSIVE causal_paths AS (
    -- Base case: direct edges from source
    SELECT 
        ARRAY[p_source_node_id, effect_node_id] as path,
        causal_strength as total_strength,
        1 as depth
    FROM causal_edges
    WHERE tenant_id = p_tenant_id
      AND cause_node_id = p_source_node_id
      AND is_active = true
    
    UNION ALL
    
    -- Recursive case: extend paths
    SELECT
        cp.path || ce.effect_node_id,
        cp.total_strength * ce.causal_strength,
        cp.depth + 1
    FROM causal_paths cp
    JOIN causal_edges ce ON ce.cause_node_id = cp.path[array_length(cp.path, 1)]
    WHERE ce.tenant_id = p_tenant_id
      AND ce.is_active = true
      AND NOT ce.effect_node_id = ANY(cp.path) -- Avoid cycles
      AND cp.depth < p_max_depth
)
SELECT path, total_strength, array_length(path, 1) - 1 as edge_count
FROM causal_paths
WHERE path[array_length(path, 1)] = p_target_node_id
ORDER BY total_strength DESC;
$$ LANGUAGE SQL;

-- Get memories due for consolidation
CREATE OR REPLACE FUNCTION get_memories_for_consolidation(
    p_tenant_id UUID,
    p_importance_threshold DECIMAL DEFAULT 0.3
)
RETURNS TABLE(memory_id UUID, memory_type VARCHAR, importance DECIMAL, last_accessed TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        em.memory_id,
        'episodic'::VARCHAR as memory_type,
        em.current_importance as importance,
        em.last_accessed_at as last_accessed
    FROM episodic_memories em
    WHERE em.tenant_id = p_tenant_id
      AND em.current_importance < p_importance_threshold
      AND em.last_accessed_at < NOW() - INTERVAL '7 days'
    ORDER BY em.current_importance ASC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- Find matching skills for a query
CREATE OR REPLACE FUNCTION find_matching_skills(
    p_tenant_id UUID,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE(skill_id UUID, name VARCHAR, similarity DECIMAL, success_rate DECIMAL) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        es.skill_id,
        es.name,
        (1 - (es.skill_embedding <=> p_query_embedding))::DECIMAL as similarity,
        (es.success_count::DECIMAL / NULLIF(es.execution_count, 0))::DECIMAL as success_rate
    FROM executable_skills es
    WHERE es.tenant_id = p_tenant_id
      AND es.is_active = true
    ORDER BY es.skill_embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_advanced_cognition_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER causal_nodes_updated BEFORE UPDATE ON causal_nodes
    FOR EACH ROW EXECUTE FUNCTION update_advanced_cognition_timestamp();

CREATE TRIGGER causal_edges_updated BEFORE UPDATE ON causal_edges
    FOR EACH ROW EXECUTE FUNCTION update_advanced_cognition_timestamp();

CREATE TRIGGER executable_skills_updated BEFORE UPDATE ON executable_skills
    FOR EACH ROW EXECUTE FUNCTION update_advanced_cognition_timestamp();

CREATE TRIGGER autonomous_tasks_updated BEFORE UPDATE ON autonomous_tasks
    FOR EACH ROW EXECUTE FUNCTION update_advanced_cognition_timestamp();

CREATE TRIGGER advanced_cognition_settings_updated BEFORE UPDATE ON advanced_cognition_settings
    FOR EACH ROW EXECUTE FUNCTION update_advanced_cognition_timestamp();

-- ============================================================================
-- DEFAULT SETTINGS AND DATA
-- ============================================================================

INSERT INTO advanced_cognition_settings (tenant_id)
SELECT tenant_id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Default autonomous tasks
INSERT INTO autonomous_tasks (tenant_id, task_type, name, description, trigger_type, trigger_config, action_type, action_config, requires_approval, is_enabled)
SELECT 
    t.tenant_id,
    task.task_type,
    task.name,
    task.description,
    task.trigger_type,
    task.trigger_config::JSONB,
    task.action_type,
    task.action_config::JSONB,
    task.requires_approval,
    false -- Disabled by default
FROM tenants t
CROSS JOIN (VALUES
    ('maintenance', 'Daily Memory Consolidation', 'Compress and organize episodic memories', 'scheduled', '{"schedule": "0 3 * * *"}', 'consolidate_memory', '{"target": "episodic", "compress": true}', false),
    ('suggestion', 'Proactive User Suggestions', 'Generate helpful suggestions based on user patterns', 'threshold', '{"pattern_confidence": 0.8}', 'generate_suggestions', '{"max_suggestions": 3}', true),
    ('monitoring', 'Knowledge Graph Update', 'Update causal knowledge graph from recent interactions', 'scheduled', '{"schedule": "0 */6 * * *"}', 'update_model', '{"target": "causal_graph"}', false),
    ('background_learning', 'Skill Learning', 'Learn new skills from successful task completions', 'event', '{"event": "task_success", "min_quality": 0.8}', 'analyze_patterns', '{"extract_skills": true}', true)
) AS task(task_type, name, description, trigger_type, trigger_config, action_type, action_config, requires_approval)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE causal_nodes IS 'Nodes in the causal knowledge graph representing variables, events, and states';
COMMENT ON TABLE causal_edges IS 'Directed causal relationships between nodes with strength and conditions';
COMMENT ON TABLE causal_interventions IS 'Record of do-calculus operations and counterfactual queries';
COMMENT ON TABLE memory_consolidation_jobs IS 'Scheduled and on-demand memory consolidation operations';
COMMENT ON TABLE memory_conflicts IS 'Detected conflicts between memories during consolidation';
COMMENT ON TABLE multimodal_representations IS 'Unified embeddings across modalities for cross-modal retrieval';
COMMENT ON TABLE crossmodal_queries IS 'Log of cross-modal search queries and results';
COMMENT ON TABLE executable_skills IS 'Learned procedural skills that can be executed';
COMMENT ON TABLE skill_executions IS 'History of skill executions with outcomes';
COMMENT ON TABLE autonomous_tasks IS 'Configured autonomous/proactive tasks';
COMMENT ON TABLE autonomous_executions IS 'Execution history for autonomous tasks with approval workflow';
COMMENT ON TABLE advanced_cognition_settings IS 'Per-tenant configuration for advanced cognition features';
