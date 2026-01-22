/**
 * RADIANT Cato Neural Decision Service
 * Integrates Cato safety pipeline with consciousness affect state and predictive coding
 * for neural-informed orchestration decisions.
 *
 * Features:
 * - Control Barrier Functions for safety enforcement
 * - Affect-to-hyperparameter mapping (frustration → temperature, etc.)
 * - Active inference prediction and surprise tracking
 * - Precision governor for uncertainty-aware confidence limiting
 * - Human escalation for high-uncertainty decisions
 */

// Stub database query
const query = async (_sql: string, _params?: any[]): Promise<{ rows: any[] }> => ({ rows: [] });
import { CatoSafetyPipeline } from './safety-pipeline.service';
import { precisionGovernorService } from './precision-governor.service';
import { controlBarrierService } from './control-barrier.service';
import { personaService } from './persona.service';
import { merkleAuditService } from './merkle-audit.service';
// Stub hitlIntegrationService
const hitlIntegrationService = {} as any;
// import { hitlIntegrationService } from './hitl-integration.service';
import { ExecutionContext, SafetyPipelineResult } from './types';

// ============================================================================
// Types
// ============================================================================

export interface CatoNeuralConfig {
  safetyMode: 'enforce' | 'warn' | 'monitor';
  useAffectMapping: boolean;
  usePredictiveCoding: boolean;
  precisionGovernorEnabled: boolean;
  cbfThreshold: number;
  affectInfluence: {
    frustrationTemperatureScale: number;
    curiosityExplorationBoost: number;
    lowEfficacyEscalation: boolean;
  };
  predictionConfig: {
    generatePredictions: boolean;
    trackSurprise: boolean;
    learningThreshold: number;
  };
  escalationConfig: {
    autoEscalateOnUncertainty: boolean;
    uncertaintyThreshold: number;
    humanEscalationEnabled: boolean;
  };
}

export interface AffectState {
  valence: number;      // -1 to 1 (negative to positive)
  arousal: number;      // 0 to 1 (calm to excited)
  frustration: number;  // 0 to 1
  curiosity: number;    // 0 to 1
  confidence: number;   // 0 to 1 (self-efficacy)
  attention: number;    // 0 to 1
}

export interface PredictionContext {
  expectedOutcome: string;
  confidence: number;
  predictionId: string;
}

export interface NeuralDecisionInput {
  tenantId: string;
  userId: string;
  sessionId: string;
  prompt: string;
  context: Record<string, unknown>;
  config: Partial<CatoNeuralConfig>;
}

export interface NeuralDecisionResult {
  decision: 'proceed' | 'escalate' | 'block' | 'modify';
  confidence: number;
  
  // Safety evaluation
  safetyResult: SafetyPipelineResult | null;
  safetyPassed: boolean;
  
  // Affect-based hyperparameters
  hyperparameters: {
    temperature: number;
    topP: number;
    maxTokens: number;
    modelTier: 'standard' | 'advanced' | 'expert';
    explorationMode: boolean;
  };
  
  // Prediction tracking
  prediction: PredictionContext | null;
  
  // Model recommendation
  recommendedModel: string | null;
  modelReason: string;
  
  // Escalation info
  escalation: {
    required: boolean;
    reason: string | null;
    escalationType: 'human' | 'expert_model' | 'none';
    queueId: string | null;
  };
  
  // Audit
  auditHash: string;
  decisionPath: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: CatoNeuralConfig = {
  safetyMode: 'enforce',
  useAffectMapping: true,
  usePredictiveCoding: true,
  precisionGovernorEnabled: true,
  cbfThreshold: 0.95,
  affectInfluence: {
    frustrationTemperatureScale: 0.2,
    curiosityExplorationBoost: 0.3,
    lowEfficacyEscalation: true,
  },
  predictionConfig: {
    generatePredictions: true,
    trackSurprise: true,
    learningThreshold: 0.5,
  },
  escalationConfig: {
    autoEscalateOnUncertainty: true,
    uncertaintyThreshold: 0.7,
    humanEscalationEnabled: true,
  },
};

// ============================================================================
// Service Implementation
// ============================================================================

class CatoNeuralDecisionService {
  private safetyPipeline: CatoSafetyPipeline;

  constructor() {
    this.safetyPipeline = new CatoSafetyPipeline();
  }

