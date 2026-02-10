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

### 1.1 Why This Framework Exists

Credential management is the single most common source of cloud security breaches. According to the 2025 Verizon Data Breach Investigations Report, over 60% of breaches involving cloud infrastructure trace back to stolen, leaked, or stale credentials. The risk is not theoretical — it is the primary attack vector.

RADIANT operates as a multi-tenant SaaS platform where hundreds of tenants hold API keys that grant access to AI model inference, data stores, and administrative functions. A single compromised tenant key can expose conversation data, burn through inference budgets, or — in the worst case — allow lateral movement to other tenants if the key has overly broad permissions. On the infrastructure side, IAM access keys held by developers and CI/CD systems can provide full account access if they are never rotated or left dormant after an employee departs.

This framework was built to eliminate those risks systematically, not through manual processes or periodic audits, but through **automated enforcement at every layer of the stack**:

- **At the code layer** — secrets are blocked from entering version control before they ever reach a remote repository
- **At the infrastructure layer** — AWS Config rules continuously monitor IAM key hygiene, and IAM Access Analyzer identifies overly permissive resource policies
- **At the application layer** — the auth middleware enforces IP restrictions, origin restrictions, key expiry, and scope-based access on every single API request
- **At the operational layer** — scheduled Lambda functions audit dormant keys daily, rotate expiring keys automatically, and generate monthly compliance reports
- **At the client layer** — the SDK detects when a key is approaching expiry and can transparently swap to a rotated key without any service interruption

### 1.2 Credential Types Under Management

The framework manages five distinct credential types, each with different storage mechanisms, rotation intervals, and monitoring approaches. The reason for this diversity is that different credential types have different risk profiles and different AWS-native management options.

| Credential Type | Storage | Rotation | Monitoring | Enforcement | Why This Approach |
|----------------|---------|----------|------------|-------------|-------------------|
| **IAM Access Keys** | AWS IAM | 90-day auto-rotation | AWS Config rules | CIS benchmarks | IAM keys are long-lived and have direct AWS API access. 90 days aligns with CIS Benchmark 1.14 and balances security with operational burden. |
| **DB Credentials** | Secrets Manager | 30-day (prod) / 90-day (dev) | CloudWatch metrics | Secrets Manager native | Database credentials have the highest blast radius — they can access all tenant data. Secrets Manager provides native rotation with zero-downtime key overlap. 30 days in production is aggressive but appropriate for this risk level. |
| **Tenant API Keys** | Aurora PostgreSQL | 90-day expiry + 14-day grace | Dormant key Lambda | Auth middleware | Tenant keys are the most numerous credential type. They need per-tenant configurability, IP/origin restrictions, and a grace period so auto-rotation does not cause unexpected outages. |
| **JWT Signing Keys** | Secrets Manager | 30-day auto-rotation | CloudWatch metrics | Dual-key validation | JWT HMAC signing keys must rotate without invalidating in-flight tokens. The AWSCURRENT/AWSPREVIOUS dual-key pattern allows existing tokens signed with the old key to remain valid during their natural expiry window. |
| **Infrastructure Secrets** | SSM Parameter Store | On-demand | AWS Config | CDK-managed | CDK-managed parameters (like API endpoints, feature flags, non-sensitive config) change only during deployments, so on-demand rotation is sufficient. |

### 1.3 Key Outcomes

- **Zero hardcoded credentials** — the pre-commit hook scans for 11 distinct secret pattern categories and blocks any commit that contains them. This is the first line of defense and catches mistakes before they reach the repository.
- **100% rotation coverage** — every credential type in the platform has an automated rotation mechanism. There are no credentials that require manual rotation on a schedule that someone might forget.
- **Dormant key elimination** — keys that are not being used represent risk without value. The framework escalates through 30-day warning → 45-day final warning → 60-day auto-disable, giving key owners three chances to either use the key or acknowledge it before it is disabled.
- **Least privilege enforcement** — IAM Access Analyzer continuously scans resource policies to identify cases where resources are accessible from outside the account or from principals that should not have access. Monthly reports summarize findings for the security team.
- **Multi-standard compliance** — rather than building separate compliance mechanisms for each standard, this framework was designed to satisfy all six standards (NIST, CIS, SOC2, Well-Architected, PCI DSS, ISO 27001) with a single set of controls. Each control maps to specific requirements across multiple standards.
- **Self-service rotation** — tenants do not need to contact support to rotate a key. They can do it themselves via the API (`POST /keys/{id}/rotate`) or the tenant admin UI. This reduces support burden and improves security posture because tenants are more likely to rotate keys if it is easy.
- **SDK transparency** — the `X-Key-Expires-In` response header and `onKeyExpiring` callback allow client applications to handle key rotation automatically without any human intervention. The key swap happens in the background between requests.

---

## 2. Standards & Compliance Mapping

This section explains which industry standards apply to RADIANT's credential management, why each standard matters for a multi-tenant AI SaaS platform, and exactly how each requirement is satisfied by the framework. This mapping is critical for audit evidence — auditors will ask "show me how you satisfy CIS 1.14" and the answer needs to be specific and traceable.

### 2.1 NIST SP 800-57 — Key Management Recommendation

NIST SP 800-57 is the foundational standard for cryptographic key lifecycle management published by the National Institute of Standards and Technology. It defines the concept of **cryptoperiods** — the maximum time a key should be authorized for use — and specifies requirements for key generation, distribution, storage, and destruction. RADIANT follows this standard because it is referenced by nearly every other compliance framework and represents the baseline for key management best practices.

| NIST Control | What It Requires | How RADIANT Satisfies It | Implementation Details |
|-------------|-----------------|------------------------|----------------------|
| §5.3 Cryptoperiods | Keys must have a defined maximum lifetime appropriate to their use. Symmetric keys used for authentication should not exceed 2 years; shorter is preferred. | API keys default to 90-day expiry (configurable per tenant, max 365 days). JWT signing keys rotate every 30 days. IAM keys trigger alerts at 90 days. | The 90-day default was chosen because it is the CIS benchmark threshold and provides a good balance between security and operational convenience. Tenants who need longer expiry (e.g., for embedded integrations) can extend to 365 days, but this requires explicit admin action. |
| §5.3.6 Key Compromise | When a key is suspected of compromise, it must be immediately revocable. Systems must support emergency key revocation without waiting for scheduled rotation. | Immediate revocation via admin UI, tenant self-service API, or AWS CLI. Dormant key auto-disable at 60 days removes keys that may have been leaked but not reported. | The revocation API (`POST /keys/{id}/revoke`) sets `is_active = false`, `revoked_at = NOW()`, and `revoked_reason` in a single atomic transaction. The next API request using that key will receive a 401 immediately. |
| §6.1 Key Generation | Keys must be generated using approved random number generators with sufficient entropy. | API keys use `crypto.randomBytes(32)` (256 bits of entropy), producing a `rad_` prefixed Base64URL-encoded string. JWT HMAC keys use `crypto.randomBytes(64)` (512 bits). DB credentials are generated by AWS Secrets Manager using its internal CSPRNG. | Node.js `crypto.randomBytes()` uses OpenSSL's CSPRNG which draws from `/dev/urandom` on Linux. This is a FIPS 140-2 approved random number generator. The `rad_` prefix allows easy identification of RADIANT keys in logs without revealing key material. |
| §6.2 Key Distribution | Keys must be distributed securely and only to authorized recipients. The raw key material should be exposed the minimum number of times. | API keys are returned in plaintext exactly once — at creation time. The response includes a warning that the key will never be shown again. Internally, only the SHA-256 hash is stored. JWT signing keys are never exposed outside Secrets Manager. | The one-time display pattern is critical. The raw key is never stored in the database — only its hash. Even a database breach would not reveal usable key material. This mirrors the pattern used by GitHub, Stripe, and AWS for their API key management. |
| §6.3 Key Storage | Keys at rest must be encrypted. Symmetric keys must be stored in hardware security modules or equivalent. | Secrets Manager uses AWS KMS for envelope encryption (AES-256). Aurora PostgreSQL stores key hashes (not raw keys). The `encryption_key_id` column supports optional per-key KMS envelope encryption for high-security tenants. | The hash-only storage pattern means the `api_keys` table does not contain any usable secrets. Even with full database access, an attacker cannot reconstruct API keys. The optional KMS envelope encryption adds a second layer for tenants with PCI or HIPAA requirements. |
| §6.4 Key Destruction | When a key is revoked or expired, the key material must be destroyed and must not be recoverable. | Revoked API keys have their `is_active` flag set to false. The key hash remains for audit trail purposes, but since only the hash was ever stored, there is no raw key material to destroy. IAM keys can be permanently deleted via the `delete-access-key` API. | We intentionally keep the key hash after revocation for audit purposes — it allows us to detect if someone tries to use a revoked key (the hash will match, and we can log a "revoked key usage attempt" event). The raw key material was never stored, so there is nothing to destroy on the database side. |

### 2.2 CIS AWS Foundations Benchmark v3.0

The CIS (Center for Internet Security) AWS Foundations Benchmark is a set of security configuration best practices for AWS accounts. It is the most widely used AWS security benchmark and is required by most compliance frameworks. RADIANT enforces four specific CIS controls related to credential management through AWS Config managed rules that run continuously and alert on non-compliance.

| CIS Control | What It Requires | Why It Matters | How RADIANT Enforces It |
|------------|-----------------|---------------|------------------------|
| **1.4 — No root access keys** (`iam-root-access-key-check`) | The AWS root account must not have access keys. Root credentials have unrestricted access to all resources and cannot be scoped down with IAM policies. | A compromised root key gives an attacker complete control of the AWS account, including the ability to delete all resources, change billing, and lock out all other users. Root keys are the single highest-risk credential type. | AWS Config rule `iam-root-access-key-check` evaluates continuously. If a root access key is detected, it triggers a CRITICAL alert via SNS. The Swift Deployer security audit also checks this and flags it as Critical risk with a recommendation to delete the root keys immediately. |
| **1.5 — Root MFA enabled** (`root-account-mfa-enabled`) | The root account must have multi-factor authentication enabled. | Even without access keys, the root account can be accessed via the AWS Console using email + password. MFA adds a second factor that prevents password-only compromise. | AWS Config rule `root-account-mfa-enabled` evaluates continuously. Non-compliance triggers a CRITICAL alert. The Swift Deployer audit checks this in the "Overview" section and shows Root MFA status as a prominent card. |
| **1.12 — No unused credentials** (`iam-user-unused-credentials-check`) | Credentials (passwords and access keys) that have not been used within 45 days should be disabled. | Unused credentials typically belong to former employees, deprecated CI/CD pipelines, or forgotten test accounts. They represent attack surface without business value. If compromised, no one is monitoring their usage to notice. | AWS Config rule with `maxCredentialUsageAge: 45` days. Additionally, the dormant key audit Lambda scans the tenant `api_keys` table with the same logic (30/45/60-day escalation), extending this protection beyond IAM to application-level keys. |
| **1.14 — Key rotation ≤90 days** (`access-keys-rotated`) | IAM access keys must be rotated at least every 90 days. | Long-lived keys accumulate risk over time. The longer a key exists, the more likely it has been copied to insecure locations (developer laptops, CI configs, shared documents). Regular rotation limits the window of exposure. | AWS Config rule with `maxAccessKeyAge: 90` days. The API key auto-rotation Lambda applies the same principle to tenant keys — generating successor keys within the grace period before expiry. The Swift Deployer audit flags any IAM key over 90 days as High risk and any over 365 days as Critical. |

### 2.3 SOC 2 Type II — CC6.1 (Logical and Physical Access Controls)

SOC 2 is the most commonly requested compliance certification for SaaS platforms. Trust Service Criteria CC6.1 covers logical access controls — how the platform manages who and what can access its systems. For RADIANT, this is particularly important because enterprise customers evaluating AI platforms will require SOC 2 attestation before allowing their data to flow through the system.

| SOC 2 Criteria | What Auditors Look For | How RADIANT Demonstrates Compliance |
|---------------|----------------------|-----------------------------------|
| **CC6.1.1 — Credential lifecycle** | Evidence that credentials go through a defined lifecycle: creation → active use → rotation → revocation → destruction. Auditors want to see that no credential exists indefinitely without oversight. | The `api_keys` table tracks the full lifecycle with `created_at`, `last_used_at`, `expires_at`, `revoked_at`, and `revoked_reason`. The `api_key_audit_log` table records every lifecycle event with timestamps. The `replaced_by_key_id` / `replaces_key_id` columns track rotation lineage, proving that keys are rotated rather than just created and forgotten. |
| **CC6.1.3 — Access restrictions** | Evidence that access is restricted to authorized users, from authorized locations, using authorized methods. "Allow everything by default" is a finding; there must be mechanisms to restrict access scope. | API keys support `allowed_ips` (CIDR notation), `allowed_origins` (HTTP origin header), `scopes` (feature-level permissions), and `allowed_endpoints` / `denied_endpoints`. The auth middleware enforces all of these on every request. Tenants can optionally set `require_api_key_ip_restriction = true` to mandate that all new keys have IP restrictions. |
| **CC6.1.5 — Monitoring** | Evidence of continuous monitoring of credential usage patterns. Auditors want to see that the platform detects anomalies, dormancy, and policy violations. | The dormant key audit Lambda runs daily, scanning all active keys for inactivity. CloudWatch metrics track stale key counts, MFA enrollment, and Access Analyzer findings. The monthly IAM report provides a comprehensive credential health summary. All events are published to SNS for alerting. |
| **CC6.1.7 — Revocation** | Evidence that credentials can be revoked immediately when access is no longer needed or when a security event occurs. Revocation must be fast — measured in seconds, not hours. | The revocation API executes in a single database transaction (typically <50ms). The auth middleware checks `is_active` on every request, so a revoked key is rejected on the very next API call. For IAM keys, the `update-access-key --status Inactive` CLI command takes effect immediately across all AWS services. |

### 2.4 AWS Well-Architected — Security Pillar

The AWS Well-Architected Framework Security Pillar defines best practices for securing workloads on AWS. Unlike CIS which focuses on account-level configuration, Well-Architected addresses application-level security architecture. Following these practices means the platform is designed correctly, not just configured correctly.

| Best Practice | What It Means | How RADIANT Implements It |
|--------------|--------------|--------------------------|
| **SEC02-BP01 — Use strong sign-in** | All human users should authenticate with MFA. Programmatic access should use temporary or automatically rotated credentials. | The IAM audit checks MFA enrollment for all IAM users and reports any user without MFA as a compliance finding. The compliance scorecard deducts points for each MFA-less user. The Swift Deployer prominently displays MFA enrollment status. |
| **SEC02-BP02 — Use temporary credentials** | Prefer short-lived credentials (STS tokens, Secrets Manager rotation) over long-lived ones. When long-lived credentials are necessary, rotate them automatically. | DB credentials use Secrets Manager with automatic rotation (30 days in production). The rotation function generates new credentials, updates the Aurora cluster, and manages the AWSCURRENT/AWSPREVIOUS staging labels to ensure zero-downtime rotation. Tenant API keys have mandatory expiry dates. |
| **SEC02-BP04 — Audit and rotate credentials** | Regularly audit all credentials for age, usage, and compliance. Rotate credentials that exceed policy thresholds. | Four scheduled Lambda functions handle this: dormant key audit (daily), API key rotation (daily), JWT signing rotation (30-day), and IAM access report (monthly). The Swift Deployer provides on-demand full audits. |
| **SEC03-BP01 — Define access requirements** | Each credential should have the minimum permissions necessary. Do not use wildcards or overly broad permissions. | API keys have `scopes` (e.g., `["chat", "models"]`), `allowed_endpoints`, and `denied_endpoints`. The CDK-Nag AwsSolutions pack enforces no-wildcard IAM policies at infrastructure level. |
| **SEC03-BP07 — Analyze public/cross-account access** | Continuously analyze resource policies to detect unintended public or cross-account access grants. | IAM Access Analyzer runs as an ACCOUNT-type analyzer, scanning all resource policies (S3 bucket policies, IAM roles, KMS key policies, Lambda function policies, SQS queue policies). New findings trigger EventBridge events that route to the SNS alert topic. |

### 2.5 PCI DSS v4.0 — Requirements 3.6 & 3.7

PCI DSS is relevant when any RADIANT tenant processes, stores, or transmits payment card data. Requirements 3.6 and 3.7 cover cryptographic key management specifically. Even if RADIANT does not directly handle card data, tenants in the financial services sector will require PCI compliance as a condition of using the platform.

| PCI Requirement | What It Requires | How RADIANT Satisfies It |
|----------------|-----------------|------------------------|
| **3.6.1 — Key generation procedures** | Keys must be generated using strong cryptographic methods with documented procedures. | All API keys use `crypto.randomBytes(32)` producing 256 bits of entropy. JWT signing keys use 512 bits. The generation procedure is implemented in code (`createApiKey()` in `handler.ts` and `jwt-signing-rotation.ts`) and documented in this document. The `rad_` prefix ensures keys are identifiable without needing to see the full key. |
| **3.6.4 — Key changes for expired keys** | Expired keys must be replaced. Systems must not allow the use of expired keys. | The auth middleware checks `expires_at` on every request and rejects expired keys with a 401. The auto-rotation Lambda proactively generates successor keys during the grace period (default: 14 days before expiry) so that tenants have time to transition. Keys that pass expiry without rotation are disabled. |
| **3.6.5 — Retirement of old keys** | When keys are replaced, the old key must be tracked and eventually removed. There must be a clear record of which key replaced which. | The `replaced_by_key_id` and `replaces_key_id` columns create a doubly-linked lineage chain. When a key is rotated, the old key record keeps a pointer to its successor, and the new key keeps a pointer to its predecessor. This allows auditors to trace the full rotation history of any key back to its original creation. |
| **3.7.1 — Key management policies** | Documented key management policies must exist and be followed. Policies must cover generation, distribution, storage, rotation, and destruction. | This document IS the key management policy. The `RotationSchedule` struct in the Swift Deployer service codifies the policies as configurable parameters. Each parameter has a default value aligned with the compliance standards and can be adjusted per environment (e.g., more aggressive rotation in production, more relaxed in development). |

### 2.6 ISO 27001:2022 — Annex A.9

ISO 27001 is the international standard for information security management systems (ISMS). Annex A.9 covers access control. For RADIANT, ISO 27001 certification is a requirement for serving enterprise customers in the EU and Asia-Pacific markets, where it is often preferred over SOC 2.

| ISO Control | What It Requires | How RADIANT Satisfies It |
|------------|-----------------|------------------------|
| **A.9.2.1 — User registration and deregistration** | Formal processes for granting and revoking access. Every credential creation and deletion must be logged. | The `createApiKey()` function generates a key, records it in the database, and writes an audit log entry with the creator's user ID, the creation timestamp, and the key's configuration. The `revokeApiKey()` function records the revoker's user ID and reason. |
| **A.9.2.3 — Management of privileged access** | Privileged access must be restricted and monitored more closely than standard access. | API keys have `scopes` that restrict which features they can access. Admin-level operations (e.g., creating tenants, managing billing) are not accessible via tenant API keys regardless of scopes. The root IAM key check and MFA enforcement target the most privileged credentials. |
| **A.9.2.5 — Review of user access rights** | Access rights must be reviewed at regular intervals to ensure they remain appropriate. | The monthly IAM access report Lambda generates a comprehensive review of all IAM credentials, their ages, last usage dates, and associated permissions. This report is published to SNS and provides the evidence that access rights are being reviewed. |
| **A.9.2.6 — Removal or adjustment of access rights** | When access is no longer needed, credentials must be promptly removed. | The dormant key audit Lambda implements automatic removal (disable) for keys that have not been used in 60 days. The three-tier warning system (30→45→60 days) ensures key owners have ample notice. The revocation API allows immediate removal at any time. |
| **A.9.4.2 — Secure log-on procedures** | Authentication mechanisms must be strong and resistant to common attacks. | The auth middleware validates: API key hash (not plaintext comparison), source IP against CIDR allowlists, HTTP origin header, key expiry, and scope permissions. The MFA enforcement check in the IAM audit ensures human users have two-factor authentication. |

---

## 3. Architecture Overview

### 3.1 Defense-in-Depth Model

The security framework follows a **defense-in-depth** architecture, meaning that no single component is relied upon exclusively. If one layer fails or is bypassed, subsequent layers provide additional protection. This is a fundamental security engineering principle — the attacker must defeat multiple independent controls to achieve their objective.

