-- RADIANT v4.18.0 - Security Schedule Configuration
-- Runtime-adjustable EventBridge schedules for security monitoring
-- ============================================================================

-- Security schedule configuration per tenant
CREATE TABLE IF NOT EXISTS security_schedule_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Drift Detection Schedule
  drift_detection_enabled BOOLEAN NOT NULL DEFAULT true,
  drift_detection_cron VARCHAR(100) NOT NULL DEFAULT '0 0 * * ? *',
  drift_detection_description VARCHAR(255) DEFAULT 'Daily at midnight UTC',
  
  -- Anomaly Detection Schedule
  anomaly_detection_enabled BOOLEAN NOT NULL DEFAULT true,
  anomaly_detection_cron VARCHAR(100) NOT NULL DEFAULT '0 * * * ? *',
  anomaly_detection_description VARCHAR(255) DEFAULT 'Every hour',
  
  -- Classification Review Schedule
  classification_review_enabled BOOLEAN NOT NULL DEFAULT true,
  classification_review_cron VARCHAR(100) NOT NULL DEFAULT '0 0,6,12,18 * * ? *',
  classification_review_description VARCHAR(255) DEFAULT 'Every 6 hours',
  
  -- Weekly Security Scan Schedule
  weekly_security_scan_enabled BOOLEAN NOT NULL DEFAULT true,
  weekly_security_scan_cron VARCHAR(100) NOT NULL DEFAULT '0 2 ? * SUN *',
  weekly_security_scan_description VARCHAR(255) DEFAULT 'Sunday at 2 AM UTC',
  
  -- Weekly Benchmark Schedule
  weekly_benchmark_enabled BOOLEAN NOT NULL DEFAULT true,
  weekly_benchmark_cron VARCHAR(100) NOT NULL DEFAULT '0 3 ? * SAT *',
  weekly_benchmark_description VARCHAR(255) DEFAULT 'Saturday at 3 AM UTC',
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  
  UNIQUE(tenant_id)
);

-- Schedule execution history
CREATE TABLE IF NOT EXISTS security_schedule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  schedule_type VARCHAR(50) NOT NULL,
  
  -- Execution details
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  
  -- Results
  items_processed INTEGER DEFAULT 0,
  items_flagged INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  
  -- Details
  details JSONB DEFAULT '{}',
  error_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Schedule change audit log
CREATE TABLE IF NOT EXISTS security_schedule_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  
  schedule_type VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,
  
  old_cron VARCHAR(100),
  new_cron VARCHAR(100),
  old_enabled BOOLEAN,
  new_enabled BOOLEAN,
  
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_security_schedule_config_tenant 
  ON security_schedule_config(tenant_id);

CREATE INDEX IF NOT EXISTS idx_security_schedule_executions_tenant_type 
  ON security_schedule_executions(tenant_id, schedule_type);

CREATE INDEX IF NOT EXISTS idx_security_schedule_executions_started 
  ON security_schedule_executions(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_schedule_audit_tenant 
  ON security_schedule_audit(tenant_id, created_at DESC);

-- RLS Policies
ALTER TABLE security_schedule_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_schedule_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_schedule_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_schedule_config_tenant_isolation ON security_schedule_config
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY security_schedule_executions_tenant_isolation ON security_schedule_executions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY security_schedule_audit_tenant_isolation ON security_schedule_audit
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_security_schedule_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER security_schedule_config_updated
  BEFORE UPDATE ON security_schedule_config
  FOR EACH ROW
  EXECUTE FUNCTION update_security_schedule_config_timestamp();

-- Schedule templates
CREATE TABLE IF NOT EXISTS security_schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  name VARCHAR(100) NOT NULL,
  description TEXT,
  schedules JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_schedule_templates_tenant 
  ON security_schedule_templates(tenant_id);

ALTER TABLE security_schedule_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_schedule_templates_tenant_isolation ON security_schedule_templates
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid OR is_default = true);

-- Notification configuration
CREATE TABLE IF NOT EXISTS security_schedule_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  enabled BOOLEAN NOT NULL DEFAULT false,
  sns_topic_arn VARCHAR(500),
  slack_webhook_url VARCHAR(500),
  email_recipients TEXT[] DEFAULT '{}',
  
  notify_on_success BOOLEAN NOT NULL DEFAULT false,
  notify_on_failure BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id)
);

ALTER TABLE security_schedule_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_schedule_notifications_tenant_isolation ON security_schedule_notifications
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Webhook registrations
CREATE TABLE IF NOT EXISTS security_schedule_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  url VARCHAR(500) NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret VARCHAR(255),
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_schedule_webhooks_tenant 
  ON security_schedule_webhooks(tenant_id);

ALTER TABLE security_schedule_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_schedule_webhooks_tenant_isolation ON security_schedule_webhooks
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Insert default templates
INSERT INTO security_schedule_templates (tenant_id, name, description, schedules, is_default) VALUES
  ('00000000-0000-0000-0000-000000000000', 'Production (Conservative)', 
   'Conservative schedules for production: fewer checks, less resource usage',
   '[{"type":"drift_detection","enabled":true,"cronExpression":"0 0 * * ? *"},{"type":"anomaly_detection","enabled":true,"cronExpression":"0 0/4 * * ? *"},{"type":"classification_review","enabled":true,"cronExpression":"0 0,12 * * ? *"},{"type":"weekly_security_scan","enabled":true,"cronExpression":"0 2 ? * SUN *"},{"type":"weekly_benchmark","enabled":true,"cronExpression":"0 3 ? * SAT *"}]',
   true),
  ('00000000-0000-0000-0000-000000000000', 'Development (Aggressive)', 
   'Frequent checks for development environments',
   '[{"type":"drift_detection","enabled":true,"cronExpression":"0 0/6 * * ? *"},{"type":"anomaly_detection","enabled":true,"cronExpression":"0/30 * * * ? *"},{"type":"classification_review","enabled":true,"cronExpression":"0 * * * ? *"},{"type":"weekly_security_scan","enabled":true,"cronExpression":"0 0 * * ? *"},{"type":"weekly_benchmark","enabled":true,"cronExpression":"0 6 ? * MON,WED,FRI *"}]',
   true),
  ('00000000-0000-0000-0000-000000000000', 'Minimal', 
   'Minimal monitoring for low-traffic tenants',
   '[{"type":"drift_detection","enabled":true,"cronExpression":"0 0 ? * MON *"},{"type":"anomaly_detection","enabled":false,"cronExpression":"0 * * * ? *"},{"type":"classification_review","enabled":true,"cronExpression":"0 0 ? * MON *"},{"type":"weekly_security_scan","enabled":true,"cronExpression":"0 2 ? * SUN *"},{"type":"weekly_benchmark","enabled":false,"cronExpression":"0 3 ? * SAT *"}]',
   true)
ON CONFLICT DO NOTHING;

-- Insert default config for existing tenants
INSERT INTO security_schedule_config (tenant_id)
SELECT id FROM tenants
WHERE id NOT IN (SELECT tenant_id FROM security_schedule_config)
ON CONFLICT (tenant_id) DO NOTHING;
