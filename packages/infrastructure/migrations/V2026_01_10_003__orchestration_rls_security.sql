-- Migration: V2026_01_10_003__orchestration_rls_security.sql
-- RADIANT v5.2.3 - Row Level Security for Orchestration Tables
-- 
-- This migration adds comprehensive RLS policies to orchestration tables
-- created in migrations 066 and 157 that were missing tenant isolation.
--
-- Security Model:
-- - System methods/workflows: Readable by all, not modifiable
-- - User workflows/templates: Full tenant + user isolation
-- - Customizations: Tenant isolation
-- - Executions: Tenant isolation with audit trail
-- ============================================================================

-- ============================================================================
-- 1. ORCHESTRATION METHODS - System-defined, read-only for all tenants
-- ============================================================================

ALTER TABLE orchestration_methods ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read system methods
CREATE POLICY orchestration_methods_read_policy ON orchestration_methods
    FOR SELECT
    USING (true);

-- Only super admins can modify methods (via direct DB access, not API)
CREATE POLICY orchestration_methods_admin_write_policy ON orchestration_methods
    FOR ALL
    USING (
        current_setting('app.is_super_admin', true)::boolean = true
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true)::boolean = true
    );

-- ============================================================================
-- 2. ORCHESTRATION WORKFLOWS - System workflows readable, user workflows isolated
-- ============================================================================

ALTER TABLE orchestration_workflows ENABLE ROW LEVEL SECURITY;

-- System workflows (tenant_id IS NULL) are readable by all
-- User-created workflows (tenant_id IS NOT NULL) are only visible to their tenant
CREATE POLICY orchestration_workflows_read_policy ON orchestration_workflows
    FOR SELECT
    USING (
        tenant_id IS NULL  -- System workflows visible to all
        OR tenant_id = current_setting('app.current_tenant_id', true)::uuid  -- User workflows visible to tenant
    );

-- Only the owning tenant can insert/update/delete their workflows
-- System workflows can only be modified by super admins
CREATE POLICY orchestration_workflows_tenant_write_policy ON orchestration_workflows
    FOR INSERT
    WITH CHECK (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

CREATE POLICY orchestration_workflows_tenant_update_policy ON orchestration_workflows
    FOR UPDATE
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
        OR (tenant_id IS NULL AND current_setting('app.is_super_admin', true)::boolean = true)
    )
    WITH CHECK (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
        OR (tenant_id IS NULL AND current_setting('app.is_super_admin', true)::boolean = true)
    );

CREATE POLICY orchestration_workflows_tenant_delete_policy ON orchestration_workflows
    FOR DELETE
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- ============================================================================
-- 3. WORKFLOW METHOD BINDINGS - Follow parent workflow security
-- ============================================================================

ALTER TABLE workflow_method_bindings ENABLE ROW LEVEL SECURITY;

