// RADIANT v4.18.55 - Intelligent File Conversion Service
// Radiant decides if/how to convert files for AI providers
// "Let's let Radiant decide if it needs conversion or not, not Think Tank"

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { executeStatement, stringParam } from '../db/client';

// Import all converters
import {
  extractPdfText,
  extractDocxText,
  extractExcelData,
  parseCsv,
  transcribeAudio,
  describeImage as describeImageWithVision,
  extractTextFromImage,
  describeVideo as describeVideoWithVision,
  extractArchive,
} from './converters';

// ============================================================================
// Types
// ============================================================================

export type FileFormat = 
  | 'pdf' | 'docx' | 'doc' | 'xlsx' | 'xls' | 'pptx' | 'ppt'
  | 'txt' | 'md' | 'json' | 'csv' | 'xml' | 'html'
  | 'png' | 'jpg' | 'jpeg' | 'gif' | 'webp' | 'svg' | 'bmp' | 'tiff'
  | 'mp3' | 'wav' | 'ogg' | 'flac' | 'm4a'
  | 'mp4' | 'webm' | 'mov' | 'avi'
  | 'py' | 'js' | 'ts' | 'java' | 'cpp' | 'c' | 'go' | 'rs' | 'rb'
  | 'zip' | 'tar' | 'gz'
  | 'unknown';

export type ConversionStrategy = 
  | 'none'           // No conversion needed
  | 'extract_text'   // Extract text content (PDF, DOCX, etc.)
  | 'ocr'            // OCR for images with text
  | 'transcribe'     // Audio to text
  | 'describe_image' // Use AI to describe image
  | 'describe_video' // Extract frames + describe
  | 'parse_data'     // Parse structured data (CSV, JSON, XML)
  | 'decompress'     // Extract archive contents
  | 'render_code'    // Syntax highlight + format code
  | 'unsupported';   // Cannot process this format

export interface FileInfo {
  filename: string;
  mimeType: string;
  format: FileFormat;
  size: number;
  checksum: string;
}

export interface ProviderCapabilities {
  providerId: string;
  supportedFormats: FileFormat[];
  maxFileSize: number;           // bytes
  supportsVision: boolean;
  supportsAudio: boolean;
  supportsVideo: boolean;
  nativeDocumentFormats: FileFormat[];  // Formats provider handles natively
}

export interface ConversionDecision {
  needsConversion: boolean;
  strategy: ConversionStrategy;
  reason: string;
  targetFormat?: FileFormat;
  estimatedTokens?: number;
  warnings?: string[];
}

export interface ConversionResult {
  success: boolean;
  conversionId: string;
  originalFile: FileInfo;
  convertedContent?: {
    type: 'text' | 'image_description' | 'transcription' | 'structured_data';
    content: string;
    tokenEstimate: number;
    metadata?: Record<string, unknown>;
  };
  convertedFileUrl?: string;
  error?: string;
  processingTimeMs: number;
}

export interface FileProcessingRequest {
  tenantId: string;
  userId: string;
  conversationId?: string;
  targetProviderId: string;
  targetModelId: string;
  file: {
    content: Buffer | string;
    filename: string;
    mimeType: string;
  };
}

// ============================================================================
// Provider Capabilities Registry
// ============================================================================

