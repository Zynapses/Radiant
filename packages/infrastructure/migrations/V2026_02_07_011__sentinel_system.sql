-- ============================================================================
-- RADIANT SENTINEL v1.0.0 — Alerting, Monitoring & Incident Response
-- Migration: V2026_02_07_011
--
-- Tables:
--   sentinel_incidents          - Incident lifecycle tracking
--   sentinel_incident_timeline  - Event timeline per incident
--   sentinel_evidence_locker    - WORM compliance snapshots
--   sentinel_remediation_log    - Auto-heal action audit trail
--   sentinel_remediation_rules  - Remediation rules with Shadow Mode
--   sentinel_postmortems        - Blameless post-incident reviews
--   sentinel_playbooks          - Pre-built response playbooks
--   sentinel_alert_preferences  - Per-admin notification preferences
--   sentinel_shadow_mode_log    - Shadow Mode "would have done" log
--   sentinel_notifications      - Notification delivery tracking
--
-- Enums:
--   sentinel_severity
--   sentinel_alert_category
--   sentinel_alert_status
--   sentinel_incident_status
--   sentinel_remediation_state
--   sentinel_remediation_result
--   sentinel_notification_channel
--   sentinel_circuit_breaker_state
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE sentinel_severity AS ENUM ('1', '2', '3', '4', '5');

CREATE TYPE sentinel_alert_category AS ENUM (
  'infrastructure', 'security', 'compliance', 'application', 'ai_model',
  'data', 'billing', 'performance', 'availability', 'tenant'
);

CREATE TYPE sentinel_alert_status AS ENUM (
  'firing', 'acknowledged', 'investigating', 'resolved', 'suppressed'
);

CREATE TYPE sentinel_incident_status AS ENUM (
  'detected', 'triaged', 'investigating', 'identified',
  'mitigating', 'resolved', 'postmortem'
);

CREATE TYPE sentinel_remediation_state AS ENUM ('shadow', 'active', 'manual');

CREATE TYPE sentinel_remediation_result AS ENUM (
  'success', 'failed', 'partial', 'skipped_cooldown',
  'shadow_logged', 'requires_approval'
);

CREATE TYPE sentinel_notification_channel AS ENUM (
  'pagerduty', 'twilio_sms', 'twilio_voice', 'slack',
  'email', 'in_app', 'status_page', 'webhook'
);

CREATE TYPE sentinel_circuit_breaker_state AS ENUM ('closed', 'open', 'half_open');

-- ---------------------------------------------------------------------------
-- Incidents
-- ---------------------------------------------------------------------------

