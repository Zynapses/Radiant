/**
 * RADIANT SDK Client
 */

import type {
  RadiantConfig,
  ChatCompletionRequest,
  ChatCompletionResponse,
  Model,
  ModelList,
  CreditBalance,
  ApiResponse,
  StreamingChatCompletionResponse,
} from './types';

import {
  APIError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  InsufficientCreditsError,
  NotFoundError,
  ServerError,
} from './errors';

const DEFAULT_BASE_URL = process.env.RADIANT_API_URL || '';
const DEFAULT_VERSION = 'v2';
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_MAX_RETRIES = 3;

export class RadiantClient {
  private readonly config: Required<RadiantConfig>;
  
  public readonly chat: ChatResource;
  public readonly models: ModelsResource;
  public readonly billing: BillingResource;

  constructor(config: RadiantConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }

    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
      version: config.version || DEFAULT_VERSION,
      timeout: config.timeout || DEFAULT_TIMEOUT,
      maxRetries: config.maxRetries || DEFAULT_MAX_RETRIES,
      headers: config.headers || {},
      debug: config.debug || false,
    };

    // Initialize resources
    this.chat = new ChatResource(this);
    this.models = new ModelsResource(this);
    this.billing = new BillingResource(this);
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { stream?: boolean }
  ): Promise<T> {
    const url = `${this.config.baseUrl}/${this.config.version}${path}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'X-Radiant-SDK': 'js',
      'X-Radiant-SDK-Version': '4.18.0',
      ...this.config.headers,
    };

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (this.config.debug) {
          console.log(`[RADIANT] ${method} ${url}`, body);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const requestId = response.headers.get('x-request-id') || undefined;

        if (!response.ok) {
          const error = await this.handleErrorResponse(response, requestId);
          
          // Retry on 5xx errors or rate limits
          if (response.status >= 500 || response.status === 429) {
            lastError = error;
            const delay = this.getRetryDelay(attempt, response);
            await this.sleep(delay);
            continue;
          }
          
          throw error;
        }

        if (options?.stream) {
          return response as unknown as T;
        }

        const data = await response.json();
        
        if (this.config.debug) {
          console.log(`[RADIANT] Response:`, data);
        }

        return data as T;
      } catch (error) {
        if (error instanceof APIError) {
          throw error;
        }
        
        lastError = error as Error;
        
        if (attempt < this.config.maxRetries) {
          await this.sleep(this.getRetryDelay(attempt));
          continue;
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  private async handleErrorResponse(
    response: Response,
    requestId?: string
  ): Promise<APIError> {
    let errorData: { error?: { message?: string; code?: string; details?: unknown[] } } = {
      error: { message: 'Unknown error' },
    };
    
    try {
      const json = await response.json() as { error?: { message?: string; code?: string; details?: unknown[] } };
      errorData = json;
    } catch {
      // Keep default error
    }

    const message = errorData.error?.message || `HTTP ${response.status}`;
    const code = errorData.error?.code || 'unknown_error';

    switch (response.status) {
      case 401:
        return new AuthenticationError(message, requestId);
      
      case 402:
        return new InsufficientCreditsError(message, 0, 0, requestId);
      
      case 404:
        return new NotFoundError(message, requestId);
      
      case 429: {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
        return new RateLimitError(message, retryAfter, requestId);
      }
      
      case 400: {
        const errors = (errorData.error?.details as Array<{ field: string; message: string }>) || [];
        return new ValidationError(message, errors, requestId);
      }
      
      case 500:
      case 502:
      case 503:
      case 504:
        return new ServerError(message, requestId);
      
      default:
        return new APIError(message, response.status, code, requestId);
    }
  }

  private getRetryDelay(attempt: number, response?: Response): number {
    // Check for Retry-After header
    if (response) {
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter) {
        return parseInt(retryAfter, 10) * 1000;
      }
    }
    
    // Exponential backoff with jitter
    const baseDelay = Math.min(1000 * Math.pow(2, attempt), 30000);
    const jitter = Math.random() * 1000;
    return baseDelay + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Chat Completions Resource
 */
class ChatResource {
  constructor(private client: RadiantClient) {}

  async create(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (request.stream) {
      throw new Error('Use createStream() for streaming responses');
    }
    
    return this.client.request<ChatCompletionResponse>(
      'POST',
      '/chat/completions',
      request
    );
  }

  async *createStream(
    request: Omit<ChatCompletionRequest, 'stream'>
  ): AsyncGenerator<StreamingChatCompletionResponse> {
    const response = await this.client.request<Response>(
      'POST',
      '/chat/completions',
      { ...request, stream: true },
      { stream: true }
    );

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data) as StreamingChatCompletionResponse;
            yield parsed;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

/**
 * Models Resource
 */
class ModelsResource {
  constructor(private client: RadiantClient) {}

  async list(): Promise<ModelList> {
    return this.client.request<ModelList>('GET', '/models');
  }

  async get(modelId: string): Promise<Model> {
    const response = await this.client.request<ApiResponse<Model>>(
      'GET',
      `/models/${encodeURIComponent(modelId)}`
    );
    return response.data;
  }
}

/**
 * Billing Resource
 */
class BillingResource {
  constructor(private client: RadiantClient) {}

  async getCredits(): Promise<CreditBalance> {
    const response = await this.client.request<ApiResponse<CreditBalance>>(
      'GET',
      '/billing/credits'
    );
    return response.data;
  }

  async getUsage(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse<unknown>> {
    const searchParams = new URLSearchParams();
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    
    const query = searchParams.toString();
    return this.client.request<ApiResponse<unknown>>(
      'GET',
      `/billing/usage${query ? `?${query}` : ''}`
    );
  }
}
