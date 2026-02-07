-- =============================================================================
-- Migration: Agent Registry & Tenant Permissions System
-- Version: V2026_01_23_001
-- Description: Creates extensible agent registry and tenant-level permission
--              management for multi-agent access control (Curator, Think Tank, etc.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: Agent Registry (NOT hardcoded - allows future agents)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_key VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_name VARCHAR(50),
    base_url VARCHAR(255),
    port INTEGER,
    is_active BOOLEAN DEFAULT true,
    is_internal BOOLEAN DEFAULT true,
    requires_license BOOLEAN DEFAULT false,
    license_tier VARCHAR(50),
    capabilities JSONB DEFAULT '[]'::jsonb,
    default_permissions JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_registry_key ON agent_registry(agent_key);
CREATE INDEX idx_agent_registry_active ON agent_registry(is_active) WHERE is_active = true;

COMMENT ON TABLE agent_registry IS 'Registry of all RADIANT agents (Curator, Think Tank, future agents)';
COMMENT ON COLUMN agent_registry.agent_key IS 'Unique identifier used in code (e.g., curator, thinktank)';
COMMENT ON COLUMN agent_registry.capabilities IS 'Array of capability strings this agent provides';
COMMENT ON COLUMN agent_registry.default_permissions IS 'Default permission structure for new tenant access';

-- -----------------------------------------------------------------------------
-- SECTION 2: Tenant Roles (Organization-level roles)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tenant_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role_key VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false,
    permissions JSONB DEFAULT '{}'::jsonb,
    agent_access JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    UNIQUE(tenant_id, role_key)
);

CREATE INDEX idx_tenant_roles_tenant ON tenant_roles(tenant_id);
CREATE INDEX idx_tenant_roles_key ON tenant_roles(tenant_id, role_key);

COMMENT ON TABLE tenant_roles IS 'Tenant-specific roles for permission management';
COMMENT ON COLUMN tenant_roles.permissions IS 'JSONB permissions object for general access control';
COMMENT ON COLUMN tenant_roles.agent_access IS 'Array of agent_key strings this role can access';

-- Enable RLS
ALTER TABLE tenant_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_roles_isolation ON tenant_roles
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- -----------------------------------------------------------------------------
-- SECTION 3: User-Role Assignments
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tenant_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role_id UUID NOT NULL REFERENCES tenant_roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(tenant_id, user_id, role_id)
);

CREATE INDEX idx_tenant_user_roles_tenant ON tenant_user_roles(tenant_id);
CREATE INDEX idx_tenant_user_roles_user ON tenant_user_roles(user_id);
CREATE INDEX idx_tenant_user_roles_active ON tenant_user_roles(tenant_id, user_id) WHERE is_active = true;

COMMENT ON TABLE tenant_user_roles IS 'Maps users to roles within a tenant';

-- Enable RLS
ALTER TABLE tenant_user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_user_roles_isolation ON tenant_user_roles
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- -----------------------------------------------------------------------------
-- SECTION 4: User Agent Access (Direct agent-level permissions)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_agent_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    agent_id UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
    access_level VARCHAR(20) DEFAULT 'user',
    permissions JSONB DEFAULT '{}'::jsonb,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(tenant_id, user_id, agent_id)
);

CREATE INDEX idx_user_agent_access_tenant ON user_agent_access(tenant_id);
CREATE INDEX idx_user_agent_access_user ON user_agent_access(user_id);
CREATE INDEX idx_user_agent_access_agent ON user_agent_access(agent_id);
CREATE INDEX idx_user_agent_access_active ON user_agent_access(tenant_id, user_id) WHERE is_active = true;

COMMENT ON TABLE user_agent_access IS 'Direct user access to specific agents with granular permissions';
COMMENT ON COLUMN user_agent_access.access_level IS 'Access tier: viewer, user, editor, admin';
COMMENT ON COLUMN user_agent_access.permissions IS 'Agent-specific permission overrides';

-- Enable RLS
ALTER TABLE user_agent_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_agent_access_isolation ON user_agent_access
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- -----------------------------------------------------------------------------
-- SECTION 5: Curator-Specific Tables
-- -----------------------------------------------------------------------------

-- Knowledge Domains (Taxonomy)
CREATE TABLE IF NOT EXISTS curator_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES curator_domains(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    slug VARCHAR(100) NOT NULL,
    icon_name VARCHAR(50),
    settings JSONB DEFAULT '{
        "auto_categorize": true,
        "require_verification": true,
        "retention_days": null
    }'::jsonb,
    node_count INTEGER DEFAULT 0,
    document_count INTEGER DEFAULT 0,
    depth INTEGER DEFAULT 0,
    path_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    UNIQUE(tenant_id, parent_id, slug)
);