CREATE TABLE sentinel_incidents (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL,
  severity                    INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
  status                      sentinel_incident_status NOT NULL DEFAULT 'detected',
  title                       TEXT NOT NULL,
  description                 TEXT,
  category                    sentinel_alert_category NOT NULL,
  service                     TEXT NOT NULL,
  region                      TEXT,
  tenant_scope                TEXT NOT NULL DEFAULT 'none',
  affected_tenant_ids         TEXT[],
  compliance_context          TEXT[] NOT NULL DEFAULT '{}',
  commander_id                UUID,
  alert_ids                   TEXT[] NOT NULL DEFAULT '{}',
  acknowledged_at             TIMESTAMPTZ,
  resolved_at                 TIMESTAMPTZ,
  duration_seconds            INTEGER,
  root_cause                  TEXT,
  resolution                  TEXT,
  postmortem_id               UUID,
  auto_remediation_attempted  BOOLEAN NOT NULL DEFAULT false,
  auto_remediation_succeeded  BOOLEAN NOT NULL DEFAULT false,
  pagerduty_incident_key      TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sentinel_incidents_tenant ON sentinel_incidents(tenant_id);
CREATE INDEX idx_sentinel_incidents_severity_status ON sentinel_incidents(severity, status);
CREATE INDEX idx_sentinel_incidents_created ON sentinel_incidents(created_at DESC);
CREATE INDEX idx_sentinel_incidents_category ON sentinel_incidents(category);

-- ---------------------------------------------------------------------------
-- Incident Timeline
-- ---------------------------------------------------------------------------

CREATE TABLE sentinel_incident_timeline (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     UUID NOT NULL REFERENCES sentinel_incidents(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  actor           TEXT NOT NULL,  -- userId or 'system'
  message         TEXT NOT NULL,
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sentinel_timeline_incident ON sentinel_incident_timeline(incident_id, created_at);

-- ---------------------------------------------------------------------------
-- Evidence Locker (WORM compliance for SEV 1 Security/Compliance)
-- ---------------------------------------------------------------------------

CREATE TABLE sentinel_evidence_locker (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  incident_id     UUID NOT NULL REFERENCES sentinel_incidents(id),
  s3_bucket       TEXT NOT NULL,
  s3_key_prefix   TEXT NOT NULL,
  lock_expiry     TIMESTAMPTZ NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  sources         TEXT[] NOT NULL DEFAULT '{}',
  window_start    TIMESTAMPTZ NOT NULL,
  window_end      TIMESTAMPTZ NOT NULL,
  size_bytes      BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sentinel_evidence_incident ON sentinel_evidence_locker(incident_id);
CREATE INDEX idx_sentinel_evidence_tenant ON sentinel_evidence_locker(tenant_id);

-- ---------------------------------------------------------------------------
-- Remediation Rules (with Shadow Mode)
-- ---------------------------------------------------------------------------

CREATE TABLE sentinel_remediation_rules (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  action                  TEXT NOT NULL,
  target_service          TEXT NOT NULL,
  state                   sentinel_remediation_state NOT NULL DEFAULT 'shadow',
  trigger_condition       TEXT NOT NULL,
  cooldown_minutes        INTEGER NOT NULL DEFAULT 15,
  max_retries             INTEGER NOT NULL DEFAULT 3,
  shadow_mode_started_at  TIMESTAMPTZ,
  shadow_mode_promoted_at TIMESTAMPTZ,
  description             TEXT NOT NULL,
  enabled                 BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sentinel_rules_tenant ON sentinel_remediation_rules(tenant_id);

-- ---------------------------------------------------------------------------
-- Remediation Log (audit trail of auto-heal actions)
-- ---------------------------------------------------------------------------

CREATE TABLE sentinel_remediation_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  alert_id        TEXT NOT NULL,
  incident_id     UUID REFERENCES sentinel_incidents(id),
  rule_id         UUID REFERENCES sentinel_remediation_rules(id),
  action          TEXT NOT NULL,
  target_service  TEXT NOT NULL,
  trigger_reason  TEXT NOT NULL,
  result          sentinel_remediation_result NOT NULL,
  details         JSONB,
  approved_by     UUID,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_sentinel_remediation_tenant ON sentinel_remediation_log(tenant_id);
CREATE INDEX idx_sentinel_remediation_incident ON sentinel_remediation_log(incident_id);
CREATE INDEX idx_sentinel_remediation_started ON sentinel_remediation_log(started_at DESC);

-- ---------------------------------------------------------------------------
-- Shadow Mode Log ("would have done" entries)
-- ---------------------------------------------------------------------------

CREATE TABLE sentinel_shadow_mode_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  rule_id         UUID NOT NULL REFERENCES sentinel_remediation_rules(id),
  alert_id        TEXT NOT NULL,
  action          TEXT NOT NULL,
  target_service  TEXT NOT NULL,
  trigger_reason  TEXT NOT NULL,
  would_have_done TEXT NOT NULL,
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sentinel_shadow_tenant ON sentinel_shadow_mode_log(tenant_id);
CREATE INDEX idx_sentinel_shadow_rule ON sentinel_shadow_mode_log(rule_id);
CREATE INDEX idx_sentinel_shadow_created ON sentinel_shadow_mode_log(created_at DESC);

-- ---------------------------------------------------------------------------
-- Postmortems
-- ---------------------------------------------------------------------------

CREATE TABLE sentinel_postmortems (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  incident_id         UUID NOT NULL REFERENCES sentinel_incidents(id),
  title               TEXT NOT NULL,
  summary             TEXT NOT NULL,
  root_cause          TEXT NOT NULL,
  impact_summary      TEXT NOT NULL,
  timeline_summary    TEXT NOT NULL,
  what_went_well      TEXT[] NOT NULL DEFAULT '{}',
  what_went_wrong     TEXT[] NOT NULL DEFAULT '{}',
  action_items        JSONB NOT NULL DEFAULT '[]',
  participants        UUID[] NOT NULL DEFAULT '{}',
  ai_drafted_summary  TEXT,
  published           BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sentinel_postmortems_tenant ON sentinel_postmortems(tenant_id);
CREATE INDEX idx_sentinel_postmortems_incident ON sentinel_postmortems(incident_id);

-- ---------------------------------------------------------------------------
-- Playbooks
-- ---------------------------------------------------------------------------

CREATE TABLE sentinel_playbooks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL,
  trigger_conditions  JSONB NOT NULL DEFAULT '{}',
  steps               JSONB NOT NULL DEFAULT '[]',
  severity_min        INTEGER NOT NULL DEFAULT 1,
  severity_max        INTEGER NOT NULL DEFAULT 5,
  categories          TEXT[] NOT NULL DEFAULT '{}',
  last_executed_at    TIMESTAMPTZ,
  execution_count     INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_sentinel_playbooks_tenant ON sentinel_playbooks(tenant_id);

-- ---------------------------------------------------------------------------
-- Alert Preferences (per-admin)
-- ---------------------------------------------------------------------------

CREATE TABLE sentinel_alert_preferences (
  user_id                 UUID PRIMARY KEY,
  tenant_id               UUID NOT NULL,
  subscribed_categories   TEXT[] NOT NULL DEFAULT '{}',
  subscribed_services     TEXT[] NOT NULL DEFAULT '{}',
  minimum_severity        INTEGER NOT NULL DEFAULT 3 CHECK (minimum_severity BETWEEN 1 AND 5),
  phone                   TEXT,
  sms                     TEXT,
  email                   TEXT NOT NULL,
  slack_id                TEXT,
  push_enabled            BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start       TIME,
  quiet_hours_end         TIME,
  timezone                TEXT NOT NULL DEFAULT 'UTC',
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sentinel_prefs_tenant ON sentinel_alert_preferences(tenant_id);

-- ---------------------------------------------------------------------------
-- Notification Delivery Log
-- ---------------------------------------------------------------------------

CREATE TABLE sentinel_notifications (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  alert_id                TEXT NOT NULL,
  incident_id             UUID REFERENCES sentinel_incidents(id),
  channel                 sentinel_notification_channel NOT NULL,
  recipient_id            TEXT NOT NULL,
  severity                INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
  title                   TEXT NOT NULL,
  body                    TEXT NOT NULL,
  delivered               BOOLEAN NOT NULL DEFAULT false,
  delivered_at            TIMESTAMPTZ,
  error                   TEXT,
  pagerduty_incident_key  TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sentinel_notif_tenant ON sentinel_notifications(tenant_id);
CREATE INDEX idx_sentinel_notif_alert ON sentinel_notifications(alert_id);
CREATE INDEX idx_sentinel_notif_created ON sentinel_notifications(created_at DESC);

-- ---------------------------------------------------------------------------
-- Seed: Default Playbooks
-- ---------------------------------------------------------------------------

INSERT INTO sentinel_playbooks (tenant_id, name, description, trigger_conditions, steps, severity_min, severity_max, categories) VALUES
  ('00000000-0000-0000-0000-000000000000', 'Total Platform Outage', 'All health checks failing across services', '{"allHealthChecksFailing": true}',
   '[{"order":1,"instruction":"Check AWS Health Dashboard for regional issues","automatable":false},{"order":2,"instruction":"Verify DNS resolution for all endpoints","automatable":true,"automationCommand":"dig radiant.example.com"},{"order":3,"instruction":"Check primary region connectivity","automatable":true},{"order":4,"instruction":"Initiate DR failover if region-level outage confirmed","automatable":false},{"order":5,"instruction":"Update status page with incident details","automatable":false}]',
   1, 1, '{"infrastructure","availability"}'),

  ('00000000-0000-0000-0000-000000000000', 'Database Failover', 'Aurora primary unreachable', '{"service":"aurora-postgres","status":"unhealthy"}',
   '[{"order":1,"instruction":"Verify replica health and replication lag","automatable":true},{"order":2,"instruction":"MANUAL: Promote read replica to primary (NEVER auto-failover stateful)","automatable":false},{"order":3,"instruction":"Update connection strings in SSM Parameter Store","automatable":true},{"order":4,"instruction":"Verify data integrity with checksum queries","automatable":true},{"order":5,"instruction":"Notify affected tenants of brief interruption","automatable":false}]',
   1, 2, '{"data","infrastructure"}'),

  ('00000000-0000-0000-0000-000000000000', 'Security Breach Response', 'WAF trigger + anomalous access pattern detected', '{"category":"security","severity":1}',
   '[{"order":1,"instruction":"Isolate affected systems and block suspicious IPs","automatable":true},{"order":2,"instruction":"Preserve evidence: trigger Evidence Locker snapshot","automatable":true,"automationCommand":"evidence_locker_snapshot"},{"order":3,"instruction":"Assess data exposure scope and affected tenants","automatable":false},{"order":4,"instruction":"Notify compliance team (HIPAA/GDPR if applicable)","automatable":true},{"order":5,"instruction":"Begin containment and remediation","automatable":false}]',
   1, 1, '{"security","compliance"}'),

  ('00000000-0000-0000-0000-000000000000', 'AI Provider Outage', 'Circuit breaker open on AI provider', '{"category":"ai_model","circuitBreakerOpen":true}',
   '[{"order":1,"instruction":"Verify provider status page and API health","automatable":true},{"order":2,"instruction":"Confirm automatic failover to alternate provider is active","automatable":true},{"order":3,"instruction":"Monitor response quality from fallback provider","automatable":false},{"order":4,"instruction":"Notify if degraded quality detected","automatable":false}]',
   2, 3, '{"ai_model"}'),

  ('00000000-0000-0000-0000-000000000000', 'Data Corruption Response', 'Data integrity check failure', '{"category":"data","integrityFailure":true}',
   '[{"order":1,"instruction":"IMMEDIATE: Stop writes to affected tables","automatable":false},{"order":2,"instruction":"Identify scope of corruption and affected records","automatable":true},{"order":3,"instruction":"Initiate point-in-time recovery from backup","automatable":false},{"order":4,"instruction":"Verify restoration with checksums","automatable":true},{"order":5,"instruction":"Replay lost transactions from event log","automatable":false}]',
   1, 2, '{"data"}'),

  ('00000000-0000-0000-0000-000000000000', 'Cost Anomaly', 'AWS bill spike >200%', '{"category":"billing","costSpikePercent":200}',
   '[{"order":1,"instruction":"Identify cost source in AWS Cost Explorer","automatable":true},{"order":2,"instruction":"Check for crypto mining or resource abuse","automatable":true},{"order":3,"instruction":"Apply emergency budget limits if abuse confirmed","automatable":false},{"order":4,"instruction":"Remediate root cause and document","automatable":false}]',
   2, 3, '{"billing"}'),

  ('00000000-0000-0000-0000-000000000000', 'Tenant Isolation Breach', 'Cross-tenant data detected in response', '{"category":"tenant","isolationBreach":true}',
   '[{"order":1,"instruction":"IMMEDIATE: Block affected endpoint","automatable":true},{"order":2,"instruction":"Assess data exposure and identify affected tenants","automatable":false},{"order":3,"instruction":"Trigger Evidence Locker for compliance","automatable":true},{"order":4,"instruction":"Notify affected tenants per HIPAA/GDPR if PHI/PII involved","automatable":false},{"order":5,"instruction":"Root cause analysis on RLS policy failure","automatable":false}]',
   1, 1, '{"tenant","security","compliance"}');

-- ---------------------------------------------------------------------------
-- Seed: Default Remediation Rules (all start in Shadow Mode)
-- ---------------------------------------------------------------------------

INSERT INTO sentinel_remediation_rules (tenant_id, action, target_service, state, trigger_condition, cooldown_minutes, max_retries, shadow_mode_started_at, description) VALUES
  ('00000000-0000-0000-0000-000000000000', 'lambda_redeploy', '*', 'shadow', '5xx_error_rate > 10% for 5 min', 15, 3, NOW(), 'Redeploy Lambda from last-known-good on sustained errors'),
  ('00000000-0000-0000-0000-000000000000', 'ecs_task_restart', '*', 'shadow', 'health_check_failure 3x consecutive', 5, 5, NOW(), 'Restart ECS task on repeated health check failures'),
  ('00000000-0000-0000-0000-000000000000', 'cache_rebuild', 'elasticache', 'shadow', 'cache_failure or eviction_rate > 90%', 10, 2, NOW(), 'Rebuild cache from Aurora on Redis failure'),
  ('00000000-0000-0000-0000-000000000000', 'connection_pool_reset', 'aurora-postgres', 'shadow', 'pool_exhaustion > 90%', 5, 3, NOW(), 'Reset connection pool on exhaustion'),
  ('00000000-0000-0000-0000-000000000000', 'ai_provider_failover', '*', 'shadow', 'provider_error_rate > 5% or semantic_probe_failure', 1, 0, NOW(), 'Circuit breaker: failover to alternate AI provider'),
  ('00000000-0000-0000-0000-000000000000', 'queue_drain_to_dlq', '*', 'shadow', 'message_age > 15 min', 10, 1, NOW(), 'Drain stale messages to DLQ for investigation'),
  ('00000000-0000-0000-0000-000000000000', 'certificate_renewal', '*', 'shadow', 'cert_expiry < 7 days', 1440, 3, NOW(), 'Auto-renew expiring certificates via ACM');

-- ---------------------------------------------------------------------------
-- RLS Policies
-- ---------------------------------------------------------------------------

ALTER TABLE sentinel_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_incident_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_evidence_locker ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_remediation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_remediation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_shadow_mode_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_postmortems ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY sentinel_incidents_tenant ON sentinel_incidents
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID
         OR tenant_id = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY sentinel_timeline_tenant ON sentinel_incident_timeline
  USING (incident_id IN (
    SELECT id FROM sentinel_incidents
    WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
       OR tenant_id = '00000000-0000-0000-0000-000000000000'::UUID
  ));

CREATE POLICY sentinel_evidence_tenant ON sentinel_evidence_locker
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID
         OR tenant_id = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY sentinel_rules_tenant ON sentinel_remediation_rules
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID
         OR tenant_id = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY sentinel_remediation_tenant ON sentinel_remediation_log
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID
         OR tenant_id = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY sentinel_shadow_tenant ON sentinel_shadow_mode_log
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID
         OR tenant_id = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY sentinel_postmortems_tenant ON sentinel_postmortems
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID
         OR tenant_id = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY sentinel_playbooks_tenant ON sentinel_playbooks
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID
         OR tenant_id = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY sentinel_prefs_tenant ON sentinel_alert_preferences
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID
         OR tenant_id = '00000000-0000-0000-0000-000000000000'::UUID);

CREATE POLICY sentinel_notif_tenant ON sentinel_notifications
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID
         OR tenant_id = '00000000-0000-0000-0000-000000000000'::UUID);
