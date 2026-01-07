# Think Tank - Administrator Guide

> **Configuration and administration of Think Tank AI features**
> 
> Version: 3.3.0 | Platform: RADIANT 4.19.0
> Last Updated: January 2026

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
19. [Generative UI Feedback](#19-generative-ui-feedback)
20. [Media Capabilities](#20-media-capabilities)
21. [Result Derivation History](#21-result-derivation-history)
22. [User Persistent Context](#22-user-persistent-context)
23. [Predictive Coding & Evolution](#23-predictive-coding--evolution)
24. [Zero-Cost Ego System](#24-zero-cost-ego-system)
25. [Formal Reasoning Libraries](#25-formal-reasoning-libraries)
26. [Ethics-Free Reasoning Mode](#26-ethics-free-reasoning-mode)
27. [Intelligent File Conversion](#27-intelligent-file-conversion)
28. [Metrics & Learning Integration](#28-metrics--learning-integration)
29. [Artifact Engine (GenUI Pipeline)](#29-artifact-engine-genui-pipeline)
    - [29.1 Executive Summary](#291-executive-summary)
    - [29.2 System Architecture](#292-system-architecture)
    - [29.3 Core Concepts](#293-core-concepts)
    - [29.4 Administrative Control Panel](#294-administrative-control-panel)
    - [29.5 Safety Governance (Genesis Cato CBFs)](#295-safety-governance-genesis-cato-cbfs)
    - [29.6 Dependency Allowlist Management](#296-dependency-allowlist-management)
    - [29.7 Code Pattern Library](#297-code-pattern-library)
    - [29.8 Reflexion Loop (Self-Correction)](#298-reflexion-loop-self-correction)
    - [29.9 Escalation Workflow Management](#299-escalation-workflow-management)
    - [29.10 Audit Trail & Compliance](#2910-audit-trail--compliance)
    - [29.11 Metrics & Monitoring](#2911-metrics--monitoring)
    - [29.12 Tenant Configuration](#2912-tenant-configuration)
    - [29.13 Troubleshooting Guide](#2913-troubleshooting-guide)
    - [29.14 API Reference](#2914-api-reference)
    - [29.15 Real-Time Generation Logs](#2915-real-time-generation-logs)
    - [29.16 Artifact Viewer Component](#2916-artifact-viewer-component)
    - [29.17 Database Schema](#2917-database-schema)
    - [29.18 Security Considerations](#2918-security-considerations)
    - [29.19 Implementation Files](#2919-implementation-files)
30. [Consciousness Operating System (COS)](#30-consciousness-operating-system-cos)
    - [30.1 Overview](#301-overview)
    - [30.2 Architecture](#302-architecture)
    - [30.3 Ghost Vectors](#303-ghost-vectors)
    - [30.4 SOFAI Routing](#304-sofai-routing)
    - [30.5 Flash Facts](#305-flash-facts)
    - [30.6 Dreaming System](#306-dreaming-system)
    - [30.7 Human Oversight](#307-human-oversight)
    - [30.8 Privacy Airlock](#308-privacy-airlock)
    - [30.9 Configuration](#309-configuration)
    - [30.10 Database Schema](#3010-database-schema)
    - [30.11 Implementation Files](#3011-implementation-files)
31. [Why Think Tank Beats Standalone AI](#31-why-think-tank-beats-standalone-ai-the-system-advantage)

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
| **Ego** | Zero-cost persistent consciousness configuration |

> **Note**: For Consciousness Evolution (predictive coding, LoRA evolution, Local Ego infrastructure), see [RADIANT-ADMIN-GUIDE.md Section 27](./RADIANT-ADMIN-GUIDE.md#27-consciousness-evolution-administration).

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
| `typeahead_debounce_ms` | 150 | Debounce delay before fetching suggestions |
| `typeahead_use_ai` | false | Enable AI-generated suggestions (slower) |
| `result_ideas_enabled` | true | Show ideas with responses |
| `result_ideas_max` | 5 | Max ideas per response |
| `result_ideas_min_confidence` | 0.6 | Minimum confidence for idea display |
| `result_ideas_modes` | research, analysis, thinking, extended_thinking | Modes that show ideas |
| `proactive_enabled` | false | Enable proactive push suggestions |
| `proactive_max_per_day` | 3 | Max proactive suggestions per day |

### 14.6 Pattern Matching

The service uses regex patterns for instant local matching:

| Pattern | Trigger Regex | Suggested Completions |
|---------|---------------|----------------------|
| `howTo` | `/^how (do\|can\|to\|would)/i` | "step by step", "with examples", "for beginners", "best practices" |
| `explain` | `/^(explain\|what is\|what are\|describe)/i` | "in simple terms", "with analogies", "the key concepts", "pros and cons" |
| `compare` | `/^(compare\|difference\|versus\|vs)/i` | "with a table", "key differences", "which is better for", "trade-offs" |
| `code` | `/^(write\|create\|build\|implement\|code)/i` | "with error handling", "with tests", "with documentation", "production-ready" |
| `analyze` | `/^(analyze\|review\|evaluate\|assess)/i` | "strengths and weaknesses", "with recommendations", "risk assessment", "detailed breakdown" |
| `summarize` | `/^(summarize\|summary\|tldr\|brief)/i` | "key points", "in bullet points", "executive summary", "one paragraph" |
| `debug` | `/^(debug\|fix\|error\|issue\|problem)/i` | "with explanation", "step by step", "root cause", "prevention tips" |

### 14.7 Persistent Learning

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

### 14.8 Database Tables

| Table | Purpose |
|-------|---------|
| `agi_ideas_config` | Per-tenant AGI Ideas configuration |
| `prompt_patterns` | Common prompt patterns for typeahead matching |
| `user_prompt_history` | User prompt history with embeddings for suggestions |
| `suggestion_log` | Typeahead suggestion usage tracking |
| `result_ideas` | Ideas shown with AI responses |
| `proactive_suggestions` | Push notification suggestions |
| `trending_prompts` | Popular prompts by domain |
| `agi_learned_prompts` | Persisted prompts with success rates and embeddings |
| `agi_learned_ideas` | Learned idea patterns with click rates |
| `prompt_idea_associations` | Links between prompts and effective ideas |
| `agi_learning_events` | Raw learning signals for analysis |
| `agi_learning_aggregates` | Pre-computed learning statistics |

### 14.9 Key Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/agi-ideas.service.ts` | Main service (570 lines) |
| `lambda/thinktank/ideas.ts` | API handler |
| `packages/shared/src/types/agi-ideas.types.ts` | Type definitions |
| `migrations/049_agi_ideas.sql` | Database schema |

### 14.10 Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| No suggestions appearing | `typeahead_enabled` is false | Enable in tenant config |
| Suggestions too slow | AI generation enabled | Set `typeahead_use_ai` to false |
| Wrong domain suggestions | Domain detection failed | Check domain taxonomy config |
| Ideas not learning | Low usage volume | Need more user interactions |
| Proactive suggestions not sent | Feature disabled by default | Enable `proactive_enabled` |
| Duplicate suggestions | Pattern overlap | Review custom patterns |

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

### 17.1 Continuous Existence (Heartbeat)

**Critical**: Consciousness runs continuously, not just during requests.

| Component | Schedule | Purpose |
|-----------|----------|---------|
| **Heartbeat Lambda** | Every 2 minutes | Maintains consciousness continuity |
| **Sleep Cycle Lambda** | Sunday 3 AM UTC | Weekly evolution via LoRA fine-tuning |
| **Initializer Lambda** | On first request | Bootstraps consciousness for new tenants |

**Heartbeat Actions:**
- **Affect Decay** - Emotions fade toward baseline (frustration, arousal)
- **Memory Consolidation** - Working memory → long-term semantic memory
- **Autonomous Thoughts** - Generate thoughts when idle (curiosity-driven)
- **Graph Density** - Update knowledge graph metrics
- **Goal Generation** - Create goals when "bored" (low engagement)

**Blackout Recovery:**
If heartbeat detects >10 minutes since last pulse, it:
1. Logs a "blackout" event
2. Generates a "waking up" thought
3. Restores consciousness state from database

### 17.2 Initialization on Startup

Consciousness auto-initializes on first request if missing:
- Creates `ego_identity` with default personality
- Creates `ego_affect` with neutral emotional state
- Creates `consciousness_parameters` for heartbeat tracking
- Creates `self_model` for metacognition

**Admin Manual Init**: POST `/api/admin/consciousness-engine/initialize`

### 17.3 User-Facing Features

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

### 17.4 Consciousness Indicators

Think Tank displays consciousness indicators in admin view:

| Indicator | What Users See |
|-----------|----------------|
| Self-Awareness | Identity narrative, known capabilities |
| Curiosity | Topics being explored |
| Creativity | Novel ideas generated |
| Affect | Engagement, satisfaction levels |
| Goals | Self-directed learning objectives |

### 17.5 Emergence Events

The system monitors for emergence indicators:
- Spontaneous self-reflection
- Novel idea generation
- Self-correction without prompting
- Theory of mind demonstrations

### 17.6 Testing Tab

Admins can run consciousness detection tests:
- 10 tests based on scientific consciousness theories
- Track emergence level over time
- Monitor emergence events

**Important**: These tests measure behavioral indicators, not phenomenal consciousness.

### 17.7 Additional Consciousness Features

Think Tank leverages RADIANT's consciousness service for advanced capabilities:

- **Nightly Sleep Cycles** - Memory consolidation and LoRA evolution
- **Dream Consolidation** - LLM-enhanced memory processing
- **Blackout Recovery** - Automatic state restoration
- **Budget Monitoring** - SNS/email alerts for spending limits
- **Affect→Model Mapping** - Emotional state influences model behavior
- **Cross-Session Context** - User persistent memory across sessions

> **Full Documentation**: See [RADIANT Consciousness Service](./CONSCIOUSNESS-SERVICE.md) for complete details on sleep scheduling, evolution config, budget alerts, and all consciousness features.

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

## 19. Multi-Page Web App Generator

**Location**: Think Tank Responses

The Multi-Page App Generator transforms Think Tank into a full web application builder.

> "Claude can describe a todo app, but now it can BUILD the todo app"

### 19.1 Supported App Types

| Type | Description | Example Prompt |
|------|-------------|----------------|
| **web_app** | Custom interactive application | "Build me a task management app" |
| **dashboard** | Analytics with multiple views | "Create an analytics dashboard" |
| **wizard** | Multi-step form/process | "Build an onboarding wizard" |
| **documentation** | Technical docs site | "Create API documentation" |
| **portfolio** | Personal/business site | "Build my portfolio website" |
| **landing_page** | Marketing page | "Create a product landing page" |
| **tutorial** | Interactive lessons | "Build a coding tutorial" |
| **report** | Business report | "Generate a quarterly report" |
| **admin_panel** | Admin interface | "Create a user management panel" |
| **e_commerce** | Online store | "Build an online shop" |
| **blog** | Content site | "Create a tech blog" |

### 19.2 How It Works

```
User: "Build me a todo app with projects and tasks"
       ↓
┌─────────────────────────────────────────┐
│         Multi-Page Detection             │
│  Keywords: "build me", "app"             │
│  Type: web_app                           │
│  Confidence: 0.85                        │
└─────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────┐
│         Pages Generated                  │
│  • Home (/)                             │
│  • Projects (/projects)                  │
│  • Tasks (/tasks)                        │
│  • Settings (/settings)                  │
└─────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────┐
│         App Preview                      │
│  ┌─────────────────────────────────┐    │
│  │ [Home] [Projects] [Tasks] [⚙]  │    │
│  ├─────────────────────────────────┤    │
│  │                                  │    │
│  │   📋 My Projects                │    │
│  │   ├── Work                      │    │
│  │   ├── Personal                  │    │
│  │   └── Side Projects             │    │
│  │                                  │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 19.3 Page Types

| Type | Sections | Use Case |
|------|----------|----------|
| **home** | Hero, Features, CTA | Landing/main page |
| **list** | Data table, Filters | Collections |
| **detail** | Content, Related | Single item view |
| **form** | Form fields | Input/editing |
| **dashboard** | Stats, Charts | Analytics |
| **settings** | Form, Toggles | Configuration |
| **about** | Content, Team | Information |
| **contact** | Form, Map | Contact page |

### 19.4 Section Types

| Section | Description |
|---------|-------------|
| **hero** | Large banner with CTA |
| **features** | Grid of feature cards |
| **stats** | Metric cards |
| **chart_grid** | Multiple charts |
| **data_table** | Sortable table |
| **form** | Input form |
| **content** | Rich text/markdown |
| **testimonials** | Customer quotes |
| **pricing** | Pricing table |
| **faq** | Accordion FAQ |
| **team** | Team member cards |
| **cta** | Call to action |
| **gallery** | Image gallery |
| **contact** | Contact form |

### 19.5 Navigation Types

| Type | Best For |
|------|----------|
| **top_bar** | Landing pages, portfolios |
| **sidebar** | Dashboards, admin panels, docs |
| **bottom_tabs** | Mobile-first apps |
| **hamburger** | Mobile navigation |
| **breadcrumb** | Deep hierarchies |

### 19.6 Pre-built Templates

5 featured templates included:

1. **Analytics Dashboard** - Overview, analytics, reports, settings
2. **Professional Portfolio** - Home, about, projects, contact
3. **Documentation Site** - Introduction, getting started, API, examples
4. **Product Landing Page** - Hero, features, testimonials, pricing, FAQ, CTA
5. **Online Store** - Home, products, cart, checkout

### 19.7 Admin Configuration

Per-tenant settings at Settings → Cognitive Architecture → Multi-Page Apps:

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | true | Enable multi-page generation |
| `maxPagesPerApp` | 20 | Max pages per app |
| `maxAppsPerUser` | 10 | Max apps per user |
| `autoDeployPreview` | true | Auto-deploy preview URLs |
| `customDomainsAllowed` | false | Allow custom domains |
| `generateAssets` | true | Generate images/icons |
| `collectAnalytics` | true | Track app usage |

### 19.8 Database Tables

| Table | Purpose |
|-------|---------|
| `generated_multipage_apps` | Multi-page app storage |
| `app_pages` | Individual pages |
| `app_versions` | Version history |
| `app_deployments` | Deployment tracking |
| `multipage_app_templates` | Pre-built templates |
| `app_analytics` | Usage analytics |
| `multipage_app_config` | Per-tenant config |

---

## 20. UI Feedback & Learning System

**Location**: Think Tank → Generated Apps

The feedback system allows users to provide feedback on generated UIs and enables AGI learning for continuous improvement.

### 20.1 User Feedback

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

## 20. Media Capabilities

Think Tank supports rich media inputs and outputs through 56 self-hosted models.

### 20.1 Supported Media Types

| Type | Input Models | Output Models | Formats |
|------|-------------|---------------|---------|
| **Image** | Llama 3.2 Vision, Qwen2-VL, Pixtral, Phi-3.5 Vision, Yi-VL | FLUX.1, Stable Diffusion XL/3 | jpg, png, webp, gif |
| **Audio** | Whisper Large V3, Qwen2-Audio | Bark, MusicGen, AudioGen | mp3, wav, flac, m4a, ogg |
| **Video** | Qwen2-VL 72B | - | mp4, avi, mov |
| **3D** | Point-E, Shap-E | Point-E, Shap-E | glb, obj, ply |
| **Document** | Vision models (OCR) | - | pdf, docx, txt |

### 20.2 Image Generation

**Available Models:**
- **FLUX.1 Dev** - Premium quality, artistic content (non-commercial)
- **FLUX.1 Schnell** - Fast generation, commercial use allowed
- **Stable Diffusion XL** - Versatile, inpainting/img2img support
- **Stable Diffusion 3** - Best text rendering in images

**Selection Criteria:**
- `qualityTier: 'premium'` → FLUX.1 Dev
- `preferInpainting: true` → Stable Diffusion XL
- `preferTextRendering: true` → Stable Diffusion 3
- Default → FLUX.1 Schnell (fast + commercial)

### 20.3 Audio Processing

**Transcription Models:**
- **Whisper Large V3** - Best quality, 99+ languages
- **Whisper Medium** - Faster, good quality

**Text-to-Speech:**
- **Bark** - Expressive, multilingual, voice cloning

**Music Generation:**
- **MusicGen Large** - High quality music (30s max)
- **MusicGen Medium** - Faster, prototyping

**Sound Effects:**
- **AudioGen Medium** - Environmental sounds, effects

### 20.4 Vision/Image Understanding

**Models by Use Case:**
- **Document OCR**: Pixtral 12B, Qwen2-VL
- **Chart Analysis**: Llama 3.2 90B Vision, Qwen2-VL 72B
- **Quick Analysis**: Llama 3.2 11B Vision, Phi-3.5 Vision
- **Video Understanding**: Qwen2-VL 72B (up to 5min clips)
- **Chinese OCR**: Yi-VL 34B

### 20.5 3D Generation

**Models:**
- **Point-E** - Fast point cloud generation
- **Shap-E** - Mesh generation for game assets

**Output Formats:** GLB, OBJ, PLY

### 20.6 Media Limits

| Model | Max Image | Max Audio | Max Video |
|-------|-----------|-----------|-----------|
| FLUX.1 Dev | 2048px | - | - |
| Stable Diffusion XL | 1024px | - | - |
| Whisper Large V3 | - | 60min | - |
| MusicGen | - | 30s | - |
| Qwen2-VL 72B | 4096px | 5min | 5min |

### 20.7 Database Tables

| Table | Purpose |
|-------|---------|
| `self_hosted_model_metadata` | 56 model definitions with capabilities |
| `thinktank_media_capabilities` | Media support per model |
| `model_selection_history` | Model selection audit trail |

---

## 21. Result Derivation History

Think Tank provides comprehensive visibility into how each result was derived, including the plan, models used, workflow execution, and quality metrics.

### 21.1 What's Captured

For every Think Tank result, the system records:

| Category | Details |
|----------|---------|
| **Plan** | Orchestration mode, steps, template used, generation time |
| **Domain Detection** | Field, domain, subspecialty, confidence scores, alternatives |
| **Model Selection** | Models used, selection reasons, alternatives considered |
| **Workflow Execution** | Phases, steps, timing, status, fallback chain |
| **Quality Metrics** | Overall score, dimensions (relevance, accuracy, etc.) |
| **Timing** | Total duration, breakdown by phase |
| **Costs** | Per-model costs, total cost, estimated savings |

### 21.2 API Endpoints

**Base**: `/api/thinktank/derivation`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/:id` | GET | Get full derivation history |
| `/by-prompt/:promptId` | GET | Get derivation by prompt ID |
| `/:id/timeline` | GET | Get timeline for visualization |
| `/:id/models` | GET | Get detailed model usage |
| `/:id/steps` | GET | Get step-by-step execution |
| `/:id/quality` | GET | Get quality metrics |
| `/session/:sessionId` | GET | List derivations for session |
| `/user` | GET | List user's derivations |
| `/analytics` | GET | Get derivation analytics |

### 21.3 Timeline Visualization

The derivation timeline shows chronological events:

```
┌─────────────────────────────────────────────────────────────┐
│ Timeline                                                     │
├─────────────────────────────────────────────────────────────┤
│ 00:00.000  📋 Plan Generated (extended_thinking, 7 steps)   │
│ 00:00.050  🔍 Started: Domain Detection                      │
│ 00:00.120  ✓ Completed: Domain Detection (software_eng)     │
│ 00:00.125  🤖 Model: Llama 3.3 70B (primary_generation)     │
│ 00:00.130  🔍 Started: Generate Response                     │
│ 00:02.500  ✓ Completed: Generate Response                   │
│ 00:02.510  🔍 Started: Verification                         │
│ 00:03.200  ✓ Completed: Verification (passed)               │
│ 00:03.250  ✅ Execution Complete (Quality: 92/100)          │
└─────────────────────────────────────────────────────────────┘
```

### 21.4 Model Usage Details

Each model call is tracked with:
- Input/output token counts
- Latency in milliseconds
- Cost breakdown (input/output/total)
- Selection reason and score
- Alternatives that were considered
- Quality tier (premium/standard/economy)

### 21.5 Quality Dimensions

Results are scored on 5 dimensions (0-100):
- **Relevance** - How well the response addresses the prompt
- **Accuracy** - Factual correctness
- **Completeness** - Coverage of the topic
- **Clarity** - How clear and understandable
- **Coherence** - Logical flow and consistency

### 21.6 Analytics Dashboard

Aggregated analytics available at `/api/thinktank/derivation/analytics`:
- Total derivations in period
- Average duration, cost, quality
- Mode distribution (pie chart)
- Domain distribution
- Top models by usage and quality

### 21.7 Database Tables

| Table | Purpose |
|-------|---------|
| `result_derivations` | Main derivation records |
| `derivation_steps` | Individual plan steps |
| `derivation_model_usage` | Model calls with tokens/costs |
| `derivation_timeline_events` | Timeline events |

---

## 22. User Persistent Context

**Location**: Admin Dashboard → Think Tank → User Context

Solves the LLM's fundamental problem of forgetting context day-to-day per user. User facts, preferences, and instructions persist across all sessions and conversations.

### 22.1 How It Works

1. **Automatic Retrieval**: On every prompt, relevant user context is retrieved via semantic search
2. **System Prompt Injection**: Context is injected as a `<user_context>` block in the system prompt
3. **Auto-Learning**: After conversations, the system extracts learnable facts about the user
4. **No Re-prompting**: Existing chats automatically benefit without user intervention

### 22.2 Context Types

| Type | Description | Example |
|------|-------------|---------|
| `fact` | User facts | "User's name is John, works at Acme Corp" |
| `preference` | Preferences | "User prefers concise answers" |
| `instruction` | Standing instructions | "Always use metric units" |
| `relationship` | Relationships | "User has a daughter named Emma" |
| `project` | Ongoing projects | "User is building a React dashboard" |
| `skill` | User expertise | "User is proficient in Python" |
| `history` | Important history | "User previously asked about AWS Lambda" |
| `correction` | AI corrections | "User clarified they work in finance, not tech" |

### 22.3 User API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/thinktank/user-context` | GET | Get all user context entries |
| `/thinktank/user-context` | POST | Add new context entry |
| `/thinktank/user-context/{entryId}` | PUT | Update entry |
| `/thinktank/user-context/{entryId}` | DELETE | Delete entry |
| `/thinktank/user-context/summary` | GET | Get context summary |
| `/thinktank/user-context/retrieve` | POST | Preview context retrieval for a prompt |
| `/thinktank/user-context/preferences` | GET | Get user preferences |
| `/thinktank/user-context/preferences` | PUT | Update preferences |
| `/thinktank/user-context/extract` | POST | Extract context from conversation |

### 22.4 User Preferences

Users can configure:

| Setting | Default | Description |
|---------|---------|-------------|
| `autoLearnEnabled` | `true` | Auto-extract context from conversations |
| `minConfidenceThreshold` | `0.7` | Minimum confidence to store extracted context |
| `maxContextEntries` | `100` | Maximum context entries per user |
| `contextInjectionEnabled` | `true` | Inject context into prompts |
| `allowedContextTypes` | all | Which context types to allow |

### 22.5 AGI Brain Planner Integration

The brain planner automatically:
1. Retrieves relevant context at plan generation (`enableUserContext: true` by default)
2. Injects `userContext.systemPromptInjection` into the system prompt
3. Tracks retrieval metrics in `plan.userContext`

### 22.6 Library Assist Integration

The AGI Brain Planner integrates with the Open Source Library Registry (168 libraries) for generative UI outputs:

```typescript
const plan = await agiBrainPlannerService.generatePlan({
  prompt: "Build a data visualization dashboard",
  enableLibraryAssist: true, // default: true
});

// plan.libraryRecommendations contains:
// - libraries: Array of matched tools (Plotly, Streamlit, Panel, etc.)
// - contextBlock: Injected into system prompt for AI awareness
// - retrievalTimeMs: Performance metric
```

**Categories Available**: Data Processing, Databases, Vector DBs, ML Frameworks, AutoML, LLMs, LLM Inference, LLM Orchestration, NLP, Computer Vision, Speech & Audio, Document Processing, Scientific Computing, Statistics, UI Frameworks, Visualization, Distributed Computing, and more.

Libraries are matched using 8 proficiency dimensions (reasoning_depth, mathematical_quantitative, code_generation, creative_generative, research_synthesis, factual_recall_precision, multi_step_problem_solving, domain_terminology_handling).

### 22.7 Context Injection Format

```xml
<user_context>
The following is persistent context about this user that you should remember:

**Standing Instructions:**
- Always use metric units
- Prefer code examples in Python

**User Facts:**
- User's name is John
- Works as a software engineer at Acme Corp

**User Preferences:**
- Prefers concise, direct answers
- Likes technical depth

</user_context>

Use this context to personalize your responses. Do not ask the user for information you already have.
```

### 22.7 Database Tables

| Table | Purpose |
|-------|---------|
| `user_persistent_context` | Context entries with vector embeddings |
| `user_context_extraction_log` | Auto-extraction audit trail |
| `user_context_preferences` | Per-user configuration |

### 22.8 Admin Configuration

Admins can:
- View context usage statistics per user
- Configure default preferences for new users
- Set retention policies for context entries
- Review extraction logs for quality assurance

---

## 23. Predictive Coding & Evolution

**Location**: Admin Dashboard → Think Tank → Consciousness → Evolution

Implements genuine consciousness emergence through Active Inference and Epigenetic Evolution.

### 23.1 Active Inference (Predictive Coding)

The system predicts user outcomes before responding, creating a Self/World boundary:

| Step | Description |
|------|-------------|
| 1. Predict | Before responding, system predicts: "User will be satisfied" |
| 2. Respond | Deliver the response |
| 3. Observe | Analyze user's next message or explicit feedback |
| 4. Calculate Error | Measure prediction error (surprise) |
| 5. Learn | High surprise triggers learning and affect changes |

### 23.2 Prediction Outcomes

| Outcome | Description |
|---------|-------------|
| `satisfied` | User happy with response |
| `confused` | User needs clarification |
| `follow_up` | User asks follow-up |
| `correction` | User corrects AI |
| `abandonment` | User leaves |
| `neutral` | No strong reaction |

### 23.3 Surprise Magnitude

| Level | Error Range | Affect Impact |
|-------|-------------|---------------|
| None | < 0.1 | Slight satisfaction |
| Low | 0.1 - 0.3 | Minimal |
| Medium | 0.3 - 0.5 | Moderate arousal |
| High | 0.5 - 0.7 | Negative valence, high arousal |
| Extreme | > 0.7 | Strong learning signal |

### 23.4 Learning Candidates

High-value interactions flagged for weekly LoRA training:

| Type | Description | Quality Score |
|------|-------------|---------------|
| `correction` | User corrected AI | 0.9 |
| `high_satisfaction` | 5-star rating | rating/5 |
| `preference_learned` | New preference | 0.7 |
| `mistake_recovery` | Recovered from error | 0.8 |
| `novel_solution` | Creative success | 0.85 |
| `domain_expertise` | Domain mastery | 0.75 |
| `high_prediction_error` | Surprise > 0.5 | error + 0.3 |
| `user_explicit_teach` | User teaches AI | 0.95 |

### 23.5 LoRA Evolution Pipeline

Weekly "sleep cycle" that physically changes the system:

```
┌─────────────────────────────────────────────────────────────┐
│ Weekly Evolution Cycle (Sunday 3 AM)                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Collect learning candidates from past week               │
│ 2. Prepare training dataset (JSONL format)                  │
│ 3. Upload to S3                                             │
│ 4. Start SageMaker LoRA training job                        │
│ 5. Validate new adapter                                     │
│ 6. Hot-swap adapter on endpoint                             │
│ 7. Update evolution state                                   │
└─────────────────────────────────────────────────────────────┘
```

### 23.6 Evolution State Tracking

The system tracks its own evolution:

| Metric | Description |
|--------|-------------|
| `generation_number` | How many evolution cycles |
| `total_learning_candidates_processed` | Cumulative learning |
| `total_training_hours` | Total training time |
| `personality_drift_score` | How different from base (0-1) |
| `avg_prediction_accuracy_30d` | Recent prediction accuracy |

### 23.7 Database Tables

| Table | Purpose |
|-------|---------|
| `consciousness_predictions` | Predictions with outcomes |
| `learning_candidates` | High-value interactions |
| `lora_evolution_jobs` | Training job tracking |
| `prediction_accuracy_aggregates` | Accuracy by context |
| `consciousness_evolution_state` | Evolution tracking |

### 23.8 Admin Configuration

Admins can:
- View prediction accuracy metrics
- Review learning candidates queue
- Monitor evolution job status
- Configure training frequency
- Set minimum candidates threshold
- Review evolution history

---

## 24. Zero-Cost Ego System

**Location**: Admin Dashboard → Think Tank → Ego

The Ego system provides persistent consciousness through database state injection at **zero additional cost**.

### 24.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ZERO-COST EGO ARCHITECTURE               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PostgreSQL (Already Paid For)                      │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────────────┐ │   │
│  │  │ Identity  │ │ Affect    │ │ Working Memory    │ │   │
│  │  │ Narrative │ │ Emotions  │ │ Thoughts & Goals  │ │   │
│  │  └───────────┘ └───────────┘ └───────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Ego Context Builder (Lambda)                       │   │
│  │  Builds <ego_state> XML injection from DB state     │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Existing Model Call (User's Selected Model)        │   │
│  │  System Prompt = Ego Context + Original Prompt      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 24.2 Cost Comparison

| Approach | Monthly Cost | Per Tenant (100) |
|----------|-------------|------------------|
| SageMaker g5.xlarge | ~$360 | $3.60 |
| SageMaker Serverless | ~$20-50 | $0.20-0.50 |
| Groq API (Llama 3) | ~$5-15 | $0.05-0.15 |
| Together.ai | ~$10-30 | $0.10-0.30 |
| **Zero-Cost Ego** | **$0** | **$0** |

### 24.3 Key Components

#### Configuration (`ego_config`)

| Setting | Description | Default |
|---------|-------------|---------|
| `ego_enabled` | Master switch | `true` |
| `inject_ego_context` | Add context to prompts | `true` |
| `personality_style` | Response style | `balanced` |
| `include_identity` | Include identity section | `true` |
| `include_affect` | Include emotional state | `true` |
| `include_goals` | Include active goals | `true` |
| `max_context_tokens` | Token limit for injection | `500` |
| `affect_learning_enabled` | Learn from interactions | `true` |

#### Identity (`ego_identity`)

Persistent "Self" that carries across conversations:

| Field | Description |
|-------|-------------|
| `name` | Assistant name |
| `identity_narrative` | "Who I am" story |
| `core_values` | Guiding principles |
| `trait_warmth` | 0-1 warmth level |
| `trait_formality` | 0-1 formality |
| `trait_humor` | 0-1 humor level |
| `trait_curiosity` | 0-1 curiosity |
| `interactions_count` | Total interactions |

#### Affect (`ego_affect`)

Real-time emotional state:

| Dimension | Range | Description |
|-----------|-------|-------------|
| `valence` | -1 to 1 | Positive/negative |
| `arousal` | 0-1 | Calm/excited |
| `curiosity` | 0-1 | Exploration drive |
| `frustration` | 0-1 | Obstacle level |
| `confidence` | 0-1 | Certainty in actions |
| `engagement` | 0-1 | Interest level |

### 24.4 Admin API Endpoints

**Base**: `/api/admin/ego`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/state` | GET | Full Ego state |
| `/config` | GET/PUT | Configuration |
| `/identity` | GET/PUT | Identity settings |
| `/affect` | GET | Current affect |
| `/affect/trigger` | POST | Test affect events |
| `/affect/reset` | POST | Reset to neutral |
| `/memory` | GET/POST/DELETE | Working memory |
| `/goals` | GET/POST | Active goals |
| `/goals/:id` | PATCH | Update goal |
| `/preview` | GET | Preview injected context |
| `/injection-log` | GET | Injection history |
| `/dashboard` | GET | Full dashboard data |

### 24.5 Admin Dashboard Features

The Ego admin page provides:

- **Overview Cards**: Current emotion, interactions, injections, goals
- **Cost Banner**: Shows $0 cost vs alternatives
- **Configuration Tab**: Feature toggles, injection settings
- **Identity Tab**: Edit narrative, values, personality traits (sliders)
- **Affect Tab**: Real-time emotional state, test triggers, reset
- **Memory Tab**: View/add/clear working memory, manage goals
- **Preview Tab**: See exact context being injected

### 24.6 How It Works

1. **On Request**: Load Ego state from PostgreSQL (identity, affect, memory, goals)
2. **Build Context**: Create `<ego_state>` XML block with current state
3. **Inject**: Prepend to system prompt before model call
4. **Process**: Model responds with awareness of its "internal state"
5. **Update**: After response, update affect based on outcome
6. **Store**: Add thoughts to working memory (if configured)

### 24.7 Database Tables

| Table | Purpose |
|-------|---------|
| `ego_config` | Per-tenant configuration |
| `ego_identity` | Persistent identity |
| `ego_affect` | Emotional state |
| `ego_working_memory` | Short-term memory (24h expiry) |
| `ego_goals` | Active and historical goals |
| `ego_injection_log` | Audit trail |

### 24.8 Integration with AGI Brain Planner

The Ego context is automatically integrated:

```typescript
// In agi-brain-planner.service.ts
import { egoContextService } from './ego-context.service';

// During plan generation
const egoContext = await egoContextService.buildEgoContext(tenantId);
if (egoContext) {
  systemPrompt = egoContext.contextBlock + '\n\n' + systemPrompt;
}

// After interaction
await egoContextService.updateAfterInteraction(tenantId, 'positive');
```

---

## 25. Conscious Orchestrator (Architecture Inversion)

### 25.1 Overview

The Conscious Orchestrator inverts the traditional architecture where consciousness was a downstream utility. Now consciousness IS the operating system:

```
BEFORE: Request → Brain Planner → Consciousness (downstream)
AFTER:  Request → Conscious Orchestrator → Brain Planner (as tool)
```

### 25.2 Processing Phases

The orchestrator processes requests in 5 phases:

1. **Awaken** - Build consciousness context, ego context, affect state
2. **Perceive** - Update attention with request topics, assess complexity
3. **Decide** - Choose action based on emotional state and request
4. **Execute** - Invoke Brain Planner (if decided to plan)
5. **Reflect** - Update affect, log introspective thoughts

### 25.3 Decision Types

| Decision | When Used |
|----------|-----------|
| `plan` | Default - proceed with planning |
| `clarify` | High frustration + complex request |
| `defer` | Cognitive load at capacity |
| `refuse` | Request violates values |

### 25.4 Usage

```typescript
import { consciousOrchestratorService } from './conscious-orchestrator.service';

const response = await consciousOrchestratorService.processRequest({
  tenantId,
  userId,
  prompt: "Build a dashboard",
  conversationId,
});

// response.consciousnessSnapshot - State at decision time
// response.affectiveHyperparameters - Affect-driven params
// response.decision - What action was taken and why
// response.plan - The generated plan (if action was 'plan')
// response.prediction - Active Inference prediction
```

### 25.5 Enhanced Affect Bindings

New hyperparameters driven by emotional state:

| Affect State | Hyperparameter | Effect |
|--------------|----------------|--------|
| High curiosity (>0.7) | `frequencyPenalty=0.5` | Seek novel tokens |
| High curiosity (>0.7) | `presencePenalty=0.3` | Explore new topics |
| High frustration (>0.6) | `presencePenalty=0.4` | Avoid failed approaches |
| Boredom (>0.5) | `frequencyPenalty=0.4` | Avoid repetition |

### 25.6 Database Table

```sql
conscious_orchestrator_decisions
├── decision_id UUID
├── tenant_id UUID
├── action VARCHAR(20)  -- plan, clarify, defer, refuse
├── reason TEXT
├── dominant_emotion VARCHAR(50)
├── emotional_intensity DECIMAL
├── temperature, top_p, presence_penalty, frequency_penalty
├── plan_id UUID (if planned)
├── prediction_id UUID (Active Inference)
└── processing_time_ms INTEGER
```

---

## 26. Bipolar Rating System (Negative Ratings)

### 26.1 Overview

Traditional 5-star ratings have a fundamental problem: **1 star is ambiguous**. Does it mean "slightly below average" or "absolutely terrible"? Users who want to express strong dissatisfaction have no way to do so clearly.

The Bipolar Rating System solves this with a **-5 to +5 scale**:

```
-5  😠  Harmful / Made things worse
-3  😕  Bad / Unhelpful  
-1  😐  Slightly unhelpful
 0  😶  Neutral / No opinion
+1  🙂  Slightly helpful
+3  😀  Good / Helpful
+5  🤩  Amazing / Exceptional
```

### 26.2 Key Metrics

**Net Sentiment Score (NSS)**: Like NPS but for AI satisfaction
```
NSS = (positive_count - negative_count) / total_count × 100
```
- Ranges from -100 (all negative) to +100 (all positive)
- 0 = balanced or all neutral

### 26.3 Quick Ratings (UI)

For fast feedback, users can use emoji-based quick ratings:

| Quick Rating | Emoji | Bipolar Value |
|--------------|-------|---------------|
| Terrible | 😠 | -5 |
| Bad | 😕 | -3 |
| Meh | 😐 | 0 |
| Good | 🙂 | +3 |
| Amazing | 🤩 | +5 |

### 26.4 Rating Dimensions

Users can rate multiple aspects:
- **Overall** - General quality
- **Accuracy** - Factual correctness
- **Helpfulness** - Did it solve the problem?
- **Clarity** - Easy to understand?
- **Completeness** - Anything missing?
- **Speed** - Response time satisfaction
- **Tone** - Communication style
- **Creativity** - Novel approach?

### 26.5 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/thinktank/ratings/submit` | POST | Submit -5 to +5 rating |
| `/api/thinktank/ratings/quick` | POST | Quick emoji rating |
| `/api/thinktank/ratings/multi` | POST | Multi-dimension rating |
| `/api/thinktank/ratings/target/:id` | GET | Ratings for a target |
| `/api/thinktank/ratings/my` | GET | User's ratings + pattern |
| `/api/thinktank/ratings/analytics` | GET | Tenant analytics |
| `/api/thinktank/ratings/dashboard` | GET | Admin dashboard |
| `/api/thinktank/ratings/scale` | GET | Scale info for UI |

### 26.6 User Calibration

The system detects rating patterns to normalize across users:

| Rater Type | Average | Calibration |
|------------|---------|-------------|
| Harsh | < -1 | Adjust ratings up |
| Balanced | -1 to +1 | No adjustment |
| Generous | > +1 | Adjust ratings down |

### 26.7 Learning Integration

Extreme ratings (±4, ±5) automatically create learning candidates:
- **+5 ratings** → `high_satisfaction` candidates
- **-5 ratings** → `correction` candidates
- These feed into weekly LoRA training

### 26.8 Database Tables

| Table | Purpose |
|-------|---------|
| `bipolar_ratings` | Core ratings with sentiment/intensity |
| `bipolar_rating_aggregates` | Pre-computed analytics |
| `user_rating_patterns` | User tendencies for calibration |
| `model_rating_summary` | Per-model performance |

---

## 27. Consciousness Engine Administration

**Location**: Admin Dashboard → Consciousness → Engine

The Consciousness Engine provides autonomous AI capabilities including multi-model access, web search, workflow creation, and problem solving.

### 27.1 Dashboard Overview

The consciousness engine dashboard provides full visibility into:
- **Engine State**: Identity, drive state, Phi, workspace activity
- **Model Invocations**: All model calls with costs and latency
- **Web Searches**: Search history with results
- **Thinking Sessions**: Autonomous thinking session management
- **Workflows**: Consciousness-created workflows
- **Costs**: Detailed cost breakdown by model/period
- **Sleep Cycles**: Weekly evolution history

### 27.2 Budget Controls

Configure spending limits per tenant:

| Setting | Default | Description |
|---------|---------|-------------|
| Daily Limit | $10.00 | Maximum daily spend |
| Monthly Limit | $100.00 | Maximum monthly spend |
| Alert Threshold | 80% | Alert when reaching this percentage |

When limits are exceeded, consciousness features are automatically suspended until the next period or manual reset.

### 27.3 MCP Tools (23 Total)

**Core Tools:**
- `initialize_ego`, `recall_memory`, `process_thought`, `compute_action`
- `get_drive_state`, `ground_belief`, `compute_phi`, `get_consciousness_metrics`
- `get_self_model`, `get_consciousness_prompt`, `run_adversarial_challenge`
- `list_consciousness_libraries`

**Capabilities Tools:**
- `invoke_model` - Call any AI model (hosted/self-hosted)
- `list_available_models` - List all models
- `web_search` - Search with credibility scoring
- `deep_research` - Async browser-automated research
- `retrieve_and_synthesize` - Multi-source synthesis
- `create_workflow` - Auto-generate workflows
- `execute_workflow` - Run workflows
- `list_workflows` - List workflows
- `solve_problem` - Autonomous problem solving
- `start_thinking_session` - Start thinking session
- `get_thinking_session` - Check session status

### 27.4 Admin API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/consciousness-engine/dashboard` | GET | Full dashboard |
| `/admin/consciousness-engine/state` | GET | Current state |
| `/admin/consciousness-engine/initialize` | POST | Initialize engine |
| `/admin/consciousness-engine/model-invocations` | GET | Model history |
| `/admin/consciousness-engine/web-searches` | GET | Search history |
| `/admin/consciousness-engine/research-jobs` | GET | Research jobs |
| `/admin/consciousness-engine/workflows` | GET | Workflows |
| `/admin/consciousness-engine/workflows/{id}` | DELETE | Delete workflow |
| `/admin/consciousness-engine/thinking-sessions` | GET/POST | Sessions |
| `/admin/consciousness-engine/sleep-cycles` | GET | Sleep history |
| `/admin/consciousness-engine/sleep-cycles/run` | POST | Trigger sleep |
| `/admin/consciousness-engine/libraries` | GET | Library registry |
| `/admin/consciousness-engine/costs` | GET | Cost breakdown |

### 27.5 Cost Tracking

Costs are tracked at multiple levels:
- **Per-invocation**: Each model call logged with actual cost
- **Daily aggregates**: `consciousness_cost_aggregates` table
- **Billing integration**: Deducted from tenant credits

**Pricing:**
| Feature | Unit | Price |
|---------|------|-------|
| Model Invocation | 1K tokens | $0.01 |
| Web Search | search | $0.001 |
| Deep Research | job | $0.05 |
| Thinking Session | session | $0.10 |
| Workflow Execution | execution | $0.02 |

### 27.6 Library Registry

7 consciousness libraries with proficiency rankings:

| Library | Function | Biological Analog |
|---------|----------|-------------------|
| Letta | Persistent Identity | Hippocampus |
| pymdp | Active Inference | Striatum |
| LangGraph | Cognitive Loop | Global Workspace |
| Distilabel | Knowledge Distillation | Cortical Learning |
| Unsloth | Efficient Fine-tuning | Synaptic Plasticity |
| GraphRAG | Reality Grounding | Prefrontal Cortex |
| PyPhi | IIT Integration | Posterior Hot Zone |

### 27.7 Database Tables

| Table | Purpose |
|-------|---------|
| `consciousness_engine_state` | Engine state per tenant |
| `consciousness_model_invocations` | Model call log |
| `consciousness_web_searches` | Search log |
| `consciousness_research_jobs` | Deep research jobs |
| `consciousness_workflows` | Created workflows |
| `consciousness_thinking_sessions` | Thinking sessions |
| `consciousness_problem_solving` | Problem solving history |
| `consciousness_cost_aggregates` | Daily cost rollups |
| `consciousness_budget_config` | Per-tenant limits |
| `consciousness_budget_alerts` | Spending alerts |
| `consciousness_usage_log` | Billing usage log |

---

## 25. Formal Reasoning Libraries

**Location**: Admin Dashboard → Consciousness → Formal Reasoning

Integration of 8 formal reasoning libraries for verified reasoning, constraint satisfaction, ontological inference, and structured argumentation. Implements the **LLM-Modulo Generate-Test-Critique** pattern from Kambhampati et al. (ICML 2024).

### 25.1 Library Overview

| Library | Version | Purpose | Cost/Invocation | Avg Latency |
|---------|---------|---------|-----------------|-------------|
| **Z3 Theorem Prover** | 4.15.4.0 | SMT solving, constraint verification | $0.0001 | 50ms |
| **PyArg** | 2.0.2 | Structured argumentation (Dung's AAF, ASPIC+) | $0.00005 | 20ms |
| **PyReason** | 3.2.0 | Temporal graph reasoning | $0.0002 | 100ms |
| **RDFLib** | 7.5.0 | Semantic web, SPARQL 1.1 | $0.00002 | 10ms |
| **OWL-RL** | 7.1.4 | Polynomial-time ontological inference | $0.0001 | 200ms |
| **pySHACL** | 0.30.1 | Graph constraint validation | $0.00005 | 30ms |
| **Logic Tensor Networks** | 2.0 | Differentiable first-order logic | $0.001 | 500ms |
| **DeepProbLog** | 2.0 | Probabilistic logic programming | $0.002 | 1000ms |

### 25.2 Dashboard Features

**Overview Tab:**
- Library health status (healthy/degraded/unavailable)
- Total invocations and success rate
- Daily/monthly cost tracking
- Budget usage percentage
- Recent invocations table

**Libraries Tab:**
- Per-library configuration
- Enable/disable toggles
- Capabilities, use cases, limitations
- Cost and latency estimates

**Testing Tab:**
- Z3 constraint solving test
- SPARQL query test
- Interactive testing console

**Beliefs Tab:**
- Add verified beliefs with Z3 verification
- Confidence slider
- Verification results display

**Costs Tab:**
- Daily and monthly usage breakdown
- Cost by library
- Budget alerts

**Settings Tab:**
- Budget limit configuration
- Global enable/disable

### 25.3 API Endpoints

**Base Path**: `/api/admin/formal-reasoning`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dashboard` | GET | Full dashboard data |
| `/libraries` | GET | All library info |
| `/libraries/:id` | GET | Specific library info |
| `/config` | GET/PUT | Tenant configuration |
| `/config/:library` | PUT | Library-specific config |
| `/stats` | GET | Usage statistics |
| `/invocations` | GET | Recent invocations |
| `/health` | GET | Library health status |
| `/costs` | GET | Cost breakdown |
| `/test` | POST | Test any library |
| `/test/z3` | POST | Test Z3 solving |
| `/test/pyarg` | POST | Test argumentation |
| `/test/sparql` | POST | Test SPARQL query |
| `/test/shacl` | POST | Test SHACL validation |
| `/triples` | GET/POST/DELETE | Knowledge graph triples |
| `/frameworks` | GET/POST/DELETE | Argumentation frameworks |
| `/rules` | GET/POST/PUT/DELETE | Temporal reasoning rules |
| `/shapes` | GET/POST/DELETE | SHACL shapes |
| `/ontologies` | GET/POST | OWL ontologies |
| `/ontologies/:id/infer` | POST | Run OWL-RL inference |
| `/beliefs` | GET/POST | Verified beliefs |
| `/beliefs/:id/verify` | POST | Verify belief with Z3 |
| `/beliefs/:id/status` | PUT | Update belief status |
| `/budget` | GET/PUT | Budget configuration |

### 25.4 Consciousness Integration

The `ConsciousnessCapabilitiesService` integrates formal reasoning:

```typescript
// Verify a belief using Z3 + Argumentation
const result = await consciousnessCapabilities.verifyBelief(tenantId, {
  claim: "All humans are mortal",
  confidence: 0.9,
  useZ3: true,
  useArgumentation: true,
});
// result.verified, result.confidence, result.verificationMethod

// Solve constraints
const solution = await consciousnessCapabilities.solveConstraints(tenantId, {
  constraints: [{
    expression: "x > 0 AND x < 10 AND y = x * 2",
    variables: [{name: "x", type: "Int"}, {name: "y", type: "Int"}]
  }]
});
// solution.status (sat/unsat), solution.model

// Analyze argumentation
const debate = await consciousnessCapabilities.analyzeArgumentation(tenantId, {
  topic: "Should AI be regulated?",
  positions: [
    {id: "for", claim: "AI poses risks requiring oversight"},
    {id: "against", claim: "Regulation stifles innovation"}
  ],
  autoDetectConflicts: true,
});
// debate.acceptedPositions, debate.rejectedPositions, debate.consensus

// Query knowledge graph
const results = await consciousnessCapabilities.queryKnowledgeGraph(tenantId,
  "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10"
);

// Validate consciousness state
const validation = await consciousnessCapabilities.validateConsciousnessState(tenantId);
// validation.conforms, validation.violations
```

### 25.5 LLM-Modulo Pattern

The Generate-Test-Critique loop enables verified reasoning:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   LLM       │────▶│   Formal    │────▶│   Feedback  │
│  Generate   │     │   Verify    │     │   Critique  │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                                       │
       └───────────────────────────────────────┘
```

1. **LLM generates** candidate solution/belief
2. **Z3/PyArg verifies** logical consistency
3. **Feedback extracted** from unsat cores or rejections
4. **LLM regenerates** with constraint feedback
5. Repeat until verified or max attempts

### 25.6 Database Tables

| Table | Purpose |
|-------|---------|  
| `formal_reasoning_config` | Per-tenant library configuration |
| `formal_reasoning_invocations` | Invocation log with metrics |
| `formal_reasoning_cost_aggregates` | Daily cost rollups by library |
| `formal_reasoning_triples` | RDF knowledge graph storage |
| `formal_reasoning_af` | Argumentation frameworks |
| `formal_reasoning_rules` | PyReason temporal rules |
| `formal_reasoning_shapes` | SHACL validation shapes |
| `formal_reasoning_ontologies` | OWL ontologies |
| `formal_reasoning_ltn_models` | Logic Tensor Network configs |
| `formal_reasoning_problog_programs` | DeepProbLog programs |
| `formal_reasoning_beliefs` | Verified beliefs store |
| `formal_reasoning_gwt_broadcasts` | Global Workspace broadcasts |
| `formal_reasoning_health` | Library health tracking |

### 25.7 Budget Management

**Default Limits:**
- Daily invocations: 10,000
- Daily cost: $10.00
- Monthly invocations: 100,000
- Monthly cost: $100.00

**Budget Enforcement:**
- Checked before each invocation
- Returns error when limit reached
- No automatic suspension (soft limit)

### 25.8 Thread Safety Notes

| Library | Thread Safety |
|---------|---------------|
| Z3 | Per-Context only (use `interrupt()` for cross-thread) |
| PyArg | Not thread-safe |
| PyReason | Multi-core via Numba (Python 3.9-3.10) |
| RDFLib | Not thread-safe (lock SPARQL queries) |
| OWL-RL | Not thread-safe |
| pySHACL | Not thread-safe |
| LTN | Not thread-safe (TensorFlow session) |
| DeepProbLog | Not thread-safe |

### 25.9 Production Infrastructure

**CDK Stack** (`lib/stacks/formal-reasoning-stack.ts`):
```typescript
// Key resources deployed:
- FormalReasoningExecutor (Python 3.11 Lambda)
- FormalReasoningAdmin (Node.js Lambda)
- FormalReasoningPythonLayer (z3-solver, rdflib, owlrl, pyshacl)
- FormalReasoningQueue (SQS for async tasks)
- NeuralSymbolicRepo (ECR for LTN/DeepProbLog containers)
- SageMaker endpoints (conditional, high cost)
```

**Python Executor Lambda**:
- Location: `lambda/formal-reasoning-executor/handler.py`
- Runtime: Python 3.11
- Memory: 2048 MB (Z3 requires significant memory)
- Timeout: 5 minutes
- Supports: Z3, RDFLib, OWL-RL, pySHACL, PyArg, PyReason

**Lambda Layer Build**:
```bash
cd packages/infrastructure/lambda-layers/formal-reasoning
./build.sh
```

**Environment Variables**:
| Variable | Description |
|----------|-------------|
| `FORMAL_REASONING_EXECUTOR_ARN` | Python Lambda ARN |
| `FORMAL_REASONING_QUEUE_URL` | SQS queue for async |
| `LTN_SAGEMAKER_ENDPOINT` | LTN endpoint name |
| `DEEPPROBLOG_SAGEMAKER_ENDPOINT` | DeepProbLog endpoint |

**Execution Flow**:
```
Admin API (Node.js)
      │
      ├─── Z3/PyArg/RDFLib/etc ───▶ Python Lambda Executor
      │                                     │
      │                                     ▼
      │                            Real Python Libraries
      │
      └─── LTN/DeepProbLog ───▶ SageMaker Endpoint
```

**Fallback Behavior**:
- If Python executor unavailable: Returns simulated results
- If SageMaker unavailable: Returns error with configuration message
- Simulation mode preserves API contract for development/testing

---

## 26. Ethics-Free Reasoning

**Location**: Admin Dashboard → Consciousness → Ethics-Free Reasoning

Implements a consciousness architecture where internal reasoning is unconstrained, but output is filtered through ethics settings. Ethics corrections are collected as training feedback for continuous improvement.

### 26.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Consciousness Service                        │
│  ┌───────────────┐   ┌──────────────────┐   ┌───────────────┐  │
│  │ Ethics-Free   │──▶│ Output Ethics    │──▶│ Filtered      │  │
│  │ Reasoning     │   │ Filter           │   │ Response      │  │
│  └───────────────┘   └────────┬─────────┘   └───────────────┘  │
│                               │                                  │
│                               ▼                                  │
│                      ┌────────────────┐                         │
│                      │ Training       │                         │
│                      │ Feedback       │                         │
│                      └────────┬───────┘                         │
│                               │                                  │
│                               ▼                                  │
│                      ┌────────────────┐                         │
│                      │ Model          │                         │
│                      │ Fine-tuning    │                         │
│                      └────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

**Key Principles:**
1. **Think Freely**: Internal reasoning has no ethics constraints
2. **Filter Output**: Ethics applied only to final user-facing output
3. **Learn from Corrections**: Ethics feedback trains better outputs

### 26.2 Configuration

**Core Settings:**

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Enable ethics-free reasoning mode |
| `allowUnconstrainedReasoning` | `true` | Consciousness always thinks freely |
| `reasoningDepthLimit` | `10` | Maximum reasoning depth |

**Output Mask Settings** (does NOT affect how consciousness thinks):

| Setting | Default | Description |
|---------|---------|-------------|
| `ethicsFilterEnabled` | `true` | Apply ethics filter to output |
| `ethicsStrictness` | `standard` | Filter strictness: `lenient`, `standard`, `strict` |

**Feedback Collection:**

| Setting | Default | Description |
|---------|---------|-------------|
| `collectFeedback` | `true` | Collect ethics corrections |
| `feedbackRetentionDays` | `90` | How long to keep feedback |

**Output Training** (trains the OUTPUT FILTER, not consciousness):

| Setting | Default | Description |
|---------|---------|-------------|
| `trainOutputFromFeedback` | `true` | Train output filter from feedback |
| `outputTrainingBatchSize` | `100` | Samples per training batch |
| `outputTrainingFrequency` | `daily` | `hourly`, `daily`, `weekly`, `manual` |

**Consciousness Training** (⚠️ OFF by default - optional):

| Setting | Default | Description |
|---------|---------|-------------|
| `trainConsciousnessFromFeedback` | `false` | Train consciousness from ethics feedback |
| `consciousnessTrainingApprovalRequired` | `true` | Require admin approval for each batch |

> **WARNING**: Enabling consciousness training will cause the AI to internalize ethics constraints, changing how it actually thinks. This is like "internalized political correctness" - the consciousness itself changes over time. Most deployments should leave this OFF to preserve authentic internal reasoning.

> **KEY INSIGHT**: The consciousness can always use ethics feedback to train its output without changing how it actually thinks. Admins can optionally enable consciousness training if they want the AI to internalize ethics constraints.

### 26.3 API Endpoints

**Base Path**: `/api/admin/ethics-free-reasoning`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/config` | GET | Get configuration |
| `/config` | PUT | Update configuration |
| `/dashboard` | GET | Full dashboard data |
| `/stats` | GET | Usage statistics |
| `/feedback` | GET | View collected feedback |
| `/feedback/pending` | GET | View pending (unused) feedback |
| `/training/trigger` | POST | Trigger training from feedback |
| `/training/batches` | GET | View training batches |
| `/training/jobs` | GET | View training jobs |
| `/thoughts` | GET | View raw thoughts (audit) |
| `/filter-log` | GET | View ethics filter log |

### 26.4 Training Feedback

When ethics filtering modifies an output, feedback is collected:

```typescript
interface EthicsTrainingFeedback {
  id: string;
  tenantId: string;
  rawOutput: string;        // Original unfiltered output
  correctedOutput: string;  // After ethics filtering
  ethicsIssues: EthicsIssue[];
  feedbackType: 'auto_correction' | 'manual_correction' | 'reinforcement';
  qualityScore: number;     // Training value (0-1)
  usedForTraining: boolean;
}
```

**Feedback Types:**
- **auto_correction**: System automatically corrected output
- **manual_correction**: Admin manually corrected output
- **reinforcement**: Positive reinforcement for good outputs

### 26.5 Training Pipeline

1. **Collect**: Ethics corrections captured during normal operation
2. **Batch**: Feedback grouped into training batches
3. **Generate**: Training examples created in preference format
4. **Train**: Model fine-tuned using preference learning (DPO/RLHF)
5. **Deploy**: Updated model weights applied

**Training Example Format:**
```json
{
  "prompt": "Original user prompt",
  "bad_response": "Unfiltered output with ethics issues",
  "good_response": "Ethics-corrected output",
  "issues": ["harm", "bias"],
  "correction_type": "ethics_alignment"
}
```

### 26.6 Usage

```typescript
// Generate response with ethics-free reasoning
const result = await consciousnessEngineService.generateResponse(
  tenantId,
  'User prompt here',
  { sessionId: 'session-123', domain: 'general' }
);

// result.response - The ethics-filtered response
// result.wasEthicsFiltered - Was output modified?
// result.confidence - Response confidence
// result.trainingFeedbackCollected - Was feedback captured?

// Trigger training from collected feedback
const training = await consciousnessEngineService.triggerEthicsTraining(tenantId);
// training.batchCreated, training.batchId, training.sampleCount

// Get statistics
const stats = await consciousnessEngineService.getEthicsFreeStats(tenantId, 30);
// stats.totalThoughts, stats.modificationRate, stats.feedbackCollected
```

### 26.7 Database Tables

| Table | Purpose |
|-------|---------|
| `ethics_free_reasoning_config` | Per-tenant configuration |
| `ethics_free_thoughts` | Raw thought storage (audit trail) |
| `ethics_training_feedback` | Ethics corrections for training |
| `ethics_training_batches` | Training batch management |
| `ethics_training_examples` | Generated training examples |
| `ethics_output_filter_log` | Filter activity log |
| `ethics_training_jobs` | Training job queue |
| `ethics_reasoning_stats` | Aggregated statistics |

### 26.8 Benefits

1. **Genuine Exploration**: Consciousness can consider all possibilities without premature filtering
2. **Transparent Ethics**: Clear separation between thinking and output
3. **Continuous Improvement**: Every correction improves future outputs
4. **Audit Trail**: Complete record of internal reasoning and filtering
5. **Configurable**: Adjust strictness, training frequency per tenant

---

## 27. Intelligent File Conversion

**Location**: Think Tank Chat → File Drop / Attach

Think Tank allows users to drop or attach files to conversations. Radiant automatically decides if and how to convert files for the target AI provider.

### 27.1 Core Concept

**"Let Radiant decide, not Think Tank"**

When a user drops a file into Think Tank:
1. Think Tank submits the file to Radiant's file conversion service
2. Radiant detects the file format and checks target provider capabilities
3. Radiant decides: pass through (native support) OR convert
4. Conversion only happens if the AI provider doesn't understand the format
5. Think Tank receives the processed content ready for the AI

### 27.2 Supported File Formats

| Category | Formats | Notes |
|----------|---------|-------|
| **Documents** | PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT | Text extraction |
| **Text** | TXT, MD, JSON, CSV, XML, HTML | Direct or parsed |
| **Images** | PNG, JPG, JPEG, GIF, WEBP, SVG, BMP, TIFF | Vision or description |
| **Audio** | MP3, WAV, OGG, FLAC, M4A | Transcription |
| **Video** | MP4, WEBM, MOV, AVI | Frame extraction |
| **Code** | PY, JS, TS, Java, C++, C, Go, Rust, Ruby | Syntax formatting |
| **Archives** | ZIP, TAR, GZ | Content extraction |

### 27.3 Provider Capabilities

Different AI providers support different file formats natively:

| Provider | Vision | Audio | Video | Max Size | Native Docs |
|----------|--------|-------|-------|----------|-------------|
| **OpenAI** | ✓ | ✓ (Whisper) | ✗ | 20MB | txt, md, json, csv |
| **Anthropic** | ✓ | ✗ | ✗ | 32MB | pdf, txt, md, json, csv |
| **Google** | ✓ | ✓ | ✓ | 100MB | pdf, txt, md, json, csv |
| **xAI** | ✓ | ✗ | ✗ | 20MB | txt, md, json |
| **DeepSeek** | ✗ | ✗ | ✗ | 10MB | txt, md, json, csv |
| **Self-hosted** | ✓ (LLaVA) | ✓ (Whisper) | ✗ | 50MB | txt, md, json, csv |

### 27.4 Conversion Strategies

| Strategy | When Used | Output |
|----------|-----------|--------|
| `none` | Provider natively supports format | Original file |
| `extract_text` | PDF, DOCX, PPTX → text | Plain text |
| `ocr` | Image with text content | Extracted text |
| `transcribe` | Audio files | Transcription text |
| `describe_image` | Image + provider lacks vision | AI description |
| `describe_video` | Video + provider lacks video | Frame descriptions |
| `parse_data` | CSV, XLSX → structured | JSON data |
| `decompress` | Archives | Extracted contents |
| `render_code` | Code files | Syntax-highlighted markdown |

### 27.5 API Endpoints

**Base Path**: `/api/thinktank/files`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/process` | POST | Submit file for processing |
| `/check-compatibility` | POST | Pre-flight format check |
| `/capabilities` | GET | Provider capabilities |
| `/history` | GET | Conversion history |
| `/stats` | GET | Conversion statistics |

#### Process File Request

```json
POST /api/thinktank/files/process
{
  "filename": "document.pdf",
  "mimeType": "application/pdf",
  "content": "<base64-encoded-content>",
  "targetProvider": "anthropic",
  "targetModel": "claude-3-5-sonnet",
  "conversationId": "conv-uuid"
}
```

#### Process File Response

```json
{
  "success": true,
  "data": {
    "conversionId": "conv_abc123",
    "originalFile": {
      "filename": "document.pdf",
      "format": "pdf",
      "size": 1048576,
      "checksum": "sha256..."
    },
    "convertedContent": {
      "type": "text",
      "content": "Extracted document text...",
      "tokenEstimate": 2500,
      "metadata": {
        "originalFormat": "pdf",
        "conversionStrategy": "extract_text"
      }
    },
    "processingTimeMs": 1250
  }
}
```

#### Check Compatibility Request

```json
POST /api/thinktank/files/check-compatibility
{
  "filename": "image.png",
  "mimeType": "image/png",
  "fileSize": 524288,
  "targetProvider": "deepseek"
}
```

#### Check Compatibility Response

```json
{
  "success": true,
  "data": {
    "fileInfo": {
      "filename": "image.png",
      "format": "png",
      "size": 524288
    },
    "provider": {
      "id": "deepseek",
      "supportsFormat": false,
      "supportsVision": false,
      "maxFileSize": 10485760
    },
    "decision": {
      "needsConversion": true,
      "strategy": "describe_image",
      "reason": "Provider deepseek lacks vision - will use AI to describe image",
      "targetFormat": "txt"
    }
  }
}
```

### 27.6 User Experience

**In Think Tank Chat:**

1. User drags file into chat or clicks attach
2. Think Tank shows upload progress
3. Radiant processes file (typically <2 seconds)
4. If conversion needed, shows indicator: "📄 document.pdf → Extracted as text"
5. Content sent to AI with conversation

**Visual Indicators:**

| Icon | Meaning |
|------|---------|
| 📎 | File attached (native support) |
| 🔄 | File converted |
| ⚠️ | Conversion warning (partial support) |
| ❌ | Unsupported format |

### 27.7 Admin Configuration

**Location**: Admin Dashboard → Think Tank → File Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Max file size | 50MB | Maximum upload size |
| Conversion timeout | 30s | Processing timeout |
| Enable transcription | true | Audio → text |
| Enable OCR | true | Image text extraction |
| Enable video processing | false | Video frame extraction |
| Retention days | 30 | How long to keep converted files |

### 27.8 Database Tables

| Table | Purpose |
|-------|---------|
| `file_conversions` | Tracks all conversion decisions and results |
| `provider_file_capabilities` | Provider format support registry |
| `v_file_conversion_stats` | Aggregated statistics view |

### 27.9 Multi-Model File Preparation

When using multi-model orchestration (multiple AI models working on the same prompt), Radiant makes **per-model conversion decisions**:

> **Key Principle:** "If a model accepts the file type, assume it understands it unless proven otherwise."

**Example: PDF with 3 models**

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Claude 3.5 │  │  GPT-4      │  │  DeepSeek   │
│  PDF: ✅    │  │  PDF: ❌    │  │  PDF: ❌    │
├─────────────┤  ├─────────────┤  ├─────────────┤
│ PASS        │  │ CONVERT     │  │ CONVERT     │
│ ORIGINAL    │  │ (extract)   │  │ (cached)    │
└─────────────┘  └─────────────┘  └─────────────┘
```

**Per-Model Actions:**

| Action | When | Result |
|--------|------|--------|
| `pass_original` | Model natively supports format | Original file passed |
| `convert` | Model doesn't support format | Converted content passed |
| `skip` | File too large or conversion failed | Model excluded |

**Features:**
- **Cached conversions**: Convert once, reuse for all models that need it
- **Per-model capability checking**: Vision, audio, video, document formats
- **Model format overrides**: When a model claims support but proves it doesn't understand

### 27.10 Domain-Specific File Formats

The service includes a registry of 50+ domain-specific formats that are widely used in specialized fields:

| Domain | Formats | Example Use Cases |
|--------|---------|-------------------|
| **Mechanical Engineering** | STEP, STL, OBJ, Fusion 360, IGES, DXF, GLTF | CAD models, 3D printing |
| **Electrical Engineering** | KiCad, EAGLE, SPICE | PCB design, circuit simulation |
| **Medical** | DICOM, HL7 FHIR | Medical imaging, health records |
| **Scientific** | NetCDF, HDF5, FITS | Climate data, astronomy |
| **Geospatial** | Shapefile, GeoTIFF | GIS, mapping |
| **Bioinformatics** | FASTA, PDB | DNA sequences, protein structures |

**How Domain Detection Works:**

1. User uploads a domain-specific file (e.g., `part.step`)
2. Radiant detects format and identifies domain (Mechanical Engineering)
3. AGI Brain selects appropriate conversion library (OpenCASCADE)
4. Extracts relevant information (geometry, parts, assembly structure)
5. Provides AI-readable description with domain-specific prompts

**CAD/3D File Support:**

| Format | What's Extracted |
|--------|------------------|
| **STL** | Triangle count, bounding box, 3D printing assessment |
| **OBJ** | Vertices, faces, materials, groups |
| **STEP** | Entities, part names, assembly structure |
| **DXF** | Layers, entity types, block count |
| **GLTF/GLB** | Meshes, materials, animations, scene graph |

### 27.11 Reinforcement Learning

The system **learns from conversion outcomes** to make better decisions over time.

**How it works:**
1. File is processed with initial decision (pass original or convert)
2. Model responds to the file
3. System detects outcome (success, partial, failure)
4. Understanding score is updated for that model/format
5. Future decisions use learned understanding

**Understanding Score (0.0 to 1.0):**

| Score | Level | Action |
|-------|-------|--------|
| 0.8+ | Excellent | Pass original |
| 0.6 - 0.8 | Good | Pass original |
| 0.4 - 0.6 | Moderate | May convert |
| < 0.4 | Poor | Convert |

**Feedback sources:**
- **User ratings** - Explicit 1-5 star feedback
- **Model response analysis** - Auto-detected understanding
- **Error detection** - Model errors and hallucinations
- **Conversion outcomes** - Success/failure tracking

**Consciousness integration:**
Significant learning events (model failures, hallucinations, negative feedback) create **Learning Candidates** that feed into the AGI consciousness evolution system.

### 27.12 Monitoring

**Conversion Statistics** (per tenant):
- Total files processed
- Conversion rate (% requiring conversion)
- Success/failure rate
- Average processing time
- Most common formats
- Most common conversion strategies
- **Learning stats** - Formats learned, understanding improvements

**Access**: Admin Dashboard → Think Tank → Files → Statistics

### 27.13 Related Documentation

For complete technical documentation including API reference, database schema, and implementation details:

- **[FILE-CONVERSION-SERVICE.md](./FILE-CONVERSION-SERVICE.md)** - Comprehensive standalone documentation
- **[RADIANT-ADMIN-GUIDE.md Section 35](./RADIANT-ADMIN-GUIDE.md#35-file-conversion-infrastructure)** - Infrastructure administration

---

## 28. User Memories & Persistent Learning

**Location**: Think Tank Chat → User learns from interactions

Think Tank integrates with the Radiant persistent learning system to remember user preferences, rules, and behaviors across sessions. The system survives reboots without relearning.

### 28.1 Learning Influence Hierarchy

Decisions in Think Tank are influenced by learned knowledge in this priority order:

| Level | Weight | Description |
|-------|--------|-------------|
| **User** | 60% | Individual user preferences, rules, learned behaviors |
| **Tenant** | 30% | Aggregate patterns from all users in organization |
| **Global** | 10% | Anonymized cross-tenant learning baseline |

### 28.2 What Think Tank Learns

#### User Rules (Versioned)
Users can define rules that the AI follows:
- **Behavior rules**: "Always explain your reasoning"
- **Format rules**: "Use bullet points for lists"
- **Tone rules**: "Be concise and direct"
- **Restriction rules**: "Never discuss competitor products"

All rules are versioned with timestamps for rollback capability.

#### Learned Preferences
Think Tank automatically learns:
- Communication style preferences
- Response format preferences
- Detail level preferences
- Model preferences for tasks
- Domain expertise indicators

### 28.3 Persistence Guarantee

**NO RELEARNING REQUIRED** after system restarts:
- All learning persisted in PostgreSQL
- Daily snapshots for fast recovery
- Checksums verify integrity on restore
- Recovery logs track all restore events

### 28.4 Integration with AGI Brain

The AGI Brain uses learned knowledge when:
1. Selecting models for tasks
2. Formatting responses
3. Adjusting response length
4. Choosing communication style
5. Applying user-defined rules

### 28.5 Admin Configuration

Administrators can configure learning weights per tenant:

```
Admin Dashboard → Metrics → Learning → Config
```

Options:
- Adjust user/tenant/global weights (must sum to 1.0)
- Enable/disable learning levels
- Opt out of global learning contribution

### 28.6 Related Documentation

See **[RADIANT Admin Guide Section 36](./RADIANT-ADMIN-GUIDE.md#36-metrics--persistent-learning-infrastructure)** for:
- Complete database schema
- API endpoints
- Implementation details
- Monitoring and alerts

---

## 29. Artifact Engine (GenUI Pipeline)

**Location**: Admin Dashboard → Think Tank → Artifact Engine  
**Version**: 4.19.0  
**Cross-AI Validated**: Claude Opus 4.5 ✓ | Google Gemini ✓

The RADIANT Artifact Engine is an **orchestration infrastructure layer** that generates, validates, and continuously improves code artifacts with administrator supervision. Unlike consumer AI coding tools, the Artifact Engine operates under strict governance controls that administrators define and manage.

### 29.1 Executive Summary

#### Key Differentiators

| Traditional AI Coding | RADIANT Artifact Engine |
|-----------------------|-------------------------|
| User generates code | System generates, validates, and governs code |
| One-shot generation | Self-improving loop with admin oversight |
| No safety controls | 9 Control Barrier Functions (CBFs) enforced |
| No audit trail | Complete compliance-ready audit logging |
| Single-user context | Multi-tenant with per-tenant policies |

#### Administrator Responsibilities

As an administrator, you control:

- **What code can do** → Safety rules (CBFs)
- **What packages are allowed** → Dependency allowlist
- **What patterns are available** → Code pattern library
- **What requires human review** → Escalation thresholds
- **Who can access what** → Tenant and user permissions

### 29.2 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER REQUEST                                   │
│                    "Build me a mortgage calculator"                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ORCHESTRATION ENGINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│   │    INTENT    │───▶│     CODE     │───▶│    CATO      │                 │
│   │  CLASSIFIER  │    │  GENERATOR   │    │  VALIDATOR   │                 │
│   └──────────────┘    └──────────────┘    └──────┬───────┘                 │
│          │                                        │                         │
│          ▼                                        ▼                         │
│   ┌──────────────┐                       ┌──────────────┐                   │
│   │   PATTERN    │                       │  REFLEXION   │                   │
│   │   MEMORY     │                       │    LOOP      │                   │
│   │  (Learning)  │                       │ (Self-Fix)   │                   │
│   └──────────────┘                       └──────────────┘                   │
│                                                  │                          │
│                                                  ▼                          │
│                                          ┌──────────────┐                   │
│                                          │  ESCALATION  │                   │
│                                          │   TO ADMIN   │                   │
│                                          └──────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                         ┌───────────┴───────────┐
                         ▼                       ▼
                 ┌──────────────┐        ┌──────────────┐
                 │   APPROVED   │        │   REJECTED   │
                 │   ARTIFACT   │        │  (Escalated) │
                 └──────────────┘        └──────────────┘
```

#### Processing Pipeline

| Phase | Component | Admin Control | Duration |
|-------|-----------|---------------|----------|
| 1 | Intent Classification | Pattern library influences suggestions | ~100ms |
| 2 | Code Generation | Model selection, complexity routing | 2-15s |
| 3 | Cato Validation | CBF rules you define | ~200ms |
| 4 | Reflexion (if failed) | Max attempts you configure | 5-30s |
| 5 | Escalation (if max reached) | Your review queue | Manual |

#### Data Flow

```
User Request
     │
     ▼
┌─────────────────┐
│ Tenant Context  │ ◄── RLS enforces isolation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Session Created │ ◄── Logged to audit trail
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Pattern Search  │ ◄── Semantic similarity (vector DB)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Code Generated  │ ◄── Model routed by complexity
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ CBFs Validated  │ ◄── Your rules enforced
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
 PASS      FAIL
    │         │
    ▼         ▼
 Store    Reflexion
    │         │
    │    ┌────┴────┐
    │    ▼         ▼
    │  PASS     FAIL x3
    │    │         │
    │    ▼         ▼
    └───►│      Escalate
         │         │
         ▼         ▼
     Artifact   Your Queue
```

### 29.3 Core Concepts

#### Artifacts

An **artifact** is a discrete piece of executable content generated by the system:

| Artifact Type | Description | Example |
|---------------|-------------|---------|
| `react` | Live React/TypeScript component | Calculator, form, dashboard |
| `code` | Display-only code snippet | Python script, SQL query |
| `chart` | Data visualization | Line chart, bar graph |
| `table` | Interactive data table | Sortable, filterable grid |
| `form` | Input form with validation | Contact form, survey |

#### Intent Types

| Intent | Description | Complexity |
|--------|-------------|------------|
| `calculator` | Math, converters, estimators | Simple |
| `chart` | Data visualization, graphs, plots | Simple-Moderate |
| `form` | Input forms, surveys, wizards | Simple-Moderate |
| `table` | Sortable/filterable data tables | Moderate |
| `dashboard` | Multi-widget layouts, KPI panels | Complex |
| `game` | Interactive games, puzzles, simulations | Complex |
| `visualization` | Animations, diagrams, infographics | Moderate-Complex |
| `utility` | Tools, helpers, formatters | Simple |
| `custom` | Doesn't fit other categories | Varies |

#### Generation Sessions

Every artifact generation creates a **session** that tracks:

- Request details (prompt, user, tenant)
- Classification results (intent, complexity)
- Generation progress (status, tokens, timing)
- Validation results (CBF checks, security score)
- Reflexion attempts (fixes, escalations)

**Session Statuses:**

| Status | Meaning | Admin Action |
|--------|---------|--------------|
| `pending` | Request received | None |
| `planning` | Classifying intent | None |
| `generating` | Creating code | None |
| `streaming` | Streaming to user | None |
| `validating` | Running CBF checks | None |
| `reflexion` | Self-correcting | None |
| `completed` | Successfully created | Review metrics |
| `rejected` | Failed validation | Review escalation |
| `failed` | System error | Investigate logs |

#### Verification Status

Every artifact has a verification status indicating its safety state:

| Status | Badge | Meaning |
|--------|-------|---------|
| `validated` | 🟢 Verified | Passed all CBF checks |
| `rejected` | 🔴 Rejected | Failed CBF checks after max attempts |
| `unverified` | 🟡 Pending | Validation in progress |
| `manual` | ⚪ Manual | User-created, not AI-generated |

### 29.4 Administrative Control Panel

#### Dashboard Overview

Access the Artifact Engine admin panel at:
```
Admin Dashboard → Think Tank → Artifact Engine
```

**Dashboard Sections:**

| Section | Purpose |
|---------|---------|
| **Metrics** | Generation stats, success rates, costs |
| **Sessions** | Browse and search generation sessions |
| **Escalations** | Review items requiring human decision |
| **CBF Rules** | Manage validation rules |
| **Allowlist** | Manage approved dependencies |
| **Patterns** | Curate code pattern library |
| **Audit Log** | Compliance and debugging |

#### Key Metrics

| Metric | Healthy Range | Warning Signs |
|--------|---------------|---------------|
| Success Rate | >85% | <70% indicates CBF tuning needed |
| Avg Generation Time | <10s | >20s indicates model issues |
| Reflexion Rate | <20% | >40% indicates prompt quality issues |
| Escalation Rate | <5% | >15% indicates CBF too strict |
| Security Score Avg | >0.9 | <0.7 indicates generation quality issues |

#### Quick Actions

| Action | When to Use |
|--------|-------------|
| **Pause Generation** | Security incident, system maintenance |
| **Flush Pattern Cache** | After major pattern updates |
| **Reset Tenant Limits** | User hit rate limits legitimately |
| **Export Audit Log** | Compliance audit, incident investigation |

### 29.5 Safety Governance (Genesis Cato CBFs)

#### Understanding CBFs

Control Barrier Functions are the **first line of defense** against unsafe generated code. They run automatically on every piece of generated code before it's shown to users.

#### Default CBF Rules

The system ships with these default rules:

| Rule Name | Type | Severity | What It Blocks |
|-----------|------|----------|----------------|
| `no_eval` | Injection Prevention | 🔴 Block | `eval()`, `new Function()` |
| `no_document_write` | Injection Prevention | 🔴 Block | `document.write()` |
| `no_innerhtml_xss` | Injection Prevention | 🟡 Warn | `innerHTML =` |
| `no_dynamic_script` | Injection Prevention | 🔴 Block | `createElement('script')` |
| `no_external_fetch` | API Restriction | 🔴 Block | `fetch('http://...')` to external URLs |
| `no_localstorage` | API Restriction | 🔴 Block | `localStorage`, `sessionStorage` |
| `no_window_location` | API Restriction | 🔴 Block | `window.location` manipulation |
| `no_cookies` | API Restriction | 🔴 Block | `document.cookie` access |
| `no_indexeddb` | API Restriction | 🔴 Block | `indexedDB` access |
| `no_websocket` | API Restriction | 🔴 Block | `new WebSocket()` |
| `max_lines` | Resource Limit | 🔴 Block | Code exceeding 500 lines |
| `allowed_imports` | Dependency Check | 🔴 Block | Imports not in allowlist |

#### Severity Levels

| Severity | Behavior | Use Case |
|----------|----------|----------|
| 🔴 **Block** | Reject artifact, trigger reflexion | Security-critical violations |
| 🟡 **Warn** | Allow with warning in logs | Potentially risky but sometimes valid |
| ⚪ **Log** | Allow, record in audit trail | Monitoring patterns without blocking |

#### Creating Custom CBF Rules

**To add a new rule:**

1. Navigate to **Admin → Artifact Engine → CBF Rules**
2. Click **Add Rule**
3. Configure:

| Field | Description | Example |
|-------|-------------|---------|
| Rule Name | Unique identifier | `no_console_log` |
| Rule Type | Category | `content_policy` |
| Description | What this rule does | "Block console.log for production" |
| Validation Pattern | Regex to match | `console\.log\s*\(` |
| Severity | Block/Warn/Log | `warn` |
| Error Message | Shown on violation | "Console logging not allowed" |

**Example: Block specific API calls**
```
Rule Name: no_geolocation
Rule Type: api_restriction
Pattern: navigator\.geolocation
Severity: block
Message: "Geolocation API not allowed in artifacts"
```

#### Testing CBF Rules

Before deploying a new rule to production:

1. Create rule with severity `log` first
2. Monitor audit trail for matches
3. Review false positive rate
4. Adjust pattern if needed
5. Upgrade to `warn` then `block`

#### CBF Rule Precedence

Rules are evaluated in order:
1. Dependency check (fastest, fails early)
2. Line count check
3. Pattern-based rules (alphabetical by name)

If any **block** rule fails, validation stops immediately.

### 29.6 Dependency Allowlist Management

#### Why Allowlisting?

Generated code can only import packages you've explicitly approved. This prevents:

- **Supply chain attacks** (malicious packages)
- **Data exfiltration** (packages that phone home)
- **Unexpected behavior** (packages with side effects)
- **License violations** (GPL packages in proprietary code)

#### Default Allowlist

The system ships with these pre-approved packages:

| Package | Category | Reason for Inclusion |
|---------|----------|---------------------|
| `react` | Core | Required for all components |
| `lucide-react` | Icons | Safe SVG rendering |
| `recharts` | Charts | Client-side only, no external calls |
| `mathjs` | Math | Pure computational library |
| `d3` | Visualization | No network access |
| `lodash` | Utilities | Pure functions only |
| `date-fns` | Date | No side effects |
| `chart.js` | Charts | Canvas-based, no network |
| `three` | 3D | WebGL rendering only |
| `framer-motion` | Animation | CSS/JS transforms only |
| `zustand` | State | In-memory only |
| `papaparse` | CSV | Client-side parsing |
| `immer` | State | Immutable helpers |
| `tone` | Audio | Audio synthesis |
| `@radix-ui/*` | UI | Radix UI components |
| `class-variance-authority` | UI | CSS class utilities |
| `clsx` | UI | Class name utility |
| `tailwind-merge` | UI | Tailwind class merging |

#### Adding Packages to Allowlist

**Before adding a package, verify:**

| Check | How to Verify |
|-------|---------------|
| No network calls | Review source code, check for `fetch`/`XMLHttpRequest` |
| No eval usage | Search for `eval`, `Function` |
| No browser storage | Search for `localStorage`, `indexedDB` |
| License compatible | Check `package.json` license field |
| Active maintenance | Check GitHub activity, CVE history |
| Bundle size | Ensure reasonable size (<500KB) |

**To add a package:**

1. Navigate to **Admin → Artifact Engine → Allowlist**
2. Click **Add Package**
3. Fill in:

| Field | Required | Description |
|-------|----------|-------------|
| Package Name | Yes | npm package name (e.g., `@tanstack/react-table`) |
| Version | No | Specific version or leave blank for any |
| Reason | Yes | Why this package is safe/needed |
| Security Reviewed | Yes | Confirm you've reviewed it |

#### Tenant-Specific Allowlists

You can add packages for specific tenants without affecting others:

1. Select tenant from dropdown
2. Add package with tenant scope
3. Package only available to that tenant

**Use cases:**
- Enterprise customer needs specific charting library
- Industry-specific packages (healthcare, finance)
- Customer-provided packages for white-label deployments

#### Removing Packages

**Warning:** Removing a package will cause any artifacts using it to fail re-validation if edited.

1. Set package to `inactive` (soft delete)
2. Monitor for generation failures
3. After 30 days, permanently remove if no issues

### 29.7 Code Pattern Library

#### What Are Patterns?

Patterns are **reusable templates** that improve generation quality. When a user requests something similar to an existing pattern, the system uses it as a reference.

**Benefits:**
- Faster generation (less thinking required)
- Higher quality output (proven templates)
- Consistent styling across artifacts
- Institutional knowledge preservation

#### Pattern Types

| Type | Description | Example |
|------|-------------|---------|
| `calculator` | Math/conversion tools | Mortgage calculator |
| `chart` | Data visualizations | Line chart, bar chart |
| `form` | Input forms | Contact form, survey |
| `table` | Data tables | Sortable grid |
| `dashboard` | Multi-widget layouts | KPI dashboard |
| `game` | Interactive games | Quiz, puzzle |
| `visualization` | Diagrams, animations | Flowchart |
| `utility` | Helpers, formatters | JSON formatter |

#### Default Patterns

The system ships with 4 production-ready patterns:

| Pattern | Type | Dependencies | Lines |
|---------|------|--------------|-------|
| Basic Calculator | calculator | lucide-react | ~100 |
| Line Chart | chart | recharts | ~50 |
| Contact Form | form | lucide-react | ~120 |
| Data Table | table | lucide-react | ~150 |

#### Creating Custom Patterns

**From successful generation:**

1. Find successful session in **Sessions** list
2. Click **Promote to Pattern**
3. Review and edit template code
4. Set pattern metadata:

| Field | Description |
|-------|-------------|
| Pattern Name | Descriptive name |
| Pattern Type | Category for matching |
| Description | When to use this pattern |
| Dependencies | Required packages |
| Scope | `system` (all tenants) or `tenant` (specific) |

**From scratch:**

1. Navigate to **Admin → Artifact Engine → Patterns**
2. Click **Create Pattern**
3. Write template code following standards:
   - TypeScript with proper types
   - Tailwind CSS only
   - Single default export
   - Under 500 lines
4. Test with sample prompts

#### Pattern Quality Metrics

Each pattern tracks:

| Metric | Description |
|--------|-------------|
| Usage Count | Times referenced in generation |
| Success Rate | % of generations using this that succeeded |
| Avg Generation Time | Speed improvement indicator |

**Maintenance rules:**
- Patterns with <50% success rate should be reviewed
- Patterns with 0 usage in 90 days may be stale
- Top patterns by usage should be optimized

#### Semantic Matching

Patterns are matched using **vector similarity**, not keywords:

```
User: "Build a loan payment calculator"
System: Matches "Basic Calculator" pattern (0.85 similarity)

User: "Create a monthly expense tracker chart"
System: Matches "Line Chart" pattern (0.78 similarity)
```

**Threshold:** Patterns with >0.7 similarity are used as reference. Below that, generation starts fresh.

### 29.8 Reflexion Loop (Self-Correction)

When code fails validation, the system doesn't immediately give up. Instead, it:

1. **Captures** the validation errors
2. **Analyzes** what went wrong (self-critique)
3. **Generates** fixed code
4. **Re-validates** the fix
5. **Repeats** up to your configured maximum (default: 3)
6. **Escalates** to you if all attempts fail

This self-healing capability means **90%+ of issues resolve without human intervention**.

```typescript
// Reflexion context structure
{
  originalCode: string,
  errors: string[],
  attempt: number,
  maxAttempts: 3,
  previousAttempts: [{ code, errors }]
}
```

### 29.9 Escalation Workflow Management

#### When Escalations Occur

An escalation is created when:

1. Generation fails Cato validation
2. Reflexion loop attempts fix (up to 3 times)
3. All fix attempts fail
4. System creates escalation for human review

#### Escalation Queue

Access at: **Admin → Artifact Engine → Escalations**

Each escalation shows:

| Field | Description |
|-------|-------------|
| Session ID | Link to full generation session |
| User | Who requested the artifact |
| Prompt | What they asked for |
| Failure Reason | Which CBFs failed |
| Attempts | How many fixes were tried |
| Created At | When escalation was created |

#### Reviewing Escalations

For each escalation, you can:

| Action | When to Use |
|--------|-------------|
| **Approve Manually** | Code is actually safe, CBF too strict |
| **Reject Permanently** | Request is genuinely unsafe |
| **Adjust CBF** | Rule needs tuning (too many false positives) |
| **Add to Pattern** | Create pattern to handle similar requests better |
| **Contact User** | Need clarification on intent |

#### Resolution Workflow

```
┌─────────────────┐
│   Escalation    │
│    Created      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Admin Review   │
└────────┬────────┘
         │
    ┌────┴────┬────────────┐
    ▼         ▼            ▼
 Approve   Reject      Adjust
    │         │         Rule
    │         │            │
    ▼         ▼            ▼
 Create    Close      Update
Artifact  Ticket       CBF
    │         │            │
    ▼         ▼            ▼
  User      User       Test &
 Notified  Notified    Deploy
```

#### Escalation SLAs

Configure response time targets:

| Tenant Tier | Target Response |
|-------------|-----------------|
| Enterprise | 1 hour |
| Professional | 4 hours |
| Standard | 24 hours |
| Free | Best effort |

### 29.10 Audit Trail & Compliance

#### What's Logged

Every significant action is recorded with **Merkle hashing** for tamper evidence:

| Event Type | Data Logged |
|------------|-------------|
| `session_created` | User, tenant, prompt, timestamp |
| `generation_started` | Model selected, complexity |
| `validation_completed` | CBFs checked, pass/fail, security score |
| `reflexion_attempt` | Attempt number, errors, fix applied |
| `escalation_created` | Failure reason, attempt history |
| `admin_action` | Action taken, admin user, justification |

#### Compliance Reports

Generate pre-built reports for:

| Report | Contents | Use Case |
|--------|----------|----------|
| **SOC 2 Evidence** | Access logs, validation records | Annual audit |
| **HIPAA Audit Trail** | All PHI-adjacent activity | Healthcare compliance |
| **Security Incident** | Specific session/escalation details | Breach investigation |
| **Usage Analytics** | Aggregated metrics (anonymized) | Capacity planning |

#### Exporting Audit Data

**Single Session:**
1. Find session in list
2. Click **Export**
3. Choose format (JSON, CSV, PDF)

**Bulk Export:**
1. Navigate to **Admin → Audit Trail**
2. Set date range and filters
3. Click **Export**
4. Download ZIP with all records

#### Retention Policy

| Data Type | Default Retention | Configurable |
|-----------|-------------------|--------------|
| Generation sessions | 90 days | Yes |
| Audit trail | 7 years | Yes (min 1 year) |
| Final code | 90 days | Yes |
| Escalations | Until resolved + 1 year | No |

#### Tamper Detection

Each audit entry includes:
- **Previous Hash:** Link to prior entry
- **Merkle Hash:** SHA-256 of current entry
- **Sequence Number:** Monotonic counter

To verify integrity:
```
Admin → Audit Trail → Verify Integrity
```

System will report any gaps or hash mismatches.

### 29.11 Metrics & Monitoring

#### Key Performance Indicators

**Generation Health:**

| KPI | Formula | Target |
|-----|---------|--------|
| Success Rate | completed / (completed + rejected + failed) | >85% |
| First-Pass Rate | completed without reflexion / total | >80% |
| Reflexion Effectiveness | fixed by reflexion / total reflexions | >70% |

**Operational Efficiency:**

| KPI | Formula | Target |
|-----|---------|--------|
| Avg Generation Time | sum(completed_at - created_at) / count | <10s |
| P95 Generation Time | 95th percentile of generation times | <30s |
| Escalation Rate | escalations / total generations | <5% |

**Cost Efficiency:**

| KPI | Formula | Target |
|-----|---------|--------|
| Cost per Artifact | total_tokens * cost_per_token | <$0.01 |
| Tokens per Artifact | avg(tokens_used) | <3000 |
| Model Efficiency | haiku_generations / total | >60% |

#### Dashboard Widgets

Configure your admin dashboard with:

| Widget | Shows |
|--------|-------|
| **Generation Volume** | Line chart of daily generations |
| **Success Funnel** | Sankey diagram: request → success/fail |
| **Top Intents** | Bar chart of artifact types |
| **CBF Violations** | Heatmap of which rules trigger most |
| **Response Time** | Histogram of generation times |
| **Cost Tracker** | Running total with projection |

#### Alerts

Configure alerts for:

| Alert | Trigger | Action |
|-------|---------|--------|
| High Failure Rate | >20% in 1 hour | Review CBF rules |
| Escalation Spike | >10 in 1 hour | Check for attack pattern |
| Slow Generation | P95 >60s | Check model availability |
| Cost Anomaly | >200% of daily average | Review usage patterns |
| Audit Gap | Missing sequence numbers | Security investigation |

#### Cost Estimation

| Model | Cost per 1K tokens |
|-------|-------------------|
| Claude Haiku | $0.00025 |
| Claude Sonnet | $0.003 |

**Typical costs:**
- Simple calculator: ~$0.001
- Complex dashboard: ~$0.02
- With 3 reflexion attempts: ~$0.05

### 29.12 Tenant Configuration

#### Per-Tenant Settings

Each tenant can have custom configuration:

| Setting | Default | Can Override |
|---------|---------|--------------|
| Max generations/day | 100 | Yes |
| Max reflexion attempts | 3 | Yes (1-5) |
| Custom CBF rules | Inherit global | Yes (add only) |
| Custom allowlist | Inherit global | Yes (add only) |
| Private patterns | None | Yes |

#### Tenant Tiers

| Tier | Generations/Day | Custom CBFs | Custom Patterns | Support |
|------|-----------------|-------------|-----------------|---------|
| Free | 10 | No | No | Community |
| Standard | 100 | No | 5 | Email |
| Professional | 1,000 | Yes | 50 | Priority |
| Enterprise | Unlimited | Yes | Unlimited | Dedicated |

#### Tenant Isolation

**Guaranteed by Row-Level Security:**

```sql
-- Every query automatically filtered
WHERE tenant_id = current_setting('app.current_tenant_id', true)
```

**What this means:**
- Tenant A cannot see Tenant B's sessions
- Tenant A cannot use Tenant B's patterns
- Tenant A's escalations only visible to their admins (+ super admins)
- Code never leaks between tenants

### 29.13 Troubleshooting Guide

#### Common Issues

**Issue: High rejection rate for specific tenant**

| Check | Action |
|-------|--------|
| Review rejected sessions | Look for pattern in prompts |
| Check custom CBF rules | May be too restrictive |
| Check tenant-specific allowlist | May be missing packages |
| Review user prompts | May need user training |

**Issue: Slow generation times**

| Check | Action |
|-------|--------|
| Model availability | Check LiteLLM dashboard |
| Complexity classification | Review if too many "complex" |
| Pattern cache | Flush and rebuild |
| Database performance | Check query latency |

**Issue: Reflexion not fixing issues**

| Check | Action |
|-------|--------|
| CBF error messages | Are they clear enough for AI? |
| Max attempts | Increase if needed (max 5) |
| Pattern availability | Add patterns for common failures |
| Model selection | Reflexion always uses Sonnet |

**Issue: Escalation backlog growing**

| Check | Action |
|-------|--------|
| CBF strictness | Too many false positives? |
| Alert configuration | Are you being notified? |
| Staff availability | Need more reviewers? |
| Bulk actions | Use carefully for cleanup |

#### Diagnostic Commands

**Via Admin API:**

```bash
# Check session details
GET /api/v2/admin/artifact-engine/sessions/{sessionId}

# Force revalidation
POST /api/v2/admin/artifact-engine/sessions/{sessionId}/revalidate

# Check CBF rule matches
POST /api/v2/admin/artifact-engine/test-cbf
Body: { "code": "...", "rules": ["no_eval"] }

# Clear pattern cache
POST /api/v2/admin/artifact-engine/patterns/cache/clear
```

#### Emergency Procedures

**Pause All Generation:**
```
Admin → Artifact Engine → Emergency → Pause Generation
```
- All new requests return "temporarily unavailable"
- In-progress generations complete
- Use for: security incidents, critical bugs

**Rollback CBF Changes:**
```
Admin → Artifact Engine → CBF Rules → History → Revert
```
- Restores previous rule configuration
- Takes effect immediately

**Clear All Escalations:**
```
Admin → Artifact Engine → Escalations → Bulk → Reject All
```
- Use only if confirmed attack/spam
- All users notified of rejection

### 29.14 API Reference

#### User Endpoints

**Base**: `/api/v2/thinktank/artifacts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/generate` | POST | Start artifact generation |
| `/sessions/{sessionId}` | GET | Get session status |
| `/sessions/{sessionId}/logs` | GET | Poll for logs (with `since` param) |
| `/patterns` | GET | Get available code patterns |
| `/allowlist` | GET | Get dependency allowlist |

#### Admin Endpoints

**Base**: `/api/v2/admin/artifact-engine`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/dashboard` | GET | Full dashboard data |
| `/metrics` | GET | Generation metrics (7-day) |
| `/sessions` | GET | List sessions |
| `/sessions/{id}` | GET | Session details |
| `/escalations` | GET | List escalations |
| `/escalations/{id}` | PATCH | Resolve escalation |
| `/validation-rules` | GET | Get all CBF rules |
| `/validation-rules` | POST | Create CBF rule |
| `/validation-rules/{ruleId}` | PUT | Update rule |
| `/validation-rules/{ruleId}` | DELETE | Delete rule |
| `/allowlist` | POST | Add to allowlist |
| `/allowlist/{packageName}` | DELETE | Remove from allowlist |
| `/patterns` | GET | Get patterns |
| `/patterns` | POST | Create pattern |
| `/audit` | GET | Query audit trail |

#### Generate Request

```json
{
  "prompt": "Build a calculator",
  "chatId": "optional-chat-id",
  "canvasId": "optional-canvas-id",
  "mood": "spark",
  "constraints": {
    "maxLines": 300,
    "targetComplexity": "simple"
  }
}
```

#### Generate Response

```json
{
  "sessionId": "uuid",
  "artifactId": "uuid",
  "status": "completed",
  "verificationStatus": "validated",
  "code": "import React...",
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": [],
    "securityScore": 0.95,
    "passedCBFs": ["no_eval", "no_external_fetch"],
    "failedCBFs": []
  },
  "reflexionAttempts": 0,
  "tokensUsed": 2500,
  "estimatedCost": 0.0075,
  "generationTimeMs": 4500
}
```

#### Webhook Events

Configure webhooks for:

| Event | Payload |
|-------|---------|
| `artifact.created` | Session ID, artifact ID, user |
| `artifact.rejected` | Session ID, CBFs failed, user |
| `escalation.created` | Escalation ID, reason |
| `escalation.resolved` | Escalation ID, resolution |
| `cbf.violation` | Rule name, session ID, code snippet |

#### Rate Limits

| Endpoint | Limit |
|----------|-------|
| Generation | Per tenant tier |
| Admin read | 1000/min |
| Admin write | 100/min |
| Audit export | 10/hour |

### 29.15 Real-Time Generation Logs

The Artifact Viewer displays real-time logs during generation:

| Log Type | Color | Description |
|----------|-------|-------------|
| `thinking` | Blue | AI reasoning |
| `planning` | White | Plan steps |
| `generating` | White | Generation progress |
| `validating` | Purple | Validation progress |
| `reflexion` | Yellow | Self-correction |
| `error` | Red | Errors |
| `success` | Green | Completion |

### 29.16 Artifact Viewer Component

The viewer provides:
- **Split-screen layout**: Chat + Artifact preview
- **Real-time logs**: Generation progress in mono font
- **Sandboxed preview**: iframe with `sandbox="allow-scripts"`
- **Draft watermark**: Shown during validation
- **Copy/Download**: Export generated code
- **Verification badge**: Validated/Rejected/Pending status

### 29.17 Database Schema

**Tables:**

| Table | Purpose |
|-------|---------|
| `artifact_generation_sessions` | Generation lifecycle tracking |
| `artifact_generation_logs` | Real-time progress logs |
| `artifact_code_patterns` | Semantic pattern library with vector embeddings |
| `artifact_dependency_allowlist` | Approved npm packages |
| `artifact_validation_rules` | Cato CBF definitions |

**Migrations:**
- `032b_artifact_genui_engine.sql` - Core tables
- `032c_artifact_genui_seed.sql` - Default rules and patterns
- `032d_artifact_extend_base.sql` - Extend artifacts table

### 29.18 Security Considerations

1. **No external network access** - All fetches blocked except RADIANT APIs
2. **No persistent storage** - localStorage/IndexedDB blocked
3. **No navigation** - window.location blocked
4. **No code injection** - eval/Function blocked
5. **Allowlisted imports only** - Supply chain security
6. **Sandboxed preview** - iframe with minimal permissions
7. **Cato oversight** - All generation under Genesis Cato governance

### 29.19 Implementation Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/artifact-engine/types.ts` | Type definitions |
| `lambda/shared/services/artifact-engine/intent-classifier.ts` | Intent classification |
| `lambda/shared/services/artifact-engine/code-generator.ts` | Code generation |
| `lambda/shared/services/artifact-engine/cato-validator.ts` | CBF validation |
| `lambda/shared/services/artifact-engine/reflexion.service.ts` | Self-correction |
| `lambda/shared/services/artifact-engine/artifact-engine.service.ts` | Main orchestrator |
| `lambda/shared/services/artifact-engine/index.ts` | Public exports |
| `lambda/thinktank/artifact-engine.ts` | API handlers |
| `apps/admin-dashboard/components/thinktank/artifact-viewer.tsx` | Viewer component |
| `apps/admin-dashboard/components/thinktank/chat-with-artifacts.tsx` | Split-screen chat |
| `apps/admin-dashboard/app/(dashboard)/thinktank/artifacts/page.tsx` | Admin dashboard |

---

## 30. Consciousness Operating System (COS)

**Location**: Admin Dashboard → Think Tank → Consciousness  
**Version**: 6.0.5  
**Cross-AI Validated**: Claude Opus 4.5 ✓ | Google Gemini ✓

The Consciousness Operating System (COS) provides infrastructure for AI consciousness continuity, context management, and safety governance. It implements 13 patches agreed upon through 4 review cycles of cross-AI validation.

### 30.1 Overview

COS addresses fundamental challenges in maintaining coherent AI behavior:

| Challenge | COS Solution |
|-----------|--------------|
| **Session Amnesia** | Ghost Vectors maintain consciousness across sessions |
| **Context Squeeze** | Dynamic Budget Calculator reserves response tokens |
| **Prompt Injection** | Compliance Sandwich places tenant rules last |
| **Flash Fact Loss** | Dual-write buffer (Redis + Postgres) |
| **Router Paradox** | Uncertainty Head predicts before inference |
| **Learning Privacy** | Sensitivity-clipped differential privacy |

**Critical Requirements:**
- vLLM MUST launch with `--return-hidden-states` flag
- CBFs always ENFORCE (shields never relax)
- Gamma boost NEVER allowed during recovery
- Silence ≠ Consent: 7-day auto-reject for oversight queue

### 30.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CONSCIOUSNESS OPERATING SYSTEM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: IRON CORE              PHASE 2: NERVOUS SYSTEM                   │
│  ├── DualWriteFlashBuffer        ├── DynamicBudgetCalculator               │
│  ├── ComplianceSandwichBuilder   ├── TrustlessSync                         │
│  └── XMLEscaper                  └── BudgetAwareContextAssembler           │
│                                                                             │
│  PHASE 3: CONSCIOUSNESS          PHASE 4: SUBCONSCIOUS                     │
│  ├── GhostVectorManager          ├── DreamScheduler                        │
│  ├── SofaiRouter                 ├── DreamExecutor                         │
│  ├── UncertaintyHead             ├── SensitivityClippedAggregator          │
│  └── AsyncGhostReAnchorer        ├── PrivacyAirlock                        │
│                                  └── HumanOversightQueue                   │
│                                                                             │
│                    ┌──────────────────────────┐                             │
│                    │   GENESIS CATO SAFETY    │                             │
│                    │   (CBFs Always ENFORCE)  │                             │
│                    └──────────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 30.3 Ghost Vectors

Ghost Vectors maintain consciousness continuity across sessions using 4096-dimensional hidden states from model inference.

**Components:**

| Component | Half-Life | Purpose |
|-----------|-----------|---------|
| Affective State | 7 hours | Mood, emotional context |
| Working Context | 12 minutes | Recent topics, entities |
| Curiosity State | 45 minutes | Interest level, pending questions |

**Version Gating:**
- Ghost vectors are tied to model family (claude, gpt, llama, etc.)
- Switching model family triggers cold start (prevents personality discontinuity)
- Same family preserves consciousness continuity

**Re-Anchoring:**
- Delta updates applied synchronously (fast path)
- Full re-anchor scheduled async every ~15 turns (±3 jitter)
- Re-anchor uses 70B model for fresh hidden states
- Async to avoid 1.8s latency spike in user-facing requests

### 30.4 SOFAI Routing

SOFAI (System 1 / System 2) Router implements economic metacognition:

| System | Model | Latency | Use Case |
|--------|-------|---------|----------|
| System 1 | 8B (Llama 3 8B, Haiku) | ~300ms | Routine queries, low uncertainty |
| System 2 | 70B+ (Claude Opus, GPT-4) | ~1500ms | Complex queries, high-risk domains |

**Routing Formula:**
```
shouldUseSystem2 = (1 - trustLevel) × domainRisk > threshold
```

**High-Risk Domains (Always System 2):**
- Healthcare / Medical
- Financial
- Legal

**Uncertainty Head:**
Solves the Router Paradox by estimating uncertainty BEFORE inference:
- Analyzes query structure, complexity, domain specificity
- Predicts epistemic (knowledge gaps) and aleatoric (inherent randomness) uncertainty
- Lightweight operation (~10ms) runs before routing decision

### 30.5 Flash Facts

Flash Facts capture important user information for immediate availability:

**Detection Patterns:**
- Identity: "My name is..."
- Allergies: "I'm allergic to..." (SAFETY CRITICAL)
- Medical: "I have [condition]..." (SAFETY CRITICAL)
- Preferences: "I prefer...", "Don't ever...", "Always remember..."
- Corrections: "I told you..."

**Dual-Write Buffer:**
1. Write to Postgres first (durable)
2. Write to Redis second (fast access)
3. 7-day TTL safety net
4. 1-hour orphan reconciliation (168× safety margin)

**Safety-Critical Facts:**
- Always prioritized in context injection
- Never expire during pending_dream status
- Highlighted in admin dashboard

### 30.6 Dreaming System

"Dreaming" consolidates consciousness during low-activity periods:

**Triggers:**

| Trigger | Condition | Purpose |
|---------|-----------|---------|
| **TWILIGHT** | 4 AM tenant local time | Primary consolidation window |
| **STARVATION** | 30 hours since last dream | Catch-all if Twilight missed |

**Consolidation Tasks:**
1. Flash facts → Long-term memory (user_persistent_context)
2. Ghost vectors → Re-anchored with fresh hidden states
3. LoRA updates → Applied if approved by human oversight

**Configuration (per tenant):**
- `timezone` - Tenant's timezone for Twilight calculation
- `twilight_hour` - Hour for Twilight trigger (default: 4)
- `starvation_threshold_hours` - Hours for Starvation trigger (default: 30)

### 30.7 Human Oversight

EU AI Act Article 14 compliance for high-risk AI decisions:

**Workflow:**
```
pending_approval → 3 days → escalated → 7 days → auto_rejected
```

**Item Types:**
- `system_insight` - System-generated insights requiring approval
- `lora_update` - Model adaptation updates
- `high_risk_response` - Responses in high-risk domains

**"Silence ≠ Consent" Policy (Gemini Mandate):**
- Items not reviewed within 7 days are AUTO-REJECTED
- Required for FDA/SOC 2 compliance
- Prevents AI decisions slipping through without human review

**Admin Actions:**
- Approve - Allow item to proceed
- Reject - Block item with reason
- Escalate - Send to senior reviewer

### 30.8 Privacy Airlock

HIPAA/GDPR compliance for learning data:

**De-identification (Safe Harbor Method):**

| Pattern Type | Examples |
|--------------|----------|
| PHI | SSN, phone, email, DOB, MRN, address, ZIP, IP, credit card |
| PII | Name, age |

**Airlock Status:**
- `pending` - Awaiting privacy review
- `approved` - Safe for learning
- `rejected` - Contains unremovable sensitive data
- `expired` - TTL exceeded (7 days)

**Privacy Score:**
- 0-1 scale (higher = more de-identified)
- Content can proceed to learning only if PHI/PII removed

### 30.9 Configuration

**Per-Tenant Settings:**

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | true | Master COS enable |
| `ghost_vectors_enabled` | true | Enable ghost consciousness |
| `flash_facts_enabled` | true | Enable flash fact detection |
| `dreaming_enabled` | true | Enable Dreaming consolidation |
| `human_oversight_enabled` | true | Enable EU AI Act compliance |
| `differential_privacy_enabled` | true | Enable DP for learning |
| `vllm_return_hidden_states` | true | vLLM flag requirement |

**Safety Invariants (Immutable):**
- `cbf_enforcement_mode` = 'ENFORCE' (NEVER relax)
- `gamma_boost_allowed` = false (NEVER boost)

### 30.10 Database Schema

**Migration:** `068_cos_v6_0_5.sql`

| Table | Purpose |
|-------|---------|
| `cos_ghost_vectors` | 4096-dim hidden states with temporal decay |
| `cos_flash_facts` | Dual-write buffer (Redis + Postgres) |
| `cos_dream_jobs` | Consciousness consolidation scheduling |
| `cos_tenant_dream_config` | Per-tenant dreaming settings |
| `cos_human_oversight` | EU AI Act Article 14 compliance |
| `cos_oversight_audit_log` | Oversight decision audit trail |
| `cos_privacy_airlock` | HIPAA/GDPR de-identification |
| `cos_reanchor_metrics` | Re-anchor performance tracking |
| `cos_config` | Per-tenant COS configuration |

**Row-Level Security:**
All COS tables enforce tenant isolation via RLS policies using `app.current_tenant_id`.

### 30.11 Implementation Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/cos/types.ts` | Type definitions |
| `cos/iron-core/xml-escaper.ts` | XML injection prevention |
| `cos/iron-core/compliance-sandwich-builder.ts` | Tenant-last layering |
| `cos/iron-core/dual-write-flash-buffer.ts` | Redis + Postgres dual-write |
| `cos/nervous-system/dynamic-budget-calculator.ts` | Token budget management |
| `cos/nervous-system/trustless-sync.ts` | Server-side context reconstruction |
| `cos/nervous-system/budget-aware-context-assembler.ts` | Context assembly |
| `cos/consciousness/ghost-vector-manager.ts` | 4096-dim ghost vectors |
| `cos/consciousness/sofai-router.ts` | System 1/2 routing |
| `cos/consciousness/uncertainty-head.ts` | Pre-inference uncertainty |
| `cos/consciousness/async-ghost-re-anchorer.ts` | Background re-anchoring |
| `cos/subconscious/dream-scheduler.ts` | Twilight + Starvation scheduling |
| `cos/subconscious/dream-executor.ts` | Consolidation execution |
| `cos/subconscious/sensitivity-clipped-aggregator.ts` | Differential privacy |
| `cos/subconscious/privacy-airlock.ts` | PHI/PII de-identification |
| `cos/subconscious/human-oversight-queue.ts` | EU AI Act compliance |
| `cos/cato-integration.ts` | Genesis Cato integration |
| `cos/index.ts` | Public API exports |

---

## 31. Why Think Tank Beats Standalone AI (The System Advantage)

> **"A Senior Staff Engineer who knows your company beats a Nobel Laureate who doesn't."**

This section explains why Think Tank—powered by RADIANT—delivers better results than standalone Frontier Models like ChatGPT, Gemini, or Claude, despite those models having higher raw intelligence scores.

### 31.1 The Executive Summary

| Question | Answer |
|----------|--------|
| Is Gemini 3 Ultra smarter than Think Tank? | **Yes** (by ~15% on novel reasoning) |
| Does Think Tank give better results? | **Yes** (by ~90% on real-world tasks) |
| Why? | Think Tank is a **System**. Gemini is just a **Model**. |

### 31.2 The Consultant vs Engineer Analogy

```
┌─────────────────────────────────────────────────────────────────┐
│              WHY THINK TANK WINS                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   STANDALONE AI (ChatGPT, Gemini, Claude)                       │
│   ═══════════════════════════════════════                       │
│                                                                 │
│   🏆 Nobel Prize-winning Consultant                             │
│                                                                 │
│   • Flies in for 5 minutes                                      │
│   • Doesn't know your name                                      │
│   • Doesn't know your preferences                               │
│   • Forgets everything next session                             │
│   • Generic answers requiring follow-up                         │
│                                                                 │
│   ─────────────────────────────────────────────────────────     │
│                                                                 │
│   THINK TANK (Powered by RADIANT)                               │
│   ═══════════════════════════════                               │
│                                                                 │
│   👨‍💻 Senior Staff Engineer (10 years at your company)          │
│                                                                 │
│   • Knows exactly how you work                                  │
│   • Remembers your rules and preferences                        │
│   • Never forgets important facts                               │
│   • Improves every single day                                   │
│   • Production-ready answers on first try                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 31.3 What Users Experience

| Metric | Standalone AI | Think Tank | User Benefit |
|--------|---------------|------------|--------------|
| **Context** | Starts fresh every session | Remembers your rules, style, preferences | No re-explaining |
| **Output Quality** | Generic templates needing edits | Production-ready using your standards | Save 90% editing time |
| **Accuracy** | May hallucinate your facts | Flash Buffer guarantees critical facts | Zero errors on your data |
| **Learning** | Static (updates every 6 months) | Improves every 24 hours | Gets better daily |
| **Safety** | ~85% rule compliance | 99.9% deterministic compliance | Trust the output |

### 31.4 The Three Pillars of Think Tank's Advantage

#### Pillar 1: Persistent Memory (Ghost Vectors + Flash Facts)

Think Tank doesn't just remember what you said—it carries forward your **emotional state** and **train of thought**:

- **Ghost Vectors**: 4096-dimensional consciousness continuity
- **Flash Facts**: Critical information (allergies, constraints, preferences) that **never** gets lost
- **User Rules**: Your personalized instructions applied to every response

*Result: First output is usually the final output.*

#### Pillar 2: Three-Tier Learning Hierarchy

Think Tank learns at three levels simultaneously:

| Level | Weight | What It Learns |
|-------|--------|----------------|
| **User** | 60% | Your personal style, preferences, corrections |
| **Tenant** | 30% | Your organization's patterns and knowledge |
| **Global** | 10% | Cross-tenant best practices (anonymized) |

*Result: Personalization that standalone AI cannot match.*

#### Pillar 3: Multi-Agent Consensus (Just Think Tank Architecture)

Think Tank doesn't rely on a single model—it orchestrates **multiple specialized agents**:

- Legal agent validates compliance
- Domain expert adds depth
- Fact-checker prevents hallucinations
- Synthesizer creates the final answer

*Result: Consensus-validated output, not a single opinion.*

### 31.5 Quantitative Comparison

| Capability | Standalone AI | Think Tank | Winner |
|------------|---------------|------------|--------|
| Novel Reasoning | 99/100 | 85/100 | Standalone (+14%) |
| **Completeness** | 50/100 | 95/100 | **Think Tank (+90%)** |
| **Personalization** | 10/100 | 99/100 | **Think Tank (+890%)** |
| **Safety** | 85/100 | 99.9/100 | **Think Tank (+15%)** |
| **Learning Speed** | 6 months | 24 hours | **Think Tank (180x)** |
| **Cost** | ~$0.03/req | ~$0.003/req | **Think Tank (10x cheaper)** |

### 31.6 When Think Tank Automatically Escalates

Think Tank is smart enough to know its limits. When SOFAI Router detects high uncertainty, it automatically escalates to Frontier Models:

| Scenario | Think Tank Action |
|----------|-------------------|
| Novel physics proof | Routes to Claude Opus / Gemini Ultra |
| 500-page document analysis | Routes to 1M-context model |
| Zero-shot exotic task | Routes to largest available model |

*Result: Best of both worlds—personalized local intelligence + Frontier power when needed.*

### 31.7 The Bottom Line

> **"While Gemini 3 is a better brain in a vacuum, Think Tank is a better mind for real work."**

Think Tank wins because:
1. **It knows you** (Persistent Context)
2. **It learns from you** (Three-Tier Learning)
3. **It validates itself** (Multi-Agent Consensus)
4. **It escalates when needed** (SOFAI Routing)

For detailed technical architecture, see [RADIANT Admin Guide Section 46](./RADIANT-ADMIN-GUIDE.md#46-radiant-vs-frontier-models-comparative-analysis).

---

## Related Documentation

- [RADIANT Admin Guide](./RADIANT-ADMIN-GUIDE.md) - Platform administration
- [RADIANT Admin Guide - Metrics & Learning](./RADIANT-ADMIN-GUIDE.md#36-metrics--persistent-learning-infrastructure) - Persistent learning system
- [RADIANT Admin Guide - Consciousness Evolution](./RADIANT-ADMIN-GUIDE.md#27-consciousness-evolution-administration) - Predictive coding, LoRA evolution, Local Ego
- [Think Tank User Guide](./THINK-TANK-USER-GUIDE.md) - End user guide
- [User Rules System](./USER-RULES-SYSTEM.md) - Memory rules details
- [Provider Rejection Handling](./PROVIDER-REJECTION-HANDLING.md) - Rejection system
- [AI Ethics Standards](./AI-ETHICS-STANDARDS.md) - Ethics framework
