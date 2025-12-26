/**
 * Embedding Providers - RADIANT v4.18.0
 * OpenAI, Cohere, Voyage, Google
 */

import { ExternalProvider, ExternalModel } from './index';

const MARKUP = 1.40;

// ============================================================================
// OPENAI EMBEDDING MODELS
// ============================================================================

const OPENAI_EMBEDDING_MODELS: ExternalModel[] = [
  {
    id: 'openai-text-embedding-3-large',
    modelId: 'text-embedding-3-large',
    litellmId: 'text-embedding-3-large',
    name: 'text-embedding-3-large',
    displayName: 'OpenAI Embedding 3 Large',
    description: 'Best embedding model with 3072 dimensions',
    category: 'embedding',
    capabilities: ['embedding', 'high_dimensions'],
    contextWindow: 8191,
    inputModalities: ['text'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.00013,
      markup: MARKUP,
      billedInputPer1k: 0.00013 * MARKUP,
    },
    metadata: { dimensions: 3072 },
  },
  {
    id: 'openai-text-embedding-3-small',
    modelId: 'text-embedding-3-small',
    litellmId: 'text-embedding-3-small',
    name: 'text-embedding-3-small',
    displayName: 'OpenAI Embedding 3 Small',
    description: 'Fast embedding model with 1536 dimensions',
    category: 'embedding',
    capabilities: ['embedding'],
    contextWindow: 8191,
    inputModalities: ['text'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.00002,
      markup: MARKUP,
      billedInputPer1k: 0.00002 * MARKUP,
    },
    metadata: { dimensions: 1536 },
  },
];

const OPENAI_EMBEDDING_PROVIDER: ExternalProvider = {
  id: 'openai-embeddings',
  name: 'openai-embeddings',
  displayName: 'OpenAI Embeddings',
  category: 'embedding',
  description: 'OpenAI text embedding models',
  website: 'https://openai.com',
  apiBaseUrl: 'https://api.openai.com/v1',
  authType: 'bearer',
  secretName: 'radiant/providers/openai',
  enabled: true,
  regions: ['us'],
  models: OPENAI_EMBEDDING_MODELS,
  rateLimit: { requestsPerMinute: 3000, tokensPerMinute: 1000000 },
  features: ['embedding', 'batch'],
  compliance: ['SOC2', 'GDPR'],
};

// ============================================================================
// COHERE EMBEDDING MODELS
// ============================================================================

const COHERE_EMBEDDING_MODELS: ExternalModel[] = [
  {
    id: 'cohere-embed-english-v3',
    modelId: 'embed-english-v3.0',
    litellmId: 'cohere/embed-english-v3.0',
    name: 'embed-english-v3',
    displayName: 'Cohere Embed English V3',
    description: 'English embedding with 1024 dimensions',
    category: 'embedding',
    capabilities: ['embedding', 'search', 'clustering'],
    contextWindow: 512,
    inputModalities: ['text'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.0001,
      markup: MARKUP,
      billedInputPer1k: 0.0001 * MARKUP,
    },
    metadata: { dimensions: 1024 },
  },
  {
    id: 'cohere-embed-multilingual-v3',
    modelId: 'embed-multilingual-v3.0',
    litellmId: 'cohere/embed-multilingual-v3.0',
    name: 'embed-multilingual-v3',
    displayName: 'Cohere Embed Multilingual V3',
    description: 'Multilingual embedding with 1024 dimensions',
    category: 'embedding',
    capabilities: ['embedding', 'multilingual', 'search'],
    contextWindow: 512,
    inputModalities: ['text'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.0001,
      markup: MARKUP,
      billedInputPer1k: 0.0001 * MARKUP,
    },
    metadata: { dimensions: 1024 },
  },
];

const COHERE_EMBEDDING_PROVIDER: ExternalProvider = {
  id: 'cohere-embeddings',
  name: 'cohere-embeddings',
  displayName: 'Cohere Embeddings',
  category: 'embedding',
  description: 'Cohere embedding models',
  website: 'https://cohere.com',
  apiBaseUrl: 'https://api.cohere.ai/v1',
  authType: 'bearer',
  secretName: 'radiant/providers/cohere',
  enabled: true,
  regions: ['us', 'eu'],
  models: COHERE_EMBEDDING_MODELS,
  rateLimit: { requestsPerMinute: 10000 },
  features: ['embedding', 'multilingual', 'search'],
  compliance: ['SOC2'],
};

