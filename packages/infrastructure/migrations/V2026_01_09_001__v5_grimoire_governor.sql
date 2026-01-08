-- ============================================================================
-- RADIANT v5.0.2 - The Grimoire & Economic Governor Schema
-- Migration: V2026_01_09_001
-- ============================================================================

-- 1. Enable Vector Extension (Required for pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. The Grimoire (Procedural Memory)
-- Stores "lessons learned" from successful AI executions
CREATE TABLE knowledge_heuristics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain VARCHAR(50) NOT NULL,
    
    -- The "Lesson" learned
    -- e.g., "When querying the 'sales' table, always join 'regions' on 'region_id'"
    heuristic_text TEXT NOT NULL, 
    
    -- Vector Search (1536 dimensions for text-embedding-3-small)
    context_embedding vector(1536), 
    
    -- Metadata
    confidence_score FLOAT DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    source_execution_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
    
    -- Constraint for ON CONFLICT deduplication
    -- Prevents duplicate heuristics per tenant/domain
    CONSTRAINT unique_heuristic_per_domain UNIQUE (tenant_id, domain, heuristic_text)
);

-- Add table comment
COMMENT ON TABLE knowledge_heuristics IS 'The Grimoire: Self-optimizing procedural memory for AI agents';

-- 3. Indexes (Separate statements for PostgreSQL compatibility)
CREATE INDEX idx_heuristics_tenant ON knowledge_heuristics(tenant_id);
CREATE INDEX idx_heuristics_domain ON knowledge_heuristics(domain);
CREATE INDEX idx_heuristics_expires ON knowledge_heuristics(expires_at);
CREATE INDEX idx_heuristics_created ON knowledge_heuristics(created_at DESC);
CREATE INDEX idx_heuristics_confidence ON knowledge_heuristics(confidence_score DESC);

-- Vector Index (IVFFlat for fast approximate nearest neighbor search)
-- lists=100 is optimal for tables up to ~1M rows
CREATE INDEX idx_heuristics_embedding ON knowledge_heuristics 
USING ivfflat (context_embedding vector_cosine_ops) WITH (lists = 100);

-- 4. RLS Policies
ALTER TABLE knowledge_heuristics ENABLE ROW LEVEL SECURITY;

-- Standard tenant isolation policy
CREATE POLICY heuristic_tenant_isolation ON knowledge_heuristics
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- System maintenance policy (for cleanup tasks)
-- Allows the system tenant to delete expired heuristics across all tenants
CREATE POLICY heuristic_system_maintenance ON knowledge_heuristics
    FOR DELETE USING (
        current_setting('app.current_tenant_id') = '00000000-0000-0000-0000-000000000000'
    );

-- 5. Governor Configuration (Add to existing table)
ALTER TABLE decision_domain_config 
ADD COLUMN IF NOT EXISTS governor_mode VARCHAR(20) DEFAULT 'balanced' 
CHECK (governor_mode IN ('performance', 'balanced', 'cost_saver', 'off'));

COMMENT ON COLUMN decision_domain_config.governor_mode IS 
'Economic Governor mode: performance (no intervention), balanced (default), cost_saver (aggressive downgrade), off (disabled)';

-- 6. Economic Governor Savings Tracking
CREATE TABLE governor_savings_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    execution_id VARCHAR(255) NOT NULL,
    original_model VARCHAR(100) NOT NULL,
    selected_model VARCHAR(100) NOT NULL,
    complexity_score INTEGER NOT NULL CHECK (complexity_score >= 1 AND complexity_score <= 10),
    estimated_original_cost DECIMAL(10,6),
    estimated_actual_cost DECIMAL(10,6),
    savings_amount DECIMAL(10,6),
    governor_mode VARCHAR(20) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_governor_savings_tenant ON governor_savings_log(tenant_id);
CREATE INDEX idx_governor_savings_created ON governor_savings_log(created_at DESC);
CREATE INDEX idx_governor_savings_mode ON governor_savings_log(governor_mode);

ALTER TABLE governor_savings_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY governor_savings_tenant_isolation ON governor_savings_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

COMMENT ON TABLE governor_savings_log IS 'Economic Governor: Tracks model routing decisions and cost savings';

-- 7. Grimoire Statistics View
CREATE OR REPLACE VIEW grimoire_statistics AS
SELECT 
    tenant_id,
    domain,
    COUNT(*) as total_heuristics,
    AVG(confidence_score) as avg_confidence,
    COUNT(*) FILTER (WHERE confidence_score >= 0.8) as high_confidence_count,
    COUNT(*) FILTER (WHERE expires_at < NOW() + INTERVAL '7 days') as expiring_soon,
    MAX(created_at) as last_heuristic_added,
    MAX(updated_at) as last_updated
FROM knowledge_heuristics
WHERE expires_at > NOW()
GROUP BY tenant_id, domain;

-- 8. Governor Statistics View
CREATE OR REPLACE VIEW governor_statistics AS
SELECT 
    tenant_id,
    governor_mode,
    COUNT(*) as total_decisions,
    AVG(complexity_score) as avg_complexity,
    SUM(savings_amount) as total_savings,
    COUNT(*) FILTER (WHERE selected_model != original_model) as model_swaps,
    COUNT(*) FILTER (WHERE selected_model = 'gpt-4o-mini') as downgrade_count,
    COUNT(*) FILTER (WHERE selected_model = 'gpt-4o') as upgrade_count,
    DATE_TRUNC('day', created_at) as day
FROM governor_savings_log
GROUP BY tenant_id, governor_mode, DATE_TRUNC('day', created_at);

-- 9. Audit trigger for heuristic changes
CREATE OR REPLACE FUNCTION audit_heuristic_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        tenant_id,
        action,
        resource_type,
        resource_id,
        details,
        created_at
    ) VALUES (
        COALESCE(NEW.tenant_id, OLD.tenant_id),
        TG_OP,
        'knowledge_heuristic',
        COALESCE(NEW.id, OLD.id),
        jsonb_build_object(
            'domain', COALESCE(NEW.domain, OLD.domain),
            'heuristic_preview', LEFT(COALESCE(NEW.heuristic_text, OLD.heuristic_text), 100),
            'confidence_score', COALESCE(NEW.confidence_score, OLD.confidence_score)
        ),
        NOW()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_heuristics
AFTER INSERT OR UPDATE OR DELETE ON knowledge_heuristics
FOR EACH ROW EXECUTE FUNCTION audit_heuristic_changes();

-- 10. Update timestamp trigger for heuristics
CREATE OR REPLACE FUNCTION update_heuristic_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_heuristic_timestamp
BEFORE UPDATE ON knowledge_heuristics
FOR EACH ROW EXECUTE FUNCTION update_heuristic_timestamp();
