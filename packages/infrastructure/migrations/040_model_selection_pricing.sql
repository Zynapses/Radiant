-- ============================================================================
-- RADIANT v4.17.0 - Model Selection & Pricing Migration
-- ============================================================================

-- Add model categorization columns to models table
ALTER TABLE models ADD COLUMN IF NOT EXISTS is_novel BOOLEAN DEFAULT FALSE;
ALTER TABLE models ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';
ALTER TABLE models ADD COLUMN IF NOT EXISTS thinktank_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE models ADD COLUMN IF NOT EXISTS thinktank_display_order INTEGER DEFAULT 100;

-- User model preferences for Think Tank
CREATE TABLE thinktank_user_model_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    selection_mode VARCHAR(20) NOT NULL DEFAULT 'auto' CHECK (selection_mode IN ('auto', 'manual', 'favorites')),
    default_model_id VARCHAR(100),
    favorite_models JSONB DEFAULT '[]'::JSONB,
    show_standard_models BOOLEAN DEFAULT TRUE,
    show_novel_models BOOLEAN DEFAULT TRUE,
    show_self_hosted_models BOOLEAN DEFAULT FALSE,
    show_cost_per_message BOOLEAN DEFAULT TRUE,
    max_cost_per_message DECIMAL(10, 6),
    prefer_cost_optimization BOOLEAN DEFAULT FALSE,
    domain_mode_model_overrides JSONB DEFAULT '{}'::JSONB,
    recent_models JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Pricing configuration table (admin-editable)
CREATE TABLE pricing_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_default_markup DECIMAL(5, 4) DEFAULT 0.40,
    self_hosted_default_markup DECIMAL(5, 4) DEFAULT 0.75,
    minimum_charge_per_request DECIMAL(10, 6) DEFAULT 0.001,
    price_increase_grace_period_hours INTEGER DEFAULT 24,
    auto_update_from_providers BOOLEAN DEFAULT TRUE,
    auto_update_frequency VARCHAR(20) DEFAULT 'daily' CHECK (auto_update_frequency IN ('hourly', 'daily', 'weekly')),
    last_auto_update TIMESTAMPTZ,
    notify_on_price_change BOOLEAN DEFAULT TRUE,
    notify_threshold_percent DECIMAL(5, 2) DEFAULT 10.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- Model-specific pricing overrides
CREATE TABLE model_pricing_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id VARCHAR(100) NOT NULL,
    custom_input_price DECIMAL(10, 6),
    custom_output_price DECIMAL(10, 6),
    markup_percent DECIMAL(5, 4),
    is_enabled BOOLEAN DEFAULT TRUE,
    effective_from TIMESTAMPTZ,
    effective_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, model_id)
);

CREATE INDEX idx_thinktank_model_prefs_user ON thinktank_user_model_preferences(user_id);
CREATE INDEX idx_thinktank_model_prefs_tenant ON thinktank_user_model_preferences(tenant_id);
CREATE INDEX idx_pricing_config_tenant ON pricing_config(tenant_id);
CREATE INDEX idx_model_pricing_tenant ON model_pricing_overrides(tenant_id);
CREATE INDEX idx_model_pricing_model ON model_pricing_overrides(model_id);

ALTER TABLE thinktank_user_model_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_pricing_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY thinktank_prefs_isolation ON thinktank_user_model_preferences 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY pricing_config_isolation ON pricing_config 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY model_pricing_isolation ON model_pricing_overrides 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_model_prefs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_thinktank_model_prefs_timestamp
    BEFORE UPDATE ON thinktank_user_model_preferences
    FOR EACH ROW EXECUTE FUNCTION update_model_prefs_timestamp();

-- Price history tracking for audit
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id VARCHAR(100) NOT NULL,
    previous_markup DECIMAL(5, 4),
    new_markup DECIMAL(5, 4),
    previous_input_price DECIMAL(10, 6),
    new_input_price DECIMAL(10, 6),
    previous_output_price DECIMAL(10, 6),
    new_output_price DECIMAL(10, 6),
    change_source VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (change_source IN ('admin', 'bulk_update', 'provider_sync', 'system')),
    changed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_history_tenant ON price_history(tenant_id);
CREATE INDEX idx_price_history_model ON price_history(model_id);
CREATE INDEX idx_price_history_created ON price_history(created_at DESC);

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY price_history_isolation ON price_history 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- View for effective model pricing
CREATE OR REPLACE VIEW effective_model_pricing AS
SELECT 
    m.id as model_id,
    m.display_name,
    m.provider_id,
    m.is_novel,
    m.category,
    (m.pricing->>'input_tokens')::DECIMAL as base_input_price,
    (m.pricing->>'output_tokens')::DECIMAL as base_output_price,
    COALESCE(mpo.markup_percent, pc.external_default_markup, 0.40) as effective_markup,
    COALESCE(
        mpo.custom_input_price,
        (m.pricing->>'input_tokens')::DECIMAL * (1 + COALESCE(mpo.markup_percent, pc.external_default_markup, 0.40))
    ) as user_input_price,
    COALESCE(
        mpo.custom_output_price,
        (m.pricing->>'output_tokens')::DECIMAL * (1 + COALESCE(mpo.markup_percent, pc.external_default_markup, 0.40))
    ) as user_output_price
FROM models m
LEFT JOIN pricing_config pc ON pc.tenant_id = current_setting('app.current_tenant_id', true)::UUID
LEFT JOIN model_pricing_overrides mpo ON m.id = mpo.model_id 
    AND mpo.tenant_id = current_setting('app.current_tenant_id', true)::UUID
WHERE m.is_enabled = true;
