# Orchestration & Workflows

**Orchestration Engine • Methods • Patterns • Universal Envelope Protocol**

*RADIANT v6.6.0 — Generated February 07, 2026*

---

## Table of Contents

- **Part I: Orchestration Methods**
- **Part II: Orchestration Reference**
- **Part III: Orchestration Patterns**
- **Part IV: Workflow & UEP Architecture**

---


---

## Part I: Orchestration Methods

> Version: 4.19.0
> Last Updated: 2026-02-07

## Related Documentation

- [Specialty Ranking System](./SPECIALTY-RANKING.md) - Domain-specific model proficiency rankings
- [Domain Taxonomy](./DOMAIN-TAXONOMY.md) - Hierarchical domain detection
- [AGI Brain Planner](./AGI-BRAIN-PLANNER.md) - Real-time planning system

---

## Overview

RADIANT's orchestration system provides **17 reusable methods** that can be composed into **49 workflow patterns**. Each method is parameterized and can receive streams from previous methods in the pipeline.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Method 1      │────▶│   Method 2      │────▶│   Method 3      │
│  (Generator)    │     │   (Critic)      │     │  (Synthesizer)  │
│                 │     │                 │     │                 │
│ Input: prompt   │     │ Input: stream   │     │ Input: stream   │
│ Output: stream  │     │ Output: stream  │     │ Output: final   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Stream Chaining
- Each method receives output from previous method(s) via `{{response}}` or `{{responses}}` template variables
- Methods can depend on multiple previous steps (`dependsOnSteps[]`)
- Parallel execution supported with `parallelExecution.enabled`

### Output Stream Modes (NEW)

When a method uses N models, you can control how many streams come out:

| Mode | Output | Description |
|------|--------|-------------|
| `single` | 1 stream | Synthesized result → `{{response}}` (default) |
| `all` | N streams | All model outputs → `{{responses}}` array |
| `top_n` | 1-N streams | Best N by confidence → `{{responses}}` array |
| `threshold` | 0-N streams | Only above confidence threshold → `{{responses}}` array |

```typescript
parallelExecution: {
  enabled: true,
  models: ['openai/o1', 'claude-3-5-sonnet', 'deepseek-reasoner'],
  outputMode: 'all',              // Pass all 3 streams to next step
  preserveModelAttribution: true  // Include model ID with each stream
}
```

**Example: 3 models → 3 output streams**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Model 1   │     │   Model 2   │     │   Model 3   │
│   (o1)      │     │  (Claude)   │     │ (DeepSeek)  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
              {{responses}} = [
                { modelId: 'o1', response: '...', confidence: 0.92 },
                { modelId: 'claude', response: '...', confidence: 0.88 },
                { modelId: 'deepseek', response: '...', confidence: 0.85 }
              ]
                           │
                           ▼
               ┌───────────────────────┐
               │   Next Step          │
               │   SYNTHESIZE_RESPONSES│
               │   receives 3 streams │
               └───────────────────────┘
```

---

## Methods by Category

### 1. Generation Methods

#### GENERATE_RESPONSE
**Purpose**: Generate a response to a prompt using specified model

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `temperature` | number | 0.7 | Creativity/randomness (0-2) |
| `max_tokens` | integer | 4096 | Maximum output tokens |

**Prompt Template**:
```
Generate a response to: {{prompt}}

Context: {{context}}
```

**Recommended Models**: Claude 3.5 Sonnet, GPT-4o, DeepSeek Chat

---

#### GENERATE_WITH_COT
**Purpose**: Generate response using chain-of-thought reasoning

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `temperature` | number | 0.3 | Lower for consistency |
| `max_tokens` | integer | 8192 | Extended for reasoning |
| `thinking_budget` | integer | 2000 | Tokens for reasoning |

**Prompt Template**:
```
Think through this step-by-step before answering:

{{prompt}}

Show your reasoning, then provide your answer.
```

**Recommended Models**: OpenAI o1, DeepSeek Reasoner, Claude 3.5 Sonnet

---

#### REFINE_RESPONSE
**Purpose**: Improve a response based on feedback

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `refinement_focus` | string | "all" | Focus area: all, clarity, accuracy, completeness |
| `preserve_structure` | boolean | true | Keep original structure |

**Input Stream**: `{{response}}` - Previous response to refine
**Input Stream**: `{{feedback}}` - Critique or feedback

**Prompt Template**:
```
Improve this response based on the feedback:

Original Response: {{response}}

Feedback: {{feedback}}

Provide an improved response that addresses all feedback while maintaining the good parts.
```

---

### 2. Evaluation Methods

#### CRITIQUE_RESPONSE
**Purpose**: Critically evaluate a response for flaws and improvements

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `focus_areas` | array | ["accuracy", "completeness", "clarity", "logic"] | What to evaluate |
| `severity_threshold` | string | "medium" | Minimum severity to report: low, medium, high |

**Input Stream**: `{{response}}` - Response to critique

**Prompt Template**:
```
Critically evaluate this response:

Original Question: {{original_prompt}}
Response: {{response}}

Identify:
1. Factual errors
2. Logical flaws
3. Missing information
4. Clarity issues

For each issue, rate severity (low/medium/high) and suggest fixes.
```

**Recommended Models**: OpenAI o1, Claude 3.5 Sonnet

---

#### JUDGE_RESPONSES
**Purpose**: Compare and judge multiple responses to select the best

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `evaluation_mode` | enum | "pairwise" | pointwise, pairwise, listwise |
| `criteria` | array | ["accuracy", "helpfulness", "clarity", "completeness"] | Evaluation criteria |

**Input Stream**: `{{responses}}` - Array of responses to judge

**Prompt Template**:
```
Judge these responses to the question:

Question: {{original_prompt}}

