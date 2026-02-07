---
description: Policy - Every user-facing RADIANT app MUST integrate the Delight UX system. No exceptions.
---

# Delight UX Policy

## Overview

The **Delight System** is RADIANT's personality and UX experience layer. It provides pre/during/post execution touches that make every app feel alive, empathetic, and engaging. This is NOT optional — it is a core differentiator.

## When This Policy Applies

This policy MUST be enforced when:

1. **Creating a new user-facing app** — MUST integrate `@radiant/delight-ui`
2. **Adding a new user action** (save, delete, submit, etc.) — MUST trigger delight at appropriate injection points
3. **Adding error handling UI** — MUST use delight error recovery messages instead of generic errors
4. **Adding loading/progress states** — MUST use delight pre/during execution messages
5. **Modifying app providers** — MUST NOT remove `RadiantDelightProvider`

## Required Integration Steps

### For New Apps

1. Add `@radiant/delight-ui` to `package.json`:
   ```json
   "@radiant/delight-ui": "workspace:*"
   ```

2. Ensure peer dependencies are installed:
   - `framer-motion` (>=10.0.0)
   - `lucide-react` (>=0.300.0)

3. Create an `AppDelightConfig` in `providers.tsx`:
   ```typescript
   import { RadiantDelightProvider, type AppDelightConfig } from '@radiant/delight-ui';

   const APP_DELIGHT_CONFIG: AppDelightConfig = {
     appId: 'your_app_id',
     appName: 'Your App Name',
     defaultPersonalityMode: 'auto',
     defaultSoundEnabled: false,
     greetingMessages: [...],       // Page load / session start
     preExecutionMessages: [...],   // Before operations
     duringExecutionMessages: [...], // During long operations
     postExecutionMessages: [...],  // After successful operations
     errorRecoveryMessages: [...],  // On errors
     milestoneMessages: [...],      // Achievements / milestones
     customInjectionPoints: { ... }, // App-specific events
   };
   ```

4. Wrap the app's children with `<RadiantDelightProvider>` in `providers.tsx`

5. In components, use the hook to trigger delight:
   ```typescript
   import { useRadiantDelight } from '@radiant/delight-ui';

   const { triggerDelight, showDelightToast } = useRadiantDelight();

   // On save success
   triggerDelight('action_complete');

   // On error
   triggerDelight('error_recovery');

   // On milestone
   triggerDelight('milestone');

   // Custom app-specific event
   showDelightToast('Custom message', '🎯');
   ```

### For Existing Apps

All apps listed below MUST have Delight integrated:

| App | Config Location | Status |
|-----|----------------|--------|
| Think Tank (consumer) | `apps/thinktank/app/providers.tsx` + `components/axiom/DelightSystem.tsx` | ✅ Provider + lifecycle wired (pre/during/post execution, morph sounds, settings sync) |
| Think Tank Admin | `apps/thinktank-admin/app/providers.tsx` | ✅ Provider integrated |
| Curator | `apps/curator/app/providers.tsx` | ✅ Provider + actions wired (verify, reject, correct, resolve, create, delete, ingest, sync) |
| Aurelius Dojo | `apps/dojo/app/providers.tsx` | ✅ Provider + 7 components wired (17 mutations: library, training, scenario, dialectic, decay, archytas, competency) |
| Tenant Admin | `apps/thinktank-tenant-admin/app/providers.tsx` | ✅ Provider integrated |
| Genesis | `apps/genesis/` | Partial (has personality in GenesisForge) |
| Admin Dashboard | `apps/admin-dashboard/` | Has delight API routes |

## Injection Point Reference

| Injection Point | When to Trigger | Required? |
|----------------|----------------|-----------|
| `page_load` | Initial app/page render | Recommended |
| `session_start` | New user session begins | Recommended |
| `pre_execution` | Before an async operation starts | Required for long ops |
| `during_execution` | During operations >2 seconds | Required for long ops |
| `post_execution` | After successful completion | **Required** |
| `action_complete` | After save/update/delete | **Required** |
| `error_recovery` | On operation failure | **Required** |
| `milestone` | User achievement / milestone | Recommended |
| `onboarding` | First-time user experience | Recommended |
| `session_end` | User logs out / session ends | Optional |
| `idle` | No activity for extended period | Optional |

## Personality Modes

All apps MUST respect the user's chosen personality mode:

| Mode | Behavior |
|------|----------|
| `auto` | Adapts based on context (default) |
| `professional` | Clean, minimal, business-focused |
| `subtle` | Light touches, mostly informative |
| `expressive` | Engaging, helpful, enthusiastic |
| `playful` | Fun, witty, creative |

In `professional` mode, suppress non-essential messages (idle, session_start).

## Backend Integration

The backend Delight system provides:
- **Service**: `lambda/shared/services/delight.service.ts`
- **Events**: `lambda/shared/services/delight-events.service.ts`
- **Orchestration**: `lambda/shared/services/delight-orchestration.service.ts`
- **Handler**: `lambda/delight/handler.ts`
- **Admin UI**: `apps/thinktank-admin/app/(dashboard)/delight/page.tsx`

Apps can optionally call the backend API for server-managed delight messages. The `@radiant/delight-ui` package provides client-side fallback messages when the API is unavailable.

## Package Location

`packages/delight-ui/` — `@radiant/delight-ui`

## NEVER

- ❌ Create a user-facing app without Delight integration
- ❌ Show generic "Error occurred" messages — use delight error recovery
- ❌ Show plain "Loading..." — use delight pre/during execution messages
- ❌ Remove `RadiantDelightProvider` from any app
- ❌ Hardcode personality — always respect the user's mode setting
- ❌ Skip delight for admin apps — admins deserve personality too

## ALWAYS

- ✅ Wrap every app with `RadiantDelightProvider` in providers
- ✅ Trigger `action_complete` on every successful mutation
- ✅ Trigger `error_recovery` on every error
- ✅ Provide app-specific messages that match the app's domain
- ✅ Test all 5 personality modes
- ✅ Update this policy table when adding a new app
