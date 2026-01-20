import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../logging/enhanced-logger', () => ({
  enhancedLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../delight.service', () => ({
  delightService: {
    getMessagesForOrchestration: vi.fn().mockResolvedValue([]),
    getDelightMessage: vi.fn().mockResolvedValue({ message: null, selectedText: null }),
    recordAchievementProgress: vi.fn().mockResolvedValue({ justUnlocked: [] }),
  },
}));

import { delightService } from '../delight.service';
import type { AGIBrainPlan, PlanStep } from '../agi-brain-planner.service';

const mockDelightService = delightService as {
  getMessagesForOrchestration: ReturnType<typeof vi.fn>;
  getDelightMessage: ReturnType<typeof vi.fn>;
  recordAchievementProgress: ReturnType<typeof vi.fn>;
};

// Create mock plan
function createMockPlan(overrides?: Partial<AGIBrainPlan>): AGIBrainPlan {
  return {
    planId: 'plan-123',
    sessionId: 'session-456',
    status: 'executing',
    orchestrationMode: 'thinking',
    primaryModel: { modelId: 'model-1', modelName: 'Claude 3.5', provider: 'anthropic' },
    fallbackModels: [{ modelId: 'model-2', modelName: 'GPT-4', provider: 'openai' }],
    steps: [
      { stepId: 'step-1', stepType: 'analyze', title: 'Analyze', description: 'Analyze request', status: 'pending' },
      { stepId: 'step-2', stepType: 'generate', title: 'Generate', description: 'Generate response', status: 'pending' },
    ] as PlanStep[],
    currentStepIndex: 0,
    promptAnalysis: {
      complexity: 'moderate',
      requiresMultiStep: false,
      estimatedTokens: 1000,
    },
    domainDetection: {
      domainId: 'domain-1',
      domainName: 'physics',
      confidence: 0.9,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as AGIBrainPlan;
}

describe('DelightOrchestrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('getDelightForEvent', () => {
    it('should return messages for plan_start event', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      mockDelightService.getMessagesForOrchestration.mockResolvedValueOnce([
        { message: null, selectedText: 'Let\'s get started!' },
      ]);
      mockDelightService.getDelightMessage.mockResolvedValueOnce({
        message: null,
        selectedText: 'Thinking through the problem...',
      });

      const result = await delightOrchestrationService.getDelightForEvent(
        { eventType: 'plan_start', plan: createMockPlan() },
        'user-123',
        'tenant-456'
      );

      expect(result.messages).toBeDefined();
      expect(result.soundEffect).toBe('transition_whoosh');
    });

    it('should return messages for step_start event', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      const plan = createMockPlan();
      const step = plan.steps[0];

      mockDelightService.getMessagesForOrchestration.mockResolvedValueOnce([]);
      mockDelightService.getDelightMessage.mockResolvedValueOnce({
        message: null,
        selectedText: 'Analyzing your request...',
      });

      const result = await delightOrchestrationService.getDelightForEvent(
        { eventType: 'step_start', plan, step },
        'user-123',
        'tenant-456'
      );

      expect(result.messages).toBeDefined();
      expect(mockDelightService.getDelightMessage).toHaveBeenCalled();
    });

    it('should return sound effect for plan_complete event', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      mockDelightService.getMessagesForOrchestration.mockResolvedValueOnce([]);
      mockDelightService.recordAchievementProgress.mockResolvedValue({ justUnlocked: [] });

      const result = await delightOrchestrationService.getDelightForEvent(
        { eventType: 'plan_complete', plan: createMockPlan({ status: 'completed' }) },
        'user-123',
        'tenant-456'
      );

      expect(result.soundEffect).toBe('confirm_chime');
    });

    it('should check achievements on plan_complete', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      mockDelightService.getMessagesForOrchestration.mockResolvedValueOnce([]);
      mockDelightService.recordAchievementProgress.mockResolvedValue({
        justUnlocked: [{ id: 'ach-1', name: 'First Query', celebrationMessage: 'Congrats!' }],
      });

      const result = await delightOrchestrationService.getDelightForEvent(
        { eventType: 'plan_complete', plan: createMockPlan({ status: 'completed' }) },
        'user-123',
        'tenant-456'
      );

      expect(result.achievements).toBeDefined();
      expect(result.achievements!.length).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      mockDelightService.getMessagesForOrchestration.mockRejectedValueOnce(new Error('DB error'));

      const result = await delightOrchestrationService.getDelightForEvent(
        { eventType: 'plan_start', plan: createMockPlan() },
        'user-123',
        'tenant-456'
      );

      expect(result.messages).toEqual([]);
    });
  });

  describe('getContextualMessage', () => {
    it('should return step message when step exists', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      const plan = createMockPlan();
      const message = delightOrchestrationService.getContextualMessage(plan);

      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
    });

    it('should return completion message when plan is completed', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      const plan = createMockPlan({ status: 'completed', currentStepIndex: 2 });
      const message = delightOrchestrationService.getContextualMessage(plan);

      expect(message).toBe('Response complete!');
    });
  });

  describe('getDomainLoadingMessage', () => {
    it('should return domain-specific message for known domain', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      const plan = createMockPlan({
        domainDetection: { domainId: '1', domainName: 'physics', confidence: 0.9 },
      });
      
      const message = delightOrchestrationService.getDomainLoadingMessage(plan);
      
      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
    });

    it('should return mode-specific message for unknown domain', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      const plan = createMockPlan({
        domainDetection: undefined,
        orchestrationMode: 'creative',
      });
      
      const message = delightOrchestrationService.getDomainLoadingMessage(plan);
      
      expect(message).toBeDefined();
      expect(['Creative mode unleashed...', 'Imagination flowing...', 'Artistic neurons firing...']).toContain(message);
    });

    it('should return fallback for no domain or mode messages', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      const plan = createMockPlan({
        domainDetection: { domainId: '1', domainName: 'unknown_domain', confidence: 0.5 },
      });
      
      const message = delightOrchestrationService.getDomainLoadingMessage(plan);
      
      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
    });
  });

  describe('getModelDynamicsMessage', () => {
    it('should return strong consensus message', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      const message = delightOrchestrationService.getModelDynamicsMessage('strong');
      
      expect(['Consensus forming...', 'The models agree on this one.', 'Strong agreement across the board.']).toContain(message);
    });

    it('should return moderate consensus message', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      const message = delightOrchestrationService.getModelDynamicsMessage('moderate');
      
      expect(['Cross-checking perspectives...', 'Balancing different viewpoints...', 'Models discussing the approach...']).toContain(message);
    });

    it('should return divergent consensus message', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      const message = delightOrchestrationService.getModelDynamicsMessage('divergent');
      
      expect(['The models are debating this one.', 'Interesting disagreement emerging.', 'Multiple perspectives at play.']).toContain(message);
    });
  });

  describe('getSynthesisMessage', () => {
    it('should return high confidence message for confidence >= 0.9', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      const message = delightOrchestrationService.getSynthesisMessage(0.95);
      expect(message).toBe('High confidence on this one.');
    });

    it('should return solid message for confidence >= 0.7', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      const message = delightOrchestrationService.getSynthesisMessage(0.75);
      expect(message).toBe('Solid synthesis achieved.');
    });

    it('should return nuanced message for confidence >= 0.5', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      const message = delightOrchestrationService.getSynthesisMessage(0.55);
      expect(message).toBe('Some nuance worth noting.');
    });

    it('should return complex message for low confidence', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      const message = delightOrchestrationService.getSynthesisMessage(0.3);
      expect(message).toBe('This is a complex area with varying perspectives.');
    });
  });

  describe('clearSession', () => {
    it('should clear previous domain for user', async () => {
      const { delightOrchestrationService } = await import('../delight-orchestration.service');
      
      // First call to set domain
      mockDelightService.getMessagesForOrchestration.mockResolvedValueOnce([]);
      await delightOrchestrationService.getDelightForEvent(
        { eventType: 'plan_start', plan: createMockPlan() },
        'user-123',
        'tenant-456'
      );

      // Clear session
      delightOrchestrationService.clearSession('user-123');

      // Next call should treat as first domain
      mockDelightService.getMessagesForOrchestration.mockResolvedValueOnce([]);
      await delightOrchestrationService.getDelightForEvent(
        { eventType: 'plan_start', plan: createMockPlan() },
        'user-123',
        'tenant-456'
      );

      // Should have been called twice without domain switch on second call
      expect(mockDelightService.getMessagesForOrchestration).toHaveBeenCalledTimes(2);
    });
  });
});