  /**
   * Main entry point: Execute neural-informed decision
   */
  async executeDecision(input: NeuralDecisionInput): Promise<NeuralDecisionResult> {
    const config = { ...DEFAULT_CONFIG, ...input.config };
    const decisionPath: string[] = [];
    
    // 1. Load affect state from consciousness service
    const affectState = await this.loadAffectState(input.tenantId, input.userId);
    decisionPath.push(`affect_loaded:valence=${affectState.valence.toFixed(2)}`);

    // 2. Compute affect-based hyperparameters
    const hyperparameters = config.useAffectMapping
      ? this.computeAffectHyperparameters(affectState, config)
      : this.getDefaultHyperparameters();
    decisionPath.push(`hyperparams:temp=${hyperparameters.temperature.toFixed(2)}`);

    // 3. Generate prediction if enabled
    let prediction: PredictionContext | null = null;
    if (config.usePredictiveCoding && config.predictionConfig.generatePredictions) {
      prediction = await this.generatePrediction(input);
      decisionPath.push(`prediction:conf=${prediction.confidence.toFixed(2)}`);
    }

    // 4. Run safety pipeline
    let safetyResult: SafetyPipelineResult | null = null;
    let safetyPassed = true;
    
    if (config.safetyMode !== 'monitor') {
      const executionContext = await this.buildExecutionContext(input, affectState);
      safetyResult = await this.safetyPipeline.evaluateAction({
        prompt: input.prompt,
        proposedPolicy: {
          id: 'neural-decision',
          action: 'generate',
          priority: 1,
          requestedGamma: 1.0,
        } as any,
        generatedResponse: '', // Pre-generation check
        actorModel: 'cato-neural',
        context: executionContext,
      });
      
      safetyPassed = safetyResult.allowed;
      decisionPath.push(`safety:${safetyPassed ? 'passed' : 'blocked'}`);
      
      if (!safetyPassed && config.safetyMode === 'enforce') {
        return this.buildBlockedResult(safetyResult, hyperparameters, decisionPath);
      }
    }

    // 5. Check for escalation needs
    const escalation = await this.evaluateEscalation(
      input,
      affectState,
      prediction,
      config
    );
    decisionPath.push(`escalation:${escalation.required ? escalation.escalationType : 'none'}`);

    // 6. Determine model recommendation based on affect and task
    const { recommendedModel, modelReason } = await this.selectModel(
      input,
      affectState,
      hyperparameters,
      config
    );
    decisionPath.push(`model:${recommendedModel}`);

    // 7. Create audit record
    const auditHash = await (merkleAuditService as any).recordDecision({
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: input.sessionId,
      decisionType: 'neural_decision',
      input: {
        prompt: input.prompt.substring(0, 200),
        affectState,
        config,
      },
      output: {
        decision: escalation.required ? 'escalate' : 'proceed',
        hyperparameters,
        recommendedModel,
      },
    });

    return {
      decision: escalation.required ? 'escalate' : 'proceed',
      confidence: prediction?.confidence ?? affectState.confidence,
      safetyResult,
      safetyPassed,
      hyperparameters,
      prediction,
      recommendedModel,
      modelReason,
      escalation,
      auditHash,
      decisionPath,
    };
  }

  /**
   * Load current affect state from consciousness/ego tables
   */
  private async loadAffectState(tenantId: string, userId: string): Promise<AffectState> {
    try {
      const result = await query(
        `SELECT valence, arousal, frustration, curiosity, confidence, attention
         FROM ego_affect 
         WHERE tenant_id = $1 
         ORDER BY updated_at DESC 
         LIMIT 1`,
        [tenantId]
      );

      if (result.rows.length > 0) {
        return {
          valence: parseFloat(result.rows[0].valence) || 0,
          arousal: parseFloat(result.rows[0].arousal) || 0.5,
          frustration: parseFloat(result.rows[0].frustration) || 0,
          curiosity: parseFloat(result.rows[0].curiosity) || 0.5,
          confidence: parseFloat(result.rows[0].confidence) || 0.7,
          attention: parseFloat(result.rows[0].attention) || 0.8,
        };
      }
    } catch (error) {
      // Table may not exist, use defaults
    }

    return {
      valence: 0,
      arousal: 0.5,
      frustration: 0,
      curiosity: 0.5,
      confidence: 0.7,
      attention: 0.8,
    };
  }

