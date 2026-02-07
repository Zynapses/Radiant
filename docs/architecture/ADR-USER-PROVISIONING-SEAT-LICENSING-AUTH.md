# ADR: User Provisioning, Licensing, Authentication & Tenant Management

> **Status**: APPROVED
> **Author**: AI Build Agent (Cascade) + Product Owner
> **Date**: February 6, 2026
> **RADIANT Version**: 4.18.0 / v7.23.0+
> **Supersedes**: ADR v1 (multi-tenant user model — replaced with single-tenant model)
> **Companion Document**: [Think Tank Licensing Model](../THINKTANK-LICENSING-MODEL.md)

---

## 1. Context & Problem Statement

RADIANT is a multi-tenant SaaS platform with multiple user-facing applications (Think Tank, Curator, Aurelius Dojo, Cato Trainer, Genesis, and future apps). Several interrelated concerns must be resolved together before implementing authentication:

1. **User provisioning**: How do new users get into the system?
2. **Licensing model**: Per-app seats + storage + retention + regulatory compliance features
3. **Permission management**: Where and by whom are user permissions managed?
4. **Third-party authentication**: Can Google/Apple/Microsoft be used to log in?
5. **Regulatory compliance**: Which standards are licensed features? How do they affect cost?
6. **Tenant creation & management**: How are tenants created? Who manages them?
7. **User-tenant relationship**: One user = one tenant (NOT multi-tenant)

---

## 2. Approved Decisions

### DECISION 1: Single-Tenant Users (One User = One Tenant)

**Rule**: Each user belongs to exactly ONE tenant. The same email address can exist as separate user records in different tenants.

**IMPORTANT**: This REVERSES the v7.22.0 multi-tenant user identity model.

**Architecture**:

```
users table:
┌──────────────────────────────────────────┐
│ id: uuid-001                              │
│ tenant_id: acme-corp (NOT NULL)           │  ← User belongs to Acme Corp
│ email: john@gmail.com                     │
│ cognito_user_id: cognito-sub-abc          │
│ role: standard_user                       │
│ status: active                            │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ id: uuid-002                              │
│ tenant_id: contoso (NOT NULL)             │  ← SEPARATE user in Contoso
│ email: john@gmail.com                     │  ← Same email, different tenant
│ cognito_user_id: cognito-sub-abc          │  ← Same Cognito identity
│ role: tenant_admin                        │
│ status: active                            │
└──────────────────────────────────────────┘
```

**Constraints**:
- `UNIQUE(tenant_id, email)` — one email per tenant
- `UNIQUE(tenant_id, cognito_user_id)` — one Cognito identity per tenant
- `tenant_id NOT NULL` — every user must belong to a tenant
- `cognito_user_id` is NOT globally unique (same person can have records in multiple tenants)

**Login flow when email exists in multiple tenants**:

```
1. User enters email on login page
2. Cognito authenticates (password, Google, Apple, etc.)
3. Our API queries: SELECT tenant_id, tenant_name FROM users WHERE email = ?
4. If ONE tenant  → log straight in
5. If MULTIPLE    → show tenant picker: "Which organization?"
6. User selects   → session scoped to that tenant's user record
7. User can ONLY see data for the tenant they selected
```

**What this means**:
- No global "user identity" that spans tenants
- Each tenant has its own user record with its own role, permissions, features
- Deactivating john@gmail.com in Acme Corp does NOT affect john@gmail.com in Contoso
- Users have ZERO visibility into other tenants
- Passwords are the same (one Cognito account per email) but roles/permissions differ per tenant

### DECISION 2: Invitation-Only User Provisioning (No Self-Registration)

**Rule**: A user can ONLY enter the system if a tenant administrator explicitly invites them.

**Who can invite**: Only users with `tenant_admin` or `tenant_owner` role.

**Invitation flow**:

