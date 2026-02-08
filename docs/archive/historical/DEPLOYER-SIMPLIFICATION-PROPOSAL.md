# RADIANT Deployer Simplification & Automation Proposal

**Version**: 7.0.0 (Proposed)  
**Date**: February 5, 2026  
**Status**: PROPOSAL - Awaiting Approval

---

## Executive Summary

Transform the Swift Deployer from a complex multi-screen configuration tool into a **streamlined, fully-automated deployment engine**. The goal: **One-click deployment** where the Deployer handles everything AWS requires automatically.

---

## Part 1: Current State Audit

### Current Navigation Tabs (22 total)

| Category | Tabs | Keep/Remove/Automate |
|----------|------|----------------------|
| **MAIN** | Dashboard, Apps, Deploy | ✅ KEEP (Core) |
| **OPERATIONS** | Instances, Snapshots, Packages, History | ✅ KEEP (Core) |
| **AI REGISTRY** | Providers, Models, Self-Hosted | 🔄 SIMPLIFY |
| **CONFIGURATION** | Domain URLs, Environment Domains, DNS Verification, Email, External Setup, Curator | ❌ AUTOMATE/REMOVE |
| **ADVANCED** | Multi-Region, A/B Testing, Cortex Memory | ❌ MOVE TO ADMIN DASHBOARD |
| **SECURITY** | Security, Compliance | ❌ MOVE TO ADMIN DASHBOARD |
| **SYSTEM** | Costs, Monitoring, Settings | 🔄 SIMPLIFY |

### Current View Files (35 total)

**ESSENTIAL (Keep - 12 files)**:
```
MainView_macOS.swift          - App shell
DashboardView.swift           - Status overview
DeployView.swift              - Deployment wizard
AppsView.swift                - Application management
InstancesView.swift           - Deployed instances
SnapshotsView.swift           - Backup management
PackagesView.swift            - Version management
HistoryView.swift             - Deployment history
SettingsView.swift            - App settings (simplified)
CredentialSetupView.swift     - AWS credentials (essential)
OnePasswordSetupView.swift    - 1Password integration
DeploymentProgressView.swift  - Progress tracking
```

**REMOVE (Automate or Move - 23 files)**:
```
DomainSetupView.swift         → Auto-configure
DomainURLConfigView.swift     → Auto-configure
EnvironmentDomainsView.swift  → Auto-configure
DNSVerificationView.swift     → Auto-verify in background
EmailSetupView.swift          → Auto-configure SES
ExternalSetupGuideView.swift  → Eliminate (auto-setup)
ProvidersView.swift           → Move to Admin Dashboard
ModelsView.swift              → Move to Admin Dashboard
SelfHostedModelsView.swift    → Move to Admin Dashboard
CuratorConfigView.swift       → Move to Admin Dashboard
MultiRegionView.swift         → Move to Admin Dashboard
ABTestingView.swift           → Move to Admin Dashboard
CortexMemoryView.swift        → Move to Admin Dashboard
SecurityView.swift            → Move to Admin Dashboard
ComplianceView.swift          → Move to Admin Dashboard
CostsView.swift               → Simplified in Dashboard
AWSMonitoringView.swift       → Move to Admin Dashboard
FeatureFlagsSettingsView.swift → Move to Admin Dashboard
SQLEditorView.swift           → Remove (dev tool)
ParameterEditorView.swift     → Inline in DeployView
FailureDetailsView.swift      → Modal in DeployView
PackageRegistrySettingsView.swift → Remove (auto)
AISettingsView.swift          → Remove (use defaults)
```

---

## Part 2: Simplified Deployer Architecture

### New Navigation Structure (8 tabs)

