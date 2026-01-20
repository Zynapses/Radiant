-- ============================================================================
-- RADIANT v5.0 - SOVEREIGN MESH: EXECUTION HISTORY & TIME-TRAVEL DEBUGGING
-- Migration: V2026_01_20_009
-- 
-- Complete execution snapshots enabling replay, debugging, and what-if analysis.
-- Every workflow, agent, and service execution is captured for full reproducibility.
-- ============================================================================

CREATE TYPE snapshot_type AS ENUM ('workflow', 'agent', 'method', 'service', 'app_action');

CREATE TYPE replay_mode AS ENUM ('full', 'from_step', 'modified_input', 'what_if');

CREATE TYPE replay_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- ============================================================================
-- EXECUTION SNAPSHOTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS execution_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  snapshot_type snapshot_type NOT NULL,
  execution_id UUID NOT NULL,
  step_number INTEGER NOT NULL,
  step_name VARCHAR(200),
  
  -- State capture
  input_state JSONB NOT NULL,
  output_state JSONB,
  internal_state JSONB,
  
  -- Environment
  environment_vars JSONB,
  config_snapshot JSONB,
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Cost
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd DECIMAL(10,6),
  
  -- Model used
  model_id VARCHAR(100),
  model_params JSONB,
  
  -- Safety (Genesis Cato state)
  governor_state VARCHAR(30),
  cbf_evaluation JSONB,
  
  -- Error (if failed)
  error_code VARCHAR(50),
  error_message TEXT,
  error_stack TEXT,
  
  -- Lineage
  parent_snapshot_id UUID REFERENCES execution_snapshots(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- REPLAY SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS replay_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Source
  original_execution_id UUID NOT NULL,
  original_snapshot_type snapshot_type NOT NULL,
  
  -- Replay configuration
  replay_mode replay_mode NOT NULL,
  from_step INTEGER,
  modified_input JSONB,
  what_if_changes JSONB,
  
  -- Status
  status replay_status NOT NULL DEFAULT 'pending',
  
  -- New execution
  new_execution_id UUID,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Comparison results
  comparison_results JSONB,
  divergence_point INTEGER,
  divergence_reason TEXT,
  
  -- Notes
  notes TEXT,
  tags TEXT[],
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- EXECUTION DIFFS (comparison between original and replay)
-- ============================================================================

CREATE TABLE IF NOT EXISTS execution_diffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  replay_session_id UUID NOT NULL REFERENCES replay_sessions(id) ON DELETE CASCADE,
  
  step_number INTEGER NOT NULL,
  
  -- Diff details
  original_snapshot_id UUID REFERENCES execution_snapshots(id),
  replay_snapshot_id UUID REFERENCES execution_snapshots(id),
  
  -- Changes
  input_diff JSONB,
  output_diff JSONB,
  state_diff JSONB,
  
  -- Analysis
  is_significant BOOLEAN DEFAULT false,
  significance_reason TEXT,
  
  -- Timing diff
  original_duration_ms INTEGER,
  replay_duration_ms INTEGER,
  
  -- Cost diff
  original_cost_usd DECIMAL(10,6),
  replay_cost_usd DECIMAL(10,6),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- EXECUTION BOOKMARKS (saved points for quick replay)
-- ============================================================================

CREATE TABLE IF NOT EXISTS execution_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  snapshot_id UUID NOT NULL REFERENCES execution_snapshots(id) ON DELETE CASCADE,
  
  name VARCHAR(200) NOT NULL,
  description TEXT,
  tags TEXT[],
  
  is_shared BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- EXECUTION ANNOTATIONS (user notes on steps)
-- ============================================================================

CREATE TABLE IF NOT EXISTS execution_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES execution_snapshots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  annotation_type VARCHAR(50) NOT NULL, -- 'note', 'bug', 'question', 'insight'
  content TEXT NOT NULL,
  
  -- Position in output
  highlight_path TEXT, -- JSON path to highlighted element
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_snapshots_tenant ON execution_snapshots(tenant_id);
CREATE INDEX idx_snapshots_execution ON execution_snapshots(execution_id);
CREATE INDEX idx_snapshots_type ON execution_snapshots(snapshot_type, execution_id);
CREATE INDEX idx_snapshots_step ON execution_snapshots(execution_id, step_number);
CREATE INDEX idx_snapshots_recent ON execution_snapshots(created_at DESC);
CREATE INDEX idx_snapshots_parent ON execution_snapshots(parent_snapshot_id) 
  WHERE parent_snapshot_id IS NOT NULL;

CREATE INDEX idx_replay_tenant ON replay_sessions(tenant_id);
CREATE INDEX idx_replay_user ON replay_sessions(user_id);
CREATE INDEX idx_replay_status ON replay_sessions(status);
CREATE INDEX idx_replay_original ON replay_sessions(original_execution_id);

CREATE INDEX idx_diffs_replay ON execution_diffs(replay_session_id);
CREATE INDEX idx_diffs_significant ON execution_diffs(replay_session_id, is_significant) 
  WHERE is_significant;

CREATE INDEX idx_bookmarks_tenant ON execution_bookmarks(tenant_id);
CREATE INDEX idx_bookmarks_user ON execution_bookmarks(user_id);
CREATE INDEX idx_bookmarks_snapshot ON execution_bookmarks(snapshot_id);

CREATE INDEX idx_annotations_snapshot ON execution_annotations(snapshot_id);
CREATE INDEX idx_annotations_user ON execution_annotations(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE execution_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE replay_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_diffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY snapshots_isolation ON execution_snapshots FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY replay_isolation ON replay_sessions FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY diffs_isolation ON execution_diffs FOR ALL USING (
  replay_session_id IN (
    SELECT id FROM replay_sessions 
    WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
  )
);

CREATE POLICY bookmarks_isolation ON execution_bookmarks FOR ALL USING (
  tenant_id = current_setting('app.current_tenant_id', true)::UUID
);

CREATE POLICY annotations_isolation ON execution_annotations FOR ALL USING (
  snapshot_id IN (
    SELECT id FROM execution_snapshots 
    WHERE tenant_id = current_setting('app.current_tenant_id', true)::UUID
  )
);

-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW v_execution_timeline AS
SELECT 
  s.execution_id,
  s.snapshot_type,
  s.tenant_id,
  COUNT(*) as total_steps,
  SUM(s.duration_ms) as total_duration_ms,
  SUM(s.cost_usd) as total_cost_usd,
  MIN(s.started_at) as execution_started,
  MAX(s.completed_at) as execution_completed,
  COUNT(CASE WHEN s.error_code IS NOT NULL THEN 1 END) as error_count,
  (SELECT COUNT(*) FROM execution_bookmarks b WHERE b.snapshot_id = ANY(ARRAY_AGG(s.id))) as bookmark_count
FROM execution_snapshots s
GROUP BY s.execution_id, s.snapshot_type, s.tenant_id;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get full execution trace
CREATE OR REPLACE FUNCTION get_execution_trace(p_execution_id UUID)
RETURNS TABLE (
  step_number INTEGER,
  step_name VARCHAR(200),
  input_state JSONB,
  output_state JSONB,
  duration_ms INTEGER,
  cost_usd DECIMAL(10,6),
  error_code VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.step_number,
    s.step_name,
    s.input_state,
    s.output_state,
    s.duration_ms,
    s.cost_usd,
    s.error_code
  FROM execution_snapshots s
  WHERE s.execution_id = p_execution_id
  ORDER BY s.step_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE execution_snapshots IS 'Complete state capture at each execution step for replay';
COMMENT ON TABLE replay_sessions IS 'Replay/what-if analysis sessions';
COMMENT ON TABLE execution_diffs IS 'Step-by-step comparison between original and replay';
COMMENT ON TABLE execution_bookmarks IS 'User-saved points for quick replay access';
COMMENT ON TABLE execution_annotations IS 'User notes and insights on execution steps';
