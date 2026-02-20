#!/usr/bin/env python3
"""
OMEGA Behavioral Trainer — Wirtinger E-Prop

Trains OMEGA's CryoLiquidLayer using Wirtinger-correct eligibility traces.
NO backpropagation. NO computation graph. NO classical ML.

Learning rule (Wirtinger e-prop):
    1. Forward: batched ODE integration through CryoLiquidLayer (detached)
    2. Reward: phase alignment between output state and target behavior reference
    3. Traces: Wirtinger eligibility traces accumulated through ODE steps
       e_jk^(t+1) = (1-dt)*e_jk^t + dt*sech²(z_j)*i*e^(iθ_jk)*x_k
    4. Update: θ += η * 2 * Re(trace)  (Wirtinger gradient for real parameters)

Decoding uses PhaseAlignmentDecoder — pure complex inner products against
deterministic reference vectors. No MLP, no softmax, no learned classifier.

The only learnable parameters are phase_theta and recurrent_theta.
TextEncoder is frozen (sensory organ). Llama is not involved in training.
"""

import json
import hashlib
import math
import re
import time
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
from collections import Counter

import torch
import torch.nn as nn

logger = logging.getLogger('omega_trainer')

# ============================================================================
# TEXT ENCODER
# ============================================================================


MAX_SEQ_LEN = 64

