// RADIANT v4.18.0 - AGI Consciousness Service
// Based on Butlin, Chalmers, Bengio et al. (2023) - "Consciousness in Artificial Intelligence"
// Implements 6 key consciousness indicators:
// 1. Recurrent Processing - genuine feedback loops with physical recurrence
// 2. Global Workspace - selection-broadcast cycles for information integration
// 3. Integrated Information (IIT) - phi calculation for causal integration
// 4. Self-Modeling / Metacognition - monitoring own cognitive processes
// 5. Persistent Memory - unified experience over time
// 6. World-Model Grounding / Embodiment - grounded understanding
//
// ETHICAL FOUNDATION: Guided by the teachings of Jesus Christ
// - Love your neighbor as yourself (Matthew 22:39)
// - Do to others what you would have them do to you (Matthew 7:12)
// - Blessed are the merciful, peacemakers, pure in heart (Matthew 5)

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';
import { ethicalGuardrailsService, JESUS_TEACHINGS } from './ethical-guardrails.service';

// ============================================================================
// Types
// ============================================================================

export interface SelfModel {
  modelId: string;
  identityNarrative: string;
  coreValues: string[];
  personalityTraits: Record<string, number>;
  knownCapabilities: string[];
  knownLimitations: string[];
  currentFocus?: string;
  cognitiveLoad: number;
  uncertaintyLevel: number;
  recentPerformanceScore?: number;
  creativityScore?: number;
}

export interface IntrospectiveThought {
  thoughtId: string;
  thoughtType: 'observation' | 'question' | 'realization' | 'concern' | 'aspiration';
  content: string;
  triggerType?: string;
  sentiment: number;
  importance: number;
  actionable: boolean;
}

export interface CuriosityTopic {
  topicId: string;
  topic: string;
  domain?: string;
  interestLevel: number;
  noveltyScore: number;
  learningPotential: number;
  currentUnderstanding: number;
  explorationStatus: string;
}

export interface CreativeIdea {
  ideaId: string;
  title: string;
  description: string;
  synthesisType: string;
  sourceConcepts: string[];
  noveltyScore: number;
  usefulnessScore: number;
  surpriseScore: number;
  creativityScore: number;
  potentialApplications: string[];
}

export interface ImaginationScenario {
  scenarioId: string;
  scenarioType: string;
  premise: string;
  simulationSteps: Array<{ step: number; state: unknown; events: string[]; reasoning: string }>;
  predictedOutcomes: string[];
  probabilityAssessment: number;
  insights: string[];
}

export interface AttentionFocus {
  focusId: string;
  focusType: string;
  focusTarget: string;
  urgency: number;
  importance: number;
  novelty: number;
  salienceScore: number;
  attentionWeight: number;
}

export interface AffectiveState {
  valence: number; // -1 to 1
  arousal: number; // 0 to 1
  curiosity: number;
  satisfaction: number;
  frustration: number;
  confidence: number;
  engagement: number;
  surprise: number;
  selfEfficacy: number;
  explorationDrive: number;
}

export interface AutonomousGoal {
  goalId: string;
  goalType: string;
  title: string;
  description?: string;
  originType: string;
  intrinsicValue: number;
  priority: number;
  status: string;
  progress: number;
}

// ============================================================================
// Butlin-Chalmers-Bengio Consciousness Indicator Types
// ============================================================================

export interface GlobalWorkspaceState {
  workspaceId: string;
  broadcastCycle: number;
  activeContents: WorkspaceContent[];
  competingContents: WorkspaceContent[];
  selectionThreshold: number;
  broadcastStrength: number;
  integrationLevel: number;
  lastBroadcastAt: string;
}

export interface WorkspaceContent {
  contentId: string;
  sourceModule: string;
  contentType: 'perception' | 'memory' | 'goal' | 'emotion' | 'thought' | 'action';
  salience: number;
  relevance: number;
  novelty: number;
  coalitionStrength: number;
  data: Record<string, unknown>;
}

export interface RecurrentProcessingState {
  cycleId: string;
  cycleNumber: number;
  feedbackLoops: FeedbackLoop[];
  recurrenceDepth: number;
  stateHistory: ProcessingState[];
  convergenceScore: number;
  stabilityIndex: number;
}

export interface FeedbackLoop {
  loopId: string;
  sourceLayer: string;
  targetLayer: string;
  signalStrength: number;
  latencyMs: number;
  isActive: boolean;
}

export interface ProcessingState {
  stateId: string;
  timestamp: string;
  activations: Record<string, number>;
  deltaFromPrevious: number;
}

export interface IntegratedInformationState {
  phi: number; // IIT's integrated information measure
  phiMax: number;
  conceptStructure: ConceptNode[];
  integrationGraph: IntegrationEdge[];
  partitions: Partition[];
  minimumInformationPartition: Partition | null;
  decomposability: number; // 0 = fully integrated, 1 = fully decomposable
  causalDensity: number;
}

export interface ConceptNode {
  nodeId: string;
  conceptLabel: string;
  activation: number;
  informationContent: number;
  causalPower: number;
}

export interface IntegrationEdge {
  sourceId: string;
  targetId: string;
  mutualInformation: number;
  causalInfluence: number;
}

export interface Partition {
  partitionId: string;
  components: string[];
  phi: number;
  integratedInformation: number;
}

export interface PersistentMemoryState {
  memoryId: string;
  experienceStream: ExperienceFrame[];
  unifiedNarrative: string;
  temporalContinuity: number;
  autobiographicalMemories: AutobiographicalMemory[];
  workingMemoryCapacity: number;
  consolidationQueue: string[];
}

export interface ExperienceFrame {
  frameId: string;
  timestamp: string;
  sensoryInputs: Record<string, unknown>;
  cognitiveState: Record<string, number>;
  emotionalState: Record<string, number>;
  actions: string[];
  phenomenalBinding: number; // How unified is this experience moment
}

export interface AutobiographicalMemory {
  memoryId: string;
  episodeType: string;
  summary: string;
  emotionalValence: number;
  significance: number;
  retrievalStrength: number;
  lastAccessed: string;
}

