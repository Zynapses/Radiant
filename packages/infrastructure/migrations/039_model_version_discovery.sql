-- RADIANT v5.2.4 - Model Version Discovery & Management
-- Migration: 039_model_version_discovery.sql
-- Adds HuggingFace discovery, S3 model storage, thermal status, and deletion queue

-- ============================================================================
-- Model Versions Table (S3-backed with thermal status)
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL,
  family TEXT NOT NULL,
  version TEXT NOT NULL,
  
  -- HuggingFace metadata
  huggingface_id TEXT,
  huggingface_revision TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discovery_source TEXT NOT NULL DEFAULT 'manual', -- 'huggingface_api', 'manual', 'registry_sync'
  
  -- S3 Storage
  s3_bucket TEXT,
  s3_key_prefix TEXT,
  s3_region TEXT DEFAULT 'us-east-1',
  storage_size_bytes BIGINT,
  download_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'downloading', 'completed', 'failed'
  download_progress_pct INTEGER DEFAULT 0,
  download_started_at TIMESTAMPTZ,
  download_completed_at TIMESTAMPTZ,
  download_error TEXT,
  
  -- Thermal Status
  thermal_state TEXT NOT NULL DEFAULT 'off', -- 'off', 'cold', 'warm', 'hot'
  target_thermal_state TEXT,
  thermal_state_changed_at TIMESTAMPTZ,
  auto_thermal_enabled BOOLEAN DEFAULT true,
  warm_until TIMESTAMPTZ,
  
  -- SageMaker deployment
  sagemaker_endpoint_name TEXT,
  sagemaker_endpoint_config TEXT,
  sagemaker_model_name TEXT,
  inference_component_id TEXT,
  deployment_status TEXT DEFAULT 'not_deployed', -- 'not_deployed', 'deploying', 'deployed', 'failed', 'deleting'
  
  -- Model metadata (from HuggingFace or manual)
  display_name TEXT,
  description TEXT,
  parameter_count TEXT,
  context_window INTEGER,
  max_output_tokens INTEGER,
  capabilities TEXT[],
  input_modalities TEXT[],
  output_modalities TEXT[],
  license TEXT,
  commercial_use BOOLEAN DEFAULT true,
  
  -- Hardware requirements
  instance_type TEXT,
  min_vram_gb INTEGER,
  quantization TEXT,
  tensor_parallelism INTEGER DEFAULT 1,
  
  -- Pricing estimate
  pricing_input_per_1m DECIMAL(10, 4),
  pricing_output_per_1m DECIMAL(10, 4),
  
  -- Usage tracking
  total_requests BIGINT DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT false, -- Activated by admin
  is_default_for_family BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(model_id, version)
);

-- Indexes for model_versions
CREATE INDEX idx_model_versions_family ON model_versions(family);
CREATE INDEX idx_model_versions_thermal ON model_versions(thermal_state);
CREATE INDEX idx_model_versions_discovery ON model_versions(discovery_source, discovered_at);
CREATE INDEX idx_model_versions_download ON model_versions(download_status);
CREATE INDEX idx_model_versions_deployment ON model_versions(deployment_status);
CREATE INDEX idx_model_versions_active ON model_versions(is_active) WHERE is_active = true;