```
1. Tenant Admin opens Think Tank Tenant Admin → Users → Invite
2. System checks:
   a. Does the inviter have tenant_admin or tenant_owner role?      → If no, REJECT
   b. Does the tenant have available seat licenses for the app(s)?  → If no, REJECT
3. If all checks pass:
   - Create tenant_user_memberships row with status='invited'
   - Set has_access_think_tank, has_access_curator, etc. based on what admin selected
   - Send invitation email
4. Invitation contains a one-time token with expiry (configurable, default 7 days)

WHEN the user logs in for the first time (any method):

5. Cognito authenticates them → issues cognito_sub
6. Our API checks: does a users row exist for this cognito_sub?
   a. YES → existing user, check memberships, proceed
   b. NO  → first time. Check: is there an invitation for this email?
      - YES → Create users row, link to invitation, set membership status='active'
      - NO  → REJECT. "You have not been invited to any organization."
```

**What this means**:
- **No self-signup page**. There is no public registration form.
- **No "Sign in with Google" for strangers**. Google/Apple only authenticates people who are ALREADY in the system (invited or active).
- **Tenant admins are the gatekeepers**. They decide who gets in and what they can access.

---

### DECISION 3: Flexible Licensing Model (Per-App, Multi-Dimension)

**Rule**: Licensing is NOT just seats. Each app can have multiple license dimensions (seats, storage, retention, regulatory features, etc.). Adding a new licensable dimension does NOT require a code rewrite.

**See**: [Think Tank Licensing Model](../THINKTANK-LICENSING-MODEL.md) for full details.

**Core table**: `tenant_licenses` — a single flexible table that handles all license types:

```
tenant_licenses:
┌───────────────────────────────────────────────────┐
│ tenant_id:    acme-corp                            │
│ license_type: 'seat'                               │
│ app_id:       'think_tank'                         │
│ quantity:     50                                    │
│ used:         48                                    │
│ unit:         'user'                                │
│ is_active:    true                                  │
├───────────────────────────────────────────────────┤
│ tenant_id:    acme-corp                            │
│ license_type: 'storage'                            │
│ app_id:       'think_tank'                         │
│ quantity:     100                                   │
│ used:         67                                    │
│ unit:         'gb'                                  │
│ is_active:    true                                  │
├───────────────────────────────────────────────────┤
│ tenant_id:    acme-corp                            │
│ license_type: 'compliance'                         │
│ app_id:       'platform'     ← cross-app           │
│ quantity:     1              ← boolean (licensed)   │
│ feature_code: 'hipaa'                              │
│ is_active:    true                                  │
├───────────────────────────────────────────────────┤
│ tenant_id:    acme-corp                            │
│ license_type: 'retention'                          │
│ app_id:       'platform'                           │
│ quantity:     2555           ← 7 years in days      │
│ unit:         'days'                                │
│ feature_code: 'hipaa_retention'                    │
│ is_active:    true                                  │
└───────────────────────────────────────────────────┘
```

**Seat rules**:
- Active users consume seats. **Deactivated users free up seats.**
- Invited users reserve seats (to prevent over-invitation)
- Deleted users must respect regulatory retention if licensed (data retained, seat freed)
- Configurable overage: tenant can add users/licenses; billing method is charged automatically
- Think Tank (Web + Mac) = ONE seat (`think_tank`). One seat covers both platforms.
- Think Tank is granted by default on invite. Other apps require explicit activation subject to licensing.

**Regulatory compliance as licenses**:
- Every regulatory standard (HIPAA, GDPR, SOC2, CCPA, ISO 27001, etc.) is a licensable feature
- If a tenant does NOT have the license, the feature is DISABLED
- UI shows: "This feature requires a [HIPAA/GDPR/etc.] compliance license. Contact Think Tank support at support@thinktank.app to add this to your plan."
- API endpoints that serve compliance features check the license and return 403 if unlicensed
- Record retention policies that have significant storage cost are licensed separately

**All API endpoints enforce licensing** — see Licensing Model doc for the middleware pattern.

---

### DECISION 4: Think Tank Tenant Admin as Central Management Hub

**Rule**: The Think Tank Tenant Admin app is the central place for ALL tenant management, not just users. It manages:

- **User management**: Invitations, roles, app access, deactivation
- **License dashboard**: View all licenses, usage, purchase additional
- **Permissions**: Role-based permissions (soft, admin-configurable, UI for editing)
- **Tenant settings**: Name, timezone, language, branding
- **Auth config**: Allowed login methods, MFA, SSO, session timeouts
- **Compliance**: Enable/disable regulatory features (subject to licensing)
- **Reporting**: Tenant usage, audit trails, compliance reports
- **Templates & shared resources**: Tenant-visible templates, cartridges, etc.

