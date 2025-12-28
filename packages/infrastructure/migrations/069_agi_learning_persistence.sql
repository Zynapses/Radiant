-- RADIANT v4.18.0 - Migration 069: AGI Learning Persistence
-- Ensures all AGI learning is stored persistently and restored on restart

-- ============================================================================
-- 1. AGI Learning Snapshots
-- ============================================================================

CREATE TABLE IF NOT EXISTS agi_learning_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    snapshot_type TEXT NOT NULL DEFAULT 'checkpoint' CHECK (snapshot_type IN ('full', 'incremental', 'checkpoint')),
    component_snapshots JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_learning_events INTEGER NOT NULL DEFAULT 0,
    last_learning_at TIMESTAMPTZ,
    restored_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agi_snapshots_tenant ON agi_learning_snapshots(tenant_id);
CREATE INDEX idx_agi_snapshots_type ON agi_learning_snapshots(snapshot_type);
CREATE INDEX idx_agi_snapshots_created ON agi_learning_snapshots(created_at DESC);

COMMENT ON TABLE agi_learning_snapshots IS 'Snapshots of AGI learning state for persistence and restoration';

-- ============================================================================
-- 2. AGI Learning Events
-- ============================================================================

CREATE TABLE IF NOT EXISTS agi_learning_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agi_events_tenant ON agi_learning_events(tenant_id);
CREATE INDEX idx_agi_events_type ON agi_learning_events(event_type);
CREATE INDEX idx_agi_events_created ON agi_learning_events(created_at DESC);

COMMENT ON TABLE agi_learning_events IS 'Log of AGI learning events including restorations';

-- ============================================================================
-- 3. AGI Component State Cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS agi_component_state (
    state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    component_type TEXT NOT NULL,
    state_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    data_hash TEXT,
    record_count INTEGER NOT NULL DEFAULT 0,
    is_loaded BOOLEAN NOT NULL DEFAULT false,
    last_restored_at TIMESTAMPTZ,
    last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, component_type)
);

CREATE INDEX idx_agi_component_state_tenant ON agi_component_state(tenant_id);
CREATE INDEX idx_agi_component_state_type ON agi_component_state(component_type);

COMMENT ON TABLE agi_component_state IS 'Cached state for AGI components to track restoration status';

