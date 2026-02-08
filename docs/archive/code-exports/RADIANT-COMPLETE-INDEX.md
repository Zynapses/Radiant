# RADIANT v4.18.0 - Complete Source Code Export

**For Gemini Assessment**
**Export Date**: January 9, 2026
**Total Source Files**: 1,484

---

## Executive Summary

**RADIANT** (Real-time AI Decision Intelligence And Neural Technology) is a **multi-tenant AWS SaaS platform** for enterprise AI model access, orchestration, and management. It consists of three primary components:

1. **Swift Deployer App** - macOS native application for infrastructure deployment
2. **AWS Infrastructure** - CDK-defined serverless backend with 14+ stacks
3. **Admin Dashboard** - Next.js web interface for platform administration

The platform also includes **Think Tank**, a consumer-facing AI assistant with advanced features like procedural memory (The Grimoire), cost optimization (Economic Governor), and multi-model orchestration.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           RADIANT Platform v4.18.0                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         CLIENT APPLICATIONS                              │   │
│  │  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐   │   │
│  │  │  Swift Deployer   │  │  Admin Dashboard  │  │   Think Tank UI   │   │   │
│  │  │  (macOS Native)   │  │  (Next.js 14)     │  │   (React/Next)    │   │   │
│  │  └───────────────────┘  └───────────────────┘  └───────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                          API GATEWAY LAYER                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │   │
│  │  │  REST API   │  │ WebSocket   │  │  Auth API   │  │  Admin API  │   │   │
│  │  │  /api/v2    │  │  /ws        │  │  /auth      │  │  /admin     │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        LAMBDA FUNCTIONS LAYER                            │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐  │   │
│  │  │   Brain   │ │  Think    │ │  Billing  │ │   Cato    │ │ Governor │  │   │
│  │  │  Router   │ │  Tank     │ │  Metering │ │  Safety   │ │   API    │  │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └──────────┘  │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐  │   │
│  │  │ Grimoire  │ │  Admin    │ │ Artifact  │ │   Ego     │ │  Domain  │  │   │
│  │  │   API     │ │  Handlers │ │  Engine   │ │  Service  │ │ Taxonomy │  │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └──────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                          AI SERVICES LAYER                               │   │
│  │  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐  │   │
│  │  │      LiteLLM        │  │   Self-Hosted       │  │   External      │  │   │
│  │  │   (Proxy/Router)    │  │   Models (56)       │  │   APIs (50)     │  │   │
│  │  └─────────────────────┘  └─────────────────────┘  └─────────────────┘  │   │
│  │  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐  │   │
│  │  │   Consciousness     │  │   Flyte Workflows   │  │  Formal         │  │   │
│  │  │   Engine            │  │   (Python)          │  │  Reasoning      │  │   │
│  │  └─────────────────────┘  └─────────────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         DATA PERSISTENCE LAYER                           │   │
│  │  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐  │   │
│  │  │  Aurora PostgreSQL  │  │   ElastiCache       │  │   S3 Storage    │  │   │
│  │  │  (160+ migrations)  │  │   (Redis)           │  │   (Artifacts)   │  │   │
│  │  │  + pgvector         │  │                     │  │                 │  │   │
│  │  └─────────────────────┘  └─────────────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
radiant/
├── VERSION                          # "4.18.0"
├── RADIANT_VERSION                  # "4.18.0"  
├── THINKTANK_VERSION                # "3.2.0"
├── VERSION_HISTORY.json             # All releases with hashes
│
├── apps/                            # Client Applications
│   ├── swift-deployer/              # macOS Deployer (36 Swift files)
│   │   ├── Sources/RadiantDeployer/
│   │   │   ├── Models/              # Data models
│   │   │   ├── Services/            # AWS, API, AI services
│   │   │   ├── Views/               # SwiftUI views
│   │   │   └── Components/          # Reusable UI components
│   │   └── Package.swift
│   │
│   └── admin-dashboard/             # Next.js Admin UI (~120 TSX files)
│       ├── app/(dashboard)/         # Dashboard pages
│       │   ├── brain/               # Brain Router config
│       │   ├── cato/                # Safety system admin
│       │   ├── thinktank/           # Think Tank features
│       │   ├── models/              # AI model management
│       │   └── billing/             # Billing & usage
│       ├── components/              # React components
│       └── lib/                     # Utilities
│
├── packages/                        # Core Packages
│   ├── shared/                      # @radiant/shared (~80 TS files)
│   │   └── src/
│   │       ├── types/               # TypeScript type definitions
│   │       └── constants/           # Shared constants
│   │
│   ├── infrastructure/              # @radiant/infrastructure (~500 files)
│   │   ├── lib/stacks/              # 14+ CDK stacks
│   │   ├── lambda/                  # Lambda handlers
│   │   │   ├── admin/               # Admin API handlers
│   │   │   ├── api/                 # Public API handlers
│   │   │   ├── brain/               # Brain Router
│   │   │   ├── thinktank/           # Think Tank APIs
│   │   │   └── shared/              # Shared services
│   │   │       └── services/        # Core business logic
│   │   └── migrations/              # 160+ SQL migrations
│   │
│   └── flyte/                       # Python Workflows (6 files)
│       ├── workflows/               # Flyte task definitions
│       └── utils/                   # Python utilities
│
├── config/                          # Configuration
│   └── ethics/presets/              # Ethics framework presets
│
└── docs/                            # Documentation
    ├── RADIANT-ADMIN-GUIDE.md       # Platform admin guide
    ├── THINKTANK-ADMIN-GUIDE.md     # Think Tank admin guide
    └── exports/                     # Source exports (this directory)