CREATE INDEX idx_curator_domains_tenant ON curator_domains(tenant_id);
CREATE INDEX idx_curator_domains_parent ON curator_domains(parent_id);
CREATE INDEX idx_curator_domains_path ON curator_domains USING GIN(path_ids);

-- Enable RLS
ALTER TABLE curator_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY curator_domains_isolation ON curator_domains
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Knowledge Nodes (Graph nodes)
CREATE TABLE IF NOT EXISTS curator_knowledge_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain_id UUID REFERENCES curator_domains(id) ON DELETE SET NULL,
    node_type VARCHAR(30) NOT NULL,
    label TEXT NOT NULL,
    content TEXT,
    source_document_id UUID,
    source_location JSONB,
    confidence DECIMAL(5,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    verified_at TIMESTAMPTZ,
    verified_by UUID,
    override_value TEXT,
    override_reason TEXT,
    override_at TIMESTAMPTZ,
    override_by UUID,
    ai_reasoning TEXT,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_node_type CHECK (node_type IN ('concept', 'fact', 'procedure', 'entity', 'rule', 'constraint')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'verified', 'rejected', 'overridden', 'archived'))
);

CREATE INDEX idx_curator_nodes_tenant ON curator_knowledge_nodes(tenant_id);
CREATE INDEX idx_curator_nodes_domain ON curator_knowledge_nodes(domain_id);
CREATE INDEX idx_curator_nodes_status ON curator_knowledge_nodes(tenant_id, status);
CREATE INDEX idx_curator_nodes_type ON curator_knowledge_nodes(tenant_id, node_type);
CREATE INDEX idx_curator_nodes_embedding ON curator_knowledge_nodes USING ivfflat (embedding vector_cosine_ops);

-- Enable RLS
ALTER TABLE curator_knowledge_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY curator_knowledge_nodes_isolation ON curator_knowledge_nodes
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Knowledge Edges (Graph relationships)
CREATE TABLE IF NOT EXISTS curator_knowledge_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES curator_knowledge_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES curator_knowledge_nodes(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL,
    weight DECIMAL(5,2) DEFAULT 1.0,
    bidirectional BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, source_node_id, target_node_id, relationship_type)
);

CREATE INDEX idx_curator_edges_tenant ON curator_knowledge_edges(tenant_id);
CREATE INDEX idx_curator_edges_source ON curator_knowledge_edges(source_node_id);
CREATE INDEX idx_curator_edges_target ON curator_knowledge_edges(target_node_id);

-- Enable RLS
ALTER TABLE curator_knowledge_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY curator_knowledge_edges_isolation ON curator_knowledge_edges
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Ingested Documents
CREATE TABLE IF NOT EXISTS curator_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain_id UUID REFERENCES curator_domains(id) ON DELETE SET NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    storage_key VARCHAR(500),
    checksum VARCHAR(64),
    status VARCHAR(20) DEFAULT 'pending',
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    nodes_created INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    CONSTRAINT valid_doc_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'archived'))
);

CREATE INDEX idx_curator_documents_tenant ON curator_documents(tenant_id);
CREATE INDEX idx_curator_documents_domain ON curator_documents(domain_id);
CREATE INDEX idx_curator_documents_status ON curator_documents(tenant_id, status);

-- Enable RLS
ALTER TABLE curator_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY curator_documents_isolation ON curator_documents
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Verification Queue (Entrance Exam items)
CREATE TABLE IF NOT EXISTS curator_verification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES curator_knowledge_nodes(id) ON DELETE CASCADE,
    statement TEXT NOT NULL,
    ai_confidence DECIMAL(5,2) NOT NULL,
    ai_reasoning TEXT,
    source_reference TEXT,
    domain_path TEXT,
    priority INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID,
    review_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_queue_status CHECK (status IN ('pending', 'approved', 'rejected', 'deferred'))
);

CREATE INDEX idx_curator_verification_tenant ON curator_verification_queue(tenant_id);
CREATE INDEX idx_curator_verification_status ON curator_verification_queue(tenant_id, status);
CREATE INDEX idx_curator_verification_priority ON curator_verification_queue(tenant_id, priority DESC) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE curator_verification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY curator_verification_queue_isolation ON curator_verification_queue
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Audit Log for Knowledge Changes
CREATE TABLE IF NOT EXISTS curator_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    actor_id UUID,
    actor_type VARCHAR(20) DEFAULT 'user',
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_curator_audit_tenant ON curator_audit_log(tenant_id);
CREATE INDEX idx_curator_audit_entity ON curator_audit_log(entity_type, entity_id);
CREATE INDEX idx_curator_audit_time ON curator_audit_log(tenant_id, created_at DESC);

