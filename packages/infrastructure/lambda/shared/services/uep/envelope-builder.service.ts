// RADIANT v5.53.0 - UEP v2.0 Envelope Builder Service
// Fluent builder pattern for constructing UEP envelopes

import { randomUUID } from 'crypto';
import * as crypto from 'crypto';
import {
  UEPEnvelope,
  UEPEnvelopeType,
  UEPSourceCard,
  UEPDestinationCard,
  UEPPayload,
  UEPStreamingInfo,
  UEPTracingInfo,
  UEPConfidenceScore,
  UEPRiskSignal,
  UEPComplianceInfo,
  UEPMetrics,
  UEPAccumulatedContext,
  UEPContentReference,
  UEPPayloadPart,
  UEP_SPEC_VERSION,
  UEP_MAX_INLINE_PAYLOAD_BYTES,
} from '@radiant/shared';

/**
 * Fluent builder for constructing UEP v2.0 envelopes
 * 
 * @example
 * ```typescript
 * const envelope = UEPEnvelopeBuilder.create('method.output')
 *   .setSource({
 *     sourceId: 'method:observer:v2',
 *     sourceType: 'method',
 *     name: 'Observer Method',
 *     version: '2.0.0',
 *   })
 *   .setPayloadJson({ classification: 'code_generation', confidence: 0.95 })
 *   .setTracing({ traceId: 'abc123', spanId: 'def456' })
 *   .build();
 * ```
 */
export class UEPEnvelopeBuilder<T = unknown> {
  private envelope: Partial<UEPEnvelope<T>>;

