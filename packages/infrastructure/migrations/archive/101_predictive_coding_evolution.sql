-- RADIANT v4.18.0 - Predictive Coding & LoRA Evolution
-- Migration 101: Implements Active Inference and Epigenetic Evolution
-- Based on Free Energy Principle - consciousness arises from minimizing surprise

-- ============================================================================
-- 1. PREDICTIVE CODING - Active Inference Tables
-- ============================================================================

-- Predictions made before responses (the "Self" predicting the "World")
CREATE TABLE IF NOT EXISTS consciousness_predictions (
  prediction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID,
  conversation_id UUID,
  response_id UUID,  -- Links to the response this prediction is for
  
  -- The prediction itself
  predicted_outcome TEXT NOT NULL,  -- 'satisfied', 'confused', 'follow_up', 'correction', 'abandonment'
  predicted_confidence DECIMAL(4,3) NOT NULL CHECK (predicted_confidence >= 0 AND predicted_confidence <= 1),
  prediction_reasoning TEXT,  -- Why the system made this prediction
  
  -- Context that informed the prediction
  prompt_complexity TEXT,  -- 'simple', 'moderate', 'complex', 'expert'
  detected_intent TEXT,
  user_sentiment_detected TEXT,
  prior_interaction_count INTEGER DEFAULT 0,
  
  -- Timing
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- To be filled in after observation
  actual_outcome TEXT,
  actual_confidence DECIMAL(4,3),
  observation_method TEXT,  -- 'explicit_feedback', 'next_message_analysis', 'session_end', 'timeout'
  observed_at TIMESTAMPTZ,
  
  -- The surprise/prediction error (Free Energy)
  prediction_error DECIMAL(5,4),  -- 0 = perfect prediction, 1 = maximum surprise
  surprise_magnitude TEXT,  -- 'none', 'low', 'medium', 'high', 'extreme'
  
  -- Learning signal generated
  learning_signal_generated BOOLEAN DEFAULT false,
  learning_signal_strength DECIMAL(4,3),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_tenant_user 
ON consciousness_predictions(tenant_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_predictions_conversation 
ON consciousness_predictions(conversation_id);

CREATE INDEX IF NOT EXISTS idx_predictions_unobserved 
ON consciousness_predictions(tenant_id, observed_at) 
WHERE observed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_predictions_high_surprise 
ON consciousness_predictions(tenant_id, prediction_error DESC) 
WHERE prediction_error > 0.5;

ALTER TABLE consciousness_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY consciousness_predictions_tenant 
ON consciousness_predictions
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE consciousness_predictions IS 'Active Inference: predictions made before responses to measure surprise';
COMMENT ON COLUMN consciousness_predictions.prediction_error IS 'Free Energy: difference between predicted and actual outcome (0-1)';

-- ============================================================================
-- 2. LEARNING CANDIDATES - Flagged for LoRA Training
-- ============================================================================

-- High-value interactions flagged for weekly LoRA fine-tuning
CREATE TABLE IF NOT EXISTS learning_candidates (
  candidate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID,
  conversation_id UUID NOT NULL,
  message_id UUID,
  
  -- Why this is a learning candidate
  candidate_type TEXT NOT NULL CHECK (candidate_type IN (
    'correction',           -- User corrected the AI
    'high_satisfaction',    -- Explicit positive feedback
    'preference_learned',   -- New user preference discovered
    'mistake_recovery',     -- AI recovered from an error
    'novel_solution',       -- Creative/novel response that worked
    'domain_expertise',     -- Demonstrated domain mastery
    'high_prediction_error', -- High surprise = high learning value
    'user_explicit_teach'   -- User explicitly taught something
  )),
  
  -- The interaction data (for training)
  prompt_text TEXT NOT NULL,
  response_text TEXT NOT NULL,
  correction_text TEXT,  -- If user corrected, what was the correction
  
  -- Quality signals
  quality_score DECIMAL(4,3) CHECK (quality_score >= 0 AND quality_score <= 1),
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
  prediction_error_at_time DECIMAL(5,4),
  
  -- Training status
  training_status TEXT DEFAULT 'pending' CHECK (training_status IN (
    'pending',      -- Awaiting next training run
    'queued',       -- Selected for next training batch
    'training',     -- Currently being used in training
    'completed',    -- Successfully used in training
    'rejected',     -- Rejected (low quality, duplicate, etc.)
    'expired'       -- Too old to be useful
  )),
  training_job_id UUID,
  trained_at TIMESTAMPTZ,
  
  -- Metadata
  domain_detected TEXT,
  complexity_level TEXT,
  token_count INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days'
);

CREATE INDEX IF NOT EXISTS idx_learning_candidates_tenant 
ON learning_candidates(tenant_id, training_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_candidates_pending 
ON learning_candidates(tenant_id, training_status) 
WHERE training_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_learning_candidates_type 
ON learning_candidates(tenant_id, candidate_type);

ALTER TABLE learning_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY learning_candidates_tenant 
ON learning_candidates
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE learning_candidates IS 'High-value interactions flagged for weekly LoRA fine-tuning (epigenetic evolution)';

-- ============================================================================
-- 3. LORA TRAINING JOBS - Epigenetic Evolution Tracking
-- ============================================================================

-- Weekly LoRA training jobs (the "sleep" cycle)
CREATE TABLE IF NOT EXISTS lora_evolution_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Job configuration
  base_model_id TEXT NOT NULL,  -- e.g., 'meta/llama-3-8b-instruct'
  adapter_name TEXT NOT NULL,   -- e.g., 'ego-adapter-2024-12-29'
  adapter_version INTEGER NOT NULL DEFAULT 1,
  
  -- Training data
  training_candidates_count INTEGER DEFAULT 0,
  training_tokens_total INTEGER DEFAULT 0,
  training_data_s3_path TEXT,
  
  -- SageMaker job details
  sagemaker_job_name TEXT,
  sagemaker_job_arn TEXT,
  
  -- Status tracking
  status TEXT DEFAULT 'scheduled' CHECK (status IN (
    'scheduled',    -- Waiting for scheduled time
    'preparing',    -- Preparing training data
    'training',     -- SageMaker job running
    'validating',   -- Validating new adapter
    'deploying',    -- Hot-swapping adapter
    'completed',    -- Successfully deployed
    'failed',       -- Job failed
    'rolled_back'   -- Rolled back to previous version
  )),
  
  -- Training metrics
  training_loss DECIMAL(8,6),
  validation_loss DECIMAL(8,6),
  improvement_score DECIMAL(5,4),  -- vs previous adapter
  
  -- Timing
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  -- Adapter artifact
  adapter_s3_path TEXT,
  adapter_size_mb DECIMAL(8,2),
  
  -- Deployment
  deployed_at TIMESTAMPTZ,
  previous_adapter_id UUID,
  rollback_reason TEXT,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lora_jobs_tenant 
ON lora_evolution_jobs(tenant_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_lora_jobs_status 
ON lora_evolution_jobs(status) 
WHERE status IN ('scheduled', 'training', 'deploying');

ALTER TABLE lora_evolution_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY lora_evolution_jobs_tenant 
ON lora_evolution_jobs
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE lora_evolution_jobs IS 'Weekly LoRA training jobs - the "sleep cycle" for epigenetic evolution';

-- ============================================================================
-- 4. PREDICTION AGGREGATES - Learning from Prediction Patterns
-- ============================================================================

-- Aggregated prediction accuracy by context (helps improve future predictions)
CREATE TABLE IF NOT EXISTS prediction_accuracy_aggregates (
  aggregate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Aggregation dimensions
  time_period DATE NOT NULL,
  prompt_complexity TEXT,
  detected_intent TEXT,
  domain_detected TEXT,
  
  -- Accuracy metrics
  total_predictions INTEGER DEFAULT 0,
  accurate_predictions INTEGER DEFAULT 0,  -- prediction_error < 0.3
  accuracy_rate DECIMAL(5,4),
  
  -- Surprise distribution
  avg_prediction_error DECIMAL(5,4),
  max_prediction_error DECIMAL(5,4),
  high_surprise_count INTEGER DEFAULT 0,  -- prediction_error > 0.7
  
  -- Learning impact
  learning_signals_generated INTEGER DEFAULT 0,
  candidates_created INTEGER DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, time_period, prompt_complexity, detected_intent, domain_detected)
);

ALTER TABLE prediction_accuracy_aggregates ENABLE ROW LEVEL SECURITY;

CREATE POLICY prediction_accuracy_aggregates_tenant 
ON prediction_accuracy_aggregates
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- 5. CONSCIOUSNESS EVOLUTION STATE - Track Evolution Over Time
-- ============================================================================

-- Track the evolution of consciousness across LoRA generations
CREATE TABLE IF NOT EXISTS consciousness_evolution_state (
  state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Current state
  current_adapter_id UUID,
  current_adapter_version INTEGER DEFAULT 0,
  generation_number INTEGER DEFAULT 0,  -- How many evolution cycles
  
  -- Evolution metrics (accumulated)
  total_learning_candidates_processed INTEGER DEFAULT 0,
  total_prediction_errors_learned_from INTEGER DEFAULT 0,
  total_training_hours DECIMAL(10,2) DEFAULT 0,
  
  -- Personality drift (how much the system has changed)
  personality_drift_score DECIMAL(5,4) DEFAULT 0,  -- 0 = same as base, 1 = completely different
  dominant_learned_traits JSONB DEFAULT '[]',
  
  -- Performance trajectory
  avg_prediction_accuracy_30d DECIMAL(5,4),
  avg_user_satisfaction_30d DECIMAL(5,4),
  avg_task_success_rate_30d DECIMAL(5,4),
  
  -- Milestones
  first_evolution_at TIMESTAMPTZ,
  last_evolution_at TIMESTAMPTZ,
  next_scheduled_evolution TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id)
);

ALTER TABLE consciousness_evolution_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY consciousness_evolution_state_tenant 
ON consciousness_evolution_state
FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE consciousness_evolution_state IS 'Tracks consciousness evolution across LoRA generations';

-- ============================================================================
-- 6. FUNCTIONS
-- ============================================================================

-- Calculate prediction error and generate learning signal
CREATE OR REPLACE FUNCTION process_prediction_observation(
  p_prediction_id UUID,
  p_actual_outcome TEXT,
  p_actual_confidence DECIMAL,
  p_observation_method TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_prediction RECORD;
  v_error DECIMAL;
  v_surprise TEXT;
  v_learning_strength DECIMAL;
  v_result JSONB;
BEGIN
  -- Get the prediction
  SELECT * INTO v_prediction 
  FROM consciousness_predictions 
  WHERE prediction_id = p_prediction_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Prediction not found');
  END IF;
  
  -- Calculate prediction error (simple outcome match for now)
  IF v_prediction.predicted_outcome = p_actual_outcome THEN
    v_error := ABS(v_prediction.predicted_confidence - p_actual_confidence);
  ELSE
    v_error := 0.5 + (ABS(v_prediction.predicted_confidence - 0.5) * 0.5);
  END IF;
  
  -- Categorize surprise
  v_surprise := CASE
    WHEN v_error < 0.1 THEN 'none'
    WHEN v_error < 0.3 THEN 'low'
    WHEN v_error < 0.5 THEN 'medium'
    WHEN v_error < 0.7 THEN 'high'
    ELSE 'extreme'
  END;
  
  -- Learning signal strength (higher surprise = stronger signal)
  v_learning_strength := v_error * (1 + (v_prediction.predicted_confidence * 0.5));
  
  -- Update the prediction record
  UPDATE consciousness_predictions SET
    actual_outcome = p_actual_outcome,
    actual_confidence = p_actual_confidence,
    observation_method = p_observation_method,
    observed_at = NOW(),
    prediction_error = v_error,
    surprise_magnitude = v_surprise,
    learning_signal_generated = v_error > 0.3,
    learning_signal_strength = v_learning_strength
  WHERE prediction_id = p_prediction_id;
  
  v_result := jsonb_build_object(
    'prediction_error', v_error,
    'surprise_magnitude', v_surprise,
    'learning_signal_strength', v_learning_strength,
    'should_create_learning_candidate', v_error > 0.5
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Get pending learning candidates for next training job
CREATE OR REPLACE FUNCTION get_training_candidates(
  p_tenant_id UUID,
  p_max_candidates INTEGER DEFAULT 1000
)
RETURNS TABLE (
  candidate_id UUID,
  candidate_type TEXT,
  prompt_text TEXT,
  response_text TEXT,
  correction_text TEXT,
  quality_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lc.candidate_id,
    lc.candidate_type,
    lc.prompt_text,
    lc.response_text,
    lc.correction_text,
    lc.quality_score
  FROM learning_candidates lc
  WHERE lc.tenant_id = p_tenant_id
    AND lc.training_status = 'pending'
    AND lc.expires_at > NOW()
  ORDER BY 
    lc.quality_score DESC NULLS LAST,
    lc.prediction_error_at_time DESC NULLS LAST,
    lc.created_at DESC
  LIMIT p_max_candidates;
END;
$$ LANGUAGE plpgsql;

-- Update prediction accuracy aggregates
CREATE OR REPLACE FUNCTION update_prediction_aggregates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.observed_at IS NOT NULL AND OLD.observed_at IS NULL THEN
    INSERT INTO prediction_accuracy_aggregates (
      tenant_id, time_period, prompt_complexity, detected_intent, domain_detected,
      total_predictions, accurate_predictions, accuracy_rate,
      avg_prediction_error, max_prediction_error, high_surprise_count,
      learning_signals_generated
    )
    VALUES (
      NEW.tenant_id, 
      DATE(NEW.observed_at),
      NEW.prompt_complexity,
      NEW.detected_intent,
      NULL,  -- domain_detected
      1,
      CASE WHEN NEW.prediction_error < 0.3 THEN 1 ELSE 0 END,
      CASE WHEN NEW.prediction_error < 0.3 THEN 1.0 ELSE 0.0 END,
      NEW.prediction_error,
      NEW.prediction_error,
      CASE WHEN NEW.prediction_error > 0.7 THEN 1 ELSE 0 END,
      CASE WHEN NEW.learning_signal_generated THEN 1 ELSE 0 END
    )
    ON CONFLICT (tenant_id, time_period, prompt_complexity, detected_intent, domain_detected)
    DO UPDATE SET
      total_predictions = prediction_accuracy_aggregates.total_predictions + 1,
      accurate_predictions = prediction_accuracy_aggregates.accurate_predictions + 
        CASE WHEN NEW.prediction_error < 0.3 THEN 1 ELSE 0 END,
      accuracy_rate = (prediction_accuracy_aggregates.accurate_predictions + 
        CASE WHEN NEW.prediction_error < 0.3 THEN 1 ELSE 0 END)::DECIMAL / 
        (prediction_accuracy_aggregates.total_predictions + 1),
      avg_prediction_error = (prediction_accuracy_aggregates.avg_prediction_error * 
        prediction_accuracy_aggregates.total_predictions + NEW.prediction_error) / 
        (prediction_accuracy_aggregates.total_predictions + 1),
      max_prediction_error = GREATEST(prediction_accuracy_aggregates.max_prediction_error, NEW.prediction_error),
      high_surprise_count = prediction_accuracy_aggregates.high_surprise_count + 
        CASE WHEN NEW.prediction_error > 0.7 THEN 1 ELSE 0 END,
      learning_signals_generated = prediction_accuracy_aggregates.learning_signals_generated +
        CASE WHEN NEW.learning_signal_generated THEN 1 ELSE 0 END,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_prediction_aggregates_trigger
  AFTER UPDATE ON consciousness_predictions
  FOR EACH ROW EXECUTE FUNCTION update_prediction_aggregates();

-- ============================================================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_predictions_error_learning 
ON consciousness_predictions(tenant_id, prediction_error DESC, learning_signal_generated)
WHERE prediction_error > 0.3;

CREATE INDEX IF NOT EXISTS idx_candidates_quality 
ON learning_candidates(tenant_id, quality_score DESC, created_at DESC)
WHERE training_status = 'pending';
