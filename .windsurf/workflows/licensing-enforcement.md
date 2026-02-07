---
description: Policy - All features must enforce licensing via middleware. Regulatory features require compliance licenses. Bidirectional enforcement for new apps AND new licenses.
---

# Licensing Enforcement Policy (Bidirectional)

> **CRITICAL**: This policy enforces licensing in BOTH directions:
> - **Direction A**: New app → MUST implement licensing, roles, admin UI, sidebar entry
> - **Direction B**: New license type → MUST propagate to all existing apps, APIs, and admin UIs

## When This Applies

This policy applies when:
- Adding new API endpoints to ANY app
- Adding new features to any user-facing app
- Adding new regulatory/compliance features
- **Adding new apps to the platform** (Direction A)
- **Adding new license types to `license_catalog`** (Direction B)
- Modifying user invitation or provisioning flows
- Any change that could be gated by a license
- Any change to roles or permissions

## Rules

### 1. Every API Endpoint Must Check Licensing

All API endpoints in user-facing apps MUST use the license middleware:

```typescript
const license = await checkLicense(user.tenantId, user.userId, {
  app_id: 'think_tank',     // Which app
  check_seat: true,          // Verify user has a seat
  check_feature: true,       // If feature-gated
  feature_code: 'hipaa',     // Which feature license
});
if (!license.allowed) return forbidden(license);
```

### 2. Regulatory Features Are Licensed

ALL regulatory standards (HIPAA, GDPR, SOC2, CCPA, ISO 27001, etc.) are licensable features:
- If tenant has no license → feature DISABLED
- UI shows: "Contact Think Tank support at support@thinktank.app"
- API returns 403 with `LICENSE_REQUIRED` error
- NEVER enable compliance features without checking the license

### 3. Seat Licensing Per App

- Each app has its own seat count per tenant
- Active users consume seats; deactivated users FREE seats
- Invitation checks seat availability BEFORE creating user
- Think Tank seat granted by default; other apps require explicit activation

### 4. Unlicensed Feature UI Pattern

When a feature requires a license the tenant doesn't have:

```
⚠ [Feature Name]

This feature requires a [LICENSE_NAME] license.

To add this license, contact Think Tank support at support@thinktank.app

[Contact Support]
```

### 5. Direction A: Adding New Apps (COMPREHENSIVE)

When adding a new app to the RADIANT platform, ALL of the following MUST be completed:

#### Database & Backend (Required)
1. Add `seat:<app_id>` row to `license_catalog` table (migration)
2. Add `has_access_<app_id>` boolean to `users` table (migration)
3. All API endpoints use license middleware with new `app_id`
4. Add Lambda handler in `lambda/admin/<app>.ts` with standard admin API pattern
5. Add CDK stack or Lambda function config in `packages/infrastructure/`

#### Admin Dashboard (Required)
6. Add admin page in `apps/admin-dashboard/app/(dashboard)/<app>/page.tsx`
7. Add sidebar entry in `components/layout/sidebar.tsx` with appropriate icon and section
8. Ensure page has full detail view (NOT just a widget/summary)

#### User Management (Required)
9. Add to invitation UI in Think Tank Tenant Admin (app selection checkboxes)
10. Add to user profile / app access toggles
11. Add role definitions for the new app (at minimum: viewer, user, admin)

#### Swift Deployer (Required)
12. Add `RadiantApplication.<appId>` to Swift deployer app model
13. Add URL configuration (subdomain, path, icon, tier)

#### Settings & Configuration (Required)
14. Add URL field in Admin Dashboard Settings → URLs page
15. Add Quick Link in settings page

#### Documentation (Required)
16. Update `docs/THINKTANK-LICENSING-MODEL.md` (license catalog, tier defaults)
17. Update `docs/THINKTANK-TENANT-ADMIN-GUIDE.md` (invitation flow, app access)
18. Update `CHANGELOG.md`
19. Update `docs/RADIANT-ADMIN-GUIDE.md` (new admin section)
20. Update `docs/RADIANT-PLATFORM-ARCHITECTURE.md` (new pages, APIs, routes)

### 6. Direction B: Adding New License Types (COMPREHENSIVE)

When adding a new license type (feature, compliance, add-on), ALL of the following MUST be completed:

#### Database (Required)
1. Add row to `license_catalog` table with: `license_type`, `display_name`, `description`, `category`, `tier_defaults`
2. If regulatory: set `is_regulatory = true` and `regulatory_standard` code

#### API Enforcement (Required)
3. Add license check to ALL API endpoints that should be gated by this license
4. If the license gates existing endpoints, add middleware checks to those existing handlers
5. Verify 403 `LICENSE_REQUIRED` response format is correct

#### UI Gating — ALL Apps (Required)
6. Add UI gating in Think Tank (if user-facing feature)
7. Add UI gating in Admin Dashboard (if admin-facing feature)
8. Add UI gating in any other affected apps (Curator, Dojo, Cato Trainer, Genesis)
9. Show unlicensed feature pattern (Section 4 above) in ALL affected UIs
10. Add license to Tenant Admin → License Management page

#### Admin Dashboard (Required)
11. If this license enables a new admin feature, create a detail page (NOT just a widget)
12. Add sidebar entry for the new detail page
13. Add license status indicator in Compliance → Regulatory Standards page (if regulatory)

#### Documentation (Required)
14. Update `docs/THINKTANK-LICENSING-MODEL.md`
15. Update `docs/THINKTANK-TENANT-ADMIN-GUIDE.md`
16. Update tier defaults documentation
17. Update `CHANGELOG.md`

### 7. Admin Page Requirement

> **EVERY admin-configurable feature MUST have:**
> 1. A dedicated detail page (not just a widget on another page)
> 2. A sidebar entry in `components/layout/sidebar.tsx`
> 3. Widget summaries are fine, but MUST link to the detail page

See also: `/.windsurf/workflows/admin-page-required.md`

### 8. Role Propagation

When adding new apps or features:
- New apps MUST define roles: `viewer`, `standard_user`, `admin` at minimum
- Roles must be added to the `users` soft permissions JSONB structure
- Role checks must be in API middleware
- Admin Dashboard must show role management for the new app
- Think Tank Tenant Admin must show role assignment in user management

## Verification Checklist

Before marking any licensing-related task complete:

```
Direction A (New App):
□ license_catalog entry with seat:<app_id>
□ users table has_access_<app_id> column
□ All API endpoints check licensing
□ Admin dashboard page exists (detail, not widget)
□ Sidebar entry exists
□ Invitation UI updated
□ Swift Deployer model updated
□ Settings URLs page updated
□ All documentation updated

Direction B (New License):
□ license_catalog entry added
□ API endpoints gated
□ UI gating in ALL affected apps
□ Unlicensed pattern shown correctly
□ Tenant Admin license management updated
□ Admin dashboard detail page (if admin feature)
□ Sidebar entry (if new page)
□ All documentation updated
```

## Key Documents

- **Licensing Model**: `docs/THINKTANK-LICENSING-MODEL.md`
- **ADR**: `docs/architecture/ADR-USER-PROVISIONING-SEAT-LICENSING-AUTH.md`
- **Tenant Admin Guide**: `docs/THINKTANK-TENANT-ADMIN-GUIDE.md`
- **Admin Page Policy**: `/.windsurf/workflows/admin-page-required.md`
- **New App Onboarding**: `/.windsurf/workflows/new-app-onboarding.md`

## Support Contact

All "contact support" messages MUST use: **support@thinktank.app**
