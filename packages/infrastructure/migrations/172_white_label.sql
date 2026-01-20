-- Migration: 172_white_label.sql
-- Moat #25: White-Label Invisibility - End users never know RADIANT exists

-- White-label configuration per tenant
CREATE TABLE IF NOT EXISTS white_label_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    branding JSONB NOT NULL DEFAULT '{}',
    features JSONB NOT NULL DEFAULT '{}',
    legal JSONB NOT NULL DEFAULT '{}',
    emails JSONB NOT NULL DEFAULT '{}',
    api JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- Custom domains
CREATE TABLE IF NOT EXISTS white_label_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    domain_type VARCHAR(50) NOT NULL DEFAULT 'primary',
    verified BOOLEAN NOT NULL DEFAULT false,
    ssl_enabled BOOLEAN NOT NULL DEFAULT false,
    ssl_certificate_arn VARCHAR(500),
    cloudfront_distribution_id VARCHAR(100),
    dns_records JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    CONSTRAINT valid_domain_type CHECK (domain_type IN ('primary', 'alias', 'api')),
    UNIQUE(domain)
);

-- Domain verification records
CREATE TABLE IF NOT EXISTS domain_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain_id UUID NOT NULL REFERENCES white_label_domains(id) ON DELETE CASCADE,
    verification_method VARCHAR(50) NOT NULL DEFAULT 'dns_txt',
    verification_token VARCHAR(200) NOT NULL,
    verification_value TEXT NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_verification_method CHECK (verification_method IN ('dns_txt', 'dns_cname', 'http_file'))
);

-- Custom branding assets
CREATE TABLE IF NOT EXISTS branding_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asset_type VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    s3_key VARCHAR(500),
    content_type VARCHAR(100),
    file_size INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_asset_type CHECK (asset_type IN ('logo', 'favicon', 'font', 'image', 'css', 'email_template'))
);

-- Custom email templates
CREATE TABLE IF NOT EXISTS white_label_email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_type VARCHAR(50) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_template TEXT,
    text_template TEXT,
    variables JSONB DEFAULT '[]',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_template_type CHECK (template_type IN ('welcome', 'password_reset', 'invitation', 'notification', 'billing', 'custom')),
    UNIQUE(tenant_id, template_type)
);

-- Custom terminology mappings
CREATE TABLE IF NOT EXISTS custom_terminology (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    original_term VARCHAR(200) NOT NULL,
    custom_term VARCHAR(200) NOT NULL,
    context VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, original_term, context)
);

-- White-label metrics
CREATE TABLE IF NOT EXISTS white_label_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period VARCHAR(50) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    active_users INTEGER NOT NULL DEFAULT 0,
    api_calls INTEGER NOT NULL DEFAULT 0,
    custom_domain_hits INTEGER NOT NULL DEFAULT 0,
    emails_sent INTEGER NOT NULL DEFAULT 0,
    branding_views INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, period, period_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_white_label_config_tenant ON white_label_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_white_label_domains_tenant ON white_label_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_white_label_domains_domain ON white_label_domains(domain);
CREATE INDEX IF NOT EXISTS idx_domain_verifications_domain ON domain_verifications(domain_id);
CREATE INDEX IF NOT EXISTS idx_branding_assets_tenant ON branding_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branding_assets_type ON branding_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON white_label_email_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_terminology_tenant ON custom_terminology(tenant_id);
CREATE INDEX IF NOT EXISTS idx_white_label_metrics_tenant ON white_label_metrics(tenant_id, period_start);

-- RLS Policies
ALTER TABLE white_label_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE branding_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_terminology ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY white_label_config_tenant_isolation ON white_label_config
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY white_label_domains_tenant_isolation ON white_label_domains
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY domain_verifications_tenant_isolation ON domain_verifications
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY branding_assets_tenant_isolation ON branding_assets
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY email_templates_tenant_isolation ON white_label_email_templates
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY custom_terminology_tenant_isolation ON custom_terminology
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY white_label_metrics_tenant_isolation ON white_label_metrics
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Comments
COMMENT ON TABLE white_label_config IS 'Moat #25: White-label configuration per tenant';
COMMENT ON TABLE white_label_domains IS 'Moat #25: Custom domains for white-label tenants';
COMMENT ON TABLE domain_verifications IS 'Moat #25: Domain verification records';
COMMENT ON TABLE branding_assets IS 'Moat #25: Custom branding assets (logos, fonts, etc.)';
COMMENT ON TABLE white_label_email_templates IS 'Moat #25: Custom email templates';
COMMENT ON TABLE custom_terminology IS 'Moat #25: Custom terminology mappings';
COMMENT ON TABLE white_label_metrics IS 'Moat #25: Usage metrics for white-label features';
