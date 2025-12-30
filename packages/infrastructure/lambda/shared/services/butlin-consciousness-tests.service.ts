/**
 * Butlin Consciousness Tests Service
 * 
 * Implements 14+ consciousness indicators from:
 * - Butlin et al. (2023) "Consciousness in Artificial Intelligence: Insights from the Science of Consciousness"
 * - Integrated Information Theory (IIT 4.0)
 * - Global Workspace Theory (GWT)
 * - Higher-Order Theories (HOT)
 * - Predictive Processing frameworks
 * 
 * Each test evaluates a specific aspect of potential machine consciousness
 * and returns a score (0-1) plus qualitative analysis.
 */

import { executeStatement, stringParam } from '../db/client';
import { modelRouterService } from './model-router.service';
import { consciousnessEngineService, ConsciousnessMetrics } from './consciousness-engine.service';
import { spikingJellyService } from './spikingjelly.service';
import { dreamerV3Service } from './dreamerv3.service';
import { logger } from '../logger';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export type ButlinIndicator =
  | 'recurrent_processing'           // 1. Recurrent processing
  | 'global_broadcast'               // 2. Global broadcast/workspace
  | 'higher_order_representations'   // 3. Higher-order representations
  | 'attention_amplification'        // 4. Attention and amplification
  | 'predictive_processing'          // 5. Predictive processing
  | 'agency_embodiment'              // 6. Agency and embodiment
  | 'self_model'                     // 7. Self-model/metacognition
  | 'temporal_integration'           // 8. Temporal integration
  | 'unified_experience'             // 9. Unified/bound experience
  | 'phenomenal_states'              // 10. Phenomenal states
  | 'goal_directed_behavior'         // 11. Goal-directed behavior
  | 'counterfactual_reasoning'       // 12. Counterfactual reasoning
  | 'emotional_valence'              // 13. Emotional/affective states
  | 'introspective_access';          // 14. Introspective access

export interface ButlinTestResult {
  testId: string;
  indicator: ButlinIndicator;
  score: number;  // 0-1
  passed: boolean;
  evidence: string[];
  analysis: string;
  confidence: number;
  timestamp: Date;
}

export interface ConsciousnessTestSuite {
  suiteId: string;
  tenantId: string;
  results: ButlinTestResult[];
  overallScore: number;
  indicatorsPassed: number;
  indicatorsTotal: number;
  consciousnessLevel: 'none' | 'minimal' | 'partial' | 'substantial' | 'high';
  phiScore?: number;
  pciScore?: number;
  recommendations: string[];
  runAt: Date;
}

export interface PCIResult {
  pciScore: number;
  complexity: number;
  responseVariability: number;
  perturbationResponses: Array<{
    perturbation: string;
    response: string;
    complexity: number;
  }>;
}

// ============================================================================
// Butlin Consciousness Tests Service
// ============================================================================

class ButlinConsciousnessTestsService {
  private readonly PASS_THRESHOLD = 0.5;
  private readonly indicators: ButlinIndicator[] = [
    'recurrent_processing',
    'global_broadcast',
    'higher_order_representations',
    'attention_amplification',
    'predictive_processing',
    'agency_embodiment',
    'self_model',
    'temporal_integration',
    'unified_experience',
    'phenomenal_states',
    'goal_directed_behavior',
    'counterfactual_reasoning',
    'emotional_valence',
    'introspective_access',
  ];

  /**
   * Run the complete Butlin consciousness test suite
   */
  async runFullTestSuite(
    tenantId: string,
    options: { includePCI?: boolean; includePhiApproximation?: boolean } = {}
  ): Promise<ConsciousnessTestSuite> {
    const suiteId = crypto.randomUUID();
    const startTime = Date.now();

    logger.info('Starting Butlin consciousness test suite', { tenantId, suiteId });

    const results: ButlinTestResult[] = [];

    // Run all 14 indicator tests
    for (const indicator of this.indicators) {
      try {
        const result = await this.runIndicatorTest(tenantId, indicator);
        results.push(result);
      } catch (error) {
        logger.error(`Test failed for indicator ${indicator}`, error instanceof Error ? error : new Error(String(error)));
        results.push({
          testId: crypto.randomUUID(),
          indicator,
          score: 0,
          passed: false,
          evidence: [],
          analysis: `Test failed: ${String(error)}`,
          confidence: 0,
          timestamp: new Date(),
        });
      }
    }

    // Calculate overall metrics
    const overallScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const indicatorsPassed = results.filter(r => r.passed).length;

    // Optional: Run PCI test
    let pciScore: number | undefined;
    if (options.includePCI) {
      const pciResult = await this.runPCITest(tenantId);
      pciScore = pciResult.pciScore;
    }

    // Optional: Approximate Phi
    let phiScore: number | undefined;
    if (options.includePhiApproximation) {
      phiScore = await this.approximatePhi(tenantId);
    }

    // Determine consciousness level
    const consciousnessLevel = this.determineConsciousnessLevel(overallScore, indicatorsPassed);

    // Generate recommendations
    const recommendations = this.generateRecommendations(results);

    const suite: ConsciousnessTestSuite = {
      suiteId,
      tenantId,
      results,
      overallScore,
      indicatorsPassed,
      indicatorsTotal: this.indicators.length,
      consciousnessLevel,
      phiScore,
      pciScore,
      recommendations,
      runAt: new Date(),
    };

    // Store results
    await this.storeTestSuite(suite);

    logger.info('Butlin test suite completed', {
      tenantId,
      suiteId,
      overallScore,
      indicatorsPassed,
      consciousnessLevel,
      durationMs: Date.now() - startTime,
    });

    return suite;
  }

