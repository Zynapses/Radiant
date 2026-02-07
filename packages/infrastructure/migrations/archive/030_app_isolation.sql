-- RADIANT v4.17.0 - Migration 030: Application-Level Data Isolation
-- Complete isolation between client apps (Think Tank, Launch Board, etc.)

-- Function to get current app_id from session
CREATE OR REPLACE FUNCTION current_app_id() RETURNS VARCHAR(50) AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_app_id', true), '');
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE TABLE registered_apps (
    id VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    cognito_user_pool_id VARCHAR(100),
    cognito_client_id VARCHAR(100),
    api_base_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    app_id VARCHAR(50) NOT NULL REFERENCES registered_apps(id),
    
    base_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    cognito_sub VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(200),
    avatar_url TEXT,
    
    preferences JSONB DEFAULT '{}',
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en-US',
    
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    last_login_at TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    UNIQUE(tenant_id, app_id, email),
    UNIQUE(app_id, cognito_sub)
);

CREATE TABLE app_user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    
    session_token VARCHAR(500) NOT NULL UNIQUE,
    refresh_token_hash VARCHAR(64),
    
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(64),
    
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_data_scopes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id VARCHAR(50) NOT NULL REFERENCES registered_apps(id),
    table_name VARCHAR(100) NOT NULL,
    isolation_level VARCHAR(20) NOT NULL DEFAULT 'app' CHECK (isolation_level IN ('app', 'tenant', 'global')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(app_id, table_name)
);

CREATE INDEX idx_app_users_tenant_app ON app_users(tenant_id, app_id);
CREATE INDEX idx_app_users_email ON app_users(email);
CREATE INDEX idx_app_users_cognito ON app_users(cognito_sub);
CREATE INDEX idx_app_users_status ON app_users(status) WHERE status = 'active';
CREATE INDEX idx_app_user_sessions_user ON app_user_sessions(app_user_id);
CREATE INDEX idx_app_user_sessions_token ON app_user_sessions(session_token);
CREATE INDEX idx_app_user_sessions_active ON app_user_sessions(is_active) WHERE is_active = true;

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_data_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_users_isolation ON app_users
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
        AND app_id = current_app_id()
    );

CREATE POLICY app_user_sessions_isolation ON app_user_sessions
    FOR ALL USING (
        app_user_id IN (
            SELECT id FROM app_users 
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
            AND app_id = current_app_id()
        )
    );

CREATE POLICY app_data_scopes_read ON app_data_scopes FOR SELECT USING (true);

-- Insert default apps
INSERT INTO registered_apps (id, display_name, description) VALUES
    ('thinktank', 'Think Tank', 'AI-powered collaborative thinking platform'),
    ('launchboard', 'Launch Board', 'Product launch and management platform'),
    ('alwaysme', 'AlwaysMe', 'Personal AI assistant'),
    ('mechanicalmaker', 'Mechanical Maker', 'AI-assisted design and engineering tool');

CREATE TRIGGER update_app_users_updated_at 
    BEFORE UPDATE ON app_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
