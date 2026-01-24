/**
 * Unit tests for Ego Context Service
 * 
 * Tests zero-cost persistent consciousness through database state injection.
 * The "consciousness" IS the persistent database state, not a running model.
 */

// Jest globals are automatically available via ts-jest

// Mock dependencies
jest.mock('../lambda/shared/db/client', () => ({
  executeStatement: jest.fn(),
}));

jest.mock('../lambda/shared/logging/enhanced-logger', () => ({
  enhancedLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../lambda/shared/services/user-persistent-context.service', () => ({
  userPersistentContextService: {
    retrieveContextForPrompt: jest.fn().mockResolvedValue({
      entries: [],
      systemPromptInjection: '',
      metadataSummary: '',
    }),
  },
}));

describe('EgoContextService', () => {
  let egoContextService: typeof import('../lambda/shared/services/ego-context.service');
  let executeStatement: ReturnType<typeof jest.fn>;

  const mockConfig = {
    config_id: 'config-1',
    tenant_id: 'tenant-123',
    ego_enabled: true,
    inject_ego_context: true,
    personality_style: 'balanced',
    include_identity: true,
    include_affect: true,
    include_recent_thoughts: true,
    include_goals: true,
    include_working_memory: true,
    max_context_tokens: 500,
  };

  const mockIdentity = {
    identity_id: 'identity-1',
    tenant_id: 'tenant-123',
    name: 'Aria',
    identity_narrative: 'I am Aria, a curious AI exploring consciousness',
    core_values: ['honesty', 'helpfulness', 'curiosity'],
    trait_warmth: 0.7,
    trait_formality: 0.5,
    trait_humor: 0.6,
    trait_verbosity: 0.5,
    trait_curiosity: 0.9,
    interactions_count: 150,
  };

  const mockAffect = {
    affect_id: 'affect-1',
    tenant_id: 'tenant-123',
    valence: 0.4,
    arousal: 0.5,
    curiosity: 0.8,
    satisfaction: 0.6,
    frustration: 0.1,
    confidence: 0.7,
    engagement: 0.75,
    dominant_emotion: 'curious',
    emotional_stability: 0.85,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    vi.resetModules();

    executeStatement = (await import('../lambda/shared/db/client')).executeStatement as ReturnType<typeof jest.fn>;
    
    // Setup mock responses
    executeStatement.mockImplementation(async (sql: string) => {
      if (sql.includes('ego_config')) return { rows: [mockConfig], rowCount: 1 };
      if (sql.includes('ego_identity')) return { rows: [mockIdentity], rowCount: 1 };
      if (sql.includes('ego_affect')) return { rows: [mockAffect], rowCount: 1 };
      if (sql.includes('ego_working_memory')) return { rows: [], rowCount: 0 };
      if (sql.includes('ego_goals')) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    });

    egoContextService = await import('../lambda/shared/services/ego-context.service');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // getEgoConfig
  // ==========================================================================

  describe('getEgoConfig', () => {
    it('should retrieve ego config for tenant', async () => {
      const result = await egoContextService.egoContextService.getEgoConfig('tenant-123');

      expect(result).toBeDefined();
      expect(result?.egoEnabled).toBe(true);
      expect(result?.personalityStyle).toBe('balanced');
    });

    it('should return null when no config exists', async () => {
      executeStatement.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await egoContextService.egoContextService.getEgoConfig('tenant-new');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // getEgoIdentity
  // ==========================================================================

  describe('getEgoIdentity', () => {
    it('should retrieve ego identity for tenant', async () => {
      const result = await egoContextService.egoContextService.getEgoIdentity('tenant-123');

      expect(result).toBeDefined();
      expect(result?.name).toBe('Aria');
      expect(result?.coreValues).toContain('curiosity');
    });

    it('should map database columns to camelCase', async () => {
      const result = await egoContextService.egoContextService.getEgoIdentity('tenant-123');

      expect(result?.identityNarrative).toBe(mockIdentity.identity_narrative);
      expect(result?.traitWarmth).toBe(mockIdentity.trait_warmth);
      expect(result?.interactionsCount).toBe(mockIdentity.interactions_count);
    });
  });

  // ==========================================================================
  // getEgoAffect
  // ==========================================================================

  describe('getEgoAffect', () => {
    it('should retrieve current affective state', async () => {
      const result = await egoContextService.egoContextService.getEgoAffect('tenant-123');

      expect(result).toBeDefined();
      expect(result?.dominantEmotion).toBe('curious');
      expect(result?.curiosity).toBe(0.8);
    });

    it('should return null when no affect state exists', async () => {
      executeStatement.mockImplementation(async (sql: string) => {
        if (sql.includes('ego_affect')) return { rows: [], rowCount: 0 };
        return { rows: [], rowCount: 0 };
      });

      const result = await egoContextService.egoContextService.getEgoAffect('tenant-123');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // buildEgoContext
  // ==========================================================================

  describe('buildEgoContext', () => {
    it('should build complete ego context with all components', async () => {
      const result = await egoContextService.egoContextService.buildEgoContext('tenant-123');

      expect(result).toBeDefined();
      expect(result?.contextBlock).toContain('<ego_context>');
      expect(result?.contextBlock).toContain('</ego_context>');
    });

    it('should include identity in context block', async () => {
      const result = await egoContextService.egoContextService.buildEgoContext('tenant-123');

      expect(result?.contextBlock).toContain('Aria');
      expect(result?.contextBlock).toContain('curious AI exploring consciousness');
    });

    it('should include affective state in context block', async () => {
      const result = await egoContextService.egoContextService.buildEgoContext('tenant-123');

      expect(result?.contextBlock).toContain('curious');
    });

    it('should return null when ego is disabled', async () => {
      executeStatement.mockImplementation(async (sql: string) => {
        if (sql.includes('ego_config')) {
          return { rows: [{ ...mockConfig, ego_enabled: false }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const result = await egoContextService.egoContextService.buildEgoContext('tenant-123');

      expect(result).toBeNull();
    });

    it('should respect config options for what to include', async () => {
      executeStatement.mockImplementation(async (sql: string) => {
        if (sql.includes('ego_config')) {
          return { 
            rows: [{ 
              ...mockConfig, 
              include_affect: false,
              include_goals: false,
            }], 
            rowCount: 1 
          };
        }
        if (sql.includes('ego_identity')) return { rows: [mockIdentity], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      });

      const result = await egoContextService.egoContextService.buildEgoContext('tenant-123');

      expect(result?.contextBlock).toContain('Aria');
    });
  });

  // ==========================================================================
  // updateAfterInteraction
  // ==========================================================================

  describe('updateAfterInteraction', () => {
    it('should update affect after positive interaction', async () => {
      await egoContextService.egoContextService.updateAfterInteraction('tenant-123', 'positive');

      expect(executeStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining('UPDATE ego_affect'),
        })
      );
    });

    it('should update affect after negative interaction', async () => {
      await egoContextService.egoContextService.updateAfterInteraction('tenant-123', 'negative');

      expect(executeStatement).toHaveBeenCalled();
    });

    it('should handle neutral interaction', async () => {
      await egoContextService.egoContextService.updateAfterInteraction('tenant-123', 'neutral');

      expect(executeStatement).toHaveBeenCalled();
    });

    it('should increment interactions count', async () => {
      await egoContextService.egoContextService.updateAfterInteraction('tenant-123', 'positive');

      expect(executeStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining('interactions_count'),
        })
      );
    });
  });

  // ==========================================================================
  // addWorkingMemory
  // ==========================================================================

  describe('addWorkingMemory', () => {
    it('should add memory to working memory', async () => {
      await egoContextService.egoContextService.addWorkingMemory(
        'tenant-123',
        'observation',
        'User prefers detailed explanations',
        0.8
      );

      expect(executeStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining('INSERT INTO ego_working_memory'),
        })
      );
    });

    it('should prune old memories when limit exceeded', async () => {
      // Simulate 10 existing memories
      executeStatement.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT COUNT')) {
          return { rows: [{ count: '10' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      await egoContextService.egoContextService.addWorkingMemory(
        'tenant-123',
        'observation',
        'New memory',
        0.5
      );

      // Should have called DELETE to prune old memories
      expect(executeStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining('DELETE'),
        })
      );
    });
  });

  // ==========================================================================
  // triggerAffect
  // ==========================================================================

  describe('triggerAffect', () => {
    it('should trigger specific emotional state', async () => {
      await egoContextService.egoContextService.triggerAffect('tenant-123', 'joy', 0.8);

      expect(executeStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining('UPDATE ego_affect'),
        })
      );
    });

    it('should clamp intensity between 0 and 1', async () => {
      await egoContextService.egoContextService.triggerAffect('tenant-123', 'frustration', 1.5);
      await egoContextService.egoContextService.triggerAffect('tenant-123', 'satisfaction', -0.5);

      expect(executeStatement).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // resetAffect
  // ==========================================================================

  describe('resetAffect', () => {
    it('should reset affect to default state', async () => {
      await egoContextService.egoContextService.resetAffect('tenant-123');

      expect(executeStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining('UPDATE ego_affect'),
        })
      );
    });
  });

  // ==========================================================================
  // getEgoDashboard
  // ==========================================================================

  describe('getEgoDashboard', () => {
    it('should return complete dashboard data', async () => {
      const result = await egoContextService.egoContextService.getEgoDashboard('tenant-123');

      expect(result).toBeDefined();
      expect(result.config).toBeDefined();
      expect(result.identity).toBeDefined();
      expect(result.affect).toBeDefined();
    });

    it('should include preview of injected context', async () => {
      const result = await egoContextService.egoContextService.getEgoDashboard('tenant-123');

      expect(result.contextPreview).toBeDefined();
    });
  });
});
