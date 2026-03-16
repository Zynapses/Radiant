# Cartridge Specializations — Brain-Mapped AI Modules

**Specialization Taxonomy • Brain Metaphors • Cartridge Architecture**

*RADIANT v7.49.0 — March 16, 2026*

---

> **Document Policy**
>
> | Field | Value |
> |-------|-------|
> | **Document ID** | DOC-24 |
> | **Type** | Architecture Specification — Consolidated |
> | **Owner** | AI Systems Engineering |
> | **Status** | ACTIVE |
> | **Priority** | HIGH |
> | **Review Cadence** | On every cartridge feature change or quarterly |
> | **Manifest Entry** | `docs/24-CARTRIDGE-SPECIALIZATIONS.md` |
> | **Update Triggers** | `cartridge`, `specialization`, `radz`, `brain_mapped`, `pki`, `cartridge_vault`, `rnir`, `cartridge_operations`, `cartridge_composition`, `thalamus_router` |
> | **Related Docs** | [07-AI-SYSTEMS.md](./07-AI-SYSTEMS.md), [09-OMEGA-GENESIS.md](./09-OMEGA-GENESIS.md), [15-STRATEGY-COMPETITIVE.md](./15-STRATEGY-COMPETITIVE.md), [04-RADIANT-ADMIN.md](./04-RADIANT-ADMIN.md), [12-API-REFERENCE.md](./12-API-REFERENCE.md) |
> | **Glossary Sync** | REQUIRED — new cartridge terms must be added to [17-GLOSSARY.md](./17-GLOSSARY.md) |
> | **Assembly** | Included in auto-assembled `RADIANT-THINKTANK-COMPLETE-DOCUMENTATION.md` via `tools/scripts/assemble-complete-documentation.py` |
>
> **⚠️ This document MUST be updated when**: a new cartridge specialization is added, the .RADz format changes, PKI/vault/RNIR features are modified, routing logic changes, or cartridge API endpoints are added/modified. See `DOCUMENTATION-MANIFEST.json` triggerMatrix for the full dependency map.

---

## Table of Contents

- **Part I: Overview & Design Philosophy**
- **Part II: Specialization Taxonomy**
- **Part III: Detailed Specialization Reference**
- **Part IV: Cartridge Composition & Routing**
- **Part V: Implementation Guidelines**
- **Part VI: .RADz Package Format & Contents**
- **Part VII: Cartridge Scopes, Stack Resolution & Thermal States**
- **Part VIII: Cartridge PKI & Federation**
- **Part IX: Cartridge Vault, RNIR & Operations**
- **Part X: Competitive Positioning**
- **Part XI: API Reference**

---

## Part I: Overview & Design Philosophy

> **Version**: 1.0.0
> **Last Updated**: March 15, 2026
> **Document Type**: Architecture Specification
> **Parent Reference**: [07-AI-SYSTEMS.md](./07-AI-SYSTEMS.md) — AGI Brain Architecture

### 1.1 What Are Cartridge Specializations?

RADIANT Cartridges are modular, hot-swappable AI capability units. Each cartridge encapsulates a **specific cognitive function** mapped to a biological brain region. This brain-mapped taxonomy provides:

- **Intuitive naming** — Engineers and stakeholders immediately understand function
- **Compositional clarity** — Brain regions combine naturally; so do cartridges
- **Architectural alignment** — Mirrors the AGI Brain's existing biological brain analogy (see [07-AI-SYSTEMS § 1. Biological Brain Analogy](./07-AI-SYSTEMS.md))
- **Routing semantics** — The Thalamus cartridge dispatches to specialized regions, just as the biological thalamus relays sensory input

### 1.2 Design Principles

| Principle                       | Description                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| **Single Responsibility** | Each cartridge owns one cognitive domain                                                |
| **Hot-Swappable**         | Cartridges can be loaded, replaced, or versioned at runtime via OMEGA Firmware Hot-Swap |
| **Composable**            | Multiple cartridges combine into cognitive pipelines                                    |
| **Observable**            | Every cartridge emits telemetry compatible with the Consciousness Services layer        |
| **Safety-First**          | All cartridges pass through the Helix Kernel safety layer before execution              |

---

## Part II: Specialization Taxonomy

### 2.1 Master Specialization Table

| Specialization                    | Brain Metaphor         | What It Does                                            | Cartridge ID                          |
| --------------------------------- | ---------------------- | ------------------------------------------------------- | ------------------------------------- |
| **Reasoning**               | Prefrontal Cortex      | Logic, planning, multi-step inference, chain-of-thought | `cartridge.reasoning.prefrontal`    |
| **Language**                | Broca / Wernicke Areas | NLP, translation, comprehension, summarization          | `cartridge.language.broca-wernicke` |
| **Memory**                  | Hippocampus            | Knowledge retrieval, RAG pipelines, context recall      | `cartridge.memory.hippocampus`      |
| **Creativity**              | Default Mode Network   | Generative content, creative writing, ideation          | `cartridge.creativity.dmn`          |
| **Code**                    | Motor Cortex           | Code generation, execution, debugging, refactoring      | `cartridge.code.motor-cortex`       |
| **Emotion / Sentiment**     | Amygdala               | Tone detection, empathy modeling, sentiment analysis    | `cartridge.emotion.amygdala`        |
| **Routing / Orchestration** | Thalamus               | Task dispatch, model selection, pipeline routing        | `cartridge.routing.thalamus`        |
| **Domain Expertise**        | Nucleus Accumbens      | Specialized knowledge clusters, vertical fine-tuning    | `cartridge.domain.nucleus`          |

