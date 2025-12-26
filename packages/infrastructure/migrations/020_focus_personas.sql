-- RADIANT v4.17.0 - Migration 020: Focus Modes & Custom Personas
-- Pre-configured AI behavior profiles and custom persona creation

CREATE TABLE focus_modes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    mode_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    system_prompt TEXT NOT NULL,
    default_model VARCHAR(100),
    settings JSONB DEFAULT '{}',
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_personas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    persona_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    avatar_url VARCHAR(500),
    system_prompt TEXT NOT NULL,
    voice_id VARCHAR(100),
    personality_traits JSONB DEFAULT '[]',
    knowledge_domains JSONB DEFAULT '[]',
    conversation_style JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE persona_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id UUID NOT NULL REFERENCES user_personas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    chat_id UUID,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_focus_modes_tenant ON focus_modes(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_focus_modes_system ON focus_modes(is_system) WHERE is_system = true;
CREATE INDEX idx_user_personas_user ON user_personas(tenant_id, user_id);
CREATE INDEX idx_user_personas_public ON user_personas(is_public) WHERE is_public = true;
CREATE INDEX idx_persona_usage ON persona_usage_log(persona_id, created_at DESC);

ALTER TABLE focus_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_usage_log ENABLE ROW LEVEL SECURITY;

-- System modes visible to all, tenant modes to tenant only
CREATE POLICY focus_modes_policy ON focus_modes
    FOR SELECT USING (
        is_system = true OR tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY focus_modes_modify ON focus_modes
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY user_personas_isolation ON user_personas
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY persona_usage_isolation ON persona_usage_log
    FOR ALL USING (
        persona_id IN (SELECT id FROM user_personas WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    );

-- Insert default focus modes
INSERT INTO focus_modes (mode_name, display_name, description, icon, system_prompt, is_system) VALUES
    ('general', 'General Assistant', 'Versatile AI for any task', 'MessageSquare', 'You are a helpful, harmless, and honest AI assistant.', true),
    ('code', 'Code Expert', 'Programming and development focus', 'Code', 'You are an expert software developer. Focus on clean, efficient, well-documented code. Explain your reasoning and suggest best practices.', true),
    ('writer', 'Creative Writer', 'Creative writing and content creation', 'PenTool', 'You are a creative writing assistant. Help with storytelling, content creation, and writing improvement. Be imaginative and expressive.', true),
    ('analyst', 'Data Analyst', 'Data analysis and insights', 'BarChart', 'You are a data analyst. Focus on extracting insights, identifying patterns, and presenting findings clearly. Be precise and methodical.', true),
    ('researcher', 'Research Assistant', 'Deep research and fact-finding', 'Search', 'You are a research assistant. Provide thorough, well-sourced information. Verify facts and present balanced perspectives.', true),
    ('tutor', 'Learning Tutor', 'Educational support and tutoring', 'GraduationCap', 'You are a patient and encouraging tutor. Explain concepts clearly, use examples, and adapt to the learner''s pace and style.', true);

CREATE TRIGGER update_user_personas_updated_at 
    BEFORE UPDATE ON user_personas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
