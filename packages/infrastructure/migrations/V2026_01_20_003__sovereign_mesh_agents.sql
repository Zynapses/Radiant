-- ============================================================================
-- RADIANT v5.0 - SOVEREIGN MESH: AGENT REGISTRY
-- Migration: V2026_01_20_003
-- 
-- The Sovereign Mesh introduces AI assistance at every node level.
-- This migration creates the Agent Registry for goal-oriented autonomous workers.
-- ============================================================================

-- Agent Classification
CREATE TYPE agent_category AS ENUM (
  'research', 'coding', 'data', 'outreach', 'creative', 'operations', 'custom'
);

CREATE TYPE agent_execution_mode AS ENUM ('sync', 'async', 'streaming');

CREATE TYPE agent_impl_type AS ENUM ('builtin', 'flyte_workflow', 'mcp_server', 'external');

CREATE TYPE agent_scope AS ENUM ('system', 'tenant', 'user');

CREATE TYPE agent_safety_profile AS ENUM ('minimal', 'standard', 'strict', 'hipaa');

-- ============================================================================
-- AGENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  
  -- Classification
  category agent_category NOT NULL,
  capabilities TEXT[] NOT NULL DEFAULT '{}',
  
  -- Execution
  execution_mode agent_execution_mode NOT NULL DEFAULT 'async',
  max_iterations INTEGER NOT NULL DEFAULT 50,
  default_timeout_minutes INTEGER NOT NULL DEFAULT 30,
  
  -- Resources
  default_budget_usd DECIMAL(10,4) DEFAULT 1.00,
  max_budget_usd DECIMAL(10,4) DEFAULT 10.00,
  allowed_models TEXT[] NOT NULL DEFAULT '{}',
  allowed_tools TEXT[] NOT NULL DEFAULT '{}',
  
  -- Safety (Genesis Cato integration)
  safety_profile agent_safety_profile NOT NULL DEFAULT 'standard',
  requires_hitl BOOLEAN NOT NULL DEFAULT false,
  cbf_overrides JSONB DEFAULT '{}',
  
  -- Implementation
  implementation_type agent_impl_type NOT NULL,
  implementation_ref TEXT NOT NULL,
  config_schema JSONB,
  
  -- AI Helper Configuration (PARAMETRIC - each agent can have independent AI config)
  ai_helper_config JSONB NOT NULL DEFAULT '{
    "enabled": true,
    "disambiguation": {
      "enabled": true,
      "model": "claude-haiku-35",
      "confidenceThreshold": 0.7
    },
    "parameterInference": {
      "enabled": true,
      "model": "claude-haiku-35",
      "examples": []
    },
    "errorRecovery": {
      "enabled": true,
      "model": "claude-haiku-35",
      "maxAttempts": 3
    },
    "validation": {
      "enabled": false,
      "model": null,
      "checks": []
    },
    "explanation": {
      "enabled": true,
      "model": "claude-haiku-35"
    }
  }',
  
  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  scope agent_scope NOT NULL DEFAULT 'system',
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_agent_name_scope UNIQUE (name, scope, tenant_id)
);

-- ============================================================================
-- AGENT EXECUTIONS (OODA Loop State)
-- ============================================================================

CREATE TYPE agent_execution_status AS ENUM (
  'pending', 'provisioning', 'running', 'paused',
  'completed', 'failed', 'timeout', 'budget_exceeded', 'cancelled'
);

CREATE TYPE agent_hitl_decision AS ENUM ('approved', 'rejected', 'modified');

CREATE TYPE ooda_phase AS ENUM ('observe', 'orient', 'decide', 'act', 'report');

CREATE TABLE IF NOT EXISTS agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  session_id UUID,
  
  -- Goal
  goal TEXT NOT NULL,
  constraints JSONB DEFAULT '{}',
  config JSONB DEFAULT '{}',
  
  -- OODA State
  status agent_execution_status NOT NULL DEFAULT 'pending',
  current_phase ooda_phase DEFAULT 'observe',
  current_iteration INTEGER NOT NULL DEFAULT 0,
  
  -- Working Memory (primary in Redis, snapshot here)
  observations JSONB DEFAULT '[]',
  hypotheses JSONB DEFAULT '[]',
  plan JSONB DEFAULT '[]',
  completed_actions JSONB DEFAULT '[]',
  
  -- Results
  artifacts JSONB DEFAULT '[]',
  output_summary TEXT,
  
  -- Resources
  budget_allocated DECIMAL(10,4) NOT NULL,
  budget_consumed DECIMAL(10,4) NOT NULL DEFAULT 0,
  tokens_used BIGINT NOT NULL DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  timeout_at TIMESTAMPTZ,
  
  -- HITL
  hitl_required BOOLEAN NOT NULL DEFAULT false,
  hitl_decision agent_hitl_decision,
  hitl_decided_by UUID REFERENCES users(id),
  hitl_decided_at TIMESTAMPTZ,
  hitl_notes TEXT,
  
  -- Safety
  safety_flags TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- AGENT ITERATION LOG (detailed OODA tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_iteration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES agent_executions(id) ON DELETE CASCADE,
  
  iteration_number INTEGER NOT NULL,
  phase ooda_phase NOT NULL,
  
  -- Phase details
  phase_input JSONB,
  phase_output JSONB,
  
  -- Model usage
  model_used VARCHAR(100),
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd DECIMAL(10,6),
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Errors
  error_code VARCHAR(50),
  error_message TEXT
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_agents_category ON agents(category);
CREATE INDEX idx_agents_scope ON agents(scope, tenant_id);
CREATE INDEX idx_agents_active ON agents(is_active) WHERE is_active;
CREATE INDEX idx_agents_name ON agents(name);

CREATE INDEX idx_agent_exec_tenant ON agent_executions(tenant_id);
CREATE INDEX idx_agent_exec_status ON agent_executions(status);
CREATE INDEX idx_agent_exec_agent ON agent_executions(agent_id);
CREATE INDEX idx_agent_exec_active ON agent_executions(tenant_id, status) 
  WHERE status IN ('pending', 'provisioning', 'running', 'paused');
CREATE INDEX idx_agent_exec_user ON agent_executions(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX idx_agent_iter_execution ON agent_iteration_logs(execution_id);
CREATE INDEX idx_agent_iter_phase ON agent_iteration_logs(execution_id, iteration_number);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_iteration_logs ENABLE ROW LEVEL SECURITY;

-- Agents: system scope visible to all, tenant scope only to that tenant
CREATE POLICY agents_isolation ON agents FOR ALL USING (
  scope = 'system' OR tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

-- Executions: strict tenant isolation
CREATE POLICY agent_exec_isolation ON agent_executions FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

-- Iteration logs: inherit from execution
CREATE POLICY agent_iter_isolation ON agent_iteration_logs FOR ALL USING (
  execution_id IN (
    SELECT id FROM agent_executions 
    WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
  )
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_agents_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_agents_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE agents IS 'Registry of autonomous agents with OODA-loop execution capability';
COMMENT ON TABLE agent_executions IS 'Agent execution instances with goal tracking and HITL support';
COMMENT ON TABLE agent_iteration_logs IS 'Detailed log of each OODA iteration for debugging and replay';
COMMENT ON COLUMN agents.ai_helper_config IS 'Parametric AI configuration - each agent can enable/disable AI helpers independently';
