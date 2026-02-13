# Project OMEGA — Bicameral Synthetic Biological Intelligence
# Canonical shared package — see .windsurf/workflows/omega-package-policy.md
#
# DO NOT copy this code into apps or projects.
# All consumers MUST import from this package.

"""
radiant_omega — OMEGA Core Package

A Liquid Neural Network using Complex-Valued Logic (CVNN) that runs on AWS Lambda (Graviton).
The brain sleeps (costs $0) when idle and wakes on demand with Time-Warp capability.

Components:
- physics: CryoLiquidLayer (Q-Node), HelixKernel (Bio-ROM), OmegaCortex, PhysicsConfig
- bridge: NeuralTransducer (Complex^2048 → LLM Embeddings), ThoughtVectorCache
- reflection: Watcher (self-awareness via prediction error)
- storage: StorageManager (EFS/S3 persistence with atomic writes)
- library: ResonantIndex (O(1) phase-based lookups)
- firmware: FirmwareManager (.bio file signing and validation)
- ambition: HomeostaticLoop (drive/motivation system)
- trainer: TextEncoder, PhaseAlignmentDecoder, BehavioralCodebook, OmegaTrainer

Usage:
    from radiant_omega import OmegaCortex, PhysicsConfig, CryoLiquidLayer
    from radiant_omega.trainer import OmegaTrainer, BehavioralCodebook
    from radiant_omega.ambition import HomeostaticLoop
"""

__version__ = "0.2.0"
__author__ = "RADIANT Engineering"
__package_policy__ = ".windsurf/workflows/omega-package-policy.md"

# ── Physics Engine ──
from .physics import (
    CryoLiquidLayer,
    HelixKernel,
    OmegaCortex,
    PhysicsConfig,
    get_omega_device,
)

# ── Neural Bridge ──
from .bridge import (
    NeuralTransducer,
    BridgeTrainer,
    BridgeConfig,
    ThoughtVectorCache,
)

# ── Self-Reflection ──
from .reflection import (
    Watcher,
    WatcherTrainer,
    WatcherConfig,
    SelfModelMetrics,
)

# ── Persistence ──
from .storage import StorageManager, BrainMetadata, StorageConfig

# ── Ambition / Drive ──
from .ambition import HomeostaticLoop, AmbitionState

# ── Phase-Based Index ──
from .library import ResonantIndex

# ── Firmware ──
from .firmware import FirmwareManager, FirmwareSpec

# ── Trainer (TextEncoder, Codebook, ODE training) ──
from .trainer import (
    TextEncoder,
    PhaseAlignmentDecoder,
    BehavioralCodebook,
    OmegaTrainer,
    TrainingExample,
    TrainingMetrics,
    BEHAVIOR_TYPES,
    load_training_data,
    load_knowledge_base,
)
