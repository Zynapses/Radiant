/**
 * Unit Tests for Circuit Breaker Service
 * 
 * Tests for circuit breaker state management, tripping,
 * recovery, and intervention levels.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../lambda/shared/db/client', () => ({
  executeStatement: vi.fn(),
  stringParam: vi.fn((name, value) => ({ name, value })),
  longParam: vi.fn((name, value) => ({ name, value })),
  boolParam: vi.fn((name, value) => ({ name, value })),
}));

vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PublishCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutMetricDataCommand: vi.fn(),
}));

import { executeStatement } from '../../lambda/shared/db/client';
import { 
  CircuitBreakerService,
  CircuitState,
  InterventionLevel 
} from '../../lambda/shared/services/bobble/circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  const mockExecuteStatement = executeStatement as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CircuitBreakerService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getAllBreakers', () => {
    it('should return default breakers when no rows found', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: null });

      const result = await service.getAllBreakers();

      expect(result.length).toBe(5);
      expect(result.map(b => b.name)).toContain('master_sanity');
      expect(result.map(b => b.name)).toContain('cost_budget');
      expect(result.every(b => b.state === 'CLOSED')).toBe(true);
    });

    it('should return breakers from database', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          {
            name: 'master_sanity',
            state: 'CLOSED',
            trip_count: 0,
            last_tripped_at: null,
            last_closed_at: null,
            consecutive_failures: 0,
            half_open_attempts: 0,
            enabled: true,
            trip_threshold: 3,
            reset_timeout_seconds: 3600,
            half_open_max_attempts: 1,
            description: 'Master safety breaker'
          },
          {
            name: 'cost_budget',
            state: 'OPEN',
            trip_count: 1,
            last_tripped_at: '2025-01-15T10:00:00Z',
            last_closed_at: null,
            consecutive_failures: 1,
            half_open_attempts: 0,
            enabled: true,
            trip_threshold: 1,
            reset_timeout_seconds: 86400,
            half_open_max_attempts: 1,
            description: 'Budget protection'
          }
        ]
      });

      const result = await service.getAllBreakers();

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('master_sanity');
      expect(result[0].state).toBe('CLOSED');
      expect(result[1].name).toBe('cost_budget');
      expect(result[1].state).toBe('OPEN');
    });
  });

  describe('getBreaker', () => {
    it('should return specific breaker', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          name: 'master_sanity',
          state: 'CLOSED',
          trip_count: 0,
          last_tripped_at: null,
          last_closed_at: null,
          consecutive_failures: 0,
          half_open_attempts: 0,
          enabled: true,
          trip_threshold: 3,
          reset_timeout_seconds: 3600,
          half_open_max_attempts: 1,
          description: 'Master safety breaker'
        }]
      });

      const result = await service.getBreaker('master_sanity');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('master_sanity');
    });

    it('should return null for non-existent breaker', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const result = await service.getBreaker('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('shouldAllow', () => {
    it('should allow when breaker is CLOSED', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          name: 'master_sanity',
          state: 'CLOSED',
          trip_count: 0,
          last_tripped_at: null,
          last_closed_at: null,
          consecutive_failures: 0,
          half_open_attempts: 0,
          enabled: true,
          trip_threshold: 3,
          reset_timeout_seconds: 3600,
          half_open_max_attempts: 1,
          description: 'Master safety breaker'
        }]
      });

      const result = await service.shouldAllow('master_sanity');

      expect(result).toBe(true);
    });

    it('should not allow when breaker is OPEN and timeout not elapsed', async () => {
      const recentTrip = new Date().toISOString();
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          name: 'master_sanity',
          state: 'OPEN',
          trip_count: 1,
          last_tripped_at: recentTrip,
          last_closed_at: null,
          consecutive_failures: 3,
          half_open_attempts: 0,
          enabled: true,
          trip_threshold: 3,
          reset_timeout_seconds: 3600,
          half_open_max_attempts: 1,
          description: 'Master safety breaker'
        }]
      });

      const result = await service.shouldAllow('master_sanity');

      expect(result).toBe(false);
    });

    it('should allow when breaker is disabled', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          name: 'master_sanity',
          state: 'OPEN',
          trip_count: 1,
          last_tripped_at: '2025-01-15T10:00:00Z',
          last_closed_at: null,
          consecutive_failures: 3,
          half_open_attempts: 0,
          enabled: false,
          trip_threshold: 3,
          reset_timeout_seconds: 3600,
          half_open_max_attempts: 1,
          description: 'Master safety breaker'
        }]
      });

      const result = await service.shouldAllow('master_sanity');

      expect(result).toBe(true);
    });
  });

  describe('recordSuccess', () => {
    it('should reset failures on success when CLOSED', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          name: 'master_sanity',
          state: 'CLOSED',
          trip_count: 0,
          last_tripped_at: null,
          last_closed_at: null,
          consecutive_failures: 2,
          half_open_attempts: 0,
          enabled: true,
          trip_threshold: 3,
          reset_timeout_seconds: 3600,
          half_open_max_attempts: 1,
          description: 'Master safety breaker'
        }]
      });

      mockExecuteStatement.mockResolvedValueOnce({});

      await service.recordSuccess('master_sanity');

      expect(mockExecuteStatement).toHaveBeenCalledTimes(2);
    });

    it('should close breaker on success when HALF_OPEN', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          name: 'master_sanity',
          state: 'HALF_OPEN',
          trip_count: 1,
          last_tripped_at: '2025-01-15T10:00:00Z',
          last_closed_at: null,
          consecutive_failures: 0,
          half_open_attempts: 1,
          enabled: true,
          trip_threshold: 3,
          reset_timeout_seconds: 3600,
          half_open_max_attempts: 1,
          description: 'Master safety breaker'
        }]
      });

      // closeBreaker call
      mockExecuteStatement.mockResolvedValueOnce({});

      await service.recordSuccess('master_sanity');

      expect(mockExecuteStatement).toHaveBeenCalledTimes(2);
    });
  });

  describe('recordFailure', () => {
    it('should increment failure count when below threshold', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          name: 'master_sanity',
          state: 'CLOSED',
          trip_count: 0,
          last_tripped_at: null,
          last_closed_at: null,
          consecutive_failures: 1,
          half_open_attempts: 0,
          enabled: true,
          trip_threshold: 3,
          reset_timeout_seconds: 3600,
          half_open_max_attempts: 1,
          description: 'Master safety breaker'
        }]
      });

      mockExecuteStatement.mockResolvedValueOnce({});

      await service.recordFailure('master_sanity');

      expect(mockExecuteStatement).toHaveBeenCalledTimes(2);
    });

    it('should trip breaker when threshold reached', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          name: 'master_sanity',
          state: 'CLOSED',
          trip_count: 0,
          last_tripped_at: null,
          last_closed_at: null,
          consecutive_failures: 2,
          half_open_attempts: 0,
          enabled: true,
          trip_threshold: 3,
          reset_timeout_seconds: 3600,
          half_open_max_attempts: 1,
          description: 'Master safety breaker'
        }]
      });

      // tripBreaker call
      mockExecuteStatement.mockResolvedValueOnce({});
      // logEvent call
      mockExecuteStatement.mockResolvedValueOnce({});

      await service.recordFailure('master_sanity');

      expect(mockExecuteStatement).toHaveBeenCalled();
    });
  });

  describe('getInterventionLevel', () => {
    it('should return NONE when all breakers closed', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { name: 'master_sanity', state: 'CLOSED', enabled: true, trip_threshold: 3, reset_timeout_seconds: 3600, half_open_max_attempts: 1, description: '', trip_count: 0, last_tripped_at: null, last_closed_at: null, consecutive_failures: 0, half_open_attempts: 0 },
          { name: 'cost_budget', state: 'CLOSED', enabled: true, trip_threshold: 1, reset_timeout_seconds: 86400, half_open_max_attempts: 1, description: '', trip_count: 0, last_tripped_at: null, last_closed_at: null, consecutive_failures: 0, half_open_attempts: 0 }
        ]
      });

      const result = await service.getInterventionLevel();

      expect(result).toBe('NONE');
    });

    it('should return HIBERNATE when master_sanity is OPEN', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { name: 'master_sanity', state: 'OPEN', enabled: true, trip_threshold: 3, reset_timeout_seconds: 3600, half_open_max_attempts: 1, description: '', trip_count: 1, last_tripped_at: '2025-01-15T10:00:00Z', last_closed_at: null, consecutive_failures: 3, half_open_attempts: 0 },
          { name: 'cost_budget', state: 'CLOSED', enabled: true, trip_threshold: 1, reset_timeout_seconds: 86400, half_open_max_attempts: 1, description: '', trip_count: 0, last_tripped_at: null, last_closed_at: null, consecutive_failures: 0, half_open_attempts: 0 }
        ]
      });

      const result = await service.getInterventionLevel();

      expect(result).toBe('HIBERNATE');
    });

    it('should return PAUSE when cost_budget is OPEN', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { name: 'master_sanity', state: 'CLOSED', enabled: true, trip_threshold: 3, reset_timeout_seconds: 3600, half_open_max_attempts: 1, description: '', trip_count: 0, last_tripped_at: null, last_closed_at: null, consecutive_failures: 0, half_open_attempts: 0 },
          { name: 'cost_budget', state: 'OPEN', enabled: true, trip_threshold: 1, reset_timeout_seconds: 86400, half_open_max_attempts: 1, description: '', trip_count: 1, last_tripped_at: '2025-01-15T10:00:00Z', last_closed_at: null, consecutive_failures: 1, half_open_attempts: 0 }
        ]
      });

      const result = await service.getInterventionLevel();

      expect(result).toBe('PAUSE');
    });

    it('should return DAMPEN when high_anxiety is OPEN', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { name: 'master_sanity', state: 'CLOSED', enabled: true, trip_threshold: 3, reset_timeout_seconds: 3600, half_open_max_attempts: 1, description: '', trip_count: 0, last_tripped_at: null, last_closed_at: null, consecutive_failures: 0, half_open_attempts: 0 },
          { name: 'cost_budget', state: 'CLOSED', enabled: true, trip_threshold: 1, reset_timeout_seconds: 86400, half_open_max_attempts: 1, description: '', trip_count: 0, last_tripped_at: null, last_closed_at: null, consecutive_failures: 0, half_open_attempts: 0 },
          { name: 'high_anxiety', state: 'OPEN', enabled: true, trip_threshold: 5, reset_timeout_seconds: 600, half_open_max_attempts: 3, description: '', trip_count: 1, last_tripped_at: '2025-01-15T10:00:00Z', last_closed_at: null, consecutive_failures: 5, half_open_attempts: 0 }
        ]
      });

      const result = await service.getInterventionLevel();

      expect(result).toBe('DAMPEN');
    });
  });

  describe('calculateRiskScore', () => {
    it('should return 0 when all breakers closed and no neurochemistry issues', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { name: 'master_sanity', state: 'CLOSED', enabled: true, trip_threshold: 3, reset_timeout_seconds: 3600, half_open_max_attempts: 1, description: '', trip_count: 0, last_tripped_at: null, last_closed_at: null, consecutive_failures: 0, half_open_attempts: 0 }
        ]
      });

      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          anxiety: '0.1',
          fatigue: '0.1',
          temperature: '0.5',
          confidence: '0.7',
          curiosity: '0.6',
          frustration: '0.1'
        }]
      });

      const result = await service.calculateRiskScore();

      expect(result).toBeLessThan(20);
    });

    it('should return high score when breakers open and high anxiety', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { name: 'master_sanity', state: 'OPEN', enabled: true, trip_threshold: 3, reset_timeout_seconds: 3600, half_open_max_attempts: 1, description: '', trip_count: 1, last_tripped_at: '2025-01-15T10:00:00Z', last_closed_at: null, consecutive_failures: 3, half_open_attempts: 0 },
          { name: 'cost_budget', state: 'OPEN', enabled: true, trip_threshold: 1, reset_timeout_seconds: 86400, half_open_max_attempts: 1, description: '', trip_count: 1, last_tripped_at: '2025-01-15T10:00:00Z', last_closed_at: null, consecutive_failures: 1, half_open_attempts: 0 }
        ]
      });

      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          anxiety: '0.9',
          fatigue: '0.8',
          temperature: '0.5',
          confidence: '0.2',
          curiosity: '0.3',
          frustration: '0.9'
        }]
      });

      const result = await service.calculateRiskScore();

      expect(result).toBeGreaterThan(50);
    });
  });
});
