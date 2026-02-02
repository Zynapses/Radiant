-- ============================================================================
-- Cartridge Operations Schema (Time Machine Integration)
-- Long-running cartridge operations with checkpointing and resume
-- 
-- Version: 1.0.0
-- Date: 2026-02-01
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

CREATE TYPE cartridge_operation_type AS ENUM (
  'import',
  'export',
  'compile_rnir',
  'federation_sync',
  'bulk_export',
  'bulk_import',
  'migration',
  'validation'
);

CREATE TYPE cartridge_operation_status AS ENUM (
  'pending',
  'initializing',
  'in_progress',
  'paused',
  'checkpointing',
  'resuming',
  'completed',
  'failed',
  'cancelled',
  'rolled_back'
);

CREATE TYPE cartridge_step_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'failed',
  'skipped'
);

-- ----------------------------------------------------------------------------
-- Cartridge Operations Table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cartridge_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Initiator
  initiated_by VARCHAR(255) NOT NULL,
  
  -- Operation type and status
  operation_type cartridge_operation_type NOT NULL,
  status cartridge_operation_status NOT NULL DEFAULT 'pending',
  
  -- Progress
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_step TEXT,
  
  -- Target cartridges
  cartridge_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Parameters
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Priority (1-10)
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  
  -- Error handling
  error TEXT,
  error_details JSONB,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  
  -- Result
  result JSONB,
  
  -- Bytes tracking
  bytes_processed BIGINT DEFAULT 0,
  total_bytes BIGINT,
  
  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estimated_completion_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE cartridge_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY cartridge_operations_tenant_isolation ON cartridge_operations
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Indexes
CREATE INDEX idx_cartridge_operations_tenant ON cartridge_operations(tenant_id);
CREATE INDEX idx_cartridge_operations_status ON cartridge_operations(status, priority DESC) WHERE status IN ('pending', 'in_progress', 'paused');
CREATE INDEX idx_cartridge_operations_type ON cartridge_operations(tenant_id, operation_type);
CREATE INDEX idx_cartridge_operations_active ON cartridge_operations(tenant_id, status) WHERE status NOT IN ('completed', 'failed', 'cancelled', 'rolled_back');
CREATE INDEX idx_cartridge_operations_created ON cartridge_operations(tenant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- Operation Steps Table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cartridge_operation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES cartridge_operations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Step definition
  step_id VARCHAR(100) NOT NULL,
  step_name VARCHAR(255) NOT NULL,
  step_description TEXT,
  step_order INTEGER NOT NULL,
  
  -- Step properties
  is_checkpointable BOOLEAN NOT NULL DEFAULT false,
  is_rollbackable BOOLEAN NOT NULL DEFAULT false,
  estimated_duration_seconds INTEGER,
  
  -- Status
  status cartridge_step_status NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error
  error TEXT,
  
  -- Metadata
  metadata JSONB,
  
  CONSTRAINT operation_steps_unique UNIQUE (operation_id, step_id)
);

-- Enable RLS
ALTER TABLE cartridge_operation_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY cartridge_operation_steps_tenant_isolation ON cartridge_operation_steps
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Indexes
CREATE INDEX idx_operation_steps_operation ON cartridge_operation_steps(operation_id, step_order);
CREATE INDEX idx_operation_steps_tenant ON cartridge_operation_steps(tenant_id);

-- ----------------------------------------------------------------------------
-- Operation Checkpoints Table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cartridge_operation_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES cartridge_operations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Checkpoint location
  step_id VARCHAR(100) NOT NULL,
  step_progress INTEGER NOT NULL DEFAULT 0,
  
  -- Serialized state
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Partial artifacts
  partial_artifact_path TEXT,
  
  -- Integrity
  checksum VARCHAR(64) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE cartridge_operation_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY cartridge_operation_checkpoints_tenant_isolation ON cartridge_operation_checkpoints
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Indexes
CREATE INDEX idx_operation_checkpoints_operation ON cartridge_operation_checkpoints(operation_id, created_at DESC);
CREATE INDEX idx_operation_checkpoints_tenant ON cartridge_operation_checkpoints(tenant_id);

