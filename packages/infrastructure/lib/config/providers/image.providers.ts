/**
 * Image Generation Providers - RADIANT v4.18.0
 * DALL-E, Midjourney, Stability AI, Flux, Ideogram
 */

import { ExternalProvider, ExternalModel } from './index';

const MARKUP = 1.40;

// ============================================================================
// OPENAI DALL-E MODELS
// ============================================================================

const DALLE_MODELS: ExternalModel[] = [
  {
    id: 'openai-dalle-3',
    modelId: 'dall-e-3',
    litellmId: 'dall-e-3',
    name: 'dall-e-3',
    displayName: 'DALL-E 3',
    description: 'Latest DALL-E model with highest quality',
    category: 'image_generation',
    capabilities: ['text_to_image', 'hd', 'variations'],
    inputModalities: ['text'],
    outputModalities: ['image'],
    pricing: {
      type: 'per_image',
      costPerImage: 0.04,
      markup: MARKUP,
    },
  },
  {
    id: 'openai-dalle-3-hd',
    modelId: 'dall-e-3-hd',
    litellmId: 'dall-e-3',
    name: 'dall-e-3-hd',
    displayName: 'DALL-E 3 HD',
    description: 'DALL-E 3 with HD quality (1792x1024)',
    category: 'image_generation',
    capabilities: ['text_to_image', 'hd', 'variations'],
    inputModalities: ['text'],
    outputModalities: ['image'],
    pricing: {
      type: 'per_image',
      costPerImage: 0.08,
      markup: MARKUP,
    },
  },
];

const DALLE_PROVIDER: ExternalProvider = {
  id: 'openai-images',
  name: 'openai-images',
  displayName: 'OpenAI Images',
  category: 'image_generation',
  description: 'OpenAI DALL-E image generation',
  website: 'https://openai.com',
  apiBaseUrl: 'https://api.openai.com/v1',
  authType: 'bearer',
  secretName: 'radiant/providers/openai',
  enabled: true,
  regions: ['us'],
  models: DALLE_MODELS,
  rateLimit: { requestsPerMinute: 50 },
  features: ['text_to_image', 'hd', 'variations'],
  compliance: ['SOC2', 'GDPR'],
};

// ============================================================================
// STABILITY AI MODELS
// ============================================================================

const STABILITY_MODELS: ExternalModel[] = [
  {
    id: 'stability-sdxl',
    modelId: 'stable-diffusion-xl-1024-v1-0',
    litellmId: 'stability/stable-diffusion-xl-1024-v1-0',
    name: 'sdxl',
    displayName: 'Stable Diffusion XL',
    description: 'High-quality image generation with SDXL',
    category: 'image_generation',
    capabilities: ['text_to_image', 'image_to_image', 'inpainting'],
    inputModalities: ['text', 'image'],
    outputModalities: ['image'],
    pricing: {
      type: 'per_image',
      costPerImage: 0.002,
      markup: MARKUP,
    },
  },
  {
    id: 'stability-sd3',
    modelId: 'stable-diffusion-3-medium',
    litellmId: 'stability/stable-diffusion-3-medium',
    name: 'sd3',
    displayName: 'Stable Diffusion 3',
    description: 'Latest Stable Diffusion model',
    category: 'image_generation',
    capabilities: ['text_to_image', 'image_to_image'],
    inputModalities: ['text', 'image'],
    outputModalities: ['image'],
    pricing: {
      type: 'per_image',
      costPerImage: 0.035,
      markup: MARKUP,
    },
  },
];

const STABILITY_PROVIDER: ExternalProvider = {
  id: 'stability',
  name: 'stability',
  displayName: 'Stability AI',
  category: 'image_generation',
  description: 'Stable Diffusion models from Stability AI',
  website: 'https://stability.ai',
  apiBaseUrl: 'https://api.stability.ai/v1',
  authType: 'api_key',
  secretName: 'radiant/providers/stability',
  enabled: true,
  regions: ['us', 'eu'],
  models: STABILITY_MODELS,
  rateLimit: { requestsPerMinute: 150 },
  features: ['text_to_image', 'image_to_image', 'inpainting', 'outpainting'],
};

// ============================================================================
// FLUX MODELS (via Replicate/BFL)
// ============================================================================

const FLUX_MODELS: ExternalModel[] = [
  {
    id: 'flux-pro',
    modelId: 'flux-pro',
    litellmId: 'replicate/black-forest-labs/flux-pro',
    name: 'flux-pro',
    displayName: 'FLUX Pro',
    description: 'Professional quality image generation',
    category: 'image_generation',
    capabilities: ['text_to_image', 'high_quality'],
    inputModalities: ['text'],
    outputModalities: ['image'],
    pricing: {
      type: 'per_image',
      costPerImage: 0.05,
      markup: MARKUP,
    },
  },
  {
    id: 'flux-schnell',
    modelId: 'flux-schnell',
    litellmId: 'replicate/black-forest-labs/flux-schnell',
    name: 'flux-schnell',
    displayName: 'FLUX Schnell',
    description: 'Fast image generation',
    category: 'image_generation',
    capabilities: ['text_to_image', 'fast'],
    inputModalities: ['text'],
    outputModalities: ['image'],
    pricing: {
      type: 'per_image',
      costPerImage: 0.003,
      markup: MARKUP,
    },
  },
];

const FLUX_PROVIDER: ExternalProvider = {
  id: 'flux',
  name: 'flux',
  displayName: 'FLUX',
  category: 'image_generation',
  description: 'FLUX image generation models',
  website: 'https://blackforestlabs.ai',
  apiBaseUrl: 'https://api.bfl.ml/v1',
  authType: 'api_key',
  secretName: 'radiant/providers/flux',
  enabled: true,
  regions: ['us'],
  models: FLUX_MODELS,
  rateLimit: { requestsPerMinute: 60 },
  features: ['text_to_image', 'fast', 'high_quality'],
};

// ============================================================================
// IDEOGRAM MODELS
// ============================================================================

const IDEOGRAM_MODELS: ExternalModel[] = [
  {
    id: 'ideogram-v2',
    modelId: 'ideogram-v2',
    litellmId: 'ideogram/ideogram-v2',
    name: 'ideogram-v2',
    displayName: 'Ideogram V2',
    description: 'Best-in-class text rendering in images',
    category: 'image_generation',
    capabilities: ['text_to_image', 'text_rendering'],
    inputModalities: ['text'],
    outputModalities: ['image'],
    pricing: {
      type: 'per_image',
      costPerImage: 0.08,
      markup: MARKUP,
    },
  },
];

const IDEOGRAM_PROVIDER: ExternalProvider = {
  id: 'ideogram',
  name: 'ideogram',
  displayName: 'Ideogram',
  category: 'image_generation',
  description: 'Ideogram AI for text-in-image generation',
  website: 'https://ideogram.ai',
  apiBaseUrl: 'https://api.ideogram.ai/v1',
  authType: 'bearer',
  secretName: 'radiant/providers/ideogram',
  enabled: true,
  regions: ['us'],
  models: IDEOGRAM_MODELS,
  rateLimit: { requestsPerMinute: 60 },
  features: ['text_to_image', 'text_rendering'],
};

// ============================================================================
// EXPORTS
// ============================================================================

export const IMAGE_PROVIDERS: ExternalProvider[] = [
  DALLE_PROVIDER,
  STABILITY_PROVIDER,
  FLUX_PROVIDER,
  IDEOGRAM_PROVIDER,
];