### 2.2 Visual Brain Map

```
                    ┌─────────────────────────────────┐
                    │     PREFRONTAL CORTEX            │
                    │     🧠 Reasoning Cartridge       │
                    │     Logic · Planning · CoT       │
                    └──────────────┬──────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
  ┌───────▼────────┐    ┌─────────▼─────────┐    ┌────────▼────────┐
  │ BROCA/WERNICKE │    │    THALAMUS        │    │  DEFAULT MODE   │
  │ 🗣 Language     │    │ 🔀 Routing         │    │  NETWORK        │
  │ NLP · Translate │    │ Dispatch · Select  │    │ ✨ Creativity    │
  └───────┬────────┘    └─────────┬─────────┘    │ Generative      │
          │                       │               └────────┬────────┘
          │              ┌────────┼────────┐               │
          │              │        │        │               │
  ┌───────▼──────┐ ┌─────▼────┐ ┌▼──────┐ ┌▼──────────────▼──┐
  │ HIPPOCAMPUS  │ │ AMYGDALA │ │ MOTOR │ │    NUCLEUS        │
  │ 📚 Memory    │ │ 💗 Emotion│ │CORTEX │ │ 🏛 Domain Expertise│
  │ RAG · Recall │ │ Sentiment│ │ 💻 Code│ │ Vertical Knowledge │
  └──────────────┘ └──────────┘ └───────┘ └───────────────────┘
```

---

## Part III: Detailed Specialization Reference

### 3.1 Reasoning — Prefrontal Cortex

> **Cartridge ID**: `cartridge.reasoning.prefrontal` 
> **Brain Region**: Prefrontal Cortex
> **Biological Function**: Executive function, planning, decision-making

| Attribute                    | Value                                                         |
| ---------------------------- | ------------------------------------------------------------- |
| **Primary Capability** | Multi-step logical inference, chain-of-thought reasoning      |
| **Input Types**        | Structured prompts, decision trees, constraint sets           |
| **Output Types**       | Reasoned conclusions, plans, step-by-step solutions           |
| **Typical Models**     | Large parameter reasoning-tuned LLMs (o1-class, DeepSeek-R1)  |
| **Latency Profile**    | High (seconds) — deep inference requires extended generation |
| **Composition**        | Often paired with Memory (Hippocampus) for grounded reasoning |

**Use Cases**:

- Multi-step problem solving
- Strategic planning and decision trees
- Mathematical and logical proofs
- Agentic OODA loop planning

---

### 3.2 Language — Broca / Wernicke Areas

> **Cartridge ID**: `cartridge.language.broca-wernicke` 
> **Brain Region**: Broca's Area (production) + Wernicke's Area (comprehension)
> **Biological Function**: Language production and comprehension

| Attribute                    | Value                                                    |
| ---------------------------- | -------------------------------------------------------- |
| **Primary Capability** | NLP, translation, summarization, comprehension           |
| **Input Types**        | Natural language text, multilingual content              |
| **Output Types**       | Translated text, summaries, parsed entities              |
| **Typical Models**     | Multilingual LLMs, encoder-decoder translation models    |
| **Latency Profile**    | Low–Medium                                              |
| **Composition**        | Feeds into Reasoning (Prefrontal) and Emotion (Amygdala) |

**Use Cases**:

- Real-time translation across 100+ languages
- Document summarization and abstraction
- Named entity recognition and relation extraction
- Text classification and intent detection

---

### 3.3 Memory — Hippocampus

> **Cartridge ID**: `cartridge.memory.hippocampus` 
> **Brain Region**: Hippocampus
> **Biological Function**: Memory consolidation, spatial navigation, learning

| Attribute                    | Value                                                                |
| ---------------------------- | -------------------------------------------------------------------- |
| **Primary Capability** | Knowledge retrieval, RAG pipelines, episodic context recall          |
| **Input Types**        | Queries, embeddings, conversation history                            |
| **Output Types**       | Retrieved context chunks, relevance-scored documents                 |
| **Typical Models**     | Embedding models + vector stores (pgvector, FAISS)                   |
| **Latency Profile**    | Low (milliseconds for retrieval)                                     |
| **Composition**        | Foundational — feeds context to Reasoning, Language, and Creativity |

**Use Cases**:

- Retrieval-Augmented Generation (RAG) pipelines
- Long-term conversation memory
- Knowledge base search and semantic retrieval
- Episodic memory replay for learning

