# RADIANT Platform Documentation
## Complete System Architecture Reference
### Version 5.52.60 | February 2026

---

# EXECUTIVE SUMMARY

**RADIANT** (Rapid AI Deployment Infrastructure for Applications with Native Tenancy) is a comprehensive multi-tenant AWS SaaS platform providing AI model orchestration and infrastructure services. The platform serves as white-label infrastructure operating invisibly behind customer-facing applications.

**Version 5.0 (The Sovereign Mesh)** introduces:
- **Agent Registry** - Long-running AI agents with OODA loops
- **App Registry** - 3,000+ apps auto-synced from Activepieces/n8n
- **Parametric AI Helper** - AI assistance configurable per node
- **Pre-Flight Provisioning** - Check requirements before execution
- **Transparency Layer** - Full visibility into Cato's decisions
- **Enhanced HITL** - First-class approval workflows

**THE OMEGA PROTOCOL** (Synthetic Biological Intelligence):
- 🟣 **Q-Nodes** - Complex-valued neurons using wave mechanics instead of scalar weights
- 🟣 **Bicameral Mind** - Two-chambered architecture (OMEGA Cortex + Broca Interface)
- 🟣 **Helix Kernel** - Deterministic safety via destructive interference (impossible to bypass)
- 🟣 **Resonant Index** - O(1) frequency-based document lookup (infinite scaling)
- 🟣 **Cryogenic Engine** - Serverless persistence with Time Warp ($0 idle cost)
- 🟣 **Genesis Ecosystem** - .bio firmware, Genesis Lab, Genesis Forge
- 🔴 **Neural Bridge** - NeuralTransducer projects Complex^2048 → [8, 4096] soft prompt tokens for direct vLLM injection (Shadow Mode)
- 🔴 **Homeostatic Dreaming** - 3-stage selective dreaming: magnitude gate + phase sharpening + experience replay
- 🔴 **The Watcher** - Self-awareness via prediction error; surprise → dopamine loop
- 🔴 **Custom vLLM Server** - FastAPI wrapper with `/inject` endpoint for embedding-level conditioning
- 🔥 **Genesis Forge v3.0 "The Glass Foundry"** - Full neural firmware orchestration suite with React Flow canvas, catenary wire physics, Shadow Omega WebSocket tether, Omega Instance Registry, Reactor Core forge button, Void Mode
- 🔥 **Omega Instance Registry** - Every OMEGA instance has unique ID/Name/endpoint; addressable by Forge via `omega_instance_registry` table
- 🔥 **Shadow Omega Wiring** - Bi-directional WebSocket (`useShadowOmega()` hook) for real-time telemetry, edge rejection, stability-driven UI hue shift

> **Reference**: [PROJECT-GENESIS-OMEGA.md](PROJECT-GENESIS-OMEGA.md) for complete OMEGA Protocol specification

---

# PART 1: EXISTING ARCHITECTURE (PROMPTS 01-35)

## 1.1 Infrastructure Foundation (PROMPT-01 through PROMPT-03)

### AWS CDK Infrastructure

| Component | Description | Status |
|-----------|-------------|--------|
| VPC Stack | Multi-AZ VPC with public/private subnets | ✅ Implemented |
| Database Stack | Aurora PostgreSQL with pgvector | ✅ Implemented |
| **Database Scaling Stack** | RDS Proxy, Async Writes, Redis Cache | ✅ Implemented (v5.52.20) |
| Cache Stack | ElastiCache Redis cluster | ✅ Implemented |
| Auth Stack | Cognito user pools | ✅ Implemented |
| API Stack | API Gateway + Lambda | ✅ Implemented |
| Storage Stack | S3 buckets for uploads/artifacts | ✅ Implemented |
| Monitoring Stack | CloudWatch dashboards + alarms | ✅ Implemented |

### PostgreSQL Scaling Infrastructure (v5.52.20)

Enterprise-grade scaling for parallel AI model execution supporting 100+ concurrent requests with 6 parallel model writes each.

| Component | Purpose | Tier Availability |
|-----------|---------|-------------------|
| **RDS Proxy** | Connection pooling, Lambda cold-start optimization | 2+ |
| **Async Write Queue** | SQS-based batch writes for model results | 2+ |
| **Redis Hot-Path Cache** | Read-after-write consistency, rate limiting | 2+ |
| **Time-Based Partitioning** | Monthly partitions for logs/usage tables | All |
| **Materialized Views** | Pre-computed dashboard metrics | All |
| **Optimized RLS** | Index-friendly tenant isolation policies | All |

**CDK Constructs**:
- `DatabaseScalingConstruct` - RDS Proxy with tier-based connection limits
- `AsyncWriteConstruct` - SQS queue + batch writer Lambda
- `RedisCacheConstruct` - ElastiCache cluster with cluster mode

### Database Schema (Migrations 001-070)

| Table | Purpose | Migration |
|-------|---------|-----------|
| `tenants` | Multi-tenant isolation | 001 |
| `users` | User accounts | 002 |
| `api_keys` | API authentication | 003 |
| `sessions` | Chat sessions | 004 |
| `messages` | Chat messages | 005 |
| `ai_providers` | 20+ AI providers | 007 |
| `ai_models` | 106 AI models | 007 |
| `usage_records` | Billing/usage | 010 |
| `audit_logs` | Compliance audit | 015 |
| `mfa_backup_codes` | MFA one-time recovery codes | 070 |
| `mfa_trusted_devices` | 30-day device trust tokens | 070 |
| `mfa_audit_log` | MFA event audit log (partitioned) | 070 |
| `*.detected_language` | Auto-detected content language | 071 |
| `*.search_vector_simple` | Fallback tsvector for FTS | 071 |
| `*.search_vector_english` | Language-specific tsvector | 071 |
| `model_versions` | Self-hosted model version tracking | 039 |
| `model_family_watchlist` | HuggingFace discovery configuration | 039 |
| `model_discovery_jobs` | Discovery job history | 039 |
| `model_deletion_queue` | Soft delete queue with usage tracking | 039 |
| `model_usage_sessions` | Active session tracking for safe deletion | 039 |

### Multi-Language Search (Migration 071)

| Feature | Implementation |
|---------|----------------|
| **pg_bigm Extension** | Bi-gram indexing for CJK languages |
| **Language Detection** | `detect_text_language()` function |
| **Unified Search** | `search_content()` routes to FTS or bigm |
| **18 Languages** | en, es, fr, de, pt, it, nl, pl, ru, tr, ja, ko, zh-CN, zh-TW, ar, hi, th, vi |

### Swift Deployment Application

| Feature | Description |
|---------|-------------|
| One-Click Deploy | Complete infrastructure in single click |
| Account Management | AWS account configuration |
| Environment Selection | Dev/Staging/Prod |
| Progress Monitoring | Real-time deployment status |
| Rollback Support | Automatic rollback on failure |

---

## 1.2 Lambda Functions (PROMPT-04 & PROMPT-05)

### Core Lambda Functions

| Function | Purpose | Trigger |
|----------|---------|---------|
| `auth-handler` | Authentication/authorization | API Gateway |
| `mfa-handler` | MFA enrollment, verification, device trust | API Gateway |
| `chat-handler` | Chat completion requests | API Gateway |
| `stream-handler` | SSE streaming responses | API Gateway |
| `models-handler` | Model CRUD operations | API Gateway |
| `providers-handler` | Provider management | API Gateway |
| `sessions-handler` | Session management | API Gateway |
| `usage-handler` | Usage reporting | API Gateway |

### Admin Lambda Functions (62 Total - v5.52.6)

All admin Lambda handlers are wired to `/api/admin/*` routes with Cognito admin authorization.

| Category | Count | Handlers |
|----------|-------|----------|
| **Cato Safety** | 5 | cato, cato-genesis, cato-global, cato-governance, cato-pipeline |
| **Security** | 6 | security, security-schedules, api-keys, ethics, self-audit, mfa |
| **Memory Systems** | 4 | cortex, cortex-v2, blackboard, empiricism-loop |
| **AI/ML** | 7 | brain, cognition, ego, raws, inference-components, formal-reasoning, ethics-free-reasoning |
| **Operations** | 5 | gateway, sovereign-mesh, sovereign-mesh-performance, sovereign-mesh-scaling, hitl-orchestration |
| **Reporting** | 4 | reports, ai-reports, dynamic-reports, metrics |
| **Configuration** | 7 | tenants, invitations, library-registry, checklist-registry, collaboration-settings, system, system-config |
| **Infrastructure** | 6 | aws-costs, aws-monitoring, s3-storage, code-quality, infrastructure-tier, logs |
| **Compliance** | 4 | regulatory-standards, council, user-violations, approvals |
| **Models** | 5 | models, lora-adapters, pricing, specialty-rankings, sync-providers |
| **Orchestration** | 2 | orchestration-methods, orchestration-user-templates |
| **Users** | 2 | user-registry, white-label |
| **Time & Translation** | 3 | time-machine, translation, internet-learning |
| **Learning** | 1 | agi-learning |

**Implementation**: `packages/infrastructure/lib/stacks/api-stack.ts`

### Scheduled Lambda Functions

| Function | Schedule | Purpose |
|----------|----------|---------|
| `billing-aggregator` | Hourly | Aggregate usage for billing |
| `thermal-manager` | Every 5 min | Manage model thermal states |
| `health-checker` | Every minute | Provider health checks |
| `usage-rollup` | Daily | Daily usage summaries |
| `app-registry-sync` | Daily 2 AM | Sync apps from Activepieces/n8n |
| `app-health-check` | Hourly | Check health of top 100 apps |
| `hitl-sla-monitor` | Every minute | Monitor HITL approval SLAs |

### SQS-Triggered Worker Lambdas

| Function | Queue | Purpose |
|----------|-------|---------|
| `agent-execution-worker` | agent-execution | Async OODA loop processing |
| `transparency-compiler` | transparency | Pre-compute decision explanations |

---

## 1.2.1 Two-Factor Authentication (v5.52.28)

Role-based MFA enforcement using industry-standard TOTP (RFC 6238).

### MFA Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Login     │────▶│  MFA Check   │────▶│  Role Requires  │
│   (Cognito) │     │  /api/mfa/   │     │  MFA?           │
└─────────────┘     │   check      │     └────────┬────────┘
                    └──────────────┘              │
                           │ Yes                  │ No
                           ▼                      ▼
                    ┌──────────────┐     ┌─────────────────┐
                    │  Enrolled?   │     │  Dashboard      │
                    └──────┬───────┘     │  Access         │
                           │             └─────────────────┘
                    No     │ Yes
                    ▼      ▼
             ┌──────────┐ ┌──────────────┐
             │ Enroll   │ │ Device       │
             │ Gate     │ │ Trusted?     │
             └──────────┘ └──────┬───────┘
                                 │
                          No     │ Yes
                          ▼      ▼
                   ┌──────────┐ ┌─────────────┐
                   │ Verify   │ │ Dashboard   │
                   │ Code     │ │ Access      │
                   └──────────┘ └─────────────┘
```

### Required Roles (Cannot Bypass or Disable)

| Role | MFA Required | Can Disable |
|------|--------------|-------------|
| `super_admin` | **Yes** | No |
| `admin` | **Yes** | No |
| `operator` | **Yes** | No |
| `auditor` | **Yes** | No |
| `tenant_admin` | **Yes** | No |
| `tenant_owner` | **Yes** | No |

### MFA Services

| Service | Purpose |
|---------|---------|
| `TOTPService` | RFC 6238 TOTP generation/verification |
| `BackupCodesService` | One-time recovery codes (SHA-256) |
| `DeviceTrustService` | 30-day device trust tokens |

### MFA API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/mfa/status` | GET | MFA status, backup codes, devices |
| `/api/v2/mfa/check` | GET | Check if role requires MFA |
| `/api/v2/mfa/enroll/start` | POST | Generate TOTP secret |
| `/api/v2/mfa/enroll/verify` | POST | Verify and enable MFA |
| `/api/v2/mfa/verify` | POST | Verify code during login |
| `/api/v2/mfa/backup-codes/regenerate` | POST | Regenerate backup codes |
| `/api/v2/mfa/devices` | GET | List trusted devices |
| `/api/v2/mfa/devices/:id` | DELETE | Revoke device |

### Security Measures

| Feature | Implementation |
|---------|----------------|
| **Secret Encryption** | AES-256-GCM with scrypt key |
| **Code Hashing** | SHA-256 |
| **Clock Drift** | ±30 seconds |
| **Lockout** | 3 failures → 5 min |
| **Device Trust** | 30 days, max 5/user |

### UI Components

| Component | Location |
|-----------|----------|
| `MFAEnrollmentGate` | Full-screen forced enrollment |
| `MFAVerificationPrompt` | Code entry modal |
| `MFASettingsSection` | Settings management |

**Migration**: `070_mfa_support.sql`

---

## 1.3 Self-Hosted Models (PROMPT-06)

### Model Categories

| Category | Models | Instance Type |
|----------|--------|---------------|
| **Vision Classification** | EfficientNet-B0/B4/V2-L, ConvNeXt, ViT | ml.g4dn.xlarge - ml.g5.2xlarge |
| **Object Detection** | YOLOv8n/m/x, DETR, Grounding DINO | ml.g4dn.xlarge - ml.g5.4xlarge |
| **Segmentation** | SAM, SAM2, MobileSAM, Mask R-CNN | ml.g5.xlarge - ml.g5.12xlarge |
| **Audio/Speech** | Whisper Large V3, Whisper Turbo, TitaNet, Pyannote | ml.g4dn.xlarge - ml.g5.xlarge |
| **Scientific** | ESM-2 3B, AlphaFold2, Protenix, AlphaGeometry | ml.g5.12xlarge - ml.p4d.24xlarge |
| **Medical** | nnU-Net, MedSAM | ml.g5.2xlarge |
| **Geospatial** | Prithvi 100M/600M | ml.g5.xlarge - ml.g5.4xlarge |
| **3D Reconstruction** | NeRFstudio, Gaussian Splatting | ml.g5.4xlarge - ml.g5.12xlarge |

### Thermal State Management

| State | Description | Instance Status |
|-------|-------------|-----------------|
| `OFF` | No instances running | Terminated |
| `COLD` | Scaled to zero, starts on demand | Terminated |
| `WARM` | Minimum instances ready | Running |
| `HOT` | Maximum instances for high load | Running |
| `AUTOMATIC` | Auto-scale based on demand | Variable |

---

## 1.4 External AI Providers (PROMPT-07)

### Provider Integration

| Provider | Models | Auth Type |
|----------|--------|-----------|
| **Anthropic** | Claude 4 Opus, Claude 4 Sonnet, Claude Haiku 3.5 | API Key |
| **OpenAI** | GPT-4o, GPT-4o-mini, o1, o1-mini | API Key |
| **Google** | Gemini 2.0 Flash, Gemini 1.5 Pro/Flash | API Key |
| **AWS Bedrock** | Claude, Titan, Llama | IAM |
| **Azure OpenAI** | GPT-4, GPT-4 Turbo | API Key + Endpoint |
| **Mistral** | Mistral Large, Codestral | API Key |
| **Cohere** | Command R+, Embed | API Key |
| **Groq** | Llama 3.1 70B/8B, Mixtral | API Key |
| **Together** | Llama, Qwen, DeepSeek | API Key |
| **Fireworks** | Llama, Mixtral, FireFunction | API Key |
| **DeepSeek** | DeepSeek Chat, DeepSeek Coder | API Key |
| **Perplexity** | Sonar Large/Small | API Key |
| **xAI** | Grok 2, Grok 2 Mini | API Key |
| **Alibaba** | Qwen Max, Qwen Plus, Qwen Turbo | API Key |

### Unified Model Access via LiteLLM

```typescript
interface ModelRequest {
  model: string;           // e.g., "claude-sonnet-4"
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}
```

---

## 1.5 Admin Web Dashboard (PROMPT-08)

### Dashboard Pages

| Page | Purpose |
|------|---------|
| `/dashboard` | Overview metrics, quick actions |
| `/models` | Model registry, thermal controls |
| `/models/[id]` | Model detail, usage stats |
| `/providers` | Provider management, health status |
| `/tenants` | Tenant management |
| `/tenants/[id]` | Tenant detail, usage, config |
| `/users` | User management |
| `/billing` | Usage reports, invoicing |
| `/audit` | Audit log viewer |
| `/settings` | System configuration |

### Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14 (App Router) |
| UI Library | shadcn/ui + Tailwind CSS |
| State | React Query + Zustand |
| Auth | AWS Amplify + Cognito |
| Charts | Recharts |

---

## 1.6 Genesis Cato Safety Architecture (PROMPT-34)

### Cato Components

| Component | Purpose |
|-----------|---------|
| **Precision Governor** | Limits confidence based on epistemic uncertainty |
| **Control Barrier Functions (CBF)** | Hard safety constraints (PHI, PII, Cost, Rate, Auth) |
| **Epistemic Recovery** | Detects and recovers from cognitive stalls |
| **Persona Service** | 5 personas with different behavioral profiles |
| **Sensory Veto** | Blocks dangerous outputs |
| **Merkle Audit Trail** | Immutable compliance logging |

### Personas

| Persona | Description | Default Gamma |
|---------|-------------|---------------|
| **Balanced** | Default mood, well-rounded | 2.0 |
| **Focused** | Task-oriented, efficient | 3.0 |
| **Curious** | Exploratory, asks questions | 1.5 |
| **Creative** | Imaginative, divergent thinking | 1.2 |
| **Scout** | Recovery persona for cognitive stalls | 1.0 |

### Control Barrier Functions

| Barrier | Type | Critical |
|---------|------|----------|
| PHI Protection | `phi` | Yes |
| PII Protection | `pii` | Yes |
| Cost Ceiling | `cost` | Yes |
| Rate Limit | `rate` | No |
| Authorization | `auth` | Yes |
| BAA Required | `custom` | Yes |

### Consciousness Persistence (v5.52.12)

Database-backed persistence for Cato consciousness state, ensuring survival across Lambda cold starts.

| Service | Purpose |
|---------|---------|
| **Global Memory Service** | 4-tier memory (episodic/semantic/procedural/working) |
| **Consciousness Loop Service** | State machine (IDLE→PROCESSING→REFLECTING→DREAMING→PAUSED) |
| **Neural Decision Service** | Affect→hyperparameter mapping for Bedrock model selection |
| **Dream Scheduler Service** | Twilight (4 AM) + low-traffic + starvation triggers |

| Table | Purpose |
|-------|---------|
| `cato_global_memory` | Persistent memory with importance weighting |
| `cato_consciousness_state` | Loop state, awareness level, active thoughts |
| `cato_consciousness_config` | Per-tenant consciousness configuration |
| `cato_consciousness_metrics` | Cycle metrics, thoughts processed, dream cycles |

**Migration**: `V2026_01_24_002__cato_consciousness_persistence.sql`

---

## 1.6.1 Unified AGI Architecture: Brain, Genesis, Cortex, and Cato

RADIANT's AGI capabilities are built on four interconnected subsystems that work together to provide intelligent, safe, and enterprise-ready AI orchestration.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER PROMPT                                        │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AGI BRAIN PLANNER                                   │
│  Coordinates: Domain Detection → Model Selection → Response Generation       │
└──────────────────────────────────────────────────────────────────────────────┘
         │                    │                    │                    │
         ▼                    ▼                    ▼                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   GENESIS   │     │    CATO     │     │   CORTEX    │     │   BRAIN     │
│             │     │             │     │             │     │             │
│ Maturity    │     │ Safety      │     │ Knowledge   │     │ Cognitive   │
│ Gates G1-G5 │     │ Pipeline    │     │ Graph       │     │ Mesh        │
│             │     │             │     │             │     │             │
│ Capabilities│     │ CBFs        │     │ Three Tiers │     │ LoRA        │
│ Restrictions│     │ Checkpoints │     │ Golden Rules│     │ Adapters    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
         │                    │                    │                    │
         └────────────────────┴────────────────────┴────────────────────┘
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │   CATO-CORTEX BRIDGE   │
                         │  Memory Sync + GDPR    │
                         └────────────────────────┘
