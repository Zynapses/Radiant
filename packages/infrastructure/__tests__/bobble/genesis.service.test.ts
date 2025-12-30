/**
 * Unit Tests for Genesis Service
 * 
 * Tests for genesis state management, developmental gates,
 * and stage progression.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the database client
vi.mock('../../lambda/shared/db/client', () => ({
  executeStatement: vi.fn(),
  stringParam: vi.fn((name, value) => ({ name, value })),
  longParam: vi.fn((name, value) => ({ name, value })),
  boolParam: vi.fn((name, value) => ({ name, value })),
}));

import { executeStatement } from '../../lambda/shared/db/client';
import { 
  GenesisService, 
  GenesisState, 
  DevelopmentStatistics,
  DevelopmentalGateStatus 
} from '../../lambda/shared/services/bobble/genesis.service';

describe('GenesisService', () => {
  let service: GenesisService;
  const mockExecuteStatement = executeStatement as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GenesisService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getGenesisState', () => {
    it('should return default state when no rows found', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const result = await service.getGenesisState();

      expect(result).toEqual({
        structureComplete: false,
        structureCompletedAt: null,
        gradientComplete: false,
        gradientCompletedAt: null,
        firstBreathComplete: false,
        firstBreathCompletedAt: null,
        genesisVersion: null,
        domainCount: null,
        initialSelfFacts: null,
        initialGroundedVerifications: null,
        shadowSelfCalibrated: false,
        allComplete: false
      });
    });

    it('should return complete state when all phases done', async () => {
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

      const result = await service.getGenesisState();

      expect(result.allComplete).toBe(true);
      expect(result.structureComplete).toBe(true);
      expect(result.gradientComplete).toBe(true);
      expect(result.firstBreathComplete).toBe(true);
      expect(result.domainCount).toBe(800);
    });

    it('should return partial state when only structure complete', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          structure_complete: true,
          structure_completed_at: '2025-01-15T10:00:00Z',
          gradient_complete: false,
          gradient_completed_at: null,
          first_breath_complete: false,
          first_breath_completed_at: null,
          genesis_version: null,
          domain_count: 800,
          initial_self_facts: null,
          initial_grounded_verifications: null,
          shadow_self_calibrated: false
        }]
      });

      const result = await service.getGenesisState();

      expect(result.allComplete).toBe(false);
      expect(result.structureComplete).toBe(true);
      expect(result.gradientComplete).toBe(false);
    });
  });

  describe('getDevelopmentStatistics', () => {
    it('should return zeros when no counters found', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const result = await service.getDevelopmentStatistics();

      expect(result.selfFactsCount).toBe(0);
      expect(result.groundedVerificationsCount).toBe(0);
      expect(result.domainExplorationsCount).toBe(0);
    });

    it('should return actual counter values', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          self_facts_count: 15,
          grounded_verifications_count: 10,
          domain_explorations_count: 25,
          successful_verifications_count: 8,
          belief_updates_count: 100,
          successful_predictions_count: 50,
          total_predictions_count: 75,
          contradiction_resolutions_count: 5,
          abstract_inferences_count: 20,
          meta_cognitive_adjustments_count: 30,
          novel_insights_count: 10
        }]
      });

      const result = await service.getDevelopmentStatistics();

      expect(result.selfFactsCount).toBe(15);
      expect(result.groundedVerificationsCount).toBe(10);
      expect(result.domainExplorationsCount).toBe(25);
      expect(result.successfulPredictionsCount).toBe(50);
    });
  });

  describe('incrementCounter', () => {
    it('should increment valid counter', async () => {
      mockExecuteStatement.mockResolvedValueOnce({});

      await service.incrementCounter('self_facts_count', 1);

      expect(mockExecuteStatement).toHaveBeenCalledTimes(1);
    });

    it('should reject invalid counter name', async () => {
      await expect(
        service.incrementCounter('invalid_counter', 1)
      ).rejects.toThrow('Invalid counter name');
    });

    it('should increment by custom amount', async () => {
      mockExecuteStatement.mockResolvedValueOnce({});

      await service.incrementCounter('belief_updates_count', 5);

      expect(mockExecuteStatement).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDevelopmentalGateStatus', () => {
    it('should return SENSORIMOTOR with missing requirements', async () => {
      // Mock getDevelopmentStatistics
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          self_facts_count: 5,
          grounded_verifications_count: 2,
          domain_explorations_count: 0,
          successful_verifications_count: 0,
          belief_updates_count: 0,
          successful_predictions_count: 0,
          total_predictions_count: 0,
          contradiction_resolutions_count: 0,
          abstract_inferences_count: 0,
          meta_cognitive_adjustments_count: 0,
          novel_insights_count: 0
        }]
      });

      // Mock stage query
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          current_stage: 'SENSORIMOTOR',
          stage_started_at: '2025-01-15T10:00:00Z'
        }]
      });

      const result = await service.getDevelopmentalGateStatus();

      expect(result.currentStage).toBe('SENSORIMOTOR');
      expect(result.readyToAdvance).toBe(false);
      expect(result.missingRequirements.length).toBeGreaterThan(0);
    });

    it('should be ready to advance when requirements met', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          self_facts_count: 15,
          grounded_verifications_count: 10,
          domain_explorations_count: 25,
          successful_verifications_count: 20,
          belief_updates_count: 100,
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

      const result = await service.getDevelopmentalGateStatus();

      expect(result.currentStage).toBe('SENSORIMOTOR');
      expect(result.readyToAdvance).toBe(true);
      expect(result.missingRequirements.length).toBe(0);
    });
  });

  describe('advanceStage', () => {
    it('should not advance when not ready', async () => {
      // Mock getDevelopmentStatistics - not enough
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          self_facts_count: 5,
          grounded_verifications_count: 2,
          domain_explorations_count: 0,
          successful_verifications_count: 0,
          belief_updates_count: 0,
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

      const result = await service.advanceStage();

      expect(result.advanced).toBe(false);
      expect(result.reason).toContain('Not ready');
    });

    it('should advance when ready', async () => {
      // First call - getDevelopmentStatistics
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          self_facts_count: 15,
          grounded_verifications_count: 10,
          domain_explorations_count: 25,
          successful_verifications_count: 20,
          belief_updates_count: 100,
          successful_predictions_count: 0,
          total_predictions_count: 0,
          contradiction_resolutions_count: 0,
          abstract_inferences_count: 0,
          meta_cognitive_adjustments_count: 0,
          novel_insights_count: 0
        }]
      });

      // Second call - stage query
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          current_stage: 'SENSORIMOTOR',
          stage_started_at: '2025-01-15T10:00:00Z'
        }]
      });

      // Third call - update stage
      mockExecuteStatement.mockResolvedValueOnce({});

      const result = await service.advanceStage();

      expect(result.advanced).toBe(true);
      expect(result.newStage).toBe('PREOPERATIONAL');
    });

    it('should not advance from FORMAL_OPERATIONAL', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          self_facts_count: 1000,
          grounded_verifications_count: 500,
          domain_explorations_count: 500,
          successful_verifications_count: 400,
          belief_updates_count: 1000,
          successful_predictions_count: 200,
          total_predictions_count: 250,
          contradiction_resolutions_count: 50,
          abstract_inferences_count: 100,
          meta_cognitive_adjustments_count: 100,
          novel_insights_count: 50
        }]
      });

      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          current_stage: 'FORMAL_OPERATIONAL',
          stage_started_at: '2025-01-15T10:00:00Z'
        }]
      });

      const result = await service.advanceStage();

      expect(result.advanced).toBe(false);
      expect(result.reason).toBe('Already at final stage');
    });
  });

  describe('isReadyForConsciousness', () => {
    it('should return false when genesis incomplete', async () => {
      mockExecuteStatement.mockResolvedValueOnce({
        rows: [{
          structure_complete: true,
          gradient_complete: false,
          first_breath_complete: false
        }]
      });

      const result = await service.isReadyForConsciousness();

      expect(result).toBe(false);
    });

    it('should return true when genesis complete', async () => {
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

      const result = await service.isReadyForConsciousness();

      expect(result).toBe(true);
    });
  });
});
