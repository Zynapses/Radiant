/**
 * RADIANT v4.18.0 - Log GDPR Erasure Service
 *
 * Handles right-to-erasure (Article 17) requests for log data.
 * Enforces compliance exemptions: immutable categories (e.g., audit under HIPAA)
 * cannot be erased even under GDPR — documents the exemption with legal basis.
 *
 * Flow:
 *  1. Data subject or admin requests erasure for specific user/tenant/categories
 *  2. Service checks exemptions via check_log_erasure_exemptions() PG function
 *  3. Exempt categories are skipped with documented reason
 *  4. Non-exempt entries are deleted from hot tier (log_search_entries),
 *     warm/cold/deep archives (S3/Glacier), and log_index pointers
 *  5. An erasure certificate (SHA-256 hash of the erasure log) is generated
 *  6. The request is logged to log_erasure_requests for audit
 */

import { Pool } from 'pg';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { LogCategory, ALL_LOG_CATEGORIES } from './log-retention-policy.service';

const REGION = process.env.AWS_REGION || 'us-east-1';
const s3Client = new S3Client({ region: REGION });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ErasureStatus = 'requested' | 'approved' | 'in_progress' | 'completed' | 'failed' | 'rejected';

export interface LogErasureRequest {
  id: string;
  tenantId: string;
  targetUserId: string | null;
  targetTenantId: string | null;
  categories: LogCategory[];
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  exemptCategories: LogCategory[];
  exemptionReasons: Record<string, string>;
  complianceKeys: string[];
  legalBasis: string | null;
  dataSubjectRequestId: string | null;
  status: ErasureStatus;
  totalEntries: number;
  erasedEntries: number;
  exemptEntries: number;
  progressPct: number;
  erasureCertificateHash: string | null;
  erasureLog: unknown[];
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  requestedBy: string;
  createdAt: string;
}

