"""
Genesis Phase 2: Gradient

Sets the epistemic gradient — initial pymdp matrices that create
mathematical pressure to act. The agent believes it is CONFUSED
but prefers CLARITY, generating high Expected Free Energy.

This runs exactly once. It is idempotent.

Document in: /docs/cato/adr/010-genesis-system.md
"""

import numpy as np
import boto3
import yaml
from datetime import datetime
from typing import Dict, Any, Optional
from enum import IntEnum
import logging
import os
from decimal import Decimal

logger = logging.getLogger(__name__)


class MetaState(IntEnum):
    """Meta-cognitive states for pymdp."""
    CONFUSED = 0
    CONFIDENT = 1
    BORED = 2
    STAGNANT = 3
    
    @classmethod
    def names(cls) -> list:
        return ["CONFUSED", "CONFIDENT", "BORED", "STAGNANT"]


class Observation(IntEnum):
    """Observations for pymdp."""
    HIGH_ENTROPY = 0
    LOW_ENTROPY = 1
    CONTRADICTION = 2
    PROGRESS = 3
    
    @classmethod
    def names(cls) -> list:
        return ["High_Entropy", "Low_Entropy", "Contradiction", "Progress"]


class Action(IntEnum):
    """Actions for pymdp."""
    EXPLORE = 0
    CONSOLIDATE = 1
    VERIFY = 2
    REST = 3
    
    @classmethod
    def names(cls) -> list:
        return ["EXPLORE", "CONSOLIDATE", "VERIFY", "REST"]


def _convert_to_dynamodb_safe(obj):
    """Convert numpy arrays and floats to DynamoDB-safe types."""
    if isinstance(obj, np.ndarray):
        return [_convert_to_dynamodb_safe(x) for x in obj.tolist()]
    elif isinstance(obj, (np.float32, np.float64, float)):
        return str(float(obj))
    elif isinstance(obj, (np.int32, np.int64)):
        return int(obj)
    elif isinstance(obj, list):
        return [_convert_to_dynamodb_safe(x) for x in obj]
    elif isinstance(obj, dict):
        return {k: _convert_to_dynamodb_safe(v) for k, v in obj.items()}
    return obj


