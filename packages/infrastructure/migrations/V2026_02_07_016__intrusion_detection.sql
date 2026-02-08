-- ============================================================================
-- RADIANT v4.18.0 — Intrusion Detection & Prevention System (RIDPS)
-- Migration: V2026_02_07_016
--
-- Standards: NIST SP 800-94, NIST CSF 2.0 (DE.CM, DE.AE), MITRE ATT&CK Cloud,
--            OWASP ASVS 4.0 (V7, V11), CIS Controls v8 (8, 13),
--            SOC 2 CC7.2/CC7.3, ISO 27001 A.8.15/A.8.16
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ENUM: Threat severity levels (aligned with NIST CSF DE.AE severity)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE intrusion_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE intrusion_status AS ENUM ('open', 'investigating', 'mitigated', 'false_positive', 'resolved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE response_action AS ENUM (
    'log_only', 'rate_limit', 'challenge', 'block_request',
    'ban_ip', 'kill_session', 'lock_account', 'alert_admin',
    'escalate_sentinel', 'waf_block'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- TABLE: intrusion_events — every detected threat signal
-- Partitioned by month for high-volume performance (NIST 800-94 §7.1: log retention)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intrusion_events (
  id              UUID DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  detector_id     TEXT NOT NULL,
  mitre_technique TEXT,
  severity        intrusion_severity NOT NULL DEFAULT 'low',
  confidence      REAL NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  source_ip       INET,
  user_id         UUID,
  session_id      TEXT,
  request_path    TEXT,
  request_method  TEXT,
  user_agent      TEXT,
  geo_country     TEXT,
  geo_city        TEXT,
  geo_lat         DOUBLE PRECISION,
  geo_lon         DOUBLE PRECISION,
  details         JSONB NOT NULL DEFAULT '{}',
  response_action response_action NOT NULL DEFAULT 'log_only',
  response_detail JSONB DEFAULT '{}',
  correlated_incident_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for current and next 3 months
DO $$
DECLARE
  m INTEGER;
  start_date DATE;
  end_date DATE;
  part_name TEXT;
BEGIN
  FOR m IN 0..3 LOOP
    start_date := date_trunc('month', CURRENT_DATE + (m || ' months')::interval)::date;
    end_date := (start_date + interval '1 month')::date;
    part_name := 'intrusion_events_' || to_char(start_date, 'YYYY_MM');
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = part_name) THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF intrusion_events FOR VALUES FROM (%L) TO (%L)',
        part_name, start_date, end_date
      );
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_intrusion_events_tenant_created
  ON intrusion_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intrusion_events_source_ip
  ON intrusion_events (source_ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intrusion_events_detector
  ON intrusion_events (detector_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intrusion_events_severity
  ON intrusion_events (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intrusion_events_user
  ON intrusion_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intrusion_events_incident
  ON intrusion_events (correlated_incident_id) WHERE correlated_incident_id IS NOT NULL;

-- RLS
ALTER TABLE intrusion_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY intrusion_events_tenant_isolation ON intrusion_events
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid
         OR current_setting('app.current_tenant_id', true) IS NULL);

-- ---------------------------------------------------------------------------
-- TABLE: ip_blocklist — blocked IPs with TTL (NIST 800-94 §4.4: active response)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ip_blocklist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address      INET NOT NULL,
  cidr_range      CIDR,
  reason          TEXT NOT NULL,
  detector_id     TEXT,
  severity        intrusion_severity NOT NULL DEFAULT 'high',
  source          TEXT NOT NULL DEFAULT 'auto',
  blocked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  is_permanent    BOOLEAN NOT NULL DEFAULT false,
  hit_count       INTEGER NOT NULL DEFAULT 0,
  last_hit_at     TIMESTAMPTZ,
  tenant_id       UUID,
  created_by      UUID,
  notes           TEXT,
  CONSTRAINT ip_blocklist_unique_ip UNIQUE NULLS NOT DISTINCT (ip_address, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_ip_blocklist_ip ON ip_blocklist (ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_blocklist_expires ON ip_blocklist (expires_at)
  WHERE expires_at IS NOT NULL AND NOT is_permanent;
CREATE INDEX IF NOT EXISTS idx_ip_blocklist_tenant ON ip_blocklist (tenant_id)
  WHERE tenant_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- TABLE: threat_indicators — Indicators of Compromise (IOCs)
-- (CIS Control 13.3: centralized security event alerting)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS threat_indicators (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_type  TEXT NOT NULL,
  indicator_value TEXT NOT NULL,
  threat_type     TEXT NOT NULL,
  confidence      REAL NOT NULL DEFAULT 0.5,
  source          TEXT NOT NULL DEFAULT 'internal',
  first_seen      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen       TIMESTAMPTZ NOT NULL DEFAULT now(),
  hit_count       INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB DEFAULT '{}',
  expires_at      TIMESTAMPTZ,
  CONSTRAINT threat_indicators_unique UNIQUE (indicator_type, indicator_value)
);

CREATE INDEX IF NOT EXISTS idx_threat_indicators_type_value
  ON threat_indicators (indicator_type, indicator_value) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_threat_indicators_threat
  ON threat_indicators (threat_type) WHERE is_active;

-- ---------------------------------------------------------------------------
-- TABLE: detection_rules — configurable detector parameters per tenant
-- (NIST CSF DE.CM-01: networks monitored for potential cybersecurity events)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS detection_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  detector_id     TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  severity_override intrusion_severity,
  threshold_config JSONB NOT NULL DEFAULT '{}',
  response_actions response_action[] NOT NULL DEFAULT ARRAY['log_only']::response_action[],
  cooldown_seconds INTEGER NOT NULL DEFAULT 300,
  description     TEXT,
  mitre_technique TEXT,
  standard_refs   TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT detection_rules_unique UNIQUE NULLS NOT DISTINCT (tenant_id, detector_id)
);

CREATE INDEX IF NOT EXISTS idx_detection_rules_tenant
  ON detection_rules (tenant_id) WHERE enabled;

-- ---------------------------------------------------------------------------
-- TABLE: intrusion_incidents — correlated security incidents
-- (NIST CSF DE.AE-04: estimated impact and scope of adverse events)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intrusion_incidents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID,
  title           TEXT NOT NULL,
  description     TEXT,
  severity        intrusion_severity NOT NULL,
  status          intrusion_status NOT NULL DEFAULT 'open',
  mitre_techniques TEXT[] DEFAULT '{}',
  standard_refs   TEXT[] DEFAULT '{}',
  source_ips      INET[] DEFAULT '{}',
  affected_users  UUID[] DEFAULT '{}',
  event_count     INTEGER NOT NULL DEFAULT 0,
  first_event_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_event_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_actions_taken response_action[] DEFAULT '{}',
  response_details JSONB DEFAULT '{}',
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID,
  resolution_notes TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intrusion_incidents_tenant
  ON intrusion_incidents (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intrusion_incidents_status
  ON intrusion_incidents (status) WHERE status IN ('open', 'investigating');
CREATE INDEX IF NOT EXISTS idx_intrusion_incidents_severity
  ON intrusion_incidents (severity, created_at DESC);

-- RLS
ALTER TABLE intrusion_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY intrusion_incidents_tenant_isolation ON intrusion_incidents
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid
         OR current_setting('app.current_tenant_id', true) IS NULL);

-- ---------------------------------------------------------------------------
-- TABLE: user_access_baselines — UEBA behavioral baselines
-- (NIST CSF DE.AE-05: criteria for adverse event alerting established)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_access_baselines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  user_id         UUID NOT NULL,
  typical_hours   INT[] DEFAULT '{}',
  typical_countries TEXT[] DEFAULT '{}',
  typical_ips     INET[] DEFAULT '{}',
  typical_user_agents TEXT[] DEFAULT '{}',
  avg_requests_per_hour REAL DEFAULT 0,
  avg_tokens_per_day REAL DEFAULT 0,
  typical_endpoints TEXT[] DEFAULT '{}',
  sample_count    INTEGER NOT NULL DEFAULT 0,
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_baselines_unique UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_baselines_tenant_user
  ON user_access_baselines (tenant_id, user_id);

-- RLS
ALTER TABLE user_access_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_baselines_tenant_isolation ON user_access_baselines
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid
         OR current_setting('app.current_tenant_id', true) IS NULL);

-- ---------------------------------------------------------------------------
-- TABLE: ridps_config — global RIDPS configuration (singleton per instance)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ridps_config (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled                 BOOLEAN NOT NULL DEFAULT true,
  auto_block_enabled      BOOLEAN NOT NULL DEFAULT false,
  auto_block_min_severity intrusion_severity NOT NULL DEFAULT 'high',
  auto_block_min_confidence REAL NOT NULL DEFAULT 0.8,
  ip_ban_duration_minutes INTEGER NOT NULL DEFAULT 60,
  permanent_ban_threshold INTEGER NOT NULL DEFAULT 5,
  waf_sync_enabled        BOOLEAN NOT NULL DEFAULT false,
  sentinel_escalation_enabled BOOLEAN NOT NULL DEFAULT true,
  baseline_learning_days  INTEGER NOT NULL DEFAULT 14,
  event_retention_days    INTEGER NOT NULL DEFAULT 90,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed singleton
INSERT INTO ridps_config (enabled) VALUES (true) ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- FUNCTION: check_ip_blocked — fast lookup for middleware
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_ip_blocked(check_ip INET, check_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
  is_blocked BOOLEAN,
  reason TEXT,
  severity intrusion_severity,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    true AS is_blocked,
    b.reason,
    b.severity,
    b.expires_at
  FROM ip_blocklist b
  WHERE b.ip_address = check_ip
    AND (b.tenant_id IS NULL OR b.tenant_id = check_tenant_id)
    AND (b.is_permanent OR b.expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::intrusion_severity, NULL::TIMESTAMPTZ;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ---------------------------------------------------------------------------
-- FUNCTION: cleanup_intrusion_data — periodic maintenance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_intrusion_data()
RETURNS TABLE (
  expired_blocks_removed INTEGER,
  old_events_partitions_info TEXT
) AS $$
DECLARE
  removed_blocks INTEGER;
BEGIN
  -- Remove expired IP blocks
  DELETE FROM ip_blocklist
  WHERE NOT is_permanent AND expires_at < now();
  GET DIAGNOSTICS removed_blocks = ROW_COUNT;

  -- Remove expired threat indicators
  DELETE FROM threat_indicators
  WHERE expires_at IS NOT NULL AND expires_at < now();

  RETURN QUERY SELECT removed_blocks, 'Use DROP PARTITION for old event partitions'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- FUNCTION: record_blocklist_hit — increment hit counter on IP block match
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_blocklist_hit(hit_ip INET, hit_tenant_id UUID DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  UPDATE ip_blocklist
  SET hit_count = hit_count + 1,
      last_hit_at = now()
  WHERE ip_address = hit_ip
    AND (tenant_id IS NULL OR tenant_id = hit_tenant_id)
    AND (is_permanent OR expires_at > now());
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Seed default detection rules (global — tenant_id NULL = system defaults)
-- Maps each detector to MITRE techniques and compliance standards
-- ---------------------------------------------------------------------------
INSERT INTO detection_rules (tenant_id, detector_id, enabled, threshold_config, response_actions, cooldown_seconds, description, mitre_technique, standard_refs) VALUES
  (NULL, 'brute_force_auth', true,
   '{"max_failures": 5, "window_seconds": 300, "lockout_minutes": 15}'::jsonb,
   ARRAY['rate_limit', 'alert_admin']::response_action[],
   300, 'Detects repeated authentication failures from same source',
   'T1110.001', ARRAY['NIST-800-94-4.3', 'OWASP-OAT-007', 'CIS-13.3']),

  (NULL, 'credential_stuffing', true,
   '{"max_unique_users": 10, "window_seconds": 60, "min_failure_rate": 0.8}'::jsonb,
   ARRAY['ban_ip', 'alert_admin']::response_action[],
   600, 'Detects high volume of unique username+password failures from few IPs',
   'T1110.004', ARRAY['OWASP-OAT-008', 'NIST-CSF-DE.CM-01', 'SOC2-CC7.2']),

  (NULL, 'impossible_travel', true,
   '{"min_distance_km": 500, "max_time_minutes": 60}'::jsonb,
   ARRAY['challenge', 'alert_admin']::response_action[],
   900, 'Detects authentication from geolocations impossible within elapsed time',
   'T1078.004', ARRAY['NIST-CSF-DE.AE-03', 'ISO27001-A.8.16']),

  (NULL, 'session_hijack', true,
   '{"detect_ip_change": true, "detect_ua_change": true, "detect_country_change": true}'::jsonb,
   ARRAY['kill_session', 'alert_admin']::response_action[],
   60, 'Detects session token used from different IP/user-agent/country',
   'T1550.004', ARRAY['OWASP-ASVS-3.7', 'NIST-800-94-4.3']),

  (NULL, 'cross_tenant_probe', true,
   '{"max_cross_tenant_refs": 3, "window_seconds": 300}'::jsonb,
   ARRAY['block_request', 'ban_ip', 'escalate_sentinel']::response_action[],
   60, 'Detects requests referencing other tenants data or IDs',
   'T1078', ARRAY['SOC2-CC6.6', 'NIST-CSF-DE.CM-05']),

  (NULL, 'api_enumeration', true,
   '{"max_404s": 20, "window_seconds": 60, "sequential_id_threshold": 5}'::jsonb,
   ARRAY['rate_limit', 'alert_admin']::response_action[],
   300, 'Detects sequential ID probing or rapid path scanning',
   'T1087.004', ARRAY['CIS-13.3', 'NIST-CSF-DE.CM-01']),

  (NULL, 'sql_injection', true,
   '{"patterns": ["union select", "or 1=1", "drop table", "exec(", "xp_cmdshell"]}'::jsonb,
   ARRAY['block_request', 'ban_ip', 'alert_admin']::response_action[],
   60, 'Detects SQL injection patterns in request payloads (supplements WAF)',
   'T1190', ARRAY['OWASP-ASVS-5.3', 'NIST-800-94-4.1']),

  (NULL, 'excessive_error_rate', true,
   '{"max_error_rate": 0.5, "min_requests": 20, "window_seconds": 60}'::jsonb,
   ARRAY['rate_limit', 'alert_admin']::response_action[],
   300, 'Detects sources with abnormally high error rates',
   'T1190', ARRAY['NIST-800-94-4.1', 'CIS-13.3']),

  (NULL, 'data_exfiltration', true,
   '{"max_records_per_minute": 1000, "max_response_mb": 50, "window_seconds": 300}'::jsonb,
   ARRAY['block_request', 'alert_admin', 'escalate_sentinel']::response_action[],
   60, 'Detects bulk data export or unusually large response payloads',
   'T1530', ARRAY['NIST-CSF-DE.CM-05', 'SOC2-CC7.2', 'ISO27001-A.8.16']),

  (NULL, 'privilege_escalation', true,
   '{"monitor_role_changes": true, "suspicious_api_window_seconds": 300}'::jsonb,
   ARRAY['alert_admin', 'escalate_sentinel']::response_action[],
   600, 'Detects role change followed by unusual API access pattern',
   'T1548', ARRAY['CIS-8.5', 'SOC2-CC6.1', 'NIST-CSF-DE.AE-05']),

  (NULL, 'prompt_injection_surge', true,
   '{"max_cato_blocks": 10, "window_seconds": 300}'::jsonb,
   ARRAY['rate_limit', 'alert_admin']::response_action[],
   300, 'Detects spike in CATO safety blocks correlated with single source',
   NULL, ARRAY['OWASP-LLM01', 'RADIANT-CATO']),

  (NULL, 'model_cost_anomaly', true,
   '{"sigma_threshold": 3.0, "min_baseline_days": 7}'::jsonb,
   ARRAY['rate_limit', 'alert_admin']::response_action[],
   600, 'Detects token/cost usage exceeding 3σ from baseline',
   NULL, ARRAY['RADIANT-SpendGovernor', 'NIST-CSF-DE.AE-03']),

  (NULL, 'unusual_access_pattern', true,
   '{"deviation_threshold": 3.0, "min_baseline_samples": 50}'::jsonb,
   ARRAY['challenge', 'alert_admin']::response_action[],
   900, 'UEBA: deviation from users historical access baseline',
   'T1078', ARRAY['NIST-CSF-DE.AE-05', 'ISO27001-A.8.16', 'SOC2-CC7.3']),

  (NULL, 'account_takeover', true,
   '{"sequence_window_seconds": 600, "required_signals": 3}'::jsonb,
   ARRAY['lock_account', 'alert_admin', 'escalate_sentinel']::response_action[],
   60, 'Detects password+profile+API key change in rapid sequence',
   'T1078.001', ARRAY['OWASP-OAT-019', 'NIST-CSF-DE.AE-04', 'SOC2-CC7.2'])
ON CONFLICT (tenant_id, detector_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- COMMENT: Standards compliance reference
-- ---------------------------------------------------------------------------
COMMENT ON TABLE intrusion_events IS 'RIDPS event log — NIST SP 800-94, NIST CSF DE.CM/DE.AE, CIS Control 8';
COMMENT ON TABLE ip_blocklist IS 'Active response blocklist — NIST SP 800-94 §4.4, CIS Control 13.6';
COMMENT ON TABLE threat_indicators IS 'IOC database — MITRE ATT&CK, CIS Control 13.3';
COMMENT ON TABLE detection_rules IS 'Per-detector configuration — NIST CSF DE.CM-01';
COMMENT ON TABLE intrusion_incidents IS 'Correlated security incidents — NIST CSF DE.AE-04, SOC2 CC7.3';
COMMENT ON TABLE user_access_baselines IS 'UEBA behavioral baselines — NIST CSF DE.AE-05, ISO 27001 A.8.16';
COMMENT ON TABLE ridps_config IS 'Global RIDPS configuration — singleton';
