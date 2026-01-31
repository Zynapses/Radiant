// RADIANT v5.53.0 - UEP v2.0 Stream Manager Service
// Manages chunked streaming lifecycle with resumable transfers

import { randomUUID } from 'crypto';
import * as crypto from 'crypto';
import { Pool } from 'pg';
import {
  UEPEnvelope,
  UEPStream,
  UEPStreamStatus,
  UEPSourceCard,
  UEPTracingInfo,
  UEPContentReference,
  UEPStreamingInfo,
} from '@radiant/shared';
import { UEPEnvelopeBuilder, UEPFactory } from './envelope-builder.service';

export interface StreamCreateOptions {
  contentType: string;
  totalSizeBytes?: number;
  totalChunks?: number;
  chunkSizeBytes?: number;
  source: UEPSourceCard;
  destinationId?: string;
  destinationType?: UEPSourceCard['sourceType'];
  tracing: UEPTracingInfo;
  timeoutSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface StreamChunkResult {
  envelope: UEPEnvelope;
  stream: UEPStream;
  isComplete: boolean;
}

export interface StreamResumeInfo {
  streamId: string;
  resumeToken: string;
  lastChunkSequence: number;
  lastChunkOffset: number;
  expiresAt: Date;
}

/**
 * UEP v2.0 Stream Manager
 * 
 * Handles the lifecycle of chunked streams:
 * - Stream creation and initialization
 * - Chunk processing and ordering
 * - Progress tracking
 * - Resumable transfer support
 * - Stream completion and artifact finalization
 */
export class UEPStreamManager {
  constructor(private pool: Pool) {}