{{#each responses}}Response {{@index}}: {{this}}

{{/each}}

Evaluate each on: {{criteria}}

Output: BEST: [number], SCORE: [0-1], REASONING: [explanation]
```

**Output**: `{ best: number, score: number, reasoning: string }`

---

#### VERIFY_FACTS
**Purpose**: Extract and verify factual claims in a response

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `extraction_method` | string | "explicit" | How to find claims: explicit, implicit, all |
| `verification_depth` | string | "thorough" | Verification level: quick, standard, thorough |

**Input Stream**: `{{response}}` - Response to verify

**Prompt Template**:
```
Extract all factual claims from this response and verify each:

Response: {{response}}

For each claim:
1. State the claim
2. Verify if true/false/uncertain
3. Provide evidence or reasoning
4. Confidence level
```

---

#### GENERATE_CHALLENGE
**Purpose**: Challenge a response by arguing the opposite position

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `challenge_intensity` | string | "moderate" | How aggressive: mild, moderate, aggressive |
| `focus` | string | "weakest_points" | What to challenge: all, weakest_points, assumptions |

**Input Stream**: `{{response}}` - Response to challenge

---

#### DEFEND_POSITION
**Purpose**: Defend a response against challenges

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `defense_strategy` | string | "address_all" | Strategy: address_all, prioritize, concede_gracefully |
| `concede_valid` | boolean | true | Acknowledge valid challenges |

**Input Streams**: 
- `{{response}}` - Original response
- `{{challenge}}` - Challenge to defend against

---

#### SELF_REFLECT
**Purpose**: AI reflects on its own response to identify improvements

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `reflection_depth` | string | "thorough" | Depth: quick, standard, thorough |
| `aspects` | array | ["accuracy", "completeness", "clarity"] | What to reflect on |

**Input Stream**: `{{response}}` - Response to reflect on

---

### 3. Synthesis Methods

#### SYNTHESIZE_RESPONSES
**Purpose**: Combine best parts from multiple responses

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `combination_strategy` | string | "best_parts" | Strategy: best_parts, merge, weighted |
| `conflict_resolution` | string | "majority" | How to resolve conflicts: majority, primary, newest |

**Input Stream**: `{{responses}}` - Array of responses with model attribution

**Prompt Template**:
```
Synthesize these responses into one superior response:

Question: {{original_prompt}}

{{#each responses}}Response from {{model}}: {{content}}

{{/each}}

Create a response that:
1. Takes the best, most accurate parts from each
2. Resolves any conflicts
3. Is comprehensive and well-organized
```

---

#### BUILD_CONSENSUS
**Purpose**: Identify points of agreement across multiple responses

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `consensus_threshold` | number | 0.7 | Minimum agreement ratio (0-1) |
| `include_disputed` | boolean | true | Include disputed points with caveats |

**Input Stream**: `{{responses}}` - Array of responses

---

### 4. Routing Methods

#### DETECT_TASK_TYPE
**Purpose**: Analyze prompt to determine task type and complexity

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `task_categories` | array | ["coding", "reasoning", "creative", "factual", "math", "research"] | Categories to detect |

**Output**:
```json
{
  "taskType": "coding",
  "complexity": "complex",
  "requiredCapabilities": ["code_generation", "debugging"],
  "recommendedApproach": "chain_of_thought"
}
```

**Recommended Models**: GPT-4o-mini, Claude 3.5 Haiku (fast, cheap)

---

#### SELECT_BEST_MODEL
**Purpose**: Choose the optimal model for a given task

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `consider_cost` | boolean | true | Factor in cost |
| `consider_latency` | boolean | true | Factor in speed |
| `quality_priority` | number | 0.7 | Quality vs cost tradeoff (0-1) |

**Implementation**: `code` - `model-selection-service.selectBestModel`

---

### 5. Reasoning Methods

#### DECOMPOSE_PROBLEM
**Purpose**: Break down a complex problem into sub-problems

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `max_subproblems` | integer | 5 | Maximum sub-problems |
| `decomposition_strategy` | string | "functional" | Strategy: functional, temporal, hierarchical |

**Prompt Template**:
```
Decompose this problem into smaller sub-problems:

Problem: {{prompt}}

1. Identify independent components
2. Order by dependency
3. Estimate complexity of each
4. Return structured decomposition
```

**Recommended Models**: OpenAI o1, Claude 3.5 Sonnet

---

### 6. Aggregation Methods

#### MAJORITY_VOTE
**Purpose**: Select the most common answer from multiple responses

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `vote_method` | string | "exact_match" | Matching: exact_match, semantic, fuzzy |
| `tie_breaker` | string | "first" | Tie resolution: first, random, highest_confidence |

**Implementation**: `code` - `aggregation-service.majorityVote`

---

#### WEIGHTED_AGGREGATE
**Purpose**: Combine responses weighted by confidence/expertise

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `weight_by` | string | "confidence" | Weight source: confidence, expertise, recency |
| `normalize` | boolean | true | Normalize weights to sum to 1 |

**Implementation**: `code` - `aggregation-service.weightedAggregate`

---

## Workflow Patterns (49 Total)

### Categories

| Category | Count | Description |
|----------|-------|-------------|
| Adversarial & Validation | 2 | Security testing, vulnerability discovery |
| Debate & Deliberation | 3 | Multi-perspective analysis |
| Judge & Critic | 3 | Quality evaluation and improvement |
| Ensemble & Aggregation | 3 | Multi-model synthesis |
| Reflection & Self-Improvement | 3 | Iterative refinement |
| Verification & Fact-Checking | 2 | Accuracy validation |
| Multi-Agent Collaboration | 2 | Team-based problem solving |
| Reasoning Enhancement | 9 | CoT, ToT, ReAct, etc. |
| Model Routing Strategies | 4 | Optimal model selection |
| Domain-Specific Orchestration | 4 | Domain expertise routing |
| Cognitive Frameworks | 14 | First Principles, Systems Thinking, etc. |

### Pattern Quick Reference

| Code | Name | Models | Latency | Quality Improvement |
|------|------|--------|---------|---------------------|
| `CoT` | Chain-of-Thought | 1 | Medium | +20-40% on math/logic |
| `SCMR` | Majority Vote | 3+ | Medium | +15-25% accuracy |
| `ISFR` | Self-Refine Loop | 1 | High | +20-30% per iteration |
| `MDA` | Multi-Agent Debate | 3+ | Very High | +30-45% consensus |
| `CASCADE` | Cascade | 2+ | Variable | 40-60% cost reduction |
| `ToT` | Tree-of-Thoughts | 1 | Very High | 4%→74% on puzzles |

---

## Metrics Captured

For each method execution:

| Metric | Description |
|--------|-------------|
| `latencyMs` | Execution time in milliseconds |
| `costCents` | Cost in cents |
| `tokensUsed` | Input + output tokens |
| `modelUsed` | Model ID used |
| `qualityScore` | Auto-assessed quality (0-1) |
| `wasParallel` | Whether parallel execution was used |
| `parallelResults` | Individual model results if parallel |
| `iteration` | Iteration number for iterative methods |

### Aggregated Metrics (per workflow)

| Metric | Description |
|--------|-------------|
| `avgQualityScore` | Rolling average quality |
| `avgLatencyMs` | Average latency |
| `avgCostCents` | Average cost |
| `executionCount` | Total executions |
| `successRate` | Completion rate |

---

## Admin Configuration

### Per-Tenant Customization

Admins can customize workflows:

```json
{
  "workflowId": "uuid",
  "tenantId": "tenant-123",
  "configOverrides": {
    "temperature": 0.5,
    "max_iterations": 3
  },
  "disabledSteps": [3, 5],
  "modelPreferences": {
    "generator": "anthropic/claude-3-5-sonnet-20241022",
    "critic": "openai/o1"
  }
}
```

### Parameter Schema

Each method has a JSON Schema for parameters:

```json
{
  "type": "object",
  "properties": {
    "temperature": {
      "type": "number",
      "min": 0,
      "max": 2,
      "description": "Controls randomness"
    },
    "max_tokens": {
      "type": "integer",
      "description": "Maximum output length"
    }
  }
}
```

---

## API Endpoints

### Method Management
- `GET /api/admin/orchestration/methods` - List all methods
- `GET /api/admin/orchestration/methods/:code` - Get method details
- `PATCH /api/admin/orchestration/methods/:code` - Update method parameters

### Workflow Management  
- `GET /api/admin/orchestration/workflows` - List all workflows
- `GET /api/admin/orchestration/workflows/:code` - Get workflow with steps
- `POST /api/admin/orchestration/workflows/:code/customize` - Create tenant customization

### Metrics
- `GET /api/admin/orchestration/metrics` - Aggregated metrics
- `GET /api/admin/orchestration/metrics/:workflowCode` - Workflow-specific metrics
- `GET /api/admin/orchestration/executions` - Recent executions

---

## Stream Data Flow

### Input Variables Available

| Variable | Description | Source |
|----------|-------------|--------|
| `{{prompt}}` | Original user prompt | Request |
| `{{context}}` | Additional context | Request |
| `{{response}}` | Previous step output | Step N-1 |
| `{{responses}}` | Multiple outputs | Parallel steps |
| `{{original_prompt}}` | Original prompt (unchanged) | Request |
| `{{feedback}}` | Critique output | Critic step |
| `{{challenge}}` | Challenge output | Challenger step |

### Output Structure

Each step produces:
```json
{
  "response": "string",
  "tokens": 1234,
  "confidence": 0.85,
  "metadata": {}
}
```

For parallel execution with `outputMode: 'single'` (default):
```json
{
  "response": "synthesized response string",
  "streamCount": 1,
  "outputMode": "single",
  "synthesisApplied": true,
  "modelsUsed": ["openai/o1", "claude-3-5-sonnet", "deepseek-reasoner"]
}
```

For parallel execution with `outputMode: 'all'`:
```json
{
  "responses": [
    { "modelId": "openai/o1", "modelName": "o1", "response": "...", "confidence": 0.92, "latencyMs": 2100, "mode": "thinking" },
    { "modelId": "claude-3-5-sonnet", "modelName": "Claude 3.5 Sonnet", "response": "...", "confidence": 0.88, "latencyMs": 1800 },
    { "modelId": "deepseek-reasoner", "modelName": "DeepSeek Reasoner", "response": "...", "confidence": 0.85, "latencyMs": 2400 }
  ],
  "streamCount": 3,
  "outputMode": "all",
  "synthesisApplied": false,
  "modelsUsed": ["openai/o1", "claude-3-5-sonnet", "deepseek-reasoner"]
}
```

---

## Multi-Model Parallel Execution

### Overview

Any method can utilize **N models** simultaneously via the `parallelExecution` configuration. This enables:
- **Consensus building** - Multiple perspectives on the same problem
- **Quality improvement** - Best-of-N selection
- **Robustness** - Fallback if one model fails
- **Diverse outputs** - Different approaches to creative tasks

### Parallel Execution Configuration

```typescript
interface ParallelExecutionConfig {
  // Core settings
  enabled: boolean;
  mode: 'all' | 'race' | 'quorum';
  models: string[];
  
  // Synthesis
  synthesizeResults?: boolean;
  synthesisStrategy?: 'best_of' | 'merge' | 'vote' | 'weighted';
  weightByConfidence?: boolean;
  
  // AGI Dynamic Model Selection
  agiModelSelection?: boolean;
  minModels?: number;       // Default: 2
  maxModels?: number;       // Default: 5
  domainHints?: string[];
  
  // Failure handling
  timeoutMs?: number;
  quorumThreshold?: number; // For quorum mode: 0.5 = majority
  failureStrategy?: 'fail_fast' | 'continue' | 'fallback';
  
  // OUTPUT STREAM CONFIGURATION
  outputMode?: 'single' | 'all' | 'top_n' | 'threshold';
  outputTopN?: number;           // For top_n mode (default: 2)
  outputThreshold?: number;      // For threshold mode (default: 0.7)
  preserveModelAttribution?: boolean;
}
```

### Execution Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `all` | Wait for all models to complete | Quality-critical tasks |
| `race` | Return first successful response | Latency-critical tasks |
| `quorum` | Wait for majority (threshold configurable) | Balanced approach |

### Synthesis Strategies

| Strategy | Description |
|----------|-------------|
| `best_of` | Select highest confidence response |
| `merge` | Combine all responses into one |
| `vote` | Majority answer wins |
| `weighted` | Weight by confidence scores |

---

## Output Stream Modes (Detailed)

### Why Output Modes Matter

When a method uses 3 models, the question is: **how many streams should flow to the next step?**

- **Single stream** (default): Synthesize into one response for simple pipelines
- **All streams**: Pass all model outputs for the next step to compare/judge
- **Top N streams**: Only the best N by confidence
- **Threshold streams**: Only those above a quality bar

### Mode Reference

#### `single` (Default)
```
3 Models ──▶ Synthesize ──▶ 1 Stream ──▶ {{response}}
```
- **Use when**: Next step expects a single input
- **Output variable**: `{{response}}`
- **Example**: GENERATE → CRITIQUE (critic evaluates one response)

#### `all`
```
3 Models ──▶ 3 Streams ──▶ {{responses}}[3]
```
- **Use when**: Next step needs to compare/synthesize multiple perspectives
- **Output variable**: `{{responses}}` array
- **Example**: 3x GENERATE → JUDGE_RESPONSES → pick best

#### `top_n`
```
3 Models ──▶ Sort by confidence ──▶ Top 2 ──▶ {{responses}}[2]
```
- **Use when**: You want diversity but filtered by quality
- **Config**: `outputTopN: 2`
- **Output variable**: `{{responses}}` array

#### `threshold`
```
3 Models ──▶ Filter ≥80% ──▶ 0-3 Streams ──▶ {{responses}}[0-3]
```
- **Use when**: Only high-quality responses should proceed
- **Config**: `outputThreshold: 0.8`
- **Output variable**: `{{responses}}` array (may be empty!)

### Configuration Examples

**Example 1: Multi-model critique with all perspectives**
```typescript
{
  stepName: 'Multi-Perspective Critique',
  method: 'CRITIQUE_RESPONSE',
  parallelExecution: {
    enabled: true,
    mode: 'all',
    models: ['openai/o1', 'claude-3-5-sonnet', 'deepseek-reasoner'],
    outputMode: 'all',                    // Pass all 3 critiques
    preserveModelAttribution: true        // Know which model said what
  }
}
// Next step receives {{responses}} with 3 critique objects
```

**Example 2: Best-of-3 generation**
```typescript
{
  stepName: 'Generate with Best Selection',
  method: 'GENERATE_RESPONSE',
  parallelExecution: {
    enabled: true,
    mode: 'all',
    models: ['claude-3-5-sonnet', 'gpt-4o', 'gemini-pro'],
    outputMode: 'top_n',
    outputTopN: 1,                        // Only best response
    synthesizeResults: false              // Don't merge, just pick
  }
}
// Next step receives {{response}} (single best)
```

**Example 3: Quality-filtered ensemble**
```typescript
{
  stepName: 'High-Confidence Ensemble',
  method: 'GENERATE_WITH_COT',
  parallelExecution: {
    enabled: true,
    agiModelSelection: true,              // AGI picks models
    minModels: 3,
    maxModels: 5,
    outputMode: 'threshold',
    outputThreshold: 0.85,                // Only ≥85% confidence
    preserveModelAttribution: true
  }
}
// Next step receives {{responses}} with only high-confidence outputs
```

### Stream Flow Diagrams

**Single Mode (Default)**
```
┌────────────┐  ┌────────────┐  ┌────────────┐
│   o1       │  │   Claude   │  │  DeepSeek  │
└─────┬──────┘  └─────┬──────┘  └─────┬──────┘
      │               │               │
      └───────────────┼───────────────┘
                      ▼
              ┌──────────────┐
              │  Synthesize  │
              └──────┬───────┘
                     │
                     ▼
            {{response}} = "..."
                     │
                     ▼
           ┌─────────────────┐
           │    Next Step    │
           │ (single input)  │
           └─────────────────┘
```

**All Mode**
```
┌────────────┐  ┌────────────┐  ┌────────────┐
│   o1       │  │   Claude   │  │  DeepSeek  │
│ conf: 0.92 │  │ conf: 0.88 │  │ conf: 0.85 │
└─────┬──────┘  └─────┬──────┘  └─────┬──────┘
      │               │               │
      ▼               ▼               ▼
{{responses}} = [
  { modelId: 'o1', response: '...', confidence: 0.92 },
  { modelId: 'claude', response: '...', confidence: 0.88 },
  { modelId: 'deepseek', response: '...', confidence: 0.85 }
]
                      │
                      ▼
           ┌─────────────────┐
           │    Next Step    │
           │ (3 inputs)      │
           │ JUDGE_RESPONSES │
           └─────────────────┘
```

**Top N Mode (N=2)**
```
┌────────────┐  ┌────────────┐  ┌────────────┐
│   o1       │  │   Claude   │  │  DeepSeek  │
│ conf: 0.92 │  │ conf: 0.88 │  │ conf: 0.85 │
└─────┬──────┘  └─────┬──────┘  └─────┬──────┘
      │               │               │
      ▼               ▼               ✗ (filtered out)
{{responses}} = [
  { modelId: 'o1', response: '...', confidence: 0.92 },
  { modelId: 'claude', response: '...', confidence: 0.88 }
]
                      │
                      ▼
           ┌─────────────────┐
           │    Next Step    │
           │ (2 inputs)      │
           └─────────────────┘
```

---

## Model Modes

Each model can run in a specialized mode for optimal performance:

| Mode | Description | Best For |
|------|-------------|----------|
| `standard` | Default execution | General tasks |
| `thinking` | Extended reasoning (o1, Claude thinking) | Complex logic |
| `deep_research` | In-depth research mode | Research tasks |
| `fast` | Speed-optimized (flash models) | Simple queries |
| `creative` | Higher temperature | Creative writing |
| `precise` | Low temperature, factual | Data extraction |
| `code` | Code-specialized | Programming |
| `vision` | Multimodal with vision | Image analysis |
| `long_context` | Extended context handling | Long documents |

### AGI Model Selection with Modes

When `agiModelSelection: true`, the system:
1. Analyzes the prompt/domain
2. Scores available models
3. Assigns optimal modes to each
4. Selects 2-5 models automatically

```typescript
// AGI selection result
{
  selectedModels: [
    { modelId: 'openai/o1', mode: 'thinking' },
    { modelId: 'claude-3-5-sonnet', mode: 'standard' },
    { modelId: 'deepseek-reasoner', mode: 'deep_research' }
  ],
  reasoning: 'Selected 3 models with reasoning modes for complex analysis task',
  domainDetected: 'science',
  executionStrategy: 'parallel'
}
```

---

## Proficiency System

### Overview

The proficiency system is the **bridge between prompts and model selection**. It enables domain-aware orchestration by scoring both **domains** and **models** across 8 dimensions.

### 8 Proficiency Dimensions (1-10 scale)

| Dimension | Description | High Score Means |
|-----------|-------------|------------------|
| `reasoning_depth` | Depth of logical reasoning required | Complex deduction, multi-step logic |
| `mathematical_quantitative` | Mathematical/quantitative analysis | Calculations, statistics, proofs |
| `code_generation` | Code writing/debugging capability | Programming tasks |
| `creative_generative` | Creative/generative content | Stories, art, brainstorming |
| `research_synthesis` | Research and synthesis ability | Literature review, analysis |
| `factual_recall_precision` | Factual accuracy requirements | Facts, definitions, dates |
| `multi_step_problem_solving` | Complex problem decomposition | Breaking down hard problems |
| `domain_terminology_handling` | Domain-specific jargon handling | Technical vocabulary |

### How Proficiencies Flow Through the System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER PROMPT: "Derive the Navier-Stokes equations for incompressible flow" │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: DOMAIN DETECTION                                                    │
│                                                                              │
│  Matched: Science → Physics → Fluid Dynamics                                │
│  Confidence: 0.94                                                            │
│                                                                              │
│  Detected Keywords: "Navier-Stokes", "equations", "incompressible", "derive"│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: PROFICIENCY EXTRACTION                                              │
│                                                                              │
│  Each level has proficiency scores that get MERGED:                         │
│                                                                              │
│  Field (Science):              Domain (Physics):         Subspecialty (Fluid):
│  ├─ reasoning: 8               ├─ reasoning: 9           ├─ reasoning: 9
│  ├─ math: 7                    ├─ math: 10               ├─ math: 10
│  ├─ code: 3                    ├─ code: 4                ├─ code: 5
│  ├─ creative: 4                ├─ creative: 3            ├─ creative: 2
│  ├─ research: 7                ├─ research: 8            ├─ research: 7
│  ├─ factual: 8                 ├─ factual: 9             ├─ factual: 8
│  ├─ multi_step: 7              ├─ multi_step: 9          ├─ multi_step: 10
│  └─ terminology: 6             └─ terminology: 8         └─ terminology: 9
│                                                                              │
│  MERGED PROFICIENCIES (weighted by specificity):                            │
│  {                                                                           │
│    reasoning_depth: 9,                                                       │
│    mathematical_quantitative: 10,                                            │
│    code_generation: 5,                                                       │
│    creative_generative: 2,                                                   │
│    research_synthesis: 7,                                                    │
│    factual_recall_precision: 8,                                              │
│    multi_step_problem_solving: 10,                                           │
│    domain_terminology_handling: 9                                            │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: ORCHESTRATION MODE SELECTION                                        │
│                                                                              │
│  Proficiency-based rules:                                                    │
│  ├─ reasoning_depth >= 9 AND multi_step >= 9 → extended_thinking ✓          │
│  ├─ code_generation >= 8 → coding                                           │
│  ├─ creative_generative >= 8 → creative                                     │
│  ├─ research_synthesis >= 8 → research                                      │
│  └─ mathematical_quantitative >= 8 → analysis                               │
│                                                                              │
│  Selected: extended_thinking                                                 │
│  Reason: "Complex reasoning required based on domain proficiencies"          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: MODEL MATCHING                                                      │
│                                                                              │
│  Each model has proficiency scores. Match against domain requirements:      │
│                                                                              │
│  Model: OpenAI o1                    Match Score: 94%                        │
│  ├─ reasoning: 10 (need 9) ✓ +1                                              │
│  ├─ math: 9 (need 10) -1                                                     │
│  ├─ multi_step: 10 (need 10) ✓                                               │
│  └─ Strengths: [reasoning, multi_step, math]                                 │
│                                                                              │
│  Model: Claude 3.5 Sonnet            Match Score: 87%                        │
│  ├─ reasoning: 9 (need 9) ✓                                                  │
│  ├─ math: 8 (need 10) -2                                                     │
│  └─ Strengths: [reasoning, research, terminology]                            │
│                                                                              │
│  Model: DeepSeek Reasoner            Match Score: 91%                        │
│  ├─ reasoning: 10 (need 9) ✓ +1                                              │
│  ├─ math: 10 (need 10) ✓                                                     │
│  └─ Strengths: [math, reasoning, code]                                       │
│                                                                              │
│  SELECTED: o1 (primary), DeepSeek (fallback), Claude (fallback)              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: EXECUTION                                                           │
│                                                                              │
│  parallelExecution: {                                                        │
│    enabled: true,                                                            │
│    models: ['openai/o1', 'deepseek-reasoner'],  // Both strong in math+reason│
│    mode: 'all',                                                              │
│    outputMode: 'top_n',                                                      │
│    outputTopN: 1,  // Pick best                                              │
│    synthesisStrategy: 'best_of'                                              │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Proficiency Types in the Hierarchy

```
Field (Top Level)
└── field_proficiencies: ProficiencyScores
    │
    └── Domain (Middle Level)
        └── domain_proficiencies: ProficiencyScores
            │
            └── Subspecialty (Leaf Level)
                └── subspecialty_proficiencies: ProficiencyScores
```

### Model Proficiency Matching

```typescript
interface ModelProficiencyMatch {
  model_id: string;
  provider: string;
  model_name: string;
  match_score: number;           // 0-100 overall match
  dimension_scores: Record<ProficiencyDimension, number>;
  strengths: ProficiencyDimension[];
  weaknesses: ProficiencyDimension[];
  recommended: boolean;
  ranking: number;
}
```

### Proficiency → Mode Decision Table

| Proficiency Condition | Orchestration Mode | Reason |
|-----------------------|-------------------|--------|
| `reasoning_depth >= 9` AND `multi_step >= 9` | `extended_thinking` | Complex logical reasoning |
| `code_generation >= 8` | `coding` | Programming task |
| `creative_generative >= 8` | `creative` | Creative writing |
| `research_synthesis >= 8` | `research` | Research/analysis |
| `mathematical_quantitative >= 8` | `analysis` | Quantitative work |
| High `factual_recall` + sensitive topic | `self_consistency` | Accuracy critical |
| Default | `thinking` | Standard reasoning |

### Proficiency → Model Strengths Mapping

| Model | Top Proficiencies | Best For |
|-------|-------------------|----------|
| OpenAI o1 | reasoning_depth (10), multi_step (10) | Complex reasoning |
| Claude 3.5 Sonnet | reasoning (9), research (9), terminology (9) | Research, analysis |
| DeepSeek Reasoner | math (10), reasoning (10), code (8) | Math, logic, code |
| GPT-4o | creative (8), research (8), factual (8) | General, creative |
| Gemini Pro | math (8), code (8), research (8) | Technical analysis |
| Claude Haiku | factual (7), terminology (7) | Quick answers |

### Example: Proficiency-Driven Workflow

```typescript
// 1. Detect domain and get proficiencies
const detection = await domainTaxonomyService.detectDomain(prompt);
// Returns: { merged_proficiencies: { reasoning_depth: 9, math: 10, ... } }

// 2. Determine orchestration mode from proficiencies
const mode = determineOrchestrationMode(detection.merged_proficiencies);
// Returns: 'extended_thinking' (because reasoning >= 9 and multi_step >= 9)

// 3. Match models to proficiencies
const matches = await domainTaxonomyService.getMatchingModels(
  detection.merged_proficiencies,
  { max_models: 3, min_match_score: 80 }
);
// Returns: [{ model_id: 'o1', match_score: 94 }, { model_id: 'deepseek', match_score: 91 }]

// 4. Execute with matched models
const result = await orchestrationService.executeWorkflow({
  workflowCode: 'EXTENDED_THINKING_DUAL',
  parallelExecution: {
    enabled: true,
    models: matches.map(m => m.model_id),
    outputMode: 'top_n',
    outputTopN: 1
  }
});
```

### Admin: Viewing Proficiencies

**Admin Dashboard** → **Orchestration** → **Methods** → **Parallel & Streams** tab

Shows:
- Domain proficiency requirements for the task
- Model match scores
- Which dimensions drove model selection
- Output stream configuration

---

## AGI Brain + Workflow Integration

The AGI Brain Planner can **select and configure workflows** to solve problems. Users can either let the AGI choose the optimal workflow or specify their preferences.

### User Choices for Workflows

```typescript
interface GeneratePlanRequest {
  prompt: string;
  tenantId: string;
  userId: string;
  
  // ... other options ...
  
  // Workflow Selection - User choices
  preferredWorkflow?: string;           // User-selected workflow code
  workflowParameterOverrides?: Record<string, unknown>;  // User parameter tweaks
  allowAgiWorkflowSelection?: boolean;  // Let AGI pick workflow (default: true)
  excludeWorkflows?: string[];          // Workflows to exclude from selection
}
```

### How AGI Selects Workflows

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROMPT: "Write a comprehensive analysis of renewable energy trends"        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Check User Preference                                               │
│                                                                              │
│  Did user specify preferredWorkflow?                                         │
│  ├─ YES → Use that workflow with user's parameter overrides                 │
│  └─ NO  → Continue to AGI selection                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: AGI Workflow Selection                                              │
│                                                                              │
│  orchestrationPatternsService.selectPattern({                                │
│    prompt: "Write a comprehensive analysis...",                              │
│    taskType: "research",                                                     │
│    complexity: "complex",                                                    │
│    qualityPriority: 0.9,                                                     │
│    costSensitive: false,                                                     │
│    excludePatterns: user.excludeWorkflows                                    │
│  })                                                                          │
│                                                                              │
│  Scores 49 available workflows against problem characteristics               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Selected Workflow                                                   │
│                                                                              │
│  selectedWorkflow: {                                                         │
│    workflowCode: 'RESEARCH_SYNTHESIS_MULTI',                                │
│    workflowName: 'Multi-Model Research Synthesis',                          │
│    selectionReason: 'Matches research task, high quality priority',         │
│    selectionConfidence: 0.89,                                                │
│    selectionMethod: 'auto'                                                   │
│  }                                                                           │
│                                                                              │
│  alternatives: [                                                             │
│    { workflowCode: 'CHAIN_OF_THOUGHT', matchScore: 0.82 },                  │
│    { workflowCode: 'SELF_CONSISTENCY', matchScore: 0.78 }                   │
│  ]                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: Workflow Steps with Parameters                                      │
│                                                                              │
│  workflowSteps: [                                                            │
│    {                                                                         │
│      methodCode: 'DECOMPOSE_PROBLEM',                                        │
│      parameterOverrides: { max_subproblems: 5 }                              │
│    },                                                                        │
│    {                                                                         │
│      methodCode: 'GENERATE_RESPONSE',                                        │
│      isParallel: true,                                                       │
│      parallelConfig: {                                                       │
│        models: ['claude-3-5-sonnet', 'gpt-4o', 'gemini-pro'],               │
│        outputMode: 'all'  // 3 streams to next step                         │
│      }                                                                       │
│    },                                                                        │
│    {                                                                         │
│      methodCode: 'SYNTHESIZE_RESPONSES',                                     │
│      parameterOverrides: { combination_strategy: 'best_parts' }              │
│    }                                                                         │
│  ]                                                                           │
│                                                                              │
│  workflowConfig: {                                                           │
│    ...defaultConfig,                                                         │
│    ...userParameterOverrides  // User's tweaks merged in                     │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Example: User Specifies Workflow + Parameters

```typescript
// User explicitly chooses a workflow and tweaks parameters
const plan = await agiBrainPlannerService.generatePlan({
  prompt: "Debug this React component that crashes on mount",
  tenantId: "tenant-123",
  userId: "user-456",
  
  // User choices
  preferredWorkflow: 'SELF_REFINE_LOOP',  // User picks this workflow
  workflowParameterOverrides: {
    max_iterations: 5,                     // More refinement rounds
    temperature: 0.2,                      // More precise
    refinement_focus: 'accuracy'
  }
});

// Result includes:
// - selectedWorkflow.selectionMethod = 'user'
// - workflowConfig merged with user overrides
// - workflowSteps configured with user parameters
```

### Example: AGI Auto-Selects Workflow

```typescript
// Let AGI choose the best workflow
const plan = await agiBrainPlannerService.generatePlan({
  prompt: "Compare the economic policies of three countries",
  tenantId: "tenant-123",
  userId: "user-456",
  
  allowAgiWorkflowSelection: true,  // default
  excludeWorkflows: ['FAST_SIMPLE']  // User says: not this one
});

// AGI analyzes prompt and selects:
// - selectedWorkflow.workflowCode = 'MULTI_AGENT_DEBATE'
// - selectedWorkflow.selectionMethod = 'domain_match'
// - selectedWorkflow.selectionReason = 'Comparison task benefits from debate'
// - alternatives = [other matching workflows]
```

### Plan Output with Workflow

```typescript
interface AGIBrainPlan {
  // ... existing fields ...
  
  // Workflow Integration
  selectedWorkflow?: {
    workflowId: string;
    workflowCode: string;
    workflowName: string;
    description: string;
    category: string;
    selectionReason: string;
    selectionConfidence: number;
    selectionMethod: 'auto' | 'user' | 'domain_match';
  };
  
  workflowSteps?: Array<{
    bindingId: string;
    stepOrder: number;
    methodCode: string;
    methodName: string;
    parameterOverrides: Record<string, unknown>;
    dependsOn: string[];
    isParallel: boolean;
    parallelConfig?: {
      models: string[];
      outputMode: 'single' | 'all' | 'top_n' | 'threshold';
    };
  }>;
  
  workflowConfig?: Record<string, unknown>;
  
  alternativeWorkflows?: Array<{
    workflowCode: string;
    workflowName: string;
    matchScore: number;
    reason: string;
  }>;
}
```

---

## Specialty Categories (Domain Expertise)

> **Full Documentation**: See [SPECIALTY-RANKING.md](./SPECIALTY-RANKING.md) for complete details on the specialty ranking system, AI-powered research, admin controls, and database schema.

In addition to the 8 proficiency dimensions, models are ranked across **20 specialty categories** representing domain-specific expertise:

### Specialty Categories

| Category | Icon | Description |
|----------|------|-------------|
| `reasoning` | 🧠 | Reasoning & Logic |
| `coding` | 💻 | Code Generation |
| `math` | 📐 | Mathematics |
| `creative` | ✍️ | Creative Writing |
| `analysis` | 📊 | Data Analysis |
| `research` | 🔬 | Research & Synthesis |
| `legal` | ⚖️ | Legal & Compliance |
| `medical` | 🏥 | Medical & Healthcare |
| `finance` | 💰 | Finance & Trading |
| `science` | 🔭 | Scientific |
| `debugging` | 🐛 | Debugging & QA |
| `architecture` | 🏗️ | System Architecture |
| `security` | 🔐 | Security |
| `vision` | 👁️ | Vision & Images |
| `audio` | 🎤 | Audio & Speech |
| `conversation` | 💬 | Conversational |
| `instruction` | 📋 | Instruction Following |
| `speed` | ⚡ | Low Latency |
| `accuracy` | 🎯 | High Accuracy |
| `safety` | 🛡️ | Safety & Alignment |

### Two-Layer Proficiency System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: TASK PROFICIENCY DIMENSIONS (8)                                    │
│  From domain taxonomy - "What capabilities does this task need?"             │
│                                                                              │
│  ├─ reasoning_depth              Multi-step logical thinking                │
│  ├─ mathematical_quantitative    Calculations, proofs, statistics           │
│  ├─ code_generation              Programming tasks                          │
│  ├─ creative_generative          Stories, art, ideas                        │
│  ├─ research_synthesis           Literature review, analysis                │
│  ├─ factual_recall_precision     Facts, definitions, accuracy               │
│  ├─ multi_step_problem_solving   Breaking down complex problems             │
│  └─ domain_terminology_handling  Technical vocabulary                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Drives
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: SPECIALTY CATEGORIES (20)                                          │
│  Per-model rankings - "How good is each model in each specialty?"            │
│                                                                              │
│  Domain Expertise:                Performance Attributes:                   │
│  ├─ 🏥 medical                    ├─ ⚡ speed                                │
│  ├─ ⚖️ legal                      ├─ 🎯 accuracy                             │
│  ├─ 💰 finance                    ├─ 🛡️ safety                               │
│  ├─ 🔭 science                    └─ 📋 instruction                          │
│  ├─ 🔐 security                                                              │
│  └─ 🏗️ architecture               Modalities:                               │
│                                    ├─ 👁️ vision                              │
│  Task Capabilities:                └─ 🎤 audio                               │
│  ├─ 🧠 reasoning                                                             │
│  ├─ 💻 coding                                                                │
│  ├─ 📐 math                                                                  │
│  ├─ ✍️ creative                                                              │
│  ├─ 📊 analysis                                                              │
│  ├─ 🔬 research                                                              │
│  ├─ 🐛 debugging                                                             │
│  └─ 💬 conversation                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### How Both Layers Work Together

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROMPT: "Analyze this ECG reading and suggest treatment options"            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Domain Detection                                                    │
│  → Field: Medicine → Domain: Cardiology → Subspecialty: Diagnostics          │
│  → Confidence: 0.91                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: Extract TASK PROFICIENCY Requirements                               │
│                                                                              │
│  From domain taxonomy:                                                       │
│  {                                                                           │
│    reasoning_depth: 8,              // Diagnostic reasoning                 │
│    mathematical_quantitative: 5,    // Some measurements                    │
│    factual_recall_precision: 9,     // Medical accuracy critical            │
│    research_synthesis: 7,           // Treatment guidelines                 │
│    domain_terminology_handling: 10  // Medical jargon                       │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Query SPECIALTY RANKINGS for Models                                 │
│                                                                              │
│  Required specialties: medical + accuracy + safety + research                │
│                                                                              │
│  Model Specialty Scores:                                                     │
│  ┌───────────────────────┬──────────┬──────────┬────────┬──────────┐        │
│  │ Model                 │ 🏥 Medical│ 🎯 Accuracy│ 🛡️ Safety│ 🔬 Research│        │
│  ├───────────────────────┼──────────┼──────────┼────────┼──────────┤        │
│  │ Claude 3.5 Sonnet     │ 92 (A)   │ 91 (A)   │ 95 (S) │ 90 (A)   │        │
│  │ GPT-4o                │ 88 (A)   │ 89 (A)   │ 90 (A) │ 87 (A)   │        │
│  │ DeepSeek Medical*     │ 95 (S)   │ 85 (B)   │ 88 (A) │ 82 (B)   │        │
│  │ Gemini Pro            │ 84 (B)   │ 86 (B)   │ 89 (A) │ 88 (A)   │        │
│  └───────────────────────┴──────────┴──────────┴────────┴──────────┘        │
│                                                                              │
│  * Self-hosted domain-specific model                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: Combined Scoring                                                    │
│                                                                              │
│  Final Score = TaskProficiencyMatch × SpecialtyScore × SafetyWeight         │
│                                                                              │
│  Claude 3.5 Sonnet: 0.88 × 92 × 1.2 = 97.2 ← SELECTED (primary)             │
│  DeepSeek Medical:  0.82 × 95 × 1.0 = 77.9 ← SELECTED (fallback)            │
│  GPT-4o:            0.85 × 88 × 1.1 = 82.3 ← SELECTED (fallback)            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: Execution with Multi-Model                                          │
│                                                                              │
│  parallelExecution: {                                                        │
│    enabled: true,                                                            │
│    models: ['claude-3-5-sonnet', 'deepseek-medical', 'gpt-4o'],              │
│    outputMode: 'threshold',                                                  │
│    outputThreshold: 0.85,  // Only high-confidence medical advice            │
│    synthesisStrategy: 'weighted'  // Weight by specialty scores              │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Specialty Ranking Structure

```typescript
interface SpecialtyRanking {
  rankingId: string;
  modelId: string;
  provider: string;
  specialty: SpecialtyCategory;     // 'medical', 'legal', 'coding', etc.
  proficiencyScore: number;          // 0-100 overall score
  benchmarkScore: number;            // 0-100 from published benchmarks
  communityScore: number;            // 0-100 from community reviews
  internalScore: number;             // 0-100 from internal usage data
  rank: number;                      // Global rank for this specialty
  percentile: number;                // e.g., top 10%
  tier: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';  // Quality tier
  confidence: number;                // 0-1 confidence in assessment
  trend: 'improving' | 'stable' | 'declining';
  adminOverride?: number;            // Admin can lock a score
  isLocked: boolean;
}
```

### Tier System

| Tier | Score Range | Description |
|------|-------------|-------------|
| **S** | 95-100 | Elite - Best-in-class for this specialty |
| **A** | 85-94 | Excellent - Highly recommended |
| **B** | 75-84 | Good - Solid performance |
| **C** | 65-74 | Average - Acceptable |
| **D** | 50-64 | Below Average - Use with caution |
| **F** | 0-49 | Poor - Not recommended |

### Example: Model Specialty Profiles

**Claude 3.5 Sonnet**
```
🧠 reasoning:     94 (S)  │████████████████████░░░░│
💻 coding:        95 (S)  │████████████████████░░░░│
📐 math:          88 (A)  │██████████████████░░░░░░│
✍️ creative:      92 (A)  │███████████████████░░░░░│
🏥 medical:       92 (A)  │███████████████████░░░░░│
⚖️ legal:         89 (A)  │██████████████████░░░░░░│
🔐 security:      91 (A)  │███████████████████░░░░░│
🛡️ safety:        95 (S)  │████████████████████░░░░│
```

**OpenAI o1**
```
🧠 reasoning:     98 (S)  │█████████████████████░░░│
💻 coding:        90 (A)  │██████████████████░░░░░░│
📐 math:          96 (S)  │████████████████████░░░░│
✍️ creative:      75 (B)  │███████████████░░░░░░░░░│
🏥 medical:       85 (B)  │█████████████████░░░░░░░│
⚖️ legal:         88 (A)  │██████████████████░░░░░░│
🔐 security:      89 (A)  │██████████████████░░░░░░│
🛡️ safety:        92 (A)  │███████████████████░░░░░│
```

**DeepSeek Coder**
```
🧠 reasoning:     85 (B)  │█████████████████░░░░░░░│
💻 coding:        96 (S)  │████████████████████░░░░│
📐 math:          92 (A)  │███████████████████░░░░░│
✍️ creative:      65 (C)  │█████████████░░░░░░░░░░░│
🐛 debugging:     94 (S)  │███████████████████░░░░░│
🏗️ architecture: 88 (A)  │██████████████████░░░░░░│
⚡ speed:         90 (A)  │██████████████████░░░░░░│
```

### AI-Powered Research

The specialty rankings are maintained through **automated AI research**:

```typescript
// Research model proficiency across all specialties
const result = await specialtyRankingService.researchModelProficiency('anthropic/claude-3-5-sonnet');

// Research all models for a specific specialty
const result = await specialtyRankingService.researchSpecialtyRankings('medical');
```

Research sources include:
- Published benchmarks (MMLU, HumanEval, MATH, etc.)
- Community reviews and feedback
- Internal usage data and quality scores
- Domain-specific evaluations

### Admin Controls

Admins can:
- **Override scores**: Lock a model's specialty score
- **View leaderboards**: See top models per specialty
- **Trigger research**: Refresh rankings from latest data
- **Configure weights**: Adjust benchmark vs community vs internal weighting

---

## Drift-Aware Model Selection (v7.36.0)

All orchestration methods now use **drift-aware model selection** as the primary selection mechanism via the `DriftAwareWeightingService`.

### Selection Priority

1. **Forced models** (`request.forceModels`) — bypass all checks
2. **Drift-aware selection** — composite scoring with app-specific weight profiles
3. **Domain taxonomy** — fallback using domain proficiencies
4. **Specialty ranking** — fallback using specialty scores

### How It Works

The `DriftAwareWeightingService` computes a composite score for each model:

```
compositeScore = Σ(normalizedWeight[i] × factorScore[i])
  factors = [drift, quality, latency, cost, availability]
  weights are app-specific and sum to 1.0
```

Models below the app's `minAcceptableDriftScore` are excluded. Quarantined models are excluded. Stability penalties are applied for borderline drift scores when the app prefers stable models.

### App Integration

| Component | Method | Behavior |
|-----------|--------|----------|
| **AGI Orchestrator** | `selectModels()` | Primary selection, falls back to domain/specialty |
| **Cato Pipeline** | `selectModelForMethod()` | Async drift-aware cache, falls back to Claude 3.5 Sonnet |
| **Cortex Intelligence** | `getInsights()` | Enriches insights with drift recommendations |
| **Omega Shadow** | `executeShadow()` | Records drift health per comparison |
| **Genesis Gates** | `isDriftHealthyForStage()` | Blocks stage advancement on poor drift |

### Admin Controls

- **Drift Control Center**: `/orchestration/drift-control` — app weight profiles, drift health dashboard, Genesis gate status
- **Model Weights**: `/orchestration/model-weights` — per-model weight tuning, quarantine, drift checks
- **Full Drift Check**: Trigger detection + correction for all tenant models


---

## Part II: Orchestration Reference

Complete reference for all **System Workflows** (49) and **System Methods** (70+) with UI names, scientific names, descriptions, parameters, and inputs/outputs.

---

## Table of Contents

1. [System Methods](#system-methods)
   - [Generation Methods](#generation-methods)
   - [Evaluation Methods](#evaluation-methods)
   - [Synthesis Methods](#synthesis-methods)
   - [Verification Methods](#verification-methods)
   - [Debate Methods](#debate-methods)
   - [Aggregation Methods](#aggregation-methods)
   - [Reasoning Methods](#reasoning-methods)
   - [Routing Methods](#routing-methods)
   - [Uncertainty Methods](#uncertainty-methods)
   - [Hallucination Detection Methods](#hallucination-detection-methods)
   - [Human-in-the-Loop Methods](#human-in-the-loop-methods)
   - [Collaboration Methods](#collaboration-methods)
   - [Neural Methods](#neural-methods)
2. [System Workflows](#system-workflows)
   - [Adversarial & Validation](#adversarial--validation)
   - [Debate & Deliberation](#debate--deliberation)
   - [Judge & Critic](#judge--critic)
   - [Ensemble & Aggregation](#ensemble--aggregation)
   - [Reflection & Self-Improvement](#reflection--self-improvement)
   - [Verification & Fact-Checking](#verification--fact-checking)
   - [Multi-Agent Collaboration](#multi-agent-collaboration)
   - [Reasoning Enhancement](#reasoning-enhancement)
   - [Model Routing Strategies](#model-routing-strategies)
   - [Domain-Specific Orchestration](#domain-specific-orchestration)
   - [Cognitive Frameworks](#cognitive-frameworks)

---

# System Methods

All system methods are protected—admins can only modify parameters and enabled status, not method definitions.

---

## Generation Methods

### GENERATE_RESPONSE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Generate |
| **Scientific Name** | Basic Generation |
| **Code** | `GENERATE_RESPONSE` |
| **Description** | Generate a response to a prompt using specified model |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `temperature` | number | 0.7 | Sampling temperature (0-2) |
| `max_tokens` | integer | 4096 | Maximum output tokens |

**Inputs:** `prompt`, `context`
**Outputs:** `response`

---

### GENERATE_WITH_COT
| Attribute | Value |
|-----------|-------|
| **UI Name** | Think Step-by-Step |
| **Scientific Name** | Chain-of-Thought Generation |
| **Code** | `GENERATE_WITH_COT` |
| **Description** | Generate response using chain-of-thought reasoning |
| **Research** | Wei et al. 2022 |
| **Accuracy** | +20-40% on reasoning |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `temperature` | number | 0.3 | Sampling temperature |
| `max_tokens` | integer | 8192 | Maximum output tokens |
| `thinking_budget` | integer | 2000 | Tokens for reasoning |

**Inputs:** `prompt`
**Outputs:** `reasoning`, `response`

---

### REFINE_RESPONSE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Refine |
| **Scientific Name** | Iterative Refinement |
| **Code** | `REFINE_RESPONSE` |
| **Description** | Improve a response based on feedback |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `refinement_focus` | string | "all" | Focus area: all, accuracy, clarity, completeness |
| `preserve_structure` | boolean | true | Maintain response structure |

**Inputs:** `response`, `feedback`
**Outputs:** `refined_response`

---

## Evaluation Methods

### CRITIQUE_RESPONSE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Critique |
| **Scientific Name** | Critical Evaluation |
| **Code** | `CRITIQUE_RESPONSE` |
| **Description** | Critically evaluate a response for flaws and improvements |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `focus_areas` | array | ["accuracy", "completeness", "clarity", "logic"] | Areas to evaluate |
| `severity_threshold` | string | "medium" | Minimum severity to report |

**Inputs:** `original_prompt`, `response`
**Outputs:** `critique`, `issues[]`, `suggestions[]`

---

### JUDGE_RESPONSES
| Attribute | Value |
|-----------|-------|
| **UI Name** | Judge |
| **Scientific Name** | Comparative Judgment |
| **Code** | `JUDGE_RESPONSES` |
| **Description** | Compare and judge multiple responses to select the best |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `evaluation_mode` | enum | "pairwise" | Mode: pointwise, pairwise, listwise |
| `criteria` | array | ["accuracy", "helpfulness", "clarity", "completeness"] | Evaluation criteria |

**Inputs:** `original_prompt`, `responses[]`
**Outputs:** `best_index`, `score`, `reasoning`

---

### POLL_JUDGE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Multi-Judge Panel |
| **Scientific Name** | Panel of LLMs Evaluation |
| **Code** | `POLL_JUDGE` |
| **Description** | Multiple diverse judge models evaluate outputs independently |
| **Research** | Panel of LLMs Evaluation Framework |
| **Accuracy** | Reduces single-model bias 40-60% |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `num_judges` | integer | 3 | Number of judge models |
| `scoring_criteria` | array | ["accuracy", "completeness", "clarity"] | Evaluation dimensions |
| `aggregation` | enum | "mean" | Aggregation: mean, median, weighted |

**Inputs:** `original_prompt`, `response`
**Outputs:** `scores[]`, `aggregate_score`, `per_judge_feedback[]`

---

### G_EVAL
| Attribute | Value |
|-----------|-------|
| **UI Name** | Structured Scoring |
| **Scientific Name** | G-Eval NLG Evaluation Framework |
| **Code** | `G_EVAL` |
| **Description** | Chain-of-thought scoring for NLG across coherence, consistency, fluency, relevance |
| **Research** | G-Eval: NLG Evaluation using GPT-4 |
| **Accuracy** | Correlates 0.5+ with human judgment |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dimensions` | array | ["coherence", "consistency", "fluency", "relevance"] | G-Eval dimensions |
| `use_cot` | boolean | true | Chain-of-thought scoring |
| `score_range` | array | [1, 5] | Score min/max |

**Inputs:** `source`, `generated`
**Outputs:** `dimension_scores{}`, `overall_score`, `reasoning`

---

### PAIRWISE_PREFER
| Attribute | Value |
|-----------|-------|
| **UI Name** | Head-to-Head Compare |
| **Scientific Name** | Pairwise Preference Judgment |
| **Code** | `PAIRWISE_PREFER` |
| **Description** | Compare two outputs head-to-head for reliable relative ranking |
| **Research** | Pairwise Preference Learning |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `comparison_criteria` | array | ["quality", "accuracy", "helpfulness"] | Comparison dimensions |
| `allow_tie` | boolean | true | Allow tie verdicts |

**Inputs:** `response_a`, `response_b`
**Outputs:** `verdict` (A/B/TIE), `key_differentiator`

---

### SELF_REFLECT
| Attribute | Value |
|-----------|-------|
| **UI Name** | Reflect |
| **Scientific Name** | Self-Reflection |
| **Code** | `SELF_REFLECT` |
| **Description** | AI reflects on its own response to identify improvements |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `reflection_depth` | string | "thorough" | Depth: quick, standard, thorough |
| `aspects` | array | ["accuracy", "completeness", "clarity"] | Aspects to reflect on |

**Inputs:** `original_prompt`, `response`
**Outputs:** `strengths[]`, `weaknesses[]`, `improvements[]`

---

### COMPARE_ANALYSIS
| Attribute | Value |
|-----------|-------|
| **UI Name** | Side-by-Side Compare |
| **Scientific Name** | Comparative Analysis |
| **Code** | `COMPARE_ANALYSIS` |
| **Description** | Structured comparison highlighting differences and trade-offs |
| **Accuracy** | Decision clarity +50% |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `comparison_dimensions` | array | ["pros", "cons", "use_cases"] | Dimensions to compare |
| `include_recommendation` | boolean | true | Include final recommendation |

**Inputs:** `options[]`
**Outputs:** `comparison_table`, `recommendation`, `reasoning`

---

## Synthesis Methods

### SYNTHESIZE_RESPONSES
| Attribute | Value |
|-----------|-------|
| **UI Name** | Synthesize |
| **Scientific Name** | Multi-Response Synthesis |
| **Code** | `SYNTHESIZE_RESPONSES` |
| **Description** | Combine best parts from multiple responses |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `combination_strategy` | string | "best_parts" | Strategy: best_parts, weighted, comprehensive |
| `conflict_resolution` | string | "majority" | Conflict handling: majority, note, first |

**Inputs:** `original_prompt`, `responses[]`
**Outputs:** `synthesized_response`

---

### BUILD_CONSENSUS
| Attribute | Value |
|-----------|-------|
| **UI Name** | Consensus |
| **Scientific Name** | Consensus Aggregation |
| **Code** | `BUILD_CONSENSUS` |
| **Description** | Identify points of agreement across multiple responses |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `consensus_threshold` | number | 0.7 | Agreement threshold (0-1) |
| `include_disputed` | boolean | true | Include disputed points |

**Inputs:** `responses[]`
**Outputs:** `consensus_points[]`, `disputed_points[]`, `unique_insights[]`

---

### MOA_LAYERS
| Attribute | Value |
|-----------|-------|
| **UI Name** | Layered Synthesis |
| **Scientific Name** | Mixture of Agents Multi-Layer |
| **Code** | `MOA_LAYERS` |
| **Description** | 3-4 layers of proposer agents feeding into aggregators |
| **Research** | Together AI - Mixture of Agents |
| **Accuracy** | +8% over GPT-4o on AlpacaEval |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `num_layers` | integer | 3 | Number of synthesis layers (2-5) |
| `proposers_per_layer` | integer | 3 | Proposers per layer |
| `aggregator_model` | string | "anthropic/claude-3-5-sonnet-20241022" | Model for aggregation |

**Inputs:** `prompt`
**Outputs:** `layer_outputs[]`, `final_response`

---

### MULTI_SOURCE_SYNTH
| Attribute | Value |
|-----------|-------|
| **UI Name** | Combine & Summarize |
| **Scientific Name** | Multi-Source Synthesis |
| **Code** | `MULTI_SOURCE_SYNTH` |
| **Description** | Combine insights from multiple model responses |
| **Accuracy** | Comprehensive coverage +40% |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `preserve_unique` | boolean | true | Preserve unique insights |
| `conflict_handling` | string | "note" | Conflict handling: note, resolve, ignore |
| `structure_output` | boolean | true | Structure the output |

**Inputs:** `responses[]`
**Outputs:** `synthesized_response`, `conflicts[]`

---

### LLM_BLENDER
| Attribute | Value |
|-----------|-------|
| **UI Name** | Rank & Merge Responses |
| **Scientific Name** | LLM-Blender Pairwise Ranking Fusion |
| **Code** | `LLM_BLENDER` |
| **Description** | PairRanker scores pairs, GenFusion merges top outputs |
| **Research** | ACL 2023 - LLM-Blender |
| **Accuracy** | +12% over best single model |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `num_responses` | integer | 5 | Responses to rank |
| `top_k_for_fusion` | integer | 3 | Top K to fuse |

**Inputs:** `prompt`, `responses[]`
**Outputs:** `rankings[]`, `fused_response`

---

### TOKEN_AUCTION
| Attribute | Value |
|-----------|-------|
| **UI Name** | Fair Multi-Stakeholder Merge |
| **Scientific Name** | Token Auction Mechanism |
| **Code** | `TOKEN_AUCTION` |
| **Description** | Token-by-token auction for fair multi-stakeholder output |
| **Research** | WWW 2024 Best Paper - Token Auction |
| **Complexity** | Expert |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `budget_per_agent` | integer | 100 | Token budget per agent |
| `auction_type` | string | "second_price" | Auction: second_price, first_price |
| `min_bid` | integer | 1 | Minimum bid value |

**Inputs:** `prompt`, `stakeholder_preferences[]`
**Outputs:** `merged_response`, `budget_usage[]`

---

## Verification Methods

### VERIFY_FACTS
| Attribute | Value |
|-----------|-------|
| **UI Name** | Fact Check |
| **Scientific Name** | Factual Verification |
| **Code** | `VERIFY_FACTS` |
| **Description** | Extract and verify factual claims in a response |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `extraction_method` | string | "explicit" | Method: explicit, implicit, all |
| `verification_depth` | string | "thorough" | Depth: quick, standard, thorough |

**Inputs:** `response`
**Outputs:** `claims[]`, `verifications[]`, `confidence_scores[]`

---

### PROCESS_REWARD
| Attribute | Value |
|-----------|-------|
| **UI Name** | Step Verification |
| **Scientific Name** | Process Reward Model Verification |
| **Code** | `PROCESS_REWARD` |
| **Description** | Verify each reasoning step independently |
| **Research** | OpenAI ICLR 2024 - Process Reward Models |
| **Accuracy** | +6% on MATH benchmark |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `verify_each_step` | boolean | true | Verify each step |
| `step_accuracy_threshold` | number | 0.7 | Accuracy threshold |
| `regenerate_on_failure` | boolean | true | Regenerate failed steps |

**Inputs:** `problem`, `reasoning_steps[]`
**Outputs:** `step_verdicts[]`, `overall_valid`, `failed_steps[]`

---

### SELFCHECK_GPT
| Attribute | Value |
|-----------|-------|
| **UI Name** | Internal Consistency |
| **Scientific Name** | SelfCheckGPT Verification Pipeline |
| **Code** | `SELFCHECK_GPT` |
| **Description** | Generate N samples, cross-reference for inconsistencies |
| **Research** | SelfCheckGPT - Zero-Resource Hallucination Detection |
| **Accuracy** | Hallucination F1 +25% |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sample_count` | integer | 5 | Consistency check samples |
| `consistency_threshold` | number | 0.7 | Consistency threshold |
| `check_method` | enum | "nli" | Method: nli, bertscore, exact |

**Inputs:** `claim`, `samples[]`
**Outputs:** `consistency_score`, `inconsistent_claims[]`

---

### CITE_VERIFY
| Attribute | Value |
|-----------|-------|
| **UI Name** | Source Attribution |
| **Scientific Name** | Citation Accuracy Verification |
| **Code** | `CITE_VERIFY` |
| **Description** | Trace claims to source passages, verify citations |
| **Accuracy** | Citation accuracy +40% |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `citation_match_threshold` | number | 0.8 | Match threshold |
| `verify_quotes` | boolean | true | Verify exact quotes |
| `check_context` | boolean | true | Check citation context |

**Inputs:** `response`, `sources[]`
**Outputs:** `citation_verdicts[]`, `fabricated_citations[]`

---

### NATURAL_LOGIC
| Attribute | Value |
|-----------|-------|
| **UI Name** | Logic-Based Fact Check |
| **Scientific Name** | Zero-Shot Natural Logic Verification |
| **Code** | `NATURAL_LOGIC` |
| **Description** | Use set-theoretic operators for logical consistency |
| **Research** | EMNLP 2024 - Zero-Shot Natural Logic |
| **Accuracy** | +8.96 accuracy points |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `operators` | array | ["subset", "superset", "negation", "equivalence"] | Logic operators |
| `require_proof` | boolean | true | Require formal proof |

**Inputs:** `premise`, `claim`
**Outputs:** `relation`, `valid`, `proof`

---

### UNIFACT
| Attribute | Value |
|-----------|-------|
| **UI Name** | Combined Verification |
| **Scientific Name** | UniFact Unified Verification |
| **Code** | `UNIFACT` |
| **Description** | Hybrid model-based and text-based verification |
| **Research** | UniFact 2024 |
| **Accuracy** | Comprehensive verification +20% |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `methods` | array | ["semantic", "textual", "logical"] | Verification methods |
| `combine_strategy` | string | "weighted" | Combination: weighted, majority, all |

**Inputs:** `claim`
**Outputs:** `method_verdicts{}`, `combined_verdict`

---

### EIGENSCORE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Internal State Check |
| **Scientific Name** | EigenScore Hidden State Analysis |
| **Code** | `EIGENSCORE` |
| **Description** | Analyze eigenvalue patterns in hidden states for uncertainty |
| **Research** | ICLR 2024 - EigenScore |
| **Complexity** | Expert |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `threshold` | number | 0.6 | Uncertainty threshold |
| `layer_indices` | array | [-1, -2, -3] | Layers to analyze |
| `aggregate` | string | "mean" | Aggregation: mean, max, min |

**Inputs:** `hidden_states`
**Outputs:** `uncertainty_score`, `layer_scores[]`

---

### REQUERY_CHECK
| Attribute | Value |
|-----------|-------|
| **UI Name** | Re-Query Consistency |
| **Scientific Name** | Iterative Prompting Consistency Check |
| **Code** | `REQUERY_CHECK` |
| **Description** | Black-box detection via paraphrased prompts |
| **Research** | DeepMind NeurIPS 2024 |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `num_rephrasings` | integer | 3 | Number of rephrasings |
| `consistency_threshold` | number | 0.8 | Consistency threshold |
| `rephrase_strategy` | string | "semantic" | Strategy: semantic, syntactic, mixed |

**Inputs:** `original_prompt`
**Outputs:** `responses[]`, `consistency_score`, `inconsistencies[]`

---

## Debate Methods

### GENERATE_CHALLENGE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Challenge |
| **Scientific Name** | Adversarial Challenge |
| **Code** | `GENERATE_CHALLENGE` |
| **Description** | Challenge a response by arguing the opposite position |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `challenge_intensity` | string | "moderate" | Intensity: mild, moderate, aggressive |
| `focus` | string | "weakest_points" | Focus: weakest_points, all, random |

**Inputs:** `original_prompt`, `response`
**Outputs:** `challenges[]`, `counter_arguments[]`

---

### DEFEND_POSITION
| Attribute | Value |
|-----------|-------|
| **UI Name** | Defend |
| **Scientific Name** | Position Defense |
| **Code** | `DEFEND_POSITION` |
| **Description** | Defend a response against challenges |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `defense_strategy` | string | "address_all" | Strategy: address_all, strongest_only, concede_weak |
| `concede_valid` | boolean | true | Concede valid challenges |

**Inputs:** `response`, `challenge`
**Outputs:** `defense`, `concessions[]`, `improved_response`

---

### SPARSE_DEBATE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Efficient Debate |
| **Scientific Name** | Sparse Communication Topology Debate |
| **Code** | `SPARSE_DEBATE` |
| **Description** | Agents connect in sparse patterns (ring, star, tree) to reduce communication cost |
| **Research** | Sparse Communication Networks for Multi-Agent Debate |
| **Accuracy** | -40-60% cost with <5% quality loss |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `topology` | enum | "ring" | Network: ring, star, tree, full |
| `debate_rounds` | integer | 3 | Number of debate rounds (1-10) |
| `temperature` | number | 0.7 | Agent response temperature |

**Inputs:** `prompt`
**Outputs:** `debate_history[]`, `final_position`, `consensus_reached`

---

### ARG_MAPPING
| Attribute | Value |
|-----------|-------|
| **UI Name** | Attack & Support Mapping |
| **Scientific Name** | ArgLLMs Quantitative Bipolar Argumentation |
| **Code** | `ARG_MAPPING` |
| **Description** | Build explicit attack/support relations between arguments with strength scores |
| **Research** | Imperial College London 2024 - ArgLLMs |
| **Accuracy** | Structured argumentation +35% |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `strength_threshold` | number | 0.5 | Min argument strength to include |
| `include_rebuttal` | boolean | true | Generate rebuttals |
| `max_depth` | integer | 3 | Max argument tree depth |

**Inputs:** `claim`
**Outputs:** `argument_graph`, `relations[]`, `strength_scores{}`

---

### HAH_DELPHI
| Attribute | Value |
|-----------|-------|
| **UI Name** | Human-AI Expert Panel |
| **Scientific Name** | HAH-Delphi Human-AI Hybrid Consensus |
| **Code** | `HAH_DELPHI` |
| **Description** | Four-tier Delphi consensus combining AI with human expert oversight |
| **Research** | HAH-Delphi Aug 2025 |
| **Accuracy** | >90% coverage on expert decisions |
| **Complexity** | Expert |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tiers` | integer | 4 | Number of consensus tiers |
| `human_threshold` | number | 0.6 | Escalate to human above this |
| `consensus_target` | number | 0.9 | Target consensus level |
| `max_rounds` | integer | 5 | Maximum Delphi rounds |

**Inputs:** `prompt`, `previous_consensus`
**Outputs:** `consensus`, `confidence`, `human_escalated`

---

### RECONCILE_WEIGHTED
| Attribute | Value |
|-----------|-------|
| **UI Name** | Confidence-Weighted Agreement |
| **Scientific Name** | ReConcile Confidence-Weighted Consensus |
| **Code** | `RECONCILE_WEIGHTED` |
| **Description** | Diverse LLMs weighted by verbalized confidence scores |
| **Research** | ACL 2024 - ReConcile |
| **Accuracy** | +15-25% on diverse model ensembles |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `min_confidence` | number | 0.6 | Minimum confidence to include |
| `weight_by` | string | "confidence" | Weighting strategy |
| `reconciliation_rounds` | integer | 2 | Reconciliation iterations |

**Inputs:** `prompt`
**Outputs:** `weighted_response`, `confidence_scores[]`, `disagreements[]`

---

## Aggregation Methods

### MAJORITY_VOTE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Vote |
| **Scientific Name** | Majority Aggregation |
| **Code** | `MAJORITY_VOTE` |
| **Description** | Select the most common answer from multiple responses |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `vote_method` | string | "exact_match" | Method: exact_match, semantic, fuzzy |
| `tie_breaker` | string | "first" | Tie breaker: first, random, longest |

**Inputs:** `responses[]`
**Outputs:** `winner`, `vote_counts{}`, `confidence`

---

### WEIGHTED_AGGREGATE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Weight |
| **Scientific Name** | Weighted Aggregation |
| **Code** | `WEIGHTED_AGGREGATE` |
| **Description** | Combine responses weighted by confidence/expertise |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `weight_by` | string | "confidence" | Weight source: confidence, expertise, accuracy |
| `normalize` | boolean | true | Normalize weights |

**Inputs:** `responses[]`, `weights[]`
**Outputs:** `aggregated_response`, `contribution_scores[]`

---

### SELF_CONSISTENCY
| Attribute | Value |
|-----------|-------|
| **UI Name** | Multi-Sample Voting |
| **Scientific Name** | Self-Consistency Decoding |
| **Code** | `SELF_CONSISTENCY` |
| **Description** | Generate 5-20 reasoning paths, majority vote on final answers |
| **Research** | Wang et al. 2022 - Self-Consistency |
| **Accuracy** | +17.9% on GSM8K |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sample_count` | integer | 5 | Number of reasoning paths (3-20) |
| `temperature` | number | 0.7 | Sampling temperature |
| `vote_method` | string | "majority" | Vote method: majority, weighted |
| `extract_answer` | boolean | true | Extract final answer |

**Inputs:** `prompt`
**Outputs:** `reasoning_paths[]`, `final_answer`, `confidence`

---

### GEDI_VOTE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Ranked Choice Voting |
| **Scientific Name** | GEDI Electoral Collective Decision Making |
| **Code** | `GEDI_VOTE` |
| **Description** | Ordinal preferential voting with 3+ agents |
| **Research** | EMNLP 2024 - GEDI Electoral CDM |
| **Accuracy** | Consensus +30% |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `num_agents` | integer | 3 | Number of voting agents |
| `ranking_depth` | integer | 3 | Rankings per agent |
| `elimination_rounds` | boolean | true | Use elimination rounds |

**Inputs:** `options[]`
**Outputs:** `winner`, `round_results[]`, `final_rankings[]`

---

## Reasoning Methods

### DECOMPOSE_PROBLEM
| Attribute | Value |
|-----------|-------|
| **UI Name** | Decompose |
| **Scientific Name** | Problem Decomposition |
| **Code** | `DECOMPOSE_PROBLEM` |
| **Description** | Break down a complex problem into sub-problems |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `max_subproblems` | integer | 5 | Maximum sub-problems |
| `decomposition_strategy` | string | "functional" | Strategy: functional, hierarchical, sequential |

**Inputs:** `prompt`
**Outputs:** `subproblems[]`, `dependencies[]`, `complexity_estimates[]`

---

### LOGIC_LM
| Attribute | Value |
|-----------|-------|
| **UI Name** | Translate to Logic & Solve |
| **Scientific Name** | Logic-LM Neuro-Symbolic Reasoning |
| **Code** | `LOGIC_LM` |
| **Description** | Convert to formal logic, solve externally, translate back |
| **Research** | EMNLP 2023 - Logic-LM |
| **Accuracy** | +39.2% over standard prompting |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `target_logic` | string | "prolog" | Target: prolog, z3, fol |
| `solver` | string | "swi-prolog" | External solver |
| `translate_back` | boolean | true | Translate result to natural language |

**Inputs:** `problem`
**Outputs:** `formal_representation`, `solver_output`, `natural_answer`

---

### LLM_MODULO
| Attribute | Value |
|-----------|-------|
| **UI Name** | Generate & Verify Loop |
| **Scientific Name** | LLM-Modulo Framework |
| **Code** | `LLM_MODULO` |
| **Description** | Generate candidates, validate with external critics, iterate |
| **Research** | ICML 2024 Spotlight - LLM-Modulo |
| **Accuracy** | 12%→93.9% plan success |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `max_iterations` | integer | 5 | Maximum iterations |
| `critics` | array | ["syntax", "semantic", "constraint"] | Critic types |
| `require_all_pass` | boolean | true | All critics must pass |

**Inputs:** `problem`
**Outputs:** `solution`, `iterations_used`, `critic_feedback[]`

---

## Routing Methods

### DETECT_TASK_TYPE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Classify |
| **Scientific Name** | Task Classification |
| **Code** | `DETECT_TASK_TYPE` |
| **Description** | Analyze prompt to determine task type and complexity |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `task_categories` | array | ["coding", "reasoning", "creative", "factual", "math", "research"] | Task categories |

**Inputs:** `prompt`
**Outputs:** `task_type`, `complexity`, `capabilities_required[]`

---

### SELECT_BEST_MODEL
| Attribute | Value |
|-----------|-------|
| **UI Name** | Route |
| **Scientific Name** | Model Selection |
| **Code** | `SELECT_BEST_MODEL` |
| **Description** | Choose the optimal model for a given task |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `consider_cost` | boolean | true | Factor in cost |
| `consider_latency` | boolean | true | Factor in latency |
| `quality_priority` | number | 0.7 | Quality weight (0-1) |

**Inputs:** `task_type`, `complexity`, `constraints`
**Outputs:** `selected_model`, `score`, `alternatives[]`

---

### ROUTELLM
| Attribute | Value |
|-----------|-------|
| **UI Name** | Smart Model Selection |
| **Scientific Name** | RouteLLM Adaptive Selection |
| **Code** | `ROUTELLM` |
| **Description** | Trained router predicts which model answers correctly |
| **Research** | LMSYS RouteLLM |
| **Accuracy** | -50% cost, <3% quality loss |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `router_model` | enum | "matrix_factorization" | Router: matrix_factorization, bert, causal_lm |
| `cost_threshold` | number | 0.7 | Max cost relative to baseline |
| `quality_floor` | number | 0.8 | Minimum acceptable quality |

**Inputs:** `prompt`
**Outputs:** `selected_model`, `confidence`, `routing_reason`

---

### FRUGAL_CASCADE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Progressive Escalation |
| **Scientific Name** | FrugalGPT Cascading Selection |
| **Code** | `FRUGAL_CASCADE` |
| **Description** | Try cheap models first, escalate on low confidence |
| **Research** | FrugalGPT 2023 |
| **Accuracy** | -90% cost, maintained quality |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model_cascade` | array | ["gpt-4o-mini", "gpt-4o", "o1"] | Models in escalation order |
| `confidence_threshold` | number | 0.85 | Escalate below this confidence |
| `max_escalations` | integer | 2 | Maximum escalation steps |

**Inputs:** `prompt`
**Outputs:** `response`, `model_used`, `escalations_used`

---

### PARETO_ROUTE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Budget-Aware Routing |
| **Scientific Name** | Cost-Quality Pareto Routing |
| **Code** | `PARETO_ROUTE` |
| **Description** | Route on Pareto-optimal cost/quality trade-off |
| **Research** | Pareto-Optimal Model Selection |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `budget_cents` | number | 10 | Budget constraint per query |
| `quality_weight` | number | 0.7 | Weight for quality (0-1) |
| `latency_weight` | number | 0.1 | Weight for latency (0-1) |

**Inputs:** `prompt`, `budget`
**Outputs:** `selected_model`, `expected_quality`, `expected_cost`

---

### C3PO_CASCADE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Smart Cost Escalation |
| **Scientific Name** | C3PO Self-Supervised Cascade |
| **Code** | `C3PO_CASCADE` |
| **Description** | Self-supervised cascade learning query difficulty |
| **Research** | NeurIPS 2024 - C3PO |
| **Accuracy** | -40% cost, +2% quality |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cascade_levels` | integer | 3 | Number of model tiers |
| `self_supervised` | boolean | true | Enable self-supervised learning |
| `calibration_samples` | integer | 100 | Samples for difficulty calibration |

**Inputs:** `prompt`
**Outputs:** `response`, `difficulty_score`, `tier_used`

---

### AUTOMIX
| Attribute | Value |
|-----------|-------|
| **UI Name** | Self-Routing Selection |
| **Scientific Name** | AutoMix POMDP Routing |
| **Code** | `AUTOMIX` |
| **Description** | POMDP-based self-routing by task difficulty |
| **Research** | Nov 2025 - AutoMix |
| **Complexity** | Expert |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pomdp_horizon` | integer | 3 | POMDP planning horizon |
| `exploration_rate` | number | 0.1 | ε for ε-greedy exploration |
| `self_verification` | boolean | true | Verify own outputs |

**Inputs:** `prompt`
**Outputs:** `response`, `belief_state`, `action_taken`

---

### AFLOW_MCTS
| Attribute | Value |
|-----------|-------|
| **UI Name** | Auto-Discover Best Workflow |
| **Scientific Name** | AFlow MCTS Workflow Discovery |
| **Code** | `AFLOW_MCTS` |
| **Description** | MCTS to discover optimal workflow compositions |
| **Research** | ICLR 2025 - AFlow |
| **Complexity** | Expert |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search_iterations` | integer | 100 | MCTS iterations |
| `exploration_weight` | number | 1.414 | UCB exploration constant |
| `max_depth` | integer | 5 | Max workflow depth |

**Inputs:** `task_description`
**Outputs:** `discovered_workflow`, `expected_performance`, `search_tree`

---

## Uncertainty Methods

### SEMANTIC_ENTROPY
| Attribute | Value |
|-----------|-------|
| **UI Name** | Meaning-Based Uncertainty |
| **Scientific Name** | Semantic Entropy Quantification |
| **Code** | `SEMANTIC_ENTROPY` |
| **Description** | Cluster semantically equivalent answers, compute entropy over meaning clusters |
| **Research** | Nature 2024 - Semantic Uncertainty in LLMs |
| **Accuracy** | AUROC 0.79-0.87 hallucination detection |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sample_count` | integer | 10 | Number of response samples (5-20) |
| `temperature` | number | 0.7 | Sampling temperature |
| `clustering_method` | enum | "nli" | Clustering: nli, embedding, exact |
| `entropy_threshold` | number | 0.5 | Flag uncertainty above this |

**Inputs:** `prompt`
**Outputs:** `entropy_score`, `clusters[]`, `uncertainty_flag`

---

### SE_PROBES
| Attribute | Value |
|-----------|-------|
| **UI Name** | Fast Uncertainty Check |
| **Scientific Name** | Semantic Entropy Probes |
| **Code** | `SE_PROBES` |
| **Description** | Lightweight probes on hidden states for fast entropy estimation (logprob-based) |
| **Research** | ICML 2024 - Semantic Entropy Probes |
| **Accuracy** | 300x faster, 90% accuracy |
| **Complexity** | Expert |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `probe_layers` | array | [-1, -2] | Model layers to probe (logprob-based) |
| `threshold` | number | 0.5 | Uncertainty threshold |
| `fast_mode` | boolean | true | Use fast logprob estimation |
| `sample_count` | integer | 5 | Number of samples for averaging |

**Inputs:** `prompt`
**Outputs:** `entropy_estimate`, `layer_entropies[]`, `uncertainty_flag`

---

### KERNEL_ENTROPY
| Attribute | Value |
|-----------|-------|
| **UI Name** | Detailed Uncertainty Score |
| **Scientific Name** | Kernel Language Entropy |
| **Code** | `KERNEL_ENTROPY` |
| **Description** | Continuous entropy via kernel density estimation on embeddings |
| **Research** | NeurIPS 2024 - Kernel Language Entropy |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `kernel` | enum | "rbf" | Kernel: rbf, linear, polynomial |
| `bandwidth` | string | "auto" | Bandwidth or "auto" for Silverman |
| `sample_count` | integer | 10 | Response samples for KDE |

**Inputs:** `prompt`
**Outputs:** `kde_entropy`, `density_estimate`, `bandwidth_used`

---

### CALIBRATED_CONF
| Attribute | Value |
|-----------|-------|
| **UI Name** | Calibrated Confidence |
| **Scientific Name** | Calibrated Confidence Estimation |
| **Code** | `CALIBRATED_CONF` |
| **Description** | Elicit confidence via prompting and calibrate against accuracy |
| **Research** | Calibrated Confidence Estimation Research |
| **Accuracy** | ECE -15% |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `calibration_method` | enum | "platt_scaling" | Method: platt_scaling, isotonic, temperature_scaling |
| `confidence_prompt` | string | "verbalized" | How to elicit confidence |
| `temperature` | number | 0.3 | Sampling temperature |

**Inputs:** `prompt`
**Outputs:** `response`, `raw_confidence`, `calibrated_confidence`

---

### CONSISTENCY_UQ
| Attribute | Value |
|-----------|-------|
| **UI Name** | Agreement Scoring |
| **Scientific Name** | Consistency-Based Uncertainty Quantification |
| **Code** | `CONSISTENCY_UQ` |
| **Description** | Measure agreement across samples as uncertainty proxy |
| **Research** | Consistency-Based UQ Research |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sample_count` | integer | 5 | Number of response samples |
| `agreement_metric` | enum | "jaccard" | Metric: jaccard, cosine, exact_match, bertscore |
| `threshold` | number | 0.7 | Agreement threshold |

**Inputs:** `prompt`
**Outputs:** `agreement_score`, `responses[]`, `uncertainty_flag`

---

### CONFORMAL_PRED
| Attribute | Value |
|-----------|-------|
| **UI Name** | Guaranteed Accuracy Bounds |
| **Scientific Name** | Enhanced Conformal Prediction |
| **Code** | `CONFORMAL_PRED` |
| **Description** | Prediction sets with statistical guarantees on coverage |
| **Research** | NeurIPS 2024 - Conformal Prediction for LLMs |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `coverage_target` | number | 0.9 | Target coverage (0.5-0.99) |
| `calibration_size` | integer | 500 | Calibration set size |
| `adaptive` | boolean | true | Use adaptive conformal sets |

**Inputs:** `prompt`
**Outputs:** `prediction_set[]`, `coverage_guarantee`, `set_size`

---

## Hallucination Detection Methods

### MULTI_HALLUC
| Attribute | Value |
|-----------|-------|
| **UI Name** | Fact-Check Scanner |
| **Scientific Name** | Multi-Method Hallucination Detection |
| **Code** | `MULTI_HALLUC` |
| **Description** | Ensemble detection: consistency, attribution, semantic entropy |
| **Research** | Multi-Method Hallucination Detection 2025 |
| **Accuracy** | F1 0.85+ |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `methods` | array | ["consistency", "attribution", "semantic_entropy"] | Detection methods |
| `aggregation` | enum | "weighted" | Aggregation: weighted, majority, any |
| `flag_threshold` | number | 0.6 | Flag as hallucination above this |

**Inputs:** `response`
**Outputs:** `hallucination_score`, `method_scores{}`, `flagged_claims[]`

---

### METAQA
| Attribute | Value |
|-----------|-------|
| **UI Name** | Mutation Testing |
| **Scientific Name** | MetaQA Metamorphic Testing |
| **Code** | `METAQA` |
| **Description** | Test consistency via semantically equivalent transformations |
| **Research** | MetaQA Metamorphic Testing 2025 |
| **Accuracy** | Subtle inconsistencies +30% |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `transformations` | array | ["paraphrase", "negation", "entity_swap"] | Mutation types |
| `num_mutations` | integer | 3 | Mutations per claim |
| `consistency_threshold` | number | 0.8 | Consistency threshold |

**Inputs:** `original_prompt`
**Outputs:** `mutations[]`, `responses[]`, `inconsistencies[]`

---

### FACTUAL_GROUND
| Attribute | Value |
|-----------|-------|
| **UI Name** | Source Verification |
| **Scientific Name** | Factual Grounding Verification |
| **Code** | `FACTUAL_GROUND` |
| **Description** | Verify claims against retrieved documents with evidence mapping |
| **Research** | Factual Grounding Research 2025 |
| **Accuracy** | Grounding accuracy +45% |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `retrieval_top_k` | integer | 5 | Documents to retrieve |
| `evidence_threshold` | number | 0.7 | Evidence support threshold |
| `require_explicit_support` | boolean | true | Require explicit evidence |

**Inputs:** `claim`, `documents[]`
**Outputs:** `verdict`, `evidence_mapping[]`, `ungrounded_claims[]`

---

## Human-in-the-Loop Methods

### HITL_REVIEW
| Attribute | Value |
|-----------|-------|
| **UI Name** | Human Review Queue |
| **Scientific Name** | Human-in-the-Loop Review System |
| **Code** | `HITL_REVIEW` |
| **Description** | Route low-confidence or high-stakes outputs to human review |
| **Research** | Human-in-the-Loop ML Systems |
| **Accuracy** | Critical error prevention +90% |
| **Complexity** | Simple |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `confidence_threshold` | number | 0.7 | Route to human below this |
| `stake_level` | enum | "medium" | Stake: low, medium, high, critical |
| `auto_approve_above` | number | 0.95 | Auto-approve above this confidence |
| `queue_priority` | enum | "fifo" | Queue ordering: fifo, priority, lifo |

**Inputs:** `response`, `confidence`, `context`
**Outputs:** `queued`, `queue_position`, `estimated_wait`

---

### TIERED_EVAL
| Attribute | Value |
|-----------|-------|
| **UI Name** | Multi-Level Review |
| **Scientific Name** | Tiered Evaluation Architecture |
| **Code** | `TIERED_EVAL` |
| **Description** | Multi-tier: AI auto → AI flag → human → expert |
| **Research** | Tiered Evaluation Architecture |
| **Complexity** | Moderate |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tiers` | array | ["auto", "ai_flag", "human", "expert"] | Evaluation tiers |
| `escalation_criteria` | string | "confidence" | Escalation trigger |
| `sla_hours` | integer | 24 | SLA for human review |

**Inputs:** `response`, `context`
**Outputs:** `tier_used`, `approvals[]`, `final_decision`

---

### ACTIVE_SAMPLE
| Attribute | Value |
|-----------|-------|
| **UI Name** | Smart Sampling |
| **Scientific Name** | Active Learning Sample Selection |
| **Code** | `ACTIVE_SAMPLE` |
| **Description** | Select most informative samples for human labeling |
| **Research** | Active Learning for NLP |
| **Accuracy** | Labeling efficiency +60% |
| **Complexity** | Advanced |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `selection_strategy` | enum | "uncertainty" | Strategy: uncertainty, diversity, hybrid |
| `batch_size` | integer | 10 | Samples per batch |
| `diversity_weight` | number | 0.3 | Diversity in selection |

**Inputs:** `candidate_pool[]`
**Outputs:** `selected_samples[]`, `selection_reasons[]`

---

## Collaboration Methods

### ECON_NASH
| Attribute | Value |
|-----------|-------|
| **UI Name** | No-Communication Coordination |
| **Scientific Name** | ECON Bayesian Nash Equilibrium |
| **Code** | `ECON_NASH` |
| **Description** | Agents coordinate without message exchange using game theory |
| **Research** | ICML 2025 - ECON |
| **Accuracy** | +11.2% coordination, -21.4% resources |
| **Complexity** | Expert |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `num_agents` | integer | 3 | Number of agents |
| `equilibrium_type` | string | "bayesian_nash" | Equilibrium type |
| `utility_function` | string | "cooperative" | Utility: cooperative, competitive |

**Inputs:** `prompt`
**Outputs:** `coordinated_response`, `equilibrium_reached`, `agent_strategies[]`

---

## Neural Methods

### CATO_NEURAL
| Attribute | Value |
|-----------|-------|
| **UI Name** | Neural Decision |
| **Scientific Name** | Cato Neural Decision Engine |
| **Code** | `CATO_NEURAL` |
| **Description** | Integrates Cato safety pipeline with consciousness affect state and predictive coding for neural-informed decisions. Uses Control Barrier Functions for safety, affect-to-hyperparameter mapping for dynamic behavior, and active inference for uncertainty handling. |
| **Research** | RADIANT Cato Safety Architecture + Active Inference |
| **Complexity** | Expert |

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `safety_mode` | enum | "enforce" | CBF mode: enforce, warn, monitor |
| `use_affect_mapping` | boolean | true | Map affect to hyperparameters |
| `use_predictive_coding` | boolean | true | Enable active inference |
| `precision_governor_enabled` | boolean | true | Limit confidence by epistemic state |
| `cbf_threshold` | number | 0.95 | Safety barrier threshold (0.8-1.0) |
| `affect_influence.frustration_temperature_scale` | number | 0.2 | Temperature reduction when frustrated |
| `affect_influence.curiosity_exploration_boost` | number | 0.3 | Exploration increase when curious |
| `affect_influence.low_efficacy_escalation` | boolean | true | Escalate on low self-efficacy |
| `prediction_config.generate_predictions` | boolean | true | Generate predictions |
| `prediction_config.track_surprise` | boolean | true | Track surprise |
| `prediction_config.learning_threshold` | number | 0.5 | Surprise threshold for learning |
| `escalation_config.auto_escalate_on_uncertainty` | boolean | true | Auto-escalate on uncertainty |
| `escalation_config.uncertainty_threshold` | number | 0.7 | Uncertainty threshold |
| `escalation_config.human_escalation_enabled` | boolean | true | Enable human escalation |

**Inputs:** `prompt`, `context`, `affect_state`
**Outputs:** `response`, `safety_verdict`, `hyperparameters_used`, `predictions[]`

---

# System Workflows

All 49 system workflows are protected—admins can only modify configuration and enabled status, not workflow definitions.

---

## Adversarial & Validation

### ARE - Red Team Attack
| Attribute | Value |
|-----------|-------|
| **UI Name** | Red Team Attack |
| **Scientific Name** | Adversarial Robustness Evaluation |
| **Code** | `ARE` |
| **Category** | Adversarial & Validation |
| **Description** | One AI probes another for vulnerabilities, safety failures, and edge cases |
| **Quality Improvement** | Identifies 80-95% of vulnerabilities |
| **Latency** | High |
| **Cost** | High |
| **Min Models** | 2 |

**Best For:** `security_testing`, `safety_validation`, `edge_case_discovery`, `robustness_testing`
**Problem Indicators:** `safety_critical`, `needs_validation`, `security_concern`, `untrusted_input`

---

### LM_VS_LM - Cross-Examination
| Attribute | Value |
|-----------|-------|
| **UI Name** | Cross-Examination |
| **Scientific Name** | LM vs LM Factual Verification |
| **Code** | `LM_VS_LM` |
| **Category** | Adversarial & Validation |
| **Description** | Interrogator AI repeatedly questions responder AI's claims to expose inconsistencies and hallucinations |
| **Quality Improvement** | Reduces hallucinations by 40-60% |
| **Latency** | High |
| **Cost** | High |
| **Min Models** | 2 |

**Best For:** `fact_checking`, `claim_verification`, `hallucination_detection`, `interview_simulation`
**Problem Indicators:** `factual_claims`, `needs_verification`, `potential_hallucination`, `complex_reasoning`

---

## Debate & Deliberation

### SOD - AI Debate
| Attribute | Value |
|-----------|-------|
| **UI Name** | AI Debate |
| **Scientific Name** | Scalable Oversight via Debate |
| **Code** | `SOD` |
| **Category** | Debate & Deliberation |
| **Description** | Two AIs argue opposing positions to convince a judge; truthful arguments should win |
| **Quality Improvement** | Improves decision quality by 25-35% |
| **Latency** | Very High |
| **Cost** | Very High |
| **Min Models** | 3 |

**Best For:** `controversial_topics`, `decision_making`, `policy_analysis`, `ethical_dilemmas`
**Problem Indicators:** `multiple_viewpoints`, `controversial`, `needs_balanced_view`, `complex_decision`

---

### MDA - Multi-Agent Debate
| Attribute | Value |
|-----------|-------|
| **UI Name** | Multi-Agent Debate |
| **Scientific Name** | Multiagent Deliberative Alignment |
| **Code** | `MDA` |
| **Category** | Debate & Deliberation |
| **Description** | Multiple LLM instances propose, critique, and refine until consensus |
| **Quality Improvement** | Consensus quality +30-45% |
| **Latency** | Very High |
| **Cost** | Very High |
| **Min Models** | 3 |

**Best For:** `complex_problems`, `consensus_building`, `brainstorming`, `research_synthesis`
**Problem Indicators:** `needs_consensus`, `multiple_approaches`, `collaborative_task`, `complex_problem`

---

### ReConcile - Round Table Consensus
| Attribute | Value |
|-----------|-------|
| **UI Name** | Round Table Consensus |
| **Scientific Name** | Reconciled Ensemble Deliberation |
| **Code** | `ReConcile` |
| **Category** | Debate & Deliberation |
| **Description** | Heterogeneous models from different providers reconcile viewpoints iteratively |
| **Quality Improvement** | Reduces provider bias by 50-70% |
| **Latency** | Very High |
| **Cost** | High |
| **Min Models** | 3 |

**Best For:** `cross_provider_synthesis`, `bias_reduction`, `comprehensive_analysis`, `balanced_output`
**Problem Indicators:** `provider_bias_concern`, `needs_diversity`, `comprehensive_coverage`, `balanced_perspective`

---

## Judge & Critic

### LAAJE - AI Judge
| Attribute | Value |
|-----------|-------|
| **UI Name** | AI Judge |
| **Scientific Name** | LLM-as-a-Judge Evaluation |
| **Code** | `LAAJE` |
| **Category** | Judge & Critic |
| **Description** | Designated AI evaluates outputs using pointwise, pairwise, or listwise modes |
| **Quality Improvement** | Evaluation accuracy 85-95% |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 2 |

**Best For:** `quality_evaluation`, `comparison`, `ranking`, `selection`
**Problem Indicators:** `multiple_options`, `needs_ranking`, `quality_assessment`, `best_selection`

---

### RLAIF - Constitutional Critic
| Attribute | Value |
|-----------|-------|
| **UI Name** | Constitutional Critic |
| **Scientific Name** | Reinforcement Learning from AI Feedback |
| **Code** | `RLAIF` |
| **Category** | Judge & Critic |
| **Description** | AI critiques/revises against explicit principles; Constitutional AI pattern |
| **Quality Improvement** | Alignment improvement 60-80% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 2 |

**Best For:** `safety_alignment`, `policy_compliance`, `ethical_review`, `guideline_adherence`
**Problem Indicators:** `needs_alignment`, `policy_check`, `ethical_concern`, `compliance_required`

---

### IREF - Critique-Revise Loop
| Attribute | Value |
|-----------|-------|
| **UI Name** | Critique-Revise Loop |
| **Scientific Name** | Iterative Refinement with External Feedback |
| **Code** | `IREF` |
| **Category** | Judge & Critic |
| **Description** | Generator → Critic identifies flaws → Generator revises; repeats until quality threshold |
| **Quality Improvement** | Quality improvement per iteration: 15-25% |
| **Latency** | High |
| **Cost** | High |
| **Min Models** | 2 |

**Best For:** `iterative_improvement`, `quality_refinement`, `error_correction`, `polish`
**Problem Indicators:** `needs_refinement`, `quality_critical`, `iterative_task`, `perfectionist`

---

## Ensemble & Aggregation

### SCMR - Majority Vote
| Attribute | Value |
|-----------|-------|
| **UI Name** | Majority Vote |
| **Scientific Name** | Self-Consistency via Marginal Reasoning |
| **Code** | `SCMR` |
| **Category** | Ensemble & Aggregation |
| **Description** | Same prompt to N instances, select most common answer |
| **Quality Improvement** | +15-25% accuracy on factual tasks |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 3 |

**Best For:** `factual_questions`, `multiple_choice`, `classification`, `simple_reasoning`
**Problem Indicators:** `objective_answer`, `clear_correct_answer`, `factual_query`, `classification_task`

---

### CWMA - Weighted Ensemble
| Attribute | Value |
|-----------|-------|
| **UI Name** | Weighted Ensemble |
| **Scientific Name** | Confidence-Weighted Model Aggregation |
| **Code** | `CWMA` |
| **Category** | Ensemble & Aggregation |
| **Description** | Weight model contributions by confidence, accuracy, or domain expertise |
| **Quality Improvement** | +20-35% over simple averaging |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 3 |

**Best For:** `domain_expertise`, `confidence_critical`, `weighted_synthesis`, `expert_combination`
**Problem Indicators:** `domain_specific`, `expertise_required`, `confidence_matters`, `specialized_knowledge`

---

### SMoE - Mixture Router
| Attribute | Value |
|-----------|-------|
| **UI Name** | Mixture Router |
| **Scientific Name** | Sparse Mixture-of-Experts Routing |
| **Code** | `SMoE` |
| **Category** | Ensemble & Aggregation |
| **Description** | Lightweight router selects specialist AI(s) per input |
| **Quality Improvement** | Cost reduction 40-60% with same quality |
| **Latency** | Low |
| **Cost** | Low |
| **Min Models** | 2 |

**Best For:** `routing`, `specialization`, `efficiency`, `domain_detection`
**Problem Indicators:** `unknown_domain`, `needs_specialist`, `efficiency_critical`, `variable_task_type`

---

## Reflection & Self-Improvement

### ISFR - Self-Refine Loop
| Attribute | Value |
|-----------|-------|
| **UI Name** | Self-Refine Loop |
| **Scientific Name** | Iterative Self-Feedback Refinement |
| **Code** | `ISFR` |
| **Category** | Reflection & Self-Improvement |
| **Description** | AI generates → self-critiques → refines until satisfactory |
| **Quality Improvement** | +20-30% quality per iteration |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `writing`, `code_improvement`, `iterative_tasks`, `quality_improvement`
**Problem Indicators:** `needs_polish`, `iterative_improvement`, `quality_critical`, `refinement_needed`

---

### VRL - Reflexion Agent
| Attribute | Value |
|-----------|-------|
| **UI Name** | Reflexion Agent |
| **Scientific Name** | Verbal Reinforcement Learning |
| **Code** | `VRL` |
| **Category** | Reflection & Self-Improvement |
| **Description** | Agent reflects on failures, stores insights in episodic memory, improves without gradients |
| **Quality Improvement** | +30-50% on repeated tasks |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `agentic_tasks`, `learning_from_failure`, `adaptive_behavior`, `long_term_improvement`
**Problem Indicators:** `repeated_task`, `learning_opportunity`, `failure_recovery`, `adaptive_needed`

---

### LATS - Tree Search Reasoning
| Attribute | Value |
|-----------|-------|
| **UI Name** | Tree Search Reasoning |
| **Scientific Name** | Language Agent Tree Search |
| **Code** | `LATS` |
| **Category** | Reflection & Self-Improvement |
| **Description** | Monte-Carlo tree search exploring reasoning paths with backpropagation |
| **Quality Improvement** | 4%→74% on puzzle tasks |
| **Latency** | Very High |
| **Cost** | Very High |
| **Min Models** | 1 |

**Best For:** `complex_reasoning`, `planning`, `search_problems`, `optimization`
**Problem Indicators:** `search_problem`, `multiple_paths`, `optimization`, `complex_planning`

---

## Verification & Fact-Checking

### CoVe - Chain of Verification
| Attribute | Value |
|-----------|-------|
| **UI Name** | Chain of Verification |
| **Scientific Name** | Stepwise Verification Prompting |
| **Code** | `CoVe` |
| **Category** | Verification & Fact-Checking |
| **Description** | Draft → generate verification questions → answer independently → verified output |
| **Quality Improvement** | Reduces factual errors by 30-50% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `fact_checking`, `claim_verification`, `accuracy_critical`, `research`
**Problem Indicators:** `factual_claims`, `needs_verification`, `accuracy_critical`, `research_output`

---

### SelfRAG - Retrieval-Augmented Verification
| Attribute | Value |
|-----------|-------|
| **UI Name** | Retrieval-Augmented Verification |
| **Scientific Name** | Self-Reflective RAG |
| **Code** | `SelfRAG` |
| **Category** | Verification & Fact-Checking |
| **Description** | AI self-critiques, fetches documents if needed, validates against evidence |
| **Quality Improvement** | Factual accuracy +40-60% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `research`, `fact_checking`, `document_based`, `evidence_required`
**Problem Indicators:** `needs_sources`, `research_task`, `evidence_based`, `document_analysis`

---

## Multi-Agent Collaboration

### LLM_MAS - Agent Team
| Attribute | Value |
|-----------|-------|
| **UI Name** | Agent Team |
| **Scientific Name** | LLM-based Multi-Agent Systems |
| **Code** | `LLM_MAS` |
| **Category** | Multi-Agent Collaboration |
| **Description** | Specialized agents with distinct roles collaborate via natural language |
| **Quality Improvement** | Complex task completion +40-60% |
| **Latency** | Very High |
| **Cost** | High |
| **Min Models** | 3 |

**Best For:** `complex_projects`, `multi_skill`, `collaborative`, `project_management`
**Problem Indicators:** `multi_disciplinary`, `complex_project`, `needs_coordination`, `diverse_skills`

---

### MAPR - Peer Review Pipeline
| Attribute | Value |
|-----------|-------|
| **UI Name** | Peer Review Pipeline |
| **Scientific Name** | Multi-Agent Peer Review |
| **Code** | `MAPR` |
| **Category** | Multi-Agent Collaboration |
| **Description** | Sequential review chain where each agent reviews prior agent's work |
| **Quality Improvement** | Error reduction 50-70% |
| **Latency** | High |
| **Cost** | High |
| **Min Models** | 3 |

**Best For:** `document_review`, `quality_assurance`, `sequential_improvement`, `editorial`
**Problem Indicators:** `needs_review`, `quality_critical`, `sequential_task`, `editorial_process`

---

## Reasoning Enhancement

### CoT - Chain-of-Thought
| Attribute | Value |
|-----------|-------|
| **UI Name** | Chain-of-Thought |
| **Scientific Name** | CoT Prompting |
| **Code** | `CoT` |
| **Category** | Reasoning Enhancement |
| **Description** | Step-by-step reasoning before final answer |
| **Quality Improvement** | +20-40% on math/logic |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `math`, `logic`, `reasoning`, `problem_solving`
**Problem Indicators:** `requires_reasoning`, `multi_step`, `logical_problem`, `math_problem`

---

### ZeroShotCoT - Zero-Shot CoT
| Attribute | Value |
|-----------|-------|
| **UI Name** | Zero-Shot CoT |
| **Scientific Name** | "Let's think step by step" |
| **Code** | `ZeroShotCoT` |
| **Category** | Reasoning Enhancement |
| **Description** | Add "Let's think step by step" to prompt without examples |
| **Quality Improvement** | +15-30% without examples |
| **Latency** | Low |
| **Cost** | Low |
| **Min Models** | 1 |

**Best For:** `general_reasoning`, `quick_improvement`, `no_examples_available`
**Problem Indicators:** `reasoning_needed`, `no_examples`, `general_question`

---

### ToT - Tree-of-Thoughts
| Attribute | Value |
|-----------|-------|
| **UI Name** | Tree-of-Thoughts |
| **Scientific Name** | ToT with BFS/DFS |
| **Code** | `ToT` |
| **Category** | Reasoning Enhancement |
| **Description** | Explore multiple reasoning paths with breadth/depth-first search |
| **Quality Improvement** | 4%→74% on puzzles |
| **Latency** | Very High |
| **Cost** | Very High |
| **Min Models** | 1 |

**Best For:** `puzzles`, `creative_writing`, `planning`, `exploration`
**Problem Indicators:** `multiple_solutions`, `creative_task`, `exploration_needed`, `puzzle`

---

### GoT - Graph-of-Thoughts
| Attribute | Value |
|-----------|-------|
| **UI Name** | Graph-of-Thoughts |
| **Scientific Name** | GoT Synthesis |
| **Code** | `GoT` |
| **Category** | Reasoning Enhancement |
| **Description** | Thought units as graph nodes with arbitrary connections |
| **Quality Improvement** | +62% over ToT on sorting |
| **Latency** | Very High |
| **Cost** | Very High |
| **Min Models** | 1 |

**Best For:** `complex_synthesis`, `interconnected_reasoning`, `sorting`, `complex_logic`
**Problem Indicators:** `complex_relationships`, `synthesis_needed`, `interconnected_concepts`

---

### ReAct - Reasoning + Acting
| Attribute | Value |
|-----------|-------|
| **UI Name** | ReAct |
| **Scientific Name** | Reasoning + Acting |
| **Code** | `ReAct` |
| **Category** | Reasoning Enhancement |
| **Description** | Interleave reasoning and acting with external tools |
| **Quality Improvement** | +34% on interactive tasks |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `tool_use`, `interactive_tasks`, `research`, `agentic`
**Problem Indicators:** `needs_tools`, `interactive`, `external_data`, `agentic_task`

---

### L2M - Least-to-Most
| Attribute | Value |
|-----------|-------|
| **UI Name** | Least-to-Most |
| **Scientific Name** | Decomposition Prompting |
| **Code** | `L2M` |
| **Category** | Reasoning Enhancement |
| **Description** | Decompose problem into subproblems, solve smallest first |
| **Quality Improvement** | 16%→99% on SCAN |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `compositional`, `hierarchical`, `step_building`
**Problem Indicators:** `compositional_task`, `can_decompose`, `builds_on_previous`

---

### PS - Plan-and-Solve
| Attribute | Value |
|-----------|-------|
| **UI Name** | Plan-and-Solve |
| **Scientific Name** | Explicit Planning |
| **Code** | `PS` |
| **Category** | Reasoning Enhancement |
| **Description** | Devise plan then execute step by step |
| **Quality Improvement** | Matches 8-shot CoT |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `complex_tasks`, `planning`, `structured_problems`
**Problem Indicators:** `needs_planning`, `complex_execution`, `structured_approach`

---

### MCP - Metacognitive Prompting
| Attribute | Value |
|-----------|-------|
| **UI Name** | Metacognitive Prompting |
| **Scientific Name** | 5-stage reflection |
| **Code** | `MCP` |
| **Category** | Reasoning Enhancement |
| **Description** | Understand, decompose, execute, self-verify, refine |
| **Quality Improvement** | Beats CoT on NLU |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `nlu`, `comprehension`, `thorough_analysis`
**Problem Indicators:** `comprehension_critical`, `needs_verification`, `thorough_needed`

---

### PoT - Program-of-Thought
| Attribute | Value |
|-----------|-------|
| **UI Name** | Program-of-Thought |
| **Scientific Name** | Code-based Reasoning |
| **Code** | `PoT` |
| **Category** | Reasoning Enhancement |
| **Description** | Generate code to solve math problems |
| **Quality Improvement** | For mathematical computation |
| **Latency** | Medium |
| **Cost** | Low |
| **Min Models** | 1 |

**Best For:** `math`, `computation`, `algorithmic`
**Problem Indicators:** `mathematical`, `needs_computation`, `algorithmic_solution`

---

## Model Routing Strategies

### SINGLE - Single Model
| Attribute | Value |
|-----------|-------|
| **UI Name** | Single Model |
| **Scientific Name** | Primary model only |
| **Code** | `SINGLE` |
| **Category** | Model Routing Strategies |
| **Description** | Route to single best model for fastest response |
| **Quality Improvement** | Fastest, lowest cost |
| **Latency** | Low |
| **Cost** | Low |
| **Min Models** | 1 |

**Best For:** `simple_tasks`, `speed_critical`, `cost_sensitive`
**Problem Indicators:** `simple_task`, `speed_priority`, `cost_priority`

---

### ENSEMBLE - Ensemble
| Attribute | Value |
|-----------|-------|
| **UI Name** | Ensemble |
| **Scientific Name** | Query multiple, synthesize |
| **Code** | `ENSEMBLE` |
| **Category** | Model Routing Strategies |
| **Description** | Query multiple models and synthesize results with conflict detection |
| **Quality Improvement** | Best overall quality |
| **Latency** | High |
| **Cost** | High |
| **Min Models** | 3 |

**Best For:** `important_decisions`, `quality_critical`, `diverse_perspectives`
**Problem Indicators:** `quality_priority`, `needs_diversity`, `important_task`

---

### CASCADE - Cascade
| Attribute | Value |
|-----------|-------|
| **UI Name** | Cascade |
| **Scientific Name** | Escalate on low confidence |
| **Code** | `CASCADE` |
| **Category** | Model Routing Strategies |
| **Description** | Start with cheap model, escalate to better if confidence below threshold |
| **Quality Improvement** | Cost reduction 40-60% |
| **Latency** | Variable |
| **Cost** | Low |
| **Min Models** | 2 |

**Best For:** `variable_complexity`, `cost_optimization`, `adaptive`
**Problem Indicators:** `unknown_complexity`, `cost_conscious`, `adaptive_quality`

---

### SPECIALIST - Specialist Routing
| Attribute | Value |
|-----------|-------|
| **UI Name** | Specialist Routing |
| **Scientific Name** | Route to domain expert |
| **Code** | `SPECIALIST` |
| **Category** | Model Routing Strategies |
| **Description** | Route to best model per content type/domain |
| **Quality Improvement** | Best domain performance |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 2 |

**Best For:** `domain_specific`, `specialized_tasks`, `expert_needed`
**Problem Indicators:** `specific_domain`, `expert_knowledge`, `specialized_task`

---

## Domain-Specific Orchestration

### DOMAIN_INJECT - Domain Expert Injection
| Attribute | Value |
|-----------|-------|
| **UI Name** | Domain Expert Injection |
| **Scientific Name** | Prepend domain prompts |
| **Code** | `DOMAIN_INJECT` |
| **Category** | Domain-Specific Orchestration |
| **Description** | Prepend domain-specific system prompts based on 800+ domain routing |
| **Quality Improvement** | Domain accuracy +20-40% |
| **Latency** | Low |
| **Cost** | Low |
| **Min Models** | 1 |

**Best For:** `domain_tasks`, `specialized_knowledge`, `professional_contexts`
**Problem Indicators:** `domain_specific`, `professional_context`, `specialized_knowledge`

---

### MULTI_EXPERT - Multi-Expert Consensus
| Attribute | Value |
|-----------|-------|
| **UI Name** | Multi-Expert Consensus |
| **Scientific Name** | Multiple domain experts |
| **Code** | `MULTI_EXPERT` |
| **Category** | Domain-Specific Orchestration |
| **Description** | Route to multiple domain experts, synthesize |
| **Quality Improvement** | Expert consensus quality +30% |
| **Latency** | High |
| **Cost** | High |
| **Min Models** | 3 |

**Best For:** `complex_domain`, `cross_functional`, `expert_consensus`
**Problem Indicators:** `multi_domain`, `expert_critical`, `consensus_needed`

---

### CHALLENGER_CONSENSUS - Challenger + Consensus
| Attribute | Value |
|-----------|-------|
| **UI Name** | Challenger + Consensus |
| **Scientific Name** | Baseline then challenge |
| **Code** | `CHALLENGER_CONSENSUS` |
| **Category** | Domain-Specific Orchestration |
| **Description** | Baseline round → Challenger round questioning assumptions → Synthesis |
| **Quality Improvement** | Removes blind spots +40% |
| **Latency** | High |
| **Cost** | High |
| **Min Models** | 2 |

**Best For:** `assumption_testing`, `robust_analysis`, `critical_thinking`
**Problem Indicators:** `assumptions_present`, `needs_challenge`, `robust_required`

---

### CROSS_DOMAIN - Cross-Domain Synthesis
| Attribute | Value |
|-----------|-------|
| **UI Name** | Cross-Domain Synthesis |
| **Scientific Name** | Multi-domain merge |
| **Code** | `CROSS_DOMAIN` |
| **Category** | Domain-Specific Orchestration |
| **Description** | Detect multi-domain queries, route to each expert, merge insights |
| **Quality Improvement** | Cross-domain insight +50% |
| **Latency** | High |
| **Cost** | High |
| **Min Models** | 3 |

**Best For:** `interdisciplinary`, `cross_functional`, `holistic_analysis`
**Problem Indicators:** `multi_domain`, `interdisciplinary`, `holistic_needed`

---

## Cognitive Frameworks

### FIRST_PRINCIPLES - First Principles Thinking
| Attribute | Value |
|-----------|-------|
| **UI Name** | First Principles Thinking |
| **Scientific Name** | Decompose to fundamentals |
| **Code** | `FIRST_PRINCIPLES` |
| **Category** | Cognitive Frameworks |
| **Description** | Decompose problem to fundamental truths and rebuild solution |
| **Quality Improvement** | Novel solutions +60% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `innovation`, `fundamental_analysis`, `breakthrough_thinking`
**Problem Indicators:** `needs_innovation`, `fundamental_question`, `conventional_failed`

---

### ANALOGICAL - Analogical Reasoning
| Attribute | Value |
|-----------|-------|
| **UI Name** | Analogical Reasoning |
| **Scientific Name** | Cross-domain patterns |
| **Code** | `ANALOGICAL` |
| **Category** | Cognitive Frameworks |
| **Description** | Find analogies from other domains to solve current problem |
| **Quality Improvement** | Creative solutions +40% |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `creative_solutions`, `cross_domain`, `pattern_matching`
**Problem Indicators:** `stuck_on_problem`, `needs_creativity`, `pattern_available`

---

### SYSTEMS - Systems Thinking
| Attribute | Value |
|-----------|-------|
| **UI Name** | Systems Thinking |
| **Scientific Name** | Feedback loops, emergence |
| **Code** | `SYSTEMS` |
| **Category** | Cognitive Frameworks |
| **Description** | Analyze as interconnected system with feedback loops and emergent properties |
| **Quality Improvement** | System understanding +50% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `complex_systems`, `organizational`, `ecosystem_analysis`
**Problem Indicators:** `complex_system`, `interconnected`, `feedback_present`

---

### SOCRATIC - Socratic Method
| Attribute | Value |
|-----------|-------|
| **UI Name** | Socratic Method |
| **Scientific Name** | Dialectical questioning |
| **Code** | `SOCRATIC` |
| **Category** | Cognitive Frameworks |
| **Description** | Use probing questions to stimulate critical thinking and illuminate ideas |
| **Quality Improvement** | Understanding depth +40% |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `learning`, `clarification`, `deep_understanding`
**Problem Indicators:** `needs_clarity`, `learning_context`, `deep_dive`

---

### TRIZ - TRIZ
| Attribute | Value |
|-----------|-------|
| **UI Name** | TRIZ |
| **Scientific Name** | Contradiction resolution |
| **Code** | `TRIZ` |
| **Category** | Cognitive Frameworks |
| **Description** | Use contradiction matrices and 40 inventive principles |
| **Quality Improvement** | Inventive solutions +70% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `engineering`, `invention`, `contradiction_resolution`
**Problem Indicators:** `contradiction_present`, `engineering_problem`, `invention_needed`

---

### DESIGN_THINKING - Design Thinking
| Attribute | Value |
|-----------|-------|
| **UI Name** | Design Thinking |
| **Scientific Name** | Empathize→Define→Ideate→Prototype→Test |
| **Code** | `DESIGN_THINKING` |
| **Category** | Cognitive Frameworks |
| **Description** | Human-centered design process with iteration |
| **Quality Improvement** | User satisfaction +50% |
| **Latency** | Very High |
| **Cost** | High |
| **Min Models** | 1 |

**Best For:** `product_design`, `user_experience`, `innovation`
**Problem Indicators:** `user_focused`, `design_problem`, `needs_iteration`

---

### SCIENTIFIC - Scientific Method
| Attribute | Value |
|-----------|-------|
| **UI Name** | Scientific Method |
| **Scientific Name** | Hypothesis→Experiment→Analysis |
| **Code** | `SCIENTIFIC` |
| **Category** | Cognitive Frameworks |
| **Description** | Formulate hypothesis, design experiment, analyze results |
| **Quality Improvement** | Rigorous conclusions +60% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `research`, `investigation`, `empirical_questions`
**Problem Indicators:** `testable_question`, `research_needed`, `empirical`

---

### LATERAL - Lateral Thinking
| Attribute | Value |
|-----------|-------|
| **UI Name** | Lateral Thinking |
| **Scientific Name** | Random entry, provocation |
| **Code** | `LATERAL` |
| **Category** | Cognitive Frameworks |
| **Description** | Use random stimuli and provocations to break conventional thinking |
| **Quality Improvement** | Creative breakthroughs +80% |
| **Latency** | Medium |
| **Cost** | Low |
| **Min Models** | 1 |

**Best For:** `creativity`, `brainstorming`, `unconventional_solutions`
**Problem Indicators:** `stuck_in_rut`, `needs_creativity`, `brainstorming`

---

### ABDUCTIVE - Abductive Reasoning
| Attribute | Value |
|-----------|-------|
| **UI Name** | Abductive Reasoning |
| **Scientific Name** | Inference to best explanation |
| **Code** | `ABDUCTIVE` |
| **Category** | Cognitive Frameworks |
| **Description** | Generate and evaluate hypotheses to find best explanation |
| **Quality Improvement** | Explanation quality +40% |
| **Latency** | Medium |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `diagnosis`, `investigation`, `hypothesis_generation`
**Problem Indicators:** `unexplained_phenomenon`, `diagnosis_needed`, `mystery`

---

### COUNTERFACTUAL - Counterfactual Thinking
| Attribute | Value |
|-----------|-------|
| **UI Name** | Counterfactual Thinking |
| **Scientific Name** | What-if analysis |
| **Code** | `COUNTERFACTUAL` |
| **Category** | Cognitive Frameworks |
| **Description** | Explore alternative scenarios and their implications |
| **Quality Improvement** | Risk identification +50% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `planning`, `risk_analysis`, `scenario_planning`
**Problem Indicators:** `scenario_analysis`, `risk_assessment`, `planning`

---

### DIALECTICAL - Dialectical Thinking
| Attribute | Value |
|-----------|-------|
| **UI Name** | Dialectical Thinking |
| **Scientific Name** | Thesis-antithesis-synthesis |
| **Code** | `DIALECTICAL` |
| **Category** | Cognitive Frameworks |
| **Description** | Explore opposing views to reach higher synthesis |
| **Quality Improvement** | Balanced conclusions +45% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `philosophy`, `conflict_resolution`, `synthesis`
**Problem Indicators:** `opposing_views`, `conflict_present`, `synthesis_needed`

---

### MORPHOLOGICAL - Morphological Analysis
| Attribute | Value |
|-----------|-------|
| **UI Name** | Morphological Analysis |
| **Scientific Name** | Parameter space exploration |
| **Code** | `MORPHOLOGICAL` |
| **Category** | Cognitive Frameworks |
| **Description** | Systematically explore all possible parameter combinations |
| **Quality Improvement** | Option coverage +70% |
| **Latency** | High |
| **Cost** | Medium |
| **Min Models** | 1 |

**Best For:** `systematic_exploration`, `option_generation`, `completeness`
**Problem Indicators:** `many_parameters`, `systematic_needed`, `completeness_required`

---

### PREMORTEM - Pre-mortem Analysis
| Attribute | Value |
|-----------|-------|
| **UI Name** | Pre-mortem Analysis |
| **Scientific Name** | Prospective hindsight |
| **Code** | `PREMORTEM` |
| **Category** | Cognitive Frameworks |
| **Description** | Imagine failure has occurred and work backwards to identify causes |
| **Quality Improvement** | Risk mitigation +60% |
| **Latency** | Medium |
| **Cost** | Low |
| **Min Models** | 1 |

**Best For:** `risk_management`, `project_planning`, `failure_prevention`
**Problem Indicators:** `project_start`, `risk_critical`, `planning_phase`

---

### FERMI - Fermi Estimation
| Attribute | Value |
|-----------|-------|
| **UI Name** | Fermi Estimation |
| **Scientific Name** | Order of magnitude reasoning |
| **Code** | `FERMI` |
| **Category** | Cognitive Frameworks |
| **Description** | Break down estimation into smaller, estimable components |
| **Quality Improvement** | Estimation accuracy +50% |
| **Latency** | Low |
| **Cost** | Low |
| **Min Models** | 1 |

**Best For:** `estimation`, `quick_analysis`, `order_of_magnitude`
**Problem Indicators:** `unknown_quantity`, `estimation_needed`, `limited_data`

---

# Quick Reference Tables

## Workflows by Category

| Category | Count | Workflows |
|----------|-------|-----------|
| Adversarial & Validation | 2 | ARE, LM_VS_LM |
| Debate & Deliberation | 3 | SOD, MDA, ReConcile |
| Judge & Critic | 3 | LAAJE, RLAIF, IREF |
| Ensemble & Aggregation | 3 | SCMR, CWMA, SMoE |
| Reflection & Self-Improvement | 3 | ISFR, VRL, LATS |
| Verification & Fact-Checking | 2 | CoVe, SelfRAG |
| Multi-Agent Collaboration | 2 | LLM_MAS, MAPR |
| Reasoning Enhancement | 9 | CoT, ZeroShotCoT, ToT, GoT, ReAct, L2M, PS, MCP, PoT |
| Model Routing Strategies | 4 | SINGLE, ENSEMBLE, CASCADE, SPECIALIST |
| Domain-Specific Orchestration | 4 | DOMAIN_INJECT, MULTI_EXPERT, CHALLENGER_CONSENSUS, CROSS_DOMAIN |
| Cognitive Frameworks | 14 | FIRST_PRINCIPLES, ANALOGICAL, SYSTEMS, SOCRATIC, TRIZ, DESIGN_THINKING, SCIENTIFIC, LATERAL, ABDUCTIVE, COUNTERFACTUAL, DIALECTICAL, MORPHOLOGICAL, PREMORTEM, FERMI |

## Workflows by Cost/Latency

| Cost | Low Latency | Medium Latency | High Latency | Very High Latency |
|------|-------------|----------------|--------------|-------------------|
| **Low** | ZeroShotCoT, SINGLE, FERMI, LATERAL | PoT, SMoE | - | - |
| **Medium** | - | CoT, PS, SCMR, CWMA, SOCRATIC, ABDUCTIVE, ANALOGICAL | CoVe, SelfRAG, ReAct, L2M, VRL, MCP, ISFR, RLAIF, FIRST_PRINCIPLES, SYSTEMS, SCIENTIFIC, COUNTERFACTUAL, DIALECTICAL, MORPHOLOGICAL, PREMORTEM, TRIZ | - |
| **High** | - | LAAJE, SPECIALIST | ARE, LM_VS_LM, IREF, MAPR, MULTI_EXPERT, CHALLENGER_CONSENSUS, CROSS_DOMAIN, LLM_MAS | DESIGN_THINKING |
| **Very High** | - | - | - | SOD, MDA, ReConcile, LATS, ToT, GoT |

## Workflows by Minimum Models Required

| Min Models | Workflows |
|------------|-----------|
| 1 | CoT, ZeroShotCoT, ToT, GoT, ReAct, L2M, PS, MCP, PoT, SINGLE, ISFR, VRL, LATS, CoVe, SelfRAG, DOMAIN_INJECT, FIRST_PRINCIPLES, ANALOGICAL, SYSTEMS, SOCRATIC, TRIZ, DESIGN_THINKING, SCIENTIFIC, LATERAL, ABDUCTIVE, COUNTERFACTUAL, DIALECTICAL, MORPHOLOGICAL, PREMORTEM, FERMI |
| 2 | ARE, LM_VS_LM, LAAJE, RLAIF, IREF, SMoE, CASCADE, SPECIALIST, CHALLENGER_CONSENSUS |
| 3 | SOD, MDA, ReConcile, SCMR, CWMA, LLM_MAS, MAPR, ENSEMBLE, MULTI_EXPERT, CROSS_DOMAIN |

---

*Generated for RADIANT v5.2.2 - Complete Orchestration Reference*


---

## Part III: Orchestration Patterns

> **Version:** 4.18.0  
> **Last Updated:** December 2024

## Overview

The RADIANT Orchestration Patterns System enables sophisticated multi-AI workflows that leverage multiple AI providers in parallel, with intelligent model selection based on task characteristics and domain analysis.

## Table of Contents

1. [Architecture](#architecture)
2. [Orchestration Workflows](#orchestration-workflows)
3. [Methods & Steps](#methods--steps)
4. [Parallel Execution](#parallel-execution)
5. [AGI Dynamic Model Selection](#agi-dynamic-model-selection)
6. [Model Modes](#model-modes)
7. [Visual Workflow Editor](#visual-workflow-editor)
8. [API Reference](#api-reference)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATION ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   WORKFLOWS     │    │    METHODS      │    │     STEPS       │         │
│  │   (49 patterns) │───▶│   (reusable)    │───▶│  (configured)   │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│           │                     │                      │                    │
│           │                     │                      ▼                    │
│           │                     │         ┌─────────────────────────┐       │
│           │                     │         │   PARALLEL EXECUTION    │       │
│           │                     │         │   ─────────────────     │       │
│           │                     │         │   • Multiple AI models  │       │
│           │                     │         │   • AGI model selection │       │
│           │                     │         │   • Mode optimization   │       │
│           │                     │         │   • Result synthesis    │       │
│           │                     │         └─────────────────────────┘       │
│           │                     │                      │                    │
│           ▼                     ▼                      ▼                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    ModelMetadataService                              │   │
│  │  • Live model availability    • Capability scores (0-1)              │   │
│  │  • Pricing data               • Context windows                      │   │
│  │  • Specialties & weaknesses   • Quality/reliability scores           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **OrchestrationPatternsService** | `packages/infrastructure/lambda/shared/services/orchestration-patterns.service.ts` | Core service managing workflow execution |
| **ModelMetadataService** | `packages/infrastructure/lambda/shared/services/model-metadata.service.ts` | Live model data and capabilities |
| **Visual Editor** | `apps/admin-dashboard/app/(dashboard)/orchestration-patterns/editor/page.tsx` | Admin UI for workflow design |
| **Shared Components** | `apps/admin-dashboard/components/workflow-editor/index.tsx` | Reusable editor components |

---

## Orchestration Workflows

### 49 Documented Patterns

Workflows are organized into categories:

| Category | Patterns | Example |
|----------|----------|---------|
| **Consensus & Aggregation** | Self-Consistency, Universal Self-Consistency, Meta-Reasoning | Multiple samples with majority voting |
| **Debate & Deliberation** | AI Debate, Multi-Agent Debate, Cross-Examination | Adversarial argumentation |
| **Critique & Refinement** | Self-Refine, Reflexion, Constitutional AI | Iterative improvement |
| **Verification & Validation** | Chain-of-Verification, Fact-Checking Pipeline | Multi-stage fact checking |
| **Decomposition** | Least-to-Most, Decomposed Prompting, Tree of Thoughts | Problem breakdown |
| **Specialized Reasoning** | Chain-of-Thought, ReAct, Graph-of-Thoughts | Enhanced reasoning patterns |
| **Multi-Model Routing** | Mixture of Experts, Speculative Decoding, Model Cascading | Intelligent routing |
| **Ensemble Methods** | Model Ensemble, Boosted Prompting, Blended RAG | Multiple model combination |

### Workflow Structure

```typescript
interface OrchestrationWorkflow {
  workflowId: string;
  workflowCode: string;           // e.g., "SOD" for AI Debate
  commonName: string;             // e.g., "AI Debate"
  formalName: string;             // e.g., "Scalable Oversight via Debate"
  category: string;
  categoryCode: string;
  patternNumber: number;          // 1-49
  description: string;
  detailedDescription?: string;
  bestFor: string[];              // Use cases
  problemIndicators: string[];    // When to use
  qualityImprovement: string;     // Expected improvement
  typicalLatency: string;
  typicalCost: string;
  minModelsRequired: number;
  defaultConfig: Record<string, unknown>;
  isSystemWorkflow: boolean;
  isEnabled: boolean;
}
```

---

## Methods & Steps

### Reusable Methods

Methods are shared building blocks with default parameters:

| Method Code | Name | Role | Description |
|-------------|------|------|-------------|
| `GENERATE_RESPONSE` | Generate Response | generator | Generate a response using AI model |
| `GENERATE_WITH_COT` | Chain-of-Thought | generator | Generate with step-by-step reasoning |
| `CRITIQUE_RESPONSE` | Critique Response | critic | Critically evaluate for flaws |
| `JUDGE_RESPONSES` | Judge Responses | judge | Compare and judge multiple responses |
| `VERIFY_FACTS` | Verify Facts | verifier | Extract and verify factual claims |
| `SYNTHESIZE_RESPONSES` | Synthesize | synthesizer | Combine best parts from multiple |
| `BUILD_CONSENSUS` | Build Consensus | synthesizer | Identify points of agreement |
| `GENERATE_CHALLENGE` | Challenge | challenger | Argue opposite position |
| `DEFEND_POSITION` | Defend | defender | Defend against challenges |
| `DECOMPOSE_PROBLEM` | Decompose | reasoner | Break down complex problems |
| `MAJORITY_VOTE` | Majority Vote | aggregator | Select most common answer |
| `WEIGHTED_AGGREGATE` | Weighted Aggregate | aggregator | Combine weighted by confidence |

### Workflow Steps

Steps are method instances with custom configuration:

```typescript
interface WorkflowStep {
  bindingId: string;
  stepOrder: number;
  stepName: string;
  stepDescription?: string;
  method: OrchestrationMethod;
  parameterOverrides: Record<string, unknown>;  // Override defaults
  conditionExpression?: string;                 // Conditional execution
  isIterative: boolean;                         // Repeat execution
  maxIterations: number;
  iterationCondition?: string;
  dependsOnSteps: number[];                     // DAG dependencies
  modelOverride?: string;                       // Force specific model
  outputVariable?: string;                      // Store output
  parallelExecution?: ParallelExecutionConfig;  // Parallel AI calls
}
```

---

## Parallel Execution

Each method step can call **multiple AI providers simultaneously** for improved quality and reliability.

### Execution Modes

| Mode | Behavior | Best For |
|------|----------|----------|
| **all** | Wait for all models to respond | Maximum quality, comprehensive synthesis |
| **race** | Return first successful response | Latency-sensitive applications |
| **quorum** | Continue when X% of models respond | Balance of speed and quality |

### Synthesis Strategies

| Strategy | How It Works |
|----------|--------------|
| **best_of** | Select response with highest confidence score |
| **vote** | Choose most common answer pattern (majority vote) |
| **weighted** | Score by confidence × speed, select highest |
| **merge** | Combine insights from all models into unified response |

### Configuration

```typescript
interface ParallelExecutionConfig {
  enabled: boolean;
  mode: 'all' | 'race' | 'quorum';
  models: string[];                    // Fallback if AGI disabled
  quorumThreshold?: number;            // 0.5 = majority
  synthesizeResults?: boolean;
  synthesisStrategy?: 'best_of' | 'merge' | 'vote' | 'weighted';
  weightByConfidence?: boolean;
  timeoutMs?: number;                  // Per-model timeout
  failureStrategy?: 'fail_fast' | 'continue' | 'fallback';
  
  // AGI Dynamic Selection
  agiModelSelection?: boolean;         // Enable AGI selection
  minModels?: number;                  // Min models to select (default: 2)
  maxModels?: number;                  // Max models to select (default: 5)
  domainHints?: string[];              // Hints for domain detection
  preferredModes?: ModelMode[];        // Preferred execution modes
}
```

---

## AGI Dynamic Model Selection

When `agiModelSelection` is enabled, the system **dynamically selects optimal models** based on:

### 1. Domain Detection

Analyzes prompt content to detect subject domain:

| Domain | Keywords Detected |
|--------|-------------------|
| **coding** | code, function, class, debug, algorithm, typescript, python, api, database |
| **math** | calculate, equation, formula, proof, theorem, algebra, calculus, integral |
| **science** | scientific, hypothesis, experiment, physics, chemistry, biology, quantum |
| **legal** | legal, contract, law, regulation, compliance, liability, jurisdiction |
| **medical** | medical, diagnosis, treatment, symptoms, patient, clinical, therapy |
| **finance** | financial, investment, market, stock, trading, portfolio, valuation |
| **creative** | write, story, poem, creative, narrative, fiction, imagine, design |
| **reasoning** | reason, logic, deduce, infer, conclude, argue, step by step |
| **research** | research, comprehensive, thorough, deep dive, explore, investigate |

### 2. Task Characteristics

Analyzes prompt for task requirements:

```typescript
interface TaskCharacteristics {
  complexity: 'low' | 'medium' | 'high';
  requiresReasoning: boolean;     // "think", "step by step", "why"
  requiresCreativity: boolean;    // "creative", "imagine", "write"
  requiresPrecision: boolean;     // "exact", "precise", "accurate"
  requiresResearch: boolean;      // "research", "comprehensive", "thorough"
  estimatedTokens: number;
}
```

### 3. Live Model Scoring

Queries `ModelMetadataService` for available models and scores based on:

- **Domain match** from model specialties
- **Capability scores** (reasoning, coding, creative, etc.)
- **Quality/reliability scores** from metadata
- **Context window** for complex tasks
- **Mode compatibility** for task type
- **Cost efficiency** for budget-conscious selection

### 4. Optimal Mode Assignment

For each selected model, assigns the optimal execution mode.

---

## Model Modes

Modes configure how models are invoked based on their capabilities and task requirements.

### Available Modes

| Mode | Icon | Description | Auto-Selected When | Parameters Applied |
|------|------|-------------|-------------------|-------------------|
| **standard** | - | Default execution | Fallback | Default params |
| **thinking** | 🧠 | Extended reasoning | `requiresReasoning=true` + o1/claude/r1 | `thinkingBudget: 5000-10000, enableThinking: true` |
| **deep_research** | 🔬 | In-depth research | `requiresResearch=true` + perplexity/gemini-deep | `searchDepth: comprehensive, includeSources: true` |
| **fast** | ⚡ | Speed-optimized | flash/turbo/mini models | `maxTokens: 2048, streamResponse: true` |
| **creative** | 🎨 | Higher temperature | `requiresCreativity=true` | `temperature: 0.9, topP: 0.95` |
| **precise** | 🎯 | Low temperature | `requiresPrecision=true` | `temperature: 0.1, topP: 0.9` |
| **code** | 💻 | Code-specialized | coding domain | `temperature: 0.2` |
| **vision** | 👁️ | Multimodal vision | vision-capable models | `enableVision: true` |
| **long_context** | 📄 | Extended context | large context windows | `maxTokens: 16384, useLongContext: true` |

### Mode Selection Logic

```typescript
// Example: Thinking mode selection
if (characteristics.requiresReasoning) {
  if (modelId.includes('o1') || modelId.includes('o3')) {
    return { mode: 'thinking', modeBonus: 0.3 };
  }
  if (modelId.includes('claude') && modelId.includes('3.5')) {
    return { mode: 'thinking', modeBonus: 0.25 };
  }
  if (modelId.includes('deepseek') && modelId.includes('r1')) {
    return { mode: 'thinking', modeBonus: 0.25 };
  }
}

// Example: Deep research mode selection
if (characteristics.requiresResearch) {
  if (modelId.includes('perplexity') || modelId.includes('sonar')) {
    return { mode: 'deep_research', modeBonus: 0.35 };
  }
  if (modelId.includes('gemini') && modelName.includes('deep')) {
    return { mode: 'deep_research', modeBonus: 0.3 };
  }
}
```

---

## Visual Workflow Editor

### Features

- **Method Palette** - Drag-and-drop orchestration methods
- **Canvas** - Visual workflow design with nodes and connections
- **Step Configuration** - 4-tab panel:
  - **General** - Name, order, model override, output variable
  - **Parameters** - JSON overrides with quick editors
  - **Parallel** - AGI selection, modes, synthesis
  - **Advanced** - Iteration, conditions
- **Zoom/Pan** - Canvas navigation
- **Settings Dialog** - Workflow-level configuration

### Parallel Tab Configuration

```
┌─────────────────────────────────────────────────────┐
│ 🔵 Enable Parallel Execution                    [✓] │
├─────────────────────────────────────────────────────┤
│ 🧠 AGI Model Selection                          [✓] │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Min Models: [2]      Max Models: [5]            │ │
│ │ Domain Hints: coding, reasoning                 │ │
│ │ Preferred Modes:                                │ │
│ │   [✓] thinking  [✓] deep_research  [ ] fast    │ │
│ │   [ ] creative  [✓] precise        [✓] code    │ │
│ └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ Execution Mode: [All (wait for all models)     ▼]  │
│ Quorum Threshold: [──●─────] 50%                   │
├─────────────────────────────────────────────────────┤
│ [✓] Synthesize Results                             │
│ Strategy: [Weighted (confidence + speed)       ▼]  │
├─────────────────────────────────────────────────────┤
│ Timeout: [30000] ms                                │
│ Failure Strategy: [Continue (use successful)   ▼]  │
└─────────────────────────────────────────────────────┘
```

---

## API Reference

### OrchestrationPatternsService

```typescript
class OrchestrationPatternsService {
  // Pattern Selection
  async selectPattern(request: PatternSelectionRequest): Promise<PatternSelectionResult>;
  
  // Workflow Execution
  async executeWorkflow(request: ExecutionRequest): Promise<ExecutionResult>;
  
  // CRUD Operations
  async getWorkflow(workflowCode: string): Promise<OrchestrationWorkflow | null>;
  async getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]>;
  async getAllWorkflows(options?: { category?: string; enabledOnly?: boolean }): Promise<OrchestrationWorkflow[]>;
  async getMethods(category?: string): Promise<OrchestrationMethod[]>;
}
```

### Execution Flow

```typescript
// 1. Select best pattern for task
const selection = await orchestrationPatternsService.selectPattern({
  tenantId: 'tenant-123',
  prompt: 'Write a recursive algorithm for TSP with dynamic programming',
  taskType: 'coding',
  complexity: 'high',
  qualityPriority: 0.9,
});

// 2. Execute selected workflow
const result = await orchestrationPatternsService.executeWorkflow({
  tenantId: 'tenant-123',
  workflowCode: selection.selectedPattern.workflowCode,
  prompt: '...',
  configOverrides: {
    parallelExecution: {
      enabled: true,
      agiModelSelection: true,
      minModels: 3,
      preferredModes: ['thinking', 'code'],
    },
  },
});

// 3. Result includes all step outputs
console.log(result.response);           // Final synthesized response
console.log(result.qualityScore);       // 0-1 quality assessment
console.log(result.steps);              // Individual step results
console.log(result.modelsUsed);         // All models that participated
```

### Step Execution Result

```typescript
interface StepExecutionResult {
  stepOrder: number;
  stepName: string;
  methodCode: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  modelUsed: string;                    // Primary model
  latencyMs: number;
  costCents: number;
  iteration: number;
  
  // Parallel execution details
  wasParallel?: boolean;
  parallelResults?: ParallelExecutionResult[];
  synthesizedFrom?: string[];           // Models that contributed
}

interface ParallelExecutionResult {
  modelId: string;
  response: string;
  latencyMs: number;
  costCents: number;
  tokensUsed: number;
  confidence?: number;                  // 0-1 estimated confidence
  status: 'success' | 'failed' | 'timeout';
  error?: string;
}
```

---

## Database Schema

Key tables in `migrations/000_consolidated_schema.sql`:

```sql
-- Core tables
orchestration_methods          -- Reusable method definitions
orchestration_workflows        -- 49 workflow patterns
workflow_method_bindings       -- Steps linking workflows to methods
workflow_customizations        -- Per-tenant/user overrides

-- Execution tracking
orchestration_executions       -- Workflow execution records
orchestration_step_executions  -- Individual step records
```

---

## Best Practices

### 1. When to Enable AGI Selection

✅ **Enable when:**
- Task domain is unclear or mixed
- Maximum quality is required
- Cost is not a primary concern

❌ **Disable when:**
- Specific model is required (compliance)
- Predictable cost is critical
- Testing specific model behavior

### 2. Choosing Execution Mode

| Use Case | Recommended Mode |
|----------|-----------------|
| Critical decisions | `all` with `vote` synthesis |
| User-facing latency-sensitive | `race` |
| Background processing | `all` with `merge` synthesis |
| Cost-sensitive | `quorum` at 50% |

### 3. Mode Selection Tips

- Enable **thinking** mode for math, reasoning, complex analysis
- Enable **deep_research** mode for fact-finding, comprehensive answers
- Enable **fast** mode for simple queries, autocomplete
- Enable **code** mode for programming tasks
- Enable **precise** mode for factual, accuracy-critical responses

---

## Troubleshooting

### Common Issues

**Models not being selected:**
- Check `ModelMetadataService` has available models
- Verify `isAvailable: true` in model metadata
- Check domain hints match model specialties

**High latency:**
- Reduce `maxModels`
- Use `race` mode instead of `all`
- Disable `thinking` mode for simple tasks

**Inconsistent results:**
- Enable `synthesizeResults` with `vote` strategy
- Increase `minModels` for more consensus
- Use `precise` mode for factual tasks

---

## Changelog

### v4.18.0 (December 2024)
- Added dynamic model selection from `ModelMetadataService`
- Added 9 model execution modes (thinking, deep_research, etc.)
- Added AGI-driven mode assignment based on task analysis
- Removed hardcoded model lists
- Added preferred modes configuration in UI
- Enhanced domain detection with research category
- Added mode-specific parameter application


---

## Part IV: Workflow & UEP Architecture

> **RADIANT v5.52.58** | Universal Envelope Protocol Integration for Workflow Orchestration

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Key Design Principles](#3-key-design-principles)
4. [UEP Node Service](#4-uep-node-service)
5. [Condition Evaluators](#5-condition-evaluators)
6. [Stream Evaluation Modes](#6-stream-evaluation-modes)
7. [Envelope Transformation](#7-envelope-transformation)
8. [Database Schema](#8-database-schema)
9. [Integration Guide](#9-integration-guide)
10. [API Reference](#10-api-reference)
11. [Best Practices](#11-best-practices)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Overview

The Workflow UEP Architecture integrates the Universal Envelope Protocol (UEP) v2.0 into RADIANT's workflow orchestration system. This provides:

- **Standardized Data Exchange**: All workflow node inputs/outputs wrapped in UEP envelopes
- **Model-Agnostic Conditions**: Evaluate output content, not model identity
- **Stream-Based Evaluation**: Handle parallel model outputs with configurable evaluation modes
- **AI-Interpreted Conditions**: Natural language condition evaluation
- **Complete Traceability**: End-to-end distributed tracing across workflow nodes
- **Compliance Integration**: Automatic compliance framework tagging and audit trails

### Key Files

| Component | Location |
|-----------|----------|
| UEP Node Service | `lambda/shared/services/workflow/uep-node.service.ts` |
| Workflow Engine | `lambda/shared/services/workflow-engine.ts` |
| Orchestration Patterns | `lambda/shared/services/orchestration-patterns.service.ts` |
| Database Migration | `migrations/000_consolidated_schema.sql` |

---

## 2. Architecture

### 2.1 High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WORKFLOW EXECUTION                                   │
│                                                                              │
│  ┌──────────┐    UEP     ┌───────────┐    UEP     ┌──────────┐             │
│  │  Node A  │───────────▶│  Link AB  │───────────▶│  Node B  │             │
│  │          │  Envelope  │           │  Envelope  │          │             │
│  │ AI Call  │            │ Condition │            │ AI Call  │             │
│  │          │            │ Evaluator │            │          │             │
│  └──────────┘            └─────┬─────┘            └──────────┘             │
│       │                        │                        │                   │
│       │                        │                        │                   │
│       ▼                        ▼                        ▼                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    UEP STORAGE (UDS TIERED)                          │   │
│  │   Hot (Redis) → Warm (PostgreSQL) → Cold (S3) → Glacier             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Envelope Flow

1. **Node Input**: Create input envelope with source linkage
2. **Node Execution**: AI model invocation (may be parallel)
3. **Condition Evaluation**: Evaluate conditions on output content
4. **Envelope Transformation**: Apply transforms based on condition results
5. **Node Output**: Complete output envelope with metrics
6. **Storage**: Persist to UDS tiered storage

### 2.3 Component Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                     WorkflowEngine                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ startExecutionWithUEP()  │  executeTaskWithUEP()          │  │
│  │ completeTaskWithUEP()    │  getUEPContext()               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    UEPNodeService                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐│  │
│  │  │  Envelope   │  │  Condition  │  │     Envelope        ││  │
│  │  │  Creation   │  │  Evaluation │  │   Transformation    ││  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘│  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   UDS Tiered Storage                       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Key Design Principles

### 3.1 Model-Agnostic Conditions

**Critical Design Decision**: Conditions evaluate OUTPUT CONTENT, not model identity.

**Why?**
- Users can change AI models in methods at any time
- Workflow logic should not break when models are swapped
- Conditions should be portable across different model configurations

**Example**:
```typescript
// ✅ CORRECT: Evaluate content
const condition: NodeCondition = {
  type: 'expression',
  expression: 'output.confidence > 0.8 && output.category === "technical"',
  streamMode: 'any',
};

// ❌ WRONG: Don't bind conditions to specific models
// condition: 'modelId === "claude-3-sonnet" && ...'
```

### 3.2 Stream-Based Processing

Workflows support parallel model execution with configurable result aggregation:

```
                    ┌─────────────┐
                    │   Prompt    │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  Model A    │ │  Model B    │ │  Model C    │
    │  (Stream 1) │ │  (Stream 2) │ │  (Stream 3) │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           ▼
                 ┌─────────────────────┐
                 │ Condition Evaluator │
                 │  (Stream Mode: ANY) │
                 └──────────┬──────────┘
                            ▼
                 ┌─────────────────────┐
                 │  Aggregate/Select   │
                 └─────────────────────┘
```

### 3.3 UEP Envelope Linking

Every envelope maintains parent-child relationships for complete traceability:

```typescript
{
  envelopeId: "abc-123",
  payload: {
    input: {
      fromNodeId: "node_a",           // Previous node
      fromEnvelopeId: "xyz-789",      // Parent envelope
      content: { ... }
    }
  },
  tracing: {
    traceId: "trace-001",             // Workflow trace
    spanId: "span-002",               // This node's span
    parentSpanId: "span-001",         // Parent node's span
    workflowSpanId: "span-root"       // Workflow root span
  }
}
```

---

## 4. UEP Node Service

### 4.1 Service Overview

The `UEPNodeService` is the central integration point for workflow UEP operations:

```typescript
import { uepNodeService } from './workflow/index.js';

// Create input envelope
const inputEnvelope = uepNodeService.createInputEnvelope(
  nodeId,
  nodeName,
  nodeType,
  input,
  context,
  sourceEnvelope
);

// Complete with output
const outputEnvelope = uepNodeService.completeOutputEnvelope(
  inputEnvelope,
  output,
  { streams, modelInfo, usage, riskSignals, metadata }
);

// Evaluate conditions
const result = await uepNodeService.evaluateCondition(
  condition,
  outputEnvelope,
  context
);

// Apply transformations
const transformed = uepNodeService.applyEnvelopeTransform(
  outputEnvelope,
  transform,
  evaluationResult
);

// Store envelope
await uepNodeService.storeEnvelope(outputEnvelope);
```

### 4.2 Envelope Structure

```typescript
interface WorkflowUEPEnvelope {
  envelopeId: string;
  specversion: '2.0';
  type: string;
  
  source: {
    system: 'RADIANT';
    component: 'workflow-engine';
    version: string;
    tenantId: string;
    userId?: string;
  };
  
  workflow: {
    workflowId: string;
    workflowCode: string;
    executionId: string;
    nodeId: string;
    nodeName: string;
    nodeType: NodeType;
    stepOrder: number;
  };
  
  payload: {
    input: { type, content, fromNodeId?, fromEnvelopeId? };
    output: { type, content, finishReason?, streams? };
    metadata?: Record<string, unknown>;
  };
  
  modelInfo?: {
    modelId: string;
    modelName?: string;
    mode?: string;
    provider?: string;
    modelsUsed?: string[];  // For parallel execution
  };
  
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costCents: number;
    latencyMs: number;
  };
  
  tracing: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    workflowSpanId: string;
    timestamp: string;
    durationMs: number;
  };
  
  compliance?: {
    frameworks: string[];
    dataClassification: string;
    auditRequired: boolean;
    phiDetected?: boolean;
    piiDetected?: boolean;
  };
  
  riskSignals?: {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    scores: Record<string, number>;
    flags: string[];
    evaluationResults?: ConditionEvaluationResult[];
  };
}
```

---

## 5. Condition Evaluators

### 5.1 Condition Types

#### Expression Conditions
JavaScript-like expressions evaluated against output content:

```typescript
const expressionCondition: NodeCondition = {
  conditionId: 'cond-001',
  name: 'High Confidence Check',
  type: 'expression',
  expression: 'output.confidence > 0.8 && !contains("error")',
  streamMode: 'any',
  onTrue: { type: 'continue' },
  onFalse: { type: 'retry', maxRetries: 3 },
};
```

**Available Helpers**:
- `hasField(field)` - Check if field exists in output
- `getField(field, default?)` - Get field value with optional default
- `length()` - Get content length
- `contains(text)` - Check if content contains text (case-insensitive)

#### AI-Interpreted Conditions
Natural language conditions evaluated by AI:

```typescript
const aiCondition: NodeCondition = {
  conditionId: 'cond-002',
  name: 'Quality Check',
  type: 'ai_interpreted',
  aiPrompt: 'Is this response helpful, on-topic, and free of safety concerns?',
  aiModel: 'groq/llama-3.1-8b-instant',  // Optional, uses fast model by default
  aiThreshold: 0.7,  // Confidence threshold
  streamMode: 'all',
  onTrue: { type: 'continue' },
  onFalse: { type: 'branch', targetNodeId: 'fallback_node' },
};
```

**Important**: AI evaluators judge content quality and relevance, NOT which model produced it.

#### Composite Conditions
Combine multiple conditions with logical operators:

```typescript
const compositeCondition: NodeCondition = {
  conditionId: 'cond-003',
  name: 'Combined Check',
  type: 'composite',
  operator: 'AND',
  subConditions: [
    { type: 'expression', expression: 'output.length() > 100', streamMode: 'any' },
    { type: 'ai_interpreted', aiPrompt: 'Is this grammatically correct?', streamMode: 'all' },
  ],
  streamMode: 'any',
};
```

**Operators**: `AND`, `OR`, `NOT`, `XOR`

### 5.2 Condition Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `continue` | Proceed to next node | - |
| `branch` | Jump to specific node | `targetNodeId` |
| `retry` | Retry current node | `maxRetries`, `retryDelayMs` |
| `fail` | Fail workflow | `errorMessage` |
| `skip` | Skip downstream nodes | - |
| `transform` | Apply envelope transformation | `transform` |

---

## 6. Stream Evaluation Modes

When workflows execute AI models in parallel, conditions must decide how to evaluate multiple outputs.

### 6.1 Available Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `all` | ALL streams must pass | Consensus required |
| `any` | ANY stream passing is sufficient | First success wins |
| `majority` | >50% of streams must pass | Democratic voting |
| `quorum` | Configurable threshold (0.0-1.0) | Custom threshold |
| `best` | Select highest-confidence stream | Quality selection |
| `unanimous` | 100% agreement required | Critical decisions |
| `weighted` | Weight by confidence scores | Confidence-based voting |

### 6.2 Configuration

```typescript
const streamConfig: StreamEvaluationConfig = {
  mode: 'quorum',
  quorumThreshold: 0.66,  // 2/3 majority
  minConfidence: 0.5,      // Ignore low-confidence streams
  aggregateOutputs: true,
  aggregationStrategy: 'merge',  // 'merge' | 'best' | 'vote' | 'concatenate'
};
```

### 6.3 Stream Selection After Evaluation

After condition evaluation, use envelope transformation to select which streams continue:

```typescript
const transform: EnvelopeTransform = {
  selectStreams: {
    mode: 'all_passing',  // Only streams that passed condition
  },
  addMetadata: {
    conditionApplied: 'quality_filter',
    originalStreamCount: 3,
  },
};
```

---

## 7. Envelope Transformation

Transformations modify the UEP envelope based on condition results.

### 7.1 Transform Options

```typescript
interface EnvelopeTransform {
  // Add metadata
  addMetadata?: Record<string, unknown>;
  
  // Set compliance flags
  setCompliance?: {
    frameworks?: string[];
    dataClassification?: string;
    auditRequired?: boolean;
  };
  
  // Add risk signals
  addRiskSignals?: {
    flags?: string[];
    scores?: Record<string, number>;
  };
  
  // Select specific streams from parallel output
  selectStreams?: {
    mode: 'top_n' | 'threshold' | 'all_passing';
    n?: number;
    threshold?: number;
  };
}
```

### 7.2 Examples

#### Mark for Compliance Review
```typescript
{
  setCompliance: {
    frameworks: ['HIPAA', 'SOC2'],
    auditRequired: true,
  },
  addRiskSignals: {
    flags: ['PHI_DETECTED'],
    scores: { phi_risk: 0.85 },
  },
}
```

#### Select Top 2 Responses
```typescript
{
  selectStreams: {
    mode: 'top_n',
    n: 2,
  },
  addMetadata: {
    selectionReason: 'top_confidence',
  },
}
```

---

## 8. Database Schema

### 8.1 New Tables

#### workflow_condition_evaluations
Audit trail for all condition evaluations:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | VARCHAR | Tenant isolation |
| workflow_execution_id | VARCHAR | Execution reference |
| node_id | VARCHAR | Node that was evaluated |
| condition_id | VARCHAR | Condition definition |
| condition_type | VARCHAR | 'expression', 'ai_interpreted', 'composite' |
| stream_mode | VARCHAR | Evaluation mode used |
| passed | BOOLEAN | Final result |
| confidence | NUMERIC | Confidence score |
| stream_results | JSONB | Per-stream results |
| ai_interpretation | JSONB | AI reasoning (if applicable) |
| evaluation_duration_ms | INTEGER | Evaluation time |
| evaluation_cost_cents | NUMERIC | AI evaluation cost |
| envelope_id | UUID | Link to UEP envelope |

#### workflow_node_conditions
Stored condition definitions:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| condition_id | VARCHAR | Unique condition identifier |
| name | VARCHAR | Human-readable name |
| condition_type | VARCHAR | Type of condition |
| expression | TEXT | For expression conditions |
| ai_prompt | TEXT | For AI-interpreted conditions |
| stream_mode | VARCHAR | How to evaluate streams |
| on_true_action | JSONB | Action when true |
| on_false_action | JSONB | Action when false |
| envelope_transform | JSONB | Transform to apply |

#### workflow_uep_envelopes
Links workflow nodes to UEP storage:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| envelope_id | UUID | UEP envelope reference |
| workflow_execution_id | VARCHAR | Execution reference |
| node_id | VARCHAR | Node reference |
| trace_id | VARCHAR | Distributed trace |
| from_envelope_id | UUID | Parent envelope link |

### 8.2 Modified Tables

#### workflow_executions
Added columns:
- `root_envelope_id` - Root UEP envelope for workflow
- `trace_id` - Distributed tracing ID
- `workflow_span_id` - Root span for workflow
- `compliance_frameworks` - Active compliance frameworks

#### task_executions
Added columns:
- `input_envelope_id` - Input UEP envelope
- `output_envelope_id` - Output UEP envelope
- `span_id` - Node's span ID
- `condition_results` - Results of condition evaluations

---

## 9. Integration Guide

### 9.1 Starting a UEP-Aware Workflow

```typescript
import { workflowEngine } from './workflow-engine.js';

// Start with UEP support
const { executionId, traceId, workflowSpanId } = await workflowEngine.startExecutionWithUEP(
  'workflow-123',           // Workflow ID
  'document_analysis',      // Workflow code
  tenantId,
  userId,
  { document: 'content...' }, // Input parameters
  {
    enableUEP: true,
    complianceFrameworks: ['SOC2', 'GDPR'],
    traceId: existingTraceId,  // Optional: link to existing trace
  }
);
```

### 9.2 Executing Tasks with UEP

```typescript
// Get execution context
const context = await workflowEngine.getUEPContext(executionId);

// Execute task with UEP envelope
const { taskExecutionId, inputEnvelope } = await workflowEngine.executeTaskWithUEP(
  executionId,
  'task-001',
  'Extract Entities',
  'model_inference',
  inputData,
  context,
  previousEnvelope  // Optional: link to source
);

// ... perform AI model call ...

// Complete task with UEP
const outputEnvelope = await workflowEngine.completeTaskWithUEP(
  taskExecutionId,
  inputEnvelope,
  modelOutput,
  {
    status: 'completed',
    usage: {
      inputTokens: 150,
      outputTokens: 320,
      costCents: 0.5,
      latencyMs: 1200,
    },
    modelInfo: { modelId: 'claude-3-sonnet', mode: 'standard' },
  }
);
```

### 9.3 Evaluating Conditions

```typescript
import { uepNodeService } from './workflow/index.js';

// Define condition
const condition: NodeCondition = {
  conditionId: 'quality-check',
  name: 'Output Quality Check',
  type: 'ai_interpreted',
  aiPrompt: 'Is this extraction accurate and complete?',
  streamMode: 'any',
  onTrue: { type: 'continue' },
  onFalse: { type: 'retry', maxRetries: 2 },
};

// Evaluate
const result = await uepNodeService.evaluateCondition(
  condition,
  outputEnvelope,
  context
);

if (result.passed) {
  // Continue to next node
} else if (condition.onFalse?.type === 'retry') {
  // Handle retry logic
}
```

---

## 10. API Reference

### 10.1 UEPNodeService Methods

#### createInputEnvelope
```typescript
createInputEnvelope(
  nodeId: string,
  nodeName: string,
  nodeType: NodeType,
  input: unknown,
  context: NodeExecutionContext,
  sourceEnvelope?: WorkflowUEPEnvelope
): WorkflowUEPEnvelope
```

#### completeOutputEnvelope
```typescript
completeOutputEnvelope(
  envelope: WorkflowUEPEnvelope,
  output: unknown,
  options: {
    streams?: StreamOutput[];
    modelInfo?: { modelId, modelName?, mode?, provider?, modelsUsed? };
    usage: { inputTokens, outputTokens, totalTokens, costCents, latencyMs };
    riskSignals?: { overallRisk, scores, flags, evaluationResults? };
    metadata?: Record<string, unknown>;
  }
): WorkflowUEPEnvelope
```

#### evaluateCondition
```typescript
async evaluateCondition(
  condition: NodeCondition,
  envelope: WorkflowUEPEnvelope,
  context: NodeExecutionContext
): Promise<ConditionEvaluationResult>
```

#### applyEnvelopeTransform
```typescript
applyEnvelopeTransform(
  envelope: WorkflowUEPEnvelope,
  transform: EnvelopeTransform,
  evaluationResult?: ConditionEvaluationResult
): WorkflowUEPEnvelope
```

#### storeEnvelope
```typescript
async storeEnvelope(envelope: WorkflowUEPEnvelope): Promise<void>
```

### 10.2 WorkflowEngine UEP Methods

#### startExecutionWithUEP
```typescript
async startExecutionWithUEP(
  workflowId: string,
  workflowCode: string,
  tenantId: string,
  userId: string,
  inputParameters: Record<string, unknown>,
  options?: UEPExecutionOptions
): Promise<{ executionId: string; traceId: string; workflowSpanId: string }>
```

#### executeTaskWithUEP
```typescript
async executeTaskWithUEP(
  executionId: string,
  taskId: string,
  taskName: string,
  taskType: TaskType,
  input: unknown,
  context: NodeExecutionContext,
  sourceEnvelope?: WorkflowUEPEnvelope
): Promise<{ taskExecutionId: string; inputEnvelope: WorkflowUEPEnvelope }>
```

#### completeTaskWithUEP
```typescript
async completeTaskWithUEP(
  taskExecutionId: string,
  inputEnvelope: WorkflowUEPEnvelope,
  output: unknown,
  options: {
    status: TaskStatus;
    usage: { inputTokens, outputTokens, costCents, latencyMs };
    modelInfo?: { modelId, mode? };
    error?: { message, code? };
  }
): Promise<WorkflowUEPEnvelope>
```

---

## 11. Best Practices

### 11.1 Condition Design

**DO**:
- ✅ Write conditions that evaluate content quality
- ✅ Use expression conditions for structured output checks
- ✅ Use AI conditions for subjective quality assessment
- ✅ Set appropriate confidence thresholds
- ✅ Include fallback actions (retry, branch)

**DON'T**:
- ❌ Bind conditions to specific model IDs
- ❌ Assume output format from a specific model
- ❌ Use AI conditions for simple field checks (expensive)
- ❌ Set stream mode to 'all' without good reason

### 11.2 Stream Mode Selection

| Scenario | Recommended Mode |
|----------|------------------|
| Need any valid response | `any` |
| Need consistent quality | `majority` |
| Critical decision point | `unanimous` |
| Want best quality | `best` |
| Custom threshold | `quorum` with threshold |

### 11.3 Performance Optimization

1. **Use expression conditions** for simple checks (zero cost)
2. **Use fast models** for AI interpretation (`groq/llama-3.1-8b-instant`)
3. **Set minConfidence** to filter low-quality streams early
4. **Cache condition results** for repeated evaluations

---

## 12. Troubleshooting

### 12.1 Common Issues

#### Condition Always Fails
- Check expression syntax
- Verify output structure matches expected format
- Lower AI threshold if too strict
- Check stream mode (may need `any` instead of `all`)

#### High Evaluation Costs
- Switch to expression conditions where possible
- Use cheaper AI models for interpretation
- Reduce stream count in parallel execution
- Cache repeated condition evaluations

#### Missing Envelope Links
- Ensure `sourceEnvelope` is passed when creating new envelopes
- Check `fromEnvelopeId` in payload
- Verify trace/span IDs are propagated

### 12.2 Debugging

```sql
-- View condition evaluation history
SELECT 
  condition_name, 
  condition_type,
  stream_mode,
  passed,
  confidence,
  ai_interpretation,
  evaluation_duration_ms
FROM workflow_condition_evaluations
WHERE workflow_execution_id = 'exec-123'
ORDER BY created_at;

-- View UEP envelope trace
SELECT * FROM v_workflow_uep_trace
WHERE workflow_execution_id = 'exec-123'
ORDER BY step_order;

-- Check condition statistics
SELECT * FROM v_condition_evaluation_stats
WHERE tenant_id = 'tenant-123'
  AND evaluation_date >= NOW() - INTERVAL '7 days';
```

---

## 13. Subsystem UEP Integration Boundaries

Understanding which subsystems are UEP-aware and why:

### 13.1 UEP-Aware Subsystems (Produce Envelopes)

| Subsystem | Status | Integration Point | Why |
|-----------|--------|-------------------|-----|
| **Cato Methods** | ✅ Full | `CatoBaseMethodExecutor.storeToUEP()` | All pipeline methods wrap outputs |
| **Workflow Engine** | ✅ Full | `uep-node.service.ts` | All node I/O wrapped in envelopes |
| **Orchestration Methods** | ✅ Full | `executeMethodWithUEP()` | 70+ methods wrap outputs |
| **Model Router** | ✅ Full | `uepIntegrationService.wrapModelResponse()` | All model responses wrapped |
| **Brain Router** | ✅ Full | `uepIntegrationService.wrapBrainResponse()` | Domain-aware responses wrapped |
| **AGI Orchestrator** | ✅ Full | `uepIntegrationService.wrapAGIOrchestration()` | Multi-model orchestration |
| **Response Synthesis** | ✅ Full | `uepIntegrationService.wrapSynthesizedResponse()` | Ensemble/merge outputs |

### 13.2 Non-UEP Subsystems (Memory/Storage)

| Subsystem | Status | Reason |
|-----------|--------|--------|
| **Cortex** | ⚪ Not needed | Memory retrieval system - doesn't generate AI outputs. UEP wrapping happens when Cortex data is *used* in AI calls. |
| **UDS** | ⚪ Not needed | Storage layer - UEP envelopes are stored *in* UDS, not wrapped *by* it. |
| **Blackboard** | ⚪ Not needed | State coordination - distributes data, doesn't generate AI outputs. |

### 13.3 Architecture Decision

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        UEP ENVELOPE WRAPPING LAYER                          │
│                                                                              │
│   AI Generation ──────────────────────────────────────────▶ UEP Envelope   │
│   (Cato, Workflow, Orchestration, Model Router, Brain)                      │
│                                                                              │
└────────────────────────────────────────────────┬────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MEMORY/STORAGE LAYER                                  │
│                                                                              │
│   Cortex (retrieval) ◄──── Envelopes ────▶ UDS (storage)                   │
│                                                                              │
│   These systems HANDLE envelopes but don't PRODUCE them                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Rule**: UEP envelope wrapping happens at the **point of AI generation**, not at memory retrieval or storage. This keeps the boundary clean and avoids double-wrapping.

### 13.4 Using Orchestration Methods with UEP

```typescript
// NEW: With UEP envelope wrapping (recommended)
const result = await orchestrationMethodsService.executeMethodWithUEP(
  'semantic-entropy-service',
  { prompt: 'What is 2+2?', tenantId },
  { sample_count: 10 },
  {
    tenantId,
    userId,
    traceId: parentEnvelope.tracing.traceId,
    parentSpanId: parentEnvelope.tracing.spanId,
    complianceFrameworks: ['SOC2'],
  }
);

// result.envelope contains UEP envelope info
console.log(result.envelope.envelopeId); // UUID
console.log(result.output.uncertainty);   // 0.23

// LEGACY: Without UEP (still supported)
const rawResult = await orchestrationMethodsService.executeMethod(
  'semantic-entropy-service',
  { prompt: 'What is 2+2?', tenantId },
  { sample_count: 10 }
);
```

---

## 14. AI Curator UEP Integration

The Curator service uses AI for document extraction, question generation, and answer verification—all with full UEP tracing.

### 14.1 AI Curator Service

**Location**: `lambda/shared/services/curator/ai-curator.service.ts`

**Methods**:
- `extractKnowledge(request, context)` - AI-powered document extraction
- `generateExamQuestions(request, context)` - Generate entrance exam questions
- `verifyAnswer(request, context)` - Verify user answers with AI

### 14.2 UEP Envelope Types

| Operation | Envelope Type | Purpose |
|-----------|---------------|---------|
| Document extraction | `curator.extraction` | Track AI-extracted facts, entities, concepts |
| Question generation | `curator.question_generation` | Track generated exam questions |
| Answer verification | `curator.answer_verification` | Track AI verification results |

### 14.3 Usage Example

```typescript
import { aiCuratorService } from './curator/ai-curator.service';

// Extract knowledge from document
const extraction = await aiCuratorService.extractKnowledge({
  documentId: 'doc-123',
  documentContent: documentText,
  documentType: 'pdf',
  extractTypes: ['facts', 'entities', 'concepts'],
}, {
  tenantId,
  userId,
  traceId: parentTraceId,
  complianceFrameworks: ['SOC2'],
});

console.log(extraction.extractedItems);       // Array of ExtractedKnowledge
console.log(extraction.envelope.envelopeId);  // UEP envelope ID
console.log(extraction.envelope.stored);       // true if persisted

// Generate exam questions
const questions = await aiCuratorService.generateExamQuestions({
  knowledgeNodes: extraction.extractedItems,
  questionCount: 10,
  difficulty: 'medium',
  includeAmbiguity: true,
  includeLogicChecks: true,
}, { tenantId, userId });

// Verify an answer
const verification = await aiCuratorService.verifyAnswer({
  questionId: questions.questions[0].id,
  questionType: 'fact_check',
  statement: 'The CEO is John Smith',
  userAnswer: true,
  sourceContent: 'John Smith was appointed CEO in 2024...',
}, { tenantId, userId });

if (verification.shouldCreateGoldenRule) {
  // User correction should become a Golden Rule
  console.log(verification.goldenRuleReason);
}
```

---

## 15. UEP Self-Healing System

Ensures UEP data durability across system restarts and isolated failures.

### 15.1 Service Overview

**Location**: `lambda/shared/services/uep/self-healing.service.ts`

The self-healing service detects and repairs:
- Partially written S3 objects
- Uncommitted database records
- Orphaned envelopes
- Corrupted checksum mismatches
- Stale transactions
- Memory buffer leaks

### 15.2 Execution Modes

| Mode | Trigger | Use Case |
|------|---------|----------|
| `startup` | Lambda cold start / system boot | Recover from crashes |
| `scheduled` | EventBridge (every 15 min) | Proactive maintenance |
| `adhoc` | Admin API call | Manual troubleshooting |

### 15.3 Recovery Lambda

**Location**: `lambda/system/uep-recovery.ts`

**Admin API Endpoints**:
- `GET /api/admin/uep-recovery/status` - Buffer and healing status
- `POST /api/admin/uep-recovery/heal` - Trigger ad-hoc healing
- `GET /api/admin/uep-recovery/reports` - Recent healing reports
- `GET /api/admin/uep-recovery/quarantine` - View quarantined envelopes
- `POST /api/admin/uep-recovery/quarantine/:id/resolve` - Resolve quarantine

### 15.4 Memory Buffer Durability

```typescript
import { uepSelfHealingService } from './uep/index.js';

// Before async storage operation
uepSelfHealingService.registerPendingEnvelope(envelope);

try {
  await storeEnvelope(envelope);
  // On success, remove from buffer
  uepSelfHealingService.markEnvelopePersisted(envelope.envelopeId);
} catch (error) {
  // Record failure for retry
  uepSelfHealingService.recordWriteFailure(envelope.envelopeId, error.message);
}

// Check buffer status
const status = uepSelfHealingService.getBufferStatus();
console.log(status.pendingCount);        // Number of pending envelopes
console.log(status.oldestPendingAge);    // Age of oldest pending (ms)
console.log(status.failedAttempts);      // Envelopes with failed writes
```

### 15.5 Configuration

```typescript
uepSelfHealingService.updateConfig({
  maxRecoveryAttempts: 5,
  staleTransactionThresholdMinutes: 60,
  quarantineCorruptedData: true,
  autoRepairPartialWrites: true,
  flushMemoryBuffersOnStartup: true,
  verifyChecksumsOnRecovery: true,
});
```

### 15.6 Healing Report

After each healing run, a detailed report is stored:

```typescript
const report = await uepSelfHealingService.runHealing(tenantId, 'adhoc');

console.log(report.summary.totalIssuesFound);
console.log(report.summary.totalIssuesResolved);
console.log(report.summary.partialWritesRecovered);
console.log(report.summary.orphanedEnvelopesFixed);
console.log(report.summary.corruptedEnvelopesQuarantined);

// Individual issues
for (const issue of report.issues) {
  console.log(`${issue.type}: ${issue.description} - ${issue.resolution}`);
}
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2026-01-31 | Initial comprehensive documentation |
| 2.1 | 2026-01-31 | Added subsystem integration boundaries, orchestration methods UEP |
| 2.2 | 2026-01-31 | Added AI Curator UEP integration, Self-Healing system documentation |

---

*This document is part of RADIANT v5.52.58 - Universal Envelope Protocol Integration*


> **Version**: 2.0.0  
> **Last Updated**: January 31, 2026  
> **Status**: Production  
> **RADIANT Version**: 5.52.58+

## Table of Contents

1. [Overview](#overview)
2. [Envelope Structure](#envelope-structure)
3. [Integration Points](#integration-points)
4. [Storage Architecture](#storage-architecture)
5. [Compliance & Security](#compliance--security)
6. [API Reference](#api-reference)
7. [Migration Guide](#migration-guide)
8. [Best Practices](#best-practices)

---

## Overview

The Universal Envelope Protocol (UEP) v2.0 is RADIANT's standardized format for wrapping all AI interactions, method executions, and data flows. It provides:

- **Unified Tracing**: Distributed trace IDs across all services
- **Regulatory Compliance**: Built-in PHI/PII detection and retention policies
- **Tiered Storage**: Automatic Hot → Warm → Cold → Glacier transitions
- **Risk Signals**: Standardized safety and quality scoring
- **Audit Trail**: Complete history for compliance and debugging

### Key Benefits

| Benefit | Description |
|---------|-------------|
| **Observability** | End-to-end request tracing across microservices |
| **Compliance** | HIPAA, GDPR, SOC2, FDA, CCPA, PCI-DSS support |
| **Scale** | 1M+ concurrent users via UDS tiered storage |
| **Debugging** | Full pipeline replay and time-travel debugging |
| **Cost Tracking** | Per-request cost attribution |

---

## Envelope Structure

### Core Schema

```typescript
interface UEPEnvelope {
  envelopeId: string;          // UUID v4
  specversion: '2.0';          // Protocol version
  type: string;                // Event type (e.g., 'ai.model.response')
  source: UEPSource;           // Origin metadata
  payload: UEPPayload;         // Request/response data
  tracing: UEPTracing;         // Distributed tracing
  compliance?: UEPCompliance;  // Regulatory metadata
  riskSignals?: UEPRiskSignals; // Safety/quality scores
  extensions?: Record<string, unknown>; // Custom fields
}
```

### Source Block

```typescript
interface UEPSource {
  system: 'RADIANT';           // Always 'RADIANT'
  component: string;           // Service name
  version: string;             // RADIANT version
  tenantId: string;            // Tenant UUID
  userId?: string;             // User UUID (if authenticated)
  sessionId?: string;          // Session ID
}
```

**Component Values**:
- `model-router` - Model Router Service
- `cato-pipeline` - Cato Pipeline Orchestrator
- `agi-orchestrator` - AGI Orchestration Engine
- `cognitive-brain` - Brain Router Service
- `response-synthesis` - Response Synthesis Service
- `think-tank` - Think Tank Consumer App

### Payload Block

```typescript
interface UEPPayload {
  input: UEPInput;
  output?: UEPOutput;
  metadata?: Record<string, unknown>;
}

interface UEPInput {
  type: 'text' | 'multimodal' | 'structured';
  content: unknown;
  tokens?: number;
}

interface UEPOutput {
  type: 'text' | 'multimodal' | 'structured' | 'stream';
  content: unknown;
  tokens?: number;
  finishReason?: string;
}
```

### Tracing Block

```typescript
interface UEPTracing {
  traceId: string;             // 32-char hex (shared across pipeline)
  spanId: string;              // 16-char hex (unique per envelope)
  parentSpanId?: string;       // Parent span for hierarchies
  pipelineId?: string;         // Cato pipeline UUID
  methodId?: string;           // Cato method ID
  sequence?: number;           // Order in pipeline
  timestamp: string;           // ISO 8601
  durationMs?: number;         // Execution time
}
```

### Compliance Block

```typescript
interface UEPCompliance {
  frameworks: string[];        // ['HIPAA', 'GDPR', 'SOC2']
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  containsPHI: boolean;        // Detected by compliance service
  containsPII: boolean;        // Detected by compliance service
  retentionDays: number;       // Minimum retention period
  auditRequired: boolean;      // Requires audit log entry
}
```

### Risk Signals Block

```typescript
interface UEPRiskSignals {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  scores: {
    safety: number;            // 0.0 - 1.0
    compliance: number;        // 0.0 - 1.0
    quality: number;           // 0.0 - 1.0
    cost: number;              // 0.0 - 1.0
  };
  flags: string[];             // Risk indicators
  mitigations?: string[];      // Applied mitigations
}
```

---

## Integration Points

### 1. Model Router

All model responses are wrapped in UEP envelopes:

```typescript
import { uepIntegrationService } from './services/uep';

const response = await modelRouter.chat(request);
const envelope = uepIntegrationService.wrapModelResponse(
  tenantId,
  request,
  response,
  { traceId, complianceFrameworks: ['HIPAA'] }
);

// Store envelope
await uepIntegrationService.storeEnvelope(envelope);
```

### 2. Cato Pipeline

Pipeline methods use UEP v2.0 envelopes:

```typescript
// Create envelope for method input
const envelope = uepIntegrationService.createCatoEnvelope(
  tenantId,
  'method:observer:v1',
  { prompt, context },
  { pipelineId, traceId, sequence: 0 }
);

// Execute method...

// Complete envelope with output
const completed = uepIntegrationService.completeCatoEnvelope(
  envelope,
  { analysis, recommendations },
  { status: 'completed', durationMs: 1234 }
);
```

### 3. AGI Orchestrator

Multi-model orchestration results:

```typescript
const envelope = uepIntegrationService.wrapAGIOrchestration(
  tenantId,
  'council-of-rivals',
  { prompt, mode: 'debate' },
  { response, modelsUsed, totalTokens, totalCost, latencyMs },
  { sessionId, complianceFrameworks }
);
```

### 4. Brain Router

Domain-aware routing results:

```typescript
const envelope = uepIntegrationService.wrapBrainResponse(
  tenantId,
  { prompt, domain: 'medical', subdomain: 'cardiology' },
  { content, selectedModel, proficiencyScore, ... },
  { conversationId, traceId }
);
```

### 5. Response Synthesis

Multi-model synthesis results:

```typescript
const envelope = uepIntegrationService.wrapSynthesizedResponse(
  tenantId,
  'ensemble',
  modelResponses,
  { synthesizedResponse, confidence, reasoning, ... },
  { pipelineId }
);
```

---

## Storage Architecture

UEP envelopes use the UDS (User Data Service) tiered storage infrastructure:

```
Write Path:
  Envelope → Redis (hot) → Kinesis Queue → PostgreSQL (warm) → S3 (cold/glacier)

Read Path:
  ElastiCache → DynamoDB → PostgreSQL → S3
```

### Tier Configuration

| Tier | Storage | Retention | Latency | Use Case |
|------|---------|-----------|---------|----------|
| **Hot** | Redis/ElastiCache | 0-24h | <10ms | Active pipelines |
| **Warm** | Aurora PostgreSQL | 1-90 days | <100ms | Recent queries |
| **Cold** | S3 Standard-IA | 90d-7 years | 1-10s | Archived |
| **Glacier** | S3 Glacier | 7+ years | 1-12h | Compliance |

### Storage API

```typescript
// Store single envelope
await uepIntegrationService.storeEnvelope(envelope, {
  pipelineId,
  ttlSeconds: 86400,
});

// Store batch
await uepIntegrationService.storeEnvelopes(envelopes);

// Retrieve
const envelope = await uepIntegrationService.getEnvelope(tenantId, envelopeId);

// Query by pipeline
const envelopes = await uepIntegrationService.queryEnvelopes({
  tenantId,
  pipelineId,
  limit: 100,
});

// Query by trace
const trace = await uepIntegrationService.queryEnvelopes({
  tenantId,
  traceId,
});
```

### Database Schema

```sql
CREATE TABLE uds_envelopes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  specversion VARCHAR(10) DEFAULT '2.0',
  type VARCHAR(100) NOT NULL,
  source JSONB NOT NULL,
  payload JSONB NOT NULL,
  tracing JSONB,
  compliance JSONB,
  risk_signals JSONB,
  pipeline_id UUID,
  checksum VARCHAR(64) NOT NULL,
  current_tier VARCHAR(20) DEFAULT 'hot',
  s3_key VARCHAR(500),
  contains_phi BOOLEAN DEFAULT false,
  retention_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  -- Indexes for queries
  INDEX idx_tenant (tenant_id),
  INDEX idx_pipeline (pipeline_id),
  INDEX idx_trace ((tracing->>'traceId')),
  INDEX idx_tier (tenant_id, current_tier)
);
```

---

## Compliance & Security

### PHI/PII Detection

The compliance service automatically detects sensitive data:

```typescript
import { getComplianceService } from './services/uep';

const compliance = getComplianceService(pool);
const result = await compliance.scanEnvelope(envelope, ['HIPAA', 'GDPR']);

if (result.containsPHI) {
  // Apply HIPAA retention (6 years)
  envelope.compliance.retentionDays = 2190;
}
```

### Supported Frameworks

| Framework | Requirements |
|-----------|--------------|
| **HIPAA** | PHI encryption, 6-year retention, audit trails |
| **GDPR** | Consent tracking, data subject rights, portability |
| **SOC2** | Access controls, change management, monitoring |
| **FDA 21 CFR Part 11** | Electronic signatures, audit trails |
| **CCPA** | Consumer privacy rights |
| **PCI-DSS** | Payment data protection |

### Encryption

Envelopes can be encrypted at rest and in transit:

```typescript
import { getSecurityService } from './services/uep';

const security = getSecurityService(pool);

// Encrypt envelope
const encrypted = await security.encryptEnvelope(envelope, recipientKeyId);

// Sign envelope
const signed = await security.signEnvelope(envelope, signingKeyId);
```

---

## API Reference

### UEP Integration Service

```typescript
class UEPIntegrationService {
  // Model Router
  wrapModelResponse(tenantId, request, response, options): UEPEnvelope;
  
  // Cato Pipeline
  createCatoEnvelope(tenantId, methodId, input, options): UEPEnvelope;
  completeCatoEnvelope(envelope, output, options): UEPEnvelope;
  migrateCatoEnvelope(tenantId, v1Envelope, options): UEPEnvelope;
  
  // AGI Orchestrator
  wrapAGIOrchestration(tenantId, type, input, result, options): UEPEnvelope;
  
  // Brain Router
  wrapBrainResponse(tenantId, request, response, options): UEPEnvelope;
  
  // Response Synthesis
  wrapSynthesizedResponse(tenantId, type, inputs, result, options): UEPEnvelope;
  
  // Storage
  storeEnvelope(envelope, options): Promise<StoredEnvelope>;
  storeEnvelopes(envelopes, options): Promise<StoredEnvelope[]>;
  getEnvelope(tenantId, envelopeId): Promise<StoredEnvelope | null>;
  queryEnvelopes(options): Promise<StoredEnvelope[]>;
  
  // Tracing
  createChildSpan(parentEnvelope): { traceId, spanId, parentSpanId };
  linkEnvelopes(envelopes): UEPEnvelope[];
}
```

### UEP Storage Adapter

```typescript
class UEPUDSStorageAdapter {
  store(tenantId, envelope, options): Promise<StoredEnvelope>;
  storeBatch(tenantId, envelopes, options): Promise<StoredEnvelope[]>;
  get(tenantId, envelopeId): Promise<StoredEnvelope | null>;
  query(options): Promise<StoredEnvelope[]>;
  getTierHealth(tenantId): Promise<TierHealth>;
  runHousekeeping(tenantId): Promise<void>;
  archiveOldEnvelopes(tenantId): Promise<{ promoted, errors }>;
}
```

### UEP Compliance Service

```typescript
class UEPComplianceService {
  scanEnvelope(envelope, frameworks): Promise<ComplianceResult>;
  auditEnvelope(envelope, tenantId): Promise<AuditResult>;
  getFrameworkRequirements(framework): FrameworkRequirements;
}
```

---

## Migration Guide

### From Cato v1 Envelopes

```typescript
// Old v1 envelope
const v1Envelope: CatoMethodEnvelope = {
  envelopeId: 'abc-123',
  methodId: 'method:observer:v1',
  pipelineId: 'pipe-456',
  traceId: 'trace-789',
  input: { prompt: 'Hello' },
  output: { status: 'completed', data: { analysis: '...' } },
  riskSignals: { level: 'low', scores: { safety: 0.95 }, flags: [] },
  createdAt: '2026-01-31T00:00:00Z',
};

// Migrate to v2
const v2Envelope = uepIntegrationService.migrateCatoEnvelope(
  tenantId,
  v1Envelope,
  { complianceFrameworks: ['HIPAA'] }
);
```

### Database Migration

Run migration `V2026_01_31_001__uds_envelopes.sql` to create the envelope storage table.

---

## Best Practices

### 1. Always Include Trace IDs

```typescript
// Good: Pass trace ID through the call chain
const traceId = request.headers['x-trace-id'] || generateTraceId();
const envelope = createEnvelope(tenantId, input, { traceId });
```

### 2. Set Compliance Frameworks Early

```typescript
// Good: Set frameworks based on tenant config
const frameworks = tenant.hipaaEnabled ? ['HIPAA'] : [];
const envelope = createEnvelope(tenantId, input, { complianceFrameworks: frameworks });
```

### 3. Store Envelopes Asynchronously

```typescript
// Good: Fire-and-forget storage
uepIntegrationService.storeEnvelope(envelope).catch(err => 
  logger.warn('Envelope storage failed', { envelopeId: envelope.envelopeId, err })
);
```

### 4. Use Batch Storage for Pipelines

```typescript
// Good: Store all pipeline envelopes in batch
const envelopes = pipelineResults.map(r => r.envelope);
await uepIntegrationService.storeEnvelopes(envelopes);
```

### 5. Link Envelopes for Distributed Traces

```typescript
// Good: Link related envelopes
const linkedEnvelopes = uepIntegrationService.linkEnvelopes([
  observerEnvelope,
  validatorEnvelope,
  executorEnvelope,
]);
```

---

## File Reference

| File | Purpose |
|------|---------|
| `services/uep/index.ts` | Service exports |
| `services/uep/integration.service.ts` | Integration adapters for all services |
| `services/uep/uds-storage-adapter.service.ts` | UDS tiered storage integration |
| `services/uep/compliance.service.ts` | Regulatory compliance checks |
| `services/uep/security.service.ts` | Encryption and signing |
| `services/uep/stream-manager.service.ts` | Streaming envelope support |
| `services/uep/envelope-builder.service.ts` | Low-level envelope construction |
| `services/uep/migration.service.ts` | v1 → v2 migration utilities |
| `middleware/uep-middleware.ts` | Lambda/API middleware for UEP wrapping |
| `thinktank/uep-integration.ts` | Think Tank specific UEP integration |
| `services/cato-method-executor.service.ts` | Cato pipeline UEP integration |
| `migrations/000_consolidated_schema.sql` | Database schema |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2026-01-31 | UDS integration, platform-wide adoption |
| 1.5.0 | 2026-01-30 | Compliance service, tiered storage |
| 1.0.0 | 2026-01-15 | Initial Cato-only implementation |



---

*Consolidated from 5 source documents (0 not found). 5,991 source lines.*
