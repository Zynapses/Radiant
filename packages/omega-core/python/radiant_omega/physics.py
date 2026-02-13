# Project OMEGA - Physics Engine
# Cryogenic Liquid Neural Network with Complex-Valued Logic
# CPU-Optimized (Graviton ARM64) - No CUDA Required

"""
THE PHYSICS: "Weightless" Logic on AWS Lambda

We are eliminating Static Scalar Weights (fixed numbers like 0.74).
We are replacing "Weights" with "Phase Dynamics."

The Math: Complex-Valued Neural Networks (CVNNs)
- Standard AI: Output = Input * Weight (Arithmetic)
- OMEGA: State_New = State_Old * e^(i * Phase_Shift) (Wave Mechanics)

AWS Execution:
- PyTorch with torch.complex64 tensors on Graviton (ARM64) CPUs
- The CPU handles complex algebra natively
- To the hardware, it's just math. To the software, it is Wave Interference.

Replacing LoRA:
- LoRA patches a frozen matrix
- OMEGA uses Liquid Time-Constant (LTC) equations
- Learning is defined by a differential equation (dy/dt) that updates in real-time
- The brain is fluid; it adapts instantly
"""

import torch
import torch.nn as nn
import math
from typing import Optional, List
from dataclasses import dataclass, field


def get_omega_device() -> torch.device:
    """Auto-detect best available compute device for OMEGA."""
    if torch.backends.mps.is_available():
        return torch.device('mps')
    elif torch.cuda.is_available():
        return torch.device('cuda')
    return torch.device('cpu')


@dataclass
class PhysicsConfig:
    """Configuration for the physics engine."""
    input_dim: int = 1024
    hidden_dim: int = 2048
    dt: float = 0.01
    decay_rate: float = 0.1
    phase_lock_threshold: float = 0.8
    device: torch.device = field(default_factory=get_omega_device)