```
┌─────────────────────────────────────────────────────────────────┐
│  RADIANT Deployer v7.0 - Simplified                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SIDEBAR (Minimal)           MAIN CONTENT                       │
│  ┌──────────────────┐       ┌─────────────────────────────────┐ │
│  │ 🏠 Dashboard     │       │                                 │ │
│  │ 🚀 Deploy        │       │     Context-sensitive view      │ │
│  │ 📦 Packages      │       │                                 │ │
│  │ 🔄 Migrations    │◀──NEW │                                 │ │
│  │ 📸 Snapshots     │       │                                 │ │
│  │ 📜 History       │       │                                 │ │
│  │ 🔍 Drift Monitor │◀──NEW │                                 │ │
│  │ ⚙️ Settings      │       │                                 │ │
│  └──────────────────┘       └─────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### What Happens Automatically During Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTOMATED DEPLOYMENT FLOW                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User Provides:                                                  │
│  ├── AWS Credentials (via 1Password or local storage)           │
│  ├── Domain Name (e.g., thinktank.app)                         │
│  ├── Environment (dev/staging/prod)                             │
│  └── Tier Selection (Seed → Enterprise)                         │
│                                                                  │
│  Deployer Auto-Configures:                                       │
│  ├── ✅ Route53 Hosted Zone (creates if needed)                 │
│  ├── ✅ ACM SSL Certificates (requests + validates)              │
│  ├── ✅ DNS Records (A, CNAME, TXT for all subdomains)          │
│  ├── ✅ SES Domain Verification (TXT, DKIM CNAMEs)              │
│  ├── ✅ SES Sandbox Exit Request (auto-submits)                 │
│  ├── ✅ SNS SMS Configuration (if MFA enabled)                  │
│  ├── ✅ S3 Buckets (artifacts, uploads, backups, static)        │
│  ├── ✅ Secrets Manager (creates secrets, prompts for keys)     │
│  ├── ✅ CloudWatch Dashboards & Alarms                          │
│  ├── ✅ WAF Rules (for Starter+ tiers)                          │
│  ├── ✅ GuardDuty (for Starter+ tiers)                          │
│  └── ✅ All 14 CDK Stacks                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Migration Pipeline

### dev → staging → prod Migration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MIGRATION PIPELINE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│     DEVELOPMENT              STAGING                PRODUCTION   │
│  ┌──────────────┐        ┌──────────────┐       ┌──────────────┐│
│  │ dev.domain   │───────▶│staging.domain│──────▶│   domain     ││
│  │              │        │              │       │              ││
│  │ Latest code  │ Promote│ QA Testing   │Promote│ Live Traffic ││
│  │ Feature test │───────▶│ Integration  │──────▶│ Monitored    ││
│  └──────────────┘        └──────────────┘       └──────────────┘│
│         │                        │                      │       │
│         │                        │                      │       │
│         ▼                        ▼                      ▼       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    MIGRATION DASHBOARD                    │  │
│  │                                                           │  │
│  │  Package: radiant-7.0.0-stable                           │  │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐              │  │
│  │  │   DEV   │ →  │ STAGING │ →  │  PROD   │              │  │
│  │  │  v7.0.0 │    │  v6.6.1 │    │  v6.6.0 │              │  │
│  │  │ ✓ Ready │    │ Testing │    │ Current │              │  │
│  │  └─────────┘    └─────────┘    └─────────┘              │  │
│  │                                                           │  │
│  │  [Promote to Staging]  [Run Shadow Mode]  [Go Live]      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Shadow Mode (Canary Deployment)

```
┌─────────────────────────────────────────────────────────────────┐
│                       SHADOW MODE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Traffic Split during Shadow Mode:                               │
│                                                                  │
│  ┌─────────────┐                                                │
│  │   Incoming  │                                                │
│  │   Traffic   │                                                │
│  └──────┬──────┘                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                               │
│  │   Route53    │                                               │
│  │   Weighted   │                                               │
│  │   Routing    │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│    ┌────┴────┐                                                  │
│    │         │                                                  │
│    ▼         ▼                                                  │
│ ┌──────┐  ┌──────┐                                             │
│ │ 95%  │  │  5%  │   ◀── Configurable split                    │
│ │ OLD  │  │ NEW  │                                             │
│ │v6.6.0│  │v7.0.0│                                             │
│ └──────┘  └──────┘                                             │
│    │         │                                                  │
│    ▼         ▼                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │              COMPARISON DASHBOARD                         │   │
│ │                                                           │   │
│ │  Metric          Old (95%)    New (5%)     Diff          │   │
│ │  ─────────────   ──────────   ─────────   ──────         │   │
│ │  Error Rate      0.01%        0.02%       +0.01% ⚠️      │   │
│ │  Latency p99     245ms        198ms       -47ms ✓        │   │
│ │  Token Cost      $0.023       $0.019      -17% ✓         │   │
│ │  User Rating     4.8          4.9         +0.1 ✓         │   │
│ │                                                           │   │
│ │  [Increase to 25%]  [Rollback]  [Promote to 100%]        │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Shadow Mode Implementation

