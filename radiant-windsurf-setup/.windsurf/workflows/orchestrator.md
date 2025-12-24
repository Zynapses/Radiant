# RADIANT Build Orchestrator

## Available Commands

| Command | Action |
|---------|--------|
| `/implement-phase N` | Start implementing phase N (1-9) |
| `/continue-phase` | Continue from last stopping point |
| `/verify-phase` | Run verification for current phase |
| `/phase-status` | Show implementation progress |
| `/section N` | Jump to specific section implementation |

## Phase Overview

```
Phase 1: Foundation         [Sections 0-2]   ~6,500 lines
Phase 2: Core Infrastructure [Sections 3-7]  ~13,600 lines
Phase 3: Admin & Deployment  [Sections 8-9]  ~5,100 lines
Phase 4: AI Features         [Sections 10-17] ~1,500 lines
Phase 5: Consumer Platform   [Sections 18-28] ~2,400 lines
Phase 6: Advanced Features   [Sections 29-35] ~6,200 lines
Phase 7: Intelligence Layer  [Sections 36-39] ~4,600 lines
Phase 8: Platform Hardening  [Sections 40-42] ~5,200 lines
Phase 9: Billing System      [Sections 43-46] ~2,000 lines
```

## Automatic Execution Flow

When you say `/implement-phase 1`, I will:

1. **Read** the phase spec from `docs/phases/phase-1.md`
2. **Load** each section from `docs/sections/` in order
3. **Create** all files following the dependency graph
4. **Verify** compilation/synthesis after each section
5. **Report** progress and any issues
6. **Prompt** to continue to next phase when complete

## Progress Tracking

Progress is tracked in `.windsurf/state/progress.json`:

```json
{
  "currentPhase": 1,
  "currentSection": 0,
  "completedSections": [],
  "lastFile": null,
  "errors": []
}
```

## Resuming Work

If a session ends mid-implementation:
1. Say `/continue-phase` to resume
2. I'll read the progress file and continue from last point
3. No work is lost, no duplication

## Error Recovery

If implementation fails:
1. Error is logged to progress.json
2. Say `/retry-section` to retry the failed section
3. Say `/skip-section` to mark as manual and continue

## Full Auto Mode

For complete hands-off building:
```
/auto-build
```

This runs all phases sequentially, pausing only on errors.
