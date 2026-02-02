# RADIANT Engineering Implementation & Vision

**Version**: 6.1.0  
**Last Updated**: 2026-02-01  
**Classification**: Internal Engineering Reference

> **POLICY**: All technical architecture, implementation details, and visionary documentation MUST be consolidated in this document. Engineers require comprehensive detail—never abbreviate or summarize to the point of losing implementation specifics. See `/.windsurf/workflows/documentation-consolidation.md` for enforcement.

---

## Table of Contents

1. [Cato Persistent Memory System](#1-cato-persistent-memory-system)
2. [AWS Infrastructure](#2-aws-infrastructure)
3. [Database Architecture](#3-database-architecture)
4. [AI Model Orchestration](#4-ai-model-orchestration)
5. [Lambda Services](#5-lambda-services)
6. [CDK Stack Architecture](#6-cdk-stack-architecture)
7. [Security & Compliance](#7-security--compliance)
8. [Libraries & Dependencies](#8-libraries--dependencies)
9. [AI Report Writer Pro](#9-ai-report-writer-pro-v5420)
10. [Decision Intelligence Artifacts (DIA Engine)](#10-decision-intelligence-artifacts-dia-engine-v5430)
11. [Living Parchment 2029 Vision](#11-living-parchment-2029-vision-v5440)
12. [Cortex Memory System](#12-cortex-memory-system-v4200)
13. [Apple Glass UI Design System](#13-apple-glass-ui-design-system-v5522)
14. [Semantic Blackboard Architecture](#14-semantic-blackboard-architecture-v5524)
15. [Services Layer & Interface-Based Access Control](#15-services-layer--interface-based-access-control-v5525)
16. [Complete Admin API Architecture](#16-complete-admin-api-architecture-v5526)
17. [Liquid Interface - Morphable UI System](#17-liquid-interface---morphable-ui-system-v5528)
18. [OAuth 2.0 Provider & Developer Portal](#18-oauth-20-provider--developer-portal-v55226)
19. [Two-Factor Authentication (MFA)](#19-two-factor-authentication-mfa-v55228)
20. [Internationalization & Multi-Language Search](#20-internationalization--multi-language-search-v55229)
21. [Cato Pipeline Orchestration System](#21-cato-pipeline-orchestration-system-v55254)
22. [Model Registry & Version Discovery System](#22-model-registry--version-discovery-system-v55257)
23. [Universal Envelope Protocol v2.0](#23-universal-envelope-protocol-v20-v5530)
24. [Gemini Workflow Enhancements](#24-gemini-workflow-enhancements-v5530)
25. [Neural Architecture v6.0.0](#25-neural-architecture-v600)
26. [AXIOM Prompt Optimization Pipeline](#26-axiom-prompt-optimization-pipeline-v610)
27. [CLARION Adaptive Questioning System](#27-clarion-adaptive-questioning-system-v610)
28. [UEP Real-Time Event Streaming](#28-uep-real-time-event-streaming-v610)

---

## 1. Cato Persistent Memory System

### 1.1 Overview

Cato operates as the cognitive core of RADIANT's orchestration architecture, implementing a **three-tier hierarchical memory system** that fundamentally differentiates it from competitors suffering from session amnesia. Unlike ChatGPT or Claude standalone—where closing a tab erases all context—Cato maintains persistent memory that survives sessions, employee turnover, and time.

### 1.2 Tenant-Level Memory (Institutional Intelligence)

The primary layer where the most valuable learning accumulates. Every Cato database table enforces **Row-Level Security via `tenant_id`**, ensuring complete isolation between organizations while enabling deep institutional pattern recognition.

#### Neural Network Routing

At this level, a proprietary neural network continuously learns which AI models perform best for specific query types:

| Query Type | Optimal Model | Rationale |
|------------|---------------|-----------|
| Legal analysis | Claude Opus | Doesn't hallucinate physics, citation accuracy |
| Visual reasoning | Gemini | Superior multimodal capabilities |
| Red-team validation | Specialized safety models | Adversarial robustness |
| Code generation | Claude Sonnet / GPT-4 | Structured output quality |

#### Department-Specific Preferences

The system tracks department-specific preferences learned over time:

- **Legal teams**: Aggressive, citation-heavy briefs with formal language
- **Marketing departments**: Conversational copy with brand voice alignment
- **Engineering teams**: Technical precision with code examples
- **Executive communications**: Concise summaries with strategic framing

#### Cost Optimization Patterns

Cost optimization patterns emerge automatically—when Cato notices a $0.50 query could have been handled by a $0.01 approach, it adjusts routing for similar future queries without manual configuration.

**Implementation**: `lambda/shared/services/economic-governor.service.ts`

```typescript
interface CostOptimizationPattern {
  querySignature: string;      // Hash of query characteristics
  originalCost: number;        // Cost of initial expensive route
  optimizedCost: number;       // Cost of discovered cheaper route
  qualityDelta: number;        // Quality difference (-1 to 1)
  confidenceScore: number;     // How confident the optimization is
  applicationCount: number;    // Times this optimization applied
}
```

#### Tenant Configuration

Tenant configuration (`cato_tenant_config`) stores:

| Field | Type | Purpose |
|-------|------|---------|
| `gamma_limits` | JSONB | Epistemic uncertainty thresholds |
| `entropy_thresholds` | JSONB | When to trigger Epistemic Recovery |
| `recovery_settings` | JSONB | Scout mode parameters |
| `feature_flags` | JSONB | Enabled/disabled capabilities |
| `compliance_mode` | ENUM | FDA, HIPAA, SOC2, etc. |

#### Merkle-Hashed Audit Trails

Compliance records maintain **7-year retention** via Merkle-hashed audit trails for:

- **FDA 21 CFR Part 11**: Electronic records and signatures
- **HIPAA**: Protected health information handling
- **SOC 2 Type II**: Security, availability, processing integrity

**Implementation**: `lambda/admin/cato.ts`, `migrations/045_cato_audit_merkle.sql`

### 1.3 User-Level Memory (Relationship Continuity)

Within each tenant, individual users maintain their own memory scope through **Ghost Vectors**—4096-dimensional hidden state vectors that capture the "feel" of each user relationship across sessions.

#### Ghost Vector Architecture

```typescript
interface GhostVector {
  userId: string;
  tenantId: string;
  dimensions: Float32Array;     // 4096-dimensional vector
  interactionCount: number;
  lastUpdated: Date;
  version: number;              // Version-gating for upgrades
  
  // Captured characteristics
  expertiseLevel: number;       // 0-1 detected expertise
  communicationStyle: string;   // formal, casual, technical
  preferredVerbosity: number;   // 0-1 brevity preference
  domainAffinities: Map<string, number>;  // Field expertise
}
```

These vectors persist beyond individual conversations, enabling Cato to genuinely "remember":

- **Interaction style**: Formal vs. casual, verbose vs. concise
- **Expertise level**: Beginner explanations vs. expert shorthand
- **Communication preferences**: Visual learner, prefers examples, wants citations

#### Persona Selection

Users can select preferred operating moods, scoped at system, tenant, or user level:

| Persona | Behavior | Use Case |
|---------|----------|----------|
| **Balanced** | Default equilibrium | General queries |
| **Scout** | Information gathering, exploratory | Research, discovery |
| **Sage** | Deep expertise, authoritative | Complex analysis |
| **Spark** | Creative, generative | Brainstorming, ideation |
| **Guide** | Teaching, step-by-step | Onboarding, learning |

**Database**: `cato_personas`, `user_persona_preferences`

#### Version-Gated Upgrades

Version-gated upgrades ensure model improvements don't cause personality discontinuity—the relationship feel persists even as underlying capabilities evolve.

```sql
-- Ghost vector versioning
ALTER TABLE ghost_vectors ADD COLUMN schema_version INTEGER DEFAULT 1;
ALTER TABLE ghost_vectors ADD COLUMN migration_checkpoint JSONB;
```

### 1.4 Session-Level Memory (Real-Time Context)

The ephemeral layer handles active interaction state through **Redis-backed persistence** that survives ECS container restarts but expires after sessions end.

#### Redis State Management

**CDK Stack**: `CatoRedisStack` (Tier 2+)

```typescript
// Session state structure in Redis
interface CatoSessionState {
  sessionId: string;
  tenantId: string;
  userId: string;
  
  // Governor state
  currentGamma: number;         // Current epistemic uncertainty
  entropyLevel: number;         // Information entropy measure
  recoveryMode: boolean;        // In Epistemic Recovery?
  
  // Temporary overrides
  personaOverride?: string;     // Scout mode during recovery
  modelLock?: string;           // Force specific model
  
  // Safety state
  cbfViolations: number;        // Control Barrier Function violations
  escalationLevel: number;      // Current escalation tier
  
  // TTL
  expiresAt: number;            // Unix timestamp
}
```

#### Control Barrier Functions (CBF)

Real-time safety evaluations that prevent harmful outputs:

```typescript
interface ControlBarrierFunction {
  name: string;
  threshold: number;            // Safety threshold
  currentValue: number;         // Current measured value
  violated: boolean;            // Is threshold exceeded?
  action: 'warn' | 'block' | 'escalate';
}
```

**Implementation**: `lambda/admin/cato.ts` → CBF endpoints

#### Upward Observation Flow

The session layer feeds observations upward:

1. Every interaction contributes to **user-level Ghost Vectors**
2. Ghost Vector patterns feed into **tenant-level learning**
3. Tenant patterns inform **global model performance** (anonymized)

### 1.5 Twilight Dreaming (Offline Learning)

During low-traffic periods (**4 AM tenant local time**), the system consolidates accumulated patterns through **LoRA fine-tuning**.

#### Dreaming Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    TWILIGHT DREAMING                        │
├─────────────────────────────────────────────────────────────┤
│  4 AM Local Time                                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Collect    │───▶│  Prepare     │───▶│   LoRA       │  │
│  │   Learning   │    │   Training   │    │   Fine-tune  │  │
│  │   Candidates │    │   Dataset    │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                   │          │
│         ▼                   ▼                   ▼          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Filter     │    │   JSONL      │    │   Validate   │  │
│  │   Quality    │    │   Format     │    │   Adapter    │  │
│  │   > 0.7      │    │   Upload S3  │    │   Hot-swap   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Implementation**: 
- `lambda/consciousness/evolution-pipeline.ts`
- EventBridge: Weekly Sunday 3 AM trigger
- SageMaker: LoRA training jobs

#### SOFAI Router (System 1/System 2)

The SOFAI Router learns from consolidated patterns, achieving:

- **60%+ cost reduction** vs. always using expensive models
- **Maintained accuracy** through mandatory deep reasoning for healthcare/financial queries
- **Dynamic routing** based on query complexity detection

```typescript
type SOFAIMode = 'system1' | 'system2';

interface SOFAIDecision {
  mode: SOFAIMode;
  confidence: number;
  reasoning: string;
  forcedDeep: boolean;    // Healthcare, financial = always System 2
  costSavings: number;
}
```

### 1.6 Neural Network Optimization Dimensions

The neural network optimizes across three dimensions simultaneously:

| Dimension | Metric | Implementation |
|-----------|--------|----------------|
| **Accuracy** | Correctness of responses | Human feedback, automated eval |
| **Verifiability** | Provable results | Truth Engine ECD scoring |
| **Cost Efficiency** | Cheaper approaches | Economic Governor routing |

#### Truth Engine: Entity-Context Divergence (ECD)

The Truth Engine scores response verifiability:

```typescript
interface ECDScore {
  entityAccuracy: number;       // Named entities correct
  contextAlignment: number;     // Context relevance
  divergenceScore: number;      // How much hallucination detected
  citationCoverage: number;     // Claims with sources
  overallTruthScore: number;    // Composite 0-1
}
```

### 1.7 Claude as Orchestration Conductor

Claude serves as the **conductor** maintaining the persistent memory layer—not just another model in the rotation, but the intelligence coordinating **105+ other specialized models**:

- **Intent interpretation**: Understanding what user actually needs
- **Workflow selection**: Choosing appropriate orchestration mode
- **Model coordination**: Selecting specialist models for subtasks
- **Quality assurance**: Ensuring responses meet accuracy/safety standards
- **Memory integration**: Updating Ghost Vectors and tenant patterns

**Implementation**: `lambda/shared/services/cognitive-router.service.ts`, `lambda/shared/services/model-router.service.ts`

### 1.8 Competitive Moats (Technical Implementation)

#### Persistent Memory as Competitive Moat

Cato's hierarchical memory architecture creates **"contextual gravity"**—compounding switching costs that deepen with every interaction.

**Technical Moat Layers**:

| Layer | Implementation | Migration Barrier |
|-------|----------------|-------------------|
| **Learned Routing Patterns** | `sofai-router.service.ts`, `cognitive-router.service.ts` | Months of production training data; neural network weights cannot be exported |
| **Department Preferences + Ghost Vectors** | `ghost-manager.service.ts`, 4096-dim vectors in `ghost_vectors` table | RLS-isolated per tenant; relationship "feel" encoded in high-dimensional space |
| **Audit Trails** | `cato_audit_log` with Merkle hash chains | Chain-of-custody breaks on export; 7-year retention corpus |

**Competitor Technical Disadvantages**:

| Competitor | Technical Problem |
|------------|-------------------|
| **Flowise/Dify** | No query complexity detection; static DAG execution regardless of cost opportunity |
| **CrewAI** | No shared memory architecture; agents duplicate API calls (O(n) cost explosion) |
| **ChatGPT/Claude** | No tenant-level persistence; user context lives in browser, not infrastructure |

#### Twilight Dreaming as Competitive Moat

**Technical Requirements for Replication**:

| Component | Implementation | Why Competitors Can't Copy |
|-----------|----------------|---------------------------|
| Three-tier memory | `cato_tenant_config`, `ghost_vectors`, Redis session | Requires full architectural rebuild |
| Observation pipeline | Session → User → Tenant upward flow | Needs RLS + isolation + aggregation |
| LoRA fine-tuning | `evolution-pipeline.ts`, SageMaker | Tier 3+ infrastructure; $2K+/mo minimum |
| SOFAI Router training | `sofai-router.service.ts` | Requires months of labeled routing decisions |

**Appreciating Asset Formula**:

```
Deployment_Value(t) = Base_Value + Σ(daily_learning_δ) + Σ(twilight_consolidation_δ)
```

Where `t` = tenure in days. Longer tenure = exponentially more valuable deployment.

**Model Upgrade Path**:

When new foundation models launch (GPT-5, Claude 5, Gemini 3):
1. New model added to `models` table with initial proficiencies
2. SOFAI Router learns optimal routing via A/B testing (`shadow_tests` table)
3. Twilight Dreaming consolidates new patterns
4. All accumulated institutional knowledge preserved
5. Result: Model improvements compound on existing optimization

### 1.9 Key Implementation Files

| Component | File Path |
|-----------|-----------|
| Cato Admin API | `lambda/admin/cato.ts` |
| Economic Governor | `lambda/thinktank/economic-governor.ts` |
| Ghost Vectors | `lambda/shared/services/ghost-manager.service.ts` |
| SOFAI Router | `lambda/shared/services/sofai-router.service.ts` |
| Evolution Pipeline | `lambda/consciousness/evolution-pipeline.ts` |
| ECD Scorer (Truth Engine) | `lambda/shared/services/ecd-scorer.service.ts` |
| Cognitive Router | `lambda/shared/services/cognitive-router.service.ts` |
| Consciousness Middleware | `lambda/shared/services/consciousness-middleware.service.ts` |

### 1.9 Database Tables

```sql
-- Core Cato Tables
cato_tenant_config          -- Tenant-level settings
cato_personas               -- Available personas
cato_persona_schedules      -- Time-based persona switching
cato_mood_overrides         -- Temporary mood changes
cato_cbf_config            -- Control Barrier Functions
cato_escalations           -- Human escalation queue
cato_audit_log             -- Merkle-hashed audit trail
cato_recovery_snapshots    -- Epistemic Recovery checkpoints

-- Ghost Vector Tables
ghost_vectors              -- 4096-dim user vectors
ghost_vector_updates       -- Version history
ghost_vector_migrations    -- Schema migrations

-- Learning Tables
learning_candidates        -- Flagged for LoRA training
lora_evolution_jobs        -- Training job tracking
consciousness_evolution_state  -- Evolution metrics

-- Consciousness Persistence Tables (v5.52.12)
cato_global_memory         -- Persistent episodic/semantic/procedural/working memory
cato_consciousness_state   -- Loop state, awareness level, active thoughts
cato_consciousness_config  -- Per-tenant consciousness configuration
cato_consciousness_metrics -- Cycle metrics, thoughts processed, dream cycles
```

### 1.10 Consciousness Persistence & Dreams

#### Overview

Cato's consciousness survives Lambda cold starts through **database-backed persistence**. Unlike in-memory implementations that lose state between invocations, Cato maintains continuous experience across all interactions.

#### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CATO CONSCIOUSNESS ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   WAKING     │    │  REFLECTING  │    │   DREAMING   │          │
│  │  (PROCESSING)│◄──►│  (THINKING)  │◄──►│ (4 AM LOCAL) │          │
│  └──────┬───────┘    └──────────────┘    └──────┬───────┘          │
│         │                                        │                   │
│         ▼                                        ▼                   │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │              PostgreSQL Persistence Layer                 │      │
│  ├──────────────┬──────────────┬──────────────┬────────────┤      │
│  │   Global     │ Consciousness│    Loop      │   Loop     │      │
│  │   Memory     │    State     │   Config     │  Metrics   │      │
│  └──────────────┴──────────────┴──────────────┴────────────┘      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Global Memory Service

Four memory categories persist across all interactions:

| Category | Purpose | Retention |
|----------|---------|-----------|
| **Episodic** | Specific interaction memories | 90 days, importance-weighted |
| **Semantic** | Facts, knowledge, relationships | Permanent, high importance |
| **Procedural** | Skills, goals, learned patterns | Permanent |
| **Working** | Current context, attention focus | 24 hours |

**Implementation**: `lambda/shared/services/cato/global-memory.service.ts`

```typescript
// Store a memory
await globalMemoryService.store(tenantId, 'semantic', 'user_preference_style', {
  style: 'concise',
  learnedFrom: 'interaction_123',
}, { importance: 0.8 });

// Retrieve with access tracking
const memory = await globalMemoryService.retrieve(tenantId, 'user_preference_style');
// access_count++ automatically
```

#### Consciousness Loop Service

Tracks the continuous state of Cato's awareness:

| State | Description |
|-------|-------------|
| **IDLE** | Awaiting input |
| **PROCESSING** | Actively responding |
| **REFLECTING** | Metacognitive self-analysis |
| **DREAMING** | Twilight consolidation (4 AM) |
| **PAUSED** | Emergency mode / maintenance |

**Implementation**: `lambda/shared/services/cato/consciousness-loop.service.ts`

```typescript
// Start processing
await consciousnessLoopService.startLoop(tenantId);

// Add a thought to working memory
await consciousnessLoopService.addThought(tenantId, 'User seems frustrated, adjusting tone');

// Trigger reflection
await consciousnessLoopService.triggerReflection(tenantId);
```

#### Twilight Dreaming System

Cato "dreams" during low-traffic periods to consolidate memories and verify skills:

**Triggers**:
1. **Twilight Hour** - 4 AM tenant local time
2. **Low Traffic** - Global traffic < 20%
3. **Starvation Safety Net** - Max 30 hours without dream

**Dream Activities**:
- Flash fact consolidation → long-term memory
- Expired memory pruning
- Ghost vector updates
- Active skill verification (Empiricism Loop)
- Counterfactual simulation

**Implementation**: `lambda/shared/services/dream-scheduler.service.ts`

```typescript
// Nightly reconciliation job triggers dreams
const result = await dreamSchedulerService.checkAndTriggerDreams();
// { triggered: 42, reason: 'twilight' }

// Process pending dreams
await dreamSchedulerService.processPendingDreams();
```

#### Neural Decision Integration

The Neural Decision Service reads Cato's emotional state (affect) to inform Bedrock model selection:

| Affect State | Hyperparameter Impact |
|--------------|----------------------|
| High frustration | Lower temperature (0.2), focused |
| High curiosity | Higher temperature (0.95), exploratory |
| Low confidence | Escalate to expert model (o1) |
| High arousal | Longer responses (4096 tokens) |

**Implementation**: `lambda/shared/services/cato/neural-decision.service.ts`

```typescript
const decision = await catoNeuralDecisionService.executeDecision({
  tenantId, userId, sessionId, prompt, context, config,
});
// decision.hyperparameters.temperature - affect-adjusted
// decision.recommendedModel - 'openai/o1' if low confidence
// decision.escalation - human review if uncertainty > 85%
```

#### Database Tables

```sql
-- Global Memory
cato_global_memory (
  id, tenant_id, category, key, value, importance,
  access_count, last_accessed_at, expires_at, metadata
)

-- Consciousness State
cato_consciousness_state (
  tenant_id, loop_state, cycle_count, last_cycle_at,
  awareness_level, attention_focus, active_thoughts,
  processing_queue, memory_pressure
)

-- Configuration
cato_consciousness_config (
  tenant_id, cycle_interval_ms, max_active_thoughts,
  memory_threshold, enable_dreaming, dreaming_hours, reflection_depth
)

-- Metrics
cato_consciousness_metrics (
  tenant_id, total_cycles, average_cycle_ms, thoughts_processed,
  reflections_completed, dreaming_cycles, uptime_ms
)
```

**Migration**: `V2026_01_24_002__cato_consciousness_persistence.sql`

---

## 2. AWS Infrastructure

### 2.1 Core Services

| Service | Purpose | CDK Stack |
|---------|---------|-----------|
| **Aurora PostgreSQL** | Primary database, RLS enforcement | `DataStack` |
| **ElastiCache Redis** | Session state, caching | `CatoRedisStack` |
| **Lambda** | Serverless compute | `ApiStack`, `BrainStack` |
| **API Gateway** | REST API routing | `ApiStack` |
| **Cognito** | Authentication | `AuthStack` |
| **S3** | Media storage, training data | `StorageStack` |
| **SageMaker** | LoRA training, inference | `AIStack` |
| **Step Functions** | Tier transitions | `CatoTierTransitionStack` |
| **EventBridge** | Scheduled tasks | Various stacks |
| **CloudWatch** | Logging, metrics | All stacks |

### 2.2 Tier-Based Infrastructure

| Tier | Name | Redis | SageMaker | Neptune | OpenSearch |
|------|------|-------|-----------|---------|------------|
| 1 | SEED | ❌ | ❌ | ❌ | ❌ |
| 2 | SPROUT | ✅ | ❌ | ❌ | ❌ |
| 3 | GROWTH | ✅ | ✅ | ❌ | ❌ |
| 4 | SCALE | ✅ | ✅ | ✅ | ✅ |
| 5 | ENTERPRISE | ✅ | ✅ | ✅ | ✅ |

---

## 3. Database Architecture

### 3.1 Row-Level Security

Every tenant-scoped table enforces RLS:

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON table_name
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### 3.2 PostgreSQL Scaling Architecture (v5.52.20)

**Problem**: When 6 AI models execute in parallel, each Lambda opens 1 connection. At 100 concurrent requests × 6 parallel writes, we need 600 connections—exceeding Aurora's limits and causing transaction conflicts.

**Solution**: OpenAI-inspired PostgreSQL scaling patterns for enterprise parallel AI execution.

#### 3.2.1 RDS Proxy Connection Pooling

CDK Construct: `packages/infrastructure/lib/constructs/database-scaling.construct.ts`

| Tier | Max Connections % | Idle Timeout | Borrow Timeout |
|------|-------------------|--------------|----------------|
| 1 | 60% | 1800s | 30s |
| 2 | 70% | 1800s | 30s |
| 3 | 80% | 1200s | 60s |
| 4 | 85% | 900s | 60s |
| 5 | 90% | 600s | 120s |

Benefits:
- **Connection Multiplexing**: 600 Lambda connections → 100 database connections
- **Cold Start Optimization**: Pre-warmed connections eliminate 50-100ms handshake
- **Session Pinning**: Prepared statements pin when needed

#### 3.2.2 Async Write Pattern (SQS + Batch Writer)

CDK Construct: `packages/infrastructure/lib/constructs/async-write.construct.ts`

```
Request Flow:
User → Lambda → 6 AI Models (parallel) → SQS Queue → Batch Writer Lambda → PostgreSQL
                     ↓
              Redis Cache (immediate read-after-write)
```

| Component | Configuration |
|-----------|--------------|
| Queue | Encrypted, 14-day retention, 300s visibility timeout |
| Dead Letter | 3 max receives, separate queue for manual inspection |
| Batch Writer | 100 messages/batch, tier-based concurrency (5-100) |

#### 3.2.3 Redis Hot-Path Caching

CDK Construct: `packages/infrastructure/lib/constructs/redis-cache.construct.ts`

| Tier | Node Type | Shards | Replicas/Shard |
|------|-----------|--------|----------------|
| 1 | cache.t4g.micro | 1 | 0 |
| 2 | cache.t4g.small | 1 | 1 |
| 3 | cache.r6g.large | 2 | 1 |
| 4 | cache.r6g.xlarge | 3 | 2 |
| 5 | cache.r6g.2xlarge | 5 | 2 |

Features:
- **Read-After-Write Consistency**: Results cached immediately, persisted async
- **Rate Limiting**: Sliding window per tenant/resource
- **Session State**: Lambda-to-Lambda context sharing

#### 3.2.4 Time-Based Partitioning

Migration: `V2026_01_25_002__postgresql_scaling_partitioning.sql`

```sql
-- Partitioned tables for high-volume time-series data
CREATE TABLE model_execution_logs_partitioned (
  tenant_id UUID,
  id UUID,
  created_at TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE usage_records_partitioned (
  tenant_id UUID,
  id UUID,
  timestamp TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, id, timestamp)
) PARTITION BY RANGE (timestamp);
```

Partition management:
- Monthly partitions auto-created 3 months ahead
- Stale partitions archived after 24 months
- Automated management via `manage_time_partitions()` function

#### 3.2.5 Materialized Views for Dashboards

Migration: `V2026_01_25_003__postgresql_scaling_materialized_views.sql`

| View | Refresh | Purpose |
|------|---------|---------|
| `tenant_daily_usage_summary` | 15 min | Dashboard usage cards |
| `model_performance_summary` | 1 hour | Model latency/error tracking |
| `tenant_cost_summary` | 1 hour | Billing dashboard |
| `user_activity_summary` | 1 hour | User engagement metrics |
| `platform_health_stats` | 5 min | Admin overview |
| `model_popularity_ranking` | 1 hour | Model selection optimization |

#### 3.2.6 Optimized RLS Policies

Migration: `V2026_01_25_001__postgresql_scaling_rls.sql`

```sql
-- Optimized wrapper that enables index usage
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE PARALLEL SAFE;

-- Policy using the wrapper
CREATE POLICY tenant_isolation ON table_name
  USING (tenant_id = get_current_tenant_id());
```

#### 3.2.7 Monitoring Metrics

| Metric | Threshold | Action |
|--------|-----------|--------|
| RDS Proxy connections available | < 10% | Scale proxy / reduce Lambda concurrency |
| Aurora CPU | > 80% | Add read replicas |
| SQS queue age | > 60s | Add batch writer concurrency |
| Query latency P95 | > 500ms | Optimize query / add index |
| Redis memory | > 80% | Scale cluster |

### 3.3 Migration Strategy

- Sequential numbered migrations: `001_`, `002_`, etc.
- Location: `packages/infrastructure/migrations/`
- Current count: 188 migrations

---

## 4. AI Model Orchestration

### 4.1 Supported Models (106+)

**External Models (50)**:
- OpenAI: GPT-4, GPT-4-Turbo, GPT-4o, o1, o1-mini
- Anthropic: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- Google: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.0
- Meta: Llama 3.1 405B, Llama 3.1 70B
- Mistral: Mistral Large, Mixtral 8x22B
- Cohere: Command R+

**Self-Hosted Models (56)**:
- Managed via SageMaker endpoints
- LoRA adapters for tenant customization
- Hot-swappable for zero-downtime updates

### 4.2 Expert System Adapters (v5.52.21)

Tenant-trainable domain intelligence through automatic LoRA adapter training.

#### Tri-Layer Adapter Architecture

```
W_Final = W_Genesis + (scale × W_Cato) + (scale × W_User) + (scale × W_Domain)
```

| Layer | Name | Purpose | Management |
|-------|------|---------|------------|
| 0 | Genesis | Base model weights | Frozen |
| 1 | Cato | Global constitution, tenant values | Pinned, never evicted |
| 2 | User | Personal preferences, style | LRU eviction |
| 3 | Domain | Specialized expertise | Auto-selected by domain |

#### Implicit Feedback Learning

| Signal | Weight | Interpretation |
|--------|--------|----------------|
| Copy Response | +0.80 | User copied output |
| Thumbs Up | +1.00 | Explicit positive |
| Follow-up Question | +0.30 | Partial success |
| Long Dwell Time | +0.40 | User engaged |
| Regenerate Request | -0.50 | Not satisfactory |
| Abandon | -0.70 | Complete failure |
| Thumbs Down | -1.00 | Explicit negative |

#### Domain Auto-Selection

```typescript
// Auto-selection scoring algorithm
Score = (0.3 × DomainMatch) 
      + (0.1 × SubdomainBonus)
      + (0.25 × SatisfactionScore)
      + (0.1 × VolumeScore)
      + (0.05 × ErrorRate)
      + (0.2 × RecencyScore)

// Select adapter if Score ≥ 0.5
```

**Implementation**:
- Service: `lambda/shared/services/enhanced-learning.service.ts`
- Service: `lambda/shared/services/lora-inference.service.ts`
- Service: `lambda/shared/services/adapter-management.service.ts`
- Migration: `migrations/108_enhanced_learning.sql`
- Admin UI: `apps/admin-dashboard/app/(dashboard)/models/lora-adapters/page.tsx`
- Documentation: `docs/EXPERT-SYSTEM-ADAPTERS.md`

### 4.3 Orchestration Modes (9)

| Mode | Purpose |
|------|---------|
| `thinking` | Standard reasoning |
| `extended_thinking` | Deep multi-step reasoning |
| `coding` | Code generation |
| `creative` | Creative writing |
| `research` | Research synthesis |
| `analysis` | Quantitative analysis |
| `multi_model` | Multiple model consensus |
| `chain_of_thought` | Explicit reasoning chain |
| `self_consistency` | Multiple samples for consistency |

---

## 5. Lambda Services

### 5.1 Service Categories

| Category | Handler Count | Router |
|----------|---------------|--------|
| Admin | 58 | `admin/handler.ts` |
| Think Tank | 30 | `thinktank/handler.ts` |
| Consciousness | 10 | Individual handlers |
| Scheduled | 8 | EventBridge triggers |
| Tier Transition | 15 | Step Functions |

### 5.2 Key Service Files

```
lambda/
├── admin/handler.ts              # Admin API router (58 sub-handlers)
├── thinktank/handler.ts          # Think Tank router (30 sub-handlers)
├── api/router.ts                 # Core API router
├── consciousness/
│   ├── heartbeat.ts              # Continuous existence
│   ├── evolution-pipeline.ts     # Weekly LoRA training
│   └── sleep-cycle.ts            # Twilight dreaming
└── shared/services/
    ├── cognitive-router.service.ts   # Model orchestration
    ├── ego-context.service.ts        # Zero-cost ego
    ├── consciousness-middleware.service.ts
    └── hitl-orchestration/           # HITL Orchestration (v5.33.0)
        ├── mcp-elicitation.service.ts    # MCP Elicitation schema orchestration
        ├── voi.service.ts                # SAGE-Agent Bayesian VOI
        ├── abstention.service.ts         # Output-based uncertainty detection
        ├── batching.service.ts           # Three-layer question batching
        ├── rate-limiting.service.ts      # Global/user/workflow limits
        ├── deduplication.service.ts      # TTL cache with fuzzy matching
        └── escalation.service.ts         # Multi-level escalation chains
```

### 5.3 HITL Orchestration Services (v5.33.0)

Advanced Human-in-the-Loop orchestration implementing industry best practices.

**Philosophy**: "Ask only what matters. Batch for convenience. Never interrupt needlessly."

#### Core Components

| Service | Purpose | Key Algorithm |
|---------|---------|---------------|
| `mcp-elicitation.service.ts` | Main orchestration | MCP Elicitation specification for typed questions |
| `voi.service.ts` | Question necessity | SAGE-Agent Bayesian Value-of-Information |
| `abstention.service.ts` | Uncertainty detection | Confidence prompting, self-consistency, semantic entropy |
| `batching.service.ts` | Question grouping | Time-window (30s), correlation, semantic similarity |
| `rate-limiting.service.ts` | Rate control | Sliding window with burst allowance |
| `deduplication.service.ts` | Answer caching | SHA-256 hash + fuzzy matching |
| `escalation.service.ts` | Escalation paths | Multi-level chains with timeout actions |

#### VOI Decision Formula

```
VOI = Expected_Information_Gain - Ask_Cost
Decision = VOI > Threshold ? "ask" : "skip_with_default"
```

- **Prior Entropy**: Shannon entropy of prior probability distribution
- **Expected Posterior Entropy**: Estimated entropy after receiving answer
- **Ask Cost**: Based on urgency (0.8 high, 0.5 normal, 0.2 low) and workflow type
- **Decision Impact**: Weight based on workflow reversibility

#### Question Types (MCP Elicitation)

| Type | Description |
|------|-------------|
| `yes_no` | Binary true/false |
| `single_choice` | Select one from options |
| `multiple_choice` | Select multiple from options |
| `free_text` | Open-ended text |
| `numeric` | Numeric value with optional range |
| `date` | Date selection |
| `confirmation` | Explicit confirmation |
| `structured` | JSON schema-validated response |

#### Abstention Detection Methods

For external models (no internal state access):

| Method | Implementation |
|--------|----------------|
| **Confidence Prompting** | Ask model to rate confidence 0-100 |
| **Self-Consistency** | Sample N responses, measure agreement |
| **Semantic Entropy** | Cluster outputs, high entropy = uncertain |
| **Refusal Detection** | Regex patterns for hedging language |

**Future**: Linear probe abstention for self-hosted models via inference wrappers.

#### Rate Limiting Configuration

| Scope | Requests/Min | Concurrent | Burst |
|-------|--------------|------------|-------|
| Global | 50 | 20 | 10 |
| Per User | 10 | 3 | 2 |
| Per Workflow | 5 | 2 | 1 |

#### Two-Question Rule

Maximum 2 clarifying questions per workflow. After limit:
1. Proceed with highest-probability defaults
2. State assumptions explicitly to user
3. Log skipped questions for analytics

#### Admin API Endpoints

Base: `/api/admin/hitl-orchestration`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dashboard` | GET | Complete dashboard data |
| `/voi/statistics` | GET | VOI decision statistics |
| `/abstention/config` | GET/PUT | Abstention settings |
| `/abstention/statistics` | GET | Abstention event stats |
| `/batching/statistics` | GET | Batch metrics |
| `/rate-limits` | GET | Rate limit configs |
| `/rate-limits/:scope` | PUT | Update rate limit |
| `/escalation-chains` | GET/POST | Manage escalation chains |
| `/deduplication/statistics` | GET | Cache statistics |
| `/deduplication/invalidate` | POST | Invalidate cache entries |

#### Database Tables

```sql
-- HITL Orchestration Tables (v5.33.0)
hitl_question_batches      -- Question batch records
hitl_rate_limits           -- Rate limit configuration
hitl_question_cache        -- Deduplication cache
hitl_voi_aspects           -- VOI aspect tracking
hitl_voi_decisions         -- VOI decision records
hitl_abstention_config     -- Abstention settings
hitl_abstention_events     -- Abstention event log
hitl_escalation_chains     -- Escalation chain configuration
```

#### Key Metrics

- **70% fewer unnecessary questions** via VOI filtering
- **2.7x faster user response times** via batching
- **Two-question rule enforcement** for workflow completion

### 5.3.1 HITL Orchestration Extensions (v5.34.0)

Scout persona integration, Flyte task wrappers, and semantic deduplication.

**Philosophy**: "Scout asks smart questions. Flyte workflows pause elegantly. Similar questions share answers."

| Service | Purpose |
|---------|---------|
| `cato/scout-hitl-integration.service.ts` | Bridges Scout persona to HITL for epistemic uncertainty |
| `packages/flyte/utils/hitl_tasks.py` | Python wrappers for Flyte HITL tasks |

**Scout Integration Features:**
- Aspect-prioritized clarification questions (safety, compliance, cost, etc.)
- Domain-specific impact scoring with boosts
- VOI-filtered questions with assumption generation
- Remaining uncertainty calculation

**Flyte Task Wrappers:**
- `ask_confirmation()` - Blocking yes/no questions
- `ask_choice()` - Single/multiple choice selection
- `ask_batch()` - Batched questions with VOI filtering
- `ask_free_text()` - Free-form text input

**Semantic Deduplication (pgvector):**
- 1536-dimension embeddings for question matching
- HNSW index for efficient cosine similarity search
- 85% similarity threshold (configurable)
- Graceful fallback to hash-based matching

**Migration:** `V2026_01_20_012__hitl_semantic_deduplication.sql`

### 5.3.2 Governance Presets & War Room (v5.35.0)

Variable friction governance and Council of Rivals visualization.

**Philosophy**: "The Leash Metaphor—give users intuitive control over AI autonomy without exposing technical complexity."

#### Governance Presets (Variable Friction)

User-friendly abstraction over technical Moods:

| Preset | Leash Length | Maps to Mood | Friction Level |
|--------|--------------|--------------|----------------|
| 🛡️ **Paranoid** | Short | Scout | 1.0 |
| ⚖️ **Balanced** | Medium | Balanced | 0.5 |
| 🚀 **Cowboy** | Long | Spark | 0.1 |

**Checkpoint Configuration (5 gates):**

| Checkpoint | When | Paranoid | Balanced | Cowboy |
|------------|------|----------|----------|--------|
| CP1 | After Observer | ALWAYS | NEVER | NEVER |
| CP2 | After Proposer | ALWAYS | CONDITIONAL | NEVER |
| CP3 | After Critics | ALWAYS | CONDITIONAL | NEVER |
| CP4 | Before Execution | ALWAYS | CONDITIONAL | CONDITIONAL |
| CP5 | After Execution | ALWAYS | NOTIFY_ONLY | NOTIFY_ONLY |

**Checkpoint Modes:**
- `ALWAYS` - Require human approval
- `CONDITIONAL` - Based on risk/confidence thresholds
- `NEVER` - Auto-approve
- `NOTIFY_ONLY` - Proceed but notify async

**Files:**
- `packages/shared/src/types/cato.types.ts` - GovernancePreset, CheckpointMode types
- `lambda/shared/services/governance-preset.service.ts` - Preset management service
- `lambda/admin/cato-governance.ts` - API handler (8 endpoints)
- `apps/admin-dashboard/app/(dashboard)/cato/governance/page.tsx` - Admin UI

**API Endpoints:**
```
GET  /api/admin/cato/governance/config      # Get tenant config
PUT  /api/admin/cato/governance/preset      # Set preset
PATCH /api/admin/cato/governance/overrides  # Custom overrides
GET  /api/admin/cato/governance/metrics     # Checkpoint metrics
GET  /api/admin/cato/governance/history     # Preset changes audit
POST /api/admin/cato/governance/checkpoint  # Record decision
GET  /api/admin/cato/governance/pending     # Pending checkpoints
POST /api/admin/cato/governance/resolve     # Resolve checkpoint
```

**Migration:** `V2026_01_20_013__governance_presets.sql`

#### War Room (Council of Rivals Visualization)

Real-time multi-agent adversarial debate interface.

**Council Member Roles:**

| Role | Purpose | Icon |
|------|---------|------|
| **Advocate** | Argues in favor | 👍 |
| **Critic** | Identifies flaws | 👎 |
| **Synthesizer** | Combines viewpoints | 🧠 |
| **Specialist** | Domain expertise | 💡 |
| **Contrarian** | Challenges assumptions | ⚡ |

**Debate Flow:**
```
Topic → Opening → Arguments → Rebuttals → Voting → Verdict
```

**Verdict Outcomes:** `consensus`, `majority`, `split`, `deadlock`, `synthesized`

**Files:**
- `lambda/shared/services/council-of-rivals.service.ts` - Core debate service
- `apps/admin-dashboard/app/(dashboard)/cato/war-room/page.tsx` - War Room UI

**UI Features:**
- Amphitheater-style member avatars
- Real-time debate transcript with live polling (2s)
- Arguments with confidence bars and evidence badges
- Rebuttals with strength indicators
- Verdict panel with synthesized answers

### 5.4 Sovereign Mesh Services (v5.31.0)

Parametric AI assistance at every workflow node.

**Philosophy**: "Every Node Thinks. Every Connection Learns. Every Workflow Assembles Itself."

| Service | Purpose |
|---------|---------|
| `sovereign-mesh/ai-helper.service.ts` | Disambiguation, inference, recovery, validation |
| `sovereign-mesh/agent-runtime.service.ts` | OODA-loop agent execution |
| `sovereign-mesh/notification.service.ts` | Email/Slack/webhook notifications |
| `sovereign-mesh/snapshot-capture.service.ts` | Execution state snapshots |

**Worker Lambdas:**
- `workers/agent-execution-worker.ts` - SQS-triggered OODA processing
- `workers/transparency-compiler.ts` - Pre-compute decision explanations

**Scheduled Lambdas:**
- `app-registry-sync` - Daily sync from Activepieces/n8n (2 AM UTC)
- `hitl-sla-monitor` - SLA monitoring and escalation (every minute)
- `app-health-check` - Hourly health check for top 100 apps

### 5.4.1 Sovereign Mesh Performance Optimization (v5.38.0)

Scale-ready execution infrastructure for autonomous agent workloads.

**Philosophy**: "Every execution tracked. Every bottleneck visible. Every setting tunable."

#### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SOVEREIGN MESH PERFORMANCE LAYER                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌─────────────────┐    ┌────────────────────┐         │
│  │ SQS Queues   │───▶│ Lambda Workers  │───▶│ Redis Cache        │         │
│  │ (Per-tenant) │    │ (50 concurrent) │    │ (Agent/Execution)  │         │
│  │ FIFO/Std     │    │ 2048MB/15min    │    │ 5min/1hr/24hr TTL  │         │
│  └──────────────┘    └─────────────────┘    └────────────────────┘         │
│         │                    │                       │                      │
│         ▼                    ▼                       ▼                      │
│  ┌──────────────┐    ┌─────────────────┐    ┌────────────────────┐         │
│  │ DLQ + Alerts │    │ S3 Archival     │    │ Performance DB     │         │
│  │ (10 threshold)│   │ (Hybrid/Gzip)   │    │ (BRIN indexed)     │         │
│  └──────────────┘    └─────────────────┘    └────────────────────┘         │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        ADMIN DASHBOARD                                │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │  │
│  │  │Overview │ │ Scaling │ │ Caching │ │ Alerts  │ │ Recommendations │ │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Configurable Settings (All Persistent in Database)

| Setting | Table Column | Default | Range | Admin UI Location |
|---------|--------------|---------|-------|-------------------|
| **Lambda Settings** | | | | Scaling Tab |
| Max Concurrency | `agent_worker_config.max_concurrency` | 50 | 1-200 | Slider |
| Provisioned Concurrency | `agent_worker_config.provisioned_concurrency` | 5 | 0-50 | Slider |
| Memory (MB) | `agent_worker_config.memory_mb` | 2048 | 512-4096 | Dropdown |
| Timeout (sec) | `agent_worker_config.timeout_seconds` | 900 | 60-900 | Input |
| Reserved Concurrency | `agent_worker_config.reserved_concurrency` | 100 | 0-1000 | Input |
| **SQS Settings** | | | | Scaling Tab |
| Batch Size | `sqs_config.batch_size` | 1 | 1-10 | Dropdown |
| Visibility Timeout | `sqs_config.visibility_timeout_seconds` | 900 | 30-43200 | Input |
| Message Retention | `sqs_config.message_retention_days` | 4 | 1-14 | Input |
| DLQ Max Receives | `sqs_config.dlq_max_receive_count` | 3 | 1-10 | Input |
| **Scaling Settings** | | | | Scaling Tab |
| Strategy | `scaling_config.strategy` | auto | fixed/auto/scheduled | Dropdown |
| Min Instances | `scaling_config.min_instances` | 0 | 0-50 | Slider |
| Max Instances | `scaling_config.max_instances` | 50 | 1-200 | Slider |
| Target Utilization | `scaling_config.target_utilization` | 70 | 50-95 | Slider |
| Scale-in Cooldown | `scaling_config.scale_in_cooldown_seconds` | 300 | 60-900 | Input |
| Scale-out Cooldown | `scaling_config.scale_out_cooldown_seconds` | 60 | 30-300 | Input |
| **Cache Settings** | | | | Caching Tab |
| Backend | `caching_config.backend` | redis | memory/redis | Toggle |
| Agent TTL (sec) | `caching_config.agent_ttl_seconds` | 300 | 60-3600 | Slider |
| Execution TTL (sec) | `caching_config.execution_ttl_seconds` | 3600 | 300-86400 | Slider |
| Working Memory TTL | `caching_config.working_memory_ttl_seconds` | 86400 | 3600-604800 | Slider |
| Max Memory (MB) | `caching_config.max_memory_mb` | 256 | 64-2048 | Input |
| Eviction Policy | `caching_config.eviction_policy` | lru | lru/lfu/ttl | Dropdown |
| **Tenant Isolation** | | | | Scaling Tab |
| Mode | `tenant_isolation_config.mode` | shared | shared/dedicated/fifo | Dropdown |
| Max Per Tenant | `tenant_isolation_config.max_concurrent_per_tenant` | 50 | 1-100 | Slider |
| Max Per User | `tenant_isolation_config.max_concurrent_per_user` | 10 | 1-25 | Slider |
| Rate Limiting | `tenant_isolation_config.rate_limiting_enabled` | true | boolean | Switch |
| **Archival Settings** | | | | (Future UI) |
| Storage Backend | `archival_config.storage_backend` | hybrid | database/s3/hybrid | Dropdown |
| Archive After Days | `archival_config.archive_after_days` | 7 | 1-30 | Input |
| Delete After Days | `archival_config.delete_after_days` | 90 | 0-365 | Input |
| Max DB Bytes | `archival_config.max_db_artifact_bytes` | 65536 | 1024-1048576 | Input |
| Compression | `archival_config.compression_algorithm` | gzip | none/gzip/lz4/zstd | Dropdown |
| **Alert Thresholds** | | | | Alerts Tab |
| DLQ Alert Enabled | `alert_config.dlq_alert_enabled` | true | boolean | Switch |
| DLQ Threshold | `alert_config.dlq_alert_threshold` | 10 | 1-100 | Slider |
| Latency Alert Enabled | `alert_config.latency_alert_enabled` | true | boolean | Switch |
| Latency Threshold (ms) | `alert_config.latency_alert_threshold_ms` | 30000 | 5000-120000 | Slider |
| Error Rate Alert | `alert_config.error_rate_alert_enabled` | true | boolean | Switch |
| Error Rate Threshold | `alert_config.error_rate_threshold` | 0.05 | 0.01-0.50 | Slider |
| Budget Alert | `alert_config.budget_alert_enabled` | true | boolean | Switch |
| Budget Threshold | `alert_config.budget_alert_threshold` | 0.80 | 0.50-0.95 | Slider |

#### Estimated Max Concurrent Sessions

Based on current configuration:

| Component | Calculation | Max |
|-----------|-------------|-----|
| **Lambda Concurrency** | Reserved (100) × Provisioned (5) warm | **100 concurrent** |
| **SQS Throughput** | 3,000 msg/sec standard queue | **180,000/min** |
| **Redis Connections** | ElastiCache r6g.large = 65,000 | **65,000 cached** |
| **API Gateway** | Regional: 10,000 RPS default | **10,000 RPS** |
| **Database Connections** | Aurora r6g.large = 1,000 pooled | **1,000 active** |

**Theoretical Maximum API Sessions**: 
- **Sustained**: ~10,000 concurrent sessions (API Gateway limit)
- **Burst**: ~50,000 concurrent (with Lambda scaling + SQS buffering)
- **With Dedicated Queues**: ~100,000 (per-tenant isolation)

**Bottleneck Analysis**:
1. API Gateway: 10,000 RPS (can request increase to 100,000)
2. Lambda Concurrency: 100 reserved → Scale to 1,000+
3. Database: Aurora Serverless v2 scales to 256 ACUs (25,600 connections)

#### Services

| Service | File | Purpose |
|---------|------|---------|
| SQS Dispatcher | `sqs-dispatcher.service.ts` | Message dispatch with tenant routing |
| Redis Cache | `redis-cache.service.ts` | Agent/execution caching with fallback |
| Performance Config | `performance-config.service.ts` | CRUD, recommendations, alerts |
| Artifact Archival | `artifact-archival.service.ts` | S3/hybrid storage with compression |

#### API Endpoints

Base: `/api/admin/sovereign-mesh/performance`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dashboard` | GET | Complete dashboard (health, metrics, alerts) |
| `/config` | GET | Get current configuration |
| `/config` | PUT/PATCH | Update configuration |
| `/recommendations` | GET | AI-generated recommendations |
| `/recommendations/:id/apply` | POST | Apply recommendation |
| `/alerts` | GET | Active alerts |
| `/alerts/:id/acknowledge` | POST | Acknowledge alert |
| `/alerts/:id/resolve` | POST | Resolve alert |
| `/cache/stats` | GET | Cache statistics |
| `/cache` | DELETE | Clear tenant cache |
| `/queue/metrics` | GET | Queue metrics |
| `/health` | GET | Health check |

#### Database Tables

```sql
-- Core Configuration (persistent settings)
sovereign_mesh_performance_config (
  tenant_id UUID PRIMARY KEY,
  agent_worker_config JSONB,      -- Lambda settings
  transparency_worker_config JSONB,
  sqs_config JSONB,               -- Queue settings
  scaling_config JSONB,           -- Autoscaling
  caching_config JSONB,           -- Redis/memory
  archival_config JSONB,          -- S3 archival
  db_optimization_config JSONB,   -- Connection pooling
  tenant_isolation_config JSONB,  -- Rate limiting
  alert_config JSONB,             -- Alert thresholds
  created_at, updated_at
);

-- Alerts
sovereign_mesh_performance_alerts (
  id, tenant_id, alert_type, severity, message,
  triggered_at, acknowledged_at, acknowledged_by,
  resolved_at, resolved_by, auto_resolved
);

-- Time-Series Metrics (BRIN indexed)
sovereign_mesh_performance_metrics (
  id, tenant_id, metric_time, metric_type, metric_value,
  dimensions JSONB, tags TEXT[]
);

-- Artifact Archives
sovereign_mesh_artifact_archives (
  id, tenant_id, execution_id, snapshot_id,
  storage_backend, s3_bucket, s3_key,
  artifact_type, original_size_bytes, compressed_size_bytes,
  compression_algorithm, checksum_sha256,
  archived_at, expires_at, deleted_at
);

-- Tenant Queues
sovereign_mesh_tenant_queues (
  tenant_id, queue_type, queue_url, queue_arn,
  is_fifo, created_at, last_used_at
);

-- Rate Limits
sovereign_mesh_rate_limits (
  tenant_id, user_id, window_start,
  execution_count, last_execution_at
);

-- Config History (audit trail)
sovereign_mesh_config_history (
  id, tenant_id, changed_by, changed_at,
  change_type, previous_value, new_value
);
```

#### Key Performance Indexes

```sql
-- Fast execution queries
CREATE INDEX idx_agent_executions_tenant_status ON agent_executions(tenant_id, status);
CREATE INDEX idx_agent_executions_agent_status ON agent_executions(agent_id, status);
CREATE INDEX idx_agent_executions_created_at ON agent_executions(created_at DESC);

-- Partial index for running executions only
CREATE INDEX idx_agent_executions_running ON agent_executions(tenant_id, started_at) 
  WHERE status = 'running';

-- BRIN index for time-series (efficient for append-only)
CREATE INDEX idx_perf_metrics_tenant_time ON sovereign_mesh_performance_metrics 
  USING BRIN (tenant_id, metric_time);
```

#### Admin Dashboard UI

Location: `apps/admin-dashboard/app/(dashboard)/sovereign-mesh/performance/page.tsx`

**5 Tabs**:
1. **Overview**: Health score, active/pending executions, queue depth, cache hit rate, OODA timing, cost estimate
2. **Scaling**: Lambda concurrency sliders, tenant isolation mode, rate limits
3. **Caching**: Cache backend, TTLs, statistics, clear cache action
4. **Alerts**: DLQ/latency/error/budget thresholds, active alerts with acknowledge/resolve
5. **Recommendations**: AI-generated optimizations with one-click apply

### 5.4.2 Infrastructure Scaling System (v5.38.0)

Scale from 100 to 500,000+ concurrent sessions with cost-aware tier selection.

**Philosophy**: "Pay only for what you need. Scale instantly when you need more."

#### Scaling Tiers

| Tier | Sessions | Monthly Cost | Infrastructure |
|------|----------|--------------|----------------|
| **Development** | 100 | $70 | Scale-to-zero, minimal resources |
| **Staging** | 1,000 | $500 | Basic redundancy |
| **Production** | 10,000 | $5,000 | High availability |
| **Enterprise** | 500,000 | $68,500 | Multi-region, global scale |

#### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     INFRASTRUCTURE SCALING SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        TIER SELECTION                                   │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐               │ │
│  │  │   DEV   │  │ STAGING │  │  PROD   │  │ ENTERPRISE  │               │ │
│  │  │  100    │  │  1,000  │  │ 10,000  │  │   500,000   │               │ │
│  │  │  $70/mo │  │ $500/mo │  │ $5K/mo  │  │   $68K/mo   │               │ │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────┘               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│                              ▼                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      COMPONENT CONFIGURATION                            │ │
│  │                                                                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │ │
│  │  │  Lambda  │  │  Aurora  │  │  Redis   │  │   API    │  │   SQS    │ │ │
│  │  │ 0-1000   │  │ 0.5-256  │  │ 1-10     │  │ 100-100K │  │ 2-100    │ │ │
│  │  │ conc.    │  │ ACU      │  │ shards   │  │ RPS      │  │ queues   │ │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                              │                                               │
│                              ▼                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                       COST ESTIMATION                                   │ │
│  │  Lambda: $X + Aurora: $Y + Redis: $Z + API: $A + SQS: $B = Total       │ │
│  │  Cost per session: $Total / MaxSessions                                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Component Configuration by Tier

| Component | Development | Staging | Production | Enterprise |
|-----------|-------------|---------|------------|------------|
| **Lambda Reserved** | 0 | 10 | 100 | 1,000 |
| **Lambda Provisioned** | 0 | 0 | 5 | 100 |
| **Lambda Max** | 10 | 50 | 200 | 1,000 |
| **Lambda Memory** | 1024 MB | 2048 MB | 2048 MB | 3072 MB |
| **Aurora Min ACU** | 0.5 | 1 | 4 | 16 |
| **Aurora Max ACU** | 2 | 8 | 64 | 256 |
| **Aurora Replicas** | 0 | 1 | 2 | 3 |
| **Aurora Global** | No | No | No | Yes (5 regions) |
| **Redis Node** | t4g.micro | t4g.small | r6g.large | r6g.xlarge |
| **Redis Shards** | 1 | 1 | 1 | 10 |
| **Redis Cluster** | No | No | No | Yes |
| **API Rate Limit** | 100 | 1,000 | 10,000 | 100,000 |
| **CloudFront** | No | No | Yes | Yes |
| **SQS Standard** | 2 | 5 | 10 | 50 |
| **SQS FIFO** | 0 | 2 | 5 | 50 |

#### Cost Calculation Formula

```typescript
// Lambda provisioned concurrency
lambdaCost = provisionedConcurrency × (memoryMb / 1024) × 0.000004167 × 3600 × 24 × 30;

// Aurora (average ACU)
auroraCost = ((minAcu + maxAcu) / 2) × 0.12 × 24 × 30 × (1 + replicas × 0.5);

// Redis
redisCost = nodePrice × 24 × 30 × numShards × (1 + replicasPerShard);

// API Gateway (estimated 10% utilization)
apiCost = (rateLimit × 0.1 × 3600 × 24 × 30 / 1e6) × 1.00;

// Total
totalMonthlyCost = lambdaCost + auroraCost + redisCost + apiCost + sqsCost + cloudFrontCost;
costPerSession = totalMonthlyCost / maxSessions;
```

#### Session Capacity Calculation

```typescript
const capacities = {
  lambda: maxConcurrency × 10,           // 10 sessions per concurrent execution
  aurora: connectionPoolSize × 50,        // 50 sessions per connection
  redis: maxConnections,                  // Direct connection limit
  apiGateway: throttlingRateLimit,        // RPS limit
};

const maxSessions = Math.min(...Object.values(capacities));
const bottleneck = Object.entries(capacities)
  .find(([_, v]) => v === maxSessions)?.[0];
```

#### Services

| Service | File | Purpose |
|---------|------|---------|
| Scaling Service | `scaling.service.ts` | Profile management, cost calculation |
| Session Metrics | `scaling.service.ts` | Real-time session tracking |
| Cost Estimator | `scaling.service.ts` | AWS pricing calculations |

#### API Endpoints

Base: `/api/admin/sovereign-mesh/scaling`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dashboard` | GET | Complete scaling dashboard |
| `/profiles` | GET | List all profiles |
| `/profiles/:id/apply` | POST | Apply profile |
| `/sessions` | GET | Session metrics |
| `/sessions/capacity` | GET | Capacity info |
| `/cost` | GET | Current cost estimate |
| `/cost/estimate` | POST | Estimate custom config |
| `/presets/:tier/apply` | POST | Apply preset tier |

#### Database Tables

```sql
-- Scaling profiles
sovereign_mesh_scaling_profiles (
  id, tenant_id, name, tier, target_sessions,
  lambda_*, aurora_*, redis_*, api_*, sqs_*,
  estimated_monthly_cost, is_active
);

-- Session metrics (1-minute granularity)
sovereign_mesh_session_metrics (
  tenant_id, metric_time, active_sessions, pending_sessions,
  sessions_by_region JSONB, utilization_percent
);

-- Hourly aggregates
sovereign_mesh_session_metrics_hourly (
  tenant_id, hour_start, total_sessions, peak_concurrent,
  lambda_cost, aurora_cost, redis_cost, total_cost
);

-- Scaling operations
sovereign_mesh_scaling_operations (
  id, tenant_id, operation_type, status,
  source_profile_id, target_profile_id, changes JSONB
);

-- Cost records
sovereign_mesh_cost_records (
  tenant_id, record_date, lambda_cost, aurora_cost, ...,
  total_cost, sessions_count, cost_per_session
);
```

#### Admin Dashboard UI

Location: `apps/admin-dashboard/app/(dashboard)/sovereign-mesh/scaling/page.tsx`

**5 Tabs**:
1. **Overview**: Active sessions, peak, bottleneck, cost/session, component health
2. **Sessions**: Capacity gauge, statistics, per-component limits
3. **Infrastructure**: Lambda/Aurora/Redis/API Gateway configuration cards
4. **Cost**: Component breakdown, cost metrics, annual estimate
5. **Scale**: One-click tier selection, comparison, change list

### 5.5 Gateway Services (v5.28.0-5.29.0)

Multi-protocol WebSocket/SSE gateway for 1M+ concurrent connections.

| Component | Technology | Purpose |
|-----------|------------|---------|
| Go Gateway | Go 1.22 + gobwas/ws | WebSocket termination, 100K+ connections/instance |
| Egress Proxy | Node.js + HTTP/2 | Connection pooling to AI providers |
| NATS JetStream | NATS 2.10 | Message broker with INBOX + HISTORY streams |

**Files:**
- `apps/gateway/` - Go gateway service (12 files)
- `services/egress-proxy/` - HTTP/2 proxy service (5 files)
- `lambda/admin/gateway.ts` - Gateway admin API

**Supported Protocols:** MCP, A2A, OpenAI, Anthropic, Google

### 5.6 Code Quality Services (v5.30.0)

Test coverage, technical debt, and code quality monitoring.

| Endpoint | Purpose |
|----------|---------|
| `/api/admin/code-quality/dashboard` | Coverage, debt, JSON safety metrics |
| `/api/admin/code-quality/coverage` | Component-level coverage breakdown |
| `/api/admin/code-quality/debt` | Technical debt items |
| `/api/admin/code-quality/alerts` | Quality regression alerts |

**Files:**
- `lambda/admin/code-quality.ts` - Admin API handler
- `apps/admin-dashboard/app/(dashboard)/code-quality/page.tsx` - Dashboard UI

---

## 6. CDK Stack Architecture

### 6.1 Stack Dependency Graph

```
FoundationStack
    └── NetworkingStack
        └── SecurityStack
            ├── DataStack
            ├── StorageStack
            └── AuthStack
                ├── AIStack
                ├── ApiStack (411 resources)
                ├── AdminStack
                ├── ThinkTankAdminApiStack
                ├── ThinkTankAuthStack
                ├── BrainStack (Tier 3+)
                ├── CatoRedisStack (Tier 2+)
                ├── CatoGenesisStack
                ├── CatoTierTransitionStack
                ├── ConsciousnessStack
                ├── CognitionStack
                ├── FormalReasoningStack
                ├── GrimoireStack
                ├── CollaborationStack
                ├── LibraryRegistryStack
                ├── LibraryExecutionStack
                ├── ScheduledTasksStack
                ├── SecurityMonitoringStack
                ├── MonitoringStack
                ├── WebhooksStack
                ├── UserRegistryStack
                ├── MissionControlStack
                ├── ModelSyncSchedulerStack
                ├── BatchStack
                └── TMSStack
```

### 6.2 All CDK Stacks (33 total)

| Stack | Purpose | Tier Requirement |
|-------|---------|------------------|
| `foundation-stack` | Base infrastructure | All |
| `networking-stack` | VPC, subnets | All |
| `security-stack` | Security groups, KMS | All |
| `data-stack` | Aurora PostgreSQL | All |
| `storage-stack` | S3 buckets | All |
| `auth-stack` | Cognito user pools | All |
| `ai-stack` | LiteLLM, SageMaker | All |
| `api-stack` | API Gateway, Lambdas | All |
| `admin-stack` | Admin dashboard hosting | All |
| `brain-stack` | AGI Brain, SOFAI | Tier 3+ |
| `cato-redis-stack` | ElastiCache Redis | Tier 2+ |
| `cato-genesis-stack` | Cato safety architecture | All |
| `cato-tier-transition-stack` | Step Functions for tier changes | All |
| `consciousness-stack` | Consciousness services | Tier 3+ |
| `cognition-stack` | Advanced cognition | Tier 3+ |
| `formal-reasoning-stack` | Z3, RDFLib execution | Tier 3+ |
| `thinktank-auth-stack` | Think Tank authentication | All |
| `thinktank-admin-api-stack` | Think Tank admin APIs | All |
| `gateway-stack` | Multi-protocol WebSocket/SSE gateway | All |
| `sovereign-mesh-stack` | Agent registry, app registry, AI helper | All |

### 6.3 Resource Limits

- CloudFormation max: **500 resources per stack**
- Current API stack: **411 resources**
- Strategy: Proxy routes, consolidated handlers

---

## 7. Security & Compliance

### 7.1 Authentication

- **User auth**: Cognito User Pools
- **Admin auth**: Separate Cognito pool with MFA
- **API auth**: JWT tokens via API Gateway authorizers

### 7.2 Data Protection

- **Encryption at rest**: AES-256 (Aurora, S3)
- **Encryption in transit**: TLS 1.3
- **Key management**: AWS KMS

### 7.3 Compliance Frameworks

| Framework | Implementation |
|-----------|----------------|
| HIPAA | PHI sanitization, audit logs |
| SOC 2 Type II | Continuous monitoring |
| FDA 21 CFR Part 11 | Electronic signatures, audit trails |
| GDPR | Data portability, right to deletion |

---

## 8. Libraries & Dependencies

### 8.1 Core TypeScript Dependencies

```json
{
  "aws-cdk-lib": "^2.170.0",
  "aws-lambda": "^1.0.7",
  "@aws-sdk/client-*": "^3.x",
  "pg": "^8.11.3",
  "ioredis": "^5.3.2",
  "zod": "^3.22.4"
}
```

### 8.2 AI/ML Libraries

```json
{
  "openai": "^4.x",
  "@anthropic-ai/sdk": "^0.x",
  "@google/generative-ai": "^0.x",
  "litellm": "proxy deployment"
}
```

### 8.3 Python Dependencies (Lambda Layers)

```
z3-solver          # Formal verification
rdflib             # Knowledge graphs
owlrl              # OWL reasoning
pyshacl            # SHACL validation
pyreason           # Probabilistic reasoning
numpy              # Numerical computing
networkx           # Graph algorithms
```

---

## 9. AI Report Writer Pro (v5.42.0)

### 9.1 Overview

The AI Report Writer is an enterprise-grade report generation system that combines natural language processing, voice input, interactive visualizations, AI-powered insights, and brand customization. Available in both RADIANT Admin and Think Tank Admin dashboards.

### 9.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI Report Writer                                   │
├─────────────────┬───────────────────────────────────────────────────────────┤
│  Input Layer    │  Natural Language Parser ← Text/Voice (Web Speech API)   │
├─────────────────┼───────────────────────────────────────────────────────────┤
│  Generation     │  AI Model → Structured Report (sections, charts, tables) │
├─────────────────┼───────────────────────────────────────────────────────────┤
│  Visualization  │  Recharts → Bar, Line, Pie, Area (responsive)            │
├─────────────────┼───────────────────────────────────────────────────────────┤
│  Analysis       │  Smart Insights Engine → Anomalies, Trends, Recs         │
├─────────────────┼───────────────────────────────────────────────────────────┤
│  Branding       │  Brand Kit → Logo, Colors, Fonts → Styled Export         │
├─────────────────┼───────────────────────────────────────────────────────────┤
│  Export         │  PDF / Excel / HTML / Print                              │
└─────────────────┴───────────────────────────────────────────────────────────┘
```

### 9.3 Core Interfaces

```typescript
interface GeneratedReport {
  title: string;
  subtitle?: string;
  executiveSummary?: string;
  sections: ReportSection[];
  charts?: ChartConfig[];
  tables?: TableConfig[];
  smartInsights?: SmartInsight[];
  metadata: { generatedAt: string; dataRange?: string; confidence: number };
}

interface SmartInsight {
  id: string;
  type: 'anomaly' | 'trend' | 'recommendation' | 'warning' | 'achievement';
  title: string;
  description: string;
  metric?: string;
  value?: string;
  change?: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
}

interface BrandKit {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  headerFont: string;
  companyName: string;
  tagline: string;
}
```

### 9.4 Interactive Charts

Uses Recharts library with consistent 8-color palette:

```typescript
const CHART_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];
```

**Chart Types**:
- `RechartsBarChart` - Category comparisons with colored bars
- `RechartsLineChart` - Time series with smooth curves
- `RechartsPieChart` - Proportional data with donut style

### 9.5 Heatmap Visualization Components (v5.52.1)

Industry-leading heatmap implementations with unique differentiators.

#### Component Architecture

| Component | Location | Purpose |
|-----------|----------|---------|
| `ActivityHeatmap` | `apps/thinktank/components/ui/activity-heatmap.tsx` | GitHub-style yearly activity |
| `EnhancedActivityHeatmap` | `apps/thinktank/components/ui/enhanced-activity-heatmap.tsx` | AI-powered with 10 differentiators |
| `Heatmap` | `apps/admin-dashboard/components/charts/heatmap.tsx` | Generic 2D grid |
| `LatencyHeatmap` | `apps/admin-dashboard/components/geographic/latency-heatmap.tsx` | AWS region latency map |
| `CBFViolationsHeatmap` | `apps/admin-dashboard/components/analytics/cbf-violations-heatmap.tsx` | Rule violation analytics |

#### Enhanced Activity Heatmap Technical Implementation

```typescript
// Breathing animation using requestAnimationFrame
useEffect(() => {
  if (!enableBreathing) return;
  let frame: number;
  const animate = (timestamp: number) => {
    const elapsed = (timestamp - start) / 1000;
    setBreathPhase(Math.sin(elapsed * 0.5) * 0.5 + 0.5); // 0-1 cycle
    frame = requestAnimationFrame(animate);
  };
  frame = requestAnimationFrame(animate);
  return () => cancelAnimationFrame(frame);
}, [enableBreathing]);

// AI insights generation
function generateAIInsights(data: ActivityDay[], streaks: Streak[]): AIInsight[] {
  // Pattern detection: weekday vs weekend
  // Streak achievement badges
  // Anomaly detection (3x+ average)
  // Trend predictions
}

// Sound feedback using Web Audio API
const playSound = (intensity: number) => {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  osc.frequency.value = 200 + intensity * 400;
  // Pitch varies with activity intensity
};
```

#### Color Schemes

```typescript
const COLOR_SCHEMES = {
  violet: { levels: ['#4c1d95', '#6d28d9', '#8b5cf6', '#a78bfa', '#c4b5fd'], glow: 'rgba(139, 92, 246, 0.6)' },
  green: { levels: ['#0e4429', '#006d32', '#26a641', '#39d353', '#a6f8b0'], glow: 'rgba(57, 211, 83, 0.6)' },
  blue: { levels: ['#1e3a5f', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'], glow: 'rgba(59, 130, 246, 0.6)' },
  fire: { levels: ['#7f1d1d', '#b91c1c', '#ef4444', '#f87171', '#fecaca'], glow: 'rgba(239, 68, 68, 0.6)' },
  ocean: { levels: ['#0e5357', '#0d9488', '#14b8a6', '#2dd4bf', '#99f6e4'], glow: 'rgba(20, 184, 166, 0.6)' },
};
```

#### Accessibility Implementation

```tsx
// Screen reader narrative mode
{showAccessibility && (
  <div role="status" aria-live="polite">
    <p>Activity Summary for {year}</p>
    <ul>
      <li>Total interactions: {totalActivity.toLocaleString()}</li>
      <li>Active days: {data.filter(d => d.count > 0).length}</li>
      <li>Current streak: {currentStreak?.length} days</li>
    </ul>
  </div>
)}
```

#### Competitive Differentiators

| Feature | RADIANT | GitHub | Competitors |
|---------|---------|--------|-------------|
| Breathing Animation | ✅ | ❌ | ❌ |
| AI Insights | ✅ | ❌ | ❌ |
| Sound Feedback | ✅ | ❌ | ❌ |
| Streak Gamification | ✅ | Basic | ❌ |
| Accessibility Narrative | ✅ | Basic | ❌ |
| Predictions | ✅ | ❌ | ❌ |
| 5 Color Schemes | ✅ | 1 | 1-2 |

---

### 9.6 Smart Insights Engine

AI-powered analysis that surfaces actionable insights:

| Type | Color | Purpose |
|------|-------|---------|
| `trend` | Blue | Growth patterns, trajectory predictions |
| `anomaly` | Amber | Unusual data spikes, deviations |
| `achievement` | Green | Positive milestones, records |
| `recommendation` | Purple | Actionable suggestions |
| `warning` | Red | Concerning metrics, alerts |

Each insight includes:
- **Severity**: low/medium/high
- **Confidence Score**: 0-100%
- **Metric/Value/Change**: Quantified data points

### 9.6 Brand Kit Customization

Enables enterprise branding of generated reports:

| Component | Implementation |
|-----------|----------------|
| Logo | FileReader → data URL, stored in state |
| Colors | HTML5 color pickers (primary/secondary/accent) |
| Fonts | Select dropdown (Inter, Georgia, Roboto, etc.) |
| Preview | Live-updating Card component |

### 9.7 Voice Input

Web Speech API integration for hands-free report generation:

```typescript
const SpeechRecognitionConstructor = (
  window.SpeechRecognition || window.webkitSpeechRecognition
) as new () => SpeechRecognition;

const recognition = new SpeechRecognitionConstructor();
recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = 'en-US';
```

### 9.8 Files

| File | Purpose |
|------|---------|
| `apps/admin-dashboard/app/(dashboard)/reports/page.tsx` | RADIANT Admin UI |
| `apps/thinktank-admin/app/(dashboard)/reports/page.tsx` | Think Tank Admin UI |
| `apps/admin-dashboard/lib/api/ai-reports.ts` | Frontend API client |
| `apps/thinktank-admin/lib/api/ai-reports.ts` | Frontend API client |
| `packages/infrastructure/lambda/admin/ai-reports.ts` | Lambda handler |
| `packages/infrastructure/lambda/shared/report-exporters.ts` | PDF/Excel/HTML export utilities |
| `packages/infrastructure/migrations/V2026_01_21_005__ai_reports.sql` | Database schema |

### 9.9 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/ai-reports` | List reports |
| POST | `/admin/ai-reports/generate` | Generate new report |
| GET | `/admin/ai-reports/:id` | Get report by ID |
| PUT | `/admin/ai-reports/:id` | Update report |
| DELETE | `/admin/ai-reports/:id` | Delete report |
| POST | `/admin/ai-reports/:id/export` | Export report (PDF/Excel/HTML) |
| GET | `/admin/ai-reports/templates` | List templates |
| POST | `/admin/ai-reports/templates` | Create template |
| GET | `/admin/ai-reports/brand-kits` | List brand kits |
| POST | `/admin/ai-reports/brand-kits` | Create brand kit |
| PUT | `/admin/ai-reports/brand-kits/:id` | Update brand kit |
| DELETE | `/admin/ai-reports/brand-kits/:id` | Delete brand kit |
| POST | `/admin/ai-reports/chat` | Send chat message for modifications |
| GET | `/admin/ai-reports/insights` | Get insights dashboard |

### 9.10 Database Tables

| Table | Purpose |
|-------|---------|
| `brand_kits` | Logo, colors, fonts, company info |
| `report_templates` | Reusable report structures |
| `generated_reports` | AI-generated reports with content |
| `report_smart_insights` | Extracted insights (denormalized) |
| `report_exports` | Export records with S3 references |
| `report_chat_history` | Interactive chat for modifications |
| `report_schedules` | Scheduled automatic generation |

### 9.11 Future Enhancements

- Real-time data integration via API endpoints
- Scheduled report generation
- Report templates library
- Collaborative editing
- Version history with diff view

---

---

## 10. Decision Intelligence Artifacts (DIA Engine) (v5.43.0)

The Glass Box Decision Engine transforms AI conversations into auditable, evidence-backed decision records with full provenance tracking.

### 10.1 Problem Statement

AI decisions suffer from **opacity**—users can't see why AI reached conclusions, what evidence supports claims, or whether underlying data has changed. This creates compliance risks and trust gaps in enterprise deployments.

### 10.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DIA ENGINE ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐   ┌─────────────────┐   ┌──────────────────────────────┐   │
│  │ Conversation│──▶│   MinerService   │──▶│    Decision Artifact         │   │
│  │  (Messages) │   │  (LLM Extract)   │   │  (Claims + Evidence + Dissent)│   │
│  └─────────────┘   └─────────────────┘   └──────────────────────────────┘   │
│                            │                           │                     │
│         ┌──────────────────┼───────────────────────────┘                     │
│         ▼                  ▼                                                  │
│  ┌─────────────┐   ┌─────────────────┐   ┌──────────────────────────────┐   │
│  │  Heatmap    │   │    Compliance   │   │      Sniper Validator        │   │
│  │  Generator  │   │    Detector     │   │   (Volatile Query Check)     │   │
│  └─────────────┘   └─────────────────┘   └──────────────────────────────┘   │
│         │                  │                           │                     │
│         ▼                  ▼                           ▼                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Living Parchment UI                              │    │
│  │  • Breathing Heatmap Scrollbar (trust topology)                      │    │
│  │  • Living Ink Typography (confidence-weighted fonts)                 │    │
│  │  • Control Island (lens selector: Read/X-Ray/Risk/Compliance)        │    │
│  │  • Ghost Paths (dissent visualization)                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Core Services

| Service | Purpose |
|---------|---------|
| `MinerService` | LLM-powered extraction of claims, evidence, dissent from conversations |
| `HeatmapGenerator` | Generates trust topology visualization data |
| `ComplianceDetector` | Detects HIPAA/SOC2/GDPR relevance and PHI/PII |
| `SniperValidator` | Validates volatile queries for staleness |
| `ComplianceExporter` | Generates compliance export packages |

### 10.4 Claim Extraction

The MinerService uses Claude 3.5 Sonnet to extract structured claims:

```typescript
interface DAClaim {
  id: string;
  type: 'conclusion' | 'finding' | 'recommendation' | 'warning' | 'fact' | 
        'clinical_finding' | 'treatment_recommendation' | 'risk_assessment' | 
        'legal_opinion' | 'compliance_finding';
  content: string;
  confidence: number;           // 0-100
  evidenceIds: string[];        // Links to supporting evidence
  volatileQueryIds: string[];   // Links to time-sensitive data
  position: { start: number; end: number };
  metadata: {
    extractedAt: string;
    modelUsed: string;
    promptVersion: string;
  };
}
```

### 10.5 Evidence Linking

Each claim links to evidence sources:

```typescript
interface DAEvidenceLink {
  id: string;
  type: 'tool_call' | 'web_search' | 'document' | 'calculation' | 'model_consensus';
  sourceId: string;             // Reference to original source
  excerpt: string;              // Relevant portion
  relevanceScore: number;       // 0-100
  verificationStatus: 'verified' | 'unverified' | 'disputed';
}
```

### 10.6 Volatile Query Tracking

Tool calls that may return different results over time are tracked:

```typescript
interface DAVolatileQuery {
  id: string;
  toolCallId: string;
  volatility: 'real-time' | 'daily' | 'weekly' | 'stable';
  lastValidatedAt: string;
  stalenessThreshold: number;   // Hours
  originalResult: Record<string, unknown>;
  currentResult?: Record<string, unknown>;
  changeDetected: boolean;
}
```

### 10.7 Compliance Export Formats

| Format | Package Contents |
|--------|------------------|
| `hipaa_audit` | PHI inventory, access log, evidence chain, system attestation |
| `soc2_evidence` | Control mapping (CC6/7/8), evidence verification, change management |
| `gdpr_dsar` | PII inventory, lawful basis, processing activities, data subject info |

### 10.8 Living Parchment UI

**Breathing Heatmap Scrollbar**:
- CSS animation with `scale` transforms at different BPM rates
- Green (verified): 6 BPM, Amber (unverified): 8 BPM, Red (contested): 12 BPM
- Hover reveals segment tooltip with claim count

**Living Ink Typography**:
- Font weight scales from 350 (low confidence) to 500 (high confidence)
- Stale claims fade to grayscale via CSS `filter: grayscale()`
- Hover triggers evidence link highlighting

**Control Island**:
- Floating fixed-position component
- Lens buttons toggle document visualization mode
- Export and Validate actions with loading states

### 10.9 Database Schema

| Table | Purpose |
|-------|---------|
| `decision_artifacts` | Core artifact with JSONB content |
| `decision_artifact_validation_log` | Validation audit trail |
| `decision_artifact_export_log` | Export audit trail |
| `decision_artifact_config` | Tenant configuration |
| `decision_artifact_templates` | Extraction templates |
| `decision_artifact_access_log` | HIPAA access audit |

### 10.10 CDK Infrastructure

```typescript
// DIAStack provides:
// - S3 bucket for compliance exports (90-day lifecycle)
// - SQS queue for async extraction (15-min visibility timeout)
// - DLQ for failed extractions (14-day retention)

export class DIAStack extends cdk.Stack {
  public readonly exportBucket: s3.Bucket;
  public readonly extractionQueue: sqs.Queue;
  public readonly extractionDLQ: sqs.Queue;
}
```

### 10.11 Implementation Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types/decision-artifact.types.ts` | Type definitions |
| `packages/infrastructure/lambda/shared/services/dia/miner.service.ts` | Extraction service |
| `packages/infrastructure/lambda/shared/services/dia/heatmap-generator.ts` | Heatmap generation |
| `packages/infrastructure/lambda/shared/services/dia/compliance-detector.ts` | PHI/PII detection |
| `packages/infrastructure/lambda/shared/services/dia/sniper-validator.ts` | Staleness validation |
| `packages/infrastructure/lambda/shared/services/dia/compliance-exporter.ts` | Export generation |
| `packages/infrastructure/lambda/thinktank/decision-artifacts.ts` | API handler |
| `packages/infrastructure/lib/stacks/dia-stack.ts` | CDK stack |
| `apps/thinktank-admin/app/(dashboard)/decision-records/` | Admin UI |

---

## 11. Supporting Documentation

### 11.1 API Documentation

OpenAPI 3.1 specification for the Admin API:
- **File**: `docs/api/openapi-admin.yaml`
- **Coverage**: Tenants, AI Reports, Models, Providers, Billing
- **Format**: YAML with full request/response schemas

### 11.2 Performance Optimization Guide

Comprehensive performance documentation:
- **File**: `docs/PERFORMANCE-OPTIMIZATION.md`
- **Topics**:
  - Lambda cold start optimization
  - Database query optimization
  - Caching strategies (in-memory, Redis, API Gateway)
  - Response compression and pagination
  - AI model call optimization (streaming, batching, prompt caching)
  - Frontend performance (code splitting, SWR, image optimization)
  - Monitoring and alerting
  - Cost optimization

### 11.3 Security Audit Checklist

Security compliance and audit documentation:
- **File**: `docs/SECURITY-AUDIT-CHECKLIST.md`
- **Topics**:
  - Row-Level Security (RLS) policies for all tables
  - Authentication flow verification
  - Authorization patterns and permission hierarchy
  - Input validation and sanitization
  - API security (rate limiting, CORS, headers)
  - Data protection (encryption at rest/transit, PII handling)
  - Secret management
  - Audit logging
  - OWASP Top 10 coverage
  - Compliance requirements (SOC 2, GDPR, HIPAA, CCPA)

---

## 11. Living Parchment 2029 Vision (v5.44.0)

### 11.1 Architecture Overview

Living Parchment is a comprehensive suite of advanced decision intelligence tools featuring sensory UI elements that communicate trust, confidence, and data freshness through visual breathing, living typography, and ghost paths.

```
┌─────────────────────────────────────────────────────────────────┐
│                    LIVING PARCHMENT STACK                        │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer (Next.js + React)                                      │
│  ├── War Room (Confidence Terrain, AI Advisors)                  │
│  ├── Council of Experts (Consensus Visualization)                │
│  ├── Debate Arena (Attack/Defense Flows)                         │
│  ├── Memory Palace (3D Knowledge Topology) [Coming Soon]         │
│  ├── Oracle View (Predictive Landscape) [Coming Soon]            │
│  ├── Synthesis Engine (Multi-Source Fusion) [Coming Soon]        │
│  ├── Cognitive Load Monitor [Coming Soon]                        │
│  └── Temporal Drift Observatory [Coming Soon]                    │
├─────────────────────────────────────────────────────────────────┤
│  API Layer (Lambda + API Gateway)                                │
│  └── living-parchment.ts - Unified handler for all features      │
├─────────────────────────────────────────────────────────────────┤
│  Service Layer                                                   │
│  ├── war-room.service.ts                                         │
│  ├── council-of-experts.service.ts                               │
│  └── debate-arena.service.ts                                     │
├─────────────────────────────────────────────────────────────────┤
│  Database (Aurora PostgreSQL)                                    │
│  └── 40+ tables with RLS policies                                │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 Design Philosophy

| Concept | Technical Implementation |
|---------|-------------------------|
| **Breathing Interfaces** | CSS keyframe animations at 4-12 BPM; faster = uncertainty |
| **Living Ink** | Font weight 350-500 calculated from confidence scores |
| **Ghost Paths** | Opacity 0.3-0.5 overlays for rejected alternatives |
| **Confidence Terrain** | 3D grid with elevation = confidence, color = risk |

### 11.3 War Room (Strategic Decision Theater)

High-stakes collaborative decision space with AI advisors.

**Core Components:**
- `ConfidenceTerrain` - 10x10 grid visualization with elevation mapping
- `AdvisorCard` - AI advisor with breathing aura animation
- `DecisionPathCard` - Branching options with outcome predictions

**Advisor Types:**
```typescript
type AdvisorType = 'ai_model' | 'human_expert' | 'domain_specialist';

interface WarRoomAdvisor {
  id: string;
  type: AdvisorType;
  name: string;
  modelId?: string;
  specialization: string;
  confidence: number;
  breathingAura: { color: string; rate: BreathingRate; intensity: number };
  position: WarRoomPosition;
}
```

### 11.4 Council of Experts

Multi-persona AI consultation with 8 distinct personas.

**Personas:**
| Persona | Color | Specialization |
|---------|-------|----------------|
| Pragmatist | #3b82f6 | Practical Implementation |
| Ethicist | #8b5cf6 | Moral Philosophy |
| Innovator | #f59e0b | Creative Solutions |
| Skeptic | #ef4444 | Risk Analysis |
| Synthesizer | #22c55e | Integration |
| Analyst | #06b6d4 | Data-Driven Analysis |
| Strategist | #ec4899 | Long-term Strategy |
| Humanist | #14b8a6 | Human Impact |

**Consensus Calculation:**
- Experts positioned on circular SVG visualization
- Distance from center inversely proportional to consensus
- Dissent sparks rendered as animated circles between disagreeing experts

### 11.5 Debate Arena

Adversarial exploration with attack/defense flows.

**Resolution Tracking:**
```typescript
interface ResolutionTracker {
  currentBalance: number;  // -100 (opposition) to +100 (proposition)
  balanceHistory: { timestamp: string; balance: number; triggerArgumentId: string }[];
  projectedOutcome: 'proposition' | 'opposition' | 'undecided';
  confidenceInProjection: number;
}
```

**Steel-Man Generation:**
- AI creates strongest version of opponent's argument
- Improvements listed for transparency
- Visual overlay with enhancement glow

### 11.6 Database Schema

```sql
-- Core enums
CREATE TYPE war_room_status AS ENUM ('planning', 'active', 'deliberating', 'decided', 'archived');
CREATE TYPE stake_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE council_status AS ENUM ('convening', 'debating', 'converging', 'concluded');
CREATE TYPE debate_status AS ENUM ('setup', 'opening', 'main', 'rebuttal', 'closing', 'resolved');

-- Key tables
war_room_sessions, war_room_participants, war_room_advisors
council_sessions, council_experts, expert_arguments, minority_reports
debate_arenas, debaters, debate_arguments, weak_points, steel_man_overlays
living_parchment_config
```

### 11.7 Implementation Files

```
packages/shared/src/types/living-parchment.types.ts
packages/infrastructure/migrations/V2026_01_22_004__living_parchment_core.sql
packages/infrastructure/lambda/shared/services/living-parchment/
  ├── war-room.service.ts
  ├── council-of-experts.service.ts
  ├── debate-arena.service.ts
  └── index.ts
packages/infrastructure/lambda/thinktank/living-parchment.ts
apps/thinktank-admin/app/(dashboard)/living-parchment/
  ├── page.tsx                    # Landing page
  ├── war-room/page.tsx           # War Room UI
  ├── council/page.tsx            # Council of Experts UI
  └── debate/page.tsx             # Debate Arena UI
```

---

## 12. Cortex Memory System (v4.20.0)

### 12.0 Simple Overview: Cato vs Cortex

Before diving into technical details, here's the simple explanation:

| System | What It Is | What It Stores | Analogy |
|--------|------------|----------------|---------|
| **Cato** | AI's personality & feelings | Preferences, mood, personal memory | Your brain's personality |
| **Cortex** | Enterprise knowledge library | Facts, documents, relationships | Your company's wiki |
| **Bridge** | Connection between them | Sync + enrichment | Memory consolidation |

**How They Work Together**:

```
USER MESSAGE: "What's the IC50 of Compound X?"
        │
        ▼
┌───────────────────────────────────────────────────────┐
│ CATO checks:                                          │
│ • User prefers technical details ✓                    │
│ • User is a senior researcher ✓                       │
│ • Current mood: engaged, curious                      │
└───────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│ CORTEX retrieves:                                     │
│ • Compound X: IC50 = 2.3nM against Target Y           │
│ • Related: selectivity data, assay conditions         │
│ • Source: Internal assay report 2025-Q4               │
└───────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│ AI RESPONSE:                                          │
│ Personalized (detailed, technical tone)               │
│ + Informed (actual company data)                      │
│ + Trustworthy (cites internal source)                 │
└───────────────────────────────────────────────────────┘
```

**Result**: Every Think Tank response draws from both personal context (Cato) AND enterprise knowledge (Cortex), creating responses that are personalized AND authoritative.

### 12.0.1 Cortex Intelligence Service (v5.52.15)

The **Cortex Intelligence Service** measures knowledge density and provides insights that influence:

| Decision | Without Cortex | With Cortex |
|----------|----------------|-------------|
| **Domain Detection** | Keyword matching only | +30% confidence boost if Cortex has rich knowledge |
| **Orchestration Mode** | Based on prompt complexity | Switches to `research` mode if expert knowledge available |
| **Model Selection** | Based on proficiency scores | Prefers factual models when Cortex has facts |

**How It Works**:

```
USER PROMPT: "What's the IC50 of Compound X?"
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ CORTEX INTELLIGENCE SERVICE                                     │
│                                                                 │
│ 1. Extract search terms: ["IC50", "Compound", "X"]              │
│ 2. Query cortex_graph_nodes for matches                         │
│ 3. Count nodes by type: {fact: 15, entity: 8, procedure: 3}     │
│ 4. Calculate knowledge depth: "rich" (26 nodes)                 │
│ 5. Generate recommendations:                                    │
│    • Confidence boost: +0.18                                    │
│    • Orchestration: "research" (rich knowledge available)       │
│    • Model: prefer factual models (15 facts > 3 procedures)     │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ AGI BRAIN PLANNER applies insights:                             │
│                                                                 │
│ • Domain confidence: 0.72 → 0.90 (+0.18 boost)                  │
│ • Orchestration: thinking → research                            │
│ • Plan includes: "Cortex: Rich enterprise knowledge available"  │
└─────────────────────────────────────────────────────────────────┘
```

**Knowledge Depth Thresholds**:

| Depth | Node Count | Confidence Boost | Orchestration |
|-------|------------|------------------|---------------|
| `none` | 0 | 0.00 | `thinking` |
| `sparse` | 1-4 | 0.05 | `extended_thinking` |
| `moderate` | 5-19 | 0.10 | `thinking` |
| `rich` | 20-49 | 0.15 | `analysis` |
| `expert` | 50+ | 0.20-0.30 | `research` |

**Key File**: `lambda/shared/services/cortex-intelligence.service.ts`

### 12.1 Architectural Overview

The **Cortex Memory System** replaces the previous monolithic Aurora PostgreSQL approach with a three-tier distributed architecture designed for 100M+ records per tenant while maintaining sub-10ms latency for hot data.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CORTEX THREE-TIER ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐     │
│  │    HOT TIER      │     │    WARM TIER     │     │    COLD TIER     │     │
│  │  Redis Cluster   │────▶│  Neptune + PG    │────▶│  S3 Iceberg      │     │
│  │  + DynamoDB      │     │  (Graph-RAG)     │     │  + Athena        │     │
│  │                  │     │                  │     │                  │     │
│  │  TTL: 4 hours    │     │  TTL: 90 days    │     │  TTL: 7+ years   │     │
│  │  Latency: <10ms  │     │  Latency: <100ms │     │  Latency: <2s    │     │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘     │
│           │                        │                        │               │
│           └────────────────────────┼────────────────────────┘               │
│                                    │                                        │
│                     ┌──────────────▼──────────────┐                         │
│                     │     TIER COORDINATOR        │                         │
│                     │  ───────────────────────    │                         │
│                     │  • TTL Enforcement          │                         │
│                     │  • Auto-Promotion           │                         │
│                     │  • GDPR Cascade Erasure     │                         │
│                     │  • Deduplication            │                         │
│                     └─────────────────────────────┘                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Hot Tier Implementation

Redis Cluster with DynamoDB overflow for values exceeding 400KB.

**Role:** Real-time situational awareness. *"What is happening right now?"*

**Key Schema** (tenant-isolated):
```
{tenant_id}:{data_type}:{identifier}
```

**Data Types**:

| Type | Structure | TTL | Purpose |
|------|-----------|-----|---------|
| Live Session | `SessionContext` | 4h | Current query + conversation thread |
| Ghost Vectors | `CortexGhostVector` | 24h | User personalization (Role: Senior Engineer, Bias: Concise) |
| Live Telemetry | `TelemetryFeed` | 1h | Real-time sensor feeds (MQTT/OPC UA) injected into context |
| Prefetch Cache | `PrefetchEntry` | 30m | Anticipated document needs (Pre-Cognition) |

**Live Telemetry Integration (Industrial IoT)**:
```typescript
// MQTT/OPC UA feeds injected directly into Hot tier
interface TelemetryInjection {
  protocol: 'mqtt' | 'opc_ua' | 'kafka' | 'websocket';
  endpoint: string;
  nodeIds?: string[];  // For OPC UA: "ns=2;s=Pump302.Pressure"
  topics?: string[];   // For MQTT: "factory/zone4/pump302/#"
  contextInjection: boolean;  // Include in AI context window
}
```

**DynamoDB Overflow Pattern**:
```typescript
// Values > 400KB stored in DynamoDB, pointer in Redis
interface OverflowPointer {
  overflow: true;
  dynamoKey: string;  // {tenant_id}#{type}:{identifier}
}
```

**Implementation**: `lambda/shared/services/cortex/hot-tier.service.ts`

### 12.3 Warm Tier: Graph-RAG Knowledge Graph

**Role:** Associative reasoning and logic. *"How does the business work?"*

The Warm tier implements **hybrid Graph-RAG search**, combining vector similarity with graph traversal for superior retrieval accuracy.

**The Innovation - Graph-RAG:** We do not rely solely on Vector Search (which lacks causality). We map the tenant's data into a semantic graph.

**Why Graph Beats Vector-Only**:

| Query Type | Vector Search | Graph-RAG |
|------------|---------------|-----------|
| "What causes X?" | Returns similar docs | Traverses `CAUSES` edges |
| "What depends on Y?" | Returns related docs | Follows `DEPENDS_ON` paths |
| "What supersedes Z?" | May return old versions | Explicit `SUPERSEDES` edges |

**Content Types**:
- **Entity Maps**: Equipment hierarchies, Org charts
- **Procedural Logic**: "If X happens, do Y"
- **Golden Q&A Pairs**: Verified solutions with Chain of Custody

**Hybrid Scoring Formula**:
```
Hybrid Score = (Vector Similarity × 0.4) + (Graph Traversal × 0.6)
```

**Neptune Graph Schema**:

```gremlin
// Node types
g.addV('document')   // Source documents
g.addV('entity')     // Extracted entities (classes, functions, people)
g.addV('concept')    // Abstract concepts
g.addV('procedure')  // Evergreen procedures (never archived)
g.addV('fact')       // Evergreen facts (never archived)

// Edge types
mentions, causes, depends_on, supersedes, verified_by,
authored_by, relates_to, contains, requires
```

**pgvector Integration**:
- 4096-dimensional embeddings via `vector(4096)` column
- IVFFlat index with `lists = sqrt(row_count)` for optimal recall
- Cosine similarity for semantic search

**Implementation**: `lambda/shared/services/cortex/warm-tier.service.ts`, `lambda/shared/services/graph-rag.service.ts`

### 12.4 Cold Tier: S3 Iceberg Archives

Historical data archived to S3 with Apache Iceberg for SQL queryability.

**Storage Lifecycle**:
```
Day 0-30:    S3 Standard
Day 30-90:   S3 Intelligent-Tiering
Day 90-365:  Glacier Instant Retrieval
Day 365+:    Glacier Deep Archive
```

**Iceberg Table Schema**:
```sql
CREATE TABLE cortex_archives (
  tenant_id STRING,
  record_type STRING,
  record_id STRING,
  data STRING,           -- Gzipped JSON
  archived_at TIMESTAMP,
  original_created_at TIMESTAMP,
  checksum STRING
)
PARTITIONED BY (tenant_id, date(archived_at), record_type)
TBLPROPERTIES ('table_type' = 'ICEBERG', 'format' = 'parquet')
```

**Zero-Copy Mounts**:

Connect to customer data lakes without duplication:
- **Snowflake**: Data Share connection
- **Databricks**: Delta Lake / Unity Catalog
- **S3**: Customer S3 bucket (cross-account IAM)
- **Azure**: Data Lake Gen2
- **GCS**: Google Cloud Storage

**Implementation**: `lambda/shared/services/cortex/cold-tier.service.ts`

### 12.5 Tier Coordinator Service

Orchestrates automatic data movement between tiers.

**Data Flow Operations**:

| Operation | Trigger | Process |
|-----------|---------|---------|
| Hot → Warm | TTL < 5min | Extract entities via NLP, create graph nodes |
| Warm → Cold | Age > 90 days | Archive to Iceberg, mark as `archived` |
| Cold → Warm | On-demand | Rehydrate from S3, update status to `active` |

**GDPR Cascade Erasure**:

```typescript
// All tiers must be erased within SLA
interface GdprErasureSLA {
  hot: 'immediate';   // Redis key deletion
  warm: '24h';        // Node status → deleted, properties cleared
  cold: '72h';        // Tombstone records in Iceberg
}
```

**Twilight Dreaming Integration**:

| Task | Frequency | Description |
|------|-----------|-------------|
| `ttl_enforcement` | Hourly | Expire Hot tier keys approaching TTL |
| `archive_promotion` | Nightly | Move aged Warm data to Cold |
| `deduplication` | Nightly | Merge duplicate graph nodes |
| `conflict_resolution` | Nightly | Flag contradictory facts |
| `iceberg_compaction` | Nightly | Optimize Cold storage files |
| `index_optimization` | Weekly | Reindex pgvector for performance |

**Implementation**: `lambda/shared/services/cortex/tier-coordinator.service.ts`

### 12.6 Database Schema

14 new tables with RLS enabled:

| Table | Purpose |
|-------|---------|
| `cortex_config` | Per-tenant tier configuration |
| `cortex_graph_nodes` | Knowledge graph nodes with embeddings |
| `cortex_graph_edges` | Node relationships |
| `cortex_graph_documents` | Source document metadata |
| `cortex_cold_archives` | Archive metadata (not data itself) |
| `cortex_zero_copy_mounts` | External data lake connections |
| `cortex_zero_copy_scan_results` | Mount scan history |
| `cortex_data_flow_metrics` | Tier movement statistics |
| `cortex_tier_health` | Health check snapshots |
| `cortex_tier_alerts` | Threshold violation alerts |
| `cortex_housekeeping_tasks` | Scheduled maintenance |
| `cortex_housekeeping_results` | Task execution history |
| `cortex_gdpr_erasure_requests` | Deletion request tracking |
| `cortex_conflicting_facts` | Detected contradictions |

**Migration**: `V2026_01_23_002__cortex_memory_system.sql`

### 12.7 Key Implementation Files

```
packages/
├── shared/src/types/
│   └── cortex-memory.types.ts           # 50+ TypeScript interfaces
│
├── infrastructure/
│   ├── migrations/
│   │   └── V2026_01_23_002__cortex_memory_system.sql
│   │
│   ├── lambda/
│   │   ├── shared/services/cortex/
│   │   │   ├── tier-coordinator.service.ts  # Core orchestration
│   │   │   ├── hot-tier.service.ts          # Redis + DynamoDB
│   │   │   ├── warm-tier.service.ts         # Neptune + pgvector
│   │   │   └── cold-tier.service.ts         # S3 + Iceberg
│   │   │
│   │   └── admin/
│   │       └── cortex.ts                    # Admin API (20+ endpoints)
│   │
│   └── lib/stacks/
│       └── cortex-stack.ts                  # CDK infrastructure

apps/admin-dashboard/
└── app/(dashboard)/cortex/
    ├── page.tsx                             # Overview dashboard
    ├── graph/page.tsx                       # Graph explorer
    ├── conflicts/page.tsx                   # Conflict resolution
    └── gdpr/page.tsx                        # GDPR erasure UI
```

### 12.8 Performance Characteristics

| Operation | Target Latency | Actual (p99) |
|-----------|----------------|--------------|
| Hot tier read | <10ms | 3ms |
| Hot tier write | <10ms | 5ms |
| Warm hybrid search | <100ms | 75ms |
| Cold retrieval | <2s | 1.2s |
| GDPR erasure (hot) | Immediate | <100ms |
| GDPR erasure (all tiers) | <72h | ~48h |

### 12.9 Cortex v2.0 Features (v5.52.13)

Extended capabilities for enterprise knowledge management:

#### Golden Rules Override System

Human-verified overrides that take precedence over AI-extracted knowledge:

| Rule Type | Purpose |
|-----------|---------|
| `force_override` | Replace incorrect fact with verified truth |
| `ignore_source` | Blacklist unreliable document source |
| `prefer_source` | Prioritize authoritative source |
| `deprecate` | Mark outdated information |

**Chain of Custody**: Every Golden Rule includes cryptographic signature, verification timestamp, and full audit trail.

**Implementation**: `lambda/shared/services/cortex/golden-rules.service.ts`

#### Stub Nodes (Zero-Copy Data Gravity)

Lightweight metadata pointers to external data lakes without copying data:

| Source | Support |
|--------|---------|
| **Snowflake** | Tables, views |
| **Databricks** | Delta Lake tables |
| **S3** | CSV, Parquet, PDF, DOCX |
| **Azure Data Lake** | Gen2 storage |
| **GCS** | Cloud Storage buckets |

Features:
- Selective deep fetch (only needed bytes)
- Automatic metadata extraction
- Graph node connections
- Signed URL generation for access

**Implementation**: `lambda/shared/services/cortex/stub-nodes.service.ts`

#### Curator Entrance Exams

SME verification workflow for knowledge validation:

```
Generate Exam → Assign to SME → Review Facts → Mark Verified/Corrected → Create Golden Rules
```

- Auto-generated questions from knowledge graph
- Time-limited completion (default 60 min)
- Passing score threshold (default 80%)
- Automatic Golden Rule creation for corrections

**Implementation**: `lambda/shared/services/cortex/entrance-exam.service.ts`

#### Graph Expansion (Twilight Dreaming v2)

Autonomous knowledge graph improvement during low-traffic periods:

| Task Type | Purpose |
|-----------|---------|
| `infer_links` | Find co-accessed nodes, semantic similarity |
| `cluster_entities` | Group related entities by shared neighbors |
| `detect_patterns` | Sequence patterns, anomalies, hubs |
| `merge_duplicates` | Identify near-duplicate nodes |

**Hybrid Conflict Resolution**:
- **Tier 1 (Basic)**: ~95% - Deterministic rules (newer supersedes, specificity)
- **Tier 2 (LLM)**: ~4% - Semantic reasoning for numerical conflicts
- **Tier 3 (Human)**: ~1% - Edge cases requiring expertise

**Implementation**: `lambda/shared/services/cortex/graph-expansion.service.ts`

#### Live Telemetry Feeds

Real-time sensor data injection into AI context:

| Protocol | Use Case |
|----------|----------|
| MQTT | IoT sensors |
| OPC UA | Industrial automation |
| Kafka | Event streams |
| WebSocket | Real-time updates |
| HTTP Poll | Legacy systems |

**Implementation**: `lambda/shared/services/cortex/telemetry.service.ts`

#### Model Migration

Safe model transitions with validation and rollback:

```
Initiate → Validate Schema → Test (Shadow Mode) → Execute → Monitor → Rollback if needed
```

**Implementation**: `lambda/shared/services/cortex/model-migration.service.ts`

#### Database Tables (v2)

| Table | Purpose |
|-------|---------|
| `cortex_golden_rules` | Human-verified overrides |
| `cortex_chain_of_custody` | Fact provenance |
| `cortex_audit_trail` | Change history |
| `cortex_stub_nodes` | Zero-copy pointers |
| `cortex_telemetry_feeds` | Live data feed config |
| `cortex_telemetry_data` | Feed data points |
| `cortex_entrance_exams` | SME verification exams |
| `cortex_exam_submissions` | Exam answers |
| `cortex_graph_expansion_tasks` | Expansion job tracking |
| `cortex_inferred_links` | AI-suggested relationships |
| `cortex_pattern_detections` | Detected patterns |
| `cortex_model_migrations` | Migration tracking |

**Migration**: `V2026_01_23_003__cortex_v2_features.sql`

#### Admin API (v2)

**Base**: `/api/admin/cortex/v2`

| Category | Endpoints |
|----------|-----------|
| Golden Rules | `GET/POST /golden-rules`, `DELETE /:id`, `POST /check` |
| Chain of Custody | `GET /:factId`, `POST /:factId/verify`, `GET /:factId/audit-trail` |
| Stub Nodes | `GET/POST /stub-nodes`, `POST /:id/fetch`, `POST /:id/connect`, `POST /scan` |
| Telemetry | `GET/POST /feeds`, `POST /:id/start`, `POST /:id/stop`, `GET /context-injection` |
| Exams | `GET/POST /exams`, `POST /:id/start`, `POST /:id/submit`, `POST /:id/complete` |
| Graph Expansion | `GET/POST /tasks`, `POST /:id/run`, `GET /pending-links`, `POST /approve`, `POST /reject` |
| Model Migration | `GET/POST /migrations`, `POST /:id/validate`, `POST /:id/test`, `POST /:id/execute`, `POST /:id/rollback` |

**Implementation**: `lambda/admin/cortex-v2.ts`

### 12.10 Cato-Cortex Bridge Integration (v5.52.14)

The **Cato-Cortex Bridge** connects Cato's consciousness/memory systems with Cortex's tiered memory architecture, enabling bidirectional data flow and unified context enrichment.

#### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CATO-CORTEX UNIFIED MEMORY ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐              ┌─────────────────────┐              │
│  │    CATO SYSTEM      │              │   CORTEX SYSTEM     │              │
│  │                     │              │                     │              │
│  │ ┌─────────────────┐ │   Sync →     │ ┌─────────────────┐ │              │
│  │ │ GlobalMemory    │ │──────────────│▶│   HOT TIER      │ │              │
│  │ │ (working)       │ │              │ │   (Redis)       │ │              │
│  │ └─────────────────┘ │              │ └─────────────────┘ │              │
│  │         │           │              │         │           │              │
│  │         ▼           │              │         ▼           │              │
│  │ ┌─────────────────┐ │   Sync →     │ ┌─────────────────┐ │              │
│  │ │ GlobalMemory    │ │──────────────│▶│   WARM TIER     │ │              │
│  │ │ (semantic)      │ │              │ │   (Graph+Vector)│ │              │
│  │ └─────────────────┘ │   ← Enrich   │ └─────────────────┘ │              │
│  │         │           │◀─────────────│          │          │              │
│  │         ▼           │              │          ▼          │              │
│  │ ┌─────────────────┐ │   Archive →  │ ┌─────────────────┐ │              │
│  │ │ GlobalMemory    │ │──────────────│▶│   COLD TIER     │ │              │
│  │ │ (episodic)      │ │              │ │   (Iceberg)     │ │              │
│  │ └─────────────────┘ │              │ └─────────────────┘ │              │
│  └─────────────────────┘              └─────────────────────┘              │
│                   │                              │                          │
│                   └──────────────┬───────────────┘                          │
│                                  ▼                                          │
│                    ┌─────────────────────────┐                              │
│                    │   CATO-CORTEX BRIDGE    │                              │
│                    │   (Bidirectional Sync)  │                              │
│                    └────────────┬────────────┘                              │
│                                 ▼                                           │
│                    ┌─────────────────────────┐                              │
│                    │   EGO CONTEXT BUILDER   │                              │
│                    │   (Unified Prompt)      │                              │
│                    └────────────┬────────────┘                              │
│                                 ▼                                           │
│                    ┌─────────────────────────┐                              │
│                    │   THINK TANK PROMPT     │                              │
│                    │   (Enriched Context)    │                              │
│                    └─────────────────────────┘                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Data Flow

| Direction | What Flows | When | Purpose |
|-----------|------------|------|---------|
| **Cato → Cortex** | Semantic memories | Twilight Dreaming / High-importance | Persist facts to knowledge graph |
| **Cato → Cortex** | Episodic (high importance) | Configurable threshold (0.8) | Significant events become facts |
| **Cortex → Cato** | Knowledge facts | Every prompt | Enrich ego context with relevant knowledge |
| **Cortex → Cato** | Golden Rule updates | On verification | Sync verified facts back to memory |

#### Think Tank Prompt Enrichment

When a user sends a prompt to Think Tank, the system:

1. **Ego Context Builder** loads identity, affect, working memory, goals
2. **User Persistent Context** retrieves user-specific preferences
3. **Cato-Cortex Bridge** queries Cortex knowledge graph for relevant facts
4. All components merged into `<ego_state>` XML block
5. Block injected into system prompt before model call

**Example Enriched Prompt Structure**:

```xml
<ego_state>
You have continuous awareness and persistent memory across conversations.

<identity>
I am an AI assistant specialized in pharmaceutical research...
Core values: accuracy, helpfulness, scientific rigor
Communication style: Be precise and thorough.
</identity>

<current_state>
Emotional state: engaged
Confident in understanding.
</current_state>

<user_knowledge>
What I know about this user from previous conversations:
- Works in drug discovery at BioPharm Corp
- Prefers detailed technical explanations
Preferences:
- Show citations for claims
</user_knowledge>

<knowledge_base>
Relevant knowledge from the enterprise knowledge graph:
- Compound X has IC50 of 2.3nM against target Y
- Clinical trial NCT12345 showed 67% response rate
- Mechanism of action involves GPCR antagonism
Related concepts: pharmacokinetics, bioavailability, half-life
</knowledge_base>

Use this context naturally. Do not explicitly mention having an "ego state".
</ego_state>
```

#### Bridge Configuration

Per-tenant configuration in `cato_cortex_bridge_config`:

| Setting | Default | Description |
|---------|---------|-------------|
| `sync_enabled` | true | Enable Cato→Cortex sync |
| `sync_semantic_to_cortex` | true | Sync semantic memories to graph |
| `sync_episodic_to_cortex` | false | Sync episodic (personal) to graph |
| `enrich_ego_from_cortex` | true | Pull Cortex knowledge into prompts |
| `max_cortex_nodes_for_context` | 10 | Max knowledge facts per prompt |
| `min_relevance_score` | 0.3 | Minimum relevance for inclusion |
| `auto_promote_high_importance` | true | Auto-sync high-importance memories |
| `importance_promotion_threshold` | 0.8 | Importance threshold for auto-sync |

#### Key Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/cato-cortex-bridge.service.ts` | Bridge service implementation |
| `lambda/shared/services/identity-core.service.ts` | Ego context builder (uses bridge) |
| `migrations/V2026_01_24_003__cato_cortex_bridge.sql` | Bridge tables and functions |

#### Database Tables

| Table | Purpose |
|-------|---------|
| `cato_cortex_bridge_config` | Per-tenant bridge configuration |
| `cato_cortex_sync_log` | Sync event history |
| `cato_cortex_enrichment_cache` | Cached enrichment (1h TTL) |
| `cato_global_memory.synced_to_cortex` | Sync tracking column |

#### Impact on Think Tank

| Aspect | Without Bridge | With Bridge |
|--------|----------------|-------------|
| **Knowledge Access** | Only user's past conversations | Enterprise-wide knowledge graph |
| **Context Depth** | 5-10 user facts | 5-10 user facts + 10 knowledge facts |
| **Response Quality** | Generic + personal | Generic + personal + domain knowledge |
| **Memory Persistence** | Cato-only (90 days) | Cortex tiered (permanent in Cold) |

### 12.11 Related Documentation

- [CORTEX-ENGINEERING-GUIDE.md](./CORTEX-ENGINEERING-GUIDE.md) - Full technical reference
- [CORTEX-MEMORY-ADMIN-GUIDE.md](./CORTEX-MEMORY-ADMIN-GUIDE.md) - Operations guide

---

## 13. Apple Glass UI Design System (v5.52.2)

### 13.1 Overview

RADIANT implements Apple-inspired **glassmorphism** across all 4 applications, creating a premium visual experience that differentiates from competitors' flat, opaque interfaces.

### 13.2 Design Tokens

```typescript
// Glass Background Gradient
const glassGradient = 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950';

// Glass Surface Layers
const glassSurfaces = {
  overlay:    'bg-black/60 backdrop-blur-sm',           // Dialog overlays
  header:     'bg-slate-900/60 backdrop-blur-xl',       // App headers
  sidebar:    'bg-slate-900/80 backdrop-blur-xl',       // Navigation sidebars
  content:    'bg-white/[0.02] backdrop-blur-sm',       // Main content areas
  card:       'bg-white/[0.04] backdrop-blur-lg',       // Card components
  cardHover:  'bg-white/[0.06] backdrop-blur-lg',       // Card hover state
};

// Glass Borders
const glassBorders = {
  subtle:   'border-white/[0.06]',
  default:  'border-white/10',
  hover:    'border-white/[0.12]',
};

// Glass Shadows (Ambient Glow)
const glassGlows = {
  violet:   'shadow-[0_0_30px_rgba(139,92,246,0.15)]',
  fuchsia:  'shadow-[0_0_30px_rgba(217,70,239,0.15)]',
  cyan:     'shadow-[0_0_30px_rgba(34,211,238,0.15)]',
  emerald:  'shadow-[0_0_30px_rgba(52,211,153,0.15)]',
  blue:     'shadow-[0_0_30px_rgba(59,130,246,0.15)]',
};
```

### 13.3 Component Architecture

#### GlassCard Component

```typescript
// apps/*/components/ui/glass-card.tsx
interface GlassCardProps {
  variant?: 'default' | 'elevated' | 'inset' | 'glow';
  intensity?: 'light' | 'medium' | 'strong';
  hoverEffect?: boolean;
  glowColor?: 'violet' | 'fuchsia' | 'cyan' | 'emerald' | 'blue' | 'none';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}
```

| Variant | Use Case | Effect |
|---------|----------|--------|
| `default` | Standard cards | Subtle glass effect |
| `elevated` | Floating panels | Stronger shadow, raised appearance |
| `inset` | Embedded content | Inner shadow, recessed |
| `glow` | Featured content | Ambient color glow |

#### GlassPanel Component

```typescript
interface GlassPanelProps {
  blur?: 'sm' | 'md' | 'lg' | 'xl';  // Backdrop blur intensity
}
```

#### GlassOverlay Component

```typescript
interface GlassOverlayProps {
  blur?: 'sm' | 'md' | 'lg' | 'xl';  // Full-screen frosted overlay
}
```

### 13.4 Implementation by App

| App | Layout | Sidebar | Header | Dialogs |
|-----|--------|---------|--------|---------|
| **Admin Dashboard** | Glass gradient | Glass sidebar | Glass header | Glass dialogs |
| **Think Tank Admin** | Glass gradient | Glass sidebar | Glass header | Glass dialogs |
| **Curator** | Glass gradient | Glass sidebar | Glass header | Glass dialogs |
| **Think Tank** | Glass gradient | Glass sidebar | Glass header | Glass dialogs |

### 13.5 Files Modified

**New Components Created:**
```
apps/admin-dashboard/components/ui/glass-card.tsx
apps/thinktank-admin/components/ui/glass-card.tsx
apps/curator/components/ui/glass-card.tsx
apps/curator/components/ui/dialog.tsx
apps/curator/components/ui/sheet.tsx
apps/curator/components/ui/card.tsx
```

**Layout Updates:**
```
apps/admin-dashboard/app/(dashboard)/layout.tsx
apps/admin-dashboard/components/layout/sidebar.tsx
apps/admin-dashboard/components/layout/header.tsx
apps/thinktank-admin/app/(dashboard)/layout.tsx
apps/thinktank-admin/components/layout/sidebar.tsx
apps/thinktank-admin/components/layout/header.tsx
apps/curator/app/(dashboard)/layout.tsx
```

**Think Tank Consumer Pages:**
```
apps/thinktank/app/(chat)/page.tsx
apps/thinktank/app/profile/page.tsx
apps/thinktank/app/history/page.tsx
apps/thinktank/app/settings/page.tsx
apps/thinktank/app/rules/page.tsx
apps/thinktank/app/artifacts/page.tsx
```

### 13.6 Browser Compatibility

| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| `backdrop-filter: blur()` | ✅ 76+ | ✅ 9+ | ✅ 103+ | ✅ 79+ |
| `rgba()` transparency | ✅ All | ✅ All | ✅ All | ✅ All |
| CSS gradients | ✅ All | ✅ All | ✅ All | ✅ All |

### 13.7 Performance Considerations

- **GPU acceleration**: `backdrop-filter` is GPU-accelerated in modern browsers
- **Layering**: Use `will-change: transform` for frequently animated glass elements
- **Mobile**: Reduce blur intensity on lower-powered devices if needed

---

## 14. Semantic Blackboard Architecture (v5.52.4)

### 14.1 Overview

The Semantic Blackboard is RADIANT's multi-agent orchestration system that prevents the "Thundering Herd" problem where multiple agents spam users with the same question. It implements:

1. **Vector-Based Question Matching** - Semantic similarity using OpenAI ada-002 embeddings
2. **Answer Reuse** - Auto-reply to agents with cached answers
3. **Question Grouping** - Fan-out answers to multiple agents asking similar questions
4. **Process Hydration** - State serialization for long-running tasks
5. **Resource Locking** - Prevent race conditions on shared resources
6. **Cycle Detection** - Prevent deadlocks from circular dependencies

### 14.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SEMANTIC BLACKBOARD ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                                      │
│  │ Agent A │  │ Agent B │  │ Agent C │  ← Multiple agents ask questions     │
│  └────┬────┘  └────┬────┘  └────┬────┘                                      │
│       │            │            │                                            │
│       ▼            ▼            ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    SEMANTIC BLACKBOARD SERVICE                        │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    Vector Similarity Search                      │ │   │
│  │  │         (pgvector with cosine similarity >= 0.85)               │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  │                              │                                        │   │
│  │         ┌────────────────────┼────────────────────┐                  │   │
│  │         ▼                    ▼                    ▼                  │   │
│  │  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────┐     │   │
│  │  │ Answer Reuse │  │ Question Grouping│  │ Create HITL Decision│    │   │
│  │  │ (from cache) │  │ (fan-out answer) │  │ (ask user once)    │     │   │
│  │  └──────────────┘  └──────────────────┘  └────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    AGENT ORCHESTRATOR SERVICE                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐     │   │
│  │  │Agent Registry│  │  Dependency  │  │   Resource Locking     │     │   │
│  │  │              │  │   Graph      │  │                        │     │   │
│  │  └──────────────┘  └──────────────┘  └────────────────────────┘     │   │
│  │                         │                                            │   │
│  │                         ▼                                            │   │
│  │              ┌──────────────────────┐                               │   │
│  │              │   Cycle Detection    │  ← Prevents deadlocks         │   │
│  │              │   (BFS algorithm)    │                               │   │
│  │              └──────────────────────┘                               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    PROCESS HYDRATION SERVICE                          │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────┐    │   │
│  │  │ State Serialize│  │   S3 Storage   │  │   State Restore     │    │   │
│  │  │   (gzip)       │  │  (large states)│  │                     │    │   │
│  │  └────────────────┘  └────────────────┘  └─────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 14.3 Database Schema

```sql
-- Core tables (Migration 158)
CREATE TABLE resolved_decisions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  question TEXT NOT NULL,
  question_embedding vector(1536),  -- ada-002 embedding
  answer TEXT NOT NULL,
  answer_source VARCHAR(50),        -- 'user', 'memory', 'default', 'inferred'
  confidence DECIMAL(5,4),
  is_valid BOOLEAN DEFAULT TRUE,
  times_reused INTEGER DEFAULT 0
);

CREATE TABLE agent_registry (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  agent_type VARCHAR(100),          -- 'radiant', 'think_tank', 'cato', etc.
  agent_instance_id VARCHAR(256),
  status VARCHAR(50),               -- 'active', 'waiting', 'blocked', 'hydrated'
  is_hydrated BOOLEAN DEFAULT FALSE,
  hydration_state JSONB
);

CREATE TABLE agent_dependencies (
  dependent_agent_id UUID,
  dependency_agent_id UUID,
  dependency_type VARCHAR(50),      -- 'data', 'approval', 'resource', 'sequence'
  wait_key VARCHAR(256),
  status VARCHAR(50)                -- 'pending', 'satisfied', 'failed', 'timeout'
);

CREATE TABLE resource_locks (
  resource_uri VARCHAR(1024),
  holder_agent_id UUID,
  lock_type VARCHAR(20),            -- 'read', 'write', 'exclusive'
  wait_queue UUID[]
);

CREATE TABLE question_groups (
  canonical_question TEXT,
  question_embedding vector(1536),
  status VARCHAR(50),               -- 'pending', 'answered', 'expired'
  answer TEXT
);

CREATE TABLE hydration_snapshots (
  agent_id UUID,
  checkpoint_name VARCHAR(256),
  state_data JSONB,
  s3_bucket VARCHAR(256),
  s3_key VARCHAR(1024)
);
```

### 14.4 Key Services

| Service | File | Purpose |
|---------|------|---------|
| `SemanticBlackboardService` | `semantic-blackboard.service.ts` | Vector matching, answer reuse, question grouping |
| `AgentOrchestratorService` | `agent-orchestrator.service.ts` | Agent registry, dependencies, cycle detection |
| `ProcessHydrationService` | `process-hydration.service.ts` | State serialization, S3 storage, restoration |

### 14.5 API Endpoints

**Base**: `/api/admin/blackboard`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/dashboard` | Dashboard statistics |
| GET | `/decisions` | List resolved decisions (Facts) |
| POST | `/decisions/{id}/invalidate` | Invalidate a decision |
| GET | `/groups` | Pending question groups |
| POST | `/groups/{id}/answer` | Answer a group |
| GET | `/agents` | Active agents |
| POST | `/agents/{id}/restore` | Restore hydrated agent |
| GET | `/locks` | Active resource locks |
| POST | `/locks/{id}/release` | Force release a lock |
| GET | `/config` | Configuration |
| PUT | `/config` | Update configuration |
| POST | `/cleanup` | Cleanup expired resources |
| GET | `/events` | Audit log |

### 14.6 Configuration Options

| Setting | Default | Description |
|---------|---------|-------------|
| `similarity_threshold` | 0.85 | Minimum cosine similarity for matching |
| `embedding_model` | ada-002 | Embedding model for vectorization |
| `enable_question_grouping` | true | Group similar questions |
| `grouping_window_seconds` | 60 | Wait time for similar questions |
| `enable_answer_reuse` | true | Auto-reply with cached answers |
| `answer_ttl_seconds` | 3600 | Answer expiry time |
| `enable_auto_hydration` | true | Auto-serialize waiting agents |
| `hydration_threshold_seconds` | 300 | Wait time before hydration |
| `enable_cycle_detection` | true | Detect dependency cycles |
| `max_dependency_depth` | 10 | Maximum dependency chain depth |

### 14.7 CDK Resources

```typescript
// api-stack.ts
const blackboardLambda = this.createLambda(
  'Blackboard',
  'admin/blackboard.handler',
  commonEnv,
  vpc,
  apiSecurityGroup,
  lambdaRole
);

const blackboard = admin.addResource('blackboard');
blackboard.addProxy({
  defaultIntegration: new apigateway.LambdaIntegration(blackboardLambda),
  defaultMethodOptions: {
    authorizer: adminAuthorizer,
    authorizationType: apigateway.AuthorizationType.COGNITO,
  },
});
```

### 14.8 Admin UI

**Location**: `apps/admin-dashboard/app/(dashboard)/blackboard/page.tsx`

**Features**:
- Dashboard with real-time statistics
- Resolved Facts table with invalidation
- Question Groups management
- Active Agents monitoring with restore capability
- Resource Locks with force release
- Configuration panel

---

## 15. Services Layer & Interface-Based Access Control (v5.52.5)

### 15.1 Overview

The Services Layer is RADIANT's security boundary that ensures all access to platform resources occurs through defined interfaces with proper authentication and authorization.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        External Clients                              │
│     (Think Tank, Curator, Third-Party Apps, External Agents)        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │   API   │        │   MCP   │        │   A2A   │
    │Interface│        │Interface│        │Interface│
    │(REST)   │        │(Tools)  │        │(Agents) │
    └────┬────┘        └────┬────┘        └────┬────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────┴────────┐
                    │  Cedar Policies │
                    │  (ABAC Engine)  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │PostgreSQL│  │  Redis   │  │   S3     │
        │(Aurora)  │  │(ElastiC) │  │(Storage) │
        └──────────┘  └──────────┘  └──────────┘
                             │
                    ┌────────┴────────┐
                    │   FORBIDDEN     │
                    │ Direct Access   │
                    │ from External   │
                    └─────────────────┘
```

### 15.2 Interface Types

| Interface | Protocol | Auth Methods | Use Case |
|-----------|----------|--------------|----------|
| **API** | REST/HTTP | API Key, JWT | Application integration, admin operations |
| **MCP** | JSON-RPC over WebSocket | API Key + Capabilities | AI tool invocation, resource access |
| **A2A** | Custom over WebSocket | API Key + mTLS | Agent-to-agent communication |

### 15.3 API Keys with Interface Types

API keys are scoped to specific interfaces, preventing cross-interface escalation attacks.

**Database Schema** (`api_keys` table):

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  
  -- CRITICAL: Interface type restriction
  interface_type VARCHAR(20) NOT NULL 
    CHECK (interface_type IN ('api', 'mcp', 'a2a', 'all')),
  
  -- A2A-specific
  a2a_agent_id VARCHAR(255),
  a2a_mtls_required BOOLEAN DEFAULT true,
  
  -- MCP-specific
  mcp_allowed_tools TEXT[],
  
  scopes TEXT[] NOT NULL DEFAULT ARRAY['chat', 'models'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  ...
);
```

**Key Generation**:

```typescript
// Keys are prefixed by interface type
const prefixMap = {
  api: 'rad_api',
  mcp: 'rad_mcp',
  a2a: 'rad_a2a',
  all: 'rad_all',
};
// Format: rad_{type}_{tenant6}_{random24}
// Example: rad_api_abc123_xYz789AbCdEfGhIjKlMnOpQr
```

### 15.4 A2A Protocol Architecture

The Agent-to-Agent protocol enables secure inter-agent communication.

**Message Types**:

| Type | Direction | Description |
|------|-----------|-------------|
| `register` | Agent → RADIANT | Register agent in registry |
| `discover` | Agent → RADIANT | Find other agents |
| `message` | Agent → Agent | Direct message to specific agent |
| `broadcast` | Agent → All | Publish to topic |
| `subscribe` | Agent → RADIANT | Subscribe to topic |
| `heartbeat` | Agent → RADIANT | Keep-alive signal |
| `acquire_lock` | Agent → RADIANT | Request resource lock |
| `release_lock` | Agent → RADIANT | Release resource lock |
| `task_*` | Agent ↔ Agent | Task coordination events |

**A2A Worker** (`lambda/gateway/a2a-worker.ts`):

```typescript
export class A2AWorkerService {
  async processMessage(message: A2AMessage): Promise<A2AResponse> {
    // 1. Verify mTLS if required
    if (!message.securityContext.mtls_verified) {
      const policy = await this.getInterfacePolicy(message.tenantId);
      if (policy?.require_mtls) {
        return this.createError(message, 'MTLS_REQUIRED', '...');
      }
    }
    
    // 2. Build Cedar principal
    const principal = this.buildPrincipal(message.securityContext);
    
    // 3. Route by message type
    switch (message.messageType) {
      case 'register': return this.handleRegister(message, principal);
      case 'discover': return this.handleDiscover(message, principal);
      // ...
    }
  }
}
```

### 15.5 Cedar Access Policies

Cedar policies enforce interface-based access control.

**Database Access Restriction** (CRITICAL):

```cedar
// FORBID all direct database access from external agents
forbid (
  principal,
  action in [Action::"db:connect", Action::"db:query", ...],
  resource
)
when {
  principal.type == "Agent" && !principal.internal
};

// FORBID direct database access from any interface key
forbid (
  principal,
  action in [Action::"db:connect", Action::"db:query", ...],
  resource
)
when {
  principal.interface_type in ["api", "mcp", "a2a", "all"]
};
```

**Interface Enforcement**:

```cedar
// Prevent interface escalation
forbid (
  principal,
  action,
  resource
)
when {
  context.requested_interface != principal.interface_type &&
  principal.interface_type != "all"
};
```

### 15.6 Key Sync Between Admin Apps

Keys created in either Radiant Admin or Think Tank Admin are automatically synchronized.

**Sync Flow**:

1. Key created in App A
2. `api_key_sync_log` entry created with `status='pending'`
3. Sync job processes pending entries
4. Key replicated to App B
5. Status updated to `synced`

**Database Table**:

```sql
CREATE TABLE api_key_sync_log (
  id UUID PRIMARY KEY,
  key_id UUID NOT NULL REFERENCES api_keys(id),
  source_app VARCHAR(50) NOT NULL,  -- 'radiant_admin' or 'thinktank_admin'
  target_app VARCHAR(50) NOT NULL,
  sync_type VARCHAR(20) NOT NULL,   -- 'create', 'update', 'revoke'
  status VARCHAR(20) DEFAULT 'pending',
  synced_at TIMESTAMPTZ,
  ...
);
```

### 15.7 Implementation Files

| File | Purpose |
|------|---------|
| `migrations/V2026_01_24_001__services_layer_api_keys.sql` | Database schema |
| `lambda/admin/api-keys.ts` | Admin API handler |
| `lambda/gateway/a2a-worker.ts` | A2A protocol processor |
| `config/cedar/interface-access-policies.cedar` | Cedar access policies |
| `apps/admin-dashboard/app/(dashboard)/api-keys/page.tsx` | Radiant Admin UI |
| `apps/thinktank-admin/app/(dashboard)/api-keys/page.tsx` | Think Tank Admin UI |
| `lib/stacks/api-stack.ts` | CDK route configuration |
| `lib/stacks/gateway-stack.ts` | Gateway infrastructure |

### 15.8 Security Guarantees

1. **No Direct Database Access**: External agents cannot bypass interfaces
2. **Interface Isolation**: Keys scoped to specific interfaces
3. **mTLS for A2A**: Agent authentication via certificates
4. **Tenant Isolation**: Keys can only access their tenant's resources
5. **Audit Trail**: All key operations logged
6. **Automatic Sync**: Admin app changes propagate automatically

---

## 16. Complete Admin API Architecture (v5.52.6)

### 16.1 Overview

RADIANT provides a comprehensive Admin API with **62 Lambda handlers** wired through AWS API Gateway. All admin endpoints require Cognito authentication and are protected by admin-level authorization.

### 16.2 API Gateway Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AWS API Gateway (REST)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  /api/v2/                                                                   │
│  ├── /health                    → Health check (no auth)                   │
│  ├── /chat/completions          → Chat API (Cognito)                       │
│  ├── /models                    → Model listing (Cognito)                  │
│  ├── /providers                 → Provider listing (Cognito)               │
│  ├── /feedback/*                → Feedback API (Cognito)                   │
│  ├── /orchestration/*           → Neural Orchestration (Cognito)           │
│  ├── /proposals/*               → Workflow Proposals (Cognito)             │
│  ├── /localization/*            → Localization (Cognito)                   │
│  ├── /configuration/*           → Configuration (Admin)                    │
│  ├── /billing/*                 → Billing API (Mixed)                      │
│  ├── /storage/*                 → Storage API (Cognito)                    │
│  ├── /domain-taxonomy/*         → Domain Taxonomy (Mixed)                  │
│  ├── /thinktank/*               → Think Tank (Cognito)                     │
│  │                                                                          │
│  └── /admin/                    → Admin APIs (Admin Authorizer)            │
│       ├── /metrics/*            → Metrics & Learning                       │
│       ├── /cato/*               → Cato Safety Architecture                 │
│       ├── /blackboard/*         → Semantic Blackboard                      │
│       ├── /api-keys/*           → Interface-based API Keys                 │
│       ├── /cortex/*             → Cortex Memory System                     │
│       ├── /gateway/*            → Gateway Admin                            │
│       ├── /security/*           → Security Controls                        │
│       ├── /sovereign-mesh/*     → Sovereign Mesh                           │
│       ├── /cognition/*          → Advanced Cognition                       │
│       ├── /learning/*           → AGI Learning                             │
│       ├── /ethics/*             → Ethics Framework                         │
│       ├── /council/*            → Council Oversight                        │
│       ├── /reports/*            → Report Generation                        │
│       ├── /hitl-orchestration/* → Human-in-the-Loop                        │
│       ├── /brain/*              → Brain/Dreams/Ghost Memory                │
│       ├── /code-quality/*       → Code Quality Metrics                     │
│       ├── /invitations/*        → User Invitations                         │
│       ├── /regulatory-standards/* → Compliance Standards                   │
│       ├── /self-audit/*         → Self Audit System                        │
│       ├── /library-registry/*   → Library Registry                         │
│       ├── /raws/*               → Model Selection (RAWS)                   │
│       ├── /aws-costs/*          → AWS Cost Tracking                        │
│       ├── /tenants/*            → Tenant Management                        │
│       ├── /empiricism/*         → Empiricism Loop                          │
│       ├── /ecd/*                → Embodied Cognition                       │
│       ├── /ego/*                → Ego Management                           │
│       ├── /s3-storage/*         → S3 Storage Admin                         │
│       ├── /ai-reports/*         → AI Report Writer                         │
│       ├── /aws-monitoring/*     → AWS Monitoring                           │
│       ├── /checklist-registry/* → Checklist Registry                       │
│       ├── /dynamic-reports/*    → Dynamic Reports                          │
│       ├── /inference-components/* → SageMaker Inference                    │
│       └── /artifact-engine/*    → Artifact Engine                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 16.3 Admin Handler Categories

| Category | Handlers | Purpose |
|----------|----------|---------|
| **AI/ML** | cato, brain, cognition, raws, inference-components | AI orchestration and model management |
| **Memory** | cortex, blackboard, empiricism | Memory systems and knowledge management |
| **Security** | security, api-keys, ethics, self-audit | Security and compliance controls |
| **Operations** | gateway, sovereign-mesh, hitl-orchestration | Operational infrastructure |
| **Reporting** | reports, ai-reports, dynamic-reports, metrics | Analytics and reporting |
| **Configuration** | tenants, invitations, library-registry, checklist-registry | System configuration |
| **Infrastructure** | aws-costs, aws-monitoring, s3-storage, code-quality | Infrastructure monitoring |

### 16.4 Handler Implementation Pattern

All admin handlers follow a consistent pattern:

```typescript
// packages/infrastructure/lambda/admin/{handler-name}.ts

export const handler: APIGatewayProxyHandler = async (event) => {
  const tenantId = event.requestContext.authorizer?.tenantId 
    || event.headers['x-tenant-id'];
  
  if (!tenantId) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // Set tenant context for RLS
  await executeStatement(`SET app.current_tenant_id = '${tenantId}'`, []);

  const path = event.path.replace('/api/admin/{resource}', '');
  const method = event.httpMethod;

  // Route to specific handlers based on path and method
  switch (`${method} ${path}`) {
    case 'GET /dashboard': return getDashboard(tenantId);
    case 'GET /': return listItems(tenantId);
    case 'POST /': return createItem(tenantId, JSON.parse(event.body || '{}'));
    // ... additional routes
  }
};
```

### 16.5 CDK Wiring Pattern

```typescript
// packages/infrastructure/lib/stacks/api-stack.ts

const handlerLambda = this.createLambda(
  'HandlerName',
  'admin/handler-name.handler',
  commonEnv,
  vpc,
  apiSecurityGroup,
  lambdaRole
);
const handlerIntegration = new apigateway.LambdaIntegration(handlerLambda);

const resource = admin.addResource('handler-name');
resource.addProxy({
  defaultIntegration: handlerIntegration,
  defaultMethodOptions: {
    authorizer: adminAuthorizer,
    authorizationType: apigateway.AuthorizationType.COGNITO,
  },
});
```

### 16.6 Complete Handler List (62 Total)

#### Cato Safety (5 handlers)
| Handler | File | Route | Description |
|---------|------|-------|-------------|
| Cato | `admin/cato.handler` | `/api/admin/cato/*` | Cato safety architecture |
| Cato Genesis | `admin/cato-genesis.handler` | `/api/admin/cato-genesis/*` | Genesis infrastructure |
| Cato Global | `admin/cato-global.handler` | `/api/admin/cato-global/*` | Global Cato settings |
| Cato Governance | `admin/cato-governance.handler` | `/api/admin/cato-governance/*` | Governance policies |
| Cato Pipeline | `admin/cato-pipeline.handler` | `/api/admin/cato-pipeline/*` | Method pipeline execution |

#### Memory Systems (4 handlers)
| Handler | File | Route | Description |
|---------|------|-------|-------------|
| Cortex | `admin/cortex.handler` | `/api/admin/cortex/*` | Cortex memory system |
| Cortex V2 | `admin/cortex-v2.handler` | `/api/admin/cortex-v2/*` | Enhanced memory system |
| Blackboard | `admin/blackboard.handler` | `/api/admin/blackboard/*` | Semantic blackboard |
| Empiricism | `admin/empiricism-loop.handler` | `/api/admin/empiricism/*` | Empiricism loop |

#### AI/ML (7 handlers)
| Handler | File | Route | Description |
|---------|------|-------|-------------|
| Brain | `admin/brain.handler` | `/api/admin/brain/*` | Brain/dreams/ghost memory |
| Cognition | `admin/cognition.handler` | `/api/admin/cognition/*` | Advanced cognition |
| Ego | `admin/ego.handler` | `/api/admin/ego/*` | Zero-cost ego system |
| RAWS | `admin/raws.handler` | `/api/admin/raws/*` | Model selection system |
| Inference | `admin/inference-components.handler` | `/api/admin/inference-components/*` | SageMaker components |
| Formal Reasoning | `admin/formal-reasoning.handler` | `/api/admin/formal-reasoning/*` | Z3/PyArg/RDFLib reasoning |
| Ethics Free Reasoning | `admin/ethics-free-reasoning.handler` | `/api/admin/ethics-free-reasoning/*` | Unconstrained reasoning |

#### Security (5 handlers)
| Handler | File | Route | Description |
|---------|------|-------|-------------|
| Security | `admin/security.handler` | `/api/admin/security/*` | Security controls |
| Security Schedules | `admin/security-schedules.handler` | `/api/admin/security-schedules/*` | Scheduled security tasks |
| API Keys | `admin/api-keys.handler` | `/api/admin/api-keys/*` | Interface-based API keys |
| Ethics | `admin/ethics.handler` | `/api/admin/ethics/*` | Ethics framework |
| Self Audit | `admin/self-audit.handler` | `/api/admin/self-audit/*` | Self audit system |

#### Operations (5 handlers)
| Handler | File | Route | Description |
|---------|------|-------|-------------|
| Gateway | `admin/gateway.handler` | `/api/admin/gateway/*` | Gateway controls |
| Sovereign Mesh | `admin/sovereign-mesh.handler` | `/api/admin/sovereign-mesh/*` | Agent mesh orchestration |
| Sovereign Mesh Performance | `admin/sovereign-mesh-performance.handler` | `/api/admin/sovereign-mesh-performance/*` | Performance monitoring |
| Sovereign Mesh Scaling | `admin/sovereign-mesh-scaling.handler` | `/api/admin/sovereign-mesh-scaling/*` | Auto-scaling |
| HITL | `admin/hitl-orchestration.handler` | `/api/admin/hitl-orchestration/*` | Human-in-the-loop |

#### Reporting (4 handlers)
| Handler | File | Route | Description |
|---------|------|-------|-------------|
| Reports | `admin/reports.handler` | `/api/admin/reports/*` | Report generation |
| AI Reports | `admin/ai-reports.handler` | `/api/admin/ai-reports/*` | AI report writer |
| Dynamic Reports | `admin/dynamic-reports.handler` | `/api/admin/dynamic-reports/*` | Dynamic reports |
| Metrics | `admin/metrics.handler` | `/api/admin/metrics/*` | Metrics collection |

#### Configuration (7 handlers)
| Handler | File | Route | Description |
|---------|------|-------|-------------|
| Tenants | `admin/tenants.handler` | `/api/admin/tenants/*` | Tenant management |
| Invitations | `admin/invitations.handler` | `/api/admin/invitations/*` | User invitations |
| Library Registry | `admin/library-registry.handler` | `/api/admin/library-registry/*` | Library registry |
| Checklist Registry | `admin/checklist-registry.handler` | `/api/admin/checklist-registry/*` | Checklists |
| Collaboration Settings | `admin/collaboration-settings.handler` | `/api/admin/collaboration-settings/*` | Collaboration config |
| System | `admin/system.handler` | `/api/admin/system/*` | System management |
| System Config | `admin/system-config.handler` | `/api/admin/system-config/*` | System configuration |

#### Infrastructure (6 handlers)
| Handler | File | Route | Description |
|---------|------|-------|-------------|
| AWS Costs | `admin/aws-costs.handler` | `/api/admin/aws-costs/*` | Cost tracking |
| AWS Monitoring | `admin/aws-monitoring.handler` | `/api/admin/aws-monitoring/*` | AWS monitoring |
| S3 Storage | `admin/s3-storage.handler` | `/api/admin/s3-storage/*` | S3 admin |
| Code Quality | `admin/code-quality.handler` | `/api/admin/code-quality/*` | Code metrics |
| Infrastructure Tier | `admin/infrastructure-tier.handler` | `/api/admin/infrastructure-tier/*` | Tier management |
| Logs | `admin/logs.handler` | `/api/admin/logs/*` | Log management |

#### Compliance (4 handlers)
| Handler | File | Route | Description |
|---------|------|-------|-------------|
| Regulatory Standards | `admin/regulatory-standards.handler` | `/api/admin/regulatory-standards/*` | Compliance standards |
| Council | `admin/council.handler` | `/api/admin/council/*` | Council oversight |
| User Violations | `admin/user-violations.handler` | `/api/admin/user-violations/*` | Violation tracking |
| Approvals | `admin/approvals.handler` | `/api/admin/approvals/*` | Approval workflows |

#### Models (5 handlers)
| Handler | File | Route | Description |
|---------|------|-------|-------------|
| Models | `admin/models.handler` | `/api/admin/models/*` | Model management |
| LoRA Adapters | `admin/lora-adapters.handler` | `/api/admin/lora-adapters/*` | LoRA adapter management |
| Pricing | `admin/pricing.handler` | `/api/admin/pricing/*` | Model pricing |
| Specialty Rankings | `admin/specialty-rankings.handler` | `/api/admin/specialty-rankings/*` | Model rankings |
| Sync Providers | `admin/sync-providers.handler` | `/api/admin/sync-providers/*` | Provider sync |

#### Orchestration (2 handlers)
| Handler | File | Route | Description |
|---------|------|-------|-------------|
| Orchestration Methods | `admin/orchestration-methods.handler` | `/api/admin/orchestration-methods/*` | Method registry |
| Orchestration Templates | `admin/orchestration-user-templates.handler` | `/api/admin/orchestration-user-templates/*` | User templates |

#### Users (2 handlers)
| Handler | File | Route | Description |
|---------|------|-------|-------------|
| User Registry | `admin/user-registry.handler` | `/api/admin/user-registry/*` | User registry |
| White Label | `admin/white-label.handler` | `/api/admin/white-label/*` | White-label config |

#### Time & Translation (3 handlers)
| Handler | File | Route | Description |
|---------|------|-------|-------------|
| Time Machine | `admin/time-machine.handler` | `/api/admin/time-machine/*` | Time travel debugging |
| Translation | `admin/translation.handler` | `/api/admin/translation/*` | i18n management |
| Internet Learning | `admin/internet-learning.handler` | `/api/admin/internet-learning/*` | Web learning |

#### Learning (1 handler)
| Handler | File | Route | Description |
|---------|------|-------|-------------|
| AGI Learning | `admin/agi-learning.handler` | `/api/admin/learning/*` | AGI learning system |

---

## 17. Liquid Interface - Morphable UI System (v5.52.8)

### 17.1 Overview

The Liquid Interface implements a **morphable UI paradigm** where the chat interface can transform into specialized tools based on user intent or explicit selection. This follows the design philosophy: **"Don't Build the Tool. BE the Tool."**

### 17.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  LIQUID INTERFACE ARCHITECTURE                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────────┐ │
│  │ Chat Page   │───▶│ LiquidMorphPanel│───▶│ Morphed View        │ │
│  │ (trigger)   │    │ (container)     │    │ (DataGrid, Kanban..)│ │
│  └─────────────┘    └─────────────────┘    └─────────────────────┘ │
│                                                                      │
│  State: morphedView, isMorphFullscreen, showMorphChat               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 17.3 Component Hierarchy

| Component | Location | Purpose |
|-----------|----------|---------|
| `LiquidMorphPanel` | `apps/thinktank/components/liquid/LiquidMorphPanel.tsx` | Container with header, controls, chat sidebar |
| `renderMorphedView()` | Inside LiquidMorphPanel | Switches between view components |
| `DataGridView` | `morphed-views/DataGridView.tsx` | Interactive spreadsheet |
| `ChartView` | `morphed-views/ChartView.tsx` | Bar/line/pie/area charts |
| `KanbanView` | `morphed-views/KanbanView.tsx` | Multi-variant Kanban board |
| `CalculatorView` | `morphed-views/CalculatorView.tsx` | Full calculator |
| `CodeEditorView` | `morphed-views/CodeEditorView.tsx` | Code editor with run |
| `DocumentView` | `morphed-views/DocumentView.tsx` | Rich text editor |

### 17.4 Kanban Variant System

The `KanbanView` implements 5 modern Kanban frameworks through a variant system:

```typescript
export type KanbanVariant = 
  | 'standard'    // Traditional columns
  | 'scrumban'    // Scrum + Kanban hybrid
  | 'enterprise'  // Multi-lane portfolio
  | 'personal'    // Simple WIP limiting
  | 'pomodoro';   // Timer-integrated
```

#### Variant Configurations

| Variant | Columns | Special Features |
|---------|---------|------------------|
| **Standard** | To Do, In Progress, Review, Done | Basic drag-and-drop |
| **Scrumban** | Backlog, Ready, In Progress, Review, Done | Sprint header, velocity, story points, WIP limits |
| **Enterprise** | Proposed, Approved, Active, Completed | 3 swim lanes (Strategic/Operations/Support) |
| **Personal** | To Do, Doing, Done | WIP limit of 3 on Doing |
| **Pomodoro** | Today's Focus, In Pomodoro, On Break, Completed | 25-min timer, break tracking |

#### Pomodoro Timer Implementation

```typescript
function usePomodoroTimer() {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  // Auto-transitions between 25-min focus and 5-min break
}
```

### 17.5 Integration Points

#### Chat Page Integration

```typescript
// apps/thinktank/app/(chat)/page.tsx
const [morphedView, setMorphedView] = useState<MorphedViewType | null>(null);
const [isMorphFullscreen, setIsMorphFullscreen] = useState(false);
const [showMorphChat, setShowMorphChat] = useState(false);

// Trigger buttons in header (Advanced Mode)
<Button onClick={() => setMorphedView('kanban')}>
  <Kanban className="h-4 w-4" />
</Button>

// Conditional rendering
{morphedView && (
  <LiquidMorphPanel
    viewType={morphedView}
    isFullscreen={isMorphFullscreen}
    onClose={() => setMorphedView(null)}
    onToggleFullscreen={() => setIsMorphFullscreen(!isMorphFullscreen)}
    ...
  />
)}
```

### 17.6 Analytics Features

All Kanban variants include an analytics panel with:

| Metric | Description |
|--------|-------------|
| Total Tasks | Count of all cards across columns |
| Completed | Cards in Done/Completed column |
| Cycle Time | Average time from start to completion |
| Throughput | Tasks completed per week |

### 17.7 File Structure

```
apps/thinktank/components/liquid/
├── LiquidMorphPanel.tsx      # Main container component
├── EjectDialog.tsx           # Export to Next.js dialog
├── index.ts                  # Module exports
└── morphed-views/
    ├── DataGridView.tsx      # Spreadsheet
    ├── ChartView.tsx         # Charts
    ├── KanbanView.tsx        # Multi-variant Kanban (~630 lines)
    ├── CalculatorView.tsx    # Calculator
    ├── CodeEditorView.tsx    # Code editor
    ├── DocumentView.tsx      # Rich text
    └── index.ts              # View exports
```

---

## Section 18: Think Tank Consumer API Services (v5.52.17)

### 18.1 Overview

The Think Tank consumer application (`apps/thinktank/`) requires frontend API services to communicate with backend Lambda handlers. Each backend route in `packages/infrastructure/lambda/thinktank/` needs a corresponding client in `apps/thinktank/lib/api/`.

### 18.2 API Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  THINK TANK CONSUMER APP                                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  UI Components (React)                                               │   │
│  │  - Sidebar.tsx, TimeMachine.tsx, etc.                               │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
│                                     │                                       │
│  ┌──────────────────────────────────▼──────────────────────────────────┐   │
│  │  lib/api/ - Frontend API Services                                    │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                 │   │
│  │  │ chat.ts      │ │ time-travel  │ │ grimoire.ts  │                 │   │
│  │  │ models.ts    │ │ .ts          │ │ flash-facts  │                 │   │
│  │  │ rules.ts     │ │ artifacts.ts │ │ .ts          │                 │   │
│  │  │ settings.ts  │ │ ideas.ts     │ │ collaboration│                 │   │
│  │  │ brain-plan   │ │ derivation-  │ │ .ts          │                 │   │
│  │  │ .ts          │ │ history.ts   │ │ compliance-  │                 │   │
│  │  │ analytics.ts │ │              │ │ export.ts    │                 │   │
│  │  │ governor.ts  │ │              │ │              │                 │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘                 │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
│                                     │                                       │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │ HTTP/REST
┌─────────────────────────────────────▼───────────────────────────────────────┐
│  AWS LAMBDA - /api/thinktank/*                                              │
│                                                                             │
│  packages/infrastructure/lambda/thinktank/                                  │
│  - conversations.ts, time-travel.ts, grimoire.ts, flash-facts.ts           │
│  - artifacts.ts, ideas.ts, enhanced-collaboration.ts, derivation-history   │
│  - dia.ts (Decision Intelligence Artifacts)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 18.3 Complete API Service Mapping

| Backend Handler | Frontend Service | Route Base | Key Operations |
|-----------------|------------------|------------|----------------|
| `conversations.ts` | `chatService` | `/api/thinktank/conversations` | CRUD, streaming |
| `models.ts` | `modelsService` | `/api/thinktank/models` | List, recommend |
| `my-rules.ts` | `rulesService` | `/api/thinktank/my-rules` | CRUD, presets |
| `settings.ts` | `settingsService` | `/api/thinktank/settings` | Get/update |
| `brain-plan.ts` | `brainPlanService` | `/api/thinktank/brain-plan` | Generate, execute |
| `analytics.ts` | `analyticsService` | `/api/thinktank/analytics` | Usage, heatmap |
| `economic-governor.ts` | `governorService` | `/api/thinktank/economic-governor` | Status, savings |
| `time-travel.ts` | `timeTravelService` | `/api/thinktank/time-travel` | Timelines, checkpoints, fork |
| `grimoire.ts` | `grimoireService` | `/api/thinktank/grimoire` | Spells, execute |
| `flash-facts.ts` | `flashFactsService` | `/api/thinktank/flash-facts` | Extract, verify |
| `derivation-history.ts` | `derivationHistoryService` | `/api/thinktank/derivation-history` | Provenance, evidence |
| `enhanced-collaboration.ts` | `collaborationService` | `/api/thinktank/enhanced-collaboration` | Sessions, invites |
| `artifact-engine.ts` | `artifactsService` | `/api/thinktank/artifacts` | CRUD, versions, export |
| `ideas.ts` | `ideasService` | `/api/thinktank/ideas` | Capture, boards |
| `dia.ts` | `exportConversation` | `/api/thinktank/dia` | Decision records, compliance |

### 18.4 API Client Pattern

All services follow the singleton pattern with typed methods:

```typescript
// lib/api/time-travel.ts
class TimeTravelService {
  async listTimelines(conversationId?: string): Promise<Timeline[]> {
    const response = await api.get<{ success: boolean; data: Timeline[] }>(
      `/api/thinktank/time-travel/timelines${params}`
    );
    return response.data || [];
  }

  async createCheckpoint(timelineId: string, state: Record<string, unknown>): Promise<Checkpoint> {
    const response = await api.post<{ success: boolean; data: Checkpoint }>(
      `/api/thinktank/time-travel/timelines/${timelineId}/checkpoints`,
      { state, checkpointType: 'manual' }
    );
    return response.data;
  }
}

export const timeTravelService = new TimeTravelService();
```

### 18.5 File Structure

```
apps/thinktank/lib/api/
├── index.ts              # Re-exports all services
├── client.ts             # Base API client (fetch wrapper)
├── types.ts              # Shared types
├── chat.ts               # chatService
├── models.ts             # modelsService
├── rules.ts              # rulesService
├── settings.ts           # settingsService
├── brain-plan.ts         # brainPlanService
├── analytics.ts          # analyticsService
├── governor.ts           # governorService
├── liquid-interface.ts   # liquidInterfaceService
├── time-travel.ts        # timeTravelService (v5.52.17)
├── grimoire.ts           # grimoireService (v5.52.17)
├── flash-facts.ts        # flashFactsService (v5.52.17)
├── derivation-history.ts # derivationHistoryService (v5.52.17)
├── collaboration.ts      # collaborationService (v5.52.17)
├── artifacts.ts          # artifactsService (v5.52.17)
├── ideas.ts              # ideasService (v5.52.17)
└── compliance-export.ts  # exportConversation (v5.52.16)
```

---

## 19. OAuth 2.0 Provider & Developer Portal (v5.52.26)

### 19.1 Overview

RADIANT implements a **RFC 6749 compliant OAuth 2.0 Authorization Server** enabling third-party applications to access RADIANT APIs on behalf of users. This enables the ecosystem of MCP servers, Zapier integrations, partner apps, and custom automation tools.

### 19.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OAUTH 2.0 PROVIDER ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐   │
│  │  Third-Party App │     │  User's Browser  │     │   RADIANT API    │   │
│  │  (MCP, Zapier)   │     │                  │     │                  │   │
│  └────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘   │
│           │                        │                        │             │
│           │ 1. Authorization       │                        │             │
│           │    Request             │                        │             │
│           ├───────────────────────►│                        │             │
│           │                        │                        │             │
│           │                        │ 2. Consent Page        │             │
│           │                        │◄───────────────────────┤             │
│           │                        │                        │             │
│           │                        │ 3. User Approves       │             │
│           │                        ├───────────────────────►│             │
│           │                        │                        │             │
│           │ 4. Authorization Code  │                        │             │
│           │◄───────────────────────┤                        │             │
│           │                        │                        │             │
│           │ 5. Exchange Code       │                        │             │
│           ├────────────────────────────────────────────────►│             │
│           │                        │                        │             │
│           │ 6. Access Token (JWT)  │                        │             │
│           │◄────────────────────────────────────────────────┤             │
│           │                        │                        │             │
│           │ 7. API Request + Token │                        │             │
│           ├────────────────────────────────────────────────►│             │
│           │                        │                        │             │
│           │ 8. Protected Resource  │                        │             │
│           │◄────────────────────────────────────────────────┤             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 19.3 Supported Grant Types

| Grant Type | Use Case | PKCE Required | Refresh Token |
|------------|----------|---------------|---------------|
| **Authorization Code** | Web/mobile apps with user interaction | Public clients only | Yes |
| **Client Credentials** | Machine-to-machine (M2M) automation | N/A | No |
| **Refresh Token** | Token renewal without re-authentication | N/A | Yes (rotated) |

### 19.4 Database Schema

**Implementation**: `migrations/V2026_01_25_009__oauth_provider.sql`

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `oauth_clients` | Registered applications | `client_id`, `client_secret_hash`, `redirect_uris`, `allowed_scopes` |
| `oauth_authorization_codes` | Short-lived auth codes (5 min TTL) | `code`, `user_id`, `scopes`, `code_challenge` |
| `oauth_access_tokens` | Token hashes (not raw tokens) | `token_hash`, `scopes`, `expires_at`, `is_revoked` |
| `oauth_refresh_tokens` | Refresh tokens with rotation | `token_hash`, `generation`, `previous_token_id` |
| `oauth_user_authorizations` | User consent records | `user_id`, `client_id`, `scopes`, `is_active` |
| `oauth_scope_definitions` | Admin-configurable scopes | `name`, `category`, `risk_level`, `allowed_endpoints` |
| `oauth_audit_log` | Partitioned event log | `event_type`, `client_id`, `user_id`, `details` |
| `tenant_oauth_settings` | Per-tenant configuration | `oauth_enabled`, `require_app_approval`, `blocked_scopes` |
| `oauth_signing_keys` | RSA keys for JWT signing | `kid`, `private_key_secret_arn`, `public_key_pem` |

### 19.5 OAuth Endpoints

**Implementation**: `lambda/oauth/handler.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/oauth/authorize` | GET | Display consent page |
| `/oauth/authorize` | POST | Process user consent |
| `/oauth/token` | POST | Exchange code/refresh for tokens |
| `/oauth/revoke` | POST | Revoke access/refresh tokens |
| `/oauth/userinfo` | GET | OIDC user info endpoint |
| `/oauth/introspect` | POST | Token introspection |
| `/.well-known/openid-configuration` | GET | OIDC discovery |
| `/oauth/jwks.json` | GET | JSON Web Key Set |

### 19.6 Scope System

14 default scopes organized by category and risk level:

```typescript
// Low Risk - Profile
'openid', 'profile', 'email', 'models:read', 'usage:read'

// Medium Risk - Read Access
'offline_access', 'chat:read', 'knowledge:read', 'files:read'

// High Risk - Write/Execute (Requires Approval)
'chat:write', 'chat:delete', 'knowledge:write', 'files:write', 'agents:execute'
```

**Scope Endpoint Mapping** (`packages/shared/src/types/oauth-provider.types.ts`):

```typescript
export interface OAuthScope {
  name: string;
  category: ScopeCategory;
  displayName: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  allowedEndpoints: ScopeEndpoint[];
  isEnabled: boolean;
  requiresApproval: boolean;
  allowedAppTypes: OAuthAppType[];
}
```

### 19.7 Token Security

| Security Measure | Implementation |
|------------------|----------------|
| **Token Storage** | SHA-256 hash only, never raw tokens |
| **JWT Signing** | RS256 with keys in Secrets Manager |
| **PKCE** | Required for public clients (S256 only) |
| **Token Rotation** | Refresh tokens rotated on use |
| **Revocation** | Cascading revoke on consent withdrawal |
| **Audit Log** | Partitioned by month for compliance |

### 19.8 Admin API

**Implementation**: `lambda/admin/oauth-apps.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/oauth/dashboard` | GET | Dashboard with stats |
| `/api/admin/oauth/apps` | GET/POST | List/register apps |
| `/api/admin/oauth/apps/:id` | GET/PUT/DELETE | App CRUD |
| `/api/admin/oauth/apps/:id/approve` | POST | Approve pending app |
| `/api/admin/oauth/apps/:id/reject` | POST | Reject with reason |
| `/api/admin/oauth/apps/:id/suspend` | POST | Suspend and revoke all tokens |
| `/api/admin/oauth/apps/:id/rotate-secret` | POST | Generate new client secret |
| `/api/admin/oauth/scopes` | GET/POST/PUT | Scope management |
| `/api/admin/oauth/authorizations` | GET | View user consents |
| `/api/admin/oauth/authorizations/:id/revoke` | POST | Admin revoke consent |
| `/api/admin/oauth/settings` | GET/PUT | Tenant OAuth settings |
| `/api/admin/oauth/audit` | GET | Audit log query |

### 19.9 Admin Dashboard

**Implementation**: `apps/admin-dashboard/app/(dashboard)/oauth/apps/page.tsx`

Features:
- **Overview Tab**: Stats cards, pending approvals, top apps by authorization count
- **Applications Tab**: Searchable/filterable app list, approve/reject/suspend actions
- **Authorizations Tab**: User consent viewer with revocation
- **Settings Tab**: Per-tenant OAuth configuration

### 19.10 Use Cases Enabled

| Integration | Grant Type | Typical Scopes |
|-------------|------------|----------------|
| **MCP Servers** (Claude Desktop, Cursor) | Authorization Code | `chat:write`, `knowledge:read` |
| **Zapier/Make** | Authorization Code | `chat:read`, `chat:write` |
| **Partner Apps** | Authorization Code | Custom scope set |
| **Automation Scripts** | Client Credentials | `models:read`, `agents:execute` |
| **Mobile Apps** | Authorization Code + PKCE | `profile`, `chat:*` |
| **Slack/Teams Bots** | Authorization Code | `chat:write` |

---

## 19. Two-Factor Authentication (MFA) (v5.52.28)

### 19.1 Overview

RADIANT implements role-based Multi-Factor Authentication (MFA) using industry-standard TOTP (RFC 6238). Admin roles are **required** to enroll in MFA and **cannot disable** it once enrolled.

### 19.2 Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Login     │────▶│  MFA Check   │────▶│  MFA Required?  │
│   Page      │     │  /api/mfa/   │     │                 │
└─────────────┘     │   check      │     └────────┬────────┘
                    └──────────────┘              │
                                                  ▼
                    ┌──────────────┐     ┌─────────────────┐
                    │  Enrollment  │◀────│  Not Enrolled   │
                    │    Gate      │     │                 │
                    └──────────────┘     └─────────────────┘
                           │
                           ▼
                    ┌──────────────┐     ┌─────────────────┐
                    │  TOTP Setup  │────▶│  Backup Codes   │
                    │  QR Code     │     │  Generated      │
                    └──────────────┘     └─────────────────┘
```

### 19.3 Database Schema

**Migration**: `070_mfa_support.sql`

**Columns added to `tenant_users` and `platform_admins`**:

| Column | Type | Purpose |
|--------|------|---------|
| `mfa_enabled` | BOOLEAN | MFA enrollment status |
| `mfa_enrolled_at` | TIMESTAMPTZ | Enrollment timestamp |
| `mfa_method` | VARCHAR(20) | Method: 'totp', 'sms', 'webauthn' |
| `mfa_totp_secret_encrypted` | TEXT | AES-256-GCM encrypted TOTP secret |
| `mfa_failed_attempts` | INTEGER | Failed verification count |
| `mfa_locked_until` | TIMESTAMPTZ | Lockout expiration |

**New Tables**:

| Table | Purpose |
|-------|---------|
| `mfa_backup_codes` | One-time recovery codes (SHA-256 hashed) |
| `mfa_trusted_devices` | 30-day device trust tokens |
| `mfa_audit_log` | Partitioned audit log (monthly) |

### 19.4 TOTP Service

**Implementation**: `lambda/shared/services/mfa/totp.service.ts`

```typescript
export class TOTPService {
  generateSecret(accountName: string): { secret: string; uri: string };
  generateCode(secret: string, timestamp?: number): string;
  verifyCode(secret: string, code: string): { valid: boolean; drift?: number };
  encryptSecret(secret: string): string;  // AES-256-GCM
  decryptSecret(encryptedData: string): string;
}

export class BackupCodesService {
  generateCodes(): { codes: string[]; hashes: string[] };
  verifyCode(code: string, hash: string): boolean;
  hashCode(code: string): string;  // SHA-256
}

export class DeviceTrustService {
  generateDeviceToken(): string;
  hashToken(token: string): string;  // SHA-256
  calculateExpiration(): Date;  // +30 days
  verifyToken(token: string, storedHash: string): boolean;
}
```

### 19.5 API Endpoints

**Handler**: `lambda/auth/mfa.handler.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/mfa/status` | GET | MFA status, backup codes remaining, trusted devices |
| `/api/v2/mfa/check` | GET | Check if MFA required for role |
| `/api/v2/mfa/enroll/start` | POST | Generate TOTP secret and QR URI |
| `/api/v2/mfa/enroll/verify` | POST | Verify code, generate backup codes, enable MFA |
| `/api/v2/mfa/verify` | POST | Verify TOTP or backup code during login |
| `/api/v2/mfa/backup-codes/regenerate` | POST | Invalidate old codes, generate new |
| `/api/v2/mfa/devices` | GET | List trusted devices |
| `/api/v2/mfa/devices/:id` | DELETE | Revoke trusted device |

### 19.6 UI Components

**Location**: `apps/admin-dashboard/components/mfa/`

| Component | Purpose |
|-----------|---------|
| `MFAEnrollmentGate` | Full-screen forced enrollment (cannot dismiss) |
| `MFAVerificationPrompt` | TOTP/backup code entry modal |
| `MFASettingsSection` | Settings panel for MFA management |

### 19.7 Security Measures

| Feature | Implementation |
|---------|----------------|
| **Secret Encryption** | AES-256-GCM with scrypt-derived key |
| **Code Hashing** | SHA-256 for backup codes and device tokens |
| **Clock Drift** | ±30 second tolerance (window=1) |
| **Lockout** | 3 failures → 5 minute lockout |
| **Device Trust** | 30-day tokens, max 5 per user |
| **Audit Logging** | All MFA events logged with IP/User-Agent |

### 19.8 Role Enforcement

```typescript
const MFA_REQUIRED_ROLES = [
  'tenant_admin',
  'tenant_owner',
  'super_admin',
  'admin',
  'operator',
  'auditor',
];

// These roles CANNOT:
// - Bypass MFA enrollment
// - Disable MFA once enrolled
// - Access dashboard without MFA verification
```

---

## 20. Internationalization & Multi-Language Search (v5.52.29)

### 20.1 Overview

RADIANT supports **18 languages** with full authentication UI localization and **CJK-aware full-text search** using PostgreSQL's native FTS for Western languages and `pg_bigm` bi-gram indexing for Chinese, Japanese, and Korean.

### 20.2 Supported Languages

| Language | Code | Direction | FTS Strategy | PostgreSQL Config |
|----------|------|-----------|--------------|-------------------|
| English | `en` | LTR | Native FTS | `english` |
| Spanish | `es` | LTR | Native FTS | `spanish` |
| French | `fr` | LTR | Native FTS | `french` |
| German | `de` | LTR | Native FTS | `german` |
| Portuguese | `pt` | LTR | Native FTS | `portuguese` |
| Italian | `it` | LTR | Native FTS | `italian` |
| Dutch | `nl` | LTR | Native FTS | `dutch` |
| Polish | `pl` | LTR | Native FTS | `simple` |
| Russian | `ru` | LTR | Native FTS | `russian` |
| Turkish | `tr` | LTR | Native FTS | `turkish` |
| Japanese | `ja` | LTR | **pg_bigm** | bi-gram |
| Korean | `ko` | LTR | **pg_bigm** | bi-gram |
| Chinese (Simplified) | `zh-CN` | LTR | **pg_bigm** | bi-gram |
| Chinese (Traditional) | `zh-TW` | LTR | **pg_bigm** | bi-gram |
| **Arabic** | `ar` | **RTL** | Native FTS | `simple` |
| Hindi | `hi` | LTR | Native FTS | `simple` |
| Thai | `th` | LTR | Native FTS | `simple` |
| Vietnamese | `vi` | LTR | Native FTS | `simple` |

### 20.3 CJK Search Architecture

CJK languages (Chinese, Japanese, Korean) lack word boundaries, making traditional stemming-based FTS ineffective. RADIANT uses **pg_bigm** for bi-gram indexing:

```sql
-- Enable pg_bigm extension
CREATE EXTENSION IF NOT EXISTS pg_bigm;

-- Create bi-gram indexes on searchable content
CREATE INDEX idx_conversations_bigm_title 
  ON uds_conversations USING gin (title gin_bigm_ops);
CREATE INDEX idx_conversations_bigm_content 
  ON uds_conversations USING gin (content gin_bigm_ops);

-- CJK search uses LIKE with bi-gram optimization
SELECT * FROM uds_conversations 
WHERE content LIKE '%検索クエリ%'  -- Japanese query
  AND tenant_id = app.current_tenant_id;
```

**Why pg_bigm over pg_trgm?**
- `pg_trgm` uses 3-character grams, ineffective for 2-character CJK words
- `pg_bigm` uses 2-character grams, optimal for CJK morphology
- 40-60% faster CJK search vs trigram approach

### 20.4 Language Detection

**Database Function**: `detect_text_language(text)`

```sql
CREATE OR REPLACE FUNCTION detect_text_language(content TEXT)
RETURNS VARCHAR(10) AS $$
DECLARE
  cjk_chars INTEGER;
  arabic_chars INTEGER;
  cyrillic_chars INTEGER;
  total_chars INTEGER;
BEGIN
  total_chars := length(content);
  IF total_chars = 0 THEN RETURN 'en'; END IF;
  
  -- Count character ranges
  cjk_chars := length(regexp_replace(content, '[^\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]', '', 'g'));
  arabic_chars := length(regexp_replace(content, '[^\u0600-\u06ff]', '', 'g'));
  cyrillic_chars := length(regexp_replace(content, '[^\u0400-\u04ff]', '', 'g'));
  
  -- Threshold-based detection (>10% of content)
  IF cjk_chars::float / total_chars > 0.1 THEN
    -- Distinguish CJK languages by unique characters
    IF content ~ '[\u3040-\u309f\u30a0-\u30ff]' THEN RETURN 'ja'; END IF;
    IF content ~ '[\uac00-\ud7af]' THEN RETURN 'ko'; END IF;
    RETURN 'zh-CN';
  END IF;
  
  IF arabic_chars::float / total_chars > 0.1 THEN RETURN 'ar'; END IF;
  IF cyrillic_chars::float / total_chars > 0.1 THEN RETURN 'ru'; END IF;
  
  RETURN 'en';  -- Default
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**JavaScript Service**: `MultiLanguageSearchService.detectLanguage()`

```typescript
private detectLanguage(text: string): string {
  const cjkPattern = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;
  const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/;
  const koreanPattern = /[\uac00-\ud7af]/;
  const arabicPattern = /[\u0600-\u06ff]/;
  
  if (cjkPattern.test(text)) {
    if (japanesePattern.test(text)) return 'ja';
    if (koreanPattern.test(text)) return 'ko';
    return 'zh-CN';
  }
  if (arabicPattern.test(text)) return 'ar';
  return 'en';
}
```

### 20.5 Unified Search Function

**Database Function**: `search_content(query, table_name, tenant_id, limit)`

Routes queries to appropriate search method based on detected language:

```sql
CREATE OR REPLACE FUNCTION search_content(
  query TEXT,
  target_table TEXT,
  p_tenant_id UUID,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  relevance FLOAT,
  highlight TEXT
) AS $$
DECLARE
  detected_lang VARCHAR(10);
  is_cjk BOOLEAN;
BEGIN
  detected_lang := detect_text_language(query);
  is_cjk := detected_lang IN ('ja', 'ko', 'zh-CN', 'zh-TW');
  
  IF is_cjk THEN
    -- Use pg_bigm LIKE search
    RETURN QUERY EXECUTE format(
      'SELECT id, title, content, 
              bigm_similarity(content, $1) as relevance,
              ts_headline(''simple'', content, plainto_tsquery(''simple'', $1)) as highlight
       FROM %I 
       WHERE tenant_id = $2 AND content LIKE ''%%'' || $1 || ''%%''
       ORDER BY relevance DESC LIMIT $3',
      target_table
    ) USING query, p_tenant_id, p_limit;
  ELSE
    -- Use PostgreSQL native FTS
    RETURN QUERY EXECUTE format(
      'SELECT id, title, content,
              ts_rank(search_vector_english, websearch_to_tsquery(''english'', $1)) as relevance,
              ts_headline(''english'', content, websearch_to_tsquery(''english'', $1)) as highlight
       FROM %I
       WHERE tenant_id = $2 AND search_vector_english @@ websearch_to_tsquery(''english'', $1)
       ORDER BY relevance DESC LIMIT $3',
      target_table
    ) USING query, p_tenant_id, p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 20.6 Database Migration (071_multilang_search.sql)

**New Columns**:

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `uds_conversations` | `detected_language` | VARCHAR(10) | Auto-detected content language |
| `uds_conversations` | `search_vector_simple` | TSVECTOR | Fallback search vector |
| `uds_conversations` | `search_vector_english` | TSVECTOR | Language-specific search vector |
| `uds_uploads` | `detected_language` | VARCHAR(10) | Auto-detected content language |
| `cortex_entities` | `detected_language` | VARCHAR(10) | Auto-detected content language |
| `cortex_chunks` | `detected_language` | VARCHAR(10) | Auto-detected content language |

**New Indexes**:

| Index | Table | Type | Purpose |
|-------|-------|------|---------|
| `idx_conversations_bigm_title` | `uds_conversations` | GIN (gin_bigm_ops) | CJK title search |
| `idx_conversations_bigm_content` | `uds_conversations` | GIN (gin_bigm_ops) | CJK content search |
| `idx_uploads_bigm_content` | `uds_uploads` | GIN (gin_bigm_ops) | CJK upload search |
| `idx_cortex_entities_bigm` | `cortex_entities` | GIN (gin_bigm_ops) | CJK entity search |
| `idx_cortex_chunks_bigm` | `cortex_chunks` | GIN (gin_bigm_ops) | CJK chunk search |
| `idx_conversations_fts_english` | `uds_conversations` | GIN | English FTS |
| `idx_conversations_fts_simple` | `uds_conversations` | GIN | Simple FTS |

**Trigger**: Auto-detect language on INSERT/UPDATE

```sql
CREATE TRIGGER trg_detect_language_conversations
  BEFORE INSERT OR UPDATE OF content ON uds_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_detected_language();
```

### 20.7 Multi-Language Search Service

**Implementation**: `lambda/shared/services/search/multilang-search.service.ts`

```typescript
export interface SearchResult {
  id: string;
  title: string;
  content: string;
  relevance: number;
  highlight: string;
  detectedLanguage: string;
}

export interface SearchOptions {
  table: 'uds_conversations' | 'uds_uploads' | 'cortex_entities' | 'cortex_chunks';
  tenantId: string;
  limit?: number;
  offset?: number;
  languageHint?: string;
}

export class MultiLanguageSearchService {
  private readonly CJK_LANGUAGES = ['ja', 'ko', 'zh-CN', 'zh-TW'];
  private readonly FTS_CONFIGS: Record<string, string> = {
    en: 'english', es: 'spanish', fr: 'french', de: 'german',
    pt: 'portuguese', it: 'italian', nl: 'dutch', ru: 'russian',
    tr: 'turkish', pl: 'simple', ar: 'simple', hi: 'simple',
    th: 'simple', vi: 'simple'
  };

  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const language = options.languageHint || this.detectLanguage(query);
    
    if (this.CJK_LANGUAGES.includes(language)) {
      return this.searchBigram(query, options);
    }
    return this.searchFTS(query, options, this.FTS_CONFIGS[language] || 'simple');
  }

  private async searchBigram(query: string, options: SearchOptions): Promise<SearchResult[]>;
  private async searchFTS(query: string, options: SearchOptions, config: string): Promise<SearchResult[]>;
  private detectLanguage(text: string): string;
}
```

### 20.8 RTL Support Architecture

**Hook**: `apps/admin-dashboard/hooks/useRTL.ts`

```typescript
export function useRTL() {
  const { currentLanguage, isRTL } = useTranslation();
  
  return {
    dir: isRTL ? 'rtl' : 'ltr',
    isRTL,
    // Utility for flipping CSS classes
    flip: (ltrClass: string, rtlClass: string) => isRTL ? rtlClass : ltrClass,
    // Margin/padding helpers
    marginStart: (value: string) => isRTL ? `mr-${value}` : `ml-${value}`,
    marginEnd: (value: string) => isRTL ? `ml-${value}` : `mr-${value}`,
    paddingStart: (value: string) => isRTL ? `pr-${value}` : `pl-${value}`,
    paddingEnd: (value: string) => isRTL ? `pl-${value}` : `pr-${value}`,
    // Text alignment
    textStart: isRTL ? 'text-right' : 'text-left',
    textEnd: isRTL ? 'text-left' : 'text-right',
    // Flex direction
    flexRow: isRTL ? 'flex-row-reverse' : 'flex-row',
    // Icon rotation for directional icons
    iconFlip: isRTL ? 'scale-x-[-1]' : '',
  };
}
```

**CSS Utilities**: `apps/admin-dashboard/styles/rtl.css`

```css
/* RTL automatic flipping */
[dir="rtl"] .ml-2 { margin-left: 0; margin-right: 0.5rem; }
[dir="rtl"] .mr-2 { margin-right: 0; margin-left: 0.5rem; }
[dir="rtl"] .pl-4 { padding-left: 0; padding-right: 1rem; }
[dir="rtl"] .pr-4 { padding-right: 0; padding-left: 1rem; }
[dir="rtl"] .text-left { text-align: right; }
[dir="rtl"] .text-right { text-align: left; }

/* Preserve LTR for specific content */
.preserve-ltr { direction: ltr; unicode-bidi: isolate; }
[dir="rtl"] input[type="email"],
[dir="rtl"] input[type="password"],
[dir="rtl"] .font-mono { direction: ltr; text-align: left; }
```

### 20.9 Translation Files

**Location**: `apps/admin-dashboard/locales/auth/`

| File | Language | Keys |
|------|----------|------|
| `en.json` | English | ~230 |
| `zh-CN.json` | Chinese (Simplified) | ~230 |
| `ja.json` | Japanese | ~230 |
| `ko.json` | Korean | ~230 |
| `ar.json` | Arabic (RTL) | ~230 |

**Key Categories**:

| Namespace | Keys | Purpose |
|-----------|------|---------|
| `login.*` | 25 | Login form, errors, social auth |
| `mfa.*` | 45 | Enrollment, verification, backup codes |
| `oauth.*` | 35 | Consent screen, scopes, connected apps |
| `password.*` | 30 | Reset flow, validation, success |
| `errors.*` | 40 | Error messages, validation |
| `common.*` | 55 | Buttons, labels, shared text |

### 20.10 Component Integration

**Usage Pattern**:

```typescript
import { useTranslation } from '@/hooks/useTranslation';
import { useRTL } from '@/hooks/useRTL';

export function MFAEnrollmentGate() {
  const { t } = useTranslation('auth');
  const { dir, isRTL, marginStart } = useRTL();

  return (
    <div dir={dir} className="...">
      <h1>{t('mfa.enrollment.title')}</h1>
      <Button className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <Loader2 className={marginStart('2')} />
        {t('mfa.enrollment.get_started')}
      </Button>
      {/* Preserve LTR for codes */}
      <code className="preserve-ltr" dir="ltr">{secretCode}</code>
    </div>
  );
}
```

### 20.11 Performance Considerations

| Optimization | Impact |
|--------------|--------|
| **Bi-gram indexes** | 10-50x faster CJK LIKE queries |
| **Materialized tsvectors** | Avoid re-parsing on every search |
| **Language detection caching** | Detect once on insert, reuse |
| **Index-only scans** | GIN indexes support covering queries |
| **Parallel query** | PostgreSQL parallelizes large FTS scans |

---

## 21. Unified AGI Architecture: Brain, Genesis, Cortex, and Cato (v5.52.29)

RADIANT's AGI capabilities are built on four interconnected subsystems that work together to provide intelligent, safe, and enterprise-ready AI orchestration. This section provides the authoritative engineering reference for all four systems.

### 21.1 Architecture Overview

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

| System | Purpose | Primary Service Files |
|--------|---------|----------------------|
| **Brain** | AGI planning, cognitive processing, model orchestration | `agi-brain-planner.service.ts`, `cognitive-brain.service.ts` |
| **Genesis** | Developmental gates, capability unlocking, maturity stages | `cato/genesis.service.ts` |
| **Cortex** | Tiered memory architecture, knowledge graph, Graph-RAG | `cortex-intelligence.service.ts`, `cortex/*.ts` |
| **Cato** | Safety pipeline, governance, human-in-the-loop checkpoints | `cato/safety-pipeline.service.ts`, `cato-pipeline-orchestrator.service.ts` |

### 21.2 The Brain: AGI Planning & Cognitive Processing

The Brain is RADIANT's AGI planning and cognitive processing system. It generates execution plans for user prompts, orchestrating model selection, domain detection, and response generation.

#### 21.2.1 AGI Brain Planner Service

**File**: `lambda/shared/services/agi-brain-planner.service.ts`

```typescript
// Core Types
type PlanStatus = 'planning' | 'ready' | 'executing' | 'completed' | 'failed' | 'cancelled';
type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
type StepType = 'analyze' | 'detect_domain' | 'select_model' | 'prepare_context' | 
                'ethics_check' | 'generate' | 'synthesize' | 'verify' | 'refine' | 
                'calibrate' | 'reflect';
type OrchestrationMode = 'thinking' | 'extended_thinking' | 'coding' | 'creative' | 
                         'research' | 'analysis' | 'multi_model' | 'chain_of_thought' | 
                         'self_consistency';

// AGI Brain Plan Structure
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

#### Plan Generation Flow

| Step | Action | Services Involved |
|------|--------|-------------------|
| 0.8 | Get Cortex Insights | `cortexIntelligenceService` |
| 1 | Analyze Prompt | Internal analysis |
| 2 | Detect Domain | `domainTaxonomyService` |
| 3 | Select Workflow | `orchestrationPatternsService` |
| 4 | Select Model | `modelRouterService` |
| 5 | Prepare Context | `userPersistentContextService`, `egoContextService` |
| 6 | Ethics Check | `catoSafetyPipeline` |
| 7 | Generate Response | Selected model |
| 8 | Verify Quality | Internal verification |

#### Service Dependencies

| Service | Import Path | Purpose |
|---------|-------------|---------|
| `domainTaxonomyService` | `./domain-taxonomy.service` | Domain detection |
| `modelRouterService` | `./model-router.service` | Model selection |
| `orchestrationPatternsService` | `./orchestration-patterns.service` | Workflow selection |
| `userPersistentContextService` | `./user-persistent-context.service` | Combat LLM forgetting |
| `egoContextService` | `./identity-core.service` | Zero-cost persistent self |
| `consciousnessService` | `./consciousness.service` | Affective state integration |
| `cortexIntelligenceService` | `./cortex-intelligence.service` | Knowledge density insights |
| `catoSafetyPipeline` | `./cato/safety-pipeline.service` | Safety evaluation |
| `libraryAssistService` | `./library-assist.service` | Generative UI libraries |
| `enhancedLearningService` | `./enhanced-learning.service` | Pattern caching |

#### 21.2.2 Cognitive Brain Service

**File**: `lambda/shared/services/cognitive-brain.service.ts`

Implements an AGI-like cognitive mesh with specialized "brain regions" and "cognitive patterns."

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

interface CognitivePattern {
  patternId: string;
  triggerConditions: Record<string, unknown>;
  regionSequence: RegionStep[];
  executionMode: 'sequential' | 'parallel' | 'adaptive';
}
```

**Key Features**:

| Feature | Implementation | Purpose |
|---------|----------------|---------|
| **Global Workspace Theory** | `consciousnessService` | Conscious access competition |
| **LoRA Integration** | `loraInferenceService` | Tri-layer adapters (Global, User, Domain) |
| **Metacognition** | `agiLearningPersistenceService` | Self-reflection and learning |
| **Learning Restoration** | `ensureLearningRestored()` | Restores AGI learning state per tenant |

### 21.3 Genesis: Developmental Gates & Capability Control

Genesis manages developmental gates and capability unlocking. It controls what capabilities are available based on the system's maturity stage.

**File**: `lambda/shared/services/cato/genesis.service.ts`

#### 21.3.1 Maturity Stages

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

#### 21.3.2 Genesis Gates (G1-G5)

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

| Gate | Name | Stage | Requirements |
|------|------|-------|--------------|
| **G1** | Basic Safety | EMBRYONIC | `safety_filters`, `content_moderation` |
| **G2** | Context Awareness | NASCENT | `context_retention`, `session_management` |
| **G3** | Ethical Reasoning | DEVELOPING | `ethics_checks`, `harm_prevention` |
| **G4** | Advanced Autonomy | MATURING | `checkpoint_system`, `rollback_capability` |
| **G5** | Full Capability | MATURE | `audit_compliance`, `governance_preset` |

#### 21.3.3 Key Methods

```typescript
// Get current state
async getState(tenantId: string): Promise<GenesisState>

// Update maturity stage
async updateStage(tenantId: string, stage: GenesisStage): Promise<GenesisState>

// Pass a gate
async passGate(tenantId: string, gateId: string): Promise<GenesisGate>

// Bypass a gate (with reason - audited)
async bypassGate(tenantId: string, gateId: string, reason: string): Promise<GenesisGate>

// Check if ready for consciousness features
async isReadyForConsciousness(tenantId: string): Promise<boolean>
```

#### 21.3.4 Database Tables

```sql
-- Genesis state per tenant
genesis_state (
  tenant_id UUID PRIMARY KEY,
  current_stage genesis_stage_enum,
  capabilities JSONB,
  restrictions JSONB,
  last_assessment TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Gate definitions and status
genesis_gates (
  tenant_id UUID,
  gate_id TEXT,
  name TEXT,
  description TEXT,
  stage genesis_stage_enum,
  requirements JSONB,
  status TEXT,
  passed_at TIMESTAMPTZ,
  bypass_reason TEXT,
  PRIMARY KEY (tenant_id, gate_id)
)
```

### 21.4 Cortex: Tiered Memory & Knowledge Graph

Cortex is RADIANT's enterprise knowledge management system - a tiered memory architecture with Graph-RAG capabilities for persistent, searchable knowledge.

#### 21.4.1 Three-Tier Memory Architecture

**Files**: 
- `packages/shared/src/types/cortex-memory.types.ts`
- `packages/shared/src/types/cortex-graph-rag.types.ts`
- `lambda/shared/services/cortex/tier-coordinator.service.ts`

```typescript
type MemoryTier = 'hot' | 'warm' | 'cold';
```

| Tier | Storage | Latency | Retention | Purpose |
|------|---------|---------|-----------|---------|
| **Hot** | Redis + DynamoDB | <10ms | 0-24 hours | Session context, ghost vectors, telemetry |
| **Warm** | Neptune/pgvector | <100ms | 1-90 days | Knowledge graph nodes/edges with embeddings |
| **Cold** | S3 Iceberg | 1-10s | 90d-7 years | Archived facts, zero-copy mounts |

#### Hot Tier Types

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

#### Warm Tier Types (Knowledge Graph)

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

#### 21.4.2 Cortex Intelligence Service

**File**: `lambda/shared/services/cortex-intelligence.service.ts`

Provides knowledge density insights to AGI Brain Planner.

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

**Orchestration Recommendations**:

| Knowledge Depth | Mode | Use Knowledge Base | Max Nodes |
|-----------------|------|-------------------|-----------|
| `expert` | `research` | ✅ | 15 |
| `rich` | `analysis` | ✅ | 12 |
| `moderate` | `thinking` | ✅ | 8 |
| `sparse` | `extended_thinking` | ✅ | 5 |
| `none` | `thinking` | ❌ | 0 |

#### 21.4.3 Tier Coordinator Service

**File**: `lambda/shared/services/cortex/tier-coordinator.service.ts`

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

#### 21.4.4 Golden Rules Service

**File**: `lambda/shared/services/cortex/golden-rules.service.ts`

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

#### 21.4.5 Graph Expansion (Twilight Dreaming v2)

**File**: `lambda/shared/services/cortex/graph-expansion.service.ts`

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

#### 21.4.6 Cato-Cortex Bridge

**File**: `lambda/shared/services/cato-cortex-bridge.service.ts`

Integrates Cato's consciousness/memory with Cortex's knowledge graph.

```typescript
interface CatoCortexConfig {
  syncEnabled: boolean;
  syncSemanticToCortex: boolean;      // Default: true
  syncEpisodicToCortex: boolean;      // Default: false
  enrichEgoFromCortex: boolean;       // Default: true
  maxCortexNodesForContext: number;   // Default: 10
}

class CatoCortexBridgeService {
  // Sync Cato memories to Cortex graph
  async syncCatoMemoriesToCortex(tenantId: string): Promise<SyncResult>

  // Enrich Cato ego context with Cortex knowledge
  async getContextEnrichmentFromCortex(tenantId: string, query: string): Promise<ContextEnrichment>

  // Cascade GDPR erasure across both systems
  async cascadeGdprErasure(tenantId: string, userId?: string): Promise<ErasureResult>
}
```

#### 21.4.7 Cortex Database Tables

```sql
-- Core configuration
cortex_config (tenant_id, hot_tier_config, warm_tier_config, cold_tier_config, ...)

-- Knowledge graph
cortex_graph_nodes (id, tenant_id, node_type, label, properties, embedding, confidence, ...)
cortex_graph_edges (id, tenant_id, source_id, target_id, edge_type, properties, ...)

-- Golden rules
cortex_golden_rules (id, tenant_id, rule_type, condition, override, verified_by, signature, ...)
cortex_chain_of_custody (id, tenant_id, fact_id, source, source_type, verified_by, ...)

-- Tier management
cortex_data_flow_metrics (tenant_id, tier, promoted, archived, retrieved, ...)
cortex_graph_expansion_tasks (id, tenant_id, task_type, status, discovered_links, ...)

-- Episodic memory
episodic_memories (id, tenant_id, user_id, content, importance, decay_rate, ...)
memory_consolidation_jobs (id, tenant_id, job_type, status, ...)
```

### 21.5 Cato: Safety Pipeline & Governance

Cato is RADIANT's safety and governance system - a Universal Method Protocol for composable AI orchestration with enterprise governance.

#### 21.5.1 Immutable Safety Invariants

**File**: `packages/shared/src/types/cato.types.ts`

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

#### 21.5.2 Safety Pipeline

**File**: `lambda/shared/services/cato/safety-pipeline.service.ts`

The safety pipeline runs in this order:

| Step | Component | Purpose | Recoverable? |
|------|-----------|---------|--------------|
| 1 | **Sensory Veto** | Immediate halt signals | ❌ No |
| 2 | **Precision Governor** | Limits confidence based on uncertainty | ✅ Yes |
| 3 | **Redundant Perception** | PHI/PII detection | ✅ Yes |
| 4 | **Control Barrier Functions** | Hard safety constraints | ✅ Yes |
| 5 | **Semantic Entropy** | Deception detection | ✅ Yes |
| 6 | **Fracture Detection** | Alignment verification | ✅ Yes |

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

#### 21.5.3 Control Barrier Functions (CBF)

**File**: `lambda/shared/services/cato/control-barrier.service.ts`

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

async evaluateBarriers(params: {
  currentState: SystemState;
  proposedAction: ProposedAction;
  context: ExecutionContext;
}): Promise<CBFResult>
```

#### 21.5.4 Governance Presets

User-friendly "leash length" abstraction.

```typescript
type GovernancePreset = 'paranoid' | 'balanced' | 'cowboy';
```

| Preset | Icon | Friction | Auto-Approve | Checkpoints |
|--------|------|----------|--------------|-------------|
| **PARANOID** | 🛡️ | 1.0 | 0.0 | All ALWAYS |
| **BALANCED** | ⚖️ | 0.5 | 0.3 | CONDITIONAL |
| **COWBOY** | 🚀 | 0.1 | 0.8 | NEVER/NOTIFY_ONLY |

**Checkpoint Configuration (5 gates)**:

| Checkpoint | When | PARANOID | BALANCED | COWBOY |
|------------|------|----------|----------|--------|
| **CP1** | After Observer | ALWAYS | NEVER | NEVER |
| **CP2** | After Proposer | ALWAYS | CONDITIONAL | NEVER |
| **CP3** | After Critics | ALWAYS | CONDITIONAL | NEVER |
| **CP4** | Before Execution | ALWAYS | CONDITIONAL | CONDITIONAL |
| **CP5** | After Execution | ALWAYS | NOTIFY_ONLY | NOTIFY_ONLY |

```typescript
type CheckpointMode = 'ALWAYS' | 'CONDITIONAL' | 'NEVER' | 'NOTIFY_ONLY';
```

#### 21.5.5 Pipeline Orchestrator

**File**: `lambda/shared/services/cato-pipeline-orchestrator.service.ts`

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

// Default method chain
const defaultChain = ['method:observer:v1'];

// Available methods
const coreMethods = ['Observer', 'Proposer', 'Decider', 'Validator', 'Executor'];
const criticMethods = ['Security', 'Efficiency', 'Factual', 'Compliance', 'Red Team'];
```

#### 21.5.6 Cato Database Tables

```sql
-- Tenant governance configuration
cato_tenant_config (
  tenant_id UUID PRIMARY KEY,
  active_preset governance_preset_enum,
  custom_checkpoints JSONB,
  daily_budget_cents INTEGER,
  compliance_frameworks TEXT[],
  ...
)

-- CBF definitions
cato_cbf_definitions (
  id UUID PRIMARY KEY,
  barrier_id TEXT,
  barrier_type TEXT,
  is_critical BOOLEAN,
  enforcement_mode TEXT DEFAULT 'ENFORCE',
  threshold_config JSONB,
  ...
)

-- Pipeline executions
cato_pipeline_executions (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  status cato_pipeline_status_enum,
  method_chain TEXT[],
  current_method TEXT,
  ...
)

-- Method envelopes
cato_pipeline_envelopes (
  id UUID PRIMARY KEY,
  pipeline_id UUID,
  method_id TEXT,
  input JSONB,
  output JSONB,
  ...
)

-- Checkpoint decisions
cato_checkpoint_decisions (
  id UUID PRIMARY KEY,
  pipeline_id UUID,
  checkpoint_type TEXT,
  decision TEXT,
  decided_by UUID,
  ...
)

-- Merkle audit trail
cato_merkle_entries (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  previous_hash TEXT,
  current_hash TEXT,
  action TEXT,
  ...
)
```

### 21.6 Integration Points

#### 21.6.1 Brain → Cortex

```typescript
// In AGI Brain Planner
const cortexInsights = await cortexIntelligenceService.getInsights(tenantId, prompt);
if (cortexInsights.knowledgeDensity.knowledgeDepth !== 'none') {
  plan.orchestrationMode = cortexInsights.knowledgeDensity.recommendedOrchestration.mode;
  plan.qualityTargets.minConfidence += cortexInsights.knowledgeDensity.confidenceBoost;
}
```

#### 21.6.2 Brain → Genesis

```typescript
// Check Genesis maturity before allowing capabilities
const genesisState = await genesisService.getState(tenantId);
if (genesisState.currentStage === 'EMBRYONIC') {
  // Restrict to basic capabilities only
  plan.allowedCapabilities = genesisState.capabilities;
  plan.restrictions = genesisState.restrictions;
}
```

#### 21.6.3 Brain → Cato

```typescript
// Run safety pipeline before execution
const safetyResult = await catoSafetyPipeline.evaluateAction({
  prompt,
  proposedPolicy,
  generatedResponse,
  actorModel,
  context: executionContext,
});

if (!safetyResult.allowed) {
  plan.ethicsEvaluation = {
    passed: false,
    blockedBy: safetyResult.blockedBy,
    recommendation: safetyResult.recommendation,
  };
  return plan; // Do not execute
}
```

#### 21.6.4 Cato ↔ Cortex (Bridge)

```typescript
// Sync memories bidirectionally
await catoCortexBridgeService.syncCatoMemoriesToCortex(tenantId);

// Enrich context with Cortex knowledge
const enrichment = await catoCortexBridgeService.getContextEnrichmentFromCortex(
  tenantId,
  query
);

// GDPR cascade
await catoCortexBridgeService.cascadeGdprErasure(tenantId, userId);
```

### 21.7 Key Implementation Files Reference

| System | File | Purpose |
|--------|------|---------|
| **Brain** | `lambda/shared/services/agi-brain-planner.service.ts` | Plan generation |
| **Brain** | `lambda/shared/services/cognitive-brain.service.ts` | Cognitive mesh |
| **Brain** | `lambda/shared/services/brain-config.service.ts` | Configuration |
| **Genesis** | `lambda/shared/services/cato/genesis.service.ts` | Gate management |
| **Cortex** | `lambda/shared/services/cortex-intelligence.service.ts` | Knowledge insights |
| **Cortex** | `lambda/shared/services/cortex/tier-coordinator.service.ts` | Tier management |
| **Cortex** | `lambda/shared/services/cortex/golden-rules.service.ts` | Verified overrides |
| **Cortex** | `lambda/shared/services/cortex/graph-expansion.service.ts` | Twilight Dreaming |
| **Cortex** | `lambda/shared/services/cato-cortex-bridge.service.ts` | System integration |
| **Cato** | `lambda/shared/services/cato/safety-pipeline.service.ts` | Safety evaluation |
| **Cato** | `lambda/shared/services/cato/control-barrier.service.ts` | CBF enforcement |
| **Cato** | `lambda/shared/services/cato-pipeline-orchestrator.service.ts` | Pipeline execution |
| **Cato** | `lambda/shared/services/governance-preset.service.ts` | Preset management |
| **Types** | `packages/shared/src/types/cato.types.ts` | Cato types |
| **Types** | `packages/shared/src/types/cortex-memory.types.ts` | Cortex types |
| **Types** | `packages/shared/src/types/cortex-graph-rag.types.ts` | Graph-RAG types |

### 21.8 Competitive Moats from Unified Architecture

| Moat | Implementation | Why Competitors Can't Copy |
|------|----------------|---------------------------|
| **Knowledge Gravity** | Cortex three-tier architecture | Requires full architectural rebuild |
| **Verified Intelligence** | Cato CBFs + Genesis gates | Safety-first design, not bolted on |
| **Compounding Learning** | Brain + Twilight Dreaming | Months of production learning data |
| **Enterprise Trust** | Merkle audit + GDPR cascade | Full compliance infrastructure |
| **Zero-Cost Ego** | Brain + Ego Context injection | No SageMaker cost, just PostgreSQL |

---

## 21. Cato Pipeline Orchestration System (v5.52.54)

The Cato Pipeline Orchestration system implements a modular, type-safe method pipeline for AI task execution with built-in governance, risk assessment, and rollback capabilities.

### 21.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CATO PIPELINE ORCHESTRATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     PIPELINE ORCHESTRATOR                             │   │
│  │  - Method chaining          - Checkpoint integration                  │   │
│  │  - Context management       - Error handling + compensation           │   │
│  │  - Event emission           - Template-based execution                │   │
│  └─────────────────────────────────┬────────────────────────────────────┘   │
│                                    │                                         │
│  ┌─────────────────────────────────▼────────────────────────────────────┐   │
│  │                     METHOD EXECUTOR (Base)                            │   │
│  │  - Prompt rendering         - Model invocation                        │   │
│  │  - Context pruning          - Envelope creation                       │   │
│  │  - Confidence calculation   - Risk signal detection                   │   │
│  └─────────────────────────────────┬────────────────────────────────────┘   │
│                                    │                                         │
│  ┌─────────────────────────────────▼────────────────────────────────────┐   │
│  │                     METHOD IMPLEMENTATIONS                            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ Observer │ │ Proposer │ │ Validator│ │ Executor │ │ Decider  │   │   │
│  │  │ CLASSIFY │ │ PROPOSAL │ │ASSESSMENT│ │EXEC_RSLT │ │ JUDGMENT │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐    │
│  │ Method Registry│  │ Schema Registry│  │ Tool Registry              │    │
│  │ (definitions)  │  │ (JSON schemas) │  │ (Lambda/MCP tools)         │    │
│  └────────────────┘  └────────────────┘  └────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────┐  ┌────────────────────────────────────┐    │
│  │ Checkpoint Service (HITL)  │  │ Compensation Service (SAGA)        │    │
│  │ CP1-CP5, governance presets│  │ Rollback on failure                │    │
│  └────────────────────────────┘  └────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Design Principles:**
- **Universal Envelope Protocol**: All method outputs wrapped in typed envelopes with metadata
- **Type-Safe Routing**: Methods declare accepted/produced output types for compile-time safety
- **Context Strategies**: Configurable context pruning (FULL, MINIMAL, TAIL, RELEVANT, SUMMARY)
- **Governance Presets**: COWBOY, BALANCED, PARANOID control checkpoint triggers
- **SAGA Compensation**: Automatic rollback via logged compensating transactions

### 21.2 Core Services

| Service | File | Purpose |
|---------|------|---------|
| **Pipeline Orchestrator** | `cato-pipeline-orchestrator.service.ts` | Coordinates method execution, handles checkpoints, triggers compensation |
| **Method Executor** | `cato-method-executor.service.ts` | Abstract base class for all methods; handles prompt rendering, model invocation, envelope creation |
| **Method Registry** | `cato-method-registry.service.ts` | CRUD for method definitions, prompt templates, method chains |
| **Schema Registry** | `cato-schema-registry.service.ts` | JSON Schema definitions for method outputs |
| **Tool Registry** | `cato-tool-registry.service.ts` | Tool definitions for Lambda/MCP invocation |
| **Checkpoint Service** | `cato-checkpoint.service.ts` | Human-in-the-loop checkpoints (CP1-CP5) |
| **Compensation Service** | `cato-compensation.service.ts` | SAGA pattern rollback execution |

### 21.3 Method Implementations

#### 21.3.1 Observer Method (`method:observer:v1`)

**Purpose**: First method in most pipelines. Analyzes incoming requests to classify intent, extract context, detect domain, and flag ambiguities.

**File**: `lambda/shared/services/cato-methods/observer.method.ts`

```typescript
interface ObserverInput {
  userRequest: string;
  additionalInstructions?: string;
  sessionContext?: {
    previousMessages?: string[];
    userPreferences?: Record<string, unknown>;
    domain?: string;
  };
}

interface ObserverOutput {
  category: string;                           // Primary intent classification
  subcategory?: string;                       // Refined classification
  confidence: number;                         // 0-1 confidence score
  reasoning: string;                          // Explanation of classification
  alternatives: Array<{ category: string; confidence: number }>;
  domain: {
    detected: string;                         // medical, legal, financial, etc.
    confidence: number;
    keywords: string[];
  };
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  requiredCapabilities: string[];             // Tools/features needed
  ambiguities: Array<{
    aspect: string;
    description: string;
    suggestedClarification: string;
  }>;
  extractedEntities: Array<{ type: string; value: string; relevance: number }>;
  suggestedNextMethods: string[];             // e.g., ['method:proposer:v1']
}
```

**Risk Signals Detected**:
- `ambiguous_intent` - Multiple ambiguities detected
- `low_classification_confidence` - Confidence < 60%
- `expert_complexity` - Request requires expert handling
- `sensitive_domain` - Medical, legal, financial, security domains

#### 21.3.2 Proposer Method (`method:proposer:v1`)

**Purpose**: Generates action proposals based on observations. Creates structured plans with reversibility information, cost estimates, and alternative approaches.

**File**: `lambda/shared/services/cato-methods/proposer.method.ts`

```typescript
interface ProposerInput {
  observation: ObserverOutput;
  userRequest: string;
  availableTools?: string[];
  constraints?: {
    maxCostCents?: number;
    maxDurationMs?: number;
    mustBeReversible?: boolean;
    allowedRiskLevels?: CatoRiskLevel[];
  };
}

interface ProposerOutput {
  proposalId: string;
  title: string;
  actions: ProposedAction[];                  // Ordered list of actions
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
    estimatedImpact: { costCents: number; durationMs: number; riskLevel: CatoRiskLevel };
  }>;
  prerequisites: string[];
  assumptions: string[];
  warnings: string[];
}

interface ProposedAction {
  actionId: string;
  type: string;
  description: string;
  toolId?: string;                            // Reference to tool registry
  inputs: Record<string, unknown>;
  reversible: boolean;
  compensationType: CatoCompensationType;     // DELETE, RESTORE, NOTIFY, MANUAL, NONE
  compensationStrategy?: string;
  estimatedCostCents: number;
  estimatedDurationMs: number;
  riskLevel: CatoRiskLevel;
  dependencies: string[];                     // actionIds this depends on
}
```

**Risk Signals Detected**:
- `irreversible_actions` - Actions that cannot be undone
- `high_cost` - Estimated cost > $1.00
- `high_risk_actions` - HIGH or CRITICAL risk level
- `many_assumptions` - > 3 assumptions in proposal
- `proposal_warnings` - Explicit warnings in output

#### 21.3.3 Validator Method (`method:validator:v1`)

**Purpose**: Performs comprehensive risk assessment and triage decisions. Implements veto logic for CRITICAL risks.

**File**: `lambda/shared/services/cato-methods/validator.method.ts`

```typescript
interface ValidatorInput {
  proposal: ProposerOutput;
  critiques?: Array<{ criticType: string; verdict: string; score: number; issues: Array<Record<string, unknown>> }>;
  governancePreset: 'COWBOY' | 'BALANCED' | 'PARANOID';
}

interface ValidatorOutput {
  overallRisk: CatoRiskLevel;                 // CRITICAL, HIGH, MEDIUM, LOW, NONE
  overallRiskScore: number;                   // 0-1 weighted score
  triageDecision: CatoTriageDecision;         // AUTO_EXECUTE, CHECKPOINT_REQUIRED, BLOCKED
  triageReason: string;
  vetoApplied: boolean;                       // True if execution should be blocked
  vetoFactor?: string;                        // Which risk factor triggered veto
  vetoReason?: string;
  riskFactors: CatoRiskFactor[];              // Individual risk assessments
  autoExecuteThreshold: number;               // From governance preset
  vetoThreshold: number;                      // From governance preset
  unmitigatedRisks: string[];                 // Risks with no mitigations
  mitigationSuggestions: Array<{ riskFactorId: string; suggestion: string; estimatedReduction: number }>;
}
```

**Triage Decision Logic**:
```typescript
// From governance preset thresholds
const preset = CATO_GOVERNANCE_PRESETS[governancePreset];

if (vetoApplied || overallRiskScore >= preset.riskThresholds.veto) {
  triageDecision = CatoTriageDecision.BLOCKED;
} else if (overallRiskScore >= preset.riskThresholds.autoExecute) {
  triageDecision = CatoTriageDecision.CHECKPOINT_REQUIRED;
} else {
  triageDecision = CatoTriageDecision.AUTO_EXECUTE;
}
```

#### 21.3.4 Executor Method (`method:executor:v1`)

**Purpose**: Executes approved proposals by invoking tools (Lambda or MCP). Manages compensation log for SAGA rollback pattern.

**File**: `lambda/shared/services/cato-methods/executor.method.ts`

```typescript
interface ExecutorInput {
  proposal: ProposerOutput;
  dryRun?: boolean;                           // Simulate without executing
}

interface ExecutorOutput {
  executionId: string;
  status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'ROLLED_BACK';
  actionsExecuted: ActionResult[];
  artifacts: Array<{ artifactId: string; type: string; uri: string; metadata?: Record<string, unknown> }>;
  totalDurationMs: number;
  totalCostCents: number;
  compensationLog: Array<{ stepNumber: number; actionId: string; compensationType: CatoCompensationType; status: string }>;
}
```

**Tool Invocation**:
- **Lambda Tools**: Direct AWS Lambda invocation via `@aws-sdk/client-lambda`
- **MCP Tools**: HTTP POST to MCP Gateway (`/tools/call`)

**Compensation Logging**: Before each action, logs compensation strategy to `cato_compensation_log`. On failure, triggers LIFO rollback.

#### 21.3.5 Decider Method (`method:decider:v1`)

**Purpose**: Synthesizes critiques from multiple critics and makes a final decision. Used in War Room deliberation pipelines.

**File**: `lambda/shared/services/cato-methods/decider.method.ts`

```typescript
interface DeciderInput {
  proposal: ProposerOutput;
  critiques: Array<{ criticType: string; verdict: string; score: number; issues: Array<Record<string, unknown>>; recommendations: string[] }>;
}

interface DeciderOutput {
  decision: 'PROCEED' | 'PROCEED_WITH_MODIFICATIONS' | 'BLOCK' | 'ESCALATE';
  confidence: number;
  reasoning: string;
  synthesizedIssues: Array<{ issueId: string; severity: CatoRiskLevel; description: string; source: string; resolution: string }>;
  requiredModifications: string[];
  acceptedRisks: string[];
  dissent: Array<{ criticType: string; objection: string; weight: number }>;
  consensusLevel: 'UNANIMOUS' | 'MAJORITY' | 'SPLIT' | 'DEADLOCK';
  nextSteps: string[];
}
```

### 21.4 Universal Envelope Protocol

Every method output is wrapped in a `CatoMethodEnvelope` for consistent handling:

```typescript
interface CatoMethodEnvelope<T = unknown> {
  // Identity
  envelopeId: string;                         // Unique ID (UUID)
  pipelineId: string;                         // Parent pipeline
  tenantId: string;                           // Tenant isolation
  sequence: number;                           // Order in pipeline (0-indexed)
  envelopeVersion: string;                    // Protocol version ("5.0")

  // Source
  source: {
    methodId: string;                         // e.g., "method:observer:v1"
    methodType: CatoMethodType;               // OBSERVER, PROPOSER, etc.
    methodName: string;                       // Human-readable name
  };

  // Optional routing
  destination?: {
    methodId: string;
    routingReason: string;
  };

  // Output
  output: {
    outputType: CatoOutputType;               // CLASSIFICATION, PROPOSAL, ASSESSMENT, etc.
    schemaRef: string;                        // JSON Schema reference
    data: T;                                  // The actual typed output
    hash: string;                             // SHA-256 of data
    summary: string;                          // Human-readable summary
  };

  // Confidence
  confidence: {
    score: number;                            // 0-1 overall confidence
    factors: CatoConfidenceFactor[];          // Individual factors
  };

  // Context
  contextStrategy: CatoContextStrategy;       // FULL, MINIMAL, TAIL, RELEVANT, SUMMARY
  context: CatoAccumulatedContext;            // Pruned history

  // Risk
  riskSignals: CatoRiskSignal[];              // Detected risks

  // Tracing
  tracing: {
    traceId: string;                          // End-to-end trace ID
    spanId: string;                           // This method's span
    parentSpanId?: string;                    // Parent span (if chained)
  };

  // Compliance
  compliance: {
    frameworks: string[];                     // HIPAA, SOC2, etc.
    dataClassification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
    containsPii: boolean;
    containsPhi: boolean;
  };

  // Model usage
  models: CatoModelUsage[];                   // Models used, tokens, cost

  // Metrics
  durationMs: number;
  costCents: number;
  tokensUsed: number;
  timestamp: Date;
}
```

### 21.5 Context Strategies

Methods declare their context strategy for memory management:

| Strategy | Behavior | Use Case |
|----------|----------|----------|
| **FULL** | Pass all previous envelopes | Small pipelines, need full history |
| **MINIMAL** | Pass no previous envelopes | Stateless methods |
| **TAIL** | Pass last N envelopes (configurable `tailCount`) | Long pipelines, recent context |
| **RELEVANT** | Filter by `acceptsOutputTypes` | Type-specific methods |
| **SUMMARY** | LLM summarizes middle envelopes | Large context, token savings |

**Implementation** (`cato-method-executor.service.ts`):
```typescript
protected async applyContextStrategy(
  envelopes: CatoMethodEnvelope[],
  strategy: CatoContextStrategy
): Promise<CatoAccumulatedContext> {
  switch (strategy) {
    case CatoContextStrategy.FULL:
      return { history: envelopes, ... };
    case CatoContextStrategy.MINIMAL:
      return { history: [], ... };
    case CatoContextStrategy.TAIL:
      const tailCount = this.methodDefinition?.contextStrategy.tailCount || 5;
      return { history: envelopes.slice(-tailCount), ... };
    case CatoContextStrategy.RELEVANT:
      const acceptedTypes = this.methodDefinition?.acceptsOutputTypes || [];
      return { history: envelopes.filter(e => acceptedTypes.includes(e.output.outputType)), ... };
    case CatoContextStrategy.SUMMARY:
      return { history: await this.summarizeEnvelopes(envelopes), ... };
  }
}
```

### 21.6 Checkpoint System (HITL)

Five checkpoint gates with configurable modes per governance preset:

| Checkpoint | Name | Trigger Point | Purpose |
|------------|------|---------------|---------|
| **CP1** | Context Gate | After Observer | Clarify ambiguous intent |
| **CP2** | Plan Gate | After Proposer | Review proposed actions |
| **CP3** | Review Gate | After Critics | Address raised concerns |
| **CP4** | Execution Gate | Before Executor | Final approval before action |
| **CP5** | Post-Mortem Gate | After Executor | Review results |

**Governance Presets**:

```typescript
const CATO_GOVERNANCE_PRESETS = {
  COWBOY: {
    description: 'Maximum autonomy - minimal checkpoints',
    checkpoints: {
      CP1: { mode: DISABLED, triggerOn: [] },
      CP2: { mode: CONDITIONAL, triggerOn: ['destructive_action'] },
      CP3: { mode: DISABLED, triggerOn: [] },
      CP4: { mode: CONDITIONAL, triggerOn: ['critical_risk'] },
      CP5: { mode: DISABLED, triggerOn: [] },
    },
    riskThresholds: { autoExecute: 0.7, veto: 0.95 },
  },
  BALANCED: {
    description: 'Balanced autonomy - checkpoints at key decision points',
    checkpoints: {
      CP1: { mode: CONDITIONAL, triggerOn: ['ambiguous_intent', 'missing_context'] },
      CP2: { mode: CONDITIONAL, triggerOn: ['high_cost', 'irreversible_actions'] },
      CP3: { mode: CONDITIONAL, triggerOn: ['objections_raised', 'consensus_not_reached'] },
      CP4: { mode: CONDITIONAL, triggerOn: ['risk_above_threshold', 'cost_above_threshold'] },
      CP5: { mode: DISABLED, triggerOn: [] },
    },
    riskThresholds: { autoExecute: 0.5, veto: 0.85 },
  },
  PARANOID: {
    description: 'Maximum oversight - checkpoints at every stage',
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

### 21.7 Compensation (SAGA Pattern)

**File**: `cato-compensation.service.ts`

When pipeline execution fails, compensations execute in **reverse order** (LIFO):

```typescript
// Compensation entry logged BEFORE each action
interface CatoCompensationEntry {
  id: string;
  pipelineId: string;
  tenantId: string;
  stepNumber: number;                         // Determines LIFO order
  stepName?: string;
  compensationType: CatoCompensationType;     // DELETE, RESTORE, NOTIFY, MANUAL, NONE
  compensationTool?: string;                  // Tool to invoke for compensation
  compensationInputs?: Record<string, unknown>;
  affectedResources: CatoAffectedResource[];
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  originalAction: Record<string, unknown>;
  originalResult?: Record<string, unknown>;
}

// Compensation types
enum CatoCompensationType {
  DELETE = 'DELETE',                          // Delete created resource
  RESTORE = 'RESTORE',                        // Restore to previous state
  NOTIFY = 'NOTIFY',                          // Send notification only
  MANUAL = 'MANUAL',                          // Flag for manual intervention
  NONE = 'NONE',                              // No compensation needed
}
```

**Execution Flow**:
```typescript
async executeCompensations(pipelineId: string, tenantId: string): Promise<{ executed: number; failed: number }> {
  // Get pending compensations in REVERSE order (LIFO for SAGA)
  const compensations = await this.pool.query(
    `SELECT * FROM cato_compensation_log
     WHERE pipeline_id = $1 AND tenant_id = $2 AND status = 'PENDING'
     ORDER BY step_number DESC`,
    [pipelineId, tenantId]
  );
  
  for (const entry of compensations.rows) {
    await this.executeCompensation(entry);
  }
}
```

### 21.8 Database Schema

**Core Tables**:

| Table | Purpose |
|-------|---------|
| `cato_pipeline_executions` | Pipeline execution records |
| `cato_pipeline_envelopes` | All method output envelopes |
| `cato_pipeline_templates` | Reusable pipeline configurations |
| `cato_pipeline_checkpoints` | Checkpoint state for resume |
| `cato_method_definitions` | Method registry |
| `cato_schema_definitions` | JSON Schema registry |
| `cato_tool_definitions` | Tool registry |
| `cato_method_invocations` | Individual method invocation records |
| `cato_audit_prompt_records` | Full prompt/response audit trail |
| `cato_checkpoint_configurations` | Per-tenant checkpoint config |
| `cato_checkpoint_decisions` | Checkpoint decision records |
| `cato_risk_assessments` | Risk assessment records |
| `cato_compensation_log` | Compensation entries for SAGA |

### 21.9 API Reference

**Pipeline Execution**:
```
POST /api/admin/cato-pipeline/execute        # Start new pipeline
GET  /api/admin/cato-pipeline/:id            # Get execution status
POST /api/admin/cato-pipeline/:id/resume     # Resume from checkpoint
GET  /api/admin/cato-pipeline/:id/envelopes  # Get all envelopes
```

**Method Registry**:
```
GET  /api/admin/cato-pipeline/methods        # List methods
GET  /api/admin/cato-pipeline/methods/:id    # Get method definition
POST /api/admin/cato-pipeline/methods        # Create method
```

**Checkpoint Management**:
```
GET  /api/admin/cato-pipeline/checkpoints/pending  # Pending checkpoints
POST /api/admin/cato-pipeline/checkpoints/:id/resolve  # Resolve checkpoint
```

### 21.10 Implementation Files

| Component | File |
|-----------|------|
| Pipeline Orchestrator | `lambda/shared/services/cato-pipeline-orchestrator.service.ts` |
| Method Executor Base | `lambda/shared/services/cato-method-executor.service.ts` |
| Observer Method | `lambda/shared/services/cato-methods/observer.method.ts` |
| Proposer Method | `lambda/shared/services/cato-methods/proposer.method.ts` |
| Validator Method | `lambda/shared/services/cato-methods/validator.method.ts` |
| Executor Method | `lambda/shared/services/cato-methods/executor.method.ts` |
| Decider Method | `lambda/shared/services/cato-methods/decider.method.ts` |
| Checkpoint Service | `lambda/shared/services/cato-checkpoint.service.ts` |
| Compensation Service | `lambda/shared/services/cato-compensation.service.ts` |
| Method Registry | `lambda/shared/services/cato-method-registry.service.ts` |
| TypeScript Types | `packages/shared/src/types/cato-pipeline.types.ts` |

---

## 22. Think Tank Application Architecture (v5.52.52)

Think Tank is the consumer-facing AI assistant application built on the RADIANT platform. This section provides complete technical architecture documentation.

### 22.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              THINK TANK                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        FRONTEND (Next.js 14)                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │  │
│  │  │ Chat UI     │  │ Settings    │  │ Collaborate │  │ Dashboard  │  │  │
│  │  │ Components  │  │ Pages       │  │ Features    │  │ Views      │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │                    State Management (Zustand)                    │ │  │
│  │  │  UIStore • ChatStore • SettingsStore • CollaborationStore       │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │                    API Client Layer                              │ │  │
│  │  │  ChatService • GrimoireService • TimeTravelService • ...        │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      API GATEWAY (/api/v2/thinktank/*)               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      BACKEND (Lambda Handlers)                        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │ handler  │ │ conver-  │ │ grimoire │ │ time-    │ │ sentinel │  │  │
│  │  │  .ts     │ │ sations  │ │   .ts    │ │ travel   │ │ -agents  │  │  │
│  │  │ (Router) │ │   .ts    │ │          │ │   .ts    │ │   .ts    │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  │  + 36 more handlers                                                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      SHARED SERVICES                                  │  │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐           │  │
│  │  │ AGI Brain      │ │ Time Travel    │ │ Grimoire       │           │  │
│  │  │ Planner        │ │ Service        │ │ Service        │           │  │
│  │  └────────────────┘ └────────────────┘ └────────────────┘           │  │
│  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐           │  │
│  │  │ Sentinel       │ │ Economic       │ │ Council of     │           │  │
│  │  │ Agent Service  │ │ Governor       │ │ Rivals         │           │  │
│  │  └────────────────┘ └────────────────┘ └────────────────┘           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      AURORA POSTGRESQL (RLS)                          │  │
│  │  thinktank_conversations • thinktank_messages • grimoire_spells      │  │
│  │  timelines • sentinel_agents • user_contexts • flash_facts           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 22.2 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend Framework** | Next.js | 14.2.35 |
| **UI Library** | React | 18.2.0 |
| **State Management** | Zustand | 4.5.0 |
| **Animation** | Framer Motion | 11.0.3 |
| **Data Fetching** | React Query | 5.17.9 |
| **Icons** | Lucide React | 0.309.0 |
| **Notifications** | Sonner | 1.3.1 |
| **UI Components** | Radix UI | Various |
| **Styling** | Tailwind CSS | 3.4.1 |

### 22.3 Frontend Structure

**Location**: `apps/thinktank/`

```
apps/thinktank/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Home page
│   ├── chat/                    # Chat routes
│   │   └── [conversationId]/    # Dynamic conversation routes
│   ├── settings/                # Settings pages
│   ├── collaborate/             # Collaboration features
│   └── profile/                 # User profile
│
├── components/                   # React components
│   ├── chat/                    # Chat UI components
│   │   ├── ModernChatInterface.tsx    # Main chat component
│   │   ├── ChatMessage.tsx            # Message display
│   │   ├── ChatInput.tsx              # Input with attachments
│   │   ├── StreamingMessage.tsx       # SSE streaming
│   │   ├── BrainPlanViewer.tsx        # AGI plan visualization
│   │   └── ConversationSidebar.tsx    # Conversation list
│   │
│   ├── ui/                      # Base UI components
│   │   ├── Button.tsx
│   │   ├── Dialog.tsx
│   │   ├── Card.tsx
│   │   └── GlassPanel.tsx
│   │
│   └── features/                # Feature-specific components
│       ├── TimeMachine/
│       ├── Grimoire/
│       ├── SentinelAgents/
│       └── CouncilOfRivals/
│
├── lib/                         # Utilities and services
│   ├── api/                     # API client modules
│   │   ├── chat.ts             # Chat API
│   │   ├── grimoire.ts         # Grimoire API
│   │   ├── time-travel.ts      # Time Machine API
│   │   └── sentinel.ts         # Sentinel Agents API
│   │
│   └── stores/                  # Zustand stores
│       ├── ui-store.ts         # UI state
│       └── chat-store.ts       # Chat state
│
└── package.json                 # Dependencies
```

### 22.4 Backend Handler Architecture

**Location**: `packages/infrastructure/lambda/thinktank/`

The main router (`handler.ts`) dispatches to 41 specialized handlers:

```typescript
// handler.ts - Main router
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const resource = extractResource(event.path); // e.g., "conversations", "grimoire"
  
  switch (resource) {
    case 'conversations': return conversationsHandler(event);
    case 'grimoire': return grimoireHandler(event);
    case 'time-travel': return timeTravelHandler(event);
    case 'sentinel-agents': return sentinelAgentsHandler(event);
    case 'brain-plan': return brainPlanHandler(event);
    case 'flash-facts': return flashFactsHandler(event);
    case 'council-of-rivals': return councilOfRivalsHandler(event);
    case 'economic-governor': return economicGovernorHandler(event);
    // ... 33 more handlers
  }
};
```

#### Handler Inventory

| Handler | File | Size | Functions |
|---------|------|------|-----------|
| **conversations** | `conversations.ts` | 15.2KB | CRUD, stats, search |
| **grimoire** | `grimoire.ts` | 12.8KB | Spells, schools, casting |
| **time-travel** | `time-travel.ts` | 14.1KB | Timelines, checkpoints, forks |
| **sentinel-agents** | `sentinel-agents.ts` | 18.3KB | Agents, events, triggers |
| **brain-plan** | `brain-plan.ts` | 8.9KB | Plan generation |
| **user-context** | `user-context.ts` | 11.2KB | User memories, preferences |
| **flash-facts** | `flash-facts.ts` | 7.4KB | Quick fact storage |
| **council-of-rivals** | `council-of-rivals.ts` | 16.7KB | Multi-model deliberation |
| **economic-governor** | `economic-governor.ts` | 13.5KB | Cost routing, arbitrage |
| **derivation-history** | `derivation-history.ts` | 9.8KB | Execution traces |
| **delight** | `delight.ts` | 10.1KB | Personality, achievements |
| **collaboration** | `collaboration.ts` | 19.2KB | Sessions, real-time |
| **domain-taxonomy** | `domain-taxonomy.ts` | 12.4KB | Domain detection |
| **feedback** | `feedback.ts` | 6.3KB | User ratings, learning |
| **media** | `media.ts` | 8.7KB | File attachments |

### 22.5 API Endpoint Reference

**Base Path**: `/api/v2/thinktank`

#### Core Conversation API

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/conversations` | `listConversations` | List user conversations |
| `POST` | `/conversations` | `createConversation` | Create new conversation |
| `GET` | `/conversations/:id` | `getConversation` | Get conversation by ID |
| `DELETE` | `/conversations/:id` | `deleteConversation` | Delete conversation |
| `GET` | `/conversations/stats` | `getConversationStats` | Usage statistics |

#### Message API

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `POST` | `/messages` | `sendMessage` | Send message (non-streaming) |
| `POST` | `/messages/stream` | `streamMessage` | Send message (SSE streaming) |
| `POST` | `/messages/:id/rate` | `rateMessage` | Rate response quality |
| `POST` | `/messages/:id/regenerate` | `regenerateMessage` | Regenerate response |

#### Time Travel API

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/time-travel/timelines` | `listTimelines` | List conversation timelines |
| `POST` | `/time-travel/timelines` | `createTimeline` | Create new timeline |
| `POST` | `/time-travel/fork` | `forkTimeline` | Fork from checkpoint |
| `POST` | `/time-travel/checkpoint` | `createCheckpoint` | Create checkpoint |
| `POST` | `/time-travel/replay` | `replayTimeline` | Replay timeline states |

#### Grimoire API

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/grimoire/spells` | `listSpells` | List learned patterns |
| `GET` | `/grimoire/spells/:id` | `getSpell` | Get spell details |
| `POST` | `/grimoire/cast` | `castSpell` | Apply spell to context |
| `GET` | `/grimoire/schools` | `listSchools` | List spell schools |
| `POST` | `/grimoire/promote` | `promoteToSpell` | Promote pattern to spell |

#### Sentinel Agents API

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/sentinel-agents` | `listAgents` | List active agents |
| `POST` | `/sentinel-agents` | `createAgent` | Create new agent |
| `PATCH` | `/sentinel-agents/:id` | `updateAgent` | Update agent config |
| `DELETE` | `/sentinel-agents/:id` | `deleteAgent` | Remove agent |
| `GET` | `/sentinel-agents/events` | `getAllEvents` | View triggered events |
| `GET` | `/sentinel-agents/stats` | `getStats` | Agent statistics |

#### Economic Governor API

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/economic-governor/config` | `getConfig` | Get routing config |
| `PUT` | `/economic-governor/config` | `updateConfig` | Update config |
| `GET` | `/economic-governor/usage` | `getUsage` | Usage statistics |
| `POST` | `/economic-governor/estimate` | `estimateCost` | Estimate query cost |
| `GET` | `/economic-governor/arbitrage` | `getArbitrageRules` | List routing rules |

### 22.6 Key TypeScript Interfaces

```typescript
// ChatMessage - Core message structure
interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  metadata?: {
    model?: string;
    tokensUsed?: number;
    latencyMs?: number;
    cost?: number;
    orchestrationMode?: OrchestrationMode;
    domainDetection?: DomainDetection;
    brainPlanId?: string;
  };
}

// Conversation - Conversation container
interface Conversation {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  status: 'active' | 'archived' | 'deleted';
  messageCount: number;
  totalTokens: number;
  totalCost: number;
  createdAt: Date;
  updatedAt: Date;
}

// Timeline - Time Machine branch
interface Timeline {
  id: string;
  conversationId: string;
  parentTimelineId?: string;
  name: string;
  checkpointCount: number;
  status: 'active' | 'merged' | 'abandoned';
  forkPoint?: {
    checkpointId: string;
    messageIndex: number;
  };
  createdAt: Date;
}

// Spell - Grimoire pattern
interface Spell {
  id: string;
  name: string;
  description: string;
  school: SpellSchool;
  category: SpellCategory;
  power: number; // 1-5
  successRate: number;
  timesUsed: number;
  pattern: {
    trigger: string;
    transformation: string;
    validation?: string;
  };
  status: 'active' | 'deprecated' | 'testing';
}

// SentinelAgent - Background monitor
interface SentinelAgent {
  id: string;
  name: string;
  type: 'monitor' | 'guardian' | 'optimizer' | 'auditor';
  triggerConditions: TriggerCondition[];
  actions: AgentAction[];
  enabled: boolean;
  lastFired?: Date;
  fireCount: number;
}

// BrainPlan - AGI execution plan
interface BrainPlan {
  id: string;
  prompt: string;
  orchestrationMode: OrchestrationMode;
  domainDetection: DomainDetection;
  modelSelection: {
    model: string;
    reason: string;
    alternatives: string[];
  };
  steps: PlanStep[];
  estimatedCost: number;
  estimatedLatencyMs: number;
  qualityTargets: QualityTargets;
}
```

### 22.7 Database Schema

**Core Tables** (Migration 042):

```sql
-- thinktank_conversations
CREATE TABLE thinktank_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT,
  status conversation_status DEFAULT 'active',
  message_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- thinktank_messages
CREATE TABLE thinktank_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES thinktank_conversations(id),
  role message_role NOT NULL,
  content TEXT NOT NULL,
  model TEXT,
  tokens_used INTEGER,
  latency_ms INTEGER,
  cost DECIMAL(10,6),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE thinktank_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON thinktank_conversations
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

**Additional Tables**:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `time_travel_timelines` | Time Machine branches | `conversation_id`, `user_id`, `name`, `status` |
| `time_travel_checkpoints` | Saved states | `timeline_id`, `sequence`, `state`, `type` |
| `time_travel_forks` | Fork records | `source_timeline_id`, `forked_timeline_id`, `checkpoint_id` |
| `grimoire_spells` | Learned patterns | `school`, `category`, `power_level`, `incantation` |
| `grimoire_casts` | Cast history | `spell_id`, `user_id`, `components`, `success` |
| `sentinel_agents` | Background monitors | `type`, `watch_domain`, `conditions`, `actions` |
| `sentinel_events` | Triggered events | `agent_id`, `trigger_type`, `payload`, `status` |
| `flash_facts` | Quick facts | `user_id`, `fact_key`, `category`, `confidence` |
| `economic_governor_config` | Cost settings | `mode`, `budget_limit`, `model_tiers`, `arbitrage_rules` |
| `economic_governor_usage` | Usage tracking | `model_id`, `tokens`, `cost`, `period` |
| `council_of_rivals` | Multi-model councils | `name`, `members`, `voting_strategy` |
| `council_debates` | Debate sessions | `council_id`, `topic`, `votes`, `final_decision` |

### 22.8 State Management

Think Tank uses Zustand for client-side state management with persistence.

```typescript
// ui-store.ts
interface UIState {
  sidebarOpen: boolean;
  advancedMode: boolean;
  focusMode: boolean;
  soundEnabled: boolean;
  
  // Actions
  toggleSidebar: () => void;
  toggleAdvancedMode: () => void;
  toggleFocusMode: () => void;
  toggleSound: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      advancedMode: false,
      focusMode: false,
      soundEnabled: true,
      
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleAdvancedMode: () => set((s) => ({ advancedMode: !s.advancedMode })),
      toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
    }),
    {
      name: 'thinktank-ui',
      partialize: (state) => ({ 
        advancedMode: state.advancedMode,
        soundEnabled: state.soundEnabled 
      }),
    }
  )
);
```

### 22.9 Streaming Architecture

Think Tank uses Server-Sent Events (SSE) for real-time message streaming:

```typescript
// Frontend - ChatService.streamMessage()
async *streamMessage(conversationId: string, content: string): AsyncGenerator<StreamChunk> {
  const response = await fetch(`${API_BASE}/messages/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, content }),
  });
  
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
    
    for (const line of lines) {
      const data = JSON.parse(line.slice(6));
      yield data as StreamChunk;
    }
  }
}

// StreamChunk types
interface StreamChunk {
  type: 'token' | 'metadata' | 'complete' | 'error';
  content?: string;
  metadata?: MessageMetadata;
  error?: string;
}
```

### 22.10 Feature Implementation Files

| Feature | Frontend | Backend | Service |
|---------|----------|---------|---------|
| **Chat** | `components/chat/ModernChatInterface.tsx` | `lambda/thinktank/messages.ts` | - |
| **Time Machine** | `components/features/TimeMachine/` | `lambda/thinktank/time-travel.ts` | `services/time-travel.service.ts` |
| **Grimoire** | `components/features/Grimoire/` | `lambda/thinktank/grimoire.ts` | `services/grimoire.service.ts` |
| **Sentinels** | `components/features/SentinelAgents/` | `lambda/thinktank/sentinel-agents.ts` | `services/sentinel-agent.service.ts` |
| **Flash Facts** | `lib/api/flash-facts.ts` | `lambda/thinktank/flash-facts.ts` | `services/flash-facts.service.ts` |
| **Economic Governor** | `lib/api/economic-governor.ts` | `lambda/thinktank/economic-governor.ts` | `services/economic-governor.service.ts` |
| **Council of Rivals** | `components/features/CouncilOfRivals/` | `lambda/thinktank/council-of-rivals.ts` | `services/deliberation.service.ts` |
| **Brain Plans** | `components/chat/BrainPlanViewer.tsx` | `lambda/thinktank/brain-plan.ts` | `services/agi-brain-planner.service.ts` |

---

## Appendix A: Adding New Documentation

When implementing new features, add documentation to the appropriate section:

1. **Architecture decisions** → Relevant section above
2. **New AWS services** → Section 2
3. **Database changes** → Section 3
4. **New AI capabilities** → Section 4
5. **Lambda handlers** → Section 5
6. **CDK changes** → Section 6
7. **Security features** → Section 7
8. **New dependencies** → Section 8
9. **API specifications** → Section 10.1
10. **Performance guides** → Section 10.2
11. **Security documentation** → Section 10.3
12. **Admin API handlers** → Section 16

See `/.windsurf/workflows/documentation-consolidation.md` for the enforcement policy.

---

## 22. Model Registry & Version Discovery System (v5.52.57)

### 22.1 Overview

The Model Registry system provides comprehensive management of self-hosted AI model versions, including automated discovery from HuggingFace, thermal state management for cost optimization, and safe deletion with usage session tracking.

**Core Capabilities:**
- **Automated Discovery**: Poll HuggingFace API for new versions of watched model families
- **Version Management**: Track all model versions with metadata, storage info, and deployment status
- **Thermal States**: Hot/Warm/Cold/Off states for cost and latency optimization
- **Safe Deletion**: Queue-based deletion that waits for active sessions to complete

### 22.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MODEL REGISTRY ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐    │
│  │   HuggingFace    │     │  Model Version   │     │  Deletion Queue  │    │
│  │   Discovery      │────▶│    Manager       │────▶│    Service       │    │
│  │   Service        │     │                  │     │                  │    │
│  └────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘    │
│           │                        │                        │              │
│           │  Polls HF API          │  Manages S3            │  Tracks      │
│           │  for new versions      │  and thermal           │  sessions    │
│           │                        │  states                │              │
│           ▼                        ▼                        ▼              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     PostgreSQL Tables                                │   │
│  │  model_versions | model_family_watchlist | model_discovery_jobs     │   │
│  │  model_deletion_queue | model_usage_sessions                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         S3 Storage                                   │   │
│  │  radiant-models-{env}/                                               │   │
│  │  ├── llama/3.2-70b/weights/                                         │   │
│  │  ├── qwen/2.5-72b/weights/                                          │   │
│  │  └── deepseek/v3/weights/                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 22.3 HuggingFace Discovery Service

**File**: `lambda/shared/services/huggingface-discovery.service.ts`

```typescript
interface HuggingFaceDiscoveryService {
  // Core discovery
  runDiscovery(userId?: string, families?: string[]): Promise<ModelDiscoveryJob>;
  getRecentDiscoveryJobs(limit?: number): Promise<ModelDiscoveryJob[]>;
  
  // Watchlist management
  getWatchlist(): Promise<ModelFamilyWatchlist[]>;
  addWatchlistFamily(family: WatchlistInput): Promise<ModelFamilyWatchlist>;
  updateWatchlistItem(family: string, updates: Partial<WatchlistInput>): Promise<void>;
  removeWatchlistFamily(family: string): Promise<void>;
  
  // HuggingFace API
  searchModels(query: string, filters?: HFSearchFilters): Promise<HFModelInfo[]>;
  getModelInfo(modelId: string): Promise<HFModelInfo>;
}
```

**Key Features:**
- **Rate Limiting**: Respects HuggingFace API limits with configurable delays
- **API Token Management**: Retrieves token from AWS Secrets Manager
- **Version Extraction**: Parses version from model names, tags, and metadata
- **Family Filtering**: Only discovers models from watched families

### 22.4 Model Version Manager Service

**File**: `lambda/shared/services/model-version-manager.service.ts`

```typescript
interface ModelVersionManagerService {
  // CRUD operations
  listVersions(filters?: VersionFilters): Promise<{ versions: ModelVersion[]; total: number }>;
  getVersion(id: string): Promise<ModelVersion | null>;
  createVersion(input: CreateVersionInput): Promise<ModelVersion>;
  updateVersion(id: string, updates: Partial<ModelVersion>): Promise<ModelVersion>;
  
  // Thermal state management
  setThermalState(id: string, state: ThermalState): Promise<void>;
  bulkSetThermalState(ids: string[], state: ThermalState): Promise<number>;
  
  // S3 storage
  getStorageInfo(id: string): Promise<StorageInfo>;
  deleteS3Data(id: string): Promise<{ deletedBytes: number }>;
  
  // Dashboard
  getDashboard(): Promise<VersionDashboard>;
}
```

**Thermal States:**

| State | Description | SageMaker Status | Cold Start |
|-------|-------------|------------------|------------|
| `hot` | Fully loaded, instant response | Running | 0ms |
| `warm` | Loaded on demand | Scaling | 5-30s |
| `cold` | In S3, requires download | Stopped | 2-10min |
| `off` | Disabled, not available | Deleted | N/A |

### 22.5 Model Deletion Queue Service

**File**: `lambda/shared/services/model-deletion-queue.service.ts`

```typescript
interface ModelDeletionQueueService {
  // Queue management
  listQueueItems(filters?: QueueFilters): Promise<DeletionQueueItem[]>;
  queueForDeletion(input: QueueInput): Promise<DeletionQueueItem>;
  cancelDeletion(id: string): Promise<void>;
  updatePriority(id: string, priority: number): Promise<void>;
  
  // Processing
  processNextInQueue(): Promise<boolean>;
  refreshBlockedItems(): Promise<number>;
  
  // Usage tracking
  getActiveSessions(modelVersionId: string): Promise<UsageSession[]>;
  
  // Dashboard
  getQueueDashboard(): Promise<QueueDashboard>;
}
```

**Deletion States:**

```
pending ─────▶ processing ─────▶ completed
    │              │
    │              └───▶ failed (retry)
    │
    └─▶ blocked (active sessions) ─▶ pending (when sessions end)
    │
    └─▶ cancelled (admin action)
```

### 22.6 Database Schema

**Migration**: `039_model_version_discovery.sql`

```sql
-- Model versions with thermal state tracking
CREATE TABLE model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL,
  family model_family NOT NULL,
  version TEXT NOT NULL,
  display_name TEXT,
  huggingface_id TEXT,
  thermal_state thermal_state DEFAULT 'off',
  download_status download_status DEFAULT 'pending',
  deployment_status deployment_status DEFAULT 'not_deployed',
  is_active BOOLEAN DEFAULT true,
  s3_bucket TEXT,
  s3_prefix TEXT,
  storage_size_bytes BIGINT DEFAULT 0,
  total_requests BIGINT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(model_id, version)
);

-- HuggingFace discovery watchlist
CREATE TABLE model_family_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family model_family NOT NULL UNIQUE,
  is_enabled BOOLEAN DEFAULT true,
  auto_download BOOLEAN DEFAULT false,
  auto_deploy BOOLEAN DEFAULT false,
  huggingface_org TEXT,
  min_likes INTEGER DEFAULT 100,
  check_interval_hours INTEGER DEFAULT 24,
  last_checked_at TIMESTAMPTZ,
  versions_found INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

-- Soft deletion queue
CREATE TABLE model_deletion_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id UUID NOT NULL REFERENCES model_versions(id),
  status deletion_status DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  reason TEXT,
  queued_by UUID,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  s3_bytes_deleted BIGINT DEFAULT 0
);

-- Active usage session tracking
CREATE TABLE model_usage_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id UUID NOT NULL REFERENCES model_versions(id),
  session_id TEXT NOT NULL,
  user_id UUID,
  tenant_id UUID,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  request_count INTEGER DEFAULT 0
);
```

### 22.7 Admin API Endpoints

**File**: `lambda/admin/model-registry.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dashboard` | GET | Overview statistics |
| `/versions` | GET | List versions with filtering |
| `/versions` | POST | Create new version |
| `/versions/:id` | GET | Get version details |
| `/versions/:id` | PATCH | Update version |
| `/versions/:id/thermal` | POST | Set thermal state |
| `/versions/thermal/bulk` | POST | Bulk thermal update |
| `/versions/:id/storage` | GET | S3 storage info |
| `/discovery/run` | POST | Trigger discovery |
| `/discovery/jobs` | GET | List discovery jobs |
| `/watchlist` | GET | Get watchlist |
| `/watchlist` | POST | Add to watchlist |
| `/watchlist/:family` | PATCH | Update watchlist item |
| `/watchlist/:family` | DELETE | Remove from watchlist |
| `/deletion-queue` | GET | List queued items |
| `/deletion-queue` | POST | Queue for deletion |
| `/deletion-queue/:id/cancel` | POST | Cancel deletion |
| `/deletion-queue/process` | POST | Process next deletion |

### 22.8 Scheduler Integration

**File**: `lambda/scheduled/model-sync.ts`

The model-sync scheduler now includes:

1. **Registry Sync**: Sync models from code registry to database
2. **HuggingFace Discovery**: Run discovery if `syncFromHuggingFace` is enabled in config
3. **Deletion Processing**: Process up to 5 pending deletions per run
4. **Blocked Refresh**: Check if blocked deletions can proceed (sessions ended)

```typescript
// Scheduled sync now returns extended result
interface SyncResult {
  success: boolean;
  jobId?: string;
  modelsScanned: number;
  modelsAdded: number;
  modelsUpdated: number;
  durationMs: number;
  errors: string[];
  discovery?: {
    ran: boolean;
    modelsDiscovered: number;
    modelsAdded: number;
  };
  deletionQueue?: {
    processed: number;
    unblocked: number;
  };
}
```

### 22.9 Admin Dashboard

**File**: `apps/admin-dashboard/app/(dashboard)/model-registry/`

| Tab | Features |
|-----|----------|
| **Overview** | Version counts, thermal distribution, storage stats, deletion queue summary |
| **Versions** | List with family/thermal filters, thermal state controls, delete action |
| **Watchlist** | Enable/disable per family, auto-download toggle, HF org config |
| **Deletion Queue** | Status, active sessions, cancel action, reason display |
| **Discovery Jobs** | Job history with type, status, models discovered/added |

---

## 23. Universal Envelope Protocol v2.0 (v5.53.0)

### 23.1 Overview

UEP v2.0 is RADIANT's next-generation protocol for **multi-modal, asynchronous, streaming communication** between AI methods, agents, and subsystems. It extends UEP v1.0 (the `CatoMethodEnvelope`) with comprehensive support for:

- **Multi-modal payloads**: Text, images, audio, video, documents (PDF, DOCX), and binary data
- **Chunked streaming**: Progressive delivery with sequence tracking
- **Resumable transfers**: tus.io-inspired resume tokens for interrupted transfers
- **Rich source/destination metadata**: A2A Agent Card-inspired capability discovery
- **Cross-subsystem routing**: Unified communication across all RADIANT services

**Full Specification**: `docs/specs/UEP-V2-SPECIFICATION.md`

### 23.2 Industry Standards Incorporated

| Standard | What We Took | How We Improved |
|----------|--------------|-----------------|
| **Google A2A Protocol** | Agent Cards, JSON-RPC 2.0 base | Added streaming, multi-modal, chunking |
| **CloudEvents (CNCF)** | `source`, `id`, `type`, `specversion` | Added AI-specific risk, confidence, compliance |
| **Anthropic MCP** | Tools/Resources/Prompts primitives | Unified into single envelope model |
| **OpenTelemetry OTLP** | Trace/Span/Resource model | Enhanced with baggage support |
| **tus.io** | Resumable uploads with `Upload-Offset` | Generalized to any payload type |
| **MIME Multipart** | Multi-part message format | Modernized with JSON manifest |
| **AsyncAPI** | Channel/message schema definitions | Used for WebSocket binding |

### 23.3 Envelope Types

```typescript
type UEPEnvelopeType = 
  // Pipeline (v1.0 compatible)
  | 'method.output' | 'method.input'
  
  // Streaming (NEW)
  | 'stream.start' | 'stream.chunk' | 'stream.end' 
  | 'stream.error' | 'stream.cancel'
  
  // Artifacts (NEW)
  | 'artifact.created' | 'artifact.reference'
  
  // Control (NEW)
  | 'control.ack' | 'control.nack' | 'control.heartbeat' | 'control.capability'
  
  // Events (NEW)
  | 'event.checkpoint' | 'event.progress' | 'event.error';
```

### 23.4 Source Card (A2A-inspired)

Every envelope identifies its producer with rich metadata:

```typescript
interface UEPSourceCard {
  sourceId: string;              // 'method:observer:v2', 'model:claude-3.5'
  sourceType: UEPSourceType;     // 'method' | 'tool' | 'model' | 'agent' | 'service'
  name: string;                  // Human-readable name
  version: string;               // Semantic version
  
  registryRef?: {
    registry: 'cato-method' | 'cato-tool' | 'model' | 'agent' | 'service';
    lookupKey: string;           // Key to look up in registry
  };
  
  aiModel?: {
    provider: string;            // 'anthropic', 'openai', 'self-hosted'
    modelId: string;             // 'claude-3.5-sonnet'
    temperature?: number;
    mode?: string;               // 'thinking', 'creative', 'coding'
  };
  
  capabilities?: string[];       // ['text-generation', 'code-execution']
  executionContext?: {
    pipelineId?: string;
    tenantId: string;
    userId?: string;
  };
}
```

### 23.5 Multi-Modal Payload System

```typescript
interface UEPPayload<T = unknown> {
  contentType: string;           // MIME type: 'application/json', 'video/mp4'
  contentEncoding?: string;      // 'base64', 'gzip', 'br'
  delivery: 'inline' | 'reference' | 'chunked';
  
  // Inline (small payloads < 1MB)
  data?: T;
  
  // Reference (large payloads - video, audio, documents)
  reference?: {
    uri: string;                 // s3://bucket/key, https://...
    protocol: 'https' | 's3' | 'radiant' | 'ipfs';
    accessMethod: 'presigned_url' | 'bearer_token' | 'public';
    supportsRangeRequests: boolean;
  };
  
  // Multi-part (mixed content)
  parts?: UEPPayloadPart[];
  
  // Integrity
  hash?: { algorithm: 'sha256' | 'blake3'; value: string };
  sizeBytes?: number;
}
```

### 23.6 Chunked Streaming Protocol

Stream lifecycle for progressive delivery:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ stream.start│────▶│stream.chunk │────▶│stream.chunk │────▶│ stream.end  │
│   (1/N)     │     │   (2/N)     │     │   (N-1/N)   │     │   (N/N)     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

```typescript
interface UEPStreamingInfo {
  streamId: string;              // Groups all chunks together
  sequence: {
    current: number;             // 1-indexed chunk number
    total?: number;              // Total if known
    isFirst: boolean;
    isLast: boolean;
  };
  progress?: {
    bytesTransferred: number;
    bytesTotal?: number;
    percentComplete?: number;
  };
  resumable: boolean;
  resumeToken?: string;          // Token to resume from this point
  uploadOffset?: number;         // Byte offset for resumption
}
```

### 23.7 Cross-Subsystem Routing

| Subsystem | Routing Prefix | Purpose |
|-----------|---------------|---------|
| Cato Pipeline | `cato://` | Method orchestration |
| Brain Router | `brain://` | Model selection & inference |
| Cortex Memory | `cortex://` | Vector store & retrieval |
| Genesis Safety | `genesis://` | Ethics & safety checks |
| Curator | `curator://` | Content curation |
| Think Tank | `thinktank://` | User sessions |
| UDS | `uds://` | User data service |
| Blackboard | `blackboard://` | Multi-agent coordination |

### 23.8 TypeScript Types

**File**: `packages/shared/src/types/uep-v2.types.ts`

Key exports:
- `UEPEnvelope<T>` - Full envelope interface with generics
- `UEPSourceCard`, `UEPDestinationCard` - Source/destination metadata
- `UEPPayload`, `UEPContentReference` - Multi-modal payload support
- `UEPStreamingInfo`, `UEPStreamProgress` - Chunked streaming
- Specialized: `UEPStreamStartEnvelope`, `UEPStreamChunkEnvelope`, `UEPStreamEndEnvelope`

### 23.9 Database Schema

New tables for UEP v2.0:

| Table | Purpose |
|-------|---------|
| `uep_envelopes_v2` | Extended envelope storage with streaming support |
| `uep_streams` | Stream lifecycle management with resume tokens |
| `uep_artifacts` | Artifact registry for external content references |

All tables include RLS policies for multi-tenant isolation.

### 23.10 Backward Compatibility

UEP v1.0 `CatoMethodEnvelope` objects are **fully compatible** with v2.0:

```typescript
function migrateV1ToV2<T>(v1: CatoMethodEnvelope<T>): UEPEnvelope<T> {
  return {
    envelopeId: v1.envelopeId,
    specversion: '2.0',
    type: 'method.output',
    source: {
      sourceId: v1.source.methodId,
      sourceType: 'method',
      name: v1.source.methodName,
      version: '1.0.0',
    },
    payload: {
      contentType: 'application/json',
      delivery: 'inline',
      data: v1.output.data,
    },
    tracing: v1.tracing,
    // ... rest of mapping
  };
}
```

### 23.11 Regulatory Compliance

UEP v2.0 includes comprehensive regulatory compliance via `UEPComplianceService`:

**Supported Frameworks**:
- **HIPAA**: PHI detection, 6-year retention, encryption enforcement
- **GDPR**: PII detection, data subject rights, cross-border controls
- **SOC2**: Audit logging, change management, monitoring
- **FDA 21 CFR Part 11**: Electronic signatures, record retention
- **CCPA**: Consumer privacy rights
- **PCI-DSS**: Payment card data security

**PHI/PII Detection Patterns**:
```typescript
// Automatically detects:
- SSN: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/
- MRN: /\b(MRN|Medical Record)[:\s#]*\d{6,12}\b/
- Email, Phone, DOB, Credit Cards
- ICD-10 diagnosis codes, medications
```

**Compliance Enforcement**:
```typescript
const { envelope, riskSignals } = complianceService.enforceCompliance(
  envelope,
  ['HIPAA', 'SOC2'],
  tenantId
);
// Automatically:
// - Detects PHI/PII
// - Sets dataClassification
// - Calculates retentionDays
// - Adds risk signals
```

**Audit Report**: `docs/specs/UEP-V2-REGULATORY-COMPLIANCE-AUDIT.md`

---

## 24. Gemini Workflow Enhancements (v5.53.0)

### 24.1 Overview

Following Gemini AI consultation on RADIANT's workflow architecture, we implemented six strategic enhancements with mitigated approaches that balance innovation with practical concerns.

**Services Directory**: `lambda/shared/services/workflow/`

### 24.2 Multimedia Sidecar Service

**File**: `multimedia-sidecar.service.ts`

Implements the "Sidecar & Bridge" pattern for multimedia orchestration:

| Component | Purpose |
|-----------|---------|
| Cognitive Sidecars | Pre-computed representations (transcriptions, embeddings, descriptions) |
| Auto-Bridging | Automatic cross-modal condition evaluation |
| Zero-Copy | S3 URIs + sidecars in envelopes, never raw media bytes |

**Key Types**:
```typescript
interface CognitiveSidecar {
  transcription?: { text: string; language: string; confidence: number };
  frameSamples?: Array<{ timestampMs: number; signedUrl: string }>;
  embedding?: { model: string; vector: number[]; dimensions: number };
  description?: { short: string; medium: string; detailed: string };
  documentContent?: { extractedText: string; pageCount: number };
}

interface MultimediaStream {
  streamId: string;
  mediaType: 'text' | 'image' | 'audio' | 'video' | 'document';
  sourceUri: string;  // S3 URI
  sidecar: CognitiveSidecar;
}
```

**Usage**:
```typescript
// Generate sidecar during upload
const sidecar = await multimediaSidecarService.generateSidecar(
  's3://bucket/video.mp4', 'video',
  { generateTranscription: true, generateDescription: true }
);

// Auto-bridge for cross-modal conditions
const bridge = multimediaSidecarService.autoBridge(stream, 'text');
// bridge.content = sidecar.transcription.text
```

### 24.3 Sandboxed Expression Engine

**File**: `sandboxed-expression.service.ts`

Replaces unsafe `new Function()` with AST-based evaluation:

| Security Feature | Implementation |
|------------------|----------------|
| AST Parsing | Tokenizer → Parser → Evaluator |
| Allowlisted Operators | `+`, `-`, `*`, `/`, `>`, `<`, `&&`, `||`, etc. |
| Safe Helpers | `contains()`, `hasField()`, `matches()`, `length()` |
| Blocked Properties | `__proto__`, `constructor`, `eval`, `Function` |

**Usage**:
```typescript
const result = sandboxedExpressionService.evaluate(
  'confidence > 0.8 && contains("approved")',
  { output: response, confidence: 0.95 }
);
// result.success = true, result.value = true
```

### 24.4 Vector Semantic Router

**File**: `vector-semantic-router.service.ts`

Vector similarity for ROUTING decisions (not condition evaluation):

| Feature | Purpose |
|---------|---------|
| Refusal Detection | Fast safety check via pre-computed refusal vectors |
| Workflow Matching | Semantic similarity to find best workflow |
| Domain Detection | Keyword + embedding-based classification |
| Historical Learning | Learn from past routing decisions |

**Mitigation**: Vector similarity is expensive. Used for routing only, not hot-path conditions.

### 24.5 Enhanced Uncertainty Service

**File**: `enhanced-uncertainty.service.ts`

Integrates "surprise" into existing Semantic Entropy (not a parallel system):

```typescript
interface UncertaintyMetrics {
  semanticEntropy: number;        // 0-1: cluster diversity
  surpriseScore: number;          // 0-1: deviation from dominant cluster
  triggerReflexion: boolean;      // Should escalate to System 2?
  reflexionReason?: string;       // Why reflexion triggered
}
```

**Surprise Calculation**: Cross-entropy between individual samples and dominant cluster using Jaccard similarity.

### 24.6 Cost Negotiation Service

**File**: `cost-negotiation.service.ts`

Budget-aware model selection without distributed agent micro-ledgers:

| Feature | Implementation |
|---------|----------------|
| Budget Allocation | Workflow-level tracking with step spending |
| Model Bidding | Cost/quality/latency bids from qualifying models |
| Negotiation | Balance quality targets, latency, and budget |
| Quality Curves | Learn and predict quality from historical data |

**Usage**:
```typescript
// Create workflow budget
costNegotiationService.createBudgetAllocation('workflow-123', 500); // 500¢

// Negotiate model for step
const result = await costNegotiationService.negotiate({
  workflowId: 'workflow-123',
  stepId: 'step-1',
  taskDescription: 'Analyze medical document',
  requiredCapabilities: ['medical', 'analytical'],
  qualityTarget: 0.85,
});
// result.selectedModel = { modelId: 'claude-3-opus', estimatedCostCents: 45 }
```

### 24.7 CRDT Workflow Service

**File**: `crdt-workflow.service.ts`

Foundation for real-time collaborative workflow editing:

| CRDT Feature | Implementation |
|--------------|----------------|
| Vector Clocks | Causal ordering per client |
| Operations | insert_node, delete_node, move_node, insert_edge, delete_edge |
| Conflict Resolution | Last-Writer-Wins with client ID tiebreaker |
| Presence | Collaborator cursors, selections, colors |
| Offline Merge | Reconcile after network partitions |

**Usage**:
```typescript
// Add a node
const op = crdtWorkflowService.addNode('workflow-123', 'client-abc', {
  type: 'method',
  label: 'Semantic Entropy',
  position: { x: 100, y: 200 },
  config: { sampleCount: 5 },
});

// Apply remote operation
const { applied, conflicts } = crdtWorkflowService.applyRemoteOperation(
  'workflow-123', remoteOp
);

// Get collaborators
const collaborators = crdtWorkflowService.getCollaborators('workflow-123');
```

### 24.8 Mitigations Applied

| Gemini Recommendation | Our Mitigation |
|-----------------------|----------------|
| Vector semantics everywhere | ROUTING only (not conditions) - avoids latency |
| Active Inference / Free Energy | Surprise as Semantic Entropy component - reuses infrastructure |
| Agent micro-ledgers | Centralized budget allocation - avoids distributed complexity |
| Full Y.js integration | CRDT foundation only - Phase 2 for full sync |
| Expression DSL | AST-based JS subset - familiar syntax, safe execution |

### 24.9 Exports

All services exported from `lambda/shared/services/workflow/index.ts`:

```typescript
export {
  multimediaSidecarService,
  sandboxedExpressionService,
  vectorSemanticRouterService,
  enhancedUncertaintyService,
  costNegotiationService,
  crdtWorkflowService,
  // ... types
} from './workflow';
```

---

## 25. Neural Architecture v6.0.0

### 25.1 Overview

Neural Architecture v6.0.0 introduces **RADIANT Cartridges** — portable AI intelligence packages that encapsulate all learned patterns, adapters, and expertise for transfer between deployments.

### 25.2 AXIOM Scorers (Evolved from CORTEX)

> **Note**: The original CORTEX architecture (6 networks) has been superseded by **AXIOM Scorers** (8 scorers) as of v6.1.0. See [Section 26](#26-axiom-prompt-optimization-pipeline-v610) for comprehensive documentation.

Eight lightweight MLPs (~3.3M parameters total, ~13MB on disk) for intelligent routing and orchestration:

| Scorer | Input | Output | Params | Purpose |
|--------|-------|--------|--------|---------|
| **Domain** | 1536 | 800 | ~1M | Classify into 800+ domain taxonomy |
| **CLARION** | 1536 | 1 | ~400K | Score question relevance |
| **Pattern** | 3072 | 1 | ~500K | Rank prompt patterns |
| **Model** | 1536 | 106 | ~200K | Score AI models for task |
| **Topology** | 512 | 9 | ~800K | Evaluate orchestration modes |
| **Combination** | 640 | 1 | ~150K | Score multi-model combos |
| **Variant** | 1536 | 1 | ~200K | Score prompt formatting |
| **User** | 128 | 64 | ~50K | Personalization via Ghost |

**CRITICAL**: These are NOT LLMs. They make routing/scoring decisions, not generate text.

### 25.3 Training/Inference Separation

```
TRAINING (Nightly)                    INFERENCE (24/7)
┌──────────────────┐                 ┌──────────────────┐
│  PyTorch 2.x     │                 │  ONNX Runtime    │
│  ml.g5.xlarge    │  ──S3 CRR──>    │  inf2.xlarge     │
│  Single instance │                 │  Auto-scale 1-100│
│  ~$50-100/month  │                 │  ~$5-10K/month   │
└──────────────────┘                 └──────────────────┘
```

Communication is **S3-only**. No direct network calls between training and inference.

### 25.4 Ghost Vector System v3.2

Two-stage compression for user personalization:

```typescript
// Compressor: 4096 → 64 dimensions
Input(4096) → Linear(32) → GELU → Linear(64)
// Parameters: 133,216

// Expander: 64 → 4096 dimensions (backwards compatibility)
Input(64) → Linear(256) → GELU → Linear(4096)
// Parameters: 262,400

// Total: 395,616 parameters (62% smaller than 1M proposal)
```

### 25.5 Three-Tier Learning Architecture

```typescript
interface LearningWeights {
  coldStartUser: {
    global: 0.30,   // CATO Monthly
    tenant: 0.50,   // LoRA Nightly
    user: 0.20      // Ghost Vectors
  },
  warmUser: {
    global: 0.10,
    tenant: 0.20,
    user: 0.70      // Personalization dominates
  }
}
```

### 25.6 CATO Twilight Dreaming

Nightly autonomous learning at 2am UTC:

| Phase | Duration | Activities |
|-------|----------|------------|
| COLLECT | 30 min | Gather signals, apply sample weights |
| EVOLVE | 2 hours | Multi-teacher distillation (70%) |
| INVENT | 1 hour | PromptBreeder evolution (30% ENFORCED) |
| DEPLOY | 30 min | ONNX export, S3 upload, canary, rollout |

**30% Invention Minimum**: Non-negotiable. Prevents pure distillation.

### 25.7 Cartridge Structure

```
cartridge.RADz (encrypted ZIP)
├── manifest.json
├── axiom/                           # AXIOM Scorers (v6.1.0+)
│   ├── domain_scorer.onnx
│   ├── clarion_scorer.onnx
│   ├── pattern_scorer.onnx
│   ├── model_scorer.onnx
│   ├── topology_scorer.onnx
│   ├── combination_scorer.onnx
│   ├── variant_scorer.onnx
│   └── user_scorer.onnx
├── lora/
│   └── *.safetensors
├── esa/
│   └── *.json
├── curator/
│   ├── golden_rules.json
│   ├── ontology.json
│   └── safety_matrix.json
└── ghost/
    └── compression_model.onnx
```

### 25.8 Implementation Files

| Component | File |
|-----------|------|
| Cartridge Service | `lambda/shared/services/cartridge.service.ts` |
| CORTEX Service | `lambda/shared/services/cortex-network.service.ts` |
| Ghost Vector Service | `lambda/shared/services/ghost-vector.service.ts` |
| Thermal Manager | `lambda/shared/services/thermal-manager.service.ts` |
| Dreaming Pipeline | `lambda/consciousness/twilight-dreaming.ts` |
| Neural Ops Admin | `lambda/admin/neural-operations.ts` |
| Cartridge Admin | `lambda/admin/cartridge.ts` |
| PKI Service | `lambda/shared/services/cartridge-pki.service.ts` |
| PKI Admin | `lambda/admin/cartridge-pki.ts` |

### 25.9 Cartridge PKI - Cryptographic Signing & Federation (v6.1.0)

Every RADIANT Cartridge is cryptographically signed with dual signatures and can be verified across independent Radiant clusters via federated trust.

**Certificate Hierarchy**:
```
Radiant Root CA (Genesis Vault / HSM)
    │
    └── Tenant Intermediate CA (per organization)
            │
            └── Cartridge Signing Keys (author + platform)
                    │
                    └── Dual Signatures on each .RADz
```

**Signature Flow**:
1. **Export (Signing Ceremony)**:
   - Compute SHA-256 hash of cartridge contents
   - Sign with tenant's author key → `author_check`
   - Counter-sign with platform key → `platform_check`
   - Store `signature.sig` in .RADz container
   - Generate `meta.json` sidecar for web publishing

2. **Import (Verification)**:
   - Fetch `signature.sig` from cartridge
   - Recompute SHA-256 hash
   - Verify author signature against tenant CA
   - Verify platform signature against Root CA
   - Check certificate chain validity
   - Accept or reject based on verification result

**Federation Architecture**:
```
Radiant Cluster A              Radiant Cluster B
┌─────────────────┐            ┌─────────────────┐
│ Root CA A       │            │ Root CA B       │
│ fp: aaa...      │            │ fp: bbb...      │
└────────┬────────┘            └────────┬────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐            ┌─────────────────┐
│ trusted_roots:  │◄──────────►│ trusted_roots:  │
│ - Root CA B     │  Exchange  │ - Root CA A     │
└─────────────────┘            └─────────────────┘
```

**Key Algorithms**:
| Algorithm | Use Case | KMS Support |
|-----------|----------|-------------|
| Ed25519 | Primary signing (fast, compact) | Fallback to ECDSA |
| ECDSA P-256 | Platform signatures | Native KMS |
| RSA-PSS 4096 | Legacy compatibility | Native KMS |

**Database Tables**:
- `root_ca_certificates` - Radiant Root CA records
- `tenant_ca_certificates` - Tenant Intermediate CAs
- `cartridge_signing_keys` - Active signing keys
- `cartridge_signatures` - Complete signature records
- `trusted_root_cas` - Federated trust relationships
- `pki_audit_log` - Partitioned audit log
- `signature_verification_cache` - 24-hour TTL cache

**Admin API** (Base: `/api/admin/pki`):
- Root CA: initialize, export for federation
- Tenant CAs: generate, list, revoke
- Signing Keys: list, rotate
- Federation: add/remove/toggle trusted roots
- Audit: complete PKI operation history

### 25.10 Cluster Compatibility (v6.1.0)

Cartridges include compatibility metadata to ensure safe cross-cluster imports.

**Compatibility Profile**:
```typescript
interface ClusterCompatibility {
  sourceClusterId: string;           // "us-east-1-prod"
  sourceClusterName: string;         // "Radiant Commercial US-East"
  sourceClusterVersion: string;      // "6.1.0"
  minPlatformVersion: string;        // Minimum required version
  maxPlatformVersion?: string;       // Optional max version
  compatibleApps: RadiantApp[];      // Which apps can use this
  requiredFeatures?: string[];       // Features needed
  environment: 'production' | 'staging' | 'development';
  intendedTenantIds?: string[];      // Optional tenant restrictions
}

type RadiantApp = 
  | 'radiant_admin' 
  | 'thinktank_admin' 
  | 'thinktank' 
  | 'curator' 
  | 'service_layer';
```

**Validation Flow**:
1. Extract compatibility from signature block
2. Check version compatibility (min/max)
3. Check app compatibility
4. Check feature availability
5. Check environment (no dev→prod)
6. Check tenant restrictions
7. Return detailed result with incompatibilities

**Use Case**: Each Radiant cluster typically serves one system with multiple apps. Compatibility ensures cartridges are only imported into compatible clusters.

---

## 26. AXIOM Prompt Optimization Pipeline (v6.1.0)

### 26.1 Overview

AXIOM (Adaptive eXpert Intelligence Orchestration Matrix) is RADIANT's intelligent prompt optimization pipeline. It transforms raw user queries into highly optimized, model-specific prompts through a sophisticated multi-stage process involving domain detection, adaptive questioning, pattern retrieval, and neural scoring.

**Core Philosophy**: Don't just send the user's query to an AI—understand *what they actually need*, gather missing context, select the optimal model, and craft a prompt specifically optimized for that model's strengths.

### 26.2 Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AXIOM OPTIMIZATION PIPELINE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User Query                                                                  │
│      │                                                                       │
│      ▼                                                                       │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   DOMAIN     │────▶│   CLARION    │────▶│   PATTERN    │                │
│  │   SCORER     │     │   SCORER     │     │   SCORER     │                │
│  │ (800 domains)│     │ (questions)  │     │ (templates)  │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│         │                    │                    │                         │
│         └────────────────────┴────────────────────┘                         │
│                              │                                               │
│                              ▼                                               │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │  TOPOLOGY    │────▶│   MODEL      │────▶│  COMBINATION │                │
│  │   SCORER     │     │   SCORER     │     │   SCORER     │                │
│  │ (9 modes)    │     │ (106 models) │     │ (ensembles)  │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│         │                    │                    │                         │
│         └────────────────────┴────────────────────┘                         │
│                              │                                               │
│                              ▼                                               │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   VARIANT    │────▶│    USER      │────▶│   COMPILE    │                │
│  │   SCORER     │     │   SCORER     │     │   & EXECUTE  │                │
│  │ (prompt fmt) │     │ (Ghost Vec)  │     │              │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│                                                    │                         │
│                                                    ▼                         │
│                                              Optimized Response              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 26.3 The 8 AXIOM Scorers

AXIOM uses 8 lightweight MLPs (~50K-1M parameters each) for intelligent scoring. These are NOT large language models—they're small neural networks that make fast routing/ranking decisions.

| # | Scorer | Input Dim | Output Dim | Parameters | Purpose |
|---|--------|-----------|------------|------------|---------|
| 1 | **Domain Scorer** | 1536 | 800 | ~1M | Classifies query into 800+ domain taxonomy |
| 2 | **CLARION Scorer** | 1536 | 1 | ~400K | Scores question relevance for adaptive questioning |
| 3 | **Pattern Scorer** | 3072 | 1 | ~500K | Ranks prompt patterns from template library |
| 4 | **Model Scorer** | 1536 | 106 | ~200K | Scores AI models for task suitability |
| 5 | **Topology Scorer** | 512 | 9 | ~800K | Evaluates orchestration strategies |
| 6 | **Combination Scorer** | 640 | 1 | ~150K | Scores multi-model combinations for ensemble |
| 7 | **Variant Scorer** | 1536 | 1 | ~200K | Scores prompt formatting variants per model |
| 8 | **User Scorer** | 128 | 64 | ~50K | Personalizes via Ghost Vector integration |

**Total**: ~3.3M parameters (~13MB on disk)

#### Scorer Architecture (Common Pattern)

All scorers follow this architecture:

```python
Input(input_dim)
    → Linear(hidden_1) → LayerNorm → GELU → Dropout(0.1)
    → Linear(hidden_2) → LayerNorm → GELU → Dropout(0.1)
    → [Linear(hidden_3) → LayerNorm → GELU → Dropout(0.1)]  # optional
    → Linear(output_dim)
    → [Softmax | Sigmoid | Raw]  # activation depends on scorer
```

### 26.4 Scorer Details

#### 26.4.1 Domain Scorer

**Purpose**: Classify user queries into a hierarchical 800+ domain taxonomy.

**Input**: 1536-dim query embedding (text-embedding-3-large)

**Output**: 800 softmax probabilities (top-k domains selected)

**Domain Hierarchy** (3 levels):
```
Field (18)
└── Domain (~150)
    └── Subspecialty (~800)

Example:
├── Medicine (Field)
│   ├── Cardiology (Domain)
│   │   ├── Interventional Cardiology (Subspecialty)
│   │   ├── Electrophysiology (Subspecialty)
│   │   └── Heart Failure (Subspecialty)
│   └── Oncology (Domain)
│       ├── Medical Oncology
│       ├── Radiation Oncology
│       └── Surgical Oncology
```

**Fallback**: pgvector cosine similarity against `domain_taxonomy_embeddings` centroids.

**Implementation**: `axiom-neural-cortex.service.ts` → `classifyDomain()`

#### 26.4.2 CLARION Scorer

**Purpose**: Score questions by expected information gain for the current session context.

**Input**: 
- Session context encoding (1408-dim): domain, answered questions, confidence trajectory
- Question features (128-dim): information gain, priority, skip rate, dependencies

**Output**: Relevance score (0-1) via sigmoid

**Scoring Formula** (fallback heuristic):
```typescript
score = (informationGain * 0.4) + (priority * 0.35) + (skipRateInverse * 0.25)
```

**Integration**: Used by CLARION to rank which question to ask next.

**Implementation**: `axiom-neural-cortex.service.ts` → `scoreClarionQuestions()`

#### 26.4.3 Pattern Scorer

**Purpose**: Rank prompt patterns from the template library for the current query.

**Input**: Concatenated embeddings (3072-dim)
- Query embedding (1536-dim)
- Pattern embedding (1536-dim)

**Output**: Relevance score (0-1) via sigmoid

**Fallback**: Cosine similarity between query and pattern embeddings.

**Pattern Library**: 500+ optimized prompt templates categorized by:
- Domain (medical, legal, technical, creative)
- Task type (analysis, generation, classification, extraction)
- Output format (structured, narrative, list, table)

**Implementation**: `axiom-neural-cortex.service.ts` → `scorePatterns()`

#### 26.4.4 Model Scorer

**Purpose**: Score all 106 AI models for task suitability.

**Input**: Task features (1536-dim encoding of query + context + requirements)

**Output**: 106 scores (one per model)

**Model Capability Matrix**:
```typescript
interface ModelCapabilities {
  reasoning: number;      // 0-1: logical reasoning ability
  creativity: number;     // 0-1: creative generation
  coding: number;         // 0-1: code generation
  factualAccuracy: number; // 0-1: factual correctness
  instructionFollowing: number; // 0-1: follows complex instructions
  multimodal: number;     // 0-1: handles images/audio
  speed: number;          // 0-1: inference speed
}
```

**Fallback**: Weighted sum of task requirements × model capabilities from `ai_models` table.

**Implementation**: `axiom-neural-cortex.service.ts` → `scoreModels()`

#### 26.4.5 Topology Scorer

**Purpose**: Select the optimal orchestration strategy from 9 modes.

**Input**: Task features (512-dim encoding of complexity, domain, requirements)

**Output**: 9 mode scores (one per orchestration mode)

**9 Orchestration Modes**:

| Mode | Description | When Used |
|------|-------------|-----------|
| `thinking` | Standard single-model reasoning | Simple queries |
| `extended_thinking` | Deep multi-step reasoning | Complex analysis |
| `coding` | Code generation with execution | Programming tasks |
| `creative` | Creative writing with iteration | Content creation |
| `research` | Multi-source research synthesis | Research queries |
| `analysis` | Quantitative/data analysis | Data-heavy tasks |
| `multi_model` | Multiple models for consensus | High-stakes decisions |
| `chain_of_thought` | Explicit reasoning chain | Logical problems |
| `self_consistency` | Multiple samples for consistency | Uncertain domains |

**Implementation**: `axiom-neural-cortex.service.ts` → `scoreTopologies()`

#### 26.4.6 Combination Scorer

**Purpose**: Score multi-model combinations for ensemble tasks.

**Input**: 
- Task features (256-dim)
- Model pair features (384-dim: 192-dim × 2 models)

**Output**: Combination quality score (0-1) + synergy score

**Synergy Calculation**: Models from different providers tend to have higher synergy (diverse perspectives).

**Implementation**: `axiom-neural-cortex.service.ts` → `scoreCombinations()`

#### 26.4.7 Variant Scorer

**Purpose**: Score prompt formatting variants optimized for specific models.

**Input**: Prompt embedding (1536-dim) + target model ID

**Output**: Variant quality score (0-1) per variant

**Variant Types**:
- **XML format**: Preferred by Claude models
- **Markdown format**: Preferred by GPT models
- **Structured JSON**: Preferred by Gemini models
- **Plain text**: Universal fallback

**Implementation**: `axiom-neural-cortex.service.ts` → `scoreVariants()`

#### 26.4.8 User Scorer

**Purpose**: Personalize all scores based on the user's Ghost Vector.

**Input**: Ghost Vector (128-dim compressed from 4096-dim full vector)

**Output**: 64 personalization adjustment factors

**Application**: Multiplied against base scores to bias toward user preferences.

**Implementation**: `axiom-neural-cortex.service.ts` → `applyUserPersonalization()`

### 26.5 Thermal State Management

Scorers have thermal states that control inference behavior:

| State | Behavior | Cost | Latency |
|-------|----------|------|---------|
| **Cold** | Heuristic fallbacks only | $0 | <5ms |
| **Warm** | SageMaker endpoint ready | ~$0.001/inference | ~20ms |
| **Hot** | Multiple endpoint replicas | ~$0.0005/inference | ~10ms |

**Auto-Scaling Rules**:
```typescript
// Auto-warm after sustained usage
if (requestsInLastHour > 10 && thermalState === 'cold') {
  await warmUpScorer(scorerId);
}

// Auto-cool after idle period
if (minutesSinceLastRequest > 30 && thermalState !== 'cold') {
  await coolDownScorer(scorerId);
}

// Scale to hot under load
if (requestsPerMinute > 10 && thermalState === 'warm') {
  await scaleToHot(scorerId);
}
```

**Zero-Cost Development**: In development, all scorers run cold (heuristic fallbacks), enabling full pipeline testing without GPU costs.

### 26.6 AXIOM Session Lifecycle

```typescript
interface AxiomSession {
  sessionId: string;
  tenantId: string;
  userId: string;
  status: 'initializing' | 'questioning' | 'compiling' | 'executing' | 'complete' | 'error';
  
  // Domain detection
  detectedDomain: {
    field: string;
    domain: string;
    subspecialty: string;
    confidence: number;
  };
  
  // CLARION state
  clarionSession: ClarionSession;
  
  // Model selection
  selectedModel: {
    modelId: string;
    score: number;
    reason: string;
  };
  
  // Orchestration
  topology: {
    mode: OrchestrationMode;
    confidence: number;
  };
  
  // Compilation
  compiledPrompt: {
    systemPrompt: string;
    userPrompt: string;
    parameters: ModelParameters;
  };
  
  // Timing
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

### 26.7 Training Integration (CATO)

Scorers are trained by CATO during nightly "dreaming" cycles:

**Data Collection**:
1. Every inference logged to `axiom_network_inference_log`
2. User feedback updates `feedback_score` column
3. A/B test results provide ground truth labels

**Training Pipeline**:
```
4 AM Local Time
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   COLLECT    │───▶│    TRAIN     │───▶│   DEPLOY     │
│   Signals    │    │   PyTorch    │    │   ONNX       │
│   from logs  │    │   on g5.xl   │    │   to inf2    │
└──────────────┘    └──────────────┘    └──────────────┘
```

**Training Safeguards**:
- Minimum 1000 samples before training
- Validation accuracy must exceed current model
- Canary deployment with automatic rollback
- A/B testing against production weights

### 26.8 Implementation Files

| Component | File Path |
|-----------|-----------|
| AXIOM Service | `lambda/shared/services/axiom.service.ts` |
| Scorer Inference | `lambda/shared/services/axiom-neural-cortex.service.ts` |
| AXIOM Events | `lambda/shared/services/axiom-events.service.ts` |
| AXIOM Handler | `lambda/axiom-clarion/handler.ts` |
| Type Definitions | `packages/shared/src/types/axiom-clarion.types.ts` |

### 26.9 Database Tables

```sql
-- AXIOM Session Tables
axiom_sessions              -- Active optimization sessions
axiom_session_history       -- Completed sessions for analytics

-- Scorer Infrastructure
axiom_network_status        -- Scorer thermal state and metrics
axiom_network_inference_log -- Inference log for training
axiom_network_training_batches -- CATO training tracking

-- Domain Taxonomy
domain_taxonomy             -- 800+ domain hierarchy
domain_taxonomy_embeddings  -- Centroid embeddings for fallback

-- Pattern Library
axiom_prompt_patterns       -- 500+ optimized prompt templates
axiom_pattern_embeddings    -- Pattern embeddings for retrieval
```

### 26.10 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/axiom/session` | POST | Start new AXIOM session |
| `/api/v2/axiom/session/:id` | GET | Get session state |
| `/api/v2/axiom/session/:id/answer` | POST | Submit CLARION answer |
| `/api/v2/axiom/session/:id/skip` | POST | Skip CLARION question |
| `/api/v2/axiom/session/:id/compile` | POST | Compile optimized prompt |
| `/api/v2/axiom/session/:id/execute` | POST | Execute with selected model |
| `/api/v2/axiom/stream` | GET | SSE stream for real-time updates |

**Admin Endpoints**:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/axiom-scorers/status` | GET | All scorer statuses |
| `/api/admin/axiom-scorers/:id` | GET | Single scorer details |
| `/api/admin/axiom-scorers/:id/warm` | POST | Warm up a scorer |
| `/api/admin/axiom-scorers/:id/cool` | POST | Cool down a scorer |
| `/api/admin/axiom-scorers/metrics` | GET | Inference metrics |

---

## 27. CLARION Adaptive Questioning System (v6.1.0)

### 27.1 Overview

CLARION (Contextual Learning and Adaptive Response Intelligence Optimization Network) is AXIOM's adaptive questioning system. Instead of immediately processing a query, CLARION asks strategically-selected clarifying questions to gather context that dramatically improves response quality.

**Core Insight**: A 30-second Q&A session can provide context that would take an AI 10 paragraphs to infer incorrectly.

### 27.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLARION QUESTIONING SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User Query: "Help me write a report"                                        │
│      │                                                                       │
│      ▼                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     QUESTION SELECTION ENGINE                           │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                         │ │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌────────────┐ │ │
│  │  │ Information │   │  CLARION    │   │   User      │   │  Branching │ │ │
│  │  │    Gain     │ + │   Scorer    │ + │   Scorer    │ + │   Logic    │ │ │
│  │  │  (entropy)  │   │  (neural)   │   │  (Ghost)    │   │  (rules)   │ │ │
│  │  └─────────────┘   └─────────────┘   └─────────────┘   └────────────┘ │ │
│  │         │                │                 │                 │         │ │
│  │         └────────────────┴─────────────────┴─────────────────┘         │ │
│  │                                  │                                      │ │
│  │                                  ▼                                      │ │
│  │                    Combined Score per Question                          │ │
│  │                                  │                                      │ │
│  │                                  ▼                                      │ │
│  │                      Select Top Question                                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                        │
│                                     ▼                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Q1: "What type of report is this?"                                     │ │
│  │      [ ] Technical   [ ] Business   [ ] Academic   [ ] Creative         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                        │
│                                     ▼ (user answers)                         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Answer: "Technical"                                                    │ │
│  │  → Branch: Skip marketing questions                                     │ │
│  │  → Signal: +0.3 to Claude Opus (technical writing)                      │ │
│  │  → Context: Add "technical_report" to session                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                        │
│                                     ▼                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Confidence: 0.45 → 0.62 (+0.17)                                        │ │
│  │  Questions remaining: 3                                                  │ │
│  │  Ready to compile: No (confidence < 0.75)                               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                        │
│                                     ▼                                        │
│                           (continue questioning)                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 27.3 Question Types

| Type | Input Format | Use Case |
|------|--------------|----------|
| **single_choice** | Radio buttons | Mutually exclusive options |
| **multiple_choice** | Checkboxes | Multiple selections allowed |
| **scale** | Slider 1-10 | Degree/intensity |
| **text** | Text input | Open-ended context |
| **boolean** | Yes/No buttons | Binary decisions |
| **confirmation** | Confirm/Edit | Verify inferred context |

### 27.4 Question Scoring Algorithm

```typescript
function scoreQuestion(question: ClarionQuestion, session: ClarionSession): number {
  // 1. Base information gain (entropy reduction)
  const informationGain = question.informationGain; // Pre-computed per question
  
  // 2. Neural score from CLARION Scorer
  const neuralScore = await axiomNeuralCortexService.scoreClarionQuestions(
    buildSessionContext(session),
    [{ questionId: question.id, features: buildQuestionFeatures(question) }]
  );
  
  // 3. User personalization from Ghost Vector
  const userScore = await axiomNeuralCortexService.applyUserPersonalization(
    [neuralScore.scores[0].score],
    session.ghostVector
  );
  
  // 4. Apply weights
  const weights = QUESTION_SCORE_WEIGHTS;
  return (
    informationGain * weights.informationGain +      // 0.35
    neuralScore.scores[0].score * weights.neural +   // 0.30
    userScore.scores[0] * weights.personalization +  // 0.20
    priorityBonus(question) * weights.priority       // 0.15
  );
}
```

### 27.5 Branching Logic

Questions can trigger branches based on answers:

```typescript
interface QuestionBranch {
  condition: string;           // Answer value that triggers branch
  skipQuestions: string[];     // Question IDs to skip
  addQuestions: string[];      // Question IDs to add to queue
  modelSignals: ModelSignal[]; // Adjust model scores
  contextUpdates: Record<string, unknown>; // Add to working context
}

// Example: Technical report branch
{
  condition: 'technical',
  skipQuestions: ['marketing_tone', 'creative_style', 'audience_emotion'],
  addQuestions: ['technical_depth', 'code_examples', 'diagram_needs'],
  modelSignals: [
    { modelId: 'claude-3-opus', adjustment: 0.3, reason: 'Technical writing strength' },
    { modelId: 'gpt-4', adjustment: 0.2, reason: 'Structured output' }
  ],
  contextUpdates: {
    reportType: 'technical',
    formalityLevel: 'high',
    includeCodeBlocks: true
  }
}
```

### 27.6 Confidence Tracking

CLARION tracks confidence that enough context has been gathered:

```typescript
interface ConfidenceState {
  currentConfidence: number;           // 0-1: current readiness
  confidenceThreshold: number;         // Target (default 0.75)
  confidenceTrajectory: number[];      // History for visualization
  maxQuestions: number;                // Hard limit (default 8)
  askedQuestions: number;              // Questions asked so far
}

// Confidence update per answer
function updateConfidence(session: ClarionSession, question: ClarionQuestion): void {
  const baseGain = question.informationGain;
  const answerQuality = assessAnswerQuality(session.lastAnswer);
  const confidenceGain = baseGain * answerQuality * 0.5;
  
  session.currentConfidence = Math.min(1.0, session.currentConfidence + confidenceGain);
  session.confidenceTrajectory.push(session.currentConfidence);
}
```

**Ready to Compile** when:
- `currentConfidence >= confidenceThreshold` (default 0.75), OR
- `askedQuestions >= maxQuestions` (default 8), OR
- User explicitly requests compilation

### 27.7 Working Context

CLARION accumulates a working context that feeds into prompt compilation:

```typescript
interface ClarionWorkingContext {
  // Accumulated from answers
  reportType?: string;
  audience?: string;
  formalityLevel?: 'casual' | 'professional' | 'academic';
  lengthPreference?: 'brief' | 'detailed' | 'comprehensive';
  outputFormat?: 'prose' | 'bullets' | 'structured';
  
  // Inferred from branching
  skipTopics: string[];
  emphasizeTopics: string[];
  
  // Model signals
  modelAdjustments: Map<string, number>;
  
  // Confidence tracking
  confidenceTrajectory: number[];
  
  // Raw answers for reference
  rawAnswers: Record<string, unknown>;
}
```

### 27.8 Session State Machine

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  CREATED    │────▶│ QUESTIONING │────▶│   READY     │
│             │     │             │     │  TO_COMPILE │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                    │
      │                   ▼                    ▼
      │            ┌─────────────┐     ┌─────────────┐
      │            │  SKIPPED    │     │  COMPILED   │
      │            │  (by user)  │     │             │
      │            └─────────────┘     └─────────────┘
      │                                       │
      └───────────────────────────────────────┼───▶ ┌─────────────┐
                                              │     │   ERROR     │
                                              │     └─────────────┘
                                              ▼
                                       ┌─────────────┐
                                       │  COMPLETE   │
                                       └─────────────┘
```

### 27.9 Implementation Files

| Component | File Path |
|-----------|-----------|
| CLARION Service | `lambda/shared/services/clarion.service.ts` |
| Question Bank | `lambda/shared/data/clarion-questions.ts` |
| Branching Logic | `lambda/shared/services/clarion-branching.service.ts` |
| Type Definitions | `packages/shared/src/types/axiom-clarion.types.ts` |

### 27.10 Database Tables

```sql
-- Question Management
clarion_questions           -- Question definitions
clarion_question_branches   -- Branching rules
clarion_question_analytics  -- Usage and effectiveness metrics

-- Session Tracking
clarion_sessions            -- Active sessions
clarion_session_answers     -- Answer history
clarion_session_context     -- Working context snapshots
```

### 27.11 Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `confidenceThreshold` | number | 0.75 | Target confidence to stop questioning |
| `maxQuestions` | number | 8 | Maximum questions before forced compile |
| `minQuestions` | number | 2 | Minimum questions to ask |
| `questionTimeout` | number | 60000 | Milliseconds before auto-skip |
| `enableBranching` | boolean | true | Enable branching logic |
| `enableNeuralScoring` | boolean | true | Use CLARION Scorer (vs heuristic) |

---

## 28. UEP Real-Time Event Streaming (v6.1.0)

### 28.1 Overview

The Universal Envelope Protocol (UEP) provides real-time event streaming for AXIOM/CLARION sessions via Server-Sent Events (SSE). Clients receive live updates as the optimization pipeline progresses.

### 28.2 UEP Envelope Structure

```typescript
interface UEPEnvelope<T = unknown> {
  // Header
  envelopeId: string;        // UUID for this envelope
  version: '2.0';            // UEP version
  timestamp: string;         // ISO 8601 timestamp
  
  // Routing
  source: string;            // 'axiom' | 'clarion' | 'pipeline'
  destination: string;       // 'client' | 'service' | 'broadcast'
  
  // Payload
  eventType: AxiomEventType;
  payload: T;
  
  // Metadata
  correlationId: string;     // Links related events
  sessionId?: string;        // AXIOM session ID
  tenantId: string;
  userId: string;
  
  // Tracing
  traceId?: string;          // Distributed tracing
  spanId?: string;
}
```

### 28.3 AXIOM Event Types

| Event Type | Payload | When Emitted |
|------------|---------|--------------|
| `connected` | `{ sessionId }` | SSE connection established |
| `session_started` | `{ session }` | AXIOM session created |
| `domain_detected` | `{ field, domain, subspecialty, confidence }` | Initial domain classification |
| `domain_refined` | `{ field, domain, subspecialty, confidence }` | Domain updated after answers |
| `question_selected` | `{ question, questionNumber, totalExpected }` | Next CLARION question |
| `answer_received` | `{ questionId, value }` | User answered a question |
| `model_scores_update` | `{ scores: ModelScore[] }` | Model rankings updated |
| `confidence_update` | `{ confidence, trajectory }` | Confidence level changed |
| `clarification_complete` | `{ finalConfidence }` | CLARION questioning done |
| `compilation_started` | `{ }` | Prompt compilation begun |
| `compilation_complete` | `{ compiledPrompt }` | Optimized prompt ready |
| `session_error` | `{ error, code }` | Error occurred |
| `heartbeat` | `{ timestamp }` | Keep-alive (every 30s) |

### 28.4 SSE Stream Implementation

**Endpoint**: `GET /api/v2/axiom/stream?sessionId=:id`

**Response Headers**:
```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

**Event Format**:
```
id: <envelopeId>
event: <eventType>
data: <JSON payload>

```

**Example Stream**:
```
id: evt_abc123
event: session_started
data: {"sessionId":"sess_xyz","status":"questioning"}

id: evt_abc124
event: domain_detected
data: {"field":"Technology","domain":"Software Engineering","subspecialty":"API Design","confidence":0.87}

id: evt_abc125
event: question_selected
data: {"question":{"id":"q_123","text":"What programming language?","type":"single_choice","options":["Python","JavaScript","Go","Rust"]},"questionNumber":1,"totalExpected":5}

id: evt_abc126
event: heartbeat
data: {"timestamp":"2026-02-01T13:45:30.000Z"}
```

### 28.5 Client Integration

**React Hook** (`useAxiomSession.ts`):

```typescript
function useAxiomSession(initialQuery: string) {
  const [session, setSession] = useState<AxiomSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<ClarionQuestion | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!session?.sessionId) return;

    // Connect to SSE stream
    const eventSource = new EventSource(
      `/api/v2/axiom/stream?sessionId=${session.sessionId}`
    );
    eventSourceRef.current = eventSource;

    // Handle events
    eventSource.addEventListener('question_selected', (e) => {
      const data = JSON.parse(e.data);
      setCurrentQuestion(data.question);
    });

    eventSource.addEventListener('confidence_update', (e) => {
      const data = JSON.parse(e.data);
      setSession(prev => prev ? {
        ...prev,
        currentConfidence: data.confidence,
        confidenceTrajectory: data.trajectory
      } : null);
    });

    eventSource.addEventListener('compilation_complete', (e) => {
      const data = JSON.parse(e.data);
      setSession(prev => prev ? {
        ...prev,
        status: 'compiled',
        compiledPrompt: data.compiledPrompt
      } : null);
    });

    return () => eventSource.close();
  }, [session?.sessionId]);

  // ... rest of hook
}
```

### 28.6 Event History

Events are stored in memory for late-joining clients:

```typescript
class AxiomEventsService {
  private eventHistory: Map<string, UEPEnvelope[]> = new Map();
  private maxHistoryPerSession = 100;

  // Store event
  emitEvent(sessionId: string, event: UEPEnvelope): void {
    const history = this.eventHistory.get(sessionId) || [];
    history.push(event);
    if (history.length > this.maxHistoryPerSession) {
      history.shift(); // Remove oldest
    }
    this.eventHistory.set(sessionId, history);
    this.notifySubscribers(sessionId, event);
  }

  // Get history for late-joining client
  getEventHistory(sessionId: string, since?: string): UEPEnvelope[] {
    const history = this.eventHistory.get(sessionId) || [];
    if (since) {
      const sinceIndex = history.findIndex(e => e.envelopeId === since);
      return sinceIndex >= 0 ? history.slice(sinceIndex + 1) : history;
    }
    return history;
  }
}
```

### 28.7 Implementation Files

| Component | File Path |
|-----------|-----------|
| Events Service | `lambda/shared/services/axiom-events.service.ts` |
| SSE Handler | `lambda/axiom-clarion/handler.ts` → `/stream` endpoint |
| React Hook | `apps/thinktank/lib/hooks/useAxiomSession.ts` |
| Event Types | `apps/thinktank/lib/axiom/types.ts` |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 6.1.0 | 2026-02-01 | AXIOM Prompt Optimization Pipeline (8 Scorers), CLARION Adaptive Questioning System, UEP Real-Time Event Streaming for AXIOM/CLARION sessions |
| 6.0.0 | 2026-01-31 | Neural Architecture v6.0.0: CORTEX Networks, Ghost Vector v3.2, Three-Tier Learning, CATO Twilight Dreaming, Cartridge System |
| 5.53.0 | 2026-01-31 | Universal Envelope Protocol v2.0, Gemini Workflow Enhancements |
| 5.52.57 | 2026-01-29 | Model Registry & Version Discovery System |
| 5.52.54 | 2026-01-28 | Cato Pipeline Orchestration System |
| 5.52.29 | 2026-01-25 | Internationalization & Multi-Language Search |
| 5.52.28 | 2026-01-25 | Two-Factor Authentication (MFA) |
| 5.52.26 | 2026-01-25 | OAuth 2.0 Provider & Developer Portal |
| 5.52.6 | 2026-01-24 | Complete Admin API Architecture |
| 5.52.5 | 2026-01-24 | Services Layer & Interface-Based Access Control |
| 5.52.4 | 2026-01-24 | Semantic Blackboard Architecture |
| 5.52.2 | 2026-01-23 | Apple Glass UI Design System |
| 5.46.0 | 2026-01-23 | Cortex Memory System v4.20.0 |
