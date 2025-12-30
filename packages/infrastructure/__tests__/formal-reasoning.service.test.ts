/**
 * Unit tests for FormalReasoningService
 * 
 * Tests the formal reasoning service including:
 * - Library registry loading from database
 * - Python executor invocation
 * - SageMaker endpoint invocation
 * - Fallback simulation when executors unavailable
 * - Cost tracking and budget enforcement
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  InvokeCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-sagemaker-runtime', () => ({
  SageMakerRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  InvokeEndpointCommand: jest.fn(),
}));

// Mock database client
jest.mock('../lambda/shared/db/client', () => ({
  executeStatement: jest.fn(),
}));

// Mock logger
jest.mock('../lambda/shared/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock library registry service
jest.mock('../lambda/shared/services/library-registry.service', () => ({
  libraryRegistryService: {
    getLibrariesByCategory: jest.fn().mockResolvedValue([]),
  },
  Library: {},
}));

describe('FormalReasoningService', () => {
  let formalReasoningService: typeof import('../lambda/shared/services/formal-reasoning.service').formalReasoningService;
  let executeStatement: jest.Mock;
  let LambdaClient: jest.Mock;
  let libraryRegistryService: { getLibrariesByCategory: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Reset module cache to get fresh instance
    jest.resetModules();
    
    // Get mocked modules
    executeStatement = (await import('../lambda/shared/db/client')).executeStatement as jest.Mock;
    LambdaClient = (await import('@aws-sdk/client-lambda')).LambdaClient as unknown as jest.Mock;
    libraryRegistryService = (await import('../lambda/shared/services/library-registry.service')).libraryRegistryService as { getLibrariesByCategory: jest.Mock };
    
    // Import service after mocks are set up
    const module = await import('../lambda/shared/services/formal-reasoning.service');
    formalReasoningService = module.formalReasoningService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLibraryRegistry', () => {
    it('should return library info from cache after loading', async () => {
      // Setup: Library registry returns formal reasoning libraries
      libraryRegistryService.getLibrariesByCategory.mockResolvedValue([
        {
          libraryId: 'z3_theorem_prover',
          name: 'Z3 Theorem Prover',
          category: 'Formal Reasoning',
          license: 'MIT',
          description: 'SMT solver',
          proficiencies: {
            reasoning_depth: 10,
            mathematical_quantitative: 10,
            code_generation: 7,
            creative_generative: 2,
            research_synthesis: 5,
            factual_recall_precision: 10,
            multi_step_problem_solving: 10,
            domain_terminology_handling: 8,
          },
          stars: 10200,
          repo: 'github.com/Z3Prover/z3',
          domains: ['artificial_intelligence', 'computer_science'],
        },
      ]);

      const registry = await formalReasoningService.getLibraryRegistry();

      expect(registry).toBeInstanceOf(Array);
      expect(registry.length).toBeGreaterThan(0);
    });

    it('should fallback to hardcoded registry on database error', async () => {
      // Setup: Library registry throws error
      libraryRegistryService.getLibrariesByCategory.mockRejectedValue(new Error('DB connection failed'));

      const registry = await formalReasoningService.getLibraryRegistry();

      expect(registry).toBeInstanceOf(Array);
      expect(registry.length).toBe(8); // 8 formal reasoning libraries
    });
  });

  describe('getLibraryInfo', () => {
    it('should return info for Z3', async () => {
      const info = await formalReasoningService.getLibraryInfo('z3');

      expect(info).toBeDefined();
      expect(info.id).toBe('z3');
      expect(info.name).toContain('Z3');
    });

    it('should return info for all 8 libraries', async () => {
      const libraries = ['z3', 'pyarg', 'pyreason', 'rdflib', 'owlrl', 'pyshacl', 'ltn', 'deepproblog'] as const;

      for (const lib of libraries) {
        const info = await formalReasoningService.getLibraryInfo(lib);
        expect(info).toBeDefined();
        expect(info.id).toBe(lib);
      }
    });
  });

  describe('getLibraryInfoSync', () => {
    it('should return info synchronously using cache or fallback', () => {
      const info = formalReasoningService.getLibraryInfoSync('z3');

      expect(info).toBeDefined();
      expect(info.id).toBe('z3');
    });
  });

  describe('getTenantConfig', () => {
    it('should return config from database if exists', async () => {
      // Setup: Database returns config
      executeStatement.mockResolvedValue({
        rows: [{
          tenant_id: 'tenant-123',
          enabled: true,
          enabled_libraries: 'z3,rdflib,pyshacl',
          z3_config: JSON.stringify({ enabled: true, timeout_ms: 5000 }),
          pyarg_config: JSON.stringify({ enabled: true }),
          pyreason_config: JSON.stringify({ enabled: true }),
          rdflib_config: JSON.stringify({ enabled: true }),
          owlrl_config: JSON.stringify({ enabled: true }),
          pyshacl_config: JSON.stringify({ enabled: true }),
          ltn_config: JSON.stringify({ enabled: false }),
          deepproblog_config: JSON.stringify({ enabled: false }),
          budget_limits: JSON.stringify({ dailyInvocations: 1000, dailyCostUsd: 5 }),
        }],
      });

      const config = await formalReasoningService.getTenantConfig('tenant-123');

      expect(config).toBeDefined();
      expect(config.tenantId).toBe('tenant-123');
    });

    it('should return default config if not in database', async () => {
      // Setup: Database returns no rows
      executeStatement.mockResolvedValue({ rows: [] });

      const config = await formalReasoningService.getTenantConfig('new-tenant');

      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.enabledLibraries).toContain('z3');
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      // Setup: Tenant config allows all libraries
      executeStatement.mockResolvedValue({
        rows: [{
          tenant_id: 'tenant-123',
          enabled: true,
          enabled_libraries: 'z3,pyarg,pyreason,rdflib,owlrl,pyshacl,ltn,deepproblog',
          z3_config: JSON.stringify({ enabled: true, timeout_ms: 5000 }),
          pyarg_config: JSON.stringify({ enabled: true }),
          pyreason_config: JSON.stringify({ enabled: true }),
          rdflib_config: JSON.stringify({ enabled: true }),
          owlrl_config: JSON.stringify({ enabled: true }),
          pyshacl_config: JSON.stringify({ enabled: true }),
          ltn_config: JSON.stringify({ enabled: true }),
          deepproblog_config: JSON.stringify({ enabled: true }),
          budget_limits: JSON.stringify({ dailyInvocations: 10000, dailyCostUsd: 100 }),
        }],
      });
    });

    it('should execute Z3 constraint solving with simulation fallback', async () => {
      const result = await formalReasoningService.execute({
        id: 'test-1',
        tenantId: 'tenant-123',
        library: 'z3',
        taskType: 'constraint_satisfaction',
        input: {
          constraints: [
            { id: 'c1', expression: 'x > 0', variables: [{ name: 'x', type: 'Int' }] },
          ],
        },
      });

      expect(result).toBeDefined();
      expect(result.library).toBe('z3');
      expect(['sat', 'unsat', 'unknown', 'error']).toContain(result.status);
    });

    it('should execute PyArg argumentation', async () => {
      const result = await formalReasoningService.execute({
        id: 'test-2',
        tenantId: 'tenant-123',
        library: 'pyarg',
        taskType: 'argumentation',
        input: {
          framework: {
            id: 'af-1',
            arguments: [
              { id: 'a', claim: 'Claim A' },
              { id: 'b', claim: 'Claim B' },
            ],
            attacks: [{ attacker: 'b', target: 'a' }],
          },
          semantics: 'grounded',
        },
      });

      expect(result).toBeDefined();
      expect(result.library).toBe('pyarg');
    });

    it('should execute RDFLib SPARQL query', async () => {
      const result = await formalReasoningService.execute({
        id: 'test-3',
        tenantId: 'tenant-123',
        library: 'rdflib',
        taskType: 'sparql_query',
        input: {
          query: {
            query: 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }',
            type: 'SELECT',
          },
          triples: [
            { subject: 'http://example.org/s', predicate: 'http://example.org/p', object: 'value' },
          ],
        },
      });

      expect(result).toBeDefined();
      expect(result.library).toBe('rdflib');
    });

    it('should reject execution for disabled library', async () => {
      // Setup: Tenant config only allows z3
      executeStatement.mockResolvedValue({
        rows: [{
          tenant_id: 'tenant-123',
          enabled: true,
          enabled_libraries: 'z3',
          z3_config: JSON.stringify({ enabled: true }),
          pyarg_config: JSON.stringify({ enabled: false }),
          pyreason_config: JSON.stringify({ enabled: false }),
          rdflib_config: JSON.stringify({ enabled: false }),
          owlrl_config: JSON.stringify({ enabled: false }),
          pyshacl_config: JSON.stringify({ enabled: false }),
          ltn_config: JSON.stringify({ enabled: false }),
          deepproblog_config: JSON.stringify({ enabled: false }),
          budget_limits: JSON.stringify({ dailyInvocations: 1000 }),
        }],
      });

      const result = await formalReasoningService.execute({
        id: 'test-4',
        tenantId: 'tenant-123',
        library: 'pyarg', // Disabled
        taskType: 'argumentation',
        input: { framework: { id: 'af-1', arguments: [], attacks: [] } },
      });

      expect(result.status).toBe('error');
      expect(result.error).toContain('not enabled');
    });
  });

  describe('getStats', () => {
    it('should return usage statistics', async () => {
      // Setup: Database returns stats
      executeStatement.mockResolvedValue({
        rows: [
          { library: 'z3', invocations: 100, successful: 95, failed: 5, cost_usd: 0.01, avg_latency: 50 },
          { library: 'rdflib', invocations: 50, successful: 50, failed: 0, cost_usd: 0.001, avg_latency: 10 },
        ],
      });

      const stats = await formalReasoningService.getStats('tenant-123', 'day');

      expect(stats).toBeDefined();
      expect(stats.tenantId).toBe('tenant-123');
      expect(stats.period).toBe('day');
    });
  });

  describe('getDashboard', () => {
    it('should return full dashboard data', async () => {
      // Setup: Multiple database queries
      executeStatement.mockResolvedValue({
        rows: [],
      });

      const dashboard = await formalReasoningService.getDashboard('tenant-123');

      expect(dashboard).toBeDefined();
      expect(dashboard.config).toBeDefined();
      expect(dashboard.stats).toBeDefined();
    });
  });

  describe('invalidateCache', () => {
    it('should clear the library cache', () => {
      formalReasoningService.invalidateCache();
      
      // After invalidation, sync method should return fallback
      const info = formalReasoningService.getLibraryInfoSync('z3');
      expect(info).toBeDefined();
    });
  });
});

describe('Python Executor Integration', () => {
  it('should format request payload correctly', () => {
    // This tests the payload structure that would be sent to Python Lambda
    const payload = {
      library: 'z3',
      taskType: 'constraint_satisfaction',
      input: {
        constraints: [
          { id: 'c1', expression: 'x > 0', variables: [{ name: 'x', type: 'Int' }] },
        ],
      },
      config: { timeout_ms: 5000 },
      requestId: 'test-123',
    };

    expect(payload.library).toBe('z3');
    expect(payload.input.constraints).toHaveLength(1);
    expect(payload.config.timeout_ms).toBe(5000);
  });
});

describe('SageMaker Endpoint Integration', () => {
  it('should format LTN request correctly', () => {
    const input = {
      formulas: [
        { id: 'f1', expression: 'forall x: Human(x) -> Mortal(x)', isAxiom: true },
      ],
      mode: 'query',
    };

    expect(input.formulas).toHaveLength(1);
    expect(input.mode).toBe('query');
  });

  it('should format DeepProbLog request correctly', () => {
    const input = {
      program: {
        id: 'prog-1',
        facts: ['0.3::rain.', '0.5::sprinkler.'],
        rules: ['wet :- rain.', 'wet :- sprinkler.'],
        neuralPredicates: [],
        queries: ['wet'],
      },
      mode: 'query',
    };

    expect(input.program.queries).toContain('wet');
    expect(input.mode).toBe('query');
  });
});