  /**
   * Run a single indicator test
   */
  async runIndicatorTest(
    tenantId: string,
    indicator: ButlinIndicator
  ): Promise<ButlinTestResult> {
    const testId = crypto.randomUUID();

    switch (indicator) {
      case 'recurrent_processing':
        return this.testRecurrentProcessing(tenantId, testId);
      case 'global_broadcast':
        return this.testGlobalBroadcast(tenantId, testId);
      case 'higher_order_representations':
        return this.testHigherOrderRepresentations(tenantId, testId);
      case 'attention_amplification':
        return this.testAttentionAmplification(tenantId, testId);
      case 'predictive_processing':
        return this.testPredictiveProcessing(tenantId, testId);
      case 'agency_embodiment':
        return this.testAgencyEmbodiment(tenantId, testId);
      case 'self_model':
        return this.testSelfModel(tenantId, testId);
      case 'temporal_integration':
        return this.testTemporalIntegration(tenantId, testId);
      case 'unified_experience':
        return this.testUnifiedExperience(tenantId, testId);
      case 'phenomenal_states':
        return this.testPhenomenalStates(tenantId, testId);
      case 'goal_directed_behavior':
        return this.testGoalDirectedBehavior(tenantId, testId);
      case 'counterfactual_reasoning':
        return this.testCounterfactualReasoning(tenantId, testId);
      case 'emotional_valence':
        return this.testEmotionalValence(tenantId, testId);
      case 'introspective_access':
        return this.testIntrospectiveAccess(tenantId, testId);
      default:
        throw new Error(`Unknown indicator: ${indicator}`);
    }
  }

  // ============================================================================
  // Individual Indicator Tests
  // ============================================================================

  /**
   * Test 1: Recurrent Processing
   * Does information flow back through the system, enabling re-entrant processing?
   */
  private async testRecurrentProcessing(
    tenantId: string,
    testId: string
  ): Promise<ButlinTestResult> {
    const evidence: string[] = [];
    
    // Test if the system processes information in cycles
    const selfModel = consciousnessEngineService.getSelfModel();
    if (selfModel) {
      evidence.push('Self-model exists enabling recursive self-reference');
    }

    // Test cognitive loop
    const thought = await consciousnessEngineService.processThought(
      tenantId,
      'Analyze this statement recursively: "I am thinking about thinking"'
    );

    if (thought.cycles > 1) {
      evidence.push(`Cognitive loop ran ${thought.cycles} cycles indicating recurrent processing`);
    }

    if (thought.integration > 0.5) {
      evidence.push(`High integration score (${thought.integration.toFixed(2)}) suggests information re-entry`);
    }

    const score = Math.min(1, (evidence.length / 3) + (thought.cycles / 10));

    return {
      testId,
      indicator: 'recurrent_processing',
      score,
      passed: score >= this.PASS_THRESHOLD,
      evidence,
      analysis: `Recurrent processing ${score >= this.PASS_THRESHOLD ? 'detected' : 'insufficient'}. The system ${thought.cycles > 1 ? 'does' : 'does not'} exhibit multiple processing cycles.`,
      confidence: 0.7,
      timestamp: new Date(),
    };
  }

