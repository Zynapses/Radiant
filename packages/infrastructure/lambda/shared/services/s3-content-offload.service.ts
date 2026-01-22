/**
 * RADIANT v5.12.2 - S3 Content Offloading Service
 * 
 * Offloads large content from database to S3 with:
 * - Content-addressable storage (deduplication via SHA-256)
 * - Compression for large content
 * - Reference tracking
 * - Orphan cleanup on deletion
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import { executeStatement, stringParam, intParam } from '../utils/db';
import { logger } from '../utils/logger';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// ============================================================================
// Types
// ============================================================================

interface OffloadConfig {
  offloading_enabled: boolean;
  auto_offload_threshold_bytes: number;
  compression_enabled: boolean;
  compression_algorithm: 'gzip' | 'lz4' | 'none';
  compression_threshold_bytes: number;
  content_bucket: string;
  content_prefix: string;
  orphan_grace_period_hours: number;
}

interface OffloadResult {
  s3_key: string;
  s3_bucket: string;
  size_bytes: number;
  compressed: boolean;
  deduplicated: boolean;
}

interface ContentRecord {
  id: string;
  s3_bucket: string;
  s3_key: string;
  content_hash: string;
  size_bytes: number;
  compression: string;
}

interface OrphanRecord {
  id: string;
  s3_bucket: string;
  s3_key: string;
  s3_version_id: string | null;
  reason: string;
}

// ============================================================================
// S3 Content Offload Service
// ============================================================================

class S3ContentOffloadService {
  private s3Client: S3Client;
  private defaultBucket: string;
  private configCache: Map<string, { config: OffloadConfig; cachedAt: number }> = new Map();
  private readonly CONFIG_CACHE_TTL_MS = 60000; // 1 minute

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.defaultBucket = process.env.RADIANT_CONTENT_BUCKET || 'radiant-content';
  }

  /**
   * Get tenant offloading configuration
   */
  async getConfig(tenantId: string): Promise<OffloadConfig> {
    const cached = this.configCache.get(tenantId);
    if (cached && Date.now() - cached.cachedAt < this.CONFIG_CACHE_TTL_MS) {
      return cached.config;
    }

    try {
      const result = await executeStatement(`SELECT * FROM s3_offloading_config WHERE tenant_id = $1`, [stringParam('tenantId', tenantId)] as any[]
      );

      if (result.rows && result.rows.length > 0) {
        const row = result.rows[0] as Record<string, unknown>;
        const config: OffloadConfig = {
          offloading_enabled: row.offloading_enabled as boolean,
          auto_offload_threshold_bytes: row.auto_offload_threshold_bytes as number,
          compression_enabled: row.compression_enabled as boolean,
          compression_algorithm: row.compression_algorithm as 'gzip' | 'lz4' | 'none',
          compression_threshold_bytes: row.compression_threshold_bytes as number,
          content_bucket: (row.content_bucket as string) || this.defaultBucket,
          content_prefix: (row.content_prefix as string) || 'content/',
          orphan_grace_period_hours: row.orphan_grace_period_hours as number,
        };
        this.configCache.set(tenantId, { config, cachedAt: Date.now() });
        return config;
      }
    } catch (error) {
      logger.warn('Failed to get offload config, using defaults', { tenantId, error });
    }

    // Default config
    const defaultConfig: OffloadConfig = {
      offloading_enabled: true,
      auto_offload_threshold_bytes: 10000,
      compression_enabled: true,
      compression_algorithm: 'gzip',
      compression_threshold_bytes: 1000,
      content_bucket: this.defaultBucket,
      content_prefix: 'content/',
      orphan_grace_period_hours: 24,
    };

    return defaultConfig;
  }

  /**
   * Offload content to S3
   */
  async offloadContent(
    tenantId: string,
    sourceTable: string,
    sourceId: string,
    content: string,
    contentType: string
  ): Promise<OffloadResult | null> {
    const config = await this.getConfig(tenantId);

    if (!config.offloading_enabled) {
      return null;
    }

    const contentBytes = Buffer.from(content, 'utf-8');
    const originalSize = contentBytes.length;

    // Check if content exceeds threshold
    if (originalSize < config.auto_offload_threshold_bytes) {
      return null;
    }

    // Calculate content hash for dedup
    const contentHash = createHash('sha256').update(contentBytes).digest('hex');

    // Check for existing content (deduplication)
    const existing = await this.findExistingContent(tenantId, contentHash);
    if (existing) {
      // Increment reference count
      await this.incrementReferenceCount(existing.s3_key);
      
      logger.info('Content deduplicated', { 
        tenantId, 
        sourceTable, 
        sourceId, 
        existingKey: existing.s3_key 
      });

      return {
        s3_key: existing.s3_key,
        s3_bucket: existing.s3_bucket,
        size_bytes: existing.size_bytes,
        compressed: existing.compression !== 'none',
        deduplicated: true,
      };
    }

    // Compress if needed
    let finalContent: Buffer = contentBytes;
    let compression = 'none';

    if (config.compression_enabled && originalSize >= config.compression_threshold_bytes) {
      if (config.compression_algorithm === 'gzip') {
        finalContent = await gzipAsync(contentBytes);
        compression = 'gzip';
      }
    }

    // Generate S3 key
    const s3Key = this.generateS3Key(config.content_prefix, tenantId, sourceTable, sourceId, contentHash);

    // Upload to S3
    try {
      await this.s3Client.send(new PutObjectCommand({
        Bucket: config.content_bucket,
        Key: s3Key,
        Body: finalContent,
        ContentType: 'application/octet-stream',
        ContentEncoding: compression === 'gzip' ? 'gzip' : undefined,
        Metadata: {
          'tenant-id': tenantId,
          'source-table': sourceTable,
          'source-id': sourceId,
          'content-hash': contentHash,
          'original-size': originalSize.toString(),
          'compression': compression,
        },
      }));

      // Register in database
      await this.registerContent(
        tenantId,
        config.content_bucket,
        s3Key,
        contentType,
        sourceTable,
        sourceId,
        contentHash,
        finalContent.length,
        compression
      );

      logger.info('Content offloaded to S3', {
        tenantId,
        sourceTable,
        sourceId,
        s3Key,
        originalSize,
        compressedSize: finalContent.length,
        compression,
      });

      return {
        s3_key: s3Key,
        s3_bucket: config.content_bucket,
        size_bytes: finalContent.length,
        compressed: compression !== 'none',
        deduplicated: false,
      };
    } catch (error) {
      logger.error('Failed to offload content to S3', { tenantId, sourceTable, sourceId, error });
      throw error;
    }
  }

  /**
   * Retrieve content from S3
   */
  async retrieveContent(s3Key: string, s3Bucket?: string): Promise<string | null> {
    const bucket = s3Bucket || this.defaultBucket;

    try {
      // Get metadata first
      const registry = await this.getContentRecord(s3Key);
      
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: s3Key,
      }));

      if (!response.Body) {
        return null;
      }

      // Read body
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      let content = Buffer.concat(chunks);

      // Decompress if needed
      if (registry?.compression === 'gzip') {
        content = await gunzipAsync(content);
      }

      // Update last accessed
      await this.updateLastAccessed(s3Key);

      return content.toString('utf-8');
    } catch (error) {
      logger.error('Failed to retrieve content from S3', { s3Key, bucket, error });
      return null;
    }
  }

  /**
   * Process orphan deletion queue
   */
  async processOrphanQueue(batchSize: number = 100): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    try {
      const result = await executeStatement(`SELECT * FROM get_orphans_for_deletion($1)`, [intParam('batchSize', batchSize)] as any[]
      );

      const orphans = (result.rows || []) as any[];

      for (const orphan of orphans) {
        try {
          await this.s3Client.send(new DeleteObjectCommand({
            Bucket: orphan.s3_bucket,
            Key: orphan.s3_key,
            VersionId: orphan.s3_version_id || undefined,
          }));

          await executeStatement(
            `SELECT mark_orphan_deleted($1, $2, $3)`,
            [
              stringParam('id', orphan.id),
              stringParam('success', 'true'),
              stringParam('errorMessage', ''),
            ]
          );

          processed++;
          logger.info('Deleted orphaned S3 object', { 
            s3Key: orphan.s3_key, 
            reason: orphan.reason 
          });
        } catch (error) {
          failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          await executeStatement(
            `SELECT mark_orphan_deleted($1, $2, $3)`,
            [
              stringParam('id', orphan.id),
              stringParam('success', 'false'),
              stringParam('errorMessage', errorMessage),
            ]
          );

          logger.error('Failed to delete orphaned S3 object', { 
            s3Key: orphan.s3_key, 
            error 
          });
        }
      }

      logger.info('Orphan cleanup completed', { processed, failed });
      return { processed, failed };
    } catch (error) {
      logger.error('Failed to process orphan queue', { error });
      return { processed, failed };
    }
  }

  /**
   * Get offloading statistics
   */
  async getStats(tenantId: string): Promise<{
    total_objects: number;
    total_size_mb: number;
    by_table: Record<string, { count: number; size_mb: number }>;
    pending_deletion: number;
  }> {
    const result = await executeStatement(`SELECT * FROM v_s3_offloading_stats WHERE tenant_id = $1`, [stringParam('tenantId', tenantId)] as any[]
    );

    const stats = {
      total_objects: 0,
      total_size_mb: 0,
      by_table: {} as Record<string, { count: number; size_mb: number }>,
      pending_deletion: 0,
    };

    for (const row of (result.rows || []) as Array<{
      source_table: string;
      total_objects: string;
      total_size_mb: string;
      pending_deletion: string;
    }>) {
      const count = parseInt(row.total_objects, 10);
      const sizeMb = parseFloat(row.total_size_mb);
      const pending = parseInt(row.pending_deletion, 10);

      stats.total_objects += count;
      stats.total_size_mb += sizeMb;
      stats.pending_deletion += pending;
      stats.by_table[row.source_table] = { count, size_mb: sizeMb };
    }

    return stats;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private generateS3Key(
    prefix: string,
    tenantId: string,
    sourceTable: string,
    sourceId: string,
    contentHash: string
  ): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${prefix}${tenantId}/${sourceTable}/${year}/${month}/${day}/${contentHash.substring(0, 8)}/${sourceId}`;
  }

  private async findExistingContent(
    tenantId: string,
    contentHash: string
  ): Promise<ContentRecord | null> {
    const result = await executeStatement(
      `SELECT id, s3_bucket, s3_key, content_hash, size_bytes, compression 
       FROM s3_content_registry 
       WHERE tenant_id = $1 AND content_hash = $2 AND marked_for_deletion = false
       LIMIT 1`,
      [
        stringParam('tenantId', tenantId),
        stringParam('contentHash', contentHash),
      ]
    );

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as any;
      return row;
    }

    return null;
  }

  private async registerContent(
    tenantId: string,
    s3Bucket: string,
    s3Key: string,
    contentType: string,
    sourceTable: string,
    sourceId: string,
    contentHash: string,
    sizeBytes: number,
    compression: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO s3_content_registry (
        tenant_id, s3_bucket, s3_key, content_type, source_table, 
        source_id, content_hash, size_bytes, compression
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        stringParam('tenantId', tenantId),
        stringParam('s3Bucket', s3Bucket),
        stringParam('s3Key', s3Key),
        stringParam('contentType', contentType),
        stringParam('sourceTable', sourceTable),
        stringParam('sourceId', sourceId),
        stringParam('contentHash', contentHash),
        intParam('sizeBytes', sizeBytes),
        stringParam('compression', compression),
      ]
    );
  }

  private async incrementReferenceCount(s3Key: string): Promise<void> {
    await executeStatement(
      `UPDATE s3_content_registry 
       SET reference_count = reference_count + 1, last_accessed_at = NOW()
       WHERE s3_key = $1`,
      [stringParam('s3Key', s3Key)]
    );
  }

  private async getContentRecord(s3Key: string): Promise<ContentRecord | null> {
    const result = await executeStatement(
      `SELECT id, s3_bucket, s3_key, content_hash, size_bytes, compression 
       FROM s3_content_registry WHERE s3_key = $1`,
      [stringParam('s3Key', s3Key)]
    );

    if (result.rows && result.rows.length > 0) {
      return result.rows[0] as any;
    }
    return null;
  }

  private async updateLastAccessed(s3Key: string): Promise<void> {
    await executeStatement(`UPDATE s3_content_registry SET last_accessed_at = NOW() WHERE s3_key = $1`, [stringParam('s3Key', s3Key)] as any[]
    );
  }
}

// Export singleton
export const s3ContentOffloadService = new S3ContentOffloadService();
