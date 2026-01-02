// RADIANT v4.18.0 - Self-Hosted Model Selector Service
// Integrates 56 self-hosted models with AGI Brain orchestration

import { executeStatement } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import {
  SELF_HOSTED_MODEL_REGISTRY,
  SelfHostedModelDefinition,
  getSelfHostedModelById,
  getSelfHostedModelsByCapability,
  getSelfHostedModelsByModality,
  getSelfHostedModelsByDomain,
  getSelfHostedModelsForOrchestration,
  ModelModality,
  DomainStrength,
} from '@radiant/shared';

// ============================================================================
// Types
// ============================================================================

export interface ModelSelectionCriteria {
  // Task requirements
  capabilities?: string[];
  inputModality?: ModelModality;
  outputModality?: ModelModality;
  
  // Domain context
  domain?: string;
  subspecialty?: string;
  minDomainStrength?: DomainStrength;
  
  // Orchestration preferences
  preferredFor?: string;
  avoidFor?: string[];
  qualityTier?: 'premium' | 'standard' | 'economy';
  latencyClass?: 'fast' | 'medium' | 'slow';
  
  // Constraints
  maxCostPer1M?: number;
  minTier?: number;
  requireCommercialUse?: boolean;
  preferSelfHosted?: boolean;
  
  // Exclusions
  excludeModels?: string[];
  excludeFamilies?: string[];
}

export interface ModelSelectionResult {
  model: SelfHostedModelDefinition;
  score: number;
  reason: string;
  alternatives: Array<{
    model: SelfHostedModelDefinition;
    score: number;
    reason: string;
  }>;
}

export interface ModelSelectionContext {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  promptDomain?: string;
  promptSubspecialty?: string;
  orchestrationMode?: string;
}

// ============================================================================
// Service
// ============================================================================

class SelfHostedModelSelectorService {
  
  /**
   * Select the best self-hosted model based on criteria
   */
  async selectBestModel(
    criteria: ModelSelectionCriteria,
    context?: ModelSelectionContext
  ): Promise<ModelSelectionResult | null> {
    // Get tenant preferences if context provided
    let tenantPrefs: TenantModelPreferences | null = null;
    if (context?.tenantId) {
      tenantPrefs = await this.getTenantPreferences(context.tenantId);
    }
    
    // Filter and score models
    const scoredModels = this.scoreModels(criteria, tenantPrefs);
    
    if (scoredModels.length === 0) {
      return null;
    }
    
    // Sort by score descending
    scoredModels.sort((a, b) => b.score - a.score);
    
    const best = scoredModels[0];
    const alternatives = scoredModels.slice(1, 4).map(m => ({
      model: m.model,
      score: m.score,
      reason: m.reason,
    }));
    
    // Record selection for analytics
    if (context) {
      await this.recordSelection(best, criteria, context);
    }
    
    return {
      model: best.model,
      score: best.score,
      reason: best.reason,
      alternatives,
    };
  }
  
  /**
   * Get models suitable for a specific orchestration mode
   */
  getModelsForOrchestrationMode(mode: string): SelfHostedModelDefinition[] {
    const modeCapabilities: Record<string, string[]> = {
      thinking: ['chat', 'reasoning'],
      extended_thinking: ['chat', 'reasoning', 'analysis'],
      coding: ['code', 'code_generation'],
      creative: ['chat', 'creative_writing'],
      research: ['chat', 'reasoning', 'analysis'],
      analysis: ['chat', 'reasoning', 'analysis', 'math'],
      multi_model: ['chat', 'reasoning'],
      chain_of_thought: ['reasoning'],
      self_consistency: ['reasoning'],
    };
    
    const required = modeCapabilities[mode] || ['chat'];
    
    return SELF_HOSTED_MODEL_REGISTRY.filter(m =>
      required.some(cap => m.capabilities.includes(cap))
    );
  }
  
  /**
   * Get models for media generation (Think Tank integration)
   */
  getMediaModels(mediaType: 'image' | 'audio' | 'video' | '3d'): SelfHostedModelDefinition[] {
    return SELF_HOSTED_MODEL_REGISTRY.filter(m =>
      m.outputModalities.includes(mediaType as ModelModality)
    );
  }
  
  /**
   * Get models that accept specific input types
   */
  getModelsForInput(inputType: ModelModality): SelfHostedModelDefinition[] {
    return getSelfHostedModelsByModality(inputType, undefined);
  }
  
  /**
   * Get models by domain expertise
   */
  getModelsByDomainExpertise(
    domain: string,
    minStrength: DomainStrength = 'moderate'
  ): SelfHostedModelDefinition[] {
    return getSelfHostedModelsByDomain(domain, minStrength);
  }
  
