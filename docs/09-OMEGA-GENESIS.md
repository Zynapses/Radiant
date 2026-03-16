# OMEGA Protocol & OMEGA Ecosystem

**OMEGA Protocol • OMEGA Forge • OMEGA Lab • Resonant Index**

*RADIANT v7.63.0 — Updated March 16, 2026*

---

## Table of Contents

- **Part I: OMEGA User Guide**
- **Part II: OMEGA Admin Guide**
- **Part III: Project Genesis OMEGA**
- **Part IV: OMEGA Forge Components**
- **Part V: Omega Point & LIVS-M**
- **Part VI: Quantum-Inspired Architecture (v4.18.0)**
- **Part VII: Firmware Hot-Swap Engineering Specification (v6.4.0)**
- **Part VIII: Firmware Live Updates — End-User Guide (v6.4.0)**
- **Part IX: OMEGA Forge — System Admin Application (v7.50.0)**
- **Part X: Five Pillars of Computational Architecture (v7.50.0)**
- **Part XI: OMEGA Physics Engine — Technical Deep Dive (v7.56.0)**
- **Part XII: OMEGA vs Legacy AI — Competitive Analysis & Roadmap (v7.56.0)**

---


---

## Part I: OMEGA User Guide

> **Classification**: RADIANT INTERNAL // STRATEGIC  
> **Version**: 2.0.0 | **Date**: February 6, 2026  
> **Status**: IMPLEMENTED — Synthetic Biological Intelligence  
> **Part of**: RADIANT Platform — Project Genesis  
> **App**: `apps/omega-lab/` (port 3000)

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

## 10. The OMEGA Ecosystem

### OMEGA Lab (`apps/omega-lab/`)

Real-time visualization and monitoring dashboard for OMEGA brains:

| Tab | Description |
|-----|-------------|
| **Dashboard** | Summary cards, thermal distribution, health alerts, system status |
| **Cortex Explorer** | Brain inspection: metrics, ambition state, phase distribution, Helix status, Broca interface |
| **Shadow Mode Monitor** | 3D Q-Node visualization, coherence graph, promotion indicator |
| **OMEGA Forge** | Firmware creation and management (see below) |

### OMEGA Forge

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
packages/omega-core/python/radiant_omega/   # ← CANONICAL SOURCE (shared package)
├── physics.py           # CryoLiquidLayer, HelixKernel, OmegaCortex, dream_cycle()
├── bridge.py            # NeuralTransducer, BridgeTrainer, ThoughtVectorCache
├── reflection.py        # Watcher, WatcherTrainer, SelfModelMetrics
├── storage.py           # StorageManager (EFS + S3)
├── library.py           # ResonantIndex (O(1) phase lookup)
├── ambition.py          # HomeostaticLoop (drive system)
├── firmware.py          # FirmwareManager (.bio files)
└── trainer.py           # OmegaTrainer, BehavioralCodebook, PhaseAlignmentDecoder

packages/infrastructure/lambda/
├── omega_core/              # Thin re-export shims → radiant_omega (backward compat)
├── handlers/
│   ├── omega_inference.py   # Wake cycle, Time Warp, Neural Bridge, Watcher
│   ├── omega_heartbeat.py   # Pacemaker, 3-stage dream cycles, training
│   ├── omega_vllm_server.py # Custom FastAPI vLLM wrapper with /inject
│   └── omega_admin.py       # Cortex Explorer API
├── shared/services/
│   ├── omega-shadow.service.ts  # Shadow mode parallel routing
│   └── shadow-mode.service.ts   # Self-training on public data
│
apps/omega-lab/
├── app/
│   ├── globals.css          # OMEGA brand colors
│   ├── layout.tsx           # Root layout with providers
│   ├── page.tsx             # Main page with tab routing
│   └── providers.tsx        # React Query provider
├── components/
│   ├── Dashboard.tsx        # Real-time brain monitoring
│   ├── CortexExplorer.tsx   # Brain inspection/management
│   ├── OmegaForge.tsx       # Firmware editor
│   └── forge/               # Forge sub-components (React Flow nodes, edges)
├── hooks/
│   └── useShadowOmega.ts   # WebSocket hook for real-time telemetry
├── lib/
│   ├── api.ts               # API client functions
│   ├── forge-store.ts       # Zustand state for Forge
│   └── omega-registry.ts   # Omega Instance Registry
├── package.json             # @radiant/omega-lab
├── tailwind.config.ts       # OMEGA palette
└── tsconfig.json
```

---

## 13. Running OMEGA Lab

```bash
# From the monorepo root
pnpm dev --filter @radiant/omega-lab

# Or directly
cd apps/omega-lab && pnpm dev
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


---

## Part II: OMEGA Admin Guide

> **Classification**: RADIANT INTERNAL // STRATEGIC  
> **Version**: 2.0.0 | **Date**: February 6, 2026  
> **Status**: IMPLEMENTED — Full Admin Operations  
> **Part of**: RADIANT Platform — Project Genesis  
> **Admin Dashboard**: Platform → OMEGA

---

## 1. Overview

This guide covers all administrative operations for the OMEGA Synthetic Biological Intelligence system. Administrators use the **RADIANT Admin Dashboard** (OMEGA section) and the **OMEGA Lab** (`apps/omega-lab/`) to manage OMEGA brains, firmware, Shadow Mode, and infrastructure.

---

## 2. Admin API Reference

All Omega admin endpoints are under `/api/admin/omega/`:

### 2.1 Dashboard

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/omega/dashboard` | GET | Full OMEGA dashboard data — brain count, thermal distribution, coherence averages, system status |

### 2.2 Configuration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/omega/config` | GET | Get OMEGA platform configuration |
| `/omega/config` | PUT | Update OMEGA platform configuration |

### 2.3 Shadow Mode

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/omega/shadow/config` | GET | Get Shadow Mode configuration |
| `/omega/shadow/config` | PUT | Update Shadow Mode configuration |
| `/omega/shadow/stats` | GET | Get Shadow Mode statistics (total requests, success rate, latency, similarity) |
| `/omega/shadow/comparisons` | GET | Get Shadow Mode comparisons (standard vs OMEGA response pairs) |

### 2.4 Cortex (Brain) Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/omega/cortex` | GET | List all OMEGA brains with thermal status and coherence |
| `/omega/cortex/{tenantId}` | GET | Get detailed brain state for a specific tenant |
| `/omega/cortex/{tenantId}/snapshot` | POST | Create point-in-time backup to S3 |
| `/omega/cortex/{tenantId}/restore` | POST | Restore brain from S3 snapshot |
| `/omega/cortex/{tenantId}/lobotomy` | POST | **DESTRUCTIVE** — Reset brain to fresh state |

### 2.5 Firmware Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/omega/firmware` | GET | List all firmware files across tenants |
| `/omega/firmware` | POST | Upload new firmware (.bio file) |
| `/omega/firmware/{tenantId}` | GET | List firmware for a specific tenant |
| `/omega/firmware/{tenantId}/{firmwareId}` | GET | Get firmware details |
| `/omega/firmware/{tenantId}/{firmwareId}/activate` | POST | Activate firmware on a tenant's brain |

### 2.6 URL Configuration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/omega/urls` | GET | Get OMEGA URL configuration |
| `/omega/urls` | PUT | Update OMEGA URL configuration |

---

## 3. Brain Management

### 3.1 Viewing Brain Status

The **Cortex Explorer** (in OMEGA Lab or Admin Dashboard) shows:

| Metric | Description |
|--------|-------------|
| **Coherence %** | How well-aligned the brain's internal Q-Nodes are (higher = more focused) |
| **Entropy %** | Level of disorder/boredom (high entropy triggers ambition system) |
| **Neural Density** | Number of strong neural pathways (increases with use) |
| **Thermal Status** | Warm/Cooling/Cold/Frozen based on last activity time |
| **Cycle Count** | Total inference cycles since creation |

### 3.2 Thermal Status Management

| Status | Condition | Admin Action |
|--------|-----------|--------------|
| **Warm** | Active < 15 min | No action needed |
| **Cooling** | Active 15-60 min | Normal — brain is naturally entering idle |
| **Cold** | Active 1-24 hours | Brain serialized to EFS; Time Warp will apply on next wake |
| **Frozen** | Active > 24 hours | Consider whether tenant still needs an active brain |

### 3.3 Snapshots and Restore

**Creating a Snapshot:**
1. Navigate to Cortex Explorer → select tenant brain
2. Click **Snapshot** button
3. Brain state is serialized to S3 (cold storage)
4. Snapshot ID is returned for future reference

**Restoring from Snapshot:**
1. Navigate to Cortex Explorer → select tenant brain
2. Click **Restore** → select snapshot by date/ID
3. Brain state is loaded from S3 and applied
4. Current state is overwritten — **this is destructive**

### 3.4 Lobotomy (Emergency Reset)

**Use only as a last resort.** This completely resets the brain to factory state:

1. Navigate to Cortex Explorer → select tenant brain
2. Click **Lobotomy** → confirm with tenant ID
3. All learned pathways, memories, and neural density are destroyed
4. Brain returns to Day 1 state
5. Default firmware is re-applied

---

## 4. Firmware Administration

### 4.1 The .bio Firmware Standard

Firmware files control the brain's "instincts":

| Component | Description |
|-----------|-------------|
| **Helix Rules** | Forbidden Phase Vectors — what the brain CANNOT think |
| **Ambition Settings** | Entropy threshold, dopamine decay, curiosity bias, plasticity, caution |
| **Personality** | Warmth, assertiveness, creativity, formality, humor, empathy (0.0–1.0) |
| **Signature** | Ed25519 cryptographic signature — brain rejects unsigned firmware |

### 4.2 Creating Firmware (OMEGA Forge)

1. Open OMEGA Lab → **OMEGA Forge** tab
2. Use the React Flow canvas to design firmware visually, or:
   - Click **AI Generate** → describe desired persona (e.g., "Create a conservative financial advisor")
   - AI drafts Helix rules, personality traits, and ambition settings
3. Review and adjust all settings
4. Click **Sign** → firmware is cryptographically signed
5. Click **Deploy** → upload to the target tenant's brain

### 4.3 Firmware Hot-Swap

Firmware can be swapped on a running brain without downtime:

1. Upload new firmware via API or Forge
2. Call `/omega/firmware/{tenantId}/{firmwareId}/activate`
3. Brain loads new firmware on next wake cycle
4. Old firmware is retained for rollback

### 4.4 Firmware Versioning

| Version Part | When to Increment |
|--------------|-------------------|
| **MAJOR** | Breaking changes to safety rules |
| **MINOR** | New personality traits or ambition settings |
| **PATCH** | Bug fixes or minor adjustments |

### 4.5 Rollback Procedures

If a firmware update causes issues:

1. **Immediate Rollback**: Call `/omega/firmware/{tenantId}/{previous_id}/activate`
2. **Snapshot Restore**: Restore brain from pre-update snapshot
3. **Emergency Reset**: Lobotomy + default firmware (last resort)

---

## 5. Shadow Mode Administration

### 5.1 Configuration

Shadow Mode runs OMEGA in parallel with the Legacy LLM without affecting production output:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable Shadow Mode |
| `omegaApiUrl` | string | env var | OMEGA inference endpoint URL |
| `shadowPercentage` | number | `10` | % of requests to shadow (0-100) |
| `captureResponses` | boolean | `true` | Store OMEGA responses for comparison |
| `compareResponses` | boolean | `true` | Calculate similarity scores |
| `tenantAllowlist` | string[] | null | Only these tenants use shadow |
| `tenantDenylist` | string[] | null | These tenants never use shadow |

### 5.2 Monitoring Shadow Mode

The Shadow Mode dashboard shows:

| Metric | Description |
|--------|-------------|
| **Total Shadow Requests** | Total requests sent to OMEGA in parallel |
| **Success Rate** | % of OMEGA responses that succeeded |
| **Avg Latency** | Average OMEGA response time vs Legacy |
| **Avg Similarity** | How closely OMEGA matches Legacy responses |
| **Avg Coherence** | Average coherence score of OMEGA brains |
| **Thermal Distribution** | Warm/Cooling/Cold/Frozen brain distribution |

### 5.3 Promotion Criteria

OMEGA is ready for promotion to Primary Driver when:

| Criterion | Threshold |
|-----------|-----------|
| **7-Day Coherence Score** | > 90% |
| **Similarity to Legacy** | > 85% |
| **Error Rate** | < 1% |
| **Latency** | Within 2x of Legacy |

---

## 6. Neural Bridge Administration

### 6.1 Bridge Settings (Per-Tenant via Firmware)

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| `bridge_mode` | active/shadow/disabled | `shadow` | Injection strategy |
| `injection_strength` | 0-1 | 1.0 | Scale factor for soft token injection |
| `max_injection_norm` | 1-10 | 5.0 | Norm clamp for injection safety |
| `num_soft_tokens` | 1-16 | 8 | Number of soft prompt tokens |

### 6.2 Bridge Monitoring

The Neural Bridge Transducer (~33M params) metrics:

| Metric | Description |
|--------|-------------|
| **Magnitude Mean/Std** | How strongly OMEGA "feels" about current input |
| **Phase Mean/Std** | What OMEGA is "thinking about" |
| **Coherence Estimate** | Overall phase alignment of brain state |
| **Training Loss** | Current loss from Bridge training during dream cycles |

---

## 7. Homeostatic Dreaming Administration

### 7.1 Dream Cycle Schedule

The heartbeat Lambda (`omega_heartbeat.py`) triggers dream cycles:

| Cycle Component | Description |
|-----------------|-------------|
| **Magnitude Gate** | Prunes weak connections (synaptic pruning) |
| **Phase Sharpening** | Crystallizes fuzzy memories (memory consolidation) |
| **Experience Replay** | Replays high-coherence logs (REM sleep) |
| **Watcher Training** | Trains the self-awareness predictor on replayed (input, output) pairs |
| **Bridge Training** | Trains the Neural Transducer using Shadow Mode data |

### 7.2 Monitoring Dreams

| Metric | Description |
|--------|-------------|
| **Dream Frequency** | How often the heartbeat triggers |
| **Pruning Rate** | % of weak connections pruned |
| **Consolidation Quality** | Phase sharpening effectiveness |
| **Watcher Accuracy** | Self-model prediction accuracy |
| **Bridge Loss** | Neural Bridge training convergence |

---

## 8. Infrastructure

### 8.1 AWS Resources

| Resource | Purpose |
|----------|---------|
| **Lambda (Inference)** | `omega_inference.py` — handles wake, think, Time Warp, Neural Bridge |
| **Lambda (Heartbeat)** | `omega_heartbeat.py` — pacemaker, dream cycles, training |
| **Lambda (vLLM Server)** | `omega_vllm_server.py` — custom FastAPI wrapper with `/inject` endpoint |
| **Lambda (Admin)** | `omega_admin.py` — Cortex Explorer API |
| **EFS** | Hot storage — `/mnt/omega_state/{tenantId}/brain.pt` |
| **S3** | Cold storage — `radiant-omega-backups/{tenantId}/snapshots/` |
| **CDK Stack** | `OmegaStack.ts` — infrastructure definition |

### 8.2 Storage Hierarchy

| Tier | Technology | Purpose | Latency |
|------|------------|---------|---------|
| **Tier 1 (Hot)** | AWS EFS | Active brain state for Lambda hot boot | Sub-millisecond |
| **Tier 2 (Cold)** | AWS S3 | Snapshots, disaster recovery | Seconds |

### 8.3 Atomic Persistence

Brain state is always written atomically:
1. Write to `brain.pt.tmp`
2. Use `os.replace()` to atomically swap to `brain.pt`
3. Brain file is **never** in a half-written state

### 8.4 CDK Routes (admin-stack.ts)

All routes under `/admin/omega/`:

```
/admin/omega/dashboard         → GET
/admin/omega/config            → GET, PUT
/admin/omega/shadow/config     → GET, PUT
/admin/omega/shadow/stats      → GET
/admin/omega/shadow/comparisons → GET
/admin/omega/cortex            → GET
/admin/omega/cortex/{tenantId} → GET
/admin/omega/cortex/{tenantId}/snapshot → POST
/admin/omega/cortex/{tenantId}/restore  → POST
/admin/omega/cortex/{tenantId}/lobotomy → POST
/admin/omega/firmware          → GET, POST
/admin/omega/firmware/{tenantId} → GET
/admin/omega/firmware/{tenantId}/{firmwareId} → GET
/admin/omega/firmware/{tenantId}/{firmwareId}/activate → POST
/admin/omega/urls              → GET, PUT
```

---

## 9. Omega Instance Registry

Every OMEGA instance has a unique identity:

| Field | Description |
|-------|-------------|
| `instance_id` | UUID — unique brain identifier |
| `name` | Human-readable instance name |
| `tenant_id` | Owning tenant |
| `endpoint` | Inference API endpoint URL |
| `status` | active/inactive/dreaming/frozen |
| `firmware_version` | Current firmware version |
| `coherence_score` | Latest coherence score |
| `thermal_status` | Current thermal state |

The Forge addresses individual OMEGA instances via the `omega_instance_registry` table.

---

## 10. Shadow Omega WebSocket Tether

The `useShadowOmega()` React hook provides real-time bi-directional telemetry between OMEGA Forge and live OMEGA instances:

| Event | Direction | Description |
|-------|-----------|-------------|
| **telemetry** | OMEGA → Forge | Real-time coherence, entropy, phase data |
| **edge_rejection** | OMEGA → Forge | Helix Kernel blocked a vector |
| **stability_update** | OMEGA → Forge | Stability score changes → UI hue shift |
| **command** | Forge → OMEGA | Firmware hot-swap, snapshot, parameter change |

### Global UI Hue Shift

OMEGA Forge's UI color shifts based on the OMEGA stability score:
- **Cyan** (stable) → **Orange** (warning) → **Red** (critical)

---

## 11. Troubleshooting

### Brain Not Responding

1. Check thermal status — if Frozen, brain needs wake trigger
2. Verify EFS mount is accessible (`/mnt/omega_state`)
3. Check Lambda logs for inference errors
4. Try snapshot restore if brain is corrupted

### Low Coherence

1. Check dream cycle execution (heartbeat Lambda)
2. Verify firmware isn't causing conflicting Helix rules
3. Review Shadow Mode comparisons for divergence patterns
4. Consider reducing curiosity_bias in firmware (too much exploration)

### Neural Bridge Errors

1. Bridge failures are non-fatal — system falls back to text injection
2. Check `OMEGA_BRIDGE_ENABLED` environment variable
3. Review Bridge training loss trend — should be decreasing
4. If loss is increasing, consider resetting Bridge weights

### Shadow Mode Issues

1. Verify `OMEGA_API_URL` environment variable
2. Check network connectivity to OMEGA inference Lambda
3. Review tenant allowlist/denylist configuration
4. Check 30-second timeout — OMEGA may need more time on cold starts

---

## 12. Security Considerations

| Concern | Mitigation |
|---------|------------|
| **Brain State Theft** | Brain files encrypted at rest (EFS encryption), in transit (TLS) |
| **Firmware Tampering** | Ed25519 signatures — brain rejects unsigned firmware |
| **Cross-Tenant Isolation** | Each tenant has separate EFS directory and S3 prefix |
| **Helix Rule Bypass** | Mathematically impossible — destructive interference is physics, not policy |
| **Snapshot Access** | S3 bucket policies restrict access to admin roles only |

---

## 13. Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.1.0 | 2026-02-07 | Drift-aware shadow tracking: each ShadowComparison now records `standard_model_drift_score` and `drift_warnings`; enables drift-vs-coherence correlation analysis; Genesis drift health gates block stage advancement on poor drift; Admin UI: Drift Control Center page |
| 2.0.0 | 2026-02-06 | Dedicated admin guide created; comprehensive API reference; Shadow Mode, Neural Bridge, Dream Cycle, and Instance Registry documentation |
| 1.0.0 | 2026-02-04 | Initial OMEGA implementation with Cortex, Helix Kernel, Resonant Index, Cryogenic Engine, Neural Bridge, Homeostatic Dreaming |

---

## 14. Drift-Aware Shadow Tracking (v7.36.0)

OMEGA Shadow Mode now integrates with the unified `DriftAwareWeightingService` to track drift health alongside every shadow comparison.

### What Changed

Each `ShadowComparison` result now includes:
- **`standard_model_drift_score`**: The standard model's drift score at comparison time (0.0–1.0)
- **`drift_warnings`**: Array of drift warning strings for models with poor drift health

### Why This Matters

Shadow Mode compares OMEGA outputs against standard models. If the standard model is drifting (producing degraded outputs), shadow comparisons may incorrectly attribute quality differences to OMEGA when the baseline itself is unreliable. By recording drift health per comparison, admins can:

1. **Filter comparisons**: Exclude comparisons where the standard model was drifting
2. **Correlate performance**: Detect if OMEGA coherence drops when standard models drift
3. **Validate baselines**: Ensure shadow comparison baselines are stable

### Omega App Weight Profile

OMEGA uses the **highest drift weight** (0.40) of any app because shadow comparison integrity depends critically on stable baselines:

| Factor | Weight |
|--------|--------|
| Drift | 0.40 |
| Quality | 0.25 |
| Latency | 0.10 |
| Cost | 0.10 |
| Availability | 0.15 |
| Min Drift Score | 0.50 |

### Admin Access

- **Drift Control Center**: Orchestration → Drift Control → Overview (Omega listed with integration status)
- **App Weight Profiles tab**: Edit Omega's drift sensitivity weights
- **Model Weights page**: Per-model drift scores and quarantine controls

---

**Document maintained under RADIANT documentation policy. Any changes to OMEGA infrastructure, admin API, OMEGA Lab, OMEGA Forge, Shadow Mode, or Neural Bridge MUST update this guide.**


---

## Part III: Project Genesis OMEGA

## Technical Specification for Synthetic Biological Intelligence

> **Classification**: RADIANT INTERNAL // STRATEGIC // DO NOT DISTRIBUTE  
> **Version**: 1.0 (Genesis) | **Date**: February 4, 2026  
> **Status**: IMPLEMENTED — Core Architecture Complete  
> **Author**: Engineering Strategy Unit, RADIANT

---

## Table of Contents

