-- Migration: Workflow UEP Integration
-- Adds tables for UEP-aware workflow execution with condition evaluation
-- RADIANT v5.52.58

-- ============================================================================
-- Workflow Condition Evaluations - Audit trail for condition logic
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_condition_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL,
  workflow_execution_id VARCHAR(100) NOT NULL,
  node_id VARCHAR(100) NOT NULL,
  condition_id VARCHAR(100) NOT NULL,
  condition_name VARCHAR(255) NOT NULL,
  condition_type VARCHAR(50) NOT NULL, -- 'expression', 'ai_interpreted', 'composite'
  stream_mode VARCHAR(50) NOT NULL DEFAULT 'any', -- 'all', 'any', 'majority', 'quorum', 'best', 'weighted'
  passed BOOLEAN NOT NULL,
  confidence NUMERIC(5,4) NOT NULL,
  stream_results JSONB, -- Per-stream evaluation results
  ai_interpretation JSONB, -- AI reasoning if ai_interpreted
  evaluation_duration_ms INTEGER NOT NULL,
  evaluation_cost_cents NUMERIC(10,4),
  envelope_id UUID, -- Link to UEP envelope
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_condition_eval_tenant ON workflow_condition_evaluations(tenant_id);
CREATE INDEX idx_condition_eval_execution ON workflow_condition_evaluations(workflow_execution_id);
CREATE INDEX idx_condition_eval_node ON workflow_condition_evaluations(node_id);
CREATE INDEX idx_condition_eval_envelope ON workflow_condition_evaluations(envelope_id);
CREATE INDEX idx_condition_eval_created ON workflow_condition_evaluations(created_at DESC);

COMMENT ON TABLE workflow_condition_evaluations IS 'Audit trail for workflow condition evaluations with UEP integration';
COMMENT ON COLUMN workflow_condition_evaluations.stream_mode IS 'How multiple stream outputs are evaluated: all, any, majority, quorum, best, weighted';
COMMENT ON COLUMN workflow_condition_evaluations.stream_results IS 'Per-stream pass/fail results for parallel model outputs';
COMMENT ON COLUMN workflow_condition_evaluations.ai_interpretation IS 'AI reasoning when condition uses ai_interpreted type';

-- ============================================================================
-- Workflow Node Conditions - Stored condition definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_node_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL,
  workflow_id VARCHAR(100) NOT NULL,
  node_id VARCHAR(100) NOT NULL,
  condition_id VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  condition_type VARCHAR(50) NOT NULL, -- 'expression', 'ai_interpreted', 'composite'
  
  -- Expression conditions
  expression TEXT, -- JavaScript-like expression
  
  -- AI-interpreted conditions
  ai_prompt TEXT,
  ai_model VARCHAR(100),
  ai_threshold NUMERIC(3,2) DEFAULT 0.7,
  
  -- Composite conditions
  operator VARCHAR(10), -- 'AND', 'OR', 'NOT', 'XOR'
  sub_condition_ids UUID[], -- References to other conditions
  
  -- Stream evaluation
  stream_mode VARCHAR(50) NOT NULL DEFAULT 'any',
  stream_config JSONB, -- StreamEvaluationConfig
  
  -- Actions
  on_true_action JSONB, -- ConditionAction
  on_false_action JSONB, -- ConditionAction
  
  -- Envelope transformation
  envelope_transform JSONB,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_node_conditions_tenant ON workflow_node_conditions(tenant_id);
