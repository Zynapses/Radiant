-- RADIANT v5.12.4 - Persistence Guard
-- Global enforcement of data completeness for all persistent memory structures
-- Ensures atomic writes with integrity checks to prevent partial data on reboot

-- ============================================================================
-- 1. PERSISTENCE RECORDS (Central store for all persistent memory data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS persistence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Record identification
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(500) NOT NULL,
  
  -- Data with integrity
  data JSONB NOT NULL,
  checksum VARCHAR(64) NOT NULL, -- SHA-256
  
  -- Completeness tracking - CRITICAL for preventing partial reads
  is_complete BOOLEAN NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, table_name, record_id)
);

CREATE INDEX idx_persistence_records_tenant ON persistence_records(tenant_id);
CREATE INDEX idx_persistence_records_table ON persistence_records(table_name);
CREATE INDEX idx_persistence_records_complete ON persistence_records(is_complete) WHERE is_complete = false;
CREATE INDEX idx_persistence_records_lookup ON persistence_records(tenant_id, table_name, record_id);

-- RLS
ALTER TABLE persistence_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY persistence_records_tenant_isolation ON persistence_records
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 2. WRITE-AHEAD LOG (WAL) for crash recovery
-- ============================================================================

CREATE TABLE IF NOT EXISTS persistence_wal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Transaction tracking
  transaction_id VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('begin', 'prepare', 'commit', 'rollback', 'recovered')),
  
  -- Operations in this transaction
  operations JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_persistence_wal_tenant ON persistence_wal(tenant_id);
CREATE INDEX idx_persistence_wal_status ON persistence_wal(status) WHERE status = 'prepare';
CREATE INDEX idx_persistence_wal_transaction ON persistence_wal(transaction_id);

-- RLS
ALTER TABLE persistence_wal ENABLE ROW LEVEL SECURITY;

CREATE POLICY persistence_wal_tenant_isolation ON persistence_wal
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 3. INTEGRITY AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS persistence_integrity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- What was checked
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(500),
  
  -- Result
  check_type VARCHAR(50) NOT NULL CHECK (check_type IN (
    'checksum_mismatch', 'incomplete_record', 'recovery_success', 
    'recovery_failure', 'corruption_detected', 'validation_failure'
  )),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  
  -- Details
  expected_checksum VARCHAR(64),
  actual_checksum VARCHAR(64),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integrity_log_tenant ON persistence_integrity_log(tenant_id);
CREATE INDEX idx_integrity_log_severity ON persistence_integrity_log(severity) WHERE severity IN ('error', 'critical');
CREATE INDEX idx_integrity_log_type ON persistence_integrity_log(check_type);

-- RLS
ALTER TABLE persistence_integrity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY persistence_integrity_log_tenant_isolation ON persistence_integrity_log
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 4. FUNCTIONS FOR INTEGRITY CHECKING
-- ============================================================================

