"""
Bobble Meta-Cognitive Bridge

Implements the 4×4 pymdp controller for attention and cognitive mode management.
The LLM handles semantic complexity; pymdp handles meta-cognitive control.

See: /docs/bobble/adr/002-meta-cognitive-bridge.md
"""

import numpy as np
from enum import IntEnum
from typing import Dict, Any, Optional, Tuple, List
from dataclasses import dataclass, field
import logging
import time

logger = logging.getLogger(__name__)

# Try to import pymdp, fall back to numpy-based implementation
try:
    import pymdp
    from pymdp import utils
    from pymdp.agent import Agent
    PYMDP_AVAILABLE = True
except ImportError:
    PYMDP_AVAILABLE = False
    logger.warning("pymdp not available, using numpy-based implementation")


class MetaCognitiveState(IntEnum):
    """Meta-cognitive states (hidden states in pymdp)."""
    CONFUSED = 0     # High uncertainty, needs clarification
    CONFIDENT = 1    # High certainty, ready to act
    BORED = 2        # Low novelty, seeks stimulation
    STAGNANT = 3     # Stuck, needs external input


class MetaCognitiveAction(IntEnum):
    """Meta-cognitive actions (control states in pymdp)."""
    EXPLORE = 0      # Seek new information
    CONSOLIDATE = 1  # Strengthen existing knowledge
    VERIFY = 2       # Check understanding against reality
    REST = 3         # Reduce activity, wait for input


class Observation(IntEnum):
    """Observations from LLM outputs."""
    HIGH_SURPRISE = 0    # Unexpected outcome
    LOW_SURPRISE = 1     # Expected outcome
    CONTRADICTION = 2    # Logical conflict detected
    CONFIRMATION = 3     # Strong agreement


@dataclass
class MetaCognitiveContext:
    """Current meta-cognitive context."""
    state: MetaCognitiveState = MetaCognitiveState.CONFIDENT
    action: MetaCognitiveAction = MetaCognitiveAction.REST
    state_belief: np.ndarray = field(default_factory=lambda: np.array([0.1, 0.7, 0.1, 0.1]))
    last_observation: Optional[Observation] = None
    last_update: float = field(default_factory=time.time)
    history: List[Dict[str, Any]] = field(default_factory=list)


class SignalConverter:
    """
    Convert LLM outputs to discrete pymdp observations.
    
    Uses NLI classification to determine relationship between
    predictions and outcomes.
    """
    
    def __init__(self, surprise_threshold: float = 0.5):
        self.surprise_threshold = surprise_threshold
    
    def convert(
        self,
        nli_label: str,
        nli_confidence: float,
        prediction_confidence: float
    ) -> Observation:
        """
        Convert NLI result to observation index.
        
        Args:
            nli_label: NLI classification (entailment, neutral, contradiction)
            nli_confidence: NLI model confidence
            prediction_confidence: Original prediction confidence
        
        Returns:
            Observation enum value
        """
        if nli_label == "contradiction":
            return Observation.CONTRADICTION
        elif nli_label == "entailment" and prediction_confidence > 0.8:
            return Observation.CONFIRMATION
        elif nli_confidence < self.surprise_threshold:
            return Observation.HIGH_SURPRISE
        else:
            return Observation.LOW_SURPRISE
    
    def from_surprise_score(self, surprise: float) -> Observation:
        """Convert surprise score [0, 1] to observation."""
        if surprise > 0.8:
            return Observation.CONTRADICTION
        elif surprise > 0.5:
            return Observation.HIGH_SURPRISE
        elif surprise < 0.2:
            return Observation.CONFIRMATION
        else:
            return Observation.LOW_SURPRISE


