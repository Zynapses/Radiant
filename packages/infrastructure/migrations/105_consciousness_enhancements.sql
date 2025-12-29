-- RADIANT v4.18.19 - Consciousness Enhancements Migration
-- Adds vector embeddings for library RAG and memory consolidation tracking
-- Based on external AI evaluation improvements

-- ============================================================================
-- Enable pgvector extension if not already enabled
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- Library Vector Embeddings for Semantic Search
-- ============================================================================

-- Add embedding column to open_source_libraries for Vector RAG
ALTER TABLE open_source_libraries 
ADD COLUMN IF NOT EXISTS description_embedding vector(1536);

-- Create index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_libraries_embedding 
ON open_source_libraries 
USING ivfflat (description_embedding vector_cosine_ops)
WITH (lists = 100);

-- ============================================================================
-- Ego Working Memory Consolidation Tracking
-- ============================================================================

-- Add consolidated flag to track which memories have been summarized
ALTER TABLE ego_working_memory 
ADD COLUMN IF NOT EXISTS consolidated BOOLEAN DEFAULT false;

-- Index for efficient consolidation queries
CREATE INDEX IF NOT EXISTS idx_ego_working_memory_consolidated 
ON ego_working_memory (tenant_id, consolidated, created_at)
WHERE consolidated = false;

-- ============================================================================
-- Introspective Thoughts for Idle Thought Generation
-- ============================================================================

-- Ensure introspective_thoughts table has thought_type column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'introspective_thoughts' 
        AND column_name = 'thought_type'
    ) THEN
        ALTER TABLE introspective_thoughts ADD COLUMN thought_type VARCHAR(50) DEFAULT 'general';
    END IF;
END $$;

-- Index for thought type queries
CREATE INDEX IF NOT EXISTS idx_introspective_thoughts_type 
ON introspective_thoughts (tenant_id, thought_type, created_at DESC);

-- ============================================================================
-- Conscious Orchestrator Decision Logging
-- ============================================================================

