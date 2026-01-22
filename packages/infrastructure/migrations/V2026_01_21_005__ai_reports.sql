-- AI Reports System Migration
-- Version: 5.42.0
-- Date: 2026-01-21
-- Description: Database schema for AI-powered report generation with brand kits and smart insights

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE report_status AS ENUM ('draft', 'generating', 'completed', 'failed', 'archived');
CREATE TYPE report_style AS ENUM ('executive', 'detailed', 'dashboard', 'narrative');
CREATE TYPE insight_type AS ENUM ('anomaly', 'trend', 'recommendation', 'warning', 'achievement');
CREATE TYPE insight_severity AS ENUM ('low', 'medium', 'high');
CREATE TYPE export_format AS ENUM ('pdf', 'excel', 'html', 'json');

-- =====================================================
-- BRAND KITS TABLE
-- =====================================================

CREATE TABLE brand_kits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Default Brand Kit',
    is_default BOOLEAN NOT NULL DEFAULT false,
    logo_url TEXT,
    logo_s3_key VARCHAR(512),
    primary_color VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
    secondary_color VARCHAR(7) NOT NULL DEFAULT '#64748b',
    accent_color VARCHAR(7) NOT NULL DEFAULT '#10b981',
    font_family VARCHAR(255) NOT NULL DEFAULT 'Inter, system-ui, sans-serif',
    header_font VARCHAR(255) NOT NULL DEFAULT 'Inter, system-ui, sans-serif',
    company_name VARCHAR(255),
    tagline VARCHAR(512),
    footer_text TEXT,
    custom_css TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_brand_kits_tenant ON brand_kits(tenant_id);
CREATE INDEX idx_brand_kits_default ON brand_kits(tenant_id, is_default) WHERE is_default = true;

-- =====================================================
-- REPORT TEMPLATES TABLE
-- =====================================================

CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    style report_style NOT NULL DEFAULT 'executive',
    prompt_template TEXT NOT NULL,
    section_schema JSONB NOT NULL DEFAULT '[]',
    chart_configs JSONB DEFAULT '[]',
    table_configs JSONB DEFAULT '[]',
    default_brand_kit_id UUID REFERENCES brand_kits(id) ON DELETE SET NULL,
    is_system_template BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    usage_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_report_templates_tenant ON report_templates(tenant_id);
CREATE INDEX idx_report_templates_style ON report_templates(tenant_id, style);
CREATE INDEX idx_report_templates_active ON report_templates(tenant_id, is_active) WHERE is_active = true;

-- =====================================================
-- GENERATED REPORTS TABLE
-- =====================================================

CREATE TABLE generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
    brand_kit_id UUID REFERENCES brand_kits(id) ON DELETE SET NULL,
    title VARCHAR(512) NOT NULL,
    subtitle VARCHAR(512),
    executive_summary TEXT,
    style report_style NOT NULL DEFAULT 'executive',
    status report_status NOT NULL DEFAULT 'draft',
    user_prompt TEXT NOT NULL,
    ai_model VARCHAR(255),
    sections JSONB NOT NULL DEFAULT '[]',
    charts JSONB DEFAULT '[]',
    tables JSONB DEFAULT '[]',
    smart_insights JSONB DEFAULT '[]',
    data_range_start TIMESTAMPTZ,
    data_range_end TIMESTAMPTZ,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    generation_time_ms INTEGER,
    token_usage JSONB DEFAULT '{"input": 0, "output": 0}',
    cost_cents INTEGER DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    parent_version_id UUID REFERENCES generated_reports(id),
    is_latest_version BOOLEAN NOT NULL DEFAULT true,
    export_count INTEGER NOT NULL DEFAULT 0,
    last_exported_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_generated_reports_tenant ON generated_reports(tenant_id);
CREATE INDEX idx_generated_reports_status ON generated_reports(tenant_id, status);
CREATE INDEX idx_generated_reports_created ON generated_reports(tenant_id, created_at DESC);
CREATE INDEX idx_generated_reports_latest ON generated_reports(tenant_id, is_latest_version) WHERE is_latest_version = true;
CREATE INDEX idx_generated_reports_template ON generated_reports(template_id);

