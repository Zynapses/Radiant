-- ============================================================================
-- Environment State Registry Migration
-- Version: 1.0.0
-- Created: 2026-01-28
-- Description: Database tables for tracking environment state, sync operations,
--              and backup/restore history.
-- ============================================================================

-- ============================================================================
-- Enum Types
-- ============================================================================

CREATE TYPE env_state_environment AS ENUM ('dev', 'staging', 'prod');
CREATE TYPE env_state_sync_status AS ENUM ('idle', 'syncing', 'completed', 'failed', 'conflict');
CREATE TYPE env_state_backup_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'expired');
CREATE TYPE env_state_backup_type AS ENUM ('full', 'incremental', 'scheduled', 'pre_deploy', 'manual');
CREATE TYPE env_state_resource_health AS ENUM ('healthy', 'degraded', 'unhealthy', 'unknown');
CREATE TYPE env_state_data_sensitivity AS ENUM ('public', 'internal', 'confidential', 'restricted');

-- ============================================================================
-- Environment Manifests
-- ============================================================================

CREATE TABLE IF NOT EXISTS environment_state_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Environment & Version
    environment env_state_environment NOT NULL,
    version VARCHAR(50) NOT NULL,
    schema_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    radiant_version VARCHAR(20) NOT NULL,
    
    -- Capture Info
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    captured_by VARCHAR(255) NOT NULL,
    capture_source VARCHAR(50) DEFAULT 'manual', -- manual, scheduled, auto
    
    -- Manifest Data (stored as JSONB for flexibility)
    infrastructure JSONB NOT NULL DEFAULT '{}',
    persistent_data JSONB NOT NULL DEFAULT '[]',
    features JSONB NOT NULL DEFAULT '{}',
    health JSONB NOT NULL DEFAULT '{}',
    
    -- Checksums
    checksum_infrastructure VARCHAR(64),
    checksum_persistent_data VARCHAR(64),
    checksum_features VARCHAR(64),
    checksum_full VARCHAR(64) NOT NULL,
    
    -- Change Tracking
    previous_version_id UUID REFERENCES environment_state_manifests(id),
    changes_since_last JSONB DEFAULT '{}',
    
    -- Metadata
    is_current BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(tenant_id, environment, version)
);

-- Index for fast current manifest lookup
CREATE INDEX idx_env_manifests_current 
    ON environment_state_manifests(tenant_id, environment, is_current) 
    WHERE is_current = true;

-- Index for history queries
CREATE INDEX idx_env_manifests_history 
    ON environment_state_manifests(tenant_id, environment, captured_at DESC);

-- Index for checksum lookups
CREATE INDEX idx_env_manifests_checksum 
    ON environment_state_manifests(checksum_full);

-- ============================================================================
-- Sync Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS environment_sync_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    environment env_state_environment NOT NULL,
    
    -- Sync Settings
    sync_enabled BOOLEAN NOT NULL DEFAULT false,
    sync_infrastructure BOOLEAN NOT NULL DEFAULT false,
    sync_persistent_data BOOLEAN NOT NULL DEFAULT true,
    sync_feature_flags BOOLEAN NOT NULL DEFAULT true,
    sync_secrets BOOLEAN NOT NULL DEFAULT false,
    
    -- Data Item Filters
    included_data_items JSONB NOT NULL DEFAULT '[]',
    excluded_data_items JSONB NOT NULL DEFAULT '["audit_merkle", "cato_safety_log", "user_analytics"]',
    
    -- Safety Settings
    require_confirmation BOOLEAN NOT NULL DEFAULT true,
    allow_destructive BOOLEAN NOT NULL DEFAULT false,
    require_approval BOOLEAN NOT NULL DEFAULT false,
    approvers JSONB DEFAULT '[]',
    
    -- Automation
    auto_sync_enabled BOOLEAN NOT NULL DEFAULT false,
    auto_sync_source_env env_state_environment,
    auto_sync_schedule VARCHAR(100), -- cron expression
    last_auto_sync_at TIMESTAMPTZ,
    
    -- Notifications
    notify_on_sync BOOLEAN NOT NULL DEFAULT true,
    notify_on_conflict BOOLEAN NOT NULL DEFAULT true,
    notification_channels JSONB NOT NULL DEFAULT '["email"]',
    notification_recipients JSONB DEFAULT '[]',
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    -- Constraints
    UNIQUE(tenant_id, environment)
);

