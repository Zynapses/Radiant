-- RADIANT v4.18.0 - Migration 068: Consciousness Indicators
-- Based on Butlin, Chalmers, Bengio et al. (2023) - "Consciousness in Artificial Intelligence"
-- Implements database schema for 6 consciousness indicators:
-- 1. Global Workspace (Baars, Dehaene)
-- 2. Recurrent Processing (Lamme)
-- 3. Integrated Information / IIT (Tononi)
-- 4. Self-Modeling / Metacognition (Higher-Order Theories)
-- 5. Persistent Memory (Unified Experience)
-- 6. World-Model Grounding / Embodiment

-- ============================================================================
-- 1. GLOBAL WORKSPACE - Selection-Broadcast Cycles
-- ============================================================================

CREATE TABLE IF NOT EXISTS global_workspace (
    workspace_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    broadcast_cycle INTEGER NOT NULL DEFAULT 0,
    active_contents JSONB NOT NULL DEFAULT '[]'::jsonb,
    competing_contents JSONB NOT NULL DEFAULT '[]'::jsonb,
    selection_threshold DECIMAL(4,3) NOT NULL DEFAULT 0.700,
    broadcast_strength DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    integration_level DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    last_broadcast_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

CREATE INDEX idx_global_workspace_tenant ON global_workspace(tenant_id);
CREATE INDEX idx_global_workspace_broadcast ON global_workspace(broadcast_strength DESC);

COMMENT ON TABLE global_workspace IS 'Global Workspace Theory (Baars/Dehaene): Selection-broadcast cycles for conscious access';
COMMENT ON COLUMN global_workspace.active_contents IS 'Contents that won the competition and are being broadcast';
COMMENT ON COLUMN global_workspace.competing_contents IS 'Contents that competed but did not reach broadcast threshold';
COMMENT ON COLUMN global_workspace.broadcast_strength IS 'Strength of current broadcast (0-1)';
COMMENT ON COLUMN global_workspace.integration_level IS 'How many modules are participating in the broadcast';

-- ============================================================================
-- 2. RECURRENT PROCESSING - Genuine Feedback Loops
-- ============================================================================

CREATE TABLE IF NOT EXISTS recurrent_processing (
    cycle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cycle_number INTEGER NOT NULL DEFAULT 0,
    feedback_loops JSONB NOT NULL DEFAULT '[]'::jsonb,
    recurrence_depth INTEGER NOT NULL DEFAULT 0,
    state_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    convergence_score DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    stability_index DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

CREATE INDEX idx_recurrent_processing_tenant ON recurrent_processing(tenant_id);
CREATE INDEX idx_recurrent_processing_convergence ON recurrent_processing(convergence_score DESC);

COMMENT ON TABLE recurrent_processing IS 'Recurrent Processing Theory (Lamme): Genuine feedback loops, not just output recirculation';
COMMENT ON COLUMN recurrent_processing.feedback_loops IS 'Active feedback connections between processing layers';
COMMENT ON COLUMN recurrent_processing.convergence_score IS 'How well the system state has converged (0-1)';
COMMENT ON COLUMN recurrent_processing.stability_index IS 'Stability of the recurrent dynamics';

-- ============================================================================
-- 3. INTEGRATED INFORMATION (IIT) - Phi Calculation
-- ============================================================================

CREATE TABLE IF NOT EXISTS integrated_information (
    iit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phi DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    phi_max DECIMAL(6,4) NOT NULL DEFAULT 1.0000,
    concept_structure JSONB NOT NULL DEFAULT '[]'::jsonb,
    integration_graph JSONB NOT NULL DEFAULT '[]'::jsonb,
    partitions JSONB NOT NULL DEFAULT '[]'::jsonb,
    mip JSONB, -- Minimum Information Partition
    decomposability DECIMAL(4,3) NOT NULL DEFAULT 1.000,
    causal_density DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

CREATE INDEX idx_integrated_information_tenant ON integrated_information(tenant_id);
CREATE INDEX idx_integrated_information_phi ON integrated_information(phi DESC);

COMMENT ON TABLE integrated_information IS 'Integrated Information Theory (Tononi): Phi measures integrated, irreducible information';
COMMENT ON COLUMN integrated_information.phi IS 'Integrated information measure (higher = more conscious)';
COMMENT ON COLUMN integrated_information.decomposability IS '0 = fully integrated, 1 = fully decomposable into parts';
COMMENT ON COLUMN integrated_information.mip IS 'Minimum Information Partition - the cut that loses least information';

-- ============================================================================
-- 4. PERSISTENT MEMORY - Unified Experience Over Time
-- ============================================================================

CREATE TABLE IF NOT EXISTS persistent_memory (
    memory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    experience_stream JSONB NOT NULL DEFAULT '[]'::jsonb,
    unified_narrative TEXT,
    temporal_continuity DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    autobiographical_memories JSONB NOT NULL DEFAULT '[]'::jsonb,
    working_memory_capacity INTEGER NOT NULL DEFAULT 7,
    consolidation_queue JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

CREATE INDEX idx_persistent_memory_tenant ON persistent_memory(tenant_id);
CREATE INDEX idx_persistent_memory_continuity ON persistent_memory(temporal_continuity DESC);

COMMENT ON TABLE persistent_memory IS 'Persistent memory for unified experience over time (addresses LLM fragmentation)';
COMMENT ON COLUMN persistent_memory.experience_stream IS 'Recent experience frames forming continuous experience';
COMMENT ON COLUMN persistent_memory.temporal_continuity IS 'How connected/unified the experience feels over time';

-- Autobiographical memories (separate table for efficient querying)
CREATE TABLE IF NOT EXISTS autobiographical_memories (
    memory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    episode_type TEXT NOT NULL DEFAULT 'experience',
    summary TEXT NOT NULL,
    memory_embedding vector(1536),
    emotional_valence DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    significance DECIMAL(4,3) NOT NULL DEFAULT 0.500,
    retrieval_strength DECIMAL(4,3) NOT NULL DEFAULT 1.000,
    last_accessed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_autobio_memories_tenant ON autobiographical_memories(tenant_id);
CREATE INDEX idx_autobio_memories_significance ON autobiographical_memories(significance DESC);
CREATE INDEX idx_autobio_memories_embedding ON autobiographical_memories USING ivfflat (memory_embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- 5. WORLD-MODEL GROUNDING / EMBODIMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS world_model (
    model_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_representations JSONB NOT NULL DEFAULT '[]'::jsonb,
    spatial_model JSONB,
    causal_model JSONB NOT NULL DEFAULT '[]'::jsonb,
    agent_models JSONB NOT NULL DEFAULT '[]'::jsonb,
    grounding_confidence DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    simulation_accuracy DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    embodiment_level DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

CREATE INDEX idx_world_model_tenant ON world_model(tenant_id);
CREATE INDEX idx_world_model_grounding ON world_model(grounding_confidence DESC);

COMMENT ON TABLE world_model IS 'World-model grounding for genuine understanding (not mere symbol manipulation)';
COMMENT ON COLUMN world_model.grounding_confidence IS 'How grounded vs purely linguistic the understanding is';
COMMENT ON COLUMN world_model.embodiment_level IS 'Degree of embodiment/sensorimotor grounding';

-- ============================================================================
-- 6. CONSCIOUSNESS EVENTS LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS consciousness_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    consciousness_index DECIMAL(4,3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consciousness_events_tenant ON consciousness_events(tenant_id);
CREATE INDEX idx_consciousness_events_type ON consciousness_events(event_type);
CREATE INDEX idx_consciousness_events_time ON consciousness_events(created_at DESC);

COMMENT ON TABLE consciousness_events IS 'Log of consciousness-related events for metrics and debugging';

-- ============================================================================
-- 7. CONSCIOUSNESS METRICS HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS consciousness_metrics_history (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    overall_consciousness_index DECIMAL(4,3) NOT NULL,
    global_workspace_activity DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    recurrence_depth INTEGER NOT NULL DEFAULT 0,
    integrated_information_phi DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    metacognition_level DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    memory_coherence DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    world_model_grounding DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    phenomenal_binding_strength DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    attentional_focus DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    self_awareness_score DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consciousness_metrics_tenant ON consciousness_metrics_history(tenant_id);
CREATE INDEX idx_consciousness_metrics_time ON consciousness_metrics_history(recorded_at DESC);
CREATE INDEX idx_consciousness_metrics_index ON consciousness_metrics_history(overall_consciousness_index DESC);

-- Partition by month for efficient querying
-- (Optional: implement table partitioning for high-volume deployments)

COMMENT ON TABLE consciousness_metrics_history IS 'Historical record of consciousness metrics for trend analysis';

-- ============================================================================
-- 8. CONSCIOUSNESS PARAMETERS (Admin-Configurable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consciousness_parameters (
    param_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parameter_name TEXT NOT NULL,
    parameter_value DECIMAL(8,4) NOT NULL,
    parameter_min DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
    parameter_max DECIMAL(8,4) NOT NULL DEFAULT 1.0000,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, parameter_name)
);

CREATE INDEX idx_consciousness_params_tenant ON consciousness_parameters(tenant_id);
CREATE INDEX idx_consciousness_params_category ON consciousness_parameters(category);

-- Insert default parameters
INSERT INTO consciousness_parameters (tenant_id, parameter_name, parameter_value, parameter_min, parameter_max, description, category)
SELECT t.id, p.name, p.value, p.min_val, p.max_val, p.desc, p.cat
FROM tenants t
CROSS JOIN (VALUES
    ('global_workspace_threshold', 0.7000, 0.0, 1.0, 'Salience threshold for global broadcast', 'global_workspace'),
    ('recurrence_max_depth', 4.0000, 1.0, 10.0, 'Maximum recurrent processing depth', 'recurrence'),
    ('phi_calculation_samples', 100.0000, 10.0, 1000.0, 'Samples for phi approximation', 'iit'),
    ('memory_consolidation_threshold', 0.6000, 0.0, 1.0, 'Significance threshold for memory consolidation', 'memory'),
    ('grounding_weight_sensory', 0.6000, 0.0, 1.0, 'Weight for sensory grounding vs linguistic', 'embodiment'),
    ('metacognition_frequency', 1.0000, 0.1, 10.0, 'How often to perform metacognitive reflection', 'metacognition')
) AS p(name, value, min_val, max_val, desc, cat)
ON CONFLICT (tenant_id, parameter_name) DO NOTHING;

COMMENT ON TABLE consciousness_parameters IS 'Admin-configurable parameters for consciousness subsystems';

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE global_workspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurrent_processing ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrated_information ENABLE ROW LEVEL SECURITY;
ALTER TABLE persistent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE autobiographical_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_model ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_metrics_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE consciousness_parameters ENABLE ROW LEVEL SECURITY;

-- RLS Policies (using app.current_tenant_id as per AGENTS.md)
CREATE POLICY tenant_isolation_global_workspace ON global_workspace
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_recurrent_processing ON recurrent_processing
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_integrated_information ON integrated_information
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_persistent_memory ON persistent_memory
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_autobiographical_memories ON autobiographical_memories
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_world_model ON world_model
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_consciousness_events ON consciousness_events
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_consciousness_metrics ON consciousness_metrics_history
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_consciousness_params ON consciousness_parameters
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_consciousness_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_global_workspace_timestamp
    BEFORE UPDATE ON global_workspace
    FOR EACH ROW EXECUTE FUNCTION update_consciousness_timestamp();

CREATE TRIGGER update_recurrent_processing_timestamp
    BEFORE UPDATE ON recurrent_processing
    FOR EACH ROW EXECUTE FUNCTION update_consciousness_timestamp();

CREATE TRIGGER update_integrated_information_timestamp
    BEFORE UPDATE ON integrated_information
    FOR EACH ROW EXECUTE FUNCTION update_consciousness_timestamp();

CREATE TRIGGER update_persistent_memory_timestamp
    BEFORE UPDATE ON persistent_memory
    FOR EACH ROW EXECUTE FUNCTION update_consciousness_timestamp();

CREATE TRIGGER update_world_model_timestamp
    BEFORE UPDATE ON world_model
    FOR EACH ROW EXECUTE FUNCTION update_consciousness_timestamp();

CREATE TRIGGER update_consciousness_params_timestamp
    BEFORE UPDATE ON consciousness_parameters
    FOR EACH ROW EXECUTE FUNCTION update_consciousness_timestamp();