-- =====================================================
-- REPORT SMART INSIGHTS TABLE (Denormalized for querying)
-- =====================================================

CREATE TABLE report_smart_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    report_id UUID NOT NULL REFERENCES generated_reports(id) ON DELETE CASCADE,
    insight_type insight_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    metric_name VARCHAR(255),
    metric_value VARCHAR(255),
    metric_change VARCHAR(50),
    severity insight_severity NOT NULL DEFAULT 'medium',
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    source_data JSONB,
    is_actionable BOOLEAN NOT NULL DEFAULT false,
    action_taken BOOLEAN NOT NULL DEFAULT false,
    dismissed_at TIMESTAMPTZ,
    dismissed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_insights_tenant ON report_smart_insights(tenant_id);
CREATE INDEX idx_report_insights_report ON report_smart_insights(report_id);
CREATE INDEX idx_report_insights_type ON report_smart_insights(tenant_id, insight_type);
CREATE INDEX idx_report_insights_severity ON report_smart_insights(tenant_id, severity);

-- =====================================================
-- REPORT EXPORTS TABLE
-- =====================================================

CREATE TABLE report_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    report_id UUID NOT NULL REFERENCES generated_reports(id) ON DELETE CASCADE,
    format export_format NOT NULL,
    file_name VARCHAR(512) NOT NULL,
    s3_key VARCHAR(1024),
    file_size_bytes BIGINT,
    download_count INTEGER NOT NULL DEFAULT 0,
    last_downloaded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    brand_kit_applied BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_report_exports_tenant ON report_exports(tenant_id);
CREATE INDEX idx_report_exports_report ON report_exports(report_id);
CREATE INDEX idx_report_exports_format ON report_exports(tenant_id, format);

-- =====================================================
-- REPORT CHAT HISTORY TABLE
-- =====================================================

