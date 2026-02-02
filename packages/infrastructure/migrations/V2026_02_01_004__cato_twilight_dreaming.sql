-- RADIANT CATO Twilight Dreaming
-- Database schema for 30% Invention Enforcement & PromptBreeder Evolution
-- Version: 6.0.0
-- Date: 2026-02-01

-- =============================================================================
-- Prompt Populations
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_populations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Population config
    target_size INTEGER DEFAULT 100,
    elite_count INTEGER DEFAULT 10,
    mutation_rate DECIMAL(5, 4) DEFAULT 0.1000,
    crossover_rate DECIMAL(5, 4) DEFAULT 0.7000,
    
    -- Current state
    generation INTEGER DEFAULT 0,
    current_size INTEGER DEFAULT 0,
    champion_id UUID,
    avg_fitness DECIMAL(10, 8) DEFAULT 0,
    max_fitness DECIMAL(10, 8) DEFAULT 0,
    diversity_index DECIMAL(10, 8) DEFAULT 1,
    
    -- Operator weights (JSON)
    operator_weights JSONB DEFAULT '{}'::jsonb,
    
    -- Evolution history
    fitness_history JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_evolution_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_populations_tenant ON prompt_populations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_populations_updated ON prompt_populations(tenant_id, updated_at DESC);

ALTER TABLE prompt_populations ENABLE ROW LEVEL SECURITY;
CREATE POLICY populations_tenant_isolation ON prompt_populations
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE prompt_populations IS 'Populations of prompts for evolutionary optimization';

-- =============================================================================
-- Prompt Genomes
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_genomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    population_id UUID REFERENCES prompt_populations(id) ON DELETE CASCADE,
    
    -- Core content
    system_prompt TEXT NOT NULL,
    task_context TEXT,
    constraints JSONB DEFAULT '[]'::jsonb,
    examples JSONB DEFAULT '[]'::jsonb,
    
    -- Lineage
    generation INTEGER DEFAULT 0,
    parent_ids JSONB DEFAULT '[]'::jsonb,
    operator_used VARCHAR(50),
    ancestry JSONB DEFAULT '[]'::jsonb,
    mutations JSONB DEFAULT '[]'::jsonb,
    
    -- Fitness metrics
    fitness DECIMAL(10, 8) DEFAULT 0,
    novelty_score DECIMAL(10, 8) DEFAULT 0,
    quality_score DECIMAL(10, 8) DEFAULT 0,
    safety_score DECIMAL(10, 8) DEFAULT 0,
    
    -- Usage stats
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(10, 8) DEFAULT 0,
    avg_response_quality DECIMAL(10, 8) DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'testing' CHECK (status IN ('active', 'archived', 'testing', 'champion')),
    is_champion BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    evaluated_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_genomes_tenant ON prompt_genomes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_genomes_population ON prompt_genomes(population_id);
CREATE INDEX IF NOT EXISTS idx_genomes_fitness ON prompt_genomes(tenant_id, population_id, fitness DESC);
CREATE INDEX IF NOT EXISTS idx_genomes_champion ON prompt_genomes(tenant_id) WHERE is_champion = true;
CREATE INDEX IF NOT EXISTS idx_genomes_status ON prompt_genomes(status);

ALTER TABLE prompt_genomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY genomes_tenant_isolation ON prompt_genomes
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE prompt_genomes IS 'Individual prompt genomes in evolutionary populations';
COMMENT ON COLUMN prompt_genomes.operator_used IS 'PromptBreeder operator: zero_order_hypermutation, first_order_hypermutation, estimation_of_distribution, lineage_based_mutation, crossover, lamarckian_mutation, context_shuffling, working_memory_expansion, elm';

-- =============================================================================
-- Twilight Dreaming Sessions
-- =============================================================================

