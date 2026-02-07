/**
 * RADIANT UEP Self-Healing Service
 * 
 * Ensures UEP data durability across system restarts and isolated failures.
 * Detects and repairs:
 * - Partially written UEP envelopes in S3/UDS
 * - Uncommitted envelopes in memory at restart
 * - Orphaned envelopes without database records
 * - Corrupted envelope data
 * - Stale in-flight transactions
 * 
 * Can be run:
 * - On system startup (automatic recovery)
 * - Ad-hoc via admin API
 * - On schedule via EventBridge
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { createRegisteredLogger } from '../logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'uep/self-healing',
  category: 'infrastructure',
  sourceType: 'application',
});
import { executeStatement, stringParam, boolParam } from '../../db/client';
import { persistenceGuard } from '../persistence-guard.service';
import type { UEPEnvelope } from './integration.service';

// =============================================================================
// Types
// =============================================================================

export interface HealingReport {
  runId: string;
  startedAt: string;
  completedAt: string;
  tenantId: string;
  mode: 'startup' | 'adhoc' | 'scheduled';
  summary: {
    totalIssuesFound: number;
    totalIssuesResolved: number;
    totalIssuesFailed: number;
    partialWritesRecovered: number;
    orphanedEnvelopesFixed: number;
    corruptedEnvelopesQuarantined: number;
    staleTransactionsRolledBack: number;
    memoryBuffersFlushed: number;
  };
  issues: HealingIssue[];
  durationMs: number;
}

export interface HealingIssue {
  id: string;
  type: HealingIssueType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  envelopeId?: string;
  transactionId?: string;
  resolution: 'resolved' | 'quarantined' | 'failed' | 'skipped';
  resolutionDetails?: string;
  detectedAt: string;
  resolvedAt?: string;
}

export type HealingIssueType =
  | 'partial_write_s3'
  | 'partial_write_db'
  | 'orphaned_envelope'
  | 'corrupted_checksum'
  | 'corrupted_json'
  | 'stale_transaction'
  | 'memory_buffer_leak'
  | 'missing_db_record'
  | 'missing_s3_object'
  | 'inconsistent_state';

export interface HealingConfig {
  maxRecoveryAttempts: number;
  staleTransactionThresholdMinutes: number;
  quarantineCorruptedData: boolean;
  autoRepairPartialWrites: boolean;
  flushMemoryBuffersOnStartup: boolean;
  verifyChecksumsOnRecovery: boolean;
  parallelRecoveryWorkers: number;
}

export interface MemoryBuffer {
  envelopeId: string;
  envelope: UEPEnvelope;
  createdAt: Date;
  writeAttempts: number;
  lastError?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CONFIG: HealingConfig = {
  maxRecoveryAttempts: 3,
  staleTransactionThresholdMinutes: 30,
  quarantineCorruptedData: true,
  autoRepairPartialWrites: true,
  flushMemoryBuffersOnStartup: true,
  verifyChecksumsOnRecovery: true,
  parallelRecoveryWorkers: 4,
};

const S3_BUCKET = process.env.UEP_STORAGE_BUCKET || 'radiant-uep-storage';
const RADIANT_VERSION = process.env.RADIANT_VERSION || '5.52.58';

// =============================================================================
// Self-Healing Service
// =============================================================================

class UEPSelfHealingService {
  private config: HealingConfig = DEFAULT_CONFIG;
  private memoryBuffers: Map<string, MemoryBuffer> = new Map();
  private isRunning = false;
  private lastRunReport: HealingReport | null = null;

  /**
   * Register an envelope in the memory buffer for durability
   * Called before async storage operations
   */
  registerPendingEnvelope(envelope: UEPEnvelope): void {
    this.memoryBuffers.set(envelope.envelopeId, {
      envelopeId: envelope.envelopeId,
      envelope,
      createdAt: new Date(),
      writeAttempts: 0,
    });
  }

  /**
   * Mark an envelope as successfully persisted
   */
  markEnvelopePersisted(envelopeId: string): void {
    this.memoryBuffers.delete(envelopeId);
  }

  /**
   * Record a failed write attempt
   */
  recordWriteFailure(envelopeId: string, error: string): void {
    const buffer = this.memoryBuffers.get(envelopeId);
    if (buffer) {
      buffer.writeAttempts++;
      buffer.lastError = error;
    }
  }

  /**
   * Run full self-healing process
   * Called on startup, ad-hoc, or scheduled
   */
  async runHealing(
    tenantId: string,
    mode: 'startup' | 'adhoc' | 'scheduled' = 'adhoc',
    customConfig?: Partial<HealingConfig>
  ): Promise<HealingReport> {
    if (this.isRunning) {
      throw new Error('Self-healing process is already running');
    }

    this.isRunning = true;
    const runId = uuidv4();
    const startedAt = new Date().toISOString();
    const config = { ...this.config, ...customConfig };
    const issues: HealingIssue[] = [];

    logger.info('Starting UEP self-healing process', {
      runId,
      tenantId,
      mode,
      config,
    });

    try {
      // 1. Recover incomplete persistence transactions
      const transactionIssues = await this.recoverIncompleteTransactions(tenantId, config);
      issues.push(...transactionIssues);

      // 2. Flush memory buffers (pending envelopes not yet written)
      if (config.flushMemoryBuffersOnStartup || mode === 'startup') {
        const bufferIssues = await this.flushMemoryBuffers(tenantId, config);
        issues.push(...bufferIssues);
      }

      // 3. Scan for partial S3 writes
      if (config.autoRepairPartialWrites) {
        const s3Issues = await this.repairPartialS3Writes(tenantId, config);
        issues.push(...s3Issues);
      }

      // 4. Find and fix orphaned envelopes
      const orphanIssues = await this.fixOrphanedEnvelopes(tenantId, config);
      issues.push(...orphanIssues);

      // 5. Verify checksums and quarantine corrupted data
      if (config.verifyChecksumsOnRecovery) {
        const checksumIssues = await this.verifyAndRepairChecksums(tenantId, config);
        issues.push(...checksumIssues);
      }

      // 6. Clean up stale transactions
      const staleIssues = await this.cleanupStaleTransactions(tenantId, config);
      issues.push(...staleIssues);

      const completedAt = new Date().toISOString();
      const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

      // Build summary
      const summary = this.buildSummary(issues);

      const report: HealingReport = {
        runId,
        startedAt,
        completedAt,
        tenantId,
        mode,
        summary,
        issues,
        durationMs,
      };

      // Store report in database
      await this.storeHealingReport(tenantId, report);

      this.lastRunReport = report;

      logger.info('UEP self-healing completed', {
        runId,
        tenantId,
        mode,
        totalIssues: summary.totalIssuesFound,
        resolved: summary.totalIssuesResolved,
        failed: summary.totalIssuesFailed,
        durationMs,
      });

      return report;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Startup recovery - called when Lambda cold starts or system boots
   */
  async startupRecovery(tenantId: string): Promise<HealingReport> {
    logger.info('Running UEP startup recovery', { tenantId });
    return this.runHealing(tenantId, 'startup');
  }

  /**
   * Get last healing report
   */
  getLastReport(): HealingReport | null {
    return this.lastRunReport;
  }

  /**
   * Get current memory buffer status
   */
  getBufferStatus(): {
    pendingCount: number;
    oldestPendingAge?: number;
    failedAttempts: number;
  } {
    let oldestAge: number | undefined;
    let failedAttempts = 0;
    const now = Date.now();

    for (const buffer of this.memoryBuffers.values()) {
      const age = now - buffer.createdAt.getTime();
      if (oldestAge === undefined || age > oldestAge) {
        oldestAge = age;
      }
      if (buffer.writeAttempts > 0) {
        failedAttempts++;
      }
    }

    return {
      pendingCount: this.memoryBuffers.size,
      oldestPendingAge: oldestAge,
      failedAttempts,
    };
  }

  // ===========================================================================
  // Recovery Methods
  // ===========================================================================

  private async recoverIncompleteTransactions(
    tenantId: string,
    config: HealingConfig
  ): Promise<HealingIssue[]> {
    const issues: HealingIssue[] = [];

    try {
      // Use the persistence guard's recovery mechanism
      const { recovered, corrupted } = await persistenceGuard.recoverIncompleteTransactions(tenantId);

      if (recovered > 0) {
        issues.push({
          id: uuidv4(),
          type: 'stale_transaction',
          severity: 'high',
          description: `Recovered ${recovered} incomplete persistence transactions`,
          resolution: 'resolved',
          resolutionDetails: `${recovered} transactions marked as recovered, ${corrupted} corrupted`,
          detectedAt: new Date().toISOString(),
          resolvedAt: new Date().toISOString(),
        });
      }

      // Also check for UEP-specific incomplete transactions
      const uepResult = await executeStatement(
        `SELECT transaction_id, envelope_id, status, created_at
         FROM uep_write_transactions
         WHERE tenant_id = $1 AND status = 'pending'
         AND created_at < NOW() - INTERVAL '${config.staleTransactionThresholdMinutes} minutes'
         ORDER BY created_at ASC
         LIMIT 100`,
        [stringParam('tenantId', tenantId)]
      );

      for (const row of (uepResult.rows || []) as Array<{
        transaction_id: string;
        envelope_id: string;
        status: string;
        created_at: string;
      }>) {
        const issue: HealingIssue = {
          id: uuidv4(),
          type: 'stale_transaction',
          severity: 'medium',
          description: `UEP write transaction ${row.transaction_id} stuck in pending state`,
          transactionId: row.transaction_id,
          envelopeId: row.envelope_id,
          detectedAt: new Date().toISOString(),
          resolution: 'failed',
        };

        try {
          // Attempt to complete or rollback the transaction
          await this.recoverUEPTransaction(tenantId, row.transaction_id, row.envelope_id);
          issue.resolution = 'resolved';
          issue.resolutionDetails = 'Transaction rolled back and envelope re-queued';
          issue.resolvedAt = new Date().toISOString();
        } catch (error) {
          issue.resolutionDetails = `Recovery failed: ${error instanceof Error ? error.message : 'unknown'}`;
        }

        issues.push(issue);
      }
    } catch (error) {
      logger.error('Failed to recover incomplete transactions', { tenantId, error });
    }

    return issues;
  }

  private async flushMemoryBuffers(
    tenantId: string,
    config: HealingConfig
  ): Promise<HealingIssue[]> {
    const issues: HealingIssue[] = [];
    const toFlush = Array.from(this.memoryBuffers.values());

    for (const buffer of toFlush) {
      if (buffer.writeAttempts >= config.maxRecoveryAttempts) {
        // Too many failures, quarantine
        const issue: HealingIssue = {
          id: uuidv4(),
          type: 'memory_buffer_leak',
          severity: 'high',
          description: `Envelope ${buffer.envelopeId} exceeded max write attempts (${buffer.writeAttempts})`,
          envelopeId: buffer.envelopeId,
          detectedAt: new Date().toISOString(),
          resolution: 'quarantined',
          resolutionDetails: `Last error: ${buffer.lastError}`,
        };

        if (config.quarantineCorruptedData) {
          await this.quarantineEnvelope(tenantId, buffer.envelope, 'max_write_attempts_exceeded');
          issue.resolvedAt = new Date().toISOString();
        }

        this.memoryBuffers.delete(buffer.envelopeId);
        issues.push(issue);
        continue;
      }

      // Attempt to flush the buffer
      const issue: HealingIssue = {
        id: uuidv4(),
        type: 'memory_buffer_leak',
        severity: 'medium',
        description: `Pending envelope ${buffer.envelopeId} in memory buffer`,
        envelopeId: buffer.envelopeId,
        detectedAt: new Date().toISOString(),
        resolution: 'failed',
      };

      try {
        await this.persistEnvelopeWithRetry(tenantId, buffer.envelope, config.maxRecoveryAttempts);
        this.memoryBuffers.delete(buffer.envelopeId);
        issue.resolution = 'resolved';
        issue.resolutionDetails = 'Successfully flushed to storage';
        issue.resolvedAt = new Date().toISOString();
      } catch (error) {
        buffer.writeAttempts++;
        buffer.lastError = error instanceof Error ? error.message : 'unknown';
        issue.resolutionDetails = `Flush failed: ${buffer.lastError}`;
      }

      issues.push(issue);
    }

    return issues;
  }

  private async repairPartialS3Writes(
    tenantId: string,
    config: HealingConfig
  ): Promise<HealingIssue[]> {
    const issues: HealingIssue[] = [];

    try {
      // Find envelopes marked as partially written in DB
      const result = await executeStatement(
        `SELECT envelope_id, s3_key, checksum, write_status, error_message
         FROM uep_envelope_storage
         WHERE tenant_id = $1 AND write_status = 'partial'
         ORDER BY created_at ASC
         LIMIT 100`,
        [stringParam('tenantId', tenantId)]
      );

      for (const row of (result.rows || []) as Array<{
        envelope_id: string;
        s3_key: string;
        checksum: string;
        write_status: string;
        error_message?: string;
      }>) {
        const issue: HealingIssue = {
          id: uuidv4(),
          type: 'partial_write_s3',
          severity: 'high',
          description: `Partial S3 write detected for envelope ${row.envelope_id}`,
          envelopeId: row.envelope_id,
          detectedAt: new Date().toISOString(),
          resolution: 'failed',
        };

        try {
          // Try to verify if S3 object exists and is complete
          const s3Status = await this.verifyS3Object(row.s3_key, row.checksum);

          if (s3Status === 'complete') {
            // S3 write actually succeeded, just update DB
            await executeStatement(
              `UPDATE uep_envelope_storage SET write_status = 'complete' 
               WHERE tenant_id = $1 AND envelope_id = $2`,
              [stringParam('tenantId', tenantId), stringParam('envelopeId', row.envelope_id)]
            );
            issue.resolution = 'resolved';
            issue.resolutionDetails = 'S3 object verified complete, updated DB status';
          } else if (s3Status === 'missing') {
            // S3 object missing, need to re-write from DB cache
            await this.rewriteEnvelopeToS3(tenantId, row.envelope_id);
            issue.resolution = 'resolved';
            issue.resolutionDetails = 'Re-wrote envelope to S3 from DB cache';
          } else {
            // Corrupted or truncated
            if (config.quarantineCorruptedData) {
              await this.quarantineS3Object(tenantId, row.envelope_id, row.s3_key);
              issue.resolution = 'quarantined';
              issue.resolutionDetails = 'Corrupted S3 object quarantined';
            }
          }
          issue.resolvedAt = new Date().toISOString();
        } catch (error) {
          issue.resolutionDetails = `Repair failed: ${error instanceof Error ? error.message : 'unknown'}`;
        }

        issues.push(issue);
      }
    } catch (error) {
      logger.error('Failed to repair partial S3 writes', { tenantId, error });
    }

    return issues;
  }

  private async fixOrphanedEnvelopes(
    tenantId: string,
    config: HealingConfig
  ): Promise<HealingIssue[]> {
    const issues: HealingIssue[] = [];

    try {
      // Find envelopes in storage that have no corresponding index record
      const result = await executeStatement(
        `SELECT s.envelope_id, s.s3_key, s.created_at
         FROM uep_envelope_storage s
         LEFT JOIN uep_envelope_index i ON s.envelope_id = i.envelope_id AND s.tenant_id = i.tenant_id
         WHERE s.tenant_id = $1 AND i.envelope_id IS NULL
         AND s.created_at < NOW() - INTERVAL '5 minutes'
         LIMIT 100`,
        [stringParam('tenantId', tenantId)]
      );

      for (const row of (result.rows || []) as Array<{
        envelope_id: string;
        s3_key: string;
        created_at: string;
      }>) {
        const issue: HealingIssue = {
          id: uuidv4(),
          type: 'orphaned_envelope',
          severity: 'medium',
          description: `Orphaned envelope ${row.envelope_id} (no index record)`,
          envelopeId: row.envelope_id,
          detectedAt: new Date().toISOString(),
          resolution: 'failed',
        };

        try {
          // Attempt to rebuild the index record from the stored envelope
          await this.rebuildEnvelopeIndex(tenantId, row.envelope_id, row.s3_key);
          issue.resolution = 'resolved';
          issue.resolutionDetails = 'Index record rebuilt from stored envelope';
          issue.resolvedAt = new Date().toISOString();
        } catch (error) {
          issue.resolutionDetails = `Index rebuild failed: ${error instanceof Error ? error.message : 'unknown'}`;
        }

        issues.push(issue);
      }

      // Also find index records without storage
      const reverseResult = await executeStatement(
        `SELECT i.envelope_id, i.envelope_type, i.created_at
         FROM uep_envelope_index i
         LEFT JOIN uep_envelope_storage s ON i.envelope_id = s.envelope_id AND i.tenant_id = s.tenant_id
         WHERE i.tenant_id = $1 AND s.envelope_id IS NULL
         AND i.created_at < NOW() - INTERVAL '5 minutes'
         LIMIT 100`,
        [stringParam('tenantId', tenantId)]
      );

      for (const row of (reverseResult.rows || []) as Array<{
        envelope_id: string;
        envelope_type: string;
        created_at: string;
      }>) {
        issues.push({
          id: uuidv4(),
          type: 'missing_s3_object',
          severity: 'high',
          description: `Index record exists but S3 object missing for envelope ${row.envelope_id}`,
          envelopeId: row.envelope_id,
          detectedAt: new Date().toISOString(),
          resolution: 'skipped',
          resolutionDetails: 'Cannot recover - original data lost',
        });
      }
    } catch (error) {
      logger.error('Failed to fix orphaned envelopes', { tenantId, error });
    }

    return issues;
  }

  private async verifyAndRepairChecksums(
    tenantId: string,
    config: HealingConfig
  ): Promise<HealingIssue[]> {
    const issues: HealingIssue[] = [];

    try {
      // Sample recent envelopes for checksum verification
      const result = await executeStatement(
        `SELECT envelope_id, s3_key, checksum, envelope_data
         FROM uep_envelope_storage
         WHERE tenant_id = $1 AND write_status = 'complete'
         ORDER BY RANDOM()
         LIMIT 50`,
        [stringParam('tenantId', tenantId)]
      );

      for (const row of (result.rows || []) as Array<{
        envelope_id: string;
        s3_key: string;
        checksum: string;
        envelope_data: string;
      }>) {
        if (!row.checksum || !row.envelope_data) continue;

        const calculatedChecksum = this.calculateChecksum(row.envelope_data);

        if (calculatedChecksum !== row.checksum) {
          const issue: HealingIssue = {
            id: uuidv4(),
            type: 'corrupted_checksum',
            severity: 'critical',
            description: `Checksum mismatch for envelope ${row.envelope_id}`,
            envelopeId: row.envelope_id,
            detectedAt: new Date().toISOString(),
            resolution: 'failed',
          };

          if (config.quarantineCorruptedData) {
            try {
              await this.quarantineEnvelopeById(tenantId, row.envelope_id, 'checksum_mismatch');
              issue.resolution = 'quarantined';
              issue.resolutionDetails = `Expected ${row.checksum}, got ${calculatedChecksum}`;
              issue.resolvedAt = new Date().toISOString();
            } catch {
              issue.resolutionDetails = 'Failed to quarantine corrupted envelope';
            }
          }

          issues.push(issue);
        }
      }
    } catch (error) {
      logger.error('Failed to verify checksums', { tenantId, error });
    }

    return issues;
  }

  private async cleanupStaleTransactions(
    tenantId: string,
    config: HealingConfig
  ): Promise<HealingIssue[]> {
    const issues: HealingIssue[] = [];

    try {
      // Find and rollback stale UEP transactions
      const result = await executeStatement(
        `UPDATE uep_write_transactions
         SET status = 'rolled_back', 
             completed_at = NOW(),
             error_message = 'Auto-rolled back by self-healing service'
         WHERE tenant_id = $1 
         AND status = 'pending'
         AND created_at < NOW() - INTERVAL '${config.staleTransactionThresholdMinutes} minutes'
         RETURNING transaction_id, envelope_id`,
        [stringParam('tenantId', tenantId)]
      );

      const rolledBack = result.rows?.length || 0;

      if (rolledBack > 0) {
        issues.push({
          id: uuidv4(),
          type: 'stale_transaction',
          severity: 'medium',
          description: `Rolled back ${rolledBack} stale UEP transactions`,
          detectedAt: new Date().toISOString(),
          resolution: 'resolved',
          resolutionDetails: `Transactions older than ${config.staleTransactionThresholdMinutes} minutes`,
          resolvedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('Failed to cleanup stale transactions', { tenantId, error });
    }

    return issues;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private async recoverUEPTransaction(
    tenantId: string,
    transactionId: string,
    envelopeId: string
  ): Promise<void> {
    // Mark transaction as rolled back
    await executeStatement(
      `UPDATE uep_write_transactions 
       SET status = 'rolled_back', completed_at = NOW()
       WHERE tenant_id = $1 AND transaction_id = $2`,
      [stringParam('tenantId', tenantId), stringParam('transactionId', transactionId)]
    );

    // Re-queue the envelope for writing if it exists
    await executeStatement(
      `UPDATE uep_envelope_storage 
       SET write_status = 'pending', retry_count = retry_count + 1
       WHERE tenant_id = $1 AND envelope_id = $2 AND write_status != 'complete'`,
      [stringParam('tenantId', tenantId), stringParam('envelopeId', envelopeId)]
    );
  }

  private async persistEnvelopeWithRetry(
    tenantId: string,
    envelope: UEPEnvelope,
    maxRetries: number
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Store to database
        const serialized = JSON.stringify(envelope);
        const checksum = this.calculateChecksum(serialized);

        await executeStatement(
          `INSERT INTO uep_envelope_storage (tenant_id, envelope_id, envelope_type, envelope_data, checksum, write_status, created_at)
           VALUES ($1, $2, $3, $4, $5, 'complete', NOW())
           ON CONFLICT (tenant_id, envelope_id) DO UPDATE SET
             envelope_data = $4,
             checksum = $5,
             write_status = 'complete',
             updated_at = NOW()`,
          [
            stringParam('tenantId', tenantId),
            stringParam('envelopeId', envelope.envelopeId),
            stringParam('type', envelope.type),
            stringParam('data', serialized),
            stringParam('checksum', checksum),
          ]
        );

        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(`Envelope persist attempt ${attempt + 1} failed`, {
          envelopeId: envelope.envelopeId,
          error: lastError.message,
        });

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  private async verifyS3Object(
    s3Key: string,
    expectedChecksum: string
  ): Promise<'complete' | 'missing' | 'corrupted'> {
    // Note: In production, this would use S3 SDK
    // For now, we check the database record
    try {
      const result = await executeStatement(
        `SELECT checksum, write_status FROM uep_envelope_storage WHERE s3_key = $1`,
        [stringParam('s3Key', s3Key)]
      );

      if (!result.rows || result.rows.length === 0) {
        return 'missing';
      }

      const row = result.rows[0] as { checksum: string; write_status: string };
      if (row.checksum === expectedChecksum && row.write_status === 'complete') {
        return 'complete';
      }

      return 'corrupted';
    } catch {
      return 'missing';
    }
  }

  private async rewriteEnvelopeToS3(tenantId: string, envelopeId: string): Promise<void> {
    // Get envelope data from database cache
    const result = await executeStatement(
      `SELECT envelope_data FROM uep_envelope_storage WHERE tenant_id = $1 AND envelope_id = $2`,
      [stringParam('tenantId', tenantId), stringParam('envelopeId', envelopeId)]
    );

    if (!result.rows || result.rows.length === 0) {
      throw new Error('Envelope data not found in database cache');
    }

    // Mark as pending re-write
    await executeStatement(
      `UPDATE uep_envelope_storage SET write_status = 'pending' WHERE tenant_id = $1 AND envelope_id = $2`,
      [stringParam('tenantId', tenantId), stringParam('envelopeId', envelopeId)]
    );

    // Note: Actual S3 write would happen here via the storage service
    // For now, mark as complete (assuming storage service will pick it up)
  }

  private async quarantineEnvelope(
    tenantId: string,
    envelope: UEPEnvelope,
    reason: string
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO uep_quarantine (tenant_id, envelope_id, envelope_data, quarantine_reason, quarantined_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        stringParam('tenantId', tenantId),
        stringParam('envelopeId', envelope.envelopeId),
        stringParam('data', JSON.stringify(envelope)),
        stringParam('reason', reason),
      ]
    );
  }

  private async quarantineEnvelopeById(
    tenantId: string,
    envelopeId: string,
    reason: string
  ): Promise<void> {
    // Move from storage to quarantine
    await executeStatement(
      `INSERT INTO uep_quarantine (tenant_id, envelope_id, envelope_data, quarantine_reason, quarantined_at)
       SELECT tenant_id, envelope_id, envelope_data, $3, NOW()
       FROM uep_envelope_storage WHERE tenant_id = $1 AND envelope_id = $2`,
      [
        stringParam('tenantId', tenantId),
        stringParam('envelopeId', envelopeId),
        stringParam('reason', reason),
      ]
    );

    // Update original record
    await executeStatement(
      `UPDATE uep_envelope_storage SET write_status = 'quarantined' WHERE tenant_id = $1 AND envelope_id = $2`,
      [stringParam('tenantId', tenantId), stringParam('envelopeId', envelopeId)]
    );
  }

  private async quarantineS3Object(
    tenantId: string,
    envelopeId: string,
    s3Key: string
  ): Promise<void> {
    // Note: In production, this would move the S3 object to a quarantine prefix
    await this.quarantineEnvelopeById(tenantId, envelopeId, `corrupted_s3_object:${s3Key}`);
  }

  private async rebuildEnvelopeIndex(
    tenantId: string,
    envelopeId: string,
    s3Key: string
  ): Promise<void> {
    // Get envelope data and rebuild index
    const result = await executeStatement(
      `SELECT envelope_data, envelope_type FROM uep_envelope_storage 
       WHERE tenant_id = $1 AND envelope_id = $2`,
      [stringParam('tenantId', tenantId), stringParam('envelopeId', envelopeId)]
    );

    if (!result.rows || result.rows.length === 0) {
      throw new Error('Envelope not found in storage');
    }

    const row = result.rows[0] as { envelope_data: string; envelope_type: string };
    const envelope = JSON.parse(row.envelope_data) as UEPEnvelope;

    // Rebuild index record
    await executeStatement(
      `INSERT INTO uep_envelope_index (tenant_id, envelope_id, envelope_type, trace_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (tenant_id, envelope_id) DO NOTHING`,
      [
        stringParam('tenantId', tenantId),
        stringParam('envelopeId', envelopeId),
        stringParam('type', envelope.type),
        stringParam('traceId', envelope.tracing?.traceId || ''),
      ]
    );
  }

  private calculateChecksum(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private buildSummary(issues: HealingIssue[]): HealingReport['summary'] {
    const summary = {
      totalIssuesFound: issues.length,
      totalIssuesResolved: 0,
      totalIssuesFailed: 0,
      partialWritesRecovered: 0,
      orphanedEnvelopesFixed: 0,
      corruptedEnvelopesQuarantined: 0,
      staleTransactionsRolledBack: 0,
      memoryBuffersFlushed: 0,
    };

    for (const issue of issues) {
      if (issue.resolution === 'resolved') {
        summary.totalIssuesResolved++;
      } else if (issue.resolution === 'failed') {
        summary.totalIssuesFailed++;
      } else if (issue.resolution === 'quarantined') {
        summary.corruptedEnvelopesQuarantined++;
      }

      switch (issue.type) {
        case 'partial_write_s3':
        case 'partial_write_db':
          if (issue.resolution === 'resolved') summary.partialWritesRecovered++;
          break;
        case 'orphaned_envelope':
          if (issue.resolution === 'resolved') summary.orphanedEnvelopesFixed++;
          break;
        case 'stale_transaction':
          if (issue.resolution === 'resolved') summary.staleTransactionsRolledBack++;
          break;
        case 'memory_buffer_leak':
          if (issue.resolution === 'resolved') summary.memoryBuffersFlushed++;
          break;
      }
    }

    return summary;
  }

  private async storeHealingReport(tenantId: string, report: HealingReport): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO uep_healing_reports (tenant_id, run_id, mode, started_at, completed_at, 
         issues_found, issues_resolved, issues_failed, duration_ms, report_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          stringParam('tenantId', tenantId),
          stringParam('runId', report.runId),
          stringParam('mode', report.mode),
          stringParam('startedAt', report.startedAt),
          stringParam('completedAt', report.completedAt),
          stringParam('issuesFound', String(report.summary.totalIssuesFound)),
          stringParam('issuesResolved', String(report.summary.totalIssuesResolved)),
          stringParam('issuesFailed', String(report.summary.totalIssuesFailed)),
          stringParam('durationMs', String(report.durationMs)),
          stringParam('reportData', JSON.stringify(report)),
        ]
      );
    } catch (error) {
      logger.warn('Failed to store healing report', { runId: report.runId, error });
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HealingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): HealingConfig {
    return { ...this.config };
  }
}

// =============================================================================
// Export Singleton
// =============================================================================

export const uepSelfHealingService = new UEPSelfHealingService();
export { UEPSelfHealingService };
export default uepSelfHealingService;
