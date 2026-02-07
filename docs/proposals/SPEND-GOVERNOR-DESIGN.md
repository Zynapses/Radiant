# Spend Governor — Design Document

> **Version**: v7.39.0 | **Status**: PROPOSAL — Awaiting approval  
> **Depends on**: v7.38.0 System Admin Separation, v7.37.0 Drift Enforcement  
> **Author**: AI Build Agent + Robert Long

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Architecture — Two-Layer Spend Control](#2-architecture--two-layer-spend-control)
3. [Layer 1: Global Instance Budget (AWS Budgets)](#3-layer-1-global-instance-budget-aws-budgets)
4. [Layer 2: Per-Tenant AI Spend Governor](#4-layer-2-per-tenant-ai-spend-governor)
5. [Model Suspension Flow — Step by Step](#5-model-suspension-flow--step-by-step)
6. [Model Restoration Flow — Step by Step](#6-model-restoration-flow--step-by-step)
7. [Self-Hosted Model Controls](#7-self-hosted-model-controls)
8. [What the User Never Sees](#8-what-the-user-never-sees)
9. [Deployment Wizard Integration](#9-deployment-wizard-integration)
10. [Admin UI — Spend Governor Dashboard](#10-admin-ui--spend-governor-dashboard)
11. [What Already Exists vs What Needs to Be Built](#11-what-already-exists-vs-what-needs-to-be-built)
12. [Implementation Plan](#12-implementation-plan)

---

## 1. Problem Statement

A rogue service, misconfigured orchestration loop, or unexpectedly popular tenant can burn through AI API credits in minutes. External model providers (OpenAI, Anthropic, etc.) bill per-token with no hard caps. Self-hosted models on SageMaker burn compute per-second whether or not requests are flowing. AWS itself has no "stop everything at $X" switch.

**Requirements**:
- Hard spend limits at two levels: global (entire AWS instance) and per-tenant (AI model usage)
- Alerts to super admins at 90% of budget
- Automatic model suspension at 100% — no user ever sees "out of credits"
- Users see "Service temporarily unavailable" — zero mention of budget/credits
- Detailed error logs explaining exactly when and why each model was suspended
- Super admins can restore suspended models from the Admin UI
- Swift Deployer can set, increase, and reset budgets
- Self-hosted models must be controlled too (SageMaker endpoints)

---

## 2. Architecture — Two-Layer Spend Control

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 1: AWS BUDGETS                          │
│               Global Instance Budget ($X / month)                │
│                                                                  │
│  AWS Budgets API → SNS Topic → Lambda → SENTINEL alert           │
│                                                                  │
│  Tracks: ALL AWS spend (compute, storage, data transfer,         │
│          Bedrock, SageMaker, Lambda, Aurora, S3, etc.)            │
│                                                                  │
│  Thresholds: 80% → info alert                                    │
│              90% → warning alert to super admins                 │
│              95% → critical alert + throttle new resource creation│
│             100% → critical alert + deploy IAM deny policy        │
│                                                                  │
│  Set by: Swift Deployer (during install) or CLI                  │
│  Adjusted by: Super admin (Admin UI) or Deployer (update)        │
│  Recovery: Deployer increases budget → IAM deny removed           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  LAYER 2: SPEND GOVERNOR                         │
│          Per-Tenant AI Budget ($X / Y days)                      │
│                                                                  │
│  Model Router pre-invocation gate → check spend vs budget        │
│                                                                  │
│  Tracks: AI model invocation costs (external API + self-hosted)  │
│          Uses existing cost_events table + cost_budgets table     │
│                                                                  │
│  Thresholds: 90% → SENTINEL alert to super admins + tenant admin │
│             100% → model quarantined with reason 'spend_limit'   │
│                    + SENTINEL critical alert                     │
│                    + structured error log                        │
│                                                                  │
│  Set by: Super admin (per-tenant in Admin UI)                    │
│  Defaults: Set in Deployment Wizard                              │
│  Recovery: Super admin increases budget OR overrides suspension   │
└─────────────────────────────────────────────────────────────────┘
```

**Why two layers**: Layer 1 catches runaway AWS infrastructure costs (someone spins up a massive Aurora cluster, SageMaker endpoint left running, etc.). Layer 2 catches runaway AI model costs specifically (infinite loop calling GPT-4, tenant abuse, orchestration bug). They operate independently — either can trigger without the other.

---

## 3. Layer 1: Global Instance Budget (AWS Budgets)

### What AWS Budgets Actually Does

AWS Budgets is an AWS-native service that:
- Tracks actual spend across all AWS services in the account
- Updates spend data **3x/day** (every ~8 hours) — not real-time
- Triggers SNS notifications at configurable thresholds
- Can execute **Budget Actions**: apply IAM policies, SCPs, or stop EC2 instances

### What AWS Budgets Does NOT Do

- **Does NOT hard-stop running services**. Lambda continues executing. Aurora continues running. API Gateway continues serving.
- Does NOT provide real-time data — there's an 8-24 hour delay on cost data
- Does NOT automatically tear down infrastructure

### Our Integration

```
Swift Deployer                AWS                          RADIANT
     │                         │                              │
     ├─ Budgets.CreateBudget ──►│                              │
     │  {                       │                              │
     │    Amount: $5000/month   │                              │
     │    Thresholds: [         │                              │
     │      80% → SNS,          │                              │
     │      90% → SNS,          │                              │
     │      95% → SNS+Action,   │                              │
     │      100% → SNS+Action   │                              │
     │    ]                     │                              │
     │  }                       │                              │
     │                          │                              │
     │  (When 90% reached)      │                              │
     │                          ├─ SNS publish ───────────────►│
     │                          │  {threshold: 90%}            │
     │                          │                    spend-governor-lambda
     │                          │                      │
     │                          │                      ├─ SENTINEL alert
     │                          │                      │  sev: WARNING
     │                          │                      │  to: all super_admins
     │                          │                      │
     │  (When 100% reached)     │                              │
     │                          ├─ Budget Action: apply ───────►│
     │                          │  IAM deny policy              │
     │                          │  (blocks new resource         │
     │                          │   creation only —             │
     │                          │   existing resources          │
     │                          │   keep running)               │
     │                          │                              │
     │                          ├─ SNS publish ───────────────►│
     │                          │  {threshold: 100%}           │
     │                          │                    spend-governor-lambda
     │                          │                      │
     │                          │                      ├─ SENTINEL alert
     │                          │                      │  sev: CRITICAL
     │                          │                      │  to: all super_admins
     │                          │                      │  msg: "Instance budget
     │                          │                      │        exceeded. New
     │                          │                      │        resource creation
     │                          │                      │        blocked."
```

### What Happens When the Global Budget Is Exceeded

AWS does NOT shut anything down. Here's exactly what happens:

| What | Continues? | Why |
|------|-----------|-----|
| Lambda functions | ✅ Yes | Budget actions can't stop Lambda |
| Aurora database | ✅ Yes | Budget actions can't stop RDS |
| API Gateway | ✅ Yes | Budget actions can't stop APIGW |
| SageMaker endpoints | ✅ Yes | Budget actions can't stop existing endpoints |
| CloudFront | ✅ Yes | Budget actions can't stop distributions |
| New EC2 instances | ❌ Blocked | IAM deny policy prevents `ec2:RunInstances` |
| New SageMaker endpoints | ❌ Blocked | IAM deny policy prevents creation |
| New S3 buckets | ❌ Blocked | IAM deny policy prevents creation |

**This is why Layer 2 exists.** Layer 1 is awareness + prevention of new resource creation. Layer 2 is the actual kill switch for AI model spending.

### Recovery from Global Budget Breach

1. Super admin receives SENTINEL alert
2. Super admin opens Admin UI → Platform → Spend Governor → Global Budget
3. Super admin clicks "Increase Budget" → enters new amount
4. Lambda calls `Budgets.UpdateBudget()` → updates the threshold
5. Lambda calls `IAM.DeleteRolePolicy()` → removes the deny policy
6. New resource creation is unblocked

OR:

1. Deployer operator runs update deployment with higher budget
2. CDK updates the AWS Budget resource
3. Same effect — deny policy removed, budget increased

---

## 4. Layer 2: Per-Tenant AI Spend Governor

This is the layer that actually protects against runaway AI costs. It operates at the **model router level** — the single chokepoint through which all 52+ services make model invocations.

### How It Works: Pre-Invocation Gate

The model router (`model-router.service.ts`) already has:
1. Drift-aware selection (v7.37.0)
2. Inference cache check (v7.11.0)
3. Provider rate limiting

We add a **spend gate** as the FIRST check, before any of these:

```typescript
// model-router.service.ts — invoke() method

async invoke(request: ModelRequest): Promise<ModelResponse> {
    // ═══════════════════════════════════════════════════════════
    // SPEND GOVERNOR GATE (v7.39.0)
    // MUST run BEFORE drift check, cache check, or any provider call.
    // If tenant has exceeded their AI budget, block the invocation
    // immediately. The user sees "Service temporarily unavailable."
    // ═══════════════════════════════════════════════════════════
    if (request.tenantId) {
        const spendCheck = await spendGovernorService.checkBudget(
            request.tenantId,
            request.modelId,
        );
        
        if (spendCheck.blocked) {
            // Model is spend-suspended. Do NOT proceed.
            // The suspension was already logged when it was triggered.
            throw new SpendLimitExceededError(
                request.tenantId,
                request.modelId,
                spendCheck.reason,
            );
        }
        
        if (spendCheck.warning) {
            // Near limit — already alerted, but log for correlation
            logger.warn('Spend governor warning: approaching budget limit', {
                tenantId: request.tenantId,
                modelId: request.modelId,
                percentUsed: spendCheck.percentUsed,
                budgetCents: spendCheck.budgetCents,
                spentCents: spendCheck.spentCents,
            });
        }
    }
    
    // ... existing drift check, cache check, provider call ...
}
```

### SpendLimitExceededError

This is a typed error that the API layer catches and translates to a user-friendly message:

```typescript
class SpendLimitExceededError extends Error {
    readonly code = 'SPEND_LIMIT_EXCEEDED';
    readonly httpStatus = 503; // Service Unavailable
    readonly userMessage = 'Service temporarily unavailable. Please try again later.';
    
    constructor(
        public readonly tenantId: string,
        public readonly modelId: string,
        public readonly internalReason: string,
    ) {
        super(`Spend limit exceeded for tenant ${tenantId}, model ${modelId}: ${internalReason}`);
    }
}
```

The API handler catches this and returns:
```json
{
    "error": "Service temporarily unavailable. Please try again later.",
    "code": "SERVICE_UNAVAILABLE",
    "retryAfter": 3600
}
```

**No mention of budget, credits, spend, or limits.** The user sees a generic service unavailable message.

### Spend Governor Service

The `SpendGovernorService` is a new service that:
1. Checks tenant budget on every invocation (fast — in-memory cache with 60s TTL)
2. Runs a background check every 5 minutes (EventBridge) for batch operations
3. Triggers SENTINEL alerts at thresholds
4. Quarantines models when budget is exceeded
5. Logs detailed suspension reasons

```typescript
interface SpendCheckResult {
    blocked: boolean;
    warning: boolean;
    percentUsed: number;
    budgetCents: number;
    spentCents: number;
    reason: string;
}

interface SpendBudgetConfig {
    tenantId: string;
    budgetCents: number;           // Total budget in cents
    periodDays: number;            // Budget period (e.g., 30 days)
    warningThreshold: number;      // 0.90 = 90%
    suspendThreshold: number;      // 1.00 = 100%
    perModelLimitCents: number;    // Optional per-model cap (0 = no limit)
    isEnabled: boolean;
    createdBy: string;             // super_admin ID or 'system'
}
```

### In-Memory Cache for Performance

Every model invocation cannot query the database. The spend governor uses an in-memory cache:

```
┌──────────────────────────────────────────────────┐
│  In-Memory Spend Cache (per Lambda instance)     │
│                                                   │
│  Key: tenantId                                    │
│  Value: {                                         │
│    budgetCents: 500000,     // $5,000              │
│    spentCents: 423000,      // $4,230              │
│    percentUsed: 0.846,                             │
│    lastRefreshed: <timestamp>,                     │
│    ttl: 60 seconds                                 │
│  }                                                │
│                                                   │
│  Cache miss → query cost_events + cost_budgets    │
│  Cache expired (>60s) → background refresh         │
│  Cache hit → immediate return (sub-ms)             │
└──────────────────────────────────────────────────┘
```

The 60-second TTL means spend data is at most 60 seconds stale. In a worst case, a tenant could overshoot their budget by (60 seconds × max request rate × cost per request). For a tenant doing 10 req/s at $0.02/req, that's $12 of overshoot — acceptable.

---

## 5. Model Suspension Flow — Step by Step

Here's exactly what happens when a tenant hits their AI budget:

### Phase 1: Warning at 90%

```
EventBridge (every 5 min) → spend-governor-monitor Lambda
    │
    ├─ For each tenant with AI budget enabled:
    │   ├─ Query: SELECT SUM(cost_cents) FROM cost_events
    │   │         WHERE tenant_id = $1
    │   │         AND created_at >= NOW() - (budget_period_days || ' days')::interval
    │   │
    │   ├─ Compare against budget_cents × warning_threshold
    │   │
    │   └─ If percentUsed >= 0.90 AND no warning sent in last 24h:
    │       │
    │       ├─ SENTINEL alert (severity: WARNING)
    │       │  to: all super_admins (global) + tenant admin (scoped)
    │       │  title: "AI Spend Warning: Tenant {name} at 90% of budget"
    │       │  body: "Tenant {name} has spent $4,500 of their $5,000
    │       │         AI budget (30-day rolling). Top models by cost:
    │       │         1. openai/gpt-4o — $2,100
    │       │         2. anthropic/claude-3-5-sonnet — $1,800
    │       │         3. together/llama-405b — $600"
    │       │
    │       └─ Log: spend_governor_audit
    │          action: 'warning_sent'
    │          tenant_id, percent_used, budget_cents, spent_cents
```

### Phase 2: Suspension at 100%

```
Two triggers — whichever fires first:

Trigger A: EventBridge monitor (batch, every 5 min)
Trigger B: Model router inline check (real-time, per-request)

When budget exceeded:
    │
    ├─ 1. Quarantine ALL models for this tenant
    │      For each model with spend in the budget period:
    │        driftCorrectionService.quarantineModel(
    │          tenantId, modelId,
    │          reason: 'spend_limit:budget_exceeded',
    │          durationHours: 0,  // No auto-release — manual only
    │          performedBy: 'system:spend-governor'
    │        )
    │
    │      This sets in model_weight_config:
    │        is_quarantined = true
    │        quarantined_at = NOW()
    │        quarantine_reason = 'spend_limit:budget_exceeded'
    │        quarantine_expires_at = NULL (no auto-release)
    │        quarantine_auto_release = false
    │
    ├─ 2. Write detailed suspension log
    │      INSERT INTO spend_governor_audit (
    │        tenant_id, action, model_id, budget_cents, spent_cents,
    │        percent_used, reason, suspended_models, performed_by
    │      ) VALUES (
    │        $1, 'models_suspended', NULL, 500000, 502340,
    │        1.0047, 'Tenant AI budget exceeded: $5,023.40 / $5,000.00 (30-day)',
    │        '["openai/gpt-4o", "anthropic/claude-3-5-sonnet", ...]',
    │        'system:spend-governor'
    │      )
    │
    ├─ 3. SENTINEL alert (severity: CRITICAL)
    │      to: all super_admins (global) + tenant admin (scoped)
    │      title: "AI Models SUSPENDED: Tenant {name} budget exceeded"
    │      body: "Tenant {name} has exceeded their AI budget.
    │             Budget: $5,000.00 (30-day rolling)
    │             Spent:  $5,023.40 (100.47%)
    │             
    │             ALL AI models have been suspended for this tenant.
    │             Users will see 'Service temporarily unavailable.'
    │             
    │             Suspended models:
    │             - openai/gpt-4o (cost: $2,100)
    │             - anthropic/claude-3-5-sonnet (cost: $1,800)
    │             - together/llama-405b (cost: $600)
    │             - [3 more]
    │             
    │             To restore: Admin UI → Platform → Spend Governor
    │             → Select tenant → Increase Budget or Override"
    │
    └─ 4. Invalidate in-memory cache
           Force all Lambda instances to re-check budget on next request
           (set cache entry to blocked=true immediately)
```

### What the Error Log Contains

Every suspension creates a structured log entry:

```json
{
    "level": "error",
    "service": "spend-governor",
    "action": "model_suspended",
    "tenantId": "uuid-tenant-123",
    "tenantName": "Acme Corp",
    "modelId": "openai/gpt-4o",
    "suspendedAt": "2026-02-07T17:42:31.000Z",
    "reason": "spend_limit:budget_exceeded",
    "details": {
        "budgetCents": 500000,
        "spentCents": 502340,
        "percentUsed": 1.0047,
        "periodDays": 30,
        "periodStart": "2026-01-08T17:42:31.000Z",
        "topCostModels": [
            { "modelId": "openai/gpt-4o", "costCents": 210000 },
            { "modelId": "anthropic/claude-3-5-sonnet", "costCents": 180000 }
        ],
        "totalSuspendedModels": 6,
        "performedBy": "system:spend-governor"
    },
    "resolution": "Super admin must increase budget or override suspension via Admin UI → Platform → Spend Governor"
}
```

---

## 6. Model Restoration Flow — Step by Step

### Option A: Increase Budget (Recommended)

```
Super admin opens Admin UI
    │
    ├─ Platform → Spend Governor → Tenant: "Acme Corp"
    │
    │  ┌──────────────────────────────────────────────────┐
    │  │  Acme Corp — AI Spend Governor                    │
    │  │                                                    │
    │  │  Status: ⛔ BUDGET EXCEEDED                        │
    │  │  Budget: $5,000.00 / 30 days                      │
    │  │  Spent:  $5,023.40 (100.5%)                       │
    │  │  ████████████████████████████░░ 100.5%             │
    │  │                                                    │
    │  │  Suspended Models (6):                             │
    │  │  ⛔ openai/gpt-4o         — $2,100                │
    │  │  ⛔ anthropic/claude-3.5   — $1,800                │
    │  │  ⛔ together/llama-405b    — $600                  │
    │  │  ⛔ google/gemini-1.5-pro  — $300                  │
    │  │  ⛔ mistral/mistral-large  — $150                  │
    │  │  ⛔ groq/llama-70b         — $73                   │
    │  │                                                    │
    │  │  [Increase Budget]  [Override Suspension]          │
    │  └──────────────────────────────────────────────────┘
    │
    ├─ Clicks "Increase Budget"
    │  Dialog: "New budget: [$7,500.00] for [30] days"
    │  [Cancel] [Apply]
    │
    ├─ POST /admin/spend-governor/tenant/{id}/budget
    │  Body: { budgetCents: 750000, periodDays: 30 }
    │  Auth: Pool B token (requires super_admin or admin role)
    │
    │  Lambda:
    │  ├─ Update cost_budgets row
    │  ├─ Recalculate: $5,023.40 / $7,500.00 = 66.9% → under threshold
    │  ├─ Unquarantine ALL spend-suspended models for this tenant:
    │  │    driftCorrectionService.unquarantineModel(tenantId, modelId)
    │  │    ONLY for models where quarantine_reason LIKE 'spend_limit:%'
    │  │    (drift-quarantined models stay quarantined)
    │  ├─ Audit log: action = 'budget_increased', performed_by = super_admin
    │  ├─ Audit log: action = 'models_restored', suspended_models = [...]
    │  └─ Invalidate spend cache
    │
    └─ All models immediately available for this tenant
```

### Option B: Override Suspension (Temporary)

For when you need models running NOW but don't want to permanently increase budget.

```
Super admin clicks "Override Suspension"
    │
    │  Dialog: "Override duration: [4] hours
    │           ⚠ Models will be re-suspended when override expires
    │              or budget is exceeded again."
    │  [Cancel] [Override]
    │
    ├─ POST /admin/spend-governor/tenant/{id}/override
    │  Body: { durationHours: 4 }
    │  Auth: Pool B token (requires super_admin only — admin cannot override)
    │
    │  Lambda:
    │  ├─ Create spend_governor_override row:
    │  │    tenant_id, granted_by, expires_at, reason
    │  ├─ Unquarantine all spend-suspended models
    │  ├─ Set override in cache: { overrideExpiresAt: <4h from now> }
    │  ├─ Audit log: action = 'override_granted', duration_hours = 4
    │  └─ SENTINEL info alert: "Spend override granted for Acme Corp (4h)"
    │
    └─ Models available for 4 hours, then re-evaluated
```

### Option C: Deployer Resets Budget

```
Deployer operator runs: radiant admin set-budget \
    --tenant "Acme Corp" \
    --amount 10000 \
    --period 30

OR: Swift Deployer UI → Manage Instance → Spend Limits → Update

Same API call as Option A.
```

---

## 7. Self-Hosted Model Controls

Self-hosted models (SageMaker endpoints, EC2 GPU instances) are special because they burn money whether or not requests are flowing.

### Monitoring

The spend governor tracks self-hosted costs separately:

```
┌──────────────────────────────────────────────────┐
│  Self-Hosted Cost Sources                         │
│                                                   │
│  SageMaker endpoints:                             │
│    - Billed per-second of uptime                  │
│    - p4d.24xlarge = $32.77/hour                   │
│    - Tracked via CloudWatch + CostExplorer API    │
│                                                   │
│  EC2 GPU instances (if any):                      │
│    - Billed per-second of uptime                  │
│    - Tracked via EC2 DescribeInstances + pricing  │
│                                                   │
│  Per-invocation cost (self-hosted):               │
│    - Tracked in cost_events like external models  │
│    - Uses selfHostedMarkup (default 1.75x)        │
└──────────────────────────────────────────────────┘
```

### Suspension of Self-Hosted Models

When a self-hosted model is spend-suspended:

1. **Model router refuses to route** — same as external models (quarantine gate)
2. **SageMaker endpoint scaled to zero** — if the endpoint supports auto-scaling, set `MinCapacity = 0` and `DesiredCapacity = 0`. The endpoint enters a cold state with no inference cost.
3. **If cannot scale to zero** — endpoint is deleted. Re-creation is automated on restoration.
4. **Audit log** documents: endpoint ARN, previous capacity, action taken, estimated hourly savings

### Restoration of Self-Hosted Models

When budget is increased or override granted:
1. Unquarantine in model router (immediate — external model invocations resume)
2. Scale SageMaker endpoint back up (takes 5-10 minutes for cold start)
3. Admin UI shows "Restoring self-hosted models... ETA: ~8 minutes"

---

## 8. What the User Never Sees

| Internal state | What user sees | Where the truth lives |
|---------------|---------------|----------------------|
| Model spend-suspended | "Service temporarily unavailable. Please try again later." | `spend_governor_audit` table |
| Tenant over budget | Same as above | SENTINEL alert to super_admins |
| SageMaker endpoint scaling down | Request takes longer, then "Service temporarily unavailable" | `spend_governor_audit` + CloudWatch |
| Budget warning at 90% | Nothing — user experience unchanged | SENTINEL alert to admins only |
| Budget override active | Normal service — user unaware | `spend_governor_overrides` table |

**Iron rule**: The strings "budget", "credit", "spend", "limit", "quota", and "cost" NEVER appear in any user-facing error message, toast, or UI element.

---

## 9. Deployment Wizard Integration

### Swift Deployer — New Fields in Installation Parameters

```swift
// InstallationParameters.swift — NEW FIELDS

// Spend Governor (v7.39.0)
var globalBudgetUsd: Int               // AWS instance budget ($/month). Default: tier-based
var defaultTenantAiBudgetUsd: Int      // Default per-tenant AI budget ($/period)
var defaultTenantAiBudgetPeriodDays: Int // Budget period. Default: 30
var spendWarningThreshold: Double      // Default: 0.90
var spendSuspendThreshold: Double      // Default: 1.00
```

### Tier-Based Defaults

| Tier | Global Budget | Default Tenant AI Budget | Period |
|------|--------------|------------------------|--------|
| SEED | $200/mo | $50 / 30 days | 30 |
| STARTER | $500/mo | $200 / 30 days | 30 |
| GROWTH | $3,000/mo | $1,000 / 30 days | 30 |
| SCALE | $10,000/mo | $5,000 / 30 days | 30 |
| ENTERPRISE | $50,000/mo | $25,000 / 30 days | 30 |

### What Deployer Creates During Install

1. **AWS Budget** via `Budgets.CreateBudget()` — with 4 threshold notifications
2. **SNS Topic** for budget alerts — subscribed to spend governor Lambda
3. **Budget Action** — IAM deny policy at 100% threshold
4. **Default tenant budget row** in `cost_budgets` table — applied to all new tenants

---

## 10. Admin UI — Spend Governor Dashboard

### System Admin View (Super Admin Only)

```
┌────────────────────────────────────────────────────────────┐
│  Platform → Spend Governor                                  │
│                                                             │
│  ┌── Global Instance Budget ─────────────────────────────┐ │
│  │  Budget: $10,000/month    Spent: $6,234 (62.3%)       │ │
│  │  ██████████████████████░░░░░░░░░░ 62.3%               │ │
│  │  [Increase Budget] [View AWS Cost Explorer]           │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌── Tenant AI Budgets ──────────────────────────────────┐ │
│  │                                                        │ │
│  │  Tenant          Budget    Spent    Status    Actions  │ │
│  │  ─────────────   ──────    ─────    ──────    ──────── │ │
│  │  Acme Corp       $5,000    $5,023   ⛔ OVER   [Manage] │ │
│  │  Beta Inc        $1,000    $890     ⚠ 89%    [Manage] │ │
│  │  Gamma LLC       $2,000    $423     ✅ 21%    [Manage] │ │
│  │  Delta Corp      $500      $12      ✅ 2%     [Manage] │ │
│  │                                                        │ │
│  │  [Set Default Budget] [Export Report]                  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌── Suspension Log ─────────────────────────────────────┐ │
│  │                                                        │ │
│  │  Feb 7, 17:42  Acme Corp  6 models suspended           │ │
│  │                Budget exceeded: $5,023 / $5,000         │ │
│  │                [View Details] [Restore]                 │ │
│  │                                                        │ │
│  │  Feb 5, 09:15  Beta Inc   WARNING at 90%               │ │
│  │                $900 / $1,000                            │ │
│  │                [View Details]                           │ │
│  └───────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

---

## 11. What Already Exists vs What Needs to Be Built

### Already Exists

| Component | Location | Relevance |
|-----------|----------|-----------|
| `CostTrackingService` | `cato/cost-tracking.service.ts` | Tracks all model costs per tenant. Has `getDailyCost()`, `getMtdCost()`, `getBudget()`, `setBudgetLimits()` |
| `cost_events` table | Database | Per-invocation cost records with tenant_id, model_id, cost_cents |
| `cost_budgets` table | Database | Tenant budget limits (daily + monthly) |
| `consciousness/budget-monitor.ts` | Lambda | Pattern for budget monitoring — runs on EventBridge, checks tenants, disables over-limit |
| `driftCorrectionService.quarantineModel()` | `drift-correction.service.ts` | Quarantine mechanism with reason, duration, audit log |
| `driftCorrectionService.unquarantineModel()` | Same | Restoration with audit log |
| Model router `invoke()` | `model-router.service.ts` | Single chokepoint for all AI invocations — where the gate goes |
| Admin model weights UI | `admin/model-weights.ts` | Quarantine/unquarantine endpoints already exposed |
| SENTINEL dual-resolution | `sentinel-notifier.service.ts` | Alert routing to super_admins (global) + tenant admins (scoped) |

### Needs to Be Built

| Component | Location | Description |
|-----------|----------|-------------|
| **`SpendGovernorService`** | `lambda/shared/services/spend-governor.service.ts` | Core service: budget check, suspension, restoration, override, cache |
| **`SpendLimitExceededError`** | `lambda/shared/errors/spend-limit.error.ts` | Typed error with user-safe message |
| **Spend gate in model router** | `model-router.service.ts` (line ~404) | Pre-invocation budget check |
| **`spend_governor_audit` table** | New migration | Detailed suspension/restoration/override log |
| **`spend_governor_overrides` table** | Same migration | Temporary override tracking |
| **Spend governor monitor Lambda** | `lambda/admin/spend-governor-monitor.ts` | EventBridge: 5-min batch check for all tenants |
| **SNS → Lambda for AWS Budgets** | `lambda/admin/budget-alert-handler.ts` | Receives AWS Budget SNS alerts, creates SENTINEL alerts |
| **CDK: AWS Budget resource** | `admin-stack.ts` | Budget + SNS topic + Budget Action + IAM deny policy |
| **CDK: EventBridge rule** | `admin-stack.ts` | 5-min schedule for spend governor monitor |
| **Swift: Budget fields** | `InstallationParameters.swift` | `globalBudgetUsd`, `defaultTenantAiBudgetUsd`, etc. |
| **Swift: Create AWS Budget** | `DeploymentService.swift` | Call Budgets API during install |
| **Admin UI: Spend Governor page** | `app/(dashboard)/platform/spend-governor/page.tsx` | Dashboard, tenant management, suspension log |
| **Admin UI: Error handler** | API error interceptor | Catch `SPEND_LIMIT_EXCEEDED` → show generic message |
| **CLI: `set-budget` command** | `packages/cli/` | `radiant admin set-budget` |

---

## 12. Implementation Plan

### Phase 1: Database + Core Service (Backend Foundation)

- Migration: `spend_governor_audit`, `spend_governor_overrides` tables
- `SpendGovernorService` with budget check, suspension, restoration, override
- `SpendLimitExceededError` typed error

### Phase 2: Model Router Integration

- Add spend gate to `model-router.service.ts` invoke()
- Wire error handling in API handlers to return user-safe message
- In-memory budget cache with 60s TTL

### Phase 3: Monitoring Lambda + Alerts

- `spend-governor-monitor.ts` (EventBridge 5-min)
- `budget-alert-handler.ts` (SNS from AWS Budgets)
- SENTINEL integration for both layers

### Phase 4: CDK Infrastructure

- AWS Budget resource + SNS topic + Budget Action
- EventBridge rule for monitor Lambda
- IAM deny policy template

### Phase 5: Swift Deployer + CLI

- New `InstallationParameters` fields
- Budget creation during install
- CLI `set-budget` command

### Phase 6: Admin Dashboard UI

- Spend Governor dashboard page
- Tenant budget management
- Suspension log viewer
- Restore/override controls

---

## Visual Summary: What Happens at Each Threshold

```
0%──────────────80%──────90%──────95%─────100%────────►

Layer 1 (AWS):
         INFO alert    WARN alert   Deny policy   CRITICAL alert
         to admins     to admins    blocks new     + deny policy
                                    resources      active

Layer 2 (AI):
                       WARN alert              Models quarantined
                       to admins +             + CRITICAL alert
                       tenant admin            + error logs
                                               + "Service unavailable"
                                                 for users
```

---

*Document created: February 7, 2026*  
*Requires approval before implementation begins*
