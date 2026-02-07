# RADIANT Delight System Guide

> **Version**: 7.27.0
> **Last Updated**: February 2026
> **Audience**: Platform Admins, Think Tank Admins, Developers, AI Agents

---

## Table of Contents

1. [What Is Delight?](#1-what-is-delight)
2. [Philosophy & Design Principles](#2-philosophy--design-principles)
3. [Architecture Overview](#3-architecture-overview)
4. [Personality Modes](#4-personality-modes)
5. [Injection Points](#5-injection-points)
6. [Backend Services](#6-backend-services)
7. [Frontend: Think Tank (Native)](#7-frontend-think-tank-native)
8. [Frontend: Cross-App (@radiant/delight-ui)](#8-frontend-cross-app-radiantdelight-ui)
9. [Database Schema](#9-database-schema)
10. [API Reference](#10-api-reference)
11. [Admin Management](#11-admin-management)
12. [Achievements System](#12-achievements-system)
13. [Easter Eggs](#13-easter-eggs)
14. [Sound Effects](#14-sound-effects)
15. [Real-Time Events (SSE)](#15-real-time-events-sse)
16. [AGI Brain Integration](#16-agi-brain-integration)
17. [Per-App Configurations](#17-per-app-configurations)
18. [User Preferences](#18-user-preferences)
19. [Auto Mode Resolution](#19-auto-mode-resolution)
20. [Analytics & Engagement](#20-analytics--engagement)
21. [Developer Guide](#21-developer-guide)
22. [Enforcement Policy](#22-enforcement-policy)
23. [File Inventory](#23-file-inventory)

---

## 1. What Is Delight?

**Delight** is RADIANT's personality and UX experience layer. It is the system that makes every AI interaction feel alive, empathetic, and human — not robotic. Delight operates across **every user-facing RADIANT application** and manifests as contextual micro-copy, sound effects, achievements, easter eggs, and personality-aware messaging at every stage of the user's journey.

### Definition

> **Delight** is a multi-layered UX system that provides personality-aware feedback at every stage of AI interaction — before, during, and after execution. It adapts its tone based on personality mode, time of day, knowledge domain, query complexity, model consensus, and session duration. It rewards engagement through achievements, surprises users with easter eggs, and makes errors feel recoverable rather than catastrophic.

### What Delight Is NOT

- **Not cosmetic**: Delight is architecturally integrated into the AGI Brain Planner, not bolted on
- **Not optional**: Every user-facing app MUST integrate Delight (see [Enforcement Policy](#22-enforcement-policy))
- **Not one-size-fits-all**: Messages adapt to 5 personality modes and contextual signals
- **Not Think Tank-only**: Delight spans Curator, Dojo, Think Tank Admin, Tenant Admin, and all future apps

### Why Delight Matters

1. **Emotional Resonance**: Users form stronger bonds with software that acknowledges their actions
2. **Error Recovery**: Empathetic error messages reduce user frustration and abandonment
3. **Engagement**: Achievements and easter eggs create a discovery loop that drives retention
4. **Differentiation**: No competing AI platform has a personality system this deep
5. **Trust**: Progress messages during long operations reduce perceived wait time by up to 40%

---

## 2. Philosophy & Design Principles

### The Three Phases

Every user interaction has three phases, and Delight is present in all of them:

| Phase | What Happens | Delight's Role |
|-------|-------------|----------------|
| **Pre-Execution** | User submits a request | Acknowledge the request, set expectations, show domain awareness |
| **During Execution** | AI models are working | Narrate progress, show step-by-step activity, maintain engagement |
| **Post-Execution** | Result is delivered | Celebrate success, offer next steps, record achievements |

### Design Principles

1. **Respectful**: Never patronize. Professional mode exists for users who want minimal flair
2. **Contextual**: A legal query gets different messages than a creative writing prompt
3. **Adaptive**: Time-of-day, session length, and domain all influence tone
4. **Granular Control**: Users choose their personality mode; admins manage message catalogs
5. **Fail Gracefully**: If the Delight backend is unavailable, client-side fallbacks take over
6. **Tenant-Isolated**: Each tenant's delight preferences, achievements, and analytics are isolated via RLS

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER-FACING APPS                            │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐ │
│  │Think Tank│  │ Curator  │  │   Dojo   │  │TT Admin  │  │Tenant│ │
│  │(native   │  │(@radiant/│  │(@radiant/│  │(@radiant/│  │Admin │ │
│  │Delight)  │  │delight-ui│  │delight-ui│  │delight-ui│  │      │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──┬───┘ │
│       │              │              │              │           │     │
│       └──────────────┴──────────────┴──────────────┴───────────┘     │
│                              │                                      │
│                    ┌─────────▼─────────┐                            │
│                    │  Delight API      │                            │
│                    │  (Lambda Handler) │                            │
│                    └─────────┬─────────┘                            │
│                              │                                      │
│              ┌───────────────┼───────────────┐                      │
│              │               │               │                      │
│    ┌─────────▼──┐  ┌────────▼───┐  ┌────────▼──────────┐          │
│    │  Delight   │  │  Delight   │  │  Delight Events   │          │
│    │  Service   │  │Orchestration│  │  Service (SSE)    │          │
│    │            │  │  Service   │  │                    │          │
│    └─────────┬──┘  └────────┬───┘  └───────────────────┘          │
│              │               │                                      │
│              │    ┌──────────▼────────┐                             │
│              │    │  AGI Brain        │                             │
│              │    │  Planner          │                             │
│              │    └───────────────────┘                             │
│              │                                                      │
│    ┌─────────▼──────────────────────┐                              │
│    │  Aurora PostgreSQL             │                              │
│    │  (delight_*, user_delight_*)   │                              │
│    └────────────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Layers

| Layer | Technology | Role |
|-------|-----------|------|
| **Frontend (Think Tank)** | React Context + framer-motion | Native CLARION delight with chemistry moments |
| **Frontend (Cross-App)** | `@radiant/delight-ui` package | Universal provider, toast UI, personality persistence |
| **API** | Lambda handler (`delight/handler.ts`) | REST endpoints for messages, preferences, achievements, easter eggs |
| **Core Service** | `delight.service.ts` | Message selection, caching, filtering, CRUD, analytics |
| **Orchestration** | `delight-orchestration.service.ts` | Maps AGI Brain workflow events to Delight triggers |
| **Events** | `delight-events.service.ts` | Real-time SSE streaming of delight events during plan execution |
| **Database** | Aurora PostgreSQL | Messages, categories, achievements, easter eggs, sounds, preferences, event log |

---

## 4. Personality Modes

Users select their preferred personality mode. All apps **MUST** respect this setting.

| Mode | Behavior | Example Message |
|------|----------|----------------|
| **`auto`** | Adapts based on time, domain, session length (see [Auto Mode Resolution](#19-auto-mode-resolution)) | *(varies by context)* |
| **`professional`** | Clean, minimal, business-focused. Suppresses idle and session_start messages | "Operation completed successfully." |
| **`subtle`** | Light touches, mostly informative. Low intensity | "Done." |
| **`expressive`** | Engaging, helpful, enthusiastic. Default for most contexts | "Nailed it! All done!" |
| **`playful`** | Fun, witty, creative. Uses humor and pop-culture references | "Another one bites the dust!" |

### Intensity Levels

In addition to mode, users can set an **intensity level** (1–10):

- **1–3**: Only essential messages (errors, completions)
- **4–6**: Standard delight (default: 5)
- **7–10**: Full delight with ambient messages, wellbeing nudges, and frequent achievements

---

## 5. Injection Points

Injection points define **when** Delight messages appear. There are 11 standard injection points:

| Injection Point | When | Required? | Sound? |
|----------------|------|-----------|--------|
| `page_load` | App or page first renders | Recommended | No |
| `session_start` | New user session begins | Recommended | No |
| `pre_execution` | Before an async operation starts | Required for long ops | `transition_whoosh` |
| `during_execution` | While operation is running (>2s) | Required for long ops | No |
| `post_execution` | After successful operation | **Required** | `confirm_chime` |
| `action_complete` | After save/update/delete | **Required** | `confirm_subtle` |
| `error_recovery` | On operation failure | **Required** | `error` |
| `milestone` | Achievement unlocked or milestone reached | Recommended | `milestone` |
| `onboarding` | First-time user experience | Recommended | No |
| `session_end` | User logs out or session ends | Optional | No |
| `idle` | Extended inactivity (expressive/playful only) | Optional | No |

### Trigger Types (Backend)

The backend service uses more granular trigger types within injection points:

| Trigger Type | Description |
|-------------|-------------|
| `domain_loading` | Loading domain-specific knowledge |
| `domain_transition` | Switching between knowledge domains |
| `time_aware` | Time-of-day-sensitive message |
| `model_dynamics` | Model selection or consensus information |
| `complexity_signals` | Query complexity acknowledgment |
| `synthesis_quality` | Post-synthesis quality assessment |
| `achievement` | Achievement progress or unlock |
| `wellbeing` | Session-length wellbeing nudge |
| `easter_egg` | Hidden feature discovery |

---

## 6. Backend Services

### 6.1 Core Delight Service

**File**: `packages/infrastructure/lambda/shared/services/delight.service.ts`

The central service managing all Delight operations:

- **Message Selection**: Queries `delight_messages` table, filters by injection point, trigger type, domain family, time context, and user preferences. Uses in-memory cache (60s TTL)
- **User Preferences**: CRUD for `user_delight_preferences` table (personality mode, intensity, feature toggles)
- **Achievements**: Progress tracking with threshold-based unlocking
- **Easter Eggs**: Trigger detection, discovery tracking, achievement integration
- **Analytics**: Aggregated metrics (messages shown, achievements unlocked, easter eggs discovered, engagement by mode)
- **Auto Mode**: Resolves `auto` personality to a concrete mode based on context signals
- **Admin CRUD**: Full management of categories, messages, achievements, easter eggs, sounds

### 6.2 Delight Orchestration Service

**File**: `packages/infrastructure/lambda/shared/services/delight-orchestration.service.ts`

Bridges the AGI Brain Planner with the Delight system:

- Maps `StepType` → `TriggerType` (e.g., `analyze` → `complexity_signals`, `synthesize` → `synthesis_quality`)
- Maps `OrchestrationMode` → domain family (e.g., `coding` → `programming`, `creative` → `creative`)
- Provides step-specific messages (e.g., "Verifying accuracy..." for `verify` steps)
- Provides mode-specific messages (e.g., "Deep thinking mode activated..." for `extended_thinking`)
- Tracks session start times and domain transitions per user
- Checks achievement progress on plan completion (queries count, domain explorer, complexity, time spent)
- Returns appropriate sound effects for each workflow event

### 6.3 Delight Events Service

**File**: `packages/infrastructure/lambda/shared/services/delight-events.service.ts`

Real-time event emitter for streaming delight messages to the frontend:

- Extends Node.js `EventEmitter`
- Subscription model per `planId` with automatic history replay
- Event types: `message`, `achievement`, `easter_egg`, `sound`, `step_update`, `plan_update`
- SSE stream helper (`createDelightEventStream`) for Server-Sent Events
- Integration helper (`emitDelightForPlanExecution`) for use in the Brain Planner

---

## 7. Frontend: Think Tank (Native)

**File**: `apps/thinktank/components/axiom/DelightSystem.tsx`

Think Tank has a **native** Delight implementation tailored to the CLARION questioning flow:

### Components

| Component | Purpose |
|-----------|---------|
| `DelightProvider` | React Context wrapping the chat UI |
| `useDelight()` | Hook exposing `showProgressMessage`, `checkChemistry`, `getDomainQuestion`, `playSound` |
| `DelightToast` | Animated toast notification (framer-motion) |
| `ChemistryMomentDisplay` | Shows model consensus/disagreement moments |
| `ProgressAcknowledgment` | Inline progress messages during CLARION flow |

### CLARION-Specific Features

- **Progress Messages**: After each CLARION clarifying question ("Got it. This helps narrow things down.")
- **Chemistry Moments**: When model scores shift significantly, new leaders emerge, or strong consensus forms
- **Domain-Aware Phrasing**: Questions are phrased differently for legal vs. medical vs. engineering domains
- **Sound Effects**: Optional audio feedback for answers, completions, and chemistry moments

### Domain Phrasing Examples

| Domain | Question Key | Phrased As |
|--------|-------------|------------|
| `legal.contracts` | `partyRole` | "Are you the provider or the customer in this agreement?" |
| `medicine.diagnosis` | `urgency` | "How urgently do you need this information?" |
| `engineering.software` | `scope` | "Is this a quick fix or a larger architectural decision?" |
| `business.finance` | `timeframe` | "What's your investment timeframe?" |
| `creative.writing` | `tone` | "What tone are you aiming for?" |

### Settings Integration

The `PersonalityMode` setting is stored in the Zustand settings store (`apps/thinktank/lib/stores/settings-store.ts`) and configurable on the Settings page (`apps/thinktank/app/settings/page.tsx`).

---

## 8. Frontend: Cross-App (@radiant/delight-ui)

**Package**: `packages/delight-ui/`

A shared React component library providing Delight to ALL non-Think Tank apps.

### Exports

```typescript
import {
  RadiantDelightProvider,   // Root provider component
  useRadiantDelight,        // Hook (throws if outside provider)
  useRadiantDelightOptional // Hook (returns null if outside provider)
} from '@radiant/delight-ui';

import type {
  PersonalityMode,
  InjectionPoint,
  DisplayStyle,
  AppDelightConfig,
  RadiantDelightContextValue,
} from '@radiant/delight-ui';
```

### Usage

```typescript
// 1. Configure in providers.tsx
const MY_APP_CONFIG: AppDelightConfig = {
  appId: 'my_app',
  appName: 'My App',
  defaultPersonalityMode: 'auto',
  greetingMessages: ['Welcome!'],
  postExecutionMessages: ['Done!'],
  errorRecoveryMessages: ['Something went wrong.'],
};

// 2. Wrap in providers
<RadiantDelightProvider config={MY_APP_CONFIG}>
  {children}
</RadiantDelightProvider>

// 3. Trigger in components
const { triggerDelight, showDelightToast } = useRadiantDelight();
triggerDelight('action_complete');           // Standard injection point
triggerDelight('error_recovery');            // Error handling
showDelightToast('Custom message', '🎯');   // Custom toast
```

### Features

- **Personality Persistence**: Saves mode/sound preferences to `localStorage` per app
- **5 Personality Modes**: Each injection point has unique messages per mode
- **Toast UI**: Animated bottom-center toasts with framer-motion, glassmorphic design
- **Display Styles**: `toast` (default), `banner` (errors), `celebration` (milestones), `subtle` (idle)
- **Sound Effects**: Optional audio for success, error, milestone, and subtle events
- **Fallback Messages**: 110+ built-in messages across all injection points and personality modes

---

## 9. Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `delight_categories` | Message categories (e.g., "Domain Awareness", "Model Chemistry") |
| `delight_messages` | Individual messages with injection point, trigger type, domain families, time contexts, display style |
| `delight_achievements` | Achievement definitions with thresholds, celebration messages, rarity, points |
| `delight_easter_eggs` | Hidden features with trigger types/values, activation messages, effect configs |
| `delight_sounds` | Sound effect definitions with URLs, themes, volume defaults |
| `delight_event_log` | Audit trail of all delight interactions (message shown, achievement unlocked, easter egg found) |
| `delight_statistics` | Aggregated usage statistics per tenant |
| `user_delight_preferences` | Per-user personality mode, intensity, feature toggles, sound settings |
| `user_achievements` | Per-user achievement progress and unlock status |

### Key Migrations

- `075_delight_system.sql` — Core tables (categories, messages, achievements, easter eggs, sounds, preferences)
- `076_delight_statistics.sql` — Statistics and analytics tables
- `085_platform_improvements.sql` — Additional delight refinements

### Row-Level Security

All delight tables enforce tenant isolation via `app.current_tenant_id`:
- `user_delight_preferences`: User can only read/write their own preferences
- `user_achievements`: User can only see their own achievements
- `delight_event_log`: Scoped to tenant

---

## 10. API Reference

### User-Facing Endpoints

Base: `/api/delight`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/message` | Get a delight message for an injection point and trigger type |
| `POST` | `/orchestration-messages` | Get messages for an orchestration context |
| `GET` | `/preferences` | Get user's delight preferences |
| `PUT` | `/preferences` | Update user's delight preferences |
| `GET` | `/achievements` | Get user's achievement list and progress |
| `POST` | `/achievements/progress` | Record achievement progress |
| `POST` | `/easter-egg` | Trigger an easter egg check |

### Admin Endpoints

Base: `/api/admin/delight`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/dashboard` | Full dashboard (categories, messages, achievements, easter eggs, sounds, analytics) |
| `GET` | `/categories` | List all categories |
| `PATCH` | `/categories/:id` | Toggle category enabled/disabled |
| `GET` | `/messages` | List messages (filterable by category, injection point) |
| `POST` | `/messages` | Create a new message |
| `PUT` | `/messages/:id` | Update a message |
| `DELETE` | `/messages/:id` | Delete a message |
| `GET` | `/achievements` | List all achievements |
| `GET` | `/easter-eggs` | List all easter eggs |
| `GET` | `/sounds` | List all sounds |
| `GET` | `/analytics` | Engagement analytics (messages shown, achievements, easter eggs, mode distribution) |
| `GET` | `/statistics` | Detailed usage statistics |
| `GET` | `/user-engagement` | User engagement leaderboard |

---

## 11. Admin Management

### Think Tank Admin UI

**Page**: `apps/thinktank-admin/app/(dashboard)/delight/page.tsx`

The Delight admin page provides:

- **Message Management**: Browse, create, edit, and delete messages by category and injection point
- **Category Controls**: Enable/disable entire message categories
- **Achievement Editor**: Define achievements with thresholds, rarity, points, and celebration messages
- **Easter Egg Manager**: Configure hidden features with trigger conditions and effects
- **Sound Library**: Manage sound effects and themes
- **Analytics Dashboard**: Messages shown, achievements unlocked, easter eggs discovered, engagement by personality mode
- **User Engagement**: Leaderboard showing most engaged users

---

## 12. Achievements System

Achievements reward user engagement and create a discovery loop.

### Achievement Types

| Type | Description | Example |
|------|-------------|---------|
| `queries_count` | Number of queries made | "First Steps" (1 query), "Power User" (100 queries) |
| `domain_explorer` | Unique domains explored | "Domain Hopper" (5 domains), "Renaissance Mind" (20 domains) |
| `complexity` | Complex queries handled | "Deep Thinker" (10 complex queries) |
| `time_spent` | Minutes spent in sessions | "Dedicated" (60 min), "Marathon" (240 min) |
| `discovery` | Easter eggs discovered | "Explorer" (1 egg), "Archaeologist" (10 eggs) |

### Rarity Tiers

| Rarity | Points | Frequency |
|--------|--------|-----------|
| `common` | 10 | ~50% of users |
| `uncommon` | 25 | ~25% of users |
| `rare` | 50 | ~10% of users |
| `epic` | 100 | ~3% of users |
| `legendary` | 250 | <1% of users |

### Celebration Flow

1. User action triggers `recordAchievementProgress()`
2. Progress is incremented in `user_achievements`
3. If `progress_value >= threshold_value` and not yet unlocked → **unlock**
4. Achievement celebration message is emitted via `DelightEventsService`
5. Frontend shows celebration toast with achievement name, icon, and message

---

## 13. Easter Eggs

Easter eggs are hidden surprises that create delight through discovery.

### Trigger Types

| Trigger Type | Description |
|-------------|-------------|
| `keyword` | User types a specific word or phrase |
| `date` | Triggered on a specific calendar date |
| `sequence` | User performs a specific action sequence |
| `time` | Triggered at a specific time of day |
| `achievement` | Triggered when a specific achievement is unlocked |

### Effect Types

| Effect Type | Description |
|------------|-------------|
| `message` | Show a special message |
| `animation` | Trigger a visual animation |
| `sound` | Play a special sound effect |
| `theme` | Temporarily change the UI theme |
| `confetti` | Show confetti animation |

### Discovery Tracking

- Each easter egg has a `discovery_count` that increments on first discovery per user
- First-time discovery also contributes to the `discovery` achievement type
- All discoveries are logged in `delight_event_log` for analytics

---

## 14. Sound Effects

### Sound Themes

| Theme | Description |
|-------|-------------|
| `default` | Standard RADIANT sounds |
| `minimal` | Subtle, low-key audio cues |
| `playful` | Fun, expressive sounds |
| `nature` | Natural ambient sounds |

### Sound Categories

| Category | Used For |
|----------|---------|
| `transition_whoosh` | Plan start, mode switch |
| `confirm_chime` | Plan completion, major success |
| `confirm_subtle` | Step completion, small action |
| `consensus_ping` | Model consensus reached |
| `error` | Error recovery |
| `milestone` | Achievement unlocked |

### User Controls

- **Enable/Disable**: Per-user toggle via preferences
- **Volume**: Adjustable (0–100, default: 50)
- **Theme Selection**: Choose preferred sound theme

---

## 15. Real-Time Events (SSE)

The `DelightEventsService` enables real-time streaming of delight messages during plan execution:

```typescript
// Subscribe to events for a plan
const unsubscribe = delightEventsService.subscribe({
  planId: 'plan-123',
  userId: 'user-456',
  tenantId: 'tenant-789',
  callback: (event) => {
    // event.type: 'message' | 'achievement' | 'easter_egg' | 'sound' | 'step_update' | 'plan_update'
    renderDelightEvent(event);
  },
});

// Or create an SSE stream for the frontend
const { stream, close } = createDelightEventStream('plan-123', 'user-456', 'tenant-789');
```

### Event Types

| Type | Data | When |
|------|------|------|
| `message` | `DelightMessageResponse` | Progress/domain/time messages |
| `achievement` | `{ id, name, celebrationMessage }` | Achievement unlocked |
| `easter_egg` | `{ id, name, activationMessage }` | Easter egg discovered |
| `sound` | `{ soundId }` | Sound effect trigger |
| `step_update` | `{ stepId, stepType, status, message }` | Brain plan step progress |
| `plan_update` | `{ status, message }` | Overall plan status change |

---

## 16. AGI Brain Integration

The Delight Orchestration Service integrates with the AGI Brain Planner to provide contextual messages during AI workflows:

### Workflow Event Mapping

| Brain Event | Delight Action |
|-------------|---------------|
| `plan_start` | Pre-execution messages, mode-specific greeting, `transition_whoosh` sound |
| `step_start` | Step-specific progress message (e.g., "Selecting the best model...") |
| `step_complete` | `confirm_subtle` sound |
| `model_selected` | Model dynamics message |
| `domain_detected` | Domain-aware loading message (e.g., "Consulting legal precedent...") |
| `consensus_reached` | Consensus message, `consensus_ping` sound |
| `disagreement` | Divergent perspectives message |
| `plan_complete` | Success celebration, achievement checks, `confirm_chime` sound |

### Domain-Aware Messages

The orchestration service provides domain-specific loading messages for 11+ domains:

```
Physics:     "Collapsing the wave function..."
Chemistry:   "Balancing the equations..."
Medicine:    "Reviewing the differential..."
Programming: "Compiling the solution..."
Law:         "Reviewing case law..."
Finance:     "Crunching the numbers..."
Philosophy:  "Contemplating the question..."
Cooking:     "Preheating the knowledge base..."
Music:       "Tuning the harmonics..."
Art:         "Composing the palette..."
```

### Model Dynamics Messages

| Consensus Level | Example Messages |
|----------------|-----------------|
| **Strong** | "The models agree on this one." |
| **Moderate** | "Balancing different viewpoints..." |
| **Divergent** | "The models are debating this one." |

---

## 17. Per-App Configurations

Each app has a tailored `AppDelightConfig` defined in its `providers.tsx`:

### Think Tank (Consumer)

- **Native implementation** with CLARION-specific chemistry moments, domain phrasing, and progress acknowledgments
- Config: `apps/thinktank/components/axiom/DelightSystem.tsx`

### Curator

- **Theme**: Knowledge curation and ingestion
- Messages: "Ingesting knowledge...", "Knowledge graph updated.", "Your knowledge base just got smarter."
- Custom points: `domain_verified`, `graph_updated`
- Config: `apps/curator/app/providers.tsx`

### Aurelius Dojo

- **Theme**: Martial arts training and mastery
- Messages: "The dojo awaits, student.", "Belt earned! Your mastery grows.", "Excellent form."
- Custom points: `sparring_start`, `sparring_complete`, `mastery_achieved`
- Config: `apps/dojo/app/providers.tsx`

### Think Tank Admin

- **Theme**: Platform administration
- Messages: "Admin dashboard ready.", "Configuration locked in.", "Delight messages published to all users."
- Custom points: `config_saved`, `user_managed`, `delight_published`
- Config: `apps/thinktank-admin/app/providers.tsx`

### Think Tank Tenant Admin

- **Theme**: Organization management
- Messages: "Tenant dashboard ready.", "Invitation sent!", "Your organization is more secure now."
- Custom points: `user_invited`, `user_deactivated`, `security_updated`
- Config: `apps/thinktank-tenant-admin/app/providers.tsx`

---

## 18. User Preferences

Each user has granular control over their Delight experience:

| Preference | Type | Default | Description |
|-----------|------|---------|-------------|
| `personalityMode` | enum | `expressive` | auto, professional, subtle, expressive, playful |
| `intensityLevel` | 1–10 | 5 | How frequently messages appear |
| `enableDomainMessages` | boolean | `true` | Domain-aware messages |
| `enableModelPersonality` | boolean | `true` | Model dynamics and consensus messages |
| `enableTimeAwareness` | boolean | `true` | Time-of-day-aware messages |
| `enableAchievements` | boolean | `true` | Achievement tracking and celebrations |
| `enableWellbeingNudges` | boolean | `true` | "Take a break" messages after long sessions |
| `enableEasterEggs` | boolean | `true` | Hidden feature discovery |
| `enableSounds` | boolean | `false` | Sound effects |
| `soundTheme` | enum | `default` | default, minimal, playful, nature |
| `soundVolume` | 0–100 | 50 | Sound effect volume |

---

## 19. Auto Mode Resolution

When `personalityMode` is set to `auto`, the system intelligently selects a concrete mode:

### Time-Based Resolution

| Time | Resolved Mode | Rationale |
|------|--------------|-----------|
| Morning (6–12) | `subtle` | Calm start to the day |
| Afternoon (12–18) | `expressive` | Engaged midday energy |
| Evening (18–22) | `playful` | More relaxed evening |
| Night (22–6) | `subtle` | Quiet late night |
| Weekend | `playful` | Weekend fun |

### Domain-Based Overrides

| Domain Category | Override |
|----------------|---------|
| Business, Finance, Legal, Medical | `professional` |
| Arts, Creative, Design, Entertainment | `expressive` |

### Session-Length Adjustment

- Sessions >60 minutes: Professional → Subtle, others → Expressive (more supportive during long sessions)

---

## 20. Analytics & Engagement

### Tenant-Level Analytics

| Metric | Description |
|--------|-------------|
| `totalMessagesShown` | Total delight messages displayed |
| `achievementsUnlocked` | Total achievements unlocked across all users |
| `easterEggsDiscovered` | Unique easter eggs discovered |
| `engagementByMode` | User count per personality mode |

### User Engagement Leaderboard

Ranked by total delight interactions (messages + achievements + easter eggs).

### Admin Dashboard

Available at `Think Tank Admin > Delight`:
- Summary cards (total messages, enabled messages, achievements, easter eggs, sounds)
- Mode distribution chart
- Engagement timeline
- Top users by delight interaction

---

## 21. Developer Guide

### Adding Delight to a New App

1. Add dependency:
   ```json
   "@radiant/delight-ui": "workspace:*"
   ```

2. Ensure peer deps: `framer-motion`, `lucide-react`

3. Create config in `providers.tsx`:
   ```typescript
   import { RadiantDelightProvider, type AppDelightConfig } from '@radiant/delight-ui';

   const CONFIG: AppDelightConfig = {
     appId: 'your_app',
     appName: 'Your App',
     greetingMessages: [...],
     postExecutionMessages: [...],
     errorRecoveryMessages: [...],
   };
   ```

4. Wrap with provider:
   ```tsx
   <RadiantDelightProvider config={CONFIG}>
     {children}
   </RadiantDelightProvider>
   ```

5. Use in components:
   ```typescript
   const { triggerDelight } = useRadiantDelight();

   // After mutation success
   triggerDelight('action_complete');

   // After error
   triggerDelight('error_recovery');
   ```

### Adding a New Injection Point

1. Add the point to `InjectionPoint` type in `packages/delight-ui/src/types.ts`
2. Add default messages to `DEFAULT_MESSAGES` in `RadiantDelightProvider.tsx`
3. Add icon mapping to `ICONS` in `RadiantDelightProvider.tsx`
4. Add database messages via admin API or migration
5. Update this documentation

### Adding a New Achievement

1. Insert into `delight_achievements` table:
   ```sql
   INSERT INTO delight_achievements (id, name, description, icon, achievement_type,
     threshold_value, celebration_message, rarity, points, is_hidden, is_enabled)
   VALUES ('my_achievement', 'My Achievement', 'Description', '🏆', 'custom_type',
     10, 'You did it!', 'rare', 50, false, true);
   ```

2. Call `delightService.recordAchievementProgress(userId, tenantId, 'custom_type', 1)` at the appropriate point

---

## 22. Enforcement Policy

**Policy File**: `.windsurf/workflows/delight-ux-policy.md`

### Rules

1. **Every user-facing RADIANT app MUST integrate `@radiant/delight-ui`**
2. **Required triggers**: `action_complete` on every successful mutation, `error_recovery` on every error
3. **Personality respect**: All apps MUST honor the user's chosen personality mode
4. **No generic messages**: Never show "Loading..." or "Error occurred" — use Delight messages
5. **Never remove**: Do not remove `RadiantDelightProvider` from any app

### Compliance Matrix

| App | Status | Config Location |
|-----|--------|----------------|
| Think Tank | ✅ Native | `apps/thinktank/components/axiom/DelightSystem.tsx` |
| Curator | ✅ Integrated | `apps/curator/app/providers.tsx` |
| Aurelius Dojo | ✅ Integrated | `apps/dojo/app/providers.tsx` |
| Think Tank Admin | ✅ Integrated | `apps/thinktank-admin/app/providers.tsx` |
| Tenant Admin | ✅ Integrated | `apps/thinktank-tenant-admin/app/providers.tsx` |
| Genesis | ⚠️ Partial | Has personality in GenesisForge |
| Admin Dashboard | ℹ️ Has API routes | Not user-facing consumer app |

---

## 23. File Inventory

### Shared Package

| File | Purpose |
|------|---------|
| `packages/delight-ui/package.json` | Package definition |
| `packages/delight-ui/tsconfig.json` | TypeScript configuration |
| `packages/delight-ui/src/index.ts` | Package exports |
| `packages/delight-ui/src/types.ts` | TypeScript types |
| `packages/delight-ui/src/RadiantDelightProvider.tsx` | Universal provider, hook, toast UI |
| `packages/delight-ui/src/configs/tenant-admin.ts` | Pre-built Tenant Admin config |

### Backend Services

| File | Purpose |
|------|---------|
| `lambda/shared/services/delight.service.ts` | Core service (1,314 lines) — messages, preferences, achievements, easter eggs, analytics |
| `lambda/shared/services/delight-orchestration.service.ts` | AGI Brain integration (558 lines) |
| `lambda/shared/services/delight-events.service.ts` | Real-time SSE events (368 lines) |
| `lambda/delight/handler.ts` | REST API handler (505 lines) — 20 endpoints |

### Frontend (Think Tank Native)

| File | Purpose |
|------|---------|
| `apps/thinktank/components/axiom/DelightSystem.tsx` | CLARION delight provider, chemistry moments, progress, toasts |
| `apps/thinktank/lib/axiom/types.ts` | DelightConfig, ChemistryMoment, ProgressMessage types |
| `apps/thinktank/lib/stores/settings-store.ts` | PersonalityMode in Zustand store |
| `apps/thinktank/app/settings/page.tsx` | User personality mode selector |

### Frontend (Cross-App Configs)

| File | Purpose |
|------|---------|
| `apps/curator/app/providers.tsx` | Curator Delight config |
| `apps/dojo/app/providers.tsx` | Dojo Delight config |
| `apps/thinktank-admin/app/providers.tsx` | TT Admin Delight config |
| `apps/thinktank-tenant-admin/app/providers.tsx` | Tenant Admin Delight config |

### Admin UI

| File | Purpose |
|------|---------|
| `apps/thinktank-admin/app/(dashboard)/delight/page.tsx` | Delight management dashboard |

### Database

| File | Purpose |
|------|---------|
| `migrations/archive/075_delight_system.sql` | Core delight tables |
| `migrations/archive/076_delight_statistics.sql` | Statistics tables |
| `migrations/000_consolidated_schema.sql` | Consolidated schema (includes delight tables) |

### Tests

| File | Purpose |
|------|---------|
| `lambda/shared/services/__tests__/delight.service.test.ts` | Core service tests |
| `lambda/shared/services/__tests__/delight-events.service.test.ts` | Events service tests |
| `lambda/shared/services/__tests__/delight-orchestration.service.test.ts` | Orchestration tests |

### Policy

| File | Purpose |
|------|---------|
| `.windsurf/workflows/delight-ux-policy.md` | Enforcement policy for all apps |

---

---

## 24. Polymorphic UI Integration

Delight directly influences Think Tank's polymorphic (morphing) UI. Personality mode controls animation behavior, transition narration, and overlay visibility.

### Animation Parameters by Personality Mode

| Parameter | Professional | Subtle | Expressive | Playful |
|-----------|-------------|--------|------------|---------|
| **Spring stiffness** | 500 | 350 | 300 | 200 |
| **Spring damping** | 40 | 35 | 25 | 15 |
| **Duration (s)** | 0.15 | 0.2 | 0.3 | 0.4 |
| **Scale enter** | 0.99 | 1.0 | 0.97 | 0.92 |
| **Y offset** | 4px | 0px | 10px | 20px |
| **Animation type** | tween | tween | spring | spring |
| **Show particles** | No | No | No | Yes |
| **Show morph overlay** | No | No | Yes | Yes |

### Morph Narration Examples

When the UI morphs to a new view type, the transition overlay text adapts:

| View | Professional | Playful |
|------|-------------|---------|
| Data Grid | "Switching to data grid." | "Ooh, spreadsheet time! Let's crunch some numbers! 📊" |
| Chart | "Opening visualization." | "Making data look gorgeous — you're welcome! 📈" |
| Kanban | "Loading task board." | "Kanban board incoming! Drag all the things! 🎯" |
| Terminal | "Entering command mode." | "Welcome to the Matrix. 🟢" |
| Canvas | "Opening canvas." | "Infinite canvas! Draw like nobody's watching! 🎨" |

### Integration Points

| Component | File | What Personality Controls |
|-----------|------|--------------------------|
| `ViewRouter` | `components/polymorphic/view-router.tsx` | Mode switch delight, escalation narration |
| `ViewMorphTransition` | Same file | Spring stiffness, damping, scale, y-offset per mode |
| `LiquidMorphPanel` | `components/liquid/LiquidMorphPanel.tsx` | Open/close animation parameters |
| `MorphTransitionEffect` | Same file | Narration text, subtitle, overlay visibility, spin speed |

### API

```typescript
import { getAnimationConfig, getMotionTransition, getMorphAnimationStates, getMorphNarration, getMorphSubtitle } from '@radiant/delight-ui';

// Get full config for current personality
const config = getAnimationConfig('playful');
// → { stiffness: 200, damping: 15, duration: 0.4, showParticles: true, ... }

// Get Framer Motion transition object
const transition = getMotionTransition('professional');
// → { type: 'tween', duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }

// Get initial/animate/exit states for morph transitions
const states = getMorphAnimationStates('expressive');
// → { initial: { opacity: 0, scale: 0.97, y: 10 }, animate: ..., exit: ..., transition: ... }

// Get personality-aware narration for a morph target
const narration = getMorphNarration('playful', 'datagrid');
// → "Ooh, spreadsheet time! Let's crunch some numbers! 📊"
```

---

## 25. Web Audio Sound Synthesis

Delight sounds are synthesized in real-time using the Web Audio API. No mp3/wav files are shipped.

### Sound Types

| Sound | When Played | Description |
|-------|------------|-------------|
| `success` | `post_execution`, `action_complete` | Ascending tone sequence |
| `error` | `error_recovery` | Descending minor tone |
| `milestone` | `milestone` | Extended ascending arpeggio |
| `subtle` | Mode switches, minor actions | Single soft tone |
| `morph` | UI view morph transitions | Rising chord progression |

### Per-Personality Sound Profiles

| Mode | Success Sound | Error Sound | Character |
|------|--------------|-------------|-----------|
| **Professional** | Single 880Hz sine, 80ms | Single 220Hz sine, 120ms | Minimal click |
| **Subtle** | Single 800Hz sine, 60ms | Single 200Hz sine, 100ms | Near-silent |
| **Expressive** | C-E-G chord (523-659-784Hz), 300ms | E-C descent, 350ms | Musical chord |
| **Playful** | C-E-G-C'-E' arpeggio (5 notes), 500ms | A-G#-G descent, 400ms | Celebratory chime |
| **Auto** | Same as expressive | Same as expressive | Balanced |

### API

```typescript
import { playSynthSound } from '@radiant/delight-ui';

playSynthSound('playful', 'success', 0.25);  // volume 0-1
playSynthSound('professional', 'morph', 0.2);
```

### Technical Details

- Uses `OscillatorNode` + `GainNode` chain per note
- Each note has attack (1ms linear ramp) and release (exponential decay)
- Notes are sequenced with configurable gaps
- Automatically resumes `AudioContext` on first user interaction (browser autoplay policy)
- Graceful fallback: if Web Audio API is unavailable, sounds are silently skipped

---

## 26. Settings Sync (Frontend → Backend)

The `useDelightSync` hook bridges the frontend Zustand settings store with the backend Delight preferences API.

### Flow

```
┌─────────────┐     GET /api/delight/preferences     ┌──────────────┐
│  Page Load   │ ──────────────────────────────────── │   Aurora DB   │
│  (on mount)  │ ◄─────── { personality_mode, ... } ──│  user_delight │
│              │                                       │  _preferences │
│  User picks  │     PUT /api/delight/preferences     │              │
│  "playful"   │ ──────────────────────────────────── │  Updated!    │
│  (debounced) │     { personality_mode: "playful" }   │              │
└─────────────┘                                       └──────────────┘
```

### Hook Location

`apps/thinktank/lib/hooks/useDelightSync.ts`

### Behavior

1. **On mount**: Fetches backend preferences → applies to Zustand `settings-store` + `RadiantDelightProvider`
2. **On personality change**: Debounced (1.5s) PUT to backend
3. **On sound toggle**: Same debounced sync
4. **Professional mode**: Automatically sets `suppress_idle` and `suppress_session_start` on backend

---

## 27. End-to-End Wiring Status

### Think Tank (Consumer)

| Action | Injection Point | Status |
|--------|----------------|--------|
| Send message | `pre_execution` | ✅ Wired |
| Stream complete | `post_execution` | ✅ Wired |
| Send error | `error_recovery` | ✅ Wired |
| New conversation | `session_start` | ✅ Wired |
| Delete conversation | `action_complete` | ✅ Wired |
| Export conversation | `action_complete` / `error_recovery` | ✅ Wired |
| Morph to view | `action_complete` + morph sound | ✅ Wired |
| Mode switch (sniper/war room) | `action_complete` + subtle sound | ✅ Wired |
| Escalate | Toast + morph sound | ✅ Wired |
| Settings change | Synced to backend | ✅ Wired |

### Curator

| Action | Injection Point | Status |
|--------|----------------|--------|
| Verify fact | `action_complete` | ✅ Wired |
| Reject fact | `action_complete` | ✅ Wired |
| Correct fact | `action_complete` | ✅ Wired |
| Resolve ambiguity | `action_complete` | ✅ Wired |
| Create golden rule | `action_complete` | ✅ Wired |
| Delete golden rule | `action_complete` | ✅ Wired |
| Resolve conflict | `action_complete` | ✅ Wired |
| Create connector | `action_complete` | ✅ Wired |
| Sync connector | `pre_execution` | ✅ Wired |
| Any failure | `error_recovery` | ✅ Wired |

### Dojo (7 components, 17 mutations)

| Action | Injection Point | Component | Status |
|--------|----------------|-----------|--------|
| Create library | `action_complete` | LibraryView | ✅ Wired |
| Upload document | `action_complete` | LibraryView | ✅ Wired |
| Delete document | `action_complete` | LibraryView | ✅ Wired |
| Discover themes | `milestone` | LibraryView | ✅ Wired |
| Start lecture/sparring | `session_start` | TrainingArena | ✅ Wired |
| Submit sparring answer (correct) | `action_complete` | TrainingArena | ✅ Wired |
| Submit sparring answer (wrong) | `error_recovery` | TrainingArena | ✅ Wired |
| Complete session | `milestone` | TrainingArena | ✅ Wired |
| Start scenario | `session_start` | ScenarioArena | ✅ Wired |
| Respond to scenario | `action_complete` | ScenarioArena | ✅ Wired |
| Conclude scenario | `milestone` | ScenarioArena | ✅ Wired |
| Start dialectic | `session_start` | DialecticArena | ✅ Wired |
| Submit dialectic response | `action_complete` | DialecticArena | ✅ Wired |
| Conclude dialectic | `milestone` | DialecticArena | ✅ Wired |
| Trigger reinforcement | `session_start` | DecayEngine | ✅ Wired |
| Submit reinforcement answer | `action_complete` / `error_recovery` | DecayEngine | ✅ Wired |
| Update Archytas config | `action_complete` | ArchytasSettings | ✅ Wired |
| Extract competencies | `milestone` | CompetencyMesh | ✅ Wired |
| Any failure | `error_recovery` | All components | ✅ Wired |

### TT Admin

| Action | Injection Point | Page | Status |
|--------|----------------|------|--------|
| Toggle delight category | `action_complete` | Delight Dashboard | ✅ Wired |
| Create delight message | `action_complete` | Delight Dashboard | ✅ Wired |
| Update delight message | `action_complete` | Delight Dashboard | ✅ Wired |
| Delete delight message | `action_complete` | Delight Dashboard | ✅ Wired |
| Create API key | `action_complete` | API Keys | ✅ Wired |
| Revoke API key | `action_complete` | API Keys | ✅ Wired |
| Restore API key | `action_complete` | API Keys | ✅ Wired |
| Any failure | `error_recovery` | All pages | ✅ Wired |

### Tenant Admin

| Action | Injection Point | Status |
|--------|----------------|--------|
| Save settings (incl. delight toggle) | Via save handler | ✅ UI implemented |
| Delight master toggle | `tenantDelightEnabled` field | ✅ Wired to Provider |
| Default mode selection | `tenantDefaultMode` field | ✅ Wired to Provider |
| User override lock | `tenantAllowUserOverride` field | ✅ Wired to Provider |

---

## 28. Enterprise Deployment Guide

For regulated industries (legal, medical, financial), configure the tenant admin settings:

| Setting | Recommended Value | Effect |
|---------|-------------------|--------|
| `delightEnabled` | `true` | Keep analytics active but output controlled |
| `delightDefaultMode` | `professional` | Zero emoji, zero narration, crisp tweens, factual toasts |
| `delightAllowUserOverride` | `false` | Lock all users to professional mode |

To disable delight entirely (zero output, zero analytics):
- Set `delightEnabled` to `false` — `triggerDelight()` becomes a silent no-op

See `docs/POLYMORPHIC-LIQUID-UI-GUIDE.md` for comprehensive documentation on how Delight interacts with the Polymorphic and Liquid UI systems.

---

*This document is the authoritative reference for the RADIANT Delight System. Update it whenever Delight components, APIs, database tables, or frontend integrations change.*
