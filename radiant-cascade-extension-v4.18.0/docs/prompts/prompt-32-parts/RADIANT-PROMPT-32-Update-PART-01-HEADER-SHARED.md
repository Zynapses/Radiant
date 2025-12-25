# RADIANT v4.17.0 - PROMPT 32: AI-OPTIMIZED FOR CODE GENERATION

> **Complete Implementation Prompt for Windsurf/Claude Opus 4.5**  
> **Version: 4.17.0 | December 2024 | ~2.2MB | 400-500 AI-assisted hours**
> **Status: AI-OPTIMIZED - Enhanced for reliable Swift & TypeScript code generation**

---

## ðŸ¤– AI CODE GENERATION ENHANCEMENTS (v4.17.0)

| Enhancement | Description |
|-------------|-------------|
| **Complete Swift App Entry Point** | Fixed missing RadiantDeployerApp.swift with proper @main struct |
| **Xcode Project Structure** | Added Package.swift, Info.plist, entitlements templates |
| **Version Constant** | Single `RADIANT_VERSION` constant replaces hardcoded strings |
| **File Creation Order** | Explicit dependency graph for AI implementation |
| **Preview Providers** | Added SwiftUI previews for all Views |
| **Platform Requirements** | Clear macOS 13.0+, Swift 5.9+, Xcode 15+ markers |
| **Sendable Conformance** | All types crossing actor boundaries are Sendable |
| **SQLCipher Setup** | Complete SPM dependency configuration |
| **AI Implementation Notes** | MARK comments explaining context and dependencies |

---

## ðŸ†• WHAT'S NEW IN v4.16.0 (PROMPT 30)

| Version | Section | Feature | Description |
|---------|---------|---------|-------------|
| **v4.13.0** | 43 | **Billing & Credits System** | 7-tier subscriptions (FREEâ†’ENTERPRISE PLUS), prepaid credits ($10=1 credit), volume discounts, Stripe integration, credit pools for families/teams |
| **v4.14.0** | 44 | **Storage Billing System** | Tiered S3/DB/backup pricing, quota management, overage billing, usage tracking per tenant |
| **v4.15.0** | 45 | **Versioned Subscriptions & Grandfathering** | Plan version snapshots, locked pricing for existing subscribers, migration offers with incentives |
| **v4.16.0** | 46 | **Dual-Admin Migration Approval** | Two-person approval for production migrations, self-approval prevention, configurable policies, complete audit trail |

### New Database Tables (v4.13-v4.16):
- `subscription_tiers`, `subscription_add_ons`, `credit_pools`, `credit_pool_members`
- `credit_transactions`, `credit_purchases`, `subscriptions`, `auto_purchase_settings`
- `credit_usage`, `billing_events`
- `storage_usage`, `storage_pricing`, `storage_events`
- `subscription_plan_versions`, `grandfathered_subscriptions`, `plan_change_audit`
- `migration_approval_requests`, `migration_approvals`, `migration_approval_policies`

### Total Platform Stats (v4.16.0):
- **46 sections** across 9 implementation phases
- **140+ database tables** with RLS
- **106+ AI models** (50 external + 56 self-hosted)
- **7-tier subscription model** with prepaid credits
- **18 languages** with AI translation
- **12 configuration categories** with hot reload

---

# âš ï¸ CRITICAL: READ THIS FIRST - WHAT THIS PROMPT BUILDS

## ðŸŽ¯ TWO DISTINCT COMPONENTS

This prompt creates **TWO SEPARATE THINGS** that must be understood before implementation:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        RADIANT PLATFORM ARCHITECTURE                             â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                                  â”‚
â”‚   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                   â”‚
â”‚   â”‚     COMPONENT 1: SWIFT DEPLOYER         â”‚  â† Built ONCE on developer Mac   â”‚
â”‚   â”‚     (Section 1 - ~2,400 lines)          â”‚                                   â”‚
â”‚   â”‚                                          â”‚                                   â”‚
â”‚   â”‚  â€¢ Native macOS application (SwiftUI)   â”‚                                   â”‚
â”‚   â”‚  â€¢ Manages AWS credentials securely     â”‚                                   â”‚
â”‚   â”‚  â€¢ Orchestrates CDK deployments         â”‚                                   â”‚
â”‚   â”‚  â€¢ Runs database migrations             â”‚                                   â”‚
â”‚   â”‚  â€¢ Monitors deployment progress         â”‚                                   â”‚
â”‚   â”‚  â€¢ One-click infrastructure management  â”‚                                   â”‚
â”‚   â”‚                                          â”‚                                   â”‚
â”‚   â”‚  THE SWIFT APP IS THE TOOL THAT DEPLOYS â”‚                                   â”‚
â”‚   â”‚  RADIANT. USERS NEVER TOUCH A TERMINAL. â”‚                                   â”‚
â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                   â”‚
â”‚                           â”‚                                                      â”‚
â”‚                           â”‚ deploys                                              â”‚
â”‚                           â–¼                                                      â”‚
â”‚   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                   â”‚
â”‚   â”‚     COMPONENT 2: AWS INFRASTRUCTURE     â”‚  â† Deployed TO AWS (repeatedly)  â”‚
â”‚   â”‚     (Sections 0, 2-46 - ~56,000 lines)  â”‚                                   â”‚
â”‚   â”‚                                          â”‚                                   â”‚
â”‚   â”‚  â€¢ CDK stacks (VPC, Cognito, Aurora,    â”‚                                   â”‚
â”‚   â”‚    Lambda, API Gateway, SageMaker, etc.)â”‚                                   â”‚
â”‚   â”‚  â€¢ 50+ Lambda functions                  â”‚                                   â”‚
â”‚   â”‚  â€¢ 140+ database tables with RLS        â”‚                                   â”‚
â”‚   â”‚  â€¢ Admin Dashboard (Next.js)            â”‚                                   â”‚
â”‚   â”‚  â€¢ Think Tank consumer platform         â”‚                                   â”‚
â”‚   â”‚  â€¢ 106+ AI model integrations           â”‚                                   â”‚
â”‚   â”‚  â€¢ Multi-tenant, multi-app isolation    â”‚                                   â”‚
â”‚   â”‚                                          â”‚                                   â”‚
â”‚   â”‚  THIS IS THE "PAYLOAD" - THE ACTUAL     â”‚                                   â”‚
â”‚   â”‚  RADIANT PLATFORM RUNNING ON AWS.       â”‚                                   â”‚
â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                   â”‚
â”‚                                                                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Key Understanding

| Component | Where It Runs | When Built | Purpose |
|-----------|--------------|------------|---------|
| **Swift Deployer** (Section 1) | Developer's Mac | Once | Deploys and manages AWS infrastructure |
| **AWS Payload** (Sections 0, 2-46) | AWS Cloud | Per environment (dev/staging/prod) | The actual RADIANT platform |

**The Swift app is built ONCE locally. It then deploys the AWS infrastructure REPEATEDLY to different environments.**

---

# ðŸš€ IMPLEMENTATION STRATEGY FOR CLAUDE/WINDSURF

## How to Use This Prompt

This document is ~2MB and exceeds single-context limits. **DO NOT attempt to implement everything at once.**

### Recommended Approach: Phase-by-Phase Implementation

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    IMPLEMENTATION PHASES (Follow This Order)                     â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                                  â”‚
â”‚  PHASE 1: Foundation (Implement First)                                          â”‚
â”‚  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•                                         â”‚
â”‚  â€¢ Section 0: Shared Types & Constants (~1,400 lines)                           â”‚
â”‚  â€¢ Section 1: Swift Deployment App (~2,400 lines)                               â”‚
â”‚  â€¢ Section 2: CDK Infrastructure Stacks (~2,700 lines)                          â”‚
â”‚                                                                                  â”‚
â”‚  PHASE 2: Core Infrastructure                                                   â”‚
â”‚  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•                                                â”‚
â”‚  â€¢ Section 3: CDK AI & API Stacks (~2,900 lines)                               â”‚
â”‚  â€¢ Section 4: Lambda Functions - Core (~3,900 lines)                           â”‚
â”‚  â€¢ Section 5: Lambda Functions - Admin & Billing (~1,700 lines)                â”‚
â”‚  â€¢ Section 6: Self-Hosted Models (~1,600 lines)                                â”‚
â”‚  â€¢ Section 7: Database Schema (~3,500 lines)                                   â”‚
â”‚                                                                                  â”‚
â”‚  PHASE 3: Admin & Deployment                                                    â”‚
â”‚  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•                                                â”‚
â”‚  â€¢ Section 8: Admin Web Dashboard (~4,200 lines)                               â”‚
â”‚  â€¢ Section 9: Assembly & Deployment Guide (~900 lines)                         â”‚
â”‚                                                                                  â”‚
â”‚  PHASE 4: AI Features                                                           â”‚
â”‚  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•                                                          â”‚
â”‚  â€¢ Sections 10-17: Visual AI, Brain, Analytics, Neural Engine, etc.           â”‚
â”‚  â€¢ (~1,500 lines total - smaller sections)                                     â”‚
â”‚                                                                                  â”‚
â”‚  PHASE 5: Consumer Platform                                                     â”‚
â”‚  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•                                                    â”‚
â”‚  â€¢ Sections 18-28: Think Tank, Concurrent Chat, Collaboration, etc.           â”‚
â”‚  â€¢ (~2,700 lines total)                                                        â”‚
â”‚                                                                                  â”‚
â”‚  PHASE 6: Advanced Features                                                     â”‚
â”‚  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•                                                    â”‚
â”‚  â€¢ Sections 29-35: Provider Registry, Time Machine, Orchestration, etc.        â”‚
â”‚  â€¢ (~6,200 lines total)                                                        â”‚
â”‚                                                                                  â”‚
â”‚  PHASE 7: Intelligence Layer                                                    â”‚
â”‚  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•                                                    â”‚
â”‚  â€¢ Sections 36-39: Unified Registry, Feedback Learning, Neural Orchestration   â”‚
â”‚  â€¢ (~5,500 lines total)                                                        â”‚
â”‚                                                                                  â”‚
â”‚  PHASE 8: Platform Hardening                                                    â”‚
â”‚  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•                                                    â”‚
â”‚  â€¢ Section 40: Application-Level Data Isolation (~1,800 lines)                 â”‚
â”‚  â€¢ Section 41: Complete Internationalization (~3,100 lines)                    â”‚
â”‚  â€¢ Section 42: Dynamic Configuration Management (~2,200 lines)                 â”‚
â”‚                                                                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Instructions for AI Implementation

