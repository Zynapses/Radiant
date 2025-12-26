-- ============================================================================
-- RADIANT v4.17.0 - Scheduled Prompts Migration
-- ============================================================================

CREATE TABLE scheduled_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    prompt_name VARCHAR(200) NOT NULL,
    prompt_text TEXT NOT NULL,
    model VARCHAR(100) NOT NULL,
    schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('once', 'cron', 'interval')),
    cron_expression VARCHAR(100),
    run_at TIMESTAMPTZ,
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    max_runs INTEGER,
    run_count INTEGER DEFAULT 0,
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    notification_email VARCHAR(255),
    output_destination VARCHAR(50) DEFAULT 'email' CHECK (output_destination IN ('email', 'webhook', 'storage')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scheduled_prompt_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES scheduled_prompts(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    output TEXT,
    tokens_used INTEGER,
    cost DECIMAL(10, 6),
    latency_ms INTEGER,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scheduled_prompts_user ON scheduled_prompts(tenant_id, user_id);
CREATE INDEX idx_scheduled_prompts_next_run ON scheduled_prompts(next_run) WHERE is_active = true;
CREATE INDEX idx_scheduled_prompts_active ON scheduled_prompts(is_active, next_run);
CREATE INDEX idx_prompt_runs ON scheduled_prompt_runs(prompt_id, created_at DESC);
CREATE INDEX idx_prompt_runs_status ON scheduled_prompt_runs(status);

ALTER TABLE scheduled_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_prompt_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY scheduled_prompts_isolation ON scheduled_prompts 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY prompt_runs_isolation ON scheduled_prompt_runs 
    USING (prompt_id IN (SELECT id FROM scheduled_prompts WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));
