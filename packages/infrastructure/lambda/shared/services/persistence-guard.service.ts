/**
 * RADIANT v5.12.4 - Persistence Guard Service
 * 
 * GLOBAL ENFORCEMENT of data completeness for all persistent memory structures.
 * Ensures atomic writes with integrity checks to prevent partial data on reboot.
 * 
 * ALL persistent memory operations MUST use this service - NO EXCEPTIONS.
 * 
 * Features:
 * - Atomic transactions with rollback on failure
 * - SHA-256 checksum validation
 * - Write-ahead logging (WAL) for crash recovery
 * - Corruption detection on restore
 * - Mandatory validation before commit
 */

import { createHash } from 'crypto';
import { executeStatement, stringParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

// ============================================================================
// Types
// ============================================================================

export interface PersistenceRecord {
  id: string;
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface PersistenceOperation {
  table: string;
  operation: 'insert' | 'update' | 'delete';
  record_id: string;
  data: unknown;
  checksum: string;
}

export interface PersistenceTransaction {
  transaction_id: string;
  operations: PersistenceOperation[];
  status: 'pending' | 'committed' | 'rolled_back' | 'corrupted';
  started_at: Date;
  completed_at?: Date;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  checksum: string;
}

export interface RestoreResult<T> {
  success: boolean;
  data: T | null;
  corrupted: boolean;
  error?: string;
}

// ============================================================================
// Persistence Guard Service
// ============================================================================

class PersistenceGuardService {
  private activeTransactions: Map<string, PersistenceTransaction> = new Map();

  /**
   * Calculate SHA-256 checksum for data integrity verification
   */
  calculateChecksum(data: unknown): string {
    const serialized = JSON.stringify(data, this.deterministicReplacer);
    return createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Deterministic JSON replacer for consistent checksums
   */
  private deterministicReplacer(key: string, value: unknown): unknown {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value as object)
        .sort()
        .reduce((sorted: Record<string, unknown>, k) => {
          sorted[k] = (value as Record<string, unknown>)[k];
          return sorted;
        }, {});
    }
    return value;
  }

  /**
   * Validate data before persistence - MANDATORY
   * Returns validation result with errors if any
   */
  validateForPersistence(data: unknown, schema?: Record<string, string>): ValidationResult {
    const errors: string[] = [];

    // Check for null/undefined
    if (data === null || data === undefined) {
      errors.push('Data cannot be null or undefined');
      return { valid: false, errors, checksum: '' };
    }

    // Check for circular references (would cause JSON.stringify to fail)
    try {
      JSON.stringify(data);
    } catch (e) {
      errors.push('Data contains circular references or is not serializable');
      return { valid: false, errors, checksum: '' };
    }

    // Check for required fields if schema provided
    if (schema && typeof data === 'object') {
      for (const [field, type] of Object.entries(schema)) {
        const value = (data as Record<string, unknown>)[field];
        if (value === undefined) {
          errors.push(`Required field '${field}' is missing`);
        } else if (type === 'string' && typeof value !== 'string') {
          errors.push(`Field '${field}' must be a string`);
        } else if (type === 'number' && typeof value !== 'number') {
          errors.push(`Field '${field}' must be a number`);
        } else if (type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`Field '${field}' must be a boolean`);
        } else if (type === 'object' && (typeof value !== 'object' || value === null)) {
          errors.push(`Field '${field}' must be an object`);
        } else if (type === 'array' && !Array.isArray(value)) {
          errors.push(`Field '${field}' must be an array`);
        }
      }
    }

    const checksum = errors.length === 0 ? this.calculateChecksum(data) : '';
    return { valid: errors.length === 0, errors, checksum };
  }

  /**
   * Begin an atomic persistence transaction
   * All operations within the transaction are committed together or rolled back
   */
  async beginTransaction(tenantId: string): Promise<string> {
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const transaction: PersistenceTransaction = {
      transaction_id: transactionId,
      operations: [],
      status: 'pending',
      started_at: new Date(),
    };

    this.activeTransactions.set(transactionId, transaction);

    // Write to WAL
    await this.writeToWAL(tenantId, transactionId, 'begin', null);

    logger.debug('Persistence transaction started', { transactionId, tenantId });
    return transactionId;
  }

  /**
   * Add an operation to the transaction
   */
  addOperation(
    transactionId: string,
    table: string,
    operation: 'insert' | 'update' | 'delete',
    recordId: string,
    data: unknown
  ): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== 'pending') {
      throw new Error(`Transaction ${transactionId} is not pending (status: ${transaction.status})`);
    }

    // Validate data before adding
    const validation = this.validateForPersistence(data);
    if (!validation.valid) {
      throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
    }

    transaction.operations.push({
      table,
      operation,
      record_id: recordId,
      data,
      checksum: validation.checksum,
    });
  }

  /**
   * Commit transaction atomically with integrity verification
   */
  async commitTransaction(tenantId: string, transactionId: string): Promise<boolean> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== 'pending') {
      throw new Error(`Transaction ${transactionId} is not pending`);
    }

    if (transaction.operations.length === 0) {
      logger.warn('Empty transaction committed', { transactionId });
      this.activeTransactions.delete(transactionId);
      return true;
    }

    try {
      // Write operations to WAL before committing
      await this.writeToWAL(tenantId, transactionId, 'prepare', transaction.operations);

      // Execute all operations in a single database transaction
      await executeStatement('BEGIN', []);

      try {
        for (const op of transaction.operations) {
          await this.executeOperation(tenantId, op);
        }

        // Verify all checksums after write
        for (const op of transaction.operations) {
          if (op.operation !== 'delete') {
            const verified = await this.verifyChecksum(tenantId, op.table, op.record_id, op.checksum);
            if (!verified) {
              throw new Error(`Checksum verification failed for ${op.table}:${op.record_id}`);
            }
          }
        }

        await executeStatement('COMMIT', []);
        
        // Mark WAL as committed
        await this.writeToWAL(tenantId, transactionId, 'commit', null);

        transaction.status = 'committed';
        transaction.completed_at = new Date();

        logger.info('Persistence transaction committed', { 
          transactionId, 
          operationCount: transaction.operations.length 
        });

        return true;
      } catch (error) {
        await executeStatement('ROLLBACK', []);
        throw error;
      }
    } catch (error) {
      // Write rollback to WAL
      await this.writeToWAL(tenantId, transactionId, 'rollback', { error: String(error) });

      transaction.status = 'rolled_back';
      transaction.completed_at = new Date();

      logger.error('Persistence transaction rolled back', { transactionId, error });
      throw error;
    } finally {
      this.activeTransactions.delete(transactionId);
    }
  }

  /**
   * Rollback a pending transaction
   */
  async rollbackTransaction(tenantId: string, transactionId: string): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      return; // Already cleaned up
    }

    await this.writeToWAL(tenantId, transactionId, 'rollback', { reason: 'explicit' });
    
    transaction.status = 'rolled_back';
    transaction.completed_at = new Date();
    
    this.activeTransactions.delete(transactionId);
    
    logger.info('Persistence transaction rolled back', { transactionId });
  }

  /**
   * Persist a single record atomically (convenience method)
   */
  async persistAtomic<T>(
    tenantId: string,
    table: string,
    recordId: string,
    data: T,
    schema?: Record<string, string>
  ): Promise<boolean> {
    // Validate with schema
    const validation = this.validateForPersistence(data, schema);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const transactionId = await this.beginTransaction(tenantId);
    
    try {
      this.addOperation(transactionId, table, 'update', recordId, data);
      await this.commitTransaction(tenantId, transactionId);
      return true;
    } catch (error) {
      await this.rollbackTransaction(tenantId, transactionId);
      throw error;
    }
  }

  /**
   * Restore data with integrity verification
   */
  async restoreWithValidation<T>(
    tenantId: string,
    table: string,
    recordId: string,
    expectedSchema?: Record<string, string>
  ): Promise<RestoreResult<T>> {
    try {
      const result = await executeStatement(
        `SELECT data, checksum, is_complete FROM persistence_records 
         WHERE tenant_id = $1 AND table_name = $2 AND record_id = $3`,
        [
          stringParam('tenantId', tenantId),
          stringParam('table', table),
          stringParam('recordId', recordId),
        ]
      );

      if (!result.rows || result.rows.length === 0) {
        return { success: false, data: null, corrupted: false, error: 'Record not found' };
      }

      const row = result.rows[0] as { data: string; checksum: string; is_complete: boolean };

      // Check completeness flag
      if (!row.is_complete) {
        logger.error('Incomplete record detected', { table, recordId });
        return { success: false, data: null, corrupted: true, error: 'Record is incomplete (partial write detected)' };
      }

      // Parse and verify checksum
      let data: T;
      try {
        data = JSON.parse(row.data) as T;
      } catch {
        logger.error('Failed to parse stored data', { table, recordId });
        return { success: false, data: null, corrupted: true, error: 'Data is corrupted (parse failed)' };
      }

      const calculatedChecksum = this.calculateChecksum(data);
      if (calculatedChecksum !== row.checksum) {
        logger.error('Checksum mismatch detected', { 
          table, 
          recordId, 
          expected: row.checksum, 
          calculated: calculatedChecksum 
        });
        return { success: false, data: null, corrupted: true, error: 'Data is corrupted (checksum mismatch)' };
      }

      // Validate against schema if provided
      if (expectedSchema) {
        const validation = this.validateForPersistence(data, expectedSchema);
        if (!validation.valid) {
          logger.error('Schema validation failed on restore', { table, recordId, errors: validation.errors });
          return { success: false, data: null, corrupted: true, error: `Schema validation failed: ${validation.errors.join(', ')}` };
        }
      }

      return { success: true, data, corrupted: false };
    } catch (error) {
      logger.error('Failed to restore record', { table, recordId, error });
      return { success: false, data: null, corrupted: false, error: String(error) };
    }
  }

  /**
   * Recover from incomplete transactions on startup
   */
  async recoverIncompleteTransactions(tenantId: string): Promise<{ recovered: number; corrupted: number }> {
    let recovered = 0;
    let corrupted = 0;

    try {
      // Find incomplete transactions from WAL
      const result = await executeStatement(
        `SELECT transaction_id, operations FROM persistence_wal 
         WHERE tenant_id = $1 AND status = 'prepare'
         ORDER BY created_at ASC`,
        [stringParam('tenantId', tenantId)]
      );

      for (const row of (result.rows || []) as Array<{ transaction_id: string; operations: string }>) {
        try {
          // Mark records from incomplete transactions as incomplete
          const operations = JSON.parse(row.operations) as PersistenceOperation[];
          
          for (const op of operations) {
            await executeStatement(
              `UPDATE persistence_records SET is_complete = false 
               WHERE tenant_id = $1 AND table_name = $2 AND record_id = $3`,
              [
                stringParam('tenantId', tenantId),
                stringParam('table', op.table),
                stringParam('recordId', op.record_id),
              ]
            );
          }

          // Mark WAL entry as rolled back
          await executeStatement(
            `UPDATE persistence_wal SET status = 'recovered' WHERE transaction_id = $1`,
            [stringParam('transactionId', row.transaction_id)]
          );

          recovered++;
          logger.warn('Recovered incomplete transaction', { transactionId: row.transaction_id });
        } catch {
          corrupted++;
          logger.error('Failed to recover transaction', { transactionId: row.transaction_id });
        }
      }

      logger.info('Transaction recovery complete', { tenantId, recovered, corrupted });
      return { recovered, corrupted };
    } catch (error) {
      logger.error('Transaction recovery failed', { tenantId, error });
      return { recovered, corrupted };
    }
  }

  /**
   * Get integrity status for all persistent data
   */
  async getIntegrityStatus(tenantId: string): Promise<{
    total_records: number;
    complete_records: number;
    incomplete_records: number;
    corrupted_records: number;
    pending_transactions: number;
  }> {
    const result = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_complete = true) as complete,
        COUNT(*) FILTER (WHERE is_complete = false) as incomplete
       FROM persistence_records WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    const walResult = await executeStatement(
      `SELECT COUNT(*) as pending FROM persistence_wal 
       WHERE tenant_id = $1 AND status = 'prepare'`,
      [stringParam('tenantId', tenantId)]
    );

    const row = (result.rows?.[0] || { total: 0, complete: 0, incomplete: 0 }) as {
      total: string;
      complete: string;
      incomplete: string;
    };

    const pending = (walResult.rows?.[0] as { pending: string })?.pending || '0';

    // Count records with checksum mismatches
    const checksumResult = await executeStatement(
      `SELECT COUNT(*) as corrupted FROM persistence_records 
       WHERE tenant_id = $1 AND is_complete = true`,
      [stringParam('tenantId', tenantId)]
    );

    // Batch verify checksums for corruption detection
    const corruptedResult = await executeStatement(
      `SELECT COUNT(*) as corrupted FROM persistence_records 
       WHERE tenant_id = $1 
       AND is_complete = true 
       AND checksum IS NOT NULL 
       AND checksum != encode(sha256(data::bytea), 'hex')`,
      [stringParam('tenantId', tenantId)]
    );
    const corruptedRow = corruptedResult.rows?.[0] as { corrupted?: string } | undefined;
    const corrupted = corruptedRow?.corrupted || '0';

    return {
      total_records: parseInt(row.total, 10),
      complete_records: parseInt(row.complete, 10),
      incomplete_records: parseInt(row.incomplete, 10),
      corrupted_records: parseInt(corrupted, 10),
      pending_transactions: parseInt(pending, 10),
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async writeToWAL(
    tenantId: string,
    transactionId: string,
    status: string,
    data: unknown
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO persistence_wal (tenant_id, transaction_id, status, operations, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (transaction_id) DO UPDATE SET status = $3, operations = COALESCE($4, persistence_wal.operations)`,
        [
          stringParam('tenantId', tenantId),
          stringParam('transactionId', transactionId),
          stringParam('status', status),
          stringParam('operations', data ? JSON.stringify(data) : ''),
        ]
      );
    } catch (error) {
      logger.error('Failed to write to WAL', { transactionId, status, error });
      throw error;
    }
  }

  private async executeOperation(tenantId: string, op: PersistenceOperation): Promise<void> {
    const serializedData = JSON.stringify(op.data);

    if (op.operation === 'insert' || op.operation === 'update') {
      await executeStatement(
        `INSERT INTO persistence_records (tenant_id, table_name, record_id, data, checksum, is_complete, updated_at)
         VALUES ($1, $2, $3, $4, $5, false, NOW())
         ON CONFLICT (tenant_id, table_name, record_id) DO UPDATE SET
           data = $4,
           checksum = $5,
           is_complete = false,
           updated_at = NOW()`,
        [
          stringParam('tenantId', tenantId),
          stringParam('table', op.table),
          stringParam('recordId', op.record_id),
          stringParam('data', serializedData),
          stringParam('checksum', op.checksum),
        ]
      );
    } else if (op.operation === 'delete') {
      await executeStatement(
        `DELETE FROM persistence_records WHERE tenant_id = $1 AND table_name = $2 AND record_id = $3`,
        [
          stringParam('tenantId', tenantId),
          stringParam('table', op.table),
          stringParam('recordId', op.record_id),
        ]
      );
    }
  }

  private async verifyChecksum(
    tenantId: string,
    table: string,
    recordId: string,
    expectedChecksum: string
  ): Promise<boolean> {
    const result = await executeStatement(
      `SELECT data FROM persistence_records 
       WHERE tenant_id = $1 AND table_name = $2 AND record_id = $3`,
      [
        stringParam('tenantId', tenantId),
        stringParam('table', table),
        stringParam('recordId', recordId),
      ]
    );

    if (!result.rows || result.rows.length === 0) {
      return false;
    }

    const row = result.rows[0] as { data: string };
    const data = JSON.parse(row.data);
    const actualChecksum = this.calculateChecksum(data);

    if (actualChecksum === expectedChecksum) {
      // Mark as complete only after checksum verification
      await executeStatement(
        `UPDATE persistence_records SET is_complete = true 
         WHERE tenant_id = $1 AND table_name = $2 AND record_id = $3`,
        [
          stringParam('tenantId', tenantId),
          stringParam('table', table),
          stringParam('recordId', recordId),
        ]
      );
      return true;
    }

    return false;
  }
}

// Export singleton
export const persistenceGuard = new PersistenceGuardService();

// ============================================================================
// Decorator for enforcing persistence guard usage
// ============================================================================

/**
 * Decorator to enforce atomic persistence on class methods
 * Usage: @requiresAtomicPersistence({ schema: { id: 'string', data: 'object' } })
 */
export function requiresAtomicPersistence(options: { schema?: Record<string, string> } = {}) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const tenantId = (this as { tenantId?: string }).tenantId;
      if (!tenantId) {
        throw new Error('tenantId is required for atomic persistence');
      }

      const transactionId = await persistenceGuard.beginTransaction(tenantId);

      try {
        const result = await originalMethod.apply(this, [...args, transactionId]);
        await persistenceGuard.commitTransaction(tenantId, transactionId);
        return result;
      } catch (error) {
        await persistenceGuard.rollbackTransaction(tenantId, transactionId);
        throw error;
      }
    };

    return descriptor;
  };
}
