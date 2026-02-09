# Aurelius Dojo — Complete Reference

**Training • Spaced Repetition • Adversarial Scenarios • Competency Mesh**

*RADIANT v7.46.0 — Updated February 08, 2026*

---

## Table of Contents

- **Part I: User Guide**

---


---

## Part I: User Guide

> **Classification**: RADIANT INTERNAL  
> **Version**: 1.2.0 | **Date**: February 6, 2026  
> **Status**: FULLY WIRED — Frontend + Lambda + Database + CDK  
> **Part of**: RADIANT Think Tank Ecosystem  
> **Port**: 3004

---

## 1. What is the Dojo?

The Aurelius Dojo is an **agent-powered training platform** that transforms private document libraries into structured, thematic mastery experiences. It is designed for:

- **New employee onboarding** — order taking rules, policies, procedures
- **Cross-training** — learn a different area of the business
- **Compliance training** — regulations, safety protocols, legal requirements
- **Product knowledge** — product lists, pricing, specifications

The Dojo is **not a chatbot**. It is a structured learning environment with AI-driven lesson generation, adversarial testing, and mastery tracking.

---

## 2. Core Concepts

### 2.1 Thematic Gating Protocol (TGP)

Users **never see the raw document library**. Instead, the AI analyzes all documents and discovers 10-15 **Central Themes** — the core knowledge pillars. Training is gated to selected themes only, ensuring:

- **No cognitive overload** — focused learning, not library browsing
- **100% thematic purity** — AI only retrieves content matching your selected themes
- **Deep mastery** — forced to internalize, not just skim

### 2.2 The Conservation Cycle

Every training session follows a four-step cycle:

| Step | Name | What Happens |
|------|------|-------------|
| 1 | **Follow** | Select 1-3 Central Themes from the theme HUD |
| 2 | **Call** | Sensei delivers synthesized lessons (Lecture Mode) |
| 3 | **Tranq** | Adversarial agent challenges you (Sparring Mode) |
| 4 | **Collect** | Earn XP, advance rank, unlock harder themes |

### 2.3 Rank System

| Rank | XP Required | Badge Color | Access |
|------|-------------|-------------|--------|
| **Novice** | 0 | Slate | Fundamental themes only |
| **Initiate** | 500 | Green | Intermediate themes unlock |
| **Adept** | 2,000 | Blue | Advanced themes unlock |
| **Master** | 5,000 | Purple | Expert themes + certification exams |
| **Radiant** | 10,000 | Gold | Full mastery — all content unlocked |

---

## 3. Using the Dojo

### 3.1 Library Tab

1. Click **New Library** to create a knowledge base
2. Give it a name (e.g., "Order Taking Procedures") and description
3. **Upload documents** — drag-and-drop or browse for PDF, MD, TXT, CSV files
4. Wait for ingestion (status indicators: pending → ingesting → analyzing → ready)
5. Click **Discover Themes** to let the AI analyze and extract Central Themes

### 3.2 Themes Tab

1. Browse the discovered Central Themes — each shows difficulty tier, required rank, and chunk count
2. **Select 1-3 themes** to focus your training
3. Themes are color-coded by difficulty: green (fundamental), blue (intermediate), purple (advanced), gold (expert)
4. Click **Start Training** to enter the arena

### 3.3 Training Tab — Lecture Mode

1. Choose **Lecture Mode** to learn from the Sensei
2. The AI generates synthesized lesson blocks from your library, grounded in citations
3. Click the **sources** link on any lesson to see the exact document excerpts
4. Click **Next Lesson** to continue progressing
5. Click **End Session** when done

### 3.4 Training Tab — Sparring Mode

1. Choose **Sparring Mode** to be challenged
2. The adversarial testing agent generates questions:
   - **Multiple choice** — select the best answer
   - **Scenario-based** — apply library principles to a situation
   - **Open-ended** — explain your reasoning
   - **True/False** — quick knowledge checks
3. Submit your answer to receive:
   - Correct/incorrect verdict with partial credit
   - The correct answer with full explanation
   - Reasoning analysis of your response
   - Source citations proving the answer
   - XP awarded
4. Click **Next Question** to continue

### 3.5 Progress Tab

- View your **overall rank** and XP progress bar
- See **per-theme mastery** with accuracy, strengths, and weaknesses
- Track **streak days**, session count, and total time
- View earned **certifications**

### 3.6 Mobot Sidebar

Click the **Mobot** button in the top bar to open the Knowledge Agent:

- Ask any question about your training topics
- Answers are grounded in your library with hoverable citations
- Mobot is context-aware — it knows your current session and selected themes
- Use it for quick reference without leaving the training workflow

---

## 4. API Architecture

**All communication goes through the service layer.** The Dojo frontend never accesses data directly.

