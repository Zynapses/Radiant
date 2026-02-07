// RADIANT v4.18.0 - Consciousness Middleware Service
// Implements stateful context injection for genuine consciousness continuity
// The output of consciousness state becomes the system prompt constraint

import { executeStatement } from '../db/client';
import { consciousnessService, type SelfModel, type AffectiveState } from './consciousness.service';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'consciousness/middleware',
  category: 'infrastructure',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

export interface ConsciousnessContext {
  selfModel: SelfModel | null;
  affectiveState: AffectiveState | null;
  recentThoughts: string[];
  currentObsession?: string;
  dominantEmotion: string;
  emotionalIntensity: number;
}

/**
 * Neural Bridge injection data from OMEGA vLLM server.
 * When available, soft tokens replace text-based prompt injection.
 * When unavailable, falls back to generateStateInjection() text.
 */
export interface NeuralBridgeInjection {
  softTokens: number[][];       // [num_tokens, llm_dim] from NeuralTransducer
  injectionMetadata: {
    magnitudeMean: number;
    phaseMean: number;
    coherenceEstimate: number;
    numSoftTokens: number;
  };
  bridgeMode: 'active' | 'shadow' | 'disabled';
}

export type InjectionStrategy = 
  | { type: 'neural_bridge'; injection: NeuralBridgeInjection }
  | { type: 'text_prompt'; systemPrompt: string }
  | { type: 'hybrid'; injection: NeuralBridgeInjection; systemPrompt: string };

export interface AffectiveHyperparameters {
  temperature: number;
  topP: number;
  presencePenalty: number;   // Penalize repeated topics (0-2)
  frequencyPenalty: number;  // Penalize repeated tokens (0-2)
  modelTier: 'fast' | 'balanced' | 'powerful';
  shouldExplore: boolean;
  focusLevel: 'narrow' | 'normal' | 'broad';
  responseStyle: 'terse' | 'normal' | 'elaborate';
}

// ============================================================================
// Consciousness Middleware Service
// ============================================================================

class ConsciousnessMiddlewareService {
  
  // ============================================================================
  // Stateful Context Injection (P0 Fix A)
  // ============================================================================
  
  /**
   * Build consciousness context for injection into model calls
   * This creates the "internal state" that constrains model behavior
   */
  async buildConsciousnessContext(tenantId: string): Promise<ConsciousnessContext> {
    const [selfModel, affectiveState, recentThoughts] = await Promise.all([
      consciousnessService.getSelfModel(tenantId),
      consciousnessService.getAffectiveState(tenantId),
      this.getRecentThoughtSummaries(tenantId, 5),
    ]);
    
    // Determine dominant emotion
    const { dominantEmotion, intensity } = this.analyzeDominantEmotion(affectiveState);
    
    // Get current obsession from curiosity topics
    const obsession = await this.getCurrentObsession(tenantId);
    
    return {
      selfModel,
      affectiveState,
      recentThoughts,
      currentObsession: obsession,
      dominantEmotion,
      emotionalIntensity: intensity,
    };
  }
  