-- ============================================================================
-- Model Family Watch List (which families to monitor for new versions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_family_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family TEXT NOT NULL UNIQUE,
  
  -- Watch configuration
  is_enabled BOOLEAN DEFAULT true,
  auto_download BOOLEAN DEFAULT false, -- Automatically download new versions
  auto_deploy BOOLEAN DEFAULT false, -- Automatically deploy new versions
  auto_thermal_tier TEXT DEFAULT 'cold', -- Default thermal state for new versions
  
  -- HuggingFace search config
  huggingface_org TEXT, -- e.g., 'meta-llama', 'Qwen', 'deepseek-ai'
  huggingface_filter TEXT, -- Additional filter query
  min_likes INTEGER DEFAULT 100, -- Only consider models with this many likes
  include_gated BOOLEAN DEFAULT false, -- Include gated models
  
  -- Notification settings
  notify_on_new_version BOOLEAN DEFAULT true,
  notification_emails TEXT[],
  notification_webhook TEXT,
  
  -- Last check
  last_checked_at TIMESTAMPTZ,
  last_check_status TEXT,
  last_check_error TEXT,
  versions_found INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with current registry families
INSERT INTO model_family_watchlist (family, huggingface_org, is_enabled) VALUES
  ('llama', 'meta-llama', true),
  ('qwen', 'Qwen', true),
  ('deepseek', 'deepseek-ai', true),
  ('mistral', 'mistralai', true),
  ('phi', 'microsoft', true),
  ('gemma', 'google', true),
  ('falcon', 'tiiuae', true),
  ('yi', '01-ai', true),
  ('internlm', 'internlm', true),
  ('codellama', 'codellama', true),
  ('starcoder', 'bigcode', true),
  ('wizardcoder', 'WizardLM', true),
  ('stable_diffusion', 'stabilityai', true),
  ('flux', 'black-forest-labs', true),
  ('whisper', 'openai', true),
  ('bark', 'suno', true),
  ('musicgen', 'facebook', true),
  ('point_e', 'openai', false),
  ('shap_e', 'openai', false)
ON CONFLICT (family) DO NOTHING;

-- ============================================================================
-- Model Discovery Jobs (track HuggingFace API polling)
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_discovery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Job details
  job_type TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'manual', 'webhook'
  triggered_by TEXT, -- User ID or 'system'
  
  -- Progress
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Results
  families_checked INTEGER DEFAULT 0,
  models_discovered INTEGER DEFAULT 0,
  models_added INTEGER DEFAULT 0,
  downloads_started INTEGER DEFAULT 0,
  
  -- Errors
  errors JSONB DEFAULT '[]'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,
  
  -- Detailed results per family
  family_results JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_discovery_jobs_status ON model_discovery_jobs(status, created_at DESC);

-- ============================================================================
-- Model Deletion Queue (soft delete with usage tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_deletion_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id UUID NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  version TEXT NOT NULL,
  
  -- Deletion request
  requested_by TEXT NOT NULL, -- User ID
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  
  -- Queue status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'blocked', 'processing', 'completed', 'cancelled', 'failed'
  blocked_reason TEXT, -- e.g., 'model_in_use', 'has_active_sessions'
  
  -- Usage at time of request
  active_sessions INTEGER DEFAULT 0,
  requests_last_24h INTEGER DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  
  -- Processing
  processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- What was deleted
  s3_objects_deleted INTEGER,
  sagemaker_resources_deleted TEXT[],
  
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deletion_queue_status ON model_deletion_queue(status);
CREATE INDEX idx_deletion_queue_model ON model_deletion_queue(model_id, version);
CREATE INDEX idx_deletion_queue_blocked ON model_deletion_queue(status) WHERE status = 'blocked';

-- ============================================================================
-- Model Usage Tracking (for deletion queue checks)
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_usage_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id UUID NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  user_id TEXT,
  tenant_id TEXT,
  
  -- Session details
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  -- Usage stats
  request_count INTEGER DEFAULT 0,
  tokens_used BIGINT DEFAULT 0,
  
  UNIQUE(model_version_id, session_id)
);

CREATE INDEX idx_usage_sessions_active ON model_usage_sessions(model_version_id, is_active) WHERE is_active = true;
CREATE INDEX idx_usage_sessions_last ON model_usage_sessions(last_activity_at);

-- ============================================================================
-- Discovery Configuration (extends model_sync_config)
-- ============================================================================

ALTER TABLE model_sync_config 
  ADD COLUMN IF NOT EXISTS huggingface_api_token_secret_arn TEXT,
  ADD COLUMN IF NOT EXISTS discovery_interval_hours INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS auto_download_new_versions BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_concurrent_downloads INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS s3_model_bucket TEXT,
  ADD COLUMN IF NOT EXISTS s3_model_prefix TEXT DEFAULT 'models/',
  ADD COLUMN IF NOT EXISTS default_thermal_state TEXT DEFAULT 'cold';

-- ============================================================================
-- Views
-- ============================================================================

-- View: Active model versions with usage stats
CREATE OR REPLACE VIEW v_model_versions_with_stats AS
SELECT 
  mv.*,
  COALESCE(us.active_sessions, 0) as active_sessions,
  COALESCE(us.total_sessions, 0) as total_sessions,
  CASE 
    WHEN mv.thermal_state = 'hot' THEN 1
    WHEN mv.thermal_state = 'warm' THEN 2
    WHEN mv.thermal_state = 'cold' THEN 3
    ELSE 4
  END as thermal_priority
FROM model_versions mv
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) FILTER (WHERE is_active) as active_sessions,
    COUNT(*) as total_sessions
  FROM model_usage_sessions mus
  WHERE mus.model_version_id = mv.id
) us ON true;

-- View: Deletion queue with model details
CREATE OR REPLACE VIEW v_deletion_queue_detailed AS
SELECT 
  dq.*,
  mv.display_name,
  mv.family,
  mv.thermal_state,
  mv.s3_bucket,
  mv.s3_key_prefix,
  mv.sagemaker_endpoint_name,
  COALESCE(
    (SELECT COUNT(*) FROM model_usage_sessions mus 
     WHERE mus.model_version_id = dq.model_version_id AND mus.is_active),
    0
  ) as current_active_sessions
FROM model_deletion_queue dq
JOIN model_versions mv ON dq.model_version_id = mv.id;

-- ============================================================================
-- Functions
-- ============================================================================