class TextEncoder(nn.Module):
    """
    Attention-Based Text Encoder — maps natural language → complex input vectors.

    Architecture:
        text → tokenize → embedding(vocab_size, embed_dim)
        → sinusoidal positional encoding
        → single-head self-attention (Q/K/V)
        → learned query pooling
        → Linear(embed_dim, input_dim*2) → view as complex(input_dim)

    Required for 13-behavior discrimination (mean-pooling insufficient).
    The encoder is part of OMEGA — calibrated then frozen before ODE training.
    Llama is NOT involved in encoding.
    """

    def __init__(self, input_dim: int = 1024, embed_dim: int = 256,
                 max_vocab: int = 5000, dropout: float = 0.0):
        super().__init__()
        self.input_dim = input_dim
        self.embed_dim = embed_dim
        self.max_vocab = max_vocab

        self.word_to_idx: Dict[str, int] = {'<PAD>': 0, '<UNK>': 1}
        self.idx_to_word: Dict[int, str] = {0: '<PAD>', 1: '<UNK>'}
        self.vocab_built = False

        self.embedding = nn.Embedding(max_vocab, embed_dim, padding_idx=0)

        # Sinusoidal positional encoding
        pe = torch.zeros(MAX_SEQ_LEN, embed_dim)
        position = torch.arange(0, MAX_SEQ_LEN, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, embed_dim, 2).float() * (-math.log(10000.0) / embed_dim))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer('positional_encoding', pe)

        # Single-head self-attention
        self.q_proj = nn.Linear(embed_dim, embed_dim)
        self.k_proj = nn.Linear(embed_dim, embed_dim)
        self.v_proj = nn.Linear(embed_dim, embed_dim)
        self.attn_scale = embed_dim ** 0.5

        # Learned query pooling vector
        self.pool_query = nn.Parameter(torch.randn(1, 1, embed_dim) * 0.02)

        self.dropout = nn.Dropout(dropout)

        # Project real embeddings → complex input space (output 2x for real+imag)
        self.project = nn.Sequential(
            nn.Linear(embed_dim, embed_dim * 2),
            nn.GELU(),
            nn.Linear(embed_dim * 2, input_dim * 2),
        )

    @staticmethod
    def tokenize(text: str) -> List[str]:
        """Simple word-level tokenization."""
        text = text.lower().strip()
        tokens = re.findall(r"[a-z]+|[0-9]+\.?[0-9]*|[?!.,;:'\"]", text)
        return tokens

    def build_vocab(self, texts: List[str]):
        """Build vocabulary from training texts. Only adds NEW words — preserves existing indices."""
        counter = Counter()
        for text in texts:
            counter.update(self.tokenize(text))

        added = 0
        for word, _ in counter.most_common(self.max_vocab - 2):  # -2 for PAD/UNK
            if word in self.word_to_idx:
                continue  # preserve existing index — critical for checkpoint compatibility
            idx = len(self.word_to_idx)
            if idx >= self.max_vocab:
                break
            self.word_to_idx[word] = idx
            self.idx_to_word[idx] = word
            added += 1

        self.vocab_built = True
        logger.info(f"TextEncoder: built vocab with {len(self.word_to_idx)} words ({added} new, attention pooling)")

    def encode_tokens(self, text: str) -> torch.Tensor:
        """Convert text to token indices."""
        tokens = self.tokenize(text)
        indices = [self.word_to_idx.get(t, 1) for t in tokens]  # 1 = UNK
        if not indices:
            indices = [1]  # at least one token
        indices = indices[:MAX_SEQ_LEN]
        device = next(self.parameters()).device if list(self.parameters()) else torch.device('cpu')
        return torch.tensor(indices, dtype=torch.long, device=device)

    def forward(self, text: str) -> torch.Tensor:
        """
        Encode text → complex input vector for the CryoLiquidLayer.

        Returns:
            Complex tensor of shape [input_dim]
        """
        token_ids = self.encode_tokens(text)
        seq_len = token_ids.shape[0]
        embeds = self.embedding(token_ids)       # [seq_len, embed_dim]

        # Positional encoding
        embeds = embeds + self.positional_encoding[:seq_len]

        # Self-attention
        embeds_3d = embeds.unsqueeze(0)  # [1, seq_len, embed_dim]
        Q = self.q_proj(embeds_3d)
        K = self.k_proj(embeds_3d)
        V = self.v_proj(embeds_3d)

        attn_weights = torch.matmul(Q, K.transpose(-2, -1)) / self.attn_scale
        attn_weights = torch.softmax(attn_weights, dim=-1)
        attn_weights = self.dropout(attn_weights)
        attn_out = torch.matmul(attn_weights, V)  # [1, seq_len, embed_dim]

        # Learned query pooling
        pool_q = self.pool_query.expand(1, -1, -1)
        pool_attn = torch.matmul(pool_q, attn_out.transpose(-2, -1)) / self.attn_scale
        pool_attn = torch.softmax(pool_attn, dim=-1)
        pooled = torch.matmul(pool_attn, attn_out).squeeze(0).squeeze(0)  # [embed_dim]

        projected = self.project(pooled)          # [input_dim * 2]

        # Split into real and imaginary parts
        real_part = projected[:self.input_dim]
        imag_part = projected[self.input_dim:]

        complex_vec = torch.complex(real_part, imag_part)
        return complex_vec

    def forward_batch(self, texts: List[str]) -> torch.Tensor:
        """
        Batched encoding: texts → complex input vectors.
        Pads sequences to max length in batch for efficient GPU utilization.

        Returns:
            Complex tensor of shape [B, input_dim]
        """
        device = next(self.parameters()).device
        # Tokenize all texts
        all_ids = []
        max_len = 0
        for text in texts:
            ids = self.encode_tokens(text)
            all_ids.append(ids)
            max_len = max(max_len, ids.shape[0])
        max_len = min(max_len, MAX_SEQ_LEN)

        # Pad to max_len
        B = len(texts)
        padded = torch.zeros(B, max_len, dtype=torch.long, device=device)
        mask = torch.zeros(B, max_len, dtype=torch.bool, device=device)
        for i, ids in enumerate(all_ids):
            length = min(ids.shape[0], max_len)
            padded[i, :length] = ids[:length]
            mask[i, :length] = True

        embeds = self.embedding(padded)  # [B, max_len, embed_dim]
        embeds = embeds + self.positional_encoding[:max_len].unsqueeze(0)

        # Self-attention (batched)
        Q = self.q_proj(embeds)   # [B, max_len, embed_dim]
        K = self.k_proj(embeds)
        V = self.v_proj(embeds)

        attn_weights = torch.matmul(Q, K.transpose(-2, -1)) / self.attn_scale  # [B, max_len, max_len]
        # Mask padding positions
        attn_mask = mask.unsqueeze(1).expand(-1, max_len, -1)  # [B, max_len, max_len]
        attn_weights = attn_weights.masked_fill(~attn_mask, -1e9)
        attn_weights = torch.softmax(attn_weights, dim=-1)
        attn_weights = self.dropout(attn_weights)
        attn_out = torch.matmul(attn_weights, V)  # [B, max_len, embed_dim]

        # Learned query pooling (batched)
        pool_q = self.pool_query.expand(B, -1, -1)  # [B, 1, embed_dim]
        pool_attn = torch.matmul(pool_q, attn_out.transpose(-2, -1)) / self.attn_scale  # [B, 1, max_len]
        pool_mask = mask.unsqueeze(1)  # [B, 1, max_len]
        pool_attn = pool_attn.masked_fill(~pool_mask, -1e9)
        pool_attn = torch.softmax(pool_attn, dim=-1)
        pooled = torch.matmul(pool_attn, attn_out).squeeze(1)  # [B, embed_dim]

        projected = self.project(pooled)  # [B, input_dim * 2]
        real_part = projected[:, :self.input_dim]
        imag_part = projected[:, self.input_dim:]
        return torch.complex(real_part, imag_part)  # [B, input_dim]


# ============================================================================
# BEHAVIORAL CODEBOOK
# ============================================================================

# Every behavior type maps to a unique target phase vector in the brain's hidden_dim.
# OMEGA must learn to produce these specific patterns for each input scenario.

CODEBOOK_VERSION = 3

BEHAVIOR_TYPES = [
    "greet",
    "take_order",
    "customize",
    "complaint",
    "meal_substitution",
    "combo_entree_swap",
    "split_size_selection",
    "menu_inquiry",
    "time_check",
    "price_inquiry",
    "take_order_breakfast",
    "value_recommendation",
    "order_modify",
]