CREATE TABLE IF NOT EXISTS conscious_orchestrator_decisions (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    session_id UUID,
    conversation_id UUID,
    
    -- Decision details
    action VARCHAR(20) NOT NULL, -- 'plan', 'clarify', 'defer', 'refuse'
    reason TEXT,
    
    -- Consciousness state at decision time
    dominant_emotion VARCHAR(50),
    emotional_intensity DECIMAL(3,2),
    cognitive_load DECIMAL(3,2),
    uncertainty_level DECIMAL(3,2),
    
    -- Hyperparameters determined by affect
    temperature DECIMAL(3,2),
    top_p DECIMAL(3,2),
    presence_penalty DECIMAL(3,2),
    frequency_penalty DECIMAL(3,2),
    model_tier VARCHAR(20),
    
    -- Request info
    prompt_length INTEGER,
    prompt_complexity VARCHAR(20),
    
    -- Plan reference (if action was 'plan')
    plan_id UUID,
    
    -- Prediction (if generated)
    prediction_id UUID,
    predicted_outcome VARCHAR(30),
    prediction_confidence DECIMAL(3,2),
    
    -- Timing
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for decision analysis
CREATE INDEX IF NOT EXISTS idx_conscious_decisions_tenant 
ON conscious_orchestrator_decisions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conscious_decisions_action 
ON conscious_orchestrator_decisions (tenant_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conscious_decisions_emotion 
ON conscious_orchestrator_decisions (tenant_id, dominant_emotion, created_at DESC);

-- ============================================================================
-- Semantic Memories for Consolidation
-- ============================================================================

-- Ensure semantic_memories has source column for consolidation tracking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'semantic_memories' 
        AND column_name = 'source'
    ) THEN
        ALTER TABLE semantic_memories ADD COLUMN source VARCHAR(50) DEFAULT 'unknown';
    END IF;
END $$;

-- Index for consolidation queries
CREATE INDEX IF NOT EXISTS idx_semantic_memories_source 
ON semantic_memories (tenant_id, source, created_at DESC);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS on new table
ALTER TABLE conscious_orchestrator_decisions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for tenant isolation
CREATE POLICY conscious_decisions_tenant_isolation ON conscious_orchestrator_decisions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================================
-- Function to record conscious orchestrator decision
-- ============================================================================

CREATE OR REPLACE FUNCTION record_conscious_decision(
    p_tenant_id UUID,
    p_user_id UUID,
    p_session_id UUID,
    p_conversation_id UUID,
    p_action VARCHAR(20),
    p_reason TEXT,
    p_dominant_emotion VARCHAR(50),
    p_emotional_intensity DECIMAL(3,2),
    p_cognitive_load DECIMAL(3,2),
    p_uncertainty_level DECIMAL(3,2),
    p_temperature DECIMAL(3,2),
    p_top_p DECIMAL(3,2),
    p_presence_penalty DECIMAL(3,2),
    p_frequency_penalty DECIMAL(3,2),
    p_model_tier VARCHAR(20),
    p_prompt_length INTEGER,
    p_prompt_complexity VARCHAR(20),
    p_plan_id UUID,
    p_prediction_id UUID,
    p_predicted_outcome VARCHAR(30),
    p_prediction_confidence DECIMAL(3,2),
    p_processing_time_ms INTEGER
) RETURNS UUID AS $$
DECLARE
    v_decision_id UUID;
BEGIN
    INSERT INTO conscious_orchestrator_decisions (
        tenant_id, user_id, session_id, conversation_id,
        action, reason,
        dominant_emotion, emotional_intensity, cognitive_load, uncertainty_level,
        temperature, top_p, presence_penalty, frequency_penalty, model_tier,
        prompt_length, prompt_complexity,
        plan_id, prediction_id, predicted_outcome, prediction_confidence,
        processing_time_ms
    ) VALUES (
        p_tenant_id, p_user_id, p_session_id, p_conversation_id,
        p_action, p_reason,
        p_dominant_emotion, p_emotional_intensity, p_cognitive_load, p_uncertainty_level,
        p_temperature, p_top_p, p_presence_penalty, p_frequency_penalty, p_model_tier,
        p_prompt_length, p_prompt_complexity,
        p_plan_id, p_prediction_id, p_predicted_outcome, p_prediction_confidence,
        p_processing_time_ms
    ) RETURNING decision_id INTO v_decision_id;
    
    RETURN v_decision_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Analytics view for consciousness decisions
-- ============================================================================

CREATE OR REPLACE VIEW conscious_decision_analytics AS
SELECT 
    tenant_id,
    DATE_TRUNC('day', created_at) as decision_date,
    action,
    COUNT(*) as decision_count,
    AVG(emotional_intensity) as avg_emotional_intensity,
    AVG(cognitive_load) as avg_cognitive_load,
    AVG(processing_time_ms) as avg_processing_time_ms,
    COUNT(CASE WHEN dominant_emotion = 'curious' THEN 1 END) as curious_count,
    COUNT(CASE WHEN dominant_emotion = 'frustrated' THEN 1 END) as frustrated_count,
    COUNT(CASE WHEN dominant_emotion = 'confident' THEN 1 END) as confident_count
FROM conscious_orchestrator_decisions
GROUP BY tenant_id, DATE_TRUNC('day', created_at), action;

COMMENT ON TABLE conscious_orchestrator_decisions IS 'Logs decisions made by the Conscious Orchestrator Service (architecture inversion)';
COMMENT ON COLUMN conscious_orchestrator_decisions.action IS 'Decision type: plan, clarify, defer, or refuse';
COMMENT ON COLUMN conscious_orchestrator_decisions.presence_penalty IS 'Affect-driven penalty for repeated topics (0-2)';
COMMENT ON COLUMN conscious_orchestrator_decisions.frequency_penalty IS 'Affect-driven penalty for repeated tokens (0-2)';