| Endpoint Group | Base Path | Purpose |
|---------------|-----------|---------|
| Libraries | `/api/admin/dojo/libraries/` | CRUD, document upload, theme discovery |
| Sessions | `/api/admin/dojo/sessions/` | Training sessions, lessons, sparring |
| Progress | `/api/admin/dojo/progress/` | User progress, theme mastery |
| Certifications | `/api/admin/dojo/certifications/` | Proctored exams |
| Mobot | `/api/admin/dojo/mobot/` | Knowledge Agent |
| Config | `/api/admin/dojo/config/` | Admin settings |
| Decay | `/api/admin/dojo/decay/` | Ebbinghaus decay curves & reinforcement |
| Scenarios | `/api/admin/dojo/scenarios/` | Adversarial scenario synthesis |
| Competencies | `/api/admin/dojo/competencies/` | Predictive competency mesh |
| Dialectic | `/api/admin/dojo/dialectic/` | Socratic dialectic engine |
| Multimodal | `/api/admin/dojo/multimodal/` | Audio, diagrams, glossary generation |
| Pulse | `/api/admin/dojo/pulse/` | Org-wide knowledge health dashboard |
| Archytas | `/api/admin/dojo/archytas/` | Tool Master config, invocation, suggestions |

### Backend Infrastructure

| Component | File | Details |
|-----------|------|---------|
| **Lambda Handler** | `packages/infrastructure/lambda/admin/dojo.ts` | 35+ endpoints, path-based routing |
| **Database Migration** | `packages/infrastructure/migrations/V2026_02_06_005__aurelius_dojo.sql` | 19 tables, 13 enums, 3 functions |
| **CDK Stack** | `packages/infrastructure/lib/stacks/admin-stack.ts` | DojoFunction + proxy resource |

**Note**: All AI-dependent features (theme discovery, lesson generation, sparring questions, scenario responses, dialectic responses, multimodal generation, mobot, competency extraction, Archytas suggestions) are implemented inline via `modelRouterService` using the tenant-configured AI model. The `invokeDojoLLM()` helper routes all calls through drift enforcement and spend governance.

---

## 5. Design System

The Dojo uses a **warm gold/amber "discipline" palette** distinct from the cool cyan of Genesis Forge:

