-- RADIANT Snapshot Storage Manager
-- Persistent configuration for snapshot lifecycle, tiered storage, and policies
-- Version: 1.4.0

-- Snapshot storage configuration (per-tenant)
CREATE TABLE IF NOT EXISTS snapshot_storage_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Auto snapshot settings
    auto_snapshot_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_snapshot_schedule VARCHAR(50) NOT NULL DEFAULT '0 2 * * *', -- Cron expression
    auto_snapshot_type VARCHAR(20) NOT NULL DEFAULT 'full', -- full, aurora_only, dynamodb_only
    
    -- Retention
    retention_days INTEGER NOT NULL DEFAULT 365,
    max_snapshots_per_tier INTEGER NOT NULL DEFAULT 10,
    
    -- Pre-action snapshots
    pre_deployment_snapshot_enabled BOOLEAN NOT NULL DEFAULT true,
    pre_migration_snapshot_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    
    CONSTRAINT unique_tenant_snapshot_config UNIQUE (tenant_id)
);

-- Tier transition rules
CREATE TABLE IF NOT EXISTS snapshot_tier_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    from_tier VARCHAR(20) NOT NULL, -- hot, warm, cold, archive
    to_tier VARCHAR(20) NOT NULL,
    after_days INTEGER NOT NULL,
    
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_from_tier CHECK (from_tier IN ('hot', 'warm', 'cold', 'archive')),
    CONSTRAINT valid_to_tier CHECK (to_tier IN ('hot', 'warm', 'cold', 'archive')),
    CONSTRAINT unique_tier_transition UNIQUE (tenant_id, from_tier, to_tier)
);

-- Snapshot registry (tracks all snapshots across environments)
CREATE TABLE IF NOT EXISTS snapshot_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    snapshot_id VARCHAR(255) NOT NULL, -- e.g., radiant-prod-20260205-021500
    version VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    app_id VARCHAR(100) NOT NULL,
    environment VARCHAR(50) NOT NULL,
    
    snapshot_type VARCHAR(20) NOT NULL, -- full, aurora_only, dynamodb_only, schema_only, incremental
    status VARCHAR(20) NOT NULL DEFAULT 'creating', -- creating, available, restoring, deleting, failed, transitioning
    storage_tier VARCHAR(20) NOT NULL DEFAULT 'hot',
    
    -- AWS resource ARNs
    aurora_snapshot_arn TEXT,
    dynamodb_backup_arns JSONB DEFAULT '[]'::jsonb,
    s3_manifest_key TEXT,
    
    -- Metrics
    size_bytes BIGINT NOT NULL DEFAULT 0,
    table_count INTEGER NOT NULL DEFAULT 0,
    resource_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL,
    tier_transition_date TIMESTAMPTZ,
    last_restored_at TIMESTAMPTZ,
    restore_count INTEGER NOT NULL DEFAULT 0,
    
    -- Tags
    tags JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT unique_snapshot_id UNIQUE (tenant_id, snapshot_id)
);

-- Snapshot restore history
CREATE TABLE IF NOT EXISTS snapshot_restore_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    snapshot_id UUID NOT NULL REFERENCES snapshot_registry(id) ON DELETE CASCADE,
    
    restored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    restored_by UUID REFERENCES users(id),
    
    target_environment VARCHAR(50),
    restore_options JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    success BOOLEAN NOT NULL,
    duration_seconds INTEGER,
    restored_resources JSONB DEFAULT '[]'::jsonb,
    errors JSONB DEFAULT '[]'::jsonb,
    warnings JSONB DEFAULT '[]'::jsonb
);

-- Tier cost estimates (configurable per region)
CREATE TABLE IF NOT EXISTS snapshot_tier_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    tier VARCHAR(20) NOT NULL,
    region VARCHAR(20) NOT NULL DEFAULT 'us-east-1',
    
    cost_per_gb_month DECIMAL(10, 6) NOT NULL, -- e.g., 0.023 for S3 Standard
    retrieval_cost_per_gb DECIMAL(10, 6) NOT NULL DEFAULT 0, -- e.g., 0.01 for Glacier
    retrieval_time_hours DECIMAL(5, 2) NOT NULL DEFAULT 0, -- e.g., 12 for Glacier
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_tier CHECK (tier IN ('hot', 'warm', 'cold', 'archive')),
    CONSTRAINT unique_tier_region UNIQUE (tenant_id, tier, region)
);

-- Insert default tier transition rules for new tenants
CREATE OR REPLACE FUNCTION insert_default_snapshot_config()
RETURNS TRIGGER AS $$
BEGIN
    -- Default storage config
    INSERT INTO snapshot_storage_config (tenant_id)
    VALUES (NEW.id)
    ON CONFLICT DO NOTHING;
    
    -- Default tier rules
    INSERT INTO snapshot_tier_rules (tenant_id, from_tier, to_tier, after_days) VALUES
        (NEW.id, 'hot', 'warm', 7),
        (NEW.id, 'warm', 'cold', 30),
        (NEW.id, 'cold', 'archive', 365)
    ON CONFLICT DO NOTHING;
    
    -- Default cost estimates (US East 1)
    INSERT INTO snapshot_tier_costs (tenant_id, tier, region, cost_per_gb_month, retrieval_cost_per_gb, retrieval_time_hours) VALUES
        (NEW.id, 'hot', 'us-east-1', 0.023, 0, 0),
        (NEW.id, 'warm', 'us-east-1', 0.0125, 0.01, 0.083), -- 5 minutes
        (NEW.id, 'cold', 'us-east-1', 0.004, 0.02, 5),
        (NEW.id, 'archive', 'us-east-1', 0.00099, 0.03, 12)
    ON CONFLICT DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create default config for new tenants
DROP TRIGGER IF EXISTS trg_insert_default_snapshot_config ON tenants;
CREATE TRIGGER trg_insert_default_snapshot_config
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION insert_default_snapshot_config();

-- RLS policies
ALTER TABLE snapshot_storage_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_tier_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_restore_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_tier_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_snapshot_storage_config ON snapshot_storage_config
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_snapshot_tier_rules ON snapshot_tier_rules
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_snapshot_registry ON snapshot_registry
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_snapshot_restore_history ON snapshot_restore_history
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_snapshot_tier_costs ON snapshot_tier_costs
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Indexes
CREATE INDEX idx_snapshot_registry_tenant ON snapshot_registry(tenant_id);
CREATE INDEX idx_snapshot_registry_status ON snapshot_registry(status);
CREATE INDEX idx_snapshot_registry_tier ON snapshot_registry(storage_tier);
CREATE INDEX idx_snapshot_registry_created ON snapshot_registry(created_at DESC);
CREATE INDEX idx_snapshot_restore_history_snapshot ON snapshot_restore_history(snapshot_id);

COMMENT ON TABLE snapshot_storage_config IS 'Per-tenant snapshot storage configuration';
COMMENT ON TABLE snapshot_tier_rules IS 'Tier transition rules (Hot→Warm→Cold→Archive)';
COMMENT ON TABLE snapshot_registry IS 'Registry of all snapshots with metadata';
COMMENT ON TABLE snapshot_restore_history IS 'Audit log of snapshot restorations';
COMMENT ON TABLE snapshot_tier_costs IS 'Cost estimates per tier/region for billing';
