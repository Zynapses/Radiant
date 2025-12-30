-- Migration: 119_bobble_probe_training.sql
-- Probe Training Data Collection for Shadow Self verification

-- ============================================================================
-- Probe Training Examples
-- ============================================================================
CREATE TABLE IF NOT EXISTS bobble_probe_training_examples (
  example_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  claim_type VARCHAR(100) NOT NULL,
  context TEXT NOT NULL,
  claimed_state VARCHAR(255) NOT NULL,
  actual_outcome VARCHAR(50) NOT NULL CHECK (actual_outcome IN ('verified', 'refuted', 'uncertain')),
  confidence_score DECIMAL(5,4) NOT NULL,
  user_feedback VARCHAR(50) CHECK (user_feedback IN ('accurate', 'inaccurate', 'unsure')),
  verification_phases_passed INTEGER DEFAULT 0,
  grounding_score DECIMAL(5,4) DEFAULT 0,
  consistency_score DECIMAL(5,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bobble_probe_examples_tenant ON bobble_probe_training_examples(tenant_id);
CREATE INDEX idx_bobble_probe_examples_claim_type ON bobble_probe_training_examples(claim_type);
CREATE INDEX idx_bobble_probe_examples_outcome ON bobble_probe_training_examples(actual_outcome);
CREATE INDEX idx_bobble_probe_examples_created ON bobble_probe_training_examples(created_at DESC);

-- ============================================================================
-- Probe Training Events (audit log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bobble_probe_training_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  claim_type VARCHAR(100) NOT NULL,
  examples_used INTEGER NOT NULL,
  accuracy DECIMAL(5,4) NOT NULL,
  training_duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bobble_probe_events_tenant ON bobble_probe_training_events(tenant_id);
CREATE INDEX idx_bobble_probe_events_claim_type ON bobble_probe_training_events(claim_type);

-- ============================================================================
-- Learning Alert Config (extend for Slack webhook)
-- ============================================================================
ALTER TABLE learning_alert_config 
ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT;

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE bobble_probe_training_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE bobble_probe_training_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY bobble_probe_examples_tenant_isolation ON bobble_probe_training_examples
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY bobble_probe_events_tenant_isolation ON bobble_probe_training_events
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- Cleanup function
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_bobble_probe_examples(expiry_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM bobble_probe_training_examples
  WHERE created_at < NOW() - (expiry_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE bobble_probe_training_examples IS 'Training examples for Shadow Self probing classifiers';
COMMENT ON TABLE bobble_probe_training_events IS 'Audit log of probe training events';
COMMENT ON COLUMN bobble_probe_training_examples.actual_outcome IS 'Verification result: verified, refuted, or uncertain';
COMMENT ON COLUMN bobble_probe_training_examples.user_feedback IS 'Optional human feedback on accuracy';
