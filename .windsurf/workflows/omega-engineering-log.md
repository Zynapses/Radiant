---
description: Policy - OMEGA Engineering Log must be updated when any OMEGA architecture, physics, or training changes are made
---

# OMEGA Engineering Log Update Policy

## When to Update

The OMEGA Engineering Log (`apps/omega-proving-ground/OMEGA-ENGINEERING-LOG.md`) MUST be updated when:

1. **Any change to `omega_core/physics.py`** — CryoLiquidLayer, HelixKernel, OmegaCortex
2. **Any change to training pipeline** — `trainer.py`, learning rules, loss functions
3. **Any architectural decision** — new components, removed components, changed responsibilities
4. **Any experiment result** — training runs with metrics, benchmark comparisons
5. **Any new open question** — unresolved design decisions that need discussion

## What to Update

### For architectural decisions:
Add a new entry to `## Decision Log` with:
- **DEC-NNN** sequential ID
- **Status**: PROPOSED | AGREED | IMPLEMENTED | REVERTED
- **Rationale**: Why this decision was made
- **Files modified**: What changed

### For experiment results:
Add a new entry to `## Experiment Results` with:
- **EXP-NNN** sequential ID
- Key metrics table
- Conclusion

### For implementation changes:
Update the `## Implementation Status` table.

## File Location

```
apps/omega-proving-ground/OMEGA-ENGINEERING-LOG.md
```

This file is committed to Git alongside the OMEGA codebase. It travels with the project.

## Enforcement

- Every PR/commit touching OMEGA files MUST include an engineering log update
- AI build agents MUST update the log as part of any OMEGA task
- The log is the single source of truth for OMEGA architectural decisions
