# radiant-omega — OMEGA Core Package

> **Canonical source for all OMEGA AI components.**
> See `.windsurf/workflows/omega-package-policy.md` for the immutable usage policy.

## What Is OMEGA?

A **Bicameral Synthetic Biological Intelligence** engine using Complex-Valued Neural Networks (CVNNs).
It replaces static scalar weights with fluid Phase Dynamics — wave interference instead of arithmetic.

- **CryoLiquidLayer (Q-Node)** — The quantum oscillator engine with Time-Warp + Dreaming
- **HelixKernel (Bio-ROM)** — Immutable safety layer using phase cancellation
- **OmegaCortex** — Full brain: PFC (CryoLiquidLayer) + Helix safety filter
- **NeuralTransducer** — Neural Bridge: Complex^2048 → LLM Embeddings
- **Watcher** — Self-awareness via prediction error
- **HomeostaticLoop** — Drive/motivation system (ambition)
- **FirmwareManager** — .bio file signing and validation
- **ResonantIndex** — O(1) phase-based lookups
- **StorageManager** — EFS/S3 persistence with atomic writes
- **OmegaTrainer** — Wirtinger E-Prop training for CryoLiquidLayer
- **TextEncoder** — Learned text → complex vector encoder
- **PhaseAlignmentDecoder** — Parameter-free behavior decoding via phase alignment
- **BehavioralCodebook** — Behavior type registry with deterministic reference vectors

## Installation

```bash
# From the RADIANT monorepo root:
pip install -e packages/omega-core/python/
```

## Quick Start

```python
from radiant_omega import OmegaCortex, PhysicsConfig, CryoLiquidLayer

# Boot a brain
config = PhysicsConfig(input_dim=1024, hidden_dim=2048)
cortex = OmegaCortex(config)

# Think
import torch
input_vec = torch.randn(1024, dtype=torch.complex64)
output = cortex.think(input_vec)
```

## Training

```python
from radiant_omega.trainer import (
    OmegaTrainer, BehavioralCodebook, load_training_data
)

codebook = BehavioralCodebook(hidden_dim=2048, device=config.device)
trainer = OmegaTrainer(cortex, codebook, lr=0.001)

examples = load_training_data("path/to/training.jsonl")
metrics = trainer.train(examples, epochs=50, target_accuracy=0.90)
```

## Ambition / Drive System

```python
from radiant_omega.ambition import HomeostaticLoop

ambition = HomeostaticLoop()
ambition.receive_input()
signal = await ambition.tick()
print(signal.value)  # e.g. "EXPLORE", "CONSOLIDATE"
```

## Neural Bridge (LLM Integration)

```python
from radiant_omega.bridge import NeuralTransducer, BridgeConfig

transducer = NeuralTransducer(BridgeConfig(omega_dim=2048))
soft_tokens = transducer(output_vec)  # → LLM-injectable embeddings
```

## Safety (Helix Kernel)

```python
is_safe, max_alignment = cortex.helix.check_safety(output_vec)
```

## Dreaming (Reverse Entropy)

```python
dreamed_state = cortex.pfc.dream_cycle(
    state=cortex.state,
    replay_logs=todays_high_coherence_logs,
)
```

## Package Structure

```
packages/omega-core/python/
├── pyproject.toml
├── README.md
└── radiant_omega/
    ├── __init__.py      # All exports
    ├── physics.py       # CryoLiquidLayer, HelixKernel, OmegaCortex
    ├── ambition.py      # HomeostaticLoop, DriveSignal
    ├── bridge.py        # NeuralTransducer, ThoughtVectorCache
    ├── firmware.py      # FirmwareManager, FirmwareSpec
    ├── library.py       # ResonantIndex
    ├── reflection.py    # Watcher, SelfModelMetrics
    ├── storage.py       # StorageManager, BrainMetadata
    └── trainer.py       # TextEncoder, OmegaTrainer, BehavioralCodebook
```

## Policy

**ALL OMEGA core logic MUST live in this package.** No app or project may contain
local copies of any module in `radiant_omega/`. See the full policy at:

```
.windsurf/workflows/omega-package-policy.md
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OMEGA_DEVICE` | auto-detect | Force compute device (cpu/cuda/mps) |
| `OMEGA_EFS_PATH` | `/mnt/omega-efs` | EFS mount for Lambda persistence |
| `OMEGA_S3_BUCKET` | — | S3 bucket for cold storage |