-- ============================================================================
-- 4. Learning Persistence Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS agi_persistence_config (
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    auto_snapshot_enabled BOOLEAN NOT NULL DEFAULT true,
    snapshot_interval_hours INTEGER NOT NULL DEFAULT 24,
    max_snapshots_retained INTEGER NOT NULL DEFAULT 30,
    auto_restore_on_start BOOLEAN NOT NULL DEFAULT true,
    restore_components JSONB NOT NULL DEFAULT '["consciousness", "cognitive_brain", "feedback_learning", "model_scores", "self_model", "world_model", "episodic_memory", "skill_library", "goal_planning"]'::jsonb,
    compression_enabled BOOLEAN NOT NULL DEFAULT true,
    encryption_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

CREATE INDEX idx_agi_persistence_config_tenant ON agi_persistence_config(tenant_id);

-- Insert default config for existing tenants
INSERT INTO agi_persistence_config (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

COMMENT ON TABLE agi_persistence_config IS 'Configuration for AGI learning persistence behavior';

-- ============================================================================
-- 5. Skill Library (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS skill_library (
    skill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    skill_name TEXT NOT NULL,
    skill_type TEXT NOT NULL DEFAULT 'general',
    description TEXT,
    skill_embedding vector(1536),
    execution_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    success_rate DECIMAL(4,3) NOT NULL DEFAULT 0.000,
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    learned_from TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skill_library_tenant ON skill_library(tenant_id);
CREATE INDEX idx_skill_library_type ON skill_library(skill_type);
CREATE INDEX idx_skill_library_embedding ON skill_library USING ivfflat (skill_embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE skill_library IS 'Learned skills and capabilities that persist across sessions';

-- ============================================================================
-- 6. Episodic Memories (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS episodic_memories (
    memory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id TEXT,
    session_id TEXT,
    episode_type TEXT NOT NULL DEFAULT 'interaction',
    content TEXT NOT NULL,
    memory_embedding vector(1536),
    emotional_context JSONB DEFAULT '{}'::jsonb,
    importance_score DECIMAL(4,3) NOT NULL DEFAULT 0.500,
    retrieval_count INTEGER NOT NULL DEFAULT 0,
    last_retrieved_at TIMESTAMPTZ,
    consolidated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_episodic_memories_tenant ON episodic_memories(tenant_id);
CREATE INDEX idx_episodic_memories_user ON episodic_memories(user_id);
CREATE INDEX idx_episodic_memories_importance ON episodic_memories(importance_score DESC);
CREATE INDEX idx_episodic_memories_embedding ON episodic_memories USING ivfflat (memory_embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE episodic_memories IS 'Episodic memories for long-term learning retention';

-- ============================================================================
-- 7. Learning Interactions Table (if not exists - check and add missing columns)
-- ============================================================================

DO $$
BEGIN
    -- Add tenant_id to learning_feedback if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'learning_feedback' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE learning_feedback ADD COLUMN tenant_id UUID REFERENCES tenants(id);
        CREATE INDEX IF NOT EXISTS idx_learning_feedback_tenant ON learning_feedback(tenant_id);
    END IF;
END $$;

-- ============================================================================
-- 8. Model Scores - Ensure persistence columns
-- ============================================================================

DO $$
BEGIN
    -- Add persistence metadata if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'model_scores' AND column_name = 'persisted_at'
    ) THEN
        ALTER TABLE model_scores ADD COLUMN persisted_at TIMESTAMPTZ;
        ALTER TABLE model_scores ADD COLUMN restore_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- ============================================================================
-- 9. Restoration Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS agi_restoration_log (
    restoration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    snapshot_id UUID REFERENCES agi_learning_snapshots(snapshot_id),
    restoration_type TEXT NOT NULL DEFAULT 'startup',
    components_restored JSONB NOT NULL DEFAULT '[]'::jsonb,
    duration_ms INTEGER,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    restored_by TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_restoration_log_tenant ON agi_restoration_log(tenant_id);
CREATE INDEX idx_restoration_log_created ON agi_restoration_log(created_at DESC);

COMMENT ON TABLE agi_restoration_log IS 'Log of all AGI learning restoration events';

-- ============================================================================
-- 10. Automatic Snapshot Scheduler
-- ============================================================================

CREATE OR REPLACE FUNCTION schedule_agi_snapshot()
RETURNS void AS $$
DECLARE
    t_id UUID;
BEGIN
    FOR t_id IN 
        SELECT tenant_id FROM agi_persistence_config 
        WHERE auto_snapshot_enabled = true
        AND (
            NOT EXISTS (
                SELECT 1 FROM agi_learning_snapshots 
                WHERE tenant_id = agi_persistence_config.tenant_id
                AND created_at > NOW() - (snapshot_interval_hours * INTERVAL '1 hour')
            )
        )
    LOOP
        INSERT INTO agi_learning_snapshots (tenant_id, snapshot_type)
        VALUES (t_id, 'checkpoint');
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION schedule_agi_snapshot IS 'Creates checkpoint snapshots for tenants that need them';

-- ============================================================================
-- 11. Cleanup Old Snapshots
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_agi_snapshots()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    WITH to_delete AS (
        SELECT snapshot_id
        FROM (
            SELECT snapshot_id,
                   ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at DESC) as rn,
                   c.max_snapshots_retained
            FROM agi_learning_snapshots s
            JOIN agi_persistence_config c ON s.tenant_id = c.tenant_id
        ) ranked
        WHERE rn > max_snapshots_retained
    )
    DELETE FROM agi_learning_snapshots WHERE snapshot_id IN (SELECT snapshot_id FROM to_delete);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_agi_snapshots IS 'Removes old snapshots beyond retention limit';

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE agi_learning_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_component_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_persistence_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodic_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE agi_restoration_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_snapshots ON agi_learning_snapshots
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_agi_events ON agi_learning_events
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_component_state ON agi_component_state
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_persistence_config ON agi_persistence_config
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_skill_library ON skill_library
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_episodic_memories ON episodic_memories
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_restoration_log ON agi_restoration_log
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_agi_persistence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agi_persistence_config_timestamp
    BEFORE UPDATE ON agi_persistence_config
    FOR EACH ROW EXECUTE FUNCTION update_agi_persistence_timestamp();

CREATE TRIGGER update_skill_library_timestamp
    BEFORE UPDATE ON skill_library
    FOR EACH ROW EXECUTE FUNCTION update_agi_persistence_timestamp();
