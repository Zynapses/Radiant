// RADIANT v4.18.55 - Multi-Model File Preparation Service
// Per-model conversion decisions: only convert for models that don't support the format
// "If a model accepts the file type, assume it understands it unless proven otherwise"

import { v4 as uuidv4 } from 'uuid';
import { fileConversionService, ConversionResult, FileInfo, ConversionDecision } from './file-conversion.service';
import { fileConversionLearningService, FormatRecommendation } from './file-conversion-learning.service';

// ============================================================================
// Types
// ============================================================================

export interface ModelFileCapability {
  modelId: string;
  providerId: string;
  supportsFormat: boolean;
  supportsVision: boolean;
  supportsAudio: boolean;
  maxFileSize: number;
  nativeFormats: string[];
}

export interface MultiModelFileRequest {
  tenantId: string;
  userId: string;
  conversationId?: string;
  file: {
    content: Buffer | string;
    filename: string;
    mimeType: string;
  };
  targetModels: {
    modelId: string;
    providerId: string;
  }[];
}

export interface PerModelFilePrep {
  modelId: string;
  providerId: string;
  action: 'pass_original' | 'convert' | 'skip';
  reason: string;
  content?: {
    type: 'original' | 'converted';
    data: Buffer | string;
    mimeType: string;
    tokenEstimate?: number;
  };
  conversionResult?: ConversionResult;
  // Learning-based decision info
  learningRecommendation?: FormatRecommendation;
  usedLearning?: boolean;
}

export interface MultiModelFilePrepResult {
  success: boolean;
  fileInfo: FileInfo;
  perModelPrep: PerModelFilePrep[];
  summary: {
    totalModels: number;
    passOriginal: number;
    needsConversion: number;
    skipped: number;
  };
  // Cached conversion - only convert once, reuse for all models that need it
  cachedConversion?: ConversionResult;
}

// ============================================================================
// Model Capability Overrides
// When a model proves it doesn't understand a format despite claiming support
// ============================================================================

interface ModelFormatOverride {
  modelId: string;
  format: string;
  reason: string;
  dateAdded: string;
}

// Models that claim to support a format but have proven they don't understand it well
const MODEL_FORMAT_OVERRIDES: ModelFormatOverride[] = [
  // Example: if Claude claims PDF support but struggles with complex PDFs
  // { modelId: 'claude-3-haiku', format: 'pdf', reason: 'Struggles with multi-column PDFs', dateAdded: '2024-12-01' },
];

// ============================================================================
// Service
// ============================================================================

class MultiModelFilePrepService {

  /**
   * Prepare a file for multiple models - convert only for models that need it
   * 
   * Key principle: If a model natively supports a format, pass the original.
   * Only convert for models that don't support the format.
   */
  async prepareFileForModels(request: MultiModelFileRequest): Promise<MultiModelFilePrepResult> {
    const { tenantId, userId, conversationId, file, targetModels } = request;

    // Get file info
    const content = typeof file.content === 'string' 
      ? Buffer.from(file.content, 'base64')
      : file.content;

    const fileInfo = fileConversionService.getFileInfo(content, file.filename, file.mimeType);
    
    // Check each model's capability for this file
    const perModelPrep: PerModelFilePrep[] = [];
    let cachedConversion: ConversionResult | undefined;
    
    const summary = {
      totalModels: targetModels.length,
      passOriginal: 0,
      needsConversion: 0,
      skipped: 0,
    };

    for (const model of targetModels) {
      const prep = await this.prepareForSingleModel(
        tenantId,
        userId,
        conversationId,
        content,
        fileInfo,
        model.modelId,
        model.providerId,
        cachedConversion
      );

      perModelPrep.push(prep);

      // Track summary
      switch (prep.action) {
        case 'pass_original':
          summary.passOriginal++;
          break;
        case 'convert':
          summary.needsConversion++;
          // Cache the conversion result for other models that need it
          if (prep.conversionResult && !cachedConversion) {
            cachedConversion = prep.conversionResult;
          }
          break;
        case 'skip':
          summary.skipped++;
          break;
      }
    }

    return {
      success: true,
      fileInfo,
      perModelPrep,
      summary,
      cachedConversion,
    };
  }