-- Enable RLS
ALTER TABLE curator_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY curator_audit_log_isolation ON curator_audit_log
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- -----------------------------------------------------------------------------
-- SECTION 6: Seed Data
-- -----------------------------------------------------------------------------

-- Seed agent registry with initial agents
INSERT INTO agent_registry (agent_key, display_name, description, icon_name, port, is_active, capabilities, default_permissions, sort_order)
VALUES 
    ('thinktank', 'Think Tank', 'AI-powered collaborative thinking and analysis platform', 'Brain', 3002, true, 
     '["chat", "analysis", "collaboration", "artifacts", "memory"]'::jsonb,
     '{"can_chat": true, "can_create_rooms": false, "can_invite": false}'::jsonb, 1),
    ('curator', 'RADIANT Curator', 'Knowledge curation and verification system for enterprise AI', 'BookOpen', 3003, true,
     '["document_ingestion", "verification", "knowledge_graph", "domain_management", "overrides"]'::jsonb,
     '{"can_ingest": true, "can_verify": false, "can_override": false, "can_manage_domains": false}'::jsonb, 2),
    ('thinktank_admin', 'Think Tank Admin', 'Administrative interface for Think Tank and agent access management', 'Shield', 3001, true,
     '["user_management", "agent_access", "tenant_settings", "analytics"]'::jsonb,
     '{"can_manage_users": false, "can_manage_agents": false, "can_view_analytics": true}'::jsonb, 0)