CREATE TABLE report_chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    report_id UUID REFERENCES generated_reports(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    report_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_report_chat_tenant ON report_chat_history(tenant_id);
CREATE INDEX idx_report_chat_session ON report_chat_history(session_id);
CREATE INDEX idx_report_chat_report ON report_chat_history(report_id);

-- =====================================================
-- REPORT SCHEDULES TABLE
-- =====================================================

CREATE TABLE report_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
    brand_kit_id UUID REFERENCES brand_kits(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    is_active BOOLEAN NOT NULL DEFAULT true,
    export_formats export_format[] NOT NULL DEFAULT ARRAY['pdf']::export_format[],
    recipients JSONB DEFAULT '[]',
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    last_report_id UUID REFERENCES generated_reports(id),
    run_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_report_schedules_tenant ON report_schedules(tenant_id);
CREATE INDEX idx_report_schedules_active ON report_schedules(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_report_schedules_next_run ON report_schedules(next_run_at) WHERE is_active = true;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_smart_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY brand_kits_tenant_isolation ON brand_kits
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY report_templates_tenant_isolation ON report_templates
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY generated_reports_tenant_isolation ON generated_reports
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY report_smart_insights_tenant_isolation ON report_smart_insights
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY report_exports_tenant_isolation ON report_exports
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY report_chat_history_tenant_isolation ON report_chat_history
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY report_schedules_tenant_isolation ON report_schedules
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at
CREATE TRIGGER update_brand_kits_updated_at
    BEFORE UPDATE ON brand_kits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_templates_updated_at
    BEFORE UPDATE ON report_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generated_reports_updated_at
    BEFORE UPDATE ON generated_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_schedules_updated_at
    BEFORE UPDATE ON report_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ensure only one default brand kit per tenant
CREATE OR REPLACE FUNCTION ensure_single_default_brand_kit()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE brand_kits 
        SET is_default = false 
        WHERE tenant_id = NEW.tenant_id 
          AND id != NEW.id 
          AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brand_kit_single_default
    BEFORE INSERT OR UPDATE ON brand_kits
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION ensure_single_default_brand_kit();

-- Increment template usage count
CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.template_id IS NOT NULL THEN
        UPDATE report_templates 
        SET usage_count = usage_count + 1 
        WHERE id = NEW.template_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_increment_template_usage
    AFTER INSERT ON generated_reports
    FOR EACH ROW
    EXECUTE FUNCTION increment_template_usage();

-- =====================================================
-- SEED DATA: System Templates
-- =====================================================

-- Note: System templates are inserted per-tenant on first access
-- This function creates default templates for a tenant
CREATE OR REPLACE FUNCTION create_default_report_templates(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    -- Executive Summary Template
    INSERT INTO report_templates (tenant_id, name, description, style, prompt_template, section_schema, is_system_template)
    VALUES (
        p_tenant_id,
        'Executive Summary',
        'High-level overview with key metrics and insights',
        'executive',
        'Generate an executive summary report with the following focus: {{focus}}. Include key metrics, trends, and actionable recommendations.',
        '[{"type": "heading", "level": 1}, {"type": "metrics"}, {"type": "paragraph"}, {"type": "list"}, {"type": "chart"}]'::JSONB,
        true
    ) ON CONFLICT (tenant_id, name) DO NOTHING;

    -- Detailed Analysis Template
    INSERT INTO report_templates (tenant_id, name, description, style, prompt_template, section_schema, is_system_template)
    VALUES (
        p_tenant_id,
        'Detailed Analysis',
        'In-depth analysis with comprehensive data breakdown',
        'detailed',
        'Generate a detailed analysis report covering: {{focus}}. Include comprehensive data breakdowns, statistical analysis, and supporting evidence.',
        '[{"type": "heading", "level": 1}, {"type": "paragraph"}, {"type": "metrics"}, {"type": "chart"}, {"type": "table"}, {"type": "list"}]'::JSONB,
        true
    ) ON CONFLICT (tenant_id, name) DO NOTHING;

    -- Dashboard View Template
    INSERT INTO report_templates (tenant_id, name, description, style, prompt_template, section_schema, is_system_template)
    VALUES (
        p_tenant_id,
        'Dashboard View',
        'KPI-focused visual dashboard',
        'dashboard',
        'Generate a dashboard-style report for: {{focus}}. Focus on key performance indicators, visual metrics, and trend charts.',
        '[{"type": "metrics"}, {"type": "chart"}, {"type": "chart"}, {"type": "table"}]'::JSONB,
        true
    ) ON CONFLICT (tenant_id, name) DO NOTHING;

    -- Narrative Report Template
    INSERT INTO report_templates (tenant_id, name, description, style, prompt_template, section_schema, is_system_template)
    VALUES (
        p_tenant_id,
        'Narrative Report',
        'Story-driven report with context and analysis',
        'narrative',
        'Generate a narrative report about: {{focus}}. Tell the story behind the data with context, analysis, and recommendations.',
        '[{"type": "heading", "level": 1}, {"type": "paragraph"}, {"type": "quote"}, {"type": "paragraph"}, {"type": "metrics"}, {"type": "list"}]'::JSONB,
        true
    ) ON CONFLICT (tenant_id, name) DO NOTHING;

    -- Create default brand kit
    INSERT INTO brand_kits (tenant_id, name, is_default, company_name, tagline)
    VALUES (
        p_tenant_id,
        'Default Brand Kit',
        true,
        'My Company',
        'AI-Powered Insights'
    ) ON CONFLICT (tenant_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE brand_kits IS 'Stores brand customization settings for report generation';
COMMENT ON TABLE report_templates IS 'Reusable report templates with predefined structures';
COMMENT ON TABLE generated_reports IS 'AI-generated reports with full content and metadata';
COMMENT ON TABLE report_smart_insights IS 'AI-detected insights extracted from reports';
COMMENT ON TABLE report_exports IS 'Exported report files (PDF, Excel, HTML)';
COMMENT ON TABLE report_chat_history IS 'Chat history for interactive report generation';
COMMENT ON TABLE report_schedules IS 'Scheduled automatic report generation';
