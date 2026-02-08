# RADIANT Platform v4.18.2
## Complete Documentation

---

**Multi-Tenant AWS SaaS Platform for AI Model Access & Orchestration**

Version: 4.18.2 | Last Updated: December 28, 2024

---

# Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Architecture](#2-architecture)
3. [Deployment Guide](#3-deployment-guide)
4. [Administrator Guide](#4-administrator-guide)
5. [Think Tank User Guide](#5-think-tank-user-guide)
6. [API Reference](#6-api-reference)
7. [Changelog](#7-changelog)

---

# 1. Platform Overview

## 1.1 What is RADIANT?

RADIANT is a multi-tenant AWS SaaS platform providing unified access to 106+ AI models through:

- **50 External Provider Models**: OpenAI, Anthropic, Google, xAI, DeepSeek, and more
- **56 Self-Hosted Models**: Running on AWS SageMaker for cost control and privacy
- **Intelligent Routing**: Brain router for optimal model selection
- **Neural Engine**: Personalization learning from user interactions

## 1.2 Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Swift Deployer App** | `apps/swift-deployer/` | macOS app that deploys infrastructure |
| **AWS Infrastructure** | `packages/infrastructure/` | CDK stacks, Lambdas, databases |
| **Admin Dashboard** | `apps/admin-dashboard/` | Next.js web admin interface |
| **Think Tank** | Consumer product | AI chat interface for end users |

## 1.3 Technology Stack

- **Swift App**: SwiftUI, macOS 13.0+, Swift 5.9+, Xcode 15+, SQLCipher
- **Infrastructure**: AWS CDK (TypeScript), Aurora PostgreSQL, Lambda, API Gateway
- **Dashboard**: Next.js 14, TypeScript, Tailwind CSS
- **AI Integration**: 106+ models, LiteLLM proxy

---

# 2. Architecture

## 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RADIANT Platform                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │  Think Tank │  │    Admin    │  │   Swift     │                  │
│  │  (Consumer) │  │  Dashboard  │  │  Deployer   │                  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │
│         │                │                │                          │
│  ┌──────┴────────────────┴────────────────┴──────┐                  │
│  │              API Gateway + Lambda              │                  │
│  └──────────────────────┬────────────────────────┘                  │
│                         │                                            │
│  ┌──────────────────────┴────────────────────────┐                  │
│  │              AGI Orchestration                 │                  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐         │                  │
│  │  │  Brain  │ │ Neural  │ │ Domain  │         │                  │
│  │  │ Router  │ │ Engine  │ │Taxonomy │         │                  │
│  │  └─────────┘ └─────────┘ └─────────┘         │                  │
│  └──────────────────────┬────────────────────────┘                  │
│                         │                                            │
│  ┌──────────────────────┴────────────────────────┐                  │
│  │              AI Model Layer                    │                  │
│  │  ┌─────────────────┐ ┌─────────────────┐      │                  │
│  │  │ External APIs   │ │ Self-Hosted     │      │                  │
│  │  │ (50 models)     │ │ (56 models)     │      │                  │
│  │  └─────────────────┘ └─────────────────┘      │                  │
│  └───────────────────────────────────────────────┘                  │
│                                                                      │
│  ┌───────────────────────────────────────────────┐                  │
│  │              Data Layer                        │                  │
│  │  Aurora PostgreSQL │ S3 │ ElastiCache         │                  │
│  └───────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

## 2.2 CDK Stacks

| Stack | Purpose |
|-------|---------|
| **NetworkStack** | VPC, subnets, security groups |
| **DatabaseStack** | Aurora PostgreSQL, secrets |
| **CacheStack** | ElastiCache Redis |
| **StorageStack** | S3 buckets, CloudFront |
| **AuthStack** | Cognito, JWT validation |
| **APIStack** | API Gateway, Lambda functions |
| **AIStack** | SageMaker endpoints, LiteLLM |
| **MonitoringStack** | CloudWatch, alarms, dashboards |

## 2.3 Database Schema

Key tables:
- `tenants` - Multi-tenant organization data
- `users` - User accounts with tenant association
- `ai_models` - Model registry with capabilities
- `ai_providers` - External API provider configs
- `usage_logs` - Request/token tracking
- `billing_*` - Subscriptions, credits, transactions
- `delight_*` - Personality system data

---

# 3. Deployment Guide

## 3.1 Prerequisites

### AWS Account Setup

| Requirement | Action | Verification |
|-------------|--------|--------------|
| AWS Account | Create or use existing | Account ID available |
| IAM User | Create with AdministratorAccess | Access keys configured |
| AWS CLI | Install and configure | `aws sts get-caller-identity` |
| Route 53 Domain (optional) | Register domain | Domain in hosted zone |

### Development Environment

| Requirement | Version | Verification |
|-------------|---------|--------------|
| Node.js | 20.x LTS | `node --version` |
| pnpm | 8.x+ | `pnpm --version` |
| AWS CDK CLI | 2.x | `cdk --version` |
| Xcode | 15.x+ | `xcode-select -p` |
| Swift | 5.9+ | `swift --version` |

## 3.2 Quick Start

### Automated Deployment

```bash
# Deploy to dev environment
./scripts/deploy.sh --environment dev

# Deploy to staging
./scripts/deploy.sh --environment staging

# Deploy to production
./scripts/deploy.sh --environment prod
```

> **Note:** RADIANT uses a unified deployment model. All features are available in every deployment. Licensing restrictions are handled at the application level, not infrastructure level.

### Verify Deployment

```bash
./scripts/verify-deployment.sh --environment dev
```

## 3.3 Manual Deployment

### Step 1: Install Dependencies

```bash
cd radiant
pnpm install
```

### Step 2: Build Packages

```bash
# Shared types
cd packages/shared && npm run build

# Lambda functions
cd packages/infrastructure/lambda && npm install && npm run build

# Admin dashboard
cd apps/admin-dashboard && npm install && npm run build
```

### Step 3: Deploy CDK Stacks

```bash
cd packages/infrastructure

# Bootstrap (first time only)
cdk bootstrap aws://ACCOUNT_ID/REGION

# Deploy all stacks
cdk deploy --all --require-approval never
```

## 3.4 Swift Deployer App

The Swift Deployer provides a GUI for deployment:

1. Launch the app: `swift run` from `apps/swift-deployer/`
2. Configure AWS credentials
3. Select environment (dev/staging/prod)
4. Click Deploy

Features:
- AI Assistant for deployment guidance
- Real-time deployment logs
- Rollback support
- Configuration management

---

# 4. Administrator Guide

## 4.1 Administrator Roles

| Role | Permissions | Use Case |
|------|-------------|----------|
| **Super Admin** | Full access to all features | Platform owner |
| **Admin** | Tenant management, billing, models | Operations team |
| **Operator** | Read access, limited actions | Support team |
| **Auditor** | Read-only access to logs | Compliance team |

## 4.2 Dashboard Overview

Access at: `https://admin.your-domain.com`

### Main Sections

| Section | Purpose |
|---------|---------|
| **Dashboard** | System health, key metrics |
| **Tenants** | Manage organizations |
| **Users** | User accounts, permissions |
| **Models** | AI model configuration |
| **Providers** | External API providers |
| **Billing** | Subscriptions, credits |
| **Orchestration** | AGI settings, weights |
| **Think Tank** | Delight, domains, plans |
| **Audit** | Activity logs, compliance |

## 4.3 Tenant Management

### Creating a Tenant

1. Navigate to **Tenants → Create New**
2. Enter organization details
3. Configure limits and quotas
4. Assign initial administrator
5. Set billing plan

### Tenant Settings

| Setting | Description |
|---------|-------------|
| Name | Organization display name |
| Slug | URL-friendly identifier |
| Status | active, suspended, trial |
| Plan | Subscription tier |
| Limits | API calls, storage, users |

## 4.4 AI Model Configuration

### Model Properties

| Property | Description |
|----------|-------------|
| Provider | OpenAI, Anthropic, etc. |
| Model ID | Provider's model identifier |
| Display Name | User-facing name |
| Capabilities | text, vision, code, etc. |
| Pricing | Input/output token costs |
| Status | enabled, disabled, beta |

### Self-Hosted Models

Configure SageMaker endpoints:
1. Navigate to **Models → Self-Hosted**
2. Add endpoint ARN
3. Configure scaling
4. Set health checks

## 4.5 Billing Administration

### Subscription Plans

| Plan | Credits/Month | Features |
|------|---------------|----------|
| Free | 100 | Basic models |
| Starter | 1,000 | All external models |
| Pro | 10,000 | + Self-hosted models |
| Team | 50,000 | + Collaboration |
| Business | 200,000 | + Priority support |

### Credit Management

- View credit balances
- Add bonus credits
- Set usage alerts
- Export billing reports

## 4.6 AGI Orchestration Settings

### Service Weights

Adjust influence of AGI components:

| Service | Default Weight | Purpose |
|---------|----------------|---------|
| consciousness | 0.8 | Self-awareness modeling |
| metacognition | 0.7 | Learning from interactions |
| moral_compass | 0.9 | Ethical guardrails |
| domain_taxonomy | 0.8 | Domain expertise matching |
| brain_router | 0.9 | Model selection |

### Decision Weights

| Weight | Purpose |
|--------|---------|
| modelQualityWeight | Prefer higher quality |
| modelCostWeight | Prefer lower cost |
| modelLatencyWeight | Prefer faster response |

## 4.7 Delight System Administration

The Delight System provides personality and engagement features.

### Dashboard Overview

| Metric | Description |
|--------|-------------|
| Messages Shown | Total delight messages displayed |
| Achievements Unlocked | Total achievements earned |
| Easter Eggs Found | Hidden features discovered |
| Active Users | Users with Delight enabled |

### Managing Categories

| Category | Purpose |
|----------|---------|
| Domain Loading | Messages while loading expertise |
| Time Awareness | Time-of-day messages |
| Model Dynamics | AI consensus feedback |
| Achievements | Milestone celebrations |
| Wellbeing | Break reminders |
| Easter Eggs | Hidden features |
| Sounds | Audio feedback |

### Statistics Dashboard

Access at **Think Tank → Delight → View Statistics**:

- Weekly trends (12-week history)
- Top messages by engagement
- Achievement unlock rates
- Easter egg discovery metrics
- User engagement leaderboard

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/delight/dashboard` | GET | Dashboard data |
| `/api/admin/delight/statistics` | GET | Detailed statistics |
| `/api/admin/delight/categories/:id` | PATCH | Toggle category |
| `/api/admin/delight/messages` | POST | Create message |

## 4.8 Localization

### Supported Languages

Configure in **Settings → Localization**:

| Language | Code | Status |
|----------|------|--------|
| English | en | Default |
| Spanish | es | Available |
| French | fr | Available |
| German | de | Available |
| Japanese | ja | Available |

### Translation Management

1. Navigate to **Localization → Translations**
2. Select namespace (common, chat, settings)
3. Edit translations per language
4. Publish changes

---

# 5. Think Tank User Guide

## 5.1 Getting Started

### Creating Your Account

1. Visit **thinktank.ai**
2. Click **Get Started Free**
3. Sign up with email or social login
4. Verify your email
5. Complete your profile

### Your First Chat

1. Click **New Chat** or press `Ctrl+N`
2. Type your question
3. Press **Enter** or click **Send**
4. Watch AI respond in real-time

## 5.2 Choosing Models

### Available Models

| Provider | Top Models |
|----------|------------|
| OpenAI | GPT-4o, GPT-4 Turbo, o1 |
| Anthropic | Claude 3.5 Sonnet, Claude 3 Opus |
| Google | Gemini 1.5 Pro, Gemini Ultra |
| xAI | Grok-2 |
| Meta | Llama 3.1 405B |

### Auto Mode

Enable **Auto Mode** to let the Brain Router select the optimal model based on:
- Query complexity
- Domain expertise needed
- Cost optimization
- Response speed requirements

## 5.3 Focus Modes & Personas

### Focus Modes

| Mode | Best For |
|------|----------|
| General | Everyday questions |
| Coding | Programming help |
| Creative | Writing, brainstorming |
| Research | Deep analysis |
| Analysis | Data interpretation |

### Personas

Create custom AI personalities:
1. Go to **Personas → Create**
2. Set name and description
3. Define behavior instructions
4. Save and activate

## 5.4 Canvas & Artifacts

### Canvas Features

- Rich text editing
- Code blocks with syntax highlighting
- Image generation and editing
- Diagram creation
- Export to PDF, Markdown, Word

### Artifact Types

| Type | Description |
|------|-------------|
| Document | Long-form text |
| Code | Executable snippets |
| Image | AI-generated visuals |
| Diagram | Flowcharts, diagrams |
| Table | Structured data |

## 5.5 Collaboration

### Sharing Chats

1. Click **Share** on any chat
2. Choose visibility (link, team, public)
3. Set permissions (view, comment, edit)
4. Copy share link

### Team Features

- Shared workspaces
- Real-time collaboration
- Comment threads
- Version history

## 5.6 Credits & Billing

### Understanding Credits

| Action | Credits |
|--------|---------|
| GPT-4o message | 1-5 |
| Claude 3 Opus message | 2-8 |
| Image generation | 5-20 |
| Voice transcription | 1-3 |

### Plans

| Plan | Price | Credits/Month |
|------|-------|---------------|
| Free | $0 | 100 |
| Starter | $29 | 1,000 |
| Pro | $99 | 10,000 |
| Team | $49/user | 5,000/user |

## 5.7 Delight System

Think Tank includes a personality system for engaging interactions.

### What is Delight?

Contextual, friendly messages during conversations:
- **Domain Loading**: "Consulting the fundamental forces..." for physics
- **Time Awareness**: "Burning the midnight tokens" late at night
- **Model Dynamics**: "Consensus forming..." when models agree
- **Wellbeing**: "Time for a break?" after long sessions

### Personality Modes

| Mode | Description |
|------|-------------|
| Professional | Minimal feedback |
| Subtle | Light personality |
| Expressive | Full personality |
| Playful | Maximum fun |

### Achievements

| Achievement | Unlock |
|-------------|--------|
| 🧭 Domain Explorer | 10+ domains |
| 🔥 Week Warrior | 7-day streak |
| 👑 Renaissance Mind | 50+ domains |
| ⚡ Monthly Mind | 30-day streak |

### Sound Themes

| Theme | Style |
|-------|-------|
| Default | Pleasant chimes |
| Mission Control | NASA beeps |
| Library | Book sounds |
| Workshop | Tool clicks |

### Customization

Toggle in **Settings → Delight**:
- Domain messages
- Model personality
- Time awareness
- Achievements
- Wellbeing nudges
- Easter eggs
- Sound effects

## 5.8 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New chat |
| `Ctrl+/` | Focus input |
| `Ctrl+Enter` | Send message |
| `Ctrl+K` | Command palette |
| `Ctrl+B` | Toggle sidebar |
| `Esc` | Stop generation |

---

# 6. API Reference

## 6.1 Authentication

All API requests require authentication via JWT token:

```
Authorization: Bearer <token>
```

### Obtaining Tokens

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

Response:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 3600
}
```

## 6.2 Core Endpoints

### Chat Completions

```bash
POST /api/v2/chat/completions
Content-Type: application/json

{
  "model": "gpt-4o",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "stream": true
}
```

### Models

```bash
GET /api/v2/models
```

Response:
```json
{
  "models": [
    {
      "id": "gpt-4o",
      "provider": "openai",
      "capabilities": ["text", "vision"],
      "pricing": {
        "input": 0.005,
        "output": 0.015
      }
    }
  ]
}
```

## 6.3 Admin Endpoints

### Tenants

```bash
GET /api/admin/tenants
POST /api/admin/tenants
GET /api/admin/tenants/:id
PUT /api/admin/tenants/:id
DELETE /api/admin/tenants/:id
```

### Users

```bash
GET /api/admin/users
POST /api/admin/users
GET /api/admin/users/:id
PUT /api/admin/users/:id
```

### Billing

```bash
GET /api/admin/billing/subscriptions
GET /api/admin/billing/transactions
POST /api/admin/billing/credits/add
```

## 6.4 Think Tank Endpoints

### Brain Plans

```bash
POST /api/thinktank/brain-plan/generate
GET /api/thinktank/brain-plan/:planId
POST /api/thinktank/brain-plan/:planId/execute
```

### Domain Taxonomy

```bash
GET /api/v2/domain-taxonomy
GET /api/v2/domain-taxonomy/fields
POST /api/v2/domain-taxonomy/detect
```

### Delight

```bash
GET /api/admin/delight/dashboard
GET /api/admin/delight/statistics
PATCH /api/admin/delight/categories/:id
POST /api/admin/delight/messages
```

## 6.5 Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| RADIANT_AUTH_001 | 401 | Invalid token |
| RADIANT_AUTH_002 | 401 | Token expired |
| RADIANT_AUTH_003 | 403 | Insufficient permissions |
| RADIANT_TENANT_001 | 404 | Tenant not found |
| RADIANT_MODEL_001 | 404 | Model not found |
| RADIANT_BILLING_001 | 402 | Insufficient credits |
| RADIANT_RATE_001 | 429 | Rate limit exceeded |

---

# 7. Changelog

## [4.18.2] - 2024-12-28

### Added

#### Think Tank Delight System
- Core service with personality modes and trigger types
- AGI Brain integration for real-time messages
- Real-time event streaming
- Persistent statistics with 12-week trends
- Admin dashboard with analytics

#### Localization System
- Database migration for UI string registry
- Translation hook for React
- Language selector in settings

#### Windsurf Workflows
- Policy workflows for code quality

### Changed

#### Unified Deployment Model
- Removed tier 1-5 deployment selection
- Single deployment with all features
- Licensing at application level

### Documentation
- Updated deployment guide
- Added Delight System documentation
- Added admin guide section 20

## [4.18.1] - 2024-12-25

### Added
- Standardized error handling system
- Comprehensive test coverage
- Testing and error code documentation

### Fixed
- TypeScript errors in various services
- Type safety improvements

## [4.18.0] - 2024-12-24

### Added
- Unified package system
- AI Assistant in Swift Deployer
- Configurable timeouts
- Cost management
- Compliance reports
- A/B testing framework

---

# Appendix

## A. Quick Reference

### Swift Deployer Commands

```bash
# Build and run
swift run --package-path apps/swift-deployer

# Run tests
swift test --package-path apps/swift-deployer
```

### CDK Commands

```bash
# Synthesize
cdk synth

# Deploy specific stack
cdk deploy RadiantAPIStack

# Destroy
cdk destroy --all
```

### Database Migrations

```bash
# Run migrations
cd packages/infrastructure
npm run migrate

# Rollback
npm run migrate:rollback
```

## B. Support Resources

| Resource | URL |
|----------|-----|
| Documentation | docs.radiant.example.com |
| Status Page | status.radiant.example.com |
| Support Email | support@radiant.example.com |

## C. Version Information

- **RADIANT Version**: 4.18.2
- **Think Tank Version**: 3.2.0
- **Last Updated**: December 28, 2024

---

*© 2024 RADIANT Platform. All rights reserved.*
