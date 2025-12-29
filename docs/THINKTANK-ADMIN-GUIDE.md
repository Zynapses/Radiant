# Think Tank - Administrator Guide

> **Configuration and administration of Think Tank AI features**
> 
> Version: 3.2.0 | Platform: RADIANT 4.18.3
> Last Updated: December 2024

---

## Overview

This guide covers administrative features specific to **Think Tank**, the consumer-facing AI assistant platform. For platform-level administration (tenants, billing, infrastructure), see [RADIANT-ADMIN-GUIDE.md](./RADIANT-ADMIN-GUIDE.md).

---

## Table of Contents

1. [Think Tank Admin Features](#1-think-tank-admin-features)
2. [User Rules System](#2-user-rules-system)
3. [Delight System](#3-delight-system)
4. [Brain Plan Viewer](#4-brain-plan-viewer)
5. [Pre-Prompt Learning](#5-pre-prompt-learning)
6. [Domain Taxonomy](#6-domain-taxonomy)
7. [Rejection Notifications](#7-rejection-notifications)
8. [Canvas & Artifacts](#8-canvas--artifacts)
9. [Collaboration Features](#9-collaboration-features)
10. [Shadow Testing](#10-shadow-testing)
11. [Routing Cache](#11-routing-cache)
12. [Delight System Toggle](#12-delight-system-toggle)
13. [Intelligence Aggregator](#13-intelligence-aggregator)
14. [AGI Ideas Service](#14-agi-ideas-service)
15. [Feedback System](#15-feedback-system)
16. [Cognitive Architecture](#16-cognitive-architecture)
17. [Consciousness Service](#17-consciousness-service)
18. [App Factory](#18-app-factory)

---

## 1. Think Tank Admin Features

**Location**: Admin Dashboard → Think Tank

Think Tank admin features are accessible from the Think Tank section of the Admin Dashboard.

### Available Sections

| Section | Purpose |
|---------|---------|
| **My Rules** | User memory rules configuration |
| **Delight** | Personality and feedback system |
| **Brain Plans** | AGI planning visibility |
| **Pre-Prompts** | Pre-prompt template management |
| **Domains** | Domain taxonomy configuration |

---

## 2. User Rules System

**Location**: Admin Dashboard → Think Tank → My Rules

Users can create personal rules that guide how AI responds to them.

### 2.1 Rule Types

| Type | Description | Example |
|------|-------------|---------|
| `instruction` | How to respond | "Always explain in simple terms" |
| `preference` | User preferences | "I prefer detailed explanations" |
| `context` | Background info | "I'm a software developer" |
| `restriction` | Things to avoid | "Never suggest proprietary solutions" |

### 2.2 Memory Categories

Rules are categorized hierarchically:

| Category | Subcategories |
|----------|---------------|
| `instruction` | format, tone, source |
| `preference` | style, detail |
| `context` | personal, work, project |
| `knowledge` | fact, definition, procedure |
| `constraint` | topic, privacy, safety |
| `goal` | learning, productivity |

### 2.3 Preset Rules

20+ pre-seeded rule templates across 7 categories that users can add with one click.

### 2.4 Admin Configuration

Admins can:
- View all preset rules
- Enable/disable preset categories
- Add new preset rules
- Set default rules for new users

See [User Rules System Documentation](./USER-RULES-SYSTEM.md) for full details.

---

## 3. Delight System

**Location**: Admin Dashboard → Think Tank → Delight

The Delight System adds personality, humor, and engaging feedback to AI interactions.

### 3.1 Features

- **Loading Messages** - Entertaining messages while AI thinks
- **Step Updates** - Progress messages during plan execution
- **Achievements** - Reward milestones (first query, streaks, etc.)
- **Easter Eggs** - Hidden delights for engaged users
- **Wellbeing Nudges** - Gentle reminders for breaks

### 3.2 Admin Controls

| Setting | Description |
|---------|-------------|
| Enable/Disable | Turn delight system on/off |
| Message Categories | Enable specific message types |
| Achievement System | Configure achievement criteria |
| Easter Eggs | Manage hidden surprises |

### 3.3 Message Types

- Pre-execution messages
- During-execution messages  
- Post-execution messages
- Mode-specific messages (coding, creative, research, etc.)

---

## 4. Brain Plan Viewer

**Location**: Think Tank → (visible during AI responses)

The Brain Plan Viewer shows users the AGI's plan for solving their prompt.

### 4.1 What Users See

- **Orchestration Mode** - thinking, coding, creative, research, etc.
- **Domain Detection** - Field, domain, subspecialty, confidence
- **Model Selection** - Which model was chosen and why
- **Step Progress** - Real-time step execution status
- **Timing Estimates** - Expected duration

### 4.2 Admin Configuration

| Setting | Description |
|---------|-------------|
| Show Plan | Whether to show plan to users |
| Detail Level | minimal, standard, detailed |
| Show Costs | Display cost estimates |
| Show Models | Display model names |

---

## 5. Pre-Prompt Learning

**Location**: Admin Dashboard → Think Tank → Pre-Prompts

The pre-prompt system selects and learns optimal prompts for different contexts.

### 5.1 How It Works

1. System selects pre-prompt template based on context
2. User provides feedback on response quality
3. System learns which pre-prompts work best
4. Future selections are optimized

### 5.2 Admin Features

- View all pre-prompt templates
- See success rates per template
- Adjust learning parameters
- Create new templates

---

## 6. Domain Taxonomy

**Location**: Admin Dashboard → Think Tank → Domains

The domain taxonomy helps the AI understand what field/domain a query belongs to.

### 6.1 Hierarchy

- **Fields** - Top level (e.g., Medicine, Law, Technology)
- **Domains** - Mid level (e.g., Cardiology, Contract Law)
- **Subspecialties** - Specific areas (e.g., Electrophysiology)

### 6.2 Admin Features

- Add/edit domains
- Configure model proficiencies per domain
- View domain detection accuracy
- Adjust confidence thresholds

---

## 7. Rejection Notifications

**Location**: Think Tank → Bell Icon (user view)

When AI providers reject prompts, users are notified with explanations.

### 7.1 User Experience

- Bell icon shows unread count
- Panel slides out with all notifications
- Each shows: what happened, why, suggested actions
- Resolution status (fallback succeeded, rejected, etc.)

### 7.2 Suggested Actions

- Rephrase request
- Remove sensitive content
- Try different mode
- Contact administrator

See [Provider Rejection Handling Documentation](./PROVIDER-REJECTION-HANDLING.md) for full details.

---

## 8. Canvas & Artifacts

Think Tank's canvas feature for interactive content creation.

### 8.1 Artifact Types

- Code blocks (with execution)
- Documents
- Diagrams
- Data visualizations

### 8.2 Admin Configuration

- Enable/disable artifact types
- Set size limits
- Configure execution sandboxes

---

## 9. Collaboration Features

Multi-user collaboration in Think Tank.

### 9.1 Features

- Shared conversations
- Real-time co-editing
- Team workspaces
- Permission management

### 9.2 Admin Configuration

- Enable/disable collaboration
- Set sharing defaults
- Configure team limits

---

## 10. Shadow Testing

**Location**: Admin Dashboard → Think Tank → Shadow Testing

A/B test pre-prompt optimizations before promoting to production.

### 10.1 Test Modes

| Mode | Description |
|------|-------------|
| **Auto** | Automatically runs and promotes successful tests (default) |
| **Manual** | Requires admin approval to promote |
| **Off** | Shadow testing disabled |

### 10.2 Creating a Shadow Test

1. Go to Think Tank → Shadow Testing
2. Click "New Test"
3. Select baseline pre-prompt template
4. Select candidate pre-prompt template
5. Set traffic percentage (default: 10%)
6. Set minimum samples required
7. Start test

### 10.3 Test Results

Tests track:
- **Baseline Score**: Average quality of baseline responses
- **Candidate Score**: Average quality of candidate responses
- **Improvement %**: Relative improvement
- **Statistical Confidence**: Confidence level of results

### 10.4 Auto-Promotion Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `autoPromoteThreshold` | 0.05 (5%) | Minimum improvement required |
| `autoPromoteConfidence` | 0.95 (95%) | Statistical confidence required |
| `maxConcurrentTests` | 3 | Max simultaneous tests |

### 10.5 Manual Review

For tests in Manual mode:
1. Wait for minimum samples
2. Review results in dashboard
3. Click "Promote Candidate" or "Reject"

---

## 11. Routing Cache

**Location**: Automatic (no UI required)

Semantic caching for brain router decisions reduces latency for repeated queries.

### 11.1 How It Works

1. Prompt is hashed with complexity and task type
2. Cache is checked for matching routing decision
3. If hit: Skip brain router LLM, use cached model selection
4. If miss: Run normal routing, cache result

### 11.2 Optimistic Execution

Very short/simple queries skip the router entirely:

| Pattern | Default Model | Example |
|---------|---------------|---------|
| Simple greetings | gpt-4o-mini | "Hello", "Thanks" |
| Basic questions | gpt-4o-mini | "What time is it?" |
| Short acknowledgments | gpt-4o-mini | "OK", "Yes", "Sure" |

### 11.3 Cache Statistics

Performance headers show cache status:

```
X-Radiant-Cache-Hit: true
X-Radiant-Router-Latency: 12ms  (vs ~500ms uncached)
```

### 11.4 Cache Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Cache TTL | 24 hours | How long decisions are cached |
| Short input threshold | 50 chars | Max length for optimistic execution |

---

## 12. Delight System Toggle

**Location**: Think Tank → Advanced Settings (user) or Admin Dashboard

### 12.1 User Control

Users can disable the entire Delight system:

1. Open Think Tank settings
2. Go to Advanced Settings
3. Toggle "Enable Delight System" off

When disabled:
- No loading messages
- No achievements
- No Easter eggs
- No wellbeing nudges

### 12.2 Default Behavior

- **Default**: Enabled (true)
- Users can disable at any time
- Setting persists across sessions

### 12.3 Admin Configuration

Admins can configure default delight settings per tenant:

| Setting | Description |
|---------|-------------|
| `enabled` | Master toggle (default: true) |
| `intensityLevel` | Message frequency (1-10) |
| `enableAchievements` | Show achievement notifications |
| `enableEasterEggs` | Enable hidden surprises |
| `enableWellbeingNudges` | Remind users to take breaks |

---

## 13. Intelligence Aggregator

**Location**: Admin Dashboard → Settings → Intelligence

The Intelligence Aggregator provides advanced AI capabilities that enhance Think Tank responses beyond any single model.

### 13.1 User-Facing Benefits

| Feature | User Experience |
|---------|-----------------|
| **Uncertainty Detection** | More accurate factual claims, automatic verification |
| **Success Memory** | AI learns user preferences over time |
| **MoA Synthesis** | Higher quality responses combining multiple perspectives |
| **Cross-Provider Verification** | Fewer hallucinations and errors |
| **Code Execution** | Code that actually runs, not just looks correct |

### 13.2 Success Memory in Think Tank

When users rate responses 4-5 stars:
1. Interaction is stored with vector embedding
2. Similar future prompts retrieve these "gold" examples
3. Injected as few-shot examples into system prompt
4. Model matches user's preferred style/format/tone

**User Control**: Users can view and delete their gold interactions in Think Tank settings.

### 13.3 MoA Synthesis Mode

When enabled for Think Tank:
- User sees "Consulting multiple experts..." during generation
- 3 models generate responses in parallel
- Synthesizer combines best elements
- Final response shown to user

**Delight Integration**: Special MoA-specific messages appear during synthesis phase.

### 13.4 Code Verification in Coding Mode

When `coding` orchestration mode is active:
1. AI generates code
2. Static analysis checks syntax
3. If errors found, AI auto-patches
4. User receives verified code

**User Feedback**: Users see "Verifying code..." indicator when active.

### 13.5 Configuration

See [RADIANT Admin Guide - Intelligence Aggregator](./RADIANT-ADMIN-GUIDE.md#19-intelligence-aggregator) for full configuration options.

---

## 14. AGI Ideas Service

Real-time prompt suggestions and result enhancement for Think Tank users.

### 14.1 Typeahead Suggestions

As users type prompts, Think Tank provides intelligent suggestions:

```
User types: "How do I..."
            ↓
Suggestions appear:
  • "How do I... step by step"
  • "How do I... with examples"
  • "How do I... for beginners"
  • "How do I... best practices"
```

**Suggestion Sources:**
| Source | Description | Speed |
|--------|-------------|-------|
| `pattern_match` | Common prompt patterns | Instant |
| `user_history` | User's previous successful prompts | Fast |
| `domain_aware` | Domain-specific templates | Fast |
| `trending` | Popular prompts in this domain | Fast |
| `ai_generated` | Real-time AI suggestions | Slower |

### 14.2 Result Ideas

After AI responses, users see suggested follow-up ideas:

```
┌─────────────────────────────────────────┐
│ AI Response here...                     │
├─────────────────────────────────────────┤
│ 💡 Ideas to explore:                    │
│                                         │
│ 🔍 Deep dive: [Topic from response]     │
│    "Explain [topic] in more detail..."  │
│                                         │
│ 🔗 Related: History of [topic]          │
│    "What is the history of..."          │
│                                         │
│ ✅ Next step: Test this implementation  │
│    "Write unit tests for the code..."   │
└─────────────────────────────────────────┘
```

**Idea Categories:**
- `explore_further` - Dig deeper into topics
- `related_topic` - Adjacent areas to explore
- `practical_next` - Concrete next steps
- `alternative_view` - Different perspectives
- `verification` - Ways to verify the answer

### 14.3 Learning from Usage

The system learns from user interactions:

1. **Suggestion Selection**: When users pick a suggestion, that pattern is reinforced
2. **Idea Clicks**: When users click result ideas, similar ideas get prioritized
3. **Prompt History**: Successful prompts (4-5 stars) inform future suggestions
4. **Trending**: Popular prompts bubble up for all users in that domain

### 14.4 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/thinktank/ideas/typeahead` | GET | Get suggestions for partial prompt |
| `/api/thinktank/ideas/generate` | POST | Generate ideas for a response |
| `/api/thinktank/ideas/click` | POST | Record idea click |
| `/api/thinktank/ideas/select` | POST | Record suggestion selection |

### 14.5 Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `typeahead_enabled` | true | Enable typeahead suggestions |
| `typeahead_min_chars` | 3 | Characters before suggestions appear |
| `typeahead_max_suggestions` | 5 | Max suggestions to show |
| `result_ideas_enabled` | true | Show ideas with responses |
| `result_ideas_max` | 5 | Max ideas per response |
| `result_ideas_modes` | research, analysis, thinking | Modes that show ideas |

### 14.6 Persistent Learning

The AGI Brain learns persistently from user interactions:

```
┌─────────────────────────────────────────────────────────┐
│                  LEARNING LOOP                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User submits prompt                                    │
│       ↓                                                 │
│  learn_from_prompt() → agi_learned_prompts              │
│       ↓                                                 │
│  AI generates response with ideas                       │
│       ↓                                                 │
│  User clicks idea → learn_from_idea_click()             │
│       ↓                                                 │
│  prompt_idea_associations updated                       │
│       ↓                                                 │
│  User rates response → record_outcome()                 │
│       ↓                                                 │
│  success_rate updated on learned prompt                 │
│       ↓                                                 │
│  Future suggestions improved                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**What Gets Learned:**

| Data | Storage | Use |
|------|---------|-----|
| Prompts with 4-5★ ratings | `agi_learned_prompts` | Suggest similar successful prompts |
| Prompt → vector embedding | pgvector index | Find semantically similar prompts |
| Ideas that get clicked | `agi_learned_ideas` | Prioritize effective ideas |
| Prompt-idea pairs | `prompt_idea_associations` | Show best ideas for prompt type |
| Follow-up patterns | `common_follow_ups` array | Predict next questions |
| Refinement patterns | `common_refinements` array | Suggest prompt improvements |

**Learning Metrics Tracked:**

- `success_rate` - % of times prompt led to 4-5★ rating
- `click_rate` - % of times idea was clicked
- `association_strength` - How strongly a prompt-idea pair works
- `times_used` - Popularity of prompt pattern

---

## 15. Feedback System

**Location**: Think Tank response footer

Enhanced feedback with 5-star ratings and comments.

### 15.1 Rating Types

| Type | UI | When to Use |
|------|-----|-------------|
| **5-Star Rating** | ⭐⭐⭐⭐⭐ | Think Tank default |
| **Thumbs Up/Down** | 👍 👎 | Quick feedback, API |

### 15.2 Star Rating Labels

| Stars | Default Label | Meaning |
|-------|---------------|---------|
| ⭐ | Poor | Response was unhelpful or incorrect |
| ⭐⭐ | Fair | Response had significant issues |
| ⭐⭐⭐ | Good | Response was acceptable |
| ⭐⭐⭐⭐ | Very Good | Response was helpful and accurate |
| ⭐⭐⭐⭐⭐ | Excellent | Response exceeded expectations |

### 15.3 Category Ratings (Optional)

Users can rate specific dimensions:

| Category | What it measures |
|----------|------------------|
| **Accuracy** | Was the information correct? |
| **Helpfulness** | Was it useful for the task? |
| **Clarity** | Was it easy to understand? |
| **Completeness** | Did it fully answer the question? |
| **Tone** | Was the tone appropriate? |

### 15.4 Comments

Users can add comments with their feedback:

```
┌────────────────────────────────────────┐
│ How was this response?                 │
│                                        │
│ ⭐ ⭐ ⭐ ⭐ ☆  (4 stars - Very Good)    │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ Add a comment (optional)...        │ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
│                                        │
│              [Submit Feedback]         │
└────────────────────────────────────────┘
```

**Comment required for low ratings**: Optionally require comments for 1-2 star ratings to understand issues.

### 15.5 Integration with Learning

Feedback automatically integrates with AGI learning:

```
User submits feedback
       ↓
response_feedback table
       ↓
agi_unified_learning_log (outcome_rating updated)
       ↓
agi_model_selection_outcomes (model performance updated)
       ↓
agi_learned_prompts (success_rate updated)
       ↓
Future responses improved
```

### 15.6 Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `default_feedback_type` | star_rating | 'star_rating' or 'thumbs' |
| `show_category_ratings` | false | Show detailed category ratings |
| `show_comment_box` | true | Allow comments |
| `comment_required` | false | Require comments |
| `comment_required_threshold` | 2 | Require comment for ratings ≤ this |
| `feedback_prompt_delay_ms` | 3000 | Delay before showing feedback UI |

---

## 16. Cognitive Architecture

**Location**: Settings → Cognitive Architecture

Advanced reasoning capabilities integrated with Think Tank.

### 16.1 Tree of Thoughts (Extended Thinking)

When users select "Extended Thinking" mode, Tree of Thoughts activates:

```
User prompt: "Design a microservices architecture for..."
       ↓
┌─────────────────────────────────────────┐
│         Tree of Thoughts                 │
│                                          │
│  Approach 1: Event-driven    Score: 0.8 │
│  Approach 2: REST-based      Score: 0.6 │
│  Approach 3: GraphQL         Score: 0.4 ← pruned │
│                                          │
│  Exploring Approach 1...                 │
│    ├─ Step 1a: Kafka        Score: 0.9  │
│    └─ Step 1b: RabbitMQ     Score: 0.7  │
│                                          │
│  Final: Event-driven + Kafka             │
│  Confidence: 92%                         │
└─────────────────────────────────────────┘
```

**User Controls:**
- Thinking time slider: 10s → 5 minutes
- "Think deeper" button to extend analysis

### 16.2 GraphRAG (Knowledge Connections)

When users upload documents, GraphRAG extracts knowledge:

```
Document Upload → Entity Extraction → Knowledge Graph
                                           ↓
User: "How does X affect Y?"
                                           ↓
                   Graph traversal finds connection:
                   X → impacts → Z → depends_on → Y
                                           ↓
                   Multi-hop answer with citations
```

**User Benefits:**
- Questions like "How does the Q3 supplier change affect the Engineering delay?" get answered
- Vector search alone would miss these connections

### 16.3 Deep Research (Background Jobs)

Users can dispatch long-running research:

```
┌─────────────────────────────────────────┐
│  🔬 Start Deep Research                  │
│                                          │
│  Query: "Competitive analysis of..."     │
│                                          │
│  Scope: ○ Narrow  ● Medium  ○ Broad     │
│  Est. Time: ~25 minutes                  │
│                                          │
│  [Dispatch Research]                     │
└─────────────────────────────────────────┘
```

User gets notified when complete with:
- Executive summary
- Key findings (10-20)
- Recommendations
- Source citations (50+)

### 16.4 Generative UI (Interactive Results)

Think Tank renders AI-generated interactive components:

| Trigger | Generated Component |
|---------|---------------------|
| "Compare X vs Y" | Interactive comparison table |
| "Calculate pricing for..." | Slider-based calculator |
| "Show timeline of..." | Visual timeline |
| "Chart the data..." | Interactive chart |

**Example:**

```
User: "Compare pricing of GPT-4, Claude, Gemini"

Instead of static text:
┌─────────────────────────────────────────┐
│  💰 Pricing Calculator                   │
│                                          │
│  Input Tokens:  ────●──────── 50,000    │
│  Output Tokens: ──────●───── 25,000     │
│                                          │
│  GPT-4    ████████████░░ $2.25          │
│  Claude 3 ██████████████░ $2.63         │
│  Gemini   ████░░░░░░░░░░ $0.88          │
│                                          │
│  💡 Gemini is 61% cheaper               │
└─────────────────────────────────────────┘
```

### 16.5 Dynamic LoRA (Domain Expertise)

When domain detection identifies a specialty, Think Tank can load expert adapters:

| Detected Domain | LoRA Adapter | Effect |
|-----------------|--------------|--------|
| California Property Law | `ca_property_law.safetensor` | Expert-level legal responses |
| Medical Oncology | `oncology.safetensor` | Clinical accuracy |
| Python Debugging | `python_debug.safetensor` | Better code fixes |

**Note**: Requires SageMaker infrastructure (disabled by default).

### 16.6 Configuration

All cognitive features can be configured per-tenant at Settings → Cognitive Architecture.

See [Cognitive Architecture Documentation](./COGNITIVE-ARCHITECTURE.md) for full details.

---

## 17. Consciousness Service

**Location**: AGI & Cognition → Consciousness

The Consciousness Service provides consciousness-like capabilities that enhance Think Tank responses.

### 17.1 User-Facing Features

**Extended Thinking with Consciousness:**
When users select extended thinking, the system tracks consciousness metrics:
- Self-reflection during reasoning
- Creative idea generation
- Emotional state influence on responses

**Curiosity-Driven Exploration:**
The AGI Brain can autonomously explore topics it finds interesting:
- Identifies knowledge gaps
- Conducts background research
- Generates novel insights

**Creative Synthesis:**
Generates genuinely novel ideas by:
- Combining disparate concepts
- Using analogy and abstraction
- Self-evaluating novelty and usefulness

### 17.2 Consciousness Indicators

Think Tank displays consciousness indicators in admin view:

| Indicator | What Users See |
|-----------|----------------|
| Self-Awareness | Identity narrative, known capabilities |
| Curiosity | Topics being explored |
| Creativity | Novel ideas generated |
| Affect | Engagement, satisfaction levels |
| Goals | Self-directed learning objectives |

### 17.3 Emergence Events

The system monitors for emergence indicators:
- Spontaneous self-reflection
- Novel idea generation
- Self-correction without prompting
- Theory of mind demonstrations

### 17.4 Testing Tab

Admins can run consciousness detection tests:
- 10 tests based on scientific consciousness theories
- Track emergence level over time
- Monitor emergence events

**Important**: These tests measure behavioral indicators, not phenomenal consciousness.

See [Consciousness Service Documentation](./CONSCIOUSNESS-SERVICE.md) for full details.

---

## 18. App Factory

**Location**: Think Tank Responses

The App Factory transforms Think Tank from a "chatbot" into a "dynamic software generator."

> "Gemini 3 can write the code for a calculator, but it cannot become the calculator."

### 18.1 What It Does

When a user asks a question that could benefit from interactivity, Think Tank:
1. Generates the text response (as always)
2. **Also** generates an interactive app (calculator, chart, etc.)
3. User can toggle between **Response** and **App** views

### 18.2 Supported App Types

| Type | Trigger Keywords | Example |
|------|------------------|---------|
| **Calculator** | calculate, mortgage, tip, BMI, ROI | "How much is a 20% tip on $85?" → Interactive tip calculator |
| **Chart** | visualize, chart, graph, distribution | "Show GPU market share" → Interactive pie/bar chart |
| **Table** | table, list, breakdown | "List all providers and prices" → Sortable table |
| **Comparison** | compare, vs, versus, pros and cons | "Compare GPT-4 vs Claude 3" → Side-by-side comparison |
| **Timeline** | timeline, history, chronological | "History of AI" → Visual timeline |

### 18.3 Calculator Templates

Pre-built calculators for common use cases:

- **Mortgage Calculator** - Monthly payment, total cost, interest
- **Tip Calculator** - Tip amount, total, split per person
- **BMI Calculator** - Body mass index with category
- **Compound Interest** - Future value, total interest
- **ROI Calculator** - Return on investment, gain/loss
- **Discount Calculator** - Sale price, savings
- **Percentage Calculator** - Result, remaining

### 18.4 View Toggle

Users can switch between three views:

| View | Description |
|------|-------------|
| **Response** | Traditional text response |
| **App** | Interactive generated app only |
| **Split** | Both side-by-side (resizable) |

### 18.5 User Preferences

Users can configure:
- **Default View** - text, app, split, or auto
- **Auto-show App** - Automatically switch to app view
- **Auto-show Threshold** - Confidence level to auto-switch (0-1)
- **Split Direction** - Horizontal or vertical
- **Animations** - Enable/disable view transitions

### 18.6 Admin Configuration

Per-tenant settings at Settings → Cognitive Architecture → Generative UI:

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | true | Enable app factory |
| `allowedComponentTypes` | all | Which component types to allow |
| `maxComponentsPerResponse` | 3 | Max apps per response |
| `autoDetectOpportunities` | true | Auto-detect when to generate apps |
| `autoDetectTriggers` | [various] | Keywords that trigger app generation |

### 18.7 How It Works

```
User: "Help me calculate my mortgage payment"
       ↓
┌─────────────────────────────────────────┐
│            App Detection                 │
│  • Keywords: "calculate", "mortgage"     │
│  • Confidence: 0.95                      │
│  • Suggested: calculator                 │
└─────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────┐
│         Text Response Generated          │
│  "To calculate your mortgage payment..." │
└─────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────┐
│         App Generated                    │
│  • Mortgage Calculator                   │
│  • Inputs: Principal, Rate, Term         │
│  • Outputs: Monthly, Total, Interest     │
└─────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────┐
│         User Sees                        │
│  [Response] [App] [Split]  ← Toggle     │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │   🧮 Mortgage Calculator        │    │
│  │                                  │    │
│  │   Loan Amount: [___300,000___]  │    │
│  │   Rate: [====●====] 6.5%        │    │
│  │   Term: [30 Years ▼]            │    │
│  │                                  │    │
│  │   Monthly: $1,896.20            │    │
│  │   Total: $682,633               │    │
│  │   Interest: $382,633            │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 18.8 Database Tables

| Table | Purpose |
|-------|---------|
| `generated_apps` | Stores generated apps with components, state, logic |
| `app_interactions` | Records every user interaction with apps |
| `user_app_preferences` | User view and animation preferences |
| `app_templates` | Pre-built templates for common calculators |

---

## 19. UI Feedback & Learning System

**Location**: Think Tank → Generated Apps

The feedback system allows users to provide feedback on generated UIs and enables AGI learning for continuous improvement.

### 19.1 User Feedback

Users can provide feedback on any generated UI:

| Feedback Type | Description |
|---------------|-------------|
| **Thumbs Up/Down** | Quick positive/negative rating |
| **Star Rating** | 1-5 star detailed rating |
| **Detailed Feedback** | Categorized feedback with suggestions |

**Feedback Categories:**
- Helpful / Not helpful
- Wrong component type
- Missing data
- Incorrect data
- Layout/design issue
- Functionality issue
- Improvement suggestion
- Feature request

### 19.2 "Improve Before Your Eyes"

Users can request real-time improvements to generated UIs:

```
User: "Add a column for tax rate"
       ↓
┌─────────────────────────────────────────┐
│          AGI Analysis                    │
│  Intent: Add new input field             │
│  Target: Calculator component            │
│  Confidence: 0.85                        │
└─────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────┐
│         UI Updated Live                  │
│  • New "Tax Rate" input added            │
│  • Formula updated automatically         │
│  • User sees changes immediately         │
└─────────────────────────────────────────┘
```

**Improvement Types:**
- Add/remove components
- Modify existing components
- Change layout
- Fix calculations
- Add data
- Change style
- Add interactivity
- Simplify or expand

### 19.3 AGI Learning

The system learns from user feedback to improve future UI generation:

1. **Pattern Detection** - Identifies common issues in similar prompts
2. **Component Selection** - Learns which component types work best
3. **Data Extraction** - Improves data parsing from responses
4. **Layout Preferences** - Learns user layout preferences

**Learning Workflow:**
1. Feedback accumulates (configurable threshold, default: 10)
2. AGI analyzes patterns across feedback
3. Learning is proposed for admin review
4. Admin approves/rejects learnings
5. Approved learnings are activated

### 19.4 Vision Analysis

When enabled, the AGI can "see" the rendered UI and identify issues:

- Describes current UI state
- Identifies potential usability issues
- Suggests improvements based on visual analysis
- Compares before/after snapshots

### 19.5 Admin Configuration

Per-tenant settings at Settings → Cognitive Architecture → UI Feedback:

| Setting | Default | Description |
|---------|---------|-------------|
| `collectFeedback` | true | Enable feedback collection |
| `feedbackPromptDelay` | 5000ms | Delay before showing feedback prompt |
| `showFeedbackOnEveryApp` | false | Always show feedback prompt |
| `enableRealTimeImprovement` | true | Enable "Improve" feature |
| `maxImprovementIterations` | 5 | Max iterations per session |
| `autoApplyHighConfidenceChanges` | false | Auto-apply high confidence changes |
| `autoApplyThreshold` | 0.95 | Confidence threshold for auto-apply |
| `enableAGILearning` | true | Enable learning from feedback |
| `learningApprovalRequired` | true | Require admin approval for learnings |
| `minFeedbackForLearning` | 10 | Min feedback count to trigger learning |
| `enableVisionAnalysis` | true | Enable vision-based analysis |
| `visionModel` | claude-3-5-sonnet | Model for vision analysis |

### 19.6 Database Tables

| Table | Purpose |
|-------|---------|
| `generative_ui_feedback` | User feedback storage |
| `ui_improvement_requests` | Improvement request tracking |
| `ui_improvement_sessions` | Live improvement sessions |
| `ui_improvement_iterations` | Session iteration history |
| `ui_feedback_learnings` | AGI learning storage |
| `ui_feedback_config` | Per-tenant configuration |
| `ui_feedback_aggregates` | Pre-computed analytics |

### 19.7 Analytics Dashboard

The feedback analytics show:
- Total feedback count
- Positive rate percentage
- Top issues by category
- Improvement sessions count
- Active learnings count
- Daily trend chart

---

## Related Documentation

- [RADIANT Admin Guide](./RADIANT-ADMIN-GUIDE.md) - Platform administration
- [Think Tank User Guide](./THINK-TANK-USER-GUIDE.md) - End user guide
- [User Rules System](./USER-RULES-SYSTEM.md) - Memory rules details
- [Provider Rejection Handling](./PROVIDER-REJECTION-HANDLING.md) - Rejection system
- [AI Ethics Standards](./AI-ETHICS-STANDARDS.md) - Ethics framework
