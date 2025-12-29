-- Migration: 087_cognitive_architecture.sql
-- Description: Cognitive Architecture - Tree of Thoughts, GraphRAG, Deep Research,
--              Dynamic LoRA, and Generative UI
-- Author: Radiant AI
-- Date: 2024-12-28

-- ============================================================================
-- PART 1: TREE OF THOUGHTS (System 2 Reasoning)
-- ============================================================================

CREATE TABLE IF NOT EXISTS reasoning_trees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID,
    
    -- Problem
    original_prompt TEXT NOT NULL,
    problem_type TEXT NOT NULL, -- math, logic, planning, code, analysis, general
    
    -- Tree data (JSONB for flexibility)
    tree_data JSONB NOT NULL,
    config JSONB NOT NULL,
    
    -- Statistics
    total_nodes INTEGER DEFAULT 1,
    max_depth INTEGER DEFAULT 0,
    branching_factor INTEGER DEFAULT 3,
    current_best_score DECIMAL(5, 4),
    explored_paths INTEGER DEFAULT 0,
    pruned_paths INTEGER DEFAULT 0,
    
    -- Time budget
    thinking_time_ms INTEGER NOT NULL,
    elapsed_time_ms INTEGER DEFAULT 0,
    
    -- Result
    final_answer TEXT,
    final_confidence DECIMAL(5, 4),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'thinking', -- thinking, complete, timeout, error
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_reasoning_trees_tenant ON reasoning_trees(tenant_id);
CREATE INDEX idx_reasoning_trees_user ON reasoning_trees(user_id);
CREATE INDEX idx_reasoning_trees_status ON reasoning_trees(status);
CREATE INDEX idx_reasoning_trees_problem_type ON reasoning_trees(problem_type);

-- ============================================================================
-- PART 2: GRAPHRAG (Knowledge Graph)
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Entity details
    type TEXT NOT NULL, -- person, organization, document, concept, event, etc.
    name TEXT NOT NULL,
    description TEXT,
    properties JSONB DEFAULT '{}',
    
    -- Source tracking
    source_document_ids TEXT[] DEFAULT '{}',
    
    -- Embedding for hybrid search
    embedding vector(1536),
    
    -- Quality
    confidence DECIMAL(5, 4) NOT NULL DEFAULT 0.8,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique per tenant + name (case insensitive)
    UNIQUE(tenant_id, LOWER(name))
);

CREATE INDEX idx_entities_tenant ON knowledge_entities(tenant_id);
CREATE INDEX idx_entities_type ON knowledge_entities(type);
CREATE INDEX idx_entities_name ON knowledge_entities(LOWER(name));
CREATE INDEX idx_entities_embedding ON knowledge_entities USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS knowledge_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Relationship
    source_entity_id UUID NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
    target_entity_id UUID NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- authored_by, depends_on, related_to, etc.
    description TEXT,
    
    -- Strength
    weight DECIMAL(5, 4) DEFAULT 0.5,
    
    -- Source tracking
    properties JSONB DEFAULT '{}',
    source_document_ids TEXT[] DEFAULT '{}',
    
    -- Quality
    confidence DECIMAL(5, 4) NOT NULL DEFAULT 0.8,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_relationships_tenant ON knowledge_relationships(tenant_id);
CREATE INDEX idx_relationships_source ON knowledge_relationships(source_entity_id);
CREATE INDEX idx_relationships_target ON knowledge_relationships(target_entity_id);
CREATE INDEX idx_relationships_type ON knowledge_relationships(type);

-- ============================================================================
-- PART 3: DEEP RESEARCH AGENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS research_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Query
    query TEXT NOT NULL,
    research_type TEXT NOT NULL, -- competitive_analysis, market_research, etc.
    scope TEXT NOT NULL DEFAULT 'medium', -- narrow, medium, broad
    
    -- Configuration
    config JSONB NOT NULL,
    
    -- Progress
    status TEXT NOT NULL DEFAULT 'queued', -- queued, running, paused, completed, failed, cancelled
    progress INTEGER DEFAULT 0,
    current_phase TEXT, -- planning, gathering, analyzing, synthesizing, reviewing
    
    -- Sources
    sources_found INTEGER DEFAULT 0,
    sources_processed INTEGER DEFAULT 0,
    sources JSONB DEFAULT '[]',
    
    -- Output
    briefing_document TEXT,
    executive_summary TEXT,
    key_findings TEXT[] DEFAULT '{}',
    recommendations TEXT[] DEFAULT '{}',
    
    -- Timing
    estimated_completion_ms INTEGER,
    actual_duration_ms INTEGER,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Notification
    notification_sent BOOLEAN DEFAULT false,
    notification_channel TEXT DEFAULT 'in_app'
);

CREATE INDEX idx_research_jobs_tenant ON research_jobs(tenant_id);
CREATE INDEX idx_research_jobs_user ON research_jobs(user_id);
CREATE INDEX idx_research_jobs_status ON research_jobs(status);
CREATE INDEX idx_research_jobs_queued ON research_jobs(queued_at DESC);

