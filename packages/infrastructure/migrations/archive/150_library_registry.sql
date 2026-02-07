-- RADIANT v4.18.0 - Open Source Library Registry
-- Migration 103: AI capability extensions through open-source tools
-- Libraries are NOT AI models - they extend AI capabilities for problem-solving

-- ============================================================================
-- 1. LIBRARY REGISTRY CONFIGURATION (per-tenant)
-- ============================================================================

CREATE TABLE IF NOT EXISTS library_registry_config (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Feature toggles
  library_assist_enabled BOOLEAN DEFAULT true,
  auto_suggest_libraries BOOLEAN DEFAULT true,
  max_libraries_per_request INTEGER DEFAULT 5,
  
  -- Update settings
  auto_update_enabled BOOLEAN DEFAULT true,
  update_frequency VARCHAR(20) DEFAULT 'daily' CHECK (update_frequency IN ('hourly', 'daily', 'weekly', 'manual')),
  update_time_utc VARCHAR(5) DEFAULT '03:00',
  last_update_at TIMESTAMPTZ,
  next_update_at TIMESTAMPTZ,
  
  -- Proficiency matching
  min_proficiency_match DECIMAL(3,2) DEFAULT 0.50 CHECK (min_proficiency_match BETWEEN 0 AND 1),
  proficiency_weights JSONB DEFAULT '{}',
  
  -- Category preferences
  enabled_categories JSONB DEFAULT '[]',
  disabled_libraries JSONB DEFAULT '[]',
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_library_config_per_tenant UNIQUE (tenant_id)
);

-- RLS
ALTER TABLE library_registry_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY library_registry_config_tenant_isolation ON library_registry_config
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE INDEX idx_library_config_tenant ON library_registry_config(tenant_id);

-- ============================================================================
-- 2. OPEN SOURCE LIBRARIES (global registry)
-- ============================================================================

CREATE TABLE IF NOT EXISTS open_source_libraries (
  library_id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  license VARCHAR(50) NOT NULL,
  license_note TEXT,
  repo VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  beats JSONB DEFAULT '[]',
  stars INTEGER DEFAULT 0,
  languages JSONB DEFAULT '[]',
  domains JSONB DEFAULT '[]',
  
  -- Proficiency scores (1-10 scale, matching domain taxonomy)
  reasoning_depth INTEGER DEFAULT 5 CHECK (reasoning_depth BETWEEN 1 AND 10),
  mathematical_quantitative INTEGER DEFAULT 5 CHECK (mathematical_quantitative BETWEEN 1 AND 10),
  code_generation INTEGER DEFAULT 5 CHECK (code_generation BETWEEN 1 AND 10),
  creative_generative INTEGER DEFAULT 5 CHECK (creative_generative BETWEEN 1 AND 10),
  research_synthesis INTEGER DEFAULT 5 CHECK (research_synthesis BETWEEN 1 AND 10),
  factual_recall_precision INTEGER DEFAULT 5 CHECK (factual_recall_precision BETWEEN 1 AND 10),
  multi_step_problem_solving INTEGER DEFAULT 5 CHECK (multi_step_problem_solving BETWEEN 1 AND 10),
  domain_terminology_handling INTEGER DEFAULT 5 CHECK (domain_terminology_handling BETWEEN 1 AND 10),
  
  -- Metadata
  version VARCHAR(50),
  last_checked_at TIMESTAMPTZ,
  source VARCHAR(50) DEFAULT 'seed',
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_libraries_category ON open_source_libraries(category);
CREATE INDEX idx_libraries_license ON open_source_libraries(license);
CREATE INDEX idx_libraries_domains ON open_source_libraries USING GIN(domains);
CREATE INDEX idx_libraries_languages ON open_source_libraries USING GIN(languages);

-- ============================================================================
-- 3. TENANT LIBRARY OVERRIDES
-- Per-tenant customization of library settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_library_overrides (
  override_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  library_id VARCHAR(100) NOT NULL REFERENCES open_source_libraries(library_id) ON DELETE CASCADE,
  
  -- Override settings
  enabled BOOLEAN DEFAULT true,
  priority_boost DECIMAL(3,2) DEFAULT 0, -- -1 to +1 priority adjustment
  custom_proficiencies JSONB, -- Override proficiency scores
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_tenant_library_override UNIQUE (tenant_id, library_id)
);

-- RLS
ALTER TABLE tenant_library_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_library_overrides_isolation ON tenant_library_overrides
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE INDEX idx_library_overrides_tenant ON tenant_library_overrides(tenant_id);
CREATE INDEX idx_library_overrides_library ON tenant_library_overrides(library_id);

-- ============================================================================
-- 4. LIBRARY USAGE EVENTS
-- Track how AI uses libraries to solve problems
-- ============================================================================

CREATE TABLE IF NOT EXISTS library_usage_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID,
  library_id VARCHAR(100) NOT NULL REFERENCES open_source_libraries(library_id) ON DELETE CASCADE,
  
  -- Invocation details
  invocation_type VARCHAR(50) NOT NULL CHECK (invocation_type IN (
    'code_generation', 'data_processing', 'analysis', 'transformation',
    'search', 'inference', 'optimization', 'simulation'
  )),
  success BOOLEAN NOT NULL,
  execution_time_ms INTEGER,
  error_message TEXT,
  
  -- Context
  conversation_id UUID,
  request_id UUID,
  prompt_domain VARCHAR(100),
  match_score DECIMAL(3,2),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE library_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY library_usage_events_isolation ON library_usage_events
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE INDEX idx_library_usage_tenant ON library_usage_events(tenant_id);
CREATE INDEX idx_library_usage_library ON library_usage_events(library_id);
CREATE INDEX idx_library_usage_created ON library_usage_events(created_at DESC);
CREATE INDEX idx_library_usage_type ON library_usage_events(invocation_type);

-- ============================================================================
-- 5. LIBRARY USAGE AGGREGATES
-- Pre-computed usage statistics for performance
-- ============================================================================

CREATE TABLE IF NOT EXISTS library_usage_aggregates (
  aggregate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  library_id VARCHAR(100) NOT NULL REFERENCES open_source_libraries(library_id) ON DELETE CASCADE,
  
  -- Statistics
  total_invocations INTEGER DEFAULT 0,
  successful_invocations INTEGER DEFAULT 0,
  failed_invocations INTEGER DEFAULT 0,
  total_execution_time_ms BIGINT DEFAULT 0,
  invocations_by_type JSONB DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  
  -- Computed
  success_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN total_invocations > 0 
    THEN successful_invocations::DECIMAL / total_invocations 
    ELSE 0 END
  ) STORED,
  avg_execution_time_ms DECIMAL(10,2) GENERATED ALWAYS AS (
    CASE WHEN total_invocations > 0 
    THEN total_execution_time_ms::DECIMAL / total_invocations 
    ELSE 0 END
  ) STORED,
  
  -- Audit
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_usage_aggregate UNIQUE (tenant_id, library_id)
);

