-- Migration: 162_reality_engine.sql
-- Description: The Reality Engine - Morphic UI, Reality Scrubber, Quantum Futures, Pre-Cognition
-- Version: 5.15.0
-- Date: 2026-01-18

-- ============================================================================
-- REALITY ENGINE SESSIONS
-- The unified runtime powering supernatural capabilities
-- ============================================================================

CREATE TABLE IF NOT EXISTS reality_engine_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL,
    
    -- Morphic UI State
    morphic_session JSONB NOT NULL DEFAULT '{}',
    
    -- Active timeline and branch
    active_timeline_id UUID,
    active_branch_id UUID,
    
    -- Configuration
    config JSONB NOT NULL DEFAULT '{
        "morphicUIEnabled": true,
        "realityScrubberEnabled": true,
        "quantumFuturesEnabled": true,
        "preCognitionEnabled": true,
        "autoSnapshotIntervalMs": 30000,
        "maxSnapshotsPerSession": 100,
        "maxBranchesPerSession": 8,
        "codeCurtainDefault": true,
        "ephemeralByDefault": true
    }',
    
    -- Metrics
    metrics JSONB NOT NULL DEFAULT '{
        "totalScrubs": 0,
        "totalBranches": 0,
        "totalMorphs": 0,
        "preCognitionHits": 0,
        "preCognitionMisses": 0,
        "avgScrubTimeMs": 0,
        "avgMorphTimeMs": 0,
        "avgPredictionAccuracy": 0,
        "snapshotStorageBytes": 0,
        "computeTimeMs": 0,
        "estimatedCostCents": 0
    }',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reality_sessions_tenant ON reality_engine_sessions(tenant_id);
CREATE INDEX idx_reality_sessions_user ON reality_engine_sessions(user_id);
CREATE INDEX idx_reality_sessions_conversation ON reality_engine_sessions(conversation_id);

-- ============================================================================
-- REALITY TIMELINES (Reality Scrubber)
-- "We replaced 'Undo' with Time Travel"
-- ============================================================================

CREATE TABLE IF NOT EXISTS reality_timelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES reality_engine_sessions(id) ON DELETE CASCADE,
    
    -- Timeline identity
    name VARCHAR(255) NOT NULL DEFAULT 'Main Reality',
    description TEXT,
    
    -- Timeline structure (array of snapshot references)
    snapshots JSONB NOT NULL DEFAULT '[]',
    current_position INTEGER NOT NULL DEFAULT -1,
    
    -- Branching
    parent_timeline_id UUID REFERENCES reality_timelines(id) ON DELETE SET NULL,
    branch_point INTEGER,
    child_timeline_ids JSONB NOT NULL DEFAULT '[]',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reality_timelines_session ON reality_timelines(session_id);
CREATE INDEX idx_reality_timelines_parent ON reality_timelines(parent_timeline_id);

-- ============================================================================
-- REALITY SNAPSHOTS (Reality Scrubber)
-- Full state captures for time travel
-- ============================================================================

CREATE TABLE IF NOT EXISTS reality_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES reality_engine_sessions(id) ON DELETE CASCADE,
    reality_id UUID NOT NULL REFERENCES reality_timelines(id) ON DELETE CASCADE,
    
    -- Snapshot timing
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    label VARCHAR(255),
    
    -- State captures
    vfs_hash VARCHAR(16) NOT NULL,
    vfs_snapshot BYTEA, -- Compressed VFS state
    db_snapshot BYTEA,  -- PGLite database snapshot
    ghost_state JSONB NOT NULL DEFAULT '{}',
    chat_context JSONB NOT NULL DEFAULT '{}',
    layout_state JSONB,
    
    -- Metadata
    trigger_event VARCHAR(50) NOT NULL,
    byte_size INTEGER NOT NULL DEFAULT 0,
    is_auto_snapshot BOOLEAN NOT NULL DEFAULT false,
    is_bookmarked BOOLEAN NOT NULL DEFAULT false,
    thumbnail_url TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reality_snapshots_session ON reality_snapshots(session_id);
CREATE INDEX idx_reality_snapshots_reality ON reality_snapshots(reality_id);
CREATE INDEX idx_reality_snapshots_timestamp ON reality_snapshots(timestamp DESC);
CREATE INDEX idx_reality_snapshots_bookmarked ON reality_snapshots(session_id, is_bookmarked) WHERE is_bookmarked = true;

