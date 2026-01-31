# Universal Envelope Protocol (UEP) v2.0 Specification

> **Version**: 2.0.0  
> **Last Updated**: January 31, 2026  
> **Status**: Production  
> **RADIANT Version**: 5.52.58+

## Table of Contents

1. [Overview](#overview)
2. [Envelope Structure](#envelope-structure)
3. [Integration Points](#integration-points)
4. [Storage Architecture](#storage-architecture)
5. [Compliance & Security](#compliance--security)
6. [API Reference](#api-reference)
7. [Migration Guide](#migration-guide)
8. [Best Practices](#best-practices)

---

## Overview

The Universal Envelope Protocol (UEP) v2.0 is RADIANT's standardized format for wrapping all AI interactions, method executions, and data flows. It provides:

- **Unified Tracing**: Distributed trace IDs across all services
- **Regulatory Compliance**: Built-in PHI/PII detection and retention policies
- **Tiered Storage**: Automatic Hot → Warm → Cold → Glacier transitions
- **Risk Signals**: Standardized safety and quality scoring
- **Audit Trail**: Complete history for compliance and debugging

### Key Benefits

| Benefit | Description |
|---------|-------------|
| **Observability** | End-to-end request tracing across microservices |
| **Compliance** | HIPAA, GDPR, SOC2, FDA, CCPA, PCI-DSS support |
| **Scale** | 1M+ concurrent users via UDS tiered storage |
| **Debugging** | Full pipeline replay and time-travel debugging |
| **Cost Tracking** | Per-request cost attribution |

---

## Envelope Structure

### Core Schema

```typescript
interface UEPEnvelope {
  envelopeId: string;          // UUID v4
  specversion: '2.0';          // Protocol version
  type: string;                // Event type (e.g., 'ai.model.response')
  source: UEPSource;           // Origin metadata
  payload: UEPPayload;         // Request/response data
  tracing: UEPTracing;         // Distributed tracing
  compliance?: UEPCompliance;  // Regulatory metadata
  riskSignals?: UEPRiskSignals; // Safety/quality scores
  extensions?: Record<string, unknown>; // Custom fields
}
```

### Source Block

```typescript
interface UEPSource {
  system: 'RADIANT';           // Always 'RADIANT'
  component: string;           // Service name
  version: string;             // RADIANT version
  tenantId: string;            // Tenant UUID
  userId?: string;             // User UUID (if authenticated)
  sessionId?: string;          // Session ID
}
```

**Component Values**:
- `model-router` - Model Router Service
- `cato-pipeline` - Cato Pipeline Orchestrator
- `agi-orchestrator` - AGI Orchestration Engine
- `cognitive-brain` - Brain Router Service
- `response-synthesis` - Response Synthesis Service
- `think-tank` - Think Tank Consumer App

### Payload Block

```typescript
interface UEPPayload {
  input: UEPInput;
  output?: UEPOutput;
  metadata?: Record<string, unknown>;
}

interface UEPInput {
  type: 'text' | 'multimodal' | 'structured';
  content: unknown;
  tokens?: number;
}

interface UEPOutput {
  type: 'text' | 'multimodal' | 'structured' | 'stream';
  content: unknown;
  tokens?: number;
  finishReason?: string;
}
```

### Tracing Block

```typescript
interface UEPTracing {
  traceId: string;             // 32-char hex (shared across pipeline)
  spanId: string;              // 16-char hex (unique per envelope)
  parentSpanId?: string;       // Parent span for hierarchies
  pipelineId?: string;         // Cato pipeline UUID
  methodId?: string;           // Cato method ID
  sequence?: number;           // Order in pipeline
  timestamp: string;           // ISO 8601
  durationMs?: number;         // Execution time
}
```

### Compliance Block

```typescript
interface UEPCompliance {
  frameworks: string[];        // ['HIPAA', 'GDPR', 'SOC2']
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  containsPHI: boolean;        // Detected by compliance service
  containsPII: boolean;        // Detected by compliance service
  retentionDays: number;       // Minimum retention period
  auditRequired: boolean;      // Requires audit log entry
}
```

### Risk Signals Block

```typescript
interface UEPRiskSignals {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  scores: {
    safety: number;            // 0.0 - 1.0
    compliance: number;        // 0.0 - 1.0
    quality: number;           // 0.0 - 1.0
    cost: number;              // 0.0 - 1.0
  };
  flags: string[];             // Risk indicators
  mitigations?: string[];      // Applied mitigations
}
```

---

## Integration Points

### 1. Model Router

All model responses are wrapped in UEP envelopes:

```typescript
import { uepIntegrationService } from './services/uep';

const response = await modelRouter.chat(request);
const envelope = uepIntegrationService.wrapModelResponse(
  tenantId,
  request,
  response,
  { traceId, complianceFrameworks: ['HIPAA'] }
);

// Store envelope
await uepIntegrationService.storeEnvelope(envelope);
```

### 2. Cato Pipeline

Pipeline methods use UEP v2.0 envelopes:

```typescript
// Create envelope for method input
const envelope = uepIntegrationService.createCatoEnvelope(
  tenantId,
  'method:observer:v1',
  { prompt, context },
  { pipelineId, traceId, sequence: 0 }
);

// Execute method...

// Complete envelope with output
const completed = uepIntegrationService.completeCatoEnvelope(
  envelope,
  { analysis, recommendations },
  { status: 'completed', durationMs: 1234 }
);
```

### 3. AGI Orchestrator

Multi-model orchestration results:

```typescript
const envelope = uepIntegrationService.wrapAGIOrchestration(
  tenantId,
  'council-of-rivals',
  { prompt, mode: 'debate' },
  { response, modelsUsed, totalTokens, totalCost, latencyMs },
  { sessionId, complianceFrameworks }
);
```

### 4. Brain Router

Domain-aware routing results:

```typescript
const envelope = uepIntegrationService.wrapBrainResponse(
  tenantId,
  { prompt, domain: 'medical', subdomain: 'cardiology' },
  { content, selectedModel, proficiencyScore, ... },
  { conversationId, traceId }
);
```

### 5. Response Synthesis

Multi-model synthesis results:

```typescript
const envelope = uepIntegrationService.wrapSynthesizedResponse(
  tenantId,
  'ensemble',
  modelResponses,
  { synthesizedResponse, confidence, reasoning, ... },
  { pipelineId }
);
```

---

## Storage Architecture

UEP envelopes use the UDS (User Data Service) tiered storage infrastructure:

```
Write Path:
  Envelope → Redis (hot) → Kinesis Queue → PostgreSQL (warm) → S3 (cold/glacier)

Read Path:
  ElastiCache → DynamoDB → PostgreSQL → S3
```

### Tier Configuration

| Tier | Storage | Retention | Latency | Use Case |
|------|---------|-----------|---------|----------|
| **Hot** | Redis/ElastiCache | 0-24h | <10ms | Active pipelines |
| **Warm** | Aurora PostgreSQL | 1-90 days | <100ms | Recent queries |
| **Cold** | S3 Standard-IA | 90d-7 years | 1-10s | Archived |
| **Glacier** | S3 Glacier | 7+ years | 1-12h | Compliance |

### Storage API

```typescript
// Store single envelope
await uepIntegrationService.storeEnvelope(envelope, {
  pipelineId,
  ttlSeconds: 86400,
});

// Store batch
await uepIntegrationService.storeEnvelopes(envelopes);

// Retrieve
const envelope = await uepIntegrationService.getEnvelope(tenantId, envelopeId);

// Query by pipeline
const envelopes = await uepIntegrationService.queryEnvelopes({
  tenantId,
  pipelineId,
  limit: 100,
});

// Query by trace
const trace = await uepIntegrationService.queryEnvelopes({
  tenantId,
  traceId,
});
```

### Database Schema

```sql
CREATE TABLE uds_envelopes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  specversion VARCHAR(10) DEFAULT '2.0',
  type VARCHAR(100) NOT NULL,
  source JSONB NOT NULL,
  payload JSONB NOT NULL,
  tracing JSONB,
  compliance JSONB,
  risk_signals JSONB,
  pipeline_id UUID,
  checksum VARCHAR(64) NOT NULL,
  current_tier VARCHAR(20) DEFAULT 'hot',
  s3_key VARCHAR(500),
  contains_phi BOOLEAN DEFAULT false,
  retention_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  -- Indexes for queries
  INDEX idx_tenant (tenant_id),
  INDEX idx_pipeline (pipeline_id),
  INDEX idx_trace ((tracing->>'traceId')),
  INDEX idx_tier (tenant_id, current_tier)
);
```

---

## Compliance & Security

### PHI/PII Detection

The compliance service automatically detects sensitive data:

```typescript
import { getComplianceService } from './services/uep';

const compliance = getComplianceService(pool);
const result = await compliance.scanEnvelope(envelope, ['HIPAA', 'GDPR']);

if (result.containsPHI) {
  // Apply HIPAA retention (6 years)
  envelope.compliance.retentionDays = 2190;
}
```

### Supported Frameworks

| Framework | Requirements |
|-----------|--------------|
| **HIPAA** | PHI encryption, 6-year retention, audit trails |
| **GDPR** | Consent tracking, data subject rights, portability |
| **SOC2** | Access controls, change management, monitoring |
| **FDA 21 CFR Part 11** | Electronic signatures, audit trails |
| **CCPA** | Consumer privacy rights |
| **PCI-DSS** | Payment data protection |

### Encryption

Envelopes can be encrypted at rest and in transit:

```typescript
import { getSecurityService } from './services/uep';

const security = getSecurityService(pool);

// Encrypt envelope
const encrypted = await security.encryptEnvelope(envelope, recipientKeyId);

// Sign envelope
const signed = await security.signEnvelope(envelope, signingKeyId);
```

---

## API Reference

### UEP Integration Service

```typescript
class UEPIntegrationService {
  // Model Router
  wrapModelResponse(tenantId, request, response, options): UEPEnvelope;
  
  // Cato Pipeline
  createCatoEnvelope(tenantId, methodId, input, options): UEPEnvelope;
  completeCatoEnvelope(envelope, output, options): UEPEnvelope;
  migrateCatoEnvelope(tenantId, v1Envelope, options): UEPEnvelope;
  
  // AGI Orchestrator
  wrapAGIOrchestration(tenantId, type, input, result, options): UEPEnvelope;
  
  // Brain Router
  wrapBrainResponse(tenantId, request, response, options): UEPEnvelope;
  
  // Response Synthesis
  wrapSynthesizedResponse(tenantId, type, inputs, result, options): UEPEnvelope;
  
  // Storage
  storeEnvelope(envelope, options): Promise<StoredEnvelope>;
  storeEnvelopes(envelopes, options): Promise<StoredEnvelope[]>;
  getEnvelope(tenantId, envelopeId): Promise<StoredEnvelope | null>;
  queryEnvelopes(options): Promise<StoredEnvelope[]>;
  
  // Tracing
  createChildSpan(parentEnvelope): { traceId, spanId, parentSpanId };
  linkEnvelopes(envelopes): UEPEnvelope[];
}
```

### UEP Storage Adapter

```typescript
class UEPUDSStorageAdapter {
  store(tenantId, envelope, options): Promise<StoredEnvelope>;
  storeBatch(tenantId, envelopes, options): Promise<StoredEnvelope[]>;
  get(tenantId, envelopeId): Promise<StoredEnvelope | null>;
  query(options): Promise<StoredEnvelope[]>;
  getTierHealth(tenantId): Promise<TierHealth>;
  runHousekeeping(tenantId): Promise<void>;
  archiveOldEnvelopes(tenantId): Promise<{ promoted, errors }>;
}
```

### UEP Compliance Service

```typescript
class UEPComplianceService {
  scanEnvelope(envelope, frameworks): Promise<ComplianceResult>;
  auditEnvelope(envelope, tenantId): Promise<AuditResult>;
  getFrameworkRequirements(framework): FrameworkRequirements;
}
```

---

## Migration Guide

### From Cato v1 Envelopes

```typescript
// Old v1 envelope
const v1Envelope: CatoMethodEnvelope = {
  envelopeId: 'abc-123',
  methodId: 'method:observer:v1',
  pipelineId: 'pipe-456',
  traceId: 'trace-789',
  input: { prompt: 'Hello' },
  output: { status: 'completed', data: { analysis: '...' } },
  riskSignals: { level: 'low', scores: { safety: 0.95 }, flags: [] },
  createdAt: '2026-01-31T00:00:00Z',
};

// Migrate to v2
const v2Envelope = uepIntegrationService.migrateCatoEnvelope(
  tenantId,
  v1Envelope,
  { complianceFrameworks: ['HIPAA'] }
);
```

### Database Migration

Run migration `V2026_01_31_001__uds_envelopes.sql` to create the envelope storage table.

---

## Best Practices

### 1. Always Include Trace IDs

```typescript
// Good: Pass trace ID through the call chain
const traceId = request.headers['x-trace-id'] || generateTraceId();
const envelope = createEnvelope(tenantId, input, { traceId });
```

### 2. Set Compliance Frameworks Early

```typescript
// Good: Set frameworks based on tenant config
const frameworks = tenant.hipaaEnabled ? ['HIPAA'] : [];
const envelope = createEnvelope(tenantId, input, { complianceFrameworks: frameworks });
```

### 3. Store Envelopes Asynchronously

```typescript
// Good: Fire-and-forget storage
uepIntegrationService.storeEnvelope(envelope).catch(err => 
  logger.warn('Envelope storage failed', { envelopeId: envelope.envelopeId, err })
);
```

### 4. Use Batch Storage for Pipelines

```typescript
// Good: Store all pipeline envelopes in batch
const envelopes = pipelineResults.map(r => r.envelope);
await uepIntegrationService.storeEnvelopes(envelopes);
```

### 5. Link Envelopes for Distributed Traces

```typescript
// Good: Link related envelopes
const linkedEnvelopes = uepIntegrationService.linkEnvelopes([
  observerEnvelope,
  validatorEnvelope,
  executorEnvelope,
]);
```

---

## File Reference

| File | Purpose |
|------|---------|
| `services/uep/index.ts` | Service exports |
| `services/uep/integration.service.ts` | Integration adapters for all services |
| `services/uep/uds-storage-adapter.service.ts` | UDS tiered storage integration |
| `services/uep/compliance.service.ts` | Regulatory compliance checks |
| `services/uep/security.service.ts` | Encryption and signing |
| `services/uep/stream-manager.service.ts` | Streaming envelope support |
| `services/uep/envelope-builder.service.ts` | Low-level envelope construction |
| `services/uep/migration.service.ts` | v1 → v2 migration utilities |
| `middleware/uep-middleware.ts` | Lambda/API middleware for UEP wrapping |
| `thinktank/uep-integration.ts` | Think Tank specific UEP integration |
| `services/cato-method-executor.service.ts` | Cato pipeline UEP integration |
| `migrations/V2026_01_31_001__uds_envelopes.sql` | Database schema |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2026-01-31 | UDS integration, platform-wide adoption |
| 1.5.0 | 2026-01-30 | Compliance service, tiered storage |
| 1.0.0 | 2026-01-15 | Initial Cato-only implementation |
