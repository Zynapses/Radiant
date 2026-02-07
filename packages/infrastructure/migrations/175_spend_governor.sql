-- =============================================================================
-- RADIANT v7.39.0 — Spend Governor
-- Migration: 175
--
-- Two-layer spend control system:
--   Layer 1: Global AWS instance budget (tracked via AWS Budgets API)
--   Layer 2: Per-tenant AI spend governor (application-level enforcement)
--
-- New tables:
--   spend_governor_config        — Per-tenant budget configuration
--   spend_governor_audit         — Detailed suspension/restoration/alert log
--   spend_governor_overrides     — Temporary budget override tracking
--   spend_governor_cost_reports  — Scheduled cost report history
--   spend_governor_instance      — Global instance budget configuration
--   critical_alerts              — Platform-wide critical alert queue (banner)
--
-- New functions:
--   check_spend_budget()         — Fast budget check for model router gate
--   get_spend_summary()          — Aggregated spend for a tenant over a period
--   record_spend_event()         — Log governor actions with full context
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Global instance budget configuration (Layer 1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS spend_governor_instance (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_usd          NUMERIC(12, 2) NOT NULL DEFAULT 5000.00,
    period_hours        INTEGER NOT NULL DEFAULT 720,          -- 30 days = 720 hours
    warning_threshold   NUMERIC(3, 2) NOT NULL DEFAULT 0.90,
    suspend_threshold   NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    aws_budget_id       TEXT,                                  -- AWS Budgets resource ID
    aws_budget_arn      TEXT,                                  -- AWS Budgets ARN
    sns_topic_arn       TEXT,                                  -- SNS topic for budget alerts
    is_frozen           BOOLEAN NOT NULL DEFAULT false,        -- True when AWS services are frozen
    frozen_at           TIMESTAMPTZ,
    frozen_reason       TEXT,
    current_spend_usd   NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    last_spend_sync     TIMESTAMPTZ,
    cost_report_interval_hours INTEGER NOT NULL DEFAULT 24,    -- Send cost reports every X hours
    last_cost_report_at TIMESTAMPTZ,
    created_by          TEXT NOT NULL DEFAULT 'system',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure only one instance config row exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_spend_governor_instance_singleton
    ON spend_governor_instance ((true));

-- ---------------------------------------------------------------------------
-- 2. Per-tenant AI budget configuration (Layer 2)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS spend_governor_config (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    budget_usd          NUMERIC(12, 2) NOT NULL DEFAULT 1000.00,
    period_hours        INTEGER NOT NULL DEFAULT 720,          -- Flexible: any hours or days
    warning_threshold   NUMERIC(3, 2) NOT NULL DEFAULT 0.90,   -- 0.90 = alert at 90%
    suspend_threshold   NUMERIC(3, 2) NOT NULL DEFAULT 1.00,   -- 1.00 = suspend at 100%
    per_model_limit_usd NUMERIC(12, 2) DEFAULT 0,             -- Per-model cap (0 = no limit)
    is_enabled          BOOLEAN NOT NULL DEFAULT true,
    is_suspended        BOOLEAN NOT NULL DEFAULT false,        -- True when models are suspended
    suspended_at        TIMESTAMPTZ,
    suspended_reason    TEXT,
    warning_sent_at     TIMESTAMPTZ,                           -- Last warning notification
    current_spend_usd   NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Cached current spend
    last_spend_sync     TIMESTAMPTZ,                           -- Last time we recalculated
    created_by          TEXT NOT NULL DEFAULT 'system',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_spend_governor_config_tenant
    ON spend_governor_config (tenant_id);
CREATE INDEX IF NOT EXISTS idx_spend_governor_config_suspended
    ON spend_governor_config (is_suspended) WHERE is_suspended = true;

-- ---------------------------------------------------------------------------
-- 3. Audit log — every governor action with full context
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS spend_governor_audit (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID,                                  -- NULL for instance-level events
    action              TEXT NOT NULL,                          -- warning_sent, models_suspended,
                                                               -- models_restored, budget_increased,
                                                               -- override_granted, override_expired,
                                                               -- instance_frozen, instance_thawed,
                                                               -- cost_report_sent
    scope               TEXT NOT NULL DEFAULT 'tenant',        -- 'tenant' or 'instance'
    budget_usd          NUMERIC(12, 2),
    spent_usd           NUMERIC(12, 2),
    percent_used        NUMERIC(5, 4),
    period_hours        INTEGER,
    reason              TEXT,
    suspended_models    JSONB,                                 -- Array of model IDs affected
    frozen_services     JSONB,                                 -- Array of AWS services frozen
    performed_by        TEXT NOT NULL DEFAULT 'system:spend-governor',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spend_governor_audit_tenant
    ON spend_governor_audit (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spend_governor_audit_action
    ON spend_governor_audit (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spend_governor_audit_scope
    ON spend_governor_audit (scope, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Temporary override tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS spend_governor_overrides (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID,                                  -- NULL for instance-level
    scope               TEXT NOT NULL DEFAULT 'tenant',        -- 'tenant' or 'instance'
    granted_by          TEXT NOT NULL,                          -- super_admin ID
    granted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL,
    reason              TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    revoked_at          TIMESTAMPTZ,
    revoked_by          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spend_governor_overrides_active
    ON spend_governor_overrides (is_active, expires_at)
    WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_spend_governor_overrides_tenant
    ON spend_governor_overrides (tenant_id) WHERE tenant_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Cost report history — scheduled reports sent to super admins
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS spend_governor_cost_reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type         TEXT NOT NULL DEFAULT 'scheduled',     -- 'scheduled', 'on_demand', 'alert'
    scope               TEXT NOT NULL DEFAULT 'instance',      -- 'instance' or 'tenant'
    tenant_id           UUID,                                  -- NULL for instance reports
    period_start        TIMESTAMPTZ NOT NULL,
    period_end          TIMESTAMPTZ NOT NULL,
    total_spend_usd     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ai_spend_usd        NUMERIC(12, 2) NOT NULL DEFAULT 0,
    aws_spend_usd       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    breakdown           JSONB NOT NULL DEFAULT '{}',           -- By model, by tenant, by service
    recipients          JSONB NOT NULL DEFAULT '[]',           -- Who received this report
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spend_governor_reports_sent
    ON spend_governor_cost_reports (sent_at DESC);

-- ---------------------------------------------------------------------------
-- 6. Critical alerts queue — shown as banner on every admin page
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS critical_alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type          TEXT NOT NULL,                          -- spend_warning, spend_suspended,
                                                               -- instance_frozen, instance_thawed,
                                                               -- model_suspended, service_degraded
    severity            TEXT NOT NULL DEFAULT 'critical',       -- 'warning', 'critical', 'info'
    title               TEXT NOT NULL,
    message             TEXT NOT NULL,
    scope               TEXT NOT NULL DEFAULT 'instance',       -- 'instance' or 'tenant'
    tenant_id           UUID,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    is_dismissed        BOOLEAN NOT NULL DEFAULT false,
    dismissed_by        TEXT,
    dismissed_at        TIMESTAMPTZ,
    auto_resolve        BOOLEAN NOT NULL DEFAULT false,        -- Auto-dismiss when condition clears
    resolve_condition   TEXT,                                   -- JSON condition for auto-resolve
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_critical_alerts_active
    ON critical_alerts (is_active, severity, created_at DESC)
    WHERE is_active = true AND is_dismissed = false;

-- ---------------------------------------------------------------------------
-- 7. Function: Fast budget check for model router gate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_spend_budget(
    p_tenant_id UUID
) RETURNS TABLE (
    blocked BOOLEAN,
    warning BOOLEAN,
    percent_used NUMERIC,
    budget_usd NUMERIC,
    spent_usd NUMERIC,
    reason TEXT,
    has_override BOOLEAN
) LANGUAGE plpgsql AS $$
DECLARE
    v_config RECORD;
    v_override BOOLEAN;
    v_spent NUMERIC;
BEGIN
    -- Check for active config
    SELECT * INTO v_config
    FROM spend_governor_config
    WHERE spend_governor_config.tenant_id = p_tenant_id
      AND is_enabled = true;

    IF NOT FOUND THEN
        -- No config = unlimited
        RETURN QUERY SELECT false, false, 0.0::NUMERIC, 0.0::NUMERIC,
                            0.0::NUMERIC, ''::TEXT, false;
        RETURN;
    END IF;

    -- Check for active override
    SELECT EXISTS(
        SELECT 1 FROM spend_governor_overrides
        WHERE spend_governor_overrides.tenant_id = p_tenant_id
          AND is_active = true
          AND expires_at > NOW()
    ) INTO v_override;

    -- If override is active, allow through
    IF v_override THEN
        RETURN QUERY SELECT false, false, v_config.current_spend_usd / NULLIF(v_config.budget_usd, 0),
                            v_config.budget_usd, v_config.current_spend_usd,
                            'override_active'::TEXT, true;
        RETURN;
    END IF;

    -- Use cached spend (refreshed every 60s by the service)
    v_spent := v_config.current_spend_usd;

    -- Check thresholds
    IF v_config.budget_usd > 0 AND v_spent >= v_config.budget_usd * v_config.suspend_threshold THEN
        RETURN QUERY SELECT true, true, v_spent / NULLIF(v_config.budget_usd, 0),
                            v_config.budget_usd, v_spent,
                            'budget_exceeded'::TEXT, false;
    ELSIF v_config.budget_usd > 0 AND v_spent >= v_config.budget_usd * v_config.warning_threshold THEN
        RETURN QUERY SELECT false, true, v_spent / NULLIF(v_config.budget_usd, 0),
                            v_config.budget_usd, v_spent,
                            'approaching_limit'::TEXT, false;
    ELSE
        RETURN QUERY SELECT false, false, v_spent / NULLIF(v_config.budget_usd, 0),
                            v_config.budget_usd, v_spent,
                            ''::TEXT, false;
    END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Function: Aggregated spend for a tenant over a rolling period
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_spend_summary(
    p_tenant_id UUID,
    p_period_hours INTEGER DEFAULT 720
) RETURNS TABLE (
    total_spend_usd NUMERIC,
    total_requests BIGINT,
    by_model JSONB,
    by_provider JSONB,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH period AS (
        SELECT NOW() - (p_period_hours || ' hours')::INTERVAL AS start_time,
               NOW() AS end_time
    ),
    model_costs AS (
        SELECT ce.model_id,
               SUM(ce.cost_cents) / 100.0 AS cost_usd,
               COUNT(*) AS requests
        FROM cost_events ce, period p
        WHERE ce.tenant_id = p_tenant_id::TEXT
          AND ce.created_at >= p.start_time
        GROUP BY ce.model_id
    ),
    provider_costs AS (
        SELECT ce.provider,
               SUM(ce.cost_cents) / 100.0 AS cost_usd,
               COUNT(*) AS requests
        FROM cost_events ce, period p
        WHERE ce.tenant_id = p_tenant_id::TEXT
          AND ce.created_at >= p.start_time
        GROUP BY ce.provider
    )
    SELECT COALESCE(SUM(mc.cost_usd), 0.0)::NUMERIC AS total_spend_usd,
           COALESCE(SUM(mc.requests), 0)::BIGINT AS total_requests,
           COALESCE(jsonb_object_agg(mc.model_id, jsonb_build_object(
               'cost_usd', mc.cost_usd, 'requests', mc.requests
           )) FILTER (WHERE mc.model_id IS NOT NULL), '{}'::JSONB) AS by_model,
           COALESCE((SELECT jsonb_object_agg(pc.provider, jsonb_build_object(
               'cost_usd', pc.cost_usd, 'requests', pc.requests
           )) FROM provider_costs pc), '{}'::JSONB) AS by_provider,
           (SELECT p.start_time FROM period p) AS period_start,
           (SELECT p.end_time FROM period p) AS period_end
    FROM model_costs mc;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. Function: Record a governor event with full context
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_spend_event(
    p_tenant_id UUID,
    p_action TEXT,
    p_scope TEXT,
    p_budget_usd NUMERIC,
    p_spent_usd NUMERIC,
    p_reason TEXT,
    p_performed_by TEXT DEFAULT 'system:spend-governor',
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
    v_id UUID;
    v_percent NUMERIC;
BEGIN
    v_percent := CASE WHEN p_budget_usd > 0 THEN p_spent_usd / p_budget_usd ELSE 0 END;

    INSERT INTO spend_governor_audit (
        tenant_id, action, scope, budget_usd, spent_usd,
        percent_used, reason, performed_by, metadata
    ) VALUES (
        p_tenant_id, p_action, p_scope, p_budget_usd, p_spent_usd,
        v_percent, p_reason, p_performed_by, p_metadata
    ) RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. Seed default instance config if not exists
-- ---------------------------------------------------------------------------
INSERT INTO spend_governor_instance (
    budget_usd, period_hours, warning_threshold, suspend_threshold,
    cost_report_interval_hours, created_by
) VALUES (
    5000.00, 720, 0.90, 1.00, 24, 'system:migration'
) ON CONFLICT DO NOTHING;

COMMIT;
