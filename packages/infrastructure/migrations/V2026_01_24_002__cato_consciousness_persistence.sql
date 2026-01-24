-- =============================================================================
-- CATO CONSCIOUSNESS PERSISTENCE TABLES
-- Migration: V2026_01_24_002
-- 
-- Provides database-backed persistence for Cato consciousness state, 
-- ensuring survival across Lambda cold starts.
-- =============================================================================

-- =============================================================================
-- 1. GLOBAL MEMORY TABLE
-- Stores episodic, semantic, procedural, and working memory entries
-- =============================================================================

CREATE TABLE IF NOT EXISTS cato_global_memory (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  category VARCHAR(32) NOT NULL CHECK (category IN ('episodic', 'semantic', 'procedural', 'working')),
  key VARCHAR(512) NOT NULL,
  value JSONB NOT NULL,
  importance DECIMAL(3, 2) DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB,
  
  CONSTRAINT cato_global_memory_unique_key UNIQUE (tenant_id, category, key)
);

CREATE INDEX idx_cato_global_memory_tenant ON cato_global_memory(tenant_id);
CREATE INDEX idx_cato_global_memory_category ON cato_global_memory(tenant_id, category);
CREATE INDEX idx_cato_global_memory_importance ON cato_global_memory(tenant_id, importance DESC);
CREATE INDEX idx_cato_global_memory_expires ON cato_global_memory(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE cato_global_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY cato_global_memory_tenant_isolation ON cato_global_memory
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- =============================================================================
-- 2. CONSCIOUSNESS STATE TABLE
-- Tracks the current state of the consciousness loop
-- =============================================================================

CREATE TABLE IF NOT EXISTS cato_consciousness_state (
  tenant_id VARCHAR(64) PRIMARY KEY,
  loop_state VARCHAR(32) NOT NULL DEFAULT 'IDLE' CHECK (loop_state IN ('IDLE', 'PROCESSING', 'REFLECTING', 'DREAMING', 'PAUSED')),
  cycle_count BIGINT DEFAULT 0,
  last_cycle_at TIMESTAMPTZ,
  awareness_level DECIMAL(3, 2) DEFAULT 0.5 CHECK (awareness_level >= 0 AND awareness_level <= 1),
  attention_focus TEXT,
  active_thoughts JSONB DEFAULT '[]'::JSONB,
  processing_queue INTEGER DEFAULT 0,
  memory_pressure DECIMAL(3, 2) DEFAULT 0 CHECK (memory_pressure >= 0 AND memory_pressure <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cato_consciousness_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY cato_consciousness_state_tenant_isolation ON cato_consciousness_state
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- =============================================================================
-- 3. CONSCIOUSNESS CONFIG TABLE
-- Per-tenant configuration for the consciousness loop
-- =============================================================================

CREATE TABLE IF NOT EXISTS cato_consciousness_config (
  tenant_id VARCHAR(64) PRIMARY KEY,
  cycle_interval_ms INTEGER DEFAULT 1000,
  max_active_thoughts INTEGER DEFAULT 10,
  memory_threshold DECIMAL(3, 2) DEFAULT 0.8,
  enable_dreaming BOOLEAN DEFAULT TRUE,
  dreaming_hours JSONB DEFAULT '[2, 5]'::JSONB,
  reflection_depth INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cato_consciousness_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY cato_consciousness_config_tenant_isolation ON cato_consciousness_config
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- =============================================================================
-- 4. CONSCIOUSNESS METRICS TABLE
-- Tracks loop performance metrics over time
-- =============================================================================

CREATE TABLE IF NOT EXISTS cato_consciousness_metrics (
  tenant_id VARCHAR(64) PRIMARY KEY,
  total_cycles BIGINT DEFAULT 0,
  average_cycle_ms DECIMAL(10, 2) DEFAULT 0,
  thoughts_processed BIGINT DEFAULT 0,
  reflections_completed BIGINT DEFAULT 0,
  dreaming_cycles BIGINT DEFAULT 0,
  uptime_ms BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cato_consciousness_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY cato_consciousness_metrics_tenant_isolation ON cato_consciousness_metrics
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- =============================================================================
-- 5. AUTO-UPDATE TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_cato_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cato_global_memory_updated_at
  BEFORE UPDATE ON cato_global_memory
  FOR EACH ROW EXECUTE FUNCTION update_cato_updated_at();

CREATE TRIGGER cato_consciousness_state_updated_at
  BEFORE UPDATE ON cato_consciousness_state
  FOR EACH ROW EXECUTE FUNCTION update_cato_updated_at();

CREATE TRIGGER cato_consciousness_config_updated_at
  BEFORE UPDATE ON cato_consciousness_config
  FOR EACH ROW EXECUTE FUNCTION update_cato_updated_at();

CREATE TRIGGER cato_consciousness_metrics_updated_at
  BEFORE UPDATE ON cato_consciousness_metrics
  FOR EACH ROW EXECUTE FUNCTION update_cato_updated_at();

-- =============================================================================
-- 6. MEMORY CONSOLIDATION FUNCTION
-- Called during dream cycles to consolidate and prune memories
-- =============================================================================

CREATE OR REPLACE FUNCTION cato_consolidate_memories(p_tenant_id VARCHAR(64))
RETURNS TABLE (
  expired_removed INTEGER,
  low_importance_removed INTEGER,
  total_remaining INTEGER
) AS $$
DECLARE
  v_expired INTEGER;
  v_low_importance INTEGER;
  v_remaining INTEGER;
BEGIN
  -- Remove expired memories
  DELETE FROM cato_global_memory 
  WHERE tenant_id = p_tenant_id 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
  GET DIAGNOSTICS v_expired = ROW_COUNT;
  
  -- Remove low importance memories older than 30 days with few accesses
  DELETE FROM cato_global_memory
  WHERE tenant_id = p_tenant_id
    AND importance < 0.3
    AND access_count < 3
    AND created_at < NOW() - INTERVAL '30 days'
    AND category NOT IN ('procedural'); -- Keep procedural memories (skills)
  GET DIAGNOSTICS v_low_importance = ROW_COUNT;
  
  -- Count remaining
  SELECT COUNT(*) INTO v_remaining 
  FROM cato_global_memory 
  WHERE tenant_id = p_tenant_id;
  
  RETURN QUERY SELECT v_expired, v_low_importance, v_remaining;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. MEMORY STATS VIEW
-- Quick access to memory statistics per tenant
-- =============================================================================

CREATE OR REPLACE VIEW cato_memory_stats AS
SELECT 
  tenant_id,
  COUNT(*) as total_memories,
  COUNT(*) FILTER (WHERE category = 'episodic') as episodic_count,
  COUNT(*) FILTER (WHERE category = 'semantic') as semantic_count,
  COUNT(*) FILTER (WHERE category = 'procedural') as procedural_count,
  COUNT(*) FILTER (WHERE category = 'working') as working_count,
  AVG(importance) as avg_importance,
  SUM(access_count) as total_accesses,
  MIN(created_at) as oldest_memory,
  MAX(created_at) as newest_memory
FROM cato_global_memory
GROUP BY tenant_id;

COMMENT ON TABLE cato_global_memory IS 'Cato persistent memory storage - episodic, semantic, procedural, and working memory';
COMMENT ON TABLE cato_consciousness_state IS 'Current state of the Cato consciousness loop per tenant';
COMMENT ON TABLE cato_consciousness_config IS 'Configuration settings for the Cato consciousness loop';
COMMENT ON TABLE cato_consciousness_metrics IS 'Performance metrics for the Cato consciousness loop';
