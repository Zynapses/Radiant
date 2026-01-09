-- ============================================================================
-- RADIANT v5.2.1 - Idempotency Keys Table
-- Migration: V2026_01_10_002
-- 
-- Provides idempotency support for critical operations (billing, etc.)
-- to prevent duplicate effects on retry.
-- ============================================================================

-- 1. Create idempotency_keys table
CREATE TABLE IF NOT EXISTS idempotency_keys (
    idempotency_key VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    operation_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    result JSONB,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    
    PRIMARY KEY (idempotency_key, tenant_id)
);

-- 2. Create indexes for efficient lookup and cleanup
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_tenant 
ON idempotency_keys(tenant_id);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires 
ON idempotency_keys(expires_at);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_status 
ON idempotency_keys(status) WHERE status = 'pending';

-- 3. Enable RLS
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY idempotency_keys_tenant_isolation ON idempotency_keys
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY idempotency_keys_system_access ON idempotency_keys
    FOR ALL
    USING (current_setting('app.current_tenant_id', true) IS NULL);

-- 5. Add comment
COMMENT ON TABLE idempotency_keys IS 
'Tracks idempotency keys for critical operations to prevent duplicate effects on retry. Records expire after TTL (default 24h).';

-- 6. Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM idempotency_keys WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_idempotency_keys() IS 
'Removes expired idempotency records. Should be called periodically via scheduled task.';
