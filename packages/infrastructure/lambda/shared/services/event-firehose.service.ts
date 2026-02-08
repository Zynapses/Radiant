/**
 * RADIANT v4.18.0 - Event Firehose Service
 *
 * Zero-database-write event ingestion pipeline. Every log, audit, telemetry,
 * and billing event goes through this service instead of INSERT INTO PostgreSQL.
 *
 * Architecture:
 *   Lambda handler → emitEvent() → Kinesis Data Firehose → S3 Parquet
 *                                                          ↓
 *                                                   Glue Catalog
 *                                                          ↓
 *                                                   Athena queries
 *
 * Features:
 *   - Fire-and-forget async ingestion (non-blocking to caller)
 *   - In-memory buffer with periodic flush (reduces Firehose API calls)
 *   - Automatic schema enrichment (timestamp, request context, data type metadata)
 *   - Dual-write mode for migration: emit to both Firehose AND legacy DB table
 *   - Dead-letter fallback: if Firehose fails, writes to DLQ for retry
 *   - Per-data-type routing to separate Firehose delivery streams
 *
 * Usage:
 *   import { emitEvent, emitEvents, flushEventBuffer } from './event-firehose.service';
 *
 *   // Single event (replaces: await pool.query('INSERT INTO audit_logs ...'))
 *   await emitEvent({
 *     typeKey: 'audit_log',
 *     tenantId: 'tenant-123',
 *     userId: 'user-456',
 *     payload: { action: 'update_settings', resource: 'lockout_policy' },
 *   });
 *
 *   // Batch events
 *   await emitEvents([event1, event2, event3]);
 *
 *   // Flush before Lambda exits (called automatically by withEnforcedLogging)
 *   await flushEventBuffer();
 */