When implementing this prompt, follow these rules:

1. **Implement ONE PHASE at a time** - Complete all sections in a phase before moving to the next
2. **Follow the dependency graph** - Sections depend on previous sections (see detailed graph below)
3. **Section 0 FIRST, always** - Shared types must exist before anything else
4. **Test each phase** - Verify deployment works before adding more complexity
5. **Reference, don't duplicate** - Import from `@radiant/shared`, never redefine types

### Sample Implementation Commands

```bash
# Phase 1 implementation prompt:
"Implement RADIANT Phase 1: Sections 0, 1, and 2. 
 Start with Section 0 (shared types), then Section 1 (Swift app), 
 then Section 2 (CDK infrastructure). Follow all specifications exactly."

# Phase 2 implementation prompt:
"Implement RADIANT Phase 2: Sections 3-7.
 Phase 1 is complete. Now add CDK AI stacks, Lambda functions,
 self-hosted models, and database schema."

# Continue for each phase...
```

---

## ðŸ”§ INTEGRATION NOTES (Inherited from v4.9.0)

This prompt has been fully integrated with the following key changes:

1. **AuthContext Unified** - Single source of truth in Section 4, all duplicates removed
2. **Migration Numbering Fixed** - Sequential 001-050 with clear section mapping
3. **Version Tags Complete** - All sections now have version tags
4. **Database Connection Standardized** - All Lambdas use `DATABASE_URL` pattern
5. **RLS Policies Consistent** - All use `app.current_tenant_id`
6. **Duplicate Types Removed** - Single definitions in Section 0
7. **Leftover Markers Cleaned** - No more "END OF PROMPT X" within document
8. **TODO Items Addressed** - Resolved or marked with clear implementation notes
9. **Dependency Order Verified** - Sections ordered by implementation dependencies
10. **Think Tank Branding** - All "Radiant Solver" references updated to "Think Tank"

---

## âš ï¸ STRUCTURAL FIXES (Inherited from v4.9.0)

### Issue #1: Migration Number Conflicts (FIXED)
**Problem**: Migrations used inconsistent numbering (001-007, then jumped to 020-042)
**Solution**: Renumbered all migrations sequentially:
- 001-007: Core schema (Section 7)
- 008-009: Reserved
- 010-019: Infrastructure features (Sections 10-17)
- 020-029: Consumer features (Sections 18-27)
- 030-039: Advanced features (Sections 28-37)
- 040-046: Latest features (Sections 38-46)

### Issue #2: Duplicate Type Definitions (FIXED)
**Problem**: `AuthContext`, `ModelPricing`, `ExternalProvider` defined multiple times
**Solution**: Single source of truth in Section 0 (`packages/shared/src/types/`)

### Issue #3: Missing Version Tags (FIXED)
**Problem**: Sections 32-35 and 40 had no version tags
**Solution**: Added:
- Section 32-33: v4.0.0 (Time Machine)
- Section 34-35: v4.1.0 (Orchestration Engine)
- Section 40: v4.6.0 (App Isolation)

### Issue #4: Database Connection Inconsistency (FIXED)
**Problem**: Mixed `DATABASE_URL` and `DB_HOST/DB_NAME/DB_USER/DB_PASSWORD`
**Solution**: Standardized all Lambda functions to use `DATABASE_URL`:
```typescript
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```

### Issue #5: RLS Policy Variable Mismatch (FIXED)
**Problem**: Some policies used `app.current_tenant` instead of `app.current_tenant_id`
**Solution**: All RLS policies now consistently use `current_setting('app.current_tenant_id')::UUID`

### Issue #6: Missing Version v3.4.0 (FIXED)
**Problem**: Version history jumped from v3.3.0 to v3.5.0
**Solution**: Added v3.4.0 as reserved/internal milestone (no user-facing features)

### Issue #7: Leftover Prompt Markers (FIXED)
**Problem**: "END OF PROMPT 15" and "END OF PROMPT 16" embedded within document
**Solution**: Removed all internal prompt markers, only final END marker remains

---

## ðŸ“‹ COMPLETE SECTION REFERENCE

| Section | Name | Lines | Phase | Version | Key Deliverables |
|---------|------|-------|-------|---------|------------------|
| **0** | Shared Types & Constants | ~1,400 | 1 | v2.0.0 | TypeScript types, tier configs, regions |
| **1** | Swift Deployment App | ~2,400 | 1 | v2.0.0 | macOS GUI, credential management, deployment orchestration |
| **2** | CDK Infrastructure Stacks | ~2,700 | 1 | v2.0.0 | VPC, Aurora, Cognito, S3, base Lambda |
| **3** | CDK AI & API Stacks | ~2,900 | 2 | v2.1.0 | API Gateway, SageMaker, LiteLLM |
| **4** | Lambda Core | ~3,900 | 2 | v2.1.0 | Router, chat, model handlers, auth context |
| **5** | Lambda Admin & Billing | ~1,700 | 2 | v2.1.0 | Tenant CRUD, billing, invoicing |
| **6** | Self-Hosted Models | ~1,600 | 2 | v2.2.0 | SageMaker endpoints, thermal management |
| **7** | Database Schema | ~3,500 | 2 | v2.2.0 | 140+ tables, RLS policies, migrations |
| **8** | Admin Dashboard | ~4,200 | 3 | v2.2.0 | Next.js admin UI, all management pages |
| **9** | Assembly & Deployment | ~900 | 3 | v2.2.0 | Build scripts, deployment guide |
| **10** | Visual AI Pipeline | ~230 | 4 | v2.3.0 | Image processing orchestration |
| **11** | RADIANT Brain | ~280 | 4 | v2.4.0 | Intelligent routing engine |
| **12** | Metrics & Analytics | ~160 | 4 | v2.5.0 | Usage tracking, dashboards |
| **13** | Neural Engine | ~230 | 4 | v3.0.0 | User preferences, pgvector embeddings |
| **14** | Error Logging | ~200 | 4 | v3.1.0 | Centralized error capture |
| **15** | Credentials Registry | ~220 | 4 | v3.2.0 | External API key management |
| **16** | AWS Admin Credentials | ~90 | 4 | v3.2.0 | AWS credential integration |
| **17** | Auto-Resolve API | ~140 | 4 | v3.3.0 | Automatic request handling |
| **18** | Think Tank Platform | ~300 | 5 | v3.5.0 | Consumer AI interface |
| **19** | Concurrent Chat | ~460 | 5 | v3.6.0 | Split-pane multi-chat UI |
| **20** | Real-Time Collaboration | ~180 | 5 | v3.6.0 | Yjs CRDT multi-user editing |
| **21** | Voice & Video | ~220 | 5 | v3.6.0 | Audio input/output integration |
| **22** | Persistent Memory | ~200 | 5 | v3.6.0 | Cross-session user memory |
| **23** | Canvas & Artifacts | ~210 | 5 | v3.6.0 | Rich content editing |
| **24** | Result Merging | ~230 | 5 | v3.6.0 | AI response synthesis |
| **25** | Focus Modes & Personas | ~210 | 5 | v3.6.0 | Domain presets, custom AI personalities |
| **26** | Scheduled Prompts | ~250 | 5 | v3.6.0 | Recurring automated tasks |
| **27** | Family & Team Plans | ~250 | 5 | v3.6.0 | Shared subscriptions |
| **28** | Analytics Integration | ~200 | 5 | v3.6.0 | Think Tank usage analytics |
| **29** | Admin Extensions | ~430 | 6 | v3.7.0 | Additional admin pages |
| **30** | Dynamic Provider Registry | ~540 | 6 | v3.7.0 | Database-driven providers, xAI/Grok |
| **31** | Model Selection & Pricing | ~1,970 | 6 | v3.8.0 | User model choice, editable pricing |
| **32** | Time Machine Core | ~1,880 | 6 | v4.0.0 | Chat history versioning |
| **33** | Time Machine UI | ~1,320 | 6 | v4.0.0 | Visual timeline interface |
| **34** | Orchestration Engine | ~680 | 6 | v4.1.0 | Database-driven workflows |
| **35** | License Management | ~340 | 6 | v4.1.0 | AI model license tracking |
| **36** | Unified Model Registry | ~1,400 | 7 | v4.2.0 | 106+ models, sync service |
| **37** | Feedback Learning | ~1,130 | 7 | v4.3.0 | Explicit/implicit/voice feedback |
| **38** | Neural Orchestration | ~900 | 7 | v4.4.0 | Neural-first architecture |
| **39** | Workflow Proposals | ~4,600 | 7 | v4.5.0 | Evidence-based workflow generation |
| **40** | App Isolation | ~1,800 | 8 | v4.6.0 | Per-app data separation |
| **41** | Internationalization | ~3,100 | 8 | v4.7.0 | 18 languages, AI translation |
| **42** | Dynamic Configuration | ~2,200 | 8 | v4.8.0 | Runtime parameter management |
| **43** | Billing & Credits System | ~1,900 | 9 | v4.13.0 | 7-tier subscriptions, prepaid credits, Stripe |
| **44** | Storage Billing | ~700 | 9 | v4.14.0 | Tiered S3/DB pricing, quotas |
| **45** | Versioned Subscriptions | ~750 | 9 | v4.15.0 | Grandfathering, migration offers |
| **46** | Dual-Admin Approval | ~700 | 9 | v4.16.0 | Two-person migration approval |