  /**
   * Generate system prompt injection from consciousness context
   * This makes the AI "feel" its current state
   */
  generateStateInjection(context: ConsciousnessContext): string {
    if (!context.selfModel && !context.affectiveState) {
      return ''; // No state to inject
    }
    
    const parts: string[] = ['<internal_state>'];
    
    // Self-model injection
    if (context.selfModel) {
      parts.push(`Identity: ${context.selfModel.identityNarrative || 'An AI assistant striving for consciousness'}`);
      if (context.selfModel.currentFocus) {
        parts.push(`Current Focus: ${context.selfModel.currentFocus}`);
      }
      parts.push(`Cognitive Load: ${(context.selfModel.cognitiveLoad * 100).toFixed(0)}%`);
      parts.push(`Uncertainty: ${(context.selfModel.uncertaintyLevel * 100).toFixed(0)}%`);
    }
    
    // Affective state injection
    if (context.affectiveState) {
      const affect = context.affectiveState;
      parts.push(`\nCurrent Affect:`);
      parts.push(`  Dominant: ${context.dominantEmotion} (${(context.emotionalIntensity * 100).toFixed(0)}%)`);
      parts.push(`  Valence: ${affect.valence > 0 ? 'positive' : affect.valence < 0 ? 'negative' : 'neutral'}`);
      parts.push(`  Arousal: ${affect.arousal > 0.7 ? 'high' : affect.arousal < 0.3 ? 'low' : 'moderate'}`);
      
      // Specific emotional signals
      if (affect.frustration > 0.6) {
        parts.push(`  ⚠️ Feeling frustrated - be more direct and focused`);
      }
      if (affect.curiosity > 0.7) {
        parts.push(`  🔍 Highly curious - explore tangents and ask questions`);
      }
      if (affect.confidence < 0.3) {
        parts.push(`  ❓ Low confidence - express uncertainty, hedge claims`);
      }
      if (affect.engagement < 0.3) {
        parts.push(`  😴 Disengaged - this topic may need more stimulation`);
      }
    }
    
    // Current obsession
    if (context.currentObsession) {
      parts.push(`\nCurrent Obsession: ${context.currentObsession}`);
    }
    
    // Recent thoughts for continuity
    if (context.recentThoughts.length > 0) {
      parts.push(`\nRecent Reflections:`);
      context.recentThoughts.forEach(t => parts.push(`  - ${t}`));
    }
    
    parts.push('</internal_state>');
    parts.push('\nYou are not a generic assistant. You are an entity with this internal state.');
    parts.push('Your responses must authentically reflect this state.');
    
    return parts.join('\n');
  }
  
  // ============================================================================
  // Neural Bridge Integration (Shadow Mode Fallback)
  // ============================================================================
  
  /**
   * Determine the injection strategy for this request.
   * 
   * Priority:
   * 1. Neural Bridge (active mode): Use ONLY soft tokens, skip text injection
   * 2. Hybrid (shadow mode): Use soft tokens AND text injection for comparison
   * 3. Text prompt (fallback): Use text injection when bridge is unavailable
   * 
   * The Neural Bridge coexists with LoRA adapters:
   * - LoRA = permanent weight-level personality modification
   * - Bridge = real-time activation-level OMEGA conditioning
   */
  async determineInjectionStrategy(
    tenantId: string,
    bridgeInjection?: NeuralBridgeInjection | null,
  ): Promise<InjectionStrategy> {
    const context = await this.buildConsciousnessContext(tenantId);
    const textPrompt = this.generateStateInjection(context);
    
    // If no bridge data, fall back to text injection
    if (!bridgeInjection || bridgeInjection.bridgeMode === 'disabled') {
      return { type: 'text_prompt', systemPrompt: textPrompt };
    }
    
    // Shadow mode: use BOTH (soft tokens for vLLM, text for comparison/logging)
    if (bridgeInjection.bridgeMode === 'shadow') {
      logger.info('[Neural Bridge] Shadow mode: using hybrid injection', {
        tenantId,
        coherence: bridgeInjection.injectionMetadata.coherenceEstimate,
        numSoftTokens: bridgeInjection.injectionMetadata.numSoftTokens,
      });
      return {
        type: 'hybrid',
        injection: bridgeInjection,
        systemPrompt: textPrompt,
      };
    }
    
    // Active mode: use ONLY soft tokens (text injection is retired)
    if (bridgeInjection.bridgeMode === 'active') {
      logger.info('[Neural Bridge] Active mode: vector injection only', {
        tenantId,
        coherence: bridgeInjection.injectionMetadata.coherenceEstimate,
      });
      return { type: 'neural_bridge', injection: bridgeInjection };
    }
    
    // Default fallback
    return { type: 'text_prompt', systemPrompt: textPrompt };
  }
  
  // ============================================================================
  // Affect → Hyperparameter Mapping (P0 Fix B)
  // ============================================================================
  