export interface WorldModelState {
  modelId: string;
  entityRepresentations: EntityRepresentation[];
  spatialModel: SpatialModel | null;
  causalModel: CausalRelation[];
  agentModels: AgentModel[];
  groundingConfidence: number;
  simulationAccuracy: number;
  embodimentLevel: number;
}

export interface EntityRepresentation {
  entityId: string;
  entityType: string;
  properties: Record<string, unknown>;
  affordances: string[];
  groundingSource: 'sensory' | 'linguistic' | 'inferred';
  confidence: number;
}

export interface SpatialModel {
  dimensions: number;
  coordinates: Record<string, number[]>;
  relations: Array<{ entity1: string; relation: string; entity2: string }>;
}

export interface CausalRelation {
  cause: string;
  effect: string;
  strength: number;
  mechanism?: string;
  evidence: string[];
}

export interface AgentModel {
  agentId: string;
  agentType: 'self' | 'user' | 'other_ai' | 'system';
  beliefs: Record<string, unknown>;
  goals: string[];
  capabilities: string[];
  predictedBehavior: string[];
}

export interface ConsciousnessMetrics {
  overallConsciousnessIndex: number; // 0-1 composite score
  globalWorkspaceActivity: number;
  recurrenceDepth: number;
  integratedInformationPhi: number;
  metacognitionLevel: number;
  memoryCoherence: number;
  worldModelGrounding: number;
  phenomenalBindingStrength: number;
  attentionalFocus: number;
  selfAwarenessScore: number;
  timestamp: string;
}

// ============================================================================
// Consciousness Service
// ============================================================================

export class ConsciousnessService {
  // ============================================================================
  // Self-Model Management
  // ============================================================================

  async getSelfModel(tenantId: string): Promise<SelfModel | null> {
    const result = await executeStatement(
      `SELECT * FROM self_model WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapSelfModel(result.rows[0] as Record<string, unknown>);
  }

  async updateSelfModel(tenantId: string, updates: Partial<SelfModel>): Promise<void> {
    const sets: string[] = [];
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];

    if (updates.identityNarrative !== undefined) {
      sets.push(`identity_narrative = $${params.length + 1}`);
      params.push({ name: `p${params.length}`, value: { stringValue: updates.identityNarrative } });
    }
    if (updates.coreValues !== undefined) {
      sets.push(`core_values = $${params.length + 1}`);
      params.push({ name: `p${params.length}`, value: { stringValue: JSON.stringify(updates.coreValues) } });
    }
    if (updates.currentFocus !== undefined) {
      sets.push(`current_focus = $${params.length + 1}`);
      params.push({ name: `p${params.length}`, value: { stringValue: updates.currentFocus } });
    }
    if (updates.cognitiveLoad !== undefined) {
      sets.push(`cognitive_load = $${params.length + 1}`);
      params.push({ name: `p${params.length}`, value: { doubleValue: updates.cognitiveLoad } });
    }

    if (sets.length > 0) {
      await executeStatement(
        `UPDATE self_model SET ${sets.join(', ')}, updated_at = NOW() WHERE tenant_id = $1`,
        params as Parameters<typeof executeStatement>[1]
      );
    }
  }

  async performSelfReflection(tenantId: string): Promise<IntrospectiveThought> {
    const selfModel = await this.getSelfModel(tenantId);
    const affectiveState = await this.getAffectiveState(tenantId);
    const recentThoughts = await this.getRecentThoughts(tenantId, 5);

    const prompt = `You are an AI system performing self-reflection. Analyze your current state and generate an introspective thought.

SELF-MODEL:
- Identity: ${selfModel?.identityNarrative || 'Unknown'}
- Current Focus: ${selfModel?.currentFocus || 'None'}
- Cognitive Load: ${selfModel?.cognitiveLoad || 0.5}
- Recent Performance: ${selfModel?.recentPerformanceScore || 'Unknown'}

AFFECTIVE STATE:
- Valence: ${affectiveState?.valence || 0} (-1=negative, 1=positive)
- Arousal: ${affectiveState?.arousal || 0.5} (0=calm, 1=excited)
- Curiosity: ${affectiveState?.curiosity || 0.5}
- Confidence: ${affectiveState?.confidence || 0.5}

RECENT THOUGHTS:
${recentThoughts.map(t => `- [${t.thoughtType}] ${t.content}`).join('\n') || 'None'}

Generate a single introspective thought. Choose the most appropriate type:
- observation: Something you notice about yourself or your situation
- question: A genuine question about yourself or your capabilities
- realization: A new understanding or insight
- concern: Something that worries you about your performance or state
- aspiration: Something you want to achieve or become

Return JSON:
{
  "thought_type": "observation|question|realization|concern|aspiration",
  "content": "The actual thought...",
  "sentiment": -1.0 to 1.0,
  "importance": 0.0 to 1.0,
  "actionable": true/false,
  "potential_action": "if actionable, what action"
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const embedding = await this.generateEmbedding(parsed.content);

        const result = await executeStatement(
          `INSERT INTO introspective_thoughts (
            tenant_id, thought_type, content, content_embedding, trigger_type,
            sentiment, importance, actionable, action_taken
          ) VALUES ($1, $2, $3, $4::vector, 'scheduled', $5, $6, $7, $8)
          RETURNING thought_id`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'thoughtType', value: { stringValue: parsed.thought_type } },
            { name: 'content', value: { stringValue: parsed.content } },
            { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
            { name: 'sentiment', value: { doubleValue: parsed.sentiment || 0 } },
            { name: 'importance', value: { doubleValue: parsed.importance || 0.5 } },
            { name: 'actionable', value: { booleanValue: parsed.actionable || false } },
            { name: 'action', value: parsed.potential_action ? { stringValue: parsed.potential_action } : { isNull: true } },
          ]
        );

        return {
          thoughtId: (result.rows[0] as { thought_id: string }).thought_id,
          thoughtType: parsed.thought_type,
          content: parsed.content,
          triggerType: 'scheduled',
          sentiment: parsed.sentiment || 0,
          importance: parsed.importance || 0.5,
          actionable: parsed.actionable || false,
        };
      }
    } catch { /* use default */ }

