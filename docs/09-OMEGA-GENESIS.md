# OMEGA Protocol & Genesis

**OMEGA Protocol • Genesis Forge • Genesis Lab • Resonant Index**

*RADIANT v6.6.0 — Generated February 07, 2026*

---

## Table of Contents

- **Part I: OMEGA User Guide**
- **Part II: OMEGA Admin Guide**
- **Part III: Project Genesis OMEGA**
- **Part IV: Genesis Components**
- **Part V: Omega Point & LIVS-M**
- **Part VI: Quantum-Inspired Architecture (v4.18.0)**
- **Part VII: Firmware Hot-Swap Engineering Specification (v6.4.0)**
- **Part VIII: Firmware Live Updates — End-User Guide (v6.4.0)**

---


---

## Part I: OMEGA User Guide

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


---

## Part II: OMEGA Admin Guide

> **Classification**: RADIANT INTERNAL // STRATEGIC  
> **Version**: 2.0.0 | **Date**: February 6, 2026  
> **Status**: IMPLEMENTED — Full Admin Operations  
> **Part of**: RADIANT Platform — Project Genesis  
> **Admin Dashboard**: Platform → OMEGA

---

## 1. Overview

This guide covers all administrative operations for the OMEGA Synthetic Biological Intelligence system. Administrators use the **RADIANT Admin Dashboard** (OMEGA section) and the **Genesis Lab** (`apps/genesis/`) to manage OMEGA brains, firmware, Shadow Mode, and infrastructure.

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

The **Cortex Explorer** (in Genesis Lab or Admin Dashboard) shows:

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

### 4.2 Creating Firmware (Genesis Forge)

1. Open Genesis Lab → **Genesis Forge** tab
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

The `useShadowOmega()` React hook provides real-time bi-directional telemetry between Genesis Forge and live OMEGA instances:

| Event | Direction | Description |
|-------|-----------|-------------|
| **telemetry** | OMEGA → Forge | Real-time coherence, entropy, phase data |
| **edge_rejection** | OMEGA → Forge | Helix Kernel blocked a vector |
| **stability_update** | OMEGA → Forge | Stability score changes → UI hue shift |
| **command** | Forge → OMEGA | Firmware hot-swap, snapshot, parameter change |

### Global UI Hue Shift

Genesis Forge's UI color shifts based on the OMEGA stability score:
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

**Document maintained under RADIANT documentation policy. Any changes to OMEGA infrastructure, admin API, Genesis Lab, Genesis Forge, Shadow Mode, or Neural Bridge MUST update this guide.**


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

### 7.2 The Genesis Forge

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

### 8.2 Shadow Mode Visualization (Genesis Lab)

We build a **Genesis Dashboard** (React/Three.js):

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

### Core Package (`packages/infrastructure/lambda/omega_core/`)

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

### Genesis Frontend (`apps/genesis/`)

| Component | Description | Status |
|-----------|-------------|--------|
| Dashboard | Real-time brain monitoring | ✅ Complete |
| Cortex Explorer | Brain inspection/management | ✅ Complete |
| Genesis Forge | Firmware editor (.bio files) | ✅ Complete |

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

- [GENESIS-LAB.md](./GENESIS-LAB.md) - Genesis Lab visualization guide
- [GENESIS-FORGE.md](./GENESIS-FORGE.md) - Firmware creation guide
- [GENESIS-RESONANT-INDEX.md](./GENESIS-RESONANT-INDEX.md) - Resonant indexing deep dive
- [RADIANT-MOATS.md](./RADIANT-MOATS.md) - Competitive advantages


---

## Part IV: Genesis Components

> **Classification**: RADIANT INTERNAL // STRATEGIC // DO NOT DISTRIBUTE  
> **Version**: 3.0.0 | **Date**: February 6, 2026  
> **Status**: IMPLEMENTED — Behavioral ROM Forge  
> **Part of**: THE OMEGA PROTOCOL  
> **Ecosystem**: RADIANT Think Tank (The Machine Layer)  
> **Core Integration**: Permanently tethered to Shadow Omega (The Simulation Kernel)

---

## 1. Core Philosophy

Genesis Forge is **not a code editor**; it is a **Digital Smithy**. Standard IDEs are static—you write code and hope it works. Genesis is a **"Twin-First"** environment.

| Role | Description |
|------|-------------|
| **The User** | Acts as an Architect, placing "Logic Nodes" and "Hardware Shards" |
| **The System (Shadow Omega)** | Runs a continuous, high-speed physics simulation of the board |
| **The Output** | Not just code; it is "grown" binary, optimized for the specific silicon structure |

Genesis Forge is **permanently hard-wired to Shadow Omega**. Each OMEGA instance has a unique **ID** and **Name** in the **Omega Instance Registry**. The Forge can connect to and communicate with **any** registered instance at a time, selecting from the registry dropdown.