-- Bindings are visible if the parent workflow is visible
CREATE POLICY workflow_method_bindings_read_policy ON workflow_method_bindings
    FOR SELECT
    USING (
        workflow_id IN (
            SELECT workflow_id FROM orchestration_workflows
            WHERE tenant_id IS NULL 
            OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

-- Only allow modifications to bindings for tenant-owned workflows
CREATE POLICY workflow_method_bindings_write_policy ON workflow_method_bindings
    FOR ALL
    USING (
        workflow_id IN (
            SELECT workflow_id FROM orchestration_workflows
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
        OR current_setting('app.is_super_admin', true)::boolean = true
    )
    WITH CHECK (
        workflow_id IN (
            SELECT workflow_id FROM orchestration_workflows
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
        OR current_setting('app.is_super_admin', true)::boolean = true
    );

-- ============================================================================
-- 4. WORKFLOW CUSTOMIZATIONS - Strict tenant isolation
-- ============================================================================

ALTER TABLE workflow_customizations ENABLE ROW LEVEL SECURITY;

-- Tenants can only see their own customizations
CREATE POLICY workflow_customizations_tenant_isolation ON workflow_customizations
    FOR ALL
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
    WITH CHECK (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- Super admins can view all customizations (for support)
CREATE POLICY workflow_customizations_admin_read ON workflow_customizations
    FOR SELECT
    USING (
        current_setting('app.is_super_admin', true)::boolean = true
    );

-- ============================================================================
-- 5. ORCHESTRATION EXECUTIONS - Tenant isolation with full audit
-- ============================================================================

ALTER TABLE orchestration_executions ENABLE ROW LEVEL SECURITY;

-- Tenants can only see their own executions
CREATE POLICY orchestration_executions_tenant_isolation ON orchestration_executions
    FOR ALL
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
    WITH CHECK (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
    );

-- Super admins can view all executions (for debugging/support)
CREATE POLICY orchestration_executions_admin_read ON orchestration_executions
    FOR SELECT
    USING (
        current_setting('app.is_super_admin', true)::boolean = true
    );

-- ============================================================================
-- 6. ORCHESTRATION STEP EXECUTIONS - Follow parent execution security
-- ============================================================================

ALTER TABLE orchestration_step_executions ENABLE ROW LEVEL SECURITY;

-- Step executions are visible if the parent execution is visible
CREATE POLICY orchestration_step_executions_tenant_isolation ON orchestration_step_executions
    FOR ALL
    USING (
        execution_id IN (
            SELECT execution_id FROM orchestration_executions
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    )
    WITH CHECK (
        execution_id IN (
            SELECT execution_id FROM orchestration_executions
            WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid
        )
    );

-- Super admins can view all step executions
CREATE POLICY orchestration_step_executions_admin_read ON orchestration_step_executions
    FOR SELECT
    USING (
        current_setting('app.is_super_admin', true)::boolean = true
    );

-- ============================================================================
-- 7. USER WORKFLOW TEMPLATES - Strict tenant + optional user isolation
-- ============================================================================

ALTER TABLE user_workflow_templates ENABLE ROW LEVEL SECURITY;

-- Users can see:
-- 1. Their own templates
-- 2. Shared templates within their tenant (is_shared = true)
-- 3. Public templates that have been approved (is_public = true AND share_approved_at IS NOT NULL)
CREATE POLICY user_workflow_templates_read_policy ON user_workflow_templates
    FOR SELECT
    USING (
        -- Own templates
        (tenant_id = current_setting('app.current_tenant_id', true)::uuid 
         AND user_id = current_setting('app.current_user_id', true)::uuid)
        -- Shared within tenant
        OR (tenant_id = current_setting('app.current_tenant_id', true)::uuid 
            AND is_shared = true)
        -- Public approved templates
        OR (is_public = true AND share_approved_at IS NOT NULL)
    );

-- Users can only insert/update/delete their own templates
CREATE POLICY user_workflow_templates_owner_write ON user_workflow_templates
    FOR INSERT
    WITH CHECK (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
        AND user_id = current_setting('app.current_user_id', true)::uuid
    );

CREATE POLICY user_workflow_templates_owner_update ON user_workflow_templates
    FOR UPDATE
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
        AND user_id = current_setting('app.current_user_id', true)::uuid
    )
    WITH CHECK (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
        AND user_id = current_setting('app.current_user_id', true)::uuid
    );

CREATE POLICY user_workflow_templates_owner_delete ON user_workflow_templates
    FOR DELETE
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
        AND user_id = current_setting('app.current_user_id', true)::uuid
    );

-- Tenant admins can manage all templates within their tenant
CREATE POLICY user_workflow_templates_tenant_admin ON user_workflow_templates
    FOR ALL
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
        AND current_setting('app.is_tenant_admin', true)::boolean = true
    )
    WITH CHECK (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
        AND current_setting('app.is_tenant_admin', true)::boolean = true
    );

-- Super admins can view and approve public templates
CREATE POLICY user_workflow_templates_super_admin ON user_workflow_templates
    FOR ALL
    USING (
        current_setting('app.is_super_admin', true)::boolean = true
    )
    WITH CHECK (
        current_setting('app.is_super_admin', true)::boolean = true
    );

-- ============================================================================
-- 8. HELPER FUNCTIONS FOR WORKFLOW SECURITY
-- ============================================================================

-- Function to check if user can access a workflow
CREATE OR REPLACE FUNCTION can_access_workflow(p_workflow_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_tenant_id UUID;
    v_is_system BOOLEAN;
BEGIN
    SELECT tenant_id, is_system_workflow
    INTO v_tenant_id, v_is_system
    FROM orchestration_workflows
    WHERE workflow_id = p_workflow_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- System workflows are accessible to all
    IF v_is_system OR v_tenant_id IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- User workflows only accessible to their tenant
    RETURN v_tenant_id = current_setting('app.current_tenant_id', true)::uuid;
END;
$$;

-- Function to check if user can modify a workflow
CREATE OR REPLACE FUNCTION can_modify_workflow(p_workflow_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_tenant_id UUID;
    v_is_system BOOLEAN;
    v_created_by UUID;
BEGIN
    SELECT tenant_id, is_system_workflow, created_by
    INTO v_tenant_id, v_is_system, v_created_by
    FROM orchestration_workflows
    WHERE workflow_id = p_workflow_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Super admins can modify anything
    IF current_setting('app.is_super_admin', true)::boolean = true THEN
        RETURN TRUE;
    END IF;
    
    -- System workflows cannot be modified by regular users
    IF v_is_system OR v_tenant_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Tenant admins can modify any workflow in their tenant
    IF current_setting('app.is_tenant_admin', true)::boolean = true 
       AND v_tenant_id = current_setting('app.current_tenant_id', true)::uuid THEN
        RETURN TRUE;
    END IF;
    
    -- Users can only modify workflows they created
    RETURN v_tenant_id = current_setting('app.current_tenant_id', true)::uuid
           AND v_created_by = current_setting('app.current_user_id', true)::uuid;
END;
$$;

-- Function to get accessible workflows for current user
CREATE OR REPLACE FUNCTION get_accessible_workflows()
RETURNS TABLE (
    workflow_id UUID,
    workflow_code VARCHAR(100),
    common_name VARCHAR(200),
    is_system_workflow BOOLEAN,
    is_own_workflow BOOLEAN,
    can_modify BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.workflow_id,
        w.workflow_code,
        w.common_name,
        w.is_system_workflow,
        (w.tenant_id = current_setting('app.current_tenant_id', true)::uuid) AS is_own_workflow,
        can_modify_workflow(w.workflow_id) AS can_modify
    FROM orchestration_workflows w
    WHERE w.tenant_id IS NULL  -- System workflows
       OR w.tenant_id = current_setting('app.current_tenant_id', true)::uuid;  -- Tenant workflows
END;
$$;

-- ============================================================================
-- 9. AUDIT TRIGGER FOR WORKFLOW MODIFICATIONS
-- ============================================================================

-- Create audit table for workflow changes if it doesn't exist
CREATE TABLE IF NOT EXISTS orchestration_audit_log (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_data JSONB,
    new_data JSONB,
    tenant_id UUID,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orchestration_audit_tenant ON orchestration_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_audit_table ON orchestration_audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_orchestration_audit_record ON orchestration_audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_audit_time ON orchestration_audit_log(changed_at);

ALTER TABLE orchestration_audit_log ENABLE ROW LEVEL SECURITY;

-- Tenants can only see audit logs for their tenant
CREATE POLICY orchestration_audit_log_tenant_isolation ON orchestration_audit_log
    FOR SELECT
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::uuid
        OR current_setting('app.is_super_admin', true)::boolean = true
    );

-- Only system can insert audit logs
CREATE POLICY orchestration_audit_log_system_insert ON orchestration_audit_log
    FOR INSERT
    WITH CHECK (true);

-- Audit function for workflow tables
CREATE OR REPLACE FUNCTION orchestration_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_record_id UUID;
    v_tenant_id UUID;
BEGIN
    -- Determine record ID and tenant based on operation
    IF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_record_id := OLD.workflow_id;
        v_tenant_id := OLD.tenant_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.workflow_id;
        v_tenant_id := NEW.tenant_id;
    ELSIF TG_OP = 'INSERT' THEN
        v_new_data := to_jsonb(NEW);
        v_record_id := NEW.workflow_id;
        v_tenant_id := NEW.tenant_id;
    END IF;
    
    INSERT INTO orchestration_audit_log (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        tenant_id,
        user_id,
        ip_address,
        user_agent
    ) VALUES (
        TG_TABLE_NAME,
        v_record_id,
        TG_OP,
        v_old_data,
        v_new_data,
        v_tenant_id,
        current_setting('app.current_user_id', true)::uuid,
        current_setting('app.client_ip', true)::inet,
        current_setting('app.user_agent', true)
    );
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Don't fail the main operation if audit fails
        RAISE WARNING 'Audit logging failed: %', SQLERRM;
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
END;
$$;

-- Apply audit trigger to workflow tables
DROP TRIGGER IF EXISTS orchestration_workflows_audit ON orchestration_workflows;
CREATE TRIGGER orchestration_workflows_audit
    AFTER INSERT OR UPDATE OR DELETE ON orchestration_workflows
    FOR EACH ROW EXECUTE FUNCTION orchestration_audit_trigger();

DROP TRIGGER IF EXISTS user_workflow_templates_audit ON user_workflow_templates;
CREATE TRIGGER user_workflow_templates_audit
    AFTER INSERT OR UPDATE OR DELETE ON user_workflow_templates
    FOR EACH ROW EXECUTE FUNCTION orchestration_audit_trigger();

DROP TRIGGER IF EXISTS workflow_customizations_audit ON workflow_customizations;
CREATE TRIGGER workflow_customizations_audit
    AFTER INSERT OR UPDATE OR DELETE ON workflow_customizations
    FOR EACH ROW EXECUTE FUNCTION orchestration_audit_trigger();

-- ============================================================================
-- 10. GRANTS FOR API ACCESS
-- ============================================================================

-- Grant execute on helper functions to authenticated users
GRANT EXECUTE ON FUNCTION can_access_workflow(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_modify_workflow(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_accessible_workflows() TO authenticated;

-- ============================================================================
-- 11. COMMENTS
-- ============================================================================

COMMENT ON POLICY orchestration_methods_read_policy ON orchestration_methods IS 
    'All authenticated users can read system methods';
COMMENT ON POLICY orchestration_methods_admin_write_policy ON orchestration_methods IS 
    'Only super admins can modify system methods';

COMMENT ON POLICY orchestration_workflows_read_policy ON orchestration_workflows IS 
    'System workflows visible to all; user workflows visible only to their tenant';
COMMENT ON POLICY orchestration_workflows_tenant_write_policy ON orchestration_workflows IS 
    'Tenants can only create workflows within their tenant';
COMMENT ON POLICY orchestration_workflows_tenant_update_policy ON orchestration_workflows IS 
    'Tenants can update their workflows; super admins can update system workflows';
COMMENT ON POLICY orchestration_workflows_tenant_delete_policy ON orchestration_workflows IS 
    'Tenants can only delete their own workflows';

COMMENT ON POLICY workflow_method_bindings_read_policy ON workflow_method_bindings IS 
    'Bindings visible if parent workflow is visible';
COMMENT ON POLICY workflow_method_bindings_write_policy ON workflow_method_bindings IS 
    'Bindings modifiable if user can modify parent workflow';

COMMENT ON POLICY workflow_customizations_tenant_isolation ON workflow_customizations IS 
    'Strict tenant isolation for workflow customizations';
COMMENT ON POLICY workflow_customizations_admin_read ON workflow_customizations IS 
    'Super admins can view all customizations for support';

COMMENT ON POLICY orchestration_executions_tenant_isolation ON orchestration_executions IS 
    'Strict tenant isolation for execution records';
COMMENT ON POLICY orchestration_executions_admin_read ON orchestration_executions IS 
    'Super admins can view all executions for debugging';

COMMENT ON POLICY orchestration_step_executions_tenant_isolation ON orchestration_step_executions IS 
    'Step executions follow parent execution security';
COMMENT ON POLICY orchestration_step_executions_admin_read ON orchestration_step_executions IS 
    'Super admins can view all step executions';

COMMENT ON POLICY user_workflow_templates_read_policy ON user_workflow_templates IS 
    'Users see own templates, shared tenant templates, and approved public templates';
COMMENT ON POLICY user_workflow_templates_owner_write ON user_workflow_templates IS 
    'Users can only create templates in their tenant for themselves';
COMMENT ON POLICY user_workflow_templates_owner_update ON user_workflow_templates IS 
    'Users can only update their own templates';
COMMENT ON POLICY user_workflow_templates_owner_delete ON user_workflow_templates IS 
    'Users can only delete their own templates';
COMMENT ON POLICY user_workflow_templates_tenant_admin ON user_workflow_templates IS 
    'Tenant admins can manage all templates within their tenant';
COMMENT ON POLICY user_workflow_templates_super_admin ON user_workflow_templates IS 
    'Super admins can approve public templates';

COMMENT ON FUNCTION can_access_workflow(UUID) IS 
    'Check if current user can access a workflow';
COMMENT ON FUNCTION can_modify_workflow(UUID) IS 
    'Check if current user can modify a workflow';
COMMENT ON FUNCTION get_accessible_workflows() IS 
    'Get all workflows accessible to current user with permissions';

COMMENT ON TABLE orchestration_audit_log IS 
    'Audit trail for all workflow-related changes';