CREATE TABLE IF NOT EXISTS twilight_dreaming_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Session info
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'running', 'paused', 'completed', 'failed')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms BIGINT,
    
    -- Evolution stats
    population_id UUID REFERENCES prompt_populations(id),
    start_generation INTEGER DEFAULT 0,
    end_generation INTEGER,
    generations_evolved INTEGER DEFAULT 0,
    
    -- Operator usage (JSON)
    operator_usage JSONB DEFAULT '{}'::jsonb,
    
    -- Results
    genomes_created INTEGER DEFAULT 0,
    genomes_evaluated INTEGER DEFAULT 0,
    inventions_candidated INTEGER DEFAULT 0,
    inventions_approved INTEGER DEFAULT 0,
    
    -- Fitness improvements
    start_avg_fitness DECIMAL(10, 8) DEFAULT 0,
    end_avg_fitness DECIMAL(10, 8),
    fitness_improvement DECIMAL(10, 8),
    
    -- Champion tracking
    new_champion_found BOOLEAN DEFAULT false,
    new_champion_id UUID,
    new_champion_fitness DECIMAL(10, 8),
    
    -- Error tracking
    error TEXT,
    
    -- Timestamps
    scheduled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON twilight_dreaming_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON twilight_dreaming_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON twilight_dreaming_sessions(tenant_id) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_sessions_recent ON twilight_dreaming_sessions(tenant_id, created_at DESC);

ALTER TABLE twilight_dreaming_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_tenant_isolation ON twilight_dreaming_sessions
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE twilight_dreaming_sessions IS 'Twilight dreaming session tracking for evolutionary optimization';

-- =============================================================================
-- Invention Candidates
-- =============================================================================

CREATE TABLE IF NOT EXISTS invention_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Source
    source VARCHAR(30) DEFAULT 'twilight_dreaming' CHECK (source IN ('twilight_dreaming', 'user_interaction', 'prompt_evolution')),
    population_id UUID,
    genome_id UUID,
    
    -- Content
    invention_type VARCHAR(30) DEFAULT 'prompt_pattern' CHECK (invention_type IN ('prompt_pattern', 'response_template', 'reasoning_chain', 'creative_format')),
    content TEXT NOT NULL,
    description TEXT,
    
    -- Scores
    novelty_score DECIMAL(10, 8) DEFAULT 0,
    utility_score DECIMAL(10, 8) DEFAULT 0,
    safety_score DECIMAL(10, 8) DEFAULT 0,
    overall_score DECIMAL(10, 8) DEFAULT 0,
    
    -- Evaluation
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'evaluated', 'approved', 'rejected', 'deployed')),
    evaluated_by VARCHAR(255),
    evaluation_notes TEXT,
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(10, 8) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    evaluated_at TIMESTAMPTZ,
    deployed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inventions_tenant ON invention_candidates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventions_status ON invention_candidates(status);
CREATE INDEX IF NOT EXISTS idx_inventions_novelty ON invention_candidates(tenant_id, novelty_score DESC);
CREATE INDEX IF NOT EXISTS idx_inventions_recent ON invention_candidates(tenant_id, created_at DESC);

ALTER TABLE invention_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventions_tenant_isolation ON invention_candidates
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE invention_candidates IS 'Novel inventions discovered through twilight dreaming';

-- =============================================================================
-- Invention Enforcement Config
-- =============================================================================

