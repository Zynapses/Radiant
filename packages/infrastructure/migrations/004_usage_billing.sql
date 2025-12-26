-- RADIANT v4.17.0 - Migration 004: Usage & Billing
-- Usage tracking and billing tables

-- ============================================================================
-- USAGE EVENTS TABLE
-- ============================================================================

CREATE TABLE usage_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(id),
    provider_id UUID NOT NULL REFERENCES providers(id),
    request_id VARCHAR(100) NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    input_cost DECIMAL(12, 8) NOT NULL DEFAULT 0,
    output_cost DECIMAL(12, 8) NOT NULL DEFAULT 0,
    total_cost DECIMAL(12, 8) NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_events_tenant_id ON usage_events(tenant_id);
CREATE INDEX idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX idx_usage_events_model_id ON usage_events(model_id);
CREATE INDEX idx_usage_events_created_at ON usage_events(created_at);
CREATE INDEX idx_usage_events_tenant_created ON usage_events(tenant_id, created_at);

-- Enable RLS
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_events_tenant_isolation ON usage_events
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY usage_events_super_admin_access ON usage_events
    FOR SELECT
    USING (current_setting('app.is_super_admin', true)::boolean = true);

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled')),
    line_items JSONB NOT NULL DEFAULT '[]',
    stripe_invoice_id VARCHAR(100),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_period ON invoices(period_start, period_end);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_tenant_isolation ON invoices
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY invoices_super_admin_access ON invoices
    FOR SELECT
    USING (current_setting('app.is_super_admin', true)::boolean = true);

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CREDIT BALANCES TABLE
-- ============================================================================

CREATE TABLE credit_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    balance DECIMAL(12, 6) NOT NULL DEFAULT 0,
    lifetime_credits DECIMAL(12, 6) NOT NULL DEFAULT 0,
    lifetime_usage DECIMAL(12, 6) NOT NULL DEFAULT 0,
    last_refill_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_balances_tenant_id ON credit_balances(tenant_id);

-- Enable RLS
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY credit_balances_tenant_isolation ON credit_balances
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY credit_balances_super_admin_access ON credit_balances
    FOR SELECT
    USING (current_setting('app.is_super_admin', true)::boolean = true);

CREATE TRIGGER update_credit_balances_updated_at BEFORE UPDATE ON credit_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CREDIT TRANSACTIONS TABLE
-- ============================================================================

CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'adjustment', 'bonus')),
    amount DECIMAL(12, 6) NOT NULL,
    balance_after DECIMAL(12, 6) NOT NULL,
    description TEXT,
    reference_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_tenant_id ON credit_transactions(tenant_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at);

-- Enable RLS
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY credit_transactions_tenant_isolation ON credit_transactions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY credit_transactions_super_admin_access ON credit_transactions
    FOR SELECT
    USING (current_setting('app.is_super_admin', true)::boolean = true);