> **Reasoning**: Genesis is the Hand (The Interface), but Shadow Omega is the Mind (The Physics Engine). You cannot forge advanced firmware without a simulation engine predicting thermal loads, latency, and collisions in real-time.

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
| 5 | **Silkscreen** | Board border, title (`OMEGA-PCB-XX REV.A`), `GENESIS FORGE v3` |
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
Genesis Forge (Frontend)
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
apps/genesis/
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
│   ├── GenesisForge.tsx               # Legacy firmware editor (retained)
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

Genesis Forge is the **firmware creation and management tool** for OMEGA brains. It allows administrators to create, edit, and deploy `.bio` firmware files that define a brain's safety rules, ambition parameters, and personality traits.

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

Genesis Forge includes an **AI Generation** feature that uses a Legacy LLM to draft firmware configurations:

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
2. **Snapshot Restore**: Use Genesis Lab to restore brain from pre-update snapshot
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

Genesis Lab is the **real-time visualization and monitoring dashboard** for OMEGA bio-mimetic brains. It provides administrators with deep insight into the **Bicameral Mind** architecture, thermal states, coherence metrics, phase distributions, and the Shadow Protocol training status.

Genesis Lab is the primary interface for observing and managing **Synthetic Biological Intelligence** as defined in [PROJECT-GENESIS-OMEGA.md](PROJECT-GENESIS-OMEGA.md).

---

## The Bicameral Mind Architecture

Genesis Lab visualizes the **two-chambered brain** design that separates high-level reasoning from linguistic generation:

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

Genesis Lab monitors all five biological regions of the OMEGA brain:

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

### 4. Genesis Forge Tab

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
cd apps/genesis
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

# PART I: MARKETING & POSITIONING

---

## Chapter 1: Executive Value Proposition

### 1.1 The One-Sentence Pitch

**RADIANT Think Tank is the world's first Neural Infrastructure platform—an AI system that doesn't just use tools, it becomes them, creating infinite capabilities on-demand while keeping your data sovereign.**

### 1.2 The Problem We Solve

| Problem | How Competitors Fail | How RADIANT Solves It |
|---------|---------------------|----------------------|
| **Tool Scarcity** | ChatGPT/Claude have ~50 built-in tools | Genesis Forge creates any tool in < 2 minutes |
| **Cloud Lock-In** | Every query goes to remote servers | Liquid Compute runs locally, data never leaves |
| **Dumb Routing** | Same model for all queries | Neural Affinity routes to optimal model from 106+ |
| **Generic Safety** | Static content filters | Ghost Simulation predicts YOUR reaction |
| **Cost Chaos** | No visibility, surprise bills | Economic Cortex manages budgets autonomously |

### 1.3 Neural Infrastructure vs. Agentic Software

**Agentic Software** (Competitors):
- Wraps LLM around fixed APIs
- Hard-coded integrations that break
- Static capabilities requiring engineering
- Cloud-dependent, privacy-invasive

**Neural Infrastructure** (RADIANT):
- AI IS the infrastructure—generates, routes, executes dynamically
- Self-healing integrations via overnight Twilight Dreaming
- Infinite capabilities through JIT tool generation
- Edge-native execution respecting data sovereignty

### 1.4 Target Markets

**Primary: Professional Knowledge Workers**
- Lawyers needing accuracy (malpractice risk)
- Doctors needing compliance (patient safety)
- Engineers needing precision (tolerances)
- Researchers needing depth (citations)

**Secondary: Enterprise AI Teams**
- Building internal AI applications
- Need infrastructure, not chatbots
- Want to inherit AI advances without rebuilding

---

## Chapter 2: The Five Moats

### 2.1 MOAT #1: Genesis Forge (Infinite Tool Generation)

**The 7-Phase Pipeline:**

| Phase | Duration | Description |
|-------|----------|-------------|
| 1. Detection | 100ms | No existing tool matches intent |
| 2. Scouting | 5-30s | Search API docs (OpenAPI, GraphQL, HTML) |
| 3. Fabrication | 30-60s | AGI Brain generates MCP server code |
| 4. Sandboxing | 10-20s | Firecracker microVM isolation |
| 5. Validation | 5-10s | SAST scan, functional tests |
| 6. Mounting | 1-2s | Hot-load into active session |
| 7. Twilight Review | Overnight | Promote to global library |

**Competitor Comparison:**

| Competitor | Tools | Time to New Tool |
|------------|-------|------------------|
| ChatGPT | ~50 | Months (OpenAI engineering) |
| Claude | ~30 | Months (Anthropic engineering) |
| Abacus.AI | ~50 | Weeks (human developers) |
| **RADIANT** | **∞** | **< 2 minutes, automatic** |

**Defensibility:** 18+ months to replicate from scratch.

---

### 2.2 MOAT #2: Liquid Compute Topology (Data Sovereignty)

**Compute Nodes:**