-- RLS
ALTER TABLE library_usage_aggregates ENABLE ROW LEVEL SECURITY;

CREATE POLICY library_usage_aggregates_isolation ON library_usage_aggregates
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE INDEX idx_library_aggregates_tenant ON library_usage_aggregates(tenant_id);
CREATE INDEX idx_library_aggregates_success ON library_usage_aggregates(success_rate DESC);

-- ============================================================================
-- 6. LIBRARY UPDATE JOBS
-- Track library registry update operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS library_update_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for global updates
  
  -- Job status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  job_type VARCHAR(20) DEFAULT 'scheduled' CHECK (job_type IN ('scheduled', 'manual', 'seed')),
  
  -- Progress
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  libraries_checked INTEGER DEFAULT 0,
  libraries_updated INTEGER DEFAULT 0,
  new_libraries_added INTEGER DEFAULT 0,
  
  -- Errors
  errors JSONB DEFAULT '[]',
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_library_jobs_status ON library_update_jobs(status);
CREATE INDEX idx_library_jobs_created ON library_update_jobs(created_at DESC);

-- ============================================================================
-- 7. LIBRARY VERSION HISTORY
-- Track library version changes over time
-- ============================================================================

CREATE TABLE IF NOT EXISTS library_version_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id VARCHAR(100) NOT NULL REFERENCES open_source_libraries(library_id) ON DELETE CASCADE,
  
  -- Version info
  previous_version VARCHAR(50),
  new_version VARCHAR(50),
  stars_delta INTEGER DEFAULT 0,
  breaking_changes BOOLEAN DEFAULT false,
  release_notes TEXT,
  
  -- Audit
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_library_history_library ON library_version_history(library_id);
CREATE INDEX idx_library_history_detected ON library_version_history(detected_at DESC);

