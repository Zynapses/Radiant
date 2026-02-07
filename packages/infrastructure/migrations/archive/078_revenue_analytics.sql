-- Migration: 078_revenue_analytics.sql
-- Date: 2024-12-28
-- Author: RADIANT
-- Purpose: Revenue tracking, gross profit calculation, and accounting export support
-- Affects: revenue_entries, cost_entries, revenue_daily_aggregates, accounting_periods

-- ============================================================================
-- Revenue Entries - Individual revenue events
-- ============================================================================

CREATE TABLE IF NOT EXISTS revenue_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Revenue source classification
    source VARCHAR(30) NOT NULL CHECK (source IN (
        'subscription', 'credit_purchase', 'ai_markup_external', 
        'ai_markup_self_hosted', 'overage', 'storage', 'other'
    )),
    
    -- Amount
    amount DECIMAL(15, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Description and references
    description TEXT,
    reference_id VARCHAR(255),           -- subscription_id, transaction_id, etc.
    reference_type VARCHAR(50),          -- 'subscription', 'credit_transaction', etc.
    
    -- Product attribution
    product VARCHAR(20) DEFAULT 'combined' CHECK (product IN ('radiant', 'think_tank', 'combined')),
    
    -- Model attribution (for AI markup)
    model_id VARCHAR(100),
    provider_id VARCHAR(50),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Time period this revenue applies to
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revenue_entries_tenant ON revenue_entries(tenant_id);
CREATE INDEX idx_revenue_entries_source ON revenue_entries(source);
CREATE INDEX idx_revenue_entries_period ON revenue_entries(period_start, period_end);
CREATE INDEX idx_revenue_entries_product ON revenue_entries(product);
CREATE INDEX idx_revenue_entries_created ON revenue_entries(created_at);

-- ============================================================================
-- Cost Entries - Infrastructure and provider costs
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL, -- NULL for shared infra
    
    -- Cost category
    category VARCHAR(30) NOT NULL CHECK (category IN (
        'aws_compute', 'aws_storage', 'aws_network', 'aws_database',
        'external_ai', 'infrastructure', 'platform_fees'
    )),
    
    -- Amount
    amount DECIMAL(15, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Description
    description TEXT,
    aws_service_name VARCHAR(100),       -- e.g., 'SageMaker', 'Aurora', 'Lambda'
    resource_id VARCHAR(255),
    
    -- Provider attribution (for external AI)
    provider_id VARCHAR(50),
    model_id VARCHAR(100),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Time period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cost_entries_tenant ON cost_entries(tenant_id);
CREATE INDEX idx_cost_entries_category ON cost_entries(category);
CREATE INDEX idx_cost_entries_period ON cost_entries(period_start, period_end);
CREATE INDEX idx_cost_entries_created ON cost_entries(created_at);

-- ============================================================================
-- Daily Revenue Aggregates - Pre-computed daily summaries
-- ============================================================================

CREATE TABLE IF NOT EXISTS revenue_daily_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_date DATE NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for platform totals
    product VARCHAR(20) DEFAULT 'combined',
    
    -- Revenue breakdown
    subscription_revenue DECIMAL(15, 4) NOT NULL DEFAULT 0,
    credit_purchase_revenue DECIMAL(15, 4) NOT NULL DEFAULT 0,
    ai_markup_external_revenue DECIMAL(15, 4) NOT NULL DEFAULT 0,
    ai_markup_self_hosted_revenue DECIMAL(15, 4) NOT NULL DEFAULT 0,
    overage_revenue DECIMAL(15, 4) NOT NULL DEFAULT 0,
    storage_revenue DECIMAL(15, 4) NOT NULL DEFAULT 0,
    other_revenue DECIMAL(15, 4) NOT NULL DEFAULT 0,
    total_gross_revenue DECIMAL(15, 4) NOT NULL DEFAULT 0,
    
    -- Cost breakdown
    aws_compute_cost DECIMAL(15, 4) NOT NULL DEFAULT 0,
    aws_storage_cost DECIMAL(15, 4) NOT NULL DEFAULT 0,
    aws_network_cost DECIMAL(15, 4) NOT NULL DEFAULT 0,
    aws_database_cost DECIMAL(15, 4) NOT NULL DEFAULT 0,
    external_ai_cost DECIMAL(15, 4) NOT NULL DEFAULT 0,
    infrastructure_cost DECIMAL(15, 4) NOT NULL DEFAULT 0,
    platform_fees_cost DECIMAL(15, 4) NOT NULL DEFAULT 0,
    total_cost DECIMAL(15, 4) NOT NULL DEFAULT 0,
    
    -- Calculated fields
    gross_profit DECIMAL(15, 4) NOT NULL DEFAULT 0,
    gross_margin DECIMAL(5, 2) DEFAULT 0, -- Percentage
    
    -- Usage metrics
    request_count INTEGER NOT NULL DEFAULT 0,
    active_users INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(aggregate_date, tenant_id, product)
);

CREATE INDEX idx_revenue_daily_date ON revenue_daily_aggregates(aggregate_date);
CREATE INDEX idx_revenue_daily_tenant ON revenue_daily_aggregates(tenant_id);
CREATE INDEX idx_revenue_daily_product ON revenue_daily_aggregates(product);

-- ============================================================================
-- Accounting Periods - For month-end close
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'reconciled')),
    
    -- Totals
    total_revenue DECIMAL(15, 4) NOT NULL DEFAULT 0,
    total_cost DECIMAL(15, 4) NOT NULL DEFAULT 0,
    gross_profit DECIMAL(15, 4) NOT NULL DEFAULT 0,
    
    -- Reconciliation
    adjustments_total DECIMAL(15, 4) NOT NULL DEFAULT 0,
    
    -- Closure info
    closed_at TIMESTAMPTZ,
    closed_by VARCHAR(255),
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(period_start, period_end)
);

