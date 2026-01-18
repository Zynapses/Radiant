-- RADIANT v5.12.5 - Admin Reports System
-- Full report writer with scheduling, recipients, and multi-format generation

-- ============================================================================
-- 1. REPORT TEMPLATES (Pre-built report types)
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template info
  name VARCHAR(200) NOT NULL,
  description TEXT,
  template_key VARCHAR(100) NOT NULL UNIQUE, -- 'usage-summary', 'cost-breakdown', etc.
  
  -- Report type
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
    'usage', 'cost', 'security', 'performance', 'compliance', 'custom'
  )),
  
  -- What metrics/data this template includes
  metrics JSONB DEFAULT '[]', -- ['API Calls', 'Tokens Used', 'Active Users']
  data_sources JSONB DEFAULT '[]', -- ['usage_logs', 'billing_events', etc.]
  
  -- Default settings
  default_format VARCHAR(20) DEFAULT 'pdf' CHECK (default_format IN ('pdf', 'csv', 'json', 'excel')),
  default_schedule VARCHAR(20) DEFAULT 'manual' CHECK (default_schedule IN ('manual', 'daily', 'weekly', 'monthly')),
  
  -- Template SQL/query (for custom reports)
  query_template TEXT,
  
  -- UI metadata
  icon VARCHAR(50) DEFAULT 'FileText',
  color VARCHAR(50) DEFAULT 'blue',
  preview_image_url VARCHAR(500),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT true, -- System templates can't be deleted
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. ADMIN REPORTS (User-created reports)
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Report info
  name VARCHAR(200) NOT NULL,
  description TEXT,
  template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  
  -- Report type (denormalized for filtering)
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
    'usage', 'cost', 'security', 'performance', 'compliance', 'custom'
  )),
  
  -- Schedule
  schedule VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (schedule IN (
    'manual', 'daily', 'weekly', 'monthly', 'quarterly'
  )),
  schedule_time TIME DEFAULT '09:00:00', -- Time of day to run (for scheduled)
  schedule_day_of_week INTEGER, -- 0=Sunday, 1=Monday, etc. (for weekly)
  schedule_day_of_month INTEGER, -- 1-28 (for monthly)
  schedule_timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Output format
  format VARCHAR(20) NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'csv', 'json', 'excel')),
  
  -- Recipients (email addresses)
  recipients JSONB DEFAULT '[]', -- ['admin@company.com', 'team@company.com']
  
  -- Custom parameters for this report
  parameters JSONB DEFAULT '{}', -- Date ranges, filters, groupings, etc.
  
  -- Execution tracking
  last_run_at TIMESTAMPTZ,
  last_run_status VARCHAR(20) CHECK (last_run_status IN ('success', 'failed', 'running')),
  last_run_error TEXT,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'draft', 'deleted')),
  is_favorite BOOLEAN DEFAULT false,
  
  -- Ownership
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name VARCHAR(200),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_reports_tenant ON admin_reports(tenant_id);
CREATE INDEX idx_admin_reports_status ON admin_reports(status) WHERE status = 'active';
CREATE INDEX idx_admin_reports_schedule ON admin_reports(schedule) WHERE schedule != 'manual';
CREATE INDEX idx_admin_reports_next_run ON admin_reports(next_run_at) WHERE status = 'active' AND next_run_at IS NOT NULL;
CREATE INDEX idx_admin_reports_type ON admin_reports(report_type);
CREATE INDEX idx_admin_reports_favorite ON admin_reports(is_favorite) WHERE is_favorite = true;

-- RLS
ALTER TABLE admin_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_reports_tenant_isolation ON admin_reports
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 3. REPORT EXECUTIONS (History of report runs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES admin_reports(id) ON DELETE CASCADE,
  
  -- Execution details
  triggered_by VARCHAR(50) NOT NULL CHECK (triggered_by IN ('manual', 'scheduled', 'api')),
  triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'success', 'failed', 'cancelled'
  )),
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Output
  output_format VARCHAR(20) NOT NULL,
  output_s3_key VARCHAR(500), -- S3 location of generated report
  output_s3_bucket VARCHAR(200),
  output_size_bytes BIGINT,
  output_checksum VARCHAR(64), -- SHA-256 for integrity
  
  -- Parameters used for this run
  parameters_snapshot JSONB DEFAULT '{}',
  
  -- Delivery
  recipients_snapshot JSONB DEFAULT '[]',
  emails_sent INTEGER DEFAULT 0,
  emails_failed INTEGER DEFAULT 0,
  
  -- Error handling
  error_message TEXT,
  error_details JSONB,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_report_executions_tenant ON report_executions(tenant_id);
