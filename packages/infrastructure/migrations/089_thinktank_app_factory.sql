-- RADIANT v4.18.0 - Think Tank App Factory
-- "It transforms Think Tank from a chatbot into a dynamic software generator"
-- Migration for generated apps and user preferences

-- ============================================================================
-- GENERATED APPS
-- Stores the interactive apps generated from responses
-- ============================================================================

CREATE TABLE IF NOT EXISTS generated_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID,
    message_id UUID,
    
    -- App metadata
    title TEXT NOT NULL,
    description TEXT,
    
    -- Components
    components JSONB NOT NULL DEFAULT '[]'::jsonb,
    layout TEXT NOT NULL DEFAULT 'single' CHECK (layout IN ('single', 'grid', 'tabs', 'stack')),
    
    -- State and logic
    initial_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    compute_logic JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Current state (can be updated by user interactions)
    current_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Interactivity
    is_interactive BOOLEAN NOT NULL DEFAULT true,
    interaction_count INTEGER NOT NULL DEFAULT 0,
    last_interacted_at TIMESTAMPTZ,
    
    -- User preference for this app
    preferred_view TEXT DEFAULT 'app' CHECK (preferred_view IN ('text', 'app', 'split')),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generated_apps_tenant ON generated_apps(tenant_id);
CREATE INDEX idx_generated_apps_user ON generated_apps(user_id);
CREATE INDEX idx_generated_apps_conversation ON generated_apps(conversation_id);
CREATE INDEX idx_generated_apps_message ON generated_apps(message_id);
CREATE INDEX idx_generated_apps_created ON generated_apps(created_at DESC);