**What individual apps do NOT have**:
- No user invite/management UI
- No license management UI
- Individual apps show "you don't have access" or "feature requires license" as appropriate

**What Radiant Admin (platform) can do additionally**:
- Override license limits for any tenant (trials, special deals)
- Create/delete tenants
- View cross-tenant summaries
- Manage Cognito accounts directly
- These are NOT available in Think Tank Tenant Admin

---

### DECISION 5: Authentication Architecture

**Rule**: Two completely separate Cognito User Pools. Federated login ONLY for the user pool. No self-registration.

#### Pool 1: `radiant-admins` (Platform Operators)

| Setting | Value |
|---------|-------|
| **Apps** | Radiant Admin Dashboard ONLY |
| **Who** | Platform operators (your team) |
| **Login** | Email + password ONLY |
| **MFA** | MANDATORY (TOTP — no SMS) |
| **Federation** | DISABLED. No Google, Apple, Microsoft, SSO. Never. |

#### Pool 2: `radiant-users` (All User-Facing Apps)

| Setting | Value |
|---------|-------|
| **Apps** | Think Tank (Web+Mac), Curator, Dojo, Cato Trainer, Genesis, Tenant Admin, ALL future apps |
| **Login** | Email+password, Google, Apple, Microsoft, Enterprise SSO (SAML/OIDC per-tenant) |
| **MFA** | Configurable per-tenant |
| **Federation** | ENABLED — authenticates only, never creates accounts |
| **Self-registration** | DISABLED. Unknown users → rejected. |

#### Authentication ≠ Authorization

```
AUTHENTICATION (Cognito):  "Is this person who they claim to be?"
AUTHORIZATION (Our API):   "Is this person allowed in this tenant with this app?"
   → users row exists for this email in a tenant? 
   → user status = active?
   → tenant has seat license for requested app?
   → tenant auth config allows this login method?
   → ALL checks pass → access granted
   → ANY check fails → HTTP 403
```

If someone authenticates via Google but has no user record → **rejected**.

---

### DECISION 6: Regulatory Compliance as Licensed Features

**Rule**: ALL regulatory standards are optional licensed features. If a tenant doesn't have the license, the features are disabled with a UI message to contact support.

**Regulatory standards with significant cost implications (must be licensed)**:

| Standard | License Code | Cost Driver | What Gets Disabled Without License |
|----------|-------------|-------------|-------------------------------------|
| **HIPAA** | `hipaa` | 7-year retention, enhanced audit, PHI encryption keys | PHI fields, enhanced audit, BAA features |
| **HIPAA Retention** | `hipaa_retention` | S3 Glacier storage for 7 years | Long-term record retention beyond default |
| **GDPR** | `gdpr` | Erasure processing, consent management, DSAR handling | Right to erasure, data export, consent UI |
| **SOC 2** | `soc2` | Comprehensive audit logging, evidence collection | Self-audit, compliance reports, evidence bundles |
| **CCPA** | `ccpa` | California consumer privacy processing | CCPA-specific rights, opt-out tracking |
| **ISO 27001** | `iso27001` | Security management controls | ISO compliance dashboard, control tracking |
| **Data Residency** | `data_residency` | Multi-region storage | Region-specific data storage, EU-only mode |
| **Enhanced Audit** | `enhanced_audit` | High-volume audit log storage | Detailed auth event logging, IP tracking |
| **Extended Retention** | `extended_retention` | Long-term storage | Retention beyond default (30 days → configurable) |

**Default (no compliance license)**: 30-day data retention, basic audit logging, standard encryption.

**UI behavior when unlicensed**:
```
┌─────────────────────────────────────────────────────────────┐
│  ⚠ HIPAA Compliance                                         │
│                                                              │
│  This feature requires a HIPAA compliance license.           │
│                                                              │
│  HIPAA compliance includes:                                  │
│  • 7-year record retention                                   │
│  • Enhanced audit logging                                    │
│  • PHI field encryption                                      │
│  • BAA documentation                                         │
│                                                              │
│  To add this license to your plan, contact Think Tank        │
│  support at support@thinktank.app                            │
│                                                              │
│  [Contact Support]                                           │
└─────────────────────────────────────────────────────────────┘
```

---

### DECISION 7: Tenant Creation & First User

