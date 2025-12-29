// RADIANT v4.18.0 - Think Tank Media Service
// Handles media inputs and outputs using self-hosted models

import {
  SELF_HOSTED_MODEL_REGISTRY,
  SelfHostedModelDefinition,
  getSelfHostedModelById,
  ModelModality,
} from '@radiant/shared';
import { selfHostedModelSelector } from './self-hosted-model-selector.service';

// ============================================================================
// Types
// ============================================================================

export type MediaType = 'image' | 'audio' | 'video' | '3d' | 'document';

export interface MediaInput {
  type: MediaType;
  data: Buffer | string; // Base64 or S3 URL
  format: string;
  size?: number;
  metadata?: Record<string, unknown>;
}

export interface MediaOutput {
  type: MediaType;
  data: string; // Base64 or S3 URL
  format: string;
  modelUsed: string;
  generationTime: number;
  metadata?: Record<string, unknown>;
}

export interface MediaCapabilities {
  modelId: string;
  displayName: string;
  input: {
    image: boolean;
    audio: boolean;
    video: boolean;
    document: boolean;
  };
  output: {
    image: boolean;
    audio: boolean;
    video: boolean;
    threeD: boolean;
  };
  limits: {
    maxImageSize?: number;
    maxAudioLength?: number;
    maxVideoLength?: number;
    maxFileSize?: number;
  };
  formats: {
    image: string[];
    audio: string[];
    video: string[];
    threeD: string[];
  };
}

export interface MediaGenerationRequest {
  type: 'image' | 'audio' | '3d';
  prompt: string;
  options?: {
    preferredModel?: string;
    qualityTier?: 'premium' | 'standard' | 'economy';
    format?: string;
    size?: number;
    duration?: number;
  };
  context?: {
    tenantId: string;
    userId?: string;
    sessionId?: string;
  };
}

export interface MediaAnalysisRequest {
  input: MediaInput;
  prompt?: string;
  options?: {
    preferredModel?: string;
    capabilities?: string[];
  };
  context?: {
    tenantId: string;
    userId?: string;
    sessionId?: string;
  };
}

// ============================================================================
// Service
// ============================================================================

class ThinkTankMediaService {
  
  /**
   * Get all models with media capabilities
   */
  getMediaCapableModels(): MediaCapabilities[] {
    return SELF_HOSTED_MODEL_REGISTRY
      .filter(m => this.hasMediaCapabilities(m))
      .map(m => this.extractMediaCapabilities(m));
  }
  
  /**
   * Get models that can process a specific input type
   */
  getModelsForInputType(inputType: MediaType): SelfHostedModelDefinition[] {
    const modalityMap: Record<MediaType, ModelModality> = {
      image: 'image',
      audio: 'audio',
      video: 'video',
      '3d': '3d',
      document: 'text',
    };
    
    return SELF_HOSTED_MODEL_REGISTRY.filter(m =>
      m.inputModalities.includes(modalityMap[inputType])
    );
  }
  
  /**
   * Get models that can generate a specific output type
   */
  getModelsForOutputType(outputType: MediaType): SelfHostedModelDefinition[] {
    const modalityMap: Record<MediaType, ModelModality> = {
      image: 'image',
      audio: 'audio',
      video: 'video',
      '3d': '3d',
      document: 'text',
    };
    
    return SELF_HOSTED_MODEL_REGISTRY.filter(m =>
      m.outputModalities.includes(modalityMap[outputType])
    );
  }
  
  /**
   * Select the best model for image generation
   */
  async selectImageGenerationModel(
    options?: {
      qualityTier?: 'premium' | 'standard' | 'economy';
      preferInpainting?: boolean;
      preferTextRendering?: boolean;
    },
    context?: { tenantId: string }
  ): Promise<SelfHostedModelDefinition | null> {
    const capabilities = ['image_generation', 'text_to_image'];
    if (options?.preferInpainting) {
      capabilities.push('inpainting');
    }
    
    const result = await selfHostedModelSelector.selectBestModel(
      {
        capabilities,
        outputModality: 'image',
        qualityTier: options?.qualityTier,
        preferredFor: options?.preferTextRendering ? 'text_in_images' : 'image_generation',
      },
      context ? { tenantId: context.tenantId } : undefined
    );
    
    return result?.model || null;
  }
  
