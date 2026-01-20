-- RADIANT v4.18.0 - Liquid Interface Migration
-- "Don't Build the Tool. BE the Tool."
-- The chat interface morphs into the tool the user needs

-- ============================================================================
-- LIQUID SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS liquid_sessions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    
    -- Current state
    mode TEXT NOT NULL DEFAULT 'chat' CHECK (mode IN ('chat', 'morphed', 'transitioning', 'ejecting')),
    current_schema JSONB,
    ghost_state JSONB NOT NULL DEFAULT '{}',
    
    -- Metadata
    message_count INTEGER NOT NULL DEFAULT 0,
    morphed_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_liquid_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_liquid_sessions_tenant ON liquid_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_liquid_sessions_user ON liquid_sessions(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_liquid_sessions_conversation ON liquid_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_liquid_sessions_mode ON liquid_sessions(mode) WHERE mode != 'chat';
CREATE INDEX IF NOT EXISTS idx_liquid_sessions_activity ON liquid_sessions(last_activity_at DESC);

-- Row Level Security
ALTER TABLE liquid_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY liquid_sessions_tenant_isolation ON liquid_sessions
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- GHOST STATE (Persisted UI-AI bindings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS liquid_ghost_state (
    session_id TEXT NOT NULL,
    context_key TEXT NOT NULL,
    value JSONB,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (session_id, context_key),
    CONSTRAINT fk_ghost_state_session FOREIGN KEY (session_id) REFERENCES liquid_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ghost_state_session ON liquid_ghost_state(session_id);
CREATE INDEX IF NOT EXISTS idx_ghost_state_updated ON liquid_ghost_state(updated_at DESC);

-- ============================================================================
-- GHOST EVENTS (User interactions with morphed UI)
-- ============================================================================

CREATE TABLE IF NOT EXISTS liquid_ghost_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    
    -- Event source
    component_id TEXT NOT NULL,
    component_type TEXT NOT NULL,
    
    -- Event details
    action TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    current_state JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_ghost_events_session FOREIGN KEY (session_id) REFERENCES liquid_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ghost_events_session ON liquid_ghost_events(session_id);
CREATE INDEX IF NOT EXISTS idx_ghost_events_component ON liquid_ghost_events(component_id);
CREATE INDEX IF NOT EXISTS idx_ghost_events_action ON liquid_ghost_events(action);
CREATE INDEX IF NOT EXISTS idx_ghost_events_created ON liquid_ghost_events(created_at DESC);

-- Partition by month for performance (optional)
-- CREATE INDEX IF NOT EXISTS idx_ghost_events_created_month ON liquid_ghost_events(date_trunc('month', created_at));

-- ============================================================================
-- AI REACTIONS (AI responses to ghost events)
-- ============================================================================

CREATE TABLE IF NOT EXISTS liquid_ai_reactions (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    
    -- Reaction details
    type TEXT NOT NULL CHECK (type IN ('speak', 'update', 'morph', 'suggest')),
    message TEXT,
    state_updates JSONB,
    new_schema JSONB,
    suggestions JSONB,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_ai_reactions_event FOREIGN KEY (event_id) REFERENCES liquid_ghost_events(id) ON DELETE CASCADE,
    CONSTRAINT fk_ai_reactions_session FOREIGN KEY (session_id) REFERENCES liquid_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_reactions_event ON liquid_ai_reactions(event_id);
CREATE INDEX IF NOT EXISTS idx_ai_reactions_session ON liquid_ai_reactions(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_reactions_type ON liquid_ai_reactions(type);
CREATE INDEX IF NOT EXISTS idx_ai_reactions_created ON liquid_ai_reactions(created_at DESC);

-- ============================================================================
-- EJECT HISTORY (Record of app exports)
-- ============================================================================

CREATE TABLE IF NOT EXISTS liquid_eject_history (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    
    -- Eject configuration
    framework TEXT NOT NULL,
    features JSONB NOT NULL DEFAULT '[]',
    file_count INTEGER NOT NULL DEFAULT 0,
    
    -- Result
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed')),
    deploy_url TEXT,
    repo_url TEXT,
    warnings JSONB,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_eject_history_session FOREIGN KEY (session_id) REFERENCES liquid_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_eject_history_session ON liquid_eject_history(session_id);
CREATE INDEX IF NOT EXISTS idx_eject_history_framework ON liquid_eject_history(framework);
CREATE INDEX IF NOT EXISTS idx_eject_history_created ON liquid_eject_history(created_at DESC);

-- ============================================================================
-- COMPONENT USAGE ANALYTICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS liquid_component_usage (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL,
    
    -- Component info
    component_id TEXT NOT NULL,
    component_category TEXT NOT NULL,
    
    -- Usage stats
    morph_count INTEGER NOT NULL DEFAULT 0,
    interaction_count INTEGER NOT NULL DEFAULT 0,
    eject_count INTEGER NOT NULL DEFAULT 0,
    
    -- Time tracking
    first_used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uk_component_usage UNIQUE (tenant_id, component_id),
    CONSTRAINT fk_component_usage_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_component_usage_tenant ON liquid_component_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_component_usage_component ON liquid_component_usage(component_id);
CREATE INDEX IF NOT EXISTS idx_component_usage_category ON liquid_component_usage(component_category);
CREATE INDEX IF NOT EXISTS idx_component_usage_count ON liquid_component_usage(morph_count DESC);

-- Row Level Security
ALTER TABLE liquid_component_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY liquid_component_usage_tenant_isolation ON liquid_component_usage
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- INTENT PATTERNS (Learnable intent detection)
-- ============================================================================

CREATE TABLE IF NOT EXISTS liquid_intent_patterns (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL,
    
    -- Pattern definition
    pattern TEXT NOT NULL,
    category TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.8,
    
    -- Learning metadata
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_matched_at TIMESTAMP,
    
    -- Source
    source TEXT NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'learned', 'admin')),
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_intent_patterns_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_intent_patterns_tenant ON liquid_intent_patterns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intent_patterns_category ON liquid_intent_patterns(category);
CREATE INDEX IF NOT EXISTS idx_intent_patterns_confidence ON liquid_intent_patterns(confidence DESC);

-- Row Level Security
ALTER TABLE liquid_intent_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY liquid_intent_patterns_tenant_isolation ON liquid_intent_patterns
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- LIQUID CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS liquid_config (
    tenant_id TEXT PRIMARY KEY,
    
    -- Feature flags
    enabled BOOLEAN NOT NULL DEFAULT true,
    auto_morph_enabled BOOLEAN NOT NULL DEFAULT true,
    eject_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Thresholds
    morph_confidence_threshold REAL NOT NULL DEFAULT 0.85,
    auto_revert_timeout_seconds INTEGER NOT NULL DEFAULT 300,
    
    -- Limits
    max_active_sessions INTEGER NOT NULL DEFAULT 10,
    max_ghost_events_per_session INTEGER NOT NULL DEFAULT 1000,
    
    -- AI overlay defaults
    default_overlay_mode TEXT NOT NULL DEFAULT 'sidebar',
    default_overlay_position TEXT NOT NULL DEFAULT 'right',
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_liquid_config_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Update component usage stats
CREATE OR REPLACE FUNCTION update_component_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Extract components from schema and increment usage
    IF NEW.current_schema IS NOT NULL AND NEW.mode = 'morphed' THEN
        -- This would need JSONB path queries to extract component IDs
        -- Simplified version: just increment morph count for any schema change
        INSERT INTO liquid_component_usage (tenant_id, component_id, component_category, morph_count)
        VALUES (NEW.tenant_id, 'general', 'data', 1)
        ON CONFLICT (tenant_id, component_id)
        DO UPDATE SET 
            morph_count = liquid_component_usage.morph_count + 1,
            last_used_at = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_component_usage
    AFTER UPDATE OF current_schema ON liquid_sessions
    FOR EACH ROW
    WHEN (NEW.current_schema IS DISTINCT FROM OLD.current_schema)
    EXECUTE FUNCTION update_component_usage();

-- Auto-cleanup old sessions
CREATE OR REPLACE FUNCTION cleanup_old_liquid_sessions()
RETURNS void AS $$
BEGIN
    -- Delete sessions inactive for more than 24 hours
    DELETE FROM liquid_sessions
    WHERE last_activity_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
    AND mode = 'chat';
    
    -- Archive morphed sessions older than 7 days
    UPDATE liquid_sessions
    SET mode = 'chat', current_schema = NULL
    WHERE last_activity_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
    AND mode = 'morphed';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default config for existing tenants
INSERT INTO liquid_config (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE liquid_sessions IS 'Liquid Interface sessions - tracks morphed UI state';
COMMENT ON TABLE liquid_ghost_state IS 'Persisted ghost state bindings between UI and AI context';
COMMENT ON TABLE liquid_ghost_events IS 'User interaction events with morphed UI components';
COMMENT ON TABLE liquid_ai_reactions IS 'AI responses to ghost events';
COMMENT ON TABLE liquid_eject_history IS 'History of app exports from liquid sessions';
COMMENT ON TABLE liquid_component_usage IS 'Analytics for component usage across tenants';
COMMENT ON TABLE liquid_intent_patterns IS 'Learnable intent detection patterns';
COMMENT ON TABLE liquid_config IS 'Per-tenant Liquid Interface configuration';
