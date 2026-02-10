/**
 * RADIANT Universal Cartridge Storage Manager
 *
 * All cartridge S3 operations go through this service — no direct S3 reads/writes.
 * Extends the s3ContentOffloadService pattern for binary content (ONNX, msgpack,
 * safetensors, parquet) and provides cartridge-specific key management, pre-signed
 * URL generation, and content registry tracking.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { executeStatement, stringParam, longParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'cartridge/storage-manager',
  category: 'infrastructure',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

export interface CartridgeStoreResult {
  storage_ref: string;
  storage_bucket: string;
  size_bytes: number;
  checksum_sha256: string;
  version_id?: string;
}

export interface CartridgeRetrieveResult {
  data: Buffer;
  size_bytes: number;
  content_type: string;
  checksum_sha256?: string;
  metadata: Record<string, string>;
}

export interface CartridgePresignedUrl {
  url: string;
  storage_ref: string;
  storage_bucket: string;
  expires_at: string;
}

type CartridgeContentCategory =
  | 'radz_archive'
  | 'firmware'
  | 'qnodes'
  | 'knowledge'
  | 'personality'
  | 'cato_learned'
  | 'cortex'
  | 'lora'
  | 'soft_rom'
  | 'esa'
  | 'curator'
  | 'ghost'
  | 'tenant_config'
  | 'tests'
  | 'export'
  | 'global_brain';

// ============================================================================
// Service
// ============================================================================

class CartridgeStorageManagerService {
  private s3Client: S3Client;
  private bucket: string;
  private readonly PRESIGNED_URL_EXPIRY = 3600;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.bucket = process.env.CARTRIDGE_BUCKET || 'radiant-cartridges';
  }

  // ==========================================================================
  // RADz Archive Operations
  // ==========================================================================

  /**
   * Generate a pre-signed upload URL for a new .RADz file.
   * The client uploads directly to S3 via the pre-signed URL,
   * then calls back to confirm.
   */
  async generateUploadUrl(
    tenantId: string | null,
    cartridgeName: string,
    version: string,
  ): Promise<CartridgePresignedUrl> {
    const scope = tenantId || 'platform';
    const storageRef = `cartridges/${scope}/${cartridgeName}/${version}/${cartridgeName}-${version}.RADz`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageRef,
      ContentType: 'application/octet-stream',
      Metadata: {
        'cartridge-name': cartridgeName,
        'cartridge-version': version,
        'tenant-id': tenantId || 'platform',
      },
    });

    const url = await getSignedUrl(this.s3Client, command, {
      expiresIn: this.PRESIGNED_URL_EXPIRY,
    });

    const expiresAt = new Date(Date.now() + this.PRESIGNED_URL_EXPIRY * 1000).toISOString();

    logger.info('Generated cartridge upload URL', {
      storageRef,
      tenantId: scope,
      cartridgeName,
      version,
    });

    return { url, storage_ref: storageRef, storage_bucket: this.bucket, expires_at: expiresAt };
  }

  /**
   * Generate a pre-signed download URL for an existing .RADz file.
   */
  async generateDownloadUrl(storageRef: string): Promise<CartridgePresignedUrl> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageRef,
    });

    const url = await getSignedUrl(this.s3Client, command, {
      expiresIn: this.PRESIGNED_URL_EXPIRY,
    });

    const expiresAt = new Date(Date.now() + this.PRESIGNED_URL_EXPIRY * 1000).toISOString();

    return { url, storage_ref: storageRef, storage_bucket: this.bucket, expires_at: expiresAt };
  }

  // ==========================================================================
  // Binary Content Storage (routed through storage manager)
  // ==========================================================================

  /**
   * Store binary content for a cartridge section.
   * All cartridge file writes go through this method.
   */
  async storeContent(
    tenantId: string,
    cartridgeId: string,
    category: CartridgeContentCategory,
    filename: string,
    data: Buffer,
    contentType: string = 'application/octet-stream',
  ): Promise<CartridgeStoreResult> {
    const storageRef = this.buildStorageRef(tenantId, cartridgeId, category, filename);
    const checksum = createHash('sha256').update(data).digest('hex');

    try {
      const result = await this.s3Client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageRef,
        Body: data,
        ContentType: contentType,
        Metadata: {
          'tenant-id': tenantId,
          'cartridge-id': cartridgeId,
          'category': category,
          'content-hash': checksum,
          'original-size': data.length.toString(),
        },
      }));

      // Register in content registry for tracking
      await this.registerContent(tenantId, storageRef, category, cartridgeId, checksum, data.length);

      logger.info('Stored cartridge content', {
        storageRef,
        tenantId,
        cartridgeId,
        category,
        filename,
        sizeBytes: data.length,
      });

      return {
        storage_ref: storageRef,
        storage_bucket: this.bucket,
        size_bytes: data.length,
        checksum_sha256: checksum,
        version_id: result.VersionId,
      };
    } catch (error) {
      logger.error('Failed to store cartridge content', {
        storageRef,
        tenantId,
        cartridgeId,
        category,
        error,
      });
      throw error;
    }
  }

  /**
   * Retrieve binary content for a cartridge section.
   * All cartridge file reads go through this method.
   */
  async retrieveContent(storageRef: string): Promise<CartridgeRetrieveResult | null> {
    try {
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageRef,
      }));

      if (!response.Body) return null;

      const data = Buffer.from(await response.Body.transformToByteArray());

      // Update last accessed in registry
      await this.updateLastAccessed(storageRef);

      return {
        data,
        size_bytes: data.length,
        content_type: response.ContentType || 'application/octet-stream',
        checksum_sha256: response.Metadata?.['content-hash'],
        metadata: response.Metadata || {},
      };
    } catch (error: any) {
      if (error?.name === 'NoSuchKey') {
        return null;
      }
      logger.error('Failed to retrieve cartridge content', { storageRef, error });
      throw error;
    }
  }

  /**
   * Retrieve raw .RADz archive buffer from storage.
   */
  async retrieveArchive(storageRef: string): Promise<Buffer | null> {
    const result = await this.retrieveContent(storageRef);
    return result?.data ?? null;
  }

  /**
   * Delete content for a cartridge (all files under its prefix).
   */
  async deleteCartridgeContent(tenantId: string, cartridgeId: string): Promise<number> {
    let deleted = 0;

    try {
      // Find all content registered for this cartridge
      const result = await executeStatement(
        `SELECT s3_key FROM s3_content_registry WHERE tenant_id = $1 AND source_id = $2 AND source_table = 'cartridge_content'`,
        [stringParam('tenantId', tenantId), stringParam('cartridgeId', cartridgeId)]
      );

      for (const row of (result.rows || []) as Array<{ s3_key: string }>) {
        try {
          await this.s3Client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: row.s3_key,
          }));
          deleted++;
        } catch (error) {
          logger.warn('Failed to delete cartridge content object', { s3Key: row.s3_key, error });
        }
      }

      // Clean up registry entries
      await executeStatement(
        `DELETE FROM s3_content_registry WHERE tenant_id = $1 AND source_id = $2 AND source_table = 'cartridge_content'`,
        [stringParam('tenantId', tenantId), stringParam('cartridgeId', cartridgeId)]
      );

      logger.info('Deleted cartridge content', { tenantId, cartridgeId, deleted });
      return deleted;
    } catch (error) {
      logger.error('Failed to delete cartridge content', { tenantId, cartridgeId, error });
      throw error;
    }
  }

  /**
   * Check if a storage ref exists.
   */
  async exists(storageRef: string): Promise<boolean> {
    try {
      await this.s3Client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storageRef,
      }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get object metadata without downloading content.
   */
  async getMetadata(storageRef: string): Promise<{ size_bytes: number; content_type: string; metadata: Record<string, string> } | null> {
    try {
      const response = await this.s3Client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storageRef,
      }));
      return {
        size_bytes: response.ContentLength || 0,
        content_type: response.ContentType || 'application/octet-stream',
        metadata: response.Metadata || {},
      };
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // Target-Specific Storage Helpers
  // ==========================================================================

  /**
   * Store an extracted cartridge section file for a specific target.
   * Used by the cartridge loader worker after decompressing the .RADz archive.
   */
  async storeSectionFile(
    tenantId: string,
    cartridgeId: string,
    targetService: string,
    sectionKey: string,
    filename: string,
    data: Buffer,
  ): Promise<CartridgeStoreResult> {
    const category = sectionKey as CartridgeContentCategory;
    const qualifiedFilename = `${targetService}/${sectionKey}/${filename}`;
    return this.storeContent(tenantId, cartridgeId, category, qualifiedFilename, data);
  }

  /**
   * Build the storage key path for omega brain state.
   */
  buildOmegaStatePath(tenantId: string, section: string, filename: string): string {
    return `omega-brains/${tenantId}/cartridge-weights/${section}/${filename}`;
  }

  /**
   * Build the storage key path for cortex model files.
   */
  buildCortexModelPath(tenantId: string, subdir: string, filename: string): string {
    return `cortex/tenants/${tenantId}/${subdir}/${filename}`;
  }

  /**
   * Build the storage key path for Global Brain data.
   */
  buildGlobalBrainPath(subdir: string, filename: string): string {
    return `global-brain/${subdir}/${filename}`;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private buildStorageRef(
    tenantId: string,
    cartridgeId: string,
    category: CartridgeContentCategory,
    filename: string,
  ): string {
    return `cartridges/${tenantId}/${cartridgeId}/${category}/${filename}`;
  }

  private async registerContent(
    tenantId: string,
    storageRef: string,
    category: string,
    cartridgeId: string,
    checksum: string,
    sizeBytes: number,
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO s3_content_registry (
          tenant_id, s3_bucket, s3_key, content_type, source_table,
          source_id, content_hash, size_bytes, compression
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (s3_key) DO UPDATE SET
          size_bytes = $8, content_hash = $7, last_accessed_at = NOW()`,
        [
          stringParam('tenantId', tenantId),
          stringParam('bucket', this.bucket),
          stringParam('key', storageRef),
          stringParam('contentType', 'application/octet-stream'),
          stringParam('sourceTable', 'cartridge_content'),
          stringParam('sourceId', cartridgeId),
          stringParam('hash', checksum),
          longParam('size', sizeBytes),
          stringParam('compression', 'none'),
        ]
      );
    } catch (error) {
      // Non-fatal: content is stored even if registry update fails
      logger.warn('Failed to register cartridge content in registry', { storageRef, error });
    }
  }

  private async updateLastAccessed(storageRef: string): Promise<void> {
    try {
      await executeStatement(
        `UPDATE s3_content_registry SET last_accessed_at = NOW() WHERE s3_key = $1`,
        [stringParam('key', storageRef)]
      );
    } catch {
      // Non-fatal
    }
  }
}

// Export singleton
export const cartridgeStorageManager = new CartridgeStorageManagerService();
