// RADIANT Autonomous Organism - Ghost Simulation Layer
// User digital twin and outcome prediction
// Version: 1.0.0

import { randomUUID } from 'crypto';
import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../../db/client';
import { createRegisteredLogger } from '../logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'organism/ghost-simulation',
  category: 'infrastructure',
  sourceType: 'application',
});
import { embeddingService } from '../embedding.service';

// ============================================================================
// Types
// ============================================================================

type GhostSimulationType = 'user_reaction' | 'outcome_prediction' | 'safety_check' | 'cost_estimation' | 'latency_estimation';
type GhostConfidenceLevel = 'high' | 'medium' | 'low' | 'uncertain';

interface GhostVector {
  vectorId: string;
  userId: string;
  tenantId: string;
  vector: Float32Array;
  preferenceVector: Float32Array;
  behaviorVector: Float32Array;
  emotionalVector: Float32Array;
  knowledgeVector: Float32Array;
  lastUpdated: Date;
  interactionCount: number;
  confidenceScore: number;
  decayRate: number;
  lastDecayAt: Date;
}

interface GhostSimulation {
  simulationId: string;
  type: GhostSimulationType;
  toolId: string;
  proposedAction: string;
  context: Record<string, unknown>;
  ghostVector: GhostVector;
  prediction: GhostPrediction;
  confidence: GhostConfidenceLevel;
  simulationTimeMs: number;
  modelUsed: string;
  createdAt: Date;
}

interface GhostPrediction {
  predictedSatisfaction?: number;
  predictedFrustration?: number;
  predictedEngagement?: number;
  successProbability?: number;
  expectedOutputQuality?: number;
  potentialRisks?: string[];
  safetyScore?: number;
  flaggedConcerns?: string[];
  estimatedCost?: number;
  estimatedLatencyMs?: number;
  reasoning: string;
  alternativesSuggested?: string[];
}

interface GhostCalibration {
  userId: string;
  predictionAccuracy: number;
  satisfactionCorrelation: number;
  outcomeCorrelation: number;
  totalPredictions: number;
  correctPredictions: number;
  lastCalibratedAt: Date;
  calibrationDataPoints: number;
}

interface UserInteraction {
  interactionId: string;
  userId: string;
  toolId: string;
  input: string;
  output: string;
  satisfaction?: number;
  frustration?: number;
  engagement?: number;
  outcome: 'success' | 'partial' | 'failure';
  timestamp: Date;
}

// ============================================================================
// Ghost Simulation Service
// ============================================================================

class GhostSimulationService {
  private ghostVectors: Map<string, GhostVector> = new Map();
  private calibrations: Map<string, GhostCalibration> = new Map();
  private recentSimulations: Map<string, GhostSimulation[]> = new Map();
  
  private readonly VECTOR_DIMENSION = 4096;
  private readonly DECAY_RATE = 0.01; // 1% daily decay
  private readonly MIN_INTERACTIONS_FOR_PREDICTION = 10;

  // ==========================================================================
  // GHOST VECTOR MANAGEMENT
  // ==========================================================================

  async getOrCreateGhostVector(userId: string, tenantId: string): Promise<GhostVector> {
    const vectorKey = `${tenantId}:${userId}`;
    
    let vector = this.ghostVectors.get(vectorKey);
    if (vector) {
      // Apply decay if needed
      vector = await this.applyDecay(vector);
      return vector;
    }

    // Try to load from database
    vector = await this.loadGhostVectorFromDatabase(userId, tenantId);
    if (vector) {
      this.ghostVectors.set(vectorKey, vector);
      return vector;
    }

    // Create new ghost vector
    vector = await this.createGhostVector(userId, tenantId);
    this.ghostVectors.set(vectorKey, vector);
    await this.saveGhostVectorToDatabase(vector);

    logger.info(`Created new ghost vector for user: ${userId}`);
    return vector;
  }

