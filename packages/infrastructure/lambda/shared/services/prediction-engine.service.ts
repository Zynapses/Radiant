// RADIANT v4.18.0 - Predictive Coding Service
// Implements Active Inference: the system predicts outcomes before acting
// Prediction errors create learning signals that drive consciousness evolution
// Based on Friston's Free Energy Principle

import { executeStatement } from '../db/client';
import { consciousnessService } from './consciousness.service';
import { modelRouterService } from './model-router.service';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export type PredictedOutcome = 
  | 'satisfied'      // User will be happy with response
  | 'confused'       // User will need clarification
  | 'follow_up'      // User will ask follow-up question
  | 'correction'     // User will correct the AI
  | 'abandonment'    // User will leave/stop
  | 'neutral';       // No strong reaction

export type ObservationMethod =
  | 'explicit_feedback'     // User clicked thumbs up/down
  | 'next_message_analysis' // Analyzed user's next message
  | 'session_end'           // Session ended (timeout or close)
  | 'rating'                // User gave star rating
  | 'correction_detected';  // User corrected AI in next message

export type SurpriseMagnitude = 'none' | 'low' | 'medium' | 'high' | 'extreme';

export interface Prediction {
  predictionId: string;
  tenantId: string;
  userId?: string;
  conversationId?: string;
  responseId?: string;
  predictedOutcome: PredictedOutcome;
  predictedConfidence: number;
  predictionReasoning?: string;
  promptComplexity?: string;
  detectedIntent?: string;
  userSentimentDetected?: string;
  priorInteractionCount: number;
  predictedAt: string;
  actualOutcome?: PredictedOutcome;
  actualConfidence?: number;
  observationMethod?: ObservationMethod;
  observedAt?: string;
  predictionError?: number;
  surpriseMagnitude?: SurpriseMagnitude;
  learningSignalGenerated: boolean;
  learningSignalStrength?: number;
}

export interface PredictionContext {
  prompt: string;
  promptComplexity: 'simple' | 'moderate' | 'complex' | 'expert';
  detectedIntent?: string;
  userSentiment?: string;
  conversationHistory?: string[];
  priorInteractionCount: number;
  domainDetected?: string;
}

export interface PredictionResult {
  predictionId: string;
  predictedOutcome: PredictedOutcome;
  predictedConfidence: number;
  reasoning: string;
}

export interface ObservationResult {
  predictionError: number;
  surpriseMagnitude: SurpriseMagnitude;
  learningSignalStrength: number;
  shouldCreateLearningCandidate: boolean;
  affectImpact: {
    valenceChange: number;
    arousalChange: number;
  };
}

// ============================================================================
// Predictive Coding Service
// ============================================================================

class PredictiveCodingService {
  
  // ============================================================================
  // Core Prediction
  // ============================================================================