-- Job queue for async processing
CREATE TABLE IF NOT EXISTS job_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL,
    job_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    priority INTEGER DEFAULT 5,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_job_queue_status ON job_queue(status, priority DESC);
CREATE INDEX idx_job_queue_type ON job_queue(job_type);

-- ============================================================================
-- PART 4: DYNAMIC LORA SWAPPING
-- ============================================================================

CREATE TABLE IF NOT EXISTS lora_adapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = global
    
    -- Identification
    name TEXT NOT NULL,
    description TEXT,
    domain TEXT NOT NULL, -- legal, medical, financial, coding, etc.
    subdomain TEXT, -- e.g., california_property_law
    
    -- Storage
    s3_bucket TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    checksum TEXT NOT NULL,
    
    -- Compatibility
    base_model TEXT NOT NULL, -- e.g., llama-3-70b
    rank INTEGER NOT NULL, -- LoRA rank
    alpha DECIMAL(6, 2) NOT NULL, -- LoRA alpha
    target_modules TEXT[] NOT NULL, -- e.g., {q_proj, v_proj}
    
    -- Performance
    benchmark_score DECIMAL(5, 4),
    avg_latency_ms INTEGER,
    load_time_ms INTEGER,
    
    -- Usage
    times_loaded INTEGER DEFAULT 0,
    last_loaded_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lora_adapters_tenant ON lora_adapters(tenant_id);
CREATE INDEX idx_lora_adapters_domain ON lora_adapters(domain);
CREATE INDEX idx_lora_adapters_base_model ON lora_adapters(base_model);
CREATE INDEX idx_lora_adapters_active ON lora_adapters(is_active) WHERE is_active = true;

-- ============================================================================
-- PART 5: GENERATIVE UI
-- ============================================================================

CREATE TABLE IF NOT EXISTS generated_ui (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID,
    message_id UUID,
    
    -- Generation context
    prompt TEXT NOT NULL,
    generated_from TEXT NOT NULL, -- explicit_request, auto_detected, template
    
    -- Components
    components JSONB NOT NULL,
    layout TEXT NOT NULL DEFAULT 'single', -- single, grid, tabs, accordion
    
    -- Generation metadata
    generation_model TEXT NOT NULL,
    generation_time_ms INTEGER,
    
    -- User interaction
    interaction_count INTEGER DEFAULT 0,
    last_interacted_at TIMESTAMPTZ,
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_generated_ui_tenant ON generated_ui(tenant_id);
CREATE INDEX idx_generated_ui_user ON generated_ui(user_id);
CREATE INDEX idx_generated_ui_conversation ON generated_ui(conversation_id);

-- ============================================================================
-- COGNITIVE ARCHITECTURE CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS cognitive_architecture_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Feature configs (JSONB for flexibility)
    tree_of_thoughts JSONB DEFAULT '{
        "enabled": true,
        "maxDepth": 5,
        "branchingFactor": 3,
        "pruneThreshold": 0.3,
        "selectionStrategy": "beam",
        "beamWidth": 2,
        "scoringModel": "gpt-4o-mini",
        "generationModel": "gpt-4o",
        "defaultThinkingTimeMs": 30000,
        "maxThinkingTimeMs": 300000
    }',
    
    graph_rag JSONB DEFAULT '{
        "enabled": true,
        "extractionModel": "gpt-4o-mini",
        "maxEntitiesPerDocument": 50,
        "maxRelationshipsPerDocument": 100,
        "minConfidenceThreshold": 0.7,
        "enableHybridSearch": true,
        "graphWeight": 0.6,
        "vectorWeight": 0.4,
        "maxHops": 3
    }',
    
    deep_research JSONB DEFAULT '{
        "enabled": true,
        "maxSources": 50,
        "maxDepth": 2,
        "maxDurationMs": 1800000,
        "allowedSourceTypes": ["web", "pdf", "api"],
        "requireCredibleSources": true,
        "minSourceCredibility": 0.6,
        "parallelRequests": 5
    }',
    
    dynamic_lora JSONB DEFAULT '{
        "enabled": false,
        "registryBucket": "radiant-lora-adapters",
        "cacheSize": 5,
        "preloadDomains": ["coding", "legal"],
        "maxLoadTimeMs": 5000,
        "fallbackToBase": true,
        "autoSelectByDomain": true
    }',
    
    generative_ui JSONB DEFAULT '{
        "enabled": true,
        "generationModel": "gpt-4o",
        "allowedComponentTypes": ["chart", "table", "calculator", "comparison", "timeline"],
        "maxComponentsPerResponse": 3,
        "autoDetectOpportunities": true,
        "defaultTheme": "auto"
    }',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE reasoning_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE lora_adapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_ui ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognitive_architecture_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY reasoning_trees_tenant ON reasoning_trees
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY knowledge_entities_tenant ON knowledge_entities
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY knowledge_relationships_tenant ON knowledge_relationships
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY research_jobs_tenant ON research_jobs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY job_queue_all ON job_queue FOR ALL USING (true);

