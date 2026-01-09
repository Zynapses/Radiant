/**
 * Economic Governor Service Tests
 * 
 * RADIANT v5.2.0 - Production Hardening
 * 
 * Tests for the Economic Governor service that routes tasks
 * to cost-effective models based on complexity analysis.
 */

import { 
  EconomicGovernor, 
  GovernorMode, 
  SwarmTask, 
  AgentConfig,
  GovernorDecision,
  getGovernor,
  resetGovernor,
} from '../lambda/shared/services/governor/economic-governor';

// Mock fetch for LiteLLM calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock logger
jest.mock('../lambda/shared/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('EconomicGovernor', () => {
  let governor: EconomicGovernor;
  
  // Sample task and agent configurations
  const sampleTask: SwarmTask = {
    id: 'task-123',
    prompt: 'What is the capital of France?',
  };
  
  const complexTask: SwarmTask = {
    id: 'task-456',
    prompt: `Analyze the following code and provide a detailed refactoring plan 
             with performance optimizations, security improvements, and 
             architectural recommendations for scaling to 10 million users.`,
  };
  
  const sampleAgent: AgentConfig = {
    id: 'agent-1',
    name: 'General Assistant',
    role: 'assistant',
    model: 'gpt-4o',
  };

  beforeEach(() => {
    // Reset mocks and governor instance
    jest.clearAllMocks();
    resetGovernor();
    
    // Create fresh governor instance with mock logger
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;
    
    governor = new EconomicGovernor(mockLogger);
  });

  afterEach(() => {
    resetGovernor();
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const config = governor.getConfig();
      
      expect(config.mode).toBe('balanced');
      expect(config.cheapThreshold).toBe(4);
      expect(config.premiumThreshold).toBe(9);
      expect(config.classifierModel).toBe('gpt-4o-mini');
      expect(config.cheapModel).toBe('gpt-4o-mini');
      expect(config.premiumModel).toBe('gpt-4o');
    });

    it('should allow configuration updates', () => {
      governor.setConfig({ mode: 'cost_saver', cheapThreshold: 6 });
      
      const config = governor.getConfig();
      expect(config.mode).toBe('cost_saver');
      expect(config.cheapThreshold).toBe(6);
    });

    it('should preserve unchanged config values on partial update', () => {
      governor.setConfig({ mode: 'performance' });
      
      const config = governor.getConfig();
      expect(config.mode).toBe('performance');
      expect(config.cheapThreshold).toBe(4); // Unchanged
    });
  });

  describe('Model Selection - Performance Mode', () => {
    it('should return original model when mode is off', async () => {
      const decision = await governor.optimizeModelSelection(sampleTask, sampleAgent, 'off');
      
      expect(decision.selectedModel).toBe('gpt-4o');
      expect(decision.originalModel).toBe('gpt-4o');
      expect(decision.mode).toBe('off');
      expect(decision.complexityScore).toBe(-1);
      expect(decision.reason).toContain('disabled');
    });

    it('should return original model when mode is performance', async () => {
      const decision = await governor.optimizeModelSelection(sampleTask, sampleAgent, 'performance');
      
      expect(decision.selectedModel).toBe('gpt-4o');
      expect(decision.mode).toBe('performance');
      expect(decision.reason).toContain('performance mode');
    });
  });

  describe('Model Selection - Balanced Mode', () => {
    beforeEach(() => {
      // Mock successful LiteLLM complexity scoring
      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '2' } }],
        }),
      }));
    });

    it('should downgrade to cheap model for low complexity (score 2)', async () => {
      mockFetch.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '2' } }],
        }),
      }));

      const decision = await governor.optimizeModelSelection(sampleTask, sampleAgent, 'balanced');
      
      expect(decision.complexityScore).toBe(2);
      expect(decision.selectedModel).toBe('gpt-4o-mini');
      expect(decision.originalModel).toBe('gpt-4o');
      expect(decision.reason).toContain('Low complexity');
      expect(decision.savingsAmount).toBeGreaterThan(0);
    });

    it('should keep original model for medium complexity (score 6)', async () => {
      mockFetch.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '6' } }],
        }),
      }));

      const decision = await governor.optimizeModelSelection(sampleTask, sampleAgent, 'balanced');
      
      expect(decision.complexityScore).toBe(6);
      expect(decision.selectedModel).toBe('gpt-4o');
      expect(decision.reason).toContain('within range');
    });

    it('should upgrade to premium model for high complexity (score 9)', async () => {
      mockFetch.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '9' } }],
        }),
      }));

      const decision = await governor.optimizeModelSelection(complexTask, sampleAgent, 'balanced');
      
      expect(decision.complexityScore).toBe(9);
      expect(decision.selectedModel).toBe('gpt-4o');
      expect(decision.reason).toContain('High complexity');
    });
  });

  describe('Model Selection - Cost Saver Mode', () => {
    it('should use higher threshold for downgrade in cost_saver mode', async () => {
      // Score 6 should trigger downgrade in cost_saver (threshold 7)
      mockFetch.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '6' } }],
        }),
      }));

      const decision = await governor.optimizeModelSelection(sampleTask, sampleAgent, 'cost_saver');
      
      expect(decision.complexityScore).toBe(6);
      expect(decision.selectedModel).toBe('gpt-4o-mini');
      expect(decision.mode).toBe('cost_saver');
    });
  });

  describe('Error Handling', () => {
    it('should default to score 5 on API error', async () => {
      mockFetch.mockImplementationOnce(async () => ({
        ok: false,
        status: 500,
      }));

      const decision = await governor.optimizeModelSelection(sampleTask, sampleAgent, 'balanced');
      
      // Score 5 is default, which keeps original model in balanced mode
      expect(decision.complexityScore).toBe(5);
      expect(decision.selectedModel).toBe('gpt-4o');
    });

    it('should default to score 5 on fetch exception', async () => {
      mockFetch.mockImplementationOnce(async () => {
        throw new Error('Network error');
      });

      const decision = await governor.optimizeModelSelection(sampleTask, sampleAgent, 'balanced');
      
      expect(decision.complexityScore).toBe(5);
    });

    it('should handle invalid score response', async () => {
      mockFetch.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'invalid' } }],
        }),
      }));

      const decision = await governor.optimizeModelSelection(sampleTask, sampleAgent, 'balanced');
      
      expect(decision.complexityScore).toBe(5);
    });

    it('should handle score out of range', async () => {
      mockFetch.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '15' } }],
        }),
      }));

      const decision = await governor.optimizeModelSelection(sampleTask, sampleAgent, 'balanced');
      
      expect(decision.complexityScore).toBe(5);
    });
  });

  describe('Cost Estimation', () => {
    it('should calculate cost savings correctly', async () => {
      mockFetch.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '2' } }],
        }),
      }));

      const decision = await governor.optimizeModelSelection(sampleTask, sampleAgent, 'balanced');
      
      expect(decision.estimatedOriginalCost).toBeGreaterThan(0);
      expect(decision.estimatedActualCost).toBeGreaterThan(0);
      expect(decision.estimatedOriginalCost).toBeGreaterThan(decision.estimatedActualCost);
      expect(decision.savingsAmount).toBe(
        decision.estimatedOriginalCost - decision.estimatedActualCost
      );
    });

    it('should report zero savings when no downgrade', async () => {
      mockFetch.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '6' } }],
        }),
      }));

      const decision = await governor.optimizeModelSelection(sampleTask, sampleAgent, 'balanced');
      
      expect(decision.savingsAmount).toBe(0);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple tasks in parallel', async () => {
      mockFetch
        .mockImplementationOnce(async () => ({
          ok: true,
          json: async () => ({ choices: [{ message: { content: '2' } }] }),
        }))
        .mockImplementationOnce(async () => ({
          ok: true,
          json: async () => ({ choices: [{ message: { content: '7' } }] }),
        }))
        .mockImplementationOnce(async () => ({
          ok: true,
          json: async () => ({ choices: [{ message: { content: '9' } }] }),
        }));

      const tasks = [
        { task: { id: '1', prompt: 'Simple question' }, agent: sampleAgent },
        { task: { id: '2', prompt: 'Medium complexity task' }, agent: sampleAgent },
        { task: { id: '3', prompt: 'Complex analysis needed' }, agent: sampleAgent },
      ];

      const decisions = await governor.optimizeBatch(tasks, 'balanced');
      
      expect(decisions).toHaveLength(3);
      expect(decisions[0].selectedModel).toBe('gpt-4o-mini');
      expect(decisions[1].selectedModel).toBe('gpt-4o');
      expect(decisions[2].selectedModel).toBe('gpt-4o');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getGovernor', () => {
      const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any;
      
      const gov1 = getGovernor(mockLogger);
      const gov2 = getGovernor(mockLogger);
      
      expect(gov1).toBe(gov2);
    });

    it('should reset instance with resetGovernor', () => {
      const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any;
      
      const gov1 = getGovernor(mockLogger);
      resetGovernor();
      const gov2 = getGovernor(mockLogger);
      
      expect(gov1).not.toBe(gov2);
    });
  });
});

describe('GovernorDecision Interface', () => {
  it('should have all required fields', () => {
    const decision: GovernorDecision = {
      originalModel: 'gpt-4o',
      selectedModel: 'gpt-4o-mini',
      complexityScore: 3,
      mode: 'balanced',
      reason: 'Low complexity',
      estimatedOriginalCost: 0.02,
      estimatedActualCost: 0.001,
      savingsAmount: 0.019,
    };

    expect(decision.originalModel).toBeDefined();
    expect(decision.selectedModel).toBeDefined();
    expect(decision.complexityScore).toBeDefined();
    expect(decision.mode).toBeDefined();
    expect(decision.reason).toBeDefined();
    expect(decision.estimatedOriginalCost).toBeDefined();
    expect(decision.estimatedActualCost).toBeDefined();
    expect(decision.savingsAmount).toBeDefined();
  });
});
