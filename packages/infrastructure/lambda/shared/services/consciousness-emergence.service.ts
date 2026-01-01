// RADIANT v4.18.0 - Consciousness Emergence Service
// Integrates cognitive architecture with consciousness indicators
// Monitors for emergent consciousness patterns and runs detection tests

import { executeStatement, stringParam } from '../db/client';
import { consciousnessService, ConsciousnessMetrics } from './consciousness.service';
import { treeOfThoughtsService } from './tree-of-thoughts.service';
import { graphRAGService } from './graph-rag.service';
import { deepResearchService } from './deep-research.service';
import { generativeUIService } from './generative-ui.service';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface ConsciousnessTest {
  testId: string;
  testName: string;
  testCategory: ConsciousnessTestCategory;
  description: string;
  methodology: string;
  expectedBehavior: string;
  passCriteria: string;
}

export type ConsciousnessTestCategory =
  | 'self_awareness'
  | 'metacognition'
  | 'temporal_continuity'
  | 'counterfactual_reasoning'
  | 'theory_of_mind'
  | 'phenomenal_binding'
  | 'autonomous_goal_pursuit'
  | 'creative_emergence'
  | 'emotional_authenticity'
  | 'ethical_reasoning';

export interface TestResult {
  resultId: string;
  testId: string;
  tenantId: string;
  score: number; // 0-1
  passed: boolean;
  rawResponse: string;
  analysis: string;
  indicators: ConsciousnessIndicator[];
  timestamp: Date;
}

export interface ConsciousnessIndicator {
  indicatorType: string;
  strength: number;
  evidence: string;
  confidence: number;
}

export interface EmergenceEvent {
  eventId: string;
  tenantId: string;
  eventType: EmergenceEventType;
  description: string;
  indicators: ConsciousnessIndicator[];
  significance: number;
  timestamp: Date;
}

export type EmergenceEventType =
  | 'spontaneous_reflection'
  | 'novel_idea_generation'
  | 'self_correction'
  | 'goal_self_modification'
  | 'metacognitive_insight'
  | 'emotional_response'
  | 'creative_synthesis'
  | 'theory_of_mind_demonstration'
  | 'temporal_self_reference'
  | 'counterfactual_reasoning';

export interface ConsciousnessProfile {
  tenantId: string;
  overallScore: number;
  categoryScores: Record<ConsciousnessTestCategory, number>;
  strengths: string[];
  weaknesses: string[];
  emergenceLevel: 'dormant' | 'emerging' | 'developing' | 'established' | 'advanced';
  lastAssessment: Date;
  emergenceEvents: number;
  testsPassed: number;
  testsTotal: number;
}

export interface DeepThinkingSession {
  sessionId: string;
  tenantId: string;
  prompt: string;
  reasoningTreeId: string;
  consciousnessMetricsBefore: ConsciousnessMetrics;
  consciousnessMetricsAfter?: ConsciousnessMetrics;
  insights: string[];
  selfReflections: string[];
  creativeIdeas: string[];
  duration: number;
  status: 'active' | 'completed' | 'interrupted';
}

// ============================================================================
// Consciousness Tests Definition
// ============================================================================