**Layer 1 — Prevention (Developer Workstation):** The pre-commit hook scans all staged files for secret patterns before they can be committed. This prevents the most common credential leak vector: accidental commits of hardcoded secrets. If a developer accidentally pastes an AWS access key into a config file, the commit is blocked with a specific error message explaining which file and pattern triggered the block.

**Layer 2 — Infrastructure Compliance (CDK/AWS):** CDK-Nag scans all CloudFormation templates during synthesis, rejecting any stack that creates overly permissive IAM policies, unencrypted storage, or resources that violate the AwsSolutions rule pack. AWS Config rules run continuously in the account, evaluating IAM configuration against CIS benchmarks. These controls catch misconfigurations that make it past code review.

**Layer 3 — Runtime Enforcement (Auth Middleware):** Every API request passes through the auth middleware, which validates the API key hash against the database, checks IP restrictions, verifies origin restrictions, validates key expiry, and enforces scope-based permissions. This is the real-time enforcement layer — even if a valid key is stolen, IP restrictions can limit where it can be used, and scope restrictions limit what it can access.

**Layer 4 — Automated Hygiene (Scheduled Lambdas):** Daily and monthly scheduled Lambda functions scan for dormant keys, rotate expiring keys, and generate compliance reports. These catch situations where the runtime enforcement layer cannot help — for example, a key that is valid and properly restricted but simply has not been used in two months (suggesting the integration was abandoned but the key was never revoked).

**Layer 5 — Visibility (Monitoring & Alerting):** IAM Access Analyzer, CloudWatch metrics, SNS alerts, and the Swift Deployer audit dashboard provide visibility into the overall credential security posture. This layer does not prevent attacks directly, but it ensures that security teams have the information they need to detect and respond to issues before they become breaches.

### 3.2 Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                      RADIANT Security Framework                       │
│                                                                       │
│  LAYER 1: PREVENTION                                                  │
│  ┌──────────────────────┐   ┌──────────────────────┐                 │
│  │ Pre-Commit Hook      │   │ CDK-Nag AwsSolutions │                 │
│  │ (11 secret patterns) │   │ Pack (prod auto-on)  │                 │
│  │ Blocks: git commit   │   │ Blocks: cdk deploy   │                 │
│  └──────────────────────┘   └──────────────────────┘                 │
│                                                                       │
│  LAYER 2: INFRASTRUCTURE COMPLIANCE                                   │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ AWS Config Managed Rules (continuous evaluation)             │    │
│  │ • iam-user-unused-credentials-check (45d threshold)         │    │
│  │ • access-keys-rotated (90d max age)                         │    │
│  │ • iam-root-access-key-check (no root keys)                  │    │
│  │ • root-account-mfa-enabled (root MFA required)              │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  LAYER 3: RUNTIME ENFORCEMENT                                         │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ Auth Middleware (every API request)                           │    │
│  │                                                               │    │
│  │  Request ──→ Key Hash Lookup ──→ Expiry Check ──→ IP Check   │    │
│  │          ──→ Origin Check ──→ Scope Check ──→ Use Tracking   │    │
│  │          ──→ X-Key-Expires-In Header Injection ──→ Response  │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  LAYER 4: AUTOMATED HYGIENE                                           │
│  ┌────────────────┐ ┌────────────────┐ ┌──────────────────────┐     │
│  │ Dormant Key    │ │ API Key Auto-  │ │ JWT Signing Key      │     │
│  │ Audit Lambda   │ │ Rotation       │ │ Rotation Lambda      │     │
│  │ Daily 02:00    │ │ Lambda         │ │ (Secrets Manager     │     │
│  │                │ │ Daily 03:00    │ │  30-day trigger)     │     │
│  │ 30d warn       │ │                │ │                      │     │
│  │ 45d final      │ │ Grace period   │ │ 4-step protocol:     │     │
│  │ 60d disable    │ │ rotation +     │ │ create → set →       │     │
│  │                │ │ expiry disable │ │ test → finish        │     │
│  └────────┬───────┘ └────────┬───────┘ └──────────┬───────────┘     │
│           │                  │                     │                  │
│           ▼                  ▼                     ▼                  │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    SNS Alert Topic                            │    │
│  │  → Security team email    → PagerDuty/Slack integration      │    │
│  │  → CloudWatch metrics     → Audit log persistence            │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  LAYER 5: VISIBILITY                                                  │
│  ┌────────────────┐ ┌────────────────┐ ┌──────────────────────┐     │
│  │ IAM Access     │ │ Monthly IAM    │ │ Swift Deployer       │     │
│  │ Analyzer       │ │ Report Lambda  │ │ Security Audit       │     │
│  │ (continuous)   │ │ (1st Monday)   │ │ (on-demand)          │     │
│  │                │ │                │ │                      │     │
│  │ Scans: S3, IAM │ │ Generates:     │ │ 7 audit sections     │     │
│  │ KMS, Lambda,   │ │ credential     │ │ 6-standard scoring   │     │
│  │ SQS policies   │ │ age report +   │ │ remediation actions  │     │
│  │                │ │ findings       │ │ CDK deployment       │     │
│  │ → EventBridge  │ │ summary        │ │ schedule config      │     │
│  │   → SNS alert  │ │ → SNS publish  │ │                      │     │
│  └────────────────┘ └────────────────┘ └──────────────────────┘     │
│                                                                       │
│  CLIENT INTEGRATION                                                   │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ TypeScript SDK (packages/sdk/src/client.ts)                  │    │
│  │                                                               │    │
│  │ Response received ──→ Check X-Key-Expires-In header          │    │
│  │   ──→ If days ≤ threshold ──→ Fire onKeyExpiring callback    │    │
│  │   ──→ If callback returns new key ──→ Swap _apiKey atomically│    │
│  │   ──→ Next request uses new key transparently                │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.3 Trust Boundaries

Understanding where trust boundaries exist is critical for security architecture. A trust boundary is a line where the level of trust changes — data crossing a trust boundary must be validated because the sender may not be trustworthy.

**Boundary 1 — Internet → API Gateway:** All tenant API requests cross this boundary. The auth middleware is the primary gatekeeper. Every request must present a valid API key, and that key is validated against the database with all restriction checks. No request is trusted by default.

**Boundary 2 — API Gateway → Aurora Database:** The Lambda functions use IAM authentication to connect to Aurora via RDS Proxy. The RLS (Row-Level Security) policy ensures that even if a Lambda function is compromised, it can only access data for the tenant whose context was set at the beginning of the transaction.

**Boundary 3 — Lambda → Secrets Manager / KMS:** Secrets Manager calls require IAM permissions that are scoped to specific secret ARNs. The CDK stack grants each Lambda only the minimum permissions needed (e.g., the rotation Lambda can rotate secrets but cannot delete them).

**Boundary 4 — Swift Deployer → AWS APIs:** The Swift Deployer runs on the administrator's macOS machine and uses IAM credentials stored in the local Keychain or 1Password. These credentials have broad permissions (necessary for infrastructure management), which is why the framework includes monitoring for these high-privilege credentials.

---

## 4. Phase A — Zero-Code Storage & Static Analysis

### 4.1 Pre-Commit Hook (`.husky/pre-commit`)

The pre-commit hook is the first line of defense against credential leaks. It runs automatically every time a developer runs `git commit`, scanning all staged files against 11 regular expression patterns. If any pattern matches, the commit is blocked and the developer sees an error message identifying the exact file and pattern that triggered the block.

**Why a pre-commit hook instead of a CI/CD check?** CI/CD checks run after the code is already pushed to the remote repository. By that point, the secret is already in the git history and must be rotated. Pre-commit hooks prevent the secret from ever entering the repository in the first place. Both layers should exist, but the pre-commit hook is the more important one because it prevents the problem rather than detecting it after the fact.

**How it works internally:** The hook uses `git diff --cached --name-only --diff-filter=ACM` to get the list of staged files (Added, Changed, Modified). For each file, it runs the staged content through `grep -nE` with each pattern. Binary files, lock files, and `node_modules` are excluded to avoid false positives. If any pattern matches, the commit is rejected with a message like:

```
SECURITY: Potential secret detected in src/config.ts
Pattern: AWS Access Key ID (AKIA...)
Line 42: accessKeyId: "AKIAIOSFODNN7EXAMPLE"

Remove the secret and use environment variables or AWS Secrets Manager instead.
To bypass in emergencies: git commit --no-verify (NOT recommended)
```

The 11 pattern categories are:

| # | Pattern Category | Regex | Why This Pattern Exists | False Positive Handling |
|---|-----------------|-------|------------------------|------------------------|
| 1 | AWS Access Key ID | `AKIA[0-9A-Z]{16}` | All AWS access key IDs start with `AKIA` followed by exactly 16 uppercase alphanumeric characters. This is extremely specific and produces almost zero false positives. | Very rare false positives. If a test file contains the AWS-documented example key `AKIAIOSFODNN7EXAMPLE`, add it to the hook's allowlist. |
| 2 | AWS Secret Access Key | `[0-9a-zA-Z/+=]{40}` (after `aws_secret`) | AWS secret keys are exactly 40 characters of Base64. The hook requires the nearby presence of `aws_secret` or similar context words to avoid matching arbitrary 40-character strings. | If you have a legitimate 40-character Base64 string near the word "secret" in documentation, restructure the text or use the `--no-verify` escape hatch. |
| 3 | RSA/EC Private Keys | `-----BEGIN (RSA\|EC\|OPENSSH) PRIVATE KEY-----` | PEM-encoded private keys have a distinctive header. Private keys should never be in source code — they belong in Secrets Manager, the Keychain, or 1Password. | Essentially zero false positives. This header only appears in actual private key files. |
| 4 | JWT Tokens | `eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]+` | JWTs are Base64URL-encoded and always start with `eyJ` (the Base64 encoding of `{"`) in both the header and payload segments. A hardcoded JWT in source code typically means a test token that may have been generated with a real signing key. | Test JWTs with `{"alg":"none"}` will still match. If your tests use static JWTs, place them in a dedicated test fixtures file and add that file to the hook's exclusion list. |
| 5 | Generic Passwords | `password\s*[:=]\s*['"][^'"]{8,}` | Catches assignments like `password = "myS3cretPass"` or `password: "dbpassword123"`. The 8-character minimum avoids matching `password = ""` or short placeholder values. | May match documentation examples. If writing docs that show password fields, use obviously fake values like `password = "REPLACE_ME"` (which is under 8 chars). |
| 6 | Database Connection Strings | `(postgres\|mysql\|mongodb)://[^\\s]+:[^\\s]+@` | Connection strings with embedded credentials are one of the most common leak patterns. The regex looks for the `protocol://user:password@host` pattern. | May match example connection strings in documentation. Use placeholder values: `postgres://user:PASSWORD@host`. |
| 7 | API Keys (generic) | `api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{20,}` | Catches patterns like `apiKey = "sk_live_abc123..."` or `api_key: "key_abc123..."`. The 20-character minimum distinguishes real keys from short placeholder values. | Most false positives come from configuration templates that use example keys. Use environment variable references instead: `apiKey = process.env.API_KEY`. |
| 8 | Bearer Tokens | `Bearer\s+[A-Za-z0-9-._~+/]+=*` | Catches hardcoded authorization headers like `Authorization: Bearer eyJ...`. These should always reference environment variables or credential stores. | May match API documentation. Use `Bearer $TOKEN` or `Bearer <your-token-here>` in docs. |
| 9 | Slack/Discord Webhooks | `https://hooks\.(slack\|discord)\.com/` | Webhook URLs are credentials — anyone with the URL can post messages to the channel. They should be stored in Secrets Manager or environment variables. | Almost zero false positives. These URLs only appear when they are actual webhook URLs. |
| 10 | Generic High-Entropy | `[A-Za-z0-9+/]{64,}` (in assignments) | Catches long Base64-encoded strings that are likely encryption keys, tokens, or other secrets. The 64-character minimum targets 384+ bit values which are almost always cryptographic material. | May match Base64-encoded images or large constants. If legitimate, move the value to an environment variable or add the specific file to the exclusion list. |
| 11 | Hex Tokens | `[0-9a-f]{64}` (in assignments) | Catches 256-bit hex-encoded values like SHA-256 hashes used as API keys or encryption keys. When these appear in assignments (not comments), they are likely hardcoded secrets. | May match content-addressable hashes (like git commit SHAs in tests). The "in assignments" context check reduces false positives. |

**Bypassing the hook:** In genuine emergencies, developers can use `git commit --no-verify` to skip the hook. This should be extremely rare and should trigger a follow-up review. The hook logs bypass attempts to help security teams track when it is being circumvented.

### 4.2 CDK-Nag (`cdk-nag` AwsSolutions Pack)

CDK-Nag is a static analysis tool for AWS CDK that checks CloudFormation templates against security best practices during the `cdk synth` (synthesis) phase. It catches security misconfigurations before they are deployed, similar to how a linter catches code issues before they are committed.

The AwsSolutions rule pack is the most comprehensive of the available packs, covering 100+ checks across IAM, networking, storage, compute, and encryption. RADIANT enables it automatically in production and optionally in other environments:

```typescript
if (environment === 'prod' || app.node.tryGetContext('enableCdkNag') === 'true') {
  Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
}
```

**Why production-only by default?** During development, engineers frequently need to iterate quickly and may create temporary resources with broad permissions. Enforcing CDK-Nag in dev would slow iteration without proportional security benefit (since dev environments do not contain real data). However, any change that passes through the production deployment pipeline must pass CDK-Nag. Engineers can opt into CDK-Nag in dev by passing `-c enableCdkNag=true`.

**Key checks enforced and why they matter:**

- **AwsSolutions-IAM4** (No managed admin policies): Prevents attaching AWS-managed admin policies like `AdministratorAccess` or `PowerUserAccess` to roles. These policies grant far more permissions than any Lambda function or service needs. Every role should have a custom inline policy with exactly the permissions required.

- **AwsSolutions-IAM5** (No wildcard permissions): Prevents `Action: *` or `Resource: *` in IAM policies. Wildcard permissions violate the principle of least privilege and mean that a compromised function can access any resource in the account. Every permission must specify the exact actions and resource ARNs.

- **AwsSolutions-S1** (S3 access logging enabled): Requires that all S3 buckets have server access logging enabled. Without logging, there is no way to detect unauthorized access to bucket contents. This is particularly important for buckets that store tenant data or model artifacts.

- **AwsSolutions-RDS10** (Deletion protection on Aurora): Prevents accidental deletion of the Aurora database cluster. In production, the database contains all tenant data — accidental deletion would be catastrophic. This check ensures the protection is explicitly enabled in the CDK stack.

- **AwsSolutions-SM1** (Secrets Manager rotation enabled): Requires that all Secrets Manager secrets have automatic rotation configured. Secrets without rotation will never change, accumulating risk over time. This check catches secrets that were created manually or by other stacks without rotation.

**Handling CDK-Nag findings:** When CDK-Nag blocks a deployment, the finding will identify the specific resource and rule that was violated. There are two proper responses:

1. **Fix the issue** — modify the CDK stack to comply with the rule. This is always preferred.
2. **Suppress with justification** — if the rule does not apply to a specific resource (e.g., an S3 bucket that intentionally has no access logging because it is a CDK staging bucket), you can add a suppression with a documented justification:

```typescript
NagSuppressions.addResourceSuppressions(myBucket, [
  { id: 'AwsSolutions-S1', reason: 'CDK staging bucket, no sensitive data, automatically cleaned up' }
]);
```

Every suppression must have a `reason` field that explains why the exception is acceptable. These suppressions are reviewed during security audits.

### 4.3 AWS Config Rules

AWS Config rules provide continuous, automatic evaluation of AWS resource configurations against defined policies. Unlike CDK-Nag (which checks at deployment time), Config rules check the live state of the account continuously. This catches drift — situations where a resource was modified after deployment (e.g., someone manually created an IAM access key through the AWS Console).

Four managed rules are deployed via the `CredentialLifecycleStack`. Each rule evaluates automatically whenever the relevant resource type changes, and also on a periodic schedule (typically every 24 hours):

| Rule | AWS Config Rule ID | Threshold | What It Evaluates | What Happens on Non-Compliance |
|------|-------------------|-----------|-------------------|-------------------------------|
| Unused credentials | `iam-user-unused-credentials-check` | 45 days | For each IAM user, checks when their password and access keys were last used. If any credential has not been used in 45 days, the resource is marked NON_COMPLIANT. | An SNS notification is sent to the security team. The Swift Deployer audit will show this user's key with a "Medium" or "High" risk level depending on the dormancy duration. The security team should investigate whether the credential is still needed and disable it if not. |
| Key rotation | `access-keys-rotated` | 90 days max age | For each active IAM access key, checks the `CreateDate`. If the key was created more than 90 days ago and has not been rotated (i.e., a new key was not created for the same user), the resource is marked NON_COMPLIANT. | An SNS notification is sent. The Swift Deployer audit flags this key as "High" risk. The key owner should rotate the key — either manually through the AWS Console, via the AWS CLI, or using the Swift Deployer's remediation menu. |
| Root key check | `iam-root-access-key-check` | Any root key exists | Checks whether the AWS root account has any active access keys. The root account should never have access keys because root credentials cannot be scoped down with IAM policies. | A CRITICAL SNS notification is sent immediately. This is the highest-severity finding because a compromised root key provides unrestricted access to the entire AWS account. The root access keys should be deleted immediately through the AWS Console (not CLI, since using the root key to delete itself creates a chicken-and-egg situation). |
| Root MFA | `root-account-mfa-enabled` | MFA not enabled | Checks whether the root account has a virtual MFA device or hardware MFA token configured. | A CRITICAL SNS notification is sent. Root MFA should be enabled immediately using a hardware TOTP token (YubiKey or similar) stored in a physical safe. Do not use a virtual MFA app on a phone that could be lost or compromised. |

**How Config rules differ from the dormant key Lambda:** AWS Config rules only evaluate IAM-level resources (IAM users, access keys, roles). They cannot see application-level credentials like tenant API keys stored in Aurora PostgreSQL. The dormant key audit Lambda extends the same dormancy detection to application-level credentials, providing complete coverage across both infrastructure and application layers.

---

## 5. Phase B — Key Restrictions & DB Credential Rotation

### 5.1 Database Migration (`V2026_02_10_001`)

This migration extends the `api_keys` and `tenants` tables with the columns necessary for restriction enforcement, dormant key tracking, and rotation lineage. Understanding why each column exists and how it is used is important for anyone maintaining or extending the schema.

**New columns on `api_keys` table:**

| Column | Type | Purpose | Used By | Standard |
|--------|------|---------|---------|----------|
| `allowed_ips` | `JSONB` | Array of CIDR strings (e.g., `["10.0.0.0/8", "192.168.1.0/24"]`). When non-null, the auth middleware will reject any request from an IP not covered by at least one CIDR range in the array. This enables tenants to lock API keys to specific networks (e.g., their office IP range or VPN egress). | Auth middleware `isIpInCidr()` function; admin UI restrictions dialog | SOC2 CC6.1.3 |
| `allowed_origins` | `JSONB` | Array of HTTP origin strings (e.g., `["https://app.example.com", "https://staging.example.com"]`). When non-null, the middleware checks the `Origin` header of the request and rejects any origin not in the list. This is primarily used for browser-based integrations where the API key is exposed in client-side JavaScript. | Auth middleware origin check; admin UI restrictions dialog | SOC2 CC6.1.3 |
| `encryption_key_id` | `VARCHAR(128)` | Optional reference to a KMS key ID for envelope encryption. When set, the key hash stored in the database is itself encrypted with this KMS key, adding a second encryption layer. This is intended for high-security tenants (HIPAA, PCI) who require that even the hash is not accessible without the KMS key. | Key validation function (must decrypt hash before comparison) | NIST 800-57 §6.3 |
| `dormant_flagged_at` | `TIMESTAMPTZ` | Timestamp of when the key was first flagged as dormant by the dormant key audit Lambda. This is set when the key crosses the 30-day inactivity threshold. If the key is subsequently used, this field is cleared (set to NULL) by the `validate_api_key_with_restrictions()` function. | Dormant key audit Lambda; validation function (clears on use) | CIS AWS 1.12 |
| `dormant_warning_level` | `VARCHAR(10)` | Current warning stage: `'30d'`, `'45d'`, or `'60d'`. Escalated by the dormant key audit Lambda. When the level reaches `'60d'`, the Lambda sets `is_active = false`. If the key is used before reaching 60 days, both `dormant_flagged_at` and `dormant_warning_level` are cleared. | Dormant key audit Lambda; admin UI dormant indicators | CIS AWS 1.12 |
| `replaced_by_key_id` | `UUID FK` | Points to the successor key that replaced this one during rotation. When a key is rotated, the old key's `replaced_by_key_id` is set to the new key's UUID. This creates a forward pointer in the rotation chain that auditors can follow to see "this old key was replaced by this new key." | `rotate_api_key()` DB function; admin UI rotation lineage | PCI DSS 3.6.5 |
| `replaces_key_id` | `UUID FK` | Points to the predecessor key that this key replaced. This is the reverse pointer — it tells you "this new key was created as a replacement for this old key." Together with `replaced_by_key_id`, this creates a doubly-linked list of the full rotation history. | `rotate_api_key()` DB function; auto-rotation Lambda | PCI DSS 3.6.5 |