**Rule**: Tenants are created via the Think Tank Tenant Admin app (or by Radiant platform admin).

**Tenant creation flow**:

```
1. New customer signs up (or Radiant admin creates tenant)
2. System creates:
   - Tenant record with name, settings
   - Default licenses based on subscription tier
   - First user with tenant_owner role + tenant_admin permissions
3. First user is ALWAYS an administrator
4. First user can see ALL permissions in Think Tank Tenant Admin
   (even ones that are off — so they know what's available)
```

**Personal accounts**:
- Single-user personal accounts still get a tenant name
- The one user is `tenant_owner` with admin privileges
- They can later invite others if their license allows

**Permissions model**:
- Permissions are SOFT — can be added/modified/removed without code changes
- Stored as configurable data, not hardcoded
- Admin-settable per role type (User, Admin, Owner)
- All permissions visible in Think Tank Tenant Admin UI with toggle on/off
- Eventually refined to exact per-action permissions

---

### DECISION 8: Role-Based Permissions & Data Isolation

**Rule**: Users within a tenant can ONLY see tenant-allowed resources. Users NEVER have access to other users' data.

**Role types**:

| Role | Scope | Default Permissions |
|------|-------|--------------------|
| `tenant_owner` | Full tenant control | All permissions, billing, delete tenant |
| `tenant_admin` | User & config management | Invite users, manage roles, configure settings |
| `standard_user` | Use apps | Access licensed apps, own data only |
| `viewer` | Read-only | View dashboards, no create/edit |

**Default Permissions Matrix** (soft — admin-configurable per tenant):

| Permission | `tenant_owner` | `tenant_admin` | `standard_user` | `viewer` |
|-----------|:-:|:-:|:-:|:-:|
| **User Management** | | | | |
| Invite users | ✅ | ✅ | ❌ | ❌ |
| Deactivate/reactivate users | ✅ | ✅ | ❌ | ❌ |
| Change user roles | ✅ | ✅ | ❌ | ❌ |
| Toggle user app access | ✅ | ✅ | ❌ | ❌ |
| Request user deletion | ✅ | ❌ | ❌ | ❌ |
| **Tenant Config** | | | | |
| Edit tenant settings | ✅ | ✅ | ❌ | ❌ |
| Configure auth (MFA, SSO) | ✅ | ✅ | ❌ | ❌ |
| Manage billing/licenses | ✅ | ❌ | ❌ | ❌ |
| Delete tenant | ✅ | ❌ | ❌ | ❌ |
| **Content** | | | | |
| Create conversations | ✅ | ✅ | ✅ | ❌ |
| View own conversations | ✅ | ✅ | ✅ | ✅ |
| View others' conversations | ❌ | ❌ | ❌ | ❌ |
| Create/edit templates | ✅ | ✅ | ❌ | ❌ |
| View shared templates | ✅ | ✅ | ✅ | ✅ |
| Manage cartridges | ✅ | ✅ | ❌ | ❌ |
| Use cartridges | ✅ | ✅ | ✅ | ❌ |
| **Reporting** | | | | |
| View tenant usage reports | ✅ | ✅ | ❌ | ✅ |
| View own usage | ✅ | ✅ | ✅ | ✅ |
| Export audit logs | ✅ | ✅ | ❌ | ❌ |
| **Compliance** | | | | |
| Enable/disable compliance features | ✅ | ❌ | ❌ | ❌ |
| View compliance dashboards | ✅ | ✅ | ❌ | ✅ |
| Initiate GDPR erasure | ✅ | ✅ | ❌ | ❌ |

**Key rules**:
- All permissions are stored in the `users.permissions` JSONB column
- Roles provide defaults; admins can override per-user in Think Tank Tenant Admin → Permissions
- New permissions can be added without migrations (JSONB is flexible)
- The UI shows ALL available permissions with toggles, even if off — so admins know what exists

**Absolute rules (NOT configurable — enforced by system)**:
- Users NEVER see other users' conversation data
- Users NEVER see other tenants' data
- RLS (`app.current_tenant_id`) enforces tenant isolation at the database level
- User-level data isolation enforced by `user_id` checks in queries
- `tenant_owner` cannot be demoted by `tenant_admin`
- Only `tenant_owner` can delete the tenant or manage billing

