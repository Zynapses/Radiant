-- RADIANT v4.18.0 - Migration 071: Background AGI Learning

-- Background Learning Config
CREATE TABLE IF NOT EXISTS background_learning_config (
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    throttle_level TEXT NOT NULL DEFAULT 'medium' CHECK (throttle_level IN ('off', 'minimal', 'low', 'medium', 'high', 'maximum')),
    max_hourly_cost_cents INTEGER NOT NULL DEFAULT 100,
    max_daily_cost_cents INTEGER NOT NULL DEFAULT 1000,
    max_monthly_cost_cents INTEGER NOT NULL DEFAULT 20000,
    batch_size INTEGER NOT NULL DEFAULT 50,
    priority_mode TEXT NOT NULL DEFAULT 'balanced',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

CREATE INDEX idx_bg_learning_config_tenant ON background_learning_config(tenant_id);

-- Learning Costs Tracking
CREATE TABLE IF NOT EXISTS learning_costs (
    cost_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cost_cents DECIMAL(10,2) NOT NULL DEFAULT 0,
    cost_type TEXT NOT NULL DEFAULT 'learning',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learning_costs_tenant ON learning_costs(tenant_id);
CREATE INDEX idx_learning_costs_created ON learning_costs(created_at);

-- Learning Events
CREATE TABLE IF NOT EXISTS learning_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    cost_cents DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learning_events_tenant ON learning_events(tenant_id);
CREATE INDEX idx_learning_events_type ON learning_events(event_type);
CREATE INDEX idx_learning_events_created ON learning_events(created_at);

-- Add processed_for_learning to learning_feedback if not exists
DO $$ BEGIN
    ALTER TABLE learning_feedback ADD COLUMN IF NOT EXISTS processed_for_learning BOOLEAN DEFAULT false;
    ALTER TABLE learning_feedback ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
    ALTER TABLE learning_feedback ADD COLUMN IF NOT EXISTS model_id TEXT;
    ALTER TABLE learning_feedback ADD COLUMN IF NOT EXISTS task_type TEXT;
    ALTER TABLE learning_feedback ADD COLUMN IF NOT EXISTS is_positive BOOLEAN;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- RLS
ALTER TABLE background_learning_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_bg_config ON background_learning_config USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_learning_costs ON learning_costs USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_learning_events ON learning_events USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