-- ============================================================================
-- Sync Operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS environment_sync_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Operation Info
    source_environment env_state_environment NOT NULL,
    target_environment env_state_environment NOT NULL,
    source_manifest_id UUID REFERENCES environment_state_manifests(id),
    target_manifest_id UUID REFERENCES environment_state_manifests(id),
    
    -- Configuration
    sync_infrastructure BOOLEAN NOT NULL DEFAULT false,
    sync_data BOOLEAN NOT NULL DEFAULT true,
    sync_features BOOLEAN NOT NULL DEFAULT true,
    data_items_to_sync JSONB NOT NULL DEFAULT '[]',
    
    -- Status
    status env_state_sync_status NOT NULL DEFAULT 'idle',
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    initiated_by VARCHAR(255) NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Progress
    progress_phase VARCHAR(50) DEFAULT 'preparing',
    progress_percent INTEGER DEFAULT 0,
    progress_current_item VARCHAR(255),
    progress_items_completed INTEGER DEFAULT 0,
    progress_items_total INTEGER DEFAULT 0,
    progress_bytes_transferred BIGINT DEFAULT 0,
    
    -- Results
    items_synced INTEGER DEFAULT 0,
    items_skipped INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    conflicts JSONB DEFAULT '[]',
    warnings JSONB DEFAULT '[]',
    errors JSONB DEFAULT '[]',
    
    -- Post-sync
    resulting_manifest_id UUID REFERENCES environment_state_manifests(id),
    rollback_manifest_id UUID REFERENCES environment_state_manifests(id),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CHECK(source_environment != target_environment)
);

-- Index for operation lookups
CREATE INDEX idx_sync_operations_status 
    ON environment_sync_operations(tenant_id, status, initiated_at DESC);

-- Index for environment-specific operations
CREATE INDEX idx_sync_operations_env 
    ON environment_sync_operations(tenant_id, target_environment, initiated_at DESC);

-- ============================================================================
-- Backups
-- ============================================================================

CREATE TABLE IF NOT EXISTS environment_state_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Backup Info
    environment env_state_environment NOT NULL,
    backup_type env_state_backup_type NOT NULL DEFAULT 'manual',
    status env_state_backup_status NOT NULL DEFAULT 'pending',
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Manifest Reference
    state_manifest_id UUID REFERENCES environment_state_manifests(id),
    state_manifest_version VARCHAR(50),
    
    -- Content
    includes_infrastructure BOOLEAN NOT NULL DEFAULT true,
    includes_database BOOLEAN NOT NULL DEFAULT true,
    includes_s3 BOOLEAN NOT NULL DEFAULT true,
    includes_secrets BOOLEAN NOT NULL DEFAULT false,
    includes_feature_flags BOOLEAN NOT NULL DEFAULT true,
    
    -- Storage
    storage_location VARCHAR(500) NOT NULL,
    storage_class VARCHAR(50) DEFAULT 'STANDARD',
    total_size_bytes BIGINT DEFAULT 0,
    component_sizes JSONB DEFAULT '{}',
    
    -- Checksums
    checksum_manifest VARCHAR(64),
    checksum_full VARCHAR(64),
    
    -- Restore Info
    restore_count INTEGER DEFAULT 0,
    last_restored_at TIMESTAMPTZ,
    last_restored_by VARCHAR(255),
    last_restored_to env_state_environment,
    
    -- Metadata
    description TEXT,
    tags JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for backup lookups
CREATE INDEX idx_backups_env 
    ON environment_state_backups(tenant_id, environment, created_at DESC);

-- Index for status queries
CREATE INDEX idx_backups_status 
    ON environment_state_backups(tenant_id, status, expires_at);

