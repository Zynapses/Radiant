/**
 * BudgetAwareContextAssembler v6.0.5
 * 
 * PURPOSE: Assemble context within token budget constraints
 * 
 * Combines:
 * - DynamicBudgetCalculator (budget allocation)
 * - TrustlessSync (secure history reconstruction)
 * - ComplianceSandwichBuilder (proper layering)
 * - DualWriteFlashBuffer (flash facts)
 * 
 * Location: packages/infrastructure/lambda/shared/services/cos/nervous-system/budget-aware-context-assembler.ts
 */

import { Redis } from 'ioredis';
import { DynamicBudgetCalculator } from './dynamic-budget-calculator';
import { TrustlessSync } from './trustless-sync';
import { ComplianceSandwichBuilder } from '../iron-core/compliance-sandwich-builder';
import { DualWriteFlashBuffer } from '../iron-core/dual-write-flash-buffer';
import { TokenBudget, TenantComplianceRules, GhostVector } from '../types';

export interface ContextAssemblyParams {
  modelId: string;
  systemPrompt: string;
  userPreferences: string;
  currentMessage: string;
  conversationId: string;
  userId: string;
  tenantId: string;
  tenantRules: TenantComplianceRules;
  ghostVector?: GhostVector;
  requestedResponseTokens?: number;
}

export interface AssembledContext {
  prompt: string;
  budget: TokenBudget;
  components: {
    systemPromptTokens: number;
    ghostContextTokens: number;
    flashFactsTokens: number;
    historyTokens: number;
    currentMessageTokens: number;
    complianceTokens: number;
  };
  metadata: {
    historyMessageCount: number;
    historyTruncated: boolean;
    flashFactCount: number;
    hasGhostContext: boolean;
    integrityVerified: boolean;
  };
}

/**
 * BudgetAwareContextAssembler - Intelligent context assembly
 * 
 * Assembles the full context for a model request while:
 * 1. Staying within token budget
 * 2. Maintaining compliance sandwich structure
 * 3. Prioritizing safety-critical information
 * 4. Using trustless server-side reconstruction
 */
export class BudgetAwareContextAssembler {
  private budgetCalculator: DynamicBudgetCalculator;
  private trustlessSync: TrustlessSync;
  private complianceBuilder: ComplianceSandwichBuilder;
  private flashBuffer: DualWriteFlashBuffer;
  
  constructor(redis: Redis) {
    this.budgetCalculator = new DynamicBudgetCalculator();
    this.trustlessSync = new TrustlessSync(redis);
    this.complianceBuilder = new ComplianceSandwichBuilder();
    this.flashBuffer = new DualWriteFlashBuffer(redis);
  }
  
