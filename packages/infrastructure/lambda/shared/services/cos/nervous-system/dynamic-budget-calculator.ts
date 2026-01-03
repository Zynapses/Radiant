/**
 * DynamicBudgetCalculator v6.0.5
 * 
 * PURPOSE: Prevent context squeeze leaving no room for response
 * 
 * PROBLEM (v6.0.2): 7,700 input tokens on 8,192 context = only 492 for response
 *   - Model truncates response mid-sentence
 *   - Critical information lost
 *   - Poor user experience
 * 
 * SOLUTION (Gemini): Reserve 1,000 tokens minimum for response
 *   - Dynamic allocation based on model capabilities
 *   - Prioritized context allocation (ghost > flash > history)
 *   - Graceful degradation when budget tight
 * 
 * Location: packages/infrastructure/lambda/shared/services/cos/nervous-system/dynamic-budget-calculator.ts
 */

import { TokenBudget, TokenBudgetReserved, ModelConfig, MODEL_CONFIGS } from '../types';

export interface BudgetCalculationParams {
  modelId: string;
  systemPromptTokens: number;
  complianceTokens: number;
  requestedResponseTokens?: number;
}

export interface BudgetAllocationResult {
  budget: TokenBudget;
  warnings: string[];
  canProceed: boolean;
}

/**
 * DynamicBudgetCalculator - Token budget management
 * 
 * Ensures every request has enough room for:
 * 1. System prompt (fixed)
 * 2. Compliance sandwich (fixed)
 * 3. Ghost context (15% of available)
 * 4. Flash facts (5% of available)
 * 5. Conversation history (80% of available)
 * 6. Response (minimum 1000 tokens - CRITICAL)
 */
export class DynamicBudgetCalculator {
  // CRITICAL: Gemini fix - always reserve at least 1000 for response
  private readonly MIN_RESPONSE_RESERVE = 1000;
  
  // Allocation percentages for available budget
  private readonly GHOST_CONTEXT_PERCENT = 0.15;
  private readonly FLASH_FACTS_PERCENT = 0.05;
  private readonly CONVERSATION_HISTORY_PERCENT = 0.80;
  
  /**
   * Calculate token budget for a request
   * 
   * @param params - Calculation parameters
   * @returns Token budget with allocations
   * @throws Error if budget cannot be satisfied
   */
  calculate(params: BudgetCalculationParams): TokenBudget {
    const config = this.getModelConfig(params.modelId);
    
    // Calculate response reserve (at least MIN_RESPONSE_RESERVE)
    const responseReserve = Math.max(
      params.requestedResponseTokens || 0,
      this.MIN_RESPONSE_RESERVE,
      Math.floor(config.outputLimit * 0.1) // At least 10% of output limit
    );
    
    const reserved: TokenBudgetReserved = {
      response: responseReserve,
      systemPrompt: params.systemPromptTokens,
      compliance: params.complianceTokens,
    };
    
    const totalReserved = reserved.response + reserved.systemPrompt + reserved.compliance;
    const available = config.inputLimit - totalReserved;
    
    if (available < 0) {
      throw new Error(
        `Token budget exceeded: need ${totalReserved} tokens for reserved content, ` +
        `but model ${params.modelId} only allows ${config.inputLimit} input tokens`
      );
    }
    
    return {
      total: config.contextWindow,
      reserved,
      available,
      ghostContext: Math.floor(available * this.GHOST_CONTEXT_PERCENT),
      flashFacts: Math.floor(available * this.FLASH_FACTS_PERCENT),
      conversationHistory: Math.floor(available * this.CONVERSATION_HISTORY_PERCENT),
    };
  }
  
