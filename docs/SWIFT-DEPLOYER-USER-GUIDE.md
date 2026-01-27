# RADIANT Swift Deployer User Guide

**Version**: 5.52.17  
**Platform**: macOS 13.0+ (Ventura and later)  
**Last Updated**: January 24, 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Requirements](#2-system-requirements)
3. [Installation](#3-installation)
4. [First Launch & Setup](#4-first-launch--setup)
5. [Main Interface](#5-main-interface)
6. [Dashboard](#6-dashboard)
7. [Applications Management](#7-applications-management)
8. [Deployment](#8-deployment)
9. [Domain URL Configuration](#9-domain-url-configuration)
10. [Feature Flags](#10-feature-flags)
11. [AI Registry](#11-ai-registry)
12. [Self-Hosted Models](#12-self-hosted-models)
13. [Multi-Region Deployment](#13-multi-region-deployment)
14. [Security & Compliance](#14-security--compliance)
15. [Cost Management](#15-cost-management)
16. [Monitoring](#16-monitoring)
17. [Snapshots & Rollbacks](#17-snapshots--rollbacks)
18. [Package Management](#18-package-management)
19. [Settings](#19-settings)
20. [AI Assistant](#20-ai-assistant)
21. [Troubleshooting](#21-troubleshooting)
22. [Keyboard Shortcuts](#22-keyboard-shortcuts)
23. [Glossary](#23-glossary)

---

## 1. Overview

The RADIANT Swift Deployer is a native macOS application for deploying and managing RADIANT AI platform infrastructure on AWS. It provides a visual interface for:

- **Infrastructure Deployment**: Deploy complete RADIANT stacks to AWS
- **Domain Configuration**: Configure URLs for all platform applications
- **AI Model Management**: Configure external and self-hosted AI models
- **Monitoring**: Real-time health checks and cost tracking
- **Compliance**: HIPAA, SOC2, and GDPR compliance tools

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    RADIANT Swift Deployer                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  1Password   │  │  AWS CLI     │  │  CDK CLI     │          │
│  │  Integration │  │  Credentials │  │  Deployment  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    AWS Account                           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │ Aurora  │ │ Lambda  │ │ S3      │ │CloudFront│       │   │
│  │  │ (DB)    │ │ (API)   │ │(Storage)│ │ (CDN)   │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### RADIANT Applications

The deployer manages five core applications:

| Application | Description | Required |
|-------------|-------------|----------|
| **RADIANT Admin** | Platform administration dashboard | ✓ Yes |
| **Think Tank Admin** | Think Tank configuration and management | No |
| **Curator** | Knowledge graph curation and fact verification | No |
| **Think Tank** | Consumer AI chat interface | ✓ Yes |
| **External API** | REST/GraphQL API for integrations | ✓ Yes |

---

## 2. System Requirements

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
| **1Password** | Credential management | [1password.com](https://1password.com) |
| **AWS CLI v2** | AWS operations | `brew install awscli` |
| **Node.js 18+** | CDK runtime | `brew install node@18` |
| **AWS CDK** | Infrastructure deployment | `npm install -g aws-cdk` |

### AWS Account Requirements

- AWS account with administrator access
- IAM user or role with deployment permissions
- Sufficient service quotas for:
  - Aurora PostgreSQL clusters
  - Lambda functions (100+)
  - S3 buckets
  - CloudFront distributions
  - SageMaker endpoints (for self-hosted models)

---

## 3. Installation

### Download

1. Download `Radiant Deployer.app` from the releases page
2. Move to `/Applications` folder
3. Right-click → Open (first launch only, to bypass Gatekeeper)

### First Launch

On first launch, macOS may show a security warning:

1. Click **Cancel** on the warning dialog
2. Open **System Preferences** → **Privacy & Security**
3. Click **Open Anyway** next to "Radiant Deployer was blocked"
4. Click **Open** in the confirmation dialog

### Verify Installation

After launching, verify the version in the window header:

```
RADIANT Deployer v5.52.17
```

---

## 4. First Launch & Setup

### 1Password Setup

The deployer requires 1Password for secure credential management.

**Step 1**: Install 1Password CLI
```bash
brew install 1password-cli
```

**Step 2**: Enable CLI integration
1. Open 1Password app
2. Go to **Settings** → **Developer**
3. Enable **Integrate with 1Password CLI**

**Step 3**: Sign in to 1Password
```bash
op signin
```

**Step 4**: Verify in Deployer
- The deployer will show a green checkmark when 1Password is configured
- If not configured, you'll see the 1Password Setup screen

### AWS Credentials Setup

**Option A**: Store in 1Password (Recommended)

1. Create a new item in 1Password with:
   - **Title**: `RADIANT AWS Credentials`
   - **AWS Access Key ID**: Your access key
   - **AWS Secret Access Key**: Your secret key
   - **Region**: e.g., `us-east-1`

2. Tag the item with `radiant` for easy discovery

**Option B**: Use AWS CLI profiles
```bash
aws configure --profile radiant-deploy
```

### Initial Configuration Checklist

- [ ] 1Password installed and CLI enabled
- [ ] AWS credentials stored securely
- [ ] AWS CDK bootstrapped in target region
- [ ] Domain purchased and DNS access available
- [ ] SSL certificate requested (or will use ACM)

---

## 5. Main Interface

### Window Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ◉ ◉ ◉                    RADIANT Deployer                      │
├───────────┬─────────────────────────────────────────────────────┤
│           │  ┌─────────────────────────────────────────────┐   │
│  SIDEBAR  │  │              CONTENT TOOLBAR                │   │
│           │  ├─────────────────────────────────────────────┤   │
│  ┌──────┐ │  │                                             │   │
│  │ MAIN │ │  │                                             │   │
│  ├──────┤ │  │                                             │   │
│  │ OPS  │ │  │            MAIN CONTENT AREA                │   │
│  ├──────┤ │  │                                             │   │
│  │ AI   │ │  │                                             │   │
│  ├──────┤ │  │                                             │   │
│  │CONFIG│ │  │                                             │   │
│  ├──────┤ │  │                                             │   │
│  │SYSTEM│ │  │                                             │   │
│  └──────┘ │  └─────────────────────────────────────────────┘   │
│           │                                                     │
└───────────┴─────────────────────────────────────────────────────┘
```

### Sidebar Sections

| Section | Tabs | Purpose |
|---------|------|---------|
| **MAIN** | Dashboard, Apps, Deploy | Core operations |
| **OPERATIONS** | Instances, Snapshots, Packages, History | Management |
| **AI REGISTRY** | Providers, Models, Self-Hosted | AI configuration |
| **CONFIGURATION** | Domain URLs, Email, Curator | Platform config |
| **ADVANCED** | Multi-Region, A/B Testing, Cortex Memory | Advanced features |
| **SECURITY** | Security, Compliance | Security settings |
| **SYSTEM** | Costs, Monitoring, Settings | System management |

### Environment Selector

At the top of the sidebar, select the target environment:

| Environment | Purpose | Color |
|-------------|---------|-------|
| **Development** | Testing and development | Blue |
| **Staging** | Pre-production testing | Orange |
| **Production** | Live production | Green |

---

## 6. Dashboard

The Dashboard provides an at-a-glance view of your RADIANT deployment.

### Status Cards

| Card | Information |
|------|-------------|
| **Version** | Current deployed version with update indicator |
| **Health** | Overall system health (Healthy/Degraded/Unhealthy) |
| **Costs** | Month-to-date AWS costs |
| **Active Users** | Current active user count |

### Quick Actions

- **Deploy** → Jump to deployment view
- **View Logs** → Open CloudWatch logs
- **Health Check** → Run comprehensive health check
- **Refresh** → Refresh all status indicators

### Recent Activity

Shows the last 10 deployment and configuration changes.

---

## 7. Applications Management

### Viewing Applications

The **Apps** tab shows all RADIANT applications:

```
┌─────────────────────────────────────────────────────────────────┐
│  RADIANT Applications                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚙️  RADIANT Admin          ✓ Enabled    https://acme.com/admin │
│      Platform administration                                     │
│                                                                  │
│  🧠 Think Tank Admin        ✓ Enabled    https://acme.com/tt-admin│
│      Think Tank configuration                                    │
│                                                                  │
│  📖 Curator                  ✓ Enabled    https://acme.com/curator│
│      Knowledge graph curation                                    │
│                                                                  │
│  💬 Think Tank              ✓ Enabled    https://acme.com/       │
│      Consumer AI interface                                       │
│                                                                  │
│  🔗 External API            ✓ Enabled    https://acme.com/api   │
│      REST/GraphQL API                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Per-App Actions

Click on any application to:
- View health status
- Open in browser
- View CloudWatch logs
- Restart (Lambda functions)
- Scale (if applicable)

---

## 8. Deployment

### Deployment Modes

| Mode | When Used | Description |
|------|-----------|-------------|
| **Fresh Install** | No existing deployment | Full infrastructure creation |
| **Update** | Existing deployment, newer version | Incremental update |
| **Rollback** | After failed update | Restore from snapshot |

### Deployment Process

**Step 1: Select Application**
- Choose the RADIANT platform instance to deploy

**Step 2: Select Environment**
- Development, Staging, or Production

**Step 3: Configure Parameters**

| Parameter | Description | Default |
|-----------|-------------|---------|
| **Tier** | Infrastructure size | Based on use case |
| **Region** | AWS region | us-east-1 |
| **Multi-AZ** | High availability | Growth+ tiers |
| **Self-Hosted Models** | SageMaker endpoints | Growth+ tiers |

**Step 4: Review & Deploy**
- Review all settings
- Click **Deploy** to begin
- Monitor progress in the deployment log

### Tier Levels

| Tier | Monthly Cost | Use Case | Features |
|------|--------------|----------|----------|
| **SEED** | $50-150 | Development | Minimal resources |
| **STARTER** | $200-400 | Small production | WAF, GuardDuty |
| **GROWTH** | $1,000-2,500 | Medium production | Self-hosted models |
| **SCALE** | $4,000-8,000 | Large production | Multi-region |
| **ENTERPRISE** | $15,000-35,000 | Global deployment | Full features |

### Deployment Log

The deployment log shows real-time progress:

```
[12:00:01] Starting deployment v5.52.17...
[12:00:02] ✓ Credentials validated
[12:00:05] ✓ Package downloaded (45.2 MB)
[12:00:10] → Deploying NetworkStack...
[12:02:30] ✓ NetworkStack deployed
[12:02:31] → Deploying DatabaseStack...
[12:05:45] ✓ DatabaseStack deployed
...
[12:15:00] ✓ Deployment complete!
```

---

## 9. Domain URL Configuration

### Overview

Configure how users access each RADIANT application.

### Routing Strategies

**Subdomain-Based**:
```
admin.acme.radiant.ai      → RADIANT Admin
thinktank-admin.acme.radiant.ai → Think Tank Admin
curator.acme.radiant.ai    → Curator
app.acme.radiant.ai        → Think Tank
api.acme.radiant.ai        → External API
```

**Path-Based** (Default):
```
acme.radiant.ai/admin           → RADIANT Admin
acme.radiant.ai/thinktank-admin → Think Tank Admin
acme.radiant.ai/curator         → Curator
acme.radiant.ai/                → Think Tank
acme.radiant.ai/api             → External API
```

### Configuration Steps

**Step 1: Enter Base Domain**
- Enter your domain without protocol: `acme.radiant.ai`

**Step 2: Choose Routing Strategy**
- Subdomain: Each app on its own subdomain
- Path-Based: All apps under one domain with paths

**Step 3: Configure Per-App Settings**
- Enable/disable optional apps
- Customize subdomains or paths
- Set cache policies

**Step 4: Validate DNS**
- Click **Validate** to check DNS configuration
- Green checkmarks indicate proper setup

### DNS Records

For **subdomain-based** routing, create these DNS records:

| Type | Name | Value |
|------|------|-------|
| CNAME | admin | d123456.cloudfront.net |
| CNAME | app | d123456.cloudfront.net |
| CNAME | api | d123456.cloudfront.net |
| CNAME | curator | d123456.cloudfront.net |
| CNAME | thinktank-admin | d123456.cloudfront.net |

For **path-based** routing:

| Type | Name | Value |
|------|------|-------|
| A (ALIAS) | @ | d123456.cloudfront.net |

### SSL Certificates

The deployer automatically provisions SSL certificates via AWS ACM:

1. ACM requests certificate for your domain
2. Validation records are displayed
3. Add CNAME records to your DNS
4. Wait for validation (usually 5-30 minutes)
5. Certificate is automatically attached to CloudFront

---

## 10. Feature Flags

### Overview

Control which platform features are enabled for deployment.

### Core Features

| Feature | Default | Description |
|---------|---------|-------------|
| **Cortex Memory** | ✓ On | Three-tier memory system (Hot/Warm/Cold) |
| **Ego System** | ✓ On | Zero-cost persistent AI identity |
| **Compliance Export** | ✓ On | HIPAA, SOC2, GDPR-formatted exports |

### Think Tank Features

| Feature | Default | Description |
|---------|---------|-------------|
| **Time Machine** | ✓ On | Fork conversations, create checkpoints |
| **Collaboration** | ✓ On | Real-time multi-user sessions |

### Optional Applications

| Feature | Default | Minimum Tier |
|---------|---------|--------------|
| **Curator** | On | Growth |

### Infrastructure Features

| Feature | Default | Minimum Tier |
|---------|---------|--------------|
| **Self-Hosted Models** | Off | Growth |
| **Multi-Region** | Off | Scale |

### Accessing Feature Flags

1. Go to **Settings** → **Features** tab
2. Toggle features on/off
3. Click **Apply** to save
4. Redeploy to activate changes

---

## 11. AI Registry

### Providers Tab

View and configure AI providers:

| Provider | Models | Status |
|----------|--------|--------|
| **OpenAI** | GPT-4o, GPT-4-turbo, etc. | Active |
| **Anthropic** | Claude 3.5 Sonnet, etc. | Active |
| **Google** | Gemini 1.5 Pro, etc. | Active |
| **Amazon Bedrock** | Claude, Titan, etc. | Active |
| **Self-Hosted** | Custom models | Configure |

### Adding Provider Keys

1. Click **Add Provider**
2. Select provider from dropdown
3. Enter API key
4. Click **Validate** to test connection
5. Click **Save**

Keys are securely stored in AWS Secrets Manager.

### Models Tab

View all available AI models:

```
┌─────────────────────────────────────────────────────────────────┐
│  AI Models                                         Filter: All  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GPT-4o                    OpenAI           $2.50/1M tokens     │
│  ├─ Context: 128K          Speed: Fast      Quality: Excellent  │
│                                                                  │
│  Claude 3.5 Sonnet         Anthropic        $3.00/1M tokens     │
│  ├─ Context: 200K          Speed: Fast      Quality: Excellent  │
│                                                                  │
│  Gemini 1.5 Pro            Google           $1.25/1M tokens     │
│  ├─ Context: 1M            Speed: Medium    Quality: Very Good  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Model Categories

Models are organized by capability:

| Category | Use Case |
|----------|----------|
| **Reasoning** | Complex analysis, decision-making |
| **Creative** | Writing, brainstorming |
| **Code** | Programming, debugging |
| **Fast** | Quick responses, low latency |
| **Vision** | Image analysis |
| **Embedding** | Vector search |

---

## 12. Self-Hosted Models

### Overview

Deploy AI models on your own AWS infrastructure for:
- Data sovereignty
- Reduced latency
- Cost optimization at scale
- Custom fine-tuned models

### Supported Models

| Model | Size | Instance Type | Monthly Cost |
|-------|------|---------------|--------------|
| Llama 3.1 8B | 8B | ml.g5.xlarge | ~$150 |
| Llama 3.1 70B | 70B | ml.g5.12xlarge | ~$1,200 |
| Mixtral 8x7B | 46.7B | ml.g5.4xlarge | ~$400 |
| CodeLlama 34B | 34B | ml.g5.2xlarge | ~$300 |

### Deployment Steps

1. Go to **Self-Hosted** tab
2. Click **Add Model**
3. Select model from catalog
4. Choose instance type
5. Set scaling parameters
6. Click **Deploy**

### Thermal States

Self-hosted models have thermal states to optimize costs:

| State | Description | Response Time |
|-------|-------------|---------------|
| **HOT** | Running, ready | Immediate |
| **WARM** | Scaled down, quick start | 30-60 seconds |
| **COLD** | Stopped | 3-5 minutes |
| **OFF** | Deleted | Full deploy |

### Auto-Scaling

Configure auto-scaling based on:
- Request count
- Queue depth
- Time of day (scheduled)

---

## 13. Multi-Region Deployment

### Overview

Deploy RADIANT across multiple AWS regions for:
- Geographic redundancy
- Reduced latency for global users
- Disaster recovery

### Supported Regions

| Region | Location | Latency Zone |
|--------|----------|--------------|
| us-east-1 | N. Virginia | Americas |
| us-west-2 | Oregon | Americas |
| eu-west-1 | Ireland | Europe |
| eu-central-1 | Frankfurt | Europe |
| ap-southeast-1 | Singapore | Asia |
| ap-northeast-1 | Tokyo | Asia |

### Configuration

1. Go to **Multi-Region** tab
2. Select primary region
3. Add secondary regions
4. Configure replication:
   - **Database**: Aurora Global Database
   - **Storage**: S3 Cross-Region Replication
   - **API**: Route53 latency-based routing

### Failover

Automatic failover when:
- Primary region health check fails
- Manual failover triggered
- Scheduled maintenance

---

## 14. Security & Compliance

### Security Tab

Configure security features:

| Feature | Description | Default |
|---------|-------------|---------|
| **WAF** | Web Application Firewall | On (Starter+) |
| **GuardDuty** | Threat detection | On (Starter+) |
| **Shield** | DDoS protection | Standard |
| **VPC Flow Logs** | Network monitoring | On |

### Compliance Tab

#### HIPAA Compliance

Enable for healthcare data:
- PHI encryption at rest and in transit
- Audit logging for all data access
- BAA documentation
- Access controls

#### SOC2 Compliance

Enable for enterprise:
- Comprehensive audit trails
- Access reviews
- Incident response procedures
- Vendor management

#### GDPR Compliance

Enable for EU data:
- Data subject access requests
- Right to erasure
- Data portability
- Consent management

### Compliance Reports

Generate compliance reports:

1. Go to **Compliance** tab
2. Select report type
3. Choose date range
4. Click **Generate**
5. Download PDF or JSON

---

## 15. Cost Management

### Costs Tab

View and manage AWS costs:

```
┌─────────────────────────────────────────────────────────────────┐
│  Cost Overview                              January 2026         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Month-to-Date:  $1,234.56                                      │
│  Projected:      $2,100.00                                      │
│  Budget:         $2,500.00                    ████████░░ 84%    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Cost Breakdown                                         │    │
│  │  ────────────────────────────────────────────────────   │    │
│  │  Aurora PostgreSQL    $450.00   ████████████░░░░ 36%   │    │
│  │  Lambda               $280.00   ████████░░░░░░░░ 23%   │    │
│  │  SageMaker            $200.00   ██████░░░░░░░░░░ 16%   │    │
│  │  S3 Storage           $120.00   ████░░░░░░░░░░░░ 10%   │    │
│  │  CloudFront           $100.00   ███░░░░░░░░░░░░░  8%   │    │
│  │  Other                 $84.56   ██░░░░░░░░░░░░░░  7%   │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Cost Optimization

The deployer includes automatic cost optimization:

| Feature | Savings | Description |
|---------|---------|-------------|
| **Thermal Management** | 30-70% | Scale down idle models |
| **Semantic Cache** | 20-40% | Cache repeated queries |
| **Model Routing** | 40-60% | Route to cheaper models when appropriate |
| **Reserved Capacity** | 30-50% | Pre-purchase compute capacity |

### Budget Alerts

Set up budget alerts:

1. Go to **Costs** tab
2. Click **Set Budget**
3. Enter monthly budget amount
4. Configure alert thresholds (50%, 75%, 90%, 100%)
5. Add notification emails

---

## 16. Monitoring

### Monitoring Tab

Real-time monitoring dashboard:

```
┌─────────────────────────────────────────────────────────────────┐
│  System Health                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  API Latency          45ms     ✓ Healthy                        │
│  Database             12ms     ✓ Healthy                        │
│  Lambda Cold Starts   2.3%     ✓ Healthy                        │
│  Error Rate           0.01%    ✓ Healthy                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Request Volume (Last 24h)                              │    │
│  │  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█              │    │
│  │  12am    6am    12pm    6pm    12am                     │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Health Checks

Automatic health checks run every 60 seconds:

| Check | Description | Threshold |
|-------|-------------|-----------|
| **API Gateway** | Endpoint availability | 99.9% |
| **Lambda** | Function execution | <5s p99 |
| **Database** | Connection pool | <90% utilized |
| **Storage** | S3 availability | 99.99% |

### Alerts

Configure alerts for:
- Error rate spikes
- Latency increases
- Resource exhaustion
- Security events

---

## 17. Snapshots & Rollbacks

### Snapshots Tab

View and manage deployment snapshots:

```
┌─────────────────────────────────────────────────────────────────┐
│  Deployment Snapshots                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📸 snap-2026-01-24-pre-update                                  │
│     Created: Jan 24, 2026 6:00 AM   Size: 2.3 GB                │
│     Version: 5.52.16   Reason: Pre-update backup                │
│     [Restore] [Download] [Delete]                                │
│                                                                  │
│  📸 snap-2026-01-20-manual                                      │
│     Created: Jan 20, 2026 3:00 PM   Size: 2.1 GB                │
│     Version: 5.45.0    Reason: Manual backup                    │
│     [Restore] [Download] [Delete]                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Creating Snapshots

Snapshots are created automatically:
- Before every update deployment
- Before rollbacks
- On a scheduled basis (configurable)

Manual snapshots:
1. Click **Create Snapshot**
2. Enter description
3. Choose components to include
4. Click **Create**

### Rollback Process

1. Go to **Snapshots** tab
2. Select snapshot to restore
3. Click **Restore**
4. Confirm the rollback
5. Monitor restoration progress

---

## 18. Package Management

### Packages Tab

Manage deployment packages:

```
┌─────────────────────────────────────────────────────────────────┐
│  Deployment Packages                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📦 radiant-5.52.17-stable.tar.gz          ✓ Current            │
│     Channel: Stable   Size: 45.2 MB   Downloaded: Jan 24        │
│                                                                  │
│  📦 radiant-5.52.16-stable.tar.gz                               │
│     Channel: Stable   Size: 44.8 MB   Downloaded: Jan 20        │
│                                                                  │
│  📦 radiant-5.53.0-beta.tar.gz                                  │
│     Channel: Beta     Size: 46.1 MB   Downloaded: Jan 23        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Release Channels

| Channel | Description | Stability |
|---------|-------------|-----------|
| **Stable** | Production-ready releases | Highest |
| **Beta** | Pre-release testing | Medium |
| **Canary** | Experimental features | Low |

### Package Operations

- **Download**: Get latest package from channel
- **Verify**: Check package integrity
- **Inspect**: View package contents
- **Delete**: Remove old packages

---

## 19. Settings

### General Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Theme** | Light/Dark/System | System |
| **Notifications** | Desktop notifications | On |
| **Auto-Update** | Check for updates | On |
| **Telemetry** | Anonymous usage data | Off |

### Credentials Settings

Manage 1Password integration and AWS credentials.

### Features Settings

Configure feature flags (see [Section 10](#10-feature-flags)).

### AI Assistant Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Enabled** | Use AI for assistance | On |
| **Model** | AI model to use | GPT-4o |
| **Voice Input** | Enable voice commands | Off |

### Timeout Settings

| Operation | Default | Range |
|-----------|---------|-------|
| **Deployment** | 30 min | 10-60 min |
| **Health Check** | 30 sec | 10-120 sec |
| **API Calls** | 60 sec | 10-300 sec |

### Storage Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Cache Location** | Package cache | ~/Library/Caches/RadiantDeployer |
| **Max Cache Size** | Maximum cache | 5 GB |
| **Log Retention** | Keep logs for | 30 days |

### Advanced Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Debug Mode** | Verbose logging | Off |
| **Dry Run** | Simulate deployments | Off |
| **Parallel Stacks** | Concurrent deployments | 3 |

---

## 20. AI Assistant

### Overview

The built-in AI Assistant helps with:
- Deployment planning
- Troubleshooting
- Cost optimization
- Configuration recommendations

### Activation

Press **⌘ + Shift + A** or click the sparkles icon in the toolbar.

### Example Queries

```
"What's the best tier for 500 users?"
"Why is my deployment failing?"
"How can I reduce costs?"
"Explain the Cortex memory system"
"Generate a compliance report for SOC2"
```

### Voice Commands

Enable voice input in Settings → AI Assistant:

1. Click the microphone icon
2. Speak your command
3. Review and confirm

---

## 21. Troubleshooting

### Common Issues

#### 1Password Not Detected

**Symptom**: "1Password CLI not found" error

**Solution**:
```bash
# Install CLI
brew install 1password-cli

# Enable integration in 1Password app
# Settings → Developer → Integrate with 1Password CLI

# Test
op signin
```

#### Deployment Stuck

**Symptom**: Deployment hangs at a specific stack

**Solution**:
1. Check CloudFormation console for detailed error
2. Review deployment logs in the app
3. Check AWS service quotas
4. Ensure IAM permissions are correct

#### DNS Validation Failing

**Symptom**: SSL certificate stuck in "Pending Validation"

**Solution**:
1. Verify CNAME records are correct
2. Wait up to 30 minutes for DNS propagation
3. Use `dig` to verify records:
   ```bash
   dig _acme-challenge.yourdomain.com CNAME
   ```

#### Health Check Failures

**Symptom**: Applications showing "Unhealthy"

**Solution**:
1. Check CloudWatch logs for errors
2. Verify Lambda functions are not timing out
3. Check database connectivity
4. Review security group rules

### Getting Help

1. **Documentation**: Press **⌘ + ?** for contextual help
2. **AI Assistant**: Ask the built-in assistant
3. **Logs**: Export logs from Settings → Storage → Export Logs
4. **Support**: Contact support@radiant.ai

---

## 22. Keyboard Shortcuts

### Global

| Shortcut | Action |
|----------|--------|
| **⌘ + ,** | Open Settings |
| **⌘ + R** | Refresh |
| **⌘ + N** | New Deployment |
| **⌘ + Shift + A** | AI Assistant |
| **⌘ + ?** | Help |
| **⌘ + Q** | Quit |

### Navigation

| Shortcut | Action |
|----------|--------|
| **⌘ + 1** | Dashboard |
| **⌘ + 2** | Apps |
| **⌘ + 3** | Deploy |
| **⌘ + 4** | Instances |
| **⌘ + 5** | Settings |

### Deployment

| Shortcut | Action |
|----------|--------|
| **⌘ + D** | Start Deployment |
| **⌘ + .** | Cancel Deployment |
| **⌘ + L** | View Logs |

---

## 23. Glossary

| Term | Definition |
|------|------------|
| **Aurora** | AWS managed PostgreSQL database service |
| **CDK** | AWS Cloud Development Kit for infrastructure as code |
| **CloudFront** | AWS content delivery network (CDN) |
| **Cortex** | RADIANT's three-tier memory system |
| **Curator** | Knowledge graph curation application |
| **Ego System** | Zero-cost persistent AI identity system |
| **Lambda** | AWS serverless compute service |
| **Multi-AZ** | Multiple availability zones for high availability |
| **SageMaker** | AWS machine learning service for self-hosted models |
| **Think Tank** | RADIANT's consumer AI chat application |
| **Thermal State** | Model readiness level (HOT/WARM/COLD/OFF) |
| **Tier** | Infrastructure size level (SEED to ENTERPRISE) |
| **WAF** | Web Application Firewall |

---

## Document Information

| Field | Value |
|-------|-------|
| **Version** | 5.52.17 |
| **Last Updated** | January 24, 2026 |
| **Author** | RADIANT Team |
| **Status** | Published |

---

*For additional support, contact support@radiant.ai or visit docs.radiant.ai*
