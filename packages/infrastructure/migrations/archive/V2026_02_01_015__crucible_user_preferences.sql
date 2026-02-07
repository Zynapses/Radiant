-- ============================================================================
-- The Crucible - User & Method Level Preferences
-- ============================================================================
-- Extends The Crucible with hierarchical configuration:
-- System (Radiant Admin) > Tenant (Think Tank Admin) > User (Method-level)
--
-- Features:
-- - Tenant admins can override system defaults for their users
-- - Users can set preferences per method or workflow
-- - Config resolution: User > Tenant > System
--
-- Version: 1.1.0
-- Since: v6.4.0
-- ============================================================================

-- ============================================================================
-- System-Level Defaults (Radiant Admin)
-- ============================================================================

CREATE TABLE crucible_system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    default_max_questions INTEGER NOT NULL DEFAULT 5,
    question_timeout_seconds INTEGER NOT NULL DEFAULT 30,
    session_timeout_seconds INTEGER NOT NULL DEFAULT 180,
    min_llms_for_crucible INTEGER NOT NULL DEFAULT 2,
    default_cost_mode crucible_cost_mode NOT NULL DEFAULT 'balanced',
    cost_mode_question_limits JSONB NOT NULL DEFAULT '{"economy": 3, "balanced": 5, "thorough": 8}',
    circular_citation_penalty DECIMAL(3,2) NOT NULL DEFAULT 0.15,
    allow_tenant_override BOOLEAN NOT NULL DEFAULT TRUE,
    allow_user_override BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert single system config row
INSERT INTO crucible_system_config (id) VALUES (uuid_generate_v4());

-- ============================================================================
-- Tenant-Level Overrides (Think Tank Admin)
-- ============================================================================

CREATE TABLE crucible_tenant_config (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    -- Override flags (NULL = use system default)
    max_questions_override INTEGER,
    question_timeout_override INTEGER,
    session_timeout_override INTEGER,
    min_llms_override INTEGER,
    cost_mode_override crucible_cost_mode,
    cost_mode_limits_override JSONB,
    circular_penalty_override DECIMAL(3,2),
    -- Tenant-specific settings
    allow_user_override BOOLEAN NOT NULL DEFAULT TRUE,
    show_deliberation_to_users BOOLEAN NOT NULL DEFAULT TRUE,
    auto_enable_for_multi_llm BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- User-Level Preferences (Per Method/Workflow)
-- ============================================================================

CREATE TYPE crucible_preference_scope AS ENUM (
    'global',           -- User's global default
    'method',           -- Specific method
    'workflow',         -- Specific workflow template
    'method_in_workflow' -- Specific method within a specific workflow
);

CREATE TABLE crucible_user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    scope crucible_preference_scope NOT NULL DEFAULT 'global',
    -- Scope identifiers (NULL for global)
    method_id VARCHAR(255),
    workflow_id UUID,
    -- User preferences (NULL = use tenant/system default)
    max_questions INTEGER,
    cost_mode crucible_cost_mode,
    enabled BOOLEAN,
    -- Track if user explicitly set this (even if same as default)
    explicitly_set BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_scope UNIQUE (tenant_id, user_id, scope, method_id, workflow_id)
);

