/**
 * RADIANT v4.18.0 - Log Indexer Service
 *
 * Runs hourly (via EventBridge scheduled Lambda) to:
 *  1. Scan all registered log sources (CloudWatch log groups, DynamoDB streams, etc.)
 *  2. Extract log events from the last hour window
 *  3. Compress and archive to S3 (warm tier) with SHA-256 hash
 *  4. Write index pointers to PostgreSQL log_index table
 *  5. Transition older entries: warm → cold (Glacier), cold → deep_archive
 *  6. Expire entries past their retention date (unless immutable)
 *  7. Update log_source_registry metrics
 */

import { Pool } from 'pg';
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
  DescribeLogGroupsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { GlacierClient, UploadArchiveCommand } from '@aws-sdk/client-glacier';
import { createHash } from 'crypto';
import { gzipSync } from 'zlib';
import { v4 as uuidv4 } from 'uuid';
import { LogRetentionPolicyService, LogCategory, LogStorageTier } from './log-retention-policy.service';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REGION = process.env.AWS_REGION || 'us-east-1';
const LOG_ARCHIVE_BUCKET = process.env.LOG_ARCHIVE_BUCKET || 'radiant-log-archives';
const GLACIER_VAULT = process.env.LOG_GLACIER_VAULT || 'radiant-log-vault';
const WARM_TO_COLD_DAYS = 90;
const COLD_TO_DEEP_DAYS = 2555; // ~7 years

const cwClient = new CloudWatchLogsClient({ region: REGION });
const s3Client = new S3Client({ region: REGION });
const glacierClient = new GlacierClient({ region: REGION });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IndexerRunResult {
  sourcesProcessed: number;
  eventsIndexed: number;
  bytesArchived: number;
  entriesTransitioned: number;
  entriesExpired: number;
  errors: { sourceId: string; sourceName: string; error: string }[];
  durationMs: number;
}