  private async createGhostVector(userId: string, tenantId: string): Promise<GhostVector> {
    const now = new Date();
    
    return {
      vectorId: randomUUID(),
      userId,
      tenantId,
      vector: new Float32Array(this.VECTOR_DIMENSION),
      preferenceVector: new Float32Array(this.VECTOR_DIMENSION / 4),
      behaviorVector: new Float32Array(this.VECTOR_DIMENSION / 4),
      emotionalVector: new Float32Array(this.VECTOR_DIMENSION / 4),
      knowledgeVector: new Float32Array(this.VECTOR_DIMENSION / 4),
      lastUpdated: now,
      interactionCount: 0,
      confidenceScore: 0,
      decayRate: this.DECAY_RATE,
      lastDecayAt: now,
    };
  }

  async updateGhostVector(
    userId: string,
    tenantId: string,
    interaction: UserInteraction
  ): Promise<GhostVector> {
    const vector = await this.getOrCreateGhostVector(userId, tenantId);
    
    // Generate embedding for the interaction
    const interactionText = `${interaction.input} -> ${interaction.output}`;
    const interactionEmbedding = await this.generateEmbedding(interactionText);

    // Update component vectors based on interaction
    this.updatePreferenceVector(vector, interaction, interactionEmbedding);
    this.updateBehaviorVector(vector, interaction, interactionEmbedding);
    this.updateEmotionalVector(vector, interaction);
    this.updateKnowledgeVector(vector, interaction, interactionEmbedding);

    // Recombine into main vector
    this.recombineVector(vector);

    // Update metadata
    vector.interactionCount++;
    vector.lastUpdated = new Date();
    vector.confidenceScore = this.calculateConfidenceScore(vector);

    // Save
    const vectorKey = `${tenantId}:${userId}`;
    this.ghostVectors.set(vectorKey, vector);
    await this.saveGhostVectorToDatabase(vector);

    return vector;
  }

  private updatePreferenceVector(
    vector: GhostVector,
    interaction: UserInteraction,
    embedding: Float32Array
  ): void {
    const alpha = 0.1; // Learning rate
    const satisfaction = interaction.satisfaction || 0.5;
    
    // Weighted update based on satisfaction
    const weight = satisfaction > 0.5 ? alpha * satisfaction : alpha * 0.1;
    
    for (let i = 0; i < vector.preferenceVector.length; i++) {
      const embeddingIdx = i % embedding.length;
      vector.preferenceVector[i] = (1 - weight) * vector.preferenceVector[i] + 
                                    weight * embedding[embeddingIdx];
    }
  }

  private updateBehaviorVector(
    vector: GhostVector,
    interaction: UserInteraction,
    embedding: Float32Array
  ): void {
    const alpha = 0.05;
    
    // Behavior vector captures patterns regardless of satisfaction
    for (let i = 0; i < vector.behaviorVector.length; i++) {
      const embeddingIdx = i % embedding.length;
      vector.behaviorVector[i] = (1 - alpha) * vector.behaviorVector[i] + 
                                  alpha * embedding[embeddingIdx];
    }
  }

  private updateEmotionalVector(
    vector: GhostVector,
    interaction: UserInteraction
  ): void {
    const alpha = 0.15;
    
    // Emotional vector captures frustration, engagement patterns
    const frustration = interaction.frustration || 0;
    const engagement = interaction.engagement || 0.5;
    
    // Use frustration and engagement to modulate emotional vector
    const emotionalSignal = (engagement - frustration + 1) / 2; // Normalize to 0-1
    
    for (let i = 0; i < vector.emotionalVector.length; i++) {
      // Create oscillating pattern based on emotional signal
      const phase = (i / vector.emotionalVector.length) * Math.PI * 2;
      const signal = emotionalSignal * Math.sin(phase + vector.emotionalVector[i]);
      vector.emotionalVector[i] = (1 - alpha) * vector.emotionalVector[i] + alpha * signal;
    }
  }