-- ============================================================================
-- 8. LIBRARY REGISTRY METADATA
-- Global registry metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS library_registry_metadata (
  metadata_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(20) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  description TEXT,
  total_tools INTEGER DEFAULT 0,
  license_types_included JSONB DEFAULT '[]',
  license_types_excluded JSONB DEFAULT '[]',
  proficiency_scale JSONB DEFAULT '{"min": 1, "max": 10}',
  proficiency_dimensions JSONB DEFAULT '[]',
  
  -- Singleton constraint
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT only_one_current_metadata UNIQUE (is_current) 
);

-- ============================================================================
-- 9. FUNCTIONS
-- ============================================================================

-- Function to get library proficiencies as JSONB
CREATE OR REPLACE FUNCTION get_library_proficiencies(p_library_id VARCHAR)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'reasoning_depth', reasoning_depth,
    'mathematical_quantitative', mathematical_quantitative,
    'code_generation', code_generation,
    'creative_generative', creative_generative,
    'research_synthesis', research_synthesis,
    'factual_recall_precision', factual_recall_precision,
    'multi_step_problem_solving', multi_step_problem_solving,
    'domain_terminology_handling', domain_terminology_handling
  ) INTO result
  FROM open_source_libraries
  WHERE library_id = p_library_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to calculate proficiency match score
CREATE OR REPLACE FUNCTION calculate_proficiency_match(
  p_library_id VARCHAR,
  p_required_proficiencies JSONB,
  p_weights JSONB DEFAULT '{}'
) RETURNS DECIMAL AS $$
DECLARE
  lib_profs JSONB;
  dimension TEXT;
  required_score INTEGER;
  lib_score INTEGER;
  weight DECIMAL;
  total_weight DECIMAL := 0;
  weighted_sum DECIMAL := 0;
  dimensions TEXT[] := ARRAY[
    'reasoning_depth', 'mathematical_quantitative', 'code_generation',
    'creative_generative', 'research_synthesis', 'factual_recall_precision',
    'multi_step_problem_solving', 'domain_terminology_handling'
  ];
BEGIN
  lib_profs := get_library_proficiencies(p_library_id);
  
  FOREACH dimension IN ARRAY dimensions LOOP
    IF p_required_proficiencies ? dimension THEN
      required_score := (p_required_proficiencies ->> dimension)::INTEGER;
      lib_score := (lib_profs ->> dimension)::INTEGER;
      weight := COALESCE((p_weights ->> dimension)::DECIMAL, 1.0);
      
      -- Score: how well library meets or exceeds requirement (0-1)
      weighted_sum := weighted_sum + (
        LEAST(lib_score::DECIMAL / GREATEST(required_score, 1), 1.0) * weight
      );
      total_weight := total_weight + weight;
    END IF;
  END LOOP;
  
  IF total_weight = 0 THEN
    RETURN 1.0; -- No requirements = perfect match
  END IF;
  
  RETURN weighted_sum / total_weight;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to find matching libraries
