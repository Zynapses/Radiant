/**
 * Search Providers - RADIANT v4.18.0
 * Perplexity, Exa, Tavily, You.com
 */

import { ExternalProvider, ExternalModel } from './index';

const MARKUP = 1.40;

// ============================================================================
// PERPLEXITY MODELS
// ============================================================================

const PERPLEXITY_MODELS: ExternalModel[] = [
  {
    id: 'perplexity-sonar-pro',
    modelId: 'sonar-pro',
    litellmId: 'perplexity/sonar-pro',
    name: 'sonar-pro',
    displayName: 'Perplexity Sonar Pro',
    description: 'Advanced search with citations',
    category: 'search',
    capabilities: ['search', 'citations', 'real_time'],
    contextWindow: 200000,
    inputModalities: ['text'],
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
    id: 'perplexity-sonar',
    modelId: 'sonar',
    litellmId: 'perplexity/sonar',
    name: 'sonar',
    displayName: 'Perplexity Sonar',
    description: 'Fast search model',
    category: 'search',
    capabilities: ['search', 'citations'],
    contextWindow: 128000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.001,
      outputCostPer1k: 0.001,
      markup: MARKUP,
      billedInputPer1k: 0.001 * MARKUP,
      billedOutputPer1k: 0.001 * MARKUP,
    },
  },
];

const PERPLEXITY_PROVIDER: ExternalProvider = {
  id: 'perplexity',
  name: 'perplexity',
  displayName: 'Perplexity',
  category: 'search',
  description: 'Perplexity AI search',
  website: 'https://perplexity.ai',
  apiBaseUrl: 'https://api.perplexity.ai',
  authType: 'bearer',
  secretName: 'radiant/providers/perplexity',
  enabled: true,
  regions: ['us'],
  models: PERPLEXITY_MODELS,
  rateLimit: { requestsPerMinute: 50 },
  features: ['search', 'citations', 'real_time', 'streaming'],
};

// ============================================================================
// EXA MODELS
// ============================================================================

const EXA_MODELS: ExternalModel[] = [
  {
    id: 'exa-search',
    modelId: 'exa-search',
    litellmId: 'exa/search',
    name: 'exa-search',
    displayName: 'Exa Search',
    description: 'Neural search for the web',
    category: 'search',
    capabilities: ['search', 'semantic', 'neural'],
    inputModalities: ['text'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_request',
      baseCostPerRequest: 0.001,
      markup: MARKUP,
    },
  },
];

const EXA_PROVIDER: ExternalProvider = {
  id: 'exa',
  name: 'exa',
  displayName: 'Exa',
  category: 'search',
  description: 'Exa neural web search',
  website: 'https://exa.ai',
  apiBaseUrl: 'https://api.exa.ai',
  authType: 'api_key',
  secretName: 'radiant/providers/exa',
  enabled: true,
  regions: ['us'],
  models: EXA_MODELS,
  rateLimit: { requestsPerMinute: 60 },
  features: ['search', 'semantic', 'auto_search', 'contents'],
};

// ============================================================================
// TAVILY MODELS
// ============================================================================

const TAVILY_MODELS: ExternalModel[] = [
  {
    id: 'tavily-search',
    modelId: 'tavily-search',
    litellmId: 'tavily/search',
    name: 'tavily-search',
    displayName: 'Tavily Search',
    description: 'AI-optimized search API',
    category: 'search',
    capabilities: ['search', 'ai_optimized'],
    inputModalities: ['text'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_request',
      baseCostPerRequest: 0.001,
      markup: MARKUP,
    },
  },
];

const TAVILY_PROVIDER: ExternalProvider = {
  id: 'tavily',
  name: 'tavily',
  displayName: 'Tavily',
  category: 'search',
  description: 'Tavily search for AI agents',
  website: 'https://tavily.com',
  apiBaseUrl: 'https://api.tavily.com',
  authType: 'api_key',
  secretName: 'radiant/providers/tavily',
  enabled: true,
  regions: ['us'],
  models: TAVILY_MODELS,
  rateLimit: { requestsPerMinute: 100 },
  features: ['search', 'ai_optimized', 'answer_extraction'],
};

// ============================================================================
// YOU.COM MODELS
// ============================================================================

const YOU_MODELS: ExternalModel[] = [
  {
    id: 'you-search',
    modelId: 'you-search',
    litellmId: 'you/search',
    name: 'you-search',
    displayName: 'You.com Search',
    description: 'You.com AI search',
    category: 'search',
    capabilities: ['search', 'rag', 'real_time'],
    inputModalities: ['text'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_request',
      baseCostPerRequest: 0.0005,
      markup: MARKUP,
    },
  },
];

const YOU_PROVIDER: ExternalProvider = {
  id: 'you',
  name: 'you',
  displayName: 'You.com',
  category: 'search',
  description: 'You.com AI search',
  website: 'https://you.com',
  apiBaseUrl: 'https://api.ydc-index.io',
  authType: 'api_key',
  secretName: 'radiant/providers/you',
  enabled: true,
  regions: ['us'],
  models: YOU_MODELS,
  rateLimit: { requestsPerMinute: 60 },
  features: ['search', 'rag', 'news', 'web'],
};

// ============================================================================
// EXPORTS
// ============================================================================

export const SEARCH_PROVIDERS: ExternalProvider[] = [
  PERPLEXITY_PROVIDER,
  EXA_PROVIDER,
  TAVILY_PROVIDER,
  YOU_PROVIDER,
];
