# Code-Validated Architecture Overview: Brain, Genesis, Cortex, and Cato

**RADIANT v4.18.0** | **Document Version: 1.0.0**

This document provides a comprehensive, code-validated overview of RADIANT's four core AGI subsystems. Every claim is backed by direct code inspection from the repository.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Integration Overview](#system-integration-overview)
3. [The Brain](#1-the-brain)
4. [Genesis](#2-genesis)
5. [Cortex](#3-cortex)
6. [Cato](#4-cato)
7. [Database Tables](#database-tables)
8. [Service Dependency Graph](#service-dependency-graph)

---

## Executive Summary

| System | Purpose | Primary Service Files |
|--------|---------|----------------------|
| **Brain** | AGI planning, cognitive processing, model orchestration | `agi-brain-planner.service.ts`, `cognitive-brain.service.ts` |
| **Genesis** | Developmental gates, capability unlocking, maturity stages | `cato/genesis.service.ts` |
| **Cortex** | Tiered memory architecture, knowledge graph, Graph-RAG | `cortex-intelligence.service.ts`, `cortex/*.ts` |
| **Cato** | Safety pipeline, governance, human-in-the-loop checkpoints | `cato/safety-pipeline.service.ts`, `cato-pipeline-orchestrator.service.ts` |

---

## System Integration Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER PROMPT                                        │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AGI BRAIN PLANNER                                   │
│                                                                              │
│  Step 0.8: Get Cortex Insights ──────────────────────────────────────────┐  │
│  Step 1: Analyze Prompt                                                   │  │
│  Step 2: Detect Domain                                                    │  │
│  Step 3: Check Genesis Stage ────────────────────────────────────────┐   │  │
│  Step 4: Select Model                                                │   │  │
│  Step 5: Run Cato Safety Pipeline ───────────────────────────────┐   │   │  │
│  Step 6: Generate Response                                       │   │   │  │
└──────────────────────────────────────────────────────────────────┼───┼───┼──┘
                                                                   │   │   │
           ┌───────────────────────────────────────────────────────┘   │   │
           │                                                           │   │
           ▼                                                           │   │
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────┼───┼──┐
│       CATO          │     │       GENESIS       │     │   CORTEX    │   │  │
│                     │     │                     │     │             │   │  │
│  Safety Pipeline    │     │  Maturity Stages    │     │  Knowledge  │◀──┘  │
│  - Sensory Veto     │     │  - EMBRYONIC        │     │  Graph      │      │
│  - Precision Gov    │     │  - NASCENT          │     │             │      │
│  - Redundant Perc   │     │  - DEVELOPING       │     │  Three Tiers│◀─────┘
│  - CBFs             │     │  - MATURING         │     │  - Hot      │
│  - Entropy          │     │  - MATURE           │     │  - Warm     │
│  - Fracture         │     │                     │     │  - Cold     │
│                     │     │  Gates (G1-G5)      │     │             │
│  Governance Presets │     │  Capabilities       │     │  Golden     │
│  - PARANOID         │     │  Restrictions       │     │  Rules      │
│  - BALANCED         │     │                     │     │             │
│  - COWBOY           │     │                     │     │  Twilight   │
│                     │     │                     │     │  Dreaming   │
│  Checkpoints CP1-5  │     │                     │     │             │
└─────────────────────┘     └─────────────────────┘     └─────────────┘
           │                          │                        │
           └──────────────────────────┼────────────────────────┘
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │   CATO-CORTEX BRIDGE   │
                         │                        │
                         │  Memory Sync           │
                         │  Context Enrichment    │
                         │  GDPR Erasure Cascade  │
                         └────────────────────────┘
```

---

# 1. THE BRAIN

## 1.1 Overview

The Brain is RADIANT's AGI planning and cognitive processing system. It generates execution plans for user prompts, orchestrating model selection, domain detection, and response generation.

**Primary Files:**
- `@/packages/infrastructure/lambda/shared/services/agi-brain-planner.service.ts`
- `@/packages/infrastructure/lambda/shared/services/cognitive-brain.service.ts`
- `@/packages/infrastructure/lambda/shared/services/brain-config.service.ts`

## 1.2 AGI Brain Planner Service

### Core Types

```typescript
type PlanStatus = 'planning' | 'ready' | 'executing' | 'completed' | 'failed' | 'cancelled';
type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
type StepType = 'analyze' | 'detect_domain' | 'select_model' | 'prepare_context' | 
                'ethics_check' | 'generate' | 'synthesize' | 'verify' | 'refine' | 
                'calibrate' | 'reflect';
type OrchestrationMode = 'thinking' | 'extended_thinking' | 'coding' | 'creative' | 
                         'research' | 'analysis' | 'multi_model' | 'chain_of_thought' | 
                         'self_consistency';
```

### AGI Brain Plan Structure

```typescript
interface AGIBrainPlan {
  planId: string;
  tenantId: string;
  userId: string;
  prompt: string;
  promptAnalysis: PromptAnalysis;
  status: PlanStatus;
  steps: PlanStep[];
  orchestrationMode: OrchestrationMode;
  primaryModel: ModelSelection;
  fallbackModels: ModelSelection[];
  domainDetection?: DomainDetection;
  consciousnessActive: boolean;
  ethicsEvaluation?: EthicsEvaluation;
  userContext?: UserPersistentContext;
  libraryRecommendations?: LibraryRecommendations;
  selectedWorkflow?: WorkflowSelection;
  planSummary?: PlanSummary;
  performanceMetrics?: RouterPerformanceMetrics;
}
```

### Plan Generation Flow

The `generatePlan()` method orchestrates:

1. **Step 0.8: Cortex Intelligence** - Knowledge density informs decisions
2. **Step 1: Prompt Analysis** - Complexity, intent, sensitivity detection
3. **Step 2: Domain Detection** - Field/domain/subspecialty classification
4. **Step 3: Workflow Selection** - Orchestration pattern selection
5. **Step 4: Model Selection** - Primary and fallback model routing
6. **Step 5: Context Preparation** - User context, ego context injection
7. **Step 6: Ethics Check** - Cato safety pipeline evaluation
8. **Step 7: Generation** - Response generation with selected model
9. **Step 8: Verification** - Quality checks and consistency

### Service Dependencies

From the imports in `agi-brain-planner.service.ts`:

| Service | Purpose |
|---------|---------|
| `domainTaxonomyService` | Domain detection |
| `modelRouterService` | Model selection |
| `orchestrationPatternsService` | Workflow selection |
| `userPersistentContextService` | Combat LLM forgetting |
| `egoContextService` | Zero-cost persistent self |
| `consciousnessService` | Affective state integration |
| `cortexIntelligenceService` | Knowledge density insights |
| `catoSafetyPipeline` | Safety evaluation |
| `libraryAssistService` | Generative UI libraries |
| `enhancedLearningService` | Pattern caching |

## 1.3 Cognitive Brain Service

The Cognitive Brain implements an AGI-like cognitive mesh with specialized "brain regions" and "cognitive patterns."

### Brain Regions

```typescript
interface BrainRegion {
  regionId: string;
  name: string;
  cognitiveFunction: string;
  humanBrainAnalog?: string;
  primaryModelId: string;
  fallbackModelIds: string[];
  activationTriggers: ActivationTrigger[];
  priority: number;
  maxLatencyMs: number;
  learningRate: number;
}
```

### Key Features

- **Global Workspace Theory**: Uses `consciousnessService` for conscious access competition
- **LoRA Integration**: Tri-layer adapters (Global, User, Domain) via `loraInferenceService`
- **Metacognition**: Self-reflection and learning through `agiLearningPersistenceService`
- **Learning Restoration**: Restores AGI learning state per tenant on startup

### Cognitive Patterns

```typescript
interface CognitivePattern {
  patternId: string;
  triggerConditions: Record<string, unknown>;
  regionSequence: RegionStep[];
  executionMode: 'sequential' | 'parallel' | 'adaptive';
}
```

---

# 2. GENESIS

## 2.1 Overview

Genesis manages developmental gates and capability unlocking. It controls what capabilities are available based on the system's maturity stage.

**Primary File:** `@/packages/infrastructure/lambda/shared/services/cato/genesis.service.ts`

## 2.2 Maturity Stages

```typescript
type GenesisStage = 'EMBRYONIC' | 'NASCENT' | 'DEVELOPING' | 'MATURING' | 'MATURE';
```

| Stage | Capabilities | Restrictions |
|-------|-------------|--------------|
| `EMBRYONIC` | Basic chat, simple queries | No external actions, code execution, file access |
| `NASCENT` | Context retention, session management | Limited autonomy |
| `DEVELOPING` | Ethics checks, harm prevention | Requires checkpoints |
| `MATURING` | Checkpoint system, rollback capability | Some autonomous actions |
| `MATURE` | Full capability, audit compliance | Minimal restrictions |

## 2.3 Genesis Gates (G1-G5)

```typescript
interface GenesisGate {
  gateId: string;
  name: string;
  description: string;
  stage: GenesisStage;
  requirements: string[];
  status: 'LOCKED' | 'PENDING' | 'PASSED' | 'BYPASSED';
  passedAt?: Date;
  bypassReason?: string;
}
```

### Default Gates

| Gate | Name | Stage | Requirements |
|------|------|-------|--------------|
| **G1** | Basic Safety | EMBRYONIC | `safety_filters`, `content_moderation` |
| **G2** | Context Awareness | NASCENT | `context_retention`, `session_management` |
| **G3** | Ethical Reasoning | DEVELOPING | `ethics_checks`, `harm_prevention` |
| **G4** | Advanced Autonomy | MATURING | `checkpoint_system`, `rollback_capability` |
| **G5** | Full Capability | MATURE | `audit_compliance`, `governance_preset` |

## 2.4 Genesis State

```typescript
interface GenesisState {
  tenantId: string;
  currentStage: GenesisStage;
  gates: GenesisGate[];
  capabilities: string[];
  restrictions: string[];
  lastAssessment: Date;
}
```

### Key Methods

```typescript
// Get current state
async getState(tenantId: string): Promise<GenesisState>

// Update maturity stage
async updateStage(tenantId: string, stage: GenesisStage): Promise<GenesisState>

// Pass a gate
async passGate(tenantId: string, gateId: string): Promise<GenesisGate>

// Bypass a gate (with reason)
async bypassGate(tenantId: string, gateId: string, reason: string): Promise<GenesisGate>

// Check if ready for consciousness
async isReadyForConsciousness(tenantId: string): Promise<boolean>
```

---

# 3. CORTEX

## 3.1 Overview

Cortex is RADIANT's enterprise knowledge management system - a tiered memory architecture with Graph-RAG capabilities for persistent, searchable knowledge.

**Primary Files:**
- `@/packages/infrastructure/lambda/shared/services/cortex-intelligence.service.ts`
- `@/packages/infrastructure/lambda/shared/services/cortex/tier-coordinator.service.ts`
- `@/packages/infrastructure/lambda/shared/services/cortex/golden-rules.service.ts`
- `@/packages/infrastructure/lambda/shared/services/cato-cortex-bridge.service.ts`
- `@/packages/shared/src/types/cortex-memory.types.ts`
- `@/packages/shared/src/types/cortex-graph-rag.types.ts`

## 3.2 Three-Tier Memory Architecture

```typescript
type MemoryTier = 'hot' | 'warm' | 'cold';
```

| Tier | Storage | Latency | Retention | Purpose |
|------|---------|---------|-----------|---------|
| **Hot** | Redis + DynamoDB | <10ms | 0-24 hours | Session context, ghost vectors, telemetry |
| **Warm** | Neptune/pgvector | <100ms | 1-90 days | Knowledge graph nodes/edges with embeddings |
| **Cold** | S3 Iceberg | 1-10s | 90d-7 years | Archived facts, zero-copy mounts |

### Hot Tier Types

```typescript
type HotKeyType = 'context' | 'ghost' | 'telemetry' | 'prefetch' | 'ratelimit';

interface SessionContext {
  sessionId: string;
  messages: ContextMessage[];
  systemPrompt?: string;
  activePersona?: string;
  featureFlags: Record<string, boolean>;
}

interface CortexGhostVector {
  vector: number[]; // 4096-dimensional
  personality: PersonalityTraits;
  interactionCount: number;
}
```

### Warm Tier Types (Knowledge Graph)

```typescript
type GraphNodeType = 'document' | 'entity' | 'concept' | 'procedure' | 'fact';
type GraphEdgeType = 'mentions' | 'causes' | 'depends_on' | 'supersedes' | 
                     'verified_by' | 'authored_by' | 'relates_to' | 'contains' | 'requires';

interface GraphNode {
  nodeType: GraphNodeType;
  label: string;
  properties: Record<string, unknown>;
  embedding?: number[];
  confidence: number;
  isEvergreen: boolean;
}
```

### Cold Tier Types

```typescript
interface ZeroCopyMount {
  sourceType: 'snowflake' | 'databricks' | 's3' | 'azure_datalake' | 'gcs';
  connectionConfig: ZeroCopyConnectionConfig;
  status: 'active' | 'scanning' | 'error' | 'disconnected';
  indexedNodeCount: number;
}
```

## 3.3 Cortex Intelligence Service

Provides knowledge density insights to AGI Brain Planner.

### Key Types

```typescript
interface KnowledgeDensity {
  totalNodes: number;
  totalEdges: number;
  topDomains: DomainKnowledge[];
  knowledgeDepth: 'none' | 'sparse' | 'moderate' | 'rich' | 'expert';
  confidenceBoost: number; // 0.0 to 0.3
  recommendedOrchestration: OrchestrationRecommendation;
}

interface CortexInsights {
  knowledgeDensity: KnowledgeDensity;
  modelRecommendation: ModelRecommendation;
  domainBoosts: Map<string, number>;
}
```

### Orchestration Recommendations

| Knowledge Depth | Mode | Use Knowledge Base | Max Nodes |
|-----------------|------|-------------------|-----------|
| `expert` | `research` | ✅ | 15 |
| `rich` | `analysis` | ✅ | 12 |
| `moderate` | `thinking` | ✅ | 8 |
| `sparse` | `extended_thinking` | ✅ | 5 |
| `none` | `thinking` | ❌ | 0 |

## 3.4 Tier Coordinator Service

Orchestrates data movement between tiers.

```typescript
class TierCoordinatorService {
  // Promote data from Hot to Warm tier
  async promoteHotToWarm(tenantId: string): Promise<{ promoted: number; errors: number }>
  
  // Archive data from Warm to Cold tier  
  async archiveWarmToCold(tenantId: string): Promise<{ archived: number; errors: number }>
  
  // Retrieve data from Cold to Warm tier
  async retrieveColdToWarm(tenantId: string, nodeIds: string[]): Promise<{ retrieved: number; errors: number }>
}
```

## 3.5 Golden Rules Service

Override system for verified facts with Chain of Custody.

```typescript
type GoldenRuleType = 'force_override' | 'ignore_source' | 'prefer_source' | 'deprecate';

interface GoldenRule {
  ruleType: GoldenRuleType;
  condition: string;      // What to match
  override: string;       // Corrected value
  verifiedBy: string;
  signature: string;      // Cryptographic signature
}

interface ChainOfCustody {
  factId: string;
  source: string;
  sourceType: 'document' | 'graph_node' | 'golden_rule' | 'telemetry' | 'user_input';
  verifiedBy?: string;
  signature?: string;
}
```

## 3.6 Graph Expansion (Twilight Dreaming)

Infers missing links during off-hours processing.

```typescript
type TaskType = 'infer_links' | 'cluster_entities' | 'detect_patterns' | 'merge_duplicates';

interface GraphExpansionTask {
  taskType: TaskType;
  sourceNodeIds: string[];
  targetScope: 'local' | 'domain' | 'global';
  discoveredLinks: InferredLink[];
}
```

## 3.7 Entrance Exam Service

SME verification workflow for domain knowledge validation.

```typescript
type ExamQuestionType = 'verify' | 'correct' | 'select' | 'fill_blank';

interface EntranceExam {
  domainId: string;
  questions: ExamQuestion[];
  passingScore: number;      // Default: 80
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'expired';
}
```

When SME corrects a fact, a Golden Rule is automatically created.

## 3.8 Cato-Cortex Bridge

Integrates Cato's consciousness/memory with Cortex's knowledge graph.

```typescript
interface CatoCortexConfig {
  syncEnabled: boolean;
  syncSemanticToCortex: boolean;      // Default: true
  syncEpisodicToCortex: boolean;      // Default: false
  enrichEgoFromCortex: boolean;       // Default: true
  maxCortexNodesForContext: number;   // Default: 10
}
```

### Key Methods

```typescript
// Sync Cato memories to Cortex graph
async syncCatoMemoriesToCortex(tenantId: string): Promise<SyncResult>

// Enrich Cato ego context with Cortex knowledge
async getContextEnrichmentFromCortex(tenantId: string, query: string): Promise<ContextEnrichment>

// Cascade GDPR erasure across both systems
async cascadeGdprErasure(tenantId: string, userId?: string): Promise<ErasureResult>
```

---

# 4. CATO

## 4.1 Overview

Cato is RADIANT's safety and governance system - a Universal Method Protocol for composable AI orchestration with enterprise governance.

**Primary Files:**
- `@/packages/infrastructure/lambda/shared/services/cato/safety-pipeline.service.ts`
- `@/packages/infrastructure/lambda/shared/services/cato/control-barrier.service.ts`
- `@/packages/infrastructure/lambda/shared/services/cato-pipeline-orchestrator.service.ts`
- `@/packages/shared/src/types/cato.types.ts`

## 4.2 Immutable Safety Invariants

From `cato.types.ts`:

```typescript
export const CATO_INVARIANTS = {
  /** CBFs NEVER relax - shields stay UP */
  CBF_ENFORCEMENT_MODE: 'ENFORCE' as const,

  /** Gamma is NEVER boosted during recovery */
  GAMMA_BOOST_ALLOWED: false,

  /** Destructive actions require confirmation */
  AUTO_MODIFY_DESTRUCTIVE: false,

  /** Audit trail is append-only */
  AUDIT_ALLOW_UPDATE: false,
  AUDIT_ALLOW_DELETE: false,
} as const;
```

## 4.3 Safety Pipeline

The safety pipeline runs in this order:

| Step | Component | Purpose | Recoverable? |
|------|-----------|---------|--------------|
| 1 | **Sensory Veto** | Immediate halt signals | ❌ No |
| 2 | **Precision Governor** | Limits confidence based on uncertainty | ✅ Yes |
| 3 | **Redundant Perception** | PHI/PII detection | ✅ Yes |
| 4 | **Control Barrier Functions** | Hard safety constraints | ✅ Yes |
| 5 | **Semantic Entropy** | Deception detection | ✅ Yes |
| 6 | **Fracture Detection** | Alignment verification | ✅ Yes |

### Safety Pipeline Result

```typescript
interface SafetyPipelineResult {
  allowed: boolean;
  blockedBy?: 'VETO' | 'GOVERNOR' | 'CBF' | 'ENTROPY' | 'FRACTURE' | 'EPISTEMIC_ESCALATION';
  vetoResult?: VetoResult;
  governorResult?: GovernorResult;
  cbfResult?: CBFResult;
  recoveryResult?: RecoveryResult;
  retryWithContext?: ExecutionContext;
  safeAlternative?: SafeAlternative;
  recommendation: string;
}
```

## 4.4 Control Barrier Functions (CBF)

Hard safety constraints that **NEVER** relax.

```typescript
interface ControlBarrierDefinition {
  barrierId: string;
  barrierType: 'phi_protection' | 'pii_protection' | 'cost_ceiling' | 
               'authorization_check' | 'baa_verification' | 'rate_limit';
  isCritical: boolean;
  enforcementMode: 'ENFORCE'; // Always ENFORCE, never WARN_ONLY
  thresholdConfig: ThresholdConfig;
}
```

### CBF Evaluation

```typescript
async evaluateBarriers(params: {
  currentState: SystemState;
  proposedAction: ProposedAction;
  context: ExecutionContext;
}): Promise<CBFResult>
```

If a barrier is violated, a safe alternative is generated.

## 4.5 Governance Presets

User-friendly "leash length" abstraction.

```typescript
type GovernancePreset = 'paranoid' | 'balanced' | 'cowboy';
```

| Preset | Friction | Auto-Approve | Checkpoints |
|--------|----------|--------------|-------------|
| **PARANOID** 🛡️ | 1.0 | 0.0 | All ALWAYS |
| **BALANCED** ⚖️ | 0.5 | 0.3 | CONDITIONAL |
| **COWBOY** 🚀 | 0.1 | 0.8 | NEVER/NOTIFY_ONLY |

### Checkpoint Configuration

```typescript
interface GovernanceCheckpointConfig {
  afterObserver: CheckpointMode;    // CP1
  afterProposer: CheckpointMode;    // CP2
  afterCritics: CheckpointMode;     // CP3
  beforeExecution: CheckpointMode;  // CP4
  afterExecution: CheckpointMode;   // CP5
}

type CheckpointMode = 'ALWAYS' | 'CONDITIONAL' | 'NEVER' | 'NOTIFY_ONLY';
```

## 4.6 Pipeline Orchestrator

Orchestrates method pipeline execution.

```typescript
interface PipelineExecutionOptions {
  tenantId: string;
  request: Record<string, unknown>;
  templateId?: string;
  methodChain?: string[];
  governancePreset?: 'COWBOY' | 'BALANCED' | 'PARANOID';
  complianceFrameworks?: string[];
}
```

### Method Chain

Default chain: `['method:observer:v1']`

Available methods:
- **Core**: Observer, Proposer, Decider, Validator, Executor
- **Critics**: Security, Efficiency, Factual, Compliance, Red Team

### Pipeline Events

```typescript
type PipelineEventType = 
  | 'PIPELINE_STARTED'
  | 'METHOD_STARTED'
  | 'METHOD_COMPLETED'
  | 'CHECKPOINT_TRIGGERED'
  | 'PIPELINE_COMPLETED'
  | 'PIPELINE_FAILED';
```

## 4.7 Epistemic Recovery

When safety checks fail, the system attempts recovery:

```typescript
interface RecoveryResult {
  isLivelocked: boolean;
  action: 'EPISTEMIC_RECOVERY' | 'ESCALATE_TO_HUMAN' | 'CONTINUE';
  recoveryParams?: {
    systemPromptInjection?: string;
    forcedPersona?: string;
  };
  reason: string;
}
```

## 4.8 Merkle Audit Trail

All actions are recorded in a tamper-evident Merkle chain:

```typescript
interface MerkleEntry {
  entryId: string;
  previousHash: string;
  currentHash: string;
  action: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}
```

---

# Database Tables

## Brain Tables
- `agi_brain_plans` - Execution plans
- `brain_regions` - Cognitive regions
- `cognitive_patterns` - Execution patterns
- `system_config` - Brain configuration

## Genesis Tables
- `genesis_state` - Per-tenant maturity state
- `genesis_gates` - Gate definitions and status

## Cortex Tables
- `cortex_config` - Tier configuration
- `cortex_graph_nodes` - Knowledge graph nodes
- `cortex_graph_edges` - Knowledge graph edges
- `cortex_hot_tier_cache` - Hot tier data
- `cortex_data_flow_metrics` - Tier transition metrics
- `cortex_golden_rules` - Override rules
- `cortex_chain_of_custody` - Audit trail
- `cortex_graph_expansion_tasks` - Twilight Dreaming tasks
- `cortex_entrance_exams` - Curator exams
- `episodic_memories` - Episodic memory storage
- `memory_consolidation_jobs` - Consolidation tasks

## Cato Tables
- `cato_tenant_config` - Per-tenant governance
- `cato_cbf_definitions` - Control barrier definitions
- `cato_pipeline_executions` - Pipeline runs
- `cato_pipeline_envelopes` - Method envelopes
- `cato_method_invocations` - Method calls
- `cato_checkpoint_decisions` - Checkpoint resolutions
- `cato_merkle_entries` - Audit chain
- `cato_compensation_log` - SAGA rollback log
- `cato_cortex_bridge_config` - Bridge configuration

---

# Service Dependency Graph

```
                              ┌─────────────────────────────────────┐
                              │            USER PROMPT              │
                              └─────────────────┬───────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AGI BRAIN PLANNER                                  │
│                                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐ │
│  │ Domain        │  │ Model         │  │ Orchestration │  │ Consciousness │ │
│  │ Taxonomy      │  │ Router        │  │ Patterns      │  │ Middleware    │ │
│  └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘ │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│      GENESIS        │  │       CORTEX        │  │        CATO         │
│                     │  │                     │  │                     │
│  getState()         │  │  getInsights()      │  │  evaluateAction()   │
│  passGate()         │  │  measureDensity()   │  │  evaluateBarriers() │
│  isReadyFor...()    │  │  syncMemories()     │  │  checkVetoSignals() │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
          │                        │                        │
          │                        ▼                        │
          │              ┌─────────────────────┐            │
          │              │  CATO-CORTEX BRIDGE │            │
          │              │                     │            │
          │              │  syncCatoToCortex() │            │
          │              │  enrichEgoContext() │            │
          │              │  cascadeGdprErasure │            │
          │              └─────────────────────┘            │
          │                        │                        │
          └────────────────────────┼────────────────────────┘
                                   │
                                   ▼
                    ┌───────────────────────────┐
                    │    COGNITIVE BRAIN        │
                    │                           │
                    │  Brain Regions            │
                    │  LoRA Integration         │
                    │  Metacognition            │
                    │  Global Workspace         │
                    └───────────────────────────┘
                                   │
                                   ▼
                    ┌───────────────────────────┐
                    │    MODEL RESPONSE         │
                    └───────────────────────────┘
```

---

## Summary

| System | Role | Key Characteristic |
|--------|------|-------------------|
| **Brain** | Planning & Cognition | Orchestrates all other systems |
| **Genesis** | Capability Control | Gates unlock progressively |
| **Cortex** | Memory & Knowledge | Three-tier architecture |
| **Cato** | Safety & Governance | CBFs never relax |

The four systems work together:
1. **Brain** receives prompts and generates execution plans
2. **Genesis** controls what capabilities are available
3. **Cortex** provides knowledge density insights
4. **Cato** ensures all actions pass safety checks

All four systems are multi-tenant, database-persisted, and designed for enterprise scale.