-- ============================================================================
-- QUANTUM BRANCHES (Quantum Futures)
-- "Why choose one strategy? Split the timeline"
-- ============================================================================

CREATE TABLE IF NOT EXISTS quantum_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES reality_engine_sessions(id) ON DELETE CASCADE,
    
    -- Branch identity
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    icon VARCHAR(10) NOT NULL DEFAULT '🌟',
    
    -- State
    timeline_id UUID NOT NULL REFERENCES reality_timelines(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    
    -- Metrics
    metrics JSONB NOT NULL DEFAULT '{
        "completionRate": 0,
        "complexityScore": 0,
        "costEstimate": 0,
        "validationErrors": 0,
        "warningCount": 0,
        "testsPassed": 0,
        "testsTotal": 0,
        "interactionCount": 0,
        "timeSpentMs": 0
    }',
    
    -- Relationships
    parent_branch_id UUID REFERENCES quantum_branches(id) ON DELETE SET NULL,
    sibling_branch_ids JSONB NOT NULL DEFAULT '[]',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    collapsed_at TIMESTAMPTZ
);

CREATE INDEX idx_quantum_branches_session ON quantum_branches(session_id);
CREATE INDEX idx_quantum_branches_status ON quantum_branches(session_id, status);
CREATE INDEX idx_quantum_branches_parent ON quantum_branches(parent_branch_id);

-- ============================================================================
-- QUANTUM SPLITS (Quantum Futures)
-- Records of reality splits
-- ============================================================================

