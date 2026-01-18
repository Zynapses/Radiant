/**
 * RADIANT v5.12.2 - S3 Orphan Cleanup Lambda
 * 
 * Scheduled Lambda (EventBridge) to clean up orphaned S3 objects
 * when their source database records are deleted.
 * 
 * Schedule: Every 5 minutes via EventBridge rule
 */

import { ScheduledHandler } from 'aws-lambda';
import { s3ContentOffloadService } from '../shared/services/s3-content-offload.service';
import { executeStatement } from '../shared/utils/db';
import { logger } from '../shared/utils/logger';

interface CleanupResult {
  orphans_deleted: number;
  orphans_failed: number;
  expired_caches_cleaned: number;
  duration_ms: number;
}

export const handler: ScheduledHandler = async (event) => {
  const startTime = Date.now();
  logger.info('S3 orphan cleanup started', { event });

  const result: CleanupResult = {
    orphans_deleted: 0,
    orphans_failed: 0,
    expired_caches_cleaned: 0,
    duration_ms: 0,
  };

  try {
    // 1. Process orphan deletion queue
    const orphanResult = await s3ContentOffloadService.processOrphanQueue(100);
    result.orphans_deleted = orphanResult.processed;
    result.orphans_failed = orphanResult.failed;

    // 2. Clean up expired learning caches (from session persistence)
    try {
      const cacheResult = await executeStatement(
        `SELECT cleanup_expired_learning_caches() as deleted_count`,
        []
      );
      if (cacheResult.rows && cacheResult.rows.length > 0) {
        result.expired_caches_cleaned = (cacheResult.rows[0] as { deleted_count: number }).deleted_count;
      }
    } catch (error) {
      logger.warn('Failed to cleanup learning caches', { error });
    }

    // 3. Clean up old completed/failed orphan records (older than 30 days)
    try {
      await executeStatement(
        `DELETE FROM s3_orphan_queue 
         WHERE deletion_status IN ('completed', 'failed') 
         AND deleted_at < NOW() - INTERVAL '30 days'`,
        []
      );
    } catch (error) {
      logger.warn('Failed to cleanup old orphan records', { error });
    }

    result.duration_ms = Date.now() - startTime;

    logger.info('S3 orphan cleanup completed', result);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error('S3 orphan cleanup failed', { error });
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        ...result,
        duration_ms: Date.now() - startTime,
      }),
    };
  }
};
