/**
 * RADIANT v4.18.0 - Thermal State Service Tests
 * Tests for thermal state management of self-hosted models
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThermalStateService, ThermalState } from '../thermal-state';

// Mock the database client
vi.mock('../../db/client', () => ({
  executeStatement: vi.fn(),
}));

// Mock SageMaker client
vi.mock('@aws-sdk/client-sagemaker', () => ({
  SageMakerClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  DescribeEndpointCommand: vi.fn(),
}));

import { executeStatement } from '../../db/client';

const mockExecuteStatement = vi.mocked(executeStatement);

describe('ThermalStateService', () => {
  let service: ThermalStateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ThermalStateService();
  });

  describe('getThermalState', () => {
    it('should return thermal state for a model', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          thermal_state: 'warm',
          warm_until: new Date(Date.now() + 3600000).toISOString(),
          auto_thermal_enabled: false,
        }],
        rowCount: 0,
      });

      const state = await service.getThermalState('model-123');
      expect(state).toBe('warm');
    });

    it('should throw error if model not found', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      await expect(service.getThermalState('nonexistent')).rejects.toThrow('Model nonexistent not found');
    });

    it('should transition to cold if warm_until has passed with auto_thermal enabled', async () => {
      mockExecuteStatement
        .mockResolvedValueOnce({
          rows: [{
            thermal_state: 'warm',
            warm_until: new Date(Date.now() - 3600000).toISOString(), // Past
            auto_thermal_enabled: true,
          }],
          rowCount: 0,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // For transitionToCold

      const state = await service.getThermalState('model-123');
      expect(state).toBe('cold');
    });

    it('should return default cold state if thermal_state is null', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          thermal_state: null,
          warm_until: null,
          auto_thermal_enabled: false,
        }],
        rowCount: 0,
      });

      const state = await service.getThermalState('model-123');
      expect(state).toBe('cold');
    });
  });

  describe('warmUp', () => {
    it('should warm up a model with default duration', async () => {
      mockExecuteStatement
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // UPDATE
        .mockResolvedValueOnce({ // getModel
          rows: [{ config: JSON.stringify({ endpoint_name: 'test-endpoint' }) }],
          rowCount: 0,
        });

      await service.warmUp('model-123');

      expect(mockExecuteStatement).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE models SET thermal_state = 'warm'"),
        expect.any(Array)
      );
    });

    it('should warm up a model with custom duration', async () => {
      mockExecuteStatement
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({
          rows: [{ config: '{}' }],
          rowCount: 0,
        });

      await service.warmUp('model-123', 60);

      expect(mockExecuteStatement).toHaveBeenCalled();
    });
  });

  describe('transitionToCold', () => {
    it('should transition model to cold state', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.transitionToCold('model-123');

      expect(mockExecuteStatement).toHaveBeenCalledWith(
        expect.stringContaining("thermal_state = 'cold'"),
        expect.any(Array)
      );
    });
  });

  describe('transitionToHot', () => {
    it('should transition model to hot state', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await service.transitionToHot('model-123');

      expect(mockExecuteStatement).toHaveBeenCalledWith(
        expect.stringContaining("thermal_state = 'hot'"),
        expect.any(Array)
      );
    });
  });

  describe('checkAndUpdateThermalState', () => {
    it('should transition to hot if request count exceeds threshold', async () => {
      mockExecuteStatement
        .mockResolvedValueOnce({ // getRecentRequestCount
          rows: [{ count: 15 }],
          rowCount: 0,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // transitionToHot

      const state = await service.checkAndUpdateThermalState('model-123');
      expect(state).toBe('hot');
    });

    it('should transition to cold if idle too long', async () => {
      mockExecuteStatement
        .mockResolvedValueOnce({ // getRecentRequestCount
          rows: [{ count: 2 }],
          rowCount: 0,
        })
        .mockResolvedValueOnce({ // getMinutesSinceLastRequest
          rows: [{ extract: 20 }],
          rowCount: 0,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // transitionToCold

      const state = await service.checkAndUpdateThermalState('model-123');
      expect(state).toBe('cold');
    });

    it('should maintain current state if within normal parameters', async () => {
      mockExecuteStatement
        .mockResolvedValueOnce({ // getRecentRequestCount
          rows: [{ count: 5 }],
          rowCount: 0,
        })
        .mockResolvedValueOnce({ // getMinutesSinceLastRequest
          rows: [{ extract: 5 }],
          rowCount: 0,
        })
        .mockResolvedValueOnce({ // getThermalState
          rows: [{
            thermal_state: 'warm',
            warm_until: new Date(Date.now() + 3600000).toISOString(),
            auto_thermal_enabled: false,
          }],
          rowCount: 0,
        });

      const state = await service.checkAndUpdateThermalState('model-123');
      expect(state).toBe('warm');
    });
  });

  describe('configuration', () => {
    it('should use custom configuration', async () => {
      const customService = new ThermalStateService({
        warmDurationMinutes: 60,
        hotThresholdRequestsPerMinute: 20,
        coldThresholdIdleMinutes: 30,
      });

      mockExecuteStatement
        .mockResolvedValueOnce({ rows: [{ count: 15 }], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ extract: 25 }], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [{
            thermal_state: 'warm',
            warm_until: new Date(Date.now() + 3600000).toISOString(),
            auto_thermal_enabled: false,
          }],
          rowCount: 0,
        });

      // With custom threshold of 20, 15 requests should NOT trigger hot
      const state = await customService.checkAndUpdateThermalState('model-123');
      expect(state).toBe('warm');
    });
  });
});
