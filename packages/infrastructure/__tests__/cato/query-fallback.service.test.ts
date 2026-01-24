/**
 * Unit Tests for Query Fallback Service
 * 
 * Tests for fallback responses, health checks, and caching.
 */

// Jest globals are automatically available via ts-jest

// Mock dependencies
jest.mock('../../lambda/shared/db/client', () => ({
  executeStatement: jest.fn(),
  stringParam: jest.fn((name, value) => ({ name, value })),
}));

jest.mock('../../lambda/shared/services/cato/circuit-breaker.service', () => ({
  circuitBreakerService: {
    getInterventionLevel: jest.fn(),
  },
}));

import { executeStatement } from '../../lambda/shared/db/client';
import { circuitBreakerService } from '../../lambda/shared/services/cato/circuit-breaker.service';
import { 
  QueryFallbackService,
  FallbackResponse 
} from '../../lambda/shared/services/cato/query-fallback.service';

describe('QueryFallbackService', () => {
  let service: QueryFallbackService;
  const mockExecuteStatement = executeStatement as ReturnType<typeof jest.fn>;
  const mockGetInterventionLevel = circuitBreakerService.getInterventionLevel as ReturnType<typeof jest.fn>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QueryFallbackService();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getFallbackResponse', () => {
    it('should return degraded response for DAMPEN level', async () => {
      mockGetInterventionLevel.mockResolvedValueOnce('DAMPEN');
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const result = await service.getFallbackResponse();

      expect(result.status).toBe('degraded');
      expect(result.interventionLevel).toBe('DAMPEN');
      expect(result.suggestedActions.length).toBeGreaterThan(0);
    });

    it('should return minimal response for PAUSE level', async () => {
      mockGetInterventionLevel.mockResolvedValueOnce('PAUSE');
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const result = await service.getFallbackResponse();

      expect(result.status).toBe('minimal');
      expect(result.interventionLevel).toBe('PAUSE');
    });

    it('should return offline response for HIBERNATE level', async () => {
      mockGetInterventionLevel.mockResolvedValueOnce('HIBERNATE');
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const result = await service.getFallbackResponse();

      expect(result.status).toBe('offline');
      expect(result.interventionLevel).toBe('HIBERNATE');
    });

    it('should include cached context when available', async () => {
      mockGetInterventionLevel.mockResolvedValueOnce('DAMPEN');
      
      // PyMDP state query
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          last_known_state: 'CONFUSED',
          last_update: new Date().toISOString()
        }]
      });

      // Domain hints query
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { domain_name: 'mathematics' },
          { domain_name: 'physics' }
        ]
      });

      const result = await service.getFallbackResponse();

      expect(result.cachedContext).not.toBeNull();
      expect(result.cachedContext?.lastKnownState).toBe('CONFUSED');
      expect(result.cachedContext?.domainHints).toContain('mathematics');
    });

    it('should return offline on error', async () => {
      mockGetInterventionLevel.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.getFallbackResponse();

      expect(result.status).toBe('offline');
      expect(result.interventionLevel).toBe('HIBERNATE');
    });
  });

  describe('isFallbackActive', () => {
    it('should return false when intervention level is NONE', async () => {
      mockGetInterventionLevel.mockResolvedValueOnce('NONE');

      const result = await service.isFallbackActive();

      expect(result).toBe(false);
    });

    it('should return true when intervention level is not NONE', async () => {
      mockGetInterventionLevel.mockResolvedValueOnce('DAMPEN');

      const result = await service.isFallbackActive();

      expect(result).toBe(true);
    });

    it('should return true on error (fail safe)', async () => {
      mockGetInterventionLevel.mockRejectedValueOnce(new Error('error'));

      const result = await service.isFallbackActive();

      expect(result).toBe(true);
    });
  });

  describe('getHealthCheck', () => {
    it('should always return healthy', () => {
      const result = service.getHealthCheck();

      expect(result.healthy).toBe(true);
      expect(result.mode).toBe('fallback');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('caching', () => {
    it('should cache and retrieve responses', () => {
      const hash = 'test-hash-123';
      const response = 'Cached response content';

      service.cacheResponse(hash, response);
      const result = service.getCachedResponse(hash);

      expect(result).toBe(response);
    });

    it('should return null for non-cached queries', () => {
      const result = service.getCachedResponse('nonexistent-hash');

      expect(result).toBeNull();
    });
  });

  describe('getSimpleResponse', () => {
    it('should return appropriate message for each level', () => {
      expect(service.getSimpleResponse('NONE')).toContain('normally');
      expect(service.getSimpleResponse('DAMPEN')).toContain('reduced');
      expect(service.getSimpleResponse('PAUSE')).toContain('difficulties');
      expect(service.getSimpleResponse('RESET')).toContain('resetting');
      expect(service.getSimpleResponse('HIBERNATE')).toContain('maintenance');
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      service.updateConfig({
        offlineMessage: 'Custom offline message',
        maxCacheAgeSeconds: 7200
      });

      // Verify config was updated by checking getSimpleResponse
      expect(service.getSimpleResponse('HIBERNATE')).toBe('Custom offline message');
    });
  });
});
