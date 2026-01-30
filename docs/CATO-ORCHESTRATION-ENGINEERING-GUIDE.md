# CATO Orchestration Engineering Guide

> **Version**: 5.52.53  
> **Last Updated**: 2026-01-28  
> **Purpose**: Complete technical reference for AI analysis of the Cato orchestration system

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Core Components](#2-core-components)
3. [Method Implementations](#3-method-implementations)
4. [Universal Envelope Protocol](#4-universal-envelope-protocol)
5. [Node Connection & Data Flow](#5-node-connection--data-flow)
6. [Stream Transfer Protocol](#6-stream-transfer-protocol)
7. [Context Strategies](#7-context-strategies)
8. [Checkpoint System (HITL)](#8-checkpoint-system-hitl)
9. [Compensation (SAGA Pattern)](#9-compensation-saga-pattern)
10. [Database Schema](#10-database-schema)
11. [API Reference](#11-api-reference)

---

## 1. Architecture Overview

The Cato orchestration system is a **composable AI pipeline** that chains multiple AI "methods" together, where each method processes input and produces a structured output (envelope) that becomes input for the next method.

### 1.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PIPELINE EXECUTION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User Request                                                                │
│       │                                                                      │
│       ▼                                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐ │
│  │ OBSERVER │───▶│ PROPOSER │───▶│ VALIDATOR│───▶│ EXECUTOR │───▶│ RESULT │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └────────┘ │
│       │               │               │               │                      │
│       ▼               ▼               ▼               ▼                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│  │ Envelope │    │ Envelope │    │ Envelope │    │ Envelope │               │
│  │ (CLASS)  │    │ (PROP)   │    │ (ASSESS) │    │ (EXEC)   │               │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Composability** | Methods are independent units that accept/produce typed envelopes |
| **Typed Contracts** | Each method declares `acceptsOutputTypes` and `outputTypes` |
| **Context Pruning** | Configurable strategies to manage context window limits |
| **Risk Assessment** | Every envelope carries `riskSignals` for governance decisions |
| **Human-in-the-Loop** | 5 checkpoint types (CP1-CP5) for approval gates |
| **SAGA Rollback** | Compensation log for reversing failed pipelines |
| **Audit Trail** | Merkle-chained records of all prompts and responses |

---

## 2. Core Components

### 2.1 Component Hierarchy

```
lambda/shared/services/
├── cato-pipeline-orchestrator.service.ts    # Main pipeline execution
├── cato-method-executor.service.ts          # Base class for all methods
├── cato-method-registry.service.ts          # Method definitions & prompts
├── cato-schema-registry.service.ts          # JSON Schema validation
├── cato-tool-registry.service.ts            # Lambda/MCP tool definitions
├── cato-checkpoint.service.ts               # HITL checkpoint management
├── cato-compensation.service.ts             # SAGA rollback
├── cato-merkle.service.ts                   # Audit chain
└── cato-methods/                            # Method implementations
    ├── observer.method.ts
    ├── proposer.method.ts
    ├── validator.method.ts
    ├── executor.method.ts
    ├── decider.method.ts
    └── critics/
        ├── security.critic.ts
        ├── efficiency.critic.ts
        ├── factual.critic.ts
        ├── compliance.critic.ts
        └── red-team.critic.ts
```

### 2.2 CatoPipelineOrchestratorService

**File**: `@/packages/infrastructure/lambda/shared/services/cato-pipeline-orchestrator.service.ts`

The orchestrator is the entry point for pipeline execution:

```typescript
// Lines 96-241: Main execution loop
async executePipeline(options: PipelineExecutionOptions): Promise<PipelineExecutionResult> {
  const traceId = crypto.randomBytes(32).toString('hex');
  const pipelineId = uuidv4();
  
  // Get method chain from template or options
  let methodChain: string[];
  if (options.templateId) {
    template = await this.getTemplate(options.templateId);
    methodChain = template.methodChain;
  } else if (options.methodChain) {
    methodChain = options.methodChain;
  } else {
    methodChain = ['method:observer:v1'];
  }
  
  // Execute each method in sequence
  for (let i = 0; i < methodChain.length; i++) {
    const methodId = methodChain[i];
    
    // Execute method and get envelope
    const result = await this.executeMethod(methodId, {
      pipelineId,
      tenantId: options.tenantId,
      previousEnvelopes: envelopes,
      originalRequest: options.request,
      governancePreset,
    });
    
    envelopes.push(result.envelope);
    
    // Check for checkpoints after this method
    const checkpointResult = await this.evaluateCheckpoints(...);
    if (checkpointResult.waitRequired) {
      // Pause and wait for human approval
      return { execution, finalEnvelope: result.envelope, checkpointsPending };
    }
    
    // Check for risk veto
    if (this.shouldBlockExecution(result.envelope)) {
      // Block execution
      return { execution, finalEnvelope: result.envelope, checkpointsPending };
    }
  }
}
```

**Key Fields in `PipelineExecutionOptions`**:

| Field | Type | Description |
|-------|------|-------------|
| `tenantId` | `string` | Multi-tenant isolation |
| `userId` | `string?` | Optional user context |
| `request` | `Record<string, unknown>` | Original user request |
| `templateId` | `string?` | Pre-defined pipeline template |
| `methodChain` | `string[]?` | Explicit method sequence |
| `governancePreset` | `'COWBOY' \| 'BALANCED' \| 'PARANOID'` | Risk tolerance |

### 2.3 CatoBaseMethodExecutor

**File**: `@/packages/infrastructure/lambda/shared/services/cato-method-executor.service.ts`

Abstract base class that all methods extend:

```typescript
// Lines 61-173: Base executor pattern
export abstract class CatoBaseMethodExecutor<TInput = unknown, TOutput = unknown> {
  protected pool: Pool;
  protected methodRegistry: CatoMethodRegistryService;
  protected schemaRegistry: CatoSchemaRegistryService;
  protected modelRouter: ModelRouterService;
  protected methodDefinition: CatoMethodDefinition | null = null;
  
  abstract getMethodId(): string;
  
  async execute(
    input: TInput,
    context: MethodExecutionContext
  ): Promise<MethodExecutionResult<TOutput>> {
    // 1. Apply context strategy (prune previous envelopes)
    const prunedContext = await this.applyContextStrategy(
      context.previousEnvelopes,
      this.methodDefinition!.contextStrategy.strategy
    );
    
    // 2. Build prompt variables from input
    const promptVariables = await this.buildPromptVariables(input, context, prunedContext);
    
    // 3. Render prompts from templates
    const { systemPrompt, userPrompt } = await this.methodRegistry.renderPrompt(
      this.getMethodId(),
      promptVariables
    );
    
    // 4. Invoke LLM model
    const modelResult = await this.invokeModel(systemPrompt, userPrompt, context);
    
    // 5. Process and validate output
    const processedOutput = await this.processModelOutput(modelResult.parsedOutput, context);
    
    // 6. Calculate confidence score
    const confidence = await this.calculateConfidence(processedOutput, modelResult, context);
    
    // 7. Detect risk signals
    const riskSignals = await this.detectRiskSignals(processedOutput, context);
    
    // 8. Create and persist envelope
    const envelope = await this.createEnvelope(
      processedOutput, confidence, riskSignals, prunedContext, context, spanId, modelResult
    );
    
    return { envelope, invocationId, durationMs, tokensUsed, costCents };
  }
  
  // Abstract methods that subclasses must implement
  protected abstract buildPromptVariables(...): Promise<Record<string, unknown>>;
  protected abstract processModelOutput(...): Promise<TOutput>;
  protected abstract getOutputType(): CatoOutputType;
  protected abstract generateOutputSummary(output: TOutput): string;
}
```

---

## 3. Method Implementations

### 3.1 Observer Method

**File**: `@/packages/infrastructure/lambda/shared/services/cato-methods/observer.method.ts`

**Purpose**: First method in most pipelines. Analyzes incoming requests to classify intent, extract context, and identify required capabilities.

```typescript
// Lines 28-62: Input/Output types
export interface ObserverInput {
  userRequest: string;
  additionalInstructions?: string;
  sessionContext?: {
    previousMessages?: string[];
    userPreferences?: Record<string, unknown>;
    domain?: string;
  };
}

export interface ObserverOutput {
  category: string;                    // Primary classification
  subcategory?: string;
  confidence: number;                  // 0-1 classification confidence
  reasoning: string;                   // Explanation of classification
  alternatives: Array<{ category: string; confidence: number }>;
  domain: {
    detected: string;                  // e.g., "medical", "legal", "general"
    confidence: number;
    keywords: string[];
  };
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  requiredCapabilities: string[];      // e.g., ["code_execution", "web_search"]
  ambiguities: Array<{
    aspect: string;
    description: string;
    suggestedClarification: string;
  }>;
  extractedEntities: Array<{
    type: string;
    value: string;
    relevance: number;
  }>;
  suggestedNextMethods: string[];      // Routing hints
}
```

**Output Type**: `CatoOutputType.CLASSIFICATION`

**Risk Signal Detection** (Lines 168-219):
- `ambiguous_intent` - When ambiguities detected
- `low_classification_confidence` - When confidence < 0.6
- `expert_complexity` - When complexity is "expert"
- `sensitive_domain` - When domain is medical/legal/financial/security

### 3.2 Proposer Method

**File**: `@/packages/infrastructure/lambda/shared/services/cato-methods/proposer.method.ts`

**Purpose**: Generates action proposals based on observations. Creates structured plans with reversibility information and cost estimates.

```typescript
// Lines 47-85: Output types
export interface ProposedAction {
  actionId: string;
  type: string;
  description: string;
  toolId?: string;                     // References tool in ToolRegistry
  inputs: Record<string, unknown>;
  reversible: boolean;
  compensationType: CatoCompensationType;
  compensationStrategy?: string;
  estimatedCostCents: number;
  estimatedDurationMs: number;
  riskLevel: CatoRiskLevel;
  dependencies: string[];              // Other actionIds this depends on
}

export interface ProposerOutput {
  proposalId: string;
  title: string;
  actions: ProposedAction[];           // Ordered list of actions
  rationale: string;
  estimatedImpact: {
    costCents: number;
    durationMs: number;
    riskLevel: CatoRiskLevel;
  };
  alternatives: Array<{
    title: string;
    rationale: string;
    tradeoffs: string;
    estimatedImpact: { ... };
  }>;
  prerequisites: string[];
  assumptions: string[];
  warnings: string[];
}
```

**Output Type**: `CatoOutputType.PROPOSAL`

**Risk Signal Detection** (Lines 233-308):
- `irreversible_actions` - When actions have `reversible: false`
- `high_cost` - When estimated cost > $1.00
- `high_risk_actions` - When actions have HIGH or CRITICAL risk
- `many_assumptions` - When > 3 assumptions
- `proposal_warnings` - When warnings present

### 3.3 Validator Method (Risk Engine)

**File**: `@/packages/infrastructure/lambda/shared/services/cato-methods/validator.method.ts`

**Purpose**: Performs comprehensive risk assessment and triage decisions. Implements veto logic for CRITICAL risks.

```typescript
// Lines 14-33: Input/Output types
export interface ValidatorInput {
  proposal: { proposalId: string; title: string; actions: Array<Record<string, unknown>>; ... };
  critiques?: Array<{ criticType: string; verdict: string; score: number; issues: Array<...> }>;
  governancePreset: 'COWBOY' | 'BALANCED' | 'PARANOID';
}

export interface ValidatorOutput {
  overallRisk: CatoRiskLevel;
  overallRiskScore: number;            // 0-1 aggregate score
  triageDecision: CatoTriageDecision;  // AUTO_EXECUTE | CHECKPOINT_REQUIRED | BLOCKED
  triageReason: string;
  vetoApplied: boolean;
  vetoFactor?: string;
  vetoReason?: string;
  riskFactors: CatoRiskFactor[];
  autoExecuteThreshold: number;        // From governance preset
  vetoThreshold: number;               // From governance preset
  unmitigatedRisks: string[];
  mitigationSuggestions: Array<{
    riskFactorId: string;
    suggestion: string;
    estimatedReduction: number;
  }>;
}
```

**Output Type**: `CatoOutputType.ASSESSMENT`

**Triage Logic** (Lines 88-100):
```typescript
if (vetoApplied) {
  triageDecision = CatoTriageDecision.BLOCKED;
} else if (overallRiskScore >= preset.riskThresholds.autoExecute) {
  triageDecision = CatoTriageDecision.CHECKPOINT_REQUIRED;
} else {
  triageDecision = CatoTriageDecision.AUTO_EXECUTE;
}
```

### 3.4 Executor Method

**File**: `@/packages/infrastructure/lambda/shared/services/cato-methods/executor.method.ts`

**Purpose**: Executes approved proposals by invoking tools (Lambda or MCP). Manages compensation log for SAGA rollback pattern.

```typescript
// Lines 19-42: Output types
export interface ActionResult {
  actionId: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'COMPENSATED';
  startedAt: Date;
  completedAt: Date;
  output?: Record<string, unknown>;
  error?: string;
  compensationExecuted: boolean;
}

export interface ExecutorOutput {
  executionId: string;
  status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'ROLLED_BACK';
  actionsExecuted: ActionResult[];
  artifacts: Array<{ artifactId: string; type: string; uri: string; ... }>;
  totalDurationMs: number;
  totalCostCents: number;
  compensationLog: Array<{
    stepNumber: number;
    actionId: string;
    compensationType: CatoCompensationType;
    status: string;
  }>;
}
```

**Tool Execution** (Lines 137-199):
```typescript
private async executeTool(toolId: string, inputs: Record<string, unknown>, context: MethodExecutionContext) {
  const tool = await this.toolRegistry.getTool(toolId);
  
  if (this.toolRegistry.isLambdaTool(tool)) {
    // Invoke AWS Lambda
    const command = new InvokeCommand({
      FunctionName: this.toolRegistry.getLambdaFunctionName(tool),
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify(payload)),
    });
    const response = await lambdaClient.send(command);
    return { toolId, executed: true, lambdaFunction, result };
  } else {
    // MCP tool invocation via HTTP gateway
    const mcpResponse = await fetch(`${mcpGatewayUrl}/tools/call`, {
      method: 'POST',
      body: JSON.stringify({
        server: mcpServer,
        tool: toolId,
        arguments: inputs,
        context: { tenantId, userId },
      }),
    });
    return { toolId, executed: true, mcpServer, result };
  }
}
```

### 3.5 Decider Method

**File**: `@/packages/infrastructure/lambda/shared/services/cato-methods/decider.method.ts`

**Purpose**: Synthesizes critiques from multiple critics and makes a final decision. Used in War Room deliberation pipelines.

```typescript
// Lines 14-30: Input/Output types
export interface DeciderInput {
  proposal: { proposalId: string; title: string; actions: Array<...> };
  critiques: Array<{
    criticType: string;
    verdict: string;
    score: number;
    issues: Array<...>;
    recommendations: string[];
  }>;
}

export interface DeciderOutput {
  decision: 'PROCEED' | 'PROCEED_WITH_MODIFICATIONS' | 'BLOCK' | 'ESCALATE';
  confidence: number;
  reasoning: string;
  synthesizedIssues: Array<{
    issueId: string;
    severity: CatoRiskLevel;
    description: string;
    source: string;
    resolution: string;
  }>;
  requiredModifications: string[];
  acceptedRisks: string[];
  dissent: Array<{
    criticType: string;
    objection: string;
    weight: number;
  }>;
  consensusLevel: 'UNANIMOUS' | 'MAJORITY' | 'SPLIT' | 'DEADLOCK';
  nextSteps: string[];
}
```

**Output Type**: `CatoOutputType.JUDGMENT`

---

## 4. Universal Envelope Protocol

**File**: `@/packages/shared/src/types/cato-pipeline.types.ts` (Lines 385-419)

The envelope is the **universal data container** that flows between methods. It carries the method output along with metadata for tracing, compliance, risk, and cost tracking.

### 4.1 CatoMethodEnvelope Structure

```typescript
export interface CatoMethodEnvelope<T = unknown> {
  // Identity
  envelopeId: string;                  // Unique ID (UUID)
  pipelineId: string;                  // Parent pipeline
  tenantId: string;                    // Multi-tenant isolation
  sequence: number;                    // Position in pipeline (0-indexed)
  envelopeVersion: string;             // Protocol version (currently "5.0")
  
  // Source method
  source: {
    methodId: string;                  // e.g., "method:observer:v1"
    methodType: CatoMethodType;        // e.g., OBSERVER, PROPOSER
    methodName: string;                // Human-readable name
  };
  
  // Optional routing hint for next method
  destination?: {
    methodId: string;
    routingReason: string;
  };
  
  // The actual output data
  output: {
    outputType: CatoOutputType;        // e.g., CLASSIFICATION, PROPOSAL
    schemaRef: string;                 // JSON Schema reference
    data: T;                           // Typed output payload
    hash: string;                      // SHA-256 of output for integrity
    summary: string;                   // Human-readable summary
  };
  
  // Confidence scoring
  confidence: {
    score: number;                     // 0-1 aggregate score
    factors: CatoConfidenceFactor[];   // Breakdown by factor
  };
  
  // Context management
  contextStrategy: CatoContextStrategy;
  context: CatoAccumulatedContext;     // Pruned history
  
  // Risk signals from this method
  riskSignals: CatoRiskSignal[];
  
  // Distributed tracing
  tracing: {
    traceId: string;                   // 64-char hex trace ID
    spanId: string;                    // 32-char hex span ID
    parentSpanId?: string;             // For nested calls
  };
  
  // Compliance metadata
  compliance: {
    frameworks: string[];              // e.g., ["HIPAA", "SOC2"]
    dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
    containsPii: boolean;
    containsPhi: boolean;
    retentionDays?: number;
  };
  
  // Model usage tracking
  models: CatoModelUsage[];
  
  // Cost/performance metrics
  durationMs: number;
  costCents: number;
  tokensUsed: number;
  timestamp: Date;
}
```

### 4.2 Envelope Persistence

**File**: `@/packages/infrastructure/lambda/shared/services/cato-method-executor.service.ts` (Lines 403-460)

Every envelope is persisted to the `cato_pipeline_envelopes` table:

```typescript
protected async persistEnvelope(envelope: CatoMethodEnvelope<TOutput>): Promise<void> {
  await this.pool.query(
    `INSERT INTO cato_pipeline_envelopes (
      envelope_id, pipeline_id, tenant_id, sequence, envelope_version,
      source_method_id, source_method_type, source_method_name,
      destination_method_id, routing_reason,
      output_type, output_schema_ref, output_data, output_data_hash, output_summary,
      confidence_score, confidence_factors,
      context_strategy, context,
      risk_signals,
      trace_id, span_id, parent_span_id,
      compliance_frameworks, data_classification, contains_pii, contains_phi,
      models_used, duration_ms, cost_cents, tokens_used,
      timestamp
    ) VALUES ($1, $2, $3, ... $32)`,
    [envelope.envelopeId, envelope.pipelineId, ... ]
  );
}
```

---

## 5. Node Connection & Data Flow

### 5.1 Method Chaining

The orchestrator executes methods in sequence. Each method receives the **accumulated context** of all previous envelopes, subject to context pruning.

**File**: `@/packages/infrastructure/lambda/shared/services/cato-pipeline-orchestrator.service.ts` (Lines 419-450)

```typescript
private buildMethodInput(methodDef: CatoMethodDefinition, context: any): any {
  const lastEnvelope = context.previousEnvelopes[context.previousEnvelopes.length - 1];

  switch (methodDef.methodId) {
    case 'method:observer:v1':
      return {
        userRequest: JSON.stringify(context.originalRequest),
        sessionContext: { previousMessages: [] },
      };
      
    case 'method:proposer:v1':
      return {
        observation: lastEnvelope?.output?.data || {},
        userRequest: JSON.stringify(context.originalRequest),
      };
      
    case 'method:critic:security:v1':
      const proposal = context.previousEnvelopes.find(
        e => e.output.outputType === 'PROPOSAL'
      );
      return { proposal: proposal?.output?.data || {} };
      
    case 'method:validator:v1':
      const prop = context.previousEnvelopes.find(
        e => e.output.outputType === 'PROPOSAL'
      );
      const critiques = context.previousEnvelopes
        .filter(e => e.output.outputType === 'CRITIQUE')
        .map(e => e.output.data);
      return { proposal: prop?.output?.data || {}, critiques, governancePreset };
      
    case 'method:executor:v1':
      const propToExec = context.previousEnvelopes.find(
        e => e.output.outputType === 'PROPOSAL'
      );
      return { proposal: propToExec?.output?.data || {}, dryRun: false };
  }
}
```

### 5.2 Type-Safe Routing

Methods declare which output types they can accept:

**File**: `@/packages/shared/src/types/cato-pipeline.types.ts` (Lines 199-230)

```typescript
export interface CatoMethodDefinition {
  methodId: string;
  // ...
  
  // Types this method can consume as input
  acceptsOutputTypes: CatoOutputType[];
  
  // Types this method produces as output
  outputTypes: CatoOutputType[];
  
  // Typical workflow connections
  typicalPredecessors: string[];
  typicalSuccessors: string[];
}
```

The orchestrator can use this for **dynamic routing**:

```typescript
// Find methods that can process a PROPOSAL output
const compatibleMethods = await methodRegistry.findCompatibleMethods(CatoOutputType.PROPOSAL);
// Returns: [validator, security-critic, efficiency-critic, executor, ...]
```

### 5.3 Parallel Execution (Future)

Methods marked as `parallelizable: true` can be run concurrently. The current implementation is sequential, but the architecture supports:

```
┌──────────────────────────────────────────────────────────────┐
│                    PARALLEL CRITIC PATTERN                    │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  PROPOSER ─────┬───▶ SECURITY-CRITIC ───┐                    │
│                │                         │                    │
│                ├───▶ EFFICIENCY-CRITIC ──┼───▶ DECIDER       │
│                │                         │                    │
│                └───▶ COMPLIANCE-CRITIC ──┘                    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Stream Transfer Protocol

### 6.1 Envelope as Transfer Unit

The **CatoMethodEnvelope** is the atomic unit of data transfer between nodes. When a method completes:

1. Output is wrapped in an envelope with full metadata
2. Envelope is persisted to PostgreSQL
3. Envelope is added to `previousEnvelopes` array
4. Next method receives accumulated envelopes

### 6.2 Context Accumulation

**File**: `@/packages/infrastructure/lambda/shared/services/cato-method-executor.service.ts` (Lines 229-280)

```typescript
export interface CatoAccumulatedContext {
  history: CatoMethodEnvelope[];       // Previous envelopes (may be pruned)
  pruningApplied: CatoContextStrategy; // Which strategy was used
  originalCount: number;               // Envelopes before pruning
  prunedCount: number;                 // Envelopes after pruning
  totalTokensEstimate: number;         // Rough token count
}
```

### 6.3 Multi-Model Stream Handling

When a method invokes an LLM, the response stream is:

1. **Captured** - Full response collected
2. **Parsed** - JSON extracted from response
3. **Validated** - Against output schema
4. **Hashed** - SHA-256 for integrity
5. **Wrapped** - In envelope with all metadata
6. **Persisted** - To database
7. **Forwarded** - To next method

**File**: `@/packages/infrastructure/lambda/shared/services/cato-method-executor.service.ts` (Lines 282-326)

```typescript
protected async invokeModel(
  systemPrompt: string,
  userPrompt: string,
  context: MethodExecutionContext
): Promise<ModelInvocationResult> {
  const request: ModelRequest = {
    modelId: this.selectModelForMethod(context),
    messages: [{ role: 'user', content: userPrompt }],
    systemPrompt,
    maxTokens: 4096,
    temperature: 0.7,
    tenantId: context.tenantId,
  };

  // Model router handles fallbacks, rate limiting, cost tracking
  const response: ModelResponse = await this.modelRouter.invoke(request);

  // Parse JSON from response
  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(response.content);
  } catch {
    parsedOutput = { content: response.content };
  }

  return {
    response: response.content,
    parsedOutput,
    tokensInput: response.inputTokens,
    tokensOutput: response.outputTokens,
    costCents: response.costCents,
    latencyMs: response.latencyMs,
    modelId: response.modelUsed,
    provider: response.provider,
  };
}
```

### 6.4 End-to-End Tracing

Every envelope carries tracing information that links the entire pipeline:

```typescript
tracing: {
  traceId: string;      // Same across all envelopes in pipeline
  spanId: string;       // Unique per method invocation
  parentSpanId?: string // Links to previous method's spanId
}
```

This enables distributed tracing tools to visualize the full pipeline:

```
[Trace: abc123...]
├── [Span: observer_001] Observer (150ms)
│   └── [Span: llm_001] Claude-3.5-Sonnet (120ms)
├── [Span: proposer_001] Proposer (280ms)
│   └── [Span: llm_002] Claude-3.5-Sonnet (250ms)
├── [Span: validator_001] Validator (180ms)
│   └── [Span: llm_003] Claude-3.5-Sonnet (150ms)
└── [Span: executor_001] Executor (500ms)
    └── [Span: tool_001] Lambda:file-writer (480ms)
```

---

## 7. Context Strategies

**File**: `@/packages/infrastructure/lambda/shared/services/cato-method-executor.service.ts` (Lines 229-280)

Methods declare how much context they need from previous envelopes:

### 7.1 Strategy Types

| Strategy | Behavior | Use Case |
|----------|----------|----------|
| `FULL` | Pass all previous envelopes | Small pipelines, full context needed |
| `MINIMAL` | Pass no context | Stateless methods |
| `TAIL` | Last N envelopes | Focus on recent context |
| `RELEVANT` | Filter by output type | Only related envelopes |
| `SUMMARY` | LLM-generated summary | Large context compression |

### 7.2 Implementation

```typescript
protected async applyContextStrategy(
  envelopes: CatoMethodEnvelope[],
  strategy: CatoContextStrategy,
  executionContext?: MethodExecutionContext
): Promise<CatoAccumulatedContext> {
  let prunedEnvelopes: CatoMethodEnvelope[] = [];

  switch (strategy) {
    case CatoContextStrategy.FULL:
      prunedEnvelopes = envelopes;
      break;

    case CatoContextStrategy.MINIMAL:
      prunedEnvelopes = [];
      break;

    case CatoContextStrategy.TAIL:
      const tailCount = this.methodDefinition?.contextStrategy.tailCount || 5;
      prunedEnvelopes = envelopes.slice(-tailCount);
      break;

    case CatoContextStrategy.RELEVANT:
      const acceptedTypes = this.methodDefinition?.acceptsOutputTypes || [];
      prunedEnvelopes = envelopes.filter(e => 
        acceptedTypes.includes(e.output.outputType)
      );
      break;

    case CatoContextStrategy.SUMMARY:
      // Use fast LLM to summarize middle envelopes
      prunedEnvelopes = await this.summarizeEnvelopes(envelopes, executionContext);
      break;
  }

  return {
    history: prunedEnvelopes,
    pruningApplied: strategy,
    originalCount: envelopes.length,
    prunedCount: prunedEnvelopes.length,
    totalTokensEstimate: this.estimateTokens(prunedEnvelopes),
  };
}
```

### 7.3 Summary Strategy Details

**File**: `@/packages/infrastructure/lambda/shared/services/cato-method-executor.service.ts` (Lines 612-670)

When `SUMMARY` strategy is used, middle envelopes are compressed:

```typescript
protected async summarizeEnvelopes(
  envelopes: CatoMethodEnvelope[],
  context?: MethodExecutionContext
): Promise<CatoMethodEnvelope[]> {
  if (envelopes.length <= 3) {
    return envelopes;
  }

  // Build summary of middle envelopes using fast model
  const middleEnvelopes = envelopes.slice(1, -1);
  const summaryRequest: ModelRequest = {
    modelId: 'groq/llama-3.1-8b-instant',  // Fast model
    messages: [{
      role: 'user',
      content: `Summarize the following method execution outputs...`
    }],
    maxTokens: 1000,
    temperature: 0.3,
  };

  const response = await this.modelRouter.invoke(summaryRequest);
  
  // Inject summary into first envelope
  const firstEnvelope = { ...envelopes[0] };
  firstEnvelope.output.data._contextSummary = summaryData;
  
  // Return first (with summary) and last envelope
  return [firstEnvelope, envelopes[envelopes.length - 1]];
}
```

---

## 8. Checkpoint System (HITL)

**File**: `@/packages/infrastructure/lambda/shared/services/cato-checkpoint.service.ts`

Human-in-the-loop checkpoints provide approval gates at key pipeline stages.

### 8.1 Checkpoint Types

| Type | Name | Purpose | Typical Triggers |
|------|------|---------|------------------|
| `CP1` | Context Gate | Validate understanding | Ambiguous intent, missing context |
| `CP2` | Plan Gate | Approve proposal | High cost, irreversible actions |
| `CP3` | Review Gate | Review critiques | Objections raised, low consensus |
| `CP4` | Execution Gate | Approve execution | Risk above threshold |
| `CP5` | Post-Mortem Gate | Review results | Execution completed |

### 8.2 Checkpoint Modes

```typescript
export enum CatoCheckpointMode {
  AUTO = 'AUTO',           // Log but don't block
  MANUAL = 'MANUAL',       // Always require approval
  CONDITIONAL = 'CONDITIONAL',  // Trigger on conditions
  DISABLED = 'DISABLED',   // Skip entirely
}
```

### 8.3 Governance Presets

**File**: `@/packages/shared/src/types/cato-pipeline.types.ts` (Lines 828-881)

```typescript
export const CATO_GOVERNANCE_PRESETS = {
  COWBOY: {
    description: 'Maximum autonomy - minimal checkpoints',
    checkpoints: {
      CP1: { mode: DISABLED },
      CP2: { mode: CONDITIONAL, triggerOn: ['destructive_action'] },
      CP3: { mode: DISABLED },
      CP4: { mode: CONDITIONAL, triggerOn: ['critical_risk'] },
      CP5: { mode: DISABLED },
    },
    riskThresholds: { autoExecute: 0.7, veto: 0.95 },
  },
  BALANCED: {
    description: 'Balanced autonomy - checkpoints at key points',
    checkpoints: {
      CP1: { mode: CONDITIONAL, triggerOn: ['ambiguous_intent', 'missing_context'] },
      CP2: { mode: CONDITIONAL, triggerOn: ['high_cost', 'irreversible_actions'] },
      CP3: { mode: CONDITIONAL, triggerOn: ['objections_raised', 'low_consensus'] },
      CP4: { mode: CONDITIONAL, triggerOn: ['risk_above_threshold'] },
      CP5: { mode: DISABLED },
    },
    riskThresholds: { autoExecute: 0.5, veto: 0.85 },
  },
  PARANOID: {
    description: 'Maximum oversight - checkpoints everywhere',
    checkpoints: {
      CP1: { mode: MANUAL, triggerOn: ['always'] },
      CP2: { mode: MANUAL, triggerOn: ['always'] },
      CP3: { mode: MANUAL, triggerOn: ['always'] },
      CP4: { mode: MANUAL, triggerOn: ['always'] },
      CP5: { mode: CONDITIONAL, triggerOn: ['execution_completed'] },
    },
    riskThresholds: { autoExecute: 0.2, veto: 0.6 },
  },
};
```

### 8.4 Checkpoint Evaluation

**File**: `@/packages/infrastructure/lambda/shared/services/cato-checkpoint.service.ts` (Lines 97-165)

```typescript
async evaluateCheckpoint(context: CheckpointTriggerContext): Promise<CheckpointResult> {
  const config = await this.getConfiguration(context.tenantId);
  let checkpointConfig = config.checkpoints[context.checkpointType];

  // Check if disabled
  if (checkpointConfig.mode === CatoCheckpointMode.DISABLED) {
    return { triggered: false, waitRequired: false };
  }

  // Check auto-approve conditions
  if (checkpointConfig.autoApproveConditions?.length) {
    const allConditionsMet = checkpointConfig.autoApproveConditions.every(cond =>
      this.evaluateCondition(cond, context.envelope)
    );
    if (allConditionsMet) {
      return { triggered: true, waitRequired: false, autoApproved: true };
    }
  }

  // Check trigger conditions for CONDITIONAL mode
  if (checkpointConfig.mode === CatoCheckpointMode.CONDITIONAL) {
    const shouldTrigger = checkpointConfig.triggerOn.some(trigger =>
      this.evaluateTrigger(trigger, context)
    );
    if (!shouldTrigger) {
      return { triggered: false, waitRequired: false };
    }
  }

  // MANUAL mode - create checkpoint and wait
  const checkpointId = await this.createCheckpointDecision(context, checkpointConfig);
  return { triggered: true, checkpointId, waitRequired: true };
}
```

### 8.5 Pipeline Resume

**File**: `@/packages/infrastructure/lambda/shared/services/cato-pipeline-orchestrator.service.ts` (Lines 244-321)

```typescript
async resumePipeline(
  pipelineId: string,
  checkpointId: string,
  decision: CatoCheckpointDecision
): Promise<PipelineExecutionResult> {
  const execution = await this.getExecution(pipelineId);
  
  if (decision === CatoCheckpointDecision.REJECTED) {
    await this.updateExecutionStatus(pipelineId, CatoPipelineStatus.CANCELLED);
    return { execution, checkpointsPending: [] };
  }

  // Get remaining methods from checkpoint state
  const checkpointState = await this.getCheckpointState(pipelineId, checkpointId);
  
  // Continue execution from where it left off
  for (const methodId of checkpointState.remainingMethods) {
    const result = await this.executeMethod(methodId, context);
    envelopes.push(result.envelope);
  }
  
  return { execution, finalEnvelope, checkpointsPending };
}
```

---

## 9. Compensation (SAGA Pattern)

**File**: `@/packages/infrastructure/lambda/shared/services/cato-compensation.service.ts`

When a pipeline fails mid-execution, compensation actions are executed in **reverse order** to undo completed steps.

### 9.1 Compensation Types

```typescript
export enum CatoCompensationType {
  DELETE = 'DELETE',       // Delete created resources
  RESTORE = 'RESTORE',     // Restore previous state
  NOTIFY = 'NOTIFY',       // Send notification
  MANUAL = 'MANUAL',       // Flag for human intervention
  NONE = 'NONE',           // No compensation needed
}
```

### 9.2 Compensation Log

**File**: `@/packages/shared/src/types/cato-pipeline.types.ts` (Lines 669-699)

```typescript
export interface CatoCompensationEntry {
  id: string;
  pipelineId: string;
  tenantId: string;
  stepNumber: number;
  stepName?: string;
  compensationType: CatoCompensationType;
  compensationTool?: string;
  compensationInputs?: Record<string, unknown>;
  compensationDeadline?: Date;
  affectedResources: CatoAffectedResource[];
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  priority: number;
  originalAction: Record<string, unknown>;
  originalResult?: Record<string, unknown>;
}

export interface CatoAffectedResource {
  resourceType: string;
  resourceId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
}
```

### 9.3 Execution Flow

**File**: `@/packages/infrastructure/lambda/shared/services/cato-compensation.service.ts` (Lines 56-105)

```typescript
async executeCompensations(pipelineId: string, tenantId: string) {
  // Get pending compensations in REVERSE order (LIFO for SAGA)
  const result = await this.pool.query(
    `SELECT * FROM cato_compensation_log
     WHERE pipeline_id = $1 AND status = 'PENDING'
     ORDER BY step_number DESC`,  // <-- LIFO order
    [pipelineId, tenantId]
  );

  for (const row of result.rows) {
    const entry = this.mapRowToEntry(row);
    
    switch (entry.compensationType) {
      case CatoCompensationType.DELETE:
        await this.executeDeleteCompensation(entry);
        break;
      case CatoCompensationType.RESTORE:
        await this.executeRestoreCompensation(entry);
        break;
      case CatoCompensationType.NOTIFY:
        await this.executeNotifyCompensation(entry);
        break;
      case CatoCompensationType.MANUAL:
        await this.flagForManualCompensation(entry);
        break;
    }
  }
}
```

---

## 10. Database Schema

### 10.1 Core Tables

| Table | Purpose |
|-------|---------|
| `cato_schema_definitions` | JSON Schema definitions for validation |
| `cato_method_definitions` | Method configurations and prompts |
| `cato_tool_definitions` | Lambda/MCP tool definitions |
| `cato_pipeline_templates` | Pre-defined pipeline configurations |
| `cato_pipeline_executions` | Pipeline execution records |
| `cato_pipeline_envelopes` | All method output envelopes |
| `cato_method_invocations` | Individual method calls |
| `cato_audit_prompt_records` | Full prompt/response audit log |
| `cato_checkpoint_configurations` | Tenant checkpoint settings |
| `cato_checkpoint_decisions` | Checkpoint approval records |
| `cato_risk_assessments` | Validator risk assessments |
| `cato_compensation_log` | SAGA rollback entries |
| `cato_merkle_entries` | Audit chain hashes |

### 10.2 Key Relationships

```
cato_pipeline_executions
  │
  ├──< cato_method_invocations (1:N)
  │
  ├──< cato_pipeline_envelopes (1:N)
  │       │
  │       └──< cato_audit_prompt_records (1:N)
  │
  ├──< cato_checkpoint_decisions (1:N)
  │
  ├──< cato_compensation_log (1:N)
  │
  └──< cato_merkle_entries (1:N)
```

### 10.3 Envelope Schema

```sql
CREATE TABLE cato_pipeline_envelopes (
  envelope_id UUID PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES cato_pipeline_executions(id),
  tenant_id UUID NOT NULL,
  sequence INTEGER NOT NULL,
  envelope_version VARCHAR(10) NOT NULL,
  
  -- Source
  source_method_id VARCHAR(100) NOT NULL,
  source_method_type VARCHAR(50) NOT NULL,
  source_method_name VARCHAR(200) NOT NULL,
  
  -- Destination (optional routing hint)
  destination_method_id VARCHAR(100),
  routing_reason TEXT,
  
  -- Output
  output_type VARCHAR(50) NOT NULL,
  output_schema_ref VARCHAR(200),
  output_data JSONB NOT NULL,
  output_data_hash VARCHAR(64) NOT NULL,
  output_summary TEXT,
  
  -- Confidence
  confidence_score NUMERIC(5,4) NOT NULL,
  confidence_factors JSONB NOT NULL,
  
  -- Context
  context_strategy VARCHAR(20) NOT NULL,
  context JSONB NOT NULL,
  
  -- Risk
  risk_signals JSONB NOT NULL DEFAULT '[]',
  
  -- Tracing
  trace_id VARCHAR(64) NOT NULL,
  span_id VARCHAR(32) NOT NULL,
  parent_span_id VARCHAR(32),
  
  -- Compliance
  compliance_frameworks TEXT[] DEFAULT '{}',
  data_classification VARCHAR(20) DEFAULT 'INTERNAL',
  contains_pii BOOLEAN DEFAULT FALSE,
  contains_phi BOOLEAN DEFAULT FALSE,
  
  -- Metrics
  models_used JSONB NOT NULL,
  duration_ms INTEGER NOT NULL,
  cost_cents INTEGER NOT NULL,
  tokens_used INTEGER NOT NULL,
  
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(pipeline_id, sequence)
);

-- RLS Policy
ALTER TABLE cato_pipeline_envelopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cato_pipeline_envelopes
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

---

## 11. API Reference

### 11.1 Pipeline Execution

```typescript
// Start a new pipeline
const result = await orchestrator.executePipeline({
  tenantId: 'tenant-123',
  userId: 'user-456',
  request: { query: 'Analyze this data...' },
  templateId: 'template:data-analysis:v1',
  governancePreset: 'BALANCED',
});

// Result
{
  execution: CatoPipelineExecution,
  finalEnvelope: CatoMethodEnvelope,
  checkpointsPending: string[],  // Checkpoint IDs if waiting
}
```

### 11.2 Pipeline Resume (after checkpoint)

```typescript
const result = await orchestrator.resumePipeline(
  pipelineId,
  checkpointId,
  CatoCheckpointDecision.APPROVED
);
```

### 11.3 Method Registry

```typescript
// Get method definition
const method = await methodRegistry.getMethod('method:observer:v1');

// Find compatible methods for an output type
const methods = await methodRegistry.findCompatibleMethods(CatoOutputType.PROPOSAL);

// Render prompts with variables
const { systemPrompt, userPrompt } = await methodRegistry.renderPrompt(
  'method:observer:v1',
  { user_request: 'Analyze...', session_context: '...' }
);
```

### 11.4 Checkpoint Management

```typescript
// Get pending checkpoints
const pending = await checkpointService.getPendingCheckpoints(tenantId);

// Resolve checkpoint
await checkpointService.resolveCheckpoint(
  checkpointId,
  CatoCheckpointDecision.APPROVED,
  'admin',
  'admin-user-id',
  ['modification-1'],  // Optional modifications
  'Approved with minor changes'  // Feedback
);
```

### 11.5 Compensation

```typescript
// Get pending compensations
const pending = await compensationService.getPendingCompensations(tenantId);

// Execute compensations for failed pipeline
const result = await compensationService.executeCompensations(pipelineId, tenantId);
// Returns: { executed: 3, failed: 0 }
```

---

## Summary

The Cato orchestration system provides:

1. **Composable Methods** - 70+ methods that can be chained into pipelines
2. **Universal Envelope Protocol** - Typed data containers with full metadata
3. **Context Strategies** - Intelligent pruning to manage token limits
4. **Type-Safe Routing** - Methods declare accepted/produced types
5. **Human-in-the-Loop** - 5 checkpoint types with 3 governance presets
6. **SAGA Rollback** - Compensation log for reliable failure recovery
7. **Full Audit Trail** - Merkle-chained prompt/response records
8. **Multi-Tenant Isolation** - RLS policies on all tables
9. **Distributed Tracing** - Trace/span IDs for observability
10. **Cost Tracking** - Per-method and per-pipeline cost accounting

This architecture enables complex AI workflows with enterprise governance, compliance, and reliability guarantees.