**Integration with AGI Brain**: Maps directly to the existing Episodic Memory Service and Cortex Memory System (see [07-AI-SYSTEMS § Part IV](./07-AI-SYSTEMS.md)).

---

### 3.4 Creativity — Default Mode Network

> **Cartridge ID**: `cartridge.creativity.dmn` 
> **Brain Region**: Default Mode Network (DMN)
> **Biological Function**: Mind-wandering, imagination, self-referential thought

| Attribute                    | Value                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| **Primary Capability** | Generative content, creative writing, brainstorming                                    |
| **Input Types**        | Open-ended prompts, style guides, creative briefs                                      |
| **Output Types**       | Stories, poems, marketing copy, novel ideas                                            |
| **Typical Models**     | High-temperature creative LLMs, fine-tuned writing models                              |
| **Latency Profile**    | Medium                                                                                 |
| **Composition**        | Enhanced by Language (Broca/Wernicke) for style; constrained by Reasoning (Prefrontal) |

**Use Cases**:

- Creative writing and storytelling
- Marketing copy and ad generation
- Brainstorming and ideation sessions
- Art direction prompts for image generation

**Integration with AGI Brain**: Aligns with Homeostatic Dreaming — the DMN is active during "sleep cycles" for selective memory consolidation.

---

### 3.5 Code — Motor Cortex

> **Cartridge ID**: `cartridge.code.motor-cortex` 
> **Brain Region**: Motor Cortex
> **Biological Function**: Voluntary movement, fine motor control

| Attribute                    | Value                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| **Primary Capability** | Code generation, execution, debugging, refactoring                                  |
| **Input Types**        | Code prompts, error traces, repository context                                      |
| **Output Types**       | Source code, diffs, execution results, test suites                                  |
| **Typical Models**     | Code-specialized LLMs (Codex-class, DeepSeek-Coder)                                 |
| **Latency Profile**    | Medium–High (complex generation)                                                   |
| **Composition**        | Uses Reasoning (Prefrontal) for planning; Memory (Hippocampus) for codebase context |

**Use Cases**:

- Code generation from natural language specifications
- Automated debugging and error resolution
- Test generation and coverage analysis
- Codebase refactoring and migration

**Design Note**: Named "Motor Cortex" because code is the system's primary way of **acting on the world** — executing instructions, manipulating state, producing artifacts.

---

### 3.6 Emotion / Sentiment — Amygdala

> **Cartridge ID**: `cartridge.emotion.amygdala` 
> **Brain Region**: Amygdala
> **Biological Function**: Emotional processing, fear response, valence detection

| Attribute                    | Value                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| **Primary Capability** | Tone detection, empathy modeling, sentiment analysis                                  |
| **Input Types**        | User messages, conversation context, voice prosody signals                            |
| **Output Types**       | Sentiment scores, emotional state vectors, tone recommendations                       |
| **Typical Models**     | Sentiment classifiers, affect-tuned LLMs                                              |
| **Latency Profile**    | Low                                                                                   |
| **Composition**        | Modulates Language (Broca/Wernicke) output tone; informs Routing (Thalamus) decisions |

**Use Cases**:

- Customer sentiment monitoring
- Empathetic response generation
- Brand voice consistency enforcement
- Escalation triggers based on negative sentiment

**Integration with AGI Brain**: Maps to the existing Affective State Service (valence/arousal model) in the Consciousness layer.

---

### 3.7 Routing / Orchestration — Thalamus

> **Cartridge ID**: `cartridge.routing.thalamus` 
> **Brain Region**: Thalamus
> **Biological Function**: Sensory relay, signal routing, attention gating

| Attribute                    | Value                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------ |
| **Primary Capability** | Task dispatch, model selection, pipeline orchestration                         |
| **Input Types**        | Incoming requests, task metadata, system state                                 |
| **Output Types**       | Routing decisions, cartridge activation sequences, load balancing directives   |
| **Typical Models**     | Lightweight classifier / router models, rule engines                           |
| **Latency Profile**    | Ultra-low (must not bottleneck)                                                |
| **Composition**        | **Central hub** — routes to all other cartridges based on task analysis |

**Use Cases**:

- Intelligent model routing based on task type
- Multi-cartridge pipeline orchestration
- Load balancing across model replicas
- Fallback and retry logic

**Integration with AGI Brain**: Maps to the existing Brain Router, which acts as the thalamic relay for all incoming signals.

---

### 3.8 Domain Expertise — Nucleus

> **Cartridge ID**: `cartridge.domain.nucleus` 
> **Brain Region**: Nucleus Accumbens / Basal Ganglia
> **Biological Function**: Reward processing, specialized skill acquisition

| Attribute                    | Value                                                             |
| ---------------------------- | ----------------------------------------------------------------- |
| **Primary Capability** | Specialized vertical knowledge, domain-specific fine-tuning       |
| **Input Types**        | Domain-specific queries (legal, medical, financial, etc.)         |
| **Output Types**       | Expert-level domain responses, citations, compliance-aware output |
| **Typical Models**     | Domain fine-tuned LLMs, expert mixture-of-experts layers          |
| **Latency Profile**    | Medium                                                            |
| **Composition**        | Selected by Routing (Thalamus); grounded by Memory (Hippocampus)  |

