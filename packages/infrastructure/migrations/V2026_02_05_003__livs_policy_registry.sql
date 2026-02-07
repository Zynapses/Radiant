-- LIVS-M 2.0 Policy Registry Migration
-- Version: 2.0.0
-- Since: v7.8.0
-- 
-- Creates tables for the "Soft Registry" governance system that decouples
-- AI behavior logic from enforcement rules.

-- Environment mode enum for registry
DO $$ BEGIN
    CREATE TYPE registry_environment_mode AS ENUM (
        'STRICT_AUDIT',
        'BALANCED',
        'RAPID_PROTO',
        'HACKATHON'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Collaboration style enum
DO $$ BEGIN
    CREATE TYPE registry_collaboration_style AS ENUM (
        'ADVERSARIAL',
        'COLLABORATIVE',
        'HIERARCHICAL'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Registry enforcement action enum
DO $$ BEGIN
    CREATE TYPE registry_enforcement_action AS ENUM (
        'REJECT_IMMEDIATE',
        'REQUEST_AMENDMENT',
        'TRIGGER_CHAOS_AGENT',
        'TRIGGER_VERIFICATION',
        'FLAG_FOR_REVIEW',
        'LOG_ONLY',
        'ESCALATE_TO_HUMAN'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Rule severity enum
DO $$ BEGIN
    CREATE TYPE registry_rule_severity AS ENUM (
        'CRITICAL',
        'BLOCKER',
        'WARNING',
        'INFO'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Supervisor decision enum
DO $$ BEGIN
    CREATE TYPE supervisor_decision AS ENUM (
        'APPROVE',
        'REJECT',
        'INTERVENE'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Agent role enum
DO $$ BEGIN
    CREATE TYPE registry_agent_role AS ENUM (
        'THESIS_AGENT',
        'ANTITHESIS_AGENT',
        'SYNTHESIS_AGENT',
        'SUPERVISOR',
        'CHAOS_AGENT',
        'VERIFICATION_AGENT'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Main policy registry table (stores full registry JSON per tenant)
CREATE TABLE IF NOT EXISTS livs_policy_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    registry JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- Index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_livs_policy_registry_tenant 
ON livs_policy_registry(tenant_id);

-- Registry evaluation log (audit trail)
CREATE TABLE IF NOT EXISTS livs_registry_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_role registry_agent_role NOT NULL,
    agent_output_preview TEXT,
    decision supervisor_decision NOT NULL,
    violations JSONB NOT NULL DEFAULT '[]',
    rules_evaluated INTEGER NOT NULL DEFAULT 0,
    patterns_matched INTEGER NOT NULL DEFAULT 0,
    processing_time_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for evaluation queries
CREATE INDEX IF NOT EXISTS idx_livs_registry_evaluations_tenant 
ON livs_registry_evaluations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_livs_registry_evaluations_created 
ON livs_registry_evaluations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_livs_registry_evaluations_decision 
ON livs_registry_evaluations(decision);

-- Registry change history for audit
CREATE TABLE IF NOT EXISTS livs_registry_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'RESET', 'RULE_ADD', 'RULE_REMOVE', 'MODE_CHANGE'
    previous_registry JSONB,
    new_registry JSONB NOT NULL,
    changed_by UUID REFERENCES users(id),
    change_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for history lookups
CREATE INDEX IF NOT EXISTS idx_livs_registry_history_tenant 
ON livs_registry_history(tenant_id);

CREATE INDEX IF NOT EXISTS idx_livs_registry_history_created 
ON livs_registry_history(created_at DESC);

-- Agent interaction log for supervisor governance loop
CREATE TABLE IF NOT EXISTS livs_agent_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    agent_role registry_agent_role NOT NULL,
    interaction_turn INTEGER NOT NULL DEFAULT 1,
    input_preview TEXT,
    output_preview TEXT,
    supervisor_decision supervisor_decision,
    violations JSONB DEFAULT '[]',
    chaos_injected BOOLEAN DEFAULT FALSE,
    chaos_prompt TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for interaction queries
CREATE INDEX IF NOT EXISTS idx_livs_agent_interactions_tenant 
ON livs_agent_interactions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_livs_agent_interactions_session 
ON livs_agent_interactions(session_id);

CREATE INDEX IF NOT EXISTS idx_livs_agent_interactions_created 
ON livs_agent_interactions(created_at DESC);

-- RLS Policies
ALTER TABLE livs_policy_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE livs_registry_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE livs_registry_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE livs_agent_interactions ENABLE ROW LEVEL SECURITY;

-- Policy registry RLS
CREATE POLICY livs_policy_registry_tenant_isolation ON livs_policy_registry
    FOR ALL
    USING (tenant_id = COALESCE(current_setting('app.current_tenant_id', true)::UUID, tenant_id));

-- Evaluations RLS
CREATE POLICY livs_registry_evaluations_tenant_isolation ON livs_registry_evaluations
    FOR ALL
    USING (tenant_id = COALESCE(current_setting('app.current_tenant_id', true)::UUID, tenant_id));

-- History RLS
CREATE POLICY livs_registry_history_tenant_isolation ON livs_registry_history
    FOR ALL
    USING (tenant_id = COALESCE(current_setting('app.current_tenant_id', true)::UUID, tenant_id));

-- Interactions RLS
CREATE POLICY livs_agent_interactions_tenant_isolation ON livs_agent_interactions
    FOR ALL
    USING (tenant_id = COALESCE(current_setting('app.current_tenant_id', true)::UUID, tenant_id));

-- Function to log registry changes automatically
CREATE OR REPLACE FUNCTION log_livs_registry_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO livs_registry_history (tenant_id, change_type, new_registry, changed_by)
        VALUES (NEW.tenant_id, 'CREATE', NEW.registry, NEW.updated_by);
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO livs_registry_history (tenant_id, change_type, previous_registry, new_registry, changed_by)
        VALUES (NEW.tenant_id, 'UPDATE', OLD.registry, NEW.registry, NEW.updated_by);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for registry change logging
DROP TRIGGER IF EXISTS tr_livs_registry_change ON livs_policy_registry;
CREATE TRIGGER tr_livs_registry_change
    AFTER INSERT OR UPDATE ON livs_policy_registry
    FOR EACH ROW
    EXECUTE FUNCTION log_livs_registry_change();

-- Analytics view for registry usage
CREATE OR REPLACE VIEW livs_registry_analytics AS
SELECT
    e.tenant_id,
    DATE_TRUNC('day', e.created_at) AS day,
    e.decision,
    COUNT(*) AS evaluation_count,
    AVG(e.rules_evaluated) AS avg_rules_evaluated,
    AVG(e.patterns_matched) AS avg_patterns_matched,
    AVG(e.processing_time_ms) AS avg_processing_time_ms,
    SUM(JSONB_ARRAY_LENGTH(e.violations)) AS total_violations
FROM livs_registry_evaluations e
GROUP BY e.tenant_id, DATE_TRUNC('day', e.created_at), e.decision;

-- Comment documentation
COMMENT ON TABLE livs_policy_registry IS 'LIVS-M 2.0 Policy Registry - stores the soft registry JSON per tenant';
COMMENT ON TABLE livs_registry_evaluations IS 'Audit log of all policy registry evaluations';
COMMENT ON TABLE livs_registry_history IS 'History of all changes to policy registries';
COMMENT ON TABLE livs_agent_interactions IS 'Log of agent interactions within the supervisor governance loop';
COMMENT ON VIEW livs_registry_analytics IS 'Analytics view for registry usage patterns';