**New columns on `tenants` table:**

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `api_key_default_expiry_days` | `INTEGER` | 90 | When a new API key is created without an explicit expiry, this value is used. 90 days aligns with NIST cryptoperiod recommendations and CIS benchmark requirements. Tenants can adjust this downward for more aggressive security or upward for integrations that cannot easily rotate keys. |
| `api_key_max_expiry_days` | `INTEGER` | 365 | Hard ceiling on how long any API key can live, regardless of what the tenant requests during creation. This prevents tenants from creating keys with indefinite or excessively long lifetimes. Even for embedded integrations, one year is the maximum. |
| `require_api_key_ip_restriction` | `BOOLEAN` | false | When true, all new API key creation requests for this tenant must include at least one CIDR in `allowed_ips`. This is a tenant-level policy that can be enabled for high-security tenants who want to ensure no unrestricted keys are ever created. |

**New database functions:**

**`validate_api_key_with_restrictions(p_key_hash, p_source_ip, p_origin, p_interface_type, p_endpoint)`** — This function replaces the simpler key validation that existed before. It performs a single-query validation that checks all restriction dimensions in one database round trip:

1. Looks up the key by hash and verifies `is_active = true` and `revoked_at IS NULL`
2. Checks `expires_at > NOW()` — rejects expired keys immediately
3. If `allowed_ips` is non-null, checks `p_source_ip::inet <<= ANY(allowed_ips::inet[])` — this uses PostgreSQL's native inet containment operator which correctly handles CIDR range matching (e.g., `192.168.1.50` is contained within `192.168.1.0/24`)
4. If `allowed_origins` is non-null, checks `p_origin = ANY(allowed_origins)` — exact string match
5. If `interface_type` is set on the key, verifies it matches `p_interface_type`
6. Checks `allowed_endpoints` and `denied_endpoints` against `p_endpoint`
7. On successful validation: updates `last_used_at = NOW()`, increments `use_count`, and clears any dormant flags (`dormant_flagged_at = NULL`, `dormant_warning_level = NULL`)
8. Returns the full key record including `tenant_id`, `scopes`, and `expires_at` for the middleware to use

The single-query approach is important for performance — every API request goes through this function, and adding multiple sequential queries would increase latency.

**`rotate_api_key(p_old_key_id, p_tenant_id, p_new_key_hash, p_new_key_prefix, p_created_by)`** — This function performs an atomic key rotation within a single transaction:

1. Generates a new UUID for the successor key
2. Copies all permissions, scopes, restrictions, and expiry policy from the old key to the new key
3. Sets `replaces_key_id` on the new key pointing to the old key
4. Sets `replaced_by_key_id` on the old key pointing to the new key
5. Inserts an audit log entry recording the rotation event with both key IDs
6. Returns the new key's UUID and prefix

The transaction guarantees that either the full rotation completes or nothing changes — there is no window where both keys are in an inconsistent state.

### 5.2 Auth Middleware Enforcement

**File:** `lambda/shared/middleware/auth.ts`

The auth middleware is the runtime enforcement layer that validates every API request. It sits between API Gateway and the Lambda handler, executing before any business logic runs. If any check fails, the request is rejected immediately and the business logic never executes.

The enforcement order is deliberate — checks are ordered from cheapest to most expensive, and from most likely to fail to least likely:

**Step 1 — Extract and hash the API key:** The key is extracted from the `Authorization: Bearer <key>` header or the `x-api-key` header. The raw key is immediately hashed with SHA-256 to produce the lookup hash. The raw key is never logged, stored, or passed to any other function.

**Step 2 — Database validation:** The `validate_api_key_with_restrictions()` function is called with the hash, source IP, origin, and endpoint. If the key is not found, expired, inactive, or revoked, the function returns null and the middleware responds with `401 Unauthorized`. If IP or origin checks fail, it responds with `403 Forbidden` with a specific message explaining which restriction was violated (e.g., "Source IP 203.0.113.50 not in allowed list").

**Step 3 — Scope enforcement:** After the database returns the key record with its `scopes` array, the middleware checks whether the requested endpoint is allowed by the key's scope configuration. For example, a key with `scopes: ["chat"]` can access `/api/v1/chat/completions` but not `/api/v1/admin/users`.

**Step 4 — Expiry header injection:** If the key has an `expires_at` date, the middleware calculates the number of days remaining and injects the `X-Key-Expires-In` response header. The format is a simple integer representing days (e.g., `X-Key-Expires-In: 14`). This header is what the SDK's auto-rotation mechanism reads to decide when to trigger the `onKeyExpiring` callback.

The header is injected on every successful response, not just when the key is close to expiry. This allows clients to monitor key health even when rotation is not imminent. When the key has no expiry, the header is omitted.

**Step 5 — Use count tracking:** The `validate_api_key_with_restrictions()` function atomically increments the `use_count` field on each successful validation. This counter serves two purposes: (1) it provides usage analytics visible in the admin UI, and (2) it resets the dormant key timer — any successful validation clears the dormant flags, preventing active keys from being flagged.

### 5.3 DB Credential Auto-Rotation

Database credentials have the highest blast radius of any credential type in RADIANT — they provide direct access to all tenant data stored in Aurora PostgreSQL. For this reason, DB credentials rotate more frequently than any other credential type.

**How Secrets Manager rotation works:** AWS Secrets Manager provides a native rotation mechanism that uses a Lambda function to generate new credentials and update the database. The rotation follows a multi-step process designed to ensure zero downtime:

1. **AWSCURRENT** is the credential that all applications use right now
2. When rotation triggers, a new credential is generated and stored as **AWSPENDING**
3. The rotation Lambda updates the Aurora cluster to accept the new credential
4. The new credential is tested (can it actually connect?)
5. **AWSPENDING** is promoted to **AWSCURRENT**, and the old **AWSCURRENT** becomes **AWSPREVIOUS**
6. Applications using Secrets Manager automatically pick up the new credential on their next secret fetch

**Why 30 days in production, 90 days in dev:** Production environments contain real tenant data and are the primary target for attackers. A 30-day rotation interval means that even if a credential is somehow exposed, it has a maximum useful lifetime of 30 days. In development environments, the data is synthetic and the security risk is much lower, so 90-day rotation reduces operational noise without meaningful risk increase.

**RDS Proxy integration:** RADIANT uses RDS Proxy to manage database connections. RDS Proxy handles the credential rotation transparently — when Secrets Manager rotates the credential, RDS Proxy detects the change and establishes new connections with the new credential without disrupting existing connections. This is what makes zero-downtime rotation possible.

**Configuration in `CredentialLifecycleStack`:**
```typescript
// Production: 30-day rotation
// Dev/Staging: 90-day rotation
const rotationDays = environment === 'prod' ? 30 : 90;
cluster.secret?.addRotationSchedule('DbCredentialRotation', {
  automaticallyAfter: Duration.days(rotationDays),
});
```

---

## 6. Phase C — Mandatory Rotation & Dormant Key Cleanup

### 6.1 Dormant Key Audit Lambda (`dormant-key-audit.ts`)

**Schedule:** Daily at 02:00 UTC (chosen to run during off-peak hours to minimize database load)

**Why dormant keys are dangerous:** A key that is not being used serves no business purpose, but it still has full access to whatever its scopes allow. Dormant keys typically arise when a developer creates a key for testing, a vendor integration is decommissioned, or an employee leaves. Because no one is actively using the key, no one notices if it is compromised. An attacker who finds a dormant key can use it without triggering the usage pattern anomalies that might alert the key's owner.

**The three-tier escalation model:** Rather than immediately disabling dormant keys (which would risk breaking integrations that are used infrequently, like monthly batch jobs), the Lambda uses a graduated escalation that gives key owners multiple opportunities to either use the key or acknowledge it:

| Days Since Last Use | What the Lambda Does | SNS Event Type | What the Key Owner Should Do |
|---------------------|---------------------|----------------|------------------------------|
| **30 days** | Sets `dormant_flagged_at = NOW()` and `dormant_warning_level = '30d'` on the key. Sends a notification to the SNS alert topic with the key ID, tenant, and last-used date. | `KEY_DORMANT_WARNING` | Check if the integration is still needed. If yes, make an API call to reset the dormant timer. If no, revoke the key proactively. |
| **45 days** | Updates `dormant_warning_level = '45d'`. Sends a final warning notification with an explicit statement that the key will be auto-disabled in 15 days if not used. | `KEY_FINAL_WARNING` | This is the last chance. The key will be disabled in 15 days. If the integration is needed, use the key or contact support. If not needed, revoke it. |
| **60 days** | Sets `is_active = false` and `dormant_warning_level = '60d'`. The key is now disabled and cannot be used for any API calls. Sends a notification confirming the key has been disabled. An audit log entry is created with action `auto_disabled` and reason `dormant_60d`. | `KEY_AUTO_DISABLED` | If the key is still needed, an admin can re-enable it via the admin UI or API. The 60-day timer will restart from the re-enable date. If not needed, the key should be formally revoked. |

**Resetting the dormant timer:** The `validate_api_key_with_restrictions()` database function clears both `dormant_flagged_at` and `dormant_warning_level` on every successful key validation. This means that a single successful API call at any point during the 60-day window resets the entire escalation back to zero. This is intentional — a key that is used even once in a 30-day period is not dormant.

**Edge case — monthly batch jobs:** Some legitimate integrations only run monthly (e.g., billing reconciliation, compliance reports). A 30-day dormant threshold would flag these keys every cycle. The recommended approach is to have the batch job make a lightweight "heartbeat" API call (e.g., `GET /api/v1/health`) at least once every 25 days to keep the key active. Alternatively, the tenant can adjust their key's scope to include only the specific endpoints needed for the batch job, limiting the blast radius.

### 6.2 API Key Auto-Rotation Lambda (`api-key-rotation.ts`)

**Schedule:** Daily at 03:00 UTC (one hour after the dormant key audit to avoid database contention)

**The problem this solves:** Keys with expiry dates will eventually expire and stop working. If the key owner forgets to rotate before expiry, their integration breaks. The auto-rotation Lambda proactively generates a successor key during the grace period (default: 14 days before expiry), giving the key owner time to transition to the new key without any service interruption.

**How the grace period works:** When a key is within the grace period (e.g., 14 days before its `expires_at` date), the Lambda generates a new key with identical scopes, restrictions, and expiry policy. The new key immediately becomes active and usable. The old key also remains active until its `expires_at` date. This overlap window is the grace period — both the old and new keys work simultaneously, allowing the key owner to deploy the new key at their convenience without downtime.

**The full daily execution flow:**

1. **Query for keys entering grace period:** `SELECT * FROM api_keys WHERE is_active = true AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '14 days' AND replaced_by_key_id IS NULL` — finds active keys that are expiring within the grace period and have not already been rotated (the `replaced_by_key_id IS NULL` check prevents generating multiple successors for the same key).

2. **Generate successor keys:** For each key found, the Lambda:
   - Generates a new 256-bit random key using `crypto.randomBytes(32)`
   - Hashes it with SHA-256 for storage
   - Calls `rotate_api_key()` database function to atomically create the successor and link the lineage
   - Publishes a `KEY_AUTO_ROTATED` event to SNS with both the old key ID and new key prefix (not the full key — the full key is only available to the SDK via the `X-Key-Expires-In` → `onKeyExpiring` flow)

3. **Disable expired keys:** `SELECT * FROM api_keys WHERE is_active = true AND expires_at < NOW()` — finds active keys that have passed their expiry date. For each one, the Lambda sets `is_active = false` and publishes a `KEY_EXPIRED` event. After this point, any API request using the expired key will receive a `401 Unauthorized`.

4. **Send upcoming expiry notifications:** `SELECT * FROM api_keys WHERE is_active = true AND expires_at BETWEEN NOW() + INTERVAL '14 days' AND NOW() + INTERVAL '21 days' AND replaced_by_key_id IS NULL` — finds keys that will enter the grace period within the next 7 days. Sends a `KEY_EXPIRY_UPCOMING` notification as an early heads-up.

**Why the Lambda runs daily instead of on-demand:** A daily schedule ensures that no key can expire without being processed. If the Lambda ran on-demand (e.g., triggered by an EventBridge cron expression that fires weekly), there could be a window where a key expires between runs. Daily execution with the 14-day grace period means the Lambda has at least 14 opportunities to catch and rotate an expiring key.

### 6.3 JWT Signing Rotation Lambda (`jwt-signing-rotation.ts`)

**Trigger:** AWS Secrets Manager rotation schedule (every 30 days)

**Why JWT signing keys need special handling:** JWT signing keys are different from API keys because they have a downstream dependency — existing JWTs that were signed with the old key. If you simply replace the signing key, every JWT signed with the old key immediately becomes invalid, causing mass authentication failures across all tenants. The solution is the **dual-key validation window**.

**The four-step Secrets Manager rotation protocol:** Secrets Manager requires rotation Lambda functions to implement exactly four steps, called in sequence. Each step is idempotent (can be called multiple times safely) and the process can be restarted from any step if a failure occurs:

**Step 1 — `createSecret`:** The Lambda generates a new 512-bit (64-byte) random HMAC key using `crypto.randomBytes(64)`. This key is stored in Secrets Manager with the version stage `AWSPENDING`. The existing production key remains as `AWSCURRENT` and continues to be used for all new JWT signatures. No JWT validation is affected at this point.

The 512-bit key size is significant — it exceeds the HMAC-SHA256 block size of 512 bits, ensuring maximum security margin. Shorter keys would work functionally but would not meet NIST SP 800-107 recommendations for HMAC key lengths.

**Step 2 — `setSecret`:** In many rotation scenarios, this step would update an external system (like a database password). For JWT signing keys, there is no external system to update — the key is only used by RADIANT's own Lambda functions that read it from Secrets Manager. This step is essentially a no-op for this use case, but it must exist to satisfy the Secrets Manager protocol.

**Step 3 — `testSecret`:** The Lambda retrieves the `AWSPENDING` key and performs a full sign-verify cycle: it creates a test JWT payload, signs it with the new key, then verifies the signature. If the verification fails (which would indicate a corrupt key or a code bug), the rotation is aborted. This step catches problems before the key is promoted to production.

**Step 4 — `finishSecret`:** The Lambda promotes `AWSPENDING` to `AWSCURRENT`, and the previous `AWSCURRENT` automatically becomes `AWSPREVIOUS`. From this moment forward, all new JWTs are signed with the new key. The old key remains available as `AWSPREVIOUS` for validation of existing tokens.

**The dual-key validation window explained:** After rotation, the JWT verification logic in the auth layer works as follows:

1. Attempt to verify the JWT using `AWSCURRENT` (the new key)
2. If verification fails, attempt to verify using `AWSPREVIOUS` (the old key)
3. If both fail, the JWT is invalid

This means that JWTs signed with the old key remain valid until either (a) the JWT's own `exp` claim expires, or (b) the *next* rotation occurs (which would push the old key off the `AWSPREVIOUS` stage entirely). With a 30-day rotation interval and typical JWT expiry of 24 hours, the dual-key window is more than sufficient.

### 6.4 Self-Service Rotation API

**Endpoint:** `POST /api/v1/tenant/keys/{keyId}/rotate`

**Why self-service rotation matters:** In a multi-tenant platform, the platform operator cannot know when each tenant wants to rotate their keys. Requiring tenants to contact support to rotate a key creates friction that discourages good security hygiene. Self-service rotation makes it as easy as a single API call.

**How it works:**

1. The tenant authenticates with their existing API key or admin token
2. The request specifies which key to rotate (by `keyId`)
3. The Lambda calls the `rotate_api_key()` database function, which atomically creates the successor key and links the lineage
4. The response includes the new key's raw value (returned exactly once — it will never be shown again)
5. The old key remains active until its original `expires_at` date, giving the tenant time to deploy the new key

**Response:**
```json
{
  "success": true,
  "new_key": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "raw_key": "rad_7Bx9kQ2mN...",
    "prefix": "rad_7Bx9kQ",
    "replaces_key_id": "old-key-uuid",
    "expires_at": "2026-05-11T00:00:00Z"
  },
  "warning": "Store this key securely. It will not be shown again."
}
```

**Security considerations:**
- The rotation endpoint requires authentication with a key that has `admin` scope or with the specific key being rotated (a key can rotate itself)
- The old key is NOT immediately disabled — this is intentional to allow graceful transition
- The audit log records who initiated the rotation and the lineage chain
- Rate limiting prevents abuse (max 10 rotations per key per day)

---

## 7. Phase D — Least Privilege & Observability

### 7.1 IAM Access Analyzer

**What IAM Access Analyzer does:** IAM Access Analyzer is an AWS service that continuously analyzes resource-based policies (S3 bucket policies, IAM role trust policies, KMS key policies, Lambda function policies, SQS queue policies, and Secrets Manager resource policies) to identify resources that are shared with external principals. In plain terms, it answers the question: "Which of my resources can be accessed by someone outside my AWS account?"

This is critical because over-permissive resource policies are one of the most common misconfigurations in AWS environments. A developer might add a bucket policy that grants `s3:GetObject` to `*` (everyone on the internet) without realizing it, or an IAM role trust policy might allow cross-account access from an account that was meant to be temporary.

**How it is deployed:** The `CredentialLifecycleStack` creates an `ACCOUNT`-type analyzer (as opposed to `ORGANIZATION`-type, which would analyze across all accounts in an AWS Organization). The account-level analyzer is sufficient for RADIANT because each environment runs in its own AWS account.

**Real-time alerting flow:**
1. Access Analyzer detects a new finding (e.g., an S3 bucket with public access)
2. The finding generates an EventBridge event of type `access-analyzer.amazonaws.com` with detail type `Access Analyzer Finding`
3. An EventBridge rule in the `CredentialLifecycleStack` matches this event and routes it to the SNS alert topic
4. The security team receives an immediate email/Slack notification with the finding details
5. The finding appears in the Swift Deployer's "Access Analyzer" audit section on the next audit run

**Finding types and what to do about them:**
- **Public access** (isPublic: true) — A resource is accessible from the internet. This is almost always a misconfiguration and should be fixed immediately. The exception is intentionally public resources like a static website hosting bucket, which should have a documented suppression.
- **Cross-account access** — A resource can be accessed from another AWS account. Verify that the cross-account access is intentional (e.g., a shared logging bucket) and document it. If not intentional, remove the cross-account principal from the resource policy.
- **External principal** — An IAM role can be assumed by a principal outside the account. This is common for third-party integrations but should be reviewed to ensure the trust relationship is still needed.

### 7.2 Monthly IAM Report Lambda (`iam-access-report.ts`)

**Schedule:** First Monday of each month at 06:00 UTC

**Why a monthly report in addition to daily checks?** The daily Lambda functions (dormant key audit, auto-rotation) handle operational concerns — individual keys that need attention. The monthly report provides a strategic overview of the entire credential security posture, suitable for sharing with management, compliance auditors, or security committees. It answers high-level questions like "how many stale keys do we have?", "is MFA enrollment improving or declining?", and "are we trending toward or away from compliance?"

**What the report contains and how to interpret each section:**

**Section 1 — IAM Credential Summary:** The Lambda generates an IAM credential report (via `iam generate-credential-report`) and parses the CSV to extract:
- Total number of IAM users
- Number of users with console access (password enabled)
- Number of users with programmatic access (access keys)
- Number of access keys per user (AWS allows max 2 per user)
- Number of users with MFA enabled vs. disabled

*What to look for:* Any user without MFA is a compliance finding. Users with two active access keys may have forgotten to deactivate the old one after rotation. Users with console access who have not logged in recently may be candidates for deprovisioning.

**Section 2 — Access Key Age Analysis:** For each active access key, the report calculates:
- Age in days (from `CreateDate`)
- Days since last use (from `get-access-key-last-used`)
- Last service used and region
- Risk classification: Info (<60d), Medium (60-90d), High (90-365d), Critical (>365d)

*What to look for:* Any key over 90 days old should have a documented justification or should be rotated. Keys over 365 days old are Critical findings that should be escalated immediately. Keys that have never been used are strong candidates for deletion.

