/**
 * RADIANT v4.18.0 - Log Glacier Restore Service
 *
 * Restores one or thousands of archived log entries from S3 Glacier / Deep Archive.
 * Tracks progress in PostgreSQL, provides ETA, and creates temporary S3 access.
 *
 * Flow:
 *  1. User requests restore (selective IDs, category, date range, or full)
 *  2. Service creates a restore job, enumerates matching log_index entries
 *  3. Initiates Glacier RestoreObject for each archived S3 object
 *  4. Polls for completion (Glacier Standard = 3-5hr, Expedited = 1-5min)
 *  5. Once restored, objects are temporarily available in S3 (default 7 days)
 *  6. Admin can view/download restored logs or trigger a bulk export
 */

import { Pool } from 'pg';
import {
  S3Client,
  RestoreObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { LogCategory, LogStorageTier } from './log-retention-policy.service';

const REGION = process.env.AWS_REGION || 'us-east-1';
const LOG_ARCHIVE_BUCKET = process.env.LOG_ARCHIVE_BUCKET || 'radiant-log-archives';
const RESTORE_EXPIRY_DAYS = 7;
const s3Client = new S3Client({ region: REGION });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RestoreJobStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired';
export type RetrievalTier = 'Expedited' | 'Standard' | 'Bulk';

export interface GlacierRestoreJob {
  id: string;
  tenantId: string;
  restoreType: string;
  categories: LogCategory[];
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  logIndexIds: string[];
  retrievalTier: RetrievalTier;
  status: RestoreJobStatus;
  totalArchives: number;
  restoredArchives: number;
  failedArchives: number;
  totalBytes: number;
  restoredBytes: number;
  progressPct: number;
  restoredS3Bucket: string | null;
  restoredS3Prefix: string | null;
  restoredExpiresAt: string | null;
  estimatedReadyAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  requestedBy: string;
  requestReason: string | null;
  createdAt: string;
}

export interface CreateRestoreRequest {
  tenantId: string;
  restoreType: 'selective' | 'category' | 'date_range' | 'full';
  categories?: LogCategory[];
  dateRangeStart?: string;
  dateRangeEnd?: string;
  logIndexIds?: string[];
  retrievalTier?: RetrievalTier;
  requestedBy: string;
  requestReason?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class LogGlacierRestoreService {
  constructor(private pool: Pool) {}

  // =========================================================================
  // LIST RESTORE JOBS
  // =========================================================================

  async listJobs(tenantId: string, filters?: {
    status?: RestoreJobStatus;
    limit?: number;
  }): Promise<{ jobs: GlacierRestoreJob[]; total: number }> {
    let query = `SELECT * FROM log_glacier_restore_jobs WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (filters?.status) {
      query += ` AND status = $${idx}::log_job_status`;
      params.push(filters.status);
      idx++;
    }

    const countResult = await this.pool.query(
      query.replace('SELECT *', 'SELECT COUNT(*)'), params
    );

    query += ` ORDER BY created_at DESC LIMIT $${idx}`;
    params.push(filters?.limit || 50);

    const result = await this.pool.query(query, params);
    return {
      jobs: result.rows.map(this.mapJob),
      total: parseInt(countResult.rows[0].count as string),
    };
  }

  // =========================================================================
  // GET JOB
  // =========================================================================

  async getJob(jobId: string): Promise<GlacierRestoreJob | null> {
    const result = await this.pool.query(
      `SELECT * FROM log_glacier_restore_jobs WHERE id = $1`, [jobId]
    );
    return result.rows.length > 0 ? this.mapJob(result.rows[0]) : null;
  }

  // =========================================================================
  // CREATE RESTORE JOB
  // =========================================================================

  async createRestoreJob(request: CreateRestoreRequest): Promise<GlacierRestoreJob> {
    const tier = request.retrievalTier || 'Standard';

    // Enumerate matching log_index entries in cold/deep_archive tiers
    let indexQuery = `SELECT * FROM log_index WHERE storage_tier IN ('cold', 'deep_archive')`;
    const indexParams: unknown[] = [];
    let idx = 1;

    if (request.logIndexIds && request.logIndexIds.length > 0) {
      indexQuery += ` AND id = ANY($${idx}::uuid[])`;
      indexParams.push(request.logIndexIds);
      idx++;
    }
    if (request.categories && request.categories.length > 0) {
      indexQuery += ` AND category = ANY($${idx}::log_category[])`;
      indexParams.push(request.categories);
      idx++;
    }
    if (request.dateRangeStart) {
      indexQuery += ` AND window_end >= $${idx}`;
      indexParams.push(request.dateRangeStart);
      idx++;
    }
    if (request.dateRangeEnd) {
      indexQuery += ` AND window_start <= $${idx}`;
      indexParams.push(request.dateRangeEnd);
      idx++;
    }
    if (request.tenantId) {
      indexQuery += ` AND (tenant_id = $${idx} OR tenant_id IS NULL)`;
      indexParams.push(request.tenantId);
      idx++;
    }

    const indexResult = await this.pool.query(indexQuery, indexParams);
    const entries = indexResult.rows;

    if (entries.length === 0) {
      throw new Error('No archived log entries match the restore criteria');
    }

    const totalBytes = entries.reduce((s: number, e: Record<string, unknown>) => s + (parseInt(e.byte_size as string) || 0), 0);
    const logIndexIds = entries.map((e: Record<string, unknown>) => e.id as string);

    // Estimate ready time
    const estimatedReadyAt = this.estimateReadyTime(tier);

    // Create job record
    const insertResult = await this.pool.query(
      `INSERT INTO log_glacier_restore_jobs (
        tenant_id, restore_type, categories, date_range_start, date_range_end,
        log_index_ids, retrieval_tier, status, total_archives, total_bytes,
        estimated_ready_at, requested_by, request_reason,
        restored_s3_bucket, restored_s3_prefix, restored_expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        request.tenantId, request.restoreType,
        request.categories || [], request.dateRangeStart || null, request.dateRangeEnd || null,
        logIndexIds, tier, entries.length, totalBytes, estimatedReadyAt,
        request.requestedBy, request.requestReason || null,
        LOG_ARCHIVE_BUCKET,
        `restored/${request.tenantId}/${new Date().toISOString().split('T')[0]}/`,
        new Date(Date.now() + RESTORE_EXPIRY_DAYS * 86400000),
      ]
    );

    return this.mapJob(insertResult.rows[0]);
  }

  // =========================================================================
  // PROCESS RESTORE JOB (called by scheduled Lambda or manual trigger)
  // =========================================================================

  async processRestoreJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job || job.status === 'completed' || job.status === 'cancelled') return;

    await this.pool.query(
      `UPDATE log_glacier_restore_jobs SET status = 'in_progress', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [jobId]
    );

    // Get all log_index entries for this job
    const entries = await this.pool.query(
      `SELECT * FROM log_index WHERE id = ANY($1::uuid[])`,
      [job.logIndexIds]
    );

    let restoredCount = 0;
    let failedCount = 0;
    let restoredBytes = 0;

    for (const entry of entries.rows) {
      try {
        const s3Bucket = entry.s3_bucket as string;
        const s3Key = entry.s3_key as string;

        if (!s3Bucket || !s3Key) {
          // Glacier-only entry — use glacier_archive_id
          // For Glacier vault archives, we'd use GlacierClient.initiateJob
          failedCount++;
          continue;
        }

        // Initiate S3 Glacier restore
        await s3Client.send(new RestoreObjectCommand({
          Bucket: s3Bucket,
          Key: s3Key,
          RestoreRequest: {
            Days: RESTORE_EXPIRY_DAYS,
            GlacierJobParameters: {
              Tier: job.retrievalTier,
            },
          },
        }));

        restoredCount++;
        restoredBytes += parseInt(entry.byte_size as string) || 0;
      } catch (error: unknown) {
        const err = error as { name?: string };
        if (err.name === 'RestoreAlreadyInProgress') {
          restoredCount++;
          restoredBytes += parseInt(entry.byte_size as string) || 0;
        } else {
          failedCount++;
        }
      }

      // Update progress periodically
      if ((restoredCount + failedCount) % 10 === 0 || restoredCount + failedCount === entries.rows.length) {
        const total = entries.rows.length;
        const pct = ((restoredCount + failedCount) / total) * 100;
        await this.pool.query(
          `UPDATE log_glacier_restore_jobs SET
            restored_archives = $1, failed_archives = $2, restored_bytes = $3,
            progress_pct = $4, updated_at = NOW()
          WHERE id = $5`,
          [restoredCount, failedCount, restoredBytes, pct, jobId]
        );
      }
    }

    // Mark as completed (or failed if all failed)
    const finalStatus = failedCount === entries.rows.length ? 'failed' : 'completed';
    await this.pool.query(
      `UPDATE log_glacier_restore_jobs SET
        status = $1::log_job_status, restored_archives = $2, failed_archives = $3,
        restored_bytes = $4, progress_pct = 100, completed_at = NOW(), updated_at = NOW()
      WHERE id = $5`,
      [finalStatus, restoredCount, failedCount, restoredBytes, jobId]
    );
  }

  // =========================================================================
  // CHECK RESTORE STATUS (poll Glacier restore completion)
  // =========================================================================

  async checkRestoreStatus(jobId: string): Promise<{
    ready: boolean;
    restoredCount: number;
    pendingCount: number;
    totalCount: number;
  }> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error('Job not found');

    const entries = await this.pool.query(
      `SELECT * FROM log_index WHERE id = ANY($1::uuid[]) AND s3_bucket IS NOT NULL AND s3_key IS NOT NULL`,
      [job.logIndexIds]
    );

    let readyCount = 0;
    let pendingCount = 0;

    for (const entry of entries.rows) {
      try {
        const head = await s3Client.send(new HeadObjectCommand({
          Bucket: entry.s3_bucket as string,
          Key: entry.s3_key as string,
        }));

        // Check x-amz-restore header
        const restore = head.Restore;
        if (restore && restore.includes('ongoing-request="false"')) {
          readyCount++;
        } else {
          pendingCount++;
        }
      } catch {
        pendingCount++;
      }
    }

    return {
      ready: pendingCount === 0,
      restoredCount: readyCount,
      pendingCount,
      totalCount: entries.rows.length,
    };
  }

  // =========================================================================
  // CANCEL JOB
  // =========================================================================

  async cancelJob(jobId: string): Promise<void> {
    await this.pool.query(
      `UPDATE log_glacier_restore_jobs SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND status IN ('pending', 'in_progress')`,
      [jobId]
    );
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private estimateReadyTime(tier: RetrievalTier): Date {
    const now = Date.now();
    switch (tier) {
      case 'Expedited': return new Date(now + 5 * 60 * 1000);       // 1-5 minutes
      case 'Standard':  return new Date(now + 5 * 3600 * 1000);     // 3-5 hours
      case 'Bulk':      return new Date(now + 12 * 3600 * 1000);    // 5-12 hours
    }
  }

  private mapJob(row: Record<string, unknown>): GlacierRestoreJob {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      restoreType: row.restore_type as string,
      categories: (row.categories as LogCategory[]) || [],
      dateRangeStart: row.date_range_start ? (row.date_range_start as Date).toISOString() : null,
      dateRangeEnd: row.date_range_end ? (row.date_range_end as Date).toISOString() : null,
      logIndexIds: (row.log_index_ids as string[]) || [],
      retrievalTier: row.retrieval_tier as RetrievalTier,
      status: row.status as RestoreJobStatus,
      totalArchives: row.total_archives as number,
      restoredArchives: row.restored_archives as number,
      failedArchives: row.failed_archives as number,
      totalBytes: parseInt(row.total_bytes as string) || 0,
      restoredBytes: parseInt(row.restored_bytes as string) || 0,
      progressPct: parseFloat(row.progress_pct as string) || 0,
      restoredS3Bucket: row.restored_s3_bucket as string | null,
      restoredS3Prefix: row.restored_s3_prefix as string | null,
      restoredExpiresAt: row.restored_expires_at ? (row.restored_expires_at as Date).toISOString() : null,
      estimatedReadyAt: row.estimated_ready_at ? (row.estimated_ready_at as Date).toISOString() : null,
      startedAt: row.started_at ? (row.started_at as Date).toISOString() : null,
      completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : null,
      errorMessage: row.error_message as string | null,
      requestedBy: row.requested_by as string,
      requestReason: row.request_reason as string | null,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}