export interface CreateErasureRequest {
  tenantId: string;
  targetUserId?: string;
  targetTenantId?: string;
  categories: LogCategory[];
  dateRangeStart?: string;
  dateRangeEnd?: string;
  legalBasis?: string;
  dataSubjectRequestId?: string;
  requestedBy: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class LogGdprErasureService {
  constructor(private pool: Pool) {}

  // =========================================================================
  // LIST ERASURE REQUESTS
  // =========================================================================

  async listRequests(tenantId: string, filters?: {
    status?: ErasureStatus;
    limit?: number;
  }): Promise<{ requests: LogErasureRequest[]; total: number }> {
    let query = `SELECT * FROM log_erasure_requests WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (filters?.status) {
      query += ` AND status = $${idx}::log_erasure_status`;
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
      requests: result.rows.map(this.mapRequest),
      total: parseInt(countResult.rows[0].count as string),
    };
  }

  // =========================================================================
  // GET REQUEST
  // =========================================================================

  async getRequest(requestId: string): Promise<LogErasureRequest | null> {
    const result = await this.pool.query(
      `SELECT * FROM log_erasure_requests WHERE id = $1`, [requestId]
    );
    return result.rows.length > 0 ? this.mapRequest(result.rows[0]) : null;
  }

  // =========================================================================
  // CREATE ERASURE REQUEST (with automatic exemption check)
  // =========================================================================

  async createErasureRequest(request: CreateErasureRequest): Promise<LogErasureRequest> {
    // Check exemptions using the DB function
    const exemptionResult = await this.pool.query(
      `SELECT * FROM check_log_erasure_exemptions($1, $2::log_category[])`,
      [request.tenantId, request.categories]
    );

    const exemptCategories: LogCategory[] = [];
    const exemptionReasons: Record<string, string> = {};
    const complianceKeys: string[] = [];

    for (const row of exemptionResult.rows) {
      if (row.is_exempt) {
        exemptCategories.push(row.category as LogCategory);
        exemptionReasons[row.category as string] = row.exemption_reason as string;
        if (row.compliance_key && !complianceKeys.includes(row.compliance_key as string)) {
          complianceKeys.push(row.compliance_key as string);
        }
      }
    }

    // Count total entries that would be affected
    let countQuery = `SELECT COUNT(*) as cnt FROM log_index WHERE category = ANY($1::log_category[])`;
    const countParams: unknown[] = [request.categories];
    let idx = 2;

    if (request.tenantId) {
      countQuery += ` AND (tenant_id = $${idx} OR tenant_id IS NULL)`;
      countParams.push(request.tenantId);
      idx++;
    }
    if (request.dateRangeStart) {
      countQuery += ` AND window_end >= $${idx}`;
      countParams.push(request.dateRangeStart);
      idx++;
    }
    if (request.dateRangeEnd) {
      countQuery += ` AND window_start <= $${idx}`;
      countParams.push(request.dateRangeEnd);
      idx++;
    }

    const countResult = await this.pool.query(countQuery, countParams);
    const totalEntries = parseInt(countResult.rows[0].cnt as string);

    // Count exempt entries
    let exemptCount = 0;
    if (exemptCategories.length > 0) {
      const exemptQuery = countQuery.replace(
        `category = ANY($1::log_category[])`,
        `category = ANY($1::log_category[])`
      );
      const exemptResult = await this.pool.query(
        `SELECT COUNT(*) as cnt FROM log_index WHERE category = ANY($1::log_category[]) AND (tenant_id = $2 OR tenant_id IS NULL)`,
        [exemptCategories, request.tenantId]
      );
      exemptCount = parseInt(exemptResult.rows[0].cnt as string);
    }

    const insertResult = await this.pool.query(
      `INSERT INTO log_erasure_requests (
        tenant_id, target_user_id, target_tenant_id, categories,
        date_range_start, date_range_end,
        exempt_categories, exemption_reasons, compliance_keys,
        legal_basis, data_subject_request_id,
        status, total_entries, exempt_entries, requested_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'requested', $12, $13, $14)
      RETURNING *`,
      [
        request.tenantId, request.targetUserId || null, request.targetTenantId || null,
        request.categories, request.dateRangeStart || null, request.dateRangeEnd || null,
        exemptCategories, JSON.stringify(exemptionReasons), complianceKeys,
        request.legalBasis || null, request.dataSubjectRequestId || null,
        totalEntries, exemptCount, request.requestedBy,
      ]
    );

    return this.mapRequest(insertResult.rows[0]);
  }

  // =========================================================================
  // APPROVE ERASURE
  // =========================================================================

  async approveErasure(requestId: string, approvedBy: string): Promise<void> {
    await this.pool.query(
      `UPDATE log_erasure_requests SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'requested'`,
      [approvedBy, requestId]
    );
  }

  // =========================================================================
  // REJECT ERASURE
  // =========================================================================

  async rejectErasure(requestId: string, rejectedBy: string, reason: string): Promise<void> {
    await this.pool.query(
      `UPDATE log_erasure_requests SET status = 'rejected', approved_by = $1, rejection_reason = $2, updated_at = NOW()
       WHERE id = $3 AND status = 'requested'`,
      [rejectedBy, reason, requestId]
    );
  }

  // =========================================================================
  // EXECUTE ERASURE (only after approval)
  // =========================================================================

  async executeErasure(requestId: string): Promise<void> {
    const req = await this.getRequest(requestId);
    if (!req) throw new Error('Erasure request not found');
    if (req.status !== 'approved') throw new Error('Erasure request must be approved before execution');

    await this.pool.query(
      `UPDATE log_erasure_requests SET status = 'in_progress', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [requestId]
    );

    try {
      const erasureLog: unknown[] = [];
      let erasedCount = 0;

      // Determine erasable categories (requested minus exempt)
      const erasableCategories = req.categories.filter(c => !req.exemptCategories.includes(c));

      if (erasableCategories.length === 0) {
        // All categories are exempt
        await this.pool.query(
          `UPDATE log_erasure_requests SET
            status = 'completed', completed_at = NOW(), erased_entries = 0, progress_pct = 100,
            erasure_log = $1, updated_at = NOW()
          WHERE id = $2`,
          [JSON.stringify([{ action: 'all_exempt', message: 'All requested categories are exempt from erasure' }]), requestId]
        );
        return;
      }

      // 1. Erase from hot tier (log_search_entries)
      const hotDeleted = await this.pool.query(
        `DELETE FROM log_search_entries
         WHERE category = ANY($1::log_category[])
           AND (tenant_id = $2 OR tenant_id IS NULL)
           AND ($3::TIMESTAMPTZ IS NULL OR timestamp >= $3)
           AND ($4::TIMESTAMPTZ IS NULL OR timestamp <= $4)
           AND ($5::UUID IS NULL OR user_id = $5::TEXT)
         RETURNING id`,
        [erasableCategories, req.tenantId, req.dateRangeStart, req.dateRangeEnd, req.targetUserId]
      );
      erasedCount += hotDeleted.rowCount ?? 0;
      erasureLog.push({ tier: 'hot', action: 'deleted', count: hotDeleted.rowCount ?? 0 });

      // 2. Erase from log_index + S3 archives
      let indexQuery = `SELECT * FROM log_index WHERE category = ANY($1::log_category[]) AND immutable = false`;
      const indexParams: unknown[] = [erasableCategories];
      let pIdx = 2;

      if (req.tenantId) {
        indexQuery += ` AND (tenant_id = $${pIdx} OR tenant_id IS NULL)`;
        indexParams.push(req.tenantId);
        pIdx++;
      }
      if (req.dateRangeStart) {
        indexQuery += ` AND window_end >= $${pIdx}`;
        indexParams.push(req.dateRangeStart);
        pIdx++;
      }
      if (req.dateRangeEnd) {
        indexQuery += ` AND window_start <= $${pIdx}`;
        indexParams.push(req.dateRangeEnd);
        pIdx++;
      }

      const indexEntries = await this.pool.query(indexQuery, indexParams);

      for (const entry of indexEntries.rows) {
        // Delete S3 object
        if (entry.s3_bucket && entry.s3_key) {
          try {
            await s3Client.send(new DeleteObjectCommand({
              Bucket: entry.s3_bucket as string,
              Key: entry.s3_key as string,
            }));
            erasureLog.push({
              tier: entry.storage_tier,
              action: 's3_deleted',
              s3Key: entry.s3_key,
              category: entry.category,
              windowStart: entry.window_start,
            });
          } catch (err) {
            erasureLog.push({
              tier: entry.storage_tier,
              action: 's3_delete_failed',
              s3Key: entry.s3_key,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        // Delete Merkle chain entry (if exists)
        await this.pool.query(
          `DELETE FROM log_merkle_chain WHERE log_index_id = $1`, [entry.id]
        );

        // Delete log_index entry
        await this.pool.query(`DELETE FROM log_index WHERE id = $1`, [entry.id]);
        erasedCount++;

        // Update progress
        if (erasedCount % 50 === 0) {
          const pct = Math.min(99, (erasedCount / Math.max(1, req.totalEntries - req.exemptEntries)) * 100);
          await this.pool.query(
            `UPDATE log_erasure_requests SET erased_entries = $1, progress_pct = $2, updated_at = NOW() WHERE id = $3`,
            [erasedCount, pct, requestId]
          );
        }
      }

      erasureLog.push({ tier: 'index', action: 'deleted', count: indexEntries.rows.length });

      // 3. Generate erasure certificate
      const certificateData = JSON.stringify({
        requestId,
        erasedAt: new Date().toISOString(),
        tenantId: req.tenantId,
        categories: erasableCategories,
        exemptCategories: req.exemptCategories,
        totalErased: erasedCount,
        erasureLog,
      });
      const certificateHash = createHash('sha256').update(certificateData).digest('hex');

      // 4. Complete
      await this.pool.query(
        `UPDATE log_erasure_requests SET
          status = 'completed', completed_at = NOW(),
          erased_entries = $1, progress_pct = 100,
          erasure_certificate_hash = $2, erasure_log = $3,
          updated_at = NOW()
        WHERE id = $4`,
        [erasedCount, certificateHash, JSON.stringify(erasureLog), requestId]
      );

      // 5. Audit log
      await this.pool.query(
        `INSERT INTO log_retention_audit (tenant_id, action, category, new_value, performed_by)
         VALUES ($1, 'gdpr_erasure', NULL, $2, $3)`,
        [req.tenantId, JSON.stringify({ requestId, erasedCount, certificateHash }), req.requestedBy]
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await this.pool.query(
        `UPDATE log_erasure_requests SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
        [msg, requestId]
      );
      throw error;
    }
  }

  // =========================================================================
  // MAPPER
  // =========================================================================

  private mapRequest(row: Record<string, unknown>): LogErasureRequest {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      targetUserId: row.target_user_id as string | null,
      targetTenantId: row.target_tenant_id as string | null,
      categories: (row.categories as LogCategory[]) || [],
      dateRangeStart: row.date_range_start ? (row.date_range_start as Date).toISOString() : null,
      dateRangeEnd: row.date_range_end ? (row.date_range_end as Date).toISOString() : null,
      exemptCategories: (row.exempt_categories as LogCategory[]) || [],
      exemptionReasons: (row.exemption_reasons as Record<string, string>) || {},
      complianceKeys: (row.compliance_keys as string[]) || [],
      legalBasis: row.legal_basis as string | null,
      dataSubjectRequestId: row.data_subject_request_id as string | null,
      status: row.status as ErasureStatus,
      totalEntries: row.total_entries as number,
      erasedEntries: row.erased_entries as number,
      exemptEntries: row.exempt_entries as number,
      progressPct: parseFloat(row.progress_pct as string) || 0,
      erasureCertificateHash: row.erasure_certificate_hash as string | null,
      erasureLog: (row.erasure_log as unknown[]) || [],
      approvedBy: row.approved_by as string | null,
      approvedAt: row.approved_at ? (row.approved_at as Date).toISOString() : null,
      rejectionReason: row.rejection_reason as string | null,
      startedAt: row.started_at ? (row.started_at as Date).toISOString() : null,
      completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : null,
      errorMessage: row.error_message as string | null,
      requestedBy: row.requested_by as string,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}