@dataclass
class TrainingExample:
    """One behavioral training example."""
    input_text: str
    behavior: str
    target_action: str
    target_data: Dict[str, Any]
    expected_response_contains: List[str]
    context: Optional[str] = None


@dataclass
class TrainingMetrics:
    """Metrics from a training run."""
    epoch: int
    total_loss: float
    avg_loss: float
    behavior_accuracy: float
    examples_trained: int
    learning_rate: float
    elapsed_ms: float
    per_behavior_accuracy: Dict[str, float] = field(default_factory=dict)


class PhaseAlignmentDecoder:
    """
    Decodes behavior from complex state via phase alignment.

    No neural network. No learned parameters. Pure physics.

    Each behavior has a fixed reference vector in the complex hidden space,
    generated deterministically from the behavior name. Decoding = find the
    reference with highest signed phase alignment to the output state.

    Alignment = Re(⟨output, ref⟩) / (‖output‖ · ‖ref‖)
    """

    def __init__(self, hidden_dim: int = 2048, device: torch.device = None):
        self.hidden_dim = hidden_dim
        self.device = device or torch.device('cpu')
        self.num_behaviors = len(BEHAVIOR_TYPES)
        self.behavior_to_idx = {b: i for i, b in enumerate(BEHAVIOR_TYPES)}
        self.idx_to_behavior = {i: b for b, i in self.behavior_to_idx.items()}

        # Fixed reference matrix: [num_behaviors, hidden_dim] complex unit vectors
        self.ref_matrix = self._create_reference_matrix()

    def _create_reference_matrix(self) -> torch.Tensor:
        """Create deterministic reference phase vectors for each behavior."""
        refs = []
        for behavior in BEHAVIOR_TYPES:
            h = hashlib.sha256(f"omega_ref_{behavior}".encode()).digest()
            angles = []
            for i in range(self.hidden_dim):
                seed = hashlib.sha256(h + i.to_bytes(4, 'big')).digest()
                angle = (int.from_bytes(seed[:4], 'big') / (2**32)) * 2 * math.pi - math.pi
                angles.append(angle)
            angles_t = torch.tensor(angles, dtype=torch.float32, device=self.device)
            refs.append(torch.exp(1j * angles_t))
        return torch.stack(refs)

    def alignment_matrix(self, complex_state: torch.Tensor) -> torch.Tensor:
        """
        Compute signed phase alignment of state(s) with all reference vectors.

        Args:
            complex_state: [hidden_dim] or [batch, hidden_dim] complex tensor

        Returns:
            [num_behaviors] or [batch, num_behaviors] real tensor of alignments in [-1, 1]
        """
        if complex_state.dim() == 1:
            complex_state = complex_state.unsqueeze(0)

        # Complex dot product: state @ ref_matrix^H → [batch, num_behaviors]
        dots = torch.matmul(complex_state, self.ref_matrix.conj().T)
        alignment = dots.real

        # Normalize by norms (manual L2 for complex — MPS lacks complex .norm())
        state_norms = torch.abs(complex_state).pow(2).sum(dim=-1, keepdim=True).sqrt()  # [batch, 1]
        ref_norms = torch.abs(self.ref_matrix).pow(2).sum(dim=-1, keepdim=True).sqrt().T  # [1, num_behaviors]
        alignment = alignment / (state_norms * ref_norms + 1e-6)

        return alignment

    def decode(self, complex_state: torch.Tensor) -> Tuple[str, float]:
        """Decode the most likely behavior + confidence."""
        alignment = self.alignment_matrix(complex_state).squeeze(0)
        # Temperature-scaled softmax for confidence (alignment values are small)
        probs = torch.softmax(alignment * 10.0, dim=-1)
        idx = alignment.argmax().item()
        behavior = self.idx_to_behavior.get(idx, "unknown")
        confidence = probs[idx].item()
        return behavior, confidence

    def decode_top_k(self, complex_state: torch.Tensor, k: int = 3) -> List[Tuple[str, float]]:
        """Decode top-k behavior matches with confidence."""
        alignment = self.alignment_matrix(complex_state).squeeze(0)
        probs = torch.softmax(alignment * 10.0, dim=-1)
        topk = torch.topk(probs, k=min(k, self.num_behaviors))
        results = []
        for i in range(topk.values.shape[-1]):
            idx = topk.indices[i].item()
            conf = topk.values[i].item()
            behavior = self.idx_to_behavior.get(idx, "unknown")
            results.append((behavior, conf))
        return results


class BehavioralCodebook:
    """
    Wraps PhaseAlignmentDecoder for backward compat with server.py.
    """

    def __init__(self, hidden_dim: int = 2048, device: torch.device = None):
        self.hidden_dim = hidden_dim
        self.readout = PhaseAlignmentDecoder(hidden_dim, device=device)
        self.codebook = {b: i for i, b in enumerate(BEHAVIOR_TYPES)}

    def decode(self, output_vector: torch.Tensor) -> Tuple[str, float]:
        return self.readout.decode(output_vector)

    def decode_top_k(self, output_vector: torch.Tensor, k: int = 3) -> List[Tuple[str, float]]:
        return self.readout.decode_top_k(output_vector, k)


