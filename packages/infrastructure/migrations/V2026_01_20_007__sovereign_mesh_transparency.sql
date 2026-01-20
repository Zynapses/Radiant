-- ============================================================================
-- RADIANT v5.0 - SOVEREIGN MESH: TRANSPARENCY LAYER
-- Migration: V2026_01_20_007
-- 
-- Complete visibility into Cato's decision-making process.
-- Every decision is logged with reasoning chain, alternatives considered,
-- and War Room deliberation details when applicable.
-- ============================================================================

CREATE TYPE decision_type AS ENUM (
  'model_selection', 'workflow_selection', 'mode_selection',
  'agent_selection', 'tool_selection', 'safety_evaluation', 
  'cost_optimization', 'routing', 'fallback'
);

CREATE TYPE explanation_tier AS ENUM ('summary', 'standard', 'detailed', 'audit');

-- ============================================================================
-- CATO DECISION EVENTS (every decision logged)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_decision_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id UUID,
  request_id UUID,
  
  decision_type decision_type NOT NULL,
  decision_input JSONB NOT NULL,
  decision_output JSONB NOT NULL,
  
  -- Reasoning
  reasoning_chain JSONB DEFAULT '[]',
  factors_considered JSONB DEFAULT '[]',
  alternatives_rejected JSONB DEFAULT '[]',
  
  -- Model selection details
  selected_model VARCHAR(100),
  model_candidates JSONB DEFAULT '[]',
  selection_criteria JSONB,
  
  -- Cost
  estimated_cost DECIMAL(10,6),
  actual_cost DECIMAL(10,6),
  
  -- Safety (Genesis Cato integration)
  governor_state VARCHAR(30),
  cbf_evaluations JSONB DEFAULT '[]',
  safety_score DECIMAL(3,2),
  
  -- Timing
  decision_latency_ms INTEGER,
  
  -- Context
  user_id UUID REFERENCES users(id),
  workflow_id UUID,
  agent_execution_id UUID REFERENCES agent_executions(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- WAR ROOM DELIBERATIONS (phase-by-phase debate capture)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_war_room_deliberations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_event_id UUID NOT NULL REFERENCES cato_decision_events(id) ON DELETE CASCADE,
  
  phase VARCHAR(50) NOT NULL,
  phase_order INTEGER NOT NULL,
  
  -- Participant
  participant_role VARCHAR(50) NOT NULL, -- 'advocate', 'critic', 'synthesizer', 'judge'
  participant_model VARCHAR(100) NOT NULL,
  
  -- Content
  input_prompt TEXT,
  output_response TEXT,
  
  -- Analysis
  key_points JSONB DEFAULT '[]',
  objections JSONB DEFAULT '[]',
  agreements JSONB DEFAULT '[]',
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  latency_ms INTEGER,
  
  -- Cost
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd DECIMAL(10,6)
);

-- ============================================================================
-- PRE-COMPUTED EXPLANATIONS (for quick retrieval)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_decision_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_event_id UUID NOT NULL REFERENCES cato_decision_events(id) ON DELETE CASCADE,
  
  tier explanation_tier NOT NULL,
  explanation TEXT NOT NULL,
  full_context JSONB,
  
  -- Metadata
  generated_by VARCHAR(100), -- model that generated this
  tokens_used INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_explanation_tier UNIQUE (decision_event_id, tier)
);

-- ============================================================================
-- DECISION FEEDBACK (user ratings on decisions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_decision_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_event_id UUID NOT NULL REFERENCES cato_decision_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_type VARCHAR(50), -- 'helpful', 'accurate', 'fast', 'wrong', 'slow'
  comment TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_user_decision_feedback UNIQUE (decision_event_id, user_id)
);

-- ============================================================================
-- DECISION PATTERNS (learned from successful decisions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cato_decision_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  decision_type decision_type NOT NULL,
  pattern_name VARCHAR(200) NOT NULL,
  
  -- Pattern definition
  input_pattern JSONB NOT NULL,
  recommended_output JSONB NOT NULL,
  
  -- Statistics
  times_matched INTEGER DEFAULT 0,
  times_successful INTEGER DEFAULT 0,
  avg_user_rating DECIMAL(3,2),
  
  -- Learning
  source_decision_ids UUID[] DEFAULT '{}',
  confidence DECIMAL(3,2) DEFAULT 0.5,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_decisions_tenant ON cato_decision_events(tenant_id);
CREATE INDEX idx_decisions_session ON cato_decision_events(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_decisions_type ON cato_decision_events(decision_type);
CREATE INDEX idx_decisions_recent ON cato_decision_events(created_at DESC);
CREATE INDEX idx_decisions_model ON cato_decision_events(selected_model) WHERE selected_model IS NOT NULL;
CREATE INDEX idx_decisions_user ON cato_decision_events(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX idx_war_room_event ON cato_war_room_deliberations(decision_event_id);
CREATE INDEX idx_war_room_phase ON cato_war_room_deliberations(decision_event_id, phase_order);

CREATE INDEX idx_explanations_event ON cato_decision_explanations(decision_event_id);
CREATE INDEX idx_explanations_tier ON cato_decision_explanations(tier);

CREATE INDEX idx_feedback_event ON cato_decision_feedback(decision_event_id);
CREATE INDEX idx_feedback_user ON cato_decision_feedback(user_id);

CREATE INDEX idx_patterns_type ON cato_decision_patterns(decision_type);
CREATE INDEX idx_patterns_tenant ON cato_decision_patterns(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_patterns_active ON cato_decision_patterns(is_active) WHERE is_active;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE cato_decision_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_war_room_deliberations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_decision_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_decision_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_decision_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY decisions_isolation ON cato_decision_events FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY war_room_isolation ON cato_war_room_deliberations FOR ALL USING (
  decision_event_id IN (
    SELECT id FROM cato_decision_events 
    WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
  )
);

CREATE POLICY explanations_isolation ON cato_decision_explanations FOR ALL USING (
  decision_event_id IN (
    SELECT id FROM cato_decision_events 
    WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
  )
);

CREATE POLICY feedback_isolation ON cato_decision_feedback FOR ALL USING (
  decision_event_id IN (
    SELECT id FROM cato_decision_events 
    WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
  )
);

CREATE POLICY patterns_isolation ON cato_decision_patterns FOR ALL USING (
  tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW v_decision_summary AS
SELECT 
  d.id,
  d.tenant_id,
  d.decision_type,
  d.selected_model,
  d.estimated_cost,
  d.actual_cost,
  d.decision_latency_ms,
  d.safety_score,
  (SELECT COUNT(*) FROM cato_war_room_deliberations w WHERE w.decision_event_id = d.id) as war_room_phases,
  (SELECT AVG(f.rating) FROM cato_decision_feedback f WHERE f.decision_event_id = d.id) as avg_rating,
  d.created_at
FROM cato_decision_events d;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE cato_decision_events IS 'Complete log of all Cato decisions with reasoning chains';
COMMENT ON TABLE cato_war_room_deliberations IS 'Phase-by-phase War Room debate capture';
COMMENT ON TABLE cato_decision_explanations IS 'Pre-computed explanations at different detail tiers';
COMMENT ON TABLE cato_decision_feedback IS 'User feedback on decision quality';
COMMENT ON TABLE cato_decision_patterns IS 'Learned patterns from successful decisions';
