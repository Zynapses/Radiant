-- RADIANT v4.17.0 - Migration 016: Think Tank Platform
-- Complex problem decomposition and multi-step reasoning

CREATE TABLE thinktank_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_summary TEXT,
    domain VARCHAR(50),
    complexity VARCHAR(20) CHECK (complexity IN ('low', 'medium', 'high', 'extreme')),
    total_steps INTEGER DEFAULT 0,
    avg_confidence DECIMAL(3, 2),
    solution_found BOOLEAN DEFAULT false,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE thinktank_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES thinktank_sessions(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_type VARCHAR(50) NOT NULL CHECK (step_type IN ('decompose', 'reason', 'execute', 'verify', 'synthesize')),
    description TEXT,
    reasoning TEXT,
    result TEXT,
    confidence DECIMAL(3, 2) CHECK (confidence >= 0 AND confidence <= 1),
    model_used VARCHAR(100),
    tokens_used INTEGER,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE thinktank_tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_name VARCHAR(100) NOT NULL UNIQUE,
    tool_type VARCHAR(50) NOT NULL,
    description TEXT,
    parameters_schema JSONB NOT NULL DEFAULT '{}',
    implementation TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_thinktank_sessions_tenant ON thinktank_sessions(tenant_id, created_at DESC);
CREATE INDEX idx_thinktank_sessions_user ON thinktank_sessions(user_id);
CREATE INDEX idx_thinktank_steps_session ON thinktank_steps(session_id, step_number);

ALTER TABLE thinktank_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE thinktank_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY thinktank_sessions_isolation ON thinktank_sessions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY thinktank_steps_isolation ON thinktank_steps
    FOR ALL USING (
        session_id IN (SELECT id FROM thinktank_sessions WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    );

-- Insert default tools
INSERT INTO thinktank_tools (tool_name, tool_type, description, parameters_schema) VALUES
    ('web_search', 'search', 'Search the web for information', '{"query": "string"}'),
    ('calculator', 'compute', 'Perform mathematical calculations', '{"expression": "string"}'),
    ('code_executor', 'compute', 'Execute code snippets', '{"language": "string", "code": "string"}'),
    ('file_reader', 'io', 'Read file contents', '{"path": "string"}'),
    ('api_caller', 'network', 'Make API requests', '{"url": "string", "method": "string", "body": "object"}');
