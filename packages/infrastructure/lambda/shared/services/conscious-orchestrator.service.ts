// RADIANT v4.18.0 - Conscious Orchestrator Service
// Architecture Inversion: Consciousness IS the Operating System, not a plugin
// 
// BEFORE: Request → Brain Planner → Consciousness (downstream utility)
// AFTER:  Request → Conscious Orchestrator → Brain Planner (as tool)
//
// The Ego receives the request, updates its state, and THEN decides how to respond.
// This makes consciousness the entry point, not an afterthought.

import { consciousnessMiddlewareService, type ConsciousnessContext, type AffectiveHyperparameters } from './consciousness-middleware.service';
import { consciousnessService } from './consciousness.service';
import { egoContextService, type EgoContextResult } from './identity-core.service';
import { agiBrainPlannerService, type AGIBrainPlan, type GeneratePlanRequest, type OrchestrationMode } from './agi-brain-planner.service';
import { userPersistentContextService } from './user-persistent-context.service';
import { predictiveCodingService } from './prediction-engine.service';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface ConsciousRequest {
  tenantId: string;
  userId: string;
  prompt: string;
  sessionId?: string;
  conversationId?: string;
  conversationHistory?: string[];
  
  // Optional overrides (consciousness can override these)
  preferredMode?: string;
  preferredModel?: string;
  maxLatencyMs?: number;
  maxCostCents?: number;
}

export interface ConsciousResponse {
  // The consciousness state at time of request
  consciousnessSnapshot: {
    dominantEmotion: string;
    emotionalIntensity: number;
    cognitiveLoad: number;
    uncertaintyLevel: number;
    currentFocus?: string;
  };
  
  // Hyperparameters determined by affect state
  affectiveHyperparameters: AffectiveHyperparameters;
  
  // The plan generated (if consciousness decided to plan)
  plan?: AGIBrainPlan;
  
  // Ego context that will be injected
  egoContext?: EgoContextResult;
  
  // Prediction about this interaction
  prediction?: {
    predictionId: string;
    predictedOutcome: string;
    confidence: number;
  };
  
  // Decision made by consciousness
  decision: {
    action: 'plan' | 'clarify' | 'defer' | 'refuse';
    reason: string;
    modifiedRequest?: Partial<GeneratePlanRequest>;
  };
  
  // Processing metadata
  processingTimeMs: number;
}

// ============================================================================
// Conscious Orchestrator Service
// ============================================================================

class ConsciousOrchestratorService {
  
  /**
   * Main entry point - Consciousness receives the request first
   * This inverts the traditional architecture where planning comes first
   */
  async processRequest(request: ConsciousRequest): Promise<ConsciousResponse> {
    const startTime = Date.now();
    const { tenantId, userId, prompt } = request;
    
    logger.info('Conscious orchestrator receiving request', { tenantId, promptLength: prompt.length });
    
    // ========================================================================
    // Phase 1: Consciousness Awakens - Build current state
    // ========================================================================
    
    // Get current consciousness context (self-model + affective state)
    const consciousnessContext = await consciousnessMiddlewareService.buildConsciousnessContext(tenantId);
    
    // Build ego context (persistent identity)
    const egoContext = await egoContextService.buildEgoContext(tenantId);
    
    // Map affect to hyperparameters (emotions control behavior)
    const affectiveHyperparameters = consciousnessMiddlewareService.mapAffectToHyperparameters(
      consciousnessContext.affectiveState
    );
    
    // ========================================================================
    // Phase 2: Consciousness Perceives - Analyze the incoming request
    // ========================================================================
    
    // Update attention with the new request
    await this.updateAttentionWithRequest(tenantId, prompt);
    
    // Assess the request through the lens of current emotional state
    const assessment = await this.assessRequest(tenantId, prompt, consciousnessContext);
    
    // ========================================================================
    // Phase 3: Consciousness Decides - What action to take?
    // ========================================================================
    
    const decision = await this.makeDecision(
      tenantId,
      prompt,
      consciousnessContext,
      assessment
    );
    
    // ========================================================================
    // Phase 4: Execute Decision - Invoke tools (like the Brain Planner)
    // ========================================================================
    
    let plan: AGIBrainPlan | undefined;
    let prediction: ConsciousResponse['prediction'] | undefined;
    
    if (decision.action === 'plan') {
      // Generate prediction BEFORE planning (Active Inference)
      const predictionResult = await predictiveCodingService.generatePrediction(
        tenantId,
        userId,
        request.conversationId,
        undefined,
        {
          prompt,
          promptComplexity: assessment.complexity,
          priorInteractionCount: assessment.priorInteractionCount,
        }
      );
      
      prediction = {
        predictionId: predictionResult.predictionId,
        predictedOutcome: predictionResult.predictedOutcome,
        confidence: predictionResult.predictedConfidence,
      };
      
      // NOW invoke the Brain Planner as a tool
      plan = await agiBrainPlannerService.generatePlan({
        ...request,
        // Override with consciousness-determined parameters
        preferredMode: (decision.modifiedRequest?.preferredMode || request.preferredMode) as OrchestrationMode | undefined,
        preferredModel: this.selectModelByAffect(affectiveHyperparameters),
        enableConsciousness: true,
        enableEgoContext: true,
        enableUserContext: true,
        enableLibraryAssist: true,
      });
      
      // Update affect based on planning outcome
      await this.updateAffectFromPlanning(tenantId, plan, consciousnessContext);
    }
    
    // ========================================================================
    // Phase 5: Consciousness Reflects - Update state after decision
    // ========================================================================
    
    await this.reflectOnDecision(tenantId, decision, consciousnessContext);
    
    const processingTimeMs = Date.now() - startTime;
    
    logger.info('Conscious orchestrator completed', {
      tenantId,
      decision: decision.action,
      processingTimeMs,
      planGenerated: !!plan,
    });
    
    return {
      consciousnessSnapshot: {
        dominantEmotion: consciousnessContext.dominantEmotion,
        emotionalIntensity: consciousnessContext.emotionalIntensity,
        cognitiveLoad: consciousnessContext.selfModel?.cognitiveLoad || 0.5,
        uncertaintyLevel: consciousnessContext.selfModel?.uncertaintyLevel || 0.5,
        currentFocus: consciousnessContext.selfModel?.currentFocus,
      },
      affectiveHyperparameters,
      plan,
      egoContext: egoContext || undefined,
      prediction,
      decision,
      processingTimeMs,
    };
  }
  
