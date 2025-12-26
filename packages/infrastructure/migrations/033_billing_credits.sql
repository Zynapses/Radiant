-- RADIANT v4.17.0 - Migration 033: Billing & Credits System
-- 7-tier subscriptions and prepaid credits

CREATE TABLE subscription_tiers (
    id VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    localization_key VARCHAR(100),
    
    price_monthly DECIMAL(10, 2),
    price_annual DECIMAL(10, 2),
    price_per_user BOOLEAN DEFAULT false,
    min_users INTEGER DEFAULT 1,
    max_users INTEGER,
    currency VARCHAR(3) DEFAULT 'USD',
    contact_sales BOOLEAN DEFAULT false,
    
    included_credits_per_user DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    requests_per_minute INTEGER NOT NULL DEFAULT 10,
    tokens_per_minute INTEGER NOT NULL DEFAULT 20000,
    concurrent_requests INTEGER NOT NULL DEFAULT 1,
    
    features JSONB NOT NULL DEFAULT '{}',
    available_addons TEXT[] DEFAULT '{}',
    
    is_public BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    badge VARCHAR(50),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tier_id VARCHAR(50) NOT NULL REFERENCES subscription_tiers(id),
    
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'paused')),
    
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    
    seats_purchased INTEGER NOT NULL DEFAULT 1,
    seats_used INTEGER NOT NULL DEFAULT 0,
    
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),
    
    trial_ends_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE credit_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    balance DECIMAL(12, 4) NOT NULL DEFAULT 0,
    lifetime_purchased DECIMAL(12, 4) NOT NULL DEFAULT 0,
    lifetime_used DECIMAL(12, 4) NOT NULL DEFAULT 0,
    lifetime_bonus DECIMAL(12, 4) NOT NULL DEFAULT 0,
    
    auto_purchase_enabled BOOLEAN DEFAULT false,
    auto_purchase_threshold DECIMAL(12, 4),
    auto_purchase_amount DECIMAL(12, 4),
    
    low_balance_alert_threshold DECIMAL(12, 4),
    last_low_balance_alert TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID,
    
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'purchase', 'bonus', 'refund', 'usage', 'transfer_in', 'transfer_out', 
        'subscription_allocation', 'expiration', 'adjustment'
    )),
    
    amount DECIMAL(12, 4) NOT NULL,
    balance_after DECIMAL(12, 4) NOT NULL,
    
    description TEXT,
    reference_id VARCHAR(100),
    reference_type VARCHAR(50),
    
    stripe_payment_intent_id VARCHAR(100),
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE credit_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    credits_amount DECIMAL(12, 4) NOT NULL,
    bonus_credits DECIMAL(12, 4) DEFAULT 0,
    
    price_cents INTEGER NOT NULL,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    discount_reason VARCHAR(100),
    
    stripe_payment_intent_id VARCHAR(100),
    stripe_invoice_id VARCHAR(100),
    
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE subscription_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    
    addon_type VARCHAR(50) NOT NULL CHECK (addon_type IN ('compliance', 'dedicated_support', 'custom_models', 'data_residency')),
    
    price_per_user_cents INTEGER NOT NULL,
    
    is_active BOOLEAN DEFAULT true,
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier_id);
CREATE INDEX idx_credit_balances_tenant ON credit_balances(tenant_id);
CREATE INDEX idx_credit_transactions_tenant ON credit_transactions(tenant_id, created_at DESC);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX idx_credit_purchases_tenant ON credit_purchases(tenant_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_isolation ON subscriptions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY credit_balances_isolation ON credit_balances
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY credit_transactions_isolation ON credit_transactions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY credit_purchases_isolation ON credit_purchases
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY subscription_addons_isolation ON subscription_addons
    FOR ALL USING (subscription_id IN (SELECT id FROM subscriptions WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid));

-- Insert subscription tiers
INSERT INTO subscription_tiers (id, display_name, description, price_monthly, price_annual, included_credits_per_user, requests_per_minute, tokens_per_minute, concurrent_requests, features, sort_order) VALUES
    ('FREE', 'Free Trial', 'Try RADIANT with limited features', 0, 0, 0.5, 10, 20000, 1, '{"modelAccess": "limited", "maxModelsPerMonth": 5, "maxRequestsPerDay": 50, "apiAccess": false, "watermarkedOutputs": true}', 0),
    ('INDIVIDUAL', 'Individual', 'Perfect for personal use', 29, 290, 5, 60, 100000, 5, '{"modelAccess": "full", "maxModelsPerMonth": null, "maxRequestsPerDay": null, "apiAccess": true, "watermarkedOutputs": false}', 1),
    ('FAMILY', 'Family', 'Share with up to 5 family members', 49, 490, 3, 60, 100000, 5, '{"modelAccess": "full", "maxModelsPerMonth": null, "sharedCreditPool": true, "parentalControls": true}', 2),
    ('TEAM', 'Team', 'For small teams (2-25 users)', 25, 250, 8, 120, 200000, 10, '{"modelAccess": "full", "teamWorkspaces": true, "teamAdminDashboard": true, "usageAnalytics": true}', 3),
    ('BUSINESS', 'Business', 'For growing organizations', 45, 450, 15, 300, 500000, 25, '{"modelAccess": "full_plus_beta", "ssoIntegration": true, "auditLogs": true, "roleBasedAccess": true}', 4),
    ('ENTERPRISE', 'Enterprise', 'Custom solutions for large orgs', NULL, NULL, 25, 1000, 1000000, 50, '{"modelAccess": "all", "dedicatedAccountManager": true, "customBranding": true, "apiRateLimitCustomization": true}', 5),
    ('ENTERPRISE_PLUS', 'Enterprise Plus', 'Maximum security and compliance', NULL, NULL, 50, 2000, 2000000, 100, '{"modelAccess": "all", "slaGuarantee": true, "dedicatedInfrastructure": true, "multiRegionDeployment": true}', 6);

CREATE TRIGGER update_subscription_tiers_updated_at 
    BEFORE UPDATE ON subscription_tiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at 
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credit_balances_updated_at 
    BEFORE UPDATE ON credit_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