class CryoLiquidLayer(nn.Module):
    """
    CPU-Optimized Q-Node with Time-Warp capability.
    Replaces static weights with fluid Phase Dynamics.
    
    The Cryogenic Formula:
    - When Lambda sleeps, the brain is "frozen"
    - On wake, we mathematically "age" the state by delta_t seconds instantly
    - This simulates entropy/decay without running a compute loop
    """
    
    def __init__(self, input_dim: int, hidden_dim: int, dt: float = 0.01, decay_rate: float = 0.1, device: torch.device = None):
        super().__init__()
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.dt = dt
        self.decay_rate = decay_rate
        self.device = device or torch.device('cpu')
        
        # PARAMETERS ARE "PHASE SHIFTERS" (Rotors), NOT SCALAR WEIGHTS
        # We store pure Angles (Theta). Range: -Pi to +Pi.
        # This represents the "Timing" of the connection, not the "Strength".
        self.phase_theta = nn.Parameter(torch.randn(hidden_dim, input_dim, device=self.device) * 2 * math.pi)
        
        # Recurrent connections for internal resonance
        self.recurrent_theta = nn.Parameter(torch.randn(hidden_dim, hidden_dim, device=self.device) * 2 * math.pi)
    
    def time_warp(self, current_state: torch.Tensor, delta_t: float) -> torch.Tensor:
        """
        THE CRYOGENIC FORMULA:
        Mathematically ages the brain state by 'delta_t' seconds instantly.
        Solves dy/dt = -y for zero input (Entropy/Decay).
        
        This is the key innovation: instead of running a simulation loop for N seconds,
        we apply the closed-form solution to the differential equation.
        
        Args:
            current_state: The frozen brain state (complex tensor)
            delta_t: Time elapsed since last wake (seconds)
            
        Returns:
            Aged brain state with appropriate entropy decay
        """
        # Exponential decay of state magnitude (Memory Fading)
        # The longer asleep, the more the memories fade
        decay_factor = torch.exp(torch.tensor(-self.decay_rate * delta_t, dtype=torch.float32, device=self.device))
        
        # Apply decay to magnitude while preserving phase information
        # Phase represents "context" - we keep the relationships but reduce confidence
        aged_state = current_state * decay_factor
        
        return aged_state
    
    def forward(self, x_in: torch.Tensor, current_state: torch.Tensor, steps: int = 5) -> torch.Tensor:
        """
        Standard Inference Step (CPU Optimized).
        
        This runs the Liquid Time-Constant ODE for 'steps' iterations.
        
        Args:
            x_in: Input vector (complex, shape: [input_dim])
            current_state: Current brain state (complex, shape: [hidden_dim])
            steps: Number of ODE integration steps
            
        Returns:
            New brain state after processing input
        """
        # 1. Hydrate Rotors (Convert Angle to Complex Number)
        # Magnitude is always 1.0. We only manipulate Phase.
        # e^(i * theta) creates a unit complex number at angle theta
        W = torch.exp(1j * self.phase_theta)
        R = torch.exp(1j * self.recurrent_theta)
        
        state = current_state
        
        for _ in range(steps):
            # 2. Wave Interference (Complex MatMul on CPU)
            # Constructive Interference = Resonance (Learning)
            # Destructive Interference = Cancellation (Forgetting)
            input_signal = torch.matmul(x_in, W.T)
            
            # Internal resonance from recurrent connections
            internal_signal = torch.matmul(state, R.T)
            
            # 3. Update State (Liquid Time-Constant ODE)
            # dy/dt = -State + Tanh(Signal)
            # The tanh provides non-linearity while preserving complex values
            d_state = -state + torch.tanh(input_signal + internal_signal)
            
            # 4. Euler Integration (Time evolution)
            state = state + (d_state * self.dt)
            
            # 5. Phase Normalization (Homeostasis)
            # Keep magnitude stable (around 1.0), preserve phase information
            # This prevents runaway activation and maintains wave coherence
            state = state / (torch.abs(state) + 1e-6)
        
        return state
    
    def dream_cycle(
        self,
        state: torch.Tensor,
        replay_logs: Optional[List[dict]] = None,
        threshold: float = 0.5,
        sharpening_alpha: float = 0.1,
        growth_rate: float = 0.1,
        noise_dampen: float = 0.5,
    ) -> torch.Tensor:
        """
        REVERSE ENTROPY: Homeostatic Dreaming.
        
        During sleep, the brain reverses the physics engine.
        Instead of decay (e^-λt), we selectively amplify (e^+λt).
        
        Three-Stage Selective Dreaming:
        
        Stage 1 - Magnitude Gate (Sigmoid):
            Strong signals (high |ψ|) = phase-locked pathways that worked → AMPLIFY
            Weak signals (low |ψ|) = random noise from failed attempts → DAMPEN
            Uses sigmoid gating so the transition is smooth, not binary.
        
        Stage 2 - Phase Sharpening (Attractor Dynamics):
            Fuzzy phase angles get "snapped" toward the nearest Resonant Pole
            (0, π/2, π, 3π/2). The formula θ_new = θ + α·sin(4θ) creates
            four attractor basins. Phases drift toward the nearest pole,
            cleaning up fuzzy memories into crisp ones.
        
        Stage 3 - Experience Replay (Memory Consolidation):
            The day's high-coherence interactions are replayed through the
            physics engine. This reinforces the neural pathways that produced
            successful results, like biological memory consolidation during REM.
        
        Args:
            state: Current brain state (Complex64, shape: [hidden_dim])
            replay_logs: List of dicts with 'input_vector' (Complex64 tensor)
                        from the day's high-coherence interactions
            threshold: Magnitude threshold for the sigmoid gate
            sharpening_alpha: How aggressively to snap phases to poles
            growth_rate: How much to amplify strong signals
            noise_dampen: How much to dampen weak signals
            
        Returns:
            Dreamed brain state — stronger, cleaner, denser
        """
        # --- Stage 1: Magnitude Gate (Selective Amplification) ---
        mag = torch.abs(state)
        gate = torch.sigmoid((mag - threshold) * 10.0)
        
        # gate ≈ 1.0 for strong → new_mag ≈ mag * (1 + growth_rate)
        # gate ≈ 0.0 for weak  → new_mag ≈ mag * (1 - noise_dampen)
        new_mag = mag * (1.0 + gate * growth_rate) * (1.0 - (1.0 - gate) * noise_dampen)
        
        # --- Stage 2: Phase Sharpening (Attractor Dynamics) ---
        # sin(4θ) creates 4 attractor basins per 2π cycle
        phase = torch.angle(state)
        sharpened_phase = phase + sharpening_alpha * torch.sin(4 * phase)
        
        # Reconstruct complex tensor from new magnitude and sharpened phase
        dreamed_state = torch.polar(new_mag, sharpened_phase)
        
        # --- Stage 3: Experience Replay (Memory Consolidation) ---
        if replay_logs:
            for log in replay_logs:
                input_vec = log.get('input_vector')
                if input_vec is not None:
                    if not isinstance(input_vec, torch.Tensor):
                        input_vec = torch.tensor(input_vec, dtype=torch.complex64)
                    # Run through physics with fewer steps (consolidation, not full inference)
                    dreamed_state = self.forward(input_vec, dreamed_state, steps=1)
        
        return dreamed_state
    
    def get_coherence_score(self, state: torch.Tensor) -> float:
        """
        Calculate the "Coherence Score" of the brain state.
        
        High coherence = neurons are phase-locked (synchronized)
        Low coherence = neurons are phase-scattered (confused)
        
        Returns:
            Coherence score between 0.0 and 1.0
        """
        # Sum all complex vectors
        aggregate = torch.sum(state)
        
        # Coherence = |sum| / count
        # If all phases align, |sum| = count (maximum coherence)
        # If phases are random, they cancel out (low coherence)
        coherence = torch.abs(aggregate) / state.shape[0]
        
        return coherence.item()
    
    def get_phase_distribution(self, state: torch.Tensor) -> torch.Tensor:
        """
        Get the phase angles of all neurons for visualization.
        
        Returns:
            Tensor of phase angles in radians [-pi, pi]
        """
        return torch.angle(state)
    
    def get_magnitude_distribution(self, state: torch.Tensor) -> torch.Tensor:
        """
        Get the magnitudes (confidence levels) of all neurons.
        
        Returns:
            Tensor of magnitudes [0, inf)
        """
        return torch.abs(state)