// ============================================================================
// VOYAGE EMBEDDING MODELS
// ============================================================================

const VOYAGE_EMBEDDING_MODELS: ExternalModel[] = [
  {
    id: 'voyage-3',
    modelId: 'voyage-3',
    litellmId: 'voyage/voyage-3',
    name: 'voyage-3',
    displayName: 'Voyage 3',
    description: 'Best general-purpose embedding',
    category: 'embedding',
    capabilities: ['embedding', 'high_quality'],
    contextWindow: 32000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.00006,
      markup: MARKUP,
      billedInputPer1k: 0.00006 * MARKUP,
    },
    metadata: { dimensions: 1024 },
  },
  {
    id: 'voyage-code-3',
    modelId: 'voyage-code-3',
    litellmId: 'voyage/voyage-code-3',
    name: 'voyage-code-3',
    displayName: 'Voyage Code 3',
    description: 'Code-optimized embedding',
    category: 'embedding',
    capabilities: ['embedding', 'code'],
    contextWindow: 32000,
    inputModalities: ['text'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.00006,
      markup: MARKUP,
      billedInputPer1k: 0.00006 * MARKUP,
    },
    metadata: { dimensions: 1024 },
  },
];

const VOYAGE_EMBEDDING_PROVIDER: ExternalProvider = {
  id: 'voyage',
  name: 'voyage',
  displayName: 'Voyage AI',
  category: 'embedding',
  description: 'Voyage embedding models',
  website: 'https://voyageai.com',
  apiBaseUrl: 'https://api.voyageai.com/v1',
  authType: 'bearer',
  secretName: 'radiant/providers/voyage',
  enabled: true,
  regions: ['us'],
  models: VOYAGE_EMBEDDING_MODELS,
  rateLimit: { requestsPerMinute: 300, tokensPerMinute: 1000000 },
  features: ['embedding', 'long_context', 'code'],
};

// ============================================================================
// GOOGLE EMBEDDING MODELS
// ============================================================================

const GOOGLE_EMBEDDING_MODELS: ExternalModel[] = [
  {
    id: 'google-text-embedding-004',
    modelId: 'text-embedding-004',
    litellmId: 'vertex_ai/text-embedding-004',
    name: 'text-embedding-004',
    displayName: 'Google Text Embedding 004',
    description: 'Google latest embedding model',
    category: 'embedding',
    capabilities: ['embedding', 'multilingual'],
    contextWindow: 2048,
    inputModalities: ['text'],
    outputModalities: ['text'],
    pricing: {
      type: 'per_token',
      inputCostPer1k: 0.000025,
      markup: MARKUP,
      billedInputPer1k: 0.000025 * MARKUP,
    },
    metadata: { dimensions: 768 },
  },
];

const GOOGLE_EMBEDDING_PROVIDER: ExternalProvider = {
  id: 'google-embeddings',
  name: 'google-embeddings',
  displayName: 'Google Embeddings',
  category: 'embedding',
  description: 'Google text embedding models',
  website: 'https://ai.google.dev',
  apiBaseUrl: 'https://generativelanguage.googleapis.com/v1',
  authType: 'api_key',
  secretName: 'radiant/providers/google',
  enabled: true,
  regions: ['us', 'eu'],
  models: GOOGLE_EMBEDDING_MODELS,
  rateLimit: { requestsPerMinute: 1500 },
  features: ['embedding', 'multilingual'],
  compliance: ['SOC2', 'GDPR', 'ISO27001'],
};

// ============================================================================
// EXPORTS
// ============================================================================

export const EMBEDDING_PROVIDERS: ExternalProvider[] = [
  OPENAI_EMBEDDING_PROVIDER,
  COHERE_EMBEDDING_PROVIDER,
  VOYAGE_EMBEDDING_PROVIDER,
  GOOGLE_EMBEDDING_PROVIDER,
];