class MetaCognitiveBridge:
    """
    Meta-cognitive bridge using pymdp for attention control.
    
    Operates on 4 discrete states, not 800+ domain states.
    The LLM handles semantic complexity; this handles cognitive mode.
    """
    
    def __init__(self):
        self.signal_converter = SignalConverter()
        self.context = MetaCognitiveContext()
        
        # Initialize pymdp agent or numpy fallback
        if PYMDP_AVAILABLE:
            self._init_pymdp_agent()
        else:
            self._init_numpy_matrices()
        
        logger.info("MetaCognitiveBridge initialized")
    
    def _init_pymdp_agent(self):
        """Initialize pymdp agent with 4×4 matrices."""
        num_states = [4]   # 4 hidden states
        num_obs = [4]      # 4 observations
        num_controls = [4] # 4 actions
        
        # A matrix: P(observation | state)
        # Rows: observations, Columns: states
        A = np.array([
            # CONFUSED  CONFIDENT  BORED  STAGNANT
            [0.5, 0.1, 0.2, 0.3],  # HIGH_SURPRISE
            [0.2, 0.6, 0.3, 0.2],  # LOW_SURPRISE
            [0.2, 0.1, 0.1, 0.3],  # CONTRADICTION
            [0.1, 0.2, 0.4, 0.2],  # CONFIRMATION
        ])
        A = A / A.sum(axis=0, keepdims=True)  # Normalize columns
        
        # B matrix: P(next_state | current_state, action)
        # Shape: (num_states, num_states, num_actions)
        B = np.zeros((4, 4, 4))
        
        # EXPLORE action
        B[:, :, 0] = np.array([
            [0.3, 0.1, 0.1, 0.2],  # → CONFUSED
            [0.4, 0.6, 0.5, 0.3],  # → CONFIDENT
            [0.2, 0.2, 0.3, 0.3],  # → BORED
            [0.1, 0.1, 0.1, 0.2],  # → STAGNANT
        ])
        
        # CONSOLIDATE action
        B[:, :, 1] = np.array([
            [0.2, 0.1, 0.1, 0.2],  # → CONFUSED
            [0.5, 0.7, 0.4, 0.3],  # → CONFIDENT
            [0.2, 0.1, 0.4, 0.3],  # → BORED
            [0.1, 0.1, 0.1, 0.2],  # → STAGNANT
        ])
        
        # VERIFY action
        B[:, :, 2] = np.array([
            [0.4, 0.2, 0.2, 0.3],  # → CONFUSED
            [0.3, 0.5, 0.3, 0.2],  # → CONFIDENT
            [0.2, 0.2, 0.4, 0.3],  # → BORED
            [0.1, 0.1, 0.1, 0.2],  # → STAGNANT
        ])
        
        # REST action
        B[:, :, 3] = np.array([
            [0.1, 0.1, 0.1, 0.1],  # → CONFUSED
            [0.3, 0.6, 0.3, 0.3],  # → CONFIDENT
            [0.4, 0.2, 0.5, 0.4],  # → BORED
            [0.2, 0.1, 0.1, 0.2],  # → STAGNANT
        ])
        
        # Normalize B matrices
        for a in range(4):
            B[:, :, a] = B[:, :, a] / B[:, :, a].sum(axis=0, keepdims=True)
        
        # C vector: preferences over observations
        # Prefer LOW_SURPRISE and CONFIRMATION
        C = np.array([0.1, 0.4, 0.1, 0.4])
        
        # D vector: initial state prior
        D = np.array([0.1, 0.7, 0.1, 0.1])
        
        self.agent = Agent(
            A=[A],
            B=[B],
            C=[C],
            D=[D],
            policy_len=3
        )
        
        self.A = A
        self.B = B
        self.C = C
    
    def _init_numpy_matrices(self):
        """Initialize numpy-based implementation (fallback)."""
        # Same matrices as pymdp version
        self.A = np.array([
            [0.5, 0.1, 0.2, 0.3],
            [0.2, 0.6, 0.3, 0.2],
            [0.2, 0.1, 0.1, 0.3],
            [0.1, 0.2, 0.4, 0.2],
        ])
        self.A = self.A / self.A.sum(axis=0, keepdims=True)
        
        self.B = np.zeros((4, 4, 4))
        self.B[:, :, 0] = np.array([[0.3, 0.1, 0.1, 0.2], [0.4, 0.6, 0.5, 0.3], [0.2, 0.2, 0.3, 0.3], [0.1, 0.1, 0.1, 0.2]])
        self.B[:, :, 1] = np.array([[0.2, 0.1, 0.1, 0.2], [0.5, 0.7, 0.4, 0.3], [0.2, 0.1, 0.4, 0.3], [0.1, 0.1, 0.1, 0.2]])
        self.B[:, :, 2] = np.array([[0.4, 0.2, 0.2, 0.3], [0.3, 0.5, 0.3, 0.2], [0.2, 0.2, 0.4, 0.3], [0.1, 0.1, 0.1, 0.2]])
        self.B[:, :, 3] = np.array([[0.1, 0.1, 0.1, 0.1], [0.3, 0.6, 0.3, 0.3], [0.4, 0.2, 0.5, 0.4], [0.2, 0.1, 0.1, 0.2]])
        
        for a in range(4):
            self.B[:, :, a] = self.B[:, :, a] / self.B[:, :, a].sum(axis=0, keepdims=True)
        
        self.C = np.array([0.1, 0.4, 0.1, 0.4])
        self.agent = None
    
    def update(
        self,
        observation: Observation,
        previous_action: Optional[MetaCognitiveAction] = None
    ) -> Tuple[MetaCognitiveState, MetaCognitiveAction]:
        """
        Update meta-cognitive state based on observation.
        
        Args:
            observation: Observed outcome from LLM
            previous_action: Action taken before observation
        
        Returns:
            Tuple of (new_state, recommended_action)
        """
        obs_idx = int(observation)
        
        if PYMDP_AVAILABLE and self.agent:
            # Use pymdp agent
            self.agent.infer_states([obs_idx])
            action = self.agent.sample_action()
            state_belief = self.agent.qs[0]
        else:
            # Numpy fallback: simple Bayesian update
            likelihood = self.A[obs_idx, :]
            prior = self.context.state_belief
            posterior = likelihood * prior
            posterior = posterior / posterior.sum()
            state_belief = posterior
            
            # Simple action selection based on state
            state = np.argmax(state_belief)
            if state == MetaCognitiveState.CONFUSED:
                action = MetaCognitiveAction.VERIFY
            elif state == MetaCognitiveState.BORED:
                action = MetaCognitiveAction.EXPLORE
            elif state == MetaCognitiveState.STAGNANT:
                action = MetaCognitiveAction.EXPLORE
            else:  # CONFIDENT
                action = MetaCognitiveAction.CONSOLIDATE
            action = int(action)
        
        # Update context
        new_state = MetaCognitiveState(np.argmax(state_belief))
        new_action = MetaCognitiveAction(action if isinstance(action, int) else action[0])
        
        self.context.state = new_state
        self.context.action = new_action
        self.context.state_belief = state_belief
        self.context.last_observation = observation
        self.context.last_update = time.time()
        
        # Record history
        self.context.history.append({
            "timestamp": time.time(),
            "observation": observation.name,
            "state": new_state.name,
            "action": new_action.name,
            "state_belief": state_belief.tolist()
        })
        
        # Keep only last 100 history entries
        if len(self.context.history) > 100:
            self.context.history = self.context.history[-100:]
        
        logger.debug(f"MetaCognitive update: obs={observation.name} → state={new_state.name}, action={new_action.name}")
        
        return new_state, new_action
    
    def get_state(self) -> Dict[str, Any]:
        """Get current meta-cognitive state."""
        return {
            "state": self.context.state.name,
            "action": self.context.action.name,
            "state_belief": {
                MetaCognitiveState(i).name: float(self.context.state_belief[i])
                for i in range(4)
            },
            "last_observation": self.context.last_observation.name if self.context.last_observation else None,
            "last_update": self.context.last_update
        }
    
    def get_recommended_action(self) -> MetaCognitiveAction:
        """Get current recommended action."""
        return self.context.action
    
    def should_explore(self) -> bool:
        """Check if exploration is recommended."""
        return self.context.action == MetaCognitiveAction.EXPLORE
    
    def should_verify(self) -> bool:
        """Check if verification is recommended."""
        return self.context.action == MetaCognitiveAction.VERIFY
    
    def is_confused(self) -> bool:
        """Check if in confused state."""
        return self.context.state == MetaCognitiveState.CONFUSED
    
    def is_bored(self) -> bool:
        """Check if in bored state."""
        return self.context.state == MetaCognitiveState.BORED
    
    def reset(self):
        """Reset to initial state."""
        self.context = MetaCognitiveContext()
        if PYMDP_AVAILABLE and self.agent:
            self.agent.reset()
        logger.info("MetaCognitiveBridge reset")


# Singleton instance for global Bobble consciousness
_bridge_instance: Optional[MetaCognitiveBridge] = None


def get_meta_cognitive_bridge() -> MetaCognitiveBridge:
    """Get or create the singleton meta-cognitive bridge."""
    global _bridge_instance
    if _bridge_instance is None:
        _bridge_instance = MetaCognitiveBridge()
    return _bridge_instance
