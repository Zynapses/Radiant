-- Migration: 120_bobble_event_store.sql
-- EventStoreDB-style event sourcing for Bobble consciousness

-- ============================================================================
-- Event Store Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS bobble_event_store (
  event_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  stream_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  event_data JSONB NOT NULL,
  metadata JSONB NOT NULL,
  version BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique version per stream
  UNIQUE(tenant_id, stream_id, version)
);

-- Indexes for efficient querying
CREATE INDEX idx_bobble_events_tenant ON bobble_event_store(tenant_id);
CREATE INDEX idx_bobble_events_stream ON bobble_event_store(stream_id);
CREATE INDEX idx_bobble_events_type ON bobble_event_store(event_type);
CREATE INDEX idx_bobble_events_version ON bobble_event_store(tenant_id, stream_id, version);
CREATE INDEX idx_bobble_events_created ON bobble_event_store(created_at DESC);
CREATE INDEX idx_bobble_events_correlation ON bobble_event_store((metadata->>'correlationId'));

-- ============================================================================
-- Event Stream Snapshots (for projection optimization)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bobble_event_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  stream_id VARCHAR(255) NOT NULL,
  snapshot_type VARCHAR(100) NOT NULL,
  snapshot_data JSONB NOT NULL,
  last_event_version BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, stream_id, snapshot_type)
);

CREATE INDEX idx_bobble_snapshots_stream ON bobble_event_snapshots(tenant_id, stream_id);

-- ============================================================================
-- Event Subscriptions (for persistent subscriptions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bobble_event_subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  subscription_name VARCHAR(255) NOT NULL,
  stream_id VARCHAR(255) NOT NULL,
  last_processed_version BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, subscription_name)
);

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE bobble_event_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE bobble_event_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bobble_event_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY bobble_events_tenant_isolation ON bobble_event_store
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY bobble_snapshots_tenant_isolation ON bobble_event_snapshots
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY bobble_subscriptions_tenant_isolation ON bobble_event_subscriptions
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- Cleanup function
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_bobble_events(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM bobble_event_store
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE bobble_event_store IS 'Event sourcing store for Bobble consciousness events';
COMMENT ON TABLE bobble_event_snapshots IS 'Projection snapshots for efficient state reconstruction';
COMMENT ON TABLE bobble_event_subscriptions IS 'Persistent subscriptions for event consumers';
COMMENT ON COLUMN bobble_event_store.stream_id IS 'Event stream identifier (e.g., bobble-{tenantId}-heartbeat)';
COMMENT ON COLUMN bobble_event_store.version IS 'Monotonically increasing version within stream';
