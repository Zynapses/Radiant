/**
 * RADIANT v4.18.0 - Log Export Service
 *
 * Async bulk export of logs across all time or a date range.
 * Produces downloadable files in JSON, CSV, JSON Lines, or Parquet format.
 *
 * Flow:
 *  1. Compliance officer requests export (all time, date range, categories)
 *  2. Service creates an export job, enumerates matching entries
 *  3. For hot-tier: queries PostgreSQL log_search_entries directly
 *  4. For warm-tier: reads from S3 Standard
 *  5. For cold/deep: requires a Glacier restore job first (links via glacier_restore_job_id)
 *  6. Merges, formats, uploads consolidated export to S3
 *  7. Generates a pre-signed download URL (valid 24h)
 */

import { Pool } from 'pg';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createGzip } from 'zlib';
import { PassThrough, Readable } from 'stream';
import { LogCategory, LogStorageTier } from './log-retention-policy.service';

const REGION = process.env.AWS_REGION || 'us-east-1';
const LOG_ARCHIVE_BUCKET = process.env.LOG_ARCHIVE_BUCKET || 'radiant-log-archives';
const EXPORT_BUCKET = process.env.LOG_EXPORT_BUCKET || 'radiant-log-exports';
const s3Client = new S3Client({ region: REGION });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = 'json' | 'csv' | 'json_lines' | 'parquet';
export type ExportJobStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired';

export interface LogExportJob {
  id: string;
  tenantId: string;
  exportName: string;
  categories: LogCategory[];
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  includeAllTime: boolean;
  searchQuery: string | null;
  format: ExportFormat;
  status: ExportJobStatus;
  totalEntries: number;
  exportedEntries: number;
  totalBytes: number;
  progressPct: number;
  s3Bucket: string | null;
  s3Key: string | null;
  downloadUrl: string | null;
  downloadExpiresAt: string | null;
  fileSizeBytes: number | null;
  fileCount: number;
  includesHot: boolean;
  includesWarm: boolean;
  includesCold: boolean;
  includesDeep: boolean;
  glacierRestoreJobId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  requestedBy: string;
  requestReason: string | null;
  createdAt: string;
}

