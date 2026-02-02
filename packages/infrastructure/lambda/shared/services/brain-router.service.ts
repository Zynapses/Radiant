/**
 * Brain Router Service
 * 
 * Routes AI tasks to appropriate models based on task type and tenant configuration.
 * Integrates with the Economic Governor for cost-effective model selection.
 * 
 * @version 1.0.0
 * @since v6.4.2
 */

import { Logger } from '../logger';
import { executeStatement, stringParam, longParam } from '../db';

const logger = new Logger({ service: 'brain-router-service' });

export interface BrainRouteRequest {
  tenantId: string;
  userId: string;
  taskType: 'coding' | 'data_analysis' | 'writing' | 'chat' | 'reasoning' | 'creative';
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  modelOverride?: string;
}

export interface BrainRouteResult {
  response: string;
  selectedModel: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cost: number;
}

interface TaskModelMapping {
  taskType: string;
  preferredModels: string[];
  fallbackModel: string;
  maxCostCents: number;
}

const DEFAULT_TASK_MAPPINGS: TaskModelMapping[] = [
  {
    taskType: 'coding',
    preferredModels: ['claude-3-5-sonnet-20241022', 'gpt-4-turbo', 'claude-3-opus-20240229'],
    fallbackModel: 'claude-3-haiku-20240307',
    maxCostCents: 50,
  },
  {
    taskType: 'data_analysis',
    preferredModels: ['claude-3-5-sonnet-20241022', 'gpt-4-turbo'],
    fallbackModel: 'gpt-3.5-turbo',
    maxCostCents: 30,
  },
  {
    taskType: 'writing',
    preferredModels: ['claude-3-5-sonnet-20241022', 'gpt-4-turbo'],
    fallbackModel: 'claude-3-haiku-20240307',
    maxCostCents: 20,
  },
  {
    taskType: 'chat',
    preferredModels: ['claude-3-haiku-20240307', 'gpt-3.5-turbo'],
    fallbackModel: 'gpt-3.5-turbo',
    maxCostCents: 5,
  },
  {
    taskType: 'reasoning',
    preferredModels: ['claude-3-opus-20240229', 'gpt-4-turbo', 'claude-3-5-sonnet-20241022'],
    fallbackModel: 'claude-3-5-sonnet-20241022',
    maxCostCents: 100,
  },
  {
    taskType: 'creative',
    preferredModels: ['claude-3-5-sonnet-20241022', 'gpt-4-turbo'],
    fallbackModel: 'claude-3-haiku-20240307',
    maxCostCents: 30,
  },
];

class BrainRouterService {
  
  /**
   * Route a request to the most appropriate model based on task type
   */
  async route(request: BrainRouteRequest): Promise<BrainRouteResult> {
    const startTime = Date.now();
    
    logger.info('Routing brain request', {
      tenantId: request.tenantId,
      taskType: request.taskType,
      promptLength: request.prompt.length,
    });

    // Get model selection for task type
    const selectedModel = await this.selectModel(request);
    
    // Execute the request through the AI gateway
    const result = await this.executeRequest(request, selectedModel);
    
    const latencyMs = Date.now() - startTime;
    
    // Log usage for billing
    await this.logUsage(request, result, latencyMs);
    
    return {
      ...result,
      selectedModel,
      latencyMs,
    };
  }

  /**
   * Select the best model for the given request
   */
  private async selectModel(request: BrainRouteRequest): Promise<string> {
    // If model override specified, use it
    if (request.modelOverride) {
      return request.modelOverride;
    }

    // Get tenant-specific model preferences
    const tenantPrefs = await this.getTenantModelPreferences(request.tenantId);
    
    // Get task mapping
    const taskMapping = DEFAULT_TASK_MAPPINGS.find(m => m.taskType === request.taskType)
      || DEFAULT_TASK_MAPPINGS.find(m => m.taskType === 'chat')!;

    // Check tenant preferences first
    if (tenantPrefs && tenantPrefs[request.taskType]) {
      return tenantPrefs[request.taskType];
    }

    // Check model availability and select first available preferred model
    for (const model of taskMapping.preferredModels) {
      const isAvailable = await this.checkModelAvailability(request.tenantId, model);
      if (isAvailable) {
        return model;
      }
    }

    // Fall back to default
    return taskMapping.fallbackModel;
  }

