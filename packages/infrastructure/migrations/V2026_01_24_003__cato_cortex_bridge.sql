-- Cato-Cortex Bridge Integration
-- Links Cato consciousness/memory systems with Cortex tiered memory architecture
-- Enables bidirectional sync and context enrichment

-- ============================================================================
-- BRIDGE CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_cortex_bridge_config (
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Sync settings
    sync_enabled BOOLEAN NOT NULL DEFAULT true,
    sync_semantic_to_cortex BOOLEAN NOT NULL DEFAULT true,
    sync_episodic_to_cortex BOOLEAN NOT NULL DEFAULT false,
    
    -- Enrichment settings
    enrich_ego_from_cortex BOOLEAN NOT NULL DEFAULT true,
    max_cortex_nodes_for_context INTEGER NOT NULL DEFAULT 10,
    min_relevance_score DECIMAL(3,2) NOT NULL DEFAULT 0.30,
    
    -- Auto-promotion settings
    auto_promote_high_importance BOOLEAN NOT NULL DEFAULT true,
    importance_promotion_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.80,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tenant_id)
);

CREATE INDEX idx_cato_cortex_bridge_config_tenant ON cato_cortex_bridge_config(tenant_id);

ALTER TABLE cato_cortex_bridge_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY cato_cortex_bridge_config_tenant_isolation ON cato_cortex_bridge_config
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- SYNC TRACKING (Add columns to existing Cato table)
-- ============================================================================

-- Add sync tracking columns to cato_global_memory if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cato_global_memory' AND column_name = 'synced_to_cortex'
    ) THEN
        ALTER TABLE cato_global_memory ADD COLUMN synced_to_cortex BOOLEAN DEFAULT false;
        ALTER TABLE cato_global_memory ADD COLUMN synced_at TIMESTAMPTZ;
        ALTER TABLE cato_global_memory ADD COLUMN cortex_node_id UUID;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cato_global_memory_sync ON cato_global_memory(tenant_id, synced_to_cortex) 
    WHERE synced_to_cortex = false;

-- ============================================================================
-- SYNC HISTORY LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_cortex_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sync_direction VARCHAR(20) NOT NULL CHECK (sync_direction IN ('cato_to_cortex', 'cortex_to_cato')),
    sync_type VARCHAR(30) NOT NULL CHECK (sync_type IN ('scheduled', 'high_importance', 'manual', 'golden_rule_update')),
    records_synced INTEGER NOT NULL DEFAULT 0,
    records_skipped INTEGER NOT NULL DEFAULT 0,
    records_errored INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER,
    error_details JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_cato_cortex_sync_log_tenant ON cato_cortex_sync_log(tenant_id);
CREATE INDEX idx_cato_cortex_sync_log_time ON cato_cortex_sync_log(tenant_id, started_at DESC);

ALTER TABLE cato_cortex_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY cato_cortex_sync_log_tenant_isolation ON cato_cortex_sync_log
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- CONTEXT ENRICHMENT CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_cortex_enrichment_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    query_hash VARCHAR(64) NOT NULL,
    enrichment_data JSONB NOT NULL,
    token_estimate INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    
    UNIQUE(tenant_id, query_hash)
);

CREATE INDEX idx_cato_cortex_enrichment_cache_tenant ON cato_cortex_enrichment_cache(tenant_id);
CREATE INDEX idx_cato_cortex_enrichment_cache_expires ON cato_cortex_enrichment_cache(expires_at);

ALTER TABLE cato_cortex_enrichment_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY cato_cortex_enrichment_cache_tenant_isolation ON cato_cortex_enrichment_cache
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Initialize bridge config for new tenant
CREATE OR REPLACE FUNCTION cato_cortex_initialize_bridge(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO cato_cortex_bridge_config (tenant_id)
    VALUES (p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Get pending memories for sync
CREATE OR REPLACE FUNCTION cato_cortex_get_pending_sync(
    p_tenant_id UUID,
    p_category VARCHAR DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    memory_id UUID,
    category VARCHAR,
    key TEXT,
    value JSONB,
    importance DECIMAL,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id::UUID as memory_id,
        m.category::VARCHAR,
        m.key::TEXT,
        m.value::JSONB,
        m.importance::DECIMAL,
        m.created_at
    FROM cato_global_memory m
    WHERE m.tenant_id = p_tenant_id
    AND (m.synced_to_cortex IS NULL OR m.synced_to_cortex = false)
    AND (p_category IS NULL OR m.category = p_category)
    ORDER BY m.importance DESC, m.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup expired enrichment cache
CREATE OR REPLACE FUNCTION cato_cortex_cleanup_enrichment_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cato_cortex_enrichment_cache
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to auto-promote high-importance memories
CREATE OR REPLACE FUNCTION cato_memory_auto_promote_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_config cato_cortex_bridge_config%ROWTYPE;
BEGIN
    -- Get bridge config for tenant
    SELECT * INTO v_config 
    FROM cato_cortex_bridge_config 
    WHERE tenant_id = NEW.tenant_id;
    
    -- If auto-promote enabled and importance exceeds threshold
    IF v_config.auto_promote_high_importance = true 
       AND NEW.importance >= v_config.importance_promotion_threshold
       AND (NEW.synced_to_cortex IS NULL OR NEW.synced_to_cortex = false) THEN
        -- Mark for immediate sync (actual sync handled by application)
        NEW.synced_to_cortex := false;
        -- Log high-importance detection (sync happens async)
        RAISE NOTICE 'High-importance memory detected for tenant %, memory %', NEW.tenant_id, NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if cato_global_memory table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cato_global_memory') THEN
        DROP TRIGGER IF EXISTS cato_memory_auto_promote ON cato_global_memory;
        CREATE TRIGGER cato_memory_auto_promote
            BEFORE INSERT OR UPDATE ON cato_global_memory
            FOR EACH ROW EXECUTE FUNCTION cato_memory_auto_promote_trigger();
    END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE cato_cortex_bridge_config IS 'Configuration for Cato-Cortex memory integration per tenant';
COMMENT ON TABLE cato_cortex_sync_log IS 'Log of synchronization events between Cato and Cortex';
COMMENT ON TABLE cato_cortex_enrichment_cache IS 'Cached context enrichment from Cortex for ego prompt building';
COMMENT ON FUNCTION cato_cortex_initialize_bridge IS 'Initialize bridge config for a new tenant';
COMMENT ON FUNCTION cato_cortex_get_pending_sync IS 'Get Cato memories pending sync to Cortex';
COMMENT ON FUNCTION cato_cortex_cleanup_enrichment_cache IS 'Clean up expired enrichment cache entries';
