---
description: Policy - Every admin feature MUST have a dedicated detail page and sidebar entry. No widget-only features allowed.
---

# Admin Page Required Policy

## The Rule

> **EVERY admin-configurable feature MUST have:**
> 1. A dedicated detail page in `apps/admin-dashboard/app/(dashboard)/`
> 2. A sidebar entry in `components/layout/sidebar.tsx`
> 3. Widget summaries on other pages are ENCOURAGED but MUST link to the detail page

## When This Applies

This policy applies when:
- Creating any new admin API endpoint
- Adding any new Lambda handler in `lambda/admin/`
- Adding any new feature that administrators can configure, monitor, or manage
- Adding any new database tables that administrators interact with
- Creating any widget or summary card on a dashboard page

## Requirements

### 1. Detail Page (Required)

Every admin feature MUST have a dedicated page at an appropriate route:

```
apps/admin-dashboard/app/(dashboard)/<section>/<feature>/page.tsx
```

The page MUST include:
- Full configuration controls (not just read-only display)
- Data tables/lists with filtering and sorting where applicable
- Action buttons (create, update, delete, toggle) where applicable
- Status indicators and health checks where applicable
- Links back to related pages

### 2. Sidebar Entry (Required)

Every detail page MUST have a corresponding entry in:
```
apps/admin-dashboard/components/layout/sidebar.tsx
```

The entry MUST:
- Be placed in the correct section (AI & Models, Orchestration, Security, etc.)
- Have an appropriate Lucide icon
- Have a clear, concise name (max 20 characters recommended)
- Use the correct href matching the page route

### 3. Widget Links (Required for Widgets)

If a feature has a widget/summary card on a parent or dashboard page:
- The widget MUST include a "View Details" or similar link to the detail page
- The widget MUST NOT be the only way to access the feature
- The detail page MUST contain ALL functionality, not just what the widget shows

### 4. No Widget-Only Features

**NEVER** implement a feature as only a widget on another page. This creates:
- ❌ Hidden functionality that users can't find
- ❌ Incomplete access to configuration
- ❌ Lost detail when the parent page changes
- ❌ No deep-link capability for documentation/support

## Verification

Before completing any admin feature implementation:

```
□ Detail page exists at correct route
□ Page has full CRUD/configuration capabilities
□ Sidebar entry exists with correct icon and section
□ If widgets exist, they link to the detail page
□ Page is accessible via sidebar navigation
□ Page follows existing dashboard design patterns
```

## Existing Violations (To Be Fixed)

The following features currently lack sidebar entries despite having pages:
- Platform features: bedrock-settings, cartridge-operations, crucible, deployer-sync, livs, organism, pki, rnir, snapshots, system-cartridges, uds, vault
- Orchestration: consensus, inference-cache, model-weights
- Memory: anticipatory, retention
- Cato: cognitive-precision, governance, livs-policy, safety, war-room
- Settings: collaboration, connected-apps, security, urls
- Other: api-keys, axiom, blackboard, cato-twilight, domain-experts, model-registry, neural-operations, safety-matrix

The following admin APIs lack any page:
- council, mls, dynamic-reports, scheduled-reports, cato-dialogue, orchestration-user-templates, state-registry
