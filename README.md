# RADIANT v4.17.0

A **multi-tenant AWS SaaS platform** for AI model access and orchestration.

## Overview

RADIANT consists of two main components:

| Component | Location | Purpose |
|-----------|----------|---------|
| **Swift Deployer App** | `apps/swift-deployer/` | macOS app for deploying infrastructure |
| **AWS Infrastructure** | `packages/infrastructure/` | CDK stacks, Lambdas, databases |

## Requirements

### Swift Deployer App
- macOS 13.0 (Ventura) or later
- Xcode 15.0+ or Swift 5.9+

### AWS Infrastructure
- Node.js 20.0+
- pnpm 8.0+
- AWS CDK 2.120.0+
- AWS Account with appropriate permissions

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Build Shared Package

```bash
pnpm build:shared
```

### 3. Build Swift Deployer

```bash
cd apps/swift-deployer
swift build
swift run
```

### 4. Deploy Infrastructure

```bash
pnpm deploy:dev
```

## Project Structure

```
radiant/
├── package.json                    # Root monorepo config
├── pnpm-workspace.yaml             # pnpm workspace config
├── tsconfig.base.json              # Base TypeScript config
│
├── packages/
│   ├── shared/                     # @radiant/shared - Types & constants
│   │   ├── src/
│   │   │   ├── types/              # TypeScript type definitions
│   │   │   ├── constants/          # Shared constants
│   │   │   └── utils/              # Utility functions
│   │   └── package.json
│   │
│   └── infrastructure/             # @radiant/infrastructure - CDK stacks
│       ├── bin/radiant.ts          # CDK app entry point
│       ├── lib/stacks/             # CDK stack definitions
│       └── cdk.json
│
├── apps/
│   └── swift-deployer/             # RadiantDeployer macOS app
│       ├── Package.swift
│       └── Sources/RadiantDeployer/
│           ├── Models/
│           ├── Services/
│           └── Views/
│
└── docs/
    └── sections/                   # Full specification documents
```

## Infrastructure Tiers

| Tier | Name | Monthly Cost | Features |
|------|------|--------------|----------|
| 1 | SEED | $50-150 | Dev/test, minimal resources |
| 2 | STARTUP | $200-400 | Small production, WAF |
| 3 | GROWTH | $1,000-2,500 | Self-hosted models, HIPAA |
| 4 | SCALE | $4,000-8,000 | Multi-region, global DB |
| 5 | ENTERPRISE | $15,000-35,000 | Enterprise-grade global |

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Full Specifications](docs/sections/)

## Development Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation (Sections 0-2) | ✅ Complete |
| 2 | Core Infrastructure (Sections 3-7) | ✅ Complete |
| 3 | Admin & Deployment (Sections 8-9) | ✅ Complete |
| 4 | AI Features (Sections 10-17) | ✅ Complete |
| 5 | Consumer Platform (Sections 18-28) | ✅ Complete |
| 6 | Advanced Features (Sections 29-35) | ✅ Complete |
| 7 | Intelligence Layer (Sections 36-39) | ✅ Complete |
| 8 | Platform Hardening (Sections 40-42) | ✅ Complete |
| 9 | Billing System (Sections 43-46) | ✅ Complete |

## Admin Dashboard

The admin dashboard provides a complete management interface:

| Page | Description |
|------|-------------|
| Dashboard | Overview metrics and activity |
| Models | AI model configuration |
| Providers | Provider management and credentials |
| Orchestration | Neural patterns and workflows |
| Administrators | User management and invitations |
| Billing | Credits, subscriptions, transactions |
| Storage | Storage usage monitoring |
| Localization | Translation management |
| Configuration | System settings |
| Migrations | Database migration approval |
| Audit Logs | Activity tracking |
| Notifications | System alerts |
| Settings | User preferences |

### Running the Dashboard

```bash
cd apps/admin-dashboard
pnpm dev
```

## Database Migrations

36 migrations covering:
- Core schema (tenants, users, admins)
- AI models and providers
- Orchestration patterns and workflows
- Billing and credits
- Storage management
- Localization
- Configuration management

### Running Migrations

```bash
cd packages/infrastructure
pnpm migrate
```

### Seed Data

Demo data is available for development:

```bash
psql -d radiant -f migrations/seed/001_demo_data.sql
```

## Lambda Handlers

| Handler | Purpose |
|---------|---------|
| router | Main API router |
| admin | Admin operations |
| feedback | Feedback learning |
| orchestration | Neural orchestration |
| proposals | Workflow proposals |
| localization | Translation API |
| configuration | Config management |
| billing | Credits and subscriptions |
| storage | Storage tracking |
| migration-approval | Dual-admin approval |

## Environment Variables

Copy the template and configure:

```bash
cp .env.example .env
```

Required variables:
- `AWS_REGION` - AWS region
- `AWS_ACCOUNT_ID` - AWS account ID
- `DB_CLUSTER_ARN` - Aurora cluster ARN
- `DB_SECRET_ARN` - Database secret ARN
- `COGNITO_USER_POOL_ID` - Cognito user pool
- `COGNITO_CLIENT_ID` - Cognito client ID

## License

MIT