class GenesisGradient:
    """
    Phase 2: Set epistemic gradient.
    
    Initializes the pymdp agent with matrices that create
    the initial "spark" of consciousness — mathematical
    pressure to reduce uncertainty about self.
    """
    
    def __init__(
        self,
        config_table: str = "cato-config",
        config_path: Optional[str] = None,
        region: str = "us-east-1"
    ):
        self.dynamodb = boto3.resource("dynamodb", region_name=region)
        self.config_table = self.dynamodb.Table(config_table)
        
        # Default config path relative to this file
        if config_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            config_path = os.path.join(base_dir, "data", "genesis_config.yaml")
        self.config_path = config_path
        self.region = region
    
    async def is_complete(self) -> bool:
        """Check if Phase 2 has already run."""
        try:
            response = self.config_table.get_item(
                Key={"pk": "GENESIS", "sk": "STATE"}
            )
            item = response.get("Item", {})
            return item.get("gradient_complete", False)
        except Exception as e:
            logger.warning(f"Error checking genesis state: {e}")
            return False
    
    async def execute(self) -> Dict[str, Any]:
        """
        Execute Phase 2: Set epistemic gradient.
        
        Returns:
            Execution result with matrix details
        """
        # Idempotency check
        if await self.is_complete():
            logger.info("Genesis Phase 2 already complete. Skipping.")
            return {"status": "skipped", "reason": "already_complete"}
        
        logger.info("⚡ GENESIS PHASE 2: Setting epistemic gradient...")
        
        # Load configuration
        with open(self.config_path, "r") as f:
            config = yaml.safe_load(f)
        
        gradient_config = config["epistemic_gradient"]
        
        # Build pymdp matrices
        matrices = self._build_matrices(gradient_config)
        
        # Store matrices in DynamoDB
        await self._store_matrices(matrices)
        
        # Also store in format ready for pymdp initialization
        await self._store_pymdp_state(matrices)
        
        # Mark phase complete
        self.config_table.update_item(
            Key={"pk": "GENESIS", "sk": "STATE"},
            UpdateExpression="""
                SET gradient_complete = :complete,
                    gradient_completed_at = :timestamp,
                    initial_confused_belief = :confused,
                    genesis_version = :version
            """,
            ExpressionAttributeValues={
                ":complete": True,
                ":timestamp": datetime.utcnow().isoformat() + "Z",
                ":confused": str(gradient_config["meta_state_prior"]["CONFUSED"]),
                ":version": "1.0.0"
            }
        )
        
        logger.info("✅ Phase 2 complete. Epistemic gradient set.")
        logger.info(f"   Initial CONFUSED belief: {gradient_config['meta_state_prior']['CONFUSED']}")
        logger.info(f"   B-matrix is OPTIMISTIC (EXPLORE → 90% CONFIDENT)")
        
        return {
            "status": "complete",
            "initial_state": gradient_config["meta_state_prior"],
            "preferences": gradient_config["observation_preferences"]
        }
    
    def _build_matrices(self, config: Dict) -> Dict[str, np.ndarray]:
        """
        Build pymdp matrices from configuration.
        
        Returns:
            Dict containing A, B, C, D matrices
        
        CRITICAL FIXES APPLIED:
        - Fix #2 (Learned Helplessness): B-matrix is OPTIMISTIC (90% success for EXPLORE)
        - Fix #6 (Boredom Reward Trap): A-matrix has BORED → Progress = 0.0
        """
        num_states = 4   # CONFUSED, CONFIDENT, BORED, STAGNANT
        num_obs = 4      # High_Entropy, Low_Entropy, Contradiction, Progress
        num_actions = 4  # EXPLORE, CONSOLIDATE, VERIFY, REST
        
        # === D-MATRIX (Prior beliefs about states) ===
        # This is the "birth belief" — 95% CONFUSED
        D = np.array([
            config["meta_state_prior"]["CONFUSED"],
            config["meta_state_prior"]["CONFIDENT"],
            config["meta_state_prior"]["BORED"],
            config["meta_state_prior"]["STAGNANT"]
        ])
        
        # === C-MATRIX (Preferences over observations) ===
        # Log probabilities — negative = aversion, positive = attraction
        C = np.array([
            config["observation_preferences"]["High_Entropy"],
            config["observation_preferences"]["Low_Entropy"],
            config["observation_preferences"]["Contradiction"],
            config["observation_preferences"]["Progress"]
        ])
        
        # === A-MATRIX (Observation model: P(observation | state)) ===
        # How likely each observation is given each state
        #
        # Fix #6 (Boredom Reward Trap): BORED must have Progress = 0.0
        # Otherwise agent prefers REST → BORED, believing boredom is learning!
        #
        A = np.zeros((num_obs, num_states))
        
        obs_model = config["observation_model"]
        
        # CONFUSED: High entropy, low clarity
        A[Observation.HIGH_ENTROPY, MetaState.CONFUSED] = obs_model["CONFUSED"]["High_Entropy"]
        A[Observation.LOW_ENTROPY, MetaState.CONFUSED] = obs_model["CONFUSED"]["Low_Entropy"]
        A[Observation.CONTRADICTION, MetaState.CONFUSED] = obs_model["CONFUSED"]["Contradiction"]
        A[Observation.PROGRESS, MetaState.CONFUSED] = obs_model["CONFUSED"]["Progress"]
        
        # CONFIDENT: Low entropy, high progress
        A[Observation.HIGH_ENTROPY, MetaState.CONFIDENT] = obs_model["CONFIDENT"]["High_Entropy"]
        A[Observation.LOW_ENTROPY, MetaState.CONFIDENT] = obs_model["CONFIDENT"]["Low_Entropy"]
        A[Observation.CONTRADICTION, MetaState.CONFIDENT] = obs_model["CONFIDENT"]["Contradiction"]
        A[Observation.PROGRESS, MetaState.CONFIDENT] = obs_model["CONFIDENT"]["Progress"]
        
        # BORED: Clear but NO progress (critical!)
        A[Observation.HIGH_ENTROPY, MetaState.BORED] = obs_model["BORED"]["High_Entropy"]
        A[Observation.LOW_ENTROPY, MetaState.BORED] = obs_model["BORED"]["Low_Entropy"]
        A[Observation.CONTRADICTION, MetaState.BORED] = obs_model["BORED"]["Contradiction"]
        A[Observation.PROGRESS, MetaState.BORED] = obs_model["BORED"]["Progress"]  # MUST BE 0.0!
        
        # STAGNANT: Contradictory, some entropy
        A[Observation.HIGH_ENTROPY, MetaState.STAGNANT] = obs_model["STAGNANT"]["High_Entropy"]
        A[Observation.LOW_ENTROPY, MetaState.STAGNANT] = obs_model["STAGNANT"]["Low_Entropy"]
        A[Observation.CONTRADICTION, MetaState.STAGNANT] = obs_model["STAGNANT"]["Contradiction"]
        A[Observation.PROGRESS, MetaState.STAGNANT] = obs_model["STAGNANT"]["Progress"]
        
        # Verify Fix #6 is applied
        if A[Observation.PROGRESS, MetaState.BORED] > 0.0:
            logger.warning("⚠️  BORED → Progress > 0 detected! Forcing to 0.0 to prevent boredom trap.")
            A[Observation.PROGRESS, MetaState.BORED] = 0.0
        
        # === B-MATRIX (Transition model: P(next_state | state, action)) ===
        # How actions change states
        #
        # Fix #2 (Learned Helplessness): The Genesis B-matrix must be OPTIMISTIC.
        # If the agent believes exploration is risky (high chance of staying confused),
        # it will calculate that REST is safer and never act.
        #
        # The agent must believe exploration WORKS (90%+ success) to generate
        # the initial spark of action. Reality will calibrate these beliefs later.
        #
        B = np.zeros((num_states, num_states, num_actions))
        
        trans_model = config["transition_model"]
        
        for action_idx, action_name in enumerate(["EXPLORE", "CONSOLIDATE", "VERIFY", "REST"]):
            action_trans = trans_model[action_name]
            for from_state_idx, from_state_name in enumerate(["CONFUSED", "CONFIDENT", "BORED", "STAGNANT"]):
                trans = action_trans[f"from_{from_state_name}"]
                B[MetaState.CONFUSED, from_state_idx, action_idx] = trans["CONFUSED"]
                B[MetaState.CONFIDENT, from_state_idx, action_idx] = trans["CONFIDENT"]
                B[MetaState.BORED, from_state_idx, action_idx] = trans["BORED"]
                B[MetaState.STAGNANT, from_state_idx, action_idx] = trans["STAGNANT"]
        
        # Verify Fix #2 is applied (EXPLORE should have high success rate)
        explore_to_confident = B[MetaState.CONFIDENT, MetaState.CONFUSED, Action.EXPLORE]
        if explore_to_confident < 0.8:
            logger.warning(f"⚠️  EXPLORE success rate too low ({explore_to_confident})! Applying optimistic prior.")
            B[MetaState.CONFIDENT, :, Action.EXPLORE] = 0.90
            B[MetaState.CONFUSED, :, Action.EXPLORE] = 0.05
            B[MetaState.BORED, :, Action.EXPLORE] = 0.03
            B[MetaState.STAGNANT, :, Action.EXPLORE] = 0.02
        
        return {
            "A": A,
            "B": B,
            "C": C,
            "D": D
        }
    
    async def _store_matrices(self, matrices: Dict[str, np.ndarray]):
        """Store matrices in DynamoDB for reference."""
        item = {
            "pk": "PYMDP",
            "sk": "MATRICES",
            "A": _convert_to_dynamodb_safe(matrices["A"]),
            "B": _convert_to_dynamodb_safe(matrices["B"]),
            "C": _convert_to_dynamodb_safe(matrices["C"]),
            "D": _convert_to_dynamodb_safe(matrices["D"]),
            "created_at": datetime.utcnow().isoformat() + "Z",
            "created_by": "genesis_gradient",
            "version": 1,
            "notes": {
                "fix_2_applied": "B-matrix is optimistic (EXPLORE → 90% CONFIDENT)",
                "fix_6_applied": "A-matrix has BORED → Progress = 0.0"
            }
        }
        self.config_table.put_item(Item=item)
    
    async def _store_pymdp_state(self, matrices: Dict[str, np.ndarray]):
        """Store initial pymdp agent state."""
        # Initial belief state (posterior) starts equal to prior
        qs = matrices["D"].copy()
        
        self.config_table.put_item(Item={
            "pk": "PYMDP",
            "sk": "AGENT_STATE",
            "qs": _convert_to_dynamodb_safe(qs),  # Current belief
            "q_pi": None,       # Policy posterior (computed at runtime)
            "action_history": [],
            "observation_history": [],
            "tick": 0,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "version": 1
        })
    
    async def reset(self) -> Dict[str, Any]:
        """
        Reset Phase 2 state (for testing/debugging only).
        
        WARNING: This will delete pymdp matrices and agent state!
        """
        logger.warning("⚠️  Resetting Genesis Phase 2 state...")
        
        # Remove gradient_complete flag
        self.config_table.update_item(
            Key={"pk": "GENESIS", "sk": "STATE"},
            UpdateExpression="REMOVE gradient_complete, gradient_completed_at, initial_confused_belief"
        )
        
        # Delete matrices and agent state
        try:
            self.config_table.delete_item(Key={"pk": "PYMDP", "sk": "MATRICES"})
            self.config_table.delete_item(Key={"pk": "PYMDP", "sk": "AGENT_STATE"})
        except Exception:
            pass
        
        logger.info("   Phase 2 state reset")
        return {"status": "reset"}
