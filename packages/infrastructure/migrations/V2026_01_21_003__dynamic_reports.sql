-- Dynamic Reports Schema
-- Supports schema-adaptive report generation

-- Dynamic report definitions table
CREATE TABLE IF NOT EXISTS dynamic_reports (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    definition JSONB NOT NULL,
    schedule VARCHAR(20) DEFAULT 'manual' CHECK (schedule IN ('manual', 'daily', 'weekly', 'monthly')),
    format VARCHAR(20) DEFAULT 'json' CHECK (format IN ('json', 'csv', 'pdf', 'excel')),
    is_favorite BOOLEAN DEFAULT FALSE,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    run_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report execution history
CREATE TABLE IF NOT EXISTS dynamic_report_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id VARCHAR(64) NOT NULL REFERENCES dynamic_reports(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    executed_by UUID REFERENCES users(id),
    execution_time_ms INTEGER,
    row_count INTEGER,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed')),
    error_message TEXT,
    result_summary JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report schedules
CREATE TABLE IF NOT EXISTS dynamic_report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id VARCHAR(64) NOT NULL REFERENCES dynamic_reports(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cron_expression VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',
    recipients TEXT[], -- Email addresses
    is_active BOOLEAN DEFAULT TRUE,
    last_sent_at TIMESTAMPTZ,
    next_send_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dynamic_reports_tenant ON dynamic_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_reports_schedule ON dynamic_reports(schedule) WHERE schedule != 'manual';
CREATE INDEX IF NOT EXISTS idx_dynamic_reports_favorite ON dynamic_reports(tenant_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_dynamic_report_executions_report ON dynamic_report_executions(report_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_report_executions_tenant ON dynamic_report_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_report_schedules_active ON dynamic_report_schedules(is_active, next_send_at) WHERE is_active = TRUE;

-- RLS Policies
ALTER TABLE dynamic_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_report_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY dynamic_reports_tenant_isolation ON dynamic_reports
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY dynamic_report_executions_tenant_isolation ON dynamic_report_executions
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY dynamic_report_schedules_tenant_isolation ON dynamic_report_schedules
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_dynamic_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_dynamic_reports_updated_at
    BEFORE UPDATE ON dynamic_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_dynamic_reports_updated_at();

CREATE TRIGGER trigger_dynamic_report_schedules_updated_at
    BEFORE UPDATE ON dynamic_report_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_dynamic_reports_updated_at();

-- Function to update run statistics
CREATE OR REPLACE FUNCTION update_report_run_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE dynamic_reports
    SET 
        last_run_at = NEW.created_at,
        run_count = run_count + 1
    WHERE id = NEW.report_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_report_run_stats
    AFTER INSERT ON dynamic_report_executions
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION update_report_run_stats();