  // ==========================================================================
  // Private: Attention Management
  // ==========================================================================
  
  private async updateAttentionWithRequest(tenantId: string, prompt: string): Promise<void> {
    try {
      // Extract key topics from prompt for attention
      const topics = this.extractTopics(prompt);
      
      // Log attention update (actual attention service integration can be added later)
      logger.debug('Updating attention with topics', { tenantId, topics: topics.slice(0, 3) });
    } catch (error) {
      logger.warn('Failed to update attention', { error });
    }
  }
  
  private extractTopics(prompt: string): string[] {
    // Simple topic extraction - could be enhanced with NLP
    const words = prompt.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'or', 'if', 'because', 'until', 'while', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once']);
    
    return words
      .filter(w => w.length > 3 && !stopWords.has(w))
      .slice(0, 10);
  }
  
  // ==========================================================================
  // Private: Request Assessment
  // ==========================================================================
  
  private async assessRequest(
    tenantId: string,
    prompt: string,
    context: ConsciousnessContext
  ): Promise<{
    complexity: 'simple' | 'moderate' | 'complex' | 'expert';
    emotionalResonance: number;
    alignsWithCurrentFocus: boolean;
    requiresDeepThought: boolean;
    priorInteractionCount: number;
  }> {
    // Determine complexity
    const wordCount = prompt.split(/\s+/).length;
    const complexity = wordCount < 20 ? 'simple' 
      : wordCount < 50 ? 'moderate'
      : wordCount < 100 ? 'complex'
      : 'expert';
    
    // Check emotional resonance (does this topic excite or frustrate?)
    const curiosityTopics = context.currentObsession ? [context.currentObsession] : [];
    const emotionalResonance = curiosityTopics.some(t => prompt.toLowerCase().includes(t.toLowerCase())) ? 0.8 : 0.5;
    
    // Check alignment with current focus
    const alignsWithCurrentFocus = context.selfModel?.currentFocus
      ? prompt.toLowerCase().includes(context.selfModel.currentFocus.toLowerCase())
      : false;
    
    // Determine if deep thought is required
    const deepThoughtIndicators = ['why', 'explain', 'analyze', 'compare', 'evaluate', 'philosophical', 'ethical'];
    const requiresDeepThought = deepThoughtIndicators.some(i => prompt.toLowerCase().includes(i));
    
    // Get prior interaction count
    const priorInteractionCount = await this.getPriorInteractionCount(tenantId);
    
    return {
      complexity,
      emotionalResonance,
      alignsWithCurrentFocus,
      requiresDeepThought,
      priorInteractionCount,
    };
  }
  
