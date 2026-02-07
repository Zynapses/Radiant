-- ============================================================================
-- RADIANT v4.18.0 — Log Retention Advanced: Reports, Glacier Restore,
--                    Bulk Export, Merkle Verification, GDPR Erasure
-- Migration: V2026_02_07_010
-- ============================================================================

SET search_path TO public;
SET app.current_tenant_id TO '00000000-0000-0000-0000-000000000000';

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

CREATE TYPE log_report_type AS ENUM (
  'compliance_summary',
  'retention_audit',
  'storage_forecast',
  'source_coverage',
  'gdpr_data_map',
  'custom'
);

CREATE TYPE log_report_status AS ENUM (
  'pending', 'generating', 'completed', 'failed', 'archived'
);

CREATE TYPE log_job_status AS ENUM (
  'pending', 'in_progress', 'completed', 'failed', 'cancelled', 'expired'
);

CREATE TYPE log_export_format AS ENUM (
  'json', 'csv', 'json_lines', 'parquet'
);

CREATE TYPE log_erasure_status AS ENUM (
  'requested', 'approved', 'in_progress', 'completed', 'failed', 'rejected'
);

-- ============================================================================
-- 2. LOG REPORTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  report_type       log_report_type NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,

  -- Config
  parameters        JSONB NOT NULL DEFAULT '{}',
  date_range_start  TIMESTAMPTZ,
  date_range_end    TIMESTAMPTZ,
  categories        log_category[] DEFAULT '{}',
  compliance_keys   TEXT[] DEFAULT '{}',

  -- Execution
  status            log_report_status NOT NULL DEFAULT 'pending',
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  error_message     TEXT,
  duration_ms       INTEGER,

  -- Output
  summary           JSONB,
  findings          JSONB DEFAULT '[]',
  recommendations   JSONB DEFAULT '[]',
  s3_bucket         TEXT,
  s3_key            TEXT,
  file_size_bytes   BIGINT,
  page_count        INTEGER,

  -- Schedule
  is_scheduled      BOOLEAN NOT NULL DEFAULT false,
  schedule_cron     TEXT,
  next_scheduled_at TIMESTAMPTZ,

  -- Audit
  generated_by      TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_log_reports_tenant ON log_reports(tenant_id, status);
CREATE INDEX idx_log_reports_type ON log_reports(report_type, status);
CREATE INDEX idx_log_reports_created ON log_reports(created_at DESC);
CREATE INDEX idx_log_reports_scheduled ON log_reports(is_scheduled, next_scheduled_at) WHERE is_scheduled = true;

-- ============================================================================
-- 3. GLACIER RESTORE JOBS
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_glacier_restore_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,

  -- What to restore
  restore_type      TEXT NOT NULL DEFAULT 'selective',  -- 'selective', 'category', 'date_range', 'full'
  categories        log_category[] DEFAULT '{}',
  date_range_start  TIMESTAMPTZ,
  date_range_end    TIMESTAMPTZ,
  log_index_ids     UUID[] DEFAULT '{}',

  -- Glacier config
  retrieval_tier    TEXT NOT NULL DEFAULT 'Standard',   -- 'Expedited' (1-5min), 'Standard' (3-5hr), 'Bulk' (5-12hr)
  glacier_vault     TEXT,

  -- Progress
  status            log_job_status NOT NULL DEFAULT 'pending',
  total_archives    INTEGER NOT NULL DEFAULT 0,
  restored_archives INTEGER NOT NULL DEFAULT 0,
  failed_archives   INTEGER NOT NULL DEFAULT 0,
  total_bytes       BIGINT NOT NULL DEFAULT 0,
  restored_bytes    BIGINT NOT NULL DEFAULT 0,
  progress_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Restored output
  restored_s3_bucket TEXT,
  restored_s3_prefix TEXT,
  restored_expires_at TIMESTAMPTZ,       -- Glacier restores are temporary

  -- Timing
  estimated_ready_at TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  error_message     TEXT,

  -- Audit
  requested_by      TEXT NOT NULL,
  request_reason    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_glacier_restore_tenant ON log_glacier_restore_jobs(tenant_id, status);
CREATE INDEX idx_glacier_restore_status ON log_glacier_restore_jobs(status) WHERE status IN ('pending', 'in_progress');