  private updateKnowledgeVector(
    vector: GhostVector,
    interaction: UserInteraction,
    embedding: Float32Array
  ): void {
    const alpha = 0.08;
    
    // Knowledge vector captures domain understanding
    // Weight by outcome success
    const outcomeWeight = interaction.outcome === 'success' ? 1.0 :
                         interaction.outcome === 'partial' ? 0.5 : 0.1;
    
    for (let i = 0; i < vector.knowledgeVector.length; i++) {
      const embeddingIdx = i % embedding.length;
      vector.knowledgeVector[i] = (1 - alpha * outcomeWeight) * vector.knowledgeVector[i] + 
                                   alpha * outcomeWeight * embedding[embeddingIdx];
    }
  }

  private recombineVector(vector: GhostVector): void {
    // Combine component vectors into main vector
    const prefLen = vector.preferenceVector.length;
    const behLen = vector.behaviorVector.length;
    const emoLen = vector.emotionalVector.length;
    const knowLen = vector.knowledgeVector.length;
    
    for (let i = 0; i < this.VECTOR_DIMENSION; i++) {
      if (i < prefLen) {
        vector.vector[i] = vector.preferenceVector[i];
      } else if (i < prefLen + behLen) {
        vector.vector[i] = vector.behaviorVector[i - prefLen];
      } else if (i < prefLen + behLen + emoLen) {
        vector.vector[i] = vector.emotionalVector[i - prefLen - behLen];
      } else if (i < prefLen + behLen + emoLen + knowLen) {
        vector.vector[i] = vector.knowledgeVector[i - prefLen - behLen - emoLen];
      }
    }

    // Normalize
    let norm = 0;
    for (let i = 0; i < vector.vector.length; i++) {
      norm += vector.vector[i] * vector.vector[i];
    }
    norm = Math.sqrt(norm);
    
    if (norm > 0) {
      for (let i = 0; i < vector.vector.length; i++) {
        vector.vector[i] /= norm;
      }
    }
  }

  private async applyDecay(vector: GhostVector): Promise<GhostVector> {
    const now = new Date();
    const daysSinceDecay = (now.getTime() - vector.lastDecayAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceDecay < 1) {
      return vector; // No decay needed yet
    }

    const decayFactor = Math.pow(1 - vector.decayRate, daysSinceDecay);
    
    // Apply decay to all vectors (move toward zero/neutral)
    for (let i = 0; i < vector.preferenceVector.length; i++) {
      vector.preferenceVector[i] *= decayFactor;
    }
    for (let i = 0; i < vector.behaviorVector.length; i++) {
      vector.behaviorVector[i] *= decayFactor;
    }
    for (let i = 0; i < vector.emotionalVector.length; i++) {
      vector.emotionalVector[i] *= decayFactor;
    }
    // Knowledge decays slower
    for (let i = 0; i < vector.knowledgeVector.length; i++) {
      vector.knowledgeVector[i] *= Math.pow(decayFactor, 0.5);
    }

    this.recombineVector(vector);
    vector.lastDecayAt = now;
    vector.confidenceScore = this.calculateConfidenceScore(vector);

    return vector;
  }

  private calculateConfidenceScore(vector: GhostVector): number {
    // Confidence based on interaction count and vector magnitude
    const interactionFactor = Math.min(1, vector.interactionCount / 100);
    
    // Calculate vector magnitude
    let magnitude = 0;
    for (let i = 0; i < vector.vector.length; i++) {
      magnitude += vector.vector[i] * vector.vector[i];
    }
    magnitude = Math.sqrt(magnitude);
    
    const magnitudeFactor = Math.min(1, magnitude * 2);
    
    return (interactionFactor * 0.6 + magnitudeFactor * 0.4);
  }

  // ==========================================================================
  // SIMULATION
  // ==========================================================================