-- ============================================================================
-- Restore Operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS environment_restore_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Restore Info
    backup_id UUID NOT NULL REFERENCES environment_state_backups(id),
    target_environment env_state_environment NOT NULL,
    
    -- Status
    status env_state_backup_status NOT NULL DEFAULT 'pending',
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    initiated_by VARCHAR(255) NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Configuration
    restore_items JSONB DEFAULT '[]', -- Specific items to restore, empty = all
    skip_items JSONB DEFAULT '[]',    -- Items to skip
    overwrite_existing BOOLEAN NOT NULL DEFAULT false,
    
    -- Progress
    progress_phase VARCHAR(50) DEFAULT 'validating',
    progress_percent INTEGER DEFAULT 0,
    progress_current_item VARCHAR(255),
    items_restored INTEGER DEFAULT 0,
    items_skipped INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    bytes_restored BIGINT DEFAULT 0,
    
    -- Results
    errors JSONB DEFAULT '[]',
    warnings JSONB DEFAULT '[]',
    
    -- Pre-restore state
    pre_restore_manifest_id UUID REFERENCES environment_state_manifests(id),
    post_restore_manifest_id UUID REFERENCES environment_state_manifests(id),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for restore lookups
CREATE INDEX idx_restore_operations_env 
    ON environment_restore_operations(tenant_id, target_environment, initiated_at DESC);

-- ============================================================================
-- Persistent Data Registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS environment_persistent_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    environment env_state_environment NOT NULL,
    
    -- Data Item Identity
    data_item_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Type & Location
    data_type VARCHAR(50) NOT NULL, -- database, s3, secret, config
    location VARCHAR(500) NOT NULL,
    category VARCHAR(50) NOT NULL,
    
    -- Sensitivity
    sensitivity env_state_data_sensitivity NOT NULL DEFAULT 'internal',
    contains_pii BOOLEAN NOT NULL DEFAULT false,
    contains_phi BOOLEAN NOT NULL DEFAULT false,
    encryption_required BOOLEAN NOT NULL DEFAULT true,
    
    -- Dependencies
    depends_on JSONB DEFAULT '[]',
    required_for JSONB DEFAULT '[]',
    
    -- Sync Configuration
    include_in_sync BOOLEAN NOT NULL DEFAULT true,
    sync_priority INTEGER DEFAULT 50,
    estimated_sync_seconds INTEGER DEFAULT 0,
    
    -- Current State
    size_bytes BIGINT DEFAULT 0,
    record_count BIGINT DEFAULT 0,
    last_modified_at TIMESTAMPTZ,
    checksum VARCHAR(64),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(tenant_id, environment, data_item_id)
);

-- Index for data item lookups
CREATE INDEX idx_persistent_data_item 
    ON environment_persistent_data(tenant_id, data_item_id);

-- Index for sync queries
CREATE INDEX idx_persistent_data_sync 
    ON environment_persistent_data(tenant_id, environment, include_in_sync) 
    WHERE include_in_sync = true;

-- ============================================================================
-- Audit Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS environment_state_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Action Info
    action VARCHAR(50) NOT NULL, -- capture, sync, backup, restore, config_change
    environment env_state_environment NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    performed_by VARCHAR(255) NOT NULL,
    
    -- Details
    action_details JSONB NOT NULL DEFAULT '{}',
    affected_items JSONB DEFAULT '[]',
    
    -- References
    manifest_id UUID REFERENCES environment_state_manifests(id),
    sync_operation_id UUID REFERENCES environment_sync_operations(id),
    backup_id UUID REFERENCES environment_state_backups(id),
    restore_operation_id UUID REFERENCES environment_restore_operations(id),
    
    -- Result
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX idx_state_audit_log_action 
    ON environment_state_audit_log(tenant_id, action, performed_at DESC);

-- Index for user audit
CREATE INDEX idx_state_audit_log_user 
    ON environment_state_audit_log(tenant_id, performed_by, performed_at DESC);

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_env_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER trg_env_manifests_updated_at
    BEFORE UPDATE ON environment_state_manifests
    FOR EACH ROW EXECUTE FUNCTION update_env_state_updated_at();

