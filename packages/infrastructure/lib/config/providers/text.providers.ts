/**
 * Text Generation Providers - RADIANT v4.18.0
 * OpenAI, Anthropic, Google, xAI, DeepSeek, Mistral
 */

import { ExternalProvider, ExternalModel } from './index';

const MARKUP = 1.40;

// ============================================================================
// OPENAI MODELS
// ============================================================================

const OPENAI_MODELS: ExternalModel[] = [
  {
    id: 'openai-gpt-4o',
    modelId: 'gpt-4o',
    litellmId: 'gpt-4o',
    name: 'gpt-4o',
    displayName: 'GPT-4o',
    description: 'Most capable GPT-4 model with vision and function calling',
    category: 'text_generation',
    capabilities: ['chat', 'vision', 'function_calling', 'json_mode', 'streaming'],
    contextWindow: 128000,
    maxOutput: 16384,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.0025,
      outputCostPer1k: 0.01,
      markup: MARKUP,
      billedInputPer1k: 0.0025 * MARKUP,
      billedOutputPer1k: 0.01 * MARKUP,
    },
  },
  {
    id: 'openai-gpt-4o-mini',
    modelId: 'gpt-4o-mini',
    litellmId: 'gpt-4o-mini',
    name: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    description: 'Smaller, faster, cheaper GPT-4o variant',
    category: 'text_generation',
    capabilities: ['chat', 'vision', 'function_calling', 'json_mode', 'streaming'],
    contextWindow: 128000,
    maxOutput: 16384,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.00015,
      outputCostPer1k: 0.0006,
      markup: MARKUP,
      billedInputPer1k: 0.00015 * MARKUP,
      billedOutputPer1k: 0.0006 * MARKUP,
    },
  },
  {
    id: 'openai-o1',
    modelId: 'o1',
    litellmId: 'o1',
    name: 'o1',
    displayName: 'OpenAI o1',
    description: 'Advanced reasoning model for complex tasks',
    category: 'reasoning',
    capabilities: ['chat', 'reasoning', 'streaming'],
    contextWindow: 200000,
    maxOutput: 100000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.015,
      outputCostPer1k: 0.06,
      markup: MARKUP,
      billedInputPer1k: 0.015 * MARKUP,
      billedOutputPer1k: 0.06 * MARKUP,
    },
  },
  {
    id: 'openai-o1-mini',
    modelId: 'o1-mini',
    litellmId: 'o1-mini',
    name: 'o1-mini',
    displayName: 'OpenAI o1-mini',
    description: 'Smaller reasoning model, faster and cheaper',
    category: 'reasoning',
    capabilities: ['chat', 'reasoning', 'streaming'],
    contextWindow: 128000,
    maxOutput: 65536,
    inputModalities: ['text'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.003,
      outputCostPer1k: 0.012,
      markup: MARKUP,
      billedInputPer1k: 0.003 * MARKUP,
      billedOutputPer1k: 0.012 * MARKUP,
    },
  },
];

const OPENAI_PROVIDER: ExternalProvider = {
  id: 'openai',
  name: 'openai',
  displayName: 'OpenAI',
  category: 'text_generation',
  description: 'OpenAI GPT models including GPT-4o and o1 series',
  website: 'https://openai.com',
  apiBaseUrl: 'https://api.openai.com/v1',
  authType: 'bearer',
  secretName: 'radiant/providers/openai',
  enabled: true,
  regions: ['us'],
  models: OPENAI_MODELS,
  rateLimit: { requestsPerMinute: 10000, tokensPerMinute: 2000000 },
  features: ['streaming', 'function_calling', 'vision', 'json_mode'],
  compliance: ['SOC2', 'GDPR'],
};

// ============================================================================
// ANTHROPIC MODELS
// ============================================================================

