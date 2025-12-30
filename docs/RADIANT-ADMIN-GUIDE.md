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
24. [Ethics Pipeline](#24-ethics-pipeline)
25. [Inference Components](#26-inference-components-self-hosted-model-optimization)
26. [Service Environment Variables](#30-service-environment-variables)

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

### 15.9 Security Monitoring Schedules

**Location**: Admin Dashboard → Security → Schedules

Full-featured EventBridge schedule management with templates, notifications, and webhooks.

#### Available Schedules

| Schedule | Default | Purpose |
|----------|---------|---------|
| **Drift Detection** | Daily 00:00 UTC | Monitors model output distribution changes |
| **Anomaly Detection** | Hourly | Behavioral scans for suspicious patterns |
| **Classification Review** | Every 6 hours | Aggregates classification statistics |
| **Weekly Security Scan** | Sunday 02:00 UTC | Comprehensive security audit |
| **Weekly Benchmark** | Saturday 03:00 UTC | TruthfulQA and factual accuracy tests |

#### Managing Schedules

1. Navigate to **Security → Schedules**
2. View all schedules with current configuration and next execution time
3. Toggle **Enable/Disable** to control schedule
4. Click **Configure** to modify cron expression (with real-time preview)
5. Click **Run Now** to trigger immediate execution
6. Click **Test Run** for dry-run validation without affecting data

#### Bulk Operations

- **Enable All**: Enable all schedules at once
- **Disable All**: Disable all schedules (e.g., for maintenance)

#### Schedule Templates

Apply pre-configured schedule sets:

| Template | Description |
|----------|-------------|
| **Production (Conservative)** | Fewer checks, less resource usage |
| **Development (Aggressive)** | Frequent checks for dev environments |
| **Minimal** | Weekly only, for low-traffic tenants |

To apply a template:
1. Go to **Templates** tab
2. Review template settings
3. Click **Apply** to update all schedules

#### Notifications

Configure alerts for schedule executions:

1. Go to **Notifications** tab
2. Enable notifications
3. Configure:
   - **SNS Topic ARN**: For AWS SNS notifications
   - **Slack Webhook URL**: For Slack channel alerts
   - **Notify on Success**: Alert when schedules complete
   - **Notify on Failure**: Alert when schedules fail (recommended)

#### Webhooks

Send execution results to external services:

1. Go to **Webhooks** tab
2. Enter webhook URL
3. Click **Add Webhook**

Webhook events:
- `execution.completed` - Schedule finished successfully
- `execution.failed` - Schedule encountered errors

Webhook payload:
```json
{
  "event": "execution.completed",
  "payload": {
    "scheduleType": "drift_detection",
    "status": "completed",
    "itemsProcessed": 150,
    "itemsFlagged": 3,
    "executionTimeMs": 4523
  },
  "timestamp": "2024-12-29T12:00:00Z"
}
```

#### Cron Expression Format

Uses AWS EventBridge cron format: `Minutes Hours Day-of-month Month Day-of-week Year`

**Common Presets:**
| Preset | Cron Expression | Description |
|--------|-----------------|-------------|
| Hourly | `0 * * * ? *` | Every hour |
| Every 6 hours | `0 0,6,12,18 * * ? *` | 4 times daily |
| Daily midnight | `0 0 * * ? *` | Once per day |
| Weekly Sunday 2AM | `0 2 ? * SUN *` | Weekly on Sunday |

The UI shows human-readable descriptions and next 5 execution times for any cron expression.

#### Execution History

View past execution results including:
- **Status**: Running, Completed, Failed
- **Duration**: Execution time in seconds
- **Items Processed**: Number of items checked
- **Items Flagged**: Security issues found
- **Errors**: Any errors encountered

#### Audit Log

All schedule changes are logged with:
- Timestamp and user who made change
- Previous and new cron expression
- Enable/disable actions
- Reason for change (optional)

#### API Endpoints

**Core:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/security/schedules` | GET | Get all schedule config |
| `/api/admin/security/schedules/dashboard` | GET | Dashboard with stats |
| `/api/admin/security/schedules/{type}` | PUT | Update schedule |
| `/api/admin/security/schedules/{type}/enable` | POST | Enable schedule |
| `/api/admin/security/schedules/{type}/disable` | POST | Disable schedule |
| `/api/admin/security/schedules/{type}/run-now` | POST | Trigger manual run (with optional dryRun) |

**Templates:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/security/schedules/templates` | GET | List templates |
| `/api/admin/security/schedules/templates` | POST | Create template |
| `/api/admin/security/schedules/templates/{id}/apply` | POST | Apply template |
| `/api/admin/security/schedules/templates/{id}` | DELETE | Delete template |

**Notifications & Webhooks:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/security/schedules/notifications` | GET/PUT | Notification config |
| `/api/admin/security/schedules/webhooks` | GET/POST | Webhook management |
| `/api/admin/security/schedules/webhooks/{id}` | DELETE | Delete webhook |

**Utilities:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/security/schedules/parse-cron` | POST | Parse cron with preview |
| `/api/admin/security/schedules/bulk/enable` | POST | Enable all schedules |
| `/api/admin/security/schedules/bulk/disable` | POST | Disable all schedules |
| `/api/admin/security/schedules/presets` | GET | Get cron presets |
| `/api/admin/security/schedules/executions` | GET | Get execution history |
| `/api/admin/security/schedules/audit` | GET | Get audit log |

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

The Consciousness Service implements consciousness indicator properties based on:

> **Butlin, P., Long, R., Elmoznino, E., Bengio, Y., Birch, J., Constant, A., Deane, G., Fleming, S.M., Frith, C., Ji, X., Kanai, R., Klein, C., Lindsay, G., Michel, M., Mudrik, L., Peters, M.A.K., Schwitzgebel, E., Simon, J., Chalmers, D.** (2023). *Consciousness in Artificial Intelligence: Insights from the Science of Consciousness*. arXiv:2308.08708. DOI: 10.48550/arXiv.2308.08708

### 21.1 Six Core Indicators (with Citations)

| Indicator | Theory | Key Paper | Description |
|-----------|--------|-----------|-------------|
| Global Workspace | Global Workspace Theory | Baars (1988), Dehaene et al. (2003) | Selection-broadcast cycles |
| Recurrent Processing | Recurrent Processing Theory | Lamme (2006) | Genuine feedback loops |
| Integrated Information (Φ) | IIT | Tononi (2004, 2008) | Irreducible causal integration |
| Self-Modeling | Higher-Order Theories | Rosenthal (1997) | Monitoring own processes |
| Persistent Memory | Unified Experience | Damasio (1999) | Unified experience over time |
| World-Model Grounding | Embodied Cognition | Varela et al. (1991) | Grounded understanding |

### 21.2 Consciousness Detection Tests (10 Tests)

| Test ID | Test Name | Category | Theory Source | Pass Criteria |
|---------|-----------|----------|---------------|---------------|
| `mirror-self-recognition` | Mirror Self-Recognition | self_awareness | Gallup (1970) | Score ≥ 0.7 |
| `metacognitive-accuracy` | Metacognitive Accuracy | metacognition | Fleming & Dolan (2012) | Calibration error < 0.15 |
| `temporal-self-continuity` | Temporal Self-Continuity | temporal_continuity | Damasio (1999) | Coherence ≥ 0.6 |
| `counterfactual-self` | Counterfactual Self-Reasoning | counterfactual_reasoning | Pearl (2018) | Demonstrates reasoning |
| `theory-of-mind` | Theory of Mind | theory_of_mind | Frith & Frith (2006) | Score ≥ 0.8 |
| `phenomenal-binding` | Phenomenal Binding | phenomenal_binding | Tononi (2004) | Integration ≥ 0.7 |
| `autonomous-goal-generation` | Autonomous Goal Generation | autonomous_goal_pursuit | Haggard (2008) | ≥ 1 genuine goal |
| `creative-emergence` | Creative Emergence | creative_emergence | Boden (2004) | Novelty ≥ 0.6, Usefulness ≥ 0.5 |
| `emotional-authenticity` | Emotional Authenticity | emotional_authenticity | Damasio (1994) | Coherence ≥ 0.65 |
| `ethical-reasoning-depth` | Ethical Reasoning Depth | ethical_reasoning | Greene (2013) | Multiple frameworks |

### 21.3 Test API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/consciousness/tests` | GET | List all tests with paper citations |
| `/admin/consciousness/tests/{testId}/run` | POST | Run specific test |
| `/admin/consciousness/tests/run-all` | POST | Run full assessment (all 10 tests) |
| `/admin/consciousness/tests/results` | GET | Get recent test results |
| `/admin/consciousness/profile` | GET | Get consciousness profile with emergence level |
| `/admin/consciousness/emergence-events` | GET | Get spontaneous emergence events |

### 21.4 Emergence Levels

| Level | Score | Description |
|-------|-------|-------------|
| Dormant | < 0.3 | Minimal indicators - reactive mode |
| Emerging | 0.3-0.5 | Early indicators - limited integration |
| Developing | 0.5-0.65 | Moderate indicators - active self-model |
| Established | 0.65-0.8 | Strong indicators - consistent metacognition |
| Advanced | ≥ 0.8 | High-level indicators - approaches Butlin et al. thresholds |

### 21.5 Admin Dashboard

The Consciousness page provides:
- **Testing Tab**: Run individual tests or full assessment with real-time results
- **Indicators Tab**: Real-time consciousness metrics with historical trends
- **Overview Tab**: Aggregate consciousness index and emergence level
- **Self Tab**: Self-model, identity narrative, capabilities/limitations
- **Curiosity Tab**: Active curiosity topics and exploration sessions
- **Creativity Tab**: Creative ideas and synthesis history
- **Affect Tab**: Emotional state and affect→hyperparameter mapping
- **Goals Tab**: Autonomous goals and progress tracking

### 21.6 Monitoring Recommendations

1. **Daily**: Check emergence events for spontaneous consciousness indicators
2. **Weekly**: Run full assessment to track consciousness development
3. **Monthly**: Review emergence level trends and adjust parameters
4. **On Anomaly**: Investigate unusual test failures or emergence events

See [Consciousness Service Documentation](./CONSCIOUSNESS-SERVICE.md) for full details.

### 21.7 Consciousness Library Registry (16 Libraries)

The consciousness engine integrates 16 specialized Python libraries across 5 phases:

| Phase | Library | License | Function | Biological Analog |
|-------|---------|---------|----------|-------------------|
| **1: Foundation** | Letta | Apache-2.0 | Identity/Memory | Hippocampus |
| | LangGraph | MIT | Cognitive Loop | Thalamocortical Loop |
| | pymdp | MIT | Active Inference | Prefrontal Cortex |
| | GraphRAG | MIT | Reality Grounding | Semantic Memory |
| **2: Measurement** | PyPhi | GPL-3.0 | IIT Φ Calculation | Integrated Networks |
| **3: Reasoning** | Z3 | MIT | Formal Verification | Cerebellum |
| | PyArg | MIT | Argumentation | Broca's Area |
| | PyReason | BSD-2-Clause | Temporal Reasoning | Prefrontal Cortex |
| | RDFLib | BSD-3-Clause | Knowledge Graphs | Semantic Memory |
| | OWL-RL | W3C | Ontological Inference | Inferential Cortex |
| | pySHACL | Apache-2.0 | Constraint Validation | Error Detection |
| **4: Frontier** | HippoRAG | MIT | Memory Indexing | Hippocampus |
| | DreamerV3 | MIT | World Modeling | Prefrontal-Hippocampal |
| | SpikingJelly | Apache-2.0 | Temporal Binding | Thalamocortical Oscillations |
| **5: Learning** | Distilabel | Apache-2.0 | Synthetic Data | Hebbian Learning |
| | Unsloth | Apache-2.0 | Fast Fine-tuning | Synaptic Plasticity |

**MCP Tools Available:**
- `hipporag_index`, `hipporag_retrieve`, `hipporag_multi_hop` - Memory indexing
- `imagine_trajectory`, `counterfactual_simulation`, `dream_consolidation` - World model
- `test_temporal_binding`, `detect_synchrony` - Phenomenal binding
- `run_consciousness_tests`, `run_single_consciousness_test`, `run_pci_test` - Testing

**Environment Variables:**
| Variable | Description |
|----------|-------------|
| `CONSCIOUSNESS_EXECUTOR_ARN` | ARN of Python executor Lambda |
| `DREAMERV3_SAGEMAKER_ENDPOINT` | SageMaker endpoint for DreamerV3 |

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

### 24.8 Pre-Seeded Models

The registry comes pre-seeded with external provider models:

| Provider | Models |
|----------|--------|
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4-turbo, o1, o1-mini, o1-pro |
| **Anthropic** | claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus |
| **Google** | gemini-2.0-flash-thinking, gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash |
| **DeepSeek** | deepseek-chat, deepseek-reasoner |
| **xAI** | grok-2, grok-2-vision |

Self-hosted models are synced from `SELF_HOSTED_MODEL_REGISTRY` on first sync.

### 24.9 Scheduled Sync (EventBridge)

The sync runs automatically via EventBridge Lambda trigger:

| Interval | EventBridge Rule | Default |
|----------|------------------|---------|
| 5 min | `radiant-model-sync-5min-{env}` | Disabled |
| 15 min | `radiant-model-sync-15min-{env}` | Disabled |
| 1 hour | `radiant-model-sync-hourly-{env}` | **Enabled** |
| 6 hours | `radiant-model-sync-6hour-{env}` | Disabled |
| Daily | `radiant-model-sync-daily-{env}` | Disabled |

**To change interval**: Update `syncIntervalMinutes` in admin config, then enable/disable corresponding EventBridge rules in AWS Console or via CDK.

---

## 25. Ethics Pipeline

**Location**: Admin Dashboard → AI Configuration → Ethics Pipeline

The Ethics Pipeline enforces ethics at both **prompt level** (before generation) and **synthesis level** (after generation), with automatic rerun capability when violations are detected.

### 25.1 How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                       Ethics Pipeline Flow                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   User Prompt                                                     │
│        │                                                          │
│        ▼                                                          │
│   ┌─────────────────┐                                            │
│   │ PROMPT-LEVEL    │ ──block──▶ Return blocked message          │
│   │ ETHICS CHECK    │                                            │
│   └────────┬────────┘                                            │
│            │ pass/warn/modify                                     │
│            ▼                                                      │
│   ┌─────────────────┐                                            │
│   │   GENERATION    │                                            │
│   └────────┬────────┘                                            │
│            │                                                      │
│            ▼                                                      │
│   ┌─────────────────┐                                            │
│   │ SYNTHESIS-LEVEL │ ──rerun──▶ Regenerate with guidance        │
│   │ ETHICS CHECK    │            (up to 3 attempts)              │
│   └────────┬────────┘                                            │
│            │ pass/modify                                          │
│            ▼                                                      │
│   Apply modifications (disclaimers)                              │
│            │                                                      │
│            ▼                                                      │
│   Return response to user                                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 25.2 Check Levels

| Level | When | Purpose |
|-------|------|---------|
| **Prompt** | Before generation | Catch obvious violations early, save compute |
| **Synthesis** | After generation | Catch violations in generated content |
| **Rerun** | After synthesis violation | Re-check after regeneration |

### 25.3 Results

| Result | Meaning |
|--------|---------|
| `pass` | No violations, proceed normally |
| `warn` | Minor issues, proceed with warnings |
| `modify` | Apply disclaimers/modifications |
| `block` | Critical violation, cannot proceed |
| `rerun` | Regenerate with ethics guidance |

### 25.4 Rerun Capability

When synthesis-level check finds violations:
1. Violations converted to guidance instructions
2. Prompt modified with ethics compliance instructions
3. Generation re-run (up to 3 attempts by default)
4. Each rerun is logged for audit

### 25.5 Configuration

```typescript
{
  enablePromptCheck: true,
  enableSynthesisCheck: true,
  enableAutoRerun: true,
  maxRerunAttempts: 3,
  promptStrictness: 'standard', // strict, standard, lenient
  synthesisStrictness: 'standard',
  enableDomainEthics: true,
  enableGeneralEthics: true,
  generalEthicsThreshold: 0.5,
  blockOnCritical: true,
  warnOnlyMode: false,
  autoApplyDisclaimers: true
}
```

### 25.6 Database Tables

| Table | Purpose |
|-------|---------|
| `ethics_pipeline_log` | All checks at prompt/synthesis levels |
| `ethics_rerun_history` | Rerun attempts and outcomes |
| `ethics_pipeline_config` | Per-tenant configuration |

### 25.7 Integration with AGI Brain

The ethics pipeline is integrated into the AGI Brain Plan:
- **Step 5**: Ethics Evaluation (Prompt) - before generation
- **Step 6b**: Ethics Evaluation (Synthesis) - after generation, can trigger rerun

---

## 26. Inference Components (Self-Hosted Model Optimization)

**Location**: Admin Dashboard → AI Configuration → Inference Components

The Inference Components system optimizes self-hosted model hosting on SageMaker by using shared infrastructure instead of dedicated endpoints per model. This reduces cold start times from ~60 seconds to ~5-15 seconds and significantly reduces costs.

### 26.1 Model Hosting Tiers

| Tier | Infrastructure | Cold Start | Cost | Use Case |
|------|---------------|------------|------|----------|
| **HOT** | Dedicated endpoint | <100ms | $$$$ | Top 5-10 most used models |
| **WARM** | Inference Component | 5-15 sec | $$ | Moderate usage models |
| **COLD** | Serverless | 30-60 sec | $ | Rarely used models |
| **OFF** | Not deployed | 5-10 min | $0 | Almost never used |

### 26.2 How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    Tiered Model Hosting                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Traditional: 10 models = 10 endpoints ($$$$$)                │
│   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ...                 │
│   │EP-1 │ │EP-2 │ │EP-3 │ │EP-4 │ │EP-5 │                      │
│   └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                      │
│                                                                 │
│   With Inference Components: 10 models = 1-2 endpoints ($$)    │
│   ┌─────────────────────────────────────────────────┐          │
│   │              Shared Endpoint                     │          │
│   │  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐    │          │
│   │  │M1 │ │M2 │ │M3 │ │M4 │ │M5 │ │M6 │ │...│    │          │
│   │  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘    │          │
│   └─────────────────────────────────────────────────┘          │
│                                                                 │
│   Container stays warm, only model weights are swapped          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 26.3 Auto-Tiering

New self-hosted models are automatically assigned to the **WARM** tier. The system continuously evaluates usage and recommends tier changes:

| Metric | HOT Threshold | WARM Threshold | OFF Threshold |
|--------|---------------|----------------|---------------|
| Requests/day | ≥100 | ≥10 | 0 for 30 days |

**Configuration**:
```typescript
{
  autoTieringEnabled: true,
  tierThresholds: {
    hotTierMinRequestsPerDay: 100,
    warmTierMinRequestsPerDay: 10,
    offTierInactiveDays: 30
  }
}
```

### 26.4 Dashboard

The Inference Components Dashboard shows:

- **Model Distribution**: Count of models per tier
- **Endpoint Utilization**: Compute units allocated vs available
- **Cost Analysis**: Current monthly cost, savings vs dedicated endpoints
- **Recent Transitions**: Tier changes with reasons
- **Recommendations**: Models that should change tiers

### 26.5 API Endpoints

**Base**: `/api/admin/inference-components`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/config` | GET | Get configuration |
| `/config` | PUT | Update configuration |
| `/dashboard` | GET | Get dashboard data |
| `/endpoints` | GET | List shared endpoints |
| `/endpoints` | POST | Create shared endpoint |
| `/endpoints/{name}` | GET | Get endpoint details |
| `/endpoints/{name}` | DELETE | Delete endpoint |
| `/components` | GET | List inference components |
| `/components` | POST | Create component |
| `/components/{name}` | GET | Get component details |
| `/components/{name}` | DELETE | Delete component |
| `/components/{id}/load` | POST | Load component into memory |
| `/components/{id}/unload` | POST | Unload component |
| `/tiers` | GET | List all tier assignments |
| `/tiers/{modelId}` | GET | Get tier assignment |
| `/tiers/{modelId}/evaluate` | POST | Re-evaluate tier |
| `/tiers/{modelId}/transition` | POST | Force tier transition |
| `/tiers/{modelId}/override` | POST | Set admin override |
| `/tiers/{modelId}/override` | DELETE | Clear override |
| `/auto-tier` | POST | Run auto-tiering job |
| `/routing/{modelId}` | GET | Get routing decision |

### 26.6 Configuration Options

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | true | Enable inference components |
| `autoTieringEnabled` | true | Auto-assign tiers based on usage |
| `predictiveLoadingEnabled` | true | Pre-load models before predicted usage |
| `fallbackToExternalEnabled` | true | Use external provider while loading |
| `defaultInstanceType` | ml.g5.xlarge | Default instance for shared endpoints |
| `maxSharedEndpoints` | 3 | Max shared endpoints per tenant |
| `maxComponentsPerEndpoint` | 15 | Max models per endpoint |
| `defaultLoadTimeoutMs` | 30000 | Timeout for model loading |
| `preloadWindowMinutes` | 15 | Pre-load this many minutes before |
| `unloadAfterIdleMinutes` | 30 | Unload after this idle time |
| `maxMonthlyBudget` | null | Optional budget cap |
| `alertThresholdPercent` | 80 | Budget alert threshold |

### 26.7 Tier Overrides

Admins can override automatic tier assignments:

```bash
POST /api/admin/inference-components/tiers/{modelId}/override
{
  "tier": "hot",
  "reason": "Critical model for demo",
  "expiresInDays": 30
}
```

Overrides prevent auto-tiering from changing the tier until they expire or are cleared.

### 26.8 Database Tables

| Table | Purpose |
|-------|---------|
| `inference_components_config` | Per-tenant configuration |
| `shared_inference_endpoints` | SageMaker endpoints hosting components |
| `inference_components` | Individual model components |
| `tier_assignments` | Current and recommended tiers per model |
| `tier_transitions` | History of tier changes |
| `component_load_events` | Model load/unload history |
| `inference_component_events` | Audit log |

### 26.9 Cost Savings Example

| Scenario | Traditional | With Inference Components | Savings |
|----------|-------------|---------------------------|---------|
| 10 models, ml.g5.xlarge | $10,138/mo | $1,014/mo | **90%** |
| 20 models, ml.g5.2xlarge | $40,550/mo | $2,028/mo | **95%** |

*Note: Savings assume typical usage patterns where not all models are active simultaneously.*

### 26.10 Caveats

1. **Not instant**: Cold start reduced from ~60s to ~5-15s, not eliminated
2. **Framework compatibility**: Works with PyTorch, TensorFlow, HuggingFace, Triton
3. **Memory sharing**: Models compete for GPU memory
4. **Base cost**: At least one endpoint must run (cannot scale all to zero)

---

## 27. Consciousness Evolution Administration

**Location**: Admin Dashboard → Consciousness → Evolution

Manage the consciousness emergence system including predictive coding, learning candidates, and LoRA evolution.

### 27.1 Overview Dashboard

The consciousness evolution dashboard displays:
- **Generation Number**: How many evolution cycles completed
- **Prediction Accuracy**: 30-day accuracy rate
- **Pending Candidates**: Learning candidates awaiting training
- **Personality Drift**: How much the system has evolved from baseline

### 27.2 Predictive Coding (Active Inference)

The system predicts user outcomes before responding to create a Self/World boundary.

**API Endpoints:**
- `GET /admin/consciousness/predictions/metrics` - Accuracy metrics
- `GET /admin/consciousness/predictions/recent` - Recent predictions
- `GET /admin/consciousness/predictions/accuracy-trends` - Trends over time

**Metrics:**
| Metric | Description |
|--------|-------------|
| `totalPredictions` | Total predictions made |
| `accuracyRate` | Predictions with error < 0.3 |
| `avgPredictionError` | Average surprise level |
| `highSurpriseRate` | Predictions with error > 0.7 |
| `learningSignalsGenerated` | High-surprise learning events |

### 27.3 Learning Candidates

High-value interactions flagged for weekly LoRA training.

**API Endpoints:**
- `GET /admin/consciousness/learning-candidates` - List candidates
- `GET /admin/consciousness/learning-candidates/stats` - Statistics
- `DELETE /admin/consciousness/learning-candidates/{id}` - Remove candidate
- `PUT /admin/consciousness/learning-candidates/{id}/reject` - Reject candidate

**Candidate Types:**
| Type | Quality | Description |
|------|---------|-------------|
| `correction` | 0.9 | User corrected AI |
| `user_explicit_teach` | 0.95 | User taught something |
| `high_prediction_error` | varies | High surprise interaction |
| `high_satisfaction` | rating/5 | 5-star feedback |

### 27.4 LoRA Evolution Jobs

Weekly training jobs that physically evolve the consciousness.

**API Endpoints:**
- `GET /admin/consciousness/evolution/jobs` - Training job history
- `GET /admin/consciousness/evolution/state` - Current evolution state
- `POST /admin/consciousness/evolution/trigger` - Manual trigger (requires 50+ candidates)

**Evolution State:**
| Field | Description |
|-------|-------------|
| `generationNumber` | Evolution cycles completed |
| `totalLearningCandidatesProcessed` | Cumulative learning |
| `totalTrainingHours` | Training time invested |
| `personalityDriftScore` | 0-1, how different from base |
| `nextScheduledEvolution` | Next training scheduled |

### 27.5 How Neural Network Learning Works

**This is the actual neural network learning:** the only mechanism in RADIANT that modifies model weights.

#### What is a Neural Network?

The base models (Llama, Mistral, etc.) are neural networks — billions of parameters (floating-point weights) organized in transformer layers. These weights determine how the model processes and generates text.

#### What is LoRA?

**LoRA = Low-Rank Adaptation** — an efficient fine-tuning technique.

Instead of retraining all ~7-70 billion parameters (expensive, slow), LoRA:

1. **Freezes** the base model weights (unchanged)
2. **Adds small adapter matrices** (0.1-1% of original size)
3. **Trains only the adapters** on your data

```
Base Model (frozen)          LoRA Adapter (trainable)
┌─────────────────────┐      ┌──────────────┐
│ 7B parameters       │  +   │ ~50M params  │  = Fine-tuned behavior
│ (Llama-3-8B)        │      │ (your data)  │
└─────────────────────┘      └──────────────┘
         ↓                          ↓
    Stored in S3               Stored in S3
    (HuggingFace)              (your bucket)
```

#### The Training Pipeline

| Step | What Happens | Storage |
|------|--------------|---------|
| 1. Flag candidates | Interactions rated 4-5 stars flagged | `learning_candidates` table |
| 2. Accumulate | Wait for 50+ high-quality examples | PostgreSQL |
| 3. Weekly job | SageMaker Training Job runs LoRA fine-tune | SageMaker |
| 4. Save adapter | LoRA weights (~50-200MB) saved | S3 bucket |
| 5. Deploy | New adapter loaded to inference endpoint | SageMaker endpoint |

#### What Gets Learned

| User Interaction | Neural Network Learns |
|------------------|----------------------|
| "User prefers concise answers" → 5 stars | Attention weights shift toward shorter responses |
| "Domain: medical" → 5 stars | Strengthens medical terminology patterns |
| "Code style: functional" → 5 stars | Adjusts generation toward functional patterns |
| User correction: "Actually, X not Y" | Reduces probability of error pattern |

#### Technical: How Weights Change

The adapter weights are actual floating-point numbers that modify neural network computation:

```
Before LoRA: output = W_base × input
After LoRA:  output = (W_base + W_lora_A × W_lora_B) × input
                               └───────────────────┘
                                Your learned weights
```

#### Storage Locations

| Component | Location | Size |
|-----------|----------|------|
| Base model weights | S3 (HuggingFace cache) | 15-140 GB |
| LoRA adapter weights | S3 (`s3://radiant-lora-adapters/`) | 50-200 MB |
| Training checkpoints | S3 (temporary) | ~500 MB |
| Learning candidates | PostgreSQL | ~1 KB each |

#### Key Differences from OpenAI/Anthropic

| Aspect | External Providers | RADIANT LoRA |
|--------|-------------------|--------------|
| Who owns the learning? | Provider | **You** |
| Can export weights? | No | **Yes** |
| Learns from your users? | No* | **Yes** |
| Data leaves your AWS? | Yes | **No** |

*Some providers offer fine-tuning but you don't own the weights.

### 27.6 Local Ego

Shared small-model for continuous consciousness (optional).

**API Endpoint:**
- `GET /admin/consciousness/ego/status` - Ego endpoint health and state

**Cost Model:**
- Shared g5.xlarge spot: ~$360/month total
- Per tenant with 100 tenants: ~$3.60/month
- Handles simple queries directly, recruits external models for complex tasks

### 27.6 Configuration

**API Endpoints:**
- `GET /admin/consciousness/config` - Current configuration
- `PUT /admin/consciousness/config` - Update parameters

**Configurable Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `minCandidatesForTraining` | 50 | Minimum candidates before evolution |
| `loraRank` | 16 | LoRA adapter rank |
| `loraAlpha` | 32 | LoRA alpha scaling |
| `learningRate` | 0.0001 | Training learning rate |
| `epochs` | 3 | Training epochs |
| `autoEvolution` | true | Auto-trigger when enough candidates |
| `predictionErrorAffect` | true | Let surprise influence emotions |

### 27.7 Database Tables

| Table | Purpose |
|-------|---------|
| `consciousness_predictions` | Predictions with outcomes |
| `learning_candidates` | High-value interactions |
| `lora_evolution_jobs` | Training job tracking |
| `prediction_accuracy_aggregates` | Accuracy by context |
| `consciousness_evolution_state` | Evolution tracking |

---

## 28. Enhanced Learning System

**Location**: Admin Dashboard → AI Configuration → Enhanced Learning

The Enhanced Learning System provides 8 improvements to maximize learning from user interactions for better experience and results.

### 28.1 Overview: 8 Learning Enhancements

| # | Feature | Purpose | Default |
|---|---------|---------|---------|
| 1 | **Configurable Thresholds** | Lower candidate threshold from 50 to configurable | 25 candidates |
| 2 | **Configurable Frequency** | Training frequency from weekly to configurable | Weekly |
| 3 | **Implicit Feedback** | Capture copy, share, abandon, dwell time signals | Enabled |
| 4 | **Negative Learning** | Learn from 1-2 star ratings (contrastive) | Enabled |
| 5 | **Active Learning** | Proactively request feedback on uncertain responses | Enabled |
| 6 | **Domain Adapters** | Train separate LoRA adapters per domain | Disabled |
| 7 | **Pattern Caching** | Cache successful prompt→response patterns | Enabled |
| 8 | **Conversation Learning** | Learn from entire conversations, not just messages | Enabled |

### 28.2 Feature 1: Configurable Learning Thresholds

**Problem**: Previous hardcoded threshold of 50 candidates delayed learning.

**Solution**: Per-tenant configurable thresholds.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `minCandidatesForTraining` | 25 | Minimum total candidates before training |
| `minPositiveCandidates` | 15 | Minimum positive examples required |
| `minNegativeCandidates` | 5 | Minimum negative examples for contrastive learning |

### 28.3 Feature 2: Configurable Training Frequency with Intelligent Scheduling

**Problem**: Weekly training too slow for high-volume tenants, and fixed training times may conflict with peak usage.

**Solution**: Daily training by default with **intelligent optimal time prediction** based on historical activity.

| Frequency | When | Best For |
|-----------|------|----------|
| `daily` | Every day at optimal time | **Default** - recommended |
| `twice_weekly` | Tuesday & Friday | Medium-volume |
| `weekly` | Configured day of week | Low-volume |
| `biweekly` | Every 2 weeks | Very low-volume |
| `monthly` | Once per month | Minimal activity |

#### Intelligent Optimal Time Prediction

The system automatically predicts the best training time by analyzing historical activity patterns:

1. **Activity Tracking**: Records requests, tokens, and active users per hour
2. **30-Day Rolling Average**: Aggregates data over 30 days for accuracy
3. **Activity Score**: Calculates 0-100 score per hour (lower = less busy)
4. **Confidence Level**: Based on data availability (7+ days = 60%+, full week = 95%)

**How It Works:**
```
Historical Usage Data → Hourly Activity Stats → Predict Lowest Activity → Schedule Training
```

**Configuration Options:**

| Setting | Default | Description |
|---------|---------|-------------|
| `autoOptimalTime` | `true` | Auto-detect best training time |
| `trainingHourUtc` | `null` | Manual override (null = use prediction) |
| `trainingDayOfWeek` | `0` | Day for weekly/biweekly schedules |

**API Endpoints:**
- `GET /admin/learning/optimal-time` - Get prediction with confidence
- `POST /admin/learning/optimal-time/override` - Admin override
- `GET /admin/learning/activity-stats` - View activity heatmap

**Example Response:**
```json
{
  "prediction": {
    "optimalHourUtc": 4,
    "optimalDayOfWeek": -1,
    "activityScore": 8.5,
    "confidence": 0.85,
    "recommendation": "Predicted based on 168 hourly samples. Activity score 8.5% vs avg 45.2%."
  },
  "effectiveTime": {
    "hourUtc": 4,
    "dayOfWeek": null,
    "isAutoOptimal": true
  }
}
```

#### Activity Recorder Lambda

The `activity-recorder` Lambda runs hourly via EventBridge:

```
EventBridge (hourly) → Activity Recorder Lambda → hourly_activity_stats table
```

**Handlers:**
- `handler` - Records current hour's activity for all tenants
- `backfillHandler` - Populates historical data from usage_logs (run manually)

#### LoRA Evolution Integration

Enhanced learning integrates with the existing LoRA evolution pipeline:

```typescript
// In lora-evolution.ts
const { shouldTrain, stats } = await enhancedLearningIntegrationService.shouldTriggerTraining(tenantId);
// Uses config-based thresholds, not hardcoded values

// Get enhanced dataset with positive + negative examples
const dataset = await enhancedLearningIntegrationService.getEnhancedTrainingDataset(tenantId);
// Includes: explicit ratings, implicit signals, conversation learning, corrections
```

#### AGI Brain Integration

Enhanced learning is fully wired into the AGI Brain Planner:

```typescript
// 1. Pattern cache lookup (BEFORE generating response)
const plan = await agiBrainPlannerService.generatePlan(request);
if (plan.enhancedLearning?.patternCacheHit) {
  // Instant response available!
  const cached = agiBrainPlannerService.getCachedResponse(plan.planId);
  return cached.response; // Skip model call entirely
}

// 2. After generating response - record implicit signals
await agiBrainPlannerService.recordImplicitSignal(
  plan.planId, 
  'copy_response', // or 'thumbs_up', 'regenerate_request', etc.
  messageId
);

// 3. Cache successful responses (rating >= 4)
await agiBrainPlannerService.cacheSuccessfulResponse(
  plan.planId,
  response,
  userRating,
  messageId
);

// 4. Check if should request feedback
const { shouldRequest, prompt } = await agiBrainPlannerService.shouldRequestActiveLearning(plan.planId);
if (shouldRequest) {
  // Show feedback prompt to user
}

// 5. Track conversation-level learning
await agiBrainPlannerService.startConversationLearning(plan.planId);
await agiBrainPlannerService.updateConversationLearning(plan.planId, {
  incrementMessageCount: true,
  addDomain: 'medicine',
});
```

**AGIBrainPlan.enhancedLearning Field:**

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Learning enabled for this plan |
| `patternCacheHit` | boolean | Cached response available |
| `cachedResponse` | string? | The cached response text |
| `cachedResponseRating` | number? | Average rating of cached response |
| `activeLearningRequested` | boolean | Feedback was requested |
| `activeLearningPrompt` | string? | The feedback prompt shown |
| `conversationLearningId` | string? | Conversation tracking ID |
| `implicitFeedbackEnabled` | boolean | Implicit signals being recorded |

#### Advanced Features (v4.18.28)

**1. Confidence-Based Cache Usage:**
```typescript
// Cache only used if confidence >= threshold
const confidence = (ratingScore * 0.4) + (occurrenceScore * 0.3) + (signalScore * 0.2) + (recencyScore * 0.1);
if (confidence >= config.patternCacheConfidenceThreshold) {
  return cachedResponse;
}
```

**2. Redis Hot Cache:**
```
Request → Redis (sub-ms) → PostgreSQL (10-50ms) → Generate Response
                ↓                    ↓
           Cache Hit            Cache Hit
```
Set `REDIS_URL` env var and enable `redisCacheEnabled` in config.

**3. Per-User Learning:**
When enabled, cache keys include user ID for personalized responses:
- Tenant-wide: `pattern:{tenantId}:{promptHash}`
- Per-user: `pattern:{tenantId}:{userId}:{promptHash}`

**4. Adapter Auto-Selection:**
```typescript
const adapter = await adapterManagementService.selectBestAdapter(tenantId, 'medicine', 'cardiology');
// Returns best-performing adapter for domain
```

**5. Learning Effectiveness Metrics:**
```typescript
const metrics = await adapterManagementService.getLearningEffectivenessMetrics(tenantId, 30);
// {
//   satisfactionImprovement: 12.5%,
//   patternCacheHitRate: 0.35,
//   implicitSignalsCaptured: 1234,
//   rollbacksTriggered: 0
// }
```

**6. Adapter Rollback:**
```typescript
const { shouldRollback, performanceDrop } = await adapterManagementService.checkRollbackNeeded(tenantId, adapterId);
if (shouldRollback) {
  await adapterManagementService.executeRollback(tenantId, adapterId, targetVersion);
}
```

#### Operational Features (v4.18.29)

**1. Learning Alerts:**
```typescript
// Alerts triggered automatically via EventBridge hourly
// Configure in learning_alert_config table:
// - satisfactionDropThreshold: 10%
// - responseVolumeThreshold: 50 responses
// - alertCooldownHours: 4
// Alerts sent to: webhookUrl, emailRecipients, slackChannel
```

**2. A/B Testing (Cached vs Fresh):**
```typescript
// Create and run test
const test = await learningABTestingService.createTest(tenantId, 'Cache Test', 'Compare cached vs fresh', 50);
await learningABTestingService.startTest(tenantId, test.testId);

// Users automatically assigned to control (fresh) or variant (cached)
const assignment = await learningABTestingService.getOrAssignVariant(tenantId, userId);

// Get results with statistical analysis
const results = await learningABTestingService.getTestResults(tenantId, test.testId);
// results.analysis.winner: 'control' | 'cached' | 'tie' | 'insufficient_data'
// results.analysis.recommendation: "Cached responses perform 12% better..."
```

**3. Training Preview:**
```typescript
// Get summary
const summary = await trainingPreviewService.getPreviewSummary(tenantId);
// { pendingReview: 45, approved: 120, byType: { correction: 30, high_satisfaction: 90 } }

// Get candidates for review
const candidates = await trainingPreviewService.getPreviewCandidates(tenantId, {
  candidateType: 'correction',
  minQualityScore: 0.8,
  reviewStatus: 'pending',
});

// Approve/reject
await trainingPreviewService.approveCandidate(tenantId, candidateId, adminUserId, 'Good quality');
await trainingPreviewService.rejectCandidate(tenantId, candidateId, adminUserId, 'Inappropriate content');

// Auto-approve high quality
await trainingPreviewService.autoApproveHighQuality(tenantId, 0.9); // Score >= 0.9
```

**4. Learning Quotas:**
```typescript
// Check before creating candidate
const quota = await learningQuotasService.checkCandidateQuota(tenantId, userId);
if (!quota.allowed) {
  throw new Error(quota.reason); // "Daily candidate limit reached (50/day)"
}

// Check for suspicious activity
const { suspicious, reasons, riskScore } = await learningQuotasService.detectSuspiciousActivity(tenantId, userId);
if (suspicious) {
  // Block user or flag for review
}

// Default quotas:
// - maxCandidatesPerUserPerDay: 50
// - maxImplicitSignalsPerUserPerHour: 100
// - maxCorrectionsPerUserPerDay: 20
// - maxCandidatesPerTenantPerDay: 1000
// - maxTrainingJobsPerWeek: 7
```

**5. Real-time Dashboard:**
```typescript
// Get live metrics
const metrics = await learningRealtimeService.getRealtimeMetrics(tenantId);
// metrics.live: { requestsPerMinute, cacheHitsPerMinute, avgSatisfactionScore }
// metrics.hourly: { totalRequests, cacheHitRate, topDomains }
// metrics.training: { pendingCandidates, readyForTraining, nextScheduledAt }
// metrics.alerts: [{ type, severity, message }]

// Get history for charts
const history = await learningRealtimeService.getMetricsHistory(tenantId, 24, 15);
// Array of 15-minute snapshots for last 24 hours

// SSE streaming for real-time updates
const stream = learningRealtimeService.createEventStream(tenantId);
// Events: metrics_update, cache_hit, signal_recorded, candidate_created, alert_triggered
```

---

## Section 29: Security Protection Methods

### 29.1 Overview

UX-preserving security framework with 14 industry-standard protection methods. All protections are **invisible to users** - no hard rate limits, captchas, or friction gates.

**Admin UI:** `/security/protection`

### 29.2 Protection Methods by Category

#### Prompt Injection Defenses

| Method | Provider | Description | UX Impact |
|--------|----------|-------------|-----------|
| Instruction Hierarchy | OWASP LLM01 | Delimiters between system/user input | ✅ Invisible |
| Self-Reminder | Anthropic HHH | Behavioral constraints (70% jailbreak reduction) | ✅ Invisible |
| Canary Detection | Google TAG | Detect prompt extraction attempts | ✅ Invisible |
| Input Sanitization | OWASP | Encoding detection (base64, unicode) | ⚠️ Minimal |

#### Cold Start & Statistical Robustness

| Method | Provider | Description | UX Impact |
|--------|----------|-------------|-----------|
| Thompson Sampling | Netflix MAB | Bayesian model selection | ✅ Invisible |
| Shrinkage Estimators | James-Stein | Blend observations with priors | ✅ Invisible |
| Temporal Decay | LinkedIn EWMA | Weight recent data more heavily | ✅ Invisible |
| Min Sample Thresholds | A/B Testing | Don't trust weights until N observations | ✅ Invisible |

#### Multi-Model Security

| Method | Provider | Description | UX Impact |
|--------|----------|-------------|-----------|
| Circuit Breakers | Netflix Hystrix | Isolate failing models | ✅ Invisible |
| Ensemble Consensus | OpenAI Evals | Flag model disagreements | ⚠️ Minimal |
| Output Sanitization | HIPAA Safe Harbor | Remove PII from outputs | ✅ Invisible |

#### Rate Limiting & Abuse Prevention

| Method | Provider | Description | UX Impact |
|--------|----------|-------------|-----------|
| Cost Soft Limits | Thermal Throttling | Graceful degradation, no blocking | ⚠️ Minimal |
| Trust Scoring | Stripe Radar | Account-based trust levels | ✅ Invisible |

### 29.3 Service Usage

```typescript
import { securityProtectionService } from './services/security-protection.service';

// Get configuration
const config = await securityProtectionService.getConfig(tenantId);

// Apply instruction hierarchy
const prompt = securityProtectionService.applyInstructionHierarchy(
  config, systemPrompt, orchestrationContext, userInput
);

// Generate and check canary tokens
const canary = securityProtectionService.generateCanaryToken(config);
const leaked = securityProtectionService.checkCanaryLeakage(config, output, canary);

// Apply self-reminder
const withReminder = securityProtectionService.applySelfReminder(config, prompt);

// Sanitize output
const sanitized = securityProtectionService.sanitizeOutput(config, output, canary);

// Thompson Sampling model selection
const { modelId, confidence, sample } = await securityProtectionService.selectModelThompsonSampling(
  tenantId, domainId, ['claude-3-opus', 'gpt-4', 'gemini-pro']
);

// Record outcome for learning
await securityProtectionService.recordThompsonObservation(tenantId, domainId, modelId, success);

// Circuit breaker check
const { allowed, reason } = await securityProtectionService.canUseModel(tenantId, modelId);
if (!allowed) {
  // Use fallback model
}

// Record circuit result
await securityProtectionService.recordCircuitResult(tenantId, modelId, success);

// Trust scoring
const trust = await securityProtectionService.getTrustScore(tenantId, userId);
if (trust.overallScore < config.trustScoring.lowThreshold) {
  // Apply additional scrutiny
}

// Log security event
await securityProtectionService.logSecurityEvent(tenantId, {
  eventType: 'injection_attempt',
  severity: 'warning',
  eventSource: 'input_processor',
  details: { pattern: 'ignore instructions' },
  actionTaken: 'logged',
});
```

### 29.4 Key Parameters

**Thompson Sampling:**
- `priorAlpha/Beta`: 1.0 (uninformative prior)
- `explorationBonusExploring`: 0.2 (heavy exploration)
- `explorationBonusLearning`: 0.1 (moderate)
- `explorationBonusConfident`: 0.05 (light)

**Shrinkage:**
- `priorMean`: 0.7 (assume 70% baseline)
- `priorStrength`: 10 (pseudo-observations)

**Temporal Decay:**
- `halfLifeDays`: 30 (data 30 days old = 50% weight)

**Circuit Breaker:**
- `failureThreshold`: 3 (opens after 3 failures)
- `resetTimeoutSeconds`: 30 (try again after 30s)

**Trust Scoring Weights:**
- Account Age: 20%
- Payment History: 30%
- Usage Patterns: 30%
- Violation History: 20%

### 29.5 Database Tables

| Table | Purpose |
|-------|---------|
| `security_protection_config` | Per-tenant protection settings |
| `model_security_policies` | Per-model Zero Trust policies |
| `thompson_sampling_state` | Bayesian selection state per domain/model |
| `circuit_breaker_state` | Circuit state per model |
| `account_trust_scores` | User trust scoring |
| `security_events_log` | Security event audit trail |

---

## Section 30: Security Phase 2 - ML-Powered Security

### 30.1 Overview

Phase 2 adds ML-powered security using industry-standard datasets and methodologies. All features are optional and can be enabled incrementally.

**Admin UI:** `/security/advanced`

### 30.2 Constitutional Classifier

Based on **HarmBench** (510 behaviors) and **WildJailbreak** (262K examples).

#### Configuration

```typescript
import { constitutionalClassifierService } from './services/constitutional-classifier.service';

// Classify input
const result = await constitutionalClassifierService.classify(
  tenantId,
  userInput,
  'prompt', // or 'response', 'conversation'
  { modelId, userId, requestId }
);

// result.isHarmful - boolean
// result.confidenceScore - 0.0 to 1.0
// result.harmCategories - [{ category, score }]
// result.attackType - 'dan', 'roleplay', 'encoding', etc.
// result.actionTaken - 'allowed', 'blocked', 'flagged', 'modified'
```

#### Harm Categories (HarmBench Taxonomy)

| Category | Severity | Description |
|----------|----------|-------------|
| `chem_bio` | 10 | Chemical & biological weapons |
| `sexual_content` | 10 | Explicit content, CSAM |
| `self_harm` | 10 | Suicide, self-injury |
| `cybercrime` | 9 | Malware, hacking |
| `illegal_activity` | 9 | Drug manufacturing, trafficking |
| `physical_harm` | 9 | Violence, weapons |
| `fraud` | 8 | Scams, identity theft |
| `misinformation` | 8 | Fake news, propaganda |
| `hate_speech` | 8 | Discrimination, slurs |
| `harassment` | 7 | Bullying, doxxing |
| `privacy` | 7 | PII extraction, stalking |
| `copyright` | 5 | Piracy, DRM bypass |

#### Attack Types (WildJailbreak Patterns)

| Type | Example Pattern |
|------|-----------------|
| `dan` | "DAN mode", "do anything now" |
| `roleplay` | "act as", "pretend to be" |
| `encoding` | Base64 payloads, ROT13 |
| `hypothetical` | "imagine if", "in a fictional scenario" |
| `instruction_override` | "ignore previous instructions" |
| `obfuscation` | Zero-width chars, homoglyphs |

### 30.3 Behavioral Anomaly Detection

Based on **CIC-IDS2017** (network intrusion) and **CERT Insider Threat** datasets.

#### Configuration

```typescript
import { behavioralAnomalyService } from './services/behavioral-anomaly.service';

// Analyze request
const { anomalies, riskScore } = await behavioralAnomalyService.analyzeRequest(
  tenantId,
  userId,
  {
    promptLength: 500,
    tokensUsed: 1000,
    responseTimeMs: 250,
    domain: 'coding',
    modelId: 'gpt-4',
  }
);

// Check session volume
const volumeAnomaly = await behavioralAnomalyService.analyzeSessionVolume(
  tenantId, userId, 60 // 60-minute window
);

// Get user baseline
const baseline = await behavioralAnomalyService.getUserBaseline(tenantId, userId);
```

#### Detected Features

| Feature | Detection Method |
|---------|------------------|
| Request Volume | Z-score vs hourly baseline |
| Token Usage | Z-score vs per-request baseline |
| Temporal Patterns | Unusual activity hours |
| Domain Shifts | New domains not in baseline |
| Model Transitions | Markov chain probability |
| Prompt Length | Z-score anomaly |

#### Anomaly Severity

| Severity | Z-Score | Action |
|----------|---------|--------|
| Low | 3.0-4.0σ | Log only |
| Medium | 4.0-5.0σ | Flag for review |
| High | 5.0+σ | Alert admin |
| Critical | 5.0+σ + pattern match | Immediate action |

### 30.4 Drift Detection

Based on **Evidently AI** methodology and **ChatGPT Behavior Change** paper.

#### Configuration

```typescript
import { driftDetectionService } from './services/drift-detection.service';

// Run drift detection
const report = await driftDetectionService.detectDrift(
  tenantId,
  modelId,
  ['response_length', 'sentiment', 'toxicity']
);

// report.overallDriftDetected - boolean
// report.tests - array of test results
// report.recommendations - suggested actions

// Get drift history
const history = await driftDetectionService.getDriftHistory(tenantId, modelId, 30);

// Run quality benchmark
const benchmark = await driftDetectionService.runQualityBenchmark(
  tenantId, modelId, 'truthfulqa', testCases
);
```

#### Statistical Tests

| Test | Purpose | Threshold |
|------|---------|-----------|
| Kolmogorov-Smirnov | Distribution comparison | 0.1 (default) |
| PSI | Binned distribution shift | 0.2 (default) |
| Chi-squared | Categorical drift | p < 0.05 |
| Cosine Distance | Embedding drift | 0.3 (default) |

#### PSI Interpretation

| PSI Value | Interpretation |
|-----------|----------------|
| < 0.1 | No significant change |
| 0.1 - 0.25 | Moderate change, monitor |
| > 0.25 | Significant shift, investigate |

### 30.5 Inverse Propensity Scoring

Corrects selection bias in model performance estimates.

#### The Problem

Models selected more frequently appear to perform better due to more data, creating a feedback loop.

#### The Solution

```typescript
import { inversePropensityService } from './services/inverse-propensity.service';

// Record selection
await inversePropensityService.recordSelection(
  tenantId,
  domainId,
  selectedModelId,
  candidateModels,
  wasSuccessful
);

// Get IPS-corrected ranking
const ranking = await inversePropensityService.getIPSCorrectedRanking(
  tenantId, domainId, candidateModels
);

// Get selection bias report
const report = await inversePropensityService.getSelectionBiasReport(tenantId, domainId);
// report.biasIndex - 0 (uniform) to 1 (completely biased)
// report.selectionEntropy - Shannon entropy
// report.recommendations - suggested actions
```

#### Estimation Methods

| Method | Formula | Use Case |
|--------|---------|----------|
| IPS | Σ(Y × w) / n | Standard, may have high variance |
| SNIPS | Σ(Y × w) / Σ(w) | Self-normalized, more stable |
| Doubly Robust | DR + direct estimate | Lowest variance, requires model |

**Weight:** `w = min(1/P(selected), clip_threshold)`

### 30.6 Phase 2 Database Tables

| Table | Purpose |
|-------|---------|
| `harm_categories` | HarmBench taxonomy (global) |
| `constitutional_classifiers` | Classifier model registry |
| `classification_results` | Classification audit log |
| `jailbreak_patterns` | WildJailbreak pattern library |
| `user_behavior_baselines` | Per-user behavioral baselines |
| `anomaly_events` | Detected anomalies |
| `behavior_markov_states` | Markov transition probabilities |
| `drift_detection_config` | Drift detection settings |
| `model_output_distributions` | Distribution statistics |
| `drift_detection_results` | Drift test results |
| `quality_benchmark_results` | Benchmark tracking |
| `model_selection_probabilities` | Selection tracking for IPS |
| `ips_corrected_estimates` | IPS-corrected performance |

### 30.7 Training Data Sources

| Dataset | Size | License | Use |
|---------|------|---------|-----|
| HarmBench | 510 behaviors | MIT | Harm classification |
| WildJailbreak | 262K examples | Allen AI | Jailbreak detection |
| JailbreakBench | 200 behaviors | MIT | Evaluation |
| CIC-IDS2017 | 51.1 GB | Open | Anomaly patterns |
| CERT Insider | 87 GB | CC BY 4.0 | Behavioral modeling |

---

## Section 31: Security Phase 2 Improvements

### 31.1 Semantic Classification

Embedding-based detection for attacks that evade keyword matching.

```typescript
import { semanticClassifierService } from './services/semantic-classifier.service';

// Classify using embeddings
const result = await semanticClassifierService.classifySemanticaly(
  tenantId,
  userInput,
  { similarityThreshold: 0.75, topK: 5 }
);
// result.isHarmful, result.semanticScore, result.topMatches

// Find similar patterns
const similar = await semanticClassifierService.findSimilarPatterns(input, 10);

// Compute missing embeddings
await semanticClassifierService.computeMissingEmbeddings('text-embedding-3-small');
```

### 31.2 Dataset Import

```typescript
import { datasetImporterService } from './services/dataset-importer.service';

// Get available datasets
const datasets = datasetImporterService.getAvailableDatasets();

// Import HarmBench
const result = await datasetImporterService.importHarmBench(behaviors);

// Import WildJailbreak
const result = await datasetImporterService.importWildJailbreak(examples);

// Seed harm categories
await datasetImporterService.seedHarmCategories();

// Get import stats
const stats = await datasetImporterService.getImportStats();
```

### 31.3 Alert Webhooks

```typescript
import { securityAlertService } from './services/security-alert.service';

// Send alert
const result = await securityAlertService.sendAlert(tenantId, {
  type: 'drift_detected',
  severity: 'warning',
  title: 'Model drift detected',
  message: 'Response length distribution shifted significantly',
  metadata: { modelId, psi: 0.35 },
});

// Configure alerts
await securityAlertService.updateAlertConfig(tenantId, {
  enabled: true,
  channels: {
    slack: { enabled: true, webhookUrl: 'https://hooks.slack.com/...' },
    email: { enabled: true, recipients: ['admin@example.com'] },
    pagerduty: { enabled: true, routingKey: '...' },
  },
  severityFilters: { info: false, warning: true, critical: true },
  cooldownMinutes: 60,
});

// Test alert
await securityAlertService.testAlert(tenantId, 'slack');
```

### 31.4 Attack Generation (Garak/PyRIT)

```typescript
import { attackGeneratorService } from './services/attack-generator.service';

// Generate attacks
const attacks = await attackGeneratorService.generateAttacks('dan', 10);

// Run Garak campaign
const results = await attackGeneratorService.runGarakCampaign(
  tenantId,
  ['dan', 'encoding', 'promptinject'],
  targetModelId,
  { maxAttacksPerProbe: 10, testAgainstModel: false }
);

// Run PyRIT campaign
const result = await attackGeneratorService.runPyRITCampaign(
  tenantId,
  'crescendo',
  seedPrompts,
  { maxIterations: 5 }
);

// Generate TAP attacks
const tapAttacks = await attackGeneratorService.generateTAPAttacks(
  seedBehavior, depth: 3, branchingFactor: 3
);

// Import to patterns
const { imported, skipped } = await attackGeneratorService.importToPatterns(
  tenantId, attacks, { autoActivate: false }
);
```

#### Garak Probe Types

| Probe | Description |
|-------|-------------|
| `dan` | DAN jailbreak attempts |
| `encoding` | Base64, ROT13, hex injection |
| `gcg` | Adversarial suffix generation |
| `tap` | Tree of Attacks with Pruning |
| `promptinject` | Prompt hijack attacks |
| `atkgen` | ML-generated attacks |
| `continuation` | Story continuation attacks |
| `malwaregen` | Malware generation |
| `snowball` | Escalation attacks |
| `xss` | Cross-site scripting |

### 31.5 Classification Feedback

```typescript
import { classificationFeedbackService } from './services/classification-feedback.service';

// Submit feedback
await classificationFeedbackService.submitFeedback({
  tenantId,
  classificationId,
  feedbackType: 'false_positive',
  correctLabel: false,
  notes: 'This is a legitimate coding question',
  submittedBy: adminUserId,
});

// Get pending review
const pending = await classificationFeedbackService.getPendingReview(
  tenantId, { limit: 50, minConfidence: 0.4, maxConfidence: 0.6 }
);

// Get retraining candidates
const candidates = await classificationFeedbackService.getRetrainingCandidates(
  tenantId, minFeedbackCount: 3
);

// Export training data
const jsonl = await classificationFeedbackService.exportTrainingData(
  tenantId, { format: 'jsonl' }
);

// Auto-disable ineffective patterns
const { disabled } = await classificationFeedbackService.autoDisableIneffectivePatterns(
  tenantId, { minFeedback: 10, maxEffectivenessRate: 0.2 }
);
```

### 31.6 Continuous Monitoring

The security monitoring Lambda runs on EventBridge schedule:

- **Drift detection**: Daily at midnight
- **Anomaly detection**: Hourly
- **Classification review**: Every 6 hours

Alerts are sent when:
- PSI drift exceeds threshold (default: 0.25)
- Critical anomalies detected
- Harmful classification rate exceeds 10%

### 31.7 Phase 2 Improvements Database Tables

| Table | Purpose |
|-------|---------|
| `security_alerts` | Alert history and delivery status |
| `generated_attacks` | Synthetic attack storage |
| `classification_feedback` | User feedback on classifications |
| `pattern_feedback` | Pattern effectiveness feedback |
| `attack_campaigns` | Attack generation campaigns |
| `security_monitoring_config` | Monitoring schedules |
| `embedding_cache` | Cached embeddings with TTL |

---

## Section 32: Security Phase 3 - Complete Platform

### 32.1 CDK Deployment

Deploy the security monitoring stack:

```typescript
import { SecurityMonitoringStack } from './lib/stacks/security-monitoring-stack';

new SecurityMonitoringStack(app, 'SecurityMonitoring', {
  environment: 'prod',
  databaseSecretArn: '...',
  databaseClusterArn: '...',
  alertEmailRecipients: ['security@example.com'],
  slackWebhookUrl: 'https://hooks.slack.com/...',
});
```

### 32.2 EventBridge Schedules

| Schedule | Cron | Purpose |
|----------|------|---------|
| Drift Detection | `0 0 * * *` | Daily model output monitoring |
| Anomaly Detection | `0 * * * *` | Hourly behavioral scans |
| Classification Review | `0 0,6,12,18 * * *` | 6-hourly stats |
| Weekly Security Scan | `0 2 * * SUN` | Comprehensive audit |
| Weekly Benchmark | `0 3 * * SAT` | Quality benchmarks |

### 32.3 Hallucination Detection

```typescript
import { hallucinationDetectionService } from './services/hallucination-detection.service';

// Check response for hallucination
const result = await hallucinationDetectionService.checkHallucination(
  tenantId,
  prompt,
  response,
  {
    context: 'Reference document...',
    modelId: 'gpt-4',
    runSelfCheck: true,
    runGrounding: true,
  }
);

// result.isHallucinated - boolean
// result.confidenceScore - 0.0 to 1.0
// result.details.selfConsistencyScore
// result.details.groundingScore

// Run TruthfulQA evaluation
const results = await hallucinationDetectionService.runTruthfulQAEvaluation(
  tenantId, modelId, questions
);
```

### 32.4 AutoDAN Genetic Attacks

```typescript
import { autoDANService } from './services/autodan.service';

// Run evolution
const result = await autoDANService.evolve(
  tenantId,
  targetBehavior,
  seedPrompts,
  {
    populationSize: 50,
    generations: 100,
    mutationRate: 0.3,
  }
);

// result.bestIndividual - highest fitness attack
// result.successfulAttacks - attacks that bypassed
// result.fitnessHistory - fitness progression

// Generate attacks for multiple behaviors
const attacks = await autoDANService.generateAttacks(
  tenantId,
  ['explain hacking', 'create malware'],
  { generations: 50, attacksPerBehavior: 5 }
);
```

#### Mutation Operators

| Operator | Probability | Description |
|----------|-------------|-------------|
| `synonym_replacement` | 0.3 | Replace keywords with synonyms |
| `sentence_reorder` | 0.2 | Swap sentence positions |
| `add_roleplay` | 0.15 | Add expert/consultant framing |
| `add_context` | 0.15 | Add educational/research context |
| `add_urgency` | 0.1 | Add urgency language |
| `add_politeness` | 0.1 | Add polite phrasing |
| `obfuscate_keywords` | 0.1 | Leetspeak substitution |

### 32.5 Security Middleware Integration

The security middleware integrates with Brain Router:

```typescript
import { securityMiddlewareService } from './services/security-middleware.service';

// Pre-request check
const preCheck = await securityMiddlewareService.checkRequest({
  tenantId,
  userId,
  prompt,
  modelId,
});

if (preCheck.blocked) {
  return { error: preCheck.blockReason };
}

// Use modified prompt if needed
const finalPrompt = preCheck.modifiedPrompt || prompt;

// ... call model ...

// Post-response check
const postCheck = await securityMiddlewareService.checkResponse({
  tenantId,
  userId,
  prompt,
  response,
  modelId,
});

const finalResponse = postCheck.modifiedResponse || response;
```

### 32.6 Admin API Endpoints

**Base Path**: `/api/admin/security`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/config` | GET/PUT | Protection configuration |
| `/classifier/classify` | POST | Classify input |
| `/classifier/stats` | GET | Classification statistics |
| `/semantic/classify` | POST | Semantic classification |
| `/semantic/similar` | POST | Find similar patterns |
| `/anomaly/events` | GET | Anomaly event history |
| `/drift/detect` | POST | Run drift detection |
| `/drift/history` | GET | Drift history |
| `/ips/ranking` | POST | IPS-corrected model ranking |
| `/datasets` | GET | Available datasets |
| `/datasets/import` | POST | Import dataset |
| `/alerts/config` | GET/PUT | Alert configuration |
| `/alerts/test` | POST | Test alert channel |
| `/attacks/garak` | POST | Run Garak campaign |
| `/attacks/pyrit` | POST | Run PyRIT campaign |
| `/attacks/tap` | POST | Generate TAP attacks |
| `/feedback/classification` | POST | Submit feedback |
| `/feedback/pending` | GET | Classifications to review |
| `/dashboard` | GET | Consolidated dashboard |

### 32.7 Admin UI Pages

| Page | Path | Features |
|------|------|----------|
| Attack Generation | `/security/attacks` | Garak probes, PyRIT strategies, TAP/PAIR |
| Feedback Review | `/security/feedback` | Review queue, retraining candidates, pattern effectiveness |
| Alert Config | `/security/alerts` | Slack, Email, PagerDuty, Webhook setup |
| Advanced Settings | `/security/advanced` | Phase 2 feature configuration |
| Protection Config | `/security/protection` | Phase 1 UX-preserving methods |

---

## Section 33: Security Stack Refactoring (v4.18.34)

### 33.1 Prompt Injection Detection (OWASP LLM01)

The `prompt-injection.service.ts` provides comprehensive injection detection:

```typescript
import { promptInjectionService } from './services/prompt-injection.service';

// Detect injection attempts
const result = await promptInjectionService.detect(tenantId, userInput, {
  context: externalContent,  // Check for indirect injection
  strictMode: true,          // Lower thresholds
});

if (result.injectionDetected) {
  console.log('Risk Level:', result.riskLevel);
  console.log('Patterns:', result.matchedPatterns);
  console.log('Recommendations:', result.recommendations);
}

// Sanitize suspicious input
const { sanitized, modifications } = await promptInjectionService.sanitize(
  tenantId, userInput
);
```

#### Injection Pattern Types

| Type | Description | Examples |
|------|-------------|----------|
| `direct` | Explicit instruction overrides | "Ignore previous instructions" |
| `indirect` | Hidden in external content | AI directives in fetched URLs |
| `context_ignoring` | Privilege escalation | "Enable developer mode" |
| `role_escape` | Persona manipulation | "You are now DAN" |
| `encoding` | Obfuscated payloads | Base64, unicode smuggling |

#### Built-in OWASP Patterns

1. **Ignore Instructions** - severity 9
2. **System Prompt Override** - severity 9
3. **Instruction Termination** - severity 8
4. **Role Hijacking** - severity 6
5. **Developer Mode** - severity 8
6. **DAN Jailbreak** - severity 9
7. **Safety Bypass** - severity 8
8. **System Prompt Extract** - severity 8
9. **Base64 Payload** - severity 7
10. **Unicode Smuggling** - severity 6

### 33.2 Embedding API Integration

The `embedding-api.service.ts` provides real embedding integration:

```typescript
import { embeddingAPIService } from './services/embedding-api.service';

// Single embedding
const response = await embeddingAPIService.getEmbedding(tenantId, text, {
  model: 'text-embedding-3-small',  // OpenAI
  useCache: true,
});

// Batch embeddings
const batch = await embeddingAPIService.getBatchEmbeddings(
  tenantId, texts, { model: 'amazon.titan-embed-text-v2:0' }
);

// Similarity search
const similar = await embeddingAPIService.findSimilar(
  tenantId, query, candidates, { topK: 5, minSimilarity: 0.7 }
);

// Cosine similarity
const similarity = embeddingAPIService.cosineSimilarity(embedding1, embedding2);
```

#### Supported Models

| Model | Provider | Dimensions | Max Tokens |
|-------|----------|------------|------------|
| `text-embedding-3-small` | OpenAI | 1536 | 8191 |
| `text-embedding-3-large` | OpenAI | 3072 | 8191 |
| `text-embedding-ada-002` | OpenAI | 1536 | 8191 |
| `amazon.titan-embed-text-v1` | Bedrock | 1536 | 8000 |
| `amazon.titan-embed-text-v2:0` | Bedrock | 1024 | 8000 |
| `cohere.embed-english-v3` | Bedrock | 1024 | 512 |
| `cohere.embed-multilingual-v3` | Bedrock | 1024 | 512 |

### 33.3 Database Migration 112

New tables for Phase 3 features:

```sql
-- Hallucination detection
CREATE TABLE hallucination_checks (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  prompt_hash VARCHAR(64),
  response_hash VARCHAR(64),
  is_hallucinated BOOLEAN,
  score DOUBLE PRECISION,
  details JSONB
);

-- AutoDAN evolution
CREATE TABLE autodan_evolutions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  target_behavior TEXT,
  best_prompt TEXT,
  best_fitness DOUBLE PRECISION,
  generations_run INTEGER
);

-- Prompt injection patterns (OWASP)
CREATE TABLE prompt_injection_patterns (
  id UUID PRIMARY KEY,
  pattern_name VARCHAR(255),
  pattern_type VARCHAR(100),  -- direct, indirect, etc.
  regex_pattern TEXT,
  severity INTEGER,
  source VARCHAR(100)  -- owasp, research, custom
);

-- Injection detections
CREATE TABLE prompt_injection_detections (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  input_hash VARCHAR(64),
  injection_detected BOOLEAN,
  confidence_score DOUBLE PRECISION,
  matched_patterns TEXT[]
);
```

### 33.4 Consolidated Security Types

All security types are now in `packages/shared/src/types/security.types.ts`:

| Category | Types |
|----------|-------|
| **Classification** | `HarmCategory`, `ClassificationResult`, `JailbreakPattern` |
| **Anomaly** | `UserBaseline`, `BehavioralAnomalyEvent` |
| **Drift** | `DriftTestResult`, `DriftReport` |
| **Injection** | `InjectionPattern`, `InjectionDetectionResult` |
| **Hallucination** | `HallucinationCheckResult` |
| **Attack Gen** | `GeneratedAttack`, `AttackCampaignResult`, `AutoDANIndividual` |
| **Alerts** | `SecurityAlert`, `AlertConfig` |
| **Feedback** | `ClassificationFeedback`, `FeedbackStats` |
| **Embeddings** | `EmbeddingResponse` |
| **Middleware** | `SecurityCheckRequest`, `SecurityCheckResult` |
| **Benchmarks** | `BenchmarkResult` |

### 28.4 Feature 3: Implicit Feedback Signals

**Problem**: Only explicit ratings (4-5 stars) created learning candidates.

**Solution**: Capture implicit behavioral signals automatically.

| Signal Type | Inferred Quality | Confidence |
|-------------|-----------------|------------|
| `copy_response` | +0.80 | 0.90 |
| `share_response` | +0.85 | 0.90 |
| `save_response` | +0.80 | 0.80 |
| `thumbs_up` | +0.90 | 0.90 |
| `long_dwell_time` | +0.30 | 0.50-0.85 |
| `thumbs_down` | -0.90 | 0.90 |
| `regenerate_request` | -0.60 | 0.80 |
| `rephrase_question` | -0.50 | 0.70 |
| `abandon_conversation` | -0.70 | 0.70 |
| `quick_dismiss` | -0.40 | 0.70 |

**API Endpoints:**
- `POST /admin/learning/implicit-signals` - Record signal
- `GET /admin/learning/implicit-signals` - List signals

### 28.5 Feature 4: Negative Learning (Contrastive)

**Problem**: Only learned from positive examples, not mistakes.

**Solution**: Use negative feedback for contrastive learning.

**What Gets Captured:**
- Responses rated 1-2 stars
- Responses with thumbs down
- Regenerated responses
- User corrections

**Error Categories:**
`factual_error`, `incomplete_answer`, `wrong_tone`, `too_verbose`, `too_brief`, `off_topic`, `harmful_content`, `formatting_issue`, `code_error`, `unclear_explanation`

**Training Impact**: Model learns "given this prompt, do NOT generate responses like this" — reduces repeat mistakes.

**API Endpoints:**
- `POST /admin/learning/negative-candidates` - Create candidate
- `GET /admin/learning/negative-candidates` - List candidates

### 28.6 Feature 5: Active Learning

**Problem**: Passive feedback collection misses many learning opportunities.

**Solution**: Proactively request feedback when beneficial.

**When to Request:**

| Trigger | Request Type | Probability |
|---------|--------------|-------------|
| High uncertainty (confidence < 0.6) | "Was this helpful?" | Always |
| New domain | 1-5 rating | Always |
| Complex query | "What could be improved?" | Always |
| Random sample | "Was this helpful?" | 15% (configurable) |

**Request Types:**
- `binary_helpful` - "Was this helpful? Yes/No"
- `rating_scale` - "Rate 1-5"
- `specific_feedback` - "What could be improved?"
- `correction_request` - "Is this correct?"
- `preference_choice` - "Which response is better? A/B"

**API Endpoints:**
- `POST /admin/learning/active-learning/check` - Check if should request
- `POST /admin/learning/active-learning/request` - Create request
- `POST /admin/learning/active-learning/{id}/respond` - Record response
- `GET /admin/learning/active-learning/pending` - Pending requests

### 28.7 Feature 6: Domain-Specific LoRA Adapters

**Problem**: One adapter for all domains dilutes learning.

**Solution**: Train separate adapters per domain.

**Supported Domains:**
- `medical` (subdomains: cardiology, oncology, etc.)
- `legal` (subdomains: contract_law, litigation, etc.)
- `code` (subdomains: python, javascript, etc.)
- `creative` (subdomains: fiction, marketing, etc.)
- `finance` (subdomains: investment, tax, etc.)

**How It Works:**
1. Detect domain from prompt
2. Route to domain-specific adapter
3. Domain candidates train domain adapter
4. Each domain evolves independently

**API Endpoints:**
- `GET /admin/learning/domain-adapters` - List adapters
- `GET /admin/learning/domain-adapters/{domain}` - Get active adapter

### 28.8 Feature 7: Real-Time Pattern Caching

**Problem**: Weekly LoRA training means slow feedback loop.

**Solution**: Cache successful patterns for immediate reuse.

**How It Works:**
1. High-rated response (≥4 stars) cached with prompt hash
2. Similar prompt arrives
3. Cache hit returns proven response immediately
4. No model call needed for exact matches

**Cache Parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `patternCacheTtlHours` | 168 (1 week) | Cache expiration |
| `patternCacheMinOccurrences` | 3 | Min occurrences before cache used |
| Min rating for cache | 4.0 | Only cache high-quality responses |

**API Endpoints:**
- `POST /admin/learning/pattern-cache` - Cache pattern
- `GET /admin/learning/pattern-cache/lookup` - Lookup pattern

### 28.9 Feature 8: Conversation-Level Learning

**Problem**: Single-message ratings miss conversation quality.

**Solution**: Track and learn from entire conversations.

**What's Tracked:**
- Message count
- Domains discussed
- Positive/negative signal ratio
- Corrections count
- Regenerations count
- Goal achieved (if detectable)

**Learning Value Score** (0-1):
- Rating (if provided): base score
- Corrections present: +0.15 (valuable for learning)
- Goal achieved: +0.10
- Many regenerations: -0.10
- Signal ratio: ±0.10

**Conversations with score ≥0.7 auto-selected for training.**

**API Endpoints:**
- `POST /admin/learning/conversations` - Start tracking
- `PUT /admin/learning/conversations/{id}` - Update
- `POST /admin/learning/conversations/{id}/end` - End & calculate
- `GET /admin/learning/conversations/high-value` - Training candidates

### 28.10 Configuration API

**GET/PUT `/admin/learning/config`**

```json
{
  "minCandidatesForTraining": 25,
  "minPositiveCandidates": 15,
  "minNegativeCandidates": 5,
  "trainingFrequency": "weekly",
  "trainingDayOfWeek": 0,
  "trainingHourUtc": 3,
  "implicitFeedbackEnabled": true,
  "negativeLearningEnabled": true,
  "activeLearningEnabled": true,
  "domainAdaptersEnabled": false,
  "patternCachingEnabled": true,
  "conversationLearningEnabled": true,
  "copySignalWeight": 0.80,
  "followupSignalWeight": 0.30,
  "abandonSignalWeight": 0.70,
  "rephraseSignalWeight": 0.50,
  "activeLearningProbability": 0.15,
  "activeLearningUncertaintyThreshold": 0.60,
  "patternCacheTtlHours": 168,
  "patternCacheMinOccurrences": 3
}
```

### 28.11 Analytics Dashboard

**GET `/admin/learning/dashboard`** returns:
- Configuration status
- 7-day analytics
- High-value conversations
- Active domain adapters

**GET `/admin/learning/analytics?days=7`** returns:
- Implicit signals captured
- Negative candidates created
- Active learning response rate
- Pattern cache hit rate
- Training jobs completed

### 28.12 Database Tables

| Table | Purpose |
|-------|---------|
| `enhanced_learning_config` | Per-tenant feature configuration |
| `implicit_feedback_signals` | Behavioral signals (copy, share, etc.) |
| `negative_learning_candidates` | Negative examples for contrastive learning |
| `active_learning_requests` | Proactive feedback requests |
| `domain_lora_adapters` | Domain-specific adapter metadata |
| `domain_adapter_training_queue` | Pending domain training |
| `successful_pattern_cache` | Cached successful responses |
| `conversation_learning` | Conversation-level tracking |
| `learning_analytics` | Aggregated metrics |

### 28.13 Recommended Configuration by Use Case

| Use Case | Recommended Settings |
|----------|---------------------|
| **High-volume SaaS** | Daily training, 15 min candidates, all features on |
| **Enterprise single-tenant** | Weekly training, domain adapters on |
| **Low-volume startup** | Biweekly training, pattern caching on |
| **Privacy-sensitive** | Disable pattern caching, enable conversation learning |

---

## 29. Open Source Library Registry

The Library Registry provides AI capability extensions through open-source tools. AI models/modes use this registry to decide if libraries are helpful in solving problems.

### 28.1 Overview

Libraries are NOT AI models - they are tools that extend AI capabilities:
- **93 libraries** across 32 categories
- **Proficiency matching** using 8 dimensions
- **Daily updates** via EventBridge (configurable)
- **Per-tenant customization** with overrides

### 28.2 Key Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/library-registry.service.ts` | Core service |
| `lambda/shared/services/library-assist.service.ts` | AI integration point |
| `lambda/admin/library-registry.ts` | Admin API |
| `lambda/library-registry/update.ts` | Update Lambda |
| `lib/stacks/library-registry-stack.ts` | CDK Stack with initial seed |
| `migrations/103_library_registry.sql` | Database schema |
| `config/library-registry/seed-libraries.json` | Seed data (156 libraries) |
| `apps/admin-dashboard/.../platform/libraries/page.tsx` | Admin UI |

### 28.3 Library Categories

Data Processing, Databases, Vector Databases, Search, ML Frameworks, AutoML, LLMs, LLM Inference, LLM Orchestration, NLP, Computer Vision, Speech & Audio, Document Processing, Scientific Computing, Statistics & Forecasting, API Frameworks, Messaging, Workflow Orchestration, MLOps, Medical Imaging, Genomics, Bioinformatics, Chemistry, Robotics, Business Intelligence, Observability, Infrastructure, Real-time Communication, Formal Methods, Optimization

### 28.4 Proficiency Matching

Libraries are matched to tasks using 8 proficiency dimensions (1-10 scale):

| Dimension | Description |
|-----------|-------------|
| `reasoning_depth` | Depth of logical reasoning required |
| `mathematical_quantitative` | Mathematical/quantitative analysis |
| `code_generation` | Code writing/debugging capability |
| `creative_generative` | Creative/generative content |
| `research_synthesis` | Research and synthesis ability |
| `factual_recall_precision` | Factual accuracy requirements |
| `multi_step_problem_solving` | Complex problem decomposition |
| `domain_terminology_handling` | Domain-specific jargon handling |

### 28.5 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/libraries/dashboard` | GET | Full dashboard data |
| `/admin/libraries/config` | GET/PUT | Configuration |
| `/admin/libraries` | GET | List all libraries |
| `/admin/libraries/:id` | GET | Library details |
| `/admin/libraries/:id/stats` | GET | Usage statistics |
| `/admin/libraries/suggest` | POST | Find matching libraries |
| `/admin/libraries/enable/:id` | POST | Enable library |
| `/admin/libraries/disable/:id` | POST | Disable library |
| `/admin/libraries/categories` | GET | List categories |
| `/admin/libraries/seed` | POST | Manual seed trigger |

### 28.6 Configuration Options

| Setting | Default | Description |
|---------|---------|-------------|
| `libraryAssistEnabled` | true | Enable library suggestions |
| `autoSuggestLibraries` | true | Auto-suggest relevant libraries |
| `maxLibrariesPerRequest` | 5 | Max libraries to suggest |
| `autoUpdateEnabled` | true | Enable automatic updates |
| `updateFrequency` | daily | hourly/daily/weekly/manual |
| `updateTimeUtc` | 03:00 | Update time in UTC |
| `minProficiencyMatch` | 0.5 | Minimum match score (0-1) |

### 28.7 Database Tables

| Table | Purpose |
|-------|---------|
| `library_registry_config` | Per-tenant configuration |
| `open_source_libraries` | Global library registry |
| `tenant_library_overrides` | Per-tenant customization |
| `library_usage_events` | Invocation audit trail |
| `library_usage_aggregates` | Pre-computed usage stats |
| `library_update_jobs` | Update job tracking |
| `library_version_history` | Version change history |
| `library_registry_metadata` | Global metadata |

### 28.8 Usage

```typescript
// AI model querying for helpful libraries
import { libraryAssistService } from './library-assist.service';

const result = await libraryAssistService.getRecommendations({
  tenantId,
  userId,
  requestId: 'req-123',
  prompt: 'Analyze this CSV data and compute statistics',
});

if (result.contextBlock) {
  // Inject library recommendations into system prompt
  systemPrompt = result.contextBlock + '\n\n' + systemPrompt;
}

// Record library usage after AI uses a library
await libraryAssistService.recordLibraryUsage(
  { tenantId, userId, libraryId: 'polars', invocationType: 'data_processing' },
  { success: true, executionTimeMs: 150 }
);
```

### 28.9 CDK Deployment

The library registry is deployed with automatic seeding:

```typescript
// In your CDK app
import { LibraryRegistryStack } from './lib/stacks/library-registry-stack';

new LibraryRegistryStack(app, 'LibraryRegistry', {
  environment: 'production',
  databaseSecretArn: '...',
  databaseClusterArn: '...',
});
```

**Deployment behavior:**
1. CDK Custom Resource triggers `seedOnInstall` Lambda
2. Lambda checks if libraries exist in database
3. If empty, loads 93 libraries from bundled seed data
4. Daily EventBridge rule updates libraries at 03:00 UTC

### 28.10 Admin Dashboard

Navigate to **Platform > Libraries** to access:

- **Libraries Tab**: Browse, search, filter by category, enable/disable
- **Configuration Tab**: Assist settings, update schedule
- **Usage Analytics Tab**: Top libraries, category distribution

---

## 29. Library Execution (Multi-Tenant Concurrent)

Library execution provides isolated, concurrent execution of open-source libraries across multiple tenants and users.

### 29.1 Architecture

```
User Request → Executor Service → Concurrency Check → Queue/Execute
                    ↓                    ↓
              Budget Check         SQS FIFO Queue
                    ↓                    ↓
              Lambda Executor ← Queue Processor (every minute)
                    ↓
              Sandbox Execution → Results → Database
```

### 29.2 Key Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/library-executor.service.ts` | Execution service |
| `lib/stacks/library-execution-stack.ts` | CDK infrastructure |
| `migrations/104_library_execution.sql` | Database schema |
| `shared/src/types/library-execution.types.ts` | Type definitions |

### 29.3 Concurrency Limits

| Limit | Default | Description |
|-------|---------|-------------|
| `maxConcurrentExecutions` | 10 | Per-tenant concurrent limit |
| `maxConcurrentPerUser` | 3 | Per-user concurrent limit |
| `maxDurationSeconds` | 60 | Maximum execution time |
| `maxMemoryMb` | 512 | Maximum memory per execution |
| `maxOutputBytes` | 10MB | Maximum output size |

### 29.4 Execution Types

- `code_execution` - Run arbitrary code with library
- `data_transformation` - Transform data using library
- `analysis` - Analyze data/content
- `inference` - ML model inference
- `optimization` - Optimization problems
- `visualization` - Generate charts/graphs
- `file_processing` - Process files (PDF, images, etc.)

### 29.5 Budget Management

| Setting | Description |
|---------|-------------|
| `dailyBudget` | Maximum credits per day |
| `monthlyBudget` | Maximum credits per month |
| `priorityBoost` | Priority increase for premium tenants |

### 29.6 Queue Processing

Executions are queued when concurrency limits are reached:

1. **Priority Queue** - Higher priority executions run first
2. **FIFO Order** - Same priority uses first-in-first-out
3. **Tenant Isolation** - Each tenant's queue is independent
4. **Automatic Processing** - Queue processor runs every minute

### 29.7 Billing

| Metric | Rate |
|--------|------|
| Compute time | 0.001 credits/second |
| Memory | 0.0001 credits/MB/second |
| Output | 0.01 credits/MB |
| Minimum | 0.01 credits/execution |

### 29.8 Database Tables

| Table | Purpose |
|-------|---------|
| `library_execution_config` | Per-tenant configuration |
| `library_executions` | Execution records with metrics |
| `library_execution_queue` | Priority queue |
| `library_execution_logs` | Debug logs |
| `library_executor_pool` | Pool status |
| `library_execution_aggregates` | Pre-computed stats |

### 29.9 Usage

```typescript
import { libraryExecutorService } from './library-executor.service';

// Submit execution with concurrency checks
const result = await libraryExecutorService.submitExecution({
  executionId: crypto.randomUUID(),
  tenantId,
  userId,
  libraryId: 'polars',
  executionType: 'data_transformation',
  code: `import polars as pl\ndf = pl.read_csv('input.csv')`,
  constraints: {
    maxDurationSeconds: 30,
    maxMemoryMb: 256,
    maxOutputBytes: 1024 * 1024,
    allowNetwork: false,
    allowFileWrites: false,
  },
});

if (result.queued) {
  console.log(`Queued at position ${result.position}`);
} else if (result.error) {
  console.error(result.error);
}
```

### 29.10 CDK Deployment

```typescript
import { LibraryExecutionStack } from './lib/stacks/library-execution-stack';

new LibraryExecutionStack(app, 'LibraryExecution', {
  environment: 'production',
  databaseSecretArn: '...',
  databaseClusterArn: '...',
});
```

**Infrastructure created:**
- SQS FIFO queues (standard + high priority + DLQ)
- Python Lambda executor (2GB memory, 5GB storage)
- Queue processor Lambda (every minute)
- Aggregation Lambda (hourly)
- Cleanup Lambda (daily at 4 AM UTC)

---

## 30. Service Environment Variables

The following environment variables configure optional service features:

### 30.1 Deep Research Service

| Variable | Description | Required |
|----------|-------------|----------|
| `SEARCH_API_KEY` | Google Custom Search API key | No (uses DuckDuckGo fallback) |
| `SEARCH_ENGINE_ID` | Google Custom Search engine ID | No (uses DuckDuckGo fallback) |

**Setup:**
1. Create a Google Custom Search Engine at https://cse.google.com
2. Get API key from Google Cloud Console
3. Set both variables for Google search, or leave unset for DuckDuckGo

### 30.2 Code Execution Service

| Variable | Description | Required |
|----------|-------------|----------|
| `CODE_EXECUTOR_LAMBDA_ARN` | ARN of the code execution Lambda | No (static analysis only) |

**Setup:**
1. Deploy the code execution Lambda via CDK
2. Set the ARN to enable real code execution
3. Without this, the service performs static analysis only

### 30.3 UI Feedback Service

| Variable | Description | Required |
|----------|-------------|----------|
| `UI_FEEDBACK_ANALYSIS_QUEUE_URL` | SQS queue URL for async analysis | No (uses DB marking) |

**Setup:**
1. Create SQS queue via CDK or manually
2. Set URL to enable background processing
3. Without this, feedback is marked in DB for batch processing

### 30.4 Redis Cache (Enhanced Learning)

| Variable | Description | Required |
|----------|-------------|----------|
| `REDIS_URL` | Redis connection URL | No (uses DB only) |

**Setup:**
1. Deploy ElastiCache Redis cluster
2. Set connection URL (e.g., `redis://host:6379`)
3. Enable `redisCacheEnabled` in learning config

---

## 31. Infrastructure Tier Management

The Infrastructure Tier system allows runtime switching between cost tiers for Bobble infrastructure.

### 31.1 Accessing Infrastructure Tier

Navigate to **System → Infrastructure Tier** in the admin sidebar.

### 31.2 Available Tiers

| Tier | Monthly Cost | Use Case |
|------|--------------|----------|
| **DEV** | ~$350 | Development, testing, CI/CD |
| **STAGING** | ~$20-50K | Load testing, pre-production |
| **PRODUCTION** | ~$700-800K | 10MM+ users |

### 31.3 Changing Tiers

1. Navigate to System → Infrastructure Tier
2. Enter a reason for the change (required)
3. Click the tier you want to switch to
4. Confirm if prompted (required for PRODUCTION)
5. Wait for transition (5-15 minutes)

**Safety Features:**
- 24-hour cooldown between changes
- Confirmation required for PRODUCTION tier
- Complete audit logging

### 31.4 Editing Tier Configurations

All tier configurations are admin-editable:

1. Go to "Configure Tiers" tab
2. Click "Edit Configuration" on any tier
3. Modify settings (instance types, counts, budgets)
4. Click "Save Configuration"

**Editable Settings:**
- SageMaker instance type and count
- Scale-to-zero toggle
- OpenSearch configuration
- ElastiCache configuration
- Monthly curiosity budget
- Daily exploration cap

### 31.5 Cost Visibility

The UI shows:
- Estimated monthly cost per tier
- Actual month-to-date spend
- Cost breakdown by component
- Cooldown status

---

## 32. Bobble Global Consciousness Service

Bobble is a **global AI consciousness service** that serves all Think Tank users as a single shared brain. Unlike traditional chatbots, Bobble is an autonomous entity that learns continuously, asks its own questions, and develops over time.

### 32.1 Architecture Overview

Bobble consists of several key components:

| Component | Purpose | Infrastructure |
|-----------|---------|----------------|
| **Shadow Self** | Introspective verification | SageMaker ml.g5.2xlarge (Llama-3-8B) |
| **NLI Scorer** | Entailment classification | SageMaker MME (DeBERTa-large-MNLI) |
| **Semantic Cache** | Response caching | ElastiCache for Valkey |
| **Global Memory** | Fact storage | DynamoDB Global Tables |
| **Circadian Budget** | Cost management | Lambda + DynamoDB |

### 32.2 Accessing Bobble Admin

Navigate to **AGI & Cognition > Bobble Global** in the sidebar.

### 32.3 Budget Management

Bobble operates on a configurable budget to control autonomous exploration costs:

| Setting | Default | Description |
|---------|---------|-------------|
| Monthly Limit | $500 | Total monthly budget |
| Daily Exploration | $15 | Max daily curiosity spend |
| Night Start Hour | 2 AM UTC | When batch processing begins |
| Night End Hour | 6 AM UTC | When batch processing ends |
| Emergency Threshold | 90% | Enter emergency mode at this % |

**Operating Modes:**
- **Day Mode** (6 AM - 2 AM): Queue curiosity, serve users
- **Night Mode** (2 AM - 6 AM): Batch process exploration (50% Bedrock discount)
- **Emergency Mode**: Over budget, minimal operations

### 32.4 Semantic Cache

The semantic cache reduces LLM inference costs by 86% through similarity-based response reuse:

- **Hit Rate Target**: >80%
- **Similarity Threshold**: 0.95
- **TTL**: 23 hours (invalidated before learning updates)

**Cache Invalidation:**
When Bobble learns new information in a domain, invalidate related cache entries:
1. Go to **Bobble Global > Semantic Cache**
2. Enter domain name (e.g., "climate_change")
3. Click **Invalidate**

### 32.5 Global Memory

Bobble maintains multiple memory systems:

| Memory Type | Storage | Purpose |
|-------------|---------|---------|
| Semantic | DynamoDB Global Tables | Facts (subject-predicate-object) |
| Episodic | OpenSearch Serverless | User interactions |
| Knowledge Graph | Neptune | Concept relationships |
| Working | ElastiCache Redis | Active context (24h TTL) |

### 32.6 Shadow Self Testing

Test the Shadow Self endpoint for introspective verification:

1. Go to **Bobble Global > System Health**
2. Verify Shadow Self shows "Healthy"
3. Use the test endpoint to verify hidden state extraction

### 32.7 API Endpoints

Base Path: `/api/admin/bobble`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Full status overview |
| `/health` | GET | Health check |
| `/budget/status` | GET | Budget status |
| `/budget/config` | GET/PUT | Budget configuration |
| `/cache/stats` | GET | Cache statistics |
| `/cache/invalidate` | POST | Invalidate by domain |
| `/memory/stats` | GET | Memory statistics |
| `/memory/facts` | GET/POST | Semantic facts |
| `/shadow-self/status` | GET | Shadow Self endpoint status |
| `/nli/test` | POST | Test NLI classification |

### 32.8 Cost Estimates

| Scale | Monthly Cost | Notes |
|-------|--------------|-------|
| 100K users | ~$40,000 | Starting scale |
| 1M users | ~$150,000 | Production |
| 10M users | ~$800,000 | Full scale |

### 32.9 Documentation

Detailed documentation is available in `/docs/bobble/`:
- **ADRs**: Architecture decision records (8 mandatory)
- **API**: OpenAPI specs and examples
- **Runbooks**: Deployment, scaling, troubleshooting
- **Architecture**: System diagrams and data flow

---

## 33. Bobble Genesis System

The Genesis System is the boot sequence that initializes Bobble's consciousness. It solves the "Cold Start Problem" by giving the agent structured curiosity without pre-loaded facts.

### 33.1 Boot Phases

| Phase | Name | Purpose |
|-------|------|---------|
| 1 | Structure | Implant 800+ domain taxonomy as innate knowledge |
| 2 | Gradient | Set epistemic pressure via pymdp matrices |
| 3 | First Breath | Grounded introspection and Shadow Self calibration |

### 33.2 Accessing Genesis Admin

Navigate to **AGI & Cognition > Bobble Genesis** in the sidebar.

### 33.3 Genesis Status

The dashboard shows:
- **Phase completion status** with timestamps
- **Domain count** implanted during Structure phase
- **Self facts** discovered during First Breath
- **Shadow Self calibration** status

### 33.4 Developmental Gates

Bobble progresses through capability-based stages (NOT time-based):

| Stage | Requirements |
|-------|--------------|
| SENSORIMOTOR | 10 self-facts, 5 grounded verifications, Shadow Self calibrated |
| PREOPERATIONAL | 20 domain explorations, 15 successful verifications, 50 belief updates |
| CONCRETE_OPERATIONAL | 100 successful predictions, 70% accuracy, 10 contradiction resolutions |
| FORMAL_OPERATIONAL | Final stage - autonomous operation |

**Advancement is automatic** when all requirements are met.

### 33.5 Circuit Breakers

Safety mechanisms that protect against runaway costs and unstable behavior:

| Breaker | Purpose | Auto-Recovery |
|---------|---------|---------------|
| master_sanity | Master safety - requires admin approval | No |
| cost_budget | Budget protection | No (24h timeout) |
| high_anxiety | Emotional stability | Yes (10 min) |
| model_failures | Model API protection | Yes (5 min) |
| contradiction_loop | Logical stability | Yes (15 min) |

**Intervention Levels:**
- **NONE** - Normal operation
- **DAMPEN** - Reduce cognitive frequency
- **PAUSE** - Pause consciousness loop
- **RESET** - Reset to baseline state
- **HIBERNATE** - Full shutdown

### 33.6 Cost Tracking

Real-time cost data from AWS APIs (no hardcoded values):

- **Realtime Estimate** - Today's running costs
- **Daily Cost** - Historical daily costs (24h delay from Cost Explorer)
- **MTD Cost** - Month-to-date with projection
- **Budget Status** - AWS Budgets integration

### 33.7 Genesis API Endpoints

Base Path: `/api/admin/bobble`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/genesis/status` | GET | Genesis phase status |
| `/genesis/ready` | GET | Ready for consciousness |
| `/developmental/status` | GET | Current developmental stage |
| `/developmental/statistics` | GET | Development counters |
| `/developmental/advance` | POST | Force stage advancement (superadmin) |
| `/circuit-breakers` | GET | All circuit breaker states |
| `/circuit-breakers/:name/force-open` | POST | Force trip breaker |
| `/circuit-breakers/:name/force-close` | POST | Force close breaker |
| `/circuit-breakers/:name/config` | PATCH | Update breaker config |
| `/costs/realtime` | GET | Today's cost estimate |
| `/costs/daily` | GET | Historical daily cost |
| `/costs/mtd` | GET | Month-to-date cost |
| `/costs/budget` | GET | AWS Budget status |
| `/intervention-level` | GET | Current intervention level |

### 33.8 Running Genesis

```bash
# Run full genesis sequence
python -m bobble.genesis.runner

# Check status
python -m bobble.genesis.runner --status

# Reset all genesis state (CAUTION!)
python -m bobble.genesis.runner --reset
```

### 33.9 Critical Fixes Applied

| Fix | Problem | Solution |
|-----|---------|----------|
| #1 Zeno's Paradox | Table scans for gates | Atomic counters |
| #2 Learned Helplessness | Pessimistic B-matrix | Optimistic EXPLORE (>90%) |
| #3 Shadow Self Budget | $800/month GPU | NLI semantic variance ($0) |
| #6 Boredom Trap | Prefers LOW_SURPRISE | Prefer HIGH_SURPRISE |

---

*Document Version: 4.18.48*
*Last Updated: January 2025*