CREATE OR REPLACE FUNCTION find_matching_libraries(
  p_tenant_id UUID,
  p_required_proficiencies JSONB,
  p_domains JSONB DEFAULT NULL,
  p_categories JSONB DEFAULT NULL,
  p_min_match DECIMAL DEFAULT 0.5,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  library_id VARCHAR,
  name VARCHAR,
  category VARCHAR,
  match_score DECIMAL,
  proficiency_match DECIMAL,
  domain_match DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.library_id,
    l.name,
    l.category,
    (
      calculate_proficiency_match(l.library_id, p_required_proficiencies, 
        COALESCE((SELECT proficiency_weights FROM library_registry_config WHERE tenant_id = p_tenant_id), '{}'::JSONB)
      ) * 0.7 +
      CASE 
        WHEN p_domains IS NULL THEN 1.0
        WHEN l.domains ?| ARRAY(SELECT jsonb_array_elements_text(p_domains)) THEN 1.0
        WHEN l.domains ? 'all' THEN 0.8
        ELSE 0.3
      END * 0.3
    )::DECIMAL as match_score,
    calculate_proficiency_match(l.library_id, p_required_proficiencies, '{}')::DECIMAL as proficiency_match,
    CASE 
      WHEN p_domains IS NULL THEN 1.0
      WHEN l.domains ?| ARRAY(SELECT jsonb_array_elements_text(p_domains)) THEN 1.0
      WHEN l.domains ? 'all' THEN 0.8
      ELSE 0.3
    END::DECIMAL as domain_match
  FROM open_source_libraries l
  LEFT JOIN tenant_library_overrides o ON l.library_id = o.library_id AND o.tenant_id = p_tenant_id
  WHERE 
    COALESCE(o.enabled, true) = true
    AND (p_categories IS NULL OR l.category = ANY(ARRAY(SELECT jsonb_array_elements_text(p_categories))))
    AND l.library_id NOT IN (
      SELECT jsonb_array_elements_text(disabled_libraries)
      FROM library_registry_config
      WHERE tenant_id = p_tenant_id
    )
  HAVING (
    calculate_proficiency_match(l.library_id, p_required_proficiencies, '{}') * 0.7 +
    CASE 
      WHEN p_domains IS NULL THEN 1.0
      WHEN l.domains ?| ARRAY(SELECT jsonb_array_elements_text(p_domains)) THEN 1.0
      WHEN l.domains ? 'all' THEN 0.8
      ELSE 0.3
    END * 0.3
  ) >= p_min_match
  ORDER BY match_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to record library usage
CREATE OR REPLACE FUNCTION record_library_usage(
  p_tenant_id UUID,
  p_user_id UUID,
  p_library_id VARCHAR,
  p_invocation_type VARCHAR,
  p_success BOOLEAN,
  p_execution_time_ms INTEGER,
  p_error_message TEXT DEFAULT NULL,
  p_conversation_id UUID DEFAULT NULL,
  p_request_id UUID DEFAULT NULL,
  p_prompt_domain VARCHAR DEFAULT NULL,
  p_match_score DECIMAL DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Insert event
  INSERT INTO library_usage_events (
    tenant_id, user_id, library_id, invocation_type, success,
    execution_time_ms, error_message, conversation_id, request_id,
    prompt_domain, match_score
  ) VALUES (
    p_tenant_id, p_user_id, p_library_id, p_invocation_type, p_success,
    p_execution_time_ms, p_error_message, p_conversation_id, p_request_id,
    p_prompt_domain, p_match_score
  ) RETURNING event_id INTO v_event_id;
  
  -- Update aggregates
  INSERT INTO library_usage_aggregates (
    tenant_id, library_id, total_invocations, successful_invocations,
    failed_invocations, total_execution_time_ms, invocations_by_type, last_used_at
  ) VALUES (
    p_tenant_id, p_library_id, 1,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    COALESCE(p_execution_time_ms, 0),
    jsonb_build_object(p_invocation_type, 1),
    NOW()
  )
  ON CONFLICT (tenant_id, library_id) DO UPDATE SET
    total_invocations = library_usage_aggregates.total_invocations + 1,
    successful_invocations = library_usage_aggregates.successful_invocations + 
      CASE WHEN p_success THEN 1 ELSE 0 END,
    failed_invocations = library_usage_aggregates.failed_invocations + 
      CASE WHEN p_success THEN 0 ELSE 1 END,
    total_execution_time_ms = library_usage_aggregates.total_execution_time_ms + 
      COALESCE(p_execution_time_ms, 0),
    invocations_by_type = library_usage_aggregates.invocations_by_type || 
      jsonb_build_object(
        p_invocation_type, 
        COALESCE((library_usage_aggregates.invocations_by_type ->> p_invocation_type)::INTEGER, 0) + 1
      ),
    last_used_at = NOW(),
    updated_at = NOW();
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. TRIGGERS
-- ============================================================================

-- Trigger to update library updated_at
CREATE OR REPLACE FUNCTION update_library_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_library_updated
  BEFORE UPDATE ON open_source_libraries
  FOR EACH ROW EXECUTE FUNCTION update_library_timestamp();

CREATE TRIGGER trg_library_config_updated
  BEFORE UPDATE ON library_registry_config
  FOR EACH ROW EXECUTE FUNCTION update_library_timestamp();

CREATE TRIGGER trg_library_override_updated
  BEFORE UPDATE ON tenant_library_overrides
  FOR EACH ROW EXECUTE FUNCTION update_library_timestamp();

-- ============================================================================
-- 11. COMMENTS
-- ============================================================================

COMMENT ON TABLE open_source_libraries IS 'Global registry of open-source tools that extend AI capabilities';
COMMENT ON TABLE library_registry_config IS 'Per-tenant configuration for library assistance';
COMMENT ON TABLE tenant_library_overrides IS 'Per-tenant customization of individual library settings';
COMMENT ON TABLE library_usage_events IS 'Audit trail of how AI uses libraries to solve problems';
COMMENT ON TABLE library_usage_aggregates IS 'Pre-computed usage statistics for performance';
COMMENT ON TABLE library_update_jobs IS 'Track library registry update operations';
COMMENT ON TABLE library_version_history IS 'Track library version changes over time';
COMMENT ON TABLE library_registry_metadata IS 'Global registry metadata and version info';
