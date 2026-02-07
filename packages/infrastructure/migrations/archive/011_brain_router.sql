-- RADIANT v4.17.0 - Migration 011: RADIANT Brain Smart Router
-- Intelligent request routing system

CREATE TABLE brain_routing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    priority INTEGER NOT NULL DEFAULT 100,
    conditions JSONB NOT NULL DEFAULT '{}',
    target_model VARCHAR(100) NOT NULL,
    fallback_models TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE brain_routing_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id VARCHAR(100),
    task_type VARCHAR(50),
    input_tokens INTEGER,
    output_tokens INTEGER,
    selected_model VARCHAR(100) NOT NULL,
    selection_reason TEXT,
    latency_ms INTEGER,
    cost DECIMAL(10, 6),
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brain_rules_tenant ON brain_routing_rules(tenant_id);
CREATE INDEX idx_brain_rules_active ON brain_routing_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_brain_history_tenant ON brain_routing_history(tenant_id, created_at DESC);
CREATE INDEX idx_brain_history_model ON brain_routing_history(selected_model);
CREATE INDEX idx_brain_history_user ON brain_routing_history(user_id);

ALTER TABLE brain_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_routing_history ENABLE ROW LEVEL SECURITY;

-- Rules can be global (tenant_id NULL) or tenant-specific
CREATE POLICY brain_rules_isolation ON brain_routing_rules
    FOR ALL USING (
        tenant_id IS NULL OR 
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY brain_history_isolation ON brain_routing_history
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY brain_history_super_admin ON brain_routing_history
    FOR SELECT USING (current_setting('app.is_super_admin', true)::boolean = true);

-- Default routing rules
INSERT INTO brain_routing_rules (name, priority, conditions, target_model, fallback_models) VALUES
    ('Code tasks to Claude', 10, '{"task_type": "code"}', 'claude-3-5-sonnet-20241022', ARRAY['gpt-4o', 'deepseek-chat']),
    ('Creative to Claude Opus', 20, '{"task_type": "creative"}', 'claude-3-opus-20240229', ARRAY['gpt-4o', 'gemini-1.5-pro']),
    ('Analysis to o1', 30, '{"task_type": "analysis", "min_tokens": 1000}', 'o1', ARRAY['claude-3-opus-20240229', 'gemini-1.5-pro']),
    ('Fast responses to GPT-4o-mini', 40, '{"max_latency_ms": 2000}', 'gpt-4o-mini', ARRAY['claude-3-5-haiku-20241022', 'gemini-2.0-flash-exp']),
    ('Default balanced', 100, '{}', 'gpt-4o', ARRAY['claude-3-5-sonnet-20241022', 'gemini-1.5-pro']);

CREATE TRIGGER update_brain_routing_rules_updated_at 
    BEFORE UPDATE ON brain_routing_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