CREATE INDEX idx_node_conditions_workflow ON workflow_node_conditions(workflow_id);
CREATE INDEX idx_node_conditions_node ON workflow_node_conditions(node_id);
CREATE INDEX idx_node_conditions_active ON workflow_node_conditions(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE workflow_node_conditions IS 'Stored condition definitions for workflow nodes - MODEL-AGNOSTIC by design';
COMMENT ON COLUMN workflow_node_conditions.expression IS 'JavaScript-like expression evaluated against output content, NOT model identity';
COMMENT ON COLUMN workflow_node_conditions.ai_prompt IS 'Natural language question for AI interpretation of content quality';
COMMENT ON COLUMN workflow_node_conditions.stream_mode IS 'How to evaluate across parallel model outputs: all, any, majority, quorum, best, weighted';

-- ============================================================================
-- Workflow UEP Envelopes - Links workflow nodes to UEP storage
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_uep_envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL,
  workflow_execution_id VARCHAR(100) NOT NULL,
  node_id VARCHAR(100) NOT NULL,
  node_name VARCHAR(255),
  node_type VARCHAR(50) NOT NULL,
  step_order INTEGER NOT NULL,
  
  -- UEP envelope reference
  envelope_id UUID NOT NULL,
  envelope_type VARCHAR(100) NOT NULL, -- 'workflow.node.input', 'workflow.node.output'
  
  -- Tracing
  trace_id VARCHAR(100) NOT NULL,
  span_id VARCHAR(100) NOT NULL,
  parent_span_id VARCHAR(100),
  workflow_span_id VARCHAR(100) NOT NULL,
  
  -- Relationships
  from_node_id VARCHAR(100), -- Previous node
  from_envelope_id UUID, -- Link to source envelope
  
  -- Aggregated metrics
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_cents NUMERIC(10,4),
  latency_ms INTEGER,
  
  -- Stream info
  stream_count INTEGER DEFAULT 1,
  models_used TEXT[],
  
  -- Compliance
  compliance_frameworks TEXT[],
  audit_required BOOLEAN DEFAULT FALSE,
  
  -- Risk signals
  overall_risk VARCHAR(20),
  risk_flags TEXT[],
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_uep_tenant ON workflow_uep_envelopes(tenant_id);
CREATE INDEX idx_workflow_uep_execution ON workflow_uep_envelopes(workflow_execution_id);
CREATE INDEX idx_workflow_uep_node ON workflow_uep_envelopes(node_id);
CREATE INDEX idx_workflow_uep_envelope ON workflow_uep_envelopes(envelope_id);
CREATE INDEX idx_workflow_uep_trace ON workflow_uep_envelopes(trace_id);
CREATE INDEX idx_workflow_uep_created ON workflow_uep_envelopes(created_at DESC);

COMMENT ON TABLE workflow_uep_envelopes IS 'Links workflow nodes to UEP envelopes in UDS tiered storage';
COMMENT ON COLUMN workflow_uep_envelopes.models_used IS 'Models used in this node (captured but NOT used for conditions)';

-- ============================================================================
-- Workflow Stream Outputs - Parallel model outputs for condition evaluation
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_stream_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(100) NOT NULL,
  workflow_execution_id VARCHAR(100) NOT NULL,
  node_id VARCHAR(100) NOT NULL,
  envelope_id UUID NOT NULL,
  stream_id VARCHAR(100) NOT NULL,
  
  -- Content reference (actual content in UDS)
  content_preview TEXT, -- First 500 chars for quick access
  content_s3_key VARCHAR(500), -- Full content if large
  
  -- Metrics
  confidence NUMERIC(5,4),
  latency_ms INTEGER,
  tokens_used INTEGER,
  
  -- Model info (captured but conditions are MODEL-AGNOSTIC)
  model_id VARCHAR(100),
  model_mode VARCHAR(50),
  
  -- Condition results for this stream
  condition_passed BOOLEAN,
  condition_confidence NUMERIC(5,4),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stream_outputs_tenant ON workflow_stream_outputs(tenant_id);
CREATE INDEX idx_stream_outputs_execution ON workflow_stream_outputs(workflow_execution_id);
CREATE INDEX idx_stream_outputs_envelope ON workflow_stream_outputs(envelope_id);
CREATE INDEX idx_stream_outputs_stream ON workflow_stream_outputs(stream_id);

COMMENT ON TABLE workflow_stream_outputs IS 'Parallel model outputs for stream-based condition evaluation';
COMMENT ON COLUMN workflow_stream_outputs.model_id IS 'Model that produced this output - captured for tracing but NOT used in conditions';

-- ============================================================================
-- Add UEP columns to existing workflow tables
-- ============================================================================

-- Add to workflow_executions
ALTER TABLE workflow_executions 
  ADD COLUMN IF NOT EXISTS root_envelope_id UUID,
  ADD COLUMN IF NOT EXISTS trace_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS workflow_span_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS compliance_frameworks TEXT[],
  ADD COLUMN IF NOT EXISTS total_uep_envelopes INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_workflow_exec_trace 
  ON workflow_executions(trace_id) WHERE trace_id IS NOT NULL;

COMMENT ON COLUMN workflow_executions.root_envelope_id IS 'Root UEP envelope for entire workflow execution';
COMMENT ON COLUMN workflow_executions.trace_id IS 'Distributed tracing ID for the workflow';

-- Add to task_executions
ALTER TABLE task_executions 
  ADD COLUMN IF NOT EXISTS input_envelope_id UUID,
  ADD COLUMN IF NOT EXISTS output_envelope_id UUID,
  ADD COLUMN IF NOT EXISTS span_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS condition_results JSONB;

CREATE INDEX IF NOT EXISTS idx_task_exec_input_envelope 
  ON task_executions(input_envelope_id) WHERE input_envelope_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_exec_output_envelope 
  ON task_executions(output_envelope_id) WHERE output_envelope_id IS NOT NULL;

COMMENT ON COLUMN task_executions.condition_results IS 'Results of condition evaluations at this task node';

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE workflow_condition_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_node_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_uep_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stream_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY condition_evaluations_tenant_isolation ON workflow_condition_evaluations
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY node_conditions_tenant_isolation ON workflow_node_conditions
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY uep_envelopes_tenant_isolation ON workflow_uep_envelopes
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY stream_outputs_tenant_isolation ON workflow_stream_outputs
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- Views for analytics
-- ============================================================================

-- Condition evaluation statistics
CREATE OR REPLACE VIEW v_condition_evaluation_stats AS
SELECT 
  tenant_id,
  condition_type,
  stream_mode,
  COUNT(*) as total_evaluations,
  SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count,
  AVG(confidence) as avg_confidence,
  AVG(evaluation_duration_ms) as avg_duration_ms,
  SUM(COALESCE(evaluation_cost_cents, 0)) as total_cost_cents,
  DATE_TRUNC('day', created_at) as evaluation_date
FROM workflow_condition_evaluations
GROUP BY tenant_id, condition_type, stream_mode, DATE_TRUNC('day', created_at);

COMMENT ON VIEW v_condition_evaluation_stats IS 'Aggregated statistics for workflow condition evaluations';

-- Workflow UEP tracing view
CREATE OR REPLACE VIEW v_workflow_uep_trace AS
SELECT 
  e.workflow_execution_id,
  e.trace_id,
  e.workflow_span_id,
  e.node_id,
  e.node_name,
  e.node_type,
  e.step_order,
  e.envelope_id,
  e.envelope_type,
  e.from_node_id,
  e.from_envelope_id,
  e.input_tokens,
  e.output_tokens,
  e.cost_cents,
  e.latency_ms,
  e.stream_count,
  e.models_used,
  e.overall_risk,
  e.risk_flags,
  c.condition_id,
  c.condition_name,
  c.passed as condition_passed,
  c.confidence as condition_confidence,
  c.stream_mode,
  e.created_at
FROM workflow_uep_envelopes e
LEFT JOIN workflow_condition_evaluations c ON e.envelope_id = c.envelope_id
ORDER BY e.workflow_execution_id, e.step_order;

COMMENT ON VIEW v_workflow_uep_trace IS 'Complete UEP trace for workflow executions with condition results';

-- ============================================================================
-- Summary
-- ============================================================================
-- Tables created:
-- 1. workflow_condition_evaluations - Audit trail for condition logic
-- 2. workflow_node_conditions - Stored condition definitions (MODEL-AGNOSTIC)
-- 3. workflow_uep_envelopes - Links workflow nodes to UEP storage
-- 4. workflow_stream_outputs - Parallel model outputs for stream evaluation
--
-- Columns added to existing tables:
-- - workflow_executions: root_envelope_id, trace_id, workflow_span_id, compliance_frameworks
-- - task_executions: input_envelope_id, output_envelope_id, span_id, condition_results
--
-- Key design: CONDITIONS ARE MODEL-AGNOSTIC
-- - Conditions evaluate OUTPUT CONTENT, not model identity
-- - Users can swap models without breaking workflow logic
-- - Model info captured for tracing/debugging only