const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
  'openai': {
    providerId: 'openai',
    supportedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'md', 'json', 'csv'],
    maxFileSize: 20 * 1024 * 1024, // 20MB
    supportsVision: true,
    supportsAudio: true,  // Whisper
    supportsVideo: false,
    nativeDocumentFormats: ['txt', 'md', 'json', 'csv'],
  },
  'anthropic': {
    providerId: 'anthropic',
    supportedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'txt', 'md', 'json', 'csv'],
    maxFileSize: 32 * 1024 * 1024, // 32MB
    supportsVision: true,
    supportsAudio: false,
    supportsVideo: false,
    nativeDocumentFormats: ['pdf', 'txt', 'md', 'json', 'csv'],
  },
  'google': {
    providerId: 'google',
    supportedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'txt', 'md', 'json', 'csv', 'mp3', 'wav', 'mp4'],
    maxFileSize: 100 * 1024 * 1024, // 100MB
    supportsVision: true,
    supportsAudio: true,
    supportsVideo: true,
    nativeDocumentFormats: ['pdf', 'txt', 'md', 'json', 'csv'],
  },
  'xai': {
    providerId: 'xai',
    supportedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'md', 'json'],
    maxFileSize: 20 * 1024 * 1024,
    supportsVision: true,
    supportsAudio: false,
    supportsVideo: false,
    nativeDocumentFormats: ['txt', 'md', 'json'],
  },
  'deepseek': {
    providerId: 'deepseek',
    supportedFormats: ['txt', 'md', 'json', 'csv'],
    maxFileSize: 10 * 1024 * 1024,
    supportsVision: false,
    supportsAudio: false,
    supportsVideo: false,
    nativeDocumentFormats: ['txt', 'md', 'json', 'csv'],
  },
  'self-hosted': {
    providerId: 'self-hosted',
    supportedFormats: ['txt', 'md', 'json', 'csv', 'png', 'jpg', 'jpeg'],
    maxFileSize: 50 * 1024 * 1024,
    supportsVision: true,  // LLaVA, etc.
    supportsAudio: true,   // Whisper
    supportsVideo: false,
    nativeDocumentFormats: ['txt', 'md', 'json', 'csv'],
  },
};

// ============================================================================
// Format Detection
// ============================================================================

const MIME_TO_FORMAT: Record<string, FileFormat> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'ppt',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/json': 'json',
  'text/csv': 'csv',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'text/html': 'html',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/mp4': 'm4a',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'text/x-python': 'py',
  'application/javascript': 'js',
  'text/javascript': 'js',
  'text/typescript': 'ts',
  'text/x-java-source': 'java',
  'text/x-c++src': 'cpp',
  'text/x-csrc': 'c',
  'application/zip': 'zip',
  'application/x-tar': 'tar',
  'application/gzip': 'gz',
};

const EXTENSION_TO_FORMAT: Record<string, FileFormat> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.doc': 'doc',
  '.xlsx': 'xlsx',
  '.xls': 'xls',
  '.pptx': 'pptx',
  '.ppt': 'ppt',
  '.txt': 'txt',
  '.md': 'md',
  '.markdown': 'md',
  '.json': 'json',
  '.csv': 'csv',
  '.xml': 'xml',
  '.html': 'html',
  '.htm': 'html',
  '.png': 'png',
  '.jpg': 'jpg',
  '.jpeg': 'jpg',
  '.gif': 'gif',
  '.webp': 'webp',
  '.svg': 'svg',
  '.bmp': 'bmp',
  '.tiff': 'tiff',
  '.tif': 'tiff',
  '.mp3': 'mp3',
  '.wav': 'wav',
  '.ogg': 'ogg',
  '.flac': 'flac',
  '.m4a': 'm4a',
  '.mp4': 'mp4',
  '.webm': 'webm',
  '.mov': 'mov',
  '.avi': 'avi',
  '.py': 'py',
  '.js': 'js',
  '.ts': 'ts',
  '.tsx': 'ts',
  '.jsx': 'js',
  '.java': 'java',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.c': 'c',
  '.go': 'go',
  '.rs': 'rs',
  '.rb': 'rb',
  '.zip': 'zip',
  '.tar': 'tar',
  '.gz': 'gz',
};

// ============================================================================
// File Conversion Service
// ============================================================================

export class FileConversionService {
  private s3: S3Client;
  private bucketName: string;

  constructor() {
    this.s3 = new S3Client({});
    this.bucketName = process.env.FILE_CONVERSION_BUCKET || process.env.ARTIFACTS_BUCKET || 'radiant-files';
  }

  // ============================================================================
  // Format Detection
  // ============================================================================

  detectFormat(filename: string, mimeType: string): FileFormat {
    // Try MIME type first
    if (mimeType && MIME_TO_FORMAT[mimeType]) {
      return MIME_TO_FORMAT[mimeType];
    }

    // Fall back to extension
    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (ext && EXTENSION_TO_FORMAT[ext]) {
      return EXTENSION_TO_FORMAT[ext];
    }

    return 'unknown';
  }

