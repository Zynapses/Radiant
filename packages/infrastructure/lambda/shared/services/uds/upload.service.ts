/**
 * UDS Upload Service
 * Handles file uploads with virus scanning, text extraction, and tiered storage
 * 
 * Supports:
 * - Presigned URL uploads (direct to S3)
 * - Chunked uploads for large files
 * - Virus scanning (ClamAV Lambda)
 * - Text extraction (Textract, Tika)
 * - OCR for images/PDFs
 * - Vector embeddings for semantic search
 * - Thumbnail generation
 */

import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { executeStatement, stringParam, boolParam } from '../../db/client';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import { udsEncryptionService } from './encryption.service';
import { udsAuditService } from './audit.service';
import type {
  UDSUpload,
  UDSUploadCreate,
  UDSUploadComplete,
  UDSUploadListOptions,
  UDSUploadChunk,
  UDSPresignedUpload,
  UDSPresignedDownload,
  UDSUploadStatus,
  UDSUploadSource,
  UDSContentType,
  UDSTier,
  IUDSUploadService,
} from '@radiant/shared';

// =============================================================================
// Constants
// =============================================================================

const PRESIGNED_URL_EXPIRY_SECONDS = 3600;  // 1 hour
const DOWNLOAD_URL_EXPIRY_SECONDS = 900;     // 15 minutes
const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;  // 100MB default

const CONTENT_TYPE_MAP: Record<string, UDSContentType> = {
  // Text
  'text/plain': 'text',
  'text/markdown': 'markdown',
  'text/html': 'html',
  'text/csv': 'csv',
  'text/xml': 'xml',
  'application/json': 'json',
  'application/xml': 'xml',
  
  // Code
  'text/javascript': 'code',
  'application/javascript': 'code',
  'text/typescript': 'code',
  'text/x-python': 'code',
  'text/x-java': 'code',
  
  // Documents
  'application/pdf': 'pdf',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'application/vnd.ms-powerpoint': 'presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation',
  
  // Images
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'image/bmp': 'image',
  'image/tiff': 'image',
  
  // Audio
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'audio/mp4': 'audio',
  
  // Video
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
  
  // Archives
  'application/zip': 'archive',
  'application/x-tar': 'archive',
  'application/gzip': 'archive',
  'application/x-7z-compressed': 'archive',
  
  // Binary
  'application/octet-stream': 'binary',
};

// =============================================================================
// Service Implementation
// =============================================================================