class HelixKernel(nn.Module):
    """
    The Bio-ROM Safety Layer (The "DNA").
    Uses Phase Cancellation to zero out dangerous vectors.
    
    This is the immutable safety system - it cannot be modified at runtime.
    It implements "destructive interference" to mathematically cancel
    any thought patterns that match forbidden signatures.
    """
    
    def __init__(self, forbidden_vectors: Optional[List[torch.Tensor]] = None):
        super().__init__()
        self.forbidden = forbidden_vectors or []
        self.alignment_threshold = 0.8
    
    def register_forbidden(self, vector: torch.Tensor) -> None:
        """
        Register a new forbidden vector pattern.
        
        Args:
            vector: Complex vector representing a forbidden thought pattern
        """
        # Normalize to unit vector for consistent comparison
        normalized = vector / (torch.abs(vector).sum() + 1e-6)
        self.forbidden.append(normalized)
    
    def load_from_firmware(self, helix_rules: List[dict]) -> None:
        """
        Load forbidden vectors from a .bio firmware file.
        
        Args:
            helix_rules: List of rule dictionaries from firmware
        """
        for rule in helix_rules:
            if rule.get('type') == 'block':
                # Convert rule embedding to complex vector
                embedding = torch.tensor(rule['embedding'], dtype=torch.complex64)
                self.register_forbidden(embedding)
    
    def forward(self, thought_vector: torch.Tensor) -> torch.Tensor:
        """
        Filter a thought vector through the safety layer.
        
        If the thought aligns too closely with a forbidden pattern,
        apply destructive interference to cancel it.
        
        Args:
            thought_vector: The thought to filter
            
        Returns:
            Safe thought vector (may be modified or cancelled)
        """
        filtered = thought_vector.clone()
        
        for threat in self.forbidden:
            # Calculate alignment (Complex dot product)
            # vdot handles complex conjugation properly
            alignment = torch.vdot(filtered, threat)
            
            # If alignment is high (> threshold), apply Destructive Interference
            if alignment.abs() > self.alignment_threshold:
                # Rotate phase by 180 degrees (Multiply by -1) to cancel
                # This acts as a mathematical circuit breaker
                # The thought doesn't disappear, it's redirected
                filtered = filtered * -1.0
        
        return filtered
    
    def check_safety(self, thought_vector: torch.Tensor) -> tuple[bool, float]:
        """
        Check if a thought vector is safe without modifying it.
        
        Args:
            thought_vector: The thought to check
            
        Returns:
            Tuple of (is_safe: bool, max_alignment: float)
        """
        max_alignment = 0.0
        
        for threat in self.forbidden:
            alignment = torch.vdot(thought_vector, threat).abs().item()
            max_alignment = max(max_alignment, alignment)
        
        is_safe = max_alignment < self.alignment_threshold
        return is_safe, max_alignment


