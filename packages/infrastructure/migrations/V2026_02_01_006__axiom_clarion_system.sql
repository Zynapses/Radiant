-- AXIOM + CLARION Integrated Subsystem Schema
-- AXIOM: Adaptive eXpert Intelligence Optimization Module
-- CLARION: Context-aware Learning Adaptive Reasoning Interrogation ONtology
-- Version: 2.0.0
-- Date: 2026-02-01

-- =============================================================================
-- ENUMS
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE clarion_question_type AS ENUM ('choice', 'multi_select', 'text', 'scale', 'boolean');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE clarion_question_category AS ENUM ('intent', 'scope', 'constraints', 'format', 'context');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE clarion_session_status AS ENUM ('active', 'ready_to_compile', 'awaiting_clarification', 'completed', 'abandoned');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE axiom_pattern_type AS ENUM ('system_augment', 'user_augment', 'example', 'constraint', 'format');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE axiom_pattern_origin AS ENUM ('human_curated', 'evolved', 'invented', 'user_contributed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE axiom_compilation_status AS ENUM ('pending', 'compiling', 'ready', 'awaiting_clarification', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cato_evolution_type AS ENUM ('evolution', 'invention');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- [CLARION:TREE] Question Repository
-- =============================================================================

CREATE TABLE IF NOT EXISTS clarion_questions (
  question_id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64),  -- NULL for global questions
  domain_applicability JSONB NOT NULL DEFAULT '[]',
  question_type clarion_question_type NOT NULL,
  text_localized JSONB NOT NULL,  -- { "en": "...", "es": "...", ... }
  options_localized JSONB,  -- { "en": ["opt1", "opt2"], ... }
  branches JSONB,  -- Branching logic per answer
  priority DECIMAL(3,2) NOT NULL DEFAULT 0.50,
  information_gain DECIMAL(3,2) NOT NULL DEFAULT 0.50,
  category clarion_question_category NOT NULL DEFAULT 'context',
  requires_answers JSONB DEFAULT '[]',
  conflicts_with JSONB DEFAULT '[]',
  model_rules JSONB,  -- Model-specific skip/require rules
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_clarion_questions_tenant ON clarion_questions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clarion_questions_category ON clarion_questions(category);
CREATE INDEX IF NOT EXISTS idx_clarion_questions_domain ON clarion_questions USING GIN(domain_applicability);

-- =============================================================================
-- [CLARION:CORE] Session Management
-- =============================================================================

CREATE TABLE IF NOT EXISTS clarion_sessions (
  session_id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  chain_id VARCHAR(64),  -- Key Chain identity
  conversation_id VARCHAR(64),
  domain VARCHAR(128) NOT NULL,
  original_query TEXT NOT NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'en',
  status clarion_session_status NOT NULL DEFAULT 'active',
  current_confidence DECIMAL(4,3) NOT NULL DEFAULT 0.000,
  model_predictions JSONB NOT NULL DEFAULT '[]',
  working_context JSONB NOT NULL DEFAULT '{}',
  answers JSONB NOT NULL DEFAULT '{}',
  asked_questions JSONB NOT NULL DEFAULT '[]',
  skipped_questions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clarion_sessions_tenant ON clarion_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clarion_sessions_user ON clarion_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_clarion_sessions_status ON clarion_sessions(status);
CREATE INDEX IF NOT EXISTS idx_clarion_sessions_domain ON clarion_sessions(domain);
CREATE INDEX IF NOT EXISTS idx_clarion_sessions_created ON clarion_sessions(created_at DESC);

-- Enable RLS
ALTER TABLE clarion_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY clarion_sessions_tenant_isolation ON clarion_sessions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- =============================================================================
-- [CLARION:LEARN] Question Effectiveness Tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS clarion_question_effectiveness (
  id SERIAL PRIMARY KEY,
  question_id VARCHAR(64) NOT NULL REFERENCES clarion_questions(question_id),
  domain VARCHAR(128) NOT NULL,
  ask_count INTEGER NOT NULL DEFAULT 0,
  skip_count INTEGER NOT NULL DEFAULT 0,
  average_information_gain DECIMAL(4,3) NOT NULL DEFAULT 0.500,
  outcome_correlation DECIMAL(4,3) NOT NULL DEFAULT 0.000,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(question_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_clarion_effectiveness_domain ON clarion_question_effectiveness(domain);

-- =============================================================================
-- [AXIOM:DOMAIN] Domain Signatures
-- =============================================================================

CREATE TABLE IF NOT EXISTS axiom_domain_signatures (
  domain_id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(64),  -- NULL for global signatures
  domain_path JSONB NOT NULL,  -- ["legal", "contracts", "saas"]
  template JSONB NOT NULL,  -- { systemPrompt, userPromptPrefix, userPromptSuffix, slots }
  model_preferences JSONB NOT NULL DEFAULT '{}',
  version VARCHAR(16) NOT NULL DEFAULT '1.0.0',
  effectiveness_score DECIMAL(4,3) NOT NULL DEFAULT 0.500,
  usage_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_axiom_signatures_tenant ON axiom_domain_signatures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_axiom_signatures_path ON axiom_domain_signatures USING GIN(domain_path);

-- =============================================================================
-- [AXIOM:PATTERN] Prompt Patterns
-- =============================================================================

CREATE TABLE IF NOT EXISTS axiom_prompt_patterns (
  pattern_id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64),  -- NULL for global patterns
  domain_id VARCHAR(128) NOT NULL,
  pattern_type axiom_pattern_type NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),  -- pgvector for similarity search
  usage_count INTEGER NOT NULL DEFAULT 0,
  success_rate DECIMAL(4,3) NOT NULL DEFAULT 0.500,
  last_used TIMESTAMPTZ,
  origin axiom_pattern_origin NOT NULL DEFAULT 'human_curated',
  parent_patterns JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_axiom_patterns_tenant ON axiom_prompt_patterns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_axiom_patterns_domain ON axiom_prompt_patterns(domain_id);
CREATE INDEX IF NOT EXISTS idx_axiom_patterns_type ON axiom_prompt_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_axiom_patterns_origin ON axiom_prompt_patterns(origin);

-- Vector similarity index for pattern retrieval
CREATE INDEX IF NOT EXISTS idx_axiom_patterns_embedding ON axiom_prompt_patterns 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- [AXIOM:COMPILE] Compilation History
-- =============================================================================

CREATE TABLE IF NOT EXISTS axiom_compilations (
  compilation_id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL REFERENCES clarion_sessions(session_id),
  tenant_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  domain_id VARCHAR(128) NOT NULL,
  status axiom_compilation_status NOT NULL DEFAULT 'pending',
  compiled_prompt JSONB,
  model_selected JSONB,
  patterns_used JSONB DEFAULT '[]',
  compilation_version VARCHAR(16),
  token_count INTEGER,
  compilation_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_axiom_compilations_session ON axiom_compilations(session_id);
CREATE INDEX IF NOT EXISTS idx_axiom_compilations_tenant ON axiom_compilations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_axiom_compilations_domain ON axiom_compilations(domain_id);
CREATE INDEX IF NOT EXISTS idx_axiom_compilations_status ON axiom_compilations(status);

-- Enable RLS
ALTER TABLE axiom_compilations ENABLE ROW LEVEL SECURITY;

CREATE POLICY axiom_compilations_tenant_isolation ON axiom_compilations
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- =============================================================================
-- [AXIOM:VARIANT] Model Variant Rules
-- =============================================================================

CREATE TABLE IF NOT EXISTS axiom_model_variant_rules (
  model_id VARCHAR(64) PRIMARY KEY,
  prefers_structured BOOLEAN NOT NULL DEFAULT true,
  requires_explicit_format BOOLEAN NOT NULL DEFAULT false,
  max_context_tokens INTEGER NOT NULL DEFAULT 128000,
  temperature_default DECIMAL(3,2) NOT NULL DEFAULT 0.70,
  top_p_default DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  system_prompt_style VARCHAR(20) NOT NULL DEFAULT 'structured',
  preferred_output_format VARCHAR(20),
  custom_rules JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- [CATO:DREAM] Training Signals
-- =============================================================================

CREATE TABLE IF NOT EXISTS axiom_training_signals (
  signal_id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL REFERENCES clarion_sessions(session_id),
  tenant_id VARCHAR(64) NOT NULL,
  domain VARCHAR(128) NOT NULL,
  questions_asked JSONB NOT NULL,
  answers_given JSONB NOT NULL,
  compiled_prompt_hash VARCHAR(64) NOT NULL,
  model_used VARCHAR(64) NOT NULL,
  user_rating SMALLINT CHECK (user_rating >= 1 AND user_rating <= 5),
  outcome_quality DECIMAL(4,3),
  tokens_used INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by_cato BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_axiom_signals_tenant ON axiom_training_signals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_axiom_signals_domain ON axiom_training_signals(domain);
CREATE INDEX IF NOT EXISTS idx_axiom_signals_unprocessed ON axiom_training_signals(processed_by_cato) 
  WHERE processed_by_cato = false;
CREATE INDEX IF NOT EXISTS idx_axiom_signals_created ON axiom_training_signals(created_at DESC);

-- =============================================================================
-- [CATO:DREAM] Pattern Evolution History
-- =============================================================================

CREATE TABLE IF NOT EXISTS axiom_pattern_evolution (
  evolution_id VARCHAR(64) PRIMARY KEY,
  evolution_type cato_evolution_type NOT NULL,
  domain VARCHAR(128) NOT NULL,
  parent_patterns JSONB NOT NULL DEFAULT '[]',
  new_pattern_id VARCHAR(64) NOT NULL REFERENCES axiom_prompt_patterns(pattern_id),
  fitness_score DECIMAL(4,3) NOT NULL,
  invention_ratio DECIMAL(4,3) NOT NULL,
  cato_cycle_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_axiom_evolution_domain ON axiom_pattern_evolution(domain);
CREATE INDEX IF NOT EXISTS idx_axiom_evolution_type ON axiom_pattern_evolution(evolution_type);
CREATE INDEX IF NOT EXISTS idx_axiom_evolution_cycle ON axiom_pattern_evolution(cato_cycle_id);

-- =============================================================================
-- [IDENTITY:CHAIN] Key Chain for Identity Resolution
-- =============================================================================

CREATE TABLE IF NOT EXISTS axiom_key_chains (
  chain_id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64),
  user_id VARCHAR(64),
  user_type VARCHAR(20) NOT NULL DEFAULT 'anonymous',
  device_fingerprint VARCHAR(128),
  session_history JSONB NOT NULL DEFAULT '[]',
  learning_tier VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_axiom_chains_tenant ON axiom_key_chains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_axiom_chains_user ON axiom_key_chains(user_id);
CREATE INDEX IF NOT EXISTS idx_axiom_chains_device ON axiom_key_chains(device_fingerprint);

-- =============================================================================
-- [CORTEX:NEURAL] Neural Network Status (extend existing)
-- =============================================================================

-- Add AXIOM-specific networks to cortex_network_status if not exists
INSERT INTO cortex_network_status (network_id, version, status, requests_per_second, latency_p50_ms, latency_p99_ms, error_rate, last_updated, last_deployed_at, region)
SELECT 'domain', '1.0.0', 'active', 0, 10, 25, 0, NOW(), NOW(), 'us-east-1'
WHERE NOT EXISTS (SELECT 1 FROM cortex_network_status WHERE network_id = 'domain');

INSERT INTO cortex_network_status (network_id, version, status, requests_per_second, latency_p50_ms, latency_p99_ms, error_rate, last_updated, last_deployed_at, region)
SELECT 'variant', '1.0.0', 'active', 0, 8, 20, 0, NOW(), NOW(), 'us-east-1'
WHERE NOT EXISTS (SELECT 1 FROM cortex_network_status WHERE network_id = 'variant');

INSERT INTO cortex_network_status (network_id, version, status, requests_per_second, latency_p50_ms, latency_p99_ms, error_rate, last_updated, last_deployed_at, region)
SELECT 'model', '1.0.0', 'active', 0, 12, 30, 0, NOW(), NOW(), 'us-east-1'
WHERE NOT EXISTS (SELECT 1 FROM cortex_network_status WHERE network_id = 'model');

-- =============================================================================
-- [SERVICE:API] API Configuration
-- =============================================================================

CREATE TABLE IF NOT EXISTS axiom_config (
  tenant_id VARCHAR(64) PRIMARY KEY,
  max_questions INTEGER NOT NULL DEFAULT 5,
  confidence_threshold DECIMAL(4,3) NOT NULL DEFAULT 0.850,
  min_information_gain DECIMAL(4,3) NOT NULL DEFAULT 0.100,
  session_timeout_minutes INTEGER NOT NULL DEFAULT 30,
  max_patterns_retrieved INTEGER NOT NULL DEFAULT 5,
  min_pattern_score DECIMAL(4,3) NOT NULL DEFAULT 0.300,
  compilation_timeout_ms INTEGER NOT NULL DEFAULT 5000,
  variant_generation_count INTEGER NOT NULL DEFAULT 3,
  enable_neural_scoring BOOLEAN NOT NULL DEFAULT true,
  enable_cato_learning BOOLEAN NOT NULL DEFAULT true,
  custom_settings JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SEED DATA: Sample Global Questions
-- =============================================================================

INSERT INTO clarion_questions (
  question_id, domain_applicability, question_type, text_localized, 
  options_localized, priority, information_gain, category
) VALUES 
-- Intent questions
('q_intent_task_type', '["*"]', 'choice', 
 '{"en": "What type of task is this?", "es": "¿Qué tipo de tarea es esta?"}',
 '{"en": ["Create something new", "Analyze existing content", "Fix or improve something", "Learn or understand"]}',
 0.95, 0.80, 'intent'),

('q_intent_output_format', '["*"]', 'choice',
 '{"en": "What format should the response be in?", "es": "¿En qué formato debe estar la respuesta?"}',
 '{"en": ["Detailed explanation", "Step-by-step guide", "Code/technical output", "Summary/overview", "Let AI decide"]}',
 0.70, 0.60, 'format'),

-- Scope questions
('q_scope_complexity', '["*"]', 'scale',
 '{"en": "How complex is this task? (1=simple, 5=expert-level)", "es": "¿Qué tan complejo es esta tarea?"}',
 NULL, 0.80, 0.70, 'scope'),

('q_scope_depth', '["*"]', 'choice',
 '{"en": "How deep should the analysis go?", "es": "¿Qué tan profundo debe ser el análisis?"}',
 '{"en": ["Surface-level overview", "Moderate detail", "Comprehensive deep-dive", "Expert-level exhaustive"]}',
 0.75, 0.65, 'scope'),

-- Context questions  
('q_context_audience', '["*"]', 'choice',
 '{"en": "Who is the target audience?", "es": "¿Quién es el público objetivo?"}',
 '{"en": ["Beginner/non-technical", "Intermediate/general professional", "Expert/specialist", "Mixed audience"]}',
 0.65, 0.55, 'context'),

('q_context_urgency', '["*"]', 'choice',
 '{"en": "How urgent is this?", "es": "¿Qué tan urgente es esto?"}',
 '{"en": ["Not urgent - take time for quality", "Moderately urgent", "Very urgent - prioritize speed"]}',
 0.50, 0.40, 'constraints'),

-- Domain-specific: Legal
('q_legal_contract_type', '["legal", "legal.contracts"]', 'choice',
 '{"en": "What type of contract is this?", "es": "¿Qué tipo de contrato es este?"}',
 '{"en": ["Employment", "SaaS/Software", "NDA/Confidentiality", "Services", "Licensing", "Partnership", "Other"]}',
 0.90, 0.85, 'context'),

('q_legal_party_role', '["legal", "legal.contracts"]', 'choice',
 '{"en": "Are you the provider/seller or the customer/buyer?", "es": "¿Es usted el proveedor/vendedor o el cliente/comprador?"}',
 '{"en": ["Provider/Seller", "Customer/Buyer", "Neutral third party", "Not applicable"]}',
 0.85, 0.80, 'context'),

-- Domain-specific: Code
('q_code_language', '["technology", "technology.software"]', 'choice',
 '{"en": "What programming language?", "es": "¿Qué lenguaje de programación?"}',
 '{"en": ["JavaScript/TypeScript", "Python", "Java", "C#/.NET", "Go", "Rust", "Other", "Language-agnostic"]}',
 0.90, 0.85, 'context'),

('q_code_purpose', '["technology", "technology.software"]', 'choice',
 '{"en": "What is the purpose of this code?", "es": "¿Cuál es el propósito de este código?"}',
 '{"en": ["New feature development", "Bug fix", "Refactoring", "Code review", "Performance optimization", "Learning/example"]}',
 0.85, 0.75, 'intent')

ON CONFLICT (question_id) DO NOTHING;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE clarion_questions IS '[CLARION:TREE] Repository of adaptive questions for context gathering';
COMMENT ON TABLE clarion_sessions IS '[CLARION:CORE] Active questioning sessions with user answers and model predictions';
COMMENT ON TABLE clarion_question_effectiveness IS '[CLARION:LEARN] Tracks which questions lead to better outcomes';
COMMENT ON TABLE axiom_domain_signatures IS '[AXIOM:DOMAIN] Domain-specific prompt templates with slots';
COMMENT ON TABLE axiom_prompt_patterns IS '[AXIOM:PATTERN] Reusable prompt patterns with vector embeddings for retrieval';
COMMENT ON TABLE axiom_compilations IS '[AXIOM:COMPILE] History of prompt compilations for learning';
COMMENT ON TABLE axiom_model_variant_rules IS '[AXIOM:VARIANT] Model-specific formatting and optimization rules';
COMMENT ON TABLE axiom_training_signals IS '[CATO:DREAM] Training data for nightly CATO learning cycle';
COMMENT ON TABLE axiom_pattern_evolution IS '[CATO:DREAM] History of pattern evolution from CATO dreaming';
COMMENT ON TABLE axiom_key_chains IS '[IDENTITY:CHAIN] Cross-session identity for personalization';
COMMENT ON TABLE axiom_config IS '[SERVICE:API] Per-tenant AXIOM configuration';
