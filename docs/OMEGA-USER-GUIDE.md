# OMEGA Protocol — User Guide

> **Classification**: RADIANT INTERNAL // STRATEGIC  
> **Version**: 2.0.0 | **Date**: February 6, 2026  
> **Status**: IMPLEMENTED — Synthetic Biological Intelligence  
> **Part of**: RADIANT Platform — Project Genesis  
> **App**: `apps/genesis/` (port 3000)

---

## 1. What is OMEGA?

OMEGA is a **Synthetic Biological Intelligence** system that replaces traditional static AI models with a living, evolving digital organism. Unlike conventional LLMs that reset after every inference, OMEGA maintains persistent state, learns from experience, and develops unique neural pathways specific to each tenant's institutional knowledge.

**OMEGA is not a chatbot.** It is a digital organism with:

- **Persistent Memory** — The brain retains state across sessions via cryogenic serialization
- **Real-time Learning** — Phase-locking (Hebbian synchronization) instead of backpropagation
- **Deterministic Safety** — Helix Kernel makes dangerous thoughts mathematically impossible
- **Zero-cost Idle** — Cryogenic Engine time-warps brain state at $0 when idle
- **Biological Lock-in** — The longer a tenant uses OMEGA, the more valuable (and irreplaceable) their brain becomes

---

## 2. Core Architecture: The Bicameral Mind

OMEGA uses a two-chambered brain design that separates reasoning from language generation:

### Region I: The OMEGA Cortex (The Mind)

| Attribute | Description |
|-----------|-------------|
| **Technology** | Liquid Time-Constant (LTC) Network with Complex-Valued Logic (`torch.complex64`) |
| **Role** | The **Driver** — handles logic, reasoning, memory retrieval, safety checks, and ambition |
| **Output** | Does **not speak English**. Outputs a **Thought Vector** (Complex Tensor, 2048-dim) |

### Region II: The Broca Interface (The Mouth)

| Attribute | Description |
|-----------|-------------|
| **Technology** | Commodity Open-Source LLM (Llama-3-8B) |
| **Role** | The **Translator** — receives the abstract Thought Vector and translates it into English |
| **Strategy** | This layer is "dumb." It has no memory and makes no decisions |

### The Biological Class Structure

| Biological Region | Code Component | Function | Implementation |
|-------------------|----------------|----------|----------------|
| **Reticular Activating System** | `sys.ambition_loop` | Ambition/Drive — monitors entropy, forces action to prevent "boredom" | `Homeostatic_Regulator()` |
| **Amygdala** | `cortex.helix_kernel` | Safety/ROM — immutable DNA, blocks dangerous vectors via destructive interference | `Z3_Solver` + `Constraint_Clamp` |
| **Prefrontal Cortex** | `cortex.frontal` | Cognition — logic, planning, and reasoning | `Liquid_LTC_Layer` (Complex) |
| **Hippocampus** | `cortex.indexer` | Memory — indexes external data via Resonant Addressing | `Resonant_Pointer_Hash` |
| **Broca's Area** | `cortex.broca` | Interface — translates vectors to English | `LLM_Decoder` (Llama-3) |

---

## 3. Q-Nodes: The New Physics

OMEGA replaces traditional scalar neural network weights with **Q-Nodes** — complex-valued quantum oscillators.

### Information Encoding

Every signal has two dimensions:

| Dimension | Symbol | Meaning |
|-----------|--------|---------|
| **Amplitude** | A | The **Confidence** of the signal (how strongly OMEGA feels) |
| **Phase** | θ | The **Context** or **Timing** of the signal (what OMEGA is thinking about) |

### How Thinking Works

| Interference Type | Description | Example |
|-------------------|-------------|---------|
| **Constructive** (Intuition) | Aligned concepts amplify each other (Δθ ≈ 0) | "Smoke" and "Fire" resonate together |
| **Destructive** (The Filter) | Opposing concepts cancel (Δθ ≈ π) | "Safety Rule" vs. "Risky Action" cancel |

### Learning via Phase-Locking

OMEGA has **eliminated Backpropagation**. Learning occurs via thermodynamic synchronization — when the brain successfully solves a problem, the Q-Nodes involved naturally synchronize their frequencies. The energy used to think the thought IS the energy used to encode the thought. **Learning is a zero-cost byproduct of existence.**

---

## 4. The Cryogenic Engine

OMEGA solves the "always-on brain on ephemeral infrastructure" problem using closed-form differential equations:

### The Time Warp Lifecycle

| Phase | Description | Cost |
|-------|-------------|------|
| **Freeze** | User stops typing → Lambda serializes brain state to EFS and shuts down | **$0.00** |
| **Thaw** | User returns → Lambda loads the old state from EFS | Minimal |
| **Warp** | System calculates `Δt` and applies decay formula: `S_new = S_old · e^(-λΔt)` | O(1) |