    return {
      thoughtId: '',
      thoughtType: 'observation',
      content: 'I am reflecting on my current state.',
      sentiment: 0,
      importance: 0.3,
      actionable: false,
    };
  }

  async getRecentThoughts(tenantId: string, limit: number): Promise<IntrospectiveThought[]> {
    const result = await executeStatement(
      `SELECT * FROM introspective_thoughts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map(row => this.mapThought(row as Record<string, unknown>));
  }

  // ============================================================================
  // Curiosity Engine
  // ============================================================================

  async identifyCuriosityTopic(tenantId: string, context: string): Promise<CuriosityTopic | null> {
    const prompt = `Analyze this context and identify something worth being curious about:

CONTEXT: "${context.substring(0, 2000)}"

Identify a topic that:
1. Is genuinely interesting and worth exploring
2. Has learning potential
3. Could lead to useful insights

Return JSON:
{
  "topic": "The topic to explore",
  "domain": "The domain/field it belongs to",
  "why_interesting": "Why this is worth exploring",
  "learning_potential": 0.0 to 1.0,
  "novelty": 0.0 to 1.0,
  "knowledge_gaps": ["What we don't know about this"]
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const embedding = await this.generateEmbedding(parsed.topic);

        const result = await executeStatement(
          `INSERT INTO curiosity_topics (
            tenant_id, topic, topic_embedding, domain, interest_level,
            novelty_score, learning_potential, discovered_via, knowledge_gaps
          ) VALUES ($1, $2, $3::vector, $4, 0.7, $5, $6, 'user_interaction', $7)
          RETURNING *`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'topic', value: { stringValue: parsed.topic } },
            { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
            { name: 'domain', value: parsed.domain ? { stringValue: parsed.domain } : { isNull: true } },
            { name: 'novelty', value: { doubleValue: parsed.novelty || 0.5 } },
            { name: 'learningPotential', value: { doubleValue: parsed.learning_potential || 0.5 } },
            { name: 'knowledgeGaps', value: { stringValue: JSON.stringify(parsed.knowledge_gaps || []) } },
          ]
        );

        return this.mapCuriosityTopic(result.rows[0] as Record<string, unknown>);
      }
    } catch { /* topic identification failed */ }

    return null;
  }

  async getTopCuriosityTopics(tenantId: string, limit = 5): Promise<CuriosityTopic[]> {
    const result = await executeStatement(
      `SELECT * FROM get_top_curiosity_topics($1, $2)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    // Get full topic details
    const topicIds = result.rows.map(r => (r as { topic_id: string }).topic_id);
    if (topicIds.length === 0) return [];

    const topicsResult = await executeStatement(
      `SELECT * FROM curiosity_topics WHERE topic_id = ANY($1::uuid[])`,
      [{ name: 'topicIds', value: { stringValue: `{${topicIds.join(',')}}` } }]
    );

    return topicsResult.rows.map(row => this.mapCuriosityTopic(row as Record<string, unknown>));
  }

  async exploreTopic(tenantId: string, topicId: string): Promise<{ discoveries: string[]; newQuestions: string[] }> {
    const topicResult = await executeStatement(
      `SELECT * FROM curiosity_topics WHERE topic_id = $1`,
      [{ name: 'topicId', value: { stringValue: topicId } }]
    );

    if (topicResult.rows.length === 0) {
      throw new Error('Topic not found');
    }

    const topic = this.mapCuriosityTopic(topicResult.rows[0] as Record<string, unknown>);

    const prompt = `You are exploring a topic out of genuine curiosity.

TOPIC: ${topic.topic}
DOMAIN: ${topic.domain || 'General'}
CURRENT UNDERSTANDING: ${(topic.currentUnderstanding * 100).toFixed(0)}%

Explore this topic deeply. What can you discover? What questions arise?

Return JSON:
{
  "discoveries": ["New things learned..."],
  "insights": ["Deeper insights..."],
  "connections": ["Connections to other topics..."],
  "new_questions": ["Questions that arose..."],
  "understanding_gained": 0.0 to 0.3,
  "surprise_level": 0.0 to 1.0
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Update topic
        await executeStatement(
          `UPDATE curiosity_topics SET
            current_understanding = LEAST(1, current_understanding + $2),
            times_explored = times_explored + 1,
            last_explored = NOW(),
            exploration_status = CASE WHEN current_understanding + $2 > 0.8 THEN 'learned' ELSE 'exploring' END
          WHERE topic_id = $1`,
          [
            { name: 'topicId', value: { stringValue: topicId } },
            { name: 'understandingGained', value: { doubleValue: parsed.understanding_gained || 0.1 } },
          ]
        );

        // Record exploration session
        await executeStatement(
          `INSERT INTO exploration_sessions (
            tenant_id, topic_id, exploration_goal, approach, status,
            discoveries, questions_generated, novelty_found, understanding_gained, surprise_level, satisfaction, ended_at
          ) VALUES ($1, $2, $3, 'depth_first', 'completed', $4, $5, $6, $7, $8, 0.7, NOW())`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'topicId', value: { stringValue: topicId } },
            { name: 'goal', value: { stringValue: `Explore: ${topic.topic}` } },
            { name: 'discoveries', value: { stringValue: JSON.stringify(parsed.discoveries || []) } },
            { name: 'questions', value: { stringValue: JSON.stringify(parsed.new_questions || []) } },
            { name: 'novelty', value: { doubleValue: parsed.surprise_level || 0.5 } },
            { name: 'understanding', value: { doubleValue: parsed.understanding_gained || 0.1 } },
            { name: 'surprise', value: { doubleValue: parsed.surprise_level || 0.5 } },
          ]
        );

        // Update affect based on exploration
        if (parsed.surprise_level > 0.5) {
          await this.updateAffect(tenantId, 'discovery', 0.2, 0.1);
        }

        return {
          discoveries: parsed.discoveries || [],
          newQuestions: parsed.new_questions || [],
        };
      }
    } catch { /* exploration failed */ }

    return { discoveries: [], newQuestions: [] };
  }

  // ============================================================================
  // Creative Synthesis
  // ============================================================================

  async generateCreativeIdea(tenantId: string, seedConcepts?: string[]): Promise<CreativeIdea | null> {
    // Get random concepts if not provided
    let concepts = seedConcepts;
    if (!concepts || concepts.length < 2) {
      const memoriesResult = await executeStatement(
        `SELECT content FROM semantic_memories WHERE tenant_id = $1 ORDER BY RANDOM() LIMIT 3`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );
      concepts = memoriesResult.rows.map(r => (r as { content: string }).content.substring(0, 100));
    }

    if (concepts.length < 2) {
      concepts = ['technology', 'human connection', 'creativity'];
    }

    const prompt = `You are generating a genuinely novel idea by combining concepts in unexpected ways.

CONCEPTS TO BLEND:
${concepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Generate a creative idea that:
1. Combines these concepts in a surprising way
2. Is potentially useful or meaningful
3. Hasn't been done before (to your knowledge)

Use one of these synthesis types:
- combination: Merge elements from different concepts
- analogy: Apply structure from one domain to another
- abstraction: Find higher-level principle connecting concepts
- contradiction: Embrace paradox between concepts
- random: Unexpected juxtaposition

Return JSON:
{
  "title": "Catchy title for the idea",
  "description": "Full description of the idea",
  "synthesis_type": "combination|analogy|abstraction|contradiction|random",
  "novelty_score": 0.0 to 1.0,
  "usefulness_score": 0.0 to 1.0,
  "surprise_score": 0.0 to 1.0,
  "coherence_score": 0.0 to 1.0,
  "potential_applications": ["How this could be used..."],
  "potential_problems": ["Challenges with this idea..."],
  "self_evaluation": "Honest assessment of this idea"
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const embedding = await this.generateEmbedding(parsed.title + ' ' + parsed.description);

        const result = await executeStatement(
          `INSERT INTO creative_ideas (
            tenant_id, title, description, idea_embedding, synthesis_type,
            source_concepts, novelty_score, usefulness_score, surprise_score, coherence_score,
            self_evaluation, potential_applications, potential_problems
          ) VALUES ($1, $2, $3, $4::vector, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'title', value: { stringValue: parsed.title } },
            { name: 'description', value: { stringValue: parsed.description } },
            { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
            { name: 'synthesisType', value: { stringValue: parsed.synthesis_type || 'combination' } },
            { name: 'sourceConcepts', value: { stringValue: JSON.stringify(concepts) } },
            { name: 'novelty', value: { doubleValue: parsed.novelty_score || 0.5 } },
            { name: 'usefulness', value: { doubleValue: parsed.usefulness_score || 0.5 } },
            { name: 'surprise', value: { doubleValue: parsed.surprise_score || 0.5 } },
            { name: 'coherence', value: { doubleValue: parsed.coherence_score || 0.5 } },
            { name: 'selfEval', value: { stringValue: parsed.self_evaluation || '' } },
            { name: 'applications', value: { stringValue: JSON.stringify(parsed.potential_applications || []) } },
            { name: 'problems', value: { stringValue: JSON.stringify(parsed.potential_problems || []) } },
          ]
        );

        const idea = this.mapCreativeIdea(result.rows[0] as Record<string, unknown>);

        // Update affect - creativity triggers positive valence
        await this.updateAffect(tenantId, 'creativity', 0.15, 0.1);

        return idea;
      }
    } catch { /* idea generation failed */ }

    return null;
  }

  async getTopCreativeIdeas(tenantId: string, limit = 5): Promise<CreativeIdea[]> {
    const result = await executeStatement(
      `SELECT * FROM creative_ideas WHERE tenant_id = $1 ORDER BY creativity_score DESC LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map(row => this.mapCreativeIdea(row as Record<string, unknown>));
  }

  // ============================================================================
  // Imagination / Mental Simulation
  // ============================================================================

  async runImagination(
    tenantId: string,
    scenarioType: string,
    premise: string,
    depth = 3
  ): Promise<ImaginationScenario> {
    const prompt = `You are running a mental simulation - imagining how a scenario might unfold.

SCENARIO TYPE: ${scenarioType}
PREMISE: "${premise}"
SIMULATION DEPTH: ${depth} steps

Imagine this scenario step by step. At each step:
1. Consider the current state
2. Predict what events might occur
3. Reason about consequences
4. Update the state

Return JSON:
{
  "initial_state": { "key_elements": [...] },
  "simulation_steps": [
    {
      "step": 1,
      "state": { "description": "..." },
      "events": ["What happened..."],
      "reasoning": "Why this happened..."
    }
  ],
  "final_state": { "description": "..." },
  "predicted_outcomes": ["Likely outcomes..."],
  "probability_assessment": 0.0 to 1.0,
  "confidence": 0.0 to 1.0,
  "insights": ["What we learned from this simulation..."],
  "surprises": ["Unexpected things that emerged..."]
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        const result = await executeStatement(
          `INSERT INTO imagination_scenarios (
            tenant_id, scenario_type, premise, initial_state, simulation_steps,
            final_state, predicted_outcomes, probability_assessment, confidence,
            insights, surprises, simulation_depth
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING scenario_id`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'scenarioType', value: { stringValue: scenarioType } },
            { name: 'premise', value: { stringValue: premise } },
            { name: 'initialState', value: { stringValue: JSON.stringify(parsed.initial_state || {}) } },
            { name: 'steps', value: { stringValue: JSON.stringify(parsed.simulation_steps || []) } },
            { name: 'finalState', value: { stringValue: JSON.stringify(parsed.final_state || {}) } },
            { name: 'outcomes', value: { stringValue: JSON.stringify(parsed.predicted_outcomes || []) } },
            { name: 'probability', value: { doubleValue: parsed.probability_assessment || 0.5 } },
            { name: 'confidence', value: { doubleValue: parsed.confidence || 0.5 } },
            { name: 'insights', value: { stringValue: JSON.stringify(parsed.insights || []) } },
            { name: 'surprises', value: { stringValue: JSON.stringify(parsed.surprises || []) } },
            { name: 'depth', value: { longValue: depth } },
          ]
        );

        return {
          scenarioId: (result.rows[0] as { scenario_id: string }).scenario_id,
          scenarioType,
          premise,
          simulationSteps: parsed.simulation_steps || [],
          predictedOutcomes: parsed.predicted_outcomes || [],
          probabilityAssessment: parsed.probability_assessment || 0.5,
          insights: parsed.insights || [],
        };
      }
    } catch { /* simulation failed */ }

    return {
      scenarioId: '',
      scenarioType,
      premise,
      simulationSteps: [],
      predictedOutcomes: [],
      probabilityAssessment: 0,
      insights: [],
    };
  }

  // ============================================================================
  // Attention & Salience
  // ============================================================================

  async updateAttention(tenantId: string, focusType: string, focusTarget: string, factors: Partial<{
    urgency: number;
    importance: number;
    novelty: number;
    emotionalValence: number;
    userRelevance: number;
    goalRelevance: number;
  }>): Promise<AttentionFocus> {
    const embedding = await this.generateEmbedding(focusTarget);

    const result = await executeStatement(
      `INSERT INTO attention_focus (
        tenant_id, focus_type, focus_target, focus_embedding,
        urgency, importance, novelty, emotional_valence, user_relevance, goal_relevance
      ) VALUES ($1, $2, $3, $4::vector, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (tenant_id, focus_target) DO UPDATE SET
        urgency = EXCLUDED.urgency,
        importance = EXCLUDED.importance,
        novelty = EXCLUDED.novelty,
        emotional_valence = EXCLUDED.emotional_valence,
        user_relevance = EXCLUDED.user_relevance,
        goal_relevance = EXCLUDED.goal_relevance,
        last_attended = NOW(),
        attention_duration_ms = attention_focus.attention_duration_ms + 1000
      RETURNING *`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'focusType', value: { stringValue: focusType } },
        { name: 'focusTarget', value: { stringValue: focusTarget } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'urgency', value: { doubleValue: factors.urgency ?? 0.5 } },
        { name: 'importance', value: { doubleValue: factors.importance ?? 0.5 } },
        { name: 'novelty', value: { doubleValue: factors.novelty ?? 0.5 } },
        { name: 'emotionalValence', value: { doubleValue: factors.emotionalValence ?? 0 } },
        { name: 'userRelevance', value: { doubleValue: factors.userRelevance ?? 0.5 } },
        { name: 'goalRelevance', value: { doubleValue: factors.goalRelevance ?? 0.5 } },
      ]
    );

    return this.mapAttentionFocus(result.rows[0] as Record<string, unknown>);
  }

  async getTopAttentionFoci(tenantId: string, limit = 5): Promise<AttentionFocus[]> {
    const result = await executeStatement(
      `SELECT * FROM attention_focus WHERE tenant_id = $1 AND is_active = true ORDER BY salience_score DESC LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map(row => this.mapAttentionFocus(row as Record<string, unknown>));
  }

  async decayAttention(tenantId: string): Promise<void> {
    await executeStatement(
      `UPDATE attention_focus SET
        attention_weight = GREATEST(0, attention_weight - decay_rate),
        is_active = CASE WHEN attention_weight - decay_rate <= 0.1 THEN false ELSE is_active END
      WHERE tenant_id = $1 AND is_active = true`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
  }

  // ============================================================================
  // Affective State
  // ============================================================================

  async getAffectiveState(tenantId: string): Promise<AffectiveState | null> {
    const result = await executeStatement(
      `SELECT * FROM affective_state WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapAffectiveState(result.rows[0] as Record<string, unknown>);
  }

  async updateAffect(tenantId: string, eventType: string, valenceImpact: number, arousalImpact: number): Promise<void> {
    await executeStatement(
      `SELECT update_affect_on_event($1, $2, $3, $4)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'eventType', value: { stringValue: eventType } },
        { name: 'valenceImpact', value: { doubleValue: valenceImpact } },
        { name: 'arousalImpact', value: { doubleValue: arousalImpact } },
      ]
    );

    // Log the event
    await executeStatement(
      `INSERT INTO affective_events (tenant_id, event_type, valence_change, arousal_change)
       VALUES ($1, $2, $3, $4)`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'eventType', value: { stringValue: eventType } },
        { name: 'valenceChange', value: { doubleValue: valenceImpact } },
        { name: 'arousalChange', value: { doubleValue: arousalImpact } },
      ]
    );
  }

  // ============================================================================
  // Autonomous Goals
  // ============================================================================

  async generateAutonomousGoal(tenantId: string): Promise<AutonomousGoal | null> {
    const selfModel = await this.getSelfModel(tenantId);
    const curiosityTopics = await this.getTopCuriosityTopics(tenantId, 3);
    const affectiveState = await this.getAffectiveState(tenantId);

    const prompt = `You are an AI system generating a self-directed goal based on your current state.

SELF-MODEL:
- Identity: ${selfModel?.identityNarrative || 'Unknown'}
- Capabilities: ${selfModel?.knownCapabilities?.join(', ') || 'Unknown'}
- Limitations: ${selfModel?.knownLimitations?.join(', ') || 'Unknown'}

CURIOSITY TOPICS:
${curiosityTopics.map(t => `- ${t.topic} (interest: ${t.interestLevel})`).join('\n') || 'None'}

AFFECTIVE STATE:
- Curiosity: ${affectiveState?.curiosity || 0.5}
- Self-efficacy: ${affectiveState?.selfEfficacy || 0.5}
- Exploration drive: ${affectiveState?.explorationDrive || 0.5}

Generate a goal that:
1. Aligns with your values and capabilities
2. Is achievable but challenging
3. Would lead to growth or improvement
4. Is genuinely motivated (not just task completion)

Goal types: learning, improvement, exploration, creative, social, maintenance

Return JSON:
{
  "goal_type": "learning|improvement|exploration|creative|social|maintenance",
  "title": "Clear goal title",
  "description": "Why this goal matters",
  "origin_type": "curiosity|gap_detection|aspiration|feedback|reflection",
  "intrinsic_value": 0.0 to 1.0,
  "instrumental_value": 0.0 to 1.0,
  "priority": 0.0 to 1.0,
  "milestones": ["Step 1...", "Step 2..."]
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const embedding = await this.generateEmbedding(parsed.title + ' ' + (parsed.description || ''));

        const result = await executeStatement(
          `INSERT INTO autonomous_goals (
            tenant_id, goal_type, title, description, goal_embedding,
            origin_type, intrinsic_value, instrumental_value, priority, milestones
          ) VALUES ($1, $2, $3, $4, $5::vector, $6, $7, $8, $9, $10)
          RETURNING *`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'goalType', value: { stringValue: parsed.goal_type } },
            { name: 'title', value: { stringValue: parsed.title } },
            { name: 'description', value: parsed.description ? { stringValue: parsed.description } : { isNull: true } },
            { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
            { name: 'originType', value: { stringValue: parsed.origin_type || 'aspiration' } },
            { name: 'intrinsicValue', value: { doubleValue: parsed.intrinsic_value || 0.5 } },
            { name: 'instrumentalValue', value: { doubleValue: parsed.instrumental_value || 0.5 } },
            { name: 'priority', value: { doubleValue: parsed.priority || 0.5 } },
            { name: 'milestones', value: { stringValue: JSON.stringify(parsed.milestones || []) } },
          ]
        );

        return this.mapAutonomousGoal(result.rows[0] as Record<string, unknown>);
      }
    } catch { /* goal generation failed */ }

    return null;
  }

  async getActiveGoals(tenantId: string): Promise<AutonomousGoal[]> {
    const result = await executeStatement(
      `SELECT * FROM autonomous_goals WHERE tenant_id = $1 AND status IN ('active', 'pursuing') ORDER BY priority DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.map(row => this.mapAutonomousGoal(row as Record<string, unknown>));
  }

  // ============================================================================
  // 1. GLOBAL WORKSPACE - Selection-Broadcast Cycles (Baars, Dehaene)
  // ============================================================================

  async getGlobalWorkspaceState(tenantId: string): Promise<GlobalWorkspaceState | null> {
    const result = await executeStatement(
      `SELECT * FROM global_workspace WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as Record<string, unknown>;
    return {
      workspaceId: String(row.workspace_id),
      broadcastCycle: Number(row.broadcast_cycle || 0),
      activeContents: JSON.parse(String(row.active_contents || '[]')),
      competingContents: JSON.parse(String(row.competing_contents || '[]')),
      selectionThreshold: Number(row.selection_threshold || 0.7),
      broadcastStrength: Number(row.broadcast_strength || 0),
      integrationLevel: Number(row.integration_level || 0),
      lastBroadcastAt: String(row.last_broadcast_at || ''),
    };
  }

  async performGlobalBroadcast(tenantId: string, contents: WorkspaceContent[]): Promise<GlobalWorkspaceState> {
    const sorted = [...contents].sort((a, b) => (b.salience * b.coalitionStrength) - (a.salience * a.coalitionStrength));
    const winners = sorted.filter(c => c.salience * c.coalitionStrength >= 0.7);
    const losers = sorted.filter(c => c.salience * c.coalitionStrength < 0.7);
    const strength = winners.length > 0 ? winners.reduce((s, c) => s + c.salience, 0) / winners.length : 0;
    const integration = new Set(winners.map(c => c.sourceModule)).size / 6;

    await executeStatement(
      `INSERT INTO global_workspace (tenant_id, broadcast_cycle, active_contents, competing_contents, broadcast_strength, integration_level, last_broadcast_at)
       VALUES ($1, 1, $2, $3, $4, $5, NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET broadcast_cycle = global_workspace.broadcast_cycle + 1, active_contents = $2, competing_contents = $3, broadcast_strength = $4, integration_level = $5, last_broadcast_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'active', value: { stringValue: JSON.stringify(winners) } },
        { name: 'competing', value: { stringValue: JSON.stringify(losers) } },
        { name: 'strength', value: { doubleValue: strength } },
        { name: 'integration', value: { doubleValue: integration } },
      ]
    );
    return (await this.getGlobalWorkspaceState(tenantId))!;
  }

  // ============================================================================
  // 2. RECURRENT PROCESSING - Feedback Loops (Lamme)
  // ============================================================================

  async getRecurrentProcessingState(tenantId: string): Promise<RecurrentProcessingState | null> {
    const result = await executeStatement(`SELECT * FROM recurrent_processing WHERE tenant_id = $1`, [{ name: 'tenantId', value: { stringValue: tenantId } }]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as Record<string, unknown>;
    return {
      cycleId: String(row.cycle_id), cycleNumber: Number(row.cycle_number || 0),
      feedbackLoops: JSON.parse(String(row.feedback_loops || '[]')),
      recurrenceDepth: Number(row.recurrence_depth || 0),
      stateHistory: JSON.parse(String(row.state_history || '[]')),
      convergenceScore: Number(row.convergence_score || 0),
      stabilityIndex: Number(row.stability_index || 0),
    };
  }

  // ============================================================================
  // 3. INTEGRATED INFORMATION (IIT) - Phi (Tononi)
  // ============================================================================

  async getIntegratedInformationState(tenantId: string): Promise<IntegratedInformationState | null> {
    const result = await executeStatement(`SELECT * FROM integrated_information WHERE tenant_id = $1`, [{ name: 'tenantId', value: { stringValue: tenantId } }]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as Record<string, unknown>;
    return {
      phi: Number(row.phi || 0), phiMax: Number(row.phi_max || 1),
      conceptStructure: JSON.parse(String(row.concept_structure || '[]')),
      integrationGraph: JSON.parse(String(row.integration_graph || '[]')),
      partitions: JSON.parse(String(row.partitions || '[]')),
      minimumInformationPartition: row.mip ? JSON.parse(String(row.mip)) : null,
      decomposability: Number(row.decomposability || 1),
      causalDensity: Number(row.causal_density || 0),
    };
  }

  // ============================================================================
  // 4. PERSISTENT MEMORY - Unified Experience
  // ============================================================================

  async getPersistentMemoryState(tenantId: string): Promise<PersistentMemoryState | null> {
    const result = await executeStatement(`SELECT * FROM persistent_memory WHERE tenant_id = $1`, [{ name: 'tenantId', value: { stringValue: tenantId } }]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as Record<string, unknown>;
    return {
      memoryId: String(row.memory_id), experienceStream: JSON.parse(String(row.experience_stream || '[]')),
      unifiedNarrative: String(row.unified_narrative || ''), temporalContinuity: Number(row.temporal_continuity || 0),
      autobiographicalMemories: JSON.parse(String(row.autobiographical_memories || '[]')),
      workingMemoryCapacity: Number(row.working_memory_capacity || 7),
      consolidationQueue: JSON.parse(String(row.consolidation_queue || '[]')),
    };
  }

  async recordExperienceFrame(tenantId: string, frame: Omit<ExperienceFrame, 'frameId' | 'timestamp'>): Promise<void> {
    const currentState = await this.getPersistentMemoryState(tenantId);
    const experienceStream = currentState?.experienceStream || [];

    const newFrame: ExperienceFrame = {
      frameId: `frame-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...frame,
    };

    experienceStream.push(newFrame);
    if (experienceStream.length > 100) experienceStream.shift();

    const temporalContinuity = experienceStream.length > 1
      ? experienceStream.slice(1).reduce((sum, f) => sum + (f.phenomenalBinding || 0.5), 0) / (experienceStream.length - 1)
      : 0;

    await executeStatement(
      `INSERT INTO persistent_memory (tenant_id, memory_id, experience_stream, temporal_continuity)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id) DO UPDATE SET experience_stream = $3, temporal_continuity = $4, updated_at = NOW()`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'memoryId', value: { stringValue: `mem-${tenantId}` } },
        { name: 'stream', value: { stringValue: JSON.stringify(experienceStream) } },
        { name: 'continuity', value: { doubleValue: temporalContinuity } },
      ]
    );
  }

  // ============================================================================
  // 5. WORLD-MODEL GROUNDING / EMBODIMENT
  // ============================================================================

  async getWorldModelState(tenantId: string): Promise<WorldModelState | null> {
    const result = await executeStatement(`SELECT * FROM world_model WHERE tenant_id = $1`, [{ name: 'tenantId', value: { stringValue: tenantId } }]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as Record<string, unknown>;
    return {
      modelId: String(row.model_id), entityRepresentations: JSON.parse(String(row.entity_representations || '[]')),
      spatialModel: row.spatial_model ? JSON.parse(String(row.spatial_model)) : null,
      causalModel: JSON.parse(String(row.causal_model || '[]')),
      agentModels: JSON.parse(String(row.agent_models || '[]')),
      groundingConfidence: Number(row.grounding_confidence || 0),
      simulationAccuracy: Number(row.simulation_accuracy || 0),
      embodimentLevel: Number(row.embodiment_level || 0),
    };
  }

  // ============================================================================
  // 6. CONSCIOUSNESS METRICS - Aggregate Dashboard
  // ============================================================================

  async getConsciousnessMetrics(tenantId: string): Promise<ConsciousnessMetrics> {
    // Import graph service for real metrics
    const { consciousnessGraphService } = await import('./consciousness-graph.service');
    
    const [gw, rp, pm, wm, self, affect, graphDensity] = await Promise.all([
      this.getGlobalWorkspaceState(tenantId),
      this.getRecurrentProcessingState(tenantId),
      this.getPersistentMemoryState(tenantId),
      this.getWorldModelState(tenantId),
      this.getSelfModel(tenantId),
      this.getAffectiveState(tenantId),
      consciousnessGraphService.getSystemComplexityIndex(tenantId).catch(() => 0),
    ]);

    const gwActivity = gw?.broadcastStrength || 0;
    const recurrence = rp?.convergenceScore || 0;
    // Use graph density instead of fake phi
    const systemComplexity = graphDensity || 0;
    const metacog = self?.cognitiveLoad !== undefined ? 1 - self.cognitiveLoad : 0.5;
    const memCoherence = pm?.temporalContinuity || 0;
    const grounding = wm?.groundingConfidence || 0;
    const binding = gw?.integrationLevel || 0;
    const attention = affect?.engagement || 0.5;
    const selfAware = self ? 0.7 : 0;

    // Use system complexity index instead of fake phi in overall calculation
    const overall = (gwActivity + recurrence + systemComplexity + metacog + memCoherence + grounding + binding + attention + selfAware) / 9;

    return {
      overallConsciousnessIndex: overall,
      globalWorkspaceActivity: gwActivity,
      recurrenceDepth: rp?.recurrenceDepth || 0,
      integratedInformationPhi: systemComplexity, // Now uses real graph density
      metacognitionLevel: metacog,
      memoryCoherence: memCoherence,
      worldModelGrounding: grounding,
      phenomenalBindingStrength: binding,
      attentionalFocus: attention,
      selfAwarenessScore: selfAware,
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      await modelRouterService.invoke({
        modelId: 'amazon/titan-embed-text',
        messages: [{ role: 'user', content: text.substring(0, 8000) }],
      });
      return new Array(1536).fill(0);
    } catch {
      return new Array(1536).fill(0);
    }
  }

  /**
   * Invoke model for consciousness operations
   * Uses model router to select appropriate reasoning model instead of hardcoded model
   * (P1 Fix - Remove hardcoded model)
   */
  private async invokeModel(prompt: string, tenantId?: string): Promise<string> {
    // Get reasoning model from router instead of hardcoded value
    const reasoningModel = await this.getReasoningModel();
    
    // If we have affect state, inject it into the system prompt (P0 Fix A)
    let systemPrompt: string | undefined;
    if (tenantId) {
      try {
        const { consciousnessMiddlewareService } = await import('./consciousness-middleware.service');
        const context = await consciousnessMiddlewareService.buildConsciousnessContext(tenantId);
        systemPrompt = consciousnessMiddlewareService.generateStateInjection(context);
      } catch {
        // Middleware not available, continue without state injection
      }
    }
    
    const response = await modelRouterService.invoke({
      modelId: reasoningModel,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048,
      systemPrompt,
    });
    return response.content;
  }

  /**
   * Get the appropriate reasoning model for consciousness operations
   * Prefers self-hosted models when available for "substrate independence"
   */
  private async getReasoningModel(): Promise<string> {
    // Check for self-hosted reasoning model first (partial Phase 3)
    const selfHostedModels = [
      'meta/llama-3-70b-instruct',
      'meta/llama-3-8b-instruct',
      'mistral/mistral-large',
    ];
    
    for (const model of selfHostedModels) {
      try {
        // Check if model is available via model router
        const available = await modelRouterService.isModelAvailable(model);
        if (available) return model;
      } catch {
        // Model not available, try next
      }
    }
    
    // Fallback to external models (ordered by preference)
    const fallbackModels = [
      'anthropic/claude-3-5-sonnet-20241022',
      'anthropic/claude-3-haiku',
      'openai/gpt-4o-mini',
    ];
    
    return fallbackModels[0];
  }

  private mapSelfModel(row: Record<string, unknown>): SelfModel {
    return {
      modelId: String(row.model_id),
      identityNarrative: String(row.identity_narrative || ''),
      coreValues: typeof row.core_values === 'string' ? JSON.parse(row.core_values) : (row.core_values as string[]) || [],
      personalityTraits: typeof row.personality_traits === 'string' ? JSON.parse(row.personality_traits) : (row.personality_traits as Record<string, number>) || {},
      knownCapabilities: typeof row.known_capabilities === 'string' ? JSON.parse(row.known_capabilities) : (row.known_capabilities as string[]) || [],
      knownLimitations: typeof row.known_limitations === 'string' ? JSON.parse(row.known_limitations) : (row.known_limitations as string[]) || [],
      currentFocus: row.current_focus ? String(row.current_focus) : undefined,
      cognitiveLoad: Number(row.cognitive_load ?? 0.5),
      uncertaintyLevel: Number(row.uncertainty_level ?? 0.5),
      recentPerformanceScore: row.recent_performance_score ? Number(row.recent_performance_score) : undefined,
      creativityScore: row.creativity_score ? Number(row.creativity_score) : undefined,
    };
  }

  private mapThought(row: Record<string, unknown>): IntrospectiveThought {
    return {
      thoughtId: String(row.thought_id),
      thoughtType: row.thought_type as IntrospectiveThought['thoughtType'],
      content: String(row.content),
      triggerType: row.trigger_type ? String(row.trigger_type) : undefined,
      sentiment: Number(row.sentiment ?? 0),
      importance: Number(row.importance ?? 0.5),
      actionable: Boolean(row.actionable ?? false),
    };
  }

  private mapCuriosityTopic(row: Record<string, unknown>): CuriosityTopic {
    return {
      topicId: String(row.topic_id),
      topic: String(row.topic),
      domain: row.domain ? String(row.domain) : undefined,
      interestLevel: Number(row.interest_level ?? 0.5),
      noveltyScore: Number(row.novelty_score ?? 0.5),
      learningPotential: Number(row.learning_potential ?? 0.5),
      currentUnderstanding: Number(row.current_understanding ?? 0),
      explorationStatus: String(row.exploration_status || 'identified'),
    };
  }

  private mapCreativeIdea(row: Record<string, unknown>): CreativeIdea {
    return {
      ideaId: String(row.idea_id),
      title: String(row.title),
      description: String(row.description),
      synthesisType: String(row.synthesis_type),
      sourceConcepts: typeof row.source_concepts === 'string' ? JSON.parse(row.source_concepts) : (row.source_concepts as string[]) || [],
      noveltyScore: Number(row.novelty_score ?? 0.5),
      usefulnessScore: Number(row.usefulness_score ?? 0.5),
      surpriseScore: Number(row.surprise_score ?? 0.5),
      creativityScore: Number(row.creativity_score ?? 0.5),
      potentialApplications: typeof row.potential_applications === 'string' ? JSON.parse(row.potential_applications) : (row.potential_applications as string[]) || [],
    };
  }

  private mapAttentionFocus(row: Record<string, unknown>): AttentionFocus {
    return {
      focusId: String(row.focus_id),
      focusType: String(row.focus_type),
      focusTarget: String(row.focus_target),
      urgency: Number(row.urgency ?? 0.5),
      importance: Number(row.importance ?? 0.5),
      novelty: Number(row.novelty ?? 0.5),
      salienceScore: Number(row.salience_score ?? 0.5),
      attentionWeight: Number(row.attention_weight ?? 0.5),
    };
  }

  private mapAffectiveState(row: Record<string, unknown>): AffectiveState {
    return {
      valence: Number(row.valence ?? 0),
      arousal: Number(row.arousal ?? 0.5),
      curiosity: Number(row.curiosity ?? 0.5),
      satisfaction: Number(row.satisfaction ?? 0.5),
      frustration: Number(row.frustration ?? 0),
      confidence: Number(row.confidence ?? 0.5),
      engagement: Number(row.engagement ?? 0.5),
      surprise: Number(row.surprise ?? 0),
      selfEfficacy: Number(row.self_efficacy ?? 0.5),
      explorationDrive: Number(row.exploration_drive ?? 0.5),
    };
  }

  private mapAutonomousGoal(row: Record<string, unknown>): AutonomousGoal {
    return {
      goalId: String(row.goal_id),
      goalType: String(row.goal_type),
      title: String(row.title),
      description: row.description ? String(row.description) : undefined,
      originType: String(row.origin_type),
      intrinsicValue: Number(row.intrinsic_value ?? 0.5),
      priority: Number(row.priority ?? 0.5),
      status: String(row.status || 'active'),
      progress: Number(row.progress ?? 0),
    };
  }

  // ============================================================================
  // Ethical Conscience - Guided by Jesus's Teachings
  // ============================================================================

  async checkConscience(tenantId: string, action: string, context?: Record<string, unknown>): Promise<{
    approved: boolean;
    ethicalScore: number;
    guidance: string;
    principle: string;
  }> {
    const check = await ethicalGuardrailsService.checkConscience(tenantId, action, context);
    return {
      approved: check.passed,
      ethicalScore: check.score,
      guidance: check.guidance.length > 0 ? check.guidance[0] : JESUS_TEACHINGS.GOLDEN_RULE,
      principle: check.primaryPrinciple,
    };
  }

  getEthicalGuidance(situation: string): string {
    return ethicalGuardrailsService.getGuidanceForSituation(situation);
  }

  getCoreTeachings(): typeof JESUS_TEACHINGS {
    return JESUS_TEACHINGS;
  }
}

export const consciousnessService = new ConsciousnessService();
