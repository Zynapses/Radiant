-- ============================================================================
-- The Crucible - Competitive Multi-LLM Deliberation System
-- ============================================================================
-- A novel orchestration primitive where multiple LLMs engage in competitive
-- cross-questioning to refine their answers before reporting to the method.
--
-- Key Features:
-- - Pre-prompt notification of evaluation criteria
-- - Iterative cross-questioning (up to 5 questions total by default)
-- - Competition-focused (not consensus)
-- - Provenance tracking to detect circular reasoning
-- - Full audit trail for learning and compliance
--
-- Version: 1.0.0
-- Since: v6.4.0
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Enums
-- ============================================================================

CREATE TYPE crucible_cost_mode AS ENUM ('economy', 'balanced', 'thorough');

CREATE TYPE crucible_model_type AS ENUM ('llm', 'vision', 'audio', 'embedding', 'other');

CREATE TYPE crucible_session_status AS ENUM (
    'initializing',
    'pre_prompting',
    'interrogating',
    'deliberating',
    'finalizing',
    'completed',
    'failed',
    'timeout'
);

CREATE TYPE crucible_question_type AS ENUM (
    'clarification',
    'challenge',
    'evidence',
    'reasoning',
    'edge_case',
    'contradiction'
);

CREATE TYPE crucible_question_quality AS ENUM ('low', 'medium', 'high', 'exceptional');

CREATE TYPE crucible_citation_source AS ENUM ('self', 'other_participant', 'external', 'unknown');

CREATE TYPE crucible_insight_type AS ENUM (
    'model_strength',
    'model_weakness',
    'question_pattern',
    'answer_pattern',
    'deliberation_dynamic'
);

-- ============================================================================
-- Configuration Table
-- ============================================================================

CREATE TABLE crucible_config (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    default_max_questions INTEGER NOT NULL DEFAULT 5,
    question_timeout_seconds INTEGER NOT NULL DEFAULT 30,
    session_timeout_seconds INTEGER NOT NULL DEFAULT 180,
    min_llms_for_crucible INTEGER NOT NULL DEFAULT 2,
    store_for_learning BOOLEAN NOT NULL DEFAULT TRUE,
    session_retention_days INTEGER NOT NULL DEFAULT 90,
    detect_circular_reasoning BOOLEAN NOT NULL DEFAULT TRUE,
    circular_citation_penalty DECIMAL(3,2) NOT NULL DEFAULT 0.15,
    score_question_quality BOOLEAN NOT NULL DEFAULT TRUE,
    cost_mode_question_limits JSONB NOT NULL DEFAULT '{"economy": 3, "balanced": 5, "thorough": 8}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Session Tables
-- ============================================================================

CREATE TABLE crucible_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pipeline_execution_id UUID NOT NULL,
    method_invocation_id UUID NOT NULL,
    method_name VARCHAR(255) NOT NULL,
    status crucible_session_status NOT NULL DEFAULT 'initializing',
    config JSONB NOT NULL,
    pre_prompt JSONB,
    total_questions_asked INTEGER NOT NULL DEFAULT 0,
    questions_remaining INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deliberation_started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    summary JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crucible_sessions_tenant ON crucible_sessions(tenant_id);
CREATE INDEX idx_crucible_sessions_status ON crucible_sessions(status);
CREATE INDEX idx_crucible_sessions_pipeline ON crucible_sessions(pipeline_execution_id);
CREATE INDEX idx_crucible_sessions_method ON crucible_sessions(method_invocation_id);
CREATE INDEX idx_crucible_sessions_started ON crucible_sessions(started_at DESC);

-- ============================================================================
-- Participant Table
-- ============================================================================

CREATE TABLE crucible_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES crucible_sessions(id) ON DELETE CASCADE,
    participant_id VARCHAR(64) NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    model_type crucible_model_type NOT NULL,
    can_deliberate BOOLEAN NOT NULL,
    model_mode VARCHAR(100),
    integrity_score DECIMAL(4,3),
    was_interrogated BOOLEAN NOT NULL DEFAULT FALSE,
    questions_remaining INTEGER NOT NULL,
    questions_asked INTEGER NOT NULL DEFAULT 0,
    questions_received INTEGER NOT NULL DEFAULT 0,
    score_adjustment DECIMAL(5,3) NOT NULL DEFAULT 0,
    circular_citations INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, participant_id)
);