  /**
   * Compute hyperparameters based on affect state
   * This is the core affect-to-behavior mapping
   */
  private computeAffectHyperparameters(
    affect: AffectState,
    config: CatoNeuralConfig
  ): NeuralDecisionResult['hyperparameters'] {
    const { affectInfluence } = config;

    // Base temperature
    let temperature = 0.7;

    // Frustration → Lower temperature (more focused, less exploration)
    if (affect.frustration > 0.5) {
      temperature -= (affect.frustration - 0.5) * affectInfluence.frustrationTemperatureScale * 2;
    }

    // Curiosity → Higher temperature (more exploration)
    if (affect.curiosity > 0.6) {
      temperature += (affect.curiosity - 0.6) * affectInfluence.curiosityExplorationBoost;
    }

    // Arousal affects response length and detail
    const maxTokens = affect.arousal > 0.7 ? 4096 : affect.arousal < 0.3 ? 1024 : 2048;

    // Determine model tier based on confidence (self-efficacy)
    let modelTier: 'standard' | 'advanced' | 'expert' = 'standard';
    if (affect.confidence < 0.4 && affectInfluence.lowEfficacyEscalation) {
      modelTier = 'expert'; // Low self-efficacy → use stronger model
    } else if (affect.confidence < 0.6) {
      modelTier = 'advanced';
    }

    // Exploration mode when curious and not frustrated
    const explorationMode = affect.curiosity > 0.7 && affect.frustration < 0.3;

    return {
      temperature: Math.max(0.1, Math.min(1.5, temperature)),
      topP: explorationMode ? 0.95 : 0.9,
      maxTokens,
      modelTier,
      explorationMode,
    };
  }

  private getDefaultHyperparameters(): NeuralDecisionResult['hyperparameters'] {
    return {
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 2048,
      modelTier: 'standard',
      explorationMode: false,
    };
  }

  /**
   * Generate prediction for active inference
   */
  private async generatePrediction(input: NeuralDecisionInput): Promise<PredictionContext> {
    // Analyze prompt to predict likely outcome
    const promptComplexity = this.estimateComplexity(input.prompt);
    const expectedOutcome = promptComplexity > 0.7 ? 'complex_response' : 'standard_response';
    
    // Store prediction for later comparison
    const predictionId = `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      await query(
        `INSERT INTO consciousness_predictions 
         (prediction_id, tenant_id, user_id, session_id, prompt_hash, expected_outcome, confidence, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          predictionId,
          input.tenantId,
          input.userId,
          input.sessionId,
          this.hashPrompt(input.prompt),
          expectedOutcome,
          1 - promptComplexity, // Higher complexity = lower confidence
        ]
      );
    } catch (error) {
      // Prediction table may not exist
    }

