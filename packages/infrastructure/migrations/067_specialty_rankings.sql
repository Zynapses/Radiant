-- Migration 067: Specialty Rankings for AI Model Proficiency
-- AI-powered ranking system for model/mode specialty proficiency

-- Specialty rankings for models
CREATE TABLE IF NOT EXISTS specialty_rankings (
    ranking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    specialty TEXT NOT NULL,
    
    -- Scores (0-100)
    proficiency_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    benchmark_score DECIMAL(5,2) DEFAULT 0,
    community_score DECIMAL(5,2) DEFAULT 0,
    internal_score DECIMAL(5,2) DEFAULT 0,
    
    -- Ranking
    rank INTEGER DEFAULT 0,
    percentile DECIMAL(5,2) DEFAULT 0,
    tier TEXT CHECK (tier IN ('S', 'A', 'B', 'C', 'D', 'F')) DEFAULT 'C',
    
    -- Confidence and metadata
    confidence DECIMAL(3,2) DEFAULT 0.5,
    data_points INTEGER DEFAULT 0,
    last_researched TIMESTAMPTZ,
    research_sources JSONB DEFAULT '[]'::jsonb,
    
    -- Trend tracking
    trend TEXT CHECK (trend IN ('improving', 'stable', 'declining')) DEFAULT 'stable',
    previous_score DECIMAL(5,2),
    score_change DECIMAL(5,2),
    
    -- Admin controls
    admin_override DECIMAL(5,2),
    admin_notes TEXT,
    is_locked BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_model_specialty UNIQUE (model_id, specialty)
);

-- Mode rankings (domain, orchestration, persona modes)
CREATE TABLE IF NOT EXISTS mode_rankings (
    ranking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode_id TEXT NOT NULL,
    mode_name TEXT NOT NULL,
    mode_type TEXT CHECK (mode_type IN ('domain', 'orchestration', 'persona')) NOT NULL,
    specialty TEXT NOT NULL,
    
    -- Ranked models for this mode+specialty
    ranked_models JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Mode-specific tuning
    prompt_modifiers JSONB DEFAULT '[]'::jsonb,
    temperature_adjustment DECIMAL(3,2) DEFAULT 0.7,
    system_prompt_additions JSONB DEFAULT '[]'::jsonb,
    
    confidence DECIMAL(3,2) DEFAULT 0.5,
    last_researched TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_mode_specialty UNIQUE (mode_id, specialty)
);

-- Research history for rankings
CREATE TABLE IF NOT EXISTS ranking_research_history (
    research_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    research_type TEXT NOT NULL,
    target_model_id TEXT,
    target_specialty TEXT,
    
    models_researched INTEGER DEFAULT 0,
    specialties_updated INTEGER DEFAULT 0,
    rankings_changed INTEGER DEFAULT 0,
    
    ai_confidence DECIMAL(3,2),
    sources_used JSONB DEFAULT '[]'::jsonb,
    findings TEXT,
    
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_specialty_rankings_model ON specialty_rankings(model_id);
CREATE INDEX IF NOT EXISTS idx_specialty_rankings_specialty ON specialty_rankings(specialty);
CREATE INDEX IF NOT EXISTS idx_specialty_rankings_score ON specialty_rankings(specialty, proficiency_score DESC);
CREATE INDEX IF NOT EXISTS idx_specialty_rankings_tier ON specialty_rankings(specialty, tier);
CREATE INDEX IF NOT EXISTS idx_mode_rankings_mode ON mode_rankings(mode_id);
CREATE INDEX IF NOT EXISTS idx_mode_rankings_specialty ON mode_rankings(specialty);

-- Function to get best model for specialty (used by orchestration)
CREATE OR REPLACE FUNCTION get_best_model_for_specialty(
    p_specialty TEXT,
    p_exclude_models TEXT[] DEFAULT '{}',
    p_min_score DECIMAL DEFAULT 0
) RETURNS TABLE (
    model_id TEXT,
    provider TEXT,
    score DECIMAL,
    tier TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT sr.model_id, sr.provider, 
           COALESCE(sr.admin_override, sr.proficiency_score) as score,
           sr.tier
    FROM specialty_rankings sr
    JOIN model_metadata mm ON sr.model_id = mm.model_id
    WHERE sr.specialty = p_specialty
      AND mm.is_available = true
      AND sr.model_id != ALL(p_exclude_models)
      AND COALESCE(sr.admin_override, sr.proficiency_score) >= p_min_score
    ORDER BY COALESCE(sr.admin_override, sr.proficiency_score) DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get top N models for specialty
CREATE OR REPLACE FUNCTION get_specialty_leaderboard(
    p_specialty TEXT,
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    rank INTEGER,
    model_id TEXT,
    provider TEXT,
    model_name TEXT,
    score DECIMAL,
    tier TEXT,
    trend TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY COALESCE(sr.admin_override, sr.proficiency_score) DESC)::INTEGER as rank,
        sr.model_id,
        sr.provider,
        mm.model_name,
        COALESCE(sr.admin_override, sr.proficiency_score) as score,
        sr.tier,
        sr.trend
    FROM specialty_rankings sr
    JOIN model_metadata mm ON sr.model_id = mm.model_id
    WHERE sr.specialty = p_specialty
      AND mm.is_available = true
    ORDER BY COALESCE(sr.admin_override, sr.proficiency_score) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_ranking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_specialty_rankings_updated
    BEFORE UPDATE ON specialty_rankings
    FOR EACH ROW EXECUTE FUNCTION update_ranking_timestamp();

CREATE TRIGGER trg_mode_rankings_updated
    BEFORE UPDATE ON mode_rankings
    FOR EACH ROW EXECUTE FUNCTION update_ranking_timestamp();

-- Seed initial specialty categories (for reference)
COMMENT ON TABLE specialty_rankings IS 'Model proficiency rankings across specialties: reasoning, coding, math, creative, analysis, research, legal, medical, finance, science, debugging, architecture, security, vision, audio, conversation, instruction, speed, accuracy, safety';
