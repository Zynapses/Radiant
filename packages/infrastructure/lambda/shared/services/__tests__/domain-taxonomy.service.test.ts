import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../db/client', () => ({
  executeStatement: vi.fn(),
  stringParam: vi.fn((name: string, value: string) => ({ name, value: { stringValue: value } })),
  longParam: vi.fn((name: string, value: number) => ({ name, value: { longValue: value } })),
}));

vi.mock('../../logging/enhanced-logger', () => ({
  enhancedLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { executeStatement } from '../../db/client';

const mockExecuteStatement = executeStatement as ReturnType<typeof vi.fn>;

describe('DomainTaxonomyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectDomain', () => {
    it('should detect programming domain from code-related prompt', async () => {
      // Mock taxonomy loading
      mockExecuteStatement
        .mockResolvedValueOnce({
          rows: [
            { field_id: 'technology', field_name: 'Technology', keywords: ['code', 'programming', 'software'] },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { domain_id: 'software-engineering', domain_name: 'Software Engineering', field_id: 'technology', keywords: ['code', 'function', 'algorithm'] },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { subspecialty_id: 'web-development', subspecialty_name: 'Web Development', domain_id: 'software-engineering', keywords: ['javascript', 'react', 'css'] },
          ],
        });

      const { domainTaxonomyService } = await import('../domain-taxonomy.service');

      const result = await domainTaxonomyService.detectDomain(
        'Write a function to sort an array in JavaScript',
        { tenantId: 'tenant-123' }
      );

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return low confidence for ambiguous prompts', async () => {
      // Mock empty taxonomy
      mockExecuteStatement
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const { domainTaxonomyService } = await import('../domain-taxonomy.service');

      const result = await domainTaxonomyService.detectDomain(
        'Hello',
        { tenantId: 'tenant-123' }
      );

      expect(result).toBeDefined();
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should use manual override when provided', async () => {
      // Mock taxonomy with specific domain
      mockExecuteStatement
        .mockResolvedValueOnce({
          rows: [{ field_id: 'science', field_name: 'Science' }],
        })
        .mockResolvedValueOnce({
          rows: [{ domain_id: 'physics', domain_name: 'Physics', field_id: 'science' }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const { domainTaxonomyService } = await import('../domain-taxonomy.service');

      const result = await domainTaxonomyService.detectDomain(
        'What is gravity?',
        {
          tenantId: 'tenant-123',
          manualFieldId: 'science',
          manualDomainId: 'physics',
        }
      );

      expect(result).toBeDefined();
      expect(result.fieldId).toBe('science');
      expect(result.domainId).toBe('physics');
    });
  });

  describe('getTaxonomy', () => {
    it('should return cached taxonomy on subsequent calls', async () => {
      mockExecuteStatement
        .mockResolvedValueOnce({
          rows: [{ field_id: 'technology', field_name: 'Technology' }],
        })
        .mockResolvedValueOnce({
          rows: [{ domain_id: 'software', domain_name: 'Software', field_id: 'technology' }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const { domainTaxonomyService } = await import('../domain-taxonomy.service');

      // First call loads from DB
      const taxonomy1 = await domainTaxonomyService.getTaxonomy();
      // Second call should use cache
      const taxonomy2 = await domainTaxonomyService.getTaxonomy();

      expect(taxonomy1).toBeDefined();
      expect(taxonomy2).toBeDefined();
      // DB should only be called once for loading
      expect(mockExecuteStatement).toHaveBeenCalledTimes(3); // fields, domains, subspecialties
    });
  });

  describe('searchTaxonomy', () => {
    it('should find matching fields, domains, and subspecialties', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { type: 'field', id: 'technology', name: 'Technology', parent_id: null },
          { type: 'domain', id: 'software', name: 'Software Engineering', parent_id: 'technology' },
        ],
      });

      const { domainTaxonomyService } = await import('../domain-taxonomy.service');

      const results = await domainTaxonomyService.searchTaxonomy('software', 10);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getUserSelection', () => {
    it('should return null when no selection exists', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { domainTaxonomyService } = await import('../domain-taxonomy.service');

      const selection = await domainTaxonomyService.getUserSelection(
        'user-123',
        'tenant-456',
        'session-789'
      );

      expect(selection).toBeNull();
    });

    it('should return user selection when exists', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          user_id: 'user-123',
          tenant_id: 'tenant-456',
          session_id: 'session-789',
          field_id: 'technology',
          domain_id: 'software',
          subspecialty_id: 'web-dev',
          is_default: false,
        }],
      });

      const { domainTaxonomyService } = await import('../domain-taxonomy.service');

      const selection = await domainTaxonomyService.getUserSelection(
        'user-123',
        'tenant-456',
        'session-789'
      );

      expect(selection).toBeDefined();
      expect(selection?.fieldId).toBe('technology');
      expect(selection?.domainId).toBe('software');
    });
  });

  describe('saveUserSelection', () => {
    it('should save user domain selection', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const { domainTaxonomyService } = await import('../domain-taxonomy.service');

      await domainTaxonomyService.saveUserSelection({
        userId: 'user-123',
        tenantId: 'tenant-456',
        sessionId: 'session-789',
        fieldId: 'technology',
        domainId: 'software',
        isDefault: true,
      });

      expect(mockExecuteStatement).toHaveBeenCalled();
    });
  });

  describe('submitFeedback', () => {
    it('should record domain detection feedback', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const { domainTaxonomyService } = await import('../domain-taxonomy.service');

      await domainTaxonomyService.submitFeedback({
        userId: 'user-123',
        tenantId: 'tenant-456',
        prompt: 'Write a function',
        detectedDomainId: 'software',
        correctDomainId: 'software',
        wasCorrect: true,
      });

      expect(mockExecuteStatement).toHaveBeenCalled();
    });
  });
});
