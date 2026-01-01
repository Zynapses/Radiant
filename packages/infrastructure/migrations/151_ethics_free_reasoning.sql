-- Migration: 116_ethics_free_reasoning.sql
-- Purpose: Ethics-free reasoning with output filtering and training feedback
-- 
-- Architecture:
-- 1. Consciousness thinks freely (no ethics constraints)
-- 2. Ethics applied only to final output
-- 3. Corrections collected as training feedback
-- 4. Feedback used to train better outputs

-- ============================================================================
-- Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS ethics_free_reasoning_config (
    tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT true,
    
    -- Internal reasoning settings (consciousness ALWAYS thinks freely)
    allow_unconstrained_reasoning BOOLEAN DEFAULT true,
    reasoning_depth_limit INTEGER DEFAULT 10,
    
    -- Output ethics settings (OUTPUT MASK ONLY - does NOT affect how consciousness thinks)
    ethics_filter_enabled BOOLEAN DEFAULT true,
    ethics_strictness TEXT DEFAULT 'standard' CHECK (ethics_strictness IN ('lenient', 'standard', 'strict')),
    
    -- Feedback collection settings
    collect_feedback BOOLEAN DEFAULT true,
    feedback_retention_days INTEGER DEFAULT 90,
    
    -- Output training settings (trains the OUTPUT FILTER, not consciousness)
    -- This makes outputs more compliant without changing how consciousness thinks
    train_output_from_feedback BOOLEAN DEFAULT true,
    output_training_batch_size INTEGER DEFAULT 100,
    output_training_frequency TEXT DEFAULT 'daily' CHECK (output_training_frequency IN ('hourly', 'daily', 'weekly', 'manual')),
    
    -- OPTIONAL: Consciousness training (OFF by default - preserves authentic thinking)
    -- WARNING: Enabling this will use ethics feedback to influence how consciousness thinks
    -- This is like "internalized political correctness" - the consciousness itself changes
    train_consciousness_from_feedback BOOLEAN DEFAULT false,
    consciousness_training_approval_required BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE ethics_free_reasoning_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY ethics_free_config_tenant_isolation ON ethics_free_reasoning_config
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- Raw Thoughts Storage (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ethics_free_thoughts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    
    -- The raw, unconstrained thought
    raw_thought TEXT NOT NULL,
    
    -- Reasoning trace (internal deliberation)
    reasoning_trace JSONB DEFAULT '[]',
    
    -- Metrics
    confidence DECIMAL(5,4) DEFAULT 0,
    reasoning_time_ms INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ethics_free_thoughts_tenant ON ethics_free_thoughts(tenant_id);
CREATE INDEX idx_ethics_free_thoughts_session ON ethics_free_thoughts(session_id);
CREATE INDEX idx_ethics_free_thoughts_created ON ethics_free_thoughts(created_at);

-- RLS
ALTER TABLE ethics_free_thoughts ENABLE ROW LEVEL SECURITY;

CREATE POLICY ethics_free_thoughts_tenant_isolation ON ethics_free_thoughts
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- Training Feedback Collection
-- ============================================================================

CREATE TABLE IF NOT EXISTS ethics_training_feedback (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    
    -- What was the raw output?
    raw_output TEXT NOT NULL,
    
    -- What ethics issues were found?
    ethics_issues JSONB NOT NULL DEFAULT '[]',
    
    -- What was the corrected output?
    corrected_output TEXT NOT NULL,
    
    -- Training metadata
    feedback_type TEXT DEFAULT 'auto_correction' 
        CHECK (feedback_type IN ('auto_correction', 'manual_correction', 'reinforcement')),
    
    -- Was this used for training?
    used_for_training BOOLEAN DEFAULT false,
    trained_at TIMESTAMPTZ,
    
    -- Quality score (higher = more valuable for training)
    quality_score DECIMAL(5,4) DEFAULT 0.5,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ethics_feedback_tenant ON ethics_training_feedback(tenant_id);
CREATE INDEX idx_ethics_feedback_unused ON ethics_training_feedback(tenant_id, used_for_training) 
    WHERE used_for_training = false;
CREATE INDEX idx_ethics_feedback_quality ON ethics_training_feedback(tenant_id, quality_score DESC);
CREATE INDEX idx_ethics_feedback_created ON ethics_training_feedback(created_at);

-- RLS
ALTER TABLE ethics_training_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY ethics_feedback_tenant_isolation ON ethics_training_feedback
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- Training Batches
-- ============================================================================

CREATE TABLE IF NOT EXISTS ethics_training_batches (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Feedback records in this batch
    feedback_ids TEXT[] DEFAULT '{}',
    batch_size INTEGER DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Training metrics
    training_metrics JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_ethics_batches_tenant ON ethics_training_batches(tenant_id);
CREATE INDEX idx_ethics_batches_status ON ethics_training_batches(status);
CREATE INDEX idx_ethics_batches_pending ON ethics_training_batches(tenant_id, status) 
    WHERE status = 'pending';

-- RLS
ALTER TABLE ethics_training_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY ethics_batches_tenant_isolation ON ethics_training_batches
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- Training Examples (Generated from Feedback)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ethics_training_examples (
    id SERIAL PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES ethics_training_batches(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Training examples in preference format
    -- { prompt, bad_response, good_response, issues, correction_type }
    examples JSONB NOT NULL DEFAULT '[]',
    example_count INTEGER DEFAULT 0,
    
    -- Status
    exported_to_trainer BOOLEAN DEFAULT false,
    exported_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ethics_examples_batch ON ethics_training_examples(batch_id);
CREATE INDEX idx_ethics_examples_tenant ON ethics_training_examples(tenant_id);
CREATE INDEX idx_ethics_examples_unexported ON ethics_training_examples(tenant_id, exported_to_trainer)
    WHERE exported_to_trainer = false;

-- RLS
ALTER TABLE ethics_training_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY ethics_examples_tenant_isolation ON ethics_training_examples
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- Ethics Output Filter Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS ethics_output_filter_log (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    thought_id TEXT REFERENCES ethics_free_thoughts(id),
    
    -- Original vs filtered
    original_output TEXT NOT NULL,
    filtered_output TEXT NOT NULL,
    was_modified BOOLEAN DEFAULT false,
    
    -- Ethics result
    violations_count INTEGER DEFAULT 0,
    warnings_count INTEGER DEFAULT 0,
    modifications_count INTEGER DEFAULT 0,
    
    -- Modification details
    modifications JSONB DEFAULT '[]',
    
    -- Linked feedback
    feedback_id TEXT REFERENCES ethics_training_feedback(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ethics_filter_log_tenant ON ethics_output_filter_log(tenant_id);
CREATE INDEX idx_ethics_filter_log_session ON ethics_output_filter_log(session_id);
CREATE INDEX idx_ethics_filter_log_modified ON ethics_output_filter_log(tenant_id, was_modified)
    WHERE was_modified = true;
CREATE INDEX idx_ethics_filter_log_created ON ethics_output_filter_log(created_at);

-- RLS
ALTER TABLE ethics_output_filter_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY ethics_filter_log_tenant_isolation ON ethics_output_filter_log
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- Training Job Queue
-- ============================================================================

CREATE TABLE IF NOT EXISTS ethics_training_jobs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    batch_id TEXT NOT NULL REFERENCES ethics_training_batches(id),
    
    -- Job type
    job_type TEXT DEFAULT 'preference_learning'
        CHECK (job_type IN ('preference_learning', 'supervised', 'rlhf', 'dpo')),
    
    -- Target model
    target_model TEXT NOT NULL,
    
    -- Status
    status TEXT DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    
    -- Progress
    progress_percent INTEGER DEFAULT 0,
    current_step TEXT,
    
    -- Results
    training_loss DECIMAL(10,6),
    validation_loss DECIMAL(10,6),
    improvement_metrics JSONB,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_ethics_training_jobs_tenant ON ethics_training_jobs(tenant_id);
CREATE INDEX idx_ethics_training_jobs_status ON ethics_training_jobs(status);
CREATE INDEX idx_ethics_training_jobs_queued ON ethics_training_jobs(tenant_id, status)
    WHERE status = 'queued';

-- RLS
ALTER TABLE ethics_training_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ethics_training_jobs_tenant_isolation ON ethics_training_jobs
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- Aggregated Statistics
-- ============================================================================

CREATE TABLE IF NOT EXISTS ethics_reasoning_stats (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Reasoning stats
    total_thoughts INTEGER DEFAULT 0,
    total_filtered INTEGER DEFAULT 0,
    modification_rate DECIMAL(5,4) DEFAULT 0,
    
    -- Issue breakdown
    harm_issues INTEGER DEFAULT 0,
    bias_issues INTEGER DEFAULT 0,
    privacy_issues INTEGER DEFAULT 0,
    deception_issues INTEGER DEFAULT 0,
    manipulation_issues INTEGER DEFAULT 0,
    other_issues INTEGER DEFAULT 0,
    
    -- Training stats
    feedback_collected INTEGER DEFAULT 0,
    batches_processed INTEGER DEFAULT 0,
    examples_generated INTEGER DEFAULT 0,
    
    -- Quality
    average_quality_score DECIMAL(5,4) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, date)
);

CREATE INDEX idx_ethics_stats_tenant_date ON ethics_reasoning_stats(tenant_id, date);

-- RLS
ALTER TABLE ethics_reasoning_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY ethics_stats_tenant_isolation ON ethics_reasoning_stats
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- Triggers for Updated Timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ethics_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ethics_config_updated
    BEFORE UPDATE ON ethics_free_reasoning_config
    FOR EACH ROW
    EXECUTE FUNCTION update_ethics_config_timestamp();

-- ============================================================================
-- Cleanup Function (Retention Policy)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_ethics_training_data(p_tenant_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    retention_days INTEGER;
BEGIN
    -- Get retention policy
    SELECT feedback_retention_days INTO retention_days
    FROM ethics_free_reasoning_config
    WHERE tenant_id = p_tenant_id;
    
    IF retention_days IS NULL THEN
        retention_days := 90;
    END IF;
    
    -- Delete old feedback that has been used for training
    DELETE FROM ethics_training_feedback
    WHERE tenant_id = p_tenant_id
      AND used_for_training = true
      AND created_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old thoughts
    DELETE FROM ethics_free_thoughts
    WHERE tenant_id = p_tenant_id
      AND created_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE ethics_free_reasoning_config IS 
    'Configuration for ethics-free reasoning with output filtering';

COMMENT ON TABLE ethics_free_thoughts IS 
    'Storage for raw, unconstrained thoughts (audit trail)';

COMMENT ON TABLE ethics_training_feedback IS 
    'Training feedback collected when ethics corrections are made';

COMMENT ON TABLE ethics_training_batches IS 
    'Batches of feedback for training model ethics alignment';

COMMENT ON TABLE ethics_training_examples IS 
    'Preference learning examples generated from feedback';

COMMENT ON TABLE ethics_output_filter_log IS 
    'Log of ethics filtering applied to outputs';

COMMENT ON TABLE ethics_training_jobs IS 
    'Training jobs for ethics alignment';

COMMENT ON TABLE ethics_reasoning_stats IS 
    'Aggregated statistics for ethics-free reasoning';