| Phase | Traffic Split | Duration | Criteria to Advance |
|-------|--------------|----------|---------------------|
| **Phase 1** | 5% new | 1 hour | Error rate < 0.1%, latency < 2x baseline |
| **Phase 2** | 25% new | 4 hours | Error rate < 0.05%, latency < 1.5x baseline |
| **Phase 3** | 50% new | 12 hours | Error rate < 0.02%, latency < 1.2x baseline |
| **Phase 4** | 100% new | - | Full promotion, old version standby |

---

## Part 4: Reverse Migration (Drift Detection)

### The Problem

Windsurf/Claude Opus can make direct changes to AWS infrastructure:
- Lambda code changes via AWS Console
- Parameter modifications in Secrets Manager
- Configuration tweaks in CloudWatch
- Database schema changes via direct SQL

These changes need to be:
1. **Detected** - Know when drift occurs
2. **Reviewed** - AI validates the changes make sense
3. **Adopted or Reverted** - Sync back to IaC or rollback

### Solution: GitOps-Style Drift Reconciliation

```
┌─────────────────────────────────────────────────────────────────┐
│              DRIFT DETECTION & RECONCILIATION                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │  DEPLOYER    │     │     AWS      │     │  AI REVIEW   │    │
│  │  (Desired    │     │  (Actual     │     │  (Claude/    │    │
│  │   State)     │     │   State)     │     │   GPT-4)     │    │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘    │
│         │                    │                    │             │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    DRIFT MONITOR                          │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │  Scheduled: Every 15 min via EventBridge            │ │  │
│  │  │  Trigger: CloudFormation events via EventBridge     │ │  │
│  │  │  Manual: Button in Deployer UI                      │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  Drift Detected:                                         │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │ Resource: Lambda/ThinktankAPI                     │   │  │
│  │  │ Property: Environment.FEATURE_FLAG_X              │   │  │
│  │  │ Expected: "false"                                 │   │  │
│  │  │ Actual:   "true"                                  │   │  │
│  │  │ Changed:  2 hours ago                             │   │  │
│  │  │ By:       arn:aws:iam::123:user/windsurf-agent   │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  │                                                           │  │
│  │  AI Analysis:                                            │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │ "This change enables Feature Flag X which was    │   │  │
│  │  │ requested in task #1234. The change appears      │   │  │
│  │  │ intentional and safe. Recommend: ADOPT"          │   │  │
│  │  │                                                   │   │  │
│  │  │ Risk Assessment: LOW                              │   │  │
│  │  │ Confidence: 94%                                   │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  │                                                           │  │
│  │  [Adopt Change]  [Revert to Desired]  [Ignore Once]      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Drift Detection Implementation

```typescript
// CDK Drift Detection Service
class DriftDetectionService {
  // Uses CDK's built-in drift detection
  async detectDrift(stackName: string): Promise<DriftResult> {
    // 1. Start drift detection
    const driftId = await this.cfn.detectStackDrift({ StackName: stackName });
    
    // 2. Wait for completion (EventBridge handles async)
    const status = await this.waitForDriftDetection(driftId);
    
    // 3. Get drifted resources
    const driftedResources = await this.cfn.describeStackResourceDrifts({
      StackName: stackName,
      StackResourceDriftStatusFilters: ['MODIFIED', 'DELETED']
    });
    
    return { status, driftedResources };
  }
  