-- RLS
ALTER TABLE generated_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY generated_apps_tenant_isolation ON generated_apps
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- APP INTERACTIONS
-- Records user interactions with generated apps
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES generated_apps(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Interaction details
    component_id TEXT NOT NULL,
    input_id TEXT NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    
    -- Computed outputs after this interaction
    computed_outputs JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_interactions_app ON app_interactions(app_id);
CREATE INDEX idx_app_interactions_user ON app_interactions(user_id);
CREATE INDEX idx_app_interactions_timestamp ON app_interactions(timestamp DESC);

-- RLS
ALTER TABLE app_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_interactions_tenant_isolation ON app_interactions
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- USER APP PREFERENCES
-- User preferences for the App Factory feature
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_app_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- View preferences
    default_view TEXT NOT NULL DEFAULT 'auto' CHECK (default_view IN ('text', 'app', 'split', 'auto')),
    auto_show_app BOOLEAN NOT NULL DEFAULT true,
    auto_show_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.70,
    
    -- Component preferences
    component_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Animation preferences
    enable_animations BOOLEAN NOT NULL DEFAULT true,
    transition_duration INTEGER NOT NULL DEFAULT 300,
    
    -- Split view preferences
    split_ratio JSONB NOT NULL DEFAULT '[1, 1]'::jsonb,
    split_direction TEXT NOT NULL DEFAULT 'horizontal' CHECK (split_direction IN ('horizontal', 'vertical')),
    
    -- Theme
    preferred_theme TEXT NOT NULL DEFAULT 'auto' CHECK (preferred_theme IN ('light', 'dark', 'auto')),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_app_preferences_user ON user_app_preferences(user_id);

-- RLS
ALTER TABLE user_app_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_app_preferences_tenant_isolation ON user_app_preferences
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- APP TEMPLATES
-- Pre-built app templates for common use cases
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for global templates
    
    -- Template metadata
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'calculator', 'chart', 'comparison', etc.
    
    -- Trigger patterns (when to suggest this template)
    trigger_patterns TEXT[] NOT NULL DEFAULT '{}',
    
    -- Template definition
    components JSONB NOT NULL,
    layout TEXT NOT NULL DEFAULT 'single',
    compute_logic JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Usage stats
    usage_count INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_templates_category ON app_templates(category);
CREATE INDEX idx_app_templates_tenant ON app_templates(tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================================================
-- ENHANCED MESSAGES TABLE (add app reference)
-- ============================================================================

-- Add app_id column to messages if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'generated_app_id'
    ) THEN
        ALTER TABLE messages ADD COLUMN generated_app_id UUID REFERENCES generated_apps(id);
        ALTER TABLE messages ADD COLUMN has_generated_app BOOLEAN DEFAULT false;
        ALTER TABLE messages ADD COLUMN preferred_view TEXT DEFAULT 'text' CHECK (preferred_view IN ('text', 'app', 'split'));
    END IF;
END $$;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update app state and record interaction
CREATE OR REPLACE FUNCTION update_app_state(
    p_app_id UUID,
    p_user_id UUID,
    p_component_id TEXT,
    p_input_id TEXT,
    p_new_value JSONB
) RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_previous_value JSONB;
    v_new_state JSONB;
BEGIN
    -- Get current state and tenant
    SELECT tenant_id, current_state -> (p_component_id || '_' || p_input_id)
    INTO v_tenant_id, v_previous_value
    FROM generated_apps
    WHERE id = p_app_id;
    
    -- Update state
    UPDATE generated_apps
    SET current_state = jsonb_set(
            current_state,
            ARRAY[p_component_id || '_' || p_input_id],
            p_new_value
        ),
        interaction_count = interaction_count + 1,
        last_interacted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_app_id
    RETURNING current_state INTO v_new_state;
    
    -- Record interaction
    INSERT INTO app_interactions (
        tenant_id, app_id, user_id,
        component_id, input_id,
        previous_value, new_value
    ) VALUES (
        v_tenant_id, p_app_id, p_user_id,
        p_component_id, p_input_id,
        v_previous_value, p_new_value
    );
    
    RETURN v_new_state;
END;
$$ LANGUAGE plpgsql;

-- Function to get or create user preferences
CREATE OR REPLACE FUNCTION get_or_create_app_preferences(
    p_tenant_id UUID,
    p_user_id UUID
) RETURNS user_app_preferences AS $$
DECLARE
    v_prefs user_app_preferences;
BEGIN
    SELECT * INTO v_prefs
    FROM user_app_preferences
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO user_app_preferences (tenant_id, user_id)
        VALUES (p_tenant_id, p_user_id)
        RETURNING * INTO v_prefs;
    END IF;
    
    RETURN v_prefs;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DEFAULT APP TEMPLATES
-- ============================================================================

INSERT INTO app_templates (name, description, category, trigger_patterns, components, layout, compute_logic)
VALUES 
(
    'Mortgage Calculator',
    'Calculate monthly mortgage payments',
    'calculator',
    ARRAY['mortgage', 'home loan', 'house payment'],
    '[{
        "id": "mortgage-calc",
        "type": "calculator",
        "title": "Mortgage Calculator",
        "interactive": true,
        "inputs": [
            {"id": "principal", "label": "Loan Amount", "type": "number", "defaultValue": 300000},
            {"id": "rate", "label": "Interest Rate (%)", "type": "slider", "defaultValue": 6.5, "min": 0, "max": 15, "step": 0.125},
            {"id": "years", "label": "Loan Term (Years)", "type": "select", "defaultValue": 30, "options": [{"label": "15 Years", "value": 15}, {"label": "20 Years", "value": 20}, {"label": "30 Years", "value": 30}]}
        ],
        "outputs": [
            {"id": "monthly", "label": "Monthly Payment", "type": "number", "format": "currency"},
            {"id": "total", "label": "Total Payment", "type": "number", "format": "currency"},
            {"id": "interest", "label": "Total Interest", "type": "number", "format": "currency"}
        ],
        "width": "medium"
    }]'::jsonb,
    'single',
    '[{"outputId": "monthly", "formula": "mortgage", "dependencies": ["principal", "rate", "years"]}]'::jsonb
),
(
    'Tip Calculator',
    'Calculate tip and split the bill',
    'calculator',
    ARRAY['tip', 'gratuity', 'split bill'],
    '[{
        "id": "tip-calc",
        "type": "calculator",
        "title": "Tip Calculator",
        "interactive": true,
        "inputs": [
            {"id": "bill", "label": "Bill Amount", "type": "number", "defaultValue": 50},
            {"id": "tipPercent", "label": "Tip %", "type": "slider", "defaultValue": 18, "min": 0, "max": 30},
            {"id": "people", "label": "Split Between", "type": "number", "defaultValue": 1, "min": 1, "max": 20}
        ],
        "outputs": [
            {"id": "tip", "label": "Tip Amount", "type": "number", "format": "currency"},
            {"id": "total", "label": "Total", "type": "number", "format": "currency"},
            {"id": "perPerson", "label": "Per Person", "type": "number", "format": "currency"}
        ],
        "width": "small"
    }]'::jsonb,
    'single',
    '[{"outputId": "tip", "formula": "tip", "dependencies": ["bill", "tipPercent", "people"]}]'::jsonb
),
(
    'BMI Calculator',
    'Calculate Body Mass Index',
    'calculator',
    ARRAY['bmi', 'body mass', 'weight'],
    '[{
        "id": "bmi-calc",
        "type": "calculator",
        "title": "BMI Calculator",
        "interactive": true,
        "inputs": [
            {"id": "weight", "label": "Weight (lbs)", "type": "number", "defaultValue": 150},
            {"id": "feet", "label": "Height (feet)", "type": "number", "defaultValue": 5},
            {"id": "inches", "label": "Height (inches)", "type": "number", "defaultValue": 8}
        ],
        "outputs": [
            {"id": "bmi", "label": "BMI", "type": "number"},
            {"id": "category", "label": "Category", "type": "text"}
        ],
        "width": "small"
    }]'::jsonb,
    'single',
    '[{"outputId": "bmi", "formula": "bmi", "dependencies": ["weight", "feet", "inches"]}]'::jsonb
),
(
    'ROI Calculator',
    'Calculate Return on Investment',
    'calculator',
    ARRAY['roi', 'return on investment', 'investment return'],
    '[{
        "id": "roi-calc",
        "type": "calculator",
        "title": "ROI Calculator",
        "interactive": true,
        "inputs": [
            {"id": "initial", "label": "Initial Investment", "type": "number", "defaultValue": 1000},
            {"id": "final", "label": "Final Value", "type": "number", "defaultValue": 1500}
        ],
        "outputs": [
            {"id": "roi", "label": "ROI", "type": "number", "format": "percentage"},
            {"id": "gain", "label": "Gain/Loss", "type": "number", "format": "currency"}
        ],
        "width": "small"
    }]'::jsonb,
    'single',
    '[{"outputId": "roi", "formula": "roi", "dependencies": ["initial", "final"]}]'::jsonb
),
(
    'Compound Interest Calculator',
    'Calculate compound interest growth',
    'calculator',
    ARRAY['compound interest', 'investment growth', 'savings calculator'],
    '[{
        "id": "compound-calc",
        "type": "calculator",
        "title": "Compound Interest Calculator",
        "interactive": true,
        "inputs": [
            {"id": "principal", "label": "Initial Investment", "type": "number", "defaultValue": 10000},
            {"id": "rate", "label": "Annual Rate (%)", "type": "slider", "defaultValue": 7, "min": 0, "max": 20, "step": 0.5},
            {"id": "years", "label": "Years", "type": "slider", "defaultValue": 10, "min": 1, "max": 50},
            {"id": "compound", "label": "Compound Frequency", "type": "select", "defaultValue": 12, "options": [{"label": "Monthly", "value": 12}, {"label": "Quarterly", "value": 4}, {"label": "Annually", "value": 1}]}
        ],
        "outputs": [
            {"id": "future", "label": "Future Value", "type": "number", "format": "currency"},
            {"id": "earnings", "label": "Total Interest", "type": "number", "format": "currency"}
        ],
        "width": "medium"
    }]'::jsonb,
    'single',
    '[{"outputId": "future", "formula": "compound", "dependencies": ["principal", "rate", "years", "compound"]}]'::jsonb
)
ON CONFLICT DO NOTHING;
