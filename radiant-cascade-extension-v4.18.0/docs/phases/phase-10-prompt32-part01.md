# Phase 10: PROMPT-32 Update - Header & Shared Types

> **Batch:** PROMPT-32 Update  
> **Parts in Batch:** 15  
> **This Phase:** Part 1 of 15  
> **Prerequisites:** Phases 1-9 complete (from existing Cascade setup)

---

## IMPLEMENTATION ORDER

**CRITICAL:** Complete ALL 15 parts of PROMPT-32 before moving to PROMPT-33.

---

## Load Document

Read and implement: `docs/prompts/prompt-32-parts/RADIANT-PROMPT-32-Update-PART-01-HEADER-SHARED.md`

## What This Part Contains

- RADIANT v4.17.0 header and metadata
- Implementation strategy for Claude/Windsurf
- Project structure overview
- **SECTION 0:** Unified Shared Types & Constants
  - Project root configuration
  - Shared package structure
  - Version constants
  - TypeScript type definitions
  - Utility functions
  - Build verification

## Implementation Tasks

1. Read the entire Part 01 document
2. Set up project root configuration files
3. Create the shared/ package with:
   - `packages/shared/package.json`
   - `packages/shared/tsconfig.json`
   - `packages/shared/src/index.ts`
   - `packages/shared/src/types/`
   - `packages/shared/src/constants/`
   - `packages/shared/src/utils/`
4. Implement all type definitions
5. Implement all constants
6. Implement utility functions
7. Verify the build compiles

## Verification

```bash
cd packages/shared
npm run build
npm run typecheck
```

## When Complete

Say: "Phase 10 complete. Ready for Phase 11 (PROMPT-32 Part 2 - Swift App)"
