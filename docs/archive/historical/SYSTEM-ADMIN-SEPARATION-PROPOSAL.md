# PROPOSAL: System Administrator Separation from Tenant Users

**Version**: 1.0.0
**Date**: February 7, 2026
**Author**: AI Build Agent (Claude Opus 4.5)
**Status**: DRAFT — Awaiting Review

---

## 1. Problem Statement

The current implementation (v7.34.0) introduced `SystemAdminRole` (`super_admin`, `admin`, `operator`, `auditor`) as a permission layer **on top of** the existing `administrators` table, which itself lives in the same Cognito User Pool as regular tenant users. This creates several problems:

### 1.1 Security Boundary Violation

System administrators (people who manage the entire RADIANT platform — databases, infrastructure, deployments, models) share authentication infrastructure with tenant end-users. A compromised tenant user pool affects system admin access. There is no **hard isolation** between the two identity domains.

### 1.2 Blast Radius

`super_admin` currently gets `canAccessAllApps: true`, granting access to Think Tank, Curator, Genesis, Dojo, Cato — consumer apps they have no business accessing. The `AdminRoleService.assignRole()` method explicitly grants `super_admin` access to all 6 apps including consumer apps:

```typescript
// Current code in admin-role-guard.ts line 244-253
if (role === 'super_admin') {
  const apps = ['radiant_admin', 'think_tank', 'curator', 'genesis', 'dojo', 'cato_trainer'];
  for (const appId of apps) { ... }
}
```

### 1.3 Tenant Contamination

`admin_role_assignments` has `tenant_id` as a required column with RLS policy `admin_roles_tenant_isolation`. System administrators are **global** — they manage all tenants, infrastructure, and the database. Forcing them into a tenant context is architecturally wrong. The bootstrap flow works around this by using a single tenant, but that's a hack.

### 1.4 Consumer App Leakage

The `thinktank-auth.ts` login handler checks `ADMIN_ROLES = ['SuperAdmin', 'TenantAdmin', 'super_admin', 'tenant_admin', 'admin']` — system admin roles are mixed with tenant admin roles. A system admin could log into a Think Tank Admin app.

### 1.5 Alert System Dependency

The SENTINEL notification pipeline (`sentinel-notifier.service.ts`) resolves alert recipients via `ContactVerificationService.resolveContactsForAlert()`, which queries `sentinel_contact_routing` → `user_contacts`. Both tables use `user_id` and `tenant_id` columns. System admins need to receive SEV 1-5 alerts with verified phone/email, but the current schema ties contacts to a tenant context.

---

## 2. Current Architecture (What Exists Today)

### 2.1 Tables Involved

| Table | Purpose | Tenant-Scoped? |
|-------|---------|----------------|
| `administrators` | Legacy admin table (Cognito ID, email, role, permissions) | Yes (`tenant_id`) |
| `admin_role_assignments` | New role enforcement (super_admin/admin/operator/auditor) | Yes (`tenant_id`) |
| `admin_role_audit_log` | Role change history | Yes (`tenant_id`) |
| `admin_app_access` | Per-admin app grants | Yes (`tenant_id`) |
| `user_contacts` | Multi-contact directory (3 email + 3 phone, verified) | Yes (`tenant_id`) |
| `user_profiles` | Extended profile (bio, timezone, locale) | Yes (`tenant_id`) |
| `sentinel_contact_routing` | Alert category → contact mapping | Yes (`tenant_id`) |
| `contact_verification_log` | Verification audit trail | Yes (`tenant_id`) |

### 2.2 Auth Flow

```
Cognito User Pool (shared)
    ├── End Users (custom:role = 'user')
    ├── Tenant Admins (custom:role = 'TenantAdmin')
    └── System Admins (custom:role = 'super_admin'|'admin'|'operator'|'auditor')
         ↓
    extractAuthContext() in shared/auth.ts
         ↓
    isAdmin / isSuperAdmin flags based on cognito:groups
         ↓
    admin-role-guard.ts → extractAdminContext() → SYSTEM_ADMIN_PERMISSIONS matrix
```

### 2.3 Alert Flow

```
SENTINEL Watchdog → Alert Processor → Notifier
    ↓
SentinelNotifierService.notifyForAlert()
    ↓
ContactVerificationService.resolveContactsForAlert(tenantId, category, severity)
    ↓
SQL: resolve_sentinel_contacts() → sentinel_contact_routing JOIN user_contacts
    ↓
Dispatch: PagerDuty / Twilio Voice / Twilio SMS / Slack / SES Email / SNS
```

---

## 3. Proposed Architecture

### 3.1 Core Principle: Separate Identity Domains

