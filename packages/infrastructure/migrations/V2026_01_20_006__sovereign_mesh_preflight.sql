-- ============================================================================
-- RADIANT v5.0 - SOVEREIGN MESH: PRE-FLIGHT PROVISIONING
-- Migration: V2026_01_20_006
-- 
-- Blueprint generation and capability verification before workflow execution.
-- Ensures all required apps are connected, models are available, and
-- resources are provisioned before starting expensive operations.
-- ============================================================================

CREATE TYPE blueprint_status AS ENUM (
  'draft', 'pending_provision', 'provisioning', 'provisioned', 'blocked', 'failed'
);

CREATE TYPE capability_status AS ENUM ('available', 'missing', 'expired', 'error');

-- ============================================================================
-- WORKFLOW BLUEPRINTS (generated before execution)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  
  -- Source
  source_prompt TEXT NOT NULL,
  source_type VARCHAR(50) DEFAULT 'natural_language', -- 'natural_language', 'template', 'api'
  
  -- Generated structure
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  
  -- Requirements
  required_capabilities JSONB NOT NULL DEFAULT '[]',
  required_apps TEXT[] DEFAULT '{}',
  required_agents TEXT[] DEFAULT '{}',
  required_models TEXT[] DEFAULT '{}',
  
  -- Estimates
  estimated_cost_usd DECIMAL(10,4),
  estimated_duration_seconds INTEGER,
  estimated_tokens INTEGER,
  complexity_score INTEGER, -- 1-10
  
  -- Status
  status blueprint_status NOT NULL DEFAULT 'draft',
  provisioning_results JSONB DEFAULT '{}',
  missing_capabilities JSONB DEFAULT '[]',
  blocking_reasons TEXT[],
  
  -- Auth prompts for missing connections
  auth_prompt_url TEXT,
  auth_required_apps TEXT[],
  
  -- Execution
  executed_workflow_id UUID,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provisioned_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- ============================================================================
-- CAPABILITY CHECKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS capability_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES workflow_blueprints(id) ON DELETE CASCADE,
  
  capability_type VARCHAR(50) NOT NULL, -- 'app_connection', 'model_access', 'agent_access', 'permission'
  capability_name VARCHAR(200) NOT NULL,
  
  status capability_status NOT NULL,
  
  -- Related entities
  app_id UUID REFERENCES apps(id),
  connection_id UUID REFERENCES app_connections(id),
  agent_id UUID REFERENCES agents(id),
  
  -- Error details
  error_message TEXT,
  error_code VARCHAR(50),
  
  -- Resolution
  oauth_url TEXT,
  resolution_steps JSONB,
  
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PROVISIONING SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS provisioning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID NOT NULL REFERENCES workflow_blueprints(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  
  -- Steps
  steps JSONB DEFAULT '[]',
  completed_steps JSONB DEFAULT '[]',
  failed_steps JSONB DEFAULT '[]',
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Results
  success BOOLEAN,
  error_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_blueprints_tenant ON workflow_blueprints(tenant_id);
CREATE INDEX idx_blueprints_status ON workflow_blueprints(status);
CREATE INDEX idx_blueprints_user ON workflow_blueprints(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_blueprints_recent ON workflow_blueprints(created_at DESC);

CREATE INDEX idx_cap_checks_blueprint ON capability_checks(blueprint_id);
CREATE INDEX idx_cap_checks_status ON capability_checks(status);
CREATE INDEX idx_cap_checks_type ON capability_checks(capability_type);

CREATE INDEX idx_prov_sessions_blueprint ON provisioning_sessions(blueprint_id);
CREATE INDEX idx_prov_sessions_tenant ON provisioning_sessions(tenant_id);
CREATE INDEX idx_prov_sessions_status ON provisioning_sessions(status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE workflow_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE capability_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisioning_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY blueprints_isolation ON workflow_blueprints FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY cap_checks_isolation ON capability_checks FOR ALL USING (
  blueprint_id IN (
    SELECT id FROM workflow_blueprints 
    WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
  )
);

CREATE POLICY prov_sessions_isolation ON provisioning_sessions FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW v_blueprint_summary AS
SELECT 
  b.id,
  b.tenant_id,
  b.status,
  b.estimated_cost_usd,
  b.estimated_duration_seconds,
  b.complexity_score,
  array_length(b.required_apps, 1) as required_apps_count,
  array_length(b.required_agents, 1) as required_agents_count,
  (SELECT COUNT(*) FROM capability_checks c WHERE c.blueprint_id = b.id AND c.status = 'available') as available_capabilities,
  (SELECT COUNT(*) FROM capability_checks c WHERE c.blueprint_id = b.id AND c.status = 'missing') as missing_capabilities,
  b.created_at
FROM workflow_blueprints b;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE workflow_blueprints IS 'Pre-execution blueprints with capability requirements and cost estimates';
COMMENT ON TABLE capability_checks IS 'Individual capability verification results for blueprints';
COMMENT ON TABLE provisioning_sessions IS 'Tracks the provisioning process for blueprints';