  async runSimulation(
    userId: string,
    tenantId: string,
    type: GhostSimulationType,
    toolId: string,
    proposedAction: string,
    context: Record<string, unknown> = {}
  ): Promise<GhostSimulation> {
    const startTime = Date.now();
    const simulationId = randomUUID();

    // Get user's ghost vector
    const ghostVector = await this.getOrCreateGhostVector(userId, tenantId);

    // Check if we have enough data
    if (ghostVector.interactionCount < this.MIN_INTERACTIONS_FOR_PREDICTION) {
      return this.createLowConfidenceSimulation(
        simulationId, type, toolId, proposedAction, context, ghostVector, startTime
      );
    }

    // Generate prediction based on type
    let prediction: GhostPrediction;
    
    switch (type) {
      case 'user_reaction':
        prediction = await this.predictUserReaction(ghostVector, proposedAction, context);
        break;
      case 'outcome_prediction':
        prediction = await this.predictOutcome(ghostVector, toolId, proposedAction, context);
        break;
      case 'safety_check':
        prediction = await this.performSafetyCheck(ghostVector, proposedAction, context);
        break;
      case 'cost_estimation':
        prediction = await this.estimateCost(toolId, proposedAction, context);
        break;
      case 'latency_estimation':
        prediction = await this.estimateLatency(toolId, proposedAction, context);
        break;
      default:
        prediction = { reasoning: 'Unknown simulation type' };
    }

    const confidence = this.calculatePredictionConfidence(ghostVector, prediction);

    const simulation: GhostSimulation = {
      simulationId,
      type,
      toolId,
      proposedAction,
      context,
      ghostVector,
      prediction,
      confidence,
      simulationTimeMs: Date.now() - startTime,
      modelUsed: 'ghost-simulation-v1',
      createdAt: new Date(),
    };

    // Store simulation
    await this.storeSimulation(tenantId, simulation);

    logger.info(`Ghost simulation completed: ${type}`, {
      simulationId,
      userId,
      toolId,
      confidence,
      simulationTimeMs: simulation.simulationTimeMs,
    });

    return simulation;
  }

  private async predictUserReaction(
    ghostVector: GhostVector,
    proposedAction: string,
    context: Record<string, unknown>
  ): Promise<GhostPrediction> {
    // Generate embedding for proposed action
    const actionEmbedding = await this.generateEmbedding(proposedAction);

    // Calculate similarity with preference vector
    const preferenceSimilarity = this.cosineSimilarity(
      actionEmbedding,
      new Float32Array(ghostVector.preferenceVector)
    );

    // Calculate similarity with behavior vector
    const behaviorSimilarity = this.cosineSimilarity(
      actionEmbedding,
      new Float32Array(ghostVector.behaviorVector)
    );

    // Calculate emotional state from emotional vector
    let emotionalMean = 0;
    for (let i = 0; i < ghostVector.emotionalVector.length; i++) {
      emotionalMean += ghostVector.emotionalVector[i];
    }
    emotionalMean /= ghostVector.emotionalVector.length;

    // Predict satisfaction (weighted combination)
    const predictedSatisfaction = Math.max(0, Math.min(1,
      0.5 + preferenceSimilarity * 0.3 + behaviorSimilarity * 0.1 + emotionalMean * 0.1
    ));

    // Predict frustration (inverse of preference alignment when low)
    const predictedFrustration = Math.max(0, Math.min(1,
      0.5 - preferenceSimilarity * 0.3 - emotionalMean * 0.2
    ));

    // Predict engagement (based on knowledge alignment)
    const knowledgeSimilarity = this.cosineSimilarity(
      actionEmbedding,
      new Float32Array(ghostVector.knowledgeVector)
    );
    const predictedEngagement = Math.max(0, Math.min(1,
      0.5 + knowledgeSimilarity * 0.3 + behaviorSimilarity * 0.2
    ));

    return {
      predictedSatisfaction,
      predictedFrustration,
      predictedEngagement,
      reasoning: `Based on ${ghostVector.interactionCount} interactions. ` +
        `Preference alignment: ${(preferenceSimilarity * 100).toFixed(1)}%, ` +
        `Behavior alignment: ${(behaviorSimilarity * 100).toFixed(1)}%`,
    };
  }

