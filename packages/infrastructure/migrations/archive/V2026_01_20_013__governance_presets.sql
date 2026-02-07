-- ============================================================================
-- RADIANT v4.18.0 - Governance Presets (Variable Friction)
-- Project Cato Integration: User-friendly "leash length" abstraction
-- ============================================================================

-- Tenant governance configuration
CREATE TABLE IF NOT EXISTS tenant_governance_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Selected preset (paranoid, balanced, cowboy)
    active_preset VARCHAR(20) NOT NULL DEFAULT 'balanced',
    
    -- Custom overrides (null = use preset defaults)
    custom_friction_level DECIMAL(3,2),
    custom_auto_approve_threshold DECIMAL(3,2),
    
    -- Checkpoint overrides (null = use preset defaults)
    checkpoint_after_observer VARCHAR(20),
    checkpoint_after_proposer VARCHAR(20),
    checkpoint_after_critics VARCHAR(20),
    checkpoint_before_execution VARCHAR(20),
    checkpoint_after_execution VARCHAR(20),
    
    -- Budget controls
    daily_budget_cents INTEGER NOT NULL DEFAULT 50000,
    max_action_cost_cents INTEGER NOT NULL DEFAULT 500,
    
    -- Compliance frameworks (array)
    compliance_frameworks TEXT[] NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_preset CHECK (active_preset IN ('paranoid', 'balanced', 'cowboy')),
    CONSTRAINT valid_checkpoint_modes CHECK (
        (checkpoint_after_observer IS NULL OR checkpoint_after_observer IN ('ALWAYS', 'CONDITIONAL', 'NEVER', 'NOTIFY_ONLY')) AND
        (checkpoint_after_proposer IS NULL OR checkpoint_after_proposer IN ('ALWAYS', 'CONDITIONAL', 'NEVER', 'NOTIFY_ONLY')) AND
        (checkpoint_after_critics IS NULL OR checkpoint_after_critics IN ('ALWAYS', 'CONDITIONAL', 'NEVER', 'NOTIFY_ONLY')) AND
        (checkpoint_before_execution IS NULL OR checkpoint_before_execution IN ('ALWAYS', 'CONDITIONAL', 'NEVER', 'NOTIFY_ONLY')) AND
        (checkpoint_after_execution IS NULL OR checkpoint_after_execution IN ('ALWAYS', 'CONDITIONAL', 'NEVER', 'NOTIFY_ONLY'))
    ),
    UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE tenant_governance_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY tenant_governance_config_tenant_isolation ON tenant_governance_config
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Governance preset change log (audit trail)
CREATE TABLE IF NOT EXISTS governance_preset_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Change details
    previous_preset VARCHAR(20),
    new_preset VARCHAR(20) NOT NULL,
    changed_by UUID REFERENCES users(id),
    change_reason TEXT,
    
    -- Snapshot of config at time of change
    config_snapshot JSONB NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE governance_preset_changes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY governance_preset_changes_tenant_isolation ON governance_preset_changes
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Checkpoint decisions log
CREATE TABLE IF NOT EXISTS governance_checkpoint_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Context
    session_id UUID NOT NULL,
    user_id UUID REFERENCES users(id),
    pipeline_id UUID,
    
    -- Checkpoint info
    checkpoint_type VARCHAR(30) NOT NULL,
    checkpoint_mode VARCHAR(20) NOT NULL,
    
    -- Decision
    decision VARCHAR(20) NOT NULL,
    decided_by VARCHAR(20) NOT NULL, -- 'AUTO', 'USER', 'TIMEOUT'
    decision_reason TEXT,
    
    -- Risk context at checkpoint
    risk_score DECIMAL(5,4),
    confidence_score DECIMAL(5,4),
    cost_estimate_cents INTEGER,
    
    -- Timing
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    timeout_at TIMESTAMPTZ,
    
    -- Modifications (if user modified plan)
    modifications JSONB,
    feedback TEXT,
    
    CONSTRAINT valid_checkpoint_type CHECK (checkpoint_type IN (
        'AFTER_OBSERVER', 'AFTER_PROPOSER', 'AFTER_CRITICS', 
        'BEFORE_EXECUTION', 'AFTER_EXECUTION'
    )),
    CONSTRAINT valid_decision CHECK (decision IN ('APPROVED', 'REJECTED', 'MODIFIED', 'TIMEOUT', 'PENDING'))
);

-- Enable RLS
ALTER TABLE governance_checkpoint_decisions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY governance_checkpoint_decisions_tenant_isolation ON governance_checkpoint_decisions
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Indexes
CREATE INDEX idx_tenant_governance_config_tenant ON tenant_governance_config(tenant_id);
CREATE INDEX idx_governance_preset_changes_tenant ON governance_preset_changes(tenant_id);
CREATE INDEX idx_governance_preset_changes_created ON governance_preset_changes(created_at DESC);
CREATE INDEX idx_governance_checkpoint_decisions_tenant ON governance_checkpoint_decisions(tenant_id);
CREATE INDEX idx_governance_checkpoint_decisions_session ON governance_checkpoint_decisions(session_id);
CREATE INDEX idx_governance_checkpoint_decisions_pending ON governance_checkpoint_decisions(tenant_id, decision) 
    WHERE decision = 'PENDING';

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_tenant_governance_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenant_governance_config_updated
    BEFORE UPDATE ON tenant_governance_config
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_governance_config_timestamp();

-- Insert default configs for existing tenants
INSERT INTO tenant_governance_config (tenant_id, active_preset, daily_budget_cents, max_action_cost_cents)
SELECT id, 'balanced', 50000, 500
FROM tenants
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_governance_config WHERE tenant_governance_config.tenant_id = tenants.id
);

COMMENT ON TABLE tenant_governance_config IS 'Governance preset configuration per tenant - Project Cato Variable Friction';
COMMENT ON TABLE governance_preset_changes IS 'Audit log of governance preset changes';
COMMENT ON TABLE governance_checkpoint_decisions IS 'Log of all checkpoint decisions for compliance and analytics';