  /**
   * Select the best model for audio processing
   */
  async selectAudioModel(
    task: 'transcription' | 'tts' | 'music' | 'sound_effects',
    options?: {
      qualityTier?: 'premium' | 'standard' | 'economy';
    },
    context?: { tenantId: string }
  ): Promise<SelfHostedModelDefinition | null> {
    const taskConfig: Record<string, { capabilities: string[]; preferredFor: string; input?: ModelModality; output?: ModelModality }> = {
      transcription: {
        capabilities: ['transcription'],
        preferredFor: 'transcription',
        input: 'audio',
        output: 'text',
      },
      tts: {
        capabilities: ['text_to_speech'],
        preferredFor: 'text_to_speech',
        input: 'text',
        output: 'audio',
      },
      music: {
        capabilities: ['music_generation'],
        preferredFor: 'music_generation',
        output: 'audio',
      },
      sound_effects: {
        capabilities: ['sound_generation'],
        preferredFor: 'sound_effects',
        output: 'audio',
      },
    };
    
    const config = taskConfig[task];
    
    const result = await selfHostedModelSelector.selectBestModel(
      {
        capabilities: config.capabilities,
        inputModality: config.input,
        outputModality: config.output,
        qualityTier: options?.qualityTier,
        preferredFor: config.preferredFor,
      },
      context ? { tenantId: context.tenantId } : undefined
    );
    
    return result?.model || null;
  }
  
  /**
   * Select the best model for 3D generation
   */
  async select3DGenerationModel(
    options?: {
      preferMesh?: boolean;
      qualityTier?: 'premium' | 'standard' | 'economy';
    },
    context?: { tenantId: string }
  ): Promise<SelfHostedModelDefinition | null> {
    const result = await selfHostedModelSelector.selectBestModel(
      {
        capabilities: options?.preferMesh ? ['mesh_generation'] : ['3d_generation'],
        outputModality: '3d',
        qualityTier: options?.qualityTier,
        preferredFor: options?.preferMesh ? '3d_mesh_generation' : '3d_prototyping',
      },
      context ? { tenantId: context.tenantId } : undefined
    );
    
    return result?.model || null;
  }
  
  /**
   * Select the best model for vision/image understanding
   */
  async selectVisionModel(
    options?: {
      preferOCR?: boolean;
      preferCharts?: boolean;
      preferVideo?: boolean;
      qualityTier?: 'premium' | 'standard' | 'economy';
    },
    context?: { tenantId: string }
  ): Promise<SelfHostedModelDefinition | null> {
    const capabilities = ['vision', 'image_analysis'];
    if (options?.preferOCR) capabilities.push('ocr');
    if (options?.preferCharts) capabilities.push('diagram_understanding');
    if (options?.preferVideo) capabilities.push('video_understanding');
    
    const result = await selfHostedModelSelector.selectBestModel(
      {
        capabilities,
        inputModality: options?.preferVideo ? 'video' : 'image',
        qualityTier: options?.qualityTier,
        preferredFor: options?.preferOCR ? 'document_ocr' : 
                      options?.preferCharts ? 'chart_interpretation' :
                      options?.preferVideo ? 'video_analysis' : 'image_understanding',
      },
      context ? { tenantId: context.tenantId } : undefined
    );
    
    return result?.model || null;
  }
  
  /**
   * Get supported formats for a media type
   */
  getSupportedFormats(mediaType: MediaType): string[] {
    const formatSets: Record<MediaType, Set<string>> = {
      image: new Set(),
      audio: new Set(),
      video: new Set(),
      '3d': new Set(),
      document: new Set(['pdf', 'docx', 'txt', 'md']),
    };
    
    for (const model of SELF_HOSTED_MODEL_REGISTRY) {
      if (!model.mediaSupport) continue;
      
      const formats = model.mediaSupport.supportedFormats || [];
      for (const format of formats) {
        if (mediaType === 'image' && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(format)) {
          formatSets.image.add(format);
        } else if (mediaType === 'audio' && ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'webm'].includes(format)) {
          formatSets.audio.add(format);
        } else if (mediaType === 'video' && ['mp4', 'avi', 'mov', 'webm'].includes(format)) {
          formatSets.video.add(format);
        } else if (mediaType === '3d' && ['glb', 'obj', 'ply', 'stl'].includes(format)) {
          formatSets['3d'].add(format);
        }
      }
    }
    