```
┌─────────────────────────────────────────────────────────────┐
│                  RADIANT PLATFORM                            │
│                                                              │
│  ┌──────────────────────┐    ┌────────────────────────────┐ │
│  │  SYSTEM ADMIN PLANE  │    │  TENANT PLANE              │ │
│  │                      │    │                            │ │
│  │  Cognito User Pool B │    │  Cognito User Pool A       │ │
│  │  (system-admins)     │    │  (end-users + tenant-admins)│ │
│  │                      │    │                            │ │
│  │  system_admins table │    │  users / administrators    │ │
│  │  (NO tenant_id)      │    │  (tenant-scoped)           │ │
│  │                      │    │                            │ │
│  │  Apps:               │    │  Apps:                     │ │
│  │  ✅ Radiant Admin    │    │  ✅ Think Tank             │ │
│  │  ✅ Future ops apps  │    │  ✅ Curator                │ │
│  │  ❌ Think Tank       │    │  ✅ Genesis                │ │
│  │  ❌ Curator          │    │  ✅ Dojo                   │ │
│  │  ❌ Genesis          │    │  ✅ Cato Trainer           │ │
│  │  ❌ Dojo             │    │  ✅ TT Admin / TT Tenant   │ │
│  │  ❌ Cato             │    │  ❌ Radiant Admin          │ │
│  └──────────┬───────────┘    └──────────┬─────────────────┘ │
│             │  Service Layer Firewall    │                   │
│             │  (API Gateway Authorizers) │                   │
│             ▼                            ▼                   │
│  ┌──────────────────┐         ┌─────────────────────┐       │
│  │ Admin API GW     │         │ Tenant API GW       │       │
│  │ /api/admin/*     │         │ /api/thinktank/*    │       │
│  │ Auth: Pool B     │         │ /api/curator/*      │       │
│  │                  │         │ Auth: Pool A         │       │
│  └──────────────────┘         └─────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 New Table: `system_admins`

Replaces system admin data in `administrators` and `admin_role_assignments`. **No `tenant_id` column** — system admins are global.

```sql
CREATE TABLE system_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_user_id VARCHAR(128) NOT NULL UNIQUE,  -- Cognito Pool B sub
  email VARCHAR(320) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  role system_admin_role NOT NULL DEFAULT 'operator',
  is_bootstrap BOOLEAN NOT NULL DEFAULT false,
  mfa_enabled BOOLEAN NOT NULL DEFAULT true,
  mfa_method VARCHAR(20) DEFAULT 'authenticator',  -- 'authenticator' | 'sms'

  -- Profile fields (preserved for alert routing)
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  locale VARCHAR(10) NOT NULL DEFAULT 'en-US',

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active' | 'suspended' | 'deactivated'
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,

  -- Audit
  created_by UUID,  -- NULL for bootstrap
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID
);

-- NO RLS — system admins are global, not tenant-scoped
-- Access is controlled at the API Gateway authorizer level
```

### 3.3 New Table: `system_admin_contacts`

Dedicated contact table for system admins. Same verification mechanism, but **no `tenant_id`**.

```sql
CREATE TABLE system_admin_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES system_admins(id) ON DELETE CASCADE,
  contact_type contact_type NOT NULL,
  label contact_label NOT NULL DEFAULT 'work',
  custom_label VARCHAR(50),
  value VARCHAR(320) NOT NULL,
  country_code VARCHAR(2),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  verification_status contact_verification_status NOT NULL DEFAULT 'unverified',
  verification_code_hash VARCHAR(255),
  verification_expires_at TIMESTAMPTZ,
  verification_attempts INT NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  last_verification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_sysadmin_contact UNIQUE (admin_id, contact_type, value),
  CONSTRAINT chk_sa_phone_e164 CHECK (
    contact_type != 'phone' OR value ~ '^\+[1-9]\d{1,14}$'
  ),
  CONSTRAINT chk_sa_email CHECK (
    contact_type != 'email' OR value ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  CONSTRAINT chk_sa_phone_cc CHECK (
    contact_type != 'phone' OR country_code IS NOT NULL
  )
);