  // AI reviews drift and recommends action
  async reviewDriftWithAI(drift: DriftResult): Promise<AIReview> {
    const prompt = `
      Review this infrastructure drift and recommend action:
      
      Resource: ${drift.resource}
      Expected: ${JSON.stringify(drift.expected)}
      Actual: ${JSON.stringify(drift.actual)}
      Changed by: ${drift.changedBy}
      
      Determine if this change should be:
      1. ADOPTED - Update IaC to match actual state
      2. REVERTED - Restore resource to expected state
      3. INVESTIGATED - Unclear, needs human review
    `;
    
    return await this.aiService.analyze(prompt);
  }
}
```

### Sync Back to Deployer (GitOps Pattern)

```
┌─────────────────────────────────────────────────────────────────┐
│               DRIFT ADOPTION WORKFLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Drift Detected                                               │
│     └─▶ Lambda environment variable changed                      │
│                                                                  │
│  2. AI Reviews                                                   │
│     └─▶ "Safe change, recommend ADOPT"                          │
│                                                                  │
│  3. User Approves "Adopt"                                        │
│     └─▶ Deployer updates local package state                    │
│                                                                  │
│  4. Generates Patch                                              │
│     └─▶ Creates migration record:                               │
│         {                                                        │
│           "type": "drift_adoption",                              │
│           "resource": "Lambda/ThinktankAPI",                    │
│           "property": "Environment.FEATURE_FLAG_X",             │
│           "newValue": "true",                                   │
│           "adoptedAt": "2026-02-05T14:30:00Z",                 │
│           "aiReview": { ... }                                   │
│         }                                                        │
│                                                                  │
│  5. Updates CDK Code (Optional)                                  │
│     └─▶ Generates PR to CDK repo:                               │
│         - infrastructure/lib/stacks/api-stack.ts               │
│         - +  FEATURE_FLAG_X: 'true',                            │
│                                                                  │
│  6. Next Deployment                                              │
│     └─▶ Includes adopted changes, no drift on next deploy       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 5: API Keys - The One Manual Step

The **only** thing that truly requires user input is API keys for AI providers. Everything else can be automated.

### Simplified Key Entry Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT WIZARD                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1 of 4: AWS Credentials                    [✓ Complete]   │
│  Step 2 of 4: Domain & Environment               [✓ Complete]   │
│  Step 3 of 4: AI Provider Keys                   [▶ Current]    │
│  Step 4 of 4: Deploy                             [  Pending]    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AI Provider API Keys                                     │  │
│  │                                                           │  │
│  │  These keys are stored in AWS Secrets Manager.           │  │
│  │  Get your keys from:                                      │  │
│  │                                                           │  │
│  │  OpenAI          [sk-...                    ] [🔗 Get Key]│  │
│  │  (Required)      ✓ Valid                                  │  │
│  │                                                           │  │
│  │  Anthropic       [sk-ant-...               ] [🔗 Get Key]│  │
│  │  (Required)      ✓ Valid                                  │  │
│  │                                                           │  │
│  │  Google AI       [AI...                    ] [🔗 Get Key]│  │
│  │  (Optional)      ○ Not provided                           │  │
│  │                                                           │  │
│  │  ───────────────────────────────────────────────────────  │  │
│  │  💡 Keys are validated before deployment starts           │  │
│  │                                                           │  │
│  │                              [Back]  [Continue to Deploy] │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Implementation Plan

### Phase 1: Remove/Migrate Views (1 week)

| Action | Views | Target |
|--------|-------|--------|
| Delete | ExternalSetupGuideView, DNSVerificationView, DomainSetupView, DomainURLConfigView, EnvironmentDomainsView, EmailSetupView | - |
| Migrate to Admin Dashboard | ProvidersView, ModelsView, SelfHostedModelsView, CuratorConfigView, MultiRegionView, ABTestingView, CortexMemoryView, SecurityView, ComplianceView, AWSMonitoringView | Admin Dashboard |
| Simplify | SettingsView, CostsView | Remove advanced options |

