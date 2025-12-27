-- Migration: 045_cognitive_brain.sql
-- RADIANT v4.18.0 - Cognitive Brain System
-- Implements brain region routing, neural blueprints, and AGI-like cognitive mesh

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- BRAIN REGIONS - Specialized AI model mappings for cognitive functions
-- ============================================================================

CREATE TABLE IF NOT EXISTS brain_regions (
    region_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Region identity
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'brain',
    color VARCHAR(7) DEFAULT '#6366f1',
    
    -- Cognitive function mapping
    cognitive_function VARCHAR(100) NOT NULL, -- e.g., 'reasoning', 'memory', 'language_production'
    human_brain_analog VARCHAR(100), -- e.g., 'prefrontal_cortex', 'hippocampus'
    
    -- Model assignments (ordered by preference)
    primary_model_id VARCHAR(100) NOT NULL,
    fallback_model_ids TEXT[] DEFAULT '{}',
    
    -- Routing configuration
    activation_triggers JSONB DEFAULT '[]', -- conditions that activate this region
    input_transformers JSONB DEFAULT '[]', -- pre-processing steps
    output_transformers JSONB DEFAULT '[]', -- post-processing steps
    
    -- Performance tuning
    priority INTEGER DEFAULT 50, -- 1-100, higher = more important
    max_latency_ms INTEGER DEFAULT 5000,
    timeout_ms INTEGER DEFAULT 30000,
    retry_count INTEGER DEFAULT 2,
    
    -- Cost controls
    max_tokens_per_call INTEGER DEFAULT 4096,
    cost_multiplier DECIMAL(5,2) DEFAULT 1.00,
    
    -- Learning parameters
    learning_rate DECIMAL(5,4) DEFAULT 0.01,
    adaptation_enabled BOOLEAN DEFAULT true,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false, -- system regions can't be deleted
    
    -- Metrics
    total_activations BIGINT DEFAULT 0,
    successful_activations BIGINT DEFAULT 0,
    avg_latency_ms DECIMAL(10,2) DEFAULT 0,
    avg_satisfaction_score DECIMAL(3,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

-- Row-level security
ALTER TABLE brain_regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY brain_regions_tenant_isolation ON brain_regions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_brain_regions_tenant ON brain_regions(tenant_id);
CREATE INDEX idx_brain_regions_function ON brain_regions(cognitive_function);
CREATE INDEX idx_brain_regions_active ON brain_regions(is_active) WHERE is_active = true;

-- ============================================================================
-- COGNITIVE PATTERNS - Reusable thought patterns and decision trees
-- ============================================================================

CREATE TABLE IF NOT EXISTS cognitive_patterns (
    pattern_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Pattern identity
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'general',
    tags TEXT[] DEFAULT '{}',
    
    -- Trigger conditions
    trigger_type VARCHAR(50) NOT NULL, -- 'keyword', 'intent', 'sentiment', 'context', 'composite'
    trigger_conditions JSONB NOT NULL, -- detailed conditions for activation
    trigger_threshold DECIMAL(3,2) DEFAULT 0.7, -- confidence threshold
    
    -- Brain region orchestration
    region_sequence JSONB NOT NULL, -- ordered list of regions to activate
    execution_mode VARCHAR(20) DEFAULT 'sequential', -- 'sequential', 'parallel', 'adaptive'
    
    -- Context requirements
    required_context TEXT[] DEFAULT '{}', -- context keys that must be present
    context_window_size INTEGER DEFAULT 10, -- number of previous messages to consider
    
    -- Output configuration
    response_template TEXT, -- optional template for response formatting
    merge_strategy VARCHAR(50) DEFAULT 'concatenate', -- how to combine region outputs
    
    -- Semantic embedding for pattern matching
    semantic_embedding vector(1536),
    
    -- Learning and adaptation
    base_priority DECIMAL(5,2) DEFAULT 50.0,
    learned_priority_adjustment DECIMAL(5,2) DEFAULT 0.0,
    success_count BIGINT DEFAULT 0,
    failure_count BIGINT DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

ALTER TABLE cognitive_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY cognitive_patterns_tenant_isolation ON cognitive_patterns
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_cognitive_patterns_tenant ON cognitive_patterns(tenant_id);
CREATE INDEX idx_cognitive_patterns_category ON cognitive_patterns(category);
CREATE INDEX idx_cognitive_patterns_embedding ON cognitive_patterns 
    USING ivfflat (semantic_embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- NEURAL BLUEPRINTS - Complete cognitive configurations (importable/exportable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS neural_blueprints (
    blueprint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Blueprint identity
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    version VARCHAR(20) DEFAULT '1.0.0',
    description TEXT,
    author VARCHAR(200),
    
    -- Classification
    category VARCHAR(100) DEFAULT 'general',
    tags TEXT[] DEFAULT '{}',
    use_cases TEXT[] DEFAULT '{}',
    
    -- Full configuration (YAML/JSON stored as JSONB)
    configuration JSONB NOT NULL,
    
    -- Included components (for quick reference)
    included_regions TEXT[] DEFAULT '{}',
    included_patterns TEXT[] DEFAULT '{}',
    
    -- Default settings
    default_parameters JSONB DEFAULT '{}',
    
    -- Learning configuration
    learning_config JSONB DEFAULT '{
        "enabled": true,
        "learning_rate": 0.01,
        "memory_retention_days": 90,
        "preference_extraction": true,
        "behavior_tracking": true
    }',
    
    -- Sharing and marketplace
    is_public BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    marketplace_price_cents INTEGER, -- null = free
    download_count BIGINT DEFAULT 0,
    rating_sum BIGINT DEFAULT 0,
    rating_count BIGINT DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    
    -- Audit
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, slug, version)
);

ALTER TABLE neural_blueprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY neural_blueprints_tenant_isolation ON neural_blueprints
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID OR is_public = true);

CREATE INDEX idx_neural_blueprints_tenant ON neural_blueprints(tenant_id);
CREATE INDEX idx_neural_blueprints_public ON neural_blueprints(is_public) WHERE is_public = true;
CREATE INDEX idx_neural_blueprints_category ON neural_blueprints(category);

-- ============================================================================
-- WORKING MEMORY - Cross-region context buffer for active sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS cognitive_working_memory (
    memory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    -- Memory content
    memory_type VARCHAR(50) NOT NULL, -- 'context', 'intermediate', 'decision', 'output'
    source_region VARCHAR(100), -- which brain region produced this
    content JSONB NOT NULL,
    
    -- Attention and relevance
    attention_weight DECIMAL(5,4) DEFAULT 1.0, -- how relevant to current task
    decay_rate DECIMAL(5,4) DEFAULT 0.1, -- how fast attention decays
    
    -- Embedding for semantic retrieval
    embedding vector(1536),
    
    -- Lifecycle
    created_at TIMESTAMPTZ DEFAULT NOW(),
    accessed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour'
);

ALTER TABLE cognitive_working_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY cognitive_working_memory_tenant_isolation ON cognitive_working_memory
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_working_memory_session ON cognitive_working_memory(session_id);
CREATE INDEX idx_working_memory_expires ON cognitive_working_memory(expires_at);
CREATE INDEX idx_working_memory_embedding ON cognitive_working_memory 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- LONG-TERM LEARNING - Accumulated insights and adaptations
-- ============================================================================

CREATE TABLE IF NOT EXISTS cognitive_learned_insights (
    insight_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID, -- null = tenant-wide insight
    
    -- Insight classification
    insight_type VARCHAR(50) NOT NULL, -- 'preference', 'pattern', 'correction', 'optimization'
    category VARCHAR(100),
    
    -- Content
    title VARCHAR(500),
    content TEXT NOT NULL,
    evidence JSONB DEFAULT '[]', -- supporting examples
    
    -- Confidence and validation
    confidence DECIMAL(3,2) DEFAULT 0.5,
    validation_count INTEGER DEFAULT 0,
    contradiction_count INTEGER DEFAULT 0,
    
    -- Embedding
    embedding vector(1536),
    
    -- Application tracking
    times_applied BIGINT DEFAULT 0,
    last_applied_at TIMESTAMPTZ,
    effectiveness_score DECIMAL(3,2),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cognitive_learned_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY cognitive_learned_insights_tenant_isolation ON cognitive_learned_insights
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_learned_insights_tenant_user ON cognitive_learned_insights(tenant_id, user_id);
CREATE INDEX idx_learned_insights_type ON cognitive_learned_insights(insight_type);
CREATE INDEX idx_learned_insights_embedding ON cognitive_learned_insights 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- COGNITIVE SESSIONS - Track brain activity per conversation
-- ============================================================================

CREATE TABLE IF NOT EXISTS cognitive_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    conversation_id UUID,
    
    -- Active blueprint
    active_blueprint_id UUID REFERENCES neural_blueprints(blueprint_id),
    
    -- Session state
    state JSONB DEFAULT '{}',
    active_regions TEXT[] DEFAULT '{}',
    
    -- Performance metrics
    total_region_activations INTEGER DEFAULT 0,
    total_tokens_used BIGINT DEFAULT 0,
    total_cost_cents INTEGER DEFAULT 0,
    avg_response_time_ms DECIMAL(10,2),
    
    -- Quality metrics
    user_satisfaction_scores DECIMAL(3,2)[] DEFAULT '{}',
    
    -- Lifecycle
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

ALTER TABLE cognitive_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cognitive_sessions_tenant_isolation ON cognitive_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE INDEX idx_cognitive_sessions_user ON cognitive_sessions(tenant_id, user_id);
CREATE INDEX idx_cognitive_sessions_active ON cognitive_sessions(ended_at) WHERE ended_at IS NULL;

-- ============================================================================
-- REGION ACTIVATION LOG - Detailed tracking for learning
-- ============================================================================

CREATE TABLE IF NOT EXISTS region_activation_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    session_id UUID NOT NULL REFERENCES cognitive_sessions(session_id) ON DELETE CASCADE,
    
    -- Activation details
    region_id UUID NOT NULL REFERENCES brain_regions(region_id),
    pattern_id UUID REFERENCES cognitive_patterns(pattern_id),
    
    -- Input/Output
    input_hash VARCHAR(64), -- for deduplication
    input_tokens INTEGER,
    output_tokens INTEGER,
    
    -- Performance
    latency_ms INTEGER,
    model_used VARCHAR(100),
    
    -- Quality
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    user_feedback VARCHAR(20), -- 'positive', 'negative', 'neutral'
    
    -- Cost
    cost_cents INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partitioned by month for performance
CREATE INDEX idx_region_activation_log_session ON region_activation_log(session_id);
CREATE INDEX idx_region_activation_log_region ON region_activation_log(region_id);
CREATE INDEX idx_region_activation_log_created ON region_activation_log(created_at);

-- ============================================================================
-- COGNITIVE BRAIN SETTINGS - Tenant-level configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS cognitive_brain_settings (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Global toggles
    cognitive_brain_enabled BOOLEAN DEFAULT true,
    learning_enabled BOOLEAN DEFAULT true,
    adaptation_enabled BOOLEAN DEFAULT true,
    
    -- Default blueprint
    default_blueprint_id UUID REFERENCES neural_blueprints(blueprint_id),
    
    -- Performance limits
    max_concurrent_regions INTEGER DEFAULT 5,
    max_tokens_per_request INTEGER DEFAULT 16000,
    max_latency_ms INTEGER DEFAULT 10000,
    
    -- Cost controls
    daily_cost_limit_cents INTEGER DEFAULT 10000, -- $100 default
    monthly_cost_limit_cents INTEGER DEFAULT 100000, -- $1000 default
    
    -- Learning parameters
    global_learning_rate DECIMAL(5,4) DEFAULT 0.01,
    memory_retention_days INTEGER DEFAULT 90,
    insight_confidence_threshold DECIMAL(3,2) DEFAULT 0.7,
    
    -- Feature flags
    enable_metacognition BOOLEAN DEFAULT true,
    enable_theory_of_mind BOOLEAN DEFAULT true,
    enable_creative_synthesis BOOLEAN DEFAULT true,
    enable_self_correction BOOLEAN DEFAULT true,
    
    -- Advanced
    custom_system_prompt TEXT,
    region_overrides JSONB DEFAULT '{}',
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EXPANDED AI MODEL REGISTRY - Additional models for cognitive functions
-- ============================================================================

-- Insert new AI models for cognitive brain
INSERT INTO ai_models (model_id, provider, name, display_name, category, capabilities, context_window, input_cost_per_1k, output_cost_per_1k, is_active) VALUES
-- Reasoning specialists (Prefrontal Cortex)
('openai/o1', 'openai', 'o1', 'OpenAI o1', 'reasoning', '{"reasoning", "planning", "analysis", "math"}', 128000, 0.015, 0.060, true),
('openai/o1-mini', 'openai', 'o1-mini', 'OpenAI o1-mini', 'reasoning', '{"reasoning", "coding", "math"}', 128000, 0.003, 0.012, true),
('anthropic/claude-3-5-sonnet-20241022', 'anthropic', 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet (Oct 2024)', 'reasoning', '{"reasoning", "coding", "analysis", "vision"}', 200000, 0.003, 0.015, true),

-- Language production (Broca's Area)
('openai/gpt-4o', 'openai', 'gpt-4o', 'GPT-4o', 'language', '{"language", "conversation", "writing", "vision"}', 128000, 0.005, 0.015, true),
('openai/gpt-4o-mini', 'openai', 'gpt-4o-mini', 'GPT-4o Mini', 'language', '{"language", "conversation", "fast"}', 128000, 0.00015, 0.0006, true),

-- Vision processing (Visual Cortex)
('anthropic/claude-3-5-sonnet-vision', 'anthropic', 'claude-3-5-sonnet-vision', 'Claude 3.5 Sonnet Vision', 'vision', '{"vision", "image_analysis", "ocr"}', 200000, 0.003, 0.015, true),
('google/gemini-1.5-pro', 'google', 'gemini-1.5-pro', 'Gemini 1.5 Pro', 'multimodal', '{"vision", "video", "audio", "reasoning"}', 1000000, 0.00125, 0.005, true),
('google/gemini-1.5-flash', 'google', 'gemini-1.5-flash', 'Gemini 1.5 Flash', 'multimodal', '{"vision", "fast", "efficient"}', 1000000, 0.000075, 0.0003, true),

-- Code execution (Cerebellum - procedural)
('anthropic/claude-3-5-sonnet-code', 'anthropic', 'claude-3-5-sonnet-code', 'Claude 3.5 Sonnet (Code)', 'coding', '{"coding", "debugging", "refactoring"}', 200000, 0.003, 0.015, true),
('deepseek/deepseek-coder-v2', 'deepseek', 'deepseek-coder-v2', 'DeepSeek Coder V2', 'coding', '{"coding", "completion", "fast"}', 128000, 0.00014, 0.00028, true),
('codestral/codestral-latest', 'mistral', 'codestral-latest', 'Codestral', 'coding', '{"coding", "fill_in_middle", "fast"}', 32000, 0.001, 0.003, true),

-- Embedding/Memory (Hippocampus)
('openai/text-embedding-3-large', 'openai', 'text-embedding-3-large', 'Text Embedding 3 Large', 'embedding', '{"embedding", "semantic_search"}', 8191, 0.00013, 0, true),
('cohere/embed-english-v3.0', 'cohere', 'embed-english-v3.0', 'Cohere Embed v3', 'embedding', '{"embedding", "multilingual"}', 512, 0.0001, 0, true),

-- Sentiment/Emotional (Amygdala)
('openai/gpt-4o-mini-sentiment', 'openai', 'gpt-4o-mini', 'GPT-4o Mini (Sentiment)', 'sentiment', '{"sentiment", "emotion", "tone"}', 128000, 0.00015, 0.0006, true),

-- Fast/Efficient (Basal Ganglia - habits)
('groq/llama-3.1-70b-versatile', 'groq', 'llama-3.1-70b-versatile', 'Llama 3.1 70B (Groq)', 'fast', '{"fast", "efficient", "general"}', 131072, 0.00059, 0.00079, true),
('groq/llama-3.1-8b-instant', 'groq', 'llama-3.1-8b-instant', 'Llama 3.1 8B Instant (Groq)', 'fast', '{"fast", "instant", "lightweight"}', 131072, 0.00005, 0.00008, true),
('together/meta-llama-3.1-405b', 'together', 'meta-llama-3.1-405b', 'Llama 3.1 405B', 'reasoning', '{"reasoning", "large", "powerful"}', 131072, 0.005, 0.015, true),

-- Specialized providers
('perplexity/llama-3.1-sonar-large-128k-online', 'perplexity', 'llama-3.1-sonar-large-128k-online', 'Perplexity Sonar Large', 'search', '{"search", "realtime", "citations"}', 127072, 0.001, 0.001, true),
('xai/grok-beta', 'xai', 'grok-beta', 'Grok Beta', 'reasoning', '{"reasoning", "realtime", "humor"}', 131072, 0.005, 0.015, true)

ON CONFLICT (model_id) DO UPDATE SET
    capabilities = EXCLUDED.capabilities,
    context_window = EXCLUDED.context_window,
    input_cost_per_1k = EXCLUDED.input_cost_per_1k,
    output_cost_per_1k = EXCLUDED.output_cost_per_1k,
    is_active = EXCLUDED.is_active;

-- ============================================================================
-- DEFAULT BRAIN REGIONS - System defaults (cloned per tenant on first use)
-- ============================================================================

-- Note: These are inserted as system defaults. Actual tenant regions are created
-- when a tenant first enables the cognitive brain feature.

CREATE TABLE IF NOT EXISTS default_brain_regions (
    region_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(7),
    cognitive_function VARCHAR(100) NOT NULL,
    human_brain_analog VARCHAR(100),
    primary_model_id VARCHAR(100) NOT NULL,
    fallback_model_ids TEXT[] DEFAULT '{}',
    activation_triggers JSONB DEFAULT '[]',
    priority INTEGER DEFAULT 50,
    is_active BOOLEAN DEFAULT true
);

INSERT INTO default_brain_regions (name, slug, description, icon, color, cognitive_function, human_brain_analog, primary_model_id, fallback_model_ids, priority) VALUES
('Reasoning Engine', 'prefrontal', 'Complex reasoning, planning, and decision-making', 'lightbulb', '#8b5cf6', 'reasoning', 'prefrontal_cortex', 'anthropic/claude-3-5-sonnet-20241022', '{"openai/o1", "openai/gpt-4o"}', 90),
('Memory Center', 'hippocampus', 'Long-term memory storage and retrieval', 'database', '#06b6d4', 'memory', 'hippocampus', 'openai/text-embedding-3-large', '{"cohere/embed-english-v3.0"}', 85),
('Language Production', 'broca', 'Natural language generation and articulation', 'message-square', '#10b981', 'language_production', 'broca_area', 'openai/gpt-4o', '{"anthropic/claude-3-5-sonnet-20241022", "openai/gpt-4o-mini"}', 80),
('Language Comprehension', 'wernicke', 'Understanding and parsing natural language input', 'ear', '#3b82f6', 'language_comprehension', 'wernicke_area', 'openai/gpt-4o-mini', '{"groq/llama-3.1-70b-versatile"}', 75),
('Emotional Intelligence', 'amygdala', 'Sentiment analysis and emotional response calibration', 'heart', '#ef4444', 'emotion', 'amygdala', 'openai/gpt-4o-mini-sentiment', '{"openai/gpt-4o"}', 70),
('Visual Processing', 'visual-cortex', 'Image and video understanding', 'eye', '#f59e0b', 'vision', 'visual_cortex', 'anthropic/claude-3-5-sonnet-vision', '{"google/gemini-1.5-pro", "openai/gpt-4o"}', 75),
('Procedural Skills', 'cerebellum', 'Code execution, technical tasks, and learned procedures', 'code', '#ec4899', 'procedural', 'cerebellum', 'anthropic/claude-3-5-sonnet-code', '{"deepseek/deepseek-coder-v2", "codestral/codestral-latest"}', 80),
('Habit Engine', 'basal-ganglia', 'Quick responses, routine optimization, and pattern matching', 'zap', '#f97316', 'habits', 'basal_ganglia', 'groq/llama-3.1-8b-instant', '{"groq/llama-3.1-70b-versatile"}', 60),
('Knowledge Retrieval', 'search-cortex', 'Real-time information retrieval and fact-checking', 'search', '#6366f1', 'search', 'association_cortex', 'perplexity/llama-3.1-sonar-large-128k-online', '{}', 65),
('Creative Synthesis', 'creative-cortex', 'Novel idea generation and creative problem solving', 'sparkles', '#a855f7', 'creativity', 'default_mode_network', 'anthropic/claude-3-5-sonnet-20241022', '{"openai/gpt-4o"}', 70)

ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_cognitive_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brain_regions_updated
    BEFORE UPDATE ON brain_regions
    FOR EACH ROW EXECUTE FUNCTION update_cognitive_timestamp();

CREATE TRIGGER cognitive_patterns_updated
    BEFORE UPDATE ON cognitive_patterns
    FOR EACH ROW EXECUTE FUNCTION update_cognitive_timestamp();

CREATE TRIGGER neural_blueprints_updated
    BEFORE UPDATE ON neural_blueprints
    FOR EACH ROW EXECUTE FUNCTION update_cognitive_timestamp();

-- Function to initialize tenant brain regions from defaults
CREATE OR REPLACE FUNCTION initialize_tenant_brain_regions(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO brain_regions (
        tenant_id, name, slug, description, icon, color,
        cognitive_function, human_brain_analog,
        primary_model_id, fallback_model_ids,
        activation_triggers, priority, is_active, is_system
    )
    SELECT 
        p_tenant_id, name, slug, description, icon, color,
        cognitive_function, human_brain_analog,
        primary_model_id, fallback_model_ids,
        activation_triggers, priority, is_active, true
    FROM default_brain_regions
    ON CONFLICT (tenant_id, slug) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to decay working memory attention weights
CREATE OR REPLACE FUNCTION decay_working_memory()
RETURNS void AS $$
BEGIN
    UPDATE cognitive_working_memory
    SET attention_weight = attention_weight * (1 - decay_rate)
    WHERE expires_at > NOW();
    
    DELETE FROM cognitive_working_memory
    WHERE expires_at < NOW() OR attention_weight < 0.01;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE brain_regions IS 'Specialized AI model mappings that simulate human brain cognitive functions';
COMMENT ON TABLE cognitive_patterns IS 'Reusable thought patterns that orchestrate multiple brain regions';
COMMENT ON TABLE neural_blueprints IS 'Complete cognitive configurations that can be imported/exported';
COMMENT ON TABLE cognitive_working_memory IS 'Short-term context buffer for active cognitive sessions';
COMMENT ON TABLE cognitive_learned_insights IS 'Long-term accumulated learning from user interactions';
COMMENT ON TABLE cognitive_sessions IS 'Track cognitive brain activity per conversation';
COMMENT ON TABLE cognitive_brain_settings IS 'Tenant-level cognitive brain configuration';
