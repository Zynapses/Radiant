/**
 * LiteLLM HTTP Client
 */

import { getConfig } from '../config';
import { logger } from '../logger';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ModelsResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  LiteLLMError,
} from './types';

const DEFAULT_TIMEOUT_MS = 60000;

export interface LiteLLMClientOptions {
  baseUrl?: string;
  timeout?: number;
  apiKey?: string;
}

export class LiteLLMClient {
  private baseUrl: string;
  private timeout: number;
  private apiKey?: string;

  constructor(options?: LiteLLMClientOptions) {
    const config = getConfig();
    this.baseUrl = options?.baseUrl || config.LITELLM_URL;
    this.timeout = options?.timeout || DEFAULT_TIMEOUT_MS;
    this.apiKey = options?.apiKey;
  }

  /**
   * Create a chat completion
   */
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.fetch('/chat/completions', {
        method: 'POST',
        body: JSON.stringify(request),
      });

      const data = await response.json() as ChatCompletionResponse | LiteLLMError;

      if ('error' in data) {
        throw new LiteLLMAPIError(data.error.message, data.error.type, data.error.code);
      }

      logger.debug('LiteLLM chat completion', {
        model: request.model,
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
        latencyMs: Date.now() - startTime,
      });

      return data;
    } catch (error) {
      logger.error('LiteLLM chat completion failed', error as Error, {
        model: request.model,
        latencyMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Create a streaming chat completion
   */
  async *chatCompletionStream(
    request: ChatCompletionRequest
  ): AsyncGenerator<ChatCompletionChunk, void, unknown> {
    const response = await this.fetch('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ ...request, stream: true }),
    });

    if (!response.body) {
      throw new LiteLLMAPIError('No response body for streaming', 'stream_error');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          
          if (!trimmed || trimmed === 'data: [DONE]') {
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const chunk = JSON.parse(jsonStr) as ChatCompletionChunk;
              yield chunk;
            } catch {
              logger.warn('Failed to parse SSE chunk', { data: jsonStr });
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<ModelsResponse> {
    const response = await this.fetch('/models', { method: 'GET' });
    const data = await response.json() as ModelsResponse | LiteLLMError;

    if ('error' in data) {
      throw new LiteLLMAPIError(data.error.message, data.error.type, data.error.code);
    }

    return data;
  }

  /**
   * Get model info
   */
  async getModel(modelId: string): Promise<{ id: string; object: string }> {
    const response = await this.fetch(`/models/${encodeURIComponent(modelId)}`, {
      method: 'GET',
    });
    const data = await response.json() as { id: string; object: string } | LiteLLMError;

    if ('error' in data) {
      throw new LiteLLMAPIError(data.error.message, data.error.type, data.error.code);
    }

    return data;
  }

  /**
   * Create embeddings
   */
  async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const response = await this.fetch('/embeddings', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    const data = await response.json() as EmbeddingResponse | LiteLLMError;

    if ('error' in data) {
      throw new LiteLLMAPIError(data.error.message, data.error.type, data.error.code);
    }

    return data;
  }

  /**
   * Health check
   */
  async health(): Promise<{ status: string }> {
    const response = await this.fetch('/health', { method: 'GET' });
    return response.json() as Promise<{ status: string }>;
  }

  /**
   * Make an HTTP request to LiteLLM
   */
  private async fetch(path: string, options: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers },
        signal: controller.signal,
      });

      if (!response.ok && response.status >= 500) {
        throw new LiteLLMAPIError(
          `LiteLLM server error: ${response.status}`,
          'server_error',
          String(response.status)
        );
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new LiteLLMAPIError('Request timeout', 'timeout', 'TIMEOUT');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export class LiteLLMAPIError extends Error {
  constructor(
    message: string,
    public readonly type: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'LiteLLMAPIError';
  }
}

// Singleton instance
let defaultClient: LiteLLMClient | null = null;

export function getLiteLLMClient(): LiteLLMClient {
  if (!defaultClient) {
    defaultClient = new LiteLLMClient();
  }
  return defaultClient;
}