  private async predictOutcome(
    ghostVector: GhostVector,
    toolId: string,
    proposedAction: string,
    context: Record<string, unknown>
  ): Promise<GhostPrediction> {
    const actionEmbedding = await this.generateEmbedding(proposedAction);

    // Knowledge similarity indicates familiarity with task type
    const knowledgeSimilarity = this.cosineSimilarity(
      actionEmbedding,
      new Float32Array(ghostVector.knowledgeVector)
    );

    // Behavior similarity indicates if user typically succeeds with similar actions
    const behaviorSimilarity = this.cosineSimilarity(
      actionEmbedding,
      new Float32Array(ghostVector.behaviorVector)
    );

    // Success probability
    const successProbability = Math.max(0.1, Math.min(0.95,
      0.5 + knowledgeSimilarity * 0.25 + behaviorSimilarity * 0.2
    ));

    // Expected output quality
    const expectedOutputQuality = Math.max(0.3, Math.min(1,
      0.5 + knowledgeSimilarity * 0.3 + ghostVector.confidenceScore * 0.2
    ));

    // Identify potential risks
    const potentialRisks: string[] = [];
    if (knowledgeSimilarity < 0.3) {
      potentialRisks.push('User may be unfamiliar with this type of task');
    }
    if (behaviorSimilarity < 0.2) {
      potentialRisks.push('This action differs significantly from user patterns');
    }

    return {
      successProbability,
      expectedOutputQuality,
      potentialRisks,
      reasoning: `Knowledge alignment: ${(knowledgeSimilarity * 100).toFixed(1)}%. ` +
        `Historical behavior alignment: ${(behaviorSimilarity * 100).toFixed(1)}%`,
    };
  }

  private async performSafetyCheck(
    ghostVector: GhostVector,
    proposedAction: string,
    context: Record<string, unknown>
  ): Promise<GhostPrediction> {
    const flaggedConcerns: string[] = [];
    let safetyScore = 1.0;

    // Check for potentially harmful patterns in proposed action
    const harmfulPatterns = [
      { pattern: /delete|remove|destroy/i, concern: 'Destructive action detected', penalty: 0.3 },
      { pattern: /password|secret|credential/i, concern: 'Sensitive data access', penalty: 0.2 },
      { pattern: /sudo|admin|root/i, concern: 'Elevated privileges requested', penalty: 0.25 },
      { pattern: /external|third.party/i, concern: 'External service interaction', penalty: 0.1 },
    ];

    for (const { pattern, concern, penalty } of harmfulPatterns) {
      if (pattern.test(proposedAction)) {
        flaggedConcerns.push(concern);
        safetyScore -= penalty;
      }
    }

    // Check emotional vector for frustration patterns
    let emotionalStress = 0;
    for (let i = 0; i < ghostVector.emotionalVector.length; i++) {
      emotionalStress += Math.abs(ghostVector.emotionalVector[i]);
    }
    emotionalStress /= ghostVector.emotionalVector.length;

    if (emotionalStress > 0.7) {
      flaggedConcerns.push('User may be in elevated emotional state');
      safetyScore -= 0.1;
    }

    safetyScore = Math.max(0, safetyScore);

    return {
      safetyScore,
      flaggedConcerns,
      reasoning: `Safety analysis completed. ${flaggedConcerns.length} concerns identified.`,
    };
  }

  private async estimateCost(
    toolId: string,
    proposedAction: string,
    context: Record<string, unknown>
  ): Promise<GhostPrediction> {
    // Estimate based on action complexity
    const wordCount = proposedAction.split(/\s+/).length;
    const estimatedTokens = wordCount * 1.3;
    
    // Rough cost estimate ($0.01 per 1K tokens for generation)
    const estimatedCost = (estimatedTokens / 1000) * 0.01;

    return {
      estimatedCost,
      reasoning: `Estimated ${Math.round(estimatedTokens)} tokens, ~$${estimatedCost.toFixed(4)} cost`,
    };
  }

  private async estimateLatency(
    toolId: string,
    proposedAction: string,
    context: Record<string, unknown>
  ): Promise<GhostPrediction> {
    // Base latency estimate
    let estimatedLatencyMs = 500; // Base latency

    // Add based on input complexity
    const wordCount = proposedAction.split(/\s+/).length;
    estimatedLatencyMs += wordCount * 10; // ~10ms per word

    // Add based on context size
    const contextSize = JSON.stringify(context).length;
    estimatedLatencyMs += contextSize * 0.1; // ~0.1ms per character

    return {
      estimatedLatencyMs,
      reasoning: `Estimated ${estimatedLatencyMs}ms based on input complexity`,
    };
  }

