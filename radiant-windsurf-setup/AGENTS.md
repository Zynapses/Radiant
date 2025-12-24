# RADIANT v4.17.0 - AI Build Agent Configuration

> **This file provides persistent context for Windsurf/Claude Opus 4.5**
> **Read this FIRST before any implementation work**

## 🎯 What You Are Building

RADIANT is a **multi-tenant AWS SaaS platform** for AI model access and orchestration. It has TWO components:

| Component | Location | Purpose |
|-----------|----------|---------|
| **Swift Deployer App** | `RadiantDeployer/` | macOS app that deploys infrastructure |
| **AWS Infrastructure** | `radiant-infrastructure/` | CDK stacks, Lambdas, databases, dashboard |

## 🏗️ Technology Stack

- **Swift App**: SwiftUI, macOS 13.0+, Swift 5.9+, Xcode 15+, SQLCipher
- **Infrastructure**: AWS CDK (TypeScript), Aurora PostgreSQL, Lambda, API Gateway
- **Dashboard**: Next.js 14, TypeScript, Tailwind CSS
- **AI Integration**: 106+ models (50 external + 56 self-hosted), LiteLLM

## 📁 Project Structure

```
RadiantDeployer/                 # Swift macOS app
├── Package.swift
├── Sources/RadiantDeployer/
│   ├── RadiantDeployerApp.swift # @main entry point
│   ├── Models/
│   ├── Services/
│   ├── Views/
│   └── Resources/

radiant-infrastructure/          # AWS CDK infrastructure
├── package.json
├── cdk.json
├── lib/
│   ├── stacks/
│   ├── constructs/
│   └── lambdas/
├── migrations/
└── admin-dashboard/             # Next.js admin UI
```

## 🔑 Critical Constants

```typescript
// Always use these - NEVER hardcode
const RADIANT_VERSION = "4.17.0";
const DOMAIN_PLACEHOLDER = "{{RADIANT_DOMAIN}}";
```

## ⚠️ Implementation Rules

1. **File Creation Order**: Follow dependency graph in each section
2. **RLS Variables**: Always use `app.current_tenant_id` (not `current_tenant_id`)
3. **Sendable Conformance**: All types crossing actor boundaries must be Sendable
4. **No Hardcoded Versions**: Use RADIANT_VERSION constant
5. **Error Handling**: Use typed errors with helpful messages

## 📋 Phase Execution

Phases are in `docs/phases/`. Execute in order:

1. **Phase 1**: Foundation (Sections 0-2) - Shared types, Swift app, base CDK
2. **Phase 2**: Core Infrastructure (Sections 3-7) - AI stacks, Lambdas, DB schema
3. **Phase 3**: Admin & Deployment (Sections 8-9) - Dashboard, assembly guide
4. **Phase 4**: AI Features (Sections 10-17) - Visual AI, Brain, Analytics
5. **Phase 5**: Consumer Platform (Sections 18-28) - Think Tank, collaboration
6. **Phase 6**: Advanced Features (Sections 29-35) - Registry, Time Machine
7. **Phase 7**: Intelligence Layer (Sections 36-39) - Neural engine, workflows
8. **Phase 8**: Platform Hardening (Sections 40-42) - Isolation, i18n, config
9. **Phase 9**: Billing System (Sections 43-46) - Credits, storage, subscriptions

## 🚀 Quick Start Commands

```bash
# Start Phase 1 implementation
/implement-phase 1

# Continue to next phase
/continue-phase

# Verify current phase
/verify-phase
```

## 📖 Documentation References

- Full specs: `docs/sections/` (split by section number)
- Phase summaries: `docs/phases/`
- Original prompt: `docs/RADIANT-PROMPT-32-FULL.md`

## ✅ Verification Checklist

Before marking any phase complete:
- [ ] All files created per section spec
- [ ] Types match shared definitions in Section 0
- [ ] Imports resolve correctly
- [ ] No TypeScript/Swift compilation errors
- [ ] Database migrations are numbered sequentially
