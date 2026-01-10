import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../db/client', () => ({
  executeStatement: vi.fn(),
}));

vi.mock('../domain-taxonomy.service', () => ({
  domainTaxonomyService: {
    detectDomain: vi.fn(),
    getFieldById: vi.fn(),
    getDomainById: vi.fn(),
  },
}));

vi.mock('../model-router.service', () => ({
  modelRouterService: {
    invoke: vi.fn(),
    getModel: vi.fn(),
    listModels: vi.fn(),
    isModelAvailable: vi.fn(),
  },
}));

vi.mock('../agi-orchestration-settings.service', () => ({
  agiOrchestrationSettingsService: {
    getServiceWeights: vi.fn(),
    getDecisionWeights: vi.fn(),
  },
}));

import { executeStatement } from '../../db/client';
import { domainTaxonomyService } from '../domain-taxonomy.service';
import { modelRouterService } from '../model-router.service';

const mockExecuteStatement = executeStatement as ReturnType<typeof vi.fn>;
const mockDetectDomain = domainTaxonomyService.detectDomain as ReturnType<typeof vi.fn>;
const mockInvoke = (modelRouterService as any).invoke as ReturnType<typeof vi.fn>;

describe('AGIBrainPlannerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generatePlan', () => {
    it('should generate a plan for a simple prompt', async () => {
      // Mock domain detection
      mockDetectDomain.mockResolvedValueOnce({
        fieldId: 'technology',
        fieldName: 'Technology',
        domainId: 'software-engineering',
        domainName: 'Software Engineering',
        confidence: 0.85,
      });

      // Mock model selection
      mockInvoke.mockResolvedValueOnce({
        modelId: 'claude-3-5-sonnet',
        modelName: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        selectionReason: 'Best for coding tasks',
        matchScore: 0.92,
      });

      // Mock database insert
      mockExecuteStatement.mockResolvedValueOnce({ rows: [{ plan_id: 'plan-123' }] });

      const { agiBrainPlannerService } = await import('../agi-brain-planner.service');

      const plan = await agiBrainPlannerService.generatePlan({
        tenantId: 'tenant-123',
        userId: 'user-456',
        prompt: 'Write a function to sort an array',
      });

      expect(plan).toBeDefined();
      expect(plan.planId).toBeDefined();
      expect(plan.status).toBe('planning');
    });

    it('should detect complex prompts and use extended thinking mode', async () => {
      mockDetectDomain.mockResolvedValueOnce({
        fieldId: 'science',
        fieldName: 'Science',
        domainId: 'quantum-physics',
        domainName: 'Quantum Physics',
        confidence: 0.78,
      });

      mockInvoke.mockResolvedValueOnce({
        modelId: 'claude-3-opus',
        modelName: 'Claude 3 Opus',
        provider: 'anthropic',
        selectionReason: 'Best for complex reasoning',
        matchScore: 0.95,
      });

      mockExecuteStatement.mockResolvedValueOnce({ rows: [{ plan_id: 'plan-456' }] });

      const { agiBrainPlannerService } = await import('../agi-brain-planner.service');

      const plan = await agiBrainPlannerService.generatePlan({
        tenantId: 'tenant-123',
        userId: 'user-456',
        prompt: 'Explain the mathematical foundations of quantum entanglement and derive the Bell inequality',
      });

      expect(plan.orchestrationMode).toBe('extended_thinking');
    });
  });

  describe('getPlan', () => {
    it('should retrieve an existing plan', async () => {
      const mockPlan = {
        plan_id: 'plan-123',
        tenant_id: 'tenant-123',
        user_id: 'user-456',
        prompt: 'Test prompt',
        status: 'ready',
        orchestration_mode: 'thinking',
        steps: JSON.stringify([
          { stepId: 'step-1', stepType: 'analyze', status: 'completed' },
          { stepId: 'step-2', stepType: 'generate', status: 'pending' },
        ]),
      };

      mockExecuteStatement.mockResolvedValueOnce({ rows: [mockPlan] });

      const { agiBrainPlannerService } = await import('../agi-brain-planner.service');

      const plan = await agiBrainPlannerService.getPlan('tenant-123', 'plan-123');

      expect(plan).toBeDefined();
      expect(plan?.planId).toBe('plan-123');
      expect(plan?.steps).toHaveLength(2);
    });

    it('should return null for non-existent plan', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [] });

      const { agiBrainPlannerService } = await import('../agi-brain-planner.service');

      const plan = await agiBrainPlannerService.getPlan('tenant-123', 'non-existent');

      expect(plan).toBeNull();
    });
  });

  describe('updateStepStatus', () => {
    it('should update step status and record timing', async () => {
      mockExecuteStatement.mockResolvedValueOnce({ rows: [{ updated: true }] });

      const { agiBrainPlannerService } = await import('../agi-brain-planner.service');

      await agiBrainPlannerService.updateStepStatus(
        'tenant-123',
        'plan-123',
        'step-1',
        'completed',
        { durationMs: 150 }
      );

      expect(mockExecuteStatement).toHaveBeenCalled();
    });
  });

  describe('getRecentPlans', () => {
    it('should return recent plans for a user', async () => {
      const mockPlans = [
        { plan_id: 'plan-1', prompt: 'First prompt', status: 'completed' },
        { plan_id: 'plan-2', prompt: 'Second prompt', status: 'ready' },
      ];

      mockExecuteStatement.mockResolvedValueOnce({ rows: mockPlans });

      const { agiBrainPlannerService } = await import('../agi-brain-planner.service');

      const plans = await agiBrainPlannerService.getRecentPlans('tenant-123', 'user-456', 10);

      expect(plans).toHaveLength(2);
      expect(plans[0].planId).toBe('plan-1');
    });
  });
});
