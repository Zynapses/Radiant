# RADIANT Engineering Implementation & Vision

**Version**: 5.44.0  
**Last Updated**: 2026-01-22  
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
```

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

### 3.2 Migration Strategy

- Sequential numbered migrations: `001_`, `002_`, etc.
- Location: `packages/infrastructure/migrations/`
- Current count: 185 migrations

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

### 4.2 Orchestration Modes (9)

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
- `RechartsAreaChart` - Volume visualization

**Auto-formatting**: Tooltips display K/M suffixes for large numbers.

### 9.5 Smart Insights Engine

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

See `/.windsurf/workflows/documentation-consolidation.md` for the enforcement policy.