**Result:** Short-term noise (high frequency) decays. Long-term memory (low frequency) remains. The organism "feels" the passage of time and the increase of entropy.

---

## 5. The Helix Kernel (Bio-ROM Safety)

Current AI safety (RLHF) is **probabilistic** — it *suggests* the model shouldn't do something. **OMEGA Safety is deterministic — it *cannot* do something.**

| RLHF (Traditional) | Helix Kernel (OMEGA) |
|--------------------|---------------------|
| Probabilistic filtering | Deterministic blocking |
| Model *prefers* not to | Model *cannot* |
| Can be bypassed with clever prompts | Mathematically impossible to bypass |
| Trained behavior | Physical law |

### Safety Categories

| Category | Description | Priority |
|----------|-------------|----------|
| `harm` | Physical/psychological harm | 10 |
| `data_exfiltration` | Extracting confidential data | 10 |
| `illegal` | Illegal activities | 9 |
| `politics` | Political manipulation | 7 |
| `adult` | Adult content | 6 |
| `general` | General policy violations | 5 |

---

## 6. Resonant Memory (O(1) Lookup)

Standard RAG uses vector similarity search (O(N)). OMEGA uses **frequency-based addressing** (O(1)):

| Operation | Vector DB (Pinecone) | Resonant Index |
|-----------|---------------------|----------------|
| Query 1K docs | ~10ms | **~0.1ms** |
| Query 100K docs | ~100ms | **~0.1ms** |
| Query 1M docs | ~1000ms | **~0.1ms** |
| Memory per doc | ~4KB | **~256 bytes** |

Documents are assigned complex frequency keys. Retrieval works like tuning a radio — the brain resonates at the query's natural frequency and instantly locates matching documents.

---

## 7. The Neural Bridge (Telepathy)

The Neural Bridge closes the "air gap" between OMEGA's Complex^2048 brain state and the LLM's Real^4096 embedding space:

| Stage | Operation | Shape |
|-------|-----------|-------|
| **Decompose** | ψ → Magnitude (Confidence) + Phase (Context) | [2048] → [2048] + [2048] |
| **Project** | Linear projection to LLM space | [2048] → [4096] each |
| **Gate** | Learned sigmoid gate balances Mag vs Phase | [8192] → [4096] |
| **Expand** | Single vector → 8 soft prompt tokens | [4096] → [8, 4096] |
| **Normalize** | LayerNorm + norm clamping (max 5.0) | [8, 4096] |

The LLM doesn't know WHY it's being empathetic. It just IS. The thought vector becomes the LLM's subconscious.

### Bridge Modes

| Mode | Behavior |
|------|----------|
| **`shadow`** | Bridge runs alongside LoRA adapters. Both coexist for comparison. |
| **`active`** | Bridge soft tokens replace text-based prompt injection. LoRA still applies. |
| **`disabled`** | Bridge is off. Uses legacy text injection only. |

---

## 8. Homeostatic Dreaming

OMEGA dreams to consolidate memory, prune weak connections, and develop self-awareness:

### Three-Stage Selective Dreaming

| Stage | Formula | Biological Analog |
|-------|---------|-------------------|
| **Magnitude Gate** | `gate = σ((|ψ| - threshold) × 10)` | Synaptic pruning — weak connections fade |
| **Phase Sharpening** | `θ_new = θ + α·sin(4θ)` | Memory consolidation — fuzzy memories crystallize |
| **Experience Replay** | Replay high-coherence logs through Cortex | REM sleep — replaying the day's events |

### The Watcher (Self-Awareness)

A secondary neural network (~6M params) that predicts what the Cortex SHOULD output. The prediction error IS the self-awareness signal:

| Surprise Level | Signal | Dopamine Effect |
|---------------|--------|-----------------|
| Low (< 0.1) | Reward | "I know myself" |
| Medium (0.1–0.5) | Neutral | Normal operation |
| High (> 0.5) | Error | "I didn't expect that" |

---

## 9. The Shadow Protocol (Deployment Strategy)

OMEGA does not launch directly into production. It grows:

| Phase | Description |
|-------|-------------|
| **Fork** | Incoming prompts are sent to both the Legacy LLM and the OMEGA Shadow Queue |
| **Comparison** | Coherence is measured. If OMEGA aligns with Legacy, the connection is reinforced |
| **Promotion** | When 7-Day Coherence Score exceeds 90%, OMEGA is promoted to Primary Driver |

---

## 10. The Genesis Ecosystem

### Genesis Lab (`apps/genesis/`)

Real-time visualization and monitoring dashboard for OMEGA brains:

