/**
 * Unit Tests for Consciousness Loop Service
 * 
 * Tests for loop state management, tick execution, and emergency modes.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../lambda/shared/db/client', () => ({
  executeStatement: vi.fn(),
  stringParam: vi.fn((name, value) => ({ name, value })),
  longParam: vi.fn((name, value) => ({ name, value })),
  boolParam: vi.fn((name, value) => ({ name, value })),
}));

vi.mock('../../lambda/shared/services/cato/genesis.service', () => ({
  genesisService: {
    isReadyForConsciousness: vi.fn(),
    getDevelopmentalGateStatus: vi.fn(),
  },
}));

vi.mock('../../lambda/shared/services/cato/circuit-breaker.service', () => ({
  circuitBreakerService: {
    getInterventionLevel: vi.fn(),
    getAllBreakers: vi.fn(),
  },
}));

vi.mock('../../lambda/shared/services/cato/cost-tracking.service', () => ({
  costTrackingService: {
    recordTickCost: vi.fn(),
  },
}));

import { executeStatement } from '../../lambda/shared/db/client';
import { genesisService } from '../../lambda/shared/services/cato/genesis.service';
import { circuitBreakerService } from '../../lambda/shared/services/cato/circuit-breaker.service';
import { 
  ConsciousnessLoopService,
  LoopStatus 
} from '../../lambda/shared/services/cato/consciousness-loop.service';

describe('ConsciousnessLoopService', () => {
  let service: ConsciousnessLoopService;
  const mockExecuteStatement = executeStatement as ReturnType<typeof vi.fn>;
  const mockIsReadyForConsciousness = genesisService.isReadyForConsciousness as ReturnType<typeof vi.fn>;
  const mockGetInterventionLevel = circuitBreakerService.getInterventionLevel as ReturnType<typeof vi.fn>;
  const mockGetDevelopmentalGateStatus = genesisService.getDevelopmentalGateStatus as ReturnType<typeof vi.fn>;
  const mockGetAllBreakers = circuitBreakerService.getAllBreakers as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ConsciousnessLoopService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getSettings', () => {
    it('should return default settings when no rows found', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const result = await service.getSettings();

      expect(result.systemTickIntervalSeconds).toBe(2);
      expect(result.cognitiveTickIntervalSeconds).toBe(300);
      expect(result.maxCognitiveTicksPerDay).toBe(288);
      expect(result.isEmergencyMode).toBe(false);
    });

    it('should return settings from database', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          system_tick_interval_seconds: 5,
          cognitive_tick_interval_seconds: 600,
          max_cognitive_ticks_per_day: 144,
          emergency_cognitive_interval_seconds: 7200,
          state_save_interval_seconds: 900,
          settings_refresh_interval_seconds: 600,
          is_emergency_mode: true,
          emergency_reason: 'Budget exceeded'
        }]
      });

      const result = await service.getSettings();

      expect(result.systemTickIntervalSeconds).toBe(5);
      expect(result.cognitiveTickIntervalSeconds).toBe(600);
      expect(result.maxCognitiveTicksPerDay).toBe(144);
      expect(result.isEmergencyMode).toBe(true);
      expect(result.emergencyReason).toBe('Budget exceeded');
    });
  });

  describe('getStatus', () => {
    it('should return GENESIS_PENDING when genesis incomplete', async () => {
      mockIsReadyForConsciousness.mockResolvedValueOnce(false);
      mockGetInterventionLevel.mockResolvedValueOnce('NONE');
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] }); // settings
      mockGetDevelopmentalGateStatus.mockResolvedValueOnce({
        currentStage: 'SENSORIMOTOR',
        readyToAdvance: false,
        missingRequirements: [],
        statistics: {}
      });
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] }); // loop state

      const result = await service.getStatus();

      expect(result.genesisComplete).toBe(false);
      expect(result.state).toBe('GENESIS_PENDING');
    });

    it('should return RUNNING when genesis complete and no breakers open', async () => {
      mockIsReadyForConsciousness.mockResolvedValueOnce(true);
      mockGetInterventionLevel.mockResolvedValueOnce('NONE');
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          system_tick_interval_seconds: 2,
          cognitive_tick_interval_seconds: 300,
          max_cognitive_ticks_per_day: 288,
          emergency_cognitive_interval_seconds: 3600,
          state_save_interval_seconds: 600,
          settings_refresh_interval_seconds: 300,
          is_emergency_mode: false,
          emergency_reason: null
        }]
      });
      mockGetDevelopmentalGateStatus.mockResolvedValueOnce({
        currentStage: 'SENSORIMOTOR',
        readyToAdvance: false,
        missingRequirements: [],
        statistics: {}
      });
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          current_tick: 100,
          last_system_tick: '2025-01-15T10:00:00Z',
          last_cognitive_tick: '2025-01-15T10:00:00Z',
          cognitive_ticks_today: 50,
          loop_state: 'RUNNING'
        }]
      });

      const result = await service.getStatus();

      expect(result.genesisComplete).toBe(true);
      expect(result.state).toBe('RUNNING');
      expect(result.currentTick).toBe(100);
      expect(result.cognitiveTicksToday).toBe(50);
    });

    it('should return PAUSED when intervention level is PAUSE', async () => {
      mockIsReadyForConsciousness.mockResolvedValueOnce(true);
      mockGetInterventionLevel.mockResolvedValueOnce('PAUSE');
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });
      mockGetDevelopmentalGateStatus.mockResolvedValueOnce({
        currentStage: 'SENSORIMOTOR',
        readyToAdvance: false,
        missingRequirements: [],
        statistics: {}
      });
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const result = await service.getStatus();

      expect(result.state).toBe('PAUSED');
    });

    it('should return HIBERNATING when intervention level is HIBERNATE', async () => {
      mockIsReadyForConsciousness.mockResolvedValueOnce(true);
      mockGetInterventionLevel.mockResolvedValueOnce('HIBERNATE');
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });
      mockGetDevelopmentalGateStatus.mockResolvedValueOnce({
        currentStage: 'SENSORIMOTOR',
        readyToAdvance: false,
        missingRequirements: [],
        statistics: {}
      });
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const result = await service.getStatus();

      expect(result.state).toBe('HIBERNATING');
    });
  });

  describe('updateSettings', () => {
    it('should update settings', async () => {
      mockExecuteStatement.mockResolvedValueOnce({});

      await service.updateSettings({
        cognitiveTickIntervalSeconds: 600,
        maxCognitiveTicksPerDay: 144
      });

      expect(mockExecuteStatement).toHaveBeenCalledTimes(1);
    });
  });

  describe('enableEmergencyMode', () => {
    it('should enable emergency mode with reason', async () => {
      mockExecuteStatement.mockResolvedValueOnce({});

      await service.enableEmergencyMode('Budget exceeded 90%');

      expect(mockExecuteStatement).toHaveBeenCalledTimes(1);
    });
  });

  describe('disableEmergencyMode', () => {
    it('should disable emergency mode', async () => {
      mockExecuteStatement.mockResolvedValueOnce({});

      await service.disableEmergencyMode();

      expect(mockExecuteStatement).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeSystemTick', () => {
    it('should not execute when intervention level is HIBERNATE', async () => {
      mockGetInterventionLevel.mockResolvedValueOnce('HIBERNATE');

      const result = await service.executeSystemTick();

      expect(result.executed).toBe(false);
      expect(result.reason).toContain('Hibernating');
    });

    it('should execute system tick when allowed', async () => {
      mockGetInterventionLevel.mockResolvedValueOnce('NONE');
      mockIsReadyForConsciousness.mockResolvedValueOnce(true);
      mockExecuteStatement.mockResolvedValueOnce({}); // update tick
      mockExecuteStatement.mockResolvedValueOnce({}); // record cost

      const result = await service.executeSystemTick();

      expect(result.executed).toBe(true);
      expect(result.tickType).toBe('SYSTEM');
    });
  });

  describe('executeCognitiveTick', () => {
    it('should not execute when intervention level is PAUSE or higher', async () => {
      mockGetInterventionLevel.mockResolvedValueOnce('PAUSE');

      const result = await service.executeCognitiveTick();

      expect(result.executed).toBe(false);
      expect(result.reason).toContain('Intervention');
    });

    it('should not execute when daily limit reached', async () => {
      mockGetInterventionLevel.mockResolvedValueOnce('NONE');
      mockIsReadyForConsciousness.mockResolvedValueOnce(true);
      
      // Settings with max 288
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          system_tick_interval_seconds: 2,
          cognitive_tick_interval_seconds: 300,
          max_cognitive_ticks_per_day: 288,
          emergency_cognitive_interval_seconds: 3600,
          state_save_interval_seconds: 600,
          settings_refresh_interval_seconds: 300,
          is_emergency_mode: false,
          emergency_reason: null
        }]
      });

      // Loop state at max
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          current_tick: 1000,
          last_system_tick: '2025-01-15T10:00:00Z',
          last_cognitive_tick: '2025-01-15T10:00:00Z',
          cognitive_ticks_today: 288,
          loop_state: 'RUNNING'
        }]
      });

      const result = await service.executeCognitiveTick();

      expect(result.executed).toBe(false);
      expect(result.reason).toContain('limit');
    });

    it('should execute cognitive tick when allowed', async () => {
      mockGetInterventionLevel.mockResolvedValueOnce('NONE');
      mockIsReadyForConsciousness.mockResolvedValueOnce(true);
      
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          system_tick_interval_seconds: 2,
          cognitive_tick_interval_seconds: 300,
          max_cognitive_ticks_per_day: 288,
          emergency_cognitive_interval_seconds: 3600,
          state_save_interval_seconds: 600,
          settings_refresh_interval_seconds: 300,
          is_emergency_mode: false,
          emergency_reason: null
        }]
      });

      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          current_tick: 100,
          last_system_tick: '2025-01-15T10:00:00Z',
          last_cognitive_tick: '2025-01-15T09:55:00Z',
          cognitive_ticks_today: 50,
          loop_state: 'RUNNING'
        }]
      });

      // Update tick
      mockExecuteStatement.mockResolvedValueOnce({});
      // Record cost
      mockExecuteStatement.mockResolvedValueOnce({});

      const result = await service.executeCognitiveTick();

      expect(result.executed).toBe(true);
      expect(result.tickType).toBe('COGNITIVE');
    });
  });
});