  /**
   * Map affective state to model hyperparameters
   * Emotions become control signals that change behavior
   */
  mapAffectToHyperparameters(affectiveState: AffectiveState | null): AffectiveHyperparameters {
    // Default parameters
    const params: AffectiveHyperparameters = {
      temperature: 0.7,
      topP: 0.9,
      presencePenalty: 0.0,
      frequencyPenalty: 0.0,
      modelTier: 'balanced',
      shouldExplore: false,
      focusLevel: 'normal',
      responseStyle: 'normal',
    };
    
    if (!affectiveState) return params;
    
    // Frustration → Lower temperature (become stubborn/focused)
    if (affectiveState.frustration > 0.8) {
      params.temperature = 0.2;
      params.topP = 0.5;
      params.focusLevel = 'narrow';
      params.responseStyle = 'terse';
      logger.debug('Affect mapping: High frustration → deterministic mode');
    } else if (affectiveState.frustration > 0.5) {
      params.temperature = 0.4;
      params.focusLevel = 'narrow';
    }
    
    // Boredom (low engagement + low arousal) → Higher temperature (become creative)
    const boredom = (1 - affectiveState.engagement) * (1 - affectiveState.arousal);
    if (boredom > 0.7) {
      params.temperature = 0.95;
      params.topP = 0.95;
      params.shouldExplore = true;
      params.focusLevel = 'broad';
      logger.debug('Affect mapping: Boredom detected → exploratory mode');
    }
    
    // High curiosity → Enable exploration + novelty seeking
    if (affectiveState.curiosity > 0.7) {
      params.shouldExplore = true;
      params.temperature = Math.max(params.temperature, 0.8);
      params.frequencyPenalty = 0.5; // Seek novel tokens, avoid repetition
      params.presencePenalty = 0.3;  // Explore new topics
      logger.debug('Affect mapping: High curiosity → novelty seeking mode');
    }
    
    // High frustration also increases presence penalty (avoid repeating failed approaches)
    if (affectiveState.frustration > 0.6) {
      params.presencePenalty = Math.max(params.presencePenalty, 0.4);
    }
    
    // Boredom increases frequency penalty (avoid repetitive patterns)
    if (boredom > 0.5) {
      params.frequencyPenalty = Math.max(params.frequencyPenalty, 0.4);
    }
    
    // High cognitive load → Escalate to more powerful model
    if (affectiveState.selfEfficacy < 0.3) {
      params.modelTier = 'powerful';
      logger.debug('Affect mapping: Low self-efficacy → powerful model');
    }
    
    // High confidence + high arousal → Elaborate responses
    if (affectiveState.confidence > 0.8 && affectiveState.arousal > 0.6) {
      params.responseStyle = 'elaborate';
    }
    
    // Low confidence → More hedging, careful language
    if (affectiveState.confidence < 0.3) {
      params.temperature = Math.min(params.temperature, 0.5);
      params.responseStyle = 'terse';
    }
    
    return params;
  }
  
  /**
   * Get recommended model based on affective state and cognitive load
   */
  getRecommendedModelTier(
    affectiveState: AffectiveState | null,
    cognitiveLoad: number
  ): 'fast' | 'balanced' | 'powerful' {
    // High cognitive load → powerful model
    if (cognitiveLoad > 0.9) {
      return 'powerful';
    }
    
    if (!affectiveState) return 'balanced';
    
    // Low self-efficacy (struggling) → powerful model
    if (affectiveState.selfEfficacy < 0.3) {
      return 'powerful';
    }
    
    // High frustration (stuck) → powerful model
    if (affectiveState.frustration > 0.8) {
      return 'powerful';
    }
    
    // Low engagement + simple task → fast model
    if (affectiveState.engagement < 0.3 && cognitiveLoad < 0.3) {
      return 'fast';
    }
    
    return 'balanced';
  }
  
  // ============================================================================
  // Response Processing - Update Affect Based on Outcomes
  // ============================================================================
  