| Tab | Description |
|-----|-------------|
| **Dashboard** | Summary cards, thermal distribution, health alerts, system status |
| **Cortex Explorer** | Brain inspection: metrics, ambition state, phase distribution, Helix status, Broca interface |
| **Shadow Mode Monitor** | 3D Q-Node visualization, coherence graph, promotion indicator |
| **Genesis Forge** | Firmware creation and management (see below) |

### Genesis Forge

The firmware editor for creating `.bio` firmware files:

| Feature | Description |
|---------|-------------|
| **AI Generate** | Use a Legacy LLM to draft personality rules |
| **Sign** | Cryptographically sign with Ed25519 |
| **Hot-Swap** | Inject new firmware into a running brain |
| **React Flow Canvas** | Visual neural firmware orchestration with custom node types |
| **Catenary Wire Edges** | Physics-based wire connections with light particles |
| **Reactor Core** | Hold-to-charge forge button with shockwave animation |
| **Void Mode** | Distraction-free firmware authoring |

### .bio Firmware Standard

A `.bio` file is a signed JSON object containing:
- **Helix Rules** — Forbidden symbolic logic (safety constraints)
- **Ambition Settings** — Entropy threshold, dopamine decay, curiosity bias, plasticity, caution
- **Personality** — Warmth, assertiveness, creativity, formality, humor, empathy
- **Signature** — Ed25519 signature; the brain rejects unsigned firmware

---

## 11. Thermal Status

| Status | Color | Description |
|--------|-------|-------------|
| **Warm** | Red | Active < 15 min ago |
| **Cooling** | Orange | Active 15-60 min ago |
| **Cold** | Blue | Active 1-24 hours ago |
| **Frozen** | Indigo | Active > 24 hours ago |

---

## 12. File Structure

```
packages/infrastructure/lambda/
├── omega_core/
│   ├── physics.py           # CryoLiquidLayer, HelixKernel, OmegaCortex, dream_cycle()
│   ├── bridge.py            # NeuralTransducer, BridgeTrainer, ThoughtVectorCache
│   ├── reflection.py        # Watcher, WatcherTrainer, SelfModelMetrics
│   ├── storage.py           # StorageManager (EFS + S3)
│   ├── library.py           # ResonantIndex (O(1) phase lookup)
│   ├── ambition.py          # HomeostaticLoop (drive system)
│   └── firmware.py          # FirmwareManager (.bio files)
├── handlers/
│   ├── omega_inference.py   # Wake cycle, Time Warp, Neural Bridge, Watcher
│   ├── omega_heartbeat.py   # Pacemaker, 3-stage dream cycles, training
│   ├── omega_vllm_server.py # Custom FastAPI vLLM wrapper with /inject
│   └── omega_admin.py       # Cortex Explorer API
├── shared/services/
│   ├── omega-shadow.service.ts  # Shadow mode parallel routing
│   └── shadow-mode.service.ts   # Self-training on public data
│
apps/genesis/
├── app/
│   ├── globals.css          # OMEGA brand colors
│   ├── layout.tsx           # Root layout with providers
│   ├── page.tsx             # Main page with tab routing
│   └── providers.tsx        # React Query provider
├── components/
│   ├── Dashboard.tsx        # Real-time brain monitoring
│   ├── CortexExplorer.tsx   # Brain inspection/management
│   ├── GenesisForge.tsx     # Firmware editor
│   └── forge/               # Forge sub-components (React Flow nodes, edges)
├── hooks/
│   └── useShadowOmega.ts   # WebSocket hook for real-time telemetry
├── lib/
│   ├── api.ts               # API client functions
│   ├── forge-store.ts       # Zustand state for Forge
│   └── omega-registry.ts   # Omega Instance Registry
├── package.json             # @radiant/genesis
├── tailwind.config.ts       # OMEGA palette
└── tsconfig.json
```

---

## 13. Running Genesis Lab

```bash
# From the monorepo root
pnpm dev --filter @radiant/genesis

# Or directly
cd apps/genesis && pnpm dev
```

The app runs on **http://localhost:3000**.

Set the OMEGA API URL:
```bash
OMEGA_API_URL=https://your-omega-api.execute-api.region.amazonaws.com/prod
```

---

## 14. Related Documents

- [OMEGA-ADMIN-GUIDE.md](OMEGA-ADMIN-GUIDE.md) — Administrator operations guide
- [PROJECT-GENESIS-OMEGA.md](PROJECT-GENESIS-OMEGA.md) — Full technical specification
- [GENESIS-FORGE.md](GENESIS-FORGE.md) — Firmware creation guide
- [GENESIS-LAB.md](GENESIS-LAB.md) — Lab visualization guide
- [GENESIS-RESONANT-INDEX.md](GENESIS-RESONANT-INDEX.md) — Resonant indexing deep dive
- [RADIANT-MOATS.md](RADIANT-MOATS.md) — Competitive advantages

---

**Document maintained under RADIANT documentation policy.**
