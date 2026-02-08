-- ============================================================================
-- RADIANT v4.18.0 — Data Lake Offload: Zero-DB-Write Log/Audit/Telemetry Pipeline
-- Migration: V2026_02_07_018
--
-- Eliminates ~30-100M daily database writes by routing all log/audit/telemetry
-- data through Kinesis Firehose → S3 Parquet instead of PostgreSQL INSERTs.
--
-- New tables:
--   1. data_type_registry        — Canonical registry of all storable data types
--   2. tenant_data_retention     — Per-tenant retention overrides per data type
--   3. data_location_index       — Fast lookup index for S3/Glacier objects
--   4. glacier_deletion_queue    — Tracks Glacier deletions respecting min-storage
--   5. data_lake_sync_state      — Tracks Firehose delivery + Glue partition state
--   6. retention_reconciliation_log — Audit trail for retention policy changes
-- ============================================================================

SET search_path TO public;
SET app.current_tenant_id TO '00000000-0000-0000-0000-000000000000';

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

CREATE TYPE data_storage_tier AS ENUM (
  'hot',              -- S3 Standard / Intelligent-Tiering Frequent Access (0-30d)
  'warm',             -- S3 Intelligent-Tiering Infrequent Access (30-90d)
  'cold',             -- S3 Glacier Instant Retrieval (90d-7yr)
  'glacier',          -- S3 Glacier Flexible Retrieval (7yr+)
  'deep_archive'      -- S3 Glacier Deep Archive (regulatory hold)
);

CREATE TYPE data_lake_event_type AS ENUM (
  'ingested',         -- New data landed in S3 from Firehose
  'tier_transitioned', -- Data moved between storage classes
  'queried',          -- Data accessed via Athena
  'restored',         -- Glacier data restored to hot tier
  'expired',          -- Data deleted due to retention expiry
  'erased',           -- Data deleted due to GDPR erasure
  'reconciled',       -- Retention policy re-evaluated
  'glacier_delete_queued',   -- Glacier deletion queued (respects min storage)
  'glacier_delete_executed'  -- Glacier deletion actually performed
);

CREATE TYPE glacier_delete_status AS ENUM (
  'queued',           -- Waiting for minimum storage period to pass
  'eligible',         -- Min storage period passed, ready to delete
  'executing',        -- Deletion in progress
  'completed',        -- Successfully deleted
  'failed',           -- Deletion failed (will retry)
  'cancelled'         -- Cancelled (e.g., retention extended)
);

