/**
 * RADIANT v4.18.0 - Retention Reconciler Lambda
 *
 * Triggered: SQS messages from compliance license changes or admin overrides
 * Purpose: Re-evaluate retention policies when compliance requirements change,
 *          extend/shorten retention, apply/remove Object Lock, cancel Glacier deletes.
 */

import { SQSHandler, SQSRecord } from 'aws-lambda';
import { Pool } from 'pg';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';
import {
  RetentionReconcilerService,
  ReconciliationRequest,
} from '../shared/services/retention-reconciler.service';
import { flushEventBuffer } from '../shared/services/event-firehose.service';

const logger = createRegisteredLogger({
  serviceName: 'scheduled/retention-reconciler',
  category: 'compliance',
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
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

interface ReconcilerMessage {
  tenantId: string;
  dataTypeId?: string;
  triggerType: ReconciliationRequest['triggerType'];
  triggerDetail?: string;
  performedBy: string;
}

function parseMessage(record: SQSRecord): ReconcilerMessage {
  const body = JSON.parse(record.body);

  // Support SNS-wrapped messages (from EventBridge → SNS → SQS)
  const payload = body.Message ? JSON.parse(body.Message) : body;

  if (!payload.tenantId || !payload.triggerType) {
    throw new Error(`Invalid reconciler message: missing tenantId or triggerType. Body: ${record.body.slice(0, 200)}`);
  }

  return {
    tenantId: payload.tenantId,
    dataTypeId: payload.dataTypeId || undefined,
    triggerType: payload.triggerType,
    triggerDetail: payload.triggerDetail || undefined,
    performedBy: payload.performedBy || 'system',
  };
}

export const handler: SQSHandler = async (event): Promise<void> => {
  logger.info('Retention reconciler invoked', { recordCount: event.Records.length });

  const reconciler = new RetentionReconcilerService(getPool());

  for (const record of event.Records) {
    try {
      const message = parseMessage(record);

      logger.info('Processing reconciliation request', {
        tenantId: message.tenantId,
        triggerType: message.triggerType,
        dataTypeId: message.dataTypeId || 'all',
      });

      const result = await reconciler.reconcile({
        tenantId: message.tenantId,
        dataTypeId: message.dataTypeId,
        triggerType: message.triggerType,
        triggerDetail: message.triggerDetail,
        performedBy: message.performedBy,
      });

      logger.info('Reconciliation complete', {
        tenantId: result.tenantId,
        dataTypesEvaluated: result.dataTypesEvaluated,
        retentionExtended: result.retentionExtended,
        retentionShortened: result.retentionShortened,
        objectsQueuedForDeletion: result.objectsQueuedForDeletion,
        objectLocksApplied: result.objectLocksApplied,
        glacierDeletesCancelled: result.glacierDeletesCancelled,
        errors: result.errors.length,
        durationMs: result.durationMs,
      });

      if (result.errors.length > 0) {
        logger.warn('Reconciliation completed with errors', {
          tenantId: result.tenantId,
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error('Failed to process reconciliation record', error as Error, {
        messageId: record.messageId,
      });
      // Throw to trigger SQS retry → DLQ after maxReceiveCount
      throw error;
    }
  }

  await flushEventBuffer();
};
