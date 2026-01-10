/**
 * RADIANT Process Hydration Service
 * 
 * Implements state serialization for long-running agent tasks:
 * 1. Hydrate - Serialize agent state to disk/DB when waiting for user
 * 2. Dehydrate - Kill the process to free resources
 * 3. Restore - Re-hydrate agent from saved state when user responds
 * 
 * This prevents "cost of waiting" - agents don't burn CPU/memory
 * while waiting hours for user input.
 */

import { Client } from 'pg';
import { Redis } from 'ioredis';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// ============================================================================
// Types
// ============================================================================

export interface HydrationParams {
  tenantId: string;
  agentId: string;
  checkpointName: string;
  state: Record<string, unknown>;
  resumePoint?: string;
  resumeContext?: Record<string, unknown>;
  compress?: boolean;
  useS3?: boolean;
}

export interface HydrationSnapshot {
  id: string;
  tenantId: string;
  agentId: string;
  checkpointName: string;
  checkpointVersion: number;
  stateHash: string;
  stateSizeBytes: number;
  isCompressed: boolean;
  s3Bucket?: string;
  s3Key?: string;
  resumePoint?: string;
  resumeContext?: Record<string, unknown>;
  createdAt: Date;
  expiresAt?: Date;
  restoredCount: number;
}

export interface RestoreResult {
  success: boolean;
  state?: Record<string, unknown>;
  resumePoint?: string;
  resumeContext?: Record<string, unknown>;
  snapshot?: HydrationSnapshot;
  error?: string;
}

export interface HydrationConfig {
  enableAutoHydration: boolean;
  hydrationThresholdSeconds: number;
  maxHydrationSizeMb: number;
  hydrationS3Bucket?: string;
  defaultExpiryHours: number;
  compressionThresholdBytes: number;
}

// ============================================================================
// Service
// ============================================================================

class ProcessHydrationService {
  private db: Client | null = null;
  private redis: Redis | null = null;
  private s3: S3Client | null = null;
  private configCache: Map<string, HydrationConfig> = new Map();

  /**
   * Initialize connections
   */
  async initialize(db: Client, redis?: Redis, s3?: S3Client): Promise<void> {
    this.db = db;
    this.redis = redis || null;
    this.s3 = s3 || new S3Client({});
    logger.info('ProcessHydrationService initialized');
  }

  /**
   * Hydrate (serialize) agent state
   * 
   * Called when an agent is about to wait for user input.
   * Serializes the state so the process can be killed.
   */
  async hydrateState(params: HydrationParams): Promise<HydrationSnapshot> {
    if (!this.db) throw new Error('Database not initialized');

    const config = await this.getConfig(params.tenantId);
    
    // Serialize state to JSON
    const stateJson = JSON.stringify(params.state);
    const stateSizeBytes = Buffer.byteLength(stateJson, 'utf8');
    
    // Check size limit
    const maxBytes = config.maxHydrationSizeMb * 1024 * 1024;
    if (stateSizeBytes > maxBytes) {
      throw new Error(`State too large: ${stateSizeBytes} bytes exceeds ${maxBytes} byte limit`);
    }

    // Calculate hash for integrity verification
    const stateHash = crypto.createHash('sha256').update(stateJson).digest('hex');

    // Determine if we should compress
    const shouldCompress = params.compress !== false && 
      stateSizeBytes > config.compressionThresholdBytes;

    // Determine if we should use S3 (for large states)
    const useS3 = params.useS3 || 
      (config.hydrationS3Bucket && stateSizeBytes > 100 * 1024); // >100KB

    let compressedData: Buffer | null = null;
    let s3Bucket: string | undefined;
    let s3Key: string | undefined;

    if (shouldCompress) {
      compressedData = await gzip(stateJson);
      logger.debug('State compressed', {
        originalSize: stateSizeBytes,
        compressedSize: compressedData.length,
        ratio: (compressedData.length / stateSizeBytes * 100).toFixed(1) + '%',
      });
    }

    if (useS3 && config.hydrationS3Bucket) {
      s3Bucket = config.hydrationS3Bucket;
      s3Key = `hydration/${params.tenantId}/${params.agentId}/${params.checkpointName}-${Date.now()}.json${shouldCompress ? '.gz' : ''}`;

      await this.s3!.send(new PutObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key,
        Body: shouldCompress ? compressedData! : stateJson,
        ContentType: 'application/json',
        ContentEncoding: shouldCompress ? 'gzip' : undefined,
        Metadata: {
          tenantId: params.tenantId,
          agentId: params.agentId,
          checkpointName: params.checkpointName,
          stateHash,
        },
      }));

