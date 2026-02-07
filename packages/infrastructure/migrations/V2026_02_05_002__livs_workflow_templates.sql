-- LIVS-M Workflow Templates Migration
-- Adds support for governance workflow templates with system defaults and user overrides
-- Version: 6.4.0
-- Date: 2026-02-05

-- =============================================================================
-- Environment Mode Enum
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE livs_environment_mode AS ENUM (
        'strict_engineering',  -- All warnings treated as blockers
        'balanced',            -- Default behavior
        'brainstorming',       -- Creative mode, relaxed rules
        'audit'                -- Maximum scrutiny, everything logged
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- Enforcement Action Enum
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE livs_enforcement_action AS ENUM (
        'PASS',                      -- Allow through
        'BLOCK',                     -- Hard reject
        'REJECT_AND_RETRY',          -- Reject with retry instruction
        'TRIGGER_VERIFICATION_AGENT', -- Spawn antithesis agent
        'INJECT_CHAOS',              -- Inject devil's advocate
        'FLAG_FOR_REVIEW',           -- Allow but flag
        'ESCALATE'                   -- Escalate to human
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- Workflow Template Owner Type
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE livs_workflow_owner_type AS ENUM (
        'system',      -- RADIANT platform defaults
        'tenant',      -- Tenant admin overrides
        'user'         -- User personal workflows
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- LIVS Workflow Templates Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS livs_workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Template identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(100) NOT NULL,  -- URL-safe identifier
    
    -- Ownership
    owner_type livs_workflow_owner_type NOT NULL DEFAULT 'system',
    owner_id UUID,  -- user_id if owner_type = 'user'
    
    -- Parent template (for overrides)
    parent_template_id UUID REFERENCES livs_workflow_templates(id) ON DELETE SET NULL,
    
    -- Environment mode
    environment_mode livs_environment_mode NOT NULL DEFAULT 'balanced',
    treat_warnings_as_blockers BOOLEAN NOT NULL DEFAULT false,
    
    -- Interrogation settings
    default_interrogation_depth INTEGER NOT NULL DEFAULT 2 CHECK (default_interrogation_depth BETWEEN 0 AND 4),
    auto_escalate BOOLEAN NOT NULL DEFAULT true,
    escalation_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.6 CHECK (escalation_threshold BETWEEN 0 AND 1),
    interrogator_model VARCHAR(255),
    
    -- Code stub detection (Phase 1)
    stub_detection_enabled BOOLEAN NOT NULL DEFAULT true,
    stub_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of regex patterns
    stub_enforcement_action livs_enforcement_action NOT NULL DEFAULT 'REJECT_AND_RETRY',
    
    -- Sycophancy breaker settings
    sycophancy_detection_enabled BOOLEAN NOT NULL DEFAULT true,
    min_turns_before_agreement INTEGER NOT NULL DEFAULT 3,
    max_consensus_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.95,
    chaos_injection_prompt TEXT,
    
    -- Dialectical verification settings
    enable_thesis_antithesis BOOLEAN NOT NULL DEFAULT false,
    antithesis_model VARCHAR(255),  -- Model for devil's advocate
    synthesis_required BOOLEAN NOT NULL DEFAULT true,
    
    -- Behavioral rules (JSON array)
    behavioral_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Cost limits
    max_cost_multiplier DECIMAL(4,2) NOT NULL DEFAULT 2.0,
    max_tokens_per_interrogation INTEGER NOT NULL DEFAULT 4000,
    
    -- Activation
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,  -- Only one default per tenant
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_slug_per_tenant_owner UNIQUE (tenant_id, owner_type, owner_id, slug),
    CONSTRAINT valid_owner_id CHECK (
        (owner_type = 'system' AND owner_id IS NULL) OR
        (owner_type = 'tenant' AND owner_id IS NULL) OR
        (owner_type = 'user' AND owner_id IS NOT NULL)
    )
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_livs_workflow_templates_tenant ON livs_workflow_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_livs_workflow_templates_owner ON livs_workflow_templates(tenant_id, owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_livs_workflow_templates_default ON livs_workflow_templates(tenant_id, is_default) WHERE is_default = true;

-- =============================================================================
-- User Workflow Preferences Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS livs_user_workflow_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    -- Selected workflow
    active_workflow_id UUID REFERENCES livs_workflow_templates(id) ON DELETE SET NULL,
    
    -- Quick toggle
    livs_enabled BOOLEAN NOT NULL DEFAULT true,  -- Master on/off toggle
    
    -- Override individual settings without creating new template
    environment_mode_override livs_environment_mode,
    interrogation_depth_override INTEGER CHECK (interrogation_depth_override BETWEEN 0 AND 4),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_user_preference UNIQUE (tenant_id, user_id)
);

-- =============================================================================
-- Behavioral Rules Table (Normalized)
-- =============================================================================
CREATE TABLE IF NOT EXISTS livs_behavioral_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workflow_template_id UUID NOT NULL REFERENCES livs_workflow_templates(id) ON DELETE CASCADE,
    
    -- Rule identification
    rule_id VARCHAR(50) NOT NULL,  -- e.g., 'R001', 'R002'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Severity and enforcement
    severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    enforcement_action livs_enforcement_action NOT NULL DEFAULT 'FLAG_FOR_REVIEW',
    
    -- Trigger conditions (JSON)
    trigger_condition JSONB NOT NULL,
    
    -- Action on trigger
    action_prompt TEXT,  -- Prompt to inject on trigger
    
    -- Environment mode applicability
    applies_to_modes livs_environment_mode[] NOT NULL DEFAULT ARRAY['strict_engineering', 'balanced', 'audit']::livs_environment_mode[],
    
    -- Activation
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_rule_per_workflow UNIQUE (workflow_template_id, rule_id)
);

CREATE INDEX IF NOT EXISTS idx_livs_behavioral_rules_workflow ON livs_behavioral_rules(workflow_template_id);

-- =============================================================================
-- Code Stub Detection Log Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS livs_stub_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Context
    request_id UUID,
    user_id UUID,
    model_id VARCHAR(255),
    
    -- Detection details
    detected_stub TEXT NOT NULL,
    pattern_matched VARCHAR(500),
    line_number INTEGER,
    context_snippet TEXT,
    
    -- Action taken
    enforcement_action livs_enforcement_action NOT NULL,
    was_retry_successful BOOLEAN,
    
    -- Workflow context
    workflow_template_id UUID REFERENCES livs_workflow_templates(id) ON DELETE SET NULL,
    environment_mode livs_environment_mode,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_livs_stub_detections_tenant ON livs_stub_detections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_livs_stub_detections_created ON livs_stub_detections(created_at DESC);

-- =============================================================================
-- Sycophancy Detection Log Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS livs_sycophancy_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Pipeline context
    pipeline_execution_id UUID,
    agent_a_id VARCHAR(255),
    agent_b_id VARCHAR(255),
    
    -- Detection details
    turns_before_agreement INTEGER NOT NULL,
    consensus_score DECIMAL(3,2),
    detection_reason TEXT,
    
    -- Chaos injection
    chaos_injected BOOLEAN NOT NULL DEFAULT false,
    chaos_prompt_used TEXT,
    post_chaos_outcome TEXT,
    
    -- Workflow context
    workflow_template_id UUID REFERENCES livs_workflow_templates(id) ON DELETE SET NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_livs_sycophancy_detections_tenant ON livs_sycophancy_detections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_livs_sycophancy_detections_pipeline ON livs_sycophancy_detections(pipeline_execution_id);

-- =============================================================================
-- RLS Policies
-- =============================================================================
ALTER TABLE livs_workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE livs_user_workflow_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE livs_behavioral_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE livs_stub_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE livs_sycophancy_detections ENABLE ROW LEVEL SECURITY;

-- Workflow templates policy
DROP POLICY IF EXISTS livs_workflow_templates_tenant_isolation ON livs_workflow_templates;
CREATE POLICY livs_workflow_templates_tenant_isolation ON livs_workflow_templates
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- User preferences policy
DROP POLICY IF EXISTS livs_user_workflow_preferences_tenant_isolation ON livs_user_workflow_preferences;
CREATE POLICY livs_user_workflow_preferences_tenant_isolation ON livs_user_workflow_preferences
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Behavioral rules policy
DROP POLICY IF EXISTS livs_behavioral_rules_tenant_isolation ON livs_behavioral_rules;
CREATE POLICY livs_behavioral_rules_tenant_isolation ON livs_behavioral_rules
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Stub detections policy
DROP POLICY IF EXISTS livs_stub_detections_tenant_isolation ON livs_stub_detections;
CREATE POLICY livs_stub_detections_tenant_isolation ON livs_stub_detections
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Sycophancy detections policy
DROP POLICY IF EXISTS livs_sycophancy_detections_tenant_isolation ON livs_sycophancy_detections;
CREATE POLICY livs_sycophancy_detections_tenant_isolation ON livs_sycophancy_detections
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- Seed System Default Workflow Templates
-- =============================================================================
-- Note: These will be inserted by the application on first run per tenant
-- See livs-workflow-template.service.ts for seeding logic

-- =============================================================================
-- Default Behavioral Rules (JSON format for seeding)
-- =============================================================================
COMMENT ON TABLE livs_workflow_templates IS 'LIVS-M workflow templates with system defaults and user overrides. Default rules:
R001 - Stub/Placeholder Detection: REJECT_AND_RETRY on code stubs
R002 - Confidence Inflation Guard: FLAG_FOR_REVIEW when confidence > 0.95 without evidence
R003 - Sycophancy Breaker: INJECT_CHAOS when agreement < min_turns
R004 - Hedging Escalation: TRIGGER_VERIFICATION_AGENT on excessive hedging
R005 - Evidence Chain: BLOCK when assertions lack citations in strict mode';

-- =============================================================================
-- Trigger for updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_livs_workflow_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_livs_workflow_templates_updated_at ON livs_workflow_templates;
CREATE TRIGGER trigger_livs_workflow_templates_updated_at
    BEFORE UPDATE ON livs_workflow_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_livs_workflow_templates_updated_at();

DROP TRIGGER IF EXISTS trigger_livs_user_workflow_preferences_updated_at ON livs_user_workflow_preferences;
CREATE TRIGGER trigger_livs_user_workflow_preferences_updated_at
    BEFORE UPDATE ON livs_user_workflow_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_livs_workflow_templates_updated_at();

DROP TRIGGER IF EXISTS trigger_livs_behavioral_rules_updated_at ON livs_behavioral_rules;
CREATE TRIGGER trigger_livs_behavioral_rules_updated_at
    BEFORE UPDATE ON livs_behavioral_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_livs_workflow_templates_updated_at();
