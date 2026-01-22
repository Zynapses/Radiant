/**
 * RADIANT v5.38.0 - Sovereign Mesh Artifact Archival Service
 * 
 * Handles archival of completed execution artifacts to S3 for cost optimization.
 * Supports hybrid storage (DB for small, S3 for large artifacts).
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import { executeStatement, stringParam, longParam } from '../../db/client';
import { enhancedLogger } from '../../logging/enhanced-logger';

const logger = enhancedLogger;

// ============================================================================
// TYPES
// ============================================================================

export type CompressionAlgorithm = 'gzip' | 'lz4' | 'zstd';
export type StorageBackend = 'database' | 's3' | 'hybrid';

export interface ArchivalConfig {
  storageBackend: StorageBackend;
  s3Bucket?: string;
  s3Prefix: string;
  archiveAfterDays: number;
  deleteAfterDays: number;
  maxDbArtifactBytes: number;
  compressionEnabled: boolean;
  compressionAlgorithm: CompressionAlgorithm;
}

export interface ArtifactMetadata {
  id: string;
  executionId: string;
  snapshotId?: string;
  artifactType: string;
  originalSizeBytes: number;
  compressedSizeBytes?: number;
  storageBackend: StorageBackend;
  s3Bucket?: string;
  s3Key?: string;
  checksumSha256: string;
  archivedAt: Date;
  expiresAt?: Date;
}

export interface ArchiveResult {
  success: boolean;
  artifactId?: string;
  storageBackend: StorageBackend;
  originalSize: number;
  compressedSize?: number;
  s3Key?: string;
  error?: string;
}

// ============================================================================
// ARTIFACT ARCHIVAL SERVICE
// ============================================================================

class ArtifactArchivalService {
  private s3Client: S3Client;
  private defaultConfig: ArchivalConfig = {
    storageBackend: 'hybrid',
    s3Prefix: 'sovereign-mesh/artifacts/',
    archiveAfterDays: 7,
    deleteAfterDays: 90,
    maxDbArtifactBytes: 65536, // 64KB
    compressionEnabled: true,
    compressionAlgorithm: 'gzip',
  };

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  /**
   * Archive an artifact from a completed execution
   */
  async archiveArtifact(
    tenantId: string,
    executionId: string,
    artifactType: string,
    data: Buffer | string,
    snapshotId?: string,
    config?: Partial<ArchivalConfig>
  ): Promise<ArchiveResult> {
    const cfg = { ...this.defaultConfig, ...config };
    const dataBuffer = typeof data === 'string' ? Buffer.from(data) : data;
    const originalSize = dataBuffer.length;

    try {
      // Calculate checksum
      const checksum = createHash('sha256').update(dataBuffer).digest('hex');

      // Compress if enabled and beneficial
      let compressedData: Buffer | null = null;
      let compressedSize: number | undefined;

      if (cfg.compressionEnabled && originalSize > 1024) {
        compressedData = this.compress(dataBuffer, cfg.compressionAlgorithm);
        compressedSize = compressedData.length;

        // Only use compression if it reduces size
        if (compressedSize >= originalSize * 0.9) {
          compressedData = null;
          compressedSize = undefined;
        }
      }

      const finalData = compressedData || dataBuffer;
      const finalSize = compressedSize || originalSize;

      // Determine storage backend
      let storageBackend: StorageBackend = cfg.storageBackend;
      if (storageBackend === 'hybrid') {
        storageBackend = finalSize <= cfg.maxDbArtifactBytes ? 'database' : 's3';
      }

      let s3Key: string | undefined;
      let s3Bucket: string | undefined;

      if (storageBackend === 's3') {
        // Upload to S3
        s3Bucket = cfg.s3Bucket || process.env.ARTIFACT_BUCKET;
        if (!s3Bucket) {
          throw new Error('S3 bucket not configured');
        }

        s3Key = `${cfg.s3Prefix}${tenantId}/${executionId}/${artifactType}-${Date.now()}.${compressedData ? 'gz' : 'bin'}`;

        await this.s3Client.send(new PutObjectCommand({
          Bucket: s3Bucket,
          Key: s3Key,
          Body: finalData,
          ContentType: 'application/octet-stream',
          Metadata: {
            'tenant-id': tenantId,
            'execution-id': executionId,
            'artifact-type': artifactType,
            'original-size': originalSize.toString(),
            'checksum': checksum,
            'compressed': compressedData ? 'true' : 'false',
            'compression-algorithm': compressedData ? cfg.compressionAlgorithm : 'none',
          },
        }));

        logger.info('Artifact uploaded to S3', { tenantId, executionId, s3Key, originalSize, compressedSize });
      }

      // Calculate expiry
      const expiresAt = cfg.deleteAfterDays > 0
        ? new Date(Date.now() + cfg.deleteAfterDays * 24 * 60 * 60 * 1000)
        : null;

      // Store metadata in database
      const result = await executeStatement(
        `INSERT INTO sovereign_mesh_artifact_archives (
           tenant_id, execution_id, original_snapshot_id, storage_backend,
           s3_bucket, s3_key, artifact_type, original_size_bytes,
           compressed_size_bytes, compression_algorithm, checksum_sha256,
           expires_at, artifact_data
         ) VALUES (
           :tenantId, :executionId, :snapshotId, :storageBackend::artifact_storage_backend,
           :s3Bucket, :s3Key, :artifactType, :originalSize,
           :compressedSize, :compressionAlgo, :checksum,
           :expiresAt, :artifactData
         ) RETURNING id`,
        [
          stringParam('tenantId', tenantId),
          stringParam('executionId', executionId),
          stringParam('snapshotId', snapshotId || ''),
          stringParam('storageBackend', storageBackend),
          stringParam('s3Bucket', s3Bucket || ''),
          stringParam('s3Key', s3Key || ''),
          stringParam('artifactType', artifactType),
          longParam('originalSize', originalSize),
          longParam('compressedSize', compressedSize || 0),
          stringParam('compressionAlgo', compressedData ? cfg.compressionAlgorithm : ''),
          stringParam('checksum', checksum),
          stringParam('expiresAt', expiresAt?.toISOString() || ''),
          stringParam('artifactData', storageBackend === 'database' ? finalData.toString('base64') : ''),
        ]
      );

      const artifactId = result.rows?.[0]?.id as string;

      return {
        success: true,
        artifactId,
        storageBackend,
        originalSize,
        compressedSize,
        s3Key,
      };
    } catch (error: any) {
      logger.error('Failed to archive artifact', { tenantId, executionId, error: error.message });
      return {
        success: false,
        storageBackend: cfg.storageBackend,
        originalSize,
        error: error.message,
      };
    }
  }

  /**
   * Retrieve an archived artifact
   */
  async retrieveArtifact(artifactId: string, tenantId: string): Promise<Buffer | null> {
    try {
      const result = await executeStatement(
        `SELECT * FROM sovereign_mesh_artifact_archives WHERE id = :artifactId AND tenant_id = :tenantId`,
        [stringParam('artifactId', artifactId), stringParam('tenantId', tenantId)]
      );

      const row = result.rows?.[0];
      if (!row) {
        return null;
      }

      const storageBackend = row.storage_backend as StorageBackend;
      const compressionAlgorithm = row.compression_algorithm as string;

      let data: Buffer;

      if (storageBackend === 'database') {
        // Retrieve from database
        const base64Data = row.artifact_data as string;
        data = Buffer.from(base64Data, 'base64');
      } else {
        // Retrieve from S3
        const s3Bucket = row.s3_bucket as string;
        const s3Key = row.s3_key as string;

        const response = await this.s3Client.send(new GetObjectCommand({
          Bucket: s3Bucket,
          Key: s3Key,
        }));

        const bodyContents = await response.Body?.transformToByteArray();
        if (!bodyContents) {
          throw new Error('Empty S3 response');
        }
        data = Buffer.from(bodyContents);
      }

      // Decompress if necessary
      if (compressionAlgorithm && compressionAlgorithm !== 'none') {
        data = this.decompress(data, compressionAlgorithm as CompressionAlgorithm);
      }

      // Verify checksum
      const checksum = createHash('sha256').update(data).digest('hex');
      if (checksum !== row.checksum_sha256) {
        throw new Error('Checksum mismatch');
      }

      return data;
    } catch (error: any) {
      logger.error('Failed to retrieve artifact', { artifactId, error: error.message });
      return null;
    }
  }

  /**
   * Archive all artifacts from a completed execution
   */
  async archiveExecutionArtifacts(
    tenantId: string,
    executionId: string,
    config?: Partial<ArchivalConfig>
  ): Promise<{ archived: number; failed: number; totalBytes: number }> {
    let archived = 0;
    let failed = 0;
    let totalBytes = 0;

    try {
      // Get all snapshots for this execution
      const snapshots = await executeStatement(
        `SELECT id, step_number, step_type, input_state, output_state, metadata
         FROM execution_snapshots
         WHERE execution_id = :executionId AND tenant_id = :tenantId
         ORDER BY step_number`,
        [stringParam('executionId', executionId), stringParam('tenantId', tenantId)]
      );

      for (const snapshot of snapshots.rows || []) {
        // Archive input state
        const inputState = snapshot.input_state as string;
        if (inputState && inputState !== '{}') {
          const inputData = JSON.stringify(inputState);
          const result = await this.archiveArtifact(
            tenantId,
            executionId,
            `snapshot-${snapshot.step_number}-input`,
            inputData,
            snapshot.id as string,
            config
          );
          if (result.success) {
            archived++;
            totalBytes += result.originalSize;
          } else {
            failed++;
          }
        }

        // Archive output state
        const outputState = snapshot.output_state as string;
        if (outputState && outputState !== '{}') {
          const outputData = JSON.stringify(outputState);
          const result = await this.archiveArtifact(
            tenantId,
            executionId,
            `snapshot-${snapshot.step_number}-output`,
            outputData,
            snapshot.id as string,
            config
          );
          if (result.success) {
            archived++;
            totalBytes += result.originalSize;
          } else {
            failed++;
          }
        }
      }

      // Delete original snapshots if archival successful and configured
      if (archived > 0 && failed === 0) {
        await executeStatement(
          `UPDATE execution_snapshots 
           SET input_state = '{}'::jsonb, output_state = '{}'::jsonb, archived = true
           WHERE execution_id = :executionId AND tenant_id = :tenantId`,
          [stringParam('executionId', executionId), stringParam('tenantId', tenantId)]
        );
      }

      logger.info('Execution artifacts archived', { executionId, archived, failed, totalBytes });
      return { archived, failed, totalBytes };
    } catch (error: any) {
      logger.error('Failed to archive execution artifacts', { executionId, error: error.message });
      return { archived, failed, totalBytes };
    }
  }

  /**
   * Clean up expired artifacts
   */
  async cleanupExpiredArtifacts(tenantId?: string): Promise<{ deleted: number; freedBytes: number }> {
    let deleted = 0;
    let freedBytes = 0;

    try {
      // Get expired artifacts
      const query = tenantId
        ? `SELECT * FROM sovereign_mesh_artifact_archives 
           WHERE expires_at <= NOW() AND deleted_at IS NULL AND tenant_id = :tenantId`
        : `SELECT * FROM sovereign_mesh_artifact_archives 
           WHERE expires_at <= NOW() AND deleted_at IS NULL`;
      
      const params = tenantId ? [stringParam('tenantId', tenantId)] : [];
      const expired = await executeStatement(query, params);

      for (const artifact of expired.rows || []) {
        try {
          // Delete from S3 if applicable
          if (artifact.storage_backend === 's3' && artifact.s3_bucket && artifact.s3_key) {
            await this.s3Client.send(new DeleteObjectCommand({
              Bucket: artifact.s3_bucket as string,
              Key: artifact.s3_key as string,
            }));
          }

          // Mark as deleted in database
          await executeStatement(
            `UPDATE sovereign_mesh_artifact_archives SET deleted_at = NOW() WHERE id = :id`,
            [stringParam('id', artifact.id as string)]
          );

          deleted++;
          freedBytes += (artifact.original_size_bytes as number) || 0;
        } catch (error: any) {
          logger.error('Failed to delete artifact', { id: artifact.id, error: error.message });
        }
      }

      logger.info('Expired artifacts cleaned up', { deleted, freedBytes });
      return { deleted, freedBytes };
    } catch (error: any) {
      logger.error('Failed to cleanup expired artifacts', { error: error.message });
      return { deleted, freedBytes };
    }
  }

  /**
   * Get archival statistics for a tenant
   */
  async getArchivalStats(tenantId: string): Promise<{
    totalArtifacts: number;
    totalSizeBytes: number;
    s3Artifacts: number;
    dbArtifacts: number;
    compressionSavings: number;
  }> {
    try {
      const result = await executeStatement(
        `SELECT 
           COUNT(*) as total,
           COALESCE(SUM(original_size_bytes), 0) as total_size,
           COUNT(*) FILTER (WHERE storage_backend = 's3') as s3_count,
           COUNT(*) FILTER (WHERE storage_backend = 'database') as db_count,
           COALESCE(SUM(original_size_bytes - COALESCE(compressed_size_bytes, original_size_bytes)), 0) as savings
         FROM sovereign_mesh_artifact_archives
         WHERE tenant_id = :tenantId AND deleted_at IS NULL`,
        [stringParam('tenantId', tenantId)]
      );

      const row = result.rows?.[0] || {};
      return {
        totalArtifacts: parseInt(row.total as string, 10) || 0,
        totalSizeBytes: parseInt(row.total_size as string, 10) || 0,
        s3Artifacts: parseInt(row.s3_count as string, 10) || 0,
        dbArtifacts: parseInt(row.db_count as string, 10) || 0,
        compressionSavings: parseInt(row.savings as string, 10) || 0,
      };
    } catch (error: any) {
      logger.error('Failed to get archival stats', { tenantId, error: error.message });
      return {
        totalArtifacts: 0,
        totalSizeBytes: 0,
        s3Artifacts: 0,
        dbArtifacts: 0,
        compressionSavings: 0,
      };
    }
  }

  // ============================================================================
  // COMPRESSION HELPERS
  // ============================================================================

  private compress(data: Buffer, algorithm: CompressionAlgorithm): Buffer {
    switch (algorithm) {
      case 'gzip':
        return gzipSync(data, { level: 6 });
      case 'lz4':
      case 'zstd':
        // For lz4 and zstd, fall back to gzip (would need native bindings)
        return gzipSync(data, { level: 6 });
      default:
        return data;
    }
  }

  private decompress(data: Buffer, algorithm: CompressionAlgorithm): Buffer {
    switch (algorithm) {
      case 'gzip':
      case 'lz4':
      case 'zstd':
        return gunzipSync(data);
      default:
        return data;
    }
  }
}

// Export singleton instance
export const artifactArchivalService = new ArtifactArchivalService();
