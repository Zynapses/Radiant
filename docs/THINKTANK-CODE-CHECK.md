# Think Tank - Complete Code Check Document

> **Version**: 4.18.0  
> **Last Updated**: 2026-01-28  
> **Application**: @radiant/thinktank  
> **Port**: 3002  
> **Purpose**: AI Analysis Reference Document

---

## Executive Summary

Think Tank is RADIANT's **consumer-facing AI chat interface** with 106+ models, AGI orchestration, and advanced features like Time Travel, Grimoire (procedural memory), Council of Rivals (multi-model deliberation), and Sentinel Agents. This document provides a complete code inventory for AI analysis.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Frontend Structure](#3-frontend-structure)
4. [Backend API Handlers](#4-backend-api-handlers)
5. [Shared Services](#5-shared-services)
6. [Database Schema](#6-database-schema)
7. [Key TypeScript Interfaces](#7-key-typescript-interfaces)
8. [Feature Inventory](#8-feature-inventory)
9. [API Endpoint Reference](#9-api-endpoint-reference)
10. [State Management](#10-state-management)
11. [Component Inventory](#11-component-inventory)
12. [Configuration Files](#12-configuration-files)
13. [Known Implementation Gaps](#13-known-implementation-gaps)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              THINK TANK ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    FRONTEND (apps/thinktank/)                           │    │
│  │                                                                         │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │    │
│  │  │  Chat Page   │  │  Artifacts   │  │   History    │  │  Settings   │ │    │
│  │  │  (chat)/     │  │  /artifacts  │  │  /history    │  │  /settings  │ │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │    │
│  │                                                                         │    │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │    │
│  │  │                    COMPONENT LIBRARY                              │  │    │
│  │  │  chat/    liquid/    polymorphic/    ui/                         │  │    │
│  │  └──────────────────────────────────────────────────────────────────┘  │    │
│  │                                                                         │    │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │    │
│  │  │                      LIB LAYER                                    │  │    │
│  │  │  api/    auth/    stores/    i18n/    design-system/             │  │    │
│  │  └──────────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                          │                                       │
│                                          │ HTTP/REST                             │
│                                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                  API GATEWAY (AWS)                                      │    │
│  │                  /api/v2/thinktank/*                                    │    │
│  └──────────────────────────────┬──────────────────────────────────────────┘    │
│                                 │                                                │
│                                 ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │              LAMBDA HANDLERS (packages/infrastructure/lambda/thinktank/) │    │
│  │                                                                          │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │    │
│  │  │  Core Features  │  │ Advanced Features│  │ Specialized     │          │    │
│  │  │  - conversations│  │  - grimoire      │  │  - liquid-if    │          │    │
│  │  │  - users        │  │  - time-travel   │  │  - reality-eng  │          │    │
│  │  │  - models       │  │  - council-rivals│  │  - sentinel     │          │    │
│  │  │  - brain-plan   │  │  - economic-gov  │  │  - flash-facts  │          │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘          │    │
│  └──────────────────────────────┬───────────────────────────────────────────┘    │
│                                 │                                                │
│                                 ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                    SHARED SERVICES                                       │    │
│  │  packages/infrastructure/lambda/shared/services/                         │    │
│  │                                                                          │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │    │
│  │  │Grimoire │ │TimeTravel│ │Council │ │ Brain  │ │ Cortex  │           │    │
│  │  │Service  │ │Service   │ │ofRivals│ │Planner │ │ Memory  │           │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘           │    │
│  └──────────────────────────────┬───────────────────────────────────────────┘    │
│                                 │                                                │
│                                 ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                     AURORA POSTGRESQL                                    │    │
│  │                  (Multi-tenant with RLS)                                 │    │
│  │                                                                          │    │
│  │  thinktank_conversations  │  thinktank_messages  │  grimoire_spells     │    │
│  │  user_contexts            │  timelines           │  checkpoints          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

### Frontend Dependencies (package.json)

```json
{
  "name": "@radiant/thinktank",
  "version": "4.18.0",
  "dependencies": {
    "next": "14.2.35",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0",
    "framer-motion": "^11.0.0",
    "@tanstack/react-query": "^5.17.9",
    "lucide-react": "^0.454.0",
    "sonner": "^1.3.1",
    "zod": "^3.22.4",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "react-markdown": "^9.0.0",
    "react-syntax-highlighter": "^15.5.0",
    "recharts": "^2.10.0",
    "@radix-ui/*": "Various"
  }
}
```

### Backend

| Component | Technology |
|-----------|------------|
| Runtime | AWS Lambda (Node.js 18.x) |
| Database | Aurora PostgreSQL 15 |
| Cache | ElastiCache Redis |
| Storage | S3 |
| Auth | Cognito + JWT |
| API | API Gateway v2 |

---

## 3. Frontend Structure

```
apps/thinktank/
├── app/
│   ├── (chat)/                 # Chat route group (main interface)
│   │   └── page.tsx            # Main chat page
│   ├── api/                    # Next.js API routes (proxy)
│   ├── artifacts/              # Artifact viewer page
│   │   └── page.tsx
│   ├── history/                # Conversation history
│   │   └── page.tsx
│   ├── profile/                # User profile
│   │   └── page.tsx
│   ├── rules/                  # My Rules (user preferences)
│   │   └── page.tsx
│   ├── settings/               # Settings page
│   │   └── page.tsx
│   ├── simulator/              # Testing/simulation tools
│   │   ├── page.tsx
│   │   ├── brain-plan/
│   │   ├── domain-detection/
│   │   ├── flash-facts/
│   │   ├── grimoire/
│   │   └── time-machine/
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Landing redirect
│   └── providers.tsx           # React Query + Theme
│
├── components/
│   ├── chat/                   # Chat-specific components
│   │   ├── ModernChatInterface.tsx    # Main chat UI (510 lines)
│   │   ├── Sidebar.tsx               # Conversation sidebar
│   │   ├── ChatInput.tsx             # Message input
│   │   ├── MessageBubble.tsx         # Message display
│   │   ├── ModelSelector.tsx         # Model picker
│   │   ├── BrainPlanViewer.tsx       # AGI plan visualization
│   │   ├── FileAttachment.tsx        # File upload
│   │   ├── VoiceInput.tsx            # Voice recording
│   │   ├── cato-mood-selector.tsx    # Cato personality
│   │   ├── time-machine.tsx          # Time Travel UI
│   │   └── index.ts
│   │
│   ├── liquid/                 # Liquid Interface components
│   │   └── (10 items)
│   │
│   ├── polymorphic/            # Adaptive UI components
│   │   └── (2 items)
│   │
│   └── ui/                     # Base UI primitives
│       └── (19 items - buttons, cards, dialogs, etc.)
│
├── lib/
│   ├── api/                    # API client services
│   │   ├── chat.ts             # Chat/conversation API
│   │   ├── client.ts           # Base HTTP client
│   │   ├── types.ts            # API type definitions
│   │   ├── artifacts.ts        # Artifact operations
│   │   ├── brain-plan.ts       # Brain planning API
│   │   ├── collaboration.ts    # Shared sessions
│   │   ├── compliance-export.ts # GDPR exports
│   │   ├── derivation-history.ts
│   │   ├── flash-facts.ts      # Flash Facts API
│   │   ├── governor.ts         # Economic governor
│   │   ├── grimoire.ts         # Grimoire API
│   │   ├── ideas.ts            # Ideas API
│   │   ├── liquid-interface.ts # Liquid Interface API
│   │   ├── models.ts           # Model listing
│   │   ├── rules.ts            # User rules
│   │   ├── settings.ts         # Settings API
│   │   ├── time-travel.ts      # Time Travel API
│   │   └── index.ts
│   │
│   ├── auth/                   # Authentication
│   │   └── (2 items)
│   │
│   ├── stores/                 # Zustand state stores
│   │   ├── ui-store.ts         # UI state (sidebar, advanced mode)
│   │   └── chat-store.ts       # Chat state
│   │
│   ├── i18n/                   # Internationalization
│   │   └── (6 items)
│   │
│   ├── design-system/          # Design tokens
│   │   └── (2 items)
│   │
│   └── utils.ts                # Utility functions
│
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## 4. Backend API Handlers

**Location**: `packages/infrastructure/lambda/thinktank/`

### Handler Router (handler.ts)

Main entry point that routes `/api/v2/thinktank/{resource}/*` to sub-handlers:

```typescript
// Resource routing (41 handlers total)
switch (resource) {
  // Core Features
  case 'conversations': // CRUD for chat conversations
  case 'users':         // User management
  case 'models':        // Model listing/selection
  case 'brain-plan':    // AGI planning visualization
  case 'user-context':  // Persistent user context
  case 'domain-modes':  // Domain detection
  case 'model-categories': // Model categorization
  case 'ratings':       // Message ratings

  // Advanced Features
  case 'grimoire':      // Procedural memory spells
  case 'economic-governor': // Cost management
  case 'time-travel':   // Conversation forking
  case 'council-of-rivals': // Multi-model deliberation
  case 'concurrent-execution': // Parallel model calls
  case 'structure-from-chaos': // Chaos to structure
  case 'sentinel-agents': // Background monitors
  case 'flash-facts':   // Quick knowledge capture

  // Specialized Features
  case 'liquid-interface': // Dynamic UI generation
  case 'reality-engine':   // World simulation
  case 'security-signals': // Security monitoring
  case 'policy-framework': // Policy enforcement
  case 'derivation-history': // Reasoning audit
  case 'enhanced-collaboration': // Real-time collab
  case 'file-conversion': // File processing
  case 'ideas':          // Idea management

  case 'artifacts':      // Artifact engine

  // Analytics & Settings
  case 'analytics':
  case 'settings':
  case 'my-rules':
  case 'shadow-testing':

  // GDPR & Compliance
  case 'consent':
  case 'gdpr':
  case 'security-config':

  // UX
  case 'rejections':
  case 'preferences':
  case 'ui-feedback':
  case 'ui-improvement':
  case 'multipage-apps':
}
```

### Handler File Inventory

| File | Size | Purpose |
|------|------|---------|
| `handler.ts` | 8.2KB | Main router |
| `conversations.ts` | 8.7KB | Conversation CRUD |
| `users.ts` | 11.1KB | User management |
| `models.ts` | 19.6KB | Model listing/selection |
| `brain-plan.ts` | 15.1KB | AGI planning API |
| `user-context.ts` | 16.8KB | Persistent context |
| `domain-modes.ts` | 10.5KB | Domain detection |
| `model-categories.ts` | 6.5KB | Model categorization |
| `ratings.ts` | 13.4KB | Message ratings |
| `grimoire.ts` | 21.5KB | Procedural memory |
| `economic-governor.ts` | 21.5KB | Cost management |
| `time-travel.ts` | 14.1KB | Conversation forking |
| `council-of-rivals.ts` | 20.8KB | Multi-model deliberation |
| `sentinel-agents.ts` | 18.8KB | Background agents |
| `flash-facts.ts` | 17.6KB | Quick knowledge |
| `liquid-interface.ts` | 10.1KB | Dynamic UI |
| `reality-engine.ts` | 13.5KB | World simulation |
| `security-signals.ts` | 18.1KB | Security monitoring |
| `policy-framework.ts` | 22.7KB | Policy enforcement |
| `derivation-history.ts` | 13.7KB | Reasoning audit |
| `artifact-engine.ts` | 17.4KB | Artifact management |
| `analytics.ts` | 6.6KB | Usage analytics |
| `settings.ts` | 8.6KB | User settings |
| `preferences.ts` | 11.4KB | User preferences |
| `consent.ts` | 8.7KB | Consent management |
| `gdpr.ts` | 10.3KB | GDPR operations |
| `security-config.ts` | 9.6KB | Security config |
| `living-parchment.ts` | 10.0KB | Living documents |
| `decision-artifacts.ts` | 21.7KB | Decision tracking |
| `shadow-testing.ts` | 13.8KB | A/B testing |
| `ui-feedback.ts` | 9.1KB | UI feedback |
| `ui-improvement.ts` | 15.2KB | UI improvements |

---

## 5. Shared Services

**Location**: `packages/infrastructure/lambda/shared/services/`

### Core Services Used by Think Tank

| Service | File | Purpose |
|---------|------|---------|
| **AGI Brain Planner** | `agi-brain-planner.service.ts` | Multi-step AGI planning |
| **Grimoire** | `grimoire.service.ts` | Procedural memory spells |
| **Time Travel** | `time-travel.service.ts` | Conversation forking |
| **Council of Rivals** | `council-of-rivals.service.ts` | Multi-model deliberation |
| **Sentinel Agent** | `sentinel-agent.service.ts` | Background monitoring |
| **Economic Governor** | `economic-governor.service.ts` | Cost management |
| **User Persistent Context** | `user-persistent-context.service.ts` | User memory |
| **Result Derivation** | `result-derivation.service.ts` | Reasoning audit |
| **Model Selection** | `model-selection-service.ts` | Optimal model routing |
| **Cortex Intelligence** | `cortex-intelligence.service.ts` | Memory retrieval |
| **Flash Facts** | `flash-facts.service.ts` | Quick knowledge |

### Cato Services (AGI Safety)

| Service | File | Purpose |
|---------|------|---------|
| **Genesis** | `cato/genesis.service.ts` | Developmental gates |
| **Safety Pipeline** | `cato/safety-pipeline.service.ts` | Safety checks |
| **Control Barrier** | `cato/control-barrier.service.ts` | Rate limiting |
| **Persona** | `cato/persona.service.ts` | AI personality |

---

## 6. Database Schema

### Core Tables

```sql
-- Main conversation table
CREATE TABLE thinktank_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(500),
    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 6) DEFAULT 0,
    primary_model VARCHAR(100),
    domain_mode VARCHAR(50),
    persona_id UUID,
    focus_mode_id UUID,
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages within conversations
CREATE TABLE thinktank_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES thinktank_conversations(id),
    role VARCHAR(20) NOT NULL, -- user, assistant, system, tool
    content TEXT NOT NULL,
    model VARCHAR(100),
    tokens_used INTEGER,
    cost DECIMAL(10, 6),
    latency_ms INTEGER,
    metadata JSONB DEFAULT '{}',
    parent_message_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Related Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `user_contexts` | Persistent user context | user_id, context_type, content |
| `user_preferences` | User settings | user_id, preference_key, value |
| `grimoire_spells` | Procedural memory | tenant_id, pattern, incantation, school |
| `spell_castings` | Spell usage history | spell_id, success, tokens_saved |
| `timelines` | Conversation forks | conversation_id, parent_id, state |
| `checkpoints` | Timeline checkpoints | timeline_id, state_snapshot |
| `sentinel_agents` | Background agents | tenant_id, type, triggers, actions |
| `sentinel_events` | Agent events | agent_id, type, payload |
| `council_sessions` | Multi-model sessions | conversation_id, models, votes |
| `model_ratings` | User ratings | message_id, rating, feedback |
| `flash_facts` | Quick knowledge | user_id, fact, category |
| `derivation_records` | Reasoning audit | prompt_id, steps, model_usage |

### Migrations

| Migration | Description |
|-----------|-------------|
| `016_think_tank.sql` | Base Think Tank tables |
| `042_thinktank_conversations.sql` | Conversations + messages |
| `136_thinktank_shared_conversations.sql` | Collaboration features |
| `145_thinktank_domain_columns.sql` | Domain mode columns |
| `174_thinktank_missing_features.sql` | Additional features |

---

## 7. Key TypeScript Interfaces

### Frontend Types

```typescript
// Chat message
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  metadata?: {
    modelUsed?: string;
    tokensUsed?: number;
    latencyMs?: number;
    costEstimate?: number;
    orchestrationMode?: string;
    domainDetected?: string;
  };
}

// Conversation
interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
  isFavorite?: boolean;
  tags?: string[];
  domainMode?: string;
}

// API Message format
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  modelId?: string;
  metadata?: {
    tokensUsed?: number;
    latencyMs?: number;
    orchestrationMode?: string;
  };
}

// Stream chunk for SSE
interface StreamChunk {
  type: 'content' | 'metadata' | 'done' | 'error';
  content?: string;
  metadata?: ChatResponse;
  error?: string;
}
```

### Backend Types

```typescript
// Grimoire Spell
interface Spell {
  id: string;
  tenantId: string;
  name: string;
  pattern: string;
  incantation: string;
  school: SpellSchool;
  category: SpellCategory;
  powerLevel: number;
  status: SpellStatus;
  successRate: number;
  totalCasts: number;
  tokensAvoided: number;
}

type SpellSchool = 'evocation' | 'divination' | 'transmutation' | 
                   'abjuration' | 'conjuration' | 'enchantment';
type SpellCategory = 'prompt_optimization' | 'error_recovery' | 
                     'context_management' | 'output_formatting';
type SpellStatus = 'draft' | 'active' | 'deprecated';

// Time Travel
interface Timeline {
  id: string;
  conversationId: string;
  parentTimelineId?: string;
  name: string;
  status: 'active' | 'archived' | 'deleted';
  checkpointCount: number;
  forkCount: number;
}

interface Checkpoint {
  id: string;
  timelineId: string;
  type: CheckpointType;
  stateSnapshot: object;
  description: string;
}

type CheckpointType = 'auto' | 'manual' | 'fork_point' | 'merge_point';

// Sentinel Agent
interface SentinelAgent {
  id: string;
  tenantId: string;
  type: AgentType;
  name: string;
  status: AgentStatus;
  triggers: AgentTrigger[];
  actions: AgentAction[];
  conditions: AgentCondition[];
}

type AgentType = 'monitor' | 'guardian' | 'optimizer' | 'auditor';
type AgentStatus = 'active' | 'paused' | 'disabled' | 'error';
```

---

## 8. Feature Inventory

### Core Features

| Feature | Status | Files |
|---------|--------|-------|
| **Chat Interface** | ✅ Complete | `ModernChatInterface.tsx`, `ChatInput.tsx` |
| **Conversation Management** | ✅ Complete | `Sidebar.tsx`, `conversations.ts` |
| **Model Selection** | ✅ Complete | `ModelSelector.tsx`, `models.ts` |
| **Message Streaming** | ✅ Complete | `chat.ts` (SSE) |
| **File Attachments** | ✅ Complete | `FileAttachment.tsx`, `file-conversion.ts` |
| **Voice Input** | ✅ Complete | `VoiceInput.tsx` |
| **Message Ratings** | ✅ Complete | `ratings.ts` |

### Advanced Features

| Feature | Status | Files |
|---------|--------|-------|
| **Brain Plan Viewer** | ✅ Complete | `BrainPlanViewer.tsx`, `brain-plan.ts` |
| **Time Machine** | ✅ Complete | `time-machine.tsx`, `time-travel.ts` |
| **Grimoire** | ✅ Complete | `grimoire.ts`, `grimoire.service.ts` |
| **Council of Rivals** | ✅ Complete | `council-of-rivals.ts` |
| **Sentinel Agents** | ✅ Complete | `sentinel-agents.ts` |
| **Flash Facts** | ✅ Complete | `flash-facts.ts` |
| **Economic Governor** | ✅ Complete | `economic-governor.ts` |

### Specialized Features

| Feature | Status | Files |
|---------|--------|-------|
| **Liquid Interface** | ✅ Complete | `liquid-interface.ts`, `liquid/` |
| **Reality Engine** | ✅ Complete | `reality-engine.ts` |
| **Policy Framework** | ✅ Complete | `policy-framework.ts` |
| **Security Signals** | ✅ Complete | `security-signals.ts` |
| **Derivation History** | ✅ Complete | `derivation-history.ts` |

### Compliance Features

| Feature | Status | Files |
|---------|--------|-------|
| **GDPR Export** | ✅ Complete | `gdpr.ts`, `compliance-export.ts` |
| **Consent Management** | ✅ Complete | `consent.ts` |
| **Audit Logging** | ✅ Complete | Throughout |

---

## 9. API Endpoint Reference

### Base URL: `/api/v2/thinktank`

#### Conversations

| Method | Path | Handler |
|--------|------|---------|
| GET | `/conversations` | `listConversations` |
| POST | `/conversations` | `createConversation` |
| GET | `/conversations/:id` | `getConversation` |
| DELETE | `/conversations/:id` | `deleteConversation` |
| POST | `/conversations/:id/messages` | `sendMessage` |
| POST | `/conversations/:id/stream` | `streamMessage` (SSE) |
| POST | `/conversations/:id/messages/:mid/rate` | `rateMessage` |
| POST | `/conversations/:id/messages/:mid/regenerate` | `regenerateMessage` |

#### Brain Plan

| Method | Path | Handler |
|--------|------|---------|
| POST | `/brain-plan/generate` | `generatePlan` |
| GET | `/brain-plan/:id` | `getPlan` |
| POST | `/brain-plan/:id/execute` | `executePlan` |

#### Grimoire

| Method | Path | Handler |
|--------|------|---------|
| GET | `/grimoire/spells` | `listSpells` |
| GET | `/grimoire/spells/:id` | `getSpell` |
| POST | `/grimoire/spells` | `createSpell` |
| POST | `/grimoire/spells/:id/cast` | `castSpell` |
| GET | `/grimoire/schools` | `getSchools` |
| POST | `/grimoire/match` | `findSpellByPattern` |
| POST | `/grimoire/promote` | `promoteToSpell` |

#### Time Travel

| Method | Path | Handler |
|--------|------|---------|
| GET | `/time-travel/timelines` | `listTimelines` |
| POST | `/time-travel/timelines` | `createTimeline` |
| GET | `/time-travel/timelines/:id` | `getTimeline` |
| POST | `/time-travel/timelines/:id/fork` | `forkTimeline` |
| GET | `/time-travel/timelines/:id/checkpoints` | `listCheckpoints` |
| POST | `/time-travel/timelines/:id/checkpoints` | `createCheckpoint` |
| POST | `/time-travel/timelines/:id/replay` | `replayTimeline` |

#### Council of Rivals

| Method | Path | Handler |
|--------|------|---------|
| POST | `/council-of-rivals/deliberate` | `startDeliberation` |
| GET | `/council-of-rivals/sessions/:id` | `getSession` |
| POST | `/council-of-rivals/sessions/:id/vote` | `submitVote` |
| GET | `/council-of-rivals/presets` | `getPresets` |

#### Sentinel Agents

| Method | Path | Handler |
|--------|------|---------|
| GET | `/sentinel-agents` | `listAgents` |
| POST | `/sentinel-agents` | `createAgent` |
| GET | `/sentinel-agents/:id` | `getAgent` |
| PUT | `/sentinel-agents/:id` | `updateAgent` |
| DELETE | `/sentinel-agents/:id` | `deleteAgent` |
| GET | `/sentinel-agents/:id/events` | `getAgentEvents` |
| GET | `/sentinel-agents/stats` | `getStats` |
| GET | `/sentinel-agents/types` | `getTypes` |

#### Economic Governor

| Method | Path | Handler |
|--------|------|---------|
| GET | `/economic-governor/budget` | `getBudget` |
| POST | `/economic-governor/budget` | `updateBudget` |
| GET | `/economic-governor/usage` | `getUsage` |
| GET | `/economic-governor/arbitrage-rules` | `listArbitrageRules` |
| POST | `/economic-governor/arbitrage-rules` | `addArbitrageRule` |
| GET | `/economic-governor/forecasts` | `getForecasts` |

#### Settings & Preferences

| Method | Path | Handler |
|--------|------|---------|
| GET | `/settings` | `getSettings` |
| PUT | `/settings` | `updateSettings` |
| GET | `/preferences` | `getPreferences` |
| PUT | `/preferences` | `updatePreferences` |
| GET | `/my-rules` | `getRules` |
| PUT | `/my-rules` | `updateRules` |

#### GDPR

| Method | Path | Handler |
|--------|------|---------|
| GET | `/gdpr/export` | `requestExport` |
| GET | `/gdpr/export/:id` | `getExportStatus` |
| POST | `/gdpr/erasure` | `requestErasure` |
| GET | `/consent` | `getConsent` |
| POST | `/consent` | `updateConsent` |

---

## 10. State Management

### UI Store (Zustand)

```typescript
// lib/stores/ui-store.ts
interface UIState {
  sidebarOpen: boolean;
  advancedMode: boolean;
  focusMode: boolean;
  soundEnabled: boolean;
  
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setAdvancedMode: (enabled: boolean) => void;
  toggleAdvancedMode: () => void;
  setFocusMode: (enabled: boolean) => void;
  toggleFocusMode: () => void;
  setSoundEnabled: (enabled: boolean) => void;
}

// Persisted to localStorage: 'thinktank-ui-storage'
```

### Chat Store (Zustand)

```typescript
// lib/stores/chat-store.ts
interface ChatState {
  activeConversationId: string | null;
  messages: Record<string, ChatMessage[]>;
  isStreaming: boolean;
  
  setActiveConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  setStreaming: (streaming: boolean) => void;
}
```

### Server State (React Query)

```typescript
// Used for:
// - Conversation list (with caching)
// - Model list (rarely changes)
// - User preferences
// - Settings
```

---

## 11. Component Inventory

### Chat Components

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| `ModernChatInterface` | `ModernChatInterface.tsx` | 510 | Main chat UI with glassmorphism |
| `Sidebar` | `Sidebar.tsx` | ~400 | Conversation list sidebar |
| `ChatInput` | `ChatInput.tsx` | ~150 | Message input with attachments |
| `MessageBubble` | `MessageBubble.tsx` | ~150 | Message display |
| `ModelSelector` | `ModelSelector.tsx` | ~300 | Model picker dropdown |
| `BrainPlanViewer` | `brain-plan-viewer.tsx` | ~400 | AGI plan visualization |
| `FileAttachment` | `file-attachments.tsx` | ~350 | File upload handling |
| `VoiceInput` | `voice-input.tsx` | ~300 | Voice recording |
| `TimeMachine` | `time-machine.tsx` | ~350 | Time Travel UI |
| `CatoMoodSelector` | `cato-mood-selector.tsx` | ~250 | AI personality picker |
| `AdvancedModeToggle` | `AdvancedModeToggle.tsx` | ~100 | Power features toggle |

### Liquid Components

| Component | Purpose |
|-----------|---------|
| Dynamic grid layouts |
| Adaptive cards |
| Real-time data binding |
| AI-generated UIs |

### UI Primitives

| Component | Purpose |
|-----------|---------|
| `Button` | Styled buttons |
| `GlassCard` | Glassmorphism cards |
| `Dialog` | Modal dialogs |
| `Dropdown` | Dropdown menus |
| `Tabs` | Tab navigation |
| `Badge` | Status badges |
| `Progress` | Progress bars |
| `Slider` | Range inputs |
| `Switch` | Toggle switches |
| `Tooltip` | Hover tooltips |

---

## 12. Configuration Files

### package.json

```json
{
  "name": "@radiant/thinktank",
  "version": "4.18.0",
  "scripts": {
    "dev": "next dev -p 3002",
    "build": "next build",
    "start": "next start -p 3002",
    "lint": "next lint"
  }
}
```

### tailwind.config.js

```javascript
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Think Tank color palette
        'aurora-purple': '#7c3aed',
        'aurora-pink': '#ec4899',
        'aurora-blue': '#3b82f6',
        // Glass effects
        'glass-white': 'rgba(255,255,255,0.03)',
        'glass-border': 'rgba(255,255,255,0.06)',
      },
      backdropBlur: {
        'xl': '24px',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
}
```

### next.config.js

```javascript
module.exports = {
  transpilePackages: ['@radiant/shared'],
  experimental: {
    serverActions: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
}
```

---

## 13. Known Implementation Gaps

### To Verify

| Area | Check |
|------|-------|
| All 41 handlers have corresponding service methods | Need service audit |
| All API routes have frontend API client methods | Verify `lib/api/` coverage |
| All components use proper TypeScript types | Check for `any` usage |
| Error handling consistent across handlers | Verify error response format |
| RLS policies on all Think Tank tables | Check migrations |

### Recent Fixes (v5.52.50)

- Fixed `TimeTravelService.forkTimeline` and `replayCheckpoints` methods
- Fixed `SentinelAgentService.getAllEvents` and `getStats` methods
- Fixed `GrimoireService` query methods
- Fixed `ResultDerivationService.compareDerivations` method
- Removed `as any` casts in handlers

### Potential Issues

1. **Streaming**: SSE implementation may need reconnection logic
2. **Large Conversations**: Pagination for very long conversations
3. **Offline Support**: No offline capability currently
4. **WebSocket**: No real-time collaboration via WebSocket yet

---

## Appendix A: File Size Summary

### Frontend

| Directory | Files | Total Size |
|-----------|-------|------------|
| `app/` | 18 | ~50KB |
| `components/chat/` | 15 | ~150KB |
| `components/liquid/` | 10 | ~80KB |
| `components/ui/` | 19 | ~100KB |
| `lib/api/` | 19 | ~60KB |
| `lib/stores/` | 2 | ~5KB |

### Backend Handlers

| Count | Total Size |
|-------|------------|
| 41 handlers | ~530KB |

### Shared Services

| Category | Services | Total Size |
|----------|----------|------------|
| Core | 15 | ~400KB |
| Cato | 12 | ~200KB |

---

## Appendix B: Quick Start Commands

```bash
# Development
cd apps/thinktank
npm install
npm run dev
# → http://localhost:3002

# Build
npm run build

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

---

## Appendix C: Related Documentation

- [THINKTANK-USER-GUIDE.md](/docs/THINKTANK-USER-GUIDE.md) - End user guide
- [THINKTANK-ADMIN-GUIDE.md](/docs/THINKTANK-ADMIN-GUIDE.md) - Admin features
- [RADIANT-PLATFORM-ARCHITECTURE.md](/docs/RADIANT-PLATFORM-ARCHITECTURE.md) - Platform overview
- [SERVICE-LAYER-GUIDE.md](/docs/SERVICE-LAYER-GUIDE.md) - API/MCP/A2A

---

*Document generated for RADIANT v4.18.0 - Think Tank Code Check*
*For AI analysis purposes*
