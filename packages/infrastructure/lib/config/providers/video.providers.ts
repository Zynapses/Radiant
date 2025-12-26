/**
 * Video Generation Providers - RADIANT v4.18.0
 * Runway, Luma, Pika, Kling, HailuoAI, Google Veo
 */

import { ExternalProvider, ExternalModel } from './index';

const MARKUP = 1.40;

// ============================================================================
// RUNWAY MODELS
// ============================================================================

const RUNWAY_MODELS: ExternalModel[] = [
  {
    id: 'runway-gen3-alpha',
    modelId: 'gen3a_turbo',
    litellmId: 'runway/gen3a_turbo',
    name: 'gen3-alpha-turbo',
    displayName: 'Gen-3 Alpha Turbo',
    description: 'Fast high-quality video generation',
    category: 'video_generation',
    capabilities: ['text_to_video', 'image_to_video'],
    inputModalities: ['text', 'image'],
    outputModalities: ['video'],
    pricing: {
      type: 'per_second',
      costPerSecond: 0.05,
      markup: MARKUP,
    },
  },
];

const RUNWAY_PROVIDER: ExternalProvider = {
  id: 'runway',
  name: 'runway',
  displayName: 'Runway',
  category: 'video_generation',
  description: 'Runway Gen-3 video generation',
  website: 'https://runway.com',
  apiBaseUrl: 'https://api.runwayml.com/v1',
  authType: 'bearer',
  secretName: 'radiant/providers/runway',
  enabled: true,
  regions: ['us'],
  models: RUNWAY_MODELS,
  rateLimit: { requestsPerMinute: 10 },
  features: ['text_to_video', 'image_to_video'],
};

// ============================================================================
// LUMA MODELS
// ============================================================================

const LUMA_MODELS: ExternalModel[] = [
  {
    id: 'luma-dream-machine',
    modelId: 'dream-machine',
    litellmId: 'luma/dream-machine',
    name: 'dream-machine',
    displayName: 'Dream Machine',
    description: 'High-quality video from text or images',
    category: 'video_generation',
    capabilities: ['text_to_video', 'image_to_video'],
    inputModalities: ['text', 'image'],
    outputModalities: ['video'],
    pricing: {
      type: 'per_second',
      costPerSecond: 0.032,
      markup: MARKUP,
    },
  },
];

const LUMA_PROVIDER: ExternalProvider = {
  id: 'luma',
  name: 'luma',
  displayName: 'Luma AI',
  category: 'video_generation',
  description: 'Luma Dream Machine video generation',
  website: 'https://lumalabs.ai',
  apiBaseUrl: 'https://api.lumalabs.ai/v1',
  authType: 'bearer',
  secretName: 'radiant/providers/luma',
  enabled: true,
  regions: ['us'],
  models: LUMA_MODELS,
  rateLimit: { requestsPerMinute: 10 },
  features: ['text_to_video', 'image_to_video'],
};

// ============================================================================
// PIKA MODELS
// ============================================================================

const PIKA_MODELS: ExternalModel[] = [
  {
    id: 'pika-v2',
    modelId: 'pika-2.0',
    litellmId: 'pika/pika-2.0',
    name: 'pika-v2',
    displayName: 'Pika 2.0',
    description: 'Creative video generation with effects',
    category: 'video_generation',
    capabilities: ['text_to_video', 'image_to_video', 'video_effects'],
    inputModalities: ['text', 'image'],
    outputModalities: ['video'],
    pricing: {
      type: 'per_second',
      costPerSecond: 0.02,
      markup: MARKUP,
    },
  },
];

const PIKA_PROVIDER: ExternalProvider = {
  id: 'pika',
  name: 'pika',
  displayName: 'Pika',
  category: 'video_generation',
  description: 'Pika creative video generation',
  website: 'https://pika.art',
  apiBaseUrl: 'https://api.pika.art/v1',
  authType: 'bearer',
  secretName: 'radiant/providers/pika',
  enabled: true,
  regions: ['us'],
  models: PIKA_MODELS,
  rateLimit: { requestsPerMinute: 10 },
  features: ['text_to_video', 'image_to_video', 'video_effects'],
};

// ============================================================================
// KLING MODELS
// ============================================================================

