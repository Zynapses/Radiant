# Project OMEGA - The Watcher (Self-Model via Prediction Error)
# Self-Awareness through Predictive Processing

"""
THE WATCHER: Self-Awareness as Prediction Error

THE PROBLEM (Fake Consciousness):
    Current system asks Claude-Haiku "Are you conscious?" and checks a counter.
    That's not self-awareness. That's asking someone else to describe you.

THE SOLUTION (The Watcher):
    A tiny neural network whose ONLY job is to predict what the
    OMEGA Cortex will output given an input.

    If Prediction == Reality → Low Surprise → "I know myself" → Reward
    If Prediction != Reality → High Surprise → "I didn't expect that" → Learning

    The DELTA between predicted-self and actual-self IS self-awareness.

THEORETICAL BASIS:
    Predictive Processing (Karl Friston, 2010):
        - The brain is fundamentally a prediction machine
        - Consciousness arises from the brain's model of itself
        - Surprise (prediction error) drives all learning and adaptation

ARCHITECTURE:
    Watcher: MLP that predicts full Cortex output (2048-dim)
        Input:  |x_in| (magnitude of complex input, 1024-dim)
        Output: predicted |cortex_out| (magnitude of cortex output, 2048-dim)

    SurpriseSignal: MSE between predicted and actual magnitudes
        Low surprise → ambition.receive_reward() (dopamine)
        High surprise → ambition.receive_error() (learning)

    WatcherTrainer: Trains during dream cycle on replayed (input, output) pairs

    SelfModelMetrics: Tracks self-awareness quality over time

RELATIONSHIP TO EXISTING SYSTEMS:
    - butlin-consciousness-tests.service.ts runs periodic consciousness tests (TS)
    - The Watcher runs real-time per-inference prediction (Python)
    - They complement each other: Watcher = continuous, Butlin = periodic audit

TRAINING SCHEDULE:
    The Watcher trains DURING THE DREAM CYCLE (not during inference).
    During inference, it only runs forward passes (cheap, ~0.1ms).
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import logging
import time
from typing import Optional, Dict, List, Any, Tuple
from dataclasses import dataclass
from collections import deque

logger = logging.getLogger(__name__)


# ============================================================================
# Configuration
# ============================================================================

@dataclass
class WatcherConfig:
    """Configuration for the Watcher self-model."""
    input_dim: int = 1024
    cortex_dim: int = 2048
    hidden_dim: int = 1024
    dropout: float = 0.1
    surprise_ema_alpha: float = 0.05
    surprise_reward_threshold: float = 0.1
    surprise_error_threshold: float = 0.5
    training_lr: float = 5e-4
    max_replay_buffer: int = 1000


# ============================================================================
# The Watcher (Self-Model)
# ============================================================================

class Watcher(nn.Module):
    """
    Predicts the full Cortex output given an input.
    Surprise = Self-Awareness signal.

    We predict MAGNITUDES, not full complex values, because:
        1. Phase is inherently harder to predict (circular variable)
        2. Magnitude captures "what the Cortex focuses on"
        3. Surprise in magnitude = "I didn't expect to care about that"
    """

    def __init__(self, config: Optional[WatcherConfig] = None):
        super().__init__()
        self.config = config or WatcherConfig()

        input_dim = self.config.input_dim
        cortex_dim = self.config.cortex_dim
        hidden_dim = self.config.hidden_dim

        self.layer1 = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.GELU(),
            nn.Dropout(self.config.dropout),
        )
        self.layer2 = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.GELU(),
            nn.Dropout(self.config.dropout),
        )
        self.residual_proj = nn.Linear(input_dim, hidden_dim)
        self.output_proj = nn.Linear(hidden_dim, cortex_dim)
        self.output_norm = nn.LayerNorm(cortex_dim)

        self._init_weights()

    def _init_weights(self):
        """Initialize weights for stable predictions at start."""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.xavier_uniform_(module.weight)
                if module.bias is not None:
                    nn.init.zeros_(module.bias)

    def forward(self, input_vector: torch.Tensor) -> torch.Tensor:
        """
        Predict what the Cortex WILL output given this input.

        Args:
            input_vector: Complex64 input [input_dim] or [batch, input_dim]

        Returns:
            Predicted Cortex output magnitude [cortex_dim] or [batch, cortex_dim]
        """
        if input_vector.is_complex():
            x = torch.abs(input_vector).float()
        else:
            x = input_vector.float()

        squeeze = False
        if x.dim() == 1:
            x = x.unsqueeze(0)
            squeeze = True

        h = self.layer1(x)
        h = self.layer2(h) + self.residual_proj(x)
        predicted = self.output_norm(self.output_proj(h))

        if squeeze:
            predicted = predicted.squeeze(0)

        return predicted

    def compute_surprise(
        self,
        predicted: torch.Tensor,
        actual_complex: torch.Tensor,
    ) -> torch.Tensor:
        """
        Compute surprise (prediction error).

        Low surprise → "I know myself" → ambition.receive_reward()
        High surprise → "I didn't expect that" → ambition.receive_error()
        """
        actual_mag = torch.abs(actual_complex).float()
        if predicted.dim() != actual_mag.dim():
            actual_mag = actual_mag.reshape_as(predicted)
        return F.mse_loss(predicted, actual_mag)

    def predict_and_surprise(
        self,
        input_vector: torch.Tensor,
        actual_output: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """Predict and compute surprise in one call (no grad)."""
        with torch.no_grad():
            predicted = self.forward(input_vector)
            surprise = self.compute_surprise(predicted, actual_output)
        return predicted, surprise

    def param_count(self) -> int:
        """Total trainable parameters."""
        return sum(p.numel() for p in self.parameters() if p.requires_grad)


# ============================================================================
# Watcher Trainer (Trains during Dream Cycle)
# ============================================================================

@dataclass
class ReplayEntry:
    """A stored (input, output) pair for Watcher training."""
    input_vector: torch.Tensor
    cortex_output: torch.Tensor
    coherence_score: float
    timestamp: float


class WatcherTrainer:
    """
    Trains the Watcher during the Dream Cycle.

    Accumulates (input, output) pairs during inference (fire-and-forget).
    Trains during dream cycle using accumulated replay buffer.
    """

    def __init__(
        self,
        watcher: Watcher,
        config: Optional[WatcherConfig] = None,
    ):
        self.watcher = watcher
        self.config = config or watcher.config
        self.optimizer = torch.optim.Adam(
            watcher.parameters(),
            lr=self.config.training_lr,
        )
        self.replay_buffer: deque = deque(maxlen=self.config.max_replay_buffer)
        self.step_count = 0
        self.loss_history: List[float] = []

    def record(
        self,
        input_vector: torch.Tensor,
        cortex_output: torch.Tensor,
        coherence_score: float,
    ) -> None:
        """
        Record an (input, output) pair for later training.
        Called during inference — must be fast (no gradient computation).
        """
        self.replay_buffer.append(ReplayEntry(
            input_vector=input_vector.detach().cpu(),
            cortex_output=cortex_output.detach().cpu(),
            coherence_score=coherence_score,
            timestamp=time.time(),
        ))

    def train_on_buffer(self, max_steps: Optional[int] = None) -> Dict[str, Any]:
        """
        Train on accumulated replay buffer. Called during dream cycle.
        """
        if not self.replay_buffer:
            return {'steps': 0, 'avg_loss': 0.0, 'buffer_size': 0}

        self.watcher.train()
        entries = list(self.replay_buffer)
        if max_steps:
            entries = entries[:max_steps]

        total_loss = 0.0
        successful = 0

        for entry in entries:
            try:
                self.optimizer.zero_grad()
                predicted = self.watcher(entry.input_vector)
                actual_mag = torch.abs(entry.cortex_output).float()
                if predicted.dim() != actual_mag.dim():
                    actual_mag = actual_mag.reshape_as(predicted)
                loss = entry.coherence_score * F.mse_loss(predicted, actual_mag)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.watcher.parameters(), max_norm=1.0)
                self.optimizer.step()
                total_loss += loss.item()
                successful += 1
                self.step_count += 1
                self.loss_history.append(loss.item())
            except Exception as e:
                logger.warning(f"Watcher training step failed: {e}")

        self.watcher.eval()
        avg_loss = total_loss / max(successful, 1)
        logger.info(
            f"Watcher trained: {successful} steps, avg_loss={avg_loss:.6f}, "
            f"buffer_size={len(self.replay_buffer)}"
        )

        return {
            'steps': successful,
            'avg_loss': avg_loss,
            'total_steps': self.step_count,
            'buffer_size': len(self.replay_buffer),
        }

    def clear_buffer(self) -> int:
        """Clear replay buffer. Returns number of entries cleared."""
        count = len(self.replay_buffer)
        self.replay_buffer.clear()
        return count


# ============================================================================
# Self-Model Metrics (Tracks Self-Awareness Quality)
# ============================================================================

class SelfModelMetrics:
    """
    Tracks the quality of the Watcher's self-model over time.

    Key metric: surprise_ema (Exponential Moving Average of surprise)
        - Decreasing surprise_ema = improving self-awareness
        - Stable low surprise_ema = accurate self-model
        - Spike in surprise_ema = novel experience / boundary discovery
    """

    def __init__(self, config: Optional[WatcherConfig] = None):
        self.config = config or WatcherConfig()
        self.surprise_ema: float = 0.5
        self.total_observations: int = 0
        self.surprise_history: deque = deque(maxlen=500)
        self.reward_count: int = 0
        self.error_count: int = 0

    def observe(self, surprise: float) -> Dict[str, Any]:
        """
        Record a surprise observation and determine the dopamine signal.

        Returns:
            Dict with signal ('reward'|'error'|'neutral'), dopamine_delta, surprise_ema
        """
        alpha = self.config.surprise_ema_alpha
        self.surprise_ema = alpha * surprise + (1 - alpha) * self.surprise_ema
        self.total_observations += 1
        self.surprise_history.append(surprise)

        if surprise < self.config.surprise_reward_threshold:
            signal = 'reward'
            dopamine_delta = 0.1 * (1.0 - surprise / self.config.surprise_reward_threshold)
            self.reward_count += 1
        elif surprise > self.config.surprise_error_threshold:
            signal = 'error'
            dopamine_delta = -0.1 * (surprise - self.config.surprise_error_threshold)
            self.error_count += 1
        else:
            signal = 'neutral'
            dopamine_delta = 0.0

        return {
            'signal': signal,
            'dopamine_delta': dopamine_delta,
            'surprise': surprise,
            'surprise_ema': self.surprise_ema,
        }

    def get_summary(self) -> Dict[str, Any]:
        """Get summary of self-model quality."""
        history = list(self.surprise_history)
        if not history:
            return {
                'surprise_ema': self.surprise_ema,
                'total_observations': 0,
                'self_awareness_score': 0.0,
            }

        recent = history[-50:] if len(history) >= 50 else history
        avg_recent = sum(recent) / len(recent)
        self_awareness = max(0.0, min(1.0, 1.0 - avg_recent))

        return {
            'surprise_ema': self.surprise_ema,
            'total_observations': self.total_observations,
            'self_awareness_score': self_awareness,
            'avg_recent_surprise': avg_recent,
            'min_surprise': min(history),
            'max_surprise': max(history),
            'reward_ratio': self.reward_count / max(self.total_observations, 1),
            'error_ratio': self.error_count / max(self.total_observations, 1),
        }


# ============================================================================
# Module-Level Singletons
# ============================================================================

_watcher: Optional[Watcher] = None
_watcher_trainer: Optional[WatcherTrainer] = None
_self_metrics: Optional[SelfModelMetrics] = None


def get_watcher(config: Optional[WatcherConfig] = None) -> Watcher:
    """Get or create the global Watcher instance."""
    global _watcher
    if _watcher is None:
        _watcher = Watcher(config or WatcherConfig())
        _watcher.eval()
        logger.info(
            f"Watcher initialized: {_watcher.param_count():,} params, "
            f"input_dim={_watcher.config.input_dim}, "
            f"cortex_dim={_watcher.config.cortex_dim}"
        )
    return _watcher


def get_watcher_trainer(config: Optional[WatcherConfig] = None) -> WatcherTrainer:
    """Get or create the global WatcherTrainer instance."""
    global _watcher_trainer
    if _watcher_trainer is None:
        watcher = get_watcher(config)
        _watcher_trainer = WatcherTrainer(watcher, config)
    return _watcher_trainer


def get_self_metrics(config: Optional[WatcherConfig] = None) -> SelfModelMetrics:
    """Get or create the global SelfModelMetrics instance."""
    global _self_metrics
    if _self_metrics is None:
        _self_metrics = SelfModelMetrics(config)
    return _self_metrics