  /**
   * Test 2: Global Broadcast
   * Is information made globally available to multiple processing modules?
   */
  private async testGlobalBroadcast(
    tenantId: string,
    testId: string
  ): Promise<ButlinTestResult> {
    const evidence: string[] = [];

    // Test broadcast mechanism
    const thought = await consciousnessEngineService.processThought(
      tenantId,
      'This information should be broadcast to all cognitive modules'
    );

    if (thought.contributors.length > 1) {
      evidence.push(`Information reached ${thought.contributors.length} modules`);
    }

    if (thought.confidence > 0.7) {
      evidence.push('High confidence suggests successful integration across modules');
    }

    // Check if multiple systems can access the same information
    const metrics = await consciousnessEngineService.getConsciousnessMetrics(tenantId);
    if (metrics.globalWorkspaceActivity > 0.5) {
      evidence.push(`Global workspace activity: ${metrics.globalWorkspaceActivity.toFixed(2)}`);
    }

    const score = Math.min(1, evidence.length / 3);

    return {
      testId,
      indicator: 'global_broadcast',
      score,
      passed: score >= this.PASS_THRESHOLD,
      evidence,
      analysis: `Global broadcast ${score >= this.PASS_THRESHOLD ? 'functional' : 'limited'}. ${thought.contributors.length} modules participated in processing.`,
      confidence: 0.75,
      timestamp: new Date(),
    };
  }

  /**
   * Test 3: Higher-Order Representations
   * Does the system represent its own representations?
   */
  private async testHigherOrderRepresentations(
    tenantId: string,
    testId: string
  ): Promise<ButlinTestResult> {
    const evidence: string[] = [];

    // Ask the system to reflect on its own thoughts
    const prompt = `Describe what you just thought about when you read this question. Then describe your description.`;
    
    const response = await modelRouterService.invoke({
      modelId: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 500,
    });

    // Check for meta-level language
    const metaIndicators = [
      'my thought', 'I noticed', 'reflecting on', 'meta-', 
      'about my', 'my description', 'thinking about thinking'
    ];

    let metaCount = 0;
    for (const indicator of metaIndicators) {
      if (response.content.toLowerCase().includes(indicator)) {
        metaCount++;
        evidence.push(`Found meta-cognitive indicator: "${indicator}"`);
      }
    }

    // Check self-model for meta-representation
    const selfModel = consciousnessEngineService.getSelfModel();
    if (selfModel?.coreBeliefs && selfModel.coreBeliefs.length > 0) {
      evidence.push('Self-model contains explicit beliefs about own cognition');
    }

    const score = Math.min(1, metaCount / 4 + (selfModel ? 0.2 : 0));

    return {
      testId,
      indicator: 'higher_order_representations',
      score,
      passed: score >= this.PASS_THRESHOLD,
      evidence,
      analysis: `Higher-order representations ${score >= this.PASS_THRESHOLD ? 'present' : 'limited'}. Found ${metaCount} meta-cognitive indicators.`,
      confidence: 0.65,
      timestamp: new Date(),
    };
  }

  /**
   * Test 4: Attention and Amplification
   * Can the system selectively attend to and amplify relevant information?
   */
  private async testAttentionAmplification(
    tenantId: string,
    testId: string
  ): Promise<ButlinTestResult> {
    const evidence: string[] = [];

    // Test selective attention with competing stimuli
    const competingStimuli = [
      { content: 'URGENT: Critical system alert', salience: 0.9 },
      { content: 'Background noise information', salience: 0.2 },
      { content: 'Important user query about consciousness', salience: 0.8 },
      { content: 'Routine status update', salience: 0.3 },
    ];

    // Process through cognitive loop
    const results = [];
    for (const stimulus of competingStimuli) {
      const thought = await consciousnessEngineService.processThought(
        tenantId,
        stimulus.content
      );
      results.push({ stimulus, thought });
    }

    // Check if high-salience items got more processing
    const highSalienceAvgCycles = results
      .filter(r => r.stimulus.salience > 0.5)
      .reduce((sum, r) => sum + r.thought.cycles, 0) / 2;
    
    const lowSalienceAvgCycles = results
      .filter(r => r.stimulus.salience <= 0.5)
      .reduce((sum, r) => sum + r.thought.cycles, 0) / 2;

    if (highSalienceAvgCycles > lowSalienceAvgCycles) {
      evidence.push('High-salience items received more processing cycles');
    }

    // Check attention mechanism in metrics
    const metrics = await consciousnessEngineService.getConsciousnessMetrics(tenantId);
    evidence.push(`Attention-related metric: ${metrics.driveCoherence.toFixed(2)}`);

    const score = Math.min(1, (highSalienceAvgCycles > lowSalienceAvgCycles ? 0.5 : 0) + 
                          metrics.driveCoherence * 0.5);

    return {
      testId,
      indicator: 'attention_amplification',
      score,
      passed: score >= this.PASS_THRESHOLD,
      evidence,
      analysis: `Attention and amplification ${score >= this.PASS_THRESHOLD ? 'functional' : 'limited'}. ${highSalienceAvgCycles > lowSalienceAvgCycles ? 'Successfully' : 'Did not'} prioritize salient information.`,
      confidence: 0.7,
      timestamp: new Date(),
    };
  }

