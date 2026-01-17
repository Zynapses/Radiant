# RADIANT Architecture: Where Code Lives

> **Quick Reference for Direct Dev Mode**
> Understanding the separation between CDK Stacks (blueprints) and Lambda code (runtime)

## Core Concept

```
┌─────────────────────────────────────────────────────────────────────────┐
│ STACKS = BLUEPRINTS (What AWS resources exist)                         │
│ Location: /packages/infrastructure/lib/stacks/                         │
│ Language: TypeScript → Compiles to CloudFormation JSON                 │
│ Purpose:  "Create a Lambda with 1GB RAM, connected to Aurora"          │
│ Contains: Resource definitions, permissions, wiring, environment vars  │
├─────────────────────────────────────────────────────────────────────────┤
│ LAMBDAS = RUNTIME CODE (What executes when invoked)                    │
│ Location: /packages/infrastructure/lambda/                             │
│ Language: TypeScript → Node.js  OR  Python → Python                    │
│ Purpose:  "Parse request, call OpenAI, save to database, return JSON"  │
│ Contains: Business logic, API calls, data processing                   │
└─────────────────────────────────────────────────────────────────────────┘

RELATIONSHIP:
  Stack DEFINES: "Lambda called chat-handler exists with 1GB RAM"
  Stack POINTS TO: "/packages/infrastructure/lambda/api/chat-handler.ts"
  Lambda CONTAINS: Actual code that runs when API is called
```

## Quick Decision Guide

| I need to... | Put it in... | Example |
|--------------|--------------|---------|
| Create a new Lambda function | Stack + Lambda | `api-stack.ts` defines it, `lambda/api/new-handler.ts` contains code |
| Add a new API endpoint | Stack | `api-stack.ts` - add route + Lambda integration |
| Write business logic | Lambda | `lambda/*/handler.ts` |
| Create a database table | Stack | `data-stack.ts` |
| Query the database | Lambda | `lambda/*/handler.ts` using `lambda/shared/` |
| Set Lambda memory/timeout | Stack | In the Lambda definition |
| Use environment variables | Stack defines, Lambda uses | Stack: `environment: { API_KEY }`, Lambda: `process.env.API_KEY` |
| Grant permissions | Stack | `bucket.grantRead(lambda)` |
| Call external API (OpenAI) | Lambda | Using `lambda/shared/services/` |
| Create S3 bucket | Stack | `storage-stack.ts` |
| Process S3 uploads | Stack + Lambda | Stack wires trigger, Lambda processes |
| Define shared types | Shared | `/packages/shared/src/types/` |
| Create reusable CDK pattern | Construct | `/packages/infrastructure/lib/constructs/` |

## Project Structure

```
radiant/
├── VERSION                              # Package version: "4.18.0"
├── RADIANT_VERSION                      # Radiant component version
├── THINKTANK_VERSION                    # Think Tank version
│
├── packages/
│   ├── infrastructure/                  ← CDK INFRASTRUCTURE
│   │   ├── bin/
│   │   │   └── radiant.ts                  CDK app entry point
│   │   ├── lib/
│   │   │   ├── stacks/                     ← BLUEPRINTS (30 stacks)
│   │   │   │   ├── foundation-stack.ts        VPC, subnets, security groups
│   │   │   │   ├── data-stack.ts              Aurora, DynamoDB, ElastiCache
│   │   │   │   ├── storage-stack.ts           S3 buckets, CloudFront
│   │   │   │   ├── api-stack.ts               API Gateway + Lambda definitions
│   │   │   │   ├── ai-stack.ts                SageMaker endpoints
│   │   │   │   ├── auth-stack.ts              Cognito user pools
│   │   │   │   ├── monitoring-stack.ts        CloudWatch, alarms, X-Ray
│   │   │   │   ├── brain-stack.ts             AGI Brain orchestration
│   │   │   │   ├── consciousness-stack.ts     Consciousness engine
│   │   │   │   └── ...                        (30 total stacks)
│   │   │   ├── constructs/                 ← Reusable CDK patterns
│   │   │   └── config/                     ← Environment/tier settings
│   │   │       ├── environments.ts            Dev/Staging/Prod configs
│   │   │       ├── models/                    AI model configurations
│   │   │       └── providers/                 Provider configurations
│   │   │
│   │   ├── lambda/                         ← RUNTIME CODE
│   │   │   ├── api/                           API Gateway handlers
│   │   │   ├── admin/                         Admin API handlers (50+)
│   │   │   ├── thinktank/                     Think Tank handlers
│   │   │   ├── brain/                         AGI Brain handlers
│   │   │   ├── consciousness/                 Consciousness handlers
│   │   │   ├── billing/                       Billing handlers
│   │   │   ├── scheduled/                     Cron-based handlers
│   │   │   └── shared/                        ← Shared Lambda utilities
│   │   │       ├── services/                     Business logic services
│   │   │       ├── db/                           Database utilities
│   │   │       └── utils/                        Common utilities
│   │   │
│   │   ├── migrations/                     ← Database migrations (172)
│   │   └── config/                         ← Runtime configurations
│   │
│   └── shared/                             ← SHARED TYPES (used everywhere)
│       └── src/
│           ├── types/                         Request/response interfaces
│           └── constants/                     Constants and enums
│
├── apps/
│   ├── swift-deployer/                     ← Swift macOS Deployer App
│   └── admin-dashboard/                    ← Next.js Admin Dashboard
│
├── scripts/                                ← Utility scripts
│   ├── setup_credentials.sh                   AWS credential configuration
│   ├── bootstrap_cdk.sh                       CDK bootstrap helper
│   └── deploy.sh                              Deployment helper
│
└── docs/                                   ← Documentation
    ├── RADIANT-ADMIN-GUIDE.md                 Platform admin guide
    └── THINKTANK-ADMIN-GUIDE.md               Think Tank admin guide
```

