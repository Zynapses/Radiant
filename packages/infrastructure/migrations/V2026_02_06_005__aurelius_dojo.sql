-- ============================================================================
-- Aurelius Dojo v1.1.0 — Thematic Mastery Training Platform
-- Migration: V2026_02_06_005
-- ============================================================================

-- ── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE dojo_rank_tier AS ENUM ('novice', 'initiate', 'adept', 'master', 'radiant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dojo_library_status AS ENUM ('pending', 'ingesting', 'analyzing', 'ready', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dojo_document_status AS ENUM ('pending', 'chunked', 'embedded', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dojo_session_mode AS ENUM ('lecture', 'sparring', 'review');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dojo_session_status AS ENUM ('active', 'paused', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dojo_question_type AS ENUM ('multiple_choice', 'scenario', 'open_ended', 'true_false');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dojo_difficulty_tier AS ENUM ('fundamental', 'intermediate', 'advanced', 'expert');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dojo_persona_archetype AS ENUM (
    'confused_customer', 'angry_customer', 'detail_oriented', 'time_pressured',
    'price_sensitive', 'vip_escalation', 'compliance_auditor', 'new_employee', 'hostile_negotiator'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dojo_dialectic_role AS ENUM ('thesis', 'antithesis', 'synthesis', 'moderator', 'learner');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dojo_branch_quality AS ENUM ('optimal', 'acceptable', 'suboptimal', 'critical_error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dojo_archytas_tool AS ENUM (
    'code_execution', 'simulation', 'web_research', 'data_analysis', 'api_call', 'file_generation'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dojo_archytas_sandbox AS ENUM ('strict', 'standard', 'permissive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Core Tables ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dojo_libraries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  document_count  INTEGER NOT NULL DEFAULT 0,
  chunk_count     INTEGER NOT NULL DEFAULT 0,
  theme_count     INTEGER NOT NULL DEFAULT 0,
  status          dojo_library_status NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dojo_libraries_tenant ON dojo_libraries(tenant_id);
ALTER TABLE dojo_libraries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_libraries_tenant_isolation ON dojo_libraries;
CREATE POLICY dojo_libraries_tenant_isolation ON dojo_libraries
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE TABLE IF NOT EXISTS dojo_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id      UUID NOT NULL REFERENCES dojo_libraries(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL,
  filename        TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL DEFAULT 0,
  chunk_count     INTEGER NOT NULL DEFAULT 0,
  status          dojo_document_status NOT NULL DEFAULT 'pending',
  s3_key          TEXT,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dojo_documents_library ON dojo_documents(library_id);
CREATE INDEX IF NOT EXISTS idx_dojo_documents_tenant ON dojo_documents(tenant_id);
ALTER TABLE dojo_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_documents_tenant_isolation ON dojo_documents;
CREATE POLICY dojo_documents_tenant_isolation ON dojo_documents
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Themes ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dojo_themes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id          UUID NOT NULL REFERENCES dojo_libraries(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  icon                TEXT NOT NULL DEFAULT '📚',
  color               TEXT NOT NULL DEFAULT '#f59e0b',
  chunk_count         INTEGER NOT NULL DEFAULT 0,
  difficulty_tier     dojo_difficulty_tier NOT NULL DEFAULT 'fundamental',
  prerequisites       TEXT[] NOT NULL DEFAULT '{}',
  unlock_rank         dojo_rank_tier NOT NULL DEFAULT 'novice',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dojo_themes_library ON dojo_themes(library_id);
ALTER TABLE dojo_themes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_themes_tenant_isolation ON dojo_themes;
CREATE POLICY dojo_themes_tenant_isolation ON dojo_themes
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Training Sessions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dojo_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  user_id             UUID NOT NULL,
  library_id          UUID NOT NULL REFERENCES dojo_libraries(id),
  theme_ids           UUID[] NOT NULL DEFAULT '{}',
  mode                dojo_session_mode NOT NULL,
  status              dojo_session_status NOT NULL DEFAULT 'active',
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  xp_earned           INTEGER NOT NULL DEFAULT 0,
  questions_asked     INTEGER NOT NULL DEFAULT 0,
  questions_correct   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_dojo_sessions_tenant_user ON dojo_sessions(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_dojo_sessions_library ON dojo_sessions(library_id);
ALTER TABLE dojo_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_sessions_tenant_isolation ON dojo_sessions;
CREATE POLICY dojo_sessions_tenant_isolation ON dojo_sessions
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Lesson Blocks ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dojo_lesson_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES dojo_sessions(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL,
  theme_id        UUID NOT NULL REFERENCES dojo_themes(id),
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  source_citations JSONB NOT NULL DEFAULT '[]',
  difficulty      REAL NOT NULL DEFAULT 0.5,
  sequence        INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dojo_lesson_blocks_session ON dojo_lesson_blocks(session_id);
ALTER TABLE dojo_lesson_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_lesson_blocks_tenant_isolation ON dojo_lesson_blocks;
CREATE POLICY dojo_lesson_blocks_tenant_isolation ON dojo_lesson_blocks
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Sparring Questions & Results ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dojo_sparring_questions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES dojo_sessions(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL,
  theme_id            UUID NOT NULL REFERENCES dojo_themes(id),
  question_type       dojo_question_type NOT NULL,
  question            TEXT NOT NULL,
  context             TEXT,
  options             TEXT[],
  correct_answer      TEXT NOT NULL,
  explanation         TEXT NOT NULL DEFAULT '',
  difficulty          REAL NOT NULL DEFAULT 0.5,
  source_citations    JSONB NOT NULL DEFAULT '[]',
  time_limit_seconds  INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dojo_sparring_questions_session ON dojo_sparring_questions(session_id);
ALTER TABLE dojo_sparring_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_sparring_questions_tenant_isolation ON dojo_sparring_questions;
CREATE POLICY dojo_sparring_questions_tenant_isolation ON dojo_sparring_questions
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE TABLE IF NOT EXISTS dojo_sparring_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id         UUID NOT NULL REFERENCES dojo_sparring_questions(id) ON DELETE CASCADE,
  session_id          UUID NOT NULL REFERENCES dojo_sessions(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL,
  user_id             UUID NOT NULL,
  answer              TEXT NOT NULL,
  correct             BOOLEAN NOT NULL,
  partial_credit      REAL NOT NULL DEFAULT 0,
  reasoning_analysis  TEXT NOT NULL DEFAULT '',
  source_citations    JSONB NOT NULL DEFAULT '[]',
  xp_awarded          INTEGER NOT NULL DEFAULT 0,
  time_taken_seconds  REAL NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dojo_sparring_results_session ON dojo_sparring_results(session_id);
ALTER TABLE dojo_sparring_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_sparring_results_tenant_isolation ON dojo_sparring_results;
CREATE POLICY dojo_sparring_results_tenant_isolation ON dojo_sparring_results
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Progress & Rank ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dojo_user_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  user_id         UUID NOT NULL,
  overall_rank    dojo_rank_tier NOT NULL DEFAULT 'novice',
  overall_xp      INTEGER NOT NULL DEFAULT 0,
  total_sessions  INTEGER NOT NULL DEFAULT 0,
  total_time_minutes INTEGER NOT NULL DEFAULT 0,
  streak_days     INTEGER NOT NULL DEFAULT 0,
  last_session_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dojo_user_progress_tenant ON dojo_user_progress(tenant_id);
ALTER TABLE dojo_user_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_user_progress_tenant_isolation ON dojo_user_progress;
CREATE POLICY dojo_user_progress_tenant_isolation ON dojo_user_progress
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE TABLE IF NOT EXISTS dojo_theme_progress (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  user_id             UUID NOT NULL,
  theme_id            UUID NOT NULL REFERENCES dojo_themes(id) ON DELETE CASCADE,
  rank                dojo_rank_tier NOT NULL DEFAULT 'novice',
  xp                  INTEGER NOT NULL DEFAULT 0,
  mastery_percentage  REAL NOT NULL DEFAULT 0,
  questions_attempted INTEGER NOT NULL DEFAULT 0,
  questions_correct   INTEGER NOT NULL DEFAULT 0,
  last_session_at     TIMESTAMPTZ,
  weaknesses          TEXT[] NOT NULL DEFAULT '{}',
  strengths           TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, user_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_dojo_theme_progress_user ON dojo_theme_progress(tenant_id, user_id);
ALTER TABLE dojo_theme_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_theme_progress_tenant_isolation ON dojo_theme_progress;
CREATE POLICY dojo_theme_progress_tenant_isolation ON dojo_theme_progress
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Certifications ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dojo_certifications (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  user_id                 UUID NOT NULL,
  theme_id                UUID NOT NULL REFERENCES dojo_themes(id),
  rank_achieved           dojo_rank_tier NOT NULL,
  score                   REAL NOT NULL,
  max_score               REAL NOT NULL,
  passed                  BOOLEAN NOT NULL,
  proctored               BOOLEAN NOT NULL DEFAULT FALSE,
  exam_duration_minutes   INTEGER NOT NULL DEFAULT 30,
  issued_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dojo_certifications_user ON dojo_certifications(tenant_id, user_id);
ALTER TABLE dojo_certifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_certifications_tenant_isolation ON dojo_certifications;
CREATE POLICY dojo_certifications_tenant_isolation ON dojo_certifications
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Mobot Messages ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dojo_mobot_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES dojo_sessions(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('user', 'mobot')),
  content         TEXT NOT NULL,
  citations       JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dojo_mobot_messages_session ON dojo_mobot_messages(session_id);
ALTER TABLE dojo_mobot_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_mobot_messages_tenant_isolation ON dojo_mobot_messages;
CREATE POLICY dojo_mobot_messages_tenant_isolation ON dojo_mobot_messages
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Leapfrog 1: Ebbinghaus Decay Engine ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS dojo_knowledge_atoms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id        UUID NOT NULL REFERENCES dojo_themes(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL,
  concept         TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  source_citations JSONB NOT NULL DEFAULT '[]',
  difficulty      REAL NOT NULL DEFAULT 0.5,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dojo_atoms_theme ON dojo_knowledge_atoms(theme_id);
ALTER TABLE dojo_knowledge_atoms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_atoms_tenant_isolation ON dojo_knowledge_atoms;
CREATE POLICY dojo_atoms_tenant_isolation ON dojo_knowledge_atoms
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE TABLE IF NOT EXISTS dojo_decay_curves (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atom_id                 UUID NOT NULL REFERENCES dojo_knowledge_atoms(id) ON DELETE CASCADE,
  tenant_id               UUID NOT NULL,
  user_id                 UUID NOT NULL,
  half_life_hours         REAL NOT NULL DEFAULT 24.0,
  stability               REAL NOT NULL DEFAULT 0.5,
  last_reviewed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_review_at          TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  review_count            INTEGER NOT NULL DEFAULT 0,
  retention_probability   REAL NOT NULL DEFAULT 1.0,
  streak                  INTEGER NOT NULL DEFAULT 0,
  lapse_count             INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(atom_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dojo_decay_user ON dojo_decay_curves(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_dojo_decay_next_review ON dojo_decay_curves(next_review_at);
ALTER TABLE dojo_decay_curves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_decay_tenant_isolation ON dojo_decay_curves;
CREATE POLICY dojo_decay_tenant_isolation ON dojo_decay_curves
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Leapfrog 2: Adversarial Scenario Synthesis ──────────────────────────────

CREATE TABLE IF NOT EXISTS dojo_scenario_sessions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                  UUID NOT NULL REFERENCES dojo_sessions(id) ON DELETE CASCADE,
  tenant_id                   UUID NOT NULL,
  persona                     JSONB NOT NULL,
  theme_ids                   UUID[] NOT NULL DEFAULT '{}',
  situation                   TEXT NOT NULL,
  objective                   TEXT NOT NULL,
  status                      TEXT NOT NULL CHECK (status IN ('active', 'completed', 'failed')) DEFAULT 'active',
  emotional_intelligence_score REAL NOT NULL DEFAULT 0,
  policy_adherence_score      REAL NOT NULL DEFAULT 0,
  resolution_score            REAL NOT NULL DEFAULT 0,
  total_score                 REAL NOT NULL DEFAULT 0,
  debrief                     TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dojo_scenario_session ON dojo_scenario_sessions(session_id);
ALTER TABLE dojo_scenario_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_scenario_tenant_isolation ON dojo_scenario_sessions;
CREATE POLICY dojo_scenario_tenant_isolation ON dojo_scenario_sessions
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE TABLE IF NOT EXISTS dojo_scenario_branches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id     UUID NOT NULL REFERENCES dojo_scenario_sessions(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL,
  parent_id       UUID REFERENCES dojo_scenario_branches(id),
  turn_number     INTEGER NOT NULL DEFAULT 0,
  persona_message TEXT NOT NULL,
  learner_response TEXT,
  consequence     TEXT,
  emotional_shift TEXT,
  branch_quality  dojo_branch_quality,
  available_actions TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dojo_branches_scenario ON dojo_scenario_branches(scenario_id);
ALTER TABLE dojo_scenario_branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_branches_tenant_isolation ON dojo_scenario_branches;
CREATE POLICY dojo_branches_tenant_isolation ON dojo_scenario_branches
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Leapfrog 3: Predictive Competency Mesh ──────────────────────────────────

CREATE TABLE IF NOT EXISTS dojo_competencies (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id                  UUID NOT NULL REFERENCES dojo_libraries(id) ON DELETE CASCADE,
  tenant_id                   UUID NOT NULL,
  name                        TEXT NOT NULL,
  description                 TEXT NOT NULL DEFAULT '',
  category                    TEXT NOT NULL DEFAULT 'general',
  related_themes              UUID[] NOT NULL DEFAULT '{}',
  prerequisite_competencies   UUID[] NOT NULL DEFAULT '{}',
  proficiency_levels          JSONB NOT NULL DEFAULT '[]',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dojo_competencies_library ON dojo_competencies(library_id);
ALTER TABLE dojo_competencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_competencies_tenant_isolation ON dojo_competencies;
CREATE POLICY dojo_competencies_tenant_isolation ON dojo_competencies
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE TABLE IF NOT EXISTS dojo_user_competency_scores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  user_id             UUID NOT NULL,
  competency_id       UUID NOT NULL REFERENCES dojo_competencies(id) ON DELETE CASCADE,
  current_level       INTEGER NOT NULL DEFAULT 0,
  max_level           INTEGER NOT NULL DEFAULT 5,
  confidence          REAL NOT NULL DEFAULT 0,
  evidence_count      INTEGER NOT NULL DEFAULT 0,
  last_assessed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trend               TEXT NOT NULL CHECK (trend IN ('improving', 'stable', 'declining')) DEFAULT 'stable',
  gap_to_target       REAL NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, user_id, competency_id)
);

CREATE INDEX IF NOT EXISTS idx_dojo_competency_scores_user ON dojo_user_competency_scores(tenant_id, user_id);
ALTER TABLE dojo_user_competency_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_competency_scores_tenant_isolation ON dojo_user_competency_scores;
CREATE POLICY dojo_competency_scores_tenant_isolation ON dojo_user_competency_scores
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Leapfrog 4: Socratic Dialectic Engine ───────────────────────────────────

CREATE TABLE IF NOT EXISTS dojo_dialectic_sessions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                  UUID NOT NULL REFERENCES dojo_sessions(id) ON DELETE CASCADE,
  tenant_id                   UUID NOT NULL,
  theme_id                    UUID NOT NULL REFERENCES dojo_themes(id),
  proposition                 TEXT NOT NULL,
  context                     TEXT NOT NULL DEFAULT '',
  status                      TEXT NOT NULL CHECK (status IN ('active', 'concluded')) DEFAULT 'active',
  learner_position            TEXT,
  reasoning_chain_score       REAL NOT NULL DEFAULT 0,
  argument_quality_score      REAL NOT NULL DEFAULT 0,
  evidence_usage_score        REAL NOT NULL DEFAULT 0,
  critical_thinking_score     REAL NOT NULL DEFAULT 0,
  logical_fallacies_detected  TEXT[] NOT NULL DEFAULT '{}',
  synthesis_quality           TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dojo_dialectic_session ON dojo_dialectic_sessions(session_id);
ALTER TABLE dojo_dialectic_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_dialectic_tenant_isolation ON dojo_dialectic_sessions;
CREATE POLICY dojo_dialectic_tenant_isolation ON dojo_dialectic_sessions
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE TABLE IF NOT EXISTS dojo_dialectic_turns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dialectic_id        UUID NOT NULL REFERENCES dojo_dialectic_sessions(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL,
  role                dojo_dialectic_role NOT NULL,
  content             TEXT NOT NULL,
  reasoning_type      TEXT NOT NULL CHECK (reasoning_type IN ('claim', 'evidence', 'rebuttal', 'concession', 'synthesis', 'question')),
  citations           JSONB NOT NULL DEFAULT '[]',
  quality_score       REAL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dojo_dialectic_turns ON dojo_dialectic_turns(dialectic_id);
ALTER TABLE dojo_dialectic_turns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_dialectic_turns_tenant_isolation ON dojo_dialectic_turns;
CREATE POLICY dojo_dialectic_turns_tenant_isolation ON dojo_dialectic_turns
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Leapfrog 5: Multimodal Content ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dojo_multimodal_content (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id                   UUID NOT NULL REFERENCES dojo_lesson_blocks(id) ON DELETE CASCADE,
  tenant_id                   UUID NOT NULL,
  audio_url                   TEXT,
  audio_duration_seconds      INTEGER,
  diagrams                    JSONB NOT NULL DEFAULT '[]',
  glossary                    JSONB NOT NULL DEFAULT '[]',
  key_takeaways               TEXT[] NOT NULL DEFAULT '{}',
  learning_style_adaptations  JSONB NOT NULL DEFAULT '{}',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dojo_multimodal_lesson ON dojo_multimodal_content(lesson_id);
ALTER TABLE dojo_multimodal_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_multimodal_tenant_isolation ON dojo_multimodal_content;
CREATE POLICY dojo_multimodal_tenant_isolation ON dojo_multimodal_content
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Leapfrog 6: Organizational Knowledge Pulse ──────────────────────────────

CREATE TABLE IF NOT EXISTS dojo_knowledge_pulse (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  snapshot_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  overall_health      REAL NOT NULL DEFAULT 0,
  total_users         INTEGER NOT NULL DEFAULT 0,
  active_users_30d    INTEGER NOT NULL DEFAULT 0,
  department_health   JSONB NOT NULL DEFAULT '[]',
  theme_coverage      JSONB NOT NULL DEFAULT '[]',
  decay_alerts        JSONB NOT NULL DEFAULT '[]',
  trends              JSONB NOT NULL DEFAULT '{}',
  roi_metrics         JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_dojo_pulse_tenant ON dojo_knowledge_pulse(tenant_id, snapshot_at DESC);
ALTER TABLE dojo_knowledge_pulse ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_pulse_tenant_isolation ON dojo_knowledge_pulse;
CREATE POLICY dojo_pulse_tenant_isolation ON dojo_knowledge_pulse
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Archytas Tool Calls ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dojo_archytas_tool_calls (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES dojo_sessions(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL,
  tool_type           dojo_archytas_tool NOT NULL,
  input               TEXT NOT NULL,
  output              TEXT,
  status              TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout')) DEFAULT 'pending',
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  execution_time_ms   INTEGER,
  error               TEXT,
  sandbox_id          TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dojo_archytas_session ON dojo_archytas_tool_calls(session_id);
ALTER TABLE dojo_archytas_tool_calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_archytas_tenant_isolation ON dojo_archytas_tool_calls;
CREATE POLICY dojo_archytas_tenant_isolation ON dojo_archytas_tool_calls
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Configuration ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dojo_config (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL UNIQUE,
  enabled                     BOOLEAN NOT NULL DEFAULT TRUE,
  ai_model                    TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  embedding_model             TEXT NOT NULL DEFAULT 'text-embedding-3-large',
  max_themes_per_library      INTEGER NOT NULL DEFAULT 15,
  sparring_difficulty_scaling  BOOLEAN NOT NULL DEFAULT TRUE,
  certification_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  min_sessions_for_cert       INTEGER NOT NULL DEFAULT 5,
  rank_thresholds             JSONB NOT NULL DEFAULT '{"novice": 0, "initiate": 500, "adept": 2000, "master": 5000, "radiant": 10000}',
  archytas_enabled            BOOLEAN NOT NULL DEFAULT FALSE,
  archytas_config             JSONB,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dojo_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dojo_config_tenant_isolation ON dojo_config;
CREATE POLICY dojo_config_tenant_isolation ON dojo_config
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Helper Functions ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION dojo_calculate_retention(
  p_half_life_hours REAL,
  p_hours_since_review REAL
) RETURNS REAL AS $$
BEGIN
  RETURN POWER(2, -p_hours_since_review / GREATEST(p_half_life_hours, 0.1));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION dojo_xp_to_rank(p_xp INTEGER) RETURNS dojo_rank_tier AS $$
BEGIN
  IF p_xp >= 10000 THEN RETURN 'radiant';
  ELSIF p_xp >= 5000 THEN RETURN 'master';
  ELSIF p_xp >= 2000 THEN RETURN 'adept';
  ELSIF p_xp >= 500 THEN RETURN 'initiate';
  ELSE RETURN 'novice';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION dojo_update_decay_after_review(
  p_curve_id UUID,
  p_correct BOOLEAN
) RETURNS VOID AS $$
DECLARE
  v_half_life REAL;
  v_streak INTEGER;
  v_lapse INTEGER;
BEGIN
  SELECT half_life_hours, streak, lapse_count
  INTO v_half_life, v_streak, v_lapse
  FROM dojo_decay_curves WHERE id = p_curve_id;

  IF p_correct THEN
    v_half_life := v_half_life * (1.0 + 0.1 * (v_streak + 1));
    v_streak := v_streak + 1;
  ELSE
    v_half_life := GREATEST(v_half_life * 0.5, 1.0);
    v_streak := 0;
    v_lapse := v_lapse + 1;
  END IF;

  UPDATE dojo_decay_curves SET
    half_life_hours = v_half_life,
    stability = LEAST(v_half_life / 720.0, 1.0),
    streak = v_streak,
    lapse_count = v_lapse,
    review_count = review_count + 1,
    last_reviewed_at = NOW(),
    next_review_at = NOW() + (v_half_life * INTERVAL '1 hour'),
    retention_probability = 1.0,
    updated_at = NOW()
  WHERE id = p_curve_id;
END;
$$ LANGUAGE plpgsql;