| Node | Location | Privacy | Speed | Cost |
|------|----------|---------|-------|------|
| Browser WASM | Your browser | ★★★★★ | 5ms | $0 |
| Local Native | Your computer | ★★★★★ | 1ms | $0 |
| Lambda@Edge | Nearest AWS | ★★★☆☆ | 20ms | $0.0001 |
| Lambda Regional | Tenant region | ★★★☆☆ | 50ms | $0.001 |
| ECS Fargate | Cloud container | ★★☆☆☆ | 100ms | $0.01 |
| GPU Cluster | Cloud GPU | ★☆☆☆☆ | 200ms | $0.10 |

**Sensitivity Rules:**
- `public`: Anywhere
- `internal`: Not browser
- `confidential`: Local or cloud only
- `restricted`: Local ONLY

**Scoring Formula:**
```
score = (privacy × 0.25) + (latency × 0.30) + (cost × 0.20) 
      + (capability × 0.15) + (availability × 0.10)
```

---

### 2.3 MOAT #3: Neural Affinity Routing (106+ Models)

**The Formula:**
```
affinityScore = (semantic × 0.35) + (domain × 0.25) + ((1-error) × 0.20)
              + (latency × 0.10) + (cost × 0.10)
```

**Example Routing:**

| Query | Routed To | Why |
|-------|-----------|-----|
| "What's 2+2?" | GPT-4 Mini | Fast, cheap |
| "Analyze this contract" | Claude Opus + Legal Expert | Highest legal accuracy |
| "Translate to Japanese" | GPT-4 Turbo | Best multilingual |
| "Summarize private notes" | Local Llama | Privacy-sensitive |

---

### 2.4 MOAT #4: Ghost Simulation (Personalized Safety)

**Ghost Vector Architecture (4096 dimensions):**
- Preference Vector (1024 dim): Communication style, risk tolerance
- Behavior Vector (1024 dim): Patterns, time-of-day preferences
- Emotional Vector (1024 dim): Anxiety, frustration thresholds
- Knowledge Vector (1024 dim): Domain expertise, vocabulary

**Simulation Types:**
- `user_reaction`: Predict emotional response
- `outcome_prediction`: Predict task success
- `safety_check`: Identify regret potential
- `cost_estimation`: Predict financial impact
- `latency_estimation`: Predict time requirements

---

### 2.5 MOAT #5: Economic Cortex (Budget Management)

**Budget Hierarchy:**
```
Tenant ($10,000/month)
  └── User ($500/month)
       └── Session ($20/day)
            └── Task ($5)
```

**Alert Thresholds:**
| Threshold | Level | Actions |
|-----------|-------|---------|
| 50% | info | Notify user |
| 75% | warning | Notify admin, switch tier |
| 90% | critical | Force lower tier |
| 100% | exceeded | Pause (if hardLimit) |

**Model Tiers:**
| Tier | Cost/Token | Quality |
|------|------------|---------|
| economy | $0.0001 | 0.70 |
| selfhosted | $0.00005 | 0.75 |
| standard | $0.0005 | 0.85 |
| premium | $0.002 | 0.92 |
| flagship | $0.006 | 0.98 |

---

## Chapter 3: Competitive Positioning

### 3.1 vs ChatGPT

| Dimension | ChatGPT | RADIANT |
|-----------|---------|---------|
| Models | GPT-4 only | 106+ optimal selection |
| Tools | ~50 | ∞ (Genesis Forge) |
| Privacy | All to OpenAI | Edge-native, sovereign |
| Safety | Generic filters | Personalized Ghost |
| Cost | No control | Autonomous Cortex |

### 3.2 vs Claude

| Dimension | Claude | RADIANT |
|-----------|--------|---------|
| Tools | Limited MCP | 3,000+ static, ∞ dynamic |
| Privacy | All to Anthropic | Your choice |
| Context | 200K tokens | 200K + CORTEX memory |
| Specialization | General | 800+ domain experts |

### 3.3 vs Abacus.AI

| Dimension | Abacus.AI | RADIANT |
|-----------|-----------|---------|
| Price | $10/month | Premium |
| Tools | 50 static | ∞ dynamic |
| Architecture | Cloud-locked | Liquid Compute |
| Interface | JSON-RPC | Tensor-Link (100x faster) |

---

# PART II: TECHNICAL DOCUMENTATION

---

## Chapter 4: Architecture Overview

### 4.1 Organism Services (9 total)

| Service | File | Lines | Purpose |
|---------|------|-------|----------|
| MCP Server Manager | `mcp-server-manager.service.ts` | 767 | Server registry, health, routing |
| Neural Schema Registry | `neural-schema-registry.service.ts` | ~600 | Tool schemas, embeddings |
| Genesis Auto-Tool | `genesis-auto-tool.service.ts` | 1234 | JIT tool generation |
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
- Creates tools on demand (Genesis Forge)
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
| **Genesis Forge** | Automatic tool creation system |
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
│                         GENESIS FORGE UI                                │
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
│  1. AUTHOR     Admin creates .bio in Genesis Forge                  │
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

Cartridges are portable AI brains that can also be hot-swapped:

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
| PROMPT-46 | Complete OMEGA + Genesis Forge composite prompt |

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

*Consolidated from 8 source documents (0 not found). 2,999 source lines.*