const ANTHROPIC_MODELS: ExternalModel[] = [
  {
    id: 'anthropic-claude-3-5-sonnet',
    modelId: 'claude-3-5-sonnet-20241022',
    litellmId: 'claude-3-5-sonnet-20241022',
    name: 'claude-3-5-sonnet',
    displayName: 'Claude 3.5 Sonnet',
    description: 'Most intelligent Claude model with excellent coding abilities',
    category: 'text_generation',
    capabilities: ['chat', 'vision', 'function_calling', 'streaming', 'computer_use'],
    contextWindow: 200000,
    maxOutput: 8192,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.003,
      outputCostPer1k: 0.015,
      markup: MARKUP,
      billedInputPer1k: 0.003 * MARKUP,
      billedOutputPer1k: 0.015 * MARKUP,
    },
  },
  {
    id: 'anthropic-claude-3-5-haiku',
    modelId: 'claude-3-5-haiku-20241022',
    litellmId: 'claude-3-5-haiku-20241022',
    name: 'claude-3-5-haiku',
    displayName: 'Claude 3.5 Haiku',
    description: 'Fast and affordable Claude model',
    category: 'text_generation',
    capabilities: ['chat', 'vision', 'function_calling', 'streaming'],
    contextWindow: 200000,
    maxOutput: 8192,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.001,
      outputCostPer1k: 0.005,
      markup: MARKUP,
      billedInputPer1k: 0.001 * MARKUP,
      billedOutputPer1k: 0.005 * MARKUP,
    },
  },
  {
    id: 'anthropic-claude-3-opus',
    modelId: 'claude-3-opus-20240229',
    litellmId: 'claude-3-opus-20240229',
    name: 'claude-3-opus',
    displayName: 'Claude 3 Opus',
    description: 'Most powerful Claude 3 model for complex tasks',
    category: 'text_generation',
    capabilities: ['chat', 'vision', 'function_calling', 'streaming'],
    contextWindow: 200000,
    maxOutput: 4096,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.015,
      outputCostPer1k: 0.075,
      markup: MARKUP,
      billedInputPer1k: 0.015 * MARKUP,
      billedOutputPer1k: 0.075 * MARKUP,
    },
  },
];

const ANTHROPIC_PROVIDER: ExternalProvider = {
  id: 'anthropic',
  name: 'anthropic',
  displayName: 'Anthropic',
  category: 'text_generation',
  description: 'Claude AI models from Anthropic',
  website: 'https://anthropic.com',
  apiBaseUrl: 'https://api.anthropic.com/v1',
  authType: 'api_key',
  secretName: 'radiant/providers/anthropic',
  enabled: true,
  regions: ['us'],
  models: ANTHROPIC_MODELS,
  rateLimit: { requestsPerMinute: 4000, tokensPerMinute: 400000 },
  features: ['streaming', 'function_calling', 'vision', 'computer_use'],
  compliance: ['SOC2', 'GDPR'],
};

// ============================================================================
// GOOGLE MODELS
// ============================================================================

const GOOGLE_MODELS: ExternalModel[] = [
  {
    id: 'google-gemini-2-flash',
    modelId: 'gemini-2.0-flash-exp',
    litellmId: 'gemini/gemini-2.0-flash-exp',
    name: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    description: 'Fast multimodal Gemini model with 1M context',
    category: 'text_generation',
    capabilities: ['chat', 'vision', 'function_calling', 'streaming', 'audio'],
    contextWindow: 1000000,
    maxOutput: 8192,
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.000075,
      outputCostPer1k: 0.0003,
      markup: MARKUP,
      billedInputPer1k: 0.000075 * MARKUP,
      billedOutputPer1k: 0.0003 * MARKUP,
    },
  },
  {
    id: 'google-gemini-1-5-pro',
    modelId: 'gemini-1.5-pro',
    litellmId: 'gemini/gemini-1.5-pro',
    name: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    description: 'Best Gemini model for complex reasoning',
    category: 'text_generation',
    capabilities: ['chat', 'vision', 'function_calling', 'streaming'],
    contextWindow: 2000000,
    maxOutput: 8192,
    inputModalities: ['text', 'image', 'video'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.00125,
      outputCostPer1k: 0.005,
      markup: MARKUP,
      billedInputPer1k: 0.00125 * MARKUP,
      billedOutputPer1k: 0.005 * MARKUP,
    },
  },
];

const GOOGLE_PROVIDER: ExternalProvider = {
  id: 'google',
  name: 'google',
  displayName: 'Google AI',
  category: 'text_generation',
  description: 'Google Gemini models',
  website: 'https://ai.google.dev',
  apiBaseUrl: 'https://generativelanguage.googleapis.com/v1',
  authType: 'api_key',
  secretName: 'radiant/providers/google',
  enabled: true,
  regions: ['us', 'eu'],
  models: GOOGLE_MODELS,
  rateLimit: { requestsPerMinute: 1500 },
  features: ['streaming', 'function_calling', 'vision', 'long_context'],
  compliance: ['SOC2', 'GDPR', 'ISO27001'],
};

// ============================================================================
// XAI MODELS
// ============================================================================

const XAI_MODELS: ExternalModel[] = [
  {
    id: 'xai-grok-2',
    modelId: 'grok-2-1212',
    litellmId: 'xai/grok-2-1212',
    name: 'grok-2',
    displayName: 'Grok 2',
    description: 'xAI flagship model with real-time knowledge',
    category: 'text_generation',
    capabilities: ['chat', 'vision', 'function_calling', 'streaming'],
    contextWindow: 131072,
    maxOutput: 32768,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.002,
      outputCostPer1k: 0.01,
      markup: MARKUP,
      billedInputPer1k: 0.002 * MARKUP,
      billedOutputPer1k: 0.01 * MARKUP,
    },
  },
];

