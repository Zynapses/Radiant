-- RADIANT v4.18.0 - Migration 070: Cost Monitoring Tables

-- Cost Alerts
CREATE TABLE IF NOT EXISTS cost_alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL DEFAULT 'threshold',
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    current_value DECIMAL(12,2) NOT NULL DEFAULT 0,
    threshold_value DECIMAL(12,2),
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cost_alerts_tenant ON cost_alerts(tenant_id);
CREATE INDEX idx_cost_alerts_resolved ON cost_alerts(resolved);

-- Cost Snapshots
CREATE TABLE IF NOT EXISTS cost_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    service_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    daily_costs JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cost_snapshots_tenant ON cost_snapshots(tenant_id);
CREATE INDEX idx_cost_snapshots_created ON cost_snapshots(created_at DESC);

-- Cost Budgets
CREATE TABLE IF NOT EXISTS cost_budgets (
    budget_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
    alert_thresholds JSONB NOT NULL DEFAULT '[50, 80, 100]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cost_budgets_tenant ON cost_budgets(tenant_id);

-- Row-Level Security
ALTER TABLE cost_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cost_alerts ON cost_alerts
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_cost_snapshots ON cost_snapshots
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_cost_budgets ON cost_budgets
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