**Use Cases**:

- Legal document analysis and compliance checking
- Medical diagnosis support and clinical NLP
- Financial modeling and risk assessment
- Industry-specific knowledge Q&A

**Design Note**: Named "Nucleus" because domain expertise forms the **core nuclei** of specialized knowledge — dense, focused clusters of capability that the broader brain draws upon.

---

## Part IV: Cartridge Composition & Routing

### 4.1 Composition Patterns

Cartridges compose into **cognitive pipelines** orchestrated by the Thalamus:

#### Pattern 1: Grounded Reasoning

```
[User Query] → Thalamus → Hippocampus (retrieve) → Prefrontal (reason) → Broca/Wernicke (respond)
```

#### Pattern 2: Empathetic Creative Writing

```
[User Query] → Thalamus → Amygdala (detect tone) → DMN (generate) → Broca/Wernicke (polish)
```

#### Pattern 3: Domain-Expert Code Generation

```
[User Query] → Thalamus → Nucleus (domain context) → Motor Cortex (generate code) → Prefrontal (validate)
```

#### Pattern 4: Full Cognitive Loop (AGI Brain)

```
[User Query] → Thalamus → Amygdala (emotional read)
                        → Hippocampus (memory recall)
                        → Prefrontal (plan)
                        → [DMN | Motor Cortex | Nucleus] (execute)
                        → Broca/Wernicke (output)
```

### 4.2 Routing Decision Matrix

The Thalamus cartridge uses the following heuristics for dispatch:

| Signal                               | Routes To             | Priority |
| ------------------------------------ | --------------------- | -------- |
| Logical question / math              | Prefrontal            | High     |
| Translation request                  | Broca/Wernicke        | High     |
| "Remember when..." / context query   | Hippocampus           | High     |
| Open-ended creative prompt           | DMN                   | Medium   |
| Code-related request                 | Motor Cortex          | High     |
| Emotional/support context            | Amygdala              | Medium   |
| Domain-specific terminology detected | Nucleus               | Medium   |
| Ambiguous / multi-domain             | Prefrontal → fan-out | Low      |

---

## Part V: Implementation Guidelines

### 5.1 Cartridge Interface Contract

Every cartridge MUST implement the following interface:

```typescript
interface RadiantCartridge {
  /** Unique cartridge identifier */
  readonly cartridgeId: string;

  /** Brain region this cartridge maps to */
  readonly brainRegion: BrainRegion;

  /** Specialization category */
  readonly specialization: CartridgeSpecialization;

  /** Process an incoming cognitive task */
  process(input: CartridgeInput): Promise<CartridgeOutput>;

  /** Health check for routing decisions */
  healthCheck(): Promise<CartridgeHealth>;

  /** Telemetry hook for Consciousness Services */
  emitTelemetry(): CartridgeTelemetry;
}

type CartridgeSpecialization =
  | 'reasoning'
  | 'language'
  | 'memory'
  | 'creativity'
  | 'code'
  | 'emotion'
  | 'routing'
  | 'domain';

type BrainRegion =
  | 'prefrontal'
  | 'broca-wernicke'
  | 'hippocampus'
  | 'default-mode-network'
  | 'motor-cortex'
  | 'amygdala'
  | 'thalamus'
  | 'nucleus';
```

### 5.2 Cartridge Registration

Cartridges register with the OMEGA Instance Registry and are discoverable by the Thalamus router:

```typescript
// Register a new cartridge specialization
await cartridgeRegistry.register({
  cartridgeId: 'cartridge.reasoning.prefrontal',
  specialization: 'reasoning',
  brainRegion: 'prefrontal',
  endpoint: 'https://omega-reasoning.radiant.internal',
  version: '1.0.0',
  capabilities: ['chain-of-thought', 'planning', 'multi-step'],
  maxConcurrency: 10,
  healthEndpoint: '/health',
});
```

### 5.3 Safety Integration

All cartridges pass through the **Helix Kernel** safety layer before and after execution:

1. **Pre-execution**: Input validated against safety constraints via destructive interference
2. **Execution**: Cartridge processes the task
3. **Post-execution**: Output validated; Watcher monitors for prediction error (surprise signal)

---

## Part VI: .RADz Package Format & Contents