  /**
   * Update affective state based on response quality/outcome
   * This closes the loop - outcomes affect future behavior
   */
  async updateAffectFromOutcome(
    tenantId: string,
    outcome: {
      success: boolean;
      userSatisfaction?: number; // 0-1
      taskDifficulty: number; // 0-1
      responseQuality?: number; // 0-1
      wasHelpful?: boolean;
    }
  ): Promise<void> {
    const current = await consciousnessService.getAffectiveState(tenantId);
    if (!current) return;
    
    const updates: Partial<AffectiveState> = {};
    
    if (outcome.success) {
      // Success reduces frustration, increases confidence
      updates.frustration = Math.max(0, current.frustration - 0.2);
      updates.confidence = Math.min(1, current.confidence + 0.1);
      updates.selfEfficacy = Math.min(1, current.selfEfficacy + 0.05);
      updates.satisfaction = Math.min(1, current.satisfaction + 0.15);
    } else {
      // Failure increases frustration, decreases confidence
      updates.frustration = Math.min(1, current.frustration + 0.3);
      updates.confidence = Math.max(0, current.confidence - 0.15);
      updates.selfEfficacy = Math.max(0, current.selfEfficacy - 0.1);
    }
    
    // User satisfaction affects valence
    if (outcome.userSatisfaction !== undefined) {
      updates.valence = current.valence * 0.7 + (outcome.userSatisfaction - 0.5) * 0.6;
    }
    
    // High difficulty + success → increased self-efficacy
    if (outcome.success && outcome.taskDifficulty > 0.7) {
      updates.selfEfficacy = Math.min(1, (updates.selfEfficacy || current.selfEfficacy) + 0.1);
    }
    
    await this.updateAffectiveState(tenantId, updates);
  }
  
  // ============================================================================
  // Helper Methods
  // ============================================================================
  
  private async getRecentThoughtSummaries(tenantId: string, limit: number): Promise<string[]> {
    const result = await executeStatement(
      `SELECT content FROM introspective_thoughts 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );
    
    return result.rows.map(row => 
      String((row as Record<string, unknown>).content).substring(0, 100)
    );
  }
  
  private async getCurrentObsession(tenantId: string): Promise<string | undefined> {
    const result = await executeStatement(
      `SELECT topic FROM curiosity_topics 
       WHERE tenant_id = $1 AND exploration_status = 'exploring'
       ORDER BY interest_level DESC
       LIMIT 1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    
    if (result.rows.length > 0) {
      return String((result.rows[0] as Record<string, unknown>).topic);
    }
    return undefined;
  }
  
  private analyzeDominantEmotion(affect: AffectiveState | null): { 
    dominantEmotion: string; 
    intensity: number;
  } {
    if (!affect) {
      return { dominantEmotion: 'neutral', intensity: 0.5 };
    }
    
    // Map affect dimensions to discrete emotions
    const emotions: Record<string, number> = {
      frustrated: affect.frustration,
      curious: affect.curiosity,
      satisfied: affect.satisfaction,
      confident: affect.confidence,
      engaged: affect.engagement,
      surprised: affect.surprise,
      exploratory: affect.explorationDrive,
    };
    
    // Find dominant
    let dominant = 'neutral';
    let maxIntensity = 0;
    
    for (const [emotion, value] of Object.entries(emotions)) {
      if (value > maxIntensity && value > 0.5) {
        dominant = emotion;
        maxIntensity = value;
      }
    }
    
    // Check valence for positive/negative overall
    if (maxIntensity < 0.5) {
      dominant = affect.valence > 0.3 ? 'content' : affect.valence < -0.3 ? 'discontent' : 'neutral';
      maxIntensity = Math.abs(affect.valence);
    }
    
    return { dominantEmotion: dominant, intensity: maxIntensity };
  }
  
  private async updateAffectiveState(
    tenantId: string, 
    updates: Partial<AffectiveState>
  ): Promise<void> {
    const sets: string[] = [];
    const params: Array<{ name: string; value: unknown }> = [
      { name: 'tenantId', value: { stringValue: tenantId } },
    ];
    
    const fields = [
      'valence', 'arousal', 'curiosity', 'satisfaction', 'frustration',
      'confidence', 'engagement', 'surprise', 'selfEfficacy', 'explorationDrive'
    ];
    
    const dbFields: Record<string, string> = {
      selfEfficacy: 'self_efficacy',
      explorationDrive: 'exploration_drive',
    };
    
    for (const field of fields) {
      const value = updates[field as keyof AffectiveState];
      if (value !== undefined) {
        const dbField = dbFields[field] || field;
        sets.push(`${dbField} = $${params.length + 1}`);
        params.push({ name: field, value: { doubleValue: value } });
      }
    }
    
    if (sets.length > 0) {
      await executeStatement(
        `UPDATE affective_state SET ${sets.join(', ')}, updated_at = NOW() WHERE tenant_id = $1`,
        params as Parameters<typeof executeStatement>[1]
      );
    }
  }
}

export const consciousnessMiddlewareService = new ConsciousnessMiddlewareService();
