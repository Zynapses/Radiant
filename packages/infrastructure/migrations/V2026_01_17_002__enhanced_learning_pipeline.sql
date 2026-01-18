-- RADIANT v5.12.0 - Enhanced Learning Pipeline
-- Episode Logger, Skeletonizer, Graveyard, Recipe Extractor, DPO Training

-- ============================================================================
-- 1. LEARNING EPISODES (Episode Logger)
-- ============================================================================

CREATE TABLE IF NOT EXISTS learning_episodes (
  episode_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL,
  goal_intent TEXT NOT NULL,
  workflow_trace JSONB DEFAULT '[]',
  outcome_signal VARCHAR(20) DEFAULT 'pending' CHECK (outcome_signal IN ('positive', 'negative', 'neutral', 'pending')),
  metrics JSONB DEFAULT '{}',
  draft_content TEXT,
  final_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learning_episodes_tenant ON learning_episodes(tenant_id);
CREATE INDEX idx_learning_episodes_user ON learning_episodes(user_id);
CREATE INDEX idx_learning_episodes_session ON learning_episodes(session_id);
CREATE INDEX idx_learning_episodes_outcome ON learning_episodes(outcome_signal) WHERE outcome_signal IN ('positive', 'negative');
CREATE INDEX idx_learning_episodes_created ON learning_episodes(created_at);

-- RLS
ALTER TABLE learning_episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY learning_episodes_tenant_isolation ON learning_episodes
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 2. SKELETONIZED EPISODES (Privacy-safe global training data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS skeletonized_episodes (
  skeleton_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_episode_id UUID REFERENCES learning_episodes(episode_id) ON DELETE SET NULL,
  goal_skeleton TEXT NOT NULL,
  workflow_skeleton JSONB DEFAULT '[]',
  outcome_signal VARCHAR(20) NOT NULL CHECK (outcome_signal IN ('positive', 'negative', 'neutral')),
  metrics_skeleton JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_skeletonized_outcome ON skeletonized_episodes(outcome_signal);
CREATE INDEX idx_skeletonized_created ON skeletonized_episodes(created_at);

-- No RLS on skeletonized - it's global (PII stripped)

-- ============================================================================
-- 3. FAILURE LOG (Graveyard input)
-- ============================================================================

CREATE TABLE IF NOT EXISTS failure_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  error_signature VARCHAR(500) NOT NULL,
  error_type VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_failure_log_signature ON failure_log(error_signature);
CREATE INDEX idx_failure_log_tenant ON failure_log(tenant_id);
CREATE INDEX idx_failure_log_created ON failure_log(created_at);

-- RLS
ALTER TABLE failure_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY failure_log_tenant_isolation ON failure_log
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 4. ANTI-PATTERNS (Graveyard output)
-- ============================================================================

CREATE TABLE IF NOT EXISTS anti_patterns (
  pattern_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type VARCHAR(50) NOT NULL CHECK (pattern_type IN (
    'dependency_conflict', 'version_incompatibility', 'config_error', 'runtime_error', 'api_breaking_change'
  )),
  signature VARCHAR(500) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  failure_count INTEGER DEFAULT 0,
  failure_rate DECIMAL(5,2) DEFAULT 0,
  affected_stacks JSONB DEFAULT '[]',
  recommended_fix TEXT,
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_anti_patterns_active ON anti_patterns(is_active) WHERE is_active = true;
CREATE INDEX idx_anti_patterns_severity ON anti_patterns(severity);
CREATE INDEX idx_anti_patterns_type ON anti_patterns(pattern_type);

-- ============================================================================
-- 5. WORKFLOW RECIPES (Recipe Extractor)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_recipes (
  recipe_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  recipe_name VARCHAR(255) NOT NULL,
  goal_pattern VARCHAR(500) NOT NULL,
  tool_sequence JSONB DEFAULT '[]',
  success_count INTEGER DEFAULT 0,
  last_success_at TIMESTAMPTZ DEFAULT NOW(),
  confidence DECIMAL(3,2) DEFAULT 0.5,
  is_global BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_recipes_tenant_user ON workflow_recipes(tenant_id, user_id);
CREATE INDEX idx_workflow_recipes_goal ON workflow_recipes(goal_pattern);
CREATE INDEX idx_workflow_recipes_global ON workflow_recipes(is_global) WHERE is_global = true;
CREATE INDEX idx_workflow_recipes_success ON workflow_recipes(success_count DESC);

-- RLS
ALTER TABLE workflow_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_recipes_tenant_isolation ON workflow_recipes
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID OR is_global = true);

-- ============================================================================
-- 6. DPO TRAINING PAIRS (Cato LoRA training)
-- ============================================================================

CREATE TABLE IF NOT EXISTS dpo_training_pairs (
  pair_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chosen_skeleton_id UUID REFERENCES skeletonized_episodes(skeleton_id),
  rejected_skeleton_id UUID REFERENCES skeletonized_episodes(skeleton_id),
  goal_skeleton TEXT NOT NULL,
  chosen_response TEXT NOT NULL,
  rejected_response TEXT NOT NULL,
  margin DECIMAL(4,3) DEFAULT 0.5,
  used_in_training BOOLEAN DEFAULT false,
  training_batch_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dpo_pairs_unused ON dpo_training_pairs(used_in_training) WHERE used_in_training = false;
CREATE INDEX idx_dpo_pairs_batch ON dpo_training_pairs(training_batch_id);

-- ============================================================================
-- 7. TOOL ENTROPY (Tool chaining patterns)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tool_entropy_patterns (
  pattern_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID,
  tool_a VARCHAR(100) NOT NULL,
  tool_b VARCHAR(100) NOT NULL,
  co_occurrence_count INTEGER DEFAULT 0,
  avg_time_between_ms INTEGER,
  is_auto_chain_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id, tool_a, tool_b)
);

CREATE INDEX idx_tool_entropy_tenant ON tool_entropy_patterns(tenant_id);
CREATE INDEX idx_tool_entropy_cooccurrence ON tool_entropy_patterns(co_occurrence_count DESC);

-- ============================================================================
-- 8. SHADOW MODE LEARNING (Self-training on public data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS shadow_learning_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(50) NOT NULL, -- 'github', 'documentation', 'stackoverflow'
  source_url TEXT,
  content_hash VARCHAR(64) NOT NULL,
  predicted_code TEXT,
  actual_code TEXT,
  self_grade DECIMAL(3,2),
  error_analysis TEXT,
  learned_pattern TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shadow_learning_source ON shadow_learning_log(source_type);
CREATE INDEX idx_shadow_learning_grade ON shadow_learning_log(self_grade);

-- ============================================================================
-- 9. PASTE-BACK DETECTION (Critical failure signal)
-- ============================================================================

CREATE TABLE IF NOT EXISTS paste_back_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID REFERENCES learning_episodes(episode_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  pasted_content_hash VARCHAR(64),
  time_since_generation_ms INTEGER NOT NULL,
  is_error_content BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_paste_back_episode ON paste_back_events(episode_id);
CREATE INDEX idx_paste_back_tenant ON paste_back_events(tenant_id);

-- RLS
ALTER TABLE paste_back_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY paste_back_tenant_isolation ON paste_back_events
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 10. ENHANCED LEARNING CONFIG
-- ============================================================================

CREATE TABLE IF NOT EXISTS enhanced_learning_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Episode Logger
  episode_logging_enabled BOOLEAN DEFAULT true,
  paste_back_detection_enabled BOOLEAN DEFAULT true,
  paste_back_window_ms INTEGER DEFAULT 30000,
  
  -- Skeletonizer
  auto_skeletonize BOOLEAN DEFAULT true,
  skeletonize_positive_only BOOLEAN DEFAULT false,
  
  -- Recipe Extractor
  recipe_extraction_enabled BOOLEAN DEFAULT true,
  recipe_success_threshold INTEGER DEFAULT 3,
  auto_promote_to_global BOOLEAN DEFAULT false,
  
  -- Graveyard
  failure_clustering_enabled BOOLEAN DEFAULT true,
  proactive_warnings_enabled BOOLEAN DEFAULT true,
  warning_confidence_threshold DECIMAL(3,2) DEFAULT 0.7,
  
  -- DPO Training
  dpo_training_enabled BOOLEAN DEFAULT true,
  dpo_batch_size INTEGER DEFAULT 100,
  
  -- Tool Entropy
  tool_entropy_enabled BOOLEAN DEFAULT true,
  auto_chain_threshold INTEGER DEFAULT 5,
  
  -- Shadow Mode
  shadow_mode_enabled BOOLEAN DEFAULT false,
  shadow_sources JSONB DEFAULT '["documentation"]',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- RLS
ALTER TABLE enhanced_learning_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY enhanced_learning_config_tenant_isolation ON enhanced_learning_config
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- 11. VIEWS FOR ANALYTICS
-- ============================================================================

CREATE OR REPLACE VIEW v_learning_metrics AS
SELECT
  tenant_id,
  DATE(created_at) as date,
  COUNT(*) as total_episodes,
  COUNT(*) FILTER (WHERE outcome_signal = 'positive') as positive_episodes,
  COUNT(*) FILTER (WHERE outcome_signal = 'negative') as negative_episodes,
  AVG((metrics->>'edit_distance')::DECIMAL) as avg_edit_distance,
  COUNT(*) FILTER (WHERE (metrics->>'paste_back_error')::BOOLEAN = true) as paste_back_count,
  COUNT(*) FILTER (WHERE (metrics->>'sandbox_passed')::BOOLEAN = true) as sandbox_passes
FROM learning_episodes
WHERE completed_at IS NOT NULL
GROUP BY tenant_id, DATE(created_at);

CREATE OR REPLACE VIEW v_anti_pattern_impact AS
SELECT
  pattern_type,
  severity,
  COUNT(*) as pattern_count,
  SUM(failure_count) as total_failures,
  AVG(failure_rate) as avg_failure_rate
FROM anti_patterns
WHERE is_active = true
GROUP BY pattern_type, severity;

CREATE OR REPLACE VIEW v_recipe_effectiveness AS
SELECT
  tenant_id,
  COUNT(*) as total_recipes,
  AVG(success_count) as avg_success_count,
  AVG(confidence) as avg_confidence,
  COUNT(*) FILTER (WHERE is_global) as global_recipes
FROM workflow_recipes
GROUP BY tenant_id;

-- ============================================================================
-- 12. TRIGGER FOR AUTO-UPDATING TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_enhanced_learning_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_learning_episodes_updated
  BEFORE UPDATE ON learning_episodes
  FOR EACH ROW EXECUTE FUNCTION update_enhanced_learning_timestamp();

CREATE TRIGGER trigger_anti_patterns_updated
  BEFORE UPDATE ON anti_patterns
  FOR EACH ROW EXECUTE FUNCTION update_enhanced_learning_timestamp();

CREATE TRIGGER trigger_workflow_recipes_updated
  BEFORE UPDATE ON workflow_recipes
  FOR EACH ROW EXECUTE FUNCTION update_enhanced_learning_timestamp();

CREATE TRIGGER trigger_tool_entropy_updated
  BEFORE UPDATE ON tool_entropy_patterns
  FOR EACH ROW EXECUTE FUNCTION update_enhanced_learning_timestamp();

CREATE TRIGGER trigger_enhanced_learning_config_updated
  BEFORE UPDATE ON enhanced_learning_config
  FOR EACH ROW EXECUTE FUNCTION update_enhanced_learning_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE learning_episodes IS 'Tracks behavioral episodes (state transitions) for training - Gemini Procedural Wisdom Engine';
COMMENT ON TABLE skeletonized_episodes IS 'Privacy-safe versions of episodes for global Cato training';
COMMENT ON TABLE failure_log IS 'Raw failure data for Graveyard clustering';
COMMENT ON TABLE anti_patterns IS 'Identified anti-patterns for proactive warnings';
COMMENT ON TABLE workflow_recipes IS 'Successful workflow patterns extracted as reusable recipes';
COMMENT ON TABLE dpo_training_pairs IS 'Direct Preference Optimization pairs for Cato LoRA training';
COMMENT ON TABLE tool_entropy_patterns IS 'Tool co-occurrence patterns for auto-chaining';
COMMENT ON TABLE shadow_learning_log IS 'Self-training results from public data sources';
COMMENT ON TABLE paste_back_events IS 'Critical failure signals when users paste errors';
COMMENT ON TABLE enhanced_learning_config IS 'Per-tenant configuration for enhanced learning features';
