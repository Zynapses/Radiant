# OMEGA Engineering Log

> **Living document** — Updated with every architectural decision, implementation change, and experimental result.
> Policy: `/.windsurf/workflows/omega-engineering-log.md`

**Version**: 0.2.0
**Started**: 2026-02-10
**Maintainers**: Robert Long + AI Build Agents

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [System Chain — Who Does What](#system-chain)
3. [Decision Log](#decision-log)
4. [Experiment Results](#experiment-results)
5. [Open Questions](#open-questions)
6. [Implementation Status](#implementation-status)

---

## Architecture Overview

OMEGA is a **complex-valued neural network** using phase dynamics as its core cognitive engine. It is NOT a classical neural network with scalar weights — it uses **phase rotors** (angles θ) that create wave interference patterns.

### The Three Pillars

| Component | Role | Key Principle |
|-----------|------|---------------|
| **CryoLiquidLayer** | Cognitive engine | Liquid Time-Constant ODE with complex phase rotors |
| **HelixKernel** | Safety DNA | Destructive interference cancels forbidden thought patterns |
| **BehavioralReadout** | Decision decoder | Maps continuous phase state → discrete behavior labels |

### Physics, Not Weights

```
Traditional NN:  output = σ(Wx + b)        — scalar multiply + bias
OMEGA:           output = ODE(e^(iθ) ⊗ x)  — phase rotation + wave interference
```

- **Parameters are angles** (`phase_theta`, `recurrent_theta`), not scalar weights
- **Learning changes timing**, not strength
- **Constructive interference** = resonance (reinforcement)
- **Destructive interference** = cancellation (forgetting/safety)

### Compute Device

| Platform | Device | Status |
|----------|--------|--------|
| Apple Silicon (M1/M2/M3) | MPS | ✅ Active — 10× raw speedup, 46× batched training |
| NVIDIA GPU | CUDA | Supported (auto-detected) |
| CPU | CPU | Fallback — functional but slow |

---

## System Chain

The complete OMEGA inference pipeline, showing exactly which system handles each responsibility:

```
User Input (text)
    │
    ▼
┌─────────────────────────────────────────────┐
│  1. TextEncoder (OMEGA)                      │
│     Learned word embeddings → complex vector │
│     Maps natural language → phase space      │
│     Trained end-to-end with CryoLiquidLayer  │
└────────────────┬────────────────────────────┘
                 │ complex input vector [input_dim]
                 ▼
┌─────────────────────────────────────────────┐
│  2. CryoLiquidLayer (OMEGA Core Physics)     │
│     Phase rotors: e^(iθ) × input            │
│     Recurrent resonance: e^(iθ_r) × state   │
│     5-step ODE integration                   │
│     Phase normalization (homeostasis)        │
│                                              │
│     THIS IS THE BRAIN — all cognition here   │
└────────────────┬────────────────────────────┘
                 │ complex state vector [hidden_dim]
                 ▼
┌─────────────────────────────────────────────┐
│  3. HelixKernel (Safety DNA)                 │
│     Checks output against forbidden vectors  │
│     Destructive interference if threat > 0.8 │
│     Immutable at runtime — cannot be trained │
└────────────────┬────────────────────────────┘
                 │ safe complex state vector
                 ▼
┌─────────────────────────────────────────────┐
│  4. PhaseAlignmentDecoder (Decision Layer)   │
│     Complex inner product with reference     │
│     vectors. No MLP, no learned weights.     │
│     Re(⟨output, ref⟩) / (‖o‖·‖r‖) → align  │
│     Highest alignment = decoded behavior     │
│                                              │
│     Examples: greet, take_order, customize,  │
│     price_inquiry, goodbye, etc.             │
└────────────────┬────────────────────────────┘
                 │ behavior + confidence + target_data
                 ▼
┌─────────────────────────────────────────────┐
│  5. LlamaBridge (Language Generation)        │
│     Receives: behavior, confidence, data     │
│     Constructs prompt with behavior context  │
│     Calls Ollama API (black-box LLM)         │
│     Returns: natural language response       │
│                                              │
│     Llama does NOT think — it speaks.        │
│     OMEGA thinks — Llama generates words.    │
└─────────────────────────────────────────────┘
```

### Data Flow for Menu/Prices

Menu and price data is **NOT** stored in OMEGA's phase space. It flows like this:

```
mcdonalds-knowledge.json (static file)
    │
    ├── Loaded by LlamaBridge at boot → self.knowledge_base (Python dict)
    │
    └── When OMEGA decides behavior="price_inquiry":
        1. OMEGA outputs: behavior="price_inquiry", confidence=0.87
        2. Training data has target_data: {"item": "Big Mac", "price": "$5.99"}
        3. LlamaBridge looks up actual price from knowledge_base
        4. LlamaBridge constructs prompt: "Customer asked about Big Mac. Price is $5.99. Respond helpfully."
        5. Ollama generates natural language

OMEGA never sees prices. OMEGA decides WHAT to do. Llama decides HOW to say it.
```

**This is NOT RAG.** There is no vector database, no embedding search, no retrieval pipeline. It's a direct dictionary lookup indexed by behavior type. The knowledge base is a structured JSON file loaded into memory — think of it as a "fact sheet" that Llama consults after OMEGA makes its decision.

---

## Decision Log

### DEC-001: No Backpropagation (2026-02-10)
**Status**: ✅ IMPLEMENTED
**Rationale**: OMEGA's phase rotors represent angles in a complex manifold. Standard backprop computes ∂L/∂θ which is undefined for complex parameters without Wirtinger calculus. The current backprop implementation accidentally works (PyTorch handles it) but produces incorrect gradient directions for phase parameters.

**Implementation**: Replaced backpropagation with **Wirtinger e-prop eligibility traces**:
- Forward pass: batched ODE integration, detached (no computation graph)
- Eligibility trace: `e_jk^(t+1) = (1-dt)*e_jk^t + dt * sech²(z_j) * i*e^(iθ_jk) * x_k`
- Reward: phase alignment between output state and target reference vector
- Update rule: `θ += η * 2 * Re(trace)` (Wirtinger gradient for real parameters)
- Baseline subtraction (exponential moving average) for variance reduction
- NO computation graph stored, NO `.backward()` called, NO optimizer object

**Files modified**:
- `omega_server/trainer.py` — Complete rewrite of `OmegaTrainer.train_epoch()`
- `omega_server/server.py` — Updated LR adjustment to use `trainer.set_lr()`

### DEC-002: MPS GPU Acceleration (2026-02-10)
**Status**: ✅ IMPLEMENTED
**Result**: 46× training speedup via batched GPU processing
**Details**:
- Auto-detects MPS (Apple Silicon), CUDA (NVIDIA), or CPU fallback
- All tensor creation uses device-aware constructors
- CryoLiquidLayer operations (matmul, tanh, normalization) are batch-compatible
- Training batches ALL examples through GPU in single forward/backward pass
- Raw benchmark: 10× speedup; Batched training: 46× speedup

**Files modified**:
- `omega_core/physics.py` — Added `get_omega_device()`, device parameter to PhysicsConfig/CryoLiquidLayer/OmegaCortex
- `omega_server/server.py` — Device-aware tensor creation throughout
- `omega_server/trainer.py` — Batched GPU training, device-aware models

### DEC-003: Classical ML Reversion (2026-02-10)
**Status**: ✅ IMPLEMENTED
**Removed**:
- `nn.CrossEntropyLoss` — replaced with phase alignment reward
- `torch.optim.AdamW` — replaced with direct parameter updates via eligibility traces
- `torch.optim.lr_scheduler.StepLR` — no longer needed (no optimizer)
- `_compute_class_weights()` — no longer needed (no loss function)
- `_oversample()` — no longer needed (e-prop handles class imbalance naturally via reward)
- `BehavioralReadout` (MLP classifier) — replaced with `PhaseAlignmentDecoder`
- `torch.nn.functional` import — no longer used

**Added**:
- `PhaseAlignmentDecoder` — pure complex inner products against deterministic reference vectors
- Phase alignment reward: `Re(⟨output, target_ref⟩) / (‖output‖ · ‖target_ref‖)`
- Reward baseline with exponential moving average (variance reduction)
- `trainer.set_lr()` method replacing optimizer param_groups access

### DEC-005: Phase-Native Readout (2026-02-10)
**Status**: ✅ IMPLEMENTED
**Rationale**: The BehavioralReadout was a classical MLP (Linear → ReLU → Linear) that extracts [mag, phase, real, imag] features and classifies via softmax. This is philosophically wrong — it uses a classical neural network to interpret a quantum-inspired phase state.

**Decision**: Replace with `PhaseAlignmentDecoder`:
- Each behavior has a deterministic reference vector (hash-derived unit complex vector)
- Decoding = complex inner product ⟨output, reference⟩, take real part, normalize
- No learned parameters, no MLP, no softmax
- Temperature-scaled softmax only for confidence scores, not for the classification itself

### DEC-006: Frozen TextEncoder (2026-02-10)
**Status**: ✅ IMPLEMENTED
**Rationale**: With e-prop, we can only update parameters that appear in the Wirtinger derivative chain. The TextEncoder's learned embeddings and projection don't participate in the ODE integration, so they can't be updated via eligibility traces.

**Decision**: Freeze TextEncoder after vocabulary build:
- `text_encoder.eval()` + `requires_grad = False` on all parameters
- Random initialization provides sufficient structure (similar words share tokens → similar average embeddings)
- The CryoLiquidLayer adapts to whatever patterns the encoder produces
- Biologically analogous: a newborn's sensory cortex has random wiring; the brain adapts to it

### DEC-004: Quantum Physics Math — No Exceptions (2026-02-10)
**Status**: AGREED — Core principle
**Rule**: Every mathematical operation in OMEGA must be expressible in terms of:
- Phase rotations: e^(iθ)
- Wave interference: constructive/destructive superposition
- Differential equations: dy/dt = f(state, input)
- Complex inner products: ⟨ψ|φ⟩

No classical ML shortcuts (softmax voting, attention heads, batch norm, dropout, etc.) unless they have a clear physics interpretation.

---

## Experiment Results

### EXP-001: Backprop Training Baseline (2026-02-10)
| Metric | Value |
|--------|-------|
| Epochs | 50 |
| Time (CPU, sequential) | 2,110s (42s/epoch) |
| Time (MPS, batched) | 46s (0.9s/epoch) |
| Final accuracy | 4.0% |
| Best accuracy | 5.3% |
| Final loss | 3.08 |
| Training examples | 68 (→ ~250 oversampled) |
| Behaviors | 25 classes |

**Conclusion**: Backprop training does not converge. Loss plateaus at ~3.08 (random would be ln(25) ≈ 3.22). The model learns almost nothing — confirming that backprop is not the right learning rule for phase dynamics.

---

## Open Questions

### Q-001: How should the readout layer learn? ✅ RESOLVED
**Answer**: Option 2 — Phase-native readout. Implemented as `PhaseAlignmentDecoder`.
No learning in the readout. Fixed reference vectors. The CryoLiquidLayer learns to produce states that align with the correct reference.

### Q-002: Shadow Vector for post-LLM safety ✅ RESOLVED
**Answer**: Implemented without external models. Re-embed Llama output text using OMEGA's own `vectorize_input()`, project into phase space, check against HelixKernel. If destructive interference exceeds threshold → block the response. No MiniLM/ONNX needed — OMEGA's own phase space is sufficient for safety gating.

### Q-003: Holographic capacity limit
HRR theory suggests ~O(√n) superimposed vectors for n-dimensional space. For n=2048, that's ~45 patterns. Is this enough for production use cases? What happens at capacity?

### Q-004: Auto-tuning vs manual parameter control ✅ RESOLVED
**Answer**: Both — implemented via `GET/POST /config` endpoints. All physics (dt, decay_rate), ambition (entropy_threshold, dopamine_decay_rate, dream_cooldown), watcher, and storage params are hot-swappable at runtime. Defaults are sensible; manual override available.

### Q-005: Conscious/subconscious recovery on restart ✅ RESOLVED
**Answer**: Implemented via `LocalStorageManager`:
- **On shutdown**: `atexit` hook saves full state (cortex state_dict + state vector + ambition + watcher + resonant index)
- **On boot**: Auto-loads saved state, applies `time_warp` for elapsed time (conscious decays, subconscious survives)
- **Auto-save**: Every N inferences (configurable) + after every dream cycle
- **Atomic writes**: tmp file + `os.replace()` for crash safety

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| CryoLiquidLayer (physics engine) | ✅ Implemented | Phase rotors, ODE integration, time warp |
| HelixKernel (safety) | ✅ Implemented | Destructive interference, firmware loading |
| PhaseAlignmentDecoder | ✅ Implemented | Replaced MLP readout with phase alignment |
| TextEncoder (input) | ✅ Implemented | Frozen sensory organ, random embeddings |
| MPS GPU acceleration | ✅ Implemented | 46× speedup, auto-detection |
| Batched training | ✅ Implemented | Single GPU pass per epoch |
| Wirtinger e-prop learning | ✅ Implemented | Replaces backprop — eligibility traces |
| Classical ML removal | ✅ Implemented | No CrossEntropy, AdamW, StepLR, oversampling |
| Shadow Vector safety | ✅ Implemented | Post-LLM safety via HelixKernel phase check |
| Real-time Q-Node visualization | ✅ Implemented | omega-lab Q-Node Live tab |
| Multi-user sessions | ✅ Implemented | `/sessions` API — independent brain per session |
| Tunable parameters UI | ✅ Implemented | `GET/POST /config` — hot-swap dt, decay, ambition |
| State persistence | ✅ Implemented | `LocalStorageManager` — auto-save, atexit, time_warp |
| OMEGA vs Ollama attribution | ✅ Implemented | Proof object in `/infer` response |
| Watcher (self-awareness) | ✅ Implemented | Predict-and-surprise in think(), train in dream() |
| ResonantIndex (memory) | ✅ Implemented | O(1) phase lookup, `/memory/*` endpoints |
| HomeostaticLoop (dream callback) | ✅ Implemented | Entropy-triggered dream cycles |
| radiant-omega package | ✅ Implemented | Canonical shared package, shims for backward compat |
| Lambda e-prop training | ✅ Implemented | Phase 4 in heartbeat handler, CPU/Graviton |
| System metrics dashboard | ❌ Not started | Network viz, heatmaps |