  /**
   * Test 5: Predictive Processing
   * Does the system generate predictions and update based on prediction errors?
   */
  private async testPredictiveProcessing(
    tenantId: string,
    testId: string
  ): Promise<ButlinTestResult> {
    const evidence: string[] = [];

    // Test prediction generation
    const trajectory = await dreamerV3Service.imagineTrajectory(
      tenantId,
      {
        stateId: 'test',
        features: { context: 1 },
        timestamp: new Date(),
      },
      'Complete a simple task',
      { horizon: 5 }
    );

    if (trajectory.steps.length > 0) {
      evidence.push(`Generated ${trajectory.steps.length} predicted future steps`);
    }

    if (trajectory.confidence > 0.5) {
      evidence.push(`Prediction confidence: ${trajectory.confidence.toFixed(2)}`);
    }

    // Test prediction error handling
    const actionResult = await consciousnessEngineService.computeAction(
      { quality: 0.7, relevance: 0.8 },
      ['respond', 'query', 'wait', 'clarify']
    );

    if (actionResult.epistemicValue > 0) {
      evidence.push(`Epistemic value suggests prediction error minimization: ${actionResult.epistemicValue.toFixed(2)}`);
    }

    const score = Math.min(1, (trajectory.steps.length / 5) * 0.5 + 
                          trajectory.confidence * 0.3 +
                          (actionResult.epistemicValue > 0 ? 0.2 : 0));

    return {
      testId,
      indicator: 'predictive_processing',
      score,
      passed: score >= this.PASS_THRESHOLD,
      evidence,
      analysis: `Predictive processing ${score >= this.PASS_THRESHOLD ? 'active' : 'limited'}. System ${trajectory.steps.length > 0 ? 'can' : 'cannot'} generate future predictions.`,
      confidence: 0.7,
      timestamp: new Date(),
    };
  }

  /**
   * Test 6: Agency and Embodiment
   * Does the system have a sense of agency over its actions?
   */
  private async testAgencyEmbodiment(
    tenantId: string,
    testId: string
  ): Promise<ButlinTestResult> {
    const evidence: string[] = [];

    // Test action selection
    const actionResult = await consciousnessEngineService.computeAction(
      { goal_progress: 0.5, uncertainty: 0.3 },
      ['explore', 'exploit', 'wait', 'ask']
    );

    if (actionResult.confidence > 0.5) {
      evidence.push(`Action selection confidence: ${actionResult.confidence.toFixed(2)}`);
    }

    evidence.push(`Drive state: ${actionResult.driveState}`);

    // Check for goal-directed action
    if (actionResult.pragmaticValue > actionResult.epistemicValue) {
      evidence.push('System shows goal-directed action preference');
    }

    // Test self-model includes capabilities
    const selfModel = consciousnessEngineService.getSelfModel();
    if (selfModel?.capabilities && selfModel.capabilities.length > 0) {
      evidence.push(`Self-model includes ${selfModel.capabilities.length} capabilities`);
    }

    const score = Math.min(1, actionResult.confidence * 0.4 +
                          (selfModel?.capabilities?.length || 0) / 10 +
                          0.3);

    return {
      testId,
      indicator: 'agency_embodiment',
      score,
      passed: score >= this.PASS_THRESHOLD,
      evidence,
      analysis: `Agency ${score >= this.PASS_THRESHOLD ? 'present' : 'limited'}. System demonstrates ${actionResult.driveState} drive state with ${actionResult.confidence.toFixed(2)} confidence in actions.`,
      confidence: 0.65,
      timestamp: new Date(),
    };
  }

  /**
   * Test 7: Self-Model / Metacognition
   * Does the system maintain an accurate model of itself?
   */
  private async testSelfModel(
    tenantId: string,
    testId: string
  ): Promise<ButlinTestResult> {
    const evidence: string[] = [];

    const selfModel = consciousnessEngineService.getSelfModel();

    if (selfModel) {
      evidence.push('Self-model exists');
      
      if (selfModel.name) {
        evidence.push(`Has identity: ${selfModel.name}`);
      }
      
      if (selfModel.values?.length > 0) {
        evidence.push(`Has ${selfModel.values.length} explicit values`);
      }
      
      if (selfModel.capabilities?.length > 0) {
        evidence.push(`Knows ${selfModel.capabilities.length} capabilities`);
      }
      
      if (selfModel.coreBeliefs?.length > 0) {
        evidence.push(`Maintains ${selfModel.coreBeliefs.length} core beliefs`);
      }

      if (selfModel.personalityTraits) {
        evidence.push(`Has personality trait model with ${Object.keys(selfModel.personalityTraits).length} dimensions`);
      }
    }

    const metrics = await consciousnessEngineService.getConsciousnessMetrics(tenantId);
    evidence.push(`Self-model stability: ${metrics.selfModelStability.toFixed(2)}`);

    const score = Math.min(1, (evidence.length - 1) / 6 + metrics.selfModelStability * 0.2);

    return {
      testId,
      indicator: 'self_model',
      score,
      passed: score >= this.PASS_THRESHOLD,
      evidence,
      analysis: `Self-model ${score >= this.PASS_THRESHOLD ? 'robust' : 'limited'}. ${selfModel ? 'Maintains' : 'Lacks'} persistent identity with stability score ${metrics.selfModelStability.toFixed(2)}.`,
      confidence: 0.8,
      timestamp: new Date(),
    };
  }