  /**
   * Prepare file for a single model
   * Uses learned format understanding to make smarter decisions
   */
  private async prepareForSingleModel(
    tenantId: string,
    userId: string,
    conversationId: string | undefined,
    content: Buffer,
    fileInfo: FileInfo,
    modelId: string,
    providerId: string,
    cachedConversion?: ConversionResult
  ): Promise<PerModelFilePrep> {
    
    // Check if this model has a format override (proven not to understand despite claiming support)
    const override = this.checkFormatOverride(modelId, fileInfo.format);
    if (override) {
      // Model claims support but has proven issues - convert
      return this.handleConversion(
        tenantId, userId, conversationId, content, fileInfo, modelId, providerId,
        `Override: ${override.reason}`,
        cachedConversion
      );
    }

    // Check learned format understanding from reinforcement learning
    let learningRecommendation: FormatRecommendation | undefined;
    try {
      learningRecommendation = await fileConversionLearningService.getFormatRecommendation(
        tenantId,
        modelId,
        fileInfo.format
      );
      
      // If learning says this model struggles with this format, convert
      if (learningRecommendation.shouldConvert && learningRecommendation.confidence >= 0.5) {
        const result = await this.handleConversion(
          tenantId, userId, conversationId, content, fileInfo, modelId, providerId,
          `Learning: ${learningRecommendation.reason}`,
          cachedConversion
        );
        result.learningRecommendation = learningRecommendation;
        result.usedLearning = true;
        return result;
      }
    } catch (error) {
      // Don't fail if learning service unavailable
      console.warn('Learning service unavailable:', error);
    }

    // Get provider capabilities
    const capabilities = fileConversionService.getProviderCapabilities(providerId);
    
    if (!capabilities) {
      // Unknown provider - try conversion as fallback
      return this.handleConversion(
        tenantId, userId, conversationId, content, fileInfo, modelId, providerId,
        'Unknown provider - converting as precaution',
        cachedConversion
      );
    }

    // Check if provider natively supports this format
    const nativelySupported = capabilities.nativeDocumentFormats.includes(fileInfo.format as any) ||
                              capabilities.supportedFormats.includes(fileInfo.format as any);

    // Check for vision/audio requirements
    const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'svg'].includes(fileInfo.format);
    const isAudio = ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(fileInfo.format);
    const isVideo = ['mp4', 'webm', 'mov', 'avi'].includes(fileInfo.format);

    // If it's an image and provider has vision, pass original
    if (isImage && capabilities.supportsVision) {
      return {
        modelId,
        providerId,
        action: 'pass_original',
        reason: 'Provider has vision capability - passing original image',
        content: {
          type: 'original',
          data: content,
          mimeType: fileInfo.mimeType,
        },
      };
    }

    // If it's audio and provider has audio support, pass original
    if (isAudio && capabilities.supportsAudio) {
      return {
        modelId,
        providerId,
        action: 'pass_original',
        reason: 'Provider has audio capability - passing original audio',
        content: {
          type: 'original',
          data: content,
          mimeType: fileInfo.mimeType,
        },
      };
    }

    // If it's video and provider has video support, pass original
    if (isVideo && capabilities.supportsVideo) {
      return {
        modelId,
        providerId,
        action: 'pass_original',
        reason: 'Provider has video capability - passing original video',
        content: {
          type: 'original',
          data: content,
          mimeType: fileInfo.mimeType,
        },
      };
    }

    // Check file size
    if (content.length > capabilities.maxFileSize) {
      return {
        modelId,
        providerId,
        action: 'skip',
        reason: `File size (${formatFileSize(content.length)}) exceeds provider limit (${formatFileSize(capabilities.maxFileSize)})`,
      };
    }

    // If natively supported, pass original
    if (nativelySupported) {
      return {
        modelId,
        providerId,
        action: 'pass_original',
        reason: `Provider natively supports ${fileInfo.format.toUpperCase()} - passing original`,
        content: {
          type: 'original',
          data: content,
          mimeType: fileInfo.mimeType,
        },
      };
    }