-- Max 3 emails + 3 phones (reuse enforce_max_contacts pattern)
-- Primary enforcement (reuse enforce_single_primary pattern)
```

### 3.4 New Table: `system_admin_alert_routing`

SENTINEL alert routing for system admins. **No `tenant_id`** — system alerts are global (infrastructure, security, availability).

```sql
CREATE TABLE system_admin_alert_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES system_admins(id) ON DELETE CASCADE,
  alert_category VARCHAR(20) NOT NULL DEFAULT '*',
  min_severity INT NOT NULL DEFAULT 3 CHECK (min_severity BETWEEN 1 AND 5),
  contact_id UUID NOT NULL REFERENCES system_admin_contacts(id) ON DELETE CASCADE,
  -- Denormalized for fast lookup
  contact_type contact_type NOT NULL,
  contact_value VARCHAR(320) NOT NULL,
  contact_label contact_label NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_sa_routing UNIQUE (admin_id, alert_category, min_severity, contact_id),
  CONSTRAINT chk_sa_alert_category CHECK (
    alert_category IN (
      '*', 'infrastructure', 'security', 'compliance', 'application',
      'ai_model', 'data', 'billing', 'performance', 'availability'
    )
  )
);
```

### 3.5 Updated Table: `system_admin_audit_log`

```sql
CREATE TABLE system_admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES system_admins(id),
  action VARCHAR(50) NOT NULL,
  old_role system_admin_role,
  new_role system_admin_role,
  performed_by UUID,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4. Bootstrap Flow

### 4.1 Initial System Admin Creation

The **first system admin** is created during deployment via the Swift Deployer app or a CLI script. This is the only time a system admin can be created without another system admin authorizing it.

```
Swift Deployer / CLI
    ↓
1. Create Cognito user in System Admin Pool (Pool B)
   - email: provided by deployer
   - temp password: auto-generated, force change on first login
   - MFA: required (TOTP or SMS)
   - custom:role = 'super_admin'
   - custom:is_bootstrap = 'true'
    ↓
2. INSERT INTO system_admins (
     cognito_user_id, email, display_name, role, is_bootstrap,
     mfa_enabled, status
   ) VALUES (?, ?, ?, 'super_admin', true, true, 'pending_setup')
    ↓
3. Send welcome email with:
   - Login URL (Radiant Admin app only)
   - Temporary password
   - MFA setup instructions
   - Requirement: must add & verify phone number
    ↓
4. On first login:
   - Force password change
   - Force MFA enrollment
   - Force phone number addition + verification
   - Status changes: 'pending_setup' → 'active'
   - Default SENTINEL routes created:
     - SEV 1-2 → verified phone (SMS + voice)
     - SEV 1-3 → verified email
     - SEV 1-5 → in-app notification
```

### 4.2 Adding More System Admins

Only an active `super_admin` can create new system admins:

```
Radiant Admin Dashboard → Administrators page
    ↓
POST /api/admin/system-admins
  Authorization: Bearer <Pool B token>
  Body: { email, displayName, role, sendInvite: true }
    ↓
1. requireSuperAdmin(ctx) — only super_admin can create
   (admin/operator/auditor can only be created by super_admin)
    ↓
2. Create Cognito user in Pool B (temp password, force change)
    ↓
3. INSERT INTO system_admins (role = requested_role)
    ↓
4. Audit log: 'admin_created'
    ↓
5. Send invitation email with temp credentials
    ↓
6. New admin completes setup (password + MFA + phone verification)
```

### 4.3 Safeguards

- **Cannot delete the last `super_admin`** — at least one must always exist
- **Cannot self-demote** if you're the last `super_admin`
- **MFA is mandatory** for all system admin roles (no exceptions)
- **Phone verification is mandatory** for SEV 1-2 alert routing
- **Session timeout**: 30 min inactive, 8 hour absolute (configurable)
- **IP allowlisting** (optional): restrict admin API access to known IPs
- **Failed login lockout**: 5 failures → 15 min lockout, 10 failures → 1 hour, 20 → deactivated (requires another super_admin to reactivate)

---

## 5. Service Layer Firewall

### 5.1 Separate API Gateway Authorizers

```
Admin API Gateway                 Tenant API Gateway
├── Authorizer: Pool B            ├── Authorizer: Pool A
├── Routes: /api/admin/*          ├── Routes: /api/thinktank/*
│                                 │           /api/curator/*
│                                 │           /api/genesis/*
│                                 │           /api/dojo/*
│                                 │           /api/cato/*
│                                 │
│ Rejects Pool A tokens           │ Rejects Pool B tokens
│ (tenant users/admins            │ (system admins cannot
│  cannot access admin API)       │  access consumer apps)
```

### 5.2 Middleware Changes

**New**: `system-admin-auth.ts` — replaces system admin path in `admin-role-guard.ts`

```typescript
// Extracts from Pool B JWT claims only
export function extractSystemAdminContext(event): SystemAdminContext {
  // Validates token is from Pool B (system admin pool)
  // Rejects any Pool A tokens
  // Returns: { adminId, email, role, permissions, isBootstrap }
  // NO tenantId — system admins are global
}
```

