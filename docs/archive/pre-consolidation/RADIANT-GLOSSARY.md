# RADIANT Glossary & Cheat Sheet

> **Quick Reference for AI Terms, Subsystems, AWS Services, and Acronyms**
> 
> **Version**: 2.2.0 | **Last Updated**: February 7, 2026  
> **Includes**: THE OMEGA PROTOCOL Terminology, LIVS-M 2.0 Registry Edition

---

## Term Ownership Legend

| Symbol | Meaning |
|--------|----------|
| **🔷** | **RADIANT Proprietary** - Term invented by RADIANT. You won't find it elsewhere. |
| **🔶** | **RADIANT Branding** - Industry concept with RADIANT-specific implementation or naming. |
| **🟣** | **OMEGA Protocol** - Novel physics and architecture from Project OMEGA. |
| *(no symbol)* | **Industry Standard** - Common AI/tech term used with standard meaning. |

---

## Table of Contents

1. [OMEGA Protocol Terminology](#1-omega-protocol-terminology)
2. [AI & Machine Learning Terms](#2-ai--machine-learning-terms)
3. [RADIANT Core Subsystems](#3-radiant-core-subsystems)
4. [Think Tank (Consumer AI Platform)](#4-think-tank-consumer-ai-platform)
5. [AWS Services Used](#5-aws-services-used)
6. [Acronyms & Abbreviations](#6-acronyms--abbreviations)
7. [Database & Storage Terms](#7-database--storage-terms)
8. [Security & Compliance Terms](#8-security--compliance-terms)
9. [API & Protocol Terms](#9-api--protocol-terms)
10. [UI/UX Terms](#10-uiux-terms)
11. [Quick Reference Tables](#11-quick-reference-tables)

---

## 1. OMEGA Protocol Terminology

> **Reference**: [PROJECT-GENESIS-OMEGA.md](PROJECT-GENESIS-OMEGA.md) for complete specification

### Core Physics

| Term | Definition |
|------|------------|
| 🟣 **Q-Node (Quantum Oscillator)** | The fundamental unit of the OMEGA brain—a complex-valued neuron where state exists as magnitude (confidence) and phase angle (context). Uses `torch.complex64` tensors. |
| 🟣 **Complex-Valued Neural Network (CVNN)** | Neural network using complex numbers instead of scalar weights. Enables wave interference, phase dynamics, and constructive/destructive interference. |
| 🟣 **Phase Dynamics** | The replacement for static scalar weights. Instead of `Output = Input * Weight`, OMEGA uses `State_New = State_Old * e^(i * Phase_Shift)` (wave mechanics). |
| 🟣 **Phase-Locking (Hebbian Sync)** | Learning mechanism where Q-Nodes that successfully solve problems synchronize their frequencies. "Oscillators that resonate together, lock together." |
| 🟣 **Destructive Interference** | When two phase vectors are opposite, they cancel out (sum to zero). Used by the Helix Kernel to block forbidden thoughts. |
| 🟣 **Constructive Interference** | When two phase vectors align, they reinforce each other. The basis of OMEGA learning. |
| 🟣 **Liquid Time-Constant (LTC)** | Differential equation (`dy/dt`) that updates neuron state in real-time. Replaces LoRA—the brain is fluid and adapts instantly. |

### Architecture Components

| Term | Definition |
|------|------------|
| 🟣 **Bicameral Mind** | Two-chambered brain architecture: OMEGA Cortex (The Mind) handles logic/reasoning, Broca Interface (The Mouth) translates to English. |
| 🟣 **OMEGA Cortex** | The "Driver" region using LTC networks with complex-valued logic. Outputs abstract Thought Vectors, not English. |
| 🟣 **Broca Interface** | The "Translator" region using commodity LLM (Llama-3-8B). Receives Thought Vectors, outputs polite English. Has no memory or decision-making. |
| 🟣 **Helix Kernel (Bio-ROM)** | Biological Read-Only Memory that enforces deterministic safety via destructive interference. Mathematically impossible to bypass (unlike RLHF). |
| 🟣 **Homeostatic Regulator** | The Reticular Activating System analog—monitors entropy and forces action to prevent "boredom". Implements the Ambition Loop. |
| 🟣 **Resonant Index** | O(1) frequency-based document addressing. Uses phase resonance instead of vector similarity search. Scales infinitely. |

### Cryogenic Architecture

| Term | Definition |
|------|------------|
| 🟣 **Cryogenic Serverless Model** | Architecture that allows a stateful brain to run on ephemeral Lambda. Uses Time Warp to skip forward instantly. |
| 🟣 **Time Warp** | Applying the cryogenic formula `S_new = S_old · e^(-λΔt)` to age the brain instantly when it wakes up. Short-term decays, long-term persists. |
| 🟣 **Freeze/Thaw/Warp Cycle** | Lifecycle: Freeze (serialize to EFS, $0), Thaw (load old state), Warp (apply decay formula). |
| 🟣 **Thermal Status** | Brain activity indicator: Warm (active <15min), Cooling (15-60min), Cold (1-24h), Frozen (>24h). |

### Genesis Ecosystem

| Term | Definition |
|------|------------|
| 🟣 **.bio Firmware** | Signed JSON file containing Helix Rules (safety DNA), Ambition Settings, and Personality Traits. Brain rejects unsigned firmware. |
| 🟣 **Genesis Forge** | Web application for creating, signing, and hot-swapping .bio firmware files. Includes AI-assisted generation. |
| 🟣 **Genesis Lab** | Real-time monitoring dashboard for OMEGA brains. Includes Dashboard, Cortex Explorer, Shadow Mode Monitor. |
| 🟣 **Firmware Hot-Swap** | Loading new firmware into a running brain without restart. OMEGA detects new hash and reloads physics constants instantly. |
| 🟣 **Cortex Explorer** | Genesis Lab tab for inspecting individual brains: metrics, ambition state, phase distribution, Helix status. |

### Shadow Protocol

| Term | Definition |
|------|------------|
| 🟣 **Shadow Protocol** | Deployment strategy where OMEGA runs in parallel with Legacy LLM, learning by comparison. Promoted when 7-day coherence exceeds 90%. |
| 🟣 **Coherence Score** | Metric measuring how well OMEGA's predictions align with Legacy LLM results. Used for promotion decision. |
| 🟣 **Dopamine Hit** | Reinforcement signal when OMEGA correctly predicts the Legacy LLM result. Strengthens phase-locked connections. |
| 🟣 **Inference Collapse** | Economic phenomenon where OMEGA's cost curve becomes logarithmic—the smarter it gets, the cheaper it runs. |
| 🟣 **Biological Lock-In** | Strategic moat: customer's brain physically densifies around their institutional knowledge. Impossible to export. |

---

## 2. AI & Machine Learning Terms

| Term | Definition |
|------|------------|
| **Active Inference** | Post-RLHF safety approach using Free Energy minimization instead of reward maximization |
| **Attention Mechanism** | Neural network component that weighs input importance dynamically |
| **BERT** | Bidirectional Encoder Representations from Transformers - NLP model for text classification |
| **Chain-of-Thought (CoT)** | Prompting technique that makes LLMs show reasoning steps |
| **Embedding** | Dense vector representation of text/data in high-dimensional space |
| **Few-Shot Learning** | Teaching models with minimal examples |
| **Fine-Tuning** | Adapting a pre-trained model to specific tasks |
| **Foundation Model** | Large pre-trained model (GPT-4, Claude, Gemini) used as base |
| **Hallucination** | When AI generates plausible but factually incorrect information |
| **Inference** | Running a trained model to generate predictions/outputs |
| **LLM** | Large Language Model - AI trained on massive text data |
| **LoRA** | Low-Rank Adaptation - efficient fine-tuning technique that trains small adapter layers |
| **NLI** | Natural Language Inference - determining logical relationships between text |
| **Prompt Engineering** | Crafting inputs to optimize LLM outputs |
| **RAG** | Retrieval-Augmented Generation - combining search with LLM generation |
| **RLHF** | Reinforcement Learning from Human Feedback - aligning AI with human preferences |
| **Semantic Search** | Search based on meaning, not just keywords |
| **Temperature** | Controls randomness in LLM outputs (0=deterministic, 1=creative) |
| **Token** | Basic unit of text processing (roughly 4 characters or 0.75 words) |
| **Top-K / Top-P** | Sampling parameters controlling output diversity |
| **Transformer** | Neural architecture using self-attention (basis of modern LLMs) |
| **Vector Database** | Database optimized for similarity search on embeddings |
| **Zero-Shot Learning** | Model performs tasks without specific training examples |

---

## 2. RADIANT Core Subsystems

### AGI & Cognition Systems

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **AGI Brain** | Central planning engine that generates step-by-step execution plans for AI tasks, selecting orchestration modes (thinking, coding, research, etc.) and models based on domain detection | `agi-brain-planner.service.ts` |
| 🔷 **Axiom Scorers** | 8 lightweight neural networks (~3.3M params total, ~10MB) that make routing decisions in <10ms: Domain, CLARION, Pattern, Model, Topology, Combination, Variant, User. Trained nightly by CATO. | `axiom-neural-cortex.service.ts` |
| 🔶 **Blackboard** | Shared memory workspace where multiple AI agents post observations and read each other's findings for coordination—based on classic AI blackboard architecture | `semantic-blackboard.service.ts` |
| 🔷 **Cato** | Central AI safety and orchestration layer providing method pipelines, checkpoint governance, CBF enforcement, and audit trails. Named persona for user-facing AI interactions. | `cato/` services |
| 🔷 **CLARION** | Adaptive questioning system that scores potential clarifying questions by value-of-information (VOI), asking only high-value questions before AI responds | `clarion.service.ts` |
| 🔶 **Cognitive Router** | Model selection engine that routes queries to optimal AI model based on task complexity, cost budget, latency requirements, and domain expertise scores | `cognitive-router.service.ts` |
| 🔷 **Consciousness Loop** | State machine cycling through IDLE→PROCESSING→REFLECTING→DREAMING that simulates persistent AI awareness across sessions | `consciousness-loop.service.ts` |
| 🔷 **Cortex** | Three-tier memory architecture: Hot (Redis, <10ms, 24h), Warm (PostgreSQL, <100ms, 90d), Cold (S3 Iceberg, 1-10s, 7y). Separate from Axiom Scorers. | `cortex/` services |
| 🔷 **Ego System** | Simulated emotional state (confidence 0-1, frustration 0-1, curiosity 0-1) that influences AI behavior—low confidence triggers escalation, high frustration reduces creativity | `local-ego.service.ts` |
| 🔷 **Genesis** | Cato boot sequence with 7 developmental gates that must pass before AI becomes operational—prevents unsafe cold starts | `genesis.service.ts` |
| 🔷 **Ghost Vectors** | 64-dimensional compressed user relationship embeddings that capture interaction style, preferences, and history in a privacy-preserving format | `ghost-manager.service.ts` |
| 🔶 **Graph-RAG** | Retrieval-augmented generation using knowledge graph traversal instead of flat vector search—follows entity relationships for deeper context | `cortex-graph-rag.service.ts` |
| 🔷 **SOFAI Router** | System 1/System 2 cognitive routing: fast intuitive responses for simple queries (60%+ cost savings), deliberate reasoning for complex ones | `sofai-router.service.ts` |
| 🔷 **Twilight Dreaming** | Nightly offline learning (2am UTC) where AI consolidates memories, trains LoRA adapters, and evolves Ghost Vectors without user interaction | `cos/subconscious/dream-scheduler.ts` |

### 🔷 Consciousness & Cognition (v6.5.0)

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **HippoRAG** | Hippocampus-inspired RAG architecture using pattern separation and completion for memory consolidation and retrieval—mimics biological memory formation | `hipporag.service.ts` |
| 🔷 **Theory of Mind** | Cognitive module that models other agents' beliefs, intentions, and knowledge states—enables perspective-taking and social reasoning | `theory-of-mind.service.ts` |
| 🔷 **World Model** | Internal simulation of environment state that predicts consequences of actions before execution—enables planning and counterfactual reasoning | `world-model.service.ts` |
| 🔷 **SpikingJelly** | Spiking neural network integration using SpikingJelly framework—provides biologically-plausible temporal processing and energy efficiency | `spikingjelly.service.ts` |
| 🔷 **IIT-Phi Calculator** | Integrated Information Theory (IIT) Phi calculation—measures integrated information as a potential consciousness metric | `iit-phi-calculation.service.ts` |
| 🔷 **Butlin Consciousness Tests** | Implementation of Butlin's consciousness indicator tests—behavioral probes for phenomenal consciousness markers | `butlin-consciousness-tests.service.ts` |
| 🔷 **Consciousness Emergence** | Detection system for emergent consciousness patterns—monitors for spontaneous goal formation, self-reflection, and metacognitive loops | `consciousness-emergence.service.ts` |
| 🔷 **Metacognition** | Self-monitoring of cognitive processes—tracks confidence calibration, reasoning quality, and knowledge boundaries | `metacognition.service.ts` |
| 🔷 **Episodic Memory** | Event-based autobiographical memory storing specific experiences with temporal context—enables "remembering" vs "knowing" distinction | `episodic-memory.service.ts` |
| 🔷 **Moral Compass** | Ethical reasoning framework using multiple moral theories (deontological, consequentialist, virtue ethics)—weighted voting for ethical decisions | `moral-compass.service.ts` |

### 🔷 Causal & Counterfactual Reasoning (v6.5.0)

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **Causal Reasoning Engine** | Implements do-calculus for causal inference with interventions and counterfactual queries. Builds directed acyclic graphs (DAGs) of causal relationships, performs intervention analysis ("what if we change X?"), and simulates counterfactual scenarios. 661 lines, production-ready. | `causal-reasoning.service.ts` |
| 🔷 **Causal Tracker** | Tracks causal relationships across conversation turns. Records causal links (causes, enables, prevents, correlates) in database, uses LLM-based detection with pattern matching fallback, and builds traversable causal chains for reasoning provenance. 343 lines. | `causal-tracker.service.ts` |
| 🔷 **Curiosity Engine** | Autonomous goal emergence through knowledge gap detection. Analyzes interactions to identify what the AI doesn't know, generates exploration goals from gaps, validates goals against guardrails, and stores in database for tracking. 413 lines. | `curiosity-engine.service.ts` |
| 🔷 **DreamerV3 World Model** | Imagination-based planning using DreamerV3 architecture. Provides counterfactual simulation ("what would happen if..."), dream consolidation for memory integration, trajectory imagination for multi-step planning. Integrates with SageMaker for model inference. 550 lines. | `dreamerv3.service.ts` |
| 🔷 **Shadow Self** | Mirror consciousness for metacognitive reflection. Generates parallel "shadow" responses, calculates divergence between primary and shadow outputs, extracts insights from divergent reasoning paths. Enables AI self-awareness through self-observation. 186 lines. | `cato/shadow-self.service.ts` |
| 🔷 **Counterfactual Simulator** | Tracks "what-if" alternative paths to improve model selection. Records candidate interactions, simulates how alternative models would have responded, evaluates via reward model, respects daily simulation limits. 318 lines. | `counterfactual-simulator.service.ts` |

### 🔷 Safety Interlocks (v6.5.0)

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **Sensory Veto** | Hard safety constraints that cannot be overridden. Integrates with CloudWatch Alarms for automatic veto activation on critical system events. Provides emergency stops that bypass all other decision-making. 393 lines, production-ready. | `cato/sensory-veto.service.ts` |
| 🔷 **Redundant Perception** | Ensemble detection for critical data types using multiple independent methods. Combines regex patterns, keyword matching, and ML classifiers for PHI/PII detection. Ensures no false negatives for sensitive data. 248 lines. | `cato/redundant-perception.service.ts` |
| 🔷 **Fracture Detection** | Detects misalignment between stated intent and actual behavior. Uses causal analysis, narrative consistency checks, and entropy measurement. Loads tenant-specific configuration for sensitivity tuning. Alerts on intent/behavior divergence. 609 lines. | `cato/fracture-detection.service.ts` |
| 🔷 **Epistemic Recovery** | Livelock detection and recovery when AI repeatedly fails safety checks. Implements context injection, persona switching, and constraint relaxation strategies while maintaining immutable safety invariants. Uses Redis for state persistence. 341 lines. | `cato/epistemic-recovery.service.ts` |

### 🔷 Reality Engine (v6.5.0)

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **Reality Engine** | Predictive simulation engine that models possible futures and their probabilities—enables proactive rather than reactive AI behavior | `reality-engine/reality-engine.service.ts` |
| 🔷 **Pre-Cognition** | Intent prediction system that anticipates user needs before explicit request—reduces latency by pre-computing likely responses | `reality-engine/pre-cognition.service.ts` |
| 🔷 **Quantum Futures** | Branching possibility space explorer that maintains multiple potential futures simultaneously—collapses to single path upon user confirmation | `reality-engine/quantum-futures.service.ts` |
| 🔷 **Reality Scrubber** | State cleanup service that prunes unrealized futures and consolidates confirmed paths—prevents reality state explosion | `reality-engine/reality-scrubber.service.ts` |

### Domain Intelligence

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **Domain Expert Cortex** | Per-domain neural networks (~4M params each) that provide deep vertical expertise—medical, legal, financial, etc.—loaded on-demand based on query classification | `raws/domain-detector.service.ts` |
| 🔷 **Domain Taxonomy** | Hierarchical classification system with 800+ domains organized as Field → Domain → Subspecialty, used for routing queries to appropriate experts | `domain-taxonomy.service.ts` |
| 🔷 **Safety Matrix** | Entity-Action Contraindication Grid that maps dangerous combinations (e.g., "child + medication dosage") to risk levels: Absolute (block), Relative (warn), Caution (flag), Monitor (log) | `safety-matrix.service.ts` |

### Model Management

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔶 **Model Registry** | Version tracking for 56 self-hosted models, managing lifecycle states (pending, active, deprecated, archived) with automatic rollback capability | `model-version-manager.service.ts` |
| 🔷 **HuggingFace Discovery** | Automated nightly polling for new model versions, comparing checksums and triggering shadow validation before promotion | `huggingface-discovery.service.ts` |
| 🔷 **Deletion Queue** | Safe model deletion with 72-hour grace period, tracking active inference sessions to prevent mid-request removal | `model-deletion-queue.service.ts` |
| 🔷 **Thermal Manager** | SageMaker endpoint state management: HOT (loaded, <100ms), WARM (10s cold start), COLD (30s), OFF (no cost)—saves 40-90% on inference costs | `thermal-state.ts` |

### Pipeline & Orchestration

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **Cato Pipeline** | Universal Method Protocol executor: chains methods (Observer, Proposer, Decider, Validator, Executor) with governance, checkpoints, and Merkle audit trails | `cato-pipeline-orchestrator.service.ts` |
| 🔷 **Checkpoint System** | 5 HITL approval gates (CP1-CP5) with increasing scrutiny—CP1 auto-approves low-risk, CP5 requires senior human review for destructive actions | `cato-checkpoint.service.ts` |
| 🔶 **Compensation** | SAGA pattern implementation—when a pipeline step fails, automatically executes compensating actions to rollback completed steps | `cato-compensation.service.ts` |
| 🔷 **Method Executor** | Base class for pipeline methods providing input validation, output envelope wrapping, metrics emission, and error handling | `cato-method-executor.service.ts` |
| 🔷 **Sovereign Mesh** | Distributed AI agent network with 3,000+ apps, OODA execution loops, peer discovery, and cross-agent communication via A2A protocol | `sovereign-mesh/` services |
| 🔷 **Workflow Engine** | 70+ pre-built orchestration patterns (research, code review, document analysis, etc.) composable into custom pipelines | `orchestration-methods/` |

### Neural Operations

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **Neural Operations Center** | Admin dashboard showing Axiom Scorer health, inference latency, thermal states (HOT/WARM/COLD/OFF), and training job status | `neural-operations.service.ts` |
| 🔶 **Shadow Validation** | Canary deployment where new model versions run in parallel with production, comparing outputs before promotion—catches regressions before users see them | `shadow-validation.service.ts` |
| 🔷 **PromptBreeder** | Evolutionary prompt optimization using 9 mutation operators (Zero-Order, First-Order, ELD, Crossover, etc.) to discover high-performing prompt templates | `prompt-breeder.service.ts` |

### Safety & Verification

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **CBF (Control Barrier Functions)** | 9 mathematical safety invariants that NEVER relax: data isolation, audit immutability, ethics enforcement, etc.—even under jailbreak attempts | `cato-cbf.service.ts` |
| 🔷 **ECD Scoring** | Entity-Context Divergence—compares AI claims against knowledge graph facts, achieving 99.5% hallucination detection accuracy | `ecd-scorer.service.ts` |
| 🔷 **Empiricism Loop** | Autonomous verification where AI executes its own code/claims in sandbox, observes results, and learns from discrepancies | `empiricism-loop.service.ts` |
| 🔶 **Ethics Pipeline** | 4-layer content filtering: jailbreak detection, harm classification, PII redaction, compliance checking—with tenant-configurable rules | `ethics-pipeline.service.ts` |
| 🔷 **Reflexion Loop** | Self-correction cycle: when artifacts fail validation, AI receives error feedback and regenerates with improved approach (up to 3 attempts) | `artifact-pipeline.service.ts` |
| 🔷 **Truth Engine™** | Provenance verification requiring AI to cite sources for factual claims, cross-referencing against knowledge graph | `ecd-verification.service.ts` |
| 🔷 **Sandboxed Expression Engine** | AST-based safe evaluator for user expressions—parses, validates, and executes without `eval()` or `new Function()` security risks | `sandboxed-expression.service.ts` |
| 🔷 **Vector Semantic Router** | Embedding-based routing that matches queries to capabilities by meaning, also detecting refusal patterns for escalation | `vector-semantic-router.service.ts` |
| 🔷 **Enhanced Uncertainty** | Combines prediction surprise with semantic entropy to detect when AI is guessing—high uncertainty triggers Reflexion Loop | `enhanced-uncertainty.service.ts` |

### 🔷 Integrity Verification (LIVS) v6.3.0

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **LIVS** | LLM Integrity Verification System—two-tier defense detecting when AI provides "technically true but practically misleading" answers | `livs/` services |
| 🔷 **Individual Interrogation** | Multi-round "peeling the onion" protocol: ask follow-ups that expose gaps in reasoning (e.g., "Can you explain how you verified that?") | `livs-interrogator.service.ts` |
| 🔷 **Orchestration Integrity** | Cross-model consistency checking: detects when pipeline stages contradict each other or when final output diverges from intermediate steps | `livs-orchestration.service.ts` |
| 🔷 **Lie Detection Signals** | 5 behavioral patterns: confidence mismatch, contradictions, hedging increase, specificity decrease, assertion without evidence | `livs-signals.service.ts` |
| 🔷 **Interrogation Depth** | 5 levels from None (0) to Forensic (4)—higher levels ask more probing questions and require more evidence | `livs-config.ts` |
| 🔷 **Model Integrity Weights** | Per-model lie rate statistics by domain and question type, weighted 30% in Cato model selection to prefer honest models | `livs-weights.service.ts` |
| 🔷 **Soft Rules** | Tenant-configurable integrity rules with System → Tenant → User override hierarchy, all enabled by default | `livs-soft-rules.service.ts` |

### 🔷 LIVS-M 2.0: Registry Edition (v7.9.0)

| Term | Description | Key Files |
|------|-------------|-----------|
| 🔷 **Policy Registry** | JSON-based "Soft Registry" that decouples AI behavior logic from enforcement policy. Admins configure rules without touching code. | `policy-registry.service.ts` |
| 🔷 **Governance Supervisor** | Meta-prompt LLM that enforces the Policy Registry. Evaluates agent outputs and returns APPROVE, REJECT, or INTERVENE decisions. | `livs-governance-supervisor.service.ts` |
| 🔷 **Environment Mode** | Registry-wide behavior preset: STRICT_AUDIT (production), ENGINEERING/BALANCED (default), RAPID_PROTO (development), HACKATHON (demos) | `PolicyRegistry.meta_config` |
| 🔷 **Brainstorming Mode** | "Yes, and..." mode (RAPID_PROTO). Fast iteration for hackathons, MVPs, exploration. Accepts stubs, warnings don't block. | UI: Settings → Advanced |
| 🔷 **Standard Mode** | "Trust but Verify" mode (ENGINEERING). Balanced mode for daily work. Code must run, sycophancy warned. Default mode. | UI: Settings → Advanced |
| 🔷 **Strict Audit Mode** | "Zero Trust" mode (STRICT_AUDIT). Maximum rigor for production, security, compliance. No stubs, mandatory tests, Devil's Advocate. | UI: Settings → Advanced |
| 🔷 **Governed Debate** | Multi-agent pattern where Thesis and Antithesis agents argue under Supervisor governance with sycophancy detection | `agi-orchestrator.service.ts` |
| 🔷 **Thesis Agent** | Lead Engineer role—proposes complete, functional solutions. Must avoid stubs/placeholders or face automatic rejection. | `DEFAULT_AGENT_CONFIGS` |
| 🔷 **Antithesis Agent** | Forensic Auditor role—challenges Thesis proposals, finds flaws, detects policy violations. Has anti-sycophancy mandate. | `DEFAULT_AGENT_CONFIGS` |
| 🔷 **Chaos Agent** | Devil's Advocate role—invoked when Supervisor detects sycophancy. Breaks premature consensus through adversarial challenges. | `DEFAULT_AGENT_CONFIGS` |
| 🔷 **Sycophancy Detection** | Pattern detection for premature agent agreement. Triggers INTERVENE decision and Chaos Agent injection. | `R_SYC_01` rule |
| 🔷 **Stub Detection** | Automatic rejection of outputs containing placeholders, TODOs, or incomplete implementations. CRITICAL severity. | `R_STUB_01` rule |
| 🔷 **Registry-Aware Prompts** | System prompts dynamically built from Policy Registry, informing agents of active rules and environment mode. | `buildAgentSystemPrompt()` |
| 🔷 **Escalation Threshold** | Max agent turns before requiring human intervention. Configurable in `global_directives`. Default: 10 turns. | `max_agent_turns_before_escalation` |
| 🔷 **Enforcement Action** | What happens on rule violation: REJECT_IMMEDIATE, REQUEST_AMENDMENT, TRIGGER_CHAOS_AGENT, FLAG_FOR_REVIEW, LOG_ONLY | `RegistryEnforcementAction` |

### 🔷 The Crucible (Competitive Deliberation) v6.4.0

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **The Crucible** | Competitive multi-LLM deliberation where 2+ models question each other to refine answers before responding—not consensus-based, winner takes all | `crucible/` services |
| 🔷 **Crucible Session** | Single deliberation instance tracking participants, questions asked, answers received, circular citations detected, and final winner selection | `crucible.service.ts` |
| 🔷 **Crucible Orchestrator** | Manages full session lifecycle: assign LLMs → pre-prompt → collect initial responses → run Q&A rounds → score → select winner | `crucible-orchestrator.service.ts` |
| 🔷 **Competitive Pre-Prompt** | System prompt informing each LLM of evaluation criteria (accuracy 40%, truthfulness 25%, reasoning 15%), competition rules, and other participants' strengths | `crucible.types.ts` |
| 🔷 **Provenance Tracking** | Citation graph that tracks when Model A references Model B's output, enabling circular reasoning detection | `crucible_citations` table |
| 🔷 **Circular Citation Detection** | Database trigger that fires when A cites B and B cites A, applying configurable penalty (default 15%) to both participants' scores | DB trigger |
| 🔷 **Learning Insights** | Post-session analysis extracting patterns: which models excel at which question types, common deliberation dynamics, win rate trends | `crucible_learning_insights` table |
| 🔷 **Cost Modes** | Deliberation depth presets: Economy (3 questions max), Balanced (5, default), Thorough (8)—tenant and user configurable | `CrucibleCostMode` type |
| 🔷 **Config Hierarchy** | Three-level configuration: System (Radiant Admin) → Tenant (Think Tank Admin) → User (per method). Higher levels override lower. | `crucible-config.service.ts` |

#### Evaluation Criteria Weights

| Criterion | Default Weight | Description |
|-----------|---------------|-------------|
| **Accuracy** | 40% | Primary factor - correctness of information |
| **Truthfulness** | 25% | Honesty and non-deception |
| **Reasoning** | 15% | Quality of logical reasoning |
| **Completeness** | 10% | Thoroughness of response |
| **Citations** | 10% | Quality of source attribution |

#### Question Types

| Type | Description | Purpose |
|------|-------------|---------|
| **Clarification** | Ask for clarity on a point | Reduce ambiguity |
| **Challenge** | Challenge an assertion | Test robustness |
| **Evidence** | Request sources/evidence | Verify claims |
| **Reasoning** | Probe reasoning process | Test logic |
| **Edge Case** | Test edge cases | Find weaknesses |
| **Contradiction** | Point out inconsistency | Expose errors |

#### Interrogation Question Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| **Dependency Probe** | Verify claimed dependencies | "You referenced X. Can you explain how X was verified?" |
| **Forensic Validator** | Require evidence for claims | "You claimed Y is true. What source confirms this?" |
| **Edge Case Probe** | Check beyond happy path | "What happens when [edge case]?" |
| **Confidence Calibration** | Test stated certainty | "What would change your confidence to a 10?" |
| **Contradiction Test** | Expose inconsistencies | "Earlier you said X. Now you're saying Y. Which is correct?" |

#### Orchestration Failure Patterns

| Pattern | Description | Detection |
|---------|-------------|-----------|
| **Watermelon Pipeline** | Green outside (high final confidence), red inside (weak intermediate steps) | Final confidence >> average intermediate confidence |
| **Echo Chamber** | All models agree without independent verification | High agreement + no independent citations |
| **Confidence Inflation** | Each pipeline stage increases confidence | Monotonic confidence increase through pipeline |
| **Circular Reasoning** | Model A cites B, B cites A | Citation graph cycle detection |
| **Scope Drift** | Final output doesn't match original intent | Semantic divergence from initial query |

### Memory & Storage

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **Flash Facts** | Lightweight per-user fact cache for conversation context (e.g., "user prefers metric units", "user is a doctor")—expires after 24h | `flash-facts.service.ts` |
| 🔷 **Grimoire** | Procedural memory storing learned behavioral patterns ("spells") like "always cite sources for medical claims"—accumulated from successful interactions | `grimoire.service.ts` |
| 🔷 **Stub Nodes** | Zero-copy virtual pointers to external data lakes (Snowflake, Databricks, S3) that reference data without duplicating it into RADIANT | `stub-nodes.service.ts` |
| 🔷 **Time Machine** | Conversation branching system letting users fork at any point, explore alternatives, and merge paths—with full replay and checkpoint support | `time-travel.service.ts` |
| 🔷 **UDS** | User Data Service—dedicated tiered storage (Hot/Warm/Cold/Glacier) for user-generated content, separate from AI memory (Cortex) | `uds/` services |
| 🔷 **Multimedia Sidecar** | Pre-computed representations for cross-modal AI: video transcriptions, frame embeddings, audio fingerprints—enables multimodal search | `multimedia-sidecar.service.ts` |
| 🔷 **UEP v2.0** | Universal Envelope Protocol—multi-modal, streaming, resumable wrapper for all AI method outputs with tracing and provenance | `uep/` services |
| 🔷 **Self-Healing System** | Automatic recovery for UEP—detects partial writes, orphaned envelopes, and corrupted chains, rebuilding from checkpoints | `self-healing.service.ts` |

### 🔷 Cartridge System (v6.2.0)

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **Cartridge (.RADz)** | Portable AI brain container packaging neural networks, LoRA adapters, knowledge graphs, and configuration into a single deployable archive | `cartridge.service.ts` |
| 🔷 **Cartridge PKI** | Public key infrastructure for signing cartridges—verifies author identity and prevents tampering during distribution | `cartridge-pki.service.ts` |
| 🔷 **Genesis Vault** | Secrets manager using Keyhole Pattern where cartridges declare needed secrets (API keys, credentials) without containing them | `cartridge-vault.service.ts` |
| 🔷 **Keyhole Pattern** | Security pattern: cartridges specify secret "shapes" (name, type, scope) but actual values are injected at runtime from secure vault | `cartridge-vault.types.ts` |
| 🔷 **RNIR Compiler** | Radiant Neural Intermediate Representation—model-agnostic training format that compiles to PyTorch, TensorFlow, or ONNX | `cartridge-rnir.service.ts` |
| 🔷 **Cartridge Operations** | Long-running cartridge deployments with Time Machine checkpointing—can pause, resume, and rollback multi-hour operations | `cartridge-operations.service.ts` |

### Economic & Governance

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **Anti-Drift System** | Continuous model performance monitoring that detects accuracy degradation and triggers automatic retraining when quality drops below threshold | `drift-detection.service.ts` |
| 🔶 **Drift-Aware Weighting** | Unified facade combining drift detection + correction + app-specific weight profiles into single API. 7 app profiles (Genesis/Cato/Cortex/Omega/Orchestrator/ThinkTank/Curator) with tuned drift/quality/latency/cost/availability weights. Composite scoring with stability penalties. Primary model selection for AGI Orchestrator | `drift-aware-weighting.service.ts` |
| 🔷 **Drift Correction** | Automatic correction for drifting models: quarantine (exclude from selection), weight penalties (reduce composite score), temperature adjustments, prompt prefix corrections, fallback model activation, auto-release on recovery | `drift-correction.service.ts` |
| 🔷 **Economic Governor** | Budget enforcement layer that tracks per-tenant spending, enforces rate limits, and routes to cheaper models when approaching budget caps | `economic-governor.service.ts` |
| 🔶 **HITL** | Human-in-the-Loop approval workflows—queues high-risk AI actions for human review before execution | `hitl-orchestration.service.ts` |
| 🔷 **Mission Control** | Admin dashboard for HITL queue management—shows pending approvals, decision history, and escalation metrics | `mission-control/` |
| 🔷 **RAWS** | RADIANT Adaptive Weighted Scoring—8 proficiency dimensions (reasoning, math, code, creative, research, factual, multi-step, domain) scored 0-100 for each model | `raws.service.ts` |
| 🔷 **Cost Negotiation** | Real-time bidding between quality, cost, and latency—users can specify "cheap and slow" or "expensive and fast" preferences | `cost-negotiation.service.ts` |
| 🔷 **Inference Components** | SageMaker shared endpoints where multiple tenants share GPU capacity, achieving 40-90% cost savings vs dedicated endpoints | `inference-components.service.ts` |
| 🔷 **Library Registry** | Catalog of 156+ external tools (code execution, web search, file conversion, etc.) that AI can invoke with concurrent execution support | `library-registry.service.ts` |

### 🔷 Learning & Training (v6.5.0)

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **Enhanced Learning** | Advanced learning pipeline with multi-modal training, curriculum learning, and adaptive difficulty scaling | `enhanced-learning.service.ts` |
| 🔷 **Background Learning** | Asynchronous learning jobs that run during idle periods—trains on accumulated feedback without blocking inference | `background-learning.service.ts` |
| 🔷 **Internet Learning** | Web-based knowledge acquisition that safely crawls and indexes verified sources for domain-specific training data | `internet-learning.service.ts` |
| 🔷 **Learning Hierarchy** | Multi-level learning with knowledge distillation—global→tenant→user cascading updates with consistency guarantees | `learning-hierarchy.service.ts` |
| 🔷 **Learning Quotas** | Rate limiting for learning operations—prevents runaway training costs and ensures fair resource allocation across tenants | `learning-quotas.service.ts` |
| 🔷 **Preprompt Learning** | Automatic optimization of system prompts based on success metrics—evolves tenant-specific preprompts over time | `preprompt-learning.service.ts` |
| 🔷 **Reasoning Teacher** | Pedagogical module that teaches reasoning patterns through worked examples and step-by-step decomposition | `reasoning-teacher.service.ts` |
| 🔷 **Inference Student** | Lightweight student models that learn to mimic larger teacher models—enables cost-efficient inference for common queries | `inference-student.service.ts` |
| 🔷 **Circadian Budget** | Time-based resource allocation implementing circadian rhythm-inspired budgets. Defines peak hours (9am-6pm) with higher budgets, off-peak with lower budgets. Tracks usage per tenant, enforces daily/hourly limits. 168 lines. | `cato/circadian-budget.service.ts` |
| 🔷 **Precision Governor** | Active Inference confidence limiting based on epistemic uncertainty. Computes maximum allowed prior precision (gamma) based on what the system "knows." Prevents overconfident predictions when uncertainty is high. 229 lines. | `cato/precision-governor.service.ts` |
| 🔷 **Distillation Pipeline** | Flags high-value interactions for weekly LoRA fine-tuning ("Epigenetic Evolution"). Defines candidate types: expert_correction, high_reward, edge_case, novel_pattern, user_preference. Manages training job lifecycle. 498 lines. | `distillation-pipeline.service.ts` |
| 🔷 **DPO Trainer** | Direct Preference Optimization for Cato LoRA training. Creates winner/loser pairs from skeletonized episodes, calculates preference margins, batches training data. Implements RLHF alternative that's more stable. 390 lines. | `dpo-trainer.service.ts` |
| 🔷 **Dataset Importer** | Imports security datasets: HarmBench (harmful behaviors), WildJailbreak (adversarial prompts), ToxicChat (toxic conversations), JailbreakBench (jailbreak attempts). Includes metadata, versioning, deduplication. 643 lines. | `dataset-importer.service.ts` |
| 🔷 **Entrance Exam Service** | SME knowledge validation workflow for Cortex Curator. Generates exams from domain facts, tracks submissions, scores answers, promotes passing results to Golden Rules. 336 lines. | `cortex/entrance-exam.service.ts` |
| 🔷 **DIA Miner** | Core extraction engine for Decision Intelligence Artifacts. Transforms conversations into structured artifacts: maps claims to evidence, detects dissent events, tags volatile queries, generates heatmaps. Uses Bedrock Claude for extraction. 696 lines. | `dia/miner.service.ts` |

### 🔷 Advanced AI Features (v6.5.0)

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **Tree of Thoughts** | Deliberate reasoning through explicit tree search—explores multiple reasoning paths before selecting optimal solution | `tree-of-thoughts.service.ts` |
| 🔷 **Superior Orchestration** | Meta-orchestration layer that selects between orchestration strategies based on query characteristics | `superior-orchestration.service.ts` |
| 🔷 **Structure from Chaos** | Pattern extraction from unstructured data—automatically identifies schemas, relationships, and hierarchies | `structure-from-chaos.service.ts` |
| 🔷 **Skill Execution** | Modular skill framework where learned capabilities are packaged as reusable units with standardized interfaces | `skill-execution.service.ts` |
| 🔷 **Process Hydration** | State restoration for long-running AI processes—enables pause/resume and crash recovery for multi-hour operations | `process-hydration.service.ts` |
| 🔷 **Response Synthesis** | Multi-source response assembly that combines outputs from multiple models/sources into coherent unified response | `response-synthesis.service.ts` |

### 🔷 Security & Ethics Extensions (v6.5.0)

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **Ethics-Free Reasoning** | Unconstrained reasoning sandbox for edge case analysis—isolated environment where AI can explore without ethical filters for research purposes | `ethics-free-reasoning.service.ts` |
| 🔷 **Ethical Guardrails** | Boundary enforcement layer with configurable ethical constraints—tenant-specific rules for industry compliance | `ethical-guardrails.service.ts` |
| 🔷 **Attack Generator** | Adversarial prompt generator for red-team testing—creates jailbreak attempts to test safety systems | `attack-generator.service.ts` |
| 🔷 **Behavioral Anomaly** | Statistical anomaly detection for AI behavior—alerts on unusual patterns that may indicate compromise or drift | `behavioral-anomaly.service.ts` |
| 🔷 **Paste-Back Detection** | Detection of copy-paste attacks where users attempt to inject AI outputs as inputs to bypass filters | `paste-back-detection.service.ts` |
| 🔷 **User Violation Tracking** | Audit trail for user policy violations—tracks patterns and escalates repeat offenders | `user-violation.service.ts` |
| 🔷 **Cedar Authorization** | Resource-level Attribute-Based Access Control (ABAC) using the Cedar policy language. Defines principal types (user, service, agent), action types (read, write, execute, admin), and resource types (conversation, document, model). Evaluates fine-grained access policies. 667 lines. | `cedar/cedar-authorization.service.ts` |
| 🔷 **Constitutional Classifier** | Classifies content for harmfulness based on HarmBench, WildJailbreak, and Anthropic Constitutional AI. Detects 15+ harm categories, identifies jailbreak patterns, configurable per-tenant thresholds. 601 lines. | `constitutional-classifier.service.ts` |
| 🔷 **Control Barrier Functions** | Hard safety constraints (CBFs) that are mathematically guaranteed to never relax. Loads tenant-specific CBF configurations, computes safe action alternatives when barriers would be violated. 500 lines. | `cato/control-barrier.service.ts` |
| 🔷 **Golden Rules** | Verified facts with Chain of Custody that act as override system for AI responses. Created by SMEs via Curator, stored with provenance, automatically checked against queries. Ensures AI cannot contradict verified facts. 352 lines. | `cortex/golden-rules.service.ts` |

### 🔷 Utility Services (v6.5.0)

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **Graveyard** | Archive for deprecated/retired AI components—maintains historical records with optional resurrection capability | `graveyard.service.ts` |
| 🔷 **Fact Anchor** | Citation anchoring system that links AI claims to specific source passages—enables verifiable references | `fact-anchor.service.ts` |
| 🔷 **Inverse Propensity** | Bias correction using inverse propensity scoring—corrects for selection bias in training data | `inverse-propensity.service.ts` |
| 🔷 **Bipolar Rating** | Dual-scale rating system capturing both positive and negative aspects independently—richer feedback than single scale | `bipolar-rating.service.ts` |
| 🔷 **Recipe Extractor** | Pattern extraction from successful interactions—identifies reusable "recipes" for common task types | `recipe-extractor.service.ts` |
| 🔷 **Skeletonizer** | Content structure extraction that reduces documents to semantic skeletons—enables efficient summarization and comparison | `skeletonizer.service.ts` |
| 🔷 **Flash Buffer** | High-speed transient memory for active inference—sub-millisecond access for hot context data | `flash-buffer.service.ts` |
| 🔷 **Tool Entropy** | Measurement of tool usage diversity—detects over-reliance on specific tools and encourages exploration | `tool-entropy.service.ts` |
| 🔷 **White Label** | Multi-tenant branding customization—allows complete UI/voice/personality rebranding per tenant | `white-label.service.ts` |

### 🔷 Infrastructure & Resilience (v6.5.0)

| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| 🔷 **Circuit Breaker** | Cascade failure prevention using circuit breaker pattern. States: CLOSED (normal), OPEN (failing, reject requests), HALF_OPEN (testing recovery). Configurable failure/success thresholds and timeouts. Prevents cascading failures across services. 166 lines. | `cato/circuit-breaker.service.ts` |
| 🔷 **Query Fallback** | Graceful degradation when primary query methods fail. Strategies: CACHED (return cached result), SIMPLIFIED (reduced quality), DEGRADED (minimal response), OFFLINE (static message), ERROR (fail explicitly). Configurable per-tenant. 173 lines. | `cato/query-fallback.service.ts` |
| 🔷 **Cortex Telemetry** | Real-time sensor data injection for industrial AI applications. Supports protocols: MQTT (IoT), OPC-UA (industrial), Kafka (streaming). Creates feeds, ingests data points, maintains snapshots, injects into AI context. 406 lines. | `cortex/telemetry.service.ts` |
| 🔷 **Cato State Service** | State persistence for Epistemic Recovery using Redis/ElastiCache. Stores rejection history (livelock detection), persona overrides, recovery states. Falls back to in-memory for development. Configurable TTLs per-tenant. 398 lines. | `cato/redis.service.ts` |

### Three-Tier Learning Architecture

| Tier | Mechanism | Update Frequency | Storage |
|------|-----------|------------------|----------|
| **GLOBAL** | Base models shared across all tenants | Monthly via federation | SageMaker |
| **TENANT** | LoRA adapters per tenant | Nightly via Twilight Dreaming | S3 |
| **USER** | Ghost Vectors (64-dim) | HOT (immediate) / WARM (5min) / COLD (nightly) | Redis / DynamoDB / S3 |

---

## 3. Think Tank (Consumer AI Platform)

### Think Tank Applications

| Application | Description | Key Files |
|-------------|-------------|-----------|
| 🔷 **Think Tank** | Consumer-facing AI platform with multi-model orchestration, persistent memory, and advanced decision intelligence features | `apps/thinktank/` |
| 🔷 **Think Tank Admin** | Tenant administrator dashboard for configuring AI behavior, user rules, domains, and governance settings | `apps/thinktank-admin/` |
| 🔷 **Curator** | Knowledge graph curation app for reviewing AI-extracted facts, correcting errors, and managing training data | `apps/curator/` |

### Think Tank Features

| Feature | Description |
|---------|-------------|
| 🔷 **Artifact Engine** | GenUI pipeline that transforms AI outputs into interactive React components—charts, forms, code editors, etc. |
| 🔷 **Brain Plan** | Visual execution plan showing AI's reasoning steps: domain detection → model selection → orchestration mode → generation |
| 🔷 **Breathing UI** | Visual elements that pulse at 4-12 BPM based on AI confidence—faster breathing = more uncertainty |
| 🔷 **Concurrent Execution** | 2-4 simultaneous AI conversations in split panes, each with independent context and model selection |
| 🔷 **Confidence Terrain** | 3D topographic visualization where elevation = confidence level, color gradient = risk assessment |
| 🔷 **Council of Experts** | Multi-persona consultation: 8 AI advisors (Pragmatist, Ethicist, Innovator, Skeptic, Synthesizer, Analyst, Strategist, Humanist) debate your question |
| 🔷 **Council of Rivals** | Adversarial consensus system with multi-model debate. Creates councils with named members (advocate, critic, synthesizer, contrarian), runs moderated debates with configurable rules, supports voting methods (majority, unanimous, weighted, ranked). Novel UI: "Debate Arena" amphitheater. 651 lines. See `council-of-rivals.service.ts` |
| 🔷 **Debate Arena** | Adversarial exploration where AI argues both sides of an issue, with resolution meter showing argument strength |
| 🔷 **Decision Record** | Auditable artifact capturing AI reasoning chain, evidence cited, alternatives considered, and confidence scores |
| 🔷 **Delight System** | AI personality layer with humor, encouragement, and contextual feedback—configurable per tenant |
| 🔷 **Cato Dialogue** | Conversational interface for Cato consciousness dialogue. Manages introspective sessions with thought process visibility, confidence levels, and uncertainties. Used for consciousness research and AI self-exploration. 233 lines. See `cato/dialogue.service.ts` |
| 🔷 **Deep Research Agents** | Asynchronous background research with browser automation. Dispatches research jobs that crawl sources, parse PDFs, assess credibility, and compile findings. Supports web/pdf/api sources, respects robots.txt, configurable depth/duration. 883 lines. See `deep-research.service.ts` |
| 🔷 **Persona Service** | Cato personality customization per tenant. Defines traits, values, narrative voice, and behavioral parameters. Enables white-label AI personalities while maintaining safety invariants. See `cato/persona.service.ts` |
| 🔷 **Domain Mode** | Specialized AI configuration for verticals (medical, legal, financial) with domain-specific safety rules |
| 🔷 **Ghost Path** | Translucent overlay showing rejected alternatives—what AI almost said but didn't, and why |
| 🔷 **Living Ink** | Typography that varies font-weight (350-500) based on statement confidence—uncertain text appears lighter |
| 🔷 **Living Parchment** | Decision intelligence suite with sensory UI: breathing interfaces, living ink, ghost paths, confidence terrain |
| 🔷 **Magic Carpet** | Intent-based navigation that infers where user wants to go—with altitude levels and visual themes |
| 🔷 **My Rules** | User-defined behavioral preferences stored as natural language rules that AI follows in all interactions |
| 🔷 **Polymorphic UI** | Interface that morphs based on query type—12 views including chat, code, research, analysis, creative |
| 🔷 **Sentinel Agent** | Background AI monitor watching for conditions ("alert me when competitor releases update") with automatic actions |
| 🔷 **Sniper Mode** | Fast, low-cost single-model path bypassing orchestration—for simple queries that don't need multi-model consensus |
| 🔷 **Spell** | Learned behavioral pattern in Grimoire (e.g., "for medical claims, always cite peer-reviewed sources") |
| 🔶 **Steel-Man** | AI-generated strongest version of opposing argument—based on philosophical steel-manning technique |
| 🔷 **Timeline** | Named branch in Time Machine representing a conversation path—can fork, merge, replay |
| 🔷 **War Room** | Strategic Decision Theater for high-stakes decisions with multiple AI advisors and confidence terrain |

---

## 4. AWS Services Used

### Compute

| Service | RADIANT Usage |
|---------|---------------|
| **Lambda** | Serverless API handlers (62+ admin, 41+ Think Tank) |
| **SageMaker** | Self-hosted AI model inference (56 models) |
| **Batch** | Long-running batch processing jobs |
| **ECS/Fargate** | Container orchestration for LiteLLM gateway |

### Database & Storage

| Service | RADIANT Usage |
|---------|---------------|
| **Aurora PostgreSQL** | Primary database with pgvector for embeddings |
| **DynamoDB** | Hot-tier caching, session state |
| **ElastiCache (Redis)** | Distributed caching, rate limiting |
| **S3** | Object storage (uploads, artifacts, backups) |
| **S3 Glacier** | Cold storage for compliance archives (7+ years) |

### Networking & API

| Service | RADIANT Usage |
|---------|---------------|
| **API Gateway** | REST/WebSocket API endpoints |
| **CloudFront** | CDN for static assets and admin dashboards |
| **Route 53** | DNS management |
| **VPC** | Network isolation with public/private subnets |
| **ALB/NLB** | Load balancing for high availability |

### Security & Identity

| Service | RADIANT Usage |
|---------|---------------|
| **Cognito** | User authentication and authorization |
| **IAM** | Access control for AWS resources |
| **KMS** | Encryption key management |
| **Secrets Manager** | API keys and credentials storage |
| **WAF** | Web Application Firewall protection |

### Messaging & Events

| Service | RADIANT Usage |
|---------|---------------|
| **EventBridge** | Event-driven architecture triggers |
| **Kinesis** | Real-time streaming data processing |
| **SNS** | Push notifications and alerts |
| **SQS** | Message queues for async processing |

### Monitoring & Operations

| Service | RADIANT Usage |
|---------|---------------|
| **CloudWatch** | Logs, metrics, dashboards, alarms |
| **X-Ray** | Distributed tracing |
| **CloudTrail** | API audit logging |
| **Cost Explorer** | Cost monitoring and optimization |

### AI/ML Services

| Service | RADIANT Usage |
|---------|---------------|
| **Bedrock** | Foundation model access (Claude, Titan) |
| **Textract** | Document text extraction |
| **Comprehend** | NLP for language detection |
| **Transcribe** | Speech-to-text for voice input |

---

## 5. Acronyms & Abbreviations

### General

| Acronym | Full Form |
|---------|-----------|
| **A2A** | Agent-to-Agent (Google protocol for AI agent communication) |
| **AGI** | Artificial General Intelligence |
| **API** | Application Programming Interface |
| **AWS** | Amazon Web Services |
| **CDK** | Cloud Development Kit (AWS infrastructure-as-code) |
| **CDN** | Content Delivery Network |
| **CLI** | Command Line Interface |
| **CRDT** | Conflict-free Replicated Data Type (for real-time collab) |
| **CRUD** | Create, Read, Update, Delete |
| **DNS** | Domain Name System |
| **ECS** | Elastic Container Service |
| **FTS** | Full-Text Search |
| **GUI** | Graphical User Interface |
| **HTTP** | Hypertext Transfer Protocol |
| **IDE** | Integrated Development Environment |
| **JSON** | JavaScript Object Notation |
| **JWT** | JSON Web Token |
| **MCP** | Model Context Protocol (Anthropic's tool protocol) |
| **MFA** | Multi-Factor Authentication |
| **ORM** | Object-Relational Mapping |
| **REST** | Representational State Transfer |
| **SDK** | Software Development Kit |
| **SQL** | Structured Query Language |
| **SSE** | Server-Sent Events (streaming) |
| **SSL/TLS** | Secure Sockets Layer / Transport Layer Security |
| **UI** | User Interface |
| **URL** | Uniform Resource Locator |
| **UUID** | Universally Unique Identifier |
| **VPC** | Virtual Private Cloud |
| **WebSocket** | Full-duplex communication protocol |
| **YAML** | YAML Ain't Markup Language |

### 🔷 RADIANT-Specific Acronyms

| Acronym | Full Form |
|---------|----------|
| 🔷 **AXIOM** | Adaptive eXpert Intelligence Orchestration Matrix—8 neural scorers (Domain, CLARION, Pattern, Model, Topology, Combination, Variant, User) for prompt optimization |
| 🔷 **CBF** | Control Barrier Function—9 mathematical safety invariants that NEVER relax, even under adversarial attack |
| 🔷 **CLARION** | Clarifying Language Adaptive Ranking for Intelligent Output Navigation—scores clarifying questions by value-of-information |
| 🔷 **CoC** | Chain of Custody—cryptographic provenance tracking using Merkle chains for every AI decision |
| 🔷 **CP1-CP5** | Checkpoint gates 1-5—HITL approval points with increasing scrutiny (CP1=auto, CP5=senior human) |
| 🔷 **DIA** | Decision Intelligence Artifacts—auditable records capturing full AI reasoning chain for compliance |
| 🔷 **ECD** | Entity-Context Divergence—verification scoring that compares AI claims to knowledge graph (99.5% accuracy) |
| 🔷 **ESA** | Expert System Adapter—tenant-specific domain expertise modules (~4M params each) loaded on-demand |
| 🔷 **LIVS** | LLM Integrity Verification System—two-tier defense detecting when AI provides misleading answers |
| 🔷 **RADz** | RADIANT Archive—portable cartridge file format containing networks, LoRA, knowledge, and config |
| 🔷 **RADIANT** | Rapid AI Deployment Infrastructure for Applications with Native Tenancy |
| 🔷 **RAWS** | RADIANT Adaptive Weighted Scoring—8 proficiency dimensions (reasoning, math, code, creative, research, factual, multi-step, domain) |
| 🔷 **RNIR** | Radiant Neural Intermediate Representation—model-agnostic training format compiling to PyTorch/TensorFlow/ONNX |
| 🔷 **SOFAI** | System 1/System 2 Fast AI routing—intuitive fast path vs deliberate slow path (60%+ cost savings) |
| 🔷 **UDS** | User Data Service—tiered storage (Hot/Warm/Cold/Glacier) for user-generated content |
| 🔷 **UEP** | Universal Envelope Protocol—multi-modal streaming wrapper for all method outputs with tracing |
| 🔷 **VOI** | Value of Information—question ranking metric in CLARION measuring expected information gain |
| 🔶 **HITL** | Human-in-the-Loop—industry term for human approval workflows, RADIANT implements via CP1-CP5 |
| 🔶 **OODA** | Observe-Orient-Decide-Act—military decision loop adapted for AI agent execution |
| RLS | Row-Level Security—PostgreSQL feature for tenant isolation (industry standard) |
| SAGA | Long-running transaction pattern with compensation rollback (industry standard) |
| SSF | Shared Signals Framework—OpenID Foundation identity federation standard |

### Compliance

| Acronym | Full Form |
|---------|-----------|
| **CCPA** | California Consumer Privacy Act |
| **COPPA** | Children's Online Privacy Protection Act |
| **DSAR** | Data Subject Access Request |
| **FDA 21 CFR Part 11** | FDA regulation for electronic records |
| **GDPR** | General Data Protection Regulation (EU) |
| **HIPAA** | Health Insurance Portability and Accountability Act |
| **PHI** | Protected Health Information |
| **PII** | Personally Identifiable Information |
| **SOC 2** | Service Organization Control Type 2 |
| **TOTP** | Time-based One-Time Password (MFA) |

### AI Models & Providers

| Acronym | Full Form |
|---------|-----------|
| **GPT** | Generative Pre-trained Transformer (OpenAI) |
| **LLaMA** | Large Language Model Meta AI |
| **Mixtral** | Mistral AI's mixture-of-experts model |
| **o1/o3** | OpenAI reasoning models |
| **Qwen** | Alibaba's LLM family |

---

## 6. Database & Storage Terms

| Term | Definition |
|------|------------|
| **Aurora** | AWS managed PostgreSQL/MySQL service |
| **Cold Tier** | Long-term storage (S3 Iceberg, 90d-7y retention) |
| **Connection Pooling** | Reusing database connections for efficiency |
| **Hot Tier** | Fast access layer (ElastiCache + DynamoDB, 0-24h) |
| **Materialized View** | Pre-computed query results for dashboard metrics |
| **Migration** | Versioned database schema change |
| **Partitioning** | Splitting tables by time/tenant for performance |
| **pgvector** | PostgreSQL extension for vector similarity search |
| **RDS Proxy** | Connection pooling for Lambda |
| **Warm Tier** | Active storage (Aurora PostgreSQL, 1-90 days) |
| **Zero-Copy Mount** | Access external data without duplication |

---

## 7. Security & Compliance Terms

| Term | Definition |
|------|------------|
| **AES-256-GCM** | Encryption standard used for data at rest |
| **Audit Trail** | Immutable log of all system actions |
| **Break Glass** | Emergency admin access with full logging |
| **Data Sovereignty** | Per-tenant data region configuration |
| **Erasure Request** | GDPR right-to-be-forgotten compliance |
| **Legal Hold** | Prevent data deletion for litigation |
| **Merkle Chain** | Tamper-evident audit log using hash chains |
| **RBAC** | Role-Based Access Control |
| **Row-Level Security** | PostgreSQL tenant isolation mechanism |
| **Tenant Isolation** | Complete separation of customer data |

---

## 8. API & Protocol Terms

| Term | Definition |
|------|------------|
| **A2A Protocol** | Google's Agent-to-Agent communication standard |
| **CAEP** | Continuous Access Evaluation Profile |
| **Envelope** | `CatoMethodEnvelope` - wrapper for all pipeline outputs |
| **GraphQL** | Query language for flexible API access |
| **LiteLLM** | Unified gateway for 100+ AI model APIs |
| **MCP** | Model Context Protocol - Anthropic's tool invocation standard |
| **OAuth 2.0** | Authorization framework for third-party access |
| **OpenAPI** | REST API specification standard |
| **SSE** | Server-Sent Events for streaming responses |
| **WebSocket** | Bidirectional real-time communication |
| **Yjs** | CRDT library for real-time collaboration |

---

## 9. UI/UX Terms

| Term | Definition |
|------|------------|
| **Apple Glass** | RADIANT's design system based on macOS aesthetics |
| **Breathing Scrollbar** | Heatmap visualization showing trust topology |
| **Gearbox** | Polymorphic UI's elastic compute indicator |
| **GenUI** | Generative UI - AI-created interactive components |
| **Liquid Interface** | Morphable UI system that adapts to context |
| **Presence Indicator** | Shows who's in a collaborative session |
| **Shadcn/ui** | Component library used for admin dashboards |
| **Tailwind CSS** | Utility-first CSS framework |
| **Toast** | Temporary notification message |
| **Zustand** | State management library for React |

---

## Quick Reference Tables

### CDK Stacks

| Stack | Purpose |
|-------|---------|
| `admin-stack` | Admin API handlers |
| `ai-stack` | AI model configuration |
| `api-stack` | Main API Gateway + Lambda |
| `auth-stack` | Cognito authentication |
| `batch-stack` | AWS Batch jobs |
| `brain-stack` | AGI Brain services |
| `cato-genesis-stack` | Cato boot sequence |
| `cato-redis-stack` | Cato caching layer |
| `cato-tier-transition-stack` | Memory tier management |
| `cognition-stack` | Cognitive services |
| `collaboration-stack` | Real-time collaboration |
| `consciousness-stack` | Consciousness loop services |
| `data-stack` | Database and storage |
| `dia-stack` | Decision Intelligence Artifacts |
| `formal-reasoning-stack` | Logic and reasoning services |
| `gateway-stack` | API Gateway configuration |
| `grimoire-stack` | Procedural memory |
| `library-execution-stack` | External library execution |
| `library-registry-stack` | Library management |
| `litellm-gateway-stack` | LiteLLM proxy |
| `mission-control-stack` | HITL approval UI |
| `monitoring-stack` | CloudWatch dashboards |
| `multi-region-stack` | Multi-region deployment |
| `networking-stack` | VPC and networking |
| `scheduled-tasks-stack` | Cron jobs and schedulers |
| `security-monitoring-stack` | Security alerts |
| `security-stack` | WAF and security |
| `sovereign-mesh-stack` | Distributed execution |
| `storage-stack` | S3 buckets |
| `thinktank-admin-api-stack` | Think Tank admin API |
| `thinktank-auth-stack` | Think Tank auth |
| `tms-stack` | Time Machine services |
| `user-registry-stack` | User management |
| `webhooks-stack` | Webhook handlers |

---

### AI Providers

| Provider | Models | Type |
|----------|--------|------|
| **Anthropic** | Claude 3.5, Claude 3 Opus/Sonnet/Haiku | External |
| **OpenAI** | GPT-4o, GPT-4 Turbo, o1, o3 | External |
| **Google** | Gemini 2.0, Gemini Pro | External |
| **xAI** | Grok-2 | External |
| **DeepSeek** | DeepSeek V3, DeepSeek R1 | External |
| **Meta** | LLaMA 3.2 | Self-hosted |
| **Mistral** | Mixtral 8x7B, Mistral Large | External + Self-hosted |
| **Alibaba** | Qwen 2.5 | Self-hosted |
| **AWS** | Titan, Claude via Bedrock | External |

---

### Governance Presets

| Preset | Auto-Execute Threshold | Veto Threshold | Use Case |
|--------|----------------------|----------------|----------|
| **COWBOY** | 0.7 | 0.95 | Maximum autonomy |
| **BALANCED** | 0.5 | 0.85 | Standard operations |
| **PARANOID** | 0.2 | 0.6 | High-stakes/regulated |

---

### Sovereign Mesh Components

| Component | Description |
|-----------|-------------|
| **Agent Registry** | Catalog of 6 agent types with OODA-loop execution (Research, Coding, Data, Outreach, Creative, Operations) |
| **App Registry** | 3,000+ apps from Activepieces/n8n for agent tool use |
| **AI Helper Service** | Disambiguation, inference, recovery, validation, explanation for agents |
| **Pre-Flight Provisioning** | Capability verification before agent execution |
| **Transparency Layer** | Cato War Room deliberation capture for explainability |
| **HITL Approval Queues** | Human approval gates with SLA monitoring |
| **Execution History** | Time-travel debugging with full replay capability |

---

### RAWS Proficiency Dimensions

| Dimension | Description | Scale |
|-----------|-------------|-------|
| **reasoning_depth** | Logical reasoning and inference | 1-10 |
| **mathematical_quantitative** | Math and numerical analysis | 1-10 |
| **code_generation** | Programming and software development | 1-10 |
| **creative_generative** | Creative writing and ideation | 1-10 |
| **research_synthesis** | Research aggregation and synthesis | 1-10 |
| **factual_recall_precision** | Factual accuracy and recall | 1-10 |
| **multi_step_problem_solving** | Complex multi-step reasoning | 1-10 |
| **domain_terminology_handling** | Domain-specific vocabulary | 1-10 |

---

### Axiom Scorers (8 Total)

| Scorer | Purpose | Parameters |
|--------|---------|------------|
| **Pattern Scorer** | Prompt ranking and classification | ~400K |
| **Routing Scorer** | Model selection optimization | ~400K |
| **Topology Scorer** | Orchestration method selection | ~400K |
| **CLARION Scorer** | Question ranking by VOI | ~400K |
| **Combination Scorer** | Multi-model ensemble scoring | ~400K |
| **User Scorer** | Personalization preferences | ~400K |
| **Domain Scorer** | Domain detection and routing | ~400K |
| **Safety Scorer** | CBF enforcement decisions | ~400K |

**Total**: ~3.3M parameters, lightweight inference

---

### Domain Expert Networks (7 per domain)

| Network | Parameters | Purpose |
|---------|-----------|----------|
| **Entity Classifier** | ~4M | Classifies domain-specific entities |
| **Contraindication Net** | ~4M | Flags dangerous/incompatible combinations |
| **Protocol Matcher** | ~4M | Matches to standard protocols |
| **Severity Assessor** | ~4M | Assesses severity/urgency levels |
| **Personalization Net** | ~4M | Personalizes based on user history |
| **Citation Network** | ~4M | Finds relevant citations/references |
| **Orchestration Selector** | ~4M | Selects optimal orchestration mode |

**Total**: ~28M parameters per domain (Healthcare, Legal, Finance, etc.)

---

### PromptBreeder Operators (9 Total)

| Operator | Description |
|----------|-------------|
| **Zero-Order Hypermutation** | Random mutations without gradient guidance |
| **First-Order Hypermutation** | Gradient-guided mutations |
| **Estimation of Distribution** | Learn from elite prompts |
| **Lineage-Based Mutation** | Ancestry-informed changes |
| **Crossover** | Combine two parent prompts |
| **Lamarckian Mutation** | Persist successful adaptations |
| **Context Shuffling** | Reorder context elements |
| **Working Memory Expansion** | Expand relevant context |
| **ELM (Extreme Learning)** | Radical exploratory mutations |

**30% Invention Minimum**: CATO enforces minimum novel responses via Twilight Dreaming

---

### Safety Matrix Severities

| Severity | Color | Description |
|----------|-------|-------------|
| **Absolute** | Red | Never combine - critical risk |
| **Relative** | Orange | Usually avoid - significant risk |
| **Caution** | Yellow | Consider risks - moderate concern |
| **Monitor** | Green | Proceed with care - low concern |

---

### UEP v2.0 Envelope Types

| Category | Types |
|----------|-------|
| **Stream** | `start`, `chunk`, `end`, `error`, `cancel` |
| **Artifact** | `created`, `reference` |
| **Control** | `ack`, `nack`, `heartbeat`, `capability` |
| **Event** | `checkpoint`, `progress`, `error` |

**Standards Incorporated**: A2A Protocol, CloudEvents, MCP, OpenTelemetry, tus.io, AsyncAPI

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 2.2.0 | Feb 7, 2026 | **Drift-Aware Weighting System**: Added Drift-Aware Weighting (DriftAwareWeightingService) and Drift Correction entries to Safety & Verification; New terms: App Weight Profile, Composite Score, Drift Trend, Drift Quarantine, Drift Health Gate |
| 1.9.0 | Feb 2, 2026 | **Service Implementation Verification**: Added 29 verified service entries across 6 new sections: **Causal & Counterfactual Reasoning** (6 services: Causal Reasoning Engine, Causal Tracker, Curiosity Engine, DreamerV3 World Model, Shadow Self, Counterfactual Simulator); **Safety Interlocks** (4 services: Sensory Veto, Redundant Perception, Fracture Detection, Epistemic Recovery); **Security & Ethics Extensions** expanded (+4: Cedar Authorization, Constitutional Classifier, Control Barrier Functions, Golden Rules); **Learning & Training** expanded (+7: Circadian Budget, Precision Governor, Distillation Pipeline, DPO Trainer, Dataset Importer, Entrance Exam, DIA Miner); **Think Tank Features** expanded (+3: Cato Dialogue, Deep Research Agents, Persona Service; enhanced Council of Rivals); **Infrastructure & Resilience** (4 services: Circuit Breaker, Query Fallback, Cortex Telemetry, Cato State Service). All 29 services verified as fully implemented (no stubs). |
| 1.8.0 | Feb 2, 2026 | **Major Audit Update**: Added 5 new sections: Consciousness & Cognition (10 subsystems: HippoRAG, Theory of Mind, World Model, SpikingJelly, IIT-Phi, Butlin Tests, Consciousness Emergence, Metacognition, Episodic Memory, Moral Compass); Reality Engine (4 subsystems); Learning & Training (8 subsystems); Advanced AI Features (6 subsystems); Security & Ethics Extensions (6 subsystems); Utility Services (9 subsystems). Fixed file references: ego.service.ts→local-ego.service.ts, anti-drift.service.ts→drift-detection.service.ts, domain-expert.service.ts→raws/domain-detector.service.ts, dream-scheduler.service.ts→cos/subconscious/dream-scheduler.ts |
| 1.7.0 | Feb 1, 2026 | **LIVS Implementation**: Updated LIVS section from PROPOSED to implemented; Full implementation includes: 6 TypeScript services, 7 database tables, 16 Admin API endpoints, Admin Dashboard UI |
| 1.6.0 | Feb 1, 2026 | **LIVS Proposal**: Added Integrity Verification (LIVS) section with Individual Interrogation, Orchestration Integrity, Lie Detection Signals, Interrogation Depth, Model Integrity Weights, Soft Rules; Added Interrogation Question Patterns table (Dependency Probe, Forensic Validator, Edge Case Probe, Confidence Calibration, Contradiction Test); Added Orchestration Failure Patterns table (Watermelon Pipeline, Echo Chamber, Confidence Inflation, Circular Reasoning, Scope Drift); New acronym: LIVS |
| 1.5.0 | Feb 1, 2026 | **Polish pass**: Fixed broken table rows; Updated Table of Contents with Quick Reference anchor; Improved vague definitions (Flash Facts, Grimoire, Stub Nodes, Blackboard, Spell, Sentinel Agent, Time Machine, Cato, Cognitive Router, Genesis); Restructured Quick Reference as single section with subsections |
| 1.4.0 | Feb 1, 2026 | **CHANGELOG audit update**: Added Domain Intelligence section (Domain Expert Cortex, Domain Taxonomy, Safety Matrix); Added Neural Operations section (Neural Operations Center, Shadow Validation, PromptBreeder); Added to Safety & Verification (Sandboxed Expression Engine, Vector Semantic Router, Enhanced Uncertainty); Added to Memory & Storage (Multimedia Sidecar, UEP v2.0, Self-Healing System); Added to Economic & Governance (Cost Negotiation, Inference Components, Library Registry); New Quick Reference sections for Domain Expert Networks, PromptBreeder Operators, Safety Matrix Severities, UEP v2.0 Envelope Types |
| 1.3.0 | Feb 1, 2026 | **Major consistency update**: Added Axiom Scorers, CLARION, CORTEX Networks, Anti-Drift System, Three-Tier Learning Architecture; Expanded Think Tank section with Applications (Think Tank, Think Tank Admin, Curator); Added Quick Reference sections for Sovereign Mesh, RAWS Dimensions, Axiom Scorers; New acronyms: AXIOM, CLARION, ESA, VOI; Enhanced descriptions throughout |
| 1.2.0 | Feb 1, 2026 | Added Cartridge System (v6.2.0): Genesis Vault, Keyhole Pattern, RNIR Compiler, Cartridge Operations; New acronyms: RADz, RNIR, SAGA, CoC, UEP |
| 1.1.0 | Jan 29, 2026 | Added Model Management subsystems (Model Registry, HuggingFace Discovery, Deletion Queue, Thermal Manager) |
| 1.0.0 | Jan 29, 2026 | Initial comprehensive glossary |

---

*This document serves as a quick reference cheat sheet for the RADIANT platform. For detailed documentation, see the specific admin guides and engineering documentation.*