> *Consolidated from [04-RADIANT-ADMIN.md § 9B](./04-RADIANT-ADMIN.md) and [15-STRATEGY-COMPETITIVE.md § Moat #28](./15-STRATEGY-COMPETITIVE.md)*

### 6.1 What Is a .RADz File?

A **Cartridge** (.RADz file) is a self-contained AI intelligence package — a **portable AI brain** — that can be exported, imported, and transferred between RADIANT deployments. No competitor offers anything comparable.

> *"Calling RADIANT Cartridges 'like LoRA' would be like calling a human immune system 'like a band-aid.' One adapts, learns, remembers, and evolves. The other sticks on and falls off in the shower."*

### 6.2 Cartridge Contents

| Component | Description |
|-----------|-------------|
| **CORTEX Networks** | 6 small MLPs (~2.5M params total) for routing decisions (ONNX format) |
| **Domain Expert Networks** | Specialized networks per domain (~4M params each, ONNX format) |
| **LoRA Adapters** | Tenant-specific domain expertise (safetensors format, 8-32 rank, 500KB-2MB per domain) |
| **Curator Knowledge** | Golden rules, ontology, safety matrix — verified facts with 5.0x weight |
| **Ghost Compression** | User personalization model (4096→64 dimension, ~395K params) |
| **Expert System Adapters (ESAs)** | Industry reasoning patterns — diagnostic reasoning, procedure recommendations, terminology translation |

### 6.3 Manifest (manifest.json)

Every .RADz file contains a manifest:

| Field | Description |
|-------|-------------|
| `version` | Cartridge version (semver) |
| `radiantVersion` | Minimum RADIANT version required |
| `domains` | Domain IDs included |
| `hasLoraAdapters` | Whether LoRA adapters are included |
| `hasCuratorKnowledge` | Whether golden rules/ontology included |
| `hasGhostCompression` | Whether ghost model included |
| `hasDomainExperts` | Whether domain expert networks included |
| `allowUserOverride` | Can user cartridges override this? |
| `signature` | Cryptographic signature for verification |

### 6.4 Directory Structure

```
cartridge.radz (ZIP archive)
├── manifest.json
├── cortex/
│   ├── pattern_network.onnx
│   ├── routing_network.onnx
│   └── ...
├── domain/
│   └── healthcare/
│       ├── entity_classifier.onnx
│       └── ...
├── lora/
│   └── adapters.safetensors
├── curator/
│   ├── golden_rules.json
│   ├── ontology.json
│   └── safety_matrix.json
└── ghost/
    └── compression_model.onnx
```

### 6.5 Import / Export

#### Exporting

1. Click **Export** in Admin Dashboard → Cartridges
2. Select **Scope** (Tenant or User)
3. Choose components to include (LoRA Adapters, Curator Knowledge, Ghost Compression, Domain Expert Networks)
4. Click **Export** to generate .RADz file
5. Download link provided (expires in 1 hour)

#### Importing

1. Upload .RADz file to storage
2. Click **Import**
3. Select **Scope** and enter file key
4. Choose **Merge Strategy**:
   - **Replace**: Overwrite existing cartridge
   - **Merge**: Combine with existing
5. Optionally check "Activate immediately"
6. Click **Import**

```typescript
await radiant.cartridge.import({
  file: 'domain-expertise.RADz',
  targetTenant: 'tenant-456',
  validateSignature: true,
  mergeStrategy: 'REPLACE'
});
```

---

## Part VII: Cartridge Scopes, Stack Resolution & Thermal States

> *Consolidated from [04-RADIANT-ADMIN.md § 9B.2–9B.3](./04-RADIANT-ADMIN.md) and [09-OMEGA-GENESIS.md § 7](./09-OMEGA-GENESIS.md)*

### 7.1 Cartridge Scopes

| Scope | Description | Can Disable? |
|-------|-------------|--------------|
| **System** | Platform-wide read-only cartridges | **NO** — Managed by RADIANT admin |
| **Tenant** | Organization-wide cartridges | **NO** — Always active |
| **User** | Personal user cartridges | **YES** — Can toggle |

**Key Rule**: Tenant cartridges CANNOT be disabled. They form the base layer that all users inherit.

### 7.2 Stack Resolution

Cartridges are resolved in stack order — later cartridges override earlier ones (where `allowUserOverride` permits):

```
┌─────────────────────────────────┐
│  User Cartridge (top)           │ ← Can toggle on/off
├─────────────────────────────────┤
│  Tenant Cartridge 2             │ ← Always active
├─────────────────────────────────┤
│  Tenant Cartridge 1 (base)      │ ← Always active
├─────────────────────────────────┤
│  System Cartridges (read-only)  │ ← Platform-managed
└─────────────────────────────────┘
```

### 7.3 Thermal State Management

Each cartridge (per AWS region) has a thermal state:

| State | Description | Latency | Behavior |
|-------|-------------|---------|----------|
| **Cold** | No cartridge installed / uninstalled | 30-60s warmup | Base routing only |
| **Warming** | Cartridge installing | 10-30s | Loading models to inference nodes |
| **Warm** | Cartridge active (default when installed) | <100ms | Full intelligence |
| **Hot** | High demand, auto-scaled | <50ms | Full intelligence, scaled replicas |
| **Updating** | Atomic pointer swap in progress | ~0ms | **Zero downtime** — seamless transition |

**Thermal Override** (Admin Dashboard):
1. Click the thermometer icon on a region
2. Select target state
3. Enter reason (required)
4. Optionally set duration (auto-reverts)
5. Click **Apply Override**

---

## Part VIII: Cartridge PKI & Federation

> *Consolidated from [15-STRATEGY-COMPETITIVE.md § Moat #31](./15-STRATEGY-COMPETITIVE.md), [06-ARCHITECTURE-ENGINEERING.md § 3.2.1](./06-ARCHITECTURE-ENGINEERING.md), and [13-SECURITY-AUTH-COMPLIANCE.md](./13-SECURITY-AUTH-COMPLIANCE.md)*

### 8.1 Overview

Every RADIANT Cartridge (.RADz) is **cryptographically signed** with dual signatures (author + platform) and can be **verified across independent Radiant clusters** via federated trust.

| Capability | ChatGPT/Claude | RADIANT |
|------------|----------------|---------|
| Exportable AI Expertise | ❌ | ✅ .RADz Cartridges |
| Cryptographic Signing | ❌ | ✅ Dual signatures (author + platform) |
| Tamper Detection | ❌ | ✅ SHA-256 hash verification |
| Cross-Cluster Trust | ❌ | ✅ Federation with Root CA exchange |
| Supply Chain Security | ❌ | ✅ Full certificate chain |
| Audit Trail | ❌ | ✅ PKI audit log |

### 8.2 KMS Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CARTRIDGE PKI - REAL KMS ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Security Stack (CDK)                                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  cartridgeSigningKey: kms.Key                                          │ │
│  │  ├── KeySpec: ECC_NIST_P256 (ECDSA)                                   │ │
│  │  ├── KeyUsage: SIGN_VERIFY                                            │ │
│  │  └── Alias: ${appId}-${env}-cartridge-signing                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  CartridgePKIService                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  generateTenantCA() → CreateKeyCommand → GetPublicKeyCommand          │ │
│  │  createSigningKey() → CreateKeyCommand → GetPublicKeyCommand          │ │
│  │  signArtifact()     → SignCommand (ECDSA_SHA_256)                     │ │
│  │  verifySignature()  → VerifyCommand                                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Key Hierarchy

```
Platform Root CA (KMS ECC_NIST_P256)
├── Created in CDK SecurityStack
├── Signs Tenant CA certificates
├── Key ID: RADIANT_PLATFORM_SIGNING_KEY_ID
└── RETAIN policy in production

Tenant CA Keys (KMS ECC_NIST_P256)
├── Created dynamically per tenant via generateTenantCA()
├── Signed by Platform Root CA
├── Signs cartridge artifacts (.RADz files)
└── Stored in tenant_ca_certificates table

Signing Keys (KMS ECC_NIST_P256)
├── Purpose: author, publisher, validator, custom
├── Created dynamically via createSigningKey()
├── Signed by Tenant CA
└── Stored in cartridge_signing_keys table
```

### 8.4 Database Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `tenant_ca_certificates` | Tenant CA certificates | `key_id`, `key_arn`, `fingerprint`, `root_signature`, `status` |
| `cartridge_signing_keys` | Purpose-specific signing keys | `key_id`, `purpose`, `ca_signature`, `status` |
| `pki_audit_log` | PKI operations audit (partitioned) | `operation`, `resource_id`, `success`, `details` |

### 8.5 Security Considerations

| Consideration | Mitigation |
|---------------|------------|
| **Key Rotation** | Asymmetric keys don't auto-rotate; manual rotation requires certificate reissuance |
| **Key Deletion** | Extended pending window (30 days prod, 7 days dev); RETAIN removal policy |
| **Tenant Isolation** | Each tenant gets own KMS key; RLS on all tables |
| **Audit Trail** | All PKI ops logged to partitioned `pki_audit_log` |
| **Least Privilege** | IAM conditions restrict key creation to ECC_NIST_P256 + SIGN_VERIFY |

### 8.6 Federation Use Cases

| Scenario | How PKI Helps |
|----------|---------------|
| Pharma company shares drug discovery patterns | Receiving lab can verify cartridge wasn't modified |
| Law firm distributes litigation strategy | Partner offices can trust the source |
| Defense contractor ships to secure enclave | Government verifies cartridge chain of custody |
| Insurance company updates fraud detection | Branch offices confirm update is from HQ |

### 8.7 Implementation Files

| File | Purpose |
|------|---------|
| `lib/stacks/security-stack.ts` | CDK asymmetric key definition |
| `lambda/shared/services/cartridge-pki.service.ts` | PKI service with real KMS |
| `packages/shared/src/types/cartridge-pki.types.ts` | PKI type definitions |
| `lambda/admin/cartridge-pki.ts` | Admin API for PKI management |
| `apps/admin-dashboard/app/(dashboard)/platform/pki/page.tsx` | PKI Dashboard |
| `migrations/000_consolidated_schema.sql` | Database schema |

---

## Part IX: Cartridge Vault, RNIR & Operations

> *Consolidated from [17-GLOSSARY.md § Cartridge System](./17-GLOSSARY.md) and [15-STRATEGY-COMPETITIVE.md § v6.2.0](./15-STRATEGY-COMPETITIVE.md)*

### 9.1 Cartridge Vault (Keyhole Pattern)

Secrets management for cartridges — cartridges declare required secrets via `vault.req` manifest but **NEVER contain credentials**. Actual values are injected at runtime from secure vault.

| Feature | Description |
|---------|-------------|
| **Keyhole Pattern** | Cartridges specify secret "shapes" (name, type, scope) — values injected at runtime |
| **KMS Encryption** | All vault secrets encrypted via AWS KMS |
| **Rotation with History** | Secret rotation maintains audit trail |
| **Merkle Audit Trail** | Tamper-evident log of all vault access |
| **Chain of Custody** | Full provenance tracking for secret lifecycle |
| **Governance Presets** | PARANOID / BALANCED / COWBOY — controls vault access strictness |
| **CBFs** | Cartridge Boundary Functions for secret access that NEVER relax |

**Implementation**: `cartridge-vault.service.ts`, `cartridge-vault.types.ts`
**Dashboard**: Admin → Platform → Vault

### 9.2 RNIR Compiler

**Radiant Neural Intermediate Representation** — model-agnostic cognitive source code (JSONL training pairs) that compiles to multiple target formats.

| Compilation Target | Format |
|-------------------|--------|
| LoRA weights | safetensors |
| System prompts | Text |
| Few-shot examples | JSONL |
| RAG chunks | Embeddings |

**Features**:
- Cortex integration for knowledge-aware compilation
- Twilight Dreaming scheduling for background compilation
- Axiom domain signatures with model-specific variants

**Implementation**: `cartridge-rnir.service.ts`
**Dashboard**: Admin → Platform → RNIR

### 9.3 Cartridge Operations

Long-running cartridge deployments with **Time Machine checkpointing** for reliability:

| Feature | Description |
|---------|-------------|
| **Cato Checkpoints** | CP1–CP5 checkpoint levels for operation state |
| **SAGA Compensation** | Proper rollback via SAGA pattern on failure |
| **UEP Tracing** | Universal Envelope Protocol tracing (traceId/spanId) |
| **Controls** | Pause / Resume / Cancel for all operations |

**Implementation**: `cartridge-operations.service.ts`
**Dashboard**: Admin → Platform → Cartridge Operations

---

## Part X: Competitive Positioning

> *Consolidated from [15-STRATEGY-COMPETITIVE.md § Moats #28–#31](./15-STRATEGY-COMPETITIVE.md)*

### 10.1 Competitive Moat Summary

| Moat | Score | Lead | Description |
|------|-------|------|-------------|
| **#28: RADIANT Cartridges (.RADz)** | 28/30 | 18+ months | Portable AI brains — no competitor offers export/import of learned patterns |
| **#29: CORTEX Neural Networks** | 26/30 | 12+ months | 6 small MLPs (~2.5M params) for intelligent routing — learned vs. configured |
| **#30: Three-Tier Learning** | 25/30 | 12+ months | Global (CATO) + Tenant (LoRA) + User (Ghost) simultaneous learning |
| **#31: Cartridge PKI & Federation** | 27/30 | 18+ months | Cryptographic signing and cross-cluster federated trust |

### 10.2 Why Cartridges Are Defensible

| Capability | Competitors | RADIANT |
|------------|-------------|---------|
| Expertise Transfer | Manual config | Plug-and-play cartridge |
| M&A Integration | Months of work | Import .RADz in minutes |
| Franchise Deployment | Per-site setup | Master cartridge replication |
| Disaster Recovery | Rebuild from scratch | Restore cartridge from S3 |
| White-Label Sales | Not possible | Sell pre-trained cartridges |

### 10.3 Key Differentiators

1. **No Competitor Has Portable Intelligence**: ChatGPT, Claude, and Gemini learn per-account but cannot export/import learned patterns.
2. **Creates M&A Value**: Import AI expertise instantly during acquisitions.
3. **Franchise Model Enabler**: Master cartridge → 100 franchisees, each inheriting corporate expertise while developing local patterns.
4. **White-Label Revenue Stream**: Sell industry-specific cartridges ("Legal-Enterprise", "Healthcare-HIPAA") as products.
5. **Cartridge Marketplace** (Q2 2026 planned): Pre-built expertise packages as add-ons or marketplace products.

---

## Part XI: API Reference

> *Consolidated from [04-RADIANT-ADMIN.md § 9B.6](./04-RADIANT-ADMIN.md) and [12-API-REFERENCE.md](./12-API-REFERENCE.md)*

### 11.1 Admin API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/cartridges` | GET | List cartridges |
| `/api/admin/cartridges/:id` | GET | Get single cartridge |
| `/api/admin/cartridges` | POST | Create cartridge |
| `/api/admin/cartridges/:id` | PATCH | Update cartridge |
| `/api/admin/cartridges/:id` | DELETE | Archive cartridge |
| `/api/admin/cartridges/export` | POST | Export to .RADz |
| `/api/admin/cartridges/import` | POST | Import from .RADz |
| `/api/admin/cartridges/stack` | GET | Get cartridge stack |
| `/api/admin/cartridges/:id/toggle` | POST | Toggle user cartridge |
| `/api/admin/cartridges/:id/validate` | POST | Validate .RADz file |

### 11.2 Tenant API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tenant/cartridges` | GET | List tenant's cartridges (includes system read-only) |
| `/tenant/cartridges` | POST | Create tenant cartridge |
| `/tenant/cartridges/{id}` | GET | Get cartridge (tenant or system read-only) |
| `/tenant/cartridges/{id}` | PATCH | Update tenant cartridge |
| `/tenant/cartridges/{id}` | DELETE | Archive tenant cartridge |
| `/tenant/cartridges/stack` | GET | Get cartridge stack (system → tenant → user) |
| `/tenant/cartridges/{id}/activate` | POST | Activate cartridge |
| `/tenant/cartridges/{id}/deactivate` | POST | Deactivate cartridge |
| `/tenant/cartridges/export` | POST | Export tenant cartridges to .RADz |
| `/tenant/cartridges/import` | POST | Import .RADz file |

**Tenant Isolation**: Tenants can only see their own cartridges plus system cartridges (read-only). They cannot see other tenants' cartridges or modify system cartridges.

### 11.3 OMEGA Forge API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cartridges` | GET | List with status/target filters |
| `/api/cartridges/{id}` | GET | Detail with installations |
| `/api/cartridges/{id}` | DELETE | Archive cartridge |
| `/api/cartridges/build` | POST | Build .RADz from sections |
| `/api/brains/{tenantId}` | GET | Brain detail + cartridges + dreams + Soft ROM |

### 11.4 Implementation Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/cartridge.service.ts` | Core cartridge service |
| `lambda/admin/cartridge-universal.ts` | Universal admin cartridge management |
| `lambda/admin/cartridges.ts` | Admin cartridge CRUD |
| `lambda/admin/cartridge-operations.ts` | Long-running operations |
| `lambda/admin/cartridge-rnir.ts` | RNIR compilation |
| `lambda/admin/cartridge-vault.ts` | Vault management |
| `lambda/admin/system-cartridges.ts` | System cartridge registry |
| `lambda/tenant/cartridge-management.ts` | Tenant cartridge management |
| `lambda/gateway/cartridge-api.ts` | Gateway API layer |
| `apps/omega-forge/lib/cartridge/builder.ts` | .RADz creation — ZIP, checksums, ZSTD, KMS signing |
| `apps/omega-forge/lib/cartridge/parser.ts` | .RADz extraction — manifest, sections, signature verification |
| `apps/admin-dashboard/app/(dashboard)/cartridge-system/page.tsx` | Admin Dashboard UI |
| `apps/thinktank/components/chat/CartridgeIndicator.tsx` | User-facing cartridge status indicator |
| `apps/thinktank-mac/Sources/ThinkTankMac/Views/Chat/CartridgeIndicatorView.swift` | macOS cartridge indicator |
| `packages/shared/src/types/cartridge.types.ts` | Core type definitions |
| `packages/shared/src/types/cartridge-pki.types.ts` | PKI types |
| `packages/shared/src/types/cartridge-vault.types.ts` | Vault types |
| `packages/shared/src/types/cartridge-rnir.types.ts` | RNIR types |
| `packages/shared/src/types/cartridge-operations.types.ts` | Operations types |

---

## Appendix A: Cross-Reference to AGI Brain Components

| Cartridge Specialization  | AGI Brain Component     | Doc Reference                         |
| ------------------------- | ----------------------- | ------------------------------------- |
| Reasoning (Prefrontal)    | AGI Brain Planner       | [07-AI-SYSTEMS § 1](./07-AI-SYSTEMS.md) |
| Language (Broca/Wernicke) | Conscious Orchestrator  | [07-AI-SYSTEMS § 1](./07-AI-SYSTEMS.md) |
| Memory (Hippocampus)      | Episodic Memory Service | [07-AI-SYSTEMS § 4](./07-AI-SYSTEMS.md) |
| Creativity (DMN)          | Homeostatic Dreaming    | [07-AI-SYSTEMS § 1](./07-AI-SYSTEMS.md) |
| Code (Motor Cortex)       | Domain Taxonomy         | [07-AI-SYSTEMS § 1](./07-AI-SYSTEMS.md) |
| Emotion (Amygdala)        | Affective State Service | [07-AI-SYSTEMS § 4](./07-AI-SYSTEMS.md) |
| Routing (Thalamus)        | Brain Router            | [07-AI-SYSTEMS § 1](./07-AI-SYSTEMS.md) |
| Domain (Nucleus)          | Domain Taxonomy         | [07-AI-SYSTEMS § 1](./07-AI-SYSTEMS.md) |

---

## Appendix B: Version History

| Version | Date           | Changes                                   |
| ------- | -------------- | ----------------------------------------- |
| 1.0.0   | March 15, 2026 | Initial cartridge specialization taxonomy |

---

*This document is part of the RADIANT documentation suite. For the complete platform architecture, see [06-ARCHITECTURE-ENGINEERING.md](./06-ARCHITECTURE-ENGINEERING.md).*
