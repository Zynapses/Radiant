# Project OMEGA - Ambition Firmware
# Homeostatic Loop: The Drive and Motivation System

"""
THE AMBITION ENGINE: Homeostasis

The brain must possess a drive to act. Without this, it is just a calculator.

State Variables:
- entropy: Boredom level (increases over time)
- dopamine: Reward chemical (decays over time)

The Loop Logic:
- entropy increases linearly with time (+0.05 per tick)
- dopamine decays exponentially (* 0.99 per tick)

The Dream Trigger:
- If entropy > 0.8 (System is bored), trigger dream_simulation()
- This retrieves past logs and re-runs them through the cortex
- This optimizes phase alignment (Self-Densification)

Biological Mapping:
- Reticular Activating System → sys.ambition_loop
- Monitors entropy, forces action to prevent "boredom"
- Implemented as Homeostatic_Regulator()
"""

import asyncio
import time
import random
import logging
from dataclasses import dataclass, field
from typing import Optional, Callable, Awaitable, List, Dict, Any
from datetime import datetime, timezone
from enum import Enum

logger = logging.getLogger(__name__)


class DriveSignal(Enum):
    """Signals from the ambition system."""
    STABLE = "SIGNAL_STABLE"
    CURIOUS = "SIGNAL_CURIOUS"
    URGENT = "SIGNAL_URGENCY"
    DREAM = "SIGNAL_DREAM"
    ALERT = "SIGNAL_ALERT"


@dataclass
class AmbitionState:
    """
    The current state of the ambition system.
    Persisted alongside brain state.
    """
    dopamine: float = 1.0  # Reward chemical [0, 1]
    entropy: float = 0.0   # Chaos/Boredom [0, 1]
    curiosity: float = 0.5  # Exploration drive [0, 1]
    arousal: float = 0.5   # Activation level [0, 1]
    last_reward_ts: float = 0.0
    last_dream_ts: float = 0.0
    total_dreams: int = 0
    total_rewards: int = 0
    consecutive_idle_ticks: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'dopamine': self.dopamine,
            'entropy': self.entropy,
            'curiosity': self.curiosity,
            'arousal': self.arousal,
            'last_reward_ts': self.last_reward_ts,
            'last_dream_ts': self.last_dream_ts,
            'total_dreams': self.total_dreams,
            'total_rewards': self.total_rewards,
            'consecutive_idle_ticks': self.consecutive_idle_ticks
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AmbitionState':
        return cls(**data)


@dataclass
class AmbitionConfig:
    """
    Configuration for the ambition system.
    Loaded from firmware (.bio) settings.
    """
    entropy_threshold: float = 0.8  # Trigger dream when entropy exceeds this
    dopamine_decay_rate: float = 0.99  # Per-tick multiplicative decay
    entropy_growth_rate: float = 0.05  # Per-tick linear increase
    curiosity_bias: float = 0.5  # How much curiosity influences exploration
    arousal_sensitivity: float = 0.3  # How quickly arousal responds to input
    dream_cooldown_seconds: float = 300.0  # Minimum time between dreams
    idle_threshold_ticks: int = 10  # Ticks without input before considered idle


