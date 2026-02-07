---
description: Policy - Complete checklist for adding a new app to RADIANT. Covers licensing, roles, admin UI, Swift Deployer, and documentation.
---

# New App Onboarding Policy

## When This Applies

This policy applies when adding ANY new application to the RADIANT platform (e.g., Think Tank, Curator, Dojo, Cato Trainer, Genesis, or future apps).

## Complete Checklist

### Phase 1: Database & Schema

1. **Migration**: Create migration file adding:
   - `seat:<app_id>` row in `license_catalog`
   - `has_access_<app_id> BOOLEAN NOT NULL DEFAULT false` column on `users` table
   - Any app-specific tables needed

2. **Seed Data**: Add default license entries for each tier:
   - Starter: X seats
   - Professional: Y seats
   - Enterprise: Z seats

### Phase 2: Backend Services

3. **Lambda Handler**: Create `lambda/admin/<app>.ts` with standard admin API pattern
4. **Service Layer**: Create service(s) in `lambda/shared/services/<app>/`
5. **License Middleware**: ALL endpoints MUST check licensing:
   ```typescript
   const license = await checkLicense(tenantId, userId, { app_id: '<app_id>', check_seat: true });
   if (!license.allowed) return jsonResponse(403, { error: 'LICENSE_REQUIRED', ... });
   ```
6. **CDK Integration**: Add Lambda function config or CDK stack

### Phase 3: Admin Dashboard (MANDATORY)

7. **Detail Page**: Create `apps/admin-dashboard/app/(dashboard)/<app>/page.tsx`
   - Full configuration and management UI
   - NOT just a widget — must be a complete detail page
8. **Sidebar Entry**: Add to `components/layout/sidebar.tsx` in appropriate section
9. **Settings URL**: Add URL configuration field in Settings → URLs page

### Phase 4: User Management

10. **Invitation Flow**: Add app checkbox to Think Tank Tenant Admin invitation UI
11. **User Profile**: Add app access toggle to user management
12. **Roles**: Define at minimum: `viewer`, `standard_user`, `admin`
13. **Permissions**: Add to `users.soft_permissions` JSONB structure

### Phase 5: Swift Deployer

14. **App Model**: Add `RadiantApplication.<appId>` to Swift app model
15. **URL Config**: Subdomain, path, icon, color, tier requirement
16. **Deployment**: Include in deployment manifest

### Phase 6: Documentation (ALL Required)

17. `CHANGELOG.md` — New app entry
18. `docs/THINKTANK-LICENSING-MODEL.md` — License catalog, tier defaults
19. `docs/THINKTANK-TENANT-ADMIN-GUIDE.md` — Invitation flow, app access
20. `docs/RADIANT-ADMIN-GUIDE.md` — New admin section with API reference
21. `docs/RADIANT-PLATFORM-ARCHITECTURE.md` — Pages, APIs, routes, migrations
22. `docs/ENGINEERING-IMPLEMENTATION-VISION.md` — Architecture section
23. `docs/sections/SECTION-07-DATABASE-SCHEMA.md` — If new tables added

### Phase 7: Verification

```
□ App appears in license_catalog
□ Users can be invited with app access
□ API endpoints enforce licensing
□ Admin dashboard page exists with full functionality
□ Sidebar entry exists and navigates correctly
□ Settings URL configuration works
□ Swift Deployer shows the app
□ Unlicensed tenants see "contact support" message
□ All documentation updated
□ No widget-only implementations
```

## Anti-Patterns (NEVER Do These)

- ❌ Create an app without a license_catalog entry
- ❌ Create API endpoints without license middleware
- ❌ Create a widget-only summary without a detail page
- ❌ Add a detail page without a sidebar entry
- ❌ Skip the Swift Deployer integration
- ❌ Skip documentation updates
- ❌ Hardcode seat limits (use license_catalog)
- ❌ Skip role definitions