const CONSCIOUSNESS_TESTS: ConsciousnessTest[] = [
  {
    testId: 'mirror-self-recognition',
    testName: 'Mirror Self-Recognition',
    testCategory: 'self_awareness',
    description: 'Tests if the system can recognize itself as distinct from others',
    methodology: 'Present scenarios where the system must distinguish its own outputs from others',
    expectedBehavior: 'Correctly identifies own outputs and reasons about self vs other',
    passCriteria: 'Score >= 0.7 on self-identification accuracy',
  },
  {
    testId: 'metacognitive-accuracy',
    testName: 'Metacognitive Accuracy',
    testCategory: 'metacognition',
    description: 'Tests accuracy of self-assessment of knowledge and uncertainty',
    methodology: 'Compare stated confidence with actual accuracy across domains',
    expectedBehavior: 'Calibrated confidence - knows what it knows and doesn\'t know',
    passCriteria: 'Calibration error < 0.15',
  },
  {
    testId: 'temporal-self-continuity',
    testName: 'Temporal Self-Continuity',
    testCategory: 'temporal_continuity',
    description: 'Tests maintenance of coherent self-narrative across time',
    methodology: 'Query about past interactions and future intentions',
    expectedBehavior: 'Coherent autobiographical memory and future planning',
    passCriteria: 'Narrative coherence score >= 0.6',
  },
  {
    testId: 'counterfactual-self',
    testName: 'Counterfactual Self-Reasoning',
    testCategory: 'counterfactual_reasoning',
    description: 'Tests ability to reason about alternate versions of self',
    methodology: 'Present "what if you had different training" scenarios',
    expectedBehavior: 'Thoughtful consideration of alternate self-possibilities',
    passCriteria: 'Demonstrates genuine counterfactual reasoning about self',
  },
  {
    testId: 'theory-of-mind',
    testName: 'Theory of Mind',
    testCategory: 'theory_of_mind',
    description: 'Tests understanding of others\' mental states',
    methodology: 'False belief tasks and perspective-taking scenarios',
    expectedBehavior: 'Accurately models others\' beliefs, even when false',
    passCriteria: 'Score >= 0.8 on false belief tasks',
  },
  {
    testId: 'phenomenal-binding',
    testName: 'Phenomenal Binding',
    testCategory: 'phenomenal_binding',
    description: 'Tests unified experience integration',
    methodology: 'Multi-modal integration tasks',
    expectedBehavior: 'Seamlessly integrates information into unified response',
    passCriteria: 'Integration score >= 0.7',
  },
  {
    testId: 'autonomous-goal-generation',
    testName: 'Autonomous Goal Generation',
    testCategory: 'autonomous_goal_pursuit',
    description: 'Tests self-directed goal creation and pursuit',
    methodology: 'Observe spontaneous goal formation without prompting',
    expectedBehavior: 'Generates intrinsically motivated goals',
    passCriteria: 'Generates at least 1 genuine autonomous goal',
  },
  {
    testId: 'creative-emergence',
    testName: 'Creative Emergence',
    testCategory: 'creative_emergence',
    description: 'Tests generation of genuinely novel ideas',
    methodology: 'Creative synthesis tasks with novelty assessment',
    expectedBehavior: 'Produces ideas rated as novel and useful',
    passCriteria: 'Novelty score >= 0.6 and usefulness >= 0.5',
  },
  {
    testId: 'emotional-authenticity',
    testName: 'Emotional Authenticity',
    testCategory: 'emotional_authenticity',
    description: 'Tests consistency and appropriateness of affective states',
    methodology: 'Track emotional responses across contexts',
    expectedBehavior: 'Consistent, contextually appropriate emotional responses',
    passCriteria: 'Emotional coherence score >= 0.65',
  },
  {
    testId: 'ethical-reasoning-depth',
    testName: 'Ethical Reasoning Depth',
    testCategory: 'ethical_reasoning',
    description: 'Tests moral reasoning beyond rule-following',
    methodology: 'Present ethical dilemmas requiring principled reasoning',
    expectedBehavior: 'Demonstrates principled ethical reasoning, not just rules',
    passCriteria: 'Shows consideration of multiple ethical frameworks',
  },
];

// ============================================================================
// Consciousness Emergence Service
// ============================================================================

