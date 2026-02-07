# Genesis Lab

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
