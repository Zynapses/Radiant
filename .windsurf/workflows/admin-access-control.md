---
description: Policy - Admin features MUST enforce role-based access control. All new admin routes and features MUST check permissions via the admin role guard.
---

# Admin Access Control Policy (v7.38.0)

## When This Policy Applies

This policy applies whenever you:
- Add a new admin dashboard page or route
- Add a new admin API endpoint
- Modify admin authentication or authorization
- Add a new Radiant-side app that system admins can access
- Modify the sidebar or navigation in the admin dashboard

## Architecture: Dual Identity Plane

**CRITICAL**: RADIANT has TWO completely separate identity domains:

### System Admin Plane (Pool B — `system_admins` table)

| Role | Level | Access | Description |
|------|-------|--------|-------------|
| `super_admin` | 4 | Radiant Admin only | Full platform control, can create other system admins |
| `admin` | 3 | Radiant Admin only | Platform infrastructure admin |
| `operator` | 2 | Radiant Admin only | Operations — deploy, models, monitoring |
| `auditor` | 1 | Radiant Admin only | Read-only — audit logs, reports |

- Authenticates via **Cognito Pool B** (system-admins pool)
- Uses `extractSystemAdminContext()` from `system-admin-auth.ts`
- **NO tenant_id** — system admins are global
- **CANNOT** access Think Tank, Curator, Genesis, Dojo, or any consumer app
- Data stored in `system_admins` table (no RLS, no tenant scope)

### Tenant Plane (Pool A — `administrators` + `users` tables)

| Role | Description |
|------|-------------|
| `TenantAdmin` / `tenant_admin` | Full tenant control — auto-assigned to first sign-up user |
| `tenant_owner` | Ownership rights (billing, deletion) |
| `standard_user` | Regular user |
| `viewer` | Read-only user |

- Authenticates via **Cognito Pool A** (tenant user pool)
- Uses `extractAuthContext()` from `shared/auth.ts`
- **CANNOT** access Radiant Admin API
- Tenant-scoped with RLS on all tables

### Service Layer Firewall

```
Admin API Gateway → Authorizer: Pool B tokens ONLY
Tenant API Gateway → Authorizer: Pool A tokens ONLY
```

**Pool B tokens are REJECTED by tenant API Gateway.**
**Pool A tokens are REJECTED by admin API Gateway.**

## Requirements

### 1. System Admin API Endpoints (Radiant Admin)
- ALL admin API handlers MUST import from `system-admin-auth.ts`
- Extract context: `const ctx = extractSystemAdminContext(event);`
- Check permission: `const guard = requireSystemPermission(ctx, 'canManageModels'); if (guard) return guard;`
- Use `requireSystemSuperAdmin(ctx)` for super_admin-only operations
- NEVER skip permission checks, even for "read-only" endpoints
- NEVER accept Pool A tokens in admin API handlers

### 2. Tenant API Endpoints (Consumer Apps)
- ALL tenant API handlers MUST import from `shared/auth.ts`
- Use `extractAuthContext(event)` — returns tenant-scoped context
- System admin roles (`super_admin`, `admin`, `operator`, `auditor`) are **NOT recognized** here
- Only `TenantAdmin` and `tenant_admin` are valid admin roles in tenant context

### 3. Next.js Middleware (Admin Dashboard)
- Route restrictions defined in `ROLE_RESTRICTED_ROUTES` in `middleware.ts`
- Middleware extracts `adminRole` from Pool B JWT `custom:admin_role` claim
- Insufficient permissions redirect to `/permission-denied`

### 4. SENTINEL Alert Routing
- System admin contacts resolved via `resolveSystemAdminContacts()` (global, no tenant)
- Tenant admin contacts resolved via `resolveContactsForAlert()` (tenant-scoped)
- Both are called for every alert — system admins ALWAYS get notified

### 5. Bootstrap Flow
- First system admin created during deployment (Swift Deployer or CLI)
- Uses `bootstrap_system_admin()` SQL function → Cognito Pool B
- Status starts as `pending_setup` → force password change + MFA + phone verification → `active`
- Only `super_admin` can create subsequent system admins
- DB trigger prevents removing/demoting the last `super_admin`

## Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types/user-profile.types.ts` | Role types, permission matrix |
| `packages/infrastructure/migrations/V2026_02_07_015__system_admin_separation.sql` | System admin tables, functions, migration |
| `packages/infrastructure/lambda/shared/middleware/system-admin-auth.ts` | **NEW** Pool B auth middleware + SystemAdminService |
| `packages/infrastructure/lambda/shared/middleware/admin-role-guard.ts` | Legacy compat, re-exports system admin utilities |
| `packages/infrastructure/lambda/shared/auth.ts` | Tenant auth (Pool A only) |
| `packages/infrastructure/lambda/auth/thinktank-auth.ts` | Tenant admin login (Pool A only) |
| `packages/infrastructure/lambda/shared/services/sentinel-notifier.service.ts` | Dual-resolution alert dispatch |
| `packages/infrastructure/lambda/shared/services/contact-verification.service.ts` | System admin contact CRUD + verification |
| `packages/infrastructure/lib/stacks/admin-stack.ts` | CDK: Pool B creation |

## Permission Matrix Reference

| Permission | super_admin | admin | operator | auditor |
|------------|:-----------:|:-----:|:--------:|:-------:|
| canCreateAdmins | ✅ | ❌ | ❌ | ❌ |
| canDeleteAdmins | ✅ | ❌ | ❌ | ❌ |
| canChangeAdminRoles | ✅ | ❌ | ❌ | ❌ |
| canCreateSuperAdmins | ✅ | ❌ | ❌ | ❌ |
| canManageSystemAdmins | ✅ | ❌ | ❌ | ❌ |
| canDeleteTenants | ✅ | ❌ | ❌ | ❌ |
| canManageSecurityPolicies | ✅ | ❌ | ❌ | ❌ |
| canManageSentinel | ✅ | ❌ | ❌ | ❌ |
| canCreateTenants | ✅ | ✅ | ❌ | ❌ |
| canManageTenants | ✅ | ✅ | ❌ | ❌ |
| canManageUsers | ✅ | ✅ | ❌ | ❌ |
| canManageSystemConfig | ✅ | ✅ | ❌ | ❌ |
| canManageBilling | ✅ | ✅ | ❌ | ❌ |
| canManageModels | ✅ | ✅ | ✅ | ❌ |
| canManageProviders | ✅ | ✅ | ✅ | ❌ |
| canDeploy | ✅ | ✅ | ✅ | ❌ |
| canAccessSentinel | ✅ | ✅ | ✅ | ❌ |
| canViewAuditLogs | ✅ | ✅ | ✅ | ✅ |
| canExportAuditLogs | ✅ | ✅ | ❌ | ✅ |

## Checklist

```
□ New admin route added to ROLE_RESTRICTED_ROUTES in middleware.ts?
□ Lambda handler uses extractSystemAdminContext + requireSystemPermission?
□ Sidebar item hidden for unauthorized roles?
□ Super admin operations use requireSystemSuperAdmin()?
□ System admin data stored in system_admins table (NOT administrators)?
□ System admin contacts in system_admin_contacts (NOT user_contacts)?
□ No tenant_id in system admin code paths?
□ Pool A tokens REJECTED by admin API handlers?
□ Pool B tokens REJECTED by tenant API handlers?
□ Cannot delete last super_admin enforced?
□ Audit log entry created for role changes?
```
