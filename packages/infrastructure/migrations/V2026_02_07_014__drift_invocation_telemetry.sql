-- =============================================================================
-- V2026_02_07_014: Drift Invocation Telemetry (v7.37.0)
-- 
-- Records every model invocation for Genesis gate feedback.
-- Used by DriftAwareWeightingService.getGenesisDriftFeedback() to compute
-- real-time health scores (failure rate, reroute rate, latency) that Genesis
-- uses alongside static drift scores to decide stage advancement.
--
-- Partitioned by month for efficient cleanup of old telemetry data.
-- RLS enforced per tenant.
-- =============================================================================

-- Telemetry table: records every model invocation across all 52+ services
CREATE TABLE IF NOT EXISTS drift_invocation_telemetry (
  id              BIGSERIAL,
  tenant_id       UUID NOT NULL,
  model_id        TEXT NOT NULL,
  original_model_id TEXT NOT NULL,
  was_rerouted    BOOLEAN NOT NULL DEFAULT FALSE,
  success         BOOLEAN NOT NULL DEFAULT TRUE,
  latency_ms      DOUBLE PRECISION NOT NULL DEFAULT 0,
  tokens_used     INTEGER NOT NULL DEFAULT 0,
  cost_cents      DOUBLE PRECISION NOT NULL DEFAULT 0,
  invoked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, invoked_at)
) PARTITION BY RANGE (invoked_at);

-- Create monthly partitions for current and next 3 months
DO $$
DECLARE
  start_date DATE;
  end_date DATE;
  partition_name TEXT;
BEGIN
  FOR i IN 0..3 LOOP
    start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::interval);
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'drift_invocation_telemetry_' || TO_CHAR(start_date, 'YYYY_MM');
    
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF drift_invocation_telemetry
       FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );
  END LOOP;
END $$;

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_drift_telemetry_tenant_time 
  ON drift_invocation_telemetry (tenant_id, invoked_at DESC);

CREATE INDEX IF NOT EXISTS idx_drift_telemetry_model_time 
  ON drift_invocation_telemetry (tenant_id, model_id, invoked_at DESC);

CREATE INDEX IF NOT EXISTS idx_drift_telemetry_rerouted 
  ON drift_invocation_telemetry (tenant_id, was_rerouted, invoked_at DESC)
  WHERE was_rerouted = TRUE;

CREATE INDEX IF NOT EXISTS idx_drift_telemetry_failures 
  ON drift_invocation_telemetry (tenant_id, success, invoked_at DESC)
  WHERE success = FALSE;

-- RLS: tenant isolation
ALTER TABLE drift_invocation_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY drift_telemetry_tenant_isolation ON drift_invocation_telemetry
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Aggregation helper: compute Genesis feedback for a tenant over a time window
CREATE OR REPLACE FUNCTION get_genesis_drift_feedback(
  p_tenant_id UUID,
  p_window_hours INTEGER DEFAULT 1
)
RETURNS TABLE (
  total_invocations BIGINT,
  rerouted_invocations BIGINT,
  failed_invocations BIGINT,
  reroute_rate DOUBLE PRECISION,
  failure_rate DOUBLE PRECISION,
  avg_latency_ms DOUBLE PRECISION,
  overall_health_score DOUBLE PRECISION
)
LANGUAGE SQL STABLE
AS $$
  WITH stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE was_rerouted) AS rerouted,
      COUNT(*) FILTER (WHERE NOT success) AS failed,
      AVG(latency_ms) AS avg_lat
    FROM drift_invocation_telemetry
    WHERE tenant_id = p_tenant_id
      AND invoked_at >= NOW() - (p_window_hours || ' hours')::interval
  ),
  drift AS (
    SELECT COALESCE(AVG(current_drift_score), 1.0) AS avg_drift
    FROM model_weight_config
    WHERE tenant_id = p_tenant_id
  )
  SELECT
    s.total,
    s.rerouted,
    s.failed,
    CASE WHEN s.total > 0 THEN s.rerouted::double precision / s.total ELSE 0 END,
    CASE WHEN s.total > 0 THEN s.failed::double precision / s.total ELSE 0 END,
    COALESCE(s.avg_lat, 0),
    GREATEST(0, LEAST(1,
      0.40 * d.avg_drift +
      0.30 * (1 - CASE WHEN s.total > 0 THEN s.rerouted::double precision / s.total ELSE 0 END) +
      0.30 * (1 - CASE WHEN s.total > 0 THEN s.failed::double precision / s.total ELSE 0 END)
    ))
  FROM stats s, drift d;
$$;

-- Cleanup: auto-delete telemetry older than 7 days (called by scheduled Lambda)
CREATE OR REPLACE FUNCTION cleanup_drift_telemetry(p_retention_days INTEGER DEFAULT 7)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM drift_invocation_telemetry
  WHERE invoked_at < NOW() - (p_retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT ON drift_invocation_telemetry TO lambda_role;
GRANT EXECUTE ON FUNCTION get_genesis_drift_feedback TO lambda_role;
GRANT EXECUTE ON FUNCTION cleanup_drift_telemetry TO lambda_role;
