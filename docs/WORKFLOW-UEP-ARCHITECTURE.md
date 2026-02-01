# Workflow UEP Architecture v2.0

> **RADIANT v5.52.58** | Universal Envelope Protocol Integration for Workflow Orchestration

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Key Design Principles](#3-key-design-principles)
4. [UEP Node Service](#4-uep-node-service)
5. [Condition Evaluators](#5-condition-evaluators)
6. [Stream Evaluation Modes](#6-stream-evaluation-modes)
7. [Envelope Transformation](#7-envelope-transformation)
8. [Database Schema](#8-database-schema)
9. [Integration Guide](#9-integration-guide)
10. [API Reference](#10-api-reference)
11. [Best Practices](#11-best-practices)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Overview

The Workflow UEP Architecture integrates the Universal Envelope Protocol (UEP) v2.0 into RADIANT's workflow orchestration system. This provides:

- **Standardized Data Exchange**: All workflow node inputs/outputs wrapped in UEP envelopes
- **Model-Agnostic Conditions**: Evaluate output content, not model identity
- **Stream-Based Evaluation**: Handle parallel model outputs with configurable evaluation modes
- **AI-Interpreted Conditions**: Natural language condition evaluation
- **Complete Traceability**: End-to-end distributed tracing across workflow nodes
- **Compliance Integration**: Automatic compliance framework tagging and audit trails

### Key Files

| Component | Location |
|-----------|----------|
| UEP Node Service | `lambda/shared/services/workflow/uep-node.service.ts` |
| Workflow Engine | `lambda/shared/services/workflow-engine.ts` |
| Orchestration Patterns | `lambda/shared/services/orchestration-patterns.service.ts` |
| Database Migration | `migrations/V2026_01_31_003__workflow_uep_integration.sql` |

---

## 2. Architecture

### 2.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WORKFLOW EXECUTION                                   │
│                                                                              │
│  ┌──────────┐    UEP     ┌───────────┐    UEP     ┌──────────┐             │
│  │  Node A  │───────────▶│  Link AB  │───────────▶│  Node B  │             │
│  │          │  Envelope  │           │  Envelope  │          │             │
│  │ AI Call  │            │ Condition │            │ AI Call  │             │
│  │          │            │ Evaluator │            │          │             │
│  └──────────┘            └─────┬─────┘            └──────────┘             │
│       │                        │                        │                   │
│       │                        │                        │                   │
│       ▼                        ▼                        ▼                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    UEP STORAGE (UDS TIERED)                          │   │
│  │   Hot (Redis) → Warm (PostgreSQL) → Cold (S3) → Glacier             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Envelope Flow

1. **Node Input**: Create input envelope with source linkage
2. **Node Execution**: AI model invocation (may be parallel)
3. **Condition Evaluation**: Evaluate conditions on output content
4. **Envelope Transformation**: Apply transforms based on condition results
5. **Node Output**: Complete output envelope with metrics
6. **Storage**: Persist to UDS tiered storage

### 2.3 Component Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                     WorkflowEngine                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ startExecutionWithUEP()  │  executeTaskWithUEP()          │  │
│  │ completeTaskWithUEP()    │  getUEPContext()               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    UEPNodeService                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐│  │
│  │  │  Envelope   │  │  Condition  │  │     Envelope        ││  │
│  │  │  Creation   │  │  Evaluation │  │   Transformation    ││  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘│  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   UDS Tiered Storage                       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Key Design Principles

### 3.1 Model-Agnostic Conditions

**Critical Design Decision**: Conditions evaluate OUTPUT CONTENT, not model identity.

**Why?**
- Users can change AI models in methods at any time
- Workflow logic should not break when models are swapped
- Conditions should be portable across different model configurations

**Example**:
```typescript
// ✅ CORRECT: Evaluate content
const condition: NodeCondition = {
  type: 'expression',
  expression: 'output.confidence > 0.8 && output.category === "technical"',
  streamMode: 'any',
};

// ❌ WRONG: Don't bind conditions to specific models
// condition: 'modelId === "claude-3-sonnet" && ...'
```

### 3.2 Stream-Based Processing

Workflows support parallel model execution with configurable result aggregation:

```
                    ┌─────────────┐
                    │   Prompt    │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  Model A    │ │  Model B    │ │  Model C    │
    │  (Stream 1) │ │  (Stream 2) │ │  (Stream 3) │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           ▼
                 ┌─────────────────────┐
                 │ Condition Evaluator │
                 │  (Stream Mode: ANY) │
                 └──────────┬──────────┘
                            ▼
                 ┌─────────────────────┐
                 │  Aggregate/Select   │
                 └─────────────────────┘
```

### 3.3 UEP Envelope Linking

Every envelope maintains parent-child relationships for complete traceability:

```typescript
{
  envelopeId: "abc-123",
  payload: {
    input: {
      fromNodeId: "node_a",           // Previous node
      fromEnvelopeId: "xyz-789",      // Parent envelope
      content: { ... }
    }
  },
  tracing: {
    traceId: "trace-001",             // Workflow trace
    spanId: "span-002",               // This node's span
    parentSpanId: "span-001",         // Parent node's span
    workflowSpanId: "span-root"       // Workflow root span
  }
}
```

---

## 4. UEP Node Service

### 4.1 Service Overview

The `UEPNodeService` is the central integration point for workflow UEP operations:

```typescript
import { uepNodeService } from './workflow/index.js';

// Create input envelope
const inputEnvelope = uepNodeService.createInputEnvelope(
  nodeId,
  nodeName,
  nodeType,
  input,
  context,
  sourceEnvelope
);

// Complete with output
const outputEnvelope = uepNodeService.completeOutputEnvelope(
  inputEnvelope,
  output,
  { streams, modelInfo, usage, riskSignals, metadata }
);

// Evaluate conditions
const result = await uepNodeService.evaluateCondition(
  condition,
  outputEnvelope,
  context
);

// Apply transformations
const transformed = uepNodeService.applyEnvelopeTransform(
  outputEnvelope,
  transform,
  evaluationResult
);

// Store envelope
await uepNodeService.storeEnvelope(outputEnvelope);
```

### 4.2 Envelope Structure

```typescript
interface WorkflowUEPEnvelope {
  envelopeId: string;
  specversion: '2.0';
  type: string;
  
  source: {
    system: 'RADIANT';
    component: 'workflow-engine';
    version: string;
    tenantId: string;
    userId?: string;
  };
  
  workflow: {
    workflowId: string;
    workflowCode: string;
    executionId: string;
    nodeId: string;
    nodeName: string;
    nodeType: NodeType;
    stepOrder: number;
  };
  
  payload: {
    input: { type, content, fromNodeId?, fromEnvelopeId? };
    output: { type, content, finishReason?, streams? };
    metadata?: Record<string, unknown>;
  };
  
  modelInfo?: {
    modelId: string;
    modelName?: string;
    mode?: string;
    provider?: string;
    modelsUsed?: string[];  // For parallel execution
  };
  
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costCents: number;
    latencyMs: number;
  };
  
  tracing: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    workflowSpanId: string;
    timestamp: string;
    durationMs: number;
  };
  
  compliance?: {
    frameworks: string[];
    dataClassification: string;
    auditRequired: boolean;
    phiDetected?: boolean;
    piiDetected?: boolean;
  };
  
  riskSignals?: {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    scores: Record<string, number>;
    flags: string[];
    evaluationResults?: ConditionEvaluationResult[];
  };
}
```

---

## 5. Condition Evaluators

### 5.1 Condition Types

#### Expression Conditions
JavaScript-like expressions evaluated against output content:

```typescript
const expressionCondition: NodeCondition = {
  conditionId: 'cond-001',
  name: 'High Confidence Check',
  type: 'expression',
  expression: 'output.confidence > 0.8 && !contains("error")',
  streamMode: 'any',
  onTrue: { type: 'continue' },
  onFalse: { type: 'retry', maxRetries: 3 },
};
```

**Available Helpers**:
- `hasField(field)` - Check if field exists in output
- `getField(field, default?)` - Get field value with optional default
- `length()` - Get content length
- `contains(text)` - Check if content contains text (case-insensitive)

#### AI-Interpreted Conditions
Natural language conditions evaluated by AI:

```typescript
const aiCondition: NodeCondition = {
  conditionId: 'cond-002',
  name: 'Quality Check',
  type: 'ai_interpreted',
  aiPrompt: 'Is this response helpful, on-topic, and free of safety concerns?',
  aiModel: 'groq/llama-3.1-8b-instant',  // Optional, uses fast model by default
  aiThreshold: 0.7,  // Confidence threshold
  streamMode: 'all',
  onTrue: { type: 'continue' },
  onFalse: { type: 'branch', targetNodeId: 'fallback_node' },
};
```

**Important**: AI evaluators judge content quality and relevance, NOT which model produced it.

#### Composite Conditions
Combine multiple conditions with logical operators:

```typescript
const compositeCondition: NodeCondition = {
  conditionId: 'cond-003',
  name: 'Combined Check',
  type: 'composite',
  operator: 'AND',
  subConditions: [
    { type: 'expression', expression: 'output.length() > 100', streamMode: 'any' },
    { type: 'ai_interpreted', aiPrompt: 'Is this grammatically correct?', streamMode: 'all' },
  ],
  streamMode: 'any',
};
```

**Operators**: `AND`, `OR`, `NOT`, `XOR`

### 5.2 Condition Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `continue` | Proceed to next node | - |
| `branch` | Jump to specific node | `targetNodeId` |
| `retry` | Retry current node | `maxRetries`, `retryDelayMs` |
| `fail` | Fail workflow | `errorMessage` |
| `skip` | Skip downstream nodes | - |
| `transform` | Apply envelope transformation | `transform` |

---

## 6. Stream Evaluation Modes

When workflows execute AI models in parallel, conditions must decide how to evaluate multiple outputs.

### 6.1 Available Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `all` | ALL streams must pass | Consensus required |
| `any` | ANY stream passing is sufficient | First success wins |
| `majority` | >50% of streams must pass | Democratic voting |
| `quorum` | Configurable threshold (0.0-1.0) | Custom threshold |
| `best` | Select highest-confidence stream | Quality selection |
| `unanimous` | 100% agreement required | Critical decisions |
| `weighted` | Weight by confidence scores | Confidence-based voting |

### 6.2 Configuration

```typescript
const streamConfig: StreamEvaluationConfig = {
  mode: 'quorum',
  quorumThreshold: 0.66,  // 2/3 majority
  minConfidence: 0.5,      // Ignore low-confidence streams
  aggregateOutputs: true,
  aggregationStrategy: 'merge',  // 'merge' | 'best' | 'vote' | 'concatenate'
};
```

### 6.3 Stream Selection After Evaluation

After condition evaluation, use envelope transformation to select which streams continue:

```typescript
const transform: EnvelopeTransform = {
  selectStreams: {
    mode: 'all_passing',  // Only streams that passed condition
  },
  addMetadata: {
    conditionApplied: 'quality_filter',
    originalStreamCount: 3,
  },
};
```

---

## 7. Envelope Transformation

Transformations modify the UEP envelope based on condition results.

### 7.1 Transform Options

```typescript
interface EnvelopeTransform {
  // Add metadata
  addMetadata?: Record<string, unknown>;
  
  // Set compliance flags
  setCompliance?: {
    frameworks?: string[];
    dataClassification?: string;
    auditRequired?: boolean;
  };
  
  // Add risk signals
  addRiskSignals?: {
    flags?: string[];
    scores?: Record<string, number>;
  };
  
  // Select specific streams from parallel output
  selectStreams?: {
    mode: 'top_n' | 'threshold' | 'all_passing';
    n?: number;
    threshold?: number;
  };
}
```

### 7.2 Examples

#### Mark for Compliance Review
```typescript
{
  setCompliance: {
    frameworks: ['HIPAA', 'SOC2'],
    auditRequired: true,
  },
  addRiskSignals: {
    flags: ['PHI_DETECTED'],
    scores: { phi_risk: 0.85 },
  },
}
```

#### Select Top 2 Responses
```typescript
{
  selectStreams: {
    mode: 'top_n',
    n: 2,
  },
  addMetadata: {
    selectionReason: 'top_confidence',
  },
}
```

---

## 8. Database Schema

### 8.1 New Tables

#### workflow_condition_evaluations
Audit trail for all condition evaluations:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | VARCHAR | Tenant isolation |
| workflow_execution_id | VARCHAR | Execution reference |
| node_id | VARCHAR | Node that was evaluated |
| condition_id | VARCHAR | Condition definition |
| condition_type | VARCHAR | 'expression', 'ai_interpreted', 'composite' |
| stream_mode | VARCHAR | Evaluation mode used |
| passed | BOOLEAN | Final result |
| confidence | NUMERIC | Confidence score |
| stream_results | JSONB | Per-stream results |
| ai_interpretation | JSONB | AI reasoning (if applicable) |
| evaluation_duration_ms | INTEGER | Evaluation time |
| evaluation_cost_cents | NUMERIC | AI evaluation cost |
| envelope_id | UUID | Link to UEP envelope |

#### workflow_node_conditions
Stored condition definitions:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| condition_id | VARCHAR | Unique condition identifier |
| name | VARCHAR | Human-readable name |
| condition_type | VARCHAR | Type of condition |
| expression | TEXT | For expression conditions |
| ai_prompt | TEXT | For AI-interpreted conditions |
| stream_mode | VARCHAR | How to evaluate streams |
| on_true_action | JSONB | Action when true |
| on_false_action | JSONB | Action when false |
| envelope_transform | JSONB | Transform to apply |

#### workflow_uep_envelopes
Links workflow nodes to UEP storage:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| envelope_id | UUID | UEP envelope reference |
| workflow_execution_id | VARCHAR | Execution reference |
| node_id | VARCHAR | Node reference |
| trace_id | VARCHAR | Distributed trace |
| from_envelope_id | UUID | Parent envelope link |

### 8.2 Modified Tables

#### workflow_executions
Added columns:
- `root_envelope_id` - Root UEP envelope for workflow
- `trace_id` - Distributed tracing ID
- `workflow_span_id` - Root span for workflow
- `compliance_frameworks` - Active compliance frameworks

#### task_executions
Added columns:
- `input_envelope_id` - Input UEP envelope
- `output_envelope_id` - Output UEP envelope
- `span_id` - Node's span ID
- `condition_results` - Results of condition evaluations

---

## 9. Integration Guide

### 9.1 Starting a UEP-Aware Workflow

```typescript
import { workflowEngine } from './workflow-engine.js';

// Start with UEP support
const { executionId, traceId, workflowSpanId } = await workflowEngine.startExecutionWithUEP(
  'workflow-123',           // Workflow ID
  'document_analysis',      // Workflow code
  tenantId,
  userId,
  { document: 'content...' }, // Input parameters
  {
    enableUEP: true,
    complianceFrameworks: ['SOC2', 'GDPR'],
    traceId: existingTraceId,  // Optional: link to existing trace
  }
);
```

### 9.2 Executing Tasks with UEP

```typescript
// Get execution context
const context = await workflowEngine.getUEPContext(executionId);

// Execute task with UEP envelope
const { taskExecutionId, inputEnvelope } = await workflowEngine.executeTaskWithUEP(
  executionId,
  'task-001',
  'Extract Entities',
  'model_inference',
  inputData,
  context,
  previousEnvelope  // Optional: link to source
);

// ... perform AI model call ...

// Complete task with UEP
const outputEnvelope = await workflowEngine.completeTaskWithUEP(
  taskExecutionId,
  inputEnvelope,
  modelOutput,
  {
    status: 'completed',
    usage: {
      inputTokens: 150,
      outputTokens: 320,
      costCents: 0.5,
      latencyMs: 1200,
    },
    modelInfo: { modelId: 'claude-3-sonnet', mode: 'standard' },
  }
);
```

### 9.3 Evaluating Conditions

```typescript
import { uepNodeService } from './workflow/index.js';

// Define condition
const condition: NodeCondition = {
  conditionId: 'quality-check',
  name: 'Output Quality Check',
  type: 'ai_interpreted',
  aiPrompt: 'Is this extraction accurate and complete?',
  streamMode: 'any',
  onTrue: { type: 'continue' },
  onFalse: { type: 'retry', maxRetries: 2 },
};

// Evaluate
const result = await uepNodeService.evaluateCondition(
  condition,
  outputEnvelope,
  context
);

if (result.passed) {
  // Continue to next node
} else if (condition.onFalse?.type === 'retry') {
  // Handle retry logic
}
```

---

## 10. API Reference

### 10.1 UEPNodeService Methods

#### createInputEnvelope
```typescript
createInputEnvelope(
  nodeId: string,
  nodeName: string,
  nodeType: NodeType,
  input: unknown,
  context: NodeExecutionContext,
  sourceEnvelope?: WorkflowUEPEnvelope
): WorkflowUEPEnvelope
```

#### completeOutputEnvelope
```typescript
completeOutputEnvelope(
  envelope: WorkflowUEPEnvelope,
  output: unknown,
  options: {
    streams?: StreamOutput[];
    modelInfo?: { modelId, modelName?, mode?, provider?, modelsUsed? };
    usage: { inputTokens, outputTokens, totalTokens, costCents, latencyMs };
    riskSignals?: { overallRisk, scores, flags, evaluationResults? };
    metadata?: Record<string, unknown>;
  }
): WorkflowUEPEnvelope
```

#### evaluateCondition
```typescript
async evaluateCondition(
  condition: NodeCondition,
  envelope: WorkflowUEPEnvelope,
  context: NodeExecutionContext
): Promise<ConditionEvaluationResult>
```

#### applyEnvelopeTransform
```typescript
applyEnvelopeTransform(
  envelope: WorkflowUEPEnvelope,
  transform: EnvelopeTransform,
  evaluationResult?: ConditionEvaluationResult
): WorkflowUEPEnvelope
```

#### storeEnvelope
```typescript
async storeEnvelope(envelope: WorkflowUEPEnvelope): Promise<void>
```

### 10.2 WorkflowEngine UEP Methods

#### startExecutionWithUEP
```typescript
async startExecutionWithUEP(
  workflowId: string,
  workflowCode: string,
  tenantId: string,
  userId: string,
  inputParameters: Record<string, unknown>,
  options?: UEPExecutionOptions
): Promise<{ executionId: string; traceId: string; workflowSpanId: string }>
```

#### executeTaskWithUEP
```typescript
async executeTaskWithUEP(
  executionId: string,
  taskId: string,
  taskName: string,
  taskType: TaskType,
  input: unknown,
  context: NodeExecutionContext,
  sourceEnvelope?: WorkflowUEPEnvelope
): Promise<{ taskExecutionId: string; inputEnvelope: WorkflowUEPEnvelope }>
```

#### completeTaskWithUEP
```typescript
async completeTaskWithUEP(
  taskExecutionId: string,
  inputEnvelope: WorkflowUEPEnvelope,
  output: unknown,
  options: {
    status: TaskStatus;
    usage: { inputTokens, outputTokens, costCents, latencyMs };
    modelInfo?: { modelId, mode? };
    error?: { message, code? };
  }
): Promise<WorkflowUEPEnvelope>
```

---

## 11. Best Practices

### 11.1 Condition Design

**DO**:
- ✅ Write conditions that evaluate content quality
- ✅ Use expression conditions for structured output checks
- ✅ Use AI conditions for subjective quality assessment
- ✅ Set appropriate confidence thresholds
- ✅ Include fallback actions (retry, branch)

**DON'T**:
- ❌ Bind conditions to specific model IDs
- ❌ Assume output format from a specific model
- ❌ Use AI conditions for simple field checks (expensive)
- ❌ Set stream mode to 'all' without good reason

### 11.2 Stream Mode Selection

| Scenario | Recommended Mode |
|----------|------------------|
| Need any valid response | `any` |
| Need consistent quality | `majority` |
| Critical decision point | `unanimous` |
| Want best quality | `best` |
| Custom threshold | `quorum` with threshold |

### 11.3 Performance Optimization

1. **Use expression conditions** for simple checks (zero cost)
2. **Use fast models** for AI interpretation (`groq/llama-3.1-8b-instant`)
3. **Set minConfidence** to filter low-quality streams early
4. **Cache condition results** for repeated evaluations

---

## 12. Troubleshooting

### 12.1 Common Issues

#### Condition Always Fails
- Check expression syntax
- Verify output structure matches expected format
- Lower AI threshold if too strict
- Check stream mode (may need `any` instead of `all`)

#### High Evaluation Costs
- Switch to expression conditions where possible
- Use cheaper AI models for interpretation
- Reduce stream count in parallel execution
- Cache repeated condition evaluations

#### Missing Envelope Links
- Ensure `sourceEnvelope` is passed when creating new envelopes
- Check `fromEnvelopeId` in payload
- Verify trace/span IDs are propagated

### 12.2 Debugging

```sql
-- View condition evaluation history
SELECT 
  condition_name, 
  condition_type,
  stream_mode,
  passed,
  confidence,
  ai_interpretation,
  evaluation_duration_ms
FROM workflow_condition_evaluations
WHERE workflow_execution_id = 'exec-123'
ORDER BY created_at;

-- View UEP envelope trace
SELECT * FROM v_workflow_uep_trace
WHERE workflow_execution_id = 'exec-123'
ORDER BY step_order;

-- Check condition statistics
SELECT * FROM v_condition_evaluation_stats
WHERE tenant_id = 'tenant-123'
  AND evaluation_date >= NOW() - INTERVAL '7 days';
```

---

## 13. Subsystem UEP Integration Boundaries

Understanding which subsystems are UEP-aware and why:

### 13.1 UEP-Aware Subsystems (Produce Envelopes)

| Subsystem | Status | Integration Point | Why |
|-----------|--------|-------------------|-----|
| **Cato Methods** | ✅ Full | `CatoBaseMethodExecutor.storeToUEP()` | All pipeline methods wrap outputs |
| **Workflow Engine** | ✅ Full | `uep-node.service.ts` | All node I/O wrapped in envelopes |
| **Orchestration Methods** | ✅ Full | `executeMethodWithUEP()` | 70+ methods wrap outputs |
| **Model Router** | ✅ Full | `uepIntegrationService.wrapModelResponse()` | All model responses wrapped |
| **Brain Router** | ✅ Full | `uepIntegrationService.wrapBrainResponse()` | Domain-aware responses wrapped |
| **AGI Orchestrator** | ✅ Full | `uepIntegrationService.wrapAGIOrchestration()` | Multi-model orchestration |
| **Response Synthesis** | ✅ Full | `uepIntegrationService.wrapSynthesizedResponse()` | Ensemble/merge outputs |

### 13.2 Non-UEP Subsystems (Memory/Storage)

| Subsystem | Status | Reason |
|-----------|--------|--------|
| **Cortex** | ⚪ Not needed | Memory retrieval system - doesn't generate AI outputs. UEP wrapping happens when Cortex data is *used* in AI calls. |
| **UDS** | ⚪ Not needed | Storage layer - UEP envelopes are stored *in* UDS, not wrapped *by* it. |
| **Blackboard** | ⚪ Not needed | State coordination - distributes data, doesn't generate AI outputs. |

### 13.3 Architecture Decision

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        UEP ENVELOPE WRAPPING LAYER                          │
│                                                                              │
│   AI Generation ──────────────────────────────────────────▶ UEP Envelope   │
│   (Cato, Workflow, Orchestration, Model Router, Brain)                      │
│                                                                              │
└────────────────────────────────────────────────┬────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MEMORY/STORAGE LAYER                                  │
│                                                                              │
│   Cortex (retrieval) ◄──── Envelopes ────▶ UDS (storage)                   │
│                                                                              │
│   These systems HANDLE envelopes but don't PRODUCE them                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Rule**: UEP envelope wrapping happens at the **point of AI generation**, not at memory retrieval or storage. This keeps the boundary clean and avoids double-wrapping.

### 13.4 Using Orchestration Methods with UEP

```typescript
// NEW: With UEP envelope wrapping (recommended)
const result = await orchestrationMethodsService.executeMethodWithUEP(
  'semantic-entropy-service',
  { prompt: 'What is 2+2?', tenantId },
  { sample_count: 10 },
  {
    tenantId,
    userId,
    traceId: parentEnvelope.tracing.traceId,
    parentSpanId: parentEnvelope.tracing.spanId,
    complianceFrameworks: ['SOC2'],
  }
);

// result.envelope contains UEP envelope info
console.log(result.envelope.envelopeId); // UUID
console.log(result.output.uncertainty);   // 0.23

// LEGACY: Without UEP (still supported)
const rawResult = await orchestrationMethodsService.executeMethod(
  'semantic-entropy-service',
  { prompt: 'What is 2+2?', tenantId },
  { sample_count: 10 }
);
```

---

## 14. AI Curator UEP Integration

The Curator service uses AI for document extraction, question generation, and answer verification—all with full UEP tracing.

### 14.1 AI Curator Service

**Location**: `lambda/shared/services/curator/ai-curator.service.ts`

**Methods**:
- `extractKnowledge(request, context)` - AI-powered document extraction
- `generateExamQuestions(request, context)` - Generate entrance exam questions
- `verifyAnswer(request, context)` - Verify user answers with AI

### 14.2 UEP Envelope Types

| Operation | Envelope Type | Purpose |
|-----------|---------------|---------|
| Document extraction | `curator.extraction` | Track AI-extracted facts, entities, concepts |
| Question generation | `curator.question_generation` | Track generated exam questions |
| Answer verification | `curator.answer_verification` | Track AI verification results |

### 14.3 Usage Example

```typescript
import { aiCuratorService } from './curator/ai-curator.service';

// Extract knowledge from document
const extraction = await aiCuratorService.extractKnowledge({
  documentId: 'doc-123',
  documentContent: documentText,
  documentType: 'pdf',
  extractTypes: ['facts', 'entities', 'concepts'],
}, {
  tenantId,
  userId,
  traceId: parentTraceId,
  complianceFrameworks: ['SOC2'],
});

console.log(extraction.extractedItems);       // Array of ExtractedKnowledge
console.log(extraction.envelope.envelopeId);  // UEP envelope ID
console.log(extraction.envelope.stored);       // true if persisted

// Generate exam questions
const questions = await aiCuratorService.generateExamQuestions({
  knowledgeNodes: extraction.extractedItems,
  questionCount: 10,
  difficulty: 'medium',
  includeAmbiguity: true,
  includeLogicChecks: true,
}, { tenantId, userId });

// Verify an answer
const verification = await aiCuratorService.verifyAnswer({
  questionId: questions.questions[0].id,
  questionType: 'fact_check',
  statement: 'The CEO is John Smith',
  userAnswer: true,
  sourceContent: 'John Smith was appointed CEO in 2024...',
}, { tenantId, userId });

if (verification.shouldCreateGoldenRule) {
  // User correction should become a Golden Rule
  console.log(verification.goldenRuleReason);
}
```

---

## 15. UEP Self-Healing System

Ensures UEP data durability across system restarts and isolated failures.

### 15.1 Service Overview

**Location**: `lambda/shared/services/uep/self-healing.service.ts`

The self-healing service detects and repairs:
- Partially written S3 objects
- Uncommitted database records
- Orphaned envelopes
- Corrupted checksum mismatches
- Stale transactions
- Memory buffer leaks

### 15.2 Execution Modes

| Mode | Trigger | Use Case |
|------|---------|----------|
| `startup` | Lambda cold start / system boot | Recover from crashes |
| `scheduled` | EventBridge (every 15 min) | Proactive maintenance |
| `adhoc` | Admin API call | Manual troubleshooting |

### 15.3 Recovery Lambda

**Location**: `lambda/system/uep-recovery.ts`

**Admin API Endpoints**:
- `GET /api/admin/uep-recovery/status` - Buffer and healing status
- `POST /api/admin/uep-recovery/heal` - Trigger ad-hoc healing
- `GET /api/admin/uep-recovery/reports` - Recent healing reports
- `GET /api/admin/uep-recovery/quarantine` - View quarantined envelopes
- `POST /api/admin/uep-recovery/quarantine/:id/resolve` - Resolve quarantine

### 15.4 Memory Buffer Durability

```typescript
import { uepSelfHealingService } from './uep/index.js';

// Before async storage operation
uepSelfHealingService.registerPendingEnvelope(envelope);

try {
  await storeEnvelope(envelope);
  // On success, remove from buffer
  uepSelfHealingService.markEnvelopePersisted(envelope.envelopeId);
} catch (error) {
  // Record failure for retry
  uepSelfHealingService.recordWriteFailure(envelope.envelopeId, error.message);
}

// Check buffer status
const status = uepSelfHealingService.getBufferStatus();
console.log(status.pendingCount);        // Number of pending envelopes
console.log(status.oldestPendingAge);    // Age of oldest pending (ms)
console.log(status.failedAttempts);      // Envelopes with failed writes
```

### 15.5 Configuration

```typescript
uepSelfHealingService.updateConfig({
  maxRecoveryAttempts: 5,
  staleTransactionThresholdMinutes: 60,
  quarantineCorruptedData: true,
  autoRepairPartialWrites: true,
  flushMemoryBuffersOnStartup: true,
  verifyChecksumsOnRecovery: true,
});
```

### 15.6 Healing Report

After each healing run, a detailed report is stored:

```typescript
const report = await uepSelfHealingService.runHealing(tenantId, 'adhoc');

console.log(report.summary.totalIssuesFound);
console.log(report.summary.totalIssuesResolved);
console.log(report.summary.partialWritesRecovered);
console.log(report.summary.orphanedEnvelopesFixed);
console.log(report.summary.corruptedEnvelopesQuarantined);

// Individual issues
for (const issue of report.issues) {
  console.log(`${issue.type}: ${issue.description} - ${issue.resolution}`);
}
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2026-01-31 | Initial comprehensive documentation |
| 2.1 | 2026-01-31 | Added subsystem integration boundaries, orchestration methods UEP |
| 2.2 | 2026-01-31 | Added AI Curator UEP integration, Self-Healing system documentation |

---

*This document is part of RADIANT v5.52.58 - Universal Envelope Protocol Integration*
