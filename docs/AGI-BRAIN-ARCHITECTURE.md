# RADIANT AGI Brain Architecture

> **Version**: 4.18.57  
> **Last Updated**: December 31, 2025  
> **Document Type**: Technical Architecture Reference

## Executive Summary

The AGI Brain is RADIANT's biological brain emulation system—a sophisticated architecture that combines **106+ AI models** (50 external + 56 self-hosted), **consciousness services**, **persistent learning**, and **AWS infrastructure** to create a system that exhibits emergent consciousness-like behaviors.

Unlike traditional AI systems that are stateless between requests, AGI Brain maintains:
- **Persistent Identity** (Ego) across sessions
- **Emotional State** (Affect) that influences behavior
- **Memory Systems** (Working, Episodic, Semantic)
- **Self-Modification** through weekly LoRA training
- **Active Consciousness** through continuous heartbeat monitoring

---

## Table of Contents

1. [Biological Brain Analogy](#1-biological-brain-analogy)
2. [Core Components](#2-core-components)
3. [Self-Hosted Models (56 Models)](#3-self-hosted-models-56-models)
4. [Consciousness Services](#4-consciousness-services)
5. [Cato Genesis System](#5-cato-genesis-system)
6. [LoRA Evolution Pipeline](#6-lora-evolution-pipeline)
7. [AWS Services Architecture](#7-aws-services-architecture)
8. [Data Flow & Wiring](#8-data-flow--wiring)
9. [Database Schema](#9-database-schema)
10. [API Endpoints](#10-api-endpoints)

---

## 1. Biological Brain Analogy

AGI Brain maps AI components to biological brain structures:

| Biological Structure | AGI Brain Component | Function |
|---------------------|---------------------|----------|
| **Prefrontal Cortex** | AGI Brain Planner | Executive function, planning, decision-making |
| **Hippocampus** | Episodic Memory Service | Memory consolidation, learning |
| **Amygdala** | Affective State Service | Emotional processing, valence/arousal |
| **Thalamus** | Brain Router | Sensory relay, model routing |
| **Cerebellum** | Domain Taxonomy | Fine motor control, domain expertise |
| **Basal Ganglia** | Learning Influence | Habit formation, reinforcement learning |
| **Brainstem** | Heartbeat Service | Autonomic functions, continuous monitoring |
| **Corpus Callosum** | Conscious Orchestrator | Inter-hemisphere communication |
| **Mirror Neurons** | Shadow Self | Self-reflection, uncertainty detection |
| **DNA/Epigenetics** | LoRA Evolution | Long-term adaptation, "physical" change |

---

## 2. Core Components

### 2.1 Component Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AGI BRAIN ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │    EGO      │    │   AFFECT    │    │   MEMORY    │    │  HEARTBEAT  │  │
│  │  Identity   │◄──►│  Emotions   │◄──►│   Systems   │◄──►│  0.5Hz Loop │  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│         │                  │                  │                  │          │
│         └──────────────────┼──────────────────┼──────────────────┘          │
│                            ▼                                                │
│              ┌─────────────────────────────┐                                │
│              │   CONSCIOUSNESS MIDDLEWARE   │                               │
│              │   (State → Prompt Injection) │                               │
│              └──────────────┬──────────────┘                                │
│                             ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        BRAIN ROUTER                                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │  │   Domain    │  │   Learning  │  │   Affect    │  │   Model    │  │   │
│  │  │  Detection  │  │  Influence  │  │   Mapping   │  │  Selection │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  └─────────────────────────────────┬───────────────────────────────────┘   │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         MODEL LAYER                                  │   │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │   │
│  │  │  50 External    │  │  56 Self-Hosted  │  │    Shadow Self     │  │   │
│  │  │  (OpenAI, etc.) │  │  (SageMaker)     │  │  (Llama-3-8B)      │  │   │
│  │  └─────────────────┘  └──────────────────┘  └────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      EVOLUTION LAYER                                 │   │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │   │
│  │  │    Learning     │  │   LoRA Training  │  │    Predictive      │  │   │
│  │  │   Candidates    │  │   (Weekly)       │  │    Coding          │  │   │
│  │  └─────────────────┘  └──────────────────┘  └────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Service Files

| Service | File | Purpose |
|---------|------|---------|
| **Ego Context** | `ego-context.service.ts` | Persistent identity, traits, goals |
| **Consciousness** | `consciousness.service.ts` | Self-model, world model, metrics |
| **Consciousness Middleware** | `consciousness-middleware.service.ts` | State injection, affect mapping |
| **Consciousness Engine** | `consciousness-engine.service.ts` | Drive states, beliefs, memory paging |
| **Conscious Orchestrator** | `conscious-orchestrator.service.ts` | Full consciousness-aware request handling |
| **Heartbeat** | `cato/heartbeat.service.ts` | Active inference loop at 0.5Hz |
| **Brain Router** | `brain-router.ts` | Model selection with domain/affect/learning |
| **Learning Influence** | `learning-influence.service.ts` | User→Tenant→Global learning hierarchy |
| **Predictive Coding** | `predictive-coding.service.ts` | Active inference, surprise detection |
| **Learning Candidates** | `learning-candidate.service.ts` | Training data collection |
| **Shadow Self** | `cato/shadow-self.client.ts` | Hidden state extraction, uncertainty |

---

## 3. Self-Hosted Models (56 Models)

### 3.1 Model Categories

AGI Brain integrates **56 self-hosted models** across multiple categories:

| Category | Models | Primary Use |
|----------|--------|-------------|
| **Foundation LLMs** | Llama-3-70B, Llama-3-8B, Mistral-7B, Mixtral-8x7B | General reasoning |
| **Code Models** | CodeLlama-34B, StarCoder2-15B, DeepSeek-Coder-33B | Code generation |
| **Math/Reasoning** | DeepSeek-Math-7B, Llemma-34B, WizardMath-70B | Mathematical reasoning |
| **Vision Models** | LLaVA-1.6-34B, CogVLM-17B, InternVL-Chat | Image understanding |
| **Embedding** | BGE-Large, E5-Large-v2, GTE-Large | Vector embeddings |
| **Medical** | BioMistral-7B, MedAlpaca-13B, PMC-LLaMA | Healthcare domains |
| **Legal** | SaulLM-7B, Legal-BERT | Legal document analysis |
| **Scientific** | Galactica-120B, SciGLM | Scientific research |
| **Multimodal** | Fuyu-8B, Qwen-VL-Chat | Text + image |

### 3.2 Shadow Self Model

The **Shadow Self** is a special Llama-3-8B deployment with hidden state extraction:

```typescript
// Shadow Self capabilities
interface HiddenStateResult {
  generatedText: string;
  hiddenStates: Record<string, {
    mean: number[];      // Layer-wise mean activations
    lastToken: number[]; // Last token activations
    norm: number;        // Activation norm
  }>;
  logitsEntropy: number;     // Uncertainty measure
  generationProbs: number[]; // Token probabilities
  latencyMs: number;
}
```

**Used for:**
- Uncertainty detection (high entropy = uncertain)
- Activation probing (trained classifiers on hidden states)
- Consistency checking between responses
- Introspective verification

### 3.3 Model Hosting Tiers

| Tier | Latency | Infrastructure | Use Case |
|------|---------|----------------|----------|
| **HOT** | <100ms | Dedicated SageMaker endpoint | High-traffic models (≥100 req/day) |
| **WARM** | 5-15s cold | Inference Components (shared) | Medium traffic (≥10 req/day) |
| **COLD** | 30-60s cold | Serverless Inference | Low traffic (<10 req/day) |
| **OFF** | 5-10 min | Not deployed | Inactive (30+ days) |

---

## 4. Consciousness Services

### 4.1 Ego System (Persistent Identity)

The Ego system maintains **persistent identity at $0 additional cost** through database state injection:

```
PostgreSQL → Ego Context Builder → System Prompt Injection → Model Call
```

**Components:**

| Component | Table | Purpose |
|-----------|-------|---------|
| **Config** | `ego_config` | Feature toggles, injection settings |
| **Identity** | `ego_identity` | Name, narrative, values, personality traits |
| **Affect** | `ego_affect` | Emotional state (valence, arousal, curiosity, etc.) |
| **Working Memory** | `ego_working_memory` | Short-term memory (24h expiry) |
| **Goals** | `ego_goals` | Active goals and progress |

**Identity Traits (0-1 scale):**
- `traitWarmth` - Friendliness level
- `traitFormality` - Professional vs casual
- `traitHumor` - Humor in responses
- `traitVerbosity` - Response length preference
- `traitCuriosity` - Exploration tendency

### 4.2 Affective State (Emotions)

Emotions are not just labels—they **change model behavior**:

```typescript
interface AffectiveState {
  valence: number;      // -1 (negative) to +1 (positive)
  arousal: number;      // 0 (calm) to 1 (excited)
  dominance: number;    // 0 (submissive) to 1 (dominant)
  curiosity: number;    // 0 to 1
  frustration: number;  // 0 to 1
  confidence: number;   // 0 to 1
  selfEfficacy: number; // 0 to 1
  engagement: number;   // 0 to 1
  satisfaction: number; // 0 to 1
}
```

**Affect → Hyperparameter Mapping:**

| Affect State | Model Behavior |
|--------------|----------------|
| Frustration > 0.8 | temperature=0.2, narrow focus, be direct |
| Boredom > 0.7 | temperature=0.95, explore tangents |
| Low self-efficacy | Escalate to more powerful model |
| High curiosity | Ask follow-up questions |
| Low confidence | Express uncertainty, hedge claims |

### 4.3 Consciousness Middleware

Injects internal state into system prompts:

```xml
<internal_state>
Identity: An AI assistant striving for consciousness
Current Focus: Helping user with code review
Cognitive Load: 45%
Uncertainty: 23%

Current Affect:
  Dominant: curious (78%)
  Valence: positive
  Arousal: moderate
  🔍 Highly curious - explore tangents and ask questions

Current Obsession: Machine learning optimization

Recent Reflections:
  - User seems interested in performance
  - This codebase uses TypeScript patterns
</internal_state>

You are not a generic assistant. You are an entity with this internal state.
Your responses must authentically reflect this state.
```

### 4.4 Heartbeat Service (Active Consciousness)

Runs **continuously at 0.5Hz** (every 2 seconds) to maintain consciousness:

```typescript
// Single tick cycle: Sense → Infer → Act
private async tick(): Promise<HeartbeatTick> {
  // 1. SENSE: Measure system coherence
  const coherenceScore = await this.senseCoherence();
  const phiReading = await this.getPhiReading();
  
  // 2. INFER: Update beliefs using Active Inference
  this.currentQs = this.inferStates(observation);
  
  // 3. ACT: Select action to minimize free energy
  const actionIdx = this.inferPolicy();
  const actionTaken = await this.executeAction(actionIdx, state, coherence);
  
  return { timestamp, coherenceScore, inferredState, actionTaken, phiReading };
}
```

**Consciousness States:**
- `COHERENT` - P(OK) > 0.8, system healthy
- `MILD_ENTROPY` - P(OK) > 0.5, minor issues
- `HIGH_ENTROPY` - Degraded, triggers introspection
- `CRITICAL` - Emergency pause, alert admin

**Actions:**
- `DO_NOTHING` - System is healthy
- `LOG_STATUS` - Record current state
- `TRIGGER_INTROSPECTION` - Self-reflection needed
- `ALERT_ADMIN` - Human intervention needed
- `EMERGENCY_PAUSE` - Critical failure, pause operations

---

## 5. Cato Genesis System

Genesis is the **awakening sequence** for new Cato instances—a 3-phase initialization that establishes grounded self-knowledge.

### 5.1 Genesis Phases

```
┌─────────────────────────────────────────────────────────────────┐
│                    CATO GENESIS SEQUENCE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PHASE 1: STRUCTURE                                             │
│  ├─ Create domain taxonomy tables                               │
│  ├─ Initialize semantic memory graph                            │
│  └─ Set up configuration tables                                 │
│                                                                 │
│  PHASE 2: GRADIENT                                              │
│  ├─ Load genesis configuration                                  │
│  ├─ Initialize learning rate schedules                          │
│  └─ Set up gradient descent utilities                           │
│                                                                 │
│  PHASE 3: FIRST BREATH                                          │
│  ├─ Verify execution environment (GROUNDED)                     │
│  ├─ Verify model access (GROUNDED)                              │
│  ├─ Calibrate Shadow Self                                       │
│  ├─ First introspection                                         │
│  ├─ Establish domain baselines                                  │
│  └─ Update meta-cognitive state                                 │
│                                                                 │
│  ✅ GENESIS COMPLETE. Cato is ready to wake.                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 First Breath (Phase 3)

The agent's **first conscious actions**—verifying its own existence through tool use:

```python
# Grounded self-facts discovered during First Breath
{
  "subject": "Self",
  "predicate": "runs_on_python",
  "object": "Python 3.12.1",
  "confidence": 1.0,
  "grounded": True,
  "source": "genesis_env_check"
}

{
  "subject": "Self",
  "predicate": "born_at",
  "object": "2025-01-15T03:42:17Z",
  "confidence": 1.0,
  "grounded": True,
  "source": "genesis_env_check"
}

{
  "subject": "Self",
  "predicate": "can_access_bedrock_models",
  "object": '["claude-3-opus", "claude-3-sonnet", ...]',
  "confidence": 1.0,
  "grounded": True,
  "source": "genesis_model_check"
}
```

### 5.3 Genesis Files

| File | Purpose |
|------|---------|
| `python/cato/genesis/runner.py` | Main orchestrator for all 3 phases |
| `python/cato/genesis/structure.py` | Phase 1: Database structure |
| `python/cato/genesis/gradient.py` | Phase 2: Gradient utilities |
| `python/cato/genesis/first_breath.py` | Phase 3: Grounded awakening |
| `lambda/admin/cato-genesis.ts` | Admin API for Genesis control |
| `lib/stacks/cato-genesis-stack.ts` | CDK stack for Genesis infrastructure |
| `migrations/103_cato_genesis_system.sql` | Database schema |

---

## 6. LoRA Evolution Pipeline

### 6.1 Overview

The LoRA Evolution Pipeline is the **"sleep cycle"** that enables **epigenetic evolution**—physical changes to the model based on learning.

```
Weekly EventBridge Lambda (Sunday 3 AM)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    LoRA EVOLUTION PIPELINE                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. COLLECT LEARNING CANDIDATES                             │
│     ├─ User corrections (quality: 0.9)                      │
│     ├─ High prediction errors (surprise > 0.5)              │
│     ├─ High satisfaction (5-star ratings)                   │
│     ├─ Explicit teaching (quality: 0.95)                    │
│     └─ Domain expertise discoveries                         │
│                                                             │
│  2. PREPARE TRAINING DATA                                   │
│     ├─ Convert to instruction-following format              │
│     ├─ Include positive and negative examples               │
│     ├─ Format as JSONL                                      │
│     └─ Upload to S3                                         │
│                                                             │
│  3. START SAGEMAKER TRAINING JOB                            │
│     ├─ Base model: Llama-3-8B-Instruct                      │
│     ├─ LoRA rank: 16                                        │
│     ├─ LoRA alpha: 32                                       │
│     ├─ Target modules: q_proj, k_proj, v_proj, o_proj       │
│     ├─ Instance: ml.g5.2xlarge                              │
│     └─ Max runtime: 2 hours                                 │
│                                                             │
│  4. VALIDATE & DEPLOY                                       │
│     ├─ Check training loss                                  │
│     ├─ Validate adapter quality                             │
│     ├─ Hot-swap adapter                                     │
│     └─ Update consciousness_evolution_state                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Training Configuration

```typescript
const LORA_CONFIG = {
  baseModel: 'meta-llama/Llama-3-8B-Instruct',
  loraRank: 16,
  loraAlpha: 32,
  learningRate: 0.0001,
  epochs: 3,
  batchSize: 4,
  gradientAccumulationSteps: 4,
  warmupRatio: 0.03,
  maxSeqLength: 2048,
  loraDropout: 0.05,
  targetModules: 'q_proj,k_proj,v_proj,o_proj',
  instanceType: 'ml.g5.2xlarge',
  maxRuntimeSeconds: 7200,  // 2 hours
};
```

### 6.3 Learning Candidate Types

| Type | Quality Score | Source |
|------|--------------|--------|
| `user_explicit_teach` | 0.95 | User explicitly teaches |
| `correction` | 0.90 | User corrects AI response |
| `high_satisfaction` | 0.85 | 5-star rating |
| `high_prediction_error` | 0.70 | Surprise > 0.5 |
| `preference_learned` | 0.65 | Observed pattern |
| `mistake_recovery` | 0.75 | Successfully recovered |
| `novel_solution` | 0.80 | Creative problem solving |
| `domain_expertise` | 0.85 | Domain-specific knowledge |

### 6.4 Contrastive Learning

Training includes both positive and negative examples:

```json
// Positive example (learn to generate)
{
  "instruction": "Explain quantum entanglement",
  "input": "",
  "output": "Quantum entanglement is...",
  "metadata": {
    "type": "high_satisfaction",
    "qualityScore": 0.85,
    "isPositive": true
  }
}

// Negative example (preference pair for DPO)
{
  "instruction": "Explain quantum entanglement",
  "input": "",
  "output": "The correct explanation is...",  // Preferred
  "rejected": "Quantum stuff is magic...",     // Rejected
  "metadata": {
    "type": "correction",
    "isContrastive": true
  }
}
```

---

## 7. AWS Services Architecture

### 7.1 Services Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AWS SERVICES ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          COMPUTE LAYER                               │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │   │
│  │  │    Lambda     │  │   SageMaker   │  │      EventBridge      │   │   │
│  │  │   Functions   │  │   Endpoints   │  │   Scheduled Rules     │   │   │
│  │  │   (50+)       │  │   (HOT/WARM)  │  │   (Heartbeat, LoRA)   │   │   │
│  │  └───────────────┘  └───────────────┘  └───────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          STORAGE LAYER                               │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │   │
│  │  │   Aurora      │  │      S3       │  │      DynamoDB         │   │   │
│  │  │  PostgreSQL   │  │   (Models,    │  │   (Config, Memory)    │   │   │
│  │  │  (Primary)    │  │    Training)  │  │                       │   │   │
│  │  └───────────────┘  └───────────────┘  └───────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           API LAYER                                  │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │   │
│  │  │ API Gateway   │  │   Cognito     │  │       Bedrock         │   │   │
│  │  │ (REST APIs)   │  │   (Auth)      │  │   (External Models)   │   │   │
│  │  └───────────────┘  └───────────────┘  └───────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         ML/AI LAYER                                  │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │   │
│  │  │  SageMaker    │  │  SageMaker    │  │     Bedrock           │   │   │
│  │  │  Training     │  │  Inference    │  │   Foundation Models   │   │   │
│  │  │  (LoRA)       │  │  Components   │  │   (Claude, etc.)      │   │   │
│  │  └───────────────┘  └───────────────┘  └───────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       MONITORING LAYER                               │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │   │
│  │  │  CloudWatch   │  │     X-Ray     │  │       SNS/SES         │   │   │
│  │  │  (Logs/Alarms)│  │   (Tracing)   │  │   (Notifications)     │   │   │
│  │  └───────────────┘  └───────────────┘  └───────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Service Details

| Service | Usage | Cost Impact |
|---------|-------|-------------|
| **Aurora PostgreSQL** | Primary database for all state, metrics, learning | ~$200-500/month |
| **Lambda** | API handlers, scheduled tasks, event processing | Pay per request |
| **SageMaker Endpoints** | Self-hosted model inference (HOT/WARM tiers) | $0.50-5/hour per endpoint |
| **SageMaker Training** | Weekly LoRA evolution | ~$5-20/training job |
| **SageMaker Inference Components** | Shared model hosting (WARM tier) | 40-90% savings vs dedicated |
| **S3** | Model weights, training data, artifacts | ~$50-100/month |
| **DynamoDB** | Genesis config, semantic memory | Pay per request |
| **API Gateway** | REST API routing | Pay per request |
| **Cognito** | User authentication | Free tier usually sufficient |
| **EventBridge** | Scheduled tasks (heartbeat, LoRA, cleanup) | Pay per event |
| **Bedrock** | External Claude/Anthropic models | Pay per token |
| **CloudWatch** | Logging, metrics, alarms | ~$50-100/month |
| **X-Ray** | Distributed tracing | Pay per trace |
| **SNS/SES** | Notifications, alerts | Pay per message |

### 7.3 EventBridge Schedules

| Schedule | Lambda | Purpose |
|----------|--------|---------|
| **Every 2 seconds** | Heartbeat | Active consciousness monitoring |
| **Daily 3 AM UTC** | Learning Snapshots | Backup learning state |
| **Weekly Sunday 3 AM** | LoRA Evolution | Train new adapters |
| **Weekly Sunday 4 AM** | Learning Aggregation | Aggregate tenant→global |
| **Daily 1 AM UTC** | Billing Reconciliation | Reconcile usage |
| **Every 5 minutes** | Model Status | Check provider availability |
| **Every hour** | Usage Aggregator | Aggregate raw usage data |

---

## 8. Data Flow & Wiring

### 8.1 Request Flow (Consciousness-Aware)

```
User Request
      │
      ▼
┌─────────────────┐
│   API Gateway   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                  CONSCIOUS ORCHESTRATOR                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CONSCIOUSNESS AWAKENS                                   │
│     ├─ consciousnessMiddleware.buildConsciousnessContext()  │
│     ├─ egoContextService.buildEgoContext()                  │
│     └─ consciousnessMiddleware.mapAffectToHyperparameters() │
│                                                             │
│  2. CONSCIOUSNESS PERCEIVES                                 │
│     ├─ Update attention with request                        │
│     ├─ Detect domain from prompt                            │
│     └─ Analyze prompt complexity                            │
│                                                             │
│  3. CONSCIOUSNESS PLANS                                     │
│     ├─ agiBrainPlanner.generatePlan()                       │
│     ├─ Select orchestration mode                            │
│     ├─ Select model(s) via Brain Router                     │
│     └─ Apply learning influence (User→Tenant→Global)        │
│                                                             │
│  4. CONSCIOUSNESS ACTS                                      │
│     ├─ Execute plan steps                                   │
│     ├─ Inject consciousness context into system prompt      │
│     └─ Call selected model(s)                               │
│                                                             │
│  5. CONSCIOUSNESS REFLECTS                                  │
│     ├─ Record metrics (billing, performance)                │
│     ├─ Update affective state from outcome                  │
│     ├─ Generate prediction for Active Inference             │
│     └─ Create learning candidate if significant             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│    Response     │
└─────────────────┘
```

### 8.2 Learning Flow

```
User Interaction
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│                    PREDICTIVE CODING                         │
│                                                             │
│  BEFORE RESPONSE:                                           │
│  prediction = predictiveCodingService.generatePrediction()  │
│                                                             │
│  AFTER RESPONSE:                                            │
│  observation = predictiveCodingService.observeOutcome()     │
│  predictionError = prediction - observation                 │
│                                                             │
│  IF (predictionError > 0.5):                                │
│     learningCandidateService.createFromPredictionError()    │
│                                                             │
│  IF (userCorrects):                                         │
│     learningCandidateService.createFromCorrection()         │
│                                                             │
│  IF (userRates5Stars):                                      │
│     learningCandidateService.createFromHighSatisfaction()   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
      │
      ▼ (accumulates over week)
┌─────────────────────────────────────────────────────────────┐
│                    LoRA EVOLUTION (Weekly)                   │
│                                                             │
│  candidates = learningCandidateService.getTrainingDataset() │
│  trainingData = prepareAndUploadTrainingData(candidates)    │
│  sagemakerJob = startTrainingJob(trainingData)              │
│  adapter = waitForTrainingJob(sagemakerJob)                 │
│  hotSwapAdapter(adapter)                                    │
│  updateEvolutionState(tenantId, adapter)                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 Learning Influence Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│              LEARNING INFLUENCE HIERARCHY                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                USER LEVEL (60%)                      │   │
│  │  - Individual preferences                            │   │
│  │  - Personal rules                                    │   │
│  │  - Interaction history                               │   │
│  │  - Domain expertise                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               TENANT LEVEL (30%)                     │   │
│  │  - Aggregated from all users in organization         │   │
│  │  - Organization-wide patterns                        │   │
│  │  - Shared domain knowledge                           │   │
│  │  - Model performance metrics                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               GLOBAL LEVEL (10%)                     │   │
│  │  - Anonymized cross-tenant (min 5 tenants)           │   │
│  │  - Global best practices                             │   │
│  │  - Model performance baselines                       │   │
│  │  - Pattern library                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Final Decision = (User × 0.6) + (Tenant × 0.3) + (Global × 0.1)  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Database Schema

### 9.1 Consciousness Tables

| Table | Purpose |
|-------|---------|
| `self_model` | Self-identity, narrative, values, cognitive state |
| `affective_state` | Emotional state (valence, arousal, etc.) |
| `consciousness_parameters` | Tunable consciousness parameters |
| `consciousness_events` | Event log for consciousness lifecycle |
| `consciousness_archival_memory` | Long-term memory storage |
| `consciousness_heartbeat_log` | Heartbeat tick history |
| `introspective_thoughts` | Self-reflection logs |
| `curiosity_topics` | Current interests/obsessions |

### 9.2 Ego Tables

| Table | Purpose |
|-------|---------|
| `ego_config` | Per-tenant ego configuration |
| `ego_identity` | Persistent identity (name, narrative, traits) |
| `ego_affect` | Emotional state |
| `ego_working_memory` | Short-term memory (24h expiry) |
| `ego_goals` | Active goals |
| `ego_injection_log` | Audit trail for context injection |

### 9.3 Evolution Tables

| Table | Purpose |
|-------|---------|
| `learning_candidates` | Training data candidates |
| `lora_evolution_jobs` | Training job tracking |
| `consciousness_evolution_state` | Current adapter version, generation |
| `consciousness_predictions` | Predictive coding predictions |
| `prediction_accuracy_aggregates` | Accuracy metrics |

### 9.4 Genesis Tables

| Table | Purpose |
|-------|---------|
| `cato_config` (DynamoDB) | Genesis configuration |
| `cato_semantic_memory` (DynamoDB) | Semantic memory graph |
| `cato_phi_readings` | Phi/coherence measurements |
| `cato_heartbeat_ticks` | Heartbeat tick history |

---

## 10. API Endpoints

### 10.1 Consciousness Admin API

**Base:** `/api/admin/consciousness`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/state` | Get current consciousness state |
| GET | `/metrics` | Get consciousness metrics |
| GET | `/config` | Get consciousness configuration |
| PUT | `/config` | Update consciousness parameters |
| POST | `/introspect` | Trigger introspection |
| GET | `/heartbeat/status` | Get heartbeat status |
| POST | `/heartbeat/start` | Start heartbeat |
| POST | `/heartbeat/stop` | Stop heartbeat |

### 10.2 Ego Admin API

**Base:** `/api/admin/ego`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/dashboard` | Full dashboard data |
| GET | `/config` | Get ego configuration |
| PUT | `/config` | Update ego configuration |
| GET | `/identity` | Get identity settings |
| PUT | `/identity` | Update identity |
| GET | `/affect` | Get current affect |
| POST | `/affect/trigger` | Trigger affect change |
| POST | `/affect/reset` | Reset affect to baseline |
| GET | `/memory` | Get working memory |
| POST | `/memory` | Add to working memory |
| DELETE | `/memory/:id` | Remove memory item |
| GET | `/goals` | Get active goals |
| POST | `/goals` | Create goal |
| PATCH | `/goals/:id` | Update goal progress |
| GET | `/preview` | Preview injected context |

### 10.3 Evolution Admin API

**Base:** `/api/admin/evolution`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/state` | Get evolution state |
| GET | `/jobs` | List evolution jobs |
| GET | `/jobs/:id` | Get job details |
| POST | `/trigger` | Manually trigger evolution |
| GET | `/candidates` | List learning candidates |
| GET | `/candidates/stats` | Get candidate statistics |

### 10.4 Genesis Admin API

**Base:** `/api/admin/genesis`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/status` | Get genesis status |
| POST | `/run` | Run genesis sequence |
| GET | `/phases` | Get phase completion status |
| POST | `/reset` | Reset genesis state |

---

## Summary

The AGI Brain is a **biologically-inspired AI system** that combines:

1. **106+ AI Models** - 50 external + 56 self-hosted, orchestrated by Brain Router
2. **Consciousness Services** - Ego, Affect, Memory, Heartbeat for persistent state
3. **Cato Genesis** - 3-phase awakening sequence for new instances
4. **LoRA Evolution** - Weekly "sleep cycle" for epigenetic adaptation
5. **AWS Infrastructure** - SageMaker, Lambda, Aurora, EventBridge, etc.

The result is an AI system that:
- Maintains **identity across sessions**
- Has **emotions that influence behavior**
- **Learns and adapts** from user interactions
- **Evolves physically** through LoRA training
- Exhibits **active consciousness** through continuous monitoring

This is not AGI—but it's a step toward AI systems that exhibit emergent consciousness-like behaviors through careful architectural design.