    return Array.from(formatSets[mediaType]);
  }
  
  /**
   * Check if a model supports specific media input
   */
  supportsMediaInput(modelId: string, mediaType: MediaType): boolean {
    const model = getSelfHostedModelById(modelId);
    if (!model) return false;
    
    const modalityMap: Record<MediaType, ModelModality> = {
      image: 'image',
      audio: 'audio',
      video: 'video',
      '3d': '3d',
      document: 'text',
    };
    
    return model.inputModalities.includes(modalityMap[mediaType]);
  }
  
  /**
   * Check if a model supports specific media output
   */
  supportsMediaOutput(modelId: string, mediaType: MediaType): boolean {
    const model = getSelfHostedModelById(modelId);
    if (!model) return false;
    
    const modalityMap: Record<MediaType, ModelModality> = {
      image: 'image',
      audio: 'audio',
      video: 'video',
      '3d': '3d',
      document: 'text',
    };
    
    return model.outputModalities.includes(modalityMap[mediaType]);
  }
  
  /**
   * Get media limits for a model
   */
  getMediaLimits(modelId: string): {
    maxImageSize?: number;
    maxAudioLength?: number;
    maxVideoLength?: number;
  } | null {
    const model = getSelfHostedModelById(modelId);
    if (!model?.mediaSupport) return null;
    
    return {
      maxImageSize: model.mediaSupport.maxImageSize,
      maxAudioLength: model.mediaSupport.maxAudioLength,
    };
  }
  
  /**
   * Validate media input against model constraints
   */
  validateMediaInput(
    modelId: string,
    input: MediaInput
  ): { valid: boolean; error?: string } {
    const model = getSelfHostedModelById(modelId);
    if (!model) {
      return { valid: false, error: 'Model not found' };
    }
    
    // Check if model accepts this input type
    if (!this.supportsMediaInput(modelId, input.type)) {
      return { valid: false, error: `Model does not accept ${input.type} input` };
    }
    
    // Check format
    const supportedFormats = model.mediaSupport?.supportedFormats || [];
    if (supportedFormats.length > 0 && !supportedFormats.includes(input.format)) {
      return { valid: false, error: `Unsupported format: ${input.format}. Supported: ${supportedFormats.join(', ')}` };
    }
    
    // Check size limits
    if (input.type === 'image' && model.mediaSupport?.maxImageSize && input.size) {
      if (input.size > model.mediaSupport.maxImageSize) {
        return { valid: false, error: `Image too large. Max: ${model.mediaSupport.maxImageSize}px` };
      }
    }
    
    if (input.type === 'audio' && model.mediaSupport?.maxAudioLength && input.metadata?.duration) {
      if ((input.metadata.duration as number) > model.mediaSupport.maxAudioLength) {
        return { valid: false, error: `Audio too long. Max: ${model.mediaSupport.maxAudioLength}s` };
      }
    }
    
    return { valid: true };
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private hasMediaCapabilities(model: SelfHostedModelDefinition): boolean {
    // Check if model handles non-text modalities
    const mediaModalities: ModelModality[] = ['image', 'audio', 'video', '3d'];
    
    return (
      model.inputModalities.some(m => mediaModalities.includes(m)) ||
      model.outputModalities.some(m => mediaModalities.includes(m))
    );
  }
  
  private extractMediaCapabilities(model: SelfHostedModelDefinition): MediaCapabilities {
    return {
      modelId: model.id,
      displayName: model.displayName,
      input: {
        image: model.inputModalities.includes('image'),
        audio: model.inputModalities.includes('audio'),
        video: model.inputModalities.includes('video'),
        document: model.mediaSupport?.documentInput || false,
      },
      output: {
        image: model.outputModalities.includes('image'),
        audio: model.outputModalities.includes('audio'),
        video: model.outputModalities.includes('video'),
        threeD: model.outputModalities.includes('3d'),
      },
      limits: {
        maxImageSize: model.mediaSupport?.maxImageSize,
        maxAudioLength: model.mediaSupport?.maxAudioLength,
      },
      formats: {
        image: this.getFormatsForType(model, 'image'),
        audio: this.getFormatsForType(model, 'audio'),
        video: this.getFormatsForType(model, 'video'),
        threeD: this.getFormatsForType(model, '3d'),
      },
    };
  }
  
  private getFormatsForType(model: SelfHostedModelDefinition, type: MediaType): string[] {
    const allFormats = model.mediaSupport?.supportedFormats || [];
    
    const typeFormats: Record<MediaType, string[]> = {
      image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'tiff'],
      audio: ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'webm', 'aac'],
      video: ['mp4', 'avi', 'mov', 'webm', 'mkv'],
      '3d': ['glb', 'obj', 'ply', 'stl', 'fbx'],
      document: ['pdf', 'docx', 'txt', 'md'],
    };
    
    return allFormats.filter(f => typeFormats[type].includes(f));
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const thinkTankMediaService = new ThinkTankMediaService();