**Section 3 — Access Analyzer Findings Summary:** Aggregates all active Access Analyzer findings by resource type and public/cross-account classification. Shows counts and trends compared to the previous month's report (if available).

*What to look for:* Any increase in public access findings. New cross-account findings that were not present in the previous report. Findings that have been active for more than 30 days without being resolved or archived.

**Section 4 — Recommendations:** Based on the analysis, the report generates prioritized recommendations such as:
- "CRITICAL: 2 access keys older than 365 days. Rotate immediately."
- "HIGH: 3 users without MFA. Enable MFA before next audit."
- "MEDIUM: 5 keys unused for 30+ days. Investigate and disable if not needed."

**Section 5 — CloudWatch Metrics:** The Lambda publishes metrics to the `RADIANT/Security` namespace:
- `StaleAccessKeys` — count of keys older than 90 days
- `AccessAnalyzerFindings` — count of active findings
- `MfaDisabledUsers` — count of users without MFA
- These metrics can be used in CloudWatch dashboards and alarms for continuous monitoring between monthly reports.

### 7.3 Admin Dashboard UI

**Path:** `apps/admin-dashboard/app/(dashboard)/api-keys/page.tsx`

The admin dashboard API keys page provides a web-based interface for managing tenant API keys. The security framework added three capabilities to the existing page:

**Rotate Key:** Each key row has a dropdown menu with a "Rotate Key" option. Clicking it triggers a mutation that calls `POST /api/admin/api-keys/{id}/rotate`. If successful, a dialog appears showing the new key value with a copy button and a prominent warning that it will not be shown again. The dialog cannot be dismissed without explicitly clicking "I've saved this key" to reduce the chance of accidental loss.

The rotation creates a successor key with all the same scopes and restrictions as the original. The original key remains active until its expiry date. The key row in the table updates to show a "Rotated → [new key prefix]" indicator.

**Manage Restrictions Dialog:** Each key row has a "Manage Restrictions" option in the dropdown menu. Clicking it opens a modal dialog with two text areas:

- **Allowed IPs:** One CIDR per line (e.g., `10.0.0.0/8`). The dialog validates each entry as a valid CIDR before allowing save. Invalid entries are highlighted in red with an error message.
- **Allowed Origins:** One HTTP origin per line (e.g., `https://app.example.com`). The dialog validates that each entry starts with `http://` or `https://` and is a valid URL.

Saving calls `PUT /api/admin/api-keys/{id}/restrictions` with the updated arrays. Changes take effect immediately — the next API request using this key will be validated against the new restrictions.

**Key Lifecycle Indicators:** The key table shows visual indicators for each key's lifecycle status:
- A clock icon with the expiry date for keys that have an `expires_at`
- An orange "Dormant" badge for keys that have been flagged by the dormant key audit
- A use count showing total API calls made with the key
- IP and origin restriction icons (green shield for restricted, orange warning for unrestricted)

### 7.4 SDK Auto-Rotation

**Why the SDK needs auto-rotation:** In a typical integration, the API key is stored in an environment variable or configuration file. When the key approaches expiry, someone must manually generate a new key, update the configuration, and restart the application. This manual process is error-prone and often results in keys expiring without rotation, causing service interruptions.

The SDK's auto-rotation mechanism eliminates this manual step by detecting when a key is approaching expiry and automatically swapping to a new key without any service interruption.

**How it works in detail:**

```typescript
const client = new RadiantClient({
  apiKey: 'rad_...',
  onKeyExpiring: async (daysUntilExpiry) => {
    // Called when X-Key-Expires-In ≤ threshold
    const response = await fetch('/api/v1/keys/current/rotate', { method: 'POST' });
    const { new_key } = await response.json();
    return new_key.raw_key;  // Client auto-swaps to this key
  },
  keyExpiryThresholdDays: 14,  // Default: 14 days before expiry
});
```

**The detailed flow:**

1. **Every API response** passes through the `handleKeyExpiryHeader()` method in `RadiantClient`. This method checks for the `X-Key-Expires-In` header that the auth middleware injects on every successful response.

2. **If the header exists**, the method parses the integer value (days until expiry). If the value is less than or equal to `keyExpiryThresholdDays` (default: 14), and no rotation is already in progress, the rotation sequence begins.

3. **The `_rotationInProgress` flag** is set to `true` immediately. This prevents concurrent rotation attempts — without this flag, rapid successive API calls could all detect the same expiry header and each try to rotate, creating multiple unnecessary successor keys.

4. **The `onKeyExpiring` callback fires asynchronously.** This is critical — the current request has already completed successfully and its response has been returned to the caller. The rotation happens in the background between requests. The callback receives the `daysUntilExpiry` value so it can make informed decisions (e.g., only rotate if less than 7 days remain).

5. **If the callback returns a string** (the new API key), the client sets `this._apiKey = newKey`. All subsequent requests will use the new key. The swap is atomic from the perspective of the request pipeline — there is no window where a request could be sent without a key.

6. **If the callback returns `null`** (indicating that rotation was not possible or not desired at this time), the client continues using the existing key. The callback will be triggered again on the next response where the header is present and the threshold is met.

7. **The `_rotationInProgress` flag is cleared** after the callback completes (whether it returned a new key or null), allowing future rotation attempts.

**Edge cases and failure modes:**

- **Callback throws an error:** The error is caught and logged (if `debug: true`). The existing key continues to be used. The `_rotationInProgress` flag is cleared so the callback can be retried on the next qualifying response.
- **Network failure during rotation:** If the rotation API call within the callback fails, the callback should return `null` to signal that rotation did not succeed. The client will retry on the next response.
- **Key expires before rotation succeeds:** If the key expires while rotation is in progress, subsequent requests will receive 401 errors. The application should handle 401 errors at a higher level and fall back to a manual rotation process.
- **Multiple client instances:** If multiple instances of the SDK are running (e.g., in a horizontally scaled service), each instance will independently detect the expiry header and attempt rotation. This is safe because each rotation call generates a different successor key, and all keys remain valid during the grace period. However, it creates unnecessary key proliferation. For multi-instance deployments, the recommendation is to implement the rotation callback as an external service that coordinates across instances (e.g., using a distributed lock or a shared rotation service).

**Persisting the new key:** The `onKeyExpiring` callback is responsible for persisting the new key so that application restarts pick up the new key rather than the expired one. The SDK does not handle persistence because different applications store keys in different ways (environment variables, Secrets Manager, Vault, configuration files, etc.). The callback should save the new key before returning it.

---

## 8. Swift Deployer Integration

### 8.1 Overview

The Swift Deployer app includes a dedicated **Credential Security** sidebar tab that provides a comprehensive security management interface for administrators. This is designed to be the primary tool that the security team uses for regular audits and incident response, providing a single pane of glass across all credential types and compliance standards.

The feature is implemented as two files — a service (actor) and a SwiftUI view — following the same pattern used throughout the Swift Deployer app:

| File | Path | Lines | Purpose |
|------|------|-------|---------|
| `CredentialLifecycleService.swift` | `Sources/RadiantDeployer/Services/` | ~1,033 | Swift actor that performs all AWS CLI calls, parses audit results, computes compliance scores, executes remediation actions, and runs CDK deployments. Uses `async/await` concurrency and shell process execution. |
| `CredentialLifecycleView.swift` | `Sources/RadiantDeployer/Views/` | ~1,035 | SwiftUI view with 7 sidebar-navigated audit sections, toolbar actions for deployment/scheduling, remediation confirmation dialogs, and compliance visualizations. Uses `@EnvironmentObject` for `AppState` access. |
| `AppState.swift` | `Sources/RadiantDeployer/` | Modified | Added `.credentialLifecycle` case to `NavigationTab` enum with icon (`shield.checkered`), color (`.red`), description, and inclusion in `primaryTabs` array. |
| `MainView_macOS.swift` | `Sources/RadiantDeployer/Views/` | Modified | Added `case .credentialLifecycle: CredentialLifecycleView()` to the `DetailContentView` switch statement. |

### 8.2 How the Audit Service Works Internally

The `CredentialLifecycleService` is a Swift actor (ensuring thread-safe access to mutable state) that orchestrates 7 audit checks by shelling out to the AWS CLI. Each check is an independent async function that can succeed or fail independently — a failure in one check (e.g., Access Analyzer not enabled) does not prevent other checks from completing.

**Why shell out to AWS CLI instead of using the AWS SDK for Swift?** The AWS SDK for Swift is still in developer preview and does not cover all the services needed (Config, Access Analyzer, Secrets Manager rotation status). The AWS CLI is stable, well-documented, and already installed as a dependency of the Swift Deployer. Using `--output json` provides structured output that is easy to parse with Swift's `Codable` protocol.

**The audit execution sequence:**

1. **IAM Key Audit** (`auditIAMKeys()`): Runs `aws iam generate-credential-report` followed by `aws iam get-credential-report`, then `aws iam list-access-keys` for each user. For each access key, it calculates:
   - **Age** — days since `CreateDate`
   - **Last used** — days since last use (from `get-access-key-last-used`)
   - **Risk level** — Info (<60d), Medium (60-90d), High (90-365d), Critical (>365d)
   - **MFA status** — whether the key's user has MFA enabled
   - **Root key presence** — flags if the root account has access keys (always Critical)

2. **Config Rules Audit** (`auditConfigRules()`): Runs `aws configservice describe-compliance-by-config-rule` and parses the compliance status of each of the four credential-related rules. Each rule is marked COMPLIANT, NON_COMPLIANT, or NOT_APPLICABLE.

3. **Access Analyzer Audit** (`auditAccessAnalyzer()`): Runs `aws accessanalyzer list-analyzers` to check if an analyzer exists, then `aws accessanalyzer list-findings` to retrieve active findings. Each finding includes the resource type, principal, condition, and whether it grants public access.

4. **Secrets Manager Audit** (`auditSecretsManager()`): Runs `aws secretsmanager list-secrets` and for each secret, checks `RotationEnabled` and `LastRotatedDate`. Flags secrets without rotation enabled and secrets that have not been rotated recently.

5. **Tenant API Key Audit** (`auditTenantAPIKeys()`): Makes an HTTPS request to the RADIANT admin API (`GET /api/admin/api-keys/audit`) using the administrator's credentials. The response includes counts of dormant keys, expiring keys, keys without IP restrictions, and keys without expiry dates.

6. **Compliance Scoring** (`calculateComplianceScores()`): After all five audit checks complete, the service calculates a compliance score for each of the 6 standards (NIST, CIS, SOC2, Well-Architected, PCI DSS, ISO 27001). The scoring algorithm is:
   - Start at 100 points per standard
   - Deduct points for each finding that violates a control mapped to that standard
   - Critical findings deduct 20 points, High deduct 10, Medium deduct 5, Info deduct 1
   - Minimum score is 0 (no negative scores)
   - The overall compliance score is the weighted average across all 6 standards

7. **Summary Generation** (`generateSummary()`): Computes the overview cards: total findings, critical count, keys needing rotation, dormant key count, and compliance trend compared to last audit.

### 8.3 Running an Audit — Detailed Walkthrough

