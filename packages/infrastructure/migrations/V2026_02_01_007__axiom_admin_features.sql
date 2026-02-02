-- AXIOM Admin Features - A/B Testing, Extended Config
-- Version: 2.0.0
-- Date: 2026-02-01

-- =============================================================================
-- A/B Testing Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS axiom_ab_tests (
  test_id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(256) NOT NULL,
  domain_id VARCHAR(128) NOT NULL,
  variants JSONB NOT NULL,  -- Array of variant configurations
  traffic_split JSONB NOT NULL DEFAULT '{"control": 50, "variant": 50}',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  metrics JSONB DEFAULT '{}',  -- Aggregated metrics per variant
  winner VARCHAR(64),  -- Winning variant ID if concluded
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  concluded_at TIMESTAMPTZ,
  created_by VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_axiom_ab_tests_domain ON axiom_ab_tests(domain_id);
CREATE INDEX IF NOT EXISTS idx_axiom_ab_tests_status ON axiom_ab_tests(status);

-- =============================================================================
-- A/B Test Assignments
-- =============================================================================

CREATE TABLE IF NOT EXISTS axiom_ab_test_assignments (
  id SERIAL PRIMARY KEY,
  test_id VARCHAR(64) NOT NULL REFERENCES axiom_ab_tests(test_id),
  session_id VARCHAR(64) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  variant_id VARCHAR(64) NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome_recorded BOOLEAN NOT NULL DEFAULT false,
  outcome_score DECIMAL(4,3),
  UNIQUE(test_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_axiom_ab_assignments_test ON axiom_ab_test_assignments(test_id);
CREATE INDEX IF NOT EXISTS idx_axiom_ab_assignments_session ON axiom_ab_test_assignments(session_id);

-- =============================================================================
-- Curator Integration Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS axiom_curator_feedback (
  feedback_id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  curator_user_id VARCHAR(64) NOT NULL,
  domain_id VARCHAR(128) NOT NULL,
  feedback_type VARCHAR(32) NOT NULL,  -- 'pattern_quality', 'domain_flag', 'taxonomy_suggestion'
  target_id VARCHAR(128),  -- pattern_id, question_id, or domain_id
  rating SMALLINT,  -- 1-5 quality rating
  notes TEXT,
  suggested_content TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'implemented'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_curator_feedback_tenant ON axiom_curator_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_curator_feedback_domain ON axiom_curator_feedback(domain_id);
CREATE INDEX IF NOT EXISTS idx_curator_feedback_status ON axiom_curator_feedback(status);
CREATE INDEX IF NOT EXISTS idx_curator_feedback_type ON axiom_curator_feedback(feedback_type);

-- =============================================================================
-- Curator-Promoted Patterns
-- =============================================================================

CREATE TABLE IF NOT EXISTS axiom_curator_patterns (
  id SERIAL PRIMARY KEY,
  pattern_id VARCHAR(64) NOT NULL REFERENCES axiom_prompt_patterns(pattern_id),
  curator_user_id VARCHAR(64) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL,
  validation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  validation_score DECIMAL(4,3),
  promoted_at TIMESTAMPTZ,
  weight_boost DECIMAL(3,2) DEFAULT 0.2,  -- Boost applied to pattern ranking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curator_patterns_pattern ON axiom_curator_patterns(pattern_id);
CREATE INDEX IF NOT EXISTS idx_curator_patterns_status ON axiom_curator_patterns(validation_status);

-- =============================================================================
-- Domain Attention Flags
-- =============================================================================

CREATE TABLE IF NOT EXISTS axiom_domain_flags (
  flag_id VARCHAR(64) PRIMARY KEY,
  domain_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(64),
  flag_type VARCHAR(32) NOT NULL,  -- 'needs_patterns', 'low_confidence', 'high_skip_rate', 'curator_flagged'
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',  -- 'low', 'medium', 'high', 'critical'
  description TEXT,
  auto_detected BOOLEAN NOT NULL DEFAULT true,
  flagged_by VARCHAR(64),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_domain_flags_domain ON axiom_domain_flags(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_flags_resolved ON axiom_domain_flags(resolved);
CREATE INDEX IF NOT EXISTS idx_domain_flags_severity ON axiom_domain_flags(severity);

-- =============================================================================
-- User Feedback Signals
-- =============================================================================

CREATE TABLE IF NOT EXISTS axiom_user_feedback (
  feedback_id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  feedback_type VARCHAR(32) NOT NULL,  -- 'rating', 'thumbs', 'correction', 'skip_reason'
  target_type VARCHAR(32) NOT NULL,  -- 'session', 'question', 'model', 'prompt'
  target_id VARCHAR(128) NOT NULL,
  value JSONB NOT NULL,  -- { rating: 5 } or { thumbs: 'up' } or { correction: '...' }
  context JSONB,  -- Additional context at time of feedback
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_session ON axiom_user_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_tenant ON axiom_user_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON axiom_user_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_target ON axiom_user_feedback(target_type, target_id);

-- =============================================================================
-- Question Cache Table (for offline/local caching support)
-- =============================================================================

CREATE TABLE IF NOT EXISTS axiom_question_cache (
  cache_id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  domain_id VARCHAR(128) NOT NULL,
  questions_json JSONB NOT NULL,
  question_count INTEGER NOT NULL,
  cache_version VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(tenant_id, domain_id)
);

CREATE INDEX IF NOT EXISTS idx_question_cache_tenant ON axiom_question_cache(tenant_id);
CREATE INDEX IF NOT EXISTS idx_question_cache_expires ON axiom_question_cache(expires_at);

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE axiom_ab_tests IS 'A/B test configurations for prompt variants';
COMMENT ON TABLE axiom_ab_test_assignments IS 'User assignments to A/B test variants';
COMMENT ON TABLE axiom_curator_feedback IS 'Feedback from Curator users on AXIOM content';
COMMENT ON TABLE axiom_curator_patterns IS 'Patterns promoted/validated by Curator';
COMMENT ON TABLE axiom_domain_flags IS 'Domains requiring attention (auto or manual flagged)';
COMMENT ON TABLE axiom_user_feedback IS 'End-user feedback signals for learning';
COMMENT ON TABLE axiom_question_cache IS 'Cached question trees for offline support';
