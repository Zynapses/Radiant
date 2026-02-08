-- =============================================================================
-- RADIANT v7.43.0 — System Audit Remediation
-- =============================================================================
-- Migration: V2026_02_07_019
-- Description: Comprehensive fixes from system audit:
--   1. Change default retention from 30 to 180 days (6 months)
--   2. Add tenant_settings unified profile table
--   3. Add conversation_exports table for export tracking
--   4. Add consciousness_state_snapshots table for persistence
--   5. Add delight_event_history table for persistence
-- =============================================================================

-- =============================================================================
-- 1. DEFAULT RETENTION: 30 → 180 days
-- =============================================================================

-- Update the column default on tenants table
ALTER TABLE tenants 
  ALTER COLUMN retention_days SET DEFAULT 180;

-- Update any tenants still on the old 30-day default (unless explicitly set)
UPDATE tenants 
SET retention_days = 180 
WHERE retention_days = 30 
  AND NOT EXISTS (
    SELECT 1 FROM audit_logs 
    WHERE resource_type = 'tenant_settings' 
      AND action LIKE '%retention%'
      AND details->>'tenant_id' = tenants.id::text
  );

-- Update UDS config defaults for warm retention (90 → 180 days)
UPDATE uds_config 
SET warm_retention_days = 180 
WHERE warm_retention_days = 90
  AND tenant_id IS NULL;

-- =============================================================================
-- 2. UNIFIED TENANT SETTINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Retention Settings
  chat_retention_days INTEGER NOT NULL DEFAULT 180,
  file_retention_days INTEGER NOT NULL DEFAULT 180,
  audit_log_retention_days INTEGER NOT NULL DEFAULT 365,
  
  -- Storage Settings
  max_storage_gb NUMERIC(10,2) DEFAULT NULL,
  storage_tier_auto_promote BOOLEAN NOT NULL DEFAULT true,
  hot_to_warm_hours INTEGER NOT NULL DEFAULT 24,
  warm_to_cold_days INTEGER NOT NULL DEFAULT 180,
  cold_to_glacier_years INTEGER NOT NULL DEFAULT 7,
  
  -- AI Settings
  default_model_id TEXT,
  max_tokens_per_request INTEGER DEFAULT 8192,
  temperature_default NUMERIC(3,2) DEFAULT 0.7,
  enable_streaming BOOLEAN NOT NULL DEFAULT true,
  
  -- Feature Flags
  enable_collaboration BOOLEAN NOT NULL DEFAULT true,
  enable_file_upload BOOLEAN NOT NULL DEFAULT true,
  enable_conversation_export BOOLEAN NOT NULL DEFAULT true,
  enable_conversation_fork BOOLEAN NOT NULL DEFAULT true,
  
  -- Compliance
  compliance_frameworks TEXT[] DEFAULT '{}',
  data_classification_default TEXT NOT NULL DEFAULT 'INTERNAL',
  require_encryption BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID,
  
  CONSTRAINT uq_tenant_settings_tenant UNIQUE (tenant_id)
);

-- RLS
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_settings_isolation ON tenant_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Auto-create tenant_settings for existing tenants
INSERT INTO tenant_settings (tenant_id, chat_retention_days, file_retention_days)
SELECT id, COALESCE(retention_days, 180), COALESCE(retention_days, 180)
FROM tenants
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_settings WHERE tenant_settings.tenant_id = tenants.id
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Trigger to auto-create settings on new tenant
CREATE OR REPLACE FUNCTION auto_create_tenant_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tenant_settings (tenant_id, chat_retention_days, file_retention_days)
  VALUES (NEW.id, COALESCE(NEW.retention_days, 180), COALESCE(NEW.retention_days, 180))
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_create_tenant_settings ON tenants;
CREATE TRIGGER trg_auto_create_tenant_settings
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_tenant_settings();

-- =============================================================================
-- 3. CONVERSATION EXPORTS TABLE
-- =============================================================================

CREATE TYPE conversation_export_format AS ENUM ('json', 'markdown', 'pdf', 'zip');
CREATE TYPE conversation_export_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'expired');

CREATE TABLE IF NOT EXISTS conversation_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  
  format conversation_export_format NOT NULL DEFAULT 'json',
  status conversation_export_status NOT NULL DEFAULT 'pending',
  
  include_attachments BOOLEAN NOT NULL DEFAULT true,
  include_metadata BOOLEAN NOT NULL DEFAULT false,
  
  -- S3 storage
  s3_bucket TEXT,
  s3_key TEXT,
  file_size_bytes BIGINT,
  download_url TEXT,
  download_expires_at TIMESTAMPTZ,
  
  -- Processing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  message_count INTEGER DEFAULT 0,
  attachment_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

-- RLS
ALTER TABLE conversation_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversation_exports_isolation ON conversation_exports
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE INDEX idx_conversation_exports_tenant_user ON conversation_exports(tenant_id, user_id);
CREATE INDEX idx_conversation_exports_status ON conversation_exports(status) WHERE status IN ('pending', 'processing');

-- =============================================================================
-- 4. CONSCIOUSNESS STATE SNAPSHOTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS consciousness_state_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- State data (JSONB for flexibility)
  state_type TEXT NOT NULL, -- 'phi_metrics', 'integration_state', 'workspace_binding', etc.
  state_data JSONB NOT NULL,
  state_hash TEXT NOT NULL, -- SHA-256 of state_data for integrity
  
  -- Lifecycle
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restored_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  is_current BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  lambda_request_id TEXT,
  cold_start BOOLEAN DEFAULT false
);

-- Only keep the latest snapshot per tenant/type
CREATE UNIQUE INDEX idx_consciousness_snapshot_current 
  ON consciousness_state_snapshots(tenant_id, state_type) 
  WHERE is_current = true;

ALTER TABLE consciousness_state_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY consciousness_snapshots_isolation ON consciousness_state_snapshots
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Cleanup: keep only last 10 snapshots per tenant/type
CREATE OR REPLACE FUNCTION cleanup_old_consciousness_snapshots()
RETURNS void AS $$
BEGIN
  DELETE FROM consciousness_state_snapshots
  WHERE id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY tenant_id, state_type 
        ORDER BY snapshot_at DESC
      ) as rn
      FROM consciousness_state_snapshots
    ) ranked
    WHERE rn <= 10
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 5. DELIGHT EVENT HISTORY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS delight_event_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  plan_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delight_events_plan ON delight_event_history(tenant_id, plan_id, created_at DESC);

-- Auto-expire after 24 hours (events are ephemeral)
CREATE INDEX idx_delight_events_expiry ON delight_event_history(created_at) 
  WHERE created_at < NOW() - INTERVAL '24 hours';

-- =============================================================================
-- 6. INDEXES FOR PERFORMANCE
-- =============================================================================

-- Tenant settings lookup
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON tenant_settings(tenant_id);

-- Consciousness snapshots lookup
CREATE INDEX IF NOT EXISTS idx_consciousness_snapshots_lookup 
  ON consciousness_state_snapshots(tenant_id, state_type, snapshot_at DESC);

COMMENT ON TABLE tenant_settings IS 'Unified tenant settings/profile with retention, storage, AI, feature flags, and compliance configuration';
COMMENT ON TABLE conversation_exports IS 'Tracks conversation export requests with S3 storage for downloadable archives';
COMMENT ON TABLE consciousness_state_snapshots IS 'Periodic snapshots of consciousness engine state for cold-start resilience';
COMMENT ON TABLE delight_event_history IS 'Persisted delight workflow events for replay on reconnect';