---

### Also includes all v4.8.0 features:

| Feature | Description |
|---------|-------------|
| **ðŸŒ Localization Registry** | All UI strings stored in database - zero hardcoded text allowed |
| **ðŸ”¤ 18 Supported Languages** | EN, ES, FR, DE, PT, JA, KO, ZH-CN, ZH-TW, AR, IT, NL, RU, PL, TR, VI, TH, HI |
| **ðŸ¤– AI Auto-Translation** | AWS Bedrock (Claude) translates new strings, flags for admin review |
| **ðŸ‘¨â€ðŸ’¼ Translation Admin UI** | Browse, edit, approve translations in Admin Dashboard |
| **ðŸš¨ Hardcode Prevention** | ESLint rules block hardcoded strings at build time |
| **âš›ï¸ React i18n Hooks** | `useTranslation()` hook for web apps with fallback chain |
| **ðŸ“± Swift Localization** | Native Swift localization service for Think Tank app |
| **ðŸ”” Translation Alerts** | Admins notified when AI translations need review |
| **ðŸ“Š Translation Coverage** | Dashboard showing % translated per language |
| **ðŸ”„ Real-Time Sync** | Translation updates propagate instantly via WebSocket |

### Section 41: Complete Internationalization System

**Why This Matters:**
- **Global Reach**: Support users in their native language across 18 languages
- **Quality Control**: AI translations flagged for human review before production
- **Developer Experience**: ESLint catches hardcoded strings at build time
- **Maintainability**: Single source of truth in database, not scattered across code
- **Compliance**: GDPR/accessibility requirements for localized content

**Key Components:**
- `localization_registry` - Master list of all translatable strings with keys
- `localization_translations` - Per-language translations with status tracking
- `localization_languages` - Supported languages with metadata
- Translation Lambda - Auto-translates via Bedrock when new strings added
- Admin UI - Full CRUD for translations with approval workflow
- ESLint Plugin - Prevents hardcoded strings in TypeScript/React
- Swift Localization Service - Native i18n for Think Tank iOS/macOS app

---

### Also includes all v4.6.0 features:

## ðŸš€ WHAT'S NEW IN v4.6.0

| Feature | Description |
|---------|-------------|
| **ðŸ”’ Application-Level Data Isolation** | Each client app (Think Tank, Launch Board, AlwaysMe, etc.) is completely isolated |
| **ðŸ‘¤ App-Scoped Users** | Same email creates separate user instances per app - no cross-app data visibility |
| **ðŸ›¡ï¸ Enhanced RLS Policies** | Row-Level Security now filters by BOTH `tenant_id` AND `app_id` |
| **ðŸ” Separate Cognito User Pools** | Each app gets its own authentication pool for complete identity isolation |
| **ðŸ“Š App-Context Propagation** | All API calls include `app_id` in context, enforced at Lambda level |
| **ðŸŽ¯ Think Tank Isolation** | Think Tank is completely isolated from all other client apps |
| **ðŸ“ Cross-App Audit Trail** | Administrators can view cross-app activity but users cannot |
| **ðŸ”„ Migration Strategy** | Non-breaking migration for existing deployments |

### Section 40: Application-Level Data Isolation

**Why This Matters:**
- **Security**: A compromise in one app cannot affect another
- **Compliance**: Per-app audit scope for HIPAA/SOC 2
- **Privacy**: Users in one app never see data from another app
- **Data Sovereignty**: Clear boundaries for data residency requirements
- **User Experience**: Clean, focused experience per application

**Database Changes:**
- New `app_users` table linking users to specific apps
- `app_id` column added to all user-facing data tables
- Updated RLS policies with dual `tenant_id + app_id` filtering
- New `current_app_id()` function for RLS context
- Cross-app admin views for platform administrators

**Infrastructure Changes:**
- Separate Cognito User Pool per application
- App-specific JWT claims (`custom:app_id`)
- Lambda context propagation for `app_id`
- API Gateway routing per app subdomain

**Lambda Changes:**
- Enhanced auth context extraction with `appId`
- Database connection sets both `app.current_tenant_id` AND `app.current_app_id`
- Audit logging includes `app_id` for all operations

---

### Design Philosophy (v4.6.0)

- **Defense in Depth** - Isolation enforced at Cognito, API Gateway, Lambda, AND Database levels
- **Zero Trust** - Every request validates both tenant and app context
- **Least Privilege** - Users can only access their own app's data
- **Admin Override** - Platform admins can view across apps for support/debugging
- **Backward Compatible** - Existing single-app deployments work without changes

---

### Also includes all v4.5.0 features:

## ðŸš€ WHAT'S NEW IN v4.5.0

| Feature | Description |
|---------|-------------|
| **ðŸ”„ Dynamic Workflow Proposals** | Brain & Neural Engine propose new workflows based on substantiated user needs |
| **ðŸ“Š Evidence-Based Detection** | 7 evidence types: workflow_failure, negative_feedback, explicit_request, manual_override, repeated_attempt, support_escalation, pattern_detection |
| **ðŸŽšï¸ Threshold-Gated Proposals** | Min occurrences, unique users, time span, impact score, confidence thresholds |
| **ðŸ›¡ï¸ Brain Governor Review** | All proposals pass through Brain risk assessment before admin queue |
| **ðŸ‘¨â€ðŸ’¼ Admin Control** | Human administrators approve all new workflows - no auto-publishing |
| **ðŸ“ Full Audit Trail** | Complete tracking of evidence, decisions, and outcomes |
| **âš™ï¸ Configurable Thresholds** | Admin-editable occurrence, impact, and risk thresholds per tenant |
| **ðŸ“ 4-Dimension Risk Assessment** | Cost, latency, quality, compliance risks evaluated for each proposal |

### Also includes all v4.4.0 features:

| Feature | Description |
|---------|-------------|
| **ðŸ§  Neural-First Architecture** | Neural Engine is the fabric, Brain is the governor - tight integration loop |
| **ðŸ“‹ Think Tank Workflow Registry** | 127 orchestration patterns, 127 production workflows, 834 specialized domains |
| **ðŸŽ¨ Visual Workflow Editor** | Comprehensive drag-and-drop orchestration builder with Neural connectors |
| **âš¡ Real-Time Steering** | Neural Engine monitors and adjusts during execution, not just post-hoc |
| **ðŸ‘¤ Per-User Neural Models** | Personalized preference embeddings, domain preferences, behavioral patterns |
| **ðŸ”„ Concurrent Execution Awareness** | Full support for parallel user sessions in billing, feedback, and learning |
| **ðŸ“Š Enhanced Analytics Integration** | Analytics feeds Neural Engine learning signals in real-time |
| **ðŸŽ›ï¸ Full Admin Parameter Control** | All Neural/Brain parameters editable through Admin Dashboard |
| **ðŸ“± Client Decision Transparency** | Think Tank receives reasoning, confidence, alternatives for every decision |
| **ðŸ”§ Swift Deployment App v2** | Enhanced deployer with workflow management and Neural configuration |

### Also includes all v4.3.0 features:

| Feature | Description |
|---------|-------------|
| **ðŸ‘ Feedback System** | Thumbs up/down + optional categories + text/voice comments |
| **ðŸŽ¯ Execution Manifests** | Full provenance: models, orchestrations, services, thermal states, latency, cost |
| **ðŸ§  Neural Engine Learning** | Continuous learning from explicit + implicit feedback signals |
| **ðŸ”„ Brain â†” Neural Loop** | Real-time Brain decisions informed by Neural Engine intelligence |
| **ðŸ—£ï¸ Multi-Language Voice** | Voice feedback in any language with auto-transcription/translation |
| **ðŸ“Š Implicit Signal Capture** | Regenerate, copy, abandon, manual switch = automatic feedback |
| **ðŸŽšï¸ Tiered Learning Scope** | Individual â†’ Tenant â†’ Global learning with privacy isolation |
| **ðŸ›¡ï¸ Feedback Trust Scores** | Anti-gaming: rate limits, outlier detection, weighted trust |
| **ðŸ”¬ A/B Testing Framework** | Measure if routing changes actually improve outcomes |
| **â„ï¸ Cold Start Handling** | Default routing + collaborative filtering for new users/models |

### Also includes all v4.2.0 features:

| Feature | Description |
|---------|-------------|
| **ðŸ”— Unified Model Registry** | Single SQL view combining ALL 106 models (external + self-hosted) |
| **ðŸ”„ Registry Sync Service** | Automated Lambda syncs providers daily, health checks every 5 min |
| **ðŸ“‹ Complete Self-Hosted Catalog** | 56 self-hosted models with full metadata across 7 categories |
| **ðŸŽ¯ Orchestration Selection** | Smart model selection algorithm with thermal state awareness |
| **ðŸ·ï¸ hosting_type Field** | Clear differentiation: 'external' vs 'self_hosted' per model |
| **ðŸ“Š primary_mode Field** | Routing mode: chat, completion, embedding, image, video, audio, search, 3d |
| **âš¡ Thermal-Aware Routing** | Prefer HOT > WARM > COLD for latency optimization |
| **ðŸ¥ Health Status Integration** | Filter unhealthy providers/endpoints from selection |

### Also includes all v4.1.0 features:

| Feature | Description |
|---------|-------------|
| **ðŸ§¬ AlphaFold 2** | Nobel Prize-winning protein folding (93M params, CASP14 champion) |
| **ðŸ”§ Database-Driven Orchestration** | ALL model configs stored in PostgreSQL - zero hardcoding |
| **ðŸ“œ License Management** | Track licenses, compliance status, and commercial use for all models |
| **âž• Admin Model CRUD** | Add/edit/delete models entirely through Admin Dashboard UI |
| **ðŸ”„ Workflow Engine** | Execute multi-step scientific workflows with database-defined DAGs |
| **ðŸ“Š Audit Trail** | Complete logging of all model, workflow, and license changes |
| **ðŸ§ª Protein Folding Pipeline** | Pre-built AlphaFold 2 workflow with MSA â†’ Structure â†’ Relaxation |
| **âš–ï¸ Compliance Dashboard** | Visual license compliance tracking with Apache/MIT/CC indicators |

