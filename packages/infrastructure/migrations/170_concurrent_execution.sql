-- Migration: 170_concurrent_execution.sql
-- Moat #17: Concurrent Task Execution - Split-pane UI, WebSocket multiplexing, background queue

-- Concurrent execution configuration per tenant
CREATE TABLE IF NOT EXISTS concurrent_execution_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    max_panes INTEGER NOT NULL DEFAULT 4 CHECK (max_panes BETWEEN 1 AND 8),
    max_concurrent_tasks INTEGER NOT NULL DEFAULT 4 CHECK (max_concurrent_tasks BETWEEN 1 AND 10),
    max_queue_depth INTEGER NOT NULL DEFAULT 20 CHECK (max_queue_depth BETWEEN 1 AND 100),
    default_layout VARCHAR(50) NOT NULL DEFAULT 'horizontal-2',
    default_sync_mode VARCHAR(50) NOT NULL DEFAULT 'independent',
    enable_comparison BOOLEAN NOT NULL DEFAULT true,
    enable_merge BOOLEAN NOT NULL DEFAULT true,
    websocket_max_streams INTEGER NOT NULL DEFAULT 4,
    websocket_heartbeat_interval INTEGER NOT NULL DEFAULT 30000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- Concurrent tasks
CREATE TABLE IF NOT EXISTS concurrent_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    session_id UUID NOT NULL,
    pane_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    task_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    prompt TEXT NOT NULL,
    model_id VARCHAR(100),
    result JSONB,
    progress JSONB NOT NULL DEFAULT '{"percentage": 0, "stage": "queued"}',
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    CONSTRAINT valid_status CHECK (status IN ('queued', 'running', 'streaming', 'completed', 'failed', 'cancelled')),
    CONSTRAINT valid_task_type CHECK (task_type IN ('chat', 'analysis', 'generation', 'comparison', 'research', 'coding')),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'critical'))
);

-- Split pane configurations
CREATE TABLE IF NOT EXISTS split_pane_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    layout VARCHAR(50) NOT NULL DEFAULT 'horizontal-2',
    panes JSONB NOT NULL DEFAULT '[]',
    sync_mode VARCHAR(50) NOT NULL DEFAULT 'independent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_layout CHECK (layout IN ('single', 'horizontal-2', 'vertical-2', 'grid-4', 'focus-left', 'focus-right')),
    CONSTRAINT valid_sync_mode CHECK (sync_mode IN ('independent', 'mirror-input', 'compare-output'))
);

-- Task comparisons
CREATE TABLE IF NOT EXISTS task_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    task_ids UUID[] NOT NULL,
    similarities JSONB NOT NULL DEFAULT '[]',
    differences JSONB NOT NULL DEFAULT '[]',
    merged_result TEXT,
    recommendation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Concurrent execution metrics
CREATE TABLE IF NOT EXISTS concurrent_execution_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period VARCHAR(50) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    total_tasks INTEGER NOT NULL DEFAULT 0,
    concurrent_peak_tasks INTEGER NOT NULL DEFAULT 0,
    average_concurrency DECIMAL(5,2) NOT NULL DEFAULT 0,
    tasks_by_type JSONB NOT NULL DEFAULT '{}',
    average_latency_ms INTEGER NOT NULL DEFAULT 0,
    total_cost_usd DECIMAL(10,4) NOT NULL DEFAULT 0,
    comparisons_made INTEGER NOT NULL DEFAULT 0,
    merges_performed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, period, period_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_concurrent_tasks_tenant ON concurrent_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_concurrent_tasks_user ON concurrent_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_concurrent_tasks_session ON concurrent_tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_concurrent_tasks_status ON concurrent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_concurrent_tasks_created ON concurrent_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_split_pane_configs_user ON split_pane_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comparisons_tenant ON task_comparisons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_concurrent_metrics_tenant ON concurrent_execution_metrics(tenant_id, period_start);

-- RLS Policies
ALTER TABLE concurrent_execution_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE concurrent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_pane_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE concurrent_execution_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY concurrent_config_tenant_isolation ON concurrent_execution_config
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY concurrent_tasks_tenant_isolation ON concurrent_tasks
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY split_pane_tenant_isolation ON split_pane_configs
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY task_comparisons_tenant_isolation ON task_comparisons
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY concurrent_metrics_tenant_isolation ON concurrent_execution_metrics
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Comments
COMMENT ON TABLE concurrent_execution_config IS 'Moat #17: Concurrent Task Execution configuration per tenant';
COMMENT ON TABLE concurrent_tasks IS 'Moat #17: Individual concurrent tasks with status and results';
COMMENT ON TABLE split_pane_configs IS 'Moat #17: User split-pane UI configurations';
COMMENT ON TABLE task_comparisons IS 'Moat #17: Multi-model task comparison results';
COMMENT ON TABLE concurrent_execution_metrics IS 'Moat #17: Usage metrics for concurrent execution';