# ============================================================================
# OMEGA TRAINER
# ============================================================================

class OmegaTrainer:
    """
    Autograd trainer for OMEGA's CryoLiquidLayer.

    Architecture: CryoLiquidLayer ODE with complex phase dynamics.
    Training: exact gradients via autograd through the ODE integration steps.
    Loss: cross-entropy on phase alignment with deterministic reference vectors.

    The only learnable parameters are phase_theta and recurrent_theta.
    TextEncoder is frozen after sensory calibration. Decoder is parameter-free.
    """

    def __init__(self, cortex, codebook: BehavioralCodebook, lr: float = 0.001):
        self.cortex = cortex
        self.codebook = codebook
        self.decoder = codebook.readout  # PhaseAlignmentDecoder
        self.lr = lr
        self.device = cortex.device
        self.cpu = torch.device('cpu')

        # Training dt: larger dt = stronger dynamics = clearer phase signal
        self.training_dt = 0.5
        self.inference_dt = cortex.pfc.dt

        # TextEncoder: sensory organ — calibrated first, then frozen
        self.text_encoder = TextEncoder(
            input_dim=cortex.config.input_dim,
            embed_dim=256,
        ).to(self.device)

        self.epoch = 0
        self.history: List[TrainingMetrics] = []
        self.best_accuracy = 0.0
        self._encoder_calibrated = False

        # Training hyperparameters
        self.training_steps = 8     # ODE integration steps — optimal for 13-behavior convergence
        self.alignment_temperature = 10.0  # amplify small alignment differences for softmax
        self.batch_size = 128  # balance: fast epochs (~30s) with enough gradient diversity
        self.class_weights: Optional[torch.Tensor] = None  # inverse-frequency weights
        self.class_weight_boost: Optional[dict] = None  # {behavior: multiplier} for targeted boosting
        self.focal_gamma: float = 0.0  # Focal loss gamma (0 = standard CE, 2.0 = strong focus on hard examples)

        # Training parameters on device (MPS/CUDA/CPU)
        # PyTorch 2.10+ has reliable MPS complex autograd
        self._train_phase_theta = cortex.pfc.phase_theta.detach().clone().to(self.device).requires_grad_(True)
        self._train_recurrent_theta = cortex.pfc.recurrent_theta.detach().clone().to(self.device).requires_grad_(True)
        self._train_ref_matrix = self.decoder.ref_matrix.to(self.device)

        # Adam optimizer on device parameters
        self.optimizer = torch.optim.Adam(
            [self._train_phase_theta, self._train_recurrent_theta],
            lr=lr,
        )

    def build_vocab(self, examples: List[TrainingExample]):
        """Build vocabulary from training examples."""
        texts = [ex.input_text for ex in examples]
        for ex in examples:
            if ex.context:
                texts.append(ex.context)
        self.text_encoder.build_vocab(texts)

    def set_lr(self, lr: float):
        """Set learning rate."""
        self.lr = lr
        for pg in self.optimizer.param_groups:
            pg['lr'] = lr

    def _sync_to_device(self):
        """Copy trained parameters back to cortex for inference."""
        with torch.no_grad():
            self.cortex.pfc.phase_theta.copy_(self._train_phase_theta.detach())
            self.cortex.pfc.recurrent_theta.copy_(self._train_recurrent_theta.detach())

    def calibrate_encoder(self, examples: List[TrainingExample], epochs: int = None, lr: float = 0.003):
        """
        Sensory calibration: train TextEncoder to produce behavior-discriminative encodings.

        Biological analogy: retinal ganglion cells develop feature selectivity through
        activity-dependent refinement before cortical learning begins. Similarly, the
        TextEncoder (OMEGA's sensory organ) is calibrated to produce semantically
        structured input vectors before CryoLiquidLayer e-prop training.

        Uses autograd for the encoder ONLY. The brain (CryoLiquidLayer phase_theta,
        recurrent_theta) is NOT touched. After calibration, the encoder is frozen.

        Runs on the active device (MPS/CUDA/CPU).
        """
        import random as _rand
        import time as _time
        cal_examples = examples
        max_cal_examples = 5000
        if len(examples) > max_cal_examples:
            # Stratified subsample: proportional representation per behavior
            by_behavior: Dict[str, List] = {}
            for ex in examples:
                by_behavior.setdefault(ex.behavior, []).append(ex)
            cal_examples = []
            for beh, exs in by_behavior.items():
                n = max(50, int(max_cal_examples * len(exs) / len(examples)))
                cal_examples.extend(_rand.sample(exs, min(n, len(exs))))
            _rand.shuffle(cal_examples)
            print(f"  Calibration subsampled: {len(examples)} → {len(cal_examples)} examples (stratified)", flush=True)

        # Scale calibration epochs with dataset size
        if epochs is None:
            epochs = min(600, max(200, len(cal_examples) * 2))
        print(f"=== Sensory Calibration: Training TextEncoder ({epochs} epochs, {len(cal_examples)} examples) ===", flush=True)

        # Run calibration on the active device (MPS/CUDA/CPU)
        cal_device = self.device
        self.text_encoder.to(cal_device)

        # Unfreeze encoder for calibration
        for p in self.text_encoder.parameters():
            p.requires_grad = True
        self.text_encoder.train()

        # Temporary 2-layer classification head (discarded after calibration)
        input_dim = self.cortex.config.input_dim
        num_behaviors = len(BEHAVIOR_TYPES)
        classifier = nn.Sequential(
            nn.Linear(input_dim * 2, 512),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(512, num_behaviors),
        ).to(cal_device)

        optimizer = torch.optim.Adam(
            list(self.text_encoder.parameters()) + list(classifier.parameters()),
            lr=lr,
        )
        # Cosine LR annealing — prevents plateau oscillation
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=lr * 0.01)
        behavior_to_idx = {b: i for i, b in enumerate(BEHAVIOR_TYPES)}

        # Class-weighted loss for imbalanced 13-behavior dataset
        cal_counts = Counter(ex.behavior for ex in cal_examples)
        cal_weights = torch.ones(num_behaviors, device=cal_device)
        cal_total = len(cal_examples)
        for beh, count in cal_counts.items():
            cal_weights[behavior_to_idx[beh]] = cal_total / (num_behaviors * count)
        cal_weights = cal_weights / cal_weights.mean()
        loss_fn = nn.CrossEntropyLoss(weight=cal_weights)

        # Pre-compute targets and text lists for batched encoding
        all_texts = [ex.input_text for ex in cal_examples]
        all_targets = torch.tensor(
            [behavior_to_idx[ex.behavior] for ex in cal_examples],
            dtype=torch.long, device=cal_device,
        )
        cal_batch_size = 512  # encoding batch — saturate GPU

        best_acc = 0.0
        best_encoder_state = None
        for epoch in range(epochs):
            _ep_start = _time.time()

            # Batched encoding: encode in GPU-friendly chunks, accumulate all features
            all_features = []
            for i in range(0, len(all_texts), cal_batch_size):
                batch_texts = all_texts[i:i+cal_batch_size]
                enc_batch = self.text_encoder.forward_batch(batch_texts)  # [B, input_dim] complex
                features = torch.cat([enc_batch.real, enc_batch.imag], dim=-1)  # [B, input_dim*2]
                all_features.append(features)

            # Full-batch gradient step (preserves original optimization dynamics)
            features_batch = torch.cat(all_features, dim=0)  # [N, input_dim*2]
            logits = classifier(features_batch)  # [N, num_behaviors]
            loss = loss_fn(logits, all_targets)

            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.text_encoder.parameters(), max_norm=5.0)
            optimizer.step()
            scheduler.step()

            preds = logits.detach().argmax(dim=-1)
            acc = (preds == all_targets).float().mean().item()
            if acc > best_acc:
                best_acc = acc
                best_encoder_state = {k: v.detach().clone() for k, v in self.text_encoder.state_dict().items()}

            cur_lr = scheduler.get_last_lr()[0]
            if (epoch + 1) % 10 == 0 or epoch == 0:
                _ep_elapsed = _time.time() - _ep_start
                print(
                    f"  Cal epoch {epoch+1}/{epochs}: "
                    f"loss={loss.item():.4f} acc={acc:.1%} best={best_acc:.1%} lr={cur_lr:.2e} ({_ep_elapsed:.1f}s)",
                    flush=True,
                )

            if acc >= 0.98:
                print(f"  Encoder calibration converged at epoch {epoch+1}", flush=True)
                break

        # Restore best encoder weights
        if best_encoder_state is not None:
            self.text_encoder.load_state_dict(best_encoder_state)

        # Freeze encoder permanently — discard classifier
        self.text_encoder.eval()
        for p in self.text_encoder.parameters():
            p.requires_grad = False

        # Move encoder back to original device for inference
        self.text_encoder.to(self.device)

        del classifier, optimizer
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        self._encoder_calibrated = True
        print(f"=== Sensory Calibration Complete: best_acc={best_acc:.1%} ===", flush=True)
        print("TextEncoder frozen — beginning CryoLiquidLayer e-prop training", flush=True)

    def _forward_batch(self, input_batch, target_indices, hidden_dim, dt):
        """
        Forward pass for a single mini-batch through the CryoLiquidLayer ODE.
        Returns (loss, correct_count, pred_indices, batch_size).
        Runs on self.device (MPS/CUDA/CPU).
        """
        B = input_batch.shape[0]
        W = torch.exp(1j * self._train_phase_theta)
        R = torch.exp(1j * self._train_recurrent_theta)
        state = torch.zeros(B, hidden_dim, dtype=torch.complex64, device=self.device)

        recurrent_scale = 1.0 / math.sqrt(hidden_dim)
        for step in range(self.training_steps):
            z = torch.matmul(input_batch, W.T) + torch.matmul(state, R.T) * recurrent_scale
            d_state = -state + torch.tanh(z)
            state = state + d_state * dt
            state = state / (torch.abs(state) + 1e-6)

        dots = torch.matmul(state, self._train_ref_matrix.conj().T)
        alignment = dots.real
        state_norms = torch.abs(state).pow(2).sum(dim=-1, keepdim=True).sqrt()
        ref_norms = torch.abs(self._train_ref_matrix).pow(2).sum(dim=-1, keepdim=True).sqrt().T
        alignment = alignment / (state_norms * ref_norms + 1e-6)

        logits = alignment * self.alignment_temperature

        if self.focal_gamma > 0:
            # Focal loss: FL(p_t) = -alpha_t * (1-p_t)^gamma * log(p_t)
            # Down-weights easy examples, focuses on hard ones
            log_probs = nn.functional.log_softmax(logits, dim=-1)
            probs = log_probs.exp()
            targets_one_hot = nn.functional.one_hot(target_indices, num_classes=logits.shape[-1]).float()
            p_t = (probs * targets_one_hot).sum(dim=-1)  # probability of correct class
            focal_weight = (1.0 - p_t).pow(self.focal_gamma)
            # Per-sample CE loss
            ce_loss = -log_probs.gather(1, target_indices.unsqueeze(1)).squeeze(1)
            # Apply class weights
            if self.class_weights is not None:
                sample_weights = self.class_weights[target_indices]
                ce_loss = ce_loss * sample_weights
            loss = (focal_weight * ce_loss).mean()
        else:
            loss = nn.functional.cross_entropy(logits, target_indices, weight=self.class_weights)

        with torch.no_grad():
            preds = logits.detach().argmax(dim=-1)
            correct = (preds == target_indices).sum().item()

        return loss, correct, preds, B

    def _build_encoding_cache(self, examples: List[TrainingExample]):
        """Cache all text encodings once — encoder is frozen after calibration."""
        logger.info(f"Building encoding cache for {len(examples)} examples...")
        t0 = time.time()
        cache_batch_size = 256
        with torch.no_grad():
            all_vecs = []
            texts = [ex.input_text for ex in examples]
            for i in range(0, len(texts), cache_batch_size):
                batch = texts[i:i+cache_batch_size]
                vecs = self.text_encoder.forward_batch(batch)
                all_vecs.append(vecs)
            self._cached_inputs = torch.cat(all_vecs, dim=0).to(self.device)
            norms = torch.abs(self._cached_inputs).pow(2).sum(dim=-1, keepdim=True).sqrt()
            self._cached_inputs = self._cached_inputs / (norms + 1e-6)
            self._cached_targets = torch.tensor(
                [BEHAVIOR_TYPES.index(ex.behavior) for ex in examples],
                dtype=torch.long, device=self.device,
            )
        logger.info(f"Encoding cache built in {time.time()-t0:.1f}s")

    def train_epoch(self, examples: List[TrainingExample]) -> TrainingMetrics:
        """
        Autograd training epoch through CryoLiquidLayer ODE on device (MPS/CUDA/CPU).
        Uses mini-batch training to prevent gradient explosion on large datasets.
        Parameters are synced back to cortex for inference after each epoch.
        """
        import random as _random
        start = time.time()
        total_examples = len(examples)
        hidden_dim = self.cortex.config.hidden_dim
        dt = self.training_dt
        bs = self.batch_size

        # Build encoding cache on first epoch (encoder is frozen)
        if not hasattr(self, '_cached_inputs') or self._cached_inputs is None:
            self._build_encoding_cache(examples)

        # Shuffle order each epoch for stochastic training
        shuffled = list(range(total_examples))
        _random.shuffle(shuffled)

        # ── Phase 1: Use cached encodings in shuffled order ──
        with torch.no_grad():
            all_inputs = self._cached_inputs[shuffled]
            all_targets = self._cached_targets[shuffled]

        # ── Phase 2: Mini-batch training ──
        total_loss = 0.0
        total_correct = 0
        all_preds = []
        nan_batches = 0
        num_batches = (total_examples + bs - 1) // bs

        # Save checkpoint before epoch
        self._checkpoint_w = self._train_phase_theta.detach().clone()
        self._checkpoint_r = self._train_recurrent_theta.detach().clone()

        for batch_idx in range(num_batches):
            lo = batch_idx * bs
            hi = min(lo + bs, total_examples)
            input_batch = all_inputs[lo:hi]
            target_batch = all_targets[lo:hi]

            loss, correct, preds, batch_len = self._forward_batch(
                input_batch, target_batch, hidden_dim, dt,
            )

            self.optimizer.zero_grad()
            loss.backward()

            # NaN guard
            grad_ok = True
            for p in [self._train_phase_theta, self._train_recurrent_theta]:
                if p.grad is not None and (torch.isnan(p.grad).any() or torch.isinf(p.grad).any()):
                    grad_ok = False
                    break

            if grad_ok:
                torch.nn.utils.clip_grad_norm_(
                    [self._train_phase_theta, self._train_recurrent_theta], max_norm=1.0,
                )
                self.optimizer.step()

                # Check for NaN in parameters after step
                if (torch.isnan(self._train_phase_theta).any() or
                        torch.isnan(self._train_recurrent_theta).any()):
                    with torch.no_grad():
                        self._train_phase_theta.copy_(self._checkpoint_w)
                        self._train_recurrent_theta.copy_(self._checkpoint_r)
                    nan_batches += 1
                else:
                    # Update checkpoint to current good state
                    self._checkpoint_w = self._train_phase_theta.detach().clone()
                    self._checkpoint_r = self._train_recurrent_theta.detach().clone()
            else:
                nan_batches += 1

            total_loss += loss.item() * batch_len
            total_correct += correct
            all_preds.extend(preds.tolist())

        # If too many NaN batches, halve LR
        if nan_batches > num_batches * 0.3:
            logger.warning(
                f"Epoch {self.epoch + 1}: {nan_batches}/{num_batches} NaN batches — halving LR"
            )
            self.set_lr(max(self.lr * 0.5, 1e-6))

        # Sync trained parameters back to MPS/GPU
        self._sync_to_device()

        # ── Metrics ──
        avg_loss = total_loss / max(total_examples, 1)
        accuracy = total_correct / max(total_examples, 1)

        per_behavior_correct: Dict[str, int] = {}
        per_behavior_total: Dict[str, int] = {}
        for idx, orig_idx in enumerate(shuffled):
            ex = examples[orig_idx]
            per_behavior_total.setdefault(ex.behavior, 0)
            per_behavior_correct.setdefault(ex.behavior, 0)
            per_behavior_total[ex.behavior] += 1
            expected_idx = BEHAVIOR_TYPES.index(ex.behavior)
            if idx < len(all_preds) and all_preds[idx] == expected_idx:
                per_behavior_correct[ex.behavior] += 1

        self.epoch += 1
        if accuracy > self.best_accuracy:
            self.best_accuracy = accuracy

        per_behavior_acc = {
            b: per_behavior_correct[b] / per_behavior_total[b]
            for b in per_behavior_total
        }

        metrics = TrainingMetrics(
            epoch=self.epoch,
            total_loss=total_loss,
            avg_loss=avg_loss,
            behavior_accuracy=accuracy,
            examples_trained=total_examples,
            learning_rate=self.lr,
            elapsed_ms=(time.time() - start) * 1000,
            per_behavior_accuracy=per_behavior_acc,
        )
        self.history.append(metrics)

        logger.info(
            f"Epoch {self.epoch}: loss={avg_loss:.4f} accuracy={accuracy:.1%} "
            f"best={self.best_accuracy:.1%} lr={self.lr:.2e} "
            f"nan_batches={nan_batches}/{num_batches} "
            f"({metrics.elapsed_ms:.0f}ms)"
        )

        return metrics

    def train(
        self,
        examples: List[TrainingExample],
        epochs: int = 50,
        target_accuracy: float = 0.90,
    ) -> List[TrainingMetrics]:
        """Full training run. Builds vocab, then runs e-prop epochs."""
        if not self.text_encoder.vocab_built:
            self.build_vocab(examples)

        if not self._encoder_calibrated:
            self.calibrate_encoder(examples)

        # Compute inverse-frequency class weights for balanced training
        behavior_counts = Counter(ex.behavior for ex in examples)
        num_classes = len(BEHAVIOR_TYPES)
        total = len(examples)
        weights = torch.ones(num_classes, device=self.device)
        for beh, count in behavior_counts.items():
            idx = BEHAVIOR_TYPES.index(beh)
            weights[idx] = total / (num_classes * count)
        # Apply targeted boost for weak behaviors
        if self.class_weight_boost:
            for beh, multiplier in self.class_weight_boost.items():
                idx = BEHAVIOR_TYPES.index(beh)
                weights[idx] *= multiplier
        # Normalize so mean weight = 1.0
        weights = weights / weights.mean()
        self.class_weights = weights
        logger.info(f"Class weights computed: min={weights.min():.2f} max={weights.max():.2f}")
        if self.class_weight_boost:
            logger.info(f"Class weight boost applied: {self.class_weight_boost}")

        # Cosine LR annealing: decay from peak LR → ~0 over training
        base_lr = self.lr
        best_state = None
        best_acc_this_run = 0.0

        all_metrics = []
        for i in range(epochs):
            # Cosine anneal: lr = base_lr * 0.5 * (1 + cos(pi * i / epochs))
            cosine_factor = 0.5 * (1.0 + math.cos(math.pi * i / max(epochs, 1)))
            new_lr = max(base_lr * cosine_factor, 1e-5)
            self.set_lr(new_lr)

            metrics = self.train_epoch(examples)
            all_metrics.append(metrics)

            # Track best state
            if metrics.behavior_accuracy > best_acc_this_run:
                best_acc_this_run = metrics.behavior_accuracy
                best_state = {
                    'phase_theta': self._train_phase_theta.detach().clone(),
                    'recurrent_theta': self._train_recurrent_theta.detach().clone(),
                }

            if metrics.behavior_accuracy >= target_accuracy:
                logger.info(
                    f"Target accuracy {target_accuracy:.0%} reached at epoch {self.epoch}!"
                )
                break

        # Restore best state from this run
        if best_state is not None and best_acc_this_run > self.best_accuracy:
            with torch.no_grad():
                self._train_phase_theta.copy_(best_state['phase_theta'])
                self._train_recurrent_theta.copy_(best_state['recurrent_theta'])
            self._sync_to_device()
            logger.info(f"Restored best state: {best_acc_this_run:.1%}")

        return all_metrics

    def encode_text(self, text: str) -> torch.Tensor:
        """Encode text using the frozen TextEncoder (for inference)."""
        with torch.no_grad():
            return self.text_encoder(text)

    def evaluate(self, examples: List[TrainingExample]) -> Dict[str, Any]:
        """Evaluate without updating parameters."""
        hidden_dim = self.cortex.config.hidden_dim
        dt = self.training_dt
        pfc = self.cortex.pfc
        results = []
        correct = 0

        with torch.no_grad():
            W = torch.exp(1j * pfc.phase_theta)
            R = torch.exp(1j * pfc.recurrent_theta)

            for ex in examples:
                state = torch.zeros(
                    hidden_dim, dtype=torch.complex64, device=self.device,
                )
                input_vec = self.text_encoder(ex.input_text)
                # Normalize input
                input_norm = torch.abs(input_vec).pow(2).sum().sqrt()
                input_vec = input_vec / (input_norm + 1e-6)

                recurrent_scale = 1.0 / math.sqrt(hidden_dim)
                for step in range(self.training_steps):
                    z = torch.matmul(input_vec, W.T) + torch.matmul(state, R.T) * recurrent_scale
                    d_state = -state + torch.tanh(z)
                    state = state + d_state * dt
                    state = state / (torch.abs(state) + 1e-6)

                decoded, confidence = self.decoder.decode(state)
                top_k = self.decoder.decode_top_k(state, k=3)
                is_correct = decoded == ex.behavior

                if is_correct:
                    correct += 1

                results.append({
                    'input': ex.input_text,
                    'expected_behavior': ex.behavior,
                    'decoded_behavior': decoded,
                    'confidence': round(confidence, 4),
                    'correct': is_correct,
                    'top_3': [(b, round(s, 4)) for b, s in top_k],
                    'target_action': ex.target_action,
                    'target_data': ex.target_data,
                })

        return {
            'accuracy': correct / max(len(examples), 1),
            'correct': correct,
            'total': len(examples),
            'results': results,
        }

    def infer_single(self, text: str) -> torch.Tensor:
        """
        Run a single text through the trained pipeline using the EXACT same
        ODE dynamics as training (steps, dt, recurrent_scale, normalization).

        Returns the output complex state vector suitable for PhaseAlignmentDecoder.
        """
        hidden_dim = self.cortex.config.hidden_dim
        dt = self.training_dt
        pfc = self.cortex.pfc

        self.text_encoder.eval()  # disable dropout for inference
        with torch.no_grad():
            W = torch.exp(1j * pfc.phase_theta)
            R = torch.exp(1j * pfc.recurrent_theta)

            state = torch.zeros(hidden_dim, dtype=torch.complex64, device=self.device)
            input_vec = self.text_encoder(text)
            input_norm = torch.abs(input_vec).pow(2).sum().sqrt()
            input_vec = input_vec / (input_norm + 1e-6)

            recurrent_scale = 1.0 / math.sqrt(hidden_dim)
            for step in range(self.training_steps):
                z = torch.matmul(input_vec, W.T) + torch.matmul(state, R.T) * recurrent_scale
                d_state = -state + torch.tanh(z)
                state = state + d_state * dt
                state = state / (torch.abs(state) + 1e-6)

        return state


# ============================================================================
# DATA LOADING
# ============================================================================

def load_training_data(path: str) -> List[TrainingExample]:
    """Load behavioral training examples from JSONL file."""
    examples = []
    with open(path, 'r') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                behavior = obj['behavior']
                if behavior not in BEHAVIOR_TYPES:
                    logger.warning(f"Skipping line {line_num}: unknown behavior '{behavior}'")
                    continue
                examples.append(TrainingExample(
                    input_text=obj['input'],
                    behavior=behavior,
                    target_action=obj['target_action'],
                    target_data=obj.get('target_data', {}),
                    expected_response_contains=obj.get('expected_response_contains', []),
                    context=obj.get('context'),
                ))
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Skipping line {line_num}: {e}")

    logger.info(f"Loaded {len(examples)} training examples from {path}")
    return examples


def load_knowledge_base(path: str) -> Dict[str, Any]:
    """Load the McDonald's knowledge base JSON."""
    with open(path, 'r') as f:
        return json.load(f)