-- ============================================================================
-- 2. DATA TYPE REGISTRY
-- Canonical registry of every storable data type with stable UUIDs.
-- Each data type maps to a Glue table and S3 prefix pattern.
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_type_registry (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key              TEXT NOT NULL UNIQUE,          -- e.g. 'audit_log', 'security_event', 'ai_invocation'
  display_name          TEXT NOT NULL,                 -- e.g. 'Audit Logs'
  category              log_category NOT NULL,         -- Links to existing log_category enum
  description           TEXT,

  -- Schema & storage
  schema_version        INTEGER NOT NULL DEFAULT 1,
  glue_database         TEXT NOT NULL DEFAULT 'radiant_data_lake',
  glue_table_name       TEXT NOT NULL,                 -- Athena table reference
  s3_prefix_pattern     TEXT NOT NULL,                 -- e.g. 'data/{tenant_id}/audit_log/{yyyy}/{mm}/{dd}/{hh}/'
  partition_keys        TEXT[] NOT NULL DEFAULT ARRAY['tenant_id', 'year', 'month', 'day', 'hour'],

  -- Default retention (days)
  default_retention_days      INTEGER NOT NULL DEFAULT 90,
  default_hot_days            INTEGER NOT NULL DEFAULT 30,
  default_warm_days           INTEGER NOT NULL DEFAULT 60,
  default_cold_days           INTEGER NOT NULL DEFAULT 2465,  -- ~6.75 years (to cold after warm)
  default_glacier_days        INTEGER,                         -- NULL = no glacier, just expire

  -- Data characteristics
  supports_immutable          BOOLEAN NOT NULL DEFAULT false,
  supports_tamper_evident     BOOLEAN NOT NULL DEFAULT false,
  estimated_avg_record_bytes  INTEGER DEFAULT 512,
  estimated_daily_volume_mb   NUMERIC(12,2) DEFAULT 0,

  -- Glacier deletion economics
  -- Glacier min storage: 90 days (Flexible Retrieval), 180 days (Deep Archive)
  -- Early deletion is charged at prorated remaining storage cost
  glacier_min_storage_days    INTEGER NOT NULL DEFAULT 90,
  deep_archive_min_storage_days INTEGER NOT NULL DEFAULT 180,

  -- Firehose config
  firehose_buffer_seconds     INTEGER NOT NULL DEFAULT 60,
  firehose_buffer_mb          INTEGER NOT NULL DEFAULT 64,
  firehose_compression        TEXT NOT NULL DEFAULT 'SNAPPY',
  output_format               TEXT NOT NULL DEFAULT 'parquet',

  -- Status
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dtr_category ON data_type_registry(category);
CREATE INDEX idx_dtr_active ON data_type_registry(is_active) WHERE is_active = true;

-- ============================================================================
-- 3. TENANT DATA RETENTION OVERRIDES
-- Per-tenant, per-data-type retention policy overrides.
-- Cannot go below compliance minimums (enforced by trigger).
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_data_retention (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  data_type_id          UUID NOT NULL REFERENCES data_type_registry(id) ON DELETE CASCADE,

  -- Retention override (NULL = use default from registry)
  retention_days        INTEGER,
  hot_days              INTEGER,
  warm_days             INTEGER,
  cold_days             INTEGER,
  glacier_days          INTEGER,

  -- Compliance
  immutable_override    BOOLEAN,         -- Can only be stricter (false→true, not true→false)
  compliance_keys       TEXT[] DEFAULT '{}',  -- Which regulations drive this override
  compliance_locked     BOOLEAN NOT NULL DEFAULT false,  -- If true, tenant cannot weaken

  -- Audit
  set_by                TEXT NOT NULL,
  reason                TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, data_type_id)
);

CREATE INDEX idx_tdr_tenant ON tenant_data_retention(tenant_id);
CREATE INDEX idx_tdr_data_type ON tenant_data_retention(data_type_id);