-- ============================================================================
-- Resolved Config View (for easy querying)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_crucible_resolved_config(
    p_tenant_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_method_id VARCHAR DEFAULT NULL,
    p_workflow_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_system RECORD;
    v_tenant RECORD;
    v_user_global RECORD;
    v_user_method RECORD;
    v_user_workflow RECORD;
    v_user_method_workflow RECORD;
    v_result JSONB;
BEGIN
    -- Get system config
    SELECT * INTO v_system FROM crucible_system_config LIMIT 1;
    
    -- Get tenant config
    SELECT * INTO v_tenant FROM crucible_tenant_config WHERE tenant_id = p_tenant_id;
    
    -- Start with system defaults
    v_result := jsonb_build_object(
        'max_questions', v_system.default_max_questions,
        'question_timeout_seconds', v_system.question_timeout_seconds,
        'session_timeout_seconds', v_system.session_timeout_seconds,
        'min_llms_for_crucible', v_system.min_llms_for_crucible,
        'cost_mode', v_system.default_cost_mode,
        'cost_mode_question_limits', v_system.cost_mode_question_limits,
        'circular_citation_penalty', v_system.circular_citation_penalty,
        'source', 'system'
    );
    
    -- Apply tenant overrides
    IF v_tenant IS NOT NULL THEN
        IF v_tenant.max_questions_override IS NOT NULL THEN
            v_result := v_result || jsonb_build_object('max_questions', v_tenant.max_questions_override, 'source', 'tenant');
        END IF;
        IF v_tenant.question_timeout_override IS NOT NULL THEN
            v_result := v_result || jsonb_build_object('question_timeout_seconds', v_tenant.question_timeout_override);
        END IF;
        IF v_tenant.session_timeout_override IS NOT NULL THEN
            v_result := v_result || jsonb_build_object('session_timeout_seconds', v_tenant.session_timeout_override);
        END IF;
        IF v_tenant.min_llms_override IS NOT NULL THEN
            v_result := v_result || jsonb_build_object('min_llms_for_crucible', v_tenant.min_llms_override);
        END IF;
        IF v_tenant.cost_mode_override IS NOT NULL THEN
            v_result := v_result || jsonb_build_object('cost_mode', v_tenant.cost_mode_override);
        END IF;
        IF v_tenant.cost_mode_limits_override IS NOT NULL THEN
            v_result := v_result || jsonb_build_object('cost_mode_question_limits', v_tenant.cost_mode_limits_override);
        END IF;
        IF v_tenant.circular_penalty_override IS NOT NULL THEN
            v_result := v_result || jsonb_build_object('circular_citation_penalty', v_tenant.circular_penalty_override);
        END IF;
        
        v_result := v_result || jsonb_build_object(
            'show_deliberation_to_users', v_tenant.show_deliberation_to_users,
            'auto_enable_for_multi_llm', v_tenant.auto_enable_for_multi_llm
        );
    END IF;
    
    -- Apply user preferences if allowed and provided
    IF p_user_id IS NOT NULL AND (v_tenant IS NULL OR v_tenant.allow_user_override) AND v_system.allow_user_override THEN
        -- Check method+workflow specific first (highest priority)
        IF p_method_id IS NOT NULL AND p_workflow_id IS NOT NULL THEN
            SELECT * INTO v_user_method_workflow 
            FROM crucible_user_preferences 
            WHERE tenant_id = p_tenant_id 
              AND user_id = p_user_id 
              AND scope = 'method_in_workflow'
              AND method_id = p_method_id
              AND workflow_id = p_workflow_id;
            
            IF v_user_method_workflow IS NOT NULL AND v_user_method_workflow.explicitly_set THEN
                IF v_user_method_workflow.max_questions IS NOT NULL THEN
                    v_result := v_result || jsonb_build_object('max_questions', v_user_method_workflow.max_questions, 'source', 'user_method_workflow');
                END IF;
                IF v_user_method_workflow.cost_mode IS NOT NULL THEN
                    v_result := v_result || jsonb_build_object('cost_mode', v_user_method_workflow.cost_mode);
                END IF;
                IF v_user_method_workflow.enabled IS NOT NULL THEN
                    v_result := v_result || jsonb_build_object('enabled', v_user_method_workflow.enabled);
                END IF;
                RETURN v_result;
            END IF;
        END IF;
        
        -- Check workflow-specific
        IF p_workflow_id IS NOT NULL THEN
            SELECT * INTO v_user_workflow 
            FROM crucible_user_preferences 
            WHERE tenant_id = p_tenant_id 
              AND user_id = p_user_id 
              AND scope = 'workflow'
              AND workflow_id = p_workflow_id;
            
            IF v_user_workflow IS NOT NULL AND v_user_workflow.explicitly_set THEN
                IF v_user_workflow.max_questions IS NOT NULL THEN
                    v_result := v_result || jsonb_build_object('max_questions', v_user_workflow.max_questions, 'source', 'user_workflow');
                END IF;
                IF v_user_workflow.cost_mode IS NOT NULL THEN
                    v_result := v_result || jsonb_build_object('cost_mode', v_user_workflow.cost_mode);
                END IF;
                IF v_user_workflow.enabled IS NOT NULL THEN
                    v_result := v_result || jsonb_build_object('enabled', v_user_workflow.enabled);
                END IF;
                RETURN v_result;
            END IF;
        END IF;
        
        -- Check method-specific
        IF p_method_id IS NOT NULL THEN
            SELECT * INTO v_user_method 
            FROM crucible_user_preferences 
            WHERE tenant_id = p_tenant_id 
              AND user_id = p_user_id 
              AND scope = 'method'
              AND method_id = p_method_id;
            
            IF v_user_method IS NOT NULL AND v_user_method.explicitly_set THEN
                IF v_user_method.max_questions IS NOT NULL THEN
                    v_result := v_result || jsonb_build_object('max_questions', v_user_method.max_questions, 'source', 'user_method');
                END IF;
                IF v_user_method.cost_mode IS NOT NULL THEN
                    v_result := v_result || jsonb_build_object('cost_mode', v_user_method.cost_mode);
                END IF;
                IF v_user_method.enabled IS NOT NULL THEN
                    v_result := v_result || jsonb_build_object('enabled', v_user_method.enabled);
                END IF;
                RETURN v_result;
            END IF;
        END IF;
        
        -- Check user global
        SELECT * INTO v_user_global 
        FROM crucible_user_preferences 
        WHERE tenant_id = p_tenant_id 
          AND user_id = p_user_id 
          AND scope = 'global';
        
        IF v_user_global IS NOT NULL AND v_user_global.explicitly_set THEN
            IF v_user_global.max_questions IS NOT NULL THEN
                v_result := v_result || jsonb_build_object('max_questions', v_user_global.max_questions, 'source', 'user_global');
            END IF;
            IF v_user_global.cost_mode IS NOT NULL THEN
                v_result := v_result || jsonb_build_object('cost_mode', v_user_global.cost_mode);
            END IF;
            IF v_user_global.enabled IS NOT NULL THEN
                v_result := v_result || jsonb_build_object('enabled', v_user_global.enabled);
            END IF;
        END IF;
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_crucible_user_prefs_tenant ON crucible_user_preferences(tenant_id);
CREATE INDEX idx_crucible_user_prefs_user ON crucible_user_preferences(user_id);
CREATE INDEX idx_crucible_user_prefs_scope ON crucible_user_preferences(scope);
CREATE INDEX idx_crucible_user_prefs_method ON crucible_user_preferences(method_id) WHERE method_id IS NOT NULL;
CREATE INDEX idx_crucible_user_prefs_workflow ON crucible_user_preferences(workflow_id) WHERE workflow_id IS NOT NULL;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE crucible_system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE crucible_tenant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE crucible_user_preferences ENABLE ROW LEVEL SECURITY;

-- System config: Only system admins can modify
CREATE POLICY crucible_system_config_select ON crucible_system_config
    FOR SELECT USING (true);

CREATE POLICY crucible_system_config_modify ON crucible_system_config
    FOR ALL USING (
        current_setting('app.current_role', true) = 'system_admin'
    );

-- Tenant config: Tenant admins can modify their own
CREATE POLICY crucible_tenant_config_select ON crucible_tenant_config
    FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY crucible_tenant_config_modify ON crucible_tenant_config
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
        AND current_setting('app.current_role', true) IN ('tenant_admin', 'system_admin')
    );

-- User preferences: Users can modify their own
CREATE POLICY crucible_user_prefs_select ON crucible_user_preferences
    FOR SELECT USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
        AND (
            user_id = current_setting('app.current_user_id', true)::uuid
            OR current_setting('app.current_role', true) IN ('tenant_admin', 'system_admin')
        )
    );

CREATE POLICY crucible_user_prefs_modify ON crucible_user_preferences
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
        AND user_id = current_setting('app.current_user_id', true)::uuid
    );

-- ============================================================================
-- Triggers
-- ============================================================================

CREATE TRIGGER update_crucible_system_config_timestamp
    BEFORE UPDATE ON crucible_system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crucible_tenant_config_timestamp
    BEFORE UPDATE ON crucible_tenant_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crucible_user_prefs_timestamp
    BEFORE UPDATE ON crucible_user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE crucible_system_config IS 'System-wide Crucible defaults set by Radiant Admin';
COMMENT ON TABLE crucible_tenant_config IS 'Tenant-level Crucible overrides set by Think Tank Admin';
COMMENT ON TABLE crucible_user_preferences IS 'User-level Crucible preferences per method/workflow';
COMMENT ON FUNCTION get_crucible_resolved_config IS 'Resolves Crucible config using hierarchy: User > Tenant > System';
