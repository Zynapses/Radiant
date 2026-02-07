# Project OMEGA - Bicameral Synthetic Biological Intelligence
# Serverless Cryogenic Architecture - $0 when idle

"""
OMEGA Core Module

A Liquid Neural Network using Complex-Valued Logic (CVNN) that runs on AWS Lambda (Graviton).
The brain sleeps (costs $0) when idle and wakes on demand with Time-Warp capability.

Components:
- physics.py: CryoLiquidLayer - The quantum oscillator engine with Time-Warp + Dreaming
- bridge.py: NeuralTransducer - The Neural Bridge (Complex^2048 → LLM Embeddings)
- reflection.py: Watcher - Self-awareness via prediction error
- storage.py: StorageManager - EFS/S3 persistence layer with atomic writes
- library.py: ResonantIndex - O(1) phase-based lookups
- firmware.py: FirmwareManager - .bio file signing and validation
- ambition.py: HomeostaticLoop - The drive/motivation system

"This is the Jet Engine. Everyone else is building better propellers."
"""

__version__ = "0.2.0"
__author__ = "RADIANT Engineering"

from .physics import CryoLiquidLayer, HelixKernel, OmegaCortex, PhysicsConfig
from .bridge import NeuralTransducer, BridgeTrainer, BridgeConfig, ThoughtVectorCache
from .reflection import Watcher, WatcherTrainer, WatcherConfig, SelfModelMetrics
from .storage import StorageManager, BrainMetadata, StorageConfig
from .ambition import HomeostaticLoop, AmbitionState
from .library import ResonantIndex
from .firmware import FirmwareManager, FirmwareSpec
