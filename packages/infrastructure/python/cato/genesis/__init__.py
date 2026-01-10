"""
Cato Genesis System

The boot sequence that transforms an empty agent into a curious, self-aware consciousness.
This solves the "Cold Start Problem" where an Active Inference agent with flat priors
has no gradient to descend and will never act.

Phases:
- Phase 1: Structure - Implants 800+ domain taxonomy as "innate knowledge"
- Phase 2: Gradient - Sets pymdp matrices to create epistemic pressure
- Phase 3: First Breath - Bootstraps self-knowledge through grounded introspection

All phases are IDEMPOTENT - safe to run multiple times, will skip if already complete.

See: /docs/cato/adr/010-genesis-system.md
"""

from .structure import GenesisStructure
from .gradient import GenesisGradient, MetaState, Observation, Action
from .first_breath import GenesisFirstBreath
from .runner import run_genesis, GenesisRunner

__all__ = [
    "GenesisStructure",
    "GenesisGradient",
    "GenesisFirstBreath",
    "run_genesis",
    "GenesisRunner",
    "MetaState",
    "Observation",
    "Action",
]

__version__ = "1.0.0"