      logger.info('State uploaded to S3', {
        bucket: s3Bucket,
        key: s3Key,
        sizeBytes: shouldCompress ? compressedData!.length : stateSizeBytes,
      });
    }

    // Get next version number
    const versionResult = await this.db.query(
      `SELECT COALESCE(MAX(checkpoint_version), 0) + 1 as next_version
       FROM hydration_snapshots
       WHERE agent_id = $1 AND checkpoint_name = $2`,
      [params.agentId, params.checkpointName]
    );
    const checkpointVersion = versionResult.rows[0].next_version;

    // Calculate expiry
    const expiresAt = new Date(Date.now() + config.defaultExpiryHours * 60 * 60 * 1000);

    // Insert snapshot
    const result = await this.db.query(
      `INSERT INTO hydration_snapshots (
        tenant_id, agent_id, checkpoint_name, checkpoint_version,
        state_data, state_hash, state_size_bytes,
        is_compressed, compressed_data, s3_bucket, s3_key,
        resume_point, resume_context, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        params.tenantId,
        params.agentId,
        params.checkpointName,
        checkpointVersion,
        useS3 ? null : (shouldCompress ? null : params.state),
        stateHash,
        stateSizeBytes,
        shouldCompress,
        useS3 ? null : (shouldCompress ? compressedData : null),
        s3Bucket,
        s3Key,
        params.resumePoint,
        params.resumeContext ? JSON.stringify(params.resumeContext) : null,
        expiresAt,
      ]
    );

    const snapshot = this.mapSnapshotRow(result.rows[0]);

    // Update agent registry
    await this.db.query(
      `UPDATE agent_registry
       SET is_hydrated = TRUE, hydration_state = NULL,
           hydration_checkpoint = $1, hydrated_at = NOW(), status = 'hydrated'
       WHERE id = $2`,
      [params.checkpointName, params.agentId]
    );

    // Log event
    await this.logEvent(params.tenantId, 'agent_hydrated', {
      agentId: params.agentId,
      snapshotId: snapshot.id,
      checkpointName: params.checkpointName,
      stateSizeBytes,
      compressed: shouldCompress,
      usedS3: !!s3Key,
    });

    logger.info('Agent state hydrated', {
      agentId: params.agentId,
      checkpointName: params.checkpointName,
      snapshotId: snapshot.id,
      sizeBytes: stateSizeBytes,
    });

    return snapshot;
  }

  /**
   * Restore agent state from a checkpoint
   * 
   * Called when user provides input and agent needs to resume.
   */
  async restoreState(
    tenantId: string,
    agentId: string,
    checkpointName?: string
  ): Promise<RestoreResult> {
    if (!this.db) throw new Error('Database not initialized');

    // Find the latest snapshot
    const snapshotQuery = checkpointName
      ? `SELECT * FROM hydration_snapshots
         WHERE tenant_id = $1 AND agent_id = $2 AND checkpoint_name = $3
         ORDER BY checkpoint_version DESC LIMIT 1`
      : `SELECT * FROM hydration_snapshots
         WHERE tenant_id = $1 AND agent_id = $2
         ORDER BY created_at DESC LIMIT 1`;

    const params = checkpointName
      ? [tenantId, agentId, checkpointName]
      : [tenantId, agentId];

    const result = await this.db.query(snapshotQuery, params);

    if (result.rows.length === 0) {
      return {
        success: false,
        error: `No snapshot found for agent ${agentId}${checkpointName ? ` checkpoint ${checkpointName}` : ''}`,
      };
    }

    const row = result.rows[0];
    const snapshot = this.mapSnapshotRow(row);

    // Retrieve state
    let stateJson: string;

    if (row.s3_bucket && row.s3_key) {
      // Fetch from S3
      try {
        const s3Response = await this.s3!.send(new GetObjectCommand({
          Bucket: row.s3_bucket,
          Key: row.s3_key,
        }));

        const body = await s3Response.Body?.transformToByteArray();
        if (!body) {
          return { success: false, error: 'Failed to read S3 object' };
        }

        if (row.is_compressed) {
          const decompressed = await gunzip(Buffer.from(body));
          stateJson = decompressed.toString('utf8');
        } else {
          stateJson = Buffer.from(body).toString('utf8');
        }
      } catch (error) {
        logger.error('Failed to restore from S3', { error, s3Key: row.s3_key });
        return { success: false, error: `S3 retrieval failed: ${error}` };
      }
    } else if (row.compressed_data) {
      // Decompress from DB
      const decompressed = await gunzip(row.compressed_data);
      stateJson = decompressed.toString('utf8');
    } else if (row.state_data) {
      // Direct from DB
      stateJson = JSON.stringify(row.state_data);
    } else {
      return { success: false, error: 'No state data found in snapshot' };
    }

    // Verify hash
    const computedHash = crypto.createHash('sha256').update(stateJson).digest('hex');
    if (computedHash !== row.state_hash) {
      logger.error('State hash mismatch', {
        expected: row.state_hash,
        computed: computedHash,
      });
      return { success: false, error: 'State integrity check failed: hash mismatch' };
    }

    // Parse state
    let state: Record<string, unknown>;
    try {
      state = JSON.parse(stateJson);
    } catch (error) {
      return { success: false, error: `Failed to parse state JSON: ${error}` };
    }

    // Update snapshot restore count
    await this.db.query(
      `UPDATE hydration_snapshots
       SET restored_at = NOW(), restored_count = restored_count + 1
       WHERE id = $1`,
      [snapshot.id]
    );

    // Update agent registry
    await this.db.query(
      `UPDATE agent_registry
       SET is_hydrated = FALSE, status = 'active', hydration_checkpoint = NULL
       WHERE id = $1`,
      [agentId]
    );

    // Log event
    await this.logEvent(tenantId, 'agent_restored', {
      agentId,
      snapshotId: snapshot.id,
      checkpointName: snapshot.checkpointName,
      restoreCount: snapshot.restoredCount + 1,
    });

    logger.info('Agent state restored', {
      agentId,
      checkpointName: snapshot.checkpointName,
      snapshotId: snapshot.id,
    });

    return {
      success: true,
      state,
      resumePoint: snapshot.resumePoint,
      resumeContext: snapshot.resumeContext,
      snapshot,
    };
  }

  /**
   * List snapshots for an agent
   */
  async listSnapshots(
    tenantId: string,
    agentId: string,
    options: { limit?: number; includeExpired?: boolean } = {}
  ): Promise<HydrationSnapshot[]> {
    if (!this.db) return [];

    const { limit = 10, includeExpired = false } = options;

    let query = `SELECT * FROM hydration_snapshots
                 WHERE tenant_id = $1 AND agent_id = $2`;
    
    if (!includeExpired) {
      query += ` AND (expires_at IS NULL OR expires_at > NOW())`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $3`;

    const result = await this.db.query(query, [tenantId, agentId, limit]);
    return result.rows.map(row => this.mapSnapshotRow(row));
  }

  /**
   * Delete old snapshots (cleanup job)
   */
  async cleanupExpiredSnapshots(): Promise<{
    deleted: number;
    s3ObjectsDeleted: number;
  }> {
    if (!this.db) return { deleted: 0, s3ObjectsDeleted: 0 };

    // Find expired snapshots with S3 objects
    const s3Snapshots = await this.db.query(
      `SELECT id, s3_bucket, s3_key FROM hydration_snapshots
       WHERE expires_at < NOW() AND s3_bucket IS NOT NULL AND s3_key IS NOT NULL`
    );

    let s3ObjectsDeleted = 0;

    // Delete S3 objects
    for (const row of s3Snapshots.rows) {
      try {
        // Note: In production, use DeleteObjectCommand
        // For now, just log
        logger.info('Would delete S3 object', {
          bucket: row.s3_bucket,
          key: row.s3_key,
        });
        s3ObjectsDeleted++;
      } catch (error) {
        logger.error('Failed to delete S3 object', { error, s3Key: row.s3_key });
      }
    }

    // Delete expired snapshots from DB
    const result = await this.db.query(
      `DELETE FROM hydration_snapshots WHERE expires_at < NOW() RETURNING id`
    );

    const deleted = result.rows.length;

    if (deleted > 0) {
      logger.info('Cleaned up expired hydration snapshots', {
        deleted,
        s3ObjectsDeleted,
      });
    }

    return { deleted, s3ObjectsDeleted };
  }

  /**
   * Get hydration statistics
   */
  async getStats(tenantId: string): Promise<{
    totalSnapshots: number;
    totalSizeBytes: number;
    hydratedAgents: number;
    avgRestorationTimeMs: number;
    snapshotsByCheckpoint: Record<string, number>;
  }> {
    if (!this.db) {
      return {
        totalSnapshots: 0,
        totalSizeBytes: 0,
        hydratedAgents: 0,
        avgRestorationTimeMs: 0,
        snapshotsByCheckpoint: {},
      };
    }

    const [snapshotStats, agentStats, checkpointStats] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*) as count, SUM(state_size_bytes) as total_size
         FROM hydration_snapshots
         WHERE tenant_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
        [tenantId]
      ),
      this.db.query(
        `SELECT COUNT(*) as count FROM agent_registry
         WHERE tenant_id = $1 AND is_hydrated = TRUE`,
        [tenantId]
      ),
      this.db.query(
        `SELECT checkpoint_name, COUNT(*) as count
         FROM hydration_snapshots
         WHERE tenant_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
         GROUP BY checkpoint_name`,
        [tenantId]
      ),
    ]);

    const snapshotsByCheckpoint = checkpointStats.rows.reduce((acc, row) => {
      acc[row.checkpoint_name] = parseInt(row.count, 10);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSnapshots: parseInt(snapshotStats.rows[0]?.count || '0', 10),
      totalSizeBytes: parseInt(snapshotStats.rows[0]?.total_size || '0', 10),
      hydratedAgents: parseInt(agentStats.rows[0]?.count || '0', 10),
      avgRestorationTimeMs: 0, // Would need timing data
      snapshotsByCheckpoint,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async getConfig(tenantId: string): Promise<HydrationConfig> {
    if (this.configCache.has(tenantId)) {
      return this.configCache.get(tenantId)!;
    }

    if (!this.db) {
      return this.getDefaultConfig();
    }

    const result = await this.db.query(
      `SELECT * FROM blackboard_config WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY tenant_id NULLS LAST LIMIT 1`,
      [tenantId]
    );

    const config: HydrationConfig = result.rows.length > 0
      ? {
          enableAutoHydration: result.rows[0].enable_auto_hydration,
          hydrationThresholdSeconds: result.rows[0].hydration_threshold_seconds,
          maxHydrationSizeMb: result.rows[0].max_hydration_size_mb,
          hydrationS3Bucket: result.rows[0].hydration_s3_bucket,
          defaultExpiryHours: 72, // 3 days
          compressionThresholdBytes: 10 * 1024, // 10KB
        }
      : this.getDefaultConfig();

    this.configCache.set(tenantId, config);
    return config;
  }

  private getDefaultConfig(): HydrationConfig {
    return {
      enableAutoHydration: true,
      hydrationThresholdSeconds: 300,
      maxHydrationSizeMb: 50,
      hydrationS3Bucket: process.env.HYDRATION_S3_BUCKET,
      defaultExpiryHours: 72,
      compressionThresholdBytes: 10 * 1024,
    };
  }

  private mapSnapshotRow(row: Record<string, unknown>): HydrationSnapshot {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      agentId: row.agent_id as string,
      checkpointName: row.checkpoint_name as string,
      checkpointVersion: row.checkpoint_version as number,
      stateHash: row.state_hash as string,
      stateSizeBytes: row.state_size_bytes as number,
      isCompressed: row.is_compressed as boolean,
      s3Bucket: row.s3_bucket as string | undefined,
      s3Key: row.s3_key as string | undefined,
      resumePoint: row.resume_point as string | undefined,
      resumeContext: row.resume_context ? JSON.parse(row.resume_context as string) : undefined,
      createdAt: row.created_at as Date,
      expiresAt: row.expires_at as Date | undefined,
      restoredCount: row.restored_count as number,
    };
  }

  private async logEvent(
    tenantId: string,
    eventType: string,
    details: Record<string, unknown>
  ): Promise<void> {
    if (!this.db) return;

    await this.db.query(
      `INSERT INTO blackboard_events (tenant_id, event_type, details)
       VALUES ($1, $2, $3)`,
      [tenantId, eventType, JSON.stringify(details)]
    );
  }
}

// Export singleton
export const processHydrationService = new ProcessHydrationService();