CREATE INDEX idx_accounting_periods_status ON accounting_periods(status);
CREATE INDEX idx_accounting_periods_dates ON accounting_periods(period_start, period_end);

-- ============================================================================
-- Reconciliation Entries - Adjustments to accounting periods
-- ============================================================================

CREATE TABLE IF NOT EXISTS reconciliation_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID NOT NULL REFERENCES accounting_periods(id) ON DELETE CASCADE,
    
    entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('adjustment', 'correction', 'write_off')),
    category VARCHAR(30) NOT NULL, -- Revenue source or cost category
    amount DECIMAL(15, 4) NOT NULL,
    
    reason TEXT NOT NULL,
    
    created_by VARCHAR(255) NOT NULL,
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reconciliation_period ON reconciliation_entries(period_id);

-- ============================================================================
-- Revenue Export Log - Track exports for audit
-- ============================================================================

CREATE TABLE IF NOT EXISTS revenue_export_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    export_format VARCHAR(20) NOT NULL, -- csv, json, quickbooks_iif, etc.
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    record_count INTEGER NOT NULL,
    file_size_bytes INTEGER,
    
    filters JSONB DEFAULT '{}',
    
    exported_by VARCHAR(255) NOT NULL,
    exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revenue_export_log_date ON revenue_export_log(exported_at);

-- ============================================================================
-- Model Revenue Tracking - Per-model revenue breakdown
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_revenue_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_date DATE NOT NULL,
    
    model_id VARCHAR(100) NOT NULL,
    model_name VARCHAR(255),
    hosting_type VARCHAR(20) NOT NULL CHECK (hosting_type IN ('external', 'self_hosted')),
    provider_id VARCHAR(50),
    
    -- Costs (what we pay)
    provider_cost DECIMAL(15, 6) NOT NULL DEFAULT 0,
    
    -- Revenue (what customer pays)
    customer_charge DECIMAL(15, 6) NOT NULL DEFAULT 0,
    
    -- Markup
    markup DECIMAL(15, 6) NOT NULL DEFAULT 0,
    markup_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
    
    -- Volume
    request_count INTEGER NOT NULL DEFAULT 0,
    token_count_input BIGINT NOT NULL DEFAULT 0,
    token_count_output BIGINT NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tracking_date, model_id)
);

CREATE INDEX idx_model_revenue_date ON model_revenue_tracking(tracking_date);
CREATE INDEX idx_model_revenue_model ON model_revenue_tracking(model_id);
CREATE INDEX idx_model_revenue_hosting ON model_revenue_tracking(hosting_type);

-- ============================================================================
-- Function: Aggregate daily revenue
-- ============================================================================