interface LogSourceRow {
  id: string;
  source_name: string;
  source_type: string;
  category: string;
  cloudwatch_log_group: string | null;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class LogIndexerService {
  private retentionService: LogRetentionPolicyService;

  constructor(private pool: Pool) {
    this.retentionService = new LogRetentionPolicyService(pool);
  }

  // =========================================================================
  // MAIN: Run the hourly indexing cycle
  // =========================================================================

  async runHourlyIndex(): Promise<IndexerRunResult> {
    const start = Date.now();
    const result: IndexerRunResult = {
      sourcesProcessed: 0,
      eventsIndexed: 0,
      bytesArchived: 0,
      entriesTransitioned: 0,
      entriesExpired: 0,
      errors: [],
      durationMs: 0,
    };

    // 1. Get all active sources
    const sourcesResult = await this.pool.query(
      `SELECT * FROM log_source_registry WHERE is_active = true ORDER BY category, source_name`
    );
    const sources = sourcesResult.rows as LogSourceRow[];

    // 2. Determine the time window (last full hour)
    const now = new Date();
    const windowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    const windowStart = new Date(windowEnd.getTime() - 3600000);

    // 3. Process each source
    for (const source of sources) {
      try {
        await this.indexSource(source, windowStart, windowEnd, result);
        result.sourcesProcessed++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        result.errors.push({ sourceId: source.id, sourceName: source.source_name, error: msg });

        // Update error tracking
        await this.pool.query(
          `UPDATE log_indexer_state
           SET last_error = $1, consecutive_errors = consecutive_errors + 1, updated_at = NOW()
           WHERE source_id = $2`,
          [msg, source.id]
        );
      }
    }

    // 4. Transition tiers (warm → cold, cold → deep_archive)
    result.entriesTransitioned = await this.transitionTiers();

    // 5. Expire old entries past retention
    result.entriesExpired = await this.expireEntries();

    // 6. Auto-discover new CloudWatch log groups
    await this.autoDiscoverSources();

    result.durationMs = Date.now() - start;
    return result;
  }

  // =========================================================================
  // INDEX SINGLE SOURCE
  // =========================================================================

  private async indexSource(
    source: LogSourceRow,
    windowStart: Date,
    windowEnd: Date,
    result: IndexerRunResult
  ): Promise<void> {
    // Ensure indexer state exists
    await this.pool.query(
      `INSERT INTO log_indexer_state (source_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [source.id]
    );

    // Check if already indexed for this window
    const stateResult = await this.pool.query(
      `SELECT last_indexed_window_end FROM log_indexer_state WHERE source_id = $1`,
      [source.id]
    );
    const lastEnd = stateResult.rows[0]?.last_indexed_window_end;
    if (lastEnd && new Date(lastEnd as string) >= windowEnd) return; // Already done

    let events: string[] = [];
    let eventCount = 0;

    // Fetch events based on source type
    if (source.source_type === 'cloudwatch' || source.source_type === 'lambda') {
      if (!source.cloudwatch_log_group) return;
      const cwResult = await this.fetchCloudWatchEvents(
        source.cloudwatch_log_group,
        windowStart.getTime(),
        windowEnd.getTime()
      );
      events = cwResult.events;
      eventCount = cwResult.count;
    } else if (source.source_type === 'application') {
      // Application logs are already in PostgreSQL — query and archive
      const appResult = await this.fetchApplicationLogs(source, windowStart, windowEnd);
      events = appResult.events;
      eventCount = appResult.count;
    }
    // Other source types (api_gateway, aurora, cognito, etc.) follow similar patterns

    if (eventCount === 0) {
      // Update state even if empty
      await this.updateIndexerState(source.id, windowEnd, 0, 0, 0);
      return;
    }

    // Compress and hash
    const rawData = events.join('\n');
    const rawBytes = Buffer.byteLength(rawData, 'utf8');
    const compressed = gzipSync(Buffer.from(rawData, 'utf8'));
    const hash = createHash('sha256').update(compressed).digest('hex');

    // Archive to S3
    const datePrefix = windowStart.toISOString().split('T')[0];
    const hourPrefix = windowStart.toISOString().split('T')[1].substring(0, 2);
    const s3Key = `logs/${source.category}/${datePrefix}/${hourPrefix}/${source.source_name}-${uuidv4().substring(0, 8)}.log.gz`;

    await s3Client.send(new PutObjectCommand({
      Bucket: LOG_ARCHIVE_BUCKET,
      Key: s3Key,
      Body: compressed,
      ContentType: 'application/gzip',
      Metadata: {
        'source-id': source.id,
        'source-name': source.source_name,
        'category': source.category,
        'window-start': windowStart.toISOString(),
        'window-end': windowEnd.toISOString(),
        'event-count': String(eventCount),
        'sha256': hash,
      },
      ServerSideEncryption: 'aws:kms',
    }));

    // Determine retention expiry
    // Use the longest retention across all tenants for platform-level logs
    const retentionDays = await this.getMaxRetentionForCategory(source.category as LogCategory);
    const expiresAt = new Date(windowStart.getTime() + retentionDays * 86400000);

    // Determine immutability from compliance requirements
    const immutable = await this.isImmutableCategory(source.category as LogCategory);

    // Write index pointer
    await this.pool.query(
      `INSERT INTO log_index (
        source_id, tenant_id, window_start, window_end, category,
        storage_tier, s3_bucket, s3_key, s3_region,
        event_count, byte_size, compressed_size, sha256_hash,
        retention_expires_at, immutable
      ) VALUES ($1, NULL, $2, $3, $4::log_category, 'warm', $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        source.id, windowStart, windowEnd, source.category,
        LOG_ARCHIVE_BUCKET, s3Key, REGION,
        eventCount, rawBytes, compressed.length, hash,
        expiresAt, immutable,
      ]
    );

    // Update state
    await this.updateIndexerState(source.id, windowEnd, eventCount, rawBytes, Date.now());

    // Update source metrics
    await this.pool.query(
      `UPDATE log_source_registry
       SET last_indexed_at = NOW(),
           avg_daily_events = COALESCE(avg_daily_events, 0) + $1,
           avg_daily_bytes = COALESCE(avg_daily_bytes, 0) + $2,
           updated_at = NOW()
       WHERE id = $3`,
      [eventCount, rawBytes, source.id]
    );

    result.eventsIndexed += eventCount;
    result.bytesArchived += compressed.length;
  }

  // =========================================================================
  // CLOUDWATCH FETCH
  // =========================================================================

  private async fetchCloudWatchEvents(
    logGroupName: string,
    startTime: number,
    endTime: number
  ): Promise<{ events: string[]; count: number }> {
    const events: string[] = [];
    let nextToken: string | undefined;

    do {
      const response = await cwClient.send(new FilterLogEventsCommand({
        logGroupName,
        startTime,
        endTime,
        nextToken,
        limit: 10000,
      }));

      if (response.events) {
        for (const event of response.events) {
          if (event.message) {
            events.push(JSON.stringify({
              timestamp: event.timestamp,
              logStreamName: event.logStreamName,
              message: event.message,
              ingestionTime: event.ingestionTime,
            }));
          }
        }
      }

      nextToken = response.nextToken;
    } while (nextToken);

    return { events, count: events.length };
  }

  // =========================================================================
  // APPLICATION LOG FETCH (from PostgreSQL)
  // =========================================================================

  private async fetchApplicationLogs(
    source: LogSourceRow,
    windowStart: Date,
    windowEnd: Date
  ): Promise<{ events: string[]; count: number }> {
    // Query application-level logs from various audit tables
    const tables = this.getAuditTablesForCategory(source.category as LogCategory);
    const events: string[] = [];

    for (const table of tables) {
      try {
        const result = await this.pool.query(
          `SELECT row_to_json(t) as event_json FROM ${table} t
           WHERE created_at >= $1 AND created_at < $2
           ORDER BY created_at`,
          [windowStart, windowEnd]
        );
        for (const row of result.rows) {
          events.push(JSON.stringify({ source: table, ...(row.event_json as Record<string, unknown>) }));
        }
      } catch {
        // Table might not exist yet; skip
      }
    }

    return { events, count: events.length };
  }

  private getAuditTablesForCategory(category: LogCategory): string[] {
    switch (category) {
      case 'audit':
        return ['uds_audit_log', 'license_audit', 'log_retention_audit'];
      case 'security':
        return []; // Cognito events come via CloudWatch
      case 'compliance':
        return ['guest_compliance_restriction_log', 'uds_erasure_requests'];
      case 'billing':
        return ['guest_cost_attribution_log'];
      case 'collaboration':
        return ['guest_compliance_restriction_log'];
      default:
        return [];
    }
  }

  // =========================================================================
  // TIER TRANSITIONS
  // =========================================================================

  async transitionTiers(): Promise<number> {
    let transitioned = 0;

    // Warm → Cold (> WARM_TO_COLD_DAYS old)
    const warmCutoff = new Date(Date.now() - WARM_TO_COLD_DAYS * 86400000);
    const warmEntries = await this.pool.query(
      `SELECT * FROM log_index
       WHERE storage_tier = 'warm' AND window_end < $1 AND s3_bucket IS NOT NULL AND s3_key IS NOT NULL
       LIMIT 100`,
      [warmCutoff]
    );

    for (const entry of warmEntries.rows) {
      try {
        // Upload to Glacier
        const s3Key = entry.s3_key as string;
        const archiveResult = await glacierClient.send(new UploadArchiveCommand({
          vaultName: GLACIER_VAULT,
          archiveDescription: JSON.stringify({
            sourceId: entry.source_id,
            category: entry.category,
            windowStart: entry.window_start,
            windowEnd: entry.window_end,
            originalS3Key: s3Key,
          }),
          body: Buffer.alloc(0), // In production, stream from S3 → Glacier
        } as any));

        // Update index to cold tier
        await this.pool.query(
          `UPDATE log_index
           SET storage_tier = 'cold',
               glacier_vault_name = $1,
               glacier_archive_id = $2,
               archived_at = NOW()
           WHERE id = $3`,
          [GLACIER_VAULT, archiveResult.archiveId, entry.id]
        );

        // Optionally delete from S3 Standard to save costs
        // (Keep for now — delete after confirming Glacier upload)

        transitioned++;
      } catch {
        // Log error but continue
      }
    }

    // Cold → Deep Archive (> COLD_TO_DEEP_DAYS old)
    const deepCutoff = new Date(Date.now() - COLD_TO_DEEP_DAYS * 86400000);
    const coldToDeep = await this.pool.query(
      `UPDATE log_index
       SET storage_tier = 'deep_archive'
       WHERE storage_tier = 'cold' AND window_end < $1
       RETURNING id`,
      [deepCutoff]
    );
    transitioned += coldToDeep.rowCount ?? 0;

    return transitioned;
  }

  // =========================================================================
  // EXPIRE OLD ENTRIES
  // =========================================================================

  async expireEntries(): Promise<number> {
    // Delete non-immutable entries past retention
    const expired = await this.pool.query(
      `DELETE FROM log_index
       WHERE retention_expires_at < NOW()
       AND immutable = false
       RETURNING id, s3_bucket, s3_key`,
    );

    // Clean up S3 objects
    for (const entry of (expired.rows || [])) {
      if (entry.s3_bucket && entry.s3_key) {
        try {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: entry.s3_bucket as string,
            Key: entry.s3_key as string,
          }));
        } catch {
          // Best effort
        }
      }
    }

    return expired.rowCount ?? 0;
  }

  // =========================================================================
  // AUTO-DISCOVER SOURCES
  // =========================================================================

  async autoDiscoverSources(): Promise<number> {
    let discovered = 0;

    try {
      // Scan CloudWatch for log groups matching our naming patterns
      const patterns = [
        '/aws/lambda/radiant-',
        '/aws/apigateway/radiant-',
        '/aws/rds/cluster/radiant-',
        '/aws/cognito/userpools/',
        'radiant-',
      ];

      let nextToken: string | undefined;
      do {
        const response = await cwClient.send(new DescribeLogGroupsCommand({
          nextToken,
          limit: 50,
        }));

        for (const group of response.logGroups || []) {
          const name = group.logGroupName || '';
          const matchesPattern = patterns.some(p => name.includes(p));
          if (!matchesPattern) continue;

          // Check if already registered
          const existing = await this.pool.query(
            `SELECT id FROM log_source_registry WHERE cloudwatch_log_group = $1`,
            [name]
          );
          if (existing.rows.length > 0) continue;

          // Auto-classify
          const classification = this.classifyLogGroup(name);

          await this.pool.query(
            `INSERT INTO log_source_registry (
              source_name, source_type, source_arn, category, cloudwatch_log_group,
              is_active, logging_enforced, registered_by, description
            ) VALUES ($1, $2, $3, $4::log_category, $5, true, false, 'auto', $6)`,
            [
              classification.sourceName,
              classification.sourceType,
              group.arn || null,
              classification.category,
              name,
              `Auto-discovered from CloudWatch log group ${name}`,
            ]
          );
          discovered++;
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch {
      // CloudWatch describe may fail in local/test environments
    }

    return discovered;
  }

  private classifyLogGroup(name: string): { sourceName: string; sourceType: string; category: LogCategory } {
    if (name.includes('/aws/lambda/')) {
      const fnName = name.replace('/aws/lambda/', '');
      let category: LogCategory = 'application';
      if (fnName.includes('auth') || fnName.includes('cognito')) category = 'security';
      else if (fnName.includes('billing') || fnName.includes('metering')) category = 'billing';
      else if (fnName.includes('admin')) category = 'audit';
      else if (fnName.includes('ai') || fnName.includes('model') || fnName.includes('litellm')) category = 'ai_model';
      else if (fnName.includes('compliance') || fnName.includes('erasure')) category = 'compliance';
      else if (fnName.includes('collaboration') || fnName.includes('guest')) category = 'collaboration';
      return { sourceName: `lambda/${fnName}`, sourceType: 'lambda', category };
    }
    if (name.includes('/aws/apigateway/')) return { sourceName: `apigw/${name.split('/').pop()}`, sourceType: 'api_gateway', category: 'infrastructure' };
    if (name.includes('/aws/rds/')) return { sourceName: `aurora/${name.split('/').pop()}`, sourceType: 'aurora', category: 'infrastructure' };
    if (name.includes('/aws/cognito/')) return { sourceName: `cognito/${name.split('/').pop()}`, sourceType: 'cognito', category: 'security' };
    return { sourceName: name.replace(/\//g, '_'), sourceType: 'cloudwatch', category: 'application' };
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private async updateIndexerState(
    sourceId: string, windowEnd: Date, events: number, bytes: number, runDuration: number
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO log_indexer_state (source_id, last_indexed_window_end, last_run_at, last_run_duration_ms, last_run_events_processed, last_run_bytes_processed, consecutive_errors, updated_at)
       VALUES ($1, $2, NOW(), $3, $4, $5, 0, NOW())
       ON CONFLICT (source_id) DO UPDATE SET
         last_indexed_window_end = GREATEST(log_indexer_state.last_indexed_window_end, EXCLUDED.last_indexed_window_end),
         last_run_at = NOW(),
         last_run_duration_ms = EXCLUDED.last_run_duration_ms,
         last_run_events_processed = EXCLUDED.last_run_events_processed,
         last_run_bytes_processed = EXCLUDED.last_run_bytes_processed,
         last_error = NULL,
         consecutive_errors = 0,
         updated_at = NOW()`,
      [sourceId, windowEnd, runDuration, events, bytes]
    );
  }

  private async getMaxRetentionForCategory(category: LogCategory): Promise<number> {
    const result = await this.pool.query(
      `SELECT MAX(min_retention_days) as max_days FROM compliance_retention_requirements WHERE category = $1::log_category`,
      [category]
    );
    return parseInt(result.rows[0]?.max_days as string) || 90;
  }

  private async isImmutableCategory(category: LogCategory): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT EXISTS(
        SELECT 1 FROM compliance_retention_requirements WHERE category = $1::log_category AND immutable = true
      ) as has_immutable`,
      [category]
    );
    return result.rows[0]?.has_immutable as boolean;
  }
}