CREATE INDEX idx_crucible_participants_session ON crucible_participants(session_id);
CREATE INDEX idx_crucible_participants_model ON crucible_participants(model_id);

-- ============================================================================
-- Question & Answer Tables
-- ============================================================================

CREATE TABLE crucible_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES crucible_sessions(id) ON DELETE CASCADE,
    asker_id VARCHAR(64) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    question_number INTEGER NOT NULL,
    question_type crucible_question_type NOT NULL,
    question_text TEXT NOT NULL,
    quality_score crucible_question_quality,
    is_iterative_refinement BOOLEAN NOT NULL DEFAULT FALSE,
    previous_question_id UUID REFERENCES crucible_questions(id),
    asked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crucible_questions_session ON crucible_questions(session_id);
CREATE INDEX idx_crucible_questions_asker ON crucible_questions(asker_id);
CREATE INDEX idx_crucible_questions_target ON crucible_questions(target_id);
CREATE INDEX idx_crucible_questions_asked_at ON crucible_questions(asked_at);

CREATE TABLE crucible_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES crucible_questions(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    circular_citation_detected BOOLEAN NOT NULL DEFAULT FALSE,
    circular_citation_details TEXT,
    latency_ms INTEGER NOT NULL,
    token_count INTEGER NOT NULL,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crucible_answers_question ON crucible_answers(question_id);

CREATE TABLE crucible_citations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    answer_id UUID NOT NULL REFERENCES crucible_answers(id) ON DELETE CASCADE,
    source_type crucible_citation_source NOT NULL,
    source_participant_id VARCHAR(64),
    citation_text TEXT NOT NULL,
    is_circular BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crucible_citations_answer ON crucible_citations(answer_id);
CREATE INDEX idx_crucible_citations_source ON crucible_citations(source_participant_id);

-- ============================================================================
-- Final Report Table
-- ============================================================================

CREATE TABLE crucible_final_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES crucible_sessions(id) ON DELETE CASCADE,
    participant_id VARCHAR(64) NOT NULL,
    refined_output TEXT NOT NULL,
    refinement_notes TEXT,
    confidence DECIMAL(4,3) NOT NULL,
    self_assessed_accuracy DECIMAL(4,3) NOT NULL,
    key_insights JSONB NOT NULL DEFAULT '[]',
    identified_weaknesses JSONB NOT NULL DEFAULT '[]',
    final_score DECIMAL(5,3),
    score_breakdown JSONB,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, participant_id)
);

CREATE INDEX idx_crucible_reports_session ON crucible_final_reports(session_id);
CREATE INDEX idx_crucible_reports_score ON crucible_final_reports(final_score DESC);

-- ============================================================================
-- Learning Insights Table
-- ============================================================================

CREATE TABLE crucible_learning_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID REFERENCES crucible_sessions(id) ON DELETE SET NULL,
    insight_type crucible_insight_type NOT NULL,
    model_id VARCHAR(255),
    description TEXT NOT NULL,
    confidence DECIMAL(4,3) NOT NULL,
    actionable BOOLEAN NOT NULL DEFAULT FALSE,
    applied BOOLEAN NOT NULL DEFAULT FALSE,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crucible_insights_tenant ON crucible_learning_insights(tenant_id);
CREATE INDEX idx_crucible_insights_model ON crucible_learning_insights(model_id);
CREATE INDEX idx_crucible_insights_type ON crucible_learning_insights(insight_type);
CREATE INDEX idx_crucible_insights_actionable ON crucible_learning_insights(actionable) WHERE actionable = TRUE;