**Step 1:** Open the Swift Deployer and select the target environment from the environment dropdown in the sidebar header. The environment determines which AWS account and region the CLI commands target (via the AWS profile configured in the app's credentials settings).

**Step 2:** Click **Credential Security** in the sidebar. The view loads with empty sections and a prominent "Run Audit" button in the toolbar.

**Step 3:** Click **Run Audit**. A progress indicator appears in the toolbar showing which check is currently running (e.g., "Auditing IAM keys..."). The 7 checks run in parallel where possible, with an overall progress bar.

**Step 4:** When the audit completes (typically 15-30 seconds depending on the number of IAM users and API keys), the 7 sections populate with results:

- **Overview** — Four summary cards at the top: Total Findings (with severity breakdown), Keys Needing Rotation (IAM keys over 90 days), Dormant Keys (tenant keys flagged 30d+), and Compliance Score (weighted average as a percentage). Below the cards, a list of Critical and High findings that need immediate attention, sorted by severity.

- **IAM Keys** — A table listing every IAM access key in the account with columns for User, Key ID (masked), Age, Last Used, MFA Status, and Risk Level. Each row has a color-coded risk badge (green/yellow/orange/red). Keys at High or Critical risk show a wrench icon that opens the remediation action menu (rotate, disable, delete). The table can be sorted by any column and filtered by risk level.

- **Config Rules** — Four cards, one per AWS Config rule, showing the rule name, compliance status (green checkmark or red X), and the last evaluation time. Non-compliant rules show an expandable section with the specific resources that triggered the non-compliance.

- **Access Analyzer** — A list of active findings from IAM Access Analyzer, grouped by resource type (S3, IAM Role, KMS, Lambda, SQS). Each finding shows the resource ARN, the external principal that has access, whether the access is public, and the condition under which access is granted. Findings can be archived (acknowledged) directly from this view.

- **Secrets Manager** — A table of all secrets in the account showing the secret name, rotation status (enabled/disabled), last rotation date, and rotation interval. Secrets without rotation enabled are highlighted in orange.

- **Tenant API Keys** — Summary statistics from the RADIANT admin API: total active keys, dormant keys (30d/45d/60d breakdown), keys expiring within 30 days, keys without IP restrictions, keys without expiry dates. Each statistic is a clickable link that would open the admin dashboard filtered to those specific keys.

- **Compliance** — Six horizontal progress bars, one per compliance standard, showing the score out of 100. Each bar is color-coded (green >80, yellow 60-80, red <60). Clicking a standard expands it to show which specific controls passed or failed and what deductions were applied.

### 8.4 Deploying the CredentialLifecycleStack

The Swift Deployer can deploy the entire CDK stack directly, without needing to open a terminal or remember CDK commands. This is designed for administrators who may not be comfortable with CLI tools.

**Step 1:** Click **Deploy Stack** in the toolbar. A sheet slides down with configuration options.

**Step 2:** The sheet shows:
- **Environment** (pre-filled from the sidebar selection): dev, staging, or prod
- **Alert Email** (optional): An email address that will be subscribed to the SNS security alert topic. If provided, this address will receive all dormant key warnings, rotation notifications, and Access Analyzer alerts.
- **Stack preview**: A summary of what will be deployed (Config rules, Access Analyzer, Lambda functions, SNS topic, etc.)

**Step 3:** Click **Deploy to [environment]**. The service constructs and executes the CDK command:

```bash
npx cdk deploy *-credential-lifecycle \
  -c environment={env} \
  -c alertEmail={email} \
  --require-approval never
```

The deployment output streams in real-time in a log panel within the sheet. CloudFormation events are shown as they occur. The deployment typically takes 3-5 minutes.

**Step 4:** When deployment completes, the sheet shows a success message with the deployed resource ARNs. The user can immediately run an audit to verify the newly deployed resources.

### 8.5 Configuring Rotation Schedules

The schedule configuration sheet allows administrators to adjust all rotation intervals, dormant key thresholds, and enforcement policies without editing CDK context files or redeploying.

**Step 1:** Click **Schedule** in the toolbar. A sheet slides down with the current schedule configuration.

**Step 2:** The sheet is organized into three sections:

**Rotation Intervals:**
| Setting | Default | Range | What It Controls |
|---------|---------|-------|------------------|
| IAM Key Rotation Alert | 90 days | 30-365 | The threshold at which the Config rule flags IAM keys as non-compliant and the Swift Deployer audit flags them as High risk. |
| DB Credential Rotation | 30 days (prod) / 90 days (dev) | 7-365 | The Secrets Manager automatic rotation interval for Aurora database credentials. |
| API Key Default Expiry | 90 days | 30-365 | The default `expires_at` value for newly created tenant API keys when no explicit expiry is specified. |
| Grace Period | 14 days | 7-30 | How many days before expiry the auto-rotation Lambda generates a successor key. |
| JWT Signing Rotation | 30 days | 7-90 | The Secrets Manager rotation interval for the JWT HMAC signing key. |

**Dormant Key Policy:**
| Setting | Default | What It Controls |
|---------|---------|------------------|
| First Warning | 30 days | Days of inactivity before the first dormant flag is set. |
| Final Warning | 45 days | Days of inactivity before the final warning is sent. |
| Auto-Disable | 60 days | Days of inactivity before the key is automatically disabled. |

**Enforcement Policies:**
| Setting | Default | What It Controls |
|---------|---------|------------------|
| Require IP Restrictions | Off | When enabled, all new API keys must include at least one CIDR in `allowed_ips`. |
| Require MFA for IAM Users | Off | When enabled, the audit flags any IAM user without MFA as a Critical finding instead of Medium. |

**Step 3:** Click **Save Schedule**. The service persists the schedule configuration locally (for display purposes) and notes that a CDK redeployment is needed for changes to take effect in the Lambda functions.

### 8.6 Remediation Actions — Detailed Walkthrough

From the **IAM Keys** section, each key at High or Critical risk shows a wrench (🔧) icon. Clicking it reveals three remediation actions, each with specific behavior and safety guards:

**Rotate Key:**
1. The user clicks "Rotate Key" from the action menu
2. A confirmation dialog appears: "This will create a new access key for user [username] and deactivate the current key [key ID]. The user will need the new key to continue making API calls. Continue?"
3. If confirmed, the service executes:
   - `aws iam create-access-key --user-name {username}` — creates the new key
   - `aws iam update-access-key --user-name {username} --access-key-id {oldKeyId} --status Inactive` — deactivates the old key
4. The new key ID and secret key are displayed in a dialog (shown exactly once)
5. An audit log entry is recorded locally with the action, user, old key ID, and new key ID

**Disable Key:**
1. The user clicks "Disable Key" from the action menu
2. A confirmation dialog appears: "This will set key [key ID] for user [username] to Inactive. The key can be re-enabled later. Continue?"
3. If confirmed: `aws iam update-access-key --user-name {username} --access-key-id {keyId} --status Inactive`
4. The key row updates to show "Inactive" status with a gray badge

**Delete Key:**
1. The user clicks "Delete Key" from the action menu
2. A **stronger** confirmation dialog appears: "⚠️ PERMANENT: This will permanently delete key [key ID] for user [username]. This action cannot be undone. Any application using this key will immediately lose access. Type the key ID to confirm."
3. The user must type the key ID (last 4 characters) to confirm — this prevents accidental deletion
4. If confirmed: `aws iam delete-access-key --user-name {username} --access-key-id {keyId}`
5. The key disappears from the table

All three actions require the Swift Deployer's configured AWS credentials to have the necessary IAM permissions (`iam:CreateAccessKey`, `iam:UpdateAccessKey`, `iam:DeleteAccessKey`).

---

## 9. Admin Dashboard Integration

### 9.1 API Key Management Page

**File:** `apps/admin-dashboard/app/(dashboard)/api-keys/page.tsx`

The API key management page in the admin dashboard is the primary web interface for platform administrators to manage tenant API keys. The security framework adds several features to this page that complement the programmatic APIs and the Swift Deployer's audit capabilities.

**Page layout:** The page displays a data table of all API keys across all tenants, with columns for:
- **Prefix** — the `rad_` prefix (clickable to view key details)
- **Tenant** — which tenant owns the key
- **Scopes** — comma-separated list of granted scopes (e.g., `chat, models, embeddings`)
- **Status** — Active (green), Expiring Soon (amber, <14 days), Expired (red), Revoked (gray), Dormant (orange)
- **Created** — creation date
- **Expires** — expiration date with a clock icon; keys without expiry show "Never" with a warning triangle (these should be rare in a properly configured system)
- **Last Used** — relative time (e.g., "3 hours ago", "45 days ago"); keys unused for 30+ days are highlighted in orange
- **Restrictions** — icons indicating whether IP restrictions (🔒), origin restrictions (🌐), or endpoint restrictions (📍) are configured

**Filtering and search:** The table supports:
- Text search across prefix, tenant name, and scopes
- Status filter dropdown (Active, Expiring, Expired, Revoked, Dormant, All)
- Tenant filter dropdown
- Date range filter for creation and expiry dates

**Row actions (dropdown menu):** Each key row has a "⋯" dropdown menu with these actions:

| Action | What It Does | Confirmation Required? |
|--------|-------------|----------------------|
| **View Details** | Opens a side panel with full key metadata, audit history, and restriction configuration | No |
| **Rotate Key** | Calls `POST /api/admin/api-keys/{id}/rotate`. Creates a successor key with the same scopes, restrictions, and tenant. The new key's raw value is shown in a dialog (one time only). The old key remains active during the grace period. | Yes — "This will generate a new key and link it as the successor to {prefix}. The old key will remain active for 14 days." |
| **Manage Restrictions** | Opens a dialog with three tabs: IP Restrictions, Origin Restrictions, and Endpoint Restrictions. Each tab has a textarea for entering values (one per line). CIDR notation is validated in real-time. | No (saves on "Apply Changes") |
| **Revoke Key** | Calls `POST /api/admin/api-keys/{id}/revoke`. Immediately sets `is_active = false` and `revoked_at = NOW()`. The key stops working immediately. | Yes — "⚠️ This key will be permanently revoked. Any application using this key will immediately lose access." |
| **View Audit Log** | Opens a side panel showing the `api_key_audit_log` entries for this key, sorted by most recent first | No |

**Manage Restrictions dialog — detailed behavior:**

The restrictions dialog is the most complex UI element on this page. It provides three tabs:

**IP Restrictions tab:**
- Textarea for entering CIDR ranges, one per line (e.g., `10.0.0.0/8`, `192.168.1.100/32`)
- Real-time validation: each line is checked for valid CIDR syntax; invalid entries are highlighted red with an error message
- A "Test IP" input field lets the administrator enter a specific IP address and see whether it would be allowed by the current CIDR configuration (this helps prevent accidental lockouts)
- Common CIDR ranges are available as quick-add buttons: "Private networks" (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), "Cloudflare" (pre-populated Cloudflare IP ranges)
- Saving calls `PUT /api/admin/api-keys/{id}/restrictions` with the new `allowed_ips` array

**Origin Restrictions tab:**
- Textarea for entering allowed origins, one per line (e.g., `https://app.example.com`, `http://localhost:3000`)
- Real-time validation: each line is checked for valid URL format (must include scheme)
- A note explains that Origin matching is exact — `https://example.com` does not match `https://example.com:443`
- Saving calls the same restrictions endpoint with the new `allowed_origins` array

**Endpoint Restrictions tab:**
- Toggle between "Allow List" and "Deny List" mode
- Textarea for entering API path patterns (e.g., `/api/v1/chat/*`, `/api/v1/models`)
- Wildcard matching is supported: `*` matches any segment
- Saving calls the same restrictions endpoint with `allowed_endpoints` or `denied_endpoints`

### 9.2 Tenant Admin Key Management

The tenant admin API allows tenants to manage their own API keys without needing platform administrator involvement. This is the self-service layer described in Section 6.4.

**Routes added to** `packages/infrastructure/lambda/thinktank-tenant-admin/handler.ts`:

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|-------------|----------|
| `GET` | `/keys` | List all API keys for the authenticated tenant. Returns active, expired, and revoked keys (revoked keys are kept for audit trail). Supports `?status=active` filter. | — | `{ keys: ApiKey[] }` |
| `POST` | `/keys` | Create a new API key. The raw key is returned exactly once in the response. If the tenant has `require_api_key_ip_restriction` enabled, the request must include `allowed_ips`. | `{ scopes, expires_in_days?, allowed_ips?, allowed_origins? }` | `{ key: ApiKey, raw_key: string }` |
| `POST` | `/keys/{id}/rotate` | Self-service rotation. Creates a successor key with the same scopes and restrictions. Returns the new raw key. The old key remains active during the grace period. | `{ reason? }` | `{ new_key: ApiKey, raw_key: string }` |
| `PUT` | `/keys/{id}/restrictions` | Update IP, origin, or endpoint restrictions on an existing key. Validates CIDR syntax and URL format server-side. | `{ allowed_ips?, allowed_origins?, allowed_endpoints?, denied_endpoints? }` | `{ key: ApiKey }` |
| `POST` | `/keys/{id}/revoke` | Revoke a key immediately. Logs the reason to the audit trail. Cannot be undone. | `{ reason }` | `{ success: true }` |

**Authorization:** All tenant admin routes use the tenant's JWT (not an API key) for authentication. The JWT is obtained via the tenant admin login flow. The `tenant_id` is extracted from the JWT claims and used for RLS scoping — a tenant can never see or modify another tenant's keys.

**Rate limiting:** Key creation is rate-limited to 10 keys per hour per tenant to prevent abuse. Rotation is limited to 5 rotations per hour per key to prevent rapid churn that could confuse the rotation lineage.

**Validation rules:**
- `expires_in_days` must be between 1 and `api_key_max_expiry_days` (tenant setting, default 365)
- `scopes` must be a subset of the scopes available on the tenant's plan
- `allowed_ips` entries must be valid CIDR notation
- `allowed_origins` entries must be valid URLs with scheme
- A key cannot be rotated if it is already revoked or expired

---

## 10. SDK Auto-Rotation

### 10.1 How It Works

The SDK auto-rotation feature allows client applications to automatically detect when their API key is approaching expiry and trigger a rotation without manual intervention. This is the "last mile" of the auto-rotation system — the server generates successor keys proactively (via the auto-rotation Lambda), and the SDK ensures the client transitions to the new key seamlessly.

**The flow works as follows:**

1. Every API response from the RADIANT server includes an `X-Key-Expires-In` header if the key has an `expires_at` date. The value is the number of days until expiry (e.g., `12` means the key expires in 12 days).

2. The SDK's `RadiantClient` checks this header after every API call via the `handleKeyExpiryHeader()` method.

3. If the header value is ≤ `keyExpiryThresholdDays` (configurable, default 14), and no rotation is already in progress, the SDK calls the `onKeyExpiring` callback provided by the application.

4. The callback is responsible for:
   - Calling the rotation API to get a new key
   - Persisting the new key (to survive application restarts)
   - Returning the new raw key string, which the SDK will use for subsequent requests

5. If the callback returns `null`, the SDK does not change the key (useful if the application decides not to rotate for some reason).

6. If the callback throws an error, the SDK catches it, logs it (if debug mode is on), clears the `_rotationInProgress` flag, and continues using the existing key. The rotation will be attempted again on the next API call that triggers the threshold.

### 10.2 Configuration Interface

```typescript
interface RadiantConfig {
  /** The API key to use for authentication */
  apiKey: string;

  /** Base URL of the RADIANT API */
  baseUrl: string;

  /**
   * Callback invoked when the server reports the key is expiring soon.
   * The callback receives the number of days until expiry.
   * It should call the rotation API and return the new raw key string.
   * Return null to skip rotation.
   * Throw to abort (will retry on next API call).
   */
  onKeyExpiring?: (daysUntilExpiry: number) => Promise<string | null>;

  /**
   * Number of days before expiry at which onKeyExpiring is triggered.
   * Default: 14 (matches the server-side grace period).
   * Set lower for less aggressive rotation, higher for more lead time.
   */
  keyExpiryThresholdDays?: number;

  /**
   * Enable debug logging for rotation events.
   * Logs to console: rotation triggers, callback results, key updates, errors.
   */
  debug?: boolean;

  // ... other config (timeout, retries, etc.)
}
```

### 10.3 Implementation Details

The rotation logic in the SDK has several carefully designed behaviors:

**Concurrency guard (`_rotationInProgress`):** A boolean flag that prevents multiple concurrent rotation attempts. In a busy application, many API calls may arrive while the first rotation callback is executing. Without this guard, each response would trigger a separate rotation, creating duplicate keys. The flag is set to `true` before calling the callback and reset to `false` after the callback completes (or throws).

**Non-blocking execution:** The rotation fires asynchronously and does not block the current API request. The request that triggered the rotation receives its normal response. The key update happens in the background. This means there is a brief window where the old key is still used for in-flight requests — this is safe because the old key remains active during the grace period.

**Debug logging:** When `debug: true` is set, the SDK logs:
- `[radiant:rotation] Key expires in {N} days, threshold is {T} days — triggering rotation` — when the threshold is met
- `[radiant:rotation] Rotation callback returned new key (prefix: rad_...)` — when the callback succeeds
- `[radiant:rotation] Rotation callback returned null — keeping current key` — when the callback skips
- `[radiant:rotation] Rotation callback threw: {error}` — when the callback fails
- `[radiant:rotation] Skipping — rotation already in progress` — when the concurrency guard fires

**Key update mechanism:** When the callback returns a new key, the SDK:
1. Updates its internal `apiKey` property
2. All subsequent requests use the new key in the `Authorization: Bearer {key}` header
3. The old key is not stored — it is simply overwritten

### 10.4 Example: Node.js Service with Secrets Manager

This example shows a production-grade integration where the new key is persisted to AWS Secrets Manager so that application restarts pick up the rotated key:

```typescript
import { RadiantClient } from '@radiant/sdk';
import { SecretsManagerClient, GetSecretValueCommand, PutSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const smClient = new SecretsManagerClient({ region: 'us-east-1' });
const SECRET_ID = 'my-app/radiant-api-key';

// Load the initial key from Secrets Manager
const initialSecret = await smClient.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
const initialKey = initialSecret.SecretString!;

const client = new RadiantClient({
  apiKey: initialKey,
  baseUrl: process.env.RADIANT_API_URL!,
  debug: true,
  keyExpiryThresholdDays: 7,  // Rotate 7 days before expiry (more conservative)
  onKeyExpiring: async (daysUntilExpiry) => {
    console.log(`RADIANT key expires in ${daysUntilExpiry} days, rotating...`);

    // Call the self-service rotation API
    const res = await fetch(`${process.env.RADIANT_API_URL}/api/v1/keys/rotate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${client.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'SDK auto-rotation' }),
    });

    if (!res.ok) {
      throw new Error(`Rotation API returned ${res.status}: ${await res.text()}`);
    }

    const { new_key } = await res.json();

    // Persist the new key to Secrets Manager before returning
    await smClient.send(new PutSecretValueCommand({
      SecretId: SECRET_ID,
      SecretString: new_key.raw_key,
    }));

    console.log(`Rotated to new key (prefix: ${new_key.prefix}), persisted to Secrets Manager`);
    return new_key.raw_key;
  },
});