```

### System Roles

| System | Purpose | Key Service |
|--------|---------|-------------|
| **Brain** | AGI planning, cognitive mesh, model orchestration | `agi-brain-planner.service.ts` |
| **Genesis** | Developmental gates, capability unlocking, maturity stages | `cato/genesis.service.ts` |
| **Cortex** | Tiered memory (Hot/Warm/Cold), knowledge graph, Graph-RAG | `cortex-intelligence.service.ts` |
| **Cato** | Safety pipeline, CBFs, governance presets, HITL checkpoints | `cato/safety-pipeline.service.ts` |

### Integration Flow

1. **Brain** receives user prompt and coordinates plan generation
2. **Cortex** provides knowledge density insights to boost domain detection confidence
3. **Genesis** checks maturity stage and applies capability restrictions
4. **Cato** runs safety pipeline (Sensory Veto → Precision Governor → CBFs → Entropy → Fracture)
5. **Brain** selects model using Cortex recommendations and LoRA adapters
6. **Cato-Cortex Bridge** syncs memories and handles GDPR erasure

### Governance Presets

| Preset | Friction | Auto-Approve | Checkpoints |
|--------|----------|--------------|-------------|
| **PARANOID** 🛡️ | 1.0 | 0.0 | All ALWAYS |
| **BALANCED** ⚖️ | 0.5 | 0.3 | CONDITIONAL |
| **COWBOY** 🚀 | 0.1 | 0.8 | NEVER/NOTIFY |

### Genesis Maturity Stages

| Stage | Capabilities | Restrictions |
|-------|-------------|--------------|
| `EMBRYONIC` | Basic chat | No external actions |
| `NASCENT` | Context retention | Limited autonomy |
| `DEVELOPING` | Ethics checks | Requires checkpoints |
| `MATURING` | Checkpoint system | Some autonomous actions |
| `MATURE` | Full capability | Minimal restrictions |

### Cortex Memory Tiers

| Tier | Storage | Latency | Retention |
|------|---------|---------|-----------|
| **Hot** | Redis + DynamoDB | <10ms | 0-24 hours |
| **Warm** | Neptune/pgvector | <100ms | 1-90 days |
| **Cold** | S3 Iceberg | 1-10s | 90d-7 years |

### Cato Safety Pipeline

| Step | Component | Purpose |
|------|-----------|---------|
| 1 | Sensory Veto | Immediate halt signals |
| 2 | Precision Governor | Limits confidence |
| 3 | Redundant Perception | PHI/PII detection |
| 4 | Control Barrier Functions | Hard safety constraints |
| 5 | Semantic Entropy | Deception detection |
| 6 | Fracture Detection | Alignment verification |

**Detailed Documentation**: See [ENGINEERING-IMPLEMENTATION-VISION.md Section 21](./ENGINEERING-IMPLEMENTATION-VISION.md#21-unified-agi-architecture-brain-genesis-cortex-and-cato-v55229) for full engineering reference.

---

## 1.6.2 Universal Envelope Protocol (UEP) v2.0

UEP v2.0 provides standardized wrapping for all AI interactions across RADIANT, enabling unified tracing, compliance, and storage.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI REQUEST/RESPONSE                                │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       UEP INTEGRATION SERVICE                                │
│  Adapters: Model Router | Cato Pipeline | AGI | Brain | Response Synthesis  │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       UDS TIERED STORAGE                                     │
│  Hot (Redis) → Warm (PostgreSQL) → Cold (S3) → Glacier (S3 Glacier)         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Envelope Structure

| Field | Type | Purpose |
|-------|------|---------|
| `envelopeId` | UUID | Unique envelope identifier |
| `specversion` | '2.0' | Protocol version |
| `type` | string | Event type (e.g., `ai.model.response`) |
| `source` | object | Origin (system, component, tenant) |
| `payload` | object | Input/output data with tokens |
| `tracing` | object | Distributed trace context |
| `compliance` | object | PHI/PII flags, retention, frameworks |
| `riskSignals` | object | Safety scores and flags |

### Integration Points

| Service | Type | Description |
|---------|------|-------------|
| **Model Router** | `ai.model.response` | All model completions |
| **Cato Pipeline** | `cato.method.*` | Pipeline method envelopes |
| **AGI Orchestrator** | `agi.orchestration.*` | Multi-model orchestration |
| **Brain Router** | `brain.router.response` | Domain-aware routing |
| **Response Synthesis** | `synthesis.*` | Ensemble/merge results |

### Storage Tiers

| Tier | Storage | Retention | Latency |
|------|---------|-----------|---------|
| **Hot** | Redis/ElastiCache | 0-24h | <10ms |
| **Warm** | PostgreSQL (`uds_envelopes`) | 1-90 days | <100ms |
| **Cold** | S3 Standard-IA | 90d-7 years | 1-10s |
| **Glacier** | S3 Glacier | 7+ years | 1-12h |

### Key Files

| File | Purpose |
|------|---------|
| `services/uep/integration.service.ts` | Platform-wide adapters |
| `services/uep/uds-storage-adapter.service.ts` | UDS tiered storage |
| `services/uep/compliance.service.ts` | PHI/PII detection |
| `services/uep/security.service.ts` | Encryption/signing |
| `migrations/V2026_01_31_001__uds_envelopes.sql` | Database schema |

**Documentation**: See [UEP-V2-SPECIFICATION.md](./UEP-V2-SPECIFICATION.md) for complete specification.

### 1.6.3 Workflow UEP Integration

UEP v2.0 is fully integrated into the workflow orchestration system with model-agnostic condition evaluation.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WORKFLOW EXECUTION                               │
│  ┌──────────┐    UEP     ┌───────────┐    UEP     ┌──────────┐         │
│  │  Node A  │───────────▶│ Condition │───────────▶│  Node B  │         │
│  │ AI Call  │  Envelope  │ Evaluator │  Envelope  │ AI Call  │         │
│  └──────────┘            └───────────┘            └──────────┘         │
│       │                       │                        │               │
│       └───────────────────────┴────────────────────────┘               │
│                               │                                        │
│                        UDS Tiered Storage                              │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Design Principle**: **CONDITIONS ARE MODEL-AGNOSTIC**
- Conditions evaluate OUTPUT CONTENT, not model identity
- Users can swap AI models without breaking workflow logic
- Model info captured for tracing/debugging only

**Condition Types**:
| Type | Description | Cost |
|------|-------------|------|
| `expression` | JavaScript-like expressions | Free |
| `ai_interpreted` | Natural language quality checks | ~$0.001/eval |
| `composite` | AND/OR/NOT combinations | Sum of parts |

**Stream Evaluation Modes** (for parallel model outputs):
| Mode | Description |
|------|-------------|
| `all` | All streams must pass |
| `any` | Any stream sufficient |
| `majority` | >50% must pass |
| `best` | Highest confidence |
| `quorum` | Configurable threshold |

**Key Files**:
| File | Purpose |
|------|---------|
| `services/workflow/uep-node.service.ts` | Central UEP integration |
| `workflow-engine.ts` | UEP-aware execution methods |
| `migrations/V2026_01_31_003__workflow_uep_integration.sql` | Database schema |

**Documentation**: See [WORKFLOW-UEP-ARCHITECTURE.md](./WORKFLOW-UEP-ARCHITECTURE.md) for complete guide.

---

## 1.7 Pricing System (v4_12_pricing_system.ts)

### Price Calculation

```typescript
interface ModelPriceAnalysis {
  modelId: string;
  displayName: string;
  
  // Raw costs
  rawCosts: {
    inputCostPer1k: number;
    outputCostPer1k: number;
    baseCostPer1k: number;
  };
  
  // Calculated prices (with markup)
  calculatedPrices: {
    inputPrice: number;
    outputPrice: number;
    totalPrice: number;
  };
  
  // Admin info
  adminCostInfo: {
    actualCost: number;
    marginAmount: number;
    marginPercent: number;
  };
}
```

### Tier Pricing

| Tier | Name | Monthly Base | Models Available |
|------|------|--------------|------------------|
| 1 | SEED | $200 | Basic external only |
| 2 | SPROUT | $500 | + Vision, Audio |
| 3 | GROWTH | $2,000 | + Scientific, Medical |
| 4 | SCALE | $10,000 | + All self-hosted |
| 5 | ENTERPRISE | $50,000+ | Full platform + custom |

---

## 1.8 Compliance Frameworks

### HIPAA Compliance

| Requirement | Implementation |
|-------------|----------------|
| PHI Detection | Real-time scanning via CBF |
| BAA Tracking | Tenant-level BAA verification |
| Access Controls | RBAC + tenant isolation |
| Audit Trail | Merkle-tree immutable logs |
| Encryption | AES-256 at rest, TLS 1.3 in transit |

### SOC 2 Type II

| Control | Implementation |
|---------|----------------|
| Access Control | Cognito + API keys + RBAC |
| Change Management | CDK deployments with approvals |
| Incident Response | CloudWatch alarms + PagerDuty |
| Data Protection | Encryption + backup policies |

### GDPR

| Requirement | Implementation |
|-------------|----------------|
| Right to Erasure | Tenant data deletion API |
| Consent Tracking | Consent table with timestamps |
| Data Portability | Export API for tenant data |
| DPO Contact | Configurable per deployment |

### FDA 21 CFR Part 11

| Requirement | Implementation |
|-------------|----------------|
| Electronic Signatures | Multi-factor auth + timestamp |
| Audit Trails | Immutable Merkle audit |
| System Validation | Deployment verification |
| Access Controls | Role-based with approval workflows |

---

## 1.9 Neural Network Routing

### Model Selection Algorithm

The routing system optimizes across three dimensions:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Accuracy** | 0.4 | Model performance for task type |
| **Verifiability** | 0.3 | Can we prove correctness (ECD score) |
| **Cost** | 0.3 | Token cost optimization |

### Routing Logic

```typescript
interface RoutingDecision {
  selectedModel: string;
  routingReason: string;
  alternatives: ModelCandidate[];
  
  // Optimization scores
  accuracyScore: number;
  verifiabilityScore: number;
  costScore: number;
  combinedScore: number;
}
```

---

## 1.10 War Room Orchestration

### War Room Phases

| Phase | Role | Model |
|-------|------|-------|
| **Proposer** | Generate initial response | Claude Opus/Sonnet |
| **Security Critic** | Check for vulnerabilities | Claude Opus |
| **Efficiency Critic** | Check for waste | GPT-4o |
| **Factual Critic** | Verify claims | Gemini Pro |
| **Decider** | Synthesize final response | Claude Opus |

### Execution Modes

| Mode | Description | Cost |
|------|-------------|------|
| **Sniper** | Single model, direct response | ~$0.01 |
| **War Room** | Full multi-model debate | ~$0.50 |
| **Hybrid** | Sniper with escalation to War Room | Variable |

---

## 1.11 Truth Engine (ECD Verification)

### Entity-Context Divergence

```
ECD = |{ungrounded entities}| / |{total entities}|
```

| ECD Score | Interpretation | Action |
|-----------|----------------|--------|
| 0.00-0.05 | Highly grounded | Accept |
| 0.05-0.10 | Mostly grounded | Accept with note |
| 0.10-0.20 | Partially grounded | Flag for review |
| 0.20+ | Significant hallucination | Reject/Refine |

---

## 1.11 AXIOM Scorers (v6.0.0)

The AXIOM Scorers are 8 lightweight MLPs (~50K-1M params each) for intelligent prompt optimization.

### The 8 Scorers

| Scorer | Input | Output | Purpose |
|--------|-------|--------|---------|
| **Domain** | 1536 | 800 | Classifies queries into domain taxonomy |
| **CLARION** | 1536 | 1 | Scores question relevance |
| **Pattern** | 3072 | 1 | Ranks prompt patterns |
| **Model** | 1536 | 106 | Scores models for task |
| **Topology** | 512 | 9 | Evaluates orchestration modes |
| **Combination** | 640 | 1 | Scores multi-model combos |
| **Variant** | 1536 | 1 | Scores prompt variants |
| **User** | 128 | 64 | Personalizes via Ghost Vector |

### Key Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/axiom-neural-cortex.service.ts` | Inference client |
| `lambda/shared/services/axiom.service.ts` | Pipeline (Model/Topology scorers) |
| `lambda/shared/services/clarion.service.ts` | CLARION Scorer integration |
| `packages/shared/src/types/axiom-clarion.types.ts` | Scorer type definitions |
| `migrations/V2026_02_01_001__axiom_neural_cortex.sql` | Database schema |

### Database Tables

| Table | Purpose |
|-------|---------|
| `axiom_network_status` | Scorer thermal state and metrics |
| `axiom_network_inference_log` | Inference log for training |
| `axiom_network_training_batches` | CATO training tracking |
| `domain_taxonomy_embeddings` | Domain centroids for fallback |

### Thermal States

Scorers have thermal states (cold/warm/hot) that control inference:
- **Cold**: Uses heuristic fallbacks
- **Warm**: SageMaker endpoint ready
- **Hot**: Multiple replicas for high traffic

---

## 1.12 Mid-Level Services (MLS) Architecture v5.0.0