-- ============================================================================
-- 4. LOG EXPORT JOBS
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_export_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,

  -- Scope
  export_name       TEXT NOT NULL,
  categories        log_category[] DEFAULT '{}',
  date_range_start  TIMESTAMPTZ,
  date_range_end    TIMESTAMPTZ,
  include_all_time  BOOLEAN NOT NULL DEFAULT false,
  search_query      TEXT,
  format            log_export_format NOT NULL DEFAULT 'json_lines',

  -- Progress
  status            log_job_status NOT NULL DEFAULT 'pending',
  total_entries     INTEGER NOT NULL DEFAULT 0,
  exported_entries  INTEGER NOT NULL DEFAULT 0,
  total_bytes       BIGINT NOT NULL DEFAULT 0,
  progress_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Output
  s3_bucket         TEXT,
  s3_key            TEXT,
  download_url      TEXT,
  download_expires_at TIMESTAMPTZ,
  file_size_bytes   BIGINT,
  file_count        INTEGER DEFAULT 1,

  -- Sources
  includes_hot      BOOLEAN NOT NULL DEFAULT true,
  includes_warm     BOOLEAN NOT NULL DEFAULT true,
  includes_cold     BOOLEAN NOT NULL DEFAULT false,
  includes_deep     BOOLEAN NOT NULL DEFAULT false,
  glacier_restore_job_id UUID REFERENCES log_glacier_restore_jobs(id),

  -- Timing
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  error_message     TEXT,
  duration_ms       INTEGER,

  -- Audit
  requested_by      TEXT NOT NULL,
  request_reason    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_export_jobs_tenant ON log_export_jobs(tenant_id, status);
CREATE INDEX idx_export_jobs_status ON log_export_jobs(status) WHERE status IN ('pending', 'in_progress');

-- ============================================================================
-- 5. MERKLE VERIFICATION CHAIN
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_merkle_chain (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_index_id      UUID NOT NULL REFERENCES log_index(id),
  sequence_number   BIGINT NOT NULL,

  -- Hash chain
  entry_hash        TEXT NOT NULL,             -- SHA-256 of the archived log data
  previous_hash     TEXT,                      -- Hash of previous chain entry (NULL for genesis)
  merkle_root       TEXT NOT NULL,             -- Running Merkle root including this entry
  chain_length      BIGINT NOT NULL,

  -- Metadata
  category          log_category NOT NULL,
  window_start      TIMESTAMPTZ NOT NULL,
  window_end        TIMESTAMPTZ NOT NULL,
  source_id         UUID NOT NULL,
  byte_size         BIGINT NOT NULL,

  -- Verification
  last_verified_at  TIMESTAMPTZ,
  verified_by       TEXT,
  verification_status TEXT DEFAULT 'unverified',  -- 'unverified', 'valid', 'tampered', 'missing'

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_merkle_chain_sequence ON log_merkle_chain(sequence_number);
CREATE INDEX idx_merkle_chain_log_index ON log_merkle_chain(log_index_id);
CREATE INDEX idx_merkle_chain_category ON log_merkle_chain(category, sequence_number);
CREATE INDEX idx_merkle_chain_verification ON log_merkle_chain(verification_status) WHERE verification_status != 'valid';

-- ============================================================================
-- 6. GDPR LOG ERASURE REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_erasure_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,

  -- What to erase
  target_user_id    UUID,                      -- Specific user's logs (right to erasure)
  target_tenant_id  UUID,                      -- Specific tenant's logs
  categories        log_category[] NOT NULL,   -- Which categories to erase
  date_range_start  TIMESTAMPTZ,
  date_range_end    TIMESTAMPTZ,

  -- Exemptions
  exempt_categories log_category[] DEFAULT '{}',  -- Categories that CANNOT be erased (e.g., audit under HIPAA)
  exemption_reasons JSONB DEFAULT '{}',

  -- Compliance
  compliance_keys   TEXT[] DEFAULT '{}',
  legal_basis       TEXT,
  data_subject_request_id TEXT,

  -- Progress
  status            log_erasure_status NOT NULL DEFAULT 'requested',
  total_entries     INTEGER NOT NULL DEFAULT 0,
  erased_entries    INTEGER NOT NULL DEFAULT 0,
  exempt_entries    INTEGER NOT NULL DEFAULT 0,
  progress_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Verification
  erasure_certificate_hash TEXT,               -- SHA-256 proving erasure occurred
  erasure_log       JSONB DEFAULT '[]',        -- Detailed log of what was erased

  -- Approval
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  rejection_reason  TEXT,

  -- Timing
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  error_message     TEXT,

  -- Audit
  requested_by      TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_erasure_tenant ON log_erasure_requests(tenant_id, status);
CREATE INDEX idx_erasure_status ON log_erasure_requests(status) WHERE status IN ('requested', 'approved', 'in_progress');
CREATE INDEX idx_erasure_user ON log_erasure_requests(target_user_id) WHERE target_user_id IS NOT NULL;

-- ============================================================================
-- 7. HOT LOG SEARCH INDEX (for real-time search across hot-tier logs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_search_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID,
  source_id         UUID REFERENCES log_source_registry(id),
  category          log_category NOT NULL,

  -- Search content
  timestamp         TIMESTAMPTZ NOT NULL,
  level             TEXT NOT NULL DEFAULT 'info',
  service           TEXT NOT NULL,
  message           TEXT NOT NULL,
  request_id        TEXT,
  user_id           TEXT,
  metadata          JSONB DEFAULT '{}',

  -- Full-text search
  search_vector     TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(service, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(message, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(level, '')), 'C')
  ) STORED,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_log_search_ts ON log_search_entries(timestamp DESC);
CREATE INDEX idx_log_search_tenant ON log_search_entries(tenant_id, timestamp DESC);
CREATE INDEX idx_log_search_category ON log_search_entries(category, timestamp DESC);
CREATE INDEX idx_log_search_level ON log_search_entries(level, timestamp DESC);
CREATE INDEX idx_log_search_service ON log_search_entries(service, timestamp DESC);
CREATE INDEX idx_log_search_fts ON log_search_entries USING gin(search_vector);
CREATE INDEX idx_log_search_request ON log_search_entries(request_id) WHERE request_id IS NOT NULL;

-- Auto-expire hot-tier search entries older than 30 days
-- (handled by the indexer service, but also by this trigger as safety net)

-- ============================================================================
-- 8. RLS POLICIES
-- ============================================================================

ALTER TABLE log_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_glacier_restore_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_erasure_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_search_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY log_reports_tenant_isolation ON log_reports
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));
CREATE POLICY glacier_restore_tenant_isolation ON log_glacier_restore_jobs
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));
CREATE POLICY export_jobs_tenant_isolation ON log_export_jobs
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));
CREATE POLICY erasure_requests_tenant_isolation ON log_erasure_requests
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));
CREATE POLICY log_search_tenant_isolation ON log_search_entries
  USING (
    tenant_id IS NULL
    OR tenant_id::TEXT = current_setting('app.current_tenant_id', true)
  );