  /**
   * Create a new stream
   */
  async createStream(
    tenantId: string,
    options: StreamCreateOptions
  ): Promise<{ stream: UEPStream; startEnvelope: UEPEnvelope }> {
    const streamId = randomUUID();
    const resumeToken = this.generateResumeToken();
    const expiresAt = new Date(Date.now() + (options.timeoutSeconds || 3600) * 1000);
    
    const result = await this.pool.query<UEPStream>(
      `INSERT INTO uep_streams (
        stream_id, tenant_id, content_type, total_size_bytes, total_chunks,
        chunk_size_bytes, status, resume_token, resume_expiry,
        source_id, source_type, destination_id, destination_type,
        trace_id, parent_span_id, expires_at, timeout_seconds, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        streamId,
        tenantId,
        options.contentType,
        options.totalSizeBytes,
        options.totalChunks,
        options.chunkSizeBytes || 1048576,
        'active',
        resumeToken,
        new Date(Date.now() + 86400000), // 24 hour resume window
        options.source.sourceId,
        options.source.sourceType,
        options.destinationId,
        options.destinationType,
        options.tracing.traceId,
        options.tracing.parentSpanId,
        expiresAt,
        options.timeoutSeconds || 3600,
        options.metadata ? JSON.stringify(options.metadata) : null,
      ]
    );
    
    const stream = result.rows[0];
    
    // Create stream.start envelope
    const startEnvelope = UEPFactory.streamStart(
      options.source,
      streamId,
      options.contentType,
      options.totalChunks,
      options.totalSizeBytes,
      options.tracing
    );
    
    // Persist the start envelope
    await this.persistEnvelope(tenantId, startEnvelope);
    
    return { stream, startEnvelope };
  }

  /**
   * Process a stream chunk
   */
  async processChunk(
    tenantId: string,
    streamId: string,
    chunkNumber: number,
    chunkData: Buffer,
    source: UEPSourceCard,
    tracing: UEPTracingInfo
  ): Promise<StreamChunkResult> {
    // Get stream info
    const stream = await this.getStream(tenantId, streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }
    
    if (stream.status !== 'active') {
      throw new Error(`Stream ${streamId} is not active (status: ${stream.status})`);
    }
    
    // Validate chunk order if ordering is required
    if (chunkNumber !== stream.lastChunkSequence + 1) {
      throw new Error(
        `Invalid chunk sequence. Expected ${stream.lastChunkSequence + 1}, got ${chunkNumber}`
      );
    }
    
    // Calculate bytes transferred
    const bytesTransferred = stream.lastChunkOffset + chunkData.length;
    const isComplete = stream.totalChunks 
      ? chunkNumber === stream.totalChunks
      : stream.totalSizeBytes 
        ? bytesTransferred >= stream.totalSizeBytes
        : false;
    
    // Update stream state
    await this.pool.query(
      `UPDATE uep_streams SET
        last_chunk_sequence = $1,
        last_chunk_offset = $2,
        last_chunk_at = NOW(),
        status = $3,
        completed_at = CASE WHEN $3 = 'completed' THEN NOW() ELSE NULL END
      WHERE stream_id = $4 AND tenant_id = $5`,
      [
        chunkNumber,
        bytesTransferred,
        isComplete ? 'completed' : 'active',
        streamId,
        tenantId,
      ]
    );
    
    // Create chunk envelope
    const envelope = UEPFactory.streamChunk(
      source,
      streamId,
      chunkNumber,
      stream.totalChunks || undefined,
      chunkData,
      stream.contentType,
      tracing,
      bytesTransferred,
      stream.totalSizeBytes || undefined
    );
    
    // Persist the chunk envelope
    await this.persistEnvelope(tenantId, envelope);
    
    // Get updated stream
    const updatedStream = await this.getStream(tenantId, streamId);
    
    return {
      envelope,
      stream: updatedStream!,
      isComplete,
    };
  }

  /**
   * Complete a stream with final artifact reference
   */
  async completeStream(
    tenantId: string,
    streamId: string,
    artifactRef: UEPContentReference,
    finalHash: { algorithm: 'sha256' | 'sha384' | 'sha512' | 'blake3'; value: string },
    source: UEPSourceCard,
    tracing: UEPTracingInfo
  ): Promise<UEPEnvelope> {
    const stream = await this.getStream(tenantId, streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }
    
    // Update stream with final artifact info
    await this.pool.query(
      `UPDATE uep_streams SET
        status = 'completed',
        completed_at = NOW(),
        final_artifact_uri = $1,
        final_artifact_hash_algorithm = $2,
        final_artifact_hash_value = $3
      WHERE stream_id = $4 AND tenant_id = $5`,
      [
        artifactRef.uri,
        finalHash.algorithm,
        finalHash.value,
        streamId,
        tenantId,
      ]
    );
    
    // Create stream.end envelope
    const endEnvelope = UEPFactory.streamEnd(
      source,
      streamId,
      stream.lastChunkSequence,
      artifactRef,
      stream.contentType,
      stream.totalSizeBytes || stream.lastChunkOffset,
      finalHash,
      tracing
    );
    
    // Persist the end envelope
    await this.persistEnvelope(tenantId, endEnvelope);
    
    // Create artifact registry entry
    await this.registerArtifact(tenantId, endEnvelope, stream, artifactRef, finalHash);
    
    return endEnvelope;
  }

  /**
   * Cancel a stream
   */
  async cancelStream(
    tenantId: string,
    streamId: string,
    reason: string,
    source: UEPSourceCard,
    tracing: UEPTracingInfo
  ): Promise<UEPEnvelope> {
    await this.pool.query(
      `UPDATE uep_streams SET
        status = 'cancelled',
        error_message = $1
      WHERE stream_id = $2 AND tenant_id = $3`,
      [reason, streamId, tenantId]
    );
    
    const envelope = UEPEnvelopeBuilder.create<{ reason: string }>('stream.cancel')
      .setSource(source)
      .setPayloadJson({ reason })
      .setStreamInfo(streamId, -1, undefined, { resumable: false })
      .setTracing(tracing)
      .build();
    
    await this.persistEnvelope(tenantId, envelope);
    
    return envelope;
  }

  /**
   * Report a stream error
   */
  async reportStreamError(
    tenantId: string,
    streamId: string,
    errorCode: string,
    errorMessage: string,
    source: UEPSourceCard,
    tracing: UEPTracingInfo
  ): Promise<UEPEnvelope> {
    await this.pool.query(
      `UPDATE uep_streams SET
        status = 'failed',
        error_code = $1,
        error_message = $2
      WHERE stream_id = $3 AND tenant_id = $4`,
      [errorCode, errorMessage, streamId, tenantId]
    );
    
    const envelope = UEPFactory.error(source, errorCode, errorMessage, tracing, streamId);
    await this.persistEnvelope(tenantId, envelope);
    
    return envelope;
  }

  /**
   * Pause a stream for later resumption
   */
  async pauseStream(tenantId: string, streamId: string): Promise<StreamResumeInfo> {
    const resumeToken = this.generateResumeToken();
    const expiresAt = new Date(Date.now() + 86400000); // 24 hours
    
    const result = await this.pool.query<UEPStream>(
      `UPDATE uep_streams SET
        status = 'paused',
        resume_token = $1,
        resume_expiry = $2
      WHERE stream_id = $3 AND tenant_id = $4
      RETURNING *`,
      [resumeToken, expiresAt, streamId, tenantId]
    );
    
    const stream = result.rows[0];
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }
    
    return {
      streamId,
      resumeToken,
      lastChunkSequence: stream.lastChunkSequence,
      lastChunkOffset: stream.lastChunkOffset,
      expiresAt,
    };
  }

  /**
   * Resume a paused stream
   */
  async resumeStream(
    tenantId: string,
    streamId: string,
    resumeToken: string
  ): Promise<{ stream: UEPStream; resumeFrom: { sequence: number; offset: number } }> {
    const result = await this.pool.query<UEPStream>(
      `SELECT * FROM uep_streams
      WHERE stream_id = $1 AND tenant_id = $2
        AND resume_token = $3 AND resume_expiry > NOW()`,
      [streamId, tenantId, resumeToken]
    );
    
    const stream = result.rows[0];
    if (!stream) {
      throw new Error('Invalid or expired resume token');
    }
    
    // Reactivate stream
    await this.pool.query(
      `UPDATE uep_streams SET status = 'active' WHERE stream_id = $1`,
      [streamId]
    );
    
    return {
      stream: { ...stream, status: 'active' as UEPStreamStatus },
      resumeFrom: {
        sequence: stream.lastChunkSequence,
        offset: stream.lastChunkOffset,
      },
    };
  }

  /**
   * Get stream by ID
   */
  async getStream(tenantId: string, streamId: string): Promise<UEPStream | null> {
    const result = await this.pool.query<UEPStream>(
      `SELECT * FROM uep_streams WHERE stream_id = $1 AND tenant_id = $2`,
      [streamId, tenantId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get stream progress
   */
  async getStreamProgress(tenantId: string, streamId: string): Promise<{
    status: UEPStreamStatus;
    chunksReceived: number;
    totalChunks?: number;
    bytesTransferred: number;
    totalBytes?: number;
    percentComplete: number;
    estimatedRemainingMs?: number;
  } | null> {
    const result = await this.pool.query<{
      status: UEPStreamStatus;
      chunks_received: number;
      total_chunks: number | null;
      bytes_transferred: number;
      total_bytes: number | null;
      percent_complete: number;
      estimated_remaining_ms: number | null;
    }>(
      `SELECT * FROM uep_get_stream_progress($1)`,
      [streamId]
    );
    
    const row = result.rows[0];
    if (!row) return null;
    
    return {
      status: row.status,
      chunksReceived: row.chunks_received,
      totalChunks: row.total_chunks || undefined,
      bytesTransferred: row.bytes_transferred,
      totalBytes: row.total_bytes || undefined,
      percentComplete: row.percent_complete,
      estimatedRemainingMs: row.estimated_remaining_ms || undefined,
    };
  }

  /**
   * List active streams for tenant
   */
  async listActiveStreams(
    tenantId: string,
    limit = 50,
    offset = 0
  ): Promise<{ streams: UEPStream[]; total: number }> {
    const [streamsResult, countResult] = await Promise.all([
      this.pool.query<UEPStream>(
        `SELECT * FROM uep_streams
        WHERE tenant_id = $1 AND status = 'active'
        ORDER BY started_at DESC
        LIMIT $2 OFFSET $3`,
        [tenantId, limit, offset]
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*) FROM uep_streams WHERE tenant_id = $1 AND status = 'active'`,
        [tenantId]
      ),
    ]);
    
