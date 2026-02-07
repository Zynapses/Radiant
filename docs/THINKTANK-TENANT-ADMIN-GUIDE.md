# Think Tank Tenant Admin Guide

> **Company/Team Level Administration for Think Tank**
> 
> Version: 1.1.0 | Platform: RADIANT 7.9.0
> Last Updated: February 5, 2026

---

## Overview

The **Think Tank Tenant Admin** app is a dedicated administration interface for company/team-level settings. Unlike the Platform Admin (RADIANT Admin) which manages infrastructure across all tenants, and unlike the Think Tank Admin which is for Radiant super-admins configuring Think Tank features, the **Tenant Admin** is for organization administrators to manage their own tenant's settings, users, and content.

### App Hierarchy

| App | Audience | Scope | Location |
|-----|----------|-------|----------|
| **RADIANT Admin** | Platform operators | All tenants, infrastructure | `apps/admin-dashboard/` |
| **Think Tank Admin** | Radiant super-admins | Think Tank platform config | Documented in `THINKTANK-ADMIN-GUIDE.md` |
| **Think Tank Tenant Admin** | Organization admins | Single tenant, team settings | `apps/thinktank-tenant-admin/` |
| **Think Tank** | End users | Chat, workflows | `apps/thinktank/` |

### Key Principle: Tenant Isolation

The Tenant Admin app sits **BEHIND the service layer**. All requests are automatically tenant-isolated:
- Admins can only see/modify their own tenant's data
- System-level resources appear as read-only
- No cross-tenant access is possible

---

## Table of Contents