// Use the client normally — rotation happens automatically in the background
const response = await client.chat.completions.create({
  model: 'claude-sonnet-4-20250514',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

### 10.5 Example: Browser Application with localStorage

For browser-based applications, the key can be persisted to `localStorage` (or a more secure storage mechanism like an encrypted cookie):

```typescript
import { RadiantClient } from '@radiant/sdk';

const client = new RadiantClient({
  apiKey: localStorage.getItem('radiant_key') || INITIAL_KEY,
  baseUrl: 'https://api.radiant.example.com',
  keyExpiryThresholdDays: 14,
  onKeyExpiring: async (days) => {
    // Call the rotation endpoint via the backend proxy
    // (never call the rotation API directly from the browser
    //  to avoid exposing the raw key in browser network logs)
    const res = await fetch('/api/rotate-radiant-key', { method: 'POST' });
    if (!res.ok) return null;  // Skip rotation if backend is unavailable

    const { newKey } = await res.json();
    localStorage.setItem('radiant_key', newKey);
    return newKey;
  },
});
```

**Security note:** In browser contexts, the `onKeyExpiring` callback should route through the application's backend rather than calling the RADIANT rotation API directly. This prevents the raw API key from appearing in browser network logs, DevTools, or browser extensions. The backend proxy should handle the actual rotation call and return only the new key.

### 10.6 Edge Cases and Failure Modes

| Scenario | What Happens | Recommended Action |
|----------|-------------|-------------------|
| Rotation API returns 429 (rate limited) | Callback throws, SDK retries on next API call | Increase `keyExpiryThresholdDays` to start earlier |
| Rotation API returns 401 (key already expired) | Callback throws, all subsequent requests also fail | Application needs manual key replacement |
| Network failure during rotation | Callback throws, SDK continues with old key | Rotation retries on next API call |
| Rotation succeeds but persistence fails | Callback throws after rotation API call; new key exists on server but SDK doesn't use it | On restart, load the latest key from the rotation API or admin dashboard |
| Multiple SDK instances rotate simultaneously | Each creates a different successor; all are valid during grace period | Use a distributed lock or external rotation service for multi-instance deployments |
| Server doesn't send `X-Key-Expires-In` header | Callback is never triggered | Verify auth middleware is deployed and key has `expires_at` set |

---

## 11. Database Schema

### 11.1 Migration: `V2026_02_10_001__credential_lifecycle_security.sql`

This migration adds the columns, indexes, and functions needed for the full credential lifecycle security framework. It is designed to be additive — no existing columns are modified or removed, so it is safe to apply to a running system without downtime.

**New columns on `api_keys`:**

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `allowed_ips` | `INET[]` | `NULL` | Array of CIDR ranges that are allowed to use this key. `NULL` means no IP restriction (all IPs allowed). |
| `allowed_origins` | `TEXT[]` | `NULL` | Array of allowed Origin headers for browser requests. `NULL` means no origin restriction. |
| `allowed_endpoints` | `TEXT[]` | `NULL` | Array of API path patterns the key is allowed to call. `NULL` means all endpoints allowed. |
| `denied_endpoints` | `TEXT[]` | `NULL` | Array of API path patterns the key is denied from calling. Takes precedence over `allowed_endpoints`. |
| `encryption_key_id` | `TEXT` | `NULL` | KMS key ID for optional envelope encryption of the key hash. For high-security tenants only. |
| `dormant_flagged_at` | `TIMESTAMPTZ` | `NULL` | When the key was first flagged as dormant. `NULL` means the key is not dormant. Reset to `NULL` when the key is used. |
| `dormant_warning_level` | `VARCHAR(20)` | `NULL` | Current dormant escalation level: `warning_30d`, `warning_45d`, or `disabled_60d`. Reset to `NULL` when the key is used. |
| `replaced_by_key_id` | `UUID` | `NULL` | Points to the successor key that replaced this one during rotation. Forms the "forward" link in the rotation lineage chain. |
| `replaces_key_id` | `UUID` | `NULL` | Points to the predecessor key that this key replaced. Forms the "backward" link in the rotation lineage chain. |
| `interface_type` | `VARCHAR(20)` | `'api'` | What type of interface created and uses this key: `api`, `sdk`, `browser`, `webhook`. Used for interface-specific validation (e.g., origin checks only for `browser` type). |

**New columns on `tenants`:**

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `api_key_default_expiry_days` | `INTEGER` | `90` | Default expiry for new API keys when no explicit expiry is provided. |
| `api_key_max_expiry_days` | `INTEGER` | `365` | Maximum allowed expiry for API keys. Prevents tenants from creating keys that never expire (or expire too far in the future). |
| `require_api_key_ip_restriction` | `BOOLEAN` | `false` | When `true`, all new API keys for this tenant must include at least one CIDR in `allowed_ips`. |

**New indexes:**

| Index Name | Columns | Condition | Why It Exists |
|-----------|---------|-----------|---------------|
| `idx_api_keys_dormant` | `(last_used_at, is_active)` | `WHERE is_active = true AND revoked_at IS NULL` | The dormant key audit Lambda runs daily and queries for keys where `last_used_at < NOW() - INTERVAL '30 days'`. Without this index, it would scan the entire `api_keys` table. The partial index (filtering on `is_active` and `revoked_at`) keeps the index small by excluding already-disabled and revoked keys. |
| `idx_api_keys_expiring` | `(expires_at, is_active)` | `WHERE is_active = true AND expires_at IS NOT NULL` | The auto-rotation Lambda runs daily and queries for keys where `expires_at - NOW() <= grace_period_days`. This index supports that range scan efficiently. The partial index excludes keys without expiry and inactive keys. |
| `idx_api_keys_rotation_lineage` | `(replaced_by_key_id)` | `WHERE replaced_by_key_id IS NOT NULL` | Supports the recursive CTE query that follows the rotation lineage chain. Most keys have `NULL` for this column (they haven't been rotated), so the partial index is very small. |

### 11.2 Database Functions

**`validate_api_key_with_restrictions(p_key_hash BYTEA, p_source_ip INET, p_origin TEXT, p_endpoint TEXT, p_interface_type VARCHAR)`**

This function replaces the simple `SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = true` query that the auth middleware previously used. It performs all validation in a single database round-trip, which is critical for latency (each Lambda cold start adds ~100ms, so minimizing round-trips matters).

**Internal logic (executed in order):**

1. **Key lookup:** `SELECT * FROM api_keys WHERE key_hash = p_key_hash AND is_active = true AND revoked_at IS NULL`
   - If no row found → return `NULL` (key does not exist or is inactive)

2. **Expiration check:** `IF key.expires_at IS NOT NULL AND key.expires_at < NOW()` → return error code `KEY_EXPIRED`
   - This catches keys that the auto-rotation Lambda hasn't disabled yet (there may be a delay of up to 24 hours between expiry and the Lambda's daily run)

3. **Interface type check:** `IF p_interface_type IS NOT NULL AND key.interface_type != p_interface_type` → return error code `INTERFACE_MISMATCH`
   - Prevents an SDK key from being used in a browser context, or vice versa

4. **IP restriction check:** `IF key.allowed_ips IS NOT NULL AND array_length(key.allowed_ips, 1) > 0`
   - For each CIDR in `allowed_ips`: check if `p_source_ip <<= cidr` (PostgreSQL's "is contained within" operator for network types)
   - If no CIDR matches → return error code `IP_NOT_ALLOWED`
   - **Why `<<=` instead of `=`?** The `<<=` operator checks if the left-hand IP is contained within the right-hand CIDR range. This means `192.168.1.50 <<= 192.168.0.0/16` returns `true`. Using `=` would require exact match, which defeats the purpose of CIDR ranges.

5. **Origin restriction check:** `IF key.allowed_origins IS NOT NULL AND array_length(key.allowed_origins, 1) > 0`
   - Check if `p_origin = ANY(key.allowed_origins)` (exact string match)
   - If no match → return error code `ORIGIN_NOT_ALLOWED`

6. **Endpoint restriction check:** First check `denied_endpoints` (deny takes precedence), then check `allowed_endpoints`
   - Uses a simple wildcard matching function: `*` matches any path segment

7. **Usage tracking (side effects):** If all checks pass:
   - `UPDATE api_keys SET last_used_at = NOW(), use_count = use_count + 1 WHERE id = key.id`
   - If `dormant_flagged_at IS NOT NULL`: `SET dormant_flagged_at = NULL, dormant_warning_level = NULL` (clear dormant flags because the key is now in use)

8. **Return** the full key row (all columns needed by the auth middleware to set RLS context and route the request).

**Why a database function instead of application-level logic?** The function executes atomically in a single transaction, ensuring that the usage tracking and dormant flag clearing happen in the same transaction as the validation. If this were done in application code, a Lambda cold start or network interruption between the SELECT and UPDATE could leave the key's `last_used_at` stale.

**`rotate_api_key(p_key_id UUID, p_new_key_hash BYTEA, p_new_prefix VARCHAR, p_performed_by UUID)`**

This function performs an atomic key rotation — creating the successor and linking it to the predecessor in a single transaction. Atomicity is essential because a partial rotation (successor created but not linked, or linked but not logged) would corrupt the rotation lineage.

**Internal logic:**

1. **Load the existing key:** `SELECT * FROM api_keys WHERE id = p_key_id AND is_active = true`
   - If not found → raise `KEY_NOT_FOUND` error
   - If already has `replaced_by_key_id` → raise `KEY_ALREADY_ROTATED` error (prevents double rotation)

2. **Create the successor key:**
   ```sql
   INSERT INTO api_keys (
     tenant_id, key_hash, prefix, scopes, is_active,
     allowed_ips, allowed_origins, allowed_endpoints, denied_endpoints,
     interface_type, replaces_key_id, expires_at, created_by
   ) VALUES (
     old_key.tenant_id, p_new_key_hash, p_new_prefix, old_key.scopes, true,
     old_key.allowed_ips, old_key.allowed_origins, old_key.allowed_endpoints, old_key.denied_endpoints,
     old_key.interface_type, p_key_id, NOW() + INTERVAL '{expiry_days} days', p_performed_by
   ) RETURNING id;
   ```
   - The successor inherits all restrictions and scopes from the predecessor
   - The successor's `replaces_key_id` points back to the predecessor
   - The successor gets a fresh expiry based on the tenant's `api_key_default_expiry_days`

3. **Link the predecessor to the successor:**
   ```sql
   UPDATE api_keys SET replaced_by_key_id = new_key_id WHERE id = p_key_id;
   ```

4. **Log to audit trail:**
   ```sql
   INSERT INTO api_key_audit_log (tenant_id, key_id, action, performed_by, details)
   VALUES (old_key.tenant_id, p_key_id, 'rotated', p_performed_by, jsonb_build_object(
     'old_key_id', p_key_id, 'new_key_id', new_key_id,
     'new_key_prefix', p_new_prefix, 'rotation_type', 'self_service'
   ));
   ```

5. **Return** the new key's ID (the caller needs this to return the raw key to the requester).

---

## 12. CDK Infrastructure

### 12.1 CredentialLifecycleStack

**File:** `packages/infrastructure/lib/stacks/credential-lifecycle-stack.ts`

The `CredentialLifecycleStack` is a self-contained CDK stack that provisions all AWS resources needed for the credential lifecycle security framework. It is intentionally separated from other CDK stacks so that it can be deployed, updated, or torn down independently without affecting the rest of the RADIANT infrastructure.

**Stack props (inputs from other stacks):**

| Prop | Type | Source | Purpose |
|------|------|--------|---------|
| `environment` | `string` | CDK context | `dev`, `staging`, or `prod` — controls naming and schedule intervals |
| `alertEmail` | `string?` | CDK context | Optional email for SNS subscription |
| `secretsKey` | `kms.IKey` | SecurityStack | KMS key for encrypting Lambda env vars and SNS messages |
| `dbSecretArn` | `string?` | DataStack | ARN of the Aurora DB secret (for rotation configuration) |
| `auroraClusterArn` | `string` | DataStack | ARN of the Aurora cluster (for Lambda DB access) |

**Resources provisioned — detailed breakdown:**

**1. AWS Config Managed Rules (4 rules)**

Each rule is a `config.ManagedRule` construct. These rules are evaluated by AWS Config's managed rule engine — no custom Lambda functions are needed.

| Rule | Config Rule Identifier | Parameter | What It Checks |
|------|----------------------|-----------|----------------|
| Unused credentials | `iam-user-unused-credentials-check` | `maxCredentialUsageAge: 45` | Flags IAM users whose passwords or access keys have not been used in 45 days. The 45-day threshold is more aggressive than the 90-day CIS default, providing earlier warning. |
| Key rotation | `access-keys-rotated` | `maxAccessKeyAge: 90` | Flags IAM access keys older than 90 days (CIS 1.14 requirement). This is the trigger that the security team uses to identify keys needing rotation. |
| Root key check | `iam-root-access-key-check` | (none) | Checks whether the root account has any access keys. Root keys should never exist — the root account should use MFA-protected console access only. |
| Root MFA check | `root-account-mfa-enabled` | (none) | Checks whether the root account has MFA enabled. This is a Critical finding if not enabled. |

**2. IAM Access Analyzer (1 analyzer)**

A `accessanalyzer.CfnAnalyzer` of type `ACCOUNT`. This analyzer continuously scans all resource-based policies in the account and generates findings for any resource that is accessible from outside the account.

**3. EventBridge Rule for Access Analyzer**

An `events.Rule` that matches `source: 'aws.access-analyzer'` events with `detail-type: 'Access Analyzer Finding'`. When a new finding is created, the rule routes the event to the SNS topic. This provides real-time alerting for any new external access findings, rather than waiting for a manual review.

**4. SNS Topic**

A `sns.Topic` named `radiant-{env}-security-alerts`, encrypted with the `secretsKey` KMS key. If `alertEmail` is provided, a `sns.Subscription` is created for that email address. All security events (dormant key warnings, rotation events, Access Analyzer findings, Config non-compliance, monthly reports) are published to this topic.

**5. Lambda Functions (4 functions)**

All Lambda functions share these common settings:
- **Runtime:** Node.js 18.x
- **Architecture:** ARM64 (Graviton2 — 20% cheaper, better performance)
- **Timeout:** 5 minutes (sufficient for all audit operations)
- **Memory:** 256 MB
- **Environment variables:** `ENVIRONMENT`, `DB_SECRET_ARN`, `SNS_TOPIC_ARN`, `AURORA_CLUSTER_ARN`
- **VPC:** Same VPC as the Aurora cluster (required for DB access)
- **Bundling:** esbuild with tree-shaking for minimal cold start

Each function's IAM role follows least privilege:
- Dormant key & rotation Lambdas: `secretsmanager:GetSecretValue` (for DB credentials), `rds-data:ExecuteStatement` (for Aurora queries), `sns:Publish` (for alerts)
- IAM report Lambda: `iam:GenerateCredentialReport`, `iam:GetCredentialReport`, `iam:ListUsers`, `iam:ListAccessKeys`, `iam:GetAccessKeyLastUsed`, `access-analyzer:ListAnalyzers`, `access-analyzer:ListFindings`, `cloudwatch:PutMetricData`, `sns:Publish`
- JWT rotation Lambda: `secretsmanager:GetSecretValue`, `secretsmanager:PutSecretValue`, `secretsmanager:UpdateSecretVersionStage`, `secretsmanager:DescribeSecret`

**6. EventBridge Schedules (3 cron rules)**

| Rule Name | Schedule | Target Lambda |
|-----------|----------|--------------|
| `radiant-{env}-dormant-key-audit-schedule` | `cron(0 2 * * ? *)` (daily 02:00 UTC) | `dormant-key-audit` |
| `radiant-{env}-api-key-rotation-schedule` | `cron(0 3 * * ? *)` (daily 03:00 UTC) | `api-key-rotation` |
| `radiant-{env}-iam-access-report-schedule` | `cron(0 6 ? * 2#1 *)` (first Monday 06:00 UTC) | `iam-access-report` |

The JWT signing rotation does not use an EventBridge schedule — it is triggered natively by Secrets Manager's rotation configuration.

**7. Secrets Manager Rotation Configuration**

Configures automatic rotation for the Aurora DB credentials secret:
```typescript
dbSecret.addRotationSchedule('rotation', {
  automaticallyAfter: Duration.days(environment === 'prod' ? 30 : 90),
  rotationLambda: dbRotationLambda,
});
```

The rotation Lambda is a standard Secrets Manager rotation function that follows the four-step protocol: `createSecret` → `setSecret` → `testSecret` → `finishSecret`. RDS Proxy handles the credential transition transparently — applications never see a connection interruption.

**CDK-Nag suppressions:**

The stack includes documented suppressions for findings that are intentional:

```typescript
NagSuppressions.addResourceSuppressions(dormantKeyLambda, [
  {
    id: 'AwsSolutions-IAM5',
    reason: 'Lambda needs wildcard access to rds-data:ExecuteStatement for Aurora Serverless Data API — cannot scope to specific tables',
  },
]);
```

### 12.2 Wiring in `bin/radiant.ts`

The stack is instantiated in the CDK app's entry point and wired to its dependencies:

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

**Why explicit `addDependency` calls?** CDK can infer some dependencies from cross-stack references, but the dependency on `dataStack` for the Aurora cluster ARN is passed as a string prop (not a CDK token), so CDK cannot automatically detect it. The explicit dependencies ensure that CloudFormation deploys the stacks in the correct order.

---

## 13. Scheduled Lambda Functions

### 13.1 Dormant Key Audit (`dormant-key-audit`)

**Schedule:** Daily at 02:00 UTC
**Runtime:** ~10-30 seconds depending on key count

This Lambda scans the `api_keys` table for keys that have not been used recently and applies the three-stage dormant key escalation policy.

**Step-by-step execution:**

1. **Connect to Aurora** using credentials from Secrets Manager (the secret ARN is in the `DB_SECRET_ARN` environment variable)

2. **Query for dormant keys:**
   ```sql
   SELECT id, tenant_id, prefix, last_used_at, dormant_warning_level,
          EXTRACT(EPOCH FROM (NOW() - last_used_at)) / 86400 as days_inactive
   FROM api_keys
   WHERE is_active = true
     AND revoked_at IS NULL
     AND last_used_at < NOW() - INTERVAL '30 days'
   ORDER BY last_used_at ASC;
   ```

3. **For each dormant key, apply the escalation policy:**

   - **30-44 days inactive, no previous warning:**
     - Set `dormant_flagged_at = NOW()`, `dormant_warning_level = 'warning_30d'`
     - Publish SNS message: `{ type: 'KEY_DORMANT_WARNING', key_id, prefix, tenant_id, days_inactive, level: '30d' }`
     - Log: `Flagging key {prefix} as dormant (30d) — last used {days_inactive} days ago`

   - **45-59 days inactive, previous warning was 30d:**
     - Update `dormant_warning_level = 'warning_45d'`
     - Publish SNS message: `{ type: 'KEY_FINAL_WARNING', key_id, prefix, tenant_id, days_inactive, level: '45d', auto_disable_in: '15 days' }`
     - Log: `Final warning for key {prefix} — last used {days_inactive} days ago, will auto-disable in {60 - days_inactive} days`

   - **60+ days inactive:**
     - Set `is_active = false`, `dormant_warning_level = 'disabled_60d'`
     - Insert into `api_key_audit_log`: action `auto_disabled`, details `{ reason: 'dormant_60d' }`
     - Publish SNS message: `{ type: 'KEY_AUTO_DISABLED', key_id, prefix, tenant_id, days_inactive }`
     - Log: `Auto-disabled key {prefix} — dormant for {days_inactive} days`

4. **Return summary:** `{ keys_scanned: N, warnings_30d: N, warnings_45d: N, disabled: N }`

**Why 02:00 UTC?** This is a quiet period for most users (late night in US timezones, early morning in Europe). Running the audit during low-traffic periods minimizes the chance that a key is being actively used at the moment it gets flagged (which would be confusing — the key would get a dormant warning and then immediately have the warning cleared by the next request).

### 13.2 API Key Auto-Rotation (`api-key-rotation`)

**Schedule:** Daily at 03:00 UTC (one hour after dormant audit to avoid database contention)
**Runtime:** ~10-60 seconds depending on key count

This Lambda handles two responsibilities: proactively generating successor keys for keys approaching expiry, and disabling keys that have passed their expiry date.

**Step-by-step execution:**

1. **Connect to Aurora** (same pattern as dormant audit)

2. **Find keys within the grace period:**
   ```sql
   SELECT id, tenant_id, prefix, expires_at, replaced_by_key_id,
          EXTRACT(EPOCH FROM (expires_at - NOW())) / 86400 as days_until_expiry
   FROM api_keys
   WHERE is_active = true
     AND revoked_at IS NULL
     AND expires_at IS NOT NULL
     AND expires_at > NOW()
     AND expires_at <= NOW() + INTERVAL '14 days'
     AND replaced_by_key_id IS NULL;
   ```
   The `replaced_by_key_id IS NULL` condition ensures we don't generate a second successor for a key that already has one.

3. **For each key in the grace period:**
   - Generate a new random key (32 bytes, base62 encoded, with `rad_` prefix)
   - Hash the key with SHA-256
   - Call `rotate_api_key()` database function to create the successor atomically
   - Publish SNS message: `{ type: 'KEY_AUTO_ROTATED', old_key_prefix, new_key_prefix, tenant_id, expires_in: days_until_expiry }`
   - Log: `Generated successor for key {prefix} — expires in {days_until_expiry} days`
   - **Note:** The raw key is NOT included in the SNS message or logs. The successor key's raw value is only retrievable by the tenant via the rotation API or by contacting the admin.

4. **Find and disable expired keys:**
   ```sql
   UPDATE api_keys SET is_active = false
   WHERE is_active = true
     AND revoked_at IS NULL
     AND expires_at IS NOT NULL
     AND expires_at < NOW()
   RETURNING id, tenant_id, prefix;
   ```
   For each disabled key:
   - Insert into `api_key_audit_log`: action `expired`
   - Publish SNS notification

5. **Return summary:** `{ successors_generated: N, keys_expired: N }`

### 13.3 JWT Signing Rotation (`jwt-signing-rotation`)

**Trigger:** Secrets Manager automatic rotation (every 30 days)
**Runtime:** ~5-15 seconds

This Lambda follows the standard four-step Secrets Manager rotation protocol. Understanding these four steps is important because a failure in any step can leave the secret in a partially rotated state (see Troubleshooting Section 17.5).

**Step 1 — `createSecret`:** Generate a new HMAC signing key (256-bit random, base64 encoded) and store it as the `AWSPENDING` version of the secret.
```
aws secretsmanager put-secret-value --secret-id {id} \
  --client-request-token {versionId} \
  --secret-string {new-key} \
  --version-stages AWSPENDING
```

**Step 2 — `setSecret`:** No-op for JWT signing keys. This step is used for database passwords (where the new password needs to be set on the database server). For HMAC keys, there is no external system to update.

**Step 3 — `testSecret`:** Verify that the new key works by:
1. Signing a test JWT with the `AWSPENDING` key
2. Verifying the test JWT with the `AWSPENDING` key
3. If verification fails → throw error (rotation aborts, `AWSPENDING` is not promoted)

**Step 4 — `finishSecret`:** Promote `AWSPENDING` to `AWSCURRENT`. The previous `AWSCURRENT` automatically becomes `AWSPREVIOUS`.
```
aws secretsmanager update-secret-version-stage --secret-id {id} \
  --version-stage AWSCURRENT \
  --move-to-version-id {new-versionId} \
  --remove-from-version-id {old-versionId}
```

After this step, new JWTs are signed with the new key, but old JWTs (signed with the now-`AWSPREVIOUS` key) are still verifiable because the auth middleware checks both `AWSCURRENT` and `AWSPREVIOUS`.

### 13.4 IAM Access Report (`iam-access-report`)

**Schedule:** First Monday of each month at 06:00 UTC
**Runtime:** ~30-90 seconds depending on IAM user count

This Lambda generates a comprehensive IAM security posture report and publishes it to SNS for review by the security team.

**Step-by-step execution:**

1. **Generate IAM credential report:**
   ```
   aws iam generate-credential-report
   ```
   This is an async operation — the Lambda polls every 2 seconds until the report is ready (typically 5-15 seconds).

2. **Download and parse the report:**
   ```
   aws iam get-credential-report
   ```
   The report is a CSV with one row per IAM user. Relevant columns: `user`, `password_enabled`, `password_last_used`, `access_key_1_active`, `access_key_1_last_used_date`, `access_key_2_active`, `mfa_active`.

3. **Classify each access key:**
   - For each user with active access keys, calculate the key age and last-used duration
   - Assign risk levels: Info (<60d), Medium (60-90d), High (90-365d), Critical (>365d)
   - Flag users without MFA

4. **Query Access Analyzer:**
   ```
   aws accessanalyzer list-findings --analyzer-arn {arn} --filter '{"status": {"eq": ["ACTIVE"]}}'
   ```
   Categorize findings by resource type and whether they grant public access.

5. **Publish CloudWatch metrics:**
   - `StaleAccessKeys` = count of keys over 90 days old
   - `AccessAnalyzerFindings` = count of active findings
   - `MfaDisabledUsers` = count of users without MFA
   - `JwtSigningKeyRotation` = 1 if JWT key was rotated in the last 35 days, else 0

6. **Compose and publish the report** to SNS as a structured JSON payload with sections: `summary`, `access_key_details`, `access_analyzer_summary`, `recommendations`.

---

## 14. Rotation Schedules & Policies

### 14.1 Default Rotation Schedule

Each credential type has a rotation interval chosen to balance security (shorter intervals = less exposure time if a key is compromised) against operational burden (shorter intervals = more frequent disruption).

| Credential | Rotation Interval | Grace Period | Auto-Rotation Mechanism | Rationale |
|-----------|-------------------|--------------|------------------------|-----------|
| **IAM Access Keys** | 90 days (alert) | N/A | Manual (via Swift Deployer remediation or CLI). Config rule alerts when threshold is exceeded. | CIS AWS Benchmark v3.0 requirement 1.14 mandates rotation within 90 days. IAM keys cannot be auto-rotated by AWS because the new key must be distributed to the application — this is a manual process that requires human coordination. |
| **DB Credentials** | 30 days (prod) / 90 days (dev) | 24h overlap via RDS Proxy | Secrets Manager native rotation with custom Lambda. RDS Proxy ensures zero-downtime credential swaps. | Production databases face the highest risk if compromised — they contain all tenant data. The 30-day interval follows NIST SP 800-57 guidance for symmetric keys protecting sensitive data. Development environments use 90 days to reduce operational friction. |
| **Tenant API Keys** | 90-day default expiry | 14 days | `api-key-rotation` Lambda generates successors automatically. SDK auto-rotation allows clients to transition seamlessly. | 90 days provides a reasonable balance for tenant-facing keys. The 14-day grace period gives tenants two weeks to transition, which accounts for deployment cycles, vacation periods, and weekend gaps. |
| **JWT Signing Keys** | 30 days | Dual-key window (lasts until next rotation = 30 days) | Secrets Manager native rotation with custom Lambda. Dual-key validation ensures zero-downtime. | JWT keys protect all authentication tokens. A compromised JWT signing key allows an attacker to forge tokens for any user. The 30-day interval limits the exposure window while the dual-key validation ensures existing tokens remain valid. |

### 14.2 Dormant Key Policy

The dormant key policy follows a progressive escalation model. Each stage provides an opportunity for the key owner to either use the key (which resets the dormancy clock) or explicitly revoke it (which shows intentional decommissioning).

| Threshold | Action | SNS Event Type | Reversible? | What Resets It |
|-----------|--------|---------------|------------|----------------|
| **30 days** unused | Set `dormant_flagged_at`, `dormant_warning_level = 'warning_30d'`. Publish first warning to SNS. | `KEY_DORMANT_WARNING` | Yes | Any API request using the key resets `dormant_flagged_at` and `dormant_warning_level` to `NULL`. |
| **45 days** unused | Update `dormant_warning_level = 'warning_45d'`. Publish final warning with auto-disable countdown. | `KEY_FINAL_WARNING` | Yes | Same as above — any use resets the entire dormancy state. |
| **60 days** unused | Set `is_active = false`. Log `auto_disabled` to audit trail. Publish disable notification. | `KEY_AUTO_DISABLED` | Partially — a platform administrator can re-enable the key via the admin dashboard or API (`PUT /api/admin/api-keys/{id}` with `{ is_active: true }`). The tenant cannot self-re-enable. | N/A (key is disabled; re-enabling starts a fresh dormancy clock). |

**Why these thresholds?**
- **30 days** is chosen to be shorter than the 45-day CIS AWS benchmark for IAM credentials, providing earlier warning for tenant keys (which have a larger attack surface than IAM keys because they are distributed to external parties).
- **45 days** provides a 15-day window between the first and final warning. This is enough time for a key owner to notice the first warning (even if they are on vacation or dealing with other priorities) and take action.
- **60 days** of complete inactivity is strong evidence that a key is no longer needed. Auto-disabling at this point follows the principle of least privilege — if a key isn't being used, it shouldn't be active.

### 14.3 Tenant-Configurable Settings

Tenants can customize key management policies via the tenant admin settings API or the admin dashboard. These settings affect how new keys are created for the tenant but do not retroactively change existing keys.

| Setting | Column | Default | Range | Description |
|---------|--------|---------|-------|-------------|
| **Default Expiry** | `api_key_default_expiry_days` | 90 | 1-365 | When a tenant creates a new key without specifying `expires_in_days`, this value is used. Set lower for higher-security tenants (e.g., 30 days for financial services). |
| **Max Expiry** | `api_key_max_expiry_days` | 365 | 1-3650 | The maximum `expires_in_days` value allowed. Even if a tenant tries to create a key expiring in 5 years, it will be capped at this value. This prevents "immortal" keys that never rotate. |
| **Require IP Restriction** | `require_api_key_ip_restriction` | `false` | boolean | When `true`, any `POST /keys` request without `allowed_ips` will be rejected with a `400 Bad Request` error. This forces the tenant to specify at least one CIDR range for every key, ensuring that all keys have network-level access control. Recommended for tenants handling sensitive data. |

**How to update these settings:**

Via admin dashboard: Navigate to **Tenants** → select tenant → **Security Settings** tab → update values → **Save**.

Via API:
```bash
curl -X PUT https://api.radiant.example.com/api/admin/tenants/{tenantId}/settings \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "api_key_default_expiry_days": 30,
    "api_key_max_expiry_days": 90,
    "require_api_key_ip_restriction": true
  }'
```

---

## 15. Deployment Guide

### 15.1 Prerequisites

Before deploying the Credential Lifecycle Security Framework, the following must be in place. Each prerequisite is listed with the reason it is needed and how to verify it.

| Prerequisite | Why It's Needed | How to Verify |
|-------------|----------------|---------------|
| **AWS CLI v2** | The Swift Deployer's audit service shells out to `aws` commands. CDK also requires the CLI for credential resolution and `cdk deploy`. | `aws --version` should show 2.x. If not installed: `brew install awscli` on macOS. |
| **Node.js 18+** | CDK v2 requires Node.js 18 or later. The Lambda functions are bundled with esbuild which requires Node.js. | `node --version` should show v18.x or later. |
| **CDK v2** | The `CredentialLifecycleStack` is a CDK v2 stack. CDK CLI is needed to synthesize and deploy. | `npx cdk --version` should show 2.x. If not installed: `npm install -g aws-cdk`. |
| **Aurora PostgreSQL cluster (DataStack)** | The dormant key audit and auto-rotation Lambdas query the `api_keys` table in Aurora. The DB credential rotation targets the Aurora cluster secret. | The DataStack must be deployed first. Verify: `aws rds describe-db-clusters --query 'DBClusters[].DBClusterIdentifier'`. |
| **SecurityStack** | Provides the KMS encryption key (`secretsKey`) used by the CredentialLifecycleStack for encrypting Lambda environment variables and SNS messages. | Verify: `aws kms list-aliases --query 'Aliases[?contains(AliasName, `radiant`)]'`. |
| **AWS Config enabled** | The four managed Config rules require AWS Config to be recording in the region. If Config is not enabled, the rules will deploy but will not evaluate. | `aws configservice describe-configuration-recorders --query 'ConfigurationRecorders[].recording'` should return `[true]`. |
| **IAM permissions** | The deploying principal needs permissions to create Config rules, IAM Access Analyzer, Lambda functions, EventBridge rules, SNS topics, and Secrets Manager rotation configurations. | Use an IAM role with the `AdministratorAccess` policy for initial deployment (acceptable because this is a one-time infrastructure setup). |

### 15.2 Deploy via CDK CLI

**Development environment:**
```bash
# Deploy to dev with alert email
# --require-approval broadening means CDK will ask for confirmation
# only if the deployment adds new IAM permissions or security group rules
npx cdk deploy *-credential-lifecycle \
  -c environment=dev \
  -c alertEmail=security@example.com \
  --require-approval broadening
```

**Production environment:**
```bash
# Use the production AWS profile
# In production, always use --require-approval broadening
# to prevent accidental permission escalation
AWS_PROFILE=radiant-prod npx cdk deploy *-credential-lifecycle \
  -c environment=prod \
  -c alertEmail=security-team@example.com \
  --require-approval broadening
```

**What happens during deployment:** CDK synthesizes the stack into a CloudFormation template, uploads Lambda function code to the CDK staging bucket, and creates/updates the CloudFormation stack. The deployment typically takes 3-5 minutes. You will see CloudFormation events streaming in the terminal as each resource is created.

**Common deployment issues:**
- `CDK_DEFAULT_ACCOUNT not set` — Run `aws sts get-caller-identity` to verify your credentials. Set `CDK_DEFAULT_ACCOUNT` and `CDK_DEFAULT_REGION` environment variables if needed.
- `Stack is in UPDATE_ROLLBACK_COMPLETE state` — The previous deployment failed and rolled back. Delete the stack first with `aws cloudformation delete-stack --stack-name {stackName}`, then redeploy.
- `Resource limit exceeded` — AWS Config has a limit of 150 rules per account. If you are close to this limit, remove unused rules before deploying.

### 15.3 Deploy via Swift Deployer

The Swift Deployer provides a GUI alternative to CLI deployment. See Section 8.4 for the detailed walkthrough. In summary:

1. Open Swift Deployer → select target environment
2. Navigate to **Credential Security** in the sidebar
3. Click **Deploy Stack** in the toolbar
4. Enter alert email (optional)
5. Click **Deploy to [environment]**
6. Monitor the real-time log output in the deployment sheet
7. When complete, run an audit to verify the deployed resources

### 15.4 Run Database Migration

The database migration adds the columns and functions needed for key restrictions, dormant tracking, and rotation lineage. It must be run after the CDK deployment but before the Lambda functions execute for the first time.

```bash
# Apply the credential lifecycle migration
# Replace the endpoint with your Aurora cluster endpoint
flyway -url=jdbc:postgresql://your-aurora-endpoint:5432/radiant \
  -user=radiant_admin \
  -password=$(aws secretsmanager get-secret-value --secret-id radiant/dev/db-credentials \
    --query 'SecretString' --output text | jq -r '.password') \
  migrate
```

**Verify the migration applied correctly:**
```sql
-- Check that new columns exist on api_keys
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'api_keys' AND column_name IN (
  'allowed_ips', 'allowed_origins', 'encryption_key_id',
  'dormant_flagged_at', 'dormant_warning_level',
  'replaced_by_key_id', 'replaces_key_id'
);

-- Check that new columns exist on tenants
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'tenants' AND column_name IN (
  'api_key_default_expiry_days', 'api_key_max_expiry_days',
  'require_api_key_ip_restriction'
);

-- Check that database functions exist
SELECT proname FROM pg_proc WHERE proname IN (
  'validate_api_key_with_restrictions', 'rotate_api_key'
);
```

### 15.5 Verify Deployment

After deploying and running the migration, verify all components are operational. Run each command and check the expected output:

```bash
# 1. Check Config rules are deployed and evaluating
# Expected: 4 rules, each showing COMPLIANT or NON_COMPLIANT
aws configservice describe-compliance-by-config-rule \
  --config-rule-names \
    iam-user-unused-credentials-check \
    access-keys-rotated \
    iam-root-access-key-check \
    root-account-mfa-enabled \
  --output table

# 2. Check Access Analyzer is deployed
# Expected: 1 analyzer of type ACCOUNT with status ACTIVE
aws accessanalyzer list-analyzers --output table

# 3. Check Secrets Manager rotation is enabled
# Expected: "RotationEnabled": true
aws secretsmanager describe-secret \
  --secret-id radiant/dev/db-credentials \
  --query '{RotationEnabled: RotationEnabled, RotationRules: RotationRules}'

# 4. Check scheduled Lambda functions exist
# Expected: 4 rules with State: ENABLED
aws events list-rules --name-prefix radiant-dev --output table

# 5. Check SNS topic exists and has subscribers
# Expected: Topic ARN and at least one subscription
aws sns list-topics --query 'Topics[?contains(TopicArn, `security-alerts`)]'
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:{region}:{account}:radiant-dev-security-alerts

# 6. Test the dormant key Lambda manually
# Expected: Successful invocation with audit results in the response
aws lambda invoke \
  --function-name radiant-dev-dormant-key-audit \
  --payload '{}' \
  /dev/stdout
```

### 15.6 Post-Deployment Checklist

After all verification steps pass, complete this checklist:

- [ ] Config rules showing compliance status (not "Not Applicable" which means Config is not recording)
- [ ] Access Analyzer is ACTIVE and has completed initial analysis
- [ ] DB secret rotation is enabled with correct interval
- [ ] All 4 scheduled Lambda functions are enabled
- [ ] SNS topic has at least one subscriber (security team email)
- [ ] Subscriber confirmed their SNS subscription (check email for confirmation link)
- [ ] Database migration applied successfully (new columns and functions exist)
- [ ] Run a full Swift Deployer audit to verify end-to-end connectivity
- [ ] Document the deployment in the operations log with date, deployer, and environment

---

## 16. Maintenance & Operations

### 16.1 Regular Maintenance Tasks

Each task below includes what to look for, how to interpret the results, and what actions to take.

**Weekly — Review Dormant Key Alerts (Platform Team)**

The SNS alert topic will send `KEY_DORMANT_WARNING` and `KEY_FINAL_WARNING` events as they occur. The platform team should review these weekly to identify keys that are approaching the 60-day auto-disable threshold.

*What to look for:* Keys at the 45-day (final warning) stage. These will be auto-disabled in 15 days. Contact the key owner (identifiable from the `created_by` field in the API key record) to determine if the key is still needed.

*Actions:*
- If the key is no longer needed → revoke it proactively (this is better than waiting for auto-disable because it shows intentional decommissioning)
- If the key is needed but rarely used → advise the key owner to implement a heartbeat call (see Section 6.1)
- If the key belongs to a departed employee → revoke immediately and audit the `api_key_audit_log` for any suspicious usage during the dormant period

**Weekly — Review Access Analyzer Findings (Security Team)**

Check the Access Analyzer in the AWS Console or via the Swift Deployer's "Access Analyzer" audit section. New findings appear when resource policies are modified to allow external access.

*What to look for:*
- Any finding with `isPublic: true` — this means a resource is accessible from the internet, which is almost always a misconfiguration
- New findings that appeared since the last review
- Findings that have been active for more than 30 days without being resolved or archived (these indicate that the security team is not keeping up with the finding backlog)

*Actions:*
- Public access findings → fix the resource policy immediately, then archive the finding
- Cross-account findings → verify with the resource owner that the cross-account access is intentional and documented
- Stale findings → either resolve them or archive them with a documented justification

**Monthly — Review IAM Access Report (Security Team)**

The monthly IAM report Lambda publishes to SNS on the first Monday of each month. This report provides a comprehensive snapshot of the IAM credential security posture.

*What to look for:*
- **Trend direction** — is the number of stale keys increasing or decreasing compared to last month? An increasing trend indicates that rotation processes are not being followed.
- **MFA enrollment** — any IAM user without MFA is a compliance finding. Track the percentage of MFA enrollment month-over-month. Target: 100%.
- **Users with 2 access keys** — AWS allows 2 keys per user to support rotation (create new key, update applications, delete old key). If users consistently have 2 keys, they are not completing the rotation process (not deleting the old key).
- **Keys never used** — keys that have never been used since creation were likely created by mistake or for a project that was never completed. These should be deleted.

*Actions:*
- Share the report with the security committee or management stakeholder
- Create action items for any Critical or High findings
- Track remediation progress on previous month's action items

**Monthly — Run Full Security Audit (Security Team)**

Open Swift Deployer → Credential Security → Run Audit. Review all 7 sections and compare compliance scores to the previous month.

*What to look for:* Any decline in compliance scores. Investigate which new findings caused the decline. Ensure that all previously-identified findings have been remediated.

**Quarterly — Update Rotation Schedules (Security Team)**

Review the rotation intervals and dormant key thresholds to ensure they still align with the organization's risk tolerance and compliance requirements. Consider tightening intervals if there have been security incidents, or loosening them if operational teams are struggling with rotation frequency.

**Quarterly — Update Pre-Commit Patterns (Security Team)**

Review the `.husky/pre-commit` hook patterns for new secret formats. As new services and integrations are added, new secret patterns may need to be detected. Check for new cloud provider key formats (GCP, Azure), new internal key formats, or new API integrations that use distinctive key patterns.

**Per Release — Review CDK-Nag Suppressions (DevOps)**

During each release cycle, review all `NagSuppressions.addResourceSuppressions()` calls in the CDK stacks. Ensure that:
- Each suppression still has a valid justification
- No new suppressions were added without proper review
- Previously temporary suppressions (e.g., "will fix in next sprint") have been addressed

### 16.2 Monitoring

**CloudWatch Metrics (Namespace: `RADIANT/Security`):**

These metrics are published by the monthly IAM report Lambda and can be used in CloudWatch dashboards and alarms:

| Metric | What It Measures | Alarm Threshold | What to Do When Alarmed |
|--------|-----------------|-----------------|------------------------|
| `StaleAccessKeys` | Count of IAM keys older than 90 days | > 0 | Identify the stale keys and rotate them. Any key over 90 days violates CIS 1.14. |
| `AccessAnalyzerFindings` | Count of active (unarchived) Access Analyzer findings | > 5 | Review findings in the console. A growing backlog indicates the team is not addressing findings promptly. |
| `MfaDisabledUsers` | Count of IAM users without MFA | > 0 | Contact the users and require MFA enrollment. Block console access for users who do not comply within 7 days. |
| `JwtSigningKeyRotation` | Count of successful JWT key rotations | = 0 for 35+ days | The JWT key should rotate every 30 days. If no rotation has occurred in 35 days, the Secrets Manager rotation may be stuck. Check the rotation Lambda logs. |

**CloudWatch Alarms to Create:**

```bash
# Alarm: Any stale IAM keys
aws cloudwatch put-metric-alarm \
  --alarm-name "RADIANT-StaleAccessKeys" \
  --metric-name StaleAccessKeys \
  --namespace "RADIANT/Security" \
  --statistic Maximum \
  --period 86400 \
  --threshold 0 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:{region}:{account}:radiant-{env}-security-alerts

# Alarm: MFA not universal
aws cloudwatch put-metric-alarm \
  --alarm-name "RADIANT-MfaNotUniversal" \
  --metric-name MfaDisabledUsers \
  --namespace "RADIANT/Security" \
  --statistic Maximum \
  --period 86400 \
  --threshold 0 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:{region}:{account}:radiant-{env}-security-alerts
```

**SNS Topics:**
- `radiant-{env}-security-alerts` — all security events from all components
- Subscribe security team email addresses, PagerDuty endpoints, or Slack webhook URLs
- **Important:** After subscribing a new email address, the subscriber must click the confirmation link in the SNS confirmation email. Unconfirmed subscriptions do not receive messages.

### 16.3 Updating Rotation Intervals

**Via CDK context variables:**
```bash
# Tighten IAM key rotation to 60 days and DB rotation to 14 days
npx cdk deploy *-credential-lifecycle \
  -c environment=prod \
  -c iamKeyRotationDays=60 \
  -c dbRotationDays=14 \
  -c alertEmail=security-team@example.com \
  --require-approval broadening
```

**Via Swift Deployer:** Click **Schedule** in the toolbar → adjust slider/input values → **Save Schedule** → then click **Deploy Stack** to apply the changes to the Lambda functions.

**Important:** Changing rotation intervals requires a CDK redeployment because the intervals are configured as Lambda environment variables and Config rule parameters. Simply saving the schedule in Swift Deployer does not change the live infrastructure — you must deploy afterward.

---

## 17. Troubleshooting

### 17.1 "API key has expired" (401 Unauthorized)

**Symptom:** API requests return `401 Unauthorized` with body `{"error": "API key has expired"}`.

**Root cause:** The key's `expires_at` timestamp has passed. This happens when the auto-rotation Lambda was unable to generate a successor (perhaps because the Lambda is not deployed or the database was unreachable), or when the tenant did not transition to the new key during the grace period.

**Diagnostic steps:**
1. Identify the key by running a hash lookup: `SELECT id, prefix, expires_at, replaced_by_key_id FROM api_keys WHERE key_hash = sha256('{raw_key}')`
2. Check if a successor key was generated: look at `replaced_by_key_id` — if it's non-null, a successor exists and the tenant should switch to it
3. Check the auto-rotation Lambda logs: `aws logs tail /aws/lambda/radiant-{env}-api-key-rotation --since 24h | grep {key_id}`
4. If no successor was generated, check why: was the Lambda invoked? Did it encounter a database error?

**Resolution:**
- If a successor key exists → notify the tenant of the new key prefix and advise them to use the rotation API to get a fresh key
- If no successor exists → manually rotate via `POST /api/admin/api-keys/{id}/rotate` in the admin dashboard, then provide the new key to the tenant
- If the Lambda is not deployed → deploy the CredentialLifecycleStack (Section 15)

### 17.2 "Source IP not in allowed list" (403 Forbidden)

**Symptom:** API requests return `403 Forbidden` with body `{"error": "Source IP not in allowed list"}`.

**Root cause:** The request originated from an IP address not covered by any CIDR range in the key's `allowed_ips` array. This commonly happens when a tenant's application migrates to a new server or when the egress IP changes (e.g., after scaling, failover, or VPN reconfiguration).

**Diagnostic steps:**
1. Check which IP the request came from: the error response includes the source IP in development mode, or check API Gateway access logs
2. Look up the key's allowed IPs: `SELECT allowed_ips FROM api_keys WHERE prefix = '{prefix}'`
3. Verify whether the source IP should be in the allowed list by checking with the tenant

**Resolution:**
- If the IP is legitimate → update `allowed_ips` via `PUT /api/admin/api-keys/{id}/restrictions` or the admin dashboard's Manage Restrictions dialog
- If the IP is not recognized → this may indicate a security incident. Do NOT add the IP. Instead, investigate where the request came from and whether the key has been compromised.

### 17.3 "Origin not in allowed list" (403 Forbidden)

**Symptom:** Browser-based API requests return `403 Forbidden` with body `{"error": "Origin not in allowed list"}`.

**Root cause:** The browser is sending an `Origin` header that does not match any entry in the key's `allowed_origins` array. This is common when deploying a frontend application to a new domain, adding a staging environment, or switching between `http://localhost:3000` (development) and the production URL.

**Diagnostic steps:**
1. Check the request's `Origin` header in the browser's Network tab
2. Look up the key's allowed origins: `SELECT allowed_origins FROM api_keys WHERE prefix = '{prefix}'`
3. Note that `Origin` matching is exact — `https://app.example.com` does NOT match `https://app.example.com:443` or `http://app.example.com`

**Resolution:** Add the correct origin to `allowed_origins` via the restrictions API or admin dashboard. Remember to include all environments (localhost, staging, production) that use this key.

### 17.4 AWS Config Rule Shows NON_COMPLIANT

**Symptom:** An AWS Config rule evaluation shows NON_COMPLIANT for one or more resources.

**Diagnostic steps:**
1. `aws configservice get-compliance-details-by-config-rule --config-rule-name {rule-name} --compliance-types NON_COMPLIANT` — lists the specific non-compliant resources
2. For `access-keys-rotated`: the resource ID is the IAM user. Check the key age with `aws iam list-access-keys --user-name {username}`
3. For `iam-user-unused-credentials-check`: check last used dates with `aws iam get-access-key-last-used --access-key-id {keyId}`

**Resolution:** Rotate or disable the flagged credentials. After remediation, the Config rule will re-evaluate within 24 hours (or immediately if triggered by a configuration change).

### 17.5 Secrets Manager Rotation Fails

**Symptom:** The DB credential rotation or JWT signing rotation fails. CloudWatch logs show errors in the rotation Lambda.

**Diagnostic steps:**
1. Check the rotation Lambda logs: `aws logs tail /aws/lambda/radiant-{env}-{rotation-function-name} --since 24h`
2. Common failure reasons:
   - **Lambda timeout:** The rotation Lambda has a 5-minute timeout. If the Aurora cluster is slow to accept the new credential (e.g., during heavy load), the Lambda may time out. Check if the rotation completed partially.
   - **IAM permission denied:** The rotation Lambda's IAM role must have `secretsmanager:GetSecretValue`, `secretsmanager:PutSecretValue`, `secretsmanager:UpdateSecretVersionStage`, and the ability to connect to Aurora. Check the role's policy.
   - **Secret version conflict:** If a previous rotation failed mid-way, the secret may have an `AWSPENDING` version that was never promoted. This blocks new rotations.
3. Check the secret's version stages: `aws secretsmanager describe-secret --secret-id {secret-id} --query 'VersionIdsToStages'`

**Resolution:**
- If there's a stuck `AWSPENDING` version: `aws secretsmanager update-secret-version-stage --secret-id {secret-id} --version-stage AWSPENDING --remove-from-version-id {stuck-version-id}` — this clears the stuck version and allows rotation to proceed
- If the Lambda role lacks permissions: update the CDK stack to grant the missing permissions and redeploy
- If the Lambda is timing out: increase the timeout in the CDK stack (up to 15 minutes) and consider whether Aurora is under excessive load

### 17.6 JWT Validation Fails After Rotation

**Symptom:** After a JWT signing key rotation, some requests fail with `401 Unauthorized` and the error indicates JWT signature verification failure.

**Root cause:** The verification logic is not checking `AWSPREVIOUS` after `AWSCURRENT` fails. This means JWTs signed with the old key are being rejected.

**Diagnostic steps:**
1. Verify that the JWT verification code checks both key versions:
   - First attempt: verify with `AWSCURRENT`
   - If that fails: verify with `AWSPREVIOUS`
   - If both fail: reject the JWT
2. Check if `AWSPREVIOUS` exists: `aws secretsmanager describe-secret --secret-id {jwt-secret-id} --query 'VersionIdsToStages'` — there should be a version with `AWSPREVIOUS` stage
3. If `AWSPREVIOUS` is missing, a previous rotation may have failed to properly promote versions

**Resolution:** Fix the JWT verification logic to check both `AWSCURRENT` and `AWSPREVIOUS`. If `AWSPREVIOUS` is missing, the old key's version may have been cleaned up — in this case, affected JWTs are permanently invalid and users will need to re-authenticate.

### 17.7 SDK Auto-Rotation Not Firing

**Symptom:** The SDK's `onKeyExpiring` callback is never called, even though the key is approaching expiry.

**Diagnostic steps:**
1. **Check if the server sends the header:** Use `curl -v` or the browser's Network tab to check if `X-Key-Expires-In` is present in API responses. If the header is missing, the auth middleware may not be running (or the key has no `expires_at`).
2. **Check the threshold:** The callback only fires when the header value ≤ `keyExpiryThresholdDays`. If the key expires in 20 days and the threshold is 14, the callback will not fire yet.
3. **Check for `_rotationInProgress` lock:** If a previous rotation attempt threw an error without clearing the flag, subsequent attempts will be blocked. Enable `debug: true` in the SDK config to see rotation-related log messages.
4. **Check callback registration:** Ensure `onKeyExpiring` is provided in the SDK config and is an async function that returns a string or null.

**Resolution:** Fix the identified issue. If the flag is stuck, recreate the client instance. If the header is missing, check the auth middleware deployment.

### 17.8 Log Locations Reference

| Component | Log Location | How to Access | What to Search For |
|-----------|-------------|---------------|-------------------|
| Dormant key Lambda | CloudWatch: `/aws/lambda/radiant-{env}-dormant-key-audit` | `aws logs tail /aws/lambda/radiant-{env}-dormant-key-audit --since 24h` | Key IDs being flagged, escalation actions, auto-disable events |
| Rotation Lambda | CloudWatch: `/aws/lambda/radiant-{env}-api-key-rotation` | `aws logs tail /aws/lambda/radiant-{env}-api-key-rotation --since 24h` | Keys entering grace period, successor generation, expiry disables |
| JWT rotation Lambda | CloudWatch: `/aws/lambda/radiant-{env}-jwt-signing-rotation` | `aws logs tail /aws/lambda/radiant-{env}-jwt-signing-rotation --since 24h` | Rotation step transitions (create→set→test→finish), errors |
| IAM report Lambda | CloudWatch: `/aws/lambda/radiant-{env}-iam-access-report` | `aws logs tail /aws/lambda/radiant-{env}-iam-access-report --since 30d` | Report generation, metric publication, findings counts |
| Auth middleware | CloudWatch: API Gateway execution logs | AWS Console → API Gateway → Stages → Logs/Tracing | Key validation failures, IP/origin rejections, 401/403 responses |
| Swift Deployer | macOS Console.app | Console.app → filter by process `RadiantDeployer` | Audit execution, AWS CLI output, remediation actions |
| Config rules | AWS Config Console → Compliance timeline | AWS Console → Config → Rules → {rule-name} → Compliance timeline | Non-compliant resource evaluations, compliance transitions |

### 17.9 Emergency Key Revocation

**Scenario:** You suspect a key has been compromised and need to disable it immediately.

**For tenant API keys — via API:**
```bash
# Revoke immediately (takes effect on next request, <50ms database update)
curl -X POST https://api.radiant.example.com/api/v1/tenant/keys/{keyId}/revoke \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Suspected compromise - ticket SEC-1234"}'
```

**For tenant API keys — via admin dashboard:**
Navigate to `/api-keys` → find the key → dropdown menu → "Revoke Key" → confirm.

**For IAM access keys:**
```bash
# Step 1: Disable immediately (key stops working, but can be re-enabled)
aws iam update-access-key --user-name USERNAME \
  --access-key-id AKIAEXAMPLE --status Inactive

# Step 2: After confirming the impact, delete permanently
aws iam delete-access-key --user-name USERNAME \
  --access-key-id AKIAEXAMPLE
```

**For DB credentials:**
```bash
# Trigger immediate rotation (replaces the compromised credential)
aws secretsmanager rotate-secret --secret-id radiant/{env}/db-credentials
```

**For JWT signing keys:**
```bash
# Trigger immediate rotation (new key for signing, old key still validates)
aws secretsmanager rotate-secret --secret-id radiant/{env}/jwt-signing-key
```

---

## 18. Audit & Reporting

### 18.1 Audit Log Schema

The `api_key_audit_log` table records every credential lifecycle event. This table is append-only — records are never updated or deleted, providing a tamper-evident audit trail. The table is partitioned by `created_at` for efficient querying of recent events while retaining the full history.

| Column | Type | Content | Example |
|--------|------|---------|---------|
| `id` | `UUID` | Unique event ID | `550e8400-e29b-41d4-a716-446655440000` |
| `tenant_id` | `UUID` | Owning tenant (for RLS filtering) | `tenant-uuid` |
| `key_id` | `UUID` | The API key affected by this event | `key-uuid` |
| `action` | `VARCHAR(50)` | The lifecycle event type | `created`, `rotated`, `revoked`, `expired`, `auto_disabled`, `restrictions_updated` |
| `performed_by` | `UUID` | The user or system that performed the action. For automated actions (dormant disable, auto-rotation), this is a system account UUID. | `user-uuid` or `system-rotation-uuid` |
| `details` | `JSONB` | Event-specific data with full context | See examples below |
| `source_ip` | `INET` | IP address of the requester (for human-initiated actions) | `192.168.1.100` |
| `created_at` | `TIMESTAMPTZ` | When the event occurred | `2026-02-10T14:30:00Z` |

**Example `details` JSONB for each action type:**

```json
// action: "created"
{
  "key_prefix": "rad_7Bx9kQ",
  "scopes": ["chat", "models"],
  "expires_at": "2026-05-11T00:00:00Z",
  "allowed_ips": ["10.0.0.0/8"],
  "interface_type": "api"
}

// action: "rotated"
{
  "old_key_id": "old-key-uuid",
  "new_key_id": "new-key-uuid",
  "new_key_prefix": "rad_9Xm2pL",
  "rotation_type": "self_service",  // or "auto_rotation"
  "reason": "Scheduled rotation"
}

// action: "revoked"
{
  "reason": "Suspected compromise - ticket SEC-1234",
  "revoked_by": "admin-user-uuid"
}

// action: "auto_disabled"
{
  "reason": "dormant_60d",
  "dormant_since": "2026-01-11T00:00:00Z",
  "warning_history": ["30d: 2026-01-11", "45d: 2026-01-26"]
}

// action: "restrictions_updated"
{
  "old_allowed_ips": ["10.0.0.0/8"],
  "new_allowed_ips": ["10.0.0.0/8", "192.168.1.0/24"],
  "old_allowed_origins": null,
  "new_allowed_origins": ["https://app.example.com"]
}
```

**Querying the audit log:**
```sql
-- All events for a specific key in the last 30 days
SELECT action, performed_by, details, created_at
FROM api_key_audit_log
WHERE key_id = '{key-uuid}'
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- All auto-disable events across all tenants (for security review)
SELECT ak.prefix, t.name as tenant_name, aal.details, aal.created_at
FROM api_key_audit_log aal
JOIN api_keys ak ON ak.id = aal.key_id
JOIN tenants t ON t.id = aal.tenant_id
WHERE aal.action = 'auto_disabled'
  AND aal.created_at > NOW() - INTERVAL '7 days'
ORDER BY aal.created_at DESC;

-- Rotation history for a key chain (follow the lineage)
WITH RECURSIVE key_chain AS (
  SELECT id, prefix, replaces_key_id, created_at, 1 as generation
  FROM api_keys WHERE id = '{current-key-uuid}'
  UNION ALL
  SELECT ak.id, ak.prefix, ak.replaces_key_id, ak.created_at, kc.generation + 1
  FROM api_keys ak
  JOIN key_chain kc ON ak.id = kc.replaces_key_id
)
SELECT * FROM key_chain ORDER BY generation;
```

### 18.2 Monthly Report Interpretation Guide

The monthly IAM access report is published to SNS as a structured JSON document. Here is how to interpret each section and what actions to take:

**Section: "summary"** — High-level numbers. Compare these month-over-month.
- `total_users`: Total IAM users in the account. Should be stable. A sudden increase may indicate unauthorized user creation.
- `total_access_keys`: Total active keys. Should correlate with the number of service accounts.
- `mfa_enrollment_percent`: Target is 100%. Any number below 100% is a finding.
- `stale_key_count`: Keys over 90 days old. Target is 0.

**Section: "access_key_details"** — Per-key breakdown. Focus on Critical and High risk keys.
- Review each Critical key (>365 days old) and create an action item to rotate or delete it
- Review each High key (90-365 days old) and determine if rotation is in progress

**Section: "access_analyzer_summary"** — Finding counts by type.
- `public_findings`: Should be 0. Any non-zero count requires immediate investigation.
- `cross_account_findings`: Review each one to ensure it is intentional and documented.

**Section: "recommendations"** — Prioritized action items. Execute in order of severity (CRITICAL → HIGH → MEDIUM → INFO).

---

## 19. Incident Response Procedures

### 19.1 Suspected Tenant API Key Compromise

**Severity:** HIGH | **Target response time:** < 15 minutes

This playbook is triggered when there is evidence or suspicion that a tenant's API key has been compromised — for example, a tenant reports unauthorized usage, an anomalous traffic pattern is detected, or a key is found in a public repository.

**Minute 0–2: Contain**
1. **Immediately revoke** the suspected key:
   ```bash
   curl -X POST https://api.radiant.example.com/api/v1/tenant/keys/{keyId}/revoke \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"reason": "Incident response - suspected compromise"}'
   ```
   This takes effect within milliseconds. The next request using this key will receive a 401.

2. **Check for related keys:** Query the key's lineage to see if predecessor or successor keys should also be revoked:
   ```sql
   SELECT id, prefix, is_active, replaced_by_key_id, replaces_key_id
   FROM api_keys WHERE tenant_id = '{tenant-id}' AND is_active = true;
   ```

**Minute 2–10: Assess**
3. **Audit usage of the compromised key:** Query the audit log and request logs to determine what the key was used for:
   ```sql
   SELECT action, details, source_ip, created_at
   FROM api_key_audit_log
   WHERE key_id = '{key-id}'
   ORDER BY created_at DESC LIMIT 100;
   ```

4. **Check API Gateway access logs** for requests made with this key's hash. Look for:
   - Unusual source IPs (especially if the key had IP restrictions that were not in place)
   - Unusual endpoints accessed (especially admin endpoints)
   - Unusual request volumes or patterns
   - Requests outside normal business hours

5. **Determine the scope of compromise:**
   - What scopes did the key have? (chat only? admin access?)
   - Was data accessed? (check inference logs for the tenant)
   - Were settings modified? (check tenant admin audit logs)

**Minute 10–30: Remediate**
6. **Generate a replacement key** for the tenant:
   ```bash
   curl -X POST https://api.radiant.example.com/api/v1/tenant/keys \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"tenant_id": "{tenant-id}", "scopes": [...], "allowed_ips": [...]}'
   ```
   Ensure the new key has appropriate restrictions (IP, origin, scope) to prevent recurrence.

7. **Notify the tenant** with:
   - Confirmation that the compromised key has been revoked
   - The new key (via secure channel — not email)
   - A summary of what access the compromised key provided
   - Recommendations for how the compromise may have occurred
   - Guidance on rotating any credentials that may have been accessed via the compromised key

**Minute 30+: Document**
8. **Create an incident record** with:
   - Timeline of events
   - How the compromise was detected
   - What data was potentially exposed
   - Remediation steps taken
   - Root cause analysis (how did the key get compromised?)
   - Recommendations to prevent recurrence

### 19.2 Suspected IAM Access Key Compromise

**Severity:** CRITICAL | **Target response time:** < 5 minutes

IAM key compromise is more severe than tenant API key compromise because IAM keys can access AWS infrastructure directly. An attacker with an IAM key can potentially create new resources, exfiltrate data from S3, or modify security configurations.

**Minute 0–1: Contain**
1. **Immediately disable** the key (disable first, investigate second):
   ```bash
   aws iam update-access-key --user-name {username} \
     --access-key-id {AKIA...} --status Inactive
   ```

2. **Check for other keys** on the same user:
   ```bash
   aws iam list-access-keys --user-name {username}
   ```
   If the user has a second key, evaluate whether it should also be disabled.

**Minute 1–5: Assess**
3. **Check CloudTrail** for actions performed with this key in the last 24 hours:
   ```bash
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=AccessKeyId,AttributeValue={AKIA...} \
     --max-results 50 --output json
   ```

4. **Look for high-risk actions:** Resource creation (EC2 instances, Lambda functions, IAM users), S3 data access, security group modifications, IAM policy changes, and credential creation.

**Minute 5–15: Remediate**
5. **Rotate the key** (create new key for the user, distribute securely, delete old key):
   ```bash
   aws iam create-access-key --user-name {username}
   # Securely deliver the new key to the user
   aws iam delete-access-key --user-name {username} --access-key-id {old-AKIA...}
   ```

6. **Review and revert any unauthorized changes** found in CloudTrail.

7. **If crypto-mining or unauthorized resources were created,** terminate them immediately and check all regions (attackers often launch resources in regions that are not normally monitored).

**Minute 15+: Document and prevent**
8. **Root cause analysis:** How was the key exposed? Common vectors include: committed to a public repository, stored in an insecure location, shared via email or chat, or stolen from a compromised workstation.
9. **Preventive measures:** Enforce MFA for the user, restrict the new key's permissions to the minimum required, and consider using temporary credentials (STS) instead of long-lived access keys.

### 19.3 Mass Rotation (Breach Response)

**Severity:** CRITICAL | **Trigger:** Evidence of a broad security breach (e.g., database compromise, infrastructure-level intrusion)

This playbook covers the scenario where you need to rotate ALL credentials across the platform — not just a single key. This is the most disruptive security operation and should only be triggered when there is strong evidence of a broad compromise.

**Phase 1 — Assessment (30 minutes)**
1. Run a full Swift Deployer audit across all environments (dev, staging, prod)
2. Identify the scope: which credential types are potentially compromised? (IAM keys, DB credentials, tenant API keys, JWT signing keys, or all of the above)
3. Get management approval for mass rotation (this will cause tenant-facing service disruptions)
4. Notify the on-call team and set up a war room

**Phase 2 — Infrastructure Credentials (1 hour)**
5. **IAM keys:** Use the Swift Deployer remediation menu to rotate each key, or batch via CLI:
   ```bash
   for user in $(aws iam list-users --query 'Users[].UserName' --output text); do
     for key in $(aws iam list-access-keys --user-name $user --query 'AccessKeyMetadata[].AccessKeyId' --output text); do
       echo "Rotating key $key for user $user"
       aws iam create-access-key --user-name $user
       aws iam update-access-key --user-name $user --access-key-id $key --status Inactive
     done
   done
   ```
   **Warning:** This will break all applications using IAM keys. New keys must be distributed before old keys are deleted.

6. **DB credentials:** Trigger immediate Secrets Manager rotation:
   ```bash
   aws secretsmanager rotate-secret --secret-id radiant/{env}/db-credentials
   ```
   RDS Proxy will handle the transition transparently.

7. **JWT signing keys:** Trigger immediate rotation:
   ```bash
   aws secretsmanager rotate-secret --secret-id radiant/{env}/jwt-signing-key
   ```
   Existing JWTs will remain valid via the dual-key validation window.

**Phase 3 — Tenant API Keys (2-4 hours)**
8. **Bulk rotation of tenant API keys:** This is the most complex step because each tenant needs to be notified and given their new key.
   ```sql
   -- Identify all active tenant keys
   SELECT t.name, ak.id, ak.prefix, ak.scopes
   FROM api_keys ak
   JOIN tenants t ON t.id = ak.tenant_id
   WHERE ak.is_active = true AND ak.revoked_at IS NULL;
   ```
9. For each tenant, use the rotation API to generate successor keys and notify tenants via their configured communication channels.

**Phase 4 — Monitoring (24-72 hours)**
10. Monitor for authentication failures (401/403 responses) that indicate keys that were not properly rotated
11. Monitor CloudTrail and API Gateway logs for any continued use of old credentials
12. Conduct a follow-up audit after 24 hours to verify all old credentials have been deactivated

---

## 20. Glossary

| Term | Definition |
|------|-----------|
| **Access Analyzer** | An AWS service that continuously analyzes resource-based policies (S3, IAM, KMS, Lambda, SQS, Secrets Manager) to identify resources shared with external principals. Deployed as an ACCOUNT-type analyzer in each RADIANT environment. Findings trigger EventBridge events that route to the SNS security alert topic. |
| **AWSCURRENT / AWSPREVIOUS** | Secrets Manager version stage labels. `AWSCURRENT` is the active version that applications retrieve by default. `AWSPREVIOUS` is the previous version, kept after rotation for backward compatibility (critical for the JWT dual-key validation window). During rotation, `AWSPENDING` is created first, then promoted to `AWSCURRENT`. |
| **CDK-Nag** | A CDK Aspects-based linting tool that checks synthesized CloudFormation templates against security best practice rule packs (e.g., AwsSolutions, HIPAA, NIST). RADIANT enables the AwsSolutions pack in production deployments. Findings block `cdk deploy` unless suppressed with a documented justification. |
| **CIDR** | Classless Inter-Domain Routing — a notation for IP address ranges. Example: `10.0.0.0/8` means all IP addresses from 10.0.0.0 to 10.255.255.255. Used in the `allowed_ips` column on API keys to restrict which source IPs can use a key. PostgreSQL's `inet <<= inet` operator handles CIDR containment checks natively. |
| **Config Rule** | An AWS Config managed rule that continuously evaluates resource configurations against a defined policy. RADIANT deploys 4 credential-related rules: unused credentials (45d), key rotation (90d), root key check, and root MFA. Rules evaluate on resource changes and on a 24-hour periodic schedule. |
| **Cryptoperiod** | NIST SP 800-57 defines this as the time span during which a specific cryptographic key is authorized for use. For RADIANT: API key cryptoperiod = 90 days (default), JWT signing key = 30 days, IAM keys = 90 days (alert threshold). Cryptoperiods balance security (shorter = less exposure) against operational burden (shorter = more frequent rotation). |
| **Dormant Key** | An API key that has not been used for 30+ consecutive days. Dormancy is determined by comparing `last_used_at` to `NOW()`. The 30-day threshold was chosen to be shorter than the 45-day CIS AWS benchmark for IAM credentials, providing an additional safety margin. Dormant keys follow a 30→45→60 day escalation (warn → final warn → auto-disable). |
| **Dual-Key Validation** | The period after JWT signing key rotation where both the new key (`AWSCURRENT`) and old key (`AWSPREVIOUS`) are accepted for JWT signature verification. This prevents existing JWTs (signed with the old key) from being rejected during their natural expiry window. The dual-key window lasts until the next rotation (30 days), which is far longer than the typical JWT lifetime (24 hours). |
| **Envelope Encryption** | A two-tier encryption pattern where a KMS key (the "master key") encrypts a data key, and the data key encrypts the actual data. In RADIANT, the `encryption_key_id` column on API keys supports optional envelope encryption of the key hash for high-security tenants. This means even a database breach plus database decryption would not reveal key hashes without also having the KMS key. |
| **Grace Period** | The window before a key's `expires_at` date during which the auto-rotation Lambda generates a successor key. Default: 14 days. During the grace period, both the old key and the new successor are active simultaneously, allowing the key owner to transition at their convenience without downtime. The grace period starts when `expires_at - NOW() ≤ grace_period_days`. |
| **Key Hash** | The SHA-256 hash of the raw API key, stored in the `key_hash` column. The raw key is never stored — only the hash. When a request arrives, the auth middleware hashes the presented key and compares the hash against the database. This pattern (used by GitHub, Stripe, AWS) means a database breach does not expose usable credentials. |
| **Key Prefix** | The first 6-10 characters of an API key after the `rad_` prefix (e.g., `rad_7Bx9kQ`). Stored in the `prefix` column for identification purposes. The prefix allows administrators to identify which key is being discussed in logs and support tickets without needing the full key. It is not sufficient to authenticate — the full key is required. |
| **RLS (Row-Level Security)** | A PostgreSQL feature that restricts which rows a query can access based on the current session's context. RADIANT uses `app.current_tenant_id` set via `set_config()` at the start of each transaction. This ensures that even if a Lambda function is compromised, it can only access data for the specific tenant whose request it is handling. |
| **Rotation Lineage** | The chain of `replaces_key_id` / `replaced_by_key_id` references that track key succession. When key A is rotated to create key B, A's `replaced_by_key_id` points to B, and B's `replaces_key_id` points to A. This creates a doubly-linked list that auditors can traverse to see the full history of a key's rotations. The recursive CTE query in Section 18.1 demonstrates how to follow the chain. |
| **SNS Alert Topic** | The Amazon SNS topic (`radiant-{env}-security-alerts`) that receives all security events from the framework. Subscribers (email, HTTPS endpoints, SQS queues) receive notifications for: dormant key warnings, key rotations, key expirations, Access Analyzer findings, and Config rule non-compliance. Each event includes a JSON payload with the event type, affected resource, and recommended action. |

---

*This document is part of the RADIANT comprehensive documentation set. It must be updated whenever credential management, security infrastructure, rotation policies, or compliance requirements change. See `docs/DOCUMENTATION-MANIFEST.json` for the trigger matrix.*
