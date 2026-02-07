-- RADIANT v4.17.0 - Migration 021: Family & Team Plans
-- Shared subscription plans with usage allocation

CREATE TABLE team_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_name VARCHAR(100) NOT NULL,
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('family', 'team', 'enterprise')),
    owner_id UUID NOT NULL REFERENCES users(id),
    max_members INTEGER NOT NULL DEFAULT 5 CHECK (max_members >= 1 AND max_members <= 100),
    total_tokens_monthly BIGINT NOT NULL,
    tokens_used_this_period BIGINT DEFAULT 0,
    shared_pool BOOLEAN DEFAULT true,
    billing_email VARCHAR(255),
    stripe_subscription_id VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES team_plans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    token_allocation BIGINT,
    tokens_used_this_period BIGINT DEFAULT 0,
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(team_id, user_id)
);

CREATE TABLE team_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES team_plans(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    invited_by UUID NOT NULL REFERENCES users(id),
    token VARCHAR(100) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE team_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES team_plans(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    tokens_used INTEGER NOT NULL,
    model VARCHAR(100),
    usage_type VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_team_plans_tenant ON team_plans(tenant_id);
CREATE INDEX idx_team_plans_owner ON team_plans(owner_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(email);
CREATE INDEX idx_team_invitations_token ON team_invitations(token);
CREATE INDEX idx_team_usage ON team_usage_log(team_id, created_at DESC);
CREATE INDEX idx_team_usage_member ON team_usage_log(member_id);

ALTER TABLE team_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_plans_isolation ON team_plans
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY team_members_isolation ON team_members
    FOR ALL USING (
        team_id IN (SELECT id FROM team_plans WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    );

CREATE POLICY team_invitations_isolation ON team_invitations
    FOR ALL USING (
        team_id IN (SELECT id FROM team_plans WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    );

CREATE POLICY team_usage_isolation ON team_usage_log
    FOR ALL USING (
        team_id IN (SELECT id FROM team_plans WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    );

-- Function to check team token availability
CREATE OR REPLACE FUNCTION check_team_tokens(p_team_id UUID, p_member_id UUID, p_tokens_needed INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_team team_plans%ROWTYPE;
    v_member team_members%ROWTYPE;
BEGIN
    SELECT * INTO v_team FROM team_plans WHERE id = p_team_id AND is_active = true;
    IF NOT FOUND THEN RETURN false; END IF;
    
    SELECT * INTO v_member FROM team_members WHERE id = p_member_id AND is_active = true;
    IF NOT FOUND THEN RETURN false; END IF;
    
    IF v_team.shared_pool THEN
        RETURN (v_team.tokens_used_this_period + p_tokens_needed) <= v_team.total_tokens_monthly;
    ELSE
        RETURN v_member.token_allocation IS NULL OR 
               (v_member.tokens_used_this_period + p_tokens_needed) <= v_member.token_allocation;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_team_plans_updated_at 
    BEFORE UPDATE ON team_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