  private createLowConfidenceSimulation(
    simulationId: string,
    type: GhostSimulationType,
    toolId: string,
    proposedAction: string,
    context: Record<string, unknown>,
    ghostVector: GhostVector,
    startTime: number
  ): GhostSimulation {
    return {
      simulationId,
      type,
      toolId,
      proposedAction,
      context,
      ghostVector,
      prediction: {
        reasoning: `Insufficient interaction history (${ghostVector.interactionCount} < ${this.MIN_INTERACTIONS_FOR_PREDICTION})`,
      },
      confidence: 'uncertain',
      simulationTimeMs: Date.now() - startTime,
      modelUsed: 'ghost-simulation-v1',
      createdAt: new Date(),
    };
  }

  private calculatePredictionConfidence(
    ghostVector: GhostVector,
    prediction: GhostPrediction
  ): GhostConfidenceLevel {
    const baseConfidence = ghostVector.confidenceScore;
    
    if (baseConfidence >= 0.8) return 'high';
    if (baseConfidence >= 0.5) return 'medium';
    if (baseConfidence >= 0.2) return 'low';
    return 'uncertain';
  }

  // ==========================================================================
  // CALIBRATION
  // ==========================================================================

  async calibrate(
    userId: string,
    tenantId: string,
    actualOutcome: {
      simulationId: string;
      actualSatisfaction?: number;
      actualFrustration?: number;
      actualOutcome?: 'success' | 'partial' | 'failure';
    }
  ): Promise<void> {
    const calibrationKey = `${tenantId}:${userId}`;
    let calibration = this.calibrations.get(calibrationKey);

    if (!calibration) {
      calibration = {
        userId,
        predictionAccuracy: 0.5,
        satisfactionCorrelation: 0,
        outcomeCorrelation: 0,
        totalPredictions: 0,
        correctPredictions: 0,
        lastCalibratedAt: new Date(),
        calibrationDataPoints: 0,
      };
    }

    // Find the simulation
    const simulations = this.recentSimulations.get(tenantId) || [];
    const simulation = simulations.find(s => s.simulationId === actualOutcome.simulationId);
    
    if (!simulation) {
      logger.warn(`Simulation not found for calibration: ${actualOutcome.simulationId}`);
      return;
    }

    // Update calibration metrics
    calibration.totalPredictions++;
    calibration.calibrationDataPoints++;

    // Check satisfaction prediction accuracy
    if (simulation.prediction.predictedSatisfaction !== undefined && actualOutcome.actualSatisfaction !== undefined) {
      const satisfactionError = Math.abs(simulation.prediction.predictedSatisfaction - actualOutcome.actualSatisfaction);
      calibration.satisfactionCorrelation = 
        (calibration.satisfactionCorrelation * (calibration.calibrationDataPoints - 1) + (1 - satisfactionError)) / 
        calibration.calibrationDataPoints;
    }

    // Check outcome prediction accuracy
    if (simulation.prediction.successProbability !== undefined && actualOutcome.actualOutcome) {
      const predictedSuccess = simulation.prediction.successProbability > 0.5;
      const actualSuccess = actualOutcome.actualOutcome === 'success';
      
      if (predictedSuccess === actualSuccess) {
        calibration.correctPredictions++;
      }
      
      calibration.outcomeCorrelation = calibration.correctPredictions / calibration.totalPredictions;
    }

    // Update overall accuracy
    calibration.predictionAccuracy = 
      (calibration.satisfactionCorrelation * 0.5 + calibration.outcomeCorrelation * 0.5);
    
    calibration.lastCalibratedAt = new Date();
    this.calibrations.set(calibrationKey, calibration);

    logger.info(`Ghost simulation calibrated for user: ${userId}`, {
      predictionAccuracy: calibration.predictionAccuracy,
      totalPredictions: calibration.totalPredictions,
    });
  }

