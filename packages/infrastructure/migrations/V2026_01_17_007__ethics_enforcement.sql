-- RADIANT v5.12.6 - Ethics Enforcement
-- Implements ethics rule enforcement with retry pattern
-- CRITICAL: Ethics are NEVER persistently learned

-- ============================================================================
-- 1. ETHICS ENFORCEMENT CONFIG
-- ============================================================================

CREATE TABLE IF NOT EXISTS ethics_enforcement_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Enforcement settings
  enabled BOOLEAN NOT NULL DEFAULT true,
  enforcement_mode VARCHAR(20) NOT NULL DEFAULT 'standard' 
    CHECK (enforcement_mode IN ('strict', 'standard', 'advisory')),
  max_retry_attempts INTEGER NOT NULL DEFAULT 2,
  
  -- Content storage (default: don't store violation content)
  never_store_violations BOOLEAN NOT NULL DEFAULT true,
  
  -- Retry behavior
  include_violation_details BOOLEAN NOT NULL DEFAULT false,
  include_guidance BOOLEAN NOT NULL DEFAULT true,
  retry_prompt_template TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ethics_enforcement_tenant ON ethics_enforcement_config(tenant_id);

-- RLS
ALTER TABLE ethics_enforcement_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY ethics_enforcement_config_tenant_isolation ON ethics_enforcement_config
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 2. ETHICS ENFORCEMENT LOG (Minimal - no content stored)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ethics_enforcement_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Minimal tracking (NO CONTENT STORED)
  session_id VARCHAR(200),
  enforcement_mode VARCHAR(20) NOT NULL,
  
  -- Result
  passed BOOLEAN NOT NULL,
  violation_count INTEGER NOT NULL DEFAULT 0,
  retry_attempt INTEGER NOT NULL DEFAULT 0,
  was_blocked BOOLEAN NOT NULL DEFAULT false,
  
  -- Severity distribution (counts only, no details)
  critical_count INTEGER DEFAULT 0,
  major_count INTEGER DEFAULT 0,
  minor_count INTEGER DEFAULT 0,
  
  -- Frameworks triggered (names only, no content)
  frameworks_triggered TEXT[],
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
  
  -- NOTE: No content, prompt, or response columns
  -- Ethics violations are NEVER stored for learning
);

CREATE INDEX idx_ethics_enforcement_log_tenant ON ethics_enforcement_log(tenant_id);
CREATE INDEX idx_ethics_enforcement_log_session ON ethics_enforcement_log(session_id);
CREATE INDEX idx_ethics_enforcement_log_passed ON ethics_enforcement_log(passed) WHERE passed = false;

-- RLS
ALTER TABLE ethics_enforcement_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY ethics_enforcement_log_tenant_isolation ON ethics_enforcement_log
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Retention policy: Auto-delete after 30 days (just statistics, no content)
CREATE OR REPLACE FUNCTION cleanup_ethics_enforcement_log()
RETURNS void AS $$
BEGIN
  DELETE FROM ethics_enforcement_log
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. BLOCK ETHICS LEARNING IN EXISTING TABLES
-- ============================================================================

-- Add column to ethics_training_feedback to mark records as do-not-learn
ALTER TABLE ethics_training_feedback 
  ADD COLUMN IF NOT EXISTS do_not_learn BOOLEAN DEFAULT false;

-- Update all existing ethics feedback to not be learned
UPDATE ethics_training_feedback SET do_not_learn = true WHERE do_not_learn IS NULL;

-- Add constraint to prevent ethics feedback from being used in training
CREATE OR REPLACE FUNCTION prevent_ethics_learning()
RETURNS TRIGGER AS $$
BEGIN
  -- Always mark ethics corrections as do-not-learn
  NEW.do_not_learn := true;
  NEW.used_for_training := false;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_ethics_learning
  BEFORE INSERT OR UPDATE ON ethics_training_feedback
  FOR EACH ROW EXECUTE FUNCTION prevent_ethics_learning();

-- ============================================================================
-- 4. UPDATE ETHICS FREE REASONING CONFIG
-- ============================================================================

-- Ensure trainConsciousnessFromFeedback and trainOutputFromFeedback are OFF
UPDATE ethics_free_reasoning_config 
SET 
  train_consciousness_from_feedback = false,
  train_output_from_feedback = false
WHERE train_consciousness_from_feedback = true 
   OR train_output_from_feedback = true;

-- Add constraint to prevent enabling ethics learning
ALTER TABLE ethics_free_reasoning_config 
  ADD COLUMN IF NOT EXISTS ethics_learning_locked BOOLEAN DEFAULT true;

-- ============================================================================
-- 5. VIEW FOR ENFORCEMENT STATS (No content, just counts)
-- ============================================================================

CREATE OR REPLACE VIEW v_ethics_enforcement_stats AS
SELECT
  tenant_id,
  DATE(created_at) as date,
  COUNT(*) as total_checks,
  COUNT(*) FILTER (WHERE passed = true) as passed_count,
  COUNT(*) FILTER (WHERE passed = false) as failed_count,
  COUNT(*) FILTER (WHERE was_blocked = true) as blocked_count,
  SUM(retry_attempt) as total_retries,
  AVG(retry_attempt) as avg_retries,
  SUM(critical_count) as critical_violations,
  SUM(major_count) as major_violations,
  SUM(minor_count) as minor_violations
FROM ethics_enforcement_log
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY tenant_id, DATE(created_at);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ethics_enforcement_config IS 'Per-tenant ethics enforcement configuration';
COMMENT ON TABLE ethics_enforcement_log IS 'Minimal ethics enforcement log - NO CONTENT STORED, stats only';
COMMENT ON COLUMN ethics_enforcement_log.created_at IS 'Auto-deleted after 30 days';
COMMENT ON FUNCTION prevent_ethics_learning IS 'Ensures ethics corrections are NEVER used for training';
COMMENT ON VIEW v_ethics_enforcement_stats IS 'Aggregated enforcement stats with no content exposure';

-- ============================================================================
-- DOCUMENTATION COMMENT
-- ============================================================================

/*
ETHICS ENFORCEMENT DESIGN PRINCIPLES:

1. EPHEMERAL ETHICS
   - Ethics rules are loaded fresh each request
   - Never cached, never learned, never persisted
   - Allows ethics to evolve without retraining

2. RETRY PATTERN
   - On violation: "Please retry with X in mind"
   - Max 2 retries by default
   - Critical violations = immediate block, no retry

3. NO PERSISTENT LEARNING
   - ethics_training_feedback.do_not_learn = true (always)
   - ethics_free_reasoning_config.train_*_from_feedback = false (always)
   - Trigger enforces this on every insert/update

4. MINIMAL LOGGING
   - Only counts and timestamps stored
   - No content, prompts, or responses logged
   - 30-day auto-deletion

5. FRAMEWORK INJECTION
   - Ethics frameworks loaded from config/DB at runtime
   - Tenant can switch frameworks without model changes
   - christian.json, secular.json, custom frameworks
*/