**Updated**: `admin-role-guard.ts` — system admin roles removed from tenant auth

The existing `extractAdminContext()` would no longer accept `super_admin`, `admin`, `operator`, `auditor` as valid roles. Those are now system-only. Tenant-scoped admin roles become: `TenantAdmin`, `TenantOperator` (if needed).

### 5.3 Policy Enforcement Workflow

Create `.windsurf/workflows/system-admin-isolation.md`:

```
All admin API routes MUST use extractSystemAdminContext()
All tenant API routes MUST use extractAuthContext()
System admin tokens MUST NOT be accepted by tenant API Gateway
Tenant tokens MUST NOT be accepted by admin API Gateway
System admins MUST NOT appear in any tenant-scoped table
```

---

## 6. SENTINEL Alert Integration

### 6.1 Updated Alert Resolution

`SentinelNotifierService.notifyForAlert()` needs to resolve recipients from **two sources**:

```
Alert dispatched
    ↓
┌───────────────────────────────┐
│ 1. System Admin Contacts      │  ← NEW: resolve_system_admin_contacts()
│    - Global (no tenant scope) │     Queries: system_admin_alert_routing
│    - Infrastructure alerts    │              JOIN system_admin_contacts
│    - SEV 1-2 always included  │
└──────────────┬────────────────┘
               │
┌──────────────▼────────────────┐
│ 2. Tenant Admin Contacts      │  ← EXISTING: resolve_sentinel_contacts()
│    - Tenant-scoped            │     Queries: sentinel_contact_routing
│    - Only for tenant-specific │              JOIN user_contacts
│      alerts                   │
└───────────────────────────────┘
```

### 6.2 New SQL Function

```sql
CREATE OR REPLACE FUNCTION resolve_system_admin_contacts(
  p_alert_category VARCHAR(20),
  p_severity INT
) RETURNS TABLE (
  admin_id UUID,
  contact_type contact_type,
  contact_value VARCHAR(320),
  contact_label contact_label
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    sar.admin_id,
    sar.contact_type,
    sar.contact_value,
    sar.contact_label
  FROM system_admin_alert_routing sar
  JOIN system_admins sa ON sa.id = sar.admin_id AND sa.status = 'active'
  WHERE sar.enabled = true
    AND sar.min_severity >= p_severity
    AND (sar.alert_category = p_alert_category OR sar.alert_category = '*')
  ORDER BY sar.contact_type, sar.admin_id;
END;
$$ LANGUAGE plpgsql STABLE;
```

### 6.3 Notifier Service Changes

```typescript
// sentinel-notifier.service.ts — updated notifyForAlert()

// ALWAYS resolve system admin contacts (global, no tenant scope)
const systemAdminContacts = await this.contactService.resolveSystemAdminContacts(
  alert.category, alert.severity,
);
for (const contact of systemAdminContacts) {
  const n = await this.dispatchToRoutedContact(contact, alert, incident);
  if (n) notifications.push(n);
}

// ALSO resolve tenant-specific admin contacts (if alert has tenant scope)
if (alert.tenantScope) {
  const tenantContacts = await this.contactService.resolveContactsForAlert(
    alert.tenantScope, alert.category, alert.severity,
  );
  for (const contact of tenantContacts) { ... }
}
```

---

## 7. What Gets Removed

| Item | Action |
|------|--------|
| `canAccessAllApps` permission | **Remove** — system admins don't access consumer apps |
| `canAccessGrantedApps` permission | **Remove** — already deprecated |
| `admin_app_access` table | **Remove** — system admins access Radiant Admin only; tenant admins manage their own app access |
| `super_admin` in `thinktank-auth.ts` ADMIN_ROLES | **Remove** — system admin roles must not work in tenant auth |
| `super_admin` granting all 6 app IDs in `assignRole()` | **Remove** — replaced by Pool B token → Admin API GW only |
| `admin_role_assignments.tenant_id` requirement for system admins | **Remove** — system admins are global (moved to `system_admins` table) |

---

## 8. What Gets Preserved

| Item | Status |
|------|--------|
| `SystemAdminRole` type (`super_admin`, `admin`, `operator`, `auditor`) | **Kept** — moved to `system_admins.role` |
| `SystemAdminPermissionSet` (24 permissions) | **Kept** — still used by `requirePermission()` |
| `SYSTEM_ADMIN_PERMISSIONS` matrix | **Kept** — minus `canAccessAllApps` and `canAccessGrantedApps` |
| Contact verification flow (6-digit code, bcrypt, rate limiting) | **Kept** — reused for `system_admin_contacts` |
| SENTINEL contact routing pattern | **Kept** — duplicated for system-level routing |
| Admin role audit logging | **Kept** — moved to `system_admin_audit_log` |
| Bootstrap admin flow | **Kept** — enhanced with mandatory phone verification |
| Profile fields (timezone, locale, display_name) | **Kept** — embedded in `system_admins` table |