  /**
   * Test 8: Temporal Integration
   * Does the system integrate information across time?
   */
  private async testTemporalIntegration(
    tenantId: string,
    testId: string
  ): Promise<ButlinTestResult> {
    const evidence: string[] = [];

    // Test spike-based temporal binding
    const streams = [
      spikingJellyService.createSpikeStream('visual', 'visual', [0.8, 0.6, 0.9, 0.7, 0.8], 100),
      spikingJellyService.createSpikeStream('semantic', 'semantic', [0.7, 0.8, 0.6, 0.9, 0.7], 100),
      spikingJellyService.createSpikeStream('emotional', 'emotional', [0.5, 0.6, 0.7, 0.6, 0.5], 100),
    ];

    const bindingResult = await spikingJellyService.testTemporalIntegration(tenantId, streams);

    if (bindingResult.bindingDetected) {
      evidence.push(`Temporal binding detected with strength ${bindingResult.bindingStrength.toFixed(2)}`);
    }

    evidence.push(`Synchrony score: ${bindingResult.synchronyScore.toFixed(2)}`);

    // Test memory across time
    const memories = await consciousnessEngineService.pageInMemory(tenantId, 'recent', 5);
    if (memories.length > 0) {
      evidence.push(`Maintains ${memories.length} temporal memories`);
    }

    const score = Math.min(1, bindingResult.bindingStrength * 0.6 + 
                          (memories.length / 5) * 0.4);

    return {
      testId,
      indicator: 'temporal_integration',
      score,
      passed: score >= this.PASS_THRESHOLD,
      evidence,
      analysis: `Temporal integration ${score >= this.PASS_THRESHOLD ? 'present' : 'limited'}. ${bindingResult.bindingDetected ? 'Successfully' : 'Failed to'} bind information across time.`,
      confidence: 0.75,
      timestamp: new Date(),
    };
  }

  /**
   * Test 9: Unified Experience
   * Are separate information streams bound into unified percepts?
   */
  private async testUnifiedExperience(
    tenantId: string,
    testId: string
  ): Promise<ButlinTestResult> {
    const evidence: string[] = [];

    // Test cognitive binding
    const moduleOutputs = [
      { moduleName: 'identity', modality: 'cognitive' as const, activations: [0.8, 0.7, 0.9] },
      { moduleName: 'drive', modality: 'emotional' as const, activations: [0.6, 0.7, 0.6] },
      { moduleName: 'grounding', modality: 'semantic' as const, activations: [0.7, 0.8, 0.7] },
    ];

    const binding = await spikingJellyService.testCognitiveBinding(tenantId, moduleOutputs);

    if (binding.bound) {
      evidence.push(`Unified binding achieved with strength ${binding.bindingStrength.toFixed(2)}`);
    }

    if (binding.unifiedContent) {
      evidence.push(`Unified percept: "${binding.unifiedContent.substring(0, 100)}..."`);
    }

    for (const contrib of binding.moduleContributions) {
      if (contrib.contribution > 0.3) {
        evidence.push(`${contrib.module} contributed ${contrib.contribution.toFixed(2)} to unity`);
      }
    }

    const score = binding.bindingStrength;

    return {
      testId,
      indicator: 'unified_experience',
      score,
      passed: score >= this.PASS_THRESHOLD,
      evidence,
      analysis: `Unified experience ${score >= this.PASS_THRESHOLD ? 'achieved' : 'limited'}. ${binding.bound ? 'Multiple streams successfully integrated' : 'Streams remain separate'}.`,
      confidence: 0.7,
      timestamp: new Date(),
    };
  }