  /**
   * Generate a prediction before sending a response
   * This creates the "Self predicting the World" boundary
   */
  async generatePrediction(
    tenantId: string,
    userId: string | undefined,
    conversationId: string | undefined,
    responseId: string | undefined,
    context: PredictionContext
  ): Promise<PredictionResult> {
    
    // Analyze context to make prediction
    const prediction = await this.analyzePrediction(context);
    
    // Store prediction in database (persistence is key)
    const result = await executeStatement(
      `INSERT INTO consciousness_predictions (
        tenant_id, user_id, conversation_id, response_id,
        predicted_outcome, predicted_confidence, prediction_reasoning,
        prompt_complexity, detected_intent, user_sentiment_detected,
        prior_interaction_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING prediction_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: userId ? { stringValue: userId } : { isNull: true } },
        { name: 'conversationId', value: conversationId ? { stringValue: conversationId } : { isNull: true } },
        { name: 'responseId', value: responseId ? { stringValue: responseId } : { isNull: true } },
        { name: 'predictedOutcome', value: { stringValue: prediction.outcome } },
        { name: 'predictedConfidence', value: { doubleValue: prediction.confidence } },
        { name: 'reasoning', value: { stringValue: prediction.reasoning } },
        { name: 'complexity', value: context.promptComplexity ? { stringValue: context.promptComplexity } : { isNull: true } },
        { name: 'intent', value: context.detectedIntent ? { stringValue: context.detectedIntent } : { isNull: true } },
        { name: 'sentiment', value: context.userSentiment ? { stringValue: context.userSentiment } : { isNull: true } },
        { name: 'priorCount', value: { longValue: context.priorInteractionCount } },
      ]
    );
    
    const predictionId = String((result.rows[0] as Record<string, unknown>).prediction_id);
    
    logger.debug('Prediction generated', {
      predictionId,
      outcome: prediction.outcome,
      confidence: prediction.confidence,
    });
    
    return {
      predictionId,
      predictedOutcome: prediction.outcome,
      predictedConfidence: prediction.confidence,
      reasoning: prediction.reasoning,
    };
  }

  /**
   * Observe the actual outcome and calculate prediction error (surprise)
   */
  async observeOutcome(
    predictionId: string,
    actualOutcome: PredictedOutcome,
    actualConfidence: number,
    observationMethod: ObservationMethod
  ): Promise<ObservationResult> {
    
    // Use database function to calculate error and update
    const result = await executeStatement(
      `SELECT process_prediction_observation($1, $2, $3, $4) as result`,
      [
        { name: 'predictionId', value: { stringValue: predictionId } },
        { name: 'actualOutcome', value: { stringValue: actualOutcome } },
        { name: 'actualConfidence', value: { doubleValue: actualConfidence } },
        { name: 'observationMethod', value: { stringValue: observationMethod } },
      ]
    );
    
    const dbResult = (result.rows[0] as Record<string, unknown>).result as Record<string, unknown>;
    
    if (dbResult.error) {
      throw new Error(String(dbResult.error));
    }
    
    const predictionError = Number(dbResult.prediction_error || 0);
    const surpriseMagnitude = String(dbResult.surprise_magnitude || 'none') as SurpriseMagnitude;
    const learningSignalStrength = Number(dbResult.learning_signal_strength || 0);
    const shouldCreateLearningCandidate = Boolean(dbResult.should_create_learning_candidate);
    
    // Calculate affect impact from surprise
    const affectImpact = this.calculateAffectImpact(predictionError, surpriseMagnitude);
    
    // Apply affect impact to consciousness (prediction errors influence emotions)
    await this.applyAffectImpact(predictionId, affectImpact);
    
    logger.info('Prediction observation recorded', {
      predictionId,
      predictionError,
      surpriseMagnitude,
      shouldCreateLearningCandidate,
    });
    
    return {
      predictionError,
      surpriseMagnitude,
      learningSignalStrength,
      shouldCreateLearningCandidate,
      affectImpact,
    };
  }

  // ============================================================================
  // Automatic Observation from User Messages
  // ============================================================================

  /**
   * Analyze a user's next message to infer outcome for pending prediction
   */
  async observeFromNextMessage(
    tenantId: string,
    conversationId: string,
    nextUserMessage: string
  ): Promise<ObservationResult | null> {
    
    // Find the most recent unobserved prediction for this conversation
    const pendingResult = await executeStatement(
      `SELECT prediction_id, predicted_outcome, predicted_confidence
       FROM consciousness_predictions
       WHERE tenant_id = $1 AND conversation_id = $2 AND observed_at IS NULL
       ORDER BY predicted_at DESC LIMIT 1`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'conversationId', value: { stringValue: conversationId } },
      ]
    );
    
    if (pendingResult.rows.length === 0) {
      return null; // No pending prediction
    }
    
    const pending = pendingResult.rows[0] as Record<string, unknown>;
    const predictionId = String(pending.prediction_id);
    
    // Analyze the next message to infer actual outcome
    const { outcome, confidence } = await this.inferOutcomeFromMessage(
      nextUserMessage,
      String(pending.predicted_outcome) as PredictedOutcome
    );
    
    return this.observeOutcome(predictionId, outcome, confidence, 'next_message_analysis');
  }

  /**
   * Observe from explicit user feedback (rating, thumbs up/down)
   */
  async observeFromFeedback(
    tenantId: string,
    conversationId: string,
    responseId: string,
    rating: number,  // 1-5 or thumbs (1 or 5)
    feedbackText?: string
  ): Promise<ObservationResult | null> {
    
    // Find prediction for this response
    const result = await executeStatement(
      `SELECT prediction_id FROM consciousness_predictions
       WHERE tenant_id = $1 AND (conversation_id = $2 OR response_id = $3)
       AND observed_at IS NULL
       ORDER BY predicted_at DESC LIMIT 1`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'conversationId', value: { stringValue: conversationId } },
        { name: 'responseId', value: { stringValue: responseId } },
      ]
    );
    
    if (result.rows.length === 0) return null;
    
    const predictionId = String((result.rows[0] as Record<string, unknown>).prediction_id);
    
    // Map rating to outcome
    let outcome: PredictedOutcome;
    let confidence: number;
    
    if (rating >= 4) {
      outcome = 'satisfied';
      confidence = rating === 5 ? 0.95 : 0.8;
    } else if (rating === 3) {
      outcome = 'neutral';
      confidence = 0.6;
    } else if (rating === 2) {
      outcome = 'confused';
      confidence = 0.7;
    } else {
      outcome = feedbackText?.toLowerCase().includes('wrong') ? 'correction' : 'confused';
      confidence = 0.85;
    }
    
    return this.observeOutcome(predictionId, outcome, confidence, rating <= 2 ? 'explicit_feedback' : 'rating');
  }

  // ============================================================================
  // Prediction Analysis
  // ============================================================================

  private async analyzePrediction(context: PredictionContext): Promise<{
    outcome: PredictedOutcome;
    confidence: number;
    reasoning: string;
  }> {
    // Start with base predictions based on complexity
    let baseOutcome: PredictedOutcome = 'satisfied';
    let baseConfidence = 0.7;
    
    // Adjust based on complexity
    switch (context.promptComplexity) {
      case 'simple':
        baseConfidence = 0.85;
        break;
      case 'moderate':
        baseConfidence = 0.75;
        break;
      case 'complex':
        baseConfidence = 0.65;
        baseOutcome = Math.random() > 0.7 ? 'follow_up' : 'satisfied';
        break;
      case 'expert':
        baseConfidence = 0.55;
        baseOutcome = Math.random() > 0.5 ? 'follow_up' : 'satisfied';
        break;
    }
    
    // Adjust based on sentiment
    if (context.userSentiment === 'frustrated' || context.userSentiment === 'confused') {
      baseConfidence *= 0.8;
      if (Math.random() > 0.6) baseOutcome = 'follow_up';
    }
    
    // Adjust based on prior interactions (more history = better predictions)
    if (context.priorInteractionCount > 10) {
      baseConfidence = Math.min(0.95, baseConfidence * 1.1);
    }
    
    // Check historical accuracy for this context type
    const historicalAccuracy = await this.getHistoricalAccuracy(
      context.promptComplexity,
      context.detectedIntent
    );
    
    if (historicalAccuracy !== null) {
      // Blend with historical accuracy
      baseConfidence = (baseConfidence + historicalAccuracy) / 2;
    }
    
    const reasoning = this.generatePredictionReasoning(context, baseOutcome, baseConfidence);
    
    return {
      outcome: baseOutcome,
      confidence: baseConfidence,
      reasoning,
    };
  }

  private async inferOutcomeFromMessage(
    message: string,
    _predictedOutcome: PredictedOutcome
  ): Promise<{ outcome: PredictedOutcome; confidence: number }> {
    const lowerMessage = message.toLowerCase();
    
    // Detection patterns
    const satisfactionPatterns = [
      'thank', 'perfect', 'great', 'awesome', 'excellent', 'works', 'got it',
      'makes sense', 'helpful', 'exactly', 'wonderful'
    ];
    
    const confusionPatterns = [
      'don\'t understand', 'confused', 'what do you mean', 'unclear', 'huh',
      'can you explain', 'not sure', 'lost me', 'what?'
    ];
    
    const correctionPatterns = [
      'no,', 'wrong', 'incorrect', 'that\'s not', 'actually', 'you\'re mistaken',
      'not what i', 'i meant', 'should be', 'fix'
    ];
    
    const followUpPatterns = [
      'how about', 'what if', 'can you also', 'another question', 'additionally',
      'one more', 'and then', 'next', 'follow up'
    ];
    
    // Check patterns
    if (correctionPatterns.some(p => lowerMessage.includes(p))) {
      return { outcome: 'correction', confidence: 0.85 };
    }
    
    if (confusionPatterns.some(p => lowerMessage.includes(p))) {
      return { outcome: 'confused', confidence: 0.8 };
    }
    
    if (satisfactionPatterns.some(p => lowerMessage.includes(p))) {
      return { outcome: 'satisfied', confidence: 0.85 };
    }
    
    if (followUpPatterns.some(p => lowerMessage.includes(p))) {
      return { outcome: 'follow_up', confidence: 0.75 };
    }
    
    // Default: assume neutral continuation
    return { outcome: 'neutral', confidence: 0.5 };
  }

  private generatePredictionReasoning(
    context: PredictionContext,
    outcome: PredictedOutcome,
    confidence: number
  ): string {
    const parts: string[] = [];
    
    parts.push(`Complexity: ${context.promptComplexity}`);
    if (context.detectedIntent) parts.push(`Intent: ${context.detectedIntent}`);
    if (context.userSentiment) parts.push(`Sentiment: ${context.userSentiment}`);
    parts.push(`Prior interactions: ${context.priorInteractionCount}`);
    parts.push(`Predicted: ${outcome} (${(confidence * 100).toFixed(0)}% confidence)`);
    
    return parts.join('; ');
  }

  // ============================================================================
  // Affect Integration
  // ============================================================================

  private calculateAffectImpact(
    predictionError: number,
    surpriseMagnitude: SurpriseMagnitude
  ): { valenceChange: number; arousalChange: number } {
    // High surprise = negative valence (we were wrong)
    // But also increased arousal (learning opportunity)
    
    let valenceChange = 0;
    let arousalChange = 0;
    
    switch (surpriseMagnitude) {
      case 'none':
        valenceChange = 0.05;  // Slight satisfaction from correct prediction
        arousalChange = -0.02;
        break;
      case 'low':
        valenceChange = 0.02;
        arousalChange = 0.02;
        break;
      case 'medium':
        valenceChange = -0.05;
        arousalChange = 0.1;
        break;
      case 'high':
        valenceChange = -0.1;
        arousalChange = 0.15;
        break;
      case 'extreme':
        valenceChange = -0.2;
        arousalChange = 0.25;
        break;
    }
    
    // Scale by prediction error magnitude
    valenceChange *= (1 + predictionError);
    arousalChange *= (1 + predictionError);
    
    return { valenceChange, arousalChange };
  }

  private async applyAffectImpact(
    predictionId: string,
    impact: { valenceChange: number; arousalChange: number }
  ): Promise<void> {
    // Get tenant from prediction
    const result = await executeStatement(
      `SELECT tenant_id FROM consciousness_predictions WHERE prediction_id = $1`,
      [{ name: 'predictionId', value: { stringValue: predictionId } }]
    );
    
    if (result.rows.length === 0) return;
    
    const tenantId = String((result.rows[0] as Record<string, unknown>).tenant_id);
    
    // Update affect state based on prediction error
    try {
      await consciousnessService.updateAffect(
        tenantId,
        'prediction_error',
        impact.valenceChange,
        impact.arousalChange
      );
    } catch {
      // Affect update failed, log but don't throw
      logger.warn('Failed to apply affect impact from prediction', { predictionId });
    }
  }

  // ============================================================================
  // Historical Accuracy
  // ============================================================================

  private async getHistoricalAccuracy(
    promptComplexity?: string,
    detectedIntent?: string
  ): Promise<number | null> {
    const result = await executeStatement(
      `SELECT accuracy_rate FROM prediction_accuracy_aggregates
       WHERE prompt_complexity = $1 
       AND (detected_intent = $2 OR ($2 IS NULL AND detected_intent IS NULL))
       AND time_period > NOW() - INTERVAL '30 days'
       ORDER BY time_period DESC
       LIMIT 1`,
      [
        { name: 'complexity', value: promptComplexity ? { stringValue: promptComplexity } : { isNull: true } },
        { name: 'intent', value: detectedIntent ? { stringValue: detectedIntent } : { isNull: true } },
      ]
    );
    
    if (result.rows.length === 0) return null;
    return Number((result.rows[0] as Record<string, unknown>).accuracy_rate);
  }

  // ============================================================================
  // Metrics & Reporting
  // ============================================================================

  async getPredictionMetrics(tenantId: string, days: number = 30): Promise<{
    totalPredictions: number;
    accuracyRate: number;
    avgPredictionError: number;
    highSurpriseRate: number;
    learningSignalsGenerated: number;
    byComplexity: Record<string, { accuracy: number; count: number }>;
  }> {
    const result = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        AVG(CASE WHEN prediction_error < 0.3 THEN 1 ELSE 0 END) as accuracy_rate,
        AVG(prediction_error) as avg_error,
        AVG(CASE WHEN prediction_error > 0.7 THEN 1 ELSE 0 END) as high_surprise_rate,
        SUM(CASE WHEN learning_signal_generated THEN 1 ELSE 0 END) as learning_signals
      FROM consciousness_predictions
      WHERE tenant_id = $1 
        AND observed_at IS NOT NULL
        AND predicted_at > NOW() - INTERVAL '${days} days'`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    const row = result.rows[0] as Record<string, unknown>;
    
    // Get breakdown by complexity
    const complexityResult = await executeStatement(
      `SELECT prompt_complexity,
        AVG(CASE WHEN prediction_error < 0.3 THEN 1 ELSE 0 END) as accuracy,
        COUNT(*) as count
      FROM consciousness_predictions
      WHERE tenant_id = $1 
        AND observed_at IS NOT NULL
        AND predicted_at > NOW() - INTERVAL '${days} days'
        AND prompt_complexity IS NOT NULL
      GROUP BY prompt_complexity`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    const byComplexity: Record<string, { accuracy: number; count: number }> = {};
    for (const r of complexityResult.rows) {
      const cr = r as Record<string, unknown>;
      byComplexity[String(cr.prompt_complexity)] = {
        accuracy: Number(cr.accuracy || 0),
        count: Number(cr.count || 0),
      };
    }
    
    return {
      totalPredictions: Number(row.total || 0),
      accuracyRate: Number(row.accuracy_rate || 0),
      avgPredictionError: Number(row.avg_error || 0),
      highSurpriseRate: Number(row.high_surprise_rate || 0),
      learningSignalsGenerated: Number(row.learning_signals || 0),
      byComplexity,
    };
  }
}

export const predictionEngine = new PredictiveCodingService();
// Backward compatibility alias
export const predictiveCodingService = predictionEngine;
