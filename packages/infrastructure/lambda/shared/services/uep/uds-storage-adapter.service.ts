/**
 * UEP-UDS Storage Adapter
 * 
 * Integrates UEP envelope storage with the existing UDS (User Data Service)
 * tiered storage infrastructure. This avoids duplicating:
 * - Hot/Warm/Cold/Glacier tier management
 * - Kinesis queuing for high-throughput writes
 * - ElastiCache/DynamoDB hot tier
 * - Tier transition monitoring & alerting
 * - Admin dashboard controls
 * 
 * Architecture:
 *   UEP Envelope → UDS Adapter → Kinesis Queue → UDS Tier Coordinator
 *                                     ↓
 *                        Hot(Redis/DynamoDB) → Warm(PostgreSQL) → Cold(S3)
 */

import { SQSClient, SendMessageCommand, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import { KinesisClient, PutRecordCommand, PutRecordsCommand } from '@aws-sdk/client-kinesis';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { executeStatement, stringParam } from '../../db/client';
import { enhancedLogger as logger } from '../../logging/enhanced-logger';
import { udsAuditService } from '../uds/audit.service';
import { udsTierCoordinatorService } from '../uds/tier-coordinator.service';

// =============================================================================
// Types
// =============================================================================

export interface UEPStorageOptions {
  pipelineId?: string;
  traceId?: string;
  ttlSeconds?: number;
  skipQueue?: boolean;  // Write directly to warm tier (for low-volume tenants)
  compliance?: {
    frameworks?: string[];
    dataClassification?: string;
    retentionDays?: number;
  };
}

export interface StoredEnvelope {
  envelopeId: string;
  tenantId: string;
  specversion: string;
  type: string;
  source: Record<string, unknown>;
  payload: Record<string, unknown>;
  tracing?: Record<string, unknown>;
  compliance?: Record<string, unknown>;
  pipelineId?: string;
  checksum: string;
  currentTier: 'hot' | 'warm' | 'cold' | 'glacier';
  createdAt: string;
}

interface QueuedEnvelope {
  action: 'store' | 'update' | 'delete';
  envelope: StoredEnvelope;
  timestamp: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_HOT_TTL_SECONDS = 86400; // 24 hours
const KINESIS_STREAM = process.env.UDS_KINESIS_STREAM || 'radiant-uds-events';
const SQS_QUEUE_URL = process.env.UDS_ENVELOPE_QUEUE_URL;
const REDIS_KEY_PREFIX = 'uep:env:';

// =============================================================================
// Service Implementation
// =============================================================================

class UEPUDSStorageAdapter {
  private kinesis: KinesisClient;
  private sqs: SQSClient;
  private redis: Redis | null = null;
  private useKinesis: boolean;

  constructor() {
    this.kinesis = new KinesisClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.sqs = new SQSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    // Prefer Kinesis for high-throughput, fall back to SQS
    this.useKinesis = !!process.env.UDS_KINESIS_STREAM;
  }

  /**
   * Initialize Redis connection for hot tier
   */
  private async getRedis(): Promise<Redis | null> {
    if (!this.redis && process.env.REDIS_ENDPOINT) {
      try {
        this.redis = new Redis(process.env.REDIS_ENDPOINT, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true,
          keyPrefix: REDIS_KEY_PREFIX,
        });
        await this.redis.connect();
      } catch (error) {
        logger.warn('Redis connection failed for UEP storage', { error });
        return null;
      }
    }
    return this.redis;
  }

  // ===========================================================================
  // Write Operations
  // ===========================================================================

  /**
   * Store an envelope using UDS infrastructure
   * 
   * Flow:
   * 1. Write to Redis (hot tier) for immediate access
   * 2. Queue to Kinesis/SQS for async persistence to warm tier
   * 3. UDS tier coordinator handles warm → cold → glacier transitions
   */
  async store<T extends { envelopeId: string }>(
    tenantId: string,
    envelope: T,
    options: UEPStorageOptions = {}
  ): Promise<StoredEnvelope> {
    const stored = this.toStoredEnvelope(tenantId, envelope, options);

    // 1. Write to hot tier (Redis) for immediate access
    await this.writeToHot(stored, options.ttlSeconds);

    // 2. Queue for async persistence
    if (options.skipQueue) {
      // Direct write for low-volume or critical envelopes
      await this.writeToWarm(stored);
    } else {
      // Queue for high-throughput handling
      await this.queueForPersistence(stored);
    }

    logger.debug('Envelope stored via UDS adapter', {
      envelopeId: stored.envelopeId,
      tenantId,
      tier: 'hot',
    });

    return stored;
  }

  /**
   * Store multiple envelopes in batch
   */
  async storeBatch<T extends { envelopeId: string }>(
    tenantId: string,
    envelopes: T[],
    options: UEPStorageOptions = {}
  ): Promise<StoredEnvelope[]> {
    const stored = envelopes.map(e => this.toStoredEnvelope(tenantId, e, options));

    // Write all to hot tier
    await Promise.all(stored.map(e => this.writeToHot(e, options.ttlSeconds)));

    // Batch queue for persistence
    await this.queueBatchForPersistence(stored);

    return stored;
  }

  /**
   * Write to hot tier (Redis/ElastiCache)
   */
  private async writeToHot(envelope: StoredEnvelope, ttlSeconds?: number): Promise<void> {
    const redis = await this.getRedis();
    if (!redis) return;

    const ttl = ttlSeconds || DEFAULT_HOT_TTL_SECONDS;
    const key = `${envelope.tenantId}:${envelope.envelopeId}`;
    
    try {
      await redis.setex(key, ttl, JSON.stringify(envelope));
      
      // Also index by pipeline and trace for queries
      if (envelope.pipelineId) {
        await redis.sadd(`pipeline:${envelope.pipelineId}`, envelope.envelopeId);
        await redis.expire(`pipeline:${envelope.pipelineId}`, ttl);
      }
      if (envelope.tracing?.traceId) {
        await redis.sadd(`trace:${envelope.tracing.traceId}`, envelope.envelopeId);
        await redis.expire(`trace:${envelope.tracing.traceId}`, ttl);
      }
    } catch (error) {
      logger.warn('Hot tier write failed', { envelopeId: envelope.envelopeId, error });
      // Non-fatal - envelope will still be persisted via queue
    }
  }

  /**
   * Queue envelope for async persistence via Kinesis or SQS
   */
  private async queueForPersistence(envelope: StoredEnvelope): Promise<void> {
    const record: QueuedEnvelope = {
      action: 'store',
      envelope,
      timestamp: Date.now(),
    };

    if (this.useKinesis) {
      await this.kinesis.send(new PutRecordCommand({
        StreamName: KINESIS_STREAM,
        PartitionKey: envelope.tenantId,
        Data: Buffer.from(JSON.stringify(record)),
      }));
    } else if (SQS_QUEUE_URL) {
      await this.sqs.send(new SendMessageCommand({
        QueueUrl: SQS_QUEUE_URL,
        MessageBody: JSON.stringify(record),
        MessageGroupId: envelope.tenantId,
        MessageDeduplicationId: envelope.envelopeId,
      }));
    } else {
      // No queue configured - write directly
      await this.writeToWarm(envelope);
    }
  }

  /**
   * Queue batch for persistence
   */
  private async queueBatchForPersistence(envelopes: StoredEnvelope[]): Promise<void> {
    if (envelopes.length === 0) return;

    const records = envelopes.map(e => ({
      action: 'store' as const,
      envelope: e,
      timestamp: Date.now(),
    }));

    if (this.useKinesis) {
      // Kinesis batch (max 500 records)
      const chunks = this.chunkArray(records, 500);
      for (const chunk of chunks) {
        await this.kinesis.send(new PutRecordsCommand({
          StreamName: KINESIS_STREAM,
          Records: chunk.map(r => ({
            PartitionKey: r.envelope.tenantId,
            Data: Buffer.from(JSON.stringify(r)),
          })),
        }));
      }
    } else if (SQS_QUEUE_URL) {
      // SQS batch (max 10 messages)
      const chunks = this.chunkArray(records, 10);
      for (const chunk of chunks) {
        await this.sqs.send(new SendMessageBatchCommand({
          QueueUrl: SQS_QUEUE_URL,
          Entries: chunk.map((r, i) => ({
            Id: `${i}`,
            MessageBody: JSON.stringify(r),
            MessageGroupId: r.envelope.tenantId,
            MessageDeduplicationId: r.envelope.envelopeId,
          })),
        }));
      }
    } else {
      // Direct write
      await Promise.all(envelopes.map(e => this.writeToWarm(e)));
    }
  }

  /**
   * Write directly to warm tier (PostgreSQL)
   */
  private async writeToWarm(envelope: StoredEnvelope): Promise<void> {
    await executeStatement(
      `INSERT INTO uds_envelopes (
        id, tenant_id, specversion, type, source, payload,
        tracing, compliance, pipeline_id, checksum, current_tier, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        payload = EXCLUDED.payload,
        tracing = EXCLUDED.tracing,
        updated_at = CURRENT_TIMESTAMP`,
      [
        stringParam('id', envelope.envelopeId),
        stringParam('tenantId', envelope.tenantId),
        stringParam('specversion', envelope.specversion),
        stringParam('type', envelope.type),
        stringParam('source', JSON.stringify(envelope.source)),
        stringParam('payload', JSON.stringify(envelope.payload)),
        stringParam('tracing', envelope.tracing ? JSON.stringify(envelope.tracing) : ''),
        stringParam('compliance', envelope.compliance ? JSON.stringify(envelope.compliance) : ''),
        stringParam('pipelineId', envelope.pipelineId || ''),
        stringParam('checksum', envelope.checksum),
        stringParam('currentTier', 'warm'),
        stringParam('createdAt', envelope.createdAt),
      ]
    );
  }

  // ===========================================================================
  // Read Operations
  // ===========================================================================

  /**
   * Get envelope by ID - checks hot → warm → cold tiers
   */
  async get<T = unknown>(
    tenantId: string,
    envelopeId: string
  ): Promise<StoredEnvelope | null> {
    // 1. Check hot tier (Redis)
    const hot = await this.getFromHot(tenantId, envelopeId);
    if (hot) return hot;

    // 2. Check warm tier (PostgreSQL)
    const warm = await this.getFromWarm(tenantId, envelopeId);
    if (warm) return warm;

    // 3. Check cold tier (via UDS tier coordinator)
    const cold = await this.getFromCold(tenantId, envelopeId);
    return cold;
  }

  /**
   * Get from hot tier (Redis)
   */
  private async getFromHot(
    tenantId: string,
    envelopeId: string
  ): Promise<StoredEnvelope | null> {
    const redis = await this.getRedis();
    if (!redis) return null;

    try {
      const key = `${tenantId}:${envelopeId}`;
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as StoredEnvelope;
    } catch (error) {
      logger.warn('Hot tier read failed', { tenantId, envelopeId, error });
      return null;
    }
  }

  /**
   * Get from warm tier (PostgreSQL)
   */
  private async getFromWarm(
    tenantId: string,
    envelopeId: string
  ): Promise<StoredEnvelope | null> {
    const result = await executeStatement(
      `SELECT * FROM uds_envelopes 
       WHERE id = $1 AND tenant_id = $2`,
      [stringParam('id', envelopeId), stringParam('tenantId', tenantId)]
    );

    if (!result.rows?.length) return null;

    const row = result.rows[0];
    return {
      envelopeId: row.id as string,
      tenantId: row.tenant_id as string,
      specversion: row.specversion as string,
      type: row.type as string,
      source: row.source as Record<string, unknown>,
      payload: row.payload as Record<string, unknown>,
      tracing: row.tracing as Record<string, unknown> | undefined,
      compliance: row.compliance as Record<string, unknown> | undefined,
      pipelineId: row.pipeline_id as string | undefined,
      checksum: row.checksum as string,
      currentTier: row.current_tier as StoredEnvelope['currentTier'],
      createdAt: (row.created_at as Date).toISOString(),
    };
  }

  /**
   * Get from cold tier - uses UDS retrieve mechanism
   */
  private async getFromCold(
    tenantId: string,
    envelopeId: string
  ): Promise<StoredEnvelope | null> {
    // Check if envelope is in cold tier
    const result = await executeStatement(
      `SELECT current_tier, s3_key FROM uds_envelopes 
       WHERE id = $1 AND tenant_id = $2 AND current_tier IN ('cold', 'glacier')`,
      [stringParam('id', envelopeId), stringParam('tenantId', tenantId)]
    );

    if (!result.rows?.length) return null;

    // Use UDS tier coordinator to retrieve
    const retrieved = await udsTierCoordinatorService.retrieveColdToWarm(
      tenantId,
      [envelopeId]
    );

    if (retrieved.promoted > 0) {
      // Now fetch from warm tier
      return this.getFromWarm(tenantId, envelopeId);
    }

    return null;
  }

  /**
   * Query envelopes by pipeline or trace ID
   */
  async query(options: {
    tenantId: string;
    pipelineId?: string;
    traceId?: string;
    type?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }): Promise<StoredEnvelope[]> {
    const results: StoredEnvelope[] = [];
    const seen = new Set<string>();

    // 1. Check hot tier indexes first
    const redis = await this.getRedis();
    if (redis) {
      try {
        let envelopeIds: string[] = [];
        
        if (options.pipelineId) {
          envelopeIds = await redis.smembers(`pipeline:${options.pipelineId}`);
        } else if (options.traceId) {
          envelopeIds = await redis.smembers(`trace:${options.traceId}`);
        }

        for (const id of envelopeIds.slice(0, options.limit || 100)) {
          const envelope = await this.getFromHot(options.tenantId, id);
          if (envelope) {
            results.push(envelope);
            seen.add(envelope.envelopeId);
          }
        }
      } catch (error) {
        logger.warn('Hot tier query failed', { error });
      }
    }

    // 2. Query warm tier
    const conditions: string[] = ['tenant_id = $1'];
    const params: ReturnType<typeof stringParam>[] = [stringParam('tenantId', options.tenantId)];
    let paramIndex = 2;

    if (options.pipelineId) {
      conditions.push(`pipeline_id = $${paramIndex++}`);
      params.push(stringParam('pipelineId', options.pipelineId));
    }
    if (options.traceId) {
      conditions.push(`tracing->>'traceId' = $${paramIndex++}`);
      params.push(stringParam('traceId', options.traceId));
    }
    if (options.type) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(stringParam('type', options.type));
    }
    if (options.fromDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(stringParam('fromDate', options.fromDate.toISOString()));
    }
    if (options.toDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(stringParam('toDate', options.toDate.toISOString()));
    }

    const result = await executeStatement(
      `SELECT * FROM uds_envelopes 
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${paramIndex}`,
      [...params, stringParam('limit', String(options.limit || 100))]
    );

    for (const row of result.rows || []) {
      if (!seen.has(row.id as string)) {
        results.push({
          envelopeId: row.id as string,
          tenantId: row.tenant_id as string,
          specversion: row.specversion as string,
          type: row.type as string,
          source: row.source as Record<string, unknown>,
          payload: row.payload as Record<string, unknown>,
          tracing: row.tracing as Record<string, unknown> | undefined,
          compliance: row.compliance as Record<string, unknown> | undefined,
          pipelineId: row.pipeline_id as string | undefined,
          checksum: row.checksum as string,
          currentTier: row.current_tier as StoredEnvelope['currentTier'],
          createdAt: (row.created_at as Date).toISOString(),
        });
      }
    }

    return results.slice(0, options.limit || 100);
  }

  // ===========================================================================
  // Tier Management (delegates to UDS)
  // ===========================================================================

  /**
   * Get tier health - uses UDS tier coordinator
   */
  async getTierHealth(tenantId: string) {
    return udsTierCoordinatorService.getHealth(tenantId);
  }

  /**
   * Run housekeeping - uses UDS tier coordinator
   */
  async runHousekeeping(tenantId: string) {
    return udsTierCoordinatorService.runHousekeeping(tenantId);
  }

  /**
   * Archive old envelopes - uses UDS tier coordinator
   */
  async archiveOldEnvelopes(tenantId: string): Promise<{ promoted: number; errors: number }> {
    return udsTierCoordinatorService.archiveWarmToCold(tenantId);
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private toStoredEnvelope<T extends { envelopeId: string }>(
    tenantId: string,
    envelope: T,
    options: UEPStorageOptions
  ): StoredEnvelope {
    const env = envelope as Record<string, unknown>;
    const checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(envelope))
      .digest('hex');

    return {
      envelopeId: env.envelopeId as string,
      tenantId,
      specversion: (env.specversion as string) || '2.0',
      type: (env.type as string) || 'unknown',
      source: (env.source as Record<string, unknown>) || {},
      payload: (env.payload as Record<string, unknown>) || {},
      tracing: options.traceId 
        ? { ...((env.tracing as Record<string, unknown>) || {}), traceId: options.traceId }
        : (env.tracing as Record<string, unknown>),
      compliance: options.compliance 
        ? { ...((env.compliance as Record<string, unknown>) || {}), ...options.compliance }
        : (env.compliance as Record<string, unknown>),
      pipelineId: options.pipelineId,
      checksum,
      currentTier: 'hot',
      createdAt: new Date().toISOString(),
    };
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const uepStorageAdapter = new UEPUDSStorageAdapter();
export { UEPUDSStorageAdapter };
export default UEPUDSStorageAdapter;