  getFileInfo(content: Buffer | string, filename: string, mimeType: string): FileInfo {
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    const checksum = createHash('sha256').update(buffer).digest('hex');

    return {
      filename,
      mimeType,
      format: this.detectFormat(filename, mimeType),
      size: buffer.length,
      checksum,
    };
  }

  // ============================================================================
  // Conversion Decision Engine
  // ============================================================================

  getProviderCapabilities(providerId: string): ProviderCapabilities {
    // Normalize provider ID
    const normalizedId = providerId.toLowerCase();
    
    // Check for exact match
    if (PROVIDER_CAPABILITIES[normalizedId]) {
      return PROVIDER_CAPABILITIES[normalizedId];
    }

    // Check for partial match (e.g., "openai-gpt4" -> "openai")
    for (const key of Object.keys(PROVIDER_CAPABILITIES)) {
      if (normalizedId.includes(key)) {
        return PROVIDER_CAPABILITIES[key];
      }
    }

    // Default to self-hosted capabilities (most restrictive)
    return PROVIDER_CAPABILITIES['self-hosted'];
  }

  /**
   * Radiant decides if conversion is needed based on:
   * 1. Target provider capabilities
   * 2. File format
   * 3. File size
   */
  decideConversion(fileInfo: FileInfo, providerId: string): ConversionDecision {
    const capabilities = this.getProviderCapabilities(providerId);
    const warnings: string[] = [];

    // Check file size
    if (fileInfo.size > capabilities.maxFileSize) {
      return {
        needsConversion: true,
        strategy: 'extract_text',
        reason: `File size (${(fileInfo.size / 1024 / 1024).toFixed(2)}MB) exceeds provider limit (${(capabilities.maxFileSize / 1024 / 1024).toFixed(0)}MB)`,
        warnings: ['Large file will be converted to text extract'],
      };
    }

    // Check if format is natively supported
    if (capabilities.supportedFormats.includes(fileInfo.format)) {
      // Provider handles this format natively
      if (capabilities.nativeDocumentFormats.includes(fileInfo.format)) {
        return {
          needsConversion: false,
          strategy: 'none',
          reason: `Provider ${providerId} natively supports ${fileInfo.format} format`,
        };
      }

      // Images with vision support
      if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileInfo.format)) {
        if (capabilities.supportsVision) {
          return {
            needsConversion: false,
            strategy: 'none',
            reason: `Provider ${providerId} has native vision support for ${fileInfo.format}`,
          };
        } else {
          return {
            needsConversion: true,
            strategy: 'describe_image',
            reason: `Provider ${providerId} lacks vision - will use AI to describe image`,
            targetFormat: 'txt',
          };
        }
      }