    // Not natively supported - needs conversion
    return this.handleConversion(
      tenantId, userId, conversationId, content, fileInfo, modelId, providerId,
      `Provider does not natively support ${fileInfo.format.toUpperCase()}`,
      cachedConversion
    );
  }

  /**
   * Handle conversion for a model that needs it
   */
  private async handleConversion(
    tenantId: string,
    userId: string,
    conversationId: string | undefined,
    content: Buffer,
    fileInfo: FileInfo,
    modelId: string,
    providerId: string,
    reason: string,
    cachedConversion?: ConversionResult
  ): Promise<PerModelFilePrep> {
    
    // If we already have a cached conversion, reuse it
    if (cachedConversion && cachedConversion.success) {
      return {
        modelId,
        providerId,
        action: 'convert',
        reason: `${reason} (using cached conversion)`,
        content: {
          type: 'converted',
          data: cachedConversion.convertedContent?.content || '',
          mimeType: 'text/plain',
          tokenEstimate: cachedConversion.convertedContent?.tokenEstimate,
        },
        conversionResult: cachedConversion,
      };
    }

    // Perform conversion
    const conversionResult = await fileConversionService.processFile({
      tenantId,
      userId,
      conversationId,
      targetProviderId: providerId,
      targetModelId: modelId,
      file: {
        content,
        filename: fileInfo.filename,
        mimeType: fileInfo.mimeType,
      },
    });

    if (conversionResult.success && conversionResult.convertedContent) {
      return {
        modelId,
        providerId,
        action: 'convert',
        reason,
        content: {
          type: 'converted',
          data: conversionResult.convertedContent.content,
          mimeType: 'text/plain',
          tokenEstimate: conversionResult.convertedContent.tokenEstimate,
        },
        conversionResult,
      };
    } else {
      return {
        modelId,
        providerId,
        action: 'skip',
        reason: `Conversion failed: ${conversionResult.error || 'Unknown error'}`,
        conversionResult,
      };
    }
  }

  /**
   * Check if there's a format override for this model
   * (When model claims support but has proven it doesn't work well)
   */
  private checkFormatOverride(modelId: string, format: string): ModelFormatOverride | undefined {
    return MODEL_FORMAT_OVERRIDES.find(
      o => o.modelId === modelId && o.format === format
    );
  }

  /**
   * Add a format override (when we discover a model doesn't understand a format)
   * This would typically be called from a learning/feedback system
   */
  addFormatOverride(modelId: string, format: string, reason: string): void {
    const existing = MODEL_FORMAT_OVERRIDES.find(
      o => o.modelId === modelId && o.format === format
    );
    
    if (!existing) {
      MODEL_FORMAT_OVERRIDES.push({
        modelId,
        format,
        reason,
        dateAdded: new Date().toISOString(),
      });
    }
  }

  /**
   * Get the appropriate content for a specific model from prep results
   */
  getContentForModel(
    prepResult: MultiModelFilePrepResult,
    modelId: string
  ): { content: Buffer | string; mimeType: string; wasConverted: boolean } | null {
    const modelPrep = prepResult.perModelPrep.find(p => p.modelId === modelId);
    
    if (!modelPrep || modelPrep.action === 'skip' || !modelPrep.content) {
      return null;
    }

    return {
      content: modelPrep.content.data,
      mimeType: modelPrep.content.mimeType,
      wasConverted: modelPrep.content.type === 'converted',
    };
  }

  /**
   * Generate a summary of what happened with file prep
   */
  generatePrepSummary(prepResult: MultiModelFilePrepResult): string {
    const { summary, perModelPrep } = prepResult;
    const parts: string[] = [];

    parts.push(`**File Preparation Summary**`);
    parts.push(`File: ${prepResult.fileInfo.filename} (${prepResult.fileInfo.format.toUpperCase()})`);
    parts.push('');

    if (summary.passOriginal > 0) {
      parts.push(`✅ **${summary.passOriginal}** model(s) will receive the original file`);
      const originals = perModelPrep.filter(p => p.action === 'pass_original');
      originals.forEach(p => parts.push(`   - ${p.modelId}: ${p.reason}`));
    }

    if (summary.needsConversion > 0) {
      parts.push(`🔄 **${summary.needsConversion}** model(s) will receive converted content`);
      const converted = perModelPrep.filter(p => p.action === 'convert');
      converted.forEach(p => parts.push(`   - ${p.modelId}: ${p.reason}`));
    }

    if (summary.skipped > 0) {
      parts.push(`⚠️ **${summary.skipped}** model(s) skipped`);
      const skipped = perModelPrep.filter(p => p.action === 'skip');
      skipped.forEach(p => parts.push(`   - ${p.modelId}: ${p.reason}`));
    }

    return parts.join('\n');
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// Export singleton
// ============================================================================

export const multiModelFilePrepService = new MultiModelFilePrepService();