CREATE POLICY lora_adapters_tenant ON lora_adapters
    FOR ALL USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY generated_ui_tenant ON generated_ui
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY cognitive_config_tenant ON cognitive_architecture_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get cognitive architecture config
CREATE OR REPLACE FUNCTION get_cognitive_config(p_tenant_id UUID)
RETURNS cognitive_architecture_config AS $$
DECLARE
    v_config cognitive_architecture_config;
BEGIN
    SELECT * INTO v_config
    FROM cognitive_architecture_config
    WHERE tenant_id = p_tenant_id;
    
    IF NOT FOUND THEN
        -- Create default config
        INSERT INTO cognitive_architecture_config (tenant_id)
        VALUES (p_tenant_id)
        RETURNING * INTO v_config;
    END IF;
    
    RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update cognitive config
CREATE OR REPLACE FUNCTION update_cognitive_config(
    p_tenant_id UUID,
    p_tree_of_thoughts JSONB DEFAULT NULL,
    p_graph_rag JSONB DEFAULT NULL,
    p_deep_research JSONB DEFAULT NULL,
    p_dynamic_lora JSONB DEFAULT NULL,
    p_generative_ui JSONB DEFAULT NULL
)
RETURNS cognitive_architecture_config AS $$
DECLARE
    v_config cognitive_architecture_config;
BEGIN
    UPDATE cognitive_architecture_config
    SET 
        tree_of_thoughts = COALESCE(p_tree_of_thoughts, tree_of_thoughts),
        graph_rag = COALESCE(p_graph_rag, graph_rag),
        deep_research = COALESCE(p_deep_research, deep_research),
        dynamic_lora = COALESCE(p_dynamic_lora, dynamic_lora),
        generative_ui = COALESCE(p_generative_ui, generative_ui),
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
    RETURNING * INTO v_config;
    
    IF NOT FOUND THEN
        INSERT INTO cognitive_architecture_config (
            tenant_id, tree_of_thoughts, graph_rag, 
            deep_research, dynamic_lora, generative_ui
        ) VALUES (
            p_tenant_id, 
            COALESCE(p_tree_of_thoughts, cognitive_architecture_config.tree_of_thoughts),
            COALESCE(p_graph_rag, cognitive_architecture_config.graph_rag),
            COALESCE(p_deep_research, cognitive_architecture_config.deep_research),
            COALESCE(p_dynamic_lora, cognitive_architecture_config.dynamic_lora),
            COALESCE(p_generative_ui, cognitive_architecture_config.generative_ui)
        )
        RETURNING * INTO v_config;
    END IF;
    
    RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Graph traversal function
CREATE OR REPLACE FUNCTION traverse_knowledge_graph(
    p_tenant_id UUID,
    p_start_entity_ids UUID[],
    p_max_hops INTEGER DEFAULT 3,
    p_relationship_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    entity_id UUID,
    entity_name TEXT,
    entity_type TEXT,
    hop_distance INTEGER,
    path_weight DECIMAL
) AS $$
WITH RECURSIVE graph_walk AS (
    -- Start from seed entities
    SELECT 
        e.id as entity_id,
        e.name as entity_name,
        e.type as entity_type,
        0 as hop_distance,
        1.0::decimal as path_weight,
        ARRAY[e.id] as visited
    FROM knowledge_entities e
    WHERE e.tenant_id = p_tenant_id
      AND e.id = ANY(p_start_entity_ids)
    
    UNION ALL
    
    -- Walk relationships
    SELECT 
        CASE WHEN r.source_entity_id = gw.entity_id THEN r.target_entity_id ELSE r.source_entity_id END,
        e2.name,
        e2.type,
        gw.hop_distance + 1,
        gw.path_weight * r.weight,
        gw.visited || e2.id
    FROM graph_walk gw
    JOIN knowledge_relationships r ON (
        r.source_entity_id = gw.entity_id OR r.target_entity_id = gw.entity_id
    )
    JOIN knowledge_entities e2 ON (
        e2.id = CASE WHEN r.source_entity_id = gw.entity_id THEN r.target_entity_id ELSE r.source_entity_id END
    )
    WHERE gw.hop_distance < p_max_hops
      AND NOT (e2.id = ANY(gw.visited))
      AND e2.tenant_id = p_tenant_id
      AND (p_relationship_types IS NULL OR r.type = ANY(p_relationship_types))
)
SELECT DISTINCT ON (entity_id)
    entity_id,
    entity_name,
    entity_type,
    hop_distance,
    path_weight
FROM graph_walk
ORDER BY entity_id, hop_distance, path_weight DESC;
$$ LANGUAGE sql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_cognitive_config TO authenticated;
GRANT EXECUTE ON FUNCTION update_cognitive_config TO authenticated;
GRANT EXECUTE ON FUNCTION traverse_knowledge_graph TO authenticated;
