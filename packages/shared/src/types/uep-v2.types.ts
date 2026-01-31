// RADIANT v5.3.0 - Universal Envelope Protocol v2.0 Types
// Multi-modal, streaming, asynchronous AI communication protocol

// ============================================================================
// ENVELOPE TYPES
// ============================================================================

export type UEPEnvelopeType = 
  // Pipeline envelopes (UEP v1.0 compatible)
  | 'method.output'           // Standard method output
  | 'method.input'            // Method input
  
  // Streaming envelopes
  | 'stream.start'            // Stream initiation
  | 'stream.chunk'            // Stream chunk
  | 'stream.end'              // Stream completion
  | 'stream.error'            // Stream error
  | 'stream.cancel'           // Stream cancellation
  
  // Artifact envelopes
  | 'artifact.created'        // New artifact available
  | 'artifact.reference'      // Reference to external artifact
  
  // Control envelopes
  | 'control.ack'             // Acknowledgment
  | 'control.nack'            // Negative acknowledgment
  | 'control.heartbeat'       // Keep-alive
  | 'control.capability'      // Capability advertisement
  
  // Event envelopes
  | 'event.checkpoint'        // HITL checkpoint reached
  | 'event.progress'          // Progress update
  | 'event.error';            // Error occurred

export type UEPSourceType = 
  | 'method'       // Cato method
  | 'tool'         // Cato tool (Lambda, MCP)
  | 'model'        // AI model directly
  | 'agent'        // Agent (Curator, Think Tank)
  | 'service'      // Backend service
  | 'user'         // Human user
  | 'external';    // External system

export type UEPDeliveryType = 'inline' | 'reference' | 'chunked';

export type UEPHashAlgorithm = 'sha256' | 'sha384' | 'sha512' | 'blake3';

export type UEPStorageProtocol = 'https' | 's3' | 'radiant' | 'ipfs' | 'data';

export type UEPAccessMethod = 'presigned_url' | 'bearer_token' | 'api_key' | 'public';

export type UEPPriority = 'low' | 'normal' | 'high' | 'critical';

export type UEPDataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export type UEPRiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type UEPContextPruning = 'FULL' | 'MINIMAL' | 'TAIL' | 'RELEVANT' | 'SUMMARY';

export type UEPRegistryType = 'cato-method' | 'cato-tool' | 'model' | 'agent' | 'service';

// ============================================================================
// SOURCE & DESTINATION
// ============================================================================

export interface UEPRegistryRef {
  registry: UEPRegistryType;
  lookupKey: string;
  registryVersion?: string;
}

export interface UEPAIModelInfo {
  provider: string;
  modelId: string;
  modelVersion?: string;
  temperature?: number;
  mode?: string;
}

export interface UEPExecutionContext {
  pipelineId?: string;
  methodInvocationId?: string;
  agentSessionId?: string;
  tenantId: string;
  userId?: string;
}

export interface UEPSourceCard {
  sourceId: string;
  sourceType: UEPSourceType;
  name: string;
  version: string;
  registryRef?: UEPRegistryRef;
  aiModel?: UEPAIModelInfo;
  capabilities?: string[];
  executionContext?: UEPExecutionContext;
}

export interface UEPRetryPolicy {
  maxRetries: number;
  backoffMultiplier: number;
}

export interface UEPDeliveryOptions {
  priority: UEPPriority;
  ttlSeconds?: number;
  retryPolicy?: UEPRetryPolicy;
}

export interface UEPResponseCallback {
  uri: string;
  correlationId: string;
}

export interface UEPDestinationCard {
  destinationId: string;
  destinationType: UEPSourceType;
  routingKey?: string;
  routingReason?: string;
  delivery?: UEPDeliveryOptions;
  expectsResponse?: boolean;
  responseTimeoutMs?: number;
  responseCallback?: UEPResponseCallback;
}

// ============================================================================
// PAYLOAD
// ============================================================================

export interface UEPContentCredentials {
  expiresAt: string;
  token?: string;
}

export interface UEPContentReference {
  uri: string;
  protocol: UEPStorageProtocol;
  accessMethod: UEPAccessMethod;
  credentials?: UEPContentCredentials;
  supportsRangeRequests: boolean;
  preferredChunkSizeBytes?: number;
  filename?: string;
  lastModified?: string;
}

export interface UEPPayloadHash {
  algorithm: UEPHashAlgorithm;
  value: string;
}

