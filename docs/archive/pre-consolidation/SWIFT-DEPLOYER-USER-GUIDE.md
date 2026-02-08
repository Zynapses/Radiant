# RADIANT Swift Deployer - macOS App Documentation

**Version**: 7.4.0  
**Platform**: macOS 13.0+ (Ventura and later)  
**Last Updated**: February 4, 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [What's New in v7.0.0](#2-whats-new-in-v700)
3. [System Requirements](#3-system-requirements)
4. [Installation](#4-installation)
5. [First Launch & Setup](#5-first-launch--setup)
6. [Navigation Structure](#6-navigation-structure)
7. [Dashboard](#7-dashboard)
8. [Deploy](#8-deploy)
9. [Credentials Management](#9-credentials-management)
10. [Instance Management](#10-instance-management)
11. [Packages](#11-packages)
12. [Migrations](#12-migrations)
13. [Snapshots](#13-snapshots)
14. [History](#14-history)
15. [Drift Monitor](#15-drift-monitor)
    - 15.1 [Environment State Registry](#151-environment-state-registry)
    - 15.2 [Reliability & Storage Configuration](#152-reliability--storage-configuration)
    - 15.3 [AWS Snapshots (Disaster Recovery)](#153-aws-snapshots-disaster-recovery)
16. [Settings](#16-settings)
17. [AI Assistant](#17-ai-assistant)
18. [AutoSetup Service](#18-autosetup-service)
19. [Deployment Automation](#19-deployment-automation)
    - 19.1 [Dependencies Manager](#191-dependencies-manager)
    - 19.2 [Bash Script Runner](#192-bash-script-runner)
    - 19.3 [Code Sync](#193-code-sync)
20. [Security Architecture](#20-security-architecture)
21. [Troubleshooting](#21-troubleshooting)
22. [Keyboard Shortcuts](#22-keyboard-shortcuts)
23. [Glossary](#23-glossary)

---

## 1. Overview

The RADIANT Swift Deployer is a native macOS application for deploying and managing RADIANT AI platform infrastructure on AWS. **Version 7.0.0** introduces a dramatically simplified interface focused on deployment automation.

### Philosophy

> **"One Click to Production"** - Everything should be automated. The Deployer handles infrastructure; configuration lives in the Admin Dashboard.

### What the Deployer Does

| Category | Capability |
|----------|------------|
| **Deploy** | One-click deployment to dev/staging/prod |
| **Credentials** | AWS key management with automatic rotation |
| **Instances** | Start, stop, or wipe entire environments |
| **Migrate** | Promote versions through environments |
| **Monitor** | Detect infrastructure drift from manual changes |
| **Backup** | Snapshot and restore capabilities |

### What Moved to Admin Dashboard

AI providers, models, user management, domain configuration, and all business settings are now managed via the web-based Admin Dashboard after deployment.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 RADIANT Swift Deployer v7.0.0                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Credentials  │  │  AWS SDK     │  │  CDK CLI     │          │
│  │  Manager     │  │  (Direct)    │  │  Deployment  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                 │                    │
│         ▼                 ▼                 ▼                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    AWS Account                           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │ Secrets │ │ Aurora  │ │ Lambda  │ │CloudFront│       │   │
│  │  │ Manager │ │ (DB)    │ │ (100+)  │ │ (CDN)   │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. What's New in v7.0.0

### Simplified Navigation

**Before (v6.x)**: 22 tabs across 7 sidebar sections  
**After (v7.0.0)**: 10 tabs in a single flat list

| Change | Impact |
|--------|--------|
| **-12 views removed** | Configuration moved to Admin Dashboard |
| **+Credentials tab** | AWS key management with rotation |
| **+Instance Management** | Start/stop/wipe environments |
| **+Drift Monitor** | AI-powered drift detection |
| **+Migration Pipeline** | Visual dev→staging→prod promotion |

### New Features

| Feature | Description |
|---------|-------------|
| **AutoSetup** | Fully automated AWS configuration (Route53, ACM, SES, etc.) |
| **Credentials Management** | Master key + environment keys with version history |
| **Instance Lifecycle** | Start/stop/nuclear wipe per environment |
| **Drift Detection** | Detect when manual AWS changes cause drift |
| **Shadow Deployments** | Canary releases with traffic splitting |

### Removed from Deployer

These features are now **Admin Dashboard only**:
- AI Provider configuration
- Model settings
- Self-hosted model management
- Domain URL configuration
- Multi-region setup
- Curator configuration
- A/B Testing setup

---

## 2.1 What's New in v7.4.0

### Complete API Implementation

The following features now have full AWS API integration:

| Feature | Status | Description |
|---------|--------|-------------|
| **AWS Snapshots** | ✅ Complete | Full RDS, DynamoDB, and Secrets backup/restore |
| **Domain Validation** | ✅ Complete | DNS, SSL, CloudFront validation service |
| **CDK Context** | ✅ Complete | All feature flags passed to infrastructure |

### New Navigation Tabs

| Tab | Icon | Purpose |
|-----|------|---------|
| **Domain URLs** | 🌐 | Configure custom domains and routing |
| **Curator** | 📚 | Knowledge graph curation settings |
| **Cortex Memory** | 🧠 | Three-tier memory system configuration |

### New Settings Views

#### Cortex Memory Settings

Configure the three-tier memory system:

| Tier | Settings |
|------|----------|
| **Working Memory** | Enable, capacity (5-50 items), TTL (1-60 min) |
| **Episodic Memory** | Enable, retention (7-365 days), max episodes |
| **Semantic Memory** | Enable, consolidation schedule, quality threshold |

Additional options:
- Memory compression (0.3-0.9 ratio)
- Auto-forget threshold
- Cross-conversation memory
- Privacy mode

#### Curator Settings

Configure knowledge graph curation:

| Category | Settings |
|----------|----------|
| **Knowledge Graph** | Entity extraction, relationship inference, graph density |
| **Document Processing** | Chunk size, overlap, embedding model, auto-summarize |
| **Quality Control** | Deduplication, similarity threshold, fact verification |
| **Retrieval** | Hybrid search, semantic/keyword weights, re-ranking |

### DomainValidationService

New service for comprehensive domain validation:

```swift
// DNS validation
let dnsResult = await domainValidationService.validateDNS(domain: "api.example.com")

// SSL certificate check
let sslResult = await domainValidationService.checkSSLCertificate(arn: certArn)

// CloudFront validation
let cfResult = await domainValidationService.validateCloudFrontDistribution(id: distributionId)

// Complete domain setup validation
let fullResult = await domainValidationService.validateDomainSetup(
    domain: "example.com",
    certificateArn: certArn,
    distributionId: cfId
)
```

### CDK Context Parameters

All feature flags are now properly passed to CDK:

```
enableCurator, enableCortexMemory, enableTimeMachine
enableCollaboration, enableComplianceExport, enableEgoSystem
baseDomain, useSubdomains, sslCertificateArn, appPaths
```

---

## 3. System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| **macOS** | 13.0 (Ventura) or later |
| **Processor** | Apple Silicon (M1/M2/M3) or Intel |
| **Memory** | 8 GB RAM |
| **Storage** | 2 GB available space |
| **Network** | Stable internet connection |

### Required Software

| Software | Purpose | Installation |
|----------|---------|--------------|
| **AWS CLI v2** | AWS operations | `brew install awscli` |
| **Node.js 20+** | CDK runtime | `brew install node@20` |
| **AWS CDK** | Infrastructure deployment | `npm install -g aws-cdk` |

### Optional Software

| Software | Purpose | When Needed |
|----------|---------|-------------|
| **1Password** | Alternative credential storage | If not using built-in |
| **Docker** | Local testing | Development only |

### AWS Account Requirements

- AWS account with administrator access
- IAM user with deployment permissions (or use master key to create)
- Sufficient service quotas for:
  - Aurora PostgreSQL clusters
  - Lambda functions (100+)
  - S3 buckets
  - CloudFront distributions

---

## 4. Installation

### Download

1. Download `Radiant Deployer.app` from the releases page
2. Move to `/Applications` folder
3. Right-click → **Open** (first launch only, to bypass Gatekeeper)

### First Launch Security

On first launch, macOS may show a security warning:

1. Click **Cancel** on the warning dialog
2. Open **System Settings** → **Privacy & Security**
3. Scroll down and click **Open Anyway**
4. Click **Open** in the confirmation dialog

### Verify Installation

After launching, verify the version in the title bar:

```
RADIANT Deployer v7.0.0
```

---

## 5. First Launch & Setup

### Step 1: Add Master AWS Key

The first thing you'll see is the **Credentials** tab prompting for your master AWS key.

1. Click **Add Master Key**
2. Enter your AWS Access Key ID
3. Enter your AWS Secret Access Key
4. Select your default region (e.g., `us-east-1`)
5. Click **Save & Validate**

The master key is:
- Stored **locally** in encrypted storage (never uploaded)
- Protected by macOS Keychain
- Used to create environment-specific keys

### Step 2: AutoSetup (Recommended)

Click **Run AutoSetup** to automatically configure:

| Service | What's Automated |
|---------|-----------------|
| **Route53** | Hosted zone creation |
| **ACM** | SSL certificate request + DNS validation |
| **SES** | Domain verification, DKIM setup |
| **S3** | Required buckets (artifacts, uploads, backups) |
| **Secrets Manager** | Secret creation structure |
| **IAM** | Environment-specific deployer users |

You only need to provide:
- AWS credentials (master key)
- Domain name
- AI provider API keys (OpenAI, Anthropic, etc.)

### Step 3: First Deployment

1. Go to **Deploy** tab
2. Select **Development** environment
3. Choose your tier (SEED for dev)
4. Click **Deploy**

The deployer will create all infrastructure automatically.

---

## 6. Navigation Structure

### 10-Tab Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ◉ ◉ ◉                RADIANT Deployer v7.0.0                   │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                   │
│  Dashboard   │     ┌────────────────────────────────────────┐   │
│  Deploy      │     │                                        │   │
│  Credentials │     │                                        │   │
│  Instances   │     │         MAIN CONTENT AREA              │   │
│  Packages    │     │                                        │   │
│  Migrations  │     │                                        │   │
│  Snapshots   │     │                                        │   │
│  History     │     │                                        │   │
│  Drift Mon.  │     │                                        │   │
│  Settings    │     └────────────────────────────────────────┘   │
│              │                                                   │
└──────────────┴──────────────────────────────────────────────────┘
```

### Tab Reference

| Tab | Icon | Purpose |
|-----|------|---------|
| **Dashboard** | 📊 | Overview of all environments |
| **Deploy** | 🚀 | One-click deployment wizard |
| **Credentials** | 🔑 | AWS key management |
| **Instances** | 🖥️ | Start/stop/wipe environments |
| **Packages** | 📦 | Version management |
| **Migrations** | ➡️ | dev→staging→prod promotion |
| **Snapshots** | 💾 | Backup and restore |
| **History** | 📜 | Deployment logs |
| **Drift Monitor** | ⚠️ | Infrastructure drift detection |
| **Settings** | ⚙️ | Preferences |

---

## 7. Dashboard

The Dashboard provides an at-a-glance view of all three environments.

### Environment Cards

Each environment (dev, staging, prod) shows:

| Metric | Description |
|--------|-------------|
| **Version** | Deployed RADIANT version |
| **Status** | Running / Stopped / Not Deployed |
| **Health** | Healthy / Degraded / Unhealthy |
| **Last Deploy** | Timestamp of last deployment |
| **Monthly Cost** | Estimated AWS costs |

### Quick Actions

| Action | Description |
|--------|-------------|
| **Deploy All** | Deploy to all environments sequentially |
| **Health Check** | Run comprehensive health check |
| **Sync Status** | Refresh all status indicators |
| **View Logs** | Open CloudWatch in browser |

### Recent Activity

Shows the last 10 actions across all environments:
- Deployments
- Key rotations
- Instance starts/stops
- Snapshot creations

---

## 8. Deploy

The Deploy tab provides one-click deployment to any environment.

### Deployment Wizard

```
┌─────────────────────────────────────────────────────────────────┐
│  Deploy to AWS                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Environment:   ○ Development  ○ Staging  ● Production          │
│                                                                  │
│  Tier:          [GROWTH ▼]                                      │
│                                                                  │
│  Version:       7.0.0 (latest)                                  │
│                                                                  │
│  Domain:        thinktank.acme.com                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Pre-flight Checks                                        │   │
│  │ ✓ AWS credentials valid                                  │   │
│  │ ✓ CDK bootstrapped                                       │   │
│  │ ✓ DNS configured                                         │   │
│  │ ✓ SSL certificate valid                                  │   │
│  │ ✓ API keys configured                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│                                    [Deploy Now]                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Tier Levels

| Tier | Monthly Cost | Use Case | Key Features |
|------|--------------|----------|--------------|
| **SEED** | $50-150 | Development | Minimal, single-AZ |
| **STARTER** | $200-400 | Small teams | WAF, GuardDuty |
| **GROWTH** | $1,000-2,500 | Medium orgs | Self-hosted models |
| **SCALE** | $4,000-8,000 | Large orgs | Multi-region ready |
| **ENTERPRISE** | $15,000-35,000 | Global | Full HA, compliance |

### Deployment Modes

| Mode | When Used | Behavior |
|------|-----------|----------|
| **Fresh Install** | No existing stack | Creates all infrastructure |
| **Update** | Existing stack | Incremental CloudFormation update |
| **Rollback** | After failure | Restores from snapshot |

### Deployment Log

Real-time progress display:

```
[12:00:01] Starting deployment v7.0.0 to production...
[12:00:02] ✓ Pre-flight checks passed
[12:00:03] ✓ Package validated (SHA256 match)
[12:00:10] → Deploying FoundationStack...
[12:02:30] ✓ FoundationStack complete
[12:02:31] → Deploying DataStack...
[12:05:45] ✓ DataStack complete
[12:05:46] → Running database migrations (1 of 156)...
[12:08:00] ✓ All 156 migrations applied
[12:08:01] → Deploying ApiStack...
[12:12:00] ✓ Deployment complete!
[12:12:01] → Running health checks...
[12:12:30] ✓ All services healthy
```

---

## 9. Credentials Management

The Credentials tab manages AWS access keys with automatic rotation.

### Overview

RADIANT uses a **two-tier key architecture**:

| Key Type | Storage | Rotation | Purpose |
|----------|---------|----------|---------|
| **Master Key** | Local (encrypted) | Manual | Your admin AWS credentials |
| **Environment Keys** | AWS Secrets Manager | Automatic | Per-environment deployment keys |

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                   │
│                                                                          │
│  ┌───────────────────┐         ┌────────────────────────────────────┐  │
│  │  Secrets Manager  │◄────────│  Lambda: credential-rotation       │  │
│  │                   │         │  • Creates new IAM access key      │  │
│  │  radiant/dev/     │         │  • Updates secret in SM            │  │
│  │    deployer-key   │         │  • Validates new key works         │  │
│  │                   │         │  • Deletes old key after overlap   │  │
│  │  radiant/staging/ │         └────────────────────────────────────┘  │
│  │    deployer-key   │                        ▲                         │
│  │                   │                        │                         │
│  │  radiant/prod/    │         ┌──────────────┴─────────────────────┐  │
│  │    deployer-key   │         │  EventBridge Schedule              │  │
│  └─────────┬─────────┘         │  • Every 90 days (configurable)    │  │
│            │                   │  • Or manual trigger               │  │
│            │                   └────────────────────────────────────┘  │
│            │                                                            │
│  ┌─────────┴─────────┐                                                 │
│  │  IAM Users        │                                                 │
│  │  • radiant-dev-deployer                                             │
│  │  • radiant-staging-deployer                                         │
│  │  • radiant-prod-deployer                                            │
│  └───────────────────┘                                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
              │
              │ Sync on app launch
              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Swift Deployer (macOS)                            │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Master Key (Local Storage)                                          │ │
│  │  • AES-256-GCM encryption                                            │ │
│  │  • Encryption key in macOS Keychain                                  │ │
│  │  • SQLCipher encrypted database                                      │ │
│  │  • Version history with timestamps                                   │ │
│  │  • NEVER leaves your machine                                         │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Environment Keys (Synced from AWS)                                  │ │
│  │  • Fetched from Secrets Manager on launch                            │ │
│  │  • Cached locally (encrypted) for offline use                        │ │
│  │  • Auto-refreshed when rotation detected                             │ │
│  │  • Version history maintained locally                                │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### Master Key

Your primary AWS admin credentials, stored **locally only**:

#### Security Features

| Feature | Implementation |
|---------|----------------|
| **Encryption** | AES-256-GCM with random IV per encryption |
| **Key Derivation** | PBKDF2 with 100,000 iterations |
| **Key Storage** | macOS Keychain (hardware-backed on Apple Silicon) |
| **Database** | SQLCipher with 256-bit AES |
| **Memory Protection** | Keys cleared from memory on lock/quit |

#### Version History

Every time you update the master key, the previous version is retained:

```
┌─────────────────────────────────────────────────────────────────┐
│  Master Key History                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  v3 (Current)    AKIA...WXYZ    Feb 4, 2026 10:30 AM           │
│  v2              AKIA...QRST    Jan 15, 2026 2:15 PM            │
│  v1              AKIA...MNOP    Dec 1, 2025 9:00 AM             │
│                                                                  │
│  [Reveal Secret] [Restore v2] [Export Encrypted Backup]         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Master Key Actions

| Action | Description | Authentication |
|--------|-------------|----------------|
| **View Access Key ID** | Always visible | None |
| **Reveal Secret Key** | Show secret temporarily | Touch ID / Password |
| **Update Key** | Replace with new credentials | Touch ID / Password |
| **View History** | See all previous versions | None |
| **Restore Version** | Revert to previous key | Touch ID / Password |
| **Export Backup** | Encrypted backup file | Touch ID / Password |
| **Validate** | Test against AWS STS | None |

### Environment Keys

Per-environment IAM users managed via AWS Secrets Manager:

#### IAM Users

| Environment | IAM User | Policy |
|-------------|----------|--------|
| **dev** | `radiant-dev-deployer` | `RadiantDevDeployerPolicy` |
| **staging** | `radiant-staging-deployer` | `RadiantStagingDeployerPolicy` |
| **prod** | `radiant-prod-deployer` | `RadiantProdDeployerPolicy` |

#### Least-Privilege Permissions

Each environment IAM user has permissions scoped to only that environment:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["cloudformation:*"],
      "Resource": "arn:aws:cloudformation:*:*:stack/radiant-dev-*/*"
    },
    {
      "Effect": "Allow",
      "Action": ["lambda:*"],
      "Resource": "arn:aws:lambda:*:*:function:radiant-dev-*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:*"],
      "Resource": "arn:aws:s3:::radiant-dev-*"
    }
  ]
}
```

#### Key Status Indicators

| Status | Icon | Meaning |
|--------|------|---------|
| **Valid** | ✅ | Key works, rotation not due |
| **Expiring Soon** | ⚠️ | Rotation due within warning period |
| **Expired** | ❌ | Past rotation date (still works) |
| **Invalid** | 🚫 | Key doesn't authenticate |
| **Rotating** | 🔄 | Rotation in progress |

### Automatic Rotation

Keys rotate automatically via AWS Lambda and Secrets Manager.

#### Rotation Configuration

| Setting | Default | Options | Description |
|---------|---------|---------|-------------|
| **Interval** | 90 days | 30 / 60 / 90 / 180 days | Time between rotations |
| **Overlap** | 24 hours | 1 / 6 / 12 / 24 / 48 hours | Both keys valid period |
| **Warning** | 14 days | 7 / 14 / 30 days | Alert before rotation |
| **Auto-Rotate** | On | On / Off | Enable per environment |

#### Rotation Process (4-Step)

The Lambda function performs rotation in four steps per AWS Secrets Manager standard:

```
Step 1: createSecret
├─ Generate new IAM access key for user
├─ Store in Secrets Manager as AWSPENDING
└─ Old key still works (AWSCURRENT)

Step 2: setSecret
├─ Mark new key as ready
└─ Both keys now valid (overlap period)

Step 3: testSecret
├─ Validate new key against AWS STS
├─ Attempt API call with new credentials
└─ Rollback if test fails

Step 4: finishSecret
├─ Promote AWSPENDING → AWSCURRENT
├─ Delete old IAM access key
├─ Update version metadata
└─ Emit CloudWatch metrics
```

#### Rotation Timeline

```
Day 0         Day 89        Day 90        Day 91
  │             │             │             │
  │             │             │             │
  ▼             ▼             ▼             ▼
┌────┐       ┌────┐       ┌────┐       ┌────┐
│Key1│       │Key1│       │Key1│       │    │
│only│       │warn│       │Key2│       │Key2│
│    │       │    │       │both│       │only│
└────┘       └────┘       └────┘       └────┘
                            │
                            └─ 24hr overlap
```

#### CDK Infrastructure

The rotation infrastructure is deployed via `deployer-key-rotation-stack.ts`:

| Resource | Purpose |
|----------|---------|
| **Secrets** | 3 secrets (dev/staging/prod deployer keys) |
| **Lambda** | `credential-rotation` function |
| **IAM Role** | Lambda execution role with SM + IAM permissions |
| **EventBridge** | Schedule rule for automatic rotation |
| **CloudWatch** | Logs, metrics, alarms for rotation failures |
| **SNS Topic** | Notifications for rotation events |

### Manual Key Operations

#### Validate Key

Test that a key works against AWS:

1. Click **Validate** next to any key
2. Deployer calls AWS STS `GetCallerIdentity`
3. Result shows:
   - Account ID
   - IAM User ARN
   - Permissions summary

#### Rotate Now (Manual)

Force immediate rotation for an environment:

1. Click **Rotate Now** for the environment
2. Confirm the action
3. Watch rotation progress:
   - Creating new key...
   - Testing new key...
   - Updating secret...
   - Deleting old key...
4. New key syncs to local cache

#### View Key History

See all versions of an environment key:

```
┌─────────────────────────────────────────────────────────────────┐
│  Production Key History                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  v7 (Current)    AKIA...DEFG    Feb 4, 2026    Auto-rotated    │
│  v6              AKIA...ABCD    Nov 6, 2025    Auto-rotated    │
│  v5              AKIA...7890    Aug 8, 2025    Manual rotate   │
│  v4              AKIA...5678    May 10, 2025   Auto-rotated    │
│  ...                                                             │
│                                                                  │
│  Showing 4 of 7 versions    [Load More]                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Restore Previous Version

If a rotation causes issues:

1. Go to key history
2. Select the version to restore
3. Click **Restore This Version**
4. Confirm (requires Touch ID / password)
5. Previous key is reactivated in Secrets Manager

**Note**: This only works if the old IAM key wasn't deleted from IAM.

### Troubleshooting Key Issues

#### Rotation Failed

**Symptom**: Rotation stuck or failed

**Check**:
1. Lambda logs in CloudWatch (`/aws/lambda/radiant-credential-rotation`)
2. IAM user access key count (max 2 per user)
3. Secrets Manager permissions

**Common Causes**:

| Cause | Solution |
|-------|----------|
| Max keys reached | Delete oldest IAM access key manually |
| Lambda timeout | Increase timeout to 60s |
| Permission denied | Check Lambda IAM role |
| Network error | Check VPC configuration |

#### Key Not Syncing

**Symptom**: App shows old key after rotation

**Solution**:
1. Click **Refresh** in Credentials tab
2. Or quit and relaunch the app
3. Check AWS connectivity

#### Invalid Key After Rotation

**Symptom**: New key doesn't work

**Solution**:
1. Check Secrets Manager for AWSCURRENT version
2. Verify IAM access key exists and is Active
3. Restore previous version if needed
4. Contact AWS support if IAM inconsistent

---

## 10. Instance Management

Control the lifecycle of each environment's AWS resources.

### Environment Panels

Each environment (dev, staging, prod) shows:

```
┌─────────────────────────────────────────────────────────────────┐
│  DEVELOPMENT                                        [● Running]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Services:                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ API GW   │ │ Lambda   │ │ Aurora   │ │ S3       │           │
│  │ ● Active │ │ ● Active │ │ ● Active │ │ ● Active │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                  │
│  Resources: 45 Lambdas | 12 Tables | 5 Buckets                  │
│  Monthly Cost: ~$450                                             │
│                                                                  │
│  [Start All]  [Stop All]  [Nuclear Wipe...]                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Start/Stop Controls

| Action | What Happens |
|--------|--------------|
| **Start All** | Resume Aurora, restore Lambda concurrency |
| **Stop All** | Pause Aurora, remove provisioned concurrency |

Cost savings when stopped: ~60-80% reduction.

### Nuclear Wipe (Double Confirmation)

Complete environment destruction with preservation options:

**Step 1 - Select Preservations**:

| Resource | Default | Description |
|----------|---------|-------------|
| DNS (Route53) | ✓ Keep | Hosted zone and records |
| SSL (ACM) | ✓ Keep | Certificates |
| SES Email | ✓ Keep | Verified domain, DKIM |
| VPC | ○ Delete | Network infrastructure |
| Logs | ○ Delete | CloudWatch log groups |
| KMS Keys | ✓ Keep | Required for backup restore |

**Step 2 - Type Confirmation**:

Must type `WIPE DEV`, `WIPE STAGING`, or `WIPE PROD` to confirm.

---

## 11. Packages

Manage RADIANT version packages.

### Package List

```
┌─────────────────────────────────────────────────────────────────┐
│  Available Packages                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  v7.0.0  [LATEST]     Feb 4, 2026    156 migrations             │
│  ├─ Simplified navigation (10 tabs)                             │
│  ├─ Credentials management                                       │
│  └─ Instance lifecycle controls                                  │
│                                                                  │
│  v6.6.0               Jan 24, 2026   152 migrations             │
│  ├─ Environment domains                                          │
│  └─ DNS verification                                             │
│                                                                  │
│  v6.5.0               Jan 15, 2026   148 migrations             │
│  └─ Feature flags system                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Package Actions

| Action | Description |
|--------|-------------|
| **Download** | Fetch package to local cache |
| **Verify** | Check SHA256 hash |
| **View Changes** | See changelog and migrations |
| **Deploy** | Jump to deploy with this version |

---

## 12. Migrations

Visual pipeline for promoting deployments through environments.

### Pipeline View

```
┌─────────────────────────────────────────────────────────────────┐
│  Migration Pipeline                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│     DEV              STAGING           PROD                      │
│  ┌─────────┐      ┌─────────┐      ┌─────────┐                  │
│  │ v7.0.0  │ ───► │ v6.6.0  │ ───► │ v6.5.0  │                  │
│  │ ● Ready │      │ ○ Ready │      │ ○ Ready │                  │
│  └─────────┘      └─────────┘      └─────────┘                  │
│                                                                  │
│  [Promote to Staging]                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Promotion Options

| Option | Description |
|--------|-------------|
| **Direct Promote** | Immediate deployment to next environment |
| **Shadow Mode** | Canary release with traffic splitting |

### Shadow Mode (Canary Releases)

Gradual traffic shifting for safe production rollouts:

| Phase | Traffic | Duration | Rollback Trigger |
|-------|---------|----------|------------------|
| 1 | 5% | 1 hour | Error rate > 1% |
| 2 | 25% | 4 hours | Error rate > 0.5% |
| 3 | 50% | 12 hours | Error rate > 0.2% |
| 4 | 100% | Complete | Manual |

### Comparison Metrics

During shadow mode, compare old vs new:

| Metric | Old Version | New Version |
|--------|-------------|-------------|
| Error Rate | 0.12% | 0.08% |
| P50 Latency | 145ms | 132ms |
| P99 Latency | 890ms | 720ms |
| Cost/Request | $0.0012 | $0.0011 |

---

## 13. Snapshots

Backup and restore capabilities.

### Snapshot Types

| Type | Contents | Schedule |
|------|----------|----------|
| **Full** | Database + S3 + Config | Weekly |
| **Incremental** | Changes since last | Daily |
| **Pre-Deploy** | Auto before deployment | Automatic |

### Creating Snapshots

1. Click **Create Snapshot**
2. Select environment
3. Choose type (Full or Incremental)
4. Add optional description
5. Click **Create**

### Restoring from Snapshot

1. Select snapshot from list
2. Click **Restore**
3. Choose target environment
4. Confirm (requires typing environment name)

**Warning**: Restore overwrites current environment data.

---

## 14. History

Complete deployment and action history.

### Log Entries

Each entry shows:

| Field | Description |
|-------|-------------|
| **Timestamp** | When action occurred |
| **Action** | Deploy, Rotate, Snapshot, etc. |
| **Environment** | dev, staging, prod |
| **User** | Who initiated (if available) |
| **Duration** | How long it took |
| **Status** | Success, Failed, In Progress |

### Filtering

Filter by:
- Environment
- Action type
- Date range
- Status

### Export

Export history as:
- CSV
- JSON
- PDF report

---

## 15. Drift Monitor

Detect and reconcile infrastructure drift from manual AWS changes.

### What is Drift?

When someone (or Windsurf/Claude) changes AWS resources directly instead of through the Deployer, the actual state differs from the expected state. This is "drift."

### Detection Methods

| Method | Trigger | Frequency |
|--------|---------|-----------|
| **Scheduled** | EventBridge | Every 15 minutes |
| **Event-Driven** | CloudFormation events | Real-time |
| **Manual** | User clicks Scan | On-demand |

### Drift Report

```
┌─────────────────────────────────────────────────────────────────┐
│  Drift Detected: 3 resources                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚠️ Lambda: radiant-prod-api-handler                             │
│     Property: MemorySize                                         │
│     Expected: 512 MB                                             │
│     Actual:   1024 MB                                            │
│     AI Recommendation: ADOPT (performance improvement)           │
│     [Adopt] [Revert] [Investigate]                               │
│                                                                  │
│  ⚠️ S3: radiant-prod-uploads                                     │
│     Property: PublicAccessBlock                                  │
│     Expected: All blocked                                        │
│     Actual:   GetObject allowed                                  │
│     AI Recommendation: REVERT (security risk)                    │
│     [Adopt] [Revert] [Investigate]                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### AI Recommendations

The drift monitor uses AI to analyze changes and recommend action:

| Recommendation | Meaning |
|----------------|---------|
| **ADOPT** | Keep the change, update IaC to match |
| **REVERT** | Undo the change, restore expected state |
| **INVESTIGATE** | Unclear, needs human review |

### Actions

| Action | What Happens |
|--------|--------------|
| **Adopt** | Update Deployer state to match AWS |
| **Revert** | Reset AWS resource to expected state |
| **Ignore** | Mark as known deviation |

---

## 15.1 Environment State Registry

**NEW in v7.1.0** - Comprehensive system for tracking, comparing, syncing, and backing up environment state across dev, staging, and prod.

### Overview

The Environment State Registry maintains versioned manifests of your AWS infrastructure, enabling:
- Cross-environment comparison
- Selective data synchronization
- Point-in-time backups and restoration
- Offline resilience with local caching

### Navigation

Access via the sidebar under "State Registry" or use keyboard shortcut **⌘ + Shift + S**.

```
┌─────────────────────────────────────────────────────────────────┐
│  State Registry                                                  │
├─────────────────────────────────────────────────────────────────┤
│  📊 Dashboard     Overview of all environments                   │
│  🔨 Dev           Development environment state                  │
│  🧪 Staging       Staging environment state                      │
│  🌍 Prod          Production environment state                   │
│  ↔️  Compare       Cross-environment comparison                   │
│  🔄 Sync          Sync operations                                │
│  💾 Backups       Backup management                              │
│  ⚙️  Settings      Sync configuration                            │
└─────────────────────────────────────────────────────────────────┘
```

### Environment Manifests

Each environment manifest captures a complete snapshot:

| Category | Contents |
|----------|----------|
| **CloudFormation** | Stack status, outputs, parameters, drift status |
| **Lambda** | Functions, runtime, memory, timeout, layers |
| **S3** | Buckets, size, object count, versioning |
| **DynamoDB** | Tables, item count, throughput |
| **Aurora** | Cluster status, engine version, instances |
| **Secrets** | Secret names, rotation status |
| **API Gateway** | APIs, stages, usage plans |

#### Capturing a Manifest

1. Select environment (Dev, Staging, or Prod)
2. Click **Capture Now** or wait for auto-capture
3. Review the manifest summary

Manifests are stored both locally (for offline access) and in S3 (for durability).

### Persistent Data Management

Control which data items sync between environments:

| Column | Description |
|--------|-------------|
| **Name** | Data item identifier |
| **Type** | database, s3, secret, config |
| **Category** | user_data, system_config, ai_models, etc. |
| **Size** | Storage size |
| **Include** | Toggle to include/exclude from sync |
| **Sensitivity** | Public, Internal, Confidential, Restricted |

#### Sensitivity Levels

| Level | Description | Sync Default |
|-------|-------------|--------------|
| **Public** | Non-sensitive data | Included |
| **Internal** | Internal business data | Included |
| **Confidential** | Business-critical data | Manual confirm |
| **Restricted** | PII/PHI, highly sensitive | Excluded |

### Cross-Environment Comparison

Compare any two environments to see differences:

1. Select **Source** environment (e.g., Dev)
2. Select **Target** environment (e.g., Staging)
3. Click **Compare Environments**

#### Comparison Report

```
┌─────────────────────────────────────────────────────────────────┐
│  Comparison: Dev → Staging                                       │
├─────────────────────────────────────────────────────────────────┤
│  Summary                                                         │
│    Total Changes: 15                                             │
│    Breaking Changes: 2                                           │
│    Data Changes: 8                                               │
│    Estimated Duration: 12 minutes                                │
│    Data Transfer: 2.4 GB                                         │
│                                                                  │
│  ➕ Added (3)                                                    │
│    • Lambda: radiant-dev-new-handler                             │
│    • S3 Bucket: radiant-dev-exports                              │
│    • Secret: radiant/dev/new-api-key                             │
│                                                                  │
│  ➖ Removed (1)                                                  │
│    • Lambda: radiant-dev-deprecated-fn                           │
│                                                                  │
│  ⚠️  Conflicts (2)                                               │
│    • Config: max_tokens (Dev: 4096, Staging: 2048)               │
│    • Feature: enable_beta (Dev: true, Staging: false)            │
└─────────────────────────────────────────────────────────────────┘
```

### Sync Operations

Synchronize state from one environment to another:

1. Select source and target environments
2. Choose what to sync:
   - **Infrastructure**: CloudFormation stacks, Lambdas
   - **Persistent Data**: Databases, S3 objects
   - **Feature Flags**: Feature toggles
3. For production targets, enable **Confirm Production Sync**
4. Click **Start Sync**

#### Production Protection

Syncing to production requires:
- Explicit confirmation toggle
- User acknowledgment of changes
- Optional approval workflow (if enabled)

#### Sync Progress

```
┌─────────────────────────────────────────────────────────────────┐
│  Active Sync: Dev → Staging                                      │
│  Status: Syncing                                                 │
│                                                                  │
│  ████████████████░░░░░░░░░░░░░░  52%                            │
│                                                                  │
│  Phase: Migrating database tables                                │
│  Items: 26/50 completed                                          │
│  Transferred: 1.2 GB / 2.4 GB                                    │
│                                                                  │
│  [Cancel Sync]                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Backup & Restore

Create point-in-time backups of any environment:

#### Creating a Backup

1. Go to **Backups** tab
2. Select environment
3. Click **Create Backup**
4. Configure options:
   - Include Infrastructure
   - Include Database
   - Include S3 Buckets
   - Include Secrets (optional)
5. Add optional description
6. Click **Create**

#### Backup Types

| Type | Description | Retention |
|------|-------------|-----------|
| **Manual** | User-initiated | Until deleted |
| **Pre-Deploy** | Auto before deployments | 30 days |
| **Scheduled** | Daily/weekly automatic | Configurable |
| **Incremental** | Changes only | 7 days |

#### Restoring from Backup

1. Find backup in list (filter by environment/date)
2. Right-click → **Restore**
3. Select target environment
4. Choose components to restore
5. Confirm restoration

⚠️ **Warning**: Restoring overwrites current state. Always create a backup before restoring.

### Sync Configuration

Configure per-environment sync settings:

| Setting | Description | Default |
|---------|-------------|---------|
| **Sync Enabled** | Master toggle | On (dev/staging), Off (prod) |
| **Sync Infrastructure** | Include CloudFormation | Off |
| **Sync Persistent Data** | Include databases/S3 | On |
| **Sync Feature Flags** | Include feature toggles | On |
| **Sync Secrets** | Include Secrets Manager | Off |
| **Require Confirmation** | Prompt before sync | On |
| **Allow Destructive** | Allow data deletion | Off |
| **Auto-Sync** | Automatic scheduled sync | Off for prod |

### Offline Resilience

The State Registry works even when offline:

- **Local Cache**: Manifests cached on your Mac
- **Startup Sync**: Refreshes from server on launch
- **Manual Refresh**: Force refresh when back online
- **Queued Operations**: Operations queue until connectivity restored

### API Integration

The State Registry exposes REST endpoints for automation:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/state-registry/manifests/{env}` | GET | Get manifest |
| `/state-registry/manifests/{env}/capture` | POST | Capture new |
| `/state-registry/compare` | POST | Compare environments |
| `/state-registry/sync` | POST | Start sync |
| `/state-registry/backups` | GET/POST | List/create backups |
| `/state-registry/backups/{id}/restore` | POST | Restore backup |

---

## 15.2 Reliability & Storage Configuration

**NEW in v7.1.0** - Enterprise-grade reliability features targeting 99.99% availability with configurable storage paths for large datasets.

### Configurable Storage Paths

Access via **State Registry → Settings → Storage Configuration** or **⌘ + Shift + ,**

Administrators can configure custom storage locations for large datasets that may not fit on the system drive:

| Setting | Description | Default |
|---------|-------------|---------|
| **Manifest Path** | Local path for state snapshots | ~/Library/Application Support/RadiantDeployer/StateRegistry/manifests |
| **Backup Path** | Local path for backups | ~/Library/Application Support/RadiantDeployer/StateRegistry/backups |
| **Package Path** | Local path for deployment packages | ~/Library/Application Support/RadiantDeployer/StateRegistry/packages |
| **Cache Path** | Local path for temporary cache | ~/Library/Application Support/RadiantDeployer/StateRegistry/cache |

#### Supported Storage Locations

- **Internal SSD**: Default location, fastest performance
- **External Drives**: USB, Thunderbolt, or network-attached storage
- **Network Shares**: SMB/NFS mounts for centralized storage
- **RAID Arrays**: For enterprise redundancy

#### Changing Storage Paths

1. Click **Browse...** next to any path
2. Select the new directory (must be writable)
3. Click **Save Configuration**
4. Existing data is NOT moved automatically—use manual migration if needed

⚠️ **Warning**: Ensure the new path has sufficient space. The app will warn if available space drops below 10GB.

### Storage Limits

| Setting | Description | Default |
|---------|-------------|---------|
| **Max Local Cache** | Maximum cache size before cleanup | 50 GB |
| **Max Backup Retention** | Days to keep old backups | 90 days |
| **Max Manifest Versions** | Number of manifest versions to retain | 100 |

### Automatic Cleanup

When enabled, the system automatically cleans up old data when disk usage exceeds the threshold:

| What Gets Cleaned | Policy |
|-------------------|--------|
| **Old Manifests** | Keep only the newest N versions per environment |
| **Expired Backups** | Remove backups older than retention period |
| **Stale Cache** | Remove cache files older than 24 hours |

To run cleanup manually: **State Registry → Settings → Storage → Run Cleanup Now**

### Reliability Settings

Access via **State Registry → Settings → Reliability**

#### Retry Configuration

| Operation | Max Retries | Initial Delay | Max Delay |
|-----------|-------------|---------------|-----------|
| **Network** | 5 | 1 second | 30 seconds |
| **Sync** | 3 | 5 seconds | 60 seconds |
| **Backup** | 3 | 10 seconds | 120 seconds |

Retries use exponential backoff with optional jitter to prevent thundering herd.

#### Conflict Resolution Strategies

| Strategy | When to Use |
|----------|-------------|
| **Source Wins** | When source environment is authoritative |
| **Target Wins** | When preserving target state is critical |
| **Newest Wins** | For time-based resolution (recommended) |
| **Manual** | When human review is required |
| **Merge** | For compatible data types only |
| **Skip** | To ignore conflicts and continue |

#### Data Validation

| Setting | Description | Default |
|---------|-------------|---------|
| **Validate Before Sync** | Check data integrity before transfer | On |
| **Validate After Sync** | Verify data after transfer | On |
| **Checksum Verification** | Use SHA-256 checksums | On |

#### Rollback Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Create Checkpoint** | Snapshot state before sync | On |
| **Auto-Rollback** | Revert on failure | On |
| **Rollback Threshold** | Max % of items that can fail | 20% |

### Fallback Mechanisms

The system gracefully degrades under failure conditions:

| Scenario | Fallback Behavior |
|----------|-------------------|
| **Network Failure** | Use cached data (configurable max age: 60 min) |
| **Partial Sync Failure** | Continue if >80% items succeed |
| **Write Failure** | Enter read-only mode |
| **Storage Full** | Trigger automatic cleanup |
| **Repeated Failures** | Escalate via email/Slack/PagerDuty |

### Health Dashboard

Access via **State Registry → Health** or **⌘ + Shift + H**

Real-time monitoring of all State Registry components:

```
┌─────────────────────────────────────────────────────────────────┐
│  Health Dashboard                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Overall Status: ● Healthy                                       │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Local Cache │  │ S3 Connect  │  │ API Connect │              │
│  │   ● OK      │  │   ● OK      │  │   ● OK      │              │
│  │ 42GB free   │  │ 45ms        │  │ 120ms       │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  Reliability Metrics                                             │
│    Uptime: 99.99%                                                │
│    Success Rate: 99.95%                                          │
│    Avg Latency: 85ms                                             │
│    Errors (24h): 0                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### SLA Targets

The State Registry is designed to meet enterprise SLA requirements:

| Metric | Target | Description |
|--------|--------|-------------|
| **Availability** | 99.99% | Max 52 minutes downtime per year |
| **Sync Success** | 99.9% | Successful sync operations |
| **Backup Success** | 99.99% | Successful backup operations |
| **Restore Success** | 99.9% | Successful restore operations |
| **Data Integrity** | 100% | No data corruption ever |
| **Max API Latency** | 5 seconds | Response time threshold |

### Backup Validation

Before restoring a backup, the system validates:

1. **Checksum Verification**: Confirms file integrity
2. **Component Validation**: Checks each component (infrastructure, database, S3, secrets)
3. **Dependency Validation**: Ensures all dependencies are present
4. **Recoverability Assessment**: Estimates restore time and identifies blockers

```
┌─────────────────────────────────────────────────────────────────┐
│  Backup Validation: backup-2026-02-04-143052                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✅ Overall: VALID                                               │
│  ⏱️  Validation Time: 1.2 seconds                                │
│                                                                  │
│  Components:                                                     │
│    ✅ Infrastructure: 14/14 items valid                          │
│    ✅ Database: 42/42 tables valid                               │
│    ✅ S3: 8/8 buckets valid                                      │
│    ✅ Feature Flags: 24/24 flags valid                           │
│                                                                  │
│  Integrity:                                                      │
│    Algorithm: SHA-256                                            │
│    Checksum: a3f2c8...                                           │
│    Status: ✅ Valid                                               │
│                                                                  │
│  Recoverability:                                                 │
│    Can Restore: Yes                                              │
│    Est. Time: 5 minutes                                          │
│    Blockers: None                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 15.3 AWS Snapshots (Disaster Recovery)

**NEW in v7.1.0** - Automated AWS infrastructure snapshots for complete disaster recovery with zero downtime.

### Overview

AWS Snapshots provide an additional layer of protection beyond the State Registry backups. While State Registry captures application-level state, AWS Snapshots capture the underlying AWS infrastructure at the storage level.

**Key Benefits**:
- **Zero Downtime**: Snapshots are created without affecting running services
- **Isolation**: Protected from application-level bugs (can't be accidentally deleted via app)
- **Point-in-Time**: Restore to any snapshot within retention period
- **Cross-Region**: Optional replication to another AWS region

### Accessing AWS Snapshots

In the Swift Deployer:
1. Navigate to **State Registry** in the sidebar
2. Click the **AWS Snapshots** tab
3. Or use keyboard shortcut **⌘ + Shift + S**

In the Radiant Admin Dashboard:
1. Go to **Infrastructure → Snapshots**
2. Or navigate to `/snapshots` in the URL

### Creating a Manual Snapshot

1. Click **Create Snapshot** button
2. (Optional) Enter a description
3. Select components to include:
   - ☑️ Aurora PostgreSQL (RDS)
   - ☑️ S3 Buckets
   - ☑️ Secrets Manager
   - ☑️ DynamoDB Tables
4. Click **Create**

The snapshot process runs in the background. You can continue working while it completes.

### Scheduled Snapshots

By default, snapshots run automatically at **2:00 AM Pacific Time** daily.

| Setting | Default | Description |
|---------|---------|-------------|
| **Schedule** | 2:00 AM PT | Configurable to any time or interval |
| **Retention** | 30 days | How long to keep snapshots |
| **Components** | All | Which AWS resources to snapshot |

To configure the schedule:
1. Go to **AWS Snapshots → Configuration** tab
2. Toggle **Enable Automated Snapshots**
3. Set your preferred time or interval
4. Click **Save Configuration**

### Restoring from a Snapshot

1. Select a snapshot from the list
2. Click **Restore** (download icon)
3. Confirm the restore operation
4. Wait for restore to complete (5-15 minutes for RDS)

**Important**: RDS restore creates a **new cluster**—it does not overwrite the existing database. After restore completes, you'll need to update your connection strings to point to the new cluster.

### Restore Times

| Component | Typical Time | Method |
|-----------|--------------|--------|
| **Aurora PostgreSQL** | 5-15 minutes | Creates new cluster from snapshot |
| **S3 Buckets** | Near-instant | Object versioning (objects already versioned) |
| **DynamoDB** | ~5 min/table | On-demand backup restore |
| **Secrets Manager** | Near-instant | Version recovery |

### Snapshot Validation

Before restoring, validate the snapshot:

1. Select a snapshot
2. Click **Validate** (or right-click → Validate)
3. Review the validation report:
   - ✅ Checksum verification
   - ✅ Component availability
   - ✅ Estimated restore time
   - ⚠️ Any blockers or warnings

### Cost Estimation

Snapshots incur AWS storage costs:

| Component | Approximate Cost |
|-----------|------------------|
| **RDS Snapshots** | ~$0.02/GB-month |
| **DynamoDB Backups** | ~$0.10/GB-month |
| **S3 Versioning** | Same as standard S3 storage |

The dashboard shows estimated monthly costs for all retained snapshots.

### Snapshot vs State Registry Backup

| Feature | AWS Snapshot | State Registry Backup |
|---------|--------------|----------------------|
| **Level** | AWS infrastructure | Application state |
| **Downtime** | Zero | Zero |
| **Restore Target** | Same or new cluster | Same environment |
| **Isolation** | Protected from app bugs | Could be affected by app bugs |
| **Speed** | 5-15 min (RDS) | Near-instant |
| **Cross-Region** | Yes (optional) | No |

**Recommendation**: Use both for comprehensive disaster recovery.

---

## 16. Settings

Preferences and configuration options.

### General Tab

| Setting | Description | Default |
|---------|-------------|---------|
| **Theme** | Light/Dark/System | System |
| **Notifications** | Desktop notifications | On |
| **Auto-Update** | Check for updates on launch | On |

### Timeout Tab

| Operation | Default | Range |
|-----------|---------|-------|
| **Deployment** | 30 min | 10-60 min |
| **Health Check** | 30 sec | 10-120 sec |
| **API Calls** | 60 sec | 10-300 sec |

### Storage Tab

| Setting | Description | Default |
|---------|-------------|---------|
| **Cache Location** | Package cache | ~/Library/Caches/RadiantDeployer |
| **Max Cache Size** | Maximum cache | 5 GB |
| **Log Retention** | Keep logs for | 30 days |

### Advanced Tab

| Setting | Description | Default |
|---------|-------------|---------|
| **Debug Mode** | Verbose logging | Off |
| **Dry Run** | Simulate deployments | Off |
| **Parallel Stacks** | Concurrent deployments | 3 |

### Admin Tools Tab (Updated in v7.3.0)

Access advanced administrator tools organized into four categories:

| Category | Tools |
|----------|-------|
| **Observability** | Monitoring Dashboard, Log Viewer |
| **Operations** | Rollback Manager, Security Scanner, Network Diagnostics |
| **Cost Management** | Resource Tags, Cost Estimator |
| **Data & Compliance** | Database Export, Secrets Rotation, Environment Clone, Compliance Reports |

---

#### Monitoring Dashboard (NEW in v7.3.0)

Real-time CloudWatch metrics visualization for all RADIANT services:

| Service | Metrics |
|---------|---------|
| **Lambda** | Invocations, Errors, Duration, Throttles, Concurrent Executions |
| **ECS** | CPU Utilization, Memory Utilization, Running Tasks, Pending Tasks |
| **RDS** | CPU, Connections, Memory, Read/Write Latency, IOPS |
| **API Gateway** | Request Count, 4XX/5XX Errors, Latency |
| **DynamoDB** | Read/Write Capacity, Throttled Requests, Latency |
| **ElastiCache** | CPU, Memory Usage, Hit Rate, Connections |

Features:
- **Service Health Cards**: Status indicators (Healthy/Degraded/Unhealthy)
- **Real-time Alerts**: Critical and warning alerts with acknowledgment
- **Metric Trends**: Up/Down/Stable indicators
- **Cost Estimates**: Hourly/daily/monthly projections
- **Auto-refresh**: 60-second interval with manual refresh
- **Time Ranges**: 1h, 3h, 6h, 12h, 1d, 3d, 1w

---

#### Log Viewer (NEW in v7.3.0)

CloudWatch logs aggregation with search and real-time tailing:

| Feature | Description |
|---------|-------------|
| **Log Groups** | Browse by Lambda, ECS, RDS, API Gateway |
| **Search** | Pattern matching in log messages |
| **Filter by Level** | ALL, ERROR, WARN, INFO, DEBUG |
| **Time Range** | 15min, 1h, 6h, 24h presets |
| **Tailing** | Real-time log streaming |

Log Level Colors:
- 🔴 **ERROR**: Red - Exceptions, failures
- 🟠 **WARN**: Orange - Warnings, deprecations
- 🔵 **INFO**: Blue - Informational messages
- 🟢 **DEBUG**: Green - Debug output

---

#### Rollback Manager (NEW in v7.3.0)

Version tracking and automated rollback for AWS resources:

| Resource Type | Rollback Method | Est. Downtime |
|---------------|-----------------|---------------|
| **Lambda** | Alias update | ~5 seconds |
| **ECS** | Task definition update | ~2 minutes |
| **CloudFormation** | Stack rollback | ~5 minutes |
| **RDS** | Snapshot restore | ~10 minutes |

Features:
- **Version History**: List all available versions with timestamps
- **Rollback Plans**: Step-by-step execution with estimates
- **Progress Tracking**: Real-time progress logs
- **Safety Checks**: Approval required for RDS and CloudFormation
- **Metadata**: Runtime, code size, deployment status

---

#### Security Scanner (NEW in v7.3.0)

Automated security configuration audit:

| Category | Checks |
|----------|--------|
| **IAM Policies** | Administrator access, wildcard policies |
| **Security Groups** | 0.0.0.0/0 access, SSH/RDP exposure |
| **Encryption** | S3 bucket encryption, RDS storage encryption |
| **Public Access** | S3 public access block configuration |
| **Logging** | CloudTrail configuration, log validation |

Severity Levels:
- 🔴 **Critical**: Immediate action required (e.g., admin access on roles)
- 🟠 **High**: Important security risk (e.g., open ports)
- 🟡 **Medium**: Should be addressed (e.g., single-region trail)
- 🔵 **Low**: Best practice recommendation
- ⚪ **Info**: Informational only

Compliance Score: 0-100% based on weighted severity of findings.

---

#### Network Diagnostics (NEW in v7.3.0)

Comprehensive connectivity testing suite:

| Test | Purpose | Metrics |
|------|---------|---------|
| **DNS** | Hostname resolution | Resolved IPs, response time |
| **SSL** | Certificate validation | Expiry date, issuer, days remaining |
| **Connectivity** | HTTP reachability | Status code, response time, bytes |
| **Latency** | Network performance | Min/avg/max, packet loss |
| **Port Scan** | Service availability | Open/closed status, response time |

SSL Certificate Warnings:
- 🟢 **>30 days**: Healthy
- 🟠 **≤30 days**: Warning - renew soon
- 🔴 **Expired**: Failed - immediate action

---

#### Resource Tags Manager (NEW in v7.3.0)

AWS resource tagging for cost allocation and compliance:

| Resource Type | Supported |
|---------------|-----------|
| **Lambda** | ✅ Functions |
| **ECS** | ✅ Clusters, Services |
| **RDS** | ✅ Aurora Clusters |
| **S3** | ✅ Buckets |
| **DynamoDB** | ✅ Tables |

Standard Tag Policies:

| Tag Key | Required | Allowed Values |
|---------|----------|----------------|
| **Environment** | ✅ | dev, staging, prod |
| **Project** | ✅ | radiant |
| **Owner** | ✅ | Any |
| **CostCenter** | ✅ | Any |
| **ManagedBy** | ❌ | cdk, terraform, manual |
| **Version** | ❌ | Any |

Features:
- **Compliance Checking**: Identify missing/invalid tags
- **Bulk Tagging**: Apply tags to multiple resources
- **Tag Editing**: Add, modify, remove tags per resource
- **Cost Allocation**: Group resources by CostCenter

---

#### Database Export

Export PostgreSQL and DynamoDB data for backup or migration:

| Mode | Description | Target |
|------|-------------|--------|
| **Schema Only** | Database structure without data | Any environment |
| **Seed Data** | AI Registry and system config | Any environment |
| **Masked Data** | PII anonymized (GDPR compliant) | Dev/Staging only |
| **Full Export** | Complete database | Dev only |

Features:
- Compression with gzip
- Checksum verification
- Progress tracking
- GDPR consent for PII data

#### Secrets Rotation

Manage AWS Secrets Manager secrets lifecycle:

| Urgency | Age | Action |
|---------|-----|--------|
| **Critical** | >180 days | Rotate immediately |
| **Urgent** | >90 days | Rotate soon |
| **Warning** | >60 days | Plan rotation |
| **Healthy** | <60 days | No action needed |

Features:
- Bulk rotation for urgent secrets
- Rotation scheduling
- Compliance tracking by framework
- Audit trail

#### Cost Estimator

Preview deployment costs before committing:

| Tier | Monthly Estimate |
|------|------------------|
| **Seed** | ~$100-200 |
| **Starter** | ~$400-800 |
| **Growth** | ~$1,500-3,000 |
| **Scale** | ~$5,000-10,000 |
| **Enterprise** | ~$15,000+ |

Breakdown categories:
- Compute (ECS, Lambda, GPU)
- Database (Aurora, DynamoDB, ElastiCache)
- Storage (S3, EFS, Backups)
- Networking (Transfer, NAT, ALB, API Gateway)
- Security (WAF, GuardDuty, Secrets Manager, KMS)
- AI (External providers, Self-hosted inference)

#### Environment Clone

Clone environments with optional data masking:

| Clone Mode | Data Included | Allowed Targets |
|------------|---------------|-----------------|
| **Schema Only** | Structure only | Dev, Staging, Prod |
| **With Seed Data** | System config | Dev, Staging, Prod |
| **With Masked Data** | Anonymized PII | Dev, Staging |
| **Full Clone** | All data | Dev only |

Features:
- Promotion workflow (Dev → Staging → Production)
- Automatic secrets rotation for target
- Dry run validation
- Pre/post-clone checks

#### Compliance Reports

Generate regulatory compliance reports:

| Framework | Controls | Focus |
|-----------|----------|-------|
| **HIPAA** | 45.308, 45.310, 45.312 | Healthcare data |
| **SOC 2** | CC1-CC9, A1, C1, P1 | Service organization |
| **GDPR** | Art. 6, 7, 15-22, 25, 32, 33, 46 | EU data protection |
| **PCI-DSS** | Requirements 1-12 | Payment card data |
| **ISO 27001** | Annex A controls | Information security |

Report contents:
- Control assessment with status
- Evidence collection
- Findings by severity (Critical/High/Medium/Low)
- Remediation recommendations
- Export to JSON, CSV, PDF

---

## 17. AI Assistant

Built-in AI assistance for deployment and troubleshooting.

### Activation

- Press **⌘ + Shift + A**
- Or click the ✨ sparkles icon in toolbar

### Capabilities

| Category | Examples |
|----------|----------|
| **Planning** | "What tier for 500 users?" |
| **Troubleshooting** | "Why is deployment failing?" |
| **Cost** | "How can I reduce costs?" |
| **Explanation** | "Explain drift detection" |

### Voice Commands

Enable in Settings → AI Assistant → Voice Input:
1. Click microphone icon
2. Speak command
3. Review and confirm

---

## 18. AutoSetup Service

Fully automated AWS configuration service.

### What's Automated

| Service | Configuration |
|---------|---------------|
| **Route53** | Hosted zone creation, DNS records |
| **ACM** | SSL certificate request, DNS validation |
| **SES** | Domain verification, DKIM setup, sandbox exit |
| **SNS** | SMS configuration, spending limits |
| **S3** | 5 buckets (artifacts, uploads, backups, static, logs) |
| **Secrets Manager** | Secret structure for API keys |
| **CloudWatch** | Dashboard and alarm creation |

### What You Provide

Only these inputs are required:
- AWS credentials (master key)
- Domain name
- Environment (dev/staging/prod)
- Tier selection
- AI provider API keys (OpenAI, Anthropic)

### Running AutoSetup

1. Go to **Deploy** tab
2. Click **Run AutoSetup**
3. Enter required information
4. AutoSetup configures all services
5. Deploy when ready

---

## 19. Deployment Automation

**NEW in v7.2.0** - Complete automation of CLI dependencies, script execution, and code sync.

### 19.1 Dependencies Manager

The Dependencies Manager automatically detects and installs required CLI tools.

#### Supported Dependencies

| Dependency | Min Version | Required | Purpose |
|------------|-------------|----------|---------|
| **Homebrew** | Latest | ✅ | Package manager (installed first) |
| **AWS CLI** | 2.0.0 | ✅ | AWS cloud operations |
| **Node.js** | 18.0.0 | ✅ | Build tools and CDK |
| **npm** | Latest | ✅ | Package management |
| **AWS CDK** | 2.0.0 | ✅ | Infrastructure deployment |
| **Git** | Latest | ✅ | Version control |
| **Python 3** | 3.9.0 | Optional | Cato Genesis system |
| **Docker** | Latest | Optional | Container operations |

#### How It Works

1. **Automatic Detection**: On app launch, checks all dependencies
2. **Version Validation**: Ensures installed versions meet minimums
3. **One-Click Install**: Click "Install Missing" to install all at once
4. **Path Resolution**: Searches `/opt/homebrew/bin`, `/usr/local/bin`, `~/.local/bin`

#### Using the Dependencies View

1. Navigate to **Dependencies** tab in sidebar
2. View status of each dependency (green = installed, red = missing)
3. Click **Refresh** to re-check all dependencies
4. Click **Install Missing** to auto-install required tools
5. Individual **Install** buttons available for each dependency

### 19.2 Bash Script Runner

Discover and execute deployment bash scripts directly from the Deployer.

#### Script Discovery

Scripts are automatically discovered from:
- `scripts/` - Main deployment scripts
- `tools/scripts/` - Utility scripts
- `packages/infrastructure/scripts/` - Infrastructure scripts

#### Script Categories

| Category | Icon | Description |
|----------|------|-------------|
| **Deployment** | ▲ | Full CDK deployments (deploy.sh) |
| **Database** | ⬡ | Migrations (run-migrations.sh) |
| **Build** | 🔨 | Package building |
| **Testing** | ✓ | Verification scripts |
| **Backup** | ↻ | Backup/restore operations |
| **Sync** | ⇄ | Synchronization scripts |
| **Utility** | 🔧 | General utilities |

#### Executing Scripts

1. Navigate to **Scripts** tab
2. Select environment (Dev/Staging/Prod)
3. Browse or search for scripts
4. Select a script to view details
5. Configure arguments (if applicable)
6. Click **Run Script**
7. Watch real-time output with color coding

#### Automatic Dependency Resolution

Before running a script, the system:
1. Parses script content for CLI tool usage
2. Checks if required tools are installed
3. Offers to install missing dependencies
4. Only proceeds when all dependencies are met

### 19.3 Code Sync

Sync local code changes to AWS instances for rapid iteration.

#### How Code Sync Works

```
Local Changes → Git Analysis → Package → S3 Upload → Lambda Trigger → Apply
```

1. **Change Detection**: Uses `git status` to find modified files
2. **Selective Sync**: Choose which files to include
3. **Package Building**: Creates compressed tar.gz archive
4. **S3 Upload**: Uploads to `radiant-{env}-artifacts/code-sync/`
5. **Lambda Trigger**: Invokes code-sync Lambda function
6. **Verification**: Confirms changes applied to instances

#### Using Code Sync

1. Navigate to **Code Sync** tab
2. Select target environment (Dev/Staging/Prod)
3. Click **Refresh** to scan for local changes
4. Review changed files (added/modified/deleted)
5. Select/deselect files as needed
6. Click **Sync to {Environment}**
7. Monitor progress and verification

#### Change Types

| Type | Color | Description |
|------|-------|-------------|
| **Added** | Green | New files |
| **Modified** | Orange | Changed files |
| **Deleted** | Red | Removed files |
| **Renamed** | Blue | Moved/renamed files |

#### Best Practices

- Sync to **Dev** first, verify, then promote
- Use selective sync for targeted changes
- Monitor Lambda logs for sync issues
- Keep changes small for faster syncs

---

## 20. Security Architecture

### Local Security

| Component | Protection |
|-----------|------------|
| **Master Key** | AES-256-GCM + macOS Keychain |
| **Local Storage** | SQLCipher encrypted database |
| **Memory** | Cleared on lock/quit |

### AWS Security

| Feature | Tier | Description |
|---------|------|-------------|
| **WAF** | Starter+ | Web Application Firewall |
| **GuardDuty** | Starter+ | Threat detection |
| **Shield** | All | DDoS protection (Standard) |
| **KMS** | All | Encryption at rest |
| **VPC** | All | Network isolation |

### Compliance

Configure in Admin Dashboard after deployment:

| Standard | Features |
|----------|----------|
| **HIPAA** | PHI encryption, audit logging, BAA |
| **SOC2** | Audit trails, access reviews |
| **GDPR** | Data erasure, portability, consent |

---

## 20. Troubleshooting

### Common Issues

#### Credentials Not Validated

**Symptom**: "Invalid credentials" error

**Solution**:
1. Verify Access Key ID and Secret Access Key
2. Check IAM user has required permissions
3. Ensure region is correct

#### Deployment Stuck

**Symptom**: Deployment hangs at a stack

**Solution**:
1. Check CloudFormation console for errors
2. Review deployment logs
3. Check AWS service quotas
4. Verify IAM permissions

#### Key Rotation Failed

**Symptom**: Rotation Lambda error

**Solution**:
1. Check Lambda logs in CloudWatch
2. Verify Secrets Manager permissions
3. Check IAM user access key count (max 2)

#### Drift Detection Errors

**Symptom**: Scan fails or times out

**Solution**:
1. Verify CloudFormation stack exists
2. Check IAM permissions for drift detection
3. Reduce scan scope if too many resources

### Getting Help

1. **AI Assistant**: Press ⌘ + Shift + A
2. **Logs**: Settings → Storage → Export Logs
3. **Support**: support@radiant.ai

---

## 21. Keyboard Shortcuts

### Global

| Shortcut | Action |
|----------|--------|
| **⌘ + ,** | Settings |
| **⌘ + R** | Refresh |
| **⌘ + Shift + A** | AI Assistant |
| **⌘ + ?** | Help |
| **⌘ + Q** | Quit |

### Navigation

| Shortcut | Action |
|----------|--------|
| **⌘ + 1** | Dashboard |
| **⌘ + 2** | Deploy |
| **⌘ + 3** | Credentials |
| **⌘ + 4** | Instances |
| **⌘ + 5** | Packages |
| **⌘ + 6** | Migrations |
| **⌘ + 7** | Snapshots |
| **⌘ + 8** | History |
| **⌘ + 9** | Drift Monitor |
| **⌘ + 0** | Settings |

### Actions

| Shortcut | Action |
|----------|--------|
| **⌘ + D** | Deploy |
| **⌘ + .** | Cancel |
| **⌘ + L** | Logs |

---

## 22. Glossary

| Term | Definition |
|------|------------|
| **Aurora** | AWS managed PostgreSQL database |
| **CDK** | Cloud Development Kit (infrastructure as code) |
| **CloudFront** | AWS content delivery network |
| **Drift** | Difference between expected and actual AWS state |
| **Environment** | Deployment target (dev, staging, prod) |
| **IAM** | AWS Identity and Access Management |
| **KMS** | AWS Key Management Service |
| **Lambda** | AWS serverless compute |
| **Master Key** | Your admin AWS credentials |
| **Migration** | Promoting versions through environments |
| **Rotation** | Automatic key replacement |
| **Secrets Manager** | AWS service for storing secrets |
| **Snapshot** | Point-in-time backup |
| **Tier** | Infrastructure size (SEED to ENTERPRISE) |
| **Wipe** | Complete environment destruction |

---

## Document Information

| Field | Value |
|-------|-------|
| **Version** | 7.17.0 |
| **Last Updated** | February 6, 2026 |
| **Author** | RADIANT Team |
| **Status** | Published |

---

*For additional support, contact support@radiant.ai or visit docs.radiant.ai*