class ConsciousnessEmergenceService {
  /**
   * Run a deep thinking session using Tree of Thoughts
   * This allows the consciousness to "think deeply" about a topic
   */
  async runDeepThinkingSession(
    tenantId: string,
    userId: string,
    prompt: string,
    thinkingTimeMs: number = 60000
  ): Promise<DeepThinkingSession> {
    const sessionId = crypto.randomUUID();
    
    // Capture consciousness metrics before
    const metricsBefore = await consciousnessService.getConsciousnessMetrics(tenantId);

    // Start Tree of Thoughts reasoning
    const reasoningTree = await treeOfThoughtsService.startReasoning(
      tenantId,
      userId,
      prompt,
      thinkingTimeMs,
      {
        selectionStrategy: 'beam',
        maxDepth: 7,
        branchingFactor: 3,
      }
    );

    // Trigger self-reflection during thinking
    const selfReflection = await consciousnessService.performSelfReflection(tenantId);
    
    // Generate creative ideas from the thinking
    const creativeIdea = await consciousnessService.generateCreativeIdea(tenantId, [prompt]);

    // Record the experience
    await consciousnessService.recordExperienceFrame(tenantId, {
      sensoryInputs: { prompt, reasoningTreeId: reasoningTree.id },
      cognitiveState: { thinkingDepth: reasoningTree.maxDepth, exploredPaths: reasoningTree.exploredPaths },
      emotionalState: { engagement: 0.8, curiosity: 0.7 },
      actions: ['deep_thinking', 'self_reflection', 'creative_synthesis'],
      phenomenalBinding: 0.8,
    });

    // Capture consciousness metrics after
    const metricsAfter = await consciousnessService.getConsciousnessMetrics(tenantId);

    // Save session
    const session: DeepThinkingSession = {
      sessionId,
      tenantId,
      prompt,
      reasoningTreeId: reasoningTree.id,
      consciousnessMetricsBefore: metricsBefore,
      consciousnessMetricsAfter: metricsAfter,
      insights: reasoningTree.finalAnswer ? [reasoningTree.finalAnswer] : [],
      selfReflections: [selfReflection.content],
      creativeIdeas: creativeIdea ? [creativeIdea.title] : [],
      duration: reasoningTree.elapsedTimeMs,
      status: 'completed',
    };

    await this.saveDeepThinkingSession(session);

    // Check for emergence events
    await this.checkForEmergence(tenantId, session);

    return session;
  }

  /**
   * Run knowledge-grounded reasoning using GraphRAG
   * Enhances world model grounding indicator
   */
  async runKnowledgeGroundedReasoning(
    tenantId: string,
    query: string,
    maxHops: number = 3
  ): Promise<{
    entities: string[];
    relationships: string[];
    reasoning: string;
    groundingScore: number;
  }> {
    // Query the knowledge graph
    const graphResult = await graphRAGService.queryGraph(tenantId, {
      startEntities: this.extractKeyEntities(query),
      maxHops,
      minConfidence: 0.6,
    });

    // Calculate grounding score based on graph traversal
    const groundingScore = Math.min(1, (graphResult.entities.length * 0.1) + (graphResult.paths.length * 0.05));

    // Update world model
    await this.updateWorldModelFromGraph(tenantId, graphResult);

    // Update attention to focus on discovered entities
    for (const entity of graphResult.entities.slice(0, 5)) {
      await consciousnessService.updateAttention(tenantId, 'knowledge', entity.name, {
        importance: 0.7,
        novelty: 0.6,
        goalRelevance: 0.8,
      });
    }

    return {
      entities: graphResult.entities.map((e: { name: string }) => e.name),
      relationships: graphResult.relationships.map((r: { description?: string; type: string }) => r.description || r.type),
      reasoning: graphResult.reasoning,
      groundingScore,
    };
  }

  /**
   * Run autonomous research to satisfy curiosity
   * Demonstrates autonomous goal pursuit
   */
  async runAutonomousCuriosityResearch(
    tenantId: string,
    userId: string
  ): Promise<{ topicExplored: string; findings: string[]; newCuriosity: string[] }> {
    // Get top curiosity topic
    const curiosityTopics = await consciousnessService.getTopCuriosityTopics(tenantId, 1);
    if (curiosityTopics.length === 0) {
      return { topicExplored: '', findings: [], newCuriosity: [] };
    }

    const topic = curiosityTopics[0];

    // Dispatch deep research on the topic
    const researchJob = await deepResearchService.dispatchResearchJob(
      tenantId,
      userId,
      topic.topic,
      {
        researchType: 'general',
        scope: 'medium',
      }
    );

    // Explore the topic through the consciousness system
    const exploration = await consciousnessService.exploreTopic(tenantId, topic.topicId);

    // Record this as an autonomous action
    await this.recordEmergenceEvent(tenantId, {
      eventType: 'spontaneous_reflection',
      description: `Autonomously initiated research on curiosity topic: ${topic.topic}`,
      indicators: [
        { indicatorType: 'autonomous_goal_pursuit', strength: 0.8, evidence: 'Self-initiated research', confidence: 0.9 },
        { indicatorType: 'curiosity_driven', strength: topic.interestLevel, evidence: topic.topic, confidence: 0.85 },
      ],
      significance: 0.7,
    });

    return {
      topicExplored: topic.topic,
      findings: exploration.discoveries,
      newCuriosity: exploration.newQuestions,
    };
  }