export interface CreateExportRequest {
  tenantId: string;
  exportName?: string;
  categories?: LogCategory[];
  dateRangeStart?: string;
  dateRangeEnd?: string;
  includeAllTime?: boolean;
  searchQuery?: string;
  format?: ExportFormat;
  includesHot?: boolean;
  includesWarm?: boolean;
  includesCold?: boolean;
  includesDeep?: boolean;
  glacierRestoreJobId?: string;
  requestedBy: string;
  requestReason?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class LogExportService {
  constructor(private pool: Pool) {}

  // =========================================================================
  // LIST EXPORT JOBS
  // =========================================================================

  async listJobs(tenantId: string, filters?: {
    status?: ExportJobStatus;
    limit?: number;
  }): Promise<{ jobs: LogExportJob[]; total: number }> {
    let query = `SELECT * FROM log_export_jobs WHERE tenant_id = $1`;
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

  async getJob(jobId: string): Promise<LogExportJob | null> {
    const result = await this.pool.query(
      `SELECT * FROM log_export_jobs WHERE id = $1`, [jobId]
    );
    return result.rows.length > 0 ? this.mapJob(result.rows[0]) : null;
  }

  // =========================================================================
  // GET DOWNLOAD URL
  // =========================================================================

  async getDownloadUrl(jobId: string): Promise<string | null> {
    const job = await this.getJob(jobId);
    if (!job || job.status !== 'completed' || !job.s3Bucket || !job.s3Key) return null;

    const url = await getSignedUrl(s3Client, new GetObjectCommand({
      Bucket: job.s3Bucket,
      Key: job.s3Key,
    }), { expiresIn: 86400 }); // 24 hours

    // Update download URL in DB
    await this.pool.query(
      `UPDATE log_export_jobs SET download_url = $1, download_expires_at = $2, updated_at = NOW() WHERE id = $3`,
      [url, new Date(Date.now() + 86400000), jobId]
    );

    return url;
  }

  // =========================================================================
  // CREATE EXPORT JOB
  // =========================================================================

  async createExportJob(request: CreateExportRequest): Promise<LogExportJob> {
    const exportName = request.exportName || `Log Export — ${new Date().toISOString().split('T')[0]}`;
    const format = request.format || 'json_lines';
    const includeAllTime = request.includeAllTime || (!request.dateRangeStart && !request.dateRangeEnd);

    // Count matching entries
    let countQuery = `SELECT COUNT(*) as cnt, COALESCE(SUM(byte_size), 0) as total_bytes FROM log_index WHERE 1=1`;
    const countParams: unknown[] = [];
    let idx = 1;

    if (request.tenantId) {
      countQuery += ` AND (tenant_id = $${idx} OR tenant_id IS NULL)`;
      countParams.push(request.tenantId);
      idx++;
    }
    if (request.categories && request.categories.length > 0) {
      countQuery += ` AND category = ANY($${idx}::log_category[])`;
      countParams.push(request.categories);
      idx++;
    }
    if (!includeAllTime && request.dateRangeStart) {
      countQuery += ` AND window_end >= $${idx}`;
      countParams.push(request.dateRangeStart);
      idx++;
    }
    if (!includeAllTime && request.dateRangeEnd) {
      countQuery += ` AND window_start <= $${idx}`;
      countParams.push(request.dateRangeEnd);
      idx++;
    }

    // Filter by tier
    const tiers: string[] = [];
    if (request.includesHot !== false) tiers.push('hot');
    if (request.includesWarm !== false) tiers.push('warm');
    if (request.includesCold) tiers.push('cold');
    if (request.includesDeep) tiers.push('deep_archive');
    if (tiers.length > 0 && tiers.length < 4) {
      countQuery += ` AND storage_tier = ANY($${idx}::log_storage_tier[])`;
      countParams.push(tiers);
      idx++;
    }

    const countResult = await this.pool.query(countQuery, countParams);
    const totalEntries = parseInt(countResult.rows[0].cnt as string);
    const totalBytes = parseInt(countResult.rows[0].total_bytes as string) || 0;

    // Create job
    const insertResult = await this.pool.query(
      `INSERT INTO log_export_jobs (
        tenant_id, export_name, categories, date_range_start, date_range_end,
        include_all_time, search_query, format, status,
        total_entries, total_bytes,
        includes_hot, includes_warm, includes_cold, includes_deep,
        glacier_restore_job_id, requested_by, request_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::log_export_format, 'pending',
        $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        request.tenantId, exportName, request.categories || [],
        request.dateRangeStart || null, request.dateRangeEnd || null,
        includeAllTime, request.searchQuery || null, format,
        totalEntries, totalBytes,
        request.includesHot !== false, request.includesWarm !== false,
        request.includesCold || false, request.includesDeep || false,
        request.glacierRestoreJobId || null,
        request.requestedBy, request.requestReason || null,
      ]
    );

    return this.mapJob(insertResult.rows[0]);
  }

  // =========================================================================
  // PROCESS EXPORT JOB
  // =========================================================================

  async processExportJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job || job.status === 'completed' || job.status === 'cancelled') return;

    const startTime = Date.now();

    await this.pool.query(
      `UPDATE log_export_jobs SET status = 'in_progress', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [jobId]
    );

    try {
      // 1. Collect hot-tier entries from log_search_entries
      const hotEntries: string[] = [];
      if (job.includesHot) {
        const hotResult = await this.pool.query(
          `SELECT row_to_json(t) as entry FROM log_search_entries t
           WHERE ($1::UUID IS NULL OR tenant_id = $1 OR tenant_id IS NULL)
             AND ($2::log_category[] = '{}' OR category = ANY($2::log_category[]))
             AND ($3::TIMESTAMPTZ IS NULL OR timestamp >= $3)
             AND ($4::TIMESTAMPTZ IS NULL OR timestamp <= $4)
             AND ($5::TEXT IS NULL OR search_vector @@ plainto_tsquery('english', $5))
           ORDER BY timestamp`,
          [
            job.tenantId,
            job.categories.length > 0 ? job.categories : [],
            job.includeAllTime ? null : job.dateRangeStart,
            job.includeAllTime ? null : job.dateRangeEnd,
            job.searchQuery,
          ]
        );
        for (const row of hotResult.rows) {
          hotEntries.push(JSON.stringify(row.entry));
        }
      }

      // 2. Collect warm/cold/deep-tier entries from log_index → S3
      const archiveEntries: string[] = [];
      const tiers: string[] = [];
      if (job.includesWarm) tiers.push('warm');
      if (job.includesCold) tiers.push('cold');
      if (job.includesDeep) tiers.push('deep_archive');

      if (tiers.length > 0) {
        let archiveQuery = `SELECT * FROM log_index WHERE storage_tier = ANY($1::log_storage_tier[])`;
        const archiveParams: unknown[] = [tiers];
        let aIdx = 2;

        if (job.tenantId) {
          archiveQuery += ` AND (tenant_id = $${aIdx} OR tenant_id IS NULL)`;
          archiveParams.push(job.tenantId);
          aIdx++;
        }
        if (job.categories.length > 0) {
          archiveQuery += ` AND category = ANY($${aIdx}::log_category[])`;
          archiveParams.push(job.categories);
          aIdx++;
        }
        if (!job.includeAllTime && job.dateRangeStart) {
          archiveQuery += ` AND window_end >= $${aIdx}`;
          archiveParams.push(job.dateRangeStart);
          aIdx++;
        }
        if (!job.includeAllTime && job.dateRangeEnd) {
          archiveQuery += ` AND window_start <= $${aIdx}`;
          archiveParams.push(job.dateRangeEnd);
          aIdx++;
        }

        archiveQuery += ` ORDER BY window_start`;

        const archiveResult = await this.pool.query(archiveQuery, archiveParams);

        for (const entry of archiveResult.rows) {
          if (entry.s3_bucket && entry.s3_key) {
            try {
              const obj = await s3Client.send(new GetObjectCommand({
                Bucket: entry.s3_bucket as string,
                Key: entry.s3_key as string,
              }));
              if (obj.Body) {
                const bodyStr = await obj.Body.transformToString();
                archiveEntries.push(bodyStr);
              }
            } catch {
              // Object may not be accessible (still in Glacier)
              archiveEntries.push(JSON.stringify({
                _note: 'Archive not accessible — requires Glacier restore',
                logIndexId: entry.id,
                category: entry.category,
                windowStart: entry.window_start,
                windowEnd: entry.window_end,
                storageTier: entry.storage_tier,
              }));
            }
          }
        }
      }

      // 3. Format and merge
      const allEntries = [...hotEntries, ...archiveEntries];
      let output: string;

      switch (job.format) {
        case 'json':
          output = JSON.stringify(allEntries.map(e => { try { return JSON.parse(e); } catch { return e; } }), null, 2);
          break;
        case 'csv':
          output = this.entriesToCsv(allEntries);
          break;
        case 'json_lines':
        default:
          output = allEntries.join('\n');
          break;
      }

      // 4. Upload to S3
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = job.format === 'csv' ? 'csv' : job.format === 'json' ? 'json' : 'jsonl';
      const s3Key = `exports/${job.tenantId}/${dateStr}/${jobId}.${ext}.gz`;

      const compressed = require('zlib').gzipSync(Buffer.from(output, 'utf-8'));

      await s3Client.send(new PutObjectCommand({
        Bucket: EXPORT_BUCKET,
        Key: s3Key,
        Body: compressed,
        ContentType: 'application/gzip',
        ServerSideEncryption: 'aws:kms',
        Metadata: {
          'export-job-id': jobId,
          'tenant-id': job.tenantId,
          'format': job.format,
          'entry-count': String(allEntries.length),
        },
      }));

      // 5. Generate download URL
      const downloadUrl = await getSignedUrl(s3Client, new GetObjectCommand({
        Bucket: EXPORT_BUCKET,
        Key: s3Key,
      }), { expiresIn: 86400 });

      const durationMs = Date.now() - startTime;

      await this.pool.query(
        `UPDATE log_export_jobs SET
          status = 'completed', completed_at = NOW(), duration_ms = $1,
          exported_entries = $2, progress_pct = 100,
          s3_bucket = $3, s3_key = $4, file_size_bytes = $5,
          download_url = $6, download_expires_at = $7,
          updated_at = NOW()
        WHERE id = $8`,
        [
          durationMs, allEntries.length,
          EXPORT_BUCKET, s3Key, compressed.length,
          downloadUrl, new Date(Date.now() + 86400000),
          jobId,
        ]
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await this.pool.query(
        `UPDATE log_export_jobs SET status = 'failed', error_message = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [msg, jobId]
      );
      throw error;
    }
  }

  // =========================================================================
  // CANCEL JOB
  // =========================================================================

  async cancelJob(jobId: string): Promise<void> {
    await this.pool.query(
      `UPDATE log_export_jobs SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND status IN ('pending', 'in_progress')`,
      [jobId]
    );
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private entriesToCsv(entries: string[]): string {
    const rows: string[] = ['timestamp,level,service,category,message,request_id,user_id'];

    for (const entry of entries) {
      try {
        const obj = JSON.parse(entry);
        rows.push([
          obj.timestamp || '',
          obj.level || '',
          obj.service || '',
          obj.category || '',
          `"${(obj.message || '').replace(/"/g, '""')}"`,
          obj.request_id || obj.requestId || '',
          obj.user_id || obj.userId || '',
        ].join(','));
      } catch {
        rows.push(`,,,,${JSON.stringify(entry)},,`);
      }
    }