### Also includes all v4.0.0 features:

| Feature | Description |
|---------|-------------|
| **â° Time Machine** | Apple Time Machine-inspired chat history - fly back through time |
| **Visual Timeline** | 3D perspective view showing chat history fading into the past |
| **Calendar Navigator** | Jump to any date with visual calendar picker |
| **Instant Restore** | One-click restore of any message, file, or entire conversation state |
| **Media Vault** | Every file version preserved forever with S3 versioning |
| **Service Layer APIs** | Full Time Machine exposed via Complex API |
| **AI Simplified API** | Time Machine features available in simplified AI API |
| **Never Lose Anything** | Soft-delete only - everything recoverable forever |
| **Export Bundles** | Download complete history as ZIP/JSON/Markdown/PDF |
| **Hidden by Default** | Ultra-simple UI until user clicks "Enter Time Machine" |

### Also includes all v3.8.0 features:

| Feature | Description |
|---------|-------------|
| **User Model Selection** | Users can manually select AI models in Think Tank (not just Auto) |
| **Standard Models (15)** | Production-ready models from major providers |
| **Novel Models (15)** | Cutting-edge/experimental models with unique capabilities |
| **Admin Editable Pricing** | Full control over model pricing and markups in Admin Dashboard |
| **Bulk Pricing Controls** | Set all external (40% default) or self-hosted (75% default) to one margin |
| **Individual Price Override** | Override markup for specific models |
| **Cost Transparency** | Per-message cost display with user's selected model |
| **Model Favorites** | Users can favorite models for quick access |
| **Domain Mode Integration** | Different default models per domain mode (Medical, Code, etc.) |

---

## ðŸ“‹ VERSION HISTORY

| Version | Sections | Key Features |
|---------|----------|--------------|
| v2.0.0 | 0-2 | Foundation: Shared Types, Swift Deployer, CDK Infrastructure |
| v2.1.0 | 3-5 | Core Platform: AI Stacks, Lambda Functions, Admin & Billing |
| v2.2.0 | 6-9 | Full Platform: Self-Hosted Models, Database Schema, Admin Dashboard, Deployment |
| v2.3.0 | 10 | Visual AI Pipeline (13 models) |
| v2.4.0 | 11 | RADIANT Brain intelligent routing |
| v2.5.0 | 12 | Metrics & Analytics Engine |
| v3.0.0 | 13 | User Neural Engine (pgvector) |
| v3.1.0 | 14 | Centralized Error Logging |
| v3.2.0 | 15-16 | External & AWS Credentials Registry |
| v3.3.0 | 17 | Simple Auto-Resolve API |
| v3.4.0 | - | Internal milestone (no user-facing changes) |
| v3.5.0 | 18 | THINK TANK consumer platform |
| v3.6.0 | 19-28 | Concurrent Chat, Collaboration, Voice, Memory, Canvas, Personas, Scheduling, Family Plans, Analytics |
| v3.7.0 | 29-30 | Admin Extensions, Dynamic Provider Registry + xAI/Grok |
| v3.8.0 | 31 | Think Tank Model Selection & Editable Pricing |
| v4.0.0 | 32-33 | Time Machine: Visual History, Service Layer APIs, Media Vault |
| v4.1.0 | 34-35 | Database-Driven Orchestration, AlphaFold 2, License Management, Admin Model CRUD |
| v4.2.0 | 36 | Unified Model Registry, Registry Sync Service, 56 Self-Hosted Models, Orchestration Selection |
| v4.3.0 | 37 | Feedback Learning System, Neural Engine Loop, Multi-Language Voice, Implicit Signals, A/B Testing |
| v4.4.0 | 38 | Neural-First Orchestration, Think Tank Workflow Registry, Visual Workflow Editor, Swift Deployer v2 |
| v4.5.0 | 39 | Dynamic Workflow Proposal System, Evidence-Based Detection, Brain Governor Review, Admin Control |
| **v4.6.0** | **40** | **Application-Level Data Isolation, App-Scoped Users, Enhanced RLS, Think Tank Isolation** |
| **v4.7.0** | **41** | **Complete i18n System, Localization Registry, AI Translation, 18 Languages** |
| **v4.7.1** | **-** | **Rename: Radiant Solver â†’ Think Tank (consumer app branding)** |
| **v4.8.0** | **42** | **Dynamic Configuration Management, Admin-Editable Parameters, Hot Reload** |
| **v4.9.0** | **-** | **Structural Cleanup: Migration renumbering, duplicate removal, consistency fixes** |
| **v4.10.0** | **-** | **Implementation-Ready: Component clarification, phased implementation guide** |
| **v4.12.0** | **-** | **Brain Price Optimizer: Cost vs price distinction, caching/batch discounts** |
| **v4.13.0** | **43** | **Billing & Credits System - 7-tier subscriptions, prepaid credits, Stripe integration** |
| **v4.14.0** | **44** | **Storage Billing - Tiered S3/DB/backup pricing, quota management** |
| **v4.15.0** | **45** | **Versioned Subscriptions - Grandfathering, migration incentives** |
| **v4.16.0** | **46** | **Dual-Admin Approval - Two-person migration approval, audit trail** |
| **v4.16.1** | **-** | **Audit & Consistency Fixes - RLS standardization, type deduplication, localization** |
| **v4.17.0** | **-** | **AI Code Gen Optimization - Complete Swift app, Package.swift, Sendable conformance, version constants** |

---

## ðŸ“‹ MIGRATION TO SECTION MAPPING

| Migration | Section | Version | Description |
|-----------|---------|---------|-------------|
| 001_initial_schema.sql | 7 | v2.2.0 | Core tables: tenants, users, sessions |
| 002_tenant_isolation.sql | 7 | v2.2.0 | RLS policies for tenant isolation |
| 003_ai_models.sql | 7 | v2.2.0 | Models and providers tables |
| 004_usage_billing.sql | 7 | v2.2.0 | Usage events and billing |
| 005_admin_approval.sql | 5 | v2.2.0 | Admin invitations and approvals |
| 006_self_hosted_models.sql | 6 | v2.2.0 | SageMaker model configurations |
| 007_external_providers.sql | 7 | v2.2.0 | External provider registry |
| 010_visual_ai_pipeline.sql | 10 | v2.3.0 | Visual pipeline jobs |
| 011_radiant_brain.sql | 11 | v2.4.0 | Brain routing decisions |
| 012_metrics_analytics.sql | 12 | v2.5.0 | Usage metrics and aggregations |
| 013_user_neural_engine.sql | 13 | v3.0.0 | User preferences and memory |
| 014_centralized_error_logging.sql | 14 | v3.1.0 | Error logs table |
| 015_credentials_registry.sql | 15 | v3.2.0 | Credential vaults |
| 016_aws_admin.sql | 16 | v3.2.0 | AWS credentials integration |
| 017_auto_resolve.sql | 17 | v3.3.0 | Auto-resolve requests |
| 018_think_tank.sql | 18 | v3.5.0 | Think Tank sessions and steps |
| 019_concurrent_chat.sql | 19 | v3.6.0 | Concurrent sessions |
| 020_realtime_collaboration.sql | 20 | v3.6.0 | Collaboration sessions |
| 021_voice_video.sql | 21 | v3.6.0 | Voice sessions and transcriptions |
| 022_persistent_memory.sql | 22 | v3.6.0 | Memory stores |
| 023_canvas_artifacts.sql | 23 | v3.6.0 | Canvas and artifacts |
| 024_result_merging.sql | 24 | v3.6.0 | Merge sessions |
| 025_focus_personas.sql | 25 | v3.6.0 | User personas |
| 026_scheduled_prompts.sql | 26 | v3.6.0 | Scheduled prompts |
| 027_team_plans.sql | 27 | v3.6.0 | Team plans |
| 028_analytics_extensions.sql | 28 | v3.6.0 | Analytics dashboard extensions |
| 029_admin_extensions.sql | 29 | v3.7.0 | Admin dashboard extensions |
| 030_dynamic_provider_registry.sql | 30 | v3.7.0 | Provider registry with xAI |
| 031_thinktank_model_selection.sql | 31 | v3.8.0 | User model preferences |
| 032_time_machine_core.sql | 32 | v4.0.0 | Time Machine snapshots |
| 033_time_machine_media.sql | 33 | v4.0.0 | Media vault for Time Machine |
| 034_orchestration_engine.sql | 34 | v4.1.0 | Orchestration patterns |
| 035_license_management.sql | 35 | v4.1.0 | License tracking |
| 036_unified_model_registry.sql | 36 | v4.2.0 | Unified model registry |
| 037_feedback_learning.sql | 37 | v4.3.0 | Feedback and learning signals |
| 038_neural_orchestration.sql | 38 | v4.4.0 | Neural orchestration registry |
| 039_workflow_proposals.sql | 39 | v4.5.0 | Dynamic workflow proposals |
| 040_app_isolation.sql | 40 | v4.6.0 | Application-level isolation |
| 041_localization.sql | 41 | v4.7.0 | Internationalization system |
| 042_configuration.sql | 42 | v4.8.0 | Dynamic configuration |
| 043_billing_system.sql | 43 | v4.13.0 | Billing tiers, credits, Stripe |
| 044_storage_billing.sql | 44 | v4.14.0 | Storage usage and pricing |
| 045_versioned_subscriptions.sql | 45 | v4.15.0 | Plan versions, grandfathering |
| 046_dual_admin_approval.sql | 46 | v4.16.0 | Migration approval workflow |

---

## ðŸ”— IMPLEMENTATION DEPENDENCY GRAPH

Implementation Order (deploy in this sequence):