```

---

## Component Details

### 1. Swift Deployer App (36 files)

**Purpose**: Native macOS application for deploying and managing RADIANT infrastructure on AWS.

| Directory | Files | Description |
|-----------|-------|-------------|
| `Models/` | 8 | Data models (Configuration, Deployment, Credentials, etc.) |
| `Services/` | 21 | AWS, CDK, API, AI, Database, Deployment services |
| `Views/` | 3 | SwiftUI view controllers |
| `Components/` | 4 | Reusable UI components |

**Key Features**:
- One-click AWS infrastructure deployment
- Real-time deployment progress tracking
- Multi-region support
- 1Password credential integration
- AI-powered deployment assistant
- Secure local storage (SQLCipher)

### 2. AWS Infrastructure (500+ files)

**Purpose**: CDK-defined serverless backend with all Lambda functions, stacks, and configurations.

#### CDK Stacks (14 stacks)

| Stack | Purpose |
|-------|---------|
| `admin-stack.ts` | Admin API and dashboard backend |
| `ai-stack.ts` | AI model integration and routing |
| `api-stack.ts` | Public REST API |
| `auth-stack.ts` | Cognito authentication |
| `batch-stack.ts` | Batch processing jobs |
| `brain-stack.ts` | Brain Router orchestration |
| `cato-genesis-stack.ts` | Consciousness engine |
| `cato-redis-stack.ts` | Cato Safety with Redis |
| `database-stack.ts` | Aurora PostgreSQL |
| `grimoire-stack.ts` | Procedural memory system |
| `storage-stack.ts` | S3 artifact storage |
| `thinktank-stack.ts` | Think Tank features |
| `tier-transition-stack.ts` | Tenant tier upgrades |
| `vpc-stack.ts` | VPC and networking |

#### Lambda Services (100+ handlers)

| Category | Handlers | Purpose |
|----------|----------|---------|
| `admin/` | 20+ | Admin dashboard APIs |
| `api/` | 10+ | Public model/chat APIs |
| `brain/` | 5+ | Brain Router orchestration |
| `thinktank/` | 15+ | Think Tank features |
| `billing/` | 5+ | Usage metering and billing |
| `shared/services/` | 40+ | Core business logic services |

### 3. Admin Dashboard (120+ files)

**Purpose**: Next.js 14 web application for platform administration.

| Section | Pages | Features |
|---------|-------|----------|
| Brain | 8 | Router config, cognition, dreams, oversight |
| Cato | 6 | Safety personas, CBF, audit, recovery |
| Think Tank | 15+ | Grimoire, Governor, Ego, domains, artifacts |
| Models | 5 | Model management, thermal controls |
| Billing | 3 | Usage, credits, invoices |
| Compliance | 4 | HIPAA, SOC2, audit logs |
| Settings | 5 | Configuration, timeouts, i18n |

### 4. Database Schema (160+ migrations)

**Purpose**: PostgreSQL schema with Row-Level Security for multi-tenancy.

| Migration Range | Features |
|-----------------|----------|
| 001-009 | Core schema, tenants, models, billing |
| 010-019 | Brain Router, analytics, Think Tank |
| 020-029 | Collaboration, memory, orchestration |
| 030-039 | Isolation, i18n, billing credits |
| 040-049 | Artifacts, scheduled prompts, domains |
| 050-099 | Brain plans, formal reasoning, ego |
| 100-129 | Consciousness, learning, metrics |
| 130-160 | Cato safety, PHI sanitization |

### 5. Flyte Workflows (6 files)

**Purpose**: Python-based workflow orchestration for Think Tank.

| File | Purpose |
|------|---------|
| `grimoire_tasks.py` | Procedural memory management |
| `think_tank_workflow.py` | HITL reasoning workflow |
| `db.py` | RLS-safe database connections |
| `embeddings.py` | Vector embedding generation |
| `cato_client.py` | Safety validation client |
| `__init__.py` | Module exports |

---

## Key Features

### 1. Multi-Tenant Architecture
- Row-Level Security (RLS) on all tables
- Tenant context via `app.current_tenant_id`
- Isolated data per tenant

### 2. 106 AI Models
- 50 external providers (OpenAI, Anthropic, Google, etc.)
- 56 self-hosted models (medical, scientific, etc.)
- LiteLLM proxy for unified access

### 3. Brain Router
- 9 orchestration modes (thinking, coding, creative, etc.)
- Domain-aware model selection
- Affect-based hyperparameter mapping

### 4. Consciousness Engine
- Ego system for persistent identity
- Affective state management
- Ethics framework selection

### 5. Cato Safety
- 5-layer security stack
- Control Barrier Functions (CBF)
- Merkle audit trail
- 5 mood personas

### 6. The Grimoire
- Self-optimizing procedural memory
- Vector embeddings for semantic search
- Automatic learning from successes

### 7. Economic Governor
- System 0 complexity classification
- Cost-optimized model routing
- Per-domain configuration

---

## Export File Index

This export is split into multiple parts by component:

| Part | File | Contents | Lines |
|------|------|----------|-------|
| 00 | `RADIANT-COMPLETE-INDEX.md` | This master index | - |
| 01 | `RADIANT-SWIFT-DEPLOYER.md` | Swift Deployer App (all 36 files) | ~5,000 |
| 02 | `RADIANT-CDK-STACKS.md` | CDK Stack definitions (14 files) | ~3,000 |
| 03 | `RADIANT-LAMBDA-ADMIN.md` | Admin Lambda handlers | ~4,000 |
| 04 | `RADIANT-LAMBDA-API.md` | Public API Lambda handlers | ~3,000 |
| 05 | `RADIANT-LAMBDA-BRAIN.md` | Brain Router handlers | ~2,000 |
| 06 | `RADIANT-LAMBDA-THINKTANK.md` | Think Tank handlers | ~3,000 |
| 07 | `RADIANT-LAMBDA-SERVICES.md` | Shared services | ~8,000 |
| 08 | `RADIANT-SHARED-TYPES.md` | Type definitions | ~4,000 |
| 09 | `RADIANT-DASHBOARD-PAGES.md` | Admin dashboard pages | ~6,000 |
| 10 | `RADIANT-DASHBOARD-COMPONENTS.md` | Dashboard components | ~4,000 |
| 11 | `RADIANT-MIGRATIONS.md` | Database migrations | ~8,000 |
| 12 | `RADIANT-FLYTE-WORKFLOWS.md` | Python workflows | ~2,000 |

**Estimated Total**: ~52,000 lines of source code

---

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui |
| **Desktop** | Swift 5.9, SwiftUI, macOS 13+, SQLCipher |
| **Backend** | AWS Lambda, Node.js 20, TypeScript |
| **Database** | Aurora PostgreSQL 15, pgvector, ElastiCache Redis |
| **AI** | LiteLLM, 106 models, SageMaker endpoints |
| **Infra** | AWS CDK, CloudFormation, VPC, API Gateway |
| **Workflows** | Flyte, Python 3.11 |
| **Auth** | Cognito, JWT, RBAC |

---

## How It Works (Narrative)

### User Journey: Think Tank Query

1. **User submits prompt** via Think Tank UI
2. **Domain Detection** identifies field/specialty
3. **Brain Router** selects orchestration mode
4. **Grimoire** consulted for relevant heuristics
5. **Governor** evaluates complexity, selects optimal model
6. **Cato Safety** validates request
7. **LiteLLM** routes to selected model
8. **Response generated** with consciousness context
9. **Librarian reviews** for learning opportunities
10. **Metrics logged** for billing and analytics

### Admin Journey: Model Management

1. **Admin logs in** via Cognito
2. **Dashboard** shows system health
3. **Models page** lists all 106 models
4. **Enable/disable** models per tenant
5. **Set pricing** and usage limits
6. **Monitor usage** in real-time
7. **Review compliance** reports
8. **Manage billing** and credits

### Deployment Journey: New Installation

1. **Open Swift Deployer** on macOS
2. **Configure AWS credentials** (1Password integration)
3. **Select region** and environment
4. **AI Assistant** guides through setup
5. **One-click deploy** runs CDK stacks
6. **Progress tracked** in real-time
7. **Health checks** verify deployment
8. **Admin invited** via email

---

## Security Model

### Multi-Tenant Isolation
- Every table has `tenant_id` column
- RLS policies enforce tenant boundaries
- `SET app.current_tenant_id` before all queries

### Authentication
- Cognito user pools per tenant
- JWT tokens with tenant claims
- API Gateway authorizers

### Safety (Cato)
- 5-layer security stack
- Control Barrier Functions (CBF)
- Fail-closed for writes
- Human escalation workflow

### Compliance
- HIPAA-ready with PHI sanitization
- SOC2 audit logging
- Data retention policies
- Self-audit checklists

---

*Companion export files follow with full source code...*
