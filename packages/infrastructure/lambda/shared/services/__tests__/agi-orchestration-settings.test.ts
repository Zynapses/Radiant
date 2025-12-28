import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database client - paths are relative to __tests__ folder
vi.mock('../../db/client', () => ({
  executeStatement: vi.fn(),
}));

vi.mock('../../logging/enhanced-logger', () => ({
  enhancedLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { executeStatement } from '../../db/client';

// Import the service (will use mocked dependencies)
const mockExecuteStatement = executeStatement as ReturnType<typeof vi.fn>;

describe('AGIOrchestrationSettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServiceWeights', () => {
    it('should return service weights for a tenant', async () => {
      const mockRows = [
        { service_id: 'consciousness', weight: 0.8, enabled: true, priority: 1 },
        { service_id: 'metacognition', weight: 0.7, enabled: true, priority: 2 },
        { service_id: 'moral_compass', weight: 0.9, enabled: true, priority: 3 },
      ];

      mockExecuteStatement.mockResolvedValueOnce({ rows: mockRows });

      // Import dynamically to ensure mocks are in place
      const { agiOrchestrationSettingsService } = await import('../agi-orchestration-settings.service');
      
      const weights = await agiOrchestrationSettingsService.getServiceWeights('tenant-123');

      expect(mockExecuteStatement).toHaveBeenCalled();
      expect(weights).toHaveLength(3);
      expect(weights[0].serviceId).toBe('consciousness');
      expect(weights[0].weight).toBe(0.8);
    });

    it('should return default weights when database returns empty', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { agiOrchestrationSettingsService } = await import('../agi-orchestration-settings.service');
      
      const weights = await agiOrchestrationSettingsService.getServiceWeights('tenant-123');

      expect(weights).toBeDefined();
      expect(Array.isArray(weights)).toBe(true);
    });
  });

  describe('getConsciousnessWeights', () => {
    it('should return consciousness indicator weights', async () => {
      const mockRows = [
        { indicator_id: 'global_workspace', weight: 0.85, enabled: true },
        { indicator_id: 'recurrent_processing', weight: 0.75, enabled: true },
        { indicator_id: 'integrated_information', weight: 0.90, enabled: true },
      ];

      mockExecuteStatement.mockResolvedValueOnce({ rows: mockRows });

      const { agiOrchestrationSettingsService } = await import('../agi-orchestration-settings.service');
      
      const weights = await agiOrchestrationSettingsService.getConsciousnessWeights('tenant-123');

      expect(weights).toHaveLength(3);
      expect(weights[0].indicatorId).toBe('global_workspace');
    });
  });

  describe('getDecisionWeights', () => {
    it('should return decision weights configuration', async () => {
      const mockRow = {
        model_quality_weight: 0.3,
        model_cost_weight: 0.2,
        model_latency_weight: 0.2,
        model_specialty_weight: 0.2,
        model_reliability_weight: 0.1,
      };

      mockExecuteStatement.mockResolvedValueOnce({ rows: [mockRow] });

      const { agiOrchestrationSettingsService } = await import('../agi-orchestration-settings.service');
      
      const weights = await agiOrchestrationSettingsService.getDecisionWeights('tenant-123');

      expect(weights).toBeDefined();
      expect(weights.modelQualityWeight).toBe(0.3);
      expect(weights.modelCostWeight).toBe(0.2);
    });
  });

  describe('updateServiceWeight', () => {
    it('should update a single service weight', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [{ updated: true }] });

      const { agiOrchestrationSettingsService } = await import('../agi-orchestration-settings.service');
      
      await agiOrchestrationSettingsService.updateServiceWeight(
        'tenant-123',
        'consciousness',
        { weight: 0.9, enabled: true },
        'user-456'
      );

      expect(mockExecuteStatement).toHaveBeenCalled();
    });

    it('should validate weight is between 0 and 1', async () => {
      const { agiOrchestrationSettingsService } = await import('../agi-orchestration-settings.service');
      
      // This should handle the validation internally
      await expect(
        agiOrchestrationSettingsService.updateServiceWeight(
          'tenant-123',
          'consciousness',
          { weight: 1.5, enabled: true },
          'user-456'
        )
      ).rejects.toThrow();
    });
  });

  describe('getPipelines', () => {
    it('should return orchestration pipelines', async () => {
      const mockRows = [
        {
          pipeline_id: 'default',
          pipeline_name: 'Default Pipeline',
          stages: JSON.stringify([
            { stageId: 'input', stageName: 'Input Processing' },
            { stageId: 'orchestration', stageName: 'Orchestration' },
            { stageId: 'output', stageName: 'Output Synthesis' },
          ]),
        },
      ];

      mockExecuteStatement.mockResolvedValueOnce({ rows: mockRows });

      const { agiOrchestrationSettingsService } = await import('../agi-orchestration-settings.service');
      
      const pipelines = await agiOrchestrationSettingsService.getPipelines('tenant-123');

      expect(pipelines).toHaveLength(1);
      expect(pipelines[0].pipelineId).toBe('default');
    });
  });

  describe('getAllSettings', () => {
    it('should return complete settings object', async () => {
      // Mock multiple database calls
      mockExecuteStatement
        .mockResolvedValueOnce({ rows: [] }) // service weights
        .mockResolvedValueOnce({ rows: [] }) // consciousness weights
        .mockResolvedValueOnce({ rows: [] }) // decision weights
        .mockResolvedValueOnce({ rows: [] }) // thresholds
        .mockResolvedValueOnce({ rows: [] }) // pipelines
        .mockResolvedValueOnce({ rows: [] }); // bedrock config

      const { agiOrchestrationSettingsService } = await import('../agi-orchestration-settings.service');
      
      const settings = await agiOrchestrationSettingsService.getAllSettings('tenant-123');

      expect(settings).toBeDefined();
      expect(settings).toHaveProperty('serviceWeights');
      expect(settings).toHaveProperty('consciousnessWeights');
      expect(settings).toHaveProperty('decisionWeights');
    });
  });
});