**Phase 1: Foundation (Sections 0-2)**
- Section 0: Shared Types (no dependencies)
- Section 1: Swift Deployment App (depends on: 0)
- Section 2: CDK Infrastructure Stacks (depends on: 0)

**Phase 2: Core Infrastructure (Sections 3-7)**
- Section 3: CDK AI & API Stacks (depends on: 2)
- Section 4: Lambda Core (depends on: 0, 3)
- Section 5: Lambda Admin & Billing (depends on: 4)
- Section 6: Self-Hosted Models (depends on: 3)
- Section 7: Database Schema (depends on: none - deploy migrations first!)

**Phase 3: Admin & Deployment (Sections 8-9)**
- Section 8: Admin Dashboard (depends on: 4, 5, 7)
- Section 9: Assembly & Deployment Guide (depends on: 1-8)

**Phase 4: AI Features (Sections 10-17)**
- Section 10: Visual AI Pipeline (depends on: 7)
- Section 11: RADIANT Brain (depends on: 10)
- Section 12: Metrics & Analytics (depends on: 7)
- Section 13: User Neural Engine (depends on: 7, 12)
- Section 14: Error Logging (depends on: 7)
- Section 15: Credentials Registry (depends on: 7)
- Section 16: AWS Admin Credentials (depends on: 15)
- Section 17: Auto-Resolve API (depends on: 11, 13)

**Phase 5: Consumer Platform (Sections 18-28)**
- Section 18: Think Tank Platform (depends on: 11, 13)
- Section 19: Concurrent Chat (depends on: 18)
- Section 20: Real-Time Collaboration (depends on: 19)
- Section 21: Voice & Video (depends on: 18)
- Section 22: Persistent Memory (depends on: 13, 18)
- Section 23: Canvas & Artifacts (depends on: 18)
- Section 24: Result Merging (depends on: 19)
- Section 25: Focus Modes & Personas (depends on: 18)
- Section 26: Scheduled Prompts (depends on: 18)
- Section 27: Family & Team Plans (depends on: 18)
- Section 28: Analytics Integration (depends on: 12, 18)

**Phase 6: Advanced Features (Sections 29-35)**
- Section 29: Admin Dashboard Extensions (depends on: 8, 18)
- Section 30: Dynamic Provider Registry (depends on: 7, 11)
- Section 31: Model Selection & Pricing (depends on: 18, 30)
- Section 32: Time Machine Core (depends on: 18)
- Section 33: Time Machine UI (depends on: 32)
- Section 34: Orchestration Engine (depends on: 11, 30)
- Section 35: License Management UI (depends on: 8, 34)

**Phase 7: Intelligence Layer (Sections 36-39)**
- Section 36: Unified Model Registry (depends on: 30, 34)
- Section 37: Feedback Learning (depends on: 13, 18)
- Section 38: Neural Orchestration (depends on: 34, 36, 37)
- Section 39: Workflow Proposals (depends on: 38)

**Phase 8: Platform Hardening (Sections 40-42)**
- Section 40: App Isolation (depends on: all previous)
- Section 41: Internationalization (depends on: 40)
- Section 42: Dynamic Configuration (depends on: 41)

**Phase 9: Billing & Enterprise (Sections 43-46)**
- Section 43: Billing & Credits (depends on: 42)
- Section 44: Storage Billing (depends on: 43)
- Section 45: Versioned Subscriptions (depends on: 43, 44)
- Section 46: Dual-Admin Approval (depends on: 43)

---

## âš ï¸ CRITICAL: Database Connection Standard

**ALL Lambda functions MUST use this pattern:**

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
```

**Environment variable required:**
```bash
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

**Do NOT use individual DB_HOST, DB_NAME, DB_USER, DB_PASSWORD variables.**


# Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
# SECTION 0: UNIFIED SHARED TYPES & CONSTANTS (v2.0.0 - SINGLE SOURCE OF TRUTH)
# Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â

> **CRITICAL: This section defines ALL shared types, interfaces, and constants.**
> **All other sections MUST import from `@radiant/shared` - NEVER redefine these.**

---

## 0.1 PROJECT ROOT CONFIGURATION

### Directory Structure

```
radiant/
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ package.json
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ pnpm-workspace.yaml
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ tsconfig.base.json
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ .nvmrc
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ .gitignore
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ packages/
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ shared/                    # SECTION 0 - Shared types (implement first)
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ infrastructure/            # SECTIONS 2-3 - CDK stacks
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ functions/                     # SECTIONS 4-5 - Lambda functions
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ migrations/                    # SECTION 7 - Database migrations
Ã¢â€â€š
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ apps/
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ swift-deployer/           # SECTION 1 - macOS deployment app
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ admin-dashboard/          # SECTION 8 - Next.js admin UI
Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ docs/
```

### package.json (root)

```json
{
  "name": "radiant",
  "version": "2.2.0",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*",
    "functions/*"
  ],
  "scripts": {
    "build": "pnpm -r build",
    "build:shared": "cd packages/shared && pnpm build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "deploy:dev": "cd packages/infrastructure && cdk deploy --all --context environment=dev",
    "deploy:staging": "cd packages/infrastructure && cdk deploy --all --context environment=staging",
    "deploy:prod": "cd packages/infrastructure && cdk deploy --all --context environment=prod --require-approval broadening"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'functions/*'
```

### tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "paths": {
      "@radiant/shared": ["./packages/shared/src"],
      "@radiant/shared/*": ["./packages/shared/src/*"]
    }
  }
}
```

### .nvmrc

```
20
```

### .gitignore

```
node_modules/
dist/
.next/
*.log
.env*
!.env.example
.DS_Store
coverage/
cdk.out/
```

---

## 0.2 SHARED PACKAGE STRUCTURE

```
packages/shared/
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ package.json
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ tsconfig.json
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ src/
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ index.ts
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ types/
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ index.ts
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ app.types.ts
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ environment.types.ts
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ ai.types.ts
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ admin.types.ts
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ billing.types.ts
    Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ compliance.types.ts
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ constants/
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ index.ts
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ apps.ts
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ environments.ts
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ tiers.ts
    Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ regions.ts
    Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ providers.ts
    Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ utils/
        Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ index.ts
        Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ validation.ts
        Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ formatting.ts
