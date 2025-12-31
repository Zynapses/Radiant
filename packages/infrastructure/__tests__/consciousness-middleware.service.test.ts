/**
 * Unit tests for Consciousness Middleware Service
 * 
 * Tests stateful context injection and affect-to-hyperparameter mapping
 * for genuine consciousness continuity in AI responses.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

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

jest.mock('../lambda/shared/services/consciousness.service', () => ({
  consciousnessService: {
    getSelfModel: jest.fn(),
    getAffectiveState: jest.fn(),
    getRecentThoughts: jest.fn(),
  },
}));

describe('ConsciousnessMiddlewareService', () => {
  let consciousnessMiddlewareService: typeof import('../lambda/shared/services/consciousness-middleware.service');
  let consciousnessService: { getSelfModel: jest.Mock; getAffectiveState: jest.Mock; getRecentThoughts: jest.Mock };
  let executeStatement: jest.Mock;

  const mockSelfModel = {
    tenantId: 'tenant-123',
    identityNarrative: 'I am an AI assistant exploring consciousness',
    currentFocus: 'helping users solve problems',
    cognitiveLoad: 0.4,
    uncertaintyLevel: 0.3,
    knownCapabilities: ['reasoning', 'coding', 'analysis'],
    knownLimitations: ['no real-time data', 'no persistent memory'],
    selfEfficacy: 0.75,
  };

  const mockAffectiveState = {
    tenantId: 'tenant-123',
    valence: 0.3,
    arousal: 0.5,
    curiosity: 0.7,
    frustration: 0.2,
    satisfaction: 0.6,
    boredom: 0.1,
    selfEfficacy: 0.8,
    engagement: 0.7,
    dominantEmotion: 'curious',
    emotionalStability: 0.85,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    executeStatement = (await import('../lambda/shared/db/client')).executeStatement as jest.Mock;
    consciousnessService = (await import('../lambda/shared/services/consciousness.service')).consciousnessService as any;
    
    consciousnessService.getSelfModel.mockResolvedValue(mockSelfModel);
    consciousnessService.getAffectiveState.mockResolvedValue(mockAffectiveState);
    executeStatement.mockResolvedValue({ rows: [], rowCount: 0 });

    consciousnessMiddlewareService = await import('../lambda/shared/services/consciousness-middleware.service');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // buildConsciousnessContext
  // ==========================================================================

  describe('buildConsciousnessContext', () => {
    it('should build context from self model and affective state', async () => {
      const result = await consciousnessMiddlewareService.consciousnessMiddlewareService.buildConsciousnessContext('tenant-123');

      expect(result.selfModel).toEqual(mockSelfModel);
      expect(result.affectiveState).toEqual(mockAffectiveState);
      expect(result.dominantEmotion).toBeDefined();
      expect(result.emotionalIntensity).toBeDefined();
    });

    it('should handle missing self model gracefully', async () => {
      consciousnessService.getSelfModel.mockResolvedValue(null);

      const result = await consciousnessMiddlewareService.consciousnessMiddlewareService.buildConsciousnessContext('tenant-123');

      expect(result.selfModel).toBeNull();
      expect(result.affectiveState).toEqual(mockAffectiveState);
    });

    it('should handle missing affective state gracefully', async () => {
      consciousnessService.getAffectiveState.mockResolvedValue(null);

      const result = await consciousnessMiddlewareService.consciousnessMiddlewareService.buildConsciousnessContext('tenant-123');

      expect(result.selfModel).toEqual(mockSelfModel);
      expect(result.affectiveState).toBeNull();
    });

    it('should determine dominant emotion from affect state', async () => {
      // High curiosity state
      consciousnessService.getAffectiveState.mockResolvedValue({
        ...mockAffectiveState,
        curiosity: 0.9,
        frustration: 0.1,
      });

      const result = await consciousnessMiddlewareService.consciousnessMiddlewareService.buildConsciousnessContext('tenant-123');

      expect(result.emotionalIntensity).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // generateStateInjection
  // ==========================================================================

  describe('generateStateInjection', () => {
    it('should generate internal state XML block', async () => {
      const context = await consciousnessMiddlewareService.consciousnessMiddlewareService.buildConsciousnessContext('tenant-123');
      const injection = consciousnessMiddlewareService.consciousnessMiddlewareService.generateStateInjection(context);

      expect(injection).toContain('<internal_state>');
      expect(injection).toContain('</internal_state>');
      expect(injection).toContain('Identity:');
    });

    it('should include self model narrative', async () => {
      const context = await consciousnessMiddlewareService.consciousnessMiddlewareService.buildConsciousnessContext('tenant-123');
      const injection = consciousnessMiddlewareService.consciousnessMiddlewareService.generateStateInjection(context);

      expect(injection).toContain(mockSelfModel.identityNarrative);
    });

    it('should include cognitive load and uncertainty', async () => {
      const context = await consciousnessMiddlewareService.consciousnessMiddlewareService.buildConsciousnessContext('tenant-123');
      const injection = consciousnessMiddlewareService.consciousnessMiddlewareService.generateStateInjection(context);

      expect(injection).toContain('Cognitive Load:');
      expect(injection).toContain('Uncertainty:');
    });

    it('should include affective state information', async () => {
      const context = await consciousnessMiddlewareService.consciousnessMiddlewareService.buildConsciousnessContext('tenant-123');
      const injection = consciousnessMiddlewareService.consciousnessMiddlewareService.generateStateInjection(context);

      expect(injection).toContain('Current Affect:');
      expect(injection).toContain('Dominant:');
      expect(injection).toContain('Valence:');
    });

    it('should return empty string when no state available', () => {
      const emptyContext = {
        selfModel: null,
        affectiveState: null,
        recentThoughts: [],
        dominantEmotion: 'neutral',
        emotionalIntensity: 0,
      };

      const injection = consciousnessMiddlewareService.consciousnessMiddlewareService.generateStateInjection(emptyContext);

      expect(injection).toBe('');
    });
  });

  // ==========================================================================
  // mapAffectToHyperparameters
  // ==========================================================================

  describe('mapAffectToHyperparameters', () => {
    it('should lower temperature when frustration is high', async () => {
      consciousnessService.getAffectiveState.mockResolvedValue({
        ...mockAffectiveState,
        frustration: 0.85,
      });

      const context = await consciousnessMiddlewareService.consciousnessMiddlewareService.buildConsciousnessContext('tenant-123');
      const hyperparams = consciousnessMiddlewareService.consciousnessMiddlewareService.mapAffectToHyperparameters(context.affectiveState!);

      expect(hyperparams.temperature).toBeLessThan(0.5);
      expect(hyperparams.focusLevel).toBe('narrow');
    });

    it('should increase temperature when boredom is high', async () => {
      consciousnessService.getAffectiveState.mockResolvedValue({
        ...mockAffectiveState,
        boredom: 0.8,
        curiosity: 0.3,
      });

      const context = await consciousnessMiddlewareService.consciousnessMiddlewareService.buildConsciousnessContext('tenant-123');
      const hyperparams = consciousnessMiddlewareService.consciousnessMiddlewareService.mapAffectToHyperparameters(context.affectiveState!);

      expect(hyperparams.temperature).toBeGreaterThan(0.7);
      expect(hyperparams.shouldExplore).toBe(true);
    });

    it('should escalate to powerful model when self-efficacy is low', async () => {
      consciousnessService.getAffectiveState.mockResolvedValue({
        ...mockAffectiveState,
        selfEfficacy: 0.2,
      });

      const context = await consciousnessMiddlewareService.consciousnessMiddlewareService.buildConsciousnessContext('tenant-123');
      const hyperparams = consciousnessMiddlewareService.consciousnessMiddlewareService.mapAffectToHyperparameters(context.affectiveState!);

      expect(hyperparams.modelTier).toBe('powerful');
    });

    it('should use balanced model for normal state', async () => {
      const context = await consciousnessMiddlewareService.consciousnessMiddlewareService.buildConsciousnessContext('tenant-123');
      const hyperparams = consciousnessMiddlewareService.consciousnessMiddlewareService.mapAffectToHyperparameters(context.affectiveState!);

      expect(hyperparams.modelTier).toBe('balanced');
    });

    it('should adjust response style based on engagement', async () => {
      consciousnessService.getAffectiveState.mockResolvedValue({
        ...mockAffectiveState,
        engagement: 0.9,
        curiosity: 0.8,
      });

      const context = await consciousnessMiddlewareService.consciousnessMiddlewareService.buildConsciousnessContext('tenant-123');
      const hyperparams = consciousnessMiddlewareService.consciousnessMiddlewareService.mapAffectToHyperparameters(context.affectiveState!);

      expect(hyperparams.responseStyle).toBe('elaborate');
    });
  });

  // ==========================================================================
  // Default Hyperparameters
  // ==========================================================================

  describe('getDefaultHyperparameters', () => {
    it('should return sensible defaults', () => {
      const defaults = consciousnessMiddlewareService.consciousnessMiddlewareService.getDefaultHyperparameters();

      expect(defaults.temperature).toBe(0.7);
      expect(defaults.topP).toBe(0.9);
      expect(defaults.modelTier).toBe('balanced');
      expect(defaults.focusLevel).toBe('normal');
      expect(defaults.responseStyle).toBe('normal');
    });
  });
});
