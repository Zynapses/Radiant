/**
 * Idempotency Service
 * 
 * RADIANT v5.2.1 - Production Hardening
 * 
 * Ensures that critical operations (especially billing) can be safely retried
 * without causing duplicate effects. Uses idempotency keys to track and dedupe
 * operations.
 * 
 * Usage:
 *   const result = await idempotencyService.executeWithIdempotency(
 *     'purchase-credits',
 *     idempotencyKey,
 *     () => billingService.purchaseCredits(tenantId, amount, price)
 *   );
 */

import { executeStatement } from '../db/client';
import { logger } from '../logger';

// ============================================================================
// Types
// ============================================================================

export interface IdempotencyRecord {
  idempotencyKey: string;
  operationType: string;
  tenantId: string;
  status: 'pending' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  expiresAt: Date;
}

export interface IdempotencyOptions {
  /** Time-to-live for idempotency records in seconds (default: 86400 = 24 hours) */
  ttlSeconds?: number;
  /** Whether to throw on duplicate vs return cached result (default: false) */
  throwOnDuplicate?: boolean;
  /** Tenant ID for scoping (required for multi-tenant) */
  tenantId: string;
}

export class IdempotencyConflictError extends Error {
  readonly isIdempotencyConflict = true;
  
  constructor(
    message: string,
    public readonly idempotencyKey: string,
    public readonly existingStatus: string
  ) {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

// ============================================================================
// Idempotency Service
// ============================================================================

export class IdempotencyService {
  private readonly defaultTtlSeconds = 86400; // 24 hours

  /**
   * Execute an operation with idempotency protection.
   * 
   * If the operation was previously completed with the same key,
   * returns the cached result instead of re-executing.
   * 
   * @param operationType Category of operation (e.g., 'purchase-credits')
   * @param idempotencyKey Unique key for this operation (usually from client)
   * @param operation The async function to execute
   * @param options Configuration options
   * @returns The result of the operation (or cached result)
   */
  async executeWithIdempotency<T>(
    operationType: string,
    idempotencyKey: string,
    operation: () => Promise<T>,
    options: IdempotencyOptions
  ): Promise<T> {
    const { tenantId, ttlSeconds = this.defaultTtlSeconds, throwOnDuplicate = false } = options;

    // Check for existing record
    const existing = await this.getIdempotencyRecord(idempotencyKey, tenantId);

    if (existing) {
      logger.info('Idempotency key already exists', {
        idempotencyKey,
        operationType,
        tenantId,
        existingStatus: existing.status,
      });

      if (existing.status === 'completed') {
        // Return cached result
        return existing.result as T;
      }

      if (existing.status === 'pending') {
        // Operation still in progress - conflict
        if (throwOnDuplicate) {
          throw new IdempotencyConflictError(
            `Operation with idempotency key '${idempotencyKey}' is already in progress`,
            idempotencyKey,
            existing.status
          );
        }
        // Wait and retry check
        await this.sleep(1000);
        return this.executeWithIdempotency(operationType, idempotencyKey, operation, options);
      }

      if (existing.status === 'failed') {
        // Previous attempt failed - allow retry by deleting old record
        await this.deleteIdempotencyRecord(idempotencyKey, tenantId);
      }
    }

    // Create pending record
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.createIdempotencyRecord(idempotencyKey, operationType, tenantId, expiresAt);

    try {
      // Execute the operation
      const result = await operation();

      // Mark as completed with result
      await this.completeIdempotencyRecord(idempotencyKey, tenantId, result);

      logger.info('Idempotent operation completed', {
        idempotencyKey,
        operationType,
        tenantId,
      });

      return result;
    } catch (error) {
      // Mark as failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.failIdempotencyRecord(idempotencyKey, tenantId, errorMessage);

      logger.error('Idempotent operation failed', {
        idempotencyKey,
        operationType,
        tenantId,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Check if an operation with the given key has already been completed.
   */
  async isOperationCompleted(idempotencyKey: string, tenantId: string): Promise<boolean> {
    const record = await this.getIdempotencyRecord(idempotencyKey, tenantId);
    return record?.status === 'completed';
  }

  /**
   * Get the result of a previously completed operation.
   */
  async getCompletedResult<T>(idempotencyKey: string, tenantId: string): Promise<T | null> {
    const record = await this.getIdempotencyRecord(idempotencyKey, tenantId);
    if (record?.status === 'completed') {
      return record.result as T;
    }
    return null;
  }

  /**
   * Manually invalidate an idempotency key (for admin use).
   */
  async invalidateKey(idempotencyKey: string, tenantId: string): Promise<void> {
    await this.deleteIdempotencyRecord(idempotencyKey, tenantId);
    logger.info('Idempotency key invalidated', { idempotencyKey, tenantId });
  }

  /**
   * Clean up expired idempotency records.
   * Should be called periodically (e.g., daily via EventBridge).
   */
  async cleanupExpiredRecords(): Promise<number> {
    const result = await executeStatement(
      `DELETE FROM idempotency_keys WHERE expires_at < NOW() RETURNING idempotency_key`,
      []
    );
    
    const deletedCount = result.rows.length;
    logger.info('Cleaned up expired idempotency records', { deletedCount });
    return deletedCount;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async getIdempotencyRecord(
    idempotencyKey: string,
    tenantId: string
  ): Promise<IdempotencyRecord | null> {
    const result = await executeStatement(
      `SELECT * FROM idempotency_keys 
       WHERE idempotency_key = $1 AND tenant_id = $2 AND expires_at > NOW()`,
      [
        { name: 'idempotencyKey', value: { stringValue: idempotencyKey } },
        { name: 'tenantId', value: { stringValue: tenantId } },
      ]
    );

    if (result.rows.length === 0) return null;

    const r = result.rows[0] as Record<string, unknown>;
    return {
      idempotencyKey: String(r.idempotency_key),
      operationType: String(r.operation_type),
      tenantId: String(r.tenant_id),
      status: r.status as 'pending' | 'completed' | 'failed',
      result: r.result ? JSON.parse(String(r.result)) : undefined,
      error: r.error ? String(r.error) : undefined,
      createdAt: new Date(String(r.created_at)),
      completedAt: r.completed_at ? new Date(String(r.completed_at)) : undefined,
      expiresAt: new Date(String(r.expires_at)),
    };
  }

  private async createIdempotencyRecord(
    idempotencyKey: string,
    operationType: string,
    tenantId: string,
    expiresAt: Date
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO idempotency_keys (idempotency_key, operation_type, tenant_id, status, expires_at)
       VALUES ($1, $2, $3, 'pending', $4)
       ON CONFLICT (idempotency_key, tenant_id) DO NOTHING`,
      [
        { name: 'idempotencyKey', value: { stringValue: idempotencyKey } },
        { name: 'operationType', value: { stringValue: operationType } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'expiresAt', value: { stringValue: expiresAt.toISOString() } },
      ]
    );
  }

  private async completeIdempotencyRecord(
    idempotencyKey: string,
    tenantId: string,
    result: unknown
  ): Promise<void> {
    await executeStatement(
      `UPDATE idempotency_keys 
       SET status = 'completed', result = $3, completed_at = NOW()
       WHERE idempotency_key = $1 AND tenant_id = $2`,
      [
        { name: 'idempotencyKey', value: { stringValue: idempotencyKey } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'result', value: { stringValue: JSON.stringify(result) } },
      ]
    );
  }

  private async failIdempotencyRecord(
    idempotencyKey: string,
    tenantId: string,
    error: string
  ): Promise<void> {
    await executeStatement(
      `UPDATE idempotency_keys 
       SET status = 'failed', error = $3, completed_at = NOW()
       WHERE idempotency_key = $1 AND tenant_id = $2`,
      [
        { name: 'idempotencyKey', value: { stringValue: idempotencyKey } },
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'error', value: { stringValue: error } },
      ]
    );
  }

  private async deleteIdempotencyRecord(
    idempotencyKey: string,
    tenantId: string
  ): Promise<void> {
    await executeStatement(
      `DELETE FROM idempotency_keys WHERE idempotency_key = $1 AND tenant_id = $2`,
      [
        { name: 'idempotencyKey', value: { stringValue: idempotencyKey } },
        { name: 'tenantId', value: { stringValue: tenantId } },
      ]
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let idempotencyInstance: IdempotencyService | null = null;

export function getIdempotencyService(): IdempotencyService {
  if (!idempotencyInstance) {
    idempotencyInstance = new IdempotencyService();
  }
  return idempotencyInstance;
}

export const idempotencyService = getIdempotencyService();

// ============================================================================
// Decorator for Easy Use
// ============================================================================

/**
 * Extract idempotency key from request headers or body.
 */
export function extractIdempotencyKey(
  headers: Record<string, string | undefined>,
  body?: { idempotencyKey?: string }
): string | null {
  // Check header first (standard pattern)
  const headerKey = headers['idempotency-key'] || headers['Idempotency-Key'] || headers['x-idempotency-key'];
  if (headerKey) return headerKey;

  // Check body
  if (body?.idempotencyKey) return body.idempotencyKey;

  return null;
}

/**
 * Generate a unique idempotency key.
 */
export function generateIdempotencyKey(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}