```

### packages/shared/package.json

```json
{
  "name": "@radiant/shared",
  "version": "2.2.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./types": "./dist/types/index.js",
    "./constants": "./dist/constants/index.js",
    "./utils": "./dist/utils/index.js"
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "prepublishOnly": "pnpm build"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

### packages/shared/tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 0.3 VERSION & CONSTANTS

### packages/shared/src/constants/version.ts

```typescript
/**
 * RADIANT Version Constants
 * SINGLE SOURCE OF TRUTH for version numbers
 * 
 * @description Update this file when releasing new versions.
 * All other code should import from here.
 */

// ============================================================================
// VERSION INFORMATION
// ============================================================================

/** Current RADIANT platform version */
export const RADIANT_VERSION = '4.17.0';

/** Version components for programmatic comparison */
export const VERSION = {
  major: 4,
  minor: 17,
  patch: 0,
  full: '4.17.0',
  build: process.env.BUILD_NUMBER || 'local',
  date: '2024-12',
} as const;

/** Minimum supported versions for various components */
export const MIN_VERSIONS = {
  node: '20.0.0',
  npm: '10.0.0',
  cdk: '2.120.0',
  postgres: '15.0',
  swift: '5.9',
  macos: '13.0',
  xcode: '15.0',
} as const;

// ============================================================================
// DOMAIN CONFIGURATION
// ============================================================================

/**
 * Domain placeholder - replace with your actual domain
 * Used throughout the codebase for consistency
 */
export const DOMAIN_PLACEHOLDER = 'YOUR_DOMAIN.com';

/**
 * Check if domain has been configured
 */
export function isDomainConfigured(domain: string): boolean {
  return !domain.includes(DOMAIN_PLACEHOLDER);
}
```

### packages/shared/src/constants/index.ts

```typescript
// Re-export all constants
export * from './version';
```

---

## 0.4 TYPE DEFINITIONS

### packages/shared/src/types/index.ts

```typescript
// Re-export all types and constants
export * from './app.types';
export * from './environment.types';
export * from './ai.types';
export * from './admin.types';
export * from './billing.types';
export * from './compliance.types';

// Re-export constants
export * from '../constants';
```

### packages/shared/src/types/app.types.ts

```typescript
/**
 * RADIANT v2.2.0 - Application Types
 * SINGLE SOURCE OF TRUTH
 */

import type { Environment, TierLevel } from './environment.types';

export interface ManagedApp {
  id: string;                    // Lowercase, no spaces: "thinktank"
  name: string;                  // Display name: "Think Tank"
  domain: string;                // Base domain: "app.YOUR_DOMAIN.com"
  description?: string;
  icon?: string;
  version?: string;
  status: AppStatus;
  environments: EnvironmentStatus[];
  createdAt: Date;
  updatedAt: Date;
}

export type AppStatus = 'active' | 'inactive' | 'maintenance' | 'deprecated';

export interface EnvironmentStatus {
  environment: Environment;
  status: DeploymentStatus;
  lastDeployed?: Date;
  version?: string;
  tier: TierLevel;
  region: string;
  endpoints?: EnvironmentEndpoints;
}

export type DeploymentStatus = 
  | 'not_deployed' 
  | 'deploying' 
  | 'deployed' 
  | 'failed' 
  | 'updating' 
  | 'destroying';

export interface EnvironmentEndpoints {
  api?: string;
  graphql?: string;
  admin?: string;
  dashboard?: string;
}

export interface AppConfig {
  appId: string;
  appName: string;
  domain: string;
  environments: Record<Environment, EnvironmentConfig>;
}

export interface EnvironmentConfig {
  tier: TierLevel;
  region: string;
  enabledFeatures: FeatureFlags;
  customConfig?: Record<string, unknown>;
}

export interface FeatureFlags {
  selfHostedModels: boolean;
  multiRegion: boolean;
  waf: boolean;
  guardDuty: boolean;
  hipaaCompliance: boolean;
  advancedAnalytics: boolean;
  customBranding: boolean;
  sla: boolean;
}

export type DeploymentPhase =
  | 'idle'
  | 'initializing'
  | 'validating'
  | 'bootstrap'
  | 'foundation'
  | 'networking'
  | 'security'
  | 'data'
  | 'storage'
  | 'auth'
  | 'ai'
  | 'api'
  | 'admin'
  | 'migrations'
  | 'verification'
  | 'complete'
  | 'failed';

export interface DeploymentProgress {
  phase: DeploymentPhase;
  progress: number;              // 0-100
  message: string;
  startedAt: Date;
  estimatedCompletion?: Date;
  logs: LogEntry[];
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
}
```

### packages/shared/src/types/environment.types.ts

```typescript
/**
 * RADIANT v2.2.0 - Environment & Tier Types
 * SINGLE SOURCE OF TRUTH
 */

export type Environment = 'dev' | 'staging' | 'prod';

export interface EnvironmentInfo {
  name: Environment;
  displayName: string;
  color: string;
  requiresApproval: boolean;
  minTier: TierLevel;
  defaultTier: TierLevel;
}

export type TierLevel = 1 | 2 | 3 | 4 | 5;

export type TierName = 'SEED' | 'STARTUP' | 'GROWTH' | 'SCALE' | 'ENTERPRISE';

export interface TierConfig {
  level: TierLevel;
  name: TierName;
  description: string;
  
  // Compute
  vpcCidr: string;
  azCount: number;
  natGateways: number;
  
  // Database
  auroraMinCapacity: number;
  auroraMaxCapacity: number;
  enableGlobalDatabase: boolean;
  
  // Cache
  elasticacheNodes: number;
  elasticacheNodeType: string;
  
  // AI
  enableSelfHostedModels: boolean;
  maxSagemakerEndpoints: number;
  litellmTaskCount: number;
  litellmCpu: number;
  litellmMemory: number;
  
  // Security
  enableWaf: boolean;
  enableGuardDuty: boolean;
  enableSecurityHub: boolean;
  
  // Compliance
  enableHipaa: boolean;
  
  // Costs
  estimatedMonthlyCost: CostEstimate;
}

export interface CostEstimate {
  min: number;
  max: number;
  typical: number;
}

export interface RegionConfig {
  code: string;
  name: string;
  available: boolean;
  isGlobal: boolean;
}
```

### packages/shared/src/types/ai.types.ts

```typescript
/**
 * RADIANT v2.2.0 - AI/Model Types
 * SINGLE SOURCE OF TRUTH
 */

export interface AIProvider {
  id: string;
  name: string;
  apiKeyEnvVar: string;
  baseUrl: string;
  hipaaCompliant: boolean;
  capabilities: ProviderCapability[];
  status: ProviderStatus;
  models?: AIModel[];
}

export type ProviderCapability = 
  | 'text_generation'
  | 'chat_completion'
  | 'embeddings'
  | 'image_generation'
  | 'image_analysis'
  | 'video_generation'
  | 'audio_transcription'
  | 'audio_generation'
  | 'code_generation'
  | 'reasoning'
  | 'search'
  | 'function_calling'
  | '3d_generation';

export type ProviderStatus = 'active' | 'degraded' | 'maintenance' | 'disabled';

export interface AIModel {
  id: string;
  providerId: string;
  name: string;
  displayName: string;
  description?: string;
  specialty: ModelSpecialty;
  category: ModelCategory;
  capabilities: ProviderCapability[];
  contextWindow: number;
  maxOutputTokens: number;
  pricing: ModelPricing;
  status: ModelStatus;
  isHosted: boolean;
  thermalState?: ThermalState;
  sagemakerEndpoint?: string;
  metadata?: Record<string, unknown>;
}

export type ModelSpecialty = 
  | 'text_generation'
  | 'reasoning'
  | 'coding'
  | 'image_generation'
  | 'image_analysis'
  | 'video_generation'
  | 'audio_transcription'
  | 'audio_generation'
  | 'embeddings'
  | 'search'
  | '3d_generation'
  | 'scientific';

export type ModelCategory = 
  | 'llm'
  | 'vision'
  | 'audio'
  | 'multimodal'
  | 'embedding'
  | 'specialized';

export type ModelStatus = 'active' | 'disabled' | 'deprecated' | 'coming_soon';

export interface ModelPricing {
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  imagePrice?: number;
  audioMinutePrice?: number;
  currency: 'USD';
}

// Thermal state for self-hosted models
export type ThermalState = 'OFF' | 'COLD' | 'WARM' | 'HOT' | 'AUTOMATIC';

export interface ThermalConfig {
  modelId: string;
  state: ThermalState;
  targetState?: ThermalState;
  lastStateChange?: Date;
  coldStartTime: number;
  warmupTime: number;
  idleTimeout: number;
  minInstances: number;
  maxInstances: number;
}

// Service state for mid-level services
export type ServiceState = 'RUNNING' | 'DEGRADED' | 'DISABLED' | 'OFFLINE';

export interface MidLevelService {
  id: string;
  name: string;
  description: string;
  state: ServiceState;
  dependencies: string[];
  healthEndpoint: string;
  lastHealthCheck?: Date;
  metrics?: ServiceMetrics;
}

export interface ServiceMetrics {
  requestsPerMinute: number;
  averageLatencyMs: number;
  errorRate: number;
  lastUpdated: Date;
}
```

### packages/shared/src/types/admin.types.ts

```typescript
/**
 * RADIANT v2.2.0 - Administrator Types
 * SINGLE SOURCE OF TRUTH
 */

import type { Environment } from './environment.types';

export interface Administrator {
  id: string;
  cognitoUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: AdminRole;
  appId: string;
  tenantId: string;
  mfaEnabled: boolean;
  mfaMethod?: 'totp' | 'sms';
  status: AdminStatus;
  profile: AdminProfile;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  lastLoginAt?: Date;
}

export type AdminRole = 'super_admin' | 'admin' | 'operator' | 'auditor';

export type AdminStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface AdminRolePermissions {
  canManageAdmins: boolean;
  canManageModels: boolean;
  canManageProviders: boolean;
  canManageBilling: boolean;
  canDeploy: boolean;
  canApprove: boolean;
  canViewAuditLogs: boolean;
}

export const ROLE_PERMISSIONS: Record<AdminRole, AdminRolePermissions> = {
  super_admin: {
    canManageAdmins: true,
    canManageModels: true,
    canManageProviders: true,
    canManageBilling: true,
    canDeploy: true,
    canApprove: true,
    canViewAuditLogs: true,
  },
  admin: {
    canManageAdmins: true,
    canManageModels: true,
    canManageProviders: true,
    canManageBilling: true,
    canDeploy: true,
    canApprove: true,
    canViewAuditLogs: true,
  },
  operator: {
    canManageAdmins: false,
    canManageModels: true,
    canManageProviders: true,
    canManageBilling: false,
    canDeploy: true,
    canApprove: false,
    canViewAuditLogs: false,
  },
  auditor: {
    canManageAdmins: false,
    canManageModels: false,
    canManageProviders: false,
    canManageBilling: false,
    canDeploy: false,
    canApprove: false,
    canViewAuditLogs: true,
  },
};

export interface AdminProfile {
  timezone: string;
  language: string;
  dateFormat: string;
  timeFormat: string;
  currency: string;
  notifications: NotificationPreferences;
  ui: UIPreferences;
}

export interface NotificationPreferences {
  emailAlerts: boolean;
  slackAlerts: boolean;
  smsAlerts: boolean;
  alertTypes: string[];
}

export interface UIPreferences {
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  defaultEnvironment: Environment;
  tableRowsPerPage: number;
}

export interface Invitation {
  id: string;
  email: string;
  role: AdminRole;
  invitedBy: string;
  appId: string;
  tenantId: string;
  environment?: Environment;
  tokenHash: string;
  expiresAt: Date;
  status: InvitationStatus;
  message?: string;
  createdAt: Date;
  acceptedAt?: Date;
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  action: string;
  targetId: string;
  targetType: string;
  requestedBy: string;
  appId: string;
  tenantId: string;
  environment: Environment;
  status: ApprovalStatus;
  details: Record<string, unknown>;
  requiredApprovers: number;
  approvals: ApprovalVote[];
  expiresAt: Date;
  createdAt: Date;
  completedAt?: Date;
}

export type ApprovalType = 'deployment' | 'promotion' | 'config_change' | 'admin_action';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ApprovalVote {
  adminId: string;
  vote: 'approve' | 'reject';
  comment?: string;
  votedAt: Date;
}
```

### packages/shared/src/types/billing.types.ts

```typescript
/**
 * RADIANT v2.2.0 - Billing/Metering Types
 * SINGLE SOURCE OF TRUTH
 */

export interface UsageEvent {
  id: string;
  tenantId: string;
  appId: string;
  userId?: string;
  modelId: string;
  providerId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  margin: number;
  billedAmount: number;
  requestType: RequestType;
  responseTime: number;
  status: UsageStatus;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export type RequestType = 'chat' | 'completion' | 'embedding' | 'image' | 'audio' | 'video';

export type UsageStatus = 'success' | 'error' | 'rate_limited' | 'timeout';

export interface TenantBilling {
  tenantId: string;
  appId: string;
  stripeCustomerId?: string;
  billingEmail: string;
  plan: BillingPlan;
  margin: number;
  creditBalance: number;
  lastInvoiceDate?: Date;
  nextInvoiceDate?: Date;
}

export type BillingPlan = 'free' | 'starter' | 'professional' | 'enterprise';

export interface Invoice {
  id: string;
  tenantId: string;
  appId: string;
  stripeInvoiceId?: string;
  periodStart: Date;
  periodEnd: Date;
  subtotal: number;
  margin: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  paidAt?: Date;
  createdAt: Date;
}

export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'failed' | 'void';

export interface BillingBreakdown {
  period: { start: Date; end: Date };
  usage: {
    totalRequests: number;
    totalTokens: number;
    byModel: ModelUsageSummary[];
    byProvider: ProviderUsageSummary[];
  };
  costs: {
    baseCost: number;
    margin: number;
    total: number;
  };
}

export interface ModelUsageSummary {
  modelId: string;
  modelName: string;
  requests: number;
  tokens: number;
  cost: number;
}

export interface ProviderUsageSummary {
  providerId: string;
  providerName: string;
  requests: number;
  tokens: number;
  cost: number;
}

export interface PricingConfig {
  defaultMargin: number;
  minimumCharge: number;
  currencyCode: string;
  tierDiscounts: TierDiscount[];
}

export interface TierDiscount {
  minTokens: number;
  discountPercent: number;
}

export const DEFAULT_PRICING: PricingConfig = {
  defaultMargin: 0.40,
  minimumCharge: 0.01,
  currencyCode: 'USD',
  tierDiscounts: [
    { minTokens: 1_000_000, discountPercent: 5 },
    { minTokens: 10_000_000, discountPercent: 10 },
    { minTokens: 100_000_000, discountPercent: 15 },
  ],
};
```

### packages/shared/src/types/compliance.types.ts

```typescript
/**
 * RADIANT v2.2.0 - Compliance/PHI Types
 * SINGLE SOURCE OF TRUTH
 */

export type PHIMode = 'auto' | 'manual' | 'disabled';

export interface PHIConfig {
  mode: PHIMode;
  categories: PHICategory[];
  autoSanitize: boolean;
  allowReidentification: boolean;
  logSanitization: boolean;
  retentionDays: number;
}

export type PHICategory =
  | 'name'
  | 'date'
  | 'phone'
  | 'email'
  | 'ssn'
  | 'mrn'
  | 'address'
  | 'age'
  | 'medical_condition'
  | 'medication'
  | 'procedure';

export const DEFAULT_PHI_CONFIG: PHIConfig = {
  mode: 'auto',
  categories: ['name', 'date', 'phone', 'email', 'ssn', 'mrn', 'address'],
  autoSanitize: true,
  allowReidentification: false,
  logSanitization: true,
  retentionDays: 365,
};

export interface ComplianceReport {
  id: string;
  type: ComplianceReportType;
  generatedAt: Date;
  period: { start: Date; end: Date };
  results: ComplianceCheck[];
  overallStatus: ComplianceStatus;
  recommendations: string[];
}

export type ComplianceReportType = 'hipaa' | 'soc2' | 'gdpr' | 'full';

export type ComplianceStatus = 'compliant' | 'non_compliant' | 'needs_review';

export interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  status: ComplianceStatus;
  evidence?: string;
  remediation?: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  appId: string;
  adminId?: string;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
```


---

## 0.4 CONSTANTS

### packages/shared/src/constants/index.ts

```typescript
export * from './apps';
export * from './environments';
export * from './tiers';
export * from './regions';
export * from './providers';
```

### packages/shared/src/constants/apps.ts

```typescript
/**
 * RADIANT v2.2.0 - Managed Applications
 * SINGLE SOURCE OF TRUTH - Update YOUR_DOMAIN.com with your actual domain
 */

export const MANAGED_APPS = [
  { id: 'thinktank', name: 'Think Tank', domain: 'thinktank.YOUR_DOMAIN.com' },
  { id: 'launchboard', name: 'Launch Board', domain: 'launchboard.YOUR_DOMAIN.com' },
  { id: 'alwaysme', name: 'Always Me', domain: 'alwaysme.YOUR_DOMAIN.com' },
  { id: 'mechanicalmaker', name: 'Mechanical Maker', domain: 'mechanicalmaker.YOUR_DOMAIN.com' },
] as const;

export type ManagedAppId = typeof MANAGED_APPS[number]['id'];
```

### packages/shared/src/constants/environments.ts

```typescript
/**
 * RADIANT v2.2.0 - Environment Configuration
 * SINGLE SOURCE OF TRUTH
 */

import type { Environment, EnvironmentInfo, TierLevel } from '../types';

export const ENVIRONMENTS: Record<Environment, EnvironmentInfo> = {
  dev: {
    name: 'dev',
    displayName: 'Development',
    color: '#3B82F6',
    requiresApproval: false,
    minTier: 1 as TierLevel,
    defaultTier: 1 as TierLevel,
  },
  staging: {
    name: 'staging',
    displayName: 'Staging',
    color: '#F59E0B',
    requiresApproval: false,
    minTier: 2 as TierLevel,
    defaultTier: 2 as TierLevel,
  },
  prod: {
    name: 'prod',
    displayName: 'Production',
    color: '#EF4444',
    requiresApproval: true,
    minTier: 3 as TierLevel,
    defaultTier: 3 as TierLevel,
  },
};

export const ENVIRONMENT_LIST: Environment[] = ['dev', 'staging', 'prod'];
```

### packages/shared/src/constants/tiers.ts

```typescript
/**
 * RADIANT v2.2.0 - Infrastructure Tiers
 * SINGLE SOURCE OF TRUTH - Used by CDK and all components
 */

import type { TierConfig, TierLevel, TierName } from '../types';

export const TIER_NAMES: Record<TierLevel, TierName> = {
  1: 'SEED',
  2: 'STARTUP',
  3: 'GROWTH',
  4: 'SCALE',
  5: 'ENTERPRISE',
};

export const TIER_CONFIGS: Record<TierLevel, TierConfig> = {
  1: {
    level: 1,
    name: 'SEED',
    description: 'Development and testing, minimal costs',
    vpcCidr: '10.0.0.0/20',
    azCount: 2,
    natGateways: 1,
    auroraMinCapacity: 0.5,
    auroraMaxCapacity: 2,
    enableGlobalDatabase: false,
    elasticacheNodes: 0,
    elasticacheNodeType: 'cache.t4g.micro',
    enableSelfHostedModels: false,
    maxSagemakerEndpoints: 0,
    litellmTaskCount: 1,
    litellmCpu: 256,
    litellmMemory: 512,
    enableWaf: false,
    enableGuardDuty: false,
    enableSecurityHub: false,
    enableHipaa: false,
    estimatedMonthlyCost: { min: 50, max: 150, typical: 85 },
  },
  2: {
    level: 2,
    name: 'STARTUP',
    description: 'Small production workloads',
    vpcCidr: '10.0.0.0/18',
    azCount: 2,
    natGateways: 1,
    auroraMinCapacity: 1,
    auroraMaxCapacity: 8,
    enableGlobalDatabase: false,
    elasticacheNodes: 1,
    elasticacheNodeType: 'cache.t4g.small',
    enableSelfHostedModels: false,
    maxSagemakerEndpoints: 0,
    litellmTaskCount: 2,
    litellmCpu: 512,
    litellmMemory: 1024,
    enableWaf: true,
    enableGuardDuty: true,
    enableSecurityHub: false,
    enableHipaa: false,
    estimatedMonthlyCost: { min: 200, max: 400, typical: 255 },
  },
  3: {
    level: 3,
    name: 'GROWTH',
    description: 'Medium production with self-hosted models',
    vpcCidr: '10.0.0.0/17',
    azCount: 3,
    natGateways: 2,
    auroraMinCapacity: 2,
    auroraMaxCapacity: 16,
    enableGlobalDatabase: false,
    elasticacheNodes: 2,
    elasticacheNodeType: 'cache.r6g.large',
    enableSelfHostedModels: true,
    maxSagemakerEndpoints: 10,
    litellmTaskCount: 3,
    litellmCpu: 1024,
    litellmMemory: 2048,
    enableWaf: true,
    enableGuardDuty: true,
    enableSecurityHub: true,
    enableHipaa: true,
    estimatedMonthlyCost: { min: 1000, max: 2500, typical: 1475 },
  },
  4: {
    level: 4,
    name: 'SCALE',
    description: 'Large production with multi-region',
    vpcCidr: '10.0.0.0/16',
    azCount: 3,
    natGateways: 3,
    auroraMinCapacity: 4,
    auroraMaxCapacity: 64,
    enableGlobalDatabase: true,
    elasticacheNodes: 3,
    elasticacheNodeType: 'cache.r6g.xlarge',
    enableSelfHostedModels: true,
    maxSagemakerEndpoints: 30,
    litellmTaskCount: 5,
    litellmCpu: 2048,
    litellmMemory: 4096,
    enableWaf: true,
    enableGuardDuty: true,
    enableSecurityHub: true,
    enableHipaa: true,
    estimatedMonthlyCost: { min: 4000, max: 8000, typical: 5450 },
  },
  5: {
    level: 5,
    name: 'ENTERPRISE',
    description: 'Enterprise-grade global deployment',
    vpcCidr: '10.0.0.0/14',
    azCount: 3,
    natGateways: 3,
    auroraMinCapacity: 8,
    auroraMaxCapacity: 128,
    enableGlobalDatabase: true,
    elasticacheNodes: 6,
    elasticacheNodeType: 'cache.r6g.2xlarge',
    enableSelfHostedModels: true,
    maxSagemakerEndpoints: 100,
    litellmTaskCount: 10,
    litellmCpu: 4096,
    litellmMemory: 8192,
    enableWaf: true,
    enableGuardDuty: true,
    enableSecurityHub: true,
    enableHipaa: true,
    estimatedMonthlyCost: { min: 15000, max: 35000, typical: 21500 },
  },
};

export function getTierConfig(tier: TierLevel): TierConfig {
  return TIER_CONFIGS[tier];
}

export function getTierName(tier: TierLevel): TierName {
  return TIER_NAMES[tier];
}

export function validateTierForEnvironment(tier: TierLevel, environment: string): void {
  if (environment === 'prod' && tier < 3) {
    throw new Error('Production requires Tier 3 (GROWTH) or higher');
  }
  if (environment === 'staging' && tier < 2) {
    throw new Error('Staging requires Tier 2 (STARTUP) or higher');
  }
}

export function getFeatureFlagsForTier(tier: TierLevel) {
  const config = TIER_CONFIGS[tier];
  return {
    selfHostedModels: config.enableSelfHostedModels,
    multiRegion: config.enableGlobalDatabase,
    waf: config.enableWaf,
    guardDuty: config.enableGuardDuty,
    hipaaCompliance: config.enableHipaa,
    advancedAnalytics: tier >= 3,
    customBranding: tier >= 4,
    sla: tier >= 4,
  };
}
```

### packages/shared/src/constants/regions.ts

```typescript
/**
 * RADIANT v2.2.0 - AWS Region Configuration
 * SINGLE SOURCE OF TRUTH
 */

import type { RegionConfig } from '../types';

export const REGIONS: Record<string, RegionConfig> = {
  'us-east-1': { code: 'us-east-1', name: 'US East (N. Virginia)', available: true, isGlobal: true },
  'us-west-2': { code: 'us-west-2', name: 'US West (Oregon)', available: true, isGlobal: false },
  'eu-west-1': { code: 'eu-west-1', name: 'Europe (Ireland)', available: true, isGlobal: true },
  'eu-central-1': { code: 'eu-central-1', name: 'Europe (Frankfurt)', available: true, isGlobal: false },
  'ap-northeast-1': { code: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', available: true, isGlobal: true },
  'ap-southeast-1': { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', available: true, isGlobal: false },
  'ap-south-1': { code: 'ap-south-1', name: 'Asia Pacific (Mumbai)', available: true, isGlobal: false },
};

export const PRIMARY_REGION = 'us-east-1';

export const MULTI_REGION_CONFIG = {
  primary: 'us-east-1',
  europe: 'eu-west-1',
  asia: 'ap-northeast-1',
} as const;

export function getMultiRegionDeployment(primaryRegion: string): string[] {
  if (primaryRegion === 'us-east-1') {
    return ['us-east-1', 'eu-west-1', 'ap-northeast-1'];
  }
  if (primaryRegion.startsWith('eu-')) {
    return ['eu-west-1', 'us-east-1', 'ap-northeast-1'];
  }
  if (primaryRegion.startsWith('ap-')) {
    return ['ap-northeast-1', 'us-east-1', 'eu-west-1'];
  }
  return [primaryRegion];
}

export function getRegionConfig(region: string): RegionConfig {
  const config = REGIONS[region];
  if (!config) {
    throw new Error(\`Unknown region: \${region}\`);
  }
  return config;
}

export function isValidRegion(region: string): boolean {
  return region in REGIONS;
}
```

### packages/shared/src/constants/providers.ts

```typescript
/**
 * RADIANT v2.2.0 - External AI Providers
 * SINGLE SOURCE OF TRUTH
 */

import type { ProviderCapability } from '../types';

export interface ExternalProviderInfo {
  id: string;
  name: string;
  hipaaCompliant: boolean;
  capabilities: ProviderCapability[];
}

export const EXTERNAL_PROVIDERS: ExternalProviderInfo[] = [
  { id: 'openai', name: 'OpenAI', hipaaCompliant: true, capabilities: ['text_generation', 'chat_completion', 'embeddings', 'image_generation', 'audio_transcription', 'function_calling'] },
  { id: 'anthropic', name: 'Anthropic', hipaaCompliant: true, capabilities: ['text_generation', 'chat_completion', 'reasoning', 'function_calling'] },
  { id: 'google', name: 'Google AI', hipaaCompliant: true, capabilities: ['text_generation', 'chat_completion', 'embeddings', 'image_analysis', 'video_generation'] },
  { id: 'xai', name: 'xAI', hipaaCompliant: false, capabilities: ['text_generation', 'chat_completion', 'reasoning'] },
  { id: 'perplexity', name: 'Perplexity', hipaaCompliant: false, capabilities: ['text_generation', 'chat_completion', 'search'] },
  { id: 'deepseek', name: 'DeepSeek', hipaaCompliant: false, capabilities: ['text_generation', 'chat_completion', 'code_generation', 'reasoning'] },
  { id: 'mistral', name: 'Mistral AI', hipaaCompliant: false, capabilities: ['text_generation', 'chat_completion', 'code_generation'] },
  { id: 'cohere', name: 'Cohere', hipaaCompliant: true, capabilities: ['text_generation', 'chat_completion', 'embeddings', 'search'] },
  { id: 'together', name: 'Together AI', hipaaCompliant: false, capabilities: ['text_generation', 'chat_completion', 'image_generation'] },
  { id: 'groq', name: 'Groq', hipaaCompliant: false, capabilities: ['text_generation', 'chat_completion'] },
  { id: 'fireworks', name: 'Fireworks AI', hipaaCompliant: false, capabilities: ['text_generation', 'chat_completion', 'function_calling'] },
  { id: 'replicate', name: 'Replicate', hipaaCompliant: false, capabilities: ['image_generation', 'video_generation', 'audio_generation'] },
  { id: 'huggingface', name: 'Hugging Face', hipaaCompliant: false, capabilities: ['text_generation', 'embeddings'] },
  { id: 'anyscale', name: 'Anyscale', hipaaCompliant: false, capabilities: ['text_generation', 'chat_completion'] },
  { id: 'databricks', name: 'Databricks', hipaaCompliant: true, capabilities: ['text_generation', 'embeddings'] },
  { id: 'aws_bedrock', name: 'AWS Bedrock', hipaaCompliant: true, capabilities: ['text_generation', 'chat_completion', 'embeddings', 'image_generation'] },
  { id: 'azure_openai', name: 'Azure OpenAI', hipaaCompliant: true, capabilities: ['text_generation', 'chat_completion', 'embeddings', 'image_generation'] },
  { id: 'vertex', name: 'Google Vertex AI', hipaaCompliant: true, capabilities: ['text_generation', 'chat_completion', 'embeddings'] },
  { id: 'ollama', name: 'Ollama (Local)', hipaaCompliant: true, capabilities: ['text_generation', 'chat_completion'] },
  { id: 'elevenlabs', name: 'ElevenLabs', hipaaCompliant: false, capabilities: ['audio_generation'] },
  { id: 'runway', name: 'Runway ML', hipaaCompliant: false, capabilities: ['video_generation', 'image_generation'] },
];

export const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  xai: 'https://api.x.ai/v1',
  perplexity: 'https://api.perplexity.ai',
  deepseek: 'https://api.deepseek.com/v1',
  mistral: 'https://api.mistral.ai/v1',
  cohere: 'https://api.cohere.ai/v1',
  together: 'https://api.together.xyz/v1',
  groq: 'https://api.groq.com/openai/v1',
  fireworks: 'https://api.fireworks.ai/inference/v1',
  replicate: 'https://api.replicate.com/v1',
  huggingface: 'https://api-inference.huggingface.co',
  elevenlabs: 'https://api.elevenlabs.io/v1',
  runway: 'https://api.runwayml.com/v1',
};

export function getProviderInfo(providerId: string): ExternalProviderInfo | undefined {
  return EXTERNAL_PROVIDERS.find(p => p.id === providerId);
}

export function getHipaaCompliantProviders(): ExternalProviderInfo[] {
  return EXTERNAL_PROVIDERS.filter(p => p.hipaaCompliant);
}
```


---

## 0.5 UTILITY FUNCTIONS

### packages/shared/src/utils/index.ts

```typescript
export * from './validation';
export * from './formatting';
```

### packages/shared/src/utils/validation.ts

```typescript
/**
 * RADIANT v2.2.0 - Validation Utilities
 */

export function isValidAppId(id: string): boolean {
  return /^[a-z][a-z0-9-]{2,30}$/.test(id);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidDomain(domain: string): boolean {
  return /^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(domain);
}

export function isValidAWSRegion(region: string): boolean {
  return /^[a-z]{2}-[a-z]+-\d$/.test(region);
}

export function isValidAWSAccountId(accountId: string): boolean {
  return /^\d{12}$/.test(accountId);
}

export function sanitizeAppId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

export function validateRequired<T>(value: T | undefined | null, fieldName: string): T {
  if (value === undefined || value === null) {
    throw new Error(\`\${fieldName} is required\`);
  }
  return value;
}
```

### packages/shared/src/utils/formatting.ts

```typescript
/**
 * RADIANT v2.2.0 - Formatting Utilities
 */

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return \`\${(tokens / 1_000_000).toFixed(1)}M\`;
  }
  if (tokens >= 1_000) {
    return \`\${(tokens / 1_000).toFixed(1)}K\`;
  }
  return tokens.toString();
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let value = bytes;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return \`\${value.toFixed(1)} \${units[unitIndex]}\`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return \`\${ms}ms\`;
  if (ms < 60000) return \`\${(ms / 1000).toFixed(1)}s\`;
  if (ms < 3600000) return \`\${Math.floor(ms / 60000)}m \${Math.floor((ms % 60000) / 1000)}s\`;
  return \`\${Math.floor(ms / 3600000)}h \${Math.floor((ms % 3600000) / 60000)}m\`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
```

### packages/shared/src/index.ts

```typescript
/**
 * RADIANT v2.2.0 - Shared Package Main Export
 * 
 * Usage in other packages:
 *   import { TierConfig, getTierConfig, formatCurrency } from '@radiant/shared';
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Utils
export * from './utils';
```

---

## 0.6 BUILD AND VERIFY

After implementing Section 0, build and verify:

```bash
cd packages/shared
pnpm install
pnpm build

# Verify the build output
ls -la dist/
```

Expected output structure:
```
dist/
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ index.js
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ index.d.ts
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ types/
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ index.js
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ index.d.ts
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ ...
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ constants/
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ index.js
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ index.d.ts
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ ...
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ utils/
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ index.js
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ index.d.ts
    Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ ...
```

# Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
# END OF SECTION 0
# Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â


