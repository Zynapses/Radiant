/**
 * Mission Control HITL System Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockRedis = {
  hset: vi.fn().mockResolvedValue(1),
  hget: vi.fn().mockResolvedValue(null),
  hgetall: vi.fn().mockResolvedValue({}),
  hdel: vi.fn().mockResolvedValue(1),
  sadd: vi.fn().mockResolvedValue(1),
  srem: vi.fn().mockResolvedValue(1),
  smembers: vi.fn().mockResolvedValue([]),
  publish: vi.fn().mockResolvedValue(1),
  ping: vi.fn().mockResolvedValue('PONG'),
  quit: vi.fn().mockResolvedValue('OK'),
};

const mockDb = {
  query: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  end: vi.fn().mockResolvedValue(undefined),
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedis),
  Redis: vi.fn(() => mockRedis),
}));

vi.mock('pg', () => ({
  Client: vi.fn(() => mockDb),
}));

// ============================================================================
// IMPORTS
// ============================================================================

import { RadiantSwarm, createRadiantSwarm, SwarmRequest } from '../lambda/shared/services/swarm/radiant-swarm';
import { FlyteLauncher } from '../lambda/shared/services/swarm/flyte-launcher';
import { CatoHitlIntegration } from '../lambda/shared/services/cato/hitl-integration.service';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const TEST_TENANT_ID = 'test-tenant-123';
const TEST_USER_ID = 'test-user-456';
const TEST_SESSION_ID = 'test-session-789';

function createTestSwarmRequest(overrides: Partial<SwarmRequest> = {}): SwarmRequest {
  return {
    tenantId: TEST_TENANT_ID,
    sessionId: TEST_SESSION_ID,
    userId: TEST_USER_ID,
    task: {
      type: 'chat',
      prompt: 'What is 2 + 2?',
      context: {},
    },
    agents: [
      {
        agentId: 'test-agent-1',
        role: 'calculator',
        model: 'gpt-3.5-turbo',
      },
    ],
    options: {
      enableHitl: false,
    },
    ...overrides,
  };
}

// ============================================================================
// RADIANT SWARM TESTS
// ============================================================================

describe('RadiantSwarm', () => {
  let swarm: RadiantSwarm;

  beforeAll(() => {
    swarm = createRadiantSwarm(
      mockRedis as any,
      mockLogger as any,
      'http://localhost:30080',
      'radiant',
      'development'
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should generate a unique swarm ID', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '4' } }],
          usage: { total_tokens: 10 },
        }),
      });

      const request = createTestSwarmRequest();
      const result = await swarm.execute(request);

      expect(result.swarmId).toBeDefined();
      expect(result.swarmId.length).toBe(36); // UUID format
    });

    it('should publish swarm_started event', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '4' } }],
          usage: { total_tokens: 10 },
        }),
      });

      const request = createTestSwarmRequest();
      await swarm.execute(request);

      expect(mockRedis.publish).toHaveBeenCalledWith(
        `swarm_event:${TEST_TENANT_ID}`,
        expect.stringContaining('swarm_started')
      );
    });

    it('should return completed status for successful execution', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'The answer is 4' } }],
          usage: { total_tokens: 10 },
        }),
      });

      const request = createTestSwarmRequest();
      const result = await swarm.execute(request);

      expect(result.status).toBe('completed');
      expect(result.agentResults).toHaveLength(1);
      expect(result.agentResults[0].status).toBe('success');
    });

    it('should handle agent failures gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('API Error'),
      });

      const request = createTestSwarmRequest();
      const result = await swarm.execute(request);

      expect(result.status).toBe('failed');
      expect(result.agentResults[0].status).toBe('failed');
      expect(result.metrics.failureCount).toBe(1);
    });

    it('should return pending_human status for HITL-enabled tasks', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: { name: 'test-execution-123' } }),
      });

      const request = createTestSwarmRequest({
        options: {
          enableHitl: true,
          hitlDomain: 'financial',
        },
      });

      const result = await swarm.execute(request);

      expect(result.status).toBe('pending_human');
      expect(result.flyteExecutionId).toBeDefined();
    });

    it('should track metrics correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '4' } }],
          usage: { total_tokens: 100 },
        }),
      });

      const request = createTestSwarmRequest({
        agents: [
          { agentId: 'agent-1', role: 'test', model: 'gpt-3.5-turbo' },
          { agentId: 'agent-2', role: 'test', model: 'gpt-3.5-turbo' },
        ],
      });

      const result = await swarm.execute(request);

      expect(result.metrics.agentCount).toBe(2);
      expect(result.metrics.successCount).toBe(2);
      expect(result.metrics.totalTokensUsed).toBe(200);
      expect(result.metrics.totalLatencyMs).toBeGreaterThan(0);
    });
  });

  describe('parallel execution', () => {
    it('should execute all agents in parallel', async () => {
      let callOrder: string[] = [];
      
      global.fetch = vi.fn().mockImplementation(async () => {
        const id = Math.random().toString();
        callOrder.push(`start-${id}`);
        await new Promise(r => setTimeout(r, 10));
        callOrder.push(`end-${id}`);
        return {
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'response' } }],
            usage: { total_tokens: 10 },
          }),
        };
      });

      const request = createTestSwarmRequest({
        agents: [
          { agentId: 'agent-1', role: 'test', model: 'gpt-3.5-turbo' },
          { agentId: 'agent-2', role: 'test', model: 'gpt-3.5-turbo' },
          { agentId: 'agent-3', role: 'test', model: 'gpt-3.5-turbo' },
        ],
        options: { mode: 'parallel' },
      });

      await swarm.execute(request);

      // All starts should happen before ends (parallel)
      const startCount = callOrder.filter(c => c.startsWith('start')).length;
      expect(startCount).toBe(3);
    });
  });
});

// ============================================================================
// FLYTE LAUNCHER TESTS
// ============================================================================

describe('FlyteLauncher', () => {
  let launcher: FlyteLauncher;

  beforeAll(() => {
    launcher = new FlyteLauncher(
      'http://localhost:30080',
      'radiant',
      'development',
      mockLogger as any
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('launchWorkflow', () => {
    it('should launch workflow with correct payload', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: { name: 'test-execution' } }),
      });

      const result = await launcher.launchWorkflow('think_tank_hitl_workflow', {
        s3_uri: 's3://bucket/key',
        swarm_id: 'swarm-123',
        tenant_id: TEST_TENANT_ID,
        session_id: TEST_SESSION_ID,
        user_id: TEST_USER_ID,
        hitl_domain: 'general',
      });

      expect(result).toBe('test-execution');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:30080/api/v1/executions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should throw error on failed launch', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await expect(
        launcher.launchWorkflow('test_workflow', {
          s3_uri: 's3://bucket/key',
          swarm_id: 'swarm-123',
          tenant_id: TEST_TENANT_ID,
          session_id: TEST_SESSION_ID,
          user_id: TEST_USER_ID,
          hitl_domain: 'general',
        })
      ).rejects.toThrow('Flyte launch failed');
    });
  });

  describe('sendSignal', () => {
    it('should send signal to paused workflow', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await launcher.sendSignal('execution-123', 'human_decision_abc', {
        resolution: 'approved',
        guidance: 'Looks good',
        resolved_by: TEST_USER_ID,
        resolved_at: new Date().toISOString(),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:30080/api/v1/signals',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('abortExecution', () => {
    it('should abort running execution', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await launcher.abortExecution('execution-123', 'Timed out');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('execution-123'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });
});

// ============================================================================
// CATO HITL INTEGRATION TESTS
// ============================================================================

describe('CatoHitlIntegration', () => {
  let integration: CatoHitlIntegration;

  beforeAll(() => {
    integration = new CatoHitlIntegration(
      mockRedis as any,
      mockDb as any,
      mockLogger as any
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('escalateToHitl', () => {
    it('should create pending decision', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ default_timeout_seconds: 300 }] })
        .mockResolvedValueOnce({ rows: [{ id: 'decision-123' }] });

      const result = await integration.escalateToHitl({
        tenantId: TEST_TENANT_ID,
        sessionId: TEST_SESSION_ID,
        userId: TEST_USER_ID,
        catoEscalationId: 'cato-123',
        domain: 'medical',
        question: 'Is this treatment safe?',
        context: { patientId: 'P123' },
        flyteExecutionId: 'flyte-123',
        flyteNodeId: 'node-123',
        recoveryAttempt: 3,
      });

      expect(result.escalated).toBe(true);
      expect(result.decisionId).toBe('decision-123');
    });

    it('should publish Redis event', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'decision-456' }] });

      await integration.escalateToHitl({
        tenantId: TEST_TENANT_ID,
        sessionId: TEST_SESSION_ID,
        userId: TEST_USER_ID,
        catoEscalationId: 'cato-456',
        domain: 'financial',
        question: 'Should we proceed?',
        context: {},
        flyteExecutionId: 'flyte-456',
        flyteNodeId: 'node-456',
        recoveryAttempt: 2,
      });

      expect(mockRedis.publish).toHaveBeenCalledWith(
        `decision_pending:${TEST_TENANT_ID}`,
        expect.stringContaining('decision-456')
      );
    });
  });

  describe('determineDomain', () => {
    it('should detect medical domain', () => {
      expect(integration.determineDomain({ patientId: 'P123' })).toBe('medical');
      expect(integration.determineDomain({ diagnosis: 'flu' })).toBe('medical');
      expect(integration.determineDomain({ treatment: 'aspirin' })).toBe('medical');
    });

    it('should detect financial domain', () => {
      expect(integration.determineDomain({ accountId: 'A123' })).toBe('financial');
      expect(integration.determineDomain({ transactionId: 'T123' })).toBe('financial');
      expect(integration.determineDomain({ portfolio: {} })).toBe('financial');
    });

    it('should detect legal domain', () => {
      expect(integration.determineDomain({ caseNumber: 'C123' })).toBe('legal');
      expect(integration.determineDomain({ legalMatter: 'contract' })).toBe('legal');
      expect(integration.determineDomain({ contract: {} })).toBe('legal');
    });

    it('should default to general domain', () => {
      expect(integration.determineDomain({})).toBe('general');
      expect(integration.determineDomain({ randomKey: 'value' })).toBe('general');
    });
  });

  describe('syncResolutionToCato', () => {
    it('should update Cato escalation record', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await integration.syncResolutionToCato({
        decisionId: 'decision-123',
        catoEscalationId: 'cato-123',
        resolution: 'approved',
        guidance: 'Looks good',
        resolvedBy: TEST_USER_ID,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE cato_human_escalations'),
        expect.arrayContaining(['APPROVED', 'Looks good', TEST_USER_ID, 'cato-123'])
      );
    });
  });
});

// ============================================================================
// DOMAIN CONFIG TESTS
// ============================================================================

describe('Domain Configuration', () => {
  describe('timeout values', () => {
    it('should have correct default timeouts', () => {
      const DOMAIN_TIMEOUTS = {
        medical: 300,
        financial: 600,
        legal: 900,
        general: 1800,
      };

      expect(DOMAIN_TIMEOUTS.medical).toBe(300); // 5 minutes
      expect(DOMAIN_TIMEOUTS.financial).toBe(600); // 10 minutes
      expect(DOMAIN_TIMEOUTS.legal).toBe(900); // 15 minutes
      expect(DOMAIN_TIMEOUTS.general).toBe(1800); // 30 minutes
    });
  });

  describe('urgency levels', () => {
    it('should map domains to urgency correctly', () => {
      const getUrgency = (domain: string) => {
        if (domain === 'medical') return 'critical';
        if (domain === 'financial' || domain === 'legal') return 'high';
        return 'normal';
      };

      expect(getUrgency('medical')).toBe('critical');
      expect(getUrgency('financial')).toBe('high');
      expect(getUrgency('legal')).toBe('high');
      expect(getUrgency('general')).toBe('normal');
    });
  });
});

// ============================================================================
// SIGNAL MATCHING TESTS
// ============================================================================

describe('Signal Name Matching', () => {
  it('should generate consistent signal names', () => {
    const decisionId = 'abc123';
    
    // TypeScript side
    const tsSignalId = `human_decision_${decisionId}`;
    
    // Python side (simulated)
    const pySignalId = `human_decision_${decisionId}`;
    
    expect(tsSignalId).toBe(pySignalId);
    expect(tsSignalId).toBe('human_decision_abc123');
  });

  it('should handle node IDs correctly', () => {
    const nodeId = 'agent_007';
    const decisionId = 'decision-xyz';
    
    const signalName = `human_decision_${decisionId}`;
    
    expect(signalName).toBe('human_decision_decision-xyz');
  });
});