CREATE OR REPLACE FUNCTION aggregate_daily_revenue(target_date DATE)
RETURNS VOID AS $$
BEGIN
    -- Insert or update platform-wide totals
    INSERT INTO revenue_daily_aggregates (
        aggregate_date, tenant_id, product,
        subscription_revenue, credit_purchase_revenue, ai_markup_external_revenue,
        ai_markup_self_hosted_revenue, overage_revenue, storage_revenue, other_revenue,
        total_gross_revenue,
        aws_compute_cost, aws_storage_cost, aws_network_cost, aws_database_cost,
        external_ai_cost, infrastructure_cost, platform_fees_cost, total_cost,
        gross_profit, gross_margin
    )
    SELECT 
        target_date,
        NULL,  -- Platform total
        'combined',
        COALESCE(SUM(CASE WHEN source = 'subscription' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN source = 'credit_purchase' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN source = 'ai_markup_external' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN source = 'ai_markup_self_hosted' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN source = 'overage' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN source = 'storage' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN source = 'other' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(amount), 0),
        0, 0, 0, 0, 0, 0, 0, 0, -- Costs populated separately
        0, 0
    FROM revenue_entries
    WHERE period_start::DATE = target_date
    ON CONFLICT (aggregate_date, tenant_id, product) DO UPDATE SET
        subscription_revenue = EXCLUDED.subscription_revenue,
        credit_purchase_revenue = EXCLUDED.credit_purchase_revenue,
        ai_markup_external_revenue = EXCLUDED.ai_markup_external_revenue,
        ai_markup_self_hosted_revenue = EXCLUDED.ai_markup_self_hosted_revenue,
        overage_revenue = EXCLUDED.overage_revenue,
        storage_revenue = EXCLUDED.storage_revenue,
        other_revenue = EXCLUDED.other_revenue,
        total_gross_revenue = EXCLUDED.total_gross_revenue,
        updated_at = NOW();
    
    -- Update costs
    UPDATE revenue_daily_aggregates rda SET
        aws_compute_cost = costs.aws_compute,
        aws_storage_cost = costs.aws_storage,
        aws_network_cost = costs.aws_network,
        aws_database_cost = costs.aws_database,
        external_ai_cost = costs.external_ai,
        infrastructure_cost = costs.infrastructure,
        platform_fees_cost = costs.platform_fees,
        total_cost = costs.total_cost,
        gross_profit = rda.total_gross_revenue - costs.total_cost,
        gross_margin = CASE 
            WHEN rda.total_gross_revenue > 0 
            THEN ((rda.total_gross_revenue - costs.total_cost) / rda.total_gross_revenue * 100)
            ELSE 0 
        END,
        updated_at = NOW()
    FROM (
        SELECT
            COALESCE(SUM(CASE WHEN category = 'aws_compute' THEN amount ELSE 0 END), 0) as aws_compute,
            COALESCE(SUM(CASE WHEN category = 'aws_storage' THEN amount ELSE 0 END), 0) as aws_storage,
            COALESCE(SUM(CASE WHEN category = 'aws_network' THEN amount ELSE 0 END), 0) as aws_network,
            COALESCE(SUM(CASE WHEN category = 'aws_database' THEN amount ELSE 0 END), 0) as aws_database,
            COALESCE(SUM(CASE WHEN category = 'external_ai' THEN amount ELSE 0 END), 0) as external_ai,
            COALESCE(SUM(CASE WHEN category = 'infrastructure' THEN amount ELSE 0 END), 0) as infrastructure,
            COALESCE(SUM(CASE WHEN category = 'platform_fees' THEN amount ELSE 0 END), 0) as platform_fees,
            COALESCE(SUM(amount), 0) as total_cost
        FROM cost_entries
        WHERE period_start::DATE = target_date
    ) costs
    WHERE rda.aggregate_date = target_date AND rda.tenant_id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger: Auto-aggregate on revenue entry
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_revenue_aggregate()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM aggregate_daily_revenue(NEW.period_start::DATE);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_revenue_entry_aggregate
    AFTER INSERT OR UPDATE ON revenue_entries
    FOR EACH ROW EXECUTE FUNCTION trigger_revenue_aggregate();

CREATE TRIGGER trg_cost_entry_aggregate
    AFTER INSERT OR UPDATE ON cost_entries
    FOR EACH ROW EXECUTE FUNCTION trigger_revenue_aggregate();

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE revenue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_daily_aggregates ENABLE ROW LEVEL SECURITY;

-- Revenue entries: Platform admins can see all, tenant admins see their tenant
CREATE POLICY revenue_entries_admin_policy ON revenue_entries
    FOR ALL
    USING (
        current_setting('app.is_platform_admin', true)::boolean = true
        OR tenant_id::text = current_setting('app.current_tenant_id', true)
    );

-- Cost entries: Platform admins only for cross-tenant visibility
CREATE POLICY cost_entries_admin_policy ON cost_entries
    FOR ALL
    USING (
        current_setting('app.is_platform_admin', true)::boolean = true
        OR tenant_id::text = current_setting('app.current_tenant_id', true)
        OR tenant_id IS NULL
    );

-- Daily aggregates: Same as revenue entries
CREATE POLICY revenue_daily_admin_policy ON revenue_daily_aggregates
    FOR ALL
    USING (
        current_setting('app.is_platform_admin', true)::boolean = true
        OR tenant_id::text = current_setting('app.current_tenant_id', true)
        OR tenant_id IS NULL
    );

-- ============================================================================
-- Migration tracking
-- ============================================================================

INSERT INTO schema_migrations (version, name, applied_by) 
VALUES ('078', 'revenue_analytics', 'system')
ON CONFLICT (version) DO NOTHING;
