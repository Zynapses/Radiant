-- RADIANT v4.18.0 - Migration 072: Internet Learning

-- Internet Sources
CREATE TABLE IF NOT EXISTS internet_sources (
    source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'knowledge_base',
    priority INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_fetched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_internet_sources_tenant ON internet_sources(tenant_id);

-- Internet Content
CREATE TABLE IF NOT EXISTS internet_content (
    content_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_id UUID REFERENCES internet_sources(source_id),
    url TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'text/html',
    learning_extracted BOOLEAN NOT NULL DEFAULT false,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_internet_content_tenant ON internet_content(tenant_id);
CREATE INDEX idx_internet_content_extracted ON internet_content(learning_extracted);

-- Internet Learning Config
CREATE TABLE IF NOT EXISTS internet_learning_config (
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    max_fetches_per_hour INTEGER NOT NULL DEFAULT 100,
    max_content_size_mb INTEGER NOT NULL DEFAULT 10,
    blocked_domains JSONB NOT NULL DEFAULT '["facebook.com", "twitter.com", "instagram.com"]'::jsonb,
    allowed_domains JSONB NOT NULL DEFAULT '[]'::jsonb,
    fetch_interval_ms INTEGER NOT NULL DEFAULT 60000,
    auto_process_content BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

CREATE INDEX idx_internet_config_tenant ON internet_learning_config(tenant_id);

-- Learning Extractions
CREATE TABLE IF NOT EXISTS learning_extractions (
    extraction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    content_id UUID REFERENCES internet_content(content_id),
    knowledge_type TEXT NOT NULL DEFAULT 'fact',
    knowledge TEXT NOT NULL,
    confidence DECIMAL(4,3) NOT NULL DEFAULT 0.7,
    domain TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learning_extractions_tenant ON learning_extractions(tenant_id);
CREATE INDEX idx_learning_extractions_type ON learning_extractions(knowledge_type);

-- RLS
ALTER TABLE internet_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE internet_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE internet_learning_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_internet_sources ON internet_sources USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_internet_content ON internet_content USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_internet_config ON internet_learning_config USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
CREATE POLICY tenant_learning_extractions ON learning_extractions USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