## Stack Files Explained

| Stack File | AWS Resources It Creates |
|------------|-------------------------|
| `foundation-stack.ts` | VPC, Subnets, NAT Gateway, Security Groups, VPC Endpoints |
| `data-stack.ts` | Aurora PostgreSQL, DynamoDB Tables, ElastiCache Redis, Secrets |
| `storage-stack.ts` | S3 Buckets, CloudFront Distributions, Bucket Policies |
| `api-stack.ts` | API Gateway, Lambda Functions, Routes, Authorizers |
| `ai-stack.ts` | SageMaker Endpoints, Model Configs, Auto-scaling |
| `auth-stack.ts` | Cognito User Pool, Identity Pool, OAuth Providers |
| `monitoring-stack.ts` | CloudWatch Dashboards, Alarms, SNS Topics, X-Ray |
| `brain-stack.ts` | AGI Brain Lambda, orchestration resources |
| `consciousness-stack.ts` | Consciousness engine, predictive coding |
| `cato-genesis-stack.ts` | Cato safety architecture |
| `admin-stack.ts` | Admin API handlers |

## Lambda Folders Explained

| Folder | Purpose | Triggered By |
|--------|---------|--------------|
| `/api` | HTTP request handlers | API Gateway |
| `/admin` | Admin panel operations | API Gateway (admin routes) |
| `/thinktank` | Think Tank user operations | API Gateway |
| `/brain` | AGI Brain processing | Direct invoke, API Gateway |
| `/consciousness` | Consciousness operations | Direct invoke, EventBridge |
| `/billing` | Stripe webhooks, usage | API Gateway, Stripe webhooks |
| `/scheduled` | Cron jobs | EventBridge scheduled rules |
| `/shared` | Common utilities | Imported by other lambdas |

## Environment-Aware Resource Naming

All AWS resources use environment prefixes:

| Environment | Prefix | Example Resource Name |
|-------------|--------|----------------------|
| Dev | `radiant-dev` | `radiant-dev-chat-handler` |
| Staging | `radiant-staging` | `radiant-staging-chat-handler` |
| Prod | `radiant-prod` | `radiant-prod-chat-handler` |

## Direct Dev Mode Commands

```bash
# Configure AWS credentials (edit first!)
source ./scripts/setup_credentials.sh

# Bootstrap CDK (one time)
./scripts/bootstrap_cdk.sh

# Start Direct Dev Mode (DEV ONLY)
cd packages/infrastructure
npx cdk watch --hotswap --profile radiant-dev

# Deploy to staging/prod (use Swift Deployer or CLI)
AWS_PROFILE=radiant-staging npx cdk deploy --all --require-approval broadening
AWS_PROFILE=radiant-prod npx cdk deploy --all --require-approval broadening
```

## ⚠️ Critical Safety Rule: cdk watch is DEV-ONLY

> **THIS RULE MUST NEVER BE IGNORED**

`cdk watch --hotswap` is **FORBIDDEN** for staging and production environments.

### Why?

| Risk | Impact |
|------|--------|
| No Rollback | Manual recovery required |
| State Drift | Future deployments may fail |
| Inconsistent Infrastructure | Service outages |
| No Change Sets | Unexpected deletions |

### Enforcement

The rule is enforced at **three levels**:

1. **CDK Entry Point** (`bin/radiant.ts`) - Hard `process.exit(1)` if watch detected on non-dev
2. **Environment Config** (`lib/config/environments.ts`) - `enableCdkWatch: false` for staging/prod
3. **Safety Script** (`scripts/cdk-safety-check.sh`) - Pre-deploy validation

### Safe Methods for Staging/Prod

```bash
# Option 1: Swift Deployer (recommended)

# Option 2: CLI with approval gates
AWS_PROFILE=radiant-staging npx cdk deploy --all --require-approval broadening
AWS_PROFILE=radiant-prod npx cdk deploy --all --require-approval broadening
```

**Full documentation**: See `docs/RADIANT-ADMIN-GUIDE.md` Section 58

## Adding a New Feature

### 1. Add Types (if needed)
```
/packages/shared/src/types/my-feature.types.ts
```

### 2. Add Lambda Code
```
/packages/infrastructure/lambda/my-feature/handler.ts
```

### 3. Add or Update Stack
```
/packages/infrastructure/lib/stacks/my-feature-stack.ts
  OR
Update existing stack (e.g., api-stack.ts)
```

### 4. Add Database Migration (if needed)
```
/packages/infrastructure/migrations/XXX_my_feature.sql
```

### 5. Update Documentation
```
/docs/RADIANT-ADMIN-GUIDE.md  (platform features)
/docs/THINKTANK-ADMIN-GUIDE.md  (Think Tank features)
```