---

## 3. Implementation Requirements

### 3.1 User Model Changes (Reversal of v7.22.0 Multi-Tenant)

The v7.22.0 migration made `users.tenant_id` nullable for multi-tenant users. This must be reversed:

- `users.tenant_id` → `NOT NULL` again
- `UNIQUE(cognito_user_id)` → `UNIQUE(tenant_id, cognito_user_id)` (same person can exist in multiple tenants)
- `UNIQUE(tenant_id, email)` — one email per tenant
- Feature access flags (`has_access_think_tank`, etc.) stay on the user record
- `tenant_user_memberships` table is no longer needed for multi-tenant — evaluate consolidation into `users`
- Safety functions updated for single-tenant model
- `users_by_tenant` view may no longer be needed

### 3.2 Licensing Tables

See [Think Tank Licensing Model](../THINKTANK-LICENSING-MODEL.md) for full schema.

Core tables:
- `tenant_licenses` — flexible license records (seats, storage, retention, compliance, etc.)
- `license_catalog` — available license types and pricing
- `license_audit` — all license changes logged
- `tenant_auth_config` — per-tenant auth settings

### 3.3 API Licensing Middleware

Every API endpoint must:
1. Extract `tenant_id` from auth context
2. Check `tenant_licenses` for the relevant app and feature
3. If unlicensed → return `{ error: 'LICENSE_REQUIRED', license_type: 'hipaa', contact: 'support@thinktank.app' }`
4. If licensed → proceed

### 3.4 Invitation Settings

- Default expiry: 7 days
- Tenant-configurable (persistent setting in `tenants.settings` or `tenant_auth_config`)
- Applies to ALL invitations for the tenant (not per-user)

### 3.5 User Deactivation vs Deletion

| Action | Seat Impact | Data Impact | Regulatory |
|--------|-------------|-------------|------------|
| **Deactivate** | Seat FREED | Data retained | Safe for all standards |
| **Delete** | Seat FREED | Data retained per retention license | Must check tenant retention requirements |
| **Hard delete** | Seat FREED | Data purged | Only after retention period expires |

---

## 4. Resolved Open Questions

| Question | Answer |
|----------|--------|
| **Invitation expiry** | 7-day default, tenant-configurable (persistent), applies to all invitations |
| **Seat overage** | Configurable. Can add users/licenses, billing method charged. Deactivated users free seats. |
| **Cross-tenant visibility** | Zero. Users only access the tenant they logged into. No cross-tenant information. |
| **Default app access** | Think Tank by default. Other apps require explicit activation subject to licensing. |
| **Mac + Web seats** | One seat covers both (`think_tank`). |
| **User-tenant model** | One user = one tenant. Same email in multiple tenants = separate user records. |
| **Deleted user retention** | Must respect tenant's regulatory retention license before hard-deleting data. |

---

## 5. Policy Summary (For Codification)

| Policy | Rule |
|--------|------|
| **Single-tenant users** | Each user belongs to exactly one tenant |
| **No self-registration** | Users can only enter via tenant admin invitation |
| **Invitation-only auth** | Federated login authenticates but never creates accounts |
| **Flexible licensing** | Per-app, multi-dimension (seats, storage, retention, compliance) |
| **Regulatory = licensed** | All regulatory features (HIPAA, GDPR, SOC2, etc.) require a license |
| **Unlicensed = disabled** | No license → feature disabled + "contact support@thinktank.app" message |
| **API enforces licensing** | Every endpoint checks license via middleware |
| **Two Cognito pools** | `radiant-admins` (no federation) and `radiant-users` (federation enabled) |
| **Radiant Admin: no federation** | Platform admin is email+password+MFA only, always |
| **Tenant Admin = hub** | Think Tank Tenant Admin is the central management UI |
| **Apps don't manage users** | Individual apps have no user management UI |
| **First user = admin** | First user in any tenant gets tenant_owner role |
| **Soft permissions** | Configurable, admin-visible, UI for toggle on/off |
| **Data isolation** | Users never see other users' data. RLS + user_id checks. |
| **Deactivation frees seats** | Deactivated user's seat is returned to the pool |
| **Retention before deletion** | Must respect regulatory retention before hard-deleting |

---

*Document approved by Product Owner — February 6, 2026*