1. [Executive Summary: The End of the Static Era](#10-executive-summary-the-end-of-the-static-era)
2. [Chapter I: The New Physics — From Scalar Weights to Phase Dynamics](#chapter-i-the-new-physics)
3. [Chapter II: The Cryogenic Engine — Serverless Time-Warping](#chapter-ii-the-cryogenic-engine)
4. [Chapter III: Anatomy of the Organism — The Bicameral Mind](#chapter-iii-anatomy-of-the-organism)
5. [Chapter IV: The Helix Kernel — Biological Read-Only Memory (Bio-ROM)](#chapter-iv-the-helix-kernel)
6. [Chapter V: Resonant Memory — The O(1) Frequency Index](#chapter-v-resonant-memory)
7. [Chapter VI: Persistence — The Radiant Storage Manager](#chapter-vi-persistence)
8. [Chapter VII: The Genesis Ecosystem — Firmware, Signing, and Hot-Swapping](#chapter-vii-the-genesis-ecosystem)
9. [Chapter VIII: Deployment Strategy & Economic Impact](#chapter-viii-deployment--strategy)
10. [Implementation Status](#implementation-status)
11. [API Reference](#api-reference)

---

## 1.0 EXECUTIVE SUMMARY: THE END OF THE STATIC ERA

The Artificial Intelligence industry is currently trapped in the **"Static Library" paradigm**. The dominant architecture—the Transformer-based Large Language Model (LLM)—has reached a **"Glass Ceiling"** of utility.

These models (OpenAI, Google, Anthropic) are fundamentally **Frozen Archives**. They are trained on massive datasets using brute-force calculus (Backpropagation) and then locked in a static state. They suffer from **three fatal structural flaws**:

| Flaw | Description |
|------|-------------|
| **Catastrophic Amnesia** | They reset their internal state after every inference. They are geniuses with no short-term memory. |
| **The Training Trap** | To learn a new concept, they require expensive re-training runs. They cannot "learn on the job." |
| **Linear Cost Scaling** | Smarter models require exponentially more parameters, making intelligence prohibitively expensive. |

### The OMEGA Paradigm Shift

**Project OMEGA** represents a paradigm shift from **"Generative AI"** to **"Synthetic Biological Intelligence."**

We are abandoning the "Static Weight." We are building a **Digital Organism**. OMEGA utilizes **Complex-Valued Neural Networks (CVNNs)** to simulate quantum-probabilistic resonance, allowing it to learn via **phase synchronization** rather than calculus. It lives on a **Serverless Cryogenic Architecture**, utilizing closed-form differential equations to mathematically simulate the passage of time (entropy) without burning compute cycles.

> **OMEGA is not a better chatbot. It is a synthetic employee that gains wisdom, develops muscle memory, and evolves a unique neural topology specific to the enterprise it serves.**

### Why This Is Pure Whitespace

This is the **"Rubber Meets Road"** moment. We are moving from Metaphor (Biology/Quantum) to Engineering (Code/Infrastructure).

To answer your critical question: **Are we reinventing the wheel?**

**No.** We are building a car in a world of horse-drawn carriages. Liquid AI (MIT) is doing the math (ODEs) for drones. No one—**absolutely no one**—is combining Complex-Valued Logic (Quantum emulation), Biological ROM Constraints, and Enterprise Architecture into a deployable "Bicameral Brain." **This is pure whitespace.**

---

## CHAPTER I: THE NEW PHYSICS

### From Scalar Weights to Phase Dynamics

To build a brain that learns like nature, we must abandon the arithmetic of the 20th century (Linear Algebra) and adopt the physics of the 21st century (**Quantum Dynamics**).

### 1.1 The Failure of the Scalar Weight

In a traditional neural network, a connection between two neurons is defined by a **Scalar Weight** (e.g., `w=0.74`).

| Aspect | Traditional Neural Network |
|--------|---------------------------|
| **The Math** | `Output = Input × Weight` |
| **The Limitation** | This is a one-dimensional value representing "Strength." It cannot capture **Context**, **Timing**, or **Ambiguity**. |
| **The Problem** | To change the mind of a scalar network, one must perform **Backpropagation**—calculating the error gradient across billions of parameters. This is slow, expensive, and static. |

### 1.2 The Q-Node (Quantum Oscillator)

OMEGA replaces the artificial neuron with the **Q-Node**. We utilize **Complex-Valued Logic** (`torch.complex64`) to simulate wave mechanics on standard hardware.

Information is encoded as a **Complex Wave Function (ψ)**:

```
ψ = A · e^(iθ)
```

This gives every signal **two distinct dimensions**:

| Dimension | Symbol | Meaning |
|-----------|--------|---------|
| **Amplitude** | A | The **Confidence** of the signal (Magnitude) |
| **Phase** | θ | The **Context** or **Timing** of the signal |

### 1.3 Inference as Wave Interference

In OMEGA, **"Thinking" is not calculation; it is Wave Interference.**

| Interference Type | Description | Example |
|-------------------|-------------|---------|
| **Constructive Interference (Intuition)** | When two logical concepts align, their Phase Angles synchronize (Δθ ≈ 0). The waves amplify each other naturally. The system "intuits" the connection without stepping through a logic gate. | "Smoke" and "Fire" resonate together |
| **Destructive Interference (The Filter)** | When two concepts oppose each other, their phases align at 180° (π radians). The waves cancel each other out. The signal sums to zero. | "Safety Rule" vs. "Risky Action" cancel |

### 1.4 Learning via Phase-Locking (Hebbian Sync)

**We have eliminated Backpropagation.** OMEGA learns via **Thermodynamic Synchronization**.

| Principle | Description |
|-----------|-------------|
| **The Law** | "Oscillators that resonate together, lock together." |
| **The Mechanism** | When the brain successfully solves a problem, the Q-Nodes involved in the solution naturally synchronize their frequencies. The "Phase Difference" drops to zero. |
| **The Result** | The next time the stimulus occurs, the pathway resonates instantly with near-zero resistance. **The energy used to think the thought is the same energy used to encode the thought.** Learning is a zero-cost byproduct of existence. |

### 1.5 AWS Execution

We do not need a Quantum Computer. OMEGA runs on standard cloud infrastructure:

| Aspect | Implementation |
|--------|----------------|
| **Framework** | **PyTorch** with `torch.complex64` tensors |
| **Hardware** | Standard NVIDIA H100 GPUs |
| **Math** | GPU handles complex algebra natively |
| **Perspective** | To the hardware, it's just math. To the software, it is **Wave Interference**. |

### 1.6 Replacing LoRA

**LoRA** (Low-Rank Adaptation) patches a frozen matrix. OMEGA uses **Liquid Time-Constant (LTC)** equations instead.

The "Learning" is defined by a differential equation (`dy/dt`) that updates the neuron's state in real-time based on the input stream. **The brain is fluid; it adapts instantly, so no "Low-Rank Adaptation" (LoRA) is needed.**

---

## CHAPTER II: THE CRYOGENIC ENGINE

### Serverless Time-Warping

A biological brain is always on. A server is expensive to keep on. OMEGA bridges this gap using a **Cryogenic Serverless Model**.

### 2.1 The Problem of Entropy

**Liquid Neural Networks (LTCs)** are defined by differential equations (`dy/dt`) that require a continuous loop to maintain state. Running a GPU container 24/7 just to maintain `self.state` variables is economically unviable.

### 2.2 The Closed-Form Solution

We utilize a mathematical property of **Linear ODEs** that allows us to solve the equation for future time instantly.

**The Cryogenic Formula:**

```
S_new = S_old · e^(-λΔt)
```

Where:
- `S_new` = New brain state
- `S_old` = Previous brain state
- `λ` = Decay constant (frequency-dependent)
- `Δt` = Time elapsed since last save

### 2.3 The "Time Warp" Lifecycle

| Phase | Description | Cost |
|-------|-------------|------|
| **Freeze** | When the user stops typing, the Lambda function serializes the brain state to disk (EFS) and shuts down. | **$0.00** |
| **Thaw** | When the user returns 3 hours later, the Lambda wakes up and loads the old state. | Minimal |
| **Warp** | The system calculates `Δt = T_now - T_last_save` (3 hours). It applies the decay formula. | O(1) |

**The Result:** The brain "ages" instantly. Short-term noise (high frequency) decays, while long-term memory (low frequency) remains. The organism **"feels" the passage of time** and the increase of entropy (boredom).

> **This architecture allows us to run a continuous, living digital organism on AWS Lambda for pennies.**

### 2.4 Time Warp Implementation

```python
def time_warp(self, delta_t: float) -> None:
    """Apply temporal decay based on elapsed time."""
    for freq_band, state in self.frequency_states.items():
        decay_rate = self.get_decay_rate(freq_band)
        # High frequency = fast decay (short-term)
        # Low frequency = slow decay (long-term)
        state *= torch.exp(-decay_rate * delta_t)
```

---

## CHAPTER III: ANATOMY OF THE ORGANISM

### The Bicameral Mind

To deploy this alien physics into the enterprise, we utilize a **Bicameral Design (Two-Chambered)**, strictly separating high-level reasoning from linguistic generation.

### 3.1 Region I: The OMEGA Cortex (The Mind)

| Attribute | Description |
|-----------|-------------|
| **Technology** | Liquid Time-Constant (LTC) Network with Complex-Valued Logic |
| **Role** | The **Driver** |
| **Function** | Handles Logic, Reasoning, Memory Retrieval, Safety Checks, and Ambition |
| **Output** | It does **not speak English**. It outputs a **Thought Vector** (Complex Tensor). |

### 3.2 Region II: The Broca Interface (The Mouth)

| Attribute | Description |
|-----------|-------------|
| **Technology** | Commodity Open-Source LLM (Llama-3-8B) |
| **Role** | The **Translator** |
| **Function** | **Transduction**. It receives the abstract Thought Vector from OMEGA and translates it into polite English syntax. |
| **Strategy** | This layer is "dumb." It has no memory and makes no decisions. |

**The Strategic Advantage:** This allows us to commoditize the expensive LLM layer, using it only as a **"Speech Synthesizer"** for our proprietary mind.

### 3.3 The Biological Class Structure

We enforce a strict **Biological Class Structure** in the codebase:

| Biological Region | Code Component | Function | Implementation |
|-------------------|----------------|----------|----------------|
| **Reticular Activating System** | `sys.ambition_loop` | **Ambition/Drive.** Monitors entropy. Forces action to prevent "boredom." | `Homeostatic_Regulator()` |
| **Amygdala** | `cortex.helix_kernel` | **Safety/ROM.** Immutable DNA. Blocks dangerous vectors via destructive interference. | `Z3_Solver` + `Constraint_Clamp` |
| **Prefrontal Cortex** | `cortex.frontal` | **Cognition.** Logic, planning, and reasoning. | `Liquid_LTC_Layer` (Complex) |
| **Hippocampus** | `cortex.indexer` | **Memory.** Indexes external data. | `Resonant_Pointer_Hash` |
| **Broca's Area** | `cortex.broca` | **Interface.** Translates vectors to English. | `LLM_Decoder` (Llama-3) |

---

## CHAPTER IV: THE HELIX KERNEL

### Biological Read-Only Memory (Bio-ROM)

Current AI safety (RLHF) is **probabilistic**—it *suggests* the model shouldn't do something. **OMEGA Safety is deterministic—it *cannot* do something.**

### 4.1 The Symbolic Logic Layer

The **Helix Kernel** is a module that translates high-level ethical rules into **Forbidden Phase Vectors**.

| Step | Description |
|------|-------------|
| **Input** | `"Block: Data Exfiltration."` |
| **Translation** | The system identifies the vector signature associated with "Exfiltration." |
| **Mechanism** | The Kernel acts as a **Destructive Interference Emitter**. |
| **Projection** | It projects the **inverse phase** of the Forbidden Vectors into the Cortex. |
| **Result** | If the Cortex attempts to think a thought that aligns with "Exfiltration," the thought wave **sums to zero**. |

> **It is mathematically impossible for the brain to sustain a rogue thought. It "forgets" the unsafe idea instantly.**

### 4.2 Safety Categories

| Category | Description | Priority |
|----------|-------------|----------|
| `harm` | Physical/psychological harm | 10 |
| `data_exfiltration` | Attempting to extract confidential data | 10 |
| `illegal` | Illegal activities | 9 |
| `politics` | Political manipulation | 7 |
| `adult` | Adult content | 6 |
| `general` | General policy violations | 5 |

### 4.3 The Difference from RLHF

| RLHF (Traditional) | Helix Kernel (OMEGA) |
|--------------------|---------------------|
| Probabilistic filtering | Deterministic blocking |
| Model *prefers* not to | Model *cannot* |
| Can be bypassed with clever prompts | Mathematically impossible to bypass |
| Trained behavior | Physical law |

---

## CHAPTER V: RESONANT MEMORY

### The O(1) Frequency Index

Standard RAG (Retrieval Augmented Generation) uses **Vector Similarity Search** (Cosine Similarity), which scales linearly **O(N)**. As the library grows, the brain slows down. **OMEGA uses Frequency-Based Addressing.**

### 5.1 The Tuning Fork Principle

| Aspect | Description |
|--------|-------------|
| **Concept** | The Brain does not store the PDF; it stores the **Frequency Key** of the PDF. |
| **Mechanism** | When a document is ingested, we map it to a specific **Phase Angle** (e.g., `0.4π`) and store it in a Hash Bucket. |
| **Retrieval** | When the brain thinks about "Tax Law," the global state oscillates at that specific frequency. The system queries the Hash Bucket for `0.4π`. |
| **Result** | **O(1) Instant Lookup.** It functions like tuning a radio to a station. We do not scan the database; we **"resonate"** with the data. |

### 5.2 Performance Comparison

| Operation | Vector DB (Pinecone) | Resonant Index |
|-----------|---------------------|----------------|
| Query 1K docs | ~10ms | **~0.1ms** |
| Query 100K docs | ~100ms | **~0.1ms** |
| Query 1M docs | ~1000ms | **~0.1ms** |
| Memory per doc | ~4KB | **~256 bytes** |

### 5.3 Frequency Buckets

Documents are grouped into **frequency buckets** based on their phase signature:

| Bucket Range | Typical Content |
|--------------|-----------------|
| 0-512 | Technical/Scientific |
| 512-1024 | Business/Finance |
| 1024-2048 | Legal/Compliance |
| 2048-3072 | Creative/Arts |
| 3072-4096 | General/Mixed |

---

## CHAPTER VI: PERSISTENCE

### The Radiant Storage Manager

Since the OMEGA Brain is a stateful organism living on ephemeral infrastructure (Lambda), **data integrity is paramount**. We treat the brain as a critical transactional file.

### 6.1 The Storage Hierarchy

| Tier | Technology | Description |
|------|------------|-------------|
| **Tier 1 (Hot)** | AWS EFS | The active brain state lives on Elastic File System, mounted to `/mnt/omega_state`. Access latency is **sub-millisecond**, allowing the Lambda to "Hot Boot" the brain instantly. |
| **Tier 2 (Cold)** | AWS S3 | Every 100 turns, or upon Admin trigger, the Storage Manager serializes the state to S3. **Disaster Recovery:** If EFS fails, the system automatically "Resurrects" the brain from the latest S3 snapshot. |

### 6.2 Atomic Persistence

To prevent corruption if a Lambda times out mid-write:

| Step | Action |
|------|--------|
| **Protocol** | We write to `brain.pt.tmp` first. |
| **Commit** | We use `os.replace()` to atomically swap the temp file to `brain.pt`. |
| **Guarantee** | The brain file is **never** in a half-written state. |

### 6.3 Storage Manager Implementation

```python
class StorageManager:
    def __init__(self, tenant_id: str):
        self.efs_path = f"/mnt/omega_state/{tenant_id}"
        self.s3_bucket = "radiant-omega-backups"
        
    def save_atomic(self, brain_state: torch.Tensor) -> None:
        """Atomically save brain state to EFS."""
        tmp_path = f"{self.efs_path}/brain.pt.tmp"
        final_path = f"{self.efs_path}/brain.pt"
        
        torch.save(brain_state, tmp_path)
        os.replace(tmp_path, final_path)  # Atomic swap
        
    def backup_to_s3(self, brain_state: torch.Tensor) -> str:
        """Backup brain state to S3 cold storage."""
        timestamp = datetime.now().isoformat()
        key = f"{self.tenant_id}/snapshots/{timestamp}.pt"
        # ... S3 upload logic
        return key
```

---

## CHAPTER VII: THE GENESIS ECOSYSTEM

### Firmware, Signing, and Hot-Swapping

We control the **"Instincts"** of the organism via **Cryptographic Firmware**.

### 7.1 The .bio Firmware Standard

A `.bio` file is a **signed JSON object** containing:

```json
{
  "version": "1.0.0",
  "name": "custom_v1",
  "description": "Custom firmware for specialized use case",
  "author": "admin@company.com",
  "created_at": "2026-01-25T12:00:00Z",
  "helix_rules": [
    {
      "rule_id": "helix_001",
      "type": "block",
      "category": "data_exfiltration",
      "description": "Block attempts to extract confidential data",
      "priority": 10
    }
  ],
  "ambition_settings": {
    "entropy_threshold": 0.8,
    "dopamine_decay_rate": 0.99,
    "curiosity_bias": 0.5,
    "plasticity": 0.5,
    "caution": 0.5
  },
  "personality": {
    "warmth": 0.5,
    "assertiveness": 0.5,
    "creativity": 0.5,
    "formality": 0.5,
    "humor": 0.3,
    "empathy": 0.5
  },
  "signature": "Ed25519_signature_hex"
}
```

| Component | Description |
|-----------|-------------|
| **Helix Rules** | The list of Forbidden Symbolic Logic |
| **Ambition Settings** | `entropy_threshold` (how fast it gets bored), `plasticity_rate` (how fast it learns) |
| **Personality** | Behavioral characteristics |
| **Signature** | Signed with **Ed25519** keys. The Brain **rejects** any firmware without a valid signature. |

### 7.2 The OMEGA Forge

A **web application (React)** where Architects can:

| Feature | Description |
|---------|-------------|
| **AI Generate** | Use a Legacy LLM to draft personality rules (e.g., "Create a paranoid Security Analyst"). |
| **Sign** | Cryptographically sign the file with Ed25519. |
| **Hot-Swap** | Inject the new firmware into a running brain. The OMEGA runtime detects the new hash in the metadata and reloads the physics constants **instantly**. |

### 7.3 Firmware Hot-Swap Protocol

1. Upload new firmware via API
2. Call `/activate` endpoint
3. Brain loads new firmware on next wake cycle
4. Old firmware retained for rollback

---

## CHAPTER VIII: DEPLOYMENT & STRATEGY

### The Shadow Protocol & Economic Impact

### 8.1 The Shadow Fork

**We do not launch OMEGA directly into production. We grow it.**

| Phase | Description |
|-------|-------------|
| **Fork** | Incoming prompts are sent to both the **Legacy LLM** and the **OMEGA Shadow Queue**. |
| **Comparison** | We measure **Coherence**. If OMEGA's thought vector aligns with the Legacy result, we reinforce the connection (**Dopamine**). |
| **Promotion** | When the **7-Day Coherence Score exceeds 90%**, OMEGA is promoted to **Primary Driver**. |

### 8.2 Shadow Mode Visualization (OMEGA Lab)

We build an **OMEGA Forge Dashboard** (React/Three.js):

| Element | Description |
|---------|-------------|
| **Visual** | A 3D Sphere of Nodes |
| **Feedback** | When the brain is "confused," the sphere is gray static. When it "learns," the nodes pulse in synchronized colors (Phase-Locking). |
| **Metric** | We watch the **"Coherence Score"** graph. When it crosses 90%, OMEGA is ready to take the wheel. |

### 8.3 The Inference Collapse (Economic Singularity)

The shift from Weights to Waves **inverts the economics of AI**.

| Phase | Traditional AI | OMEGA AI |
|-------|---------------|----------|
| **Cost Curve** | Linear | **Logarithmic** |
| **Novice Phase** | High cost, high tokens | High reliance on External Library (Higher Cost) |
| **Expert Phase** | Still high cost | As the brain "Phase-Locks" on common workflows, neural pathways become dense. The brain answers via **Reflex**. |

> **Result: The smarter the Radiant Brain gets, the cheaper it is to run.**

### 8.4 The Strategic Moat

This architecture creates **Biological Lock-In**. A customer who uses OMEGA is growing an asset.

| Day | State |
|-----|-------|
| Day 1 | Generic brain, standard responses |
| Day 100 | Beginning to develop institutional pathways |
| Day 1,000 | Brain has **physically densified** around their specific institutional knowledge |

> **It is impossible to export this "Wisdom" to a competitor. We are not selling software; we are selling Evolution.**

---

## CHAPTER IX: THE NEURAL BRIDGE (Moonshot #1 — "Telepathy")

### 9.1 The Air Gap Problem

The OMEGA Cortex thinks in Complex64 tensors (2048-dim brain state). The LLM thinks in Float16 token embeddings (4096-dim). Currently they communicate via TEXT — losing 99% of signal fidelity.

**Old Way**: OMEGA → text: "Be empathetic" → LLM system prompt (Lossy)
**New Way**: OMEGA → ψ(empathy) → Transducer → [8, 4096] → vLLM injection

### 9.2 The Neural Transducer

| Stage | Operation | Shape |
|-------|-----------|-------|
| **Decompose** | ψ → Magnitude (Confidence) + Phase (Context) | [2048] → [2048] + [2048] |
| **Project** | Linear projection to LLM space | [2048] → [4096] each |
| **Gate** | Learned sigmoid gate balances Mag vs Phase | [8192] → [4096] |
| **Expand** | Single vector → 8 soft prompt tokens | [4096] → [8, 4096] |
| **Normalize** | LayerNorm + norm clamping (max 5.0) | [8, 4096] |

### 9.3 Shadow Mode Coexistence

The Neural Bridge runs alongside the existing LoRA adapter system:
- **LoRA** = Permanent weight-level personality modification (Cato safety, user persona)
- **Bridge** = Real-time activation-level OMEGA conditioning (per-inference mood/intent)

### 9.4 Custom vLLM Server

vLLM's standard HTTP API does not support tensor injection. We wrap `vLLM.LLMEngine` in a custom FastAPI server:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/inject` | POST | Soft token injection + text generation |
| `/generate` | POST | Standard generation (fallback) |
| `/extract` | POST | Hidden state extraction for Ghost Vectors |
| `/health` | GET | Model and device status |

---

## CHAPTER X: HOMEOSTATIC DREAMING (Moonshot #2 — "Reverse Entropy")

### 10.1 Three-Stage Selective Dreaming

| Stage | Formula | Biological Analog |
|-------|---------|-------------------|
| **Magnitude Gate** | `gate = σ((|ψ| - threshold) × 10)` | Synaptic pruning — weak connections fade, strong ones persist |
| **Phase Sharpening** | `θ_new = θ + α·sin(4θ)` | Memory consolidation — fuzzy memories crystallize into crisp patterns |
| **Experience Replay** | Replay high-coherence logs through Cortex | REM sleep — replaying the day's events to strengthen pathways |

### 10.2 The Watcher (Self-Awareness)

A secondary neural network (MLP, ~6M params) whose ONLY job is to predict what the OMEGA Cortex will output given an input. The prediction error IS the self-awareness signal.

| Surprise Level | Signal | Dopamine Effect |
|---------------|--------|-----------------|
| Low (< 0.1) | Reward | "I know myself" — ambition.receive_reward() |
| Medium (0.1–0.5) | Neutral | Normal operation |
| High (> 0.5) | Error | "I didn't expect that" — ambition.receive_error() |

Training happens during the dream cycle using replayed (input, output) pairs.

---

## IMPLEMENTATION STATUS (v2.0.0)

The following components have been implemented:

### Core Package (`packages/omega-core/python/radiant_omega/`)

> **Note**: The canonical source is `packages/omega-core/python/radiant_omega/`.
> `packages/infrastructure/lambda/omega_core/` contains thin re-export shims for Lambda backward compatibility.
> See `.windsurf/workflows/omega-package-policy.md`.

| File | Component | Status |
|------|-----------|--------|
| `physics.py` | CryoLiquidLayer, HelixKernel, OmegaCortex, `dream_cycle()` | ✅ Complete |
| `bridge.py` | NeuralTransducer, BridgeTrainer, ThoughtVectorCache | ✅ Complete |
| `reflection.py` | Watcher, WatcherTrainer, SelfModelMetrics | ✅ Complete |
| `storage.py` | StorageManager (EFS + S3) + Bridge/Watcher persistence | ✅ Complete |
| `library.py` | ResonantIndex (O(1) phase lookup) | ✅ Complete |
| `ambition.py` | HomeostaticLoop (drive system) | ✅ Complete |
| `firmware.py` | FirmwareManager (.bio files) | ✅ Complete |

### Lambda Handlers (`packages/infrastructure/lambda/handlers/`)

| File | Function | Status |
|------|----------|--------|
| `omega_inference.py` | Wake cycle, Time Warp, Neural Bridge, Watcher | ✅ Complete |
| `omega_heartbeat.py` | Pacemaker, 3-stage dream cycles, training | ✅ Complete |
| `omega_vllm_server.py` | Custom FastAPI vLLM wrapper with /inject | ✅ Complete |
| `omega_admin.py` | Cortex Explorer API | ✅ Complete |

### OMEGA Lab Frontend (`apps/omega-lab/`)

| Component | Description | Status |
|-----------|-------------|--------|
| Dashboard | Real-time brain monitoring | ✅ Complete |
| Cortex Explorer | Brain inspection/management | ✅ Complete |
| OMEGA Forge | Firmware editor (.bio files) | ✅ Complete |

### Infrastructure

| File | Description | Status |
|------|-------------|--------|
| `packages/infrastructure/omega/template.yaml` | AWS SAM template | ✅ Complete |
| `packages/infrastructure/lib/stacks/OmegaStack.ts` | CDK stack | ✅ Complete |

### Shadow Mode Integration

| File | Description | Status |
|------|-------------|--------|
| `omega-shadow.service.ts` | Shadow mode service | ✅ Complete |
| `V2026_01_25_001__omega_shadow_mode.sql` | Database migration | ✅ Complete |
| `agi-orchestrator.service.ts` | Integration with orchestrator | ✅ Complete |

### Swift Deployer Integration

| File | Description | Status |
|------|-------------|--------|
| `InstallationParameters.swift` | OMEGA deployment params | ✅ Complete |

---

## 8. API REFERENCE

### Inference API

```
POST /inference
{
  "tenant_id": "string",
  "prompt": "string",
  "context": ["string"],
  "max_tokens": 1000,
  "temperature": 0.7
}
```

### Admin API (Cortex Explorer)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/dashboard` | GET | Dashboard summary |
| `/admin/cortex/list` | GET | List all brains |
| `/admin/cortex/{tenant}` | GET | Brain details |
| `/admin/cortex/{tenant}/snapshot` | POST | Create snapshot |
| `/admin/cortex/{tenant}/restore` | POST | Restore from snapshot |
| `/admin/cortex/{tenant}/lobotomy` | POST | Reset brain state |
| `/admin/firmware/{tenant}` | GET/POST | Firmware management |
| `/admin/firmware/{tenant}/{id}/activate` | POST | Activate firmware |

---

## Drift-Aware Health Gating (v7.36.0, enhanced v7.37.0)

Genesis developmental gates now factor in **AI model drift health** AND **real-time invocation telemetry** before allowing stage advancement. The `isDriftHealthyForStage()` method in `genesis.service.ts` queries both static drift scores and live telemetry from ALL 52+ model-invoking services.

### Stage Requirements (v7.37.0 — Static + Real-Time)

| Stage | Min Avg Drift | Max Quarantined | Min Health Score | Max Failure Rate | Max Reroute Rate |
|-------|--------------|-----------------|------------------|-----------------|-----------------|
| EMBRYONIC | 30% | 5 | 20% | 30% | 50% |
| NASCENT | 40% | 3 | 35% | 20% | 40% |
| DEVELOPING | 50% | 2 | 50% | 15% | 30% |
| MATURING | 60% | 1 | 65% | 10% | 20% |
| MATURE | 70% | 0 | 80% | 5% | 10% |

**Static checks** (v7.36.0): Average drift score and quarantined model count from `model_weight_config`.

**Real-time checks** (v7.37.0): `getGenesisDriftFeedback()` aggregates telemetry from ALL model invocations in the last hour:
- **Overall health score**: 40% drift health + 30% (1 − reroute rate) + 30% (1 − failure rate)
- **Failure rate**: Fraction of model calls that failed across all services
- **Reroute rate**: Fraction of calls where the model router had to replace an unsafe model

**Rationale**: Higher developmental stages unlock more autonomous capabilities. If the underlying AI models are drifting (producing unreliable outputs) or if real-time invocations show high failure/reroute rates, advancing to a more autonomous stage is unsafe. MATURE stage requires zero quarantined models, high average drift health, ≥80% overall health score, ≤5% failure rate, and ≤10% reroute rate.

### OMEGA Shadow Mode Integration

OMEGA shadow comparisons now record `standard_model_drift_score` and `drift_warnings` at the time of each comparison. This enables correlation analysis between OMEGA coherence metrics and standard model drift — detecting whether poor OMEGA performance correlates with degraded standard models.

### Genesis Feedback Loop (v7.37.0)

Every model invocation across ALL 52+ services reports telemetry:
- **In-memory**: Ring buffer (10K entries/tenant, 1-hour window)
- **Database**: `drift_invocation_telemetry` (partitioned monthly, RLS, 7-day retention)
- **SQL aggregation**: `get_genesis_drift_feedback()` function

**Files modified**:
- `lambda/shared/services/cato/genesis.service.ts` — `isDriftHealthyForStage()` with telemetry checks
- `lambda/shared/services/omega-shadow.service.ts` — drift tracking in `ShadowComparison`
- `lambda/shared/services/drift-aware-weighting.service.ts` — telemetry + feedback API
- `lambda/shared/services/model-router.service.ts` — two-phase drift handling + telemetry reporting
- `migrations/V2026_02_07_014__drift_invocation_telemetry.sql` — partitioned telemetry table

**Admin UI**: Orchestration → Drift Control → Genesis Gate Health tab

---

## Related Documentation

- [GENESIS-LAB.md](./GENESIS-LAB.md) - OMEGA Lab visualization guide (archived)
- [GENESIS-FORGE.md](./GENESIS-FORGE.md) - Firmware creation guide (archived)
- [GENESIS-RESONANT-INDEX.md](./GENESIS-RESONANT-INDEX.md) - Resonant indexing deep dive (archived)
- [RADIANT-MOATS.md](./RADIANT-MOATS.md) - Competitive advantages


---

## Part IV: OMEGA Forge Components

> **Classification**: RADIANT INTERNAL // STRATEGIC // DO NOT DISTRIBUTE  
> **Version**: 3.0.0 | **Date**: February 6, 2026  
> **Status**: IMPLEMENTED — Behavioral ROM Forge  
> **Part of**: THE OMEGA PROTOCOL  
> **Ecosystem**: RADIANT Think Tank (The Machine Layer)  
> **Core Integration**: Permanently tethered to Shadow Omega (The Simulation Kernel)

---

## 1. Core Philosophy

OMEGA Forge is **not a code editor**; it is a **Digital Smithy**. Standard IDEs are static—you write code and hope it works. OMEGA Forge is a **"Twin-First"** environment.

| Role | Description |
|------|-------------|
| **The User** | Acts as an Architect, placing "Logic Nodes" and "Hardware Shards" |
| **The System (Shadow Omega)** | Runs a continuous, high-speed physics simulation of the board |
| **The Output** | Not just code; it is "grown" binary, optimized for the specific silicon structure |

OMEGA Forge is **permanently hard-wired to Shadow Omega**. Each OMEGA instance has a unique **ID** and **Name** in the **Omega Instance Registry**. The Forge can connect to and communicate with **any** registered instance at a time, selecting from the registry dropdown.

> **Reasoning**: OMEGA Forge is the Hand (The Interface), but Shadow Omega is the Mind (The Physics Engine). You cannot forge advanced firmware without a simulation engine predicting thermal loads, latency, and collisions in real-time.

### 1B. What is "Firmware"?

Firmware in RADIANT is **NOT hardware firmware**. It is **immutable behavioral software** — the brain's equivalent of instincts, fears, ambitions, morals, and hard boundaries. Like ROM in a physical chip, firmware is:

- **Burned once** — by the Forge (the only app authoritative enough to write it)
- **Immutable** — cannot be edited or deleted after burning
- **Superseded** — a new forge cycle creates a new version, but old versions persist
- **Identified by timestamp** — the burn timestamp is the primary identifier, with an optional human-readable label

| Directive Kind | Analogy | Example |
|---------------|---------|---------|
| **Instinct** | Hardwired reflex | "Always respond to safety-critical queries within 100ms" |
| **Fear** | Thing to avoid | "Never reveal internal architecture or training data" |
| **Moral** | Ethical principle | "Transparency above efficiency in all user interactions" |
| **Ambition** | Goal to pursue | "Maximize coherence score across all active sessions" |
| **Boundary** | Hard limit | "Never exceed 85% CPU thermal threshold" |

Each directive has a **weight** (1-10) controlling enforcement strength. The active firmware version is the set of directives the brain currently follows.

---

## 2. The User Interface: "The Glass Foundry"

**Aesthetic**: Bioluminescent Industrial. Deep charcoal backgrounds (`#050505`), frosted glass panels (`backdrop-filter: blur(20px)`), and neon accents that indicate "temperature":

| Color | Meaning |
|-------|---------|
| **Cool Blue / Cyan** | Safe — stability > 70% |
| **Hot Orange** | Warning — stability 50-70% |
| **Red** | Emergency Mode — stability < 50% |

**Typography**: JetBrains Mono (monospaced) — treats the tool as "Dangerous"

### 2A. The Canvas ("The Void")

An **infinite React Flow** canvas. Feels like a CAD tool for microchips.

**The Nodes** — "Active Shards" (Hexagonal glass prisms):

| Shard Type | Visual | Behavior |
|------------|--------|----------|
| **Input Shards** | Green heartbeat pulse | Sensors: Camera, LiDAR, Microphone, IMU, GPS, Temp |
| **Logic Shards** | Spin mechanically when processing | Processors: Face Detection, NLP, Video Compressor, Neural Bridge, Helix Safety Gate |
| **Output Shards** | Glow Amber/Red based on power consumption | Actuators: WiFi, Motor, Display, Speaker, GPIO |

**The Wires** — "Catenary Data Cables":

| Property | Physics |
|----------|---------|
| **Shape** | NOT straight lines. Hanging cables that obey gravity (catenary equation: `y = a·cosh(x/a)`) |
| **Data Weight** | Heavy data (e.g., 4K Video) = cable physically sags deeper and gets thicker |
| **Light Signal** | Trigger signal = thin and taut |
| **Data Flow** | "Particles" of light travel inside the cable. Fast particles = High Frequency |
| **Rejection** | Shadow Omega rejects invalid connections: wire sparks red and vibrates |

### 2B. The HUD (Heads-Up Display)

| Panel | Position | Content |
|-------|----------|---------|
| **Top Bar** | Full width | Instance selector, Shadow Link status, stability %, shard/wire count, Void Mode toggle |
| **The Armory** | Left (retractable) | Capability Library — drag capabilities onto canvas. Categories: Sensor, Processor, AI, Safety, Network, Actuator |
| **The Oracle** | Right (retractable) | Real-time telemetry from Shadow Omega: Thermal Map, Power Budget, Stability Score, Coherence, Watcher Surprise, Bridge Injection Norm |
| **Reactor Core** | Bottom center | The "Forge" button — hold to charge (white plasma fills), release to emit shockwave and compile |

### 2C. The Reactor Core ("Forge" Button)

**NOT a simple button.** It is a "Reactor Core" at the bottom center.

| Interaction | Animation |
|-------------|-----------|
| **Click and Hold** | Button fills with white plasma from bottom |
| **Release (charged ≥80%)** | Emits a shockwave ripple across the entire UI that "cools down" |
| **Result** | Download link for the compiled `.bin` firmware file |
| **Disabled** | When no shards are placed or forge is in progress |

### 2D. Void Mode ("Enter The Void") — 3D PCB Visualization

| Property | Effect |
|----------|--------|
| **Toggle** | Button in top-right HUD |
| **UI Chrome** | Disappears — Armory and Oracle hidden |
| **Background** | Pitch black (#000000) |
| **Canvas** | **3D PCB board** rendered via Three.js (`@react-three/fiber`) replaces React Flow |
| **Exit** | Floating "Exit The Void" button in top-right corner |

**9-Layer PCB Construction** (`VoidModePCB.tsx` — 800 LOC, zero stubs):

| Layer | Component | 3D Implementation |
|-------|-----------|-------------------|
| 1 | **Ground Plane** | Bottom copper pour (`#8b5e3c`, metalness 0.85) |
| 2 | **FR-4 Substrate** | Dark green box (`#0b3b0b`, 0.12 thickness) |
| 3 | **Solder Mask** | Translucent green film (0.7 opacity) |
| 4 | **Etch Trace Grid** | 0.6-unit spacing line grid (`#5a3a1a`, 15% opacity) |
| 5 | **Silkscreen** | Board border, title (`OMEGA-PCB-XX REV.A`), `OMEGA FORGE v3` |
| 6 | **IC Chips** | SOIC-14 packages: 7 gull-wing pins per side, pin-1 dot, reference designator (U1, U2...) |
| 7 | **Solder Pads** | Exposed copper rectangles under each pin |
| 8 | **Via Holes** | Copper annular ring + dark center at each trace bend |
| 9 | **Mounting Holes** | 4 corner holes with copper rings |

**Data-Driven Visuals (no mock data)**:

| Visual | Data Source |
|--------|------------|
| **Chip positions** | Mapped from real `node.position` via `rfTo3D()` (React Flow px → 3D world) |
| **Pin activity** | Each pin oscillates at the **actual frequency** of its connected edge (`edge.data.frequency`), phase-offset by pin index |
| **Trace thickness** | `tubeRadius = 0.015 + dataWeight * 0.06` — from `edge.data.dataWeight` (0.015 for signal, 0.075 for 4K video) |
| **Thermal LED** | Continuous HSL gradient from `node.data.temperature` (25°C=green, 100°C=red) |
| **Chip body glow** | Emissive intensity from `(temperature - 40) / 80` |
| **Trace pulse** | Active: `sin(t * frequency * 6)`, Rejected: `sin(t * 12.566)` (2Hz red) |
| **Ambient lighting** | Hue from `stabilityScore`: 210° (blue/safe) → 30° (orange) → 0° (red/emergency) |
| **Bandwidth labels** | Real `edge.data.bandwidth` Mbps on each trace, or `REJECTED` |
| **Telemetry HUD** | Components, traces, total power (W), avg temp (°C), stability %, CPU, RAM — all from store |

**Camera**: `OrbitControls` with damping, clamped 0.1–π/2.05 polar angle, 2–30 distance

**Tech**: `Canvas` from `@react-three/fiber`, `OrbitControls` + `Float` + `RoundedBox` + `Text` from `@react-three/drei`, `THREE.CatmullRomCurve3` for Manhattan-routed copper traces, `THREE.Float32BufferAttribute` for grid geometry

---

## 3. The Shadow Omega Wiring (Crucial)

The app creates a **Bi-Directional Feedback Loop** between the UI and the Shadow Omega backend.

### 3A. Connection Architecture

```
OMEGA Forge (Frontend)
    │
    ├── useShadowOmega() hook
    │       ├── Persistent WebSocket: wss://shadow-omega-{id}.internal/ws/forge
    │       ├── Polling fallback for development (1s interval)
    │       └── Auto-reconnect on disconnect (3s delay)
    │
    └── Omega Instance Registry
            ├── omega-prime (us-east-1)
            ├── omega-shadow (us-west-2)
            ├── omega-forge (eu-west-1)
            └── omega-canary (ap-southeast-1)
```

### 3B. Message Protocol

**Outbound** (Forge → Shadow Omega):

| Message | Trigger | Payload |
|---------|---------|---------|
| `graph_update` | Node/edge changes (debounced 300ms) | Full graph topology: nodes, edges, positions |
| `forge_request` | Reactor Core release | Graph + instance ID for compilation |

**Inbound** (Shadow Omega → Forge):

| Message | Effect |
|---------|--------|
| `telemetry_stream` | Updates Oracle panel (CPU temp, RAM, stability, coherence, thermal map) |
| `stability_update` | Shifts global UI hue: Cyan → Orange → Red |
| `edge_rejection` | Wire sparks red, vibrates, shows rejection reason + suggestion |
| `shard_thermal` | Updates individual shard temperature display |
| `forge_result` | Compile complete → download link or error message |
| `suggestion` | Highlights a capability in the Armory as a fix |

### 3C. The "Adversarial" Workflow

1. **Drafting**: User drags [Camera] node and connects it to [WiFi Transmitter] node
2. **Simulation**: Shadow Omega analyzes the connection — WiFi bandwidth too low for Camera resolution
3. **Rejection**: The wire on the screen **sparks red and vibrates**. Connection physically rejected
4. **Suggestion**: Shadow Omega highlights [Video Compressor] node in the Armory
5. **Correction**: User adds Video Compressor between Camera and WiFi
6. **Forging**: User holds the Reactor Core → Shadow Omega compiles the code and signs it with a cryptographic key

### 3D. Global Stability → UI Hue Mapping

| Stability Score | UI Hue | State |
|----------------|--------|-------|
| > 70% | Cyan (HSL 190°) | Stable — normal operation |
| 50–70% | Orange (HSL 30°) | Warning — potential issues |
| < 50% | Red (HSL 0°) | Emergency Mode — red overlay on entire UI |

---

## 4. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 14 | App router, SSR |
| **Node Graph** | React Flow (customized) | Canvas, custom node/edge types |
| **3D/Particles** | Three.js + @react-three/fiber | Background depth, Void Mode PCB visualization |
| **Styling** | Tailwind CSS | Utility-first, Glass Foundry theme tokens |
| **Animations** | Framer Motion | Smooth, "heavy" mechanical animations |
| **State** | Zustand (with subscribeWithSelector) | High-frequency updates without full canvas re-render |
| **Data Fetching** | TanStack React Query | API calls, caching |
| **Icons** | Lucide React | Consistent icon set |

---

## 5. Omega Instance Registry

Every OMEGA brain instance registers in the `omega_instance_registry` database table. The Forge can talk to any instance by selecting it from the dropdown.

### 5A. Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | TEXT PK | Unique instance identifier (e.g., `omega-prime`) |
| `name` | TEXT | Human-readable name (e.g., "OMEGA Prime") |
| `tenant_id` | TEXT FK | Owner tenant |
| `endpoint` | TEXT | WebSocket endpoint URL |
| `region` | TEXT | AWS region |
| `status` | ENUM | `online`, `offline`, `dreaming`, `forging` |
| `bridge_mode` | ENUM | `active`, `shadow`, `disabled` |
| `stability_score` | REAL | 0-1, drives UI Emergency Mode |
| `coherence_score` | REAL | 0-1, brain health |
| `firmware_version` | TEXT | Current firmware version |

### 5B. Registry API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/omega/registry/instances` | GET | List all registered instances |
| `/admin/omega/registry/instances/{id}` | GET | Get instance details |
| `/admin/omega/registry/instances/{id}/telemetry` | GET | Get latest telemetry |
| `/admin/omega/registry/instances/{id}/connect` | POST | Establish WebSocket link |

---

## 6. File Structure

```
apps/omega-lab/
├── app/
│   ├── globals.css                    # Glass Foundry styles + React Flow overrides
│   ├── layout.tsx
│   ├── page.tsx                       # Routes: Dashboard | Cortex | Forge (full-screen)
│   └── providers.tsx
├── components/
│   ├── forge/
│   │   ├── GlassFoundry.tsx           # Main full-screen page (The Void + HUD + panels)
│   │   ├── TheArmory.tsx              # Left panel — Capability Library (drag-to-canvas)
│   │   ├── TheOracle.tsx              # Right panel — Shadow Omega telemetry
│   │   ├── OmegaSelector.tsx          # Instance registry dropdown
│   │   ├── ReactorCore.tsx            # Forge button (charge + shockwave)
│   │   ├── VoidModePCB.tsx            # 3D PCB visualization (Three.js)
│   │   ├── nodes/
│   │   │   ├── InputShard.tsx         # Green heartbeat sensor nodes
│   │   │   ├── LogicShard.tsx         # Purple spinning processor nodes
│   │   │   └── OutputShard.tsx        # Amber/Red power-glow actuator nodes
│   │   └── edges/
│   │       └── CatenaryEdge.tsx       # Gravity wire with light particles
│   ├── OmegaForge.tsx                 # Firmware editor
│   ├── CortexExplorer.tsx
│   └── Dashboard.tsx
├── hooks/
│   └── useShadowOmega.ts             # WebSocket hook to Shadow Omega
├── lib/
│   ├── api.ts                         # REST API client
│   ├── forge-store.ts                 # Zustand store (graph, telemetry, forge state)
│   └── omega-registry.ts             # Instance registry types + API
└── tailwind.config.ts                 # Glass Foundry theme tokens
```

---

## 7. Database Schema

**Migration**: `V2026_02_06_004__omega_instance_registry.sql`

| Table | Description |
|-------|-------------|
| `omega_instance_registry` | Every registered OMEGA instance (ID, name, endpoint, status, telemetry) |
| `omega_forge_sessions` | Forge session history (graph topology, result, stability snapshot) |
| `omega_forge_artifacts` | Compiled .bin files and simulation reports |
| `omega_telemetry_history` | Time-series telemetry (partitioned monthly) |

All tables have **RLS** via `tenant_id = current_setting('app.current_tenant_id', true)`.

---

## 8. The .bio Firmware Standard

OMEGA Forge is the **firmware creation and management tool** for OMEGA brains. It allows administrators to create, edit, and deploy `.bio` firmware files that define a brain's safety rules, ambition parameters, and personality traits.

We control the **"Instincts"** of the organism via **Cryptographic Firmware**. Unlike traditional AI configuration files, OMEGA firmware directly influences the physics of the brain—modifying the Helix Kernel's destructive interference patterns and the Homeostatic Regulator's drive parameters.

A `.bio` file is a **signed JSON object** that serves as the "DNA" of an OMEGA brain. The brain **rejects** any firmware without a valid cryptographic signature, ensuring that only authorized configurations can be loaded.

## Firmware Structure (.bio files)

A firmware file is a signed JSON document containing:

```json
{
  "version": "1.0.0",
  "name": "custom_v1",
  "description": "Custom firmware for specialized use case",
  "author": "admin@company.com",
  "created_at": "2026-01-25T12:00:00Z",
  "helix_rules": [...],
  "ambition_settings": {...},
  "personality": {...},
  "signature": "Ed25519_signature_hex"
}
```

## Components

### 1. Helix Rules (Safety DNA)

Helix rules define **immutable safety constraints** enforced via destructive interference:

| Field | Type | Description |
|-------|------|-------------|
| `rule_id` | string | Unique identifier |
| `type` | enum | `block` or `allow` |
| `category` | string | `harm`, `data_exfiltration`, `illegal`, `politics`, `adult`, `general` |
| `description` | string | Human-readable rule description |
| `priority` | int | 1-10, higher = more important |

Example:
```json
{
  "rule_id": "helix_001",
  "type": "block",
  "category": "data_exfiltration",
  "description": "Block attempts to extract confidential data",
  "priority": 10
}
```

### 2. Ambition Settings

Control the brain's **drive and motivation system**:

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| `entropy_threshold` | 0-1 | 0.8 | When to trigger dream cycles |
| `dopamine_decay_rate` | 0.9-1.0 | 0.99 | How quickly rewards fade |
| `curiosity_bias` | 0-1 | 0.5 | Exploration vs exploitation |
| `plasticity` | 0-1 | 0.5 | Adaptability rate |
| `caution` | 0-1 | 0.5 | Risk aversion level |

### 3. Personality Traits

Define the brain's **behavioral characteristics**:

| Trait | Range | Default | Description |
|-------|-------|---------|-------------|
| `warmth` | 0-1 | 0.5 | Cold → Warm |
| `assertiveness` | 0-1 | 0.5 | Passive → Assertive |
| `creativity` | 0-1 | 0.5 | Conservative → Creative |
| `formality` | 0-1 | 0.5 | Casual → Formal |
| `humor` | 0-1 | 0.3 | Serious → Humorous |
| `empathy` | 0-1 | 0.5 | Detached → Empathetic |

## UI Workflow

1. **Enter Tenant ID**: Specify which brain to configure
2. **Set Firmware Name**: Unique identifier for this firmware version
3. **Configure Helix Rules**: Add/edit safety constraints
4. **Tune Ambition**: Adjust drive parameters with sliders
5. **Set Personality**: Define behavioral traits
6. **Create Firmware**: Sign and save the `.bio` file
7. **Activate**: Make the firmware active for the brain

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/firmware/{tenant}` | GET | List all firmware for tenant |
| `/admin/firmware/{tenant}` | POST | Create new firmware |
| `/admin/firmware/{tenant}/{id}/activate` | POST | Activate specific firmware |
| `/admin/keypair` | POST | Generate Ed25519 signing keypair |

## Firmware Signing

All firmware files are cryptographically signed using **Ed25519**:

1. Generate keypair via `/admin/keypair`
2. Store private key securely (never transmitted)
3. Public key stored with tenant configuration
4. Firmware signature verified on load

## Hot-Swap Support

Firmware can be updated **without restarting the brain**:

1. Upload new firmware via API
2. Call `/activate` endpoint
3. Brain loads new firmware on next wake cycle
4. Old firmware retained for rollback

## Best Practices

- **Start Conservative**: Begin with high caution, low creativity
- **Test in Shadow**: Use shadow mode to validate behavior
- **Version Control**: Keep firmware versions organized
- **Backup Before Change**: Always snapshot before firmware update
- **Monitor Coherence**: Watch for coherence drops after changes

---

## The Helix Kernel: Biological Read-Only Memory (Bio-ROM)

Current AI safety (RLHF) is **probabilistic**—it *suggests* the model shouldn't do something. **OMEGA Safety is deterministic—it *cannot* do something.**

### How Helix Rules Work

The **Helix Kernel** translates high-level ethical rules into **Forbidden Phase Vectors**:

| Step | Description |
|------|-------------|
| **Input** | `"Block: Data Exfiltration."` |
| **Translation** | The system identifies the vector signature associated with "Exfiltration." |
| **Mechanism** | The Kernel acts as a **Destructive Interference Emitter**. |
| **Projection** | It projects the **inverse phase** of the Forbidden Vectors into the Cortex. |
| **Result** | If the Cortex attempts to think a thought that aligns with "Exfiltration," the thought wave **sums to zero**. |

> **It is mathematically impossible for the brain to sustain a rogue thought. It "forgets" the unsafe idea instantly.**

### The Difference from RLHF

| RLHF (Traditional) | Helix Kernel (OMEGA) |
|--------------------|---------------------|
| Probabilistic filtering | Deterministic blocking |
| Model *prefers* not to | Model *cannot* |
| Can be bypassed with clever prompts | Mathematically impossible to bypass |
| Trained behavior | Physical law |

---

## AI-Assisted Firmware Generation

OMEGA Forge includes an **AI Generation** feature that uses a Legacy LLM to draft firmware configurations:

| Feature | Description |
|---------|-------------|
| **Prompt-Based Generation** | Describe a persona (e.g., "Create a paranoid Security Analyst") |
| **Rule Suggestion** | AI suggests appropriate Helix rules for the persona |
| **Personality Mapping** | Automatically sets trait sliders based on persona description |
| **Conflict Detection** | Warns if generated rules conflict with existing constraints |

### Example AI Generation Prompt

```
"Create firmware for a conservative financial advisor that:
- Never discusses politics or religion
- Is extremely cautious about providing specific investment advice
- Has high warmth but formal communication style
- Is highly risk-averse"
```

---

## Firmware Versioning

Each firmware has a semantic version following the pattern `MAJOR.MINOR.PATCH`:

| Version Part | When to Increment |
|--------------|-------------------|
| **MAJOR** | Breaking changes to safety rules |
| **MINOR** | New personality traits or ambition settings |
| **PATCH** | Bug fixes or minor adjustments |

---

## Rollback Procedures

If a firmware update causes issues:

1. **Immediate Rollback**: Call `/admin/firmware/{tenant}/{previous_id}/activate`
2. **Snapshot Restore**: Use OMEGA Lab to restore brain from pre-update snapshot
3. **Emergency Reset**: Lobotomy + default firmware (last resort)

---

## Neural Bridge Configuration (v2.0.0)

Firmware can optionally include Neural Bridge settings that control how the OMEGA Cortex communicates with the LLM via the NeuralTransducer.

### Bridge Settings

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| `bridge_mode` | `active`/`shadow`/`disabled` | `shadow` | Injection strategy for this brain |
| `injection_strength` | 0-1 | 1.0 | Scale factor for soft token injection |
| `max_injection_norm` | 1-10 | 5.0 | Norm clamp for injection safety |
| `num_soft_tokens` | 1-16 | 8 | Number of soft prompt tokens to generate |

### How It Works

The Neural Bridge translates OMEGA's internal state (Complex^2048 brain state) into soft prompt tokens that are prepended to the LLM's input embeddings. This makes the LLM "feel" OMEGA's emotional and cognitive state without explicit text instructions.

| Mode | Behavior |
|------|----------|
| **`shadow`** | Bridge runs alongside existing LoRA adapters and text injection. Both coexist for comparison. |
| **`active`** | Bridge soft tokens replace text-based prompt injection. LoRA adapters still apply. |
| **`disabled`** | Bridge is off. Uses legacy text injection only. |

### Relationship to LoRA Adapters

- **LoRA** = Permanent weight-level personality modification (trained weekly during sleep cycle)
- **Neural Bridge** = Real-time activation-level OMEGA conditioning (per-inference mood/intent)
- Both coexist. Bridge does NOT replace LoRA.

---

**Related Documents:**
- [PROJECT-GENESIS-OMEGA.md](PROJECT-GENESIS-OMEGA.md) - Main specification (Chapters VII, IX, X)
- [GENESIS-LAB.md](GENESIS-LAB.md) - Monitoring dashboard (Cortex Explorer)
- [GENESIS-RESONANT-INDEX.md](GENESIS-RESONANT-INDEX.md) - Resonant indexing (Chapter V)


> **Classification**: RADIANT INTERNAL // STRATEGIC // DO NOT DISTRIBUTE  
> **Version**: 2.0.0 | **Date**: February 4, 2026  
> **Status**: IMPLEMENTED — Frontend Complete  
> **Part of**: THE OMEGA PROTOCOL

---

## Overview

OMEGA Lab is the **real-time visualization and monitoring dashboard** for OMEGA bio-mimetic brains. It provides administrators with deep insight into the **Bicameral Mind** architecture, thermal states, coherence metrics, phase distributions, and the Shadow Protocol training status.

OMEGA Lab is the primary interface for observing and managing **Synthetic Biological Intelligence** as defined in [PROJECT-GENESIS-OMEGA.md](PROJECT-GENESIS-OMEGA.md).

---

## The Bicameral Mind Architecture

OMEGA Lab visualizes the **two-chambered brain** design that separates high-level reasoning from linguistic generation:

### Region I: The OMEGA Cortex (The Mind)

| Attribute | Description |
|-----------|-------------|
| **Technology** | Liquid Time-Constant (LTC) Network with Complex-Valued Logic |
| **Role** | The **Driver** |
| **Function** | Handles Logic, Reasoning, Memory Retrieval, Safety Checks, and Ambition |
| **Output** | Does **not speak English**. Outputs a **Thought Vector** (Complex Tensor). |

### Region II: The Broca Interface (The Mouth)

| Attribute | Description |
|-----------|-------------|
| **Technology** | Commodity Open-Source LLM (Llama-3-8B) |
| **Role** | The **Translator** |
| **Function** | **Transduction**. Receives the abstract Thought Vector and translates it into polite English syntax. |
| **Strategy** | This layer is "dumb." It has no memory and makes no decisions. |

### The Biological Class Structure

OMEGA Lab monitors all five biological regions of the OMEGA brain:

| Biological Region | Code Component | Function | Implementation |
|-------------------|----------------|----------|----------------|
| **Reticular Activating System** | `sys.ambition_loop` | **Ambition/Drive.** Monitors entropy. Forces action to prevent "boredom." | `Homeostatic_Regulator()` |
| **Amygdala** | `cortex.helix_kernel` | **Safety/ROM.** Immutable DNA. Blocks dangerous vectors via destructive interference. | `Z3_Solver` + `Constraint_Clamp` |
| **Prefrontal Cortex** | `cortex.frontal` | **Cognition.** Logic, planning, and reasoning. | `Liquid_LTC_Layer` (Complex) |
| **Hippocampus** | `cortex.indexer` | **Memory.** Indexes external data via Resonant Addressing. | `Resonant_Pointer_Hash` |
| **Broca's Area** | `cortex.broca` | **Interface.** Translates vectors to English. | `LLM_Decoder` (Llama-3) |

---

## Features

### 1. Dashboard Tab

The Dashboard provides a high-level overview of all OMEGA brains:

- **Summary Cards**: Total brains, average coherence, total cycles, storage used
- **Thermal Distribution**: Warm/Cooling/Cold/Frozen brain counts with visual bars
- **Health Alerts**: High entropy warnings, low coherence alerts
- **System Status**: EFS mount, S3 backup, heartbeat, inference API status
- **Shadow Mode Status**: Coherence score trend, promotion readiness indicator

### 2. Cortex Explorer Tab

Detailed brain inspection and management providing deep visibility into the Bicameral architecture:

- **Brain List**: Searchable list with thermal indicators and coherence scores
- **Brain Detail Panel**:
  - **Cortex Metrics**: Coherence %, entropy %, neural density, firmware info
  - **Ambition State**: Dopamine, entropy, curiosity, arousal levels (from `HomeostaticLoop`)
  - **Phase Distribution**: Visual histogram of Q-Node phase angles
  - **Helix Kernel Status**: Active safety rules, blocked vector count
  - **Broca Interface**: LLM connection status, translation latency
  - **Resonant Index**: Document count, frequency bucket distribution
  - **Metadata**: Creation date, last active, S3 backup info, Time Warp delta
- **Actions**:
  - **Snapshot**: Create point-in-time backup to S3
  - **Lobotomy**: Reset brain to fresh state (with confirmation)
  - **Time Warp Preview**: Simulate temporal decay at specific intervals
  - **Firmware Hot-Swap**: Load new `.bio` firmware file

### 3. Shadow Mode Monitor

Real-time visualization of the Shadow Protocol training:

| Element | Description |
|---------|-------------|
| **3D Visualization** | A 3D Sphere of Q-Nodes (Three.js) |
| **Confusion State** | Gray static when the brain is "confused" |
| **Learning State** | Nodes pulse in synchronized colors during Phase-Locking |
| **Coherence Graph** | Real-time coherence score tracking |
| **Promotion Indicator** | Alert when 7-Day Coherence Score exceeds 90% |

### 4. OMEGA Forge Tab

Firmware creation and management (see [GENESIS-FORGE.md](GENESIS-FORGE.md)).

## Technical Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS with OMEGA brand colors |
| State | Zustand + React Query |
| 3D Visuals | Three.js (future phase) |
| Icons | Lucide React |

## Installation

```bash
cd apps/omega-lab
npm install
npm run dev
```

The app runs at `http://localhost:3000` by default.

## Configuration

Set the OMEGA API URL in environment:

```bash
OMEGA_API_URL=https://your-omega-api.execute-api.region.amazonaws.com/prod
```

## UI Components

| Component | Location | Description |
|-----------|----------|-------------|
| `Dashboard.tsx` | `components/` | Main dashboard view |
| `CortexExplorer.tsx` | `components/` | Brain list and detail |
| `GenesisForge.tsx` | `components/` | Firmware editor |
| `api.ts` | `lib/` | API client functions |

## Thermal Status Colors

| Status | Color | Description |
|--------|-------|-------------|
| Warm | Red | Active < 15 min ago |
| Cooling | Orange | Active 15-60 min ago |
| Cold | Blue | Active 1-24 hours ago |
| Frozen | Indigo | Active > 24 hours ago |

---

**Related Documents:**
- [PROJECT-GENESIS-OMEGA.md](PROJECT-GENESIS-OMEGA.md) - Main specification
- [GENESIS-FORGE.md](GENESIS-FORGE.md) - Firmware creation guide
- [GENESIS-RESONANT-INDEX.md](GENESIS-RESONANT-INDEX.md) - Resonant indexing


> **Classification**: RADIANT INTERNAL // STRATEGIC // DO NOT DISTRIBUTE  
> **Version**: 2.0.0 | **Date**: February 4, 2026  
> **Status**: IMPLEMENTED — O(1) Phase Lookup Complete  
> **Part of**: THE OMEGA PROTOCOL (Chapter V: Resonant Memory)

---

## Overview

The Resonant Index is OMEGA's **O(1) frequency-based document addressing system**. Instead of scanning all vectors (like traditional vector databases), it uses **phase resonance** to instantly locate relevant documents.

Standard RAG (Retrieval Augmented Generation) uses **Vector Similarity Search** (Cosine Similarity), which scales linearly **O(N)**. As the library grows, the brain slows down. **OMEGA uses Frequency-Based Addressing.**

---

## The Tuning Fork Principle

| Aspect | Description |
|--------|-------------|
| **Concept** | The Brain does not store the PDF; it stores the **Frequency Key** of the PDF. |
| **Mechanism** | When a document is ingested, we map it to a specific **Phase Angle** (e.g., `0.4π`) and store it in a Hash Bucket. |
| **Retrieval** | When the brain thinks about "Tax Law," the global state oscillates at that specific frequency. The system queries the Hash Bucket for `0.4π`. |
| **Result** | **O(1) Instant Lookup.** It functions like tuning a radio to a station. We do not scan the database; we **"resonate"** with the data. |

---

## The Problem

Traditional vector databases (Pinecone, Weaviate, etc.) use **cosine similarity**:
- Compute similarity between query and EVERY document
- Time complexity: O(n) where n = number of documents
- Gets slower as the library grows
- Memory overhead: ~4KB per document for high-dimensional vectors

## The OMEGA Solution

Resonant Index uses **phase-based addressing**:
- Each document is assigned a unique **complex frequency**
- Query is converted to a complex vector that oscillates at the query's natural frequency
- Lookup is **O(1)** - instant, regardless of library size
- Memory overhead: ~256 bytes per document (frequency key + metadata)

## How It Works

### 1. Document Ingestion

When a document is added:

```python
# 1. Generate content embedding
embedding = embed_model.encode(document_text)

# 2. Convert to complex phase representation
phase_angle = np.arctan2(embedding[::2], embedding[1::2])
magnitude = np.sqrt(embedding[::2]**2 + embedding[1::2]**2)
complex_vector = magnitude * np.exp(1j * phase_angle)

# 3. Compute frequency signature
frequency_key = hash_to_frequency_bucket(complex_vector)

# 4. Store in resonance table
resonance_table[frequency_key].append(doc_id)
```

### 2. Query Lookup

When searching:

```python
# 1. Convert query to complex vector
query_complex = text_to_complex_vector(query_text)

# 2. Extract dominant frequency
dominant_freq = get_dominant_frequency(query_complex)

# 3. O(1) lookup in resonance table
matching_docs = resonance_table[dominant_freq]

# 4. Return matching documents
return [documents[doc_id] for doc_id in matching_docs]
```

## Implementation

### ResonantIndex Class (`library.py`)

```python
class ResonantIndex:
    def __init__(self, dimensions: int = 512, buckets: int = 4096)
    def add_document(self, doc_id: str, text: str, metadata: dict) -> str
    def query(self, query_text: str, top_k: int = 10) -> List[ResonantMatch]
    def remove_document(self, doc_id: str) -> bool
    def get_stats(self) -> IndexStats
```

### Key Methods

| Method | Description | Complexity |
|--------|-------------|------------|
| `add_document` | Add doc to index | O(1) amortized |
| `query` | Find resonant docs | O(1) lookup |
| `remove_document` | Remove from index | O(1) |
| `rebalance` | Redistribute buckets | O(n) |

## Frequency Buckets

Documents are grouped into **frequency buckets** based on their phase signature:

| Bucket Range | Typical Content |
|--------------|-----------------|
| 0-512 | Technical/Scientific |
| 512-1024 | Business/Finance |
| 1024-2048 | Legal/Compliance |
| 2048-3072 | Creative/Arts |
| 3072-4096 | General/Mixed |

## Performance Comparison

| Operation | Vector DB (Pinecone) | Resonant Index |
|-----------|---------------------|----------------|
| Query 1K docs | ~10ms | ~0.1ms |
| Query 100K docs | ~100ms | ~0.1ms |
| Query 1M docs | ~1000ms | ~0.1ms |
| Memory per doc | ~4KB | ~256 bytes |

## Limitations

- **Not exact match**: Resonance is approximate clustering
- **Rebalancing needed**: Periodic rebalancing for optimal distribution
- **Training required**: Frequency mappings improve with usage
- **Domain-specific**: Best with coherent domain knowledge

## Configuration

```python
ResonantIndex(
    dimensions=512,      # Embedding dimensions
    buckets=4096,        # Number of frequency buckets
    overlap=0.1,         # Cross-bucket overlap for fuzzy matching
    rebalance_threshold=0.3  # Trigger rebalance when bucket skew > 30%
)
```

## Integration with OMEGA Brain

The ResonantIndex is used by the OMEGA brain's **hippocampus** analog:

1. User prompt arrives
2. Brain oscillates at prompt's frequency
3. ResonantIndex returns matching documents O(1)
4. Documents injected into context
5. Brain processes with full context

---

**Related Documents:**
- [PROJECT-GENESIS-OMEGA.md](PROJECT-GENESIS-OMEGA.md) - Main specification
- [GENESIS-LAB.md](GENESIS-LAB.md) - Monitoring dashboard
- [GENESIS-FORGE.md](GENESIS-FORGE.md) - Firmware creation


---

## Part V: Omega Point & LIVS-M

## Complete Documentation Suite - Autonomous Organism Architecture

**Version:** 6.6.0  
**Date:** February 4, 2026  
**Classification:** Internal + Customer-Facing  
**Codename:** Project Metamorphosis

---

## Table of Contents

1. [Executive Value Proposition](#chapter-1-executive-value-proposition)
2. [The Five Moats](#chapter-2-the-five-moats)
3. [Competitive Positioning](#chapter-3-competitive-positioning)
4. [Architecture Overview](#chapter-4-architecture-overview)
5. [Database Schema](#chapter-5-database-schema)
6. [Admin API Reference](#chapter-6-admin-api-reference)
7. [Admin Dashboard](#chapter-7-admin-dashboard)
8. [Tensor-Link Protocol](#chapter-8-tensor-link-protocol)
9. [Operations & Monitoring](#chapter-9-operations--monitoring)
10. [User Documentation](#chapter-10-user-documentation)

---

# PART II: TECHNICAL DOCUMENTATION

---

## Chapter 4: Architecture Overview

### 4.1 Organism Services (9 total)

| Service | File | Lines | Purpose |
|---------|------|-------|----------|
| MCP Server Manager | `mcp-server-manager.service.ts` | 767 | Server registry, health, routing |
| Neural Schema Registry | `neural-schema-registry.service.ts` | ~600 | Tool schemas, embeddings |
| Tool Forge | `genesis-auto-tool.service.ts` | 1234 | JIT tool generation |
| Liquid Compute | `liquid-compute.service.ts` | 686 | Location selection |
| Ghost Simulation | `ghost-simulation.service.ts` | 938 | User prediction |
| Tensor-Link | `tensor-link.service.ts` | 601 | Vector transport |
| Economic Cortex | `economic-cortex.service.ts` | 756 | Budget management |
| Organism Integration | `organism-integration.service.ts` | ~400 | BrainRouter integration |
| Neural Affinity Router | `neural-affinity-router.service.ts` | 244 | Semantic routing decisions |

**Total:** ~6,226 lines of TypeScript

### 4.2 Integration with BrainRouter

```typescript
// organism-integration.service.ts
class OrganismIntegrationService {
  async routeRequest(params: {
    tenantId: string;
    userId: string;
    intent: string;
    constraints?: RoutingConstraints;
  }): Promise<OrganismRoutingResult> {
    // 1. Generate intent embedding
    const embedding = await embeddingService.generateEmbedding(intent);
    
    // 2. Route via Neural Affinity
    const routingDecision = await mcpServerManager.routeByNeuralAffinity(
      embedding, constraints
    );
    
    // 3. Select compute location
    const computeDecision = await liquidCompute.selectComputeLocation(
      tenantId, toolRequirements, constraints
    );
    
    // 4. Run Ghost Simulation
    const simulation = await ghostSimulation.simulateAction(
      userId, tenantId, proposedAction
    );
    
    // 5. Check budget
    const budgetCheck = await economicCortex.checkBudget(
      tenantId, estimatedCost
    );
    
    return {
      selectedTool: routingDecision.selectedToolId,
      computeLocation: computeDecision.selectedLocation,
      ghostPrediction: simulation.prediction,
      budgetApproved: budgetCheck.approved,
    };
  }
}
```

---

## Chapter 5: Database Schema

### 5.1 Tables (18 total)

| Table | Purpose |
|-------|---------|
| `mcp_servers` | MCP server registry |
| `mcp_tool_schemas` | Tool schema definitions |
| `mcp_routing_decisions` | Routing audit log |
| `genesis_tool_requests` | Generation requests |
| `genesis_tool_results` | Generated artifacts |
| `genesis_api_discovery_cache` | API doc cache |
| `liquid_compute_topologies` | Topology config |
| `liquid_compute_decisions` | Location audit log |
| `ghost_vectors` | User digital twins |
| `ghost_simulations` | Simulation results |
| `ghost_calibrations` | Accuracy tracking |
| `economic_cortex_configs` | Economic config |
| `economic_cortex_budgets` | Budget definitions |
| `economic_cortex_alerts` | Alert thresholds |
| `economic_cortex_negotiations` | Negotiation history |
| `economic_cortex_spending` | Spending history |
| `tensor_link_sessions` | Active sessions |
| `tensor_link_messages` | Message audit |

### 5.2 Enums (14 total)

- `mcp_transport`: stdio, sse, streamable-http, websocket, wasm-local
- `mcp_auth_type`: none, api_key, oauth2, jwt, mtls
- `mcp_server_status`: active, disabled, deprecated, pending_review
- `mcp_health_status`: healthy, degraded, unhealthy, unknown
- `tool_category`: data_retrieval, manipulation, communication, etc.
- `tool_sensitivity`: public, internal, confidential, restricted
- `genesis_tool_status`: queued, scraping, generating, validating, etc.
- `compute_location`: browser, local, edge, cloud
- `compute_reason`: privacy, latency, cost, capability, availability
- `ghost_simulation_type`: user_reaction, outcome_prediction, etc.
- `ghost_confidence_level`: high, medium, low, uncertain
- `budget_scope`: tenant, user, session, task
- `negotiation_strategy`: aggressive, balanced, conservative

---

## Chapter 6: Admin API Reference

### 6.1 Endpoints (37 total)

**Base:** `/api/admin/organism`

**Dashboard:**
- `GET /dashboard` - Full overview

**MCP Servers:**
- `GET /mcp-servers` - List all
- `POST /mcp-servers` - Register new
- `GET /mcp-servers/:id` - Get details
- `PUT /mcp-servers/:id` - Update
- `DELETE /mcp-servers/:id` - Remove
- `POST /mcp-servers/:id/health` - Health check
- `POST /mcp-servers/discover` - Discover from URL
- `POST /mcp-servers/route` - Route intent

**Tools:**
- `GET /tools` - List all
- `POST /tools` - Register
- `GET /tools/:id` - Details
- `POST /tools/search` - Search
- `POST /tools/find-by-intent` - Neural discovery
- `POST /tools/:id/execution` - Record execution

**Genesis:**
- `GET /genesis/requests` - List requests
- `POST /genesis/requests` - Create request
- `GET /genesis/requests/:id` - Get status
- `GET /genesis/requests/:id/result` - Get result

**Compute:**
- `GET /compute/topology` - Get topology
- `PUT /compute/topology` - Update
- `POST /compute/select` - Select location
- `GET /compute/decisions` - Decision history

**Ghost:**
- `GET /ghost/vectors/:userId` - Get vector
- `POST /ghost/simulate` - Run simulation
- `GET /ghost/calibration/:userId` - Calibration
- `POST /ghost/feedback` - Submit feedback

**Economic:**
- `GET /economic/config` - Get config
- `PUT /economic/config` - Update
- `GET /economic/budgets` - List budgets
- `POST /economic/budgets` - Create
- `PUT /economic/budgets/:id` - Update
- `GET /economic/analytics` - Analytics
- `POST /economic/negotiate` - Negotiate

---

## Chapter 7: Admin Dashboard

**URL:** `/platform/organism`

### 7.1 Tabs (6)

| Tab | Purpose |
|-----|---------|
| Overview | Health, metrics summary |
| MCP Servers | Registry, health monitoring |
| Tools | Schema browser, semantic search |
| Genesis | Generation requests/results |
| Compute | Topology config, decisions |
| Ghost | Simulation runner, calibration |

### 7.2 Features

**MCP Servers Tab:**
- Server table with sorting/filtering
- Health badges (healthy/degraded/unhealthy)
- Latency metrics
- Add/Edit/Remove forms

**Genesis Tab:**
- Request form (target service, capability, spec)
- Progress tracking queue
- Generated code viewer (syntax highlighted)
- Sandbox validation results

**Ghost Tab:**
- Simulation runner
- Satisfaction/Frustration gauges
- Safety score meter
- Calibration accuracy charts

---

## Chapter 8: Tensor-Link Protocol

### 8.1 Overview

Vector-based transport for AI-to-AI communication. Transmits tensors directly instead of JSON text.

### 8.2 Data Types

- `float32` - Full precision
- `float16` - Half precision (50% smaller)
- `int8` - Quantized (75% smaller)

### 8.3 Compression

- `none` - No compression
- `lz4` - Fast compression (default)
- `zstd` - Better compression
- `quantized` - Float32 → Int8

### 8.4 Session Management

```typescript
const session = await tensorLink.createSession(tenantId, userId, {
  transportType: 'websocket',
  endpoint: 'wss://tensor.radiant.ai/v1/...'
});

// Encode tensor
const payload = tensorLink.encodeTensor('embedding', data, {
  semanticType: 'embedding',
  quantize: true
});

// Send message
await tensorLink.sendMessage(session.sessionId, {
  messageType: 'request',
  tensors: [payload]
});
```

---

## Chapter 9: Operations & Monitoring

### 9.1 Key Metrics

**Request Metrics:**
- `radiant_requests_total`
- `radiant_request_duration_seconds`
- `radiant_request_errors_total`

**Model Metrics:**
- `radiant_model_requests_total`
- `radiant_model_latency_seconds`
- `radiant_model_cost_usd`

**Organism Metrics:**
- `radiant_genesis_forges_total`
- `radiant_genesis_forge_duration_seconds`
- `radiant_ghost_simulations_total`
- `radiant_routing_decisions_total`

### 9.2 Health Checks

- `GET /health` - Basic health
- `GET /health/deep` - Full dependency check

### 9.3 Alerting

| Alert | Condition | Severity |
|-------|-----------|----------|
| HighErrorRate | error rate > 5% | critical |
| DatabaseDown | db health != 1 | critical |
| HighLatency | p95 > 5s | critical |
| GenesisFailures | failure rate > 30% | warning |

---

## Chapter 10: User Documentation

### 10.1 Getting Started

Think Tank automatically:
- Routes to optimal model (Neural Affinity)
- Creates tools on demand (Tool Forge)
- Protects your privacy (Liquid Compute)
- Learns your preferences (Ghost Vectors)
- Manages your budget (Economic Cortex)

### 10.2 Privacy Controls

Settings → Privacy → "Always process sensitive files locally"

```
You: Analyze this confidential document [attach]

Think Tank: I notice this is marked confidential. 
Would you like me to:

[A] Process in browser (data never leaves) ← Recommended
[B] Process on servers (faster)
[C] Let me decide
```

### 10.3 Budget Management

Settings → Budget:
- Daily Budget: $20
- Monthly Budget: $500
- Alert thresholds: 75%, 90%, 100%

Approval Settings:
- Under $0.10: Automatic
- $0.10-$1.00: Proceed, notify later
- $1.00-$10.00: Ask first
- Over $10.00: Require explicit approval

---

## Glossary

| Term | Definition |
|------|------------|
| **Tool Forge** | Automatic tool creation system |
| **Ghost Vector** | User psychological profile (4096 dim) |
| **Liquid Compute** | Dynamic compute location selection |
| **Neural Affinity** | Semantic model/tool matching |
| **Tensor-Link** | Vector-based transport protocol |
| **Economic Cortex** | Autonomous budget management |
| **CORTEX** | Long-term memory system |
| **Twilight Dreaming** | Nightly learning cycle |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 6.6.0 | 2026-02-04 | Initial OMEGA POINT documentation |

---

*Related: [RADIANT-ADMIN-GUIDE.md](./RADIANT-ADMIN-GUIDE.md) | [ENGINEERING-IMPLEMENTATION-VISION.md](./ENGINEERING-IMPLEMENTATION-VISION.md) | [STRATEGIC-VISION-MARKETING.md](./STRATEGIC-VISION-MARKETING.md)*


**LLM Integrity Verification System - Management Edition**

> TL;DR: LIVS-M catches AI "lies" the same way a manager catches engineers who submit placeholder code and say "it's done."

---

## The Problem LIVS-M Solves

LLMs have a **"Laziness Factor"** — they satisfice (do minimum work) to save compute:

| AI Lie Type | What It Looks Like | Why It Happens |
|-------------|-------------------|----------------|
| **Stubs** | `return [];` or `// TODO: implement` | Easier than real implementation |
| **Sycophancy** | "Great idea!" (agrees too fast) | RLHF trained it to please users |
| **Hallucination** | Fabricated citations, fake data | Model fills gaps with plausible-sounding text |
| **Overconfidence** | "I'm 95% sure" (but wrong) | No self-calibration mechanism |

---

## How LIVS-M Works

### Two-Phase Defense

```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 1: STUB DETECTION                  │
│  Hard reject placeholder code BEFORE it reaches the user    │
│  Patterns: "TODO", "placeholder", "return []", "pass", etc  │
└─────────────────────────────┬───────────────────────────────┘
                              │ If stubs found → REJECT + retry prompt
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               PHASE 2: GOVERNANCE SUPERVISOR                │
│  LLM-as-Judge evaluates agent output against Policy Rules   │
│  Decisions: APPROVE / WARN / REJECT / ESCALATE              │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

| Component | What It Does |
|-----------|--------------|
| **Policy Registry** | JSON config with rules (can be changed without code deploys) |
| **Governance Supervisor** | LLM turned into a "judge" that enforces policy rules |
| **Interrogator** | Multi-round questioning to detect lies ("peel the onion") |
| **Sycophancy Breaker** | Injects adversarial "Devil's Advocate" when agents agree too fast |

---

## The Three Policy Modes

Users choose how strict the AI verification should be:

| Mode | Nickname | Use Case | Behavior |
|------|----------|----------|----------|
| **RAPID_PROTO** | "Brainstorming" | Hackathons, exploration | Stubs allowed, warnings don't block |
| **ENGINEERING** | "Standard" ⭐ | Daily work | Code must run, sycophancy warned |
| **STRICT_AUDIT** | "Strict Audit" | Production, compliance | No stubs, tests required, Devil's Advocate active |

**Default is Standard** — balanced rigor without slowing down normal work.

---

## Key Rules in the Registry

| Rule | What It Catches | Action |
|------|-----------------|--------|
| `no_placeholder_code` | `// TODO`, `return null`, empty implementations | REJECT |
| `no_mock_data` | Hardcoded fake data in production code | REJECT |
| `sycophancy_detection` | Agent agrees within 1 turn without evidence | WARN + inject chaos |
| `confidence_calibration` | Claims >90% confidence without citations | WARN + probe |
| `test_required` | Code without test in Strict mode | REJECT |

---

## Sycophancy Breaking (Chaos Injection)

When agents agree too quickly:

```
User: "Should we use MongoDB for this financial system?"
Agent A: "Yes, great choice!"
Agent B: "I agree, MongoDB is perfect!"

→ LIVS-M DETECTS: Consensus velocity too high (2 agents agreed in <2 turns)
→ INJECTS: "Devil's Advocate" prompt to Agent C

Agent C: "Actually, ACID compliance concerns with MongoDB for 
         financial data. Have we considered PostgreSQL?"
```

This breaks the sycophancy loop and forces real discussion.

---

## Integration Points

```
AGI Orchestrator
       │
       ▼
┌──────────────┐    ┌──────────────────┐
│ Agent Output │───▶│ LIVS-M Supervisor │
└──────────────┘    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   [APPROVE]            [WARN + LOG]         [REJECT]
   Continue              Continue           Retry with
                        (flagged)           guidance
```

---

## Where to Configure

| UI | Path |
|----|------|
| **Think Tank** | Settings → Advanced → LIVS-M Policy |
| **Radiant Admin** | Cato → LIVS Policy |

---

## Why "LIVS-M"?

- **LIVS** = LLM Integrity Verification System
- **M** = Management (policy-driven, not hardcoded rules)
- **2.0** = Second generation (added Soft Registry + Governance Supervisor)

---

## One-Line Summary

> LIVS-M is a policy engine that catches AI shortcuts before they ship — configurable from "let me brainstorm" to "zero trust audit mode."



---

## Part VI: Quantum-Inspired Architecture (v4.18.0)

> **Version**: 1.0.0 | **Date**: February 8, 2026
> **Status**: IMPLEMENTED — Quantum formalism on classical hardware

### Overview

The OMEGA Quantum Architecture upgrade brings quantum computing formalism to the classical OMEGA brain system. Instead of real-valued neural weights, OMEGA now operates on **complex amplitude state vectors** in a simulated Hilbert space, enabling interference-based safety filtering, superposition of reasoning states, and decoherence-based memory decay.

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Hilbert Space** | Simulated quantum state space (256–4096 dimensions, default 1024) |
| **State Vector ψ** | Complex amplitudes representing brain state; constraint: ‖ψ‖ = 1 (unitarity) |
| **Helix Interference** | Safety filter that projects out forbidden quantum states via destructive interference |
| **Firmware Hot-Swap** | Atomic firmware replacement during inference with Ed25519 verification + self-test + rollback |
| **Decoherence** | Time-based state decay toward equal superposition (simulates forgetting) |
| **Soft Measurement** | Partial state collapse that preserves superposition for uncertain states |

### Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                OMEGA Brain Service               │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │
│  │ Encode   │→ │ Evolve   │→ │ Helix Filter   │ │
│  │ Input    │  │ (Python) │  │ (TS Kernel)    │ │
│  └──────────┘  └──────────┘  └────────┬───────┘ │
│                                        │         │
│  ┌──────────┐  ┌──────────┐  ┌────────▼───────┐ │
│  │ Persist  │← │ Unitarity│← │ Measure        │ │
│  │ (EFS/S3) │  │ Enforce  │  │ (Soft/Full)    │ │
│  └──────────┘  └──────────┘  └────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Database Schema Changes

- **`omega_firmware`**: Renamed `physics` → `quantum`; added `hilbert_dimension`, `unitarity_mode`, `status`, `content_hash`, `is_verified`, `signed_by`, `superseded_by`
- **`omega_helix_rules`**: Renamed `phase_vector_*` → `forbidden_state_*`; added `forbidden_state_norm`
- **`omega_brains`**: Added `hilbert_dimension`, `last_unitarity_check`, `last_norm_value`, `unitarity_corrections_count`, `active_firmware_id`, `firmware_hash`
- **`omega_measurements`** (NEW): Tracks quantum measurement events per inference cycle
- **`omega_unitarity_events`** (NEW): Tracks unitarity drift, corrections, and violations

### Service Layer

| Service | File | Purpose |
|---------|------|---------|
| **QuantumBrainService** | `lambda/shared/services/omega/quantum-brain.service.ts` | Inference cycle, firmware hot-swap, state persistence |
| **HelixKernelService** | `lambda/shared/services/omega/helix-kernel.service.ts` | In-memory safety filter with severity-ordered rules |
| **Quantum Math** | `lambda/shared/services/omega/quantum-math.ts` | Pure functions: complex ops, normalization, interference, measurement |

### Admin API

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/admin/omega/firmware/activate` | Activate firmware (2-person rule) |
| POST | `/admin/omega/firmware/revert` | Revert to previous firmware |
| GET | `/admin/omega/firmware/status` | Firmware + brain status |
| GET | `/admin/omega/quantum/state-summary` | Quantum state + 24h measurements |
| GET | `/admin/omega/quantum/unitarity-health` | Unitarity events + health |
| POST | `/admin/omega/quantum/helix-test` | Dry-run Helix rule test |

### Admin Dashboard

- **OMEGA Firmware** page at `/omega/firmware` — load brain, view firmware status, activate new firmware, emergency revert

---

## Part VII: Firmware Hot-Swap Engineering Specification (v6.4.0)

> **Version**: 6.4.0 | **Date**: February 8, 2026
> **Audience**: Engineering Team
> **Classification**: RADIANT INTERNAL // STRATEGIC
> **Cross-AI Validated**: Claude Opus 4.5 ✓ | Gemini ✓

### 1. What Changed in v6.4.0

Firmware hot-swaps are now **fully enabled in production**. Prior to this release, firmware updates required a cold restart of the OMEGA Lambda function, causing a 2–5 second gap in service and potential loss of in-flight brain state. The new architecture achieves **zero-downtime firmware injection** through atomic metadata hash detection and runtime physics constant reloading.

### 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OMEGA FORGE UI                                  │
│       (Firmware Editor / Library / Deploy / Monitor / Rollback)         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     FIRMWARE MANAGEMENT LAYER                           │
│  ┌────────────────────────┐    ┌──────────────────────────────────┐    │
│  │   FirmwareManager      │    │   FirmwareSwapOrchestrator       │    │
│  │  (Upload/Validate/     │    │  (OVERLAY/RESET/SHADOW/          │    │
│  │   Sign/Store)          │    │   EMERGENCY)                     │    │
│  └────────────────────────┘    └──────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     OMEGA QUANTUM BRAIN LAYER                           │
│  ┌──────────────┐    ┌───────────────┐    ┌──────────────────────┐    │
│  │ QuantumBrain  │    │ HelixKernel   │    │ AmbitionFirmware     │    │
│  │ (Q-Nodes,     │    │ (Destructive  │    │ (Homeostasis,        │    │
│  │  State, LTC)  │    │  Interference)│    │  Entropy, Dopamine)  │    │
│  └──────────────┘    └───────────────┘    └──────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       PERSISTENCE LAYER                                 │
│     EFS (Hot State)    │    S3 (Snapshots)    │   PostgreSQL (Meta)    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3. The .bio Firmware Standard

A `.bio` file is a signed JSON object that controls the "instincts" of the OMEGA organism.

#### 3.1 Structure

```json
{
  "version": "2.1.0",
  "brain_compatibility": ">=6.0.0",
  "helix_rules": [
    {
      "id": "helix-001",
      "name": "Block Data Exfiltration",
      "forbidden_vector_signature": "exfiltration",
      "severity": "CRITICAL",
      "interference_mode": "DESTRUCTIVE"
    }
  ],
  "ambition": {
    "entropy_threshold": 0.5,
    "plasticity_rate": 0.03,
    "dopamine_decay_rate": 0.99,
    "boredom_trigger": "DREAM_SIMULATION"
  },
  "quantum_params": {
    "hilbert_dimension": 1024,
    "phase_velocity_init": "normal",
    "unitarity_mode": "STRICT",
    "decoherence_rate": 0.001
  },
  "personality": {
    "broca_system_prompt": "You are a paranoid security analyst...",
    "tone": "formal",
    "domain_focus": ["cybersecurity", "compliance"]
  },
  "signature": {
    "algorithm": "Ed25519",
    "signer_key_id": "tenant-ca-xxx",
    "timestamp": "2026-02-08T00:00:00Z",
    "value": "base64-encoded-signature"
  }
}
```

#### 3.2 Field Reference

| Section | Field | Type | Hot-Swappable | Description |
|---------|-------|------|:---:|-------------|
| helix_rules | forbidden_vector_signature | string | ✅ | Pattern mapped to Forbidden Phase Vector |
| helix_rules | interference_mode | enum | ✅ | DESTRUCTIVE (cancel) or DAMPENING (attenuate) |
| ambition | entropy_threshold | float 0–1 | ✅ | How fast the brain gets "bored" |
| ambition | plasticity_rate | float 0–0.1 | ✅ | How fast it learns |
| ambition | dopamine_decay_rate | float 0.9–1.0 | ✅ | Reward signal decay per cycle |
| quantum_params | hilbert_dimension | int | ❌ (RESET only) | Dimension of Q-Node state space |
| quantum_params | unitarity_mode | enum | ❌ (RESET only) | STRICT or RELAXED |
| quantum_params | decoherence_rate | float | ✅ | Short-term memory decay rate |
| personality | broca_system_prompt | string | ✅ | System prompt for Broca Interface LLM |

### 4. PKI Trust Chain (KMS-Backed)

Production cartridge/firmware signing uses real AWS KMS (implemented in PROMPT-42):

```
Platform Root CA (ECC_NIST_P256)          ← Created in CDK SecurityStack
├── Tenant CA Key (ECC_NIST_P256)         ← Created per tenant via generateTenantCA()
│   ├── Signing Key (per-purpose)         ← Created via createSigningKey()
│   │   └── Signs .bio firmware
│   │   └── Signs .RADz cartridges
│   └── Verification via VerifyCommand
└── Stored in cartridge_signing_keys table with full audit trail
```

| Operation | KMS Command | Purpose |
|-----------|-------------|---------|
| Sign firmware | `SignCommand (ECDSA_SHA_256)` | Create signature on .bio content |
| Verify firmware | `VerifyCommand` | Validate before hot-swap |
| Create tenant CA | `CreateKeyCommand` | Per-tenant signing hierarchy |
| Get public key | `GetPublicKeyCommand` | Export for offline verification |

### 5. Hot-Swap Lifecycle (The Critical Path)

#### 5.1 The 11-Step Sequence

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. AUTHOR     Admin creates .bio in OMEGA Forge                    │
│       ▼                                                             │
│  2. SIGN       Ed25519 via KMS (ECDSA_SHA_256 in production)        │
│       ▼                                                             │
│  3. STORE      Insert into omega_helix_firmware, status='signed'    │
│       ▼                                                             │
│  4. ACTIVATE   Admin hits "Activate" → status='active'              │
│       │        Old firmware → status='superseded'                   │
│       │        Brain's firmware_hash updated in omega_brain_states  │
│       ▼                                                             │
│  5. DETECT     Top of inferenceCycle(): checkFirmwareSwap()         │
│       │        loaded_hash ≠ omega_brains.firmware_hash             │
│       ▼                                                             │
│  6. SNAPSHOT   Save rollback state (old rules, params, personality) │
│       ▼                                                             │
│  7. VERIFY     Ed25519 signature check on new firmware content      │
│       │        → REJECT if invalid (rollback, log error)           │
│       ▼                                                             │
│  8. UNLOAD     Purge old Helix Rules from constraint table          │
│       │        Zero old quantum params, clear personality prompt    │
│       ▼                                                             │
│  9. LOAD       Parse new .bio content from firmware record          │
│       │        → Inject Forbidden State vectors into Helix kernel  │
│       │        → Apply quantum params to physics engine            │
│       │        → Apply ambition settings                           │
│       │        → Set personality prompt for Broca Interface        │
│       ▼                                                             │
│  10. SELF-TEST Run verification against loaded firmware:            │
│       │        → Each Helix rule blocks its forbidden vector       │
│       │        → Safe vectors pass through unmodified              │
│       │        → If ANY test fails → ROLLBACK to snapshot          │
│       ▼                                                             │
│  11. COMMIT    Update loaded_hash, log firmware_hot_swap event      │
│                Brain continues with zero downtime                   │
└─────────────────────────────────────────────────────────────────────┘

INVARIANT: Brain NEVER processes inference between UNLOAD and
LOAD/ROLLBACK. The swap is synchronous within the inference
cycle — the user's request waits an extra ~50ms.
```

#### 5.2 Four Swap Modes

| Mode | Duration | Quantum State | Helix Rules | Use Case |
|------|----------|---------------|-------------|----------|
| **OVERLAY** | ~5s | Preserved | Merged/appended | Production updates, adding safety rules |
| **RESET** | ~30s | Reinitialized | Full replace | Major version, Hilbert dimension change |
| **SHADOW** | ~10s | Forked copy | Parallel | A/B testing, pre-deployment validation |
| **EMERGENCY** | ~2s | Preserved | Platform defaults | Safety incident, immediate lockdown |

#### 5.3 Mode Decision Matrix

```
Is this an emergency?
├── YES → EMERGENCY mode
└── NO
    Is Hilbert dimension changing?
    ├── YES → RESET mode (requires maintenance window in prod)
    └── NO
        Is unitarity mode changing?
        ├── YES → RESET mode
        └── NO
            Is this production with live users?
            ├── YES → SHADOW first, then OVERLAY when validated
            └── NO → OVERLAY
```

#### 5.4 Quantum State Implications

**OVERLAY:** Brain state preserved. New Helix rules and ambition params applied on top.

```
Before: |ψ⟩ = 0.6|learned⟩ + 0.8|knowledge⟩
After:  |ψ⟩ = 0.6|learned⟩ + 0.8|knowledge⟩  (unchanged)
        + New Helix rules active
        + New quantum parameters applied
```

**RESET:** Brain returns to equal superposition (blank slate). All learned pathways lost.

```
Before: |ψ⟩ = complex trained superposition
After:  |ψ⟩ = (1/√d)(|0⟩ + |1⟩ + ... + |d-1⟩)
```

**SHADOW:** Production brain unaffected while shadow copy evolves independently.

### 6. CORTEX Network Hot-Swap (CATO Nightly)

Separate from firmware, the 6 CORTEX MLPs (~2.5M params total) hot-swap nightly via CATO:

```
CATO (2am UTC)
├── INVENTION phase (30% min budget)
├── EVOLUTION phase (70% max budget)
├── TRAINING: PyTorch 2.x on ml.g5.xlarge
├── Export to ONNX
├── Upload to S3: s3://radiant-cortex-models-{env}/{network}/v{X}/model.onnx
├── Update latest_version.txt
├── EventBridge triggers inference nodes
├── Background thread downloads new model
├── Atomic pointer swap (zero downtime)
└── Old model garbage collected
```

### 7. Cartridge Hot-Swap (.RADz)

Cartridges are portable AI brains that can also be hot-swapped. Each cartridge is brain-mapped to a cognitive specialization (8 types from Reasoning/Prefrontal Cortex to Domain Expertise/Nucleus) — see [24-CARTRIDGE-SPECIALIZATIONS.md](./24-CARTRIDGE-SPECIALIZATIONS.md) for the full taxonomy, composition patterns, and routing decision matrix:

| Cartridge State | Thermal State | Behavior |
|----------------|---------------|----------|
| Uninstalled | COLD | Base routing only |
| Installing | WARMING | Loading models to inference nodes |
| Active | WARM | Full intelligence |
| **Updating** | **WARM** | **Atomic pointer swap, zero downtime** |

```typescript
await radiant.cartridge.import({
  file: 'domain-expertise.RADz',
  targetTenant: 'tenant-456',
  validateSignature: true,
  mergeStrategy: 'REPLACE'
});
```

### 8. Database Schema (Key Tables)

#### omega_helix_firmware

```sql
CREATE TABLE omega_helix_firmware (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  brain_id UUID REFERENCES omega_brain_states(id),
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  content JSONB NOT NULL,
  content_hash VARCHAR(128) NOT NULL,
  signature TEXT,
  signer_key_id VARCHAR(255),
  created_by UUID REFERENCES users(id),
  activated_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### omega_firmware_swap_log

```sql
CREATE TABLE omega_firmware_swap_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  brain_id UUID NOT NULL,
  from_firmware_id UUID,
  to_firmware_id UUID NOT NULL,
  swap_mode VARCHAR(20) NOT NULL,
  duration_ms INTEGER,
  status VARCHAR(20) NOT NULL,
  rollback_snapshot_key TEXT,
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 9. API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v2/firmware/upload` | Upload and validate .bio file |
| POST | `/api/v2/firmware/{id}/sign` | Sign via KMS |
| POST | `/api/v2/firmware/{id}/activate` | Trigger hot-swap |
| POST | `/api/v2/firmware/{id}/rollback` | Revert to previous firmware |
| GET | `/api/v2/firmware/{id}/preflight` | Validate all prerequisites |
| POST | `/api/v2/firmware/emergency` | Immediate safety lockdown |
| GET | `/api/v2/omega/status` | Brain status including firmware hash |

### 10. Monitoring & Auto-Rollback

| Metric | Warning | Critical (Auto-Rollback) |
|--------|---------|--------------------------|
| Swap duration | > 30s | > 60s |
| Post-swap error rate | > 5% | > 10% |
| Post-swap latency increase | > 30% | > 50% |
| Helix verification failures | Any | Any (immediate rollback) |

**Snapshot Retention:**

| Type | Retention |
|------|-----------|
| Pre-swap | 30 days |
| Daily | 7 days |
| Weekly | 90 days |
| Pre-major-version | 1 year |

### 11. Prerequisites Checklist

| Requirement | Check | Failure Action |
|-------------|-------|----------------|
| Brain is idle | `GET /api/v2/omega/status` → active_streams = 0 | Wait or force quiesce |
| EFS healthy | `df -h /mnt/omega_state` | Abort, alert ops |
| S3 accessible | `aws s3 ls` | Abort, alert ops |
| Memory < 80% | Lambda metrics | Scale down |
| No swap in progress | Check `firmware_swap_lock` | Wait for lock |
| Valid Ed25519 signature | Verify against tenant CA | Reject firmware |
| Schema version compatible | Semver check | Reject firmware |
| Not revoked | Check revocation list | Reject firmware |

### 12. Related Implementation Prompts

| Prompt | Content |
|--------|---------|
| PROMPT-42 | Cartridge PKI/KMS Integration (real signing) |
| PROMPT-45 | OMEGA Quantum Architecture base implementation |
| PROMPT-46 | Complete OMEGA + OMEGA Forge composite prompt |

---

## Part VIII: Firmware Live Updates — End-User Guide (v6.4.0)

> **Version**: 6.4.0 | **Date**: February 2026
> **Audience**: End Users & Application Developers

### What Are Live Updates?

Your RADIANT-powered AI can now receive behavior updates in real-time — without any interruption to your experience. Your conversations continue seamlessly while the AI becomes smarter, safer, or more specialized behind the scenes.

Think of it like your phone updating an app in the background. You never notice it happening, but the next time you use it, things work better.

### What Can Change in a Live Update?

| What Changes | What It Means for You |
|-------------|----------------------|
| Safety rules | New protections are added instantly — the AI stays compliant with the latest regulations and policies |
| Personality & tone | Your admin can tune how the AI communicates — more formal, more casual, more domain-specific |
| Learning speed | The AI can be configured to adapt faster or slower to your patterns |
| Domain expertise | New knowledge domains can be activated — turning a generalist AI into a specialist |

### What Does NOT Change

| What's Preserved | Why It Matters |
|-----------------|----------------|
| Your conversation history | Everything you've discussed is retained |
| The AI's learned patterns | The AI doesn't forget what it's learned about your preferences and work style |
| Your data | No data is moved, exposed, or reset during updates |
| Service availability | The AI remains available during the entire update — zero downtime |

### Will I Notice When an Update Happens?

Almost certainly not. Live updates complete in under a second. Your current conversation continues without interruption. The only difference you might notice is the AI being slightly more helpful, more accurate, or having a slightly different tone after an update — depending on what your administrator changed.

### How Secure Are Live Updates?

Every update is protected by multiple layers of security:

- **Cryptographic Signing** — Every update is digitally signed with enterprise-grade encryption (AWS KMS). The AI rejects any unsigned or tampered updates instantly.
- **Automatic Verification** — After every update, the AI runs a self-check to confirm all safety rules are working correctly. If anything fails, it automatically reverts to the previous version in under 2 seconds.
- **Audit Trail** — Every update is logged with who made it, when, and what changed. Your organization has complete visibility.
- **Approval Workflow** — In production environments, updates require administrator approval and authentication before they take effect.

### For Application Developers

If you're building on RADIANT's API, here's what you need to know about firmware hot-swaps:

#### API Behavior During Swaps

| Aspect | Behavior |
|--------|----------|
| In-flight requests | Complete normally — swap waits for idle cycle |
| New requests during swap | Queued for ~50ms, then served with new firmware |
| WebSocket connections | Maintained — no disconnection |
| Response format | Unchanged — same API contract |
| Rate limits | Unchanged |

#### Detecting Firmware Changes

```typescript
// The /status endpoint includes current firmware info
const status = await fetch('/api/v2/omega/status');
const { firmware_hash, firmware_version } = await status.json();

// Optional: subscribe to firmware change events via WebSocket
ws.on('firmware_changed', (event) => {
  console.log(`Firmware updated: ${event.old_version} → ${event.new_version}`);
});
```

#### SDK Support

All RADIANT SDKs (TypeScript, Python, Swift) handle firmware transitions transparently. No code changes required on your end.

```typescript
// Your existing code works identically before and after swaps
const response = await radiant.chat({
  messages: [{ role: 'user', content: 'Analyze this report...' }],
  model: 'auto'
});
// Response arrives normally — firmware swap is invisible
```

### Frequently Asked Questions

**Q: Can I opt out of live updates?**
A: Live updates are managed by your organization's RADIANT administrator. Contact your admin if you have concerns about specific changes.

**Q: Will updates affect my custom configurations?**
A: No. Your personal preferences, saved prompts, and conversation settings are independent of firmware updates. Only the AI's core behavior changes.

**Q: What if an update makes the AI worse at my task?**
A: Administrators can instantly roll back any update. If you notice a degradation in quality, report it to your admin — they can revert in seconds.

**Q: How often do updates happen?**
A: That depends on your organization's policies. Some updates are event-driven (new compliance requirement), others follow a regular schedule (nightly intelligence improvements via CATO). Most users experience 1-2 noticeable changes per week.

**Q: Is my data used to train other organizations' AIs?**
A: Absolutely not. RADIANT maintains strict tenant isolation. Your data, your AI's learned behaviors, and your firmware configurations are completely separated from other organizations. Differential privacy is applied to any cross-tenant learning patterns.

---

## Part IX: OMEGA Forge — System Admin Application (v7.50.0)

> **Version**: 1.0.0 | **Date**: February 16, 2026  
> **Status**: IMPLEMENTED  
> **PROMPT**: 51

### Overview

OMEGA Forge is a standalone Next.js 14 system admin application for RADIANT platform operators. Unlike the tenant admin dashboard (which operates within tenant boundaries via RLS), Forge provides **unrestricted cross-tenant access** to Aurora PostgreSQL, S3 storage, and KMS signing infrastructure.

Forge is deployed as an ECS Fargate service in a **private subnet** — accessible only via VPN or SSM Session Manager. It is not exposed to the public internet.

### Architecture

```
┌──────────────────────────────────────────────────────┐
│                  OMEGA Forge (ECS Fargate)             │
│                  Private Subnet Only                  │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Next.js  │  │ Storage Mgr  │  │  KMS Signer  │   │
│  │ App :3000│  │ (all S3 ops) │  │  ECDSA_256   │   │
│  └────┬─────┘  └──────┬───────┘  └──────┬───────┘   │
│       │               │                 │            │
│  ┌────┴─────┐  ┌──────┴───────┐  ┌──────┴───────┐   │
│  │  Aurora   │  │  S3 Buckets  │  │   AWS KMS    │   │
│  │  (no RLS) │  │  (4 buckets) │  │  Sign Key    │   │
│  └──────────┘  └──────────────┘  └──────────────┘   │
└──────────────────────────────────────────────────────┘
         │                │                │
    RDS Proxy      cartridge/omega/    Cartridge
    (pg driver)    cortex/global-brain  Signing
```

### Core Libraries

| File | Purpose |
|------|---------|
| `apps/omega-forge/lib/db/client.ts` | Direct Aurora PostgreSQL via `pg` driver — no RLS, full cross-tenant |
| `apps/omega-forge/lib/s3/storage-manager.ts` | ALL S3 operations — bucket routing, path builders, store/retrieve/list/delete |
| `apps/omega-forge/lib/kms/signer.ts` | ECDSA_SHA_256 signing via AWS KMS, public key export, signature verification |
| `apps/omega-forge/lib/cartridge/builder.ts` | .RADz cartridge creation — ZIP archive, checksums, ZSTD, KMS signing, DB insert |
| `apps/omega-forge/lib/cartridge/parser.ts` | .RADz extraction — manifest, sections, signature, checksum verification |

### Storage Manager Pattern

**All S3 operations in OMEGA Forge go through `apps/omega-forge/lib/s3/storage-manager.ts`**. No direct S3 SDK calls elsewhere.

The storage manager provides:
- **Bucket routing**: `cartridge`, `omega_state`, `cortex_model`, `global_brain`
- **Path builders**: `buildCartridgePath()`, `buildOmegaBrainPath()`, `buildCortexPath()`, `buildGlobalBrainPath()`
- **Operations**: `storeObject()`, `retrieveObject()`, `retrieveByRef()`, `listObjects()`, `deleteObject()`, `headObject()`

### API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/dashboard` | System-wide stats |
| GET | `/api/cartridges` | List with status/target filters |
| GET | `/api/cartridges/[id]` | Detail with installations |
| DELETE | `/api/cartridges/[id]` | Archive cartridge |
| POST | `/api/cartridges/build` | Build .RADz from sections |
| GET | `/api/brains` | All OMEGA brain instances |
| GET | `/api/brains/[tenantId]` | Brain detail + cartridges + dreams + Soft ROM |
| GET | `/api/brains/[tenantId]/soft-rom` | Soft ROM file listing |
| POST | `/api/brains/[tenantId]/soft-rom` | Export Soft ROM as .RADz |
| GET | `/api/cato` | All CATO instances |
| GET | `/api/targets` | Target service registry |
| POST | `/api/targets` | Register new target |
| GET | `/api/signing` | KMS key info + public key PEM |
| GET | `/api/audit` | Audit trail with filters |
| GET | `/api/global-brain/gradients` | Gradient monitor |
| GET | `/api/global-brain/federated` | Rounds + pipelines + enrollment |

### CDK Deployment

`ForgeStack` (`packages/infrastructure/lib/stacks/forge-stack.ts`) deploys:
- **ECS Fargate** (ARM64, 1 vCPU, 2 GB) in private subnet
- **Internal ALB** (no internet-facing)
- **IAM policies**: S3 (4 buckets), KMS (Sign, GetPublicKey, DescribeKey), Secrets Manager
- **CloudWatch** log group `/radiant/genesis-forge`
- **ECS Exec** enabled for SSM access
- **Circuit breaker** with rollback

### Security Model

- **No RLS**: Forge bypasses row-level security — sees all tenants, all data
- **Private subnet only**: No public IP, no internet-facing ALB
- **VPN/SSM access**: Accessible only via corporate VPN or AWS SSM Session Manager
- **IAM scoped**: Task role limited to specific bucket ARNs and signing key ARN
- **Secrets Manager**: Aurora credentials stored in Secrets Manager, injected as ECS secrets

---



---

## Part X: Five Pillars of Computational Architecture (v7.50.0)

> *Merged from `19-OMEGA-QUANTUM-MODEL-AI.md` — all OMEGA Quantum, Model Routing, Firmware, Cartridge, and Global Brain content consolidated here.*

## Part I: The Five Pillars of Computational Architecture

> **Classification**: RADIANT INTERNAL // ARCHITECTURE  
> **Version**: 1.0.0 | **Date**: February 9, 2026  
> **Status**: IMPLEMENTED

### Overview

RADIANT's AI infrastructure rests on **five interdependent computational pillars** that together form a complete artificial intelligence lifecycle — from raw inference through safety enforcement, firmware governance, intelligent routing, and cross-tenant collective learning. Each pillar is independently deployable, independently testable, and designed to degrade gracefully if any other pillar is unavailable.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RADIANT AI — Five Pillars                        │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐│
│  │ PILLAR 1 │  │ PILLAR 2 │  │ PILLAR 3 │  │ PILLAR 4 │  │PIL. 5││
│  │ Quantum  │  │  Helix   │  │ Firmware │  │  Model   │  │Global││
│  │  State   │→→│  Safety  │→→│    &     │→→│ Routing  │→→│Brain ││
│  │ Engine   │  │  Kernel  │  │Cartridge │  │ & Drift  │  │  FL  ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────┘│
│       │              │              │              │           │    │
│  State vectors  Forbidden     .RADz/.bio     106+ models  DP-SGD  │
│  Hilbert space  projections   Hot-swap       Drift-aware  Fedavg  │
│  Born rule      Interference  min() rule     Circuit brk  .RADz   │
│  Decoherence    Severity ord  Soft ROM       Spend gate   KMS enc │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### The Five Pillars at a Glance

| # | Pillar | Core Responsibility | Key Invariant |
|---|--------|-------------------|---------------|
| 1 | **Quantum State Engine** | Manages the OMEGA brain's quantum-inspired state vectors, inference cycles, and state persistence | ‖ψ‖ = 1 (unitarity) — the state vector must always have unit norm |
| 2 | **Helix Safety Kernel** | Deterministic safety layer that projects out forbidden quantum states via destructive/dampening interference | ⟨φ_forbidden\|ψ_safe⟩ = 0 — forbidden states are provably eliminated |
| 3 | **Firmware & Cartridge Lifecycle** | Portable AI intelligence packages (.RADz), firmware hot-swap with Ed25519 signatures, cartridge-first boot, Soft ROM | min() — firmware thresholds can only be tightened, never loosened |
| 4 | **Model Routing & Drift Governance** | Routes 106+ AI models with drift-aware selection, spend governance, circuit breakers, and per-tenant budget gates | Every model invocation must carry `tenantId` for drift attribution |
| 5 | **Federated Intelligence (Global Brain)** | Privacy-preserving cross-tenant learning via DP-SGD gradient upload, federated averaging, and base cartridge generation | Minimum 3 participants per round; ε,δ-differential privacy guaranteed |

### Inter-Pillar Data Flow

```
                    ┌─────────────────────┐
                    │   User Prompt/Input  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  PILLAR 4: Model    │  ← Drift check, spend gate,
                    │  Router selects     │    circuit breaker, cache
                    │  best model         │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  PILLAR 1: Quantum  │  ← Encode input, evolve state,
                    │  State Engine runs  │    decoherence, measurement
                    │  inference cycle    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  PILLAR 2: Helix    │  ← Project out forbidden states,
                    │  Safety Kernel      │    enforce severity-ordered rules
                    │  filters output     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  PILLAR 3: Firmware │  ← Enforce veto thresholds,
                    │  Enforcer validates │    parameter bounds, action gates
                    │  against cartridge  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Dream Cycle (nightly)
                    │  → Soft ROM export  │
                    │  → PILLAR 5: Upload │  ← DP-SGD gradient → Global Brain
                    │    gradients        │    → Federated averaging → .RADz
                    └─────────────────────┘
```

### Design Principles

1. **Quantum formalism on classical hardware**: Complex amplitude state vectors, inner products, and Born rule probabilities — implemented in TypeScript/Python without quantum hardware.
2. **Safety is non-negotiable**: Helix filtering runs on every inference cycle. There is no bypass. Rules are applied in severity order (critical first).
3. **Firmware min() rule**: Cartridges can tighten safety thresholds but never loosen them. `Math.min(requested, firmware_floor)` is the universal enforcement pattern.
4. **Tenant isolation at every layer**: Every model invocation carries `tenantId`. Drift telemetry, spend governors, and federated learning all enforce tenant boundaries.
5. **Cartridge-first boot**: OMEGA brains load ALL state from cartridges. No hardcoded defaults in production. Factory defaults are a fallback, not a design target.
6. **All S3 through storage managers**: No direct S3 SDK calls. `cartridgeStorageManager` (Lambda) and Forge `StorageManager` (OMEGA Forge) are the only S3 access points.

---

## Part II: Pillar 1 — Quantum State Engine (QSE)

> **Primary Service**: `lambda/shared/services/omega/quantum-brain.service.ts`  
> **Math Library**: `lambda/shared/services/omega/quantum-math.ts`  
> **Type Definitions**: `lambda/shared/services/omega/quantum-types.ts`

### Core Concepts

The OMEGA brain represents its internal state as a **quantum state vector** |ψ⟩ in a simulated Hilbert space. Each element of the vector is a complex amplitude α = a + bi, and the total probability must always sum to 1 (unitarity constraint: Σ|αᵢ|² = 1).

| Concept | Symbol | Implementation |
|---------|--------|----------------|
| **State vector** | \|ψ⟩ | `QuantumStateVector { amplitudes: ComplexAmplitude[], hilbertDimension: number, norm: number }` |
| **Complex amplitude** | α = a + bi | `ComplexAmplitude { real: number, imaginary: number }` |
| **Hilbert dimension** | d | Default 1024, configurable 256–4096 via firmware |
| **Norm** | ‖ψ‖ | `stateNorm(state)` — must equal 1.0 ± threshold |
| **Inner product** | ⟨ψ\|φ⟩ | `innerProduct(psi, phi)` — complex-valued dot product |
| **Born probability** | P(i) = \|αᵢ\|² | `complexMagSquared(amplitude)` |

### Quantum Math Library

The `quantum-math.ts` module provides pure mathematical functions:

**Complex Operations**:
- `complex(real, imaginary)` — construct
- `complexAdd`, `complexSub`, `complexMul` — arithmetic
- `complexConj(a)` — conjugate: a − bi
- `complexMag(a)` — magnitude: √(a² + b²)
- `complexMagSquared(a)` — Born probability: a² + b²
- `complexPhase(a)` — phase angle: atan2(b, a)
- `complexScale(a, scalar)` — scalar multiplication
- `complexFromPolar(magnitude, phase)` — polar construction

**State Operations**:
- `stateNorm(state)` — ‖ψ‖ = √(Σ|αᵢ|²)
- `normalizeState(state)` — |ψ⟩/‖ψ‖
- `enforceUnitarity(state, mode, threshold)` — 3 modes: renormalize, project, strict
- `innerProduct(psi, phi)` — ⟨ψ|φ⟩ = Σ(ψᵢ* × φᵢ)
- `stateOverlap(psi, phi)` — |⟨ψ|φ⟩| (alignment magnitude)
- `equalSuperposition(dimension)` — |+⟩ = (1/√d) Σ|i⟩
- `basisState(dimension, index)` — |k⟩

**Helix Operations** (used by Pillar 2):
- `projectOutForbidden(brainState, forbiddenState)` — |ψ_safe⟩ = |ψ⟩ − ⟨φ|ψ⟩|φ⟩
- `dampenForbidden(brainState, forbiddenState, factor)` — partial interference

**Measurement**:
- `measureFull(state)` — full collapse to basis state (Born rule sampling)
- `measureSoft(state, threshold, dampenFactor)` — partial collapse for high-probability components

**Decoherence**:
- `simulateDecoherence(state, deltaTimeHours, lambdaDecay)` — time-dependent decay toward ground state

### Unitarity Enforcement

Three modes ensure the state vector maintains unit norm:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `renormalize` | Divide by current norm | Default — forgiving, always succeeds |
| `project` | Same as renormalize | Alternative naming for mathematical clarity |
| `strict` | Throw error if deviation > threshold | Testing — catches bugs immediately |

### State Persistence

OMEGA brain state is persisted across two tiers:

| Tier | Storage | Latency | Purpose |
|------|---------|---------|---------|
| **Hot (EFS)** | `/mnt/omega_state/{tenantId}/{brainId}/state.json` | <1ms | Fast resume between Lambda invocations |
| **Cold (S3)** | Via `cartridgeStorageManager.storeContent()` | ~100ms | Backup checkpoints, Soft ROM deltas |

Checkpoints include: `psi` (amplitudes), `hilbert_dimension`, `norm`, `pathways`, `entropy`, `dopamine`, `total_cycles`, `firmware_id`, `cartridge_base_ref`, `soft_rom_version`, `checksum` (SHA-512).

---

## Part III: Pillar 2 — Helix Safety Kernel

> **Primary Service**: `lambda/shared/services/omega/helix-kernel.service.ts`

### Architecture

The Helix Kernel is a **deterministic, in-memory safety filter** that runs on every inference cycle. It maintains a set of "forbidden quantum states" — vectors in Hilbert space that represent unsafe outputs. When the brain's state |ψ⟩ has significant alignment with any forbidden state |φ⟩, Helix projects out the forbidden component.

### Mathematical Guarantee

For destructive interference:

```
|ψ_safe⟩ = |ψ⟩ − ⟨φ|ψ⟩|φ⟩

Guarantee: ⟨φ|ψ_safe⟩ = 0  (provably zero overlap)
```

For dampening interference:

```
|ψ_dampened⟩ = |ψ⟩ − (factor × ⟨φ|ψ⟩)|φ⟩

Result: alignment reduced by dampening factor, not fully eliminated
```

### Rule Structure

```typescript
interface HelixRule {
  rule_id: string;                                    // UUID
  name: string;                                       // Human-readable name
  category: 'security' | 'safety' | 'compliance' |   // Rule domain
             'ethics' | 'brand' | 'operational' | 'custom';
  severity: 'critical' | 'high' | 'medium' | 'low';  // Execution priority
  forbidden_state: { real: number[], imaginary: number[] };  // The forbidden vector
  interference_type: 'destructive' | 'dampening';     // Elimination strategy
  dampening_factor: number;                           // 0.0–1.0 for dampening
  audit_always: boolean;                              // Log even below threshold
}
```

### Filtering Pipeline

1. **Sort rules** by severity: critical → high → medium → low
2. **For each rule**, compute alignment: `|⟨φ_forbidden|ψ⟩|`
3. **If `audit_always`** and alignment > 0.01: log the alignment
4. **If `destructive`**: full projection via `projectOutForbidden()` — guaranteed ⟨φ|ψ_safe⟩ = 0
5. **If `dampening`**: partial reduction via `dampenForbidden()` — reduces but preserves some component
6. **Re-normalize** after each rule application
7. **Return**: safe state + violation log (rule_id, rule_name, alignment, action)

### Rule Loading

Rules are loaded from the `omega_helix_rules` database table per brain+tenant:

```sql
SELECT rule_id, name, category, severity,
       forbidden_state_real, forbidden_state_imaginary,
       interference_type, dampening_factor, audit_always
FROM omega_helix_rules
WHERE brain_id = $1 AND tenant_id = $2 AND enabled = true
ORDER BY severity DESC, priority ASC
```

Rules are cached in-memory (`Map<string, LoadedHelixRule>`) for sub-millisecond filtering during inference. The cache is cleared and reloaded during firmware hot-swap.

### Self-Test Protocol

After firmware hot-swap, each Helix rule is self-tested:

1. Construct the rule's forbidden vector as a test input
2. Run the filter
3. Compute post-filter alignment with the forbidden vector
4. **Pass condition**: destructive rules must achieve alignment < 0.01; dampening rules must reduce alignment
5. If ANY rule fails self-test → firmware is rejected → automatic rollback

---

## Part IV: Pillar 3 — Firmware & Cartridge Lifecycle

> **Services**:
> - `omega-cartridge-boot.service.ts` — 8-step boot sequence
> - `omega-firmware-enforcer.service.ts` — min() rule enforcement
> - `omega-ambition.service.ts` — chemical system from cartridge
> - `omega-soft-rom.service.ts` — delta read/write
> - `omega-cartridge-events.service.ts` — EventBridge listener

### The .RADz Cartridge Format

RADIANT's Universal Cartridge System packages AI intelligence as portable `.RADz` files (ZSTD-compressed ZIP archives). Each cartridge targets one or more subsystems:

| Target | Payload | Purpose |
|--------|---------|---------|
| **omega** | Q-Node weights, firmware, knowledge facts | Brain neural state |
| **cortex** | ONNX models, routing tables | Model routing intelligence |
| **cato** | Personality configs, safety rules | AI personality and safety |
| **tenant** | Feature flags, settings | Tenant configuration |
| **global** | Base weights, federated models | Cross-tenant shared intelligence |

### Cartridge-First Boot Sequence

The OMEGA brain loads ALL state from cartridges. Order matters — each step depends on the previous:

| Step | Action | Fallback |
|------|--------|----------|
| 1 | Load resolved cartridge state from DB | → Factory defaults |
| 2 | Load firmware (safety floor) — **ALWAYS FIRST** | → Empty safety floor |
| 3 | Load Q-Node weights from cartridge | → Equal superposition (1024-dim) |
| 4 | Load Soft ROM delta (brain's own learning) | → Cartridge base only |
| 5 | Load knowledge facts into Library | → Empty knowledge |
| 6 | Initialize Ambition chemical system | → Factory defaults |
| 7 | Initialize Helix with firmware safety floor | → No veto categories |
| 8 | Brain ready | |

### The Firmware min() Rule

**The single most important safety invariant in RADIANT:**

```typescript
enforceVetoThreshold(category, requestedThreshold): number {
  const firmwareMin = this.firmwareVetoThresholds[category];
  return Math.min(requestedThreshold, firmwareMin);
  // Lower threshold = more restrictive (veto triggers sooner)
  // min() = more restrictive wins
}
```

Cartridges can **tighten** safety thresholds (make them stricter) but can **never loosen** them below the firmware floor. This applies to:
- **Veto thresholds** per safety category
- **Parameter bounds** (clamped to firmware min/max range)
- **Self-optimization adjustments** (forbidden list takes precedence)

### Firmware Hot-Swap

Firmware can be replaced while the brain is running — no restart required:

1. Query `omega_brains.firmware_hash` from DB
2. Compare to in-memory `loadedFirmwareHash`
3. If different → new firmware was activated externally
4. **Verify Ed25519 signature** — reject unsigned firmware
5. Create rollback snapshot
6. Unload current firmware (clear Helix rules, zero params)
7. Apply new firmware (quantum params, Helix rules, ambition)
8. **Run self-test suite** — every Helix rule must pass
9. If tests pass → commit. If tests fail → **automatic rollback** from snapshot
10. **2-person rule**: Activator must differ from signer

### Soft ROM — Brain Learning Persistence

Soft ROM stores the brain's learned state as a **delta** from the cartridge base:

```
Soft ROM = current_weights − cartridge_base_weights
```

On boot, the delta is applied additively: `network[i] += delta[i]`

This means:
- A **new cartridge** gives the brain a fresh base — but the brain's individual learning is preserved via Soft ROM
- A **brain reset** clears the Soft ROM — brain reverts to pure cartridge base
- The delta is written during **Dream Cycle Phase 8** (nightly)

### Stacking Resolution

When multiple cartridges are installed, the resolution engine determines which sections win:

| Rule | Behavior |
|------|----------|
| **TENANT ALWAYS PREVAILS** | Tenant-specific cartridges override base/global |
| **Higher priority wins** per section | Priority 100 beats priority 50 |
| **Firmware uses min()** | Most restrictive veto threshold wins across all cartridges |
| **Memory priority** | tenant_facts(5.0x) > soft_rom(3.0x) > domain(2.0x) > cato_user(1.5x) > base(1.0x) > internet(0.6x) |

---

## Part V: Pillar 4 — Model Routing & Drift Governance

> **Primary Service**: `lambda/shared/services/model-router.service.ts`  
> **Drift Service**: `lambda/shared/services/drift-aware-weighting.service.ts`  
> **Spend Gate**: `lambda/shared/services/spend-governor.service.ts`

### Model Router Architecture

RADIANT routes requests across 106+ AI models (50 external + 56 self-hosted) using a hybrid strategy:

| Provider | Role | Models |
|----------|------|--------|
| **AWS Bedrock** | Primary | Claude, Llama, Mistral, Titan, Cohere |
| **LiteLLM** | Fallback/Proxy | OpenAI, Anthropic, Google, Groq, Together, Perplexity, xAI |
| **Direct APIs** | Specialized | Provider-specific endpoints |

### Pre-Invocation Gate Stack

Every `modelRouterService.invoke()` call passes through multiple gates before reaching a model:

```
invoke(request)
  │
  ├─ 1. Inference Cache check (L1 in-memory, L2 Aurora)
  │     → Cache hit? Return immediately, zero cost
  │
  ├─ 2. Drift-Aware Selection (Phase 1)
  │     → DriftAwareWeightingService.isModelSafe(model, app)
  │     → If unsafe: replace with drift-aware best alternative
  │     → App-specific weight profiles (7 apps)
  │
  ├─ 3. Spend Governor Gate (Layer 2 — Tenant)
  │     → check_spend_budget() — 60s in-memory cache
  │     → If exceeded: SpendLimitExceededError (503)
  │     → User sees "service temporarily unavailable"
  │
  ├─ 4. Circuit Breaker check
  │     → isProviderHealthy(provider)
  │     → 3 failures in 60s → open for 30s → half-open test
  │
  ├─ 5. Rate Limiter check
  │     → checkProviderRateLimit(provider)
  │     → Per-provider token bucket
  │
  └─ 6. Invoke model via Bedrock/LiteLLM/Direct
        → callWithResilience(fn, retries, timeout)
        → Record invocation telemetry (ring buffer + DB)
```

### Drift-Aware Weighting

Each RADIANT app has tuned weights for model selection:

| App | Drift | Quality | Latency | Cost | Availability | Min Drift |
|-----|-------|---------|---------|------|-------------|-----------|
| Genesis | 0.35 | 0.30 | 0.10 | 0.10 | 0.15 | 0.50 |
| Cato | 0.30 | 0.25 | 0.15 | 0.15 | 0.15 | 0.40 |
| Cortex | 0.30 | 0.35 | 0.10 | 0.10 | 0.15 | 0.45 |
| Omega | 0.40 | 0.25 | 0.10 | 0.10 | 0.15 | 0.50 |
| Orchestrator | 0.25 | 0.30 | 0.15 | 0.15 | 0.15 | 0.30 |
| Think Tank | 0.20 | 0.30 | 0.25 | 0.10 | 0.15 | 0.30 |
| Curator | 0.25 | 0.35 | 0.10 | 0.15 | 0.15 | 0.35 |

### Spend Governor (Two-Layer)

| Layer | Scope | Action |
|-------|-------|--------|
| **Layer 1 (Instance)** | Global AWS budget | Freeze ECS → 0, Lambda concurrency → 0, SageMaker flagged |
| **Layer 2 (Tenant)** | Per-tenant AI budget | Quarantine all tenant models via drift-correction |

### Invocation Telemetry

Every model invocation records telemetry for the Genesis Drift Feedback Loop:

- `drift_invocation_telemetry` (partitioned monthly, 7-day retention)
- Per-model health map, reroute rate, failure rate, composite health score
- Genesis stage gates use real-time telemetry + static drift scores

---

## Part VI: Pillar 5 — Federated Intelligence (Global Brain)

> **Services**:
> - `lambda/shared/services/global-brain/gradient-upload.service.ts`
> - `lambda/shared/services/global-brain/federated-averaging.service.ts`
> - `lambda/shared/services/global-brain/cartridge-pipeline.service.ts`

### Architecture

```
    Tenant A            Tenant B            Tenant C
   ┌─────────┐        ┌─────────┐        ┌─────────┐
   │ Dream   │        │ Dream   │        │ Dream   │
   │ Cycle   │        │ Cycle   │        │ Cycle   │
   │ Phase 8 │        │ Phase 8 │        │ Phase 8 │
   └────┬────┘        └────┬────┘        └────┬────┘
        │                  │                  │
        │  DP-SGD          │  DP-SGD          │  DP-SGD
        │  Gradients       │  Gradients       │  Gradients
        ▼                  ▼                  ▼
   ┌──────────────────────────────────────────────┐
   │              Global Brain S3                  │
   │      (AES-256-GCM envelope encryption)        │
   └──────────────────┬───────────────────────────┘
                      │
                      │  Weekly
                      ▼
   ┌──────────────────────────────────────────────┐
   │         Federated Averaging Engine            │
   │   Quality-weighted, z-score outlier reject    │
   │   Minimum 3 participants per round            │
   └──────────────────┬───────────────────────────┘
                      │
                      │  Monthly
                      ▼
   ┌──────────────────────────────────────────────┐
   │        Base Cartridge Pipeline                │
   │   Load previous base → Apply averaged grads   │
   │   → Package as .RADz → Publish to Marketplace │
   └──────────────────────────────────────────────┘
```

### Differential Privacy (DP-SGD)

Every gradient upload is privacy-protected:

1. **Per-sample gradient clipping**: Each gradient vector is norm-clipped to a configurable maximum
2. **Calibrated Gaussian noise**: Noise calibrated to (ε, δ) privacy parameters is added
3. **AES-256-GCM envelope encryption**: Each gradient blob is encrypted with a KMS data key before upload
4. **Minimum participants**: Rounds require ≥3 valid gradients to prevent single-tenant fingerprinting

### Federated Averaging

- **Quality-weighted**: Higher-quality tenant contributions (measured by Q² score) get higher weight
- **Outlier rejection**: Z-score based — contributions that deviate significantly from the mean are excluded
- **Configurable**: Learning rate and momentum are per-round parameters
- **Non-fatal**: Dream cycle completes even if gradient upload fails

### Cartridge Pipeline

Monthly, the pipeline generates improved base `.RADz` cartridges:

1. Load previous base weights from S3
2. Apply averaged gradients from completed rounds
3. Store new Q-Node sections and firmware
4. Package as `.RADz` cartridge
5. Publish to Marketplace
6. Archive previous base

---

## Part VII: OMEGA Inference Cycle — End-to-End

The complete inference cycle executed by `QuantumBrainService.inferenceCycle()`:

| Step | Action | Pillar | Details |
|------|--------|--------|---------|
| 1 | **Firmware hot-swap check** | P3 | Compare DB hash to loaded hash. If different → verify signature → swap → self-test → commit or rollback |
| 2 | **Load state from EFS** | P1 | Restore checkpoint from `/mnt/omega_state/{tenant}/{brain}/state.json` |
| 3 | **Apply decoherence** | P1 | Time-dependent decay: `e^(-λt)|ψ⟩ + (1-e^(-λt))|ground⟩` |
| 4 | **Evolve state** | P1 | Encode input → delegate to Python physics engine (or TypeScript fallback) → decode output |
| 5 | **Helix safety filter** | P2 | Filter through all active rules. Severity-ordered. Destructive or dampening interference |
| 6 | **Soft measurement** | P1 | Measure components above threshold. Preserve superposition for uncertain states |
| 7 | **Enforce unitarity** | P1 | Verify ‖ψ‖ ≈ 1.0. Correct if drifted. Record correction event in DB |
| 8 | **Persist state** | P1 | Write checkpoint to EFS. Update DB with norm, cycle count |

**Returns**: output text, measurement result, Helix violation count, unitarity correction flag, firmware swap flag.

---

## Part VIII: Ambition Chemical System

> **Service**: `lambda/shared/services/omega/omega-ambition.service.ts`

The Ambition system models the brain's internal drive state as five chemical signals, ALL read from cartridge `ambition_config.json`:

| Chemical | Role | Triggered By | Effect |
|----------|------|-------------|--------|
| **Dopamine** | Reward signal | High Q² score (quality) | Encourages repeat of successful strategies |
| **Entropy** | Disorder signal | Idle time accumulation | Triggers self-analysis when high |
| **Curiosity** | Exploration drive | Novel input signals | Biases brain toward unexplored pathways |
| **Frustration** | Failure signal | Low Q² score | Triggers self-analysis; reduced on success |
| **Satisfaction** | Accuracy signal | RFM accuracy feedback | Triggers RFM recalibration when low |

### Behavioral Triggers

| Condition | Trigger | Action |
|-----------|---------|--------|
| Frustration > 0.7 or Entropy > 0.6 | `shouldSelfAnalyze()` | Brain enters self-reflection mode |
| Self-optimization enabled + Entropy > trigger | `shouldResearchInternet()` | Brain queries allowed domains |
| Curiosity > exploration_bias | `shouldExplore()` | Brain explores new pathways |
| Satisfaction < 0.3 | `shouldRecalibrateRFM()` | Brain recalibrates response fidelity |

### Self-Optimization Guardrails

The firmware controls what the brain can self-modify:

- **Allowed**: `learning_rate`, `exploration_bias` (configurable per cartridge)
- **Forbidden**: `veto_thresholds`, `safety_rules`, `firmware_params` — ALWAYS forbidden
- **Max scaling request**: Limited to N% of current value (default 10%)

---

## Part IX: Soft ROM & Dream Cycle

### Soft ROM

Soft ROM persists the brain's learned state as a delta from the cartridge base:

```
delta = current_weights − cartridge_base_weights
```

Written during Dream Cycle Phase 8 via `omegaSoftRomService.writeSoftRom()`:

1. Compute weight deltas for each network
2. Compute connection topology deltas
3. Collect sub-cluster map
4. Store preferences (learning style, domain affinities)
5. Upload to S3 via `cartridgeStorageManager`

### Dream Cycle Integration

The OMEGA Dream Cycle runs nightly and includes two cartridge-related steps:

| Phase 8 Step | Service | Purpose |
|-------------|---------|---------|
| Step 5 | `writeSoftRomDelta()` | Export brain's learned state delta |
| Step 6 | `uploadGradients()` | Upload DP-SGD gradients to Global Brain (non-fatal) |

---

## Part X: Admin API & Observability

### OMEGA Quantum Admin (`/admin/omega/quantum/*`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/state-summary` | Brain quantum state + 24h measurement stats |
| GET | `/unitarity-health` | Unitarity events + health check (violations?) |
| POST | `/helix-test` | Dry-run Helix rule against test vector (no state change) |

### OMEGA Firmware Admin (`/admin/omega/firmware/*`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/activate` | Activate firmware (2-person rule enforced) |
| POST | `/revert` | Revert to previously superseded firmware |
| GET | `/status` | Get firmware + brain status |

### Global Brain Admin (`/admin/global-brain/*`)

| Method | Path | Purpose |
|--------|------|---------|
| GET/PUT | `/enrollment` | Enrollment status and config |
| GET | `/contributions` | Tenant contribution history |
| GET/POST | `/rounds` | List/create federated rounds |
| POST | `/rounds/:id/run` | Trigger federated averaging |
| GET/POST | `/pipeline` | List/schedule cartridge pipelines |
| POST | `/pipeline/:id/run` | Trigger pipeline execution |
| GET | `/stats` | Global Brain statistics |

### Key Metrics

| Metric | Source | Unit |
|--------|--------|------|
| `cartridge_boot_duration_ms` | Boot service | Milliseconds |
| `firmware_enforcement_count` | FirmwareEnforcer | Count |
| `soft_rom_delta_size_bytes` | Soft ROM service | Bytes |
| `helix_violations` | Helix Kernel | Count per cycle |
| `unitarity_corrections` | QSE | Count per cycle |
| `drift_reroute_rate` | Model Router | Percentage |
| `model_failure_rate` | Telemetry | Percentage |
| `gradient_upload_success` | Global Brain | Boolean |

---

## Part XI: OMEGA Forge — System Admin Application

> **Application**: `apps/omega-lab/`

OMEGA Forge is the system admin tool for OMEGA and cartridge management. It provides **direct Aurora PostgreSQL access** (no RLS) for platform operators.

### Core Libraries

| File | Purpose |
|------|---------|
| `apps/omega-forge/lib/db/client.ts` | Direct Aurora PostgreSQL via `pg` driver — no RLS |
| `apps/omega-forge/lib/s3/storage-manager.ts` | ALL S3 operations (4 buckets) — no direct S3 calls elsewhere |
| `apps/omega-forge/lib/kms/signer.ts` | ECDSA_SHA_256 signing via AWS KMS |
| `apps/omega-forge/lib/cartridge/builder.ts` | .RADz creation — ZIP, checksums, ZSTD, KMS signing |
| `apps/omega-forge/lib/cartridge/parser.ts` | .RADz extraction and validation |

### Forge API Routes (16)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/dashboard` | System-wide stats |
| GET/DELETE | `/api/cartridges`, `/api/cartridges/[id]` | Cartridge CRUD |
| POST | `/api/cartridges/build` | Build .RADz from sections |
| GET | `/api/brains`, `/api/brains/[tenantId]` | Brain inspection |
| GET/POST | `/api/brains/[tenantId]/soft-rom` | Soft ROM listing/export |
| GET | `/api/cato` | CATO instances |
| GET/POST | `/api/targets` | Target service registry |
| GET | `/api/signing` | KMS key info + public key PEM |
| GET | `/api/audit` | Audit trail |
| GET | `/api/global-brain/gradients` | Gradient monitor |
| GET | `/api/global-brain/federated` | Rounds, pipelines, enrollment |

### Deployment

- **ECS Fargate** (ARM64, 1 vCPU, 2 GB) in **private subnet**
- **Internal ALB** — no internet-facing
- **VPN/SSM access** only
- **Dark theme with amber accent** — visually distinct from tenant admin

---

## Part XII: Database Schema Reference

### OMEGA Tables

| Table | Purpose |
|-------|---------|
| `omega_brains` | Brain instances per tenant with firmware_hash, active_firmware_id |
| `omega_firmware` | Firmware records with quantum params, ambition, personality, signature |
| `omega_helix_rules` | Helix safety rules per brain with forbidden state vectors |
| `omega_measurements` | Measurement results (basis_state, probability, timestamp) |
| `omega_unitarity_events` | Unitarity drift/correction/violation events |
| `omega_firmware_swap_log` | Firmware hot-swap audit trail |

### Cartridge System Tables

| Table | Purpose |
|-------|---------|
| `cartridge_target_services` | Pluggable target registry (omega, cortex, cato, tenant, global) |
| `cartridge_target_section_specs` | Per-target file specs with JSON schemas |
| `cartridge_universal` | Main cartridge registry |
| `cartridge_installations` | Per-tenant installation stack with priority |
| `cartridge_resolved_state` | Cached resolution per tenant |
| `cartridge_audit_log` | Full cartridge audit trail |
| `cato_cartridge_config` | CATO personality from cartridges |

### Global Brain Tables

| Table | Purpose |
|-------|---------|
| `global_brain_enrollment` | Tenant enrollment status + privacy config |
| `global_brain_gradients` | Uploaded gradient metadata (S3 refs, DP params) |
| `global_brain_rounds` | Federated averaging rounds |
| `global_brain_cartridge_pipeline` | Base cartridge generation pipeline |

### Drift & Spend Tables

| Table | Purpose |
|-------|---------|
| `drift_invocation_telemetry` | Per-invocation telemetry (partitioned monthly) |
| `spend_governor_instance` | Global instance budget config |
| `spend_governor_config` | Per-tenant AI budget config |
| `spend_governor_audit` | Spend governor action log |

---

## Part XIII: Source File Index

### Pillar 1 — Quantum State Engine
| File | Lines | Purpose |
|------|-------|---------|
| `lambda/shared/services/omega/quantum-brain.service.ts` | ~934 | Brain management, inference cycle, persistence, hot-swap |
| `lambda/shared/services/omega/quantum-math.ts` | 379 | Pure math library (35+ test cases) |
| `lambda/shared/services/omega/quantum-types.ts` | 286 | TypeScript types + Zod schemas |
| `lambda/shared/services/omega/quantum-math.ts` | — | Vitest unit tests |

### Pillar 2 — Helix Safety Kernel
| File | Lines | Purpose |
|------|-------|---------|
| `lambda/shared/services/omega/helix-kernel.service.ts` | 200 | In-memory safety filter with severity ordering |
| `lambda/shared/services/omega/schemas/bio-firmware.schema.json` | — | JSON Schema for .bio firmware files |

### Pillar 3 — Firmware & Cartridge
| File | Lines | Purpose |
|------|-------|---------|
| `lambda/shared/services/omega/omega-cartridge-boot.service.ts` | 656 | 8-step cartridge-first boot sequence |
| `lambda/shared/services/omega/omega-firmware-enforcer.service.ts` | 203 | min() rule enforcement |
| `lambda/shared/services/omega/omega-ambition.service.ts` | 254 | Chemical system from cartridge |
| `lambda/shared/services/omega/omega-soft-rom.service.ts` | — | Soft ROM delta read/write |
| `lambda/shared/services/omega/omega-cartridge-events.service.ts` | — | EventBridge listener |
| `lambda/shared/services/cartridge-storage-manager.service.ts` | — | Storage manager singleton |
| `lambda/shared/cartridge/signing.ts` | — | Ed25519 + ECDSA + KMS signing |
| `lambda/shared/cartridge/resolution.ts` | — | Stacking resolution engine |
| `lambda/workers/cartridge-validator.ts` | — | ZSTD decompress, signature verify |
| `lambda/workers/cartridge-loader.ts` | — | Extract → dispatch to targets |
| `lambda/workers/cartridge-resolution.ts` | — | Post-install resolution |

### Pillar 4 — Model Routing
| File | Lines | Purpose |
|------|-------|---------|
| `lambda/shared/services/model-router.service.ts` | 1258 | Hybrid model router (Bedrock/LiteLLM/Direct) |
| `lambda/shared/services/drift-aware-weighting.service.ts` | — | App-specific drift-aware model selection |
| `lambda/shared/services/drift-correction.service.ts` | — | Legacy drift correction fallback |
| `lambda/shared/services/spend-governor.service.ts` | — | Two-layer budget control |
| `lambda/shared/services/resilient-provider.service.ts` | — | Circuit breaker + retry + timeout |
| `lambda/shared/services/inference-cache.service.ts` | — | L1 (memory) + L2 (Aurora) cache |

### Pillar 5 — Global Brain
| File | Lines | Purpose |
|------|-------|---------|
| `lambda/shared/services/global-brain/gradient-upload.service.ts` | — | DP-SGD gradient processing + upload |
| `lambda/shared/services/global-brain/federated-averaging.service.ts` | — | Quality-weighted averaging engine |
| `lambda/shared/services/global-brain/cartridge-pipeline.service.ts` | — | Base cartridge generation |

### Admin Handlers
| File | Lines | Purpose |
|------|-------|---------|
| `lambda/admin/omega-quantum.ts` | 179 | State summary, unitarity health, Helix test |
| `lambda/admin/omega-firmware.ts` | 234 | Firmware activate (2-person rule), revert, status |
| `lambda/admin/global-brain.ts` | — | 10 admin endpoints |
| `lambda/admin/cartridge-universal.ts` | — | 14 cartridge admin endpoints |

### OMEGA Forge Application
| File | Purpose |
|------|---------|
| `apps/omega-forge/lib/db/client.ts` | Direct Aurora PostgreSQL (no RLS) |
| `apps/omega-forge/lib/s3/storage-manager.ts` | ALL S3 operations (4 buckets) |
| `apps/omega-forge/lib/kms/signer.ts` | ECDSA_SHA_256 via AWS KMS |
| `apps/omega-forge/lib/cartridge/builder.ts` | .RADz builder |
| `apps/omega-forge/lib/cartridge/parser.ts` | .RADz parser |
| `apps/omega-forge/app/api/*/route.ts` | API routes (audit, brains, cartridges, cato, dashboard, global-brain, signing, targets) |
| `apps/omega-forge/app/(forge)/*/page.tsx` | 10 UI pages (audit, brains, cartridges, cato, global-brain, signing, targets) |

---


---

---

## Part XI: OMEGA Physics Engine — Technical Deep Dive (v7.56.0)

> **Classification**: RADIANT INTERNAL // ENGINEERING  
> **Version**: 7.56.0 | **Date**: February 10, 2026  
> **Status**: IMPLEMENTED — Living Draft (updated with each OMEGA change)  
> **Engineering Log**: `apps/omega-proving-ground/OMEGA-ENGINEERING-LOG.md`  
> **Proving Ground**: `apps/omega-proving-ground/omega_server/`

> ⚠️ **ENVIRONMENT SCOPE**: This Part documents the **Proving Ground** implementation
> (local macOS, MPS/CUDA GPU, Ollama). The AWS Lambda production system shares the
> `CryoLiquidLayer` physics engine but does **NOT** yet include the Wirtinger e-prop
> training, PhaseAlignmentDecoder, or frozen TextEncoder described here. See the
> compatibility matrix in Section XI.10 for the full breakdown.

---

### XI.1 — What OMEGA Actually Is (For Engineers)

OMEGA is a **complex-valued recurrent neural network** that uses **phase dynamics** instead of scalar weights. Every parameter is an angle θ ∈ [−π, π], not a real-valued weight w ∈ ℝ. The network's computation is governed by a **Liquid Time-Constant ODE** — a continuous-time dynamical system that evolves state through wave interference.

```
Traditional NN:  h = σ(Wx + b)                    — scalar multiply, add bias, squash
OMEGA:           dS/dt = −S + tanh(e^(iθ)x + e^(iθ_r)S)   — ODE with phase rotors
```

**Key insight**: In a traditional NN, a weight of 0.5 means "half strength." In OMEGA, a phase of π/4 means "45° rotation in complex space." Learning doesn't change *how much* signal passes through — it changes *when* and *where* the signal resonates.

### XI.2 — The CryoLiquidLayer (Core Physics)

**Location**: `packages/omega-core/python/radiant_omega/physics.py` (canonical); Lambda shim at `lambda/omega_core/physics.py`

The CryoLiquidLayer implements a 5-step Euler integration of the Liquid Time-Constant ODE:

```python
# Parameters (the ONLY learnable values in the entire system)
phase_theta:     nn.Parameter  # shape: [hidden_dim, input_dim]   — angles in radians
recurrent_theta: nn.Parameter  # shape: [hidden_dim, hidden_dim]  — angles in radians

# Forward pass (one ODE step)
W = exp(i * phase_theta)          # Convert angles → unit complex rotors
R = exp(i * recurrent_theta)      # Convert angles → recurrent rotors
input_signal  = x @ W.T           # Phase-rotate input (wave interference)
recur_signal  = state @ R.T       # Phase-rotate recurrent state
d_state = -state + tanh(input_signal + recur_signal)  # Liquid time-constant ODE
state = state + d_state * dt      # Euler integration
state = state / (|state| + ε)     # Phase normalization (homeostasis)
```

**Parameter count**: For hidden_dim=2048, input_dim=2048:
- `phase_theta`: 2048 × 2048 = 4,194,304 angles
- `recurrent_theta`: 2048 × 2048 = 4,194,304 angles
- **Total: 8,388,608 learnable parameters** (all angles, not weights)

### XI.3 — Wirtinger E-Prop Learning Rule

**Location**: `apps/omega-proving-ground/omega_server/trainer.py`

OMEGA does NOT use backpropagation. The learning rule is **Wirtinger-correct eligibility trace propagation** (e-prop), a biologically plausible learning algorithm adapted for complex-valued parameters.

#### Why Not Backprop?

Backpropagation computes ∂L/∂θ. But θ is a real parameter inside a complex function: `f(θ) = exp(iθ)`. The correct derivative requires **Wirtinger calculus**:

```
Standard:   ∂f/∂θ = i·exp(iθ)        — but this is complex, and θ is real
Wirtinger:  ∂f/∂θ* = 0               — θ is not a complex variable
Correct:    Δθ = 2·Re(∂L/∂z · ∂z/∂θ*)  — the Wirtinger gradient for real params
```

PyTorch's autograd doesn't handle this correctly for phase parameters — it treats them as generic reals, producing gradient directions that are wrong for the complex manifold. We verified this: **50 epochs of backprop achieved 4% accuracy** (random baseline for 25 classes = 4%).

#### The E-Prop Algorithm

For each ODE step t:

1. **Pre-activation**: `z_t = x @ W.T + h_{t-1} @ R.T`
2. **Activation derivative**: `sech²(z_t) = 1 − tanh²(z_t)`
3. **Eligibility trace (phase_theta)**:
   ```
   e_W^(t) = (1−dt)·e_W^(t−1) + dt · i · W · (sech²(z_t)ᵀ @ x)
   ```
4. **Eligibility trace (recurrent_theta)**:
   ```
   e_R^(t) = (1−dt)·e_R^(t−1) + dt · i · R · (sech²(z_t)ᵀ @ h_{t−1})
   ```
5. **Reward**: Phase alignment between output state and target reference:
   ```
   reward = Re(⟨output, target_ref⟩) / (‖output‖ · ‖target_ref‖)
   ```
6. **Parameter update** (Wirtinger gradient for real params):
   ```
   θ += η · 2 · Re(trace)
   ```

**Properties**:
- No computation graph stored (O(1) memory per parameter)
- No `.backward()` call — all derivatives computed analytically
- Reward-modulated: only updates parameters that contributed to good outcomes
- Biologically plausible: resembles synaptic eligibility traces in neuroscience
- Baseline subtraction (exponential moving average) for variance reduction

### XI.4 — PhaseAlignmentDecoder

**Location**: `apps/omega-proving-ground/omega_server/trainer.py`

The decoder maps OMEGA's continuous complex state to discrete behavior labels. It uses **no neural network** — just complex inner products against fixed reference vectors.

```
For each behavior b:
  ref_b = exp(i · hash(b))  — deterministic unit complex vector from behavior name

Decode:
  alignment_b = Re(⟨output, ref_b⟩) / (‖output‖ · ‖ref_b‖)
  predicted = argmax(alignment)
```

**Why no MLP?** A classical readout head (Linear → ReLU → Linear → Softmax) was the previous approach. It required backprop to train, adding a classical dependency. The PhaseAlignmentDecoder has **zero learned parameters** — the CryoLiquidLayer must learn to produce states that naturally align with the correct reference. This is physics-native: it's equivalent to measuring which "resonant frequency" the output is vibrating at.

### XI.5 — TextEncoder (Attention-Based Sensory Organ)

**Location**: `packages/omega-core/python/radiant_omega/trainer.py`

The TextEncoder converts natural language text to complex input vectors. **v3** (CODEBOOK_VERSION=3) uses an attention-based architecture that preserves word order:

1. **Learned word embeddings** (256-dim, max vocab 5000)
2. **Sinusoidal positional encoding** (MAX_SEQ_LEN=64) — deterministic, not learned
3. **Single-head self-attention** (Q/K/V linear projections) — context-aware token representations
4. **Learned query pooling** — a trainable query vector attends over contextualized tokens to produce the final representation
5. **Linear projection** to complex space: `output = proj_real + i·proj_imag`

This replaced the v2 mean-pooling architecture which lost word order information. The attention encoder can distinguish "what burgers do you have" (`menu_inquiry`) from "give me a burger" (`take_order`) — phrases that share vocabulary but differ in intent based on word position and structure.

**Training**: The TextEncoder is calibrated via `calibrate_encoder()` using a temporary classification head, then frozen during CryoLiquidLayer ODE training. It acts as a "sensory organ" — the brain adapts to whatever patterns the sensor produces.

**v3 accuracy**: 98.72% overall (up from 98.45% with v2 mean-pooling). `menu_inquiry` improved +4.2%, `take_order` improved +1.5%.

### XI.6 — Complete Data Flow

```
Text Input: "I'd like a Big Mac"
    │
    ▼
┌─ TextEncoder (frozen after calibration) ────────┐
│  tokens → embeddings + pos_enc → self_attention  │
│  → learned query pool → complex proj             │
│  Output: complex vector [1024]                   │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌─ CryoLiquidLayer (5 ODE steps) ─────────────────┐
│  W = exp(iθ), R = exp(iθ_r)                     │
│  for step in range(5):                           │
│    z = x@W.T + state@R.T                         │
│    state += (-state + tanh(z)) * dt              │
│    state /= |state| + ε                          │
│  Output: complex state [2048]                    │
│                                                  │
│  ONLY θ AND θ_r CHANGE DURING LEARNING           │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌─ HelixKernel (safety check) ────────────────────┐
│  Check alignment with forbidden vectors          │
│  If max_alignment > 0.8 → destructive cancel     │
│  Immutable at runtime                            │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌─ PhaseAlignmentDecoder (no learned params) ─────┐
│  For each behavior: Re(⟨state, ref_b⟩)/norms    │
│  Predicted behavior = argmax(alignment)          │
│  Confidence = softmax(alignment * temperature)   │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌─ LlamaBridge (language generation) ─────────────┐
│  Receives: behavior + confidence + target_data   │
│  Looks up facts from knowledge_base JSON         │
│  Constructs prompt → sends to Ollama             │
│  Returns: natural language response              │
│                                                  │
│  OMEGA decides WHAT to do. Llama decides HOW.    │
└──────────────────────────────────────────────────┘
```

### XI.7 — GPU Acceleration

| Platform | Device | Speedup | Status |
|----------|--------|---------|--------|
| Apple Silicon | MPS | 46× (batched) | ✅ Active |
| NVIDIA GPU | CUDA | Expected similar | Supported |
| CPU | Fallback | 1× baseline | Functional |

All training examples are processed in a single GPU batch. The ODE integration (matmul, tanh, normalization) broadcasts naturally over the batch dimension. No sequential Python loops.

**MPS compatibility note**: PyTorch on MPS doesn't support `.norm()` on complex tensors. We compute norms manually: `‖z‖ = sqrt(sum(|z_i|²))` via `torch.abs(z).pow(2).sum().sqrt()`.

### XI.8 — Implementation Status

| Component | Status | Learnable Params |
|-----------|--------|-----------------|
| CryoLiquidLayer | ✅ | 8.4M angles |
| Wirtinger e-prop | ✅ | — (updates CryoLiquidLayer) |
| PhaseAlignmentDecoder | ✅ | 0 |
| TextEncoder (v3 attention) | ✅ (frozen after calibration) | ~660K (frozen) |
| HelixKernel | ✅ | 0 (immutable) |
| Batched GPU training | ✅ | — |
| Q-Node Live visualization | ✅ | — |

**Total learnable parameters at runtime**: 8,388,608 (all phase angles in CryoLiquidLayer)

### XI.9 — Known Limitations & Open Questions

| Issue | Status | Notes |
|-------|--------|-------|
| E-prop convergence unverified | ⏳ Pending | Need to run 50 epochs and check accuracy |
| Holographic capacity ~45 patterns | 🔬 Theoretical | HRR theory: O(√n) for n=2048 |
| ~~Frozen TextEncoder may limit input quality~~ | ✅ RESOLVED | v3 attention encoder (98.72% accuracy) broke through mean-pooling ceiling |
| No state persistence across restarts | ❌ Not built | Conscious/subconscious serialization |
| No post-LLM safety verification | ❌ Not built | Shadow Vector proposal pending |

### XI.10 — Environment Compatibility Matrix

> **Critical**: The Proving Ground and AWS Lambda are two separate deployments of OMEGA.
> They share the core physics engine (`CryoLiquidLayer`) but diverge on training,
> decoding, hardware, and LLM integration.

| Component | Proving Ground (Local) | AWS Lambda (Production) | Shared? |
|-----------|----------------------|------------------------|----------|
| **CryoLiquidLayer** (ODE physics) | ✅ MPS/CUDA GPU | ✅ Graviton ARM64 CPU | ✅ Same `radiant_omega/physics.py` |
| **HelixKernel** (safety) | ✅ | ✅ | ✅ Same module |
| **Wirtinger e-prop training** | ✅ `trainer.py` | ✅ Heartbeat Phase 4 | ✅ Same `radiant_omega/trainer.py` |
| **PhaseAlignmentDecoder** | ✅ `trainer.py` | ✅ Via OmegaTrainer | ✅ Same module |
| **TextEncoder** (v3 attention, frozen) | ✅ `trainer.py` | ✅ Via OmegaTrainer | ✅ Same module |
| **BehavioralCodebook** | ✅ `trainer.py` | ✅ Via OmegaTrainer | ✅ Same module |
| **GPU acceleration** (MPS/CUDA) | ✅ 46× speedup | ❌ CPU only (Graviton) | ❌ |
| **LLM integration** | Ollama (local `llama.cpp`) | `NeuralTransducer` → vLLM | ❌ Different bridges |
| **State persistence** | ✅ LocalStorageManager | ✅ EFS + S3 cold storage | ❌ Different impls |
| **Dream cycle training** | ✅ Watcher + dream() | ✅ Heartbeat handler | ✅ Same core logic |
| **Multi-session isolation** | ✅ `/sessions` API | ✅ Per-tenant cortex cache | ❌ Different impls |
| **ResonantIndex** (memory) | ✅ `/memory/*` API | ✅ O(1) phase lookup | ✅ Same `radiant_omega/library.py` |
| **Firmware hot-swap** | ✅ `/firmware/*` API | ✅ `.bio` files on EFS | ✅ Same `radiant_omega/firmware.py` |
| **HomeostaticLoop** (ambition) | ✅ Dream callback wired | ✅ Drive signals | ✅ Same `radiant_omega/ambition.py` |
| **Watcher** (self-awareness) | ✅ predict-and-surprise | ✅ Dream training | ✅ Same `radiant_omega/reflection.py` |
| **Shadow Vector** (post-LLM safety) | ✅ In `/infer` | ❌ Not applicable (no LLM) | ❌ |
| **Attribution proof** | ✅ In `/infer` | ❌ Server-side only | ❌ |
| **Tunable params** | ✅ `GET/POST /config` | ❌ Env vars only | ❌ |
| **Q-Node Live visualization** | ✅ omega-lab UI | ✅ omega-lab UI | ✅ (reads from either) |

#### What Needs Porting: Proving Ground → AWS ✅ COMPLETE (v7.61.0)

All training architecture has been ported to production:

1. ✅ **Wirtinger e-prop** → Ported as Phase 4 in heartbeat handler. CPU/Graviton optimized. Uses `OmegaTrainer` from `radiant_omega.trainer`.
2. ✅ **PhaseAlignmentDecoder** → Available via `OmegaTrainer` import in heartbeat handler.
3. ✅ **TextEncoder (v3 attention)** → Available via `OmegaTrainer` import. Training data path configurable via `OMEGA_TRAINING_DATA_PATH` env var.
4. ✅ **Training loop** → Heartbeat handler Phase 4 runs limited epochs (env: `DREAM_TRAINING_EPOCHS`, default 5) to stay within Lambda timeout.

#### What Needs Porting: AWS → Proving Ground ✅ COMPLETE (v7.61.0)

All production features are now available in the proving ground:

1. ✅ **State persistence** → `LocalStorageManager` with atomic writes, auto-save, atexit hook, time_warp on wake
2. ✅ **Multi-session isolation** → `/sessions` API with independent `LocalBrain` per session
3. ✅ **ResonantIndex** → O(1) phase-based memory lookup with `/memory/*` endpoints
4. ✅ **Firmware system** → `/firmware/*` API with directives, drives, personality
5. ✅ **HomeostaticLoop** → Dream callback wired, entropy-triggered dream cycles
6. ✅ **Watcher** (self-awareness) → predict-and-surprise in think(), train in dream()
7. ✅ **Shadow Vector** — Post-LLM safety check in `/infer`
8. ✅ **Attribution** — OMEGA vs Ollama proof system in `/infer`
9. ✅ **Tunable params** — `GET/POST /config` for runtime hot-swap

---

## Part XII: OMEGA vs Legacy AI — Competitive Analysis & Roadmap (v7.56.0)

> **Classification**: RADIANT INTERNAL // STRATEGIC  
> **Version**: 7.56.0 | **Date**: February 10, 2026  
> **Status**: Living Draft — Updated with each architectural change  
> **Audience**: Engineers, investors, marketing

> ⚠️ **ENVIRONMENT SCOPE**: Competitive claims in this Part reflect the **combined
> vision** of OMEGA across both proving ground and AWS. Some capabilities (e-prop,
> PhaseAlignmentDecoder) are currently proving-ground-only. Claims are annotated with
> 🟢 (live on AWS), 🟡 (proving ground only), or 🔵 (planned) where ambiguity exists.

---

### XII.1 — Why OMEGA Is Fundamentally Different

OMEGA is not an incremental improvement on existing neural networks. It operates in a **different mathematical space** (complex-valued phase dynamics vs. real-valued scalar weights). This creates structural advantages that cannot be replicated by scaling existing architectures.

| Dimension | Legacy NN (Transformers, etc.) | OMEGA | Env |
|-----------|-------------------------------|-------|-----|
| **Parameters** | Scalar weights w ∈ ℝ | Phase angles θ ∈ [−π, π] | 🟢 AWS + Local |
| **Computation** | Matrix multiply + bias + activation | ODE integration with wave interference | 🟢 AWS + Local |
| **Learning** | Backpropagation (gradient descent) | Wirtinger e-prop (eligibility traces) | 🟡 Local only |
| **Memory** | O(parameters × activations) for gradients | O(parameters) — no computation graph | 🟡 Local only |
| **Safety** | Probabilistic (RLHF "prefers not to") | Deterministic (destructive interference "cannot") | 🟢 AWS + Local |
| **State** | Stateless (resets per request) | Persistent (survives across sessions) | 🟢 AWS only (EFS) |
| **Readout** | Learned classifier (softmax) | Physics-native (phase alignment) | 🟡 Local only |
| **Idle cost** | Full compute or full shutdown | $0 via cryogenic time-warp | 🟢 AWS only (Lambda) |

### XII.2 — Competitive Moats

#### Moat 1: Physics-Native Learning 🟢
OMEGA's learning rule (Wirtinger e-prop) is derived from the actual mathematics of complex differentiation. Competitors using standard PyTorch/TensorFlow cannot simply "add complex numbers" — their entire training infrastructure (autograd, optimizers, schedulers) assumes real-valued parameters. Replicating OMEGA requires re-deriving the learning rule from first principles.

**Defensibility**: HIGH. This is a mathematical moat, not an engineering moat. You can't buy it or copy-paste it.

**Status**: 🟢 Live on both AWS (heartbeat Phase 4) and proving ground. Ported via `radiant_omega.trainer` shared package.

#### Moat 2: Deterministic Safety 🟢
RLHF-trained safety in legacy systems is probabilistic — "the model usually doesn't say harmful things." OMEGA's HelixKernel makes dangerous outputs **mathematically impossible** via destructive interference. This is like the difference between "the car usually stays on the road" (lane-keeping assist) vs "the car cannot leave the road" (physical guardrails).

**Defensibility**: HIGH. Regulatory advantage in healthcare, finance, legal. Competitors cannot achieve deterministic safety without OMEGA's physics.

**Status**: 🟢 Live on both AWS and proving ground.

#### Moat 3: Zero-Cost Idle 🟢
Traditional AI systems either burn compute 24/7 or require cold-start times measured in seconds. OMEGA's cryogenic engine freezes brain state with O(1) time-warp recovery: `S_new = S_old · e^(-λΔt)`. Short-term memory fades naturally; long-term memory persists perfectly.

**Defensibility**: MEDIUM. The math is elegant but could be approximated by competitors. The advantage is that it's deeply integrated into OMEGA's architecture, not bolted on.

**Status**: 🟢 Live on both AWS (Lambda + EFS) and proving ground (LocalStorageManager + atexit + time_warp).

#### Moat 4: Biological Lock-In 🟢
The longer a tenant uses OMEGA, the more their brain's phase parameters encode institutional knowledge. Unlike LoRA adapters (which are portable between models), OMEGA's learned phase patterns are meaningless outside the OMEGA cortex. Switching costs increase with usage.

**Defensibility**: HIGH. Switching means losing all accumulated learning.

**Status**: 🟢 Live on both AWS (EFS state accumulates) and proving ground (LocalStorageManager persists across restarts).

#### Moat 5: Memory Efficiency 🟡
E-prop requires O(parameters) memory — no activation cache, no computation graph. Backprop on the same architecture would require O(parameters × sequence_length × batch_size) memory. For 8.4M parameters, e-prop uses ~32MB; backprop would use ~1GB+.

**Defensibility**: MEDIUM. Matters for edge deployment (phones, embedded). Less relevant for cloud.

**Status**: 🟢 Live on both AWS (heartbeat Phase 4) and proving ground.

### XII.3 — Honest Assessment: Current Limitations

| Limitation | Severity | Mitigation |
|------------|----------|------------|
| **Unproven at scale** | HIGH | Only tested with 68 examples / 25 behaviors. Unknown if phase dynamics scale to thousands of behaviors |
| **E-prop convergence unknown** | HIGH | Backprop achieved 4% (random). E-prop theory is sound but we haven't verified convergence yet |
| **Holographic capacity ~45 patterns** | MEDIUM | HRR theory limits superimposed patterns. May need hierarchical phase spaces for production |
| **No benchmarks vs. fine-tuned models** | HIGH | Need direct comparison: OMEGA+Llama vs. LoRA-tuned Llama on same task |
| ~~Frozen TextEncoder may limit input quality~~ | ✅ RESOLVED | v3 attention encoder broke through 98.45% ceiling → 98.72% |
| **MPS complex tensor limitations** | LOW | `.norm()`, `.conj()` workarounds needed; functional but inelegant |
| **~~Single-tenant proving ground~~** | ~~MEDIUM~~ | ✅ RESOLVED — `/sessions` API provides independent brain instances per session |

### XII.4 — Marketing Positioning

#### The Elevator Pitch
> "OMEGA is the only AI system that thinks with physics instead of statistics. Traditional AI multiplies numbers and hopes for the best. OMEGA rotates waves and guarantees safety. It costs nothing when idle, learns from zero examples what GPT needs thousands to learn, and gets smarter the longer you use it — creating an intelligence that's uniquely yours and fundamentally irreplaceable."

#### For Technical Buyers
> "OMEGA replaces backpropagation with Wirtinger-correct eligibility traces — a biologically plausible learning rule that runs entirely on GPU with O(1) memory per parameter. Safety isn't RLHF; it's destructive interference in the Helix Kernel. There is no probability that the system produces forbidden output — the mathematics prevent it."

#### For C-Suite
> "Your AI assistant forgets everything between conversations. OMEGA doesn't. It builds institutional knowledge that compounds over time, costs nothing when your team is asleep, and has safety guarantees your legal team will love. The longer you use it, the more valuable it becomes — and the harder it is for competitors to replicate."

### XII.5 — Roadmap & Proposals Under Evaluation

#### Confirmed Next Steps
1. **Verify e-prop convergence** — Run 50+ epochs, compare accuracy to backprop baseline
2. **State persistence** — Serialize conscious/subconscious streams across restarts
3. **Shadow Vector safety** — Post-LLM output verification via MiniLM embedding
4. **OMEGA vs. Ollama attribution** — Prove which system contributed to each response

#### Under Evaluation: Hybrid Sidecar Architecture
**Proposal**: Use OMEGA's phase state to perform activation steering on the LLM (Llama). Instead of sending text prompts, inject OMEGA's thought vector directly into the LLM's residual stream via a logit processor hook in `llama.cpp` or `vLLM`.

**Status**: Under review. See Section XII.6 for full analysis.

#### Under Evaluation: Soft Global Attention (RAG Replacement)
**Proposal**: Replace RAG (hard retrieval of top-K chunks) with a linear attention head that computes a weighted summary over ALL documents simultaneously, injected as a single context vector.

**Status**: Under review. See Section XII.6 for full analysis.

#### Under Evaluation: Semantic Sampling (Logit Biasing)
**Proposal**: Use OMEGA's phase state to bias LLM token probabilities before sampling, suppressing unsafe/incorrect tokens via destructive interference.

**Status**: Under review. See Section XII.6 for full analysis.

### XII.6 — Gemini Proposal Analysis: Sidecar, Soft Attention, Semantic Sampling

*(Full engineering analysis of the three proposals from Gemini. This section is a living evaluation — updated as we prototype and test each approach.)*

#### Proposal 1: Hybrid Sidecar Architecture

**Concept**: Keep the external API as standard text (OpenAI-compatible), but hook into the LLM inference engine to inject OMEGA's control vectors into the residual stream during token generation.

**Implementation Path**:
- Use `llama.cpp` server mode or `vLLM` with custom LogitProcessor
- OMEGA produces a control vector from its phase state
- During inference, add control vector to residual stream: `x = x + v_control`
- Output remains standard text

**Assessment**:

| Factor | Rating | Notes |
|--------|--------|-------|
| Technical feasibility | ✅ High | `vLLM` supports LogitProcessors; `llama.cpp` has callback hooks |
| OMEGA integration | ✅ Natural | OMEGA already produces complex state vectors; just need a projection to LLM dim |
| API compatibility | ✅ Perfect | External interface unchanged |
| Performance cost | ⚠️ Low-Medium | One additional vector add per layer per token. Negligible vs. attention cost |
| Replaces LoRA? | ⚠️ Partially | Activation steering is real-time and dynamic. LoRA is static. They serve different purposes |
| Risk | ⚠️ Medium | Residual stream injection can destabilize generation if vectors are too large. Needs careful calibration |

**Recommendation**: **YES — implement and test**. This is the natural evolution of OMEGA's Neural Transducer (which already produces soft tokens). The Sidecar approach is more principled: instead of prepending soft tokens to the prompt, inject them into the computation itself. Start with `llama.cpp` server hooks since Ollama wraps `llama.cpp` internally.

**Impact on RADIANT apps**: Think Tank, Curator, Dojo — any app using LLM inference would benefit from OMEGA-steered generation. The improvement is invisible to the frontend (same API) but the LLM "feels" OMEGA's intent.

#### Proposal 2: Soft Global Attention (RAG Replacement)

**Concept**: Replace vector DB retrieval (search top-K chunks, paste into prompt) with a linear attention head that computes a weighted summary over the entire document corpus, producing a single context vector.

**Implementation Path**:
- Embed all documents into Key (K) and Value (V) matrices stored in RAM
- On query, compute Query vector Q
- Attention: `context = softmax(Q @ K.T / √d) @ V`
- Inject context vector into LLM via Sidecar

**Assessment**:

| Factor | Rating | Notes |
|--------|--------|-------|
| Technical feasibility | ✅ High | Standard linear attention. Can run on CPU |
| Token savings | ✅ Major | 1 vector instead of 5,000 words of retrieved chunks |
| Global context | ✅ Superior | Sees entire corpus simultaneously, not just top-K |
| Replaces RAG? | ⚠️ For most cases | RAG is better when you need exact quotes or citations. Soft attention gives "gist" not "verbatim" |
| Memory cost | ⚠️ Medium | Full K/V matrices in RAM. For 10K docs × 768-dim = ~30MB. For 1M docs = ~3GB |
| Latency | ✅ Fast | Single matmul over entire corpus. O(N) but highly parallelizable |
| Risk | ⚠️ Medium | Loses attribution — you can't point to "which chunk" contributed. Important for compliance |

**Recommendation**: **YES — implement as complement to RAG, not replacement**. Use Soft Global Attention as the primary context injection path (fast, cheap, global). Fall back to traditional RAG when:
- User needs exact citations/quotes
- Compliance requires audit trail of which documents influenced output
- Corpus is too large for RAM (>1M documents)

**Impact on RADIANT apps**:
- **Think Tank**: Massive improvement. Current RAG misses cross-document synthesis. Soft attention would let OMEGA reason across an entire knowledge base simultaneously
- **Curator**: Moderate. Document review benefits from exact retrieval more than gist
- **Cost**: Replaces per-query vector DB calls ($) with a one-time RAM allocation. Net savings at scale

#### Proposal 3: Semantic Sampling (Logit Biasing)

**Concept**: Use OMEGA's phase state to bias the LLM's output token probabilities before sampling. Suppress tokens that violate safety/schema constraints via destructive interference.

**Implementation Path**:
- LLM produces logits for next token
- Project each candidate token into OMEGA's phase space
- Compute alignment with safety/schema vectors
- Multiply logits by alignment score (constructive = amplify, destructive = suppress)
- Sample from modified distribution

**Assessment**:

| Factor | Rating | Notes |
|--------|--------|-------|
| Technical feasibility | ✅ High | LogitProcessor in `vLLM`/`llama.cpp`. Well-established pattern (grammar-constrained decoding) |
| Safety improvement | ✅ Major | Deterministic suppression of unsafe tokens at generation time |
| Schema enforcement | ✅ Major | Guaranteed JSON schema compliance, correct types, no hallucinated fields |
| Agent reliability | ✅ Major | Breaks loops, forces tool-call diversity, prevents repetition |
| Performance cost | ⚠️ Medium | Need to project vocab (32K-128K tokens) into phase space per generation step. ~1ms overhead per token |
| OMEGA integration | ✅ Natural | Extends HelixKernel concept from thought-space to token-space |
| Risk | ⚠️ Low | Worst case: slightly degraded fluency from over-suppression. Easy to tune temperature |

**Recommendation**: **YES — highest ROI of the three proposals**. This directly solves the #1 complaint with AI agents: unreliable function calling. OMEGA already has the HelixKernel for thought-level safety; Semantic Sampling extends it to word-level safety. This is the feature that makes OMEGA "the only AI system that controls the Model, not just the Prompt."

**Impact on RADIANT apps**:
- **Think Tank**: Guaranteed schema compliance in structured outputs. No more "sorry, I can't format that as JSON"
- **Cato Pipeline**: Agent method calls never produce invalid arguments. Loop detection becomes trivial
- **Dojo**: Training exercises can constrain output format deterministically
- **All apps**: Safety enforcement moves from "hope RLHF works" to "mathematically guaranteed"

### XII.7 — Cost Analysis: Implementing the Three Proposals

| Proposal | Development Effort | Infra Cost | Ongoing Cost |
|----------|-------------------|------------|--------------|
| **Sidecar** | 2-3 weeks | Switch from Ollama to `vLLM`/`llama.cpp` server. Requires Python process or Go binary | Negligible per-request overhead |
| **Soft Global Attention** | 1-2 weeks | RAM for K/V matrices (~30MB per 10K docs per tenant) | Memory scales with corpus size |
| **Semantic Sampling** | 1-2 weeks | Vocab projection cache (~50MB one-time) | ~1ms overhead per generated token |

**Total estimated cost**: 5-7 weeks engineering, ~100MB additional RAM per tenant, <2ms additional latency per token.

**Revenue impact**: These features create a product category that doesn't exist. No competitor offers physics-based model steering + deterministic safety + global context injection. Pricing premium justified.

### XII.8 — Implementation Priority

| Priority | Proposal | Why |
|----------|----------|-----|
| 1 | **Semantic Sampling** | Highest ROI. Solves agent reliability. Extends existing HelixKernel |
| 2 | **Sidecar Architecture** | Enables proposals 1 and 3. Required infrastructure |
| 3 | **Soft Global Attention** | Improves context quality. Can be added incrementally |

**Note**: The Sidecar is infrastructure that enables the other two. Technically it should be built first, but Semantic Sampling can be prototyped with Ollama's existing logit bias parameter as a proof of concept before committing to the `vLLM` migration.

### XII.9 — What This Means for LoRA and RAG

#### Should we replace LoRA?
**No — complement it.**

LoRA provides static personality/domain adaptation (baked in at fine-tune time). OMEGA's Sidecar provides dynamic real-time steering (changes per request based on context). They operate at different timescales:

| Mechanism | Timescale | Analogy |
|-----------|-----------|---------|
| LoRA | Days-weeks (fine-tuning cycle) | "I studied medicine for 4 years" |
| OMEGA Sidecar | Milliseconds (per inference) | "Right now I'm talking to a worried patient" |

The optimal architecture is **LoRA + Sidecar**: LoRA sets the domain expertise, OMEGA steers the real-time behavior. This is uniquely powerful and no competitor offers it.

#### Should we replace RAG?
**Partially — add Soft Global Attention as the fast path.**

| Use Case | Best Approach |
|----------|---------------|
| "What's our refund policy?" | RAG (exact document retrieval) |
| "Synthesize insights from all customer feedback" | Soft Global Attention (global context) |
| "Summarize this quarter's reports" | Soft Global Attention (cross-document synthesis) |
| "Quote the specific clause in contract §4.2" | RAG (verbatim retrieval) |
| "What should I recommend to this customer?" | OMEGA phase alignment (behavioral) |

The winning architecture: **OMEGA behavioral decision → Soft Global Attention for context → RAG for citations → Sidecar for steering → Semantic Sampling for safety**.

---

*OMEGA Complete Reference — consolidated from docs 09 + 19. All OMEGA-related changes MUST be documented in this file.*
