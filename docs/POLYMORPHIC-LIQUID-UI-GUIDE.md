# RADIANT Polymorphic & Liquid UI System Guide

> **Version**: 7.29.0 | **Last Updated**: February 2026
> **Applies to**: Think Tank (consumer), Curator, Dojo, TT Admin, Tenant Admin, Genesis

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Polymorphic UI — Domain-Aware View Morphing](#3-polymorphic-ui)
4. [Liquid UI — Fluid Panel Transitions](#4-liquid-ui)
5. [Delight System Integration](#5-delight-system-integration)
6. [Personality Modes & Enterprise Appropriateness](#6-personality-modes)
7. [Animation System](#7-animation-system)
8. [Sound Synthesis](#8-sound-synthesis)
9. [Settings Persistence & Sync](#9-settings-persistence)
10. [Tenant Admin Controls](#10-tenant-admin-controls)
11. [Guest User Behavior](#11-guest-user-behavior)
12. [Cross-App Wiring Status](#12-cross-app-wiring-status)
13. [Component Reference](#13-component-reference)
14. [API Reference](#14-api-reference)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Overview

RADIANT's UI system has two interconnected layers:

| Layer | Purpose | Where |
|-------|---------|-------|
| **Polymorphic UI** | Domain-aware view morphing — the UI structurally transforms based on the AI's detected domain (code, data, writing, legal, etc.) | Think Tank chat page |
| **Liquid UI** | Fluid panel transitions — smooth, physics-based panel open/close/morph animations | Think Tank `LiquidMorphPanel` |
| **Delight System** | Personality-aware micro-interactions layered on top of both | All apps |

These systems are **not independent**. The Delight system controls the Polymorphic and Liquid UI's animation parameters, narration, sounds, and overlay visibility based on the user's personality mode.

### Why This Matters

Without Delight integration, the Polymorphic UI uses hardcoded animation constants (e.g., `stiffness: 300, damping: 25`). With Delight, these adapt:
- A **lawyer** in Professional mode sees crisp 0.15s tweens with zero overlay
- A **creative team** in Playful mode sees bouncy 0.4s springs with narration like "Ooh, spreadsheet time!"

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Think Tank App                        │
│                                                         │
│  ┌──────────────┐    ┌───────────────────┐             │
│  │ Settings Page │    │   Chat Page        │             │
│  │              │    │                   │             │
│  │ useDelightSync│    │ useRadiantDelight  │             │
│  │  (Zustand ↔  │    │ triggerDelight()   │             │
│  │   Backend)   │    │ playSynthSound()   │             │
│  └──────────────┘    │                   │             │
│                      │  ┌─────────────┐  │             │
│                      │  │ ViewRouter   │  │             │
│                      │  │ (Polymorphic)│  │             │
│                      │  │             │  │             │
│                      │  │ getMorphAnim │  │             │
│                      │  │ States()    │  │             │
│                      │  └─────────────┘  │             │
│                      │                   │             │
│                      │  ┌─────────────┐  │             │
│                      │  │LiquidMorph  │  │             │
│                      │  │Panel        │  │             │
│                      │  │             │  │             │
│                      │  │ getPersonal │  │             │
│                      │  │ ityConfig() │  │             │
│                      │  └─────────────┘  │             │
│                      └───────────────────┘             │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │        RadiantDelightProvider (Context)           │   │
│  │  personalityMode | soundEnabled | triggerDelight  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
  ┌──────────────┐   ┌──────────────────┐
  │ @radiant/    │   │ Backend API      │
  │ delight-ui   │   │                  │
  │              │   │ GET/PUT          │
  │ animations.ts│   │ /api/delight/    │
  │ sounds.ts    │   │   preferences    │
  │ types.ts     │   │                  │
  └──────────────┘   │ user_delight_    │
                     │   preferences    │
                     │   (Aurora PG)    │
                     └──────────────────┘
```

---

## 3. Polymorphic UI

### What It Is

The Polymorphic UI is a system where the Think Tank chat interface **structurally transforms** based on the AI's detected domain. When the AI detects you're working on a spreadsheet, the UI morphs to show a data-optimized layout. When it detects code, it morphs to a code-first layout.

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `ViewRouter` | `apps/thinktank/components/polymorphic/view-router.tsx` | Routes between domain-specific view modes |
| `ViewMorphTransition` | Same file | Animated transition wrapper between views |
| `MorphTransitionEffect` | Same file | Full-screen overlay shown during morphs |

### Domain Modes

The system detects and supports these domain modes:

| Mode | Trigger | View Layout |
|------|---------|-------------|
| `conversational` | Default text chat | Standard chat bubbles |
| `analytical` | Data tables, CSV, charts | Split pane with data viewer |
| `code` | Code blocks detected | Code editor with syntax highlighting |
| `document` | Long-form writing | Document-style layout |
| `creative` | Images, design | Visual canvas |
| `research` | Citations, papers | Reference panel |

### How Morphing Works

1. **Detection**: The AI's response metadata includes `domainInfo.currentDomain`
2. **Router**: `ViewRouter` compares current vs. new domain
3. **Transition**: `ViewMorphTransition` wraps the outgoing/incoming view in animated containers
4. **Overlay**: `MorphTransitionEffect` optionally shows narration text during the transition
5. **Sound**: A synth sound plays if the user's personality mode allows it

---

## 4. Liquid UI

### What It Is

Liquid UI refers to the fluid, physics-based panel transitions in Think Tank. Panels don't snap open/closed — they flow with spring physics. The `LiquidMorphPanel` is the primary component.

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `LiquidMorphPanel` | `apps/thinktank/components/liquid/LiquidMorphPanel.tsx` | Expandable panel with spring-animated open/close |
| `MorphTransitionEffect` | Same file or imported | Overlay with personality narration |

### Spring Physics

Panels animate using spring configurations that vary by personality mode:

| Property | Professional | Subtle | Auto | Expressive | Playful |
|----------|-------------|--------|------|------------|---------|
| Duration | 0.15s | 0.2s | 0.25s | 0.3s | 0.4s |
| Stiffness | 400 | 350 | 300 | 250 | 200 |
| Damping | 30 | 28 | 25 | 20 | 15 |
| Scale | 1.0 | 0.98 | 0.97 | 0.95 | 0.92 |
| Y-Offset | 0px | 5px | 10px | 15px | 20px |
| Overlay | None | None | Fade | Slide | Bounce + narration |

---

## 5. Delight System Integration

### How Delight Controls the UI

The Delight system doesn't just show toast messages — it **controls the animation behavior** of the Polymorphic and Liquid UI:

```typescript
// In ViewRouter — mode switch triggers delight
const handleModeSwitch = (newMode: string) => {
  triggerDelight('action_complete');
  playSynthSound(personalityMode, 'transition', 0.2);
};

// In ViewMorphTransition — spring constants come from personality
const animConfig = getMorphAnimationStates(personalityMode);
// Returns: { initial: { opacity, scale, y }, animate: { ... }, exit: { ... }, transition: { type, stiffness, damping } }
```

### Injection Points in the Chat Lifecycle

| Moment | Injection Point | What Happens |
|--------|----------------|--------------|
| User sends message | `pre_execution` | Toast: "Working on it..." / Sound: subtle click |
| AI is streaming | `during_execution` | (Suppressed in professional/subtle) |
| AI response complete | `post_execution` | Toast: "Done." / Sound: success chime |
| Error occurs | `error_recovery` | Toast: "Something went wrong..." / Sound: error tone |
| New conversation | `session_start` | Toast: "New session started." |
| Delete/export chat | `action_complete` | Toast: "Saved." |
| Morph view change | `action_complete` | Sound: transition synth |
| Mode escalation | `action_complete` | Delight toast + escalation sound |

### Cross-App Delight Triggers

Every app with `RadiantDelightProvider` wrapping fires `triggerDelight()` on user actions:

| App | Actions Wired |
|-----|---------------|
| **Think Tank** | Send message, receive response, error, new conversation, delete, export, morph view, mode switch |
| **Curator** | Create connector, sync, verify, reject, correct, resolve ambiguity, resolve conflict, create/delete golden rule |
| **Dojo** | Create library, upload/delete document, discover themes, start session, submit answer, complete session, start/respond/conclude scenario, start/respond/conclude dialectic, trigger reinforcement, extract competencies, update Archytas config |
| **TT Admin** | Toggle category, create/update/delete message, create/revoke/restore API key |
| **Tenant Admin** | Save settings (including delight toggle) |

---

## 6. Personality Modes

### The Five Modes

| Mode | Target User | Animations | Sounds | Toasts | Narration |
|------|-------------|-----------|--------|--------|-----------|
| **Professional** | Lawyers, scientists, regulated industries | Crisp tweens (0.15s) | Single sine click or silent | Factual ("Task complete.") | Suppressed |
| **Subtle** | Academics, analysts | Quick springs (0.2s) | Quiet sine | Minimal | Suppressed |
| **Auto** | Default — adapts contextually | Standard springs (0.25s) | Standard | Context-aware | Conditional |
| **Expressive** | Knowledge workers, educators | Musical springs (0.3s) | Chord progressions | Enthusiastic | Enabled |
| **Playful** | Creative teams, training | Bouncy springs (0.4s) | 5-note chime arpeggios | Fun ("Boom! Done!") | Full with emoji |

### Enterprise Appropriateness

**Professional mode is designed specifically for regulated enterprise environments.** When a law firm deploys RADIANT with `delightDefaultMode: 'professional'` and `delightAllowUserOverride: false`:

- Zero emoji in any UI surface
- Zero overlay narration during morphs
- Zero playful toast messages
- Minimal, factual confirmation messages ("Changes saved successfully.")
- Single sine-click sounds (or fully silent if `soundEnabled: false`)
- Crisp, instant tween transitions (no spring bounce)
- Achievement tracking continues silently (for analytics)

### Auto Mode Resolution

When a user selects "Auto", the backend resolves the effective mode in real-time based on three signals:

| Signal | Factor | Resolution |
|--------|--------|------------|
| **Time of day** | Morning/business hours | → Professional |
| | Afternoon | → Expressive |
| | Late night | → Subtle |
| **Domain context** | Legal, medical, compliance | → Professional |
| | Creative, design, brainstorming | → Playful |
| | Research, data analysis | → Subtle |
| **Session duration** | First 5 minutes | Slightly more personality |
| | After 60 minutes | → Subtle (fatigue-aware) |

The `resolveAutoPersonality()` method in `delight.service.ts` combines these signals. The user can always explicitly pick a mode to bypass auto resolution.

---

## 7. Animation System

### Package: `@radiant/delight-ui`

The animation system is in `packages/delight-ui/src/animations.ts` and exports:

```typescript
// Get spring animation states for a morph transition
getMorphAnimationStates(mode: PersonalityMode): {
  initial: { opacity: number; scale: number; y: number };
  animate: { opacity: number; scale: number; y: number };
  exit: { opacity: number; scale: number; y: number };
  transition: { type: string; stiffness: number; damping: number; duration?: number };
}

// Get personality-specific config for Liquid panels
getPersonalityConfig(mode: PersonalityMode): {
  duration: number;
  stiffness: number;
  damping: number;
  showOverlay: boolean;
  overlayDuration: number;
}

// Get narration text for morph transitions
getMorphNarration(mode: PersonalityMode, targetLabel: string): string | null
// Returns null for professional/subtle, text for others
// Playful example: "Ooh, spreadsheet time! 📊"
```

### How Components Use It

```typescript
// ViewMorphTransition component
const { initial, animate, exit, transition } = getMorphAnimationStates(personalityMode);
<motion.div initial={initial} animate={animate} exit={exit} transition={transition}>
  {children}
</motion.div>

// LiquidMorphPanel component
const config = getPersonalityConfig(personalityMode);
<motion.div
  animate={{ height: isOpen ? 'auto' : 0 }}
  transition={{ type: 'spring', stiffness: config.stiffness, damping: config.damping }}
>
  {config.showOverlay && <MorphTransitionEffect narration={getMorphNarration(personalityMode, label)} />}
</motion.div>
```

---

## 8. Sound Synthesis

### Web Audio API — No File Dependencies

All sounds are synthesized at runtime using the Web Audio API. No `.mp3`, `.wav`, or `.ogg` files are shipped.

**Package**: `packages/delight-ui/src/sounds.ts`

```typescript
playSynthSound(
  mode: PersonalityMode,
  type: 'success' | 'error' | 'milestone' | 'subtle' | 'transition',
  volume?: number  // 0.0 - 1.0, default 0.25
): void
```

### Sound Profiles by Personality

| Mode | Success | Error | Milestone | Transition |
|------|---------|-------|-----------|------------|
| **Professional** | Single 880Hz sine, 80ms | Single 220Hz sine, 100ms | Two-note (C5→E5), 150ms | Silent |
| **Subtle** | Soft 660Hz sine, 100ms | Gentle 330Hz sine, 120ms | Two-note, 180ms | 440Hz blip, 50ms |
| **Auto** | 880Hz + 1100Hz chord, 120ms | 220Hz + 330Hz, 150ms | Three-note arpeggio, 250ms | 440Hz, 80ms |
| **Expressive** | Three-note chord (C5, E5, G5), 200ms | Descending two-note, 200ms | Four-note ascending, 350ms | Two-note rise, 120ms |
| **Playful** | Five-note ascending arpeggio, 400ms | Comic descending slide, 300ms | Full pentatonic scale, 500ms | Bouncy two-note, 150ms |

### How It Works

```typescript
// Inside playSynthSound:
const ctx = new (window.AudioContext || window.webkitAudioContext)();
const osc = ctx.createOscillator();
const gain = ctx.createGain();

osc.type = 'sine';  // or 'triangle' for playful
osc.frequency.value = 880;
gain.gain.value = volume;

// For playful arpeggios: schedule multiple frequency changes
osc.frequency.setValueAtTime(523, ctx.currentTime);         // C5
osc.frequency.setValueAtTime(659, ctx.currentTime + 0.08);  // E5
osc.frequency.setValueAtTime(784, ctx.currentTime + 0.16);  // G5
// ...

osc.connect(gain).connect(ctx.destination);
osc.start();
osc.stop(ctx.currentTime + duration);
```

---

## 9. Settings Persistence

### Two-Layer Persistence

User personality preferences are persisted at two levels:

| Layer | Storage | Speed | Purpose |
|-------|---------|-------|---------|
| **Frontend** | Zustand store → `localStorage` | Instant | Immediate UI feedback |
| **Backend** | Aurora PostgreSQL `user_delight_preferences` table | ~100ms | Cross-device sync, analytics |

### The `useDelightSync` Hook

**File**: `apps/thinktank/lib/hooks/useDelightSync.ts`

```typescript
useDelightSync()
// On mount:  GET /api/delight/preferences → applies to Zustand + Provider
// On change: debounced PUT /api/delight/preferences (500ms)
```

### Backend Schema

```sql
CREATE TABLE user_delight_preferences (
  user_id        VARCHAR(255) NOT NULL,
  tenant_id      VARCHAR(255) NOT NULL,
  personality_mode    VARCHAR(20) DEFAULT 'auto',
  intensity_level     INTEGER DEFAULT 5,
  enable_domain_messages   BOOLEAN DEFAULT TRUE,
  enable_model_personality BOOLEAN DEFAULT TRUE,
  enable_time_awareness    BOOLEAN DEFAULT TRUE,
  enable_achievements      BOOLEAN DEFAULT TRUE,
  enable_wellbeing_nudges  BOOLEAN DEFAULT TRUE,
  enable_easter_eggs       BOOLEAN DEFAULT TRUE,
  enable_sounds            BOOLEAN DEFAULT FALSE,
  sound_theme              VARCHAR(50) DEFAULT 'default',
  sound_volume             INTEGER DEFAULT 50,
  updated_at               TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, tenant_id)
);
```

---

## 10. Tenant Admin Controls

### Settings Location

**File**: `apps/thinktank-tenant-admin/app/(dashboard)/settings/page.tsx`

Under the "Delight UX System" section, tenant admins control:

| Setting | Type | Default | Effect |
|---------|------|---------|--------|
| `delightEnabled` | boolean | `true` | Master kill switch — when `false`, ALL delight output is suppressed org-wide |
| `delightDefaultMode` | PersonalityMode | `'auto'` | Enforced default mode for all users |
| `delightAllowUserOverride` | boolean | `true` | When `false`, users cannot change their personality mode |

### How the Provider Enforces It

```typescript
// In RadiantDelightProvider:
const tenantEnabled = config.tenantDelightEnabled !== false;

// triggerDelight — first line:
if (!tenantEnabled) return;  // Silent no-op

// setPersonalityMode — enforces lock:
if (!tenantAllowOverride && config.tenantDefaultMode) return;  // Prevents user changes
```

### Recommended Enterprise Configurations

| Organization Type | delightEnabled | delightDefaultMode | delightAllowUserOverride |
|-------------------|---------------|-------------------|------------------------|
| Law firm | `true` | `professional` | `false` |
| Hospital / HIPAA | `true` | `professional` | `false` |
| Research lab | `true` | `subtle` | `true` |
| Creative agency | `true` | `playful` | `true` |
| Consulting firm | `true` | `auto` | `true` |
| Wants no UX touches at all | `false` | — | — |

---

## 11. Guest User Behavior

### Cross-Tenant Guest Access

RADIANT supports cross-tenant guest collaboration via `collaboration_guest_invites` and `collaboration_guests` tables.

**Key facts about guests and Delight:**

| Aspect | Guest Behavior |
|--------|---------------|
| **Identity** | Token-based (`guest_token`), no Cognito account |
| **Personality mode** | Uses the tenant's `delightDefaultMode` (no user profile) |
| **Preferences** | Not persisted (no `user_delight_preferences` row) |
| **Sounds** | Default to OFF for guests |
| **Permissions** | `viewer`, `commenter`, or `editor` — set per invite |
| **Data access** | ONLY the specific collaborative session they're invited to |
| **Seat license** | None required |

Guests do NOT access Think Tank, Curator, Dojo, or any app independently. They participate only in the specific collaborative session they were invited to.

### Invite Methods

| Method | How |
|--------|-----|
| **Email** | Tenant user sends invite to any email address |
| **Link** | Shareable URL with invite token |
| **QR Code** | Scannable code for in-person collaboration |

---

## 12. Cross-App Wiring Status

| App | Provider | triggerDelight Wired | Pages with Delight |
|-----|----------|---------------------|-------------------|
| **Think Tank** | ✅ `RadiantDelightProvider` | ✅ Full lifecycle | Chat page, settings page, polymorphic views |
| **Curator** | ✅ `RadiantDelightProvider` | ✅ All 4 pages | Ingest, verify, conflicts, overrides |
| **Dojo** | ✅ `RadiantDelightProvider` | ✅ All 7 components | LibraryView, TrainingArena, ScenarioArena, DialecticArena, DecayEngine, ArchytasSettings, CompetencyMesh |
| **TT Admin** | ✅ `RadiantDelightProvider` | ✅ Key pages | Delight dashboard, API keys |
| **Tenant Admin** | ✅ `RadiantDelightProvider` | ✅ Settings | Delight on/off toggle, mode selection |
| **Genesis** | Partial | Partial | Has personality in GenesisForge |
| **Admin Dashboard** | ✅ Has delight API routes | API only | No frontend triggers yet |

---

## 13. Component Reference

### `@radiant/delight-ui` Package

| Export | Type | Purpose |
|--------|------|---------|
| `RadiantDelightProvider` | Component | Context provider — wraps app |
| `useRadiantDelight` | Hook | Access delight context (throws if no provider) |
| `useRadiantDelightOptional` | Hook | Access delight context (returns null if no provider) |
| `getMorphAnimationStates` | Function | Get personality-aware spring configs for morph transitions |
| `getPersonalityConfig` | Function | Get personality-aware panel animation config |
| `getMorphNarration` | Function | Get personality-aware narration text for morphs |
| `playSynthSound` | Function | Play Web Audio synthesized sound by type and personality |
| `PersonalityMode` | Type | `'auto' \| 'professional' \| 'subtle' \| 'expressive' \| 'playful'` |
| `InjectionPoint` | Type | 11 injection points |
| `AppDelightConfig` | Type | Configuration for provider (includes tenant controls) |

### Think Tank Components

| Component | File | Delight Integration |
|-----------|------|---------------------|
| `ViewRouter` | `components/polymorphic/view-router.tsx` | Mode switch triggers delight + synth sounds |
| `ViewMorphTransition` | Same file | Animation spring constants adapt to personality mode |
| `LiquidMorphPanel` | `components/liquid/LiquidMorphPanel.tsx` | Open/close animations use personality-aware configs |
| `MorphTransitionEffect` | Same file | Personality narration, suppressed in professional/subtle |

---

## 14. API Reference

### Delight Preferences API

```
GET  /api/delight/preferences
PUT  /api/delight/preferences

Request body (PUT):
{
  "personalityMode": "professional",
  "intensityLevel": 5,
  "enableDomainMessages": true,
  "enableModelPersonality": true,
  "enableTimeAwareness": true,
  "enableAchievements": true,
  "enableWellbeingNudges": true,
  "enableEasterEggs": false,
  "enableSounds": false,
  "soundTheme": "default",
  "soundVolume": 50
}
```

### Tenant Settings API

```
GET  /api/tenant-admin/settings
PUT  /api/tenant-admin/settings

Delight-related fields:
{
  "delightEnabled": true,
  "delightDefaultMode": "professional",
  "delightAllowUserOverride": false
}
```

### Admin Delight Dashboard API

```
GET  /api/admin/delight/dashboard
PATCH /api/admin/delight/categories/:id    { "isEnabled": true/false }
POST  /api/admin/delight/messages          { message object }
PUT   /api/admin/delight/messages/:id      { updates }
DELETE /api/admin/delight/messages/:id
```

---

## 15. Troubleshooting

### Delight Not Showing

| Symptom | Cause | Fix |
|---------|-------|-----|
| No toasts at all | `tenantDelightEnabled: false` | Tenant admin → Settings → Enable Delight |
| No toasts but sounds work | Personality mode set to `professional` for idle/session_start | Expected behavior — professional suppresses these |
| User can't change mode | `tenantAllowUserOverride: false` | Tenant admin → Settings → Allow User Override |
| Sounds not playing | `soundEnabled: false` or browser auto-play policy | User must interact with page first; check settings |
| Animations are instant (no spring) | Professional mode active | Expected — professional uses crisp tweens |
| Module resolution errors | `@radiant/delight-ui` not resolved | Run `pnpm install` from workspace root |

### Performance

- Toast container is fixed-position with `pointer-events: none` — zero layout impact
- Web Audio synthesis creates/destroys oscillators per sound — no persistent audio context
- Spring animations use `framer-motion` — GPU-accelerated transforms only
- Delight triggers are synchronous no-ops when suppressed — zero async overhead

---

*This document is part of the RADIANT comprehensive documentation set. See also:*
- `DELIGHT-SYSTEM-GUIDE.md` — Delight backend service, messages, achievements, easter eggs
- `THINKTANK-USER-GUIDE.md` — Think Tank user-facing documentation
- `THINKTANK-ADMIN-GUIDE.md` — Think Tank admin configuration
- `RADIANT-PLATFORM-ARCHITECTURE.md` — Platform architecture reference