const XAI_PROVIDER: ExternalProvider = {
  id: 'xai',
  name: 'xai',
  displayName: 'xAI',
  category: 'text_generation',
  description: 'xAI Grok models',
  website: 'https://x.ai',
  apiBaseUrl: 'https://api.x.ai/v1',
  authType: 'bearer',
  secretName: 'radiant/providers/xai',
  enabled: true,
  regions: ['us'],
  models: XAI_MODELS,
  rateLimit: { requestsPerMinute: 60 },
  features: ['streaming', 'function_calling', 'vision', 'realtime'],
};

// ============================================================================
// DEEPSEEK MODELS
// ============================================================================

const DEEPSEEK_MODELS: ExternalModel[] = [
  {
    id: 'deepseek-chat',
    modelId: 'deepseek-chat',
    litellmId: 'deepseek/deepseek-chat',
    name: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    description: 'Powerful open-weight chat model',
    category: 'text_generation',
    capabilities: ['chat', 'function_calling', 'streaming'],
    contextWindow: 64000,
    maxOutput: 8192,
    inputModalities: ['text'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.00014,
      outputCostPer1k: 0.00028,
      markup: MARKUP,
      billedInputPer1k: 0.00014 * MARKUP,
      billedOutputPer1k: 0.00028 * MARKUP,
    },
  },
  {
    id: 'deepseek-reasoner',
    modelId: 'deepseek-reasoner',
    litellmId: 'deepseek/deepseek-reasoner',
    name: 'deepseek-reasoner',
    displayName: 'DeepSeek R1',
    description: 'Advanced reasoning model',
    category: 'reasoning',
    capabilities: ['chat', 'reasoning', 'streaming'],
    contextWindow: 64000,
    maxOutput: 8192,
    inputModalities: ['text'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.00055,
      outputCostPer1k: 0.00219,
      markup: MARKUP,
      billedInputPer1k: 0.00055 * MARKUP,
      billedOutputPer1k: 0.00219 * MARKUP,
    },
  },
];

const DEEPSEEK_PROVIDER: ExternalProvider = {
  id: 'deepseek',
  name: 'deepseek',
  displayName: 'DeepSeek',
  category: 'text_generation',
  description: 'DeepSeek AI models',
  website: 'https://deepseek.com',
  apiBaseUrl: 'https://api.deepseek.com/v1',
  authType: 'bearer',
  secretName: 'radiant/providers/deepseek',
  enabled: true,
  regions: ['cn', 'us'],
  models: DEEPSEEK_MODELS,
  rateLimit: { requestsPerMinute: 60 },
  features: ['streaming', 'function_calling', 'reasoning'],
};

// ============================================================================
// MISTRAL MODELS
// ============================================================================

const MISTRAL_MODELS: ExternalModel[] = [
  {
    id: 'mistral-large',
    modelId: 'mistral-large-latest',
    litellmId: 'mistral/mistral-large-latest',
    name: 'mistral-large',
    displayName: 'Mistral Large',
    description: 'Mistral flagship model',
    category: 'text_generation',
    capabilities: ['chat', 'function_calling', 'streaming'],
    contextWindow: 128000,
    maxOutput: 8192,
    inputModalities: ['text'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.002,
      outputCostPer1k: 0.006,
      markup: MARKUP,
      billedInputPer1k: 0.002 * MARKUP,
      billedOutputPer1k: 0.006 * MARKUP,
    },
  },
];

const MISTRAL_PROVIDER: ExternalProvider = {
  id: 'mistral',
  name: 'mistral',
  displayName: 'Mistral AI',
  category: 'text_generation',
  description: 'Mistral AI models',
  website: 'https://mistral.ai',
  apiBaseUrl: 'https://api.mistral.ai/v1',
  authType: 'bearer',
  secretName: 'radiant/providers/mistral',
  enabled: true,
  regions: ['eu', 'us'],
  models: MISTRAL_MODELS,
  rateLimit: { requestsPerMinute: 120 },
  features: ['streaming', 'function_calling'],
  compliance: ['GDPR'],
};

// ============================================================================
// EXPORTS
// ============================================================================

export const TEXT_PROVIDERS: ExternalProvider[] = [
  OPENAI_PROVIDER,
  ANTHROPIC_PROVIDER,
  GOOGLE_PROVIDER,
  XAI_PROVIDER,
  DEEPSEEK_PROVIDER,
  MISTRAL_PROVIDER,
];