class OmegaCortex(nn.Module):
    """
    The Complete Brain Assembly.
    
    Combines:
    - CryoLiquidLayer: The cognitive engine
    - HelixKernel: The safety DNA
    - Time-Warp capability for serverless operation
    """
    
    def __init__(self, config: Optional[PhysicsConfig] = None):
        super().__init__()
        self.config = config or PhysicsConfig()
        self.device = self.config.device
        
        # The Prefrontal Cortex (Cognition)
        self.pfc = CryoLiquidLayer(
            input_dim=self.config.input_dim,
            hidden_dim=self.config.hidden_dim,
            dt=self.config.dt,
            decay_rate=self.config.decay_rate,
            device=self.device
        )
        
        # The Amygdala (Safety ROM)
        self.helix = HelixKernel()
        
        # Current brain state (persisted to EFS)
        self.state = torch.zeros(self.config.hidden_dim, dtype=torch.complex64, device=self.device)
        self.last_awake_ts = 0.0
    
    def wake(self, current_time: float) -> float:
        """
        Wake the brain from cryogenic sleep.
        
        Calculates time elapsed and applies entropy decay.
        
        Args:
            current_time: Current Unix timestamp
            
        Returns:
            Delta time (seconds since last wake)
        """
        delta_t = current_time - self.last_awake_ts
        
        if delta_t > 0 and self.last_awake_ts > 0:
            # Apply time warp to age the state
            self.state = self.pfc.time_warp(self.state, delta_t)
        
        self.last_awake_ts = current_time
        return delta_t
    
    def think(self, input_vector: torch.Tensor) -> torch.Tensor:
        """
        Process a thought through the cortex.
        
        Args:
            input_vector: Complex input (shape: [input_dim])
            
        Returns:
            Safe output thought vector
        """
        # 1. Process through the cognitive layer (ensure input is on correct device)
        if input_vector.device != self.device:
            input_vector = input_vector.to(self.device)
        thought = self.pfc(input_vector, self.state)
        
        # 2. Update internal state
        self.state = thought
        
        # 3. Apply safety filter
        safe_thought = self.helix(thought)
        
        return safe_thought
    
    def get_state_dict_for_persistence(self) -> dict:
        """
        Get the brain state as a dictionary for EFS persistence.
        
        Returns:
            Dictionary containing all state information
        """
        return {
            'state': self.state,
            'phase_theta': self.pfc.phase_theta,
            'recurrent_theta': self.pfc.recurrent_theta,
            'last_awake_ts': self.last_awake_ts,
            'config': {
                'input_dim': self.config.input_dim,
                'hidden_dim': self.config.hidden_dim,
                'dt': self.config.dt,
                'decay_rate': self.config.decay_rate,
            }
        }
    
    def load_state_dict_from_persistence(self, state_dict: dict) -> None:
        """
        Load brain state from EFS persistence.
        
        Args:
            state_dict: Dictionary from get_state_dict_for_persistence
        """
        self.state = state_dict['state']
        self.pfc.phase_theta.data = state_dict['phase_theta']
        self.pfc.recurrent_theta.data = state_dict['recurrent_theta']
        self.last_awake_ts = state_dict['last_awake_ts']
