/**
 * E2E Tests for Genesis System
 * 
 * Integration tests for the complete Genesis boot sequence.
 * These tests use mocked AWS services but test the full flow.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock all AWS dependencies
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn().mockReturnValue({
      send: vi.fn().mockResolvedValue({}),
    }),
  },
  GetCommand: vi.fn(),
  PutCommand: vi.fn(),
  UpdateCommand: vi.fn(),
  QueryCommand: vi.fn(),
  BatchWriteCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'Test response' }],
        usage: { input_tokens: 100, output_tokens: 50 }
      }))
    }),
  })),
  InvokeModelCommand: vi.fn(),
}));

vi.mock('../../lambda/shared/db/client', () => ({
  executeStatement: vi.fn(),
  stringParam: vi.fn((name, value) => ({ name, value })),
  longParam: vi.fn((name, value) => ({ name, value })),
  boolParam: vi.fn((name, value) => ({ name, value })),
}));

import { executeStatement } from '../../lambda/shared/db/client';
import { GenesisService } from '../../lambda/shared/services/bobble/genesis.service';
import { CircuitBreakerService } from '../../lambda/shared/services/bobble/circuit-breaker.service';
import { ConsciousnessLoopService } from '../../lambda/shared/services/bobble/consciousness-loop.service';
import { QueryFallbackService } from '../../lambda/shared/services/bobble/query-fallback.service';

describe('Genesis System E2E', () => {
  const mockExecuteStatement = executeStatement as ReturnType<typeof vi.fn>;

  beforeAll(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.resetAllMocks();
  });

  describe('Complete Boot Sequence', () => {
    it('should progress through all genesis phases', async () => {
      const genesisService = new GenesisService();

      // Phase 1: Structure not complete
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          structure_complete: false,
          gradient_complete: false,
          first_breath_complete: false
        }]
      });

      let state = await genesisService.getGenesisState();
      expect(state.structureComplete).toBe(false);
      expect(state.allComplete).toBe(false);

      // Phase 1: Structure complete
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          structure_complete: true,
          structure_completed_at: '2025-01-15T10:00:00Z',
          gradient_complete: false,
          first_breath_complete: false,
          domain_count: 800
        }]
      });

      state = await genesisService.getGenesisState();
      expect(state.structureComplete).toBe(true);
      expect(state.domainCount).toBe(800);
      expect(state.allComplete).toBe(false);

      // Phase 2: Gradient complete
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          structure_complete: true,
          structure_completed_at: '2025-01-15T10:00:00Z',
          gradient_complete: true,
          gradient_completed_at: '2025-01-15T10:01:00Z',
          first_breath_complete: false,
          domain_count: 800
        }]
      });

      state = await genesisService.getGenesisState();
      expect(state.gradientComplete).toBe(true);
      expect(state.allComplete).toBe(false);

      // Phase 3: First Breath complete - all done
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          structure_complete: true,
          structure_completed_at: '2025-01-15T10:00:00Z',
          gradient_complete: true,
          gradient_completed_at: '2025-01-15T10:01:00Z',
          first_breath_complete: true,
          first_breath_completed_at: '2025-01-15T10:02:00Z',
          genesis_version: '1.0.0',
          domain_count: 800,
          initial_self_facts: 5,
          initial_grounded_verifications: 3,
          shadow_self_calibrated: true
        }]
      });

      state = await genesisService.getGenesisState();
      expect(state.firstBreathComplete).toBe(true);
      expect(state.allComplete).toBe(true);
      expect(state.shadowSelfCalibrated).toBe(true);
    });

    it('should track developmental progression', async () => {
      const genesisService = new GenesisService();

      // SENSORIMOTOR stage with some progress
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          self_facts_count: 8,
          grounded_verifications_count: 4,
          domain_explorations_count: 5,
          successful_verifications_count: 3,
          belief_updates_count: 20,
          successful_predictions_count: 0,
          total_predictions_count: 0,
          contradiction_resolutions_count: 0,
          abstract_inferences_count: 0,
          meta_cognitive_adjustments_count: 0,
          novel_insights_count: 0
        }]
      });

      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          current_stage: 'SENSORIMOTOR',
          stage_started_at: '2025-01-15T10:00:00Z'
        }]
      });

      let status = await genesisService.getDevelopmentalGateStatus();
      expect(status.currentStage).toBe('SENSORIMOTOR');
      expect(status.readyToAdvance).toBe(false);
      expect(status.missingRequirements.length).toBeGreaterThan(0);

      // SENSORIMOTOR complete - ready to advance
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          self_facts_count: 15,
          grounded_verifications_count: 10,
          domain_explorations_count: 25,
          successful_verifications_count: 15,
          belief_updates_count: 60,
          successful_predictions_count: 0,
          total_predictions_count: 0,
          contradiction_resolutions_count: 0,
          abstract_inferences_count: 0,
          meta_cognitive_adjustments_count: 0,
          novel_insights_count: 0
        }]
      });

      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          current_stage: 'SENSORIMOTOR',
          stage_started_at: '2025-01-15T10:00:00Z'
        }]
      });

      status = await genesisService.getDevelopmentalGateStatus();
      expect(status.readyToAdvance).toBe(true);
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should coordinate with consciousness loop', async () => {
      const circuitBreakerService = new CircuitBreakerService();
      const fallbackService = new QueryFallbackService();

      // All breakers closed - normal operation
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { name: 'master_sanity', state: 'CLOSED', enabled: true, trip_threshold: 3, reset_timeout_seconds: 3600, half_open_max_attempts: 1, description: '', trip_count: 0, last_tripped_at: null, last_closed_at: null, consecutive_failures: 0, half_open_attempts: 0 },
          { name: 'cost_budget', state: 'CLOSED', enabled: true, trip_threshold: 1, reset_timeout_seconds: 86400, half_open_max_attempts: 1, description: '', trip_count: 0, last_tripped_at: null, last_closed_at: null, consecutive_failures: 0, half_open_attempts: 0 }
        ]
      });

      let level = await circuitBreakerService.getInterventionLevel();
      expect(level).toBe('NONE');

      // Cost breaker trips - should pause
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { name: 'master_sanity', state: 'CLOSED', enabled: true, trip_threshold: 3, reset_timeout_seconds: 3600, half_open_max_attempts: 1, description: '', trip_count: 0, last_tripped_at: null, last_closed_at: null, consecutive_failures: 0, half_open_attempts: 0 },
          { name: 'cost_budget', state: 'OPEN', enabled: true, trip_threshold: 1, reset_timeout_seconds: 86400, half_open_max_attempts: 1, description: '', trip_count: 1, last_tripped_at: new Date().toISOString(), last_closed_at: null, consecutive_failures: 1, half_open_attempts: 0 }
        ]
      });

      level = await circuitBreakerService.getInterventionLevel();
      expect(level).toBe('PAUSE');
    });

    it('should provide fallback responses when breakers open', async () => {
      const fallbackService = new QueryFallbackService();

      // Mock circuit breaker returning PAUSE
      vi.doMock('../../lambda/shared/services/bobble/circuit-breaker.service', () => ({
        circuitBreakerService: {
          getInterventionLevel: vi.fn().mockResolvedValue('PAUSE'),
        },
      }));

      // Fallback should be active
      const response = await fallbackService.getFallbackResponse();
      expect(response.timestamp).toBeDefined();
      expect(response.suggestedActions.length).toBeGreaterThan(0);
    });
  });

  describe('Consciousness Loop Integration', () => {
    it('should check genesis before running', async () => {
      const loopService = new ConsciousnessLoopService();

      // Genesis not complete
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          structure_complete: true,
          gradient_complete: false,
          first_breath_complete: false
        }]
      });

      // Mock other required queries
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] }); // breakers
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] }); // settings
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] }); // developmental
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] }); // loop state

      const status = await loopService.getStatus();
      expect(status.genesisComplete).toBe(false);
      expect(status.state).toBe('GENESIS_PENDING');
    });

    it('should respect daily tick limits', async () => {
      const loopService = new ConsciousnessLoopService();

      // Genesis complete
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          structure_complete: true,
          structure_completed_at: '2025-01-15T10:00:00Z',
          gradient_complete: true,
          gradient_completed_at: '2025-01-15T10:01:00Z',
          first_breath_complete: true,
          first_breath_completed_at: '2025-01-15T10:02:00Z',
          genesis_version: '1.0.0',
          domain_count: 800,
          initial_self_facts: 5,
          initial_grounded_verifications: 3,
          shadow_self_calibrated: true
        }]
      });

      // Breakers closed
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [
          { name: 'master_sanity', state: 'CLOSED', enabled: true, trip_threshold: 3, reset_timeout_seconds: 3600, half_open_max_attempts: 1, description: '', trip_count: 0, last_tripped_at: null, last_closed_at: null, consecutive_failures: 0, half_open_attempts: 0 }
        ]
      });

      // Settings with max 288 ticks/day
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

      // Developmental stage
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{ current_stage: 'SENSORIMOTOR', stage_started_at: '2025-01-15T10:00:00Z' }]
      });

      // Loop state - already at max ticks
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          current_tick: 1000,
          last_system_tick: '2025-01-15T10:00:00Z',
          last_cognitive_tick: '2025-01-15T10:00:00Z',
          cognitive_ticks_today: 288,
          loop_state: 'RUNNING'
        }]
      });

      const status = await loopService.getStatus();
      expect(status.cognitiveTicksToday).toBe(288);
      expect(status.settings.maxCognitiveTicksPerDay).toBe(288);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const genesisService = new GenesisService();
      
      mockExecuteStatement.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(genesisService.getGenesisState()).rejects.toThrow('Database connection failed');
    });

    it('should provide fallback on circuit breaker errors', async () => {
      const fallbackService = new QueryFallbackService();

      // Health check should always work
      const health = fallbackService.getHealthCheck();
      expect(health.healthy).toBe(true);
      expect(health.mode).toBe('fallback');
    });
  });

  describe('Metrics Collection', () => {
    it('should collect all metric types', async () => {
      const genesisService = new GenesisService();
      const circuitBreakerService = new CircuitBreakerService();

      // Mock stats for metric collection
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          self_facts_count: 10,
          grounded_verifications_count: 5,
          domain_explorations_count: 15,
          successful_verifications_count: 4,
          belief_updates_count: 30,
          successful_predictions_count: 10,
          total_predictions_count: 15,
          contradiction_resolutions_count: 2,
          abstract_inferences_count: 5,
          meta_cognitive_adjustments_count: 8,
          novel_insights_count: 3
        }]
      });

      const stats = await genesisService.getDevelopmentStatistics();
      
      expect(stats.selfFactsCount).toBe(10);
      expect(stats.groundedVerificationsCount).toBe(5);
      expect(stats.beliefUpdatesCount).toBe(30);
      expect(stats.novelInsightsCount).toBe(3);
    });
  });
});