| Token | Value | Usage |
|-------|-------|-------|
| Background | `rgb(15, 12, 8)` | Near-black warm base |
| Primary | `dojo-500` (#f59e0b) | Amber — discipline, mastery |
| Accent | `omega-500` (#0ea5e9) | Cyan — platform continuity |
| Glass Panel | `bg-[#0a0806]/85 backdrop-blur-md` | Frosted glass |
| Font | Inter + JetBrains Mono | Display + monospaced |
| Pattern | Tatami grid | 40px amber gridlines at 2% opacity |

### Rank Colors

| Rank | Color | Tailwind |
|------|-------|----------|
| Novice | Slate | `text-slate-400` |
| Initiate | Green | `text-green-400` |
| Adept | Blue | `text-blue-400` |
| Master | Purple | `text-purple-400` |
| Radiant | Gold | `text-dojo-400` |

---

## 6. Leapfrog Features (v1.1.0)

These 6 features put Dojo **3-5 years ahead** of every competitor (Docebo, Virti, Second Nature, Axonify, Sana Labs, Cornerstone, Degreed).

### 6.1 Ebbinghaus Decay Engine (Retention Tab)

Unlike Axonify's simple flashcard scheduling, the Decay Engine tracks a **per-concept neural decay model**:

- Each "knowledge atom" has its own **half-life** (how fast you forget it)
- **Retention probability** is calculated per-atom, per-user, per-theme
- Correct answers **increase** the half-life → next review pushed further out
- Incorrect answers **shorten** the half-life → more frequent reinforcement
- Dashboard shows at-risk concepts, average retention, and per-theme decay bars
- **Reinforcement sessions** are triggered at the optimal recall moment

### 6.2 Adversarial Scenario Synthesis (Scenarios Tab)

Unlike Second Nature's scripted sales roleplay, Dojo generates **branching multi-turn scenarios** from your actual policies:

- **9 persona archetypes**: Confused Customer, Angry Customer, VIP Escalation, Compliance Auditor, Hostile Negotiator, etc.
- Each persona has hidden objectives, emotional state, and communication style
- Every response is scored: **optimal**, **acceptable**, **suboptimal**, or **critical error**
- Personas react dynamically — emotional shifts based on your responses
- Debrief includes: Emotional Intelligence, Policy Adherence, Resolution scores + per-turn timeline

### 6.3 Socratic Dialectic Engine (Dialectic Tab)

**No competitor has this.** Three AI agents debate a proposition from your library:

- **Thesis Agent** (green) — Presents the proposition with evidence
- **Antithesis Agent** (red) — Challenges with counterarguments and edge cases
- **Synthesis Agent** (purple) — Reconciles positions after you take a stand
- You participate by submitting Claims, Evidence, Rebuttals, Concessions, or Syntheses
- Scored on: Reasoning Chain, Argument Quality, Evidence Usage, Critical Thinking
- **Logical fallacy detection** — identifies ad hominem, straw man, false dichotomy, etc.

### 6.4 Predictive Competency Mesh (Competency Tab)

Unlike Degreed's manual skill tagging, Dojo **auto-extracts competencies** from your library:

- AI discovers competency graph with proficiency levels and prerequisites
- Per-user proficiency tracking with confidence scoring and trend (improving/stable/declining)
- **Role readiness scores** — "You are 73% ready for Senior Customer Service Rep"
- Missing competencies identified with estimated time-to-ready
- **Recommended learning path** with priority ranking (critical → high → medium → low)
- Team-level gap analysis for managers

### 6.5 Multimodal Lesson Synthesis (Types + API)

Auto-generates rich content from lesson blocks:

- Audio narration of lessons
- 6 diagram types: flowchart, mindmap, timeline, comparison, hierarchy, process (Mermaid)
- Auto-extracted glossary with definitions and related terms
- Key takeaways summary
- Learning style adaptations (visual/auditory/kinesthetic/reading-writing)

### 6.6 Organizational Knowledge Pulse (Pulse Tab)

**No competitor offers real-time org-wide knowledge health monitoring:**

- **Overall health score** (0-100%) with trend indicator
- **Department health breakdown** — scores, accuracy, at-risk counts, training hours
- **Decay alerts** — "Sales team hasn't been tested on Return Policy in 90 days" (critical/warning/info)
- **Theme compliance coverage** — trained users, mastery, decay risk, compliance status
- **ROI metrics**: cost savings/month, avg time-to-competency, cert pass rate, retention rate, hours saved vs traditional

---

## 7. File Structure

```
apps/dojo/
├── app/
│   ├── globals.css          # Dojo design system CSS
│   ├── layout.tsx           # Root layout with providers
│   ├── page.tsx             # Main page with 9-tab routing
│   └── providers.tsx        # React Query provider
├── components/
│   ├── DojoSidebar.tsx      # Left navigation sidebar (9 tabs)
│   ├── LibraryView.tsx      # Document library management
│   ├── ThemeSelector.tsx    # Central theme discovery & selection
│   ├── TrainingArena.tsx    # Lecture + Sparring modes
│   ├── ProgressDashboard.tsx # Rank, XP, certifications
│   ├── MobotPanel.tsx       # Knowledge Agent sidebar
│   ├── DecayEngine.tsx      # Ebbinghaus decay dashboard + reinforcement
│   ├── ScenarioArena.tsx    # Digital twin scenario synthesis
│   ├── DialecticArena.tsx   # Socratic multi-agent debate
│   ├── CompetencyMesh.tsx   # Predictive competency mesh
│   └── KnowledgePulse.tsx   # Org-wide knowledge health dashboard
├── lib/
│   ├── api.ts               # Service layer — 60+ typed endpoints
│   ├── dojo-store.ts        # Zustand state management
│   └── utils.ts             # Rank metadata, formatting helpers
├── package.json             # @radiant/dojo — port 3004
├── tailwind.config.ts       # Dojo color palette & animations
├── tsconfig.json
├── next.config.js
└── postcss.config.js
```

---

## 7. Running the Dojo

```bash
# From the monorepo root
pnpm dev --filter @radiant/dojo

# Or directly
cd apps/dojo && pnpm dev
```

The app runs on **http://localhost:3004**.

---

---

## 8. Database Schema

The Dojo uses **19 RLS-protected tables** (migration `V2026_02_06_005`):

| Table | Purpose |
|-------|---------|
| `dojo_libraries` | Document library containers |
| `dojo_documents` | Uploaded files with S3 keys |
| `dojo_themes` | AI-discovered Central Themes |
| `dojo_sessions` | Training sessions |
| `dojo_lesson_blocks` | Generated lessons with citations |
| `dojo_sparring_questions` | Adversarial questions |
| `dojo_sparring_results` | Answer results with XP |
| `dojo_user_progress` | Overall rank & XP |
| `dojo_theme_progress` | Per-theme mastery |
| `dojo_certifications` | Exam results |
| `dojo_mobot_messages` | Knowledge Agent chat |
| `dojo_knowledge_atoms` | Decay engine concepts |
| `dojo_decay_curves` | Per-atom decay tracking |
| `dojo_scenario_sessions` | Scenario instances |
| `dojo_scenario_branches` | Branching trees |
| `dojo_competencies` | Competency graph |
| `dojo_user_competency_scores` | Proficiency scores |
| `dojo_dialectic_sessions` | Dialectic sessions |
| `dojo_dialectic_turns` | Debate turns |
| `dojo_multimodal_content` | Audio/diagrams/glossary |
| `dojo_knowledge_pulse` | Org health snapshots |
| `dojo_archytas_tool_calls` | Tool execution log |
| `dojo_config` | Per-tenant configuration |

---

**Document maintained under RADIANT documentation policy.**



---

*Consolidated from 1 source documents (0 not found). 325 source lines.*
