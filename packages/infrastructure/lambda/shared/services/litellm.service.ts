/**
 * LiteLLM Service Wrapper
 * Simplified interface for LiteLLM calls used by cognition services.
 * RADIANT v6.1.0
 */

import { LiteLLMClient } from '../litellm/client';
import type { ChatCompletionRequest } from '../litellm/types';

const client = new LiteLLMClient();

interface SimpleChatRequest {
  model: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface SimpleChatResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface EmbeddingRequest {
  model: string;
  input: string | string[];
}

interface EmbeddingResponse {
  data?: Array<{ embedding: number[] }>;
}

/**
 * Call LiteLLM for chat completion
 */
export async function callLiteLLM(request: SimpleChatRequest): Promise<SimpleChatResponse> {
  const chatRequest: ChatCompletionRequest = {
    model: request.model,
    messages: request.messages,
    temperature: request.temperature,
    max_tokens: request.max_tokens,
    stream: request.stream ?? false,
  };

  const response = await client.chatCompletion(chatRequest);

  const messageContent = response.choices?.[0]?.message?.content;
  const content = typeof messageContent === 'string' ? messageContent : '';
  
  return {
    content,
    usage: response.usage ? {
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens,
    } : undefined,
  };
}

/**
 * Call LiteLLM for embeddings
 */
export async function callLiteLLMEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
  const response = await client.createEmbedding({
    model: request.model,
    input: request.input,
  });

  return {
    data: response.data?.map(d => ({ embedding: d.embedding })),
  };
}

export { client as litellmClient };
