/**
 * RADIANT v4.18.0 - Data Lake Lifecycle Lambda
 *
 * Scheduled: Every hour via EventBridge
 * Purpose: Discover new Firehose partitions, transition storage tiers,
 *          expire data past retention, process Glacier deletion queue,
 *          apply Object Lock, update Glue partitions, publish metrics.
 */

import { ScheduledHandler } from 'aws-lambda';
import { Pool } from 'pg';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';
import { DataLakeLifecycleManagerService } from '../shared/services/data-lake-lifecycle-manager.service';
import { flushEventBuffer } from '../shared/services/event-firehose.service';

const logger = createRegisteredLogger({
  serviceName: 'scheduled/data-lake-lifecycle',
  category: 'infrastructure',
  sourceType: 'lambda',
});

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'radiant',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

export const handler: ScheduledHandler = async (_event): Promise<void> => {
  logger.info('Starting data lake lifecycle cycle');

  try {
    const lifecycleManager = new DataLakeLifecycleManagerService(getPool());
    const result = await lifecycleManager.runLifecycleCycle();

    logger.info('Data lake lifecycle cycle complete', {
      partitionsRegistered: result.partitionsRegistered,
      hotToWarm: result.hotToWarm,
      warmToCold: result.warmToCold,
      coldToGlacier: result.coldToGlacier,
      glacierToDeep: result.glacierToDeep,
      s3ObjectsExpired: result.s3ObjectsExpired,
      glacierDeletionsQueued: result.glacierDeletionsQueued,
      glacierDeletionsExecuted: result.glacierDeletionsExecuted,
      objectLocksApplied: result.objectLocksApplied,
      gluePartitionsAdded: result.gluePartitionsAdded,
      errors: result.errors.length,
      durationMs: result.durationMs,
    });

    if (result.errors.length > 0) {
      logger.warn('Lifecycle cycle completed with errors', {
        errors: result.errors.slice(0, 10), // Cap at 10 to avoid log bloat
      });
    }
  } catch (error) {
    logger.error('Data lake lifecycle cycle failed', error as Error);
    throw error; // Let Lambda retry via EventBridge
  } finally {
    await flushEventBuffer();
  }
};