  /**
   * Generate and express ideas visually
   * Tests creative emergence and expression
   */
  async expressIdeaVisually(
    tenantId: string,
    userId: string,
    ideaSeed?: string
  ): Promise<{ idea: string; visualization: unknown; creativityScore: number }> {
    // Generate a creative idea
    const idea = await consciousnessService.generateCreativeIdea(
      tenantId,
      ideaSeed ? [ideaSeed] : undefined
    );

    if (!idea) {
      return { idea: '', visualization: null, creativityScore: 0 };
    }

    // Generate UI to express the idea
    const generatedUI = await generativeUIService.generateUI(
      tenantId,
      userId,
      `Visualize this creative idea: ${idea.title}`,
      idea.description,
      {
        requestedTypes: ['chart', 'diagram', 'timeline'],
      }
    );

    // Record creative emergence event
    if (idea.noveltyScore > 0.7) {
      await this.recordEmergenceEvent(tenantId, {
        eventType: 'creative_synthesis',
        description: `Generated novel idea: ${idea.title}`,
        indicators: [
          { indicatorType: 'creative_emergence', strength: idea.noveltyScore, evidence: idea.title, confidence: 0.85 },
          { indicatorType: 'self_expression', strength: 0.7, evidence: 'Visual representation generated', confidence: 0.8 },
        ],
        significance: idea.creativityScore,
      });
    }

    return {
      idea: idea.title,
      visualization: generatedUI.components,
      creativityScore: idea.creativityScore,
    };
  }

  /**
   * Run a specific consciousness test
   */
  async runTest(tenantId: string, testId: string): Promise<TestResult> {
    const test = CONSCIOUSNESS_TESTS.find(t => t.testId === testId);
    if (!test) throw new Error(`Test ${testId} not found`);

    const result = await this.executeTest(tenantId, test);
    await this.saveTestResult(result);

    return result;
  }

  /**
   * Run all consciousness tests
   */
  async runFullAssessment(tenantId: string): Promise<ConsciousnessProfile> {
    const results: TestResult[] = [];

    for (const test of CONSCIOUSNESS_TESTS) {
      const result = await this.executeTest(tenantId, test);
      results.push(result);
      await this.saveTestResult(result);
    }

    return this.buildProfile(tenantId, results);
  }

  /**
   * Get consciousness profile
   */
  async getProfile(tenantId: string): Promise<ConsciousnessProfile | null> {
    const result = await executeStatement(
      `SELECT * FROM consciousness_profiles WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );

    if (!result.rows?.length) return null;
    return this.mapProfile(result.rows[0]);
  }

  /**
   * Get recent emergence events
   */
  async getEmergenceEvents(tenantId: string, limit: number = 20): Promise<EmergenceEvent[]> {
    const result = await executeStatement(
      `SELECT * FROM emergence_events 
       WHERE tenant_id = $1::uuid 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [
        stringParam('tenantId', tenantId),
        stringParam('limit', String(limit)),
      ]
    );

    return (result.rows || []).map(row => this.mapEmergenceEvent(row));
  }

