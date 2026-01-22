-- ============================================================================
-- Project Cato: Pipeline Configuration Table
-- Admin-configurable parameters for the Cato Method Pipeline
-- ============================================================================

-- Create the config table
CREATE TABLE IF NOT EXISTS cato_pipeline_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Governance Settings
    governance_preset VARCHAR(20) NOT NULL DEFAULT 'BALANCED' CHECK (governance_preset IN ('COWBOY', 'BALANCED', 'PARANOID')),
    custom_risk_thresholds JSONB,
    
    -- Method Execution Settings
    default_model VARCHAR(100) NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    fallback_model VARCHAR(100) NOT NULL DEFAULT 'gpt-4o',
    max_method_retries INTEGER NOT NULL DEFAULT 3,
    method_timeout_ms INTEGER NOT NULL DEFAULT 30000,
    
    -- Cost & Usage Limits
    max_pipeline_cost_cents INTEGER NOT NULL DEFAULT 1000,
    max_daily_pipeline_cost_cents INTEGER NOT NULL DEFAULT 10000,
    max_concurrent_pipelines INTEGER NOT NULL DEFAULT 10,
    
    -- Context Settings
    default_context_strategy VARCHAR(20) NOT NULL DEFAULT 'RELEVANT' CHECK (default_context_strategy IN ('FULL', 'SUMMARY', 'TAIL', 'RELEVANT', 'MINIMAL')),
    max_context_tokens INTEGER NOT NULL DEFAULT 8000,
    context_tail_count INTEGER NOT NULL DEFAULT 5,
    
    -- Compensation Settings
    enable_auto_compensation BOOLEAN NOT NULL DEFAULT true,
    compensation_timeout_ms INTEGER NOT NULL DEFAULT 60000,
    max_compensation_retries INTEGER NOT NULL DEFAULT 3,
    
    -- Audit Settings
    enable_merkle_audit BOOLEAN NOT NULL DEFAULT true,
    audit_retention_days INTEGER NOT NULL DEFAULT 2555,
    enable_prompt_audit BOOLEAN NOT NULL DEFAULT true,
    
    -- Feature Flags
    enable_critics BOOLEAN NOT NULL DEFAULT true,
    enable_red_team BOOLEAN NOT NULL DEFAULT false,
    enable_war_room BOOLEAN NOT NULL DEFAULT true,
    
    -- Notification Settings
    notify_on_checkpoint BOOLEAN NOT NULL DEFAULT true,
    notify_on_veto BOOLEAN NOT NULL DEFAULT true,
    notify_on_failure BOOLEAN NOT NULL DEFAULT true,
    notification_webhook_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(tenant_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cato_pipeline_config_tenant ON cato_pipeline_config(tenant_id);

-- Enable RLS
ALTER TABLE cato_pipeline_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY cato_pipeline_config_tenant_policy ON cato_pipeline_config
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON cato_pipeline_config TO radiant_app;

-- Add comments
COMMENT ON TABLE cato_pipeline_config IS 'Admin-configurable parameters for the Cato Method Pipeline per tenant';
COMMENT ON COLUMN cato_pipeline_config.governance_preset IS 'Governance mode: COWBOY (max autonomy), BALANCED (conditional), PARANOID (full oversight)';
COMMENT ON COLUMN cato_pipeline_config.custom_risk_thresholds IS 'Custom risk thresholds overriding preset defaults: {autoExecute, checkpoint, veto}';
COMMENT ON COLUMN cato_pipeline_config.max_pipeline_cost_cents IS 'Maximum cost in cents for a single pipeline execution';
COMMENT ON COLUMN cato_pipeline_config.max_daily_pipeline_cost_cents IS 'Maximum total pipeline cost in cents per 24-hour period';
COMMENT ON COLUMN cato_pipeline_config.enable_red_team IS 'Enable adversarial Red Team/Devils Advocate critic';
COMMENT ON COLUMN cato_pipeline_config.enable_war_room IS 'Enable multi-critic War Room deliberation template';
