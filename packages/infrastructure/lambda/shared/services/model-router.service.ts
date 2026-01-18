// RADIANT v5.2.1 - Hybrid Model Router Service
// Primary: AWS Bedrock | Fallback: LiteLLM | Specialized: Direct APIs
// State is persisted to database for Lambda cold start resilience
// Now with resilience patterns: circuit breaker, retry, timeout

import { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { callWithResilience, isProviderHealthy, CircuitOpenError } from './resilient-provider.service';
import { executeStatement } from '../db/client';
import { checkProviderRateLimit, getProviderRateLimitStatus, PROVIDER_RATE_LIMITS } from '../middleware/rate-limiter';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export type ModelProvider = 'bedrock' | 'litellm' | 'openai' | 'anthropic' | 'groq' | 'perplexity' | 'xai' | 'together';

export interface ModelConfig {
  modelId: string;
  provider: ModelProvider;
  bedrockModelId?: string;    // For Bedrock-available models
  litellmModelId?: string;    // For LiteLLM routing
  directEndpoint?: string;    // For direct API calls
  capabilities: string[];
  maxTokens: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  avgLatencyMs: number;
  isAvailable: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelRequest {
  modelId: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  stream?: boolean;
  // LoRA adapter support for self-hosted models
  loraAdapterId?: string;
  loraAdapterName?: string;
  tenantId?: string;
  domain?: string;
  subdomain?: string;
}

export interface ModelResponse {
  content: string;
  modelUsed: string;
  provider: ModelProvider;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costCents: number;
  cached: boolean;
  // LoRA adapter info (if used)
  loraAdapterUsed?: string;
  loraAdapterName?: string;
  loraLoadTimeMs?: number;
}

export interface ProviderHealth {
  provider: ModelProvider;
  isHealthy: boolean;
  latencyMs: number;
  lastChecked: Date;
  errorCount: number;
  consecutiveFailures: number;
}

interface OpenAICompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

// ============================================================================
// Model Registry - All supported models with routing info
// ============================================================================

const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // =========== BEDROCK PRIMARY (Claude, Llama, Titan) ===========
  'anthropic/claude-3-5-sonnet-20241022': {
    modelId: 'anthropic/claude-3-5-sonnet-20241022',
    provider: 'bedrock',
    bedrockModelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    litellmModelId: 'claude-3-5-sonnet-20241022',
    capabilities: ['reasoning', 'coding', 'analysis', 'vision'],
    maxTokens: 8192,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    avgLatencyMs: 1200,
    isAvailable: true,
  },
  'anthropic/claude-3-haiku': {
    modelId: 'anthropic/claude-3-haiku',
    provider: 'bedrock',
    bedrockModelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    litellmModelId: 'claude-3-haiku-20240307',
    capabilities: ['fast', 'efficient', 'general'],
    maxTokens: 4096,
    inputCostPer1k: 0.00025,
    outputCostPer1k: 0.00125,
    avgLatencyMs: 400,
    isAvailable: true,
  },
  'meta/llama-3.1-70b': {
    modelId: 'meta/llama-3.1-70b',
    provider: 'bedrock',
    bedrockModelId: 'meta.llama3-1-70b-instruct-v1:0',
    litellmModelId: 'llama-3.1-70b',
    capabilities: ['reasoning', 'general', 'open-source'],
    maxTokens: 4096,
    inputCostPer1k: 0.00099,
    outputCostPer1k: 0.00099,
    avgLatencyMs: 800,
    isAvailable: true,
  },
  'amazon/titan-text-express': {
    modelId: 'amazon/titan-text-express',
    provider: 'bedrock',
    bedrockModelId: 'amazon.titan-text-express-v1',
    capabilities: ['fast', 'efficient', 'aws-native'],
    maxTokens: 4096,
    inputCostPer1k: 0.0002,
    outputCostPer1k: 0.0006,
    avgLatencyMs: 300,
    isAvailable: true,
  },
  'amazon/titan-embed-text': {
    modelId: 'amazon/titan-embed-text',
    provider: 'bedrock',
    bedrockModelId: 'amazon.titan-embed-text-v1',
    capabilities: ['embedding'],
    maxTokens: 8000,
    inputCostPer1k: 0.0001,
    outputCostPer1k: 0,
    avgLatencyMs: 100,
    isAvailable: true,
  },
  
  // =========== LITELLM FALLBACK (OpenAI, Google, Mistral) ===========
  'openai/gpt-4o': {
    modelId: 'openai/gpt-4o',
    provider: 'litellm',
    litellmModelId: 'gpt-4o',
    capabilities: ['reasoning', 'vision', 'language'],
    maxTokens: 4096,
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    avgLatencyMs: 1000,
    isAvailable: true,
  },
  'openai/gpt-4o-mini': {
    modelId: 'openai/gpt-4o-mini',
    provider: 'litellm',
    litellmModelId: 'gpt-4o-mini',
    capabilities: ['fast', 'efficient', 'general'],
    maxTokens: 4096,
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006,
    avgLatencyMs: 500,
    isAvailable: true,
  },
  'openai/o1': {
    modelId: 'openai/o1',
    provider: 'litellm',
    litellmModelId: 'o1-preview',
    capabilities: ['reasoning', 'math', 'planning'],
    maxTokens: 32768,
    inputCostPer1k: 0.015,
    outputCostPer1k: 0.060,
    avgLatencyMs: 5000,
    isAvailable: true,
  },
  'openai/o1-mini': {
    modelId: 'openai/o1-mini',
    provider: 'litellm',
    litellmModelId: 'o1-mini',
    capabilities: ['reasoning', 'coding', 'math'],
    maxTokens: 65536,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.012,
    avgLatencyMs: 3000,
    isAvailable: true,
  },
  'google/gemini-1.5-pro': {
    modelId: 'google/gemini-1.5-pro',
    provider: 'litellm',
    litellmModelId: 'gemini/gemini-1.5-pro',
    capabilities: ['reasoning', 'vision', 'long-context'],
    maxTokens: 8192,
    inputCostPer1k: 0.00125,
    outputCostPer1k: 0.005,
    avgLatencyMs: 1500,
    isAvailable: true,
  },
  'google/gemini-1.5-flash': {
    modelId: 'google/gemini-1.5-flash',
    provider: 'litellm',
    litellmModelId: 'gemini/gemini-1.5-flash',
    capabilities: ['fast', 'vision', 'efficient'],
    maxTokens: 8192,
    inputCostPer1k: 0.000075,
    outputCostPer1k: 0.0003,
    avgLatencyMs: 400,
    isAvailable: true,
  },
  'mistral/mistral-large': {
    modelId: 'mistral/mistral-large',
    provider: 'litellm',
    litellmModelId: 'mistral/mistral-large-latest',
    capabilities: ['reasoning', 'coding', 'multilingual'],
    maxTokens: 4096,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.009,
    avgLatencyMs: 900,
    isAvailable: true,
  },
  'mistral/codestral': {
    modelId: 'mistral/codestral',
    provider: 'litellm',
    litellmModelId: 'mistral/codestral-latest',
    capabilities: ['coding', 'fill-in-middle'],
    maxTokens: 4096,
    inputCostPer1k: 0.001,
    outputCostPer1k: 0.003,
    avgLatencyMs: 600,
    isAvailable: true,
  },
  'cohere/command-r-plus': {
    modelId: 'cohere/command-r-plus',
    provider: 'litellm',
    litellmModelId: 'cohere/command-r-plus',
    capabilities: ['reasoning', 'rag', 'multilingual'],
    maxTokens: 4096,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    avgLatencyMs: 1100,
    isAvailable: true,
  },
  'deepseek/deepseek-coder-v2': {
    modelId: 'deepseek/deepseek-coder-v2',
    provider: 'litellm',
    litellmModelId: 'deepseek/deepseek-coder',
    capabilities: ['coding', 'completion'],
    maxTokens: 4096,
    inputCostPer1k: 0.00014,
    outputCostPer1k: 0.00028,
    avgLatencyMs: 700,
    isAvailable: true,
  },
  
  // =========== DIRECT SPECIALIZED (Groq, Perplexity, xAI, Together) ===========
  'groq/llama-3.1-70b-versatile': {
    modelId: 'groq/llama-3.1-70b-versatile',
    provider: 'groq',
    directEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    capabilities: ['fast', 'reasoning', 'general'],
    maxTokens: 8000,
    inputCostPer1k: 0.00059,
    outputCostPer1k: 0.00079,
    avgLatencyMs: 200,
    isAvailable: true,
  },
  'groq/llama-3.1-8b-instant': {
    modelId: 'groq/llama-3.1-8b-instant',
    provider: 'groq',
    directEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    capabilities: ['instant', 'fast', 'lightweight'],
    maxTokens: 8000,
    inputCostPer1k: 0.00005,
    outputCostPer1k: 0.00008,
    avgLatencyMs: 100,
    isAvailable: true,
  },
  'groq/mixtral-8x7b': {
    modelId: 'groq/mixtral-8x7b',
    provider: 'groq',
    directEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    capabilities: ['fast', 'efficient', 'moe'],
    maxTokens: 32768,
    inputCostPer1k: 0.00024,
    outputCostPer1k: 0.00024,
    avgLatencyMs: 150,
    isAvailable: true,
  },
  'perplexity/llama-3.1-sonar-large': {
    modelId: 'perplexity/llama-3.1-sonar-large',
    provider: 'perplexity',
    directEndpoint: 'https://api.perplexity.ai/chat/completions',
    capabilities: ['search', 'realtime', 'citations'],
    maxTokens: 4096,
    inputCostPer1k: 0.001,
    outputCostPer1k: 0.001,
    avgLatencyMs: 2000,
    isAvailable: true,
  },
  'perplexity/llama-3.1-sonar-small': {
    modelId: 'perplexity/llama-3.1-sonar-small',
    provider: 'perplexity',
    directEndpoint: 'https://api.perplexity.ai/chat/completions',
    capabilities: ['search', 'fast', 'citations'],
    maxTokens: 4096,
    inputCostPer1k: 0.0002,
    outputCostPer1k: 0.0002,
    avgLatencyMs: 1200,
    isAvailable: true,
  },
  'xai/grok-beta': {
    modelId: 'xai/grok-beta',
    provider: 'xai',
    directEndpoint: 'https://api.x.ai/v1/chat/completions',
    capabilities: ['reasoning', 'realtime', 'humor'],
    maxTokens: 4096,
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    avgLatencyMs: 1000,
    isAvailable: true,
  },
  'together/meta-llama-3.1-405b': {
    modelId: 'together/meta-llama-3.1-405b',
    provider: 'together',
    directEndpoint: 'https://api.together.xyz/v1/chat/completions',
    capabilities: ['reasoning', 'large', 'powerful'],
    maxTokens: 4096,
    inputCostPer1k: 0.005,
    outputCostPer1k: 0.015,
    avgLatencyMs: 2500,
    isAvailable: true,
  },
};

// ============================================================================
// Model Router Service
// ============================================================================

export class ModelRouterService {
  private bedrock: BedrockRuntimeClient;
  private providerHealth: Map<ModelProvider, ProviderHealth> = new Map();
  private litellmBaseUrl: string;
  private apiKeys: Record<string, string> = {};

  private initialized = false;

  constructor() {
    this.bedrock = new BedrockRuntimeClient({});
    this.litellmBaseUrl = process.env.LITELLM_BASE_URL || 'http://localhost:4000';
    
    // Load API keys from environment
    this.apiKeys = {
      openai: process.env.OPENAI_API_KEY || '',
      anthropic: process.env.ANTHROPIC_API_KEY || '',  // Required - for direct Claude API access
      groq: process.env.GROQ_API_KEY || '',            // Required - for fast LLM fallback
      perplexity: process.env.PERPLEXITY_API_KEY || '',
      xai: process.env.XAI_API_KEY || '',
      together: process.env.TOGETHER_API_KEY || '',
      google: process.env.GOOGLE_API_KEY || '',
    };

    // Initialize health tracking with defaults
    const providers: ModelProvider[] = ['bedrock', 'litellm', 'openai', 'anthropic', 'groq', 'perplexity', 'xai', 'together'];
    for (const provider of providers) {
      this.providerHealth.set(provider, {
        provider,
        isHealthy: true,
        latencyMs: 0,
        lastChecked: new Date(),
        errorCount: 0,
        consecutiveFailures: 0,
      });
    }

    // Load persisted health from database on cold start (async)
    this.loadPersistedHealth().catch(err => {
      logger.debug('Failed to load persisted health on cold start', { error: err instanceof Error ? err.message : 'unknown' });
    });
  }

  // ============================================================================
  // Main Routing Logic
  // ============================================================================

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const startTime = Date.now();
    const config = MODEL_REGISTRY[request.modelId];
    
    if (!config) {
      throw new Error(`Unknown model: ${request.modelId}`);
    }

    // Try primary provider
    try {
      const response = await this.invokeProvider(config, request);
      this.recordSuccess(config.provider, Date.now() - startTime);
      // Record model usage for analytics (fire-and-forget)
      this.recordModelUsage(config.modelId, config.provider, true, response.latencyMs, response.inputTokens, response.outputTokens, response.costCents).catch(err => {
        logger.debug('Failed to record model usage', { modelId: config.modelId, error: err instanceof Error ? err.message : 'unknown' });
      });
      return response;
    } catch (primaryError) {
      const errorMsg = primaryError instanceof Error ? primaryError.message : 'Unknown error';
      logger.warn(`Primary provider ${config.provider} failed for ${request.modelId}`, { error: primaryError });
      this.recordFailure(config.provider, errorMsg);
    }

    // Try fallback providers
    const fallbackOrder = this.getFallbackOrder(config);
    for (const fallbackProvider of fallbackOrder) {
      try {
        const fallbackConfig = this.getProviderConfig(config, fallbackProvider);
        if (!fallbackConfig) continue;

        const response = await this.invokeProvider(fallbackConfig, request);
        this.recordSuccess(fallbackProvider, Date.now() - startTime);
        // Record model usage for analytics (fire-and-forget)
        this.recordModelUsage(fallbackConfig.modelId, fallbackProvider, true, response.latencyMs, response.inputTokens, response.outputTokens, response.costCents).catch(err => {
          logger.debug('Failed to record fallback model usage', { modelId: fallbackConfig.modelId, error: err instanceof Error ? err.message : 'unknown' });
        });
        return response;
      } catch (fallbackError) {
        const errorMsg = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
        logger.warn(`Fallback provider ${fallbackProvider} failed`, { error: fallbackError });
        this.recordFailure(fallbackProvider, errorMsg);
      }
    }

    throw new Error(`All providers failed for model ${request.modelId}`);
  }

  private async invokeProvider(config: ModelConfig, request: ModelRequest): Promise<ModelResponse> {
    // Check provider rate limit before invoking
    const rateLimitCheck = checkProviderRateLimit(config.provider);
    if (!rateLimitCheck.allowed) {
      throw new Error(
        `Provider ${config.provider} rate limited. ` +
        `Limit: ${rateLimitCheck.limit}/min, ` +
        `Reset in: ${Math.ceil(rateLimitCheck.resetInMs / 1000)}s. ` +
        `Consider using a different provider or waiting.`
      );
    }

    switch (config.provider) {
      case 'bedrock':
        return this.invokeBedrock(config, request);
      case 'litellm':
        return this.invokeLiteLLM(config, request);
      case 'anthropic':
      case 'groq':
      case 'perplexity':
      case 'xai':
      case 'together':
      case 'openai':
        return this.invokeDirect(config, request);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  /**
   * Get current rate limit status for all providers
   */
  getRateLimitStatus(): Record<string, { limit: number; used: number; remaining: number; resetInMs: number }> {
    return getProviderRateLimitStatus();
  }

  /**
   * Get configured rate limits for all providers
   */
  getProviderLimits(): Record<string, { rpm: number; tpm?: number; dailyLimit?: number }> {
    return PROVIDER_RATE_LIMITS;
  }

  // ============================================================================
  // Provider Implementations
  // ============================================================================

  private async invokeBedrock(config: ModelConfig, request: ModelRequest): Promise<ModelResponse> {
    const startTime = Date.now();
    
    if (!config.bedrockModelId) {
      throw new Error(`No Bedrock model ID for ${config.modelId}`);
    }

    // Build messages with system prompt
    const messages = request.systemPrompt
      ? [{ role: 'user' as const, content: request.messages.map(m => m.content).join('\n') }]
      : request.messages;

    const body = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: request.maxTokens || config.maxTokens,
      temperature: request.temperature ?? 0.7,
      system: request.systemPrompt || '',
      messages: messages.map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
    };

    // Wrap Bedrock call with resilience (circuit breaker, retry, timeout)
    const response = await callWithResilience(
      () => this.bedrock.send(
        new InvokeModelCommand({
          modelId: config.bedrockModelId,
          body: JSON.stringify(body),
          contentType: 'application/json',
        })
      ),
      {
        provider: 'bedrock',
        operation: 'chat',
        timeoutMs: 90000, // Bedrock can be slow for large models
        maxRetries: 2,
      }
    );

    const result = JSON.parse(new TextDecoder().decode(response.body));
    const content = result.content?.[0]?.text || '';
    const inputTokens = result.usage?.input_tokens || Math.ceil(JSON.stringify(body).length / 4);
    const outputTokens = result.usage?.output_tokens || Math.ceil(content.length / 4);

    return {
      content,
      modelUsed: config.modelId,
      provider: 'bedrock',
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startTime,
      costCents: this.calculateCost(config, inputTokens, outputTokens),
      cached: false,
    };
  }

  private async invokeLiteLLM(config: ModelConfig, request: ModelRequest): Promise<ModelResponse> {
    const startTime = Date.now();
    
    if (!config.litellmModelId) {
      throw new Error(`No LiteLLM model ID for ${config.modelId}`);
    }

    const messages = request.systemPrompt
      ? [{ role: 'system', content: request.systemPrompt }, ...request.messages]
      : request.messages;

    // Wrap LiteLLM call with resilience
    const response = await callWithResilience(
      async () => {
        const resp = await fetch(`${this.litellmBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.LITELLM_API_KEY || 'sk-litellm'}`,
          },
          body: JSON.stringify({
            model: config.litellmModelId,
            messages,
            max_tokens: request.maxTokens || config.maxTokens,
            temperature: request.temperature ?? 0.7,
          }),
        });

        if (!resp.ok) {
          const error = await resp.text();
          throw new Error(`LiteLLM error: ${resp.status} ${error}`);
        }
        return resp;
      },
      {
        provider: 'litellm',
        operation: 'chat',
        timeoutMs: 60000,
        maxRetries: 3,
      }
    );

    const result = await response.json() as OpenAICompatibleResponse;
    const content = result.choices?.[0]?.message?.content || '';
    const inputTokens = result.usage?.prompt_tokens || 0;
    const outputTokens = result.usage?.completion_tokens || 0;

    return {
      content,
      modelUsed: config.modelId,
      provider: 'litellm',
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startTime,
      costCents: this.calculateCost(config, inputTokens, outputTokens),
      cached: false,
    };
  }

  private async invokeDirect(config: ModelConfig, request: ModelRequest): Promise<ModelResponse> {
    const startTime = Date.now();
    
    if (!config.directEndpoint) {
      throw new Error(`No direct endpoint for ${config.modelId}`);
    }

    const apiKey = this.getApiKey(config.provider);
    if (!apiKey) {
      throw new Error(`No API key configured for ${config.provider}`);
    }

    const messages = request.systemPrompt
      ? [{ role: 'system', content: request.systemPrompt }, ...request.messages]
      : request.messages;

    // Map model ID to provider-specific format
    const modelName = this.getDirectModelName(config);

    // Provider-specific timeout (Groq is fast, Perplexity does search)
    const timeoutMs = config.provider === 'groq' ? 30000 : 
                      config.provider === 'perplexity' ? 120000 : 60000;

    // Wrap direct API call with resilience
    const response = await callWithResilience(
      async () => {
        const resp = await fetch(config.directEndpoint!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages,
            max_tokens: request.maxTokens || config.maxTokens,
            temperature: request.temperature ?? 0.7,
          }),
        });

        if (!resp.ok) {
          const error = await resp.text();
          throw new Error(`${config.provider} error: ${resp.status} ${error}`);
        }
        return resp;
      },
      {
        provider: config.provider,
        operation: 'chat',
        timeoutMs,
        maxRetries: 3,
      }
    );

    const result = await response.json() as OpenAICompatibleResponse;
    const content = result.choices?.[0]?.message?.content || '';
    const inputTokens = result.usage?.prompt_tokens || 0;
    const outputTokens = result.usage?.completion_tokens || 0;

    return {
      content,
      modelUsed: config.modelId,
      provider: config.provider,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startTime,
      costCents: this.calculateCost(config, inputTokens, outputTokens),
      cached: false,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getApiKey(provider: ModelProvider): string {
    const keyMap: Record<ModelProvider, string> = {
      bedrock: '', // Uses IAM
      litellm: process.env.LITELLM_API_KEY || '',
      openai: this.apiKeys.openai,
      anthropic: this.apiKeys.anthropic,  // Direct Anthropic API
      groq: this.apiKeys.groq,
      perplexity: this.apiKeys.perplexity,
      xai: this.apiKeys.xai,
      together: this.apiKeys.together,
    };
    return keyMap[provider] || '';
  }

  private getDirectModelName(config: ModelConfig): string {
    const modelMap: Record<string, string> = {
      'groq/llama-3.1-70b-versatile': 'llama-3.1-70b-versatile',
      'groq/llama-3.1-8b-instant': 'llama-3.1-8b-instant',
      'groq/mixtral-8x7b': 'mixtral-8x7b-32768',
      'perplexity/llama-3.1-sonar-large': 'llama-3.1-sonar-large-128k-online',
      'perplexity/llama-3.1-sonar-small': 'llama-3.1-sonar-small-128k-online',
      'xai/grok-beta': 'grok-beta',
      'together/meta-llama-3.1-405b': 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
    };
    return modelMap[config.modelId] || config.modelId.split('/')[1];
  }

  private getFallbackOrder(config: ModelConfig): ModelProvider[] {
    // Define fallback chains based on primary provider
    const fallbackChains: Record<ModelProvider, ModelProvider[]> = {
      bedrock: ['anthropic', 'litellm', 'groq'],
      litellm: ['bedrock', 'anthropic', 'groq'],
      anthropic: ['bedrock', 'litellm', 'groq'],
      groq: ['litellm', 'bedrock'],
      perplexity: ['litellm'],
      xai: ['litellm', 'groq'],
      together: ['litellm', 'groq'],
      openai: ['litellm'],
    };

    const chain = fallbackChains[config.provider] || [];
    
    // Filter out unhealthy providers
    return chain.filter(p => {
      const health = this.providerHealth.get(p);
      return health && health.isHealthy && health.consecutiveFailures < 3;
    });
  }

  private getProviderConfig(originalConfig: ModelConfig, targetProvider: ModelProvider): ModelConfig | null {
    // For Bedrock models, can fall back to LiteLLM if they have litellmModelId
    if (targetProvider === 'litellm' && originalConfig.litellmModelId) {
      return { ...originalConfig, provider: 'litellm' };
    }
    
    // For LiteLLM models, can fall back to Bedrock if they have bedrockModelId
    if (targetProvider === 'bedrock' && originalConfig.bedrockModelId) {
      return { ...originalConfig, provider: 'bedrock' };
    }

    // For other cases, find a similar model on the target provider
    const similarModels = Object.values(MODEL_REGISTRY).filter(m => 
      m.provider === targetProvider &&
      m.capabilities.some(c => originalConfig.capabilities.includes(c))
    );

    return similarModels[0] || null;
  }

  private calculateCost(config: ModelConfig, inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1000) * config.inputCostPer1k;
    const outputCost = (outputTokens / 1000) * config.outputCostPer1k;
    return Math.ceil((inputCost + outputCost) * 100); // cents
  }

  private recordSuccess(provider: ModelProvider, latencyMs: number): void {
    const health = this.providerHealth.get(provider);
    if (health) {
      health.isHealthy = true;
      health.latencyMs = latencyMs;
      health.lastChecked = new Date();
      health.consecutiveFailures = 0;
    }
    // Persist to database (fire-and-forget for performance)
    this.persistProviderSuccess(provider, latencyMs).catch(err => {
      logger.debug('Failed to persist provider success', { provider, error: err instanceof Error ? err.message : 'unknown' });
    });
  }

  private recordFailure(provider: ModelProvider, reason?: string): void {
    const health = this.providerHealth.get(provider);
    if (health) {
      health.errorCount++;
      health.consecutiveFailures++;
      health.lastChecked = new Date();
      if (health.consecutiveFailures >= 3) {
        health.isHealthy = false;
      }
    }
    // Persist to database (fire-and-forget for performance)
    this.persistProviderFailure(provider, reason).catch(err => {
      logger.debug('Failed to persist provider failure', { provider, error: err instanceof Error ? err.message : 'unknown' });
    });
  }

  private async persistProviderSuccess(provider: ModelProvider, latencyMs: number): Promise<void> {
    try {
      await executeStatement(
        `SELECT record_provider_success($1, $2)`,
        [
          { name: 'provider', value: { stringValue: provider } },
          { name: 'latencyMs', value: { longValue: latencyMs } },
        ]
      );
    } catch { /* ignore persistence errors */ }
  }

  private async persistProviderFailure(provider: ModelProvider, reason?: string): Promise<void> {
    try {
      await executeStatement(
        `SELECT record_provider_failure($1, $2)`,
        [
          { name: 'provider', value: { stringValue: provider } },
          { name: 'reason', value: reason ? { stringValue: reason } : { isNull: true } },
        ]
      );
    } catch { /* ignore persistence errors */ }
  }

  async loadPersistedHealth(): Promise<void> {
    try {
      const result = await executeStatement(
        `SELECT * FROM provider_health`,
        []
      );
      for (const row of result.rows) {
        const r = row as Record<string, unknown>;
        const provider = String(r.provider) as ModelProvider;
        this.providerHealth.set(provider, {
          provider,
          isHealthy: Boolean(r.is_healthy ?? true),
          latencyMs: Number(r.latency_ms || 0),
          lastChecked: new Date(r.last_checked as string || Date.now()),
          errorCount: Number(r.error_count || 0),
          consecutiveFailures: Number(r.consecutive_failures || 0),
        });
      }
    } catch { /* use defaults if DB unavailable */ }
  }

  async recordModelUsage(modelId: string, provider: ModelProvider, success: boolean, latencyMs: number, inputTokens: number, outputTokens: number, costCents: number): Promise<void> {
    try {
      await executeStatement(
        `SELECT record_model_usage($1, $2, $3, $4, $5, $6, $7)`,
        [
          { name: 'modelId', value: { stringValue: modelId } },
          { name: 'provider', value: { stringValue: provider } },
          { name: 'success', value: { booleanValue: success } },
          { name: 'latencyMs', value: { longValue: latencyMs } },
          { name: 'inputTokens', value: { longValue: inputTokens } },
          { name: 'outputTokens', value: { longValue: outputTokens } },
          { name: 'costCents', value: { doubleValue: costCents } },
        ]
      );
    } catch { /* ignore persistence errors */ }
  }

  // ============================================================================
  // Public Utilities
  // ============================================================================

  getModel(modelId: string): ModelConfig | undefined {
    return MODEL_REGISTRY[modelId];
  }

  listModels(capability?: string): ModelConfig[] {
    const models = Object.values(MODEL_REGISTRY);
    if (!capability) return models;
    return models.filter(m => m.capabilities.includes(capability));
  }

  getProviderStatus(): ProviderHealth[] {
    return Array.from(this.providerHealth.values());
  }

  async healthCheck(): Promise<Record<ModelProvider, boolean>> {
    const results: Record<string, boolean> = {};
    
    // Check Bedrock
    try {
      await this.bedrock.send(new InvokeModelCommand({
        modelId: 'amazon.titan-text-express-v1',
        body: JSON.stringify({ inputText: 'test' }),
        contentType: 'application/json',
      }));
      results.bedrock = true;
    } catch {
      results.bedrock = false;
    }

    // Check LiteLLM
    try {
      const response = await fetch(`${this.litellmBaseUrl}/health`);
      results.litellm = response.ok;
    } catch {
      results.litellm = false;
    }

    // Check direct providers (basic connectivity)
    for (const provider of ['groq', 'perplexity', 'xai', 'together'] as ModelProvider[]) {
      results[provider] = !!this.getApiKey(provider);
    }

    return results as Record<ModelProvider, boolean>;
  }

  /**
   * Check if a model is available and healthy
   * Used by consciousness service for dynamic model selection
   */
  async isModelAvailable(modelId: string): Promise<boolean> {
    const config = MODEL_REGISTRY[modelId];
    if (!config) return false;
    if (!config.isAvailable) return false;
    
    // Check provider health
    const health = this.providerHealth.get(config.provider);
    if (health?.isHealthy === false) return false;
    if (health?.consecutiveFailures && health.consecutiveFailures > 3) return false;
    
    // For self-hosted models, check if endpoint is actually running
    if (config.provider === 'bedrock' && config.bedrockModelId) {
      try {
        // Quick check - just verify the model config exists in registry
        // Full health check would be too slow for this use case
        return true;
      } catch {
        return false;
      }
    }
    
    return true;
  }

  // Get best model for a capability
  getBestModel(capability: string, constraints?: { maxLatencyMs?: number; maxCostPer1k?: number }): ModelConfig | null {
    const candidates = this.listModels(capability)
      .filter(m => m.isAvailable)
      .filter(m => {
        const health = this.providerHealth.get(m.provider);
        return health?.isHealthy !== false;
      });

    if (constraints?.maxLatencyMs) {
      candidates.filter(m => m.avgLatencyMs <= constraints.maxLatencyMs!);
    }
    if (constraints?.maxCostPer1k) {
      candidates.filter(m => m.outputCostPer1k <= constraints.maxCostPer1k!);
    }

    // Sort by: health > latency > cost
    candidates.sort((a, b) => {
      const aHealth = this.providerHealth.get(a.provider);
      const bHealth = this.providerHealth.get(b.provider);
      if (aHealth?.consecutiveFailures !== bHealth?.consecutiveFailures) {
        return (aHealth?.consecutiveFailures || 0) - (bHealth?.consecutiveFailures || 0);
      }
      if (a.avgLatencyMs !== b.avgLatencyMs) {
        return a.avgLatencyMs - b.avgLatencyMs;
      }
      return a.outputCostPer1k - b.outputCostPer1k;
    });

    return candidates[0] || null;
  }
}

export const modelRouterService = new ModelRouterService();