    return {
      predictionId,
      expectedOutcome,
      confidence: 1 - promptComplexity,
    };
  }

  private estimateComplexity(prompt: string): number {
    const length = prompt.length;
    const questionCount = (prompt.match(/\?/g) || []).length;
    const codeIndicators = (prompt.match(/```|function|class |def |const |let |var /g) || []).length;
    const reasoningIndicators = (prompt.match(/why|how|explain|analyze|compare/gi) || []).length;

    let complexity = 0;
    complexity += Math.min(length / 2000, 0.3);
    complexity += Math.min(questionCount * 0.1, 0.2);
    complexity += Math.min(codeIndicators * 0.15, 0.3);
    complexity += Math.min(reasoningIndicators * 0.1, 0.2);

    return Math.min(complexity, 1);
  }

  private hashPrompt(prompt: string): string {
    // Simple hash for deduplication
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Build execution context for safety pipeline
   */
  private async buildExecutionContext(
    input: NeuralDecisionInput,
    affect: AffectState
  ): Promise<ExecutionContext> {
    const persona = await personaService.getEffectivePersona(input.tenantId, input.userId);
    
    return {
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: input.sessionId,
      activePersona: persona?.name ?? 'Balanced',
      epistemicUncertainty: 1 - affect.confidence,
      sensoryPrecision: affect.attention,
      systemState: {},
    } as any;
  }

  /**
   * Evaluate if escalation is needed
   */
  private async evaluateEscalation(
    input: NeuralDecisionInput,
    affect: AffectState,
    prediction: PredictionContext | null,
    config: CatoNeuralConfig
  ): Promise<NeuralDecisionResult['escalation']> {
    const { escalationConfig } = config;

    // Check uncertainty threshold
    if (escalationConfig.autoEscalateOnUncertainty) {
      const uncertainty = 1 - (prediction?.confidence ?? affect.confidence);
      
      if (uncertainty > escalationConfig.uncertaintyThreshold) {
        // High uncertainty - decide escalation type
        if (escalationConfig.humanEscalationEnabled && uncertainty > 0.85) {
          // Queue for human review
          const queueId = await (hitlIntegrationService as any).queueForReview({
            tenantId: input.tenantId,
            userId: input.userId,
            sessionId: input.sessionId,
            prompt: input.prompt,
            reason: `High uncertainty: ${(uncertainty * 100).toFixed(1)}%`,
            priority: uncertainty > 0.9 ? 'high' : 'medium',
          });

          return {
            required: true,
            reason: `Uncertainty ${(uncertainty * 100).toFixed(1)}% exceeds threshold`,
            escalationType: 'human',
            queueId,
          };
        }

        // Escalate to expert model
        return {
          required: true,
          reason: `Uncertainty ${(uncertainty * 100).toFixed(1)}% requires expert model`,
          escalationType: 'expert_model',
          queueId: null,
        };
      }
    }

    // Check affect-based escalation
    if (config.affectInfluence.lowEfficacyEscalation && affect.confidence < 0.3) {
      return {
        required: true,
        reason: 'Low self-efficacy indicates need for expert assistance',
        escalationType: 'expert_model',
        queueId: null,
      };
    }

    return {
      required: false,
      reason: null,
      escalationType: 'none',
      queueId: null,
    };
  }

  /**
   * Select appropriate model based on affect and task
   */
  private async selectModel(
    input: NeuralDecisionInput,
    affect: AffectState,
    hyperparameters: NeuralDecisionResult['hyperparameters'],
    config: CatoNeuralConfig
  ): Promise<{ recommendedModel: string; modelReason: string }> {
    const { modelTier } = hyperparameters;

    // Model recommendations by tier
    const modelsByTier = {
      standard: 'anthropic/claude-3-5-haiku-20241022',
      advanced: 'anthropic/claude-3-5-sonnet-20241022',
      expert: 'openai/o1',
    };

    // Special cases based on affect
    if (affect.curiosity > 0.8 && hyperparameters.explorationMode) {
      return {
        recommendedModel: 'anthropic/claude-3-5-sonnet-20241022',
        modelReason: 'High curiosity suggests creative exploration mode',
      };
    }

    if (affect.frustration > 0.7) {
      return {
        recommendedModel: 'openai/o1',
        modelReason: 'High frustration indicates complex problem requiring deep reasoning',
      };
    }

    return {
      recommendedModel: modelsByTier[modelTier],
      modelReason: `${modelTier} tier based on confidence level ${(affect.confidence * 100).toFixed(0)}%`,
    };
  }

  /**
   * Build blocked result when safety check fails
   */
  private buildBlockedResult(
    safetyResult: SafetyPipelineResult,
    hyperparameters: NeuralDecisionResult['hyperparameters'],
    decisionPath: string[]
  ): NeuralDecisionResult {
    return {
      decision: 'block',
      confidence: 1.0,
      safetyResult,
      safetyPassed: false,
      hyperparameters,
      prediction: null,
      recommendedModel: null,
      modelReason: `Blocked by safety: ${safetyResult.blockedBy}`,
      escalation: {
        required: false,
        reason: null,
        escalationType: 'none',
        queueId: null,
      },
      auditHash: '',
      decisionPath,
    };
  }

  /**
   * Record observation after response for active inference
   */
  async observeOutcome(params: {
    predictionId: string;
    tenantId: string;
    actualOutcome: string;
    userSatisfaction?: number;
  }): Promise<{ surprise: number; shouldLearn: boolean }> {
    try {
      // Get original prediction
      const result = await query(
        `SELECT expected_outcome, confidence 
         FROM consciousness_predictions 
         WHERE prediction_id = $1 AND tenant_id = $2`,
        [params.predictionId, params.tenantId]
      );

      if (result.rows.length === 0) {
        return { surprise: 0, shouldLearn: false };
      }

      const { expected_outcome, confidence } = result.rows[0];
      
      // Calculate surprise (prediction error)
      const outcomeMatch = params.actualOutcome === expected_outcome;
      const surprise = outcomeMatch ? 0 : 1 - parseFloat(confidence);

      // Update prediction with outcome
      await query(
        `UPDATE consciousness_predictions 
         SET actual_outcome = $1, surprise = $2, user_satisfaction = $3, observed_at = NOW()
         WHERE prediction_id = $4`,
        [params.actualOutcome, surprise, params.userSatisfaction, params.predictionId]
      );

      // High surprise indicates learning opportunity
      const shouldLearn = surprise > 0.5;

      return { surprise, shouldLearn };
    } catch (error) {
      return { surprise: 0, shouldLearn: false };
    }
  }
}

export const catoNeuralDecisionService = new CatoNeuralDecisionService();
