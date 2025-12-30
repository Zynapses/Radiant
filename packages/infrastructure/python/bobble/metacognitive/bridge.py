"""
Bobble Meta-Cognitive Bridge

Implements the 4×4 pymdp controller for attention and cognitive mode management.
The LLM handles semantic complexity; pymdp handles meta-cognitive control.

This version includes DynamoDB persistence for state across restarts.
Matrices are loaded from Genesis Phase 2 configuration.

See: /docs/bobble/adr/002-meta-cognitive-bridge.md
     /docs/bobble/adr/011-meta-cognitive-bridge.md
"""

import numpy as np
import boto3
from enum import IntEnum
from typing import Dict, Any, Optional, Tuple, List
from dataclasses import dataclass, field
from datetime import datetime
import logging
import time
import json

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
    """Observations from LLM outputs (aligned with Genesis A-matrix)."""
    HIGH_ENTROPY = 0     # High uncertainty/confusion (was HIGH_SURPRISE)
    LOW_ENTROPY = 1      # Clarity/predictability (was LOW_SURPRISE)
    CONTRADICTION = 2    # Logical conflict detected
    PROGRESS = 3         # Learning progress (was CONFIRMATION)
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
    
    This version supports:
    - Loading matrices from Genesis Phase 2 (DynamoDB)
    - Persisting state to DynamoDB after each update
    - Rehydration from DynamoDB on startup
    
    See: /docs/bobble/adr/011-meta-cognitive-bridge.md
    """
    
    def __init__(
        self,
        config_table: str = "bobble-config",
        region: str = "us-east-1",
        persist: bool = True
    ):
        """
        Initialize MetaCognitiveBridge.
        
        Args:
            config_table: DynamoDB table for pymdp matrices and state
            region: AWS region
            persist: If True, persist state to DynamoDB after updates
        """
        self.signal_converter = SignalConverter()
        self.context = MetaCognitiveContext()
        self.config_table_name = config_table
        self.region = region
        self.persist = persist
        self._initialized = False
        
        # DynamoDB clients (lazy init)
        self._dynamodb = None
        self._table = None
        
        # Matrices (loaded from Genesis or defaults)
        self.A = None
        self.B = None
        self.C = None
        self.D = None
        self.agent = None
        
        logger.info("MetaCognitiveBridge created (call initialize() before use)")
    
    @property
    def dynamodb(self):
        """Lazy init DynamoDB resource."""
        if self._dynamodb is None:
            self._dynamodb = boto3.resource("dynamodb", region_name=self.region)
        return self._dynamodb
    
    @property
    def table(self):
        """Lazy init DynamoDB table."""
        if self._table is None:
            self._table = self.dynamodb.Table(self.config_table_name)
        return self._table
    
    async def initialize(self) -> bool:
        """
        Initialize the bridge by loading matrices from Genesis.
        
        MUST be called before process_observation().
        
        Returns:
            True if initialized successfully
        """
        if self._initialized:
            return True
        
        try:
            # Try to load matrices from Genesis Phase 2
            matrices_loaded = await self._load_matrices_from_genesis()
            
            if not matrices_loaded:
                logger.warning("Genesis matrices not found, using default matrices")
                self._init_default_matrices()
            
            # Try to restore state from DynamoDB
            await self._restore_state()
            
            # Initialize pymdp agent
            self._init_pymdp_agent()
            
            self._initialized = True
            logger.info("MetaCognitiveBridge initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize MetaCognitiveBridge: {e}")
            # Fall back to defaults
            self._init_default_matrices()
            self._init_pymdp_agent()
            self._initialized = True
            return True
    
    async def _load_matrices_from_genesis(self) -> bool:
        """Load A, B, C, D matrices from Genesis Phase 2 in DynamoDB."""
        try:
            response = self.table.get_item(
                Key={"pk": "PYMDP", "sk": "MATRICES"}
            )
            
            if "Item" not in response:
                return False
            
            item = response["Item"]
            
            # Convert DynamoDB format to numpy
            self.A = self._dynamo_to_numpy(item["A"])
            self.B = self._dynamo_to_numpy(item["B"])
            self.C = self._dynamo_to_numpy(item["C"])
            self.D = self._dynamo_to_numpy(item["D"])
            
            logger.info("Loaded matrices from Genesis Phase 2")
            logger.info(f"  A-matrix shape: {self.A.shape}")
            logger.info(f"  B-matrix shape: {self.B.shape}")
            
            return True
            
        except Exception as e:
            logger.warning(f"Failed to load Genesis matrices: {e}")
            return False
    
    async def _restore_state(self):
        """Restore agent state from DynamoDB."""
        try:
            response = self.table.get_item(
                Key={"pk": "PYMDP", "sk": "AGENT_STATE"}
            )
            
            if "Item" not in response:
                logger.info("No saved state found, using initial state")
                return
            
            item = response["Item"]
            
            # Restore belief state
            qs = self._dynamo_to_numpy(item.get("qs", self.D.tolist()))
            self.context.state_belief = qs
            self.context.state = MetaCognitiveState(np.argmax(qs))
            
            # Restore tick count
            tick = item.get("tick", 0)
            
            logger.info(f"Restored state from DynamoDB (tick={tick}, state={self.context.state.name})")
            
        except Exception as e:
            logger.warning(f"Failed to restore state: {e}")
    
    def _dynamo_to_numpy(self, data) -> np.ndarray:
        """Convert DynamoDB list/Decimal to numpy array."""
        def convert(x):
            if isinstance(x, list):
                return [convert(i) for i in x]
            elif isinstance(x, str):
                return float(x)
            elif hasattr(x, '__float__'):
                return float(x)
            return x
        
        return np.array(convert(data), dtype=np.float64)
    
    def _init_default_matrices(self):
        """Initialize with default matrices (Genesis-style optimistic priors)."""
        # A-matrix: P(observation | state)
        # Fix #6 applied: BORED → Progress = 0.0
        self.A = np.array([
            # CONFUSED  CONFIDENT  BORED  STAGNANT
            [0.70, 0.05, 0.10, 0.30],  # HIGH_ENTROPY
            [0.10, 0.20, 0.85, 0.20],  # LOW_ENTROPY
            [0.15, 0.05, 0.05, 0.40],  # CONTRADICTION
            [0.05, 0.70, 0.00, 0.10],  # PROGRESS (BORED=0!)
        ])
        
        # B-matrix: P(next_state | state, action)
        # Fix #2 applied: EXPLORE is optimistic (90% → CONFIDENT)
        self.B = np.zeros((4, 4, 4))
        
        # EXPLORE: Optimistic (90% success)
        self.B[:, :, 0] = np.array([
            [0.05, 0.05, 0.05, 0.05],  # → CONFUSED
            [0.90, 0.90, 0.85, 0.85],  # → CONFIDENT
            [0.03, 0.03, 0.07, 0.05],  # → BORED
            [0.02, 0.02, 0.03, 0.05],  # → STAGNANT
        ])
        
        # CONSOLIDATE
        self.B[:, :, 1] = np.array([
            [0.10, 0.05, 0.20, 0.20],
            [0.75, 0.85, 0.60, 0.60],
            [0.10, 0.07, 0.15, 0.10],
            [0.05, 0.03, 0.05, 0.10],
        ])
        
        # VERIFY
        self.B[:, :, 2] = np.array([
            [0.20, 0.10, 0.15, 0.20],
            [0.60, 0.75, 0.50, 0.50],
            [0.10, 0.10, 0.25, 0.15],
            [0.10, 0.05, 0.10, 0.15],
        ])
        
        # REST: Tends toward boredom (makes inaction unappealing)
        self.B[:, :, 3] = np.array([
            [0.20, 0.10, 0.10, 0.10],
            [0.10, 0.20, 0.10, 0.10],
            [0.40, 0.40, 0.50, 0.40],
            [0.30, 0.30, 0.30, 0.40],
        ])
        
        # C-vector: Preferences (log probabilities)
        self.C = np.array([-5.0, 3.0, -8.0, 5.0])
        
        # D-vector: Initial prior (95% CONFUSED)
        self.D = np.array([0.95, 0.01, 0.02, 0.02])
        
        logger.info("Using default Genesis-style optimistic matrices")
    
    def _init_pymdp_agent(self):
        """Initialize pymdp agent with loaded matrices."""
        if PYMDP_AVAILABLE:
            try:
                self.agent = Agent(
                    A=[self.A],
                    B=[self.B],
                    C=[self.C],
                    D=[self.D],
                    policy_len=3
                )
                logger.info("pymdp Agent initialized")
            except Exception as e:
                logger.warning(f"pymdp Agent init failed: {e}")
                self.agent = None
        else:
            self.agent = None
    
    async def update(
        self,
        observation: Observation,
        persist: Optional[bool] = None
    ) -> Tuple[MetaCognitiveState, MetaCognitiveAction]:
        """
        Update meta-cognitive state based on observation.
        
        Args:
            observation: Observed outcome from LLM
            persist: Override instance persist setting
        
        Returns:
            Tuple of (new_state, recommended_action)
        """
        if not self._initialized:
            await self.initialize()
        
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
            posterior = posterior / (posterior.sum() + 1e-10)
            state_belief = posterior
            
            # Action selection based on Expected Free Energy
            action = self._select_action_numpy(state_belief)
        
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
        
        # Persist to DynamoDB
        should_persist = persist if persist is not None else self.persist
        if should_persist:
            await self._persist_state()
        
        logger.debug(f"MetaCognitive update: obs={observation.name} → state={new_state.name}, action={new_action.name}")
        
        return new_state, new_action
    
    def _select_action_numpy(self, state_belief: np.ndarray) -> int:
        """Select action using Expected Free Energy (numpy fallback)."""
        # Compute EFE for each action
        efe = np.zeros(4)
        
        for action in range(4):
            # Expected next state under this action
            expected_next = self.B[:, :, action] @ state_belief
            
            # Expected observation under next state
            expected_obs = self.A @ expected_next
            
            # Pragmatic value: alignment with preferences
            pragmatic = np.dot(expected_obs, self.C)
            
            # Epistemic value: expected information gain (entropy reduction)
            obs_entropy = -np.sum(expected_obs * np.log(expected_obs + 1e-10))
            epistemic = -obs_entropy  # Lower entropy = more info
            
            efe[action] = pragmatic + 0.5 * epistemic
        
        # Softmax action selection
        probs = np.exp(efe - np.max(efe))
        probs = probs / probs.sum()
        
        return int(np.argmax(probs))
    
    async def _persist_state(self):
        """Persist current state to DynamoDB."""
        try:
            # Get current tick
            response = self.table.get_item(
                Key={"pk": "PYMDP", "sk": "AGENT_STATE"}
            )
            current_tick = response.get("Item", {}).get("tick", 0)
            
            self.table.update_item(
                Key={"pk": "PYMDP", "sk": "AGENT_STATE"},
                UpdateExpression="""
                    SET qs = :qs,
                        dominant_state = :state,
                        recommended_action = :action,
                        last_observation = :obs,
                        tick = :tick,
                        updated_at = :now,
                        version = if_not_exists(version, :zero) + :one
                """,
                ExpressionAttributeValues={
                    ":qs": [str(x) for x in self.context.state_belief.tolist()],
                    ":state": self.context.state.name,
                    ":action": self.context.action.name,
                    ":obs": self.context.last_observation.name if self.context.last_observation else None,
                    ":tick": current_tick + 1,
                    ":now": datetime.utcnow().isoformat() + "Z",
                    ":zero": 0,
                    ":one": 1
                }
            )
        except Exception as e:
            logger.warning(f"Failed to persist state: {e}")
    
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
            "last_update": self.context.last_update,
            "initialized": self._initialized
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
    
    async def reset(self, persist: bool = True):
        """Reset to initial state."""
        self.context = MetaCognitiveContext()
        self.context.state_belief = self.D.copy() if self.D is not None else np.array([0.95, 0.01, 0.02, 0.02])
        self.context.state = MetaCognitiveState.CONFUSED
        
        if PYMDP_AVAILABLE and self.agent:
            self.agent.reset()
        
        if persist:
            await self._persist_state()
        
        logger.info("MetaCognitiveBridge reset to initial state")
    
    async def update_preferences(self, new_C: List[float]):
        """
        Hot-reload observation preferences (C-matrix).
        
        Allows admin to adjust preferences without restarting.
        """
        self.C = np.array(new_C)
        
        if PYMDP_AVAILABLE and self.agent:
            self.agent.C = [self.C]
        
        logger.info(f"Updated C-matrix preferences: {new_C}")


# Singleton instance for global Bobble consciousness
_bridge_instance: Optional[MetaCognitiveBridge] = None


def get_meta_cognitive_bridge() -> MetaCognitiveBridge:
    """Get or create the singleton meta-cognitive bridge."""
    global _bridge_instance
    if _bridge_instance is None:
        _bridge_instance = MetaCognitiveBridge()
    return _bridge_instance