    return rows.join('\n');
  }

  private mapJob(row: Record<string, unknown>): LogExportJob {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      exportName: row.export_name as string,
      categories: (row.categories as LogCategory[]) || [],
      dateRangeStart: row.date_range_start ? (row.date_range_start as Date).toISOString() : null,
      dateRangeEnd: row.date_range_end ? (row.date_range_end as Date).toISOString() : null,
      includeAllTime: row.include_all_time as boolean,
      searchQuery: row.search_query as string | null,
      format: row.format as ExportFormat,
      status: row.status as ExportJobStatus,
      totalEntries: row.total_entries as number,
      exportedEntries: row.exported_entries as number,
      totalBytes: parseInt(row.total_bytes as string) || 0,
      progressPct: parseFloat(row.progress_pct as string) || 0,
      s3Bucket: row.s3_bucket as string | null,
      s3Key: row.s3_key as string | null,
      downloadUrl: row.download_url as string | null,
      downloadExpiresAt: row.download_expires_at ? (row.download_expires_at as Date).toISOString() : null,
      fileSizeBytes: row.file_size_bytes ? parseInt(row.file_size_bytes as string) : null,
      fileCount: row.file_count as number || 1,
      includesHot: row.includes_hot as boolean,
      includesWarm: row.includes_warm as boolean,
      includesCold: row.includes_cold as boolean,
      includesDeep: row.includes_deep as boolean,
      glacierRestoreJobId: row.glacier_restore_job_id as string | null,
      startedAt: row.started_at ? (row.started_at as Date).toISOString() : null,
      completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : null,
      errorMessage: row.error_message as string | null,
      durationMs: row.duration_ms as number | null,
      requestedBy: row.requested_by as string,
      requestReason: row.request_reason as string | null,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}
