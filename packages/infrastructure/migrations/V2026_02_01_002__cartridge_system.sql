-- RADIANT Cartridge System
-- Database schema for portable AI brains (.RADz files)
-- Version: 6.0.0
-- Date: 2026-02-01

-- =============================================================================
-- Enums
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE cartridge_scope AS ENUM ('tenant', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cartridge_status AS ENUM (
    'draft',       -- Being created
    'validating',  -- Running validation checks
    'ready',       -- Available for use
    'importing',   -- Being imported
    'active',      -- Currently in use
    'archived',    -- Soft-deleted
    'failed'       -- Validation/import failed
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Cartridges Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS cartridges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,                                    -- NULL for tenant-scope cartridges
    
    -- Identity
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    scope cartridge_scope NOT NULL DEFAULT 'tenant',
    status cartridge_status NOT NULL DEFAULT 'draft',
    
    -- Storage
    storage_key VARCHAR(500),                        -- S3 key for .RADz file
    storage_bucket VARCHAR(255),
    file_size_bytes BIGINT DEFAULT 0,
    checksum VARCHAR(64),                            -- SHA-256
    
    -- Contents summary
    domains JSONB DEFAULT '[]'::jsonb,
    has_lora_adapters BOOLEAN DEFAULT false,
    has_curator_knowledge BOOLEAN DEFAULT false,
    has_ghost_compression BOOLEAN DEFAULT false,
    has_domain_experts BOOLEAN DEFAULT false,
    
    -- CORTEX versions
    cortex_versions JSONB DEFAULT '{}'::jsonb,
    
    -- Behavior flags
    allow_user_override BOOLEAN DEFAULT true,        -- Can user cartridges modify this?
    overridable_fields JSONB DEFAULT '[]'::jsonb,    -- Which fields can be overridden
    
    -- Activation
    is_enabled BOOLEAN DEFAULT true,                 -- For user cartridges, can be toggled
    activated_at TIMESTAMPTZ,
    activated_by VARCHAR(255),
    
    -- Compatibility
    radiant_version_min VARCHAR(50),
    target_models JSONB DEFAULT '[]'::jsonb,
    required_capabilities JSONB DEFAULT '[]'::jsonb,
    
    -- Security
    signature VARCHAR(500),
    signed_by VARCHAR(255),
    encryption_key_id VARCHAR(255),
    
    -- Metadata
    tags JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ,
    archived_by VARCHAR(255),
    
    -- Constraints
    CONSTRAINT cartridges_user_scope_check 
        CHECK (scope = 'tenant' OR (scope = 'user' AND user_id IS NOT NULL))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cartridges_tenant ON cartridges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cartridges_user ON cartridges(tenant_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cartridges_scope ON cartridges(tenant_id, scope);
CREATE INDEX IF NOT EXISTS idx_cartridges_status ON cartridges(status);
CREATE INDEX IF NOT EXISTS idx_cartridges_active ON cartridges(tenant_id, scope, status) 
    WHERE status = 'active' AND archived_at IS NULL;

-- RLS Policy
ALTER TABLE cartridges ENABLE ROW LEVEL SECURITY;

CREATE POLICY cartridges_tenant_isolation ON cartridges
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE cartridges IS 'Portable AI brains (.RADz files) for export/import of neural intelligence';
COMMENT ON COLUMN cartridges.scope IS 'tenant = always active, cannot be disabled; user = can be toggled';
COMMENT ON COLUMN cartridges.allow_user_override IS 'If true, user cartridges can override this tenant cartridge';

-- =============================================================================
-- Cartridge Stack Positions
-- =============================================================================

CREATE TABLE IF NOT EXISTS cartridge_stack_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,                                    -- NULL for tenant stack
    cartridge_id UUID NOT NULL REFERENCES cartridges(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,             -- Order in stack (lower = applied first)
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT cartridge_stack_unique UNIQUE (tenant_id, user_id, cartridge_id)
);

CREATE INDEX IF NOT EXISTS idx_stack_positions_tenant ON cartridge_stack_positions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stack_positions_user ON cartridge_stack_positions(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_stack_positions_order ON cartridge_stack_positions(tenant_id, user_id, position);

COMMENT ON TABLE cartridge_stack_positions IS 'Ordering of cartridges in tenant/user stacks';

-- =============================================================================
-- Cartridge Imports
-- =============================================================================

CREATE TABLE IF NOT EXISTS cartridge_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    cartridge_id UUID REFERENCES cartridges(id) ON DELETE SET NULL,
    
    -- Import details
    source_file_key VARCHAR(500) NOT NULL,
    source_file_size BIGINT,
    source_checksum VARCHAR(64),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending, validating, importing, completed, failed
    progress_percent INTEGER DEFAULT 0,
    
    -- Validation
    validation_errors JSONB DEFAULT '[]'::jsonb,
    validation_warnings JSONB DEFAULT '[]'::jsonb,
    
    -- Manifest (from imported file)
    manifest JSONB,
    
    -- Merge strategy
    merge_strategy VARCHAR(20) DEFAULT 'replace',    -- replace, merge
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cartridge_imports_tenant ON cartridge_imports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cartridge_imports_status ON cartridge_imports(status);

COMMENT ON TABLE cartridge_imports IS 'Import job tracking for cartridge files';

-- =============================================================================
-- Cartridge Exports
-- =============================================================================

CREATE TABLE IF NOT EXISTS cartridge_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    cartridge_id UUID REFERENCES cartridges(id) ON DELETE SET NULL,
    
    -- Export configuration
    scope cartridge_scope NOT NULL,
    domains JSONB NOT NULL DEFAULT '[]'::jsonb,
    include_lora BOOLEAN DEFAULT false,
    include_curator BOOLEAN DEFAULT false,
    include_ghost BOOLEAN DEFAULT false,
    include_domain_experts BOOLEAN DEFAULT false,
    
    -- Output
    output_file_key VARCHAR(500),
    output_file_size BIGINT,
    output_checksum VARCHAR(64),
    download_url TEXT,
    download_expires_at TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending, generating, completed, failed, expired
    progress_percent INTEGER DEFAULT 0,
    error_message TEXT,
    
    -- Encryption
    encryption_key_id VARCHAR(255),
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cartridge_exports_tenant ON cartridge_exports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cartridge_exports_status ON cartridge_exports(status);

COMMENT ON TABLE cartridge_exports IS 'Export job tracking for cartridge generation';

-- =============================================================================
-- Cartridge Activation Log
-- =============================================================================

CREATE TABLE IF NOT EXISTS cartridge_activation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    cartridge_id UUID NOT NULL REFERENCES cartridges(id) ON DELETE CASCADE,
    
    action VARCHAR(20) NOT NULL,                     -- activated, deactivated, toggled_on, toggled_off
    previous_status VARCHAR(20),
    new_status VARCHAR(20),
    
    reason TEXT,
    performed_by VARCHAR(255) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activation_log_cartridge ON cartridge_activation_log(cartridge_id);
CREATE INDEX IF NOT EXISTS idx_activation_log_tenant ON cartridge_activation_log(tenant_id, created_at DESC);

COMMENT ON TABLE cartridge_activation_log IS 'Audit log for cartridge activation/deactivation events';

-- =============================================================================
-- Cartridge Content Cache
-- =============================================================================

CREATE TABLE IF NOT EXISTS cartridge_content_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cartridge_id UUID NOT NULL REFERENCES cartridges(id) ON DELETE CASCADE,
    
    -- Cached content type
    content_type VARCHAR(50) NOT NULL,               -- cortex, domain_expert, lora, curator, ghost
    content_key VARCHAR(255) NOT NULL,               -- e.g., 'pattern_network', 'fitness/entity_classifier'
    
    -- Cache metadata
    cached_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    cache_key VARCHAR(500),                          -- S3 key for cached/extracted content
    checksum VARCHAR(64),
    
    CONSTRAINT cartridge_content_unique UNIQUE (cartridge_id, content_type, content_key)
);

CREATE INDEX IF NOT EXISTS idx_content_cache_cartridge ON cartridge_content_cache(cartridge_id);

COMMENT ON TABLE cartridge_content_cache IS 'Cache for extracted cartridge content (for faster loading)';

-- =============================================================================
-- Functions
-- =============================================================================

CREATE OR REPLACE FUNCTION get_effective_cartridge_stack(
    p_tenant_id UUID,
    p_user_id UUID DEFAULT NULL
) RETURNS TABLE (
    cartridge_id UUID,
    name VARCHAR(255),
    scope cartridge_scope,
    position INTEGER,
    is_enabled BOOLEAN,
    can_disable BOOLEAN,
    allow_user_override BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    -- Tenant cartridges (always enabled, cannot disable)
    SELECT 
        c.id,
        c.name,
        c.scope,
        COALESCE(sp.position, 0)::INTEGER,
        true AS is_enabled,
        false AS can_disable,
        c.allow_user_override
    FROM cartridges c
    LEFT JOIN cartridge_stack_positions sp ON sp.cartridge_id = c.id AND sp.user_id IS NULL
    WHERE c.tenant_id = p_tenant_id
      AND c.scope = 'tenant'
      AND c.status = 'active'
      AND c.archived_at IS NULL
    
    UNION ALL
    
    -- User cartridges (if user_id provided)
    SELECT 
        c.id,
        c.name,
        c.scope,
        COALESCE(sp.position, 1000)::INTEGER,
        c.is_enabled,
        true AS can_disable,
        true AS allow_user_override
    FROM cartridges c
    LEFT JOIN cartridge_stack_positions sp ON sp.cartridge_id = c.id AND sp.user_id = p_user_id
    WHERE c.tenant_id = p_tenant_id
      AND c.scope = 'user'
      AND c.user_id = p_user_id
      AND c.status IN ('active', 'ready')
      AND c.archived_at IS NULL
      AND p_user_id IS NOT NULL
    
    ORDER BY position;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_effective_cartridge_stack IS 'Get the resolved cartridge stack for a tenant/user';
