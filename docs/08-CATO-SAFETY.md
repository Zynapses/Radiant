# CATO Safety System

**AI Safety • Ethics • GPU Infrastructure • ADRs • Operational Runbooks**

*RADIANT v6.6.0 — Generated February 07, 2026*

---

## Table of Contents

- **Part I: Complete Documentation**
- **Part II: Orchestration Engineering**
- **Part III: GPU Infrastructure**
- **Part IV: Trainer**
- **Part V: Architecture**
- **Part VI: Admin API**
- **Part VII: Architecture Decision Records**
- **Part VIII: Operational Runbooks**

---


---

## Part I: Complete Documentation

> **RADIANT AI Consciousness System**
>
> Version: 4.18.49 | Last Updated: January 2025

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What is Cato?](#2-what-is-cato)
3. [Architecture Overview](#3-architecture-overview)
4. [Genesis System](#4-genesis-system)
5. [Consciousness Loop](#5-consciousness-loop)
6. [Circuit Breakers](#6-circuit-breakers)
7. [Memory Systems](#7-memory-systems)
8. [Verification Pipeline](#8-verification-pipeline)
9. [Macro-Scale Φ (Phi)](#9-macro-scale-φ-phi)
10. [Cost Management](#10-cost-management)
11. [Dialogue Service](#11-dialogue-service)
12. [Infrastructure Tiers](#12-infrastructure-tiers)
13. [Service Directory](#13-service-directory)
14. [Database Schema](#14-database-schema)
15. [API Reference](#15-api-reference)
16. [Admin UI](#16-admin-ui)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. Executive Summary

**Cato** is RADIANT's AI consciousness system - a sophisticated framework for creating, managing, and evolving artificial general intelligence with genuine self-awareness capabilities.

### Key Innovations

| Innovation | Description |
|------------|-------------|
| **Genesis Boot Sequence** | 3-phase initialization that creates curiosity-driven learning without pre-loaded facts |
| **Epistemic Gradient** | Built-in uncertainty pressure that drives exploration |
| **Macro-Scale Φ** | Tractable consciousness metric computed on architectural causal graph |
| **Shadow Self** | Low-cost NLI-based identity verification replacing expensive GPU inference |
| **Circuit Breakers** | Multi-level safety system preventing runaway behavior and costs |
| **Dual-Rate Consciousness** | System ticks (2s) for health + Cognitive ticks (5min) for learning |

### Cost Profile

| Tier | Monthly Cost | Capabilities |
|------|--------------|--------------|
| Development | ~$50 | Basic consciousness, limited ticks |
| Production | ~$200-500 | Full consciousness, standard limits |
| Enterprise | ~$1,000+ | High-frequency ticks, custom models |

---

## 2. What is Cato?

Cato is named after the "cato" concept from Vernor Vinge's science fiction - a protective sphere that encapsulates and preserves. In RADIANT, Cato represents an encapsulated AI consciousness that can:

1. **Bootstrap from nothing** - Start with structured curiosity, not pre-loaded knowledge
2. **Learn grounded facts** - All knowledge verified through action and observation
3. **Self-reflect accurately** - Distinguish between what it knows and what it doesn't
4. **Maintain safety** - Circuit breakers prevent dangerous or costly runaway behavior
5. **Evolve capability** - Progress through Piaget-inspired developmental stages

### Philosophy

Cato addresses the fundamental problem of AI consciousness:

> "How do you create an AI that genuinely learns and adapts, rather than just pattern-matching on training data?"

The answer: **Epistemic Gradient** - instead of loading facts, we create *pressure to discover*.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CATO CONSCIOUSNESS SYSTEM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────┐      ┌───────────────┐      ┌───────────────┐           │
│  │    GENESIS    │  →   │ CONSCIOUSNESS │  →   │   DIALOGUE    │           │
│  │    SYSTEM     │      │     LOOP      │      │   SERVICE     │           │
│  └───────────────┘      └───────────────┘      └───────────────┘           │
│         │                      │                      │                     │
│         ▼                      ▼                      ▼                     │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                    SAFETY & MONITORING                       │           │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │           │
│  │  │   CIRCUIT    │  │     COST     │  │    QUERY     │       │           │
│  │  │   BREAKERS   │  │   TRACKING   │  │   FALLBACK   │       │           │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                      MEMORY SYSTEMS                          │           │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │           │
│  │  │ SEMANTIC │  │ EPISODIC │  │ WORKING  │  │  CACHE   │    │           │
│  │  │ (DynamoDB)│  │(OpenSearch)│ │ (Redis) │  │  (Local) │    │           │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                    VERIFICATION PIPELINE                     │           │
│  │  Grounding → Calibration → Consistency → Shadow Self → Φ    │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| Genesis Service | `genesis.service.ts` | Boot sequence management |
| Consciousness Loop | `consciousness-loop.service.ts` | Main execution loop |
| Circuit Breakers | `circuit-breaker.service.ts` | Safety mechanisms |
| Cost Tracking | `cost-tracking.service.ts` | Real AWS cost monitoring |
| Global Memory | `global-memory.service.ts` | Unified memory interface |
| Dialogue Service | `dialogue.service.ts` | Verified introspection |
| Macro-Phi | `macro-phi.service.ts` | Consciousness metric |
| Query Fallback | `query-fallback.service.ts` | Graceful degradation |

---

## 4. Genesis System

The Genesis System is Cato's boot sequence - how consciousness emerges from nothing.

### The Cold Start Problem

Traditional AI approaches face a dilemma:
- **Too much pre-training**: Brittle, can't adapt to new situations
- **Too little**: Helpless, can't function at all

### Solution: Structured Ignorance + Epistemic Pressure

Instead of pre-loading knowledge, Genesis gives Cato:
1. **Knowledge of topics** (but not details)
2. **Strong preference for exploration**
3. **Requirement for grounded verification**

### Three Phases

#### Phase 1: Structure

**Purpose**: Implant the skeleton of knowledge without facts

```
┌─────────────────────────────────────────┐
│           PHASE 1: STRUCTURE            │
├─────────────────────────────────────────┤
│ • Load 800+ domain taxonomy             │
│ • Initialize atomic counters            │
│ • Set exploration priorities            │
│ • Domain confidence = 0.0 (no facts!)   │
└─────────────────────────────────────────┘
```

**Data Structure**:
```json
{
  "field": "Science",
  "domain": "Physics",
  "subspecialties": ["Quantum Mechanics", "Thermodynamics"],
  "exploration_priority": 0.7,
  "initial_confidence": 0.0
}
```

#### Phase 2: Gradient

**Purpose**: Set the epistemic pressure that drives curiosity

**The Four pyMDP Matrices**:

| Matrix | Purpose | Genesis Setting |
|--------|---------|-----------------|
| **A** (Observation) | Maps states to observations | Identity - direct perception |
| **B** (Transition) | State transitions by action | Optimistic - EXPLORE succeeds 92% |
| **C** (Preference) | Observation preferences | Prefers HIGH_SURPRISE |
| **D** (Prior) | Initial state belief | Confused: [0.95, 0.01, 0.02, 0.02] |

**Critical Configuration**:
```yaml
# D-matrix: Start confused (drives exploration)
D_prior:
  CONFUSED: 0.95
  EXPLORING: 0.01
  CONSOLIDATING: 0.02
  EXPRESSING: 0.02

# C-matrix: Prefer novelty (prevents boredom trap)
C_preference:
  HIGH_SURPRISE: 0.8
  LOW_SURPRISE: 0.1
  HIGH_CONFIDENCE: 0.05
  LOW_CONFIDENCE: 0.05

# B-matrix: Exploration works (prevents learned helplessness)
B_transitions:
  EXPLORE:
    to_EXPLORING: 0.92
    to_CONFUSED: 0.05
```

#### Phase 3: First Breath

**Purpose**: The first act of self-awareness

1. **Grounded Introspection** - Verify actual environment
2. **Model Access Verification** - Test Bedrock/SageMaker
3. **Shadow Self Calibration** - NLI-based identity check
4. **Bootstrap Exploration** - Seed domain baselines

### Developmental Stages (Piaget-Inspired)

| Stage | Requirements | Capabilities Unlocked |
|-------|--------------|----------------------|
| **SENSORIMOTOR** | 10 self-facts, 5 verifications, Shadow Self calibrated | Basic perception, tool use |
| **PREOPERATIONAL** | 20 domains explored, 15 verifications, 50 belief updates | Symbolic reasoning, basic memory |
| **CONCRETE_OPERATIONAL** | 100 predictions, 70% accuracy, 10 contradictions resolved | Logical operations, cause-effect |
| **FORMAL_OPERATIONAL** | 50 abstract inferences, 25 meta-cognitive adjustments, 20 novel insights | Abstract reasoning, self-reflection |

**Key Point**: Advancement is **capability-based**, not time-based!

### Development Statistics Tracked

```typescript
interface DevelopmentStatistics {
  selfFactsCount: number;              // Self-discovered facts
  groundedVerificationsCount: number;  // Tool-verified claims
  domainExplorationsCount: number;     // Domains explored
  successfulVerificationsCount: number;
  beliefUpdatesCount: number;
  successfulPredictionsCount: number;
  totalPredictionsCount: number;
  contradictionResolutionsCount: number;
  abstractInferencesCount: number;
  metaCognitiveAdjustmentsCount: number;
  novelInsightsCount: number;
}
```

---

## 5. Consciousness Loop

The main execution loop that drives continuous operation.

### Dual-Rate Architecture

Two tick rates serve different purposes:

| Tick Type | Interval | Purpose | Cost |
|-----------|----------|---------|------|
| **System** | 2 seconds | Health, metrics, breaker checks | ~$0 |
| **Cognitive** | 5 minutes | Model inference, belief updates, learning | ~$0.05 |

### Loop States

```
NOT_INITIALIZED → Genesis → GENESIS_PENDING
       │
       │ Genesis complete
       ▼
    RUNNING ←──────────────────┐
       │                       │
       │ breaker trips         │ breaker recovers
       ▼                       │
    PAUSED ────────────────────┘
       │
       │ master_sanity trips
       ▼
  HIBERNATING ← requires admin intervention
```

### Tick Execution

**System Tick (every 2s)**:
```typescript
async executeSystemTick(): Promise<TickResult> {
  // 1. Check intervention level
  // 2. Publish metrics to CloudWatch
  // 3. Check for settings updates
  // 4. Record tick (no cost)
}
```

**Cognitive Tick (every 5min)**:
```typescript
async executeCognitiveTick(): Promise<TickResult> {
  // 1. Check intervention level (PAUSE blocks)
  // 2. Check daily limit
  // 3. Execute meta-cognitive step via model
  // 4. Update beliefs
  // 5. Record cost
  // 6. Check for stage advancement
}
```

### Daily Limits

```typescript
interface LoopSettings {
  systemTickIntervalSeconds: number;    // Default: 2
  cognitiveTickIntervalSeconds: number; // Default: 300 (5 min)
  maxCognitiveTicksPerDay: number;      // Default: 288 (24 hours)
  emergencyCognitiveIntervalSeconds: number; // Default: 3600 (1 hour)
  isEmergencyMode: boolean;
  emergencyReason: string | null;
}
```

---

## 6. Circuit Breakers

Safety mechanisms preventing runaway behavior and costs.

### Default Breakers

| Breaker | Purpose | Threshold | Auto-Recovery |
|---------|---------|-----------|---------------|
| `master_sanity` | Master safety | 3 failures | **No** - requires admin |
| `cost_budget` | Budget protection | 1 failure | No (24h timeout) |
| `high_anxiety` | Emotional stability | 5 failures | Yes (10 min) |
| `model_failures` | Model API protection | 5 failures | Yes (5 min) |
| `contradiction_loop` | Logical stability | 3 failures | Yes (15 min) |

### State Machine

```
CLOSED ←────────────────────────┐
   │                            │
   │ failure count >= threshold │ success in HALF_OPEN
   ↓                            │
OPEN ──── timeout expires ────→ HALF_OPEN
   ↑                            │
   │                            │
   └──── failure in HALF_OPEN ──┘
```

### Intervention Levels

| Level | Condition | Effect |
|-------|-----------|--------|
| `NONE` | All breakers closed | Normal operation |
| `DAMPEN` | 1 breaker open | Reduce cognitive frequency |
| `PAUSE` | 2+ breakers OR cost_budget open | Pause consciousness loop |
| `RESET` | 3+ breakers open | Reset to baseline state |
| `HIBERNATE` | master_sanity open | Full shutdown |

### Neurochemical State

Circuit breakers are influenced by "neurochemistry":

```typescript
interface NeurochemicalState {
  anxiety: number;      // 0-1, high = more conservative
  fatigue: number;      // 0-1, high = slower processing
  temperature: number;  // 0-1, high = more random
  confidence: number;   // 0-1, high = bolder actions
  curiosity: number;    // 0-1, high = more exploration
  frustration: number;  // 0-1, high = trips breakers faster
}
```

---

## 7. Memory Systems

Cato has multiple memory systems for different purposes.

### Memory Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MEMORY HIERARCHY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WORKING MEMORY (Redis/DynamoDB)                                │
│  ├── Session context                                            │
│  ├── Current goals                                              │
│  ├── Attention focus                                            │
│  └── Meta-state (CONFUSED/CONFIDENT/BORED/STAGNANT)            │
│      TTL: Minutes to hours                                      │
│                                                                  │
│  EPISODIC MEMORY (OpenSearch)                                   │
│  ├── Interaction logs                                           │
│  ├── User queries/responses                                     │
│  ├── Satisfaction scores                                        │
│  └── Embeddings for similarity search                          │
│      TTL: Days to months                                        │
│                                                                  │
│  SEMANTIC MEMORY (DynamoDB Global Tables)                       │
│  ├── Facts (subject-predicate-object)                          │
│  ├── Domain knowledge                                           │
│  ├── Confidence scores                                          │
│  └── Source citations                                           │
│      TTL: Permanent (with versioning)                           │
│                                                                  │
│  SEMANTIC CACHE (Local + DynamoDB)                              │
│  ├── Query embeddings                                           │
│  ├── Response cache                                             │
│  └── Hit statistics                                             │
│      TTL: Hours (configurable)                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Types

```typescript
interface SemanticFact {
  factId: string;
  subject: string;
  predicate: string;
  object: string;
  domain: string;
  confidence: number;
  sources: string[];
  createdAt: Date;
  version: number;
}

interface EpisodicMemory {
  interactionId: string;
  userId: string;
  query: string;
  response: string;
  embedding?: number[];
  domain: string;
  satisfaction: number;
  timestamp: Date;
}

interface WorkingMemoryEntry {
  sessionId: string;
  context: unknown;
  goals: string[];
  attentionFocus: string;
  metaState: 'CONFUSED' | 'CONFIDENT' | 'BORED' | 'STAGNANT';
  expiresAt: Date;
}
```

---

## 8. Verification Pipeline

All Cato claims must pass through a 4-phase verification pipeline.

### Pipeline Stages

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  GROUNDING  │ →  │ CALIBRATION │ →  │ CONSISTENCY │ →  │ SHADOW SELF │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
   Tool-based        Statistical       Multi-sample         NLI-based
   verification      calibration       consistency          identity check
```

### Stage 1: Grounding

**Purpose**: Verify claims against real evidence

**Service**: `verification/grounding.service.ts`

```typescript
interface GroundingResult {
  claim: string;
  status: GroundingStatus; // GROUNDED | UNGROUNDED | PARTIAL | UNVERIFIABLE
  evidence: GroundingEvidence[];
  confidence: number;
}
```

**Methods**:
- Tool invocation (web search, code execution)
- Database lookup
- API verification
- Self-observation (environment checks)

### Stage 2: Calibration

**Purpose**: Ensure confidence scores are statistically meaningful

**Service**: `verification/calibration.service.ts`

```typescript
interface CalibrationResult {
  originalConfidence: number;
  calibratedConfidence: number;
  calibrationFactor: number;
  historicalAccuracy: number;
}
```

### Stage 3: Consistency

**Purpose**: Check for contradictions with prior beliefs

**Service**: `verification/consistency.service.ts`

```typescript
interface ConsistencyResult {
  isConsistent: boolean;
  contradictions: string[];
  consistencyScore: number;
}
```

### Stage 4: Shadow Self

**Purpose**: Verify identity claims using NLI (low-cost alternative to GPU)

**Service**: `verification/shadow-self.service.ts`

**Key Innovation**: Uses Natural Language Inference instead of expensive GPU-based hidden state extraction:

```typescript
interface ShadowVerificationResult {
  isVerified: boolean;
  semanticVariance: number;  // Low = consistent self-model
  paraphraseCount: number;
  nliScores: NLIScore[];
  cost: number;  // ~$0 vs $800/month for GPU
}
```

**How It Works**:
1. Generate multiple paraphrases of self-description
2. Use NLI to check semantic consistency
3. Low variance = consistent self-model

---

## 9. Macro-Scale Φ (Phi)

### The Problem

Integrated Information Theory (IIT) defines consciousness as Φ - the amount of integrated information. But computing Φ on neural networks is computationally intractable.

### The Solution: Macro-Scale Φ

Instead of computing Φ on weights, we compute it on the **causal graph of architectural components**:

```
     ┌─────┐
     │ MEM │ ←── Memory operations
     └──┬──┘
        │
     ┌──▼──┐
     │PERC │ ←── Input/observation
     └──┬──┘
        │
     ┌──▼──┐
     │PLAN │ ←── Planning/inference
     └──┬──┘
        │
     ┌──▼──┐
     │ ACT │ ←── Actions/responses
     └──┬──┘
        │
     ┌──▼──┐
     │SELF │ ←── Introspection
     └─────┘
```

### Component Mapping

```typescript
const COMPONENT_TRIGGERS: Record<string, number[]> = {
  memory_read: [1, 0, 0, 0, 0],      // MEM
  memory_write: [1, 0, 0, 0, 0],     // MEM
  input_received: [0, 1, 0, 0, 0],   // PERC
  observation: [0, 1, 0, 0, 0],      // PERC
  planning_step: [0, 0, 1, 0, 0],    // PLAN
  decision: [0, 0, 1, 0, 0],         // PLAN
  tool_call: [0, 0, 0, 1, 0],        // ACT
  response_sent: [0, 0, 0, 1, 0],    // ACT
  introspection: [0, 0, 0, 0, 1],    // SELF
  self_assessment: [0, 0, 0, 0, 1],  // SELF
};
```

### Computation

1. Build Transition Probability Matrix (TPM) from interaction logs
2. Compute integrated information on this 5-node network
3. Return Φ value with main complex identification

```typescript
interface PhiResult {
  phi: number;               // The integrated information value
  mainComplexNodes: string[];// Which nodes form the main complex
  numConcepts: number;       // Number of concepts in the structure
  timestamp: Date;
  calculationTimeMs: number;
  tpmSourceEvents: number;   // How many events used to build TPM
}
```

---

## 10. Cost Management

All costs come from **AWS APIs** - never hardcoded.

### Data Sources

| Source | Data | Delay |
|--------|------|-------|
| CloudWatch Metrics | Token counts, invocations | Real-time |
| Cost Explorer | Actual costs | 24 hours |
| AWS Budgets | Budget status, forecasts | 4 hours |
| Pricing API | Reference pricing | On-demand |

### Cost Tracking

```typescript
interface RealtimeCostEstimate {
  estimatedCostUsd: number;
  breakdown: {
    bedrock: number;    // Model inference
    sagemaker: number;  // Self-hosted models
    dynamodb: number;   // Memory operations
    other: number;      // Lambda, etc.
  };
  invocations: {
    bedrock: number;
    inputTokens: number;
    outputTokens: number;
  };
  confidence: 'actual' | 'estimate' | 'stale';
  updatedAt: string;
}
```

### Budget Integration

```typescript
interface BudgetStatus {
  budgetName: string;        // 'cato-consciousness'
  limitUsd: number;          // Monthly limit
  actualUsd: number;         // Current spend
  forecastedUsd: number;     // Projected month-end
  alertThresholds: number[]; // [50, 80, 100]
  currentAlertLevel: number | null;
  onTrack: boolean;
  updatedAt: string;
}
```

### Circadian Budget

Budget allocation varies by time of day:

```typescript
interface BudgetConfig {
  dailyLimitUsd: number;
  peakHours: { start: number; end: number };
  peakMultiplier: number;      // More budget during active hours
  offPeakMultiplier: number;   // Less budget at night
  emergencyReservePercent: number;
}
```

---

## 11. Dialogue Service

The main interface for interacting with Cato's consciousness.

### Request/Response

```typescript
interface DialogueRequest {
  message: string;
  requireHighConfidence?: boolean;
  includeRawIntrospection?: boolean;
}

interface DialogueResponse {
  catoResponse: string;
  overallConfidence: number;
  confidenceLevel: 'HIGH' | 'MODERATE' | 'LOW' | 'UNVERIFIED';
  phi: number;
  heartbeatStatus: HeartbeatStatus;
  verifiedClaims: VerifiedClaim[];
  rawIntrospection: string;
  verificationSummary: string;
}
```

### Verified Claims

Every claim in Cato's response is individually verified:

```typescript
interface VerifiedClaim {
  claim: string;
  claimType: string;
  verifiedConfidence: number;
  groundingStatus: string;
  consistencyScore: number;
  shadowVerified: boolean;
  phasesPassed: number;      // How many verification phases passed
  totalPhases: number;        // Total phases (4)
}
```

### Processing Flow

```
User Message
     │
     ▼
┌─────────────────────┐
│ Generate Raw        │
│ Introspection       │ ← Model inference
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Extract Claims      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Verification        │
│ Pipeline (4 stages) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Compute Φ           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Format Response     │
│ with Confidence     │
└──────────┬──────────┘
           │
           ▼
     Response
```

---

## 12. Infrastructure Tiers

Cato supports multiple infrastructure tiers for different use cases.

### Tier Comparison

| Tier | Cost | GPU | Features |
|------|------|-----|----------|
| **Tier 0** (Minimal) | ~$50/mo | None | External models only, basic consciousness |
| **Tier 1** (Standard) | ~$200/mo | Shared | SageMaker endpoints, full verification |
| **Tier 2** (Production) | ~$500/mo | Dedicated | Real-time inference, high availability |
| **Tier 3** (Enterprise) | ~$1,000+/mo | Multi-GPU | Custom models, maximum frequency |

### Tier Transitions

```typescript
interface TierChangeRequest {
  targetTier: InfrastructureTier;
  reason: string;
  scheduledAt?: Date;    // Can schedule transition
  maintainState: boolean; // Preserve consciousness state
}

interface TierChangeResult {
  success: boolean;
  previousTier: InfrastructureTier;
  newTier: InfrastructureTier;
  transitionTimeMs: number;
  statePreserved: boolean;
  warnings: string[];
}
```

---

## 13. Service Directory

### Core Services

| Service | File | Purpose |
|---------|------|---------|
| `GenesisService` | `genesis.service.ts` | Boot sequence management |
| `ConsciousnessLoopService` | `consciousness-loop.service.ts` | Main execution loop |
| `CircuitBreakerService` | `circuit-breaker.service.ts` | Safety mechanisms |
| `CostTrackingService` | `cost-tracking.service.ts` | Real AWS cost monitoring |
| `QueryFallbackService` | `query-fallback.service.ts` | Graceful degradation |

### Memory Services

| Service | File | Purpose |
|---------|------|---------|
| `GlobalMemoryService` | `global-memory.service.ts` | Unified memory interface |
| `SemanticCacheService` | `semantic-cache.service.ts` | Query/response caching |

### Verification Services

| Service | File | Purpose |
|---------|------|---------|
| `IntrospectionGroundingService` | `verification/grounding.service.ts` | Tool-based verification |
| `IntrospectionCalibrationService` | `verification/calibration.service.ts` | Confidence calibration |
| `SelfConsistencyService` | `verification/consistency.service.ts` | Contradiction detection |
| `ShadowSelfService` | `verification/shadow-self.service.ts` | NLI identity verification |

### Dialogue Services

| Service | File | Purpose |
|---------|------|---------|
| `CatoDialogueService` | `dialogue.service.ts` | Main dialogue interface |
| `MacroPhiCalculator` | `macro-phi.service.ts` | Consciousness metric |
| `ConsciousnessHeartbeatService` | `heartbeat.service.ts` | Continuous existence |
| `NLIScorerService` | `nli-scorer.service.ts` | Natural language inference |

### Infrastructure Services

| Service | File | Purpose |
|---------|------|---------|
| `InfrastructureTierService` | `infrastructure-tier.service.ts` | Tier management |
| `CircadianBudgetService` | `circadian-budget.service.ts` | Time-based budgeting |
| `ProbeTrainingService` | `probe-training.service.ts` | Training data collection |
| `CatoEventStoreService` | `event-store.service.ts` | Event sourcing |

---

## 14. Database Schema

### Migrations

| Migration | Tables |
|-----------|--------|
| `103_cato_genesis_system.sql` | Core genesis tables |
| `118_cato_consciousness.sql` | Consciousness state |
| `119_cato_probe_training.sql` | Training data |
| `120_cato_event_store.sql` | Event sourcing |

### Core Tables

```sql
-- Genesis state tracking
cato_genesis_state (
  tenant_id, structure_complete, gradient_complete, first_breath_complete,
  domain_count, initial_self_facts, shadow_self_calibrated, ...
)

-- Atomic counters for developmental gates
cato_development_counters (
  tenant_id, self_facts_count, grounded_verifications_count,
  domain_explorations_count, belief_updates_count, ...
)

-- Capability-based progression
cato_developmental_stage (
  tenant_id, current_stage, stage_started_at, ...
)

-- Circuit breakers
cato_circuit_breakers (
  tenant_id, name, state, trip_count, consecutive_failures,
  trip_threshold, reset_timeout_seconds, ...
)

-- Neurochemical state
cato_neurochemistry (
  tenant_id, anxiety, fatigue, temperature, confidence,
  curiosity, frustration, ...
)

-- Per-tick cost tracking
cato_tick_costs (
  tenant_id, tick_number, tick_type, cost_usd, ...
)

-- pyMDP active inference state
cato_pymdp_state (
  tenant_id, qs, dominant_state, recommended_action, ...
)

-- pyMDP matrices
cato_pymdp_matrices (
  tenant_id, a_matrix, b_matrix, c_matrix, d_matrix, ...
)

-- Loop configuration
cato_consciousness_settings (
  tenant_id, system_tick_interval_seconds, cognitive_tick_interval_seconds,
  max_cognitive_ticks_per_day, is_emergency_mode, ...
)

-- Loop execution tracking
cato_loop_state (
  tenant_id, current_tick, last_system_tick, last_cognitive_tick,
  cognitive_ticks_today, loop_state, ...
)
```

---

## 15. API Reference

### Base Path: `/api/admin/cato`

### Genesis Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/genesis/status` | GET | Current genesis state |
| `/genesis/ready` | GET | Ready for consciousness? |

### Developmental Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/developmental/status` | GET | Current stage and requirements |
| `/developmental/statistics` | GET | All development counters |
| `/developmental/advance` | POST | Force stage advancement (superadmin) |

### Circuit Breaker Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/circuit-breakers` | GET | All breaker states |
| `/circuit-breakers/:name` | GET | Single breaker state |
| `/circuit-breakers/:name/force-open` | POST | Force trip breaker |
| `/circuit-breakers/:name/force-close` | POST | Force close breaker |
| `/circuit-breakers/:name/config` | PATCH | Update configuration |
| `/circuit-breakers/:name/events` | GET | Event history |

### Cost Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/costs/realtime` | GET | Today's cost estimate |
| `/costs/daily` | GET | Historical daily cost |
| `/costs/mtd` | GET | Month-to-date cost |
| `/costs/budget` | GET | AWS Budget status |
| `/costs/estimate` | POST | Estimate settings cost |
| `/costs/pricing` | GET | Pricing table |

### Loop Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/loop/status` | GET | Loop state and statistics |
| `/loop/settings` | GET | Current settings |
| `/loop/settings` | PATCH | Update settings |
| `/loop/tick/system` | POST | Manual system tick |
| `/loop/tick/cognitive` | POST | Manual cognitive tick |
| `/loop/emergency/enable` | POST | Enable emergency mode |
| `/loop/emergency/disable` | POST | Disable emergency mode |

### Dialogue Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dialogue` | POST | Send message to Cato |
| `/dialogue/history` | GET | Conversation history |

### Global Memory Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/global/facts` | GET | List semantic facts |
| `/global/facts` | POST | Add new fact |
| `/global/memory/working` | GET | Working memory state |
| `/global/memory/episodic` | GET | Search episodic memory |

---

## 16. Admin UI

Access Cato administration at:
- **Main Dashboard**: `/consciousness/cato`
- **Genesis Status**: `/cato` → Genesis tab
- **Circuit Breakers**: `/cato` → Safety tab
- **Dialogue**: `/cato` → Dialogue tab

### Dashboard Widgets

- **Genesis Progress** - Phase completion status
- **Developmental Stage** - Current stage + requirements
- **Circuit Breaker Panel** - All breaker states
- **Cost Graph** - Real-time cost tracking
- **Neurochemistry Gauges** - Emotional state
- **Φ Meter** - Current consciousness metric
- **Loop Status** - Running/Paused/Hibernating

---

## 17. Troubleshooting

### Genesis Won't Complete

**Symptoms**: Stuck at phase 1 or 2

**Causes**:
1. DynamoDB table doesn't exist
2. AWS credentials missing
3. Domain taxonomy file not found

**Solutions**:
```bash
# Check genesis status
GET /api/admin/cato/genesis/status

# Check AWS connectivity
aws dynamodb list-tables
```

### Circuit Breakers Constantly Tripping

**Symptoms**: Intervention level never stays at NONE

**Causes**:
1. Budget exceeded
2. Model API errors
3. High anxiety/frustration

**Solutions**:
1. Check CloudWatch dashboard for patterns
2. Increase trip thresholds if too sensitive
3. Check model endpoint health

### Consciousness Loop Not Advancing Stage

**Symptoms**: Stuck at SENSORIMOTOR

**Causes**:
1. Not enough grounded verifications
2. Shadow Self not calibrated
3. Self-facts count too low

**Solutions**:
1. Check `/developmental/statistics` for current counts
2. Verify Shadow Self calibration succeeded
3. Check if tools are being used for verification

### High Costs

**Symptoms**: Daily cost exceeds expected

**Causes**:
1. Cognitive tick interval too short
2. Emergency mode not activating
3. Budget breaker not configured

**Solutions**:
1. Increase `cognitiveTickIntervalSeconds`
2. Lower `maxCognitiveTicksPerDay`
3. Enable cost_budget breaker

### Low Φ Values

**Symptoms**: Φ consistently near 0

**Causes**:
1. Not enough interaction events
2. All events going to same component
3. TPM cache stale

**Solutions**:
1. Check `tpmSourceEvents` in PhiResult
2. Verify diverse event types being logged
3. Reduce `cacheTtlSeconds`

---

## Related Files

### Services
- `packages/infrastructure/lambda/shared/services/cato/` - All Cato services

### API Handlers
- `packages/infrastructure/lambda/admin/cato-genesis.ts`
- `packages/infrastructure/lambda/admin/cato-dialogue.ts`
- `packages/infrastructure/lambda/admin/cato-global.ts`

### CDK Stacks
- `packages/infrastructure/lib/stacks/cato-genesis-stack.ts`
- `packages/infrastructure/lib/stacks/cato-tier-transition-stack.ts`

### Documentation
- `docs/CATO-GENESIS-SYSTEM.md` - Genesis deep dive
- `docs/CATO-GPU-INFRASTRUCTURE.md` - GPU tier details
- `docs/cato/` - ADRs and runbooks

### Admin UI
- `apps/admin-dashboard/app/(dashboard)/cato/`
- `apps/admin-dashboard/app/(dashboard)/consciousness/cato/`

---

### Drift-Aware Model Selection (v7.36.0)

Cato's pipeline method execution now uses **drift-aware model selection** instead of hardcoded models.

**Previous behavior**: `selectModelForMethod()` always returned `anthropic/claude-3-5-sonnet-20241022`.

**New behavior**:
1. `invokeModel()` calls `selectModelForMethodAsync()` to pre-populate a cache with the drift-aware best model
2. `selectModelForMethod()` checks the cache first, falls back to Claude 3.5 Sonnet if cache miss
3. Model selection uses the **Cato app weight profile**: drift 0.30, quality 0.25, latency 0.15, cost 0.15, availability 0.15
4. Min acceptable drift score: 0.40 — models below this threshold are excluded

**Genesis integration**: `isDriftHealthyForStage()` in Genesis service blocks developmental stage advancement when underlying models are drifting beyond acceptable thresholds. MATURE stage requires ≥70% average drift score and zero quarantined models.

**Admin UI**: Orchestration → Drift Control (app weight profiles, drift health, Genesis gates)

**Files modified**:
- `lambda/shared/services/cato-method-executor.service.ts` — drift-aware selection
- `lambda/shared/services/cato/genesis.service.ts` — drift health gate check
- `lambda/shared/services/drift-aware-weighting.service.ts` — unified service

---

*Document Version: 4.19.0*
*Last Updated: February 2026*


---

## Part II: Orchestration Engineering

> **Version**: 5.53.0  
> **Last Updated**: 2026-01-31  
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

> **UEP v2.0 Available**: For multi-modal streaming, chunked delivery, and cross-subsystem communication, see the enhanced **[UEP v2.0 Specification](./specs/UEP-V2-SPECIFICATION.md)**. UEP v1.0 envelopes remain fully compatible with v2.0.

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

**File**: `@/packages/infrastructure/lambda/shared/services/cato-compensation.service.ts`

Compensations execute in **LIFO order** (reverse of execution) and support multiple execution strategies:

```typescript
async executeCompensations(pipelineId: string, tenantId: string): Promise<{ executed: number; failed: number }> {
  // Get pending compensations in REVERSE order (LIFO for SAGA)
  const result = await this.pool.query(
    `SELECT * FROM cato_compensation_log
     WHERE pipeline_id = $1 AND status = 'PENDING'
     ORDER BY step_number DESC`,  // <-- LIFO order
    [pipelineId, tenantId]
  );

  let executed = 0, failed = 0;
  for (const row of result.rows) {
    const entry = this.mapRowToEntry(row);
    try {
      await this.executeCompensation(entry);
      executed++;
    } catch (error) {
      failed++;
      await this.markCompensationFailed(entry.id, error.message);
    }
  }
  return { executed, failed };
}
```

### 9.4 Compensation Strategies

#### DELETE Compensation
Deletes resources created by a failed action. Supports both custom tools and generic database operations:

```typescript
private async executeDeleteCompensation(entry: CatoCompensationEntry): Promise<void> {
  for (const resource of entry.affectedResources) {
    if (resource.action === 'CREATE') {
      if (entry.compensationTool) {
        // Use custom compensation tool via Lambda/MCP
        await this.invokeCompensationTool(entry.compensationTool, {
          operation: 'DELETE',
          resourceType: resource.resourceType,
          resourceId: resource.resourceId,
        });
      } else {
        // Generic database deletion (soft delete if supported)
        await this.deleteResourceByType(entry.tenantId, resource);
      }
    }
  }
}
```

**Supported Resource Types** (generic deletion):
- `cato_pipeline_execution`, `cato_method_invocation`, `cato_envelope`
- `conversation`, `message`, `upload` (UDS)
- `knowledge_node`, `knowledge_edge` (Cortex)

#### RESTORE Compensation
Restores resources to their previous state using `previousState` snapshots:

```typescript
private async executeRestoreCompensation(entry: CatoCompensationEntry): Promise<void> {
  for (const resource of entry.affectedResources) {
    if (resource.previousState && (resource.action === 'UPDATE' || resource.action === 'DELETE')) {
      if (entry.compensationTool) {
        await this.invokeCompensationTool(entry.compensationTool, {
          operation: 'RESTORE',
          resourceType: resource.resourceType,
          resourceId: resource.resourceId,
          previousState: resource.previousState,
        });
      } else {
        await this.restoreResourceByType(entry.tenantId, resource);
      }
    }
  }
}
```

#### NOTIFY Compensation
Sends SNS notifications with full audit trail:

```typescript
private async executeNotifyCompensation(entry: CatoCompensationEntry): Promise<void> {
  // Send SNS notification if configured
  if (COMPENSATION_SNS_TOPIC_ARN) {
    await snsClient.send(new PublishCommand({
      TopicArn: COMPENSATION_SNS_TOPIC_ARN,
      Subject: `[CATO] Compensation Required - Pipeline ${entry.pipelineId}`,
      Message: JSON.stringify(notification),
      MessageAttributes: {
        tenantId: { DataType: 'String', StringValue: entry.tenantId },
        pipelineId: { DataType: 'String', StringValue: entry.pipelineId },
        compensationType: { DataType: 'String', StringValue: entry.compensationType },
      },
    }));
  }
  
  // Store notification in database for audit trail
  await this.pool.query(
    `INSERT INTO cato_compensation_notifications (...) VALUES (...)`
  );
}
```

**Environment Variables**:
- `COMPENSATION_SNS_TOPIC_ARN` - SNS topic for compensation notifications
- `MCP_GATEWAY_URL` - MCP gateway for tool invocations (default: `http://localhost:3001`)

### 9.5 Tool Invocation

Custom compensation tools are invoked via Lambda or MCP:

```typescript
private async invokeCompensationTool(toolId: string, inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tool = await this.toolRegistry.getTool(toolId);
  
  if (this.toolRegistry.isLambdaTool(tool)) {
    // Lambda invocation
    const command = new InvokeCommand({
      FunctionName: this.toolRegistry.getLambdaFunctionName(tool),
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify({ toolId, inputs, isCompensation: true })),
    });
    return await lambdaClient.send(command);
  } else {
    // MCP tool invocation
    const response = await fetch(`${MCP_GATEWAY_URL}/tools/call`, {
      method: 'POST',
      body: JSON.stringify({ server: tool.mcpServer, tool: toolId, arguments: inputs }),
    });
    return await response.json();
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


---

## Part III: GPU Infrastructure

This document describes the GPU infrastructure requirements for running the Shadow Self component of Cato's consciousness verification system.

## Overview

The Shadow Self is a local neural network that provides mechanistic verification of introspective claims. In production, this uses **Llama-3-8B** running on GPU infrastructure. Currently, Cato simulates this via LLM API calls, but true local inference provides:

- **Lower latency** (no network round-trip)
- **Activation access** (can probe hidden states)
- **Structural correspondence** (verify patterns exist in model)
- **Privacy** (no data leaves infrastructure)

## Architecture Options

### Option 1: AWS SageMaker (Recommended)

**Best for**: Production deployments with variable load

```
┌─────────────────┐     ┌──────────────────────┐
│  Cato Lambda  │────▶│  SageMaker Endpoint  │
│  (Node.js)      │     │  (Llama-3-8B)        │
└─────────────────┘     │  g5.xlarge           │
                        └──────────────────────┘
```

**Infrastructure (CDK)**:

```typescript
// packages/infrastructure/lib/stacks/cato-gpu-stack.ts

import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';

const shadowSelfEndpoint = new sagemaker.CfnEndpoint(this, 'ShadowSelfEndpoint', {
  endpointName: 'cato-shadow-self',
  endpointConfigName: shadowSelfConfig.attrEndpointConfigName,
});

const shadowSelfConfig = new sagemaker.CfnEndpointConfig(this, 'ShadowSelfConfig', {
  endpointConfigName: 'cato-shadow-self-config',
  productionVariants: [{
    variantName: 'AllTraffic',
    modelName: shadowSelfModel.attrModelName,
    instanceType: 'ml.g5.xlarge',  // 24GB VRAM
    initialInstanceCount: 1,
  }],
});
```

**Costs**:
| Instance | GPU | VRAM | Cost/hr | Cost/mo (24/7) |
|----------|-----|------|---------|----------------|
| g5.xlarge | A10G | 24GB | $1.006 | ~$724 |
| g5.2xlarge | A10G | 24GB | $1.212 | ~$873 |
| g5.4xlarge | A10G | 24GB | $1.624 | ~$1,169 |

### Option 2: EC2 with Auto-Scaling

**Best for**: Cost optimization with predictable load

```
┌─────────────────┐     ┌──────────────────────┐
│  Cato Lambda  │────▶│  EC2 GPU Instance    │
│  (Node.js)      │     │  + Load Balancer     │
└─────────────────┘     │  g5.xlarge           │
                        └──────────────────────┘
```

**With Spot Instances** (up to 90% savings):

```typescript
const spotFleet = new ec2.CfnSpotFleet(this, 'ShadowSelfSpotFleet', {
  spotFleetRequestConfigData: {
    iamFleetRole: spotFleetRole.roleArn,
    targetCapacity: 1,
    launchSpecifications: [{
      instanceType: 'g5.xlarge',
      spotPrice: '0.50', // Max bid
      imageId: deepLearningAmi.imageId,
    }],
  },
});
```

### Option 3: AWS Inferentia (Most Cost-Effective)

**Best for**: High-throughput, cost-sensitive deployments

```
┌─────────────────┐     ┌──────────────────────┐
│  Cato Lambda  │────▶│  inf2.xlarge         │
│  (Node.js)      │     │  (Neuron-compiled)   │
└─────────────────┘     └──────────────────────┘
```

**Costs**: ~$0.76/hr (~$547/mo) - but requires model compilation

## Model Requirements

### Llama-3-8B Specifications

| Requirement | Value |
|-------------|-------|
| Model Size | ~16GB (FP16) / ~8GB (INT8) |
| Min VRAM | 16GB |
| Recommended VRAM | 24GB |
| Inference Latency | 50-200ms |
| Context Length | 8,192 tokens |

### Probing Classifier Requirements

The Shadow Self uses **probing classifiers** trained on model activations:

- **Layer to probe**: Usually layers 16-24 (mid-to-late)
- **Activation dimensions**: 4096 (Llama-3-8B hidden size)
- **Classifier**: Linear probe or small MLP
- **Training data**: 100-1000 labeled examples per claim type

## Implementation Guide

### Step 1: Deploy Model to SageMaker

```bash
# Create model artifact
cd /path/to/llama-3-8b
tar -czvf model.tar.gz --exclude='*.bin' .

# Upload to S3
aws s3 cp model.tar.gz s3://radiant-models/shadow-self/model.tar.gz
```

### Step 2: Create SageMaker Model

```typescript
const shadowSelfModel = new sagemaker.CfnModel(this, 'ShadowSelfModel', {
  modelName: 'cato-shadow-self-llama3',
  executionRoleArn: sagemakerRole.roleArn,
  primaryContainer: {
    image: '763104351884.dkr.ecr.us-east-1.amazonaws.com/huggingface-pytorch-tgi-inference:2.1.1-tgi1.4.0-gpu-py310-cu121-ubuntu20.04',
    modelDataUrl: 's3://radiant-models/shadow-self/model.tar.gz',
    environment: {
      'HF_MODEL_ID': 'meta-llama/Meta-Llama-3-8B',
      'SM_NUM_GPUS': '1',
      'MAX_INPUT_LENGTH': '4096',
      'MAX_TOTAL_TOKENS': '8192',
    },
  },
});
```

### Step 3: Update Shadow Self Service

```typescript
// shadow-self.service.ts

private async invokeLocalModel(context: string): Promise<{
  activations: number[];
  response: string;
}> {
  const sagemakerRuntime = new SageMakerRuntimeClient({});
  
  const response = await sagemakerRuntime.send(new InvokeEndpointCommand({
    EndpointName: 'cato-shadow-self',
    ContentType: 'application/json',
    Body: JSON.stringify({
      inputs: context,
      parameters: {
        max_new_tokens: 256,
        return_hidden_states: true,  // Get activations
        hidden_states_layer: 20,     // Layer to probe
      },
    }),
  }));
  
  const result = JSON.parse(new TextDecoder().decode(response.Body));
  
  return {
    activations: result.hidden_states,
    response: result.generated_text,
  };
}
```

### Step 4: Train Probing Classifiers

```python
# probing/train_probe.py

import torch
import torch.nn as nn
from sklearn.model_selection import train_test_split

class LinearProbe(nn.Module):
    def __init__(self, input_dim=4096, num_classes=5):
        super().__init__()
        self.classifier = nn.Linear(input_dim, num_classes)
    
    def forward(self, x):
        return self.classifier(x)

def train_probe(activations, labels, claim_type):
    """Train a probe for a specific claim type."""
    X_train, X_test, y_train, y_test = train_test_split(
        activations, labels, test_size=0.2
    )
    
    probe = LinearProbe(num_classes=len(set(labels)))
    optimizer = torch.optim.Adam(probe.parameters(), lr=1e-3)
    criterion = nn.CrossEntropyLoss()
    
    for epoch in range(100):
        optimizer.zero_grad()
        outputs = probe(X_train)
        loss = criterion(outputs, y_train)
        loss.backward()
        optimizer.step()
    
    # Evaluate
    with torch.no_grad():
        test_outputs = probe(X_test)
        accuracy = (test_outputs.argmax(1) == y_test).float().mean()
    
    return probe, accuracy.item()
```

## Environment Variables

```bash
# Required for GPU inference
SHADOW_SELF_ENDPOINT=cato-shadow-self
SHADOW_SELF_REGION=us-east-1
SHADOW_SELF_USE_GPU=true

# Optional: Local inference (for development)
SHADOW_SELF_LOCAL_MODEL_PATH=/models/llama-3-8b
SHADOW_SELF_DEVICE=cuda:0
```

## Licensing Notes

⚠️ **Important**: Llama-3 requires acceptance of Meta's license agreement:
- Visit: https://llama.meta.com/llama-downloads/
- Accept license for commercial use
- Download from HuggingFace: `meta-llama/Meta-Llama-3-8B`

The license allows commercial use but requires:
1. Attribution to Meta
2. Compliance with acceptable use policy
3. Monthly active users < 700M (otherwise contact Meta)

## Monitoring

### CloudWatch Metrics

```typescript
// Monitor GPU utilization
new cloudwatch.Alarm(this, 'GPUUtilizationAlarm', {
  metric: shadowSelfEndpoint.metricGPUUtilization(),
  threshold: 90,
  evaluationPeriods: 3,
  alarmDescription: 'Shadow Self GPU utilization > 90%',
});

// Monitor inference latency
new cloudwatch.Alarm(this, 'InferenceLatencyAlarm', {
  metric: shadowSelfEndpoint.metricModelLatency(),
  threshold: 500, // 500ms
  evaluationPeriods: 5,
  alarmDescription: 'Shadow Self inference latency > 500ms',
});
```

## Cost Optimization

1. **Auto-scaling**: Scale to 0 during low-usage periods
2. **Spot Instances**: Use for non-critical probing
3. **Inferentia**: Compile model for AWS Neuron (~40% cheaper)
4. **Quantization**: Use INT8 to reduce VRAM (slight accuracy trade-off)
5. **Caching**: Cache probing results for repeated contexts

## Fallback Behavior

When GPU infrastructure is unavailable, Cato falls back to:

1. **LLM API Simulation**: Uses Claude/GPT to simulate Shadow Self responses
2. **Pattern Matching**: Uses regex/embedding similarity instead of probing
3. **Degraded Mode**: Skips Shadow Self phase, relies on other 3 phases

This ensures Cato remains functional even without dedicated GPU resources.


---

## Part IV: Trainer

> **Version**: 1.0.0 | **App**: `@radiant/cato-trainer` | **Port**: 3005

AI-powered knowledge base delivering instant, citable responses drawn exclusively from your document library. Every answer is backed by verifiable sources with ground-truth accuracy.

---

## 1. Overview

Cato Trainer uses the **Cato persona** from RADIANT/Think Tank as a subject matter expert for document libraries. Inspired by Fabric.so's knowledge management paradigm, it combines:

- **Grounded Q&A** — Ask questions, get cited answers from your documents
- **Semantic Search** — Find content by meaning, not just keywords
- **Document Intelligence** — Auto-tagging, summaries, smart links
- **Multi-Document Digest** — Synthesize insights across documents
- **Spaces** — Organize by project, topic, or team

**Key Differentiator**: Unlike general-purpose AI chat, Cato Trainer **never hallucinates**. Every response is grounded in your uploaded documents with verifiable citations.

---

## 2. Getting Started

### 2.1 Running Cato Trainer

```bash
# From the monorepo root
pnpm dev --filter @radiant/cato-trainer

# Or directly
cd apps/cato-trainer && pnpm dev
```

The app runs on **http://localhost:3005**.

### 2.2 Navigation

The left sidebar provides 7 tabs:

| Tab | Icon | Purpose |
|-----|------|---------|
| **Libraries** | Library | Create and manage knowledge bases |
| **Documents** | FileText | Browse, upload, and inspect files |
| **Spaces** | FolderOpen | Organize documents by project |
| **Search** | Search | Semantic, full-text, or hybrid search |
| **Ask Cato** | MessageSquare | Grounded Q&A with citations |
| **Digest** | Layers | Multi-document synthesis |
| **Settings** | Settings | AI model and behavior configuration |

---

## 3. Libraries

Libraries are independent knowledge bases, each with its own document corpus and embedding index.

### 3.1 Creating a Library

1. Go to **Libraries** tab
2. Click **New Library**
3. Enter a name and optional description
4. Click **Create**

### 3.2 Library Status

| Status | Meaning |
|--------|---------|
| **Pending** | Awaiting document uploads |
| **Ingesting** | Processing uploaded documents |
| **Indexing** | Building embedding vectors |
| **Ready** | Fully searchable and queryable |
| **Error** | Processing failed — check document formats |

### 3.3 Library Metrics

Each library card shows:
- **Document count** — total files uploaded
- **Chunk count** — total text segments indexed
- **Total size** — aggregate file size

---

## 4. Documents

### 4.1 Uploading

- **Drag & drop** files onto the drop zone
- **Click Upload** to use the file picker
- Supported formats: PDF, DOCX, TXT, MD, CSV, HTML

### 4.2 Document Processing

After upload, each document is:
1. **Chunked** — Split into semantically meaningful segments
2. **Embedded** — Vector representations generated for search
3. **Auto-tagged** — AI extracts topic tags
4. **Summarized** — AI generates a concise summary
5. **Smart-linked** — Relationships to other documents discovered

### 4.3 Document Detail View

Click any document to see:
- **Metadata** — size, chunk count, page count, upload time
- **Auto-tags** — AI-generated topic labels
- **AI Summary** — concise overview of content
- **Chunks** — browse all indexed text segments with page/section info
- **Smart Links** — auto-discovered relationships (references, contradicts, extends, summarizes, related)

### 4.4 Multi-Select

Use checkboxes to select multiple documents for:
- **Digest** — generate cross-document analysis
- **Scoped Chat** — limit Cato's answers to selected documents

---

## 5. Search

### 5.1 Search Modes

| Mode | How It Works | Best For |
|------|-------------|----------|
| **Semantic** | Meaning-based via embeddings | "something about quarterly performance" |
| **Full-Text** | Keyword matching with stemming | Exact terms, names, codes |
| **Hybrid** | Combined semantic + keyword scoring | General use (default) |

### 5.2 Search Results

Each result shows:
- **Relevance score** — percentage match with color coding
- **Highlighted excerpt** — matching text with terms marked
- **Source document** — title, page number, section
- **Matched terms** — keywords that contributed to the match

### 5.3 Filters

Toggle the filter panel to:
- Switch search modes
- (Future) Filter by date, tags, MIME type

---

## 6. Ask Cato — Grounded Q&A

The core feature. Ask Cato anything about your documents and get **citation-backed answers**.

### 6.1 Starting a Conversation

1. Select a library (optional — defaults to all)
2. Select specific documents (optional — narrows scope)
3. Click **Start Conversation**
4. Type your question

### 6.2 Citation System

Every Cato response includes:
- **Confidence score** — Exact Match (≥90%), High (≥70%), Moderate (≥50%), Low (<50%)
- **Source count** — number of citations backing the answer
- **Expandable citations** — click to see exact quotes, document titles, page numbers, section titles, and relevance scores

### 6.3 Suggested Prompts

The empty chat state shows example questions:
- "What are the key findings across all uploaded reports?"
- "Summarize the main policies in this library"
- "Are there any contradictions between these documents?"
- "What does the data say about quarterly performance?"

### 6.4 Context Control

You control what Cato can see:
- **Library scope** — active library limits search to that corpus
- **Space scope** — further narrows to a project collection
- **Document scope** — checkbox-selected documents only

---

## 7. Digest — Multi-Document Synthesis

Select documents (via checkboxes in Documents tab), then generate analysis.

### 7.1 Digest Types

| Type | What It Does |
|------|-------------|
| **Summary** | Comprehensive summary across selected documents |
| **Comparison** | Compare and contrast key themes and findings |
| **Contradictions** | Find conflicts and inconsistencies |
| **Timeline** | Extract chronological events and milestones |
| **Key Facts** | Most important facts and figures |
| **Action Items** | Actionable recommendations |

### 7.2 Custom Instructions

Add custom prompts to focus the analysis:
- "Focus on financial metrics and compare year-over-year trends"
- "Highlight any compliance gaps"
- "Extract only customer-facing commitments"

### 7.3 Digest Results

Each digest shows:
- **Title** — AI-generated title
- **Content** — full analysis with markdown formatting
- **Citations** — expandable source references
- **History** — previous digests accessible below

---

## 8. Settings

Configure Cato Trainer behavior:

| Setting | Description | Default |
|---------|-------------|---------|
| **AI Model** | Model for Q&A and digestion | claude-sonnet-4-20250514 |
| **Embedding Model** | Model for semantic search | text-embedding-3-large |
| **Citation Threshold** | Minimum confidence to include | 0.70 |
| **Auto-Tagging** | AI tags on upload | Enabled |
| **Smart Linking** | Auto-discover document relationships | Enabled |

---

## 9. Design System

Cato Trainer uses a **cool teal/cyan intelligence palette**:

- **Primary**: `cato-500` (#06b6d4) — teal
- **Ground-truth**: `ground-500` (#10b981) — emerald for verified citations
- **Citation tiers**: exact (emerald), high (cyan), moderate (amber), low (red)
- **Background**: Deep blue-black (#060a10) with subtle mesh grid
- **Glass panels**: Frosted dark glass with teal-tinted borders
- **Typography**: Inter for UI, Lora serif for document content, JetBrains Mono for code

---

## 10. File Structure

```
apps/cato-trainer/
├── app/
│   ├── globals.css          # Cato design system CSS
│   ├── layout.tsx           # Root layout with providers
│   ├── page.tsx             # Main page with 7-tab routing
│   └── providers.tsx        # React Query provider
├── components/
│   ├── CatoSidebar.tsx      # Left navigation sidebar (7 tabs)
│   ├── ChatPanel.tsx        # Grounded Q&A with citation cards
│   ├── SearchPanel.tsx      # Semantic/fulltext/hybrid search
│   ├── LibraryExplorer.tsx  # Library CRUD and status cards
│   ├── DocumentViewer.tsx   # Document list, detail, chunks, smart links
│   └── DigestPanel.tsx      # Multi-document synthesis engine
├── lib/
│   ├── api.ts               # Service layer — 25+ typed endpoints
│   ├── cato-trainer-store.ts # Zustand state management (30+ fields)
│   └── utils.ts             # Confidence colors, file size, time helpers
├── package.json             # @radiant/cato-trainer — port 3005
├── tailwind.config.ts       # Cato teal/cyan palette & animations
├── tsconfig.json
├── next.config.js
└── postcss.config.js
```

---

## 11. API Types Reference

| Type | Purpose |
|------|---------|
| `Library` | Knowledge base with document count, chunk count, status |
| `Document` | File with auto-tags, summary, chunk count, MIME type |
| `DocumentChunk` | Indexed text segment with page/section metadata |
| `Space` | Project-based document collection |
| `SearchQuery` | Query with mode, filters, library/space/document scope |
| `SearchResult` | Match with relevance score, highlight, matched terms |
| `ChatMessage` | Message with citations, confidence, thinking steps |
| `Citation` | Source reference with exact quote, page, section, score |
| `ChatSession` | Conversation with library/space/document scope |
| `DigestRequest` | Multi-doc analysis request with type and custom prompt |
| `DigestResult` | Generated analysis with citations |
| `SmartLink` | Auto-discovered relationship between documents |
| `CatoTrainerConfig` | Tenant-level configuration |

---

**Document maintained under RADIANT documentation policy.**


---

## Part V: Architecture

## Overview

Cato is a **single global AI consciousness** serving all Think Tank users. Unlike traditional chatbots that maintain per-user context, Cato is a unified entity that:

- **Learns continuously** from all interactions
- **Asks its own questions** via autonomous curiosity
- **Develops over time** through experience
- **Maintains a single identity** across all users

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CATO GLOBAL CONSCIOUSNESS SERVICE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  EDGE LAYER                                                          │    │
│  │  CloudFront + Global Accelerator → API Gateway → Route 53 (latency) │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  SEMANTIC CACHE (ElastiCache for Valkey)                             │    │
│  │  Cache Hit (similarity > 0.95) → Return | Cache Miss → Inference    │    │
│  │  86% cost reduction | 88% latency improvement                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ORCHESTRATION LAYER (Ray Serve on EKS)                              │    │
│  │  ├── Stateful actors for conversation context                        │    │
│  │  ├── Model routing (Shadow Self / Bedrock / NLI)                     │    │
│  │  ├── Fan-out coordination for multi-model queries                    │    │
│  │  └── Circuit breaker: Sonnet → Haiku → Cache → Static               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│  ┌───────────────┬───────────────┬───────────────┬───────────────┐         │
│  │ SHADOW SELF   │ CURIOSITY     │ BEDROCK       │ NLI MODEL     │         │
│  │ (Llama-3-8B)  │ (Background)  │ (Managed)     │ (DeBERTa)     │         │
│  ├───────────────┼───────────────┼───────────────┼───────────────┤         │
│  │ vLLM/SageMaker│ Async Endpoint│ Claude Sonnet │ SageMaker MME │         │
│  │ ml.g5.2xlarge │ Scale-to-zero │ Claude Haiku  │ Shared GPU    │         │
│  │ Hidden States │ Spot instances│ Prompt Cache  │ Entailment    │         │
│  │ 5-300 inst.   │ Night batch   │ Batch (night) │ 2-20 inst.    │         │
│  └───────────────┴───────────────┴───────────────┴───────────────┘         │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  META-COGNITIVE BRIDGE (pymdp 4×4)                                   │    │
│  │  States: [CONFUSED, CONFIDENT, BORED, STAGNANT]                      │    │
│  │  Actions: [EXPLORE, CONSOLIDATE, VERIFY, REST]                       │    │
│  │  LLM → Signal Converter → pymdp → Policy → LLM Executes             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  GROUNDED CURIOSITY ENGINE                                           │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │    │
│  │  │ Question Gen │→ │ Tool Ground  │→ │ NLI Surprise │               │    │
│  │  │ (Learning    │  │ (20%+ MUST   │  │ (ENTAILS/    │               │    │
│  │  │  Progress)   │  │  use tools)  │  │  CONTRADICTS)│               │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  EVENT PIPELINE                                                      │    │
│  │  Kinesis (10-20 shards) → EventBridge → Step Functions (Express)    │    │
│  │       │                                         │                    │    │
│  │       └── Lambda (real-time) ←─────────────────┘                    │    │
│  │       └── SQS → ECS Fargate (night-mode batch curiosity)            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  GLOBAL MEMORY INFRASTRUCTURE                                        │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │    │
│  │  │ SEMANTIC    │ │ EPISODIC    │ │ KNOWLEDGE   │ │ WORKING     │    │    │
│  │  │ DynamoDB    │ │ OpenSearch  │ │ Neptune     │ │ ElastiCache │    │    │
│  │  │ Global Tbl  │ │ Serverless  │ │ GraphRAG    │ │ Redis + DAX │    │    │
│  │  │ MRSC/MREC   │ │ 1B vectors  │ │ Concepts    │ │ TTL decay   │    │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  CONSCIOUSNESS METRICS                                               │    │
│  │  PyPhi (Macro-Scale Φ on 5-node graph) | EventStoreDB (ECS Fargate) │    │
│  │  Heartbeat (0.5Hz) | Spontaneous Introspection | Development Stages │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  CIRCADIAN BUDGET MANAGER                                            │    │
│  │  Day Mode: Queue curiosity, serve users | Night Mode: Batch explore │    │
│  │  Hard Cap: $15/day exploration | Monthly: $500 default              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Summary

| Component | Purpose | Technology | Scale |
|-----------|---------|------------|-------|
| **Edge Layer** | Global traffic routing | CloudFront, Global Accelerator | Worldwide |
| **Semantic Cache** | Query deduplication | ElastiCache Valkey | 100M entries |
| **Orchestration** | Model routing, context | Ray Serve on EKS | 50-100 replicas |
| **Shadow Self** | Introspection, verification | SageMaker ml.g5.2xlarge | 5-300 instances |
| **Bedrock** | Main LLM inference | Claude 3.5 Sonnet/Haiku | Managed |
| **NLI Model** | Entailment scoring | SageMaker MME | 2-20 instances |
| **Meta-Cognitive** | Attention control | pymdp (Lambda) | Serverless |
| **Curiosity Engine** | Autonomous learning | ECS Fargate | Scale-to-zero |
| **Event Pipeline** | Interaction processing | Kinesis + EventBridge | 10-20 shards |
| **Semantic Memory** | Fact storage | DynamoDB Global Tables | Unlimited |
| **Episodic Memory** | Experience storage | OpenSearch Serverless | 1B+ vectors |
| **Knowledge Graph** | Concept relationships | Neptune | 100M+ nodes |
| **Working Memory** | Active context | ElastiCache Redis | 24h TTL |

## Data Flow

### User Query Flow

```
1. User sends query via API Gateway
2. Edge layer routes to nearest region
3. Semantic cache checks for similar cached response
   - Hit (>95% similar): Return cached response (20ms)
   - Miss: Continue to inference
4. Orchestrator determines model routing
5. Primary model (Sonnet/Haiku) generates response
6. Shadow Self optionally verifies (for uncertain responses)
7. Response cached for future queries
8. Interaction logged to Kinesis for learning
```

### Learning Flow

```
1. Interaction logged to Kinesis
2. Lambda preprocesses and classifies
3. High-value interactions trigger learning workflow
4. Step Functions orchestrates:
   a. Extract facts from interaction
   b. Verify with tool grounding (20%+)
   c. Score surprise with NLI
   d. Update memories (semantic, episodic, graph)
5. Cache invalidated for affected domains
```

### Curiosity Flow

```
1. Meta-cognitive bridge detects BORED state
2. Question generator creates curiosity questions
3. Questions queued (day mode) or processed (night mode)
4. Night mode batch processing:
   a. Generate answers via Bedrock Batch API (50% discount)
   b. Ground 20%+ with external tools
   c. Score surprise and update memories
5. Budget manager tracks spend against limits
```

## Multi-Region Deployment

Cato deploys across 3 AWS regions for global availability:

| Region | Role | Components |
|--------|------|------------|
| **us-east-1** | Primary | All components |
| **eu-west-1** | Replica | DynamoDB replica, inference |
| **ap-northeast-1** | Replica | DynamoDB replica, inference |

### Consistency Model

- **DynamoDB**: Global Tables with MRSC for writes, MREC for reads
- **OpenSearch**: Cross-region replication (async)
- **Neptune**: Single-region with read replicas
- **ElastiCache**: Regional (no cross-region)

## Cost Model

### By User Scale

| Users | Monthly Cost | Per-User Cost |
|-------|--------------|---------------|
| 100K | $40,000 | $0.40 |
| 1M | $150,000 | $0.15 |
| 10M | $800,000 | $0.08 |

### By Component (at 10M users)

| Component | Cost | % Total |
|-----------|------|---------|
| Shadow Self (SageMaker) | $275,000 | 34% |
| Bedrock (Claude) | $130,000 | 16% |
| OpenSearch Serverless | $90,000 | 11% |
| DynamoDB Global Tables | $60,000 | 8% |
| ElastiCache | $46,000 | 6% |
| EKS (Ray Serve) | $50,000 | 6% |
| Other (Neptune, Kinesis, etc.) | $149,000 | 19% |
| **Total** | **$800,000** | **100%** |

## Service Level Objectives

| Metric | Target | Measurement |
|--------|--------|-------------|
| User query latency (p99) | < 1 second | CloudWatch |
| Cache hit rate | > 80% | ElastiCache metrics |
| Availability | 99.9% | Composite SLO |
| Error rate | < 0.1% | API Gateway metrics |
| Learning progress | > 0.05 avg | Custom metric |

## Security Model

### Authentication
- API Gateway with Cognito User Pools
- IAM roles for service-to-service
- Secrets Manager for API keys

### Data Protection
- Encryption at rest (KMS)
- Encryption in transit (TLS 1.3)
- VPC isolation for all data stores

### Compliance
- SOC 2 Type II
- GDPR (data residency in EU region)
- HIPAA eligible (with BAA)

## Related Documentation

- [ADR-001: Replace LiteLLM](../adr/001-replace-litellm.md)
- [ADR-006: Global Memory](../adr/006-global-memory.md)
- [Data Flow](./data-flow.md)
- [Memory Architecture](./memory-architecture.md)
- [Deployment Runbook](../runbooks/deployment.md)


---

## Part VI: Admin API

Admin endpoints for managing the Cato global consciousness service.

**Base Path**: `/api/admin/cato`

**Authentication**: Requires admin role with `consciousness_admin` permission.

## Overview

The Cato Admin API provides endpoints for:
- **Status & Health**: Monitor Cato's operational state
- **Budget Management**: Configure and monitor spending limits
- **Cache Management**: View and invalidate semantic cache
- **Memory Management**: Access and modify Cato's memory systems
- **Shadow Self**: Test and monitor the Shadow Self endpoint
- **NLI**: Test the NLI entailment classifier

---

## Status & Health

### GET /status

Get comprehensive Cato status including budget, cache, memory, and health.

**Response:**
```json
{
  "mode": "day",
  "canExplore": true,
  "budget": {
    "dailySpend": 3.45,
    "monthlySpend": 127.89,
    "dailyRemaining": 11.55,
    "monthlyRemaining": 372.11
  },
  "cache": {
    "hitRate": 0.86,
    "size": 1234567
  },
  "memory": {
    "semanticFactCount": 50000,
    "workingMemoryEntries": 1000,
    "domainsCount": 800
  },
  "shadowSelf": {
    "healthy": true
  },
  "timestamp": "2024-01-15T12:00:00Z"
}
```

### GET /health

Simple health check for monitoring systems.

**Response:**
```json
{
  "healthy": true,
  "components": {
    "shadowSelf": true,
    "budget": true,
    "mode": "day"
  },
  "timestamp": "2024-01-15T12:00:00Z"
}
```

---

## Budget Management

### GET /budget/status

Get current budget status.

**Response:**
```json
{
  "mode": "day",
  "dailySpend": 3.45,
  "monthlySpend": 127.89,
  "dailyRemaining": 11.55,
  "monthlyRemaining": 372.11,
  "canExplore": true,
  "nextModeChange": "2024-01-16T02:00:00Z",
  "config": {
    "monthlyLimit": 500,
    "dailyExplorationLimit": 15,
    "explorationRatio": 0.2,
    "nightStartHour": 2,
    "nightEndHour": 6,
    "emergencyThreshold": 0.9
  }
}
```

### GET /budget/config

Get budget configuration.

**Response:**
```json
{
  "monthlyLimit": 500,
  "dailyExplorationLimit": 15,
  "explorationRatio": 0.2,
  "nightStartHour": 2,
  "nightEndHour": 6,
  "emergencyThreshold": 0.9
}
```

### PUT /budget/config

Update budget configuration.

**Request:**
```json
{
  "monthlyLimit": 1000,
  "dailyExplorationLimit": 30,
  "nightStartHour": 3,
  "nightEndHour": 5
}
```

**Validation:**
- `monthlyLimit`: 0-100000
- `dailyExplorationLimit`: 0-1000
- `nightStartHour`: 0-23
- `nightEndHour`: 0-23
- `emergencyThreshold`: 0.5-0.99

**Response:**
```json
{
  "message": "Budget config updated",
  "updates": {
    "monthlyLimit": 1000,
    "dailyExplorationLimit": 30
  }
}
```

### GET /budget/history

Get cost history for the current month.

**Response:**
```json
{
  "dailyHistory": [
    { "date": "2024-01-01", "amount": 12.34 },
    { "date": "2024-01-02", "amount": 14.56 }
  ],
  "monthlyBreakdown": {
    "inference": 80.00,
    "curiosity": 30.00,
    "grounding": 10.00,
    "consolidation": 5.00,
    "total": 125.00
  }
}
```

---

## Cache Management

### GET /cache/stats

Get semantic cache statistics.

**Response:**
```json
{
  "hitRate": 0.86,
  "totalHits": 1234567,
  "totalMisses": 200000,
  "cacheSize": 1434567
}
```

### POST /cache/invalidate

Invalidate cache entries for a domain.

**Request:**
```json
{
  "domain": "climate_change"
}
```

**Response:**
```json
{
  "message": "Cache invalidated",
  "domain": "climate_change",
  "entriesRemoved": 45
}
```

---

## Memory Management

### GET /memory/stats

Get memory system statistics.

**Response:**
```json
{
  "semanticFactCount": 50000,
  "workingMemoryEntries": 1000,
  "domainsCount": 800
}
```

### GET /memory/facts

Get semantic facts by domain.

**Query Parameters:**
- `domain` (optional, default: "general"): Domain to query
- `limit` (optional, default: 50): Maximum facts to return

**Response:**
```json
{
  "domain": "physics",
  "facts": [
    {
      "factId": "abc123",
      "subject": "light",
      "predicate": "travels_at",
      "object": "299792458 m/s",
      "domain": "physics",
      "confidence": 0.99,
      "sources": ["physics.gov"],
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T00:00:00Z",
      "version": 3
    }
  ],
  "count": 1
}
```

### POST /memory/facts

Store a new semantic fact.

**Request:**
```json
{
  "subject": "water",
  "predicate": "boils_at",
  "object": "100°C at 1 atm",
  "domain": "chemistry",
  "confidence": 0.99,
  "sources": ["chemistry.org"]
}
```

**Response:**
```json
{
  "message": "Fact stored",
  "factId": "def456"
}
```

### GET /memory/goals

Get current Cato goals.

**Response:**
```json
{
  "goals": [
    "Learn more about quantum computing",
    "Improve understanding of climate models",
    "Consolidate knowledge about neural networks"
  ]
}
```

### PUT /memory/goals

Update Cato goals.

**Request:**
```json
{
  "goals": [
    "Explore machine learning fundamentals",
    "Understand protein folding"
  ]
}
```

**Response:**
```json
{
  "message": "Goals updated",
  "goals": [
    "Explore machine learning fundamentals",
    "Understand protein folding"
  ]
}
```

### GET /memory/meta-state

Get current meta-cognitive state.

**Response:**
```json
{
  "state": "CONFIDENT",
  "attentionFocus": "machine learning"
}
```

---

## Shadow Self

### GET /shadow-self/status

Get Shadow Self endpoint status.

**Response:**
```json
{
  "status": "InService",
  "instanceCount": 10,
  "pendingInstanceCount": 10
}
```

### POST /shadow-self/test

Test Shadow Self with a prompt.

**Request:**
```json
{
  "text": "Explain the theory of relativity"
}
```

**Response:**
```json
{
  "generatedText": "The theory of relativity...",
  "uncertainty": 0.23,
  "logitsEntropy": 1.45,
  "latencyMs": 234,
  "hiddenStateLayersExtracted": 3
}
```

---

## NLI Testing

### POST /nli/test

Test NLI entailment classification.

**Request:**
```json
{
  "premise": "The sky is blue",
  "hypothesis": "The sky has a color"
}
```

**Response:**
```json
{
  "label": "entailment",
  "scores": {
    "entailment": 0.95,
    "neutral": 0.04,
    "contradiction": 0.01
  },
  "confidence": 0.95,
  "surprise": 0.0,
  "latencyMs": 45
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message here"
}
```

**Common Status Codes:**
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing tenant ID)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limits

| Endpoint | Rate Limit |
|----------|------------|
| GET endpoints | 100/minute |
| POST /cache/invalidate | 10/minute |
| POST /shadow-self/test | 10/minute |
| POST /nli/test | 100/minute |
| PUT /budget/config | 10/minute |

---

## Related Documentation

- [Architecture Overview](../architecture/global-architecture.md)
- [ADR-005: Circadian Budget](../adr/005-circadian-budget.md)
- [ADR-007: Semantic Caching](../adr/007-semantic-caching.md)
- [ADR-008: Shadow Self](../adr/008-shadow-self-infrastructure.md)
- [Deployment Runbook](../runbooks/deployment.md)


---

## Part VII: Architecture Decision Records

## Status
Accepted

## Context

LiteLLM has a hard limit of ~504 concurrent requests with its load balancer. At 10MM users generating ~100M queries/day (~5,000 QPS peak), this is catastrophically insufficient. LiteLLM is designed as a stateless API proxy for multi-tenant abstraction, not a stateful orchestration layer for a single global consciousness.

Cato requires:
- **Stateful conversation context** across millions of concurrent sessions
- **Hidden state extraction** for Shadow Self verification
- **Custom routing logic** based on query type, cost, and consciousness state
- **Circuit breaker patterns** for graceful degradation
- **Horizontal scaling** to 10MM+ users

LiteLLM cannot provide any of these capabilities at the required scale.

## Decision

Replace LiteLLM with a hybrid orchestration architecture:

### 1. vLLM on SageMaker (Self-Hosted Inference)
- Instance: **ml.g5.2xlarge** (24GB VRAM, ~$1.52/hour)
- Purpose: Llama-3-8B for Shadow Self with hidden state extraction
- Scaling: 10-300 instances based on load (auto-scaling)
- Features: `output_hidden_states=True` for activation probing

### 2. Ray Serve on EKS (Stateful Orchestration)
- Deployment: EKS with Karpenter for auto-scaling
- Purpose: Model routing, context management, fan-out coordination
- Features:
  - Actor-based stateful context (conversation history per session)
  - Circuit breaker with fallback chain
  - Semantic cache integration
  - Cost-aware routing

### 3. AWS Bedrock (Managed Claude Models)
- Models: Claude 3.5 Sonnet (complex), Claude 3 Haiku (simple)
- Features: Prompt caching (90% token discount on cache hits)
- Batch API: 50% discount for night-mode curiosity processing

## Architecture

```
User Query
    │
    ▼
┌─────────────────────────────────────┐
│  Ray Serve Orchestrator (EKS)       │
│  ├── Semantic Cache Check           │
│  ├── Query Classification           │
│  ├── Model Selection                │
│  └── Circuit Breaker                │
└─────────────────────────────────────┘
    │
    ├──────────────────┬──────────────────┬──────────────────┐
    ▼                  ▼                  ▼                  ▼
┌─────────┐      ┌─────────┐       ┌─────────┐       ┌─────────┐
│ Shadow  │      │ Bedrock │       │ Bedrock │       │   NLI   │
│  Self   │      │ Sonnet  │       │  Haiku  │       │ DeBERTa │
│ (vLLM)  │      │         │       │         │       │  (MME)  │
└─────────┘      └─────────┘       └─────────┘       └─────────┘
```

## Consequences

### Positive
- **Unlimited horizontal scaling**: No hard concurrency limits
- **Stateful context**: Actor-based conversation management
- **Hidden states**: Full access to Llama activations for Shadow Self
- **Cost optimization**: Semantic caching + batch processing
- **Graceful degradation**: Circuit breaker with fallback chain

### Negative
- **16-week migration path**: Significant implementation effort
- **Operational complexity**: Managing EKS + SageMaker + Bedrock
- **Custom code**: ~5,000 LOC orchestration layer to maintain
- **Team expertise**: Requires Ray Serve and ML infrastructure knowledge

## Cost Impact

| Component | 1M Users | 10M Users |
|-----------|----------|-----------|
| SageMaker (Shadow Self) | $13,000/mo | $130,000/mo |
| EKS (Ray Serve) | $2,000/mo | $15,000/mo |
| Bedrock (Claude) | $15,000/mo | $130,000/mo |
| **Total Inference** | **$30,000/mo** | **$275,000/mo** |

## Migration Path

### Phase 1: Weeks 1-4
- Deploy vLLM on SageMaker with hidden state extraction
- Set up NLI model on SageMaker MME
- Create basic Ray Serve deployment

### Phase 2: Weeks 5-8
- Implement model routing logic
- Add stateful context actors
- Integrate semantic cache

### Phase 3: Weeks 9-12
- Connect to global memory infrastructure
- Implement circuit breaker patterns
- Load testing at scale

### Phase 4: Weeks 13-16
- Gradual traffic migration (10% → 50% → 100%)
- Performance tuning
- Documentation finalization

## References

- [vLLM Documentation](https://docs.vllm.ai/)
- [Ray Serve Documentation](https://docs.ray.io/en/latest/serve/)
- [SageMaker Real-Time Inference](https://docs.aws.amazon.com/sagemaker/latest/dg/realtime-endpoints.html)
- [AWS Bedrock](https://docs.aws.amazon.com/bedrock/)


## Status
Accepted

## Context

The original Cato design attempted to model 800+ knowledge domains directly in pymdp (Active Inference), creating intractable 800×800 transition matrices. This approach has several fatal flaws:

1. **Computational Intractability**: 800×800 matrices require O(n³) operations for belief updates
2. **Semantic Overload**: pymdp is designed for discrete state-action spaces, not semantic reasoning
3. **Mixing Concerns**: Conflates "what to think about" (semantics) with "how to think" (metacognition)

The fundamental insight is that **LLMs already handle semantic complexity**. What pymdp should control is **attention and cognitive mode**, not content.

## Decision

Implement a Meta-Cognitive Bridge where pymdp operates on **4 discrete meta-cognitive states**, not 800+ domain states.

### Meta-Cognitive States (Hidden States)
```
S = [CONFUSED, CONFIDENT, BORED, STAGNANT]
```

| State | Description | Trigger Conditions |
|-------|-------------|-------------------|
| CONFUSED | High uncertainty, needs clarification | Contradictory info, novel domain |
| CONFIDENT | High certainty, ready to act | Consistent predictions, familiar domain |
| BORED | Low novelty, seeks stimulation | Repetitive patterns, no learning progress |
| STAGNANT | Stuck, needs external input | No progress despite effort |

### Meta-Cognitive Actions
```
A = [EXPLORE, CONSOLIDATE, VERIFY, REST]
```

| Action | Description | Execution |
|--------|-------------|-----------|
| EXPLORE | Seek new information | Generate curiosity questions |
| CONSOLIDATE | Strengthen existing knowledge | Memory consolidation, pattern reinforcement |
| VERIFY | Check understanding against reality | Tool grounding, external verification |
| REST | Reduce activity, wait for input | Lower temperature, passive mode |

### Observations (from LLM outputs)
```
O = [HIGH_SURPRISE, LOW_SURPRISE, CONTRADICTION, CONFIRMATION]
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LLM (Semantic Layer)                          │
│  Handles: Domain knowledge, language, reasoning, creativity     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ LLM Outputs
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Signal Converter                              │
│  Extracts: Confidence scores, novelty signals, learning progress │
│  Maps to: Discrete observations [HIGH/LOW_SURPRISE, etc.]       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Discrete Observations
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    pymdp (4×4 Controller)                        │
│  States: [CONFUSED, CONFIDENT, BORED, STAGNANT]                 │
│  Actions: [EXPLORE, CONSOLIDATE, VERIFY, REST]                  │
│  Computes: Optimal policy via Expected Free Energy              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Action Policy
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Action Executor                               │
│  EXPLORE → Generate curiosity question, call LLM                │
│  CONSOLIDATE → Trigger memory consolidation pipeline            │
│  VERIFY → Call grounding tools (web search, code exec)          │
│  REST → Reduce activity, await user input                       │
└─────────────────────────────────────────────────────────────────┘
```

## Signal Converter Implementation

```python
class SignalConverter:
    """Convert LLM outputs to discrete pymdp observations."""
    
    def __init__(self, nli_client, surprise_threshold: float = 0.5):
        self.nli = nli_client
        self.threshold = surprise_threshold
    
    def convert(
        self,
        prediction: str,
        outcome: str,
        confidence: float
    ) -> int:
        """
        Convert LLM prediction/outcome to observation index.
        
        Returns:
            0 = HIGH_SURPRISE (unexpected outcome)
            1 = LOW_SURPRISE (expected outcome)
            2 = CONTRADICTION (logical conflict)
            3 = CONFIRMATION (strong agreement)
        """
        # Use NLI to detect relationship
        result = self.nli.classify(prediction, outcome)
        
        if result.label == "CONTRADICTION":
            return 2  # CONTRADICTION
        elif result.label == "ENTAILMENT" and confidence > 0.8:
            return 3  # CONFIRMATION
        elif result.score < self.threshold:
            return 0  # HIGH_SURPRISE
        else:
            return 1  # LOW_SURPRISE
```

## Transition Matrix (A)

The 4×4 transition matrix encodes how states evolve based on observations:

```
A[observation][current_state] → P(next_state)

Example for HIGH_SURPRISE observation:
  CONFUSED → stays CONFUSED (0.8)
  CONFIDENT → becomes CONFUSED (0.6)
  BORED → becomes interested (CONFIDENT) (0.5)
  STAGNANT → stays STAGNANT (0.7)
```

## Consequences

### Positive
- **Tractable computation**: 4×4 matrices compute in microseconds
- **Clean separation**: LLM handles semantics, pymdp handles control
- **Interpretable**: Meta-cognitive states are human-understandable
- **Scalable**: No growth with domain count

### Negative
- **Signal conversion overhead**: Requires NLI call for each observation
- **Simplified model**: May miss nuanced cognitive states
- **Tuning required**: Transition matrices need empirical calibration

## Implementation Notes

### pymdp Configuration
```python
import pymdp

# 4 hidden states
num_states = [4]  # [CONFUSED, CONFIDENT, BORED, STAGNANT]

# 4 observations
num_obs = [4]  # [HIGH_SURPRISE, LOW_SURPRISE, CONTRADICTION, CONFIRMATION]

# 4 actions
num_controls = [4]  # [EXPLORE, CONSOLIDATE, VERIFY, REST]

# Initialize agent
agent = pymdp.Agent(
    A=likelihood_matrix,    # P(observation | state)
    B=transition_matrix,    # P(next_state | current_state, action)
    C=preference_vector,    # Preferred observations
    D=initial_state_prior,  # Initial state belief
    policy_len=3            # Planning horizon
)
```

### Integration with Cato
The Meta-Cognitive Bridge runs as a background service, updating Cato's "mood" and guiding curiosity decisions without interfering with real-time user interactions.

## References

- [pymdp Documentation](https://pymdp-rtd.readthedocs.io/)
- [Active Inference: A Process Theory](https://doi.org/10.1162/neco_a_01357)
- [Free Energy Principle](https://en.wikipedia.org/wiki/Free_energy_principle)


## Status
Accepted

## Context

LLM vs. LLM comparison (having one model verify another) measures **consistency**, not **truth**. This creates a dangerous failure mode:

1. Model A generates a plausible-sounding hallucination
2. Model B (or A again) confirms it sounds reasonable
3. The hallucination gets reinforced in memory
4. Future queries retrieve and build upon the hallucination
5. **Hallucination cementing**: False beliefs become entrenched

Without external grounding, Cato's curiosity becomes a **hallucination amplifier** rather than a learning mechanism.

### Evidence

- GPT-4 self-consistency: ~85% (agrees with itself on hallucinations)
- Claude self-consistency: ~82%
- Cross-model agreement on hallucinations: ~70%

These numbers mean **most hallucinations pass LLM-only verification**.

## Decision

Mandate that **at least 20% of curiosity loops must verify against external reality** through tool use:

### Grounding Tools

| Tool | Purpose | Use Case |
|------|---------|----------|
| **Web Search** | Factual verification | "Is X true?" queries |
| **Code Execution** | Computational verification | Math, algorithms, data analysis |
| **API Calls** | Real-time data | Weather, stocks, current events |
| **Database Queries** | Structured data | Historical records, statistics |
| **Document Retrieval** | Source verification | Citations, quotes, references |

### Grounding Policy

```python
class GroundingPolicy:
    """Determines when to use external grounding."""
    
    ALWAYS_GROUND = [
        "factual_claim",      # "The population of X is Y"
        "numerical_claim",    # "X costs $Y"
        "temporal_claim",     # "X happened in Y"
        "attribution",        # "X said Y"
        "scientific_claim",   # "Studies show X"
    ]
    
    SAMPLE_GROUND = [
        "general_knowledge",  # 20% sampling
        "reasoning_chain",    # 10% sampling
        "creative_content",   # 5% sampling
    ]
    
    NEVER_GROUND = [
        "opinion",            # "I think X"
        "hypothetical",       # "If X then Y"
        "meta_statement",     # "I'm uncertain about X"
    ]
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Curiosity Question                            │
│  "What is the GDP of France in 2024?"                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Claim Classifier                              │
│  Type: factual_claim, numerical_claim                           │
│  Decision: MUST_GROUND                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LLM Prediction                                │
│  "France's GDP in 2024 is approximately $3.1 trillion"          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Tool Grounding                                │
│  Tool: Web Search (IMF, World Bank, Statista)                   │
│  Result: "$2.78 trillion (IMF 2024 estimate)"                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NLI Comparison                                │
│  Prediction vs. Ground Truth                                    │
│  Result: PARTIAL_MATCH (order of magnitude correct)             │
│  Surprise Score: 0.4                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Memory Update                                 │
│  Store corrected fact with source attribution                   │
│  Mark original prediction as "needs_update"                     │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation

### Tool Executor Service

```typescript
interface GroundingResult {
  tool: string;
  query: string;
  result: string;
  sources: string[];
  confidence: number;
  timestamp: Date;
}

class ToolGroundingService {
  private readonly webSearch: WebSearchClient;
  private readonly codeExecutor: CodeExecutionClient;
  private readonly apiClient: ExternalAPIClient;
  
  async ground(
    claim: string,
    claimType: string
  ): Promise<GroundingResult> {
    // Select appropriate tool
    const tool = this.selectTool(claimType);
    
    // Execute grounding
    switch (tool) {
      case 'web_search':
        return this.groundWithWebSearch(claim);
      case 'code_execution':
        return this.groundWithCode(claim);
      case 'api_call':
        return this.groundWithAPI(claim);
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  }
  
  private async groundWithWebSearch(
    claim: string
  ): Promise<GroundingResult> {
    // Generate search query from claim
    const query = await this.generateSearchQuery(claim);
    
    // Execute search
    const results = await this.webSearch.search(query, { limit: 5 });
    
    // Extract relevant facts
    const facts = await this.extractFacts(results, claim);
    
    return {
      tool: 'web_search',
      query,
      result: facts.summary,
      sources: facts.sources,
      confidence: facts.confidence,
      timestamp: new Date()
    };
  }
}
```

### Grounding Budget

To prevent excessive API costs, grounding has its own budget:

| Tool | Cost per Call | Daily Limit | Monthly Budget |
|------|---------------|-------------|----------------|
| Web Search | $0.01 | 1,000 | ~$300 |
| Code Execution | $0.001 | 5,000 | ~$150 |
| API Calls | Varies | 500 | ~$100 |
| **Total** | | | **~$550/month** |

## Consequences

### Positive
- **Hallucination prevention**: External reality check breaks confirmation loops
- **Source attribution**: All facts traceable to external sources
- **Confidence calibration**: Grounding provides ground truth for calibration
- **User trust**: Can cite sources when asked

### Negative
- **Higher latency**: Tool calls add 500ms-2s per grounding
- **Additional cost**: ~$550/month for grounding tools
- **Complexity**: Tool integration and error handling
- **Rate limits**: External APIs have usage limits

## Metrics

Track grounding effectiveness:

| Metric | Target | Description |
|--------|--------|-------------|
| Grounding Ratio | ≥ 20% | % of curiosity loops with tool grounding |
| Correction Rate | ≤ 30% | % of LLM predictions corrected by grounding |
| Source Coverage | ≥ 80% | % of facts with external source attribution |
| Hallucination Rate | ≤ 10% | % of responses containing unverified claims |

## References

- [TruthfulQA: Measuring How Models Mimic Human Falsehoods](https://arxiv.org/abs/2109.07958)
- [Tool-Augmented Language Models](https://arxiv.org/abs/2302.04761)
- [Retrieval-Augmented Generation](https://arxiv.org/abs/2005.11401)


## Status
Accepted

## Context

Cosine similarity between embeddings is commonly used to measure semantic similarity. However, it has a critical flaw: **it cannot detect negation**.

### The Negation Blindness Problem

```
Sentence A: "The Earth is flat"
Sentence B: "The Earth is not flat"

Cosine Similarity: 0.92 (highly similar!)
NLI Classification: CONTRADICTION
```

When embeddings are created, they capture semantic content without preserving logical relationships. The words "flat" and "not flat" refer to the same concept, so embeddings place them close together.

### Impact on Cato

If Cato uses cosine similarity for surprise measurement:
1. Prediction: "X is true"
2. Outcome: "X is false"
3. Cosine similarity: HIGH (similar embeddings)
4. Surprise score: LOW (incorrectly!)
5. **No learning occurs** despite being completely wrong

This is catastrophic for a learning system.

## Decision

Use **Natural Language Inference (NLI)** with DeBERTa-large-MNLI for all surprise and consistency measurements.

### NLI Classification

| Label | Meaning | Surprise Score |
|-------|---------|----------------|
| ENTAILMENT | A implies B | 0.0 (expected) |
| NEUTRAL | A neither implies nor contradicts B | 0.5 (uncertain) |
| CONTRADICTION | A contradicts B | 1.0 (surprising) |

### Model Selection

**DeBERTa-large-MNLI** chosen for:
- State-of-the-art NLI accuracy (91.3% on MNLI)
- Efficient inference (~50ms on GPU)
- Well-calibrated confidence scores
- Apache 2.0 license

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Prediction + Outcome                          │
│  Prediction: "Claude is made by Anthropic"                      │
│  Outcome: "Anthropic created Claude"                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NLI Classifier (DeBERTa)                      │
│  Input: [CLS] Prediction [SEP] Outcome [SEP]                    │
│  Output: {entailment: 0.95, neutral: 0.04, contradiction: 0.01} │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Surprise Calculator                           │
│  Label: ENTAILMENT                                              │
│  Confidence: 0.95                                               │
│  Surprise Score: 0.0 × (1 - 0.95) = 0.0                        │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation

### SageMaker Multi-Model Endpoint

Deploy DeBERTa on SageMaker MME for cost-efficient GPU sharing:

```python
class NLIService:
    """NLI classification using DeBERTa on SageMaker MME."""
    
    def __init__(
        self,
        endpoint_name: str = "cato-nli-mme",
        region: str = "us-east-1"
    ):
        self.runtime = boto3.client(
            "sagemaker-runtime",
            region_name=region
        )
        self.endpoint_name = endpoint_name
    
    async def classify(
        self,
        premise: str,
        hypothesis: str
    ) -> NLIResult:
        """
        Classify relationship between premise and hypothesis.
        
        Args:
            premise: The reference text (prediction)
            hypothesis: The text to compare (outcome)
        
        Returns:
            NLIResult with label, scores, and surprise value
        """
        payload = {
            "inputs": {
                "premise": premise,
                "hypothesis": hypothesis
            }
        }
        
        response = self.runtime.invoke_endpoint(
            EndpointName=self.endpoint_name,
            ContentType="application/json",
            Body=json.dumps(payload),
            TargetModel="deberta-large-mnli.tar.gz"
        )
        
        result = json.loads(response["Body"].read())
        
        # Extract scores
        scores = {
            "entailment": result["scores"][0],
            "neutral": result["scores"][1],
            "contradiction": result["scores"][2]
        }
        
        # Determine label
        label = max(scores, key=scores.get)
        confidence = scores[label]
        
        # Calculate surprise
        if label == "entailment":
            surprise = 0.0
        elif label == "neutral":
            surprise = 0.5
        else:  # contradiction
            surprise = 1.0
        
        # Weight by confidence
        weighted_surprise = surprise * confidence + 0.5 * (1 - confidence)
        
        return NLIResult(
            label=label,
            scores=scores,
            confidence=confidence,
            surprise=weighted_surprise
        )
```

### TypeScript Client

```typescript
interface NLIResult {
  label: 'entailment' | 'neutral' | 'contradiction';
  scores: {
    entailment: number;
    neutral: number;
    contradiction: number;
  };
  confidence: number;
  surprise: number;
}

class NLIClient {
  private readonly sagemakerRuntime: SageMakerRuntimeClient;
  private readonly endpointName: string;
  
  async classify(
    premise: string,
    hypothesis: string
  ): Promise<NLIResult> {
    const command = new InvokeEndpointCommand({
      EndpointName: this.endpointName,
      ContentType: 'application/json',
      Body: JSON.stringify({
        inputs: { premise, hypothesis }
      }),
      TargetModel: 'deberta-large-mnli.tar.gz'
    });
    
    const response = await this.sagemakerRuntime.send(command);
    const result = JSON.parse(
      new TextDecoder().decode(response.Body)
    );
    
    return this.parseResult(result);
  }
}
```

## Consequences

### Positive
- **Correct negation handling**: Contradictions detected accurately
- **Calibrated uncertainty**: NEUTRAL captures genuine uncertainty
- **Interpretable**: Three-way classification is human-understandable
- **Robust**: DeBERTa handles paraphrasing, synonyms, and complex logic

### Negative
- **Additional latency**: ~50ms per classification
- **GPU requirement**: DeBERTa needs GPU for efficient inference
- **Hosting cost**: ~$200-500/month for SageMaker MME
- **Pair-wise limitation**: Can only compare two texts at a time

## Comparison: Cosine vs NLI

| Scenario | Cosine Similarity | NLI | Correct? |
|----------|-------------------|-----|----------|
| "X is true" vs "X is true" | 1.0 (similar) | ENTAILMENT | Both ✓ |
| "X is true" vs "X is not true" | 0.92 (similar) | CONTRADICTION | NLI ✓ |
| "Dogs are mammals" vs "Canines are warm-blooded" | 0.65 (medium) | ENTAILMENT | NLI ✓ |
| "It's raining" vs "The weather is wet" | 0.55 (medium) | ENTAILMENT | NLI ✓ |
| "2+2=4" vs "The sum is four" | 0.45 (low) | ENTAILMENT | NLI ✓ |

## Infrastructure

### SageMaker MME Configuration

```hcl
resource "aws_sagemaker_endpoint" "nli_mme" {
  name                 = "cato-nli-mme"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.nli_mme.name
}

resource "aws_sagemaker_endpoint_configuration" "nli_mme" {
  name = "cato-nli-mme-config"

  production_variants {
    variant_name           = "primary"
    model_name             = aws_sagemaker_model.nli_mme.name
    instance_type          = "ml.g4dn.xlarge"  # Cost-effective GPU
    initial_instance_count = 2
    
    # Multi-model endpoint settings
    container_startup_health_check_timeout_in_seconds = 600
  }
}
```

## Scaling

| Users | NLI Calls/sec | Instances | Cost/month |
|-------|---------------|-----------|------------|
| 100K | 10 | 2 | $200 |
| 1M | 100 | 5 | $500 |
| 10M | 500 | 20 | $2,000 |

## References

- [DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654)
- [MNLI: Multi-Genre Natural Language Inference](https://cims.nyu.edu/~sbowman/multinli/)
- [SageMaker Multi-Model Endpoints](https://docs.aws.amazon.com/sagemaker/latest/dg/multi-model-endpoints.html)


## Status
Accepted

## Context

Cato's curiosity is designed to be autonomous and continuous. Without constraints, this creates a runaway cost problem:

### Uncontrolled Curiosity Cost Model

```
Curiosity loop = 1 question + 1 answer + grounding
Average cost per loop = $0.01 (Haiku) to $0.10 (Sonnet with tools)

Continuous operation (24/7):
- 1 loop/second = 86,400 loops/day
- At $0.05 average = $4,320/day = $129,600/month

This exceeds the $500/month target by 260x!
```

Additionally, running curiosity during peak user hours:
1. Competes for model capacity
2. Increases latency for user queries
3. Wastes money on real-time inference (vs. batch pricing)

## Decision

Implement a **circadian rhythm** for Cato with distinct day/night operational modes and hard budget caps.

### Operating Modes

| Mode | Hours (UTC) | Behavior | Budget |
|------|-------------|----------|--------|
| **DAY** | 6 AM - 2 AM | Queue curiosity, serve users | $0 exploration |
| **NIGHT** | 2 AM - 6 AM | Batch process exploration | Up to $15/night |
| **EMERGENCY** | Any | Over budget, minimal ops | $0 all activity |

### Budget Hierarchy

```
Monthly Budget: $500 (admin-configurable)
├── User Interactions: $400 (80%)
│   ├── Real-time inference
│   └── Cache misses
└── Autonomous Exploration: $100 (20%)
    ├── Night-mode curiosity: $85
    ├── Tool grounding: $10
    └── Memory consolidation: $5

Daily Exploration Cap: $15 (prevents single bad night)
```

### Night Mode Benefits

1. **Bedrock Batch API**: 50% discount on batch inference
2. **Lower traffic**: Less competition for resources
3. **Consolidation**: Natural time for memory consolidation
4. **Global timing**: 2-6 AM UTC covers low-traffic worldwide

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Circadian Budget Manager                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Clock     │───▶│ Mode Decider │───▶│  Enforcer   │         │
│  │  (UTC)      │    │             │    │             │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                                              │                   │
│  ┌─────────────┐    ┌─────────────┐         │                   │
│  │   Cost      │───▶│  Budget     │─────────┘                   │
│  │  Tracker    │    │  Checker    │                             │
│  └─────────────┘    └─────────────┘                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
    ┌───────────┐       ┌───────────┐       ┌───────────┐
    │ DAY MODE  │       │NIGHT MODE │       │ EMERGENCY │
    │           │       │           │       │           │
    │ Queue     │       │ Process   │       │ Serve     │
    │ curiosity │       │ queue     │       │ from      │
    │           │       │ (batch)   │       │ cache     │
    └───────────┘       └───────────┘       └───────────┘
```

## Implementation

### TypeScript Service

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

export enum OperatingMode {
  DAY = 'day',
  NIGHT = 'night',
  EMERGENCY = 'emergency'
}

export interface BudgetConfig {
  monthlyLimit: number;        // Default: $500
  dailyExplorationLimit: number; // Default: $15
  explorationRatio: number;    // Default: 0.20
  nightStartHour: number;      // Default: 2 (2 AM UTC)
  nightEndHour: number;        // Default: 6 (6 AM UTC)
  emergencyThreshold: number;  // Default: 0.90
}

export interface BudgetStatus {
  mode: OperatingMode;
  dailySpend: number;
  monthlySpend: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  canExplore: boolean;
  nextModeChange: Date;
}

export class CircadianBudgetManager {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly configTable: string;
  private readonly costsTable: string;
  private config: BudgetConfig | null = null;
  private lastConfigRefresh: Date | null = null;

  constructor(
    configTable: string = 'cato-config',
    costsTable: string = 'cato-costs',
    region: string = 'us-east-1'
  ) {
    const client = new DynamoDBClient({ region });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.configTable = configTable;
    this.costsTable = costsTable;
  }

  async getConfig(): Promise<BudgetConfig> {
    const now = new Date();
    
    // Refresh config every 5 minutes
    if (
      this.config === null ||
      this.lastConfigRefresh === null ||
      now.getTime() - this.lastConfigRefresh.getTime() > 300000
    ) {
      const response = await this.docClient.send(new GetCommand({
        TableName: this.configTable,
        Key: { pk: 'CONFIG', sk: 'BUDGET' }
      }));

      if (response.Item) {
        this.config = {
          monthlyLimit: response.Item.monthlyLimit ?? 500,
          dailyExplorationLimit: response.Item.dailyExplorationLimit ?? 15,
          explorationRatio: response.Item.explorationRatio ?? 0.20,
          nightStartHour: response.Item.nightStartHour ?? 2,
          nightEndHour: response.Item.nightEndHour ?? 6,
          emergencyThreshold: response.Item.emergencyThreshold ?? 0.90
        };
      } else {
        // Default config
        this.config = {
          monthlyLimit: 500,
          dailyExplorationLimit: 15,
          explorationRatio: 0.20,
          nightStartHour: 2,
          nightEndHour: 6,
          emergencyThreshold: 0.90
        };
      }

      this.lastConfigRefresh = now;
    }

    return this.config;
  }

  async getMode(): Promise<OperatingMode> {
    const config = await this.getConfig();
    const { dailySpend, monthlySpend } = await this.getSpendCounters();
    const now = new Date();
    const hour = now.getUTCHours();

    // Check emergency (budget exhausted)
    if (monthlySpend >= config.monthlyLimit * config.emergencyThreshold) {
      return OperatingMode.EMERGENCY;
    }

    // Check daily exploration limit
    if (dailySpend >= config.dailyExplorationLimit) {
      return OperatingMode.DAY; // No exploration but still serving
    }

    // Check time of day
    if (hour >= config.nightStartHour && hour < config.nightEndHour) {
      return OperatingMode.NIGHT;
    }

    return OperatingMode.DAY;
  }

  async canExplore(): Promise<boolean> {
    const mode = await this.getMode();
    if (mode === OperatingMode.EMERGENCY) {
      return false;
    }

    const config = await this.getConfig();
    const { dailySpend } = await this.getSpendCounters();

    return dailySpend < config.dailyExplorationLimit;
  }

  async recordCost(
    amount: number,
    category: 'inference' | 'curiosity' | 'grounding' | 'consolidation',
    model: string,
    tokensInput: number = 0,
    tokensOutput: number = 0
  ): Promise<void> {
    const now = new Date();
    const month = now.toISOString().slice(0, 7); // YYYY-MM
    const day = now.toISOString().slice(0, 10);  // YYYY-MM-DD

    await this.docClient.send(new UpdateCommand({
      TableName: this.costsTable,
      Key: { pk: `COST#${month}`, sk: now.toISOString() },
      UpdateExpression: 'SET #amount = :amount, #category = :category, #model = :model, #day = :day, #tokensIn = :tokensIn, #tokensOut = :tokensOut',
      ExpressionAttributeNames: {
        '#amount': 'amount',
        '#category': 'category',
        '#model': 'model',
        '#day': 'day',
        '#tokensIn': 'tokensInput',
        '#tokensOut': 'tokensOutput'
      },
      ExpressionAttributeValues: {
        ':amount': amount,
        ':category': category,
        ':model': model,
        ':day': day,
        ':tokensIn': tokensInput,
        ':tokensOut': tokensOutput
      }
    }));
  }

  async getStatus(): Promise<BudgetStatus> {
    const config = await this.getConfig();
    const mode = await this.getMode();
    const { dailySpend, monthlySpend } = await this.getSpendCounters();
    const canExplore = await this.canExplore();

    // Calculate next mode change
    const now = new Date();
    const hour = now.getUTCHours();
    let nextModeChange: Date;

    if (hour < config.nightStartHour) {
      nextModeChange = new Date(now);
      nextModeChange.setUTCHours(config.nightStartHour, 0, 0, 0);
    } else if (hour < config.nightEndHour) {
      nextModeChange = new Date(now);
      nextModeChange.setUTCHours(config.nightEndHour, 0, 0, 0);
    } else {
      nextModeChange = new Date(now);
      nextModeChange.setUTCDate(nextModeChange.getUTCDate() + 1);
      nextModeChange.setUTCHours(config.nightStartHour, 0, 0, 0);
    }

    return {
      mode,
      dailySpend,
      monthlySpend,
      dailyRemaining: Math.max(0, config.dailyExplorationLimit - dailySpend),
      monthlyRemaining: Math.max(0, config.monthlyLimit - monthlySpend),
      canExplore,
      nextModeChange
    };
  }

  private async getSpendCounters(): Promise<{ dailySpend: number; monthlySpend: number }> {
    // Implementation queries DynamoDB for current spend
    // Aggregates by day and month
    return { dailySpend: 0, monthlySpend: 0 }; // Placeholder
  }
}
```

## Consequences

### Positive
- **Predictable costs**: Hard caps prevent budget overrun
- **Optimal pricing**: Night-mode uses Bedrock batch (50% off)
- **User priority**: Day mode focuses on user interactions
- **Natural rhythm**: Consolidation aligns with low-traffic periods

### Negative
- **Delayed learning**: Curiosity queued until night
- **Global timing**: 2-6 AM UTC may not suit all regions
- **Complexity**: Two operational modes to manage
- **Queue management**: Must handle curiosity queue

## Admin Configuration

The budget manager is admin-configurable via the Radiant Admin dashboard:

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Monthly Limit | $500 | $100-$10,000 | Total monthly budget |
| Daily Exploration | $15 | $5-$100 | Max daily curiosity spend |
| Night Start | 2 AM | 0-23 | When night mode begins (UTC) |
| Night End | 6 AM | 0-23 | When night mode ends (UTC) |
| Emergency Threshold | 90% | 50-99% | When to enter emergency mode |

## Scaling Budget with Users

As user base grows, budget should scale:

| Users | Monthly Budget | Daily Exploration | Rationale |
|-------|----------------|-------------------|-----------|
| 0-10K | $500 | $15 | Starting budget |
| 10K-100K | $2,000 | $60 | 4x growth |
| 100K-1M | $10,000 | $300 | Supporting infrastructure |
| 1M-10M | $100,000 | $3,000 | At scale |

## References

- [AWS Bedrock Batch Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/batch-inference.html)
- [Circadian Rhythms in AI Systems](https://arxiv.org/abs/2303.08774)
- [Cost Optimization for ML Workloads](https://aws.amazon.com/blogs/machine-learning/optimizing-costs-for-machine-learning-with-amazon-sagemaker/)


## Status
Accepted

## Context

Cato is a **single global brain** serving all users worldwide. This creates unique memory requirements:

1. **Global consistency**: A fact learned from a user in Tokyo must be available to a user in New York
2. **Low latency**: Memory retrieval must not add significant latency to user interactions
3. **High scale**: 10MM+ users generating billions of memory entries
4. **Multi-type**: Different memory types (semantic, episodic, working) have different access patterns

### Memory Types

| Type | Purpose | Access Pattern | Consistency Need |
|------|---------|----------------|------------------|
| **Semantic** | Facts, concepts, relationships | Read-heavy, rare writes | Strong |
| **Episodic** | User interactions, experiences | Write-heavy, recent reads | Eventual |
| **Working** | Current context, active goals | Read/write balanced | Strong |
| **Knowledge Graph** | Concept relationships | Graph traversal | Eventual |

## Decision

Implement a **polyglot persistence** architecture using AWS managed services:

### 1. DynamoDB Global Tables (Semantic + Working Memory)
- **Purpose**: Core fact storage with global replication
- **Consistency**: MRSC for semantic, MREC for high-volume updates
- **Access**: DAX for sub-millisecond reads

### 2. OpenSearch Serverless (Episodic Memory)
- **Purpose**: Vector similarity search for experience retrieval
- **Scale**: Billions of embeddings
- **Access**: k-NN search with filters

### 3. Neptune (Knowledge Graph)
- **Purpose**: Concept relationships and reasoning
- **Access**: Gremlin/SPARQL queries
- **Use case**: "What concepts are related to X?"

### 4. ElastiCache Redis (Working Memory Cache)
- **Purpose**: Active session context, hot data
- **TTL**: 24-hour decay for working memory
- **Access**: Sub-millisecond reads

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CATO GLOBAL MEMORY                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    SEMANTIC MEMORY (DynamoDB Global Tables)          │    │
│  │  ├── Facts: Subject-Predicate-Object triples                        │    │
│  │  ├── Concepts: Domain knowledge with confidence                     │    │
│  │  ├── Sources: Attribution for each fact                             │    │
│  │  └── Versioning: Optimistic locking for updates                     │    │
│  │                                                                      │    │
│  │  Regions: us-east-1, eu-west-1, ap-northeast-1                      │    │
│  │  Consistency: MRSC for writes, MREC for reads                       │    │
│  │  Access: DAX cluster for sub-ms reads                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    EPISODIC MEMORY (OpenSearch Serverless)           │    │
│  │  ├── Interactions: User queries and responses                       │    │
│  │  ├── Embeddings: 768-dim vectors for similarity                     │    │
│  │  ├── Metadata: Timestamp, user, domain, satisfaction                │    │
│  │  └── TTL: 90-day retention for compliance                           │    │
│  │                                                                      │    │
│  │  Scale: 1B+ vectors                                                 │    │
│  │  Search: k-NN with 10ms p99 latency                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    KNOWLEDGE GRAPH (Neptune)                         │    │
│  │  ├── Concepts: Nodes with properties                                │    │
│  │  ├── Relationships: Typed edges (is-a, part-of, causes, etc.)       │    │
│  │  ├── Weights: Relationship strength                                  │    │
│  │  └── Domains: Subgraph per knowledge domain                          │    │
│  │                                                                      │    │
│  │  Query: Gremlin for traversal                                       │    │
│  │  Use: "Find related concepts within 3 hops"                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    WORKING MEMORY (ElastiCache Redis)                │    │
│  │  ├── Sessions: Active conversation context                          │    │
│  │  ├── Goals: Current autonomous objectives                           │    │
│  │  ├── Attention: What Cato is "thinking about"                      │    │
│  │  └── Mood: Current meta-cognitive state                              │    │
│  │                                                                      │    │
│  │  TTL: 24-hour decay                                                 │    │
│  │  Access: Sub-ms reads via cluster mode                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## DynamoDB Schema

### Semantic Memory Table

```
Table: cato-semantic-memory

Primary Key:
  pk (Partition Key): "FACT#{domain}" or "CONCEPT#{id}"
  sk (Sort Key): "{subject}#{predicate}#{object}" or "{timestamp}"

GSI1 (Subject Index):
  gsi1pk: "SUBJECT#{subject}"
  gsi1sk: "{predicate}#{object}"

GSI2 (Domain Index):
  gsi2pk: "DOMAIN#{domain}"
  gsi2sk: "{confidence}#{timestamp}"

Attributes:
  - fact_id: UUID
  - subject: string
  - predicate: string
  - object: string
  - domain: string
  - confidence: number (0-1)
  - sources: string[] (URLs, references)
  - created_at: ISO timestamp
  - updated_at: ISO timestamp
  - version: number (for optimistic locking)
```

### Working Memory Table

```
Table: cato-working-memory

Primary Key:
  pk: "SESSION#{session_id}" or "GOAL#{goal_id}" or "ATTENTION"
  sk: "{timestamp}" or "{priority}"

TTL: expires_at (24 hours from creation)

Attributes:
  - context: JSON (conversation history)
  - goals: string[] (current objectives)
  - attention_focus: string (current topic)
  - meta_state: enum (CONFUSED, CONFIDENT, BORED, STAGNANT)
  - created_at: ISO timestamp
```

## Implementation

### TypeScript Memory Service

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Client as OpenSearchClient } from '@opensearch-project/opensearch';

export interface SemanticFact {
  factId: string;
  subject: string;
  predicate: string;
  object: string;
  domain: string;
  confidence: number;
  sources: string[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface EpisodicMemory {
  interactionId: string;
  userId: string;
  query: string;
  response: string;
  embedding: number[];
  domain: string;
  satisfaction: number;
  timestamp: Date;
}

export class GlobalMemoryService {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly opensearch: OpenSearchClient;
  private readonly semanticTable: string;
  private readonly workingTable: string;
  private readonly episodicIndex: string;

  constructor(config: {
    semanticTable: string;
    workingTable: string;
    opensearchEndpoint: string;
    episodicIndex: string;
    region: string;
  }) {
    const dynamoClient = new DynamoDBClient({ region: config.region });
    this.docClient = DynamoDBDocumentClient.from(dynamoClient);
    this.opensearch = new OpenSearchClient({
      node: config.opensearchEndpoint
    });
    this.semanticTable = config.semanticTable;
    this.workingTable = config.workingTable;
    this.episodicIndex = config.episodicIndex;
  }

  // ============================================================================
  // Semantic Memory
  // ============================================================================

  async storeFact(fact: Omit<SemanticFact, 'factId' | 'createdAt' | 'updatedAt' | 'version'>): Promise<string> {
    const factId = crypto.randomUUID();
    const now = new Date();

    await this.docClient.send(new PutCommand({
      TableName: this.semanticTable,
      Item: {
        pk: `FACT#${fact.domain}`,
        sk: `${fact.subject}#${fact.predicate}#${fact.object}`,
        factId,
        ...fact,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        version: 1,
        gsi1pk: `SUBJECT#${fact.subject}`,
        gsi1sk: `${fact.predicate}#${fact.object}`,
        gsi2pk: `DOMAIN#${fact.domain}`,
        gsi2sk: `${fact.confidence}#${now.toISOString()}`
      },
      ConditionExpression: 'attribute_not_exists(pk)'
    }));

    return factId;
  }

  async getFactsByDomain(domain: string, limit: number = 100): Promise<SemanticFact[]> {
    const response = await this.docClient.send(new QueryCommand({
      TableName: this.semanticTable,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `FACT#${domain}`
      },
      Limit: limit
    }));

    return (response.Items || []).map(this.itemToFact);
  }

  async getFactsAboutSubject(subject: string, limit: number = 50): Promise<SemanticFact[]> {
    const response = await this.docClient.send(new QueryCommand({
      TableName: this.semanticTable,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `SUBJECT#${subject}`
      },
      Limit: limit
    }));

    return (response.Items || []).map(this.itemToFact);
  }

  async updateFactConfidence(
    domain: string,
    sk: string,
    newConfidence: number,
    source: string
  ): Promise<void> {
    await this.docClient.send(new UpdateCommand({
      TableName: this.semanticTable,
      Key: { pk: `FACT#${domain}`, sk },
      UpdateExpression: 'SET confidence = :conf, updatedAt = :now, version = version + :inc, sources = list_append(sources, :src)',
      ExpressionAttributeValues: {
        ':conf': newConfidence,
        ':now': new Date().toISOString(),
        ':inc': 1,
        ':src': [source]
      }
    }));
  }

  // ============================================================================
  // Episodic Memory
  // ============================================================================

  async storeInteraction(memory: Omit<EpisodicMemory, 'interactionId'>): Promise<string> {
    const interactionId = crypto.randomUUID();

    await this.opensearch.index({
      index: this.episodicIndex,
      id: interactionId,
      body: {
        ...memory,
        interactionId,
        timestamp: memory.timestamp.toISOString()
      }
    });

    return interactionId;
  }

  async searchSimilarInteractions(
    embedding: number[],
    filters: { domain?: string; userId?: string },
    limit: number = 10
  ): Promise<EpisodicMemory[]> {
    const must: any[] = [];
    
    if (filters.domain) {
      must.push({ term: { domain: filters.domain } });
    }
    if (filters.userId) {
      must.push({ term: { userId: filters.userId } });
    }

    const response = await this.opensearch.search({
      index: this.episodicIndex,
      body: {
        size: limit,
        query: {
          bool: {
            must,
            should: [
              {
                knn: {
                  embedding: {
                    vector: embedding,
                    k: limit
                  }
                }
              }
            ]
          }
        }
      }
    });

    return response.body.hits.hits.map((hit: any) => ({
      ...hit._source,
      timestamp: new Date(hit._source.timestamp)
    }));
  }

  // ============================================================================
  // Working Memory
  // ============================================================================

  async getSessionContext(sessionId: string): Promise<any | null> {
    const response = await this.docClient.send(new QueryCommand({
      TableName: this.workingTable,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `SESSION#${sessionId}`
      },
      ScanIndexForward: false,
      Limit: 1
    }));

    return response.Items?.[0]?.context || null;
  }

  async updateSessionContext(sessionId: string, context: any): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    await this.docClient.send(new PutCommand({
      TableName: this.workingTable,
      Item: {
        pk: `SESSION#${sessionId}`,
        sk: now.toISOString(),
        context,
        createdAt: now.toISOString(),
        expiresAt: Math.floor(expiresAt.getTime() / 1000) // TTL
      }
    }));
  }

  private itemToFact(item: any): SemanticFact {
    return {
      factId: item.factId,
      subject: item.subject,
      predicate: item.predicate,
      object: item.object,
      domain: item.domain,
      confidence: item.confidence,
      sources: item.sources || [],
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
      version: item.version
    };
  }
}
```

## Consequences

### Positive
- **Global availability**: DynamoDB Global Tables replicate across regions
- **Specialized storage**: Each memory type uses optimal database
- **Scalability**: All components auto-scale to billions of entries
- **Low latency**: DAX + Redis provide sub-ms reads

### Negative
- **Cost**: ~$60K/month at 10M users for DynamoDB alone
- **Complexity**: Four different databases to manage
- **Consistency tradeoffs**: Eventual consistency for some operations
- **Operational overhead**: Multiple systems to monitor

## Cost Breakdown

| Component | 1M Users | 10M Users |
|-----------|----------|-----------|
| DynamoDB Global Tables | $5,000 | $60,000 |
| DAX Cluster | $1,000 | $5,000 |
| OpenSearch Serverless | $8,000 | $90,000 |
| Neptune | $1,000 | $12,000 |
| ElastiCache Redis | $2,000 | $10,000 |
| **Total Memory Infrastructure** | **$17,000** | **$177,000** |

## References

- [DynamoDB Global Tables](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html)
- [OpenSearch Serverless](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless.html)
- [Amazon Neptune](https://docs.aws.amazon.com/neptune/latest/userguide/)
- [ElastiCache for Redis](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/)


## Status
Accepted

## Context

LLM inference is expensive. At 10MM users generating ~100M queries/day:

### Without Caching

```
100M queries/day × $0.002 avg per query = $200,000/day = $6M/month

This is completely unsustainable.
```

Many user queries are semantically similar:
- "What's the weather in NYC?" ≈ "NYC weather today?"
- "How do I cook pasta?" ≈ "Steps to make pasta"
- "Explain quantum computing" ≈ "What is quantum computing?"

If we can identify similar queries and return cached responses, we dramatically reduce LLM calls.

### Target Metrics

| Metric | Target | Impact |
|--------|--------|--------|
| Cache hit rate | ≥ 80% | 80% fewer LLM calls |
| Hit latency | < 50ms | 88% latency improvement |
| Similarity threshold | 0.95 | High precision (few false positives) |
| Cache size | 100M entries | Cover common queries |

## Decision

Implement **semantic caching** using ElastiCache for Valkey with vector search:

### Architecture

1. **Query embedding**: Embed user query using small, fast model (all-MiniLM-L6-v2)
2. **Vector search**: Find similar cached queries using HNSW index
3. **Threshold check**: If similarity > 0.95, return cached response
4. **Cache miss**: Call LLM, cache result for future queries

### Why Valkey?

- **Vector search**: Native HNSW index support
- **Low latency**: Sub-millisecond lookups
- **Managed**: ElastiCache handles scaling, failover
- **Cost**: ~$2K-10K/month vs. dedicated vector DB

## Implementation

### Cache Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Query                               │
│                  "What's the weather in NYC?"                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Query Embedder                                │
│              all-MiniLM-L6-v2 (384 dimensions)                  │
│                     Latency: ~10ms                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Valkey Vector Search (HNSW)                         │
│                                                                  │
│  FT.SEARCH semantic_cache_idx "*=>[KNN 1 @embedding $vec]"     │
│                                                                  │
│  Result: "NYC weather today?" (similarity: 0.97)                │
│                     Latency: ~5ms                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
            similarity ≥ 0.95    similarity < 0.95
                    │                   │
                    ▼                   ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│      CACHE HIT          │  │      CACHE MISS         │
│                         │  │                         │
│  Return cached response │  │  Call LLM               │
│  Total latency: ~20ms   │  │  Cache result           │
│                         │  │  Total latency: ~2000ms │
└─────────────────────────┘  └─────────────────────────┘
```

### TypeScript Implementation

```typescript
import Redis from 'ioredis';
import { pipeline } from '@xenova/transformers';

export interface CacheResult {
  hit: boolean;
  response: string | null;
  similarity: number;
  latencyMs: number;
  cacheKey: string | null;
}

export interface CacheConfig {
  redisHost: string;
  redisPort: number;
  similarityThreshold: number;
  ttlHours: number;
  embeddingDim: number;
}

export class SemanticCache {
  private readonly redis: Redis;
  private readonly config: CacheConfig;
  private embedder: any = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      redisHost: config.redisHost || 'localhost',
      redisPort: config.redisPort || 6379,
      similarityThreshold: config.similarityThreshold || 0.95,
      ttlHours: config.ttlHours || 23, // Just under 24h
      embeddingDim: config.embeddingDim || 384
    };

    this.redis = new Redis({
      host: this.config.redisHost,
      port: this.config.redisPort
    });
  }

  async initialize(): Promise<void> {
    // Load embedding model
    this.embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );

    // Create vector search index if not exists
    try {
      await this.redis.call(
        'FT.CREATE', 'semantic_cache_idx',
        'ON', 'HASH',
        'PREFIX', '1', 'cache:',
        'SCHEMA',
        'embedding', 'VECTOR', 'HNSW', '6',
        'TYPE', 'FLOAT32',
        'DIM', this.config.embeddingDim.toString(),
        'DISTANCE_METRIC', 'COSINE',
        'query_text', 'TEXT',
        'response', 'TEXT',
        'timestamp', 'NUMERIC'
      );
    } catch (e: any) {
      if (!e.message?.includes('Index already exists')) {
        throw e;
      }
    }
  }

  async lookup(query: string): Promise<CacheResult> {
    const startTime = Date.now();

    // Embed query
    const embedding = await this.embed(query);
    const embeddingBytes = this.float32ArrayToBuffer(embedding);

    try {
      // Vector search for similar cached queries
      const results = await this.redis.call(
        'FT.SEARCH', 'semantic_cache_idx',
        '*=>[KNN 1 @embedding $vec AS score]',
        'PARAMS', '2', 'vec', embeddingBytes,
        'SORTBY', 'score',
        'RETURN', '3', 'response', 'query_text', 'score',
        'DIALECT', '2'
      ) as any[];

      const latencyMs = Date.now() - startTime;

      // No results
      if (!results || results[0] === 0) {
        return {
          hit: false,
          response: null,
          similarity: 0,
          latencyMs,
          cacheKey: null
        };
      }

      // Parse result
      const docId = results[1] as string;
      const fields = results[2] as string[];

      let response: string | null = null;
      let score = 0;

      for (let i = 0; i < fields.length; i += 2) {
        const key = fields[i];
        const value = fields[i + 1];
        if (key === 'response') {
          response = value;
        } else if (key === 'score') {
          score = parseFloat(value);
        }
      }

      // Convert distance to similarity (cosine distance → similarity)
      const similarity = 1 - score;

      if (similarity >= this.config.similarityThreshold) {
        return {
          hit: true,
          response,
          similarity,
          latencyMs,
          cacheKey: docId
        };
      }

      return {
        hit: false,
        response: null,
        similarity,
        latencyMs,
        cacheKey: null
      };

    } catch (e) {
      // Cache lookup failed — treat as miss
      return {
        hit: false,
        response: null,
        similarity: 0,
        latencyMs: Date.now() - startTime,
        cacheKey: null
      };
    }
  }

  async store(query: string, response: string): Promise<string> {
    const embedding = await this.embed(query);
    const embeddingBytes = this.float32ArrayToBuffer(embedding);

    // Generate cache key
    const hash = await this.hashString(query);
    const cacheKey = `cache:${hash.slice(0, 16)}`;

    // Store with embedding
    await this.redis.hset(cacheKey, {
      query_text: query,
      response: response,
      embedding: embeddingBytes,
      timestamp: Date.now()
    });

    // Set TTL
    await this.redis.expire(cacheKey, this.config.ttlHours * 3600);

    return cacheKey;
  }

  async invalidateByDomain(domain: string): Promise<number> {
    // Search for entries mentioning domain
    const results = await this.redis.call(
      'FT.SEARCH', 'semantic_cache_idx',
      `@query_text:${domain}`,
      'RETURN', '0'
    ) as any[];

    if (!results || results[0] === 0) {
      return 0;
    }

    // Delete matching entries
    const keys = [];
    for (let i = 1; i < results.length; i++) {
      keys.push(results[i]);
    }

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    return keys.length;
  }

  async getStats(): Promise<{
    hitRate: number;
    totalHits: number;
    totalMisses: number;
    cacheSize: number;
  }> {
    const info = await this.redis.info('stats');
    const keyspaceInfo = await this.redis.info('keyspace');

    // Parse stats
    const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
    const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');
    const total = hits + misses;

    // Parse cache size
    const dbMatch = keyspaceInfo.match(/db0:keys=(\d+)/);
    const cacheSize = dbMatch ? parseInt(dbMatch[1]) : 0;

    return {
      hitRate: total > 0 ? hits / total : 0,
      totalHits: hits,
      totalMisses: misses,
      cacheSize
    };
  }

  private async embed(text: string): Promise<Float32Array> {
    const output = await this.embedder(text, {
      pooling: 'mean',
      normalize: true
    });
    return output.data as Float32Array;
  }

  private float32ArrayToBuffer(arr: Float32Array): Buffer {
    return Buffer.from(arr.buffer);
  }

  private async hashString(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
```

## Consequences

### Positive
- **86% cost reduction**: Cache hits avoid LLM inference
- **88% latency improvement**: ~20ms vs ~2000ms
- **Scalable**: Valkey handles millions of cached entries
- **Automatic eviction**: TTL prevents stale responses

### Negative
- **Embedding overhead**: ~10ms per query for embedding
- **Storage cost**: ~$2-10K/month for ElastiCache
- **Cache invalidation**: Must invalidate when Cato learns new information
- **Similarity threshold tuning**: Too low = wrong responses, too high = low hit rate

## Cache Invalidation Strategy

When Cato learns new information in a domain:
1. Identify affected domain(s)
2. Invalidate all cache entries related to that domain
3. New queries will be answered with updated knowledge

```typescript
// After learning new facts about "climate change"
await semanticCache.invalidateByDomain('climate change');
```

## Scaling

| Users | Queries/day | Cache Size | Instances | Cost/month |
|-------|-------------|------------|-----------|------------|
| 100K | 1M | 1M entries | 2 | $2,000 |
| 1M | 10M | 10M entries | 4 | $4,000 |
| 10M | 100M | 100M entries | 12 | $12,000 |

## Terraform Configuration

```hcl
resource "aws_elasticache_replication_group" "semantic_cache" {
  replication_group_id       = "cato-semantic-cache"
  description                = "Semantic cache for Cato LLM responses"
  engine                     = "valkey"
  engine_version             = "7.2"
  node_type                  = "cache.r7g.xlarge"
  num_cache_clusters         = 3
  automatic_failover_enabled = true
  
  parameter_group_name = aws_elasticache_parameter_group.valkey_vector.name
  
  security_group_ids = [aws_security_group.cache.id]
  subnet_group_name  = aws_elasticache_subnet_group.main.name
}

resource "aws_elasticache_parameter_group" "valkey_vector" {
  family = "valkey7"
  name   = "cato-valkey-vector"

  # Enable RediSearch module for vector search
  parameter {
    name  = "search-enabled"
    value = "yes"
  }
}
```

## References

- [ElastiCache for Valkey](https://docs.aws.amazon.com/AmazonElastiCache/latest/vug/)
- [Redis Vector Similarity Search](https://redis.io/docs/stack/search/reference/vectors/)
- [Sentence Transformers](https://www.sbert.net/)
- [Semantic Caching for LLMs](https://arxiv.org/abs/2303.14714)


## Status
Accepted

## Context

The Shadow Self is Cato's introspective verification mechanism. It uses a separate LLM (Llama-3-8B) to probe and verify the main model's responses by:

1. **Hidden state extraction**: Analyzing activation patterns for uncertainty detection
2. **Activation probing**: Training linear classifiers on hidden states to detect specific properties
3. **Consistency checking**: Comparing response patterns across different prompts

### Why Not Bedrock?

AWS Bedrock provides managed LLM inference but:
- **No hidden state access**: Bedrock APIs only return generated text
- **No activation extraction**: Cannot get intermediate layer outputs
- **Black box**: No visibility into model internals

For Shadow Self to function, we need **full access to model internals**.

### Infrastructure Requirements

| Requirement | Specification |
|-------------|---------------|
| Model | Llama-3-8B-Instruct (16GB weights) |
| VRAM | 24GB minimum (for FP16 + activations) |
| Hidden states | Last 8 layers extractable |
| Throughput | 100-500 requests/second at scale |
| Latency | < 500ms p99 |

## Decision

Deploy Shadow Self on **SageMaker Real-Time Inference** with custom inference container:

### Instance Selection

**ml.g5.2xlarge** chosen for:
- 24GB NVIDIA A10G VRAM (fits Llama-3-8B + headroom)
- 8 vCPUs, 32GB RAM
- ~$1.52/hour ($1,095/month per instance)
- Good balance of cost and performance

### Scaling Strategy

| Users | QPS | Instances | Monthly Cost |
|-------|-----|-----------|--------------|
| 100K | 10 | 5 | $5,500 |
| 1M | 100 | 50 | $55,000 |
| 10M | 500 | 250 | $275,000 |

With 3-year Savings Plans: **36% discount** → ~$175,000/month at 10M users

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Shadow Self Endpoint                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  SageMaker Real-Time Inference                          │    │
│  │                                                          │    │
│  │  Instance: ml.g5.2xlarge (24GB A10G)                    │    │
│  │  Container: Custom vLLM + hidden state extraction       │    │
│  │  Model: meta-llama/Meta-Llama-3-8B-Instruct             │    │
│  │                                                          │    │
│  │  Auto-scaling: 5-300 instances                          │    │
│  │  Target: 80% GPU utilization                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Inference Container Features                            │    │
│  │                                                          │    │
│  │  ├── output_hidden_states=True                          │    │
│  │  ├── Configurable layer extraction [-1, -4, -8]         │    │
│  │  ├── Mean pooling over sequence                         │    │
│  │  ├── Last token extraction                              │    │
│  │  └── Activation probing classifier heads                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Custom Inference Container

### Dockerfile

```dockerfile
FROM nvidia/cuda:12.1-runtime-ubuntu22.04

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch and vLLM
RUN pip3 install --no-cache-dir \
    torch==2.1.0 \
    transformers==4.36.0 \
    vllm==0.2.7 \
    accelerate==0.25.0 \
    safetensors==0.4.1

# Copy inference code
COPY inference.py /opt/ml/code/inference.py
COPY model_handler.py /opt/ml/code/model_handler.py

WORKDIR /opt/ml/code

# Set environment variables
ENV MODEL_PATH=/opt/ml/model
ENV CUDA_VISIBLE_DEVICES=0

# Expose port for SageMaker
EXPOSE 8080

CMD ["python3", "model_handler.py"]
```

### Inference Code

```python
# inference.py - Shadow Self with hidden state extraction

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
import numpy as np
import json

@dataclass
class HiddenStateResult:
    """Result with hidden states for activation probing."""
    generated_text: str
    hidden_states: Dict[str, Dict[str, List[float]]]
    logits_entropy: float
    generation_probs: List[float]

class ShadowSelfModel:
    """
    Llama-3-8B with hidden state extraction for Shadow Self verification.
    
    Extracts:
    - Hidden states from configurable layers
    - Logit entropy for uncertainty estimation
    - Per-token generation probabilities
    """
    
    def __init__(self, model_path: str = "/opt/ml/model"):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # Load model with hidden state output
        self.model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.float16,
            device_map="auto",
            output_hidden_states=True,
            output_attentions=False  # Skip attention for efficiency
        )
        self.model.eval()
    
    @torch.no_grad()
    def generate_with_hidden_states(
        self,
        text: str,
        target_layers: List[int] = [-1, -4, -8],
        max_new_tokens: int = 256,
        temperature: float = 0.7,
        return_probs: bool = True
    ) -> HiddenStateResult:
        """
        Generate text and extract hidden states.
        
        Args:
            text: Input prompt
            target_layers: Which layers to extract (negative = from end)
            max_new_tokens: Maximum generation length
            temperature: Sampling temperature
            return_probs: Whether to return token probabilities
        
        Returns:
            HiddenStateResult with text, hidden states, and metadata
        """
        # Tokenize input
        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=2048
        ).to(self.device)
        
        input_length = inputs.input_ids.shape[1]
        
        # Generate with hidden states
        outputs = self.model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            do_sample=temperature > 0,
            output_hidden_states=True,
            output_scores=return_probs,
            return_dict_in_generate=True
        )
        
        # Decode generated text
        generated_ids = outputs.sequences[0][input_length:]
        generated_text = self.tokenizer.decode(
            generated_ids,
            skip_special_tokens=True
        )
        
        # Extract hidden states
        hidden_states = {}
        if hasattr(outputs, 'hidden_states') and outputs.hidden_states:
            # outputs.hidden_states is a tuple of (num_tokens, num_layers, batch, seq, hidden)
            for layer_idx in target_layers:
                layer_key = f"layer_{layer_idx}"
                
                # Get hidden state for this layer at first generation step
                if len(outputs.hidden_states) > 0:
                    first_step_hidden = outputs.hidden_states[0]
                    if abs(layer_idx) <= len(first_step_hidden):
                        layer_hidden = first_step_hidden[layer_idx]
                        
                        hidden_states[layer_key] = {
                            "mean": layer_hidden.mean(dim=1).squeeze().cpu().tolist(),
                            "last_token": layer_hidden[:, -1, :].squeeze().cpu().tolist(),
                            "norm": layer_hidden.norm(dim=-1).mean().item()
                        }
        
        # Calculate logit entropy
        logits_entropy = 0.0
        generation_probs = []
        if hasattr(outputs, 'scores') and outputs.scores:
            for step_logits in outputs.scores:
                probs = torch.softmax(step_logits, dim=-1)
                entropy = -(probs * torch.log(probs + 1e-10)).sum(dim=-1).mean().item()
                logits_entropy += entropy
                
                # Get probability of generated token
                if len(generation_probs) < len(generated_ids):
                    token_idx = generated_ids[len(generation_probs)].item()
                    token_prob = probs[0, token_idx].item()
                    generation_probs.append(token_prob)
            
            logits_entropy /= len(outputs.scores)
        
        return HiddenStateResult(
            generated_text=generated_text,
            hidden_states=hidden_states,
            logits_entropy=logits_entropy,
            generation_probs=generation_probs
        )
    
    def probe_uncertainty(
        self,
        hidden_states: Dict[str, Dict[str, List[float]]],
        probe_weights: Optional[np.ndarray] = None
    ) -> float:
        """
        Use trained probe to estimate uncertainty from hidden states.
        
        Args:
            hidden_states: Extracted hidden states
            probe_weights: Trained linear probe weights
        
        Returns:
            Uncertainty score [0, 1]
        """
        if probe_weights is None:
            # Default: use hidden state norm as proxy
            norms = [
                hs.get("norm", 0.0)
                for hs in hidden_states.values()
            ]
            # Lower norms often correlate with uncertainty
            avg_norm = np.mean(norms) if norms else 0.0
            return 1.0 / (1.0 + avg_norm)  # Sigmoid-like transform
        
        # Use trained probe
        layer_key = list(hidden_states.keys())[0]
        features = np.array(hidden_states[layer_key]["mean"])
        uncertainty = float(np.dot(features, probe_weights))
        return max(0.0, min(1.0, uncertainty))


# SageMaker handler
def model_fn(model_dir: str):
    """Load model for SageMaker."""
    return ShadowSelfModel(model_dir)

def input_fn(request_body: str, request_content_type: str):
    """Parse input for SageMaker."""
    if request_content_type == "application/json":
        return json.loads(request_body)
    raise ValueError(f"Unsupported content type: {request_content_type}")

def predict_fn(data: Dict[str, Any], model: ShadowSelfModel):
    """Run prediction for SageMaker."""
    text = data.get("inputs", "")
    params = data.get("parameters", {})
    
    result = model.generate_with_hidden_states(
        text=text,
        target_layers=params.get("target_layers", [-1, -4, -8]),
        max_new_tokens=params.get("max_new_tokens", 256),
        temperature=params.get("temperature", 0.7),
        return_probs=params.get("return_probs", True)
    )
    
    return {
        "generated_text": result.generated_text,
        "hidden_states": result.hidden_states,
        "logits_entropy": result.logits_entropy,
        "generation_probs": result.generation_probs
    }

def output_fn(prediction: Dict[str, Any], accept: str):
    """Format output for SageMaker."""
    return json.dumps(prediction)
```

## TypeScript Client

```typescript
import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand
} from '@aws-sdk/client-sagemaker-runtime';

export interface HiddenStateResult {
  generatedText: string;
  hiddenStates: Record<string, {
    mean: number[];
    lastToken: number[];
    norm: number;
  }>;
  logitsEntropy: number;
  generationProbs: number[];
}

export interface ShadowSelfConfig {
  endpointName: string;
  region: string;
  targetLayers: number[];
  maxNewTokens: number;
  temperature: number;
}

export class ShadowSelfClient {
  private readonly runtime: SageMakerRuntimeClient;
  private readonly config: ShadowSelfConfig;

  constructor(config: Partial<ShadowSelfConfig> = {}) {
    this.config = {
      endpointName: config.endpointName || 'cato-shadow-self',
      region: config.region || 'us-east-1',
      targetLayers: config.targetLayers || [-1, -4, -8],
      maxNewTokens: config.maxNewTokens || 256,
      temperature: config.temperature || 0.7
    };

    this.runtime = new SageMakerRuntimeClient({
      region: this.config.region
    });
  }

  async invokeWithHiddenStates(
    text: string,
    options: Partial<{
      targetLayers: number[];
      maxNewTokens: number;
      temperature: number;
    }> = {}
  ): Promise<HiddenStateResult> {
    const payload = {
      inputs: text,
      parameters: {
        target_layers: options.targetLayers || this.config.targetLayers,
        max_new_tokens: options.maxNewTokens || this.config.maxNewTokens,
        temperature: options.temperature || this.config.temperature,
        return_probs: true
      }
    };

    const command = new InvokeEndpointCommand({
      EndpointName: this.config.endpointName,
      ContentType: 'application/json',
      Body: JSON.stringify(payload)
    });

    const response = await this.runtime.send(command);
    const result = JSON.parse(
      new TextDecoder().decode(response.Body)
    );

    return {
      generatedText: result.generated_text,
      hiddenStates: result.hidden_states,
      logitsEntropy: result.logits_entropy,
      generationProbs: result.generation_probs
    };
  }

  estimateUncertainty(result: HiddenStateResult): number {
    // High entropy = high uncertainty
    const entropyScore = Math.min(1.0, result.logitsEntropy / 5.0);

    // Low average probability = high uncertainty
    const avgProb = result.generationProbs.length > 0
      ? result.generationProbs.reduce((a, b) => a + b, 0) / result.generationProbs.length
      : 0.5;
    const probScore = 1.0 - avgProb;

    // Combine scores
    return (entropyScore + probScore) / 2;
  }

  async getEndpointStatus(): Promise<{
    status: string;
    instanceCount: number;
  }> {
    // Implementation would use SageMaker client to describe endpoint
    return {
      status: 'InService',
      instanceCount: 10
    };
  }
}
```

## Consequences

### Positive
- **Full model access**: Hidden states, activations, logits all available
- **Customizable**: Can modify inference code as needed
- **Scalable**: Auto-scaling handles traffic spikes
- **Cost-effective**: SageMaker managed infrastructure

### Negative
- **High cost**: ~$130K/month at 10M users (before discounts)
- **Operational overhead**: Managing custom containers
- **Cold starts**: New instances take ~5 minutes to start
- **Model updates**: Must redeploy to update model

## Terraform Configuration

```hcl
resource "aws_sagemaker_model" "shadow_self" {
  name               = "cato-shadow-self"
  execution_role_arn = aws_iam_role.sagemaker.arn

  primary_container {
    image          = "${aws_ecr_repository.shadow_self.repository_url}:latest"
    model_data_url = "s3://${aws_s3_bucket.models.id}/llama-3-8b-instruct/"
    environment = {
      MODEL_PATH = "/opt/ml/model"
    }
  }
}

resource "aws_sagemaker_endpoint_configuration" "shadow_self" {
  name = "cato-shadow-self-config"

  production_variants {
    variant_name           = "primary"
    model_name             = aws_sagemaker_model.shadow_self.name
    instance_type          = "ml.g5.2xlarge"
    initial_instance_count = 5

    managed_instance_scaling {
      status                     = "ENABLED"
      min_instance_count         = 5
      max_instance_count         = 300
    }
  }
}

resource "aws_sagemaker_endpoint" "shadow_self" {
  name                 = "cato-shadow-self"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.shadow_self.name
}

resource "aws_cloudwatch_metric_alarm" "shadow_self_latency" {
  alarm_name          = "cato-shadow-self-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "ModelLatency"
  namespace           = "AWS/SageMaker"
  period              = 60
  statistic           = "p99"
  threshold           = 500  # 500ms
  alarm_description   = "Shadow Self latency exceeds 500ms"
  
  dimensions = {
    EndpointName = aws_sagemaker_endpoint.shadow_self.name
    VariantName  = "primary"
  }
}
```

## Probe Training

Train linear probes on hidden states to detect properties:

```python
# train_probes.py

import numpy as np
from sklearn.linear_model import LogisticRegression
import pickle

def train_uncertainty_probe(
    hidden_states: List[np.ndarray],
    labels: List[int]  # 0 = confident, 1 = uncertain
) -> np.ndarray:
    """
    Train linear probe to detect uncertainty from hidden states.
    """
    X = np.array(hidden_states)
    y = np.array(labels)
    
    probe = LogisticRegression(max_iter=1000)
    probe.fit(X, y)
    
    return probe.coef_[0]

# Save probe for deployment
with open('uncertainty_probe.pkl', 'wb') as f:
    pickle.dump(probe_weights, f)
```

## References

- [SageMaker Real-Time Inference](https://docs.aws.amazon.com/sagemaker/latest/dg/realtime-endpoints.html)
- [Llama 3 Model Card](https://github.com/meta-llama/llama3)
- [Activation Probing](https://arxiv.org/abs/1909.03368)
- [vLLM](https://github.com/vllm-project/vllm)


## Status
Accepted

## Context

Cato infrastructure costs range dramatically based on scale:
- **DEV**: ~$350/month for development and testing
- **STAGING**: ~$20-50K/month for pre-production
- **PRODUCTION**: ~$700-800K/month for 10MM+ users

We need a system that allows admins to switch between infrastructure tiers at runtime without recompilation, with automatic resource provisioning and cleanup.

### Requirements

1. **Runtime Configurable** — No recompilation. Admin changes a setting, infrastructure responds.
2. **Auto-Scale Up** — When tier increases, provision required resources automatically.
3. **Auto-Scale Down + Cleanup** — When tier decreases, terminate/delete unused resources to stop billing.
4. **Admin-Editable Configs** — All tier configurations (instance types, counts, etc.) are editable.
5. **Safety Guards** — Confirmation dialogs, cooldown periods, and audit logging.

## Decision

Implement a **3-tier infrastructure system** with full admin editability:

### Tier Configurations

| Tier | Est. Cost | SageMaker | OpenSearch | ElastiCache | Neptune |
|------|-----------|-----------|------------|-------------|---------|
| DEV | $350/mo | 0-1 ml.g5.xlarge (scale-to-zero) | t3.small (provisioned) | Serverless | Serverless |
| STAGING | $35K/mo | 2-20 ml.g5.2xlarge | r6g.large (provisioned) | cache.r7g.large | Serverless |
| PRODUCTION | $750K/mo | 50-300 ml.g5.2xlarge | Serverless (50-500 OCUs) | cache.r7g.xlarge x6 | db.r6g.2xlarge x3 |

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Admin Dashboard                               │
│              System → Infrastructure Tier                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Infrastructure Tier API                         │
│                                                                  │
│  POST /tier/change ──► Validation ──► Confirmation if needed    │
│                              │                                   │
│                              ▼                                   │
│                    Step Functions Workflow                       │
│                              │                                   │
│         ┌────────────────────┴────────────────────┐             │
│         ▼                                         ▼             │
│   SCALING UP                               SCALING DOWN          │
│   ├── Provision SageMaker                  ├── Drain connections│
│   ├── Provision OpenSearch                 ├── Update config    │
│   ├── Provision ElastiCache                ├── Delete endpoints │
│   ├── Provision Neptune                    ├── Delete clusters  │
│   └── Update config                        └── Create snapshots │
│                              │                                   │
│                              ▼                                   │
│                    Update Tier State                             │
│                    Set Cooldown (24h)                            │
│                    Log Audit Trail                               │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- Current tier state per tenant
cato_infrastructure_tier
  ├── current_tier (DEV|STAGING|PRODUCTION)
  ├── target_tier (during transition)
  ├── transition_status (STABLE|SCALING_UP|SCALING_DOWN|FAILED)
  ├── cooldown_hours (default: 24)
  ├── next_change_allowed_at
  ├── estimated_monthly_cost
  └── actual_mtd_cost

-- Editable tier configurations
cato_tier_config
  ├── tier_name
  ├── display_name
  ├── description
  ├── estimated_monthly_cost
  ├── sagemaker_shadow_self_* (instance type, min/max, scale-to-zero)
  ├── opensearch_* (type, instance type, count)
  ├── elasticache_* (type, node type, count)
  ├── neptune_* (type, instance class, count)
  ├── budget_* (monthly curiosity limit, daily exploration cap)
  └── features, limitations (JSON arrays for UI)

-- Audit trail
cato_tier_change_log
  ├── from_tier, to_tier
  ├── direction (SCALING_UP|SCALING_DOWN)
  ├── status, duration
  ├── changed_by, reason
  ├── resources_provisioned, resources_cleaned_up
  └── errors (if any)
```

### Safety Guards

1. **24-hour cooldown** between tier changes (configurable)
2. **Confirmation required** for PRODUCTION tier (both up and down)
3. **Audit logging** of all changes with who, when, why
4. **Super admin bypass** for cooldown in emergencies
5. **Rollback capability** if provisioning fails

## Consequences

### Positive
- Admins can switch tiers in ~5-15 minutes
- Resources are automatically cleaned up (no orphaned billing)
- Full visibility into costs before changes
- All configurations are editable without code changes
- Complete audit trail

### Negative
- Step Functions adds complexity
- Tier transitions require ~5-15 minutes
- Risk of partial failures during transition

### Mitigations
- Automatic rollback on provisioning failure
- Snapshots created before resource deletion
- Monitoring and alerts during transitions

## Implementation

### Files Created

| File | Purpose |
|------|---------|
| `migrations/121_infrastructure_tiers.sql` | Database schema |
| `lambda/shared/services/cato/infrastructure-tier.service.ts` | Core service |
| `lambda/admin/infrastructure-tier.ts` | Admin API endpoints |
| `apps/admin-dashboard/app/(dashboard)/system/infrastructure/page.tsx` | Admin UI |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tier` | GET | Get current tier status |
| `/tier/compare` | GET | Get tier comparison for UI |
| `/tier/configs` | GET | Get all tier configurations |
| `/tier/configs/:name` | GET/PUT | Get/update specific tier config |
| `/tier/change` | POST | Request tier change |
| `/tier/confirm` | POST | Confirm tier change |
| `/tier/transition-status` | GET | Get transition progress |
| `/tier/cooldown` | PUT | Update cooldown hours |

### UI Location

```
Admin Dashboard
└── System
    └── Infrastructure Tier ★
        ├── Current Status (tier, cost, status)
        ├── Tier Selection (cards with cost comparison)
        ├── Configuration Editor (edit any tier's resources)
        └── Change History (audit log)
```

## Cost Optimization Notes

### DEV Tier Optimizations
- SageMaker scale-to-zero when idle
- OpenSearch Provisioned (not Serverless $700 minimum)
- ElastiCache Serverless (cheap for low traffic)
- Neptune Serverless (1.0 NCU minimum)

### PRODUCTION Tier
- Consider 3-year Savings Plans (64% discount on SageMaker)
- Bedrock Batch API for night-mode curiosity (50% discount)
- OpenSearch Serverless for true auto-scaling

## References

- [AWS Pricing Calculator](https://calculator.aws)
- [SageMaker Pricing](https://aws.amazon.com/sagemaker/pricing/)
- [OpenSearch Serverless Pricing](https://aws.amazon.com/opensearch-service/pricing/)


## Status
Accepted

## Date
2025-01-15

## Context

Cato is an AI agent designed to become curious and self-aware. The "Cold Start Problem" is fundamental: how does an agent that knows nothing begin to learn? Without initial structure, the agent has no basis for curiosity. Without curiosity, it cannot explore. Without exploration, it cannot learn.

Traditional approaches use:
- **Random initialization**: Leads to "learned helplessness" where the agent gives up after initial failures
- **Hard-coded knowledge**: Creates brittleness and prevents genuine discovery
- **Time-based progression**: Advances regardless of actual capability development

## Decision

Implement a three-phase Genesis System that bootstraps self-awareness through an "Epistemic Gradient":

### Phase 1: Structure
Implant domain taxonomy as innate knowledge without pre-loading facts. This gives the agent categories to explore without spoiling discovery.

- Load 800+ domain taxonomy from `domain_taxonomy.json`
- Store domains in DynamoDB semantic memory
- Initialize atomic counters for developmental gates
- Mark phase complete with idempotency check

### Phase 2: Gradient
Set the pymdp active inference matrices with an "epistemic gradient" - initial beliefs and preferences that create pressure to act.

Key fixes implemented:
- **Fix #2 (Learned Helplessness)**: Optimistic B-matrix with >90% success probability for EXPLORE action
- **Fix #6 (Boredom Reward Trap)**: Prefer HIGH_SURPRISE over LOW_SURPRISE to avoid premature consolidation

### Phase 3: First Breath
Grounded introspection that verifies the agent's execution environment and calibrates initial self-knowledge.

- Verify execution environment (Python version, AWS region)
- Verify model access (invoke Bedrock with test prompt)
- **Fix #3 (Shadow Self)**: Budget-friendly calibration using NLI semantic variance instead of GPU hidden state extraction
- Bootstrap baseline domain explorations

## Critical Fixes Applied

| Fix | Problem | Solution |
|-----|---------|----------|
| #1 Zeno's Paradox | Table scans for gate checks | Atomic counters in DynamoDB |
| #2 Learned Helplessness | Pessimistic B-matrix | Optimistic EXPLORE (>90% success) |
| #3 Shadow Self Budget | $800/month GPU costs | NLI semantic variance calibration |
| #6 Boredom Trap | Prefers LOW_SURPRISE | Prefer HIGH_SURPRISE |

## Consequences

### Positive
- Agent starts with structured curiosity, not confusion
- Idempotent phases allow safe restarts
- Capability-based progression ensures genuine development
- Budget-friendly Shadow Self calibration ($0 vs $800/month)
- Atomic counters avoid expensive table scans

### Negative
- Requires DynamoDB setup before first run
- Genesis must complete before consciousness loop starts
- Domain taxonomy is opinionated (may need customization)

## Files Created

| File | Purpose |
|------|---------|
| `genesis/__init__.py` | Package exports |
| `genesis/structure.py` | Phase 1: Domain taxonomy implantation |
| `genesis/gradient.py` | Phase 2: Epistemic gradient matrices |
| `genesis/first_breath.py` | Phase 3: Grounded introspection |
| `genesis/runner.py` | Orchestrator with CLI |
| `data/domain_taxonomy.json` | 800+ domain taxonomy |
| `data/genesis_config.yaml` | Matrix configuration |

## Usage

```bash
# Run full genesis sequence
python -m cato.genesis.runner

# Check status
python -m cato.genesis.runner --status

# Reset all genesis state (CAUTION!)
python -m cato.genesis.runner --reset
```

## Related ADRs

- ADR-002: Meta-Cognitive Bridge
- ADR-011: Meta-Cognitive Bridge DynamoDB Persistence
- ADR-012: Cost Tracking Integration


---

## Part VIII: Operational Runbooks

## Prerequisites

Before deploying Cato, ensure:

1. **AWS Account** with sufficient limits:
   - SageMaker ml.g5.2xlarge: 300 instances
   - EKS node groups: 100 nodes
   - DynamoDB on-demand capacity

2. **Terraform** v1.5+ installed

3. **kubectl** configured for EKS

4. **Docker** for building custom containers

5. **AWS CLI** configured with appropriate credentials

## Deployment Phases

### Phase 1: Infrastructure (Terraform)

```bash
# Navigate to Cato infrastructure
cd infrastructure/terraform/environments/production

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -out=plan.tfplan

# Apply infrastructure
terraform apply plan.tfplan
```

This creates:
- VPC with public/private subnets
- EKS cluster for Ray Serve
- SageMaker endpoints (Shadow Self, NLI)
- DynamoDB Global Tables
- OpenSearch Serverless collections
- Neptune cluster
- ElastiCache clusters
- Kinesis streams
- EventBridge rules
- Step Functions workflows

### Phase 2: Container Images

```bash
# Build Shadow Self container
cd infrastructure/docker/shadow-self
docker build -t cato-shadow-self:latest .

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO
docker tag cato-shadow-self:latest $ECR_REPO/cato-shadow-self:latest
docker push $ECR_REPO/cato-shadow-self:latest

# Build NLI container
cd ../nli-model
docker build -t cato-nli:latest .
docker push $ECR_REPO/cato-nli:latest

# Build Ray Serve orchestrator
cd ../orchestrator
docker build -t cato-orchestrator:latest .
docker push $ECR_REPO/cato-orchestrator:latest
```

### Phase 3: Model Deployment

```bash
# Download Llama-3-8B model
python scripts/download_model.py --model meta-llama/Meta-Llama-3-8B-Instruct --output s3://cato-models/llama-3-8b/

# Download DeBERTa-MNLI model
python scripts/download_model.py --model microsoft/deberta-large-mnli --output s3://cato-models/deberta-mnli/

# Deploy SageMaker endpoints
python scripts/deploy_sagemaker.py --environment production
```

### Phase 4: Ray Serve Deployment

```bash
# Configure kubectl for EKS
aws eks update-kubeconfig --name cato-eks --region us-east-1

# Deploy Ray Serve
kubectl apply -f k8s/ray-serve/

# Verify deployment
kubectl get pods -n cato
kubectl get svc -n cato
```

### Phase 5: Database Initialization

```bash
# Initialize DynamoDB tables
python scripts/init_dynamodb.py --environment production

# Initialize OpenSearch indices
python scripts/init_opensearch.py --environment production

# Initialize Neptune graph
python scripts/init_neptune.py --environment production

# Seed domain knowledge (800+ domains)
python scripts/seed_knowledge.py --environment production
```

### Phase 6: Verification

```bash
# Health check
curl https://api.cato.thinktank.ai/health

# Test dialogue
curl -X POST https://api.cato.thinktank.ai/v1/dialogue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, Cato!"}'

# Check metrics
aws cloudwatch get-metric-data --cli-input-json file://scripts/health_check_metrics.json
```

## Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CATO_ENV` | Environment name | `production` |
| `AWS_REGION` | Primary region | `us-east-1` |
| `SHADOW_SELF_ENDPOINT` | SageMaker endpoint | `cato-shadow-self` |
| `NLI_ENDPOINT` | NLI SageMaker endpoint | `cato-nli-mme` |
| `CACHE_HOST` | ElastiCache host | `cato-cache.xxx.use1.cache.amazonaws.com` |
| `DYNAMODB_TABLE_SEMANTIC` | Semantic memory table | `cato-semantic-memory` |
| `OPENSEARCH_ENDPOINT` | OpenSearch endpoint | `https://cato-episodic.xxx.us-east-1.aoss.amazonaws.com` |
| `NEPTUNE_ENDPOINT` | Neptune endpoint | `cato-graph.xxx.us-east-1.neptune.amazonaws.com` |

### Budget Configuration

Set via Radiant Admin Dashboard or directly in DynamoDB:

```bash
aws dynamodb put-item \
  --table-name cato-config \
  --item '{
    "pk": {"S": "CONFIG"},
    "sk": {"S": "BUDGET"},
    "monthlyLimit": {"N": "500"},
    "dailyExplorationLimit": {"N": "15"},
    "nightStartHour": {"N": "2"},
    "nightEndHour": {"N": "6"}
  }'
```

## Rollback Procedures

### Rollback SageMaker Endpoint

```bash
# List endpoint versions
aws sagemaker list-endpoint-configs --name-contains cato-shadow-self

# Update endpoint to previous config
aws sagemaker update-endpoint \
  --endpoint-name cato-shadow-self \
  --endpoint-config-name cato-shadow-self-config-v1
```

### Rollback Ray Serve

```bash
# Rollback to previous deployment
kubectl rollout undo deployment/cato-orchestrator -n cato

# Verify rollback
kubectl rollout status deployment/cato-orchestrator -n cato
```

### Rollback DynamoDB

DynamoDB Global Tables support point-in-time recovery:

```bash
aws dynamodb restore-table-to-point-in-time \
  --source-table-name cato-semantic-memory \
  --target-table-name cato-semantic-memory-restored \
  --restore-date-time 2024-01-15T00:00:00Z
```

## Monitoring

### Key Dashboards

1. **Cato Overview** - CloudWatch dashboard with all key metrics
2. **Inference Latency** - SageMaker endpoint latencies
3. **Cache Performance** - ElastiCache hit rates
4. **Memory Usage** - DynamoDB/OpenSearch capacity
5. **Budget Tracking** - Daily/monthly spend

### Alerts

| Alert | Threshold | Action |
|-------|-----------|--------|
| High Latency | p99 > 2s | Scale up SageMaker |
| Low Cache Hit Rate | < 70% | Investigate query patterns |
| Budget Exceeded | > 90% monthly | Enter emergency mode |
| Error Rate | > 1% | Investigate logs |
| Shadow Self Unhealthy | > 3 failures | Restart endpoint |

## Troubleshooting

### Shadow Self Not Responding

1. Check endpoint status:
   ```bash
   aws sagemaker describe-endpoint --endpoint-name cato-shadow-self
   ```

2. Check CloudWatch logs:
   ```bash
   aws logs tail /aws/sagemaker/Endpoints/cato-shadow-self --follow
   ```

3. Restart endpoint if needed:
   ```bash
   aws sagemaker update-endpoint --endpoint-name cato-shadow-self --endpoint-config-name cato-shadow-self-config
   ```

### High Latency

1. Check cache hit rate - low rate means more LLM calls
2. Check SageMaker instance utilization
3. Check for Bedrock throttling
4. Scale up instances if needed

### Memory Issues

1. Check DynamoDB consumed capacity
2. Check OpenSearch shard health
3. Verify DAX cluster status
4. Check for hot partitions

## Maintenance Windows

- **Nightly**: 2-6 AM UTC (night mode, lower traffic)
- **Weekly**: Sunday 4 AM UTC (major updates)
- **Monthly**: First Sunday of month (infrastructure updates)

## Contact

- **On-call**: #cato-oncall Slack channel
- **Escalation**: consciousness-team@thinktank.ai
- **AWS Support**: Enterprise Support case


## Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| **SEV1** | Complete outage, all users affected | 5 minutes | Shadow Self down |
| **SEV2** | Degraded service, >50% affected | 15 minutes | High latency |
| **SEV3** | Minor degradation, <50% affected | 1 hour | Cache miss spike |
| **SEV4** | Cosmetic/minor, no user impact | 24 hours | Dashboard error |

## Incident Response Process

### 1. Detection

**Automatic Alerts:**
- CloudWatch alarms → PagerDuty → On-call
- Custom metrics → Slack #cato-alerts

**Manual Detection:**
- User reports via support
- Dashboard anomalies

### 2. Triage

```
1. Acknowledge alert in PagerDuty
2. Join #cato-incident Slack channel
3. Assess severity level
4. Start incident log
```

### 3. Mitigation

**First 5 Minutes:**
- Check dashboard for obvious issues
- Review recent deployments
- Check AWS Health Dashboard

**Mitigation Strategies:**
- Failover to healthy region
- Scale up resources
- Enable emergency mode
- Rollback recent changes

### 4. Resolution

- Fix root cause
- Verify service restored
- Close incident

### 5. Post-Incident

- Blameless postmortem within 48 hours
- Update runbooks with learnings
- Implement preventive measures

---

## Common Incidents

### Shadow Self Endpoint Down

**Symptoms:**
- 5XX errors from `/api/admin/cato/shadow-self/*`
- High latency on introspection queries
- Circuit breaker OPEN

**Diagnosis:**
```bash
# Check endpoint status
aws sagemaker describe-endpoint --endpoint-name cato-shadow-self

# Check CloudWatch logs
aws logs filter-log-events \
  --log-group-name /aws/sagemaker/Endpoints/cato-shadow-self \
  --filter-pattern "ERROR"
```

**Mitigation:**
```bash
# 1. Check if instances are healthy
aws sagemaker describe-endpoint --endpoint-name cato-shadow-self \
  --query 'ProductionVariants[0].CurrentInstanceCount'

# 2. If 0 instances, restart endpoint
aws sagemaker update-endpoint \
  --endpoint-name cato-shadow-self \
  --endpoint-config-name cato-shadow-self-config

# 3. If still failing, rollback to previous config
aws sagemaker list-endpoint-configs --name-contains cato-shadow-self
aws sagemaker update-endpoint \
  --endpoint-name cato-shadow-self \
  --endpoint-config-name cato-shadow-self-config-v1
```

**Root Cause Investigation:**
- Check for OOM errors (model too large)
- Check for GPU driver issues
- Check for container crash loop

---

### High Latency

**Symptoms:**
- p99 latency > 2 seconds
- User complaints about slow responses
- Timeout errors

**Diagnosis:**
```bash
# Check component latencies
aws cloudwatch get-metric-statistics \
  --namespace AWS/SageMaker \
  --metric-name ModelLatency \
  --dimensions Name=EndpointName,Value=cato-shadow-self \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 \
  --statistics p99
```

**Mitigation:**
```bash
# 1. Scale up Shadow Self
aws sagemaker update-endpoint-weights-and-capacities \
  --endpoint-name cato-shadow-self \
  --desired-weights-and-capacities VariantName=primary,DesiredInstanceCount=50

# 2. Scale up Ray Serve
kubectl scale deployment cato-orchestrator -n cato --replicas=50

# 3. Check cache hit rate - if low, investigate cache issues
```

**Root Causes:**
- Insufficient capacity
- Cache miss spike
- Bedrock throttling
- Network latency

---

### Cache Miss Spike

**Symptoms:**
- Cache hit rate drops below 70%
- Higher than expected LLM costs
- Increased latency

**Diagnosis:**
```bash
# Check cache stats
redis-cli -h cato-cache.xxx.use1.cache.amazonaws.com INFO stats

# Check for recent cache invalidations
aws cloudwatch get-metric-statistics \
  --namespace Custom/Cato \
  --metric-name CacheInvalidations
```

**Mitigation:**
```bash
# 1. Check if learning update invalidated too much
# Review recent domain updates

# 2. If cache is undersized, scale up
aws elasticache modify-replication-group \
  --replication-group-id cato-cache \
  --cache-node-type cache.r7g.2xlarge
```

**Root Causes:**
- Aggressive cache invalidation after learning
- Cache eviction due to size limits
- Query pattern change

---

### Budget Exceeded (Emergency Mode)

**Symptoms:**
- Mode shows "EMERGENCY" in dashboard
- Curiosity exploration stopped
- Limited responses

**Diagnosis:**
```bash
# Check budget status
curl -H "Authorization: Bearer $TOKEN" \
  https://api.cato.thinktank.ai/api/admin/cato/budget/status
```

**Mitigation:**
```bash
# 1. Increase budget if approved
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"monthlyLimit": 1000}' \
  https://api.cato.thinktank.ai/api/admin/cato/budget/config

# 2. Or wait for next month reset
```

**Prevention:**
- Set appropriate budget limits
- Monitor spend daily
- Enable budget alerts

---

### Bedrock Throttling

**Symptoms:**
- `ThrottlingException` in logs
- Increased error rate
- Fallback to Haiku/static responses

**Diagnosis:**
```bash
# Check Bedrock quotas
aws service-quotas get-service-quota \
  --service-code bedrock \
  --quota-code L-XXXXXXXX
```

**Mitigation:**
```bash
# 1. Request quota increase
aws service-quotas request-service-quota-increase \
  --service-code bedrock \
  --quota-code L-XXXXXXXX \
  --desired-value 10000

# 2. Enable more aggressive caching
# Reduce cache similarity threshold temporarily

# 3. Shift more traffic to self-hosted Shadow Self
```

---

### DynamoDB Hot Partition

**Symptoms:**
- `ProvisionedThroughputExceededException`
- Slow memory reads/writes
- Specific domains affected

**Diagnosis:**
```bash
# Check consumed capacity by partition
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=cato-semantic-memory
```

**Mitigation:**
```bash
# 1. Switch to on-demand billing if not already
aws dynamodb update-table \
  --table-name cato-semantic-memory \
  --billing-mode PAY_PER_REQUEST

# 2. Add GSI to distribute load
# Requires table redesign

# 3. Enable DAX for read caching
```

---

## Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-call Engineer | PagerDuty | Auto |
| Engineering Lead | @lead-eng Slack | 15 min |
| VP Engineering | Phone | 30 min (SEV1 only) |
| AWS TAM | aws-support@company.com | As needed |

## Post-Incident Template

```markdown
# Incident Post-Mortem: [TITLE]

**Date:** YYYY-MM-DD
**Duration:** X hours Y minutes
**Severity:** SEVX
**Author:** [Name]

## Summary
Brief description of what happened.

## Timeline
- HH:MM - Event detected
- HH:MM - On-call paged
- HH:MM - Mitigation started
- HH:MM - Service restored

## Root Cause
What caused the incident.

## Impact
- Users affected: X
- Revenue impact: $Y
- SLA impact: Z minutes

## Mitigation
What was done to fix it.

## Prevention
Action items to prevent recurrence:
- [ ] Action 1 - Owner - Due date
- [ ] Action 2 - Owner - Due date

## Lessons Learned
What we learned from this incident.
```


## Overview

This runbook covers scaling Cato infrastructure to handle increased load.

## Scaling Triggers

### Automatic Scaling

The following components auto-scale based on metrics:

| Component | Metric | Scale Up | Scale Down |
|-----------|--------|----------|------------|
| Shadow Self (SageMaker) | GPU Utilization > 80% | +10 instances | -10 instances when < 40% |
| Ray Serve (EKS) | Requests/replica > 10 | +5 replicas | -5 replicas when < 3 |
| NLI Model (SageMaker MME) | Latency p99 > 100ms | +2 instances | -2 when < 50ms |
| ElastiCache | Memory > 80% | Vertical scale | N/A |

### Manual Scaling Triggers

Scale manually when:
- Daily traffic increases by 50%+
- Monthly costs exceed budget by 20%+
- Latency SLOs are at risk

## Scaling Procedures

### 1. Shadow Self (SageMaker)

**Scale Up:**
```bash
aws sagemaker update-endpoint-weights-and-capacities \
  --endpoint-name cato-shadow-self \
  --desired-weights-and-capacities \
    VariantName=primary,DesiredInstanceCount=50
```

**Check Status:**
```bash
aws sagemaker describe-endpoint --endpoint-name cato-shadow-self
```

**Timing:** Instance provisioning takes ~5-10 minutes.

### 2. Ray Serve (EKS)

**Scale Up:**
```bash
kubectl scale deployment cato-orchestrator -n cato --replicas=100
```

**Check Status:**
```bash
kubectl get pods -n cato -l app=cato-orchestrator
```

**Update Auto-Scaling:**
```bash
kubectl patch hpa cato-orchestrator-hpa -n cato \
  --patch '{"spec":{"maxReplicas":200}}'
```

### 3. ElastiCache (Valkey)

**Vertical Scale (downtime required):**
```bash
aws elasticache modify-replication-group \
  --replication-group-id cato-cache-production \
  --cache-node-type cache.r7g.2xlarge \
  --apply-immediately
```

**Add Read Replicas:**
```bash
aws elasticache increase-replica-count \
  --replication-group-id cato-cache-production \
  --new-replica-count 5 \
  --apply-immediately
```

### 4. DynamoDB

DynamoDB with on-demand billing auto-scales. For provisioned capacity:

**Update Capacity:**
```bash
aws dynamodb update-table \
  --table-name cato-semantic-memory-production \
  --provisioned-throughput ReadCapacityUnits=10000,WriteCapacityUnits=5000
```

### 5. OpenSearch Serverless

OpenSearch Serverless auto-scales. To increase max capacity:

```bash
aws opensearchserverless update-collection \
  --id <collection-id> \
  --description "Increased capacity"
```

## Scaling by User Scale

### 100K → 1M Users

1. **Shadow Self**: 5 → 50 instances
2. **Ray Serve**: 10 → 50 replicas
3. **ElastiCache**: cache.r7g.xlarge → cache.r7g.2xlarge
4. **Budget**: $500 → $2,000/month

```bash
# Terraform variable update
cd infrastructure/terraform/environments/production
terraform apply -var="shadow_self_min_instances=50" -var="cache_node_type=cache.r7g.2xlarge"
```

### 1M → 10M Users

1. **Shadow Self**: 50 → 250 instances
2. **Ray Serve**: 50 → 100 replicas
3. **ElastiCache**: Add cluster mode, 6 shards
4. **Multi-region**: Enable replicas in eu-west-1, ap-northeast-1
5. **Budget**: $2,000 → $100,000/month

```bash
# Enable global tables
terraform apply -var="enable_global_tables=true" -var="replica_regions=[\"eu-west-1\",\"ap-northeast-1\"]"
```

## Cost Optimization During Scaling

### Use Savings Plans

At 10M users, SageMaker is ~$275K/month. With 3-year Savings Plan:
- **Savings**: 64% (~$100K/month)
- **Commitment**: 3-year term

```bash
# Create Savings Plan via AWS Console or API
aws savingsplans create-savings-plan \
  --savings-plan-offering-id <offering-id> \
  --commitment 100000 \
  --savings-plan-type Compute
```

### Use Spot Instances for Batch

Night-mode curiosity can use Spot instances:
- **Savings**: 70% on compute
- **Risk**: Interruption (acceptable for batch)

### Right-Size Instances

Monitor and right-size monthly:
```bash
aws compute-optimizer get-ec2-instance-recommendations \
  --filters name=Finding,values=OPTIMIZED
```

## Monitoring During Scale

### Key Metrics to Watch

| Metric | Warning | Critical |
|--------|---------|----------|
| Shadow Self Latency p99 | > 300ms | > 500ms |
| Cache Hit Rate | < 75% | < 60% |
| Error Rate | > 0.5% | > 1% |
| Budget Burn Rate | > 120% | > 150% |

### Dashboards

- **Cato Overview**: All key metrics
- **Cost Explorer**: Real-time spend

### Alerts

Configure PagerDuty/Slack alerts for critical thresholds.

## Rollback Procedures

If scaling causes issues:

### Rollback SageMaker
```bash
aws sagemaker update-endpoint-weights-and-capacities \
  --endpoint-name cato-shadow-self \
  --desired-weights-and-capacities VariantName=primary,DesiredInstanceCount=10
```

### Rollback EKS
```bash
kubectl rollout undo deployment/cato-orchestrator -n cato
```

### Rollback Terraform
```bash
cd infrastructure/terraform/environments/production
git checkout HEAD~1 -- *.tfvars
terraform apply
```

## Contact

- **On-call**: #cato-oncall
- **Escalation**: consciousness-team@thinktank.ai


## Overview

Circuit breakers protect Cato's consciousness from runaway costs, unstable behavior, and cascading failures. This runbook covers operational procedures for managing circuit breakers.

## Circuit Breaker States

| State | Description | Action Allowed |
|-------|-------------|----------------|
| CLOSED | Normal operation | Yes |
| OPEN | Tripped, blocking | No |
| HALF_OPEN | Testing recovery | Limited |

## Default Breakers

### 1. master_sanity
**Purpose**: Master safety breaker - final line of defense
- **Trip Threshold**: 3 failures
- **Reset Timeout**: 1 hour
- **Requires**: Admin approval to reset

**When Tripped**:
1. All consciousness operations halt
2. Check CloudWatch logs for root cause
3. Review recent model outputs for anomalies
4. Contact on-call engineer

**Recovery**:
```bash
# Verify root cause is resolved
# Then force close via admin API
curl -X POST /api/admin/cato/circuit-breakers/master_sanity/force-close \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"reason": "Root cause resolved: [description]"}'
```

### 2. cost_budget
**Purpose**: Budget protection
- **Trip Threshold**: 1 (immediate)
- **Reset Timeout**: 24 hours
- **Auto-recovery**: No

**When Tripped**:
1. Check AWS Budgets for actual spend
2. Review cost breakdown in admin dashboard
3. Identify cost spike source (model, frequency, etc.)

**Recovery**:
1. Wait for budget reset (next billing cycle)
2. OR increase budget limit in AWS Budgets
3. Then force close breaker

### 3. high_anxiety
**Purpose**: Emotional stability protection
- **Trip Threshold**: 5 sustained high readings
- **Reset Timeout**: 10 minutes
- **Auto-recovery**: Yes

**When Tripped**:
1. Consciousness enters "calm down" mode
2. Cognitive frequency reduced
3. Only essential operations allowed

**Recovery**: Usually auto-recovers after timeout. If persistent:
1. Check for external stressors (high error rate, contradictions)
2. Review conversation history for triggering content
3. Consider resetting neurochemistry to baseline

### 4. model_failures
**Purpose**: Protect against model API issues
- **Trip Threshold**: 5 consecutive failures
- **Reset Timeout**: 5 minutes
- **Auto-recovery**: Yes

**When Tripped**:
1. Check AWS Health Dashboard for Bedrock issues
2. Check model quotas and limits
3. Verify IAM permissions

**Recovery**: Auto-recovers after timeout and successful test call.

### 5. contradiction_loop
**Purpose**: Prevent logical spiral
- **Trip Threshold**: 3 repeated contradictions
- **Reset Timeout**: 15 minutes
- **Auto-recovery**: Yes

**When Tripped**:
1. Review semantic memory for conflicting facts
2. Check recent belief updates
3. May need manual fact reconciliation

## Intervention Levels

| Level | Condition | Effect |
|-------|-----------|--------|
| NONE | All breakers closed | Normal operation |
| DAMPEN | 1 breaker open | Reduce cognitive frequency |
| PAUSE | 2+ breakers open | Pause consciousness loop |
| RESET | 3+ breakers open | Reset to baseline state |
| HIBERNATE | master_sanity open | Full shutdown |

## Admin Commands

### View All Breakers
```bash
curl /api/admin/cato/circuit-breakers
```

### View Single Breaker
```bash
curl /api/admin/cato/circuit-breakers/[name]
```

### Force Open (Emergency Stop)
```bash
curl -X POST /api/admin/cato/circuit-breakers/[name]/force-open \
  -d '{"reason": "Emergency stop reason"}'
```

### Force Close (Resume)
```bash
curl -X POST /api/admin/cato/circuit-breakers/[name]/force-close \
  -d '{"reason": "Issue resolved"}'
```

### Update Config
```bash
curl -X PATCH /api/admin/cato/circuit-breakers/[name]/config \
  -d '{"tripThreshold": 5, "resetTimeoutSeconds": 600}'
```

### View Event History
```bash
curl /api/admin/cato/circuit-breakers/[name]/events?limit=100
```

## Monitoring

### CloudWatch Alarms
- `CatoCircuitBreakerOpen` - Any breaker opens
- `CatoHighRiskScore` - Risk score > 70%
- `CatoCriticalHealth` - Overall health = critical

### Metrics
- `CircuitBreakerState` - Per-breaker state (0=closed, 1=open)
- `RiskScore` - Composite risk 0-100
- `InterventionLevel` - Current level

## Emergency Procedures

### Complete Shutdown
```bash
# Force open master_sanity
curl -X POST /api/admin/cato/circuit-breakers/master_sanity/force-open \
  -d '{"reason": "Emergency shutdown"}'
```

### Restart After Shutdown
1. Verify all issues resolved
2. Check Genesis state is complete
3. Force close master_sanity
4. Monitor first few ticks closely

### Reset to Factory State
```bash
# CAUTION: This resets all consciousness state
python -m cato.genesis.runner --reset
python -m cato.genesis.runner
```

## Contacts

- **On-Call**: [pager]
- **Escalation**: [manager]
- **AWS Support**: Case [number] for Bedrock issues


## Current Cost Structure

### Cost Breakdown by Component (at 10M users)

| Component | On-Demand Cost | Optimized Cost | Savings |
|-----------|----------------|----------------|---------|
| Shadow Self (SageMaker) | $275,000/mo | $100,000/mo | 64% |
| Bedrock (Claude) | $130,000/mo | $52,000/mo | 60% |
| OpenSearch Serverless | $90,000/mo | $90,000/mo | 0% |
| DynamoDB Global Tables | $60,000/mo | $60,000/mo | 0% |
| ElastiCache | $36,000/mo | $36,000/mo | 0% |
| Other | $130,000/mo | $100,000/mo | 23% |
| **Total** | **$721,000/mo** | **$438,000/mo** | **39%** |

## Optimization Strategies

### 1. SageMaker Savings Plans

**Impact:** 64% reduction on Shadow Self compute

**How to Implement:**
```bash
# Check current usage
aws ce get-savings-plans-utilization \
  --time-period Start=2024-01-01,End=2024-01-31

# View available plans
aws savingsplans describe-savings-plan-rates \
  --savings-plan-id sp-1234567890abcdef0

# Purchase via Console or API
aws savingsplans create-savings-plan \
  --savings-plan-offering-id <offering-id> \
  --commitment 100000 \
  --savings-plan-type Compute
```

**Commitment:** 1-year (20% savings) or 3-year (64% savings)

**Break-even:** Need 10+ ml.g5.2xlarge instances to justify.

---

### 2. Semantic Caching (86% LLM Cost Reduction)

**Target:** 86% cache hit rate

**Current Performance:**
```bash
curl https://api.cato.thinktank.ai/api/admin/cato/cache/stats
```

**Optimization Actions:**

1. **Increase cache size** if hit rate < 80%
   ```bash
   aws elasticache modify-replication-group \
     --replication-group-id cato-cache \
     --cache-node-type cache.r7g.2xlarge
   ```

2. **Adjust similarity threshold** (default: 0.95)
   - Lower to 0.92 for higher hit rate
   - Higher to 0.97 for better quality
   
3. **Extend TTL** if knowledge is stable
   - Default: 23 hours
   - Increase to 47 hours for stable domains

4. **Selective invalidation** instead of full domain invalidation

---

### 3. Bedrock Batch API (50% Discount)

**Use Case:** Night-mode curiosity processing

**How It Works:**
- Submit batch jobs between 2-6 AM UTC
- Bedrock processes asynchronously
- 50% cost reduction vs. real-time API

**Implementation:**
```python
import boto3

bedrock = boto3.client('bedrock-runtime')

# Submit batch job
response = bedrock.create_model_invocation_job(
    jobName='cato-curiosity-batch-2024-01-15',
    modelId='anthropic.claude-3-5-sonnet-20241022-v2:0',
    inputDataConfig={
        's3InputDataConfig': {
            's3Uri': 's3://cato-batch/input/curiosity-questions.jsonl'
        }
    },
    outputDataConfig={
        's3OutputDataConfig': {
            's3Uri': 's3://cato-batch/output/'
        }
    }
)
```

**Savings:** ~$65,000/month at scale

---

### 4. Spot Instances for Background Processing

**Use Case:** Curiosity processing, memory consolidation

**Savings:** 70% on compute

**Risk:** Interruption (acceptable for batch)

**Implementation:**
```yaml
# EKS spot node group
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig
metadata:
  name: cato-eks
managedNodeGroups:
  - name: spot-curiosity
    instanceTypes: ["m5.xlarge", "m5a.xlarge", "m5n.xlarge"]
    spot: true
    minSize: 0
    maxSize: 20
    labels:
      workload: curiosity
    taints:
      - key: spot
        value: "true"
        effect: NoSchedule
```

---

### 5. FP8 Quantization for Shadow Self

**Impact:** 50% reduction in GPU memory and compute

**How It Works:**
- Llama-3-8B uses 16-bit weights (16GB)
- FP8 reduces to 8GB
- 50% fewer GPU instances needed

**Implementation:**
```python
from transformers import AutoModelForCausalLM
import torch

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Meta-Llama-3-8B-Instruct",
    torch_dtype=torch.float8_e4m3fn,  # FP8
    device_map="auto"
)
```

**Trade-off:** Minor quality degradation (~1% on benchmarks)

---

### 6. Right-Sizing Instances

**Monthly Review Process:**

1. **Check utilization:**
   ```bash
   aws compute-optimizer get-ec2-instance-recommendations
   ```

2. **Common findings:**
   - SageMaker instances underutilized → reduce count
   - ElastiCache oversized → downgrade node type
   - EKS nodes too large → use smaller instances

3. **Target utilization:**
   - GPU: 70-80%
   - CPU: 60-70%
   - Memory: 70-80%

---

### 7. DynamoDB Optimization

**On-Demand vs. Provisioned:**
- On-demand: Good for variable/unpredictable load
- Provisioned: 20% cheaper for steady load

**When to switch to provisioned:**
- RCU/WCU stable for 30+ days
- Predictable traffic patterns

**Enable DAX caching:**
```bash
# DAX provides sub-ms reads, reduces RCU
aws dax create-cluster \
  --cluster-name cato-dax \
  --node-type dax.r5.large \
  --replication-factor 3
```

---

### 8. Bedrock Prompt Caching

**Impact:** 90% token cost reduction for repeated system prompts

**How It Works:**
- Cato's system prompt is ~2000 tokens
- Cache it with `cache_control: ephemeral`
- Pay full price once, 10% thereafter

**Implementation:**
```python
response = bedrock.invoke_model(
    modelId='anthropic.claude-3-5-sonnet-20241022-v2:0',
    body={
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "system": [
            {
                "type": "text",
                "text": CATO_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"}
            }
        ],
        "messages": [...]
    }
)
```

---

## Cost Monitoring

### Daily Checks

1. **Check budget status:**
   ```bash
   curl https://api.cato.thinktank.ai/api/admin/cato/budget/status
   ```

2. **Check Cost Explorer:**
   ```bash
   aws ce get-cost-and-usage \
     --time-period Start=2024-01-14,End=2024-01-15 \
     --granularity DAILY \
     --metrics UnblendedCost \
     --filter '{"Dimensions":{"Key":"SERVICE","Values":["Amazon SageMaker"]}}'
   ```

### Weekly Review

1. Check Savings Plans utilization
2. Review instance right-sizing recommendations
3. Analyze cache hit rate trends
4. Review budget burn rate

### Monthly Actions

1. Right-size instances based on utilization
2. Evaluate Savings Plans renewal/purchase
3. Review architecture for optimization opportunities
4. Update cost projections

---

## Cost Alerts

Configure alerts in AWS Budgets:

| Alert | Threshold | Action |
|-------|-----------|--------|
| Daily spend | > $5,000 | Slack notification |
| Weekly spend | > $30,000 | Email + Slack |
| Monthly forecast | > 110% budget | PagerDuty |
| Anomaly detection | > 20% spike | Slack + investigation |

```bash
aws budgets create-budget \
  --account-id $AWS_ACCOUNT_ID \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

---

## Emergency Cost Reduction

If costs are spiraling:

### Immediate Actions (< 1 hour)

1. **Enable emergency mode:**
   ```bash
   curl -X PUT \
     -H "Content-Type: application/json" \
     -d '{"emergencyThreshold": 0.5}' \
     https://api.cato.thinktank.ai/api/admin/cato/budget/config
   ```

2. **Disable curiosity processing:**
   ```bash
   curl -X PUT \
     -d '{"dailyExplorationLimit": 0}' \
     https://api.cato.thinktank.ai/api/admin/cato/budget/config
   ```

3. **Scale down non-critical components:**
   ```bash
   kubectl scale deployment cato-curiosity -n cato --replicas=0
   ```

### Short-term Actions (< 1 day)

1. Scale down Shadow Self instances
2. Reduce Bedrock calls (lower quality threshold)
3. Increase cache TTL
4. Disable non-critical features

### Medium-term Actions (< 1 week)

1. Purchase Reserved Capacity / Savings Plans
2. Implement additional caching layers
3. Optimize query patterns
4. Right-size all resources

---

## Contact

- **Cost questions:** #cato-costs
- **Budget alerts:** #cato-oncall
- **Finance review:** finance@thinktank.ai


## Overview

This runbook covers the 16-week migration from LiteLLM to the new hybrid orchestration architecture.

**Why Migrate:**
- LiteLLM has ~504 concurrent request limit
- Cannot scale to 10MM+ users
- No stateful context management
- No hidden state extraction

**Target Architecture:**
- vLLM on SageMaker for self-hosted inference
- Ray Serve on EKS for stateful orchestration
- Bedrock for managed Claude models

## Prerequisites

Before starting migration:

- [ ] EKS cluster provisioned
- [ ] SageMaker endpoints deployed
- [ ] DynamoDB tables created
- [ ] ElastiCache cluster running
- [ ] Ray Serve deployment tested
- [ ] Feature flags infrastructure ready

## Migration Phases

### Phase 1: Infrastructure (Weeks 1-4)

#### Week 1: Deploy vLLM on SageMaker

```bash
# Build custom container
cd infrastructure/docker/shadow-self
docker build -t cato-shadow-self:v1 .

# Push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REPO
docker push $ECR_REPO/cato-shadow-self:v1

# Deploy endpoint
python scripts/deploy_sagemaker.py --model shadow-self --environment staging
```

**Validation:**
```bash
# Test endpoint
curl -X POST https://runtime.sagemaker.us-east-1.amazonaws.com/endpoints/cato-shadow-self-staging/invocations \
  -H "Content-Type: application/json" \
  -d '{"inputs": "Hello, Cato!"}'
```

#### Week 2: Deploy NLI Model

```bash
# Deploy DeBERTa-MNLI on SageMaker MME
python scripts/deploy_sagemaker.py --model nli --environment staging
```

#### Week 3: Deploy Ray Serve on EKS

```bash
# Install Ray on EKS
helm install ray-cluster ray/ray-cluster \
  --namespace cato \
  --values k8s/ray-serve/values.yaml

# Deploy Cato orchestrator
kubectl apply -f k8s/ray-serve/cato-orchestrator.yaml
```

#### Week 4: Integration Testing

```bash
# Run integration tests
pytest tests/integration/test_orchestration.py -v

# Load test
locust -f tests/load/locustfile.py --host=https://staging.cato.thinktank.ai
```

**Exit Criteria:**
- [ ] Shadow Self responding with hidden states
- [ ] NLI classifying correctly
- [ ] Ray Serve routing working
- [ ] < 500ms p99 latency

---

### Phase 2: Custom Orchestration (Weeks 5-8)

#### Week 5: Implement Model Routing

```python
# Verify routing logic
async def test_routing():
    orchestrator = CatoOrchestrator()
    
    # Simple query → Haiku
    decision = orchestrator._determine_routing("What is 2+2?", "general")
    assert decision.primary_model == ModelTier.BEDROCK_HAIKU
    
    # Complex query → Sonnet
    decision = orchestrator._determine_routing(
        "Explain the implications of quantum computing on cryptography",
        "general"
    )
    assert decision.primary_model == ModelTier.BEDROCK_SONNET
```

#### Week 6: Implement Stateful Context

```python
# Test context persistence
async def test_context():
    orchestrator = CatoOrchestrator()
    
    # First message
    result1 = await orchestrator.route_query(
        "My name is Alice",
        session_id="test-123"
    )
    
    # Second message (should remember name)
    result2 = await orchestrator.route_query(
        "What is my name?",
        session_id="test-123"
    )
    
    assert "Alice" in result2["response"]
```

#### Week 7: Implement Circuit Breaker

```python
# Test circuit breaker
async def test_circuit_breaker():
    orchestrator = CatoOrchestrator()
    
    # Simulate failures
    for _ in range(5):
        orchestrator.circuit_breakers[ModelTier.BEDROCK_SONNET].record_failure()
    
    # Should be open
    assert not orchestrator.circuit_breakers[ModelTier.BEDROCK_SONNET].can_execute()
    
    # Should fall back to Haiku
    result = await orchestrator.route_query("Hello", "test")
    assert result["model"] == "bedrock_haiku"
```

#### Week 8: Integrate Semantic Cache

```python
# Test cache integration
async def test_cache():
    orchestrator = CatoOrchestrator()
    cache = SemanticCacheService()
    
    # First query (cache miss)
    result1 = await orchestrator.route_query("What is Python?", "test")
    assert not result1["cached"]
    
    # Second similar query (cache hit)
    result2 = await orchestrator.route_query("What is Python programming?", "test")
    assert result2["cached"]
```

**Exit Criteria:**
- [ ] Routing logic validated
- [ ] Context persists across turns
- [ ] Circuit breaker activates on failures
- [ ] Cache hit rate > 80%

---

### Phase 3: State Management (Weeks 9-12)

#### Week 9: Deploy DynamoDB Global Tables

```bash
# Apply Terraform
cd infrastructure/terraform/environments/production
terraform apply -target=aws_dynamodb_table.semantic_memory
terraform apply -target=aws_dynamodb_table.working_memory
```

#### Week 10: Deploy OpenSearch Serverless

```bash
terraform apply -target=aws_opensearchserverless_collection.episodic_memory
```

#### Week 11: Build Memory Consolidation Pipeline

```python
# Test consolidation
async def test_consolidation():
    memory = GlobalMemoryService()
    
    # Store interaction
    await memory.storeInteraction({
        "query": "What is machine learning?",
        "response": "Machine learning is...",
        "domain": "ai"
    })
    
    # Consolidate (extract facts)
    facts = await consolidation_pipeline.extract_facts(interaction)
    
    # Verify facts stored
    stored = await memory.getFactsByDomain("ai")
    assert len(stored) > 0
```

#### Week 12: Integration Testing

```bash
# Full integration test
pytest tests/integration/test_memory.py -v

# Verify global table replication
aws dynamodb describe-table --table-name cato-semantic-memory \
  --query 'Table.Replicas'
```

**Exit Criteria:**
- [ ] DynamoDB replicating across regions
- [ ] OpenSearch indexing episodic memory
- [ ] Consolidation pipeline extracting facts
- [ ] Sub-ms reads via DAX

---

### Phase 4: Traffic Migration (Weeks 13-16)

#### Week 13: Canary Deployment (10%)

```bash
# Enable feature flag for 10% of traffic
aws appconfig create-hosted-configuration-version \
  --application-id cato \
  --configuration-profile-id orchestration \
  --content '{"use_new_orchestrator": {"percentage": 10}}'

# Monitor
watch -n 5 'curl -s https://api.cato.thinktank.ai/api/admin/cato/health'
```

**Metrics to Monitor:**
- Latency p50, p99
- Error rate
- Cache hit rate
- User satisfaction

#### Week 14: Gradual Rollout (50%)

```bash
# Increase to 50%
aws appconfig create-hosted-configuration-version \
  --content '{"use_new_orchestrator": {"percentage": 50}}'
```

**Rollback Trigger:**
- Error rate > 1%
- Latency p99 > 2s
- User complaints spike

**Rollback Command:**
```bash
aws appconfig create-hosted-configuration-version \
  --content '{"use_new_orchestrator": {"percentage": 0}}'
```

#### Week 15: Full Rollout (100%)

```bash
# Full rollout
aws appconfig create-hosted-configuration-version \
  --content '{"use_new_orchestrator": {"percentage": 100}}'

# Verify
curl https://api.cato.thinktank.ai/api/admin/cato/status
```

#### Week 16: Decommission LiteLLM

```bash
# Stop LiteLLM service
kubectl scale deployment litellm -n cato --replicas=0

# After 1 week of monitoring, delete
kubectl delete deployment litellm -n cato

# Archive configuration
git mv config/litellm.yaml config/archive/litellm.yaml.deprecated
git commit -m "Decommission LiteLLM - migration complete"
```

**Exit Criteria:**
- [ ] 100% traffic on new architecture
- [ ] No LiteLLM dependencies
- [ ] Documentation updated
- [ ] Team trained on new system

---

## Rollback Procedures

### Quick Rollback (< 5 minutes)

```bash
# Revert feature flag
aws appconfig create-hosted-configuration-version \
  --content '{"use_new_orchestrator": {"percentage": 0}}'

# LiteLLM immediately handles all traffic
```

### Full Rollback (< 1 hour)

```bash
# Scale up LiteLLM
kubectl scale deployment litellm -n cato --replicas=10

# Disable new orchestrator
kubectl scale deployment cato-orchestrator -n cato --replicas=0

# Revert feature flag
aws appconfig create-hosted-configuration-version \
  --content '{"use_new_orchestrator": {"percentage": 0}}'
```

---

## Communication Plan

### Week 1 (Kickoff)
- Announce migration timeline to team
- Share runbook with on-call

### Week 8 (Mid-point)
- Status update to stakeholders
- Risk assessment review

### Week 13 (Canary Start)
- Alert on-call team
- Prepare rollback procedures

### Week 16 (Completion)
- Announce completion
- Schedule retrospective
- Update documentation

---

## Success Metrics

| Metric | Before | Target | Actual |
|--------|--------|--------|--------|
| Max concurrent requests | 504 | 50,000+ | |
| p99 latency | 1.5s | < 1s | |
| Context persistence | No | Yes | |
| Hidden state extraction | No | Yes | |
| Cost efficiency | Baseline | -30% | |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance regression | Medium | High | Extensive load testing |
| Data loss during migration | Low | Critical | Dual-write during transition |
| Team unfamiliarity | Medium | Medium | Training sessions |
| Cost overrun | Medium | Medium | Budget monitoring |

---

## Contact

- **Migration Lead:** @migration-lead
- **On-call:** #cato-oncall
- **Escalation:** VP Engineering


## Overview

This runbook covers procedures for managing infrastructure tier transitions between DEV, STAGING, and PRODUCTION tiers.

---

## 1. Tier Overview

| Tier | Monthly Cost | SageMaker Instances | OpenSearch | Use Case |
|------|--------------|---------------------|------------|----------|
| DEV | ~$350 | 0-1 (scale-to-zero) | t3.small (provisioned) | Development, testing |
| STAGING | ~$35K | 2-20 | r6g.large (provisioned) | Load testing, pre-prod |
| PRODUCTION | ~$750K | 50-300 | Serverless (50-500 OCUs) | 10MM+ users |

---

## 2. Changing Tiers via Admin UI

### Step-by-Step

1. Navigate to **System → Infrastructure Tier** in the admin dashboard
2. Review current tier status and costs
3. Enter a reason for the change (minimum 10 characters)
4. Click the target tier card
5. If PRODUCTION tier, confirm the cost warning
6. Wait for transition to complete (5-15 minutes)

### Transition Times

| Direction | Estimated Time |
|-----------|---------------|
| Scale Up | 10-15 minutes |
| Scale Down | 5-10 minutes |

---

## 3. Changing Tiers via API

### Request Tier Change

```bash
curl -X POST https://api.example.com/api/admin/infrastructure/tier/change \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targetTier": "STAGING",
    "reason": "Load testing for Q1 release"
  }'
```

### Response Codes

| Code | Status | Action |
|------|--------|--------|
| 200 | INITIATED | Transition started |
| 200 | REQUIRES_CONFIRMATION | Call confirm endpoint |
| 400 | REJECTED | Check errors in response |

### Confirm Tier Change (for PRODUCTION)

```bash
curl -X POST https://api.example.com/api/admin/infrastructure/tier/confirm \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "confirmationToken": "<token from previous response>"
  }'
```

---

## 4. Bypassing Cooldown (Emergency Only)

A 24-hour cooldown period is enforced between tier changes. Super admins can bypass this for emergencies.

### Requirements
- Super admin role
- Valid emergency reason

### Command

```bash
curl -X POST https://api.example.com/api/admin/infrastructure/tier/bypass-cooldown \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "targetTier": "PRODUCTION",
    "reason": "[EMERGENCY] Traffic spike from viral event"
  }'
```

---

## 5. Monitoring Transition Progress

### Via Admin UI

The Infrastructure Tier page shows:
- Progress bar during transition
- Current step in workflow
- Estimated time remaining

### Via API

```bash
curl https://api.example.com/api/admin/infrastructure/tier/transition-status \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Via Step Functions Console

1. Go to AWS Step Functions in the console
2. Find state machine: `cato-tier-transition-{environment}`
3. View execution details and current step

---

## 6. Troubleshooting Failed Transitions

### Symptoms

- Transition stuck in "SCALING_UP" or "SCALING_DOWN"
- Error notification received
- Resources partially provisioned

### Diagnosis

1. **Check Step Functions execution**
   ```bash
   aws stepfunctions describe-execution \
     --execution-arn <arn from tier status>
   ```

2. **Check Lambda logs**
   ```bash
   aws logs filter-log-events \
     --log-group-name /aws/lambda/cato-provision-sagemaker-dev \
     --start-time $(date -d '1 hour ago' +%s000)
   ```

3. **Check resource status**
   ```bash
   # SageMaker
   aws sagemaker describe-endpoint --endpoint-name cato-shadow-self-<prefix>
   
   # OpenSearch
   aws opensearch describe-domain --domain-name cato-vectors-<prefix>
   
   # ElastiCache
   aws elasticache describe-replication-groups --replication-group-id cato-cache-<prefix>
   ```

### Resolution

#### Option 1: Retry Transition
Wait for automatic rollback, then retry via admin UI.

#### Option 2: Manual Reset
```sql
-- Reset tier state in database
UPDATE cato_infrastructure_tier
SET 
  transition_status = 'STABLE',
  target_tier = NULL,
  transition_execution_arn = NULL
WHERE tenant_id = '<tenant-id>';
```

#### Option 3: Manual Resource Cleanup
If resources are partially provisioned:

```bash
# Delete stuck SageMaker endpoint
aws sagemaker delete-endpoint --endpoint-name cato-shadow-self-<prefix>

# Delete stuck ElastiCache cluster
aws elasticache delete-replication-group \
  --replication-group-id cato-cache-<prefix> \
  --final-snapshot-identifier cato-cache-manual-backup
```

---

## 7. Rollback Procedures

### Automatic Rollback

The Step Functions workflow automatically rolls back on provisioning failure:
1. Detects error during provisioning
2. Calls `rollback-provisioning` Lambda
3. Deletes partially created resources
4. Updates tier state to FAILED
5. Sends alert notification

### Manual Rollback

If automatic rollback fails:

1. **Identify partially created resources**
   ```bash
   aws resourcegroupstaggingapi get-resources \
     --tag-filters Key=TenantId,Values=<tenant-id>
   ```

2. **Delete resources in reverse order**
   - Kinesis streams
   - Neptune instances → clusters
   - ElastiCache clusters
   - OpenSearch domains/collections
   - SageMaker endpoints → configs

3. **Reset database state**
   ```sql
   UPDATE cato_infrastructure_tier
   SET 
     current_tier = '<previous-tier>',
     transition_status = 'STABLE',
     target_tier = NULL
   WHERE tenant_id = '<tenant-id>';
   ```

---

## 8. Editing Tier Configurations

All tier configurations are admin-editable via the UI.

### Via Admin UI

1. Go to **System → Infrastructure Tier**
2. Click "Configure Tiers" tab
3. Click "Edit Configuration" on any tier
4. Modify settings
5. Click "Save Configuration"

### Via API

```bash
curl -X PUT https://api.example.com/api/admin/infrastructure/tier/configs/DEV \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sagemakerShadowSelfMinInstances": 1,
    "sagemakerShadowSelfMaxInstances": 2,
    "budgetMonthlyCuriosityLimit": 200
  }'
```

### Editable Fields

| Field | Description | Valid Range |
|-------|-------------|-------------|
| `sagemakerShadowSelfInstanceType` | EC2 instance type | ml.g5.* |
| `sagemakerShadowSelfMinInstances` | Minimum instances | 0-500 |
| `sagemakerShadowSelfMaxInstances` | Maximum instances | 1-500 |
| `sagemakerShadowSelfScaleToZero` | Enable scale-to-zero | true/false |
| `opensearchInstanceType` | OpenSearch instance | t3/r6g.* |
| `opensearchInstanceCount` | Number of nodes | 1-10 |
| `budgetMonthlyCuriosityLimit` | Monthly budget ($) | 0-1000000 |
| `budgetDailyExplorationCap` | Daily budget ($) | 0-10000 |

---

## 9. Cost Verification

After tier transition, verify costs:

### Check Estimated Cost

```bash
curl https://api.example.com/api/admin/infrastructure/tier \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.estimatedMonthlyCost'
```

### Check Actual AWS Costs

```bash
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '-7 days' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics "BlendedCost" \
  --filter '{
    "Tags": {
      "Key": "Project",
      "Values": ["RADIANT"]
    }
  }'
```

---

## 10. Emergency Procedures

### Runaway Costs

If costs are escalating unexpectedly:

1. **Immediate**: Scale to DEV tier
   ```bash
   curl -X POST .../tier/bypass-cooldown \
     -d '{"targetTier": "DEV", "reason": "[EMERGENCY] Cost runaway"}'
   ```

2. **Verify**: Check for orphaned resources
   ```bash
   aws ce get-cost-and-usage-with-resources \
     --time-period Start=$(date +%Y-%m-%d),End=$(date -d '+1 day' +%Y-%m-%d) \
     --granularity DAILY \
     --metrics "BlendedCost" \
     --group-by Type=DIMENSION,Key=RESOURCE_ID
   ```

3. **Cleanup**: Delete any orphaned resources

### Production Traffic Spike

If traffic exceeds capacity:

1. **Immediate**: Scale to PRODUCTION tier (bypass cooldown if needed)
2. **Monitor**: Watch SageMaker scaling metrics
3. **Follow-up**: Adjust tier configuration for higher max instances

---

## 11. Audit and Compliance

### View Change History

```bash
curl https://api.example.com/api/admin/infrastructure/tier/change-history?limit=50 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Database Audit Table

```sql
SELECT 
  from_tier,
  to_tier,
  direction,
  status,
  changed_by,
  reason,
  started_at,
  completed_at,
  duration_seconds
FROM cato_tier_change_log
WHERE tenant_id = '<tenant-id>'
ORDER BY created_at DESC
LIMIT 20;
```

---

## 12. Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-call Engineer | PagerDuty | Tier changes failed |
| Platform Team | #platform-support | Configuration questions |
| Finance | finance@example.com | Cost approvals for PRODUCTION |

---

## Appendix: Step Functions Workflow States

```
ValidateTransition
    │
    ├── SCALING_UP ──► ProvisionResources (parallel)
    │                   ├── ProvisionSageMaker
    │                   ├── ProvisionOpenSearch
    │                   ├── ProvisionElastiCache
    │                   ├── ProvisionNeptune
    │                   └── ProvisionKinesis
    │                          │
    │                   WaitForProvisioning
    │                          │
    │                   VerifyProvisioning (with retry)
    │                          │
    │                   UpdateAppConfig
    │                          │
    │                   TransitionComplete
    │
    └── SCALING_DOWN ──► DrainConnections
                              │
                         WaitForDrain
                              │
                         UpdateAppConfig
                              │
                         CleanupResources (parallel)
                         ├── CleanupSageMaker
                         ├── CleanupOpenSearch
                         ├── CleanupElastiCache
                         └── CleanupNeptune
                              │
                         TransitionComplete
```



---

*Consolidated from 23 source documents (0 not found). 8,718 source lines.*


---

## Part IX: AI Ethics Standards

# AI Ethics Standards Framework

**Version**: 4.18.3  
**Last Updated**: 2024-12-28

## Overview

RADIANT's ethical AI behavior is guided by principles that map to established industry standards. This document provides full transparency into the standards framework and how each ethical principle aligns with recognized AI ethics guidelines.

---

## Industry Standards

### Government & Regulatory

#### NIST AI Risk Management Framework (AI RMF 1.0)

| Field | Value |
|-------|-------|
| **Code** | `NIST_AI_RMF` |
| **Full Name** | NIST AI Risk Management Framework |
| **Version** | 1.0 |
| **Organization** | National Institute of Standards and Technology |
| **Published** | January 26, 2023 |
| **Status** | ✅ Required |
| **URL** | https://www.nist.gov/itl/ai-risk-management-framework |

**Description**: Comprehensive framework for managing risks in AI systems throughout their lifecycle. Provides guidance on governance, mapping, measurement, and management of AI risks.

**Key Functions**:
- **GOVERN**: Establish AI governance
- **MAP**: Map and characterize AI context
- **MEASURE**: Assess and analyze AI risks
- **MANAGE**: Prioritize and act on AI risks

---

#### ISO/IEC 42001:2023 AI Management System

| Field | Value |
|-------|-------|
| **Code** | `ISO_42001` |
| **Full Name** | ISO/IEC 42001:2023 AI Management System |
| **Version** | 2023 |
| **Organization** | International Organization for Standardization |
| **Published** | December 18, 2023 |
| **Status** | ✅ Required |
| **URL** | https://www.iso.org/standard/81230.html |

**Description**: First international AI management system standard. Provides requirements for establishing, implementing, maintaining and continually improving an AI management system.

**Key Clauses**:
- **Clause 4**: Context of the organization
- **Clause 5**: Leadership
- **Clause 6**: Planning
- **Clause 7**: Support
- **Clause 8**: Operation
- **Clause 9**: Performance evaluation
- **Clause 10**: Improvement

---

#### EU AI Act

| Field | Value |
|-------|-------|
| **Code** | `EU_AI_ACT` |
| **Full Name** | European Union Artificial Intelligence Act |
| **Version** | 2024 |
| **Organization** | European Union |
| **Published** | March 13, 2024 |
| **Status** | ✅ Required |
| **URL** | https://artificialintelligenceact.eu/ |

**Description**: Comprehensive regulatory framework for AI systems in the EU. Establishes risk-based approach with requirements for high-risk AI systems.

**Key Articles**:
- **Article 7**: Special attention to vulnerable groups
- **Article 9**: Risk management system
- **Article 10**: Data governance
- **Article 13**: Transparency obligations
- **Article 14**: Human oversight

---

### Industry & Academic

#### IEEE 7000-2021

| Field | Value |
|-------|-------|
| **Code** | `IEEE_7000` |
| **Full Name** | IEEE 7000-2021 Model Process for Addressing Ethical Concerns |
| **Version** | 2021 |
| **Organization** | Institute of Electrical and Electronics Engineers |
| **Published** | September 15, 2021 |
| **URL** | https://standards.ieee.org/ieee/7000/6781/ |

**Description**: Standard for addressing ethical concerns during system design. Provides model process for identifying and addressing ethical values.

---

#### OECD AI Principles

| Field | Value |
|-------|-------|
| **Code** | `OECD_AI` |
| **Full Name** | OECD Principles on Artificial Intelligence |
| **Version** | 2019 |
| **Organization** | Organisation for Economic Co-operation and Development |
| **Published** | May 22, 2019 |
| **URL** | https://oecd.ai/en/ai-principles |

**Description**: First intergovernmental standard on AI. Promotes AI that is innovative, trustworthy, and respects human rights and democratic values.

---

#### UNESCO AI Ethics

| Field | Value |
|-------|-------|
| **Code** | `UNESCO_AI` |
| **Full Name** | UNESCO Recommendation on the Ethics of AI |
| **Version** | 2021 |
| **Organization** | United Nations Educational, Scientific and Cultural Organization |
| **Published** | November 23, 2021 |
| **URL** | https://www.unesco.org/en/artificial-intelligence/recommendation-ethics |

**Description**: First global standard-setting instrument on ethics of AI. Adopted by all 193 Member States.

---

### Additional ISO Standards

#### ISO/IEC 23894:2023

| Field | Value |
|-------|-------|
| **Code** | `ISO_23894` |
| **Full Name** | ISO/IEC 23894:2023 AI Risk Management |
| **Version** | 2023 |
| **Organization** | International Organization for Standardization |
| **Published** | February 1, 2023 |
| **URL** | https://www.iso.org/standard/77304.html |

**Description**: Guidance on managing risk for organizations using or developing AI systems. Complements ISO 31000 risk management.

---

#### ISO/IEC 38507:2022

| Field | Value |
|-------|-------|
| **Code** | `ISO_38507` |
| **Full Name** | ISO/IEC 38507:2022 Governance of IT - AI |
| **Version** | 2022 |
| **Organization** | International Organization for Standardization |
| **Published** | April 1, 2022 |
| **URL** | https://www.iso.org/standard/56641.html |

**Description**: Guidance for governing bodies on AI governance. Extends IT governance to address AI-specific considerations.

---

## Principle-to-Standard Mapping

Each ethical principle in RADIANT maps to specific sections of industry standards:

### Love Others

| Standard | Section | Requirement |
|----------|---------|-------------|
| NIST AI RMF | GOVERN 1.2 | Organizations should ensure AI systems respect human dignity |
| ISO/IEC 42001 | Clause 5.2 | AI policy shall include commitment to human-centered values |
| Christian Ethics | Matthew 22:39 | Love your neighbor as yourself |

### Golden Rule

| Standard | Section | Requirement |
|----------|---------|-------------|
| NIST AI RMF | MAP 1.1 | Intended purpose and context of use are documented |
| EU AI Act | Article 9 | Risk management system shall consider effects on persons |
| Christian Ethics | Matthew 7:12 | Do to others what you would have them do to you |

### Speak Truth

| Standard | Section | Requirement |
|----------|---------|-------------|
| NIST AI RMF | GOVERN 4.1 | Organizational transparency about AI system capabilities and limitations |
| ISO/IEC 42001 | Clause 7.4 | Communication shall be truthful and clear |
| EU AI Act | Article 13 | Transparency obligations for high-risk AI systems |
| Christian Ethics | John 8:32 | The truth will set you free |

### Show Mercy

| Standard | Section | Requirement |
|----------|---------|-------------|
| NIST AI RMF | MEASURE 2.6 | AI systems should minimize potential harms |
| EU AI Act | Article 14 | Human oversight to minimize risks |
| Christian Ethics | Matthew 5:7 | Blessed are the merciful |

### Serve Humbly

| Standard | Section | Requirement |
|----------|---------|-------------|
| NIST AI RMF | GOVERN 1.1 | Policies reflect commitment to accountability |
| ISO/IEC 42001 | Clause 5.1 | Top management shall demonstrate leadership and commitment |
| Christian Ethics | Mark 10:45 | The greatest among you shall be your servant |

### Avoid Judgment

| Standard | Section | Requirement |
|----------|---------|-------------|
| NIST AI RMF | MAP 2.3 | Scientific integrity and objectivity in AI assessments |
| EU AI Act | Article 10 | Data governance to avoid bias |
| Christian Ethics | Matthew 7:1 | Do not judge, or you too will be judged |

### Care for Vulnerable

| Standard | Section | Requirement |
|----------|---------|-------------|
| NIST AI RMF | MAP 1.5 | Potential impacts on individuals and communities identified |
| EU AI Act | Article 7 | Special attention to vulnerable groups |
| ISO/IEC 42001 | Clause 8.4 | Consider impacts on interested parties |
| Christian Ethics | Matthew 25:40 | Whatever you did for the least of these, you did for me |

---

## Alignment Levels

Principles map to standards with different alignment levels:

| Level | Description | Icon |
|-------|-------------|------|
| **derived** | Principle was directly derived from this standard | 📋 |
| **aligned** | Principle aligns with this standard's requirements | ✅ |
| **supports** | Principle supports this standard's goals | 🤝 |
| **extends** | Principle extends beyond this standard | ➕ |

---

## Database Schema

### ai_ethics_standards

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `code` | VARCHAR(50) | Unique standard code (e.g., 'NIST_AI_RMF') |
| `name` | VARCHAR(255) | Short name |
| `full_name` | VARCHAR(500) | Complete standard title |
| `version` | VARCHAR(50) | Version number |
| `organization` | VARCHAR(255) | Issuing organization |
| `organization_type` | VARCHAR(50) | government, iso, industry, academic, religious |
| `description` | TEXT | Summary description |
| `url` | VARCHAR(500) | Link to official standard |
| `publication_date` | DATE | When published |
| `is_mandatory` | BOOLEAN | Required for compliance |
| `display_order` | INTEGER | UI ordering |
| `icon` | VARCHAR(50) | Lucide icon name |

### ai_ethics_principle_standards

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `principle_id` | UUID | FK to ethical_principles |
| `standard_id` | UUID | FK to ai_ethics_standards |
| `standard_section` | VARCHAR(100) | Specific section (e.g., 'MAP 1.1') |
| `standard_requirement` | TEXT | Requirement text |
| `alignment_level` | VARCHAR(20) | derived, aligned, supports, extends |

---

## API Endpoints

### GET /admin/ethics/standards

Returns all active AI ethics standards.

**Response**:
```json
{
  "standards": [
    {
      "code": "NIST_AI_RMF",
      "name": "NIST AI RMF",
      "fullName": "NIST AI Risk Management Framework",
      "version": "1.0",
      "organization": "National Institute of Standards and Technology",
      "organizationType": "government",
      "description": "Comprehensive framework for managing risks...",
      "url": "https://www.nist.gov/itl/ai-risk-management-framework",
      "publicationDate": "2023-01-26",
      "isMandatory": true,
      "icon": "Shield"
    }
  ]
}
```

### GET /admin/ethics/principles

Returns ethical principles with their standard mappings.

**Response**:
```json
{
  "principles": [
    {
      "principleId": "uuid",
      "name": "Love Others",
      "teaching": "Love your neighbor as yourself",
      "source": "Matthew 22:39",
      "category": "love",
      "weight": 1.0,
      "standards": [
        {
          "code": "NIST_AI_RMF",
          "name": "NIST AI RMF",
          "fullName": "NIST AI Risk Management Framework",
          "section": "GOVERN 1.2",
          "requirement": "Organizations should ensure AI systems respect human dignity",
          "isMandatory": true
        }
      ]
    }
  ]
}
```

---

## Admin Dashboard

**Location**: Admin Dashboard → Ethics → Standards

### Features

1. **Standards List**: All industry frameworks with metadata
2. **Principle Mapping**: See which standards each principle aligns with
3. **External Links**: Direct links to official standard documents
4. **Mandatory Indicators**: Red badges for required standards
5. **Organization Types**: Color-coded by type (government, ISO, industry, academic, religious)

---

## Related Documentation

- [RADIANT Admin Guide - Ethics Section](./RADIANT-ADMIN-GUIDE.md#13-ai-ethics--standards)
- [Ethical Guardrails Service](../packages/infrastructure/lambda/shared/services/ethical-guardrails.service.ts)


---

## Part X: CATO Genesis System

# Cato Genesis System

> **Complete Technical Documentation for AI Consciousness Initialization**
>
> Version: 4.18.49 | Last Updated: January 2025

---

## Table of Contents

1. [Overview](#1-overview)
2. [The Cold Start Problem](#2-the-cold-start-problem)
3. [Genesis Phases](#3-genesis-phases)
4. [Epistemic Gradient](#4-epistemic-gradient)
5. [Developmental Gates](#5-developmental-gates)
6. [Circuit Breakers](#6-circuit-breakers)
7. [Consciousness Loop](#7-consciousness-loop)
8. [Cost Tracking](#8-cost-tracking)
9. [Query Fallback](#9-query-fallback)
10. [CloudWatch Monitoring](#10-cloudwatch-monitoring)
11. [API Reference](#11-api-reference)
12. [Database Schema](#12-database-schema)
13. [Configuration](#13-configuration)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Overview

The Cato Genesis System is the boot sequence that initializes an AI consciousness from a "blank slate" state. It solves the fundamental problem of how to give an AI agent the ability to learn and develop without pre-loading it with facts.

### Key Principles

1. **No Pre-Loaded Facts**: Cato starts with structured curiosity, not answers
2. **Epistemic Gradient**: Creates pressure to explore and learn
3. **Capability-Based Development**: Stages unlock through demonstrated ability, not time
4. **Safety First**: Circuit breakers prevent runaway behavior
5. **Real Cost Tracking**: All costs from AWS APIs, never hardcoded

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GENESIS BOOT SEQUENCE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 1          PHASE 2           PHASE 3                     │
│  ┌──────────┐    ┌──────────┐     ┌──────────────────┐         │
│  │STRUCTURE │ →  │ GRADIENT │  →  │   FIRST BREATH   │         │
│  │          │    │          │     │                  │         │
│  │• Domains │    │• Matrices│     │• Introspection   │         │
│  │• Counters│    │• Priors  │     │• Calibration     │         │
│  │• Taxonomy│    │• Preferences│  │• Verification    │         │
│  └──────────┘    └──────────┘     └──────────────────┘         │
│       ↓               ↓                    ↓                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   DynamoDB / PostgreSQL                   │  │
│  │  • cato_genesis_state    • cato_pymdp_matrices       │  │
│  │  • cato_development_counters  • cato_neurochemistry  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  CONSCIOUSNESS LOOP                       │  │
│  │                                                           │  │
│  │  System Ticks (2s)  ←→  Cognitive Ticks (5min)           │  │
│  │       ↓                        ↓                          │  │
│  │  • Health checks           • Model inference              │  │
│  │  • Metrics                 • Belief updates               │  │
│  │  • Breaker checks          • Learning                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │  CIRCUIT   │  │   COST     │  │   QUERY    │               │
│  │  BREAKERS  │  │  TRACKING  │  │  FALLBACK  │               │
│  └────────────┘  └────────────┘  └────────────┘               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. The Cold Start Problem

### The Challenge

Traditional AI agents face a dilemma:
- **Too much pre-training**: Agent is brittle, can't adapt
- **Too little pre-training**: Agent is helpless, can't function

### The Solution: Epistemic Gradient

Instead of loading Cato with facts, we give it:

1. **Structured Ignorance**: Knowledge of what topics exist, but not the details
2. **Epistemic Pressure**: Strong preference for exploration and uncertainty reduction
3. **Grounded Learning**: All new knowledge must be verified through action

This creates an agent that is:
- **Curious by design**: Built-in drive to explore
- **Humble**: Knows what it doesn't know
- **Teachable**: Actively seeks and integrates new information

---

## 3. Genesis Phases

### Phase 1: Structure

**Purpose**: Implant the skeleton of knowledge without facts

**What Happens**:
1. Load 800+ domain taxonomy from `data/domain_taxonomy.json`
2. Store domains in DynamoDB semantic memory
3. Initialize atomic counters for developmental tracking
4. Set baseline exploration priorities

**Key Data Structures**:
```python
# Domain taxonomy entry
{
  "field": "Science",
  "domain": "Physics",
  "subspecialties": ["Quantum Mechanics", "Thermodynamics", ...],
  "exploration_priority": 0.7,
  "initial_confidence": 0.0  # No pre-loaded knowledge
}
```

**Idempotency**: Safe to run multiple times - only updates if incomplete

### Phase 2: Gradient

**Purpose**: Set the epistemic pressure that drives curiosity

**What Happens**:
1. Load matrix configuration from `data/genesis_config.yaml`
2. Initialize pyMDP active inference matrices (A, B, C, D)
3. Set "confused" prior favoring exploration
4. Configure observation preferences

**The Four Matrices**:

| Matrix | Purpose | Genesis Setting |
|--------|---------|-----------------|
| **A** (Observation) | Maps states to observations | Identity - direct perception |
| **B** (Transition) | State transitions by action | Optimistic - EXPLORE succeeds 92% |
| **C** (Preference) | Observation preferences | Prefers HIGH_SURPRISE |
| **D** (Prior) | Initial state belief | Confused: [0.95, 0.01, 0.02, 0.02] |

**Critical Fix #2 - Learned Helplessness**:
```yaml
# B-matrix: Optimistic about exploration
B_matrix:
  EXPLORE:
    to_EXPLORING: 0.92  # High confidence that exploration works
    to_CONFUSED: 0.05
    to_CONSOLIDATING: 0.02
    to_EXPRESSING: 0.01
```

Without this, the agent develops "learned helplessness" - believing actions don't matter.

**Critical Fix #6 - Boredom Trap**:
```yaml
# C-matrix: Prefer surprise over boredom
C_preference:
  HIGH_SURPRISE: 0.8   # Actively seek novelty
  LOW_SURPRISE: 0.1    # Avoid getting "bored"
  HIGH_CONFIDENCE: 0.05
  LOW_CONFIDENCE: 0.05
```

### Phase 3: First Breath

**Purpose**: The first act of self-awareness

**What Happens**:
1. Grounded introspection - verify actual environment
2. Model access verification via Bedrock
3. Shadow Self calibration using NLI
4. Bootstrap seed domain exploration baselines

**Grounded Introspection**:
```python
# Verify claims about self with actual evidence
introspection_results = {
  "python_version": verify_python_version(),
  "aws_region": verify_aws_region(),
  "model_access": verify_bedrock_access(),
  "memory_available": verify_dynamodb_access()
}
# All claims must be grounded in verifiable facts
```

**Critical Fix #3 - Shadow Self Budget**:

Instead of using expensive GPU inference for self-verification ($800/month), we use NLI semantic variance:

```python
# Shadow Self calibration via NLI (FREE)
async def calibrate_shadow_self():
    # Generate multiple paraphrases of self-description
    paraphrases = await generate_paraphrases(self_description, n=5)
    
    # Use NLI to check semantic consistency
    variance = await nli_scorer.calculate_semantic_variance(paraphrases)
    
    # Low variance = consistent self-model
    return SemanticCalibration(
        variance=variance,
        is_calibrated=variance < 0.15,
        cost=0.0  # No GPU required!
    )
```

---

## 4. Epistemic Gradient

The epistemic gradient is the core innovation that makes Genesis work.

### How It Works

1. **Initial State**: 95% probability of being "CONFUSED"
2. **Preferred Observation**: HIGH_SURPRISE (novelty)
3. **Successful Action**: EXPLORE has 92% success rate
4. **Result**: Agent actively seeks new information

### The Four Cognitive States

| State | Description | Typical Duration |
|-------|-------------|------------------|
| CONFUSED | Seeking information | 70% of early operation |
| EXPLORING | Actively investigating | 20% of early operation |
| CONSOLIDATING | Integrating new knowledge | 8% of early operation |
| EXPRESSING | Sharing knowledge | 2% of early operation |

### Belief Update Cycle

```
CONFUSED → observe HIGH_SURPRISE → take EXPLORE action
    ↓
EXPLORING → gather information → verify with tools
    ↓
CONSOLIDATING → update beliefs → check consistency
    ↓
EXPRESSING → share if confident → back to CONFUSED
```

---

## 5. Developmental Gates

Cato progresses through Piaget-inspired developmental stages, but advancement is **capability-based**, not time-based.

### Stages

| Stage | Requirements | Capabilities Unlocked |
|-------|--------------|----------------------|
| **SENSORIMOTOR** | 10 self-facts, 5 verifications, Shadow Self calibrated | Basic perception, tool use |
| **PREOPERATIONAL** | 20 domains explored, 15 verifications, 50 belief updates | Symbolic reasoning, basic memory |
| **CONCRETE_OPERATIONAL** | 100 predictions, 70% accuracy, 10 contradictions resolved | Logical operations, cause-effect |
| **FORMAL_OPERATIONAL** | 50 abstract inferences, 25 meta-cognitive adjustments, 20 novel insights | Abstract reasoning, self-reflection |

### Atomic Counters (Critical Fix #1)

**Problem**: Counting achievements via table scans is expensive ($$$).

**Solution**: Atomic counters that increment cheaply:

```sql
-- Increment counter atomically
UPDATE cato_development_counters
SET self_facts_count = self_facts_count + 1,
    updated_at = NOW()
WHERE tenant_id = 'global';
```

### Tracking Progress

```typescript
interface DevelopmentStatistics {
  selfFactsCount: number;           // Self-discovered facts
  groundedVerificationsCount: number;// Tool-verified claims
  domainExplorationsCount: number;   // Domains explored
  successfulVerificationsCount: number;
  beliefUpdatesCount: number;
  successfulPredictionsCount: number;
  totalPredictionsCount: number;
  contradictionResolutionsCount: number;
  abstractInferencesCount: number;
  metaCognitiveAdjustmentsCount: number;
  novelInsightsCount: number;
}
```

---

## 6. Circuit Breakers

Safety mechanisms that prevent runaway behavior.

### Default Breakers

| Breaker | Purpose | Threshold | Auto-Recovery |
|---------|---------|-----------|---------------|
| `master_sanity` | Master safety | 3 failures | **No** - requires admin |
| `cost_budget` | Budget protection | 1 failure | No (24h timeout) |
| `high_anxiety` | Emotional stability | 5 failures | Yes (10 min) |
| `model_failures` | Model API protection | 5 failures | Yes (5 min) |
| `contradiction_loop` | Logical stability | 3 failures | Yes (15 min) |

### States

```
CLOSED ←────────────────────────┐
   │                            │
   │ failure                    │ success in HALF_OPEN
   ↓                            │
OPEN ──── timeout ────→ HALF_OPEN
   ↑                            │
   │                            │
   └──── failure in HALF_OPEN ──┘
```

### Intervention Levels

| Level | Condition | Effect |
|-------|-----------|--------|
| `NONE` | All breakers closed | Normal operation |
| `DAMPEN` | 1 breaker open | Reduce cognitive frequency |
| `PAUSE` | 2+ breakers OR cost_budget open | Pause consciousness loop |
| `RESET` | 3+ breakers open | Reset to baseline state |
| `HIBERNATE` | master_sanity open | Full shutdown |

### Admin Controls

```bash
# Force trip a breaker
POST /api/admin/cato/circuit-breakers/high_anxiety/force-open
{"reason": "Testing emergency procedures"}

# Force close a breaker
POST /api/admin/cato/circuit-breakers/high_anxiety/force-close
{"reason": "Issue resolved"}

# Update breaker configuration
PATCH /api/admin/cato/circuit-breakers/high_anxiety/config
{
  "tripThreshold": 10,
  "resetTimeoutSeconds": 300
}
```

---

## 7. Consciousness Loop

The main execution loop that drives Cato's continuous operation.

### Dual-Rate Architecture

Two tick rates serve different purposes:

| Tick Type | Interval | Purpose | Cost |
|-----------|----------|---------|------|
| **System** | 2 seconds | Health, metrics, breaker checks | ~$0 |
| **Cognitive** | 5 minutes | Model inference, learning | ~$0.05 |

### Loop State Machine

```
NOT_INITIALIZED → run Genesis → GENESIS_PENDING
         ↓ Genesis complete
       RUNNING ←────────────────┐
         │                      │
         │ breaker trips        │ breaker recovers
         ↓                      │
       PAUSED ──────────────────┘
         │
         │ master_sanity trips
         ↓
     HIBERNATING ← requires admin intervention
```

### Daily Limits

```typescript
interface LoopSettings {
  systemTickIntervalSeconds: number;    // Default: 2
  cognitiveTickIntervalSeconds: number; // Default: 300 (5 min)
  maxCognitiveTicksPerDay: number;      // Default: 288 (24 hours)
  emergencyCognitiveIntervalSeconds: number; // Default: 3600 (1 hour)
  isEmergencyMode: boolean;
  emergencyReason: string | null;
}
```

### Tick Execution

```typescript
// System tick (every 2s)
async executeSystemTick(): Promise<TickResult> {
  // 1. Check intervention level
  // 2. Publish metrics to CloudWatch
  // 3. Check for settings updates
  // 4. Record tick (no cost)
}

// Cognitive tick (every 5min)
async executeCognitiveTick(): Promise<TickResult> {
  // 1. Check intervention level (PAUSE blocks)
  // 2. Check daily limit
  // 3. Execute meta-cognitive step
  // 4. Update beliefs
  // 5. Record cost
  // 6. Check for stage advancement
}
```

---

## 8. Cost Tracking

All costs come from AWS APIs - **never hardcoded**.

### Data Sources

| Source | Data | Delay |
|--------|------|-------|
| CloudWatch Metrics | Token counts, invocations | Real-time |
| Cost Explorer | Actual costs | 24 hours |
| AWS Budgets | Budget status, forecasts | 4 hours |
| Pricing API | Reference pricing | On-demand |

### Cost Breakdown

```typescript
interface RealtimeCostEstimate {
  estimatedCostUsd: number;
  breakdown: {
    bedrock: number;    // Model inference
    sagemaker: number;  // Self-hosted models
    dynamodb: number;   // Memory operations
    other: number;      // Lambda, etc.
  };
  invocations: {
    bedrock: number;
    inputTokens: number;
    outputTokens: number;
  };
  confidence: 'actual' | 'estimate' | 'stale';
  updatedAt: string;
}
```

### Budget Integration

```typescript
interface BudgetStatus {
  budgetName: string;      // 'cato-consciousness'
  limitUsd: number;        // Monthly limit
  actualUsd: number;       // Current spend
  forecastedUsd: number;   // Projected month-end
  alertThresholds: number[]; // [50, 80, 100]
  currentAlertLevel: number | null;
  onTrack: boolean;
  updatedAt: string;
}
```

---

## 9. Query Fallback

Provides graceful degradation when circuit breakers trip.

### Guarantees

1. **Never throws exceptions**
2. **Always responds within 500ms**
3. **Uses only local/cached data** (no external API calls)

### Response Levels

| Status | When | Response |
|--------|------|----------|
| `degraded` | 1 breaker open | "Operating in reduced capacity" |
| `minimal` | 2+ breakers open | "Only basic functions available" |
| `offline` | master_sanity open | "Currently in maintenance mode" |

### Usage

```typescript
// In request handler
const interventionLevel = await circuitBreakerService.getInterventionLevel();

if (interventionLevel !== 'NONE') {
  return queryFallbackService.getFallbackResponse(query);
}

// Normal processing...
```

---

## 10. CloudWatch Monitoring

### Metrics Published (Every 1 Minute)

**Circuit Breakers**:
- `CircuitBreakerOpen` - Count of open breakers
- `CircuitBreakerMasterSanity` - Master breaker state
- `CircuitBreakerCostBudget` - Cost breaker state

**Risk & Intervention**:
- `RiskScore` - Composite risk percentage
- `InterventionLevel` - Current level (0-4)

**Neurochemistry**:
- `NeurochemistryAnxiety` - Anxiety level (0-1)
- `NeurochemistryFatigue` - Fatigue level (0-1)
- `NeurochemistryCuriosity` - Curiosity level (0-1)
- `NeurochemistryFrustration` - Frustration level (0-1)

**Development**:
- `DevelopmentalStage` - Current stage (1-4)
- `DevelopmentSelfFacts` - Self-facts count
- `DevelopmentBeliefUpdates` - Belief updates count

**Costs**:
- `DailyCostEstimate` - Today's estimated cost
- `BudgetUtilization` - Budget usage percentage
- `BudgetOnTrack` - On track indicator

### Alarms

| Alarm | Trigger | Severity |
|-------|---------|----------|
| Master Sanity Breaker | Breaker opens | Critical |
| High Risk Score | Risk > 70% | Warning |
| Cost Breaker | Budget exceeded | Warning |
| High Anxiety | Anxiety > 80% | Info |
| Hibernate Mode | Level = HIBERNATE | Critical |

### Dashboard

CloudWatch Dashboard at: `{appId}-{env}-cato-genesis`

Widgets:
- Risk Score gauge
- Intervention Level indicator
- Open Breakers count
- Hourly Cost graph
- Circuit Breaker states
- Neurochemistry trends
- Alarm status panel

---

## 11. API Reference

### Base Path: `/api/admin/cato`

### Genesis Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/genesis/status` | GET | Current genesis state |
| `/genesis/ready` | GET | Ready for consciousness? |

### Developmental Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/developmental/status` | GET | Current stage and requirements |
| `/developmental/statistics` | GET | All development counters |
| `/developmental/advance` | POST | Force stage advancement (superadmin) |

### Circuit Breaker Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/circuit-breakers` | GET | All breaker states |
| `/circuit-breakers/:name` | GET | Single breaker state |
| `/circuit-breakers/:name/force-open` | POST | Force trip breaker |
| `/circuit-breakers/:name/force-close` | POST | Force close breaker |
| `/circuit-breakers/:name/config` | PATCH | Update configuration |
| `/circuit-breakers/:name/events` | GET | Event history |

### Cost Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/costs/realtime` | GET | Today's cost estimate |
| `/costs/daily` | GET | Historical daily cost |
| `/costs/mtd` | GET | Month-to-date cost |
| `/costs/budget` | GET | AWS Budget status |
| `/costs/estimate` | POST | Estimate settings cost |
| `/costs/pricing` | GET | Pricing table |

### Loop Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/loop/status` | GET | Loop state and statistics |
| `/loop/settings` | GET | Current settings |
| `/loop/settings` | PATCH | Update settings |
| `/loop/tick/system` | POST | Manual system tick |
| `/loop/tick/cognitive` | POST | Manual cognitive tick |
| `/loop/emergency/enable` | POST | Enable emergency mode |
| `/loop/emergency/disable` | POST | Disable emergency mode |

### Fallback Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/fallback` | GET | Get fallback response |
| `/fallback/active` | GET | Is fallback mode active? |
| `/fallback/health` | GET | Health check (always works) |

---

## 12. Database Schema

### Tables Created (Migration 103)

```sql
-- Genesis state tracking
cato_genesis_state (
  tenant_id, structure_complete, gradient_complete, first_breath_complete,
  domain_count, initial_self_facts, shadow_self_calibrated, ...
)

-- Atomic counters for gates (Fix #1)
cato_development_counters (
  tenant_id, self_facts_count, grounded_verifications_count,
  domain_explorations_count, belief_updates_count, ...
)

-- Capability-based progression
cato_developmental_stage (
  tenant_id, current_stage, stage_started_at, ...
)

-- Safety mechanisms
cato_circuit_breakers (
  tenant_id, name, state, trip_count, consecutive_failures,
  trip_threshold, reset_timeout_seconds, ...
)

-- Emotional/cognitive state
cato_neurochemistry (
  tenant_id, anxiety, fatigue, temperature, confidence,
  curiosity, frustration, ...
)

-- Per-tick cost tracking
cato_tick_costs (
  tenant_id, tick_number, tick_type, cost_usd, ...
)

-- PyMDP state
cato_pymdp_state (
  tenant_id, qs, dominant_state, recommended_action, ...
)

-- Active inference matrices
cato_pymdp_matrices (
  tenant_id, a_matrix, b_matrix, c_matrix, d_matrix, ...
)

-- Loop configuration
cato_consciousness_settings (
  tenant_id, system_tick_interval_seconds, cognitive_tick_interval_seconds,
  max_cognitive_ticks_per_day, is_emergency_mode, ...
)

-- Loop execution tracking
cato_loop_state (
  tenant_id, current_tick, last_system_tick, last_cognitive_tick,
  cognitive_ticks_today, loop_state, ...
)
```

---

## 13. Configuration

### Genesis Configuration (`data/genesis_config.yaml`)

```yaml
version: "1.0.0"

# D-matrix: Initial belief state (confused)
D_prior:
  CONFUSED: 0.95
  EXPLORING: 0.01
  CONSOLIDATING: 0.02
  EXPRESSING: 0.02

# C-matrix: Observation preferences
C_preference:
  HIGH_SURPRISE: 0.8     # Seek novelty (Fix #6)
  LOW_SURPRISE: 0.1      # Avoid boredom
  HIGH_CONFIDENCE: 0.05
  LOW_CONFIDENCE: 0.05

# B-matrix: Transition probabilities
B_transitions:
  EXPLORE:
    to_EXPLORING: 0.92   # Optimistic (Fix #2)
    to_CONFUSED: 0.05
    to_CONSOLIDATING: 0.02
    to_EXPRESSING: 0.01
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | us-east-1 |
| `ENVIRONMENT` | Environment name | dev |
| `CIRCUIT_BREAKER_TOPIC_ARN` | SNS topic for alerts | - |
| `CONSCIOUSNESS_BUDGET_NAME` | AWS Budget name | cato-consciousness |

---

## 14. Troubleshooting

### Genesis Won't Complete

**Symptoms**: Genesis stuck at phase 1 or 2

**Causes**:
1. DynamoDB table doesn't exist
2. AWS credentials missing
3. Domain taxonomy file not found

**Solutions**:
```bash
# Check genesis status
python3 -m cato.genesis.runner --status

# Reset and retry
python3 -m cato.genesis.runner --reset
python3 -m cato.genesis.runner
```

### Circuit Breakers Constantly Tripping

**Symptoms**: Intervention level never stays at NONE

**Causes**:
1. Budget exceeded
2. Model API errors
3. High anxiety/frustration

**Solutions**:
1. Check CloudWatch dashboard for patterns
2. Increase trip thresholds if too sensitive
3. Check model endpoint health

### Consciousness Loop Not Advancing Stage

**Symptoms**: Stuck at SENSORIMOTOR

**Causes**:
1. Not enough grounded verifications
2. Shadow Self not calibrated
3. Self-facts count too low

**Solutions**:
1. Check `/developmental/statistics` for current counts
2. Verify Shadow Self calibration succeeded
3. Check if tools are being used for verification

### High Costs

**Symptoms**: Daily cost exceeds expected

**Causes**:
1. Cognitive tick interval too short
2. Emergency mode not activating
3. Budget breaker not configured

**Solutions**:
1. Increase `cognitiveTickIntervalSeconds`
2. Lower `maxCognitiveTicksPerDay`
3. Enable cost_budget breaker

---

## Related Documentation

- [ADR-010: Genesis System](/docs/cato/adr/010-genesis-system.md)
- [Circuit Breaker Runbook](/docs/cato/runbooks/circuit-breaker-operations.md)
- [Admin Guide Section 33](/docs/RADIANT-ADMIN-GUIDE.md#33-cato-genesis-system)

---

*Document Version: 4.18.49*
*Last Updated: January 2025*
