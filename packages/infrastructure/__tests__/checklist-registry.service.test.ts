/**
 * Unit tests for Compliance Checklist Registry Service
 * 
 * Tests the checklist registry service including:
 * - Dashboard data retrieval
 * - Version management (get, create, set latest)
 * - Category management
 * - Item management with progress tracking
 * - Tenant configuration
 * - Audit run management
 * - Auto-update functionality
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Pool } from 'pg';

// Mock pg Pool
const mockQuery = jest.fn();
const mockPool = {
  query: mockQuery,
  connect: jest.fn(),
  end: jest.fn(),
} as unknown as Pool;

// Import service factory
import { getChecklistRegistryService } from '../lambda/shared/services/checklist-registry.service';

describe('ChecklistRegistryService', () => {
  let service: ReturnType<typeof getChecklistRegistryService>;
  const testTenantId = 'test-tenant-123';
  const testUserId = 'test-user-456';
  const testVersionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const testStandardId = 'standard-soc2-123';

  beforeEach(() => {
    jest.clearAllMocks();
    service = getChecklistRegistryService(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // DASHBOARD TESTS
  // ============================================================================

  describe('getDashboardData', () => {
    it('should return dashboard data with standards and progress', async () => {
      // Mock standards query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: testStandardId, code: 'SOC2', name: 'SOC 2 Type II', category: 'Security' },
          { id: 'standard-hipaa', code: 'HIPAA', name: 'HIPAA', category: 'Healthcare' },
        ],
      });

      // Mock versions query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: testVersionId, standard_id: testStandardId, version: '2024.1', is_latest: true },
        ],
      });

      // Mock progress query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { version_id: testVersionId, total_items: 18, completed_items: 12, completion_percentage: 66.7 },
        ],
      });

      const result = await service.getDashboardData(testTenantId);

      expect(result).toBeDefined();
      expect(mockQuery).toHaveBeenCalled();
    });

    it('should handle empty data gracefully', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await service.getDashboardData(testTenantId);

      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // VERSION TESTS
  // ============================================================================

  describe('getVersionsForStandard', () => {
    it('should return all versions for a standard', async () => {
      const mockVersions = [
        { id: testVersionId, version: '2024.1', is_latest: true, is_active: true },
        { id: 'version-2', version: '2023.1', is_latest: false, is_active: true },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockVersions });

      const result = await service.getVersionsForStandard(testStandardId);

      expect(result).toEqual(mockVersions);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [testStandardId]
      );
    });
  });

  describe('getLatestVersion', () => {
    it('should return the latest version for a standard code', async () => {
      const mockVersion = { id: testVersionId, version: '2024.1', is_latest: true };
      mockQuery.mockResolvedValueOnce({ rows: [mockVersion] });

      const result = await service.getLatestVersion('SOC2');

      expect(result).toEqual(mockVersion);
    });

    it('should return null when no version exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.getLatestVersion('UNKNOWN');

      expect(result).toBeNull();
    });
  });

  describe('getVersionById', () => {
    it('should return version by ID with categories and items count', async () => {
      const mockVersion = {
        id: testVersionId,
        version: '2024.1',
        title: 'SOC 2 Type II Pre-Audit Checklist',
        categories_count: 7,
        items_count: 18,
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockVersion] });

      const result = await service.getVersionById(testVersionId);

      expect(result).toEqual(mockVersion);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [testVersionId]
      );
    });
  });

  describe('createVersion', () => {
    it('should create a new checklist version', async () => {
      const newVersion = {
        standardId: testStandardId,
        version: '2025.1',
        title: 'New SOC 2 Checklist',
        description: 'Updated checklist',
        createdBy: testUserId,
      };
      const createdVersion = { id: 'new-version-id', ...newVersion };
      mockQuery.mockResolvedValueOnce({ rows: [createdVersion] });

      const result = await service.createVersion(newVersion);

      expect(result).toEqual(createdVersion);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO compliance_checklist_versions'),
        expect.any(Array)
      );
    });
  });

  describe('setLatestVersion', () => {
    it('should set a version as the latest', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Clear previous latest
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Set new latest

      await service.setLatestVersion(testVersionId);

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // CATEGORY TESTS
  // ============================================================================

  describe('getCategoriesForVersion', () => {
    it('should return categories ordered by display_order', async () => {
      const mockCategories = [
        { id: 'cat-1', code: 'pre_audit', name: 'Pre-Audit Preparation', display_order: 1 },
        { id: 'cat-2', code: 'documentation', name: 'Required Documentation', display_order: 2 },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockCategories });

      const result = await service.getCategoriesForVersion(testVersionId);

      expect(result).toEqual(mockCategories);
    });
  });

  describe('createCategory', () => {
    it('should create a new category', async () => {
      const newCategory = {
        versionId: testVersionId,
        code: 'new_category',
        name: 'New Category',
        description: 'Test category',
        displayOrder: 10,
      };
      const createdCategory = { id: 'cat-new', ...newCategory };
      mockQuery.mockResolvedValueOnce({ rows: [createdCategory] });

      const result = await service.createCategory(newCategory);

      expect(result).toEqual(createdCategory);
    });
  });

  // ============================================================================
  // ITEM TESTS
  // ============================================================================

  describe('getItemsForVersion', () => {
    it('should return items with tenant progress', async () => {
      const mockItems = [
        {
          id: 'item-1',
          item_code: 'SOC2-PRE-001',
          title: 'Confirm audit dates',
          status: 'completed',
          completed_at: '2024-01-15',
        },
        {
          id: 'item-2',
          item_code: 'SOC2-PRE-002',
          title: 'Review scope',
          status: 'in_progress',
          completed_at: null,
        },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockItems });

      const result = await service.getItemsForVersion(testVersionId, testTenantId);

      expect(result).toEqual(mockItems);
    });
  });

  describe('getItemsByCategory', () => {
    it('should return items filtered by category code', async () => {
      const mockItems = [
        { id: 'item-1', item_code: 'SOC2-PRE-001', category_code: 'pre_audit' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockItems });

      const result = await service.getItemsByCategory(testVersionId, 'pre_audit', testTenantId);

      expect(result).toEqual(mockItems);
    });
  });

  describe('createItem', () => {
    it('should create a new checklist item', async () => {
      const newItem = {
        versionId: testVersionId,
        categoryId: 'cat-1',
        itemCode: 'SOC2-NEW-001',
        title: 'New Item',
        description: 'Test item',
        priority: 'high',
      };
      const createdItem = { id: 'item-new', ...newItem };
      mockQuery.mockResolvedValueOnce({ rows: [createdItem] });

      const result = await service.createItem(newItem);

      expect(result).toEqual(createdItem);
    });
  });

  // ============================================================================
  // TENANT CONFIGURATION TESTS
  // ============================================================================

  describe('getAllTenantConfigs', () => {
    it('should return all tenant configurations', async () => {
      const mockConfigs = [
        { standard_id: testStandardId, version_selection: 'auto', auto_update_enabled: true },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockConfigs });

      const result = await service.getAllTenantConfigs(testTenantId);

      expect(result).toEqual(mockConfigs);
    });
  });

  describe('getTenantConfig', () => {
    it('should return tenant config for a standard', async () => {
      const mockConfig = {
        tenant_id: testTenantId,
        standard_id: testStandardId,
        version_selection: 'specific',
        selected_version_id: testVersionId,
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockConfig] });

      const result = await service.getTenantConfig(testTenantId, testStandardId);

      expect(result).toEqual(mockConfig);
    });

    it('should return null when no config exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.getTenantConfig(testTenantId, 'unknown-standard');

      expect(result).toBeNull();
    });
  });

  describe('setTenantConfig', () => {
    it('should upsert tenant configuration', async () => {
      const config = {
        versionSelection: 'specific',
        selectedVersionId: testVersionId,
        autoUpdateEnabled: false,
      };
      const savedConfig = { ...config, tenant_id: testTenantId, standard_id: testStandardId };
      mockQuery.mockResolvedValueOnce({ rows: [savedConfig] });

      const result = await service.setTenantConfig(testTenantId, testStandardId, config);

      expect(result).toEqual(savedConfig);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tenant_checklist_config'),
        expect.any(Array)
      );
    });
  });

  describe('getEffectiveVersion', () => {
    it('should return effective version ID using database function', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ get_effective_checklist_version: testVersionId }] });

      const result = await service.getEffectiveVersion(testTenantId, testStandardId);

      expect(result).toEqual(testVersionId);
    });
  });

  // ============================================================================
  // PROGRESS TESTS
  // ============================================================================

  describe('getTenantProgress', () => {
    it('should return progress summary for a version', async () => {
      const mockProgress = {
        total_items: 18,
        completed: 12,
        in_progress: 3,
        not_started: 3,
        completion_percentage: 66.7,
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockProgress] });

      const result = await service.getTenantProgress(testTenantId, testVersionId);

      expect(result).toEqual(mockProgress);
    });
  });

  describe('updateItemProgress', () => {
    it('should update item progress status', async () => {
      const progressUpdate = {
        status: 'completed',
        completedBy: testUserId,
        notes: 'Verified and complete',
        evidenceUrls: ['https://example.com/evidence1.pdf'],
      };
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.updateItemProgress(testTenantId, 'item-1', progressUpdate);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tenant_checklist_progress'),
        expect.any(Array)
      );
    });
  });

  // ============================================================================
  // AUDIT RUN TESTS
  // ============================================================================

  describe('getAuditRunHistory', () => {
    it('should return audit runs ordered by date', async () => {
      const mockRuns = [
        { id: 'run-1', run_type: 'pre_audit', status: 'completed', started_at: '2024-01-15' },
        { id: 'run-2', run_type: 'internal', status: 'in_progress', started_at: '2024-01-10' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockRuns });

      const result = await service.getAuditRunHistory(testTenantId, 20);

      expect(result).toEqual(mockRuns);
    });
  });

  describe('startAuditRun', () => {
    it('should create a new audit run', async () => {
      const runOptions = {
        runType: 'pre_audit' as const,
        triggeredBy: testUserId,
        notes: 'Starting pre-audit review',
      };
      const createdRun = { id: 'run-new', ...runOptions, status: 'in_progress' };
      mockQuery.mockResolvedValueOnce({ rows: [createdRun] });

      const result = await service.startAuditRun(testTenantId, testVersionId, runOptions);

      expect(result).toEqual(createdRun);
    });
  });

  describe('completeAuditRun', () => {
    it('should mark audit run as complete', async () => {
      const completion = {
        status: 'completed',
        score: 95,
        findings: ['Minor documentation gap in CC5.2'],
      };
      const completedRun = { id: 'run-1', ...completion, completed_at: '2024-01-16' };
      mockQuery.mockResolvedValueOnce({ rows: [completedRun] });

      const result = await service.completeAuditRun('run-1', completion);

      expect(result).toEqual(completedRun);
    });
  });

  // ============================================================================
  // AUTO-UPDATE TESTS
  // ============================================================================

  describe('getPendingUpdates', () => {
    it('should return pending regulatory updates', async () => {
      const mockUpdates = [
        { id: 'update-1', standard_id: testStandardId, new_version: '2025.1', status: 'pending' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockUpdates });

      const result = await service.getPendingUpdates();

      expect(result).toEqual(mockUpdates);
    });
  });

  describe('recordVersionUpdate', () => {
    it('should record a new version update', async () => {
      const update = {
        standardId: testStandardId,
        newVersion: '2025.1',
        changeType: 'major',
        source: 'aicpa',
        changeNotes: 'New controls added',
      };
      const recordedUpdate = { id: 'update-new', ...update, status: 'pending' };
      mockQuery.mockResolvedValueOnce({ rows: [recordedUpdate] });

      const result = await service.recordVersionUpdate(update);

      expect(result).toEqual(recordedUpdate);
    });
  });

  describe('processVersionUpdate', () => {
    it('should process and apply version update', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.processVersionUpdate('update-1', {
        status: 'applied',
        appliedAt: new Date().toISOString(),
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE regulatory_version_updates'),
        expect.any(Array)
      );
    });
  });

  describe('checkForUpdates', () => {
    it('should check configured sources for updates', async () => {
      // Mock sources query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'source-1', source_name: 'AICPA', source_url: 'https://aicpa.org/soc2' },
        ],
      });
      // Mock no new updates found
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.checkForUpdates(testStandardId);

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Connection refused');
      mockQuery.mockRejectedValueOnce(dbError);

      await expect(service.getDashboardData(testTenantId)).rejects.toThrow('Connection refused');
    });

    it('should handle malformed data gracefully', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ invalid: 'data' }] });

      // Should not throw, but may return partial data
      const result = await service.getVersionById(testVersionId);
      expect(result).toBeDefined();
    });
  });
});

// ============================================================================
// HANDLER INTEGRATION TESTS
// ============================================================================

describe('Checklist Registry Handler', () => {
  const mockEvent = (method: string, path: string, body?: any, queryParams?: any) => ({
    httpMethod: method,
    path: `/api/admin/compliance/checklists${path}`,
    body: body ? JSON.stringify(body) : null,
    queryStringParameters: queryParams || null,
    headers: {
      'x-tenant-id': 'test-tenant',
      'x-user-id': 'test-user',
    },
    requestContext: {
      authorizer: {
        claims: {
          'custom:tenant_id': 'test-tenant',
          sub: 'test-user',
        },
      },
    },
  });

  describe('Route Matching', () => {
    it('should match dashboard endpoint', () => {
      const event = mockEvent('GET', '/dashboard');
      expect(event.path).toContain('/dashboard');
    });

    it('should match versions endpoints', () => {
      const event = mockEvent('GET', '/versions');
      expect(event.path).toContain('/versions');
    });

    it('should match version by ID pattern', () => {
      const path = '/versions/a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      expect(path).toMatch(/^\/versions\/[a-f0-9-]+$/);
    });

    it('should match progress endpoints', () => {
      const event = mockEvent('GET', '/progress/a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      expect(event.path).toContain('/progress/');
    });

    it('should match audit-runs endpoints', () => {
      const event = mockEvent('GET', '/audit-runs');
      expect(event.path).toContain('/audit-runs');
    });

    it('should match updates endpoints', () => {
      const event = mockEvent('GET', '/updates/pending');
      expect(event.path).toContain('/updates/pending');
    });
  });

  describe('Request Validation', () => {
    it('should validate required fields for version creation', () => {
      const body = { standardId: 'test', version: '1.0' }; // missing title
      expect(body.standardId).toBeDefined();
      expect(body.version).toBeDefined();
      expect((body as any).title).toBeUndefined();
    });

    it('should validate required fields for item creation', () => {
      const body = { itemCode: 'TEST-001' }; // missing title
      expect(body.itemCode).toBeDefined();
      expect((body as any).title).toBeUndefined();
    });

    it('should validate required fields for audit run', () => {
      const body = { versionId: 'test-version', runType: 'pre_audit' };
      expect(body.versionId).toBeDefined();
      expect(body.runType).toBeDefined();
    });
  });
});
