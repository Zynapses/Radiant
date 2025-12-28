/**
 * RADIANT v4.18.0 - Database Transaction Utilities
 * 
 * Provides transaction wrappers for multi-step database operations
 * to ensure atomicity and consistency.
 */

import { executeStatement } from './client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';

export interface TransactionContext {
  transactionId: string;
  startedAt: Date;
}

export class TransactionError extends Error {
  constructor(
    message: string,
    public readonly transactionId: string,
    public readonly step: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}

/**
 * Execute multiple database operations within a transaction
 * All operations succeed or all are rolled back
 */
export async function withTransaction<T>(
  operations: (ctx: TransactionContext) => Promise<T>,
  options?: { timeout?: number; label?: string }
): Promise<T> {
  const transactionId = `txn_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 9)}`;
  const ctx: TransactionContext = {
    transactionId,
    startedAt: new Date(),
  };

  const label = options?.label || 'unnamed';
  
  try {
    // Begin transaction
    await executeStatement('BEGIN', []);
    logger.debug('Transaction started', { transactionId, label });

    // Execute operations
    const result = await operations(ctx);

    // Commit transaction
    await executeStatement('COMMIT', []);
    logger.debug('Transaction committed', { 
      transactionId, 
      label,
      durationMs: Date.now() - ctx.startedAt.getTime() 
    });

    return result;
  } catch (error) {
    // Rollback transaction
    try {
      await executeStatement('ROLLBACK', []);
      logger.warn('Transaction rolled back', { 
        transactionId, 
        label,
        error: error instanceof Error ? error.message : 'unknown' 
      });
    } catch (rollbackError) {
      logger.error('Transaction rollback failed', { 
        transactionId, 
        label,
        originalError: error instanceof Error ? error.message : 'unknown',
        rollbackError: rollbackError instanceof Error ? rollbackError.message : 'unknown'
      });
    }

    throw error;
  }
}

/**
 * Execute a series of steps atomically
 * Each step is named for better error reporting
 */
export async function executeAtomicSteps<T>(
  steps: Array<{
    name: string;
    execute: () => Promise<unknown>;
  }>,
  finalResult: () => T
): Promise<T> {
  return withTransaction(async (ctx) => {
    for (const step of steps) {
      try {
        await step.execute();
        logger.debug('Transaction step completed', { 
          transactionId: ctx.transactionId, 
          step: step.name 
        });
      } catch (error) {
        throw new TransactionError(
          `Transaction failed at step: ${step.name}`,
          ctx.transactionId,
          step.name,
          error instanceof Error ? error : undefined
        );
      }
    }
    return finalResult();
  }, { label: steps.map(s => s.name).join('->') });
}

/**
 * Retry a transaction on serialization failure
 */
export async function withRetryableTransaction<T>(
  operations: (ctx: TransactionContext) => Promise<T>,
  options?: { maxRetries?: number; label?: string }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withTransaction(operations, options);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if it's a serialization failure that can be retried
      const isRetryable = lastError.message.includes('could not serialize') ||
                          lastError.message.includes('deadlock detected') ||
                          lastError.message.includes('concurrent update');
      
      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }

      logger.warn('Retrying transaction due to serialization conflict', {
        attempt,
        maxRetries,
        label: options?.label,
        error: lastError.message,
      });

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
    }
  }

  throw lastError || new Error('Transaction failed after retries');
}

/**
 * Create a savepoint within a transaction for partial rollback
 */
export async function withSavepoint<T>(
  name: string,
  operations: () => Promise<T>
): Promise<T> {
  await executeStatement(`SAVEPOINT ${name}`, []);
  
  try {
    const result = await operations();
    await executeStatement(`RELEASE SAVEPOINT ${name}`, []);
    return result;
  } catch (error) {
    await executeStatement(`ROLLBACK TO SAVEPOINT ${name}`, []);
    throw error;
  }
}
