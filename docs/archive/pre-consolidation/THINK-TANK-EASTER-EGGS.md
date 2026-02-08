# Think Tank Easter Eggs Guide

## Overview

Think Tank includes hidden easter eggs that provide fun, alternative interaction modes for users. Easter eggs are **Think Tank only** features - they are not available in the Radiant Admin dashboard except for administrative configuration.

## Enabling/Disabling Easter Eggs

### User Settings

Users can enable or disable easter eggs in Think Tank Settings:
- Navigate to **Settings** → **Delight Preferences**
- Toggle **Enable Easter Eggs** on/off

Easter eggs are enabled by default for users with `expressive` or `playful` personality modes.

### Admin Configuration

Administrators manage easter eggs via:
- **Admin Dashboard** → **Think Tank** → **Delight** → **Easter Eggs**
- Individual easter eggs can be enabled/disabled
- Discovery statistics are tracked per easter egg

---

## Available Easter Eggs

### Keyboard Triggered

| Easter Egg | Trigger | Description | Duration |
|------------|---------|-------------|----------|
| **Konami Code** | `↑↑↓↓←→←→BA` | Classic gaming mode with retro arcade theme | 60 seconds |

**How to Activate**: Press the arrow keys and letters in sequence: Up, Up, Down, Down, Left, Right, Left, Right, B, A

**Activation Message**: 🎮 Cheat codes activated. +30 lives.

---

### Text Command Triggered

Type these commands in the Think Tank chat input to activate:

| Easter Egg | Command | Effect | Duration |
|------------|---------|--------|----------|
| **Chaos Mode** | `/chaos` | Models debate openly, disagreements visible | Until deactivated |
| **Socratic Mode** | `/socratic` | AI responds with questions instead of answers | Until deactivated |
| **Victorian Gentleman** | `/victorian` | Formal, Victorian-era speech style | Until deactivated |
| **Pirate Mode** | `/pirate` | Arrr! Pirate-speak responses | Until deactivated |
| **Haiku Mode** | `/haiku` | All responses in haiku format (5-7-5) | Until deactivated |
| **Matrix Mode** | `/matrix` | Green code rain visual effect | 30 seconds |
| **Disco Mode** | `/disco` | Disco lights and music | 30 seconds |
| **Dad Jokes Mode** | `/dadjokes` | Every response includes a dad joke | Until deactivated |
| **Emission Mode** | `/emissions` | Fun sound effects for events | Until deactivated |

---

## Detailed Easter Egg Descriptions

### /chaos - Chaos Mode
**Purpose**: Let the AI models argue openly about their answers.

**Activation**: Type `/chaos` in the chat input

**Effect**: 
- Shows disagreements between models
- Displays which models favor which approaches
- More "raw" multi-model output

**Deactivation**: Type `/chaos` again or `/normal`

**Message**: 🌪️ Chaos Mode engaged. May the best model win.

---

### /socratic - Socratic Mode
**Purpose**: The AI asks probing questions instead of giving direct answers.

**Activation**: Type `/socratic` in the chat input

**Effect**:
- Responses are primarily questions
- Encourages user to think through problems
- Great for learning and exploration

**Deactivation**: Type `/socratic` again or `/normal`

**Message**: 🏛️ Socratic Mode. I'll ask the questions now.

---

### /victorian - Victorian Gentleman Mode
**Purpose**: Formal, eloquent responses in Victorian-era style.

**Activation**: Type `/victorian` in the chat input

**Effect**:
- Highly formal language
- Victorian idioms and expressions
- Polite, elaborate responses

**Deactivation**: Type `/victorian` again or `/normal`

**Message**: 🎩 Indeed, good sir/madam. How may I assist?

---

### /pirate - Pirate Mode
**Purpose**: Responses delivered in pirate-speak.

**Activation**: Type `/pirate` in the chat input

**Effect**:
- "Arrr" and nautical terminology
- Pirate idioms and phrases
- Fun for casual conversations

**Deactivation**: Type `/pirate` again or `/normal`

**Message**: 🏴‍☠️ Ahoy! Ready to sail the seven seas of knowledge!

---

### /haiku - Haiku Mode
**Purpose**: All responses formatted as haikus.

**Activation**: Type `/haiku` in the chat input

**Effect**:
- 5-7-5 syllable structure
- Poetic, condensed responses
- Great for creative exploration

**Deactivation**: Type `/haiku` again or `/normal`

**Message**: 🌸 Five, seven, then five / Syllables mark the rhythm / Nature finds its voice

---

