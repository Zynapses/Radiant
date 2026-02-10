# RADIANT Strategic Security Implementation

> **Document 19** | Version 4.18.0 | Last Updated: 2026-02-10
>
> Comprehensive credential lifecycle security framework implementing NIST SP 800-57,
> CIS AWS Foundations Benchmark v3.0, SOC 2 Type II (CC6.1), AWS Well-Architected
> Security Pillar, PCI DSS v4.0, and ISO 27001:2022.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Standards & Compliance Mapping](#2-standards--compliance-mapping)
3. [Architecture Overview](#3-architecture-overview)
4. [Phase A — Zero-Code Storage & Static Analysis](#4-phase-a--zero-code-storage--static-analysis)
5. [Phase B — Key Restrictions & DB Credential Rotation](#5-phase-b--key-restrictions--db-credential-rotation)
6. [Phase C — Mandatory Rotation & Dormant Key Cleanup](#6-phase-c--mandatory-rotation--dormant-key-cleanup)
7. [Phase D — Least Privilege & Observability](#7-phase-d--least-privilege--observability)
8. [Swift Deployer Integration](#8-swift-deployer-integration)
9. [Admin Dashboard Integration](#9-admin-dashboard-integration)
10. [SDK Auto-Rotation](#10-sdk-auto-rotation)
11. [Database Schema](#11-database-schema)
12. [CDK Infrastructure](#12-cdk-infrastructure)
13. [Scheduled Lambda Functions](#13-scheduled-lambda-functions)
14. [Rotation Schedules & Policies](#14-rotation-schedules--policies)
15. [Deployment Guide](#15-deployment-guide)
16. [Maintenance & Operations](#16-maintenance--operations)
17. [Troubleshooting](#17-troubleshooting)
18. [Audit & Reporting](#18-audit--reporting)
19. [Incident Response Procedures](#19-incident-response-procedures)
20. [Glossary](#20-glossary)

---

## 1. Executive Summary

RADIANT's Credential Lifecycle Security Framework provides **end-to-end automated management** of all credential types across the platform:

| Credential Type | Storage | Rotation | Monitoring | Enforcement |
|----------------|---------|----------|------------|-------------|
| **IAM Access Keys** | AWS IAM | 90-day auto-rotation | AWS Config rules | CIS benchmarks |
| **DB Credentials** | Secrets Manager | 30-day auto-rotation | CloudWatch metrics | Secrets Manager native |
| **Tenant API Keys** | Aurora PostgreSQL | 90-day expiry + 14-day grace | Dormant key Lambda | Auth middleware |
| **JWT Signing Keys** | Secrets Manager | 30-day auto-rotation | CloudWatch metrics | Dual-key validation |
| **Infrastructure Secrets** | SSM Parameter Store | On-demand | AWS Config | CDK-managed |

### Key Outcomes

- **Zero hardcoded credentials** — pre-commit hook blocks 11 pattern categories
- **100% rotation coverage** — all credential types have automated rotation
- **Dormant key elimination** — 30/45/60-day escalation with auto-disable
- **Least privilege enforcement** — IAM Access Analyzer + monthly reports
- **Multi-standard compliance** — single framework covers 6 industry standards
- **Self-service rotation** — tenants can rotate keys via API or admin UI
- **SDK transparency** — `X-Key-Expires-In` header + automatic key swap

---

## 2. Standards & Compliance Mapping

### NIST SP 800-57 — Key Management Recommendation

| NIST Control | RADIANT Implementation |
|-------------|----------------------|
| §5.3 Cryptoperiods | API keys: 90-day default expiry. JWT signing: 30-day rotation. IAM keys: 90-day rotation. |
| §5.3.6 Key Compromise | Immediate revocation via admin UI or API. Dormant key auto-disable at 60 days. |
| §6.1 Key Generation | `crypto.randomBytes(32)` for API keys. `crypto.randomBytes(64)` for JWT HMAC. AWS-managed for DB creds. |
| §6.2 Key Distribution | API keys returned once at creation. JWT keys via Secrets Manager AWSCURRENT/AWSPREVIOUS. |
| §6.3 Key Storage | Secrets Manager (encrypted at rest with KMS). Aurora with optional envelope encryption. |
| §6.4 Key Destruction | Hard delete from Aurora after revocation. IAM key deletion via CLI. |

### CIS AWS Foundations Benchmark v3.0

| CIS Control | Rule ID | RADIANT Implementation |
|------------|---------|----------------------|
| 1.4 — No root access keys | `iam-root-access-key-check` | AWS Config managed rule in CredentialLifecycleStack |
| 1.5 — Root MFA enabled | `root-account-mfa-enabled` | AWS Config managed rule + Swift Deployer audit |
| 1.12 — No unused credentials | `iam-user-unused-credentials-check` | AWS Config rule (45-day threshold) + dormant key Lambda |
| 1.14 — Key rotation ≤90 days | `access-keys-rotated` | AWS Config rule (90-day max age) + auto-rotation Lambda |

### SOC 2 Type II — CC6.1 (Logical and Physical Access Controls)

| SOC 2 Criteria | RADIANT Implementation |
|---------------|----------------------|
| CC6.1.1 — Credential lifecycle | Full create → rotate → expire → revoke → delete lifecycle |
| CC6.1.3 — Access restrictions | IP CIDR allowlisting, HTTP origin restrictions, scope-based access |
| CC6.1.5 — Monitoring | Daily dormant key audit, monthly IAM report, CloudWatch metrics |
| CC6.1.7 — Revocation | Immediate revocation via API/UI. Auto-disable for dormant keys. |

### AWS Well-Architected — Security Pillar

| Best Practice | RADIANT Implementation |
|--------------|----------------------|
| SEC02-BP01 — Use strong sign-in | MFA enforcement check in IAM audit |
| SEC02-BP02 — Use temporary credentials | Secrets Manager auto-rotation for DB credentials |
| SEC02-BP04 — Audit and rotate credentials | Scheduled Lambdas + IAM Access Analyzer |
| SEC03-BP01 — Define access requirements | Scope-based API key permissions |
| SEC03-BP07 — Analyze public/cross-account access | IAM Access Analyzer with EventBridge alerting |

### PCI DSS v4.0 — Requirements 3.6 & 3.7

| PCI Requirement | RADIANT Implementation |
|----------------|----------------------|
| 3.6.1 — Key generation procedures | Cryptographically secure random generation (Node.js `crypto`) |
| 3.6.4 — Key changes for expired keys | Automatic rotation before expiry (14-day grace period) |
| 3.6.5 — Retirement of old keys | `replaced_by_key_id` / `replaces_key_id` lineage tracking |
| 3.7.1 — Key management policies | Configurable `RotationSchedule` per environment |

### ISO 27001:2022 — Annex A.9

| ISO Control | RADIANT Implementation |
|------------|----------------------|
| A.9.2.1 — User registration | Tenant API key creation with audit logging |
| A.9.2.3 — Privileged access | Scope-based permissions, admin-only operations |
| A.9.2.5 — Review of access rights | Monthly IAM Access Report Lambda |
| A.9.2.6 — Removal of access rights | Auto-disable dormant keys, revocation API |
| A.9.4.2 — Secure log-on procedures | MFA enforcement, IP restriction checks |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    RADIANT Security Framework                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Pre-Commit   │  │ CDK-Nag      │  │ AWS Config Rules     │  │
│  │ Hook (11     │  │ AwsSolutions │  │ • unused-credentials │  │
│  │  patterns)   │  │ Pack         │  │ • keys-rotated       │  │
│  │              │  │              │  │ • root-key-check      │  │
│  └──────────────┘  └──────────────┘  │ • root-mfa           │  │
│                                       └──────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Auth Middleware (Lambda)                     │   │
│  │  • IP CIDR matching    • Origin enforcement               │   │
│  │  • Expiry validation   • X-Key-Expires-In header          │   │
│  │  • Scope checking      • Use count tracking               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Dormant Key  │  │ API Key      │  │ JWT Signing          │  │
│  │ Audit Lambda │  │ Rotation     │  │ Rotation Lambda      │  │
│  │ (daily)      │  │ Lambda       │  │ (Secrets Manager)    │  │
│  │              │  │ (daily)      │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ IAM Access   │  │ Monthly IAM  │  │ SNS Alert Topic      │  │
│  │ Analyzer     │  │ Report       │  │ (security events)    │  │
│  │              │  │ Lambda       │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Swift Deployer (macOS)                       │   │
│  │  • Full security audit       • CDK stack deployment       │   │
│  │  • IAM key remediation       • Compliance scorecard       │   │
│  │  • Schedule configuration    • Tenant key lifecycle       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               SDK Client (TypeScript)                      │   │
│  │  • X-Key-Expires-In detection                             │   │
│  │  • onKeyExpiring callback                                  │   │
│  │  • Automatic key swap (configurable threshold)            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Phase A — Zero-Code Storage & Static Analysis

### 4.1 Pre-Commit Hook (`.husky/pre-commit`)

The enhanced pre-commit hook scans staged files for 11 categories of secrets:

| # | Pattern Category | Regex | Standard |
|---|-----------------|-------|----------|
| 1 | AWS Access Key ID | `AKIA[0-9A-Z]{16}` | CIS AWS 1.4 |
| 2 | AWS Secret Access Key | `[0-9a-zA-Z/+=]{40}` (after `aws_secret`) | CIS AWS 1.4 |
| 3 | RSA/EC Private Keys | `-----BEGIN (RSA\|EC\|OPENSSH) PRIVATE KEY-----` | NIST 800-57 §6.3 |
| 4 | JWT Tokens | `eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]+` | — |
| 5 | Generic Passwords | `password\s*[:=]\s*['"][^'"]{8,}` | SOC2 CC6.1 |
| 6 | Database Connection Strings | `(postgres\|mysql\|mongodb)://[^\\s]+:[^\\s]+@` | PCI DSS 3.6 |
| 7 | API Keys (generic) | `api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{20,}` | — |
| 8 | Bearer Tokens | `Bearer\s+[A-Za-z0-9-._~+/]+=*` | — |
| 9 | Slack/Discord Webhooks | `https://hooks\.(slack\|discord)\.com/` | — |
| 10 | Generic High-Entropy | `[A-Za-z0-9+/]{64,}` (in assignments) | — |
| 11 | Hex Tokens | `[0-9a-f]{64}` (in assignments) | NIST 800-57 §6.3 |

### 4.2 CDK-Nag (`cdk-nag` AwsSolutions Pack)

Enabled automatically for production deployments:

```typescript
if (environment === 'prod' || app.node.tryGetContext('enableCdkNag') === 'true') {
  Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
}
```

**Key checks enforced:**
- AwsSolutions-IAM4: No managed admin policies
- AwsSolutions-IAM5: No wildcard permissions
- AwsSolutions-S1: S3 access logging enabled
- AwsSolutions-RDS10: Deletion protection on Aurora
- AwsSolutions-SM1: Secrets Manager rotation enabled

### 4.3 AWS Config Rules

Four managed rules deployed via `CredentialLifecycleStack`:

| Rule | AWS Config Rule ID | Threshold | Action |
|------|-------------------|-----------|--------|
| Unused credentials | `iam-user-unused-credentials-check` | 45 days | Flag + alert |
| Key rotation | `access-keys-rotated` | 90 days max age | Flag + alert |
| Root key check | `iam-root-access-key-check` | Any root key | Critical alert |
| Root MFA | `root-account-mfa-enabled` | MFA not enabled | Critical alert |

---

## 5. Phase B — Key Restrictions & DB Credential Rotation

### 5.1 Database Migration (`V2026_02_10_001`)

New columns on `api_keys` table:

| Column | Type | Purpose | Standard |
|--------|------|---------|----------|
| `allowed_ips` | `JSONB` | CIDR allowlist (e.g., `["10.0.0.0/8"]`) | SOC2 CC6.1.3 |
| `allowed_origins` | `JSONB` | HTTP origin allowlist | SOC2 CC6.1.3 |
| `encryption_key_id` | `VARCHAR(128)` | KMS envelope encryption ref | NIST 800-57 §6.3 |
| `dormant_flagged_at` | `TIMESTAMPTZ` | When first flagged dormant | CIS AWS 1.12 |
| `dormant_warning_level` | `VARCHAR(10)` | Current warning: 30d/45d/60d | CIS AWS 1.12 |
| `replaced_by_key_id` | `UUID FK` | Successor key reference | PCI DSS 3.6.5 |
| `replaces_key_id` | `UUID FK` | Predecessor key reference | PCI DSS 3.6.5 |

New columns on `tenants` table:

| Column | Type | Purpose |
|--------|------|---------|
| `api_key_default_expiry_days` | `INTEGER` | Default 90 days |
| `api_key_max_expiry_days` | `INTEGER` | Maximum 365 days |
| `require_api_key_ip_restriction` | `BOOLEAN` | Enforce IP restrictions |

New database functions:
- `validate_api_key_with_restrictions()` — validates key + IP/origin/endpoint checks
- `rotate_api_key()` — atomic self-service rotation with lineage tracking

### 5.2 Auth Middleware Enforcement

**File:** `lambda/shared/middleware/auth.ts`

The middleware now enforces:

1. **Expiry check** — rejects expired keys with `401 Unauthorized`
2. **IP CIDR matching** — `isIpInCidr()` validates source IP against `allowed_ips`
3. **Origin validation** — checks `Origin` header against `allowed_origins`
4. **Use count tracking** — increments `use_count` on every valid request
5. **X-Key-Expires-In header** — injected on responses (e.g., `14d`, `7d`)

### 5.3 DB Credential Auto-Rotation

Configured in `CredentialLifecycleStack`:
- **Production:** 30-day automatic rotation via Secrets Manager
- **Dev/Staging:** 90-day rotation
- Uses existing Aurora cluster secret

---

## 6. Phase C — Mandatory Rotation & Dormant Key Cleanup

### 6.1 Dormant Key Audit Lambda (`dormant-key-audit.ts`)

**Schedule:** Daily at 02:00 UTC

| Days Inactive | Action | Notification |
|--------------|--------|--------------|
| 30 days | Flag as dormant | `KEY_DORMANT_WARNING` → SNS |
| 45 days | Final warning | `KEY_FINAL_WARNING` → SNS |
| 60 days | Auto-disable | `KEY_AUTO_DISABLED` → SNS + audit log |

### 6.2 API Key Auto-Rotation Lambda (`api-key-rotation.ts`)

**Schedule:** Daily at 03:00 UTC

1. Finds keys expiring within the **grace period** (default: 14 days)
2. Generates a successor key with identical permissions
3. Links via `replaces_key_id` / `replaced_by_key_id`
4. Notifies tenant via SNS (`KEY_AUTO_ROTATED`)
5. Disables keys past expiry (`KEY_EXPIRED`)
6. Sends upcoming expiry notifications (grace + 7 days)

### 6.3 JWT Signing Rotation Lambda (`jwt-signing-rotation.ts`)

**Trigger:** Secrets Manager rotation schedule (30 days)

Implements the four-step Secrets Manager rotation protocol:
1. `createSecret` — generate new 512-bit HMAC key
2. `setSecret` — no external resources to update
3. `testSecret` — sign/verify test payload
4. `finishSecret` — promote AWSPENDING → AWSCURRENT, old → AWSPREVIOUS

**Dual-key validation window:** Existing JWTs remain valid until natural expiry because the old key stays as AWSPREVIOUS.

### 6.4 Self-Service Rotation API

**Endpoint:** `POST /api/v1/tenant/keys/{keyId}/rotate`

Response:
```json
{
  "success": true,
  "new_key": {
    "id": "uuid",
    "raw_key": "rad_...",  // Only returned once
    "prefix": "rad_abc123",
    "replaces_key_id": "old-key-uuid"
  }
}
```

---

## 7. Phase D — Least Privilege & Observability

### 7.1 IAM Access Analyzer

- Deployed in `CredentialLifecycleStack` as `ACCOUNT`-type analyzer
- EventBridge rule fires on new findings → SNS alert
- Monthly report Lambda aggregates findings

### 7.2 Monthly IAM Report Lambda (`iam-access-report.ts`)

**Schedule:** First Monday of each month at 06:00 UTC

Report contents:
- IAM credential report (age, MFA status, last used)
- Individual access key staleness analysis
- IAM Access Analyzer findings summary
- Recommendations and risk scoring
- Published to SNS + CloudWatch metrics

### 7.3 Admin Dashboard UI

The API Keys page (`apps/admin-dashboard/app/(dashboard)/api-keys/page.tsx`) includes:
- **Rotate Key** — generates successor, shows new key once
- **Manage Restrictions** dialog — edit IP CIDRs and HTTP origins
- **Key lifecycle indicators** — expiry dates, dormant warnings, use counts

### 7.4 SDK Auto-Rotation

The TypeScript SDK (`packages/sdk/src/client.ts`) supports:

```typescript
const client = new RadiantClient({
  apiKey: 'rad_...',
  onKeyExpiring: async (daysUntilExpiry) => {
    // Call your rotation endpoint
    const response = await fetch('/api/v1/keys/current/rotate', { method: 'POST' });
    const { new_key } = await response.json();
    return new_key.raw_key;  // Client auto-swaps
  },
  keyExpiryThresholdDays: 14,  // Trigger at 14 days (default)
});
```

**How it works:**
1. Every response is checked for `X-Key-Expires-In` header
2. If days ≤ threshold, `onKeyExpiring` callback fires asynchronously
3. If callback returns a new key string, client swaps `_apiKey` atomically
4. Subsequent requests use the new key transparently

---

## 8. Swift Deployer Integration

### 8.1 Overview

The Swift Deployer app includes a dedicated **Credential Security** sidebar tab that provides:

- **Full security audit** across IAM, Config, Access Analyzer, Secrets Manager, and tenant API keys
- **Compliance scorecard** against 6 industry standards
- **One-click remediation** for IAM key rotation, disable, and deletion
- **CDK stack deployment** for the CredentialLifecycleStack
- **Rotation schedule configuration** with per-environment settings

### 8.2 Files

| File | Purpose |
|------|---------|
| `Services/CredentialLifecycleService.swift` | Audit engine, remediation actions, CDK deployment |
| `Views/CredentialLifecycleView.swift` | SwiftUI dashboard with 7 audit sections |
| `AppState.swift` | `.credentialLifecycle` navigation tab |
| `Views/MainView_macOS.swift` | `CredentialLifecycleView()` in `DetailContentView` |

### 8.3 Running an Audit (Swift Deployer)

1. Open Swift Deployer → select environment (dev/staging/prod)
2. Click **Credential Security** in the sidebar
3. Click **Run Audit**
4. Review results across 7 sections:
   - **Overview** — summary cards, critical findings
   - **IAM Keys** — per-key risk assessment with remediation buttons
   - **Config Rules** — AWS Config compliance status
   - **Access Analyzer** — IAM findings, public access detection
   - **Secrets Manager** — rotation inventory
   - **Tenant API Keys** — dormant/expiring/unrestricted key detection
   - **Compliance** — per-standard scorecard with scores

### 8.4 Deploying the Stack (Swift Deployer)

1. Click **Deploy Stack** in the toolbar
2. Optionally enter an alert email for SNS notifications
3. Click **Deploy to [environment]**
4. The service runs `npx cdk deploy *-credential-lifecycle` with proper context args

### 8.5 Configuring Rotation Schedules (Swift Deployer)

1. Click **Schedule** in the toolbar
2. Adjust intervals:
   - IAM key rotation (default: 90 days)
   - DB credential rotation (default: 30 days)
   - API key default expiry (default: 90 days)
   - Grace period (default: 14 days)
   - JWT signing rotation (default: 30 days)
3. Configure dormant key policy (30/45/60-day escalation)
4. Enable enforcement policies (IP restrictions, MFA requirement)
5. Click **Save Schedule**

### 8.6 Remediation Actions (Swift Deployer)

From the **IAM Keys** section, each key with High/Critical risk shows a wrench menu:

| Action | What It Does |
|--------|-------------|
| **Rotate Key** | Creates new IAM access key, deactivates old one |
| **Disable Key** | Sets key status to Inactive |
| **Delete Key** | Permanently removes the key from IAM |

All actions require confirmation and are logged to the audit trail.

---

## 9. Admin Dashboard Integration

### 9.1 API Key Management Page

**Path:** `/api-keys` in the admin dashboard

Features added by the security framework:

| Feature | UI Element | API |
|---------|-----------|-----|
| Key rotation | Dropdown → "Rotate Key" | `POST /api/admin/api-keys/{id}/rotate` |
| IP restrictions | Dialog → textarea (CIDR per line) | `PUT /api/admin/api-keys/{id}/restrictions` |
| Origin restrictions | Dialog → textarea (origin per line) | `PUT /api/admin/api-keys/{id}/restrictions` |
| Expiry display | Clock icon + date in key row | Read from `expires_at` |

### 9.2 Tenant Admin Key Management

**Routes added to** `thinktank-tenant-admin/handler.ts`:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/keys` | List all API keys for tenant |
| `POST` | `/keys` | Create new key (with restrictions, expiry) |
| `POST` | `/keys/{id}/rotate` | Self-service rotation |
| `PUT` | `/keys/{id}/restrictions` | Update IP/origin/endpoint restrictions |
| `POST` | `/keys/{id}/revoke` | Revoke key |

---

## 10. SDK Auto-Rotation

### 10.1 Configuration

```typescript
interface RadiantConfig {
  apiKey: string;
  onKeyExpiring?: (daysUntilExpiry: number) => Promise<string | null>;
  keyExpiryThresholdDays?: number;  // Default: 14
  // ... other config
}
```

### 10.2 Implementation Details

- `handleKeyExpiryHeader()` in `RadiantClient` checks every response
- Rotation fires asynchronously (does not block current request)
- `_rotationInProgress` flag prevents concurrent rotation attempts
- Debug mode logs rotation events to console

### 10.3 Example Integration

```typescript
import { RadiantClient } from '@radiant/sdk';

const client = new RadiantClient({
  apiKey: process.env.RADIANT_API_KEY!,
  baseUrl: process.env.RADIANT_API_URL,
  debug: true,
  keyExpiryThresholdDays: 7,  // Rotate 7 days before expiry
  onKeyExpiring: async (days) => {
    console.log(`Key expires in ${days} days, rotating...`);
    const res = await fetch(`${process.env.RADIANT_API_URL}/api/v1/keys/rotate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${client.apiKey}` },
    });
    const { new_key } = await res.json();
    // Persist the new key for restarts
    await saveToSecureStorage(new_key.raw_key);
    return new_key.raw_key;
  },
});
```

---

## 11. Database Schema

### 11.1 Migration: `V2026_02_10_001__credential_lifecycle_security.sql`

**New indexes for performance:**
- `idx_api_keys_dormant` — on `(last_used_at, is_active)` WHERE active + not revoked
- `idx_api_keys_expiring` — on `(expires_at, is_active)` WHERE active + has expiry
- `idx_api_keys_rotation_lineage` — on `(replaced_by_key_id)` WHERE not null

### 11.2 Database Functions

**`validate_api_key_with_restrictions()`** — validates key with:
- Expiration check
- Interface type matching
- IP CIDR range check (`inet() <<= inet()`)
- Origin exact match
- Endpoint allow/deny list
- Updates `last_used_at`, `use_count`, clears dormant flags

**`rotate_api_key()`** — atomic rotation:
- Creates successor key with identical permissions
- Links old → new via `replaced_by_key_id`
- Logs to `api_key_audit_log`

---

## 12. CDK Infrastructure

### 12.1 CredentialLifecycleStack

**File:** `packages/infrastructure/lib/stacks/credential-lifecycle-stack.ts`

**Resources provisioned:**

| Resource | Type | Purpose |
|----------|------|---------|
| 4 AWS Config rules | `config.ManagedRule` | IAM credential hygiene |
| IAM Access Analyzer | `accessanalyzer.CfnAnalyzer` | Least privilege analysis |
| EventBridge rule | `events.Rule` | Alert on new findings |
| SNS topic | `sns.Topic` | Security notifications |
| Dormant key Lambda | `lambda.Function` | Daily dormant key audit |
| API key rotation Lambda | `lambda.Function` | Daily auto-rotation |
| JWT rotation Lambda | `lambda.Function` | 30-day JWT signing rotation |
| IAM report Lambda | `lambda.Function` | Monthly access report |
| EventBridge schedules | `events.Rule` | Cron triggers for all Lambdas |
| Secrets Manager rotation | Native | DB credential auto-rotation |

### 12.2 Wiring in `bin/radiant.ts`

```typescript
const credentialLifecycleStack = new CredentialLifecycleStack(app, `${stackPrefix}-credential-lifecycle`, {
  env,
  appId,
  environment,
  alertEmail: app.node.tryGetContext('alertEmail'),
  secretsKey: securityStack.secretsKey,
  dbSecretArn: dataStack.cluster.secret?.secretArn,
  auroraClusterArn: dataStack.cluster.clusterArn,
  tags,
});
credentialLifecycleStack.addDependency(securityStack);
credentialLifecycleStack.addDependency(dataStack);
```

---

## 13. Scheduled Lambda Functions

| Lambda | Schedule | What It Does |
|--------|----------|-------------|
| `dormant-key-audit` | Daily 02:00 UTC | Scans `api_keys` for inactive keys, escalates 30→45→60 day warnings, auto-disables at 60 |
| `api-key-rotation` | Daily 03:00 UTC | Finds expiring keys within grace period, generates successors, disables past-expiry keys |
| `jwt-signing-rotation` | Secrets Manager (30d) | Four-step rotation: create→set→test→finish for JWT HMAC keys |
| `iam-access-report` | Monthly (1st Mon 06:00) | Generates credential report, Access Analyzer summary, publishes to SNS |

---

## 14. Rotation Schedules & Policies

### Default Schedule

| Credential | Rotation Interval | Grace Period | Auto-Rotation |
|-----------|-------------------|--------------|---------------|
| IAM Access Keys | 90 days | N/A | Via Config rule alert |
| DB Credentials | 30 days (prod) / 90 days (dev) | 24h overlap | Secrets Manager native |
| Tenant API Keys | 90-day expiry | 14 days | api-key-rotation Lambda |
| JWT Signing Keys | 30 days | Dual-key window | Secrets Manager native |

### Dormant Key Policy

| Threshold | Action | Reversible? |
|-----------|--------|------------|
| 30 days unused | Flag + notify | Yes (use resets) |
| 45 days unused | Final warning | Yes (use resets) |
| 60 days unused | Auto-disable | Admin can re-enable |

### Tenant-Configurable Settings

Tenants can set via admin settings:
- `api_key_default_expiry_days` (default: 90)
- `api_key_max_expiry_days` (default: 365)
- `require_api_key_ip_restriction` (default: false)

---

## 15. Deployment Guide

### 15.1 Prerequisites

- AWS CLI v2 configured with appropriate IAM permissions
- Node.js 18+ with CDK v2 installed
- Aurora PostgreSQL cluster deployed (DataStack)
- SecurityStack deployed (provides KMS keys)

### 15.2 Deploy via CDK CLI

```bash
# Deploy to dev with alert email
npx cdk deploy *-credential-lifecycle \
  -c environment=dev \
  -c alertEmail=security@example.com \
  --require-approval broadening

# Deploy to production
AWS_PROFILE=radiant-prod npx cdk deploy *-credential-lifecycle \
  -c environment=prod \
  -c alertEmail=security-team@example.com \
  --require-approval broadening
```

### 15.3 Deploy via Swift Deployer

1. Open Swift Deployer
2. Select target environment
3. Navigate to **Credential Security**
4. Click **Deploy Stack**
5. Enter alert email (optional)
6. Click **Deploy to [environment]**

### 15.4 Run Database Migration

```bash
# Apply the credential lifecycle migration
flyway -url=jdbc:postgresql://your-aurora-endpoint:5432/radiant migrate
```

### 15.5 Verify Deployment

```bash
# Check Config rules
aws configservice describe-compliance-by-config-rule --output table

# Check Access Analyzer
aws accessanalyzer list-analyzers --output table

# Check Secrets Manager rotation
aws secretsmanager describe-secret --secret-id radiant/dev/db-credentials --query 'RotationEnabled'

# Check scheduled Lambdas
aws events list-rules --name-prefix radiant --output table
```

---

## 16. Maintenance & Operations

### 16.1 Regular Maintenance Tasks

| Task | Frequency | Responsible | Tool |
|------|-----------|-------------|------|
| Review IAM access report | Monthly | Security team | SNS email / Swift Deployer |
| Review dormant key alerts | Weekly | Platform team | SNS email / Admin Dashboard |
| Review Access Analyzer findings | Weekly | Security team | Swift Deployer / AWS Console |
| Update rotation schedules | Quarterly | Security team | Swift Deployer / CDK context |
| Run full security audit | Monthly | Security team | Swift Deployer |
| Review cdk-nag suppressions | Per release | DevOps | CI pipeline |
| Update pre-commit patterns | Quarterly | Security team | `.husky/pre-commit` |

### 16.2 Monitoring

**CloudWatch Metrics (Namespace: `RADIANT/Security`):**
- `StaleAccessKeys` — count of keys older than 90 days
- `AccessAnalyzerFindings` — active finding count
- `MfaDisabledUsers` — users without MFA
- `JwtSigningKeyRotation` — rotation event count

**SNS Topics:**
- `radiant-{env}-security-alerts` — all security events
- Subscribe security team email addresses

### 16.3 Updating Rotation Intervals

Via CDK context:
```bash
npx cdk deploy *-credential-lifecycle \
  -c iamKeyRotationDays=60 \
  -c dbRotationDays=14
```

Via Swift Deployer: **Schedule** button → adjust values → **Save**

---

## 17. Troubleshooting

### 17.1 Common Issues

| Symptom | Cause | Resolution |
|---------|-------|------------|
| "API key has expired" 401 | Key past `expires_at` | Rotate via API or admin UI |
| "Source IP not in allowed list" 403 | Request from unlisted IP | Update `allowed_ips` via restrictions API |
| "Origin not in allowed list" 403 | Browser origin not allowed | Update `allowed_origins` via restrictions API |
| Config rule shows NON_COMPLIANT | IAM key exceeds age threshold | Rotate the flagged key |
| Dormant key auto-disabled | 60 days without use | Re-enable in admin UI if still needed |
| Secrets Manager rotation fails | Lambda timeout or permission | Check Lambda logs, verify IAM role permissions |
| JWT validation fails after rotation | Client using outdated key | Ensure AWSPREVIOUS is checked during dual-key window |
| CDK deploy fails with cdk-nag | Security finding in stack | Add `NagSuppressions.addResourceSuppressions()` with justification |
| Pre-commit hook blocks commit | Detected secret pattern | Remove the secret, use env var or Secrets Manager |
| SDK auto-rotation not firing | Header missing or threshold | Verify server sends `X-Key-Expires-In`, check `keyExpiryThresholdDays` |

### 17.2 Log Locations

| Component | Log Location |
|-----------|-------------|
| Dormant key Lambda | CloudWatch: `/aws/lambda/radiant-{env}-dormant-key-audit` |
| Rotation Lambda | CloudWatch: `/aws/lambda/radiant-{env}-api-key-rotation` |
| JWT rotation Lambda | CloudWatch: `/aws/lambda/radiant-{env}-jwt-signing-rotation` |
| IAM report Lambda | CloudWatch: `/aws/lambda/radiant-{env}-iam-access-report` |
| Auth middleware | CloudWatch: API Gateway execution logs |
| Swift Deployer | macOS Console.app: `RadiantDeployer` subsystem |
| Config rules | AWS Config: Compliance timeline |

### 17.3 Emergency Key Revocation

```bash
# Revoke a tenant API key immediately
curl -X POST https://api.radiant.example.com/api/v1/tenant/keys/{keyId}/revoke \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Disable an IAM access key
aws iam update-access-key --user-name USERNAME --access-key-id AKIAEXAMPLE --status Inactive

# Delete a compromised IAM key
aws iam delete-access-key --user-name USERNAME --access-key-id AKIAEXAMPLE
```

---

## 18. Audit & Reporting

### 18.1 Audit Log Schema

All credential events are logged to `api_key_audit_log`:

| Column | Content |
|--------|---------|
| `tenant_id` | Owning tenant |
| `key_id` | Affected key |
| `action` | `created`, `updated`, `revoked`, `expired`, `used` |
| `details` | JSONB with event-specific data |
| `created_at` | Timestamp |

### 18.2 Monthly Report Contents

The IAM access report includes:
- Total IAM users and access key count
- Stale keys (>90 days old or >30 days unused)
- Root account key presence and MFA status
- IAM Access Analyzer active findings by resource type
- Recommendations with severity levels
- CloudWatch metrics publication

---

## 19. Incident Response Procedures

### 19.1 Suspected Key Compromise

1. **Immediately disable** the key via admin UI, API, or AWS CLI
2. **Generate replacement** via rotation API or Swift Deployer
3. **Audit usage** — review `api_key_audit_log` for the compromised key
4. **Notify tenant** if it's a tenant API key
5. **Review Access Analyzer** for any unauthorized access patterns
6. **Document incident** in the security log

### 19.2 Mass Rotation (Breach Response)

1. Use Swift Deployer → **Credential Security** → run audit
2. Identify all affected keys
3. For IAM keys: use remediation menu to rotate each
4. For tenant keys: trigger bulk rotation via admin API
5. For DB credentials: trigger manual Secrets Manager rotation
6. For JWT keys: trigger manual rotation via Secrets Manager console
7. Monitor for authentication failures indicating missed keys

---

## 20. Glossary

| Term | Definition |
|------|-----------|
| **Cryptoperiod** | NIST-defined time span during which a key is authorized for use (NIST SP 800-57) |
| **Dormant Key** | API key that has not been used for 30+ days |
| **Grace Period** | Window before expiry during which auto-rotation generates a successor |
| **Dual-Key Validation** | Period where both old and new JWT signing keys are accepted |
| **Envelope Encryption** | Using a KMS key to encrypt a data key, which encrypts the actual data |
| **CIDR** | Classless Inter-Domain Routing — notation for IP address ranges (e.g., `10.0.0.0/8`) |
| **Access Analyzer** | AWS service that analyzes resource policies to identify unintended public/cross-account access |
| **Config Rule** | AWS Config managed rule that evaluates resource compliance against a specific check |
| **Rotation Lineage** | Chain of `replaces_key_id` / `replaced_by_key_id` references tracking key succession |

---

*This document is part of the RADIANT comprehensive documentation set. It must be updated whenever credential management, security infrastructure, rotation policies, or compliance requirements change. See `docs/DOCUMENTATION-MANIFEST.json` for the trigger matrix.*