  /**
   * Get the fallback chain for a model
   */
  getFallbackChain(modelId: string): SelfHostedModelDefinition[] {
    const chain: SelfHostedModelDefinition[] = [];
    let current = getSelfHostedModelById(modelId);
    
    while (current) {
      chain.push(current);
      const fallbackId = current.orchestration.fallbackTo;
      if (!fallbackId || chain.length > 5) break;
      current = getSelfHostedModelById(fallbackId);
    }
    
    return chain;
  }
  
  /**
   * Get complementary models for multi-model orchestration
   */
  getComplementaryModels(modelId: string): SelfHostedModelDefinition[] {
    const model = getSelfHostedModelById(modelId);
    if (!model?.orchestration.pairsWellWith) return [];
    
    return model.orchestration.pairsWellWith
      .map(id => getSelfHostedModelById(id))
      .filter((m): m is SelfHostedModelDefinition => m !== undefined);
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private scoreModels(
    criteria: ModelSelectionCriteria,
    tenantPrefs: TenantModelPreferences | null
  ): Array<{ model: SelfHostedModelDefinition; score: number; reason: string }> {
    const results: Array<{ model: SelfHostedModelDefinition; score: number; reason: string }> = [];
    
    for (const model of SELF_HOSTED_MODEL_REGISTRY) {
      // Apply exclusions
      if (criteria.excludeModels?.includes(model.id)) continue;
      if (criteria.excludeFamilies?.includes(model.family)) continue;
      if (tenantPrefs?.excludedModels?.includes(model.id)) continue;
      if (tenantPrefs?.excludedFamilies?.includes(model.family)) continue;
      
      // Check tier constraint
      if (criteria.minTier && model.orchestration.minTier > criteria.minTier) continue;
      
      // Check commercial use
      if (criteria.requireCommercialUse && !model.commercialUse) continue;
      
      // Check cost constraint
      if (criteria.maxCostPer1M && model.pricing.inputPer1M > criteria.maxCostPer1M) continue;
      
      // Check modality requirements
      if (criteria.inputModality && !model.inputModalities.includes(criteria.inputModality)) continue;
      if (criteria.outputModality && !model.outputModalities.includes(criteria.outputModality)) continue;
      
      // Check latency class
      if (criteria.latencyClass) {
        const latencyOrder = ['fast', 'medium', 'slow'];
        const maxIndex = latencyOrder.indexOf(criteria.latencyClass);
        const modelIndex = latencyOrder.indexOf(model.orchestration.latencyClass);
        if (modelIndex > maxIndex) continue;
      }
      
      // Check avoidFor
      if (criteria.avoidFor?.some(avoid => model.orchestration.avoidFor.includes(avoid))) continue;
      
      // Calculate score
      let score = 50; // Base score
      const reasons: string[] = [];
      
      // Capability match (+20 max)
      if (criteria.capabilities) {
        const matchCount = criteria.capabilities.filter(c => model.capabilities.includes(c)).length;
        const capabilityScore = (matchCount / criteria.capabilities.length) * 20;
        score += capabilityScore;
        if (matchCount === criteria.capabilities.length) {
          reasons.push('Full capability match');
        }
      }
      
      // Domain strength (+25 max)
      if (criteria.domain) {
        const domainMatch = model.domainStrengths.find(ds => ds.domain === criteria.domain);
        if (domainMatch) {
          const strengthScores: Record<DomainStrength, number> = {
            excellent: 25,
            good: 18,
            moderate: 10,
            basic: 5,
          };
          score += strengthScores[domainMatch.strength];
          reasons.push(`${domainMatch.strength} at ${criteria.domain}`);
          
          // Subspecialty bonus (+5)
          if (criteria.subspecialty && domainMatch.subspecialties?.includes(criteria.subspecialty)) {
            score += 5;
            reasons.push(`Subspecialty: ${criteria.subspecialty}`);
          }
        }
      }
      
      // PreferredFor match (+15)
      if (criteria.preferredFor && model.orchestration.preferredFor.includes(criteria.preferredFor)) {
        score += 15;
        reasons.push(`Preferred for: ${criteria.preferredFor}`);
      }
      
      // Quality tier match (+10)
      if (criteria.qualityTier && model.orchestration.qualityTier === criteria.qualityTier) {
        score += 10;
        reasons.push(`Quality tier: ${criteria.qualityTier}`);
      }
      
      // Cost efficiency bonus (+10 max)
      const costEfficiency = 10 - Math.min(10, model.pricing.inputPer1M);
      score += costEfficiency;
      
      // Tenant preference bonus (+10)
      if (tenantPrefs?.preferredModels?.includes(model.id)) {
        score += 10;
        reasons.push('Tenant preferred');
      }
      if (tenantPrefs?.preferredFamilies?.includes(model.family)) {
        score += 5;
      }
      
      results.push({
        model,
        score: Math.round(score * 100) / 100,
        reason: reasons.length > 0 ? reasons.join('; ') : 'General match',
      });
    }
    
    return results;
  }
  
  private async getTenantPreferences(tenantId: string): Promise<TenantModelPreferences | null> {
    try {
      const result = await executeStatement(
        `SELECT 
           preferred_families,
           excluded_families,
           preferred_models,
           excluded_models,
           max_cost_per_1m,
           require_commercial_use,
           prefer_self_hosted,
           min_quality_tier,
           max_latency_class,
           domain_overrides
         FROM model_orchestration_preferences
         WHERE tenant_id = $1`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );
      
      if (result.records && result.records.length > 0) {
        const row = result.records[0];
        return {
          preferredFamilies: row[0]?.arrayValue?.stringValues || [],
          excludedFamilies: row[1]?.arrayValue?.stringValues || [],
          preferredModels: row[2]?.arrayValue?.stringValues || [],
          excludedModels: row[3]?.arrayValue?.stringValues || [],
          maxCostPer1M: row[4]?.doubleValue,
          requireCommercialUse: row[5]?.booleanValue || false,
          preferSelfHosted: row[6]?.booleanValue || false,
          minQualityTier: row[7]?.stringValue as 'premium' | 'standard' | 'economy' | undefined,
          maxLatencyClass: row[8]?.stringValue as 'fast' | 'medium' | 'slow' | undefined,
          domainOverrides: row[9]?.stringValue ? JSON.parse(row[9].stringValue) : {},
        };
      }
      
      return null;
    } catch {
      return null;
    }
  }
  
  private async recordSelection(
    selection: { model: SelfHostedModelDefinition; score: number; reason: string },
    criteria: ModelSelectionCriteria,
    context: ModelSelectionContext
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO model_selection_history (
           tenant_id, user_id, session_id,
           prompt_domain, prompt_subspecialty,
           required_capabilities, input_modality, output_modality,
           selected_model_id, selection_reason, alternatives_considered,
           orchestration_mode, quality_tier, latency_class
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          { name: 'tenantId', value: { stringValue: context.tenantId } },
          { name: 'userId', value: context.userId ? { stringValue: context.userId } : { isNull: true } },
          { name: 'sessionId', value: context.sessionId ? { stringValue: context.sessionId } : { isNull: true } },
          { name: 'domain', value: context.promptDomain ? { stringValue: context.promptDomain } : { isNull: true } },
          { name: 'subspecialty', value: context.promptSubspecialty ? { stringValue: context.promptSubspecialty } : { isNull: true } },
          { name: 'capabilities', value: { stringValue: `{${(criteria.capabilities || []).join(',')}}` } },
          { name: 'inputModality', value: criteria.inputModality ? { stringValue: criteria.inputModality } : { isNull: true } },
          { name: 'outputModality', value: criteria.outputModality ? { stringValue: criteria.outputModality } : { isNull: true } },
          { name: 'modelId', value: { stringValue: selection.model.id } },
          { name: 'reason', value: { stringValue: selection.reason } },
          { name: 'alternatives', value: { stringValue: '{}' } },
          { name: 'mode', value: context.orchestrationMode ? { stringValue: context.orchestrationMode } : { isNull: true } },
          { name: 'qualityTier', value: criteria.qualityTier ? { stringValue: criteria.qualityTier } : { isNull: true } },
          { name: 'latencyClass', value: criteria.latencyClass ? { stringValue: criteria.latencyClass } : { isNull: true } },
        ]
      );
    } catch (error) {
      logger.error('Failed to record model selection', error as Error);
    }
  }
}

// ============================================================================
// Types
// ============================================================================

interface TenantModelPreferences {
  preferredFamilies?: string[];
  excludedFamilies?: string[];
  preferredModels?: string[];
  excludedModels?: string[];
  maxCostPer1M?: number;
  requireCommercialUse?: boolean;
  preferSelfHosted?: boolean;
  minQualityTier?: 'premium' | 'standard' | 'economy';
  maxLatencyClass?: 'fast' | 'medium' | 'slow';
  domainOverrides?: Record<string, string>;
}

// ============================================================================
// Export Singleton
// ============================================================================

export const selfHostedModelSelector = new SelfHostedModelSelectorService();