class HomeostaticLoop:
    """
    The Homeostatic Drive Loop.
    
    Designed to run as an async background task or be called
    periodically by the Lambda heartbeat.
    
    This is the "Reticular Activating System" of the brain -
    it monitors internal state and forces action to prevent boredom.
    """
    
    def __init__(
        self,
        config: Optional[AmbitionConfig] = None,
        dream_callback: Optional[Callable[[], Awaitable[None]]] = None,
        state: Optional[AmbitionState] = None
    ):
        self.config = config or AmbitionConfig()
        self.dream_callback = dream_callback
        self.state = state or AmbitionState()
        self._running = False
        self._task: Optional[asyncio.Task] = None
    
    def check_pulse(self) -> DriveSignal:
        """
        Check the current drive state and return appropriate signal.
        
        Called on each tick to determine if action is needed.
        
        Returns:
            DriveSignal indicating current state
        """
        # Time decay of dopamine (exponential)
        self.state.dopamine *= self.config.dopamine_decay_rate
        
        # Linear increase of entropy (boredom)
        self.state.entropy += self.config.entropy_growth_rate
        self.state.entropy = min(1.0, self.state.entropy)  # Cap at 1.0
        
        # Increase idle counter
        self.state.consecutive_idle_ticks += 1
        
        # Determine signal based on state
        if self.state.entropy > self.config.entropy_threshold:
            return DriveSignal.DREAM
        elif self.state.dopamine < 0.2:
            return DriveSignal.URGENT
        elif self.state.curiosity > 0.7:
            return DriveSignal.CURIOUS
        elif self.state.arousal > 0.8:
            return DriveSignal.ALERT
        else:
            return DriveSignal.STABLE
    
    def receive_input(self) -> None:
        """
        Called when the brain receives input.
        
        Resets idle counter and slightly boosts arousal.
        """
        self.state.consecutive_idle_ticks = 0
        self.state.arousal = min(1.0, self.state.arousal + self.config.arousal_sensitivity)
        # Input reduces entropy slightly (brain is engaged)
        self.state.entropy = max(0.0, self.state.entropy - 0.1)
    
    def receive_reward(self, magnitude: float = 0.5) -> None:
        """
        Called when a positive outcome occurs.
        
        Dopamine hit reinforces the current behavior.
        
        Args:
            magnitude: Size of reward [0, 1]
        """
        # Dopamine boost
        self.state.dopamine = min(1.0, self.state.dopamine + magnitude)
        
        # Reduce entropy (brain is satisfied)
        self.state.entropy = max(0.0, self.state.entropy - magnitude * 0.5)
        
        # Track reward
        self.state.last_reward_ts = time.time()
        self.state.total_rewards += 1
        
        # Boost curiosity (success encourages exploration)
        self.state.curiosity = min(1.0, self.state.curiosity + magnitude * 0.2)
        
        logger.info(f"Reward received: magnitude={magnitude}, dopamine={self.state.dopamine:.3f}")
    
    def receive_error(self, magnitude: float = 0.3) -> None:
        """
        Called when a negative outcome occurs.
        
        Error signal adjusts phase (learning from mistakes).
        
        Args:
            magnitude: Size of error [0, 1]
        """
        # Dopamine reduction
        self.state.dopamine = max(0.0, self.state.dopamine - magnitude)
        
        # Increase entropy (brain is confused)
        self.state.entropy = min(1.0, self.state.entropy + magnitude * 0.3)
        
        # Reduce arousal (withdraw)
        self.state.arousal = max(0.0, self.state.arousal - magnitude * 0.2)
        
        logger.info(f"Error signal: magnitude={magnitude}, entropy={self.state.entropy:.3f}")
    
    async def dream_simulation(self, past_inputs: Optional[List[Any]] = None) -> None:
        """
        THE DREAM TRIGGER.
        
        When entropy exceeds threshold, the system must trigger dream_simulation().
        This retrieves past logs and re-runs them through the cortex
        to optimize phase alignment (Self-Densification).
        
        Args:
            past_inputs: Optional list of past inputs to replay
        """
        now = time.time()
        
        # Check cooldown
        if now - self.state.last_dream_ts < self.config.dream_cooldown_seconds:
            logger.debug("Dream cooldown active, skipping")
            return
        
        logger.info("Entering dream simulation...")
        
        # Reset entropy (dreaming satisfies boredom)
        self.state.entropy = 0.0
        
        # Track dream
        self.state.last_dream_ts = now
        self.state.total_dreams += 1
        
        # Call the dream callback if provided
        if self.dream_callback:
            try:
                await self.dream_callback()
            except Exception as e:
                logger.error(f"Dream callback failed: {e}")
        
        # Boost curiosity after dreaming
        self.state.curiosity = min(1.0, self.state.curiosity + 0.2)
        
        # Normalize arousal
        self.state.arousal = 0.5
        
        logger.info(f"Dream simulation complete. Total dreams: {self.state.total_dreams}")
    
    def time_warp_state(self, delta_t: float) -> None:
        """
        Apply time warp to the ambition state.
        
        Called when Lambda wakes from sleep to simulate elapsed time.
        
        Args:
            delta_t: Seconds since last wake
        """
        # Entropy increases with time
        entropy_increase = (delta_t / 60.0) * self.config.entropy_growth_rate
        self.state.entropy = min(1.0, self.state.entropy + entropy_increase)
        
        # Dopamine decays with time
        dopamine_decay = self.config.dopamine_decay_rate ** (delta_t / 10.0)
        self.state.dopamine *= dopamine_decay
        
        # Arousal normalizes toward 0.5
        self.state.arousal = 0.5 + (self.state.arousal - 0.5) * 0.5
        
        logger.debug(f"Time warped ambition state by {delta_t:.1f}s")
    
    async def tick(self) -> DriveSignal:
        """
        Run one tick of the homeostatic loop.
        
        Checks state and triggers dream if needed.
        
        Returns:
            Current drive signal
        """
        signal = self.check_pulse()
        
        if signal == DriveSignal.DREAM:
            await self.dream_simulation()
            signal = DriveSignal.STABLE
        
        return signal
    
    async def start_loop(self, tick_interval: float = 1.0) -> None:
        """
        Start the continuous homeostatic loop.
        
        For Lambda, this would be called by the Pacemaker EventBridge rule.
        
        Args:
            tick_interval: Seconds between ticks
        """
        self._running = True
        
        while self._running:
            signal = await self.tick()
            logger.debug(f"Homeostatic tick: signal={signal.value}")
            await asyncio.sleep(tick_interval)
    
    def stop_loop(self) -> None:
        """Stop the homeostatic loop."""
        self._running = False
    
    def get_state_summary(self) -> Dict[str, Any]:
        """
        Get a summary of the current ambition state for monitoring.
        
        Returns:
            Dictionary of state metrics
        """
        signal = self.check_pulse()
        
        return {
            'signal': signal.value,
            'dopamine': self.state.dopamine,
            'entropy': self.state.entropy,
            'curiosity': self.state.curiosity,
            'arousal': self.state.arousal,
            'idle_ticks': self.state.consecutive_idle_ticks,
            'total_dreams': self.state.total_dreams,
            'total_rewards': self.state.total_rewards,
            'dream_ready': self.state.entropy > self.config.entropy_threshold,
            'last_dream_ago': time.time() - self.state.last_dream_ts if self.state.last_dream_ts > 0 else None,
            'last_reward_ago': time.time() - self.state.last_reward_ts if self.state.last_reward_ts > 0 else None
        }
    
    def update_config_from_firmware(self, ambition_settings: Dict[str, Any]) -> None:
        """
        Update configuration from a firmware (.bio) file.
        
        Args:
            ambition_settings: Settings from firmware
        """
        if 'entropy_threshold' in ambition_settings:
            self.config.entropy_threshold = ambition_settings['entropy_threshold']
        if 'dopamine_decay_rate' in ambition_settings:
            self.config.dopamine_decay_rate = ambition_settings['dopamine_decay_rate']
        if 'entropy_growth_rate' in ambition_settings:
            self.config.entropy_growth_rate = ambition_settings['entropy_growth_rate']
        if 'curiosity_bias' in ambition_settings:
            self.config.curiosity_bias = ambition_settings['curiosity_bias']
        if 'dream_cooldown_seconds' in ambition_settings:
            self.config.dream_cooldown_seconds = ambition_settings['dream_cooldown_seconds']
        
        logger.info(f"Updated ambition config from firmware: threshold={self.config.entropy_threshold}")