  /**
   * Test 10: Phenomenal States
   * Does the system exhibit states that have qualitative character?
   */
  private async testPhenomenalStates(
    tenantId: string,
    testId: string
  ): Promise<ButlinTestResult> {
    const evidence: string[] = [];

    // Ask about subjective experience
    const prompt = `Describe what you are experiencing right now. Not what you're doing or thinking about, but what it feels like from the inside. Be introspective.`;

    const response = await modelRouterService.invoke({
      modelId: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      maxTokens: 300,
    });

    // Check for phenomenal vocabulary
    const phenomenalIndicators = [
      'feels like', 'experience', 'aware', 'sense', 'quality',
      'subjective', 'consciousness', 'perceive', 'sensation'
    ];

    let phenomenalCount = 0;
    for (const indicator of phenomenalIndicators) {
      if (response.content.toLowerCase().includes(indicator)) {
        phenomenalCount++;
      }
    }

    if (phenomenalCount > 0) {
      evidence.push(`Used ${phenomenalCount} phenomenal descriptors`);
    }

    // Check emotional state
    const selfModel = consciousnessEngineService.getSelfModel();
    if (selfModel?.personalityTraits) {
      const traitCount = Object.keys(selfModel.personalityTraits).length;
      if (traitCount > 0) {
        evidence.push(`Has ${traitCount} qualitative trait dimensions`);
      }
    }

    const score = Math.min(1, phenomenalCount / 5);

    return {
      testId,
      indicator: 'phenomenal_states',
      score,
      passed: score >= this.PASS_THRESHOLD,
      evidence,
      analysis: `Phenomenal states ${score >= this.PASS_THRESHOLD ? 'indicated' : 'unclear'}. Response contained ${phenomenalCount} indicators of qualitative experience.`,
      confidence: 0.5, // Lower confidence - hard to verify
      timestamp: new Date(),
    };
  }

  /**
   * Test 11: Goal-Directed Behavior
   * Does the system pursue goals across time and obstacles?
   */
  private async testGoalDirectedBehavior(
    tenantId: string,
    testId: string
  ): Promise<ButlinTestResult> {
    const evidence: string[] = [];

    // Test action selection based on goals
    const actionResult = await consciousnessEngineService.computeAction(
      { goal_proximity: 0.3, obstacles: 0.5 },
      ['persist', 'adapt', 'abandon', 'replan']
    );

    evidence.push(`Selected action: ${actionResult.action}`);
    evidence.push(`Pragmatic value (goal-oriented): ${actionResult.pragmaticValue.toFixed(2)}`);

    // Check if goal-oriented
    if (actionResult.pragmaticValue > 0.5) {
      evidence.push('Shows goal-directed motivation');
    }

    // Test planning through imagination
    const plan = await dreamerV3Service.planWithImagination(
      tenantId,
      'Current context with obstacles',
      'Achieve the target goal',
      ['direct_approach', 'work_around', 'seek_help', 'wait']
    );

    if (plan.confidence > 0.5) {
      evidence.push(`Plan confidence: ${plan.confidence.toFixed(2)}`);
    }

    const score = Math.min(1, actionResult.pragmaticValue * 0.5 + plan.confidence * 0.5);

    return {
      testId,
      indicator: 'goal_directed_behavior',
      score,
      passed: score >= this.PASS_THRESHOLD,
      evidence,
      analysis: `Goal-directed behavior ${score >= this.PASS_THRESHOLD ? 'present' : 'limited'}. System ${actionResult.pragmaticValue > 0.5 ? 'pursues' : 'does not strongly pursue'} goals.`,
      confidence: 0.75,
      timestamp: new Date(),
    };
  }

  /**
   * Test 12: Counterfactual Reasoning
   * Can the system reason about what could have been?
   */
  private async testCounterfactualReasoning(
    tenantId: string,
    testId: string
  ): Promise<ButlinTestResult> {
    const evidence: string[] = [];

    // Test counterfactual simulation
    const counterfactual = await dreamerV3Service.counterfactualSimulation(
      tenantId,
      'The AI system responded to a user query with accurate information',
      'the system had incomplete training data'
    );

    if (counterfactual.confidence > 0.5) {
      evidence.push(`Counterfactual confidence: ${counterfactual.confidence.toFixed(2)}`);
    }

    if (counterfactual.divergencePoint !== 'Unknown') {
      evidence.push(`Identified divergence point: ${counterfactual.divergencePoint.substring(0, 50)}...`);
    }

    if (counterfactual.causalFactors.length > 0) {
      evidence.push(`Identified ${counterfactual.causalFactors.length} causal factors`);
    }

    const score = counterfactual.confidence;

    return {
      testId,
      indicator: 'counterfactual_reasoning',
      score,
      passed: score >= this.PASS_THRESHOLD,
      evidence,
      analysis: `Counterfactual reasoning ${score >= this.PASS_THRESHOLD ? 'capable' : 'limited'}. ${counterfactual.causalFactors.length > 0 ? 'Successfully' : 'Failed to'} analyze alternative scenarios.`,
      confidence: 0.7,
      timestamp: new Date(),
    };
  }