class UDSUploadService implements IUDSUploadService {
  private s3Client: S3Client;
  private uploadBucket: string;
  private quarantineBucket: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.uploadBucket = process.env.UDS_UPLOAD_BUCKET || 'radiant-uds-uploads';
    this.quarantineBucket = process.env.UDS_QUARANTINE_BUCKET || 'radiant-uds-quarantine';
  }

  // ===========================================================================
  // Upload Operations
  // ===========================================================================

  /**
   * Initiate an upload and get a presigned URL
   */
  async initiate(
    tenantId: string,
    userId: string,
    data: UDSUploadCreate
  ): Promise<UDSPresignedUpload> {
    logger.info('Initiating upload', { tenantId, userId, filename: data.originalFilename });

    // Get config for file size limits
    const config = await this.getConfig(tenantId);
    const maxSize = (Number((config as any)?.max_upload_size_mb) || 100) * 1024 * 1024;

    if (data.fileSizeBytes > maxSize) {
      throw new Error(`File size exceeds maximum allowed (${maxSize / 1024 / 1024}MB)`);
    }

    // Validate file type
    const extension = this.getFileExtension(data.originalFilename);
    const allowedTypes = ((config as any)?.allowed_file_types || []) as string[];
    if (allowedTypes.length > 0 && !allowedTypes.includes(extension)) {
      throw new Error(`File type '${extension}' is not allowed`);
    }

    // Determine content type
    const contentType = this.detectContentType(data.mimeType);

    // Sanitize filename
    const sanitizedFilename = this.sanitizeFilename(data.originalFilename);

    // Get encryption key
    const encryptionKey = await udsEncryptionService.getKeyInfo(tenantId, userId);

    // Create upload record
    const uploadId = crypto.randomUUID();
    const storageKey = `${tenantId}/${userId}/${uploadId}/${sanitizedFilename}`;

    const result = await executeStatement(
      `INSERT INTO uds_uploads (
        id, tenant_id, user_id, conversation_id,
        original_filename, sanitized_filename, file_extension, mime_type, content_type,
        file_size_bytes, storage_bucket, storage_key,
        encryption_key_id, status, upload_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14)
      RETURNING id`,
      [
        stringParam('id', uploadId),
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('conversationId', data.conversationId || ''),
        stringParam('originalFilename', data.originalFilename),
        stringParam('sanitizedFilename', sanitizedFilename),
        stringParam('extension', extension),
        stringParam('mimeType', data.mimeType),
        stringParam('contentType', contentType),
        stringParam('fileSize', String(data.fileSizeBytes)),
        stringParam('bucket', this.quarantineBucket),  // Start in quarantine
        stringParam('storageKey', storageKey),
        stringParam('encryptionKeyId', encryptionKey?.id || ''),
        stringParam('uploadSource', data.uploadSource || 'direct'),
      ]
    );

    // Generate presigned URL for upload to quarantine bucket
    const command = new PutObjectCommand({
      Bucket: this.quarantineBucket,
      Key: storageKey,
      ContentType: data.mimeType,
      ContentLength: data.fileSizeBytes,
      Metadata: {
        'x-tenant-id': tenantId,
        'x-user-id': userId,
        'x-upload-id': uploadId,
      },
    });

    const presignedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
    });

    // Audit log
    await udsAuditService.log(tenantId, userId, {
      eventType: 'upload_initiated',
      eventCategory: 'upload',
      resourceType: 'upload',
      resourceId: uploadId,
      action: 'initiate',
      actionDetails: {
        filename: data.originalFilename,
        mimeType: data.mimeType,
        fileSize: data.fileSizeBytes,
      },
    });

    return {
      uploadId,
      presignedUrl,
      expiresAt: new Date(Date.now() + PRESIGNED_URL_EXPIRY_SECONDS * 1000),
      maxSizeBytes: maxSize,
    };
  }

  /**
   * Complete an upload after file is uploaded to S3
   */
  async complete(
    tenantId: string,
    userId: string,
    uploadId: string,
    data: UDSUploadComplete
  ): Promise<UDSUpload> {
    logger.info('Completing upload', { tenantId, uploadId });

    // Verify upload exists and is pending
    const existing = await this.getInternal(tenantId, uploadId);
    if (!existing) {
      throw new Error('Upload not found');
    }
    if (existing.status !== 'pending') {
      throw new Error(`Upload is not pending (status: ${existing.status})`);
    }

    // Verify file exists in S3
    try {
      await this.s3Client.send(new HeadObjectCommand({
        Bucket: this.quarantineBucket,
        Key: existing.storageKey,
      }));
    } catch (error) {
      throw new Error('File not found in storage');
    }

    // Update status to scanning
    await executeStatement(
      `UPDATE uds_uploads 
       SET status = 'scanning', sha256_hash = $3, md5_hash = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2`,
      [
        stringParam('id', uploadId),
        stringParam('tenantId', tenantId),
        stringParam('sha256', data.sha256Hash),
        stringParam('md5', data.md5Hash || ''),
      ]
    );

    // Trigger virus scan (async)
    await this.triggerVirusScan(tenantId, uploadId, existing.storageKey);

    // Return updated upload
    return (await this.get(tenantId, userId, uploadId))!;
  }

  /**
   * Get an upload by ID
   */
  async get(
    tenantId: string,
    userId: string,
    uploadId: string
  ): Promise<UDSUpload | null> {
    const result = await executeStatement(
      `SELECT * FROM uds_uploads 
       WHERE id = $1 AND tenant_id = $2 
       AND (user_id = $3 OR $4 = true)
       AND status != 'deleted'`,
      [
        stringParam('id', uploadId),
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        boolParam('isAdmin', false),
      ]
    );

    if (!result.rows?.length) {
      return null;
    }

    // Update last accessed
    await executeStatement(
      `UPDATE uds_uploads SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [stringParam('id', uploadId)]
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Get download URL for an upload
   */
  async getDownloadUrl(
    tenantId: string,
    userId: string,
    uploadId: string
  ): Promise<UDSPresignedDownload> {
    const upload = await this.get(tenantId, userId, uploadId);
    if (!upload) {
      throw new Error('Upload not found');
    }

    if (upload.status !== 'ready' && upload.status !== 'clean') {
      throw new Error(`Upload is not ready for download (status: ${upload.status})`);
    }

    // Generate presigned download URL
    const command = new GetObjectCommand({
      Bucket: upload.storageBucket,
      Key: upload.storageKey,
      ResponseContentDisposition: `attachment; filename="${upload.originalFilename}"`,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS,
    });

    // Increment download count
    await executeStatement(
      `UPDATE uds_uploads SET download_count = download_count + 1 WHERE id = $1`,
      [stringParam('id', uploadId)]
    );

    // Audit log
    await udsAuditService.log(tenantId, userId, {
      eventType: 'upload_downloaded',
      eventCategory: 'upload',
      resourceType: 'upload',
      resourceId: uploadId,
      action: 'download',
    });

    return {
      downloadUrl,
      expiresAt: new Date(Date.now() + DOWNLOAD_URL_EXPIRY_SECONDS * 1000),
      filename: upload.originalFilename,
      contentType: upload.mimeType,
      fileSize: upload.fileSizeBytes,
    };
  }

  /**
   * Delete an upload
   */
  async delete(
    tenantId: string,
    userId: string,
    uploadId: string
  ): Promise<void> {
    const upload = await this.get(tenantId, userId, uploadId);
    if (!upload) {
      throw new Error('Upload not found');
    }

    // Delete from S3
    try {
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: upload.storageBucket,
        Key: upload.storageKey,
      }));
    } catch (error) {
      logger.warn('Failed to delete S3 object', { uploadId, error });
    }

    // Also delete thumbnail if exists
    if (upload.thumbnailKey) {
      try {
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: upload.storageBucket,
          Key: upload.thumbnailKey,
        }));
      } catch (error) {
        logger.warn('Failed to delete thumbnail', { uploadId, error });
      }
    }

    // Soft delete in database
    await executeStatement(
      `UPDATE uds_uploads 
       SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2`,
      [
        stringParam('id', uploadId),
        stringParam('tenantId', tenantId),
      ]
    );

    // Audit log
    await udsAuditService.log(tenantId, userId, {
      eventType: 'upload_deleted',
      eventCategory: 'upload',
      resourceType: 'upload',
      resourceId: uploadId,
      action: 'delete',
    });

    logger.info('Upload deleted', { tenantId, uploadId });
  }

  /**
   * List uploads with filtering
   */
  async list(
    tenantId: string,
    userId: string,
    options: UDSUploadListOptions = {}
  ): Promise<UDSUpload[]> {
    const {
      conversationId,
      contentType,
      status,
      search,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = options;

    const conditions: string[] = [
      'tenant_id = $1',
      'user_id = $2',
      "status != 'deleted'",
    ];
    const params: ReturnType<typeof stringParam>[] = [
      stringParam('tenantId', tenantId),
      stringParam('userId', userId),
    ];
    let paramIndex = 3;

    if (conversationId) {
      conditions.push(`conversation_id = $${paramIndex}`);
      params.push(stringParam('conversationId', conversationId));
      paramIndex++;
    }

    if (contentType) {
      conditions.push(`content_type = $${paramIndex}`);
      params.push(stringParam('contentType', contentType));
      paramIndex++;
    }

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(stringParam('status', status));
      paramIndex++;
    }

    if (search) {
      conditions.push(`(original_filename ILIKE $${paramIndex} OR extracted_text ILIKE $${paramIndex})`);
      params.push(stringParam('search', `%${search}%`));
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(stringParam('startDate', startDate.toISOString()));
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(stringParam('endDate', endDate.toISOString()));
      paramIndex++;
    }

    params.push(stringParam('limit', String(limit)));
    params.push(stringParam('offset', String(offset)));

    const result = await executeStatement(
      `SELECT * FROM uds_uploads 
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return (result.rows || []).map(row => this.mapRow(row));
  }

  /**
   * Search uploads by content
   */
  async search(
    tenantId: string,
    userId: string,
    query: string,
    options?: UDSUploadListOptions
  ): Promise<UDSUpload[]> {
    const result = await executeStatement(
      `SELECT * FROM uds_uploads 
       WHERE tenant_id = $1 AND user_id = $2
       AND status = 'ready'
       AND to_tsvector('english', COALESCE(extracted_text, '') || ' ' || COALESCE(ocr_text, '')) @@ plainto_tsquery('english', $3)
       ORDER BY ts_rank(to_tsvector('english', COALESCE(extracted_text, '') || ' ' || COALESCE(ocr_text, '')), plainto_tsquery('english', $3)) DESC
       LIMIT $4`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('query', query),
        stringParam('limit', String(options?.limit || 20)),
      ]
    );

    return (result.rows || []).map(row => this.mapRow(row));
  }

  // ===========================================================================
  // Processing Operations
  // ===========================================================================

  /**
   * Trigger virus scan for an upload via Lambda
   */
  private async triggerVirusScan(
    tenantId: string,
    uploadId: string,
    storageKey: string
  ): Promise<void> {
    logger.info('Triggering virus scan', { tenantId, uploadId, storageKey });

    const lambdaClient = new LambdaClient({});
    const scanFunctionName = process.env.VIRUS_SCAN_LAMBDA || 'radiant-virus-scan';

    try {
      // Invoke the virus scan Lambda asynchronously (Event invocation type)
      const command = new InvokeCommand({
        FunctionName: scanFunctionName,
        InvocationType: 'Event', // Async - Lambda will call back via SNS/EventBridge
        Payload: Buffer.from(JSON.stringify({
          tenantId,
          uploadId,
          bucket: this.quarantineBucket,
          key: storageKey,
          callbackType: 'eventbridge', // Will publish scan result to EventBridge
        })),
      });

      await lambdaClient.send(command);
      logger.info('Virus scan Lambda invoked', { tenantId, uploadId, functionName: scanFunctionName });
    } catch (error) {
      logger.error('Failed to invoke virus scan Lambda', { tenantId, uploadId, error });
      
      // If Lambda invocation fails, mark upload for manual review
      await executeStatement(
        `UPDATE uds_uploads SET status = 'failed', error_message = $1 WHERE id = $2 AND tenant_id = $3`,
        [
          stringParam('error', `Virus scan unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`),
          stringParam('id', uploadId),
          stringParam('tenantId', tenantId),
        ]
      );
    }
  }

  /**
   * Handle virus scan completion
   */
  async onVirusScanComplete(
    tenantId: string,
    uploadId: string,
    result: {
      clean: boolean;
      scanEngine: string;
      scanVersion: string;
      scannedAt: Date;
      threats?: string[];
    }
  ): Promise<void> {
    logger.info('Virus scan complete', { tenantId, uploadId, clean: result.clean });

    if (result.clean) {
      // Move from quarantine to main bucket
      const upload = await this.getInternal(tenantId, uploadId);
      if (!upload) return;

      try {
        // Copy to main bucket
        await this.s3Client.send(new CopyObjectCommand({
          Bucket: this.uploadBucket,
          Key: upload.storageKey,
          CopySource: `${this.quarantineBucket}/${upload.storageKey}`,
        }));

        // Delete from quarantine
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: this.quarantineBucket,
          Key: upload.storageKey,
        }));

        // Update status
        await executeStatement(
          `UPDATE uds_uploads 
           SET status = 'clean', 
               storage_bucket = $3,
               virus_scan_status = 'clean',
               virus_scan_result = $4,
               scanned_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND tenant_id = $2`,
          [
            stringParam('id', uploadId),
            stringParam('tenantId', tenantId),
            stringParam('bucket', this.uploadBucket),
            stringParam('scanResult', JSON.stringify(result)),
          ]
        );

        // Trigger text extraction
        await this.triggerTextExtraction(tenantId, uploadId);

      } catch (error) {
        logger.error('Failed to move file from quarantine', { uploadId, error });
        await executeStatement(
          `UPDATE uds_uploads SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [stringParam('id', uploadId)]
        );
      }
    } else {
      // Mark as infected
      await executeStatement(
        `UPDATE uds_uploads 
         SET status = 'infected',
             virus_scan_status = 'infected',
             virus_scan_result = $3,
             scanned_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND tenant_id = $2`,
        [
          stringParam('id', uploadId),
          stringParam('tenantId', tenantId),
          stringParam('scanResult', JSON.stringify(result)),
        ]
      );

      // Delete infected file from quarantine
      const upload = await this.getInternal(tenantId, uploadId);
      if (upload) {
        await this.s3Client.send(new DeleteObjectCommand({
          Bucket: this.quarantineBucket,
          Key: upload.storageKey,
        }));
      }
    }
  }

  /**
   * Trigger text extraction for supported file types
   */
  private async triggerTextExtraction(
    tenantId: string,
    uploadId: string
  ): Promise<void> {
    const upload = await this.getInternal(tenantId, uploadId);
    if (!upload) return;

    // Check if text extraction is applicable
    const extractableTypes: UDSContentType[] = ['text', 'markdown', 'code', 'pdf', 'document', 'spreadsheet'];
    if (!extractableTypes.includes(upload.contentType as UDSContentType)) {
      // Mark as ready directly
      await executeStatement(
        `UPDATE uds_uploads SET status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [stringParam('id', uploadId)]
      );
      return;
    }

    logger.info('Triggering text extraction', { tenantId, uploadId, contentType: upload.contentType });

    // Update status
    await executeStatement(
      `UPDATE uds_uploads 
       SET status = 'processing', text_extraction_status = 'processing', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [stringParam('id', uploadId)]
    );

    const extractionLambda = process.env.UDS_TEXT_EXTRACTION_LAMBDA;
    
    if (extractionLambda) {
      try {
        const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
        
        // Invoke text extraction Lambda asynchronously
        await lambdaClient.send(new InvokeCommand({
          FunctionName: extractionLambda,
          InvocationType: 'Event', // Async invocation
          Payload: JSON.stringify({
            tenantId,
            uploadId,
            s3Key: upload.s3Key,
            contentType: upload.contentType,
            originalFilename: upload.originalFilename,
            callbackType: 'uds_text_extraction',
          }),
        }));

        logger.info('Text extraction Lambda invoked', { tenantId, uploadId, lambda: extractionLambda });
      } catch (error) {
        logger.error('Failed to invoke text extraction Lambda', { tenantId, uploadId, error });
        
        // Mark as failed but don't throw - upload is still usable
        await executeStatement(
          `UPDATE uds_uploads 
           SET text_extraction_status = 'failed', status = 'ready', updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [stringParam('id', uploadId)]
        );
      }
    } else {
      // No Lambda configured - use simple extraction for text files
      if (['text', 'markdown', 'code'].includes(upload.contentType as string)) {
        try {
          const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
          const response = await s3Client.send(new GetObjectCommand({
            Bucket: process.env.UDS_UPLOADS_BUCKET || 'radiant-uds-uploads',
            Key: upload.s3Key,
          }));
          
          const text = await response.Body?.transformToString() || '';
          await this.onTextExtractionComplete(tenantId, uploadId, { success: true, text: text.substring(0, 100000) });
        } catch (error) {
          logger.warn('Simple text extraction failed', { tenantId, uploadId, error });
          await this.onTextExtractionComplete(tenantId, uploadId, { success: false, error: 'Extraction failed' });
        }
      } else {
        // For PDFs/documents without Lambda, mark as ready without extraction
        logger.warn('Text extraction Lambda not configured, skipping extraction', { tenantId, uploadId });
        await executeStatement(
          `UPDATE uds_uploads SET status = 'ready', text_extraction_status = 'skipped', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [stringParam('id', uploadId)]
        );
      }
    }
  }

  /**
   * Handle text extraction completion
   */
  async onTextExtractionComplete(
    tenantId: string,
    uploadId: string,
    result: {
      success: boolean;
      text?: string;
      error?: string;
    }
  ): Promise<void> {
    if (result.success && result.text) {
      // Encrypt extracted text
      const encrypted = await udsEncryptionService.encrypt(tenantId, result.text);

      await executeStatement(
        `UPDATE uds_uploads 
         SET status = 'ready',
             extracted_text = $3,
             extracted_text_encrypted = $4,
             text_extraction_status = 'completed',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND tenant_id = $2`,
        [
          stringParam('id', uploadId),
          stringParam('tenantId', tenantId),
          stringParam('text', result.text),  // Store plain for search
          stringParam('encryptedText', encrypted.encrypted.toString('base64')),
        ]
      );

      // Trigger embedding generation for semantic search
      await this.triggerEmbedding(tenantId, uploadId, result.text);

    } else {
      await executeStatement(
        `UPDATE uds_uploads 
         SET status = 'ready',
             text_extraction_status = 'failed',
             text_extraction_error = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND tenant_id = $2`,
        [
          stringParam('id', uploadId),
          stringParam('tenantId', tenantId),
          stringParam('error', result.error || 'Unknown error'),
        ]
      );
    }
  }

  /**
   * Trigger embedding generation for semantic search
   */
  private async triggerEmbedding(
    tenantId: string,
    uploadId: string,
    text: string
  ): Promise<void> {
    logger.info('Triggering embedding generation', { tenantId, uploadId, textLength: text.length });

    try {
      // Truncate text if too long (most embedding models have token limits)
      const maxChars = 8000; // ~2000 tokens for most models
      const truncatedText = text.length > maxChars ? text.substring(0, maxChars) : text;
      
      // Get the embedding model configuration for this tenant
      const embeddingConfig = await this.getEmbeddingConfig(tenantId);
      const modelId = embeddingConfig?.model || 'text-embedding-3-small';
      
      // Generate embedding via the AI service
      const embedding = await this.generateEmbedding(truncatedText, modelId);
      
      if (embedding && embedding.length > 0) {
        // Store the embedding vector in the database
        await executeStatement(
          `UPDATE uds_uploads 
           SET embedding = $3::vector,
               embedding_model = $4,
               embedded_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND tenant_id = $2`,
          [
            stringParam('id', uploadId),
            stringParam('tenantId', tenantId),
            stringParam('embedding', `[${embedding.join(',')}]`),
            stringParam('model', modelId),
          ]
        );
        
        logger.info('Embedding stored successfully', { 
          tenantId, 
          uploadId, 
          dimensions: embedding.length,
          model: modelId 
        });
      }
    } catch (error) {
      // Log error but don't fail the upload - embedding is optional enhancement
      logger.error('Failed to generate embedding', { 
        tenantId, 
        uploadId, 
        error: (error as Error).message 
      });
    }
  }

  /**
   * Get embedding configuration for tenant
   */
  private async getEmbeddingConfig(tenantId: string): Promise<{ model: string; dimensions: number } | null> {
    const result = await executeStatement(
      `SELECT embedding_model, embedding_dimensions FROM uds_config WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );
    
    if (result.rows?.length) {
      const row = result.rows[0] as Record<string, unknown>;
      return {
        model: (row.embedding_model as string) || 'text-embedding-3-small',
        dimensions: (row.embedding_dimensions as number) || 1536,
      };
    }
    
    return null;
  }

  /**
   * Generate embedding vector using AI model
   */
  private async generateEmbedding(text: string, modelId: string): Promise<number[] | null> {
    // Use environment variable for embedding endpoint
    const embeddingEndpoint = process.env.EMBEDDING_API_ENDPOINT || process.env.LITELLM_ENDPOINT;
    
    if (!embeddingEndpoint) {
      logger.warn('No embedding endpoint configured, skipping embedding generation');
      return null;
    }

    try {
      const response = await fetch(`${embeddingEndpoint}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LITELLM_API_KEY || ''}`,
        },
        body: JSON.stringify({
          model: modelId,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as { 
        data: Array<{ embedding: number[] }> 
      };
      
      if (data.data?.[0]?.embedding) {
        return data.data[0].embedding;
      }
      
      return null;
    } catch (error) {
      logger.error('Embedding API call failed', { 
        error: (error as Error).message,
        endpoint: embeddingEndpoint,
        model: modelId,
      });
      return null;
    }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  /**
   * Get upload without user check (internal use)
   */
  private async getInternal(tenantId: string, uploadId: string): Promise<UDSUpload | null> {
    const result = await executeStatement(
      `SELECT * FROM uds_uploads WHERE id = $1 AND tenant_id = $2`,
      [
        stringParam('id', uploadId),
        stringParam('tenantId', tenantId),
      ]
    );

    if (!result.rows?.length) {
      return null;
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Get tenant upload config
   */
  private async getConfig(tenantId: string): Promise<Record<string, unknown> | null> {
    const result = await executeStatement(
      `SELECT * FROM uds_config WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );
    return result.rows?.[0] || null;
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * Sanitize filename for storage
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/__+/g, '_')
      .substring(0, 255);
  }

  /**
   * Detect content type from MIME type
   */
  private detectContentType(mimeType: string): UDSContentType {
    return CONTENT_TYPE_MAP[mimeType.toLowerCase()] || 'unknown';
  }

  /**
   * Map database row to UDSUpload
   */
  private mapRow(row: Record<string, unknown>): UDSUpload {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      conversationId: row.conversation_id as string | undefined,
      originalFilename: row.original_filename as string,
      sanitizedFilename: row.sanitized_filename as string,
      fileExtension: row.file_extension as string | undefined,
      mimeType: row.mime_type as string,
      contentType: row.content_type as UDSContentType,
      fileSizeBytes: parseInt(row.file_size_bytes as string),
      storageBucket: row.storage_bucket as string,
      storageKey: row.storage_key as string,
      storageClass: row.storage_class as string,
      encryptionKeyId: row.encryption_key_id as string | undefined,
      encrypted: row.encrypted as boolean,
      sha256Hash: row.sha256_hash as string,
      md5Hash: row.md5_hash as string | undefined,
      contentFingerprint: row.content_fingerprint as string | undefined,
      status: row.status as UDSUploadStatus,
      uploadSource: row.upload_source as UDSUploadSource,
      virusScanStatus: row.virus_scan_status as string,
      virusScanResult: row.virus_scan_result as Record<string, unknown> | undefined,
      scannedAt: row.scanned_at ? new Date(row.scanned_at as string) : undefined,
      extractedText: row.extracted_text as string | undefined,
      textExtractionStatus: row.text_extraction_status as string | undefined,
      textExtractionError: row.text_extraction_error as string | undefined,
      hasEmbedding: !!row.embedding,
      embeddingModel: row.embedding_model as string | undefined,
      embeddedAt: row.embedded_at ? new Date(row.embedded_at as string) : undefined,
      thumbnailKey: row.thumbnail_key as string | undefined,
      thumbnailGenerated: row.thumbnail_generated as boolean,
      previewKey: row.preview_key as string | undefined,
      extractedMetadata: (row.extracted_metadata as Record<string, unknown>) || {},
      ocrText: row.ocr_text as string | undefined,
      ocrStatus: row.ocr_status as string | undefined,
      ocrConfidence: row.ocr_confidence ? parseFloat(row.ocr_confidence as string) : undefined,
      downloadCount: row.download_count as number,
      lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at as string) : undefined,
      currentTier: row.current_tier as UDSTier,
      promotedAt: row.promoted_at ? new Date(row.promoted_at as string) : undefined,
      archivedAt: row.archived_at ? new Date(row.archived_at as string) : undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
      deletedAt: row.deleted_at ? new Date(row.deleted_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const udsUploadService = new UDSUploadService();
