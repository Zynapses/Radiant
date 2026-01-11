"""
RADIANT v5.4.0 - Cognitive Architecture (PROMPT-40)

Flyte workflows implementing the Active Inference cognitive routing system.

Components:
- sniper_execute: Fast path for simple queries with Ghost Memory hit
- war_room: Deep analysis path with multi-model validation
- read_ghost_memory: Circuit breaker-protected Ghost Memory reads
- economic_governor: Complexity analysis and routing decisions

Architecture:
    User Query
         │
         ▼
    ┌─────────────┐
    │ Economic    │
    │ Governor    │
    └─────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  Sniper   War Room
    │         │
    ▼         ▼
  Ghost    Multi-Model
  Memory   Validation
    │         │
    └────┬────┘
         │
         ▼
    Write-Back
    (non-blocking)
"""

from .workflows import (
    cognitive_workflow,
    sniper_execute,
    war_room_execute,
    read_ghost_memory,
    append_ghost_memory,
    economic_governor_route,
)

from .metrics import (
    emit_metric,
    CognitiveMetrics,
)

from .circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerState,
)

__all__ = [
    'cognitive_workflow',
    'sniper_execute',
    'war_room_execute',
    'read_ghost_memory',
    'append_ghost_memory',
    'economic_governor_route',
    'emit_metric',
    'CognitiveMetrics',
    'CircuitBreaker',
    'CircuitBreakerState',
]
