-- RADIANT v4.17.0 - Migration 035: Versioned Subscriptions & Grandfathering
-- Preserves original pricing/features when plans change

CREATE TABLE subscription_plan_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier_id VARCHAR(50) NOT NULL REFERENCES subscription_tiers(id),
    version_number INTEGER NOT NULL,
    
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    price_monthly_cents INTEGER,
    price_annual_cents INTEGER,
    price_per_user BOOLEAN DEFAULT false,
    
    included_credits_per_user DECIMAL(10, 2) NOT NULL,
    features JSONB NOT NULL,
    rate_limits JSONB NOT NULL,
    
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    
    change_reason TEXT,
    changed_by UUID,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tier_id, version_number)
);

CREATE TABLE grandfathered_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    plan_version_id UUID NOT NULL REFERENCES subscription_plan_versions(id),
    
    locked_price_monthly_cents INTEGER,
    locked_price_annual_cents INTEGER,
    locked_features JSONB NOT NULL,
    locked_rate_limits JSONB NOT NULL,
    locked_credits_per_user DECIMAL(10, 2) NOT NULL,
    
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'opted_out', 'migrated', 'expired')),
    
    migration_offered BOOLEAN DEFAULT false,
    migration_offer_date TIMESTAMPTZ,
    migration_incentive JSONB,
    migration_response VARCHAR(20),
    migration_response_date TIMESTAMPTZ,
    
    grandfathered_at TIMESTAMPTZ DEFAULT NOW(),
    grandfathered_reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE plan_change_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier_id VARCHAR(50) NOT NULL REFERENCES subscription_tiers(id),
    
    old_version_id UUID REFERENCES subscription_plan_versions(id),
    new_version_id UUID NOT NULL REFERENCES subscription_plan_versions(id),
    
    change_type VARCHAR(30) NOT NULL CHECK (change_type IN (
        'price_increase', 'price_decrease', 'feature_add', 'feature_remove',
        'limit_increase', 'limit_decrease', 'credit_change', 'terms_change'
    )),
    
    change_summary TEXT NOT NULL,
    affected_subscribers INTEGER NOT NULL DEFAULT 0,
    grandfathered_count INTEGER NOT NULL DEFAULT 0,
    
    changed_by UUID,
    approved_by UUID,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plan_versions_tier ON subscription_plan_versions(tier_id);
CREATE INDEX idx_plan_versions_effective ON subscription_plan_versions(effective_from, effective_until);
CREATE INDEX idx_grandfathered_subscription ON grandfathered_subscriptions(subscription_id);
CREATE INDEX idx_grandfathered_status ON grandfathered_subscriptions(status);
CREATE INDEX idx_plan_change_audit_tier ON plan_change_audit(tier_id, created_at DESC);

ALTER TABLE grandfathered_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY grandfathered_subscriptions_isolation ON grandfathered_subscriptions
    FOR ALL USING (subscription_id IN (SELECT id FROM subscriptions WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid));

-- Function: Get effective plan for subscription
CREATE OR REPLACE FUNCTION get_effective_plan(p_subscription_id UUID)
RETURNS TABLE (
    tier_id VARCHAR(50),
    version_number INTEGER,
    price_monthly_cents INTEGER,
    price_annual_cents INTEGER,
    features JSONB,
    rate_limits JSONB,
    credits_per_user DECIMAL(10, 2),
    is_grandfathered BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.tier_id,
        COALESCE(pv.version_number, 0),
        COALESCE(gs.locked_price_monthly_cents, (st.price_monthly * 100)::INTEGER),
        COALESCE(gs.locked_price_annual_cents, (st.price_annual * 100)::INTEGER),
        COALESCE(gs.locked_features, st.features),
        COALESCE(gs.locked_rate_limits, jsonb_build_object(
            'requestsPerMinute', st.requests_per_minute,
            'tokensPerMinute', st.tokens_per_minute,
            'concurrentRequests', st.concurrent_requests
        )),
        COALESCE(gs.locked_credits_per_user, st.included_credits_per_user),
        (gs.id IS NOT NULL)
    FROM subscriptions s
    JOIN subscription_tiers st ON st.id = s.tier_id
    LEFT JOIN grandfathered_subscriptions gs ON gs.subscription_id = s.id AND gs.status = 'active'
    LEFT JOIN subscription_plan_versions pv ON pv.id = gs.plan_version_id
    WHERE s.id = p_subscription_id;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE TRIGGER update_grandfathered_subscriptions_updated_at 
    BEFORE UPDATE ON grandfathered_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
