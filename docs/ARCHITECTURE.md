# RADIANT Architecture v4.17.0

## Overview

RADIANT is a multi-tenant AWS SaaS platform for AI model access and orchestration. It consists of:

1. **Swift Deployer App** - macOS GUI for infrastructure deployment
2. **AWS Infrastructure** - CDK-based cloud infrastructure
3. **Admin Dashboard** - Next.js admin UI (Phase 3)

## Technology Stack

| Layer | Technology |
|-------|------------|
| Swift App | SwiftUI, macOS 13.0+, Swift 5.9+, GRDB |
| Infrastructure | AWS CDK (TypeScript), Aurora PostgreSQL, Lambda |
| Dashboard | Next.js 14, TypeScript, Tailwind CSS |
| AI Integration | 106+ models, LiteLLM, SageMaker |

## Monorepo Structure

```
radiant/
├── packages/
│   ├── shared/              # @radiant/shared - Types & constants
│   └── infrastructure/      # @radiant/infrastructure - CDK stacks
├── apps/
│   └── swift-deployer/      # RadiantDeployer macOS app
├── functions/               # Lambda functions (Phase 2)
├── migrations/              # Database migrations (Phase 2)
└── docs/                    # Specifications
```

## Phase 1 Architecture

### @radiant/shared Package

Single source of truth for all types and constants:

```typescript
// Types
- app.types.ts        // ManagedApp, DeploymentStatus, etc.
- environment.types.ts // Environment, TierConfig, etc.
- ai.types.ts         // AIProvider, AIModel, etc.
- admin.types.ts      // Administrator, Permissions
- billing.types.ts    // UsageEvent, Invoice, etc.
- compliance.types.ts // PHI, AuditLog, etc.

// Constants
- version.ts          // RADIANT_VERSION = "4.17.0"
- tiers.ts            // Tier 1-5 configurations
- regions.ts          // AWS region configs
- providers.ts        // AI provider definitions
```

### Swift Deployer App

```
RadiantDeployer/
├── RadiantDeployerApp.swift  # @main entry point
├── AppState.swift            # Global state management
├── Models/
│   ├── ManagedApp.swift      # App configuration model
│   ├── Credentials.swift     # AWS credentials model
│   └── Deployment.swift      # Deployment state/progress
├── Services/
│   ├── CredentialService.swift  # Keychain credential storage
│   ├── CDKService.swift         # CDK command execution
│   └── AWSService.swift         # AWS API interactions
└── Views/
    ├── MainView.swift        # NavigationSplitView container
    ├── AppsView.swift        # Application grid
    ├── DeployView.swift      # Deployment wizard
    ├── ProvidersView.swift   # AI provider list
    ├── ModelsView.swift      # AI model catalog
    └── SettingsView.swift    # Preferences
```

### CDK Infrastructure Stacks

```
packages/infrastructure/
├── bin/radiant.ts            # CDK app entry point
└── lib/stacks/
    ├── foundation-stack.ts   # KMS, SSM parameters
    ├── networking-stack.ts   # VPC, subnets, endpoints
    └── security-stack.ts     # Security groups, WAF
```

## Infrastructure Tiers

| Tier | Name | VPC CIDR | AZs | NAT | Aurora ACU | Features |
|------|------|----------|-----|-----|------------|----------|
| 1 | SEED | /20 | 2 | 1 | 0.5-2 | Dev only |
| 2 | STARTUP | /18 | 2 | 1 | 1-8 | WAF, GuardDuty |
| 3 | GROWTH | /17 | 3 | 2 | 2-16 | Self-hosted models, HIPAA |
| 4 | SCALE | /16 | 3 | 3 | 4-64 | Multi-region, Global DB |
| 5 | ENTERPRISE | /14 | 3 | 3 | 8-128 | Full enterprise |

## Deployment Flow

```
┌─────────────────┐
│ Swift Deployer  │
│    (macOS)      │
└────────┬────────┘
         │ 1. Configure credentials
         │ 2. Select app/tier/env
         │ 3. Initiate deployment
         ▼
┌─────────────────┐
│   CDK Deploy    │
│  (via Process)  │
└────────┬────────┘
         │ 4. Bootstrap AWS
         │ 5. Synth stacks
         │ 6. Deploy in order
         ▼
┌─────────────────┐
│  AWS Account    │
│  (VPC, RDS,     │
│   Lambda, etc)  │
└─────────────────┘
```

## Phase 1 Deliverables

- [x] Monorepo structure (pnpm workspace)
- [x] @radiant/shared package with all types
- [x] @radiant/infrastructure base CDK stacks
- [x] RadiantDeployer Swift app with full UI
- [x] Credential management via Keychain
- [x] CDK service for deployment execution
- [x] Documentation

## Future Phases

| Phase | Sections | Description |
|-------|----------|-------------|
| 2 | 3-7 | AI stacks, Lambdas, Database |
| 3 | 8-9 | Admin Dashboard, Deployment Guide |
| 4 | 10-17 | Visual AI, Brain, Analytics |
| 5 | 18-28 | Think Tank, Collaboration |
| 6 | 29-35 | Registry, Time Machine |
| 7 | 36-39 | Neural Engine, Workflows |
| 8 | 40-42 | Isolation, i18n, Config |
| 9 | 43-46 | Billing System |