-- ============================================================================
-- 4. DATA LOCATION INDEX
-- Fast lookup index for finding data in S3/Glacier by tenant, type, time range.
-- This is the "phone book" that tells you WHERE data lives without scanning S3.
-- Replaces the old log_index table for new data lake objects.
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_location_index (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type_id          UUID NOT NULL REFERENCES data_type_registry(id),
  tenant_id             UUID NOT NULL,

  -- Time window this partition covers
  partition_hour        TIMESTAMPTZ NOT NULL,          -- Truncated to hour
  partition_date        DATE NOT NULL,                 -- Truncated to day (for fast range queries)

  -- Storage location
  storage_tier          data_storage_tier NOT NULL DEFAULT 'hot',
  s3_bucket             TEXT NOT NULL,
  s3_key                TEXT NOT NULL,
  s3_region             TEXT NOT NULL DEFAULT 'us-east-1',
  s3_storage_class      TEXT NOT NULL DEFAULT 'INTELLIGENT_TIERING',

  -- Glacier-specific (populated when transitioned to Glacier)
  glacier_vault_name    TEXT,
  glacier_archive_id    TEXT,
  glacier_archived_at   TIMESTAMPTZ,
  glacier_storage_class TEXT,                          -- 'GLACIER' or 'DEEP_ARCHIVE'

  -- Data stats
  record_count          INTEGER NOT NULL DEFAULT 0,
  byte_size             BIGINT NOT NULL DEFAULT 0,
  compressed_size       BIGINT NOT NULL DEFAULT 0,
  file_format           TEXT NOT NULL DEFAULT 'parquet',

  -- Integrity
  sha256_hash           TEXT,
  etag                  TEXT,                          -- S3 ETag for verification

  -- Retention
  retention_expires_at  TIMESTAMPTZ NOT NULL,
  immutable             BOOLEAN NOT NULL DEFAULT false,
  object_lock_mode      TEXT,                          -- 'GOVERNANCE' or 'COMPLIANCE' or NULL
  object_lock_until     TIMESTAMPTZ,

  -- Lifecycle tracking
  tier_transitioned_at  TIMESTAMPTZ,                   -- When it last changed tiers
  last_accessed_at      TIMESTAMPTZ,                   -- Last Athena query hit
  access_count          INTEGER NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup indexes: the "phone book" queries
CREATE INDEX idx_dli_tenant_type_date ON data_location_index(tenant_id, data_type_id, partition_date DESC);
CREATE INDEX idx_dli_tenant_date ON data_location_index(tenant_id, partition_date DESC);
CREATE INDEX idx_dli_type_date ON data_location_index(data_type_id, partition_date DESC);
CREATE INDEX idx_dli_tier ON data_location_index(storage_tier);
CREATE INDEX idx_dli_retention ON data_location_index(retention_expires_at) WHERE retention_expires_at IS NOT NULL;
CREATE INDEX idx_dli_glacier ON data_location_index(glacier_archive_id) WHERE glacier_archive_id IS NOT NULL;
CREATE INDEX idx_dli_s3_key ON data_location_index(s3_bucket, s3_key);
CREATE INDEX idx_dli_partition_hour ON data_location_index(partition_hour DESC);
CREATE INDEX idx_dli_immutable ON data_location_index(immutable) WHERE immutable = true;

-- Partition by month for scalability (millions of rows)
-- Note: In production, consider partitioning this table by partition_date range

-- ============================================================================
-- 5. GLACIER DELETION QUEUE
-- Glacier charges for early deletion:
--   - Glacier Flexible Retrieval: prorated for items < 90 days old
--   - Deep Archive: prorated for items < 180 days old
-- This queue holds deletions until the minimum storage period passes.
-- Cost analysis: deleting a 1GB Glacier object at day 45 costs ~$0.002 extra
-- vs waiting to day 90 costs $0. At scale (TB+), this adds up significantly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS glacier_deletion_queue (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_location_id      UUID NOT NULL REFERENCES data_location_index(id) ON DELETE CASCADE,
  tenant_id             UUID NOT NULL,

  -- What to delete
  s3_bucket             TEXT NOT NULL,
  s3_key                TEXT NOT NULL,
  glacier_vault_name    TEXT,
  glacier_archive_id    TEXT,
  glacier_storage_class TEXT NOT NULL,                  -- 'GLACIER' or 'DEEP_ARCHIVE'

  -- Timing
  archived_at           TIMESTAMPTZ NOT NULL,           -- When object entered Glacier
  min_storage_days      INTEGER NOT NULL,               -- 90 for Glacier, 180 for Deep Archive
  earliest_free_delete  TIMESTAMPTZ NOT NULL,           -- archived_at + min_storage_days
  retention_expired_at  TIMESTAMPTZ NOT NULL,           -- When retention policy said "delete"

  -- Cost analysis
  byte_size             BIGINT NOT NULL DEFAULT 0,
  estimated_early_delete_cost_usd NUMERIC(10,4) DEFAULT 0,  -- Cost if deleted now
  estimated_wait_storage_cost_usd NUMERIC(10,4) DEFAULT 0,  -- Cost of waiting until free delete

  -- Status
  status                glacier_delete_status NOT NULL DEFAULT 'queued',
  delete_attempted_at   TIMESTAMPTZ,
  delete_completed_at   TIMESTAMPTZ,
  error_message         TEXT,
  retry_count           INTEGER NOT NULL DEFAULT 0,

  -- Decision
  force_immediate       BOOLEAN NOT NULL DEFAULT false, -- Admin override: delete now regardless of cost
  reason                TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gdq_status ON glacier_deletion_queue(status);
CREATE INDEX idx_gdq_eligible ON glacier_deletion_queue(earliest_free_delete) WHERE status = 'queued';
CREATE INDEX idx_gdq_tenant ON glacier_deletion_queue(tenant_id);

-- ============================================================================
-- 6. DATA LAKE SYNC STATE
-- Tracks the Firehose delivery and Glue partition discovery state.
-- One row per data type, updated by the lifecycle manager Lambda.
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_lake_sync_state (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type_id          UUID NOT NULL REFERENCES data_type_registry(id) ON DELETE CASCADE UNIQUE,

  -- Firehose state
  firehose_stream_name  TEXT,
  firehose_stream_arn   TEXT,
  last_delivery_at      TIMESTAMPTZ,
  delivery_error_count  INTEGER NOT NULL DEFAULT 0,
  last_delivery_error   TEXT,

  -- Glue state
  glue_table_exists     BOOLEAN NOT NULL DEFAULT false,
  glue_schema_version   INTEGER NOT NULL DEFAULT 0,
  last_partition_added  TIMESTAMPTZ,
  total_partitions      INTEGER NOT NULL DEFAULT 0,

  -- Stats
  total_records_ingested BIGINT NOT NULL DEFAULT 0,
  total_bytes_ingested   BIGINT NOT NULL DEFAULT 0,
  total_records_expired  BIGINT NOT NULL DEFAULT 0,
  total_bytes_expired    BIGINT NOT NULL DEFAULT 0,

  -- Lifecycle manager
  last_lifecycle_run    TIMESTAMPTZ,
  last_lifecycle_duration_ms INTEGER,
  lifecycle_errors      INTEGER NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. RETENTION RECONCILIATION LOG
-- Audit trail for every retention policy change, with before/after state.
-- ============================================================================

CREATE TABLE IF NOT EXISTS retention_reconciliation_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  data_type_id          UUID REFERENCES data_type_registry(id),

  -- What triggered the reconciliation
  trigger_type          TEXT NOT NULL,                  -- 'compliance_license_change', 'admin_override', 'policy_update', 'scheduled_review'
  trigger_detail        TEXT,

  -- Before/after state
  previous_retention_days   INTEGER,
  new_retention_days        INTEGER,
  previous_tier_config      JSONB,                     -- {hot_days, warm_days, cold_days, glacier_days}
  new_tier_config           JSONB,
  previous_immutable        BOOLEAN,
  new_immutable             BOOLEAN,

  -- Actions taken
  lifecycle_rules_updated   BOOLEAN NOT NULL DEFAULT false,
  objects_retagged          INTEGER NOT NULL DEFAULT 0,
  objects_deleted            INTEGER NOT NULL DEFAULT 0,
  object_locks_applied       INTEGER NOT NULL DEFAULT 0,
  glacier_deletes_queued     INTEGER NOT NULL DEFAULT 0,

  -- Result
  success                   BOOLEAN NOT NULL DEFAULT true,
  error_message             TEXT,

  -- Audit
  performed_by              TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rrl_tenant ON retention_reconciliation_log(tenant_id, created_at DESC);
CREATE INDEX idx_rrl_trigger ON retention_reconciliation_log(trigger_type, created_at DESC);

-- ============================================================================
-- 8. RLS POLICIES
-- ============================================================================

ALTER TABLE tenant_data_retention ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_location_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE glacier_deletion_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_reconciliation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tdr_tenant_isolation ON tenant_data_retention
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

CREATE POLICY dli_tenant_isolation ON data_location_index
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

CREATE POLICY gdq_tenant_isolation ON glacier_deletion_queue
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

CREATE POLICY rrl_tenant_isolation ON retention_reconciliation_log
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', true));

-- data_type_registry is global (no RLS) — all tenants see the same types
-- data_lake_sync_state is global (no RLS) — infrastructure state

-- ============================================================================
-- 9. SEED DATA TYPE REGISTRY
-- Register all known data types that currently write to PostgreSQL.
-- ============================================================================

INSERT INTO data_type_registry (type_key, display_name, category, description, glue_table_name, s3_prefix_pattern, default_retention_days, default_hot_days, default_warm_days, supports_immutable, supports_tamper_evident, estimated_avg_record_bytes) VALUES
  -- Audit & Compliance
  ('audit_log',              'Audit Logs',              'audit',          'Administrative actions, role changes, settings modifications', 'audit_logs', 'data/{tenant_id}/audit_log/{yyyy}/{mm}/{dd}/{hh}/', 2555, 30, 90, true, true, 1024),
  ('license_audit',          'License Audit Trail',     'audit',          'License assignment, removal, and change events', 'license_audit', 'data/{tenant_id}/license_audit/{yyyy}/{mm}/{dd}/{hh}/', 2555, 30, 90, true, true, 512),
  ('log_retention_audit',    'Retention Policy Audit',  'audit',          'Changes to log retention policies', 'log_retention_audit', 'data/{tenant_id}/log_retention_audit/{yyyy}/{mm}/{dd}/{hh}/', 2555, 30, 90, true, true, 768),
  ('uds_audit',              'UDS Audit Log',           'audit',          'User Data Service operations audit trail', 'uds_audit', 'data/{tenant_id}/uds_audit/{yyyy}/{mm}/{dd}/{hh}/', 2555, 30, 90, true, true, 1024),
  ('system_admin_audit',     'System Admin Audit',      'audit',          'System administrator actions audit trail', 'system_admin_audit', 'data/{tenant_id}/system_admin_audit/{yyyy}/{mm}/{dd}/{hh}/', 2555, 30, 90, true, true, 768),

  -- Security
  ('security_event',         'Security Events',         'security',       'Authentication failures, token issues, MFA events, suspicious activity', 'security_events', 'data/{tenant_id}/security_event/{yyyy}/{mm}/{dd}/{hh}/', 365, 30, 90, false, false, 512),
  ('intrusion_event',        'Intrusion Detection',     'security',       'RIDPS alerts, threat detections, anomaly scores', 'intrusion_events', 'data/{tenant_id}/intrusion_event/{yyyy}/{mm}/{dd}/{hh}/', 730, 30, 90, true, true, 1536),
  ('lockout_event',          'Account Lockouts',        'security',       'Account lockout and unlock events', 'lockout_events', 'data/{tenant_id}/lockout_event/{yyyy}/{mm}/{dd}/{hh}/', 365, 30, 90, false, false, 512),

  -- AI & Model
  ('ai_invocation',          'AI Model Invocations',    'ai_model',       'Model requests, responses, latency, token usage, drift telemetry', 'ai_invocations', 'data/{tenant_id}/ai_invocation/{yyyy}/{mm}/{dd}/{hh}/', 90, 7, 30, false, false, 2048),
  ('drift_telemetry',        'Drift Telemetry',         'ai_model',       'Model drift scores, reroute decisions, health signals', 'drift_telemetry', 'data/{tenant_id}/drift_telemetry/{yyyy}/{mm}/{dd}/{hh}/', 30, 7, 14, false, false, 256),
  ('brain_plan',             'Brain Plans',             'ai_model',       'AGI Brain planning decisions and routing metadata', 'brain_plans', 'data/{tenant_id}/brain_plan/{yyyy}/{mm}/{dd}/{hh}/', 90, 7, 30, false, false, 4096),

  -- Compliance
  ('compliance_event',       'Compliance Events',       'compliance',     'GDPR erasure requests, data subject access, consent changes', 'compliance_events', 'data/{tenant_id}/compliance_event/{yyyy}/{mm}/{dd}/{hh}/', 2555, 30, 90, true, true, 1024),
  ('guest_restriction',      'Guest Restrictions',      'compliance',     'Guest access restriction enforcement events', 'guest_restrictions', 'data/{tenant_id}/guest_restriction/{yyyy}/{mm}/{dd}/{hh}/', 365, 30, 90, false, false, 512),

  -- Billing
  ('billing_event',          'Billing Events',          'billing',        'Credit usage, metering records, subscription changes', 'billing_events', 'data/{tenant_id}/billing_event/{yyyy}/{mm}/{dd}/{hh}/', 2555, 30, 90, true, false, 512),
  ('cost_attribution',       'Cost Attribution',        'billing',        'Per-user, per-model cost tracking', 'cost_attribution', 'data/{tenant_id}/cost_attribution/{yyyy}/{mm}/{dd}/{hh}/', 2555, 30, 90, false, false, 256),
  ('storage_event',          'Storage Events',          'billing',        'Upload, download, archive, restore, delete events', 'storage_events', 'data/{tenant_id}/storage_event/{yyyy}/{mm}/{dd}/{hh}/', 365, 30, 90, false, false, 256),

  -- Infrastructure
  ('infrastructure_metric',  'Infrastructure Metrics',  'infrastructure', 'Lambda invocations, API latency, error rates, scaling events', 'infrastructure_metrics', 'data/{tenant_id}/infrastructure_metric/{yyyy}/{mm}/{dd}/{hh}/', 30, 7, 14, false, false, 256),
  ('error_log',              'Error Logs',              'infrastructure', 'Application errors, stack traces, unhandled exceptions', 'error_logs', 'data/{tenant_id}/error_log/{yyyy}/{mm}/{dd}/{hh}/', 90, 14, 30, false, false, 2048),

  -- Application
  ('application_log',        'Application Logs',        'application',    'General application-level structured logs from all services', 'application_logs', 'data/{tenant_id}/application_log/{yyyy}/{mm}/{dd}/{hh}/', 30, 7, 14, false, false, 512),
  ('delight_event',          'Delight Events',          'application',    'UX delight system events and personality interactions', 'delight_events', 'data/{tenant_id}/delight_event/{yyyy}/{mm}/{dd}/{hh}/', 30, 7, 14, false, false, 256),

  -- Collaboration
  ('collaboration_event',    'Collaboration Events',    'collaboration',  'Guest invites, session joins, sharing actions', 'collaboration_events', 'data/{tenant_id}/collaboration_event/{yyyy}/{mm}/{dd}/{hh}/', 365, 30, 90, false, false, 512)
ON CONFLICT (type_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================================================
-- 10. HELPER FUNCTIONS
-- ============================================================================

-- Resolve effective retention for a tenant + data type, considering compliance
CREATE OR REPLACE FUNCTION resolve_data_retention(
  p_tenant_id UUID,
  p_data_type_id UUID
) RETURNS TABLE (
  retention_days INTEGER,
  hot_days INTEGER,
  warm_days INTEGER,
  cold_days INTEGER,
  glacier_days INTEGER,
  immutable BOOLEAN,
  driving_compliance TEXT,
  source TEXT            -- 'default', 'tenant_override', 'compliance_minimum'
) LANGUAGE plpgsql AS $$
DECLARE
  v_type RECORD;
  v_override RECORD;
  v_compliance_min INTEGER;
  v_compliance_key TEXT;
  v_immutable BOOLEAN;
BEGIN
  -- Get default from registry
  SELECT * INTO v_type FROM data_type_registry WHERE id = p_data_type_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Get tenant override if any
  SELECT * INTO v_override FROM tenant_data_retention
    WHERE tenant_id = p_tenant_id AND data_type_id = p_data_type_id;

  -- Get compliance minimum (highest min_retention_days across active compliance licenses)
  SELECT MAX(cr.min_retention_days), MAX(cr.compliance_key), bool_or(cr.immutable)
  INTO v_compliance_min, v_compliance_key, v_immutable
  FROM compliance_retention_requirements cr
  JOIN tenant_licenses tl ON tl.license_key = cr.compliance_key
  WHERE tl.tenant_id = p_tenant_id
    AND tl.license_type = 'compliance'
    AND tl.status = 'active'
    AND cr.category = v_type.category;

  -- Resolve: compliance minimum > tenant override > default
  RETURN QUERY SELECT
    GREATEST(
      COALESCE(v_override.retention_days, v_type.default_retention_days),
      COALESCE(v_compliance_min, 0)
    )::INTEGER AS retention_days,
    COALESCE(v_override.hot_days, v_type.default_hot_days) AS hot_days,
    COALESCE(v_override.warm_days, v_type.default_warm_days) AS warm_days,
    COALESCE(v_override.cold_days, v_type.default_cold_days) AS cold_days,
    v_override.glacier_days AS glacier_days,
    COALESCE(v_immutable, v_override.immutable_override, v_type.supports_immutable) AS immutable,
    COALESCE(v_compliance_key, 'none') AS driving_compliance,
    CASE
      WHEN v_compliance_min IS NOT NULL AND v_compliance_min > COALESCE(v_override.retention_days, v_type.default_retention_days)
        THEN 'compliance_minimum'
      WHEN v_override.retention_days IS NOT NULL
        THEN 'tenant_override'
      ELSE 'default'
    END AS source;
END;
$$;

-- Calculate Glacier early deletion cost
-- Glacier Flexible Retrieval: $0.012/GB/month prorated for remaining days of 90-day minimum
-- Deep Archive: $0.00099/GB/month prorated for remaining days of 180-day minimum
CREATE OR REPLACE FUNCTION calculate_glacier_early_delete_cost(
  p_byte_size BIGINT,
  p_storage_class TEXT,        -- 'GLACIER' or 'DEEP_ARCHIVE'
  p_archived_at TIMESTAMPTZ,
  p_delete_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS NUMERIC(10,4) LANGUAGE plpgsql AS $$
DECLARE
  v_gb NUMERIC;
  v_days_stored INTEGER;
  v_min_days INTEGER;
  v_remaining_days INTEGER;
  v_monthly_rate NUMERIC;
BEGIN
  v_gb := p_byte_size / 1073741824.0;
  v_days_stored := EXTRACT(DAY FROM (p_delete_at - p_archived_at));

  IF p_storage_class = 'DEEP_ARCHIVE' THEN
    v_min_days := 180;
    v_monthly_rate := 0.00099;  -- per GB/month
  ELSE
    v_min_days := 90;
    v_monthly_rate := 0.012;    -- per GB/month
  END IF;

  v_remaining_days := GREATEST(0, v_min_days - v_days_stored);

  IF v_remaining_days = 0 THEN
    RETURN 0;
  END IF;

  -- Prorated cost: (remaining_days / 30) * monthly_rate * GB
  RETURN ROUND((v_remaining_days / 30.0) * v_monthly_rate * v_gb, 4);
END;
$$;

-- Bulk lookup: find all data locations for a tenant within a time range
CREATE OR REPLACE FUNCTION find_data_locations(
  p_tenant_id UUID,
  p_data_type_key TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_storage_tier data_storage_tier DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000
) RETURNS TABLE (
  location_id UUID,
  data_type_key TEXT,
  data_type_display TEXT,
  partition_date DATE,
  partition_hour TIMESTAMPTZ,
  storage_tier data_storage_tier,
  s3_bucket TEXT,
  s3_key TEXT,
  glacier_archive_id TEXT,
  record_count INTEGER,
  byte_size BIGINT,
  retention_expires_at TIMESTAMPTZ,
  immutable BOOLEAN,
  last_accessed_at TIMESTAMPTZ
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    dli.id,
    dtr.type_key,
    dtr.display_name,
    dli.partition_date,
    dli.partition_hour,
    dli.storage_tier,
    dli.s3_bucket,
    dli.s3_key,
    dli.glacier_archive_id,
    dli.record_count,
    dli.byte_size,
    dli.retention_expires_at,
    dli.immutable,
    dli.last_accessed_at
  FROM data_location_index dli
  JOIN data_type_registry dtr ON dtr.id = dli.data_type_id
  WHERE dli.tenant_id = p_tenant_id
    AND (p_data_type_key IS NULL OR dtr.type_key = p_data_type_key)
    AND (p_start_date IS NULL OR dli.partition_date >= p_start_date)
    AND (p_end_date IS NULL OR dli.partition_date <= p_end_date)
    AND (p_storage_tier IS NULL OR dli.storage_tier = p_storage_tier)
  ORDER BY dli.partition_date DESC, dli.partition_hour DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- 11. TRIGGER: Prevent tenant overrides from going below compliance minimums
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_retention_compliance_minimum()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_type RECORD;
  v_min_days INTEGER;
  v_compliance_key TEXT;
BEGIN
  SELECT * INTO v_type FROM data_type_registry WHERE id = NEW.data_type_id;

  SELECT MAX(cr.min_retention_days), MAX(cr.compliance_key)
  INTO v_min_days, v_compliance_key
  FROM compliance_retention_requirements cr
  JOIN tenant_licenses tl ON tl.license_key = cr.compliance_key
  WHERE tl.tenant_id = NEW.tenant_id
    AND tl.license_type = 'compliance'
    AND tl.status = 'active'
    AND cr.category = v_type.category;

  IF v_min_days IS NOT NULL AND NEW.retention_days IS NOT NULL AND NEW.retention_days < v_min_days THEN
    RAISE EXCEPTION 'Retention override (% days) cannot be less than compliance minimum (% days) required by %',
      NEW.retention_days, v_min_days, v_compliance_key;
  END IF;

  -- Immutable can only be made stricter
  IF NEW.immutable_override = false THEN
    DECLARE v_compliance_immutable BOOLEAN;
    BEGIN
      SELECT bool_or(cr.immutable)
      INTO v_compliance_immutable
      FROM compliance_retention_requirements cr
      JOIN tenant_licenses tl ON tl.license_key = cr.compliance_key
      WHERE tl.tenant_id = NEW.tenant_id
        AND tl.license_type = 'compliance'
        AND tl.status = 'active'
        AND cr.category = v_type.category
        AND cr.immutable = true;

      IF v_compliance_immutable THEN
        RAISE EXCEPTION 'Cannot disable immutability — required by active compliance license for category %', v_type.category;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_retention_compliance
  BEFORE INSERT OR UPDATE ON tenant_data_retention
  FOR EACH ROW EXECUTE FUNCTION enforce_retention_compliance_minimum();

-- ============================================================================
-- 12. COMMENTS
-- ============================================================================

COMMENT ON TABLE data_type_registry IS 'Canonical registry of all storable data types with stable UUIDs, Glue/S3 mappings, and default retention';
COMMENT ON TABLE tenant_data_retention IS 'Per-tenant retention overrides per data type — cannot go below compliance minimums';
COMMENT ON TABLE data_location_index IS 'Fast lookup index for S3/Glacier objects — the "phone book" for finding data by tenant+type+time';
COMMENT ON TABLE glacier_deletion_queue IS 'Queue for Glacier deletions that respects minimum storage periods to avoid early-deletion charges';
COMMENT ON TABLE data_lake_sync_state IS 'Tracks Firehose delivery and Glue partition state per data type';
COMMENT ON TABLE retention_reconciliation_log IS 'Audit trail for retention policy changes with before/after state and actions taken';
COMMENT ON FUNCTION resolve_data_retention IS 'Resolves effective retention for a tenant+data_type considering compliance minimums';
COMMENT ON FUNCTION calculate_glacier_early_delete_cost IS 'Calculates the prorated cost of deleting a Glacier object before minimum storage period';
COMMENT ON FUNCTION find_data_locations IS 'Fast lookup of data locations by tenant, type, date range, and storage tier';
