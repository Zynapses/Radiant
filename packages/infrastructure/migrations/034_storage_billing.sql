-- RADIANT v4.17.0 - Migration 034: Storage Billing
-- Tiered storage billing for S3 and database usage

CREATE TABLE storage_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier_id VARCHAR(50) NOT NULL REFERENCES subscription_tiers(id),
    storage_type VARCHAR(20) NOT NULL CHECK (storage_type IN ('s3', 'database', 'backup', 'embeddings')),
    
    price_per_gb_cents INTEGER NOT NULL,
    included_gb DECIMAL(10, 2) NOT NULL DEFAULT 0,
    max_gb DECIMAL(10, 2),
    overage_price_per_gb_cents INTEGER,
    
    is_active BOOLEAN DEFAULT true,
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tier_id, storage_type, effective_from)
);

CREATE TABLE storage_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID,
    app_id VARCHAR(50),
    
    storage_type VARCHAR(20) NOT NULL CHECK (storage_type IN ('s3', 'database', 'backup', 'embeddings')),
    
    bytes_used BIGINT NOT NULL DEFAULT 0,
    bytes_quota BIGINT,
    
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    price_per_gb_cents INTEGER NOT NULL,
    total_cost_cents INTEGER NOT NULL DEFAULT 0,
    
    is_over_quota BOOLEAN DEFAULT false,
    quota_warning_sent BOOLEAN DEFAULT false,
    quota_exceeded_sent BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, storage_type, period_start)
);

CREATE TABLE storage_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID,
    
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
        'upload', 'delete', 'archive', 'restore', 'expire', 'quota_warning', 'quota_exceeded'
    )),
    
    storage_type VARCHAR(20) NOT NULL,
    bytes_delta BIGINT NOT NULL,
    
    resource_id VARCHAR(255),
    resource_type VARCHAR(50),
    resource_path TEXT,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_storage_pricing_tier ON storage_pricing(tier_id);
CREATE INDEX idx_storage_usage_tenant ON storage_usage(tenant_id);
CREATE INDEX idx_storage_usage_type ON storage_usage(storage_type);
CREATE INDEX idx_storage_usage_period ON storage_usage(period_start, period_end);
CREATE INDEX idx_storage_events_tenant ON storage_events(tenant_id, created_at DESC);
CREATE INDEX idx_storage_events_type ON storage_events(event_type);

ALTER TABLE storage_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY storage_usage_isolation ON storage_usage
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY storage_events_isolation ON storage_events
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Insert default storage pricing
INSERT INTO storage_pricing (tier_id, storage_type, price_per_gb_cents, included_gb, max_gb) VALUES
    ('FREE', 's3', 0, 1, 1),
    ('FREE', 'database', 0, 0.5, 0.5),
    ('INDIVIDUAL', 's3', 10, 10, 100),
    ('INDIVIDUAL', 'database', 15, 2, 20),
    ('FAMILY', 's3', 8, 25, 250),
    ('FAMILY', 'database', 12, 5, 50),
    ('TEAM', 's3', 6, 100, 1000),
    ('TEAM', 'database', 10, 20, 200),
    ('BUSINESS', 's3', 4, 500, 5000),
    ('BUSINESS', 'database', 8, 100, 1000),
    ('ENTERPRISE', 's3', 3, 1000, NULL),
    ('ENTERPRISE', 'database', 6, 500, NULL),
    ('ENTERPRISE_PLUS', 's3', 2, 5000, NULL),
    ('ENTERPRISE_PLUS', 'database', 4, 2000, NULL);

CREATE TRIGGER update_storage_usage_updated_at 
    BEFORE UPDATE ON storage_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
