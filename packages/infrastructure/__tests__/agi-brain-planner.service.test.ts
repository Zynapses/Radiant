/**
 * Unit tests for AGI Brain Planner Service
 * 
 * Tests the real-time planning system that shows users the AGI's plan to solve
 * a prompt, including steps, orchestration modes, and model selection.
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

jest.mock('../lambda/shared/services/domain-taxonomy.service', () => ({
  domainTaxonomyService: {
    detectDomain: jest.fn(),
    matchModels: jest.fn(),
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

describe('AGIBrainPlannerService', () => {
  let agiBrainPlannerService: typeof import('../lambda/shared/services/agi-brain-planner.service');
  let executeStatement: jest.Mock;
  let domainTaxonomyService: { detectDomain: jest.Mock; matchModels: jest.Mock };

  const mockDomainDetection = {
    fieldId: 'technology',
    fieldName: 'Technology',
    domainId: 'software_engineering',
    domainName: 'Software Engineering',
    subspecialtyId: 'backend_development',
    subspecialtyName: 'Backend Development',
    confidence: 0.85,
    proficiencies: {
      reasoning_depth: 8,
      code_generation: 9,
      mathematical_quantitative: 6,
    },
  };

  const mockMatchedModels = [
    {
      modelId: 'claude-3-5-sonnet',
      modelName: 'Claude 3.5 Sonnet',
      matchScore: 0.92,
      reason: 'High code generation proficiency',
    },
    {
      modelId: 'gpt-4-turbo',
      modelName: 'GPT-4 Turbo',
      matchScore: 0.88,
      reason: 'Strong reasoning capabilities',
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    executeStatement = (await import('../lambda/shared/db/client')).executeStatement as jest.Mock;
    domainTaxonomyService = (await import('../lambda/shared/services/domain-taxonomy.service')).domainTaxonomyService as any;
    
    domainTaxonomyService.detectDomain.mockResolvedValue(mockDomainDetection);
    domainTaxonomyService.matchModels.mockResolvedValue(mockMatchedModels);
    executeStatement.mockResolvedValue({ rows: [], rowCount: 0 });

    agiBrainPlannerService = await import('../lambda/shared/services/agi-brain-planner.service');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Plan Generation
  // ==========================================================================

  describe('generatePlan', () => {
    it('should generate a plan for a coding prompt', async () => {
      const result = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Write a function to sort an array in TypeScript',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      expect(result.planId).toBeDefined();
      expect(result.mode).toBe('coding');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.selectedModel).toBeDefined();
    });

    it('should generate a plan for a research prompt', async () => {
      domainTaxonomyService.detectDomain.mockResolvedValue({
        ...mockDomainDetection,
        fieldId: 'science',
        domainId: 'research_methodology',
      });

      const result = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Research the impact of climate change on coral reefs',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      expect(result.mode).toBe('research');
      expect(result.steps.some(s => s.type === 'research' || s.type === 'synthesize')).toBe(true);
    });

    it('should generate a plan for creative writing', async () => {
      const result = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Write a poem about the ocean',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      expect(result.mode).toBe('creative');
    });

    it('should include domain detection in plan', async () => {
      const result = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Explain quantum entanglement',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      expect(result.domain).toBeDefined();
      expect(result.domain.confidence).toBeGreaterThan(0);
    });

    it('should include user context when available', async () => {
      const result = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Help me with my project',
        tenantId: 'tenant-123',
        userId: 'user-456',
        enableUserContext: true,
      });

      expect(result.userContext).toBeDefined();
    });

    it('should estimate timing for each step', async () => {
      const result = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Complex multi-step analysis',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      expect(result.steps.every(s => s.estimatedMs > 0)).toBe(true);
      expect(result.totalEstimatedMs).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Orchestration Mode Detection
  // ==========================================================================

  describe('detectOrchestrationMode', () => {
    it('should detect thinking mode for simple questions', async () => {
      const mode = await agiBrainPlannerService.agiBrainPlannerService.detectOrchestrationMode(
        'What is the capital of France?',
        mockDomainDetection
      );

      expect(mode).toBe('thinking');
    });

    it('should detect extended_thinking for complex reasoning', async () => {
      const mode = await agiBrainPlannerService.agiBrainPlannerService.detectOrchestrationMode(
        'Analyze the ethical implications of AI in healthcare considering multiple stakeholder perspectives',
        mockDomainDetection
      );

      expect(mode).toBe('extended_thinking');
    });

    it('should detect coding mode for programming tasks', async () => {
      const mode = await agiBrainPlannerService.agiBrainPlannerService.detectOrchestrationMode(
        'Write a Python script to parse JSON files',
        mockDomainDetection
      );

      expect(mode).toBe('coding');
    });

    it('should detect creative mode for creative tasks', async () => {
      const mode = await agiBrainPlannerService.agiBrainPlannerService.detectOrchestrationMode(
        'Write a short story about a robot learning to feel emotions',
        mockDomainDetection
      );

      expect(mode).toBe('creative');
    });

    it('should detect research mode for research queries', async () => {
      const mode = await agiBrainPlannerService.agiBrainPlannerService.detectOrchestrationMode(
        'Research and summarize recent developments in quantum computing',
        mockDomainDetection
      );

      expect(mode).toBe('research');
    });

    it('should detect analysis mode for data analysis', async () => {
      const mode = await agiBrainPlannerService.agiBrainPlannerService.detectOrchestrationMode(
        'Analyze this dataset and provide statistical insights',
        mockDomainDetection
      );

      expect(mode).toBe('analysis');
    });

    it('should detect multi_model for complex comparisons', async () => {
      const mode = await agiBrainPlannerService.agiBrainPlannerService.detectOrchestrationMode(
        'Compare three different approaches to solving this problem and synthesize the best solution',
        mockDomainDetection
      );

      expect(mode).toBe('multi_model');
    });
  });

  // ==========================================================================
  // Plan Steps
  // ==========================================================================

  describe('generatePlanSteps', () => {
    it('should generate appropriate steps for coding mode', async () => {
      const steps = await agiBrainPlannerService.agiBrainPlannerService.generatePlanSteps(
        'coding',
        'Write a function to calculate fibonacci numbers',
        mockDomainDetection
      );

      expect(steps.some(s => s.type === 'analyze')).toBe(true);
      expect(steps.some(s => s.type === 'generate')).toBe(true);
    });

    it('should include ethics check for sensitive topics', async () => {
      const steps = await agiBrainPlannerService.agiBrainPlannerService.generatePlanSteps(
        'thinking',
        'How can AI be used for surveillance?',
        mockDomainDetection
      );

      expect(steps.some(s => s.type === 'ethics_check')).toBe(true);
    });

    it('should include verification for factual queries', async () => {
      const steps = await agiBrainPlannerService.agiBrainPlannerService.generatePlanSteps(
        'research',
        'What are the current statistics on climate change?',
        mockDomainDetection
      );

      expect(steps.some(s => s.type === 'verify')).toBe(true);
    });

    it('should include reflection step for extended thinking', async () => {
      const steps = await agiBrainPlannerService.agiBrainPlannerService.generatePlanSteps(
        'extended_thinking',
        'Analyze the long-term societal implications',
        mockDomainDetection
      );

      expect(steps.some(s => s.type === 'reflect')).toBe(true);
    });
  });

  // ==========================================================================
  // Plan Execution
  // ==========================================================================

  describe('executePlan', () => {
    it('should execute plan and update step statuses', async () => {
      const plan = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Simple question',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      const result = await agiBrainPlannerService.agiBrainPlannerService.executePlan(
        plan.planId,
        'tenant-123'
      );

      expect(result.status).toBe('completed');
      expect(result.response).toBeDefined();
    });

    it('should handle step failures gracefully', async () => {
      executeStatement.mockRejectedValueOnce(new Error('Database error'));

      const plan = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Question',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      await expect(
        agiBrainPlannerService.agiBrainPlannerService.executePlan(plan.planId, 'tenant-123')
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Plan Retrieval
  // ==========================================================================

  describe('getPlan', () => {
    it('should retrieve plan with display format', async () => {
      const mockPlan = {
        plan_id: 'plan-123',
        tenant_id: 'tenant-123',
        user_id: 'user-456',
        prompt: 'Test prompt',
        mode: 'thinking',
        steps: JSON.stringify([]),
        selected_model: 'claude-3-5-sonnet',
        domain_detection: JSON.stringify(mockDomainDetection),
        status: 'pending',
      };

      executeStatement.mockResolvedValueOnce({ rows: [mockPlan], rowCount: 1 });

      const result = await agiBrainPlannerService.agiBrainPlannerService.getPlan(
        'plan-123',
        'tenant-123'
      );

      expect(result).toBeDefined();
      expect(result?.planId).toBe('plan-123');
      expect(result?.mode).toBe('thinking');
    });

    it('should return null for non-existent plan', async () => {
      executeStatement.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await agiBrainPlannerService.agiBrainPlannerService.getPlan(
        'non-existent',
        'tenant-123'
      );

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Recent Plans
  // ==========================================================================

  describe('getRecentPlans', () => {
    it('should retrieve recent plans for user', async () => {
      const mockPlans = [
        { plan_id: 'plan-1', prompt: 'Question 1', created_at: new Date() },
        { plan_id: 'plan-2', prompt: 'Question 2', created_at: new Date() },
      ];

      executeStatement.mockResolvedValueOnce({ rows: mockPlans, rowCount: 2 });

      const result = await agiBrainPlannerService.agiBrainPlannerService.getRecentPlans(
        'tenant-123',
        'user-456',
        10
      );

      expect(result).toHaveLength(2);
    });

    it('should respect limit parameter', async () => {
      executeStatement.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await agiBrainPlannerService.agiBrainPlannerService.getRecentPlans(
        'tenant-123',
        'user-456',
        5
      );

      expect(executeStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining('LIMIT'),
        })
      );
    });
  });

  // ==========================================================================
  // Step Updates
  // ==========================================================================

  describe('updateStepStatus', () => {
    it('should update step status', async () => {
      await agiBrainPlannerService.agiBrainPlannerService.updateStepStatus(
        'plan-123',
        'step-1',
        'completed',
        'tenant-123'
      );

      expect(executeStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining('UPDATE'),
        })
      );
    });

    it('should record step completion time', async () => {
      await agiBrainPlannerService.agiBrainPlannerService.updateStepStatus(
        'plan-123',
        'step-1',
        'completed',
        'tenant-123',
        { actualMs: 150 }
      );

      expect(executeStatement).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Plan Templates
  // ==========================================================================

  describe('planTemplates', () => {
    it('should have Quick Answer template', async () => {
      const templates = await agiBrainPlannerService.agiBrainPlannerService.getPlanTemplates('tenant-123');

      expect(templates.some(t => t.name === 'Quick Answer')).toBe(true);
    });

    it('should have Deep Reasoning template', async () => {
      const templates = await agiBrainPlannerService.agiBrainPlannerService.getPlanTemplates('tenant-123');

      expect(templates.some(t => t.name === 'Deep Reasoning')).toBe(true);
    });

    it('should have Code Generation template', async () => {
      const templates = await agiBrainPlannerService.agiBrainPlannerService.getPlanTemplates('tenant-123');

      expect(templates.some(t => t.name === 'Code Generation')).toBe(true);
    });

    it('should have Research Synthesis template', async () => {
      const templates = await agiBrainPlannerService.agiBrainPlannerService.getPlanTemplates('tenant-123');

      expect(templates.some(t => t.name === 'Research Synthesis')).toBe(true);
    });

    it('should have Creative Writing template', async () => {
      const templates = await agiBrainPlannerService.agiBrainPlannerService.getPlanTemplates('tenant-123');

      expect(templates.some(t => t.name === 'Creative Writing')).toBe(true);
    });
  });

  // ==========================================================================
  // Display Format
  // ==========================================================================

  describe('formatPlanForDisplay', () => {
    it('should format plan with mode icon and description', async () => {
      const plan = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Test',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      const display = agiBrainPlannerService.agiBrainPlannerService.formatPlanForDisplay(plan);

      expect(display.modeIcon).toBeDefined();
      expect(display.modeDescription).toBeDefined();
    });

    it('should format steps with status icons', async () => {
      const plan = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Test',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      const display = agiBrainPlannerService.agiBrainPlannerService.formatPlanForDisplay(plan);

      expect(display.steps.every(s => s.statusIcon !== undefined)).toBe(true);
    });
  });
});