CREATE TRIGGER trg_sync_config_updated_at
    BEFORE UPDATE ON environment_sync_config
    FOR EACH ROW EXECUTE FUNCTION update_env_state_updated_at();

CREATE TRIGGER trg_sync_operations_updated_at
    BEFORE UPDATE ON environment_sync_operations
    FOR EACH ROW EXECUTE FUNCTION update_env_state_updated_at();

CREATE TRIGGER trg_backups_updated_at
    BEFORE UPDATE ON environment_state_backups
    FOR EACH ROW EXECUTE FUNCTION update_env_state_updated_at();

CREATE TRIGGER trg_restore_operations_updated_at
    BEFORE UPDATE ON environment_restore_operations
    FOR EACH ROW EXECUTE FUNCTION update_env_state_updated_at();

CREATE TRIGGER trg_persistent_data_updated_at
    BEFORE UPDATE ON environment_persistent_data
    FOR EACH ROW EXECUTE FUNCTION update_env_state_updated_at();

-- Function to ensure only one current manifest per environment
CREATE OR REPLACE FUNCTION ensure_single_current_manifest()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_current = true THEN
        UPDATE environment_state_manifests 
        SET is_current = false, updated_at = NOW()
        WHERE tenant_id = NEW.tenant_id 
          AND environment = NEW.environment 
          AND id != NEW.id 
          AND is_current = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_single_current_manifest
    BEFORE INSERT OR UPDATE OF is_current ON environment_state_manifests
    FOR EACH ROW
    WHEN (NEW.is_current = true)
    EXECUTE FUNCTION ensure_single_current_manifest();

-- Function to auto-log state changes
CREATE OR REPLACE FUNCTION log_env_state_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO environment_state_audit_log (
        tenant_id, action, environment, performed_by, action_details, manifest_id
    ) VALUES (
        NEW.tenant_id,
        'capture',
        NEW.environment,
        NEW.captured_by,
        jsonb_build_object(
            'version', NEW.version,
            'schema_version', NEW.schema_version,
            'checksum', NEW.checksum_full
        ),
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_manifest_capture
    AFTER INSERT ON environment_state_manifests
    FOR EACH ROW EXECUTE FUNCTION log_env_state_change();

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE environment_state_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_sync_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_sync_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_state_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_restore_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_persistent_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_state_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (tenant isolation)
CREATE POLICY env_manifests_tenant_policy ON environment_state_manifests
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY sync_config_tenant_policy ON environment_sync_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY sync_operations_tenant_policy ON environment_sync_operations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY backups_tenant_policy ON environment_state_backups
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY restore_operations_tenant_policy ON environment_restore_operations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY persistent_data_tenant_policy ON environment_persistent_data
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY audit_log_tenant_policy ON environment_state_audit_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- Initial Data
-- ============================================================================

-- Default persistent data items template (inserted on first use per tenant)
COMMENT ON TABLE environment_persistent_data IS 
'Registry of persistent data items that can be included/excluded from sync operations. 
Default items are created when the tenant first accesses the state registry.';

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE environment_state_manifests IS 
'Captures point-in-time snapshots of environment state including infrastructure, persistent data, and features.';

COMMENT ON TABLE environment_sync_config IS 
'Per-environment configuration for sync operations including data inclusion/exclusion and safety settings.';

COMMENT ON TABLE environment_sync_operations IS 
'Tracks sync operations between environments with progress, results, and rollback information.';

COMMENT ON TABLE environment_state_backups IS 
'Backup manifests for environment state with restore tracking.';

COMMENT ON TABLE environment_restore_operations IS 
'Tracks restore operations from backups with progress and results.';

COMMENT ON TABLE environment_persistent_data IS 
'Registry of persistent data items with metadata for selective sync operations.';

COMMENT ON TABLE environment_state_audit_log IS 
'Audit trail of all state registry operations including captures, syncs, backups, and restores.';