export interface UEPPayloadSchema {
  schemaRef: string;
  schemaVersion: string;
}

export interface UEPPayloadPart {
  partId: string;
  partIndex: number;
  contentType: string;
  contentDisposition?: 'inline' | 'attachment';
  name?: string;
  filename?: string;
  data?: string | Record<string, unknown>;
  reference?: UEPContentReference;
  sizeBytes?: number;
  hash?: { algorithm: string; value: string };
}

export interface UEPPayload<T = unknown> {
  contentType: string;
  contentEncoding?: string;
  delivery: UEPDeliveryType;
  data?: T;
  reference?: UEPContentReference;
  parts?: UEPPayloadPart[];
  schema?: UEPPayloadSchema;
  hash?: UEPPayloadHash;
  sizeBytes?: number;
}

// ============================================================================
// STREAMING
// ============================================================================

export interface UEPStreamSequence {
  current: number;
  total?: number;
  isFirst: boolean;
  isLast: boolean;
}

export interface UEPStreamProgress {
  bytesTransferred: number;
  bytesTotal?: number;
  percentComplete?: number;
  estimatedRemainingMs?: number;
}

export interface UEPCompletionCallback {
  uri: string;
  method: 'POST' | 'PUT';
}

export interface UEPStreamingInfo {
  streamId: string;
  sequence: UEPStreamSequence;
  progress?: UEPStreamProgress;
  resumable: boolean;
  resumeToken?: string;
  uploadOffset?: number;
  requiresOrdering: boolean;
  completionCallback?: UEPCompletionCallback;
}

// ============================================================================
// TRACING
// ============================================================================

export interface UEPTracingInfo {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage?: Record<string, string>;
}

// ============================================================================
// GOVERNANCE
// ============================================================================

export interface UEPConfidenceFactor {
  factor: string;
  value: number;
  weight: number;
}

export interface UEPConfidenceScore {
  score: number;
  factors: UEPConfidenceFactor[];
}

export interface UEPRiskSignal {
  signalId: string;
  signalType: string;
  severity: UEPRiskSeverity;
  description: string;
  source: string;
  mitigationSuggestion?: string;
}

export interface UEPComplianceInfo {
  frameworks: string[];
  dataClassification: UEPDataClassification;
  containsPii: boolean;
  containsPhi: boolean;
  retentionDays?: number;
}

// ============================================================================
// METRICS
// ============================================================================

export interface UEPMetrics {
  durationMs: number;
  costCents: number;
  tokensUsed: number;
  modelId?: string;
  provider?: string;
}

// ============================================================================
// CONTEXT
// ============================================================================

export interface UEPAccumulatedContext<T = unknown> {
  history: UEPEnvelope<T>[];
  pruningApplied: UEPContextPruning;
  originalCount: number;
  prunedCount: number;
  totalTokensEstimate: number;
}

// ============================================================================
// FULL ENVELOPE
// ============================================================================

export interface UEPEnvelope<T = unknown> {
  // Core (required)
  envelopeId: string;
  specversion: '2.0';
  type: UEPEnvelopeType;
  source: UEPSourceCard;
  timestamp: string;
  payload: UEPPayload<T>;
  
  // Routing
  destination?: UEPDestinationCard;
  
  // Streaming
  streaming?: UEPStreamingInfo;
  
  // Context
  context?: UEPAccumulatedContext<T>;
  
  // Tracing
  tracing: UEPTracingInfo;
  
  // Governance
  confidence?: UEPConfidenceScore;
  riskSignals?: UEPRiskSignal[];
  compliance?: UEPComplianceInfo;
  
  // Metrics
  metrics?: UEPMetrics;
  
  // Extensions
  extensions?: Record<string, unknown>;
}

// ============================================================================
// SPECIALIZED ENVELOPE TYPES
// ============================================================================

export type UEPStreamStartEnvelope<T = unknown> = UEPEnvelope<T> & {
  type: 'stream.start';
  streaming: UEPStreamingInfo & { sequence: { isFirst: true } };
};

export type UEPStreamChunkEnvelope<T = unknown> = UEPEnvelope<T> & {
  type: 'stream.chunk';
  streaming: UEPStreamingInfo;
};

export type UEPStreamEndEnvelope<T = unknown> = UEPEnvelope<T> & {
  type: 'stream.end';
  streaming: UEPStreamingInfo & { sequence: { isLast: true } };
};

