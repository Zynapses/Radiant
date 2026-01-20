# CDK Handler Gap Analysis

**Generated**: 2026-01-19  
**Purpose**: Audit of Lambda handlers vs CDK API Gateway routes

## Executive Summary

| Category | Handlers in Code | Routed in CDK | Status |
|----------|-----------------|---------------|--------|
| `admin/*` | 56 | 56 via proxy→admin/handler.ts | ✅ OK |
| `thinktank/*` | 29 | 2 (artifact-engine only) | ⚠️ **27 MISSING** |
| `thinktank-admin/*` | 2 | 1 (via separate stack) | ✅ OK |
| `api/*` | 4 | 4 (router handles) | ✅ OK |
| Other stacks | ~50 | ~50 | ✅ OK |

## Architecture Overview

### How Admin Routes Work ✅

```
API Gateway /api/v2/admin/*
    ↓ (proxy)
admin/handler.ts (CDK: admin/handler.handler)
    ↓ (dynamic import based on path)
admin/consciousness.ts, admin/ego.ts, admin/metrics.ts, etc.
```

The admin proxy correctly routes to `admin/handler.ts`, which uses dynamic imports to delegate to 50+ sub-handlers. **This is working correctly.**

### How Think Tank Routes Work ⚠️

```
API Gateway /api/v2/thinktank/artifacts/*
    ↓ (proxy)
thinktank/artifact-engine.ts (CDK routes exist)

API Gateway /api/v2/thinktank/* (other paths)
    ↓ 
❌ NO CDK ROUTES - handlers exist but aren't exposed
```

**Problem**: 27 Think Tank handlers exist in code but have no CDK API Gateway routes.

## Missing Think Tank Routes

### Priority 1 - Core Think Tank Features (No CDK Routes)

| Handler | Purpose | CDK Status |
|---------|---------|------------|
| `thinktank/conversations.ts` | Conversation CRUD | ❌ Missing |
| `thinktank/users.ts` | User management | ❌ Missing |
| `thinktank/models.ts` | Model listing | ❌ Missing |
| `thinktank/brain-plan.ts` | AGI Brain Plan API | ❌ Missing |
| `thinktank/user-context.ts` | Persistent context | ❌ Missing |
| `thinktank/domain-modes.ts` | Domain mode config | ❌ Missing |
| `thinktank/model-categories.ts` | Model categories | ❌ Missing |
| `thinktank/ratings.ts` | User ratings | ❌ Missing |

### Priority 2 - Advanced Features (No CDK Routes)

| Handler | Purpose | CDK Status |
|---------|---------|------------|
| `thinktank/grimoire.ts` | Procedural memory | ❌ Missing |
| `thinktank/economic-governor.ts` | Cost optimization | ❌ Missing |
| `thinktank/time-travel.ts` | Time Machine | ❌ Missing |
| `thinktank/council-of-rivals.ts` | Multi-model consensus | ❌ Missing |
| `thinktank/concurrent-execution.ts` | Parallel tasks | ❌ Missing |
| `thinktank/structure-from-chaos.ts` | Synthesis engine | ❌ Missing |
| `thinktank/sentinel-agents.ts` | Background agents | ❌ Missing |
| `thinktank/flash-facts.ts` | Quick facts | ❌ Missing |

### Priority 3 - Specialized Features (No CDK Routes)

| Handler | Purpose | CDK Status |
|---------|---------|------------|
| `thinktank/liquid-interface.ts` | Adaptive UI | ❌ Missing |
| `thinktank/reality-engine.ts` | Reality testing | ❌ Missing |
| `thinktank/security-signals.ts` | Security indicators | ❌ Missing |
| `thinktank/policy-framework.ts` | Policy management | ❌ Missing |
| `thinktank/derivation-history.ts` | Derivation tracking | ❌ Missing |
| `thinktank/enhanced-collaboration.ts` | Team features | ❌ Missing |
| `thinktank/file-conversion.ts` | File processing | ❌ Missing |
| `thinktank/ideas.ts` | Idea management | ❌ Missing |

### Already Routed ✅

| Handler | Purpose | CDK Status |
|---------|---------|------------|
| `thinktank/artifact-engine.ts` | GenUI artifacts | ✅ api-stack.ts |
| `thinktank/analytics.ts` | Usage analytics | ✅ thinktank-admin-api-stack.ts |
| `thinktank/settings.ts` | Status/config | ✅ thinktank-admin-api-stack.ts |
| `thinktank/my-rules.ts` | User rules | ✅ thinktank-admin-api-stack.ts |
| `thinktank/shadow-testing.ts` | A/B testing | ✅ thinktank-admin-api-stack.ts |

## Recommended Solution

### Option A: Consolidated Think Tank Router (Recommended)

Create a single `thinktank/handler.ts` that routes to all Think Tank handlers, similar to admin/handler.ts:

```typescript
// thinktank/handler.ts
export async function handler(event) {
  const path = event.path;
  if (path.includes('/conversations')) return (await import('./conversations.js')).handler(event);
  if (path.includes('/users')) return (await import('./users.js')).handler(event);
  // ... etc
}
```

Then add single CDK route:
```typescript
const thinktankRouter = v2.addResource('thinktank');
thinktankRouter.addProxy({
  defaultIntegration: new apigateway.LambdaIntegration(thinktankLambda),
  ...
});
```

### Option B: Individual Lambda Integrations

Add each handler as a separate Lambda with proxy route. **Not recommended** - would add ~100+ resources to already large stack.

## Implementation Checklist

- [ ] Create `thinktank/handler.ts` consolidated router
- [ ] Add dynamic imports for all 29 Think Tank handlers
- [ ] Add CDK route in `api-stack.ts` with proxy
- [ ] Test all routes work
- [ ] Update this document

## Related Files

- CDK Stacks: `packages/infrastructure/lib/stacks/*.ts`
- Lambda Handlers: `packages/infrastructure/lambda/`
- Admin Router: `packages/infrastructure/lambda/admin/handler.ts`
- Think Tank Admin Stack: `packages/infrastructure/lib/stacks/thinktank-admin-api-stack.ts`

## Policy Reference

See `/.windsurf/workflows/cdk-infrastructure-sync.md` for CDK update policy.
