# Genesis Forge — "The Glass Foundry"

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