1. [Dashboard](#1-dashboard)
2. [User Management](#2-user-management)
3. [Team Settings](#3-team-settings)
4. [Cartridge Manager](#4-cartridge-manager)
5. [Report Writer](#5-report-writer)
6. [Usage & Billing](#6-usage--billing)
7. [AI Configuration](#7-ai-configuration)
8. [LIVS-M Policy](#8-livs-m-policy)
9. [Integrations](#9-integrations)
10. [Security Settings](#10-security-settings)
11. [Audit Log](#11-audit-log)
12. [API Reference](#12-api-reference)
13. [Implementation Files](#13-implementation-files)

---

## 1. Dashboard (v1.0.0)

**Location**: Tenant Admin → Dashboard

The dashboard provides an at-a-glance view of tenant health and usage.

### 1.1 Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Dashboard                          Your organization overview   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │Active Users│  │Conversations│  │API Requests│  │Credits Used││
│  │     42     │  │    1,234   │  │   45.2K    │  │   $1,234   ││
│  │  +5.2%     │  │   +12.3%   │  │   +8.1%    │  │   +15.0%   ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐│
│  │ Credits Usage  │  │   MLS Usage    │  │    Cartridges      ││
│  │ ████████░░ 78% │  │ ████░░░░ $45   │  │  3 active of 5     ││
│  │ 780/1000 used  │  │ limit: $100    │  │  [Manage →]        ││
│  └────────────────┘  └────────────────┘  └────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────┐  ┌────────────────┐│
│  │         Usage Trends (7 days)           │  │Recent Activity ││
│  │    ▄▄▄▄▄                                │  │ • User joined  ││
│  │  ▄▄█████▄▄    Requests                  │  │ • Report ran   ││
│  │▄▄█████████▄▄  Tokens                    │  │ • Settings     ││
│  │M  T  W  T  F  S  S                      │  │   updated      ││
│  └─────────────────────────────────────────┘  └────────────────┘│
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐│
│  │Manage Users │  │Create Report│  │Team Settings│  │ Security ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Dashboard Widgets

| Widget | Description | Data Source |
|--------|-------------|-------------|
| **Metric Cards** | Active users, conversations, requests, credits | `/api/v1/tenant/dashboard/stats` |
| **Credits Usage** | Progress bar showing credit consumption | `/api/v1/tenant/dashboard/stats` |
| **MLS Usage** | Mid-Level Services spend vs limit | `/api/v1/tenant/dashboard/stats` |
| **Cartridges** | Active/total cartridge count | `/api/v1/tenant/cartridges/stack` |
| **Usage Trends** | 7-day request/token area chart | `/api/v1/tenant/dashboard/usage-trends` |
| **Activity Feed** | Recent tenant events | `/api/v1/tenant/dashboard/activity` |
| **Alerts** | Budget warnings, security notices | `/api/v1/tenant/dashboard/alerts` |
| **Quick Actions** | Links to common admin tasks | Static |

### 1.3 Quick Actions

| Action | Description | Link |
|--------|-------------|------|
| **Manage Users** | Invite and manage team members | `/users` |
| **Create Report** | Generate usage or analytics reports | `/reports` |
| **Team Settings** | Configure organization preferences | `/settings` |
| **Security** | Manage MFA and access policies | `/security` |

### 1.4 Alert Types

| Type | Color | Example |
|------|-------|---------|
| **Warning** | Amber | "You've used 80% of your credits" |
| **Info** | Blue | "New features available" |
| **Error** | Red | "Payment method expired" |

### 1.5 Implementation

**File**: `apps/thinktank-tenant-admin/app/(dashboard)/page.tsx`

**Status**: ✅ Implemented

---

## 2. User Management (v1.1.0)

**Location**: Tenant Admin → Users

Manage users within your organization. All user provisioning is **invitation-only** — there is no self-registration. Each user belongs to exactly ONE tenant.

> **Licensing**: User invitations are subject to per-app seat licensing. If your tenant has no available seats for an app, the invite will be blocked for that app. See [Section 2A: Licensing & Seats](#2a-licensing--seats) for details.

### 2.1 User List

| Column | Description |
|--------|-------------|
| **Name** | User display name |
| **Email** | Login email |
| **Role** | tenant_owner, tenant_admin, standard_user, viewer |
| **Status** | active, invited, deactivated |
| **Apps** | Which apps the user has access to (Think Tank, Curator, etc.) |
| **Last Active** | Last login timestamp |
| **MFA** | MFA enrollment status |

### 2.2 User Roles

| Role | Permissions |
|------|-------------|
| **tenant_owner** | Full tenant control — billing, user management, delete tenant, all permissions |
| **tenant_admin** | Invite/manage users, configure settings, manage roles |
| **standard_user** | Use licensed apps, own data only |
| **viewer** | View-only access to dashboards, no create/edit |

Roles are **soft permissions** — admin-configurable with a UI for toggling individual permissions on/off. The role provides defaults, but admins can customize per-user.

### 2.3 User Actions

- **Invite User**: Send email invitation (requires seat availability for selected apps)
- **Edit Role**: Change user role and permissions
- **Toggle App Access**: Enable/disable access to specific apps (subject to seat licensing)
- **Deactivate**: Disable access, **free up the seat license** (data retained for regulatory compliance)
- **Reactivate**: Restore access (consumes a seat again)
- **Delete**: Schedule data deletion (subject to retention requirements)
- **Reset MFA**: Clear MFA for re-enrollment

### 2.4 Invitation Flow

```
1. Admin clicks "Invite User"
2. Enter email address
3. Select role: tenant_admin, standard_user, or viewer
4. Select app access (checkboxes — disabled if no seats available):
   [✓] Think Tank (42/50 seats)
   [✓] Curator (15/25 seats)
   [✗] Dojo — 0 seats available
       "No Dojo seats available. Buy more seats or deactivate a user."
   [✗] Genesis — Not licensed
       "Genesis requires a license. Contact support@thinktank.app"
5. System checks permissions and seat availability
6. Invitation sent (expires in 7 days, or tenant-configured)
```

**Think Tank access is granted by default.** Other apps must be explicitly selected (subject to licensing).

### 2.5 Deactivation vs Deletion

| Action | Seat Impact | Data Impact | When To Use |
|--------|-------------|-------------|-------------|
| **Deactivate** | Seat FREED | Data retained | Employee leaves, temporary suspension |
| **Delete** | Seat FREED | Data retained per retention license, then purged | GDPR erasure, permanent removal |

**Important**: If your tenant has a regulatory retention license (e.g., HIPAA 7-year retention), user data CANNOT be deleted until the retention period expires. The system will show the earliest deletion date.

### 2.6 Bulk Actions

- Import users from CSV (subject to seat availability)
- Export user list
- Bulk role assignment
- Bulk app access toggle

### 2.7 Same Email in Multiple Tenants

A person can have accounts in multiple organizations (e.g., john@gmail.com in Acme Corp AND Contoso). These are **completely separate user records**. When they log in, they select which organization to enter. Users have **zero visibility** into other tenants.

---

## 2A. Licensing & Seats (v1.0.0)

**Location**: Tenant Admin → Licenses

> **Full Reference**: [Think Tank Licensing Model](./THINKTANK-LICENSING-MODEL.md)

### 2A.1 License Dashboard

View all licenses, usage, and availability for your tenant:

- **App Seats**: How many seats are used/available per app (Think Tank, Curator, Dojo, etc.)
- **Storage**: Storage quota usage
- **Retention**: Data retention period
- **Compliance**: Which regulatory features are active

### 2A.2 Seat Licensing

Each app has its own seat count. Seats are consumed when a user is active with that app's access enabled.

| State | Seat Status |
|-------|-------------|
| **Active user with app access** | Seat consumed |
| **Invited user** | Seat reserved |
| **Deactivated user** | Seat freed |
| **User without app access** | No seat consumed |

### 2A.3 Purchasing Additional Seats

If you need more seats or licenses:
- Click **"+ Buy Seats"** next to the app
- Or contact Think Tank support at **support@thinktank.app**
- Additional seats are billed per-seat per-month on your existing billing method

### 2A.4 Compliance Licenses

Regulatory features (HIPAA, GDPR, SOC 2, etc.) are optional licensed features. If your tenant does not have the license, the feature is disabled with a message:

```
⚠ This feature requires a [HIPAA/GDPR/SOC2] compliance license.
  Contact Think Tank support at support@thinktank.app to add this to your plan.
```

Contact **support@thinktank.app** to add compliance licenses.

### 2A.5 Tier Defaults

Your subscription tier includes a base allocation of seats and features. See [Think Tank Licensing Model § Section 4](./THINKTANK-LICENSING-MODEL.md#4-tier-defaults) for the full tier breakdown.

---

## 3. Team Settings

**Location**: Tenant Admin → Settings

Organization-wide configuration.

### 3.1 General Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Organization Name** | Display name | From signup |
| **Timezone** | Default timezone for reports | UTC |
| **Language** | Default UI language | en |
| **Logo** | Custom logo for white-label | None |

### 3.2 AI Behavior Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Default Model** | Preferred AI model | Claude 3.5 Sonnet |
| **Response Tone** | professional/casual/technical | professional |
| **Safety Level** | Content filtering strictness | balanced |
| **Context Window** | Max context per conversation | 100K |

### 3.3 Feature Toggles

| Feature | Description | Default |
|---------|-------------|---------|
| **Enable Collaboration** | Real-time collaboration features | true |
| **Enable Time Machine** | Conversation forking/history | true |
| **Enable Artifacts** | Code/document generation | true |
| **Enable MLS** | Mid-Level Services access | tier-dependent |
| **Enable Reports** | Report generation | true |

---

## 4. Cartridge Manager

**Location**: Tenant Admin → Cartridges

Manage AI cartridges for your organization. **Already implemented** in `apps/thinktank-tenant-admin/app/(dashboard)/cartridges/page.tsx`.

### 4.1 Capabilities

| Action | Description |
|--------|-------------|
| **View System Cartridges** | See platform-wide cartridges (read-only) |
| **Create Tenant Cartridge** | Create organization-specific cartridge |
| **Activate/Deactivate** | Toggle cartridge usage |
| **Archive** | Soft-delete cartridge |
| **View Stack** | See cartridge priority order |

### 4.2 Cartridge Stack

```
System Cartridges (inherited, read-only)
    ↓
Tenant Cartridges (your organization)
    ↓
User Cartridges (per-user preferences)
```

Tenant admins can manage the middle layer.

### 4.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tenant/cartridges` | List tenant cartridges |
| GET | `/api/v1/tenant/cartridges/stack` | Get cartridge stack |
| POST | `/api/v1/tenant/cartridges` | Create cartridge |
| POST | `/api/v1/tenant/cartridges/:id/activate` | Activate |
| POST | `/api/v1/tenant/cartridges/:id/deactivate` | Deactivate |
| DELETE | `/api/v1/tenant/cartridges/:id` | Archive |

---

## 5. Report Writer

**Location**: Tenant Admin → Reports

Create, schedule, and manage reports scoped to your tenant.

### 5.1 Report Types

| Type | Description | Scope |
|------|-------------|-------|
| **Usage Report** | API calls, tokens, costs | Tenant |
| **User Activity** | User engagement metrics | Tenant |
| **Conversation Analytics** | Topic distribution, sentiment | Tenant |
| **Compliance Report** | Audit trail summary | Tenant |
| **Custom Report** | Build your own with filters | Tenant |

### 5.2 Report Builder

The report builder allows tenant admins to create custom reports:

1. **Select Data Source**: Usage, conversations, users, audit
2. **Apply Filters**: Date range, users, domains
3. **Choose Metrics**: Select which fields to include
4. **Configure Visualization**: Table, chart, summary
5. **Set Schedule**: One-time, daily, weekly, monthly

### 5.3 Report Scheduling

| Setting | Options |
|---------|---------|
| **Frequency** | one-time, daily, weekly, monthly |
| **Delivery** | Dashboard, email, S3 |
| **Format** | PDF, Excel, CSV, JSON |
| **Recipients** | Tenant admins, specific users |

### 5.4 Policy Enforcement - Allowed Actions

The Report Writer enforces strict tenant isolation. Tenant admins **CAN**:

| Action | Description | Enforcement |
|--------|-------------|-------------|
| ✅ View tenant users | See users in their organization | RLS: `tenant_id = current_tenant` |
| ✅ View tenant conversations | See all conversations within tenant | RLS: `tenant_id = current_tenant` |
| ✅ View tenant usage | API calls, tokens, costs for tenant | RLS: `tenant_id = current_tenant` |
| ✅ View tenant audit log | Audit events within tenant | RLS: `tenant_id = current_tenant` |
| ✅ Create reports | Reports scoped to tenant data only | Service layer validation |
| ✅ Schedule reports | Automated report delivery | Recipients must be tenant members |
| ✅ Export tenant data | CSV/PDF/Excel of tenant data | Data filtered by tenant |
| ✅ Set alerts | Budget/usage alerts for tenant | Tenant-scoped notifications |
| ✅ View MLS usage | Mid-Level Services consumption | RLS: `tenant_id = current_tenant` |

### 5.5 Policy Enforcement - Forbidden Actions

The following actions are **BLOCKED** at the service layer:

| Action | Reason | Enforcement |
|--------|--------|-------------|
| ❌ View other tenants' data | Tenant isolation | RLS + service layer rejection |
| ❌ Access platform metrics | Platform admin only | Role check: requires `radiant_admin` |
| ❌ View system audit logs | Platform admin only | Role check: requires `radiant_admin` |
| ❌ Export raw database | Security risk | Endpoint does not exist |
| ❌ Access Lambda logs | Infrastructure admin only | AWS IAM denial |
| ❌ View model costs (platform) | Confidential pricing | Role check: requires `radiant_admin` |
| ❌ Cross-tenant comparisons | Competitive data | Query validation blocks `tenant_id != current` |
| ❌ Send reports to non-members | Data exfiltration | Recipient validation |
| ❌ Access PII without consent | GDPR/HIPAA compliance | Consent flags checked |
| ❌ Modify system cartridges | Platform admin only | Scope check: `scope != 'system'` |
| ❌ View provider API keys | Security | Never exposed to tenant layer |

### 5.6 Enforcement Mechanisms

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUEST: Generate Report                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. AUTHENTICATION                                                │
│    - JWT validation                                              │
│    - Extract tenant_id from token                                │
│    - Verify user has tenant_admin role                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. SERVICE LAYER VALIDATION                                      │
│    - Validate report type is allowed for tenant tier            │
│    - Validate date range is within retention period             │
│    - Validate recipients are tenant members                     │
│    - Validate data sources are tenant-accessible                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. ROW-LEVEL SECURITY (PostgreSQL)                               │
│    - SET app.current_tenant_id = '<tenant_id>'                  │
│    - All queries automatically filtered                         │
│    - Cannot bypass via SQL injection                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. QUERY VALIDATION                                              │
│    - Block queries with tenant_id conditions                    │
│    - Block UNION/JOIN to non-tenant tables                      │
│    - Block aggregate functions across tenants                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. OUTPUT SANITIZATION                                           │
│    - Remove internal IDs from exports                           │
│    - Mask PII if not authorized                                 │
│    - Add audit watermark to exports                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ✅ Report Generated (Tenant-Scoped)
```

### 5.7 Error Responses

When policy violations are attempted:

| Violation | HTTP Code | Error Message |
|-----------|-----------|---------------|
| Cross-tenant access | 403 | "Access denied: resource belongs to another organization" |
| Platform-only metric | 403 | "Access denied: platform metrics require elevated privileges" |
| Invalid recipient | 400 | "Recipient must be a member of your organization" |
| Tier restriction | 403 | "Report type not available for your subscription tier" |
| Retention exceeded | 400 | "Requested date range exceeds your data retention period" |
| PII without consent | 403 | "User has not consented to PII export" |

### 5.8 Audit Trail

All report actions are logged:

```typescript
interface ReportAuditEntry {
  timestamp: Date;
  tenantId: string;
  actorId: string;           // Who ran the report
  action: 'create' | 'run' | 'download' | 'schedule' | 'delete';
  reportId: string;
  reportType: string;
  dataSourcesAccessed: string[];
  rowsReturned: number;
  exportFormat?: string;
  recipientCount?: number;
  ipAddress: string;
  userAgent: string;
}
```

### 5.9 Report Templates

Pre-built templates for common reports:
- Monthly Usage Summary
- Weekly User Activity
- Quarterly Compliance Audit
- Cost Breakdown by User
- Top Topics This Month

### 5.10 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tenant/reports` | List reports |
| GET | `/api/v1/tenant/reports/:id` | Get report details |
| POST | `/api/v1/tenant/reports` | Create report |
| PUT | `/api/v1/tenant/reports/:id` | Update report |
| DELETE | `/api/v1/tenant/reports/:id` | Delete report |
| POST | `/api/v1/tenant/reports/:id/run` | Execute report |
| GET | `/api/v1/tenant/reports/:id/download` | Download results |
| POST | `/api/v1/tenant/reports/:id/schedule` | Set schedule |

---

## 6. Usage & Billing

**Location**: Tenant Admin → Billing

View usage and manage billing for your tenant.

### 6.1 Usage Dashboard

| Metric | Description |
|--------|-------------|
| **API Calls** | Total requests this period |
| **Tokens Used** | Input + output tokens |
| **Credits Remaining** | Prepaid credit balance |
| **Cost Estimate** | Projected bill |
| **MLS Usage** | Mid-Level Services breakdown |

### 6.2 Usage Breakdown

- By user
- By model
- By day/week/month
- By feature (chat, reports, MLS)

### 6.3 Alerts & Limits

| Setting | Description |
|---------|-------------|
| **Budget Alert** | Notify at % of budget |
| **User Limit** | Max API calls per user |
| **Monthly Cap** | Hard stop at amount |

### 6.4 Invoice History

View and download past invoices.

---

## 7. AI Configuration

**Location**: Tenant Admin → AI Settings

Configure AI behavior for your organization.

### 7.1 Model Preferences

| Setting | Description |
|---------|-------------|
| **Allowed Models** | Which models users can access |
| **Default Model** | Model used by default |
| **Fallback Model** | Backup when default unavailable |

### 7.2 Prompt Templates

Create organization-wide prompt templates:
- System prompts for specific use cases
- Pre-approved prompt patterns
- Domain-specific instructions

### 7.3 Domain Configuration

| Setting | Description |
|---------|-------------|
| **Primary Domains** | Your organization's focus areas |
| **Blocked Domains** | Topics to restrict |
| **Custom Taxonomy** | Organization-specific categories |

### 7.4 MLS Configuration

Mid-Level Services settings (if tier allows):

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable MLS** | Master toggle | true |
| **Auto-Warm** | Warm models on first request | true |
| **Cost Alerts** | Notify on MLS spend | true |
| **Alert Threshold** | Monthly threshold | $100 |

---

## 8. LIVS-M Policy (v7.9.0)

**Location**: Tenant Admin → LIVS-M Policy

Configure the AI governance "Defcon" level for your organization. LIVS-M (LLM Interrogation & Verification System - Modular) provides policy-driven forensic verification of AI outputs.

### 8.1 Overview

LIVS-M 2.0 allows tenant admins to configure how strictly the platform verifies AI-generated content before it's delivered to users.

```
┌─────────────────────────────────────────────────────────────────┐
│  LIVS-M Policy Settings                    v2.0.0 [UPDATE]     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┬─────────────┬─────────────┐                    │
│  │ Modes       │ Settings    │ Updates  •  │  ← Tab navigation  │
│  └─────────────┴─────────────┴─────────────┘                    │
│                                                                  │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│  │  Brainstorming   │ │    Standard      │ │   Strict Audit   │ │
│  │  ⚡ Creative     │ │  ⚖️ Default      │ │  🛡️ Secure       │ │
│  │                  │ │  [Selected]      │ │                  │ │
│  │  "Yes, and..."   │ │ "Trust but       │ │ "Zero Trust"     │ │
│  │                  │ │  Verify"         │ │                  │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│                                                                  │
│  Current Mode: Standard                                          │
│  • Sycophancy Detection: ON                                     │
│  • Stub Rejection: ON                                           │
│  • Chaos Injection: OFF                                         │
│  • Max Consensus Velocity: 2                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Policy Modes

| Mode | Alias | Description | Best For |
|------|-------|-------------|----------|
| **Brainstorming** | RAPID_PROTO | Accepts partial code, stubs, rough ideas. Focuses on speed and creativity. | Hackathons, MVP planning, early drafting |
| **Standard** | ENGINEERING | Code must run. Stubs rejected if breaking functionality. Tests encouraged. | Daily development, sprint work |
| **Strict Audit** | STRICT_AUDIT | No stubs. No mock data. Mandatory tests. Sycophancy triggers Devil's Advocate. | Production releases, medical/legal, security |

### 8.3 Configuration Options

| Setting | Description | Default |
|---------|-------------|----------|
| **Sycophancy Detection** | Detect when agents agree too quickly without critical analysis | ON |
| **Stub Rejection** | Reject outputs containing TODO, placeholder, or incomplete code | ON |
| **Chaos Injection** | Inject Devil's Advocate agent when sycophancy detected | OFF |
| **Max Consensus Velocity** | Maximum agreement rate before triggering verification | 2 |

### 8.4 Version Management (v7.9.0+)

Tenant admins can check for LIVS-M policy registry updates and upgrade:

| Feature | Description |
|---------|-------------|
| **Version Badge** | Shows current version (e.g., v2.0.0) |
| **Update Indicator** | Animated badge when new version available |
| **Changelog** | List of improvements in new version |
| **Breaking Changes Alert** | Warning if update has breaking changes |
| **Migration Notice** | Notification if database migration required |
| **One-Click Upgrade** | Button to upgrade to latest version |

### 8.5 What LIVS-M Catches

| Issue | Description | Action |
|-------|-------------|--------|
| **Code Stubs** | `// TODO`, `throw new Error('not implemented')`, empty functions | Rejected with retry prompt |
| **Mock Data** | Hardcoded return values, fake data | Rejected in Standard/Strict modes |
| **Sycophancy** | AI agreeing without verification | Triggers Devil's Advocate |
| **Incomplete Tests** | Missing test coverage | Warning in Standard, rejected in Strict |

### 8.6 Tenant-Level Overrides

Tenant admins can override the platform default for their organization:

- **Inherit Platform Default**: Use whatever the platform admin sets
- **Force Brainstorming**: Always use creative mode
- **Force Standard**: Always use balanced verification
- **Force Strict**: Always use maximum verification

### 8.7 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tenant/livs-policy` | Get current policy settings |
| PUT | `/api/v1/tenant/livs-policy` | Update policy settings |
| GET | `/api/v1/tenant/livs-policy/version` | Check for updates |
| POST | `/api/v1/tenant/livs-policy/upgrade` | Upgrade to latest version |

### 8.8 Implementation

**Files**:
- UI: `apps/admin-dashboard/app/thinktank-admin/simulator/page.tsx` (LIVS-M Policy view)
- Types: `packages/shared/src/types/livs.types.ts`
- Service: `packages/infrastructure/lambda/shared/services/livs/livs-version.service.ts`

**Status**: ✅ Implemented

---

## 9. Integrations

**Location**: Tenant Admin → Integrations

Connect Think Tank to your organization's tools.

### 9.1 Available Integrations

| Integration | Type | Description |
|-------------|------|-------------|
| **SSO/SAML** | Authentication | Single sign-on |
| **Slack** | Notification | Activity alerts |
| **Microsoft Teams** | Notification | Activity alerts |
| **Webhook** | Custom | HTTP callbacks |
| **API Keys** | Programmatic | Service integration |

### 9.2 API Key Management

Tenant admins can create API keys for programmatic access:

| Setting | Description |
|---------|-------------|
| **Name** | Descriptive name |
| **Scopes** | read, write, admin |
| **Expiry** | Auto-expiration date |
| **IP Whitelist** | Allowed IP addresses |

---

## 10. Security Settings

**Location**: Tenant Admin → Security

Configure security policies for your organization.

### 10.1 Authentication

| Setting | Description | Default |
|---------|-------------|---------|
| **Require MFA** | Force MFA for all users | false |
| **Session Timeout** | Auto-logout duration | 24h |
| **Password Policy** | Complexity requirements | standard |

### 10.2 Data Retention

| Setting | Description | Default |
|---------|-------------|---------|
| **Conversation Retention** | How long to keep chats | 90 days |
| **Audit Log Retention** | How long to keep audit | 1 year |
| **Export Retention** | How long to keep exports | 30 days |

### 10.3 Compliance Settings

| Setting | Description |
|---------|-------------|
| **HIPAA Mode** | Enable HIPAA safeguards |
| **Data Residency** | Require specific region |
| **Encryption** | Additional encryption options |

---

## 11. Audit Log

**Location**: Tenant Admin → Audit

View all administrative actions within your tenant.

### 11.1 Audited Events

| Event | Description |
|-------|-------------|
| **user.invited** | New user invitation sent |
| **user.role_changed** | User role modified |
| **user.suspended** | User suspended |
| **cartridge.created** | New cartridge created |
| **cartridge.activated** | Cartridge enabled |
| **report.created** | New report created |
| **settings.changed** | Tenant settings modified |
| **integration.added** | New integration configured |

### 11.2 Audit Log Fields

| Field | Description |
|-------|-------------|
| **Timestamp** | When the event occurred |
| **Actor** | Who performed the action |
| **Action** | What was done |
| **Target** | What was affected |
| **Details** | Additional context |
| **IP Address** | Source IP |

### 11.3 Export

Export audit logs for compliance:
- Date range filter
- Event type filter
- CSV or JSON format

---

## 12. API Reference

### Base URL

```
/api/v1/tenant
```

All endpoints automatically scope to the authenticated user's tenant.

### Authentication

Use Bearer token from Think Tank session or API key with `tenant:admin` scope.

### Endpoints Summary

| Resource | Endpoints |
|----------|-----------|
| **Dashboard** | `GET /dashboard` |
| **Users** | `GET/POST/PUT/DELETE /users` |
| **Settings** | `GET/PUT /settings` |
| **Cartridges** | `GET/POST/PUT/DELETE /cartridges` |
| **Reports** | `GET/POST/PUT/DELETE /reports` |
| **Billing** | `GET /billing`, `GET /usage` |
| **AI Config** | `GET/PUT /ai-config` |
| **Integrations** | `GET/POST/DELETE /integrations` |
| **Security** | `GET/PUT /security` |
| **Audit** | `GET /audit`, `GET /audit/export` |

---

## 13. Implementation Files

### Current Implementation

| Component | Path | Status |
|-----------|------|--------|
| **App Directory** | `apps/thinktank-tenant-admin/` | ✅ Created |
| **Cartridge Manager** | `app/(dashboard)/cartridges/page.tsx` | ✅ Implemented |
| **Dashboard** | `app/(dashboard)/page.tsx` | ✅ Implemented |
| **LIVS-M Policy** | `apps/admin-dashboard/app/thinktank-admin/simulator/page.tsx` | ✅ Implemented |
| **Users** | `app/(dashboard)/users/page.tsx` | 🔲 Pending |
| **Settings** | `app/(dashboard)/settings/page.tsx` | 🔲 Pending |
| **Reports** | `app/(dashboard)/reports/page.tsx` | 🔲 Pending |
| **Billing** | `app/(dashboard)/billing/page.tsx` | 🔲 Pending |
| **AI Config** | `app/(dashboard)/ai-config/page.tsx` | 🔲 Pending |
| **Integrations** | `app/(dashboard)/integrations/page.tsx` | 🔲 Pending |
| **Security** | `app/(dashboard)/security/page.tsx` | 🔲 Pending |
| **Audit** | `app/(dashboard)/audit/page.tsx` | 🔲 Pending |

### API Handler

| Component | Path | Status |
|-----------|------|--------|
| **Tenant API** | `lambda/tenant/handler.ts` | 🔲 Pending |
| **Tenant Service** | `lambda/shared/services/tenant-admin.service.ts` | 🔲 Pending |

### Database Tables

| Table | Purpose | Status |
|-------|---------|--------|
| `tenant_settings` | Tenant-level settings | ✅ Exists |
| `tenant_users` | User-tenant mapping | ✅ Exists |
| `tenant_reports` | Saved reports | 🔲 Pending |
| `tenant_report_schedules` | Report scheduling | 🔲 Pending |
| `tenant_integrations` | Integration configs | 🔲 Pending |
| `tenant_api_keys` | Tenant-scoped API keys | ✅ Exists |
| `tenant_audit_log` | Tenant audit events | ✅ Exists |

---

## Memory Retention Settings (v7.13.0)

### Overview

Tenant Admins can customize memory retention for their organization within the bounds set by the Think Tank administrator. This controls session-to-session memory, storage limits, and which memory features are available to your users.

**Dashboard Location**: Tenant Admin → Memory Retention (`/thinktank-tenant-admin/memory-retention`)

### What You Can Control

| Setting | Type | Description |
|---------|------|-------------|
| **Session-to-Session Memory** | Toggle | Enable/disable persistent memory for your users |
| **Conversation History** | Toggle | Store full conversation transcripts |
| **Auto-Extract Facts** | Toggle | Automatically extract facts from conversations |
| **User Can Delete Own Memory** | Toggle | Allow users to manage their own memory |
| **Uploaded Documents in Memory** | Toggle | Include uploaded documents (PDFs, images, code) in user memory across all chats |
| **Downloaded Files in Memory** | Toggle | Include AI-generated/retrieved files in user memory across all chats |
| **Retention Days** | Number | How many days to retain memories (0 = unlimited) |
| **Max Storage Per User** | Number (MB) | Maximum storage per user |
| **Hot Tier Days** | Number | Days in fast-access storage |
| **Warm Tier Days** | Number | Days in warm storage |

### Constraints

Your overrides **CANNOT exceed** limits set by the Think Tank Admin:
- If the Think Tank Admin sets retention to 90 days, you cannot set it to 180
- If the Think Tank Admin disables session memory, you cannot re-enable it
- If the Think Tank Admin sets max storage to 500MB, you cannot set it to 1000MB
- If the Think Tank Admin disables uploaded documents or downloaded files, you cannot re-enable them

The dashboard will display tenant-level constraints when they exist, and the API will reject requests that exceed them.

### Admin API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/memory-retention/tenant-admin/override` | Get current override |
| PUT | `/api/admin/memory-retention/tenant-admin/override` | Set/update override |
| DELETE | `/api/admin/memory-retention/tenant-admin/override` | Remove (restore tenant defaults) |
| GET | `/api/admin/memory-retention/effective` | Get resolved effective policy |
| GET | `/api/admin/memory-retention/dashboard` | Usage dashboard |

---

## Related Documentation

- [RADIANT Admin Guide](./RADIANT-ADMIN-GUIDE.md) - Platform administration
- [Think Tank Admin Guide](./THINKTANK-ADMIN-GUIDE.md) - Think Tank platform config
- [Think Tank User Guide](./THINKTANK-USER-GUIDE.md) - End user guide
- [Cartridge System](./RADIANT-ADMIN-GUIDE.md#section-89-cartridge-pki--federation) - Cartridge PKI

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.2.0 | 2026-02-06 | Added Memory Retention Settings section (v7.13.0) — configurable retention with constraint enforcement |
| 1.1.0 | 2026-02-05 | Added LIVS-M Policy section (v7.9.0) with policy modes, settings, and version management |
| 1.0.0 | 2026-02-03 | Initial documentation |