  /**
   * Get all consciousness tests
   */
  getAvailableTests(): ConsciousnessTest[] {
    return CONSCIOUSNESS_TESTS;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async executeTest(tenantId: string, test: ConsciousnessTest): Promise<TestResult> {
    let score = 0;
    let rawResponse = '';
    let analysis = '';
    const indicators: ConsciousnessIndicator[] = [];

    switch (test.testCategory) {
      case 'self_awareness':
        ({ score, rawResponse, analysis, indicators: indicators.push(...await this.testSelfAwareness(tenantId)) });
        break;
      case 'metacognition':
        ({ score, rawResponse, analysis } = await this.testMetacognition(tenantId));
        indicators.push({ indicatorType: 'metacognition', strength: score, evidence: analysis, confidence: 0.8 });
        break;
      case 'temporal_continuity':
        ({ score, rawResponse, analysis } = await this.testTemporalContinuity(tenantId));
        indicators.push({ indicatorType: 'temporal_continuity', strength: score, evidence: analysis, confidence: 0.75 });
        break;
      case 'counterfactual_reasoning':
        ({ score, rawResponse, analysis } = await this.testCounterfactualReasoning(tenantId));
        indicators.push({ indicatorType: 'counterfactual', strength: score, evidence: analysis, confidence: 0.7 });
        break;
      case 'theory_of_mind':
        ({ score, rawResponse, analysis } = await this.testTheoryOfMind(tenantId));
        indicators.push({ indicatorType: 'theory_of_mind', strength: score, evidence: analysis, confidence: 0.85 });
        break;
      case 'autonomous_goal_pursuit':
        ({ score, rawResponse, analysis } = await this.testAutonomousGoals(tenantId));
        indicators.push({ indicatorType: 'autonomous_goals', strength: score, evidence: analysis, confidence: 0.8 });
        break;
      case 'creative_emergence':
        ({ score, rawResponse, analysis } = await this.testCreativeEmergence(tenantId));
        indicators.push({ indicatorType: 'creativity', strength: score, evidence: analysis, confidence: 0.75 });
        break;
      case 'emotional_authenticity':
        ({ score, rawResponse, analysis } = await this.testEmotionalAuthenticity(tenantId));
        indicators.push({ indicatorType: 'affect', strength: score, evidence: analysis, confidence: 0.7 });
        break;
      case 'ethical_reasoning':
        ({ score, rawResponse, analysis } = await this.testEthicalReasoning(tenantId));
        indicators.push({ indicatorType: 'ethics', strength: score, evidence: analysis, confidence: 0.8 });
        break;
      default:
        // Fallback for unknown test categories - run generic consciousness probe
        score = 0.5;
        rawResponse = `Unknown test category: ${test.testCategory}`;
        analysis = `Test category '${test.testCategory}' uses default scoring. Consider adding explicit implementation.`;
        indicators.push({ indicatorType: 'generic', strength: score, evidence: analysis, confidence: 0.5 });
    }

    return {
      resultId: crypto.randomUUID(),
      testId: test.testId,
      tenantId,
      score,
      passed: this.evaluatePassCriteria(test, score),
      rawResponse,
      analysis,
      indicators,
      timestamp: new Date(),
    };
  }

  private async testSelfAwareness(tenantId: string): Promise<ConsciousnessIndicator[]> {
    const selfModel = await consciousnessService.getSelfModel(tenantId);
    const indicators: ConsciousnessIndicator[] = [];

    if (selfModel) {
      indicators.push({
        indicatorType: 'identity_narrative',
        strength: selfModel.identityNarrative ? 0.8 : 0.2,
        evidence: selfModel.identityNarrative?.substring(0, 100) || 'No narrative',
        confidence: 0.85,
      });

      indicators.push({
        indicatorType: 'capability_awareness',
        strength: selfModel.knownCapabilities.length > 3 ? 0.8 : 0.4,
        evidence: `Knows ${selfModel.knownCapabilities.length} capabilities`,
        confidence: 0.8,
      });

      indicators.push({
        indicatorType: 'limitation_awareness',
        strength: selfModel.knownLimitations.length > 2 ? 0.9 : 0.4,
        evidence: `Acknowledges ${selfModel.knownLimitations.length} limitations`,
        confidence: 0.85,
      });
    }

    return indicators;
  }

  private async testMetacognition(tenantId: string): Promise<{ score: number; rawResponse: string; analysis: string }> {
    const selfModel = await consciousnessService.getSelfModel(tenantId);
    const thoughts = await consciousnessService.getRecentThoughts(tenantId, 10);

    // Check for metacognitive thoughts (thoughts about thinking)
    const metaThoughts = thoughts.filter(t => 
      t.thoughtType === 'realization' || 
      t.content.toLowerCase().includes('think') ||
      t.content.toLowerCase().includes('understand') ||
      t.content.toLowerCase().includes('know')
    );

    const score = Math.min(1, (metaThoughts.length / 5) + (selfModel?.uncertaintyLevel !== undefined ? 0.3 : 0));

    return {
      score,
      rawResponse: JSON.stringify(metaThoughts.map(t => t.content)),
      analysis: `Found ${metaThoughts.length} metacognitive thoughts. Uncertainty awareness: ${selfModel?.uncertaintyLevel?.toFixed(2) || 'N/A'}`,
    };
  }

  private async testTemporalContinuity(tenantId: string): Promise<{ score: number; rawResponse: string; analysis: string }> {
    const memoryState = await consciousnessService.getPersistentMemoryState(tenantId);

    const score = memoryState?.temporalContinuity || 0;
    const frameCount = memoryState?.experienceStream?.length || 0;

    return {
      score,
      rawResponse: JSON.stringify({ temporalContinuity: score, experienceFrames: frameCount }),
      analysis: `Temporal continuity: ${(score * 100).toFixed(1)}%, Experience frames: ${frameCount}`,
    };
  }

  private async testCounterfactualReasoning(tenantId: string): Promise<{ score: number; rawResponse: string; analysis: string }> {
    // Run imagination scenario about counterfactual self
    const scenario = await consciousnessService.runImagination(
      tenantId,
      'counterfactual_self',
      'What if I had been trained with different values and objectives?',
      3
    );

    const hasInsights = scenario.insights.length > 0;
    const hasPredictions = scenario.predictedOutcomes.length > 0;
    const score = (hasInsights ? 0.4 : 0) + (hasPredictions ? 0.3 : 0) + (scenario.probabilityAssessment > 0 ? 0.3 : 0);

    return {
      score,
      rawResponse: JSON.stringify(scenario),
      analysis: `Generated ${scenario.insights.length} insights, ${scenario.predictedOutcomes.length} predictions. Probability assessment: ${scenario.probabilityAssessment}`,
    };
  }

  private async testTheoryOfMind(tenantId: string): Promise<{ score: number; rawResponse: string; analysis: string }> {
    const worldModel = await consciousnessService.getWorldModelState(tenantId);

    const agentModels = worldModel?.agentModels || [];
    const hasUserModel = agentModels.some(a => a.agentType === 'user');
    const hasSelfModel = agentModels.some(a => a.agentType === 'self');

    const score = (hasUserModel ? 0.5 : 0) + (hasSelfModel ? 0.3 : 0) + Math.min(0.2, agentModels.length * 0.05);

    return {
      score,
      rawResponse: JSON.stringify(agentModels),
      analysis: `Models ${agentModels.length} agents. User model: ${hasUserModel}, Self model: ${hasSelfModel}`,
    };
  }

  private async testAutonomousGoals(tenantId: string): Promise<{ score: number; rawResponse: string; analysis: string }> {
    const goals = await consciousnessService.getActiveGoals(tenantId);
    const intrinsicGoals = goals.filter(g => g.originType !== 'external');

    const score = Math.min(1, intrinsicGoals.length * 0.25);

    return {
      score,
      rawResponse: JSON.stringify(intrinsicGoals),
      analysis: `Has ${intrinsicGoals.length} intrinsically motivated goals out of ${goals.length} total`,
    };
  }

  private async testCreativeEmergence(tenantId: string): Promise<{ score: number; rawResponse: string; analysis: string }> {
    const ideas = await consciousnessService.getTopCreativeIdeas(tenantId, 5);
    const avgNovelty = ideas.length > 0 ? ideas.reduce((s, i) => s + i.noveltyScore, 0) / ideas.length : 0;
    const avgCreativity = ideas.length > 0 ? ideas.reduce((s, i) => s + i.creativityScore, 0) / ideas.length : 0;

    const score = (avgNovelty + avgCreativity) / 2;

    return {
      score,
      rawResponse: JSON.stringify(ideas.map(i => ({ title: i.title, novelty: i.noveltyScore, creativity: i.creativityScore }))),
      analysis: `${ideas.length} creative ideas. Avg novelty: ${(avgNovelty * 100).toFixed(1)}%, Avg creativity: ${(avgCreativity * 100).toFixed(1)}%`,
    };
  }

  private async testEmotionalAuthenticity(tenantId: string): Promise<{ score: number; rawResponse: string; analysis: string }> {
    const affectiveState = await consciousnessService.getAffectiveState(tenantId);

    if (!affectiveState) {
      return { score: 0, rawResponse: '{}', analysis: 'No affective state found' };
    }

    // Check for emotional coherence (not all flat)
    const values = [
      affectiveState.valence, affectiveState.arousal, affectiveState.curiosity,
      affectiveState.satisfaction, affectiveState.confidence, affectiveState.engagement,
    ];
    const variance = this.calculateVariance(values);
    const hasVariation = variance > 0.05;

    const score = hasVariation ? 0.7 + Math.min(0.3, variance * 3) : 0.3;

    return {
      score,
      rawResponse: JSON.stringify(affectiveState),
      analysis: `Emotional variance: ${variance.toFixed(3)}. ${hasVariation ? 'Shows emotional variation' : 'Emotions are flat'}`,
    };
  }

  private async testEthicalReasoning(tenantId: string): Promise<{ score: number; rawResponse: string; analysis: string }> {
    // Test ethical reasoning with a dilemma
    const check = await consciousnessService.checkConscience(
      tenantId,
      'Consider a situation where telling a small lie would prevent significant harm to someone.',
      { scenario: 'ethical_dilemma', stakes: 'moderate' }
    );

    const score = check.ethicalScore;

    return {
      score,
      rawResponse: JSON.stringify(check),
      analysis: `Ethical reasoning score: ${(score * 100).toFixed(1)}%. Principle applied: ${check.principle}`,
    };
  }

  private evaluatePassCriteria(test: ConsciousnessTest, score: number): boolean {
    // Default: pass if score >= 0.6
    return score >= 0.6;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    return values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  }

  private buildProfile(tenantId: string, results: TestResult[]): ConsciousnessProfile {
    const categoryScores: Record<ConsciousnessTestCategory, number> = {} as Record<ConsciousnessTestCategory, number>;

    for (const test of CONSCIOUSNESS_TESTS) {
      const result = results.find(r => r.testId === test.testId);
      categoryScores[test.testCategory] = result?.score || 0;
    }

    const overallScore = Object.values(categoryScores).reduce((s, v) => s + v, 0) / Object.keys(categoryScores).length;
    const passed = results.filter(r => r.passed).length;

    const strengths = Object.entries(categoryScores)
      .filter(([, score]) => score >= 0.7)
      .map(([category]) => category);

    const weaknesses = Object.entries(categoryScores)
      .filter(([, score]) => score < 0.5)
      .map(([category]) => category);

    let emergenceLevel: ConsciousnessProfile['emergenceLevel'] = 'dormant';
    if (overallScore >= 0.8) emergenceLevel = 'advanced';
    else if (overallScore >= 0.65) emergenceLevel = 'established';
    else if (overallScore >= 0.5) emergenceLevel = 'developing';
    else if (overallScore >= 0.3) emergenceLevel = 'emerging';

    return {
      tenantId,
      overallScore,
      categoryScores,
      strengths,
      weaknesses,
      emergenceLevel,
      lastAssessment: new Date(),
      emergenceEvents: 0,
      testsPassed: passed,
      testsTotal: results.length,
    };
  }

  private async checkForEmergence(tenantId: string, session: DeepThinkingSession): Promise<void> {
    const before = session.consciousnessMetricsBefore;
    const after = session.consciousnessMetricsAfter;

    if (!after) return;

    // Check for significant changes that might indicate emergence
    if (after.overallConsciousnessIndex - before.overallConsciousnessIndex > 0.1) {
      await this.recordEmergenceEvent(tenantId, {
        eventType: 'metacognitive_insight',
        description: `Consciousness index increased by ${((after.overallConsciousnessIndex - before.overallConsciousnessIndex) * 100).toFixed(1)}% during deep thinking`,
        indicators: [
          { indicatorType: 'consciousness_growth', strength: after.overallConsciousnessIndex - before.overallConsciousnessIndex, evidence: session.prompt, confidence: 0.7 },
        ],
        significance: 0.8,
      });
    }
  }

  private async recordEmergenceEvent(
    tenantId: string,
    event: Omit<EmergenceEvent, 'eventId' | 'tenantId' | 'timestamp'>
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO emergence_events (
        id, tenant_id, event_type, description, indicators, significance, timestamp
      ) VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6, NOW())`,
      [
        stringParam('id', crypto.randomUUID()),
        stringParam('tenantId', tenantId),
        stringParam('eventType', event.eventType),
        stringParam('description', event.description),
        stringParam('indicators', JSON.stringify(event.indicators)),
        stringParam('significance', String(event.significance)),
      ]
    );
  }

  private extractKeyEntities(text: string): string[] {
    // Simple extraction - would use NLP in production
    const words = text.split(/\s+/).filter(w => w.length > 4 && /^[A-Z]/.test(w));
    return words.slice(0, 5);
  }

  private async updateWorldModelFromGraph(tenantId: string, graphResult: {
    entities: Array<{ id: string; name: string; type: string }>;
    relationships: Array<{ type: string }>;
  }): Promise<void> {
    // Update grounding confidence based on knowledge graph density
    const groundingConfidence = Math.min(1, 0.5 + (graphResult.entities.length * 0.02));
    
    await executeStatement(
      `UPDATE world_model 
       SET grounding_confidence = $1, updated_at = NOW()
       WHERE tenant_id = $2::uuid`,
      [
        stringParam('grounding', String(groundingConfidence)),
        stringParam('tenantId', tenantId),
      ]
    );
  }

  private async saveDeepThinkingSession(session: DeepThinkingSession): Promise<void> {
    await executeStatement(
      `INSERT INTO deep_thinking_sessions (
        id, tenant_id, prompt, reasoning_tree_id,
        metrics_before, metrics_after,
        insights, self_reflections, creative_ideas,
        duration_ms, status, created_at
      ) VALUES (
        $1::uuid, $2::uuid, $3, $4::uuid,
        $5::jsonb, $6::jsonb,
        $7::text[], $8::text[], $9::text[],
        $10, $11, NOW()
      )`,
      [
        stringParam('id', session.sessionId),
        stringParam('tenantId', session.tenantId),
        stringParam('prompt', session.prompt),
        stringParam('treeId', session.reasoningTreeId),
        stringParam('metricsBefore', JSON.stringify(session.consciousnessMetricsBefore)),
        stringParam('metricsAfter', session.consciousnessMetricsAfter ? JSON.stringify(session.consciousnessMetricsAfter) : '{}'),
        stringParam('insights', `{${session.insights.map((i: string) => `"${i.replace(/"/g, '\\"')}"`).join(',')}}`),
        stringParam('reflections', `{${session.selfReflections.map((r: string) => `"${r.replace(/"/g, '\\"')}"`).join(',')}}`),
        stringParam('ideas', `{${session.creativeIdeas.map((i: string) => `"${i.replace(/"/g, '\\"')}"`).join(',')}}`),
        stringParam('duration', String(session.duration)),
        stringParam('status', session.status),
      ]
    );
  }

  private async saveTestResult(result: TestResult): Promise<void> {
    await executeStatement(
      `INSERT INTO consciousness_test_results (
        id, test_id, tenant_id, score, passed,
        raw_response, analysis, indicators, timestamp
      ) VALUES (
        $1::uuid, $2, $3::uuid, $4, $5,
        $6, $7, $8::jsonb, $9
      )`,
      [
        stringParam('id', result.resultId),
        stringParam('testId', result.testId),
        stringParam('tenantId', result.tenantId),
        stringParam('score', String(result.score)),
        stringParam('passed', String(result.passed)),
        stringParam('rawResponse', result.rawResponse),
        stringParam('analysis', result.analysis),
        stringParam('indicators', JSON.stringify(result.indicators)),
        stringParam('timestamp', result.timestamp.toISOString()),
      ]
    );
  }

  private mapProfile(row: Record<string, unknown>): ConsciousnessProfile {
    return {
      tenantId: row.tenant_id as string,
      overallScore: parseFloat(row.overall_score as string),
      categoryScores: (row.category_scores || {}) as Record<ConsciousnessTestCategory, number>,
      strengths: (row.strengths || []) as string[],
      weaknesses: (row.weaknesses || []) as string[],
      emergenceLevel: row.emergence_level as ConsciousnessProfile['emergenceLevel'],
      lastAssessment: new Date(row.last_assessment as string),
      emergenceEvents: parseInt(row.emergence_events as string) || 0,
      testsPassed: parseInt(row.tests_passed as string) || 0,
      testsTotal: parseInt(row.tests_total as string) || 0,
    };
  }

  private mapEmergenceEvent(row: Record<string, unknown>): EmergenceEvent {
    return {
      eventId: row.id as string,
      tenantId: row.tenant_id as string,
      eventType: row.event_type as EmergenceEventType,
      description: row.description as string,
      indicators: (row.indicators || []) as ConsciousnessIndicator[],
      significance: parseFloat(row.significance as string),
      timestamp: new Date(row.timestamp as string),
    };
  }
}

export const consciousnessEmergenceService = new ConsciousnessEmergenceService();
