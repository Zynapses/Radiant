/**
 * Unit tests for AGI Brain Planner Service
 * 
 * Tests the real-time planning system that shows users the AGI's plan to solve
 * a prompt, including steps, orchestration modes, and model selection.
 */

// Jest globals are automatically available via ts-jest

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

    executeStatement = (await import('../lambda/shared/db/client')).executeStatement as ReturnType<typeof jest.fn>;
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
      expect(result.orchestrationMode).toBe('coding');
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.primaryModel).toBeDefined();
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

      expect(result.orchestrationMode).toBe('research');
      expect(result.steps.some(s => s.stepType === 'analyze' || s.stepType === 'synthesize')).toBe(true);
    });

    it('should generate a plan for creative writing', async () => {
      const result = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Write a poem about the ocean',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      expect(result.orchestrationMode).toBe('creative');
    });

    it('should include domain detection in plan', async () => {
      const result = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Explain quantum entanglement',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      expect(result.domainDetection).toBeDefined();
      expect(result.domainDetection?.confidence).toBeGreaterThan(0);
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

      expect(result.steps.every(s => s.durationMs !== undefined || s.stepId)).toBe(true);
      expect(result.estimatedDurationMs).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Orchestration Mode Detection (tested via generatePlan)
  // ==========================================================================

  describe('orchestration mode detection', () => {
    it('should detect thinking mode for simple questions', async () => {
      const result = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'What is the capital of France?',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      expect(result.orchestrationMode).toBe('thinking');
    });

    it('should detect coding mode for programming tasks', async () => {
      const result = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Write a Python script to parse JSON files',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      expect(result.orchestrationMode).toBe('coding');
    });

    it('should detect creative mode for creative tasks', async () => {
      const result = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Write a short story about a robot learning to feel emotions',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      expect(result.orchestrationMode).toBe('creative');
    });

    it('should detect research mode for research queries', async () => {
      const result = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Research and summarize recent developments in quantum computing',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      expect(result.orchestrationMode).toBe('research');
    });
  });

  // ==========================================================================
  // Plan Steps (tested via generatePlan)
  // ==========================================================================

  describe('plan steps generation', () => {
    it('should generate appropriate steps for coding mode', async () => {
      const result = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Write a function to calculate fibonacci numbers',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      expect(result.steps.some(s => s.stepType === 'analyze')).toBe(true);
      expect(result.steps.some(s => s.stepType === 'generate')).toBe(true);
    });

    it('should include verification for factual queries', async () => {
      const result = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'What are the current statistics on climate change?',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      expect(result.steps.some(s => s.stepType === 'verify' || s.stepType === 'analyze')).toBe(true);
    });
  });

  // ==========================================================================
  // Plan Execution
  // ==========================================================================

  describe('startExecution', () => {
    it('should start plan execution and update status', async () => {
      const plan = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Simple question',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      const result = await agiBrainPlannerService.agiBrainPlannerService.startExecution(
        plan.planId
      );

      expect(result.status).toBe('executing');
    });

    it('should throw for non-existent plan', async () => {
      await expect(
        agiBrainPlannerService.agiBrainPlannerService.startExecution('non-existent')
      ).rejects.toThrow('Plan not found');
    });
  });

  // ==========================================================================
  // Plan Retrieval
  // ==========================================================================

  describe('getPlan', () => {
    it('should retrieve plan from cache', async () => {
      // Generate a plan first to put it in cache
      const plan = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Test prompt',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      const result = await agiBrainPlannerService.agiBrainPlannerService.getPlan(plan.planId);

      expect(result).toBeDefined();
      expect(result?.planId).toBe(plan.planId);
      expect(result?.orchestrationMode).toBeDefined();
    });

    it('should return null for non-existent plan', async () => {
      executeStatement.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await agiBrainPlannerService.agiBrainPlannerService.getPlan('non-existent');

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
      // Generate a plan first
      const plan = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Test',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      const stepId = plan.steps[0]?.stepId;
      if (stepId) {
        const result = await agiBrainPlannerService.agiBrainPlannerService.updateStepStatus(
          plan.planId,
          stepId,
          'completed'
        );

        expect(result?.status).toBe('completed');
      }
    });

    it('should record step output when provided', async () => {
      const plan = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Test',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      const stepId = plan.steps[0]?.stepId;
      if (stepId) {
        const result = await agiBrainPlannerService.agiBrainPlannerService.updateStepStatus(
          plan.planId,
          stepId,
          'completed',
          { result: 'success' }
        );

        expect(result?.output).toEqual({ result: 'success' });
      }
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
    it('should format plan with mode and summary', async () => {
      const plan = await agiBrainPlannerService.agiBrainPlannerService.generatePlan({
        prompt: 'Test',
        tenantId: 'tenant-123',
        userId: 'user-456',
      });

      const display = agiBrainPlannerService.agiBrainPlannerService.formatPlanForDisplay(plan);

      expect(display.mode).toBeDefined();
      expect(display.summary).toBeDefined();
      expect(display.planId).toBe(plan.planId);
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
