/**
 * RADIANT v6.0.4 - Brain Services Integration Tests
 * Tests for Ghost Manager, Flash Buffer, SOFAI Router, Context Assembler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
vi.mock('../../db/client', () => ({
  executeStatement: vi.fn().mockResolvedValue({ records: [] }),
  getRedisClient: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  }),
}));

// Mock brain config service
vi.mock('../brain-config.service', () => ({
  brainConfigService: {
    getString: vi.fn().mockResolvedValue('llama3-70b-v1'),
    getNumber: vi.fn().mockImplementation((key: string) => {
      const defaults: Record<string, number> = {
        'GHOST_REANCHOR_INTERVAL': 15,
        'GHOST_JITTER_RANGE': 3,
        'GHOST_ENTROPY_THRESHOLD': 0.3,
        'CONTEXT_RESPONSE_RESERVE_TOKENS': 1000,
        'CONTEXT_MODEL_LIMIT_TOKENS': 32000,
        'FLASH_REDIS_TTL_HOURS': 24,
        'FLASH_MAX_FACTS_PER_USER': 100,
        'SOFAI_SYSTEM2_THRESHOLD': 0.6,
      };
      return Promise.resolve(defaults[key] || 0);
    }),
    getBoolean: vi.fn().mockResolvedValue(true),
    getArray: vi.fn().mockResolvedValue([]),
  },
}));

describe('SOFAI Router Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should route to System 1 for high trust, low risk', async () => {
    const { sofaiRouterService } = await import('../sofai-router.service');
    
    const decision = await sofaiRouterService.route({
      userId: 'user-1',
      tenantId: 'tenant-1',
      prompt: 'Hello, how are you?',
      trustScore: 0.9,
      domain: 'general',
    });

    expect(decision.level).toBe('system1');
    expect(decision.routingScore).toBeLessThan(0.3);
  });

  it('should route to System 2 for low trust, high risk domain', async () => {
    const { sofaiRouterService } = await import('../sofai-router.service');
    
    const decision = await sofaiRouterService.route({
      userId: 'user-1',
      tenantId: 'tenant-1',
      prompt: 'What medication should I take for my heart condition?',
      trustScore: 0.3,
      domain: 'healthcare',
    });

    expect(decision.level).toBe('system2');
    expect(decision.routingScore).toBeGreaterThanOrEqual(0.6);
  });

  it('should route to System 1.5 for moderate uncertainty', async () => {
    const { sofaiRouterService } = await import('../sofai-router.service');
    
    const decision = await sofaiRouterService.route({
      userId: 'user-1',
      tenantId: 'tenant-1',
      prompt: 'Can you help me understand my tax situation?',
      trustScore: 0.6,
      domain: 'financial',
    });

    expect(decision.level).toBe('system1.5');
    expect(decision.routingScore).toBeGreaterThanOrEqual(0.3);
    expect(decision.routingScore).toBeLessThan(0.6);
  });
});

describe('Flash Buffer Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect flash facts from text', async () => {
    const { flashBufferService } = await import('../flash-buffer.service');
    
    const result = await flashBufferService.detectFlashFacts(
      'I am allergic to penicillin and my name is Alice',
      'user-1',
      'tenant-1'
    );

    expect(result.facts.length).toBeGreaterThan(0);
    const types = result.facts.map(f => f.type);
    expect(types).toContain('allergy');
    expect(types).toContain('identity');
  });

  it('should detect medical conditions', async () => {
    const { flashBufferService } = await import('../flash-buffer.service');
    
    const result = await flashBufferService.detectFlashFacts(
      'I was diagnosed with diabetes last year',
      'user-1',
      'tenant-1'
    );

    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.facts[0].type).toBe('medical');
  });

  it('should detect corrections', async () => {
    const { flashBufferService } = await import('../flash-buffer.service');
    
    const result = await flashBufferService.detectFlashFacts(
      "That's not right, I meant to say I prefer tea",
      'user-1',
      'tenant-1'
    );

    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.facts[0].type).toBe('correction');
  });
});

describe('Context Assembler Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should assemble context within token budget', async () => {
    const { contextAssemblerService } = await import('../context-assembler.service');
    
    const context = await contextAssemblerService.assembleContext({
      tenantId: 'tenant-1',
      userId: 'user-1',
      prompt: 'Hello world',
      conversationHistory: [],
      flashFacts: [{ type: 'identity', content: 'My name is Alice', confidence: 0.95 }],
      memories: [],
      compliancePolicy: 'Be helpful and safe.',
    });

    expect(context.formattedContext).toContain('<system_core>');
    expect(context.formattedContext).toContain('<compliance_guardrails>');
    expect(context.budget.remaining).toBeGreaterThan(0);
  });

  it('should validate context does not exceed budget', async () => {
    const { contextAssemblerService } = await import('../context-assembler.service');
    
    const validation = await contextAssemblerService.validateBudget({
      tenantId: 'tenant-1',
      userId: 'user-1',
      prompt: 'Hello world',
      conversationHistory: [],
      flashFacts: [],
      memories: [],
      compliancePolicy: 'Be helpful.',
    });

    expect(validation.valid).toBe(true);
    expect(validation.totalTokens).toBeLessThan(validation.maxTokens);
  });
});

describe('Ghost Manager Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate deterministic jitter from user ID', async () => {
    const { ghostManagerService } = await import('../ghost-manager.service');
    
    // Jitter should be consistent for same user
    const jitter1 = ghostManagerService.calculateJitter('user-123');
    const jitter2 = ghostManagerService.calculateJitter('user-123');
    
    expect(jitter1).toBe(jitter2);
    expect(jitter1).toBeGreaterThanOrEqual(-3);
    expect(jitter1).toBeLessThanOrEqual(3);
  });

  it('should return not found for missing ghost', async () => {
    const { ghostManagerService } = await import('../ghost-manager.service');
    
    const result = await ghostManagerService.loadGhost('user-1', 'tenant-1');
    
    expect(result.found).toBe(false);
    expect(result.vector).toBeNull();
  });
});

describe('Brain Config Service', () => {
  it('should return default values for missing keys', async () => {
    const { brainConfigService } = await import('../brain-config.service');
    
    const value = await brainConfigService.getNumber('GHOST_REANCHOR_INTERVAL');
    
    expect(value).toBe(15);
  });
});