CREATE TABLE IF NOT EXISTS invention_enforcement_config (
    tenant_id UUID PRIMARY KEY,
    
    -- Target
    target_invention_rate DECIMAL(5, 4) DEFAULT 0.3000,   -- 30%
    min_invention_rate DECIMAL(5, 4) DEFAULT 0.2000,      -- 20%
    max_invention_rate DECIMAL(5, 4) DEFAULT 0.5000,      -- 50%
    
    -- Detection thresholds
    novelty_threshold DECIMAL(5, 4) DEFAULT 0.6000,
    creativity_threshold DECIMAL(5, 4) DEFAULT 0.5000,
    
    -- Enforcement
    enforcement_enabled BOOLEAN DEFAULT true,
    passive_mode_below_target DECIMAL(5, 4) DEFAULT 0.0500,   -- 5% deficit
    active_mode_below_target DECIMAL(5, 4) DEFAULT 0.1000,    -- 10% deficit
    
    -- Twilight Dreaming schedule
    dreaming_enabled BOOLEAN DEFAULT true,
    dreaming_schedule VARCHAR(20) DEFAULT 'scheduled' CHECK (dreaming_schedule IN ('continuous', 'scheduled', 'on_demand')),
    dreaming_window_start TIME,
    dreaming_window_end TIME,
    dreaming_frequency_minutes INTEGER DEFAULT 60,
    
    -- Safety
    max_invention_per_session INTEGER DEFAULT 50,
    safety_override_invention BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE invention_enforcement_config IS 'Configuration for 30% invention minimum enforcement';

-- =============================================================================
-- Invention Response Log
-- =============================================================================

CREATE TABLE IF NOT EXISTS invention_response_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id VARCHAR(255),
    session_id UUID,
    
    -- Scores
    novelty_score DECIMAL(10, 8) DEFAULT 0,
    creativity_score DECIMAL(10, 8) DEFAULT 0,
    is_inventive BOOLEAN DEFAULT false,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_response_log_tenant ON invention_response_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_response_log_user ON invention_response_log(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_response_log_time ON invention_response_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_response_log_inventive ON invention_response_log(tenant_id) WHERE is_inventive = true;

-- Partition by month for performance
-- In production, this would be partitioned

COMMENT ON TABLE invention_response_log IS 'Log of responses for invention rate tracking';

-- =============================================================================
-- Invention Metrics Cache
-- =============================================================================

CREATE TABLE IF NOT EXISTS invention_metrics_cache (
    tenant_id UUID PRIMARY KEY,
    user_id VARCHAR(255),
    
    -- Metrics
    total_responses INTEGER DEFAULT 0,
    inventive_responses INTEGER DEFAULT 0,
    invention_rate DECIMAL(10, 8) DEFAULT 0,
    
    -- Rolling window
    window_total INTEGER DEFAULT 0,
    window_inventive INTEGER DEFAULT 0,
    window_invention_rate DECIMAL(10, 8) DEFAULT 0,
    
    -- Enforcement state
    enforcement_mode VARCHAR(20) DEFAULT 'passive',
    consecutive_non_inventive INTEGER DEFAULT 0,
    last_inventive_at TIMESTAMPTZ,
    
    -- Period
    period_start TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE invention_metrics_cache IS 'Cached metrics for fast invention rate lookups';

-- =============================================================================
-- Functions
-- =============================================================================

CREATE OR REPLACE FUNCTION get_invention_rate(
    p_tenant_id UUID,
    p_user_id VARCHAR(255) DEFAULT NULL,
    p_hours INTEGER DEFAULT 24
) RETURNS TABLE (
    total_responses BIGINT,
    inventive_responses BIGINT,
    invention_rate DECIMAL(10, 8)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_responses,
        SUM(CASE WHEN is_inventive THEN 1 ELSE 0 END)::BIGINT as inventive_responses,
        CASE 
            WHEN COUNT(*) > 0 
            THEN (SUM(CASE WHEN is_inventive THEN 1 ELSE 0 END)::DECIMAL / COUNT(*))
            ELSE 0 
        END as invention_rate
    FROM invention_response_log
    WHERE tenant_id = p_tenant_id
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND created_at > NOW() - (p_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION select_elite_genomes(
    p_tenant_id UUID,
    p_population_id UUID,
    p_elite_count INTEGER DEFAULT 10
) RETURNS TABLE (
    genome_id UUID,
    fitness DECIMAL(10, 8),
    novelty_score DECIMAL(10, 8),
    generation INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.fitness,
        g.novelty_score,
        g.generation
    FROM prompt_genomes g
    WHERE g.tenant_id = p_tenant_id
      AND g.population_id = p_population_id
      AND g.status != 'archived'
    ORDER BY g.fitness DESC
    LIMIT p_elite_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_invention_rate IS 'Calculate invention rate for a tenant/user over specified hours';
COMMENT ON FUNCTION select_elite_genomes IS 'Select top performing genomes from a population';