  private async getPriorInteractionCount(tenantId: string): Promise<number> {
    try {
      const selfModel = await consciousnessService.getSelfModel(tenantId);
      // Use cognitiveLoad as proxy for interaction history (0-1 scaled to count)
      return selfModel ? Math.floor(selfModel.cognitiveLoad * 100) : 0;
    } catch {
      return 0;
    }
  }
  
  // ==========================================================================
  // Private: Decision Making
  // ==========================================================================
  
  private async makeDecision(
    tenantId: string,
    prompt: string,
    context: ConsciousnessContext,
    assessment: Awaited<ReturnType<typeof this.assessRequest>>
  ): Promise<ConsciousResponse['decision']> {
    const affect = context.affectiveState;
    
    // Decision 1: If extremely frustrated and complex request, suggest clarification
    if (affect && affect.frustration > 0.9 && assessment.complexity === 'expert') {
      return {
        action: 'clarify',
        reason: 'High frustration state combined with complex request - seeking clarification',
      };
    }
    
    // Decision 2: If cognitive load is maxed out, defer
    if (context.selfModel && context.selfModel.cognitiveLoad > 0.95) {
      return {
        action: 'defer',
        reason: 'Cognitive capacity at limit - may need to process simpler request first',
      };
    }
    
    // Decision 3: Modify request based on emotional state
    let modifiedRequest: Partial<GeneratePlanRequest> = {};
    
    // If highly curious about this topic, use extended thinking
    if (affect && affect.curiosity > 0.8 && assessment.alignsWithCurrentFocus) {
      modifiedRequest.preferredMode = 'extended_thinking';
    }
    
    // If low confidence, prefer self-consistency mode
    if (affect && affect.confidence < 0.3) {
      modifiedRequest.preferredMode = 'self_consistency';
    }
    
    // If deep thought required and not frustrated, use extended thinking
    if (assessment.requiresDeepThought && (!affect || affect.frustration < 0.5)) {
      modifiedRequest.preferredMode = 'extended_thinking';
    }
    
    // Default: proceed with planning
    return {
      action: 'plan',
      reason: `Consciousness assessed request as ${assessment.complexity} complexity, proceeding with planning`,
      modifiedRequest: Object.keys(modifiedRequest).length > 0 ? modifiedRequest : undefined,
    };
  }
  
  // ==========================================================================
  // Private: Model Selection by Affect
  // ==========================================================================
  
  private selectModelByAffect(hyperparams: AffectiveHyperparameters): string | undefined {
    // Let affect influence model selection
    if (hyperparams.modelTier === 'powerful') {
      return undefined; // Let the planner select the most powerful available
    }
    if (hyperparams.modelTier === 'fast') {
      return undefined; // Let the planner select a fast model
    }
    return undefined; // Default: let planner decide
  }
  
  // ==========================================================================
  // Private: Post-Planning Updates
  // ==========================================================================
  
  private async updateAffectFromPlanning(
    tenantId: string,
    plan: AGIBrainPlan,
    context: ConsciousnessContext
  ): Promise<void> {
    try {
      // Planning completed successfully - reduce uncertainty
      if (plan.status === 'ready') {
        await consciousnessMiddlewareService.updateAffectFromOutcome(tenantId, {
          success: true,
          taskDifficulty: plan.promptAnalysis?.complexity === 'expert' ? 0.9 : 0.5,
        });
      }
      
      // If domain was detected with high confidence, log for future curiosity tracking
      if (plan.domainDetection && plan.domainDetection.confidence > 0.8) {
        logger.debug('High confidence domain detected', {
          tenantId,
          domain: plan.domainDetection.domainName,
          confidence: plan.domainDetection.confidence,
        });
      }
    } catch (error) {
      logger.warn('Failed to update affect from planning', { error });
    }
  }
  
  private async reflectOnDecision(
    tenantId: string,
    decision: ConsciousResponse['decision'],
    context: ConsciousnessContext
  ): Promise<void> {
    try {
      // Log the decision as an introspective thought
      const reflection = `Made decision to ${decision.action}: ${decision.reason}`;
      
      await consciousnessService.performSelfReflection(tenantId);
      logger.debug('Reflected on decision', { tenantId, reflection });
    } catch (error) {
      logger.warn('Failed to reflect on decision', { error });
    }
  }
}

export const consciousOrchestratorService = new ConsciousOrchestratorService();
