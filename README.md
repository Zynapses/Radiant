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
| 2 | Core Infrastructure (Sections 3-7) | Pending |
| 3 | Admin & Deployment (Sections 8-9) | Pending |
| 4-9 | Features & Platform | Pending |

## License

MIT