  /**
   * Get tenant-specific model preferences
   */
  private async getTenantModelPreferences(
    tenantId: string
  ): Promise<Record<string, string> | null> {
    try {
      const result = await executeStatement<{ model_preferences: string }>(
        `SELECT model_preferences FROM tenant_ai_config WHERE tenant_id = $1::uuid`,
        [stringParam('tenantId', tenantId)]
      );
      
      if (result.rows && result.rows.length > 0) {
        const prefs = result.rows[0].model_preferences;
        return prefs ? JSON.parse(prefs) : null;
      }
      return null;
    } catch (error) {
      logger.warn('Failed to get tenant model preferences', { tenantId, error });
      return null;
    }
  }

  /**
   * Check if a model is available for the tenant
   */
  private async checkModelAvailability(tenantId: string, modelId: string): Promise<boolean> {
    try {
      const result = await executeStatement(
        `SELECT 1 FROM tenant_model_access 
         WHERE tenant_id = $1::uuid 
         AND model_id = $2 
         AND is_enabled = true`,
        [
          stringParam('tenantId', tenantId),
          stringParam('modelId', modelId),
        ]
      );
      
      return (result.rows?.length ?? 0) > 0;
    } catch (error) {
      // Default to available if check fails
      logger.warn('Model availability check failed, assuming available', { tenantId, modelId, error });
      return true;
    }
  }

  /**
   * Execute the AI request through the gateway
   */
  private async executeRequest(
    request: BrainRouteRequest,
    modelId: string
  ): Promise<Omit<BrainRouteResult, 'selectedModel' | 'latencyMs'>> {
    // Get the AI gateway URL from environment
    const gatewayUrl = process.env.AI_GATEWAY_URL || process.env.LITELLM_PROXY_URL;
    
    if (!gatewayUrl) {
      throw new Error('AI Gateway URL not configured');
    }

    const response = await fetch(`${gatewayUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_GATEWAY_API_KEY || ''}`,
        'X-Tenant-ID': request.tenantId,
        'X-User-ID': request.userId,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: request.prompt }],
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Gateway request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    
    return {
      response: data.choices?.[0]?.message?.content || '',
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      cost: this.calculateCost(modelId, data.usage?.prompt_tokens || 0, data.usage?.completion_tokens || 0),
    };
  }

  /**
   * Calculate cost for the request
   */
  private calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    // Cost per 1M tokens (simplified pricing)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-3-opus-20240229': { input: 15, output: 75 },
      'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
      'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
      'gpt-4-turbo': { input: 10, output: 30 },
      'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    };

    const modelPricing = pricing[modelId] || pricing['gpt-3.5-turbo'];
    
    return (
      (inputTokens / 1_000_000) * modelPricing.input +
      (outputTokens / 1_000_000) * modelPricing.output
    );
  }

  /**
   * Log usage for billing and analytics
   */
  private async logUsage(
    request: BrainRouteRequest,
    result: Omit<BrainRouteResult, 'selectedModel' | 'latencyMs'>,
    latencyMs: number
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO ai_usage_log (
          tenant_id, user_id, task_type, model_id,
          input_tokens, output_tokens, cost_usd, latency_ms, created_at
        ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          stringParam('tenantId', request.tenantId),
          stringParam('userId', request.userId),
          stringParam('taskType', request.taskType),
          stringParam('modelId', 'unknown'),
          longParam('inputTokens', result.inputTokens),
          longParam('outputTokens', result.outputTokens),
          stringParam('cost', String(result.cost)),
          longParam('latency', latencyMs),
        ]
      );
    } catch (error) {
      logger.warn('Failed to log AI usage', { error });
    }
  }
}

export const brainRouter = new BrainRouterService();