const KLING_MODELS: ExternalModel[] = [
  {
    id: 'kling-v1-5',
    modelId: 'kling-v1.5-pro',
    litellmId: 'kling/kling-v1.5-pro',
    name: 'kling-v1.5',
    displayName: 'Kling 1.5 Pro',
    description: 'High-quality long video generation',
    category: 'video_generation',
    capabilities: ['text_to_video', 'image_to_video', 'long_video'],
    inputModalities: ['text', 'image'],
    outputModalities: ['video'],
    pricing: {
      type: 'per_second',
      costPerSecond: 0.035,
      markup: MARKUP,
    },
  },
];

const KLING_PROVIDER: ExternalProvider = {
  id: 'kling',
  name: 'kling',
  displayName: 'Kling AI',
  category: 'video_generation',
  description: 'Kling video generation from Kuaishou',
  website: 'https://klingai.com',
  apiBaseUrl: 'https://api.klingai.com/v1',
  authType: 'api_key',
  secretName: 'radiant/providers/kling',
  enabled: true,
  regions: ['cn', 'us'],
  models: KLING_MODELS,
  rateLimit: { requestsPerMinute: 10 },
  features: ['text_to_video', 'image_to_video', 'long_video'],
};

// ============================================================================
// HAILUO MODELS
// ============================================================================

const HAILUO_MODELS: ExternalModel[] = [
  {
    id: 'hailuo-minimax',
    modelId: 'minimax-video',
    litellmId: 'hailuo/minimax-video',
    name: 'minimax-video',
    displayName: 'MiniMax Video',
    description: 'High-quality video generation',
    category: 'video_generation',
    capabilities: ['text_to_video', 'image_to_video'],
    inputModalities: ['text', 'image'],
    outputModalities: ['video'],
    pricing: {
      type: 'per_second',
      costPerSecond: 0.025,
      markup: MARKUP,
    },
  },
];

const HAILUO_PROVIDER: ExternalProvider = {
  id: 'hailuo',
  name: 'hailuo',
  displayName: 'Hailuo AI',
  category: 'video_generation',
  description: 'Hailuo/MiniMax video generation',
  website: 'https://hailuoai.video',
  apiBaseUrl: 'https://api.hailuoai.video/v1',
  authType: 'api_key',
  secretName: 'radiant/providers/hailuo',
  enabled: true,
  regions: ['cn', 'us'],
  models: HAILUO_MODELS,
  rateLimit: { requestsPerMinute: 10 },
  features: ['text_to_video', 'image_to_video'],
};

// ============================================================================
// GOOGLE VEO MODELS
// ============================================================================

const VEO_MODELS: ExternalModel[] = [
  {
    id: 'google-veo-2',
    modelId: 'veo-2',
    litellmId: 'vertex_ai/veo-2',
    name: 'veo-2',
    displayName: 'Google Veo 2',
    description: 'Google high-quality video generation',
    category: 'video_generation',
    capabilities: ['text_to_video', 'image_to_video', 'high_quality'],
    inputModalities: ['text', 'image'],
    outputModalities: ['video'],
    pricing: {
      type: 'per_second',
      costPerSecond: 0.04,
      markup: MARKUP,
    },
  },
];

const VEO_PROVIDER: ExternalProvider = {
  id: 'veo',
  name: 'veo',
  displayName: 'Google Veo',
  category: 'video_generation',
  description: 'Google Veo video generation',
  website: 'https://deepmind.google/technologies/veo/',
  apiBaseUrl: 'https://generativelanguage.googleapis.com/v1',
  authType: 'api_key',
  secretName: 'radiant/providers/google',
  enabled: true,
  regions: ['us'],
  models: VEO_MODELS,
  rateLimit: { requestsPerMinute: 10 },
  features: ['text_to_video', 'image_to_video', 'high_quality'],
  compliance: ['SOC2', 'GDPR'],
};

// ============================================================================
// EXPORTS
// ============================================================================

export const VIDEO_PROVIDERS: ExternalProvider[] = [
  RUNWAY_PROVIDER,
  LUMA_PROVIDER,
  PIKA_PROVIDER,
  KLING_PROVIDER,
  HAILUO_PROVIDER,
  VEO_PROVIDER,
];
