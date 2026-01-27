-- ============================================================================
-- RADIANT v5.52.40 - Model Task Quality Scores
-- Database-backed quality scores for model-task combinations
-- Replaces hardcoded TASK_QUALITY_SCORES in cognitive-router.service.ts
-- ============================================================================

-- Model Task Quality Scores Table
CREATE TABLE IF NOT EXISTS model_task_quality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  model_id VARCHAR(255) NOT NULL,
  task_type VARCHAR(100) NOT NULL,
  quality_score NUMERIC(4,3) NOT NULL CHECK (quality_score >= 0 AND quality_score <= 1),
  source VARCHAR(50) NOT NULL DEFAULT 'manual', -- 'manual', 'evaluated', 'learned'
  evaluation_count INTEGER DEFAULT 0,
  last_evaluated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_tenant_model_task UNIQUE (tenant_id, model_id, task_type)
);

-- Global default scores (tenant_id = NULL means system-wide defaults)
CREATE INDEX idx_model_task_quality_global ON model_task_quality_scores(model_id, task_type) WHERE tenant_id IS NULL;
CREATE INDEX idx_model_task_quality_tenant ON model_task_quality_scores(tenant_id, model_id, task_type);

-- Enable RLS
ALTER TABLE model_task_quality_scores ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY model_task_quality_tenant_isolation ON model_task_quality_scores
  FOR ALL USING (
    tenant_id IS NULL OR 
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- Seed with default quality scores (from hardcoded values)
INSERT INTO model_task_quality_scores (tenant_id, model_id, task_type, quality_score, source, notes) VALUES
  -- Code tasks
  (NULL, 'claude-3-5-sonnet-20241022', 'code', 0.95, 'manual', 'Default from TASK_QUALITY_SCORES'),
  (NULL, 'gpt-4o', 'code', 0.90, 'manual', 'Default from TASK_QUALITY_SCORES'),
  (NULL, 'deepseek-chat', 'code', 0.88, 'manual', 'Default from TASK_QUALITY_SCORES'),
  (NULL, 'grok-2', 'code', 0.85, 'manual', 'Default from TASK_QUALITY_SCORES'),
  
  -- Creative tasks
  (NULL, 'claude-3-opus-20240229', 'creative', 0.95, 'manual', 'Default from TASK_QUALITY_SCORES'),
  (NULL, 'gpt-4o', 'creative', 0.88, 'manual', 'Default from TASK_QUALITY_SCORES'),
  (NULL, 'gemini-1.5-pro', 'creative', 0.85, 'manual', 'Default from TASK_QUALITY_SCORES'),
  
  -- Analysis tasks
  (NULL, 'claude-3-opus-20240229', 'analysis', 0.95, 'manual', 'Default from TASK_QUALITY_SCORES'),
  (NULL, 'o1', 'analysis', 0.95, 'manual', 'Default from TASK_QUALITY_SCORES'),
  (NULL, 'gemini-1.5-pro', 'analysis', 0.88, 'manual', 'Default from TASK_QUALITY_SCORES'),
  
  -- Vision tasks
  (NULL, 'gpt-4o', 'vision', 0.95, 'manual', 'Default from TASK_QUALITY_SCORES'),
  (NULL, 'claude-3-5-sonnet-20241022', 'vision', 0.92, 'manual', 'Default from TASK_QUALITY_SCORES'),
  (NULL, 'gemini-1.5-pro', 'vision', 0.90, 'manual', 'Default from TASK_QUALITY_SCORES'),
  
  -- Chat tasks
  (NULL, 'gpt-4o', 'chat', 0.90, 'manual', 'Default from TASK_QUALITY_SCORES'),
  (NULL, 'claude-3-5-sonnet-20241022', 'chat', 0.90, 'manual', 'Default from TASK_QUALITY_SCORES'),
  (NULL, 'gemini-1.5-pro', 'chat', 0.88, 'manual', 'Default from TASK_QUALITY_SCORES'),
  
  -- Audio tasks
  (NULL, 'gpt-4o-audio-preview', 'audio', 0.90, 'manual', 'Default from TASK_QUALITY_SCORES')
ON CONFLICT (tenant_id, model_id, task_type) DO NOTHING;

-- Function to get quality score with tenant override
CREATE OR REPLACE FUNCTION get_model_task_quality_score(
  p_tenant_id UUID,
  p_model_id VARCHAR,
  p_task_type VARCHAR
) RETURNS NUMERIC AS $$
DECLARE
  v_score NUMERIC;
BEGIN
  -- First try tenant-specific score
  SELECT quality_score INTO v_score
  FROM model_task_quality_scores
  WHERE tenant_id = p_tenant_id AND model_id = p_model_id AND task_type = p_task_type;
  
  IF v_score IS NOT NULL THEN
    RETURN v_score;
  END IF;
  
  -- Fall back to global default
  SELECT quality_score INTO v_score
  FROM model_task_quality_scores
  WHERE tenant_id IS NULL AND model_id = p_model_id AND task_type = p_task_type;
  
  RETURN COALESCE(v_score, 0.7);
END;
$$ LANGUAGE plpgsql;

-- Violation Audit Log Table (for user-violation.service.ts)
CREATE TABLE IF NOT EXISTS violation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  violation_id UUID,
  actor_id VARCHAR(255) NOT NULL,
  actor_type VARCHAR(50) NOT NULL CHECK (actor_type IN ('system', 'admin', 'user')),
  action VARCHAR(100) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_violation_audit_tenant ON violation_audit_log(tenant_id);
CREATE INDEX idx_violation_audit_violation ON violation_audit_log(violation_id);
CREATE INDEX idx_violation_audit_created ON violation_audit_log(created_at);

-- Enable RLS
ALTER TABLE violation_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY violation_audit_tenant_isolation ON violation_audit_log
  FOR ALL USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- Grant permissions
GRANT SELECT, INSERT ON model_task_quality_scores TO radiant_app;
GRANT SELECT, INSERT ON violation_audit_log TO radiant_app;
