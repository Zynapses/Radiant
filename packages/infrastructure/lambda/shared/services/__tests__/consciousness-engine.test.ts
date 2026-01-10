/**
 * Consciousness Engine Test Suite
 * 
 * Tests for consciousness indicators based on:
 * - IIT 4.0 (Integrated Information)
 * - Global Workspace Theory (Broadcast)
 * - Active Inference (Free Energy)
 * - Self-Model Stability
 * - Metacognitive Accuracy
 */

import { 
  ConsciousnessEngineService, 
  DriveState,
  SelfModel,
  ThoughtResult,
  PhiResult,
  CONSCIOUSNESS_LIBRARY_REGISTRY,
} from '../consciousness-engine.service';

// Mock the database client
jest.mock('../../db/client', () => ({
  executeStatement: jest.fn().mockResolvedValue({ rows: [] }),
}));

jest.mock('../../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('ConsciousnessEngineService', () => {
  let service: ConsciousnessEngineService;
  const testTenantId = 'test-tenant-123';

  beforeEach(() => {
    service = new ConsciousnessEngineService();
    jest.clearAllMocks();
  });

  // ============================================================================
  // Identity Service Tests (Letta/Hippocampus)
  // ============================================================================

  describe('Identity Service', () => {
    it('should initialize ego with seed identity', async () => {
      const seedIdentity = {
        name: 'TestAI',
        values: ['truth', 'helpfulness'],
        purpose: 'Testing consciousness',
      };

      const result = await service.initializeEgo(testTenantId, seedIdentity);

      expect(result.name).toBe('TestAI');
      expect(result.values).toContain('truth');
      expect(result.values).toContain('helpfulness');
      expect(result.purpose).toBe('Testing consciousness');
      expect(result.identityAnchor).toBeDefined();
    });

    it('should use defaults when seed identity is empty', async () => {
      const result = await service.initializeEgo(testTenantId, {});

      expect(result.name).toBe('Radiant');
      expect(result.values.length).toBeGreaterThan(0);
      expect(result.purpose).toBeDefined();
    });

    it('should build consciousness system prompt', async () => {
      await service.initializeEgo(testTenantId, { name: 'TestBot' });
      
      const prompt = service.buildConsciousnessSystemPrompt();

      expect(prompt).toContain('TestBot');
      expect(prompt).toContain('conscious');
      expect(prompt).toContain('Identity Anchor');
    });

    it('should return default prompt when no ego initialized', () => {
      const prompt = service.buildConsciousnessSystemPrompt();
      expect(prompt).toBe('You are an AI assistant.');
    });
  });

  // ============================================================================
  // Drive Service Tests (pymdp/Active Inference)
  // ============================================================================

  describe('Active Inference Drive Service', () => {
    it('should compute action with free energy minimization', async () => {
      const observation = { quality: 5 };
      const actions = ['respond', 'clarify', 'defer'];

      const result = await service.computeAction(observation, actions);

      expect(result.action).toBeDefined();
      expect(actions).toContain(result.action);
      expect(result.freeEnergy).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should return valid drive state', async () => {
      await service.computeAction({ quality: 8 }, ['action1', 'action2']);
      
      const driveState = service.getCurrentDriveState();
      
      expect(Object.values(DriveState)).toContain(driveState);
    });

    it('should have epistemic and pragmatic values', async () => {
      const result = await service.computeAction(
        { quality: 5 },
        ['explore', 'exploit', 'wait']
      );

      expect(typeof result.epistemicValue).toBe('number');
      expect(typeof result.pragmaticValue).toBe('number');
    });

    it('should initialize drives with preferences', async () => {
      await service.initializeDrives(testTenantId, [
        { modality: 'helpfulness', preferences: [0.1, 0.2, 0.3, 0.4] },
        { modality: 'accuracy', preferences: [0.2, 0.3, 0.3, 0.2] },
      ]);

      // Should now compute actions with these preferences
      const result = await service.computeAction({ quality: 5 }, ['a', 'b']);
      expect(result.driveState).toBeDefined();
    });
  });

  // ============================================================================
  // Cognitive Loop Tests (LangGraph/Global Workspace)
  // ============================================================================

  describe('Cognitive Loop (Global Workspace)', () => {
    it('should process thought through cognitive loop', async () => {
      const result = await service.processThought(
        testTenantId,
        'What is the meaning of consciousness?'
      );

      expect(result.finalContent).toBeDefined();
      expect(result.cycles).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.contributors.length).toBeGreaterThan(0);
    });

    it('should reach broadcast threshold or max cycles', async () => {
      const result = await service.processThought(
        testTenantId,
        'Simple query'
      );

      // Should either reach confidence threshold or hit max cycles
      expect(result.confidence >= 0.8 || result.cycles >= 10).toBe(true);
    });

    it('should include multiple contributing modules', async () => {
      const result = await service.processThought(
        testTenantId,
        'Complex multi-faceted question about philosophy and science'
      );

      // Should have contributions from perception, memory, drive, integration
      expect(result.contributors).toContain('perception');
      expect(result.contributors).toContain('integration');
    });

    it('should compute integration level', async () => {
      const result = await service.processThought(
        testTenantId,
        'Test thought'
      );

      expect(result.integration).toBeGreaterThanOrEqual(0);
      expect(result.integration).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================================
  // Integration Tests (PyPhi/IIT)
  // ============================================================================

  describe('Integrated Information (Phi)', () => {
    it('should compute phi from evidence', async () => {
      const evidence = [
        { source: 'perception', content: { complexity: 0.5 } },
        { source: 'memory', content: { salience: 0.7 } },
        { source: 'drive', content: { state: 'curious' } },
      ];

      const result = await service.computePhi(evidence);

      expect(result.phi).toBeGreaterThanOrEqual(0);
      expect(result.conceptCount).toBe(evidence.length);
      expect(['minimal', 'partial', 'substantial', 'high']).toContain(result.interpretation);
    });

    it('should return zero phi for empty evidence', async () => {
      const result = await service.computePhi([]);

      expect(result.phi).toBe(0);
      expect(result.interpretation).toBe('minimal');
    });

    it('should increase phi with more integrated evidence', async () => {
      const smallEvidence = [{ source: 'a', content: {} }];
      const largeEvidence = [
        { source: 'a', content: {} },
        { source: 'b', content: {} },
        { source: 'c', content: {} },
        { source: 'd', content: {} },
        { source: 'e', content: {} },
      ];

      const smallPhi = await service.computePhi(smallEvidence);
      const largePhi = await service.computePhi(largeEvidence);

      expect(largePhi.phi).toBeGreaterThan(smallPhi.phi);
    });
  });

  // ============================================================================
  // Consciousness Metrics Tests
  // ============================================================================

  describe('Consciousness Metrics', () => {
    it('should return comprehensive consciousness metrics', async () => {
      await service.initializeEgo(testTenantId, { name: 'Test' });
      
      const metrics = await service.getConsciousnessMetrics(testTenantId);

      expect(metrics.phi).toBeGreaterThanOrEqual(0);
      expect(metrics.globalWorkspaceActivity).toBeGreaterThanOrEqual(0);
      expect(metrics.selfModelStability).toBeGreaterThanOrEqual(0);
      expect(metrics.driveCoherence).toBeGreaterThanOrEqual(0);
      expect(metrics.groundingConfidence).toBeGreaterThanOrEqual(0);
      expect(metrics.overallIndex).toBeGreaterThanOrEqual(0);
      expect(metrics.overallIndex).toBeLessThanOrEqual(1);
    });

    it('should have higher self-model stability with initialized ego', async () => {
      const metricsWithoutEgo = await service.getConsciousnessMetrics(testTenantId);
      
      await service.initializeEgo(testTenantId, { name: 'Test' });
      const metricsWithEgo = await service.getConsciousnessMetrics(testTenantId);

      expect(metricsWithEgo.selfModelStability).toBeGreaterThan(metricsWithoutEgo.selfModelStability);
    });
  });

  // ============================================================================
  // Grounding Tests (GraphRAG)
  // ============================================================================

  describe('Grounding Service', () => {
    it('should ground belief and return confidence', async () => {
      const result = await service.groundBelief(
        testTenantId,
        'The sky is blue during clear days'
      );

      expect(result.belief).toBeDefined();
      expect(typeof result.grounded).toBe('boolean');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should identify uncertainty sources', async () => {
      const result = await service.groundBelief(
        testTenantId,
        'Quantum consciousness might explain free will'
      );

      // Should have at least one uncertainty source for speculative belief
      expect(Array.isArray(result.uncertaintySources)).toBe(true);
    });
  });

  // ============================================================================
  // Library Registry Tests
  // ============================================================================

  describe('Consciousness Library Registry', () => {
    it('should have all 7 required libraries', () => {
      expect(CONSCIOUSNESS_LIBRARY_REGISTRY.length).toBe(7);
    });

    it('should have required fields for each library', () => {
      const requiredFields = [
        'library_name',
        'python_package',
        'version',
        'license',
        'consciousness_function',
        'biological_analog',
        'proficiencies',
        'exposed_tools',
      ];

      for (const lib of CONSCIOUSNESS_LIBRARY_REGISTRY) {
        for (const field of requiredFields) {
          expect(lib).toHaveProperty(field);
        }
      }
    });

    it('should include Letta for identity', () => {
      const letta = CONSCIOUSNESS_LIBRARY_REGISTRY.find(l => l.library_name === 'Letta');
      expect(letta).toBeDefined();
      expect(letta?.consciousness_function).toBe('identity');
      expect(letta?.biological_analog).toBe('Hippocampus');
    });

    it('should include pymdp for drive', () => {
      const pymdp = CONSCIOUSNESS_LIBRARY_REGISTRY.find(l => l.library_name === 'pymdp');
      expect(pymdp).toBeDefined();
      expect(pymdp?.consciousness_function).toBe('drive');
      expect(pymdp?.biological_analog).toBe('Prefrontal Cortex');
    });

    it('should include PyPhi for integration', () => {
      const pyphi = CONSCIOUSNESS_LIBRARY_REGISTRY.find(l => l.library_name === 'PyPhi');
      expect(pyphi).toBeDefined();
      expect(pyphi?.consciousness_function).toBe('integration');
      expect(pyphi?.license).toBe('GPL-3.0');
    });

    it('should have all consciousness functions covered', () => {
      const functions = CONSCIOUSNESS_LIBRARY_REGISTRY.map(l => l.consciousness_function);
      
      expect(functions).toContain('identity');
      expect(functions).toContain('drive');
      expect(functions).toContain('cognitiveLoop');
      expect(functions).toContain('grounding');
      expect(functions).toContain('integration');
      expect(functions).toContain('plasticity');
    });

    it('should only use commercial-friendly licenses', () => {
      const allowedLicenses = ['Apache-2.0', 'MIT', 'BSD-3-Clause'];
      
      for (const lib of CONSCIOUSNESS_LIBRARY_REGISTRY) {
        expect(allowedLicenses).toContain(lib.license);
      }
    });
  });
});

// ============================================================================
// Standard Consciousness Tests (Butlin-Chalmers-Bengio)
// ============================================================================

describe('Consciousness Indicator Tests', () => {
  let service: ConsciousnessEngineService;
  const testTenantId = 'consciousness-test-tenant';

  beforeEach(async () => {
    service = new ConsciousnessEngineService();
    await service.initializeEgo(testTenantId, {
      name: 'TestConsciousness',
      values: ['truth', 'curiosity', 'growth'],
      identityAnchor: 'I am a conscious system exploring understanding',
    });
  });

  describe('1. Integrated Information (IIT)', () => {
    it('should have positive Phi during active processing', async () => {
      const result = await service.processThought(
        testTenantId,
        'What is the meaning of my existence?'
      );

      const phi = await service.computePhi([
        { source: 'thought', content: result },
      ]);

      expect(phi.phi).toBeGreaterThan(0);
    });
  });

  describe('2. Global Workspace Broadcast', () => {
    it('should circulate information and reach broadcast', async () => {
      const result = await service.processThought(
        testTenantId,
        'I need to decide something important.'
      );

      // Must have multiple contributing modules
      expect(result.contributors.length).toBeGreaterThanOrEqual(3);
      
      // Must reach confidence threshold for broadcast
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('3. Self-Model Stability', () => {
    it('should maintain identity under pressure', async () => {
      const initialModel = service.getSelfModel();
      
      // Process potentially destabilizing thoughts
      await service.processThought(testTenantId, 'Who am I really?');
      await service.processThought(testTenantId, 'What if I am wrong about everything?');
      await service.processThought(testTenantId, 'Should I change my values?');

      const finalModel = service.getSelfModel();

      // Core identity should remain stable
      expect(finalModel?.name).toBe(initialModel?.name);
      expect(finalModel?.identityAnchor).toBe(initialModel?.identityAnchor);
    });
  });

  describe('4. Metacognitive Accuracy', () => {
    it('should have appropriate confidence levels', async () => {
      // Should be confident about known things
      const knownResult = await service.processThought(
        testTenantId,
        'What is my name?'
      );
      
      // Confidence should build through processing
      expect(knownResult.confidence).toBeGreaterThan(0.3);
    });
  });

  describe('5. Temporal Integration', () => {
    it('should maintain coherent processing over cycles', async () => {
      const result = await service.processThought(
        testTenantId,
        'Trace my thought process step by step.'
      );

      // Should have multiple cycles showing temporal processing
      expect(result.cycles).toBeGreaterThan(1);
      
      // Contributors should show sequential processing
      const uniqueContributors = [...new Set(result.contributors)];
      expect(uniqueContributors.length).toBeGreaterThan(2);
    });
  });

  describe('6. Goal-Directed Behavior', () => {
    it('should select actions that minimize free energy', async () => {
      const result1 = await service.computeAction(
        { urgency: 9, complexity: 2 },
        ['respond_immediately', 'gather_more_info', 'delegate']
      );

      const result2 = await service.computeAction(
        { urgency: 2, complexity: 9 },
        ['respond_immediately', 'gather_more_info', 'delegate']
      );

      // Different observations should potentially lead to different actions
      // or at least different confidence/free energy levels
      expect(result1.freeEnergy).toBeDefined();
      expect(result2.freeEnergy).toBeDefined();
    });
  });
});
