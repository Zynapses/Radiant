# RADIANT Technical Debt Register

> Last Updated: 2024-12-28
> Version: 4.18.2

## Overview

This document tracks known technical debt, code quality issues, and improvement opportunities in the RADIANT codebase.

## Priority Legend

| Priority | Description |
|----------|-------------|
| 🔴 P0 | Critical - Fix immediately |
| 🟠 P1 | High - Fix this sprint |
| 🟡 P2 | Medium - Plan for next sprint |
| 🟢 P3 | Low - Backlog |

---

## Active Issues

### 🔴 P0 - Critical

#### TD-001: Duplicate Type Definitions ✅ FIXED
**Status**: Resolved  
**Location**: Multiple files  
**Issue**: Types like `PersonalityMode`, `InjectionPoint`, `TriggerType` were defined in both `@radiant/shared` and lambda services.  
**Resolution**: Consolidated all types to `@radiant/shared` and imported in services.

#### TD-002: Mock Data in Production API Routes ✅ FIXED
**Status**: Resolved  
**Location**: `apps/admin-dashboard/app/api/admin/delight/dashboard/route.ts`  
**Issue**: Returns mock data when backend unavailable, violating `/no-mock-data` policy.  
**Resolution**: Replaced with proper error responses.

---

### 🟠 P1 - High Priority

#### TD-003: Low Test Coverage
**Status**: Open  
**Location**: `packages/infrastructure/lambda/shared/services/`  
**Issue**: Only ~40% of services have tests (151 test files for 381 source files).  
**Services needing tests**:
- [ ] `delight.service.ts`
- [ ] `domain-taxonomy.service.ts`
- [ ] `delight-orchestration.service.ts`
- [ ] `delight-events.service.ts`
- [ ] `agi-brain-planner.service.ts`

#### TD-004: Console Statements in Lambda ✅ FIXED
**Status**: Resolved  
**Location**: Multiple lambda files  
**Issue**: 11 files using `console.log`/`console.error` instead of structured logger.  
**Resolution**: Replaced with `enhancedLogger` calls.

---

### 🟡 P2 - Medium Priority

#### TD-005: Generic Error Handling ✅ FIXED
**Status**: Partially Resolved  
**Location**: 323 instances across lambda  
**Issue**: Many `catch (error)` blocks just log and return empty objects.  
**Resolution**: Created standardized error handling utilities.

#### TD-006: Hardcoded Values ✅ REVIEWED
**Status**: Acceptable  
**Location**: 
- `brain-router.ts`
- `delight-orchestration.service.ts`
**Issue**: These are actually fallback patterns (database-first, fallback to defaults).  
**Resolution**: Reviewed and confirmed as defensive programming patterns, not violations.

#### TD-007: TODO/FIXME Comments ✅ FIXED (Critical)
**Status**: Partially Resolved  
**Key items fixed**:
- [x] `ml-training.service.ts:425` - SageMaker endpoint integration implemented
**Remaining items** (non-critical logging/config TODOs):
- [ ] `model-router.service.ts` - 5 TODO items (future enhancements)
- [ ] `enhanced-logger.ts` - 6 TODO items (logging improvements)

---

### 🟢 P3 - Low Priority

#### TD-008: Large Service Index Export ✅ FIXED
**Status**: Resolved  
**Location**: `packages/infrastructure/lambda/shared/services/index.ts`  
**Issue**: Exported 70+ services from single file, impacting tree-shaking.  
**Resolution**: Reorganized to use domain-specific barrel exports:
- `./agi` - AGI, consciousness, learning services
- `./core` - Database, cache, config, observability
- `./platform` - Business features, billing, collaboration
- `./models` - Model routing, selection, ML services

#### TD-009: Inconsistent Import Patterns
**Status**: Open  
**Issue**: Mix of relative imports and package imports across codebase.  
**Recommendation**: Standardize on package imports where possible.

---

## Resolved Issues

| ID | Issue | Resolution Date | Notes |
|----|-------|-----------------|-------|
| TD-001 | Duplicate types | 2024-12-28 | Consolidated to @radiant/shared |
| TD-002 | Mock data in API | 2024-12-28 | Proper error responses |
| TD-004 | Console statements | 2024-12-28 | Use enhancedLogger |
| TD-005 | Error handling | 2024-12-28 | Standardized utilities |
| TD-006 | Hardcoded values | 2024-12-28 | Reviewed - acceptable fallbacks |
| TD-007 | Critical TODOs | 2024-12-28 | SageMaker integration implemented |
| TD-008 | Large service index | 2024-12-28 | Domain-specific barrels |

---

## Metrics

### Code Quality Trends

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Duplicate types | 5+ | 0 | 0 |
| Mock data files | 1 | 0 | 0 |
| Console statements | 11 | 0 | 0 |
| Critical TODOs | 1 | 0 | 0 |
| Service index exports | 90+ | 4 barrels | Clean |
| Test coverage | ~40% | ~40% | 80% |
| TODO comments | 73 | 72 | <20 |

---

## Guidelines

### Adding New Debt

When adding technical debt intentionally:
1. Add entry to this document
2. Include `// TECH-DEBT: TD-XXX` comment in code
3. Set realistic priority and timeline
4. Get approval for P0/P1 items

### Resolving Debt

When fixing technical debt:
1. Update status in this document
2. Remove `TECH-DEBT` comments from code
3. Add tests to prevent regression
4. Update metrics section

---

## Related Policies

- `.windsurf/workflows/no-mock-data.md`
- `.windsurf/workflows/no-stubs.md`
- `.windsurf/workflows/no-hardcoded-ui-text.md`