CREATE INDEX idx_report_executions_report ON report_executions(report_id);
CREATE INDEX idx_report_executions_status ON report_executions(status);
CREATE INDEX idx_report_executions_created ON report_executions(created_at DESC);

-- RLS
ALTER TABLE report_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_executions_tenant_isolation ON report_executions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 4. REPORT SUBSCRIPTIONS (Who gets notified)
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES admin_reports(id) ON DELETE CASCADE,
  
  -- Subscriber
  email VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- If internal user
  
  -- Preferences
  format_preference VARCHAR(20) CHECK (format_preference IN ('pdf', 'csv', 'json', 'excel')),
  is_active BOOLEAN DEFAULT true,
  
  -- Tracking
  last_sent_at TIMESTAMPTZ,
  send_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(report_id, email)
);

CREATE INDEX idx_report_subscriptions_report ON report_subscriptions(report_id);
CREATE INDEX idx_report_subscriptions_email ON report_subscriptions(email);

-- RLS
ALTER TABLE report_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_subscriptions_tenant_isolation ON report_subscriptions
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 5. SEED REPORT TEMPLATES
-- ============================================================================

INSERT INTO report_templates (template_key, name, description, report_type, metrics, icon, color) VALUES
('usage-summary', 'Usage Summary', 'API calls, token usage, and active users over time', 'usage', 
 '["API Calls", "Tokens Used", "Active Users", "Sessions"]', 'Activity', 'blue'),
('cost-breakdown', 'Cost Breakdown', 'Detailed cost analysis by model, user, and tenant', 'cost',
 '["Total Cost", "Cost by Model", "Cost by User", "Trend"]', 'DollarSign', 'green'),
('security-audit', 'Security Audit', 'Login attempts, anomalies, and access patterns', 'security',
 '["Failed Logins", "Anomalies", "Access Logs", "Threats"]', 'Shield', 'red'),
('performance-metrics', 'Performance Metrics', 'Latency, throughput, and error rates', 'performance',
 '["P50/P95/P99 Latency", "Throughput", "Error Rate", "Uptime"]', 'Zap', 'amber'),
('compliance-report', 'Compliance Report', 'SOC2, GDPR, and HIPAA compliance status', 'compliance',
 '["Compliance Score", "Controls", "Findings", "Remediation"]', 'CheckCircle2', 'purple'),
('user-analytics', 'User Analytics', 'User engagement, retention, and activity patterns', 'usage',
 '["Active Users", "New Users", "Retention", "Engagement"]', 'Users', 'blue'),
('model-usage', 'Model Usage Report', 'Breakdown of AI model usage and costs', 'usage',
 '["Requests by Model", "Tokens by Model", "Cost by Model", "Latency by Model"]', 'Brain', 'indigo'),
('billing-summary', 'Billing Summary', 'Monthly billing summary with credits and overages', 'cost',
 '["Total Spend", "Credits Used", "Overages", "Forecast"]', 'CreditCard', 'green')
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metrics = EXCLUDED.metrics,
  updated_at = NOW();

-- ============================================================================
-- 6. FUNCTIONS
-- ============================================================================

-- Calculate next run time based on schedule
CREATE OR REPLACE FUNCTION calculate_next_run(
  p_schedule VARCHAR,
  p_schedule_time TIME,
  p_schedule_day_of_week INTEGER,
  p_schedule_day_of_month INTEGER,
  p_timezone VARCHAR
) RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_next TIMESTAMPTZ;
  v_today DATE := (v_now AT TIME ZONE COALESCE(p_timezone, 'UTC'))::DATE;
