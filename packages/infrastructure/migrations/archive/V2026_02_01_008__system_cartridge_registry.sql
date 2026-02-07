-- =============================================================================
-- System Cartridge Registry Migration
-- v6.1.0: Domain experts as system cartridges with full audit trail
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

CREATE TYPE cartridge_category AS ENUM ('general', 'domain_expert');
CREATE TYPE cartridge_thermal_state AS ENUM ('cold', 'warming', 'warm', 'hot');
CREATE TYPE system_cartridge_audit_action AS ENUM (
  'created', 'updated', 'deleted', 'enabled', 'disabled', 
  'thermal_state_changed', 'version_upgraded'
);

-- -----------------------------------------------------------------------------
-- Extend cartridges table with system cartridge fields
-- -----------------------------------------------------------------------------

ALTER TABLE cartridges 
  ADD COLUMN IF NOT EXISTS category cartridge_category DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS domain_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS domain_display_name VARCHAR(500),
  ADD COLUMN IF NOT EXISTS thermal_state cartridge_thermal_state DEFAULT 'cold',
  ADD COLUMN IF NOT EXISTS thermal_state_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_inference_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inference_count BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS registered_by UUID,
  ADD COLUMN IF NOT EXISTS registered_via VARCHAR(50),
  ADD COLUMN IF NOT EXISTS previous_version_id UUID,
  ADD COLUMN IF NOT EXISTS version_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS compliance_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS compliance_reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS compliance_notes TEXT;

-- Index for system cartridges
CREATE INDEX IF NOT EXISTS idx_cartridges_system_scope 
  ON cartridges(scope) WHERE scope = 'system';

CREATE INDEX IF NOT EXISTS idx_cartridges_category 
  ON cartridges(category);

CREATE INDEX IF NOT EXISTS idx_cartridges_domain_id 
  ON cartridges(domain_id) WHERE domain_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cartridges_thermal_state 
  ON cartridges(thermal_state);

-- -----------------------------------------------------------------------------
-- System Cartridge Audit Log (HIPAA/SOC2/GDPR compliant)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS system_cartridge_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cartridge_id UUID NOT NULL REFERENCES cartridges(id) ON DELETE CASCADE,
  action system_cartridge_audit_action NOT NULL,
  performed_by UUID NOT NULL,
  performed_by_email VARCHAR(255),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_state JSONB,
  new_state JSONB,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  compliance_flags TEXT[] DEFAULT '{}',
  
  -- Partition by month for efficient querying and retention
  created_month DATE GENERATED ALWAYS AS (date_trunc('month', performed_at)::date) STORED
) PARTITION BY RANGE (created_month);

-- Create partitions for current and next 12 months
DO $$
DECLARE
  partition_date DATE;
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  FOR i IN 0..12 LOOP
    partition_date := date_trunc('month', CURRENT_DATE + (i || ' months')::interval)::date;
    partition_name := 'system_cartridge_audit_log_' || to_char(partition_date, 'YYYY_MM');
    start_date := partition_date;
    end_date := (partition_date + interval '1 month')::date;
    
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF system_cartridge_audit_log 
         FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
      );
    END IF;
  END LOOP;
END $$;

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_system_cartridge_audit_cartridge_id 
  ON system_cartridge_audit_log(cartridge_id);

CREATE INDEX IF NOT EXISTS idx_system_cartridge_audit_action 
  ON system_cartridge_audit_log(action);

CREATE INDEX IF NOT EXISTS idx_system_cartridge_audit_performed_at 
  ON system_cartridge_audit_log(performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_cartridge_audit_performed_by 
  ON system_cartridge_audit_log(performed_by);

-- -----------------------------------------------------------------------------
-- Tenant Cartridge Visibility (toggle on/off per tenant)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tenant_cartridge_visibility (
  tenant_id UUID NOT NULL,
  cartridge_id UUID NOT NULL REFERENCES cartridges(id) ON DELETE CASCADE,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  disabled_at TIMESTAMPTZ,
  disabled_by UUID,
  disabled_reason TEXT,
  enabled_at TIMESTAMPTZ,
  enabled_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (tenant_id, cartridge_id)
);

-- Enable RLS
ALTER TABLE tenant_cartridge_visibility ENABLE ROW LEVEL SECURITY;

-- RLS policy for tenant isolation
CREATE POLICY tenant_cartridge_visibility_tenant_isolation 
  ON tenant_cartridge_visibility
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Index for visibility lookups
CREATE INDEX IF NOT EXISTS idx_tenant_cartridge_visibility_cartridge 
  ON tenant_cartridge_visibility(cartridge_id);

CREATE INDEX IF NOT EXISTS idx_tenant_cartridge_visibility_hidden 
  ON tenant_cartridge_visibility(tenant_id) WHERE is_visible = false;

-- -----------------------------------------------------------------------------
-- System Cartridge Thermal State Tracking
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS system_cartridge_thermal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cartridge_id UUID NOT NULL REFERENCES cartridges(id) ON DELETE CASCADE,
  previous_state cartridge_thermal_state,
  new_state cartridge_thermal_state NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger_reason VARCHAR(100), -- 'inference_spike', 'idle_timeout', 'manual', 'cold_start'
  inference_count_at_change BIGINT,
  
  -- Metrics at time of change
  avg_latency_ms DECIMAL(10, 2),
  p99_latency_ms DECIMAL(10, 2),
  error_rate DECIMAL(5, 4)
);

