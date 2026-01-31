# Universal Envelope Protocol (UEP) v2.0 Specification

> **Version**: 2.0.0-draft  
> **Status**: DRAFT  
> **Last Updated**: 2026-01-31  
> **Authors**: RADIANT Engineering Team

---

## Executive Summary

The Universal Envelope Protocol (UEP) v2.0 is RADIANT's next-generation protocol for multi-modal, asynchronous, streaming communication between AI methods, agents, and subsystems. It extends UEP v1.0 with:

- **Multi-modal payloads** (text, images, audio, video, documents)
- **Chunked streaming** with sequence tracking
- **Rich source/destination metadata** with registry lookups
- **Cross-subsystem routing**
- **Resumable transfers**
- **Binary and structured data support**

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Industry Standards Incorporated](#2-industry-standards-incorporated)
3. [Envelope Structure](#3-envelope-structure)
4. [Multi-Modal Payload System](#4-multi-modal-payload-system)
5. [Chunked Streaming Protocol](#5-chunked-streaming-protocol)
6. [Source & Destination Cards](#6-source--destination-cards)
7. [Cross-Subsystem Routing](#7-cross-subsystem-routing)
8. [Transport Bindings](#8-transport-bindings)
9. [Database Schema](#9-database-schema)
10. [TypeScript Interfaces](#10-typescript-interfaces)
11. [Migration from UEP v1.0](#11-migration-from-uep-v10)

---

## 1. Design Principles

| Principle | Description |
|-----------|-------------|
| **Multi-Modal First** | Native support for any media type, not just JSON |
| **Streaming Native** | Designed for progressive delivery, not just request/response |
| **Registry-Driven** | All sources/destinations are registry entries with capabilities |
| **Resumable** | Any transfer can be paused and resumed |
| **Async by Default** | Producers and consumers are decoupled |
| **Zero-Copy Where Possible** | Large payloads stored externally, envelopes contain references |
| **Backward Compatible** | UEP v1.0 envelopes are valid v2.0 envelopes |

---

## 2. Industry Standards Incorporated

We analyzed and incorporated the best concepts from these protocols:

| Standard | What We Took | How We Improved |
|----------|--------------|-----------------|
| **Google A2A Protocol** | Agent Cards, JSON-RPC 2.0 base, capability discovery | Added streaming, multi-modal, chunking |
| **CloudEvents (CNCF)** | `source`, `id`, `type`, `specversion` attributes | Added AI-specific risk, confidence, compliance |
| **Anthropic MCP** | Tools/Resources/Prompts primitives | Unified into single envelope model |
| **OpenTelemetry OTLP** | Trace/Span/Resource model | Already had tracing; enhanced with baggage |
| **tus.io** | Resumable uploads with `Upload-Offset` | Generalized to any payload type |
| **MIME Multipart (RFC 2046)** | Multi-part message format | Modernized with JSON manifest |
| **AsyncAPI** | Channel/message schema definitions | Used for WebSocket binding |
| **gRPC Streaming** | Bidirectional streaming, chunking | HTTP/2 optional, works on HTTP/1.1 |
| **WebRTC Data Channels** | Binary streaming with metadata | For peer-to-peer agent scenarios |
| **ActivityPub** | Federated messaging, JSON-LD objects | For future multi-tenant federation |

---

## 3. Envelope Structure

### 3.1 Core Envelope (Required Fields)

Every envelope MUST contain these fields (inspired by CloudEvents):

```typescript
interface UEPEnvelopeCore {
  // === IDENTITY (CloudEvents-inspired) ===
  envelopeId: string;          // UUID v7 (time-ordered)
  specversion: '2.0';          // UEP protocol version
  type: UEPEnvelopeType;       // e.g., 'method.output', 'stream.chunk', 'artifact'
  
  // === SOURCE (A2A Agent Card-inspired) ===
  source: UEPSourceCard;       // Who/what produced this envelope
  
  // === DESTINATION (optional for broadcast) ===
  destination?: UEPDestinationCard;
  
  // === TIMESTAMP ===
  timestamp: string;           // ISO 8601 with timezone
  
  // === PAYLOAD ===
  payload: UEPPayload;         // The actual content
}
```

### 3.2 Extended Envelope (Optional Fields)

```typescript
interface UEPEnvelopeExtended extends UEPEnvelopeCore {
  // === STREAMING (tus.io-inspired) ===
  streaming?: UEPStreamingInfo;
  
  // === CONTEXT (UEP v1.0 carryover) ===
  context?: UEPAccumulatedContext;
  
  // === TRACING (OpenTelemetry-inspired) ===
  tracing: UEPTracingInfo;
  
  // === GOVERNANCE (RADIANT-original) ===
  confidence?: UEPConfidenceScore;
  riskSignals?: UEPRiskSignal[];
  compliance?: UEPComplianceInfo;
  
  // === COST TRACKING ===
  metrics?: UEPMetrics;
  
  // === EXTENSIONS (CloudEvents-inspired) ===
  extensions?: Record<string, unknown>;
}
```

### 3.3 Envelope Types

```typescript
type UEPEnvelopeType = 
  // Pipeline envelopes (UEP v1.0 compatible)
  | 'method.output'           // Standard method output
  | 'method.input'            // Method input (new)
  
  // Streaming envelopes (NEW)
  | 'stream.start'            // Stream initiation
  | 'stream.chunk'            // Stream chunk
  | 'stream.end'              // Stream completion
  | 'stream.error'            // Stream error
  | 'stream.cancel'           // Stream cancellation
  
  // Artifact envelopes (NEW)
  | 'artifact.created'        // New artifact available
  | 'artifact.reference'      // Reference to external artifact
  
  // Control envelopes (NEW)
  | 'control.ack'             // Acknowledgment
  | 'control.nack'            // Negative acknowledgment
  | 'control.heartbeat'       // Keep-alive
  | 'control.capability'      // Capability advertisement
  
  // Event envelopes (NEW)
  | 'event.checkpoint'        // HITL checkpoint reached
  | 'event.progress'          // Progress update
  | 'event.error';            // Error occurred
```

---

## 4. Multi-Modal Payload System

### 4.1 Payload Structure

Payloads support any media type with optional external storage:

```typescript
interface UEPPayload {
  // === CONTENT TYPE (MIME-inspired) ===
  contentType: string;         // MIME type: 'application/json', 'image/png', etc.
  contentEncoding?: string;    // 'base64', 'gzip', 'br' (Brotli)
  
  // === CONTENT DELIVERY ===
  delivery: 'inline' | 'reference' | 'chunked';
  
  // === INLINE CONTENT (for small payloads < 1MB) ===
  data?: string | object;      // Actual content (JSON or base64)
  
  // === REFERENCE CONTENT (for large payloads) ===
  reference?: UEPContentReference;
  
  // === MULTI-PART CONTENT (for mixed payloads) ===
  parts?: UEPPayloadPart[];
  
  // === SCHEMA (for structured data) ===
  schema?: {
    schemaRef: string;         // JSON Schema $ref
    schemaVersion: string;
  };
  
  // === INTEGRITY ===
  hash?: {
    algorithm: 'sha256' | 'sha384' | 'sha512' | 'blake3';
    value: string;
  };
  
  // === SIZE ===
  sizeBytes?: number;
}
```

### 4.2 Content Reference (External Storage)

For large files (video, audio, PDFs, etc.), the envelope contains a reference:

```typescript
interface UEPContentReference {
  // === LOCATION ===
  uri: string;                 // s3://bucket/key, https://..., radiant://artifact/id
  protocol: 'https' | 's3' | 'radiant' | 'ipfs' | 'data';
  
  // === ACCESS ===
  accessMethod: 'presigned_url' | 'bearer_token' | 'api_key' | 'public';
  credentials?: {
    expiresAt: string;         // ISO 8601
    token?: string;            // Short-lived access token
  };
  
  // === RETRIEVAL HINTS ===
  supportsRangeRequests: boolean;
  preferredChunkSizeBytes?: number;
  
  // === METADATA ===
  filename?: string;
  lastModified?: string;
}
```

### 4.3 Multi-Part Payloads (MIME-inspired)

For mixed content (e.g., text + images + code):

```typescript
interface UEPPayloadPart {
  partId: string;              // Unique within envelope
  partIndex: number;           // 0-indexed order
  contentType: string;
  contentDisposition?: 'inline' | 'attachment';
  name?: string;               // Field name for form-like data
  filename?: string;           // Original filename
  
  // Content (one of these)
  data?: string | object;
  reference?: UEPContentReference;
  
  // Metadata
  sizeBytes?: number;
  hash?: { algorithm: string; value: string };
}
```

### 4.4 Supported Content Types

| Category | Content Types | Delivery Strategy |
|----------|--------------|-------------------|
| **Structured Data** | `application/json`, `application/xml` | Inline |
| **Text** | `text/plain`, `text/markdown`, `text/html` | Inline |
| **Images** | `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` | Reference (>100KB) |
| **Audio** | `audio/wav`, `audio/mp3`, `audio/ogg`, `audio/webm` | Reference + Chunked |
| **Video** | `video/mp4`, `video/webm` | Reference + Chunked |
| **Documents** | `application/pdf`, `application/vnd.openxmlformats-*` | Reference |
| **Archives** | `application/zip`, `application/gzip` | Reference |
| **Code** | `text/x-python`, `text/javascript`, `text/typescript` | Inline |
| **Binary** | `application/octet-stream` | Reference |

---

## 5. Chunked Streaming Protocol

### 5.1 Stream Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ stream.start│────▶│stream.chunk │────▶│stream.chunk │────▶│ stream.end  │
│   (1/N)     │     │   (2/N)     │     │   (N-1/N)   │     │   (N/N)     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
   [Consumer processes each chunk as it arrives, can display progress]
```

### 5.2 Streaming Info Structure

```typescript
interface UEPStreamingInfo {
  // === STREAM IDENTITY ===
  streamId: string;            // Groups all chunks together
  
  // === SEQUENCE (tus.io-inspired) ===
  sequence: {
    current: number;           // 1-indexed chunk number
    total?: number;            // Total chunks if known (null for open-ended)
    isFirst: boolean;
    isLast: boolean;
  };
  
  // === PROGRESS ===
  progress?: {
    bytesTransferred: number;
    bytesTotal?: number;
    percentComplete?: number;
    estimatedRemainingMs?: number;
  };
  
  // === RESUMABILITY (tus.io-inspired) ===
  resumable: boolean;
  resumeToken?: string;        // Token to resume from this point
  uploadOffset?: number;       // Byte offset for resumption
  
  // === ORDERING ===
  requiresOrdering: boolean;   // Must chunks be processed in order?
  
  // === COMPLETION ===
  completionCallback?: {
    uri: string;               // Webhook to call on completion
    method: 'POST' | 'PUT';
  };
}
```

### 5.3 Stream Start Envelope

```typescript
// Example: Starting a video generation stream
const streamStart: UEPEnvelope = {
  envelopeId: '01HQWXYZ-start',
  specversion: '2.0',
  type: 'stream.start',
  source: { /* ... */ },
  timestamp: '2026-01-31T10:00:00Z',
  
  payload: {
    contentType: 'video/mp4',
    delivery: 'chunked',
    sizeBytes: 52428800,  // 50MB expected
  },
  
  streaming: {
    streamId: 'video-gen-abc123',
    sequence: { current: 1, total: 50, isFirst: true, isLast: false },
    resumable: true,
    requiresOrdering: true,
    progress: { bytesTransferred: 0, bytesTotal: 52428800, percentComplete: 0 },
  },
};
```

### 5.4 Stream Chunk Envelope

```typescript
// Example: Chunk 25 of 50
const streamChunk: UEPEnvelope = {
  envelopeId: '01HQWXYZ-chunk-25',
  specversion: '2.0',
  type: 'stream.chunk',
  source: { /* ... */ },
  timestamp: '2026-01-31T10:00:05Z',
  
  payload: {
    contentType: 'video/mp4',
    delivery: 'inline',
    contentEncoding: 'base64',
    data: 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE...', // 1MB chunk
    hash: { algorithm: 'sha256', value: 'abc123...' },
  },
  
  streaming: {
    streamId: 'video-gen-abc123',
    sequence: { current: 25, total: 50, isFirst: false, isLast: false },
    resumable: true,
    resumeToken: 'resume-token-chunk-25',
    uploadOffset: 25165824,  // 24MB transferred
    progress: { bytesTransferred: 25165824, bytesTotal: 52428800, percentComplete: 48 },
  },
};
```

### 5.5 Stream End Envelope

```typescript
const streamEnd: UEPEnvelope = {
  envelopeId: '01HQWXYZ-end',
  specversion: '2.0',
  type: 'stream.end',
  source: { /* ... */ },
  timestamp: '2026-01-31T10:01:00Z',
  
  payload: {
    contentType: 'video/mp4',
    delivery: 'reference',
    reference: {
      uri: 's3://radiant-artifacts/videos/abc123.mp4',
      protocol: 's3',
      accessMethod: 'presigned_url',
      credentials: {
        expiresAt: '2026-01-31T11:00:00Z',
        token: 'presigned-url-here',
      },
    },
    hash: { algorithm: 'sha256', value: 'final-hash-of-complete-file' },
    sizeBytes: 52428800,
  },
  
  streaming: {
    streamId: 'video-gen-abc123',
    sequence: { current: 50, total: 50, isFirst: false, isLast: true },
    progress: { bytesTransferred: 52428800, bytesTotal: 52428800, percentComplete: 100 },
  },
};
```

---

## 6. Source & Destination Cards

### 6.1 Source Card (A2A Agent Card-inspired)

Every envelope identifies its producer:

```typescript
interface UEPSourceCard {
  // === IDENTITY ===
  sourceId: string;            // Unique ID: 'method:observer:v2', 'agent:curator', 'model:claude-3.5'
  sourceType: UEPSourceType;
  
  // === NAMING ===
  name: string;                // Human-readable: 'Observer Method'
  version: string;             // Semantic version: '2.1.0'
  
  // === REGISTRY LOOKUP ===
  registryRef?: {
    registry: 'cato-method' | 'cato-tool' | 'model' | 'agent' | 'service';
    lookupKey: string;         // Key to look up in registry
    registryVersion?: string;
  };
  
  // === AI MODEL INFO (if source is an AI) ===
  aiModel?: {
    provider: string;          // 'anthropic', 'openai', 'self-hosted'
    modelId: string;           // 'claude-3.5-sonnet', 'gpt-4o'
    modelVersion?: string;
    temperature?: number;
    mode?: string;             // 'thinking', 'creative', 'coding'
  };
  
  // === CAPABILITIES (A2A-inspired) ===
  capabilities?: string[];     // ['text-generation', 'code-execution', 'image-analysis']
  
  // === EXECUTION CONTEXT ===
  executionContext?: {
    pipelineId?: string;
    methodInvocationId?: string;
    agentSessionId?: string;
    tenantId: string;
    userId?: string;
  };
}

type UEPSourceType = 
  | 'method'       // Cato method
  | 'tool'         // Cato tool (Lambda, MCP)
  | 'model'        // AI model directly
  | 'agent'        // Agent (Curator, Think Tank)
  | 'service'      // Backend service
  | 'user'         // Human user
  | 'external';    // External system
```

### 6.2 Destination Card

For targeted delivery:

```typescript
interface UEPDestinationCard {
  // === TARGET ===
  destinationId: string;
  destinationType: UEPSourceType;
  
  // === ROUTING ===
  routingKey?: string;         // For pub/sub routing
  routingReason?: string;      // Why this destination was chosen
  
  // === DELIVERY PREFERENCES ===
  delivery?: {
    priority: 'low' | 'normal' | 'high' | 'critical';
    ttlSeconds?: number;       // Time-to-live before discarding
    retryPolicy?: {
      maxRetries: number;
      backoffMultiplier: number;
    };
  };
  
  // === EXPECTED RESPONSE ===
  expectsResponse?: boolean;
  responseTimeoutMs?: number;
  responseCallback?: {
    uri: string;
    correlationId: string;
  };
}
```

### 6.3 Example: Method-to-Method Communication

```typescript
const methodEnvelope: UEPEnvelope = {
  envelopeId: '01HQWXYZ',
  specversion: '2.0',
  type: 'method.output',
  timestamp: '2026-01-31T10:00:00Z',
  
  source: {
    sourceId: 'method:observer:v2',
    sourceType: 'method',
    name: 'Observer Method',
    version: '2.1.0',
    registryRef: {
      registry: 'cato-method',
      lookupKey: 'method:observer:v2',
    },
    aiModel: {
      provider: 'anthropic',
      modelId: 'claude-3.5-sonnet',
      temperature: 0.7,
      mode: 'thinking',
    },
    capabilities: ['intent-classification', 'entity-extraction', 'domain-detection'],
    executionContext: {
      pipelineId: 'pipeline-123',
      methodInvocationId: 'invoke-456',
      tenantId: 'tenant-abc',
      userId: 'user-789',
    },
  },
  
  destination: {
    destinationId: 'method:proposer:v1',
    destinationType: 'method',
    routingReason: 'Observer suggested next method',
    delivery: { priority: 'normal' },
    expectsResponse: true,
    responseTimeoutMs: 30000,
  },
  
  payload: {
    contentType: 'application/json',
    delivery: 'inline',
    data: {
      category: 'code_generation',
      confidence: 0.92,
      domain: { detected: 'software_engineering', confidence: 0.88 },
      // ... rest of observer output
    },
    schema: {
      schemaRef: 'cato:observer:output:v2',
      schemaVersion: '2.0.0',
    },
  },
  
  tracing: {
    traceId: 'trace-abc-123',
    spanId: 'span-observer-456',
    parentSpanId: 'span-pipeline-root',
  },
  
  confidence: {
    score: 0.92,
    factors: [
      { factor: 'model_confidence', value: 0.95, weight: 0.4 },
      { factor: 'domain_match', value: 0.88, weight: 0.3 },
    ],
  },
};
```

---

## 7. Cross-Subsystem Routing

### 7.1 Subsystem Registry

UEP v2.0 supports routing between RADIANT subsystems:

| Subsystem | Routing Prefix | Description |
|-----------|---------------|-------------|
| **Cato Pipeline** | `cato://` | Method orchestration |
| **Brain Router** | `brain://` | Model selection & inference |
| **Cortex Memory** | `cortex://` | Vector store & retrieval |
| **Genesis Safety** | `genesis://` | Ethics & safety checks |
| **Curator** | `curator://` | Content curation |
| **Think Tank** | `thinktank://` | User sessions |
| **UDS** | `uds://` | User data service |
| **Blackboard** | `blackboard://` | Multi-agent coordination |

### 7.2 Cross-Subsystem Envelope

```typescript
const crossSubsystemEnvelope: UEPEnvelope = {
  envelopeId: '01HQWXYZ',
  specversion: '2.0',
  type: 'artifact.reference',
  timestamp: '2026-01-31T10:00:00Z',
  
  source: {
    sourceId: 'cato://pipeline/abc123/executor',
    sourceType: 'method',
    name: 'Executor Method',
    version: '1.0.0',
  },
  
  destination: {
    destinationId: 'cortex://memory/tenant-xyz',
    destinationType: 'service',
    routingReason: 'Store generated artifact in memory',
  },
  
  payload: {
    contentType: 'application/pdf',
    delivery: 'reference',
    reference: {
      uri: 's3://radiant-artifacts/reports/report-123.pdf',
      protocol: 's3',
      accessMethod: 'presigned_url',
      supportsRangeRequests: true,
    },
    sizeBytes: 2048576,
  },
};
```

---

## 8. Transport Bindings

### 8.1 HTTP Binding

```http
POST /v2/envelopes HTTP/1.1
Host: api.radiant.example.com
Content-Type: application/cloudevents+json; charset=utf-8
Ce-Specversion: 2.0
Ce-Type: method.output
Ce-Source: method:observer:v2
Ce-Id: 01HQWXYZ
Ce-Time: 2026-01-31T10:00:00Z

{
  "payload": { ... },
  "streaming": { ... },
  "tracing": { ... }
}
```

### 8.2 WebSocket Binding (AsyncAPI-compatible)

```yaml
asyncapi: 3.0.0
info:
  title: RADIANT UEP v2.0
  version: 2.0.0
channels:
  envelopes:
    address: /v2/ws/envelopes
    messages:
      envelope:
        $ref: '#/components/messages/UEPEnvelope'
```

### 8.3 Server-Sent Events (SSE) Binding

For streaming chunks:

```
GET /v2/streams/{streamId} HTTP/1.1
Accept: text/event-stream

event: stream.chunk
id: 01HQWXYZ-chunk-1
data: {"envelopeId":"01HQWXYZ-chunk-1","payload":{"data":"..."}}

event: stream.chunk
id: 01HQWXYZ-chunk-2
data: {"envelopeId":"01HQWXYZ-chunk-2","payload":{"data":"..."}}

event: stream.end
id: 01HQWXYZ-end
data: {"envelopeId":"01HQWXYZ-end","streaming":{"isLast":true}}
```

### 8.4 PostgreSQL Binding (Internal)

For durable storage:

```sql
-- See Section 9 for full schema
INSERT INTO uep_envelopes (
  envelope_id, specversion, type, source_id, source_type,
  destination_id, payload_content_type, payload_data, payload_reference,
  stream_id, sequence_current, sequence_total,
  trace_id, span_id, timestamp
) VALUES (...);
```

---

## 9. Database Schema

```sql
-- UEP v2.0 Database Schema Extension
-- Migration: V5.3.0__uep_v2_streaming.sql

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE uep_envelope_type AS ENUM (
  'method.output', 'method.input',
  'stream.start', 'stream.chunk', 'stream.end', 'stream.error', 'stream.cancel',
  'artifact.created', 'artifact.reference',
  'control.ack', 'control.nack', 'control.heartbeat', 'control.capability',
  'event.checkpoint', 'event.progress', 'event.error'
);

CREATE TYPE uep_source_type AS ENUM (
  'method', 'tool', 'model', 'agent', 'service', 'user', 'external'
);

CREATE TYPE uep_delivery_type AS ENUM (
  'inline', 'reference', 'chunked'
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Extended envelope table for v2.0
CREATE TABLE uep_envelopes_v2 (
  envelope_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specversion VARCHAR(10) NOT NULL DEFAULT '2.0',
  type uep_envelope_type NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Source
  source_id VARCHAR(255) NOT NULL,
  source_type uep_source_type NOT NULL,
  source_name VARCHAR(255),
  source_version VARCHAR(50),
  source_registry_ref JSONB,
  source_ai_model JSONB,
  source_capabilities TEXT[],
  source_execution_context JSONB,
  
  -- Destination
  destination_id VARCHAR(255),
  destination_type uep_source_type,
  destination_routing_key VARCHAR(255),
  destination_routing_reason TEXT,
  destination_delivery JSONB,
  
  -- Payload
  payload_content_type VARCHAR(255) NOT NULL,
  payload_content_encoding VARCHAR(50),
  payload_delivery uep_delivery_type NOT NULL,
  payload_data JSONB,
  payload_data_binary BYTEA,
  payload_reference JSONB,
  payload_parts JSONB,
  payload_schema_ref VARCHAR(255),
  payload_hash_algorithm VARCHAR(20),
  payload_hash_value VARCHAR(128),
  payload_size_bytes BIGINT,
  
  -- Streaming
  stream_id UUID,
  sequence_current INTEGER,
  sequence_total INTEGER,
  sequence_is_first BOOLEAN DEFAULT FALSE,
  sequence_is_last BOOLEAN DEFAULT FALSE,
  progress_bytes_transferred BIGINT,
  progress_bytes_total BIGINT,
  progress_percent_complete DECIMAL(5, 2),
  resumable BOOLEAN DEFAULT FALSE,
  resume_token VARCHAR(255),
  upload_offset BIGINT,
  
  -- Tracing
  trace_id VARCHAR(64) NOT NULL,
  span_id VARCHAR(32) NOT NULL,
  parent_span_id VARCHAR(32),
  
  -- Governance
  confidence_score DECIMAL(4, 3),
  confidence_factors JSONB,
  risk_signals JSONB,
  compliance_frameworks TEXT[],
  compliance_data_classification VARCHAR(50),
  compliance_contains_pii BOOLEAN DEFAULT FALSE,
  compliance_contains_phi BOOLEAN DEFAULT FALSE,
  
  -- Metrics
  metrics_duration_ms INTEGER,
  metrics_cost_cents DECIMAL(10, 4),
  metrics_tokens_used INTEGER,
  
  -- Extensions
  extensions JSONB,
  
  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT uep_envelopes_v2_stream_sequence_unique 
    UNIQUE (stream_id, sequence_current) WHERE stream_id IS NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_uep_envelopes_v2_tenant_time ON uep_envelopes_v2(tenant_id, timestamp DESC);
CREATE INDEX idx_uep_envelopes_v2_stream ON uep_envelopes_v2(stream_id, sequence_current);
CREATE INDEX idx_uep_envelopes_v2_trace ON uep_envelopes_v2(trace_id);
CREATE INDEX idx_uep_envelopes_v2_source ON uep_envelopes_v2(source_id, source_type);
CREATE INDEX idx_uep_envelopes_v2_destination ON uep_envelopes_v2(destination_id);
CREATE INDEX idx_uep_envelopes_v2_type ON uep_envelopes_v2(type);

-- Partial index for active streams
CREATE INDEX idx_uep_envelopes_v2_active_streams 
  ON uep_envelopes_v2(stream_id, timestamp DESC) 
  WHERE type IN ('stream.start', 'stream.chunk') 
    AND sequence_is_last = FALSE;

-- ============================================================================
-- STREAM MANAGEMENT
-- ============================================================================

CREATE TABLE uep_streams (
  stream_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Stream metadata
  content_type VARCHAR(255) NOT NULL,
  total_size_bytes BIGINT,
  total_chunks INTEGER,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, completed, failed, cancelled
  
  -- Resume info
  last_chunk_sequence INTEGER DEFAULT 0,
  last_chunk_offset BIGINT DEFAULT 0,
  resume_token VARCHAR(255),
  
  -- Source/destination
  source_id VARCHAR(255) NOT NULL,
  destination_id VARCHAR(255),
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_chunk_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Final artifact reference
  final_artifact_uri TEXT,
  final_artifact_hash VARCHAR(128),
  
  CONSTRAINT uep_streams_status_check 
    CHECK (status IN ('active', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_uep_streams_tenant ON uep_streams(tenant_id, started_at DESC);
CREATE INDEX idx_uep_streams_active ON uep_streams(status, expires_at) WHERE status = 'active';

-- ============================================================================
-- ARTIFACT REGISTRY
-- ============================================================================

CREATE TABLE uep_artifacts (
  artifact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Content info
  content_type VARCHAR(255) NOT NULL,
  filename VARCHAR(500),
  size_bytes BIGINT NOT NULL,
  
  -- Storage
  storage_protocol VARCHAR(20) NOT NULL,  -- s3, https, radiant
  storage_uri TEXT NOT NULL,
  storage_region VARCHAR(50),
  
  -- Integrity
  hash_algorithm VARCHAR(20) NOT NULL,
  hash_value VARCHAR(128) NOT NULL,
  
  -- Source
  source_envelope_id UUID REFERENCES uep_envelopes_v2(envelope_id),
  source_stream_id UUID REFERENCES uep_streams(stream_id),
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB
);

CREATE INDEX idx_uep_artifacts_tenant ON uep_artifacts(tenant_id, created_at DESC);
CREATE INDEX idx_uep_artifacts_hash ON uep_artifacts(hash_algorithm, hash_value);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE uep_envelopes_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE uep_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE uep_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY uep_envelopes_v2_tenant_isolation ON uep_envelopes_v2
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY uep_streams_tenant_isolation ON uep_streams
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY uep_artifacts_tenant_isolation ON uep_artifacts
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

---

## 10. TypeScript Interfaces

Full TypeScript definitions for UEP v2.0:

```typescript
// packages/shared/src/types/uep-v2.types.ts

// ============================================================================
// ENVELOPE TYPES
// ============================================================================

export type UEPEnvelopeType = 
  | 'method.output' | 'method.input'
  | 'stream.start' | 'stream.chunk' | 'stream.end' | 'stream.error' | 'stream.cancel'
  | 'artifact.created' | 'artifact.reference'
  | 'control.ack' | 'control.nack' | 'control.heartbeat' | 'control.capability'
  | 'event.checkpoint' | 'event.progress' | 'event.error';

export type UEPSourceType = 
  | 'method' | 'tool' | 'model' | 'agent' | 'service' | 'user' | 'external';

export type UEPDeliveryType = 'inline' | 'reference' | 'chunked';

// ============================================================================
// SOURCE & DESTINATION
// ============================================================================

export interface UEPSourceCard {
  sourceId: string;
  sourceType: UEPSourceType;
  name: string;
  version: string;
  registryRef?: {
    registry: 'cato-method' | 'cato-tool' | 'model' | 'agent' | 'service';
    lookupKey: string;
    registryVersion?: string;
  };
  aiModel?: {
    provider: string;
    modelId: string;
    modelVersion?: string;
    temperature?: number;
    mode?: string;
  };
  capabilities?: string[];
  executionContext?: {
    pipelineId?: string;
    methodInvocationId?: string;
    agentSessionId?: string;
    tenantId: string;
    userId?: string;
  };
}

export interface UEPDestinationCard {
  destinationId: string;
  destinationType: UEPSourceType;
  routingKey?: string;
  routingReason?: string;
  delivery?: {
    priority: 'low' | 'normal' | 'high' | 'critical';
    ttlSeconds?: number;
    retryPolicy?: {
      maxRetries: number;
      backoffMultiplier: number;
    };
  };
  expectsResponse?: boolean;
  responseTimeoutMs?: number;
  responseCallback?: {
    uri: string;
    correlationId: string;
  };
}

// ============================================================================
// PAYLOAD
// ============================================================================

export interface UEPContentReference {
  uri: string;
  protocol: 'https' | 's3' | 'radiant' | 'ipfs' | 'data';
  accessMethod: 'presigned_url' | 'bearer_token' | 'api_key' | 'public';
  credentials?: {
    expiresAt: string;
    token?: string;
  };
  supportsRangeRequests: boolean;
  preferredChunkSizeBytes?: number;
  filename?: string;
  lastModified?: string;
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

export interface UEPPayload {
  contentType: string;
  contentEncoding?: string;
  delivery: UEPDeliveryType;
  data?: string | Record<string, unknown>;
  reference?: UEPContentReference;
  parts?: UEPPayloadPart[];
  schema?: {
    schemaRef: string;
    schemaVersion: string;
  };
  hash?: {
    algorithm: 'sha256' | 'sha384' | 'sha512' | 'blake3';
    value: string;
  };
  sizeBytes?: number;
}

// ============================================================================
// STREAMING
// ============================================================================

export interface UEPStreamingInfo {
  streamId: string;
  sequence: {
    current: number;
    total?: number;
    isFirst: boolean;
    isLast: boolean;
  };
  progress?: {
    bytesTransferred: number;
    bytesTotal?: number;
    percentComplete?: number;
    estimatedRemainingMs?: number;
  };
  resumable: boolean;
  resumeToken?: string;
  uploadOffset?: number;
  requiresOrdering: boolean;
  completionCallback?: {
    uri: string;
    method: 'POST' | 'PUT';
  };
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

export interface UEPConfidenceScore {
  score: number;
  factors: Array<{
    factor: string;
    value: number;
    weight: number;
  }>;
}

export interface UEPRiskSignal {
  signalId: string;
  signalType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  source: string;
  mitigationSuggestion?: string;
}

export interface UEPComplianceInfo {
  frameworks: string[];
  dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
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
// FULL ENVELOPE
// ============================================================================

export interface UEPEnvelope<T = unknown> {
  // Core (required)
  envelopeId: string;
  specversion: '2.0';
  type: UEPEnvelopeType;
  source: UEPSourceCard;
  timestamp: string;
  payload: UEPPayload & { data?: T };
  
  // Optional
  destination?: UEPDestinationCard;
  streaming?: UEPStreamingInfo;
  context?: UEPAccumulatedContext;
  tracing: UEPTracingInfo;
  confidence?: UEPConfidenceScore;
  riskSignals?: UEPRiskSignal[];
  compliance?: UEPComplianceInfo;
  metrics?: UEPMetrics;
  extensions?: Record<string, unknown>;
}

// ============================================================================
// CONTEXT (from UEP v1.0)
// ============================================================================

export interface UEPAccumulatedContext {
  history: UEPEnvelope[];
  pruningApplied: 'FULL' | 'MINIMAL' | 'TAIL' | 'RELEVANT' | 'SUMMARY';
  originalCount: number;
  prunedCount: number;
  totalTokensEstimate: number;
}

// ============================================================================
// HELPER TYPES
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

export type UEPMethodOutputEnvelope<T = unknown> = UEPEnvelope<T> & {
  type: 'method.output';
};
```

---

## 11. Migration from UEP v1.0

### 11.1 Backward Compatibility

UEP v1.0 `CatoMethodEnvelope` objects are valid v2.0 envelopes with these mappings:

| UEP v1.0 Field | UEP v2.0 Field |
|----------------|----------------|
| `envelopeId` | `envelopeId` |
| `envelopeVersion` | `specversion` (auto-converted) |
| `source.methodId` | `source.sourceId` |
| `source.methodType` | `source.sourceType` (mapped) |
| `source.methodName` | `source.name` |
| `destination.methodId` | `destination.destinationId` |
| `output.outputType` | `payload.schema.schemaRef` |
| `output.data` | `payload.data` |
| `output.hash` | `payload.hash` |
| `output.summary` | (moved to extensions) |
| `contextStrategy` | `context.pruningApplied` |
| `context` | `context` (unchanged) |
| `riskSignals` | `riskSignals` (unchanged) |
| `tracing` | `tracing` (unchanged) |
| `compliance` | `compliance` (unchanged) |
| `models` | `source.aiModel` + `metrics` |
| `durationMs` | `metrics.durationMs` |
| `costCents` | `metrics.costCents` |
| `tokensUsed` | `metrics.tokensUsed` |

### 11.2 Migration Helper

```typescript
// packages/infrastructure/lambda/shared/services/uep-migration.service.ts

import { CatoMethodEnvelope } from '../cato-pipeline.types';
import { UEPEnvelope } from '../uep-v2.types';

export function migrateV1ToV2<T>(v1: CatoMethodEnvelope<T>): UEPEnvelope<T> {
  return {
    envelopeId: v1.envelopeId,
    specversion: '2.0',
    type: 'method.output',
    timestamp: v1.timestamp.toISOString(),
    
    source: {
      sourceId: v1.source.methodId,
      sourceType: mapMethodTypeToSourceType(v1.source.methodType),
      name: v1.source.methodName,
      version: '1.0.0',
      executionContext: {
        pipelineId: v1.pipelineId,
        tenantId: v1.tenantId,
      },
    },
    
    destination: v1.destination ? {
      destinationId: v1.destination.methodId,
      destinationType: 'method',
      routingReason: v1.destination.routingReason,
    } : undefined,
    
    payload: {
      contentType: 'application/json',
      delivery: 'inline',
      data: v1.output.data,
      schema: {
        schemaRef: v1.output.schemaRef,
        schemaVersion: '1.0.0',
      },
      hash: {
        algorithm: 'sha256',
        value: v1.output.hash,
      },
    },
    
    tracing: v1.tracing,
    confidence: v1.confidence,
    riskSignals: v1.riskSignals,
    compliance: v1.compliance,
    
    metrics: {
      durationMs: v1.durationMs,
      costCents: v1.costCents,
      tokensUsed: v1.tokensUsed,
    },
    
    extensions: {
      legacyOutputSummary: v1.output.summary,
      legacySequence: v1.sequence,
    },
  };
}
```

---

## Appendix A: Comparison with Industry Standards

| Feature | UEP v2.0 | Google A2A | CloudEvents | MCP |
|---------|----------|-----------|-------------|-----|
| Multi-modal payloads | ✅ Native | ✅ Files support | ⚠️ Data only | ⚠️ Limited |
| Chunked streaming | ✅ Native | ❌ No | ❌ No | ❌ No |
| Resumable transfers | ✅ Native | ❌ No | ❌ No | ❌ No |
| AI model metadata | ✅ Native | ⚠️ Via capabilities | ❌ No | ✅ Tools |
| Risk/governance | ✅ Native | ❌ No | ❌ Extension | ❌ No |
| Registry lookup | ✅ Native | ✅ Agent Cards | ❌ No | ✅ Servers |
| Multi-tenant | ✅ Native | ⚠️ Implied | ❌ No | ⚠️ Implied |
| SAGA compensation | ✅ (via Cato) | ❌ No | ❌ No | ❌ No |

---

## Appendix B: Security Layer

### B.1 Encryption

UEP v2.0 includes end-to-end encryption using AWS KMS envelope encryption:

```typescript
interface EncryptedPayload {
  ciphertext: string;    // Base64 encoded
  iv: string;            // Base64 encoded initialization vector
  authTag: string;       // Base64 encoded authentication tag
  algorithm: 'aes-256-gcm' | 'chacha20-poly1305';
  keyId: string;         // Reference to encryption key
}
```

**Supported Algorithms**:
- **AES-256-GCM**: Default, widely supported
- **ChaCha20-Poly1305**: Alternative for mobile/embedded

**Key Management**:
- Keys managed via AWS KMS
- Per-tenant key isolation
- Automatic key rotation support
- Key versioning for backward compatibility

### B.2 Envelope Signing

For integrity and non-repudiation:

```typescript
interface SignatureResult {
  algorithm: 'ECDSA_SHA_256' | 'ECDSA_SHA_384' | 'RSASSA_PSS_SHA_256';
  keyId: string;         // KMS key ARN
  signature: string;     // Base64 encoded
  signedAt: string;      // ISO 8601 timestamp
}
```

**Signing Process**:
1. Create canonical JSON representation (sorted keys)
2. Compute SHA-256 hash of canonical form
3. Sign hash using KMS asymmetric key
4. Include signature in envelope extensions

**Verification**:
1. Extract and remove signature from envelope
2. Recreate canonical form
3. Verify signature using KMS

### B.3 MLS Integration (RFC 9420)

Future support for Message Layer Security:

```typescript
interface MLSGroupConfig {
  groupId: string;
  cipherSuite: 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519';
  members: MLSGroupMember[];
  epoch: number;
}
```

**Use Cases**:
- Encrypted multi-agent communication
- Forward secrecy for agent sessions
- Post-compromise security
- Federated AI orchestration

### B.4 Implementation Files

| File | Purpose |
|------|---------|
| `services/uep/security.service.ts` | Encryption, signing, verification |
| `services/uep/envelope-builder.service.ts` | Fluent envelope construction |
| `services/uep/stream-manager.service.ts` | Chunked streaming lifecycle |
| `services/uep/migration.service.ts` | v1.0 to v2.0 migration |

---

## Appendix C: Future Extensions

1. **Peer-to-Peer (P2P) Binding** - WebRTC data channels for direct agent communication
2. **Federation** - ActivityPub-inspired multi-tenant federation
3. **MLS Implementation** - Full RFC 9420 support for group encryption
4. **Compression** - Negotiated compression (gzip, Brotli, zstd)
5. **Prioritization** - HTTP/2 stream prioritization for critical envelopes
6. **QUIC Transport** - Low-latency transport for real-time streaming

---

*End of UEP v2.0 Specification*