### /matrix - Matrix Mode
**Purpose**: Visual transformation with matrix-style code rain.

**Activation**: Type `/matrix` in the chat input

**Effect**:
- Green falling code visual effect
- Matrix-themed interface
- Automatically ends after 30 seconds

**Duration**: 30 seconds (auto-deactivates)

**Message**: 💊 You took the red pill. Let's see how deep this goes.

---

### /disco - Disco Mode
**Purpose**: Party atmosphere with lights and music.

**Activation**: Type `/disco` in the chat input

**Effect**:
- Disco ball visual effects
- Optional background music (if sounds enabled)
- Automatically ends after 30 seconds

**Duration**: 30 seconds (auto-deactivates)

**Message**: 🪩 Let's groove while we think!

---

### /dadjokes - Dad Jokes Mode
**Purpose**: Every response includes a groan-worthy dad joke.

**Activation**: Type `/dadjokes` in the chat input

**Effect**:
- Responses include related dad jokes
- Puns and wordplay throughout
- Warning: may cause eye-rolling

**Deactivation**: Type `/dadjokes` again or `/normal`

**Message**: 👨 Warning: Side effects include groaning and eye-rolling.

---

### /emissions - Emission Mode
**Purpose**: Fun sound effects for various Think Tank events.

**Activation**: Type `/emissions` in the chat input

**Effect**:
- Playful sound effects for:
  - Synthesis complete
  - Model agreement
  - Confirmations
- Uses the "emissions" sound theme

**Deactivation**: Type `/emissions` again or `/normal`

**Message**: 💨 Emissions enabled. This is going to be fun.

---

## Deactivating Easter Eggs

### Method 1: Toggle Off
Type the same command again to toggle off:
- `/pirate` → enables → `/pirate` → disables

### Method 2: Return to Normal
Type `/normal` to return to standard mode and deactivate all active easter eggs.

### Method 3: Automatic Timeout
Some easter eggs (Matrix, Disco) automatically deactivate after their duration expires.

### Method 4: Settings
Disable all easter eggs via Settings → Delight Preferences → Enable Easter Eggs → Off

---

## Achievement Integration

Discovering easter eggs contributes to achievements:

| Achievement | Requirement | Reward |
|-------------|-------------|--------|
| **Curious One** | Find 1 easter egg | 20 points |
| **Easter Hunter** | Find 5 easter eggs | 50 points |

First-time discoveries are tracked and contribute to the discovery count displayed in admin analytics.

---

## Admin-Only Notes

Easter eggs are managed exclusively through the Radiant Admin Dashboard:

- **View all easter eggs**: Admin Dashboard → Think Tank → Delight → Easter Eggs
- **Enable/disable individual eggs**: Toggle the enabled status
- **View discovery statistics**: See how many users have found each egg
- **Create custom easter eggs**: Add new triggers and effects

Easter egg functionality is **not exposed** in the main Radiant admin interface beyond configuration. They are a Think Tank consumer feature only.

---

## API Reference

### Trigger Easter Egg
```typescript
POST /api/thinktank/delight/easter-egg/trigger
{
  "triggerType": "text_input" | "key_sequence" | "time_based" | "random" | "usage_pattern",
  "triggerValue": "/pirate"
}
```

### Response
```typescript
{
  "easterEgg": {
    "id": "pirate",
    "name": "Pirate Mode",
    "effectType": "mode_change",
    "effectConfig": { "mode": "pirate", "responseStyle": "pirate" },
    "activationMessage": "🏴‍☠️ Ahoy! Ready to sail the seven seas of knowledge!",
    "effectDurationSeconds": 0
  },
  "isNewDiscovery": true,
  "achievementUnlocked": null
}
```

### Deactivate Easter Egg
```typescript
POST /api/thinktank/delight/easter-egg/deactivate
{
  "easterEggId": "pirate"
}
```

---

## Database Schema

Easter eggs are stored in the `delight_easter_eggs` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(50) | Unique identifier |
| `name` | VARCHAR(100) | Display name |
| `trigger_type` | VARCHAR(30) | How it's triggered |
| `trigger_value` | TEXT | The trigger pattern/command |
| `effect_type` | VARCHAR(30) | What type of effect |
| `effect_config` | JSONB | Effect configuration |
| `effect_duration_seconds` | INTEGER | 0 = until toggled off |
| `activation_message` | TEXT | Shown on activation |
| `deactivation_message` | TEXT | Shown on deactivation |
| `is_enabled` | BOOLEAN | Admin toggle |
| `discovery_count` | INTEGER | Total discoveries |