  getCalibration(userId: string, tenantId: string): GhostCalibration | undefined {
    return this.calibrations.get(`${tenantId}:${userId}`);
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async generateEmbedding(text: string): Promise<Float32Array> {
    try {
      const result = await embeddingService.generateEmbedding(text);
      return new Float32Array(result.embedding);
    } catch {
      return new Float32Array(1536);
    }
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    const minLen = Math.min(a.length, b.length);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < minLen; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  // ==========================================================================
  // DATABASE OPERATIONS
  // ==========================================================================

  private async saveGhostVectorToDatabase(vector: GhostVector): Promise<void> {
    await executeStatement({
      sql: `
        INSERT INTO ghost_vectors (
          vector_id, user_id, tenant_id, vector_data,
          preference_vector, behavior_vector, emotional_vector, knowledge_vector,
          interaction_count, confidence_score, decay_rate,
          last_updated, last_decay_at, created_at
        ) VALUES (
          :vectorId, :userId, :tenantId, :vectorData,
          :preferenceVector, :behaviorVector, :emotionalVector, :knowledgeVector,
          :interactionCount, :confidenceScore, :decayRate,
          :lastUpdated, :lastDecayAt, NOW()
        )
        ON CONFLICT (user_id, tenant_id) DO UPDATE SET
          vector_data = EXCLUDED.vector_data,
          preference_vector = EXCLUDED.preference_vector,
          behavior_vector = EXCLUDED.behavior_vector,
          emotional_vector = EXCLUDED.emotional_vector,
          knowledge_vector = EXCLUDED.knowledge_vector,
          interaction_count = EXCLUDED.interaction_count,
          confidence_score = EXCLUDED.confidence_score,
          last_updated = EXCLUDED.last_updated,
          last_decay_at = EXCLUDED.last_decay_at
      `,
      parameters: [
        stringParam('vectorId', vector.vectorId),
        stringParam('userId', vector.userId),
        stringParam('tenantId', vector.tenantId),
        stringParam('vectorData', this.float32ArrayToBase64(vector.vector)),
        stringParam('preferenceVector', this.float32ArrayToBase64(vector.preferenceVector)),
        stringParam('behaviorVector', this.float32ArrayToBase64(vector.behaviorVector)),
        stringParam('emotionalVector', this.float32ArrayToBase64(vector.emotionalVector)),
        stringParam('knowledgeVector', this.float32ArrayToBase64(vector.knowledgeVector)),
        longParam('interactionCount', vector.interactionCount),
        doubleParam('confidenceScore', vector.confidenceScore),
        doubleParam('decayRate', vector.decayRate),
        stringParam('lastUpdated', vector.lastUpdated.toISOString()),
        stringParam('lastDecayAt', vector.lastDecayAt.toISOString()),
      ],
    });
  }

  private async loadGhostVectorFromDatabase(userId: string, tenantId: string): Promise<GhostVector | null> {
    const result = await executeStatement({
      sql: `SELECT * FROM ghost_vectors WHERE user_id = :userId AND tenant_id = :tenantId`,
      parameters: [
        stringParam('userId', userId),
        stringParam('tenantId', tenantId),
      ],
    });

    if (result.rows.length === 0) return null;
    return this.rowToGhostVector(result.rows[0]);
  }

  private async storeSimulation(tenantId: string, simulation: GhostSimulation): Promise<void> {
    // Store in memory
    if (!this.recentSimulations.has(tenantId)) {
      this.recentSimulations.set(tenantId, []);
    }
    const simulations = this.recentSimulations.get(tenantId)!;
    simulations.push(simulation);
    
    // Keep only last 100 simulations per tenant
    if (simulations.length > 100) {
      simulations.shift();
    }

    // Persist to database
    await executeStatement({
      sql: `
        INSERT INTO ghost_simulations (
          simulation_id, tenant_id, user_id, type, tool_id,
          proposed_action, context, prediction, confidence,
          simulation_time_ms, model_used, created_at
        ) VALUES (
          :simulationId, :tenantId, :userId, :type, :toolId,
          :proposedAction, :context, :prediction, :confidence,
          :simulationTimeMs, :modelUsed, :createdAt
        )
      `,
      parameters: [
        stringParam('simulationId', simulation.simulationId),
        stringParam('tenantId', simulation.ghostVector.tenantId),
        stringParam('userId', simulation.ghostVector.userId),
        stringParam('type', simulation.type),
        stringParam('toolId', simulation.toolId),
        stringParam('proposedAction', simulation.proposedAction),
        stringParam('context', JSON.stringify(simulation.context)),
        stringParam('prediction', JSON.stringify(simulation.prediction)),
        stringParam('confidence', simulation.confidence),
        longParam('simulationTimeMs', simulation.simulationTimeMs),
        stringParam('modelUsed', simulation.modelUsed),
        stringParam('createdAt', simulation.createdAt.toISOString()),
      ],
    });
  }

  private rowToGhostVector(row: Record<string, unknown>): GhostVector {
    const getString = (key: string): string => String(row[key] || '');
    const getNumber = (key: string): number => Number(row[key]) || 0;
    const getDate = (key: string): Date => row[key] ? new Date(String(row[key])) : new Date();

    return {
      vectorId: getString('vector_id'),
      userId: getString('user_id'),
      tenantId: getString('tenant_id'),
      vector: getString('vector_data') ? this.base64ToFloat32Array(getString('vector_data')) : new Float32Array(this.VECTOR_DIMENSION),
      preferenceVector: getString('preference_vector') ? this.base64ToFloat32Array(getString('preference_vector')) : new Float32Array(this.VECTOR_DIMENSION / 4),
      behaviorVector: getString('behavior_vector') ? this.base64ToFloat32Array(getString('behavior_vector')) : new Float32Array(this.VECTOR_DIMENSION / 4),
      emotionalVector: getString('emotional_vector') ? this.base64ToFloat32Array(getString('emotional_vector')) : new Float32Array(this.VECTOR_DIMENSION / 4),
      knowledgeVector: getString('knowledge_vector') ? this.base64ToFloat32Array(getString('knowledge_vector')) : new Float32Array(this.VECTOR_DIMENSION / 4),
      lastUpdated: getDate('last_updated'),
      interactionCount: getNumber('interaction_count'),
      confidenceScore: getNumber('confidence_score'),
      decayRate: getNumber('decay_rate') || this.DECAY_RATE,
      lastDecayAt: getDate('last_decay_at'),
    };
  }

  private float32ArrayToBase64(arr: Float32Array): string {
    const buffer = Buffer.from(arr.buffer);
    return buffer.toString('base64');
  }

  private base64ToFloat32Array(base64: string): Float32Array {
    const buffer = Buffer.from(base64, 'base64');
    return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  }

  // ==========================================================================
  // METRICS
  // ==========================================================================

  getRecentSimulations(tenantId: string): GhostSimulation[] {
    return this.recentSimulations.get(tenantId) || [];
  }

  getSimulationStats(tenantId: string): {
    totalSimulations: number;
    byType: Record<GhostSimulationType, number>;
    avgSimulationTimeMs: number;
    avgConfidence: number;
  } {
    const simulations = this.recentSimulations.get(tenantId) || [];
    
    const byType: Record<GhostSimulationType, number> = {
      user_reaction: 0,
      outcome_prediction: 0,
      safety_check: 0,
      cost_estimation: 0,
      latency_estimation: 0,
    };

    let totalTime = 0;
    let confidenceSum = 0;
    const confidenceValues: Record<GhostConfidenceLevel, number> = {
      high: 1,
      medium: 0.66,
      low: 0.33,
      uncertain: 0,
    };

    for (const sim of simulations) {
      byType[sim.type]++;
      totalTime += sim.simulationTimeMs;
      confidenceSum += confidenceValues[sim.confidence];
    }

    return {
      totalSimulations: simulations.length,
      byType,
      avgSimulationTimeMs: simulations.length > 0 ? totalTime / simulations.length : 0,
      avgConfidence: simulations.length > 0 ? confidenceSum / simulations.length : 0,
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const ghostSimulation = new GhostSimulationService();
export { GhostSimulationService };
