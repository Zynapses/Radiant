/**
 * RADIANT v4.18.0 - Data Lake DLQ Processor Lambda
 *
 * Triggered: SQS messages from the data lake dead-letter queue
 * Purpose: Retry failed Firehose events. If a record has failed multiple times,
 *          log it permanently and discard to avoid infinite loops.
 */

import { SQSHandler, SQSRecord } from 'aws-lambda';
import {
  FirehoseClient,
  PutRecordCommand,
} from '@aws-sdk/client-firehose';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';
import { flushEventBuffer, emitEvent } from '../shared/services/event-firehose.service';

const REGION = process.env.AWS_REGION || 'us-east-1';
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const FIREHOSE_PREFIX = process.env.DATA_LAKE_FIREHOSE_PREFIX || 'radiant-data-lake';
const MAX_RETRY_ATTEMPTS = 3;

const firehoseClient = new FirehoseClient({ region: REGION });

const logger = createRegisteredLogger({
  serviceName: 'scheduled/data-lake-dlq-processor',
  category: 'infrastructure',
  sourceType: 'lambda',
});

interface DLQRecord {
  streamName?: string;
  dataTypeKey?: string;
  tenantId?: string;
  originalPayload?: string;
  retryCount?: number;
  firstFailedAt?: string;
  lastError?: string;
}

function parseDLQRecord(record: SQSRecord): DLQRecord {
  try {
    const body = JSON.parse(record.body);
    return {
      streamName: body.streamName || body.deliveryStreamName,
      dataTypeKey: body.dataTypeKey || body.data_type_key,
      tenantId: body.tenantId || body.tenant_id,
      originalPayload: body.originalPayload || body.payload || record.body,
      retryCount: body.retryCount || parseInt(record.attributes?.ApproximateReceiveCount || '1', 10),
      firstFailedAt: body.firstFailedAt || record.attributes?.SentTimestamp,
      lastError: body.lastError || body.error,
    };
  } catch {
    return {
      originalPayload: record.body,
      retryCount: parseInt(record.attributes?.ApproximateReceiveCount || '1', 10),
    };
  }
}

function resolveStreamName(dlqRecord: DLQRecord): string | null {
  if (dlqRecord.streamName) return dlqRecord.streamName;
  if (!dlqRecord.dataTypeKey) return null;

  // Map data type keys to stream names
  const highVolumeTypes = ['ai_invocation', 'drift_telemetry', 'application_log', 'infrastructure_metric'];
  if (highVolumeTypes.includes(dlqRecord.dataTypeKey)) {
    return `${FIREHOSE_PREFIX}-${dlqRecord.dataTypeKey}-${ENVIRONMENT}`;
  }

  // Group mappings
  const groupMap: Record<string, string> = {
    audit_log: 'audit', license_audit: 'audit', log_retention_audit: 'audit',
    uds_audit: 'audit', system_admin_audit: 'audit',
    security_event: 'security', intrusion_event: 'security', lockout_event: 'security',
    compliance_event: 'compliance', guest_restriction: 'compliance',
    billing_event: 'billing', cost_attribution: 'billing', storage_event: 'billing',
    collaboration_event: 'collaboration',
    error_log: 'error',
    delight_event: 'delight',
    brain_plan: 'brain',
  };

  const group = groupMap[dlqRecord.dataTypeKey];
  if (group) return `${FIREHOSE_PREFIX}-${group}-${ENVIRONMENT}`;

  return null;
}

export const handler: SQSHandler = async (event): Promise<void> => {
  logger.info('DLQ processor invoked', { recordCount: event.Records.length });

  let retried = 0;
  let discarded = 0;
  let failed = 0;

  for (const record of event.Records) {
    const dlqRecord = parseDLQRecord(record);

    // If retried too many times, log permanently and discard
    if ((dlqRecord.retryCount || 0) >= MAX_RETRY_ATTEMPTS) {
      logger.error('DLQ record exceeded max retries, discarding', new Error('Max retries exceeded'), {
        tenantId: dlqRecord.tenantId,
        dataTypeKey: dlqRecord.dataTypeKey,
        retryCount: dlqRecord.retryCount,
        firstFailedAt: dlqRecord.firstFailedAt,
        lastError: dlqRecord.lastError,
        payloadPreview: (dlqRecord.originalPayload || '').slice(0, 500),
      });
      discarded++;
      continue;
    }

    // Resolve the Firehose stream name
    const streamName = resolveStreamName(dlqRecord);
    if (!streamName) {
      logger.warn('Cannot resolve Firehose stream for DLQ record, discarding', {
        tenantId: dlqRecord.tenantId,
        dataTypeKey: dlqRecord.dataTypeKey,
      });
      discarded++;
      continue;
    }

    // Retry: send back to Firehose
    try {
      await firehoseClient.send(new PutRecordCommand({
        DeliveryStreamName: streamName,
        Record: {
          Data: Buffer.from(dlqRecord.originalPayload || ''),
        },
      }));
      retried++;
    } catch (error) {
      logger.error('DLQ retry failed', error as Error, {
        streamName,
        tenantId: dlqRecord.tenantId,
        dataTypeKey: dlqRecord.dataTypeKey,
      });
      failed++;
      // Don't throw — process remaining records, SQS will retry the failed ones
    }
  }

  logger.info('DLQ processing complete', { retried, discarded, failed });

  await flushEventBuffer();
};
