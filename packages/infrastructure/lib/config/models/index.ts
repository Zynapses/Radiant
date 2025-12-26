/**
 * Self-Hosted Model Registry
 * All models available for deployment on SageMaker
 * Pricing includes 75% markup over AWS infrastructure costs
 */

export * from './vision.models';
export * from './audio.models';
export * from './scientific.models';
export * from './medical.models';
export * from './geospatial.models';
export * from './generative.models';

// ============================================================================
// SHARED TYPES
// ============================================================================

export type ThermalState = 'OFF' | 'COLD' | 'WARM' | 'HOT' | 'AUTOMATIC';
export type ServiceState = 'RUNNING' | 'DEGRADED' | 'DISABLED' | 'OFFLINE';

export interface ThermalConfig {
  defaultState: ThermalState;
  scaleToZeroAfterMinutes: number;
  warmupTimeSeconds: number;
  minInstances: number;
  maxInstances: number;
}

export interface SageMakerModelConfig {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: ModelCategory;
  specialty: ModelSpecialty;
  
  // SageMaker Configuration
  image: string;
  instanceType: string;
  environment: Record<string, string>;
  modelDataUrl?: string;
  
  // Model Capabilities
  parameters: number;
  accuracy?: string;
  benchmark?: string;
  capabilities: string[];
  inputFormats: string[];
  outputFormats: string[];
  
  // Thermal Management
  thermal: ThermalConfig;
  
  // Licensing
  license: string;
  licenseUrl?: string;
  commercialUseNotes?: string;
  
  // Pricing (75% markup over AWS)
  pricing: SelfHostedModelPricing;
  
  // Requirements
  minTier: number;
  requiresGPU: boolean;
  gpuMemoryGB: number;
  
  // Status
  status: 'active' | 'beta' | 'deprecated' | 'coming_soon';
}

export type ModelCategory =
  | 'vision_classification'
  | 'vision_detection'
  | 'vision_segmentation'
  | 'audio_stt'
  | 'audio_speaker'
  | 'scientific_protein'
  | 'scientific_math'
  | 'medical_imaging'
  | 'geospatial'
  | 'generative_3d'
  | 'llm_text';

export type ModelSpecialty =
  | 'image_classification'
  | 'object_detection'
  | 'instance_segmentation'
  | 'speech_to_text'
  | 'speaker_identification'
  | 'protein_folding'
  | 'protein_embeddings'
  | 'geometry_reasoning'
  | 'medical_segmentation'
  | 'satellite_analysis'
  | '3d_reconstruction'
  | 'text_generation';

export interface SelfHostedModelPricing {
  hourlyRate: number;        // Per-hour instance cost (with 75% markup)
  perImage?: number;
  perMinuteAudio?: number;
  perMinuteVideo?: number;
  per3DModel?: number;
  perRequest?: number;
  markup: number;            // 0.75 = 75%
}

export const INSTANCE_PRICING: Record<string, { base: number; billed: number }> = {
  'ml.g4dn.xlarge':   { base: 0.74,  billed: 1.30 },
  'ml.g5.xlarge':     { base: 1.41,  billed: 2.47 },
  'ml.g5.2xlarge':    { base: 1.52,  billed: 2.66 },
  'ml.g5.4xlarge':    { base: 2.03,  billed: 3.55 },
  'ml.g5.12xlarge':   { base: 8.16,  billed: 14.28 },
  'ml.g5.48xlarge':   { base: 20.36, billed: 35.63 },
  'ml.p4d.24xlarge':  { base: 32.77, billed: 57.35 },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getAllModels(): SageMakerModelConfig[] {
  // Dynamic import to avoid circular dependencies
  const { ALL_VISION_MODELS } = require('./vision.models');
  const { ALL_AUDIO_MODELS } = require('./audio.models');
  const { SCIENTIFIC_MODELS } = require('./scientific.models');
  const { MEDICAL_MODELS } = require('./medical.models');
  const { GEOSPATIAL_MODELS } = require('./geospatial.models');
  const { ALL_GENERATIVE_MODELS } = require('./generative.models');
  
  return [
    ...ALL_VISION_MODELS,
    ...ALL_AUDIO_MODELS,
    ...SCIENTIFIC_MODELS,
    ...MEDICAL_MODELS,
    ...GEOSPATIAL_MODELS,
    ...ALL_GENERATIVE_MODELS,
  ];
}

export function getModelById(id: string): SageMakerModelConfig | undefined {
  return getAllModels().find(m => m.id === id);
}

export function getModelsByCategory(category: ModelCategory): SageMakerModelConfig[] {
  return getAllModels().filter(m => m.category === category);
}

export function getModelsByTier(tier: number): SageMakerModelConfig[] {
  return getAllModels().filter(m => m.minTier <= tier);
}