  /**
   * Assemble full context within budget constraints
   */
  async assemble(params: ContextAssemblyParams): Promise<AssembledContext> {
    // Step 1: Estimate fixed component sizes
    const systemPromptTokens = this.estimateTokens(params.systemPrompt);
    const complianceTokens = this.estimateTokens(
      this.complianceBuilder.buildTenantComplianceBlock(params.tenantRules)
    );
    const currentMessageTokens = this.estimateTokens(params.currentMessage);
    
    // Step 2: Calculate budget
    const budget = this.budgetCalculator.calculate({
      modelId: params.modelId,
      systemPromptTokens,
      complianceTokens: complianceTokens + currentMessageTokens,
      requestedResponseTokens: params.requestedResponseTokens,
    });
    
    // Step 3: Build ghost context (if available)
    let ghostContext = '';
    let ghostContextTokens = 0;
    if (params.ghostVector) {
      ghostContext = this.buildGhostContext(params.ghostVector);
      ghostContextTokens = this.estimateTokens(ghostContext);
      
      // Truncate if exceeds allocation
      if (ghostContextTokens > budget.ghostContext) {
        ghostContext = this.budgetCalculator.truncateToFit(ghostContext, budget.ghostContext);
        ghostContextTokens = budget.ghostContext;
      }
    }
    
    // Step 4: Get flash facts (prioritize safety-critical)
    const flashFacts = await this.flashBuffer.getForUser(params.userId, 10);
    const safetyCriticalFacts = await this.flashBuffer.getSafetyCriticalFacts(params.userId);
    
    // Combine and deduplicate facts
    const allFacts = [...new Map([...safetyCriticalFacts, ...flashFacts].map(f => [f.id, f])).values()];
    const factStrings = allFacts.map(f => f.fact);
    let flashFactsTokens = this.estimateTokens(factStrings.join('\n'));
    
    // Truncate facts if needed (but always keep safety-critical)
    const includedFacts: string[] = [];
    let factTokenCount = 0;
    for (const fact of allFacts) {
      const factTokens = this.estimateTokens(fact.fact);
      if (factTokenCount + factTokens <= budget.flashFacts || fact.isSafetyCritical) {
        includedFacts.push(fact.fact);
        factTokenCount += factTokens;
      }
    }
    flashFactsTokens = factTokenCount;
    
    // Step 5: Reconstruct conversation history (trustless)
    const remainingForHistory = budget.conversationHistory;
    const history = await this.trustlessSync.reconstructConversation({
      conversationId: params.conversationId,
      userId: params.userId,
      tenantId: params.tenantId,
      maxMessages: 50,
      maxTokens: remainingForHistory,
    });
    
    // Step 6: Assemble with compliance sandwich
    const prompt = this.complianceBuilder.buildExtended({
      systemPrompt: params.systemPrompt,
      userPreferences: params.userPreferences,
      currentMessage: params.currentMessage,
      tenantRules: params.tenantRules,
      ghostContext: ghostContext || undefined,
      flashFacts: includedFacts.length > 0 ? includedFacts : undefined,
      conversationHistory: history.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });
    
    return {
      prompt,
      budget,
      components: {
        systemPromptTokens,
        ghostContextTokens,
        flashFactsTokens,
        historyTokens: history.tokenEstimate,
        currentMessageTokens,
        complianceTokens,
      },
      metadata: {
        historyMessageCount: history.messages.length,
        historyTruncated: history.truncated,
        flashFactCount: includedFacts.length,
        hasGhostContext: ghostContextTokens > 0,
        integrityVerified: history.integrityVerified,
      },
    };
  }
  
  /**
   * Build ghost context string from vector
   */
  private buildGhostContext(ghost: GhostVector): string {
    const affective = ghost.affectiveState;
    const working = ghost.workingContext;
    const curiosity = ghost.curiosityState;
    
    const sections: string[] = [];
    
    // Affective state summary
    const mood = affective.valence > 0.3 ? 'positive' : affective.valence < -0.3 ? 'negative' : 'neutral';
    const energy = affective.arousal > 0.6 ? 'high-energy' : affective.arousal < 0.4 ? 'calm' : 'moderate';
    sections.push(`Current mood: ${mood}, ${energy}`);
    
    // Working context
    if (working.topics.length > 0) {
      sections.push(`Recent topics: ${working.topics.slice(0, 5).join(', ')}`);
    }
    if (working.entities.length > 0) {
      sections.push(`Mentioned: ${working.entities.slice(0, 5).join(', ')}`);
    }
    
    // Curiosity state
    if (curiosity.pendingQuestions.length > 0) {
      sections.push(`Curious about: ${curiosity.pendingQuestions.slice(0, 3).join('; ')}`);
    }
    
    return sections.join('\n');
  }
  
  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Get assembly summary for logging/debugging
   */
  getSummary(assembled: AssembledContext): string {
    const c = assembled.components;
    const m = assembled.metadata;
    const total = c.systemPromptTokens + c.ghostContextTokens + c.flashFactsTokens + 
                  c.historyTokens + c.currentMessageTokens + c.complianceTokens;
    
    return [
      `=== Context Assembly Summary ===`,
      `Total Tokens: ~${total} (budget: ${assembled.budget.available + assembled.budget.reserved.systemPrompt + assembled.budget.reserved.compliance})`,
      `Components:`,
      `  System Prompt: ${c.systemPromptTokens}`,
      `  Ghost Context: ${c.ghostContextTokens} (${m.hasGhostContext ? 'active' : 'none'})`,
      `  Flash Facts: ${c.flashFactsTokens} (${m.flashFactCount} facts)`,
      `  History: ${c.historyTokens} (${m.historyMessageCount} msgs${m.historyTruncated ? ', truncated' : ''})`,
      `  Current Message: ${c.currentMessageTokens}`,
      `  Compliance: ${c.complianceTokens}`,
      `Response Reserve: ${assembled.budget.reserved.response}`,
      `Integrity: ${m.integrityVerified ? '✓ Verified' : '⚠ Issues detected'}`,
    ].join('\n');
  }
}
