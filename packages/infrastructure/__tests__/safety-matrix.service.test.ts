/**
 * Unit Tests for Safety Matrix Service
 * 
 * Tests for entity management, action management, contraindication CRUD,
 * and real-time checking functionality.
 */

// Mock the database client
jest.mock('../lambda/shared/db/client', () => ({
  executeStatement: jest.fn(),
  stringParam: jest.fn((name: string, value: string) => ({ name, value })),
  doubleParam: jest.fn((name: string, value: number) => ({ name, value })),
  boolParam: jest.fn((name: string, value: boolean) => ({ name, value })),
}));

// Mock the logger
jest.mock('../lambda/shared/logging/enhanced-logger', () => ({
  enhancedLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { executeStatement } from '../lambda/shared/db/client';

// Import service instance after mocking
import { safetyMatrixService } from '../lambda/shared/services/safety-matrix.service';

describe('SafetyMatrixService', () => {
  const service = safetyMatrixService;
  const mockExecuteStatement = executeStatement as jest.Mock;
  const testTenantId = 'tenant-123';
  const testDomainId = 'domain-healthcare';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('listEntities', () => {
    it('should return empty array when no entities', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const result = await service.listEntities({
        tenantId: testTenantId,
        domainId: testDomainId,
      });

      expect(result.entities).toEqual([]);
    });

    it('should return mapped entities', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          {
            id: 'entity-1',
            tenant_id: testTenantId,
            domain_id: testDomainId,
            name: 'Aspirin',
            category: 'medication',
            description: 'Pain reliever',
            subcategory: 'NSAID',
            external_ids: '{}',
            tags: '[]',
            risk_level: 'medium',
            contraindication_count: 5,
            verified: true,
            created_at: '2026-01-15T10:00:00Z',
            updated_at: '2026-01-15T10:00:00Z',
          },
        ],
      });

      const result = await service.listEntities({
        tenantId: testTenantId,
        domainId: testDomainId,
      });

      expect(result.entities.length).toBe(1);
      expect(result.entities[0].name).toBe('Aspirin');
      expect(result.entities[0].category).toBe('medication');
    });

    it('should filter by category when provided', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          {
            id: 'entity-1',
            tenant_id: testTenantId,
            domain_id: testDomainId,
            name: 'Aspirin',
            category: 'medication',
            description: 'Pain reliever',
            subcategory: null,
            external_ids: '{}',
            tags: '[]',
            risk_level: 'low',
            contraindication_count: 2,
            verified: true,
            created_at: '2026-01-15T10:00:00Z',
            updated_at: '2026-01-15T10:00:00Z',
          },
        ],
      });

      const result = await service.listEntities({
        tenantId: testTenantId,
        domainId: testDomainId,
        category: 'medication',
      });

      expect(result.entities.length).toBe(1);
      expect(result.entities[0].category).toBe('medication');
    });
  });

  describe('getEntity', () => {
    it('should return null when entity not found', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const result = await service.getEntity(testTenantId, 'non-existent');

      expect(result).toBeNull();
    });

    it('should return entity when found', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          {
            id: 'entity-1',
            tenant_id: testTenantId,
            domain_id: testDomainId,
            name: 'Aspirin',
            category: 'medication',
            description: 'Pain reliever',
            subcategory: null,
            external_ids: '{}',
            tags: '[]',
            risk_level: 'low',
            contraindication_count: 2,
            verified: true,
            created_at: '2026-01-15T10:00:00Z',
            updated_at: '2026-01-15T10:00:00Z',
          },
        ],
      });

      const result = await service.getEntity(testTenantId, 'entity-1');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Aspirin');
    });
  });

  describe('checkContraindication', () => {
    it('should return no contraindication when none found', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const result = await service.checkContraindication({
        tenantId: testTenantId,
        domainId: testDomainId,
        entityId: 'entity-1',
        actionId: 'action-1',
      });

      expect(result.hasContraindication).toBe(false);
      expect(result.contraindications).toEqual([]);
      expect(result.canOverride).toBe(true);
    });

    it('should return contraindication when found', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          {
            id: 'contra-1',
            tenant_id: testTenantId,
            domain_id: testDomainId,
            entity_id: 'entity-1',
            action_id: 'action-1',
            second_entity_id: null,
            severity: 'absolute',
            reason: 'Critical interaction',
            clinical_evidence: 'Study XYZ',
            regulatory_reference: 'FDA-123',
            conditions: '[]',
            exceptions: '[]',
            alternatives: '[]',
            allow_override: false,
            override_requires: 'none',
            status: 'active',
            created_at: '2026-01-15T10:00:00Z',
            updated_at: '2026-01-15T10:00:00Z',
          },
        ],
      });

      const result = await service.checkContraindication({
        tenantId: testTenantId,
        domainId: testDomainId,
        entityId: 'entity-1',
        actionId: 'action-1',
      });

      expect(result.hasContraindication).toBe(true);
      expect(result.contraindications.length).toBe(1);
      expect(result.severity).toBe('absolute');
      expect(result.canOverride).toBe(false);
    });
  });

  describe('getMatrixGrid', () => {
    it('should return empty grid when no data', async () => {
      // Mock entities
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });
      // Mock actions
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });
      // Mock contraindications
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const result = await service.getMatrixGrid({
        tenantId: testTenantId,
        domainId: testDomainId,
      });

      expect(result.rows).toEqual([]);
    });
  });

  describe('reviewContraindication', () => {
    it('should approve a contraindication', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      // Should not throw
      await expect(
        service.reviewContraindication(
          testTenantId,
          'contra-1',
          'user-123',
          { approved: true, notes: 'Verified' }
        )
      ).resolves.toBeUndefined();

      expect(mockExecuteStatement).toHaveBeenCalled();
    });

    it('should reject a contraindication', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.reviewContraindication(
          testTenantId,
          'contra-1',
          'user-123',
          { approved: false, notes: 'Insufficient evidence' }
        )
      ).resolves.toBeUndefined();

      expect(mockExecuteStatement).toHaveBeenCalled();
    });
  });
});
