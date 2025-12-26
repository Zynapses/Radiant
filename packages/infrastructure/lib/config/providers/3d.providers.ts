/**
 * 3D Generation Providers - RADIANT v4.18.0
 * Meshy, Rodin, Tripo, Spline
 */

import { ExternalProvider, ExternalModel } from './index';

const MARKUP = 1.40;

// ============================================================================
// MESHY MODELS
// ============================================================================

const MESHY_MODELS: ExternalModel[] = [
  {
    id: 'meshy-v2',
    modelId: 'meshy-v2',
    litellmId: 'meshy/v2',
    name: 'meshy-v2',
    displayName: 'Meshy V2',
    description: 'Text to 3D model generation',
    category: '3d_generation',
    capabilities: ['text_to_3d', 'image_to_3d', 'texturing'],
    inputModalities: ['text', 'image'],
    outputModalities: ['3d'],
    pricing: {
      type: 'per_request',
      baseCostPerRequest: 0.20,
      markup: MARKUP,
    },
  },
];

const MESHY_PROVIDER: ExternalProvider = {
  id: 'meshy',
  name: 'meshy',
  displayName: 'Meshy',
  category: '3d_generation',
  description: 'Meshy AI 3D generation',
  website: 'https://meshy.ai',
  apiBaseUrl: 'https://api.meshy.ai/v1',
  authType: 'bearer',
  secretName: 'radiant/providers/meshy',
  enabled: true,
  regions: ['us'],
  models: MESHY_MODELS,
  rateLimit: { requestsPerMinute: 10 },
  features: ['text_to_3d', 'image_to_3d', 'texturing'],
};

// ============================================================================
// RODIN MODELS
// ============================================================================

const RODIN_MODELS: ExternalModel[] = [
  {
    id: 'rodin-gen1',
    modelId: 'rodin-gen1',
    litellmId: 'rodin/gen1',
    name: 'rodin-gen1',
    displayName: 'Rodin Gen-1',
    description: 'High-quality 3D generation',
    category: '3d_generation',
    capabilities: ['text_to_3d', 'image_to_3d', 'high_quality'],
    inputModalities: ['text', 'image'],
    outputModalities: ['3d'],
    pricing: {
      type: 'per_request',
      baseCostPerRequest: 0.25,
      markup: MARKUP,
    },
  },
];

const RODIN_PROVIDER: ExternalProvider = {
  id: 'rodin',
  name: 'rodin',
  displayName: 'Rodin',
  category: '3d_generation',
  description: 'Hyper3D Rodin 3D generation',
  website: 'https://hyper3d.ai',
  apiBaseUrl: 'https://api.hyper3d.ai/v1',
  authType: 'api_key',
  secretName: 'radiant/providers/rodin',
  enabled: true,
  regions: ['us'],
  models: RODIN_MODELS,
  rateLimit: { requestsPerMinute: 10 },
  features: ['text_to_3d', 'image_to_3d', 'high_quality'],
};

// ============================================================================
// TRIPO MODELS
// ============================================================================

const TRIPO_MODELS: ExternalModel[] = [
  {
    id: 'tripo-v2',
    modelId: 'tripo-v2',
    litellmId: 'tripo/v2',
    name: 'tripo-v2',
    displayName: 'Tripo V2',
    description: 'Fast 3D model generation',
    category: '3d_generation',
    capabilities: ['text_to_3d', 'image_to_3d', 'fast'],
    inputModalities: ['text', 'image'],
    outputModalities: ['3d'],
    pricing: {
      type: 'per_request',
      baseCostPerRequest: 0.10,
      markup: MARKUP,
    },
  },
];

const TRIPO_PROVIDER: ExternalProvider = {
  id: 'tripo',
  name: 'tripo',
  displayName: 'Tripo AI',
  category: '3d_generation',
  description: 'Tripo AI 3D generation',
  website: 'https://tripo3d.ai',
  apiBaseUrl: 'https://api.tripo3d.ai/v1',
  authType: 'api_key',
  secretName: 'radiant/providers/tripo',
  enabled: true,
  regions: ['us', 'cn'],
  models: TRIPO_MODELS,
  rateLimit: { requestsPerMinute: 30 },
  features: ['text_to_3d', 'image_to_3d', 'fast'],
};

// ============================================================================
// SPLINE MODELS
// ============================================================================

const SPLINE_MODELS: ExternalModel[] = [
  {
    id: 'spline-ai',
    modelId: 'spline-ai',
    litellmId: 'spline/ai',
    name: 'spline-ai',
    displayName: 'Spline AI',
    description: 'AI-assisted 3D design',
    category: '3d_generation',
    capabilities: ['text_to_3d', 'design_assist'],
    inputModalities: ['text'],
    outputModalities: ['3d'],
    pricing: {
      type: 'per_request',
      baseCostPerRequest: 0.05,
      markup: MARKUP,
    },
  },
];

const SPLINE_PROVIDER: ExternalProvider = {
  id: 'spline',
  name: 'spline',
  displayName: 'Spline',
  category: '3d_generation',
  description: 'Spline 3D design tool',
  website: 'https://spline.design',
  apiBaseUrl: 'https://api.spline.design/v1',
  authType: 'api_key',
  secretName: 'radiant/providers/spline',
  enabled: true,
  regions: ['us'],
  models: SPLINE_MODELS,
  rateLimit: { requestsPerMinute: 30 },
  features: ['text_to_3d', 'design_assist', 'web_export'],
};

// ============================================================================
// EXPORTS
// ============================================================================

export const THREE_D_PROVIDERS: ExternalProvider[] = [
  MESHY_PROVIDER,
  RODIN_PROVIDER,
  TRIPO_PROVIDER,
  SPLINE_PROVIDER,
];
