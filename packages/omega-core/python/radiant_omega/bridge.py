# Project OMEGA - Neural Bridge (The Transducer)
# Closes the Air Gap between OMEGA Cortex (Complex^2048) and LLM (Real^4096)

"""
THE NEURAL BRIDGE: System Telepathy

THE PROBLEM (The Air Gap):
    OMEGA thinks in Complex64 tensors (2048-dim brain state).
    The LLM thinks in Float16 token embeddings (4096-dim).
    Currently they communicate via TEXT — losing 99% of signal fidelity.
    This is Einstein explaining Relativity with emojis.

THE SOLUTION (Telepathy):
    NeuralTransducer projects OMEGA's Complex Phase Space directly into
    the LLM's Embedding Space as a sequence of "Soft Ghost Tokens."

    Old Way: OMEGA → text: "Be empathetic" → LLM system prompt (Lossy)
    New Way: OMEGA → ψ(empathy) → Transducer → [8, 4096] → vLLM injection

    The LLM doesn't know WHY it's being empathetic. It just IS.
    The thought vector becomes the LLM's subconscious.

ARCHITECTURE:
    NeuralTransducer: Complex^2048 → Real^[8, 4096]
        1. Decompose complex tensor: Magnitude (Confidence) + Phase (Context)
        2. Project each through learned linear layers to llm_dim
        3. Gated fusion: learned gate balances Magnitude vs Phase signal
        4. Token expansion: single fused vector → 8 soft prompt tokens
        5. LayerNorm + norm clamping for injection safety

    BridgeTrainer: Contrastive learning loop using Shadow Mode data
        - Positive pairs: OMEGA vector + high-coherence LLM hidden states
        - Loss: Weighted MSE between soft tokens and actual LLM hidden states
        - Training schedule: During dream cycle (offline, zero inference impact)

    ThoughtVectorCache: Per-tenant cache of recent transduced vectors
        Enables "mood persistence" across turns without re-running OMEGA.

SHADOW MODE:
    The Neural Bridge runs alongside the existing LoRA adapter system.
    LoRA = permanent personality (weight-level modification).
    Bridge = real-time OMEGA conditioning (activation-level injection).
    Both coexist — Bridge does NOT replace LoRA.

AWS Execution:
    The Transducer is ~33M params. Runs on CPU (Graviton) in the same
    Lambda as the OMEGA Cortex. Zero additional infrastructure cost.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import math
import os
import json
import logging
from typing import Optional, Dict, List, Tuple, Any
from dataclasses import dataclass, field, asdict
from collections import OrderedDict

logger = logging.getLogger(__name__)


# ============================================================================
# Configuration
# ============================================================================

@dataclass
class BridgeConfig:
    """Configuration for the Neural Bridge."""
    omega_dim: int = 2048        # OMEGA Cortex hidden_dim (brain state)
    llm_dim: int = 4096          # Llama-3 hidden dimension
    num_soft_tokens: int = 8     # Number of soft prompt tokens to generate
    dropout: float = 0.1         # Dropout for training stability
    gate_bias: float = -2.0      # Initial gate bias (start conservative)
    max_injection_norm: float = 5.0  # Clamp injection norm for safety
    cache_size: int = 32         # Per-tenant thought vector cache size
    training_lr: float = 1e-4    # Learning rate for BridgeTrainer
    warmup_steps: int = 100      # Warmup steps before full learning rate


# ============================================================================
# The Neural Transducer
# ============================================================================

class NeuralTransducer(nn.Module):
    """
    The Telepathy Layer.

    Converts OMEGA Thought Waves (Complex^omega_dim)
    into LLM Soft Prompt Embeddings (Real^[num_tokens, llm_dim]).

    The output is NOT a text prompt. It is a sequence of embedding vectors
    that get prepended to the LLM's input embeddings. The LLM processes
    these as if they were real token embeddings — but they encode
    OMEGA's internal state (emotion, confidence, intent, safety posture).

    Architecture:
        1. Decompose: ψ → (|ψ| = Magnitude, ∠ψ = Phase)
        2. Project:   Magnitude → R^llm_dim (Confidence signal)
                      Phase     → R^llm_dim (Context signal)
        3. Gate:      Learned sigmoid gate controls Mag/Phase balance
        4. Expand:    Single vector → num_soft_tokens via learned expansion
        5. Normalize: LayerNorm + norm clamping for injection safety
    """

    def __init__(self, config: Optional[BridgeConfig] = None):
        super().__init__()
        self.config = config or BridgeConfig()

        omega_dim = self.config.omega_dim
        llm_dim = self.config.llm_dim
        num_tokens = self.config.num_soft_tokens

        # --- Stage 1: Decomposition Projections ---
        # Magnitude captures "how strongly does OMEGA feel about this"
        # Phase captures "what is OMEGA feeling / thinking about"
        self.mag_proj = nn.Sequential(
            nn.Linear(omega_dim, llm_dim),
            nn.GELU(),
            nn.Dropout(self.config.dropout),
        )
        self.phase_proj = nn.Sequential(
            nn.Linear(omega_dim, llm_dim),
            nn.GELU(),
            nn.Dropout(self.config.dropout),
        )

        # --- Stage 2: Gated Fusion ---
        # The gate learns how much to trust Magnitude vs Phase
        # Initialized with negative bias → conservative (trusts neither fully)
        self.gate = nn.Sequential(
            nn.Linear(llm_dim * 2, llm_dim),
            nn.Sigmoid(),
        )
        nn.init.constant_(self.gate[0].bias, self.config.gate_bias)

        # --- Stage 3: Token Expansion ---
        # Expand single fused vector into num_soft_tokens embeddings
        self.token_expander = nn.Linear(llm_dim, num_tokens * llm_dim)

        # --- Stage 4: Output Normalization ---
        self.output_norm = nn.LayerNorm(llm_dim)

        # Initialize weights with small values for stable injection
        self._init_weights()

    def _init_weights(self):
        """Initialize with small weights to prevent disrupting the LLM on first use."""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.normal_(module.weight, std=0.02)
                if module.bias is not None and module not in [self.gate[0]]:
                    nn.init.zeros_(module.bias)

    def forward(
        self,
        complex_tensor: torch.Tensor,
        injection_strength: float = 1.0,
    ) -> torch.Tensor:
        """
        Convert OMEGA thought vector to LLM-injectable soft prompt embeddings.

        Args:
            complex_tensor: OMEGA output (Complex64, shape: [omega_dim] or [batch, omega_dim])
            injection_strength: Scale factor (0.0 = no injection, 1.0 = full)

        Returns:
            Soft prompt embeddings (Float32, shape: [num_tokens, llm_dim]
            or [batch, num_tokens, llm_dim])
        """
        squeeze = False
        if complex_tensor.dim() == 1:
            complex_tensor = complex_tensor.unsqueeze(0)
            squeeze = True

        batch_size = complex_tensor.shape[0]

        # --- Decompose: ψ → Magnitude + Phase ---
        magnitude = torch.abs(complex_tensor).float()
        phase = torch.angle(complex_tensor).float()

        # --- Project to LLM space ---
        h_mag = self.mag_proj(magnitude)
        h_phase = self.phase_proj(phase)

        # --- Gated Fusion ---
        combined = torch.cat([h_mag, h_phase], dim=-1)
        gate_values = self.gate(combined)
        fused = gate_values * h_mag + (1 - gate_values) * h_phase

        # --- Expand to multiple soft tokens ---
        expanded = self.token_expander(fused)
        soft_tokens = expanded.view(
            batch_size, self.config.num_soft_tokens, self.config.llm_dim
        )

        # --- Normalize ---
        soft_tokens = self.output_norm(soft_tokens)

        # --- Safety: Clamp norm to prevent LLM destabilization ---
        max_norm = self.config.max_injection_norm
        token_norms = soft_tokens.norm(dim=-1, keepdim=True)
        soft_tokens = torch.where(
            token_norms > max_norm,
            soft_tokens * (max_norm / (token_norms + 1e-8)),
            soft_tokens,
        )

        # --- Apply injection strength ---
        result = soft_tokens * injection_strength

        if squeeze:
            result = result.squeeze(0)

        return result

    def get_injection_metadata(self, complex_tensor: torch.Tensor) -> Dict[str, Any]:
        """
        Extract metadata about the thought vector for logging/monitoring.
        Does NOT run the full forward pass — just analyzes the input.
        """
        with torch.no_grad():
            mag = torch.abs(complex_tensor).float()
            phase = torch.angle(complex_tensor).float()
            phase_vector = torch.exp(1j * phase.to(torch.complex64))
            coherence = torch.abs(phase_vector.mean()).item()

            return {
                'magnitude_mean': mag.mean().item(),
                'magnitude_std': mag.std().item(),
                'phase_mean': phase.mean().item(),
                'phase_std': phase.std().item(),
                'coherence_estimate': coherence,
                'omega_dim': complex_tensor.shape[-1],
                'num_soft_tokens': self.config.num_soft_tokens,
            }

    def param_count(self) -> int:
        """Total trainable parameters."""
        return sum(p.numel() for p in self.parameters() if p.requires_grad)


# ============================================================================
# Bridge Trainer (Contrastive Learning from Shadow Mode)
# ============================================================================

@dataclass
class TrainingExample:
    """A single training example from Shadow Mode logs."""
    omega_vector: torch.Tensor
    target_hidden_states: torch.Tensor
    coherence_score: float
    tenant_id: str
    timestamp: float


class BridgeTrainer:
    """
    Trains the NeuralTransducer using Shadow Mode data.

    Data source: omega-shadow.service.ts collects paired data during Shadow Mode:
      - OMEGA thought vectors (from Cortex)
      - LLM hidden states (from Ghost Vector Manager / vLLM --return-hidden-states)
      - Coherence scores (alignment between OMEGA and Legacy LLM)

    Training happens OFFLINE during the Dream Cycle:
      1. Load replay logs from the day's Shadow Mode runs
      2. For each (omega_vector, llm_hidden_states, coherence) triple:
         - Forward pass through Transducer → soft_tokens [8, 4096]
         - Compare against first 8 actual LLM hidden states
         - Weighted MSE loss (high coherence = high weight)
      3. Update Transducer weights
    """

    def __init__(
        self,
        transducer: NeuralTransducer,
        config: Optional[BridgeConfig] = None,
    ):
        self.transducer = transducer
        self.config = config or transducer.config
        self.optimizer = torch.optim.AdamW(
            transducer.parameters(),
            lr=self.config.training_lr,
            weight_decay=0.01,
        )
        self.scheduler = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(
            self.optimizer,
            T_0=50,
            T_mult=2,
        )
        self.step_count = 0
        self.loss_history: List[float] = []

    def train_step(
        self,
        omega_vector: torch.Tensor,
        target_hidden_states: torch.Tensor,
        coherence_score: float,
    ) -> float:
        """
        Single training step.

        Args:
            omega_vector: Complex64 [2048] from Cortex
            target_hidden_states: Float32 [seq_len, 4096] from vLLM Ghost extraction
            coherence_score: float 0.0-1.0, weight for this example

        Returns:
            Loss value (float)
        """
        self.transducer.train()
        self.optimizer.zero_grad()

        soft_tokens = self.transducer(omega_vector)
        if soft_tokens.dim() == 2:
            soft_tokens = soft_tokens.unsqueeze(0)

        if target_hidden_states.dim() == 2:
            target_hidden_states = target_hidden_states.unsqueeze(0)

        num_target_tokens = min(
            self.config.num_soft_tokens,
            target_hidden_states.shape[1],
        )
        target = target_hidden_states[:, :num_target_tokens, :]
        predicted = soft_tokens[:, :num_target_tokens, :]

        loss = coherence_score * F.mse_loss(predicted, target)

        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.transducer.parameters(), max_norm=1.0)
        self.optimizer.step()
        self.scheduler.step()
        self.step_count += 1

        loss_val = loss.item()
        self.loss_history.append(loss_val)

        if self.step_count % 10 == 0:
            avg_loss = sum(self.loss_history[-10:]) / min(10, len(self.loss_history))
            logger.info(
                f"BridgeTrainer step {self.step_count}: "
                f"loss={loss_val:.6f}, avg_loss={avg_loss:.6f}, "
                f"lr={self.optimizer.param_groups[0]['lr']:.2e}"
            )

        return loss_val

    def train_batch(self, examples: List[TrainingExample]) -> Dict[str, Any]:
        """Train on a batch of examples from Shadow Mode logs."""
        if not examples:
            return {'steps': 0, 'avg_loss': 0.0, 'skipped': 0}

        total_loss = 0.0
        successful_steps = 0
        skipped = 0

        for ex in examples:
            try:
                loss = self.train_step(
                    ex.omega_vector,
                    ex.target_hidden_states,
                    ex.coherence_score,
                )
                total_loss += loss
                successful_steps += 1
            except Exception as e:
                logger.warning(f"Training step failed: {e}")
                skipped += 1

        avg_loss = total_loss / max(successful_steps, 1)
        return {
            'steps': successful_steps,
            'skipped': skipped,
            'avg_loss': avg_loss,
            'total_steps': self.step_count,
            'lr': self.optimizer.param_groups[0]['lr'],
        }

    def get_training_summary(self) -> Dict[str, Any]:
        """Get summary of training history."""
        if not self.loss_history:
            return {'total_steps': 0, 'avg_loss': 0.0}

        return {
            'total_steps': self.step_count,
            'recent_avg_loss': sum(self.loss_history[-50:]) / min(50, len(self.loss_history)),
            'all_time_avg_loss': sum(self.loss_history) / len(self.loss_history),
            'min_loss': min(self.loss_history),
            'max_loss': max(self.loss_history),
            'lr': self.optimizer.param_groups[0]['lr'],
        }


# ============================================================================
# Thought Vector Cache (Per-Tenant Mood Persistence)
# ============================================================================

class ThoughtVectorCache:
    """
    Per-tenant cache of recently transduced thought vectors.

    Enables "mood persistence" — the LLM's emotional conditioning
    carries across multiple turns without re-running OMEGA every time.
    """

    def __init__(self, max_per_tenant: int = 32):
        self.max_per_tenant = max_per_tenant
        self._cache: Dict[str, OrderedDict] = {}

    def store(
        self,
        tenant_id: str,
        session_id: str,
        soft_tokens: torch.Tensor,
        metadata: Dict[str, Any],
    ) -> None:
        """Store a transduced thought vector."""
        if tenant_id not in self._cache:
            self._cache[tenant_id] = OrderedDict()

        cache = self._cache[tenant_id]
        cache[session_id] = {
            'soft_tokens': soft_tokens.detach().cpu(),
            'metadata': metadata,
        }
        cache.move_to_end(session_id)

        while len(cache) > self.max_per_tenant:
            cache.popitem(last=False)

    def get(
        self,
        tenant_id: str,
        session_id: str,
    ) -> Optional[Tuple[torch.Tensor, Dict[str, Any]]]:
        """Retrieve a cached thought vector."""
        cache = self._cache.get(tenant_id)
        if not cache or session_id not in cache:
            return None

        entry = cache[session_id]
        cache.move_to_end(session_id)
        return entry['soft_tokens'], entry['metadata']

    def invalidate(self, tenant_id: str, session_id: Optional[str] = None) -> None:
        """Invalidate cached vectors for a tenant or session."""
        if session_id:
            cache = self._cache.get(tenant_id)
            if cache and session_id in cache:
                del cache[session_id]
        elif tenant_id in self._cache:
            del self._cache[tenant_id]

    def stats(self) -> Dict[str, Any]:
        """Cache statistics."""
        total_entries = sum(len(c) for c in self._cache.values())
        return {
            'tenants': len(self._cache),
            'total_entries': total_entries,
            'max_per_tenant': self.max_per_tenant,
        }


# ============================================================================
# Module-Level Singletons
# ============================================================================

_transducer: Optional[NeuralTransducer] = None
_trainer: Optional[BridgeTrainer] = None
_cache: Optional[ThoughtVectorCache] = None


def get_transducer(config: Optional[BridgeConfig] = None) -> NeuralTransducer:
    """Get or create the global NeuralTransducer instance."""
    global _transducer
    if _transducer is None:
        _transducer = NeuralTransducer(config or BridgeConfig())
        logger.info(
            f"NeuralTransducer initialized: {_transducer.param_count():,} params, "
            f"omega_dim={_transducer.config.omega_dim}, "
            f"llm_dim={_transducer.config.llm_dim}, "
            f"num_tokens={_transducer.config.num_soft_tokens}"
        )
    return _transducer


def get_trainer(config: Optional[BridgeConfig] = None) -> BridgeTrainer:
    """Get or create the global BridgeTrainer instance."""
    global _trainer
    if _trainer is None:
        transducer = get_transducer(config)
        _trainer = BridgeTrainer(transducer, config)
    return _trainer


def get_thought_cache() -> ThoughtVectorCache:
    """Get or create the global ThoughtVectorCache instance."""
    global _cache
    if _cache is None:
        _cache = ThoughtVectorCache()
    return _cache
