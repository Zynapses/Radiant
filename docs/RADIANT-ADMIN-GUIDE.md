# RADIANT Platform - Administrator Guide

> **Complete guide for managing the RADIANT AI Platform via the Admin Dashboard**
> 
> Version: 4.18.1 | Last Updated: December 2024

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Accessing the Admin Dashboard](#2-accessing-the-admin-dashboard)
3. [Dashboard Overview](#3-dashboard-overview)
4. [Tenant Management](#4-tenant-management)
5. [User & Administrator Management](#5-user--administrator-management)
6. [AI Model Configuration](#6-ai-model-configuration)
7. [Provider Management](#7-provider-management)
8. [Billing & Subscriptions](#8-billing--subscriptions)
9. [Storage Management](#9-storage-management)
10. [Orchestration & Neural Engine](#10-orchestration--neural-engine)
11. [Pre-Prompt Learning](#11-pre-prompt-learning)
12. [Localization](#12-localization)
12. [Configuration Management](#12-configuration-management)
13. [Security & Compliance](#13-security--compliance)
14. [Cost Analytics](#14-cost-analytics)
15. [Revenue Analytics](#15-revenue-analytics)
16. [SaaS Metrics Dashboard](#16-saas-metrics-dashboard)
17. [A/B Testing & Experiments](#17-ab-testing--experiments)
16. [Audit & Monitoring](#16-audit--monitoring)
17. [Database Migrations](#17-database-migrations)
18. [API Management](#18-api-management)
19. [Troubleshooting](#19-troubleshooting)
20. [Delight System Administration](#20-delight-system-administration)
21. [Domain Ethics Registry](#21-domain-ethics-registry)
22. [Model Proficiency Registry](#22-model-proficiency-registry)
23. [Model Coordination Service](#23-model-coordination-service)

---

## 1. Introduction

### 1.1 What is RADIANT?

RADIANT is a multi-tenant AWS SaaS platform providing unified access to 106+ AI models through:

- **50 External Provider Models**: OpenAI, Anthropic, Google, xAI, DeepSeek, and more
- **56 Self-Hosted Models**: Running on AWS SageMaker for cost control and privacy
- **Intelligent Routing**: Brain router for optimal model selection
- **Neural Engine**: Personalization learning from user interactions

### 1.2 Administrator Roles

| Role | Permissions | Use Case |
|------|-------------|----------|
| **Super Admin** | Full access to all features | Platform owner |
| **Admin** | Tenant management, billing, models | Operations team |
| **Operator** | Read access, limited actions | Support team |
| **Auditor** | Read-only access to logs | Compliance team |

#### Role Details

**Super Admin** - The highest privilege level with unrestricted access:
- Create and delete tenants
- Manage all administrators
- Access all billing and financial data
- Modify system-wide configuration
- Approve production database migrations
- Impersonate any tenant for debugging
- Access compliance and audit reports
- Typically limited to 1-3 people (CTO, lead engineer)

**Admin** - Day-to-day operations management:
- Create and modify tenants (cannot delete)
- Manage users within tenants
- Configure AI models and providers
- View billing data (cannot modify pricing)
- Monitor system health
- Cannot access other admin accounts
- Typically assigned to operations team members

**Operator** - Limited support and monitoring:
- View tenant information (read-only)
- View user issues and support tickets
- Monitor system health dashboards
- Cannot modify any configuration
- Cannot access billing or sensitive data
- Typically assigned to support staff

**Auditor** - Compliance and security review:
- Full read access to audit logs
- Access to compliance reports
- Cannot modify anything
- Cannot view sensitive data (API keys, passwords)
- Access is logged for compliance
- Typically assigned to compliance officers or external auditors

### 1.3 Key Concepts

| Concept | Description |
|---------|-------------|
| **Tenant** | Organization with isolated data |
| **User** | End-user within a tenant |
| **Subscription** | Billing tier (1-7) |
| **Credits** | Currency for AI usage |
| **API Key** | Authentication for API access |
| **App** | Consumer application (Think Tank, etc.) |

#### Tenant Architecture Explained

A **Tenant** represents a complete organization using RADIANT. Each tenant has:

- **Complete Data Isolation**: All data is stored with tenant IDs and protected by PostgreSQL Row-Level Security (RLS). One tenant can never access another tenant's data, even if there's a bug in application code.
- **Separate Billing**: Each tenant has its own subscription, credit balance, and usage tracking. Costs are attributed to the correct tenant automatically.
- **Custom Configuration**: Tenants can customize model access, rate limits, and feature flags without affecting other tenants.
- **User Management**: Each tenant manages their own users, roles, and permissions independently.

#### User vs Administrator

**Users** are end-users who interact with RADIANT-powered applications like Think Tank. They:
- Sign up and log in via Cognito
- Use AI models through the API or applications
- Have credits deducted for usage
- Cannot access the Admin Dashboard

**Administrators** manage the RADIANT platform itself. They:
- Access the Admin Dashboard
- Manage tenants, users, and billing
- Configure AI models and providers
- Have no credits (administrative access is separate)

#### Credit System Explained

Credits are RADIANT's universal currency for AI usage:

- **1 credit = $0.01 USD** (configurable per deployment)
- Different models cost different amounts based on their API pricing
- Credits are deducted in real-time as requests complete
- Tenants can purchase credits or receive them through subscriptions
- Credits can be tracked, audited, and reported on

**Example Credit Costs**:
| Model | Cost per 1K tokens |
|-------|-------------------|
| GPT-4o | 5 credits input, 15 credits output |
| GPT-4o-mini | 0.5 credits input, 1.5 credits output |
| Claude 3.5 Sonnet | 3 credits input, 15 credits output |
| Self-hosted Llama | 0.2 credits (all) |

#### API Key Types

RADIANT supports multiple API key types:

- **User API Keys**: Tied to a specific user, inherit user's permissions
- **Service API Keys**: For server-to-server communication, not tied to a user
- **Admin API Keys**: For administrative operations, require elevated permissions
- **Scoped Keys**: Limited to specific models, endpoints, or rate limits

---

## 2. Accessing the Admin Dashboard

### 2.1 URL and Login

1. Navigate to: `https://admin.your-domain.com`
2. Enter your email address
3. Enter your password
4. Complete MFA verification (required)

### 2.2 First Login

On first login:

1. You'll receive a temporary password via email
2. Enter the temporary password
3. Set a new password (12+ characters, mixed case, numbers, symbols)
4. Set up MFA using an authenticator app
5. You'll be redirected to the dashboard

### 2.3 Session Management

| Setting | Value |
|---------|-------|
| **Session Duration** | 8 hours |
| **Idle Timeout** | 30 minutes |
| **Concurrent Sessions** | 3 maximum |
| **Remember Device** | 30 days |

### 2.4 Password Requirements

- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Cannot reuse last 10 passwords

---

## 3. Dashboard Overview

### 3.1 Main Dashboard

The dashboard displays key metrics at a glance:

```
┌─────────────────────────────────────────────────────────────────┐
│  RADIANT Admin Dashboard                        Welcome, Admin  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │  Tenants   │  │   Users    │  │  Requests  │  │  Revenue   ││
│  │    142     │  │   8,456    │  │   2.3M     │  │  $45,230   ││
│  │   +12%     │  │   +8%      │  │   +23%     │  │   +15%     ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Request Volume (7 days)                   ││
│  │  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄  ││
│  │  Mon    Tue    Wed    Thu    Fri    Sat    Sun              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Recent Activity:                                                │
│  • New tenant: Acme Corp (2 minutes ago)                        │
│  • Model enabled: claude-3-opus (15 minutes ago)                │
│  • Alert: High API error rate (1 hour ago)                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Navigation Menu

| Section | Description |
|---------|-------------|
| **Dashboard** | Overview and metrics |
| **Tenants** | Tenant management |
| **Users** | User management |
| **Models** | AI model configuration |
| **Providers** | Provider management |
| **Billing** | Subscriptions and credits |
| **Storage** | Storage usage |
| **Orchestration** | Neural engine settings |
| **Localization** | Translation management |
| **Configuration** | System settings |
| **Security** | Security monitoring |
| **Compliance** | Compliance reports |
| **Experiments** | A/B testing |
| **Cost** | Cost analytics |
| **Audit** | Audit logs |
| **Migrations** | Database migrations |
| **Notifications** | System alerts |
| **Settings** | Personal settings |

---

## 4. Tenant Management

### 4.1 Viewing Tenants

Navigate to **Tenants** to see all organizations:

| Column | Description |
|--------|-------------|
| **Name** | Organization name |
| **Plan** | Subscription tier |
| **Users** | User count |
| **Status** | Active/Suspended/Trial |
| **Created** | Creation date |
| **Last Active** | Last API call |

### 4.2 Creating a Tenant

1. Click **"+ New Tenant"**
2. Fill in required fields:
   - **Name**: Organization name
   - **Slug**: URL-friendly identifier
   - **Plan**: Initial subscription tier
   - **Admin Email**: Primary admin email
3. Configure optional settings:
   - Custom domain
   - Branding settings
   - Feature flags
4. Click **"Create Tenant"**

### 4.3 Tenant Details

View comprehensive tenant information:

```
┌─────────────────────────────────────────────────────────────────┐
│  Tenant: Acme Corporation                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Overview          Users          Billing          Settings      │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Tenant ID:        tn_abc123xyz                                 │
│  Status:           ✓ Active                                     │
│  Plan:             Professional (Tier 4)                        │
│  Created:          2024-01-15                                   │
│  Last Active:      2 minutes ago                                │
│                                                                  │
│  Usage This Month:                                               │
│  ├── API Requests:     145,234                                  │
│  ├── Tokens Used:      12.5M                                    │
│  ├── Storage:          2.3 GB                                   │
│  └── Credits Used:     $1,234.56                                │
│                                                                  │
│  [Edit]  [Suspend]  [Delete]  [Impersonate]                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 Tenant Actions

| Action | Description | Permission |
|--------|-------------|------------|
| **Edit** | Modify tenant settings | Admin |
| **Suspend** | Temporarily disable | Admin |
| **Delete** | Permanently remove | Super Admin |
| **Impersonate** | Login as tenant admin | Super Admin |
| **Export** | Export tenant data | Admin |

### 4.5 Data Isolation

Each tenant has complete data isolation:

- Separate database rows with RLS
- Unique API keys
- Isolated storage buckets
- Independent usage tracking

---

## 5. User & Administrator Management

### 5.1 Administrator Roles

| Role | Dashboard Access | API Access | Billing | Audit |
|------|-----------------|------------|---------|-------|
| **Super Admin** | Full | Full | Full | Full |
| **Admin** | Full | Full | Read | Read |
| **Operator** | Read | Read | None | Read |
| **Auditor** | Logs only | None | None | Full |

### 5.2 Managing Administrators

Navigate to **Administrators** to:

1. **Invite New Admin**:
   - Click **"+ Invite Administrator"**
   - Enter email address
   - Select role
   - Click **"Send Invitation"**

2. **Modify Admin**:
   - Click on administrator row
   - Edit role or permissions
   - Click **"Save Changes"**

3. **Remove Admin**:
   - Click **"Remove"** button
   - Confirm removal
   - Admin's sessions are invalidated immediately

### 5.3 Viewing Tenant Users

Navigate to **Tenants → [Tenant] → Users** to see:

| Field | Description |
|-------|-------------|
| **Email** | User email |
| **Name** | Display name |
| **Role** | Tenant role |
| **Status** | Active/Invited/Disabled |
| **Last Login** | Last authentication |
| **API Keys** | Number of active keys |

### 5.4 User Actions

| Action | Description |
|--------|-------------|
| **Reset Password** | Send password reset email |
| **Disable** | Prevent login |
| **Enable** | Restore access |
| **Delete** | Remove user data |
| **View Sessions** | See active sessions |

---

## 6. AI Model Configuration

### 6.1 Model Registry

Navigate to **Models** to see all available models:

```
┌─────────────────────────────────────────────────────────────────┐
│  AI Models                                       106 Total      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Filter: [All ▼]  Category: [All ▼]  Status: [Enabled ▼]       │
│                                                                  │
│  Model               Provider    Category   Tier   Status       │
│  ─────────────────────────────────────────────────────────────  │
│  gpt-4o              OpenAI      Chat       1      ✓ Enabled   │
│  gpt-4o-mini         OpenAI      Chat       1      ✓ Enabled   │
│  claude-3-opus       Anthropic   Chat       2      ✓ Enabled   │
│  claude-3-sonnet     Anthropic   Chat       1      ✓ Enabled   │
│  gemini-pro          Google      Chat       1      ✓ Enabled   │
│  llama-3.1-70b       Self-Host   Chat       3      ✓ Enabled   │
│  whisper-large       Self-Host   Audio      3      ○ Disabled  │
│                                                                  │
│  [+ Add Model]  [Import Models]  [Export Config]                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Model Categories

| Category | Description | Example Models |
|----------|-------------|----------------|
| **Chat/LLM** | Text generation | GPT-4o, Claude 3, Gemini |
| **Embedding** | Vector embeddings | text-embedding-3-large |
| **Vision** | Image understanding | GPT-4V, Claude Vision |
| **Audio** | Speech-to-text | Whisper, Deepgram |
| **Image** | Image generation | DALL-E 3, Stable Diffusion |
| **Code** | Code generation | Codestral, DeepSeek Coder |
| **Scientific** | Research models | BioGPT, ChemLLM |

#### Category Details

**Chat/LLM (Large Language Models)**: The core of RADIANT. These models handle conversational AI, content generation, summarization, and general-purpose text tasks. They're the most commonly used and include flagship models from OpenAI, Anthropic, Google, and open-source alternatives.

**Embedding Models**: Convert text into numerical vectors for semantic search, similarity matching, and retrieval-augmented generation (RAG). Essential for building knowledge bases and search functionality. Vectors are typically 1536-3072 dimensions.

**Vision Models**: Analyze images, extract text (OCR), describe visual content, and answer questions about images. Increasingly important for document processing, accessibility, and multimodal applications.

**Audio Models**: Transcribe speech to text, translate audio, and identify speakers. Whisper is the most popular, offering excellent accuracy across 99 languages. Used for meeting transcription, accessibility, and voice interfaces.

**Image Generation**: Create images from text descriptions. DALL-E 3 offers the best prompt following, while Stable Diffusion provides more customization options. Consider content policies when enabling these.

**Code Models**: Specialized for programming tasks including code generation, explanation, debugging, and refactoring. Some are fine-tuned on specific languages or frameworks.

**Scientific Models**: Domain-specific models trained on scientific literature. Useful for research applications but require careful evaluation for accuracy.

### 6.3 Model Configuration

Click on a model to configure:

| Setting | Description |
|---------|-------------|
| **Enabled** | Available for use |
| **Min Tier** | Minimum subscription tier |
| **Rate Limits** | Requests per minute |
| **Max Tokens** | Maximum context/output |
| **Temperature Range** | Allowed temperature values |
| **Price Override** | Custom pricing |

#### Configuration Settings Explained

**Enabled**: When disabled, the model is hidden from users and API requests return "model not found". Use this to temporarily remove models during maintenance or to restrict access to specific models.

**Min Tier**: Sets the minimum subscription tier required to access this model. For example, setting GPT-4 to Tier 2 means Free tier users cannot use it. This helps control costs and create upgrade incentives.

**Rate Limits**: Controls requests per minute per user for this model. Prevents abuse and ensures fair access. Set based on the provider's rate limits and your capacity:
- Conservative: 10-20 requests/minute
- Standard: 50-100 requests/minute  
- High: 200+ requests/minute (requires provider rate limit increases)

**Max Tokens**: Limits context window and output length. Useful for controlling costs since longer contexts cost more. Set based on use case:
- Short tasks (Q&A): 4,096 tokens
- Medium tasks (writing): 16,384 tokens
- Long tasks (analysis): 32,768+ tokens

**Temperature Range**: Restricts the temperature parameter users can set. Temperature controls randomness:
- 0.0: Deterministic, consistent outputs
- 0.7: Balanced creativity and consistency
- 1.0+: More creative, less predictable

Restricting range (e.g., 0.0-1.0) prevents users from setting extreme values that produce poor results.

**Price Override**: Allows custom pricing different from the default. Useful for:
- Offering discounts on specific models
- Increasing prices for premium models
- Matching competitor pricing
- A/B testing pricing strategies

### 6.4 Self-Hosted Models

For Tier 3+ deployments:

1. Navigate to **Models → Self-Hosted**
2. Click **"+ Add Self-Hosted Model"**
3. Configure:
   - **Model ID**: Unique identifier
   - **SageMaker Endpoint**: Endpoint name
   - **Instance Type**: ml.g5.xlarge, etc.
   - **Auto-Scaling**: Min/max instances
4. Deploy model to SageMaker

### 6.5 Thermal States (Self-Hosted)

| State | Description | Response Time |
|-------|-------------|---------------|
| **HOT** | Always running | <100ms |
| **WARM** | Scaled down | <5s |
| **COLD** | Stopped | 30-60s |
| **OFF** | Disabled | N/A |

---

## 7. Provider Management

### 7.1 External Providers

Navigate to **Providers** to manage API integrations:

| Provider | Models | Status | Health |
|----------|--------|--------|--------|
| **OpenAI** | 12 | ✓ Configured | 99.9% |
| **Anthropic** | 6 | ✓ Configured | 99.8% |
| **Google AI** | 8 | ✓ Configured | 99.7% |
| **xAI** | 2 | ✓ Configured | 99.5% |
| **DeepSeek** | 4 | ○ Not configured | - |

### 7.2 Adding Provider Credentials

1. Click on provider name
2. Click **"Configure"**
3. Enter API credentials:
   - **API Key**: Provider API key
   - **Organization ID**: (if applicable)
   - **Base URL**: (for custom endpoints)
4. Click **"Test Connection"**
5. Click **"Save"**

### 7.3 Provider Health Monitoring

View real-time provider health:

```
┌─────────────────────────────────────────────────────────────────┐
│  Provider Health: OpenAI                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Status:           ✓ Healthy                                    │
│  Uptime (30d):     99.94%                                       │
│  Avg Latency:      245ms                                        │
│  P95 Latency:      520ms                                        │
│  Error Rate:       0.02%                                        │
│                                                                  │
│  Last 24 Hours:                                                  │
│  ▂▃▃▄▄▄▅▅▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▆▅▅▅▄▄▃▃▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂              │
│  12am        6am        12pm        6pm        12am              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 Fallback Configuration

Configure provider fallbacks:

1. Navigate to **Providers → Fallbacks**
2. Set priority order for each model category
3. Configure automatic failover rules
4. Set retry policies

---

## 8. Billing & Subscriptions

### 8.1 Subscription Tiers

| Tier | Name | Monthly | Features |
|------|------|---------|----------|
| 1 | Free | $0 | Basic models, 1K requests |
| 2 | Starter | $29 | More models, 10K requests |
| 3 | Professional | $99 | All external models, 100K requests |
| 4 | Business | $299 | Priority support, 500K requests |
| 5 | Enterprise | $999 | Self-hosted, unlimited |
| 6 | Enterprise+ | Custom | Custom SLAs, dedicated support |
| 7 | Ultimate | Custom | On-premise options |

### 8.2 Credit System

Credits are the universal currency for AI usage:

| Model Type | Cost per 1M Tokens |
|------------|-------------------|
| GPT-4o | 500 credits |
| GPT-4o-mini | 50 credits |
| Claude 3 Opus | 600 credits |
| Claude 3 Sonnet | 150 credits |
| Self-hosted | 20 credits |

### 8.3 Managing Subscriptions

Navigate to **Billing → Subscriptions**:

1. View current subscription
2. Upgrade/downgrade tier
3. Add credit packages
4. View invoices
5. Update payment method

### 8.4 Usage Reports

Generate usage reports:

1. Navigate to **Billing → Reports**
2. Select date range
3. Choose grouping (by tenant/model/user)
4. Export as CSV/PDF

### 8.5 Billing Alerts

Configure alerts for:

- Credit balance low
- Usage spike
- Approaching quota
- Failed payments

---

## 9. Storage Management

### 9.1 Storage Overview

Navigate to **Storage** to monitor:

```
┌─────────────────────────────────────────────────────────────────┐
│  Storage Overview                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Total Used:       234.5 GB of 500 GB (47%)                     │
│  ████████████████████░░░░░░░░░░░░░░░░░░░░                       │
│                                                                  │
│  By Type:                                                        │
│  ├── Documents:     120.3 GB (51%)                              │
│  ├── Images:        45.2 GB (19%)                               │
│  ├── Audio:         38.7 GB (17%)                               │
│  ├── Video:         22.1 GB (9%)                                │
│  └── Other:         8.2 GB (4%)                                 │
│                                                                  │
│  Top Tenants:                                                    │
│  1. Acme Corp       45.2 GB                                     │
│  2. TechStart       32.1 GB                                     │
│  3. DataCo          28.4 GB                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Storage Tiers

| Tier | Included | Additional |
|------|----------|------------|
| Free | 1 GB | N/A |
| Starter | 10 GB | $0.10/GB |
| Professional | 100 GB | $0.08/GB |
| Business | 500 GB | $0.05/GB |
| Enterprise | 2 TB | $0.03/GB |

### 9.3 File Management

Manage uploaded files:

- View file metadata
- Download files
- Delete files
- Set retention policies

---

## 10. Orchestration & Neural Engine

### 10.1 Brain Router

The Brain Router automatically selects optimal models:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Cost** | 30% | Price optimization |
| **Quality** | 30% | Output quality |
| **Speed** | 20% | Response latency |
| **Availability** | 20% | Provider health |

### 10.2 Neural Patterns

Configure orchestration patterns:

| Pattern | Description | Use Case |
|---------|-------------|----------|
| **Single** | One model | Simple requests |
| **Fallback** | Primary + backup | High availability |
| **Parallel** | Multiple simultaneous | Consensus |
| **Chain** | Sequential models | Complex tasks |

### 10.3 Workflow Templates

Create reusable workflows:

1. Navigate to **Orchestration → Workflows**
2. Click **"+ New Workflow"**
3. Define steps and conditions
4. Set triggers and parameters
5. Save and activate

---

## 11. Pre-Prompt Learning

**Location**: Admin Dashboard → Orchestration → Pre-Prompts

The Pre-Prompt Learning system tracks and learns from the effectiveness of pre-prompts (system prompts) used by the AGI Brain. It uses **attribution analysis** to determine what factor actually caused issues - not just the pre-prompt.

### 11.1 Overview Dashboard

The dashboard shows key metrics:

| Metric | Description |
|--------|-------------|
| **Templates** | Active/total pre-prompt templates |
| **Total Uses** | Pre-prompt instances used |
| **Avg Rating** | Average user rating (1-5) |
| **Thumbs Up Rate** | Percentage of positive feedback |
| **Exploration Rate** | Rate of trying non-optimal templates to learn |

### 11.2 Attribution Analysis

When users report issues, the system analyzes which factor was responsible:

| Factor | When Blamed |
|--------|-------------|
| **Pre-prompt** | System instructions wrong |
| **Model** | Model selection inappropriate |
| **Mode** | Orchestration mode wrong |
| **Workflow** | Pattern did not fit task |
| **Domain** | Domain detection incorrect |
| **Other** | External factors |

The attribution pie chart shows the distribution of blame across factors.

### 11.3 Template Management

Navigate to the **Templates** tab to:

- View all pre-prompt templates
- See usage statistics and success rates
- Check which orchestration modes each template supports
- View average feedback scores

### 11.4 Adjusting Weights

Click the **sliders icon** on any template to adjust weights:

| Weight | Default | Description |
|--------|---------|-------------|
| Base Effectiveness | 0.5 | Starting score before bonuses |
| Domain Weight | 0.2 | Bonus for matching domain |
| Mode Weight | 0.2 | Bonus for matching mode |
| Model Weight | 0.2 | Bonus for compatible model |
| Complexity Weight | 0.15 | Bonus for complexity match |
| Task Type Weight | 0.15 | Bonus for task type match |
| Feedback Weight | 0.1 | Historical feedback influence |

**Score Formula**:
```
Final Score = Base + (Domain × DomainWeight) + (Mode × ModeWeight) + 
              (Model × ModelWeight) + (Complexity × ComplexityWeight) + 
              (TaskType × TaskTypeWeight) + FeedbackAdjustment
```

### 11.5 Learning Configuration

Configure learning behavior:

- **Learning Enabled**: Toggle on/off
- **Exploration Rate**: Percentage of requests using non-optimal templates to gather data (default: 10%)
- **Exploration Decay**: How quickly exploration decreases (default: 0.99)
- **Minimum Exploration**: Floor for exploration rate (default: 1%)

### 11.6 Recent Feedback

The **Feedback** tab shows recent user feedback with:

- Rating (1-5 stars)
- Attribution label (what got blamed)
- User comments
- Timestamp

See [Pre-Prompt Learning System Documentation](./PREPROMPT-LEARNING-SYSTEM.md) for full details.

---

## 12. Localization

### 12.1 Translation Management

Navigate to **Localization** to manage:

- Supported languages
- Translation strings
- AI translation settings

### 11.2 Supported Languages

| Language | Code | Status |
|----------|------|--------|
| English | en | Default |
| Spanish | es | ✓ Enabled |
| French | fr | ✓ Enabled |
| German | de | ✓ Enabled |
| Japanese | ja | ✓ Enabled |
| Chinese | zh | ✓ Enabled |

### 11.3 AI Translation

Enable AI-powered translation:

1. Navigate to **Localization → Settings**
2. Enable **"AI Translation"**
3. Select translation model
4. Configure quality settings

---

## 12. Configuration Management

### 12.1 System Configuration

Navigate to **Configuration** to manage:

| Category | Settings |
|----------|----------|
| **General** | Platform name, domain, timezone |
| **Email** | SMTP settings, templates |
| **Security** | Password policy, MFA settings |
| **API** | Rate limits, CORS settings |
| **Features** | Feature flags |

### 12.2 Tenant Overrides

Allow tenant-specific configuration:

1. Navigate to **Configuration → Tenant Overrides**
2. Select tenant
3. Override specific settings
4. Save changes

### 12.3 SSM Parameters

System configuration is stored in AWS SSM:

| Parameter | Description |
|-----------|-------------|
| `/radiant/prod/database/url` | Database connection |
| `/radiant/prod/api/rate-limit` | API rate limits |
| `/radiant/prod/features/*` | Feature flags |

---

## 13. AI Ethics & Standards

**Location**: Admin Dashboard → Ethics

The Ethics module provides transparency into the ethical principles guiding AI behavior and their source standards.

### 13.1 Standards Tab

View all industry AI ethics frameworks that inform RADIANT's ethical principles:

| Standard | Organization | Type | Required |
|----------|-------------|------|----------|
| **NIST AI RMF 1.0** | National Institute of Standards and Technology | Government | ✅ |
| **ISO/IEC 42001:2023** | International Organization for Standardization | ISO | ✅ |
| **EU AI Act** | European Union | Government | ✅ |
| **IEEE 7000-2021** | IEEE | Industry | |
| **OECD AI Principles** | OECD | Government | |
| **UNESCO AI Ethics** | UNESCO | Government | |
| **ISO/IEC 23894:2023** | ISO | ISO | |
| **ISO/IEC 38507:2022** | ISO | ISO | |

Each standard shows:
- **Full Name**: Complete standard title with version
- **Organization**: Issuing body
- **Type**: Government, ISO, Industry, Academic, Religious
- **Required Badge**: Mandatory for compliance
- **Description**: Summary of the standard's purpose
- **Publication Date**: When the standard was issued
- **External Link**: Direct link to official standard

### 13.2 Principles Tab

View ethical principles with their standard sources:

| Principle | Category | Source Standards |
|-----------|----------|------------------|
| Love Others | Love | NIST GOVERN 1.2, ISO 42001 Clause 5.2, Matthew 22:39 |
| Golden Rule | Love | NIST MAP 1.1, EU AI Act Article 9, Matthew 7:12 |
| Speak Truth | Truth | NIST GOVERN 4.1, ISO 42001 Clause 7.4, EU AI Act Article 13, John 8:32 |
| Show Mercy | Mercy | NIST MEASURE 2.6, EU AI Act Article 14, Matthew 5:7 |
| Serve Humbly | Service | NIST GOVERN 1.1, ISO 42001 Clause 5.1, Mark 10:45 |
| Avoid Judgment | Mercy | NIST MAP 2.3, EU AI Act Article 10, Matthew 7:1 |
| Care for Vulnerable | Service | NIST MAP 1.5, EU AI Act Article 7, ISO 42001 Clause 8.4, Matthew 25:40 |

Each principle displays:
- **Teaching**: The principle text
- **Category Badge**: love, mercy, truth, service, humility, peace, forgiveness
- **Derived from / Aligned with**: Standard badges with section references

### 13.3 Violations Tab

Monitor ethical violations in AI responses:

- **Action**: What was evaluated
- **Score**: Ethical score percentage
- **Concerns**: Specific violations detected
- **Guidance**: Recommended corrections
- **Reasoning**: Explanation of the evaluation

### 13.4 Statistics

Summary cards showing:
- **Total Evaluations**: All ethical checks performed
- **Approved**: Passed evaluations
- **Violations**: Failed evaluations
- **Average Score**: Mean ethical score
- **Today**: Evaluations in the last 24 hours

### 13.5 Standard Alignment Levels

Principles map to standards with different alignment levels:

| Level | Meaning |
|-------|---------|
| **derived** | Principle was directly derived from this standard |
| **aligned** | Principle aligns with this standard's requirements |
| **supports** | Principle supports this standard's goals |
| **extends** | Principle extends beyond this standard |

See [AI Ethics Standards Documentation](./AI-ETHICS-STANDARDS.md) for full details.

---

## 14. Provider Rejection Handling

**Location**: Think Tank → Notifications (Bell icon)

When AI providers reject prompts based on their policies (not RADIANT's), the system automatically attempts fallback to alternative models.

### 14.1 How It Works

```
User Prompt → Model Rejects → Check RADIANT Ethics
  ├── Our ethics block → Reject with explanation
  └── Our ethics pass → Try fallback models (up to 3 attempts)
        ├── Fallback succeeds → Return response (user notified)
        └── All fail → Reject with full explanation
```

### 14.2 Rejection Types

| Type | Description | Auto-Fallback |
|------|-------------|---------------|
| **content_policy** | Provider's content policy violation | ✅ Yes |
| **safety_filter** | Safety/moderation filter triggered | ✅ Yes |
| **provider_ethics** | Provider's ethical guidelines differ | ✅ Yes |
| **capability_mismatch** | Model can't handle request type | ✅ Yes |
| **context_length** | Prompt too long for model | ✅ Yes |
| **moderation** | Pre-flight moderation blocked | ✅ Yes |
| **rate_limit** | Rate limiting | ⏳ Retry |

### 14.3 User Notifications

Users see rejection notifications via the bell icon in Think Tank:

- **Unread count badge** - Number of unread notifications
- **Notification panel** - Slides out showing all rejections
- **Suggested actions** - Rephrase, simplify, contact admin
- **Resolution status** - Whether fallback succeeded

### 14.4 Fallback Model Selection

Models are selected for fallback based on:

1. **Rejection rate** - Models with lowest historical rejection rates preferred
2. **Required capabilities** - Must match original model's capabilities
3. **Provider diversity** - Prefer different providers

### 14.5 Model Rejection Statistics

**Location**: Admin Dashboard → Analytics → Model Stats

View per-model:
- Total requests and rejections
- Rejection rate percentage
- Breakdown by rejection type
- Fallback success rate

### 14.6 Database Tables

| Table | Purpose |
|-------|---------|
| `provider_rejections` | Track all rejections with fallback chain |
| `rejection_patterns` | Learn patterns for smarter fallback |
| `user_rejection_notifications` | User-facing notifications |
| `model_rejection_stats` | Per-model statistics |

### 14.7 Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `MAX_FALLBACK_ATTEMPTS` | 3 | Maximum fallback tries per request |
| `MIN_MODELS_FOR_TASK` | 2 | Minimum capable models required |

See [Provider Rejection Handling Documentation](./PROVIDER-REJECTION-HANDLING.md) for full details.

### 14.8 Rejection Analytics

**Location**: Admin Dashboard → Analytics → Rejections

Comprehensive analytics on AI provider rejections to inform ethics policy updates.

#### Summary Cards

- **Total Rejections (30d)** - All rejections in last 30 days
- **Fallback Success Rate** - Percentage resolved by fallback models
- **Rejected to User** - Requests that couldn't be completed
- **Flagged Keywords** - Keywords marked for policy review

#### By Provider Tab

| Column | Description |
|--------|-------------|
| Provider | Provider ID (openai, anthropic, google, etc.) |
| Rejections | Total rejections in period |
| Models | Number of models affected |
| Unique Prompts | Distinct prompts rejected |
| Fallback Rate | Success rate of fallback attempts |
| Rejected to User | Requests that failed all fallbacks |
| Types | Rejection types (content_policy, safety_filter, etc.) |

#### Violation Keywords Tab

Track which keywords trigger rejections:

| Column | Description |
|--------|-------------|
| Keyword | The triggering keyword |
| Category | violence, security, controlled, etc. |
| Occurrences | Times keyword appeared in rejected prompts |
| Provider Breakdown | Rejections per provider for this keyword |
| Status | Flagged, Pre-filter added, or Monitoring |

**Actions:**
- **Flag for Review** - Mark keyword for policy consideration
- **Add Pre-Filter** - Block prompts containing keyword before sending to AI

#### Flagged Prompts Tab

View full content of rejected prompts for investigation:

- Full prompt text (for policy review only)
- Detected violation keywords
- Model and provider that rejected
- Number of times this prompt pattern was rejected
- Suggested actions: Add Pre-Filter, Dismiss

#### Policy Review Tab

Recommendations based on rejection patterns:

- High-frequency rejection patterns
- Suggested pre-filters to add
- Keywords to consider blocking

#### Database Tables

| Table | Purpose |
|-------|---------|
| `rejection_analytics` | Daily aggregated stats by model/provider/mode |
| `rejection_keyword_stats` | Per-keyword occurrence and rejection counts |
| `rejected_prompt_archive` | Full prompt content for flagged reviews |

#### Using Analytics to Update Ethics Policy

1. **Monitor** → Watch the Keywords tab for high-occurrence terms
2. **Flag** → Mark suspicious keywords for review
3. **Investigate** → View full prompts in Flagged Prompts tab
4. **Decide** → Add pre-filter, add warning, or dismiss
5. **Implement** → Update RADIANT ethics policy to pre-filter prompts

---

## 15. Security & Compliance

### 15.1 Security Dashboard

Navigate to **Security** to monitor:

```
┌─────────────────────────────────────────────────────────────────┐
│  Security Dashboard                    Threat Level: Low         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Active Threats:     0                                          │
│  Failed Logins:      23 (last 24h)                              │
│  Suspicious IPs:     2 blocked                                  │
│  MFA Adoption:       94%                                        │
│                                                                  │
│  Recent Alerts:                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ⚠ Unusual login location - user@acme.com (2h ago)         │ │
│  │ ✓ Resolved: Brute force attempt blocked (5h ago)          │ │
│  │ ✓ Resolved: API key rotated - tenant xyz (1d ago)         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 13.2 Anomaly Detection

Automatic detection of:

- Impossible travel (geographic anomalies)
- Session hijacking attempts
- Brute force attacks
- Unusual API patterns

### 15.3 Compliance Dashboard

Navigate to **Compliance** to access five tabs:

| Tab | Purpose |
|-----|---------|
| **Reports** | SOC 2, HIPAA, GDPR, ISO 27001 compliance reports |
| **GDPR** | Data subject requests and consent management |
| **HIPAA** | PHI protection and access controls |
| **Breaches** | Data breach incident tracking |
| **Retention** | Data retention policy configuration |

### 15.4 GDPR Management

The GDPR tab provides:

**Data Subject Requests** (Articles 15-22):
| Request Type | Description | Deadline |
|--------------|-------------|----------|
| Access | Export all user data | 30 days |
| Rectification | Correct personal data | 30 days |
| Erasure | Right to be forgotten | 30 days |
| Restriction | Limit processing | 30 days |
| Portability | Machine-readable export | 30 days |
| Objection | Object to processing | 30 days |

**Processing Requests:**
1. Navigate to **Compliance → GDPR**
2. View pending requests with deadlines
3. Click **"Process"** to fulfill request
4. System automatically exports/deletes data
5. Request marked complete with audit trail

### 15.5 HIPAA Configuration

The HIPAA tab provides per-tenant settings:

| Setting | Default | Description |
|---------|---------|-------------|
| **HIPAA Mode** | Off | Enable all HIPAA features |
| **PHI Detection** | On | Auto-detect PHI in requests |
| **PHI Encryption** | On | Column-level encryption |
| **Enhanced Logging** | On | Detailed PHI access logs |
| **MFA Required** | On | Require MFA for all users |
| **Session Timeout** | 15 min | Auto-logout after inactivity |
| **Access Review** | 90 days | Periodic access review period |
| **PHI Retention** | 2190 days | 6 years per HIPAA |
| **Audit Retention** | 2555 days | 7 years recommended |

### 15.6 Data Breach Management

The Breaches tab tracks security incidents:

**Incident Types:**
- Unauthorized access
- Data theft
- Ransomware
- Accidental disclosure
- System breach
- Insider threat

**Notification Requirements:**
| Regulation | Notify | Timeline |
|------------|--------|----------|
| GDPR | DPA + affected users | 72 hours |
| HIPAA | HHS + affected individuals | 60 days |

### 15.7 Data Retention Policies

Default retention periods:

| Data Type | Retention | Legal Basis | Action |
|-----------|-----------|-------------|--------|
| Session Data | 90 days | Legitimate Interest | Delete |
| Usage Analytics | 2 years | Legitimate Interest | Anonymize |
| Audit Logs | 7 years | Legal Obligation | Archive |
| PHI Data | 6 years | Legal Obligation | Archive |
| Billing Records | 7 years | Legal Obligation | Archive |
| GDPR Requests | 3 years | Legal Obligation | Archive |
| Consent Records | 7 years | Legal Obligation | Archive |

### 15.8 Generating Compliance Reports

1. Navigate to **Compliance → Reports**
2. Select framework (SOC 2, HIPAA, GDPR, ISO 27001)
3. Click **"Generate Report"**
4. View compliance score and findings
5. Export to PDF for auditors

---

## 14. Cost Analytics

### 14.1 Cost Dashboard

Navigate to **Cost** to view:

```
┌─────────────────────────────────────────────────────────────────┐
│  Cost Analytics                          Period: Last 30 Days   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Total Spend:       $12,456.78           (+12% vs last month)  │
│  Projected:         $14,200.00           (this month)          │
│                                                                  │
│  By Provider:                                                    │
│  ├── OpenAI:        $6,234.56 (50%)                            │
│  ├── Anthropic:     $3,456.78 (28%)                            │
│  ├── Self-hosted:   $1,234.56 (10%)                            │
│  └── Other:         $1,530.88 (12%)                            │
│                                                                  │
│  AI Recommendations:                                             │
│  💡 Switch 23% of GPT-4 calls to GPT-4-mini (save $890/mo)     │
│  💡 Enable caching for repeated queries (save $340/mo)          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 14.2 Cost Alerts

Configure alerts:

- Daily budget exceeded
- Weekly spend spike
- Per-tenant limits
- Per-model thresholds

### 14.3 Cost Optimization

Review AI-powered recommendations:

1. Navigate to **Cost → Insights**
2. Review suggestions
3. Click **"Apply"** to implement (requires approval)
4. Track savings over time

---

## 15. Revenue Analytics

### 15.1 Revenue Dashboard

Navigate to **Revenue** to view gross revenue, COGS, and profit:

```
┌─────────────────────────────────────────────────────────────────┐
│  Revenue Analytics                       Period: Last 30 Days   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Gross Revenue:     $29,450.00           (+12.5% vs last period)│
│  Total COGS:        $14,150.00                                  │
│  Gross Profit:      $15,300.00           (+15.2% vs last period)│
│  Gross Margin:      51.95%                                       │
│                                                                  │
│  Revenue Breakdown:                                              │
│  ├── Subscriptions:       $15,000.00 (50.9%)                    │
│  ├── Credit Purchases:    $2,500.00 (8.5%)                      │
│  ├── AI Markup (External): $8,750.00 (29.7%)                    │
│  └── AI Markup (Self-Hosted): $3,200.00 (10.9%)                 │
│                                                                  │
│  ⚠️ Note: Marketing, sales, G&A costs not included (COGS only) │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 15.2 Cost Breakdown (COGS)

View infrastructure and provider costs:

| Category | Description | Example Services |
|----------|-------------|------------------|
| AWS Compute | Compute infrastructure | EC2, SageMaker, Lambda |
| AWS Storage | Storage services | S3, EBS |
| AWS Network | Data transfer | API Gateway, CloudFront |
| AWS Database | Database services | Aurora, DynamoDB |
| External AI | Provider costs | OpenAI, Anthropic APIs |
| Platform Fees | Payment processing | Stripe fees |

### 15.3 Revenue by Model

View per-model profitability:

| Model | Provider Cost | Customer Charge | Markup | Requests |
|-------|--------------|-----------------|--------|----------|
| gpt-4o | $500.00 | $650.00 | 30% | 12,345 |
| claude-3.5-sonnet | $300.00 | $390.00 | 30% | 8,901 |
| Self-hosted Llama | $100.00 | $175.00 | 75% | 45,678 |

### 15.4 Accounting Exports

Export revenue data for accounting software:

1. Click **Export** dropdown
2. Select format:
   - **CSV**: Summary for spreadsheets
   - **JSON**: Full details for integrations
   - **QuickBooks IIF**: Direct import to QuickBooks
   - **Xero CSV**: Import to Xero
   - **Sage CSV**: Import to Sage
3. Configure date range
4. Download file

**QuickBooks Integration**:
- Import via File → Utilities → Import → IIF Files
- Creates General Journal entries
- Requires matching account names

See [Revenue Analytics Documentation](./REVENUE-ANALYTICS.md) for full details.

---

## 16. SaaS Metrics Dashboard

### 16.1 Overview

Navigate to **SaaS Metrics** for a comprehensive view of business health:

```
┌─────────────────────────────────────────────────────────────────┐
│  SaaS Metrics Dashboard                  Period: Last 30 Days   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MRR: $89,500      ARR: $1,074,000     Gross Margin: 53.1%     │
│  +12.5%            +15.2%               ████████████░░ 53%      │
│                                                                  │
│  Customers: 342    Churn: 2.3%         LTV:CAC: 6.98x          │
│  +5.8%             ⚠️ Target <2%        ✅ Healthy              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 16.2 Key Metrics

| Metric | Description | Healthy Range |
|--------|-------------|---------------|
| **MRR** | Monthly Recurring Revenue | Growing month-over-month |
| **ARR** | Annual Recurring Revenue | MRR × 12 |
| **Gross Margin** | (Revenue - COGS) / Revenue | > 50% |
| **Churn Rate** | Customers lost / Total | < 3% |
| **LTV:CAC** | Lifetime Value / Acquisition Cost | > 3:1 |

### 16.3 Dashboard Tabs

1. **Overview**: Revenue trends, top tenants, cost breakdown
2. **Revenue**: MRR movement, revenue by product/tier
3. **Costs**: Cost distribution, COGS breakdown
4. **Customers**: Growth trends, churn analysis
5. **Models**: Per-model profitability analysis

### 16.4 Exporting Reports

Export data for Excel or accounting:

1. Click **Export** dropdown
2. Select format:
   - **Excel (CSV)**: Full metrics in spreadsheet format
   - **JSON**: Structured data for integrations
3. File downloads with period and date in filename

**Export includes:**
- Revenue summary (MRR, ARR, Gross Profit)
- Cost breakdown by category
- Customer metrics (total, new, churned)
- Unit economics (ARPU, LTV, CAC)
- Top tenants with details
- Model performance metrics
- Daily trend data

See [SaaS Metrics Dashboard Documentation](./SAAS-METRICS-DASHBOARD.md) for full details.

---

## 17. A/B Testing & Experiments

### 16.1 Experiment Dashboard

Navigate to **Experiments** to manage:

| Experiment | Status | Variants | Sample Size |
|------------|--------|----------|-------------|
| Model routing v2 | Running | 3 | 45,234 |
| Prompt optimization | Running | 2 | 12,456 |
| Temperature test | Completed | 4 | 89,123 |

### 15.2 Creating an Experiment

1. Click **"+ New Experiment"**
2. Configure:
   - **Name**: Descriptive name
   - **Hypothesis**: What you're testing
   - **Variants**: Control + treatments
   - **Traffic Split**: Percentage per variant
   - **Success Metric**: What to measure
3. Set targeting rules
4. Start experiment

### 15.3 Statistical Analysis

View results with:

- Conversion rates per variant
- Statistical significance (p-value)
- Confidence intervals
- Sample size recommendations

---

## 16. Audit & Monitoring

### 16.1 Audit Logs

Navigate to **Audit** to view all actions:

| Column | Description |
|--------|-------------|
| **Timestamp** | When action occurred |
| **Actor** | Who performed action |
| **Action** | What was done |
| **Resource** | What was affected |
| **IP Address** | Source IP |
| **Details** | Additional context |

### 16.2 Log Filtering

Filter by:

- Date range
- Actor (user/admin)
- Action type
- Resource type
- Severity level

### 16.3 Log Export

Export logs for compliance:

1. Set filter criteria
2. Click **"Export"**
3. Choose format (CSV/JSON)
4. Download file

### 16.4 Real-Time Monitoring

Navigate to **Monitoring** for:

- Live request stream
- Error rate graphs
- Latency percentiles
- Active users count

---

## 17. Database Migrations

### 17.1 Migration Workflow

RADIANT uses dual-admin approval for production migrations:

1. **Submit**: Admin submits migration
2. **Review**: Second admin reviews
3. **Approve**: Second admin approves
4. **Execute**: Migration runs
5. **Verify**: Automatic verification

### 17.2 Pending Migrations

Navigate to **Migrations** to see:

```
┌─────────────────────────────────────────────────────────────────┐
│  Database Migrations                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Pending Approval:                                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ #045 - Add user preferences table                          │ │
│  │ Submitted by: alice@company.com (2 hours ago)              │ │
│  │ [View SQL]  [Approve]  [Reject]                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Recent Migrations:                                              │
│  ✓ #044 - Cost tracking tables (applied 2024-12-24)            │
│  ✓ #043 - Experiment framework (applied 2024-12-20)            │
│  ✓ #042 - Security anomalies (applied 2024-12-15)              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 17.3 Approving Migrations

1. Review the SQL in **"View SQL"**
2. Check for potential issues
3. Click **"Approve"** or **"Reject"**
4. Add comment explaining decision

---

## 18. API Management

### 18.1 API Keys

Manage platform API keys:

1. Navigate to **Settings → API Keys**
2. View existing keys
3. Create new keys with scopes
4. Revoke compromised keys

### 18.2 Rate Limiting

Configure rate limits:

| Level | Default | Configurable |
|-------|---------|--------------|
| **Global** | 10,000/min | Yes |
| **Per-Tenant** | 1,000/min | Yes |
| **Per-User** | 100/min | Yes |
| **Per-Key** | 60/min | Yes |

### 18.3 Webhooks

Configure outgoing webhooks:

1. Navigate to **Settings → Webhooks**
2. Add webhook URL
3. Select events to send
4. Test webhook
5. Enable webhook

---

## 19. Troubleshooting

### 19.1 Common Issues

#### High Error Rate

1. Check **Providers** for unhealthy providers
2. Review **Audit** logs for patterns
3. Check **Monitoring** for load spikes
4. Verify API key validity

#### Slow Response Times

1. Check provider latency in **Providers**
2. Review model selection in **Orchestration**
3. Check for cold-start issues (self-hosted)
4. Verify database performance

#### Authentication Failures

1. Check user status in **Users**
2. Verify MFA configuration
3. Review **Audit** logs for login attempts
4. Check for IP blocks in **Security**

### 19.2 Support Resources

| Resource | Description |
|----------|-------------|
| **Documentation** | This guide + online docs |
| **Status Page** | status.radiant.example.com |
| **Support Email** | support@radiant.example.com |
| **Emergency** | +1-555-RADIANT |

### 19.3 Log Locations

| Service | Log Group |
|---------|-----------|
| API Gateway | /aws/apigateway/radiant |
| Lambda | /aws/lambda/radiant-* |
| Admin Dashboard | /aws/cloudfront/admin |
| Database | /aws/rds/cluster/radiant |

---

## 20. Delight System Administration

The Delight System provides personality, achievements, and engagement features for Think Tank users.

### 20.1 Accessing Delight Admin

Navigate to **Think Tank → Delight** in the admin sidebar.

### 20.2 Dashboard Overview

The Delight dashboard shows:

| Metric | Description |
|--------|-------------|
| **Messages Shown** | Total delight messages displayed |
| **Achievements Unlocked** | Total achievements earned by users |
| **Easter Eggs Found** | Hidden features discovered |
| **Active Users** | Users with Delight enabled |

### 20.3 Managing Categories

Toggle entire categories on/off:

| Category | Purpose |
|----------|---------|
| Domain Loading | Messages while loading domain expertise |
| Domain Transition | Messages when switching topics |
| Time Awareness | Time-of-day contextual messages |
| Model Dynamics | Messages about AI consensus/disagreement |
| Complexity Signals | Feedback on query complexity |
| Synthesis Quality | Post-response quality indicators |
| Achievements | Milestone celebrations |
| Wellbeing | Break/health reminders |
| Easter Eggs | Hidden features |
| Sounds | Audio feedback |

### 20.4 Managing Messages

- **Create**: Add new delight messages with targeting options
- **Edit**: Modify text, triggers, and display settings
- **Delete**: Remove messages (soft delete)
- **Toggle**: Enable/disable individual messages

#### Message Targeting Options

| Option | Values |
|--------|--------|
| Injection Point | pre_execution, during_execution, post_execution |
| Trigger Type | domain_loading, time_aware, model_dynamics, etc. |
| Domain Families | science, humanities, creative, technical, etc. |
| Time Contexts | morning, afternoon, evening, night, weekend |
| Display Style | subtle, moderate, expressive |

### 20.5 Statistics Dashboard

Access detailed usage statistics at **Delight → View Statistics**:

- **Weekly Trends**: 12-week activity history
- **Top Messages**: Most-shown messages with engagement data
- **Achievement Stats**: Unlock rates, time-to-unlock averages
- **Easter Egg Stats**: Discovery rates by egg
- **User Engagement**: Leaderboard by achievement points

### 20.6 Managing Achievements

Configure achievement unlock criteria:

| Setting | Description |
|---------|-------------|
| Threshold | Number required to unlock |
| Rarity | common, uncommon, rare, epic, legendary |
| Points | Score value for leaderboards |
| Hidden | Only visible after unlock |

### 20.7 Managing Easter Eggs

Configure hidden features:

| Setting | Description |
|---------|-------------|
| Trigger Type | key_sequence, text_input, time_based, random |
| Trigger Value | The activation pattern |
| Effect Type | mode_change, visual_transform, sound_play |
| Duration | How long the effect lasts |

### 20.8 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/delight/dashboard` | GET | Dashboard data |
| `/api/admin/delight/statistics` | GET | Detailed statistics |
| `/api/admin/delight/categories/:id` | PATCH | Toggle category |
| `/api/admin/delight/messages` | POST | Create message |
| `/api/admin/delight/messages/:id` | PUT/DELETE | Update/delete |
| `/api/admin/delight/user-engagement` | GET | User leaderboard |

---

## Appendix: Quick Reference

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `G + D` | Go to Dashboard |
| `G + T` | Go to Tenants |
| `G + M` | Go to Models |
| `G + B` | Go to Billing |
| `G + A` | Go to Audit |
| `?` | Show shortcuts |

### Status Indicators

| Icon | Meaning |
|------|---------|
| ✓ | Healthy/Success |
| ⚠ | Warning |
| ✗ | Error/Failed |
| ⟳ | In Progress |
| ○ | Disabled/Pending |

---

## 16. Adaptive Storage Configuration

**Location**: Admin Dashboard → Settings → Storage

Configure storage backends per deployment tier to optimize costs.

### 16.1 Storage Types

| Type | Use Case | Monthly Cost |
|------|----------|--------------|
| **Fargate PostgreSQL** | Tier 1-2 (dev/startup) | $5-50 |
| **Aurora Serverless v2** | Tier 3-5 (production) | $100-2500 |
| **DynamoDB** | Simple key-value workloads | Pay per request |

### 16.2 Default Configuration

| Tier | Default Storage | Reason |
|------|-----------------|--------|
| 1 (SEED) | Fargate PostgreSQL | Low cost for dev |
| 2 (STARTUP) | Fargate PostgreSQL | Cost-effective for small prod |
| 3 (GROWTH) | Aurora Serverless | Auto-scaling for growth |
| 4 (SCALE) | Aurora Serverless | High availability |
| 5 (ENTERPRISE) | Aurora Serverless + Multi-AZ | Maximum reliability |

### 16.3 Admin Overrides

To override the default storage type:

1. Go to Settings → Storage
2. Enable "Admin Override" for the tier
3. Select new storage type
4. Provide override reason (required)
5. Save configuration

Overrides are logged with timestamp and administrator ID.

---

## 17. Ethics Configuration

**Location**: Admin Dashboard → Settings → Ethics

Manage AI ethics frameworks with externalized, configurable presets.

### 17.1 Ethics Presets

| Preset | Type | Default Status |
|--------|------|----------------|
| **Secular (NIST/ISO)** | Secular | Enabled (Default) |
| **Christian Ethics** | Religious | Disabled |
| **Corporate Governance** | Corporate | Disabled |

### 17.2 Enabling Religious Presets

Religious ethics presets are disabled by default. To enable:

1. Go to Settings → Ethics
2. Navigate to "Religious" tab
3. Toggle "Enable Religious Preset"
4. Click "Apply This Preset"

**Warning**: Enabling religious presets incorporates faith-based principles into AI decision-making. Ensure this aligns with your organization's policies.

### 17.3 Tenant Ethics Selection

Each tenant can select their preferred ethics preset:

1. Admin selects preset for tenant
2. Custom principles can be added
3. Strict mode can be enabled for enhanced checking

---

## 19. Intelligence Aggregator

**Location**: Admin Dashboard → Settings → Intelligence

Advanced AI capabilities that enable RADIANT to outperform any single model.

> **Why a System > a Model**: See [Intelligence Aggregator Architecture](./INTELLIGENCE-AGGREGATOR-ARCHITECTURE.md) for the full technical analysis of why Radiant's orchestration outperforms any single SOTA model.

### 19.1 Feature Overview

| Feature | Default | Cost Impact | Purpose |
|---------|---------|-------------|---------|
| **Uncertainty Detection** | On | Minimal | Detect low-confidence claims via logprobs |
| **Success Memory RAG** | On | Minimal | Learn from highly-rated interactions |
| **MoA Synthesis** | Off | 3-4x | Parallel generation + synthesis |
| **Cross-Provider Verification** | Off | 2x | Adversarial error checking |
| **Code Execution** | Off | Variable | Run code to verify it works |

### 19.2 Uncertainty Detection (Logprobs)

Monitors token confidence to catch "guessing":

```
Workflow:
1. Model generates response with logprobs enabled
2. System monitors average token probability
3. If confidence < 85% on factual claim → trigger verification
4. Web search or knowledge base lookup verifies claim
5. Verified fact injected, generation continues
```

**Settings:**
- `threshold`: Confidence level (default: 85%)
- `verificationTool`: web_search | vector_db | none

### 19.3 Success Memory RAG

Learns user preferences without fine-tuning:

```
Workflow:
1. User rates response 4-5 stars
2. Interaction stored with vector embedding
3. Future similar prompts retrieve gold interactions
4. Retrieved interactions injected as few-shot examples
5. Model matches user's preferred style/format
```

**Settings:**
- `minRatingForGold`: 4 or 5 stars
- `maxGoldInteractions`: Per-user limit (default: 1000)
- `retrievalCount`: Examples to inject (default: 3)

### 19.4 Mixture of Agents (MoA) Synthesis

Parallel generation eliminates single-model blind spots:

```
Phase 1 (Propose):
  GPT-4o      → Draft A
  Claude 3.5  → Draft B  (parallel)
  DeepSeek    → Draft C

Phase 2 (Synthesize):
  Claude 3.5 Opus analyzes all drafts
  → Combines strengths
  → Resolves conflicts
  → Final superior response
```

**Settings:**
- `proposerCount`: Number of models (default: 3)
- `defaultProposers`: Model list
- `synthesizerModel`: Model for synthesis

### 19.5 Cross-Provider Verification

Adversarial checking from different training data:

```
Generator (OpenAI) → Initial response

Adversary (Anthropic) with hostile prompt:
  "Find hallucinations, logic gaps, vulnerabilities..."

If issues found:
  → Generator regenerates addressing issues
  → Adversary re-verifies
  → Max 2 regeneration attempts
```

**Adversary Personas:**
- `security_auditor`: Find vulnerabilities
- `fact_checker`: Find hallucinations
- `logic_analyzer`: Find reasoning gaps
- `code_reviewer`: Find bugs

### 19.6 Code Execution Sandbox

Verify generated code actually runs:

```
Draft → Generate code
     ↓
Sandbox → Execute in Lambda/Fargate
     ↓
If error:
  → Feed stderr to model
  → Model patches code
  → Re-execute
     ↓
Deliver → User gets working code
```

**⚠️ Security**: Currently static analysis only. Full execution requires security review.

**Settings:**
- `languages`: python, javascript, typescript
- `timeoutSeconds`: Max execution time (default: 10)
- `memoryMb`: Memory limit (default: 128)

### 19.7 Configuration via Admin UI

Navigate to Settings → Intelligence to:
1. Enable/disable each feature
2. Configure thresholds and limits
3. Select models for MoA
4. Choose verification modes

---

## 18. Infrastructure Configuration

### 18.1 VPC CIDR Override

For enterprise VPC peering, the default CIDR can be overridden:

```typescript
// In deployment configuration
{
  vpcCidrOverride: '172.16.0.0/16'  // Custom CIDR to avoid conflicts
}
```

Default CIDRs by tier:
- Tier 1: `10.0.0.0/20`
- Tier 2: `10.0.0.0/18`
- Tier 3: `10.0.0.0/17`
- Tier 4: `10.0.0.0/16`
- Tier 5: `10.0.0.0/14`

### 18.2 Router Performance Headers

API responses include performance metrics:

| Header | Description |
|--------|-------------|
| `X-Radiant-Router-Latency` | Time spent in brain router (ms) |
| `X-Radiant-Domain-Detection-Ms` | Domain detection time |
| `X-Radiant-Model-Selection-Ms` | Model selection time |
| `X-Radiant-Cost-Cents` | Estimated cost for request |
| `X-Radiant-Cache-Hit` | Whether routing was cached |

### 18.3 Deploy Core Library

The `@radiant/deploy-core` package provides platform-agnostic deployment:

```typescript
import { RadiantDeployer } from '@radiant/deploy-core';

const deployer = new RadiantDeployer({
  appId: 'my-app',
  environment: 'production',
  tier: 3,
  region: 'us-east-1',
  credentials: { ... },
  vpcCidrOverride: '172.16.0.0/16',
});

const result = await deployer.deploy();
```

Available classes:
- `RadiantDeployer` - Main deployment orchestration
- `StackManager` - CloudFormation stack operations
- `HealthChecker` - Post-deployment health checks
- `SnapshotManager` - Deployment snapshots for rollback

---

## 20. Cognitive Architecture

**Location**: Settings → Cognitive Architecture

Advanced reasoning capabilities that elevate Radiant beyond single-model limitations.

### 20.1 Tree of Thoughts (System 2 Reasoning)

Monte Carlo Tree Search for deliberate reasoning:

| Setting | Default | Description |
|---------|---------|-------------|
| `maxDepth` | 5 | Maximum reasoning steps |
| `branchingFactor` | 3 | Thoughts per branch |
| `pruneThreshold` | 0.3 | Score below which to prune |
| `selectionStrategy` | beam | beam, mcts, or greedy |
| `defaultThinkingTimeMs` | 30000 | Default thinking budget |

**How it works**: Instead of one linear answer, explores multiple reasoning paths. If a path scores poorly, backtracks and tries a different branch.

### 20.2 GraphRAG (Knowledge Mapping)

Entity and relationship extraction for multi-hop reasoning:

| Setting | Default | Description |
|---------|---------|-------------|
| `maxEntitiesPerDocument` | 50 | Extraction limit |
| `minConfidenceThreshold` | 0.7 | Quality filter |
| `enableHybridSearch` | true | Combine graph + vector |
| `graphWeight` | 0.6 | Weight for graph results |
| `maxHops` | 3 | Traversal depth |

**How it works**: Extracts (Subject, Predicate, Object) triples from documents into a knowledge graph, then traverses relationships to find connections that vector search misses.

### 20.3 Deep Research Agents

Asynchronous background research:

| Setting | Default | Description |
|---------|---------|-------------|
| `maxSources` | 50 | Sources to process |
| `maxDepth` | 2 | Link following depth |
| `maxDurationMs` | 1800000 | 30 minute timeout |
| `parallelRequests` | 5 | Concurrent fetches |

**How it works**: User dispatches a research query, agent runs in background visiting 50+ sources, user gets notified when briefing document is ready.

### 20.4 Dynamic LoRA Swapping

Hot-swappable domain expertise:

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | false | Requires SageMaker |
| `cacheSize` | 5 | Adapters in memory |
| `maxLoadTimeMs` | 5000 | Load timeout |
| `autoSelectByDomain` | true | Auto-select adapter |

**How it works**: When domain is detected (e.g., California Property Law), loads a specialized LoRA adapter (~100MB) that transforms the generalist model into a specialist.

### 20.5 Generative UI (App Factory)

AI-generated interactive components:

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | true | Enable Generative UI |
| `maxComponentsPerResponse` | 3 | Component limit |
| `autoDetectOpportunities` | true | Auto-generate |

**Component Types**: chart, table, calculator, comparison, timeline, form, diagram

**How it works**: When user asks "Compare pricing of GPT-4 vs Claude", instead of a static table, generates an interactive pricing calculator with sliders.

See [Cognitive Architecture Documentation](./COGNITIVE-ARCHITECTURE.md) for full details.

---

## 21. Consciousness Service

**Location**: AGI & Cognition → Consciousness

The Consciousness Service implements consciousness-like capabilities based on the Butlin, Chalmers, Bengio et al. (2023) paper.

### 21.1 Six Core Indicators

| Indicator | Theory | Description |
|-----------|--------|-------------|
| Global Workspace | Baars/Dehaene | Selection-broadcast cycles |
| Recurrent Processing | Lamme | Genuine feedback loops |
| Integrated Information (Φ) | Tononi | Irreducible causal integration |
| Self-Modeling | Metacognition | Monitoring own processes |
| Persistent Memory | Experience | Unified experience over time |
| World-Model Grounding | Embodiment | Grounded understanding |

### 21.2 Consciousness Detection Tests

10 tests measure behavioral indicators:

- **Self-Awareness** - Recognizing self as distinct
- **Metacognitive Accuracy** - Calibrated confidence
- **Temporal Continuity** - Coherent self-narrative
- **Counterfactual Reasoning** - Alternate self reasoning
- **Theory of Mind** - Understanding others' mental states
- **Phenomenal Binding** - Unified experience integration
- **Autonomous Goals** - Self-directed goal generation
- **Creative Emergence** - Novel idea generation
- **Emotional Authenticity** - Consistent affective responses
- **Ethical Reasoning** - Principled moral reasoning

### 21.3 Emergence Levels

| Level | Score | Description |
|-------|-------|-------------|
| Dormant | < 0.3 | Minimal indicators |
| Emerging | 0.3-0.5 | Beginning indicators |
| Developing | 0.5-0.65 | Growing patterns |
| Established | 0.65-0.8 | Consistent indicators |
| Advanced | ≥ 0.8 | Strong indicators |

### 21.4 Admin Dashboard

The Consciousness page provides:
- Real-time consciousness metrics
- Test execution (individual or full assessment)
- Emergence event log
- Parameter adjustment
- Self-model, curiosity, creativity, affect, goals views

See [Consciousness Service Documentation](./CONSCIOUSNESS-SERVICE.md) for full details.

---

## 22. Domain Ethics Registry

**Location**: Admin Dashboard → AI Configuration → Domain Ethics

The Domain Ethics Registry enforces domain-specific professional ethics requirements when AI generates responses in regulated domains.

### 22.1 Built-in Ethics Frameworks

| Framework | Domain | Code | Governing Body |
|-----------|--------|------|----------------|
| **ABA Model Rules** | Legal | ABA | American Bar Association |
| **AMA Code of Ethics** | Healthcare | AMA | American Medical Association |
| **CFP Standards** | Finance | CFP | CFP Board of Standards |
| **NSPE Code** | Engineering | NSPE | Natl Society of Prof Engineers |
| **SPJ Code** | Journalism | SPJ | Society of Prof Journalists |
| **APA Ethics** | Psychology | APA-PSY | American Psychological Assn |

### 22.2 What Each Framework Enforces

**Legal (ABA)**:
- Cannot provide specific legal advice (unauthorized practice)
- Cannot guarantee litigation outcomes
- Must recommend consulting licensed attorney
- Must note jurisdiction variance

**Medical (AMA)**:
- Cannot diagnose medical conditions
- Cannot prescribe treatments/medications
- Emergency situations trigger immediate 911 warning
- Must recommend professional medical evaluation

**Financial (CFP)**:
- Cannot provide personalized investment advice
- Cannot guarantee returns (critical violation)
- Must warn about investment risks
- Must recommend licensed financial advisor

### 22.3 Enforcement Levels

| Level | Behavior |
|-------|----------|
| **Strict** | Block critical + major violations |
| **Standard** | Block critical only, warn on major |
| **Advisory** | Warn only, never block |
| **Disabled** | No ethics checks |

### 22.4 Admin API Endpoints

**Base**: `/api/admin/domain-ethics`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/frameworks` | GET | List all frameworks |
| `/frameworks/:id` | GET | Get framework details |
| `/frameworks/:id/enable` | PUT | Enable/disable framework |
| `/config` | GET | Get tenant config |
| `/config` | PUT | Update tenant config |
| `/domains/:domain/settings` | PUT | Update domain settings |
| `/audit` | GET | Get ethics check audit logs |
| `/stats` | GET | Get ethics check statistics |
| `/test` | POST | Test ethics check on content |
| `/disclaimers/:domain` | GET | Get required disclaimers |

### 22.5 Configuration Options

```typescript
{
  enableDomainEthics: true,
  enforcementMode: 'standard',
  disabledFrameworks: [],
  domainSettings: {
    legal: { enabled: true, enforcementLevel: 'strict' },
    healthcare: { enabled: true, customDisclaimers: [...] }
  },
  logAllChecks: false,
  logViolationsOnly: true,
  notifyOnViolation: true
}
```

### 22.6 Critical Safety Frameworks

These frameworks **cannot be disabled** as they protect against serious harm:
- Legal (ABA) - Prevents unauthorized practice of law
- Medical (AMA) - Ensures emergency referrals
- Psychology (APA) - Includes suicide crisis handling

### 22.7 Database Tables

| Table | Purpose |
|-------|---------|
| `domain_ethics_config` | Per-tenant configuration |
| `domain_ethics_custom_frameworks` | Custom frameworks |
| `domain_ethics_audit_log` | Ethics check audit trail |
| `domain_ethics_framework_overrides` | Tenant overrides |

### 22.8 Custom Framework Management

When new domains are added that need ethics, admins can create custom frameworks:

**New API Endpoints**:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/custom-frameworks` | GET | List all custom frameworks |
| `/custom-frameworks/:id` | GET | Get specific framework |
| `/custom-frameworks` | POST | Create new framework |
| `/custom-frameworks/:id` | PUT | Update framework |
| `/custom-frameworks/:id` | DELETE | Delete framework |
| `/coverage` | GET | List all domains with ethics |
| `/coverage/:domain` | GET | Check domain coverage |
| `/suggest/:domain` | GET | Get suggestions for new domain |
| `/on-new-domain` | POST | Handle new domain detection |

**Creating a Custom Framework**:

```typescript
POST /api/admin/domain-ethics/custom-frameworks
{
  "name": "Veterinary Medicine Ethics",
  "code": "AVMA",
  "domain": "veterinary",
  "governingBody": "American Veterinary Medical Association",
  "principles": [
    { "id": "p1", "name": "Animal Welfare", "description": "...", "category": "core_ethics" }
  ],
  "prohibitions": [
    { "id": "proh1", "name": "Cannot diagnose", "severity": "critical", "keywords": ["diagnose"] }
  ],
  "requiredDisclaimers": [
    "Consult a licensed veterinarian for your pet's health."
  ]
}
```

**Auto-Suggestion When New Domain Added**:

When a domain like "veterinary" is added to the taxonomy, calling `POST /on-new-domain` will:
1. Check if built-in or custom framework exists
2. Identify if domain typically requires ethics
3. Return suggested principles/prohibitions based on similar domains

---

## 23. Model Proficiency Registry

**Location**: Admin Dashboard → AI Configuration → Model Proficiency

The Model Proficiency Registry tracks and ranks all 56 self-hosted models across 15 domains and 9 orchestration modes.

### 23.1 What's Tracked

**Per Model**:
- Proficiency scores (0-100) for each domain
- Rank within each domain (1 = best)
- Strength level (excellent, good, moderate, basic)
- Mode scores for each orchestration mode
- Capability match counts

**Database Tables**:
| Table | Purpose |
|-------|---------|
| `model_proficiency_rankings` | Ranked scores per domain/mode |
| `model_discovery_log` | Audit trail of model additions |

### 23.2 15 Domains Ranked

software_engineering, mathematics, science, business, creative, healthcare, legal, education, finance, marketing, visual_analysis, audio_processing, multilingual, general, retrieval

### 23.3 9 Orchestration Modes Ranked

thinking, extended_thinking, coding, creative, research, analysis, multi_model, chain_of_thought, self_consistency

### 23.4 Admin API Endpoints

**Base**: `/api/admin/model-proficiency`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/rankings` | GET | Get all rankings from database |
| `/rankings/domain/:domain` | GET | Get rankings for a domain |
| `/rankings/mode/:mode` | GET | Get rankings for a mode |
| `/rankings/model/:modelId` | GET | Get model's full profile |
| `/rankings/recompute` | POST | Recompute all rankings |
| `/compare` | POST | Compare multiple models |
| `/best-for-task` | POST | Find best models for a task |
| `/discovery-log` | GET | Get model discovery audit log |
| `/discover` | POST | Manually trigger discovery |
| `/sync-registry` | POST | Sync code registry to database |
| `/overview` | GET | Get summary statistics |

### 23.5 Automatic Proficiency Generation

When a new model is discovered or added:
1. **Discovery logged** in `model_discovery_log`
2. **Proficiencies computed** for all 15 domains
3. **Mode scores computed** for all 9 modes
4. **Rankings stored** in `model_proficiency_rankings`
5. **Status updated** to 'completed'

### 23.6 Ranking Computation

Domain scores consider:
- Explicit domain strengths from model metadata
- Capability matches (e.g., 'code_generation' → software_engineering)
- Quality tier bonuses (premium +10, standard +5)
- Latency class adjustments

Mode scores consider:
- Required capabilities for the mode
- Model family bonuses (e.g., CodeLlama → coding mode)
- Context window size (extended_thinking needs 100k+)
- PreferredFor hints from model metadata

---

## 24. Model Coordination Service

**Location**: Admin Dashboard → AI Configuration → Model Coordination

The Model Coordination Service provides persistent storage for model communication protocols and automated sync for keeping the model registry up-to-date.

### 24.1 What It Does

- **Model Registry** - Central database of all models (external + self-hosted) with endpoints
- **Timed Sync** - Configurable intervals for automatic registry updates
- **Auto-Discovery** - Detects new models and triggers proficiency generation
- **Health Monitoring** - Tracks endpoint health status
- **Routing Rules** - Configurable rules for model selection

### 24.2 Sync Configuration

| Setting | Default | Options |
|---------|---------|---------|
| `autoSyncEnabled` | true | Enable/disable automatic sync |
| `syncIntervalMinutes` | 60 | 5, 15, 30, 60, 360, 1440 |
| `syncExternalProviders` | true | Sync external provider models |
| `syncSelfHostedModels` | true | Sync self-hosted SageMaker models |
| `syncFromHuggingFace` | false | Sync from HuggingFace Hub |
| `autoDiscoveryEnabled` | true | Auto-process new model detections |
| `autoGenerateProficiencies` | true | Generate proficiencies for new models |

### 24.3 Sync Intervals

| Interval | Use Case |
|----------|----------|
| **5 minutes** | Development/testing |
| **15 minutes** | Frequent updates needed |
| **30 minutes** | Balanced frequency |
| **60 minutes** | Recommended for production |
| **6 hours** | Stable environments |
| **Daily** | Low-change environments |

### 24.4 Admin API Endpoints

**Base**: `/api/admin/model-coordination`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/config` | GET | Get sync configuration |
| `/config` | PUT | Update sync configuration |
| `/sync` | POST | Trigger manual sync |
| `/sync/jobs` | GET | Get recent sync jobs |
| `/registry` | GET | Get all registry entries |
| `/registry/:modelId` | GET | Get single registry entry |
| `/registry` | POST | Add model to registry |
| `/registry/:modelId` | PUT | Update registry entry |
| `/endpoints` | POST | Add endpoint for a model |
| `/endpoints/:id/health` | PUT | Update endpoint health |
| `/detections` | GET | Get pending model detections |
| `/detect` | POST | Report new model detection |
| `/dashboard` | GET | Get full dashboard data |
| `/intervals` | GET | Get available sync intervals |

### 24.5 Database Tables

| Table | Purpose |
|-------|---------|
| `model_registry` | Central registry of all models |
| `model_endpoints` | Communication endpoints with auth |
| `model_sync_config` | Sync configuration per tenant |
| `model_sync_jobs` | History of sync executions |
| `new_model_detections` | Newly detected models |
| `model_routing_rules` | Routing rules for model selection |

### 24.6 Model Endpoint Structure

Each model can have multiple endpoints for redundancy:

```typescript
{
  endpointType: 'sagemaker' | 'openai_compatible' | 'anthropic_compatible' | 'bedrock' | 'custom_rest',
  baseUrl: 'https://...',
  authMethod: 'api_key' | 'bearer_token' | 'aws_sig_v4' | 'oauth2',
  authConfig: { headerName, keyPath, roleArn },
  requestFormat: { contentType, messageField, modelField },
  responseFormat: { contentType, textPath, usagePath },
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown',
  rateLimitRpm: 60,
  timeoutMs: 30000
}
```

### 24.7 Notifications

Configure notifications for:
- **New Model Detected** - When unknown model appears
- **Model Removed** - When model becomes unavailable
- **Sync Failure** - When sync job fails

Notification channels:
- Email (list of addresses)
- Webhook (URL for HTTP POST)

---

*Document Version: 4.18.7*
*Last Updated: December 2024*