  /**
   * Calculate budget with warnings and graceful degradation
   */
  calculateWithWarnings(params: BudgetCalculationParams): BudgetAllocationResult {
    const warnings: string[] = [];
    const config = this.getModelConfig(params.modelId);
    
    // Calculate base budget
    const responseReserve = Math.max(
      params.requestedResponseTokens || 0,
      this.MIN_RESPONSE_RESERVE
    );
    
    const totalRequired = params.systemPromptTokens + params.complianceTokens + responseReserve;
    
    // Check if we can proceed at all
    if (totalRequired > config.inputLimit) {
      return {
        budget: this.createEmptyBudget(config),
        warnings: [`Cannot proceed: required ${totalRequired} tokens exceeds limit ${config.inputLimit}`],
        canProceed: false,
      };
    }
    
    const available = config.inputLimit - totalRequired;
    
    // Warn if budget is tight
    if (available < 1000) {
      warnings.push(`Low context budget: only ${available} tokens available for context`);
    }
    
    // Warn if response reserve is minimal
    if (responseReserve === this.MIN_RESPONSE_RESERVE && params.requestedResponseTokens && params.requestedResponseTokens > this.MIN_RESPONSE_RESERVE) {
      warnings.push(`Response budget reduced from ${params.requestedResponseTokens} to ${responseReserve}`);
    }
    
    const budget: TokenBudget = {
      total: config.contextWindow,
      reserved: {
        response: responseReserve,
        systemPrompt: params.systemPromptTokens,
        compliance: params.complianceTokens,
      },
      available,
      ghostContext: Math.floor(available * this.GHOST_CONTEXT_PERCENT),
      flashFacts: Math.floor(available * this.FLASH_FACTS_PERCENT),
      conversationHistory: Math.floor(available * this.CONVERSATION_HISTORY_PERCENT),
    };
    
    return {
      budget,
      warnings,
      canProceed: true,
    };
  }
  
  /**
   * Estimate token count for text (rough approximation)
   * For accurate counts, use tiktoken or model-specific tokenizer
   */
  estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English
    // This is a fallback - production should use proper tokenizer
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Check if content fits within budget allocation
   */
  fitsInBudget(content: string, allocation: number): boolean {
    return this.estimateTokens(content) <= allocation;
  }
  
  /**
   * Truncate content to fit budget allocation
   * Preserves complete sentences where possible
   */
  truncateToFit(content: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokens(content);
    if (estimatedTokens <= maxTokens) return content;
    
    // Rough character limit
    const maxChars = maxTokens * 4;
    let truncated = content.slice(0, maxChars);
    
    // Try to end at sentence boundary
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );
    
    if (lastSentenceEnd > maxChars * 0.5) {
      truncated = truncated.slice(0, lastSentenceEnd + 1);
    }
    
    return truncated + '\n[Content truncated due to context limits]';
  }
  
  /**
   * Get model configuration, with fallback for unknown models
   */
  getModelConfig(modelId: string): ModelConfig {
    // Check exact match first
    if (MODEL_CONFIGS[modelId]) {
      return MODEL_CONFIGS[modelId];
    }
    
    // Try to match by prefix (e.g., "gpt-4-turbo-2024" matches "gpt-4-turbo")
    for (const [key, config] of Object.entries(MODEL_CONFIGS)) {
      if (modelId.startsWith(key) || key.startsWith(modelId.split('-').slice(0, 2).join('-'))) {
        return config;
      }
    }
    
    // Fallback: conservative defaults
    console.warn(`[COS] Unknown model ${modelId}, using conservative defaults`);
    return {
      contextWindow: 8192,
      inputLimit: 7000,
      outputLimit: 1192,
    };
  }
  
  /**
   * Add or update model configuration
   */
  static addModelConfig(modelId: string, config: ModelConfig): void {
    MODEL_CONFIGS[modelId] = config;
  }
  
  /**
   * Get summary of budget utilization
   */
  getBudgetSummary(budget: TokenBudget): string {
    const utilization = ((budget.total - budget.available - budget.reserved.response) / budget.total * 100).toFixed(1);
    return [
      `Total Context: ${budget.total}`,
      `Reserved: ${JSON.stringify(budget.reserved)}`,
      `Available: ${budget.available}`,
      `  - Ghost Context: ${budget.ghostContext}`,
      `  - Flash Facts: ${budget.flashFacts}`,
      `  - History: ${budget.conversationHistory}`,
      `Utilization: ${utilization}%`,
    ].join('\n');
  }
  
  private createEmptyBudget(config: ModelConfig): TokenBudget {
    return {
      total: config.contextWindow,
      reserved: { response: 0, systemPrompt: 0, compliance: 0 },
      available: 0,
      ghostContext: 0,
      flashFacts: 0,
      conversationHistory: 0,
    };
  }
}

/**
 * Singleton instance for convenience
 */
export const dynamicBudgetCalculator = new DynamicBudgetCalculator();
