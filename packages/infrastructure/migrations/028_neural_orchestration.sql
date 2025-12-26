-- RADIANT v4.17.0 - Migration 028: Neural Orchestration
-- Orchestration patterns and production workflows for Think Tank

CREATE TABLE orchestration_pattern_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    pattern_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orchestration_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pattern_id VARCHAR(100) UNIQUE NOT NULL,
    category_id VARCHAR(50) NOT NULL REFERENCES orchestration_pattern_categories(category_id),
    
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    research_basis TEXT,
    
    complexity VARCHAR(20) NOT NULL CHECK (complexity IN ('low', 'medium', 'high', 'very_high')),
    impact VARCHAR(20) NOT NULL CHECK (impact IN ('low', 'medium', 'high', 'transformative')),
    implemented_by TEXT[],
    implementation_status VARCHAR(30) DEFAULT 'planned',
    
    semantic_embedding vector(768),
    
    execution_type VARCHAR(20) DEFAULT 'serial' CHECK (execution_type IN ('serial', 'parallel', 'hybrid')),
    parallelizable BOOLEAN DEFAULT false,
    typical_model_count INTEGER DEFAULT 1,
    typical_latency_ms INTEGER,
    typical_cost_multiplier DECIMAL(4, 2) DEFAULT 1.0,
    
    pattern_definition JSONB NOT NULL DEFAULT '{}',
    
    trigger_keywords TEXT[],
    trigger_intents TEXT[],
    
    required_capabilities TEXT[],
    min_tier INTEGER DEFAULT 1,
    
    usage_count INTEGER DEFAULT 0,
    avg_satisfaction_score DECIMAL(3, 2),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE production_workflow_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    workflow_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE production_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id VARCHAR(100) UNIQUE NOT NULL,
    category_id VARCHAR(50) NOT NULL REFERENCES production_workflow_categories(category_id),
    
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    primary_deliverable VARCHAR(200),
    semantic_embedding vector(768),
    
    workflow_definition JSONB NOT NULL DEFAULT '{}',
    input_schema JSONB,
    output_schema JSONB,
    
    complexity VARCHAR(20) DEFAULT 'medium',
    estimated_duration_minutes INTEGER,
    min_tier INTEGER DEFAULT 1,
    
    usage_count INTEGER DEFAULT 0,
    avg_quality_score DECIMAL(3, 2),
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_neural_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    
    preference_embedding vector(768),
    domain_embedding vector(768),
    behavior_embedding vector(768),
    
    preferred_models JSONB DEFAULT '{}',
    preferred_patterns TEXT[],
    preferred_workflows TEXT[],
    
    learning_rate DECIMAL(5, 4) DEFAULT 0.1,
    sample_count INTEGER DEFAULT 0,
    confidence DECIMAL(5, 4) DEFAULT 0,
    
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_orchestration_patterns_category ON orchestration_patterns(category_id);
CREATE INDEX idx_orchestration_patterns_complexity ON orchestration_patterns(complexity);
CREATE INDEX idx_orchestration_patterns_active ON orchestration_patterns(is_active) WHERE is_active = true;
CREATE INDEX idx_production_workflows_category ON production_workflows(category_id);
CREATE INDEX idx_production_workflows_active ON production_workflows(is_active) WHERE is_active = true;
CREATE INDEX idx_user_neural_models_user ON user_neural_models(tenant_id, user_id);

ALTER TABLE orchestration_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_neural_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY orchestration_patterns_read ON orchestration_patterns FOR SELECT USING (true);
CREATE POLICY production_workflows_read ON production_workflows FOR SELECT USING (true);
CREATE POLICY user_neural_models_isolation ON user_neural_models
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Insert orchestration pattern categories
INSERT INTO orchestration_pattern_categories (category_id, name, description, display_order, pattern_count) VALUES
    ('multi_model', 'Multi-Model Coordination', 'Patterns for coordinating multiple AI models', 1, 10),
    ('sequential', 'Sequential & Pipeline', 'Step-by-step processing patterns', 2, 15),
    ('verification', 'Verification & Fact-Checking', 'Patterns for validating AI outputs', 3, 12),
    ('debate', 'Debate & Adversarial Review', 'Patterns for adversarial evaluation', 4, 12),
    ('reasoning', 'Reasoning Enhancement', 'Patterns for improving reasoning quality', 5, 15),
    ('agent', 'Agent Architectures', 'Multi-agent coordination patterns', 6, 18),
    ('tool', 'Tool Use & Integration', 'Patterns for external tool integration', 7, 10),
    ('memory', 'Memory & Personalization', 'Patterns for context and personalization', 8, 8),
    ('user_facing', 'User-Facing Workflow Features', 'Patterns for user interaction', 9, 12),
    ('emerging', 'Emerging & Cutting-Edge', 'Experimental and research-stage patterns', 10, 15);

-- Insert production workflow categories
INSERT INTO production_workflow_categories (category_id, name, description, display_order, workflow_count) VALUES
    ('content', 'Content Creation', 'Workflows for content generation and editing', 1, 20),
    ('research', 'Research & Analysis', 'Workflows for research and data analysis', 2, 18),
    ('code', 'Software Development', 'Workflows for coding and development tasks', 3, 22),
    ('business', 'Business Operations', 'Workflows for business processes', 4, 15),
    ('creative', 'Creative & Design', 'Workflows for creative and design work', 5, 12),
    ('education', 'Education & Learning', 'Workflows for educational content', 6, 10),
    ('communication', 'Communication', 'Workflows for communication tasks', 7, 15),
    ('automation', 'Automation & Integration', 'Workflows for automation', 8, 15);

CREATE TRIGGER update_orchestration_patterns_updated_at 
    BEFORE UPDATE ON orchestration_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_production_workflows_updated_at 
    BEFORE UPDATE ON production_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