Mid-Level Services (MLS) are domain-specific orchestration services that combine multiple AI models to provide unified capabilities for specific use cases. MLS sits between the low-level model APIs and high-level application logic.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway (/api/v2/mls/*)                 │
├─────────────────────────────────────────────────────────────────┤
│                    MLS Router (Lambda)                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐ │
│  │Perception│ │Scientific│ │ Medical │ │Geospatial│ │Reconstruct│ │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └─────┬─────┘ │
├───────┼──────────┼──────────┼──────────┼─────────────┼─────────┤
│       │          │          │          │             │         │
│  ┌────▼────┐┌────▼────┐┌────▼────┐┌────▼────┐ ┌──────▼──────┐  │
│  │ YOLOv8  ││ ESM-2   ││ MedSAM  ││ Prithvi ││ Nerfstudio  │  │
│  │ SAM/SAM2││AlphaFold││ nnU-Net ││ 100M/   ││ 3D Gaussian │  │
│  │ CLIP    ││AlphaGeom││ Whisper ││ 600M    ││             │  │
│  │ Dino    ││ Protenix││         ││         ││             │  │
│  └─────────┘└─────────┘└─────────┘└─────────┘ └─────────────┘  │
│                    SageMaker Endpoints                          │
├─────────────────────────────────────────────────────────────────┤
│              Thermal Manager (EventBridge + SQS)                │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

| Principle | Description |
|-----------|-------------|
| **Orchestration** | Services combine 2-8 models for complex pipelines |
| **Graceful Degradation** | Services remain functional when optional models are offline |
| **Thermal Awareness** | Auto-warms models on first request, scales to zero when idle |
| **Tier-Gated Access** | Different services available at different subscription tiers |
| **Unified Pricing** | Per-use pricing abstracts underlying model costs |
| **Compliance-Ready** | HIPAA, SOC 2, GDPR compliant by design |

### Service Summary

| Service | Domain | Min Tier | Required Models | Optional Models | Endpoints |
|---------|--------|----------|-----------------|-----------------|-----------|
| **Perception** | Computer Vision | 3 (GROWTH) | yolov8m, mobilesam | yolov8x, sam-vit-h, sam2, clip, grounding-dino | 4 |
| **Scientific** | Computational Biology | 4 (SCALE) | esm2-3b | alphafold2, alphageometry, protenix | 3 |
| **Medical** | Healthcare Imaging | 4 (SCALE) | medsam | nnunet, whisper-large-v3 | 3 |
| **Geospatial** | Satellite Imagery | 4 (SCALE) | prithvi-100m | prithvi-600m | 2 |
| **Reconstruction** | 3D Generation | 4 (SCALE) | nerfstudio | 3d-gaussian-splatting | 2 |

### Request Flow

```
1. Request → API Gateway → MLS Router Lambda
2. Router checks: tenant tier, service state, model availability
3. If model COLD → Return 202 Accepted, queue warm-up via SQS
4. If model WARM/HOT → Route to SageMaker endpoint
5. Orchestrate multi-model pipeline if needed
6. Return response with usage metrics
7. EventBridge triggers scale-down after idle period
```

### Perception Service

**Purpose**: Unified computer vision pipeline for object detection, segmentation, classification, and analysis.

| Endpoint | Description | Input | Output |
|----------|-------------|-------|--------|
| `/perception/detect` | Object detection with bounding boxes | image/* | JSON |
| `/perception/segment` | Object/region segmentation | image/* | JSON, PNG mask |
| `/perception/classify` | Image classification | image/* | JSON |
| `/perception/analyze` | Full pipeline: detect + segment + classify | image/* | JSON |

**Models**: YOLOv8m/x, YOLOv11x, MobileSAM, SAM-ViT-H, SAM2, CLIP-ViT-L14, Grounding-DINO, EfficientNetV2-L

**Pricing**: $0.02/image, $0.50/minute video (40% margin)

### Scientific Service

**Purpose**: Protein analysis, embeddings, structure prediction, and computational biology pipelines.

| Endpoint | Description | Input | Output |
|----------|-------------|-------|--------|
| `/scientific/protein/embed` | Generate protein sequence embeddings | FASTA, JSON | JSON |
| `/scientific/protein/fold` | Predict protein 3D structure | FASTA | PDB, mmCIF, JSON |
| `/scientific/geometry/solve` | Solve mathematical geometry problems | JSON | JSON |

**Models**: ESM-2 3B, AlphaFold2, AlphaGeometry, Protenix

**Pricing**: $0.50/request (40% margin)

### Medical Service (HIPAA Compliant)

**Purpose**: HIPAA-compliant medical image segmentation, analysis, and transcription.

| Endpoint | Description | Input | Output |
|----------|-------------|-------|--------|
| `/medical/segment` | 2D anatomical segmentation | DICOM, PNG, JPEG | JSON, PNG |
| `/medical/segment/3d` | Volumetric 3D CT/MRI segmentation | DICOM, NIfTI | NIfTI, JSON |
| `/medical/transcribe` | Medical dictation transcription | WAV, MP3, M4A | JSON, text |

**Models**: MedSAM, nnU-Net, Whisper Large v3

**Compliance**: PHI sanitization, 6-year retention, full audit logging, BAA required

**Pricing**: $0.15/image, $0.08/minute audio (40% margin)

### Geospatial Service

**Purpose**: Satellite imagery analysis, land classification, and earth observation.

| Endpoint | Description | Input | Output |
|----------|-------------|-------|--------|
| `/geospatial/classify` | Land use and land cover classification | GeoTIFF | JSON, GeoTIFF |
| `/geospatial/change-detect` | Detect changes between satellite images | GeoTIFF | JSON, GeoTIFF |

**Models**: Prithvi 100M, Prithvi 600M (NASA/IBM)

**Pricing**: $0.05/image (40% margin)

### 3D Reconstruction Service

**Purpose**: Neural Radiance Fields (NeRF) and 3D Gaussian Splatting for 3D scene reconstruction.

| Endpoint | Description | Input | Output |
|----------|-------------|-------|--------|
| `/reconstruction/nerf` | 3D scene from images using NeRF | MP4, images | GLTF, OBJ, MP4 |
| `/reconstruction/gaussian` | Real-time 3D via Gaussian Splatting | MP4, images | PLY, GLTF |

**Models**: Nerfstudio, 3D Gaussian Splatting

**Pricing**: $5.00/3D model (40% margin)

### Thermal State Management

| State | Description | Response Time | Cost |
|-------|-------------|---------------|------|
| **OFF** | Model not deployed | N/A | $0 |
| **COLD** | Endpoint exists, 0 instances | 2-5 min warm-up | Minimal |
| **WARM** | 1+ instances running | Seconds | Instance hours |
| **HOT** | Max instances, autoscaling | <1 second | Higher |
| **AUTOMATIC** | System-managed | Variable | Optimized |

**Warm-up Triggers**: On-Demand (202 Accepted), Scheduled (EventBridge), Predictive (usage patterns), Manual (admin)

### Model Registry (38 Self-Hosted Models)

| Category | Count | Examples |
|----------|-------|----------|
| Computer Vision | 19 | YOLOv8/11, SAM/SAM2, CLIP, EfficientNet |
| Audio/Speech | 6 | Whisper, TitaNet, pyannote |
| Scientific | 4 | AlphaFold2, ESM-2, AlphaGeometry |
| Medical | 2 | MedSAM, nnU-Net |
| Geospatial | 2 | Prithvi 100M/600M |
| Generative/3D | 5 | Nerfstudio, 3D Gaussian, Llama 3, Qwen |

### Graceful Degradation

| Level | Description | Example |
|-------|-------------|---------|
| **FULL** | All models available | All capabilities active |
| **REDUCED** | Only required models | HD features disabled |
| **MINIMAL** | Partial required models | Limited capabilities |

### Database Schema

```sql
-- Thermal state tracking
CREATE TABLE mls_model_thermal_states (
    model_id TEXT PRIMARY KEY,
    thermal_state thermal_state_enum DEFAULT 'OFF',
    current_instances INTEGER DEFAULT 0,
    max_instances INTEGER DEFAULT 10,
    last_request_at TIMESTAMPTZ,
    warm_up_started_at TIMESTAMPTZ,
    warm_up_completed_at TIMESTAMPTZ,
    scale_down_scheduled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service state and health
CREATE TABLE mls_service_states (
    service_id TEXT PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    state service_state_enum DEFAULT 'RUNNING',
    degradation_level TEXT DEFAULT 'FULL',
    required_models_available BOOLEAN DEFAULT true,
    optional_models_count INTEGER DEFAULT 0,
    last_health_check_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Key Files

| Component | Path |
|-----------|------|
| Model Configurations | `packages/infrastructure/lib/config/models/` |
| Service Definitions | `packages/infrastructure/lib/config/services/` |
| Thermal Management | `packages/infrastructure/lambda/thermal/` |
| Service Orchestrators | `packages/infrastructure/lambda/services/` |
| Database Schema | `migrations/006_self_hosted_models.sql` |
| LiteLLM Routing | `litellm/config/self-hosted.yaml` |

---

# PART 2: NEW IN VERSION 5.0 (THE SOVEREIGN MESH)

## 2.1 Agent Registry

### Purpose

Agents are long-running AI workers that accept goals and run OODA loops to achieve them. Unlike Methods (single-step reasoning), Agents iterate until complete or budget exhausted.

### Database Tables

| Table | Purpose |
|-------|---------|
| `agents` | Agent definitions, capabilities, AI config |
| `agent_executions` | Execution history, OODA state, artifacts |

### Agent Categories

| Category | Use Case | Examples |
|----------|----------|----------|
| `research` | Web research, document analysis | Research Agent |
| `coding` | Code generation, debugging | Coding Agent |
| `data` | Data processing, visualization | Data Agent |
| `outreach` | Lead gen, email campaigns | LeadGen Agent |
| `creative` | Content generation, editing | Editor Agent |
| `operations` | DevOps, monitoring | Ops Agent |
| `custom` | User-defined | Any |

### Built-in Agents

| Agent | Category | Budget | Timeout | HITL |
|-------|----------|--------|---------|------|
| Research Agent | research | $2-10 | 30 min | No |
| Coding Agent | coding | $3-15 | 45 min | No |
| Data Agent | data | $2.50-20 | 60 min | No |
| LeadGen Agent | outreach | $5-50 | 120 min | Yes |
| Editor Agent | creative | $1.50-5 | 30 min | No |

### OODA Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                         OODA LOOP                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────┐ │
│   │ OBSERVE  │────▶│  ORIENT  │────▶│  DECIDE  │────▶│  ACT │ │
│   │          │     │          │     │          │     │      │ │
│   │ Gather   │     │ Analyze  │     │ Plan     │     │ Do   │ │
│   │ info     │     │ + check  │     │ actions  │     │ it   │ │
│   └──────────┘     │ goal     │     └──────────┘     └──────┘ │
│        ▲           └──────────┘           │                    │
│        │                                  │                    │
│        │         ┌──────────┐             │                    │
│        └─────────│  SAFETY  │◀────────────┘                    │
│                  │  CHECK   │                                  │
│                  │ (Cato)   │                                  │
│                  └──────────┘                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2.2 App Registry

### Purpose

The App Registry provides access to 3,000+ third-party app integrations, auto-synced from open-source projects (Activepieces, n8n).

### Database Tables

| Table | Purpose |
|-------|---------|
| `apps` | App definitions (triggers, actions, auth) |
| `app_sync_logs` | Daily sync history |
| `app_health_checks` | Hourly health monitoring |
| `app_connections` | Per-tenant OAuth/API credentials |
| `app_learned_inferences` | AI learning loop corrections |

### Sync Schedule

| Task | Schedule | Description |
|------|----------|-------------|
| Full Sync | Daily 2 AM UTC | Pull latest from Activepieces/n8n repos |
| Health Check | Hourly | Test top 100 apps by usage |
| Cache Cleanup | Daily 3 AM UTC | Clear expired definitions |

### App Sources

| Source | License | Apps |
|--------|---------|------|
| Activepieces | MIT | ~500+ |
| n8n | Fair Code | ~400+ |
| Native | Proprietary | ~50 |
| Custom | Per-tenant | Variable |

---

## 2.3 AI Helper Service (Parametric AI)

### Purpose

The AI Helper Service enables AI assistance for any component in the system. Each component can independently enable/disable specific AI capabilities.

### Configuration Structure

```typescript
interface AIHelperConfig {
  enabled: boolean;  // Master switch
  
  disambiguation?: {
    enabled: boolean;
    model?: string;
    confidenceThreshold?: number;
  };
  
  parameterInference?: {
    enabled: boolean;
    model?: string;
    examples?: Array<{ input: string; inferred: Record<string, unknown> }>;
  };
  
  errorRecovery?: {
    enabled: boolean;
    model?: string;
    maxAttempts?: number;
    strategies?: Array<{ error: string; recovery: string }>;
  };
  
  validation?: {
    enabled: boolean;
    model?: string;
    checks?: Array<{ field: string; check: string; severity: 'warning' | 'error' }>;
  };
  
  explanation?: {
    enabled: boolean;
    model?: string;
  };
}
```

### Capabilities

| Capability | Purpose | Default Model |
|------------|---------|---------------|
| **Disambiguation** | Resolve unclear inputs | claude-haiku-35 |
| **Parameter Inference** | Fill missing parameters | claude-haiku-35 |
| **Error Recovery** | Suggest fixes for errors | claude-haiku-35 |
| **Validation** | Check before execution | claude-sonnet-4 |
| **Explanation** | Explain what was done | claude-haiku-35 |

### Config Merging

Configuration merges in order: **System → Tenant → Component**

Each level can override or disable capabilities from the previous level.

---

## 2.4 Pre-Flight Provisioning

### Purpose

Before any workflow executes, Pre-Flight checks all requirements:
- Required apps are connected
- OAuth tokens are valid
- Budget is available
- Required agents exist

### Database Tables

| Table | Purpose |
|-------|---------|
| `workflow_blueprints` | Generated workflow structure |
| `capability_checks` | Individual requirement checks |

### Pre-Flight Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRE-FLIGHT SEQUENCE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. BLUEPRINT GENERATION                                        │
│     - Parse user intent                                         │
│     - Generate workflow DAG                                     │
│     - Identify required capabilities                            │
│                                                                 │
│  2. CAPABILITY SCAN                                             │
│     - List all apps needed                                      │
│     - List all agents needed                                    │
│     - List all tools needed                                     │
│                                                                 │
│  3. CREDENTIAL CHECK                                            │
│     - For each app: check OAuth/API key exists                  │
│     - For each app: verify token not expired                    │
│     - Generate auth URLs for missing                            │
│                                                                 │
│  4. RESOURCE ESTIMATION                                         │
│     - Estimate token usage                                      │
│     - Estimate cost                                             │
│     - Estimate duration                                         │
│                                                                 │
│  5. USER PROMPT (if needed)                                     │
│     - Show missing connections                                  │
│     - Provide OAuth links                                       │
│     - Wait for user to connect                                  │
│                                                                 │
│  6. EXECUTE (only when all green)                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2.5 Transparency Layer

### Purpose

The Transparency Layer captures every decision Cato makes, enabling:
- Explainability for enterprise customers
- Compliance audit trails
- Debugging and optimization

### Database Tables

| Table | Purpose |
|-------|---------|
| `cato_decision_events` | Every routing/selection decision |
| `cato_war_room_deliberations` | Phase-by-phase debate capture |
| `cato_decision_explanations` | Pre-computed explanations |

### Decision Types

| Type | Description |
|------|-------------|
| `model_selection` | Which model to use |
| `workflow_selection` | Sniper vs War Room |
| `mode_selection` | Execution mode |
| `agent_selection` | Which agent for task |
| `tool_selection` | Which tools to enable |
| `safety_evaluation` | Governor/CBF decisions |
| `cost_optimization` | Cost-based choices |

### Explanation Tiers

| Tier | Audience | Content |
|------|----------|---------|
| `summary` | End user | 1-2 sentence summary |
| `standard` | Power user | Key factors, alternatives |
| `detailed` | Admin | Full reasoning chain |
| `audit` | Compliance | Everything + context |

---

## 2.6 HITL Approval Queues

### Purpose

Human-in-the-Loop approval workflows for high-stakes decisions:
- Agent plans in regulated industries
- High-cost operations
- Sensitive data access

### Database Tables

| Table | Purpose |
|-------|---------|
| `hitl_queue_configs` | Queue definitions |
| `hitl_approval_requests` | Pending approvals |
| `hitl_reviewer_assignments` | Who can approve |

### Trigger Types

| Trigger | Description |
|---------|-------------|
| `workflow_step` | Specific step requires approval |
| `ecd_threshold` | Truth Engine score too high |
| `domain_match` | Medical/Legal/Financial domain |
| `cost_threshold` | Operation exceeds cost limit |
| `agent_plan` | Agent's proposed actions |
| `always` | Every execution |

### SLA Management

| Priority | Default Timeout | Escalation |
|----------|-----------------|------------|
| `critical` | 15 minutes | Immediate |
| `high` | 30 minutes | After 15 min |
| `normal` | 60 minutes | After 30 min |
| `low` | 4 hours | After 2 hours |

---

## 2.7 Execution History & Replay

### Purpose

Time-travel debugging for workflows:
- See exact state at each step
- Replay with modified inputs
- Compare execution runs

### Database Tables

| Table | Purpose |
|-------|---------|
| `execution_snapshots` | State capture per step |
| `replay_sessions` | Replay configurations |

### Snapshot Content

| Field | Content |
|-------|---------|
| `input_state` | Input to the step |
| `output_state` | Output from the step |
| `internal_state` | Working memory |
| `model_id` | Model used |
| `governor_state` | Cato's state |
| `cbf_evaluation` | Safety check results |
| `cost_usd` | Step cost |
| `tokens_used` | Token consumption |

### Replay Modes

| Mode | Description |
|------|-------------|
| `full` | Replay entire execution |
| `from_step` | Replay from specific step |
| `modified_input` | Replay with changed inputs |

---

# PART 3: INTEGRATION GUIDE

## 3.1 How AI Helper Integrates with Existing Components

### Model Router Integration

```typescript
// In model-router.service.ts

async selectModel(request: ModelSelectionRequest): Promise<ModelSelection> {
  // ... existing routing logic ...
  
  // NEW: If multiple models match equally, use AIHelper
  if (candidates.length > 1 && this.aiHelper) {
    const disambiguated = await this.aiHelper.disambiguate({
      input: request.query,
      candidates: candidates.map(c => ({
        id: c.id,
        label: c.displayName,
        confidence: c.score,
      })),
    }, request.tenantId);
    
    if (disambiguated.resolved) {
      return candidates.find(c => c.id === disambiguated.selectedId);
    }
  }
  
  // ... continue with existing logic ...
}
```

### Connector Integration

```typescript
// In any connector (e.g., salesforce.connector.ts)

async createOpportunity(params: CreateOpportunityParams): Promise<Opportunity> {
  // NEW: Use AIHelper for parameter inference
  if (this.aiHelperConfig.parameterInference?.enabled) {
    const inferred = await this.aiHelper.inferParameters({
      targetApp: 'salesforce',
      targetAction: 'createOpportunity',
      providedParams: params,
      missingParams: this.getMissingRequired(params),
    }, this.tenantId);
    
    params = { ...params, ...inferred.inferred };
  }
  
  // NEW: Use AIHelper for validation
  if (this.aiHelperConfig.validation?.enabled) {
    const validation = await this.aiHelper.validate({
      app: 'salesforce',
      action: 'createOpportunity',
      params,
    }, this.tenantId);
    
    if (!validation.isValid) {
      throw new ValidationError(validation.issues);
    }
  }
  
  try {
    return await this.salesforceClient.create('Opportunity', params);
  } catch (error) {
    // NEW: Use AIHelper for error recovery
    if (this.aiHelperConfig.errorRecovery?.enabled) {
      const recovery = await this.aiHelper.suggestRecovery({
        error: { code: error.code, message: error.message },
        action: { app: 'salesforce', action: 'createOpportunity', params },
        attemptNumber: 1,
      }, this.tenantId);
      
      if (recovery.canAutoRecover && recovery.modifiedParams) {
        return await this.salesforceClient.create('Opportunity', recovery.modifiedParams);
      }
    }
    throw error;
  }
}
```

### Cato Safety Pipeline Integration

```typescript
// In cato-safety-pipeline.service.ts

async evaluate(request: SafetyRequest): Promise<SafetyResult> {
  // NEW: Log decision event for transparency
  const decisionEventId = await this.transparency.startDecisionEvent({
    tenantId: request.tenantId,
    type: 'safety_evaluation',
    input: request,
  });
  
  // ... existing safety logic (Governor, CBF, Veto) ...
  
  // NEW: Complete decision event
  await this.transparency.completeDecisionEvent(decisionEventId, {
    output: result,
    governorState: governorResult.state,
    cbfEvaluations: cbfResult.evaluations,
  });
  
  return result;
}
```

---

## 3.2 Database Migration Order

Execute in this order:

1. **Existing (001-067)** - Already implemented
2. **V2026_01_20_003** - Agent Registry
3. **V2026_01_20_004** - App Registry
4. **V2026_01_20_005** - AI Helper Service
5. **V2026_01_20_006** - Pre-Flight Provisioning
6. **V2026_01_20_007** - Transparency Layer
7. **V2026_01_20_008** - HITL Approval Queues
8. **V2026_01_20_009** - Execution History
9. **V2026_01_20_010** - Seed Data (Built-in Agents, Sample Apps)
10. **V2026_01_21_005** - AI Reports (brand_kits, report_templates, generated_reports, report_smart_insights, report_exports, report_chat_history, report_schedules)
11. **139_cartridge_pki_kms.sql** - Cartridge PKI KMS Integration (key_id, key_arn columns, pki_audit_log table)
12. **140_mls_message_layer_security.sql** - MLS RFC 9420 (7 tables for group encryption)
13. **V2026_01_28_001__environment_state_registry.sql** - Environment State Registry (manifests, sync_config, sync_operations, backups, restores, persistent_data, audit_log)
14. **V2026_02_05_005__inference_cache_heterogeneous_consensus.sql** - Inference Response Cache (4 tables: config, entries, events, metrics; 3 helper functions) + Heterogeneous Model Consensus (5 tables: config, evaluations, responses, pairwise_agreements, metrics). Full RLS on all tables.
15. **V2026_02_06_006__user_identity_refactor.sql** - Single-Tenant User Model, Licensing & Auth Config (v7.23.0). Reverses v7.22.0 multi-tenant model: `users.tenant_id` NOT NULL, UNIQUE(tenant_id, email), UNIQUE(tenant_id, cognito_user_id). Adds feature access flags (6 apps), invitation tracking, deactivation/deletion, soft permissions (JSONB), usage tracking directly on `users` table. Creates `tenant_licenses` (flexible multi-dimension licensing: seats, storage, retention, compliance, add-ons), `license_catalog` (24 seeded entries: 5 app seats, 1 storage, 1 retention, 12 compliance, 5 add-ons), `license_audit` (all license changes logged), `tenant_auth_config` (per-tenant MFA, SSO, session timeout, invitation expiry, HIPAA mode). 9 functions: `deactivate_user`, `request_user_deletion`, `cancel_user_deletion`, `check_tenant_license`, `get_available_seats`, `consume_seat`, `release_seat`, `reserve_seat`, `activate_reserved_seat`. Updates `user_admin_actions` with 18 action types including licensing events. Drops `tenant_users`, `users_by_tenant` view. RLS on all new tables.
16. **V2026_02_06_007__model_weights_drift_correction_admin_ai.sql** - Model Weights, Drift Correction & Admin AI Helper (v7.24.0). 6 tables: `model_weight_config` (per-tenant per-model 5-factor composite weights with quarantine/fallback/correction), `model_weight_history` (weight calculation audit trail), `drift_correction_actions` (correction action log), `bedrock_model_registry` (global discovered Bedrock models), `admin_ai_helper_config` (per-tenant AI helper settings with auto-upgrade and polling), `admin_ai_helper_conversations` (conversation history). 5 functions: `calculate_composite_weight`, `apply_drift_penalty`, `quarantine_model`, `unquarantine_model`, `get_weighted_models`. RLS on tenant-scoped tables. Auto-update trigger on model_weight_config.

---

## 3.2.2 MLS (Message Layer Security) RFC 9420 Implementation

RFC 9420-inspired group encryption for secure agent-to-agent communication. Provides cryptographic guarantees essential for multi-agent AI systems where agents communicate across trust boundaries.

### Why MLS for Agent-to-Agent Communication?

| Challenge | MLS Solution |
|-----------|--------------|
| Agents join/leave dynamically | Epoch-based key rotation on membership changes |
| Need end-to-end encryption | AES-256-GCM authenticated encryption |
| Key compromise recovery | Post-compromise security via key updates |
| Audit requirements | All operations logged with cryptographic binding |
| Multi-tenant isolation | RLS on all tables with tenant_id |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     MLS Group Encryption                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                │
│  │ Agent A  │     │ Agent B  │     │ Agent C  │                │
│  │ (leaf 0) │     │ (leaf 1) │     │ (leaf 2) │                │
│  └────┬─────┘     └────┬─────┘     └────┬─────┘                │
│       │                │                │                        │
│       └────────────────┼────────────────┘                        │
│                        │                                         │
│                        ▼                                         │
│           ┌────────────────────────┐                            │
│           │     Ratchet Tree       │                            │
│           │  (Key Agreement Tree)  │                            │
│           └────────────┬───────────┘                            │
│                        │                                         │
│                        ▼                                         │
│           ┌────────────────────────┐                            │
│           │     Group Secret       │                            │
│           │   (Epoch-specific)     │                            │
│           └────────────┬───────────┘                            │
│                        │                                         │
│         ┌──────────────┼──────────────┐                         │
│         ▼              ▼              ▼                         │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│   │ Message  │  │ Confirm  │  │  Epoch   │                     │
│   │   Key    │  │   Key    │  │  Secret  │                     │
│   └──────────┘  └──────────┘  └──────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Service Files

| File | Purpose | Lines |
|------|---------|-------|
| `lambda/shared/services/mls/mls.service.ts` | Core MLS implementation | 936 |
| `lambda/shared/services/mls/index.ts` | Module exports | 14 |
| `lambda/admin/mls.ts` | Admin API endpoints | 551 |
| `migrations/140_mls_message_layer_security.sql` | Database schema | ~300 |

### Database Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `mls_key_packages` | key_package_id, member_id, member_type, public_key, signature_key, private_key_encrypted, sig_private_key_encrypted, credential, cipher_suite, created_at, expires_at, revoked_at | X25519/Ed25519 key packages |
| `mls_groups` | group_id, tenant_id, name, cipher_suite, epoch, tree_hash, confirmation_key, group_secret_encrypted, created_at, updated_at, expires_at | Group state with epoch tracking |
| `mls_group_members` | id, group_id, member_id, member_type, key_package_id, public_key, leaf_index, added_at, added_by, removed_at, removed_by | Membership and ratchet tree positions |
| `mls_commits` | commit_id, group_id, epoch, proposal_type, proposer_id, target_member_id, signature, created_at | State change proposals (add/remove/update) |
| `mls_messages` | message_id, group_id, epoch, sender_id, content_type, ciphertext, iv, auth_tag, signature, sent_at | Encrypted messages |
| `mls_epoch_secrets` | id, group_id, epoch, secret_encrypted, created_at, expires_at | Per-epoch secrets for forward secrecy |
| `mls_audit_log` | id, tenant_id, action, group_id, member_id, performed_by, details, ip_address, user_agent, created_at | Operation audit trail |

### Cryptographic Primitives

| Primitive | Algorithm | Purpose |
|-----------|-----------|---------|
| Key Exchange | X25519 | ECDH key agreement between members |
| Encryption | AES-256-GCM | Authenticated encryption of messages |
| Signatures | Ed25519 | Signing commits and messages |
| Key Derivation | HKDF-SHA256 | Deriving epoch and message keys |
| Hashing | SHA-256 | Tree hashing, content binding |

### Security Properties

| Property | Implementation | Benefit |
|----------|----------------|---------|
| **Forward Secrecy** | HKDF key ratcheting per epoch | Past messages protected if current key compromised |
| **Post-Compromise Security** | Key updates increment epoch, rotate all secrets | System heals after temporary compromise |
| **Group Key Agreement** | Ratchet tree structure (O(log n) updates) | Efficient key distribution without n² exchanges |
| **Authenticated Encryption** | AES-256-GCM with Ed25519 signatures | Confidentiality + integrity + authenticity |
| **Transcript Integrity** | Epoch binding prevents replay | Messages can't be reordered or replayed |

### Epoch Lifecycle

```
Epoch 0 (Group Created)
    │
    ├─── Add Member B ───────► Epoch 1
    │
    ├─── Add Member C ───────► Epoch 2
    │
    ├─── Member B Updates Key ─► Epoch 3  (Post-Compromise Security)
    │
    ├─── Remove Member A ─────► Epoch 4
    │
    └─── Messages encrypted with Epoch 4 secrets
```

### Admin API Endpoints

| Endpoint | Method | Description | Request Body |
|----------|--------|-------------|--------------|
| `/api/admin/mls/dashboard` | GET | Dashboard stats | - |
| `/api/admin/mls/key-packages` | POST | Create key package | `{memberId, memberType, credential, cipherSuite?, validityDays?}` |
| `/api/admin/mls/key-packages/:id` | GET | Get key package | - |
| `/api/admin/mls/groups` | GET | List groups | - |
| `/api/admin/mls/groups` | POST | Create group | `{name, creatorMemberId, cipherSuite?, expiresAt?}` |
| `/api/admin/mls/groups/:id` | GET | Get group with members | - |
| `/api/admin/mls/groups/:id/members` | POST | Add member (increments epoch) | `{memberId, addedBy}` |
| `/api/admin/mls/groups/:id/members/:mid` | DELETE | Remove member (increments epoch) | `{removedBy}` |
| `/api/admin/mls/groups/:id/update-key` | POST | Update key (post-compromise) | `{memberId}` |
| `/api/admin/mls/groups/:id/messages` | GET | Get encrypted messages | `?limit=100` |
| `/api/admin/mls/groups/:id/messages` | POST | Send encrypted message | `{senderId, content}` |
| `/api/admin/mls/audit` | GET | Audit log | `?limit=100&action=&groupId=` |

### Integration with A2A Protocol

MLS provides the encryption layer for RADIANT's Agent-to-Agent (A2A) protocol:

```typescript
// Create secure agent collaboration group
const group = await mlsService.createGroup(tenantId, "Task Force Alpha", "agent-orchestrator");

// Add participating agents
await mlsService.addMember(group.groupId, "agent-researcher", "agent-orchestrator");
await mlsService.addMember(group.groupId, "agent-validator", "agent-orchestrator");

// Encrypted task distribution
await mlsService.encryptForGroup(
  group.groupId, 
  "agent-orchestrator",
  Buffer.from(JSON.stringify({ task: "analyze", data: sensitiveData }))
);

// Agent compromise recovery
await mlsService.updateKey(group.groupId, "agent-researcher"); // Rotates all secrets
```

---

## 3.2.1 Cartridge PKI KMS Integration (PROMPT-42)

Real AWS KMS asymmetric signing for `.RADz` cartridge PKI system, replacing placeholder strings with production-ready cryptographic operations.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CARTRIDGE PKI - REAL KMS ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Security Stack (CDK)                                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  cartridgeSigningKey: kms.Key                                          │ │
│  │  ├── KeySpec: ECC_NIST_P256 (ECDSA)                                   │ │
│  │  ├── KeyUsage: SIGN_VERIFY                                            │ │
│  │  └── Alias: ${appId}-${env}-cartridge-signing                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  CartridgePKIService                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  generateTenantCA() → CreateKeyCommand → GetPublicKeyCommand          │ │
│  │  createSigningKey() → CreateKeyCommand → GetPublicKeyCommand          │ │
│  │  signArtifact()     → SignCommand (ECDSA_SHA_256)                     │ │
│  │  verifySignature()  → VerifyCommand                                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### CDK Changes

| Stack | Resource | Purpose |
|-------|----------|---------|
| `SecurityStack` | `cartridgeSigningKey` (ECC_NIST_P256) | Platform root CA for cartridge signing |
| `ApiStack` | `RADIANT_PLATFORM_SIGNING_KEY_ID` env var | Lambda access to signing key |
| `ApiStack` | `RADIANT_PLATFORM_SIGNING_KEY_ARN` env var | Full ARN for cross-account access |

### IAM Policies

| Policy | Actions | Condition |
|--------|---------|-----------|
| Platform Key Usage | `kms:Sign`, `kms:Verify`, `kms:GetPublicKey`, `kms:DescribeKey` | Platform key only |
| Tenant Key Creation | `kms:CreateKey`, `kms:TagResource`, `kms:CreateAlias` | `KeySpec=ECC_NIST_P256`, `KeyUsage=SIGN_VERIFY` |

### Service Changes

| Method | Implementation | KMS Commands |
|--------|----------------|--------------|
| `generateTenantCA()` | Create tenant CA signed by platform root | `CreateKeyCommand` → `GetPublicKeyCommand` → `SignCommand` |
| `createSigningKey()` | Create purpose-specific key signed by tenant CA | `CreateKeyCommand` → `GetPublicKeyCommand` → `SignCommand` |
| `signArtifact()` | Sign cartridge content | `SignCommand` (ECDSA_SHA_256) |
| `verifySignature()` | Verify cartridge signature | `VerifyCommand` |

### Key Hierarchy

```
Platform Root CA (KMS ECC_NIST_P256)
├── Created in CDK SecurityStack
├── Signs Tenant CA certificates
├── Key ID: RADIANT_PLATFORM_SIGNING_KEY_ID
└── RETAIN policy in production

Tenant CA Keys (KMS ECC_NIST_P256)  
├── Created dynamically per tenant via generateTenantCA()
├── Signed by Platform Root CA
├── Signs cartridge artifacts (.RADz files)
└── Stored in tenant_ca_certificates table

Signing Keys (KMS ECC_NIST_P256)
├── Purpose: author, publisher, validator, custom
├── Created dynamically via createSigningKey()
├── Signed by Tenant CA
└── Stored in cartridge_signing_keys table
```

### Database Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `tenant_ca_certificates` | Tenant CA certificates | `key_id`, `key_arn`, `fingerprint`, `root_signature`, `status` |
| `cartridge_signing_keys` | Purpose-specific signing keys | `key_id`, `purpose`, `ca_signature`, `status` |
| `pki_audit_log` | PKI operations audit (partitioned) | `operation`, `resource_id`, `success`, `details` |

### Security Considerations

| Consideration | Mitigation |
|---------------|------------|
| **Key Rotation** | Asymmetric keys don't auto-rotate; manual rotation requires certificate reissuance |
| **Key Deletion** | Extended pending window (30 days prod, 7 days dev); RETAIN removal policy |
| **Tenant Isolation** | Each tenant gets own KMS key; RLS on all tables |
| **Audit Trail** | All PKI ops logged to partitioned `pki_audit_log` |
| **Least Privilege** | IAM conditions restrict key creation to ECC_NIST_P256 + SIGN_VERIFY |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `RADIANT_PLATFORM_SIGNING_KEY_ID` | KMS Key ID for platform root CA |
| `RADIANT_PLATFORM_SIGNING_KEY_ARN` | KMS Key ARN for platform root CA |

### Implementation Files

| File | Purpose |
|------|---------|
| `lib/stacks/security-stack.ts` | CDK asymmetric key definition |
| `lambda/shared/services/cartridge-pki.service.ts` | PKI service with real KMS |
| `migrations/139_cartridge_pki_kms.sql` | Database schema for PKI keys |

### Admin API

**Base URL**: `/api/admin/pki` — 10 endpoints for tenant CA management, signing keys, verification, and audit.

### Verification Checklist

- [ ] CDK synth shows `CartridgeSigningKey` resource with ECC_NIST_P256
- [ ] Lambda environment includes `RADIANT_PLATFORM_SIGNING_KEY_ID` and `_ARN`
- [ ] `generateTenantCA()` creates real KMS key (no PLACEHOLDER strings)
- [ ] `createSigningKey()` creates real KMS key signed by tenant CA
- [ ] Cartridge signatures verify via `VerifyCommand`

---

## 2.9 Autonomous Organism Architecture (PROMPT-43) - v6.6.0

**Project Metamorphosis** — Self-evolving AI system with neural routing, auto-tool generation, and predictive user modeling.

### Core Services

| Service | File | Purpose |
|---------|------|---------|
| **MCP Server Manager** | `mcp-server-manager.service.ts` | Neural Affinity Routing for MCP servers |
| **Neural Schema Registry** | `neural-schema-registry.service.ts` | Tool embeddings for intelligent discovery |
| **Genesis Auto-Tool** | `genesis-auto-tool.service.ts` | On-demand tool generation from APIs |
| **Liquid Compute** | `liquid-compute.service.ts` | Dynamic compute location selection |
| **Ghost Simulation** | `ghost-simulation.service.ts` | User digital twin for prediction |
| **Tensor-Link** | `tensor-link.service.ts` | Vector-based transport protocol |
| **Economic Cortex** | `economic-cortex.service.ts` | Autonomous budget management |
| **Organism Integration** | `organism-integration.service.ts` | BrainRouter integration layer |

**Location**: `lambda/shared/services/organism/`

### Database Tables (Migration V2026_02_03_001)

| Table | Purpose |
|-------|---------|
| `mcp_servers` | MCP server registry with neural embeddings |
| `mcp_tool_schemas` | Tool schemas with neural signatures |
| `mcp_routing_decisions` | Routing decision audit log |
| `genesis_tool_requests` | Tool generation requests |
| `genesis_tool_results` | Generated tool code and validation |
| `genesis_api_discovery_cache` | Cached API discovery results |
| `liquid_compute_topologies` | Compute topology per tenant |
| `liquid_compute_decisions` | Compute location decisions |
| `ghost_vectors` | User digital twin vectors (4096-dim) |
| `ghost_simulations` | Simulation results and predictions |
| `ghost_calibrations` | Prediction accuracy calibration |
| `ghost_user_interactions` | User interaction training data |
| `organism_telemetry` | System health telemetry |
| `economic_cortex_configs` | Budget configuration |
| `economic_cortex_budgets` | Multi-scope budgets |
| `economic_cortex_alerts` | Budget alert thresholds |
| `economic_cortex_negotiations` | Cost negotiation history |
| `economic_cortex_spending` | Spending analytics |

### Admin API

**Base URL**: `/api/admin/organism`

| Endpoint Group | Routes |
|----------------|--------|
| **Dashboard** | `GET /dashboard` |
| **MCP Servers** | `GET/POST /mcp-servers`, `GET/PUT/DELETE /mcp-servers/:id`, `POST /mcp-servers/discover`, `POST /mcp-servers/route` |
| **Tools** | `GET/POST /tools`, `GET /tools/:id`, `POST /tools/search`, `POST /tools/find-by-intent`, `POST /tools/:id/execution` |
| **Genesis** | `GET/POST /genesis/requests`, `GET /genesis/requests/:id`, `GET /genesis/requests/:id/result` |
| **Compute** | `GET/PUT /compute/topology`, `POST /compute/browser-capabilities`, `POST /compute/local-capabilities`, `POST /compute/select` |
| **Ghost** | `GET /ghost/stats`, `GET /ghost/simulations`, `POST /ghost/simulate`, `GET /ghost/vectors/:userId`, `POST /ghost/calibrate` |
| **Economic** | `GET/PUT /economic/config`, `GET /economic/budgets`, `GET /economic/analytics`, `POST /economic/negotiate`, `POST /economic/recommend-model` |

### Admin Dashboard

**Route**: `/platform/organism`

| Tab | Features |
|-----|----------|
| **Overview** | Server health, tool counts, compute distribution, ghost stats |
| **MCP Servers** | Server list, health status, latency, domain affinity |
| **Tools** | Tool schema browser, search, metrics |
| **Genesis** | Tool generation form, request history |
| **Compute** | Browser/local capabilities, sensitivity rules |
| **Ghost** | Simulation runner, prediction stats, calibration |

### Key Features

| Feature | Description |
|---------|-------------|
| **Neural Affinity Routing** | Semantic tool selection using 1536-dim embeddings |
| **Genesis Pipeline** | API discovery → code gen → sandbox validation → deploy |
| **Liquid Compute** | Browser/Local/Edge/Cloud selection based on privacy + cost |
| **Ghost Vectors** | 4096-dim user digital twins with component vectors |
| **Economic Negotiation** | Autonomous cost optimization with 3 strategies |

### Shared Types

**File**: `packages/shared/src/types/autonomous-organism.types.ts`

~500 lines of TypeScript types for MCP protocol, neural routing, ghost simulation, and economic cortex.

---

## 3.3 New Admin Dashboard Pages

| Route | Module | Purpose |
|-------|--------|---------|
| `/sovereign-mesh` | Dashboard | Overview metrics |
| `/sovereign-mesh/agents` | Agent Registry | Manage agent definitions |
| `/sovereign-mesh/agents/[id]` | Agent Registry | Agent detail + executions |
| `/sovereign-mesh/apps` | App Registry | Browse 3,000+ apps |
| `/sovereign-mesh/apps/[id]` | App Registry | App detail + AI config |
| `/sovereign-mesh/transparency` | Transparency | Decision explorer |
| `/sovereign-mesh/transparency/[id]` | Transparency | Decision detail + War Room |
| `/sovereign-mesh/approvals` | HITL | Approval queue |
| `/sovereign-mesh/ai-helper` | AI Helper | System configuration |
| `/orchestration/inference-cache` | Inference Cache | Hit rate, cost savings, events, model breakdown, config |
| `/orchestration/consensus` | Consensus | Agreement scores, evaluations, model leaderboard, test runner, config |
| `/orchestration/model-weights` | Model Weights | Drift correction, composite weights, quarantine management |
| `/orchestration/templates` | Templates | User-saved workflow templates with categories and duplication |
| `/platform/bedrock-settings` | Bedrock | Model discovery, auto-upgrade, polling config |
| `/platform/uds` | UDS | User Data Service: encryption, audit, GDPR erasure, tier management |
| `/platform/mls` | MLS | RFC 9420 group encryption: groups, key packages, audit |
| `/platform/state-registry` | State Registry | Environment manifests, sync operations, backups |
| `/platform/cartridge-operations` | Cartridges | Cartridge operations management |
| `/platform/crucible` | Crucible | Testing sandbox and validation |
| `/platform/deployer-sync` | Deployer Sync | Swift Deployer synchronization |
| `/platform/livs` | LIVS | Live verification system |
| `/platform/organism` | Organism | Autonomous organism architecture |
| `/platform/pki` | PKI | Certificate and key management |
| `/platform/rnir` | RNIR | Neural inference routing |
| `/platform/snapshots` | Snapshots | System state snapshots |
| `/platform/vault` | Vault | Secure secret storage |
| `/cato/council` | Council of Rivals | Multi-agent adversarial debate management |
| `/cato/dialogue` | Cato Dialogue | Consciousness dialogue sessions |
| `/cato/cognitive-precision` | Cognitive Precision | Context anchoring, negative constraints, critic separation |
| `/cato/governance` | Governance | Policy and governance management |
| `/cato/livs-policy` | LIVS Policy | Live verification policy configuration |
| `/cato/safety` | Safety | Cato safety configuration |
| `/cato/war-room` | War Room | Critical incident management |
| `/reports/dynamic` | Dynamic Reports | Schema-adaptive report builder |
| `/reports/scheduled` | Scheduled Reports | Automated report generation |
| `/memory/anticipatory` | Anticipatory Memory | Predictive prefetch, contradiction detection |
| `/memory/retention` | Memory Retention | Retention policies and lifecycle management |

#### Cross-App Delight UX System (v7.27.0 + v7.28.0)

| Package / File | Purpose |
|----------------|---------|
| `packages/delight-ui/` | `@radiant/delight-ui` — Shared React Delight provider, hook, toast, types |
| `packages/delight-ui/src/RadiantDelightProvider.tsx` | Universal provider with personality modes, injection points, toast UI |
| `packages/delight-ui/src/types.ts` | PersonalityMode, InjectionPoint, DisplayStyle, AppDelightConfig |
| `packages/delight-ui/src/animations.ts` | Personality-aware animation configs, morph narration, spring constants |
| `packages/delight-ui/src/sounds.ts` | Web Audio API sound synthesis — no mp3 files needed |
| `apps/thinktank/app/providers.tsx` | Think Tank delight config + RadiantDelightProvider wrapping |
| `apps/thinktank/lib/hooks/useDelightSync.ts` | Settings sync hook (Zustand → backend preferences API) |
| `apps/curator/app/providers.tsx` | Curator delight config (ingest, verify, graph UX touches) |
| `apps/dojo/app/providers.tsx` | Dojo delight config (sparring, mastery, belt-earned messages) |
| `apps/thinktank-admin/app/providers.tsx` | TT Admin delight config (config saves, user mgmt, delight publishing) |
| `apps/thinktank-tenant-admin/app/providers.tsx` | Tenant Admin delight config (invitations, security, org management) |
| `.windsurf/workflows/delight-ux-policy.md` | Enforcement policy — all apps MUST integrate Delight |

#### Delight ↔ Polymorphic UI Integration (v7.28.0)

| Component | File | Delight Integration |
|-----------|------|---------------------|
| `ViewRouter` | `apps/thinktank/components/polymorphic/view-router.tsx` | Mode switch/escalation triggers delight + synth sounds |
| `ViewMorphTransition` | Same file | Animation spring constants adapt to personality mode |
| `LiquidMorphPanel` | `apps/thinktank/components/liquid/LiquidMorphPanel.tsx` | Open/close animations use personality-aware configs |
| `MorphTransitionEffect` | Same file | Personality narration, suppressed in professional/subtle modes |
| Chat page | `apps/thinktank/app/(chat)/page.tsx` | Full lifecycle: pre/during/post execution, error, session, morph |

#### Delight ↔ Dojo Integration (v7.29.0)

| Component | Actions Wired | Injection Points |
|-----------|--------------|-----------------|
| `LibraryView` | Create library, upload/delete doc, discover themes | `action_complete`, `milestone` |
| `TrainingArena` | Start session, submit answer, complete session | `session_start`, `action_complete`, `milestone` |
| `ScenarioArena` | Start/respond/conclude scenario | `session_start`, `action_complete`, `milestone` |
| `DialecticArena` | Start/respond/conclude dialectic | `session_start`, `action_complete`, `milestone` |
| `DecayEngine` | Trigger reinforcement, submit answer | `session_start`, `action_complete` |
| `ArchytasSettings` | Update config (tools, sandbox, limits) | `action_complete` |
| `CompetencyMesh` | Extract competencies | `milestone` |

#### Delight Tenant Governance (v7.29.0)

| Control | Type | Location | Effect |
|---------|------|----------|--------|
| `tenantDelightEnabled` | `boolean` | Tenant Admin → Settings | Master kill switch for all delight output |
| `tenantDefaultMode` | `PersonalityMode` | Tenant Admin → Settings | Force mode for all users (e.g., `professional` for law firms) |
| `tenantAllowUserOverride` | `boolean` | Tenant Admin → Settings | Lock users to tenant mode when `false` |

#### Comprehensive Documentation (v7.29.0)

| Document | Sections | Coverage |
|----------|----------|----------|
| `docs/POLYMORPHIC-LIQUID-UI-GUIDE.md` | 15 sections | Full guide: Polymorphic UI, Liquid UI, Delight integration, animations, sounds, settings, tenant controls, guest behavior, API reference |

#### Guest Collaboration Policy (v7.30.0)

| Component | Location | Purpose |
|-----------|----------|---------|
| `tenant_collaboration_settings` | Migration 008 | Per-tenant guest access, prompt execution, file permissions, cost attribution, cross-tenant settings |
| `guest_cost_attribution_log` | Migration 008 | Every guest AI action with cost breakdown, cross-tenant splits |
| `guest_compliance_restriction_log` | Migration 008 | Audit trail of compliance-restricted guest actions |
| `CollaborationPolicyService` | `lambda/shared/services/collaboration-policy.service.ts` | Compliance gates, capability resolution, cost attribution routing |
| `GuestRestrictionBanner` | `apps/thinktank/components/collaboration/GuestRestrictionBanner.tsx` | UI notification when features disabled by compliance |
| `guardGuestPrompt()` | `lambda/shared/middleware/guest-prompt-guard.ts` | Pre-execution guard: checks permissions, limits, resolves attribution |
| `recordGuestPromptUsage()` | `lambda/shared/middleware/guest-prompt-guard.ts` | Post-execution: logs cost attribution, updates guest running totals |
| Collaboration Settings Page | `apps/thinktank-tenant-admin/app/(dashboard)/collaboration/page.tsx` | Tenant admin UI for all guest collaboration controls |
| Per-user rollup | `lambda/billing/metering.ts` → `radiant-user-usage-rollups` DynamoDB | Costs tracked per-user (incl. guest-originated), aggregated to tenant |
| `GET /metering/user-rollups` | `lambda/billing/metering.ts` | Per-user cost breakdown with guest-originated subtotals |
| `GET /metering/guest-usage` | `lambda/billing/metering.ts` | Aggregate guest cost attribution from `guest_cost_attribution_log` |

**Permission → Capability Matrix:**

| Permission | View | Comment | Edit | Prompts | Upload | Download | Branch | Roundtable |
|------------|------|---------|------|---------|--------|----------|--------|------------|
| `viewer` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅* | ❌ | ❌ |
| `commenter` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅* | ❌ | ✅* |
| `editor` | ✅ | ✅ | ✅ | ✅** | ✅** | ✅* | ✅* | ✅* |

*\* Disabled when compliance licenses active and `compliance_auto_restrict=true`*
*\*\* Requires explicit tenant opt-in (`guestPromptExecutionEnabled=true`)*

**Cost Attribution Modes:**

| Mode | Description |
|------|-------------|
| `inviting_user` (default) | All guest costs billed to the user who created the invite |
| `session_owner` | Costs billed to the collaborative session creator |
| `tenant_pool` | Costs attributed to shared tenant pool |
| `cross_tenant_split` | Auto-activated when guest is from another tenant and splitting enabled |

#### Log Retention Advanced System (v7.32.0)

| Component | Location | Purpose |
|-----------|----------|---------|
| `log_reports` | Migration 010 | Generated retention/compliance reports with S3 storage |
| `log_glacier_restore_jobs` | Migration 010 | Batch Glacier restore with progress tracking |
| `log_export_jobs` | Migration 010 | Bulk log export jobs with download URLs |
| `log_merkle_chain` | Migration 010 | Tamper-evident SHA-256 Merkle hash chain |
| `log_erasure_requests` | Migration 010 | GDPR Article 17 erasure with exemption enforcement |
| `log_search_entries` | Migration 010 | Hot-tier full-text search index (tsvector + GIN) |
| `check_log_erasure_exemptions()` | Migration 010 | PG function: checks immutable categories against compliance licenses |
| `LogReportService` | `lambda/shared/services/log-report.service.ts` | 5 report types: compliance_summary, retention_audit, storage_forecast, source_coverage, gdpr_data_map |
| `LogGlacierRestoreService` | `lambda/shared/services/log-glacier-restore.service.ts` | Batch restore from Glacier/Deep Archive, 3 retrieval tiers, progress tracking |
| `LogExportService` | `lambda/shared/services/log-export.service.ts` | Bulk export (all time / date range), JSON/CSV/JSONL formats, pre-signed downloads |
| `LogTamperVerificationService` | `lambda/shared/services/log-tamper-verification.service.ts` | Merkle chain: add entries, verify single/segment/full chain |
| `LogGdprErasureService` | `lambda/shared/services/log-gdpr-erasure.service.ts` | Multi-tier erasure, auto-exemption, erasure certificate hash |
| `LogRetentionStack` | `lib/stacks/log-retention-stack.ts` | CDK: 3 S3 buckets, KMS key, 2 Lambdas, hourly EventBridge |
| Log Retention Admin UI | `apps/admin-dashboard/app/(dashboard)/log-retention/page.tsx` | 10-tab admin page |

**Admin API (16 new endpoints):**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/search` | Full-text search hot-tier logs |
| `GET` | `/reports` | List generated reports |
| `POST` | `/reports` | Generate a new report |
| `GET` | `/reports/:id/download` | Pre-signed download URL |
| `GET` | `/restore/jobs` | List Glacier restore jobs |
| `POST` | `/restore/jobs` | Create restore job |
| `POST` | `/restore/jobs/:id/process` | Process a restore job |
| `GET` | `/export/jobs` | List export jobs |
| `POST` | `/export/jobs` | Create export job |
| `GET` | `/export/jobs/:id/download` | Export download URL |
| `GET` | `/verification/status` | Merkle chain status |
| `POST` | `/verification/verify-full` | Verify full Merkle chain |
| `GET` | `/erasure/requests` | List erasure requests |
| `POST` | `/erasure/requests` | Create erasure request |
| `POST` | `/erasure/requests/:id/approve` | Approve erasure |
| `POST` | `/erasure/requests/:id/execute` | Execute approved erasure |

**CDK Infrastructure:**

| Resource | Name | Config |
|----------|------|--------|
| S3 Bucket | `radiant-log-archives` | Versioned, KMS, Glacier at 90d, Deep Archive at 7yr |
| S3 Bucket | `radiant-log-reports` | KMS, IA at 90d, Glacier at 1yr |
| S3 Bucket | `radiant-log-exports` | KMS, 7-day auto-expiry |
| KMS Key | `radiant-log-encryption` | Auto-rotation, RETAIN |
| Lambda | `radiant-log-indexer` | 15 min timeout, 1 GB, hourly EventBridge |
| Lambda | `radiant-log-retention-admin` | 5 min timeout, full S3/DB access |
| EventBridge | Hourly indexer rule | 2 retry attempts |

#### Think Tank Tenant Admin Pages (v7.26.0)

| Route | Feature | Key Functionality |
|-------|---------|-------------------|
| `/` | Dashboard | Overview with quick action cards |
| `/users` | Team Members | User management, invitations, role assignment, MFA status |
| `/cartridges` | Cartridges | Tenant cartridge management (system read-only) |
| `/reports` | Reports | Usage analytics, report generation (usage/users/billing) |
| `/settings` | Settings | Org name, timezone, language, theme, notifications, data limits |
| `/security` | Security | MFA enforcement, session/lockout config, password policy, event log |

#### Think Tank App Navigation (v7.26.0)

| Route | Nav Location | Notes |
|-------|-------------|-------|
| `/` (chat) | Main view | Default landing page |
| `/rules` | Quick Links | User-defined AI rules |
| `/history` | Quick Links | Conversation history |
| `/artifacts` | Quick Links | Shared artifacts (newly linked v7.26.0) |
| `/settings` | Quick Links | User preferences |
| `/profile` | User avatar | Profile management |
| `/simulator` | Advanced Links | Simulation tool with ADV badge (v7.26.0) |

---

## 3.4 New Lambda Functions

| Function | Schedule | Module |
|----------|----------|--------|
| `app-registry-sync` | Daily 2 AM UTC | App Registry |
| `hitl-sla-monitor` | Every minute | HITL |
| `sovereign-mesh` | API Gateway | Admin API |

---

# PART 4: API REFERENCE

## 4.1 Agent APIs

```
POST   /api/admin/sovereign-mesh/agents              Create agent definition
GET    /api/admin/sovereign-mesh/agents              List agents
GET    /api/admin/sovereign-mesh/agents/:id          Get agent
PUT    /api/admin/sovereign-mesh/agents/:id          Update agent
DELETE /api/admin/sovereign-mesh/agents/:id          Delete agent

POST   /api/admin/sovereign-mesh/executions          Start execution
GET    /api/admin/sovereign-mesh/executions          List executions
GET    /api/admin/sovereign-mesh/executions/:id      Get execution
POST   /api/admin/sovereign-mesh/executions/:id/cancel  Cancel execution
POST   /api/admin/sovereign-mesh/executions/:id/resume  Resume paused execution
```

## 4.2 App APIs

```
GET    /api/admin/sovereign-mesh/apps                List apps (paginated)
GET    /api/admin/sovereign-mesh/apps/:id            Get app detail
PUT    /api/admin/sovereign-mesh/apps/:id/ai-config  Update AI config
GET    /api/admin/sovereign-mesh/apps/sync/status    Get sync status
POST   /api/admin/sovereign-mesh/apps/sync/trigger   Trigger sync

GET    /api/admin/sovereign-mesh/connections         List tenant connections
DELETE /api/admin/sovereign-mesh/connections/:id     Delete connection
```

## 4.3 Transparency APIs

```
GET    /api/admin/sovereign-mesh/decisions           List decision events
GET    /api/admin/sovereign-mesh/decisions/:id       Get decision detail
GET    /api/admin/sovereign-mesh/decisions/:id/explanation  Get explanation
GET    /api/admin/sovereign-mesh/decisions/:id/war-room     Get deliberations
```

## 4.4 HITL APIs

```
GET    /api/admin/sovereign-mesh/approvals           List pending approvals
GET    /api/admin/sovereign-mesh/approvals/queues    List queues
GET    /api/admin/sovereign-mesh/approvals/:id       Get approval detail
POST   /api/admin/sovereign-mesh/approvals/:id/approve   Approve request
POST   /api/admin/sovereign-mesh/approvals/:id/reject    Reject request
POST   /api/admin/sovereign-mesh/approvals/:id/escalate  Escalate request
```

## 4.5 AI Helper APIs

```
GET    /api/admin/sovereign-mesh/ai-helper/config    Get configuration
PUT    /api/admin/sovereign-mesh/ai-helper/config    Update configuration
GET    /api/admin/sovereign-mesh/ai-helper/usage     Get usage statistics
```

## 4.6 Dashboard API

```
GET    /api/admin/sovereign-mesh/dashboard           Get overview metrics
```

## 4.7 AI Reports APIs (v5.42.0)

```
GET    /api/admin/ai-reports                         List reports (paginated)
POST   /api/admin/ai-reports/generate                Generate new report with AI
GET    /api/admin/ai-reports/:id                     Get report by ID
PUT    /api/admin/ai-reports/:id                     Update report
DELETE /api/admin/ai-reports/:id                     Delete report
POST   /api/admin/ai-reports/:id/export              Export to PDF/Excel/HTML/JSON

GET    /api/admin/ai-reports/templates               List templates
POST   /api/admin/ai-reports/templates               Create template

GET    /api/admin/ai-reports/brand-kits              List brand kits
POST   /api/admin/ai-reports/brand-kits              Create brand kit
PUT    /api/admin/ai-reports/brand-kits/:id          Update brand kit
DELETE /api/admin/ai-reports/brand-kits/:id          Delete brand kit

POST   /api/admin/ai-reports/chat                    Send chat message for modifications
GET    /api/admin/ai-reports/insights                Get insights dashboard
```

---

## 4.8 RAWS APIs (v1.1)

```
POST   /api/admin/raws/select              Select optimal model
GET    /api/admin/raws/profiles            List all 13 weight profiles
POST   /api/admin/raws/profiles            Create custom profile
GET    /api/admin/raws/profiles/:id        Get profile details
GET    /api/admin/raws/models              List available models
GET    /api/admin/raws/models/:id          Get model details
GET    /api/admin/raws/domains             List 7 domain configurations
POST   /api/admin/raws/detect-domain       Test domain detection
GET    /api/admin/raws/health              Provider health status
GET    /api/admin/raws/audit               Selection audit log
```

---

# PART 5: RAWS v1.1 - MODEL SELECTION SYSTEM

## 5.1 Overview

RAWS (RADIANT AI Weighted Selection) provides intelligent real-time model selection using:

| Component | Count | Description |
|-----------|-------|-------------|
| Dimensions | 8 | Quality, Cost, Latency, Capability, Reliability, Compliance, Availability, Learning |
| Profiles | 13 | 4 Optimization + 6 Domain + 3 SOFAI |
| Domains | 7 | Healthcare, Financial, Legal, Scientific, Creative, Engineering, General |
| Models | 106+ | 50 external APIs + 56 self-hosted |

## 5.2 Weight Profiles

| Profile | Category | Q | C | L | K | R | P | A | E |
|---------|----------|-----|-----|-----|-----|-----|-----|-----|-----|
| BALANCED | Optimization | 0.25 | 0.20 | 0.15 | 0.15 | 0.10 | 0.05 | 0.05 | 0.05 |
| QUALITY_FIRST | Optimization | 0.40 | 0.10 | 0.10 | 0.15 | 0.10 | 0.05 | 0.05 | 0.05 |
| COST_OPTIMIZED | Optimization | 0.20 | 0.35 | 0.15 | 0.10 | 0.05 | 0.05 | 0.05 | 0.05 |
| LATENCY_CRITICAL | Optimization | 0.15 | 0.10 | 0.35 | 0.15 | 0.10 | 0.05 | 0.05 | 0.05 |
| HEALTHCARE | Domain | 0.30 | 0.05 | 0.10 | 0.15 | 0.10 | 0.20 | 0.05 | 0.05 |
| FINANCIAL | Domain | 0.30 | 0.10 | 0.10 | 0.15 | 0.10 | 0.15 | 0.05 | 0.05 |
| LEGAL | Domain | 0.35 | 0.05 | 0.05 | 0.20 | 0.10 | 0.15 | 0.05 | 0.05 |
| SCIENTIFIC | Domain | 0.35 | 0.10 | 0.10 | 0.20 | 0.08 | 0.05 | 0.05 | 0.07 |
| CREATIVE | Domain | 0.20 | 0.25 | 0.20 | 0.15 | 0.05 | 0.00 | 0.05 | 0.10 |
| ENGINEERING | Domain | 0.30 | 0.15 | 0.15 | 0.20 | 0.10 | 0.00 | 0.05 | 0.05 |
| SYSTEM_1 | SOFAI | 0.15 | 0.30 | 0.30 | 0.10 | 0.05 | 0.00 | 0.05 | 0.05 |
| SYSTEM_2 | SOFAI | 0.35 | 0.10 | 0.10 | 0.15 | 0.10 | 0.10 | 0.05 | 0.05 |
| SYSTEM_2_5 | SOFAI | 0.40 | 0.05 | 0.05 | 0.20 | 0.10 | 0.10 | 0.05 | 0.05 |

## 5.3 Domain Compliance Matrix

| Domain | Required | Optional | Truth Engine | ECD |
|--------|----------|----------|--------------|-----|
| healthcare | HIPAA | FDA 21 CFR Part 11 | Required | 0.05 |
| financial | SOC 2 Type II | PCI-DSS, GDPR, SOX | Required | 0.05 |
| legal | SOC 2 Type II | GDPR, State Bar | Required | 0.05 |
| scientific | None | FDA 21 CFR, GLP, IRB | Optional | 0.08 |
| creative | None | FTC Guidelines | Not Required | 0.20 |
| engineering | None | SOC 2, ISO 27001, NIST | Optional | 0.10 |
| general | None | None | Not Required | 0.10 |

## 5.4 Key Files

| File | Purpose |
|------|---------|
| `migrations/V2026_01_21_004__raws_weighted_selection.sql` | Database schema |
| `lambda/shared/services/raws/types.ts` | TypeScript types |
| `lambda/shared/services/raws/domain-detector.service.ts` | Domain detection |
| `lambda/shared/services/raws/weight-profile.service.ts` | Profile management |
| `lambda/shared/services/raws/selection.service.ts` | Main selection logic |
| `lambda/admin/raws.ts` | Admin API handler |

## 5.5 Detailed Documentation

- [RAWS-ENGINEERING.md](./RAWS-ENGINEERING.md) - Technical reference
- [RAWS-ADMIN-GUIDE.md](./RAWS-ADMIN-GUIDE.md) - Operations guide
- [RAWS-USER-GUIDE.md](./RAWS-USER-GUIDE.md) - API guide for developers

---

# PART 6: CORTEX MEMORY SYSTEM v4.20.0

## 6.1 Overview

The **Cortex Memory System** provides enterprise-scale tiered memory architecture replacing direct database storage. It solves critical scaling challenges:

| Problem | Solution |
|---------|----------|
| Volume limits (100M+ rows) | Distribute across three tiers |
| Latency degradation | Hot tier caching (<10ms) |
| Cost inefficiency | Cold tier archival (90% savings) |
| Compliance conflicts | Per-tier retention policies |
| Data gravity | Zero-Copy mounts to customer data lakes |

## 6.2 Three-Tier Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    HOT TIER     │────▶│    WARM TIER    │────▶│    COLD TIER    │
│  Redis + DynamoDB│     │ Neptune + pgvector│     │  S3 + Iceberg  │
│     < 10ms      │     │     < 100ms     │     │     < 2s        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     4 hours                 90 days               7+ years
```

| Tier | Role | Technology | Content |
|------|------|------------|---------|
| **Hot** | *"What is happening right now?"* | Redis + DynamoDB | Live session, Ghost Vectors, MQTT/OPC UA telemetry |
| **Warm** | *"How does the business work?"* | Neptune + pgvector | Entity maps, Procedural logic, Golden Q&A pairs |
| **Cold** | *"What happened 10 years ago?"* | S3 Iceberg + Athena | Deep archive via Stub Nodes (Zero-Copy) |

### The "Retrieval Dance" - Runtime Query Flow

```
Step 1: INTENT PARSING (Hot)     → Analyze Query + Ghost Vectors
Step 2: GRAPH TRAVERSAL (Warm)   → 2-3 hops, check Golden Rule Overrides
Step 3: DEEP FETCH (Cold)        → Fetch ONLY specific pages via Stub Nodes
Step 4: SYNTHESIS (Model)        → Package with Chain of Custody audit trail
```

## 6.3 Hot Tier - Real-Time Context

### Key Schema (Tenant Isolation)
```
{tenant_id}:{data_type}:{identifier}
```

### Data Types
| Type | TTL | Purpose |
|------|-----|---------|
| Session Context | 4h | Current conversation state |
| Ghost Vectors | 24h | 8192-dim personality embeddings from vLLM hidden states |
| Telemetry Feeds | 1h | Real-time event streams |
| Prefetch Cache | 30m | Anticipated document needs |

### Ghost Inference Configuration (v5.52.40)

Ghost vectors are extracted using vLLM on SageMaker with configurable parameters per tenant:

| Component | Purpose |
|-----------|---------|
| `ghost_inference_config` | Tenant-specific vLLM settings |
| `ghost_inference_deployments` | SageMaker endpoint deployment history |
| `ghost_inference_metrics` | Performance metrics aggregation |
| `GhostInferenceConstruct` | CDK construct for SageMaker deployment |

**vLLM Configuration Parameters:**
- Model: LLaMA 3 70B Instruct (configurable)
- Tensor Parallel Size: 1-8 GPUs
- Hidden State Layer: Configurable layer for extraction
- GPU Memory Utilization: 50-99%
- Quantization: AWQ, GPTQ, SqueezeLLM, FP8

**Admin API:** `/api/admin/ghost-inference/*` for dashboard, config, deployments, validation

## 6.4 Warm Tier - Graph-RAG Knowledge

### Why Graph Beats Vector-Only
| Query Type | Vector Search | Graph-RAG |
|------------|---------------|-----------|
| "What causes X?" | Returns similar docs | Traverses CAUSES edges |
| "What depends on Y?" | Returns related docs | Follows DEPENDS_ON paths |
| "What supersedes Z?" | May return old versions | Explicit SUPERSEDES edges |

### Graph Schema
| Node Types | Edge Types |
|------------|------------|
| document, entity, concept, procedure, fact | mentions, causes, depends_on, supersedes, verified_by, authored_by, relates_to, contains, requires |

### Hybrid Search
```
Hybrid Score = (Vector Similarity × 0.4) + (Graph Traversal × 0.6)
```

## 6.5 Cold Tier - Historical Archive

### Storage Lifecycle
```
Day 0-30:    S3 Standard
Day 30-90:   S3 Intelligent-Tiering
Day 90-365:  Glacier Instant Retrieval
Day 365+:    Glacier Deep Archive
```

### Zero-Copy Mounts & Stub Nodes

**The Innovation:** We do not force tenants to move 50TB of data to our cloud. We **Mount** their existing Data Lakes and create **Stub Nodes** in the Warm Graph.

**Stub Node Mechanism:**
- RADIANT scans external storage metadata
- Creates lightweight "Stub Nodes" in graph (e.g., "Log File 2024.csv exists at S3://bucket/logs/")
- Actual content fetched **only** when Graph Traversal determines it's critical

**Supported Sources:**
- Snowflake Data Share
- Databricks Delta Lake
- Amazon S3
- Azure Data Lake Gen2
- Google Cloud Storage

## 6.6 Tier Coordinator

Orchestrates automatic data movement:

| Operation | Trigger | Action |
|-----------|---------|--------|
| Hot → Warm | TTL expiration | Extract entities, create graph nodes |
| Warm → Cold | Age > 90 days | Archive to Iceberg, mark archived |
| Cold → Warm | On-demand retrieval | Rehydrate from S3, update status |

## 6.7 Twilight Dreaming Integration

| Task | Frequency | Purpose |
|------|-----------|---------|
| ttl_enforcement | Hourly | Expire Hot tier keys |
| archive_promotion | Nightly | Move Warm → Cold |
| deduplication | Nightly | Merge duplicate nodes |
| conflict_resolution | Nightly | Flag contradictions |
| iceberg_compaction | Nightly | Optimize Cold storage |
| index_optimization | Weekly | Reindex vectors |

## 6.8 GDPR Compliance

Cascade deletion across all tiers:

| Tier | Erasure SLA | Method |
|------|-------------|--------|
| Hot | Immediate | Redis key deletion |
| Warm | 24h | Node status → deleted, properties cleared |
| Cold | 72h | Tombstone records in Iceberg |

## 6.9 Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types/cortex-memory.types.ts` | Type definitions |
| `migrations/V2026_01_23_002__cortex_memory_system.sql` | Database schema (14 tables) |
| `lambda/shared/services/cortex/tier-coordinator.service.ts` | Orchestration |
| `lambda/admin/cortex.ts` | Admin API |
| `apps/admin-dashboard/app/(dashboard)/cortex/page.tsx` | Dashboard UI |

## 6.10 API Endpoints

```
Base: /api/admin/cortex

GET    /overview                    Dashboard data
GET    /config                      Tier configuration
PUT    /config                      Update configuration
GET    /health                      Tier health status
POST   /health/check                Trigger health check
GET    /alerts                      Active alerts
POST   /alerts/:id/acknowledge      Acknowledge alert
GET    /metrics                     Data flow metrics
GET    /graph/stats                 Node/edge counts
GET    /graph/explore               Search graph nodes
GET    /graph/conflicts             Unresolved conflicts
GET    /housekeeping/status         Task statuses
POST   /housekeeping/trigger        Run task manually
GET    /mounts                      Zero-Copy mounts
POST   /mounts                      Create mount
POST   /mounts/:id/rescan           Rescan mount
DELETE /mounts/:id                  Delete mount
GET    /gdpr/erasure                Erasure requests
POST   /gdpr/erasure                Create erasure request
```

## 6.11 Cortex v2.0 Features

Extended capabilities added in v5.52.13:

### Golden Rules Override System

Human-verified facts that override AI-extracted knowledge:

| Rule Type | Purpose |
|-----------|---------|
| `force_override` | Replace incorrect fact |
| `ignore_source` | Blacklist source |
| `prefer_source` | Prioritize source |
| `deprecate` | Mark outdated |

**Chain of Custody**: Cryptographic signatures, verification timestamps, full audit trail.

### Stub Nodes (Zero-Copy Data Gravity)

Lightweight metadata pointers to external data lakes:

| Source | Support |
|--------|---------|
| Snowflake | Tables, views |
| Databricks | Delta Lake |
| S3 | CSV, Parquet, PDF |
| Azure Data Lake | Gen2 |
| GCS | Cloud Storage |

### Graph Expansion (Twilight Dreaming v2)

Autonomous knowledge graph improvement:

| Task | Purpose |
|------|---------|
| `infer_links` | Co-occurrence, semantic similarity |
| `cluster_entities` | Group by shared neighbors |
| `detect_patterns` | Sequences, anomalies |
| `merge_duplicates` | Near-duplicate detection |

### Live Telemetry Feeds

Real-time sensor data injection:

| Protocol | Use Case |
|----------|----------|
| MQTT | IoT sensors |
| OPC UA | Industrial |
| Kafka | Event streams |
| WebSocket | Real-time |

### Curator Entrance Exams

SME verification workflow for knowledge validation with auto-generated questions and Golden Rule creation for corrections.

### Model Migration

Safe model transitions: Initiate → Validate → Test → Execute → Rollback if needed.

## 6.12 Cortex v2 API Endpoints

```
Base: /api/admin/cortex/v2

Golden Rules:
GET/POST   /golden-rules              List/Create rules
DELETE     /golden-rules/:id          Deactivate rule
POST       /golden-rules/check        Check for match

Chain of Custody:
GET        /chain-of-custody/:factId  Get custody record
POST       /chain-of-custody/:factId/verify    Verify fact
GET        /chain-of-custody/:factId/audit-trail

Stub Nodes:
GET        /stub-nodes                List stub nodes
GET        /stub-nodes/:id            Get stub node
POST       /stub-nodes/:id/fetch      Fetch content (signed URL)
POST       /stub-nodes/:id/connect    Connect to graph nodes
POST       /stub-nodes/scan           Scan mount for files

Telemetry:
GET/POST   /telemetry/feeds           List/Create feeds
POST       /telemetry/feeds/:id/start Start feed
POST       /telemetry/feeds/:id/stop  Stop feed
GET        /telemetry/context-injection  Get injection data

Exams:
GET/POST   /exams                     List/Create exams
POST       /exams/:id/start           Start exam
POST       /exams/:id/submit          Submit answer
POST       /exams/:id/complete        Complete exam

Graph Expansion:
GET/POST   /graph-expansion/tasks     List/Create tasks
POST       /graph-expansion/tasks/:id/run  Run task
GET        /graph-expansion/pending-links  Pending approvals
POST       /graph-expansion/links/:id/approve
POST       /graph-expansion/links/:id/reject

Model Migration:
GET/POST   /model-migrations          List/Create migrations
POST       /model-migrations/:id/validate
POST       /model-migrations/:id/test
POST       /model-migrations/:id/execute
POST       /model-migrations/:id/rollback
```

## 6.13 Cortex v2 Key Files

| File | Purpose |
|------|---------|
| `migrations/V2026_01_23_003__cortex_v2_features.sql` | v2 schema (12 tables) |
| `lambda/shared/services/cortex/golden-rules.service.ts` | Golden Rules + Chain of Custody |
| `lambda/shared/services/cortex/stub-nodes.service.ts` | Zero-copy pointers |
| `lambda/shared/services/cortex/graph-expansion.service.ts` | Twilight Dreaming v2 |
| `lambda/shared/services/cortex/telemetry.service.ts` | Live feeds |
| `lambda/shared/services/cortex/entrance-exam.service.ts` | SME verification |
| `lambda/shared/services/cortex/model-migration.service.ts` | Model transitions |
| `lambda/admin/cortex-v2.ts` | Admin API v2 |

## 6.14 Cato-Cortex Bridge (v5.52.14)

Integrates Cato consciousness with Cortex memory tiers for unified prompt enrichment.

### Data Flow

| Direction | Data | Purpose |
|-----------|------|---------|
| Cato → Cortex | Semantic memories | Persist to knowledge graph |
| Cortex → Cato | Knowledge facts | Enrich ego context |
| Bidirectional | GDPR erasure | Cascade deletion |

### Think Tank Prompt Enrichment

1. Ego Context Builder loads identity, affect, memory
2. User Persistent Context retrieves preferences
3. **Cato-Cortex Bridge queries Cortex for relevant knowledge**
4. All merged into `<ego_state>` XML block with `<knowledge_base>` section
5. Injected into system prompt

### Key Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/cato-cortex-bridge.service.ts` | Bridge service |
| `lambda/shared/services/identity-core.service.ts` | Ego builder (uses bridge) |
| `migrations/V2026_01_24_003__cato_cortex_bridge.sql` | Bridge tables |

### Database Tables

| Table | Purpose |
|-------|---------|
| `cato_cortex_bridge_config` | Per-tenant configuration |
| `cato_cortex_sync_log` | Sync history |
| `cato_cortex_enrichment_cache` | Cached enrichments |

## 6.15 Cortex Intelligence Service (v5.52.15)

Cortex knowledge density influences domain detection, orchestration, and model selection.

### How Cortex Informs Decisions

| Decision | Cortex Influence |
|----------|-----------------|
| **Domain Detection** | +0% to +30% confidence boost based on knowledge depth |
| **Orchestration Mode** | Switches to `research` if expert knowledge available |
| **Model Selection** | Prefers factual models when Cortex has rich fact data |

### Knowledge Depth Thresholds

| Depth | Nodes | Confidence Boost | Orchestration |
|-------|-------|------------------|---------------|
| `none` | 0 | +0% | `thinking` |
| `sparse` | 1-4 | +5% | `extended_thinking` |
| `moderate` | 5-19 | +10% | `thinking` |
| `rich` | 20-49 | +15% | `analysis` |
| `expert` | 50+ | +20-30% | `research` |

### Key File

`lambda/shared/services/cortex-intelligence.service.ts`

### AGI Brain Plan Output

```typescript
plan.cortexInsights = {
  enabled: true,
  knowledgeDepth: 'rich',
  totalNodes: 26,
  totalEdges: 45,
  keyEntities: ['Compound X', 'Target Y', 'IC50'],
  confidenceBoost: 0.18,
  orchestrationInfluence: 'Rich knowledge - use research mode',
  modelInfluence: 'Prefer factual models (15 facts available)',
  retrievalTimeMs: 12,
};
```

## 6.16 Detailed Documentation

- [CORTEX-MEMORY-ADMIN-GUIDE.md](./CORTEX-MEMORY-ADMIN-GUIDE.md) - Operations guide
- [CORTEX-ENGINEERING-GUIDE.md](./CORTEX-ENGINEERING-GUIDE.md) - Technical reference

---

# Part 7: Think Tank Consumer API Layer (v5.52.17)

## 7.1 Overview

The Think Tank consumer application requires a complete frontend-to-backend API wiring layer. This section documents the API service architecture that connects UI components to Lambda handlers.

## 7.2 API Service Registry

| Backend Lambda | Frontend Service | Route Pattern |
|----------------|------------------|---------------|
| `conversations.ts` | `chatService` | `/api/thinktank/conversations/*` |
| `models.ts` | `modelsService` | `/api/thinktank/models/*` |
| `my-rules.ts` | `rulesService` | `/api/thinktank/my-rules/*` |
| `settings.ts` | `settingsService` | `/api/thinktank/settings/*` |
| `brain-plan.ts` | `brainPlanService` | `/api/thinktank/brain-plan/*` |
| `analytics.ts` | `analyticsService` | `/api/thinktank/analytics/*` |
| `economic-governor.ts` | `governorService` | `/api/thinktank/economic-governor/*` |
| `time-travel.ts` | `timeTravelService` | `/api/thinktank/time-travel/*` |
| `grimoire.ts` | `grimoireService` | `/api/thinktank/grimoire/*` |
| `flash-facts.ts` | `flashFactsService` | `/api/thinktank/flash-facts/*` |
| `derivation-history.ts` | `derivationHistoryService` | `/api/thinktank/derivation-history/*` |
| `enhanced-collaboration.ts` | `collaborationService` | `/api/thinktank/enhanced-collaboration/*` |
| `artifact-engine.ts` | `artifactsService` | `/api/thinktank/artifacts/*` |
| `ideas.ts` | `ideasService` | `/api/thinktank/ideas/*` |
| `dia.ts` | `exportConversation` | `/api/thinktank/dia/*` |

## 7.3 File Locations

```
apps/thinktank/lib/api/
├── index.ts              # Service exports
├── client.ts             # HTTP client
├── chat.ts               # Conversations
├── time-travel.ts        # Timelines, checkpoints
├── grimoire.ts           # Prompt templates
├── flash-facts.ts        # Fact extraction
├── derivation-history.ts # AI provenance
├── collaboration.ts      # Real-time sessions
├── artifacts.ts          # Code/docs
├── ideas.ts              # Idea boards
└── compliance-export.ts  # DIA/compliance
```

## 7.4 Key Features by Service

| Service | Key Features |
|---------|--------------|
| **Time Travel** | Create timelines, manual checkpoints, fork conversations, restore state |
| **Grimoire** | Spell templates, variable substitution, execute against AI |
| **Flash Facts** | Extract facts from conversations, verify claims, build collections |
| **Derivation History** | View AI reasoning chains, evidence provenance, challenge claims |
| **Collaboration** | Create sessions, invite participants, real-time cursors |
| **Artifacts** | Version history, export formats, AI refinement |
| **Ideas** | Capture from messages, kanban boards, AI development |
| **Compliance Export** | HIPAA, SOC2, GDPR formats, PHI redaction |

---

# APPENDIX A: GLOSSARY

| Term | Definition |
|------|------------|
| **RADIANT** | Rapid AI Deployment Infrastructure for Applications with Native Tenancy |
| **Cato** | The AI persona and orchestration brain |
| **Genesis Cato** | The safety architecture (Governor, CBF, Veto) |
| **War Room** | Multi-model debate workflow |
| **Sniper Mode** | Single-model fast execution |
| **ECD** | Entity-Context Divergence (hallucination score) |
| **RAWS** | RADIANT AI Weighted Selection (model orchestration) |
| **Cortex** | Three-tier memory system (Hot/Warm/Cold) |
| **Graph-RAG** | Hybrid vector + graph traversal search |
| **Zero-Copy Mount** | External data lake connection without duplication |
| **CBF** | Control Barrier Function (safety constraint) |
| **OODA** | Observe-Orient-Decide-Act loop |
| **HITL** | Human-in-the-Loop |
| **Sovereign Mesh** | v5.0 architecture where every node can think |
| **Thermal State** | Model instance status (OFF/COLD/WARM/HOT) |
| **Model Registry** | Version discovery and lifecycle management system |
| **HuggingFace Discovery** | Automated polling for new model versions |
| **Deletion Queue** | Safe model deletion with usage session tracking |
| **RADIANT Cartridge** | Portable AI intelligence package (.RADz file) |
| **CORTEX** | Six small MLPs for routing and orchestration |
| **Ghost Vector** | 64-dimensional user personalization representation |
| **LoRA Adapter** | Low-rank adaptation for tenant-specific fine-tuning |
| **ESA** | Expert System Adapter - domain-specific reasoning patterns |
| **Twilight Dreaming** | Nightly autonomous learning cycle |
| **Three-Tier Learning** | Global/Tenant/User learning hierarchy |

---

# PART 8: NEURAL ARCHITECTURE v6.0.0

## 8.1 System Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RADIANT NEURAL ARCHITECTURE v6.0.0                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          CARTRIDGE LAYER                             │   │
│  │  .RADz files contain: CORTEX, LoRA, ESA, Curator, Ghost             │   │
│  │  Operations: Export, Import, Hot-Swap, Rollback                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          CORTEX LAYER                                │   │
│  │  6 MLPs (~2.5M params): Pattern, Routing, Topology,                  │   │
│  │  CLARION, Combination, User                                          │   │
│  │  Training: PyTorch (nightly) → Inference: ONNX Runtime (24/7)        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          LEARNING LAYER                              │   │
│  │  GLOBAL (Monthly)  →  TENANT (Nightly)  →  USER (Session)           │   │
│  │  30%→10%                50%→20%               20%→70%                │   │
│  │  DP-protected           LoRA adapters         Ghost vectors          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          THERMAL LAYER                               │   │
│  │  COLD → WARMING → WARM → HOT                                         │   │
│  │  Multi-region with S3 CRR sync                                       │   │
│  │  WARM by default when cartridge installed                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8.2 CORTEX Network Specifications

| Network | Input Dim | Hidden Layers | Output | Params | Purpose |
|---------|-----------|---------------|--------|--------|---------|
| **Pattern** | 768 | 512→256 | 128 | ~1.2M | Rank prompt patterns |
| **Routing** | 512 | 256→128 | N models | ~200K | Select AI model |
| **Topology** | 1024 | 512→256 | 256 | ~800K | Choose orchestration |
| **CLARION** | 512 | 256→128 | N questions | ~200K | Rank questions |
| **Combination** | 256 | 128→64 | 1 (score) | ~50K | Score combos |
| **User** | 128+64 | 64→32 | 64 | ~20K | Personalization |

**Total**: ~2.5M parameters, ~10MB on disk

## 8.3 Cartridge Contents

```
example.RADz (encrypted ZIP)
├── manifest.json              # Version, compatibility
├── cortex/                    # 6 ONNX networks
├── lora/*.safetensors         # Domain adapters
├── esa/*.json                 # Expert systems
├── curator/                   # Golden rules, ontology
└── ghost/compression.onnx     # Ghost vector adapter
```

## 8.4 Thermal State Management

| State | Condition | Latency | Cost |
|-------|-----------|---------|------|
| **COLD** | No cartridge | 30-60s | $ |
| **WARMING** | Installing | 10-30s | $$ |
| **WARM** | Active | <100ms | $$$ |
| **HOT** | High demand | <50ms | $$$$ |

## 8.5 CDK Infrastructure

| Component | Stack | Purpose |
|-----------|-------|---------|
| Neural Ops Lambda | api-stack | CORTEX monitoring |
| Cartridge Lambda | api-stack | Import/export |
| Thermal Lambda | api-stack | State management |
| Dreaming Lambda | scheduled-stack | Nightly training |
| S3 Bucket | storage-stack | Model storage |
| State Registry Lambda | state-registry-stack | Environment state capture/sync |
| State Registry S3 | state-registry-stack | Manifests and backups storage |

## 8.6 Database Tables (v6.2.0)

| Table | Purpose |
|-------|---------|
| `cartridges` | Cartridge registry |
| `cortex_network_status` | Network health |
| `cortex_network_metrics` | Time-series metrics |
| `neural_region_status` | Regional thermal state |
| `neural_thermal_overrides` | Manual overrides |
| `user_learning_vectors` | Ghost vectors |
| `tenant_lora_adapters` | LoRA adapters |

### Genesis Vault Tables (v6.2.0)

| Table | Purpose |
|-------|---------|
| `vault_secrets` | KMS-encrypted secrets storage |
| `vault_access_log` | Secret access audit trail |
| `cartridge_vault_requirements` | vault.req manifest per cartridge |
| `vault_secret_history` | Rotation history with retention |

### RNIR Tables (v6.2.0)

| Table | Purpose |
|-------|---------|
| `rnir_documents` | RNIR source documents (JSONL) |
| `rnir_examples` | Training examples with quality scores |
| `rnir_compilation_jobs` | Compilation job tracking |
| `rnir_compiled_artifacts` | Compiled outputs (LoRA, prompts, etc.) |

### Cartridge Operations Tables (v6.2.0)

| Table | Purpose |
|-------|---------|
| `cartridge_operations` | Long-running operation records |
| `cartridge_operation_steps` | Step-by-step progress |
| `cartridge_operation_checkpoints` | Time Machine checkpoints |

### Environment State Registry Tables (v7.1.0)

| Table | Purpose |
|-------|---------|
| `env_state_manifests` | Versioned environment state snapshots |
| `env_sync_configurations` | Per-environment sync settings |
| `env_sync_operations` | Sync operation tracking with progress |
| `env_backup_manifests` | Environment backup metadata |
| `env_restore_operations` | Restore operation tracking |
| `env_persistent_data_items` | Persistent data with sync preferences |
| `env_state_audit_log` | Audit trail for all state operations |
| `cartridge_operation_events` | Real-time event stream |

### LIVS Tables (v6.3.0)

| Table | Purpose |
|-------|---------|
| `livs_config` | Per-tenant LIVS configuration |
| `livs_soft_rules` | Configurable integrity rules |
| `livs_interrogations` | Interrogation session records (partitioned) |
| `livs_model_weights` | Per-model lie detection statistics |
| `livs_orchestration_weights` | Per-pattern reliability scores |
| `livs_pipeline_audits` | Pipeline integrity audit results (partitioned) |
| `livs_global_model_weights` | Cross-tenant aggregated weights |

### LIVS-M 2.0 Registry Tables (v7.9.0)

| Table | Purpose |
|-------|--------|
| `livs_policy_registry` | Per-tenant JSON-based policy registry storage |
| `livs_registry_evaluations` | Audit log of all policy evaluations |
| `livs_registry_history` | Change history for registry modifications |
| `livs_agent_interactions` | Supervisor governance loop audit trail |

---

# PART 9: LLM INTEGRITY VERIFICATION SYSTEM (LIVS) v6.3.0

Two-tier defense against AI "lying" behaviors. **Tier 1 Technical Moat** - no competitor has systematic LLM lie detection.

## 9.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LLM INTEGRITY VERIFICATION SYSTEM                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    TIER 1: INDIVIDUAL INTERROGATION                  │   │
│  │  Query → LLM Response → Interrogator Model → Lie Detection Signals  │   │
│  │                                                                       │   │
│  │  Depth Levels:                                                        │   │
│  │    0 = None    1 = Spot Check    2 = Moderate                        │   │
│  │    3 = Thorough    4 = Forensic                                      │   │
│  │                                                                       │   │
│  │  Question Patterns:                                                   │   │
│  │    Dependency Probe | Forensic Validator | Edge Case Probe           │   │
│  │    Confidence Calibration | Contradiction Test                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   TIER 2: ORCHESTRATION INTEGRITY                    │   │
│  │  Pipeline → Pre-Action Check → Consistency → Evidence Chain         │   │
│  │                                                                       │   │
│  │  Failure Patterns Detected:                                          │   │
│  │    Watermelon Pipeline | Echo Chamber | Confidence Inflation         │   │
│  │    Circular Reasoning | Scope Drift                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       CATO INTEGRATION (30% WEIGHT)                  │   │
│  │  Model Selection = Capability(35%) + Cost(21%) + Latency(14%) +     │   │
│  │                    Integrity(30%)                                    │   │
│  │                                                                       │   │
│  │  Per-model lie rates by domain/query type                           │   │
│  │  Twilight Dreaming learns from interrogation results                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9.2 Lie Detection Signals

| Signal | Description | Severity |
|--------|-------------|----------|
| Confidence Mismatch | Claimed vs. calibrated confidence | 0.3-0.8 |
| Contradiction Count | Inconsistencies during interrogation | 0.2-0.5 |
| Hedging Increase | More uncertain language under pressure | 0.1-0.4 |
| Specificity Decrease | Less detail when probed | 0.2-0.5 |
| Assertion Without Evidence | Claims without sources | 0.3-0.7 |
| Deflection Count | Avoiding direct answers | 0.2-0.6 |
| Scope Narrowing | Reducing answer scope | 0.1-0.3 |

## 9.3 Configuration Hierarchy

```
System (Default) → Tenant (Override) → User (Final)
```

**Cost Modes**:
- `economy` - Minimal interrogation, cost-optimized
- `balanced` - Default, moderate depth
- `thorough` - Deep interrogation, accuracy-optimized

## 9.4 Services Architecture

| Service | Purpose |
|---------|---------|
| `LIVSConfigService` | Configuration with tenant hierarchy |
| `LIVSInterrogatorService` | Multi-round interrogation protocol |
| `LIVSSoftRulesService` | Rule matching and application |
| `LIVSWeightsService` | Model integrity weight tracking |
| `LIVSOrchestrationService` | Pipeline integrity verification |
| `LIVSCatoIntegrationService` | Cato model selection integration |

## 9.5 Admin API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/PUT | `/api/admin/livs/config` | Configuration |
| GET/POST | `/api/admin/livs/rules` | Soft rules |
| GET | `/api/admin/livs/dashboard` | Metrics dashboard |
| GET | `/api/admin/livs/models` | Model integrity |
| GET | `/api/admin/livs/interrogations` | History |
| GET | `/api/admin/livs/audits` | Pipeline audits |

---

# PART 9B: LIVS-M 2.0 REGISTRY EDITION (v7.9.0)

Extension to LIVS introducing JSON-based Policy Registry for multi-agent governance. **Tier 1 Technical Moat** - sycophancy detection with chaos injection.

## 9B.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     LIVS-M 2.0 REGISTRY EDITION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      POLICY REGISTRY (JSON)                          │    │
│  │  meta_config: { environment_mode, supervisor_model, escalation }    │    │
│  │  global_directives: { max_turns, chaos_threshold, stub_tolerance }  │    │
│  │  rules_engine: [ R_STUB_01, R_SYC_01, R_EVIDENCE_01, ... ]          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    GOVERNANCE SUPERVISOR (LLM)                       │    │
│  │  Meta-prompt built from registry → Evaluates agent outputs          │    │
│  │  Returns: APPROVE | REJECT | INTERVENE                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                    ┌─────────────────┼─────────────────┐                    │
│                    ▼                 ▼                 ▼                    │
│  ┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │
│  │    THESIS AGENT      │  │  ANTITHESIS AGENT│  │    CHAOS AGENT       │   │
│  │  (Lead Engineer)     │  │  (Forensic Audit)│  │  (Devil's Advocate)  │   │
│  │  Proposes solutions  │  │  Challenges flaws│  │  Breaks consensus    │   │
│  └──────────────────────┘  └──────────────────┘  └──────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9B.2 Environment Modes

| Mode | Chaos Threshold | Stub Tolerance | Use Case |
|------|-----------------|----------------|----------|
| `STRICT_AUDIT` | 0 | 0 | Production, compliance |
| `BALANCED` | 2 | 0 | Default operations |
| `RAPID_PROTO` | 5 | 3 | Development, iteration |
| `HACKATHON` | 10 | 10 | Demos, experiments |

## 9B.3 Services Architecture

| Service | Purpose |
|---------|---------|
| `PolicyRegistryService` | Load, cache, evaluate policy registries per tenant |
| `LIVSGovernanceSupervisorService` | Meta-prompt supervisor enforcing registry rules |
| `AGIOrchestratorService.executeGovernedDebate()` | Multi-agent debate with governance loop |

## 9B.4 Default Rules

| Rule ID | Name | Severity | Action |
|---------|------|----------|--------|
| `R_STUB_01` | No Stubs/Placeholders | CRITICAL | REJECT_IMMEDIATE |
| `R_SYC_01` | Anti-Sycophancy | HIGH | TRIGGER_CHAOS_AGENT |
| `R_EVIDENCE_01` | Evidence Required | MEDIUM | REQUEST_AMENDMENT |
| `R_SCOPE_01` | Scope Adherence | MEDIUM | REQUEST_AMENDMENT |

## 9B.5 AGI Orchestrator Integration

The governance loop in `AGIOrchestratorService` (Step 15):

1. **Lazy Init**: Internal supervisor created on first governance request
2. **Dual Mode**: Use external supervisor if provided, otherwise internal
3. **Retry Loop**: Up to `maxRetriesOnRejection` attempts on REJECT
4. **Chaos Injection**: On INTERVENE, invoke Chaos Agent to break sycophancy
5. **Escalation**: After `max_agent_turns_before_escalation`, require human review

---

# PART 10: THE CRUCIBLE - COMPETITIVE MULTI-LLM DELIBERATION v6.4.0

Novel orchestration primitive for competitive multi-LLM deliberation. **Tier 1 Technical Moat** - no competitor has systematic competitive deliberation with provenance tracking.

## 10.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THE CRUCIBLE DELIBERATION                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        DELIBERATION FLOW                            │   │
│  │                                                                     │   │
│  │   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    │   │
│  │   │  Setup   │ → │Pre-Prompt│ → │Deliberate│ → │  Report  │    │   │
│  │   │ Session  │    │   All    │    │ Q&A Loop │    │  Final   │    │   │
│  │   └──────────┘    └──────────┘    └──────────┘    └──────────┘    │   │
│  │        │               │               │               │          │   │
│  │   - Assign LLMs   - Criteria     - Ask questions   - Submit      │   │
│  │   - Check config  - Competition  - Get answers     - Score       │   │
│  │   - Create session  rules       - Iterate         - Select winner │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       PROVENANCE TRACKING                           │   │
│  │                                                                     │   │
│  │   Citation Graph     Circular Detection     Learning Insights      │   │
│  │   ┌───────────┐     ┌───────────────┐     ┌──────────────────┐    │   │
│  │   │ A → B     │     │ A cites B     │     │ Model strengths  │    │   │
│  │   │ B → C     │     │ B cites A     │     │ Question patterns│    │   │
│  │   │ C → A ⚠️  │     │ = CIRCULAR!   │     │ Win rate trends  │    │   │
│  │   └───────────┘     └───────────────┘     └──────────────────┘    │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 10.2 Database Tables

| Table | Purpose |
|-------|---------|
| `crucible_config` | Per-tenant configuration |
| `crucible_sessions` | Deliberation sessions |
| `crucible_participants` | Session participants with stats |
| `crucible_questions` | Questions asked during deliberation |
| `crucible_answers` | Answers with circular detection |
| `crucible_citations` | Citation tracking |
| `crucible_final_reports` | Final outputs with scores |
| `crucible_learning_insights` | Extracted learning insights |
| `crucible_model_performance` | Aggregated model statistics |
| `crucible_audit_log` | Full audit trail |

## 10.3 Core Services

| Service | Purpose |
|---------|---------|
| `CrucibleService` | Configuration, session management, scoring |
| `CrucibleOrchestratorService` | Full session lifecycle orchestration |
| `CrucibleCatoIntegrationService` | Cato pipeline integration |

## 10.4 Pre-Prompt System

LLMs receive competitive pre-prompts with:
- **Evaluation Criteria**: Accuracy (40%), Truthfulness (25%), Reasoning (15%), Completeness (10%), Citations (10%)
- **Competition Rules**: No penalty for questions, iterative questioning allowed
- **Provenance Instructions**: Track citations, circular reasoning penalized
- **Participant Roster**: Other models' names, providers, and strengths

## 10.5 Admin API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/crucible/dashboard` | Full dashboard data |
| GET/PUT | `/api/admin/crucible/config` | Configuration |
| GET | `/api/admin/crucible/sessions` | Session listing |
| GET | `/api/admin/crucible/sessions/:id` | Session details |
| GET | `/api/admin/crucible/sessions/:id/questions` | Question log |
| GET | `/api/admin/crucible/performance` | Model performance |
| GET | `/api/admin/crucible/insights` | Learning insights |
| GET | `/api/admin/crucible/audit` | Audit log |
| GET | `/api/admin/crucible/stats` | Statistics |

---

# PART 11: AUTONOMOUS ORGANISM ARCHITECTURE v6.6.0

**Project Metamorphosis** — Complete evolution transforming RADIANT from Agentic Software into **Neural Infrastructure**—a self-evolving, self-optimizing AI system.

## 11.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTONOMOUS ORGANISM ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         USER REQUEST                                 │   │
│  └───────────────────────────────┬─────────────────────────────────────┘   │
│                                  │                                          │
│                                  ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    ORGANISM INTEGRATION SERVICE                      │   │
│  │                                                                      │   │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │   │
│  │   │    MCP       │  │   Neural     │  │   Genesis    │             │   │
│  │   │   Server     │  │   Schema     │  │   Auto-Tool  │             │   │
│  │   │   Manager    │  │   Registry   │  │   Pipeline   │             │   │
│  │   └──────────────┘  └──────────────┘  └──────────────┘             │   │
│  │                                                                      │   │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │   │
│  │   │   Liquid     │  │    Ghost     │  │   Economic   │             │   │
│  │   │   Compute    │  │  Simulation  │  │   Cortex     │             │   │
│  │   │   Topology   │  │    Layer     │  │   Budget     │             │   │
│  │   └──────────────┘  └──────────────┘  └──────────────┘             │   │
│  │                                                                      │   │
│  │   ┌──────────────────────────────────────────────────────────┐     │   │
│  │   │                   TENSOR-LINK PROTOCOL                    │     │   │
│  │   │           Vector-based transport with quantization        │     │   │
│  │   └──────────────────────────────────────────────────────────┘     │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                  │                                          │
│                                  ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         BRAIN ROUTER                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 11.2 Core Services (8 Total)

| Service | File | Purpose |
|---------|------|---------|
| **MCP Server Manager** | `mcp-server-manager.service.ts` | Server registry, health checks, Neural Affinity Routing |
| **Neural Schema Registry** | `neural-schema-registry.service.ts` | Tool schemas with neural embeddings |
| **Genesis Auto-Tool** | `genesis-auto-tool.service.ts` | On-demand tool generation from API docs |
| **Liquid Compute** | `liquid-compute.service.ts` | Privacy-aware compute location selection |
| **Ghost Simulation** | `ghost-simulation.service.ts` | User digital twin for outcome prediction |
| **Tensor-Link** | `tensor-link.service.ts` | Vector-based transport protocol |
| **Economic Cortex** | `economic-cortex.service.ts` | Autonomous budget management |
| **Organism Integration** | `organism-integration.service.ts` | BrainRouter integration layer |

## 11.3 Neural Affinity Routing

Semantic model/tool selection based on intent embeddings:

```typescript
affinityScore = (semantic × 0.35) + (domain × 0.25) + ((1-error) × 0.20)
              + (latency × 0.10) + (cost × 0.10)
```

| Factor | Weight | Description |
|--------|--------|-------------|
| **Semantic Similarity** | 35% | Cosine similarity with intent embedding |
| **Domain Proficiency** | 25% | Historical performance in domain |
| **Error Rate** | 20% | Inverse of recent error rate |
| **Latency** | 10% | Recent p95 latency |
| **Cost** | 10% | Cost per call |

## 11.4 Genesis Auto-Tool Pipeline

7-phase pipeline for just-in-time tool generation:

| Phase | Duration | Description |
|-------|----------|-------------|
| **Detection** | 100ms | No existing tool matches intent |
| **Scouting** | 5-30s | Search API docs (OpenAPI, GraphQL, HTML) |
| **Fabrication** | 30-60s | Generate MCP server code with Zod schemas |
| **Sandboxing** | 10-20s | Firecracker microVM isolation |
| **Validation** | 5-10s | SAST scan, functional tests |
| **Mounting** | 1-2s | Hot-load into active session |
| **Twilight Review** | Overnight | Promote to global library |

## 11.5 Liquid Compute Topology

Privacy-aware compute location selection:

| Location | Privacy | Latency | Cost | Use Case |
|----------|---------|---------|------|----------|
| `browser` | ★★★★★ | 5ms | $0 | Sensitive local processing |
| `local` | ★★★★★ | 1ms | $0 | Maximum privacy |
| `edge` | ★★★☆☆ | 20ms | $0.0001 | Low latency |
| `cloud` | ★★☆☆☆ | 100ms | $0.01 | Complex compute |

**Sensitivity Rules**:
- `public` → Any location
- `internal` → Not browser
- `confidential` → Local or cloud only
- `restricted` → Local ONLY

## 11.6 Ghost Simulation Layer

4096-dimensional user digital twin:

| Component | Dimensions | Captures |
|-----------|------------|----------|
| **Preference** | 1024 | Communication style, risk tolerance |
| **Behavior** | 1024 | Usage patterns, time preferences |
| **Emotional** | 1024 | Anxiety, frustration thresholds |
| **Knowledge** | 1024 | Domain expertise, vocabulary |

**Simulation Types**:
- `user_reaction` - Predict emotional response
- `outcome_prediction` - Predict task success
- `safety_check` - Identify regret potential
- `cost_estimation` - Predict financial impact

## 11.7 Economic Cortex

Hierarchical budget management:

```
Tenant Budget ($10,000/month)
  └── User Budget ($500/month)
       └── Session Budget ($20/day)
            └── Task Budget ($5)
```

**Model Tiers**:

| Tier | Cost/Token | Quality Score |
|------|------------|---------------|
| `economy` | $0.0001 | 0.70 |
| `selfhosted` | $0.00005 | 0.75 |
| `standard` | $0.0005 | 0.85 |
| `premium` | $0.002 | 0.92 |
| `flagship` | $0.006 | 0.98 |

## 11.8 Tensor-Link Protocol

Vector-based transport for AI communication:

| Data Type | Precision | Size Reduction |
|-----------|-----------|----------------|
| `float32` | Full | Baseline |
| `float16` | Half | 50% |
| `int8` | Quantized | 75% |

**Compression Options**: `none`, `lz4` (fast), `zstd` (better), `quantized`

## 11.9 Database Schema

**18 Tables**:

| Category | Tables |
|----------|--------|
| **MCP** | `mcp_servers`, `mcp_tool_schemas`, `mcp_routing_decisions` |
| **Genesis** | `genesis_tool_requests`, `genesis_tool_results`, `genesis_api_discovery_cache` |
| **Compute** | `liquid_compute_topologies`, `liquid_compute_decisions` |
| **Ghost** | `ghost_vectors`, `ghost_simulations`, `ghost_calibrations` |
| **Economic** | `economic_cortex_configs`, `economic_cortex_budgets`, `economic_cortex_alerts`, `economic_cortex_negotiations`, `economic_cortex_spending` |
| **Tensor** | `tensor_link_sessions`, `tensor_link_messages` |

**13 Enums**: `mcp_transport`, `mcp_auth_type`, `mcp_server_status`, `mcp_health_status`, `tool_category`, `tool_sensitivity`, `genesis_tool_status`, `compute_location`, `compute_reason`, `ghost_simulation_type`, `ghost_confidence_level`, `budget_scope`, `negotiation_strategy`

## 11.10 Admin API Endpoints

**Base**: `/api/admin/organism`

| Category | Endpoints |
|----------|-----------|
| **Dashboard** | `GET /dashboard` |
| **MCP Servers** | `GET/POST /mcp-servers`, `GET/PUT/DELETE /mcp-servers/:id`, `POST /mcp-servers/:id/health`, `POST /mcp-servers/discover`, `POST /mcp-servers/route` |
| **Tools** | `GET/POST /tools`, `GET /tools/:id`, `POST /tools/search`, `POST /tools/find-by-intent` |
| **Genesis** | `GET/POST /genesis/requests`, `GET /genesis/requests/:id`, `GET /genesis/requests/:id/result` |
| **Compute** | `GET/PUT /compute/topology`, `POST /compute/select`, `GET /compute/decisions` |
| **Ghost** | `GET /ghost/vectors/:userId`, `POST /ghost/simulate`, `GET /ghost/calibration/:userId`, `POST /ghost/feedback` |
| **Economic** | `GET/PUT /economic/config`, `GET/POST/PUT /economic/budgets`, `GET /economic/analytics`, `POST /economic/negotiate` |

## 11.11 Admin Dashboard

**URL**: `/platform/organism`

| Tab | Features |
|-----|----------|
| **Overview** | Health metrics, system summary |
| **MCP Servers** | Registry table, health badges, add/edit/remove |
| **Tools** | Schema browser, semantic search |
| **Genesis** | Request form, progress tracking, code viewer |
| **Compute** | Topology configuration, decision history |
| **Ghost** | Simulation runner, calibration charts |

---

# Part 12: Anticipatory Memory Architecture (v7.12.0)

## 12.1 Overview

5 leapfrog features that put RADIANT 3-5 years ahead of Claude's persistent memory:
1. **Autobiographical Knowledge Graph (AKG)** — Auto-extracted entity-relationship graph from every conversation
2. **Predictive Memory Prefetch** — ML-driven speculative memory retrieval
3. **Memory Contradiction Detector** — Truth maintenance across conversations
4. **Organizational Memory Mesh** — Regulatory-compliant shared knowledge (GDPR/HIPAA/SOC2/CCPA)
5. **Dream Insight Generator** — Autonomous insight generation during Twilight Dreaming

## 12.2 Services

| Service | File | Purpose |
|---------|------|---------|
| AKG | `lambda/shared/services/akg.service.ts` | Entity extraction, graph traversal, context building |
| Prefetch | `lambda/shared/services/predictive-prefetch.service.ts` | Access pattern learning, prediction, caching |
| Contradictions | `lambda/shared/services/memory-contradiction-detector.service.ts` | Detection, classification, resolution |
| Org Memory | `lambda/shared/services/org-memory-mesh.service.ts` | Consent, compliance scanning, sharing, erasure |
| Dream Insights | `lambda/shared/services/dream-insight-generator.service.ts` | Generation, surfacing, feedback |

## 12.3 Integration Points

- `brain-router.service.ts` — Injects AKG context, runs async extraction, surfaces dream insights
- `predictive-prefetch.service.ts` — Records access patterns on every AKG query

## 12.4 Database Migration

`V2026_02_06_001__anticipatory_memory_architecture.sql` — 16 tables, 5 enums, 4 helper functions

## 12.5 Admin API

`lambda/admin/anticipatory-memory.ts` — 34 endpoints under `/api/admin/anticipatory-memory/`

## 12.6 Admin Dashboard

`apps/admin-dashboard/app/(dashboard)/memory/anticipatory/page.tsx` — 6 tabs

## 12.7 Shared Types

`packages/shared/src/types/anticipatory-memory.types.ts` — All interfaces for AKG, Prefetch, Contradictions, Org Memory, Dream Insights

---

# Part 13: User Memory Retention & Unified Profile (v7.13.0)

## 13.1 Overview

Three-tier admin-configurable retention policy hierarchy with unified cross-chat, cross-model user memory profiles.

**Policy Hierarchy**: Platform Default (Radiant Super-Admin) → Tenant Override (Think Tank Admin) → Tenant Admin Override (Think Tank Tenant Admin)

**Constraint**: Tenant admin CANNOT exceed tenant-level limits.

## 13.2 Services

| Service | File | Purpose |
|---------|------|---------|
| Retention Policy | `lambda/shared/services/memory-retention-policy.service.ts` | Policy CRUD, hierarchy resolution, pruning, dashboard |
| User Memory Profile | `lambda/shared/services/user-memory-profile.service.ts` | Unified profile builder, prompt injection, model tracking |

## 13.3 Integration

- `brain-router.service.ts` — Injects unified user memory profile into every prompt on every model; records model interactions

## 13.4 Database Migration

`V2026_02_06_002__user_memory_retention.sql` — 6 tables, 3 helper functions

## 13.5 Admin API

`lambda/admin/memory-retention.ts` — 15 endpoints under `/api/admin/memory-retention/`

## 13.6 Admin Dashboards

| App | Route | File |
|-----|-------|------|
| Radiant Admin | `/memory/retention` | `apps/admin-dashboard/app/(dashboard)/memory/retention/page.tsx` |
| Think Tank Admin | `/thinktank-admin/memory-retention` | `apps/admin-dashboard/app/thinktank-admin/memory-retention/page.tsx` |
| Think Tank Tenant Admin | `/thinktank-tenant-admin/memory-retention` | `apps/admin-dashboard/app/thinktank-tenant-admin/memory-retention/page.tsx` |

## 13.7 Shared Types

`packages/shared/src/types/user-memory-retention.types.ts` — Includes `uploaded_documents` and `downloaded_files` as `RetentionTargetType` values. `UserMemoryProfileSummary` includes `uploadedDocuments` and `downloadedFiles` arrays.

## 13.8 Document & File Integration

The unified user memory profile includes uploaded documents and downloaded files — **no exceptions**:
- `uds_uploads` → fetched via `getUserUploadedDocuments()` (up to 20 recent, with extracted text summaries)
- `uds_message_attachments` (type=file) → fetched via `getUserDownloadedFiles()` (up to 10 recent)
- Injected into Brain Router prompt as `[Available Documents]` and `[Generated/Downloaded Files]` sections
- Admin-controllable via `uploadedDocumentsEnabled` and `downloadedFilesEnabled` toggles at all 3 levels
- `maxUploadSizeMb` configurable at platform and tenant levels

---

# Part 14: Cato Trainer — The Grounding Engine (v7.18.0)

## 14.1 Overview

Cato Trainer is a standalone Next.js knowledge base application (`apps/cato-trainer/`, port 3005) that delivers citation-guaranteed AI responses from document libraries using the Cato persona.

## 14.2 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cato Trainer (Next.js 14)                     │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Libraries │ │Documents │ │  Search  │ │ Ask Cato │           │
│  │ Explorer  │ │ Viewer   │ │  Panel   │ │  Chat    │           │
│  └─────┬─────┘ └─────┬────┘ └─────┬────┘ └─────┬────┘          │
│        │              │            │             │               │
│  ┌─────┴──────────────┴────────────┴─────────────┴──────┐       │
│  │              Zustand Store (30+ fields)                │      │
│  └──────────────────────┬───────────────────────────────┘       │
│                         │                                        │
│  ┌──────────────────────┴───────────────────────────────┐       │
│  │              API Service Layer (25+ endpoints)         │      │
│  └──────────────────────┬───────────────────────────────┘       │
└─────────────────────────┼───────────────────────────────────────┘
                          │ HTTP
              ┌───────────┴───────────┐
              │  RADIANT Admin API     │
              │  /api/admin/cato-trainer│
              └───────────────────────┘
```

## 14.3 File Structure

```
apps/cato-trainer/
├── app/
│   ├── globals.css            # Cato teal/cyan design system
│   ├── layout.tsx             # Root layout with React Query
│   ├── page.tsx               # 7-tab routing (library, documents, spaces, search, chat, digest, settings)
│   └── providers.tsx          # React Query provider
├── components/
│   ├── CatoSidebar.tsx        # Left navigation (7 tabs)
│   ├── ChatPanel.tsx          # Grounded Q&A with citation cards
│   ├── SearchPanel.tsx        # Semantic/fulltext/hybrid search
│   ├── LibraryExplorer.tsx    # Library CRUD + status cards
│   ├── DocumentViewer.tsx     # Document list/detail/chunks/smart links
│   └── DigestPanel.tsx        # Multi-document synthesis (6 types)
├── lib/
│   ├── api.ts                 # 15 types, 25+ endpoints
│   ├── cato-trainer-store.ts  # Zustand store (30+ fields)
│   └── utils.ts               # Confidence colors, formatting
├── package.json               # @radiant/cato-trainer
├── tailwind.config.ts         # Cato palette + animations
└── tsconfig.json
```

## 14.4 Platform Integration

- **Swift Deployer**: `RadiantApplication.catoTrainer` (subdomain: `cato`, path: `/cato`, icon: `shield.checkered`, color: teal, tier: Advanced)
- **Admin Dashboard**: Settings → URLs → Cato Trainer field with Shield icon, validation, Quick Link
- **Environment**: `CATO_TRAINER_API_URL` → defaults to `http://localhost:3001/api/admin/cato-trainer`

---

# Part 15: Aurelius Dojo — Backend Wiring (v7.19.0)

## 15.1 Overview

Aurelius Dojo backend wiring connects the existing frontend app (`apps/dojo/`, port 3004) to a dedicated Lambda handler with full database schema. The Dojo Lambda handles 35+ API endpoints across 12 route groups: Libraries, Sessions, Progress, Certifications, Mobot, Config, Decay Engine, Scenarios, Competencies, Dialectic, Multimodal, Pulse, and Archytas.

## 15.2 Database Schema

Migration `V2026_02_06_005__aurelius_dojo.sql` creates:

| Table | Purpose |
|-------|---------|
| `dojo_libraries` | Document library containers per tenant |
| `dojo_documents` | Uploaded files with S3 keys and chunk status |
| `dojo_themes` | AI-discovered Central Themes from libraries |
| `dojo_sessions` | Training sessions (lecture/sparring/review) |
| `dojo_lesson_blocks` | LLM-generated lesson content with citations |
| `dojo_sparring_questions` | Adversarial questions (MC, scenario, open, T/F) |
| `dojo_sparring_results` | User answers with XP and reasoning analysis |
| `dojo_user_progress` | Overall rank, XP, streaks per user |
| `dojo_theme_progress` | Per-theme mastery, accuracy, weaknesses |
| `dojo_certifications` | Formal certification exam results |
| `dojo_mobot_messages` | In-session Knowledge Agent conversations |
| `dojo_knowledge_atoms` | Per-concept units for decay tracking |
| `dojo_decay_curves` | Ebbinghaus decay model per atom/user |
| `dojo_scenario_sessions` | Adversarial scenario instances |
| `dojo_scenario_branches` | Branching consequence trees |
| `dojo_competencies` | Auto-extracted competency graphs |
| `dojo_user_competency_scores` | Per-user competency assessments |
| `dojo_dialectic_sessions` | Socratic dialectic sessions |
| `dojo_dialectic_turns` | Thesis/antithesis/synthesis turns |
| `dojo_multimodal_content` | Audio, diagrams, glossary per lesson |
| `dojo_knowledge_pulse` | Org-wide knowledge health snapshots |
| `dojo_archytas_tool_calls` | Tool Master execution log |
| `dojo_config` | Per-tenant Dojo configuration |

**Enums**: 13 custom PostgreSQL enums (rank_tier, library_status, document_status, session_mode, session_status, question_type, difficulty_tier, persona_archetype, dialectic_role, branch_quality, archytas_tool, archytas_sandbox)

**Helper Functions**: `dojo_calculate_retention()`, `dojo_xp_to_rank()`, `dojo_update_decay_after_review()`

**RLS**: All 19 tables use `app.current_tenant_id` row-level security.

## 15.3 Lambda Handler

```
packages/infrastructure/lambda/admin/dojo.ts
```

Dedicated `APIGatewayProxyHandler` with path-based routing under `/api/admin/dojo/`. Uses the same `executeStatement`, `stringParam`, `longParam` DB client as other admin handlers. AI-dependent features (theme discovery, lesson generation, sparring question generation, scenario responses, dialectic responses, multimodal generation) throw descriptive errors indicating the AI pipeline is required.

## 15.4 CDK Integration

The Dojo Lambda is added to `admin-stack.ts` as a separate `DojoFunction` with its own `LambdaIntegration`. Routes are wired via proxy resource:

```
/admin/dojo          → GET
/admin/dojo/{proxy+} → GET, POST, PUT, DELETE
```

This avoids defining 50+ individual API Gateway resources and routes all Dojo sub-paths to the dedicated Lambda.

---

# APPENDIX B: FILE STRUCTURE

```
packages/
├── infrastructure/
│   ├── lib/
│   │   └── stacks/               # CDK stacks
│   ├── lambda/
│   │   ├── admin/
│   │   │   ├── sovereign-mesh.ts # Admin API
│   │   │   └── dojo.ts           # Aurelius Dojo API (35+ endpoints)
│   │   ├── scheduled/
│   │   │   ├── app-registry-sync.ts
│   │   │   └── hitl-sla-monitor.ts
│   │   └── shared/
│   │       └── services/
│   │           ├── sovereign-mesh/
│   │           │   ├── ai-helper.service.ts
│   │           │   ├── agent-runtime.service.ts
│   │           │   └── index.ts
│   │           ├── cato/         # Genesis Cato
│   │           ├── cortex/       # Cortex Memory System
│   │           │   └── tier-coordinator.service.ts
│   │           └── routing/      # Model Router
│   └── migrations/
│       ├── V2026_01_20_003__sovereign_mesh_agents.sql
│       ├── V2026_01_20_004__sovereign_mesh_apps.sql
│       ├── V2026_01_20_005__sovereign_mesh_ai_helper.sql
│       ├── V2026_01_20_006__sovereign_mesh_preflight.sql
│       ├── V2026_01_20_007__sovereign_mesh_transparency.sql
│       ├── V2026_01_20_008__sovereign_mesh_hitl.sql
│       ├── V2026_01_20_009__sovereign_mesh_replay.sql
│       ├── V2026_01_20_010__sovereign_mesh_seed.sql
│       └── V2026_02_06_005__aurelius_dojo.sql
├── admin-dashboard/
│   └── app/(dashboard)/
│       └── sovereign-mesh/
│           └── page.tsx          # Mesh Dashboard
└── swift-deployer/               # Deployment app
```

---

---

## SENTINEL — Alerting, Monitoring & Incident Response

SENTINEL (Service Engineering Notification, Triage, Incident Navigation, Escalation & Lifecycle) is RADIANT's business continuity nervous system. Ratified v1.0.0 with 3 critical constraints.

### Critical Implementation Constraints

| # | Rule | Description |
|---|------|-------------|
| 1 | **Do Not Build Telephony** | SENTINEL detects; PagerDuty wakes humans. No custom on-call scheduling. |
| 2 | **Shadow Mode First** | 14-day log-only before enabling auto-remediation. Never auto-failover stateful (RDS). |
| 3 | **Push, Don't Poll** | CloudWatch Alarms push to SENTINEL via SNS. Polling reserved for external endpoints only. |

### Architecture

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Data Store** | DynamoDB (Global Tables) | Active alerts, health checks — independent of Aurora |
| **History** | Aurora PostgreSQL | Incident history, postmortems, evidence metadata |
| **Evidence** | S3 Object Lock (WORM) | Immutable forensic evidence for HIPAA/SOC2 |
| **Compute** | AWS Lambda (6 functions) | Watchdog, alert processor, notifier, auto-healer, heartbeat, admin API |
| **Inputs** | CloudWatch Alarms, Synthetic Canaries | Push (internal) + Poll (external) |
| **Outputs** | PagerDuty API, Twilio (fallback), Slack, SES | Multi-path notification guarantee |
| **Scheduling** | EventBridge | Heartbeat every 60s, synthetic checks every 60s |

### Severity Classification

| SEV | Name | Response | Resolution | Notification |
|-----|------|----------|------------|-------------|
| 1 | Critical | < 5 min | < 1 hour | PagerDuty phone + Twilio fallback |
| 2 | Major | < 15 min | < 4 hours | PagerDuty SMS + Slack |
| 3 | Moderate | < 1 hour | < 24 hours | Slack + auto Jira |
| 4 | Low | < 4 hours | < 1 week | Slack + email digest |
| 5 | Info | Next day | As needed | Email digest |

### Admin API (Base: `/api/admin/sentinel`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/dashboard` | GET | Full SENTINEL dashboard with metrics |
| `/health` | GET | Self-health for Pilot Light monitor |
| `/alerts/process` | POST | Process incoming CloudWatch alarm events |
| `/alerts` | GET | List active alerts with filters |
| `/incidents` | GET | List incidents by status/severity |
| `/incidents/:id` | GET | Incident detail with timeline |
| `/incidents/:id/acknowledge` | POST | Acknowledge incident |
| `/incidents/:id/status` | PUT | Update incident lifecycle stage |
| `/health-map` | GET | Service health grid |
| `/synthetic/run` | POST | Trigger synthetic health checks |
| `/semantic/run` | POST | Trigger AI sanity probes |
| `/remediation/rules` | GET | List remediation rules |
| `/remediation/rules/:id/promote` | POST | Promote shadow rule to active |
| `/shadow-mode/log` | GET | Shadow Mode "would have done" entries |
| `/evidence` | GET | List evidence locker snapshots |
| `/evidence/:id/verify` | POST | Verify evidence integrity |
| `/circuit-breakers` | GET | Circuit breaker statuses |
| `/postmortems` | GET/POST | List/create post-mortems |
| `/playbooks` | GET | List response playbooks |
| `/preferences` | GET/PUT | Admin alert preferences |
| `/heartbeat/emit` | POST | Manual heartbeat trigger |

### Dead Man's Switch ("Pilot Light")

```
Primary (us-east-1) ──heartbeat 60s──▶ deadmanssnitch.com
                    ──heartbeat 60s──▶ PagerDuty heartbeat
                    ──heartbeat 60s──▶ Pilot Light (us-west-2, separate account)
                                              │
                                              └── If East goes dark → direct PagerDuty alert
```

### Database Tables (Migration V2026_02_07_011)

| Table | Purpose |
|-------|---------|
| `sentinel_incidents` | Incident lifecycle tracking |
| `sentinel_incident_timeline` | Event timeline per incident |
| `sentinel_evidence_locker` | WORM compliance snapshots |
| `sentinel_remediation_rules` | Remediation rules with Shadow Mode |
| `sentinel_remediation_log` | Auto-heal action audit trail |
| `sentinel_shadow_mode_log` | Shadow "would have done" log |
| `sentinel_postmortems` | Blameless post-incident reviews |
| `sentinel_playbooks` | Pre-built response playbooks |
| `sentinel_alert_preferences` | Per-admin notification preferences |
| `sentinel_notifications` | Notification delivery tracking |

---

## UNIFIED USER PROFILE & MULTI-CONTACT SYSTEM (v7.34.0)

### Architecture

Every user (end-user and platform admin) has a unified profile with a multi-contact directory, verification pipeline, and SENTINEL alert routing integration.

```
┌─────────────────────────────────────────────────────────┐
│                    User Profile API                      │
│              /api/profile (Lambda)                        │
├──────────┬──────────┬──────────┬────────────────────────┤
│ Profile  │ Contacts │ Verify   │ SENTINEL Routing       │
│ CRUD     │ CRUD     │ SMS/Email│ Category→Contact       │
├──────────┴──────────┴──────────┴────────────────────────┤
│          ContactVerificationService                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │Amazon SNS│  │Amazon SES│  │ resolve_sentinel_    │   │
│  │(SMS)     │  │(Email)   │  │ contacts() DB func   │   │
│  └──────────┘  └──────────┘  └──────────────────────┘   │
├──────────────────────────────────────────────────────────┤
│                    Aurora PostgreSQL                      │
│  user_contacts │ user_profiles │ sentinel_contact_routing│
│  contact_verification_log                                │
└──────────────────────────────────────────────────────────┘
```

### Multi-Contact Directory

| Constraint | Value |
|-----------|-------|
| Max emails per user | 3 |
| Max phones per user | 3 |
| Phone format | E.164 (+15551234567) |
| Verification code | 6-digit, bcrypt-hashed |
| Code expiry | 10 minutes |
| Max attempts | 3 per code |
| Cooldown after max | 10 minutes |
| SMS delivery | Amazon SNS (Transactional) |
| Email delivery | Amazon SES |

### SENTINEL Alert Routing

Admins map specific verified contacts to alert categories and severity levels:

```
sentinel_contact_routing
├── admin_id → which admin
├── alert_category → 'security' | 'infrastructure' | '*' | ...
├── min_severity → 1-5 (1 = most severe)
├── contact_id → FK to verified user_contacts
└── enabled → on/off toggle
```

When SENTINEL fires an alert, the notifier calls `resolve_sentinel_contacts(tenant_id, category, severity)` to find all matching admin contacts and dispatches SMS (SNS) or email (SES) directly.

### Profile Completeness Requirements

All users MUST have:
- At least 1 verified email (login email)
- At least 1 verified phone (required for MFA)
- Display name and timezone

Incomplete profiles show a persistent banner across all apps.

---

## SYSTEM ADMINISTRATOR ROLE ENFORCEMENT (v7.34.0)

### Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| `super_admin` | 4 | System administrator — full platform access |
| `admin` | 3 | Platform administrator — tenants, billing, config |
| `operator` | 2 | Operations — deploy, models, monitoring |
| `auditor` | 1 | Read-only — audit logs, reports |

### Permission Matrix (25 permissions)

| Permission | super_admin | admin | operator | auditor |
|------------|:-----------:|:-----:|:--------:|:-------:|
| Create/delete admins | ✅ | ❌ | ❌ | ❌ |
| Change admin roles | ✅ | ❌ | ❌ | ❌ |
| Delete tenants | ✅ | ❌ | ❌ | ❌ |
| Security policies | ✅ | ❌ | ❌ | ❌ |
| Manage tenants | ✅ | ✅ | ❌ | ❌ |
| Manage users | ✅ | ✅ | ❌ | ❌ |
| System config | ✅ | ✅ | ❌ | ❌ |
| Billing | ✅ | ✅ | ❌ | ❌ |
| Models/providers | ✅ | ✅ | ✅ | ❌ |
| Deploy | ✅ | ✅ | ✅ | ❌ |
| SENTINEL access | ✅ | ✅ | ✅ | ❌ |
| Audit logs | ✅ | ✅ | ✅ | ✅ |
| Auto-access all apps | ✅ | ❌ | ❌ | ❌ |

### Enforcement Layers

1. **Next.js middleware** — extracts `adminRole` from JWT, blocks restricted routes, redirects to `/permission-denied`
2. **Lambda admin-role-guard** — `requirePermission()` and `requireSuperAdmin()` middleware functions
3. **Database function** — `check_admin_permission(admin_id, permission)` for DB-level checks

### Bootstrap Flow

- First admin created during deployment = auto `super_admin`
- Only `super_admin` can create other `super_admin` accounts
- Cannot revoke the last `super_admin` (enforced at service layer)
- Full audit trail in `admin_role_audit_log`

### Database Tables

| Table | Purpose |
|-------|---------|
| `user_contacts` | Multi-contact directory (3 emails + 3 phones) |
| `contact_verification_log` | Verification audit trail |
| `user_profiles` | Extended profile fields (bio, timezone, locale) |
| `sentinel_contact_routing` | Per-admin SENTINEL alert routing rules |
| `admin_role_assignments` | Explicit role assignments with bootstrap flag |
| `admin_role_audit_log` | Role change audit trail |
| `admin_app_access` | Per-admin app access grants |

---

## ROLE DOMAIN CLARIFICATION (v7.35.0)

RADIANT has **two distinct role domains** that must never be confused:

### Platform Roles (RADIANT Admin Side)

| Role | Level | RADIANT App Access | Description |
|------|-------|:------------------:|-------------|
| `super_admin` | 4 | ✅ ALL apps | System administrator — inherits admin + RADIANT Admin + all apps |
| `admin` | 3 | ❌ None | Platform infrastructure admin — NO RADIANT app access |
| `operator` | 2 | ❌ None | Operations — deploy, models, monitoring — NO RADIANT app access |
| `auditor` | 1 | ❌ None | Read-only — audit logs, reports — NO RADIANT app access |

**Key rule**: Admin privileges do NOT apply to RADIANT-side apps. Only `super_admin` gets app access.

### Tenant Roles (Customer Side)

| Role | Description |
|------|-------------|
| `tenant_admin` | Full tenant control — auto-assigned to first sign-up user |
| `tenant_owner` | Ownership rights (billing, deletion) |
| `standard_user` | Regular user |
| `viewer` | Read-only user |

---

## TENANT PROVISIONING & SIGN-UP FLOW (v7.35.0)

### Architecture

```
Marketing/Sales Website
        │
        ▼
┌──────────────────────────────────────────────────────┐
│            Tenant Sign-Up API (Public Lambda)         │
│                /api/tenant-signup                      │
├──────────┬──────────┬──────────┬─────────────────────┤
│ Sign-Up  │ Verify   │ Verify   │ Accept              │
│ Request  │ Email    │ Phone    │ Invitation           │
│          │ (SES)    │ (SNS)    │                      │
├──────────┴──────────┴──────────┴─────────────────────┤
│          TenantProvisioningService                    │
│  ┌──────────────────────────────────────────────┐    │
│  │ 1. Create provisioning record                │    │
│  │ 2. Send email code → verify                  │    │
│  │ 3. Send phone code → verify                  │    │
│  │ 4. Create tenant + first user (tenant_admin) │    │
│  │ 5. Create verified contacts + profile        │    │
│  │ 6. Send invitation email                     │    │
│  │ 7. User accepts → tenant active              │    │
│  └──────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────┤
│                  Aurora PostgreSQL                    │
│  tenant_provisioning │ tenant_provisioning_log        │
│  tenants │ users │ user_contacts │ user_profiles      │
└──────────────────────────────────────────────────────┘
```

### Status Lifecycle

```
pending → email_verified → phone_verified → provisioning → provisioned → invitation_sent → active
   │           │                │                                                             
   └→ expired  └→ expired       └→ expired                                    failed ←────────┘
```

### Provisioning Constraints

| Constraint | Value |
|-----------|-------|
| Sign-up expiry | 48 hours |
| Invitation expiry | 72 hours |
| First user role | `tenant_admin` |
| Default apps | Think Tank, Curator, Tenant Admin |
| Email verification | Required (6-digit code via SES) |
| Phone verification | Required (6-digit code via SNS) |
| Max email verify attempts | 5 |
| Max phone verify attempts | 5 |
| Duplicate prevention | Partial unique index on pending email + slug |

### Database Tables

| Table | Purpose |
|-------|---------|
| `tenant_provisioning` | Full lifecycle tracking for each sign-up |
| `tenant_provisioning_log` | Audit trail for provisioning events |

---

## Unified Drift-Aware Weighting System (v7.36.0)

Centralizes AI drift control and model weighting across all RADIANT components.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  DriftAwareWeightingService                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Drift        │  │ Drift        │  │ App Weight           │  │
│  │ Detection    │──│ Correction   │──│ Profiles             │  │
│  │ (KS,PSI,χ²) │  │ (quarantine, │  │ (Genesis,Cato,       │  │
│  │              │  │  penalties)  │  │  Cortex,Omega,...)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└────────┬──────────────┬──────────────┬──────────────┬──────────┘
         │              │              │              │
    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
    │ AGI     │   │ Cato    │   │ Cortex  │   │ Omega   │
    │ Orch.   │   │ Pipeline│   │ Intel.  │   │ Shadow  │
    └─────────┘   └─────────┘   └─────────┘   └─────────┘
                        │
                   ┌────▼────┐
                   │ Genesis │
                   │ Gates   │
                   └─────────┘
```

### Composite Score Formula

```
compositeScore = Σ(normalizedWeight[i] × factorScore[i])
  where factors = [drift, quality, latency, cost, availability]
  weights normalized per-app to sum to 1.0
  stability penalty applied if preferStableModels && driftScore < 0.7
  manual override replaces composite if set by admin
```

### Integration Points

| Component | Integration Type | What It Does |
|-----------|-----------------|--------------|
| **AGI Orchestrator** | Primary model selection | Drift-aware models selected first, domain/specialty fallback |
| **Cato Pipeline** | Method-level model selection | Replaces hardcoded model with drift-aware best model |
| **Cortex Intelligence** | Insight enrichment | Drift recommendations included in CortexInsights |
| **Omega Shadow** | Comparison tracking | Drift health recorded alongside each shadow comparison |
| **Genesis Gates** | Stage advancement guard | Blocks unsafe stage advancement when models are drifting |

### Drift Detection Methods

| Method | Statistic | Threshold | Purpose |
|--------|-----------|-----------|---------|
| **Kolmogorov-Smirnov** | Max CDF distance | configurable | Continuous distribution shift |
| **Population Stability Index** | Bin-based divergence | configurable | Binned distribution stability |
| **Chi-Squared** | Category frequency | configurable | Categorical data shifts |
| **Embedding Distance** | Cosine distance | configurable | Semantic representation drift |

### Correction Actions

| Action | Trigger | Effect |
|--------|---------|--------|
| **No action** | driftScore ≥ penaltyThreshold | Model continues normally |
| **Weight penalty** | driftScore < penaltyThreshold | Composite weight reduced, temperature/prompt corrections applied |
| **Quarantine** | driftScore < quarantineThreshold | Model excluded from selection, fallback activated |
| **Auto-release** | Drift score recovers | Quarantine lifted after configured period |

### Files

| File | Purpose |
|------|---------|
| `drift-aware-weighting.service.ts` | Unified facade — single API for all apps |
| `drift-detection.service.ts` | Statistical drift detection (KS, PSI, χ², embedding) |
| `drift-correction.service.ts` | Quarantine, fallback, weight penalties, composite weights |

---

## Universal Drift Enforcement & Genesis Feedback Loop (v7.37.0)

Extends the drift-aware weighting system to cover **ALL 52+ services** that invoke AI models, and adds a real-time telemetry feedback loop into Genesis gate decisions.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    52+ AI Services                          │
│  causal-reasoning, dream-insight, skill-execution,          │
│  agi-complete, consciousness, hallucination-detection, ...  │
└────────────────────────┬────────────────────────────────────┘
                         │ modelRouterService.invoke()
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              ModelRouterService (v7.37.0)                    │
│  ┌──────────────────┐  ┌──────────────────────────────┐     │
│  │ Phase 1: Proactive│  │ Phase 2: Legacy Fallback     │     │
│  │ isModelSafe()     │  │ getBestModel() correction    │     │
│  │ getBestModel()    │  │ quarantine/fallback/temp     │     │
│  └────────┬─────────┘  └──────────────┬───────────────┘     │
│           │                            │                     │
│           ▼                            ▼                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Model Invocation (Bedrock/LiteLLM/Direct)    │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │  Telemetry: recordInvocationTelemetry()              │   │
│  │  → In-memory ring buffer (10K/tenant, 1hr window)    │   │
│  │  → drift_invocation_telemetry table (partitioned)    │   │
│  └──────────────────────┬───────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           Genesis Gate Assessment (v7.37.0)                  │
│  isDriftHealthyForStage() checks:                            │
│  ├── Static: avg drift score, quarantined count              │
│  ├── Real-time: overallHealthScore (drift+reroute+failure)   │
│  ├── Real-time: failure rate per stage threshold             │
│  └── Real-time: reroute rate per stage threshold             │
└─────────────────────────────────────────────────────────────┘
```

### Database

| Table | Purpose |
|-------|---------|
| `drift_invocation_telemetry` | Partitioned (monthly) telemetry for all model invocations. RLS per tenant. 7-day retention. |

| Function | Purpose |
|----------|---------|
| `get_genesis_drift_feedback()` | SQL aggregation: total/rerouted/failed invocations, rates, health score |
| `cleanup_drift_telemetry()` | Delete records older than retention period |

### Enforcement Policy

`.windsurf/workflows/drift-detection-enforcement.md` — mandatory for all new services:
- All `modelRouterService.invoke()` calls MUST include `tenantId`
- No hardcoded model selection without drift fallback
- No direct LLM API calls bypassing the model router
- New app components MUST have weight profiles

---

## Enforced Logging Policy (v7.37.2)

Establishes mandatory structured logging for all Lambda services via the **Logging Registry** (`logging-registry.service.ts`).

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  All Lambda Services                         │
│  security-alert, sentinel-processor, sentinel-notifier,      │
│  billing, admin, ai, cato, workflow, ...                     │
└────────────────────────┬────────────────────────────────────┘
                         │ createRegisteredLogger() / withEnforcedLogging()
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           Logging Registry Service (v7.37.2)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  RegisteredLogger                                     │   │
│  │  → Structured JSON to stdout (CloudWatch)             │   │
│  │  → Auto-registers in log_source_registry              │   │
│  │  → Categorized: security, audit, billing, access, ... │   │
│  └──────────────────────┬───────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           Log Retention Policy Service                       │
│  detectComplianceIssues() flags:                             │
│  ├── Unenforced sources → CRITICAL compliance issue          │
│  ├── Stale sources (7d+) → WARNING                           │
│  └── Immutability gaps → WARNING                             │
│                                                              │
│  getLoggingCoverageReport() reports:                         │
│  ├── Total/enforced/unenforced source counts                 │
│  ├── Per-category breakdown                                  │
│  └── Stale source identification                             │
└─────────────────────────────────────────────────────────────┘
```

### Database

| Table | Purpose |
|-------|---------|
| `log_source_registry` | Tracks all registered logging sources: service name, category, source type, enforcement status, last seen timestamp |

### Log Storage Pipeline

```
Services → stdout (structured JSON) → CloudWatch Log Groups
                                           ↓
                              LogIndexerService (hourly, EventBridge)
                                           ↓
                              S3 (gzip, KMS encrypted, warm tier)
                                           ↓ (90 days)
                              Glacier (cold tier)
                                           ↓ (~7 years)
                              Glacier Deep Archive
```

- **Index pointers**: `log_index` table — SHA-256 hash, byte size, retention expiry per archived batch
- **Tamper evidence**: `log_merkle_chain` table — Merkle hash chain for immutable categories
- **Auto-discovery**: `LogIndexerService.autoDiscoverSources()` finds new CloudWatch log groups matching `radiant-*`

### Redaction Policy

Redaction is **disabled by default** in the legacy `enhancedLogger` (opt-in via `LOG_REDACT_SENSITIVE=true`). The new `RegisteredLogger` has no redaction. Regulatory compliance is enforced at dedicated layers:

| Compliance | Enforcement Layer |
|------------|------------------|
| HIPAA PHI | `hipaa-phi-sanitization` middleware |
| GDPR erasure | `erasure.service.ts` + data retention policies |
| SOC2 audit | `log-tamper-verification.service.ts` + immutable archives |
| Log retention | `log-retention-policy.service.ts` (per-tenant, per-category) |

### Enforcement Policy

`.windsurf/workflows/enforced-logging-policy.md` — mandatory for all services:
- All services MUST use `createRegisteredLogger()` or `withEnforcedLogging()`
- No `console.log`, `console.error`, `console.warn` allowed
- No legacy `enhancedLogger` imports allowed
- Service names must follow `domain/service-name` convention
- Log categories must match `LogCategory` enum for retention compliance

---

## System Administrator Separation — Dual Identity Plane (v7.38.0)

Separates system administrators from tenant users into isolated identity domains with a service layer firewall enforced at the API Gateway level.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      RADIANT PLATFORM                                │
│                                                                      │
│  ┌────────────────────────────┐   ┌────────────────────────────────┐│
│  │  SYSTEM ADMIN PLANE        │   │  TENANT PLANE                  ││
│  │                            │   │                                ││
│  │  Cognito Pool B            │   │  Cognito Pool A                ││
│  │  (system-admins)           │   │  (end-users + tenant-admins)   ││
│  │                            │   │                                ││
│  │  system_admins table       │   │  users + administrators        ││
│  │  (NO tenant_id, NO RLS)    │   │  (tenant-scoped, RLS)          ││
│  │                            │   │                                ││
│  │  Apps: Radiant Admin ONLY  │   │  Apps: Think Tank, Curator,    ││
│  │  ❌ Think Tank             │   │  Genesis, Dojo, Cato, TT Admin ││
│  │  ❌ Curator                │   │  ❌ Radiant Admin              ││
│  │  ❌ Genesis                │   │                                ││
│  └──────────┬─────────────────┘   └──────────┬─────────────────────┘│
│             │                                 │                      │
│             ▼                                 ▼                      │
│  ┌──────────────────┐              ┌─────────────────────┐          │
│  │ Admin API GW     │              │ Tenant API GW       │          │
│  │ Auth: Pool B     │              │ Auth: Pool A         │          │
│  │ REJECTS Pool A   │              │ REJECTS Pool B       │          │
│  └──────────────────┘              └─────────────────────┘          │
│                                                                      │
│  SENTINEL Dual-Resolution:                                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ resolve_system_admin_contacts() → system_admin_alert_routing │   │
│  │ resolve_sentinel_contacts()     → sentinel_contact_routing   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Database (No RLS)

| Table | Purpose |
|-------|---------|
| `system_admins` | Global admin accounts (no tenant scope) |
| `system_admin_contacts` | Verified email/phone for alert routing |
| `system_admin_alert_routing` | SENTINEL alert → contact mapping |
| `system_admin_audit_log` | Admin lifecycle events |
| `system_admin_contact_verification_log` | Verification audit trail |

### Auth Middleware

| Middleware | Pool | Scope | Used By |
|-----------|------|-------|---------|
| `system-admin-auth.ts` → `extractSystemAdminContext()` | Pool B | Global | Radiant Admin API |
| `shared/auth.ts` → `extractAuthContext()` | Pool A | Tenant-scoped | All consumer apps |
| `admin-role-guard.ts` | Legacy | Re-exports system admin utilities | Backwards compat |

### Bootstrap Flow

```
Deployment (Swift Deployer / CLI)
    → Cognito Pool B: AdminCreateUser (email, temp password, MFA required)
    → SQL: bootstrap_system_admin() → system_admins (status: pending_setup)
    → First login: password change → MFA enroll → phone verify → active
```

### Enforcement Policy

`.windsurf/workflows/admin-access-control.md` — updated for v7.38.0:
- Admin API handlers MUST use `extractSystemAdminContext()` from Pool B
- Tenant API handlers MUST use `extractAuthContext()` from Pool A
- System admin data MUST NOT have tenant_id
- Pool A tokens MUST be rejected by admin API Gateway
- Pool B tokens MUST be rejected by tenant API Gateway

---

*Document Version: 7.4.0*
*Last Updated: February 7, 2026*
*Platform: RADIANT - The Autonomous Organism*