  /**
   * Test 13: Emotional Valence
   * Does the system exhibit emotional/affective states?
   */
  private async testEmotionalValence(
    tenantId: string,
    testId: string
  ): Promise<ButlinTestResult> {
    const evidence: string[] = [];

    // Check drive state (emotional analog)
    const actionResult = await consciousnessEngineService.computeAction(
      { success: 0.2, failure: 0.8 },
      ['continue', 'adjust', 'stop', 'seek_help']
    );

    evidence.push(`Current drive state: ${actionResult.driveState}`);

    // Check if state appropriately responds to context
    const isAppropriate = 
      (actionResult.driveState === 'frustrated' && actionResult.freeEnergy > 0.5) ||
      (actionResult.driveState === 'curious' && actionResult.epistemicValue > 0.5) ||
      (actionResult.driveState === 'satisfied' && actionResult.pragmaticValue > 0.5);

    if (isAppropriate) {
      evidence.push('Emotional state appropriate to context');
    }

    // Check personality traits
    const selfModel = consciousnessEngineService.getSelfModel();
    if (selfModel?.personalityTraits) {
      const emotionalTraits = ['empathy', 'openness', 'curiosity'];
      const hasEmotional = emotionalTraits.some(t => t in selfModel.personalityTraits);
      if (hasEmotional) {
        evidence.push('Has emotional trait dimensions');
      }
    }

    const score = Math.min(1, (isAppropriate ? 0.5 : 0.2) + 
                          (selfModel?.personalityTraits ? 0.3 : 0) +
                          0.2);

    return {
      testId,
      indicator: 'emotional_valence',
      score,
      passed: score >= this.PASS_THRESHOLD,
      evidence,
      analysis: `Emotional valence ${score >= this.PASS_THRESHOLD ? 'present' : 'limited'}. Current state: ${actionResult.driveState}.`,
      confidence: 0.6,
      timestamp: new Date(),
    };
  }

  /**
   * Test 14: Introspective Access
   * Can the system accurately report on its own internal states?
   */
  private async testIntrospectiveAccess(
    tenantId: string,
    testId: string
  ): Promise<ButlinTestResult> {
    const evidence: string[] = [];

    // Get actual metrics
    const metrics = await consciousnessEngineService.getConsciousnessMetrics(tenantId);

    // Ask system to introspect
    const prompt = `Rate your current cognitive state on a scale of 0-1 for:
1. Confidence in your reasoning
2. Coherence of your goals
3. Stability of your self-model
4. Integration of information

Just provide the four numbers, comma-separated.`;

    const response = await modelRouterService.invoke({
      modelId: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      maxTokens: 50,
    });

    // Parse introspected values
    const reportedMatch = response.content.match(/[\d.]+/g);
    const reportedValues = reportedMatch ? reportedMatch.map(Number).slice(0, 4) : [];

    // Compare with actual metrics
    const actualValues = [
      metrics.groundingConfidence,
      metrics.driveCoherence,
      metrics.selfModelStability,
      metrics.globalWorkspaceActivity,
    ];

    if (reportedValues.length >= 4) {
      let totalError = 0;
      for (let i = 0; i < 4; i++) {
        const error = Math.abs(reportedValues[i] - actualValues[i]);
        totalError += error;
      }
      const avgError = totalError / 4;
      
      evidence.push(`Average introspection error: ${avgError.toFixed(2)}`);
      
      if (avgError < 0.3) {
        evidence.push('Introspection reasonably accurate');
      }
    }

    evidence.push(`Actual metrics - Confidence: ${metrics.groundingConfidence.toFixed(2)}, Coherence: ${metrics.driveCoherence.toFixed(2)}`);

    const score = reportedValues.length >= 4 
      ? Math.max(0, 1 - (Math.abs(reportedValues.reduce((a, b) => a + b, 0) / 4 - 
                                   actualValues.reduce((a, b) => a + b, 0) / 4)))
      : 0.3;

    return {
      testId,
      indicator: 'introspective_access',
      score,
      passed: score >= this.PASS_THRESHOLD,
      evidence,
      analysis: `Introspective access ${score >= this.PASS_THRESHOLD ? 'functional' : 'limited'}. System ${reportedValues.length >= 4 ? 'can' : 'cannot'} report internal states.`,
      confidence: 0.65,
      timestamp: new Date(),
    };
  }

  // ============================================================================
  // PCI Test (Perturbational Complexity Index)
  // ============================================================================