      // Audio with transcription support
      if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(fileInfo.format)) {
        if (capabilities.supportsAudio) {
          return {
            needsConversion: false,
            strategy: 'none',
            reason: `Provider ${providerId} has native audio support`,
          };
        } else {
          return {
            needsConversion: true,
            strategy: 'transcribe',
            reason: `Provider ${providerId} lacks audio support - will transcribe to text`,
            targetFormat: 'txt',
          };
        }
      }

      // Video
      if (['mp4', 'webm', 'mov', 'avi'].includes(fileInfo.format)) {
        if (capabilities.supportsVideo) {
          return {
            needsConversion: false,
            strategy: 'none',
            reason: `Provider ${providerId} has native video support`,
          };
        } else {
          return {
            needsConversion: true,
            strategy: 'describe_video',
            reason: `Provider ${providerId} lacks video support - will extract frames and describe`,
            targetFormat: 'txt',
          };
        }
      }
    }

    // Format not supported - determine conversion strategy
    switch (fileInfo.format) {
      case 'pdf':
        return {
          needsConversion: true,
          strategy: 'extract_text',
          reason: `Provider ${providerId} doesn't support PDF - extracting text content`,
          targetFormat: 'txt',
          estimatedTokens: Math.ceil(fileInfo.size / 4), // Rough estimate
        };

      case 'docx':
      case 'doc':
        return {
          needsConversion: true,
          strategy: 'extract_text',
          reason: `Provider ${providerId} doesn't support Word documents - extracting text`,
          targetFormat: 'txt',
        };

      case 'xlsx':
      case 'xls':
      case 'csv':
        return {
          needsConversion: true,
          strategy: 'parse_data',
          reason: `Provider ${providerId} doesn't support spreadsheets - parsing as structured data`,
          targetFormat: 'json',
        };

      case 'pptx':
      case 'ppt':
        return {
          needsConversion: true,
          strategy: 'extract_text',
          reason: `Provider ${providerId} doesn't support PowerPoint - extracting slide text`,
          targetFormat: 'txt',
          warnings: ['Images in slides will be described separately'],
        };

      case 'html':
      case 'xml':
        return {
          needsConversion: true,
          strategy: 'extract_text',
          reason: `Converting ${fileInfo.format.toUpperCase()} to plain text`,
          targetFormat: 'txt',
        };

      case 'svg':
      case 'bmp':
      case 'tiff':
        return {
          needsConversion: true,
          strategy: capabilities.supportsVision ? 'none' : 'describe_image',
          reason: capabilities.supportsVision 
            ? `Converting ${fileInfo.format} to supported image format`
            : `Provider lacks vision - describing image content`,
          targetFormat: capabilities.supportsVision ? 'png' : 'txt',
        };

      case 'zip':
      case 'tar':
      case 'gz':
        return {
          needsConversion: true,
          strategy: 'decompress',
          reason: 'Archive will be extracted and contents processed individually',
          warnings: ['Only text-based files in archive will be processed'],
        };

      case 'py':
      case 'js':
      case 'ts':
      case 'java':
      case 'cpp':
      case 'c':
      case 'go':
      case 'rs':
      case 'rb':
        return {
          needsConversion: false,
          strategy: 'render_code',
          reason: 'Code file - will be sent as syntax-highlighted text',
          targetFormat: 'txt',
        };

      default:
        return {
          needsConversion: true,
          strategy: 'unsupported',
          reason: `Unknown format "${fileInfo.format}" - attempting text extraction`,
          targetFormat: 'txt',
          warnings: ['Format may not be fully supported'],
        };
    }
  }

  // ============================================================================
  // File Processing
  // ============================================================================

  /**
   * Main entry point - Think Tank calls this, Radiant decides what to do
   */
  async processFile(request: FileProcessingRequest): Promise<ConversionResult> {
    const startTime = Date.now();
    const conversionId = `conv_${uuidv4()}`;

    try {
      // Get file info
      const buffer = typeof request.file.content === 'string'
        ? Buffer.from(request.file.content, 'base64')
        : request.file.content;

      const fileInfo = this.getFileInfo(buffer, request.file.filename, request.file.mimeType);

      // Let Radiant decide if conversion is needed
      const decision = this.decideConversion(fileInfo, request.targetProviderId);

      // Log the decision
      await this.logConversionDecision(
        request.tenantId,
        conversionId,
        fileInfo,
        decision,
        request.targetProviderId,
        request.targetModelId
      );

      // If no conversion needed, just return file info
      if (!decision.needsConversion) {
        // Store original file and return URL
        const s3Key = await this.storeFile(request.tenantId, conversionId, buffer, fileInfo);
        const url = await this.getSignedUrl(s3Key);

        return {
          success: true,
          conversionId,
          originalFile: fileInfo,
          convertedFileUrl: url,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Perform conversion based on strategy
      const result = await this.executeConversion(
        request.tenantId,
        conversionId,
        buffer,
        fileInfo,
        decision,
        request.targetProviderId
      );

      return {
        success: result.success ?? true,
        conversionId,
        originalFile: fileInfo,
        processingTimeMs: Date.now() - startTime,
        convertedContent: result.convertedContent,
        convertedFileUrl: result.convertedFileUrl,
        error: result.error,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        conversionId,
        originalFile: {
          filename: request.file.filename,
          mimeType: request.file.mimeType,
          format: 'unknown',
          size: 0,
          checksum: '',
        },
        error: errorMessage,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  // ============================================================================
  // Conversion Execution
  // ============================================================================

  private async executeConversion(
    tenantId: string,
    conversionId: string,
    content: Buffer,
    fileInfo: FileInfo,
    decision: ConversionDecision,
    providerId: string
  ): Promise<Partial<ConversionResult>> {
    switch (decision.strategy) {
      case 'extract_text':
        return this.extractText(tenantId, conversionId, content, fileInfo);

      case 'ocr':
        return this.performOcr(tenantId, conversionId, content, fileInfo);

      case 'transcribe':
        return this.transcribeAudio(tenantId, conversionId, content, fileInfo);

      case 'describe_image':
        return this.describeImage(tenantId, conversionId, content, fileInfo);

      case 'describe_video':
        return this.describeVideo(tenantId, conversionId, content, fileInfo);

      case 'parse_data':
        return this.parseStructuredData(tenantId, conversionId, content, fileInfo);

      case 'decompress':
        return this.decompressArchive(tenantId, conversionId, content, fileInfo);

      case 'render_code':
        return this.renderCode(content, fileInfo);

      case 'unsupported':
        // Try basic text extraction as fallback
        return this.extractText(tenantId, conversionId, content, fileInfo);

      default:
        return {
          success: false,
          error: `Unknown conversion strategy: ${decision.strategy}`,
        };
    }
  }

  // ============================================================================
  // Conversion Strategies
  // ============================================================================

  private async extractText(
    tenantId: string,
    conversionId: string,
    content: Buffer,
    fileInfo: FileInfo
  ): Promise<Partial<ConversionResult>> {
    let extractedText = '';
    let metadata: Record<string, unknown> = {
      originalFormat: fileInfo.format,
      conversionStrategy: 'extract_text',
    };

    try {
      switch (fileInfo.format) {
        case 'txt':
        case 'md':
        case 'json':
        case 'xml':
        case 'html':
          extractedText = content.toString('utf-8');
          break;

        case 'pdf': {
          const pdfResult = await extractPdfText(content);
          if (pdfResult.success) {
            extractedText = pdfResult.text;
            metadata = {
              ...metadata,
              pageCount: pdfResult.metadata.pageCount,
              title: pdfResult.metadata.title,
              author: pdfResult.metadata.author,
            };
          } else {
            return {
              success: false,
              error: pdfResult.error || 'PDF extraction failed',
            };
          }
          break;
        }

        case 'docx':
        case 'doc': {
          const docxResult = await extractDocxText(content);
          if (docxResult.success) {
            extractedText = docxResult.text;
            metadata = {
              ...metadata,
              hasImages: docxResult.metadata.hasImages,
              warnings: docxResult.metadata.warnings,
            };
          } else {
            return {
              success: false,
              error: docxResult.error || 'DOCX extraction failed',
            };
          }
          break;
        }

        case 'pptx':
        case 'ppt': {
          // PowerPoint - extract text similar to DOCX
          const pptResult = await extractDocxText(content);
          if (pptResult.success) {
            extractedText = pptResult.text;
            metadata = { ...metadata, type: 'presentation' };
          } else {
            extractedText = `[PowerPoint content from ${fileInfo.filename}]`;
          }
          break;
        }

        default:
          // Try to read as text
          try {
            extractedText = content.toString('utf-8');
          } catch {
            extractedText = `[Binary content from ${fileInfo.filename} - ${fileInfo.size} bytes]`;
          }
      }

      const tokenEstimate = Math.ceil(extractedText.length / 4);

      return {
        success: true,
        convertedContent: {
          type: 'text',
          content: extractedText,
          tokenEstimate,
          metadata,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async performOcr(
    tenantId: string,
    conversionId: string,
    content: Buffer,
    fileInfo: FileInfo
  ): Promise<Partial<ConversionResult>> {
    try {
      const ocrResult = await extractTextFromImage(content, fileInfo.filename);
      
      if (ocrResult.success) {
        const tokenEstimate = Math.ceil(ocrResult.text.length / 4);
        
        return {
          success: true,
          convertedContent: {
            type: 'text',
            content: ocrResult.text,
            tokenEstimate,
            metadata: {
              originalFormat: fileInfo.format,
              conversionStrategy: 'ocr',
              confidence: ocrResult.metadata.confidence,
              wordCount: ocrResult.metadata.wordCount,
              lineCount: ocrResult.metadata.lineCount,
              hasHandwriting: ocrResult.metadata.hasHandwriting,
            },
          },
        };
      } else {
        return {
          success: false,
          error: ocrResult.error || 'OCR extraction failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async transcribeAudio(
    tenantId: string,
    conversionId: string,
    content: Buffer,
    fileInfo: FileInfo
  ): Promise<Partial<ConversionResult>> {
    try {
      const transcriptionResult = await transcribeAudio(content, fileInfo.filename, {
        model: 'whisper-1',
        includeTimestamps: true,
      });
      
      if (transcriptionResult.success) {
        const tokenEstimate = Math.ceil(transcriptionResult.text.length / 4);
        
        return {
          success: true,
          convertedContent: {
            type: 'transcription',
            content: transcriptionResult.text,
            tokenEstimate,
            metadata: {
              originalFormat: fileInfo.format,
              conversionStrategy: 'transcribe',
              duration: transcriptionResult.metadata.duration,
              language: transcriptionResult.metadata.language,
              wordCount: transcriptionResult.metadata.wordCount,
              model: transcriptionResult.metadata.model,
            },
          },
        };
      } else {
        return {
          success: false,
          error: transcriptionResult.error || 'Transcription failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async describeImage(
    tenantId: string,
    conversionId: string,
    content: Buffer,
    fileInfo: FileInfo
  ): Promise<Partial<ConversionResult>> {
    try {
      const descriptionResult = await describeImageWithVision(content, fileInfo.filename, {
        model: 'gpt-4-vision',
        detail: 'auto',
        maxTokens: 500,
        includeOcr: true,  // Also extract any text in the image
      });
      
      if (descriptionResult.success) {
        const tokenEstimate = Math.ceil(descriptionResult.description.length / 4);
        
        return {
          success: true,
          convertedContent: {
            type: 'image_description',
            content: descriptionResult.description,
            tokenEstimate,
            metadata: {
              originalFormat: fileInfo.format,
              conversionStrategy: 'describe_image',
              width: descriptionResult.metadata.width,
              height: descriptionResult.metadata.height,
              hasText: descriptionResult.metadata.hasText,
              model: descriptionResult.metadata.model,
            },
          },
        };
      } else {
        return {
          success: false,
          error: descriptionResult.error || 'Image description failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Image description failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async describeVideo(
    tenantId: string,
    conversionId: string,
    content: Buffer,
    fileInfo: FileInfo
  ): Promise<Partial<ConversionResult>> {
    try {
      const videoResult = await describeVideoWithVision(content, fileInfo.filename, {
        model: 'gpt-4-vision',
        frameInterval: 10,
        maxFrames: 10,
        detail: 'low',
      });
      
      if (videoResult.success) {
        const tokenEstimate = Math.ceil(videoResult.description.length / 4);
        
        return {
          success: true,
          convertedContent: {
            type: 'image_description',
            content: videoResult.description,
            tokenEstimate,
            metadata: {
              originalFormat: fileInfo.format,
              conversionStrategy: 'describe_video',
              duration: videoResult.metadata.duration,
              width: videoResult.metadata.width,
              height: videoResult.metadata.height,
              frameCount: videoResult.metadata.frameCount,
              model: videoResult.metadata.model,
            },
          },
        };
      } else {
        return {
          success: false,
          error: videoResult.error || 'Video description failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Video description failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async parseStructuredData(
    tenantId: string,
    conversionId: string,
    content: Buffer,
    fileInfo: FileInfo
  ): Promise<Partial<ConversionResult>> {
    try {
      let jsonString: string;
      let metadata: Record<string, unknown> = {
        originalFormat: fileInfo.format,
        conversionStrategy: 'parse_data',
      };

      switch (fileInfo.format) {
        case 'json': {
          const parsedData = JSON.parse(content.toString('utf-8'));
          jsonString = JSON.stringify(parsedData, null, 2);
          break;
        }

        case 'csv': {
          const csvData = parseCsv(content.toString('utf-8'));
          jsonString = JSON.stringify(csvData.rows, null, 2);
          metadata = {
            ...metadata,
            rowCount: csvData.rowCount,
            columnCount: csvData.columnCount,
            headers: csvData.headers,
          };
          break;
        }

        case 'xlsx':
        case 'xls': {
          const excelResult = await extractExcelData(content, {
            outputFormat: 'json',
            includeHeaders: true,
            maxRows: 10000,
          });
          
          if (excelResult.success) {
            jsonString = excelResult.json;
            metadata = {
              ...metadata,
              sheetCount: excelResult.metadata.sheetCount,
              totalRows: excelResult.metadata.totalRows,
              sheetNames: excelResult.metadata.sheetNames,
              hasFormulas: excelResult.metadata.hasFormulas,
            };
          } else {
            return {
              success: false,
              error: excelResult.error || 'Excel parsing failed',
            };
          }
          break;
        }

        default: {
          const text = content.toString('utf-8');
          jsonString = JSON.stringify({ raw: text }, null, 2);
        }
      }

      return {
        success: true,
        convertedContent: {
          type: 'structured_data',
          content: jsonString,
          tokenEstimate: Math.ceil(jsonString.length / 4),
          metadata,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse ${fileInfo.format}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async decompressArchive(
    tenantId: string,
    conversionId: string,
    content: Buffer,
    fileInfo: FileInfo
  ): Promise<Partial<ConversionResult>> {
    try {
      const archiveResult = await extractArchive(content, fileInfo.filename, {
        extractText: true,
        maxFileSize: 5 * 1024 * 1024,
        maxTotalSize: 50 * 1024 * 1024,
        maxFiles: 100,
      });
      
      if (archiveResult.success) {
        const tokenEstimate = Math.ceil(archiveResult.text.length / 4);
        
        return {
          success: true,
          convertedContent: {
            type: 'text',
            content: archiveResult.text,
            tokenEstimate,
            metadata: {
              originalFormat: fileInfo.format,
              conversionStrategy: 'decompress',
              archiveType: archiveResult.metadata.archiveType,
              fileCount: archiveResult.metadata.fileCount,
              totalSize: archiveResult.metadata.totalSize,
              textFilesCount: archiveResult.metadata.textFilesCount,
              binaryFilesCount: archiveResult.metadata.binaryFilesCount,
            },
          },
        };
      } else {
        return {
          success: false,
          error: archiveResult.error || 'Archive extraction failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Archive extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private renderCode(content: Buffer, fileInfo: FileInfo): Partial<ConversionResult> {
    const code = content.toString('utf-8');
    const formatted = `\`\`\`${fileInfo.format}\n${code}\n\`\`\``;

    return {
      success: true,
      convertedContent: {
        type: 'text',
        content: formatted,
        tokenEstimate: Math.ceil(formatted.length / 4),
        metadata: {
          originalFormat: fileInfo.format,
          conversionStrategy: 'render_code',
          language: fileInfo.format,
        },
      },
    };
  }

  // ============================================================================
  // Storage & Logging
  // ============================================================================

  private async storeFile(
    tenantId: string,
    conversionId: string,
    content: Buffer,
    fileInfo: FileInfo
  ): Promise<string> {
    const s3Key = `conversions/${tenantId}/${conversionId}/${fileInfo.filename}`;

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: content,
      ContentType: fileInfo.mimeType,
      Metadata: {
        conversionId,
        tenantId,
        checksum: fileInfo.checksum,
      },
    }));

    return s3Key;
  }

  private async getSignedUrl(s3Key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    return getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }

  private async logConversionDecision(
    tenantId: string,
    conversionId: string,
    fileInfo: FileInfo,
    decision: ConversionDecision,
    providerId: string,
    modelId: string
  ): Promise<void> {
    try {
      await executeStatement(`
        INSERT INTO file_conversions (
          id, tenant_id, filename, original_format, original_size,
          target_provider, target_model, needs_conversion, strategy,
          decision_reason, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
        )
      `, [
        stringParam(conversionId),
        stringParam(tenantId),
        stringParam(fileInfo.filename),
        stringParam(fileInfo.format),
        { name: 'original_size', value: { longValue: fileInfo.size } },
        stringParam(providerId),
        stringParam(modelId),
        { name: 'needs_conversion', value: { booleanValue: decision.needsConversion } },
        stringParam(decision.strategy),
        stringParam(decision.reason),
      ]);
    } catch (error) {
      // Don't fail the conversion if logging fails
      logger.error('Failed to log conversion decision', error as Error);
    }
  }
}

// Export singleton instance
export const fileConversionService = new FileConversionService();
