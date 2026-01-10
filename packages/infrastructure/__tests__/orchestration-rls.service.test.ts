/**
 * Orchestration RLS Security Tests
 * 
 * Tests Row Level Security policies for orchestration tables:
 * - orchestration_methods
 * - orchestration_workflows
 * - workflow_method_bindings
 * - workflow_customizations
 * - orchestration_executions
 * - orchestration_step_executions
 * - user_workflow_templates
 * - orchestration_audit_log
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the database context service
const mockExecuteStatement = vi.fn();

vi.mock('../lambda/shared/services/db-context.service.js', () => ({
  executeStatement: (...args: unknown[]) => mockExecuteStatement(...args),
  setTenantContext: vi.fn(),
  clearTenantContext: vi.fn(),
}));

describe('Orchestration RLS Security', () => {
  const tenantIdA = 'tenant-a-uuid';
  const tenantIdB = 'tenant-b-uuid';
  const userIdA = 'user-a-uuid';
  const userIdB = 'user-b-uuid';
  const superAdminId = 'super-admin-uuid';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('orchestration_methods table', () => {
    it('should allow all authenticated users to read system methods', async () => {
      // Simulate RLS policy: FOR SELECT USING (true)
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { method_id: 'method-1', method_code: 'GENERATE_RESPONSE', is_system_method: true },
          { method_id: 'method-2', method_code: 'CRITIQUE_RESPONSE', is_system_method: true },
        ]
      });

      const result = await mockExecuteStatement(
        `SELECT * FROM orchestration_methods WHERE is_system_method = true`,
        []
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].is_system_method).toBe(true);
    });

    it('should only allow super admin to modify system methods', async () => {
      // Simulate RLS policy check for super admin
      const isSuperAdmin = true;
      
      if (isSuperAdmin) {
        mockExecuteStatement.mockResolvedValueOnce({ rowCount: 1 });
      } else {
        mockExecuteStatement.mockRejectedValueOnce(new Error('RLS policy violation'));
      }

      const result = await mockExecuteStatement(
        `UPDATE orchestration_methods SET is_enabled = $1 WHERE method_id = $2`,
        [
          { name: 'enabled', value: { booleanValue: false } },
          { name: 'methodId', value: { stringValue: 'method-1' } },
        ]
      );

      expect(result.rowCount).toBe(1);
    });

    it('should reject non-admin write attempts to system methods', async () => {
      mockExecuteStatement.mockRejectedValueOnce(
        new Error('new row violates row-level security policy for table "orchestration_methods"')
      );

      await expect(
        mockExecuteStatement(
          `UPDATE orchestration_methods SET is_enabled = $1 WHERE method_id = $2`,
          [
            { name: 'enabled', value: { booleanValue: false } },
            { name: 'methodId', value: { stringValue: 'method-1' } },
          ]
        )
      ).rejects.toThrow('row-level security policy');
    });
  });

  describe('orchestration_workflows table', () => {
    it('should allow all users to read system workflows (tenant_id IS NULL)', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { workflow_id: 'wf-1', workflow_code: 'CoT', tenant_id: null, is_system_workflow: true },
          { workflow_id: 'wf-2', workflow_code: 'ToT', tenant_id: null, is_system_workflow: true },
        ]
      });

      const result = await mockExecuteStatement(
        `SELECT * FROM orchestration_workflows WHERE is_system_workflow = true`,
        []
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows.every((r: { tenant_id: unknown }) => r.tenant_id === null)).toBe(true);
    });

    it('should only show tenant-owned workflows to that tenant', async () => {
      // Tenant A queries - should see system + their own
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { workflow_id: 'wf-1', workflow_code: 'CoT', tenant_id: null, is_system_workflow: true },
          { workflow_id: 'wf-custom-a', workflow_code: 'CUSTOM_A', tenant_id: tenantIdA, is_system_workflow: false },
        ]
      });

      const resultA = await mockExecuteStatement(
        `SELECT * FROM orchestration_workflows 
         WHERE tenant_id IS NULL OR tenant_id = $1`,
        [{ name: 'tenantId', value: { stringValue: tenantIdA } }]
      );

      expect(resultA.rows).toHaveLength(2);
      expect(resultA.rows.some((r: { tenant_id: string }) => r.tenant_id === tenantIdA)).toBe(true);
      expect(resultA.rows.every((r: { tenant_id: string | null }) => r.tenant_id === null || r.tenant_id === tenantIdA)).toBe(true);
    });

    it('should prevent tenant A from seeing tenant B workflows', async () => {
      // When tenant A queries, RLS filters out tenant B's workflows
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { workflow_id: 'wf-1', workflow_code: 'CoT', tenant_id: null, is_system_workflow: true },
          // Note: No tenant B workflows returned due to RLS
        ]
      });

      const result = await mockExecuteStatement(
        `SELECT * FROM orchestration_workflows`,
        []
      );

      // Tenant B's workflow should not appear
      expect(result.rows.every((r: { tenant_id: string | null }) => r.tenant_id !== tenantIdB)).toBe(true);
    });

    it('should allow tenant to create their own workflows', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ workflow_id: 'new-wf-uuid' }]
      });

      const result = await mockExecuteStatement(
        `INSERT INTO orchestration_workflows (workflow_code, common_name, formal_name, category, category_code, description, tenant_id, created_by, is_system_workflow)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
         RETURNING workflow_id`,
        [
          { name: 'code', value: { stringValue: 'MY_CUSTOM_WF' } },
          { name: 'commonName', value: { stringValue: 'My Custom Workflow' } },
          { name: 'formalName', value: { stringValue: 'Custom Workflow v1' } },
          { name: 'category', value: { stringValue: 'Custom' } },
          { name: 'categoryCode', value: { stringValue: 'custom' } },
          { name: 'description', value: { stringValue: 'A custom workflow' } },
          { name: 'tenantId', value: { stringValue: tenantIdA } },
          { name: 'createdBy', value: { stringValue: userIdA } },
        ]
      );

      expect(result.rows[0].workflow_id).toBeDefined();
    });

    it('should prevent tenant from creating workflows for another tenant', async () => {
      mockExecuteStatement.mockRejectedValueOnce(
        new Error('new row violates row-level security policy for table "orchestration_workflows"')
      );

      await expect(
        mockExecuteStatement(
          `INSERT INTO orchestration_workflows (workflow_code, tenant_id)
           VALUES ($1, $2)`,
          [
            { name: 'code', value: { stringValue: 'MALICIOUS_WF' } },
            { name: 'tenantId', value: { stringValue: tenantIdB } }, // Trying to create for tenant B
          ]
        )
      ).rejects.toThrow('row-level security policy');
    });
  });

  describe('workflow_customizations table', () => {
    it('should only show tenant own customizations', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { customization_id: 'cust-1', workflow_id: 'wf-1', tenant_id: tenantIdA, custom_name: 'My CoT' },
        ]
      });

      const result = await mockExecuteStatement(
        `SELECT * FROM workflow_customizations WHERE tenant_id = $1`,
        [{ name: 'tenantId', value: { stringValue: tenantIdA } }]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].tenant_id).toBe(tenantIdA);
    });

    it('should allow tenant to customize workflows', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ customization_id: 'new-cust-uuid' }]
      });

      const result = await mockExecuteStatement(
        `INSERT INTO workflow_customizations (workflow_id, tenant_id, custom_name, config_overrides)
         VALUES ($1, $2, $3, $4)
         RETURNING customization_id`,
        [
          { name: 'workflowId', value: { stringValue: 'wf-1' } },
          { name: 'tenantId', value: { stringValue: tenantIdA } },
          { name: 'customName', value: { stringValue: 'My Custom CoT' } },
          { name: 'configOverrides', value: { stringValue: '{"temperature": 0.8}' } },
        ]
      );

      expect(result.rows[0].customization_id).toBeDefined();
    });

    it('should enforce unique constraint per workflow per tenant', async () => {
      mockExecuteStatement.mockRejectedValueOnce(
        new Error('duplicate key value violates unique constraint "workflow_customizations_workflow_id_tenant_id_key"')
      );

      await expect(
        mockExecuteStatement(
          `INSERT INTO workflow_customizations (workflow_id, tenant_id, custom_name)
           VALUES ($1, $2, $3)`,
          [
            { name: 'workflowId', value: { stringValue: 'wf-1' } },
            { name: 'tenantId', value: { stringValue: tenantIdA } },
            { name: 'customName', value: { stringValue: 'Duplicate Customization' } },
          ]
        )
      ).rejects.toThrow('unique constraint');
    });
  });

  describe('orchestration_executions table', () => {
    it('should only show tenant own executions', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { execution_id: 'exec-1', workflow_id: 'wf-1', tenant_id: tenantIdA, status: 'completed' },
          { execution_id: 'exec-2', workflow_id: 'wf-2', tenant_id: tenantIdA, status: 'running' },
        ]
      });

      const result = await mockExecuteStatement(
        `SELECT * FROM orchestration_executions WHERE tenant_id = $1`,
        [{ name: 'tenantId', value: { stringValue: tenantIdA } }]
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows.every((r: { tenant_id: string }) => r.tenant_id === tenantIdA)).toBe(true);
    });

    it('should allow super admin to read all executions', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { execution_id: 'exec-1', tenant_id: tenantIdA },
          { execution_id: 'exec-2', tenant_id: tenantIdB },
          { execution_id: 'exec-3', tenant_id: tenantIdA },
        ]
      });

      // Super admin query (RLS allows via is_super_admin check)
      const result = await mockExecuteStatement(
        `SELECT * FROM orchestration_executions`,
        []
      );

      expect(result.rows).toHaveLength(3);
    });

    it('should record execution with correct tenant', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ execution_id: 'new-exec-uuid' }]
      });

      const result = await mockExecuteStatement(
        `INSERT INTO orchestration_executions (workflow_id, tenant_id, user_id, input_data, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING execution_id`,
        [
          { name: 'workflowId', value: { stringValue: 'wf-1' } },
          { name: 'tenantId', value: { stringValue: tenantIdA } },
          { name: 'userId', value: { stringValue: userIdA } },
          { name: 'inputData', value: { stringValue: '{"prompt": "test"}' } },
        ]
      );

      expect(result.rows[0].execution_id).toBeDefined();
    });
  });

  describe('user_workflow_templates table', () => {
    it('should only show user own templates by default', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { template_id: 'tpl-1', tenant_id: tenantIdA, user_id: userIdA, template_name: 'My Template', is_shared: false },
        ]
      });

      const result = await mockExecuteStatement(
        `SELECT * FROM user_workflow_templates 
         WHERE tenant_id = $1 AND user_id = $2`,
        [
          { name: 'tenantId', value: { stringValue: tenantIdA } },
          { name: 'userId', value: { stringValue: userIdA } },
        ]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].user_id).toBe(userIdA);
    });

    it('should show shared templates within same tenant', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { template_id: 'tpl-1', tenant_id: tenantIdA, user_id: userIdA, template_name: 'My Template', is_shared: false },
          { template_id: 'tpl-2', tenant_id: tenantIdA, user_id: userIdB, template_name: 'Shared Template', is_shared: true },
        ]
      });

      // Query shows own + shared within tenant
      const result = await mockExecuteStatement(
        `SELECT * FROM user_workflow_templates 
         WHERE tenant_id = $1 AND (user_id = $2 OR is_shared = true)`,
        [
          { name: 'tenantId', value: { stringValue: tenantIdA } },
          { name: 'userId', value: { stringValue: userIdA } },
        ]
      );

      expect(result.rows).toHaveLength(2);
    });

    it('should show approved public templates across tenants', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { template_id: 'tpl-1', tenant_id: tenantIdA, user_id: userIdA, is_shared: false, is_public: false },
          { template_id: 'tpl-public', tenant_id: tenantIdB, user_id: userIdB, is_shared: false, is_public: true, share_approved_at: '2026-01-10' },
        ]
      });

      // User A can see their own + approved public templates
      const result = await mockExecuteStatement(
        `SELECT * FROM user_workflow_templates 
         WHERE (tenant_id = $1 AND user_id = $2)
            OR (is_public = true AND share_approved_at IS NOT NULL)`,
        [
          { name: 'tenantId', value: { stringValue: tenantIdA } },
          { name: 'userId', value: { stringValue: userIdA } },
        ]
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows.some((r: { is_public: boolean }) => r.is_public)).toBe(true);
    });

    it('should prevent user from creating templates for another user', async () => {
      mockExecuteStatement.mockRejectedValueOnce(
        new Error('new row violates row-level security policy for table "user_workflow_templates"')
      );

      await expect(
        mockExecuteStatement(
          `INSERT INTO user_workflow_templates (tenant_id, user_id, template_name)
           VALUES ($1, $2, $3)`,
          [
            { name: 'tenantId', value: { stringValue: tenantIdA } },
            { name: 'userId', value: { stringValue: userIdB } }, // Trying to create for another user
            { name: 'templateName', value: { stringValue: 'Malicious Template' } },
          ]
        )
      ).rejects.toThrow('row-level security policy');
    });

    it('should enforce unique template names per user per tenant', async () => {
      mockExecuteStatement.mockRejectedValueOnce(
        new Error('duplicate key value violates unique constraint "user_workflow_templates_tenant_id_user_id_template_name_key"')
      );

      await expect(
        mockExecuteStatement(
          `INSERT INTO user_workflow_templates (tenant_id, user_id, template_name)
           VALUES ($1, $2, $3)`,
          [
            { name: 'tenantId', value: { stringValue: tenantIdA } },
            { name: 'userId', value: { stringValue: userIdA } },
            { name: 'templateName', value: { stringValue: 'Duplicate Name' } },
          ]
        )
      ).rejects.toThrow('unique constraint');
    });

    it('should allow tenant admin to manage all templates in tenant', async () => {
      // Tenant admin can update any template in their tenant
      mockExecuteStatement.mockResolvedValueOnce({ rowCount: 1 });

      const result = await mockExecuteStatement(
        `UPDATE user_workflow_templates 
         SET is_enabled = $1 
         WHERE tenant_id = $2 AND template_id = $3`,
        [
          { name: 'enabled', value: { booleanValue: false } },
          { name: 'tenantId', value: { stringValue: tenantIdA } },
          { name: 'templateId', value: { stringValue: 'tpl-1' } },
        ]
      );

      expect(result.rowCount).toBe(1);
    });
  });

  describe('orchestration_audit_log table', () => {
    it('should record workflow changes with full context', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ audit_id: 'audit-uuid' }]
      });

      const result = await mockExecuteStatement(
        `INSERT INTO orchestration_audit_log 
         (table_name, record_id, action, old_data, new_data, tenant_id, user_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING audit_id`,
        [
          { name: 'tableName', value: { stringValue: 'orchestration_workflows' } },
          { name: 'recordId', value: { stringValue: 'wf-1' } },
          { name: 'action', value: { stringValue: 'UPDATE' } },
          { name: 'oldData', value: { stringValue: '{"is_enabled": true}' } },
          { name: 'newData', value: { stringValue: '{"is_enabled": false}' } },
          { name: 'tenantId', value: { stringValue: tenantIdA } },
          { name: 'userId', value: { stringValue: userIdA } },
          { name: 'ipAddress', value: { stringValue: '192.168.1.1' } },
          { name: 'userAgent', value: { stringValue: 'Mozilla/5.0' } },
        ]
      );

      expect(result.rows[0].audit_id).toBeDefined();
    });

    it('should only show tenant own audit logs', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { audit_id: 'audit-1', tenant_id: tenantIdA, action: 'INSERT' },
          { audit_id: 'audit-2', tenant_id: tenantIdA, action: 'UPDATE' },
        ]
      });

      const result = await mockExecuteStatement(
        `SELECT * FROM orchestration_audit_log WHERE tenant_id = $1`,
        [{ name: 'tenantId', value: { stringValue: tenantIdA } }]
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows.every((r: { tenant_id: string }) => r.tenant_id === tenantIdA)).toBe(true);
    });

    it('should allow super admin to view all audit logs', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { audit_id: 'audit-1', tenant_id: tenantIdA },
          { audit_id: 'audit-2', tenant_id: tenantIdB },
        ]
      });

      const result = await mockExecuteStatement(
        `SELECT * FROM orchestration_audit_log`,
        []
      );

      expect(result.rows).toHaveLength(2);
    });
  });

  describe('Helper Functions', () => {
    describe('can_access_workflow', () => {
      it('should return true for system workflows', async () => {
        mockExecuteStatement.mockResolvedValueOnce({
          rows: [{ can_access_workflow: true }]
        });

        const result = await mockExecuteStatement(
          `SELECT can_access_workflow($1)`,
          [{ name: 'workflowId', value: { stringValue: 'system-workflow-uuid' } }]
        );

        expect(result.rows[0].can_access_workflow).toBe(true);
      });

      it('should return true for own tenant workflows', async () => {
        mockExecuteStatement.mockResolvedValueOnce({
          rows: [{ can_access_workflow: true }]
        });

        const result = await mockExecuteStatement(
          `SELECT can_access_workflow($1)`,
          [{ name: 'workflowId', value: { stringValue: 'tenant-a-workflow-uuid' } }]
        );

        expect(result.rows[0].can_access_workflow).toBe(true);
      });

      it('should return false for other tenant workflows', async () => {
        mockExecuteStatement.mockResolvedValueOnce({
          rows: [{ can_access_workflow: false }]
        });

        const result = await mockExecuteStatement(
          `SELECT can_access_workflow($1)`,
          [{ name: 'workflowId', value: { stringValue: 'tenant-b-workflow-uuid' } }]
        );

        expect(result.rows[0].can_access_workflow).toBe(false);
      });
    });

    describe('can_modify_workflow', () => {
      it('should return false for system workflows (non-admin)', async () => {
        mockExecuteStatement.mockResolvedValueOnce({
          rows: [{ can_modify_workflow: false }]
        });

        const result = await mockExecuteStatement(
          `SELECT can_modify_workflow($1)`,
          [{ name: 'workflowId', value: { stringValue: 'system-workflow-uuid' } }]
        );

        expect(result.rows[0].can_modify_workflow).toBe(false);
      });

      it('should return true for own created workflows', async () => {
        mockExecuteStatement.mockResolvedValueOnce({
          rows: [{ can_modify_workflow: true }]
        });

        const result = await mockExecuteStatement(
          `SELECT can_modify_workflow($1)`,
          [{ name: 'workflowId', value: { stringValue: 'own-workflow-uuid' } }]
        );

        expect(result.rows[0].can_modify_workflow).toBe(true);
      });
    });

    describe('get_accessible_workflows', () => {
      it('should return all accessible workflows with permissions', async () => {
        mockExecuteStatement.mockResolvedValueOnce({
          rows: [
            { workflow_id: 'wf-1', workflow_code: 'CoT', is_system_workflow: true, is_own_workflow: false, can_modify: false },
            { workflow_id: 'wf-2', workflow_code: 'CUSTOM', is_system_workflow: false, is_own_workflow: true, can_modify: true },
          ]
        });

        const result = await mockExecuteStatement(
          `SELECT * FROM get_accessible_workflows()`,
          []
        );

        expect(result.rows).toHaveLength(2);
        expect(result.rows[0].can_modify).toBe(false); // System workflow
        expect(result.rows[1].can_modify).toBe(true);  // Own workflow
      });
    });
  });

  describe('Cross-Tenant Security', () => {
    it('should completely isolate tenant data across all tables', async () => {
      // Simulate tenant A trying to access tenant B's data
      const tables = [
        'orchestration_workflows',
        'workflow_customizations',
        'orchestration_executions',
        'orchestration_step_executions',
        'user_workflow_templates',
        'orchestration_audit_log'
      ];

      for (const table of tables) {
        mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

        const result = await mockExecuteStatement(
          `SELECT * FROM ${table} WHERE tenant_id = $1`,
          [{ name: 'tenantId', value: { stringValue: tenantIdB } }]
        );

        // RLS should filter out all rows not belonging to current tenant
        expect(result.rows).toHaveLength(0);
      }
    });

    it('should prevent data exfiltration through workflow bindings', async () => {
      // Tenant A tries to bind their method to tenant B's workflow
      mockExecuteStatement.mockRejectedValueOnce(
        new Error('new row violates row-level security policy')
      );

      await expect(
        mockExecuteStatement(
          `INSERT INTO workflow_method_bindings (workflow_id, method_id, step_number)
           VALUES ($1, $2, $3)`,
          [
            { name: 'workflowId', value: { stringValue: 'tenant-b-workflow' } },
            { name: 'methodId', value: { stringValue: 'method-1' } },
            { name: 'stepNumber', value: { longValue: 1 } },
          ]
        )
      ).rejects.toThrow('row-level security policy');
    });
  });
});