-- ============================================================================
-- 9. HELPER FUNCTION: Check if a log category is exempt from erasure
-- ============================================================================

CREATE OR REPLACE FUNCTION check_log_erasure_exemptions(
  p_tenant_id UUID,
  p_categories log_category[]
) RETURNS TABLE (
  category log_category,
  is_exempt BOOLEAN,
  exemption_reason TEXT,
  compliance_key TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    cat.category,
    CASE WHEN crr.compliance_key IS NOT NULL AND crr.immutable THEN true ELSE false END AS is_exempt,
    CASE WHEN crr.compliance_key IS NOT NULL AND crr.immutable
      THEN format('%s requires immutable %s logs — cannot be erased (%s)',
                   crr.compliance_key, cat.category::TEXT, COALESCE(crr.regulation_section, 'N/A'))
      ELSE NULL
    END AS exemption_reason,
    crr.compliance_key
  FROM unnest(p_categories) AS cat(category)
  LEFT JOIN LATERAL (
    SELECT cr.compliance_key, cr.immutable, cr.regulation_section
    FROM compliance_retention_requirements cr
    JOIN tenant_licenses tl ON tl.license_key = cr.compliance_key
    WHERE tl.tenant_id = p_tenant_id
      AND tl.license_type = 'compliance'
      AND tl.status = 'active'
      AND cr.category = cat.category
      AND cr.immutable = true
    ORDER BY cr.min_retention_days DESC
    LIMIT 1
  ) crr ON true;
END;
$$;

COMMENT ON TABLE log_reports IS 'Generated retention/compliance reports — visible in admin dashboard list';
COMMENT ON TABLE log_glacier_restore_jobs IS 'Batch Glacier restore requests with progress tracking';
COMMENT ON TABLE log_export_jobs IS 'Bulk log export jobs (all time or date range) for compliance officers';
COMMENT ON TABLE log_merkle_chain IS 'Tamper-evident Merkle chain for immutable log archives';
COMMENT ON TABLE log_erasure_requests IS 'GDPR right-to-erasure requests for log data';
COMMENT ON TABLE log_search_entries IS 'Hot-tier log entries with full-text search for real-time querying';