CREATE INDEX IF NOT EXISTS idx_system_cartridge_thermal_history_cartridge 
  ON system_cartridge_thermal_history(cartridge_id);

CREATE INDEX IF NOT EXISTS idx_system_cartridge_thermal_history_changed_at 
  ON system_cartridge_thermal_history(changed_at DESC);

-- -----------------------------------------------------------------------------
-- System Cartridge Inference Metrics
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS system_cartridge_inference_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cartridge_id UUID NOT NULL REFERENCES cartridges(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Metrics window (1-hour buckets)
  bucket_start TIMESTAMPTZ NOT NULL,
  bucket_end TIMESTAMPTZ NOT NULL,
  
  -- Inference stats
  inference_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  
  -- Latency stats
  avg_latency_ms DECIMAL(10, 2),
  min_latency_ms DECIMAL(10, 2),
  max_latency_ms DECIMAL(10, 2),
  p50_latency_ms DECIMAL(10, 2),
  p95_latency_ms DECIMAL(10, 2),
  p99_latency_ms DECIMAL(10, 2),
  
  -- Network types breakdown (for domain_expert cartridges)
  network_usage JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(cartridge_id, tenant_id, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_system_cartridge_metrics_cartridge 
  ON system_cartridge_inference_metrics(cartridge_id);

CREATE INDEX IF NOT EXISTS idx_system_cartridge_metrics_bucket 
  ON system_cartridge_inference_metrics(bucket_start DESC);

-- -----------------------------------------------------------------------------
-- Functions
-- -----------------------------------------------------------------------------

-- Function to log system cartridge audit events
CREATE OR REPLACE FUNCTION log_system_cartridge_audit(
  p_cartridge_id UUID,
  p_action system_cartridge_audit_action,
  p_performed_by UUID,
  p_performed_by_email VARCHAR(255) DEFAULT NULL,
  p_previous_state JSONB DEFAULT NULL,
  p_new_state JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_compliance_flags TEXT[] DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO system_cartridge_audit_log (
    cartridge_id, action, performed_by, performed_by_email,
    previous_state, new_state, reason,
    ip_address, user_agent, compliance_flags
  ) VALUES (
    p_cartridge_id, p_action, p_performed_by, p_performed_by_email,
    p_previous_state, p_new_state, p_reason,
    p_ip_address, p_user_agent, p_compliance_flags
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update thermal state with history tracking
CREATE OR REPLACE FUNCTION update_cartridge_thermal_state(
  p_cartridge_id UUID,
  p_new_state cartridge_thermal_state,
  p_trigger_reason VARCHAR(100) DEFAULT 'manual'
) RETURNS VOID AS $$
DECLARE
  v_current_state cartridge_thermal_state;
  v_inference_count BIGINT;
BEGIN
  -- Get current state
  SELECT thermal_state, inference_count 
  INTO v_current_state, v_inference_count
  FROM cartridges 
  WHERE id = p_cartridge_id;
  
  -- Skip if no change
  IF v_current_state = p_new_state THEN
    RETURN;
  END IF;
  
  -- Update cartridge
  UPDATE cartridges 
  SET thermal_state = p_new_state,
      thermal_state_changed_at = NOW()
  WHERE id = p_cartridge_id;
  
  -- Log history
  INSERT INTO system_cartridge_thermal_history (
    cartridge_id, previous_state, new_state, 
    trigger_reason, inference_count_at_change
  ) VALUES (
    p_cartridge_id, v_current_state, p_new_state,
    p_trigger_reason, v_inference_count
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check if a system cartridge is visible to a tenant
CREATE OR REPLACE FUNCTION is_system_cartridge_visible(
  p_cartridge_id UUID,
  p_tenant_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_is_visible BOOLEAN;
BEGIN
  -- Check if there's an explicit visibility entry
  SELECT is_visible INTO v_is_visible
  FROM tenant_cartridge_visibility
  WHERE cartridge_id = p_cartridge_id AND tenant_id = p_tenant_id;
  
  -- Default to visible if no explicit entry
  IF v_is_visible IS NULL THEN
    RETURN true;
  END IF;
  
  RETURN v_is_visible;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get visible system cartridges for a tenant
CREATE OR REPLACE FUNCTION get_visible_system_cartridges(
  p_tenant_id UUID
) RETURNS TABLE (
  cartridge_id UUID,
  name VARCHAR,
  category cartridge_category,
  domain_id VARCHAR,
  thermal_state cartridge_thermal_state
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.category,
    c.domain_id,
    c.thermal_state
  FROM cartridges c
  WHERE c.scope = 'system'
    AND c.status = 'active'
    AND c.archived_at IS NULL
    AND is_system_cartridge_visible(c.id, p_tenant_id);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to auto-cool idle cartridges (called by scheduler)
CREATE OR REPLACE FUNCTION auto_cool_idle_system_cartridges(
  p_idle_minutes INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Move hot → warm if idle for p_idle_minutes
  UPDATE cartridges
  SET thermal_state = 'warm',
      thermal_state_changed_at = NOW()
  WHERE scope = 'system'
    AND thermal_state = 'hot'
    AND last_inference_at < NOW() - (p_idle_minutes || ' minutes')::interval;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Move warm → cold if idle for 2x idle time
  UPDATE cartridges
  SET thermal_state = 'cold',
      thermal_state_changed_at = NOW()
  WHERE scope = 'system'
    AND thermal_state = 'warm'
    AND last_inference_at < NOW() - ((p_idle_minutes * 2) || ' minutes')::interval;
  
  GET DIAGNOSTICS v_count = v_count + ROW_COUNT;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Compliance Views
-- -----------------------------------------------------------------------------

-- View for compliance dashboard - system cartridge audit summary
CREATE OR REPLACE VIEW v_system_cartridge_audit_summary AS
SELECT 
  date_trunc('day', performed_at) AS audit_date,
  action,
  COUNT(*) as action_count,
  COUNT(DISTINCT cartridge_id) as unique_cartridges,
  COUNT(DISTINCT performed_by) as unique_admins,
  array_agg(DISTINCT unnested_flag) FILTER (WHERE unnested_flag IS NOT NULL) as compliance_frameworks
FROM system_cartridge_audit_log,
  LATERAL unnest(compliance_flags) AS unnested_flag
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- View for tenant visibility summary
CREATE OR REPLACE VIEW v_tenant_cartridge_visibility_summary AS
SELECT 
  c.id AS cartridge_id,
  c.name AS cartridge_name,
  c.category,
  c.domain_id,
  COUNT(DISTINCT tcv.tenant_id) FILTER (WHERE tcv.is_visible = false) AS hidden_by_tenants,
  COUNT(DISTINCT t.id) AS total_tenants,
  ROUND(
    100.0 * COUNT(DISTINCT tcv.tenant_id) FILTER (WHERE tcv.is_visible = false) / 
    NULLIF(COUNT(DISTINCT t.id), 0), 2
  ) AS hidden_percentage
FROM cartridges c
CROSS JOIN tenants t
LEFT JOIN tenant_cartridge_visibility tcv 
  ON tcv.cartridge_id = c.id AND tcv.tenant_id = t.id
WHERE c.scope = 'system'
  AND c.archived_at IS NULL
GROUP BY c.id, c.name, c.category, c.domain_id;

-- -----------------------------------------------------------------------------
-- Comments
-- -----------------------------------------------------------------------------

COMMENT ON TABLE system_cartridge_audit_log IS 
  'Audit trail for all system cartridge operations. Required for HIPAA, SOC2, GDPR compliance.';

COMMENT ON TABLE tenant_cartridge_visibility IS 
  'Per-tenant visibility toggles for system cartridges. Default is visible=true.';

COMMENT ON TABLE system_cartridge_thermal_history IS 
  'History of thermal state changes for performance analysis.';

COMMENT ON TABLE system_cartridge_inference_metrics IS 
  'Hourly inference metrics per cartridge per tenant.';

COMMENT ON COLUMN cartridges.category IS 
  'Cartridge category: general (mixed content) or domain_expert (7 neural networks per domain).';

COMMENT ON COLUMN cartridges.thermal_state IS 
  'Inference optimization state: cold (not loaded), warming (loading), warm (ready), hot (high demand).';