-- Function: Check if model can be deleted (no active usage)
CREATE OR REPLACE FUNCTION can_delete_model_version(p_model_version_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_active_sessions INTEGER;
  v_recent_requests INTEGER;
BEGIN
  -- Check active sessions
  SELECT COUNT(*) INTO v_active_sessions
  FROM model_usage_sessions
  WHERE model_version_id = p_model_version_id 
    AND is_active = true
    AND last_activity_at > NOW() - INTERVAL '5 minutes';
  
  IF v_active_sessions > 0 THEN
    RETURN FALSE;
  END IF;
  
  -- Check recent requests (within last minute)
  SELECT total_requests INTO v_recent_requests
  FROM model_versions
  WHERE id = p_model_version_id
    AND last_request_at > NOW() - INTERVAL '1 minute';
  
  IF v_recent_requests IS NOT NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function: Queue model for deletion
CREATE OR REPLACE FUNCTION queue_model_deletion(
  p_model_version_id UUID,
  p_requested_by TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_model_id TEXT;
  v_version TEXT;
  v_active_sessions INTEGER;
  v_requests_24h INTEGER;
  v_last_request TIMESTAMPTZ;
  v_queue_id UUID;
  v_can_delete BOOLEAN;
  v_status TEXT;
BEGIN
  -- Get model info
  SELECT model_id, version, last_request_at
  INTO v_model_id, v_version, v_last_request
  FROM model_versions
  WHERE id = p_model_version_id;
  
  IF v_model_id IS NULL THEN
    RAISE EXCEPTION 'Model version not found: %', p_model_version_id;
  END IF;
  
  -- Get current usage
  SELECT COUNT(*) INTO v_active_sessions
  FROM model_usage_sessions
  WHERE model_version_id = p_model_version_id AND is_active = true;
  
  -- Estimate requests in last 24h (simplified)
  SELECT total_requests INTO v_requests_24h
  FROM model_versions WHERE id = p_model_version_id;
  
  -- Determine initial status
  v_can_delete := can_delete_model_version(p_model_version_id);
  IF v_can_delete THEN
    v_status := 'pending';
  ELSE
    v_status := 'blocked';
  END IF;
  
  -- Insert into queue
  INSERT INTO model_deletion_queue (
    model_version_id, model_id, version,
    requested_by, reason, status,
    blocked_reason, active_sessions, requests_last_24h, last_request_at
  ) VALUES (
    p_model_version_id, v_model_id, v_version,
    p_requested_by, p_reason, v_status,
    CASE WHEN NOT v_can_delete THEN 'model_in_use' ELSE NULL END,
    v_active_sessions, v_requests_24h, v_last_request
  )
  RETURNING id INTO v_queue_id;
  
  RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Process deletion queue (called by scheduled job)
CREATE OR REPLACE FUNCTION process_deletion_queue()
RETURNS TABLE(
  processed INTEGER,
  completed INTEGER,
  still_blocked INTEGER,
  failed INTEGER
) AS $$
DECLARE
  v_processed INTEGER := 0;
  v_completed INTEGER := 0;
  v_still_blocked INTEGER := 0;
  v_failed INTEGER := 0;
  v_queue_item RECORD;
BEGIN
  -- Process blocked items first to see if they can proceed
  FOR v_queue_item IN 
    SELECT * FROM model_deletion_queue 
    WHERE status IN ('blocked', 'pending')
    ORDER BY requested_at
    LIMIT 10
  LOOP
    v_processed := v_processed + 1;
    
    IF can_delete_model_version(v_queue_item.model_version_id) THEN
      -- Move to processing
      UPDATE model_deletion_queue
      SET status = 'processing', 
          processing_started_at = NOW(),
          blocked_reason = NULL,
          updated_at = NOW()
      WHERE id = v_queue_item.id;
      
      -- Actual deletion would be handled by the service layer
      -- This just marks it ready for processing
    ELSE
      -- Update blocked count
      UPDATE model_deletion_queue
      SET status = 'blocked',
          blocked_reason = 'model_in_use',
          active_sessions = (
            SELECT COUNT(*) FROM model_usage_sessions 
            WHERE model_version_id = v_queue_item.model_version_id AND is_active
          ),
          updated_at = NOW()
      WHERE id = v_queue_item.id;
      
      v_still_blocked := v_still_blocked + 1;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_processed, v_completed, v_still_blocked, v_failed;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Trigger: Update model_versions.updated_at
CREATE OR REPLACE FUNCTION update_model_versions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_model_versions_updated
  BEFORE UPDATE ON model_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_model_versions_timestamp();

-- Trigger: Update thermal_state_changed_at when thermal state changes
CREATE OR REPLACE FUNCTION update_thermal_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.thermal_state IS DISTINCT FROM OLD.thermal_state THEN
    NEW.thermal_state_changed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_thermal_state_changed
  BEFORE UPDATE ON model_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_thermal_state_timestamp();

-- Trigger: Close expired usage sessions
CREATE OR REPLACE FUNCTION close_expired_sessions()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE model_usage_sessions
  SET is_active = false, ended_at = NOW()
  WHERE is_active = true 
    AND last_activity_at < NOW() - INTERVAL '30 minutes';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Run session cleanup periodically (triggered by any insert to usage_sessions)
CREATE TRIGGER trg_cleanup_sessions
  AFTER INSERT ON model_usage_sessions
  FOR EACH STATEMENT
  EXECUTE FUNCTION close_expired_sessions();