ON CONFLICT (agent_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    capabilities = EXCLUDED.capabilities,
    updated_at = NOW();

-- -----------------------------------------------------------------------------
-- SECTION 7: Helper Functions
-- -----------------------------------------------------------------------------

-- Function to check if a user has access to an agent
CREATE OR REPLACE FUNCTION check_user_agent_access(
    p_tenant_id UUID,
    p_user_id UUID,
    p_agent_key VARCHAR(50)
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_access BOOLEAN := false;
    v_agent_id UUID;
BEGIN
    -- Get agent ID
    SELECT id INTO v_agent_id FROM agent_registry WHERE agent_key = p_agent_key AND is_active = true;
    
    IF v_agent_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Check direct user-agent access
    SELECT EXISTS(
        SELECT 1 FROM user_agent_access 
        WHERE tenant_id = p_tenant_id 
        AND user_id = p_user_id 
        AND agent_id = v_agent_id 
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
    ) INTO v_has_access;
    
    IF v_has_access THEN
        RETURN true;
    END IF;
    
    -- Check role-based access
    SELECT EXISTS(
        SELECT 1 FROM tenant_user_roles tur
        JOIN tenant_roles tr ON tr.id = tur.role_id
        WHERE tur.tenant_id = p_tenant_id
        AND tur.user_id = p_user_id
        AND tur.is_active = true
        AND (tur.expires_at IS NULL OR tur.expires_at > NOW())
        AND tr.agent_access ? p_agent_key
    ) INTO v_has_access;
    
    RETURN v_has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's effective permissions for an agent
CREATE OR REPLACE FUNCTION get_user_agent_permissions(
    p_tenant_id UUID,
    p_user_id UUID,
    p_agent_key VARCHAR(50)
) RETURNS JSONB AS $$
DECLARE
    v_permissions JSONB := '{}'::jsonb;
    v_agent_id UUID;
    v_default_perms JSONB;
    v_role_perms JSONB;
    v_direct_perms JSONB;
BEGIN
    -- Get agent default permissions
    SELECT id, default_permissions INTO v_agent_id, v_default_perms 
    FROM agent_registry WHERE agent_key = p_agent_key AND is_active = true;
    
    IF v_agent_id IS NULL THEN
        RETURN '{}'::jsonb;
    END IF;
    
    v_permissions := COALESCE(v_default_perms, '{}'::jsonb);
    
    -- Merge role-based permissions (union of all roles)
    SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_role_perms
    FROM (
        SELECT (jsonb_each(tr.permissions)).*
        FROM tenant_user_roles tur
        JOIN tenant_roles tr ON tr.id = tur.role_id
        WHERE tur.tenant_id = p_tenant_id
        AND tur.user_id = p_user_id
        AND tur.is_active = true
        AND tr.agent_access ? p_agent_key
    ) sub;
    
    v_permissions := v_permissions || COALESCE(v_role_perms, '{}'::jsonb);
    
    -- Merge direct user permissions (highest priority)
    SELECT permissions INTO v_direct_perms
    FROM user_agent_access
    WHERE tenant_id = p_tenant_id
    AND user_id = p_user_id
    AND agent_id = v_agent_id
    AND is_active = true;
    
    v_permissions := v_permissions || COALESCE(v_direct_perms, '{}'::jsonb);
    
    RETURN v_permissions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update domain node counts
CREATE OR REPLACE FUNCTION update_domain_node_counts() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE curator_domains 
        SET node_count = node_count + 1, updated_at = NOW()
        WHERE id = NEW.domain_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE curator_domains 
        SET node_count = node_count - 1, updated_at = NOW()
        WHERE id = OLD.domain_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.domain_id IS DISTINCT FROM NEW.domain_id THEN
        UPDATE curator_domains 
        SET node_count = node_count - 1, updated_at = NOW()
        WHERE id = OLD.domain_id;
        UPDATE curator_domains 
        SET node_count = node_count + 1, updated_at = NOW()
        WHERE id = NEW.domain_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_domain_node_counts
    AFTER INSERT OR UPDATE OF domain_id OR DELETE ON curator_knowledge_nodes
    FOR EACH ROW EXECUTE FUNCTION update_domain_node_counts();

-- Function to set domain depth and path
CREATE OR REPLACE FUNCTION set_domain_path() RETURNS TRIGGER AS $$
DECLARE
    v_parent_depth INTEGER;
    v_parent_path UUID[];
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.depth := 0;
        NEW.path_ids := ARRAY[NEW.id];
    ELSE
        SELECT depth, path_ids INTO v_parent_depth, v_parent_path
        FROM curator_domains WHERE id = NEW.parent_id;
        
        NEW.depth := COALESCE(v_parent_depth, 0) + 1;
        NEW.path_ids := COALESCE(v_parent_path, '{}') || NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_domain_path
    BEFORE INSERT OR UPDATE OF parent_id ON curator_domains
    FOR EACH ROW EXECUTE FUNCTION set_domain_path();

-- -----------------------------------------------------------------------------
-- SECTION 8: Default System Roles Template
-- -----------------------------------------------------------------------------

-- Create a function to initialize default roles for a tenant
CREATE OR REPLACE FUNCTION initialize_tenant_roles(p_tenant_id UUID) RETURNS VOID AS $$
BEGIN
    -- Tenant Admin role (full access)
    INSERT INTO tenant_roles (tenant_id, role_key, display_name, description, is_system_role, permissions, agent_access)
    VALUES (
        p_tenant_id, 
        'tenant_admin', 
        'Tenant Administrator', 
        'Full administrative access to all agents and settings',
        true,
        '{"manage_users": true, "manage_roles": true, "manage_agents": true, "view_analytics": true, "manage_billing": true}'::jsonb,
        '["thinktank", "curator", "thinktank_admin"]'::jsonb
    ) ON CONFLICT (tenant_id, role_key) DO NOTHING;
    
    -- Knowledge Manager role (Curator focused)
    INSERT INTO tenant_roles (tenant_id, role_key, display_name, description, is_system_role, permissions, agent_access)
    VALUES (
        p_tenant_id,
        'knowledge_manager',
        'Knowledge Manager',
        'Can ingest, verify, and manage knowledge in Curator',
        true,
        '{"can_ingest": true, "can_verify": true, "can_override": true, "can_manage_domains": true}'::jsonb,
        '["curator", "thinktank"]'::jsonb
    ) ON CONFLICT (tenant_id, role_key) DO NOTHING;
    
    -- Knowledge Contributor role
    INSERT INTO tenant_roles (tenant_id, role_key, display_name, description, is_system_role, permissions, agent_access)
    VALUES (
        p_tenant_id,
        'knowledge_contributor',
        'Knowledge Contributor',
        'Can ingest documents and submit for verification',
        true,
        '{"can_ingest": true, "can_verify": false, "can_override": false, "can_manage_domains": false}'::jsonb,
        '["curator", "thinktank"]'::jsonb
    ) ON CONFLICT (tenant_id, role_key) DO NOTHING;
    
    -- Think Tank User role
    INSERT INTO tenant_roles (tenant_id, role_key, display_name, description, is_system_role, permissions, agent_access)
    VALUES (
        p_tenant_id,
        'thinktank_user',
        'Think Tank User',
        'Standard access to Think Tank collaborative features',
        true,
        '{"can_chat": true, "can_create_rooms": true, "can_invite": false}'::jsonb,
        '["thinktank"]'::jsonb
    ) ON CONFLICT (tenant_id, role_key) DO NOTHING;
    
    -- Viewer role (read-only)
    INSERT INTO tenant_roles (tenant_id, role_key, display_name, description, is_system_role, permissions, agent_access)
    VALUES (
        p_tenant_id,
        'viewer',
        'Viewer',
        'Read-only access to Think Tank',
        true,
        '{"can_chat": false, "can_view": true}'::jsonb,
        '["thinktank"]'::jsonb
    ) ON CONFLICT (tenant_id, role_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION initialize_tenant_roles IS 'Creates default system roles for a new tenant';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
