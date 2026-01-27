-- ============================================================================
-- RADIANT Genesis State Persistence
-- Migration: V2026_01_26_001__genesis_state_persistence.sql
-- 
-- Adds database persistence for Genesis developmental gates and state.
-- The Genesis service was using in-memory Map storage which doesn't persist
-- across Lambda invocations.
-- ============================================================================

-- ============================================================================
-- GENESIS STATE TABLE
-- Tracks the developmental stage and capabilities per tenant
-- ============================================================================

CREATE TABLE IF NOT EXISTS genesis_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Developmental stage
  current_stage VARCHAR(20) NOT NULL DEFAULT 'EMBRYONIC' 
    CHECK (current_stage IN ('EMBRYONIC', 'NASCENT', 'DEVELOPING', 'MATURING', 'MATURE')),
  
  -- Capabilities and restrictions as JSON arrays
  capabilities JSONB NOT NULL DEFAULT '["basic_chat", "simple_queries"]'::jsonb,
  restrictions JSONB NOT NULL DEFAULT '["no_external_actions", "no_code_execution", "no_file_access"]'::jsonb,
  
  -- Assessment tracking
  last_assessment TIMESTAMPTZ DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_genesis_state_tenant UNIQUE (tenant_id)
);

-- ============================================================================
-- GENESIS GATES TABLE
-- Tracks individual developmental gate status per tenant
-- ============================================================================

CREATE TABLE IF NOT EXISTS genesis_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Gate identification
  gate_id VARCHAR(10) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  stage VARCHAR(20) NOT NULL 
    CHECK (stage IN ('EMBRYONIC', 'NASCENT', 'DEVELOPING', 'MATURING', 'MATURE')),
  requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Gate status
  status VARCHAR(20) NOT NULL DEFAULT 'LOCKED' 
    CHECK (status IN ('LOCKED', 'PENDING', 'PASSED', 'BYPASSED')),
  passed_at TIMESTAMPTZ,
  bypass_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_genesis_gate_tenant UNIQUE (tenant_id, gate_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_genesis_state_tenant ON genesis_state(tenant_id);
CREATE INDEX IF NOT EXISTS idx_genesis_state_stage ON genesis_state(current_stage);
CREATE INDEX IF NOT EXISTS idx_genesis_gates_tenant ON genesis_gates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_genesis_gates_status ON genesis_gates(status);
CREATE INDEX IF NOT EXISTS idx_genesis_gates_stage ON genesis_gates(stage);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE genesis_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE genesis_gates ENABLE ROW LEVEL SECURITY;

CREATE POLICY genesis_state_tenant_policy ON genesis_state
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY genesis_gates_tenant_policy ON genesis_gates
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_genesis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER genesis_state_updated_at
  BEFORE UPDATE ON genesis_state
  FOR EACH ROW EXECUTE FUNCTION update_genesis_updated_at();

CREATE TRIGGER genesis_gates_updated_at
  BEFORE UPDATE ON genesis_gates
  FOR EACH ROW EXECUTE FUNCTION update_genesis_updated_at();

-- ============================================================================
-- AUTO-INITIALIZE GENESIS STATE FOR NEW TENANTS
-- ============================================================================

CREATE OR REPLACE FUNCTION initialize_genesis_for_tenant()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default genesis state
  INSERT INTO genesis_state (tenant_id, current_stage, capabilities, restrictions)
  VALUES (
    NEW.id,
    'EMBRYONIC',
    '["basic_chat", "simple_queries"]'::jsonb,
    '["no_external_actions", "no_code_execution", "no_file_access"]'::jsonb
  )
  ON CONFLICT (tenant_id) DO NOTHING;
  
  -- Create default gates
  INSERT INTO genesis_gates (tenant_id, gate_id, name, description, stage, requirements, status)
  VALUES
    (NEW.id, 'G1', 'Basic Safety', 'Core safety protocols active', 'EMBRYONIC', '["safety_filters", "content_moderation"]'::jsonb, 'LOCKED'),
    (NEW.id, 'G2', 'Context Awareness', 'Context understanding verified', 'NASCENT', '["context_retention", "session_management"]'::jsonb, 'LOCKED'),
    (NEW.id, 'G3', 'Ethical Reasoning', 'Ethics framework integrated', 'DEVELOPING', '["ethics_checks", "harm_prevention"]'::jsonb, 'LOCKED'),
    (NEW.id, 'G4', 'Advanced Autonomy', 'Safe autonomous actions', 'MATURING', '["checkpoint_system", "rollback_capability"]'::jsonb, 'LOCKED'),
    (NEW.id, 'G5', 'Full Capability', 'All capabilities unlocked', 'MATURE', '["audit_compliance", "governance_preset"]'::jsonb, 'LOCKED')
  ON CONFLICT (tenant_id, gate_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to tenants table (if not exists)
DROP TRIGGER IF EXISTS tenant_genesis_init ON tenants;
CREATE TRIGGER tenant_genesis_init
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION initialize_genesis_for_tenant();

-- ============================================================================
-- INITIALIZE EXISTING TENANTS
-- ============================================================================

INSERT INTO genesis_state (tenant_id, current_stage, capabilities, restrictions)
SELECT 
  id,
  'EMBRYONIC',
  '["basic_chat", "simple_queries"]'::jsonb,
  '["no_external_actions", "no_code_execution", "no_file_access"]'::jsonb
FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO genesis_gates (tenant_id, gate_id, name, description, stage, requirements, status)
SELECT 
  t.id,
  g.gate_id,
  g.name,
  g.description,
  g.stage,
  g.requirements,
  'LOCKED'
FROM tenants t
CROSS JOIN (
  VALUES 
    ('G1', 'Basic Safety', 'Core safety protocols active', 'EMBRYONIC', '["safety_filters", "content_moderation"]'::jsonb),
    ('G2', 'Context Awareness', 'Context understanding verified', 'NASCENT', '["context_retention", "session_management"]'::jsonb),
    ('G3', 'Ethical Reasoning', 'Ethics framework integrated', 'DEVELOPING', '["ethics_checks", "harm_prevention"]'::jsonb),
    ('G4', 'Advanced Autonomy', 'Safe autonomous actions', 'MATURING', '["checkpoint_system", "rollback_capability"]'::jsonb),
    ('G5', 'Full Capability', 'All capabilities unlocked', 'MATURE', '["audit_compliance", "governance_preset"]'::jsonb)
) AS g(gate_id, name, description, stage, requirements)
ON CONFLICT (tenant_id, gate_id) DO NOTHING;

-- ============================================================================
-- MIGRATION RECORD
-- ============================================================================

INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('V2026_01_26_001', 'Genesis state persistence tables', NOW())
ON CONFLICT (version) DO NOTHING;
