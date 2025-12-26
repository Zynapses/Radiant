/**
 * RADIANT v4.18.0 - AI Provider Configuration
 * SINGLE SOURCE OF TRUTH
 */

import type { AIProvider } from '../types';

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    hipaaCompliant: true,
    capabilities: ['text_generation', 'chat_completion', 'embeddings', 'image_generation', 'audio_transcription', 'function_calling'],
    status: 'active',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com',
    hipaaCompliant: true,
    capabilities: ['text_generation', 'chat_completion', 'reasoning', 'function_calling'],
    status: 'active',
  },
  {
    id: 'google',
    name: 'Google AI',
    apiKeyEnvVar: 'GOOGLE_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com',
    hipaaCompliant: true,
    capabilities: ['text_generation', 'chat_completion', 'embeddings', 'image_analysis', 'reasoning'],
    status: 'active',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    apiKeyEnvVar: 'MISTRAL_API_KEY',
    baseUrl: 'https://api.mistral.ai/v1',
    hipaaCompliant: false,
    capabilities: ['text_generation', 'chat_completion', 'embeddings', 'code_generation'],
    status: 'active',
  },
  {
    id: 'cohere',
    name: 'Cohere',
    apiKeyEnvVar: 'COHERE_API_KEY',
    baseUrl: 'https://api.cohere.ai/v1',
    hipaaCompliant: false,
    capabilities: ['text_generation', 'chat_completion', 'embeddings', 'search'],
    status: 'active',
  },
  {
    id: 'replicate',
    name: 'Replicate',
    apiKeyEnvVar: 'REPLICATE_API_KEY',
    baseUrl: 'https://api.replicate.com/v1',
    hipaaCompliant: false,
    capabilities: ['image_generation', 'video_generation', 'audio_generation', '3d_generation'],
    status: 'active',
  },
  {
    id: 'stability',
    name: 'Stability AI',
    apiKeyEnvVar: 'STABILITY_API_KEY',
    baseUrl: 'https://api.stability.ai',
    hipaaCompliant: false,
    capabilities: ['image_generation', 'video_generation'],
    status: 'active',
  },
  {
    id: 'aws-bedrock',
    name: 'AWS Bedrock',
    apiKeyEnvVar: 'AWS_BEDROCK_ENABLED',
    baseUrl: 'bedrock-runtime.{region}.amazonaws.com',
    hipaaCompliant: true,
    capabilities: ['text_generation', 'chat_completion', 'embeddings', 'image_generation'],
    status: 'active',
  },
];

export function getProviderById(id: string): AIProvider | undefined {
  return AI_PROVIDERS.find(p => p.id === id);
}

export function getHipaaCompliantProviders(): AIProvider[] {
  return AI_PROVIDERS.filter(p => p.hipaaCompliant);
}

export function getActiveProviders(): AIProvider[] {
  return AI_PROVIDERS.filter(p => p.status === 'active');
}