export type UEPStreamErrorEnvelope<T = unknown> = UEPEnvelope<T> & {
  type: 'stream.error';
  streaming: UEPStreamingInfo;
};

export type UEPMethodOutputEnvelope<T = unknown> = UEPEnvelope<T> & {
  type: 'method.output';
};

export type UEPMethodInputEnvelope<T = unknown> = UEPEnvelope<T> & {
  type: 'method.input';
};

export type UEPArtifactEnvelope<T = unknown> = UEPEnvelope<T> & {
  type: 'artifact.created' | 'artifact.reference';
  payload: UEPPayload<T> & { reference: UEPContentReference };
};

// ============================================================================
// STREAM MANAGEMENT
// ============================================================================

export type UEPStreamStatus = 'active' | 'completed' | 'failed' | 'cancelled';

export interface UEPStream {
  streamId: string;
  tenantId: string;
  contentType: string;
  totalSizeBytes?: number;
  totalChunks?: number;
  status: UEPStreamStatus;
  lastChunkSequence: number;
  lastChunkOffset: number;
  resumeToken?: string;
  sourceId: string;
  destinationId?: string;
  startedAt: Date;
  lastChunkAt?: Date;
  completedAt?: Date;
  expiresAt?: Date;
  finalArtifactUri?: string;
  finalArtifactHash?: string;
}

// ============================================================================
// ARTIFACT REGISTRY
// ============================================================================

export interface UEPArtifact {
  artifactId: string;
  tenantId: string;
  contentType: string;
  filename?: string;
  sizeBytes: number;
  storageProtocol: UEPStorageProtocol;
  storageUri: string;
  storageRegion?: string;
  hashAlgorithm: UEPHashAlgorithm;
  hashValue: string;
  sourceEnvelopeId?: string;
  sourceStreamId?: string;
  createdAt: Date;
  expiresAt?: Date;
  deletedAt?: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// BUILDER HELPERS
// ============================================================================

export interface UEPEnvelopeBuilder<T = unknown> {
  setSource(source: UEPSourceCard): this;
  setDestination(destination: UEPDestinationCard): this;
  setPayload(payload: UEPPayload<T>): this;
  setStreaming(streaming: UEPStreamingInfo): this;
  setTracing(tracing: UEPTracingInfo): this;
  setConfidence(confidence: UEPConfidenceScore): this;
  addRiskSignal(signal: UEPRiskSignal): this;
  setCompliance(compliance: UEPComplianceInfo): this;
  setMetrics(metrics: UEPMetrics): this;
  setExtension(key: string, value: unknown): this;
  build(): UEPEnvelope<T>;
}

// ============================================================================
// MIGRATION HELPERS (UEP v1.0 -> v2.0)
// ============================================================================

export interface UEPv1MethodType {
  OBSERVER: 'OBSERVER';
  PROPOSER: 'PROPOSER';
  DECIDER: 'DECIDER';
  VALIDATOR: 'VALIDATOR';
  EXECUTOR: 'EXECUTOR';
  RED_TEAM: 'RED_TEAM';
  CRITIC: 'CRITIC';
}

export const UEP_V1_TO_V2_SOURCE_TYPE_MAP: Record<keyof UEPv1MethodType, UEPSourceType> = {
  OBSERVER: 'method',
  PROPOSER: 'method',
  DECIDER: 'method',
  VALIDATOR: 'method',
  EXECUTOR: 'method',
  RED_TEAM: 'method',
  CRITIC: 'method',
};

// ============================================================================
// PROTOCOL CONSTANTS
// ============================================================================

export const UEP_SPEC_VERSION = '2.0' as const;

export const UEP_MAX_INLINE_PAYLOAD_BYTES = 1048576; // 1MB

export const UEP_DEFAULT_CHUNK_SIZE_BYTES = 1048576; // 1MB

export const UEP_SUBSYSTEM_PREFIXES = {
  CATO: 'cato://',
  BRAIN: 'brain://',
  CORTEX: 'cortex://',
  GENESIS: 'genesis://',
  CURATOR: 'curator://',
  THINKTANK: 'thinktank://',
  UDS: 'uds://',
  BLACKBOARD: 'blackboard://',
} as const;

export type UEPSubsystem = keyof typeof UEP_SUBSYSTEM_PREFIXES;
