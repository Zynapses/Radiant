-- ============================================================================
-- RADIANT v4.18.0 — Account Lockout Resolution System
-- Migration: V2026_02_07_017
--
-- Implements progressive automated lockouts with manual admin override.
--
-- Policy:
--   1st offense:        30 min auto-unlock
--   2nd offense (7d):   2 hour auto-unlock
--   3rd offense (7d):   24 hour auto-unlock
--   4th+ offense (30d): Permanent — requires admin review
--
-- Standards:
--   NIST SP 800-63B §5.2.8: Account lockout throttling
--   NIST CSF PR.AC-07: User authentication
--   CIS Control 6.2: Establish access revocation process
--   SOC 2 CC6.1: Logical and physical access controls
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ENUM: lockout_reason categorization
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE lockout_reason_type AS ENUM (
    'brute_force',
    'credential_stuffing',
    'impossible_travel',
    'session_hijack',
    'account_takeover',
    'privilege_escalation',
    'cross_tenant_probe',
    'admin_manual',
    'policy_violation',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE lockout_status AS ENUM (
    'active',
    'auto_unlocked',
    'admin_unlocked',
    'self_service_unlocked',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- ALTER users: add lockout columns
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS account_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_locked_reason TEXT,
  ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_lock_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_lock_permanent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_lockout_id UUID;

CREATE INDEX IF NOT EXISTS idx_users_account_locked
  ON users (tenant_id) WHERE account_locked = true;

-- ---------------------------------------------------------------------------
-- TABLE: account_lockout_history — full history of every lockout event
-- (CIS Control 6.2: track access revocation events)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_lockout_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  user_id         UUID NOT NULL,

  -- Lockout details
  reason_type     lockout_reason_type NOT NULL DEFAULT 'other',
  reason_text     TEXT NOT NULL,
  severity        intrusion_severity NOT NULL DEFAULT 'high',
  detector_id     TEXT,
  source_ip       INET,
  incident_id     UUID,

  -- Duration policy
  offense_number  INTEGER NOT NULL DEFAULT 1,
  duration_minutes INTEGER,
  locked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until    TIMESTAMPTZ,
  is_permanent    BOOLEAN NOT NULL DEFAULT false,

  -- Resolution
  status          lockout_status NOT NULL DEFAULT 'active',
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID,
  resolution_notes TEXT,

  -- Metadata
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lockout_history_user
  ON account_lockout_history (tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lockout_history_active
  ON account_lockout_history (status, locked_until)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_lockout_history_tenant
  ON account_lockout_history (tenant_id, created_at DESC);

ALTER TABLE account_lockout_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY lockout_history_tenant_isolation ON account_lockout_history
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid
         OR current_setting('app.current_tenant_id', true) IS NULL);

-- ---------------------------------------------------------------------------
-- TABLE: lockout_policy — configurable per-tenant lockout settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lockout_policy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID UNIQUE,

  -- Progressive duration config (minutes)
  duration_1st    INTEGER NOT NULL DEFAULT 30,
  duration_2nd    INTEGER NOT NULL DEFAULT 120,
  duration_3rd    INTEGER NOT NULL DEFAULT 1440,
  permanent_after INTEGER NOT NULL DEFAULT 4,

  -- Offense window: how far back to count prior offenses
  offense_window_days INTEGER NOT NULL DEFAULT 7,
  permanent_window_days INTEGER NOT NULL DEFAULT 30,

  -- Self-service unlock
  self_service_enabled BOOLEAN NOT NULL DEFAULT false,
  self_service_max_offense INTEGER NOT NULL DEFAULT 2,
  self_service_method TEXT NOT NULL DEFAULT 'email_verification',

  -- Auto-unlock settings
  auto_unlock_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Notifications
  notify_user_on_lock BOOLEAN NOT NULL DEFAULT true,
  notify_admin_on_permanent BOOLEAN NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed global default policy (tenant_id = NULL → applies to all tenants without override)
INSERT INTO lockout_policy (tenant_id) VALUES (NULL)
ON CONFLICT (tenant_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- FUNCTION: calculate_lockout_duration
-- Returns duration in minutes based on offense count and policy
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_lockout_duration(
  p_tenant_id UUID,
  p_user_id UUID
) RETURNS TABLE (
  offense_number INTEGER,
  duration_minutes INTEGER,
  is_permanent BOOLEAN,
  locked_until TIMESTAMPTZ
) AS $$
DECLARE
  v_policy lockout_policy%ROWTYPE;
  v_recent_count INTEGER;
  v_permanent_count INTEGER;
  v_duration INTEGER;
  v_is_permanent BOOLEAN := false;
BEGIN
  -- Get policy (tenant-specific or global default)
  SELECT * INTO v_policy FROM lockout_policy
    WHERE lockout_policy.tenant_id = p_tenant_id
    LIMIT 1;
  IF NOT FOUND THEN
    SELECT * INTO v_policy FROM lockout_policy
      WHERE lockout_policy.tenant_id IS NULL
      LIMIT 1;
  END IF;

  -- Count recent offenses within offense window
  SELECT COUNT(*) INTO v_recent_count
  FROM account_lockout_history
  WHERE account_lockout_history.tenant_id = p_tenant_id
    AND user_id = p_user_id
    AND created_at > now() - (v_policy.offense_window_days || ' days')::interval;

  -- Count offenses in permanent window
  SELECT COUNT(*) INTO v_permanent_count
  FROM account_lockout_history
  WHERE account_lockout_history.tenant_id = p_tenant_id
    AND user_id = p_user_id
    AND created_at > now() - (v_policy.permanent_window_days || ' days')::interval;

  -- offense_number is v_recent_count + 1 (this is the new offense)
  offense_number := v_recent_count + 1;

  -- Check permanent threshold (uses wider window)
  IF v_permanent_count + 1 >= v_policy.permanent_after THEN
    v_is_permanent := true;
    duration_minutes := NULL;
    is_permanent := true;
    locked_until := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Progressive duration
  CASE offense_number
    WHEN 1 THEN v_duration := v_policy.duration_1st;
    WHEN 2 THEN v_duration := v_policy.duration_2nd;
    WHEN 3 THEN v_duration := v_policy.duration_3rd;
    ELSE v_duration := v_policy.duration_3rd * 2;
  END CASE;

  duration_minutes := v_duration;
  is_permanent := false;
  locked_until := now() + (v_duration || ' minutes')::interval;

  RETURN NEXT;
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- FUNCTION: auto_unlock_expired_accounts
-- Called periodically by the analyzer Lambda
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_unlock_expired_accounts()
RETURNS TABLE (unlocked_count INTEGER) AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Find and unlock expired lockouts
  WITH expired AS (
    UPDATE users SET
      account_locked = false,
      account_locked_reason = NULL,
      account_locked_at = NULL,
      account_locked_until = NULL,
      account_lock_permanent = false
    WHERE account_locked = true
      AND account_lock_permanent = false
      AND account_locked_until IS NOT NULL
      AND account_locked_until <= now()
    RETURNING id, tenant_id
  ),
  history_update AS (
    UPDATE account_lockout_history SET
      status = 'auto_unlocked',
      resolved_at = now(),
      resolution_notes = 'Auto-unlocked: lockout duration expired'
    WHERE status = 'active'
      AND is_permanent = false
      AND locked_until IS NOT NULL
      AND locked_until <= now()
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  unlocked_count := v_count;
  RETURN NEXT;
  RETURN;
END;
$$ LANGUAGE plpgsql;
