# RADIANT Engineering Implementation & Vision

**Version**: 5.33.0  
**Last Updated**: 2026-01-20  
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

See `/.windsurf/workflows/documentation-consolidation.md` for the enforcement policy.
