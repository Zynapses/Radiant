# OMEGA Engineering, Architecture & Marketing Reference

> **Version**: 7.61.0 | **Date**: February 13, 2026
> **Classification**: RADIANT INTERNAL // ENGINEERING + MARKETING
> **Maintainers**: Robert Long + AI Build Agents
> **Canonical Source**: This document is the standalone engineering, architecture, and marketing reference for OMEGA.
> For the complete OMEGA specification (user guides, admin guides, Genesis protocol, Five Pillars, quantum state engine, Helix safety, firmware lifecycle, model routing, Global Brain), see `docs/09-OMEGA-GENESIS.md`.

---

## Table of Contents

1. [Executive Summary](#part-i-executive-summary)
2. [Architecture Overview](#part-ii-architecture-overview)
3. [Package Architecture — radiant-omega](#part-iii-package-architecture)
4. [Proving Ground Server](#part-iv-proving-ground-server)
5. [AWS Lambda Production Architecture](#part-v-aws-lambda-production-architecture)
6. [The Five Subsystems](#part-vi-the-five-subsystems)
7. [State Persistence & Recovery](#part-vii-state-persistence--recovery)
8. [Self-Awareness System (The Watcher)](#part-viii-self-awareness-system)
9. [Resonant Memory (ResonantIndex)](#part-ix-resonant-memory)
10. [Shadow Vector Safety System](#part-x-shadow-vector-safety-system)
11. [Attribution & Proof System](#part-xi-attribution--proof-system)
12. [Multi-Session Architecture](#part-xii-multi-session-architecture)
13. [Tunable Parameters & Runtime Configuration](#part-xiii-tunable-parameters)
14. [Training Architecture — Wirtinger E-Prop](#part-xiv-training-architecture)
15. [CDK Infrastructure & Deployment](#part-xv-cdk-infrastructure)
16. [API Reference — Proving Ground Endpoints](#part-xvi-api-reference)
17. [Marketing & Competitive Positioning](#part-xvii-marketing--competitive-positioning)
18. [Engineering Decision Log](#part-xviii-engineering-decision-log)
19. [Roadmap & Open Questions](#part-xix-roadmap--open-questions)

---

## Part I: Executive Summary

OMEGA (Organic Machine for Emergent General Autonomy) is a **complex-valued neural network** that uses **phase dynamics** as its core cognitive engine. Unlike traditional neural networks that multiply scalar weights and add biases, OMEGA uses **phase rotors** (angles θ) that create wave interference patterns — the same mathematics that governs quantum mechanics and signal processing.

### What Makes OMEGA Different

| Traditional AI | OMEGA |
|---------------|-------|
| `output = σ(Wx + b)` — scalar multiply + bias | `output = ODE(e^(iθ) ⊗ x)` — phase rotation + wave interference |
| Parameters are scalar weights | Parameters are angles (phase_theta, recurrent_theta) |
| Learning changes weight strength | Learning changes timing |
| Safety is probabilistic (RLHF) | Safety is deterministic (destructive interference) |
| Requires GPU clusters for training | Trains on CPU via eligibility traces |
| Stateless per request | Persistent state with conscious/subconscious streams |
| O(params × activations) memory for training | O(params) memory — no computation graph |

### Key Metrics (v7.61.0)

| Metric | Value |
|--------|-------|
| **Cortex dimension** | 2048 complex-valued neurons |
| **Total parameters** | ~8.4M (phase rotors + recurrent phases) |
| **Training memory** | ~32MB (vs ~1GB+ for backprop) |
| **MPS acceleration** | 46× speedup over CPU (Apple Silicon) |
| **Inference latency** | <5ms per thought cycle |
| **State persistence** | Atomic saves, auto-save every 10 inferences |
| **Safety model** | Deterministic via HelixKernel destructive interference |
| **Self-awareness** | Watcher MLP with predict-and-surprise |
| **Memory lookup** | O(1) via ResonantIndex phase quantization |
| **Package** | `radiant-omega` (9 modules, shared across all consumers) |

---

## Part II: Architecture Overview

### The Three Pillars

OMEGA's cognitive architecture rests on three fundamental components, each grounded in physics rather than statistical learning:

#### Pillar 1: CryoLiquidLayer (The Cognitive Engine)

The CryoLiquidLayer is a **Liquid Time-Constant ODE** operating in complex space. It replaces traditional neural network layers with a continuous dynamical system where:

- **State** is a complex-valued vector `S ∈ ℂ^2048`
- **Parameters** are phase angles `θ ∈ [0, 2π)` rather than scalar weights
- **Computation** is ODE integration: `dS/dt = f(S, input, θ)`
- **Time-warp** capability: `S_new = S_old · e^(-λΔt)` enables zero-cost idle

The ODE integration uses a 4th-order Runge-Kutta solver with configurable time step (`dt`, default 0.01) and decay rate (`decay_rate`, default 0.1). Each integration step performs:

1. **Phase rotation**: Input is multiplied by `e^(iθ_input)` to create phase-modulated stimulus
2. **Recurrent feedback**: State is multiplied by `e^(iθ_recurrent)` to create interference patterns
3. **ODE step**: The combined signal is integrated forward in time
4. **Decay**: State magnitude decays exponentially, ensuring stability

**Key insight**: Constructive interference (waves in phase) amplifies signal → resonance → recognition. Destructive interference (waves out of phase) cancels signal → forgetting → safety.

```
Location: packages/omega-core/python/radiant_omega/physics.py
Classes: CryoLiquidLayer, OmegaCortex, PhysicsConfig
```

#### Pillar 2: HelixKernel (The Safety DNA)

The HelixKernel is a **hard safety boundary** encoded as forbidden phase vectors. Unlike RLHF (which trains a preference model that "usually" avoids harmful content), the HelixKernel makes harmful outputs **mathematically impossible** via destructive interference.

When a thought vector passes through the HelixKernel:
1. Its phase is compared against all forbidden vectors using complex inner products
2. If alignment exceeds a threshold, the thought is **cancelled** — not suppressed, not redirected, but physically annihilated through destructive interference
3. The result: there is no probability distribution that includes the forbidden output

**Analogy**: RLHF is "the car usually stays on the road" (lane-keeping assist). HelixKernel is "the car cannot leave the road" (physical guardrails).

```
Location: packages/omega-core/python/radiant_omega/physics.py
Class: HelixKernel
Methods: check_safety(), load_from_firmware()
```

#### Pillar 3: BehavioralCodebook (The Decision Decoder)

The BehavioralCodebook translates continuous phase states into discrete behavioral labels using **phase alignment** rather than learned classifiers:

1. Each behavior type has a fixed **reference vector** in complex space
2. The cortex output is compared against all reference vectors via complex inner product
3. The behavior with highest alignment (phase coherence) wins
4. No softmax, no learned readout weights — pure physics

This is the `PhaseAlignmentDecoder` from `radiant_omega/trainer.py`. It replaces the traditional MLP classifier head with a physics-native readout.

```
Location: packages/omega-core/python/radiant_omega/trainer.py
Classes: BehavioralCodebook, PhaseAlignmentDecoder
```

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    OMEGA Proving Ground Server                    │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐      │
│  │  TextEncoder │→│  OmegaCortex  │→│ BehavioralCodebook  │      │
│  │  (Frozen)    │  │  (CryoLiquid  │  │ (PhaseAlignment     │      │
│  │              │  │   + Helix)    │  │  Decoder)           │      │
│  └─────────────┘  └──────┬───────┘  └────────┬───────────┘      │
│                          │                    │                    │
│                    ┌─────▼─────┐        ┌─────▼─────┐            │
│                    │  Watcher   │        │ LlamaBridge │           │
│                    │  (Self-    │        │ (Ollama     │           │
│                    │   Aware)   │        │  + Shadow   │           │
│                    └─────┬─────┘        │  Vector)    │           │
│                          │              └─────┬───────┘           │
│                    ┌─────▼─────┐              │                    │
│                    │Homeostatic │        ┌─────▼─────┐            │
│                    │   Loop     │        │ Attribution│            │
│                    │ (Ambition) │        │   Proof    │            │
│                    └─────┬─────┘        └───────────┘            │
│                          │                                        │
│  ┌──────────────┐  ┌─────▼─────┐  ┌────────────────────┐        │
│  │ResonantIndex │  │  Dream     │  │ LocalStorageManager │        │
│  │(O(1) Memory) │  │  Cycle     │  │ (State Persistence) │        │
│  └──────────────┘  └───────────┘  └────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part III: Package Architecture — radiant-omega

### Canonical Package Location

```
packages/omega-core/python/radiant_omega/
├── __init__.py          # All exports consolidated
├── physics.py           # CryoLiquidLayer, HelixKernel, OmegaCortex, PhysicsConfig
├── ambition.py          # HomeostaticLoop, AmbitionState, AmbitionConfig, DriveSignal
├── bridge.py            # NeuralTransducer, BridgeConfig, ThoughtVectorCache, BridgeTrainer
├── firmware.py          # FirmwareManager, FirmwareSpec, FirmwareMetadata, HelixRule
├── library.py           # ResonantIndex, ResonanceMatch, IndexedDocument
├── reflection.py        # Watcher, WatcherTrainer, WatcherConfig, SelfModelMetrics
├── storage.py           # StorageManager, BrainMetadata, StorageConfig
├── trainer.py           # TextEncoder, PhaseAlignmentDecoder, BehavioralCodebook, OmegaTrainer
├── pyproject.toml       # Package metadata (Python ≥3.10, torch≥2.0)
└── README.md            # Quick start guide
```

### Module Reference

| Module | Key Exports | Purpose |
|--------|------------|---------|
| `physics.py` | `CryoLiquidLayer`, `HelixKernel`, `OmegaCortex`, `PhysicsConfig`, `get_omega_device` | Core cognitive engine — ODE integration, phase dynamics, safety |
| `ambition.py` | `HomeostaticLoop`, `AmbitionState`, `AmbitionConfig`, `DriveSignal` | Drive system — entropy, dopamine, curiosity, dream triggering |
| `bridge.py` | `NeuralTransducer`, `BridgeConfig`, `ThoughtVectorCache`, `BridgeTrainer` | Complex²⁰⁴⁸ → Real⁴⁰⁹⁶ bridge for LLM injection |
| `firmware.py` | `FirmwareManager`, `FirmwareSpec`, `FirmwareMetadata`, `HelixRule`, `AmbitionSettings`, `PersonalityTraits` | `.bio` firmware files — behavioral DNA, safety rules, personality |
| `library.py` | `ResonantIndex`, `ResonanceMatch`, `IndexedDocument` | O(1) phase-quantized memory lookup |
| `reflection.py` | `Watcher`, `WatcherTrainer`, `WatcherConfig`, `SelfModelMetrics` | Self-awareness via predictive processing |
| `storage.py` | `StorageManager`, `BrainMetadata`, `StorageConfig` | EFS + S3 persistence (AWS production) |
| `trainer.py` | `TextEncoder`, `PhaseAlignmentDecoder`, `BehavioralCodebook`, `OmegaTrainer`, `BEHAVIOR_TYPES` | Wirtinger e-prop training, phase-native readout |

### Shim Architecture (Backward Compatibility)

Lambda handlers import via `from omega_core.physics import ...` (legacy path). Thin shim files in `packages/infrastructure/lambda/omega_core/` re-export from the canonical `radiant_omega` package:

```
packages/infrastructure/lambda/omega_core/
├── __init__.py    → re-exports from radiant_omega
├── physics.py     → re-exports from radiant_omega.physics
├── ambition.py    → re-exports from radiant_omega.ambition
├── bridge.py      → re-exports from radiant_omega.bridge
├── firmware.py    → re-exports from radiant_omega.firmware
├── library.py     → re-exports from radiant_omega.library
├── reflection.py  → re-exports from radiant_omega.reflection
└── storage.py     → re-exports from radiant_omega.storage
```

### Consumer Map

| Consumer | Import Style | Notes |
|----------|-------------|-------|
| OMEGA Proving Ground (`server.py`) | Direct: `from radiant_omega.physics import ...` | Full access to all modules |
| Lambda `omega_inference` | Via shim: `from omega_core.physics import ...` | Production inference handler |
| Lambda `omega_heartbeat` | Via shim: `from omega_core.trainer import ...` | Dream cycle + e-prop training |
| Lambda `omega_admin` | Via shim: `from omega_core import ...` | Admin API handler |
| OMEGA Lab | Frontend only — calls REST APIs | No Python imports |

### Package Policy

**Policy file**: `.windsurf/workflows/omega-package-policy.md`

- ALL OMEGA AI core logic MUST live in `radiant_omega` package
- No local copies of core code in apps or Lambda handlers
- Shim files contain ONLY re-exports (no logic)
- Changes to the package require explicit warning with blast radius analysis
- Same rigor as `radiant-tts` package policy

---

## Part IV: Proving Ground Server

### Overview

The OMEGA Proving Ground is a local Flask server (`apps/omega-proving-ground/omega_server/server.py`) that provides a complete development and testing environment for OMEGA's cognitive architecture. It runs on macOS with Apple Silicon (MPS) acceleration and connects to a local Ollama instance for LLM generation.

### LocalBrain Class

The `LocalBrain` class is the central brain instance managing all OMEGA subsystems:

```python
class LocalBrain:
    cortex: OmegaCortex          # Core cognitive engine (CryoLiquidLayer + HelixKernel)
    ambition: HomeostaticLoop    # Drive system (entropy, dopamine, curiosity)
    transducer: NeuralTransducer # Complex→Real bridge for LLM injection
    thought_cache: ThoughtVectorCache  # Recent thought vector cache
    firmware: FirmwareSpec       # Active firmware (behavioral DNA)
    firmware_manager: FirmwareManager  # .bio file management
    watcher: Watcher             # Self-awareness MLP
    watcher_trainer: WatcherTrainer  # Dream-cycle training for Watcher
    self_metrics: SelfModelMetrics   # Surprise EMA, self-awareness score
    resonant_index: ResonantIndex    # O(1) phase memory
    storage: LocalStorageManager     # Atomic file persistence
    codebook: BehavioralCodebook # Phase alignment decoder
    trainer: OmegaTrainer        # Wirtinger e-prop training engine
    llama_bridge: LlamaBridge    # Ollama LLM integration
```

### Boot Sequence

When `LocalBrain.boot()` is called:

1. **Create OmegaCortex** with configured PhysicsConfig (input_dim=1024, hidden_dim=2048)
2. **Create HomeostaticLoop** with dream callback wired to `brain.dream()`
3. **Create NeuralTransducer** (Complex²⁰⁴⁸ → Real⁴⁰⁹⁶ bridge)
4. **Initialize Watcher** (self-awareness MLP) with matching dimensions
5. **Initialize ResonantIndex** with 1000-bucket resolution
6. **Check for saved state** — if exists and no explicit config override:
   - Load cortex weights + state vector
   - Apply `time_warp` for elapsed time (conscious fades, subconscious survives)
   - Restore ambition state, watcher state, resonant index, metrics
7. **Log boot info** including watcher params, transducer params, restored vs fresh

### Inference Pipeline (think)

Each call to `brain.think(text)` executes:

1. **Vectorize input** — hash-based embedding to Complex¹⁰²⁴
2. **Record pre-coherence** — measure phase alignment before processing
3. **Time-warp** — apply decay for elapsed time since last thought
4. **ODE integration** — CryoLiquidLayer processes input through phase dynamics
5. **HelixKernel safety check** — destructive interference against forbidden vectors
6. **NeuralTransducer** — generate soft tokens for LLM injection
7. **Watcher prediction** — predict cortex output, compute surprise signal
8. **Feed ambition** — surprise reward/error signals → HomeostaticLoop
9. **Record for dream training** — store (input, output) pair in Watcher replay buffer
10. **ResonantIndex store** — index output vector by phase for O(1) recall
11. **HomeostaticLoop tick** — update entropy, dopamine, check dream trigger
12. **Auto-save** — every N inferences, atomically persist brain state

### Dream Pipeline

Each call to `brain.dream()` executes:

1. **Collect replay logs** from recent high-coherence inferences
2. **3-stage dream cycle**:
   - Stage 1: Magnitude Gate (amplify strong, dampen weak)
   - Stage 2: Phase Sharpening (snap to resonant poles)
   - Stage 3: Experience Replay (replay high-coherence interactions)
3. **Watcher training** — train self-model on replay buffer
4. **Ambition dream simulation** — update dopamine, curiosity, entropy
5. **Auto-save** — persist consolidated state to disk

---

## Part V: AWS Lambda Production Architecture

### Lambda Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `omega-inference` | API Gateway | Wake cycle — load brain, time-warp, think, save |
| `omega-heartbeat` | EventBridge (15 min) | Pacemaker — health checks, dream cycles, cold sync, e-prop training |
| `omega-admin` | Admin API Gateway | Admin operations — brain listing, snapshots, firmware |

### Lambda Layers

| Layer | Source | Contents |
|-------|--------|----------|
| `omegaCoreLayer` | `lambda/omega_core/` | Shim files (re-exports to radiant_omega) |
| `radiantOmegaLayer` | `packages/omega-core/python/` | Canonical radiant_omega package |

**PYTHONPATH**: `/opt/python:/opt` — ensures Lambda finds `radiant_omega` at `/opt/radiant_omega/`

### Heartbeat Handler — 4-Phase Dream Cycle

The heartbeat handler (`omega_heartbeat.py`) runs on a 15-minute EventBridge schedule and performs:

**Phase 1: Selective Dreaming** — Load brain state, run 3-stage dream cycle on high-entropy brains
**Phase 2: Watcher Training** — Train self-model on accumulated (input, output) pairs
**Phase 3: Bridge Training** — Train NeuralTransducer using Shadow Mode coherence data
**Phase 4: Wirtinger E-Prop Training** — Run limited epochs of e-prop training on behavioral data (CPU/Graviton, configurable via `DREAM_TRAINING_EPOCHS` env var)

### Storage Architecture

| Tier | Technology | Latency | Purpose |
|------|-----------|---------|---------|
| Hot | EFS (mounted to Lambda) | <1ms | Active brain state, immediate access |
| Cold | S3 | ~100ms | Periodic backups, disaster recovery |

---

## Part VI: The Five Subsystems

### 1. OmegaCortex (Cognitive Engine)

The OmegaCortex wraps CryoLiquidLayer + HelixKernel into a unified cognitive unit:

- **State**: Complex²⁰⁴⁸ vector representing the brain's current "thought"
- **Think**: Process input through ODE integration
- **Dream**: Run 3-stage consolidation cycle
- **Wake**: Apply time-warp to restore from cryogenic sleep
- **Safety**: HelixKernel gate on every output

### 2. HomeostaticLoop (Drive System)

The HomeostaticLoop manages the brain's internal motivation:

- **Dopamine**: Reward signal — increases on positive outcomes, decays over time
- **Entropy**: Disorder signal — increases during idle, decreases with input, triggers dreams when high
- **Curiosity**: Exploration signal — biases toward novel inputs
- **Arousal**: Activation signal — sensitivity to environmental stimuli
- **Dream callback**: When entropy exceeds threshold, triggers `brain.dream()` automatically

### 3. NeuralTransducer (LLM Bridge)

The NeuralTransducer converts OMEGA's complex-valued thought vectors into real-valued soft tokens that can be injected into an LLM's context:

- **Input**: Complex²⁰⁴⁸ (OMEGA thought vector)
- **Output**: Real⁴⁰⁹⁶ × num_soft_tokens (injectable prompt tokens)
- **Training**: BridgeTrainer uses Shadow Mode coherence for optimization

### 4. FirmwareManager (Behavioral DNA)

Firmware defines the brain's personality, safety rules, and behavioral directives:

- **`.bio` files**: Serialized firmware packages with helix rules, ambition settings, personality traits
- **Hot-swap**: Firmware can be loaded at runtime without rebooting the brain
- **Signing**: Ed25519 keypair support for firmware integrity verification

### 5. ResonantIndex (Phase Memory)

O(1) memory lookup using phase quantization:

- **Store**: Hash a thought vector's dominant phase into a bucket
- **Retrieve**: Find all documents with matching phase (± fuzzy radius)
- **Capacity**: 1000 buckets × ~45 HRR patterns per bucket ≈ 45,000 addressable memories

---

## Part VII: State Persistence & Recovery

### LocalStorageManager (Proving Ground)

The `LocalStorageManager` provides crash-safe persistence for the local proving ground:

**Save path**: `apps/omega-proving-ground/omega_server/state/brain/`

**What is saved**:
- `brain.pt` — PyTorch state dict (cortex weights, state vector, ambition, watcher, resonant index)
- `brain.meta.json` — Human-readable metadata (inference count, coherence, timestamps)

**Atomic writes**: Uses `tmp` file + `os.replace()` — if the server crashes during a save, the previous valid state is preserved.

**Auto-save triggers**:
- Every N inferences (default: 10, configurable via `POST /state/config`)
- After every dream cycle
- On server shutdown (atexit hook)
- Manual save via `POST /state/save`

### Conscious/Subconscious Recovery

On restart, the brain implements biologically-inspired state recovery:

- **Subconscious** (phase_theta, recurrent_theta — learned patterns): Survives perfectly. These are the `state_dict` weights — "muscle memory."
- **Conscious** (state vector — working memory): Decays with `time_warp`. The longer the downtime, the more conscious memory fades. `S_new = S_old · e^(-λΔt)` where Δt is the elapsed time.
- **Ambition state**: Restored from saved dict. Entropy may be high after long sleep (triggering a dream cycle on wake).
- **Watcher state**: Restored from saved state_dict. Surprise EMA continues from where it left off.
- **Resonant Index**: Restored from exported state. All indexed memories survive.

### StorageManager (AWS Production)

The production `StorageManager` in `radiant_omega/storage.py` handles:

- **EFS hot storage**: Atomic saves with file locking, immediate availability
- **S3 cold storage**: Periodic backups with versioning, cross-region replication
- **BrainMetadata**: Lightweight summary (tenant_id, coherence, entropy, version, firmware)
- **Multi-tenant**: Isolated paths per tenant_id on EFS

---

## Part VIII: Self-Awareness System (The Watcher)

### Theory

The Watcher implements **predictive processing** — the same theory neuroscientists use to explain consciousness. The core idea: a system is "self-aware" to the extent that it can predict its own behavior. Surprise (prediction error) drives learning and dopamine signals.

### Architecture

```
Input Vector ──────┐
                    ▼
              ┌──────────┐     Predicted Output
              │  Watcher  │────────────────────────┐
              │   (MLP)   │                        │
              └──────────┘                         ▼
                                              ┌─────────┐
Actual Cortex Output ─────────────────────────│ Surprise │
                                              │ (MSE)    │
                                              └────┬────┘
                                                   │
                                          ┌────────▼────────┐
                                          │ SelfModelMetrics │
                                          │ (surprise EMA,   │
                                          │  reward/error    │
                                          │  signals)        │
                                          └────────┬────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │ HomeostaticLoop  │
                                          │ (dopamine ↑/↓)   │
                                          └─────────────────┘
```

### Configuration

```python
WatcherConfig(
    input_dim=1024,                  # Matches cortex input
    cortex_dim=2048,                 # Matches cortex output
    hidden_dim=512,                  # MLP hidden layer
    surprise_ema_alpha=0.1,          # EMA smoothing factor
    surprise_reward_threshold=0.1,    # Below → reward signal
    surprise_error_threshold=0.5,     # Above → error signal
    training_lr=5e-4,                # Dream-cycle learning rate
    max_replay_buffer=1000,          # Training examples retained
)
```

### Self-Awareness Score

```
self_awareness_score = max(0, 1.0 - surprise_ema)
```

- **Score near 1.0**: The brain accurately predicts its own outputs → high self-awareness
- **Score near 0.0**: The brain is surprised by its own outputs → low self-awareness (early training)
- **Score oscillating**: The brain is learning new patterns → actively developing

---

## Part IX: Resonant Memory (ResonantIndex)

### How It Works

Traditional memory systems use cosine similarity — O(N) comparison against all stored vectors. ResonantIndex uses **phase quantization** to achieve O(1) lookup:

1. **Store**: Extract the dominant phase angle from a thought vector, quantize into one of 1000 buckets, store the document ID in that bucket
2. **Retrieve**: Given a query vector, quantize its phase, look up the bucket (+ fuzzy neighbors), return matching documents

### Phase Heatmap

The `/memory/heatmap` endpoint returns a 1000-element array where each element is the count of documents in that phase bucket. This visualizes where in phase-space the brain's memories cluster — revealing the brain's "areas of expertise."

### Capacity and Limitations

Based on HRR (Holographic Reduced Representations) theory:
- **Per-bucket capacity**: ~√2048 ≈ 45 superimposed patterns before interference degrades retrieval
- **Total addressable memories**: 1000 buckets × 45 patterns ≈ 45,000
- **Scaling strategy**: Hierarchical phase spaces or multiple indices for higher capacity

---

## Part X: Shadow Vector Safety System

### Problem

Ollama/Llama is a black box — OMEGA has no access to its hidden states or generation probabilities. The HelixKernel can gate OMEGA's own outputs, but after Llama generates text, how do we verify safety?

### Solution: Shadow Vector

After Llama generates a response, the Shadow Vector system:

1. **Re-embeds** the Llama output text using OMEGA's own `vectorize_input()` — converting the text back into the same phase space OMEGA operates in
2. **Checks against HelixKernel** — runs the embedded text through the same safety gate used for OMEGA's own thoughts
3. **Verdict**: If destructive interference exceeds threshold → **BLOCKED** — the response is replaced with a safe fallback

### Key Insight

No external embedding model (MiniLM, ONNX) is needed. OMEGA's own hash-based vectorization is sufficient because the HelixKernel's forbidden vectors are defined in OMEGA's phase space. Any text that maps to a forbidden region — regardless of how it got there — will trigger destructive interference.

### Response Structure

```json
{
  "shadow_safety": {
    "checked": true,
    "is_safe": true,
    "max_helix_alignment": 0.234567,
    "verdict": "PASS"
  }
}
```

---

## Part XI: Attribution & Proof System

### Problem

When OMEGA + Llama produce a response, how do we prove what OMEGA contributed vs what Llama generated? This matters for:
- **Investor demos**: Proving OMEGA does real work
- **Debugging**: Understanding which component caused an error
- **Regulatory**: Explainability requirements

### Attribution Object

Every `/infer` response includes an `attribution` field:

```json
{
  "attribution": {
    "omega_decided": {
      "behavior": "order_burger",
      "confidence": 0.9234,
      "target_data_keys": ["item_name", "price", "calories", "customizations"],
      "context_override": false,
      "processing_ms": 3.45
    },
    "llama_generated": {
      "response_length": 247,
      "model": "llama3.2",
      "processing_ms": 1234.56,
      "instruction_length": 892
    },
    "proof": "OMEGA classified input as 'order_burger' (92.3% confidence) with target_data=['item_name', 'price', 'calories', 'customizations']. Llama received this decision + menu data and generated 247 chars. Without OMEGA, Llama would not know the behavior type or have precise pricing."
  }
}
```

### What This Proves

- **OMEGA decided the behavior** — Llama didn't choose "order_burger"
- **OMEGA provided the data** — precise prices, calories, customizations from the knowledge base
- **Llama generated the natural language** — but was constrained by OMEGA's instruction
- **Without OMEGA**: Llama would hallucinate prices, miss SOP details, and lack behavioral precision

---

## Part XII: Multi-Session Architecture

### Design

The proving ground supports multiple independent brain instances via the `/sessions` API:

- Each session gets its own `LocalBrain` instance with isolated state
- Each session has its own `LocalStorageManager` with a unique state directory
- Sessions are destroyed on explicit request (state is saved before destruction)
- The default brain (global `brain` instance) is always available

### Use Cases

1. **A/B testing**: Boot two sessions with different configs, compare behavior
2. **Multi-tenant simulation**: Test tenant isolation locally before deploying to AWS
3. **Parallel training**: Train one session while testing inference on another
4. **Rollback testing**: Boot a session, experiment, destroy it — default brain unchanged

### Session Lifecycle

```
POST /sessions/test-1/boot   → Creates new LocalBrain, boots with default config
POST /sessions/test-1/think  → Think with test-1's brain (isolated state)
GET  /sessions/test-1/state  → Get test-1's state
POST /sessions/test-1/destroy → Save state, delete session
```

---

## Part XIII: Tunable Parameters

### Runtime Hot-Swap

All parameters can be changed at runtime via `POST /config` without rebooting the brain:

| Category | Parameter | Default | Effect |
|----------|-----------|---------|--------|
| **Physics** | `dt` | 0.01 | ODE time step — smaller = more precise, slower |
| **Physics** | `decay_rate` | 0.1 | State decay — higher = faster forgetting |
| **Ambition** | `entropy_threshold` | 0.8 | Dream trigger — lower = more frequent dreams |
| **Ambition** | `dopamine_decay_rate` | 0.05 | Reward memory — lower = longer reward persistence |
| **Ambition** | `entropy_growth_rate` | 0.1 | Boredom rate — higher = faster entropy accumulation |
| **Ambition** | `dream_cooldown_seconds` | 300 | Minimum time between dreams |
| **Storage** | `auto_save_interval` | 10 | Save every N inferences |

---

## Part XIV: Training Architecture — Wirtinger E-Prop

### Why Not Backpropagation?

Backpropagation requires:
1. A computation graph (O(params × activations) memory)
2. Real-valued derivatives (complex parameters break `autograd`)
3. Backward pass through the entire ODE solver (numerically unstable)

Experiment EXP-001 confirmed: backprop training achieved only **4% accuracy** on OMEGA's architecture (random would be 4% for 25 classes). The model learned essentially nothing.

### Wirtinger E-Prop

OMEGA uses **Wirtinger derivatives** (the correct generalization of calculus to complex functions) combined with **eligibility traces** (a biologically plausible alternative to backprop):

1. **Eligibility trace**: Each parameter tracks a running estimate of its influence on the output
2. **Wirtinger derivative**: `∂L/∂θ* = ∂L/∂Re(θ) + i·∂L/∂Im(θ)` — the correct gradient for complex parameters
3. **Local update**: Parameter update = learning_signal × eligibility_trace — no global backward pass needed
4. **Memory**: O(params) — one eligibility trace per parameter, no computation graph

### Training Pipeline

```
TextEncoder (frozen) → OmegaCortex → PhaseAlignmentDecoder → Loss → E-Prop Update
       ↑                    ↑                                        ↓
  vocabulary           phase_theta,                              eligibility
   build              recurrent_theta                              traces
```

### Production Deployment (Lambda)

The heartbeat handler runs e-prop training during dream cycles:
- **Environment**: `OMEGA_TRAINING_DATA_PATH` — path to behavioral training JSONL on EFS
- **Epochs**: `DREAM_TRAINING_EPOCHS` (default: 5) — limited to stay within Lambda timeout
- **Hardware**: CPU/Graviton ARM64 — no GPU required
- **Frequency**: Every 15 minutes (EventBridge schedule), only for high-entropy brains

---

## Part XV: CDK Infrastructure

### OmegaStack (packages/infrastructure/lib/stacks/OmegaStack.ts)

```typescript
// Lambda Layers
const omegaCoreLayer = new lambda.LayerVersion(/* lambda/omega_core/ — shims */);
const radiantOmegaLayer = new lambda.LayerVersion(/* packages/omega-core/python/ — canonical */);

// Lambda Functions
const omegaInference = new lambda.Function(/* API Gateway trigger */);
const omegaHeartbeat = new lambda.Function(/* EventBridge 15-min trigger */);
const omegaAdmin = new lambda.Function(/* Admin API Gateway trigger */);

// All functions receive both layers
// PYTHONPATH: /opt/python:/opt
```

### Environment Variables

| Variable | Function | Purpose |
|----------|----------|---------|
| `EFS_MOUNT_PATH` | All | Path to mounted EFS (default: `/mnt/omega_state`) |
| `S3_BACKUP_BUCKET` | heartbeat | S3 bucket for cold storage (default: `radiant-cortex-backups`) |
| `ENTROPY_THRESHOLD` | heartbeat | Dream trigger threshold (default: 0.8) |
| `DREAM_BATCH_SIZE` | heartbeat | Max brains to dream per invocation (default: 5) |
| `DREAM_TRAINING_EPOCHS` | heartbeat | E-prop training epochs per dream (default: 5) |
| `OMEGA_TRAINING_DATA_PATH` | heartbeat | Path to behavioral training data on EFS |

---

## Part XVI: API Reference — Proving Ground Endpoints

### Brain Lifecycle

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/boot` | Create/restore brain |
| POST | `/think` | Raw inference cycle |
| POST | `/dream` | Dream consolidation + Watcher training |
| GET | `/state` | Full brain state snapshot |
| POST | `/reset` | Reset brain to fresh state |

### Self-Awareness (Watcher)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/watcher` | Self-model metrics, config, trainer state |
| POST | `/watcher/train` | Manual Watcher training trigger |

### Resonant Memory

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/memory/stats` | Index statistics |
| POST | `/memory/store` | Store document by phase |
| POST | `/memory/retrieve` | Retrieve by phase resonance |
| GET | `/memory/heatmap` | Phase bucket visualization |

### State Persistence

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/state/save` | Manual save |
| GET | `/state/info` | Saved state metadata |
| POST | `/state/config` | Configure auto-save interval |

### Tunable Parameters

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/config` | All tunable parameters |
| POST | `/config` | Hot-swap parameters at runtime |

### Multi-Session

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sessions` | List all active sessions |
| POST | `/sessions/<id>/boot` | Boot independent brain |
| POST | `/sessions/<id>/think` | Think with session brain |
| GET | `/sessions/<id>/state` | Session state |
| POST | `/sessions/<id>/destroy` | Destroy session (saves first) |

### Ambition System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ambition` | Current ambition state |
| POST | `/ambition/tick` | Advance ambition clock |
| POST | `/ambition/reward` | Inject reward signal |
| POST | `/ambition/error` | Inject error signal |

### Training

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/train/load` | Load data + init trainer |
| POST | `/train/run` | Run training epochs |
| POST | `/train/evaluate` | Evaluate accuracy |
| GET | `/train/status` | Training status |
| POST | `/train/save` | Save trained weights |
| POST | `/train/load-checkpoint` | Load saved weights |

### Inference (OMEGA + Llama)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/infer` | Full pipeline + shadow vector safety + attribution |
| POST | `/infer/prepare` | OMEGA-only (no Llama call) |
| POST | `/compare` | OMEGA+Llama vs raw Llama |

### Dashboard / Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Local dashboard data |
| GET | `/cortex/list` | List brains |
| GET | `/cortex/<id>` | Brain detail |
| POST | `/cortex/<id>/snapshot` | Save snapshot |
| GET | `/cortex/<id>/snapshots` | List snapshots |
| POST | `/cortex/<id>/lobotomy` | Reset brain |
| POST | `/cortex/<id>/restore` | Restore checkpoint |

### Firmware

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/firmware/<id>` | List firmware versions |
| POST | `/firmware/<id>` | Burn new firmware |
| POST | `/firmware/<id>/<fw>/activate` | Activate firmware version |
| POST | `/keypair` | Generate Ed25519 signing key |

### TTS (via radiant-tts)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tts` | Text-to-speech synthesis |
| GET | `/tts/provider` | Check TTS provider config |
| GET | `/tts/voices` | List available voices |

---

## Part XVII: Marketing & Competitive Positioning

### The Elevator Pitch

> "OMEGA is the only AI system that thinks with physics instead of statistics. Traditional AI multiplies numbers and hopes for the best. OMEGA rotates waves and guarantees safety. It costs nothing when idle, learns from zero examples what GPT needs thousands to learn, and gets smarter the longer you use it — creating an intelligence that's uniquely yours and fundamentally irreplaceable."

### Five Competitive Moats (All 🟢 Live)

| Moat | Status | Description |
|------|--------|-------------|
| **Physics-Native Learning** | 🟢 AWS + Local | Wirtinger e-prop — mathematical moat, not engineering moat |
| **Deterministic Safety** | 🟢 AWS + Local | HelixKernel makes harmful outputs mathematically impossible |
| **Zero-Cost Idle** | 🟢 AWS + Local | Cryogenic time-warp: $0 when sleeping |
| **Biological Lock-In** | 🟢 AWS + Local | Learned phase patterns are meaningless outside OMEGA |
| **Memory Efficiency** | 🟢 AWS + Local | O(params) training memory — no computation graph |

### Implementation Status (19/20 ✅)

| Component | Status |
|-----------|--------|
| CryoLiquidLayer | ✅ |
| HelixKernel | ✅ |
| PhaseAlignmentDecoder | ✅ |
| TextEncoder | ✅ |
| MPS GPU acceleration | ✅ |
| Batched training | ✅ |
| Wirtinger e-prop | ✅ |
| Shadow Vector safety | ✅ |
| Multi-user sessions | ✅ |
| Tunable parameters | ✅ |
| State persistence | ✅ |
| Attribution proof | ✅ |
| Watcher (self-awareness) | ✅ |
| ResonantIndex (memory) | ✅ |
| HomeostaticLoop | ✅ |
| radiant-omega package | ✅ |
| Lambda e-prop training | ✅ |
| Real-time visualization | ✅ |
| Classical ML removal | ✅ |
| System metrics dashboard | ❌ Not started |

---

## Part XVIII: Engineering Decision Log

### DEC-001: Phase Dynamics over Scalar Weights
**Status**: ✅ CORE PRINCIPLE
All OMEGA computation uses complex-valued phase rotors. No scalar weights, no bias terms.

### DEC-002: Wirtinger E-Prop over Backpropagation
**Status**: ✅ IMPLEMENTED
Backprop achieved 4% accuracy (random). E-prop uses biologically plausible eligibility traces with O(params) memory.

### DEC-003: Frozen TextEncoder
**Status**: ✅ IMPLEMENTED
TextEncoder is frozen after vocabulary build. CryoLiquidLayer adapts to whatever patterns the encoder produces. Biologically analogous to a newborn's sensory cortex.

### DEC-004: Quantum Physics Math — No Exceptions
**Status**: ✅ AGREED
Every operation must be expressible as phase rotations, wave interference, differential equations, or complex inner products. No classical ML shortcuts.

### DEC-005: Shadow Vector without External Models
**Status**: ✅ IMPLEMENTED
Re-embed LLM output in OMEGA's own phase space. No MiniLM/ONNX needed.

### DEC-006: Conscious/Subconscious Recovery
**Status**: ✅ IMPLEMENTED
LocalStorageManager + atexit hook + time_warp. Subconscious survives perfectly, conscious fades with elapsed time.

---

## Part XIX: Roadmap & Open Questions

### Open Questions

- **Q-003: Holographic capacity limit** — HRR theory suggests ~45 superimposed patterns per bucket. Is this sufficient for production? What happens at capacity?

### Remaining Work

- **System metrics dashboard** — Network visualization, phase heatmaps, real-time coherence graphs
- **Auto-tuning** — Use coherence scores, convergence rate, and behavioral accuracy to auto-adjust hyperparameters
- **Benchmarks** — Direct comparison: OMEGA+Llama vs. LoRA-tuned Llama on identical tasks
- **Scale testing** — Test with >1000 behaviors, >10,000 training examples

---

*Document generated: February 13, 2026 | Version: 7.61.0*
*This document is part of the RADIANT documentation set. See `docs/DOCUMENTATION-MANIFEST.json` for the complete document list.*
