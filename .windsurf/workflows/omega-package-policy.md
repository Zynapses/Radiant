---
description: Policy - All OMEGA AI implementations MUST use the radiant-omega package. No local OMEGA core code allowed. Changes to the package require extra warning.
---

# OMEGA Package Policy — `radiant-omega`

**Package location**: `packages/omega-core/python/radiant_omega/`
**Status**: IMMUTABLE SHARED PACKAGE — changes affect ALL consumers

## Core Rules

### 1. NO LOCAL OMEGA CORE CODE — EVER

All OMEGA AI functionality in ANY RADIANT app or service MUST use `radiant-omega`.

**FORBIDDEN** (in any app, Lambda, service, or script):
- ❌ Local copies of CryoLiquidLayer, HelixKernel, OmegaCortex, or PhysicsConfig
- ❌ Local copies of TextEncoder, PhaseAlignmentDecoder, BehavioralCodebook, or OmegaTrainer
- ❌ Local copies of NeuralTransducer, Watcher, HomeostaticLoop, FirmwareManager
- ❌ Local copies of StorageManager, ResonantIndex, or any other radiant_omega module
- ❌ Reimplementing any Q-Node, phase dynamics, or complex-valued neural logic locally
- ❌ Copying any code from `packages/omega-core/` into apps or projects
- ❌ Inline ODE integration, phase alignment decoding, or dream cycle logic

**REQUIRED**:
- ✅ `from radiant_omega import OmegaCortex, PhysicsConfig`
- ✅ `from radiant_omega.trainer import OmegaTrainer, BehavioralCodebook`
- ✅ `from radiant_omega.ambition import HomeostaticLoop`
- ✅ All OMEGA core logic changes go INTO the package, never into app code

### 2. PACKAGE CHANGES REQUIRE EXTRA WARNING

When modifying ANY file in `packages/omega-core/`:

⚠️ **STOP AND WARN THE USER** before making changes. Use this exact format:

```
⚠️ OMEGA PACKAGE CHANGE WARNING ⚠️
File: packages/omega-core/python/radiant_omega/<file>
Change: <description>
Impact: This change affects ALL apps and services using radiant-omega:
  - OMEGA Proving Ground (McDonald's drive-thru server)
  - OMEGA Lab (frontend API layer)
  - Lambda handlers (omega_inference, omega_heartbeat, omega_admin)
  - [any other consumers]
Proceed? (yes/no)
```

Do NOT auto-apply changes to the OMEGA package. Always wait for explicit user approval.

**Why**: The OMEGA package is the brain. A breaking change in `physics.py` could silently break every consumer that depends on CryoLiquidLayer dynamics. The extra warning ensures the user understands the blast radius.

### 3. APP-LEVEL CHANGES THAT TOUCH CORE LOGIC → PACKAGE

If a host app needs a change that touches OMEGA core behavior:

1. **STOP** — do not modify the app's local code
2. **Identify** which package module needs the change
3. **Apply Rule 2** — warn the user with the blast radius
4. **Make the change in the package** (with approval)
5. **All consumers automatically get the update** via their imports

This is the critical rule: **changes flow INTO the package, never out of it.**

### 4. REFERENCE INJECTION

When implementing OMEGA in ANY new feature, page, service, or app:

1. **First**: Check if `radiant-omega` already covers the use case
2. **If yes**: Import and use it directly — reference `packages/omega-core/python/README.md` for API docs
3. **If no**: Add the capability TO THE PACKAGE (with the change warning above), then import it
4. **Always**: Add a reference comment at the import site:

```python
# OMEGA core via radiant-omega shared package — see packages/omega-core/python/README.md
from radiant_omega import OmegaCortex, PhysicsConfig
```

### 5. SHIM FILES (Legacy Compatibility)

The following locations contain **thin re-export shims** — NOT real code:

| Shim Location | Re-exports From |
|---------------|-----------------|
| `packages/infrastructure/lambda/omega_core/__init__.py` | `radiant_omega` |
| `packages/infrastructure/lambda/omega_core/physics.py` | `radiant_omega.physics` |
| `packages/infrastructure/lambda/omega_core/ambition.py` | `radiant_omega.ambition` |
| `packages/infrastructure/lambda/omega_core/bridge.py` | `radiant_omega.bridge` |
| `packages/infrastructure/lambda/omega_core/firmware.py` | `radiant_omega.firmware` |
| `packages/infrastructure/lambda/omega_core/library.py` | `radiant_omega.library` |
| `packages/infrastructure/lambda/omega_core/reflection.py` | `radiant_omega.reflection` |
| `packages/infrastructure/lambda/omega_core/storage.py` | `radiant_omega.storage` |
| `apps/omega-proving-ground/omega_server/trainer.py` | `radiant_omega.trainer` |

**NEVER add logic to shim files.** They exist only for backward compatibility.
If a shim is importing correctly, do NOT modify it.

### 6. NEW MODULE ADDITIONS

To add a new module to OMEGA core:

1. Create `packages/omega-core/python/radiant_omega/<module>.py`
2. Export from `__init__.py`
3. Update `README.md` with usage examples
4. **The change warning (Rule 2) applies**
5. If Lambda handlers need it, add a corresponding shim in `lambda/omega_core/`

## Current Consumers

| App/Service | File | Usage |
|-------------|------|-------|
| OMEGA Proving Ground | `apps/omega-proving-ground/omega_server/server.py` | Full brain: boot, infer, train, dream |
| OMEGA Voice Pipeline | `apps/omega-proving-ground/omega_server/voice_server.py` | Imports via server.py (indirect) |
| Lambda Inference | `packages/infrastructure/lambda/handlers/omega_inference.py` | Cortex wake/think cycle |
| Lambda Heartbeat | `packages/infrastructure/lambda/handlers/omega_heartbeat.py` | Health checks, state persistence |
| Lambda Admin | `packages/infrastructure/lambda/handlers/omega_admin.py` | Admin operations |
| OMEGA Lab | `apps/omega-lab/` | Frontend — calls APIs (no direct Python imports) |

**Update this table when adding new consumers.**

## Quick Reference

```python
# Boot a brain
from radiant_omega import OmegaCortex, PhysicsConfig
config = PhysicsConfig(input_dim=1024, hidden_dim=2048)
cortex = OmegaCortex(config)

# Train
from radiant_omega.trainer import OmegaTrainer, BehavioralCodebook, load_training_data
codebook = BehavioralCodebook(hidden_dim=2048, device=config.device)
trainer = OmegaTrainer(cortex, codebook, lr=0.001)
examples = load_training_data("path/to/training.jsonl")
metrics = trainer.train(examples, epochs=50)

# Ambition
from radiant_omega.ambition import HomeostaticLoop
ambition = HomeostaticLoop()

# Safety
is_safe, alignment = cortex.helix.check_safety(output_vec)

# Neural Bridge
from radiant_omega.bridge import NeuralTransducer, BridgeConfig
transducer = NeuralTransducer(BridgeConfig(omega_dim=2048))
```

## Enforcement Checklist

When reviewing ANY PR or code change:

- [ ] No CryoLiquidLayer, HelixKernel, or OmegaCortex definitions outside `packages/omega-core/`
- [ ] No TextEncoder, PhaseAlignmentDecoder, or BehavioralCodebook definitions outside `packages/omega-core/`
- [ ] No phase_theta, recurrent_theta, or ODE integration logic outside `packages/omega-core/`
- [ ] No `import omega_core` without going through a shim that delegates to `radiant_omega`
- [ ] Any OMEGA package changes have explicit user approval
- [ ] New consumers are added to the consumers table above
- [ ] Reference comment present at import site
- [ ] Shim files contain ONLY re-exports, no logic