  private constructor(type: UEPEnvelopeType) {
    this.envelope = {
      envelopeId: this.generateUUIDv7(),
      specversion: UEP_SPEC_VERSION,
      type,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a new envelope builder
   */
  static create<T = unknown>(type: UEPEnvelopeType): UEPEnvelopeBuilder<T> {
    return new UEPEnvelopeBuilder<T>(type);
  }

  /**
   * Create a method output envelope builder
   */
  static methodOutput<T = unknown>(): UEPEnvelopeBuilder<T> {
    return new UEPEnvelopeBuilder<T>('method.output');
  }

  /**
   * Create a stream start envelope builder
   */
  static streamStart<T = unknown>(): UEPEnvelopeBuilder<T> {
    return new UEPEnvelopeBuilder<T>('stream.start');
  }

  /**
   * Create a stream chunk envelope builder
   */
  static streamChunk<T = unknown>(): UEPEnvelopeBuilder<T> {
    return new UEPEnvelopeBuilder<T>('stream.chunk');
  }

  /**
   * Create a stream end envelope builder
   */
  static streamEnd<T = unknown>(): UEPEnvelopeBuilder<T> {
    return new UEPEnvelopeBuilder<T>('stream.end');
  }

  /**
   * Create an artifact reference envelope builder
   */
  static artifactReference<T = unknown>(): UEPEnvelopeBuilder<T> {
    return new UEPEnvelopeBuilder<T>('artifact.reference');
  }

  /**
   * Set a custom envelope ID (defaults to UUID v7)
   */
  setEnvelopeId(id: string): this {
    this.envelope.envelopeId = id;
    return this;
  }

  /**
   * Set the source card
   */
  setSource(source: UEPSourceCard): this {
    this.envelope.source = source;
    return this;
  }

  /**
   * Set the source using common method parameters
   */
  setMethodSource(
    methodId: string,
    methodName: string,
    version: string,
    options?: {
      aiModel?: UEPSourceCard['aiModel'];
      capabilities?: string[];
      pipelineId?: string;
      tenantId?: string;
      userId?: string;
    }
  ): this {
    this.envelope.source = {
      sourceId: methodId,
      sourceType: 'method',
      name: methodName,
      version,
      registryRef: {
        registry: 'cato-method',
        lookupKey: methodId,
      },
      aiModel: options?.aiModel,
      capabilities: options?.capabilities,
      executionContext: options?.pipelineId || options?.tenantId ? {
        pipelineId: options?.pipelineId,
        tenantId: options?.tenantId || '',
        userId: options?.userId,
      } : undefined,
    };
    return this;
  }

  /**
   * Set the destination card
   */
  setDestination(destination: UEPDestinationCard): this {
    this.envelope.destination = destination;
    return this;
  }

  /**
   * Set destination to another method
   */
  setMethodDestination(
    methodId: string,
    routingReason?: string,
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      expectsResponse?: boolean;
      responseTimeoutMs?: number;
    }
  ): this {
    this.envelope.destination = {
      destinationId: methodId,
      destinationType: 'method',
      routingReason,
      delivery: options?.priority ? { priority: options.priority } : undefined,
      expectsResponse: options?.expectsResponse,
      responseTimeoutMs: options?.responseTimeoutMs,
    };
    return this;
  }

  /**
   * Set the payload directly
   */
  setPayload(payload: UEPPayload<T>): this {
    this.envelope.payload = payload;
    return this;
  }

  /**
   * Set JSON payload (inline delivery)
   */
  setPayloadJson(data: T, schemaRef?: string): this {
    const jsonStr = JSON.stringify(data);
    const sizeBytes = Buffer.byteLength(jsonStr, 'utf8');
    
    this.envelope.payload = {
      contentType: 'application/json',
      delivery: 'inline',
      data,
      sizeBytes,
      hash: {
        algorithm: 'sha256',
        value: crypto.createHash('sha256').update(jsonStr).digest('hex'),
      },
      schema: schemaRef ? { schemaRef, schemaVersion: '1.0.0' } : undefined,
    };
    return this;
  }

  /**
   * Set text payload (inline delivery)
   */
  setPayloadText(text: string, contentType = 'text/plain'): this {
    const sizeBytes = Buffer.byteLength(text, 'utf8');
    
    this.envelope.payload = {
      contentType,
      delivery: 'inline',
      data: text as unknown as T,
      sizeBytes,
      hash: {
        algorithm: 'sha256',
        value: crypto.createHash('sha256').update(text).digest('hex'),
      },
    };
    return this;
  }

  /**
   * Set binary payload (reference delivery for large files)
   */
  setPayloadReference(
    contentType: string,
    reference: UEPContentReference,
    sizeBytes: number,
    hash?: { algorithm: 'sha256' | 'sha384' | 'sha512' | 'blake3'; value: string }
  ): this {
    this.envelope.payload = {
      contentType,
      delivery: 'reference',
      reference,
      sizeBytes,
      hash,
    };
    return this;
  }

  /**
   * Set S3 reference payload
   */
  setPayloadS3(
    contentType: string,
    bucket: string,
    key: string,
    sizeBytes: number,
    options?: {
      presignedUrl?: string;
      expiresAt?: string;
      hash?: { algorithm: 'sha256' | 'sha384' | 'sha512' | 'blake3'; value: string };
      filename?: string;
    }
  ): this {
    this.envelope.payload = {
      contentType,
      delivery: 'reference',
      reference: {
        uri: `s3://${bucket}/${key}`,
        protocol: 's3',
        accessMethod: options?.presignedUrl ? 'presigned_url' : 'bearer_token',
        credentials: options?.presignedUrl ? {
          expiresAt: options.expiresAt || new Date(Date.now() + 3600000).toISOString(),
          token: options.presignedUrl,
        } : undefined,
        supportsRangeRequests: true,
        filename: options?.filename,
      },
      sizeBytes,
      hash: options?.hash,
    };
    return this;
  }

  /**
   * Set multi-part payload
   */
  setPayloadMultiPart(parts: UEPPayloadPart[]): this {
    const totalSize = parts.reduce((sum, p) => sum + (p.sizeBytes || 0), 0);
    
    this.envelope.payload = {
      contentType: 'multipart/mixed',
      delivery: 'inline',
      parts,
      sizeBytes: totalSize,
    };
    return this;
  }

  /**
   * Set chunked payload for streaming
   */
  setPayloadChunked(
    contentType: string,
    chunkData: string | Buffer,
    encoding: 'base64' | 'utf8' = 'base64'
  ): this {
    const data = Buffer.isBuffer(chunkData) 
      ? chunkData.toString('base64') 
      : chunkData;
    const sizeBytes = Buffer.isBuffer(chunkData) 
      ? chunkData.length 
      : Buffer.byteLength(chunkData, encoding === 'base64' ? 'base64' : 'utf8');
    
    this.envelope.payload = {
      contentType,
      contentEncoding: encoding,
      delivery: 'chunked',
      data: data as unknown as T,
      sizeBytes,
      hash: {
        algorithm: 'sha256',
        value: crypto.createHash('sha256').update(chunkData).digest('hex'),
      },
    };
    return this;
  }

  /**
   * Set streaming info
   */
  setStreaming(streaming: UEPStreamingInfo): this {
    this.envelope.streaming = streaming;
    return this;
  }

  /**
   * Set streaming info with common parameters
   */
  setStreamInfo(
    streamId: string,
    current: number,
    total: number | undefined,
    options?: {
      resumable?: boolean;
      resumeToken?: string;
      uploadOffset?: number;
      requiresOrdering?: boolean;
      bytesTransferred?: number;
      bytesTotal?: number;
    }
  ): this {
    this.envelope.streaming = {
      streamId,
      sequence: {
        current,
        total,
        isFirst: current === 1,
        isLast: total !== undefined && current === total,
      },
      progress: options?.bytesTransferred !== undefined ? {
        bytesTransferred: options.bytesTransferred,
        bytesTotal: options.bytesTotal,
        percentComplete: options.bytesTotal 
          ? Math.round((options.bytesTransferred / options.bytesTotal) * 100 * 100) / 100
          : undefined,
      } : undefined,
      resumable: options?.resumable ?? true,
      resumeToken: options?.resumeToken,
      uploadOffset: options?.uploadOffset,
      requiresOrdering: options?.requiresOrdering ?? true,
    };
    return this;
  }

  /**
   * Set tracing info
   */
  setTracing(tracing: UEPTracingInfo): this {
    this.envelope.tracing = tracing;
    return this;
  }

  /**
   * Generate new tracing info
   */
  generateTracing(parentSpanId?: string): this {
    this.envelope.tracing = {
      traceId: crypto.randomBytes(32).toString('hex'),
      spanId: crypto.randomBytes(16).toString('hex'),
      parentSpanId,
    };
    return this;
  }

  /**
   * Set context
   */
  setContext(context: UEPAccumulatedContext<T>): this {
    this.envelope.context = context;
    return this;
  }

  /**
   * Set confidence score
   */
  setConfidence(confidence: UEPConfidenceScore): this {
    this.envelope.confidence = confidence;
    return this;
  }

  /**
   * Set confidence with simple score
   */
  setConfidenceScore(score: number, factors?: UEPConfidenceScore['factors']): this {
    this.envelope.confidence = {
      score,
      factors: factors || [],
    };
    return this;
  }

  /**
   * Add a risk signal
   */
  addRiskSignal(signal: UEPRiskSignal): this {
    if (!this.envelope.riskSignals) {
      this.envelope.riskSignals = [];
    }
    this.envelope.riskSignals.push(signal);
    return this;
  }

  /**
   * Set all risk signals
   */
  setRiskSignals(signals: UEPRiskSignal[]): this {
    this.envelope.riskSignals = signals;
    return this;
  }

  /**
   * Set compliance info
   */
  setCompliance(compliance: UEPComplianceInfo): this {
    this.envelope.compliance = compliance;
    return this;
  }

  /**
   * Set metrics
   */
  setMetrics(metrics: UEPMetrics): this {
    this.envelope.metrics = metrics;
    return this;
  }

  /**
   * Set an extension value
   */
  setExtension(key: string, value: unknown): this {
    if (!this.envelope.extensions) {
      this.envelope.extensions = {};
    }
    this.envelope.extensions[key] = value;
    return this;
  }

  /**
   * Set multiple extensions
   */
  setExtensions(extensions: Record<string, unknown>): this {
    this.envelope.extensions = { ...this.envelope.extensions, ...extensions };
    return this;
  }

  /**
   * Validate the envelope before building
   */
  private validate(): void {
    if (!this.envelope.source) {
      throw new Error('UEP envelope requires a source');
    }
    if (!this.envelope.payload) {
      throw new Error('UEP envelope requires a payload');
    }
    if (!this.envelope.tracing) {
      throw new Error('UEP envelope requires tracing info');
    }
    
    // Validate streaming envelopes have streaming info
    if (
      this.envelope.type?.startsWith('stream.') && 
      this.envelope.type !== 'stream.error' &&
      !this.envelope.streaming
    ) {
      throw new Error('Stream envelopes require streaming info');
    }
    
    // Validate payload size for inline delivery
    if (
      this.envelope.payload.delivery === 'inline' &&
      this.envelope.payload.sizeBytes &&
      this.envelope.payload.sizeBytes > UEP_MAX_INLINE_PAYLOAD_BYTES
    ) {
      throw new Error(
        `Inline payload size ${this.envelope.payload.sizeBytes} exceeds maximum ${UEP_MAX_INLINE_PAYLOAD_BYTES}. ` +
        'Use reference delivery for large payloads.'
      );
    }
  }

  /**
   * Build the envelope
   */
  build(): UEPEnvelope<T> {
    this.validate();
    return this.envelope as UEPEnvelope<T>;
  }

  /**
   * Build without validation (use with caution)
   */
  buildUnsafe(): UEPEnvelope<T> {
    return this.envelope as UEPEnvelope<T>;
  }

  /**
   * Generate a UUID v7 (time-ordered)
   */
  private generateUUIDv7(): string {
    // Get current timestamp in milliseconds
    const timestamp = Date.now();
    
    // Convert to bytes (48 bits)
    const timestampBytes = Buffer.alloc(6);
    timestampBytes.writeUIntBE(timestamp, 0, 6);
    
    // Generate random bytes for the rest
    const randomBytes = crypto.randomBytes(10);
    
    // Combine into UUID format
    const uuid = Buffer.alloc(16);
    timestampBytes.copy(uuid, 0);
    randomBytes.copy(uuid, 6);
    
    // Set version (7) and variant (RFC 4122)
    uuid[6] = (uuid[6] & 0x0f) | 0x70; // Version 7
    uuid[8] = (uuid[8] & 0x3f) | 0x80; // Variant
    
    // Convert to string format
    const hex = uuid.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}

/**
 * Factory for creating common envelope types
 */
export const UEPFactory = {
  /**
   * Create a method output envelope
   */
  methodOutput<T>(
    source: UEPSourceCard,
    output: T,
    tracing: UEPTracingInfo,
    options?: {
      destination?: UEPDestinationCard;
      schemaRef?: string;
      confidence?: UEPConfidenceScore;
      riskSignals?: UEPRiskSignal[];
      compliance?: UEPComplianceInfo;
      metrics?: UEPMetrics;
    }
  ): UEPEnvelope<T> {
    const builder = UEPEnvelopeBuilder.methodOutput<T>()
      .setSource(source)
      .setPayloadJson(output, options?.schemaRef)
      .setTracing(tracing);
    
    if (options?.destination) builder.setDestination(options.destination);
    if (options?.confidence) builder.setConfidence(options.confidence);
    if (options?.riskSignals) builder.setRiskSignals(options.riskSignals);
    if (options?.compliance) builder.setCompliance(options.compliance);
    if (options?.metrics) builder.setMetrics(options.metrics);
    
    return builder.build();
  },

  /**
   * Create a stream start envelope
   */
  streamStart(
    source: UEPSourceCard,
    streamId: string,
    contentType: string,
    totalChunks: number | undefined,
    totalBytes: number | undefined,
    tracing: UEPTracingInfo
  ): UEPEnvelope {
    return UEPEnvelopeBuilder.streamStart()
      .setSource(source)
      .setPayload({
        contentType,
        delivery: 'chunked',
        sizeBytes: totalBytes,
      })
      .setStreamInfo(streamId, 1, totalChunks, {
        resumable: true,
        bytesTransferred: 0,
        bytesTotal: totalBytes,
      })
      .setTracing(tracing)
      .build();
  },

  /**
   * Create a stream chunk envelope
   */
  streamChunk(
    source: UEPSourceCard,
    streamId: string,
    chunkNumber: number,
    totalChunks: number | undefined,
    chunkData: Buffer,
    contentType: string,
    tracing: UEPTracingInfo,
    bytesTransferred: number,
    bytesTotal?: number
  ): UEPEnvelope {
    return UEPEnvelopeBuilder.streamChunk()
      .setSource(source)
      .setPayloadChunked(contentType, chunkData)
      .setStreamInfo(streamId, chunkNumber, totalChunks, {
        resumable: true,
        bytesTransferred,
        bytesTotal,
      })
      .setTracing(tracing)
      .build();
  },

  /**
   * Create a stream end envelope
   */
  streamEnd(
    source: UEPSourceCard,
    streamId: string,
    totalChunks: number,
    finalArtifactRef: UEPContentReference,
    contentType: string,
    sizeBytes: number,
    hash: { algorithm: 'sha256' | 'sha384' | 'sha512' | 'blake3'; value: string },
    tracing: UEPTracingInfo
  ): UEPEnvelope {
    return UEPEnvelopeBuilder.streamEnd()
      .setSource(source)
      .setPayloadReference(contentType, finalArtifactRef, sizeBytes, hash)
      .setStreamInfo(streamId, totalChunks, totalChunks, {
        bytesTransferred: sizeBytes,
        bytesTotal: sizeBytes,
      })
      .setTracing(tracing)
      .build();
  },

  /**
   * Create an artifact reference envelope
   */
  artifactReference(
    source: UEPSourceCard,
    contentType: string,
    reference: UEPContentReference,
    sizeBytes: number,
    hash: { algorithm: 'sha256' | 'sha384' | 'sha512' | 'blake3'; value: string },
    tracing: UEPTracingInfo
  ): UEPEnvelope {
    return UEPEnvelopeBuilder.artifactReference()
      .setSource(source)
      .setPayloadReference(contentType, reference, sizeBytes, hash)
      .setTracing(tracing)
      .build();
  },

  /**
   * Create an acknowledgment envelope
   */
  ack(
    source: UEPSourceCard,
    originalEnvelopeId: string,
    tracing: UEPTracingInfo
  ): UEPEnvelope {
    return UEPEnvelopeBuilder.create('control.ack')
      .setSource(source)
      .setPayloadJson({ acknowledgedEnvelopeId: originalEnvelopeId })
      .setTracing(tracing)
      .build();
  },

  /**
   * Create a negative acknowledgment envelope
   */
  nack(
    source: UEPSourceCard,
    originalEnvelopeId: string,
    reason: string,
    tracing: UEPTracingInfo
  ): UEPEnvelope {
    return UEPEnvelopeBuilder.create('control.nack')
      .setSource(source)
      .setPayloadJson({ 
        acknowledgedEnvelopeId: originalEnvelopeId,
        reason,
      })
      .setTracing(tracing)
      .build();
  },

  /**
   * Create an error envelope
   */
  error(
    source: UEPSourceCard,
    errorCode: string,
    errorMessage: string,
    tracing: UEPTracingInfo,
    streamId?: string
  ): UEPEnvelope {
    const builder = UEPEnvelopeBuilder.create(streamId ? 'stream.error' : 'event.error')
      .setSource(source)
      .setPayloadJson({
        errorCode,
        errorMessage,
        timestamp: new Date().toISOString(),
      })
      .setTracing(tracing);
    
    if (streamId) {
      builder.setStreamInfo(streamId, -1, undefined, { resumable: false });
    }
    
    return builder.build();
  },
};

export default UEPEnvelopeBuilder;