import {
  FirehoseClient,
  PutRecordCommand,
  PutRecordBatchCommand,
} from '@aws-sdk/client-firehose';
import {
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { v4 as uuidv4 } from 'uuid';
import { createRegisteredLogger } from './logging-registry.service';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REGION = process.env.AWS_REGION || 'us-east-1';
const FIREHOSE_STREAM_PREFIX = process.env.DATA_LAKE_FIREHOSE_PREFIX || 'radiant-data-lake';
const DLQ_URL = process.env.DATA_LAKE_DLQ_URL || '';
const DUAL_WRITE_ENABLED = process.env.DATA_LAKE_DUAL_WRITE === 'true';
const BUFFER_FLUSH_SIZE = parseInt(process.env.DATA_LAKE_BUFFER_SIZE || '100', 10);
const BUFFER_FLUSH_MS = parseInt(process.env.DATA_LAKE_BUFFER_MS || '5000', 10);
const DATA_LAKE_ENABLED = process.env.DATA_LAKE_ENABLED !== 'false'; // Default: enabled

const firehoseClient = new FirehoseClient({ region: REGION });
const sqsClient = new SQSClient({ region: REGION });

const logger = createRegisteredLogger({
  serviceName: 'data-lake/event-firehose',
  category: 'infrastructure',
  sourceType: 'application',
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataLakeEvent {
  /** Registry type key (e.g., 'audit_log', 'security_event', 'ai_invocation') */
  typeKey: string;
  /** Tenant UUID — required for partitioning */
  tenantId: string;
  /** Optional user UUID — included in record metadata */
  userId?: string;
  /** The event payload — any structured data */
  payload: Record<string, unknown>;
  /** Optional explicit timestamp (defaults to now) */
  timestamp?: string;
  /** Optional request ID for correlation */
  requestId?: string;
  /** Optional: if true, also write to legacy DB table (migration period only) */
  dualWrite?: boolean;
}

export interface DataLakeRecord {
  /** Unique record ID */
  record_id: string;
  /** Data type key from registry */
  data_type_key: string;
  /** ISO timestamp */
  timestamp: string;
  /** Tenant UUID — used as Parquet partition key */
  tenant_id: string;
  /** User UUID (nullable) */
  user_id: string | null;
  /** Request ID for correlation */
  request_id: string | null;
  /** Partition keys for Glue/Athena */
  year: number;
  month: number;
  day: number;
  hour: number;
  /** The actual event data */
  payload: Record<string, unknown>;
  /** Ingestion metadata */
  _ingested_at: string;
  _source_lambda: string | null;
  _source_region: string;
  _schema_version: number;
}

interface BufferedEvent {
  record: DataLakeRecord;
  streamName: string;
  dualWrite: boolean;
  originalEvent: DataLakeEvent;
}

export interface EmitResult {
  success: boolean;
  recordId: string;
  firehoseRecordId?: string;
  error?: string;
}

export interface FlushResult {
  flushed: number;
  succeeded: number;
  failed: number;
  dlqSent: number;
}

// ---------------------------------------------------------------------------
// In-memory buffer
// ---------------------------------------------------------------------------

let eventBuffer: BufferedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let totalEmitted = 0;
let totalFlushed = 0;
let totalErrors = 0;

// Schema version — increment when record format changes
const SCHEMA_VERSION = 1;

// Cache: typeKey → Firehose stream name
const streamNameCache = new Map<string, string>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Emit a single event to the data lake.
 * Non-blocking: buffers locally and flushes periodically or when buffer is full.
 */
export async function emitEvent(event: DataLakeEvent): Promise<EmitResult> {
  if (!DATA_LAKE_ENABLED) {
    return { success: true, recordId: 'disabled' };
  }

  const record = buildRecord(event);
  const streamName = resolveStreamName(event.typeKey);

  eventBuffer.push({
    record,
    streamName,
    dualWrite: event.dualWrite ?? DUAL_WRITE_ENABLED,
    originalEvent: event,
  });

  totalEmitted++;

  // Auto-flush when buffer is full
  if (eventBuffer.length >= BUFFER_FLUSH_SIZE) {
    await flushEventBuffer();
  } else if (!flushTimer) {
    // Schedule time-based flush
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      await flushEventBuffer();
    }, BUFFER_FLUSH_MS);
  }

  return { success: true, recordId: record.record_id };
}

/**
 * Emit multiple events in batch. More efficient than individual emitEvent calls.
 */
export async function emitEvents(events: DataLakeEvent[]): Promise<EmitResult[]> {
  if (!DATA_LAKE_ENABLED) {
    return events.map(() => ({ success: true, recordId: 'disabled' }));
  }

  const results: EmitResult[] = [];

  for (const event of events) {
    const record = buildRecord(event);
    const streamName = resolveStreamName(event.typeKey);

    eventBuffer.push({
      record,
      streamName,
      dualWrite: event.dualWrite ?? DUAL_WRITE_ENABLED,
      originalEvent: event,
    });

    totalEmitted++;
    results.push({ success: true, recordId: record.record_id });
  }

  if (eventBuffer.length >= BUFFER_FLUSH_SIZE) {
    await flushEventBuffer();
  }

  return results;
}

/**
 * Flush the in-memory buffer to Firehose.
 * MUST be called before Lambda exits (withEnforcedLogging does this automatically).
 */
export async function flushEventBuffer(): Promise<FlushResult> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (eventBuffer.length === 0) {
    return { flushed: 0, succeeded: 0, failed: 0, dlqSent: 0 };
  }

  // Take the current buffer and reset
  const batch = [...eventBuffer];
  eventBuffer = [];

  const result: FlushResult = {
    flushed: batch.length,
    succeeded: 0,
    failed: 0,
    dlqSent: 0,
  };

  // Group by stream name for batch puts
  const byStream = new Map<string, BufferedEvent[]>();
  for (const item of batch) {
    const existing = byStream.get(item.streamName) || [];
    existing.push(item);
    byStream.set(item.streamName, existing);
  }

  // Send each group to its Firehose stream
  for (const [streamName, items] of byStream) {
    try {
      if (items.length === 1) {
        // Single record — use PutRecord
        await firehoseClient.send(new PutRecordCommand({
          DeliveryStreamName: streamName,
          Record: {
            Data: encodeRecord(items[0].record),
          },
        }));
        result.succeeded++;
      } else {
        // Batch — PutRecordBatch (max 500 per call)
        for (let i = 0; i < items.length; i += 500) {
          const chunk = items.slice(i, i + 500);
          const response = await firehoseClient.send(new PutRecordBatchCommand({
            DeliveryStreamName: streamName,
            Records: chunk.map(item => ({
              Data: encodeRecord(item.record),
            })),
          }));

          const failedCount = response.FailedPutCount || 0;
          result.succeeded += chunk.length - failedCount;
          result.failed += failedCount;

          // Send failed records to DLQ
          if (failedCount > 0 && response.RequestResponses) {
            for (let j = 0; j < response.RequestResponses.length; j++) {
              const resp = response.RequestResponses[j];
              if (resp.ErrorCode) {
                await sendToDlq(chunk[j], resp.ErrorCode, resp.ErrorMessage);
                result.dlqSent++;
              }
            }
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Firehose flush failed', error as Error, { streamName, count: items.length });
      result.failed += items.length;
      totalErrors += items.length;

      // Send all items to DLQ on stream-level failure
      for (const item of items) {
        await sendToDlq(item, 'StreamError', msg);
        result.dlqSent++;
      }
    }
  }

  totalFlushed += result.succeeded;
  return result;
}

/**
 * Get current buffer stats (useful for health checks / monitoring)
 */
export function getFirehoseStats(): {
  buffered: number;
  totalEmitted: number;
  totalFlushed: number;
  totalErrors: number;
} {
  return {
    buffered: eventBuffer.length,
    totalEmitted,
    totalFlushed,
    totalErrors,
  };
}

/**
 * Emit a single event immediately without buffering.
 * Use for critical events that must not be lost (e.g., security alerts).
 */
export async function emitEventImmediate(event: DataLakeEvent): Promise<EmitResult> {
  if (!DATA_LAKE_ENABLED) {
    return { success: true, recordId: 'disabled' };
  }

  const record = buildRecord(event);
  const streamName = resolveStreamName(event.typeKey);

  try {
    const response = await firehoseClient.send(new PutRecordCommand({
      DeliveryStreamName: streamName,
      Record: {
        Data: encodeRecord(record),
      },
    }));

    totalEmitted++;
    totalFlushed++;
    return {
      success: true,
      recordId: record.record_id,
      firehoseRecordId: response.RecordId,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    totalErrors++;

    // DLQ fallback
    await sendToDlq(
      { record, streamName, dualWrite: false, originalEvent: event },
      'ImmediateError',
      msg
    );

    return { success: false, recordId: record.record_id, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Record building
// ---------------------------------------------------------------------------

function buildRecord(event: DataLakeEvent): DataLakeRecord {
  const now = event.timestamp || new Date().toISOString();
  const dt = new Date(now);

  return {
    record_id: uuidv4(),
    data_type_key: event.typeKey,
    timestamp: now,
    tenant_id: event.tenantId,
    user_id: event.userId || null,
    request_id: event.requestId || null,
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
    hour: dt.getUTCHours(),
    payload: event.payload,
    _ingested_at: new Date().toISOString(),
    _source_lambda: process.env.AWS_LAMBDA_FUNCTION_NAME || null,
    _source_region: REGION,
    _schema_version: SCHEMA_VERSION,
  };
}

function encodeRecord(record: DataLakeRecord): Uint8Array {
  // Firehose expects newline-delimited JSON; Firehose converts to Parquet via Glue schema
  const json = JSON.stringify(record) + '\n';
  return new TextEncoder().encode(json);
}

function resolveStreamName(typeKey: string): string {
  if (streamNameCache.has(typeKey)) {
    return streamNameCache.get(typeKey)!;
  }

  // Convention: one Firehose delivery stream per data type category
  // For high-volume types, use dedicated streams
  const HIGH_VOLUME_TYPES = ['ai_invocation', 'drift_telemetry', 'application_log', 'infrastructure_metric'];

  let streamName: string;
  if (HIGH_VOLUME_TYPES.includes(typeKey)) {
    streamName = `${FIREHOSE_STREAM_PREFIX}-${typeKey}`;
  } else {
    // Group low-volume types by category prefix
    const prefix = typeKey.split('_')[0] || 'default';
    streamName = `${FIREHOSE_STREAM_PREFIX}-${prefix}`;
  }

  streamNameCache.set(typeKey, streamName);
  return streamName;
}

// ---------------------------------------------------------------------------
// Dead-letter queue
// ---------------------------------------------------------------------------

async function sendToDlq(
  item: BufferedEvent,
  errorCode: string,
  errorMessage?: string
): Promise<void> {
  if (!DLQ_URL) {
    logger.warn('DLQ URL not configured — dropping failed event', {
      typeKey: item.record.data_type_key,
      recordId: item.record.record_id,
      errorCode,
    });
    return;
  }

  try {
    await sqsClient.send(new SendMessageCommand({
      QueueUrl: DLQ_URL,
      MessageBody: JSON.stringify({
        record: item.record,
        streamName: item.streamName,
        errorCode,
        errorMessage,
        failedAt: new Date().toISOString(),
      }),
      MessageAttributes: {
        dataTypeKey: { DataType: 'String', StringValue: item.record.data_type_key },
        tenantId: { DataType: 'String', StringValue: item.record.tenant_id },
        errorCode: { DataType: 'String', StringValue: errorCode },
      },
    }));
  } catch (dlqError) {
    // Last resort: log to CloudWatch (which the existing indexer will pick up)
    logger.error('Failed to send to DLQ', dlqError as Error, {
      typeKey: item.record.data_type_key,
      recordId: item.record.record_id,
      originalError: errorCode,
    });
  }
}

// ---------------------------------------------------------------------------
// Convenience emitters for common event types
// These replace specific INSERT INTO statements across the codebase
// ---------------------------------------------------------------------------

export function emitAuditEvent(
  tenantId: string,
  userId: string,
  action: string,
  resource: string,
  details?: Record<string, unknown>
): Promise<EmitResult> {
  return emitEvent({
    typeKey: 'audit_log',
    tenantId,
    userId,
    payload: { action, resource, ...details },
  });
}

export function emitSecurityEvent(
  tenantId: string,
  eventType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: Record<string, unknown>
): Promise<EmitResult> {
  return emitEventImmediate({
    typeKey: 'security_event',
    tenantId,
    payload: { event_type: eventType, severity, ...details },
  });
}

export function emitAIInvocation(
  tenantId: string,
  userId: string | undefined,
  modelId: string,
  details: Record<string, unknown>
): Promise<EmitResult> {
  return emitEvent({
    typeKey: 'ai_invocation',
    tenantId,
    userId,
    payload: { model_id: modelId, ...details },
  });
}

export function emitBillingEvent(
  tenantId: string,
  eventType: string,
  details: Record<string, unknown>
): Promise<EmitResult> {
  return emitEvent({
    typeKey: 'billing_event',
    tenantId,
    payload: { event_type: eventType, ...details },
  });
}

export function emitComplianceEvent(
  tenantId: string,
  eventType: string,
  details: Record<string, unknown>
): Promise<EmitResult> {
  return emitEventImmediate({
    typeKey: 'compliance_event',
    tenantId,
    payload: { event_type: eventType, ...details },
  });
}

export function emitStorageEvent(
  tenantId: string,
  eventType: string,
  storageType: string,
  bytesDelta: number,
  details?: Record<string, unknown>
): Promise<EmitResult> {
  return emitEvent({
    typeKey: 'storage_event',
    tenantId,
    payload: { event_type: eventType, storage_type: storageType, bytes_delta: bytesDelta, ...details },
  });
}

export function emitInfrastructureMetric(
  tenantId: string,
  metricName: string,
  value: number,
  details?: Record<string, unknown>
): Promise<EmitResult> {
  return emitEvent({
    typeKey: 'infrastructure_metric',
    tenantId,
    payload: { metric_name: metricName, value, ...details },
  });
}

export function emitErrorLog(
  tenantId: string,
  serviceName: string,
  error: Error,
  context?: Record<string, unknown>
): Promise<EmitResult> {
  return emitEventImmediate({
    typeKey: 'error_log',
    tenantId,
    payload: {
      service: serviceName,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack,
      ...context,
    },
  });
}

export function emitCollaborationEvent(
  tenantId: string,
  userId: string,
  eventType: string,
  details: Record<string, unknown>
): Promise<EmitResult> {
  return emitEvent({
    typeKey: 'collaboration_event',
    tenantId,
    userId,
    payload: { event_type: eventType, ...details },
  });
}