---

## 9. Migration Plan

### Phase 1: Schema (Non-Breaking)

1. Create new tables: `system_admins`, `system_admin_contacts`, `system_admin_alert_routing`, `system_admin_audit_log`
2. Create Cognito User Pool B for system admins
3. Migrate existing `super_admin`/`admin`/`operator`/`auditor` rows from `admin_role_assignments` → `system_admins`
4. Migrate their contacts from `user_contacts` → `system_admin_contacts`
5. Migrate their SENTINEL routing from `sentinel_contact_routing` → `system_admin_alert_routing`

### Phase 2: Auth (Breaking)

6. Create new `system-admin-auth.ts` middleware
7. Add Pool B authorizer to Admin API Gateway
8. Update `admin-role-guard.ts` to use `extractSystemAdminContext()`
9. Update Radiant Admin Dashboard login to authenticate against Pool B
10. Update SENTINEL notifier to resolve from both tables

### Phase 3: Cleanup

11. Remove system admin roles from `thinktank-auth.ts` ADMIN_ROLES
12. Remove `canAccessAllApps` and `canAccessGrantedApps` from permission set
13. Remove `admin_app_access` table (or repurpose for tenant admin app grants only)
14. Drop migrated rows from `admin_role_assignments` where role was system-level
15. Update Swift Deployer to create bootstrap admin in Pool B

### Phase 4: Policy

16. Create `.windsurf/workflows/system-admin-isolation.md` enforcement policy
17. Update `RADIANT-ADMIN-GUIDE.md` Section 90+ with new system admin architecture
18. Update `RADIANT-PLATFORM-ARCHITECTURE.md` with dual-plane diagram

---

## 10. Impact Analysis

### 10.1 Files Requiring Changes

| File | Change |
|------|--------|
| `shared/types/user-profile.types.ts` | Remove `canAccessAllApps`, `canAccessGrantedApps`; add system admin types |
| `shared/middleware/admin-role-guard.ts` | Replace `extractAdminContext()` with Pool B validation; remove `AdminRoleService.getAppAccess()` |
| `shared/auth.ts` | Remove system admin roles from `isAdmin`/`isSuperAdmin` checks |
| `auth/thinktank-auth.ts` | Remove `super_admin`, `admin`, `operator`, `auditor` from `ADMIN_ROLES` |
| `shared/services/sentinel-notifier.service.ts` | Add system admin contact resolution |
| `shared/services/contact-verification.service.ts` | Add `resolveSystemAdminContacts()`, `addSystemAdminContact()`, etc. |
| `admin/handler.ts` | Route system admin management endpoints |
| `admin/invitations.ts` | Separate system admin invitation flow |
| `admin/approvals.ts` | Update admin references |
| `infrastructure/lib/stacks/admin-stack.ts` | Add Pool B, update authorizer |
| `apps/admin-dashboard/` | Update login flow, admin management pages |
| Swift Deployer | Update bootstrap to use Pool B |

### 10.2 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Existing system admins locked out during migration | HIGH | Phase 1 is additive; old auth works until Phase 2 cutover |
| SENTINEL alerts not delivered during transition | HIGH | Dual-resolution (both tables) in Phase 2 before cleanup |
| Bootstrap admin unavailable | HIGH | Migration script copies existing bootstrap admin to new table |
| Cognito Pool B misconfigured | MEDIUM | Terraform/CDK creates Pool B with same security settings as Pool A |

---

## 11. Open Questions

1. **Tenant Admin roles**: Should `TenantAdmin` and `TenantOperator` remain in the shared Cognito Pool A, or should they also get their own pool? (Recommendation: keep in Pool A — they are tenant-scoped by definition.)

2. **Cross-tenant visibility**: Should system admins be able to impersonate tenant users for debugging? If so, a controlled "assume role" mechanism with audit logging would be needed.

3. **GDPR**: System admin data is not tenant-scoped, so tenant GDPR erasure requests don't apply. Should there be a separate system admin data retention policy?

4. **Disaster recovery**: If the system admin Cognito pool is compromised, what's the recovery path? Consider an offline break-glass mechanism (e.g., encrypted recovery key stored in AWS Secrets Manager).

---

*Document Version: 1.0.0*
*RADIANT Platform v4.18.0*