CREATE TABLE IF NOT EXISTS quantum_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES reality_engine_sessions(id) ON DELETE CASCADE,
    
    -- Split configuration
    parent_branch_id UUID NOT NULL REFERENCES quantum_branches(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    branch_ids JSONB NOT NULL DEFAULT '[]',
    
    -- UI state
    view_mode VARCHAR(20) NOT NULL DEFAULT 'single',
    active_comparison JSONB,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quantum_splits_session ON quantum_splits(session_id);

-- ============================================================================
-- QUANTUM DREAM ARCHIVE (Quantum Futures)
-- Archived branches stored for potential recall
-- ============================================================================

CREATE TABLE IF NOT EXISTS quantum_dream_archive (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL,
    session_id UUID NOT NULL,
    timeline_id UUID NOT NULL,
    
    -- Archived branch data
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metrics JSONB NOT NULL DEFAULT '{}',
    
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quantum_dream_archive_session ON quantum_dream_archive(session_id);

-- ============================================================================
-- PRECOGNITION QUEUES (Pre-Cognition)
-- "Radiant answers before you ask"
-- ============================================================================

CREATE TABLE IF NOT EXISTS precognition_queues (
    session_id UUID PRIMARY KEY REFERENCES reality_engine_sessions(id) ON DELETE CASCADE,
    
    -- Configuration
    config JSONB NOT NULL DEFAULT '{
        "enabled": true,
        "maxPredictions": 3,
        "predictionTTLMs": 60000,
        "computeBudgetMs": 5000,
        "minConfidenceThreshold": 0.6,
        "useGenesisModel": true,
        "genesisModelId": "llama-3-8b-instruct"
    }',
    
    -- Current predictions
    predictions JSONB NOT NULL DEFAULT '[]',
    
    last_refresh TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PRECOGNITION PREDICTIONS (Pre-Cognition)
-- Pre-computed solutions waiting to be served
-- ============================================================================

CREATE TABLE IF NOT EXISTS precognition_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES reality_engine_sessions(id) ON DELETE CASCADE,
    
    -- What was predicted
    predicted_intent VARCHAR(50) NOT NULL,
    predicted_prompt TEXT NOT NULL,
    confidence DECIMAL(3,2) NOT NULL,
    
    -- The pre-computed solution
    solution JSONB NOT NULL DEFAULT '{}',
    
    -- Lifecycle
    status VARCHAR(20) NOT NULL DEFAULT 'ready',
    compute_time_ms INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);

CREATE INDEX idx_precognition_predictions_session ON precognition_predictions(session_id);
CREATE INDEX idx_precognition_predictions_status ON precognition_predictions(session_id, status, expires_at);

-- ============================================================================
-- PRECOGNITION ANALYTICS (Pre-Cognition)
-- Track prediction hits and misses for learning
-- ============================================================================

CREATE TABLE IF NOT EXISTS precognition_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id UUID REFERENCES precognition_predictions(id) ON DELETE SET NULL,
    session_id UUID REFERENCES reality_engine_sessions(id) ON DELETE CASCADE,
    
    -- Hit or miss
    was_hit BOOLEAN NOT NULL,
    actual_latency_ms INTEGER,
    
    -- For misses, what was actually requested
    actual_intent VARCHAR(50),
    actual_prompt TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_precognition_analytics_session ON precognition_analytics(session_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE reality_engine_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reality_timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE reality_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE quantum_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE quantum_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE quantum_dream_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE precognition_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE precognition_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE precognition_analytics ENABLE ROW LEVEL SECURITY;

-- Policies for reality_engine_sessions
CREATE POLICY reality_sessions_tenant_isolation ON reality_engine_sessions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Policies for reality_timelines
CREATE POLICY reality_timelines_tenant_isolation ON reality_timelines
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Policies for reality_snapshots
CREATE POLICY reality_snapshots_tenant_isolation ON reality_snapshots
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Policies for quantum_branches
CREATE POLICY quantum_branches_tenant_isolation ON quantum_branches
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Policies for quantum_splits
CREATE POLICY quantum_splits_session_access ON quantum_splits
    FOR ALL USING (
        session_id IN (
            SELECT id FROM reality_engine_sessions 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

-- Policies for quantum_dream_archive
CREATE POLICY quantum_dream_archive_session_access ON quantum_dream_archive
    FOR ALL USING (
        session_id IN (
            SELECT id FROM reality_engine_sessions 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

-- Policies for precognition_queues
CREATE POLICY precognition_queues_session_access ON precognition_queues
    FOR ALL USING (
        session_id IN (
            SELECT id FROM reality_engine_sessions 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

-- Policies for precognition_predictions
CREATE POLICY precognition_predictions_tenant_isolation ON precognition_predictions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Policies for precognition_analytics
CREATE POLICY precognition_analytics_session_access ON precognition_analytics
    FOR ALL USING (
        session_id IN (
            SELECT id FROM reality_engine_sessions 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_reality_engine_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reality_engine_sessions_updated_at
    BEFORE UPDATE ON reality_engine_sessions
    FOR EACH ROW EXECUTE FUNCTION update_reality_engine_updated_at();

CREATE TRIGGER reality_timelines_updated_at
    BEFORE UPDATE ON reality_timelines
    FOR EACH ROW EXECUTE FUNCTION update_reality_engine_updated_at();

CREATE TRIGGER quantum_branches_updated_at
    BEFORE UPDATE ON quantum_branches
    FOR EACH ROW EXECUTE FUNCTION update_reality_engine_updated_at();

-- ============================================================================
-- CLEANUP FUNCTION
-- Remove expired predictions and old auto-snapshots
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_reality_engine_expired()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete expired predictions
    DELETE FROM precognition_predictions
    WHERE expires_at < NOW() AND status = 'ready';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old auto-snapshots (keep last 100 per session)
    DELETE FROM reality_snapshots rs
    WHERE rs.is_auto_snapshot = true
      AND rs.is_bookmarked = false
      AND rs.id NOT IN (
          SELECT id FROM reality_snapshots
          WHERE session_id = rs.session_id
          ORDER BY timestamp DESC
          LIMIT 100
      );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE reality_engine_sessions IS 'The Reality Engine - unified runtime for Morphic UI, Reality Scrubber, Quantum Futures, and Pre-Cognition';
COMMENT ON TABLE reality_timelines IS 'Reality Scrubber timelines - "We replaced Undo with Time Travel"';
COMMENT ON TABLE reality_snapshots IS 'Full state snapshots for time travel (VFS + DB + Ghost State)';
COMMENT ON TABLE quantum_branches IS 'Quantum Futures branches - "Why choose one strategy? Split the timeline"';
COMMENT ON TABLE quantum_splits IS 'Records of reality splits for parallel execution';
COMMENT ON TABLE quantum_dream_archive IS 'Archived branches stored in dream memory for potential recall';
COMMENT ON TABLE precognition_queues IS 'Pre-Cognition configuration per session';
COMMENT ON TABLE precognition_predictions IS 'Pre-computed solutions - "Radiant answers before you ask"';
COMMENT ON TABLE precognition_analytics IS 'Track prediction accuracy for learning';