-- ============================================================================
-- Model Performance Tracking
-- ============================================================================

CREATE TABLE crucible_model_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    sessions_participated INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    total_score DECIMAL(10,3) NOT NULL DEFAULT 0,
    total_questions_asked INTEGER NOT NULL DEFAULT 0,
    high_quality_questions INTEGER NOT NULL DEFAULT 0,
    circular_citations INTEGER NOT NULL DEFAULT 0,
    last_session_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, model_id)
);

CREATE INDEX idx_crucible_performance_tenant ON crucible_model_performance(tenant_id);
CREATE INDEX idx_crucible_performance_model ON crucible_model_performance(model_id);
CREATE INDEX idx_crucible_performance_wins ON crucible_model_performance(wins DESC);

-- ============================================================================
-- Audit Log
-- ============================================================================

CREATE TABLE crucible_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID REFERENCES crucible_sessions(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    actor_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crucible_audit_tenant ON crucible_audit_log(tenant_id);
CREATE INDEX idx_crucible_audit_session ON crucible_audit_log(session_id);
CREATE INDEX idx_crucible_audit_type ON crucible_audit_log(event_type);
CREATE INDEX idx_crucible_audit_created ON crucible_audit_log(created_at DESC);

-- Partition by month for audit log (for high-volume tenants)
-- Uncomment if needed:
-- CREATE TABLE crucible_audit_log_partitioned (
--     LIKE crucible_audit_log INCLUDING ALL
-- ) PARTITION BY RANGE (created_at);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE crucible_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE crucible_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crucible_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE crucible_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crucible_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE crucible_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE crucible_final_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE crucible_learning_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE crucible_model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE crucible_audit_log ENABLE ROW LEVEL SECURITY;

-- Config RLS
CREATE POLICY crucible_config_tenant_isolation ON crucible_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Sessions RLS
CREATE POLICY crucible_sessions_tenant_isolation ON crucible_sessions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Participants RLS (via session)
CREATE POLICY crucible_participants_tenant_isolation ON crucible_participants
    FOR ALL USING (
        session_id IN (
            SELECT id FROM crucible_sessions 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

-- Questions RLS (via session)
CREATE POLICY crucible_questions_tenant_isolation ON crucible_questions
    FOR ALL USING (
        session_id IN (
            SELECT id FROM crucible_sessions 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

-- Answers RLS (via question -> session)
CREATE POLICY crucible_answers_tenant_isolation ON crucible_answers
    FOR ALL USING (
        question_id IN (
            SELECT q.id FROM crucible_questions q
            JOIN crucible_sessions s ON q.session_id = s.id
            WHERE s.tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

-- Citations RLS (via answer -> question -> session)
CREATE POLICY crucible_citations_tenant_isolation ON crucible_citations
    FOR ALL USING (
        answer_id IN (
            SELECT a.id FROM crucible_answers a
            JOIN crucible_questions q ON a.question_id = q.id
            JOIN crucible_sessions s ON q.session_id = s.id
            WHERE s.tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

-- Final Reports RLS (via session)
CREATE POLICY crucible_reports_tenant_isolation ON crucible_final_reports
    FOR ALL USING (
        session_id IN (
            SELECT id FROM crucible_sessions 
            WHERE tenant_id = current_setting('app.current_tenant_id')::UUID
        )
    );

-- Learning Insights RLS
CREATE POLICY crucible_insights_tenant_isolation ON crucible_learning_insights
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Model Performance RLS
CREATE POLICY crucible_performance_tenant_isolation ON crucible_model_performance
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Audit Log RLS
CREATE POLICY crucible_audit_tenant_isolation ON crucible_audit_log
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to update session questions remaining
CREATE OR REPLACE FUNCTION update_crucible_session_questions()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE crucible_sessions
    SET 
        total_questions_asked = total_questions_asked + 1,
        questions_remaining = questions_remaining - 1,
        updated_at = NOW()
    WHERE id = NEW.session_id;
    
    -- Update participant questions asked
    UPDATE crucible_participants
    SET 
        questions_asked = questions_asked + 1,
        updated_at = NOW()
    WHERE session_id = NEW.session_id AND participant_id = NEW.asker_id;
    
    -- Update participant questions received
    UPDATE crucible_participants
    SET 
        questions_received = questions_received + 1,
        updated_at = NOW()
    WHERE session_id = NEW.session_id AND participant_id = NEW.target_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crucible_question_insert
AFTER INSERT ON crucible_questions
FOR EACH ROW EXECUTE FUNCTION update_crucible_session_questions();

-- Function to detect circular citations
CREATE OR REPLACE FUNCTION check_circular_citation()
RETURNS TRIGGER AS $$
DECLARE
    asker_participant_id VARCHAR(64);
    is_circular BOOLEAN := FALSE;
BEGIN
    -- Get the asker's participant ID for this answer's question
    SELECT q.asker_id INTO asker_participant_id
    FROM crucible_questions q
    WHERE q.id = NEW.question_id;
    
    -- Check if citing someone who previously cited the asker
    IF NEW.source_type = 'other_participant' AND NEW.source_participant_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 
            FROM crucible_citations c
            JOIN crucible_answers a ON c.answer_id = a.id
            JOIN crucible_questions q ON a.question_id = q.id
            WHERE c.source_participant_id = asker_participant_id
            AND q.asker_id = NEW.source_participant_id
            AND q.session_id = (
                SELECT session_id FROM crucible_questions WHERE id = NEW.question_id
            )
        ) INTO is_circular;
        
        IF is_circular THEN
            NEW.is_circular := TRUE;
            
            -- Update participant circular citation count
            UPDATE crucible_participants
            SET 
                circular_citations = circular_citations + 1,
                updated_at = NOW()
            WHERE session_id = (SELECT session_id FROM crucible_questions WHERE id = NEW.question_id)
            AND participant_id = (SELECT target_id FROM crucible_questions WHERE id = NEW.question_id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crucible_citation_check
BEFORE INSERT ON crucible_citations
FOR EACH ROW EXECUTE FUNCTION check_circular_citation();

-- Function to update model performance on session completion
CREATE OR REPLACE FUNCTION update_crucible_model_performance()
RETURNS TRIGGER AS $$
DECLARE
    winner_id VARCHAR(64);
    winner_model_id VARCHAR(255);
    participant RECORD;
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Find the winner (highest score)
        SELECT fr.participant_id, p.model_id INTO winner_id, winner_model_id
        FROM crucible_final_reports fr
        JOIN crucible_participants p ON fr.session_id = p.session_id AND fr.participant_id = p.participant_id
        WHERE fr.session_id = NEW.id
        ORDER BY fr.final_score DESC NULLS LAST
        LIMIT 1;
        
        -- Update performance for each LLM participant
        FOR participant IN
            SELECT p.*, fr.final_score
            FROM crucible_participants p
            LEFT JOIN crucible_final_reports fr ON p.session_id = fr.session_id AND p.participant_id = fr.participant_id
            WHERE p.session_id = NEW.id AND p.can_deliberate = TRUE
        LOOP
            INSERT INTO crucible_model_performance (
                tenant_id, model_id, model_name, sessions_participated, wins,
                total_score, total_questions_asked, high_quality_questions,
                circular_citations, last_session_at
            ) VALUES (
                NEW.tenant_id, participant.model_id, participant.model_name, 1,
                CASE WHEN participant.participant_id = winner_id THEN 1 ELSE 0 END,
                COALESCE(participant.final_score, 0),
                participant.questions_asked,
                (SELECT COUNT(*) FROM crucible_questions WHERE session_id = NEW.id AND asker_id = participant.participant_id AND quality_score IN ('high', 'exceptional')),
                participant.circular_citations,
                NOW()
            )
            ON CONFLICT (tenant_id, model_id) DO UPDATE SET
                sessions_participated = crucible_model_performance.sessions_participated + 1,
                wins = crucible_model_performance.wins + EXCLUDED.wins,
                total_score = crucible_model_performance.total_score + EXCLUDED.total_score,
                total_questions_asked = crucible_model_performance.total_questions_asked + EXCLUDED.total_questions_asked,
                high_quality_questions = crucible_model_performance.high_quality_questions + EXCLUDED.high_quality_questions,
                circular_citations = crucible_model_performance.circular_citations + EXCLUDED.circular_citations,
                last_session_at = NOW(),
                updated_at = NOW();
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crucible_session_complete
AFTER UPDATE ON crucible_sessions
FOR EACH ROW EXECUTE FUNCTION update_crucible_model_performance();

-- ============================================================================
-- Helper Views
-- ============================================================================

CREATE VIEW crucible_session_summary AS
SELECT 
    s.id AS session_id,
    s.tenant_id,
    s.method_name,
    s.status,
    s.total_questions_asked,
    s.started_at,
    s.completed_at,
    EXTRACT(EPOCH FROM (s.completed_at - s.started_at)) * 1000 AS duration_ms,
    COUNT(DISTINCT p.id) AS participant_count,
    COUNT(DISTINCT CASE WHEN p.can_deliberate THEN p.id END) AS llm_participant_count,
    (SELECT fr.participant_id FROM crucible_final_reports fr WHERE fr.session_id = s.id ORDER BY fr.final_score DESC NULLS LAST LIMIT 1) AS winner_id,
    MAX(fr.final_score) - MIN(fr.final_score) AS score_spread
FROM crucible_sessions s
LEFT JOIN crucible_participants p ON s.id = p.session_id
LEFT JOIN crucible_final_reports fr ON s.id = fr.session_id
GROUP BY s.id;

CREATE VIEW crucible_model_stats AS
SELECT 
    mp.tenant_id,
    mp.model_id,
    mp.model_name,
    mp.sessions_participated,
    mp.wins,
    CASE WHEN mp.sessions_participated > 0 
        THEN mp.wins::DECIMAL / mp.sessions_participated 
        ELSE 0 
    END AS win_rate,
    CASE WHEN mp.sessions_participated > 0 
        THEN mp.total_score / mp.sessions_participated 
        ELSE 0 
    END AS avg_score,
    CASE WHEN mp.total_questions_asked > 0 
        THEN mp.high_quality_questions::DECIMAL / mp.total_questions_asked 
        ELSE 0 
    END AS question_quality_rate,
    CASE WHEN mp.sessions_participated > 0 
        THEN mp.circular_citations::DECIMAL / mp.sessions_participated 
        ELSE 0 
    END AS circular_citation_rate,
    mp.last_session_at
FROM crucible_model_performance mp;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE crucible_config IS 'Per-tenant configuration for The Crucible deliberation system';
COMMENT ON TABLE crucible_sessions IS 'Crucible deliberation sessions between multiple LLMs';
COMMENT ON TABLE crucible_participants IS 'Participants in a Crucible session (LLMs and other models)';
COMMENT ON TABLE crucible_questions IS 'Questions asked during Crucible deliberation';
COMMENT ON TABLE crucible_answers IS 'Answers to Crucible questions';
COMMENT ON TABLE crucible_citations IS 'Citations in answers for provenance tracking';
COMMENT ON TABLE crucible_final_reports IS 'Final refined outputs from each participant';
COMMENT ON TABLE crucible_learning_insights IS 'Insights extracted from sessions for learning';
COMMENT ON TABLE crucible_model_performance IS 'Aggregated model performance in Crucible sessions';
COMMENT ON TABLE crucible_audit_log IS 'Audit trail for all Crucible events';

COMMENT ON VIEW crucible_session_summary IS 'Summary view of Crucible sessions with key metrics';
COMMENT ON VIEW crucible_model_stats IS 'Model statistics view with win rates and quality metrics';
