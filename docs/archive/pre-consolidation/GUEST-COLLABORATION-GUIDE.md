# Guest Collaboration Guide

> **RADIANT v7.30.0** | Last updated: 2026-02-06

This guide covers everything about guest collaboration in Think Tank: how guests interact, what they can do, who owns the data, how costs are tracked, and how regulatory compliance is enforced.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Guest Permissions & Capabilities](#2-guest-permissions--capabilities)
3. [Can Guests Run AI Prompts?](#3-can-guests-run-ai-prompts)
4. [Ownership Model](#4-ownership-model)
5. [Cost Attribution & Billing](#5-cost-attribution--billing)
6. [Per-User Cost Tracking](#6-per-user-cost-tracking)
7. [Cross-Tenant Cost Splitting](#7-cross-tenant-cost-splitting)
8. [Regulatory Compliance](#8-regulatory-compliance)
9. [Guest Restriction Notifications](#9-guest-restriction-notifications)
10. [Tenant Admin Configuration](#10-tenant-admin-configuration)
11. [Session Limits](#11-session-limits)
12. [Database Schema](#12-database-schema)
13. [API Reference](#13-api-reference)
14. [Architecture & Data Flow](#14-architecture--data-flow)
15. [Enterprise Deployment Examples](#15-enterprise-deployment-examples)
16. [FAQ](#16-faq)

---

## 1. Overview

Think Tank supports real-time collaborative sessions where internal (tenant) users can invite **external guests** to participate. Guests are people outside the tenant — clients, partners, consultants, opposing counsel, external reviewers — who need temporary access to a specific conversation.

**Key principles:**

- Guests are **session-scoped** — they see only the session they're invited to
- The **host tenant owns all data** — every message, file, and annotation belongs to the tenant
- Guest capabilities are **explicitly controlled** — prompt execution, file access, and branching require tenant admin opt-in
- Costs are **tracked per-user** and **aggregated to the tenant** — guest-originated costs are attributed to an internal user
- **Compliance licenses auto-restrict** guest capabilities — HIPAA/GDPR/SOC2 tenants get automatic protections

---

## 2. Guest Permissions & Capabilities

Guests are invited with one of three permission levels. Capabilities are resolved from the permission level combined with tenant settings and compliance licenses.

### Permission → Capability Matrix

| Capability | Viewer | Commenter | Editor |
|---|---|---|---|
| **View messages** | ✅ | ✅ | ✅ |
| **Add comments & annotations** | ❌ | ✅ | ✅ |
| **Add reactions** | ❌ | ✅ | ✅ |
| **Edit messages** | ❌ | ❌ | ✅ |
| **Run AI prompts** | ❌ | ❌ | ✅ * |
| **Upload files** | ❌ | ❌ | ✅ * |
| **Download files** | ✅ † | ✅ † | ✅ † |
| **Create conversation branches** | ❌ | ❌ | ✅ † |
| **Join AI Roundtable** | ❌ | ✅ † | ✅ † |

**\*** Requires explicit tenant admin opt-in (`guestPromptExecutionEnabled` / `guestFileUploadEnabled`). OFF by default.

**†** Disabled automatically when compliance licenses are active and `complianceAutoRestrict` is enabled (default: enabled).

### How Capabilities Are Resolved

```
1. Start with base capabilities from permission level (viewer/commenter/editor)
2. Apply tenant collaboration settings (guest_prompt_execution_enabled, etc.)
3. Check for active compliance licenses (HIPAA, GDPR, SOC2, etc.)
4. If compliance_auto_restrict=true AND compliance licenses exist:
   → Force-disable: prompt execution, file upload, file download, branching, roundtable
5. Store resolved capabilities on the guest record:
   → can_execute_prompts, can_upload_files, can_download_files
```

The resolution runs at **invite acceptance time** (`joinAsGuest`), not at invite creation. This means if a tenant admin changes settings between invite creation and acceptance, the guest gets the capabilities in effect at the time they join.

---

## 3. Can Guests Run AI Prompts?

**Yes, but with strict controls.** Guest prompt execution is **OFF by default** for all guests.

### Requirements (ALL must be true)

| # | Requirement | Default |
|---|---|---|
| 1 | Guest permission level = `editor` | N/A |
| 2 | Tenant admin enables `guestPromptExecutionEnabled` | `false` |
| 3 | No compliance license blocking it | Auto-blocked by HIPAA/GDPR/SOC2 |
| 4 | Guest hasn't exceeded per-session prompt limit | Default: 20 prompts |
| 5 | Guest hasn't exceeded per-session token limit | Default: 50,000 tokens |

### Execution Flow

```
Guest clicks "Send" on a prompt
  │
  ▼
guardGuestPrompt() middleware runs
  │
  ├─ Check can_execute_prompts on guest record → false? → 403 + clear message
  ├─ Check prompt count limit → exceeded? → 403 + "You have reached the maximum..."
  ├─ Check token limit → exceeded? → 403 + "You have reached the maximum..."
  ├─ Resolve cost attribution → who pays?
  │
  ▼
AI model invocation (LiteLLM)
  │
  ▼
recordGuestPromptUsage() runs
  ├─ Log to guest_cost_attribution_log (PostgreSQL)
  ├─ Update guest running totals (prompts_executed, tokens_consumed, cost_incurred)
  ├─ Record usage event in billing metering (DynamoDB)
  │   ├─ Tenant-level daily rollup (TENANT#{tenantId})
  │   └─ User-level daily rollup (TENANT#{tenantId}#USER#{attributedUserId})
  │
  ▼
Response returned to guest
```

### What Guests See When Blocked

If a guest attempts a restricted action, they see a clear message:

> *"AI prompt execution is not available for guest participants in this session. This restriction is set by the organization's collaboration policy."*

If they hit a limit:

> *"You have reached the maximum number of AI prompts (20) for this session. Contact the session host if you need additional access."*

---

## 4. Ownership Model

### Who Owns What?

| Entity | Owner | Details |
|---|---|---|
| **Collaborative session** | Host tenant user | `collaborative_sessions.owner_id` = the user who created the session |
| **All session data** | Host tenant | `collaborative_sessions.tenant_id` = tenant that owns everything |
| **Messages from guests** | Host tenant | Stored in `session_messages`, owned by the tenant |
| **Files uploaded by guests** | Host tenant | Stored in `collaboration_attachments`, S3 bucket owned by tenant |
| **Annotations by guests** | Host tenant | Stored in `async_annotations`, session-scoped |
| **Knowledge graph nodes** | Host tenant | Created by guests but owned by tenant |

### What Guests Can See

- **Only** the specific session they were invited to
- **Zero** access to other conversations, other sessions, other apps, or any tenant data
- **No** persistent account — guest identity is token-based (`guest_token`)
- When the session ends or the guest leaves, they lose all access

### Data Isolation

- Row Level Security (RLS) enforces tenant isolation via `check_session_tenant(session_id)`
- All collaboration tables use `session_id → collaborative_sessions.tenant_id` for isolation
- Guests cannot query any table outside their session scope

---

## 5. Cost Attribution & Billing

When a guest runs an AI prompt, the token cost must be attributed to someone for billing. The tenant admin configures how this works.

### Attribution Modes

| Mode | Who Pays | When to Use |
|---|---|---|
| **`inviting_user`** (default) | The tenant user who created the invite | Most common. The person who invited the guest is responsible for the costs they generate. |
| **`session_owner`** | The user who created the collaborative session | When sessions are "owned" by a project lead who manages the budget. |
| **`tenant_pool`** | Shared organization pool (no individual attribution) | When costs are treated as organizational overhead. |

### How It Works

```
Guest runs a prompt
  │
  ▼
resolveCostAttribution(tenantId, guestId, sessionId)
  │
  ├─ Look up the guest → find inviting user (collaboration_guest_invites.created_by)
  ├─ Check tenant_collaboration_settings.guest_cost_attribution
  │
  ├─ "inviting_user" → attributedToUserId = inviting user
  ├─ "session_owner" → attributedToUserId = collaborative_sessions.owner_id
  ├─ "tenant_pool"   → attributedToUserId = inviting user (for tracking), marked as pool
  │
  ▼
Usage event recorded with:
  - tenantId = host tenant (for tenant-level aggregation)
  - userId = attributedToUserId (for per-user tracking)
  - guestId = guest identifier (for guest-level tracking)
  - guestOriginated = true
```

### Cost Tracking Tables

| Table | Storage | Granularity | Retention |
|---|---|---|---|
| `radiant-usage-events` (DynamoDB) | Individual events | Per-request | 90 days |
| `radiant-usage-rollups` (DynamoDB) | Tenant daily rollup | Per-tenant per-model per-day | Indefinite |
| `radiant-user-usage-rollups` (DynamoDB) | User daily rollup | Per-user per-model per-day | Indefinite |
| `guest_cost_attribution_log` (PostgreSQL) | Guest attribution detail | Per-guest per-request | Per retention policy |

### Example: Cost Flow

A law firm (Tenant A) has user Alice who invites external consultant Bob as a guest editor.

1. Bob sends a prompt → 1,500 input tokens, 800 output tokens
2. Model pricing: $3/M input, $15/M output → provider cost = $0.0165
3. Tenant margin: 20% → billed cost = $0.0198
4. Attribution mode: `inviting_user` → cost attributed to **Alice**

**Result:**
- Alice's per-user rollup: +$0.0198 (with `guestOriginatedCost` = $0.0198)
- Tenant A's daily rollup: +$0.0198
- `guest_cost_attribution_log`: Bob → Alice, $0.0198, model details
- Bob's guest record: `prompts_executed` = 1, `tokens_consumed` = 2300, `cost_incurred` = $0.0198

---

## 6. Per-User Cost Tracking

All costs — whether from the user directly or from guests they invited — are tracked at the user level and aggregated to the tenant.

### DynamoDB Schema: `radiant-user-usage-rollups`

| Key | Format | Example |
|---|---|---|
| **pk** (partition) | `TENANT#{tenantId}#USER#{userId}` | `TENANT#abc-123#USER#alice-456` |
| **sk** (sort) | `DATE#{date}#MODEL#{modelId}` | `DATE#2026-02-06#MODEL#claude-3-5-sonnet` |

| Attribute | Type | Description |
|---|---|---|
| `requestCount` | number | Total requests (direct + guest-originated) |
| `inputTokens` | number | Total input tokens |
| `outputTokens` | number | Total output tokens |
| `totalTokens` | number | Total tokens |
| `providerCost` | number | Raw provider cost |
| `billedCost` | number | Cost after tenant margin |
| `guestOriginatedCount` | number | Requests originated by guests attributed to this user |
| `guestOriginatedCost` | number | Cost of guest-originated requests attributed to this user |

### API Endpoints

**Per-user rollups:**
```
GET /api/billing/metering/user-rollups?userId={userId}&startDate=2026-02-01&endDate=2026-02-06
```

Response:
```json
{
  "period": { "startDate": "2026-02-01", "endDate": "2026-02-06" },
  "userId": "alice-456",
  "totals": {
    "requests": 142,
    "inputTokens": 485000,
    "outputTokens": 192000,
    "billedCost": 12.45,
    "guestOriginatedCount": 18,
    "guestOriginatedCost": 2.34
  },
  "rollups": [...]
}
```

**Guest usage summary (tenant-wide):**
```
GET /api/billing/metering/guest-usage?startDate=2026-02-01&endDate=2026-02-06
```

Response:
```json
{
  "period": { "startDate": "2026-02-01", "endDate": "2026-02-06" },
  "totals": {
    "requests": 47,
    "tokens": 128500,
    "billedCost": 5.67
  },
  "byUser": [
    {
      "attributedToUserId": "alice-456",
      "attributionType": "inviting_user",
      "totalRequests": 18,
      "totalInputTokens": 52000,
      "totalOutputTokens": 31000,
      "totalBilledCost": 2.34,
      "totalProviderCost": 1.95
    }
  ]
}
```

---

## 7. Cross-Tenant Cost Splitting

When a guest is a user from **another Think Tank tenant** (identified by `linked_tenant_id` on the guest record), costs can be split between the two organizations.

### Configuration

| Setting | Default | Description |
|---|---|---|
| `crossTenantGuestEnabled` | `true` | Allow users from other tenants as guests |
| `crossTenantCostSplitEnabled` | `false` | Enable cost splitting |
| `crossTenantCostSplitPercent` | `50` | Percentage the host tenant pays (0-100) |

### Example

Host Tenant A invites a user from Tenant B. Cost split is 60/40 (host pays 60%).

A prompt costs $0.10 billed:
- Tenant A (host) pays: $0.06
- Tenant B (guest's org) pays: $0.04

This is recorded in `guest_cost_attribution_log` with:
```sql
attribution_type = 'cross_tenant_split'
split_percent = 60
host_tenant_cost = 0.06
guest_tenant_cost = 0.04
guest_tenant_id = 'tenant-b-id'
```

---

## 8. Regulatory Compliance

### Compliance Gates

Before any guest invite is created, `CollaborationPolicyService.checkComplianceForGuestInvite()` runs:

```
1. Check if guest access is enabled → disabled? → reject invite
2. Query tenant_licenses for active compliance licenses
3. No compliance licenses? → allow freely
4. Compliance licenses found:
   a. Determine which features to restrict
   b. HIPAA → require explicit acknowledgment
   c. GDPR → prepare data processing notice
   d. Build restriction list
5. Return: { allowed, restrictions, requiresAcknowledgment, notificationMessage }
```

### Compliance License → Guest Restriction Mapping

| License | Prompt Execution | File Upload | File Download | Branching | Roundtable | Acknowledgment |
|---|---|---|---|---|---|---|
| **HIPAA** | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | Required |
| **HIPAA Retention** | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | Required |
| **GDPR** | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | Required |
| **SOC 2** | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | Not required |
| **CCPA** | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | Not required |
| Any other compliance | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | Not required |

> All restrictions apply when `complianceAutoRestrict = true` (default). Tenant admins can override this, but they see a red warning banner and are told compliance officer approval is required.

### Audit Trail

Every restriction event is logged to `guest_compliance_restriction_log`:

| Column | Description |
|---|---|
| `tenant_id` | The tenant |
| `session_id` | The collaborative session |
| `guest_id` | The guest (null for invite-time restrictions) |
| `restricted_feature` | What was blocked (e.g., `prompt_execution`) |
| `restriction_reason` | Human-readable reason |
| `compliance_licenses` | JSON array of active compliance licenses |
| `guest_notified` | Whether the guest was shown a notification |
| `notification_message` | The message shown to the guest |

---

## 9. Guest Restriction Notifications

When a guest joins a session and their capabilities are restricted, the UI shows a **`GuestRestrictionBanner`**:

### Compliance-Restricted (Amber Banner)

> **Compliance Policy Restrictions**
>
> Some features are restricted by your organization's compliance policies.
>
> - 🔇 AI prompt execution is not available in this session.
> - ⬆️ File uploads are not available in this session.
> - ⬇️ File downloads are not available in this session.
> - 🌿 Creating conversation branches is not available.

### General Restriction (Slate Banner)

> **Guest Access Restrictions**
>
> Some features are restricted for guest participants.
>
> - 🔇 AI prompt execution is not available in this session.

### Behavior

- Shown immediately when the guest joins the session
- Dismissible (guest can close it)
- Re-appears if the guest attempts a restricted action
- The message text is configurable by the tenant admin

---

## 10. Tenant Admin Configuration

### Location

**Tenant Admin → Configuration → Collaboration** (`/collaboration`)

### Settings Reference

| Setting | Type | Default | Description |
|---|---|---|---|
| `guestAccessEnabled` | boolean | `true` | Master switch for all guest collaboration |
| `guestPromptExecutionEnabled` | boolean | `false` | Allow editor-level guests to run AI prompts |
| `guestFileUploadEnabled` | boolean | `false` | Allow editor-level guests to upload files |
| `guestFileDownloadEnabled` | boolean | `true` | Allow guests to download files |
| `complianceAutoRestrict` | boolean | `true` | Auto-disable sensitive features when compliance licenses are active |
| `guestCostAttribution` | enum | `inviting_user` | Who pays for guest AI usage |
| `crossTenantGuestEnabled` | boolean | `true` | Allow users from other tenants as guests |
| `crossTenantCostSplitEnabled` | boolean | `false` | Split costs between host and guest tenant |
| `crossTenantCostSplitPercent` | 0-100 | `50` | Host tenant's share of split costs |
| `guestMaxPromptsPerSession` | number | `20` | Max AI prompts per guest per session |
| `guestMaxTokensPerSession` | number | `50000` | Max tokens per guest per session |
| `guestSessionTimeoutMinutes` | number | `120` | Auto-disconnect guests after this duration |
| `notifyGuestOnRestriction` | boolean | `true` | Show restriction banner to guests |
| `restrictionMessage` | text | (default message) | Custom message for restriction banner |

### Compliance-Blocked Controls

When compliance licenses are active and `complianceAutoRestrict` is on:
- Toggles for prompt execution, file upload, file download are **force-disabled**
- Each disabled toggle shows an amber banner explaining:
  - *Which* compliance license is blocking the feature
  - *Why* the feature is restricted
  - *How* to override (disable Compliance Auto-Restrict, requires compliance officer approval)

---

## 11. Session Limits

Per-session caps prevent runaway guest usage.

| Limit | Default | Configurable | Enforcement |
|---|---|---|---|
| **Max prompts per session** | 20 | Yes, per tenant | `guardGuestPrompt()` checks before each AI call |
| **Max tokens per session** | 50,000 | Yes, per tenant | `guardGuestPrompt()` checks before each AI call |
| **Session timeout** | 120 min | Yes, per tenant | Stored for enforcement (scheduled Lambda) |

### Running Totals

Each guest record tracks:

| Column | Type | Description |
|---|---|---|
| `prompts_executed` | integer | Number of AI prompts run in this session |
| `tokens_consumed` | integer | Total tokens used in this session |
| `cost_incurred` | decimal | Total cost generated in this session |

These are updated atomically after each AI call by `recordGuestPromptUsage()`.

---

## 12. Database Schema

### New Tables (Migration 008)

#### `tenant_collaboration_settings`
Per-tenant configuration for all guest collaboration features. One row per tenant.

#### `guest_cost_attribution_log`
Every AI action by a guest, with full cost breakdown.

| Column | Type | Description |
|---|---|---|
| `guest_id` | UUID | The guest who ran the prompt |
| `session_id` | UUID | The collaborative session |
| `tenant_id` | UUID | Host tenant |
| `attributed_to_user_id` | UUID | Internal user who pays |
| `attribution_type` | varchar | `inviting_user`, `session_owner`, `tenant_pool`, `cross_tenant_split` |
| `model_id` | varchar | AI model used |
| `input_tokens` | integer | Input token count |
| `output_tokens` | integer | Output token count |
| `provider_cost` | decimal | Raw provider cost |
| `billed_cost` | decimal | Cost after margin |
| `split_percent` | integer | Host tenant share (for cross-tenant) |
| `host_tenant_cost` | decimal | Host tenant portion |
| `guest_tenant_cost` | decimal | Guest tenant portion |
| `guest_tenant_id` | UUID | Guest's home tenant (for cross-tenant) |

#### `guest_compliance_restriction_log`
Audit trail of every compliance-restricted action.

### Extended Tables

#### `collaboration_guests` (6 new columns)
- `can_execute_prompts` — resolved at join time
- `can_upload_files` — resolved at join time
- `can_download_files` — resolved at join time
- `prompts_executed` — running count
- `tokens_consumed` — running count
- `cost_incurred` — running total

#### `collaboration_guest_invites` (3 new columns)
- `compliance_acknowledged` — for HIPAA/GDPR acknowledgment
- `compliance_restrictions` — JSON array of restrictions at invite time
- `cost_attribution_user_id` — the user costs will be attributed to

---

## 13. API Reference

### Billing Metering

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/billing/metering/record` | Record usage (accepts `guestId`, `attributedToUserId`, `sessionId`) |
| `GET` | `/api/billing/metering/summary` | Tenant-level summary (includes guest costs) |
| `GET` | `/api/billing/metering/rollups` | Tenant-level daily rollups |
| `GET` | `/api/billing/metering/user-rollups?userId=` | Per-user rollups with guest subtotals |
| `GET` | `/api/billing/metering/guest-usage` | Guest cost attribution summary by user |

### Tenant Admin Collaboration Settings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tenant-admin/collaboration` | Get current settings + compliance licenses |
| `PUT` | `/api/tenant-admin/collaboration` | Update collaboration settings |

### Guest Prompt Guard (Internal)

```typescript
import { guardGuestPrompt, recordGuestPromptUsage } from './middleware/guest-prompt-guard';

// Before AI call:
const guard = await guardGuestPrompt(pool, { guestId, sessionId, tenantId });
if (!guard.allowed) {
  return { statusCode: 403, body: JSON.stringify({ error: guard.reason }) };
}

// After AI call:
await recordGuestPromptUsage(pool, guard, {
  modelId: 'claude-3-5-sonnet',
  inputTokens: 1500,
  outputTokens: 800,
  providerCost: 0.0165,
  billedCost: 0.0198,
  requestId: 'req-abc-123',
  latencyMs: 2400,
});
```

---

## 14. Architecture & Data Flow

### Invite → Join → Interact → Billing

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INVITE FLOW                                  │
│                                                                     │
│  Tenant User                                                        │
│    │                                                                │
│    ▼                                                                │
│  createGuestInvite()                                                │
│    │                                                                │
│    ├─ checkComplianceForGuestInvite() ──→ compliance gate           │
│    ├─ Store compliance_restrictions on invite                       │
│    ├─ Store cost_attribution_user_id = inviting user                │
│    └─ Log restrictions to guest_compliance_restriction_log          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                         JOIN FLOW                                   │
│                                                                     │
│  Guest clicks invite link                                           │
│    │                                                                │
│    ▼                                                                │
│  joinAsGuest()                                                      │
│    │                                                                │
│    ├─ resolveCapabilities() ──→ permission + settings + compliance  │
│    ├─ Write can_execute_prompts/can_upload_files/can_download_files │
│    ├─ Build restriction notification                                │
│    └─ Return guest record + capabilities + notification             │
│                                                                     │
│  Guest sees GuestRestrictionBanner (if restrictions exist)          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                      PROMPT EXECUTION FLOW                          │
│                                                                     │
│  Guest sends prompt                                                 │
│    │                                                                │
│    ▼                                                                │
│  guardGuestPrompt()                                                 │
│    ├─ Check can_execute_prompts ──→ false? → 403                   │
│    ├─ Check prompt limit ──→ exceeded? → 403                       │
│    ├─ Check token limit ──→ exceeded? → 403                        │
│    └─ Resolve cost attribution                                      │
│    │                                                                │
│    ▼                                                                │
│  AI Model Invocation (LiteLLM)                                      │
│    │                                                                │
│    ▼                                                                │
│  recordGuestPromptUsage()                                           │
│    ├─ Insert into guest_cost_attribution_log (PostgreSQL)           │
│    └─ Update guest running totals                                   │
│    │                                                                │
│    ▼                                                                │
│  Billing metering (DynamoDB)                                        │
│    ├─ Usage event: guestOriginated=true, attributedToUserId=X      │
│    ├─ Tenant rollup: TENANT#{tenantId} (aggregated)                │
│    └─ User rollup: TENANT#{tenantId}#USER#{attributedUserId}       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 15. Enterprise Deployment Examples

### Law Firm (HIPAA)

```
Settings:
  guestAccessEnabled: true
  guestPromptExecutionEnabled: false  ← blocked by compliance anyway
  complianceAutoRestrict: true
  guestCostAttribution: 'inviting_user'
  notifyGuestOnRestriction: true

Result:
  - Guests can view and comment on conversations
  - NO prompt execution, file upload/download, branching
  - All restrictions logged for compliance audit
  - Costs attributed to the attorney who invited the guest
```

### Research Lab (no compliance)

```
Settings:
  guestAccessEnabled: true
  guestPromptExecutionEnabled: true   ← explicitly enabled
  guestFileUploadEnabled: true
  guestCostAttribution: 'session_owner'
  guestMaxPromptsPerSession: 50
  guestMaxTokensPerSession: 200000
  crossTenantCostSplitEnabled: true
  crossTenantCostSplitPercent: 70     ← lab pays 70%

Result:
  - Guests with editor permission can run prompts and upload files
  - 50 prompts, 200K tokens per session
  - Costs attributed to the session owner (PI / project lead)
  - Cross-tenant guests: 70/30 cost split
```

### Hospital (HIPAA + SOC2)

```
Settings:
  guestAccessEnabled: true
  complianceAutoRestrict: true        ← auto-restricts everything
  guestCostAttribution: 'tenant_pool'
  notifyGuestOnRestriction: true
  restrictionMessage: 'Patient data protection policies restrict some features for external participants.'

Result:
  - Guests can view and comment only
  - All sensitive features force-disabled
  - Costs go to organizational pool
  - Custom compliance message shown to guests
```

### Startup (no compliance, minimal restrictions)

```
Settings:
  guestAccessEnabled: true
  guestPromptExecutionEnabled: true
  guestFileUploadEnabled: true
  guestFileDownloadEnabled: true
  guestCostAttribution: 'inviting_user'
  guestMaxPromptsPerSession: null     ← no limit
  guestMaxTokensPerSession: null      ← no limit

Result:
  - Full guest capabilities (editor = full access)
  - No limits on prompts or tokens
  - Costs attributed to whoever invited the guest
```

---

## 16. FAQ

### Q: If I disable guest access entirely, what happens to existing sessions?

Active guest connections remain until the guest leaves or the session ends. New guest invites will be rejected. Existing invites cannot be redeemed.

### Q: Can a guest be promoted to a full tenant user?

Guests have a `linked_user_id` field. If a guest later receives a tenant invitation and creates an account, the system can link them. This does not retroactively change ownership of their session content — it remains owned by the host tenant.

### Q: Where can I see how much my guests have cost?

**Tenant Admin → Reports** shows overall tenant costs. The new `GET /metering/guest-usage` endpoint provides a breakdown of guest-originated costs by attributed user. The `GET /metering/user-rollups` endpoint shows each user's total with `guestOriginatedCost` subtotals.

### Q: Can I change the cost attribution mode retroactively?

No. Attribution is set at the time of usage. Changing the mode only affects future guest prompts. Historical attribution is immutable in `guest_cost_attribution_log`.

### Q: What happens when a guest from another tenant triggers the cross-tenant split?

The split is recorded in `guest_cost_attribution_log` with `host_tenant_cost` and `guest_tenant_cost`. The actual inter-tenant billing reconciliation is handled through monthly cross-tenant invoicing (future feature).

### Q: Can I override compliance restrictions for a specific session?

Not per-session. The Compliance Auto-Restrict toggle is tenant-wide. If you disable it, ALL sessions lose compliance protections for guests. The UI warns you and recommends compliance officer approval.

---

## Related Documents

| Document | Relevance |
|---|---|
| `docs/THINKTANK-LICENSING-MODEL.md` | Compliance license definitions |
| `docs/POLYMORPHIC-LIQUID-UI-GUIDE.md` | Delight system for guests |
| `docs/DELIGHT-SYSTEM-GUIDE.md` | Guest Delight behavior |
| `docs/RADIANT-PLATFORM-ARCHITECTURE.md` | Platform architecture (Section: Guest Collaboration Policy) |
| `CHANGELOG.md` | v7.30.0 release notes |