    return {
      streams: streamsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Clean up expired streams
   */
  async cleanupExpiredStreams(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE uep_streams SET
        status = 'failed',
        error_code = 'STREAM_TIMEOUT',
        error_message = 'Stream expired due to timeout'
      WHERE status = 'active' AND expires_at < NOW()
      RETURNING stream_id`
    );
    return result.rowCount || 0;
  }

  /**
   * Persist envelope to database
   */
  private async persistEnvelope(tenantId: string, envelope: UEPEnvelope): Promise<void> {
    await this.pool.query(
      `INSERT INTO uep_envelopes_v2 (
        envelope_id, specversion, type, tenant_id,
        source_id, source_type, source_name, source_version,
        source_registry_ref, source_ai_model, source_capabilities, source_execution_context,
        destination_id, destination_type, destination_routing_key, destination_routing_reason,
        payload_content_type, payload_content_encoding, payload_delivery,
        payload_data, payload_reference, payload_hash_algorithm, payload_hash_value, payload_size_bytes,
        stream_id, sequence_current, sequence_total, sequence_is_first, sequence_is_last,
        progress_bytes_transferred, progress_bytes_total, progress_percent_complete,
        resumable, resume_token, upload_offset,
        trace_id, span_id, parent_span_id,
        confidence_score, confidence_factors, risk_signals,
        compliance_frameworks, compliance_data_classification, compliance_contains_pii, compliance_contains_phi,
        metrics_duration_ms, metrics_cost_cents, metrics_tokens_used,
        extensions, timestamp
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
        $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50
      )`,
      [
        envelope.envelopeId,
        envelope.specversion,
        envelope.type,
        tenantId,
        envelope.source.sourceId,
        envelope.source.sourceType,
        envelope.source.name,
        envelope.source.version,
        envelope.source.registryRef ? JSON.stringify(envelope.source.registryRef) : null,
        envelope.source.aiModel ? JSON.stringify(envelope.source.aiModel) : null,
        envelope.source.capabilities,
        envelope.source.executionContext ? JSON.stringify(envelope.source.executionContext) : null,
        envelope.destination?.destinationId,
        envelope.destination?.destinationType,
        envelope.destination?.routingKey,
        envelope.destination?.routingReason,
        envelope.payload.contentType,
        envelope.payload.contentEncoding,
        envelope.payload.delivery,
        envelope.payload.data ? JSON.stringify(envelope.payload.data) : null,
        envelope.payload.reference ? JSON.stringify(envelope.payload.reference) : null,
        envelope.payload.hash?.algorithm,
        envelope.payload.hash?.value,
        envelope.payload.sizeBytes,
        envelope.streaming?.streamId,
        envelope.streaming?.sequence.current,
        envelope.streaming?.sequence.total,
        envelope.streaming?.sequence.isFirst,
        envelope.streaming?.sequence.isLast,
        envelope.streaming?.progress?.bytesTransferred,
        envelope.streaming?.progress?.bytesTotal,
        envelope.streaming?.progress?.percentComplete,
        envelope.streaming?.resumable,
        envelope.streaming?.resumeToken,
        envelope.streaming?.uploadOffset,
        envelope.tracing.traceId,
        envelope.tracing.spanId,
        envelope.tracing.parentSpanId,
        envelope.confidence?.score,
        envelope.confidence?.factors ? JSON.stringify(envelope.confidence.factors) : null,
        envelope.riskSignals ? JSON.stringify(envelope.riskSignals) : null,
        envelope.compliance?.frameworks,
        envelope.compliance?.dataClassification,
        envelope.compliance?.containsPii,
        envelope.compliance?.containsPhi,
        envelope.metrics?.durationMs,
        envelope.metrics?.costCents,
        envelope.metrics?.tokensUsed,
        envelope.extensions ? JSON.stringify(envelope.extensions) : null,
        envelope.timestamp,
      ]
    );
  }

  /**
   * Register artifact in the registry
   */
  private async registerArtifact(
    tenantId: string,
    envelope: UEPEnvelope,
    stream: UEPStream,
    reference: UEPContentReference,
    hash: { algorithm: string; value: string }
  ): Promise<void> {
    // Extract S3 details from URI if applicable
    let bucket: string | null = null;
    let key: string | null = null;
    if (reference.protocol === 's3' && reference.uri.startsWith('s3://')) {
      const parts = reference.uri.replace('s3://', '').split('/');
      bucket = parts[0];
      key = parts.slice(1).join('/');
    }
    
    await this.pool.query(
      `INSERT INTO uep_artifacts (
        tenant_id, content_type, filename, size_bytes,
        storage_protocol, storage_uri, storage_bucket, storage_key,
        access_method, supports_range_requests,
        hash_algorithm, hash_value,
        source_envelope_id, source_stream_id, source_id, source_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        tenantId,
        stream.contentType,
        reference.filename,
        envelope.payload.sizeBytes,
        reference.protocol,
        reference.uri,
        bucket,
        key,
        reference.accessMethod,
        reference.supportsRangeRequests,
        hash.algorithm,
        hash.value,
        envelope.envelopeId,
        stream.streamId,
        envelope.source.sourceId,
        envelope.source.sourceType,
      ]
    );
  }

  /**
   * Generate a secure resume token
   */
  private generateResumeToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
}

// Singleton instance
let streamManagerInstance: UEPStreamManager | null = null;

export function getStreamManager(pool: Pool): UEPStreamManager {
  if (!streamManagerInstance) {
    streamManagerInstance = new UEPStreamManager(pool);
  }
  return streamManagerInstance;
}

export default UEPStreamManager;
