/**
 * The Economic Governor
 * 
 * RADIANT v5.0.2 - System Evolution
 * 
 * Uses a "System 0" cheap model to classify task complexity and route
 * to the most cost-effective model that can handle the task.
 * 
 * Complexity Scale:
 * 1-4: Simple (formatting, summarization, basic Q&A) → gpt-4o-mini
 * 5-8: Medium (analysis, multi-step reasoning) → original model
 * 9-10: Complex (planning, code generation, creative) → gpt-4o
 */

import { Logger } from '../../logger';

export type GovernorMode = 'performance' | 'balanced' | 'cost_saver' | 'off';

export interface SwarmTask {
  id: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  model: string;
}

export interface GovernorDecision {
  originalModel: string;
  selectedModel: string;
  complexityScore: number;
  mode: GovernorMode;
  reason: string;
  estimatedOriginalCost: number;
  estimatedActualCost: number;
  savingsAmount: number;
}

export interface GovernorConfig {
  mode: GovernorMode;
  cheapThreshold: number;
  premiumThreshold: number;
  classifierModel: string;
  cheapModel: string;
  premiumModel: string;
}

const DEFAULT_CONFIG: GovernorConfig = {
  mode: 'balanced',
  cheapThreshold: 4,
  premiumThreshold: 9,
  classifierModel: 'gpt-4o-mini',
  cheapModel: 'gpt-4o-mini',
  premiumModel: 'gpt-4o'
};

const MODEL_COSTS_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  'llama-3.1-70b': { input: 0.0009, output: 0.0009 },
  'llama-3.1-8b': { input: 0.0001, output: 0.0001 },
};

export class EconomicGovernor {
  private readonly litellmUrl: string;
  private readonly apiKey: string;
  private config: GovernorConfig;

  constructor(private logger: Logger, config?: Partial<GovernorConfig>) {
    this.litellmUrl = process.env.LITELLM_PROXY_URL || 'http://litellm.radiant.internal';
    this.apiKey = process.env.LITELLM_API_KEY || '';
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Updates the Governor configuration
   */
  setConfig(config: Partial<GovernorConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Governor config updated', { config: this.config });
  }

  /**
   * Gets the current Governor configuration
   */
  getConfig(): GovernorConfig {
    return { ...this.config };
  }

  /**
   * Estimates the cost for a given model and token count
   */
  private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const costs = MODEL_COSTS_PER_1K_TOKENS[model] || MODEL_COSTS_PER_1K_TOKENS['gpt-4o'];
    return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
  }

  /**
   * Analyzes prompt complexity and returns the optimal model.
   */
  async optimizeModelSelection(
    task: SwarmTask,
    agent: AgentConfig,
    mode?: GovernorMode
  ): Promise<GovernorDecision> {
    const effectiveMode = mode || this.config.mode;

    // Performance mode or off: Always use the original model (no intervention)
    if (effectiveMode === 'off' || effectiveMode === 'performance') {
      return {
        originalModel: agent.model,
        selectedModel: agent.model,
        complexityScore: -1,
        mode: effectiveMode,
        reason: `Governor ${effectiveMode === 'off' ? 'disabled' : 'in performance mode'}`,
        estimatedOriginalCost: 0,
        estimatedActualCost: 0,
        savingsAmount: 0
      };
    }

    // 1. Analyze Complexity using "System 0" (cheap classifier model)
    const complexityScore = await this.scoreComplexity(task.prompt);
    
    this.logger.info('Governor Complexity Analysis', { 
      taskId: task.id,
      score: complexityScore, 
      originalModel: agent.model, 
      mode: effectiveMode 
    });

    // 2. Determine routing thresholds based on mode
    const cheapThreshold = effectiveMode === 'cost_saver' ? 7 : this.config.cheapThreshold;
    const premiumThreshold = this.config.premiumThreshold;

    // 3. Route to optimal model
    let selectedModel = agent.model;
    let reason = 'Complexity within range for original model';

    if (complexityScore <= cheapThreshold) {
      selectedModel = this.config.cheapModel;
      reason = `Low complexity (${complexityScore}/${cheapThreshold}) - downgraded to efficient model`;
    } else if (complexityScore >= premiumThreshold) {
      selectedModel = this.config.premiumModel;
      reason = `High complexity (${complexityScore}) - upgraded to premium model`;
    }

    // 4. Calculate estimated costs (assuming ~500 input, ~1000 output tokens average)
    const avgInputTokens = 500;
    const avgOutputTokens = 1000;
    const estimatedOriginalCost = this.estimateCost(agent.model, avgInputTokens, avgOutputTokens);
    const estimatedActualCost = this.estimateCost(selectedModel, avgInputTokens, avgOutputTokens);
    const savingsAmount = Math.max(0, estimatedOriginalCost - estimatedActualCost);

    return {
      originalModel: agent.model,
      selectedModel,
      complexityScore,
      mode: effectiveMode,
      reason,
      estimatedOriginalCost,
      estimatedActualCost,
      savingsAmount
    };
  }

  /**
   * Uses a cheap "System 0" model to score task complexity.
   * Returns a score from 1-10.
   */
  private async scoreComplexity(prompt: string): Promise<number> {
    try {
      const response = await fetch(`${this.litellmUrl}/chat/completions`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          model: this.config.classifierModel,
          max_tokens: 5,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: `You are a task complexity classifier. Rate the complexity of the following task from 1-10.
              
Scale:
1-3: Simple formatting, basic Q&A, summarization
4-6: Analysis, comparison, multi-step reasoning  
7-8: Complex analysis, creative writing, detailed planning
9-10: Advanced reasoning, code generation, multi-domain synthesis

Return ONLY a single integer from 1-10. No explanation.`
            },
            {
              role: 'user',
              content: prompt.substring(0, 500)
            }
          ]
        })
      });
      
      if (!response.ok) {
        this.logger.warn('Governor API call failed', { status: response.status });
        return 5;
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content || '5';
      const score = parseInt(content.trim(), 10);
      
      if (isNaN(score) || score < 1 || score > 10) {
        this.logger.warn('Governor received invalid score', { content });
        return 5;
      }

      return score;
    } catch (error) {
      this.logger.warn('Governor scoring failed, defaulting to 5', { error });
      return 5;
    }
  }

  /**
   * Batch analyze multiple tasks for efficiency
   */
  async optimizeBatch(
    tasks: Array<{ task: SwarmTask; agent: AgentConfig }>,
    mode?: GovernorMode
  ): Promise<GovernorDecision[]> {
    return Promise.all(
      tasks.map(({ task, agent }) => this.optimizeModelSelection(task, agent, mode))
    );
  }
}

let governorInstance: EconomicGovernor | null = null;

export function getGovernor(logger: Logger, config?: Partial<GovernorConfig>): EconomicGovernor {
  if (!governorInstance) {
    governorInstance = new EconomicGovernor(logger, config);
  }
  return governorInstance;
}

export function resetGovernor(): void {
  governorInstance = null;
}
