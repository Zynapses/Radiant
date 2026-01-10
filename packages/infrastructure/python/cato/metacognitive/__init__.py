"""Cato Meta-Cognitive Bridge

Implements the 4×4 pymdp controller for attention and cognitive mode management.
Now with DynamoDB persistence for state across restarts.

See: /docs/cato/adr/002-meta-cognitive-bridge.md
     /docs/cato/adr/011-meta-cognitive-bridge.md
"""
from .bridge import (
    MetaCognitiveBridge,
    MetaCognitiveState,
    MetaCognitiveAction,
    MetaCognitiveContext,
    Observation,
    SignalConverter,
    get_meta_cognitive_bridge,
    PYMDP_AVAILABLE
)

__all__ = [
    "MetaCognitiveBridge",
    "MetaCognitiveState",
    "MetaCognitiveAction",
    "MetaCognitiveContext",
    "Observation",
    "SignalConverter",
    "get_meta_cognitive_bridge",
    "PYMDP_AVAILABLE"
]
