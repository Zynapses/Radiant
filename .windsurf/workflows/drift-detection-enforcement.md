---
description: Policy - All services making model invocations MUST use drift-aware routing. No hardcoded model selection without drift checks.
---

# Drift Detection & Control Enforcement Policy

> **Version**: 1.0.0 | **Created**: February 7, 2026
> **Scope**: ALL Lambda services, ALL AI model invocations, ALL new services

## When This Policy Applies

This policy MUST be followed when:
- Creating a new service that calls `modelRouterService.invoke()`
- Creating a new service that selects or references AI models
- Modifying model selection logic in any existing service
- Adding a new app or component that uses AI models
- Creating new orchestration methods or patterns

## Architecture: How Drift Control Works

### Automatic Coverage (v7.37.0)

The `ModelRouterService.invoke()` method includes **two-phase drift handling**:

1. **Phase 1**: Proactive selection via `DriftAwareWeightingService.isModelSafe()` — checks if the requested model is safe for the `orchestrator` app profile. If unsafe, selects a better model via `getBestModel()`.
2. **Phase 2**: Legacy correction fallback via `DriftCorrectionService.getBestModel()` — quarantine/fallback/temperature/prompt corrections.

**This means**: Any service that calls `modelRouterService.invoke()` with a `tenantId` in the request automatically gets drift-aware model selection. **No additional wiring needed.**

### Genesis Feedback Loop (v7.37.0)

After every invocation (success or failure), telemetry is reported to `DriftAwareWeightingService.recordInvocationTelemetry()`. This feeds into:
- `getGenesisDriftFeedback()` — aggregated health scores
- `GenesisService.isDriftHealthyForStage()` — blocks stage advancement on poor health

**52+ services now feed drift telemetry into Genesis gate decisions automatically.**

## Requirements for New Services

### MUST DO

1. **Always pass `tenantId`** in `ModelRequest` when calling `modelRouterService.invoke()`:
   ```typescript
   const response = await modelRouterService.invoke({
     modelId: 'anthropic/claude-3-haiku',
     messages: [...],
     tenantId: context.tenantId,  // ← REQUIRED for drift checks
   });
   ```

2. **Never bypass `modelRouterService`** for model invocations. All model calls MUST go through the router to get drift protection and telemetry reporting.

3. **If creating a new app component** that needs its own drift sensitivity profile, add it to `APP_WEIGHT_PROFILES` in `drift-aware-weighting.service.ts`:
   ```typescript
   myNewApp: {
     app: 'myNewApp',
     driftWeight: 0.25,      // How much this app cares about drift
     qualityWeight: 0.30,
     latencyWeight: 0.15,
     costWeight: 0.15,
     availabilityWeight: 0.15,
     minAcceptableDriftScore: 0.3,
     preferStableModels: false,
   },
   ```
   Also add the app name to the `RadiantApp` union type.

4. **If a service selects models independently** (like Cato pipeline executor or AGI orchestrator), it MUST use `DriftAwareWeightingService` directly:
   ```typescript
   import { driftAwareWeightingService } from './drift-aware-weighting.service';

   const best = await driftAwareWeightingService.getBestModel(
     tenantId,
     'myApp',         // app profile
     'code_generation' // task category
   );
   ```

### MUST NOT

- ❌ Hardcode model IDs without drift fallback (e.g., `return 'anthropic/claude-3-5-sonnet-20241022'`)
- ❌ Call LLM APIs directly without going through `modelRouterService`
- ❌ Omit `tenantId` from `ModelRequest` — this disables ALL drift protection
- ❌ Catch and swallow drift-related errors silently
- ❌ Create new model selection logic that doesn't consult drift scores

## Files Reference

| File | Purpose |
|------|---------|
| `lambda/shared/services/drift-aware-weighting.service.ts` | Unified drift API — model recommendations, safety checks, telemetry, Genesis feedback |
| `lambda/shared/services/drift-detection.service.ts` | Statistical drift tests (KS, PSI, χ², embedding distance) |
| `lambda/shared/services/drift-correction.service.ts` | Quarantine, fallback, weight penalties, temperature/prompt corrections |
| `lambda/shared/services/model-router.service.ts` | Two-phase drift handling in `invoke()`, telemetry reporting |
| `lambda/shared/services/cato/genesis.service.ts` | `isDriftHealthyForStage()` — blocks advancement on poor health |
| `migrations/V2026_02_07_014__drift_invocation_telemetry.sql` | Telemetry table (partitioned, RLS, cleanup function) |
| `apps/admin-dashboard/app/(dashboard)/orchestration/drift-control/page.tsx` | Admin UI for drift control |

## App Weight Profiles (Current)

| App | Drift | Quality | Latency | Cost | Avail | Min Drift | Prefer Stable |
|-----|-------|---------|---------|------|-------|-----------|---------------|
| Genesis | 0.35 | 0.30 | 0.10 | 0.10 | 0.15 | 0.50 | Yes |
| Cato | 0.30 | 0.25 | 0.15 | 0.15 | 0.15 | 0.40 | Yes |
| Cortex | 0.30 | 0.35 | 0.10 | 0.10 | 0.15 | 0.45 | Yes |
| Omega | 0.40 | 0.25 | 0.10 | 0.10 | 0.15 | 0.50 | Yes |
| Orchestrator | 0.25 | 0.30 | 0.15 | 0.15 | 0.15 | 0.30 | No |
| Think Tank | 0.20 | 0.30 | 0.25 | 0.10 | 0.15 | 0.30 | No |
| Curator | 0.25 | 0.35 | 0.10 | 0.15 | 0.15 | 0.35 | No |

## Genesis Gate Thresholds (Per Stage)

| Stage | Min Avg Drift | Max Quarantined | Min Health Score | Max Failure Rate | Max Reroute Rate |
|-------|--------------|-----------------|------------------|-----------------|-----------------|
| EMBRYONIC | 0.30 | 5 | 0.20 | 30% | 50% |
| NASCENT | 0.40 | 3 | 0.35 | 20% | 40% |
| DEVELOPING | 0.50 | 2 | 0.50 | 15% | 30% |
| MATURING | 0.60 | 1 | 0.65 | 10% | 20% |
| MATURE | 0.70 | 0 | 0.80 | 5% | 10% |

## Verification Checklist

Before marking any task complete that involves model invocations:

- [ ] All `modelRouterService.invoke()` calls include `tenantId`
- [ ] No new hardcoded model IDs without drift fallback
- [ ] No direct LLM API calls bypassing the model router
- [ ] New app components have weight profiles if they need custom drift sensitivity
- [ ] Genesis gate thresholds reviewed if adding safety-critical features
- [ ] Admin UI updated if new app profiles added
- [ ] Documentation updated per `/docs-update-all` policy