-- ----------------------------------------------------------------------------
-- Operation Events Table (for real-time updates)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cartridge_operation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES cartridge_operations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Event type
  event_type VARCHAR(50) NOT NULL, -- 'progress', 'step_complete', 'checkpoint', 'error', 'complete'
  
  -- Progress
  progress INTEGER,
  current_step TEXT,
  step_progress INTEGER,
  
  -- Message
  message TEXT,
  
  -- Timestamp
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE cartridge_operation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY cartridge_operation_events_tenant_isolation ON cartridge_operation_events
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Indexes
CREATE INDEX idx_operation_events_operation ON cartridge_operation_events(operation_id, timestamp DESC);
CREATE INDEX idx_operation_events_tenant ON cartridge_operation_events(tenant_id, timestamp DESC);

-- Cleanup old events (keep last 7 days)
CREATE INDEX idx_operation_events_cleanup ON cartridge_operation_events(timestamp) WHERE timestamp < NOW() - INTERVAL '7 days';

-- ----------------------------------------------------------------------------
-- Update trigger
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_cartridge_operations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cartridge_operations_update_timestamp
  BEFORE UPDATE ON cartridge_operations
  FOR EACH ROW
  EXECUTE FUNCTION update_cartridge_operations_timestamp();

-- ----------------------------------------------------------------------------
-- Helper function to get latest checkpoint
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_latest_checkpoint(p_operation_id UUID)
RETURNS cartridge_operation_checkpoints AS $$
  SELECT * FROM cartridge_operation_checkpoints
  WHERE operation_id = p_operation_id
  ORDER BY created_at DESC
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ----------------------------------------------------------------------------
-- Helper function to calculate estimated completion
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION estimate_operation_completion(p_operation_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_started_at TIMESTAMPTZ;
  v_progress INTEGER;
  v_elapsed_seconds NUMERIC;
  v_estimated_total_seconds NUMERIC;
BEGIN
  SELECT started_at, progress INTO v_started_at, v_progress
  FROM cartridge_operations WHERE id = p_operation_id;
  
  IF v_started_at IS NULL OR v_progress <= 0 THEN
    RETURN NULL;
  END IF;
  
  v_elapsed_seconds := EXTRACT(EPOCH FROM (NOW() - v_started_at));
  v_estimated_total_seconds := (v_elapsed_seconds / v_progress) * 100;
  
  RETURN v_started_at + (v_estimated_total_seconds * INTERVAL '1 second');
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------------------------
-- Dashboard stats view
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW cartridge_operations_dashboard AS
SELECT
  tenant_id,
  COUNT(*) FILTER (WHERE status IN ('pending', 'initializing', 'in_progress', 'paused', 'checkpointing', 'resuming')) as active_operations,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_operations,
  COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE) as completed_today,
  COUNT(*) FILTER (WHERE status = 'failed' AND completed_at >= CURRENT_DATE) as failed_today,
  jsonb_object_agg(operation_type, type_count) FILTER (WHERE type_count > 0) as by_type,
  jsonb_object_agg(status, status_count) FILTER (WHERE status_count > 0) as by_status
FROM (
  SELECT 
    tenant_id, 
    operation_type, 
    status,
    COUNT(*) as type_count,
    COUNT(*) as status_count
  FROM cartridge_operations
  WHERE created_at >= NOW() - INTERVAL '30 days'
  GROUP BY tenant_id, operation_type, status
) sub
GROUP BY tenant_id;

-- ----------------------------------------------------------------------------
-- Comments
-- ----------------------------------------------------------------------------

COMMENT ON TABLE cartridge_operations IS 'Long-running cartridge operations with Time Machine integration';
COMMENT ON TABLE cartridge_operation_steps IS 'Individual steps within a cartridge operation';
COMMENT ON TABLE cartridge_operation_checkpoints IS 'Checkpoints for resuming operations';
COMMENT ON TABLE cartridge_operation_events IS 'Real-time events for operation progress';