-- Function to check all records for a tenant
CREATE OR REPLACE FUNCTION check_persistence_integrity(p_tenant_id UUID)
RETURNS TABLE (
  table_name VARCHAR,
  total_records BIGINT,
  complete_records BIGINT,
  incomplete_records BIGINT,
  integrity_score DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.table_name,
    COUNT(*)::BIGINT as total_records,
    COUNT(*) FILTER (WHERE pr.is_complete = true)::BIGINT as complete_records,
    COUNT(*) FILTER (WHERE pr.is_complete = false)::BIGINT as incomplete_records,
    CASE 
      WHEN COUNT(*) = 0 THEN 100.00
      ELSE ROUND((COUNT(*) FILTER (WHERE pr.is_complete = true)::DECIMAL / COUNT(*)) * 100, 2)
    END as integrity_score
  FROM persistence_records pr
  WHERE pr.tenant_id = p_tenant_id
  GROUP BY pr.table_name;
END;
$$ LANGUAGE plpgsql;

-- Function to recover incomplete transactions
CREATE OR REPLACE FUNCTION recover_incomplete_transactions(p_tenant_id UUID)
RETURNS TABLE (
  transaction_id VARCHAR,
  status VARCHAR,
  operations_count INTEGER
) AS $$
BEGIN
  -- Find and mark incomplete transactions
  UPDATE persistence_wal
  SET status = 'recovered', completed_at = NOW()
  WHERE tenant_id = p_tenant_id AND status = 'prepare';
  
  -- Mark affected records as incomplete
  UPDATE persistence_records pr
  SET is_complete = false
  WHERE pr.tenant_id = p_tenant_id
  AND EXISTS (
    SELECT 1 FROM persistence_wal pw
    WHERE pw.tenant_id = p_tenant_id
    AND pw.status = 'recovered'
    AND pw.operations::text LIKE '%' || pr.record_id || '%'
  );
  
  RETURN QUERY
  SELECT 
    pw.transaction_id::VARCHAR,
    'recovered'::VARCHAR,
    COALESCE(jsonb_array_length(pw.operations), 0)::INTEGER
  FROM persistence_wal pw
  WHERE pw.tenant_id = p_tenant_id
  AND pw.status = 'recovered'
  AND pw.completed_at >= NOW() - INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql;

-- Function to get only complete records (for safe restoration)
CREATE OR REPLACE FUNCTION get_complete_records(
  p_tenant_id UUID,
  p_table_name VARCHAR
)
RETURNS TABLE (
  record_id VARCHAR,
  data JSONB,
  checksum VARCHAR,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.record_id::VARCHAR,
    pr.data,
    pr.checksum::VARCHAR,
    pr.updated_at
  FROM persistence_records pr
  WHERE pr.tenant_id = p_tenant_id
  AND pr.table_name = p_table_name
  AND pr.is_complete = true
  ORDER BY pr.updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. CLEANUP FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_persistence_data(p_retention_days INTEGER DEFAULT 30)
RETURNS TABLE (
  wal_deleted INTEGER,
  logs_deleted INTEGER
) AS $$
DECLARE
  v_wal_deleted INTEGER;
  v_logs_deleted INTEGER;
BEGIN
  -- Clean up old committed/recovered WAL entries
  DELETE FROM persistence_wal 
  WHERE status IN ('commit', 'rollback', 'recovered')
  AND completed_at < NOW() - (p_retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_wal_deleted = ROW_COUNT;
  
  -- Clean up old info-level integrity logs
  DELETE FROM persistence_integrity_log
  WHERE severity = 'info'
  AND created_at < NOW() - (p_retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_logs_deleted = ROW_COUNT;
  
  RETURN QUERY SELECT v_wal_deleted, v_logs_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. TRIGGER FOR AUTO-UPDATING TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_persistence_record_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_persistence_records_updated
  BEFORE UPDATE ON persistence_records
  FOR EACH ROW EXECUTE FUNCTION update_persistence_record_timestamp();

-- ============================================================================
-- 7. VIEW FOR INTEGRITY DASHBOARD
-- ============================================================================

CREATE OR REPLACE VIEW v_persistence_integrity_summary AS
SELECT
  tenant_id,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE is_complete = true) as complete_records,
  COUNT(*) FILTER (WHERE is_complete = false) as incomplete_records,
  ROUND(
    (COUNT(*) FILTER (WHERE is_complete = true)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
    2
  ) as integrity_percent,
  MAX(updated_at) as last_update
FROM persistence_records
GROUP BY tenant_id;

CREATE OR REPLACE VIEW v_persistence_wal_status AS
SELECT
  tenant_id,
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM persistence_wal
GROUP BY tenant_id, status;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE persistence_records IS 'Central store for all persistent memory data with integrity tracking';
COMMENT ON TABLE persistence_wal IS 'Write-ahead log for crash recovery of persistence transactions';
COMMENT ON TABLE persistence_integrity_log IS 'Audit log of integrity checks and recovery actions';
COMMENT ON COLUMN persistence_records.is_complete IS 'CRITICAL: Only true after checksum verification - prevents partial reads';
COMMENT ON COLUMN persistence_records.checksum IS 'SHA-256 checksum of data for integrity verification';
COMMENT ON FUNCTION check_persistence_integrity IS 'Check integrity status of all persistent records for a tenant';
COMMENT ON FUNCTION recover_incomplete_transactions IS 'Recover from incomplete transactions on startup';
COMMENT ON FUNCTION get_complete_records IS 'Get only complete (verified) records for safe restoration';