### Phase 2: Automated AWS Setup (1 week)

| Service | Automation |
|---------|------------|
| Route53 | Auto-create hosted zone if domain uses Route53 |
| ACM | Auto-request certificate, auto-add validation records |
| SES | Auto-verify domain, auto-add DKIM, auto-request production |
| SNS | Auto-configure SMS settings |
| S3 | Already automated |
| Secrets Manager | Auto-create, prompt for values |

### Phase 3: Migration Pipeline (2 weeks)

| Feature | Implementation |
|---------|---------------|
| Migration Dashboard | New view showing env progression |
| Shadow Mode | Route53 weighted routing + comparison metrics |
| Promotion Gates | Configurable criteria for auto-promotion |
| Rollback | One-click with confirmation |

### Phase 4: Drift Detection (2 weeks)

| Feature | Implementation |
|---------|---------------|
| Scheduled Detection | EventBridge + Lambda every 15 min |
| Event-Driven Detection | EventBridge CloudFormation events |
| AI Review | Claude/GPT-4 analyzes changes |
| Adoption Workflow | Update local state + optional CDK PR |

---

## Part 7: New Deployer File Structure

```
apps/swift-deployer/Sources/RadiantDeployer/
├── Views/
│   ├── MainView_macOS.swift           # Simplified shell
│   ├── DashboardView.swift            # Status overview
│   ├── DeployView.swift               # Unified deployment wizard
│   ├── MigrationsView.swift           # NEW: Migration pipeline
│   ├── PackagesView.swift             # Version management
│   ├── SnapshotsView.swift            # Backup management
│   ├── HistoryView.swift              # Deployment history
│   ├── DriftMonitorView.swift         # NEW: Drift detection
│   ├── SettingsView.swift             # Simplified settings
│   └── Onboarding/
│       ├── CredentialSetupView.swift  # AWS credentials
│       └── APIKeysView.swift          # AI provider keys
├── Services/
│   ├── AutoSetupService.swift         # NEW: Automated AWS setup
│   ├── MigrationService.swift         # NEW: Env migrations
│   ├── ShadowModeService.swift        # NEW: Canary deployments
│   ├── DriftDetectionService.swift    # NEW: Drift monitoring
│   └── DriftReconciliationService.swift # NEW: AI review + adopt
└── Models/
    ├── Migration.swift                # NEW: Migration state
    ├── DriftResult.swift              # NEW: Drift detection results
    └── ShadowMetrics.swift            # NEW: Comparison metrics
```

---

## Part 8: Decision Points for User

### Question 1: View Removal Scope

**Option A**: Remove views but keep code (can be restored)
**Option B**: Delete view files entirely
**Option C**: Move to separate "Advanced" app

### Question 2: Migration Pipeline Complexity

**Option A**: Simple manual promotion (dev → staging → prod)
**Option B**: Automated promotion with configurable gates
**Option C**: Full canary with AI-driven promotion decisions

### Question 3: Drift Detection Frequency

**Option A**: On-demand only (user clicks button)
**Option B**: Scheduled (every 15/30/60 minutes)
**Option C**: Event-driven (real-time CloudFormation events)

### Question 4: Drift Adoption

**Option A**: Manual review only (show diff, user decides)
**Option B**: AI-assisted (AI recommends, user approves)
**Option C**: AI-automated (AI adopts safe changes, flags risky ones)

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Navigation Tabs | 22 | 8 |
| View Files | 35 | ~15 |
| Manual Setup Steps | 10+ | 1 (API keys) |
| Migration Support | None | Full pipeline |
| Drift Detection | None | AI-powered |
| Time to Deploy | 30-60 min | 5-10 min |

**The Deployer becomes what it should be**: a deployment tool, not a configuration portal. All configuration lives in the Admin Dashboard where it belongs.

---

*Awaiting approval to proceed with implementation.*
