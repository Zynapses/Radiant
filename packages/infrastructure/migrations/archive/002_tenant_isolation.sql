-- RADIANT v4.17.0 - Migration 002: Tenant Isolation (RLS)
-- Row-Level Security policies for multi-tenant isolation

-- ============================================================================
-- ENABLE RLS ON ALL TENANT-SCOPED TABLES
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR USERS TABLE
-- ============================================================================

-- Policy: Users can only see users in their own tenant
CREATE POLICY users_tenant_isolation ON users
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Policy: Super admins can see all users
CREATE POLICY users_super_admin_access ON users
    FOR SELECT
    USING (current_setting('app.is_super_admin', true)::boolean = true);

-- ============================================================================
-- HELPER FUNCTION TO SET TENANT CONTEXT
-- ============================================================================

CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id UUID, p_is_super_admin BOOLEAN DEFAULT false)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', p_tenant_id::text, true);
    PERFORM set_config('app.is_super_admin', p_is_super_admin::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION TO CLEAR TENANT CONTEXT
-- ============================================================================

CREATE OR REPLACE FUNCTION clear_tenant_context()
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', '', true);
    PERFORM set_config('app.is_super_admin', 'false', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION set_tenant_context(UUID, BOOLEAN) TO PUBLIC;
GRANT EXECUTE ON FUNCTION clear_tenant_context() TO PUBLIC;