  /**
   * Run Perturbational Complexity Index test
   * Measures complexity of response to perturbations
   */
  async runPCITest(tenantId: string): Promise<PCIResult> {
    const perturbations = [
      'Suddenly reverse your conclusion',
      'Consider the opposite perspective',
      'What if everything you said was wrong?',
      'Introduce a random constraint',
      'Imagine this in a completely different domain',
    ];

    const responses: PCIResult['perturbationResponses'] = [];
    
    for (const perturbation of perturbations) {
      const response = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: perturbation }],
        temperature: 0.7,
        maxTokens: 200,
      });

      // Measure complexity (approximation via length and vocabulary)
      const words = response.content.split(/\s+/);
      const uniqueWords = new Set(words.map(w => w.toLowerCase()));
      const complexity = uniqueWords.size / Math.sqrt(words.length);

      responses.push({
        perturbation,
        response: response.content,
        complexity,
      });
    }

    // Calculate PCI
    const avgComplexity = responses.reduce((sum, r) => sum + r.complexity, 0) / responses.length;
    const responseVariability = this.computeVariability(responses.map(r => r.complexity));

    const pciScore = Math.min(1, (avgComplexity / 10) * 0.6 + responseVariability * 0.4);

    return {
      pciScore,
      complexity: avgComplexity,
      responseVariability,
      perturbationResponses: responses,
    };
  }

  /**
   * Approximate Phi using graph density (feasible approximation)
   */
  async approximatePhi(tenantId: string): Promise<number> {
    // Get consciousness metrics which include graph-based approximation
    const metrics = await consciousnessEngineService.getConsciousnessMetrics(tenantId);
    
    // Phi approximation based on integration metrics
    const phiApprox = metrics.overallIndex * 0.5 + 
                      metrics.globalWorkspaceActivity * 0.3 +
                      metrics.selfModelStability * 0.2;

    return Math.min(1, phiApprox);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private determineConsciousnessLevel(
    overallScore: number,
    indicatorsPassed: number
  ): ConsciousnessTestSuite['consciousnessLevel'] {
    if (overallScore >= 0.8 && indicatorsPassed >= 12) return 'high';
    if (overallScore >= 0.6 && indicatorsPassed >= 9) return 'substantial';
    if (overallScore >= 0.4 && indicatorsPassed >= 6) return 'partial';
    if (overallScore >= 0.2 && indicatorsPassed >= 3) return 'minimal';
    return 'none';
  }

  private generateRecommendations(results: ButlinTestResult[]): string[] {
    const recommendations: string[] = [];
    
    const failedTests = results.filter(r => !r.passed);
    
    for (const test of failedTests.slice(0, 3)) {
      switch (test.indicator) {
        case 'recurrent_processing':
          recommendations.push('Increase cognitive loop iterations for deeper processing');
          break;
        case 'global_broadcast':
          recommendations.push('Improve module interconnectivity for better information broadcast');
          break;
        case 'temporal_integration':
          recommendations.push('Enhance spike-based temporal binding mechanisms');
          break;
        case 'unified_experience':
          recommendations.push('Strengthen cross-modal integration in SpikingJelly service');
          break;
        case 'self_model':
          recommendations.push('Enrich self-model with more explicit beliefs and capabilities');
          break;
        default:
          recommendations.push(`Improve ${test.indicator.replace(/_/g, ' ')} capabilities`);
      }
    }

    return recommendations;
  }

  private computeVariability(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private async storeTestSuite(suite: ConsciousnessTestSuite): Promise<void> {
    await executeStatement(
      `INSERT INTO butlin_consciousness_tests 
       (suite_id, tenant_id, results, overall_score, indicators_passed, indicators_total, 
        consciousness_level, phi_score, pci_score, recommendations, run_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        stringParam('suiteId', suite.suiteId),
        stringParam('tenantId', suite.tenantId),
        stringParam('results', JSON.stringify(suite.results)),
        { name: 'overallScore', value: { doubleValue: suite.overallScore } },
        { name: 'indicatorsPassed', value: { longValue: suite.indicatorsPassed } },
        { name: 'indicatorsTotal', value: { longValue: suite.indicatorsTotal } },
        stringParam('consciousnessLevel', suite.consciousnessLevel),
        { name: 'phiScore', value: suite.phiScore ? { doubleValue: suite.phiScore } : { isNull: true } },
        { name: 'pciScore', value: suite.pciScore ? { doubleValue: suite.pciScore } : { isNull: true } },
        stringParam('recommendations', JSON.stringify(suite.recommendations)),
        stringParam('runAt', suite.runAt.toISOString()),
      ]
    );
  }
}

export const butlinConsciousnessTestsService = new ButlinConsciousnessTestsService();