BEGIN
  CASE p_schedule
    WHEN 'manual' THEN
      RETURN NULL;
    WHEN 'daily' THEN
      v_next := (v_today + INTERVAL '1 day' + p_schedule_time) AT TIME ZONE COALESCE(p_timezone, 'UTC');
      IF v_next <= v_now THEN
        v_next := v_next + INTERVAL '1 day';
      END IF;
    WHEN 'weekly' THEN
      v_next := (v_today + ((7 + COALESCE(p_schedule_day_of_week, 1) - EXTRACT(DOW FROM v_today)::INTEGER) % 7) * INTERVAL '1 day' + p_schedule_time) AT TIME ZONE COALESCE(p_timezone, 'UTC');
      IF v_next <= v_now THEN
        v_next := v_next + INTERVAL '7 days';
      END IF;
    WHEN 'monthly' THEN
      v_next := (DATE_TRUNC('month', v_today) + (COALESCE(p_schedule_day_of_month, 1) - 1) * INTERVAL '1 day' + p_schedule_time) AT TIME ZONE COALESCE(p_timezone, 'UTC');
      IF v_next <= v_now THEN
        v_next := (DATE_TRUNC('month', v_today) + INTERVAL '1 month' + (COALESCE(p_schedule_day_of_month, 1) - 1) * INTERVAL '1 day' + p_schedule_time) AT TIME ZONE COALESCE(p_timezone, 'UTC');
      END IF;
    WHEN 'quarterly' THEN
      v_next := (DATE_TRUNC('quarter', v_today) + INTERVAL '3 months' + (COALESCE(p_schedule_day_of_month, 1) - 1) * INTERVAL '1 day' + p_schedule_time) AT TIME ZONE COALESCE(p_timezone, 'UTC');
    ELSE
      RETURN NULL;
  END CASE;
  
  RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- Get reports due for execution
CREATE OR REPLACE FUNCTION get_due_reports()
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  name VARCHAR,
  report_type VARCHAR,
  format VARCHAR,
  parameters JSONB,
  recipients JSONB,
  template_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.tenant_id,
    r.name,
    r.report_type,
    r.format,
    r.parameters,
    r.recipients,
    r.template_id
  FROM admin_reports r
  WHERE r.status = 'active'
  AND r.schedule != 'manual'
  AND r.next_run_at IS NOT NULL
  AND r.next_run_at <= NOW()
  AND (r.last_run_status IS NULL OR r.last_run_status != 'running')
  ORDER BY r.next_run_at ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Update report after execution
CREATE OR REPLACE FUNCTION update_report_after_run(
  p_report_id UUID,
  p_status VARCHAR,
  p_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE admin_reports
  SET 
    last_run_at = NOW(),
    last_run_status = p_status,
    last_run_error = p_error,
    run_count = run_count + 1,
    next_run_at = calculate_next_run(schedule, schedule_time, schedule_day_of_week, schedule_day_of_month, schedule_timezone),
    updated_at = NOW()
  WHERE id = p_report_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- Auto-calculate next_run_at on insert/update
CREATE OR REPLACE FUNCTION trigger_calculate_next_run()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.schedule != 'manual' AND NEW.status = 'active' THEN
    NEW.next_run_at := calculate_next_run(
      NEW.schedule, 
      NEW.schedule_time, 
      NEW.schedule_day_of_week, 
      NEW.schedule_day_of_month,
      NEW.schedule_timezone
    );
  ELSE
    NEW.next_run_at := NULL;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_reports_schedule_trigger
  BEFORE INSERT OR UPDATE OF schedule, schedule_time, schedule_day_of_week, schedule_day_of_month, schedule_timezone, status
  ON admin_reports
  FOR EACH ROW EXECUTE FUNCTION trigger_calculate_next_run();

-- ============================================================================
-- 8. VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW v_report_stats AS
SELECT
  tenant_id,
  COUNT(*) as total_reports,
  COUNT(*) FILTER (WHERE status = 'active') as active_reports,
  COUNT(*) FILTER (WHERE schedule != 'manual') as scheduled_reports,
  COUNT(*) FILTER (WHERE is_favorite) as favorite_reports,
  COUNT(*) FILTER (WHERE last_run_at >= CURRENT_DATE) as run_today,
  COUNT(*) FILTER (WHERE last_run_status = 'failed') as failed_reports
FROM admin_reports
GROUP BY tenant_id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE report_templates IS 'Pre-built report templates available to all tenants';
COMMENT ON TABLE admin_reports IS 'User-created reports with scheduling and delivery options';
COMMENT ON TABLE report_executions IS 'History of report generation runs';
COMMENT ON TABLE report_subscriptions IS 'Email subscriptions for report delivery';
COMMENT ON FUNCTION calculate_next_run IS 'Calculate next scheduled run time for a report';
COMMENT ON FUNCTION get_due_reports IS 'Get reports that are due for scheduled execution';
