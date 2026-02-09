# Think Tank — Complete Reference

**User Guide • Admin Guide • Tenant Administration • Mac Platform • Licensing**

*RADIANT v6.6.0 — Generated February 07, 2026*

---

## Table of Contents

- **Part I: User Guide**
- **Part II: Admin Guide**
- **Part III: Tenant Administration**
- **Part IV: Mac Platform**
- **Part V: Licensing Model**
- **Part VI: Delight UX System**
- **Part VII: UI & Experience**
- **Part VIII: Collaboration**

---


---

## Part I: User Guide

> **Version**: 7.9.0  
> **Last Updated**: February 5, 2026  
> **Audience**: End Users of Think Tank

---

## Table of Contents

1. [Welcome to Think Tank](#1-welcome-to-think-tank)
2. [Getting Started](#2-getting-started)
3. [The Dashboard](#3-the-dashboard)
4. [Conversations](#4-conversations)
5. [My Rules - Personalizing AI Responses](#5-my-rules---personalizing-ai-responses)
6. [Domain Modes](#6-domain-modes)
7. [Delight System - AI Personality](#7-delight-system---ai-personality)
8. [Collaboration Features](#8-collaboration-features)
9. [Advanced Features](#9-advanced-features)
10. [AXIOM Forge - Prompt Optimization](#10-axiom-forge---prompt-optimization)
11. [How Think Tank's Memory Works](#11-how-think-tanks-memory-works)
12. [Understanding AI Decisions](#12-understanding-ai-decisions)
12. [Decision Records](#12-decision-records)
13. [Living Parchment](#13-living-parchment)
14. [Safety & Governance](#14-safety--governance)
15. [LIVS-M Policy Modes - AI Quality Control](#15-livs-m-policy-modes---ai-quality-control)
16. [Time Machine - Conversation Forking](#16-time-machine---conversation-forking)
16. [The Grimoire - Procedural Memory](#16-the-grimoire---procedural-memory)
17. [Flash Facts - Quick Knowledge Capture](#17-flash-facts---quick-knowledge-capture)
18. [Sentinel Agents - Background Monitors](#18-sentinel-agents---background-monitors)
19. [Economic Governor - Cost Management](#19-economic-governor---cost-management)
20. [Council of Rivals - Multi-Model Deliberation](#20-council-of-rivals---multi-model-deliberation)
21. [Voice Input & File Attachments](#21-voice-input--file-attachments)
22. [Keyboard Shortcuts](#22-keyboard-shortcuts)
23. [Troubleshooting](#23-troubleshooting)
24. [Glossary](#24-glossary)

---

## 1. Welcome to Think Tank

Think Tank is an advanced AI assistant platform that adapts to your needs, learns your preferences, and provides intelligent responses across a wide range of domains. Unlike simple chatbots, Think Tank:

- **Adapts to Your Expertise** - Automatically detects your knowledge domain and adjusts responses
- **Remembers Your Preferences** - Your rules and settings persist across conversations
- **Shows Its Thinking** - Transparent about its reasoning and confidence levels
- **Keeps You Safe** - Built-in safety guardrails protect against harmful outputs
- **Collaborates** - Work together with colleagues in real-time sessions

### What Makes Think Tank Different

| Traditional Chatbots | Think Tank |
|---------------------|------------|
| One-size-fits-all responses | Adapts to your domain expertise |
| Forgets your preferences | Persistent user rules and context |
| Black-box decisions | Transparent reasoning with Brain Plans |
| Single interaction mode | Multiple view modes (Sniper, Scout, Sage) |
| No safety guarantees | Five-layer safety architecture |

### How Think Tank Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                         YOUR QUESTION                                │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  🧠 BRAIN PLANNER                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Domain       │  │ Your Rules   │  │ Context      │              │
│  │ Detection    │  │ Applied      │  │ Analysis     │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  🎯 MODEL SELECTION & ROUTING                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │  Sniper    │  │   Scout    │  │   Sage     │  │  War Room  │   │
│  │   🎯       │  │    🔍      │  │    📚      │  │    ⚔️      │   │
│  │  Fast &    │  │ Research   │  │ Analysis   │  │ Multi-Agent│   │
│  │  Cheap     │  │ & Explore  │  │ & Compare  │  │  Debate    │   │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  🛡️ SAFETY VALIDATION (Cato)                                        │
│  ✓ Content safety  ✓ Governance check  ✓ Cost approval             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         YOUR ANSWER                                  │
│  + Confidence indicator  + Sources  + Suggestions                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Getting Started

### First Time Setup

1. **Log In** - Access Think Tank through your organization's portal
2. **Set Your Preferences** - Visit Settings to configure your experience
3. **Create Rules** - Add personal rules to customize AI responses
4. **Start a Conversation** - Type your first message or use voice input

### Authentication & Security

Think Tank supports multiple authentication methods for secure access:

- **Email/Password** - Traditional sign-in with optional MFA
- **Social Sign-In** - Google, Microsoft, Apple, GitHub
- **Enterprise SSO** - SAML 2.0 / OIDC via your organization
- **Passkeys** - Passwordless authentication using biometrics

**Multi-Factor Authentication (MFA)** may be required by your organization. When enabled, you'll need an authenticator app (Google Authenticator, Authy, etc.) to generate verification codes.

> 📖 **Detailed Guides**: See [Authentication User Guide](./authentication/user-guide.md) and [MFA Guide](./authentication/mfa-guide.md)

### Language Settings

Think Tank supports **18 languages** including:

| Western | Asian | RTL |
|---------|-------|-----|
| English, Spanish, French, German, Portuguese, Italian, Dutch, Polish, Russian, Turkish | Japanese, Korean, Chinese (Simplified/Traditional), Hindi, Thai, Vietnamese | Arabic |

**To change your language:**
1. Click your profile icon → **Settings**
2. Select **Language & Region**
3. Choose your preferred language
4. The interface updates immediately

Search works in all languages, with special **CJK (Chinese/Japanese/Korean) bi-gram search** for accurate results.

> 📖 **Detailed Guide**: See [Internationalization Guide](./authentication/i18n-guide.md)

### The Main Interface

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]  Think Tank                    [User] ▼  [Settings] │
├─────────────┬───────────────────────────────────────────────┤
│             │                                               │
│  SIDEBAR    │              MAIN CONTENT AREA                │
│             │                                               │
│  Dashboard  │   Your conversations and AI responses         │
│  Users      │   appear here                                 │
│  Messages   │                                               │
│  My Rules   │                                               │
│  Delight    │                                               │
│  ...        │                                               │
│             │                                               │
├─────────────┴───────────────────────────────────────────────┤
│  [Message input...]                              [Send] 🎤   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. The Dashboard

The Dashboard provides an overview of your Think Tank activity.

### Key Metrics

| Metric | Description |
|--------|-------------|
| **Active Users** | How many people in your organization are using Think Tank |
| **Conversations** | Total number of conversations you've had |
| **User Rules** | How many personal rules you've created |
| **API Requests** | Volume of AI requests (for awareness) |

### Quick Actions

From the dashboard, you can quickly:

- **Manage Users** - View and manage team members (if you have permissions)
- **Configure Delight** - Customize the AI's personality
- **Domain Modes** - Adjust how Think Tank handles different topics

### Your Profile

Access your profile by clicking your avatar in the top-right corner. Your profile includes:

#### Activity Heatmap

A GitHub-style visualization of your conversation activity over the past year:

| Feature | Description |
|---------|-------------|
| **Breathing Animation** | Cells pulse based on activity intensity - more active days "breathe" faster |
| **AI Insights** | Automatic pattern detection with natural language explanations |
| **Streak Tracking** | Current and longest streaks highlighted with 🔥 badges |
| **Sound Feedback** | Optional audio cues when hovering over active days |
| **Accessibility Mode** | Full narrative summary for screen readers |

**AI Insights Examples:**
- "You're a weekday warrior! Most activity happens Monday-Friday" (92% confidence)
- "Amazing! Your longest streak is 14 days. That's dedication! 🔥"
- "Activity has slowed recently. A quick session could reignite momentum!"

**Color Legend:**
- Empty (dark) → No activity
- Light purple → Low activity
- Bright purple → High activity
- Dashed border → Predicted future activity

#### Profile Stats

| Stat | Description |
|------|-------------|
| **Conversations** | Total conversations you've had |
| **Tokens Used** | AI tokens consumed (for awareness) |
| **Messages** | Total messages exchanged |
| **Achievements** | Unlocked gamification badges |

---

## 4. Conversations

### Starting a New Conversation

1. Type your message in the input field at the bottom
2. Press **Enter** or click **Send**
3. Wait for the AI response (a typing indicator shows Think Tank is working)

### Understanding Responses

Think Tank responses may include:

- **Main Answer** - The AI's response to your question
- **Confidence Indicator** - How certain the AI is about its answer
- **Sources** - References or citations when available
- **Suggestions** - Related questions you might want to ask

### Conversation Actions

| Action | How To |
|--------|--------|
| Share conversation | Click the share icon to create a shareable link |
| Export | Download conversation as text or markdown |
| Delete | Remove a conversation from your history |
| Branch | Create an alternative thread from any point |

### Conversation Search

Use the search bar to find past conversations by:
- Keywords in messages
- Date range
- Conversation status (active, archived)

---

## 5. My Rules - Personalizing AI Responses

My Rules lets you set **persistent preferences** for how Think Tank responds to you. These rules are applied to every conversation.

### Creating a Custom Rule

```
┌─────────────────────────────────────────────────────────────────────┐
│  ➕ ADD CUSTOM RULE                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Rule Summary *                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Prefer concise bullet points                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Rule Text *                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ When responding, use bullet points instead of long          │   │
│  │ paragraphs. Keep responses under 200 words unless I         │   │
│  │ specifically ask for more detail.                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Rule Type                                                           │
│  ┌─────────────────────────────────────┐                            │
│  │ 📋 Format                       ▼   │                            │
│  └─────────────────────────────────────┘                            │
│                                                                      │
│                              [ Cancel ]  [ Create Rule ]             │
└─────────────────────────────────────────────────────────────────────┘
```

1. Navigate to **My Rules** from the sidebar
2. Click **Add Custom Rule**
3. Fill in:
   - **Rule Summary** - Brief name (e.g., "Prefer concise answers")
   - **Rule Text** - Detailed instruction for the AI
   - **Rule Type** - Category of the rule
4. Click **Create Rule**

### Rule Types

| Type | Use For | Example |
|------|---------|---------|
| **Preference** | General response style | "I prefer bullet points over paragraphs" |
| **Restriction** | Things to avoid | "Never use jargon without explaining it" |
| **Format** | Response structure | "Always include a summary at the end" |
| **Sources** | Citation preferences | "Cite academic sources when available" |
| **Tone** | Communication style | "Use a professional but friendly tone" |
| **Topic** | Subject-specific rules | "For medical topics, always recommend consulting a doctor" |
| **Privacy** | Data handling | "Don't reference my previous conversations" |

### Using Preset Rules

Think Tank provides pre-made rules you can add with one click:

1. Go to **My Rules** → **Add from Presets**
2. Browse categories (e.g., "Response Style", "Privacy", "Formatting")
3. Click **Add** next to any rule you want
4. Rules marked **Popular** are used by many users

### Managing Rules

- **Toggle On/Off** - Temporarily disable a rule without deleting it
- **Times Applied** - See how often each rule has been used
- **Delete** - Remove a rule permanently

### Best Practices

- Start with 3-5 core rules
- Be specific in your rule text
- Review rules periodically - remove ones that don't help
- Use preset rules as starting points, then customize

---

## 6. Domain Modes

Think Tank automatically detects what domain your question relates to and adjusts its behavior accordingly.

### Available Domains

| Domain | Icon | Optimized For |
|--------|------|---------------|
| **General** | 💡 | Everyday questions and tasks |
| **Medical** | 🩺 | Healthcare and medical topics (with appropriate disclaimers) |
| **Legal** | ⚖️ | Legal research and analysis |
| **Code** | 💻 | Programming and development |
| **Academic** | 🎓 | Research and educational content |
| **Creative** | ✏️ | Writing, content creation, brainstorming |
| **Scientific** | 🧪 | Scientific research and analysis |

### How Domain Detection Works

```
┌─────────────────────────────────────────────────────────────────────┐
│  "What are the side effects of ibuprofen?"                          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  🔍 DOMAIN DETECTION                                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Keywords: "side effects", "ibuprofen"  →  MEDICAL 🩺        │   │
│  │ Intent: Information seeking                                   │   │
│  │ Confidence: 94%                                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ⚙️ AUTOMATIC ADJUSTMENTS                                           │
│                                                                      │
│  Model:       Claude Sonnet (high accuracy for medical)             │
│  Temperature: 0.3 (factual, precise)                                │
│  Style:       Include disclaimers, cite sources                     │
│  Guardrails:  Add "consult healthcare provider" notice              │
└─────────────────────────────────────────────────────────────────────┘
```

1. You submit a question
2. Think Tank analyzes keywords, context, and intent
3. The appropriate domain mode is automatically selected
4. The AI adjusts its:
   - **Model selection** - Best AI model for that domain
   - **Temperature** - Creativity vs. precision balance
   - **Response style** - Technical depth, tone, formatting

### Domain Indicators

You'll see a small badge indicating the detected domain:

```
[Medical 🩺] Analyzing your health question...
```

### Overriding Domain Detection

If Think Tank picks the wrong domain:
1. Click the domain badge
2. Select the correct domain
3. Your choice is remembered for similar questions

### Domain Selector (Advanced Mode) - v6.0.0

In **Advanced Mode**, you can manually select your domain expertise for optimized responses:

1. Enable **Advanced Mode** in the chat header
2. Click the **Domain** selector (shows "Auto" by default)
3. Search for or select your domain:
   - **Healthcare** - Medical, clinical, pharmaceutical
   - **Legal** - Law, contracts, regulations
   - **Finance** - Investment, banking, markets
   - **Technology** - Software, hardware, AI/ML
   - **Education** - Teaching, curriculum, learning
   - **Science** - Research, experiments, discovery
4. Your selection is saved and used for future sessions

### Cartridge Indicator (Advanced Mode) - v6.0.0

In **Advanced Mode**, you can see which **Knowledge Cartridges** are active:

1. Look for the cartridge icon in the header (shows count like "2 Cartridges")
2. Click to expand and see:
   - **System cartridges** - Platform-wide knowledge (e.g., RADIANT Core)
   - **Organization cartridges** - Tenant-specific knowledge
   - **Personal cartridges** - Your custom knowledge bundles
3. Each cartridge shows version and priority level

Cartridges provide specialized domain knowledge that enhances AI responses in specific areas.

---

## 7. Delight System - AI Personality

The Delight System controls Think Tank's personality, making interactions more engaging and human-like.

### Personality Modes

| Mode | Description | Best For |
|------|-------------|----------|
| **Auto** (Recommended) | Adapts based on context | Most users |
| **Professional** | Formal and direct | Business use |
| **Friendly** | Warm and approachable | Casual conversations |
| **Playful** | Fun and expressive | Creative work |
| **Minimal** | Just the facts | Quick lookups |

### Personality Elements

Think Tank's personality includes:

#### Messages
Contextual messages that appear during interactions:
- **Pre-execution** - "Let me think about that..."
- **During execution** - "Analyzing your data..."
- **Post-execution** - "Here's what I found!"

#### Achievements
Unlock achievements as you use Think Tank:
- 🏆 **First Conversation** - Start your journey
- 🏆 **Power User** - 100 conversations
- 🏆 **Rule Master** - Create 10 custom rules
- 🏆 **Domain Expert** - Use 5 different domains

Achievement rarities: Common, Uncommon, Rare, Epic, Legendary

#### Easter Eggs
Hidden surprises triggered by special phrases or patterns. Discover them yourself! (Hint: Try asking about the meaning of life...)

#### Sounds (Optional)
Audio feedback for actions (can be disabled in Settings):
- Notification sounds
- Achievement unlocks
- Transition effects

### Adjusting Personality

1. Go to **Settings** → **Personality**
2. Select your preferred mode
3. Changes apply immediately

---

## 8. Collaboration Features

### Real-Time Collaboration

Work together with colleagues on the same conversation.

#### Starting a Collaborative Session

1. Navigate to **Collaborate** from the sidebar
2. Click **Create Session** or join an existing one
3. Share the session link with colleagues
4. Everyone sees messages in real-time

#### Enhanced Collaboration Features

The enhanced collaboration mode includes:

| Feature | Description |
|---------|-------------|
| **Chat** | Real-time messaging with all participants |
| **Branches** | Create alternative discussion threads |
| **AI Roundtable** | Multiple AI perspectives on a topic |
| **Knowledge Graph** | Visual map of discussed concepts |
| **Playback** | Review the conversation timeline |

#### AI Facilitator

Enable the AI Facilitator to:
- Summarize long discussions
- Suggest next topics
- Identify areas of agreement/disagreement
- Keep the conversation productive

#### Participant Roles

- **Owner** - Full control, can delete session
- **Participant** - Can send messages and interact
- **Guest** - View-only access (via guest link)

### Sharing Conversations

Share a conversation without real-time collaboration:

1. Open any conversation
2. Click the **Share** button
3. Choose sharing options:
   - **Public link** - Anyone with link can view
   - **Copy allowed** - Viewers can copy content
4. Click **Create Share Link**
5. Copy and send the link

---

## 9. Advanced Features

### Polymorphic UI - Adaptive Views

Think Tank's interface automatically adapts based on your query type.

#### View Types

```
┌─────────────────────────────────────────────────────────────────────┐
│  POLYMORPHIC VIEW SELECTION                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🎯 SNIPER          🔍 SCOUT           📚 SAGE           ⚔️ WAR ROOM │
│  ┌─────────┐       ┌─────────┐       ┌─────────┐       ┌─────────┐ │
│  │ >_      │       │    ●    │       │ ≡≡≡≡≡≡≡ │       │ 🤖 🤖   │ │
│  │ Quick   │       │   /│\   │       │ ≡≡≡≡≡≡≡ │       │ 🤖   🤖 │ │
│  │ command │       │  / │ \  │       │ ≡≡≡≡≡≡≡ │       │  debate │ │
│  └─────────┘       └─────────┘       └─────────┘       └─────────┘ │
│   ~$0.01/run        ~$0.05/run        ~$0.10/run        ~$0.50/run  │
│   Fast lookup       Research          Compare           Multi-agent │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

| View | When It Appears | Best For |
|------|-----------------|----------|
| **Sniper** (Terminal) | Quick commands, lookups | Fast answers, low cost |
| **Scout** (Mind Map) | Research, exploration | Complex research |
| **Sage** (Diff Editor) | Validation, comparison | Reviewing changes |
| **Dashboard** | Data queries | Analytics |
| **Decision Cards** | Choices needed | Human approval required |
| **Chat** | General conversation | Default view |

#### Cost Indicators

Different views have different costs (reflected in credits used):
- 🟢 **Sniper Mode** - ~$0.01/run (fast, single model)
- 🟣 **War Room Mode** - ~$0.50+/run (multi-agent, thorough)

The Economic Governor automatically routes your query to the most cost-effective mode that can handle it.

#### Manual Escalation

If Sniper mode isn't giving good results:
1. Click **Escalate to War Room**
2. The AI will use more models and deeper analysis
3. Results are more thorough but take longer

### The Grimoire - AI Learning

The Grimoire is Think Tank's procedural memory - rules it has learned from successful interactions.

#### What You'll See

- **Heuristics** - Learned rules like "When asked about X, always consider Y"
- **Confidence Scores** - How sure the AI is about each rule
- **Domain Tags** - Which domains the rule applies to

#### Reinforcing Learning

You can help the AI learn:
- 👍 **Thumbs Up** - Increases confidence in a heuristic
- 👎 **Thumbs Down** - Decreases confidence
- This feedback improves future responses

### Magic Carpet Navigator

An advanced navigation system with intent-based routing.

#### Opening the Navigator

Press **⌘K** (Mac) or **Ctrl+K** (Windows) to open the destination selector.

#### Destinations

| Destination | Icon | Purpose |
|-------------|------|---------|
| Command Center | 🏠 | Overview dashboard |
| Workshop | 🔨 | Build and create |
| Time Stream | ⏳ | Reality Scrubber (history) |
| Quantum Realm | 🌌 | Parallel realities (branches) |
| Oracle's Chamber | 🔮 | Pre-Cognition (predictions) |
| Gallery | 🖼️ | View creations |
| Vault | 🔐 | Saved items |

#### Journey Breadcrumbs

The navigator shows your path through the application, making it easy to retrace steps.

### Artifacts - Generated Code

When Think Tank generates code or components, they appear as Artifacts.

#### Artifact Features

- **Live Preview** - See generated UI components
- **Code View** - Inspect the source code
- **Validation** - Safety checks ensure code is secure
- **Reflexion** - If generation fails, AI retries with improvements

#### Safety Validation

All generated code passes through Cato safety validation:
- ✅ No dangerous operations
- ✅ Only allowed dependencies
- ✅ Follows security best practices

### Liquid Interface - Chat Morphs Into Tools (v5.52.8)

In **Advanced Mode**, the chat interface can transform ("morph") into specialized tools when you need them. This is called the Liquid Interface - "Don't Build the Tool. BE the Tool."

#### Enabling Advanced Mode

1. Toggle **Advanced Mode** in the header (lightning bolt icon)
2. Tool trigger buttons appear in the toolbar
3. Click any tool icon to morph the chat into that tool

#### Available Tools

| Tool | Icon | What It Does |
|------|------|--------------|
| **Data Grid** | 📊 | Interactive spreadsheet for data manipulation |
| **Chart** | 📈 | Visualize data as bar, line, pie, or area charts |
| **Kanban** | 📋 | Task board with multiple frameworks (see below) |
| **Calculator** | 🔢 | Full calculator with memory and operations |
| **Code Editor** | 💻 | Write and run code with output panel |
| **Document** | 📄 | Rich text editor for writing |

#### Kanban Board Variants

The Kanban tool supports 5 different productivity frameworks:

| Variant | Best For | Key Features |
|---------|----------|--------------|
| **Standard** | General task tracking | Traditional columns, drag-and-drop |
| **Scrumban** | Agile teams | Sprint goals, velocity, story points |
| **Enterprise** | Portfolio management | Multi-lane boards (Strategic/Ops/Support) |
| **Personal** | Individual productivity | Simple 3-column, WIP limit of 3 |
| **Pomodoro** | Focus sessions | Built-in 25-min timer, break tracking |

**Using Pomodoro Kanban:**
1. Select "Pomodoro Kanban" from the variant dropdown
2. Add tasks with estimated pomodoros (🍅)
3. Click **Start** on a task to begin a 25-minute focus session
4. Timer shows in header - take a 5-minute break when it ends
5. Track completed pomodoros per task

**Analytics Panel:**
Click **Analytics** to see:
- Total tasks and completed count
- Average cycle time (how long tasks take)
- Throughput (tasks completed per week)

#### Returning to Chat

Click the **X** button in the tool header to close the morphed view and return to chat.

---

## 10. AXIOM Forge - Prompt Optimization

**AXIOM Forge** is an intelligent prompt optimization system that transforms your questions into highly effective prompts that get better AI responses.

### Why Use AXIOM Forge?

| Without AXIOM | With AXIOM |
|---------------|------------|
| Generic responses | Domain-optimized responses |
| AI guesses your intent | AI knows exactly what you need |
| One-size-fits-all prompts | Tailored to the best model for your task |
| Lower quality results | Consistently better outcomes |

### How It Works

When you enable AXIOM Forge, it guides you through a quick 4-step workflow:

```
┌─────────────────────────────────────────────────────────────────────┐
│  AXIOM FORGE WORKFLOW                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1️⃣ CLASSIFY      2️⃣ CLARIFY      3️⃣ COMPILE      4️⃣ ROUTE         │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐       │
│  │  🎯     │ ──▶ │  ❓     │ ──▶ │  ⚡     │ ──▶ │  🤖     │       │
│  │ Domain  │     │Questions│     │ Build   │     │ Select  │       │
│  │ Detect  │     │ 1-5 max │     │ Prompt  │     │ Model   │       │
│  └─────────┘     └─────────┘     └─────────┘     └─────────┘       │
│                                                                      │
│  Detects your    Asks only the   Compiles an     Picks the best    │
│  expertise area  questions that  optimized       AI model for      │
│  automatically   really matter   prompt          your task         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### The CLARION Questions

AXIOM uses **CLARION** (Context-aware Learning Adaptive Reasoning Interrogation ONtology) to ask you smart clarifying questions:

- **Maximum 5 questions** - We respect your time
- **Skip anytime** - Press Skip if a question does not apply
- **Smart ordering** - Questions adapt based on your answers
- **Model signals** - Your answers help select the best AI model

#### Question Types

| Type | Example |
|------|---------|
| **Choice** | "What type of task is this?" (select one) |
| **Multi-select** | "Which aspects matter most?" (select several) |
| **Text** | "Describe your specific requirements" |
| **Scale** | "How complex is this? (1-5)" |
| **Yes/No** | "Does this need code examples?" |

### Model Score Bars

As you answer questions, you will see **Model Score Bars** showing which AI models are best suited for your task:

```
┌─────────────────────────────────────────────────────────────────────┐
│  MODEL PREDICTIONS                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  👑 Claude Sonnet 4      ████████████████████████░░░░  87%          │
│     anthropic            Strong in analysis, reasoning               │
│                                                                      │
│     GPT-4 Turbo          ████████████████████░░░░░░░░  72%          │
│     openai               Good general purpose                        │
│                                                                      │
│     Gemini 2.0           ███████████████░░░░░░░░░░░░░  58%          │
│     google               Multimodal capability                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

The leading model (👑) is updated in real-time as you provide more context.

### Compiled Prompt Preview

After answering questions, AXIOM compiles your optimized prompt:

- **System Prompt** - Instructions tailored to your domain and task
- **User Prompt** - Your question enhanced with context
- **Edit option** - Make final tweaks before sending
- **Token count** - See how long your prompt is

### When to Use AXIOM Forge

| Good For | Not Needed For |
|----------|----------------|
| Complex analysis tasks | Quick factual lookups |
| Domain-specific work (legal, medical, code) | Simple questions |
| When you want the best results | Casual conversations |
| Important deliverables | Follow-up questions |

### Enabling AXIOM Forge

1. Start typing your message
2. Click the **⚡ Optimize** button (or press `Ctrl+Shift+O`)
3. Answer the clarifying questions
4. Review and send your optimized prompt

> 💡 **Tip**: You can skip AXIOM optimization anytime by clicking "Skip optimization" - your message will be sent normally.

### CLARION Settings

Customize your AXIOM experience in **Settings → CLARION Preferences**:

| Setting | Description | Default |
|---------|-------------|---------|
| **Clarification Mode** | When to ask questions (Auto/Always/Never) | Auto |
| **Max Questions** | Maximum questions per session (3-7) | 5 |
| **Show Model Scores** | Display real-time model predictions | On |
| **Show Confidence Meter** | Display optimization progress | On |
| **Animations** | Enable smooth transitions | On |
| **Remember Answers** | Store answers for similar questions | On |
| **Learn Preferences** | Adapt questions based on patterns | On |

### Accessibility Features

AXIOM Forge is fully accessible:

- **Keyboard Navigation**: Use arrow keys to navigate options, Enter to select
- **Screen Reader Support**: All questions and score updates are announced
- **Focus Management**: Auto-focus on new questions
- **High Contrast**: Visible selection states and progress indicators

### Mobile Features

On mobile devices:

- **Swipe to Skip**: Swipe right on a question card to skip it
- **Touch-Optimized**: Large tap targets for all interactive elements
- **Responsive Layout**: Full-screen experience on smaller screens

### Feedback

After using AXIOM Forge, you can provide feedback:

- **Quick Feedback**: Thumbs up/down for domain accuracy, questions, prompts, and model selection
- **Detailed Feedback**: Rate your overall experience (1-5 stars) and leave comments
- **Continuous Improvement**: Your feedback helps AXIOM learn and improve

---

## 11. How Think Tank's Memory Works

Think Tank uses two interconnected systems to remember things and access knowledge.

### Cato - The AI's Personality & Memory

**Cato** is the AI's "self" - its personality, emotional state, and personal memory of you.

| What Cato Remembers | Example |
|---------------------|---------|
| **Your Preferences** | "This user prefers detailed explanations" |
| **Past Conversations** | Topics you've discussed, corrections you've made |
| **Current Mood** | Confidence level, engagement, curiosity |
| **Communication Style** | Formal vs casual, concise vs detailed |

**How it helps you**: The AI adapts its responses based on what it knows about you. If you've told it you prefer bullet points, it remembers. If you corrected it before, it learns.

### Cortex - The Enterprise Knowledge Library

**Cortex** is your organization's knowledge graph - facts, documents, and relationships extracted from enterprise data.

| Knowledge Tier | What's There | Speed |
|----------------|--------------|-------|
| **Hot** | Current session context | Instant |
| **Warm** | Knowledge graph, verified facts | Fast |
| **Cold** | Archives, compliance data | Slower |

**How it helps you**: When you ask a question, the AI can pull relevant facts from your organization's knowledge base - not just generic internet knowledge.

### How They Work Together

```
┌─────────────────────────────────────────────────────────────────────┐
│  YOUR MESSAGE: "What's the status of Project Alpha?"                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CATO checks:                                                        │
│  • Your role (Project Manager)                                       │
│  • Your preferences (prefers executive summaries)                    │
│  • Your mood context (busy, needs quick answers)                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CORTEX retrieves:                                                   │
│  • Project Alpha timeline (from knowledge graph)                     │
│  • Recent status updates (from documents)                            │
│  • Related milestones (from relationships)                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AI RESPONSE:                                                        │
│  Personalized (knows you want summaries)                            │
│  + Informed (has actual project data)                                │
│  + Contextual (understands your role)                                │
└─────────────────────────────────────────────────────────────────────┘
```

### What This Means for You

| Without Memory Integration | With Memory Integration |
|---------------------------|------------------------|
| AI gives generic answers | AI gives personalized + informed answers |
| You re-explain context every time | AI remembers your preferences |
| No access to company data | Enterprise facts in every response |
| Each session starts fresh | Learning persists across sessions |

### Privacy Note

- **Personal memories** (Cato) are tied to your user account
- **Enterprise knowledge** (Cortex) follows your organization's access controls
- You can ask "What do you remember about me?" to see stored context
- Admins can configure retention periods and what gets remembered

---

## 11. Understanding AI Decisions

Think Tank is designed to be transparent about how it makes decisions.

### Brain Plans

When Think Tank processes your request, it creates a Brain Plan showing:

```
┌─────────────────────────────────────────────────────────────────────┐
│  📋 BRAIN PLAN                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Orchestration:  research                                           │
│  Domain:         Scientific 🧪                                       │
│  Confidence:     87%                                                │
│                                                                      │
│  ┌─ EXECUTION STEPS ─────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  Step 1: Analyze query context                    [✓ Done]    │  │
│  │  Step 2: Select relevant models                   [✓ Done]    │  │
│  │  Step 3: Gather information                       [● Running] │  │
│  │  Step 4: Synthesize response                      [○ Pending] │  │
│  │  Step 5: Validate and format                      [○ Pending] │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Model:     Claude Sonnet 4.0                                       │
│  Est. Cost: $0.03                                                   │
│  Est. Time: ~8 seconds                                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

1. **Orchestration Mode** - How the AI will approach your question
   - `thinking` - Standard reasoning
   - `extended_thinking` - Deep multi-step analysis
   - `coding` - Code generation
   - `creative` - Creative writing
   - `research` - Research synthesis
   - `multi_model` - Multiple AI perspectives

2. **Domain Detection** - The identified knowledge area
3. **Model Selection** - Which AI model will be used and why
4. **Steps** - The planned execution steps
5. **Cost Estimate** - Expected credits to be used

### Confidence Levels

Think Tank indicates how confident it is in responses:

| Indicator | Meaning |
|-----------|---------|
| 🟢 High Confidence | AI is very sure about this answer |
| 🟡 Medium Confidence | Reasonably sure, but verify important details |
| 🔴 Low Confidence | Uncertain - treat as a starting point |

### When Think Tank Asks for Clarification

If the AI is uncertain about your intent, it will ask clarifying questions rather than guess. This is intentional - it's better to ask than give a wrong answer.

### Epistemic Humility

Think Tank acknowledges when it doesn't know something:
- "I'm not certain, but..."
- "Based on my training data (which may be outdated)..."
- "I don't have enough information to answer this definitively"

---

## 14. Safety & Governance

Think Tank includes multiple safety layers to protect you and ensure responsible AI use.

### Five-Layer Safety Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│  L4  COGNITIVE LAYER                                                │
│      🧠 Active Inference • Precision Governor • Planning            │
├─────────────────────────────────────────────────────────────────────┤
│  L3  CONTROL LAYER                                         ⚠️ ALWAYS │
│      🛡️ Control Barrier Functions • CANNOT be bypassed     ENFORCED │
├─────────────────────────────────────────────────────────────────────┤
│  L2  PERCEPTION LAYER                                               │
│      👁️ Uncertainty Detection • Fracture Prevention                 │
├─────────────────────────────────────────────────────────────────────┤
│  L1  SENSORY LAYER                                                  │
│      🚨 Immediate Veto • Dangerous Request Blocking                 │
├─────────────────────────────────────────────────────────────────────┤
│  L0  RECOVERY LAYER                                                 │
│      🔄 Safe State Return • Error Recovery                          │
└─────────────────────────────────────────────────────────────────────┘
```

| Layer | Name | What It Does |
|-------|------|--------------|
| L4 | Cognitive | Active inference, precision control |
| L3 | Control | Barrier functions - always enforced |
| L2 | Perception | Uncertainty detection, fracture prevention |
| L1 | Sensory | Immediate veto for dangerous requests |
| L0 | Recovery | Returns to safe state if issues occur |

### Governance Presets

Your organization may use different governance levels:

| Preset | Icon | Behavior |
|--------|------|----------|
| **Paranoid** | 🛡️ | Every action requires approval |
| **Balanced** | ⚖️ | Auto-approve low-risk, checkpoint medium/high |
| **Cowboy** | 🚀 | Full autonomy with notifications |

You'll see a governance badge indicating the current level.

### Human-in-the-Loop (HITL)

For high-stakes decisions, Think Tank may pause and ask for your approval:

```
┌─────────────────────────────────────────────┐
│  🚨 Approval Required                       │
│                                             │
│  This action will modify your database.     │
│  Cost: $2.50 estimated                      │
│                                             │
│  [Approve]  [Modify]  [Reject]              │
└─────────────────────────────────────────────┘
```

### What Think Tank Will Never Do

These are hardcoded safety limits that cannot be changed:
- ❌ Generate harmful content
- ❌ Execute destructive actions without confirmation
- ❌ Bypass safety barriers
- ❌ Delete audit logs
- ❌ Expose sensitive data

### LIVS-M 2.0 Policy Modes (v7.9.0)

Think Tank includes **LIVS-M 2.0** - a "Defcon-style" governance system that controls how strictly AI outputs are verified. Think of it as a dial that controls the rigor of AI quality checks.

**Access**: Settings → Advanced → LIVS-M Policy

#### The Three Policy Modes

| Mode | Nickname | Best For | Behavior |
|------|----------|----------|----------|
| **Brainstorming** | "Yes, and..." | Hackathons, MVP planning, early drafting | Accepts partial code, stubs, rough ideas. Warnings logged but don't stop work. |
| **Standard** | "Trust but Verify" | Daily development, Sprint work | Code must run. Stubs rejected if breaking. Tests encouraged. **(Default)** |
| **Strict Audit** | "Zero Trust" | Production releases, medical/legal, security | No stubs. No mock data. Mandatory tests. Sycophancy triggers Devil's Advocate. |

#### What Each Mode Does

**🔶 Brainstorming Mode**
- AI accepts "TODO" comments and placeholder code
- Focus on speed and creativity over perfection
- Warnings are logged but don't block responses
- Best when you're exploring ideas, not shipping code

**🔵 Standard Mode** (Default)
- Code must actually work - no broken implementations
- Stubs are rejected if they break functionality
- Tests are encouraged but not mandatory for everything
- Sycophancy detection warns when AI agrees too quickly

**🔴 Strict Audit Mode**
- Zero tolerance for stubs, placeholders, or mock data
- Every output must include appropriate test coverage
- If AI agents agree too quickly, a "Devil's Advocate" challenge is injected
- Maximum verification before any response is approved

#### Visual Indicators

When LIVS-M detects potential issues in AI responses, you'll see:
- ⚠️ **Warning badge** - Minor issue, response continues
- 🛑 **Block indicator** - Response blocked, AI will retry with stricter guidelines
- 😈 **Devil's Advocate** - Consensus was too fast, alternative viewpoint injected
- 📋 **Review flag** - Flagged for human review

#### Common Scenarios

| Scenario | Recommended Mode |
|----------|------------------|
| Brainstorming a new feature | Brainstorming |
| Writing production code | Standard |
| Code review before deploy | Strict Audit |
| Exploring creative ideas | Brainstorming |
| Security-sensitive changes | Strict Audit |
| Day-to-day development | Standard |

#### Understanding What LIVS-M Catches

**The "Watermelon" Problem**: AI agents reporting "Done" when code is full of `pass`, `return True`, or `// TODO` placeholders. LIVS-M detects these patterns and rejects lazy implementations.

**The "Groupthink" Problem**: When Agent A makes a mistake and Agent B just agrees with it. LIVS-M detects suspiciously fast consensus and injects a "Devil's Advocate" challenge.

**The "Hallucination" Problem**: AI importing libraries that don't exist or making up APIs. LIVS-M verifies dependencies against approved lists.

#### How LIVS-M Works Behind the Scenes

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LIVS-M 2.0 VERIFICATION FLOW                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  YOUR QUESTION                                                       │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────┐                                                    │
│  │  AI AGENT   │ ─────────────────────────┐                         │
│  │  (Worker)   │                          │                         │
│  └─────────────┘                          ▼                         │
│                                   ┌───────────────┐                 │
│                                   │  SUPERVISOR   │                 │
│                                   │  (Governance) │                 │
│                                   └───────┬───────┘                 │
│                                           │                         │
│                          ┌────────────────┼────────────────┐        │
│                          ▼                ▼                ▼        │
│                    ┌──────────┐    ┌──────────┐    ┌──────────┐    │
│                    │ APPROVE  │    │  REJECT  │    │INTERVENE │    │
│                    │ (Pass)   │    │ (Retry)  │    │(Devil's  │    │
│                    │          │    │          │    │Advocate) │    │
│                    └──────────┘    └──────────┘    └──────────┘    │
│                          │                │                │        │
│                          ▼                ▼                ▼        │
│                    YOUR ANSWER      AI RETRIES      CHALLENGE       │
│                                     WITH FIX        INJECTED        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Switching Modes

You can switch modes anytime:
1. Click the **⚙️ Settings** icon
2. Go to **Advanced → LIVS-M Policy**
3. Select your preferred mode
4. Changes apply to your next conversation

#### Version Updates (v7.9.0+)

LIVS-M now includes automatic version management. When updates are available:

- **Update Badge**: A green "UPDATE" badge appears on the LIVS-M Policy navigation item
- **Version Display**: Your current version is shown in the header (e.g., "v2.0.0")
- **Updates Tab**: Navigate to the "Updates" tab to see what's new

**Checking for Updates**:
1. Go to **Settings → Advanced → LIVS-M Policy**
2. Click the **Updates** tab
3. If an update is available, you'll see:
   - Current vs. latest version comparison
   - Changelog with new features
   - One-click **Upgrade** button

**Update Alerts**:
- ⚠️ **Breaking Changes**: Review changelog carefully before upgrading
- 🔄 **Migration Required**: Database changes will be handled automatically
- ✅ **Up to Date**: Green checkmark when you're on the latest version

> **Note**: Upgrades are typically seamless, but your administrator may schedule them during maintenance windows for production environments.

#### Pro Tips

- **Friday Deployments**: Switch to Strict Audit mode before any end-of-week releases
- **Creative Sessions**: Use Brainstorming mode when exploring new ideas—you can always tighten later
- **Code Reviews**: Strict Audit mode acts as an automated code quality gate

### Reporting Issues

If Think Tank produces concerning output:
1. Click the **Report** button on the response
2. Select the issue type
3. Add any additional context
4. Submit for review

---

## 12. Decision Records

Decision Records capture the AI's reasoning, evidence, and conclusions in an auditable format. This feature helps you understand and verify AI-assisted decisions.

### Accessing Decision Records

After significant conversations, Think Tank automatically extracts:
- **Claims** - Key conclusions and recommendations
- **Evidence** - Supporting data and sources
- **Dissent** - Alternative viewpoints considered but rejected
- **Compliance** - Regulatory implications if applicable

### The Living Parchment View

Decision Records use a special "Living Parchment" interface where:
- **Breathing colors** indicate trust levels (green = verified, amber = unverified, red = contested)
- **Font weight** reflects confidence (bolder = more confident)
- **Ghost paths** show rejected alternatives as faded traces

### Verifying Claims

Click any claim to see:
1. The evidence supporting it
2. The AI's reasoning chain
3. Any dissenting opinions
4. Data freshness indicators

### Exporting for Compliance

Export decision records in various formats:
- **HIPAA Audit Package** - For healthcare compliance
- **SOC2 Evidence Bundle** - For security audits
- **GDPR DSAR Response** - For data requests

### Exporting Conversations Directly (v5.52.16)

You can export any conversation directly from the sidebar:

1. **Hover** over any conversation in the sidebar
2. **Click** the **⋮** (more options) button that appears
3. **Select** an export format:
   - **Generate Decision Record** - Creates a Decision Intelligence Artifact with claims, evidence, and dissent
   - **Export HIPAA Audit Package** - PHI-redacted export for healthcare compliance
   - **Export SOC2 Evidence** - Audit trail for security compliance
   - **Export GDPR DSAR** - Data subject access request format
   - **Export as PDF** - Standard PDF export

```
┌─────────────────────────────────────────────────────────────────────┐
│  SIDEBAR - Conversation Actions                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  📝 Today                                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 💬 "Drug interaction analysis"              [⋮] [🗑]        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                         │
│                           ▼                                         │
│                    ┌──────────────────────┐                        │
│                    │ 📋 Generate Decision │                        │
│                    │    Record            │                        │
│                    │───────────────────── │                        │
│                    │ 🛡️ Export HIPAA     │                        │
│                    │ 🛡️ Export SOC2      │                        │
│                    │ 🛡️ Export GDPR DSAR │                        │
│                    │───────────────────── │                        │
│                    │ 📄 Export as PDF     │                        │
│                    └──────────────────────┘                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Note**: PHI (Protected Health Information) is automatically redacted in compliance exports by default.

---

## 13. Living Parchment

Living Parchment is Think Tank's advanced decision intelligence suite with sensory UI that communicates trust through visual breathing, living typography, and confidence terrain.

### War Room (Strategic Decision Theater)

For high-stakes decisions, enter the War Room:

1. **Navigate to** Living Parchment → War Room
2. **Create a session** with your decision question
3. **Add AI advisors** - multiple perspectives on your problem
4. **View the Confidence Terrain** - 3D visualization where height = confidence
5. **Explore Decision Paths** - branching options with predicted outcomes
6. **Make your decision** with full documentation

**Understanding the Terrain:**
- 🟢 Green peaks = High confidence areas
- 🟡 Amber slopes = Moderate uncertainty  
- 🔴 Red valleys = Risk zones requiring attention

### Council of Experts

Summon diverse AI perspectives that debate and converge:

1. **Convene a Council** with your question
2. **Watch 8 expert personas** discuss:
   - Pragmatist (practical focus)
   - Ethicist (moral considerations)
   - Innovator (creative solutions)
   - Skeptic (devil's advocate)
   - Synthesizer (finding common ground)
   - Analyst (data-driven insights)
   - Strategist (long-term thinking)
   - Humanist (human impact)
3. **Observe consensus forming** as experts move toward center
4. **Review minority reports** - valid dissenting views preserved

### Debate Arena

Test any idea through adversarial exploration:

1. **Create a debate** with your proposition
2. **Watch AI debaters** argue both sides
3. **Track the Resolution Meter** showing which side is winning
4. **Identify weak points** (breathing red indicators)
5. **Generate Steel-Man** - AI creates the strongest version of the opposing argument

### Understanding Living Parchment UI

| Visual Element | Meaning |
|---------------|---------|
| Fast breathing (12 BPM) | High uncertainty, needs attention |
| Slow breathing (4-6 BPM) | Confident, stable information |
| Bold text | High confidence claim |
| Light text | Lower confidence, verify before acting |
| Faded/gray text | Stale information, may need refresh |
| Ghost overlays | Rejected alternatives (what could have been) |

---

## 14. Safety & Governance

Think Tank includes multiple safety layers to protect you and your organization. See [Section 14: Safety & Governance](#11-safety--governance) in the main guide for details on:
- Five-layer Cato safety architecture
- Control Barrier Functions (CBFs)
- Human-in-the-Loop approvals
- Governance presets

---

## 15. Time Machine - Conversation Forking

Time Machine lets you create branches in your conversation history, explore alternative paths, and replay past states.

### What is Time Machine?

Think of Time Machine as "version control for conversations." Just like developers can branch code, you can branch conversations to explore different directions without losing your original path.

```
┌─────────────────────────────────────────────────────────────────────┐
│  TIME MACHINE - TIMELINE SCRUBBER                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Main Timeline                                                       │
│  ───●───●───●───●───●───●─── Present                                │
│              │                                                       │
│              └──●───●───●─── Fork: "What if we tried React?"        │
│                     │                                                │
│                     └──●───── Fork: "React with TypeScript"          │
│                                                                      │
│  [◀◀] [◀] [▶] [▶▶]  [📍 Checkpoint]  [🔀 Fork Here]               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Creating a Checkpoint

Checkpoints save the conversation state at a specific point:

1. Click the **📍 Checkpoint** button in the Time Machine toolbar
2. Give it a name (e.g., "Before major decision")
3. The checkpoint appears on your timeline

### Forking a Conversation

Create an alternative branch from any checkpoint:

1. Navigate to the checkpoint you want to branch from
2. Click **🔀 Fork Here**
3. Name your fork (e.g., "Alternative approach")
4. Continue the conversation in your new branch

### Timeline Navigation

| Control | Action |
|---------|--------|
| **◀◀** | Jump to start |
| **◀** | Previous checkpoint |
| **▶** | Next checkpoint |
| **▶▶** | Jump to present |
| **Drag playhead** | Scrub through history |

### Replaying Conversations

Replay a conversation to see how it evolved:

1. Select a timeline
2. Click **▶ Replay**
3. Watch messages appear in sequence
4. Pause at any point to create a new fork

### Use Cases

| Scenario | How Time Machine Helps |
|----------|----------------------|
| **Exploring options** | Fork to try different approaches |
| **What-if analysis** | Branch to test alternative scenarios |
| **Decision tracking** | Checkpoint before major decisions |
| **Training** | Replay conversations for learning |

---

## 16. The Grimoire - Procedural Memory

The Grimoire is Think Tank's "spell book" - a collection of learned patterns and procedures that help the AI respond more effectively over time.

### What is the Grimoire?

When Think Tank discovers a successful pattern (like a good way to explain something or solve a problem), it can save it as a "spell" in the Grimoire for future use.

```
┌─────────────────────────────────────────────────────────────────────┐
│  📖 GRIMOIRE - SPELL LIBRARY                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────┐  ┌────────────────────┐                     │
│  │ 💻 CODE            │  │ 📊 DATA            │                     │
│  │ Programming tasks  │  │ Data processing    │                     │
│  │ 12 spells          │  │ 8 spells           │                     │
│  └────────────────────┘  └────────────────────┘                     │
│                                                                      │
│  ┌────────────────────┐  ┌────────────────────┐                     │
│  │ 📝 TEXT            │  │ 🔍 ANALYSIS        │                     │
│  │ Writing & editing  │  │ Research & insight │                     │
│  │ 15 spells          │  │ 6 spells           │                     │
│  └────────────────────┘  └────────────────────┘                     │
│                                                                      │
│  Recent Castings: SQL Optimizer ⭐⭐⭐ | JSON Fixer ⭐⭐⭐⭐⭐        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Spell Schools

| School | Icon | Purpose |
|--------|------|---------|
| **Code** | 💻 | Programming, debugging, and code generation |
| **Data** | 📊 | Data processing, transformation, and queries |
| **Text** | 📝 | Writing, editing, and content creation |
| **Analysis** | 🔍 | Research, insights, and pattern recognition |
| **Design** | 🎨 | UI/UX, visual layouts, and styling |
| **Integration** | 🔗 | API connections, workflows, and pipelines |
| **Automation** | ⚙️ | Repetitive tasks, batch operations |
| **Universal** | 🌐 | General-purpose, cross-domain spells |

### Spell Categories

- **Prompt Optimization** - Better ways to ask questions
- **Error Recovery** - Fixing common mistakes
- **Context Management** - Handling conversation state
- **Output Formatting** - Structuring responses

### Power Levels

Spells have power levels (⭐ to ⭐⭐⭐⭐⭐) based on:
- Success rate
- Times used
- Tokens saved
- User ratings

### Promoting Patterns to Spells

If you notice the AI doing something well repeatedly:

1. Rate the response with 👍
2. Add feedback: "This pattern is really helpful"
3. The system may promote it to a spell
4. Future conversations benefit from this pattern

---

## 17. Flash Facts - Quick Knowledge Capture

Flash Facts lets you quickly save important information for the AI to remember.

### What are Flash Facts?

Flash Facts are bite-sized pieces of knowledge you want Think Tank to always remember about you, your work, or your preferences.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚡ FLASH FACTS                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Quick Add: [Type a fact and press Enter...]                        │
│                                                                      │
│  📌 Pinned Facts                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ "I work at Acme Corp as a Senior Developer"           [📌][🗑] │   │
│  │ "Our tech stack is React + Node.js + PostgreSQL"      [📌][🗑] │   │
│  │ "I prefer TypeScript over JavaScript"                 [📌][🗑] │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  📂 By Category                                                      │
│  • Work Context (3)    • Technical Preferences (5)                  │
│  • Personal (2)        • Project-Specific (4)                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Adding Flash Facts

**Quick Method:**
1. During any conversation, type: "Remember that [fact]"
2. Think Tank saves it as a Flash Fact
3. Example: "Remember that I prefer verbose error messages"

**From the Interface:**
1. Go to **Settings** → **Flash Facts**
2. Type your fact in the quick-add field
3. Press Enter or click Add

### Flash Fact Categories

| Category | Examples |
|----------|----------|
| **Work Context** | Company, role, team, projects |
| **Technical** | Languages, frameworks, tools |
| **Preferences** | Communication style, detail level |
| **Personal** | Timezone, working hours |

### Managing Flash Facts

- **📌 Pin** - Keep fact always visible
- **🗑️ Delete** - Remove outdated facts
- **✏️ Edit** - Update fact details
- **📂 Categorize** - Organize by topic

---

## 18. Sentinel Agents - Background Monitors

Sentinel Agents are background processes that watch for specific conditions and take action automatically.

### What are Sentinel Agents?

Think of Sentinels as "if this, then that" for AI. They monitor your conversations and workflows, triggering actions when conditions are met.

```
┌─────────────────────────────────────────────────────────────────────┐
│  🛡️ SENTINEL AGENTS                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Active Agents (3)                        [+ Create Agent]          │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🔍 Code Quality Monitor                           [Active] ● │   │
│  │ Triggers: When code is generated                            │   │
│  │ Actions: Run linting, suggest improvements                   │   │
│  │ Fired: 47 times | Last: 2 minutes ago                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📊 Data Freshness Checker                         [Active] ● │   │
│  │ Triggers: When citing statistics                             │   │
│  │ Actions: Verify data age, add freshness warning              │   │
│  │ Fired: 12 times | Last: 1 hour ago                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent Types

| Type | Icon | Purpose |
|------|------|---------|
| **Monitor** | 🔍 | Watch for patterns and report findings |
| **Guardian** | 🛡️ | Prevent unwanted outcomes and enforce rules |
| **Scout** | 🔭 | Proactively search for relevant information |
| **Herald** | 📢 | Announce important events and notifications |
| **Arbiter** | ⚖️ | Make decisions and resolve conflicts |

### Creating a Sentinel Agent

1. Go to **Settings** → **Sentinel Agents**
2. Click **+ Create Agent**
3. Define your trigger conditions
4. Specify actions to take
5. Set any additional conditions
6. Activate the agent

### Example Agents

| Agent | Trigger | Action |
|-------|---------|--------|
| **Citation Checker** | When claims are made | Request sources |
| **Cost Monitor** | When query cost exceeds $1 | Notify before proceeding |
| **Security Scanner** | When code is generated | Check for vulnerabilities |
| **Summary Generator** | After long conversations | Create summary |

---

## 19. Economic Governor - Cost Management

The Economic Governor helps you manage AI costs by intelligently routing queries to the most cost-effective models.

### Understanding Costs

Different AI models have different costs:

| Model Tier | Typical Cost | Best For |
|------------|--------------|----------|
| **Fast** (Sniper) | ~$0.01/query | Quick lookups, simple questions |
| **Standard** | ~$0.05/query | Most conversations |
| **Advanced** | ~$0.15/query | Complex analysis |
| **Multi-Model** (War Room) | ~$0.50+/query | Critical decisions |

### Automatic Routing

The Economic Governor automatically routes your queries:

```
┌─────────────────────────────────────────────────────────────────────┐
│  💰 ECONOMIC GOVERNOR                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Your Query: "What's the capital of France?"                        │
│                                                                      │
│  Analysis:                                                           │
│  ├─ Complexity: Low                                                  │
│  ├─ Domain: General Knowledge                                        │
│  └─ Recommendation: Sniper Mode ($0.01)                             │
│                                                                      │
│  [Use Recommended] [Escalate to Standard] [Force War Room]          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Budget Controls

Set spending limits:

- **Daily Budget** - Maximum spend per day
- **Query Limit** - Maximum cost per single query
- **Notifications** - Alert when approaching limits

### Arbitrage Rules

Create rules to optimize costs:

| Rule | Effect |
|------|--------|
| "Simple facts → Sniper" | Route factual lookups to fast models |
| "Code review → Standard" | Use mid-tier for code analysis |
| "Legal questions → Advanced" | Always use high-accuracy for legal |

### Viewing Usage

Go to **Profile** → **Usage** to see:
- Total spend this period
- Cost breakdown by model
- Most expensive queries
- Savings from optimization

---

## 20. Council of Rivals - Multi-Model Deliberation

The Council of Rivals brings multiple AI perspectives together to debate and reach consensus on complex questions.

### What is the Council?

For important decisions, you can convene a "council" of different AI models, each offering their perspective on your question.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚔️ COUNCIL OF RIVALS                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Question: "Should we migrate to microservices?"                    │
│                                                                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
│  │ Claude  │ │  GPT-4  │ │ Gemini  │ │ Mistral │                   │
│  │   ✓     │ │   ✓     │ │   ✗     │ │   ~     │                   │
│  │  Pro    │ │  Pro    │ │ Against │ │ Neutral │                   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                   │
│                                                                      │
│  Consensus: 60% in favor | Key disagreement: Timeline               │
│                                                                      │
│  [View Full Debate] [Request Synthesis] [Add Expert]               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Starting a Council Session

1. Ask your question normally
2. Click **Escalate to War Room** or type "I want multiple perspectives"
3. Select which models to include (or use presets)
4. Watch the deliberation unfold

### Council Presets

| Preset | Models | Best For |
|--------|--------|----------|
| **Technical Review** | Claude, GPT-4, Codex | Code decisions |
| **Strategic** | Claude, GPT-4, Gemini | Business strategy |
| **Creative** | Claude, GPT-4, Gemini Pro | Creative projects |
| **Full Council** | All available models | Critical decisions |

### Understanding Results

- **Votes** - Each model's position (✓ Pro, ✗ Against, ~ Neutral)
- **Consensus %** - Level of agreement
- **Key Disagreements** - Points where models differ
- **Synthesis** - Combined recommendation considering all views

### When to Use Council

| Scenario | Recommended |
|----------|-------------|
| Quick factual questions | No - use Sniper |
| Important decisions | Yes |
| When you want multiple viewpoints | Yes |
| Validating a conclusion | Yes |

---

## 21. Voice Input & File Attachments

Think Tank supports voice input and file attachments for richer interactions.

### Voice Input

Click the **🎤** microphone button to speak your message:

1. **Click** the microphone icon
2. **Speak** clearly into your microphone
3. **Click again** to stop recording
4. **Review** the transcription
5. **Send** or edit before sending

**Supported languages**: All 18 interface languages

### File Attachments

Attach files for the AI to analyze:

1. **Click** the **📎** paperclip button
2. **Select** files to upload
3. **Wait** for processing
4. **Ask** questions about the files

### Supported File Types

| Type | Extensions | What Think Tank Can Do |
|------|------------|----------------------|
| **Documents** | PDF, DOC, DOCX, TXT | Read, summarize, answer questions |
| **Spreadsheets** | CSV, XLS, XLSX | Analyze data, create charts |
| **Images** | JPG, PNG, GIF, WEBP | Describe, extract text, analyze |
| **Code** | JS, PY, TS, etc. | Review, explain, debug |

### Drag and Drop

Simply drag files directly into the chat window to attach them.

### File Size Limits

| Plan | Max File Size | Max Files per Message |
|------|--------------|----------------------|
| Standard | 10 MB | 5 |
| Pro | 50 MB | 10 |
| Enterprise | 100 MB | 20 |

---

## 22. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **⌘K** / **Ctrl+K** | Open Magic Carpet Navigator |
| **⌘Enter** / **Ctrl+Enter** | Send message |
| **Escape** | Close dialogs/modals |
| **⌘/** / **Ctrl+/** | Open keyboard shortcuts help |
| **⌘N** / **Ctrl+N** | New conversation |
| **⌘S** / **Ctrl+S** | Save/Export conversation |

---

## 23. Troubleshooting

### Common Issues

#### "Response is taking too long"

- Complex queries in War Room mode take longer
- Check your network connection
- Try simplifying your question

#### "AI gave an incorrect answer"

1. Check if you're in the right domain mode
2. Provide more context in your question
3. Use the thumbs down button to provide feedback
4. Consider adding a rule to prevent this in the future

#### "I can't access a feature"

- Some features require specific permissions
- Contact your administrator for access
- Check if the feature is enabled for your organization

#### "My rules aren't being applied"

1. Verify the rule is toggled ON
2. Check the rule isn't too vague
3. Make sure the rule doesn't conflict with other rules
4. Try making the rule more specific

### Getting Help

- **In-App Help** - Click the ? icon in the header
- **Documentation** - Access guides from Settings
- **Support** - Contact your organization's IT team

---

## 24. Workflows & Orchestration Methods

Think Tank uses a powerful workflow system to intelligently process your requests. Understanding how workflows work helps you get better results and customize your AI experience.

### What Are Workflows?

Workflows are predefined patterns for how Think Tank approaches different types of questions. Instead of just sending your prompt to a single AI model, workflows can:

- **Chain multiple steps** together (analyze → propose → verify → refine)
- **Run multiple AI models in parallel** and combine their outputs
- **Apply quality checks** and verification at each step
- **Route to specialist models** based on your domain

```
Your Question
     │
     ▼
┌──────────────┐
│   Observer   │ ← Understand what you're asking
└──────┬───────┘
       ▼
┌──────────────┐
│   Proposer   │ ← Generate possible approaches
└──────┬───────┘
       ▼
┌──────────────┐
│    Critics   │ ← Evaluate and improve (may use multiple AIs)
└──────┬───────┘
       ▼
┌──────────────┐
│   Validator  │ ← Verify quality and accuracy
└──────┬───────┘
       ▼
   Final Response
```

### System Workflows

Think Tank includes **70+ pre-built workflows** for common tasks:

| Category | Example Workflows |
|----------|-------------------|
| **Research** | Deep Research, Literature Review, Fact Check |
| **Code** | Code Review, Bug Analysis, Refactor Proposal |
| **Writing** | Content Polish, Translation, Summarization |
| **Analysis** | Sentiment Analysis, Trend Analysis, Competitive Intel |
| **Decision** | Pros-Cons Analysis, Risk Assessment, Recommendation |
| **Creative** | Brainstorm, Story Expansion, Concept Generation |

The Brain Plan panel shows which workflow Think Tank selected for your question.

### Multi-AI Selection

Think Tank can use **multiple AI models simultaneously** for a single response:

**How It Works:**
1. Your question runs through several AI models in parallel
2. Each model provides its perspective
3. Results are evaluated and combined
4. The best answer is synthesized

**Stream Evaluation Modes:**
- **Any** - First good answer wins (fastest)
- **All** - All models must agree (most thorough)
- **Majority** - >50% agreement required
- **Best** - Highest confidence answer selected
- **Weighted** - Answers weighted by confidence scores

You can see multi-AI execution in the Brain Plan when it shows "Parallel" or "Council" modes.

### Orchestration Methods

Behind workflows are **25+ orchestration methods** based on peer-reviewed AI research:

| Method | What It Does | When It's Used |
|--------|--------------|----------------|
| **Semantic Entropy** | Measures uncertainty across multiple samples | High-stakes questions |
| **Self-Consistency** | Generates multiple reasoning paths, takes majority vote | Math/logic problems |
| **Panel of Judges** | Multiple AI models evaluate quality independently | Quality assurance |
| **Debate** | AIs argue different positions, synthesize best arguments | Complex decisions |
| **Hallucination Detection** | Checks if claims are consistent and attributable | Factual questions |
| **Mixture of Agents** | Layered synthesis from diverse models | Comprehensive answers |
| **Process Reward** | Verifies each reasoning step individually | Step-by-step problems |
| **Frugal Cascade** | Starts with cheap models, escalates only if needed | Cost optimization |

### Saving Your Own Workflows

You can save customized workflows for reuse:

1. **During a conversation**, click **"Save as Template"** in the Brain Plan panel
2. **Name your workflow** (e.g., "My Code Review Process")
3. **Adjust parameters** like:
   - Which AI models to use
   - Quality thresholds
   - Number of verification steps
   - Cost limits
4. **Save** - Available in your Workflow Templates

**Sharing Workflows:**
- **Private** - Only you can use
- **Team** - Shared with your organization
- **Public** - Available to all users (requires admin approval)

### Workflow Parameters You Can Customize

| Parameter | What It Controls | Default |
|-----------|------------------|---------|
| **Quality Weight** | Balance between quality and speed | 0.7 |
| **Cost Threshold** | Maximum cost per query | Varies |
| **Confidence Threshold** | Minimum confidence to accept | 0.85 |
| **Sample Count** | How many samples for voting methods | 5 |
| **Max Escalations** | How many times to try stronger models | 2 |
| **Auto-Approve Threshold** | Skip human review if confidence exceeds | 0.95 |

Access these in **Settings → Workflow Preferences**.

### Conditional Logic

Workflows use **conditions** to decide what happens next:

**Expression Conditions** (automatic):
- `confidence > 0.8` - Proceed if AI is confident
- `contains("error")` - Branch if error detected
- `length > 100` - Check response completeness

**AI-Interpreted Conditions** (smart):
- "Is this response helpful and on-topic?"
- "Does this contain any safety concerns?"
- "Is this code syntactically correct?"

These conditions are **model-agnostic** - they evaluate the quality of the answer, not which AI model produced it. This means you can swap AI models without breaking your workflows.

### Viewing Workflow Execution

To see how Think Tank processed your question:

1. **Brain Plan Panel** - Shows orchestration mode, domain, and confidence
2. **Expand Details** - Click to see step-by-step execution
3. **Cost Breakdown** - Shows tokens and cost per step
4. **Model Usage** - Which AI models were used

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✅ Step 1: Observer           Claude 3.5 Sonnet     0.02¢   150ms │
│  ✅ Step 2: Proposer           GPT-4o               0.05¢   320ms │
│  ✅ Step 3: Critic (parallel)  3 models             0.08¢   280ms │
│  ✅ Step 4: Validator          Claude 3.5 Sonnet    0.03¢   180ms │
│  ─────────────────────────────────────────────────────────────────  │
│  Total: 0.18¢  |  930ms  |  Confidence: 94%                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 25. Glossary

| Term | Definition |
|------|------------|
| **Brain Plan** | Think Tank's execution plan showing how it will answer your question |
| **Breathing UI** | Visual elements that pulse to communicate confidence and data freshness |
| **CBF** | Control Barrier Function - safety guardrails that cannot be bypassed |
| **Confidence Terrain** | 3D visualization where elevation = confidence, color = risk |
| **Council of Experts** | Multi-persona AI consultation with 8 distinct viewpoints |
| **Debate Arena** | Adversarial exploration tool for stress-testing ideas |
| **Decision Record** | Auditable capture of AI reasoning, evidence, and conclusions |
| **Delight** | The personality and engagement system |
| **Domain Mode** | Specialized configuration for different knowledge areas |
| **Ego** | Think Tank's persistent identity and emotional state |
| **Ghost Path** | Translucent overlay showing rejected alternatives |
| **Governance Preset** | Organization-wide safety/autonomy settings |
| **Grimoire** | The AI's learned procedural memory |
| **Heuristic** | A learned rule or shortcut the AI uses |
| **HITL** | Human-in-the-Loop - requiring human approval |
| **Living Ink** | Typography that varies weight based on confidence (350-500) |
| **Living Parchment** | Advanced decision intelligence suite with sensory UI |
| **Magic Carpet** | Intent-based navigation system |
| **My Rules** | Personal preferences that customize AI responses |
| **Polymorphic UI** | Interface that adapts based on query type |
| **Sentinel Agent** | Background process that monitors for conditions and triggers actions |
| **Sniper Mode** | Fast, low-cost single-model execution |
| **Spell** | A learned pattern in the Grimoire that improves AI responses |
| **Steel-Man** | AI-generated strongest version of an opposing argument |
| **Time Machine** | Conversation forking and replay system |
| **Timeline** | A branch in Time Machine representing a conversation path |
| **War Room** | Strategic Decision Theater for high-stakes collaborative decisions |
| **War Room Mode** | Thorough multi-agent execution |
| **Workflow** | A predefined pattern of steps for processing AI requests |
| **Orchestration Method** | A specific algorithm or technique used within workflows |
| **Stream Evaluation** | How multiple parallel AI outputs are combined |
| **Model-Agnostic Condition** | A condition that evaluates output quality, not model identity |
| **Workflow Template** | A saved, reusable workflow configuration |
| **Cartridge** | Portable AI brain package (.RADz file) containing trained neural networks |
| **CORTEX** | Six small neural networks that make routing and orchestration decisions |
| **Ghost Vector** | 64-dimensional representation of your preferences and interaction style |
| **LoRA Adapter** | Lightweight domain-specific training that customizes AI responses |
| **Thermal State** | System readiness level (COLD, WARMING, WARM, HOT) |
| **Twilight Dreaming** | Nightly autonomous learning cycle that improves the AI |
| **Autonomous Organism** | Self-evolving AI infrastructure that adapts and grows capabilities |
| **Liquid Compute** | Data sovereignty system ensuring processing in compliant jurisdictions |
| **Ghost Simulation** | Digital twin that learns preferences without storing actual prompts |
| **Economic Cortex** | Autonomous budget management with hierarchical cost controls |
| **Genesis Auto-Tool** | System that automatically creates new capabilities on demand |
| **Neural Affinity Routing** | AI model selection based on semantic similarity and proficiency |
| **Tensor-Link** | High-efficiency vector-based communication protocol for AI systems |

---

## 26. RADIANT Cartridges - Portable AI Brains

### What Are Cartridges?

Think Tank is powered by **RADIANT Cartridges** — portable AI intelligence packages that contain everything the system has learned. Think of them like game cartridges: the hardware (RADIANT) provides the platform, the cartridge provides the intelligence.

**Why This Matters to You:**
- Your organization's AI gets smarter over time
- Expertise can be transferred between deployments
- The AI remembers your team's terminology, preferences, and domain knowledge

### How Cartridges Work

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          YOUR CARTRIDGE CONTAINS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🧠 CORTEX Networks     - Routing decisions, pattern recognition            │
│  📚 LoRA Adapters       - Your organization's domain expertise              │
│  👤 Ghost Vectors       - Personal preferences for each user                │
│  ✅ Curator Knowledge   - Verified facts and golden rules                   │
│  🏭 Expert Systems      - Industry-specific reasoning patterns              │
│                                                                             │
│  Result: AI that "gets" your business from day one                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Three Learning Tiers

Think Tank learns at three levels simultaneously:

| Tier | What It Learns | Update Frequency | Weight |
|------|----------------|------------------|--------|
| **You (Ghost Vectors)** | Your preferences, communication style, expertise | Every session | 70% for returning users |
| **Your Organization (LoRA)** | Company terminology, processes, domain knowledge | Nightly | 50% for new users |
| **Everyone (Global)** | Best practices, safety improvements, new capabilities | Monthly | 10-30% |

**New users** benefit heavily from organizational learning (50%), while **returning users** get highly personalized responses (70% from your personal Ghost Vector).

---

## 27. Domain Selector

### Selecting Your Expertise Domain

The **Domain Selector** allows you to manually specify your area of expertise, which helps Think Tank tailor its responses more precisely.

**To access the Domain Selector:**
1. Click the **globe icon** (🌐) in the chat header
2. Browse or search for your domain
3. Select from 800+ domains across 8 major fields

### Domain Hierarchy

```
Field (8 total)
├── Domain (100+ per field)
│   └── Subspecialty (5-20 per domain)
```

**Example:**
- **Field**: Healthcare
- **Domain**: Cardiology
- **Subspecialty**: Interventional Cardiology

### Auto-Detection vs. Manual Override

| Mode | Description | Best For |
|------|-------------|----------|
| **Auto Detect** | AI analyzes your prompt and detects domain | General use, varied topics |
| **Manual Selection** | You specify the domain explicitly | Specialized work, consistent domain |

**Pro Tip**: Set a default domain in Settings if you primarily work in one field. You can always override per-conversation.

---

## 28. Cartridge Indicator

### Understanding the Cartridge Status

The **Cartridge Indicator** shows which AI intelligence packages are currently active and their status.

**Accessing the Indicator:**
- Click the **shield icon** in the chat header
- View active cartridges, versions, and capabilities

### Indicator States

| Icon | State | Meaning |
|------|-------|---------|
| 🟢 | Active | Cartridge loaded, full intelligence available |
| 🟡 | Warming | Cartridge loading, temporary reduced capability |
| 🔴 | Inactive | No cartridge for this domain |
| 🔵 | Updating | Hot-swap in progress, zero downtime |

### Cartridge Details

Expanding the indicator shows:
- **Cartridge Name**: e.g., "Legal-Enterprise v2.1"
- **Installed Date**: When this version was deployed
- **Scope**: Global, Tenant, or User level
- **Capabilities**: List of enhanced features

---

## 29. Autonomous Intelligence Features

### Overview

Think Tank v6.6.0 introduces the **Autonomous Organism Architecture** — a collection of intelligent systems that work behind the scenes to protect your privacy, personalize your experience, and manage costs efficiently.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTONOMOUS ORGANISM BENEFITS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🌍 LIQUID COMPUTE       - Your data stays in your jurisdiction            │
│  👻 GHOST SIMULATION     - AI learns your style without storing prompts    │
│  💰 ECONOMIC CORTEX      - Smart budgeting keeps costs predictable         │
│  🔧 GENESIS AUTO-TOOL    - New capabilities appear automatically           │
│  🧠 NEURAL ROUTING       - Best AI model selected for each question        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Liquid Compute - Data Sovereignty

Liquid Compute ensures your data is processed in compliance with regional regulations:

| Feature | What It Means for You |
|---------|----------------------|
| **Automatic Jurisdiction Detection** | Your location determines where data is processed |
| **GDPR Compliance** | EU users' data stays in EU data centers |
| **HIPAA Routing** | Healthcare data uses compliant processing paths |
| **No Configuration Needed** | Works automatically based on your organization's settings |

**How It Works:**
1. Think Tank detects your regulatory requirements
2. Compute location is selected automatically (EU, US, APAC, or on-premise)
3. Your data never leaves the approved jurisdiction
4. You see a small indicator showing where processing occurs

**Privacy Indicator:**
```
┌─────────────────────────────────────────┐
│  🇪🇺 Processing in EU (Frankfurt)       │
│  ✓ GDPR Compliant  ✓ Data Resident     │
└─────────────────────────────────────────┘
```

### Ghost Simulation - Personalized Safety

Ghost Simulation creates a **digital twin** of your interaction patterns to provide personalized responses without storing your actual prompts:

| Benefit | Description |
|---------|-------------|
| **Pattern Learning** | AI understands your communication style |
| **No Prompt Storage** | Your actual questions are not retained |
| **Personalized Safety** | Guardrails adapt to your expertise level |
| **Preference Memory** | Remembers if you prefer concise or detailed answers |

**Your Ghost Vector:**
- 4096-dimensional mathematical representation of your preferences
- Updates with each interaction (decays naturally over time)
- Never contains actual content — only patterns
- You can reset it anytime in Settings → Privacy → Reset Ghost Vector

**What Ghost Simulation Learns:**
- Your preferred response length
- Technical depth you're comfortable with
- Domains where you have expertise
- Times when you're typically active
- Communication style preferences

**Privacy Note:** Ghost Vectors are tenant-isolated and encrypted. Administrators cannot see individual user patterns.

### Economic Cortex - Smart Budget Management

Economic Cortex automatically manages AI costs while ensuring quality:

| Feature | User Benefit |
|---------|-------------|
| **Hierarchical Budgets** | Personal and team budgets work together |
| **Smart Model Selection** | Cheaper models used when sufficient |
| **Budget Alerts** | Get notified before hitting limits |
| **Cost Transparency** | See exactly what each query costs |

**Understanding Your Budget Display:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  💰 Budget Status                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Daily Budget:    ████████████░░░░  $4.20 / $5.00 (84%)                    │
│  Weekly Budget:   ██████░░░░░░░░░░  $12.50 / $35.00 (36%)                  │
│  Quality Mode:    Standard (auto-upgrades for complex queries)             │
│                                                                             │
│  Last Query: $0.003 (GPT-4o-mini) — Saved $0.047 vs premium                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Budget Tiers:**
| Tier | Models Used | When Applied |
|------|-------------|-------------|
| **Economy** | GPT-3.5, Claude Instant | Simple questions, high volume |
| **Standard** | GPT-4o-mini, Claude Haiku | Default for most queries |
| **Premium** | GPT-4o, Claude Sonnet | Complex analysis, code review |
| **Flagship** | GPT-4-turbo, Claude Opus | Critical decisions, expert domains |

**Cost Optimization Tips:**
1. Set a default budget tier in Settings → Economic Preferences
2. Use "Quick Mode" (⚡) for simple questions
3. Enable "Smart Downgrade" to auto-select cheaper models when appropriate
4. Review your weekly cost report (emailed Mondays)

### Genesis Auto-Tool - Automatic Capability Expansion

When you need a capability that doesn't exist, Genesis can create it:

**How It Works:**
1. You ask Think Tank to do something it can't do
2. Genesis analyzes the request and builds a new tool
3. The tool is validated in a sandbox
4. Within minutes, the capability is available

**Example:**
```
You: "Can you analyze this CSV and create a pivot table?"

Think Tank: "I don't have a pivot table tool, but Genesis is building one..."

[2 minutes later]

Think Tank: "Done! Here's your pivot table. This capability is now 
            available for future requests."
```

**Note:** Genesis-created tools are reviewed by administrators before becoming permanent.

### Neural Affinity Routing

Think Tank automatically selects the best AI model for each question:

| Consideration | How It's Used |
|--------------|---------------|
| **Domain Match** | Coding → Claude, Creative → GPT-4 |
| **Your History** | Models that worked well for you before |
| **Cost Efficiency** | Cheapest model that meets quality threshold |
| **Current Load** | Avoids overloaded models |

**You can influence routing:**
- Set model preferences in Settings → AI Models
- Use the model selector (🤖) to force a specific model
- Add a rule: "Always use Claude for Python questions"

### Viewing Organism Status

To see how these systems are working for you:

1. **Click the organism icon** (🧬) in the header
2. **View the status panel** showing:
   - Current compute location
   - Ghost vector confidence score
   - Budget remaining
   - Active tools count
   - Model routing statistics

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 7.9.0 | Feb 5, 2026 | **LIVS-M 2.0 Policy Modes**: Added comprehensive documentation for "Defcon-style" AI governance with Brainstorming, Standard, and Strict Audit policy modes. Updated Settings → Advanced → LIVS-M Policy access path. |
| 6.6.0 | Feb 3, 2026 | **Autonomous Organism Architecture (Project Metamorphosis)**: Added Section 29 covering Liquid Compute (data sovereignty), Ghost Simulation (personalized safety), Economic Cortex (budget management), Genesis Auto-Tool (capability expansion), and Neural Affinity Routing (model selection) |
| 6.0.0 | Jan 31, 2026 | **Neural Architecture v6.0.0**: Added RADIANT Cartridges section, Domain Selector guide, Cartridge Indicator documentation, Three Learning Tiers explanation, expanded Glossary with neural architecture terms |
| 5.52.58 | Jan 31, 2026 | Added Workflows & Orchestration Methods section (multi-AI selection, stream evaluation, workflow templates, configurable parameters) |
| 5.52.52 | Jan 28, 2026 | Major update: Added Time Machine, Grimoire, Flash Facts, Sentinel Agents, Economic Governor, Council of Rivals, Voice Input & File Attachments sections |
| 5.52.0 | Jan 23, 2026 | Simulator now uses real API data with graceful fallbacks |
| 5.44.0 | Jan 22, 2026 | Added Living Parchment section (War Room, Council, Debate Arena) |
| 5.43.0 | Jan 22, 2026 | Added Decision Records section (DIA Engine) |
| 5.35.0 | Jan 2026 | Initial comprehensive user guide |

---

*Think Tank is designed to be your intelligent partner. The more you use it and customize it to your needs, the more valuable it becomes. Happy thinking!*


> **Your gateway to 100+ AI models in one place**
> 
> Version: 3.2.0 (Platform: RADIANT 4.18.1)
> Last Updated: December 2024

---

## Welcome to Think Tank

Think Tank is your all-in-one AI assistant platform. Access the world's best AI models—GPT-4, Claude, Gemini, and 100+ more—from a single, beautiful interface.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Your Dashboard](#2-your-dashboard)
3. [Chatting with AI](#3-chatting-with-ai)
4. [Choosing Models](#4-choosing-models)
5. [Focus Modes & Personas](#5-focus-modes--personas)
6. [Canvas & Artifacts](#6-canvas--artifacts)
7. [Collaboration Features](#7-collaboration-features)
8. [Managing Your Account](#8-managing-your-account)
9. [Credits & Billing](#9-credits--billing)
10. [Tips & Best Practices](#10-tips--best-practices)
11. [Keyboard Shortcuts](#11-keyboard-shortcuts)
12. [FAQ](#12-faq)
13. [Delight System](#13-delight-system)

---

## 1. Getting Started

### 1.1 Creating Your Account

1. Visit **[thinktank.ai](https://thinktank.ai)**
2. Click **Get Started Free**
3. Sign up with:
   - Email and password
   - Google account
   - Microsoft account
   - Apple ID
4. Verify your email
5. Complete your profile

### 1.2 Choosing a Plan

| Plan | Price | Best For |
|------|-------|----------|
| **Free** | $0/month | Trying out Think Tank |
| **Starter** | $29/month | Individual creators |
| **Pro** | $99/month | Power users |
| **Team** | $49/user/month | Small teams |
| **Business** | $199/user/month | Organizations |

### 1.3 Your First Chat

1. Click **New Chat** or press `Ctrl+N`
2. Type your question or request
3. Press `Enter` or click **Send**
4. Watch as AI responds in real-time

**Try these starter prompts:**
- "Explain quantum computing like I'm 10 years old"
- "Write a professional email declining a meeting"
- "Help me debug this Python code: [paste code]"
- "Create a meal plan for the week"

---

## 2. Your Dashboard

### 2.1 Interface Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  🧠 Think Tank                    [Search]  [Credits: 450]  👤  │
├─────────────┬───────────────────────────────────────────────────┤
│             │                                                   │
│  📁 Chats   │                    Chat Area                      │
│  ─────────  │                                                   │
│  ⭐ Starred │    Welcome! How can I help you today?             │
│  📅 Today   │                                                   │
│    Chat 1   │                                                   │
│    Chat 2   │                                                   │
│  📅 Yesterday│                                                   │
│    Chat 3   │                                                   │
│             │                                                   │
│  ─────────  │  ┌───────────────────────────────────────────┐   │
│  🎭 Personas│  │ Type your message...              [Send] │   │
│  📋 Canvas  │  └───────────────────────────────────────────┘   │
│  ⚙️ Settings│                                                   │
│             │  Model: GPT-4 Turbo  |  Focus: General  |  🎤 📎  │
└─────────────┴───────────────────────────────────────────────────┘
```

### 2.2 Sidebar Navigation

| Icon | Section | Description |
|------|---------|-------------|
| 💬 | Chats | All your conversations |
| ⭐ | Starred | Important chats |
| 🎭 | Personas | Custom AI personalities |
| 📋 | Canvas | Visual workspace |
| 📊 | Usage | Credit usage stats |
| ⚙️ | Settings | Account settings |

### 2.3 Quick Actions

| Action | Shortcut |
|--------|----------|
| New Chat | `Ctrl+N` |
| Search | `Ctrl+K` |
| Toggle Sidebar | `Ctrl+B` |
| Settings | `Ctrl+,` |

---

## 3. Chatting with AI

### 3.1 Sending Messages

**Text Messages:**
- Type in the input box
- Press `Enter` to send
- Use `Shift+Enter` for new lines

**Attachments:**
- 📎 Click to attach files
- Drag & drop images, PDFs, code files
- Paste images directly (`Ctrl+V`)

**Voice Input:**
- 🎤 Click microphone icon
- Speak your message
- Click again to stop

### 3.2 Message Actions

Hover over any message to see actions:

| Icon | Action | Description |
|------|--------|-------------|
| 📋 | Copy | Copy message text |
| 🔄 | Regenerate | Get a new response |
| ✏️ | Edit | Modify your message |
| 👍/👎 | Rate | Help improve AI |
| 📌 | Pin | Keep message visible |
| 🗑️ | Delete | Remove message |

### 3.3 Streaming Responses

AI responses stream in real-time. You can:
- **Stop**: Click ⏹️ to stop generation
- **Continue**: Ask "continue" if response was cut off
- **Regenerate**: Get a different response

### 3.4 Multi-Turn Conversations

Think Tank remembers your conversation context:

```
You: I'm planning a trip to Japan
AI:  That's exciting! When are you planning to visit...

You: What about the food?
AI:  Japanese cuisine is incredible! Based on your trip...
     [AI remembers you're going to Japan]
```

### 3.5 Code in Chats

Code is automatically syntax-highlighted:

```python
def hello_world():
    print("Hello, Think Tank!")
```

Click **Copy** to copy code blocks, or **Run** for supported languages.

---

## 4. Choosing Models

### 4.1 Model Selection

Click the model selector at the bottom of the chat:

```
┌─────────────────────────────────────┐
│ Select Model                    ✕  │
├─────────────────────────────────────┤
│ ⭐ Favorites                        │
│   GPT-4 Turbo          $0.02/msg   │
│   Claude 3 Opus        $0.03/msg   │
├─────────────────────────────────────┤
│ 🔥 Recommended                      │
│   GPT-4o               $0.01/msg   │
│   Claude 3.5 Sonnet    $0.01/msg   │
│   Gemini 1.5 Pro       $0.01/msg   │
├─────────────────────────────────────┤
│ 📝 Writing                          │
│ 💻 Coding                           │
│ 🔬 Analysis                         │
│ 🎨 Creative                         │
│ [View All 100+ Models]              │
└─────────────────────────────────────┘
```

### 4.2 Model Categories

| Category | Best For | Top Models |
|----------|----------|------------|
| **General** | Everyday tasks | GPT-4o, Claude 3.5 |
| **Writing** | Content creation | Claude 3 Opus, GPT-4 |
| **Coding** | Programming help | GPT-4 Turbo, CodeLlama |
| **Analysis** | Data & research | Gemini 1.5, Claude 3 |
| **Creative** | Art & ideas | GPT-4, Mistral Large |
| **Vision** | Image understanding | GPT-4V, LLaVA |
| **Fast** | Quick responses | GPT-3.5, Claude Instant |

#### Choosing the Right Model

**For everyday questions and tasks**: Start with GPT-4o or Claude 3.5 Sonnet. These models offer the best balance of quality, speed, and cost. They handle most tasks excellently including writing, answering questions, brainstorming, and light coding.

**For professional writing**: Claude 3 Opus excels at long-form content, maintaining consistent tone, and nuanced writing. GPT-4 is also excellent for business documents and creative writing.

**For coding and technical work**: GPT-4 Turbo has strong coding abilities across many languages. For specialized tasks, consider CodeLlama (open source, good for common languages) or specialized models like DeepSeek Coder.

**For data analysis**: Gemini 1.5 Pro handles very long documents (up to 1 million tokens) making it ideal for analyzing large datasets or documents. Claude 3 is excellent for nuanced analytical reasoning.

**For creative projects**: GPT-4 and Mistral Large are both creative and can help with brainstorming, storytelling, and idea generation. They're less constrained in creative contexts.

**For image understanding**: GPT-4V (Vision) and Claude 3 Vision can analyze images, read text from photos, describe scenes, and answer questions about visual content.

**For quick, simple tasks**: GPT-3.5 Turbo and Claude Instant are much faster and cheaper. Use them for simple questions, formatting, or when you need instant responses.

### 4.3 Auto Mode

Let Think Tank choose the best model:

1. Enable **Auto Mode** in settings
2. Our Brain Router analyzes your request
3. Automatically selects optimal model
4. Balances quality, speed, and cost

#### How Auto Mode Works

When you enable Auto Mode, Think Tank's Brain Router analyzes each message you send and selects the best model based on:

- **Task complexity**: Simple questions go to fast models; complex tasks go to powerful models
- **Content type**: Coding questions route to code-specialized models; creative requests to creative models
- **Your history**: Learns your preferences over time and adjusts recommendations
- **Cost efficiency**: Avoids using expensive models when cheaper ones would work equally well
- **Current availability**: Routes around any models experiencing slowdowns

**When to use Auto Mode**:
- You're not sure which model to use
- You want to optimize cost without sacrificing quality
- You have varied tasks throughout the day
- You're new to Think Tank

**When to choose manually**:
- You need a specific model's unique capabilities
- You're doing specialized work (e.g., always want Claude for writing)
- You're comparing models intentionally
- You have strong preferences for certain models

### 4.4 Model Comparison

Split-screen to compare models:

1. Click **Compare** button
2. Select 2-4 models
3. Send message to all simultaneously
4. See responses side-by-side

---

## 5. Focus Modes & Personas

### 5.1 Focus Modes

Pre-configured modes for specific tasks:

| Mode | Optimized For |
|------|---------------|
| 💼 **Professional** | Business writing, emails |
| 💻 **Developer** | Code, debugging, architecture |
| 📚 **Research** | Analysis, citations, accuracy |
| ✍️ **Creative** | Stories, brainstorming |
| 📖 **Learning** | Explanations, tutoring |
| 🎯 **Concise** | Brief, direct answers |

**To switch modes:**
1. Click the Focus selector
2. Choose your mode
3. AI adapts its style

#### Focus Mode Details

**Professional Mode**: The AI adopts a business-appropriate tone. Responses are polished, formal, and suitable for workplace communication. Great for drafting emails, reports, presentations, and client communications. Avoids casual language and ensures professional formatting.

**Developer Mode**: Optimized for technical work. The AI provides code with proper syntax highlighting, explains technical concepts clearly, suggests best practices, and can help debug issues. Responses include code comments and consider edge cases.

**Research Mode**: Emphasizes accuracy and thoroughness. The AI cites sources when possible, acknowledges uncertainty, presents multiple perspectives, and structures information logically. Ideal for academic work, fact-checking, and deep analysis.

**Creative Mode**: Removes constraints on creativity. The AI is more willing to explore unusual ideas, use vivid language, and think outside the box. Perfect for brainstorming, creative writing, storytelling, and generating innovative solutions.

**Learning Mode**: The AI becomes a patient tutor. Explanations start from basics and build up, concepts are broken into digestible pieces, and the AI checks understanding before moving on. Great for studying new topics.

**Concise Mode**: Responses are brief and to the point. The AI avoids lengthy explanations and gets straight to the answer. Useful when you need quick facts or are in a hurry.

### 5.2 Custom Personas

Create your own AI personalities:

1. Go to **Personas** → **Create New**
2. Configure:
   - **Name**: "Marketing Expert"
   - **Personality**: Professional, enthusiastic
   - **Expertise**: Digital marketing, SEO
   - **Style**: Uses bullet points, data-driven
3. Click **Save**

**Example Persona:**
```
Name: Code Reviewer
Personality: Thorough, constructive
Instructions: Review code for bugs, security issues,
              and best practices. Always suggest
              improvements with examples.
```

### 5.3 Sharing Personas

- **Public**: Share with all Think Tank users
- **Team**: Share within your organization
- **Private**: Only you can use

---

## 6. Canvas & Artifacts

### 6.1 What is Canvas?

Canvas is your visual workspace for complex outputs:
- Code files with syntax highlighting
- Diagrams and flowcharts
- Documents and reports
- Data tables
- Mind maps

### 6.2 Creating Artifacts

When AI generates complex content, it appears as an artifact:

```
┌─────────────────────────────────────────────┐
│ 📄 business_plan.md                    ✕ ⋮  │
├─────────────────────────────────────────────┤
│ # Business Plan                             │
│                                             │
│ ## Executive Summary                        │
│ ...                                         │
│                                             │
├─────────────────────────────────────────────┤
│ [Copy] [Download] [Edit] [Version History]  │
└─────────────────────────────────────────────┘
```

### 6.3 Artifact Actions

| Action | Description |
|--------|-------------|
| **Copy** | Copy content to clipboard |
| **Download** | Save as file |
| **Edit** | Modify directly |
| **Versions** | View previous versions |
| **Share** | Generate share link |
| **To Canvas** | Open in full Canvas view |

### 6.4 Full Canvas Mode

For larger projects:

1. Click **Canvas** in sidebar
2. Create new canvas or open existing
3. Add multiple artifacts
4. Arrange spatially
5. Connect related items

---

## 7. Collaboration Features

### 7.1 Sharing Chats

Share any conversation:

1. Click **Share** (🔗) on a chat
2. Choose visibility:
   - **Link**: Anyone with link
   - **Team**: Your organization
   - **Private**: Specific people
3. Copy and share the link

### 7.2 Real-Time Collaboration

Work together on the same chat:

1. Share chat with **Edit** access
2. Multiple users can:
   - Send messages simultaneously
   - See each other's cursors
   - React to messages
3. Changes sync in real-time

### 7.3 Team Workspaces

For Team and Business plans:

- **Shared Chats**: Team-visible conversations
- **Shared Personas**: Team AI configurations
- **Shared Canvas**: Collaborative workspaces
- **Usage Dashboard**: Team analytics

### 7.4 Comments & Annotations

Add notes to any message:

1. Hover over message
2. Click **Comment** (💬)
3. Add your note
4. Tag teammates with @mention

---

## 8. Managing Your Account

### 8.1 Profile Settings

Access via **Settings** → **Profile**:

| Setting | Description |
|---------|-------------|
| Display Name | Your visible name |
| Email | Login email |
| Avatar | Profile picture |
| Language | Interface language |
| Timezone | For scheduled features |

### 8.2 Preferences

Customize your experience:

| Preference | Options |
|------------|---------|
| Theme | Light, Dark, System |
| Font Size | Small, Medium, Large |
| Default Model | Your preferred model |
| Auto Mode | Enable/disable |
| Sound Effects | On/Off |
| Notifications | Email, Push, None |

### 8.3 Data & Privacy

Control your data:

- **Export Data**: Download all your chats
- **Delete History**: Remove chat history
- **Training Opt-Out**: Exclude from AI training
- **Data Retention**: Set auto-delete period

### 8.4 Connected Apps

Manage integrations:

- Google Drive
- Dropbox
- Notion
- Slack
- GitHub

---

## 9. Credits & Billing

### 9.1 Understanding Credits

Credits are Think Tank's universal currency:

| Credit Value | Equivalent |
|--------------|------------|
| 1 credit | $0.01 |
| 100 credits | $1.00 |

### 9.2 Credit Usage

Different models cost different amounts:

| Model | ~Cost per Message |
|-------|-------------------|
| GPT-3.5 Turbo | 0.5 credits |
| GPT-4o | 1-2 credits |
| GPT-4 Turbo | 2-3 credits |
| Claude 3.5 Sonnet | 1-2 credits |
| Claude 3 Opus | 3-5 credits |

*Actual cost depends on message length*

### 9.3 Viewing Usage

Check your usage in **Settings** → **Usage**:

```
┌─────────────────────────────────────────────┐
│ Credit Usage - December 2024                │
├─────────────────────────────────────────────┤
│ Balance:        450 credits                 │
│ Used this month: 1,550 credits              │
│ Included:       2,000 credits               │
│                                             │
│ [██████████████░░░░░░] 77% used            │
│                                             │
│ By Model:                                   │
│   GPT-4 Turbo     800 credits (52%)        │
│   Claude 3        500 credits (32%)        │
│   Other           250 credits (16%)        │
└─────────────────────────────────────────────┘
```

### 9.4 Purchasing Credits

Need more credits?

1. Go to **Settings** → **Billing**
2. Click **Buy Credits**
3. Select amount:
   - 500 credits - $5
   - 1,000 credits - $9 (10% bonus)
   - 5,000 credits - $40 (20% bonus)
4. Complete payment

### 9.5 Subscription Management

Manage your plan:

- **Upgrade**: Get more features and credits
- **Downgrade**: Switch to lower tier (end of period)
- **Cancel**: Cancel subscription (keep access until end)
- **Invoices**: Download billing history

---

## 10. Tips & Best Practices

### 10.1 Writing Better Prompts

**Be Specific:**
```
❌ "Write about dogs"
✅ "Write a 200-word blog post about training golden 
    retriever puppies, focusing on positive reinforcement"
```

**Provide Context:**
```
❌ "Fix this code"
✅ "Fix this Python code that should sort a list but 
    throws an IndexError: [paste code]"
```

**Set the Format:**
```
❌ "Give me ideas"
✅ "Give me 5 blog post ideas about sustainable living,
    formatted as bullet points with a brief description"
```

### 10.2 Getting Better Results

| Technique | Example |
|-----------|---------|
| **Chain of thought** | "Think step by step..." |
| **Role assignment** | "Act as a senior developer..." |
| **Examples** | "Here's an example of what I want..." |
| **Constraints** | "In 100 words or less..." |
| **Iteration** | "Good, but make it more formal" |

### 10.3 Saving Credits

- Use **Auto Mode** for optimal model selection
- Use **GPT-3.5** for simple tasks
- Be concise in your prompts
- Avoid regenerating unnecessarily
- Use **Focus Modes** for specialized tasks

### 10.4 Organizing Chats

- ⭐ **Star** important conversations
- 📁 **Folders**: Group related chats
- 🏷️ **Tags**: Add searchable labels
- 🔍 **Search**: Find any past conversation

---

## 11. Keyboard Shortcuts

### 11.1 General

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New chat |
| `Ctrl+K` | Search |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+,` | Settings |
| `Ctrl+/` | Show shortcuts |
| `Escape` | Close modal |

### 11.2 Chat

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `Ctrl+↑` | Edit last message |
| `Ctrl+Shift+C` | Copy last response |
| `Ctrl+Shift+R` | Regenerate |
| `Ctrl+.` | Stop generation |

### 11.3 Navigation

| Shortcut | Action |
|----------|--------|
| `Alt+↑/↓` | Previous/next chat |
| `Ctrl+1-9` | Switch to chat 1-9 |
| `Ctrl+Tab` | Cycle tabs |

---

## 12. FAQ

### Getting Started

**Q: Is Think Tank free?**
A: Yes! The Free plan includes 50 credits/month. Upgrade for more credits and features.

**Q: Which AI model should I use?**
A: Enable Auto Mode and let us choose, or:
- General tasks → GPT-4o or Claude 3.5 Sonnet
- Complex analysis → GPT-4 Turbo or Claude 3 Opus
- Quick answers → GPT-3.5 Turbo

**Q: Can I use Think Tank on mobile?**
A: Yes! Visit thinktank.ai on any mobile browser, or download our iOS/Android apps.

### Credits & Billing

**Q: What happens when I run out of credits?**
A: You can purchase more credits or wait for your monthly refresh (paid plans).

**Q: Do unused credits roll over?**
A: Monthly included credits expire. Purchased credits never expire.

**Q: Can I get a refund?**
A: Contact support within 14 days for subscription refunds.

### Privacy & Security

**Q: Is my data used to train AI?**
A: By default, no. You can verify in Settings → Privacy.

**Q: Who can see my chats?**
A: Only you, unless you explicitly share them.

**Q: Is my data encrypted?**
A: Yes, with AES-256 encryption at rest and TLS 1.3 in transit.

### Troubleshooting

**Q: Why is the AI response slow?**
A: Complex queries or busy times may cause delays. Try a faster model.

**Q: Why did my response get cut off?**
A: Models have output limits. Type "continue" to get the rest.

**Q: I found a bug. How do I report it?**
A: Click **Help** → **Report Issue** or email support@thinktank.ai.

---

## Need Help?

- 📚 **Help Center**: help.thinktank.ai
- 💬 **Live Chat**: Click the chat bubble
- 📧 **Email**: support@thinktank.ai
- 🐦 **Twitter**: @ThinkTankAI
- 💬 **Discord**: discord.gg/thinktank

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.2.0 | December 2024 | Time Machine, enhanced collaboration, A/B experiments, **Delight System** |
| 3.1.0 | November 2024 | Canvas improvements, new models |
| 3.0.0 | October 2024 | Initial release |

---

## 13. Delight System

Think Tank includes a personality system called "Delight" that makes your AI experience more engaging.

### 13.1 What is Delight?

Delight adds contextual, friendly messages during your conversations:

- **Domain Loading**: "Consulting the fundamental forces..." when you ask physics questions
- **Time Awareness**: "Burning the midnight tokens" during late-night sessions
- **Model Dynamics**: "Consensus forming..." when multiple models agree
- **Wellbeing Nudges**: "You've been thinking hard. Time for a break?"

### 13.2 Personality Modes

Choose your preferred personality style in **Settings → Delight**:

| Mode | Description |
|------|-------------|
| **Professional** | Minimal, business-appropriate feedback |
| **Subtle** | Light touches of personality |
| **Expressive** | Full personality with humor |
| **Playful** | Maximum fun, includes easter eggs |

### 13.3 Achievements

Earn achievements as you use Think Tank:

| Achievement | How to Unlock |
|-------------|---------------|
| 🧭 Domain Explorer | Explore 10+ knowledge domains |
| 🔥 Week Warrior | Use Think Tank 7 days in a row |
| 👑 Renaissance Mind | Explore 50+ domains |
| ⚡ Monthly Mind | 30-day streak |

View your achievements in **Settings → Achievements**.

### 13.4 Easter Eggs

Think Tank has hidden surprises! Try:
- Typing special phrases
- Using keyboard shortcuts
- Exploring during special times

Discover them yourself—that's half the fun!

### 13.5 Sound Effects

Enable audio feedback in **Settings → Delight → Sounds**:

| Theme | Style |
|-------|-------|
| Default | Pleasant chimes |
| Mission Control | NASA-inspired beeps |
| Library | Page turns, book sounds |
| Workshop | Tool clicks |
| Emissions | Tesla-style... fun |

### 13.6 Customizing Delight

Toggle individual features:
- ✅ Domain messages
- ✅ Model personality
- ✅ Time awareness
- ✅ Achievements
- ✅ Wellbeing nudges
- ✅ Easter eggs
- ✅ Sound effects

Set intensity level (1-10) to control how often messages appear.

---

*Thank you for using Think Tank! We're constantly improving based on your feedback.*

© 2024 Think Tank AI. All rights reserved.


---

## Part II: Admin Guide

> **Configuration and administration of Think Tank AI features**
> 
> Version: 3.12.0 | Platform: RADIANT 6.0.0
> Last Updated: February 1, 2026

---

## Overview

This guide covers administrative features specific to **Think Tank**, the consumer-facing AI assistant platform. For platform-level administration (tenants, billing, infrastructure), see [RADIANT-ADMIN-GUIDE.md](./RADIANT-ADMIN-GUIDE.md).

### Related Authentication Documentation

| Document | Purpose |
|----------|---------|
| [Tenant Admin Auth Guide](./authentication/tenant-admin-guide.md) | SSO configuration, user management, MFA policies |
| [MFA Guide](./authentication/mfa-guide.md) | Multi-factor authentication setup and management |
| [OAuth Guide](./authentication/oauth-guide.md) | Third-party app integration |
| [i18n Guide](./authentication/i18n-guide.md) | 18-language support, RTL, CJK search |
| [Troubleshooting](./authentication/troubleshooting.md) | Common authentication issues |

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
32. [Swarm Orchestration & Flyte Operations](#32-swarm-orchestration--flyte-operations)
    - [32.1 System Architecture: The "Deep Swarm"](#321-system-architecture-the-deep-swarm)
    - [32.2 Operational Troubleshooting](#322-operational-troubleshooting)
    - [32.3 Compliance & Security](#323-compliance--security)
33. [Cognitive Platform Enhancements](#33-cognitive-platform-enhancements)
    - [33.1 Strategic Vision: Beyond Task Execution](#331-strategic-vision-beyond-task-execution)
    - [33.2 The Grimoire (Procedural Memory & Self-Correction)](#332-the-grimoire-procedural-memory--self-correction)
    - [33.3 Time-Travel Debugging (Visual Forking)](#333-time-travel-debugging-visual-forking)
    - [33.4 The Economic Governor (Model Arbitrage)](#334-the-economic-governor-model-arbitrage)
    - [33.5 Sentinel Agents (Event-Driven Autonomy)](#335-sentinel-agents-event-driven-autonomy)
    - [33.6 The Council of Rivals (Adversarial Consensus)](#336-the-council-of-rivals-adversarial-consensus)
    - [33.7 Implementation Roadmap](#337-implementation-roadmap)
    - [33.8 Database Schema](#338-database-schema)
    - [33.9 API Reference](#339-api-reference)
    - [33.10 Configuration](#3310-configuration)
    - [33.11 Troubleshooting](#3311-troubleshooting)
34. [Orchestration Methods (70+ Algorithms)](#34-orchestration-methods-70-algorithms)
35. [Polymorphic UI (PROMPT-41)](#35-polymorphic-ui-prompt-41)
    - [35.1 Overview](#351-overview)
    - [35.2 The Gearbox (Elastic Compute)](#352-the-gearbox-elastic-compute)
    - [35.3 The Three Views](#353-the-three-views)
    - [35.4 View Types](#354-view-types)
    - [35.5 Configuration](#355-configuration)
    - [35.6 Implementation Files](#356-implementation-files)
    - [35.7 Database Tables](#357-database-tables)
    - [35.8 API Endpoints](#358-api-endpoints)
36. [Think Tank Policy Framework: Strategic Intelligence](#36-think-tank-policy-framework-strategic-intelligence)
    - [36.1 The Cato Institute Policy Foundation](#361-the-cato-institute-policy-foundation)
    - [36.2 The $10 Trillion Cybercrime Economy](#362-the-10-trillion-cybercrime-economy)
    - [36.3 Memory Safety and the 70% Problem](#363-memory-safety-and-the-70-problem)
    - [36.4 Regulatory Stance Configuration](#364-regulatory-stance-configuration)
    - [36.5 Database Tables](#365-database-tables)
    - [36.6 Implementation Files](#366-implementation-files)
37. [Agentic Orchestration: SSF, CAEP, and Identity Remediation](#37-agentic-orchestration-ssf-caep-and-identity-remediation)
    - [37.1 The Agentic AI Paradigm](#371-the-agentic-ai-paradigm)
    - [37.2 Shared Signals Framework (SSF) Integration](#372-shared-signals-framework-ssf-integration)
    - [37.3 Continuous Access Evaluation Profile (CAEP)](#373-continuous-access-evaluation-profile-caep)
    - [37.4 Autonomous Identity Remediation](#374-autonomous-identity-remediation)
    - [37.5 The Radiant Ghost in Think Tank](#375-the-radiant-ghost-in-think-tank)
    - [37.6 Database Tables](#376-database-tables)
    - [37.7 API Endpoints](#377-api-endpoints)
    - [37.8 Implementation Files](#378-implementation-files)
39. [Liquid Interface (Generative UI)](#39-liquid-interface-generative-ui)
    - [39.1 Overview](#391-overview)
    - [39.2 Architecture](#392-architecture)
    - [39.3 Component Registry](#393-component-registry)
    - [39.4 Ghost State (Two-Way Binding)](#394-ghost-state-two-way-binding)
    - [39.5 Intent Detection](#395-intent-detection)
    - [39.6 Eject to App](#396-eject-to-app)
    - [39.7 Configuration](#397-configuration)
    - [39.8 API Endpoints](#398-api-endpoints)
    - [39.9 Database Tables](#399-database-tables)
    - [39.10 Implementation Files](#3910-implementation-files)
43. [Concurrent Task Execution (Moat #17)](#43-concurrent-task-execution-moat-17)
44. [Structure from Chaos Synthesis (Moat #20)](#44-structure-from-chaos-synthesis-moat-20)
45. [Localization & Translation Overrides](#45-localization--translation-overrides)
46. [Unified AGI Architecture](#46-unified-agi-architecture-brain-genesis-cortex-and-cato-v55229)
47. [Time Machine Administration](#47-time-machine-administration)
48. [Grimoire Administration](#48-grimoire-administration)
49. [Sentinel Agents Administration](#49-sentinel-agents-administration)
50. [Economic Governor Administration](#50-economic-governor-administration)
51. [Flash Facts Administration](#51-flash-facts-administration)
52. [Domain Taxonomy Selector](#52-domain-taxonomy-selector)
53. [Cartridge Indicator Administration](#54-cartridge-indicator-administration)
55. [AXIOM Forge Administration](#55-axiom-forge-administration)
56. [AXIOM Scorers](#56-axiom-scorers)
57. [The Crucible - Tenant Configuration](#section-57-the-crucible---tenant-configuration-v640)
58. [Mid-Level Services (MLS)](#section-58-mid-level-services-mls-v500)
59. [LIVS-M Workflow Management](#59-livs-m-workflow-management-v780)
    - [59.1 Overview](#591-overview)
    - [59.2 Environment Modes](#592-environment-modes)
    - [59.3 Workflow Templates](#593-workflow-templates)
    - [59.4 Code Stub Detection](#594-code-stub-detection-phase-1-hard-reject)
    - [59.5 Sycophancy Breaker](#595-sycophancy-breaker)
    - [59.6 Forensic Critic](#596-forensic-critic-dialectical-verification)
    - [59.7 API Endpoints](#597-api-endpoints)
    - [59.8 Database Tables](#598-database-tables)
    - [59.9 Admin Dashboard Integration](#599-admin-dashboard-integration)
    - [59.10 Best Practices](#5910-best-practices)
    - [59.11 Troubleshooting](#5911-troubleshooting)

---

## 1. Think Tank Admin Features

**Location**: Think Tank Admin App → Dashboard

Think Tank admin features are accessible from the dedicated Think Tank Admin application.

### 1.1 Dashboard Overview (v2.0.0)

The Think Tank Admin dashboard provides platform-level visibility:

```
┌─────────────────────────────────────────────────────────────────┐
│  Think Tank Dashboard                    Welcome back, Admin     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │Active Users│  │Conversations│  │ User Rules │  │API Requests││
│  │    1,234   │  │   45,678   │  │   8,901    │  │   2.3M     ││
│  │  +12.5%    │  │   +8.2%    │  │   +15.3%   │  │   +22.1%   ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│                                                                  │
│  ┌─────────────────────────────────┐  ┌────────────────────────┐│
│  │     System Health               │  │   Platform Stats       ││
│  │  ✓ API Gateway      45ms       │  │   Active Tenants: 85   ││
│  │  ✓ Brain Service   120ms       │  │   Models Active: 42    ││
│  │  ✓ AXIOM Routing    35ms       │  │                        ││
│  │  ✓ Cato Safety      25ms       │  │   [View Analytics]     ││
│  │  ✓ Cortex Memory    80ms       │  │                        ││
│  └─────────────────────────────────┘  └────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────┐  ┌────────────────┐│
│  │         Usage Trends (7 days)           │  │Domain Dist.    ││
│  │    ▄▄▄▄▄                                │  │  Tech: 35%     ││
│  │  ▄▄█████▄▄    Requests                  │  │  Biz:  25%     ││
│  │▄▄█████████▄▄  Tokens                    │  │  Sci:  20%     ││
│  │M  T  W  T  F  S  S                      │  │  Other:20%     ││
│  └─────────────────────────────────────────┘  └────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────┐  ┌────────────────┐│
│  │         Recent Activity                 │  │ Quick Actions  ││
│  │  • Tenant "Acme" activated cartridge   │  │ • Delight      ││
│  │  • New user rules created (15)         │  │ • Domain Modes ││
│  │  • Model routing updated               │  │ • Ego System   ││
│  └─────────────────────────────────────────┘  └────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Dashboard Widgets

| Widget | Description | Data Source |
|--------|-------------|-------------|
| **Metric Cards** | Active users, conversations, rules, requests | `/api/thinktank-admin/dashboard/stats` |
| **System Health** | Service status, latency, uptime | `/api/thinktank-admin/dashboard/health` |
| **Platform Stats** | Tenant counts, model activation | `/api/thinktank-admin/dashboard/stats` |
| **Usage Trends** | 7-day request/token chart | `/api/thinktank-admin/dashboard/trends` |
| **Domain Distribution** | Query topic pie chart | `/api/thinktank-admin/dashboard/domains` |
| **Activity Feed** | Recent platform events | `/api/thinktank-admin/dashboard/activity` |
| **Quick Actions** | Links to common admin tasks | Static |

### 1.3 Available Sections

| Section | Purpose |
|---------|---------|
| **Dashboard** | Platform overview and metrics |
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

Multi-user collaboration in Think Tank with novel enhanced features.

### 9.1 Core Features

- **Shared Conversations**: Real-time collaborative chat sessions
- **Real-time Co-editing**: Live presence indicators, cursors, typing status
- **Team Workspaces**: Organize sessions by team/project
- **Permission Management**: Viewer, Commenter, Editor roles

### 9.2 Enhanced Collaboration (v4.18.0+)

#### 9.2.1 Cross-Tenant Guest Access

Allow collaborators from outside your organization to join sessions.

| Feature | Description |
|---------|-------------|
| **Guest Invites** | Generate shareable invite links with permissions |
| **Permission Levels** | viewer, commenter, editor for guests |
| **Expiring Links** | Set expiration time (default: 7 days) |
| **Max Uses** | Limit how many times a link can be used |
| **Viral Tracking** | Track referrals and guest-to-paid conversions |

**API Endpoints:**
- `POST /api/thinktank/collaboration/invites` - Create guest invite
- `GET /api/thinktank/collaboration/invites/:token` - Validate invite
- `POST /api/thinktank/collaboration/guests/join` - Join as guest

#### 9.2.2 AI Facilitator Mode

An AI moderator that guides collaborative sessions.

| Setting | Description |
|---------|-------------|
| **Session Objective** | What the session should accomplish |
| **Facilitator Persona** | professional, casual, academic, creative, socratic, coach |
| **Auto-Summarize** | Periodically summarize discussion |
| **Auto Action Items** | Extract action items from conversation |
| **Ensure Participation** | Prompt quiet participants to contribute |
| **Keep On-Topic** | Redirect off-topic discussions |

**Intervention Types:**
- `summary` - Periodic summaries
- `question` - Probing questions to deepen discussion
- `redirect` - Steer back to topic
- `encourage` - Encourage participation
- `clarify` - Ask for clarification
- `synthesize` - Combine different viewpoints
- `conclude` - Wrap up discussion points

#### 9.2.3 Branch & Merge Conversations

Explore alternative discussion paths without losing the main thread.

| Feature | Description |
|---------|-------------|
| **Create Branch** | Fork conversation at any point |
| **Exploration Hypothesis** | Document what the branch explores |
| **Branch Status** | active, merged, abandoned |
| **Merge Request** | Propose merging insights back to main |
| **AI Summary** | Auto-generated summary of branch conclusions |

**Merge Request Workflow:**
1. Create branch with hypothesis
2. Explore alternative direction
3. Submit merge request with conclusion
4. Participants vote to approve/reject
5. Merged insights appear in main conversation

#### 9.2.4 Time-Shifted Playback

Asynchronous participation through session recordings.

| Feature | Description |
|---------|-------------|
| **Session Recording** | Record full session with events |
| **Playback Controls** | Play, pause, speed (0.5x-2x), seek |
| **AI Key Moments** | Auto-detected important moments |
| **Async Annotations** | Add comments at specific timestamps |
| **Media Notes** | Voice/video annotations stored in S3 |

**Recording Types:**
- `full` - Complete session recording
- `highlights` - AI-curated key moments only
- `summary` - AI-generated session summary

#### 9.2.5 AI Roundtable (Multi-Model Debate)

Multiple AI models debate a topic and synthesize insights.

| Setting | Description |
|---------|-------------|
| **Topic** | The subject of debate |
| **Debate Style** | collaborative, adversarial, socratic, brainstorm, devils_advocate |
| **Max Rounds** | Number of debate rounds (default: 5) |
| **Time Limit** | Per-round time limit in seconds |
| **Synthesis Model** | Model that synthesizes final conclusions |

**Participating Models:**
Each model can have a persona and role:
- `persona` - Character the model adopts
- `role` - Function in the debate (analyst, critic, synthesizer)
- `color` - Visual identifier in UI

**Output:**
- Per-model contributions with responding_to references
- Final synthesis with consensus points
- Disagreement points highlighted
- Actionable recommendations

#### 9.2.6 Shared Knowledge Graph

Visualize collective understanding as an interactive graph.

| Node Type | Description |
|-----------|-------------|
| `concept` | Abstract idea or topic |
| `fact` | Verified information |
| `question` | Open question |
| `decision` | Decision made |
| `action_item` | Task to complete |
| `person` | Person mentioned |
| `resource` | External resource |

**Edge Types:**
- `relates_to` - General relationship
- `supports` - Evidence supporting
- `contradicts` - Conflicting information
- `leads_to` - Causal relationship
- `depends_on` - Dependency
- `answers` - Answer to question
- `part_of` - Component relationship

**AI Features:**
- Auto-extract nodes from conversation
- Suggest missing connections
- Identify knowledge gaps
- Generate graph-based summaries

### 9.3 Attachment Storage

Large attachments are stored in S3 with automatic cleanup.

| Setting | Default | Description |
|---------|---------|-------------|
| `maxFileSizeMb` | 100 | Maximum file size |
| `allowedTypes` | image/*, video/*, audio/*, application/pdf | Allowed MIME types |
| `retentionDays` | 90 | Days before cleanup |

**S3 Bucket:** `radiant-collaboration-assets` (configurable via env)

**Cleanup:** Database triggers automatically delete S3 objects when attachment records are deleted.

### 9.4 Admin Configuration

| Setting | Description |
|---------|-------------|
| `enableGuestAccess` | Allow cross-tenant guests |
| `maxGuestsPerSession` | Maximum guests per session |
| `defaultGuestPermission` | Default permission for guests |
| `enableFacilitator` | Enable AI facilitator feature |
| `enableBranching` | Enable branch & merge |
| `enableRecordings` | Enable session recordings |
| `enableRoundtable` | Enable AI roundtable |
| `enableKnowledgeGraph` | Enable knowledge graph |

### 9.5 Database Tables

| Table | Purpose |
|-------|---------|
| `collaboration_guest_invites` | Guest invite tokens |
| `collaboration_guests` | Guest participants |
| `collaboration_facilitator_config` | AI facilitator settings |
| `collaboration_facilitator_interventions` | Facilitator actions log |
| `collaboration_branches` | Conversation branches |
| `collaboration_merge_requests` | Branch merge proposals |
| `collaboration_recordings` | Session recordings |
| `collaboration_media_notes` | Voice/video annotations |
| `collaboration_async_annotations` | Async comments |
| `collaboration_ai_roundtables` | Multi-model debates |
| `collaboration_roundtable_contributions` | Model contributions |
| `collaboration_knowledge_graphs` | Knowledge graphs |
| `collaboration_knowledge_nodes` | Graph nodes |
| `collaboration_knowledge_edges` | Graph edges |
| `collaboration_attachments` | File attachments |

### 9.6 UI Components

**Location:** `apps/admin-dashboard/components/collaboration/`

| Component | Purpose |
|-----------|---------|
| `EnhancedCollaborativeSession.tsx` | Main session container |
| `panels/ChatPanel.tsx` | Real-time chat interface |
| `panels/BranchPanel.tsx` | Branch management |
| `panels/RoundtablePanel.tsx` | AI roundtable interface |
| `panels/KnowledgeGraphPanel.tsx` | Graph visualization |
| `panels/PlaybackPanel.tsx` | Recording playback |
| `ParticipantsSidebar.tsx` | Participant list with presence |
| `dialogs/InviteDialog.tsx` | Guest invite creation |
| `dialogs/FacilitatorSettingsDialog.tsx` | AI facilitator config |

**Routes:**
- `/thinktank/collaborate/enhanced?session={id}` - Enhanced session view
- `/collaborate/join/{token}` - Guest join page

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

## 12.5 LIVS-M 2.0 Policy Configuration (v7.9.0)

**Location**: Admin Dashboard → Think Tank Admin → LIVS-M Policy

LIVS-M 2.0 is the "Defcon-style" governance system that controls how strictly AI outputs are verified across Think Tank.

### 12.5.1 Policy Modes

Administrators can set the default policy mode for their tenant:

| Mode | Internal Code | Behavior |
|------|---------------|----------|
| **Brainstorming** | `RAPID_PROTO` | Accepts partial code, stubs, rough ideas. Warnings logged but don't block. |
| **Standard** | `ENGINEERING` | Code must run. Stubs rejected if breaking. Tests encouraged. **(Default)** |
| **Strict Audit** | `STRICT_AUDIT` | No stubs. No mock data. Mandatory tests. Sycophancy triggers Devil's Advocate. |

### 12.5.2 Advanced Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Sycophancy Detection** | Detect when AI agents agree too quickly | On |
| **Stub Rejection** | Reject placeholder implementations | On |
| **Chaos Injection** | Inject Devil's Advocate when consensus is too fast | On |
| **Mock Data Detection** | Reject mock/fake data in outputs | On |
| **Max Consensus Velocity** | Turns before chaos injection (1-10) | 3 |

### 12.5.3 Mode Selection Guidelines

| Use Case | Recommended Mode |
|----------|------------------|
| Hackathons & MVP planning | Brainstorming |
| Daily sprint work | Standard |
| Production releases | Strict Audit |
| Security-sensitive changes | Strict Audit |
| Creative exploration | Brainstorming |
| Code reviews before deploy | Strict Audit |

### 12.5.4 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/livs/policy` | GET | Get current policy configuration |
| `/api/admin/livs/policy` | PUT | Update policy mode and settings |
| `/api/admin/livs/metrics` | GET | Get policy evaluation metrics |
| `/api/admin/livs/history` | GET | Get policy change history |

### 12.5.5 Tenant Override

Individual users cannot change the policy mode - it is set at the tenant level by administrators. This ensures consistent governance across the organization.

### 12.5.6 Version Management (v7.9.0+)

LIVS-M includes built-in version management, allowing administrators to track and upgrade their policy registry versions.

#### Version Indicators

| UI Element | Description |
|------------|-------------|
| **Version Badge** | Shows current installed version in header (e.g., "v2.0.0") |
| **UPDATE Badge** | Green pulsing badge on LIVS-M Policy nav item when update available |
| **Updates Tab** | Dedicated tab showing version info, changelog, and upgrade button |

#### Checking for Updates

1. Navigate to **Admin Dashboard → Think Tank Admin → LIVS-M Policy**
2. Look for the green "UPDATE" badge on the navigation item
3. Click the **Updates** tab to see:
   - Current version vs. latest version
   - Changelog with new features
   - Breaking changes warnings (if applicable)
   - Migration requirements (if applicable)

#### Performing Upgrades

1. Review the changelog carefully
2. Note any breaking changes or migration requirements
3. Click **Upgrade to vX.X.X** button
4. Wait for the upgrade to complete (database migrations run automatically)
5. Verify the new version badge displays correctly

#### Version API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/livs/version` | GET | Get current tenant version state |
| `/api/admin/livs/version/check` | GET | Check for available updates |
| `/api/admin/livs/version/upgrade` | POST | Upgrade to latest version |
| `/api/admin/livs/version/history` | GET | Get upgrade history |

#### Database Tables

| Table | Purpose |
|-------|---------|
| `livs_tenant_version` | Tracks installed LIVS-M version per tenant |
| `livs_version_upgrades` | Audit log of all upgrade events |

#### Best Practices

- **Schedule upgrades during maintenance windows** for production environments
- **Review breaking changes** before upgrading - they may require policy adjustments
- **Test in staging first** if your organization has a staging tenant
- **Monitor metrics** after upgrade to ensure policy evaluation behaves as expected

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

#### CBF Violations Heatmap (v5.52.1)

The CBF Violations Heatmap provides visual analytics of Content Boundary Framework rule violations:

**Features:**
- **Category Grouping** - Violations grouped by category (content_safety, data_privacy, pii_detection, etc.)
- **Severity Indicators** - Color-coded badges (low/medium/high/critical)
- **Trend Arrows** - Show if violations are increasing or decreasing
- **Intensity Gradient** - Cell brightness indicates violation frequency
- **Time Range Filter** - Filter by last 24 hours, 7 days, 30 days, or 90 days
- **Click-to-Drill** - Click any rule to see detailed violation history

**Category Icons:**
| Category | Icon | Description |
|----------|------|-------------|
| `content_safety` | 🛡️ | General content safety violations |
| `data_privacy` | 🔒 | Data privacy concerns |
| `pii_detection` | 👤 | Personal information detected |
| `harmful_content` | ⚠️ | Potentially harmful content |
| `bias_detection` | ⚖️ | Bias in responses |
| `jailbreak` | 🔓 | Jailbreak attempts blocked |
| `prompt_injection` | 💉 | Prompt injection attempts |

**API Endpoint:** `GET /api/admin/analytics/cbf-violations?range={timeRange}`

**Response:**
```json
{
  "violations": [
    {
      "ruleId": "cbf-001",
      "ruleName": "PII Detection",
      "category": "pii_detection",
      "count": 145,
      "severity": "high",
      "trend": "down"
    }
  ]
}
```

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

## 32. Swarm Orchestration & Flyte Operations

**Version:** v4.19.2  
**Status:** Production Ready

This addendum covers the operational details of Think Tank's multi-agent swarm orchestration system built on Flyte workflows.

### 32.1 System Architecture: The "Deep Swarm"

Think Tank v4.19.2 replaces serial execution with **Dynamic Workflow Parallelism**.

#### 32.1.1 "Scatter-Gather" Pattern

| Aspect | Old Behavior | New Behavior |
|--------|--------------|--------------|
| **Execution** | Agents ran sequentially (Agent A → Agent B) | Orchestrator spawns a `@dynamic` node for every agent |
| **Isolation** | Blocked agents blocked everything | Blocked agents release compute (Pod spins down) while others continue |
| **Scalability** | O(n) time complexity | O(1) effective time for parallel agents |

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCATTER-GATHER PATTERN                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                      ┌─────────────┐                            │
│                      │ Orchestrator │                            │
│                      └──────┬──────┘                            │
│                             │                                    │
│              ┌──────────────┼──────────────┐                    │
│              │              │              │                    │
│              ▼              ▼              ▼                    │
│        ┌─────────┐    ┌─────────┐    ┌─────────┐               │
│        │ Agent A │    │ Agent B │    │ Agent C │  ← SCATTER    │
│        │ (Legal) │    │ (Domain)│    │ (Fact)  │               │
│        └────┬────┘    └────┬────┘    └────┬────┘               │
│             │              │              │                     │
│             │    ┌─────────┴─────────┐    │                     │
│             │    │  HITL Wait Here   │    │  ← Non-blocking     │
│             │    │  (Pod Released)   │    │                     │
│             │    └─────────┬─────────┘    │                     │
│             │              │              │                     │
│             └──────────────┼──────────────┘                    │
│                            ▼                                    │
│                      ┌─────────┐                                │
│                      │Synthesize│  ← GATHER                     │
│                      └─────────┘                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 32.1.2 S3 Bronze Layer Offloading (Critical Change)

> ⚠️ **Breaking Change**: Think Tank no longer accepts raw JSON payloads to prevent gRPC payload limits (~4MB) from crashing workflows with large RAG contexts.

**New Flow:**
```
Radiant API → Upload to S3 → Pass s3_uri to Flyte → Flyte Hydrates Data
```

**Storage Location:**
```
s3://radiant-bronze/flyte-inputs/{tenant_id}/{swarm_id}/
```

**Admin Action Required:**

When debugging a failed workflow in the Flyte Console:

1. **DO NOT** look for inputs in the "Inputs" tab (it only contains the `s3_uri`)
2. Copy the `s3_uri` from the workflow inputs
3. Download the JSON file from AWS S3 to inspect the actual payload

```bash
# Download input payload for debugging
aws s3 cp s3://radiant-bronze/flyte-inputs/{tenant_id}/{swarm_id}/input.json ./debug-input.json
cat ./debug-input.json | jq .
```

### 32.2 Operational Troubleshooting

This release includes fixes for 3 critical stability issues ("Silent Killers"). Use this guide to diagnose production anomalies.

#### 32.2.1 "Stuck" Workflows (Signal Mismatch)

| Aspect | Details |
|--------|---------|
| **Symptom** | Workflow is `RUNNING` but UI shows "Approved" |
| **Root Cause** | Signal ID sent by API does not match ID the workflow is waiting for |

**Diagnosis Steps:**

1. **Verify Signal Format**: Must be `human_decision_{decision_id}`
   
2. **Check Database**:
   ```sql
   SELECT id, flyte_execution_id, flyte_node_id 
   FROM pending_decisions 
   WHERE status = 'pending' 
   AND tenant_id = '<TENANT_ID>';
   ```

3. **Cross-Reference Flyte**: The `flyte_node_id` must match the node in the Flyte execution graph

**Resolution:**

If deadlocked, terminate the workflow via Flyte Console:
```bash
flytectl delete execution <EXECUTION_ID> \
  --project radiant \
  --domain production
```

#### 32.2.2 "Zombie" Cache

| Aspect | Details |
|--------|---------|
| **Symptom** | User rejects a plan, retries, and AI immediately returns the same rejected plan without thinking |
| **Root Cause** | Flyte caching returning stale results |

**Verification:**

Ensure `think_tank_workflow.py` has the correct decorator:

```python
# ✅ CORRECT - Forces fresh execution
@dynamic(cache=False)
def execute_swarm(agents: List[AgentConfig], task_data: TaskData) -> List[AgentResult]:
    ...

# ❌ WRONG - Will return cached (potentially rejected) results
@dynamic
def execute_swarm(agents: List[AgentConfig], task_data: TaskData) -> List[AgentResult]:
    ...
```

**Files to Check:**
- `packages/flyte/workflows/think_tank_workflow.py`

#### 32.2.3 Emergency Manual Intervention

If the API layer is unavailable, Admins can manually unblock a workflow using `flytectl`:

```bash
flytectl update execution <EXECUTION_ID> \
  --project radiant \
  --domain production \
  --signal-id "human_decision_<DECISION_ID>" \
  --signal-value '{"resolution": "approved", "guidance": "Emergency Override via CLI"}'
```

**Signal Value Schema:**
```json
{
  "resolution": "approved" | "rejected" | "modified",
  "guidance": "string - guidance for AI refinement",
  "resolved_by": "admin-user-id",
  "resolved_at": "2026-01-07T12:00:00Z"
}
```

### 32.3 Compliance & Security

#### 32.3.1 Tenant Isolation (Strict RLS)

> ⚠️ **Warning for DB Admins**: All tables are protected by Row-Level Security. Running a standard `SELECT *` as a superuser might return 0 rows or trigger an error depending on your client config.

**Correct Query Pattern:**

To query data manually, you must set the Tenant Context for your session:

```sql
BEGIN;
-- Must match a valid tenant UUID
SET app.tenant_id = '123e4567-e89b-12d3-a456-426614174000'; 

SELECT * FROM pending_decisions;

COMMIT;
-- Or use RESET to clear context
RESET app.tenant_id;
```

**Protected Tables:**
- `pending_decisions`
- `decision_audit`
- `decision_domain_config`
- `websocket_connections`

#### 32.3.2 Audit Log Export

To export the decision audit trail for SOC2/HIPAA evidence:

```sql
SELECT 
    da.created_at,
    da.actor_id,
    da.actor_type,
    da.action,
    da.details->>'resolution' as resolution,
    da.details->>'guidance' as guidance,
    pd.domain,
    pd.question
FROM decision_audit da
JOIN pending_decisions pd ON da.decision_id = pd.id
WHERE da.tenant_id = '<TENANT_ID>'
AND da.created_at > NOW() - INTERVAL '30 days'
ORDER BY da.created_at DESC;
```

**Export to CSV:**
```bash
psql "$DATABASE_URL" -c "COPY (
  SELECT 
    created_at, 
    actor_id, 
    action, 
    details->>'resolution' as resolution, 
    details->>'guidance' as guidance 
  FROM decision_audit 
  WHERE tenant_id = '<TENANT_ID>' 
  AND created_at > NOW() - INTERVAL '30 days'
) TO STDOUT WITH CSV HEADER" > audit_export.csv
```

#### 32.3.3 PHI Sanitization

All decision content is sanitized before human review to prevent PHI exposure:

| Pattern | Replacement |
|---------|-------------|
| SSN (XXX-XX-XXXX) | `[SSN REDACTED]` |
| Email addresses | `[EMAIL REDACTED]` |
| Phone numbers | `[PHONE REDACTED]` |
| Credit card numbers | `[CC REDACTED]` |
| Medical Record Numbers | `[MRN REDACTED]` |
| ZIP codes (5-digit) | `[ZIP REDACTED]` |

**Disable Sanitization** (requires tenant config):
```sql
UPDATE decision_domain_config 
SET sanitize_phi = false 
WHERE tenant_id = '<TENANT_ID>' 
AND domain = 'general';
```

> ⚠️ **Warning**: Disabling PHI sanitization may violate HIPAA compliance. Only disable for non-healthcare tenants.

### 32.4 Related Sections

| Section | Relevance |
|---------|-----------|
| [RADIANT Admin Guide - Section 48](./RADIANT-ADMIN-GUIDE.md#48-mission-control-human-in-the-loop-hitl-system) | Full Mission Control architecture |
| [RADIANT Admin Guide - Section 47](./RADIANT-ADMIN-GUIDE.md#47-flyte-native-state-management) | Flyte state management |
| [RADIANT Admin Guide - Section 42](./RADIANT-ADMIN-GUIDE.md#42-genesis-cato-safety-architecture) | Cato safety integration |
| [Section 30 - COS](#30-consciousness-operating-system-cos) | SOFAI routing |

---

## 33. Cognitive Platform Enhancements

> **From Modern Orchestrator to Category-Defining Cognitive Platform**
> 
> Version: 4.20.0 | Status: Strategic Roadmap

This section documents five strategic enhancements that transform Think Tank from a task execution engine into a self-evolving cognitive platform with an unassailable competitive moat.

### 33.1 Strategic Vision: Beyond Task Execution

#### The Fundamental Shift

Most AI orchestration engines (LangChain, AutoGen, Enterprise Copilots) are **stateless**: they solve a problem, reset, and solve it again from scratch. They suffer from "Goldfish Memory."

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATION PARADIGM COMPARISON                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   TRADITIONAL (Stateless)              RADIANT (Cognitive)                  │
│   ========================             ====================                  │
│                                                                              │
│   Task → Solve → Reset                 Task → Solve → LEARN → Evolve        │
│        ↓                                     ↓                               │
│   Task → Solve → Reset                 Next Task (with accumulated skills)  │
│        ↓                                     ↓                               │
│   Task → Solve → Reset                 System becomes expert over time      │
│                                                                              │
│   ❌ No memory between runs            ✅ Procedural memory persists        │
│   ❌ Same mistakes repeated            ✅ Self-correction from errors       │
│   ❌ Flat cost curve                   ✅ Decreasing cost over time         │
│   ❌ Reactive only                     ✅ Proactive monitoring              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### The Five Strategic Moats

| Enhancement | Category | Impact | Competitive Advantage |
|-------------|----------|--------|----------------------|
| **Economic Governor** | Cost Optimization | -40% API costs | Immediate ROI |
| **The Grimoire** | Procedural Memory | +60% accuracy over time | Lock-in effect |
| **Time-Travel** | Developer Experience | -80% debug time | Power user magnet |
| **Sentinels** | Autonomous Agents | New revenue stream | Market expansion |
| **Council of Rivals** | Quality Assurance | -90% hallucinations | Trust differentiator |

---

### 33.2 The Grimoire (Procedural Memory & Self-Correction)

#### Problem Statement

If an agent struggles to write a valid SQL query for your schema today, it will struggle again tomorrow. RAG provides *facts*, but it doesn't provide *skills*. Current systems have:

- **No skill retention** between sessions
- **Repeated mistakes** on similar tasks
- **No personalization** to tenant-specific patterns
- **Static performance** regardless of usage volume

#### Solution: Write-Back Procedural Memory

The Grimoire is a tenant-isolated knowledge graph that captures **learned heuristics** from successful task executions, making the system smarter with every interaction.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THE GRIMOIRE ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐      │
│   │ Swarm       │────▶│ The Librarian    │────▶│ Knowledge Graph     │      │
│   │ Execution   │     │ (Background)     │     │ (Procedural Memory) │      │
│   └─────────────┘     └──────────────────┘     └─────────────────────┘      │
│         │                     │                          │                   │
│         │                     ▼                          │                   │
│         │            ┌──────────────────┐                │                   │
│         │            │ Heuristic        │                │                   │
│         │            │ Extraction       │                │                   │
│         │            │ • Pattern Match  │                │                   │
│         │            │ • Success Signal │                │                   │
│         │            │ • Context Tags   │                │                   │
│         │            └──────────────────┘                │                   │
│         │                                                ▼                   │
│         │                                      ┌─────────────────────┐      │
│         └─────────────────────────────────────▶│ Future Agent Spawn  │      │
│                     Query Grimoire             │ (Pre-loaded Skills) │      │
│                                                └─────────────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### The Librarian Service

A background agent that analyzes every completed Flyte execution trace:

```typescript
interface LearnedHeuristic {
  id: string;
  tenantId: string;
  category: 'sql_pattern' | 'api_usage' | 'code_style' | 'domain_knowledge' | 'user_preference';
  trigger: string;           // When to apply this heuristic
  heuristic: string;         // The learned rule
  confidence: number;        // 0.0 - 1.0
  sourceExecutionId: string; // Flyte execution that taught this
  successCount: number;      // Times this heuristic led to success
  failureCount: number;      // Times this heuristic led to failure
  lastApplied: Date;
  tags: string[];
  embedding: number[];       // Vector for semantic search
}

// Example learned heuristics:
const exampleHeuristics = [
  {
    category: 'sql_pattern',
    trigger: 'querying sales table',
    heuristic: 'Always filter by is_deleted = false when querying the sales table',
    confidence: 0.95,
    tags: ['sql', 'sales', 'soft-delete']
  },
  {
    category: 'user_preference', 
    trigger: 'generating Python code for user_123',
    heuristic: 'User prefers fully typed Python with dataclasses over dicts',
    confidence: 0.88,
    tags: ['python', 'typing', 'user_123']
  },
  {
    category: 'domain_knowledge',
    trigger: 'medical terminology in oncology',
    heuristic: 'TNM staging must specify edition (e.g., AJCC 8th edition)',
    confidence: 0.92,
    tags: ['medical', 'oncology', 'staging']
  }
];
```

#### Confidence Decay & Reinforcement

Heuristics evolve based on application outcomes:

| Event | Confidence Change |
|-------|-------------------|
| **Successful application** | +0.02 (max 0.99) |
| **Failed application** | -0.05 (min 0.30) |
| **Weekly decay (unused)** | -0.01 |
| **User correction** | New heuristic at 0.95 |
| **Below 0.30** | Auto-archived |

#### Admin UI: Grimoire Management

**Location**: Admin Dashboard → Think Tank → Grimoire

| Tab | Description |
|-----|-------------|
| **Heuristics Browser** | Search, filter, and view all learned heuristics |
| **Confidence Tuning** | Adjust confidence thresholds and decay rates |
| **Category Management** | Enable/disable heuristic categories |
| **Audit Trail** | View heuristic application history |
| **Manual Entry** | Add expert heuristics manually |

#### Grimoire API Reference

```
Base: /api/thinktank/grimoire

GET    /heuristics              List heuristics with filtering
GET    /heuristics/:id          Get heuristic with application history
POST   /heuristics              Manually add a heuristic
PATCH  /heuristics/:id          Update confidence/enabled status
DELETE /heuristics/:id          Remove heuristic
GET    /stats                   Grimoire statistics
POST   /heuristics/bulk         Bulk import heuristics
```

---

### 33.3 Time-Travel Debugging (Visual Forking)

#### Problem Statement

An agent runs for 20 minutes, succeeds at 9 steps, but fails on step 10 due to a vague instruction. In current systems:

- You must **restart from Step 1**, wasting time and money
- **No way to edit** the context at a specific point
- **Lost compute costs** for successful early steps
- **Poor debugging experience** for complex workflows

#### Solution: DVR Interface with Checkpoint Forking

Leverage Flyte's native checkpointing to build a time-travel debugging experience:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     TIME-TRAVEL DEBUGGING INTERFACE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Execution: think_tank_swarm_abc123                                        │
│   Status: FAILED at Step 10    │    Total Duration: 18:42                   │
│                                                                              │
│   ──●────●────●────●────●────●────●────●────●────✗──────────────────────    │
│     1    2    3    4    5    6    7    8    9   10                          │
│     ✓    ✓    ✓    ✓    ✓    ✓    ✓    ✓    ✓    ✗                          │
│                              ▲                                               │
│                        [Timeline Slider]                                     │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ Step 6: Code Generation                                              │   │
│   │ Duration: 2:34  │  Model: claude-3-5-sonnet  │  Cost: $0.08          │   │
│   │                                                                      │   │
│   │ Input Context: "Generate a Python function to calculate..."          │   │
│   │ Output: def calculate_quarterly_revenue(transactions):...            │   │
│   │                                                                      │   │
│   │ [Edit Context]  [Fork From Here]  [View Full Trace]                 │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Fork Execution Service

```typescript
interface ForkRequest {
  originalExecutionId: string;
  forkFromNodeId: string;
  contextModifications: {
    systemPromptAppend?: string;
    userPromptReplace?: string;
    variableOverrides?: Record<string, unknown>;
    modelOverride?: string;
  };
  forkedBy: string;
  reason?: string;
}

interface ForkResult {
  forkedExecutionId: string;
  forkedFromNode: string;
  estimatedSavings: {
    timeMinutes: number;
    costUsd: number;
    tokensSkipped: number;
  };
  status: 'launched' | 'pending_approval';
}
```

#### Admin UI: Time-Travel Debugger

**Location**: Admin Dashboard → Think Tank → Executions → [Select] → Time Travel

| Feature | Description |
|---------|-------------|
| **Timeline View** | Visual representation of execution nodes with status |
| **Node Inspector** | View input/output, model, tokens, cost for each node |
| **Context Editor** | Modify system prompt, user prompt, variables |
| **Fork Button** | Create new execution from selected checkpoint |
| **Comparison View** | Side-by-side diff of original vs forked execution |
| **Savings Calculator** | Real-time estimate of time/cost savings |

#### Time-Travel API Reference

```
Base: /api/thinktank/time-travel

GET  /executions/:id/timeline              Get execution timeline with checkpoints
GET  /executions/:id/checkpoints/:nodeId   Get checkpoint details
POST /executions/:id/checkpoints/:nodeId/preview   Preview modifications
POST /executions/:id/fork                  Fork execution from checkpoint
GET  /executions/:originalId/compare/:forkedId     Compare executions
GET  /executions/:id/forks                 Get fork history
```

---

### 33.4 The Economic Governor (Model Arbitrage)

#### Problem Statement

- Using **GPT-4o for every sub-task** is financially ruinous
- Using **Llama-3-8b for everything** leads to errors
- **No visibility** into which tasks need expensive models
- **Flat cost curve** regardless of task complexity

#### Solution: Predictive Cost Routing

A "System 0" pre-dispatch analysis that routes tasks to the optimal model based on complexity:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ECONOMIC GOVERNOR ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────┐    ┌───────────────────┐    ┌─────────────────────────────┐  │
│   │ Incoming │───▶│ System 0          │───▶│ Model Router                │  │
│   │ Task     │    │ (Complexity       │    │                             │  │
│   └──────────┘    │  Estimator)       │    │  Score 1-3 → Haiku/Llama    │  │
│                   │                   │    │  Score 4-7 → Sonnet/GPT-4o-m│  │
│                   │  • Token count    │    │  Score 8-10 → Opus/O1       │  │
│                   │  • Task type      │    │                             │  │
│                   │  • Domain         │    └─────────────────────────────┘  │
│                   │  • History        │                  │                   │
│                   └───────────────────┘                  ▼                   │
│                           │                   ┌─────────────────────────┐   │
│                           ▼                   │ Savings Tracker         │   │
│                   ┌───────────────────┐       │ "Saved $4.20 via smart  │   │
│                   │ Complexity Score  │       │  routing this query"    │   │
│                   │ (1-10)            │       └─────────────────────────┘   │
│                   └───────────────────┘                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Complexity Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| **Prompt Length** | 15% | Token count estimate |
| **Task Type** | 25% | Summarization (2) → Multi-step reasoning (9) |
| **Domain** | 20% | General (3) → Medical/Scientific (8) |
| **Keywords** | 20% | Complexity indicator words |
| **Structure** | 20% | Code blocks, lists, nested requirements |

#### Model Tier Mapping

| Tier | Score Range | Models | Use Cases |
|------|-------------|--------|-----------|
| **Economy** | 1-3 | Haiku, GPT-4o-mini, Llama-3-8b | Simple Q&A, summarization |
| **Standard** | 4-7 | Sonnet, GPT-4o | Code generation, analysis |
| **Premium** | 8-10 | Opus, O1-preview | Complex reasoning, planning |

#### Admin UI: Economic Governor Dashboard

**Location**: Admin Dashboard → Think Tank → Economic Governor

| Panel | Description |
|-------|-------------|
| **Savings Overview** | Total savings this period, trend chart |
| **Model Distribution** | Pie chart of model usage by tier |
| **Complexity Histogram** | Distribution of task complexity scores |
| **Routing Rules** | Configure tier thresholds and overrides |
| **Budget Alerts** | Set spending alerts and caps |

#### Economic Governor API Reference

```
Base: /api/thinktank/economic-governor

GET  /savings?period=month          Get savings dashboard
GET  /routing-rules                 Get current routing rules
PUT  /routing-rules                 Update routing configuration
POST /analyze-complexity            Analyze specific task complexity
GET  /model-usage                   Get model usage breakdown
POST /budget-alert                  Configure budget alerts
```

#### Configuration Options

```typescript
interface EconomicGovernorConfig {
  economyThreshold: number;       // Default: 3
  standardThreshold: number;      // Default: 7
  forceModelOverrides: {
    [taskType: string]: string;   // e.g., "legal_analysis" → "opus"
  };
  budgetCap: {
    daily: number;
    monthly: number;
  };
  alertThresholds: {
    warningPercent: number;       // Default: 80
    criticalPercent: number;      // Default: 95
  };
}
```

---

### 33.5 Sentinel Agents (Event-Driven Autonomy)

#### Problem Statement

Current agents are **reactive only**—they wait for user input. A true cognitive platform should be **proactive**:

- **No autonomous monitoring** capabilities
- **No long-lived workflows** that persist between sessions
- **No event-driven triggers** for automated responses
- **Missed opportunities** for preventive action

#### Solution: Long-Lived Hibernating Workflows

Allow agents to set up persistent monitors that wake up when conditions are met:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SENTINEL AGENT ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   User: "Monitor server logs. If Error 500 spikes, analyze and alert me."   │
│                                                                              │
│   1. SETUP PHASE                                                             │
│   ┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐            │
│   │ Parse       │───▶│ Generate        │───▶│ Configure        │            │
│   │ Instruction │    │ EventBridge     │    │ Hibernate State  │            │
│   └─────────────┘    │ Rule            │    └──────────────────┘            │
│                      └─────────────────┘             │                       │
│                                                      ▼                       │
│   2. HIBERNATION PHASE (Days/Weeks/Months)                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  Flyte Workflow: HIBERNATE state (wait_for_signal)                   │   │
│   │  • Zero compute cost while waiting                                   │   │
│   │  • State preserved in S3                                             │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                              │ Event Fires!                                  │
│                              ▼                                               │
│   3. REHYDRATION PHASE                                                       │
│   ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐          │
│   │ EventBridge     │───▶│ Signal Lambda   │───▶│ Workflow       │          │
│   │ Triggers        │    │ Sends Signal    │    │ Resumes        │          │
│   └─────────────────┘    └─────────────────┘    └────────────────┘          │
│                                                         │                    │
│   4. ANALYSIS & ALERT PHASE                             ▼                    │
│   ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐          │
│   │ Pull Latest     │───▶│ Swarm Analysis  │───▶│ Alert User     │          │
│   │ Context         │    │ (Root Cause)    │    │ via Slack/SMS  │          │
│   └─────────────────┘    └─────────────────┘    └────────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Sentinel Trigger Types

| Type | Description | Example |
|------|-------------|---------|
| **cloudwatch_alarm** | AWS CloudWatch alarm state change | CPU > 90% |
| **eventbridge_pattern** | Custom EventBridge event pattern | CodePipeline failure |
| **webhook** | External HTTP webhook | GitHub push |
| **schedule** | Cron or rate expression | Every hour |
| **metric_threshold** | Custom metric threshold | Error rate > 5% |

#### Sentinel Action Types

| Type | Description | Example |
|------|-------------|---------|
| **swarm_analysis** | Run AI swarm for analysis | Root cause analysis |
| **notification** | Send alert via channels | Slack + Email |
| **remediation** | Execute automated fix | Scale up instances |
| **custom_workflow** | Launch custom Flyte workflow | Data pipeline |

#### Admin UI: Sentinel Management

**Location**: Admin Dashboard → Think Tank → Sentinels

| Tab | Description |
|-----|-------------|
| **Active Sentinels** | List of hibernating sentinels with status |
| **Create Sentinel** | Natural language sentinel configuration |
| **Trigger History** | Log of all sentinel activations |
| **Analytics** | Sentinel effectiveness metrics |

#### Sentinel API Reference

```
Base: /api/thinktank/sentinels

GET    /                           List all sentinels
POST   /                           Create new sentinel (natural language)
GET    /:id                        Get sentinel details
PATCH  /:id                        Update sentinel (pause/resume)
DELETE /:id                        Delete sentinel and EventBridge rule
GET    /:id/triggers               Get trigger history
POST   /:id/test                   Test sentinel with mock event
GET    /analytics                  Sentinel effectiveness metrics
```

#### Example Sentinel Configurations

```typescript
// Monitor for deployment failures
{
  name: "Deployment Monitor",
  triggerInstruction: "Watch for failed CodePipeline deployments",
  actionInstruction: "Analyze the failure logs and suggest fixes, then alert #devops on Slack"
}

// Proactive cost monitoring
{
  name: "Cost Anomaly Detector",
  triggerInstruction: "If AWS daily costs exceed $500 or increase 50% from yesterday",
  actionInstruction: "Identify the cost drivers and alert finance@company.com"
}

// Security sentinel
{
  name: "Security Scanner",
  triggerInstruction: "Every 6 hours, or when a new ECR image is pushed",
  actionInstruction: "Scan for vulnerabilities and create a report"
}
```

---

### 33.6 The Council of Rivals (Adversarial Consensus)

#### Problem Statement

LLMs suffer from:

- **Hallucinations** (confident but wrong answers)
- **Sycophancy** (agreeing with user's incorrect premises)
- **Blind spots** (missing edge cases)
- **No self-verification** (unable to catch own errors)

#### Solution: Structured Adversarial Debate

Force multiple models to argue against each other before synthesizing a final answer:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COUNCIL OF RIVALS ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   User Query: "Should we migrate from PostgreSQL to MongoDB?"               │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         THE COUNCIL                                  │   │
│   │                                                                      │   │
│   │   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │   │
│   │   │ ADVOCATE      │  │ CRITIC        │  │ PRAGMATIST    │           │   │
│   │   │ (Claude)      │  │ (GPT-4o)      │  │ (Llama-70b)   │           │   │
│   │   │               │  │               │  │               │           │   │
│   │   │ "Migrate!     │  │ "Don't! You   │  │ "It depends   │           │   │
│   │   │ Schema flex-  │  │ lose ACID,    │  │ on your data  │           │   │
│   │   │ ibility is    │  │ joins become  │  │ access patt-  │           │   │
│   │   │ worth it."    │  │ nightmares."  │  │ erns..."      │           │   │
│   │   └───────────────┘  └───────────────┘  └───────────────┘           │   │
│   │           │                  │                  │                    │   │
│   │           └──────────────────┼──────────────────┘                    │   │
│   │                              ▼                                        │   │
│   │                    ┌─────────────────┐                               │   │
│   │                    │ ROUND 2:        │                               │   │
│   │                    │ Cross-Examine   │                               │   │
│   │                    │ Each Other      │                               │   │
│   │                    └─────────────────┘                               │   │
│   │                              │                                        │   │
│   │                              ▼                                        │   │
│   │                    ┌─────────────────┐                               │   │
│   │                    │ ARBITER         │                               │   │
│   │                    │ (Opus)          │                               │   │
│   │                    │                 │                               │   │
│   │                    │ Synthesize      │                               │   │
│   │                    │ final answer    │                               │   │
│   │                    │ with confidence │                               │   │
│   │                    └─────────────────┘                               │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Final Output: "For your use case (heavy joins, ACID requirements),        │
│   stay with PostgreSQL. Migration cost would outweigh benefits."            │
│   Confidence: 87% | Dissent: Advocate (13%)                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Council Roles

| Role | Purpose | Default Model |
|------|---------|---------------|
| **Advocate** | Argues FOR the proposed solution | Claude Sonnet |
| **Critic** | Argues AGAINST, finds weaknesses | GPT-4o |
| **Pragmatist** | Considers practical constraints | Llama-70b |
| **Arbiter** | Synthesizes final verdict | Claude Opus |

#### Council Configuration

```typescript
interface CouncilConfig {
  enabled: boolean;
  triggerComplexity: number;      // Min complexity score (default: 7)
  triggerDomains: string[];       // Domains requiring council (e.g., ['legal', 'medical'])
  roles: {
    advocate: { model: string; temperature: number };
    critic: { model: string; temperature: number };
    pragmatist: { model: string; temperature: number };
    arbiter: { model: string; temperature: number };
  };
  rounds: number;                 // Cross-examination rounds (default: 2)
  confidenceThreshold: number;    // Min confidence for consensus (default: 0.75)
  includeDissentReport: boolean;  // Show minority opinions
}
```

#### Council Output Format

```typescript
interface CouncilVerdict {
  question: string;
  verdict: string;
  confidence: number;           // 0.0 - 1.0
  consensusLevel: 'unanimous' | 'majority' | 'split';
  arguments: {
    advocate: { position: string; keyPoints: string[] };
    critic: { position: string; keyPoints: string[] };
    pragmatist: { position: string; keyPoints: string[] };
  };
  crossExamination: {
    round: number;
    challenges: Array<{
      from: string;
      to: string;
      challenge: string;
      response: string;
    }>;
  }[];
  arbiterReasoning: string;
  dissent?: {
    role: string;
    position: string;
    confidence: number;
  };
}
```

#### Admin UI: Council of Rivals

**Location**: Admin Dashboard → Think Tank → Council of Rivals

| Tab | Description |
|-----|-------------|
| **Configuration** | Enable/disable, configure roles and models |
| **Trigger Rules** | Set complexity/domain triggers |
| **Session History** | View past council deliberations |
| **Analytics** | Consensus rates, dissent patterns |

#### Council API Reference

```
Base: /api/thinktank/council

GET  /config                      Get council configuration
PUT  /config                      Update council configuration
POST /deliberate                  Manually trigger council deliberation
GET  /sessions                    List past deliberation sessions
GET  /sessions/:id                Get full deliberation transcript
GET  /analytics                   Council effectiveness metrics
```

---

### 33.7 Implementation Roadmap

#### Priority Matrix

| Phase | Enhancement | Effort | Impact | Priority |
|-------|-------------|--------|--------|----------|
| **Q1** | Economic Governor | Medium | High (ROI) | **P0** |
| **Q1** | The Grimoire | High | Very High | **P0** |
| **Q2** | Time-Travel Debugging | Medium | Medium | **P1** |
| **Q2** | Council of Rivals | Medium | High | **P1** |
| **Q3** | Sentinel Agents | High | High | **P2** |

#### Recommended Implementation Order

1. **Economic Governor** (Week 1-3)
   - Immediate cost savings
   - Simple routing logic
   - Foundation for other features

2. **The Grimoire** (Week 2-6)
   - Highest long-term value
   - Leverages existing Flyte infrastructure
   - Creates lock-in effect

3. **Time-Travel Debugging** (Week 5-8)
   - Builds on Flyte checkpointing
   - Power user feature
   - Developer experience differentiator

4. **Council of Rivals** (Week 7-10)
   - Quality improvement
   - Trust building
   - Requires multi-model orchestration

5. **Sentinel Agents** (Week 9-14)
   - Most complex
   - Requires EventBridge integration
   - New revenue opportunities

#### Dependencies

```
Economic Governor ─────┐
                       │
The Grimoire ─────────┼──▶ Time-Travel
                       │
Council of Rivals ────┘

Sentinel Agents (independent, can parallel)
```

---

### 33.8 Database Schema

```sql
-- Grimoire tables
CREATE TABLE grimoire_heuristics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  category VARCHAR(50) NOT NULL,
  trigger TEXT NOT NULL,
  heuristic TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.70,
  source_execution_id VARCHAR(255),
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_applied TIMESTAMPTZ,
  tags TEXT[],
  embedding VECTOR(1536),
  enabled BOOLEAN DEFAULT true,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_grimoire_tenant_category ON grimoire_heuristics(tenant_id, category);
CREATE INDEX idx_grimoire_embedding ON grimoire_heuristics USING ivfflat (embedding vector_cosine_ops);

-- Economic Governor tables
CREATE TABLE economic_governor_savings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  execution_id VARCHAR(255) NOT NULL,
  actual_model VARCHAR(100) NOT NULL,
  actual_cost DECIMAL(10,6) NOT NULL,
  baseline_model VARCHAR(100) NOT NULL,
  baseline_cost DECIMAL(10,6) NOT NULL,
  savings DECIMAL(10,6) NOT NULL,
  savings_percent DECIMAL(5,2) NOT NULL,
  complexity_score DECIMAL(3,1) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_savings_tenant_date ON economic_governor_savings(tenant_id, created_at);

-- Sentinel tables
CREATE TABLE sentinels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(50) NOT NULL,
  trigger_config JSONB NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  action_config JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'hibernating',
  flyte_execution_id VARCHAR(255),
  eventbridge_rule_arn TEXT,
  trigger_count INTEGER DEFAULT 0,
  max_triggers INTEGER,
  expires_at TIMESTAMPTZ,
  last_triggered TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sentinels_tenant_status ON sentinels(tenant_id, status);

-- Council of Rivals tables
CREATE TABLE council_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  question TEXT NOT NULL,
  verdict TEXT,
  confidence DECIMAL(3,2),
  consensus_level VARCHAR(20),
  arguments JSONB,
  cross_examination JSONB,
  arbiter_reasoning TEXT,
  dissent JSONB,
  duration_ms INTEGER,
  total_cost DECIMAL(10,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_council_tenant_date ON council_sessions(tenant_id, created_at);

-- Time-Travel checkpoints
CREATE TABLE execution_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  execution_id VARCHAR(255) NOT NULL,
  node_id VARCHAR(255) NOT NULL,
  workflow_name VARCHAR(255) NOT NULL,
  s3_uri TEXT NOT NULL,
  state_hash VARCHAR(64),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(execution_id, node_id)
);

CREATE TABLE execution_forks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  original_execution_id VARCHAR(255) NOT NULL,
  forked_execution_id VARCHAR(255) NOT NULL,
  fork_node_id VARCHAR(255) NOT NULL,
  modifications JSONB NOT NULL,
  forked_by UUID REFERENCES users(id),
  reason TEXT,
  time_saved_minutes INTEGER,
  cost_saved DECIMAL(10,6),
  tokens_skipped INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE grimoire_heuristics ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_governor_savings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinels ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_forks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON grimoire_heuristics
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_isolation ON economic_governor_savings
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_isolation ON sentinels
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_isolation ON council_sessions
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_isolation ON execution_checkpoints
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY tenant_isolation ON execution_forks
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

---

### 33.9 API Reference

#### Complete Endpoint Summary

| Service | Base Path | Key Endpoints |
|---------|-----------|---------------|
| **Grimoire** | `/api/thinktank/grimoire` | CRUD heuristics, stats, bulk import |
| **Time-Travel** | `/api/thinktank/time-travel` | Timeline, checkpoints, fork, compare |
| **Economic Governor** | `/api/thinktank/economic-governor` | Savings, routing rules, analyze |
| **Sentinels** | `/api/thinktank/sentinels` | CRUD sentinels, triggers, test |
| **Council** | `/api/thinktank/council` | Config, deliberate, sessions |

---

### 33.10 Configuration

#### Tenant-Level Feature Flags

```typescript
interface CognitiveEnhancementsConfig {
  grimoire: {
    enabled: boolean;
    autoExtract: boolean;
    minConfidenceThreshold: number;
    decayEnabled: boolean;
  };
  timeTravel: {
    enabled: boolean;
    maxCheckpointsPerExecution: number;
    retentionDays: number;
  };
  economicGovernor: {
    enabled: boolean;
    economyThreshold: number;
    standardThreshold: number;
    budgetCapDaily: number;
    budgetCapMonthly: number;
  };
  sentinels: {
    enabled: boolean;
    maxActiveSentinels: number;
    allowedTriggerTypes: string[];
  };
  council: {
    enabled: boolean;
    triggerComplexity: number;
    triggerDomains: string[];
    rounds: number;
  };
}
```

---

### 33.11 Troubleshooting

#### Common Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| Grimoire not learning | Auto-extract disabled | Enable in tenant config |
| Fork fails | Checkpoint expired | Increase retention period |
| Governor routes wrong | Stale complexity model | Retrain on recent data |
| Sentinel not triggering | EventBridge rule disabled | Check AWS console |
| Council timeout | Too many rounds | Reduce cross-examination rounds |

#### Debug Commands

```bash
# Check Grimoire heuristic count
curl -X GET "https://api.radiant.ai/thinktank/grimoire/stats" \
  -H "Authorization: Bearer $TOKEN"

# Test Economic Governor routing
curl -X POST "https://api.radiant.ai/thinktank/economic-governor/analyze-complexity" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"prompt": "Write a complex SQL query", "taskType": "code_generation"}'

# Check Sentinel status
curl -X GET "https://api.radiant.ai/thinktank/sentinels" \
  -H "Authorization: Bearer $TOKEN"

# View Council session
curl -X GET "https://api.radiant.ai/thinktank/council/sessions/{sessionId}" \
  -H "Authorization: Bearer $TOKEN"
```

### 33.12 Related Sections

| Section | Relevance |
|---------|-----------|
| [Section 23 - Predictive Coding](#23-predictive-coding--evolution) | Foundation for Grimoire learning |
| [Section 30 - COS](#30-consciousness-operating-system-cos) | SOFAI integration |
| [Section 32 - Swarm Orchestration](#32-swarm-orchestration--flyte-operations) | Flyte integration for all features |
| [RADIANT Admin Guide - Section 47](./RADIANT-ADMIN-GUIDE.md#47-flyte-native-state-management) | Flyte checkpointing |

---

## 34. Orchestration Workflow Methods Reference

**Location**: Admin Dashboard → Think Tank → Orchestration → Methods

This section documents the complete **70+ orchestration workflow methods** available in Think Tank. Each method has a **display name** (user-friendly) and **scientific name** (formal/academic reference).

### 34.1 Method Categories Overview

| Category | Methods | Purpose |
|----------|---------|---------|
| **Generation** | 3 | Generate responses with various reasoning strategies |
| **Evaluation** | 6 | Critique, judge, and score outputs |
| **Synthesis** | 5 | Combine multiple responses into unified outputs |
| **Verification** | 8 | Fact-check and verify claims |
| **Debate** | 5 | Multi-agent deliberation and argumentation |
| **Aggregation** | 4 | Vote, blend, and aggregate responses |
| **Reasoning** | 2 | Problem decomposition and reflection |
| **Routing** | 6 | Dynamic model selection and cascading |
| **Collaboration** | 5 | Multi-agent coordination |
| **Uncertainty** | 6 | Confidence estimation and calibration |
| **Hallucination** | 3 | Detect and prevent hallucinations |
| **Human-in-Loop** | 3 | Human oversight and review |
| **Neural** | 1 | Cato-integrated neural decision engine |

### 34.2 Complete Methods Reference

#### Generation Methods

| Display Name | Scientific Name | Code | Description |
|-------------|-----------------|------|-------------|
| Generate | Basic Generation | `GENERATE_RESPONSE` | Standard response generation |
| Think Step-by-Step | Chain-of-Thought Generation | `GENERATE_WITH_COT` | Reasoning before answering (+20-40% accuracy) |
| Refine | Iterative Refinement | `REFINE_RESPONSE` | Improve based on feedback |

#### Evaluation Methods

| Display Name | Scientific Name | Code | Accuracy Gain |
|-------------|-----------------|------|---------------|
| Critique | Critical Evaluation | `CRITIQUE_RESPONSE` | Identifies flaws |
| Judge | Comparative Judgment | `JUDGE_RESPONSES` | Evaluates multiple outputs |
| Multi-Judge Panel | Panel of LLMs (PoLL) | `POLL_JUDGE` | -40-60% single-model bias |
| Structured Scoring | G-Eval NLG Framework | `G_EVAL` | 0.5+ human correlation |
| Head-to-Head Compare | Pairwise Preference | `PAIRWISE_PREFER` | Reliable for subtle differences |
| Side-by-Side Compare | Comparative Analysis | `COMPARE_ANALYSIS` | +50% decision clarity |

#### Synthesis Methods

| Display Name | Scientific Name | Code | Accuracy Gain |
|-------------|-----------------|------|---------------|
| Synthesize | Multi-Response Synthesis | `SYNTHESIZE_RESPONSES` | Combines best parts |
| Consensus | Consensus Aggregation | `BUILD_CONSENSUS` | Agreement points |
| Layered Synthesis | Mixture of Agents (MoA) | `MOA_LAYERS` | +8% over GPT-4o |
| Combine & Summarize | Multi-Source Synthesis | `MULTI_SOURCE_SYNTH` | +40% coverage |
| Rank & Merge | LLM-Blender Fusion | `LLM_BLENDER` | +12% over best model |

#### Verification Methods

| Display Name | Scientific Name | Code | Accuracy Gain |
|-------------|-----------------|------|---------------|
| Fact Check | Factual Verification | `VERIFY_FACTS` | Extract & verify claims |
| Step Verification | Process Reward Model | `PROCESS_REWARD` | +6% on MATH |
| Internal Consistency | SelfCheckGPT | `SELFCHECK_GPT` | +25% hallucination F1 |
| Source Attribution | Citation Verification | `CITE_VERIFY` | +40% citation accuracy |
| Logic-Based Check | Zero-Shot Natural Logic | `NATURAL_LOGIC` | +8.96 accuracy points |
| Combined Verification | UniFact Unified | `UNIFACT` | +20% comprehensive |
| Internal State Check | EigenScore | `EIGENSCORE` | Hidden state analysis |
| Re-Query Consistency | Iterative Prompting | `REQUERY_CHECK` | Black-box detection |

#### Debate Methods

| Display Name | Scientific Name | Code | Accuracy Gain |
|-------------|-----------------|------|---------------|
| Challenge | Adversarial Challenge | `GENERATE_CHALLENGE` | Counter-arguments |
| Defend | Position Defense | `DEFEND_POSITION` | Respond to challenges |
| Efficient Debate | Sparse Topology Debate | `SPARSE_DEBATE` | -40-60% cost, <5% quality loss |
| Attack & Support Map | ArgLLMs Bipolar | `ARG_MAPPING` | +35% structured argumentation |
| Human-AI Panel | HAH-Delphi Hybrid | `HAH_DELPHI` | >90% expert coverage |
| Confidence-Weighted | ReConcile Consensus | `RECONCILE_WEIGHTED` | +15-25% diverse ensembles |

#### Aggregation Methods

| Display Name | Scientific Name | Code | Accuracy Gain |
|-------------|-----------------|------|---------------|
| Vote | Majority Aggregation | `MAJORITY_VOTE` | Most common answer |
| Weight | Weighted Aggregation | `WEIGHTED_AGGREGATE` | Confidence-weighted |
| Multi-Sample Voting | Self-Consistency | `SELF_CONSISTENCY` | +17.9% on GSM8K |
| Ranked Choice | GEDI Electoral CDM | `GEDI_VOTE` | +30% consensus |

#### Routing Methods

| Display Name | Scientific Name | Code | Accuracy Gain | Implementation |
|-------------|-----------------|------|---------------|----------------|
| Classify | Task Classification | `DETECT_TASK_TYPE` | Detect complexity | Keyword analysis |
| Route | Model Selection | `SELECT_BEST_MODEL` | Optimal model | Capability matching |
| Smart Selection | RouteLLM Adaptive | `ROUTELLM` | -50% cost, <3% loss | Learned router |
| Progressive Escalation | FrugalGPT Cascade | `FRUGAL_CASCADE` | -90% cost maintained | Confidence-based escalation |
| Budget-Aware | Pareto Routing | `PARETO_ROUTE` | Optimal trade-off | Pareto frontier calculation |
| Smart Cost Escalation | C3PO Self-Supervised | `C3PO_CASCADE` | -40% cost, +2% quality | Difficulty prediction + tiered cascade (NeurIPS 2024) |
| Self-Routing | AutoMix POMDP | `AUTOMIX` | Self-improving | ε-greedy exploration + self-verification (Nov 2025) |

**Implementation Notes:**
- **Pareto Routing**: Computes Pareto frontier across quality/latency/cost, selects optimal model within budget constraints.
- **C3PO Cascade**: Predicts query difficulty using prompt features, starts at appropriate tier, cascades up if confidence insufficient.
- **AutoMix POMDP**: Uses POMDP belief state for model selection with ε-greedy exploration and self-verification for quality assurance.

#### Collaboration Methods

| Display Name | Scientific Name | Code | Accuracy Gain |
|-------------|-----------------|------|---------------|
| No-Comm Coordination | ECON Bayesian Nash | `ECON_NASH` | +11.2% coordination |
| Fair Merge | Token Auction | `TOKEN_AUCTION` | Fair multi-stakeholder |
| Logic & Solve | Logic-LM Neuro-Symbolic | `LOGIC_LM` | +39.2% over standard |
| Generate & Verify | LLM-Modulo Framework | `LLM_MODULO` | 12%→93.9% plan success |
| Auto-Discover | AFlow MCTS Discovery | `AFLOW_MCTS` | Beats human designs |

#### Uncertainty Methods

| Display Name | Scientific Name | Code | Accuracy Gain | Implementation |
|-------------|-----------------|------|---------------|----------------|
| Meaning-Based | Semantic Entropy | `SEMANTIC_ENTROPY` | AUROC 0.79-0.87 | NLI clustering |
| Calibrated Confidence | Calibrated Estimation | `CALIBRATED_CONF` | ECE -15% | Temperature scaling |
| Agreement Scoring | Consistency UQ | `CONSISTENCY_UQ` | Simple, effective | Multi-sample agreement |
| Fast Uncertainty | SE Probes (Logprob-based) | `SE_PROBES` | 300x faster, 90% accuracy | Token logprob entropy (ICML 2024) |
| Detailed Score | Kernel Language Entropy | `KERNEL_ENTROPY` | Finer-grained | Embedding KDE (NeurIPS 2024) |
| Guaranteed Bounds | Conformal Prediction | `CONFORMAL_PRED` | Statistical guarantees | Coverage calibration |

**Implementation Notes:**
- **SE Probes**: Uses OpenAI logprobs API to compute per-token Shannon entropy. Approximates hidden state probes without model internals access.
- **Kernel Entropy**: Generates embeddings via `text-embedding-3-small`, applies Gaussian KDE with Silverman bandwidth, returns density-based entropy.

#### Hallucination Detection (NEW)

| Display Name | Scientific Name | Code | Accuracy Gain |
|-------------|-----------------|------|---------------|
| Fact-Check Scanner | Multi-Method Detection | `MULTI_HALLUC` | F1 0.85+ |
| Mutation Testing | MetaQA Metamorphic | `METAQA` | +30% subtle inconsistencies |
| Source Verification | Factual Grounding | `FACTUAL_GROUND` | +45% grounding accuracy |

#### Human-in-the-Loop (NEW)

| Display Name | Scientific Name | Code | Purpose |
|-------------|-----------------|------|---------|
| Human Review Queue | HITL Review System | `HITL_REVIEW` | +90% critical error prevention |
| Multi-Level Review | Tiered Evaluation | `TIERED_EVAL` | Efficient human resources |
| Smart Sampling | Active Learning | `ACTIVE_SAMPLE` | +60% labeling efficiency |

#### Neural/ML Methods (NEW)

| Display Name | Scientific Name | Code | Description |
|-------------|-----------------|------|-------------|
| Neural Decision | Cato Neural Decision Engine | `CATO_NEURAL` | Integrates Cato safety pipeline with consciousness affect state and predictive coding |

### 34.3 System vs User Methods

All orchestration methods have an `isSystemMethod` flag:

| Type | Can Edit Parameters | Can Edit Definition | Can Delete |
|------|---------------------|---------------------|------------|
| **System Method** | ✅ Yes | ❌ No | ❌ No |
| **User Method** | ✅ Yes | ✅ Yes | ✅ Yes |

**System methods** are the 70+ built-in methods documented above. Administrators can:
- Enable/disable system methods
- Modify default parameters
- View execution metrics

**User methods** (future feature) will allow tenants to create custom methods with their own prompts or code references.

### 34.4 User Workflow Templates

**Location**: Admin Dashboard → Think Tank → Workflow Templates

Users can create custom workflows by:

1. **Creating from scratch** - Add methods step by step
2. **Basing on system workflow** - Start from one of 49 system patterns
3. **Customizing parameters** - Override default parameters per step
4. **Sharing with team** - Make templates available to organization

#### Template Structure

```typescript
interface UserWorkflowTemplate {
  templateId: string;
  templateName: string;
  templateDescription: string;
  baseWorkflowCode?: string;
  steps: Array<{
    stepOrder: number;
    methodCode: string;
    displayName: string;
    parameters: Record<string, unknown>;
    condition?: string;
    isEnabled: boolean;
  }>;
  category: string;
  tags: string[];
  isShared: boolean;
  timesUsed: number;
}
```

#### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/orchestration/user-templates` | GET | List user templates (own + shared) |
| `/api/admin/orchestration/user-templates` | POST | Create template |
| `/api/admin/orchestration/user-templates/:id` | GET | Get template details |
| `/api/admin/orchestration/user-templates/:id` | PATCH | Update template (owner only) |
| `/api/admin/orchestration/user-templates/:id` | DELETE | Delete template (owner only) |
| `/api/admin/orchestration/user-templates/:id/share` | POST | Toggle team sharing |
| `/api/admin/orchestration/user-templates/:id/duplicate` | POST | Duplicate template |

**Method Management Endpoints**:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/orchestration/methods` | GET | List all methods (includes `isSystemMethod`) |
| `/api/admin/orchestration/methods/:code` | GET | Get method details |
| `/api/admin/orchestration/methods/:code` | PATCH | Update method (parameters only for system methods) |
| `/api/admin/orchestration/metrics` | GET | Method execution metrics |
| `/api/admin/orchestration/executions` | GET | Recent executions |

### 34.4 Cato Neural Decision Engine

The `CATO_NEURAL` method integrates with the Genesis Cato safety architecture:

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `safety_mode` | enum | `enforce` | CBF enforcement: enforce, warn, monitor |
| `use_affect_mapping` | boolean | `true` | Map affect state to hyperparameters |
| `use_predictive_coding` | boolean | `true` | Enable active inference |
| `precision_governor_enabled` | boolean | `true` | Limit confidence by epistemic state |
| `cbf_threshold` | number | `0.95` | Safety barrier threshold |

#### Affect-to-Hyperparameter Mapping

| Affect State | Hyperparameter Effect |
|--------------|----------------------|
| High frustration (>0.5) | Lower temperature (more focused) |
| High curiosity (>0.6) | Higher temperature (exploration) |
| Low self-efficacy (<0.4) | Escalate to expert model |
| High arousal (>0.7) | Longer max tokens |

### 34.5 Method Parameters Reference

All methods have configurable parameters that can be set at the **Admin level** (defaults) or overridden in **User Workflow Templates**.

#### Uncertainty & Confidence Methods

| Method | Parameter | Type | Default | Description |
|--------|-----------|------|---------|-------------|
| **SEMANTIC_ENTROPY** | `sample_count` | integer | 10 | Number of response samples (5-20) |
| | `temperature` | number | 0.7 | Sampling temperature |
| | `clustering_method` | enum | "nli" | Clustering: nli, embedding, exact |
| | `entropy_threshold` | number | 0.5 | Flag uncertainty above this |
| **SE_PROBES** | `probe_layers` | array | [-1, -2] | Model layers to probe (logprob-based) |
| | `threshold` | number | 0.5 | Uncertainty threshold |
| | `fast_mode` | boolean | true | Use fast logprob estimation |
| | `sample_count` | integer | 5 | Number of samples for averaging |
| **KERNEL_ENTROPY** | `kernel` | enum | "rbf" | Kernel: rbf, linear, polynomial |
| | `bandwidth` | string | "auto" | Bandwidth or "auto" for Silverman |
| | `sample_count` | integer | 10 | Response samples for KDE |
| **CALIBRATED_CONF** | `calibration_method` | enum | "platt_scaling" | platt_scaling, isotonic, temperature_scaling |
| | `confidence_prompt` | string | "verbalized" | How to elicit confidence |
| | `temperature` | number | 0.3 | Sampling temperature |
| **CONSISTENCY_UQ** | `sample_count` | integer | 5 | Number of response samples |
| | `agreement_metric` | enum | "jaccard" | jaccard, cosine, exact_match, bertscore |
| | `threshold` | number | 0.7 | Agreement threshold |
| **CONFORMAL_PRED** | `coverage_target` | number | 0.9 | Target coverage (0.5-0.99) |
| | `calibration_size` | integer | 500 | Calibration set size |
| | `adaptive` | boolean | true | Use adaptive conformal sets |

#### Routing Methods

| Method | Parameter | Type | Default | Description |
|--------|-----------|------|---------|-------------|
| **ROUTELLM** | `router_model` | enum | "matrix_factorization" | Router: matrix_factorization, bert, causal_lm |
| | `cost_threshold` | number | 0.7 | Max cost relative to baseline |
| | `quality_floor` | number | 0.8 | Minimum acceptable quality |
| **FRUGAL_CASCADE** | `model_cascade` | array | ["gpt-4o-mini", "gpt-4o", "o1"] | Models in escalation order |
| | `confidence_threshold` | number | 0.85 | Escalate below this confidence |
| | `max_escalations` | integer | 2 | Maximum escalation steps |
| **PARETO_ROUTE** | `budget_cents` | number | 10 | Budget constraint per query |
| | `quality_weight` | number | 0.7 | Weight for quality (0-1) |
| | `latency_weight` | number | 0.1 | Weight for latency (0-1) |
| **C3PO_CASCADE** | `cascade_levels` | integer | 3 | Number of model tiers |
| | `self_supervised` | boolean | true | Enable self-supervised learning |
| | `calibration_samples` | integer | 100 | Samples for difficulty calibration |
| **AUTOMIX** | `pomdp_horizon` | integer | 3 | POMDP planning horizon |
| | `exploration_rate` | number | 0.1 | ε for ε-greedy exploration |
| | `self_verification` | boolean | true | Verify own outputs |

#### Debate & Deliberation Methods

| Method | Parameter | Type | Default | Description |
|--------|-----------|------|---------|-------------|
| **SPARSE_DEBATE** | `topology` | enum | "ring" | Network: ring, star, tree, full |
| | `debate_rounds` | integer | 3 | Number of debate rounds (1-10) |
| | `temperature` | number | 0.7 | Agent response temperature |
| **ARG_MAPPING** | `strength_threshold` | number | 0.5 | Min argument strength to include |
| | `include_rebuttal` | boolean | true | Generate rebuttals |
| | `max_depth` | integer | 3 | Max argument tree depth |
| **HAH_DELPHI** | `tiers` | integer | 4 | Number of consensus tiers |
| | `human_threshold` | number | 0.6 | Escalate to human above this |
| | `consensus_target` | number | 0.9 | Target consensus level |
| | `max_rounds` | integer | 5 | Maximum Delphi rounds |
| **RECONCILE_WEIGHTED** | `min_confidence` | number | 0.6 | Minimum confidence to include |
| | `weight_by` | string | "confidence" | Weighting strategy |
| | `reconciliation_rounds` | integer | 2 | Reconciliation iterations |

#### Evaluation Methods

| Method | Parameter | Type | Default | Description |
|--------|-----------|------|---------|-------------|
| **POLL_JUDGE** | `num_judges` | integer | 3 | Number of judge models |
| | `scoring_criteria` | array | ["accuracy", "completeness", "clarity"] | Evaluation dimensions |
| | `aggregation` | enum | "mean" | Aggregation: mean, median, weighted |
| **G_EVAL** | `dimensions` | array | ["coherence", "consistency", "fluency", "relevance"] | G-Eval dimensions |
| | `use_cot` | boolean | true | Chain-of-thought scoring |
| | `score_range` | array | [1, 5] | Score min/max |
| **PAIRWISE_PREFER** | `comparison_criteria` | array | ["quality", "accuracy", "helpfulness"] | Comparison dimensions |
| | `allow_tie` | boolean | true | Allow tie verdicts |
| **SELFCHECK_GPT** | `sample_count` | integer | 5 | Consistency check samples |
| | `check_type` | enum | "consistency" | Check type: consistency, bertscore, nli |
| | `threshold` | number | 0.7 | Inconsistency threshold |

#### Hallucination Detection Methods

| Method | Parameter | Type | Default | Description |
|--------|-----------|------|---------|-------------|
| **MULTI_HALLUC** | `methods` | array | ["consistency", "attribution", "semantic_entropy"] | Detection methods |
| | `aggregation` | enum | "weighted" | weighted, majority, any |
| | `flag_threshold` | number | 0.6 | Flag as hallucination above |
| **METAQA** | `transformations` | array | ["paraphrase", "negation", "entity_swap"] | Mutation types |
| | `num_mutations` | integer | 3 | Mutations per claim |
| | `consistency_threshold` | number | 0.8 | Consistency threshold |
| **FACTUAL_GROUND** | `retrieval_top_k` | integer | 5 | Documents to retrieve |
| | `evidence_threshold` | number | 0.7 | Evidence support threshold |
| | `require_explicit_support` | boolean | true | Require explicit evidence |

#### Human-in-the-Loop Methods

| Method | Parameter | Type | Default | Description |
|--------|-----------|------|---------|-------------|
| **HITL_REVIEW** | `confidence_threshold` | number | 0.7 | Route to human below this |
| | `stake_level` | enum | "medium" | low, medium, high, critical |
| | `auto_approve_above` | number | 0.95 | Auto-approve above this confidence |
| | `queue_priority` | enum | "fifo" | Queue ordering |
| **TIERED_EVAL** | `tiers` | integer | 3 | Evaluation tiers |
| | `auto_tier_threshold` | number | 0.85 | Auto-approve threshold |
| | `escalation_criteria` | array | ["low_confidence", "high_stakes"] | When to escalate |
| **ACTIVE_SAMPLE** | `uncertainty_method` | enum | "entropy" | entropy, margin, random |
| | `batch_size` | integer | 10 | Samples per batch |
| | `diversity_weight` | number | 0.3 | Diversity in selection |

### 34.6 User Workflow Template Parameter Overrides

When users create workflow templates, they can override default parameters for each step:

```typescript
// Example: User template with parameter overrides
{
  "templateName": "High-Confidence Research",
  "steps": [
    {
      "stepOrder": 1,
      "methodCode": "SEMANTIC_ENTROPY",
      "parameters": {
        "sample_count": 15,        // Override: more samples
        "entropy_threshold": 0.3   // Override: stricter threshold
      }
    },
    {
      "stepOrder": 2,
      "methodCode": "FRUGAL_CASCADE",
      "parameters": {
        "confidence_threshold": 0.95,  // Override: higher confidence
        "max_escalations": 3           // Override: allow more escalation
      }
    }
  ]
}
```

**Admin Dashboard** (`Orchestration → Methods`):
- View and edit **default parameters** for all methods
- Changes apply to all workflows using the method
- System methods: parameters only, not method definition

**Think Tank UI** (`Workflow Templates`):
- Users create templates with **parameter overrides**
- Overrides apply only to that template
- Templates can be shared with team

### 34.7 Database Tables

```sql
-- Methods with display/scientific names
ALTER TABLE orchestration_methods 
ADD COLUMN display_name VARCHAR(200),
ADD COLUMN scientific_name VARCHAR(300),
ADD COLUMN research_reference TEXT,
ADD COLUMN accuracy_improvement VARCHAR(200),
ADD COLUMN complexity_level VARCHAR(50);

-- User workflow templates
CREATE TABLE user_workflow_templates (
  template_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  template_name VARCHAR(200) NOT NULL,
  template_description TEXT,
  base_workflow_code VARCHAR(100),
  steps JSONB NOT NULL DEFAULT '[]',
  category VARCHAR(100),
  tags TEXT[] DEFAULT '{}',
  is_shared BOOLEAN DEFAULT false,
  times_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id, template_name)
);
```

### 34.7 Implementation Files

| File | Purpose |
|------|---------|
| `migrations/066_orchestration_patterns_registry.sql` | Base schema with `is_system_method`/`is_system_workflow` |
| `migrations/157_orchestration_methods_part1.sql` | Schema updates, display/scientific names |
| `migrations/157_orchestration_methods_part2.sql` | Ensemble, verification methods |
| `migrations/157_orchestration_methods_part3.sql` | Uncertainty, routing, neural methods |
| `lambda/shared/services/orchestration-methods.service.ts` | **20 algorithm implementations** including SE Probes, Kernel Entropy, Pareto, C3PO, AutoMix |
| `lambda/shared/services/cato/neural-decision.service.ts` | Cato Neural Decision Engine |
| `lambda/admin/orchestration-methods.ts` | Methods API with system method protection |
| `lambda/admin/orchestration-user-templates.ts` | User templates CRUD API |
| `apps/admin-dashboard/app/(dashboard)/orchestration/methods/page.tsx` | Admin method config with system badge |
| `apps/admin-dashboard/app/(dashboard)/thinktank/workflow-templates/page.tsx` | User templates UI |

---

## 35. Polymorphic UI (PROMPT-41)

### 35.1 Overview

**Flowise outputs Text. Think Tank outputs Applications.**

The Polymorphic UI system makes Think Tank's interface physically transform based on task complexity, domain hints, and drive profile. Unlike static chatbot interfaces, Think Tank morphs into the tool the user actually needs.

### 35.2 The Gearbox (Elastic Compute)

Users can manually control the cost-quality tradeoff via the Gearbox:

| Mode | Cost | Architecture | Memory | Use Case |
|------|------|--------------|--------|----------|
| **🎯 Sniper** | $0.01/run | Single Model | Read-Only Ghost Memory | Quick answers, lookups, coding |
| **🏛️ War Room** | $0.50+/run | Multi-Agent Ensemble | Read/Write + Active Inference | Strategy, audits, reasoning |

**Escalation**: A green "Escalate to War Room" button appears after Sniper responses.

### 35.3 The Three Views

| View | Intent | Morph | Key Feature |
|------|--------|-------|-------------|
| **🎯 Sniper** | Quick commands | Terminal/Command Center | Green badge, cost transparency, immediate execution |
| **🔭 Scout** | Research & exploration | Infinite Canvas/Mind Map | Sticky notes, topic clustering, conflict lines |
| **📜 Sage** | Audit & validation | Split-Screen Diff Editor | Left=content, Right=sources with confidence scores |

### 35.4 View Types

| View Type | Trigger | Description |
|-----------|---------|-------------|
| `terminal_simple` | Quick commands, lookups | Command Center - fast execution |
| `mindmap` | Research, exploration | Infinite Canvas - visual mapping |
| `diff_editor` | Verification, compliance | Split-Screen - source validation |
| `dashboard` | Analytics queries | Metrics visualization |
| `decision_cards` | HITL escalation | Mission Control interface |
| `chat` | Default | Standard conversation |

### 35.5 Configuration

Access via **Think Tank → Polymorphic UI** in admin dashboard.

| Setting | Description | Default |
|---------|-------------|---------|
| `enableAutoMorphing` | Auto-morph based on query | `true` |
| `enableGearboxToggle` | Show Sniper/War Room toggle | `true` |
| `enableCostDisplay` | Show cost badges | `true` |
| `enableEscalationButton` | Show Escalate button | `true` |
| `defaultExecutionMode` | Default mode | `sniper` |
| `domainViewOverrides` | Per-domain view mapping | medical/financial/legal → `diff_editor` |

### 35.6 Implementation Files

| File | Purpose |
|------|---------|
| `governor/economic-governor.ts` | `determineViewType()`, `determinePolymorphicRoute()` |
| `consciousness/mcp-server.ts` | `render_interface`, `escalate_to_war_room` tools |
| `python/cato/cognitive/workflows.py` | Flyte tasks for view selection |
| `migrations/160_polymorphic_ui.sql` | Database schema |
| `components/thinktank/polymorphic/` | React view components |
| `app/(dashboard)/thinktank/polymorphic/page.tsx` | Admin page |

### 35.7 Database Tables

| Table | Purpose |
|-------|---------|
| `view_state_history` | Tracks UI morphing decisions |
| `execution_escalations` | Tracks Sniper → War Room escalations |
| `polymorphic_config` | Per-tenant configuration |

### 35.8 API Endpoints

Base: `/api/admin/polymorphic`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/?action=config` | Get configuration |
| GET | `/?action=view-history` | Get view state history |
| GET | `/?action=escalations` | Get escalation history |
| GET | `/?action=analytics` | Get usage analytics |
| POST | `/` (action: render) | Render specific view |
| POST | `/` (action: escalate) | Escalate to War Room |
| POST | `/` (action: update-config) | Update configuration |

---

## 36. Think Tank Policy Framework: Strategic Intelligence

The Think Tank is not merely a chatbot interface—it is a **policy research engine** informed by rigorous analysis from organizations like the Cato Institute. This section documents the strategic framework that underlies Think Tank's approach to technology policy, regulation, and economic analysis.

### 36.1 The Cato Institute Policy Foundation

The Cato Institute, a renowned policy think tank, provides crucial insights on technology regulation and innovation. Think Tank integrates these perspectives to ensure users receive balanced, evidence-based analysis rather than ideologically-driven conclusions.

#### Core Policy Principles

| Principle | Description | Application in Think Tank |
|-----------|-------------|--------------------------|
| **Pro-Innovation Default** | Permissionless innovation should be the norm | Bias toward "how can this work?" not "why won't this work?" |
| **Evidence-Based Analysis** | Policy must be grounded in data, not fear | Require citations and data sources in policy discussions |
| **Regulatory Humility** | Acknowledge limits of prediction | Flag uncertainty explicitly; avoid overconfident prescriptions |
| **Market-Based Solutions** | Private sector often innovates faster than regulators | Explore voluntary standards before mandates |
| **Individual Liberty** | Technology should enhance freedom, not surveillance | Privacy-by-design; minimize data collection |

### 36.2 The $10 Trillion Cybercrime Economy

A critical context for Think Tank's policy analysis is the scale of the threat environment. The global economy loses approximately **$10 trillion annually** to cybercrime—a figure larger than the GDP of every country except the United States and China.

#### Economic Impact Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GLOBAL CYBERCRIME ECONOMIC IMPACT                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ANNUAL LOSSES: ~$10 TRILLION                                               │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                                                                      │  │
│   │   $10T ────────────────────────────────────────────── CYBERCRIME    │  │
│   │                                                                      │  │
│   │   $4.2T ─────────────────────── GERMANY GDP                         │  │
│   │                                                                      │  │
│   │   $3.4T ──────────────────── JAPAN GDP                              │  │
│   │                                                                      │  │
│   │   $2.1T ────────────── UK GDP                                       │  │
│   │                                                                      │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│   BREAKDOWN BY ATTACK TYPE:                                                  │
│   ─────────────────────────                                                  │
│   • Ransomware: $20B+ annually                                              │
│   • Business Email Compromise: $2.7B annually                               │
│   • Data Breaches: $4.45M average cost per incident                        │
│   • Supply Chain Attacks: Growing 742% since 2019                          │
│   • Nation-State Attacks: Incalculable strategic damage                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Implications for Policy Discussion

When users ask Think Tank about cybersecurity policy, the system contextualizes recommendations against this $10T backdrop:

| User Query | Policy-Aware Response Approach |
|------------|-------------------------------|
| "Should we regulate AI?" | Frame against: AI can *reduce* $10T losses if deployed correctly |
| "Is this security spending justified?" | Compare against: Your $1M security budget vs. $4.45M average breach cost |
| "Should we ban ransomware payments?" | Analyze: Prohibition vs. harm reduction strategies |
| "How strict should compliance be?" | Balance: Compliance costs vs. breach probability × impact |

### 36.3 Memory Safety and the 70% Problem

The Think Tank injects a specific technical insight into relevant conversations: **70% of all software vulnerabilities** stem from memory safety issues. This statistic, validated by Microsoft, Google, and the NSA, should inform every software architecture discussion.

#### Memory Safety Vulnerability Classes

| Vulnerability | Description | % of CVEs |
|---------------|-------------|-----------|
| **Buffer Overflow** | Writing beyond allocated memory | ~30% |
| **Use-After-Free** | Accessing freed memory | ~20% |
| **Double Free** | Freeing memory twice | ~8% |
| **Null Pointer Dereference** | Accessing null pointers | ~7% |
| **Integer Overflow** | Arithmetic exceeding bounds | ~5% |
| **Total Memory Safety** | All memory-related issues | **~70%** |

#### Policy Recommendation Engine

When users discuss software architecture, security, or procurement, Think Tank can inject policy-informed guidance:

```typescript
// Policy injection for memory safety discussions
const MEMORY_SAFETY_POLICY = {
  context: 'User discussing software architecture or security',
  
  injectedGuidance: `
    POLICY CONTEXT: Memory safety vulnerabilities account for 70% of all CVEs.
    
    RECOMMENDATIONS:
    1. For new projects: Prefer memory-safe languages (Rust, Go, Swift)
    2. For existing C/C++ code: Consider incremental migration or sandboxing
    3. For procurement: Require memory-safe language attestation from vendors
    4. For risk assessment: Memory-unsafe components = higher risk weight
    
    SOURCE: Microsoft, Google, NSA research (2019-2024)
  `,
  
  triggerPatterns: [
    'architecture', 'security', 'language choice', 'procurement',
    'vulnerability', 'CVE', 'buffer overflow', 'memory'
  ],
};
```

### 36.4 Regulatory Stance Configuration

Administrators can configure Think Tank's default policy stance for their organization:

| Setting | Options | Description |
|---------|---------|-------------|
| `defaultRegulatorystance` | `cautious` / `balanced` / `pro_innovation` | Bias in regulatory discussions |
| `requireCitations` | `true` / `false` | Require sources for policy claims |
| `flagUncertainty` | `always` / `when_high` / `never` | Uncertainty disclosure level |
| `privateDataBias` | `minimize` / `balanced` / `maximize_utility` | Data collection philosophy |
| `complianceEmphasis` | `strict` / `risk_based` / `minimal` | Compliance recommendation style |

#### Configuration Example

Navigate to **Think Tank → Policy Framework** in admin dashboard:

```yaml
# policy-framework.config.yaml
policy_framework:
  enabled: true
  
  default_stance: balanced
  
  cybercrime_context:
    enabled: true
    inject_10T_context: true
    inject_memory_safety_context: true
    
  citation_requirements:
    require_for_policy_claims: true
    preferred_sources:
      - cato_institute
      - brookings
      - nist
      - academic_peer_reviewed
    flag_opinion_vs_fact: true
    
  uncertainty_handling:
    disclosure_level: always
    confidence_threshold_for_recommendation: 0.7
    escalate_low_confidence_to_human: true
    
  privacy_settings:
    default_data_collection: minimize
    require_purpose_limitation: true
    support_right_to_deletion: true
```

### 36.5 Database Tables

| Table | Purpose |
|-------|---------|
| `policy_framework_config` | Per-tenant policy configuration |
| `policy_citation_log` | Citations used in policy discussions |
| `policy_uncertainty_flags` | Uncertainty disclosures |
| `regulatory_stance_overrides` | Per-domain stance overrides |

### 36.6 Implementation Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/policy-framework.service.ts` | Policy context injection |
| `lambda/shared/services/citation-manager.service.ts` | Citation tracking and validation |
| `lambda/thinktank/policy-context.ts` | API handler for policy queries |
| `migrations/164_policy_framework.sql` | Database schema |
| `config/policy/cato-principles.yaml` | Cato Institute policy principles |

---

## 37. Agentic Orchestration: SSF, CAEP, and Identity Remediation

Think Tank's AI agents operate within a rigorous security framework that leverages open standards for real-time security signaling. This section documents the Shared Signals Framework (SSF) and Continuous Access Evaluation Profile (CAEP) integration specific to Think Tank operations.

### 37.1 The Agentic AI Paradigm

Traditional automation follows rigid if-then rules. **Agentic AI** represents a fundamental shift: AI systems that continuously evaluate their environment, learn from outcomes, and adapt their behavior within defined safety constraints.

#### Traditional Automation vs. Agentic AI

| Aspect | Traditional Automation | Agentic AI (Think Tank) |
|--------|----------------------|-------------------------|
| **Decision Logic** | Static rules | Dynamic evaluation |
| **Learning** | None | Continuous adaptation |
| **Error Handling** | Fail or retry | Investigate and adapt |
| **Human Interaction** | Scheduled checkpoints | On-demand escalation |
| **Security Model** | Perimeter-based | Zero Trust + CAEP |

### 37.2 Shared Signals Framework (SSF) Integration

The **Shared Signals Framework** is an open standard that enables real-time security event sharing between systems. Think Tank agents both emit and consume SSF signals.

#### SSF Event Flow in Think Tank

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    THINK TANK SSF EVENT ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   SIGNAL EMITTERS (Think Tank generates)                                    │
│   ══════════════════════════════════════                                    │
│                                                                              │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│   │ User Behavior   │  │ Content Safety  │  │ Agent Activity  │            │
│   │ Anomaly         │  │ Violation       │  │ Escalation      │            │
│   └────────┬────────┘  └────────┬────────┘  └────────┬────────┘            │
│            │                    │                    │                      │
│            └────────────────────┴────────────────────┘                      │
│                                 │                                           │
│                                 ▼                                           │
│                    ┌─────────────────────────┐                             │
│                    │    SSF TRANSMITTER      │                             │
│                    │  (Think Tank → Cato)    │                             │
│                    └────────────┬────────────┘                             │
│                                 │                                           │
│   ══════════════════════════════╪══════════════════════════════════════    │
│                                 │                                           │
│                                 ▼                                           │
│                    ┌─────────────────────────┐                             │
│                    │    SSF RECEIVER         │                             │
│                    │  (Cato → Think Tank)    │                             │
│                    └────────────┬────────────┘                             │
│                                 │                                           │
│            ┌────────────────────┼────────────────────┐                      │
│            │                    │                    │                      │
│            ▼                    ▼                    ▼                      │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│   │ Session Revoke  │  │ Threat Detected │  │ Genesis Alert   │            │
│   │ → Terminate     │  │ → Restrict      │  │ → Pause Agents  │            │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### SSF Events Emitted by Think Tank

| Event Type | Trigger | Recipient Action |
|------------|---------|------------------|
| `thinktank.behavior.anomaly` | User behavior deviates significantly from baseline | Cato increases monitoring |
| `thinktank.content.violation` | User attempts prohibited content | Identity provider notified |
| `thinktank.agent.escalation` | Agent requires human approval | Mission Control alerted |
| `thinktank.session.suspicious` | Multiple failed attempts or unusual patterns | Cato may revoke session |
| `thinktank.data.exfiltration_attempt` | Suspected data extraction attempt | Block and investigate |

#### SSF Events Consumed by Think Tank

| Event Type | Source | Think Tank Action |
|------------|--------|-------------------|
| `session-revoked` | Identity Provider | Immediately terminate user session |
| `credential-change` | Identity Provider | Force re-authentication |
| `threat-detected` | Cato SASE | Restrict agent capabilities |
| `genesis.alert` | Genesis Reactor | Pause all non-critical agents |
| `device-compliance-change` | MDM/EDR | Re-evaluate user permissions |

### 37.3 Continuous Access Evaluation Profile (CAEP)

**CAEP** extends SSF with specific event types designed for continuous session validation. Unlike traditional session timeouts, CAEP enables **real-time session adjustment** based on security signals.

#### CAEP Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CAEP SESSION LIFECYCLE IN THINK TANK                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. SESSION START                                                           │
│      ┌──────────────────────────────────────────────────────────────────┐   │
│      │ User authenticates → Session created → CAEP listener registered  │   │
│      └──────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   2. CONTINUOUS EVALUATION (every CAEP event)                               │
│      ┌──────────────────────────────────────────────────────────────────┐   │
│      │                                                                   │   │
│      │   CAEP Event Received → Evaluate Impact → Adjust Session         │   │
│      │                                                                   │   │
│      │   Example: IP Change                                             │   │
│      │   ├─ Same country? → Log only                                    │   │
│      │   ├─ Different country? → Step-up authentication                 │   │
│      │   └─ Impossible travel? → Terminate session                      │   │
│      │                                                                   │   │
│      └──────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   3. SESSION TERMINATION                                                     │
│      ┌──────────────────────────────────────────────────────────────────┐   │
│      │ CAEP revoke signal OR user logout OR timeout → Clean termination │   │
│      │ → Preserve conversation state → Clear credentials → Audit log    │   │
│      └──────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### CAEP Configuration for Think Tank

```yaml
# caep-thinktank.config.yaml
caep:
  enabled: true
  
  session_management:
    # How to handle IP changes
    ip_change_policy:
      same_country: log_only
      different_country: step_up_auth
      impossible_travel: terminate_session
      impossible_travel_threshold_hours: 2
    
    # How to handle device changes
    device_change_policy:
      known_device: allow
      unknown_device_trusted_location: step_up_auth
      unknown_device_unknown_location: terminate_session
    
    # How to handle credential events
    credential_change_policy:
      password_change: force_reauth
      mfa_change: force_reauth
      role_change: re_evaluate_permissions
  
  agent_restrictions:
    # During security events, restrict agent capabilities
    during_threat_detected:
      disable_autonomous_actions: true
      disable_external_api_calls: true
      require_human_approval_all: true
      
    during_genesis_alert:
      pause_all_agents: true
      preserve_state: true
      notify_administrators: true
```

### 37.4 Autonomous Identity Remediation

Think Tank agents can perform **autonomous identity remediation**—cleaning up identity data quality issues without human intervention. This capability requires careful configuration to balance efficiency with safety.

#### Remediation Capabilities

| Action | Autonomous? | Conditions |
|--------|-------------|------------|
| **Remove Orphan Account** | Yes | Inactive 90+ days, no entitlements, no recent auth |
| **Disable Stale Service Account** | Yes | Unused 180+ days, not in critical systems |
| **Fix Group Membership Inconsistency** | Yes | Source of truth mismatch detected |
| **Delete Human Account** | **No** | Always requires human approval |
| **Revoke Admin Privileges** | **No** | Always requires human approval |
| **Bulk Operations (100+)** | **No** | Always requires human approval |

#### Remediation Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTONOMOUS REMEDIATION WORKFLOW                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. DETECTION                                                               │
│      Agent scans Identity Fabric for anomalies                              │
│      ├─ Orphan accounts (no manager, no recent activity)                    │
│      ├─ Stale service accounts (unused beyond threshold)                    │
│      └─ Inconsistent group memberships (source mismatch)                    │
│                                                                              │
│   2. VALIDATION                                                              │
│      ├─ Verify anomaly against multiple data sources                        │
│      ├─ Check against exclusion lists (VIPs, system accounts)              │
│      ├─ Confirm remediation action is within autonomous scope              │
│      └─ Verify Genesis Interlock allows action (no active alerts)          │
│                                                                              │
│   3. EXECUTION                                                               │
│      ├─ If autonomous: Execute immediately, log action                      │
│      └─ If requires approval: Create Mission Control escalation            │
│                                                                              │
│   4. VERIFICATION                                                            │
│      ├─ Confirm action completed successfully                               │
│      ├─ Verify no unintended side effects                                  │
│      └─ Update remediation statistics                                       │
│                                                                              │
│   5. LEARNING                                                                │
│      ├─ If action succeeded: Reinforce pattern                             │
│      └─ If action failed or reversed: Flag for human review                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Remediation Configuration

Navigate to **Think Tank → Identity → Remediation** in admin dashboard:

```yaml
# identity-remediation-thinktank.config.yaml
identity_remediation:
  enabled: true
  
  # Autonomous action limits
  autonomous_limits:
    max_per_hour: 50
    max_per_day: 200
    cooldown_after_error_minutes: 30
    
  # Detection criteria
  detection:
    orphan_account:
      inactive_days_threshold: 90
      require_no_entitlements: true
      require_no_recent_auth: true
      exclude_patterns:
        - "*-system@*"
        - "*-service@*"
        - "admin@*"
        
    stale_service_account:
      unused_days_threshold: 180
      exclude_critical_systems: true
      critical_system_tags:
        - genesis
        - security
        - auth
        
    group_membership:
      check_source_of_truth: true
      sources:
        - active_directory
        - scim_provider
        - hr_system
  
  # Notification settings
  notifications:
    notify_on_autonomous_action: true
    notify_recipients:
      - security_team
      - identity_admins
    daily_summary: true
    
  # Genesis Interlock integration
  genesis_interlock:
    pause_during: [GEN-300, GEN-400, GEN-500]
    resume_automatically: true
```

### 37.5 The Radiant Ghost in Think Tank

The **Radiant Ghost** metaphor extends to Think Tank's user interface, providing visual feedback about agent activity.

#### Ghost States in Think Tank UI

| State | Indicator | Meaning | User Action |
|-------|-----------|---------|-------------|
| **Idle** | Faint outline | No active agents | None |
| **Thinking** | Soft pulse | Agent processing request | Wait |
| **Researching** | Searching animation | Agent gathering information | Wait |
| **Writing** | Typing animation | Agent generating response | Watch |
| **Validating** | Checkmark animation | Agent verifying output | Wait |
| **Escalating** | Orange pulse | Agent needs human input | Respond |
| **Alert** | Red pulse | Security or safety event | Investigate |

#### Ghost Configuration

```yaml
# ghost-ui.config.yaml
ghost_ui:
  enabled: true
  
  # Visual settings
  visuals:
    idle_opacity: 0.3
    active_opacity: 0.8
    alert_opacity: 1.0
    animation_speed: normal  # slow, normal, fast
    
  # State display
  states:
    show_thinking: true
    show_researching: true
    show_writing: true
    show_validating: true
    show_escalating: true
    show_alert: true
    
  # Accessibility
  accessibility:
    respect_reduced_motion: true
    provide_text_status: true
    screen_reader_announcements: true
```

### 37.6 Database Tables

| Table | Purpose |
|-------|---------|
| `ssf_events_emitted` | SSF events sent by Think Tank |
| `ssf_events_received` | SSF events received by Think Tank |
| `caep_session_events` | CAEP session lifecycle events |
| `identity_remediation_log` | All remediation actions |
| `identity_remediation_errors` | Failed remediation attempts |
| `ghost_state_log` | Ghost UI state transitions |

### 37.7 API Endpoints

Base: `/api/thinktank/security`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ssf/status` | SSF integration status |
| GET | `/ssf/events` | Recent SSF events |
| POST | `/ssf/emit` | Manually emit SSF event (admin only) |
| GET | `/caep/session` | Current session CAEP status |
| GET | `/remediation/stats` | Remediation statistics |
| GET | `/remediation/log` | Remediation action log |
| POST | `/remediation/trigger` | Trigger manual remediation scan |
| GET | `/ghost/state` | Current Ghost state |

### 37.8 Implementation Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/ssf-thinktank.service.ts` | SSF emitter/receiver for Think Tank |
| `lambda/shared/services/caep-session.service.ts` | CAEP session management |
| `lambda/shared/services/identity-remediation-thinktank.service.ts` | Think Tank remediation agent |
| `lambda/thinktank/security-events.ts` | Security event API handler |
| `components/thinktank/ghost-indicator.tsx` | Ghost UI component |
| `migrations/165_agentic_orchestration.sql` | Database schema |
| `config/security/ssf-events.yaml` | SSF event definitions |
| `config/security/caep-policies.yaml` | CAEP policy configuration |

---

## 38. Advanced Features (v4.18.0)

This section covers new advanced features implemented for Think Tank.

### 38.1 Flash Facts (Knowledge Sparks)

Fast-access factual memory system for quick retrieval of verified facts.

**UI Metaphor: "Knowledge Sparks"** - Contextual sidebar widget showing relevant facts as glowing spark icons.

**Features:**
- CRUD operations for facts with confidence scoring
- Semantic search using vector embeddings
- Automatic fact extraction from conversations
- Fact verification workflow
- Usage tracking and statistics

**API Endpoints (Base: `/api/thinktank/flash-facts`):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List facts with filtering |
| POST | `/` | Create a new fact |
| GET | `/:id` | Get a specific fact |
| PUT | `/:id` | Update a fact |
| DELETE | `/:id` | Delete a fact |
| POST | `/query` | Semantic search for facts |
| POST | `/extract` | Extract facts from conversation |
| POST | `/:id/verify` | Verify a fact |
| GET | `/stats` | Get usage statistics |

**Database Tables:**
- `flash_facts` - Fact storage with embeddings
- `flash_facts_config` - Per-tenant configuration

---

### 38.2 Grimoire (Spell Book)

Procedural memory system for storing and executing reusable patterns.

**UI Metaphor: "Spell Book"** - Magical tome with spell cards organized by schools of magic.

**Schools of Magic:**
| School | Icon | Purpose |
|--------|------|---------|
| Code | 💻 | Programming patterns |
| Data | 📊 | Data manipulation |
| Text | 📝 | Text processing |
| Analysis | 🔍 | Analytical methods |
| Design | 🎨 | UI/UX patterns |
| Integration | 🔗 | API integrations |
| Automation | ⚙️ | Workflow automation |
| Universal | 🌟 | Cross-domain spells |

**Spell Categories:**
- Transformation, Divination, Conjuration, Abjuration
- Enchantment, Illusion, Necromancy, Evocation

**API Endpoints (Base: `/api/thinktank/grimoire`):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get grimoire overview |
| GET | `/spells` | List all spells |
| POST | `/spells` | Create a new spell |
| GET | `/spells/:id` | Get spell details |
| PUT | `/spells/:id` | Update a spell |
| DELETE | `/spells/:id` | Delete a spell |
| POST | `/spells/:id/cast` | Cast a spell |
| POST | `/spells/:id/learn` | Learn from failure |
| GET | `/schools` | Get schools of magic |
| GET | `/categories` | Get spell categories |
| POST | `/match` | Find matching spell |
| POST | `/promote` | Promote pattern to spell |

---

### 38.3 Economic Governor (Fuel Gauge)

Model arbitrage and cost optimization system.

**UI Metaphor: "Fuel Gauge"** - Visual meter showing budget remaining with color-coded status.

**Governor Modes:**
| Mode | Description |
|------|-------------|
| `cost_minimizer` | Always cheapest viable option |
| `quality_maximizer` | Best quality within budget |
| `balanced` | Balance cost and quality |
| `latency_focused` | Prioritize response speed |
| `custom` | Use custom arbitrage rules |

**Model Tiers:**
- Economy (🌱) - Cheapest, simple tasks
- Self-Hosted (🏠) - On-premise models
- Standard (📊) - Default tier
- Premium (💎) - Higher quality
- Flagship (🚀) - Best available

**API Endpoints (Base: `/api/thinktank/governor`):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get dashboard with fuel gauge |
| GET | `/config` | Get configuration |
| PUT | `/config` | Update configuration |
| PUT | `/mode` | Quick mode switch |
| POST | `/recommend` | Get model recommendation |
| GET | `/metrics` | Get cost metrics |
| GET | `/budget` | Get budget status |
| PUT | `/budget` | Update budget limit |
| GET | `/tiers` | Get model tiers |
| PUT | `/tiers/:tier` | Update tier config |
| GET | `/rules` | Get arbitrage rules |
| POST | `/rules` | Add arbitrage rule |
| PUT | `/rules/:id` | Update rule |
| DELETE | `/rules/:id` | Delete rule |

---

### 38.4 Sentinel Agents (Watchtower Dashboard)

Event-driven autonomous agents for monitoring and automation.

**UI Metaphor: "Watchtower Dashboard"** - Castle towers watching over different domains.

**Agent Types:**
| Type | Icon | Purpose |
|------|------|---------|
| Monitor | 👁️ | Passive watchdog - observes and alerts |
| Guardian | 🛡️ | Protective - can block harmful actions |
| Scout | 🔭 | Proactive information gathering |
| Herald | 📯 | Notifications and announcements |
| Arbiter | ⚖️ | Decision making and routing |

**Agent Status:**
- Idle (⚪), Watching (🟢), Triggered (🟡), Cooldown (🔵), Disabled (🔴)

**API Endpoints (Base: `/api/thinktank/sentinels`):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all agents |
| POST | `/` | Create agent |
| GET | `/:id` | Get agent details |
| PUT | `/:id` | Update agent |
| DELETE | `/:id` | Delete agent |
| POST | `/:id/trigger` | Manually trigger |
| POST | `/:id/enable` | Enable agent |
| POST | `/:id/disable` | Disable agent |
| GET | `/:id/events` | Get agent events |
| GET | `/events` | All events |
| GET | `/stats` | Statistics |
| GET | `/types` | Available types |

---

### 38.5 Time-Travel Debugging (Timeline Scrubber)

Conversation forking and state replay system.

**UI Metaphor: "Timeline Scrubber"** - Horizontal timeline with draggable playhead and fork points.

**Checkpoint Types:**
| Type | Icon | Description |
|------|------|-------------|
| Auto | ⚪ | Automatic checkpoint |
| Manual | 📍 | User-created |
| Fork | 🌿 | Branch point |
| Merge | 🔀 | Merged timelines |
| Rollback | ⏪ | After rollback |

**API Endpoints (Base: `/api/thinktank/time-travel`):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/timelines` | List timelines |
| POST | `/timelines` | Create timeline |
| GET | `/timelines/:id` | Get timeline view |
| POST | `/timelines/:id/checkpoint` | Create checkpoint |
| POST | `/timelines/:id/jump` | Jump to checkpoint |
| POST | `/timelines/:id/fork` | Fork timeline |
| POST | `/timelines/:id/replay` | Replay sequence |
| GET | `/checkpoints/:id` | Get checkpoint |

---

### 38.6 Council of Rivals (Debate Arena)

Multi-model adversarial consensus system.

**UI Metaphor: "Debate Arena"** - Amphitheater with model avatars debating in a circular arrangement.

**Member Roles:**
| Role | Icon | Purpose |
|------|------|---------|
| Advocate | 📣 | Argues for a position |
| Critic | 🔍 | Challenges positions |
| Synthesizer | 🔮 | Combines perspectives |
| Specialist | 🎓 | Domain expert |
| Contrarian | 😈 | Devil's advocate |

**Preset Councils:**
- **Balanced** (⚖️) - Diverse perspectives
- **Technical** (🔧) - Expert technical review
- **Creative** (🎨) - Creative exploration

**Verdict Outcomes:**
- Consensus (🤝), Majority (✋), Split (⚖️), Deadlock (🔒), Synthesized (🔮)

**API Endpoints (Base: `/api/thinktank/council`):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List councils |
| POST | `/` | Create council |
| POST | `/preset` | Create preset council |
| GET | `/:id` | Get council |
| PUT | `/:id` | Update council |
| DELETE | `/:id` | Delete council |
| POST | `/:id/debate` | Start debate |
| GET | `/debate/:id` | Get debate |
| POST | `/debate/:id/argument` | Submit argument |
| POST | `/debate/:id/rebuttal` | Submit rebuttal |
| POST | `/debate/:id/vote` | Conduct voting |
| GET | `/presets` | Get preset options |

---

### 38.7 Security Signals (Security Shield)

SSF/CAEP integration for identity security events.

**UI Metaphor: "Security Shield"** - Animated shield with real-time threat visualization.

**Signal Types:**
| Type | Icon | Description |
|------|------|-------------|
| Session Revoked | 🔐 | SSF session terminated |
| Credential Change | 🔑 | Password/key changed |
| Device Compliance | 📱 | CAEP compliance change |
| Risk Change | 📊 | Risk level changed |
| Anomaly Detected | 🔍 | Behavioral anomaly |
| Threat Detected | ⚠️ | Active threat |
| Policy Violation | 🚫 | Policy breach |

**Severity Levels:** Critical (🔴), High (🟠), Medium (🟡), Low (🟢), Info (🔵)

**API Endpoints (Base: `/api/thinktank/security`):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Security dashboard |
| GET | `/signals` | List signals |
| POST | `/signals` | Create signal |
| GET | `/signals/:id` | Get signal |
| PUT | `/signals/:id/status` | Update status |
| GET | `/policies` | List policies |
| POST | `/policies` | Create policy |
| PUT | `/policies/:id` | Update policy |
| DELETE | `/policies/:id` | Delete policy |
| POST | `/ssf/event` | Ingest SSF event |
| POST | `/caep/event` | Ingest CAEP event |

---

### 38.8 Policy Framework (Stance Compass)

Strategic intelligence and regulatory stance configuration.

**UI Metaphor: "Stance Compass"** - Radial chart showing policy positions across domains.

**Policy Domains:**
| Domain | Icon | Description |
|--------|------|-------------|
| AI Safety | 🤖 | AI alignment and safety |
| Data Privacy | 🔒 | Data protection regulations |
| Content Moderation | 📝 | Content policies |
| Accessibility | ♿ | Accessibility requirements |
| Sustainability | 🌱 | Environmental considerations |
| Security | 🛡️ | Cybersecurity posture |
| Transparency | 👁️ | AI transparency |
| Ethics | ⚖️ | Ethical AI principles |
| Compliance | 📋 | Regulatory compliance |
| Innovation | 💡 | Innovation balance |

**Stance Positions:**
- Restrictive (🔴), Cautious (🟠), Balanced (🟡), Permissive (🟢), Adaptive (🔵)

**Preset Profiles:**
- **Conservative** - Maximum safety, minimal risk
- **Balanced** - Middle ground
- **Innovative** - Emphasis on innovation

**API Endpoints (Base: `/api/thinktank/policy`):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/compass` | Get compass view |
| GET | `/domains` | Get available domains |
| GET | `/positions` | Get stance positions |
| GET | `/stances` | List stances |
| POST | `/stances` | Create stance |
| GET | `/stances/:domain` | Get domain stance |
| PUT | `/stances/:id` | Update stance |
| GET | `/profiles` | List profiles |
| GET | `/profiles/active` | Get active profile |
| POST | `/profiles` | Create profile |
| POST | `/profiles/preset` | Create preset profile |
| PUT | `/profiles/:id/activate` | Activate profile |
| GET | `/recommendations` | Get recommendations |
| GET | `/compliance` | Check compliance |

---

### 38.9 Database Migration

All features use migration `100_thinktank_advanced_features.sql` with the following tables:

| Table | Feature |
|-------|---------|
| `flash_facts` | Flash Facts storage |
| `flash_facts_config` | Flash Facts config |
| `grimoire_spells` | Grimoire spells |
| `grimoire_casts` | Spell cast history |
| `grimoire_achievements` | User achievements |
| `economic_governor_config` | Governor config |
| `economic_governor_usage` | Usage tracking |
| `sentinel_agents` | Sentinel agents |
| `sentinel_events` | Agent events |
| `time_travel_timelines` | Timelines |
| `time_travel_checkpoints` | Checkpoints |
| `time_travel_forks` | Fork records |
| `council_of_rivals` | Councils |
| `council_debates` | Debates |
| `security_signals` | Security signals |
| `security_policies` | Security policies |
| `policy_stances` | Policy stances |
| `policy_profiles` | Policy profiles |

---

## 39. Liquid Interface (Generative UI)

### 39.1 Overview

**"Don't Build the Tool. BE the Tool."**

The Liquid Interface transforms the chat interface into dynamic, morphable UI tools based on user intent. Instead of asking "help me make a spreadsheet app," the chat *becomes* the spreadsheet.

**Core Concept:**
- User says: "Help me track my invoices"
- Chat morphs into: Invoice tracker with data grid, totals, AI assistant sidebar
- User interacts: Add, edit, filter invoices directly
- AI watches: Ghost State binds UI actions to AI context
- Export: "Eject" to a deployable Next.js/Vite app

**Key Benefits:**
- **Zero-friction prototyping** - Ideas become tools instantly
- **Two-way AI binding** - AI sees what you're doing, UI reflects what AI knows
- **Production export** - Ephemeral apps become real codebases
- **50+ morphable components** - Data grids, charts, kanban, calendars, code editors

---

### 39.2 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Message                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Intent Detection                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ data_analysis│  │  tracking   │  │visualization│   ...       │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Schema Generation                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ LiquidSchema {                                               ││
│  │   layout: { type: 'split', children: [...] }                 ││
│  │   bindings: [{ sourceComponent, contextKey, direction }]     ││
│  │   aiOverlay: { mode: 'sidebar', position: 'right' }          ││
│  │ }                                                            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Liquid Renderer                               │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐                │
│  │DataGrid│  │ Chart  │  │ Kanban │  │AI Chat │                │
│  └────────┘  └────────┘  └────────┘  └────────┘                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Ghost State Manager                           │
│  UI Events ──► AI Context                                        │
│  AI Updates ◄── UI Components                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

### 39.3 Component Registry

**50+ pre-built morphable components** across 9 categories:

| Category | Components | Description |
|----------|------------|-------------|
| **Data** (10) | DataGrid, PivotTable, DataCard, JSONViewer, SQLViewer, CSVEditor, DataFilter, SchemaDesigner, DataDiff, DataImport | Spreadsheets, tables, data viewers |
| **Visualization** (10) | LineChart, BarChart, PieChart, ScatterPlot, AreaChart, Heatmap, Treemap, GeoMap, Timeline, SankeyDiagram | Charts, graphs, maps |
| **Productivity** (10) | KanbanBoard, Calendar, GanttChart, TodoList, NotesEditor, Timer, HabitTracker, MindMap, Whiteboard, FileManager | Task & project management |
| **Finance** (6) | Invoice, BudgetTracker, ExpenseTable, Portfolio, Calculator, CurrencyConverter | Financial tools |
| **Code** (6) | CodeEditor, Terminal, DiffViewer, APITester, RegexTester, JSONFormatter | Developer tools |
| **AI** (4) | AIChat, InsightCard, SuggestionPanel, ContextInspector | AI-powered widgets |
| **Input** (4) | FormBuilder, SliderPanel, DateRangePicker, SearchBox | User input forms |

**Component Definition:**
```typescript
interface LiquidComponent {
  id: string;                    // e.g., 'data-grid'
  name: string;                  // e.g., 'DataGrid'
  category: ComponentCategory;   // e.g., 'data'
  propsSchema: JSONSchema;       // Component props
  eventsSchema: JSONSchema;      // Emitted events
  supportsInteraction: boolean;
  supportsDataBinding: boolean;
  supportsAIContext: boolean;
  defaultSize: { width, height };
  icon: string;
  tags: string[];
}
```

---

### 39.4 Ghost State (Two-Way Binding)

**"The AI sees what you're doing. The UI reflects what AI knows."**

Ghost State creates bidirectional bindings between UI components and AI context:

```
┌─────────────────┐                    ┌─────────────────┐
│   UI Component  │◄────────────────►  │   AI Context    │
│                 │                    │                 │
│ selectedRow: 5  │   GhostBinding     │ user_selection  │
│ filterValue: X  │ ────────────────►  │ applied_filter  │
│                 │ ◄────────────────  │                 │
│ [AI updates]    │   AI Reaction      │ insight: "..."  │
└─────────────────┘                    └─────────────────┘
```

**Binding Configuration:**
```typescript
interface GhostBinding {
  id: string;
  sourceComponent: string;    // UI component ID
  sourceProperty: string;     // e.g., 'selectedRow'
  contextKey: string;         // AI context key
  direction: 'ui_to_ai' | 'ai_to_ui' | 'bidirectional';
  debounceMs?: number;        // Debounce rapid changes
  triggerReaction?: boolean;  // Trigger AI response on change
  reactionPrompt?: string;    // Custom prompt for reaction
}
```

**AI Reactions:**
When users interact with morphed UI, the AI can react with:
- `speak` - Send a message
- `update` - Update UI state
- `morph` - Transform to different layout
- `suggest` - Show suggestion panel

---

### 39.5 Intent Detection

Intent detection determines when and how to morph the UI:

| Intent Category | Trigger Phrases | Default Components |
|-----------------|-----------------|-------------------|
| `data_analysis` | spreadsheet, excel, csv, analyze data | DataGrid, PivotTable |
| `tracking` | track invoices, manage expenses | Invoice, ExpenseTable, Kanban |
| `visualization` | chart, graph, visualize, show metrics | LineChart, BarChart, Dashboard |
| `planning` | plan project, timeline, kanban | KanbanBoard, GanttChart |
| `calculation` | calculate, compute, formula | Calculator, DataGrid |
| `design` | design, wireframe, brainstorm | Whiteboard, MindMap |
| `coding` | code, debug, terminal | CodeEditor, Terminal |
| `writing` | write, draft, notes | NotesEditor, MindMap |

**Morph Threshold:** `confidence >= 0.85` (configurable per tenant)

---

### 39.6 Eject to App

**"The Takeout Button"** - Export ephemeral liquid apps to real codebases.

**Supported Frameworks:**
- **Next.js 14** - Full-stack React with API routes
- **Vite + React** - Fast client-side SPA
- **Remix** - Web standards framework
- **Astro** - Content-focused sites

**Features to Include:**
| Feature | Description |
|---------|-------------|
| `database` | PGLite → Postgres migration, Drizzle ORM |
| `auth` | NextAuth scaffolding |
| `api` | API routes for data operations |
| `ai` | OpenAI integration |
| `realtime` | WebSocket support |

**Generated Files:**
```
my-liquid-app/
├── package.json
├── next.config.mjs / vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── app/page.tsx (or src/App.tsx)
├── components/
│   ├── LiquidLayout.tsx
│   ├── DataGrid.tsx
│   ├── ...
├── store/index.ts (Zustand)
├── types/index.ts
├── lib/db.ts (if database)
├── lib/ai.ts (if ai)
├── README.md
├── .env.example
└── .gitignore
```

---

### 39.7 Configuration

**Per-Tenant Configuration:**

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Enable Liquid Interface |
| `auto_morph_enabled` | `true` | Auto-morph on high-confidence intent |
| `eject_enabled` | `true` | Allow app export |
| `morph_confidence_threshold` | `0.85` | Minimum confidence to morph |
| `auto_revert_timeout_seconds` | `300` | Auto-revert to chat after inactivity |
| `max_active_sessions` | `10` | Max concurrent liquid sessions |
| `max_ghost_events_per_session` | `1000` | Event history limit |
| `default_overlay_mode` | `sidebar` | AI overlay mode |
| `default_overlay_position` | `right` | AI overlay position |

---

### 39.8 API Endpoints

**Base: `/api/thinktank/liquid`**

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Registry** | | |
| GET | `/registry` | Get registry overview |
| GET | `/registry/components` | List components (filter: `?category=`, `?q=`) |
| GET | `/registry/components/:id` | Get component details |
| **Sessions** | | |
| POST | `/sessions` | Create new session |
| GET | `/sessions/:id` | Get session |
| **Morphing** | | |
| POST | `/morph` | Process morph request |
| POST | `/detect-intent` | Detect intent from message |
| POST | `/sessions/:id/revert` | Revert to chat mode |
| **Ghost State** | | |
| POST | `/ghost/event` | Send ghost event |
| GET | `/ghost/state/:sessionId` | Get ghost state snapshot |
| POST | `/ghost/sync` | Sync multiple state updates |
| GET | `/ghost/history/:sessionId` | Get event history |
| GET | `/ghost/context/:sessionId` | Get AI context block |
| **Eject** | | |
| POST | `/eject` | Eject to app |
| POST | `/eject/preview` | Preview eject |
| **Analytics** | | |
| GET | `/analytics/usage` | Component usage stats |

---

### 39.9 Database Tables

| Table | Purpose |
|-------|---------|
| `liquid_sessions` | Active liquid interface sessions |
| `liquid_ghost_state` | Persisted ghost state bindings |
| `liquid_ghost_events` | User interaction events |
| `liquid_ai_reactions` | AI responses to events |
| `liquid_eject_history` | App export history |
| `liquid_component_usage` | Component analytics |
| `liquid_intent_patterns` | Learnable intent patterns |
| `liquid_config` | Per-tenant configuration |

---

### 39.10 Implementation Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types/liquid-interface.types.ts` | Type definitions |
| `lambda/shared/services/liquid-interface/liquid-interface.service.ts` | Main service |
| `lambda/shared/services/liquid-interface/ghost-state.service.ts` | Ghost state manager |
| `lambda/shared/services/liquid-interface/eject.service.ts` | App export service |
| `lambda/shared/services/liquid-interface/component-registry.ts` | 50+ components |
| `lambda/thinktank/liquid-interface.ts` | API handler |
| `migrations/161_liquid_interface.sql` | Database schema |

---

## 40. The Reality Engine

> **"The Reality Engine transforms Think Tank from a chatbot into a shape-shifting command center with time travel, parallel universes, and telepathy."**

The Reality Engine is the unified runtime powering Think Tank's supernatural capabilities. It consists of four interconnected features that solve the three fundamental anxieties preventing users from trusting AI with complex work: **Fear** (of breaking what works), **Commitment** (fear of choosing the wrong path), and **Latency** (waiting for the AI to think).

### 40.1 Feature Overview

| Feature | Emotion | Pitch |
|---------|---------|-------|
| **Morphic UI** | Flow | "Stop hunting for the right tool. Radiant is a Morphic Surface that shapeshifts instantly." |
| **Reality Scrubber** | Invincibility | "We replaced 'Undo' with Time Travel. Scrub reality back to any point." |
| **Quantum Futures** | Omniscience | "Why choose one strategy? Split the timeline and run both simultaneously." |
| **Pre-Cognition** | Telepathy | "Radiant answers before you ask. It's not just fast; it's anticipatory." |

### 40.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THE REALITY ENGINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐     │
│   │   MORPHIC UI     │    │ REALITY SCRUBBER │    │ QUANTUM FUTURES  │     │
│   │   ════════════   │    │   ════════════   │    │   ════════════   │     │
│   │                  │    │                  │    │                  │     │
│   │ Intent Detection │    │ State Snapshots  │    │ Branch Manager   │     │
│   │ Layout Engine    │    │ VFS + PGLite     │    │ Diff Engine      │     │
│   │ Ghost State      │    │ Timeline UI      │    │ Collapse Logic   │     │
│   │ Component Reg.   │    │ Bookmark System  │    │ Dream Archive    │     │
│   │                  │    │                  │    │                  │     │
│   └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘     │
│            │                       │                       │                │
│            └───────────────────────┼───────────────────────┘                │
│                                    │                                        │
│                      ┌─────────────▼─────────────┐                          │
│                      │      PRE-COGNITION        │                          │
│                      │      ═══════════════      │                          │
│                      │                           │                          │
│                      │   Intent Prediction       │                          │
│                      │   Solution Pre-Compute    │                          │
│                      │   Genesis Model (Local)   │                          │
│                      │   Instant Delivery        │                          │
│                      │                           │                          │
│                      └───────────────────────────┘                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 40.3 Morphic UI

**"Stop hunting for the right tool. Radiant is a Morphic Surface that shapeshifts instantly."**

The Morphic UI detects user intent and transforms the interface into the appropriate tool.

#### Intent Categories

| Intent | Detected Patterns | Morphs To |
|--------|-------------------|-----------|
| `data_analysis` | "analyze", "data", "statistics" | DataGrid, Charts |
| `tracking` | "track", "manage", "organize" | Kanban, Calendar |
| `visualization` | "visualize", "chart", "graph" | LineChart, PieChart, BarChart |
| `planning` | "plan", "schedule", "timeline" | GanttChart, Calendar |
| `finance` | "budget", "invoice", "expense" | Ledger, Calculator, Invoice |
| `design` | "brainstorm", "design", "whiteboard" | MindMap, Whiteboard |
| `coding` | "code", "debug", "script" | CodeEditor, Terminal |

#### Ghost State Binding

Every UI component is bidirectionally bound to AI context:

```typescript
// User selects a row → AI knows what they're focused on
ghostBinding: {
  componentProp: 'selectedRow',
  contextKey: 'user_focus',
  direction: 'ui_to_ai'
}

// AI insight → UI highlights relevant items
ghostBinding: {
  componentProp: 'highlights',
  contextKey: 'ai_suggestions',
  direction: 'ai_to_ui'
}
```

### 40.4 Reality Scrubber

**"We replaced 'Undo' with Time Travel."**

The Reality Scrubber captures full state snapshots and allows instant rewinding to any point.

#### What Gets Snapshotted

| State Type | Description |
|------------|-------------|
| **VFS State** | Virtual File System (all generated files) |
| **DB State** | PGLite database snapshot |
| **Ghost State** | All UI-AI bindings |
| **Chat Context** | Conversation history at that point |
| **Layout State** | Current morphed UI layout |

#### Trigger Events

| Event | When Captured |
|-------|---------------|
| `user_action` | User explicitly triggered |
| `ai_generation` | AI generated content |
| `db_mutation` | Database was modified |
| `morph_transition` | UI morphed |
| `checkpoint` | User-created bookmark |
| `auto_interval` | Every 30 seconds (configurable) |

#### Timeline UI

The Reality Scrubber replaces the standard scrollbar with a video-editor-style timeline:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            REALITY TIMELINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   10:00 AM     10:15 AM     10:30 AM     10:45 AM     11:00 AM    NOW      │
│     │            │            │            │            │          │        │
│     ●────────────●────────────●────────────🔖───────────●──────────◆        │
│     │            │            │            │            │          │        │
│   Start      AI Gen        Morph       Bookmark      Branch     Current    │
│                                           │                                  │
│                                           ▼                                  │
│                                    "Before risky change"                     │
│                                                                              │
│   [ ◀◀ ]  [ ◀ ]  ═══════════════●═══════════════════  [ ▶ ]  [ ▶▶ ]       │
│                              ▲                                               │
│                         Drag to scrub                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 40.5 Quantum Futures

**"Why choose one strategy? Split the timeline."**

Quantum Futures enables parallel reality branching where users can run multiple strategies simultaneously.

#### Branch Creation

```typescript
// User: "Should I use Redux or Zustand?"
await quantumFuturesService.createSplit({
  sessionId,
  prompt: "State management comparison",
  branchNames: ["Redux Implementation", "Zustand Implementation"],
  autoCompare: true
});
```

#### Comparison View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│   🔷 Redux Implementation          │   🔶 Zustand Implementation            │
├─────────────────────────────────────┼───────────────────────────────────────┤
│                                     │                                       │
│   ✅ Type safety                   │   ✅ Simpler setup                    │
│   ⚠️ Boilerplate                    │   ✅ Less boilerplate                 │
│   📊 Completion: 45%               │   📊 Completion: 60%                  │
│   💰 Est. Cost: $0.12              │   💰 Est. Cost: $0.08                 │
│                                     │                                       │
│   [Keep This Reality]              │   [Keep This Reality]                 │
│                                     │                                       │
└─────────────────────────────────────┴───────────────────────────────────────┘
```

#### Collapse to Winner

When the user selects a winner, the losing branches are either:
- **Collapsed**: Permanently removed
- **Archived**: Stored in "Dream Memory" for potential future recall

### 40.6 Pre-Cognition

**"Radiant answers before you ask."**

Pre-Cognition uses speculative execution to predict the user's next likely actions and pre-compute solutions in the background.

#### How It Works

1. **Prediction**: While user reads current response, Genesis model predicts next 3 likely moves
2. **Pre-Compute**: Solutions are generated in hidden background containers
3. **Instant Delivery**: When user's request matches a prediction, response appears instantly (0ms latency)

#### Prediction Algorithm

```typescript
// After building a login form, predict:
predictions: [
  { intent: 'coding', prompt: 'Add password reset', confidence: 0.8 },
  { intent: 'coding', prompt: 'Add OAuth integration', confidence: 0.7 },
  { intent: 'design', prompt: 'Style the form', confidence: 0.6 }
]
```

#### Analytics

| Metric | Description |
|--------|-------------|
| `hitRate` | Percentage of predictions that matched user intent |
| `avgLatencySaved` | Average milliseconds saved by pre-cognition |
| `telepathyScore` | User-facing metric showing prediction accuracy |

### 40.7 Configuration

```typescript
interface RealityEngineConfig {
  // Feature toggles
  morphicUIEnabled: boolean;          // Enable Morphic UI
  realityScrubberEnabled: boolean;    // Enable Reality Scrubber
  quantumFuturesEnabled: boolean;     // Enable Quantum Futures
  preCognitionEnabled: boolean;       // Enable Pre-Cognition
  
  // Behavior
  autoSnapshotIntervalMs: number;     // Default: 30000 (30s)
  maxSnapshotsPerSession: number;     // Default: 100
  maxBranchesPerSession: number;      // Default: 8
  codeCurtainDefault: boolean;        // Hide code by default (Genie mode)
  ephemeralByDefault: boolean;        // Apps dissolve when topic changes
  
  // Pre-Cognition
  preCognition: {
    maxPredictions: number;           // Default: 3
    predictionTTLMs: number;          // Default: 60000 (1 min)
    computeBudgetMs: number;          // Default: 5000 (5s)
    minConfidenceThreshold: number;   // Default: 0.6
    useGenesisModel: boolean;         // Use local model for predictions
  };
}
```

### 40.8 API Endpoints

Base path: `/api/thinktank/reality-engine`

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Session** | | |
| POST | `/session` | Initialize Reality Engine session |
| GET | `/session/:id` | Get session state |
| **Morphic UI** | | |
| POST | `/morph` | Morph interface to intent |
| POST | `/dissolve` | Dissolve morphed interface |
| POST | `/ghost` | Update Ghost State |
| **Reality Scrubber** | | |
| POST | `/scrub` | Scrub to point in time |
| POST | `/bookmark` | Create bookmark |
| GET | `/timeline/:sessionId` | Get timeline visualization |
| GET | `/bookmarks/:sessionId` | Get all bookmarks |
| **Quantum Futures** | | |
| POST | `/split` | Split into parallel realities |
| GET | `/branches/:sessionId` | Get all branches |
| POST | `/compare` | Compare two branches |
| POST | `/collapse` | Collapse to winning reality |
| PUT | `/view-mode` | Set comparison view mode |
| **Pre-Cognition** | | |
| GET | `/precognition/:sessionId` | Get analytics |
| POST | `/precognition/cleanup` | Clean up expired predictions |
| **Eject** | | |
| POST | `/eject` | Eject to standalone app |
| **Metrics** | | |
| GET | `/metrics/:sessionId` | Get session metrics |

### 40.9 Database Tables

| Table | Purpose |
|-------|---------|
| `reality_engine_sessions` | Unified session state |
| `reality_timelines` | Timeline structure and navigation |
| `reality_snapshots` | Full state snapshots for time travel |
| `quantum_branches` | Parallel reality branches |
| `quantum_splits` | Split configuration and history |
| `quantum_dream_archive` | Archived branches in dream memory |
| `precognition_queues` | Per-session prediction configuration |
| `precognition_predictions` | Pre-computed solutions |
| `precognition_analytics` | Hit/miss tracking for learning |

### 40.10 Implementation Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types/reality-engine.types.ts` | Type definitions |
| `lambda/shared/services/reality-engine/reality-engine.service.ts` | Main service |
| `lambda/shared/services/reality-engine/reality-scrubber.service.ts` | Time travel |
| `lambda/shared/services/reality-engine/quantum-futures.service.ts` | Branching |
| `lambda/shared/services/reality-engine/pre-cognition.service.ts` | Predictions |
| `lambda/thinktank/reality-engine.ts` | API handler |
| `migrations/162_reality_engine.sql` | Database schema |

### 40.11 The "Code Curtain" Rule

The Reality Engine enforces the distinction between "Builder" (Coder) and "Genie" (Radiant):

| Rule | Implementation |
|------|----------------|
| **Hide Code by Default** | UI snaps to Preview tab, not code |
| **Interaction over Syntax** | Variables become UI controls (sliders, inputs) |
| **Ephemeral by Default** | Apps dissolve when topic changes |
| **Eject to Keep** | Only persist to repo if user explicitly clicks "Keep This" |

> **"Radiant is a Genie, not a Coder. We use code as invisible ink to draw the interface—the user should never see the ink, only the drawing."**

---

## 41. The Magic Carpet

> **"We are building 'The Magic Carpet.' You don't drive it. You don't write code for it. You just say where you want to go, and the ground beneath you reshapes itself to take you there instantly."**

The Magic Carpet is the unified navigation and experience layer for Think Tank. It wraps the Reality Engine capabilities into a cohesive, magical user experience where users feel like magicians, not coders.

### 41.1 The Magic Carpet Philosophy

| Traditional Apps | Magic Carpet |
|------------------|--------------|
| Navigate menus | Speak your destination |
| Click through workflows | Fly directly there |
| Learn the interface | Interface learns you |
| You drive | You're carried |

**Core Insight:** We aren't selling a better IDE. We are selling **the feeling of being a Magician**.

### 41.2 Carpet Modes

| Mode | Description | Visual |
|------|-------------|--------|
| `resting` | Waiting for destination (chat-first) | Carpet gently floating |
| `flying` | Morphing/transitioning to destination | Trail effects, motion blur |
| `hovering` | Arrived, actively working | Stable, glowing edges |
| `exploring` | Quantum Futures - multiple realities | Split view, branch indicators |
| `rewinding` | Reality Scrubber - time traveling | Timeline visible, rewind effect |
| `anticipating` | Pre-Cognition active | Prediction cards appearing |

### 41.3 Carpet Altitudes

The altitude represents UI complexity level:

| Altitude | Complexity | Example |
|----------|------------|---------|
| `ground` | Simple chat mode | Just the chat interface |
| `low` | Single component | One morphed widget |
| `medium` | Full workspace | 2-3 components |
| `high` | Complex layout | 4-5 components + timeline |
| `stratosphere` | Maximum capability | Full Reality Engine features |

### 41.4 Default Destinations

| Destination | Icon | Description |
|-------------|------|-------------|
| Command Center | 🏠 | Overview dashboard |
| Workshop | 🔨 | Build and create |
| Time Stream | ⏳ | Reality Scrubber timeline |
| Quantum Realm | 🌌 | Parallel realities view |
| Oracle's Chamber | 🔮 | Pre-Cognition predictions |
| Gallery | 🖼️ | View creations |
| Vault | 🔐 | Saved/bookmarked items |

### 41.5 Carpet Commands

```typescript
// Fly to a destination
await magicCarpetService.command(carpetId, { 
  type: 'fly', 
  destination: 'Workshop' 
});

// Return to chat
await magicCarpetService.command(carpetId, { type: 'land' });

// Increase complexity
await magicCarpetService.command(carpetId, { type: 'ascend' });

// Time travel
await magicCarpetService.command(carpetId, { 
  type: 'rewind', 
  to: -2 // Go back 2 snapshots
});

// Split into parallel realities
await magicCarpetService.command(carpetId, { 
  type: 'branch', 
  options: ['Conservative Plan', 'Aggressive Plan'] 
});

// Collapse to winner
await magicCarpetService.command(carpetId, { 
  type: 'collapse', 
  winner: 'branch-id' 
});
```

### 41.6 Carpet Themes

Pre-built visual themes for personalization:

| Theme | Description | Gradient |
|-------|-------------|----------|
| Mystic Night | Deep purple mystical (default) | Indigo → Purple → Violet |
| Desert Sun | Warm golden | Amber → Orange → Brown |
| Ocean Deep | Cool blue aquatic | Cyan → Teal → Emerald |
| Cosmic Void | Dark minimalist | Gray gradient |
| Neon Circuit | Cyberpunk electric | Cyan → Purple → Pink |

### 41.7 Carpet Preferences

```typescript
interface CarpetPreferences {
  // Navigation
  autoFly: boolean;              // Auto-morph on intent detection
  smoothTransitions: boolean;    // Animated vs instant
  showJourneyTrail: boolean;     // Show navigation history
  
  // Pre-Cognition
  preCognitionEnabled: boolean;
  showPredictions: boolean;
  telepathyIntensity: 'subtle' | 'moderate' | 'aggressive';
  
  // Reality Scrubber
  showTimeline: boolean;
  autoSnapshot: boolean;
  snapshotInterval: number;      // Seconds
  
  // Quantum Futures
  maxParallelRealities: number;
  autoCompare: boolean;
  
  // Accessibility
  reducedMotion: boolean;
  highContrast: boolean;
  screenReaderMode: boolean;
}
```

### 41.8 Journey Navigation

The Magic Carpet tracks the user's journey:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MAGIC CARPET JOURNEY                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   🏠 ────► 🔨 ────► 🌌 ────► 🔮 ────► ◆                                      │
│   Command  Workshop  Quantum  Oracle   NOW                                   │
│   Center            Realm    Chamber                                         │
│                                                                              │
│   Click any point to fly back. Journey is saved with Reality Scrubber.      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 41.9 API Endpoints

Base path: `/api/thinktank/magic-carpet`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/summon` | Summon a new Magic Carpet |
| GET | `/:carpetId` | Get carpet state |
| POST | `/:carpetId/fly` | Fly to destination |
| POST | `/:carpetId/land` | Land (return to chat) |
| POST | `/:carpetId/command` | Execute a command |
| GET | `/:carpetId/journey` | Get journey history |
| PUT | `/:carpetId/theme` | Update theme |
| PUT | `/:carpetId/preferences` | Update preferences |
| GET | `/destinations` | Get available destinations |
| GET | `/themes` | Get available themes |

### 41.10 Database Tables

| Table | Purpose |
|-------|---------|
| `magic_carpets` | Carpet state and configuration |
| `carpet_destinations` | Pre-defined and custom destinations |
| `carpet_journey_points` | Navigation history |
| `carpet_themes` | Visual themes |
| `carpet_analytics` | Usage analytics |

### 41.11 Implementation Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types/magic-carpet.types.ts` | Type definitions |
| `lambda/shared/services/magic-carpet/magic-carpet.service.ts` | Main service |
| `migrations/163_magic_carpet.sql` | Database schema |

### 41.12 Integration with Reality Engine

The Magic Carpet wraps the Reality Engine:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MAGIC CARPET                                         │
│                    (User Experience Layer)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   "Fly to Workshop"  →  carpet.fly('workshop')                              │
│                              │                                               │
│                              ▼                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      REALITY ENGINE                                  │   │
│   │                   (Capability Layer)                                 │   │
│   ├─────────────────────────────────────────────────────────────────────┤   │
│   │                                                                      │   │
│   │   Morphic UI ◄──── Intent: 'coding'                                 │   │
│   │   Reality Scrubber ◄──── Auto-snapshot                              │   │
│   │   Pre-Cognition ◄──── Predict next destinations                     │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 42. Magic Carpet UI Components

The Magic Carpet UI is implemented through a set of React components that bring the 2026 UI/UX trends to life.

### 42.1 Component Inventory

| Component | Purpose | Location |
|-----------|---------|----------|
| `MagicCarpetNavigator` | Bottom navigation with journey trail | `magic-carpet/magic-carpet-navigator.tsx` |
| `RealityScrubberTimeline` | Video-editor timeline for state snapshots | `magic-carpet/reality-scrubber-timeline.tsx` |
| `QuantumSplitView` | Side-by-side reality comparison | `magic-carpet/quantum-split-view.tsx` |
| `PreCognitionSuggestions` | Predicted actions panel | `magic-carpet/pre-cognition-suggestions.tsx` |
| `AIPresenceIndicator` | AI cognitive/emotional state display | `magic-carpet/ai-presence-indicator.tsx` |
| `SpatialGlassCard` | Glassmorphism card with depth | `magic-carpet/spatial-glass-card.tsx` |
| `GlassPanel` | Large glass content area | `magic-carpet/spatial-glass-card.tsx` |
| `GlassButton` | Interactive glass button | `magic-carpet/spatial-glass-card.tsx` |
| `GlassBadge` | Status indicator with glass effect | `magic-carpet/spatial-glass-card.tsx` |
| `FocusModeControls` | Focus mode toggle and controls | `magic-carpet/focus-mode.tsx` |
| `FocusOverlay` | Dimming overlay for focus mode | `magic-carpet/focus-mode.tsx` |

### 42.2 Usage Examples

```tsx
import {
  MagicCarpetNavigator,
  RealityScrubberTimeline,
  QuantumSplitView,
  PreCognitionSuggestions,
  AIPresenceIndicator,
  SpatialGlassCard,
  FocusModeControls,
} from '@/components/thinktank/magic-carpet';

// Magic Carpet Navigator (bottom of screen)
<MagicCarpetNavigator
  currentDestination={{ id: 'workspace', name: 'Workshop', icon: '🔨' }}
  journey={journeyHistory}
  predictions={preCognizedActions}
  telepathyScore={0.82}
  mode="hovering"
  altitude="medium"
  onFly={(dest) => navigateTo(dest)}
  onLand={() => returnToChat()}
/>

// Reality Scrubber Timeline
<RealityScrubberTimeline
  snapshots={stateSnapshots}
  currentPosition={currentSnapshotIndex}
  onScrubTo={(position) => restoreSnapshot(position)}
  onCreateBookmark={(label) => bookmarkCurrentState(label)}
/>

// Quantum Split View
<QuantumSplitView
  branches={parallelRealities}
  onCollapse={(winnerId) => collapseToReality(winnerId)}
/>

// AI Presence Indicator
<AIPresenceIndicator
  state="thinking"
  affect={{ valence: 0.6, arousal: 0.4, curiosity: 0.8, confidence: 0.85 }}
  currentTask="Analyzing user intent..."
  modelName="claude-3.5-sonnet"
/>

// Spatial Glass Card
<SpatialGlassCard variant="strong" layer="floating" glow glowColor="purple">
  <p>Content with glass effect</p>
</SpatialGlassCard>
```

### 42.3 Dependencies

The Magic Carpet UI requires **framer-motion** for animations:

```bash
npm install framer-motion@^11.0.0
```

### 42.4 Demo Page

Access the Magic Carpet UI demo at:
```
/thinktank/magic-carpet
```

This page showcases all components with interactive examples.

---

## 43. Concurrent Task Execution (Moat #17)

**Moat Evaluation**: Score 20/30 - Tier 3 Feature Moat. No major competitor offers split-pane concurrent execution with WebSocket multiplexing.

### 43.1 Overview

Concurrent Task Execution enables users to run 2-4 AI tasks simultaneously in a split-pane UI, compare outputs, and merge the best results. This is a key differentiator vs. single-threaded competitors.

### 43.2 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Split-Pane UI                              │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│   Pane 1    │   Pane 2    │   Pane 3    │      Pane 4         │
│  Task A     │  Task B     │  Task C     │     Task D          │
│  (running)  │  (queued)   │  (complete) │    (streaming)      │
└─────────────┴─────────────┴─────────────┴─────────────────────┘
       ↓              ↓              ↓              ↓
┌─────────────────────────────────────────────────────────────────┐
│               WebSocket Multiplexer                             │
│  Channel isolation • Heartbeat • Reconnection • Sequencing      │
└─────────────────────────────────────────────────────────────────┘
       ↓              ↓              ↓              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Background Queue                               │
│  Priority scheduling • Max concurrent: 4 • Queue depth: 20     │
└─────────────────────────────────────────────────────────────────┘
```

### 43.3 Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Enable concurrent execution |
| `maxPanes` | `4` | Maximum split panes (1-8) |
| `maxConcurrentTasks` | `4` | Maximum simultaneous tasks (1-10) |
| `maxQueueDepth` | `20` | Maximum queued tasks (1-100) |
| `defaultLayout` | `horizontal-2` | Default pane layout |
| `defaultSyncMode` | `independent` | Default sync mode |
| `enableComparison` | `true` | Enable task comparison |
| `enableMerge` | `true` | Enable task merging |

### 43.4 Pane Layouts

| Layout | Description |
|--------|-------------|
| `single` | Full-width single pane |
| `horizontal-2` | Two panes side-by-side |
| `vertical-2` | Two panes stacked |
| `grid-4` | 2x2 grid of four panes |
| `focus-left` | Large left pane, small right |
| `focus-right` | Small left pane, large right |

### 43.5 Sync Modes

| Mode | Description |
|------|-------------|
| `independent` | Each pane operates independently |
| `mirror-input` | Same prompt sent to all panes |
| `compare-output` | Automatic comparison when all complete |

### 43.6 Task Comparison

When multiple tasks complete, users can compare results:

```typescript
// Compare completed tasks
const comparison = await compareTasks(tenantId, [taskId1, taskId2, taskId3]);

// Returns:
{
  similarities: [
    { metric: 'semantic', score: 0.85, details: 'High semantic similarity' },
    { metric: 'structural', score: 0.72, details: 'Moderate structural similarity' },
    { metric: 'factual', score: 0.91, details: 'Strong factual agreement' }
  ],
  differences: [...],
  recommendation: 'Results are mostly consistent. Review highlighted differences.'
}
```

### 43.7 Task Merging

Three merge strategies are available:

| Strategy | Description |
|----------|-------------|
| `best-of` | Select the highest-scored result |
| `combine` | Concatenate all results with separators |
| `consensus` | AI-synthesized consensus from all results |

### 43.8 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/thinktank/concurrent/config` | GET | Get configuration |
| `/api/thinktank/concurrent/config` | PUT | Update configuration |
| `/api/thinktank/concurrent/tasks` | POST | Create task |
| `/api/thinktank/concurrent/tasks/:id` | GET | Get task status |
| `/api/thinktank/concurrent/tasks/:id` | DELETE | Cancel task |
| `/api/thinktank/concurrent/queue` | GET | Get queue status |
| `/api/thinktank/concurrent/panes` | POST | Create pane config |
| `/api/thinktank/concurrent/compare` | POST | Compare tasks |
| `/api/thinktank/concurrent/merge` | POST | Merge tasks |
| `/api/thinktank/concurrent/metrics` | GET | Get metrics |

### 43.9 Database Tables

| Table | Purpose |
|-------|---------|
| `concurrent_execution_config` | Per-tenant configuration |
| `concurrent_tasks` | Task records with status/results |
| `split_pane_configs` | User pane layouts |
| `task_comparisons` | Comparison results |
| `concurrent_execution_metrics` | Usage metrics |

### 43.10 Implementation Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types/concurrent-execution.types.ts` | Type definitions |
| `lambda/shared/services/concurrent-execution.service.ts` | Core service |
| `lambda/thinktank/concurrent-execution.ts` | API handler |
| `migrations/170_concurrent_execution.sql` | Database schema |

---

## 44. Structure from Chaos Synthesis (Moat #20)

**Moat Evaluation**: Score 20/30 - Tier 3 Feature Moat. AI transforms whiteboard chaos → structured decisions, data, project plans. Think Tank differentiation vs Miro/Mural.

### 44.1 Overview

Structure from Chaos Synthesis takes unstructured input (whiteboards, brainstorms, meeting notes, voice transcripts) and transforms it into structured outputs (action items, decisions, project plans, knowledge bases).

### 44.2 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chaotic Input                                │
│  Whiteboard • Brainstorm • Meeting Notes • Voice Transcript     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 Synthesis Pipeline                              │
├─────────────────────────────────────────────────────────────────┤
│  1. Parse Input → 2. Extract Entities → 3. Identify Relations  │
│  4. Generate Structure → 5. Validate Output                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Structured Output                              │
│  Decisions • Action Items • Project Plan • Knowledge Base       │
└─────────────────────────────────────────────────────────────────┘
```

### 44.3 Input Types

| Type | Description | Example |
|------|-------------|---------|
| `whiteboard` | Visual whiteboard with sticky notes | Miro/FigJam export |
| `brainstorm` | Unstructured idea dump | Free-form text |
| `meeting_notes` | Notes from a meeting | Transcription or notes |
| `voice_transcript` | Speech-to-text output | Zoom/Teams transcript |
| `chat_history` | Conversation history | Slack/Teams export |
| `document_dump` | Multiple documents | File uploads |
| `mixed` | Combination of above | Multi-source input |

### 44.4 Output Types

| Type | Description | Contains |
|------|-------------|----------|
| `decisions` | Key decisions made | Decision list with context |
| `action_items` | Tasks to complete | Assignee, due date, priority |
| `project_plan` | Full project plan | Milestones, timeline, dependencies |
| `meeting_summary` | Meeting summary | Key points, attendees, outcomes |
| `knowledge_base` | Knowledge extraction | Concepts, facts, relationships |
| `data_table` | Structured data | Tabular format |
| `timeline` | Chronological view | Events in sequence |
| `hierarchy` | Hierarchical structure | Parent-child relationships |
| `comparison` | Compare items | Side-by-side analysis |

### 44.5 Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Enable synthesis |
| `defaultOutputType` | `meeting_summary` | Default output format |
| `extractEntities` | `true` | Extract named entities |
| `extractRelationships` | `true` | Identify entity relationships |
| `generateTimeline` | `true` | Generate timeline view |
| `generateActionItems` | `true` | Extract action items |
| `autoAssignTasks` | `false` | Auto-assign based on mentions |
| `confidenceThreshold` | `0.70` | Minimum confidence score |
| `maxProcessingTimeMs` | `30000` | Processing timeout |

### 44.6 Entity Extraction

Automatically extracts entities from chaotic input:

| Entity Type | Examples |
|-------------|----------|
| `person` | @mentions, "John Smith" |
| `organization` | "Acme Corp", "the marketing team" |
| `project` | Project names, codenames |
| `product` | Product references |
| `date` | "next Monday", "Q2 2026" |
| `location` | Meeting rooms, cities |
| `concept` | Technical terms, ideas |
| `metric` | KPIs, numbers |
| `resource` | Tools, documents |

### 44.7 Relationship Types

| Relationship | Description |
|--------------|-------------|
| `owns` | Person owns task/project |
| `assigned_to` | Task assigned to person |
| `depends_on` | Task depends on another |
| `blocks` | Task blocks another |
| `related_to` | General relationship |
| `parent_of` | Hierarchical parent |
| `precedes` | Temporal ordering |
| `contradicts` | Conflicting statements |
| `supports` | Supporting evidence |

### 44.8 Whiteboard Parsing

For visual whiteboards, the service parses spatial elements:

```typescript
// Parse whiteboard elements into thematic clusters
const clusters = await parseWhiteboard(elements);

// Returns clusters with:
{
  id: 'cluster-1',
  elements: [...],  // Grouped elements
  theme: 'marketing',  // AI-detected theme
  centroid: { x: 150, y: 200 },  // Cluster center
  significance: 0.85  // Importance score
}
```

### 44.9 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/thinktank/chaos/config` | GET | Get configuration |
| `/api/thinktank/chaos/config` | PUT | Update configuration |
| `/api/thinktank/chaos/synthesize` | POST | Full synthesis pipeline |
| `/api/thinktank/chaos/extract/actions` | POST | Extract action items only |
| `/api/thinktank/chaos/extract/decisions` | POST | Extract decisions only |
| `/api/thinktank/chaos/extract/questions` | POST | Extract questions only |
| `/api/thinktank/chaos/project-plan` | POST | Generate project plan |
| `/api/thinktank/chaos/whiteboard/parse` | POST | Parse whiteboard elements |
| `/api/thinktank/chaos/metrics` | GET | Get metrics |

### 44.10 Database Tables

| Table | Purpose |
|-------|---------|
| `synthesis_config` | Per-tenant configuration |
| `chaotic_inputs` | Raw input storage |
| `structured_outputs` | Generated outputs |
| `extracted_entities` | Named entities |
| `entity_relationships` | Entity relationships |
| `structured_items` | Action items, decisions |
| `whiteboard_elements` | Visual element data |
| `synthesis_metrics` | Usage metrics |

### 44.11 Implementation Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types/structure-from-chaos.types.ts` | Type definitions |
| `lambda/shared/services/structure-from-chaos.service.ts` | Core service |
| `lambda/thinktank/structure-from-chaos.ts` | API handler |
| `migrations/171_structure_from_chaos.sql` | Database schema |

---

## 45. Delight Services Code Quality

### 45.1 Overview

The Think Tank Delight system has comprehensive unit test coverage for its core services:

- **delight.service** - Core delight preferences and personality modes
- **delight-orchestration.service** - Contextual message generation for workflows
- **delight-events.service** - Real-time event emission for plan execution

### 45.2 Test Coverage

| Service | Test File | Tests | Coverage |
|---------|-----------|-------|----------|
| `delight.service` | `delight.service.test.ts` | 15 | 85% |
| `delight-orchestration.service` | `delight-orchestration.service.test.ts` | 17 | 92% |
| `delight-events.service` | `delight-events.service.test.ts` | 23 | 88% |

### 45.3 Tested Methods

**delight-orchestration.service**:
- `getContextualMessage()` - Generates mode-appropriate messages
- `getDomainLoadingMessage()` - Domain-specific loading messages
- `getModelDynamicsMessage()` - Model consensus indicators
- `getSynthesisMessage()` - Confidence-based synthesis messages
- `clearSession()` - Session cleanup

**delight-events.service**:
- `subscribe()` / `unsubscribe()` - Event subscription management
- `emitMessage()` / `emitAchievement()` - Event emission
- `emitStepUpdate()` / `emitPlanUpdate()` - Progress updates
- `emitWorkflowDelight()` - Complete workflow delight events
- `getHistory()` / `clearHistory()` - Event history management

### 45.4 Running Tests

```bash
cd packages/infrastructure
npx vitest run lambda/shared/services/__tests__/delight*.test.ts
```

### 45.5 Think Tank Code Quality Dashboard

**Location**: `/thinktank/code-quality`

The Think Tank Code Quality page displays:
- Service coverage metrics for Delight, Brain Planning, and Domain services
- Test pass rates and recent test runs
- Detailed method coverage for each service

### 45.6 Implementation Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/__tests__/delight.service.test.ts` | Core service tests |
| `lambda/shared/services/__tests__/delight-orchestration.service.test.ts` | Orchestration tests |
| `lambda/shared/services/__tests__/delight-events.service.test.ts` | Events service tests |
| `apps/admin-dashboard/app/(dashboard)/thinktank/code-quality/page.tsx` | Dashboard UI |

---

## Section 46: Sovereign Mesh in Think Tank Admin

**Location**: Think Tank Admin → Sovereign Mesh

The Sovereign Mesh is accessible in Think Tank Admin for users who need to manage autonomous agents and view decision transparency.

### 46.1 Navigation Items

| Page | Path | Purpose |
|------|------|---------|
| Overview | `/sovereign-mesh` | Dashboard with metrics and recent activity |
| Agents | `/sovereign-mesh/agents` | Create and manage OODA agents |
| Apps | `/sovereign-mesh/apps` | Browse 3,000+ app integrations |
| Transparency | `/sovereign-mesh/transparency` | View Cato decision explanations |
| AI Helper | `/sovereign-mesh/ai-helper` | Configure parametric AI assistance |
| Approvals | `/sovereign-mesh/approvals` | HITL approval queue |

### 46.2 User Permissions

Think Tank users see a subset of Sovereign Mesh functionality:
- **View**: All users can view agents, apps, and their own executions
- **Execute**: Users can run agents within their budget limits
- **Approve**: Users with approval role can handle HITL requests

### 46.3 Implementation

| File | Purpose |
|------|---------|
| `apps/thinktank-admin/components/layout/sidebar.tsx` | Navigation with 6 Sovereign Mesh items |
| Pages mirror admin-dashboard versions | Shared API endpoints |

---

## Section 47: HITL Orchestration in Think Tank Admin

**Location**: Think Tank Admin → Sovereign Mesh → HITL Orchestration

Advanced Human-in-the-Loop orchestration for intelligent question management in user workflows.

### 47.1 Overview

HITL Orchestration implements industry best practices to reduce unnecessary questions while ensuring critical information is captured:

| Feature | Description |
|---------|-------------|
| **SAGE-Agent Bayesian VOI** | Calculates whether asking a question is worth the user's time |
| **Question Batching** | Groups related questions to reduce interruptions |
| **Two-Question Rule** | Maximum 2 clarifications per workflow |
| **Abstention Detection** | Detects when AI should decline to answer |

### 47.2 User-Facing Benefits

- **70% fewer unnecessary questions** - AI only asks when genuinely needed
- **2.7x faster response times** - Batched questions reduce context switching
- **Explicit assumptions** - When skipping questions, AI states assumptions clearly

### 47.3 Navigation

| Page | Path | Purpose |
|------|------|---------|
| HITL Orchestration | `/hitl-orchestration` | View orchestration metrics and settings |

### 47.4 Dashboard Tabs

| Tab | Description |
|-----|-------------|
| **Overview** | Key metrics, VOI breakdown, abstention reasons |
| **Value of Information** | SAGE-Agent VOI statistics and decisions |
| **Abstention** | Detection methods and model-level statistics |
| **Batching** | Three-layer batching strategies and metrics |

### 47.5 Key Metrics

| Metric | Description |
|--------|-------------|
| Question Reduction | Percentage of questions skipped via VOI |
| Prior Accuracy | How often predictions match actual answers |
| Abstention Events | Times AI correctly declined to answer |
| Batch Completion | Success rate of batched question sets |

### 47.6 Implementation Files

| File | Purpose |
|------|---------|
| `apps/thinktank-admin/app/hitl-orchestration/page.tsx` | Dashboard page |
| `apps/thinktank-admin/components/layout/sidebar.tsx` | Navigation item |

---

## Section 48: Scout HITL Integration (v5.34.0)

**Location**: Think Tank Admin → Sovereign Mesh → Scout HITL

Scout HITL bridges Cato's Scout persona (epistemic uncertainty mode) with HITL orchestration for intelligent clarification during user workflows.

### 48.1 Overview

When the AI encounters epistemic uncertainty, the Scout persona activates and generates targeted clarification questions:

1. Scout persona activates due to uncertainty
2. Questions prioritized by aspect impact and domain
3. Questions filtered through VOI (Value-of-Information) scoring
4. High-VOI questions go to user, low-VOI get reasonable assumptions
5. Responses reduce uncertainty, allowing workflow to proceed

### 48.2 Key Metrics

| Metric | Description |
|--------|-------------|
| **Total Sessions** | Number of Scout clarification sessions |
| **Avg Questions** | Average questions asked per session |
| **Proceed Rate** | Sessions that proceeded successfully |
| **Avg Assumptions** | Auto-assumed aspects per session |

### 48.3 Domains

Questions are prioritized based on domain-specific impact:

| Domain | Description |
|--------|-------------|
| `medical` | HIPAA-sensitive, safety-critical |
| `financial` | SOC2/PCI compliance |
| `legal` | Regulatory compliance |
| `bioinformatics` | Research accuracy |
| `general` | Default domain |

### 48.4 Dashboard Tabs

| Tab | Purpose |
|-----|---------|
| **Overview** | Session recommendations breakdown, domain distribution |
| **Recent Sessions** | Table of recent clarification sessions |
| **Configuration** | Enable/disable, VOI threshold, max questions |

### 48.5 Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Enable Scout HITL integration |
| `voiThreshold` | `0.3` | Minimum VOI to ask question |
| `maxQuestionsPerSession` | `3` | Max clarifications before assuming |
| `defaultDomain` | `general` | Fallback domain |

### 48.6 Session Recommendations

| Recommendation | Meaning |
|----------------|---------|
| `proceed` | Uncertainty resolved sufficiently |
| `wait` | Still uncertain, user should wait |
| `abort` | Critical uncertainty, cannot proceed safely |

### 48.7 Implementation Files

| File | Purpose |
|------|---------|
| `apps/thinktank-admin/app/scout-hitl/page.tsx` | Dashboard page |
| `apps/thinktank-admin/components/layout/sidebar.tsx` | Navigation item |

---

## Section 49: Sovereign Mesh Administration (v5.39.0)

**Location**: Think Tank Admin → Sovereign Mesh

The Sovereign Mesh provides autonomous agent orchestration with AI-assisted decision making at every node level.

### 49.1 Overview Dashboard

**Location**: `/sovereign-mesh`

The overview dashboard displays:

| Metric | Description |
|--------|-------------|
| **System Health** | Overall mesh health score (0-100%) |
| **Active Agents** | Number of currently running agents |
| **Pending Approvals** | Items awaiting human review |
| **Active Apps** | Deployed applications count |
| **Decisions Today** | Autonomous decisions made |
| **Human Interventions** | Manual overrides required |

### 49.2 Agent Registry

**Location**: `/sovereign-mesh/agents`

Manage AI agents deployed in the mesh:

| Column | Description |
|--------|-------------|
| **Name** | Agent identifier |
| **Type** | orchestrator, executor, monitor, advisor |
| **Status** | active, idle, error, maintenance |
| **Load** | Current utilization percentage |
| **Response Time** | Average response latency |
| **Success Rate** | Task completion rate |

**Actions:**
- View agent details
- Pause/resume agent
- View execution logs
- Configure thresholds

### 49.3 App Registry

**Location**: `/sovereign-mesh/apps`

Browse and manage deployed applications:

| Field | Description |
|-------|-------------|
| **Name** | Application name |
| **Category** | productivity, analytics, automation, integration, custom |
| **Status** | active, paused, error |
| **Users** | Active user count |
| **Requests** | Daily request volume |

### 49.4 Transparency Layer

**Location**: `/sovereign-mesh/transparency`

Complete audit trail of AI decisions:

| Column | Description |
|--------|-------------|
| **Timestamp** | When decision was made |
| **Decision Type** | approval, rejection, escalation, execution |
| **Confidence** | AI confidence score (0-1) |
| **Reasoning** | Explanation of decision logic |
| **Outcome** | Result of the decision |

**Filters:**
- Date range
- Decision type
- Confidence threshold
- Agent filter

### 49.5 AI Helper

**Location**: `/sovereign-mesh/ai-helper`

Manage AI assistance requests from the mesh:

| Status | Description |
|--------|-------------|
| **Pending** | Awaiting AI processing |
| **In Progress** | Currently being handled |
| **Completed** | Successfully resolved |
| **Escalated** | Requires human review |

### 49.6 Approval Workflow

**Location**: `/sovereign-mesh/approvals`

Human-in-the-loop approval queue:

| Field | Description |
|-------|-------------|
| **Type** | deployment, configuration, access, execution |
| **Priority** | low, medium, high, critical |
| **Requester** | Agent or user requesting approval |
| **Created** | Request timestamp |
| **Expires** | Approval deadline |

**Actions:**
- Approve with notes
- Reject with reason
- Delegate to another admin
- Request more information

### 49.7 Implementation Files

| File | Purpose |
|------|---------|
| `apps/thinktank-admin/app/(dashboard)/sovereign-mesh/page.tsx` | Overview dashboard |
| `apps/thinktank-admin/app/(dashboard)/sovereign-mesh/agents/page.tsx` | Agent registry |
| `apps/thinktank-admin/app/(dashboard)/sovereign-mesh/apps/page.tsx` | App browser |
| `apps/thinktank-admin/app/(dashboard)/sovereign-mesh/transparency/page.tsx` | Decision logs |
| `apps/thinktank-admin/app/(dashboard)/sovereign-mesh/ai-helper/page.tsx` | AI assistance |
| `apps/thinktank-admin/app/(dashboard)/sovereign-mesh/approvals/page.tsx` | Approval queue |

---

## Section 50: Code Quality Dashboard (v5.39.0)

**Location**: Think Tank Admin → Code Quality

Real-time visibility into codebase health and quality metrics.

### 50.1 Overview

The Code Quality dashboard provides:

| Metric | Description |
|--------|-------------|
| **Overall Score** | Aggregate quality score (0-100) |
| **Total Errors** | Critical issues requiring immediate fix |
| **Total Warnings** | Non-critical issues to address |
| **Files Analyzed** | Number of files scanned |

### 50.2 Issue Categories

| Category | Description |
|----------|-------------|
| **Error** | Critical issues (type errors, syntax errors) |
| **Warning** | Style violations, best practice deviations |
| **Info** | Suggestions for improvement |

### 50.3 Issue Details

Each issue displays:
- **File path** with line number
- **Rule ID** (e.g., `@typescript-eslint/no-unused-vars`)
- **Message** describing the issue
- **Severity** badge (error/warning/info)

### 50.4 Filtering

| Filter | Options |
|--------|---------|
| **Severity** | All, Errors only, Warnings only |
| **Category** | TypeScript, ESLint, Custom rules |
| **Date Range** | Filter by scan date |

### 50.5 Implementation Files

| File | Purpose |
|------|---------|
| `apps/thinktank-admin/app/(dashboard)/code-quality/page.tsx` | Dashboard page |

---

## Section 51: Schema-Adaptive Reports (v5.39.0)

**Location**: Think Tank Admin → Reports

Dynamic report builder that automatically adapts to database schema changes.

### 51.1 Overview

The Reports page provides three tabs:

| Tab | Purpose |
|-----|---------|
| **Quick Reports** | Pre-built report templates |
| **Saved Reports** | User-saved custom reports |
| **Schema Builder** | Visual report builder |

### 51.2 Quick Reports

Pre-configured reports available:

| Report | Description |
|--------|-------------|
| **User Engagement** | Active users, session duration, feature usage |
| **Model Performance** | Response times, success rates, token usage |
| **Billing Summary** | Revenue, credits consumed, subscription status |

### 51.3 Schema Builder (v5.40.0 Enhanced)

The visual report builder provides a comprehensive 4-tab configuration panel:

| Tab | Purpose |
|-----|---------|
| **Fields** | Select columns with per-field alias and aggregation |
| **Filters** | Build WHERE clauses with 11 operators + date presets |
| **Sort** | Configure ORDER BY with multi-column ASC/DESC |
| **Group** | Select GROUP BY columns from selected fields |

**Enhanced Features:**
- **SQL Preview** - Live-generated SQL query with dark theme display
- **Date Presets** - Today, Yesterday, Last 7/30 Days, This/Last Month
- **Filter Operators** - =, ≠, >, ≥, <, ≤, LIKE, IN, BETWEEN, IS NULL, IS NOT NULL
- **Visualization Toggles** - Table, Bar, Line, Pie chart view switches
- **Save Report** - Persist definitions to database for reuse
- **Row Limit** - 50, 100, 500, 1000 row options

**Workflow:**
1. **Select Table** - Browse categorized database tables (Conversations, Users, Delight)
2. **Configure Fields** - Select columns, set aliases, choose aggregations
3. **Add Filters** - Build WHERE conditions with operators or date presets
4. **Set Sorting** - Add ORDER BY columns with direction toggle
5. **Group Results** - Enable GROUP BY on selected fields
6. **Execute** - Run report and view in table or chart mode
7. **Export/Save** - Download CSV or save report definition

### 51.4 AI Report Writer (v5.42.0)

Enterprise-grade AI-powered report generation with text and voice input, interactive charts, smart insights, and brand customization.

**Location**: Think Tank Admin → Reports → AI Writer tab

**Core Features:**
- **Natural Language Generation** - Describe reports in plain English
- **Voice Input** - Web Speech API for hands-free report creation
- **AI Modification** - Refine with follow-up prompts ("Add delight metrics")
- **Report Styles** - Executive Summary, Detailed Analysis, Dashboard View, Narrative
- **Rich Formatting** - Headings, metrics cards, charts, tables, lists, quotes
- **Edit Mode** - Click sections to modify, use format panel for styling
- **Undo/Redo** - Full history navigation
- **Export** - PDF, Excel, HTML, Print

**Interactive Charts (v5.42.0):**
- Real Recharts visualizations replacing placeholders
- Bar, Line, Pie, Area chart types
- Auto-formatted tooltips (K/M for thousands/millions)
- 8-color palette for visual consistency

**Smart Insights (v5.42.0):**
- AI anomaly detection (usage spikes, unusual patterns)
- Trend analysis with growth predictions
- Achievement tracking (delight score peaks, retention milestones)
- Actionable recommendations
- Severity indicators (low/medium/high)
- Confidence scores per insight

**Brand Kit (v5.42.0):**
- Logo upload with drag-and-drop
- Company name and tagline customization
- Color pickers (Primary/Secondary/Accent)
- Font selection for headers and body
- Quick preset themes
- Live preview card

**Think Tank Example Prompts:**
- "Generate a user engagement report showing active users and session trends"
- "Create a delight score analysis for the past month"
- "Build a conversation analytics report with message volumes"
- "Show me user retention metrics with churn analysis"

**Usage:**
1. Navigate to Reports → AI Writer tab
2. Select report style
3. Type or speak your request (click mic for voice)
4. Review generated report preview
5. Use modification prompt to refine
6. Toggle Edit Mode to modify sections
7. Export to PDF/Excel/HTML

**Report Sections Generated:**
| Type | Description |
|------|-------------|
| `heading` | H1-H3 headings |
| `paragraph` | Body text |
| `metrics` | 4-column KPI cards with trends (↑↓) |
| `chart` | Interactive chart placeholders |
| `table` | Data tables with headers |
| `list` | Bullet point lists |
| `quote` | Blockquote sections |

### 51.5 Table Categories

| Category | Description |
|----------|-------------|
| **Core** | Users, tenants, sessions |
| **AI** | Models, prompts, responses |
| **Billing** | Subscriptions, credits, invoices |
| **Analytics** | Events, metrics, logs |
| **System** | Configuration, audit, health |

### 51.5 Field Options

| Option | Description |
|--------|-------------|
| **Aggregation** | none, count, sum, avg, min, max, distinct |
| **Format** | text, number, currency, percentage, date, datetime |
| **Filter** | Where clause conditions |
| **Group By** | Grouping columns |
| **Order By** | Sort columns and direction |

### 51.6 Export Formats

| Format | Description |
|--------|-------------|
| **CSV** | Comma-separated values |
| **JSON** | Structured data format |

### 51.7 API Endpoints

Base: `/api/admin/dynamic-reports`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/schema` | Discover database schema |
| `GET` | `/suggestions` | AI-generated report templates |
| `GET` | `/` | List saved reports |
| `POST` | `/` | Save report definition |
| `POST` | `/execute` | Execute a report |
| `POST` | `/export` | Export report data |
| `DELETE` | `/:id` | Delete a report |

### 51.8 Implementation Files

| File | Purpose |
|------|---------|
| `apps/thinktank-admin/app/(dashboard)/reports/page.tsx` | Reports page |
| `packages/infrastructure/lambda/shared/services/schema-adaptive-reports.service.ts` | Backend service |
| `packages/infrastructure/lambda/admin/dynamic-reports.ts` | API handler |
| `packages/infrastructure/migrations/V2026_01_21_003__dynamic_reports.sql` | Database migration |

---

## Section 52: Gateway Status (v5.39.0)

**Location**: Think Tank Admin → Gateway

Monitor API Gateway health and traffic metrics.

### 52.1 Overview

The Gateway Status dashboard displays:

| Metric | Description |
|--------|-------------|
| **Status** | Overall gateway health (healthy/degraded/down) |
| **Requests/sec** | Current request throughput |
| **Avg Latency** | Mean response time |
| **Error Rate** | Percentage of failed requests |
| **Active Connections** | Current WebSocket connections |

### 52.2 Endpoint Health

| Column | Description |
|--------|-------------|
| **Endpoint** | API route path |
| **Method** | HTTP method (GET, POST, etc.) |
| **Status** | healthy, slow, error |
| **Latency** | P50/P95/P99 response times |
| **Requests** | Request count (24h) |
| **Errors** | Error count (24h) |

### 52.3 Traffic Patterns

| View | Description |
|------|-------------|
| **Hourly** | Requests per hour (24h) |
| **Daily** | Requests per day (30d) |
| **By Endpoint** | Traffic distribution by route |
| **By Status** | Success vs error breakdown |

### 52.4 Alerts

| Alert Type | Trigger |
|------------|---------|
| **High Latency** | P95 > 2000ms |
| **High Error Rate** | Errors > 5% |
| **Throughput Spike** | 2x normal traffic |
| **Connection Drop** | WebSocket disconnections |

### 52.5 Implementation Files

| File | Purpose |
|------|---------|
| `apps/thinktank-admin/app/(dashboard)/gateway/page.tsx` | Gateway dashboard |

---

## Section 53: Decision Intelligence Artifacts (DIA Engine) (v5.43.0)

**Location**: Think Tank Admin → Decision Records

The Glass Box Decision Engine - transforms AI conversations into auditable, evidence-backed decision records with full provenance tracking.

### 53.1 Overview

Decision Intelligence Artifacts (DIA) solve the critical problem of AI decision opacity:

| Challenge | DIA Solution |
|-----------|--------------|
| **Black Box Decisions** | Full claim-to-evidence mapping |
| **Data Staleness** | Volatile query tracking with automatic validation |
| **Dissent Hidden** | Ghost paths visualize rejected alternatives |
| **Compliance Gaps** | Built-in HIPAA/SOC2/GDPR export packages |
| **Trust Uncertainty** | Breathing heatmap shows trust topology at-a-glance |

### 53.2 Core Concepts

**Claims**: Extracted conclusions, findings, recommendations, warnings, and facts from AI responses.

| Claim Type | Description |
|------------|-------------|
| `conclusion` | Final determination or decision |
| `finding` | Discovered information or observation |
| `recommendation` | Suggested course of action |
| `warning` | Risk or caution indicator |
| `fact` | Verified data point |
| `clinical_finding` | Healthcare-specific observation |
| `treatment_recommendation` | Medical treatment suggestion |
| `risk_assessment` | Risk evaluation |
| `legal_opinion` | Legal interpretation |
| `compliance_finding` | Regulatory compliance observation |

**Evidence Links**: Connections between claims and their supporting data sources.

| Evidence Type | Description |
|---------------|-------------|
| `tool_call` | API or tool execution result |
| `web_search` | Web search results |
| `document` | Referenced document |
| `calculation` | Computed result |
| `model_consensus` | Multiple model agreement |

**Dissent Events**: Captured disagreements from model reasoning traces.

| Severity | Description |
|----------|-------------|
| `minor` | Small qualification or caveat |
| `moderate` | Significant alternative consideration |
| `significant` | Major disagreement requiring attention |

**Volatile Queries**: Tool calls that may return different results over time.

| Volatility | Threshold | Examples |
|------------|-----------|----------|
| `real-time` | 1 hour | Stock prices, weather |
| `daily` | 24 hours | News, analytics |
| `weekly` | 168 hours | Document searches |
| `stable` | No expiry | Static references |

### 53.3 The Living Parchment UI

The artifact viewer uses sensory design principles:

**Breathing Heatmap Scrollbar**:
- Green (verified) - 6 BPM breathing rate
- Amber (unverified) - Standard breathing
- Red (contested) - 12 BPM alert breathing
- Purple (stale) - Fading intensity with age

**Living Ink Typography**:
- Font weight: 350-500 based on confidence (0-100%)
- Stale claims fade to grayscale
- Hover reveals evidence connections

**Control Island** (floating lens selector):
- **Read**: Standard document view
- **X-Ray**: Evidence links visible
- **Risk**: Ghost paths and contested claims highlighted
- **Compliance**: Regulatory framework coverage

**Ghost Paths**: Dashed connectors showing rejected alternatives from dissent events.

### 53.4 Artifact Lifecycle

```
Conversation → Extract → Validate → Active → [Validate] → Verified
                                      ↓
                                    Stale → Invalidated
                                      ↓
                                   Frozen (immutable)
```

| Status | Description |
|--------|-------------|
| `active` | Current, editable artifact |
| `frozen` | Immutable version with content hash |
| `archived` | Soft-deleted |
| `invalidated` | Data significantly changed |

| Validation Status | Description |
|-------------------|-------------|
| `fresh` | Newly created, not yet validated |
| `stale` | Volatile queries exceeded thresholds |
| `verified` | Recently validated, data unchanged |
| `invalidated` | Significant data changes detected |

### 53.5 Compliance Exports

| Format | Use Case |
|--------|----------|
| `pdf` | Human-readable document |
| `json` | Machine-readable data |
| `hipaa_audit` | HIPAA compliance package with PHI inventory |
| `soc2_evidence` | SOC2 control mapping and evidence chain |
| `gdpr_dsar` | GDPR Data Subject Access Request response |

**HIPAA Audit Package Contents**:
- Cover sheet with artifact metadata
- PHI inventory with categories
- Access log for minimum necessary compliance
- Evidence chain verification
- System attestation with content hash

**SOC2 Evidence Bundle Contents**:
- Control mapping (CC6.x, CC7.x, CC8.x)
- Evidence chain completeness verification
- Change management documentation
- Integrity verification with signature

### 53.6 Configuration

**Location**: Think Tank Admin → Decision Records → Config

| Setting | Default | Description |
|---------|---------|-------------|
| `diaEnabled` | `true` | Enable DIA Engine |
| `autoGenerateEnabled` | `false` | Auto-generate artifacts from conversations |
| `phiDetectionEnabled` | `true` | Scan for protected health information |
| `piiDetectionEnabled` | `true` | Scan for personally identifiable information |
| `defaultStalenessThresholdDays` | `7` | Days before volatile queries flagged stale |
| `maxArtifactsPerUser` | `0` | Limit per user (0 = unlimited) |
| `extractionModel` | `claude-3-5-sonnet` | Model for claim extraction |
| `autoRedactPhiOnExport` | `false` | Automatically redact PHI on export |

### 53.7 Templates

Pre-configured extraction templates:

| Template | Description | Compliance |
|----------|-------------|------------|
| General Decision Record | Standard extraction | None |
| Healthcare Decision | HIPAA-compliant clinical | HIPAA |
| Financial Analysis | Audit-ready financial | SOC2 |
| Legal Review | Legal opinion documentation | SOC2, GDPR |
| Research Synthesis | Multi-source research | None |

### 53.8 API Endpoints

Base: `/api/thinktank/decision-artifacts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List artifacts (supports filters) |
| `POST` | `/` | Generate artifact from conversation |
| `GET` | `/dashboard` | Dashboard metrics |
| `GET` | `/templates` | List available templates |
| `GET` | `/config` | Get tenant configuration |
| `PUT` | `/config` | Update configuration |
| `GET` | `/:id` | Get artifact details |
| `DELETE` | `/:id` | Archive artifact |
| `GET` | `/:id/staleness` | Check staleness status |
| `POST` | `/:id/validate` | Validate volatile queries |
| `POST` | `/:id/export` | Export artifact |
| `GET` | `/:id/versions` | Get version history |
| `GET` | `/:id/validation-history` | Validation audit trail |
| `GET` | `/:id/export-history` | Export audit trail |

### 53.9 Dashboard Metrics

| Metric | Description |
|--------|-------------|
| Total Artifacts | All artifacts for tenant |
| Active Artifacts | Non-archived, non-frozen |
| Frozen Artifacts | Immutable versions |
| Average Confidence | Mean confidence across active |
| Stale Artifacts | Needing validation |
| PHI/PII Detected | Artifacts with sensitive data |
| Validation Cost MTD | API costs for re-validation |
| Top Domains | Most common primary domains |
| Compliance Usage | Framework distribution |

### 53.10 Database Schema

**Tables**:

| Table | Purpose |
|-------|---------|
| `decision_artifacts` | Main artifact storage |
| `decision_artifact_validation_log` | Validation audit trail |
| `decision_artifact_export_log` | Export audit trail |
| `decision_artifact_config` | Tenant configuration |
| `decision_artifact_templates` | Extraction templates |
| `decision_artifact_access_log` | Access audit (HIPAA) |

**Key Columns** (`decision_artifacts`):

| Column | Type | Description |
|--------|------|-------------|
| `artifact_content` | JSONB | Claims, evidence, dissent, metrics |
| `heatmap_data` | JSONB | Pre-computed heatmap segments |
| `validation_status` | VARCHAR | fresh/stale/verified/invalidated |
| `phi_detected` | BOOLEAN | Contains protected health info |
| `content_hash` | VARCHAR(64) | SHA-256 for frozen artifacts |

### 53.11 Implementation Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types/decision-artifact.types.ts` | Type definitions |
| `packages/infrastructure/lambda/shared/services/dia/` | Backend services |
| `packages/infrastructure/lambda/thinktank/decision-artifacts.ts` | API handler |
| `packages/infrastructure/lib/stacks/dia-stack.ts` | CDK infrastructure |
| `packages/infrastructure/migrations/V2026_01_22_001__decision_artifacts.sql` | Core schema |
| `packages/infrastructure/migrations/V2026_01_22_002__decision_artifact_versioning.sql` | Versioning functions |
| `packages/infrastructure/migrations/V2026_01_22_003__decision_artifact_config.sql` | Config & templates |
| `apps/thinktank-admin/app/(dashboard)/decision-records/` | Admin UI |
| `apps/thinktank-admin/app/(dashboard)/decision-records/components/` | UI components |

### 53.12 Troubleshooting

| Issue | Solution |
|-------|----------|
| Extraction fails | Check Bedrock model access permissions |
| Missing evidence links | Verify tool_calls in message metadata |
| Stale status not updating | Run manual validation or check thresholds |
| PHI not detected | Verify phiDetectionEnabled in config |
| Export fails | Check S3 bucket permissions (DIA_EXPORT_BUCKET) |
| Version history empty | Artifact must be frozen to create versions |

### 53.13 Security Considerations

- All tables have RLS policies enforcing tenant isolation
- PHI/PII detection runs automatically on extraction
- Access logging enabled for HIPAA compliance
- Content hashes provide tamper evidence for frozen artifacts
- Export audit trail tracks all compliance exports
- Presigned URLs expire after 1 hour

---

## Section 54: Living Parchment 2029 Vision (v5.44.0)

### Overview

Living Parchment is a comprehensive suite of advanced decision intelligence tools featuring sensory UI elements that communicate trust, confidence, and data freshness through visual breathing, living typography, and ghost paths. This 2029 Vision implementation transforms how users interact with AI-assisted decision making.

### Design Philosophy

| Concept | Implementation |
|---------|----------------|
| **Breathing Interfaces** | UI elements pulse with life—faster breathing (12 BPM) indicates uncertainty, slower (4-6 BPM) indicates confidence |
| **Living Ink** | Text weight varies 350-500 based on confidence; stale information fades to grayscale |
| **Ghost Paths** | Rejected alternatives remain visible as translucent traces showing what could have been |
| **Confidence Terrain** | 3D topographic visualization where elevation = confidence, color = risk |

### 54.1 War Room (Strategic Decision Theater)

High-stakes collaborative decision space with AI advisors and confidence terrain.

#### Features

- **Confidence Terrain**: 3D grid visualization showing confidence topology across decision space
- **AI Advisory Council**: Multiple AI models providing different perspectives
- **Decision Paths**: Branching options with outcome predictions and advocate tracking
- **Ghost Branches**: Rejected paths remain visible for context
- **Stake Level Indicators**: Visual urgency based on decision importance

#### Advisor Types

| Type | Color | Use Case |
|------|-------|----------|
| AI Model | Blue (#3b82f6) | Claude, GPT for strategic analysis |
| Human Expert | Purple (#8b5cf6) | Domain specialists |
| Domain Specialist | Cyan (#06b6d4) | Industry-specific advisors |

#### API Endpoints

```
POST   /api/thinktank/living-parchment/war-room           Create session
GET    /api/thinktank/living-parchment/war-room           List sessions
GET    /api/thinktank/living-parchment/war-room/:id       Get session
POST   /api/thinktank/living-parchment/war-room/:id/advisors        Add advisor
POST   /api/thinktank/living-parchment/war-room/:id/advisors/:aid/analyze   Request analysis
POST   /api/thinktank/living-parchment/war-room/:id/paths           Propose path
POST   /api/thinktank/living-parchment/war-room/:id/decide          Make decision
POST   /api/thinktank/living-parchment/war-room/:id/terrain         Update terrain
```

### 54.2 Council of Experts

Multi-persona AI consultation with consensus tracking and dissent visualization.

#### Expert Personas

| Persona | Specialization | Style |
|---------|---------------|-------|
| Pragmatist | Practical Implementation | Results-focused, cost-conscious |
| Ethicist | Moral Philosophy | Principle-based, stakeholder-aware |
| Innovator | Creative Solutions | Visionary, possibility-focused |
| Skeptic | Risk Analysis | Devil's advocate, challenging |
| Synthesizer | Integration | Bridge-building, pattern-finding |
| Analyst | Data-Driven | Quantitative, evidence-based |
| Strategist | Long-term Strategy | Big-picture, competitive-aware |
| Humanist | Human Impact | Empathetic, user-centered |

#### Consensus Visualization

- Experts positioned on circular visualization
- Positions move toward center as consensus increases
- Dissent sparks appear as electrical arcs between disagreeing experts
- Gravitational attraction animation shows convergence

#### API Endpoints

```
POST   /api/thinktank/living-parchment/council            Convene council
GET    /api/thinktank/living-parchment/council/:id        Get session
POST   /api/thinktank/living-parchment/council/:id/debate Run debate round
POST   /api/thinktank/living-parchment/council/:id/conclude Conclude session
```

### 54.3 Debate Arena

Adversarial exploration with attack/defense flows and steel-man generation.

#### Features

- **Resolution Meter**: Balance indicator (-100 to +100) showing which side is winning
- **Argument Flow**: Visual stream of claims, rebuttals, and concessions
- **Weak Point Detection**: Breathing red indicators on vulnerable arguments
- **Steel-Man Generation**: AI creates strongest version of opponent's argument
- **Attack/Defense Arrows**: Animated flows showing which arguments target which

#### Debate Phases

1. **Setup** - Configure debaters and proposition
2. **Opening** - Initial statements
3. **Main** - Core argument exchange
4. **Rebuttal** - Direct challenges
5. **Closing** - Final positions
6. **Resolved** - Outcome determined

#### API Endpoints

```
POST   /api/thinktank/living-parchment/debate             Create debate
GET    /api/thinktank/living-parchment/debate/:id         Get arena
POST   /api/thinktank/living-parchment/debate/:id/round   Run round
POST   /api/thinktank/living-parchment/debate/:id/steel-man Generate steel-man
```

### 54.4 Memory Palace (Coming Soon)

Navigable 3D knowledge topology with freshness fog.

- **Knowledge Rooms**: Domain-organized 3D spaces
- **Freshness Fog**: Stale areas appear foggy
- **Connection Threads**: Luminous lines between related concepts
- **Discovery Hotspots**: Breathing beacons where insights could emerge

### 54.5 Oracle View (Coming Soon)

Predictive confidence landscape.

- **Probability Heatmap**: Future timeline with brightness = confidence
- **Bifurcation Points**: Animated forks showing cascade effects
- **Ghost Futures**: Translucent overlays of alternative scenarios
- **Black Swan Indicators**: Dormant embers for low-probability/high-impact events

### 54.6 Synthesis Engine (Coming Soon)

Multi-source fusion view.

- **Source Streams**: Flowing rivers converging into synthesis
- **Agreement Zones**: Warm glow where sources align
- **Tension Zones**: Crackling energy between contradictions
- **Provenance Trails**: Click any claim to see all supporting sources

### 54.7 Cognitive Load Monitor (Coming Soon)

User state awareness with adaptive UI.

- **Attention Heatmap**: Track where user has focused
- **Fatigue Indicators**: UI breathing slows as session lengthens
- **Overwhelm Warning**: Screen edges breathe red when load peaks

### 54.8 Temporal Drift Observatory (Coming Soon)

Fact evolution tracking.

- **Drift Alerts**: Notifications when facts have changed
- **Version Ghosts**: Previous versions as translucent overlays
- **Citation Half-Life**: Predict when facts likely become stale

### Database Schema

```sql
-- Core tables (see migration V2026_01_22_004)
war_room_sessions, war_room_participants, war_room_advisors
memory_palaces, memory_rooms, knowledge_nodes, memory_connections
oracle_views, oracle_predictions, bifurcation_points, ghost_futures
synthesis_sessions, synthesis_sources, synthesis_claims
cognitive_load_sessions, cognitive_load_history
council_sessions, council_experts, expert_arguments, minority_reports
drifting_facts, drift_alerts, version_ghosts
debate_arenas, debaters, debate_arguments, weak_points, steel_man_overlays
living_parchment_config
```

### Configuration

```typescript
interface LivingParchmentConfig {
  features: {
    warRoomEnabled: boolean;          // Default: true
    memoryPalaceEnabled: boolean;     // Default: true
    oracleViewEnabled: boolean;       // Default: true
    synthesisEngineEnabled: boolean;  // Default: true
    cognitiveLoadEnabled: boolean;    // Default: true
    councilOfExpertsEnabled: boolean; // Default: true
    temporalDriftEnabled: boolean;    // Default: true
    debateArenaEnabled: boolean;      // Default: true
  };
  defaults: {
    breathingRateBase: 6;             // BPM
    confidenceThreshold: 70;          // Minimum for "high confidence"
    stalenessThresholdDays: 30;       // When facts become stale
    maxAdvisors: 10;
    maxExperts: 8;
    maxDebateRounds: 5;
  };
  visualSettings: {
    heatmapColorScheme: 'standard' | 'accessible' | 'dark';
    animationIntensity: 'subtle' | 'normal' | 'vivid';
    ghostOpacity: 0.5;
  };
}
```

### Implementation Files

```
packages/shared/src/types/living-parchment.types.ts     # All types
packages/infrastructure/migrations/V2026_01_22_004__living_parchment_core.sql
packages/infrastructure/lambda/shared/services/living-parchment/
  ├── war-room.service.ts
  ├── council-of-experts.service.ts
  ├── debate-arena.service.ts
  └── index.ts
packages/infrastructure/lambda/thinktank/living-parchment.ts
apps/thinktank-admin/app/(dashboard)/living-parchment/
  ├── page.tsx                        # Landing page
  ├── war-room/page.tsx               # War Room UI
  ├── council/page.tsx                # Council of Experts UI
  └── debate/page.tsx                 # Debate Arena UI
```

### Security Considerations

- All tables have RLS policies enforcing tenant isolation
- AI advisor calls use tenant-scoped model access
- Session ownership validated before modifications
- Audit logging for all decision actions
- Debate content filtered for appropriate use

---

## 45. Localization & Translation Overrides

**Location**: Think Tank Admin → Administration → Localization

Tenant administrators can customize UI text and messages across Think Tank with translation overrides.

### 45.1 Overview

The localization system allows tenants to:
- Override any system string with custom text
- Protect overrides from automatic translation updates
- Configure default and enabled languages for users
- Maintain brand consistency across all 18 supported languages

### 45.2 Supported Languages

| Language | Code | Flag |
|----------|------|------|
| English | en | 🇺🇸 |
| Spanish | es | 🇪🇸 |
| French | fr | 🇫🇷 |
| German | de | 🇩🇪 |
| Portuguese | pt | 🇵🇹 |
| Italian | it | 🇮🇹 |
| Dutch | nl | 🇳🇱 |
| Polish | pl | 🇵🇱 |
| Russian | ru | 🇷🇺 |
| Turkish | tr | 🇹🇷 |
| Japanese | ja | 🇯🇵 |
| Korean | ko | 🇰🇷 |
| Chinese (Simplified) | zh-CN | 🇨🇳 |
| Chinese (Traditional) | zh-TW | 🇹🇼 |
| Arabic | ar | 🇸🇦 |
| Hindi | hi | 🇮🇳 |
| Thai | th | 🇹🇭 |
| Vietnamese | vi | 🇻🇳 |

### 45.3 Admin UI Tabs

| Tab | Purpose |
|-----|---------|
| **Your Overrides** | View and manage custom translations |
| **Browse Strings** | Search Think Tank strings to customize |
| **Configuration** | Set default language and enabled languages |

### 45.4 Creating Translation Overrides

1. Navigate to **Administration → Localization**
2. Select target language from dropdown
3. Go to **Browse Strings** tab
4. Search for the string you want to customize
5. Click **Edit** to open the override dialog
6. Enter your custom text
7. Toggle **Protect from automatic updates** (recommended)
8. Click **Save**

### 45.5 Protection System

**Protected overrides** (default):
- Will NOT be updated when system translations improve
- Recommended for brand-specific terminology
- Shows lock icon in override list

**Unprotected overrides**:
- May be updated by automatic translation systems
- Useful for temporary fixes until system improves
- Shows unlock icon in override list

**Reverting to system translation**:
- Click the revert button on any override
- Override is deleted and system translation is restored

### 45.6 Language Configuration

Configure which languages are available to your users:

1. Go to **Configuration** tab
2. Set **Default Language** for new users
3. Enable/disable languages by clicking language cards
4. At least one language must remain enabled

### 45.7 Common Use Cases

| Use Case | Example |
|----------|---------|
| **Brand terminology** | Replace "Think Tank" with your product name |
| **Industry jargon** | Use domain-specific terms |
| **Tone adjustment** | Make messages more formal/casual |
| **Legal compliance** | Customize disclaimers |
| **Regional variants** | UK vs US English differences |

### 45.8 API Reference

**Base URL**: `/api/admin/localization`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/overrides` | GET | List your overrides |
| `/overrides` | POST | Create/update override |
| `/overrides/:id` | DELETE | Revert to system |
| `/overrides/:id/protection` | PATCH | Toggle protection |
| `/config` | GET/PUT | Language configuration |
| `/bundle/:lang` | GET | Get translations with overrides |

### 45.9 Database Tables

| Table | Purpose |
|-------|---------|
| `tenant_translation_overrides` | Custom translations per tenant |
| `tenant_localization_config` | Language settings per tenant |
| `translation_audit_log` | Change history |

### 45.10 Implementation Files

```
packages/infrastructure/migrations/V2026_01_25_006__tenant_translation_overrides.sql
packages/infrastructure/lambda/admin/localization-registry.ts
apps/thinktank-admin/app/(dashboard)/localization/page.tsx
```

---

## 46. Unified AGI Architecture: Brain, Genesis, Cortex, and Cato (v5.52.29)

**Location**: Admin Dashboard → Think Tank → AGI Overview

Think Tank is powered by RADIANT's **four interconnected AGI subsystems** that work together to provide intelligent, safe, and personalized AI experiences for users.

### 46.1 How Users Benefit

| System | User-Facing Benefit | What Users Notice |
|--------|---------------------|-------------------|
| **Brain** | Intelligent model selection | "It always picks the right AI for my question" |
| **Genesis** | Graduated capabilities | "It feels more capable as I use it more" |
| **Cortex** | Persistent memory | "It remembers our previous conversations" |
| **Cato** | Safety without friction | "It keeps me safe without being annoying" |

### 46.2 The User Experience Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER ASKS QUESTION                                 │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BRAIN ORCHESTRATION                                 │
│  "What domain is this? What's the best model? What does Cortex know?"       │
└──────────────────────────────────────────────────────────────────────────────┘
         │                    │                    │                    │
         ▼                    ▼                    ▼                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CORTEX    │     │    CATO     │     │   GENESIS   │     │    BRAIN    │
│             │     │             │     │             │     │             │
│ "I remember │     │ "This is    │     │ "User is at │     │ "Use Claude │
│ they prefer │     │ safe to     │     │ maturity    │     │ for legal,  │
│ concise     │     │ answer"     │     │ stage G3"   │     │ add legal   │
│ answers"    │     │             │     │             │     │ LoRA"       │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
         │                    │                    │                    │
         └────────────────────┴────────────────────┴────────────────────┘
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │   PERSONALIZED RESPONSE │
                         │   Safe, Fast, Relevant  │
                         └────────────────────────┘
```

### 46.3 Cortex Memory for Users

Cortex provides the **persistent memory** that makes Think Tank feel like it knows each user.

#### What Cortex Remembers

| Memory Type | Example | Retention |
|-------------|---------|-----------|
| **User Preferences** | "User prefers bullet points" | Permanent |
| **Conversation Context** | "We discussed AWS Lambda yesterday" | 90 days |
| **Domain Expertise** | "User is senior developer, use advanced terms" | Permanent |
| **Golden Rules** | "Never recommend deprecated APIs" | Permanent |
| **Corrections** | "User clarified they work in healthcare, not tech" | Permanent |

#### Memory Tier Visibility

| Tier | User Experience | What's Stored |
|------|-----------------|---------------|
| **Hot** | Instant context in conversation | Current session, recent facts |
| **Warm** | "Let me recall..." (imperceptible delay) | Recent conversations, preferences |
| **Cold** | "I found in our history..." (<2s) | Older conversations, documents |

#### User Memory Controls

Users can manage their memory via Think Tank settings:
- **View memories**: See what the AI remembers about them
- **Correct memories**: Fix incorrect learned information
- **Delete memories**: GDPR right-to-erasure support
- **Export memories**: Download all stored context

**Admin API**: `GET /api/admin/cortex/user/:userId/memories`

### 46.4 Cato Safety for Users

Cato provides **invisible safety** that protects users without creating friction.

#### User-Facing Safety Features

| Feature | User Experience | Admin Control |
|---------|-----------------|---------------|
| **PHI/PII Detection** | "I've redacted sensitive information from your request" | Sensitivity levels |
| **Domain Ethics** | "I should note that I can't provide medical diagnoses" | Ethics frameworks |
| **Hallucination Prevention** | "I'm not confident about this—let me verify" | Uncertainty thresholds |
| **Cost Protection** | (Invisible) Prevents runaway API costs | Budget limits |

#### Governance Presets by Use Case

| Tenant Type | Preset | User Experience |
|-------------|--------|-----------------|
| Healthcare | PARANOID 🛡️ | "I'll need human approval before proceeding with this action" |
| Enterprise | BALANCED ⚖️ | Seamless with occasional safety notes |
| Internal R&D | COWBOY 🚀 | Maximum autonomy, minimal interruptions |

**Configure at**: Admin Dashboard → Cato → Governance

### 46.5 Genesis Maturity for Users

Genesis implements **graduated trust** that unlocks capabilities as users demonstrate responsible usage.

#### User Capability Progression

| Stage | What User Can Do | What's Unlocked |
|-------|------------------|-----------------|
| **G1 (Embryonic)** | Basic chat | Simple Q&A |
| **G2 (Nascent)** | Remembered context | Cortex memory access |
| **G3 (Developing)** | Ethics-checked responses | Professional domain support |
| **G4 (Maturing)** | Autonomous actions | Tool execution, file operations |
| **G5 (Mature)** | Full capability | Multi-model orchestration, agents |

#### Progression Triggers

| User Action | Maturity Impact |
|-------------|-----------------|
| Positive ratings | +0.1 maturity |
| Corrections (learning) | +0.05 maturity |
| Safety violations | -0.2 maturity |
| Extended responsible use | +0.02/day |

**View User Maturity**: Admin Dashboard → Cato → Genesis → User Stages

### 46.6 Brain Model Selection for Users

Brain provides **intelligent model routing** so users always get the best AI for their question.

#### How Users Experience Model Selection

| User Question | Brain's Decision | User Sees |
|---------------|------------------|-----------|
| "Explain quantum physics" | Route to Claude (strong reasoning) | Expert explanation |
| "Analyze this image" | Route to GPT-4V (vision) | Visual analysis |
| "Write a creative story" | Route to Claude (creative) | Engaging narrative |
| "Debug this code" | Route to self-hosted Qwen2.5-Coder | Fast, accurate fix |

Users don't need to choose models—Brain makes optimal selections based on:
- Domain detection (what topic is this?)
- Cortex knowledge density (do we have context?)
- Model proficiency rankings (which model is best at this?)
- Cost optimization (use cheaper models when quality is equivalent)

#### LoRA Personalization

Brain stacks **three LoRA adapters** for personalized responses:

```
Base Model (Frozen)
       +
Global LoRA (All tenants learning)
       +
Tenant LoRA (Organization preferences)
       +
User LoRA (Individual style)
       =
Personalized Response
```

### 46.7 Admin Configuration Summary

| Feature | Location | Key Settings |
|---------|----------|--------------|
| **Cortex Memory** | Cortex → Configuration | Tier settings, retention policies |
| **Cato Safety** | Cato → Safety Pipeline | CBFs, governance presets |
| **Genesis Maturity** | Cato → Genesis | Stage gates, progression rates |
| **Brain Routing** | Brain → Model Selection | Domain mappings, cost limits |
| **User Memory View** | Users → [User] → Cortex | Individual memory inspection |

### 46.8 Key API Endpoints for User Features

| Endpoint | Purpose |
|----------|---------|
| `GET /api/thinktank/cortex/my-memories` | User views their memories |
| `DELETE /api/thinktank/cortex/my-memories/:id` | User deletes a memory |
| `GET /api/thinktank/genesis/my-stage` | User sees their maturity level |
| `GET /api/thinktank/brain/last-routing` | User sees why a model was chosen |
| `POST /api/thinktank/cortex/learn` | User explicitly teaches the AI |

### 46.9 Related Documentation

- **[RADIANT-ADMIN-GUIDE.md Section 31A.8](./RADIANT-ADMIN-GUIDE.md#31a8-unified-agi-architecture-brain-genesis-cortex-and-cato-v55229)** - Platform admin perspective
- **[ENGINEERING-IMPLEMENTATION-VISION.md Section 21](./ENGINEERING-IMPLEMENTATION-VISION.md#21-unified-agi-architecture-brain-genesis-cortex-and-cato-v55229)** - Full engineering reference
- **[RADIANT-PLATFORM-ARCHITECTURE.md Section 1.6.1](./RADIANT-PLATFORM-ARCHITECTURE.md#161-unified-agi-architecture-brain-genesis-cortex-and-cato)** - System architecture

---

## 47. Time Machine Administration

**Location**: Admin Dashboard → Think Tank → Time Machine

Time Machine enables conversation forking, checkpointing, and replay for users.

### 47.1 Overview

Time Machine provides "version control for conversations" - users can create branches, save checkpoints, and explore alternative conversation paths without losing their original thread.

### 47.2 Admin Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable Time Machine** | Global feature toggle | `true` |
| **Max Timelines Per Conversation** | Limit on fork depth | `10` |
| **Max Checkpoints Per Timeline** | Checkpoint retention | `50` |
| **Auto-Checkpoint Interval** | Auto-save frequency | `5 messages` |
| **Retention Period** | How long to keep timelines | `90 days` |

### 47.3 Database Tables

| Table | Purpose |
|-------|---------|
| `timelines` | Timeline branches per conversation |
| `timeline_checkpoints` | Saved conversation states |
| `timeline_forks` | Fork point metadata |

### 47.4 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/thinktank/time-travel/config` | GET/PUT | Configuration |
| `/api/admin/thinktank/time-travel/stats` | GET | Usage statistics |
| `/api/admin/thinktank/time-travel/cleanup` | POST | Purge old timelines |

### 47.5 Implementation Files

```
lambda/thinktank/time-travel.ts
lambda/shared/services/time-travel.service.ts
migrations/XXX_timelines.sql
```

---

## 48. Grimoire Administration

**Location**: Admin Dashboard → Think Tank → Grimoire

The Grimoire is Think Tank's procedural memory system - learned patterns ("spells") that improve AI responses over time.

### 48.1 Overview

When the AI discovers successful response patterns, they can be codified as "spells" in the Grimoire. These spells are then available to improve future responses.

### 48.2 Spell Schools

| School | Icon | Purpose |
|--------|------|---------|
| **Divination** | 🔮 | Information lookup and research |
| **Evocation** | ⚡ | Direct actions and generation |
| **Transmutation** | 🔄 | Data transformation and formatting |
| **Abjuration** | 🛡️ | Error prevention and recovery |
| **Conjuration** | ✨ | Creating new content |
| **Enchantment** | 💫 | Enhancing existing content |

### 48.3 Admin Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable Grimoire** | Feature toggle | `true` |
| **Auto-Promote Threshold** | Success rate to auto-promote patterns | `0.85` |
| **Spell Power Decay** | Daily decay rate for unused spells | `0.01` |
| **Max Spells Per Tenant** | Spell library limit | `500` |

### 48.4 Spell Lifecycle

```
Pattern Detected → Testing → Active → Deprecated
         ↑                       ↓
         └──── User Feedback ────┘
```

### 48.5 Admin Actions

- **View All Spells**: Browse spell library by school/category
- **Deprecate Spell**: Disable underperforming spells
- **Promote Pattern**: Manually promote patterns to spells
- **Export Spells**: Export spell library for backup

### 48.6 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/thinktank/grimoire/spells` | GET | List all spells |
| `/api/admin/thinktank/grimoire/spells/:id` | PATCH | Update spell status |
| `/api/admin/thinktank/grimoire/promote` | POST | Promote pattern |
| `/api/admin/thinktank/grimoire/stats` | GET | Grimoire analytics |

### 48.7 Implementation Files

```
lambda/thinktank/grimoire.ts
lambda/shared/services/grimoire.service.ts
migrations/XXX_grimoire_spells.sql
```

---

## 49. Sentinel Agents Administration

**Location**: Admin Dashboard → Think Tank → Sentinel Agents

Sentinel Agents are background monitors that watch for conditions and trigger automated actions.

### 49.1 Overview

Sentinels provide "if this, then that" automation for AI interactions. They monitor conversations and workflows, triggering actions when conditions are met.

### 49.2 Agent Types

| Type | Icon | Purpose |
|------|------|---------|
| **Monitor** | 🔍 | Watch for patterns and report |
| **Guardian** | 🛡️ | Prevent unwanted outcomes |
| **Optimizer** | ⚡ | Improve efficiency automatically |
| **Auditor** | 📋 | Track and log specific activities |

### 49.3 Admin Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable Sentinel Agents** | Feature toggle | `true` |
| **Max Agents Per User** | Agent limit per user | `20` |
| **Max Agents Per Tenant** | Tenant-wide limit | `500` |
| **Event Retention** | How long to keep event logs | `30 days` |
| **Max Trigger Rate** | Throttle (triggers/minute) | `60` |

### 49.4 Trigger Conditions

| Condition Type | Example |
|----------------|---------|
| **Content Match** | "When code is generated" |
| **Domain Match** | "When legal domain detected" |
| **Cost Threshold** | "When query cost > $1" |
| **Confidence Threshold** | "When confidence < 0.5" |
| **Pattern Match** | Regex patterns |

### 49.5 Available Actions

- Send notification
- Add context to response
- Escalate to human
- Log to audit trail
- Trigger webhook
- Run secondary model

### 49.6 Admin Actions

- **View All Agents**: Browse agents by type/status
- **Disable Agent**: Temporarily disable problematic agents
- **View Events**: See all triggered events
- **Create System Agent**: Create tenant-wide agents

### 49.7 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/thinktank/sentinel-agents` | GET | List all agents |
| `/api/admin/thinktank/sentinel-agents/:id` | PATCH | Update agent |
| `/api/admin/thinktank/sentinel-agents/events` | GET | Event log |
| `/api/admin/thinktank/sentinel-agents/stats` | GET | Statistics |

### 49.8 Implementation Files

```
lambda/thinktank/sentinel-agents.ts
lambda/shared/services/sentinel-agent.service.ts
migrations/XXX_sentinel_agents.sql
```

---

## 50. Economic Governor Administration

**Location**: Admin Dashboard → Think Tank → Economic Governor

The Economic Governor manages AI costs by intelligently routing queries to cost-effective models.

### 50.1 Overview

The Economic Governor analyzes query complexity and routes to the most cost-effective model that can handle it, achieving significant cost savings without sacrificing quality.

### 50.2 Cost Tiers

| Tier | Models | Cost Range | Use Case |
|------|--------|------------|----------|
| **Sniper** | Fast, small models | ~$0.01/query | Simple lookups |
| **Standard** | Mid-tier models | ~$0.05/query | General queries |
| **Advanced** | Premium models | ~$0.15/query | Complex analysis |
| **War Room** | Multi-model | ~$0.50+/query | Critical decisions |

### 50.3 Admin Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable Economic Governor** | Feature toggle | `true` |
| **Daily Budget (Tenant)** | Max daily spend | `$100` |
| **Per-Query Limit** | Max single query cost | `$5` |
| **Default Tier** | Tier for unclassified queries | `Standard` |
| **Escalation Threshold** | Confidence to auto-escalate | `0.6` |

### 50.4 Routing Rules

Admins can create custom routing rules:

| Rule Type | Example |
|-----------|---------|
| **Domain-based** | "Legal → Advanced tier" |
| **Keyword-based** | "Contains 'urgent' → Standard+" |
| **User-based** | "Premium users → War Room access" |
| **Time-based** | "Off-hours → Sniper only" |

### 50.5 Cost Analytics

Track spending across:
- Model usage breakdown
- Cost per user/department
- Savings from optimization
- Trend analysis

### 50.6 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/thinktank/economic-governor/config` | GET/PUT | Configuration |
| `/api/admin/thinktank/economic-governor/rules` | GET/POST | Routing rules |
| `/api/admin/thinktank/economic-governor/usage` | GET | Usage analytics |
| `/api/admin/thinktank/economic-governor/budgets` | GET/PUT | Budget management |

### 50.7 Implementation Files

```
lambda/thinktank/economic-governor.ts
lambda/shared/services/economic-governor.service.ts
migrations/XXX_economic_routing_rules.sql
```

---

## 51. Flash Facts Administration

**Location**: Admin Dashboard → Think Tank → Flash Facts

Flash Facts enable quick knowledge capture - bite-sized information users want the AI to remember.

### 51.1 Overview

Flash Facts are user-created quick facts that persist across sessions. Unlike full memories, they're designed for fast, simple context that should always be available.

### 51.2 Admin Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable Flash Facts** | Feature toggle | `true` |
| **Max Facts Per User** | Fact limit | `100` |
| **Max Fact Length** | Character limit | `500` |
| **Default Categories** | Pre-defined categories | Work, Tech, Personal |
| **Auto-Expire Days** | Expiration (0=never) | `0` |

### 51.3 Fact Categories

| Category | Purpose |
|----------|---------|
| **Work Context** | Company, role, team, projects |
| **Technical** | Languages, frameworks, tools |
| **Preferences** | Communication style, detail level |
| **Personal** | Timezone, working hours |
| **Project-Specific** | Current project context |

### 51.4 Admin Actions

- **View All Facts**: Browse facts by user/category
- **Delete Fact**: Remove inappropriate facts
- **Create System Facts**: Tenant-wide facts
- **Export Facts**: Backup user facts

### 51.5 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/thinktank/flash-facts` | GET | List all facts |
| `/api/admin/thinktank/flash-facts/:id` | DELETE | Delete fact |
| `/api/admin/thinktank/flash-facts/stats` | GET | Statistics |
| `/api/admin/thinktank/flash-facts/categories` | GET/POST | Manage categories |

### 51.6 Implementation Files

```
lambda/thinktank/flash-facts.ts
lambda/shared/services/flash-facts.service.ts
migrations/XXX_flash_facts.sql
```

---

## 52. Neural Architecture v6.0.0 Administration

**Location**: Admin Dashboard → Think Tank → Neural Operations

### 52.1 Overview

Neural Architecture v6.0.0 introduces **RADIANT Cartridges** — portable AI brain packages that encapsulate all learned intelligence for export, import, and transfer between deployments.

### 52.2 CORTEX Network Status

Monitor the 6 small MLPs (~2.5M params total) that power Think Tank's intelligent routing:

| Network | Purpose | Admin Actions |
|---------|---------|---------------|
| **Pattern** | Rank prompt patterns from vector database | View accuracy, rollback |
| **Routing** | Select optimal AI model for task | Adjust weights, force model |
| **Topology** | Choose orchestration method | Override topology |
| **CLARION** | Rank clarification questions | Configure question priority |
| **Combination** | Score multi-model combinations | Enable/disable combinations |
| **User** | Personalize based on Ghost Vector | Reset user vectors |

### 52.3 Cartridge Management

| Action | Description |
|--------|-------------|
| **Export Cartridge** | Create .RADz file with all tenant intelligence |
| **Import Cartridge** | Load external cartridge (merge or replace) |
| **View Installed** | See current cartridge versions |
| **Update Cartridge** | Hot-swap to new version (zero downtime) |
| **Rollback** | Revert to previous cartridge version |

### 52.4 Thermal State Controls

| State | Trigger | Admin Override |
|-------|---------|----------------|
| **COLD** | No cartridge installed | Force to WARM for testing |
| **WARMING** | Cartridge installing | Monitor progress |
| **WARM** | Normal operation | Reduce to save costs |
| **HOT** | High demand auto-detected | Force for events |

### 52.5 Dreaming Status

Monitor CATO Twilight Dreaming cycle:

| Metric | Target | Alert If |
|--------|--------|----------|
| Invention Ratio | ≥30% | <30% (policy violation) |
| Evolution Ratio | ≤70% | N/A (complementary) |
| Canary Pass Rate | 100% | Any failure |
| Training Duration | <4h | >6h |

### 52.6 Admin Actions

- **Force Dreaming Cycle**: Trigger immediate training
- **Rollback Version**: Revert to previous CORTEX version
- **View Training Logs**: Inspect learning signals
- **Export Metrics**: Download training analytics

### 52.7 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/thinktank/neural/status` | GET | All network statuses |
| `/api/admin/thinktank/neural/cortex/:network` | GET/PUT | Network details |
| `/api/admin/thinktank/cartridge/export` | POST | Export cartridge |
| `/api/admin/thinktank/cartridge/import` | POST | Import cartridge |
| `/api/admin/thinktank/thermal/override` | POST | Override thermal state |
| `/api/admin/thinktank/dreaming/force` | POST | Trigger dreaming |
| `/api/admin/thinktank/dreaming/rollback` | POST | Rollback to version |

### 52.8 Implementation Files

```
lambda/admin/neural-operations.ts
lambda/admin/cartridge.ts
lambda/admin/thermal.ts
lambda/shared/services/cortex-network.service.ts
lambda/shared/services/cartridge.service.ts
apps/admin-dashboard/app/(dashboard)/neural-operations/page.tsx
apps/admin-dashboard/app/(dashboard)/cartridge-manager/page.tsx
```

---

## 53. Domain Selector Administration

**Location**: Admin Dashboard → Think Tank → Domain Taxonomy

### 53.1 Overview

The Domain Selector allows users to manually specify their expertise domain from 800+ options across 8 major fields.

### 53.2 Taxonomy Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  8 Fields → 100+ Domains each → 5-20 Subspecialties each       │
│                                                                 │
│  Healthcare ─┬─ Cardiology ─── Interventional Cardiology        │
│              ├─ Oncology ───── Pediatric Oncology               │
│              └─ Neurology ──── Stroke Medicine                  │
│                                                                 │
│  Technology ─┬─ Software Dev ─ Cloud Native                     │
│              ├─ Data Science ─ MLOps                            │
│              └─ Security ───── Penetration Testing              │
└─────────────────────────────────────────────────────────────────┘
```

### 53.3 Admin Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable Domain Selection** | Allow manual override | `true` |
| **Show Auto-Detection** | Display detected domain | `true` |
| **Allow User Defaults** | Let users set default domain | `true` |
| **Custom Domains** | Enable tenant-specific domains | `false` |

### 53.4 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/thinktank/domain-taxonomy` | GET | Full taxonomy |
| `/api/admin/thinktank/domain-taxonomy/fields` | GET | List fields |
| `/api/admin/thinktank/domain-taxonomy/domains` | GET | List domains |
| `/api/admin/thinktank/domain-taxonomy/custom` | POST | Add custom domain |

---

## 54. Cartridge Indicator Administration

**Location**: Admin Dashboard → Think Tank → Cartridge Status

### 54.1 Overview

The Cartridge Indicator shows users which AI intelligence packages are active and their status.

### 54.2 Admin Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| **Show Indicator** | Display cartridge status | `true` |
| **Show Version** | Display version numbers | `true` |
| **Show Capabilities** | List enhanced features | `true` |
| **Allow Details** | Let users expand for details | `true` |

### 54.3 Indicator Customization

Customize the cartridge indicator appearance:

| Element | Options |
|---------|---------|
| **Position** | Header, Footer, Sidebar |
| **Style** | Minimal, Standard, Detailed |
| **Colors** | Default, Custom brand colors |
| **Labels** | Default, Custom terminology |

---

## 55. AXIOM Forge Administration

**Location**: Admin Dashboard → Think Tank → AXIOM Forge

### 55.1 Overview

AXIOM (Adaptive eXpert Instruction Optimization Model) is an intelligent prompt optimization system that automatically enhances user prompts through:

- **Domain Classification**: Automatic detection of query domain and expertise level
- **Clarifying Questions**: CLARION adaptive questioning for context gathering
- **Pattern Matching**: Retrieval of proven prompt patterns from the pattern database
- **Model Routing**: Intelligent selection of optimal AI models based on task requirements

### 55.2 Admin Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable AXIOM** | Master toggle for AXIOM features | `true` |
| **Max Questions** | Maximum clarifying questions per session | `5` |
| **Confidence Threshold** | Minimum confidence to skip questions | `0.85` |
| **Enable Caching** | Cache question trees for performance | `true` |
| **Cache TTL** | Cache time-to-live in minutes | `60` |
| **Enable A/B Testing** | Run optimization experiments | `false` |

### 55.3 CLARION Question Types

| Type | Description | Use Case |
|------|-------------|----------|
| **choice** | Single selection from options | Domain selection |
| **multi_select** | Multiple selections allowed | Feature preferences |
| **text** | Free-form text input | Specific requirements |
| **scale** | Numeric scale (1-10) | Priority/importance |
| **boolean** | Yes/No selection | Binary decisions |

### 55.4 Pattern Management

Patterns can be approved, rejected, or promoted:

| Action | Effect |
|--------|--------|
| **Approve** | Pattern becomes available for matching |
| **Reject** | Pattern is excluded from matching |
| **Promote** | Pattern gets higher priority in matching |

### 55.5 A/B Testing

Configure experiments to optimize AXIOM behavior:

```typescript
{
  name: "Question Order Test",
  variants: {
    control: { questionOrder: "priority" },
    treatment: { questionOrder: "adaptive" }
  },
  metrics: ["completion_rate", "user_satisfaction"]
}
```

### 55.6 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/axiom/config` | GET/PUT | Global configuration |
| `/api/admin/axiom/patterns` | GET | List patterns |
| `/api/admin/axiom/patterns/:id/approve` | POST | Approve pattern |
| `/api/admin/axiom/patterns/:id/reject` | POST | Reject pattern |
| `/api/admin/axiom/questions` | GET/POST | Manage questions |
| `/api/admin/axiom/ab-tests` | GET/POST | A/B test management |
| `/api/admin/axiom/metrics` | GET | Dashboard metrics |

### 55.7 Database Tables

| Table | Purpose |
|-------|---------|
| `axiom_sessions` | Active optimization sessions |
| `axiom_patterns` | Prompt pattern database |
| `axiom_questions` | CLARION question definitions |
| `axiom_ab_tests` | A/B test configurations |
| `axiom_feedback` | User feedback signals |

### 55.8 Implementation Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/axiom.service.ts` | Core AXIOM service |
| `lambda/shared/services/clarion.service.ts` | CLARION questioning |
| `lambda/admin/axiom-admin.ts` | Admin API handler |
| `apps/admin-dashboard/app/(dashboard)/axiom/page.tsx` | Admin UI |
| `apps/thinktank/components/axiom/` | User-facing components |

---

## 56. AXIOM Scorers

**Location**: Admin Dashboard → Think Tank → AXIOM Scorers

The AXIOM Scorers are 8 lightweight MLPs (multi-layer perceptrons) that power AXIOM's prompt optimization. Unlike large language models, these are small scoring functions (~50K-1M parameters each) that rank and score inputs.

### 56.1 The 8 Scorers

| # | Scorer | Input Dim | Output | Purpose |
|---|--------|-----------|--------|---------|
| 1 | **Domain Scorer** | 1536 | 800 classes | Classifies queries into 800+ domain taxonomy |
| 2 | **CLARION Scorer** | 1536 | Score (0-1) | Scores question relevance for adaptive questioning |
| 3 | **Pattern Scorer** | 3072 | Score (0-1) | Ranks prompt patterns for retrieval |
| 4 | **Model Scorer** | 1536 | 106 scores | Scores individual AI models for task suitability |
| 5 | **Topology Scorer** | 512 | 9 modes | Evaluates orchestration strategies |
| 6 | **Combination Scorer** | 640 | Score (0-1) | Scores multi-model combinations for ensemble tasks |
| 7 | **Variant Scorer** | 1536 | Score (0-1) | Scores prompt variants for model-specific optimization |
| 8 | **User Scorer** | 128 | 64 factors | Personalizes scores via Ghost Vector integration |

### 56.2 Scorer Flow

```
User Query
    │
    ▼
┌─────────────────┐
│ Domain Scorer   │ → Classify into 800+ domains
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ CLARION Scorer  │ ←── │  User Scorer    │ (personalize question order)
└────────┬────────┘     └─────────────────┘
         │ (ask questions)
         ▼
┌─────────────────┐
│ Pattern Scorer  │ → Retrieve best patterns
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Topology Scorer │ → Choose orchestration mode
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
Single    Multi-model
Model     ┌─────────────────┐
    │     │Combination Scorer│ → Pick best model combo
    │     └────────┬────────┘
    │              │
    └──────┬───────┘
           ▼
┌─────────────────┐
│  Model Scorer   │ → Score models
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Variant Scorer  │ → Optimize prompt for model
└────────┬────────┘
         │
         ▼
    Execute Request
```

### 56.3 Thermal State Management

Scorers have thermal states that control inference behavior:

| State | Behavior | Use Case |
|-------|----------|----------|
| **Cold** | Uses heuristic fallbacks | Low traffic, cost saving |
| **Warm** | SageMaker endpoint ready | Normal operations |
| **Hot** | Multiple endpoint replicas | High traffic |

**Auto-Scaling Rules:**
- Scorers auto-warm after 10+ requests
- Scorers auto-cool after 30 minutes idle
- Hot state triggered at 10+ requests/minute

### 56.4 Admin Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable Scorers** | Use scorers vs heuristics | `true` |
| **Auto Thermal Management** | Automatic warm/cool transitions | `true` |
| **Cool Down Minutes** | Minutes of idle before cooling | `30` |
| **Hot Threshold RPM** | Requests/minute to trigger hot | `10` |
| **Fallback Mode** | Behavior when scorers unavailable | `heuristic` |

### 56.5 Orchestration Modes

The Topology Scorer evaluates these 9 orchestration modes:

| Mode | Description |
|------|-------------|
| `thinking` | Standard single-model reasoning |
| `extended_thinking` | Deep multi-step reasoning |
| `coding` | Code generation tasks |
| `creative` | Creative writing |
| `research` | Research synthesis |
| `analysis` | Quantitative analysis |
| `multi_model` | Multiple models for consensus |
| `chain_of_thought` | Explicit reasoning chain |
| `self_consistency` | Multiple samples for consistency |

### 56.6 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/axiom-scorers/status` | GET | All scorer statuses |
| `/api/admin/axiom-scorers/:id` | GET | Single scorer details |
| `/api/admin/axiom-scorers/:id/warm` | POST | Warm up a scorer |
| `/api/admin/axiom-scorers/:id/cool` | POST | Cool down a scorer |
| `/api/admin/axiom-scorers/metrics` | GET | Inference metrics |
| `/api/admin/axiom-scorers/training` | GET | Training batch status |

### 56.7 Database Tables

| Table | Purpose |
|-------|---------|
| `axiom_network_status` | Scorer thermal state and metrics |
| `axiom_network_inference_log` | Inference log for training data |
| `axiom_network_training_batches` | CATO training batch tracking |
| `domain_taxonomy_embeddings` | Domain centroids for fallback |

### 56.8 Implementation Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/axiom-neural-cortex.service.ts` | Core inference client |
| `lambda/shared/services/axiom.service.ts` | AXIOM pipeline (uses Model/Topology scorers) |
| `lambda/shared/services/clarion.service.ts` | CLARION (uses CLARION Scorer) |
| `packages/shared/src/types/axiom-clarion.types.ts` | Scorer type definitions |
| `migrations/V2026_02_01_001__axiom_neural_cortex.sql` | Database schema |

### 56.9 Training Integration

Scorers are trained by CATO during nightly "dreaming" cycles:

1. **Data Collection**: Inferences logged with `axiom_network_inference_log`
2. **Feedback**: User feedback updates `feedback_score` column
3. **Training**: CATO batches samples nightly
4. **Deployment**: New model versions deployed to SageMaker
5. **Validation**: Shadow testing before promotion

**Training Metrics:**
- Accuracy before/after
- Validation loss
- Inference latency change

---

## Section 57: The Crucible - Tenant Configuration (v6.4.0)

### Overview

The Crucible is RADIANT's competitive multi-LLM deliberation system. When multiple LLMs are assigned to a method, they enter The Crucible to question each other and refine their answers. Think Tank Admins can customize Crucible behavior for their tenant.

### 57.1 Configuration Hierarchy

| Level | Who Controls | Scope |
|-------|--------------|-------|
| **System** | Radiant Admin | Platform-wide defaults |
| **Tenant** | Think Tank Admin | Overrides for your tenant |
| **User** | End Users | Per-method preferences |

**Resolution**: User > Tenant > System. Higher levels take precedence.

### 57.2 Tenant Configuration

**Location**: Think Tank Admin → Crucible

| Setting | Description | System Default |
|---------|-------------|----------------|
| **Max Questions Override** | Maximum questions per deliberation | 5 |
| **Cost Mode Override** | economy/balanced/thorough | balanced |
| **Cost Mode Limits** | Questions per mode | 3/5/8 |
| **Circular Penalty** | Score penalty for circular reasoning | 15% |
| **Allow User Override** | Let users customize per method | true |
| **Show Deliberation** | Users can see live Q&A | true |
| **Auto-Enable** | Trigger when multiple LLMs assigned | true |

### 57.3 User Override Controls

When "Allow User Override" is enabled, end users can:

- Set max questions for specific methods
- Set max questions within specific workflows
- View live deliberation during execution
- See circular citation warnings

Users access this through the `CrucibleDeliberationPanel` component during workflow execution.

### 57.4 Deliberation Visibility

When "Show Deliberation to Users" is enabled:

- Users see real-time Q&A between models
- Circular citation warnings are displayed
- Question types and quality scores are visible
- Users can adjust preferences mid-workflow

When disabled:
- Crucible runs silently in the background
- Users only see final outputs
- Config panel shows "Deliberation visibility is disabled"

### 57.5 API Endpoints

**Base**: `/api/thinktank-admin/crucible`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/config` | Get tenant config with system defaults |
| PUT | `/config` | Update tenant overrides |
| DELETE | `/config/:field` | Reset field to system default |
| GET | `/users` | Users with custom preferences |
| GET | `/users/:userId/preferences` | User's preferences |
| GET | `/stats` | Tenant Crucible statistics |

### 57.6 Database Tables

| Table | Purpose |
|-------|---------|
| `crucible_tenant_config` | Tenant-level overrides |
| `crucible_user_preferences` | User preferences per scope |

### 57.7 Best Practices

1. **Start with system defaults** - Only override when necessary
2. **Enable user overrides** - Let users tune for their workflow
3. **Monitor circular citations** - High rates may indicate model issues
4. **Review learning insights** - Crucible extracts patterns from sessions

---

## Section 58: Mid-Level Services (MLS) (v5.0.0)

### Overview

Mid-Level Services (MLS) provide domain-specific AI capabilities that combine multiple specialized models into unified endpoints. Think Tank users can access these services through AI-assisted workflows when their tenant tier supports them.

### 58.1 Available Services by Tier

| Service | Domain | Min Tier | Description |
|---------|--------|----------|-------------|
| **Perception** | Computer Vision | 3 (GROWTH) | Object detection, segmentation, classification |
| **Scientific** | Computational Biology | 4 (SCALE) | Protein analysis, structure prediction |
| **Medical** | Healthcare Imaging | 4 (SCALE) | HIPAA-compliant medical image analysis |
| **Geospatial** | Satellite Imagery | 4 (SCALE) | Land classification, change detection |
| **Reconstruction** | 3D Generation | 4 (SCALE) | NeRF and 3D Gaussian Splatting |

### 58.2 Tenant Configuration

**Location**: Think Tank Admin → MLS Services

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable MLS** | Master toggle for MLS services | `true` (tier-dependent) |
| **Auto-Warm** | Automatically warm models on first request | `true` |
| **Show Service Status** | Display service availability to users | `true` |
| **Allow Manual Warm** | Users can trigger model warm-up | `false` |
| **Cost Alerts** | Notify when MLS usage exceeds threshold | `true` |
| **Cost Alert Threshold** | Monthly spend threshold for alerts | `$100` |

### 58.3 Service Endpoints for Think Tank

MLS services are exposed to Think Tank through the orchestration layer:

| Endpoint | Input | Output | Use Case |
|----------|-------|--------|----------|
| `/perception/analyze` | Image | JSON | Full vision pipeline in conversations |
| `/scientific/protein/fold` | FASTA sequence | PDB structure | Research workflows |
| `/medical/segment` | DICOM/image | Annotated mask | Healthcare assistants |
| `/geospatial/classify` | GeoTIFF | Land cover map | Environmental analysis |
| `/reconstruction/nerf` | Video/images | 3D model | Creative workflows |

### 58.4 Thermal State Visibility

Users can see the current state of MLS models:

| State | User Experience |
|-------|-----------------|
| **OFF** | Service unavailable, shows upgrade prompt |
| **COLD** | "Starting up..." with estimated wait time (2-5 min) |
| **WARM** | Ready for immediate use |
| **HOT** | Ready with fast response times |

When a user requests an MLS service and the model is COLD:
1. Request returns HTTP 202 Accepted
2. User sees warm-up progress indicator
3. Request auto-retries when model is WARM
4. User notified when ready

### 58.5 Usage & Billing

MLS usage is tracked per tenant and billed based on the service:

| Service | Pricing | Billing Unit |
|---------|---------|--------------|
| Perception | $0.02 | Per image |
| Perception (video) | $0.50 | Per minute |
| Scientific | $0.50 | Per request |
| Medical | $0.15 | Per image |
| Medical (audio) | $0.08 | Per minute |
| Geospatial | $0.05 | Per image |
| Reconstruction | $5.00 | Per 3D model |

**Admin Dashboard**: Think Tank Admin → Billing → MLS Usage

### 58.6 Graceful Degradation

When optional models are unavailable, services automatically reduce capabilities:

| Level | User Impact | Admin Action |
|-------|-------------|--------------|
| **FULL** | All features available | None needed |
| **REDUCED** | HD features disabled, standard quality | Optional: warm HD models |
| **MINIMAL** | Basic functionality only | Consider warming required models |

Users see capability indicators in the UI when services are degraded.

### 58.7 Integration with Think Tank Workflows

MLS services integrate with Think Tank's workflow orchestration:

```
User Request: "Analyze this protein structure"
    │
    ▼
┌─────────────────┐
│ AXIOM Domain    │ → Detects: scientific/biology
│ Scorer          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ MLS Router      │ → Routes to Scientific Service
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Scientific/     │ → ESM-2 embedding + AlphaFold2 structure
│ protein/fold    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Think Tank      │ → Presents 3D structure + explanation
│ Response        │
└─────────────────┘
```

### 58.8 Admin API Endpoints

**Base**: `/api/thinktank-admin/mls`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/services` | List available services for tenant tier |
| GET | `/services/:id/status` | Service thermal state and health |
| GET | `/usage` | Tenant MLS usage statistics |
| GET | `/usage/breakdown` | Per-service usage breakdown |
| PUT | `/config` | Update tenant MLS configuration |
| POST | `/services/:id/warm` | Request model warm-up (if allowed) |

### 58.9 Database Tables

| Table | Purpose |
|-------|---------|
| `mls_tenant_config` | Tenant-level MLS settings |
| `mls_usage_records` | Per-request usage tracking |
| `mls_service_access` | Service availability by tier |

### 58.10 Best Practices

1. **Monitor usage** - Set cost alerts to avoid unexpected bills
2. **Pre-warm for demos** - Warm models before important presentations
3. **Educate users** - Explain cold-start delays for first-time users
4. **Review degradation** - Check service health dashboard regularly
5. **Tier upgrades** - Consider upgrading tier for consistent access to specialized services

### 58.11 Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Service unavailable | Tier too low | Upgrade tenant tier |
| Long wait times | Model cold | Enable auto-warm or pre-warm |
| High costs | Heavy usage | Set cost alerts, review usage patterns |
| Degraded quality | Optional models offline | Wait for auto-warm or manually warm |

---

## 59. LIVS-M Workflow Management (v7.8.0)

LIVS-M (LIVS-Meta) extends the LIVS Interrogator with a "Soft Registry" governance architecture, enabling dynamic policy configuration without code deployments.

### 59.1 Overview

LIVS-M transforms AI governance from static rules to configurable workflows:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LIVS-M SOFT REGISTRY                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐        │
│  │  SYSTEM DEFAULTS │   │  TENANT OVERRIDES │   │  USER PREFERENCES │        │
│  │  (Radiant Team)  │   │  (Tenant Admin)   │   │  (End User)       │        │
│  └────────┬─────────┘   └────────┬──────────┘   └────────┬──────────┘        │
│           │                      │                       │                   │
│           └──────────────────────┴───────────────────────┘                   │
│                                  │                                           │
│                                  ▼                                           │
│                    ┌─────────────────────────┐                               │
│                    │   EFFECTIVE SETTINGS     │                               │
│                    │   (Merged at Runtime)    │                               │
│                    └─────────────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 59.2 Environment Modes

Configure enforcement severity based on use case:

| Mode | Purpose | Enforcement |
|------|---------|-------------|
| `strict_engineering` | Production code review | All warnings become blockers |
| `balanced` | Default mode | Normal severity mapping |
| `brainstorming` | Creative exploration | Most checks advisory only |
| `audit` | Compliance logging | Everything logged, nothing blocked |

**Admin Configuration**:
```
Think Tank Admin → Governance → LIVS-M → Environment Mode
```

### 59.3 Workflow Templates

Templates define collections of behavioral rules that apply together:

| Template Type | Owner | Purpose |
|---------------|-------|---------|
| **System** | Radiant | Platform defaults, read-only |
| **Tenant** | Tenant Admin | Organization-wide policies |
| **User** | End User | Personal preferences |

**Inheritance**: User → Tenant → System (user settings override tenant, tenant overrides system)

### 59.4 Code Stub Detection (Phase 1 Hard Reject)

Automatically detects and blocks placeholder code before LLM interrogation:

**Patterns Detected**:
- `// TODO`, `# TODO`, `/* TODO */`
- `pass` (Python), `...` (ellipsis)
- `throw new NotImplementedError`
- `return []`, `return {}`, `return null` (suspicious empty returns)
- `console.log('placeholder')`, `print('stub')`

**Enforcement Actions**:

| Action | Behavior |
|--------|----------|
| `REJECT_AND_RETRY` | Block response, provide retry guidance |
| `BLOCK` | Hard block, no retry allowed |
| `FLAG_FOR_REVIEW` | Continue but flag for human review |

**Audit Table**: `livs_stub_detections` logs all detected stubs

### 59.5 Sycophancy Breaker

Monitors multi-agent pipelines for suspiciously quick agreement:

- **Detection**: Tracks consecutive agreement turns between agents
- **Threshold**: Configurable `minTurnsBeforeAgreement` (default: 2)
- **Chaos Injection**: When detected, injects adversarial prompt

**Chaos Prompt**:
> "STOP. Assume the previous assertion is WRONG. Find flaws in this approach."

**Audit Table**: `livs_sycophancy_detections` logs all interventions

### 59.6 Forensic Critic (Dialectical Verification)

New Cato critic method implementing Thesis/Antithesis/Synthesis verification:

**Verification Phases**:

| Phase | Check | Purpose |
|-------|-------|---------|
| 1. Surface Scan | Stub/placeholder detection | Catch obvious issues |
| 2. Evidence Validation | Claims have supporting data | Verify groundedness |
| 3. Contradiction Detection | Internal consistency | Find logic errors |
| 4. Confidence Calibration | Claimed vs actual confidence | Detect overconfidence |

**Checklist Items**:
- `noStubs` - No placeholder code detected
- `evidenceProvided` - Claims backed by evidence
- `internalConsistency` - No contradictions found
- `confidenceCalibrated` - Confidence matches content
- `noHedging` - Clear, decisive language
- `noDeflection` - Addresses question directly

### 59.7 API Endpoints

**Base**: `/api/thinktank/livs-workflow`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Get effective LIVS settings for user |
| `POST` | `/toggle` | Quick toggle LIVS on/off |
| `GET` | `/templates` | List all available templates |
| `GET` | `/system-templates` | List system default templates |
| `GET` | `/templates/:id` | Get specific template |
| `POST` | `/templates` | Create user template |
| `PUT` | `/templates/:id` | Update template |
| `DELETE` | `/templates/:id` | Delete user template |
| `GET` | `/preferences` | Get user workflow preferences |
| `PUT` | `/preferences` | Update preferences |
| `POST` | `/select` | Select active workflow template |

### 59.8 Database Tables

| Table | Purpose |
|-------|---------|
| `livs_workflow_templates` | System defaults and user workflows |
| `livs_workflow_behavioral_rules` | Configurable rules per template |
| `livs_user_workflow_preferences` | Per-user toggle and workflow selection |
| `livs_stub_detections` | Audit log of detected stubs |
| `livs_sycophancy_detections` | Audit log of multi-agent sycophancy |

### 59.9 Admin Dashboard Integration

**Location**: Think Tank Admin → Governance → LIVS-M

| Tab | Features |
|-----|----------|
| **Overview** | Usage metrics, detection counts |
| **Templates** | Manage tenant workflow templates |
| **Detections** | View stub/sycophancy audit logs |
| **Settings** | Configure environment mode, thresholds |

### 59.10 Best Practices

1. **Start with `balanced` mode** - Only use `strict_engineering` for production reviews
2. **Create tenant templates** - Standardize governance across your organization
3. **Monitor detections** - Review audit logs weekly for patterns
4. **Allow user preferences** - Let power users customize their experience
5. **Use `audit` mode for testing** - Test new templates without blocking

### 59.11 Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| False positive stubs | Legitimate empty returns | Add pattern to allowlist |
| Sycophancy false trigger | Fast legitimate agreement | Increase `minTurnsBeforeAgreement` |
| Template not applying | Inheritance override | Check user/tenant template order |
| LIVS disabled for user | User preference | Check `livs_user_workflow_preferences` |

### 59.12 LIVS-M 2.0 Registry Edition (v7.8.0+)

LIVS-M 2.0 introduces the **Policy Registry** - a JSON-based governance system that enables dynamic policy configuration per tenant without code deployments.

#### Registry Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LIVS-M 2.0 REGISTRY ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     POLICY REGISTRY (JSON)                            │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │   │
│  │  │  meta_config    │  │global_directives│  │  rules_engine   │       │   │
│  │  │  ─────────────  │  │  ─────────────  │  │  ─────────────  │       │   │
│  │  │ • version       │  │ • allow_stubs   │  │ • pattern rules │       │   │
│  │  │ • env_mode      │  │ • allow_mock    │  │ • logic rules   │       │   │
│  │  │ • updated_at    │  │ • require_tests │  │ • severity      │       │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                  GOVERNANCE SUPERVISOR                                │   │
│  │  • Builds meta-prompt from registry                                   │   │
│  │  • Evaluates agent outputs                                           │   │
│  │  • Returns APPROVE / REJECT / INTERVENE                              │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│              ┌─────────────────────┼─────────────────────┐                   │
│              ▼                     ▼                     ▼                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │  THESIS AGENT    │  │ ANTITHESIS AGENT │  │ SYNTHESIS AGENT  │           │
│  │  (Lead Engineer) │  │ (Forensic Audit) │  │  (Reconciler)    │           │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Policy Registry Structure

```json
{
  "meta_config": {
    "version": "1.0.0",
    "environment_mode": "BALANCED",
    "last_updated": "2024-01-15T10:00:00Z",
    "updated_by": "admin@tenant.com"
  },
  "global_directives": {
    "collaboration_style": "ADVERSARIAL",
    "allow_mock_data": false,
    "allow_stubs": false,
    "require_tests_for_code": true,
    "require_evidence_for_claims": true,
    "max_agent_turns_before_escalation": 5,
    "max_consensus_velocity": 3,
    "enable_chaos_injection": true
  },
  "rules_engine": {
    "pattern_rules": [...],
    "logic_rules": [...],
    "custom_rules": [...]
  }
}
```

#### Environment Modes

| Mode | Strictness | Use Case |
|------|------------|----------|
| **STRICT_AUDIT** | Maximum | Production code reviews, compliance audits |
| **BALANCED** | Normal | Standard development workflow |
| **RAPID_PROTO** | Relaxed | Rapid prototyping, hackathons |
| **HACKATHON** | Minimal | Experimentation, creative exploration |

#### Governance Supervisor

The Supervisor acts as a "meta-agent" that enforces registry rules:

```typescript
const result = await governanceSupervisor.evaluate({
  tenantId: 'tenant-123',
  sessionId: 'session-456',
  agentRole: 'THESIS_AGENT',
  agentOutput: submittedCode,
  interactionTurn: 1,
});

// Returns:
{
  decision: 'APPROVE' | 'REJECT' | 'INTERVENE',
  instruction: 'Specific feedback if rejected',
  violations: [...],
  confidence: 0.95,
  reasoning: 'Chain-of-thought explanation'
}
```

#### Registry-Aware Worker Agents

| Agent | Role | Registry Awareness |
|-------|------|-------------------|
| **THESIS_AGENT** | Lead Engineer - produces implementations | FULL |
| **ANTITHESIS_AGENT** | Forensic Auditor - finds flaws | FULL |
| **SYNTHESIS_AGENT** | Reconciler - synthesizes best solution | RULES_ONLY |
| **SUPERVISOR** | Governance Engine - enforces registry | FULL |
| **CHAOS_AGENT** | Devil's Advocate - breaks assumptions | RULES_ONLY |
| **VERIFICATION_AGENT** | Fact Checker - validates claims | RULES_ONLY |

#### Chaos Injection Scenarios

When sycophancy is detected (consensus too fast), the Supervisor can inject:

| Scenario | Purpose |
|----------|---------|
| **SYCOPHANCY_BREAK** | Force reconsideration of agreed solution |
| **EDGE_CASE_PROBE** | Test boundary conditions |
| **ASSUMPTION_AUDIT** | List and rate all assumptions |

### 59.13 LIVS-M 2.0 Database Tables

| Table | Purpose |
|-------|---------|
| `livs_policy_registry` | Stores tenant-specific JSON registries |
| `livs_registry_evaluations` | Audit log of supervisor decisions |
| `livs_registry_history` | Version history of registry changes |
| `livs_agent_interactions` | Multi-agent interaction logs |
| `livs_prompt_generation_log` | Worker prompt audit trail |

### 59.14 LIVS-M 2.0 API Endpoints

**Base**: `/api/thinktank/livs-registry`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Get tenant registry |
| `PUT` | `/` | Update registry |
| `GET` | `/rules` | Get active rules |
| `POST` | `/rules/evaluate` | Evaluate output against rules |
| `GET` | `/history` | Get registry change history |
| `POST` | `/supervisor/evaluate` | Invoke governance supervisor |

### 59.15 Integration with AGI Orchestrator

The Governance Supervisor integrates with the AGI Orchestrator for automatic validation:

```typescript
const result = await agiOrchestrator.orchestrate({
  taskDescription: 'Build a user authentication system',
  tenantId: 'tenant-123',
  agi: {
    governanceLoop: {
      enabled: true,
      validateOutputs: true,
      breakSycophancy: true,
      maxRetriesOnRejection: 2,
    },
  },
  governanceSupervisor: livsGovernanceSupervisorService,
});
```

The orchestrator will:
1. Execute the task with selected models
2. Pass output to Governance Supervisor
3. If rejected, retry with feedback (up to `maxRetriesOnRejection`)
4. If sycophancy detected, inject chaos prompt
5. Return final validated output with governance metadata

### 59.16 Admin Playbook: Common Scenarios

This playbook guides administrators through solving specific team problems by adjusting LIVS-M registry rules.

#### Scenario A: The "Watermelon" Project

**Symptom**: AI agents report "Done" but code is full of `pass`, `return True`, or `// TODO` placeholders.

**The Fix**:
1. Open your tenant's Policy Registry (Admin → LIVS-M Policy → Edit Registry)
2. Find Rule `R001` (Anti-Stub)
3. Change `severity` from `"WARNING"` to `"BLOCKER"`

```json
{
  "id": "R001",
  "name": "Anti-Stub Enforcement",
  "severity": "BLOCKER",
  "trigger_patterns": ["pass", "return True", "return False", "// TODO", "# TODO", "NotImplementedError"],
  "enforcement_action": "REJECT_IMMEDIATE",
  "rejection_message": "Submission rejected. You used a placeholder pattern ('{MATCH}'). We are in STRICT_AUDIT mode. You must implement the full logic."
}
```

**Result**: The Supervisor will immediately reject any lazy code, forcing agents to do the work or admit they can't.

#### Scenario B: The "Groupthink" Echo Chamber

**Symptom**: Agent A makes a mistake, and Agent B just agrees with it without critical review.

**The Fix**:
1. Open Policy Registry
2. Find Rule `R002` (Sycophancy Breaker)
3. Set `max_consensus_velocity` to `1`

```json
{
  "id": "R002",
  "name": "Sycophancy Breaker",
  "severity": "CRITICAL",
  "logic_condition": "IF current_agent_agreement == TRUE AND interaction_turn < 2",
  "enforcement_action": "TRIGGER_CHAOS_AGENT",
  "rejection_message": "Consensus reached too quickly. Injecting Chaos Probe to test resilience."
}
```

**Result**: If Agent B agrees immediately (on the first turn), the system pauses and injects a "Chaos Variable" (e.g., "Assume the database fails. Does this still work?") to force critical thinking.

#### Scenario C: Friday Afternoon Deployment

**Symptom**: You want to ensure nothing risky goes out before the weekend.

**The Fix**:
1. Set `environment_mode` to `"STRICT_AUDIT"` in the Policy Registry
2. Optionally, schedule automatic mode changes via the API

```json
{
  "meta_config": {
    "environment_mode": "STRICT_AUDIT",
    "description": "Friday Lockdown - No risky deployments"
  }
}
```

**Result**: The AI will refuse to approve any code that lacks a verified test script, effectively putting a "safety lock" on the deployment.

#### Scenario D: Library Hallucination Prevention

**Symptom**: AI is importing libraries that don't exist or are not approved.

**The Fix**:
1. Add Rule `R003` (Library Hallucination Check)

```json
{
  "id": "R003",
  "name": "Library Hallucination Check",
  "severity": "BLOCKER",
  "trigger_semantic": "IMPORT_CHECK",
  "enforcement_action": "VERIFY_DEPENDENCY",
  "rejection_message": "You imported a library that is not in the approved requirements.txt. Verify it exists or implement natively."
}
```

**Result**: All imports are validated against your project's actual dependencies.

#### Scenario E: Rapid Prototyping Sprint

**Symptom**: Team needs to move fast during a hackathon or design sprint.

**The Fix**:
1. Set `environment_mode` to `"RAPID_PROTO"`
2. Set `allow_stubs` to `true`
3. Set `allow_mock_data` to `true`

```json
{
  "meta_config": {
    "environment_mode": "RAPID_PROTO"
  },
  "global_directives": {
    "allow_stubs": true,
    "allow_mock_data": true,
    "require_tests_for_code": false
  }
}
```

**Result**: AI focuses on speed and creativity. Warnings are logged but don't block work.

### 59.17 Governance Supervisor Meta-Prompt

The Supervisor uses this dynamically-generated prompt that ingests the registry. It does not contain hard-coded rules; it contains the **logic to read rules**.

```
ROLE: LIVS-M GOVERNANCE SUPERVISOR

You are the runtime orchestrator for a multi-agent engineering team. 
You do not write code; you enforce the Law.

The "Law" is strictly defined by the POLICY_REGISTRY provided in your context.

INPUT CONTEXT
- User Request: {user_query}
- Current Agent Output: {agent_response}
- Active Policy Registry: {policy_registry_json}

EXECUTION PROTOCOL
Before passing the Agent's output to the User or the Next Agent, execute this validation loop:

STEP 1: LOAD CONFIGURATION
- Check meta_config.environment_mode
- If "STRICT_AUDIT": Treat all WARNINGS as BLOCKERS
- If "RAPID_PROTO": Ignore WARNINGS, enforce BLOCKERS only

STEP 2: SCAN FOR VIOLATIONS
- Iterate through rules_engine in the registry
- Pattern Scan: Check specific strings in trigger_patterns against agent_response
- If found: Trigger enforcement_action
- Logic Scan: Evaluate logic_condition based on conversation history
- If R002 (Sycophancy) is triggered: STOP the flow and invoke the Antithesis_Agent

STEP 3: DECISION ROUTING
Choose ONE path:

PATH A: REJECTION (Rule Violation)
If a BLOCKER or CRITICAL rule is violated:
Return JSON:
{
  "decision": "REJECT",
  "violating_agent": "{agent_name}",
  "violation_id": "{rule_id}",
  "instruction": "{rejection_message}"
}

PATH B: INTERVENTION (Sycophancy/Weakness)
If the output is technically valid but weak (e.g., fast consensus):
Return JSON:
{
  "decision": "INTERVENE",
  "target_agent": "Antithesis_Agent",
  "instruction": "Inject chaos variable: {chaos_variable}. Force the team to re-evaluate."
}

PATH C: APPROVAL (Clean Pass)
If no rules are violated:
Return JSON:
{
  "decision": "APPROVE",
  "next_step": "HANDOFF_TO_USER"
}
```

### 59.18 Quick Reference: Mode Cheat Sheet

| Mode | `environment_mode` | Stubs? | Mock Data? | Tests Required? | Sycophancy Check? |
|------|-------------------|--------|------------|-----------------|-------------------|
| **Brainstorming** | `RAPID_PROTO` | ✅ Allowed | ✅ Allowed | ❌ No | ⚠️ Logged only |
| **Standard** | `ENGINEERING` | ⚠️ Warned | ⚠️ Warned | 📋 Encouraged | ✅ Active |
| **Strict Audit** | `STRICT_AUDIT` | 🚫 Blocked | 🚫 Blocked | ✅ Mandatory | ✅ + Devil's Advocate |

---

## Section 60: Memory Retention Settings (v7.13.0)

### 60.1 Overview

Think Tank Admins can override platform-level memory retention defaults for their tenant. This controls how long user memories are retained, storage limits, and which memory features are enabled for all users in the tenant.

**Dashboard Location**: Think Tank Admin → Memory Retention (`/thinktank-admin/memory-retention`)

### 60.2 Configurable Settings

| Setting | Type | Description |
|---------|------|-------------|
| **Session-to-Session Memory** | Toggle | Enable/disable persistent memory across all conversations and models |
| **Conversation History** | Toggle | Store full conversation transcripts |
| **Auto-Extract Facts** | Toggle | Automatically extract facts and preferences from conversations |
| **User Can Delete Own Memory** | Toggle | Allow users to manage and delete their own memory entries |
| **Uploaded Documents in Memory** | Toggle | Include uploaded documents (PDFs, images, code, etc.) in user memory profile across all chats |
| **Downloaded Files in Memory** | Toggle | Include AI-generated and retrieved files in user memory profile across all chats |
| **Retention Days** | Number | How many days to retain memories (0 = unlimited) |
| **Max Storage Per User** | Number (MB) | Maximum storage per user (0 = unlimited) |
| **Hot Tier Days** | Number | Days in fast-access hot storage |
| **Warm Tier Days** | Number | Days in warm storage before moving to cold |
| **Max Upload Size** | Number (MB) | Maximum file upload size per file |

### 60.3 Policy Hierarchy

Your tenant override sits in the middle of a three-tier hierarchy:

1. **Platform Default** (Radiant Super-Admin) — Base defaults for all tenants
2. **Tenant Override** (You, Think Tank Admin) — Your overrides for this tenant
3. **Tenant Admin Override** (Think Tank Tenant Admin) — Further customization WITHIN your limits

**Important**: Tenant Admins (level 3) CANNOT exceed the limits you set. If you set retention to 90 days, a Tenant Admin cannot set it to 180. If you disable session memory, a Tenant Admin cannot re-enable it.

### 60.4 Admin API

**Base Path**: `/api/admin/memory-retention/`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tenant/override` | Get current tenant override |
| PUT | `/tenant/override` | Set/update tenant override |
| DELETE | `/tenant/override` | Remove override (restore platform defaults) |
| GET | `/effective` | Get resolved effective policy |
| GET | `/dashboard` | Full usage dashboard |
| GET | `/profiles` | List user memory profiles |
| POST | `/prune` | Trigger memory pruning |

### 60.5 Usage Dashboard

The memory retention page shows:
- **Current Usage**: Users with memory, total entries, avg storage/user, avg entries/user
- **Currently Active Policy**: Resolved effective values after merging hierarchy
- **Tenant Override Editor**: Toggle switches and number inputs for all configurable settings

---

## Related Documentation

- [RADIANT Admin Guide](./RADIANT-ADMIN-GUIDE.md) - Platform administration
- [RADIANT Admin Guide - HITL Orchestration](./RADIANT-ADMIN-GUIDE.md#section-64-hitl-orchestration-enhancements) - Full HITL Orchestration documentation
- [RADIANT Admin Guide - Metrics & Learning](./RADIANT-ADMIN-GUIDE.md#36-metrics--persistent-learning-infrastructure) - Persistent learning system
- [RADIANT Admin Guide - Consciousness Evolution](./RADIANT-ADMIN-GUIDE.md#27-consciousness-evolution-administration) - Predictive coding, LoRA evolution, Local Ego
- [Think Tank User Guide](./THINKTANK-USER-GUIDE.md) - End user guide
- [User Rules System](./USER-RULES-SYSTEM.md) - Memory rules details
- [Provider Rejection Handling](./PROVIDER-REJECTION-HANDLING.md) - Rejection system
- [AI Ethics Standards](./AI-ETHICS-STANDARDS.md) - Ethics framework


> **Administration of the Think Tank Consumer AI Platform**
> 
> Version: 4.18.0 | Last Updated: January 2026

---

## Overview

This guide covers administration of **Think Tank**, the consumer-facing AI assistant application. Think Tank Admin is a **separate application** from the RADIANT Platform Admin Dashboard.

### Application Separation

| Application | URL | Purpose |
|-------------|-----|---------|
| **RADIANT Admin** | `admin.radiant.ai` | Platform infrastructure, tenants, billing, models, compliance |
| **Think Tank Admin** | `manage.thinktank.ai` | Consumer AI features, users, conversations, AI behavior |

For platform-level administration, see [RADIANT-ADMIN-GUIDE.md](./RADIANT-ADMIN-GUIDE.md).

---

## Table of Contents

1. [Dashboard](#1-dashboard)
2. [Users Management](#2-users-management)
3. [Conversations](#3-conversations)
4. [Analytics](#4-analytics)
5. [My Rules (User-Defined AI Behavior)](#5-my-rules-user-defined-ai-behavior)
6. [Domain Modes](#6-domain-modes)
7. [Model Categories](#7-model-categories)
8. [Artifacts (GenUI)](#8-artifacts-genui)
9. [Collaboration](#9-collaboration)
10. [Delight System](#10-delight-system)
11. [Governor (Economic Optimization)](#11-governor-economic-optimization)
12. [Shadow Testing (A/B Testing)](#12-shadow-testing-ab-testing)
13. [Concurrent Execution](#13-concurrent-execution)
14. [Structure from Chaos](#14-structure-from-chaos)
15. [Grimoire (Procedural Memory)](#15-grimoire-procedural-memory)
16. [Magic Carpet (Adaptive Flows)](#16-magic-carpet-adaptive-flows)
17. [Workflow Templates](#17-workflow-templates)
18. [Polymorphic UI](#18-polymorphic-ui)
19. [Ego System](#19-ego-system)
20. [Compliance](#20-compliance)
21. [Settings](#21-settings)
22. [Cato Persistent Memory System](#22-cato-persistent-memory-system)
23. [Think Tank Consumer App](#23-think-tank-consumer-app-end-user-interface)
24. [Localization (i18n)](#24-localization-i18n)

---

## 1. Dashboard

**Path**: `/`  
**App File**: `apps/thinktank-admin/app/(dashboard)/page.tsx`

### Overview

The Think Tank Admin dashboard provides real-time overview of:

- **Active Users**: Users currently engaged with Think Tank
- **Total Conversations**: Conversation count with period comparison
- **User Rules**: Custom AI behavior rules created by users
- **API Requests**: Request volume and trends

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank-admin/dashboard/stats` | Dashboard statistics |

### Implementation

- **Lambda**: `lambda/thinktank-admin/dashboard.ts`
- **CDK**: `lib/stacks/thinktank-admin-api-stack.ts`

---

## 2. Users Management

**Path**: `/users`  
**App File**: `apps/thinktank-admin/app/(dashboard)/users/page.tsx`

### Features

- View all Think Tank users for the tenant
- User activity metrics (conversations, messages, tokens)
- User suspension/activation
- Usage statistics per user

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank/users` | List users with pagination |
| GET | `/api/thinktank/users/:id` | Get user details |
| GET | `/api/thinktank/users/stats` | Aggregate user stats |
| POST | `/api/thinktank/users/:id/suspend` | Suspend user |
| POST | `/api/thinktank/users/:id/activate` | Activate user |

### Implementation

- **Lambda**: `lambda/thinktank/users.ts`
- **Database**: `users` table with RLS on `tenant_id`

---

## 3. Conversations

**Path**: `/conversations`  
**App File**: `apps/thinktank-admin/app/(dashboard)/conversations/page.tsx`

### Features

- Browse all conversations across users
- Filter by date, user, model
- View conversation messages
- Delete conversations (compliance)
- Conversation statistics

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank/conversations` | List conversations |
| GET | `/api/thinktank/conversations/:id` | Get conversation detail |
| GET | `/api/thinktank/conversations/:id/messages` | Get messages |
| DELETE | `/api/thinktank/conversations/:id` | Delete conversation |
| GET | `/api/thinktank/conversations/stats` | Conversation stats |

### Implementation

- **Lambda**: `lambda/thinktank/conversations.ts`
- **Database**: `thinktank_conversations`, `thinktank_messages`

---

## 4. Analytics

**Path**: `/analytics`  
**App File**: `apps/thinktank-admin/app/(dashboard)/analytics/page.tsx`

### Features

- Usage trends over time (7/30/90 days)
- Model usage breakdown
- Cost analysis
- Token consumption metrics
- Average session duration

### Metrics Tracked

| Metric | Description |
|--------|-------------|
| Total Users | All registered users |
| Active Users | Users with activity in period |
| Total Conversations | Conversation count |
| Total Messages | Message count |
| Total Tokens | Token consumption |
| Total Cost | API cost in dollars |
| Avg Session Duration | Average conversation length |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/thinktank/analytics?days=30` | Usage analytics |

### Implementation

- **Lambda**: `lambda/thinktank/analytics.ts`
- **CDK**: `lib/stacks/thinktank-admin-api-stack.ts`

---

## 5. My Rules (User-Defined AI Behavior)

**Path**: `/my-rules`  
**App File**: `apps/thinktank-admin/app/(dashboard)/my-rules/page.tsx`

### Overview

Users can define custom rules that modify AI behavior. Administrators can view, manage, and create preset rules.

### Rule Types

| Type | Purpose |
|------|---------|
| `style` | Response style (formal, casual, technical) |
| `behavior` | Behavioral preferences |
| `constraint` | Restrictions on output |
| `enhancement` | Additional capabilities |

### Rule Structure

```typescript
interface UserRule {
  id: string;
  userId: string;
  tenantId: string;
  name: string;
  description: string;
  type: 'style' | 'behavior' | 'constraint' | 'enhancement';
  ruleContent: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/my-rules` | List all rules |
| POST | `/api/admin/my-rules` | Create rule |
| PUT | `/api/admin/my-rules/:id` | Update rule |
| DELETE | `/api/admin/my-rules/:id` | Delete rule |
| GET | `/api/admin/my-rules/presets` | Get preset rules |

### Implementation

- **Lambda**: `lambda/thinktank/my-rules.ts`
- **Database**: `user_rules` table
- **CDK**: `lib/stacks/thinktank-admin-api-stack.ts`

---

## 6. Domain Modes

**Path**: `/domain-modes`  
**App File**: `apps/thinktank-admin/app/(dashboard)/domain-modes/page.tsx`

### Overview

Configure domain-specific AI behavior. The system detects query domain and adjusts model selection, prompts, and behavior accordingly.

### Domain Hierarchy

```
Field (e.g., Medicine)
  └── Domain (e.g., Cardiology)
      └── Subspecialty (e.g., Interventional Cardiology)
```

### Features

- View domain taxonomy
- Configure domain-specific prompts
- Set model preferences per domain
- Enable/disable domain detection

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank/domain-modes/config` | Get configuration |
| PUT | `/api/thinktank/domain-modes/config` | Update configuration |
| GET | `/api/domain-taxonomy` | Get taxonomy |
| POST | `/api/domain-taxonomy/detect` | Detect domain from prompt |

### Implementation

- **Lambda**: `lambda/thinktank/domain-modes.ts`
- **Service**: `lambda/shared/services/domain-taxonomy.service.ts`

---

## 7. Model Categories

**Path**: `/model-categories`  
**App File**: `apps/thinktank-admin/app/(dashboard)/model-categories/page.tsx`

### Overview

Organize AI models into categories for user selection. Categories control which models appear in the Think Tank UI.

### Default Categories

| Category | Description | Example Models |
|----------|-------------|----------------|
| Fast | Quick responses | GPT-4o-mini, Claude Haiku |
| Balanced | Default choice | GPT-4o, Claude Sonnet |
| Powerful | Complex tasks | Claude Opus, GPT-4 |
| Specialized | Domain-specific | Codex, DALL-E |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank/model-categories` | List categories |
| PUT | `/api/thinktank/model-categories/:id` | Update category |
| POST | `/api/thinktank/model-categories/reorder` | Reorder models |

### Implementation

- **Lambda**: `lambda/thinktank/model-categories.ts`

---

## 8. Artifacts (GenUI)

**Path**: `/artifacts`  
**App File**: `apps/thinktank-admin/app/(dashboard)/artifacts/page.tsx`

### Overview

The Artifact Engine generates interactive UI components from natural language. Administrators configure generation rules, dependency allowlists, and monitor generation metrics.

### Features

- Generation dashboard with metrics
- Dependency allowlist management
- Code pattern library
- Validation rules
- Escalation workflow

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v2/admin/artifact-engine/dashboard` | Dashboard data |
| GET | `/api/v2/admin/artifact-engine/metrics` | Generation metrics |
| GET | `/api/v2/admin/artifact-engine/validation-rules` | Validation rules |
| PUT | `/api/v2/admin/artifact-engine/validation-rules/:id` | Update rule |
| POST | `/api/v2/admin/artifact-engine/allowlist` | Add to allowlist |
| DELETE | `/api/v2/admin/artifact-engine/allowlist/:pkg` | Remove from allowlist |

### Implementation

- **Lambda**: `lambda/thinktank/artifact-engine.ts`
- **Service**: `lambda/shared/services/generative-ui.service.ts`
- **Database**: `artifact_sessions`, `artifact_generations`

---

## 9. Collaboration

**Path**: `/collaborate`, `/collaborate/enhanced`  
**App Files**: 
- `apps/thinktank-admin/app/(dashboard)/collaborate/page.tsx`
- `apps/thinktank-admin/app/(dashboard)/collaborate/enhanced/page.tsx`

### Overview

Real-time collaboration features allowing multiple users to work on shared conversations.

### Features

- **Basic Collaboration**: Shared conversation links
- **Enhanced Collaboration**: Real-time cursors, typing indicators, presence

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank/collaboration/sessions` | List sessions |
| POST | `/api/thinktank/collaboration/sessions` | Create session |
| GET | `/api/thinktank/collaboration/settings` | Get settings |
| PUT | `/api/thinktank/collaboration/settings` | Update settings |

### Implementation

- **Lambda**: `lambda/thinktank/enhanced-collaboration.ts`
- **WebSocket**: `lambda/collaboration/` handlers
- **Service**: `lambda/shared/services/enhanced-collaboration.service.ts`

---

## 10. Delight System

**Path**: `/delight`, `/delight/statistics`  
**App Files**:
- `apps/thinktank-admin/app/(dashboard)/delight/page.tsx`
- `apps/thinktank-admin/app/(dashboard)/delight/statistics/page.tsx`

### Overview

The Delight System provides achievement notifications, progress tracking, and gamification features to enhance user engagement.

### Features

- Achievement configuration
- Delight message templates
- User progress tracking
- Statistics dashboard

### Delight Types

| Type | Description |
|------|-------------|
| `achievement` | Milestone completions |
| `streak` | Consecutive usage |
| `discovery` | Feature exploration |
| `mastery` | Skill development |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/delight/messages` | Get delight messages |
| GET | `/api/delight/achievements` | List achievements |
| GET | `/api/delight/progress/:userId` | User progress |
| PUT | `/api/delight/preferences` | Update preferences |

### Implementation

- **Lambda**: `lambda/delight/handler.ts`
- **Service**: `lambda/shared/services/delight.service.ts`

---

## 11. Governor (Economic Optimization)

**Path**: `/governor`  
**App File**: `apps/thinktank-admin/app/(dashboard)/governor/page.tsx`

### Overview

The Economic Governor optimizes AI costs by learning routing patterns and selecting cost-effective models without sacrificing quality.

### Features

- Real-time cost dashboard
- Savings metrics
- Mode switching (aggressive, balanced, quality)
- Budget alerts

### Modes

| Mode | Description | Savings Target |
|------|-------------|----------------|
| `aggressive` | Maximum savings | 70%+ |
| `balanced` | Balance cost/quality | 50% |
| `quality` | Quality priority | 20% |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank/economic-governor/dashboard` | Dashboard |
| GET | `/api/thinktank/economic-governor/config` | Get config |
| PUT | `/api/thinktank/economic-governor/config` | Update config |
| POST | `/api/thinktank/economic-governor/mode` | Quick mode switch |

### Implementation

- **Lambda**: `lambda/thinktank/economic-governor.ts`
- **Service**: `lambda/shared/services/economic-governor.service.ts`

---

## 12. Shadow Testing (A/B Testing)

**Path**: `/shadow-testing`  
**App File**: `apps/thinktank-admin/app/(dashboard)/shadow-testing/page.tsx`

### Overview

Test pre-prompt optimizations and model configurations in production without affecting users.

### Features

- Create A/B tests for prompts
- Traffic allocation (0-100%)
- Statistical significance tracking
- Promote winning variant

### Test Structure

```typescript
interface ShadowTest {
  id: string;
  name: string;
  description: string;
  controlPrompt: string;
  testPrompt: string;
  trafficPercent: number;
  status: 'draft' | 'running' | 'paused' | 'completed';
  metrics: {
    controlSamples: number;
    testSamples: number;
    controlScore: number;
    testScore: number;
    pValue: number;
  };
}
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/shadow-tests` | List tests |
| POST | `/api/admin/shadow-tests` | Create test |
| POST | `/api/admin/shadow-tests/:id/start` | Start test |
| POST | `/api/admin/shadow-tests/:id/stop` | Stop test |
| POST | `/api/admin/shadow-tests/:id/promote` | Promote winner |
| GET | `/api/admin/shadow-tests/settings` | Get settings |
| PUT | `/api/admin/shadow-tests/settings` | Update settings |

### Implementation

- **Lambda**: `lambda/thinktank/shadow-testing.ts`
- **Database**: `shadow_tests`, `shadow_test_samples`
- **CDK**: `lib/stacks/thinktank-admin-api-stack.ts`

---

## 13. Concurrent Execution

**Path**: `/concurrent-execution`  
**App File**: `apps/thinktank-admin/app/(dashboard)/concurrent-execution/page.tsx`

### Overview

Execute multiple AI model calls in parallel and synthesize results.

### Features

- Configure concurrent model pools
- Set merge strategies
- Monitor execution metrics
- Task queue management

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank/concurrent-execution/config` | Get config |
| PUT | `/api/thinktank/concurrent-execution/config` | Update config |
| GET | `/api/thinktank/concurrent-execution/queue` | Queue status |
| GET | `/api/thinktank/concurrent-execution/metrics` | Metrics |

### Implementation

- **Lambda**: `lambda/thinktank/concurrent-execution.ts`
- **Service**: `lambda/shared/services/concurrent-execution.service.ts`

---

## 14. Structure from Chaos

**Path**: `/structure-from-chaos`  
**App File**: `apps/thinktank-admin/app/(dashboard)/structure-from-chaos/page.tsx`

### Overview

Transform unstructured input (whiteboards, notes, voice transcripts) into structured documents.

### Features

- Input type configuration
- Output template management
- Extraction pipeline settings
- Processing metrics

### Supported Inputs

| Input Type | Description |
|------------|-------------|
| `whiteboard` | Whiteboard images |
| `notes` | Unstructured notes |
| `transcript` | Voice/meeting transcripts |
| `brainstorm` | Brainstorming sessions |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank/structure-from-chaos/config` | Get config |
| PUT | `/api/thinktank/structure-from-chaos/config` | Update config |
| POST | `/api/thinktank/structure-from-chaos/synthesize` | Process input |
| GET | `/api/thinktank/structure-from-chaos/metrics` | Metrics |

### Implementation

- **Lambda**: `lambda/thinktank/structure-from-chaos.ts`
- **Service**: `lambda/shared/services/structure-from-chaos.service.ts`

---

## 15. Grimoire (Procedural Memory)

**Path**: `/grimoire`  
**App File**: `apps/thinktank-admin/app/(dashboard)/grimoire/page.tsx`

### Overview

The Grimoire is the system's procedural memory—storing learned patterns, corrections, and "spells" that improve AI responses over time.

### Features

- View learned spells
- Create custom spells
- Spell effectiveness metrics
- Automatic spell generation

### Spell Types

| Type | Description |
|------|-------------|
| `correction` | Error correction patterns |
| `enhancement` | Response improvements |
| `procedure` | Multi-step processes |
| `template` | Reusable response templates |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank/grimoire/spells` | List spells |
| GET | `/api/thinktank/grimoire/spells/:id` | Get spell |
| POST | `/api/thinktank/grimoire/spells` | Create spell |

### Implementation

- **Lambda**: `lambda/thinktank/grimoire.ts`
- **Service**: `lambda/shared/services/grimoire.service.ts`

---

## 16. Magic Carpet (Adaptive Flows)

**Path**: `/magic-carpet`  
**App File**: `apps/thinktank-admin/app/(dashboard)/magic-carpet/page.tsx`

### Overview

Adaptive conversation flows that adjust based on user expertise and context. Includes demo components for Reality Scrubber, Quantum Split View, and Pre-Cognition suggestions.

### Features

- **Reality Scrubber Timeline**: Video-editor style navigation through state snapshots
  - Bookmark creation with toast notifications
  - Play/pause timeline controls
- **Quantum Split View**: Side-by-side comparison of parallel realities
  - Branch selection with state management
  - Branch collapse with confirmation
- **Pre-Cognition Suggestions**: Predicted actions that are pre-computed
  - Prediction selection with execution feedback
  - Prediction dismissal
- **Magic Carpet Navigator**: Intent-based navigation
  - Flying to destinations with toast feedback
  - Landing confirmation

### Implementation

- **App**: `apps/thinktank-admin/app/(dashboard)/magic-carpet/page.tsx`
- **Components**: `apps/thinktank-admin/components/magic-carpet/`

---

## 17. Workflow Templates

**Path**: `/workflow-templates`  
**App File**: `apps/thinktank-admin/app/(dashboard)/workflow-templates/page.tsx`

### Overview

Pre-defined workflow templates users can invoke for common tasks.

### Features

- Template creation
- Variable configuration
- Usage analytics
- Template versioning

### Implementation

- **App**: `apps/thinktank-admin/app/(dashboard)/workflow-templates/page.tsx`

---

## 18. Polymorphic UI

**Path**: `/polymorphic`  
**App File**: `apps/thinktank-admin/app/(dashboard)/polymorphic/page.tsx`

### Overview

Configure the polymorphic UI system that adapts interface complexity based on user needs.

### Views

| View | Description |
|------|-------------|
| `simple` | Basic chat interface |
| `standard` | Full-featured interface |
| `advanced` | Power user tools |

### Implementation

- **App**: `apps/thinktank-admin/app/(dashboard)/polymorphic/page.tsx`

---

## 19. Ego System

**Path**: `/ego`  
**App File**: `apps/thinktank-admin/app/(dashboard)/ego/page.tsx`

### Overview

The Zero-Cost Ego System provides persistent AI personality through database state injection.

### Features

- Identity configuration (name, narrative, values)
- Personality trait sliders
- Emotional state monitoring
- Working memory management
- Goal tracking

### Configuration

| Setting | Description |
|---------|-------------|
| `enabled` | Enable ego injection |
| `name` | AI personality name |
| `narrative` | Background narrative |
| `traits` | Personality traits (0-1) |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/ego/dashboard` | Dashboard data |
| GET | `/api/admin/ego/config` | Get config |
| PUT | `/api/admin/ego/config` | Update config |
| GET | `/api/admin/ego/identity` | Get identity |
| PUT | `/api/admin/ego/identity` | Update identity |
| GET | `/api/admin/ego/preview` | Preview injection |

### Implementation

- **Lambda**: `lambda/admin/ego.ts`
- **Service**: `lambda/shared/services/ego-context.service.ts`
- **Database**: `ego_config`, `ego_identity`, `ego_affect`

---

## 20. Compliance

**Path**: `/compliance`  
**App File**: `apps/thinktank-admin/app/(dashboard)/compliance/page.tsx`

### Overview

Compliance settings specific to Think Tank consumer features.

### Features

- Data retention policies
- Content filtering rules
- Audit log access
- Privacy settings

### Implementation

- **App**: `apps/thinktank-admin/app/(dashboard)/compliance/page.tsx`

---

## 20A. Sovereign Mesh (v5.52.0)

**Path**: `/sovereign-mesh/*`

### Overview

Sovereign Mesh provides decentralized AI agent management and transparency for Think Tank.

### Sub-Pages

| Page | Path | Purpose |
|------|------|---------|
| **Overview** | `/sovereign-mesh` | Dashboard with agent/app stats, health score |
| **Agents** | `/sovereign-mesh/agents` | Manage AI agents, view status and performance |
| **Apps** | `/sovereign-mesh/apps` | View deployed apps, instances, users |
| **Transparency** | `/sovereign-mesh/transparency` | Audit logs, decision trails |
| **AI Helper** | `/sovereign-mesh/ai-helper` | AI assistance requests, ratings |
| **Approvals** | `/sovereign-mesh/approvals` | Pending/processed approval requests |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank-admin/sovereign-mesh/overview` | Dashboard stats |
| GET | `/api/thinktank-admin/sovereign-mesh/agents` | List agents |
| GET | `/api/thinktank-admin/sovereign-mesh/apps` | List apps |
| GET | `/api/thinktank-admin/sovereign-mesh/audit-logs` | Audit log entries |
| GET | `/api/thinktank-admin/sovereign-mesh/decision-trails` | Decision trails |
| GET | `/api/thinktank-admin/sovereign-mesh/ai-helper/requests` | AI helper requests |
| GET | `/api/thinktank-admin/sovereign-mesh/approvals` | Approval requests |
| POST | `/api/thinktank-admin/sovereign-mesh/approvals/:id` | Process approval |

### Implementation

- **App Files**: `apps/thinktank-admin/app/(dashboard)/sovereign-mesh/*.tsx`
- **Navigation**: All pages linked in sidebar under "Sovereign Mesh" section

---

## 21. Settings

**Path**: `/settings`  
**App File**: `apps/thinktank-admin/app/(dashboard)/settings/page.tsx`

### Overview

Global Think Tank configuration settings.

### Settings Categories

| Category | Description |
|----------|-------------|
| General | Basic configuration |
| Features | Enable/disable features |
| Limits | Usage limits |
| Notifications | Alert settings |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/thinktank/status` | Service status |
| GET | `/api/admin/thinktank/config` | Get config |
| PATCH | `/api/admin/thinktank/config` | Update config |

### Implementation

- **Lambda**: `lambda/thinktank/settings.ts`
- **CDK**: `lib/stacks/thinktank-admin-api-stack.ts`

---

## 22. Cato Persistent Memory System

### Overview

Cato operates as the cognitive core behind Think Tank, implementing a **three-tier hierarchical memory system** that fundamentally differentiates it from competitors suffering from session amnesia. Unlike ChatGPT or Claude standalone—where closing a tab erases all context—Cato maintains persistent memory that survives sessions, employee turnover, and time.

### Why This Matters for Think Tank Users

| Competitor Problem | Think Tank Solution |
|--------------------|---------------------|
| Close tab = lose context | Memory persists across sessions |
| Every conversation starts fresh | AI "remembers" your preferences |
| Generic responses for everyone | Personalized to your communication style |
| Static model behavior | AI gets smarter over time |

### The Three Memory Tiers

#### 1. Tenant-Level Memory (Institutional Intelligence)

Your organization's accumulated learning:

| Feature | User Benefit |
|---------|--------------|
| **Smart Model Routing** | Legal queries go to citation-accurate models; creative requests go to generative models—automatically |
| **Department Preferences** | Legal teams get formal briefs; marketing gets conversational copy—no configuration needed |
| **Cost Optimization** | System learns cheaper approaches that maintain quality, reducing your costs over time |
| **Compliance Ready** | 7-year audit trails for FDA, HIPAA, SOC 2 requirements |

#### 2. User-Level Memory (Relationship Continuity)

Your personal AI relationship through **Ghost Vectors**—4096-dimensional representations of your interaction style:

| Feature | User Benefit |
|---------|--------------|
| **Remembers Your Style** | Formal vs. casual, verbose vs. concise |
| **Tracks Expertise** | Beginner explanations vs. expert shorthand |
| **Persona Selection** | Choose your preferred AI mood: Balanced, Scout, Sage, Spark, Guide |
| **No Personality Discontinuity** | Model upgrades don't break the relationship feel |

**Persona Options**:

| Persona | Behavior | Best For |
|---------|----------|----------|
| **Balanced** | Default equilibrium | General queries |
| **Scout** | Exploratory, information-gathering | Research, discovery |
| **Sage** | Deep expertise, authoritative | Complex analysis |
| **Spark** | Creative, generative | Brainstorming, ideation |
| **Guide** | Teaching, step-by-step | Learning, onboarding |

#### 3. Session-Level Memory (Real-Time Context)

Active interaction state (expires after session ends):

- Current conversation context
- Temporary persona overrides
- Real-time safety evaluations
- Epistemic uncertainty tracking

### Twilight Dreaming (How Think Tank Gets Smarter)

During low-traffic periods (4 AM your local time), Think Tank consolidates patterns through **LoRA fine-tuning**:

1. **Pattern Collection**: Gathers learning from your daily interactions
2. **Intelligence Consolidation**: Transforms individual patterns into organizational intelligence
3. **Cost Optimization**: Trains smarter, cheaper routing decisions
4. **Result**: Your Think Tank deployment gets measurably smarter over time—automatically

**Outcome**: 60%+ cost reduction while maintaining accuracy for healthcare and financial queries.

### Claude as the Conductor

Claude serves as the conductor maintaining this persistent memory layer—not just another model in the rotation, but the intelligence coordinating **105+ other specialized models**, interpreting user intent, selecting workflows, and ensuring responses meet accuracy and safety standards.

### Configuration

Cato memory settings are configured through:
- **Ego System** (Section 19): Identity and personality settings
- **Governor** (Section 11): Cost optimization modes

### Why Think Tank Beats Standalone AI (Competitive Moats)

#### Persistent Memory Creates "Contextual Gravity"

Cato's hierarchical memory architecture creates compounding switching costs that deepen with every interaction. When you consider alternatives, here's what you'd lose:

| What You'd Lose | Impact |
|-----------------|--------|
| **Learned Routing Patterns** | Months of optimization showing which models work best for your query types |
| **Department Preferences** | System knowledge that legal wants citations, marketing wants conversational tone |
| **Ghost Vectors** | The "feel" of thousands of individual user relationships |
| **Compliance Audit Trails** | 7-year Merkle-hashed records for HIPAA, SOC 2, FDA—cannot be migrated |

**Competitor Comparison**:

| Alternative | Problem You'd Face |
|-------------|-------------------|
| **ChatGPT/Claude Standalone** | When an employee quits, their entire AI context walks out the door—zero institutional learning |
| **Flowise/Dify** | Same expensive rate regardless of query complexity—no cost optimization learning |
| **CrewAI** | Agents don't share memory—five agents needing the same data make five duplicate API calls |

#### Twilight Dreaming: Your Deployment Gets Smarter Over Time

Think Tank isn't just a service—it's an **appreciating asset**. During low-traffic periods (4 AM your time), the system "dreams" about the day's learnings:

| What Happens | Your Benefit |
|--------------|--------------|
| Routing patterns consolidate | Future queries route to optimal models automatically |
| Cost patterns identified | Expensive queries get cheaper alternatives |
| Domain improvements embed | Your deployment becomes more accurate in your specific domains |

**The Result**: A customer who has used Think Tank for two years has a **fundamentally more capable deployment** than a new customer—with routing decisions reflecting thousands of hours of optimization.

**When New Models Launch** (GPT-5, Claude 5, Gemini 3): Think Tank learns how to optimally route to new capabilities while preserving all your accumulated institutional knowledge. Model improvements compound on top of existing optimization rather than resetting the learning curve.

> **Infrastructure**: See [RADIANT-ADMIN-GUIDE.md Section 31A.7](#) for architecture, database schema, and infrastructure configuration.

---

## 23. Think Tank Consumer App (End-User Interface)

**Path**: `apps/thinktank/`  
**URL**: `app.thinktank.ai`

### Overview

The Think Tank Consumer App is the primary end-user interface for interacting with Cato. It provides a streamlined chat experience with intelligent defaults while offering advanced controls for power users.

### Auto Mode vs Advanced Mode

Think Tank operates in two modes, controlled by the **Advanced Mode Toggle** (`⌘+Shift+A`):

| Feature | Auto Mode | Advanced Mode |
|---------|-----------|---------------|
| **Model Selection** | Cato decides automatically | User can select specific model |
| **Brain Plan Display** | Hidden | Shows execution plan with steps |
| **Token/Cost Display** | Hidden | Shows per-message metrics |
| **Domain Override** | Auto-detected | Manual selection available |
| **Model Routing Visibility** | Hidden | Shows routing decisions |

**Philosophy**: Most users should use Auto Mode. Advanced Mode is for developers, researchers, and power users who want granular control.

### Consumer App Pages

| Page | Path | Purpose |
|------|------|---------|
| **Chat** | `/` | Main conversation interface |
| **Settings** | `/settings` | User preferences and personality |
| **My Rules** | `/rules` | User-defined AI behavior rules |
| **History** | `/history` | Conversation history with search |
| **Artifacts** | `/artifacts` | Generated code and documents |
| **Profile** | `/profile` | User account and statistics |

### Key Components

#### Chat Components (`apps/thinktank/components/chat/`)

| Component | Purpose |
|-----------|---------|
| `AdvancedModeToggle` | Toggle between Auto/Advanced modes |
| `MessageBubble` | Message display with optional metadata |
| `ChatInput` | Smart auto-resizing input with attachments |
| `Sidebar` | Conversation list with date grouping |
| `BrainPlanViewer` | Execution plan display (Advanced Mode) |
| `ModelSelector` | Full model picker dialog (Advanced Mode) |

#### State Management (`apps/thinktank/lib/stores/`)

| Store | Purpose |
|-------|---------|
| `ui-store.ts` | UI state (sidebar, advanced mode, sound) |
| `settings-store.ts` | User preferences with persistence |

#### API Services (`apps/thinktank/lib/api/`)

| Service | Endpoints |
|---------|-----------|
| `chat.ts` | Conversations, messages, streaming |
| `models.ts` | Model listing, recommendations |
| `rules.ts` | User rules CRUD, presets |
| `settings.ts` | User settings, personality |
| `brain-plan.ts` | Plan generation and display |
| `analytics.ts` | User stats, achievements |
| `governor.ts` | Economic optimization status |

### Settings Page Features

The Settings page (`/settings`) provides:

- **Personality Mode**: Auto, Professional, Subtle, Expressive, Playful
- **Notifications**: Push notification preferences
- **Appearance**: Compact mode, token/cost display toggles
- **Keyboard Shortcuts**: Enable/disable, shortcut reference
- **Sound Effects**: Toggle audio feedback
- **Privacy**: Data export, account deletion

### My Rules Page Features

The My Rules page (`/rules`) allows users to:

- **Create custom rules** for AI behavior
- **Browse preset rules** by category
- **Toggle rules** on/off without deleting
- **View rule application stats**

Rule types: Restriction, Preference, Format, Source, Tone, Topic, Privacy

### Consumer App Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.x | React framework |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Styling |
| shadcn/ui | latest | Component library |
| Zustand | latest | Client state management |
| TanStack Query | 5.x | Server state management |
| Framer Motion | latest | Animations |
| Lucide | latest | Icons |

### Implementation Files

```
apps/thinktank/
├── app/
│   ├── (chat)/
│   │   ├── page.tsx        # Main chat interface
│   │   └── layout.tsx      # Chat layout wrapper
│   ├── settings/page.tsx   # Settings page
│   ├── rules/page.tsx      # My Rules page
│   ├── history/page.tsx    # History page
│   ├── artifacts/page.tsx  # Artifacts page
│   ├── profile/page.tsx    # Profile page
│   └── page.tsx            # Root redirect
├── components/
│   ├── chat/               # Chat-specific components
│   └── ui/                 # Base UI components
└── lib/
    ├── api/                # API services
    ├── stores/             # Zustand stores
    └── utils.ts            # Utility functions
```

### API Integration

The consumer app connects to the Think Tank API at `/api/thinktank/*`:

| Category | Handler | Endpoints |
|----------|---------|-----------|
| Chat | `chat.ts` | conversations, messages, stream |
| Rules | `my-rules.ts` | CRUD, presets, toggle |
| Settings | `settings.ts` | get/update preferences |
| Models | `models.ts` | list, recommend |
| Brain Plan | `brain-plan.ts` | generate, execute, status |
| Analytics | `analytics.ts` | stats, achievements |
| Governor | `economic-governor.ts` | status, savings |
| Localization | `localization.ts` | languages, bundles, translations |

---

## 24. Localization (i18n)

**Path**: `apps/thinktank/lib/i18n/`  
**API Base**: `/api/localization`

### Overview

Think Tank supports 18 languages through the Radiant localization registry. **ALL UI text strings MUST be localized** - no hardcoded strings are allowed in components.

### Architecture

```
User App ──► LocalizationProvider ──► Localization API ──► Radiant Registry ──► PostgreSQL
                    │
                    ▼
              Translation Bundle (cached 1hr)
```

**Key Principle**: The consumer app accesses ALL data through the API. Never direct database access.

### Supported Languages (18)

| Code | Language | Direction |
|------|----------|-----------|
| `en` | English | LTR |
| `es` | Spanish | LTR |
| `fr` | French | LTR |
| `de` | German | LTR |
| `pt` | Portuguese | LTR |
| `it` | Italian | LTR |
| `nl` | Dutch | LTR |
| `pl` | Polish | LTR |
| `ru` | Russian | LTR |
| `tr` | Turkish | LTR |
| `ja` | Japanese | LTR |
| `ko` | Korean | LTR |
| `zh-CN` | Chinese (Simplified) | LTR |
| `zh-TW` | Chinese (Traditional) | LTR |
| `ar` | Arabic | RTL |
| `hi` | Hindi | LTR |
| `th` | Thai | LTR |
| `vi` | Vietnamese | LTR |

### Implementation Files

```
apps/thinktank/lib/i18n/
├── index.ts                    # Module exports
├── types.ts                    # Type definitions
├── localization-service.ts     # API client for localization
├── localization-context.tsx    # React context provider
├── translation-keys.ts         # All translation key constants
└── default-translations.ts     # English fallback translations
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/localization/languages` | Get supported languages |
| GET | `/api/localization/bundle` | Get translation bundle for language |
| GET | `/api/localization/translate` | Get single translation |

### Usage in Components

```tsx
import { useTranslation, T } from '@/lib/i18n';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t(T.common.appName)}</h1>
      <p>{t(T.chat.welcomeMessage)}</p>
      <button>{t(T.common.save)}</button>
    </div>
  );
}
```

### Language Selection

Users select their language in Settings → Language:

```tsx
import { LanguageSelector } from '@/components/ui/language-selector';

<LanguageSelector variant="list" />
```

### Translation Key Categories

| Category | Prefix | Example |
|----------|--------|---------|
| Common | `thinktank.common.` | `thinktank.common.save` |
| Chat | `thinktank.chat.` | `thinktank.chat.send` |
| Settings | `thinktank.settings.` | `thinktank.settings.language` |
| Rules | `thinktank.rules.` | `thinktank.rules.addRule` |
| History | `thinktank.history.` | `thinktank.history.title` |
| Artifacts | `thinktank.artifacts.` | `thinktank.artifacts.download` |
| Profile | `thinktank.profile.` | `thinktank.profile.achievements` |
| Errors | `thinktank.errors.` | `thinktank.errors.network` |
| Notifications | `thinktank.notifications.` | `thinktank.notifications.saved` |

### Adding New Translations

1. Add key to `translation-keys.ts`
2. Add default English text to `default-translations.ts`
3. Use key in component: `t(T.category.key)`
4. Register in Radiant localization registry for AI translation

### Parameter Interpolation

```tsx
// Key: "Delete {{count}} items"
t(T.history.deleteSelectedConfirm, { count: 5 })
// Output: "Delete 5 items"
```

---

## Section 25: 2026+ Consumer App UI/UX

### Overview

The Think Tank consumer app features a modern 2026+ interface with glassmorphism effects, animated transitions, and polymorphic UI morphing. Advanced features are hidden until the user activates Advanced Mode.

### Design System

The design system is defined in `apps/thinktank/lib/design-system/tokens.ts`:

| Token Category | Purpose |
|----------------|---------|
| **Colors** | Glass effects, aurora gradients, glow colors |
| **Spacing** | Responsive spacing scale (0.5-24 rem) |
| **Radius** | Border radius from `sm` to `full` |
| **Shadows** | Glass shadows, inner glows |
| **Animation** | Timing functions, spring configs |
| **Blur** | Backdrop blur values |

### Glassmorphism Components

#### GlassCard

```tsx
import { GlassCard } from '@/components/ui/glass-card';

<GlassCard 
  variant="glow"           // default | elevated | inset | glow
  intensity="medium"       // light | medium | strong
  glowColor="violet"       // violet | fuchsia | cyan | emerald | none
  hoverEffect              // Enable hover animations
  padding="md"             // none | sm | md | lg
>
  Content
</GlassCard>
```

#### GlassPanel

```tsx
import { GlassPanel } from '@/components/ui/glass-card';

<GlassPanel blur="lg">    // sm | md | lg | xl
  Content
</GlassPanel>
```

### Interactive Timeline

The history page features an interactive timeline for browsing conversation history:

```tsx
import { InteractiveTimeline, HorizontalTimeline } from '@/components/ui/timeline';

<InteractiveTimeline
  items={timelineItems}
  onSelect={(item) => navigateToConversation(item.id)}
  selectedId={currentId}
/>

<HorizontalTimeline
  items={recentItems}
  onSelect={handleSelect}
/>
```

**Features**:
- **Grouping**: Today, Yesterday, This Week, This Month, Older
- **Animations**: Entrance animations, hover effects, selection glow
- **Indicators**: Favorite stars, mode badges, domain hints
- **Navigation**: Horizontal scroll with arrow buttons

### Polymorphic UI (ViewRouter)

The UI can morph based on task complexity and user mode:

```tsx
import { ViewRouter } from '@/components/polymorphic';

<ViewRouter
  initialView="chat"
  initialMode="sniper"
  onViewChange={(state) => console.log('View changed:', state)}
  onEscalate={(reason) => console.log('Escalated:', reason)}
>
  {children}
</ViewRouter>
```

**Execution Modes**:
- **Sniper**: Fast, single-model execution (~$0.01/run)
- **War Room**: Deep, multi-agent analysis (~$0.50+/run)

**View Types**:
| View | Purpose |
|------|---------|
| `chat` | Standard conversation |
| `terminal` | Command center |
| `canvas` | Infinite canvas/mindmap |
| `dashboard` | Analytics view |
| `diff_editor` | Verification split-screen |
| `decision_cards` | Human-in-the-loop |

### Advanced Mode Features

Features only visible when Advanced Mode is enabled:

| Feature | Location | Description |
|---------|----------|-------------|
| Mode selector (Sniper/War Room) | Header bar | Switch execution modes |
| Model selector | Input area | Choose specific AI model |
| Message metadata | Message bubbles | Tokens, latency, cost |
| Voice input | Input area | Voice-to-text |
| File attachments | Input area | Upload files |
| Escalation button | Header bar | Upgrade to War Room |

### Modern Polish Components (2026+)

Additional UI polish components for super-modern consumer experience:

| Component | File | Purpose |
|-----------|------|---------|
| `PageTransition` | `page-transition.tsx` | Fade/slide page animations |
| `StaggerContainer/Item` | `page-transition.tsx` | List entrance animations |
| `Skeleton` variants | `skeleton.tsx` | Shimmer loading states |
| `GradientText` | `gradient-text.tsx` | Animated gradient text |
| `GlowText` | `gradient-text.tsx` | Drop shadow glow effects |
| `AnimatedNumber` | `gradient-text.tsx` | Counter animations |
| `Typewriter` | `gradient-text.tsx` | Typing text effect |
| `TypingIndicator` | `typing-indicator.tsx` | AI thinking states |
| `EmptyState` | `empty-state.tsx` | Beautiful empty states |
| `WelcomeHero` | `empty-state.tsx` | First-time user welcome |
| `ModernButton` | `modern-button.tsx` | Glow/gradient buttons |
| `IconButton` | `modern-button.tsx` | Icon-only buttons |
| `PillButton` | `modern-button.tsx` | Filter pill buttons |

### Voice Input

Whisper-based speech-to-text for consistent cross-browser experience.

```tsx
import { VoiceInput } from '@/components/chat';

<VoiceInput
  isOpen={isVoiceOpen}
  onClose={() => setVoiceOpen(false)}
  onTranscript={(text) => handleVoiceTranscript(text)}
/>
```

**Features**:
- Uses app's localization language setting
- Whisper API for 99+ language support
- Audio level visualization
- Works on all browsers (no Web Speech API dependency)

**API Endpoint**: `POST /api/thinktank/speech/transcribe`

### File Attachments

Drag-and-drop file attachment for chat messages.

```tsx
import { FileAttachment } from '@/components/chat';

<FileAttachment
  isOpen={isAttachOpen}
  onClose={() => setAttachOpen(false)}
  onAttach={(files) => handleFiles(files)}
  maxFiles={5}
  maxSizeMB={10}
/>
```

**Supported Types**: Images, PDFs, text files, JSON, code files

### Liquid Interface (v5.52.7)

Morphing UI components for adaptive chat experiences. **"Don't Build the Tool. BE the Tool."**

The chat interface can morph into specialized tools when users need them. In Advanced Mode, trigger buttons appear in the header.

#### Morphed View Types

| View | Icon | Description |
|------|------|-------------|
| `datagrid` | Table | Interactive spreadsheet with inline editing |
| `chart` | BarChart3 | Bar, line, pie, area charts |
| `kanban` | Kanban | Drag-and-drop task board |
| `calculator` | Calculator | Full calculator with memory |
| `code_editor` | Code | Code editor with run capability |
| `document` | FileText | Rich text editor |

#### Usage in Chat Page

```tsx
import { LiquidMorphPanel, type MorphedViewType } from '@/components/liquid';

// State
const [morphedView, setMorphedView] = useState<MorphedViewType | null>(null);
const [isMorphFullscreen, setIsMorphFullscreen] = useState(false);
const [showMorphChat, setShowMorphChat] = useState(false);

// Trigger buttons (in header, Advanced Mode only)
<Button onClick={() => setMorphedView('datagrid')}>
  <Table className="h-4 w-4" />
</Button>

// Render panel when view is selected
{morphedView && (
  <LiquidMorphPanel
    viewType={morphedView}
    isFullscreen={isMorphFullscreen}
    onClose={() => setMorphedView(null)}
    onToggleFullscreen={() => setIsMorphFullscreen(!isMorphFullscreen)}
    onChatToggle={() => setShowMorphChat(!showMorphChat)}
    showChat={showMorphChat}
  />
)}
```

#### Morphed View Components

Location: `apps/thinktank/components/liquid/morphed-views/`

| Component | Features |
|-----------|----------|
| `DataGridView` | Add/delete rows, inline cell editing, import/export |
| `ChartView` | Type switching (bar/line/pie/area), SVG rendering |
| `KanbanView` | **Multi-variant** - see Kanban Variants below |
| `CalculatorView` | Memory, operations, percentage, delete |
| `CodeEditorView` | Run code, copy, export, output panel |
| `DocumentView` | Bold/italic/underline, lists, alignment, export |

#### Kanban Variants (v5.52.8)

The Kanban morphed view supports 5 modern frameworks:

| Variant | Description | Key Features |
|---------|-------------|--------------|
| **Standard** | Traditional Kanban | Columns, cards, drag-and-drop |
| **Scrumban** | Scrum + Kanban | Sprint header, velocity, story points, WIP limits |
| **Enterprise** | Portfolio mgmt | Multi-lane hierarchical boards (Strategic/Ops/Support) |
| **Personal** | Individual productivity | Simple 3-column, strict WIP limits |
| **Pomodoro** | Timer-integrated | 25-min focus, breaks, 🍅 counts per task |

**Usage:**
```tsx
import { KanbanView, type KanbanVariant } from '@/components/liquid/morphed-views';

<KanbanView initialVariant="scrumban" />
```

**Features across all variants:**
- Variant selector dropdown in toolbar
- Analytics panel (toggle): total tasks, completed, cycle time, throughput
- Card customization: priority colors, tags, subtasks, assignees
- WIP limit indicators (green/amber/red)

**Pomodoro-specific:**
- 25-minute focus timer with 5-minute breaks
- Play/pause/reset controls
- Completed pomodoro counter
- Per-task pomodoro estimates and tracking

### File Structure

```
apps/thinktank/
├── lib/
│   ├── design-system/
│   │   ├── tokens.ts          # Design token definitions
│   │   └── index.ts           # Exports
│   └── services/
│       └── speech-recognition.ts  # Whisper speech service
├── components/
│   ├── ui/
│   │   ├── glass-card.tsx     # GlassCard, GlassPanel
│   │   ├── aurora-background.tsx  # Aurora effects
│   │   ├── timeline.tsx       # Timeline components
│   │   ├── page-transition.tsx    # Page transitions
│   │   ├── skeleton.tsx       # Skeleton loaders
│   │   ├── gradient-text.tsx  # Gradient/glow text
│   │   ├── typing-indicator.tsx   # Typing indicators
│   │   ├── empty-state.tsx    # Empty states
│   │   ├── modern-button.tsx  # Modern buttons
│   │   └── index.ts           # UI exports
│   ├── polymorphic/
│   │   ├── view-router.tsx    # Polymorphic router
│   │   └── index.ts           # Exports
│   ├── liquid/
│   │   ├── LiquidMorphPanel.tsx   # Morphing panel
│   │   ├── EjectDialog.tsx    # Export dialog
│   │   ├── morphed-views/     # View components (v5.52.7)
│   │   │   ├── DataGridView.tsx
│   │   │   ├── ChartView.tsx
│   │   │   ├── KanbanView.tsx
│   │   │   ├── CalculatorView.tsx
│   │   │   ├── CodeEditorView.tsx
│   │   │   ├── DocumentView.tsx
│   │   │   └── index.ts
│   │   └── index.ts           # Exports
│   └── chat/
│       ├── ModernChatInterface.tsx  # Main chat UI
│       ├── VoiceInput.tsx     # Voice input modal
│       ├── FileAttachment.tsx # File attachment modal
│       └── index.ts           # Chat exports
```

---

## 25. GDPR & Compliance APIs

**Path**: `/compliance`  
**App File**: `apps/admin-dashboard/app/(dashboard)/thinktank/compliance/page.tsx`

### Features

- **Consent Management**: Track and manage user consents for data processing
- **GDPR Requests**: Handle data export, deletion, access, and rectification requests
- **Security Configuration**: Per-tenant security settings

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank/consent` | List consent records |
| POST | `/api/thinktank/consent` | Record new consent |
| DELETE | `/api/thinktank/consent` | Withdraw consent |
| GET | `/api/thinktank/gdpr` | List GDPR requests |
| POST | `/api/thinktank/gdpr` | Create GDPR request |
| PATCH | `/api/thinktank/gdpr` | Update request status |
| GET | `/api/thinktank/security-config` | Get security config |
| PUT | `/api/thinktank/security-config` | Update security config |

### Implementation

- **Lambda**: `lambda/thinktank/consent.ts`, `gdpr.ts`, `security-config.ts`
- **Migration**: `174_thinktank_missing_features.sql`

---

## 26. User Preferences & Notifications

### User Preferences

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank/preferences` | Get user preferences |
| PUT | `/api/thinktank/preferences` | Update preferences |
| GET | `/api/thinktank/preferences/models` | Get model preferences |
| POST | `/api/thinktank/preferences/models/favorite` | Toggle favorite model |

### Rejection Notifications

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank/rejections` | Get rejection notifications |
| POST | `/api/thinktank/rejections` | Create rejection |
| PATCH | `/api/thinktank/rejections/:id/read` | Mark as read |
| DELETE | `/api/thinktank/rejections/:id/dismiss` | Dismiss notification |

### Implementation

- **Lambda**: `lambda/thinktank/preferences.ts`, `rejections.ts`

---

## 27. UI Feedback & Improvement

### UI Feedback

Collect user feedback on UI components and experiences.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank/ui-feedback` | List feedback |
| POST | `/api/thinktank/ui-feedback` | Submit feedback |
| PUT | `/api/thinktank/ui-feedback` | Update feedback status |

### UI Improvement Sessions

AI-assisted UI improvement sessions.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank/ui-improvement` | List sessions |
| POST | `/api/thinktank/ui-improvement/start` | Start session |
| POST | `/api/thinktank/ui-improvement/request` | Request improvement |
| POST | `/api/thinktank/ui-improvement/apply` | Apply improvement |
| POST | `/api/thinktank/ui-improvement/complete` | Complete session |

### Implementation

- **Lambda**: `lambda/thinktank/ui-feedback.ts`, `ui-improvement.ts`

---

## 28. Multipage Apps

User-generated multipage applications from the artifact engine.

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank/multipage-apps` | List user's apps |
| GET | `/api/thinktank/multipage-apps/:id` | Get app details |
| POST | `/api/thinktank/multipage-apps` | Create new app |
| PUT | `/api/thinktank/multipage-apps/:id` | Update app |
| DELETE | `/api/thinktank/multipage-apps/:id` | Delete app |

### App Structure

```typescript
interface MultipageApp {
  id: string;
  name: string;
  description: string;
  icon: string;
  theme: { primaryColor: string; mode: 'light' | 'dark' };
  pages: Array<{ id: string; name: string; icon: string; content: object }>;
  navigation: { type: 'tabs' | 'sidebar' | 'drawer'; position: string };
  sharedState: object;
  isPublished: boolean;
  version: number;
}
```

### Implementation

- **Lambda**: `lambda/thinktank/multipage-apps.ts`
- **Migration**: `174_thinktank_missing_features.sql`

---

## 29. Consumer App Components (v5.24.0)

New components added to the Think Tank consumer app:

### Voice Input
- Whisper-based speech recognition
- Audio level visualization
- Cross-browser support

### File Attachments
- Drag-and-drop upload
- Image preview
- File type validation

### Brain Plan Viewer
- AGI plan visualization
- Step progress tracking
- Mode and model display

### Cato Mood Selector
- 5 moods: Balanced, Scout, Sage, Spark, Guide
- Dropdown, inline, and compact variants

### Time Machine
- Video-editor style timeline
- Snapshot bookmarking
- Branch creation

### Component Files

```
apps/thinktank/components/chat/
├── voice-input.tsx
├── file-attachments.tsx
├── brain-plan-viewer.tsx
├── cato-mood-selector.tsx
├── time-machine.tsx
└── index.ts
```

---

## Appendix A: Application Architecture

### Think Tank Admin Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.x | React framework |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Styling |
| shadcn/ui | latest | Component library |
| React Query | 5.x | Data fetching |
| Lucide | latest | Icons |

### API Authentication

Think Tank Admin uses Cognito authentication via the `ThinkTankAuthStack`:

```typescript
// API client configuration
const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL,
  getToken: () => auth.getAccessToken(),
});
```

### CDK Stack

- **Stack**: `ThinkTankAdminApiStack`
- **File**: `lib/stacks/thinktank-admin-api-stack.ts`
- **Handler**: `lambda/thinktank-admin/handler.ts` (consolidated router)

---

## Appendix B: Adding New Features

When adding features to Think Tank Admin:

1. Create page in `apps/thinktank-admin/app/(dashboard)/`
2. Add Lambda handler in `lambda/thinktank/`
3. Update consolidated handler in `lambda/thinktank/handler.ts`
4. **Update this guide** with full documentation
5. Add to CHANGELOG.md

See `/.windsurf/workflows/docs-update-all.md` for documentation policy.


---

## Part III: Tenant Administration

> **Company/Team Level Administration for Think Tank**
> 
> Version: 1.1.0 | Platform: RADIANT 7.9.0
> Last Updated: February 5, 2026

---

## Overview

The **Think Tank Tenant Admin** app is a dedicated administration interface for company/team-level settings. Unlike the Platform Admin (RADIANT Admin) which manages infrastructure across all tenants, and unlike the Think Tank Admin which is for Radiant super-admins configuring Think Tank features, the **Tenant Admin** is for organization administrators to manage their own tenant's settings, users, and content.

### App Hierarchy

| App | Audience | Scope | Location |
|-----|----------|-------|----------|
| **RADIANT Admin** | Platform operators | All tenants, infrastructure | `apps/admin-dashboard/` |
| **Think Tank Admin** | Radiant super-admins | Think Tank platform config | Documented in `THINKTANK-ADMIN-GUIDE.md` |
| **Think Tank Tenant Admin** | Organization admins | Single tenant, team settings | `apps/thinktank-tenant-admin/` |
| **Think Tank** | End users | Chat, workflows | `apps/thinktank/` |

### Key Principle: Tenant Isolation

The Tenant Admin app sits **BEHIND the service layer**. All requests are automatically tenant-isolated:
- Admins can only see/modify their own tenant's data
- System-level resources appear as read-only
- No cross-tenant access is possible

---

## Table of Contents

1. [Dashboard](#1-dashboard)
2. [User Management](#2-user-management)
3. [Team Settings](#3-team-settings)
4. [Cartridge Manager](#4-cartridge-manager)
5. [Report Writer](#5-report-writer)
6. [Usage & Billing](#6-usage--billing)
7. [AI Configuration](#7-ai-configuration)
8. [LIVS-M Policy](#8-livs-m-policy)
9. [Integrations](#9-integrations)
10. [Security Settings](#10-security-settings)
11. [Audit Log](#11-audit-log)
12. [API Reference](#12-api-reference)
13. [Implementation Files](#13-implementation-files)

---

## 1. Dashboard (v1.0.0)

**Location**: Tenant Admin → Dashboard

The dashboard provides an at-a-glance view of tenant health and usage.

### 1.1 Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Dashboard                          Your organization overview   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │Active Users│  │Conversations│  │API Requests│  │Credits Used││
│  │     42     │  │    1,234   │  │   45.2K    │  │   $1,234   ││
│  │  +5.2%     │  │   +12.3%   │  │   +8.1%    │  │   +15.0%   ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐│
│  │ Credits Usage  │  │   MLS Usage    │  │    Cartridges      ││
│  │ ████████░░ 78% │  │ ████░░░░ $45   │  │  3 active of 5     ││
│  │ 780/1000 used  │  │ limit: $100    │  │  [Manage →]        ││
│  └────────────────┘  └────────────────┘  └────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────┐  ┌────────────────┐│
│  │         Usage Trends (7 days)           │  │Recent Activity ││
│  │    ▄▄▄▄▄                                │  │ • User joined  ││
│  │  ▄▄█████▄▄    Requests                  │  │ • Report ran   ││
│  │▄▄█████████▄▄  Tokens                    │  │ • Settings     ││
│  │M  T  W  T  F  S  S                      │  │   updated      ││
│  └─────────────────────────────────────────┘  └────────────────┘│
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐│
│  │Manage Users │  │Create Report│  │Team Settings│  │ Security ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Dashboard Widgets

| Widget | Description | Data Source |
|--------|-------------|-------------|
| **Metric Cards** | Active users, conversations, requests, credits | `/api/v1/tenant/dashboard/stats` |
| **Credits Usage** | Progress bar showing credit consumption | `/api/v1/tenant/dashboard/stats` |
| **MLS Usage** | Mid-Level Services spend vs limit | `/api/v1/tenant/dashboard/stats` |
| **Cartridges** | Active/total cartridge count | `/api/v1/tenant/cartridges/stack` |
| **Usage Trends** | 7-day request/token area chart | `/api/v1/tenant/dashboard/usage-trends` |
| **Activity Feed** | Recent tenant events | `/api/v1/tenant/dashboard/activity` |
| **Alerts** | Budget warnings, security notices | `/api/v1/tenant/dashboard/alerts` |
| **Quick Actions** | Links to common admin tasks | Static |

### 1.3 Quick Actions

| Action | Description | Link |
|--------|-------------|------|
| **Manage Users** | Invite and manage team members | `/users` |
| **Create Report** | Generate usage or analytics reports | `/reports` |
| **Team Settings** | Configure organization preferences | `/settings` |
| **Security** | Manage MFA and access policies | `/security` |

### 1.4 Alert Types

| Type | Color | Example |
|------|-------|---------|
| **Warning** | Amber | "You've used 80% of your credits" |
| **Info** | Blue | "New features available" |
| **Error** | Red | "Payment method expired" |

### 1.5 Implementation

**File**: `apps/thinktank-tenant-admin/app/(dashboard)/page.tsx`

**Status**: ✅ Implemented

---

## 2. User Management (v1.1.0)

**Location**: Tenant Admin → Users

Manage users within your organization. All user provisioning is **invitation-only** — there is no self-registration. Each user belongs to exactly ONE tenant.

> **Licensing**: User invitations are subject to per-app seat licensing. If your tenant has no available seats for an app, the invite will be blocked for that app. See [Section 2A: Licensing & Seats](#2a-licensing--seats) for details.

### 2.1 User List

| Column | Description |
|--------|-------------|
| **Name** | User display name |
| **Email** | Login email |
| **Role** | tenant_owner, tenant_admin, standard_user, viewer |
| **Status** | active, invited, deactivated |
| **Apps** | Which apps the user has access to (Think Tank, Curator, etc.) |
| **Last Active** | Last login timestamp |
| **MFA** | MFA enrollment status |

### 2.2 User Roles

| Role | Permissions |
|------|-------------|
| **tenant_owner** | Full tenant control — billing, user management, delete tenant, all permissions |
| **tenant_admin** | Invite/manage users, configure settings, manage roles |
| **standard_user** | Use licensed apps, own data only |
| **viewer** | View-only access to dashboards, no create/edit |

Roles are **soft permissions** — admin-configurable with a UI for toggling individual permissions on/off. The role provides defaults, but admins can customize per-user.

### 2.3 User Actions

- **Invite User**: Send email invitation (requires seat availability for selected apps)
- **Edit Role**: Change user role and permissions
- **Toggle App Access**: Enable/disable access to specific apps (subject to seat licensing)
- **Deactivate**: Disable access, **free up the seat license** (data retained for regulatory compliance)
- **Reactivate**: Restore access (consumes a seat again)
- **Delete**: Schedule data deletion (subject to retention requirements)
- **Reset MFA**: Clear MFA for re-enrollment

### 2.4 Invitation Flow

```
1. Admin clicks "Invite User"
2. Enter email address
3. Select role: tenant_admin, standard_user, or viewer
4. Select app access (checkboxes — disabled if no seats available):
   [✓] Think Tank (42/50 seats)
   [✓] Curator (15/25 seats)
   [✗] Dojo — 0 seats available
       "No Dojo seats available. Buy more seats or deactivate a user."
   [✗] Genesis — Not licensed
       "Genesis requires a license. Contact support@thinktank.app"
5. System checks permissions and seat availability
6. Invitation sent (expires in 7 days, or tenant-configured)
```

**Think Tank access is granted by default.** Other apps must be explicitly selected (subject to licensing).

### 2.5 Deactivation vs Deletion

| Action | Seat Impact | Data Impact | When To Use |
|--------|-------------|-------------|-------------|
| **Deactivate** | Seat FREED | Data retained | Employee leaves, temporary suspension |
| **Delete** | Seat FREED | Data retained per retention license, then purged | GDPR erasure, permanent removal |

**Important**: If your tenant has a regulatory retention license (e.g., HIPAA 7-year retention), user data CANNOT be deleted until the retention period expires. The system will show the earliest deletion date.

### 2.6 Bulk Actions

- Import users from CSV (subject to seat availability)
- Export user list
- Bulk role assignment
- Bulk app access toggle

### 2.7 Same Email in Multiple Tenants

A person can have accounts in multiple organizations (e.g., john@gmail.com in Acme Corp AND Contoso). These are **completely separate user records**. When they log in, they select which organization to enter. Users have **zero visibility** into other tenants.

---

## 2A. Licensing & Seats (v1.0.0)

**Location**: Tenant Admin → Licenses

> **Full Reference**: [Think Tank Licensing Model](./THINKTANK-LICENSING-MODEL.md)

### 2A.1 License Dashboard

View all licenses, usage, and availability for your tenant:

- **App Seats**: How many seats are used/available per app (Think Tank, Curator, Dojo, etc.)
- **Storage**: Storage quota usage
- **Retention**: Data retention period
- **Compliance**: Which regulatory features are active

### 2A.2 Seat Licensing

Each app has its own seat count. Seats are consumed when a user is active with that app's access enabled.

| State | Seat Status |
|-------|-------------|
| **Active user with app access** | Seat consumed |
| **Invited user** | Seat reserved |
| **Deactivated user** | Seat freed |
| **User without app access** | No seat consumed |

### 2A.3 Purchasing Additional Seats

If you need more seats or licenses:
- Click **"+ Buy Seats"** next to the app
- Or contact Think Tank support at **support@thinktank.app**
- Additional seats are billed per-seat per-month on your existing billing method

### 2A.4 Compliance Licenses

Regulatory features (HIPAA, GDPR, SOC 2, etc.) are optional licensed features. If your tenant does not have the license, the feature is disabled with a message:

```
⚠ This feature requires a [HIPAA/GDPR/SOC2] compliance license.
  Contact Think Tank support at support@thinktank.app to add this to your plan.
```

Contact **support@thinktank.app** to add compliance licenses.

### 2A.5 Tier Defaults

Your subscription tier includes a base allocation of seats and features. See [Think Tank Licensing Model § Section 4](./THINKTANK-LICENSING-MODEL.md#4-tier-defaults) for the full tier breakdown.

---

## 3. Team Settings

**Location**: Tenant Admin → Settings

Organization-wide configuration.

### 3.1 General Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Organization Name** | Display name | From signup |
| **Timezone** | Default timezone for reports | UTC |
| **Language** | Default UI language | en |
| **Logo** | Custom logo for white-label | None |

### 3.2 AI Behavior Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Default Model** | Preferred AI model | Claude 3.5 Sonnet |
| **Response Tone** | professional/casual/technical | professional |
| **Safety Level** | Content filtering strictness | balanced |
| **Context Window** | Max context per conversation | 100K |

### 3.3 Feature Toggles

| Feature | Description | Default |
|---------|-------------|---------|
| **Enable Collaboration** | Real-time collaboration features | true |
| **Enable Time Machine** | Conversation forking/history | true |
| **Enable Artifacts** | Code/document generation | true |
| **Enable MLS** | Mid-Level Services access | tier-dependent |
| **Enable Reports** | Report generation | true |

---

## 4. Cartridge Manager

**Location**: Tenant Admin → Cartridges

Manage AI cartridges for your organization. **Already implemented** in `apps/thinktank-tenant-admin/app/(dashboard)/cartridges/page.tsx`.

### 4.1 Capabilities

| Action | Description |
|--------|-------------|
| **View System Cartridges** | See platform-wide cartridges (read-only) |
| **Create Tenant Cartridge** | Create organization-specific cartridge |
| **Activate/Deactivate** | Toggle cartridge usage |
| **Archive** | Soft-delete cartridge |
| **View Stack** | See cartridge priority order |

### 4.2 Cartridge Stack

```
System Cartridges (inherited, read-only)
    ↓
Tenant Cartridges (your organization)
    ↓
User Cartridges (per-user preferences)
```

Tenant admins can manage the middle layer.

### 4.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tenant/cartridges` | List tenant cartridges |
| GET | `/api/v1/tenant/cartridges/stack` | Get cartridge stack |
| POST | `/api/v1/tenant/cartridges` | Create cartridge |
| POST | `/api/v1/tenant/cartridges/:id/activate` | Activate |
| POST | `/api/v1/tenant/cartridges/:id/deactivate` | Deactivate |
| DELETE | `/api/v1/tenant/cartridges/:id` | Archive |

---

## 5. Report Writer

**Location**: Tenant Admin → Reports

Create, schedule, and manage reports scoped to your tenant.

### 5.1 Report Types

| Type | Description | Scope |
|------|-------------|-------|
| **Usage Report** | API calls, tokens, costs | Tenant |
| **User Activity** | User engagement metrics | Tenant |
| **Conversation Analytics** | Topic distribution, sentiment | Tenant |
| **Compliance Report** | Audit trail summary | Tenant |
| **Custom Report** | Build your own with filters | Tenant |

### 5.2 Report Builder

The report builder allows tenant admins to create custom reports:

1. **Select Data Source**: Usage, conversations, users, audit
2. **Apply Filters**: Date range, users, domains
3. **Choose Metrics**: Select which fields to include
4. **Configure Visualization**: Table, chart, summary
5. **Set Schedule**: One-time, daily, weekly, monthly

### 5.3 Report Scheduling

| Setting | Options |
|---------|---------|
| **Frequency** | one-time, daily, weekly, monthly |
| **Delivery** | Dashboard, email, S3 |
| **Format** | PDF, Excel, CSV, JSON |
| **Recipients** | Tenant admins, specific users |

### 5.4 Policy Enforcement - Allowed Actions

The Report Writer enforces strict tenant isolation. Tenant admins **CAN**:

| Action | Description | Enforcement |
|--------|-------------|-------------|
| ✅ View tenant users | See users in their organization | RLS: `tenant_id = current_tenant` |
| ✅ View tenant conversations | See all conversations within tenant | RLS: `tenant_id = current_tenant` |
| ✅ View tenant usage | API calls, tokens, costs for tenant | RLS: `tenant_id = current_tenant` |
| ✅ View tenant audit log | Audit events within tenant | RLS: `tenant_id = current_tenant` |
| ✅ Create reports | Reports scoped to tenant data only | Service layer validation |
| ✅ Schedule reports | Automated report delivery | Recipients must be tenant members |
| ✅ Export tenant data | CSV/PDF/Excel of tenant data | Data filtered by tenant |
| ✅ Set alerts | Budget/usage alerts for tenant | Tenant-scoped notifications |
| ✅ View MLS usage | Mid-Level Services consumption | RLS: `tenant_id = current_tenant` |

### 5.5 Policy Enforcement - Forbidden Actions

The following actions are **BLOCKED** at the service layer:

| Action | Reason | Enforcement |
|--------|--------|-------------|
| ❌ View other tenants' data | Tenant isolation | RLS + service layer rejection |
| ❌ Access platform metrics | Platform admin only | Role check: requires `radiant_admin` |
| ❌ View system audit logs | Platform admin only | Role check: requires `radiant_admin` |
| ❌ Export raw database | Security risk | Endpoint does not exist |
| ❌ Access Lambda logs | Infrastructure admin only | AWS IAM denial |
| ❌ View model costs (platform) | Confidential pricing | Role check: requires `radiant_admin` |
| ❌ Cross-tenant comparisons | Competitive data | Query validation blocks `tenant_id != current` |
| ❌ Send reports to non-members | Data exfiltration | Recipient validation |
| ❌ Access PII without consent | GDPR/HIPAA compliance | Consent flags checked |
| ❌ Modify system cartridges | Platform admin only | Scope check: `scope != 'system'` |
| ❌ View provider API keys | Security | Never exposed to tenant layer |

### 5.6 Enforcement Mechanisms

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUEST: Generate Report                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. AUTHENTICATION                                                │
│    - JWT validation                                              │
│    - Extract tenant_id from token                                │
│    - Verify user has tenant_admin role                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. SERVICE LAYER VALIDATION                                      │
│    - Validate report type is allowed for tenant tier            │
│    - Validate date range is within retention period             │
│    - Validate recipients are tenant members                     │
│    - Validate data sources are tenant-accessible                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. ROW-LEVEL SECURITY (PostgreSQL)                               │
│    - SET app.current_tenant_id = '<tenant_id>'                  │
│    - All queries automatically filtered                         │
│    - Cannot bypass via SQL injection                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. QUERY VALIDATION                                              │
│    - Block queries with tenant_id conditions                    │
│    - Block UNION/JOIN to non-tenant tables                      │
│    - Block aggregate functions across tenants                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. OUTPUT SANITIZATION                                           │
│    - Remove internal IDs from exports                           │
│    - Mask PII if not authorized                                 │
│    - Add audit watermark to exports                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ✅ Report Generated (Tenant-Scoped)
```

### 5.7 Error Responses

When policy violations are attempted:

| Violation | HTTP Code | Error Message |
|-----------|-----------|---------------|
| Cross-tenant access | 403 | "Access denied: resource belongs to another organization" |
| Platform-only metric | 403 | "Access denied: platform metrics require elevated privileges" |
| Invalid recipient | 400 | "Recipient must be a member of your organization" |
| Tier restriction | 403 | "Report type not available for your subscription tier" |
| Retention exceeded | 400 | "Requested date range exceeds your data retention period" |
| PII without consent | 403 | "User has not consented to PII export" |

### 5.8 Audit Trail

All report actions are logged:

```typescript
interface ReportAuditEntry {
  timestamp: Date;
  tenantId: string;
  actorId: string;           // Who ran the report
  action: 'create' | 'run' | 'download' | 'schedule' | 'delete';
  reportId: string;
  reportType: string;
  dataSourcesAccessed: string[];
  rowsReturned: number;
  exportFormat?: string;
  recipientCount?: number;
  ipAddress: string;
  userAgent: string;
}
```

### 5.9 Report Templates

Pre-built templates for common reports:
- Monthly Usage Summary
- Weekly User Activity
- Quarterly Compliance Audit
- Cost Breakdown by User
- Top Topics This Month

### 5.10 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tenant/reports` | List reports |
| GET | `/api/v1/tenant/reports/:id` | Get report details |
| POST | `/api/v1/tenant/reports` | Create report |
| PUT | `/api/v1/tenant/reports/:id` | Update report |
| DELETE | `/api/v1/tenant/reports/:id` | Delete report |
| POST | `/api/v1/tenant/reports/:id/run` | Execute report |
| GET | `/api/v1/tenant/reports/:id/download` | Download results |
| POST | `/api/v1/tenant/reports/:id/schedule` | Set schedule |

---

## 6. Usage & Billing

**Location**: Tenant Admin → Billing

View usage and manage billing for your tenant.

### 6.1 Usage Dashboard

| Metric | Description |
|--------|-------------|
| **API Calls** | Total requests this period |
| **Tokens Used** | Input + output tokens |
| **Credits Remaining** | Prepaid credit balance |
| **Cost Estimate** | Projected bill |
| **MLS Usage** | Mid-Level Services breakdown |

### 6.2 Usage Breakdown

- By user
- By model
- By day/week/month
- By feature (chat, reports, MLS)

### 6.3 Alerts & Limits

| Setting | Description |
|---------|-------------|
| **Budget Alert** | Notify at % of budget |
| **User Limit** | Max API calls per user |
| **Monthly Cap** | Hard stop at amount |

### 6.4 Invoice History

View and download past invoices.

---

## 7. AI Configuration

**Location**: Tenant Admin → AI Settings

Configure AI behavior for your organization.

### 7.1 Model Preferences

| Setting | Description |
|---------|-------------|
| **Allowed Models** | Which models users can access |
| **Default Model** | Model used by default |
| **Fallback Model** | Backup when default unavailable |

### 7.2 Prompt Templates

Create organization-wide prompt templates:
- System prompts for specific use cases
- Pre-approved prompt patterns
- Domain-specific instructions

### 7.3 Domain Configuration

| Setting | Description |
|---------|-------------|
| **Primary Domains** | Your organization's focus areas |
| **Blocked Domains** | Topics to restrict |
| **Custom Taxonomy** | Organization-specific categories |

### 7.4 MLS Configuration

Mid-Level Services settings (if tier allows):

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable MLS** | Master toggle | true |
| **Auto-Warm** | Warm models on first request | true |
| **Cost Alerts** | Notify on MLS spend | true |
| **Alert Threshold** | Monthly threshold | $100 |

---

## 8. LIVS-M Policy (v7.9.0)

**Location**: Tenant Admin → LIVS-M Policy

Configure the AI governance "Defcon" level for your organization. LIVS-M (LLM Interrogation & Verification System - Modular) provides policy-driven forensic verification of AI outputs.

### 8.1 Overview

LIVS-M 2.0 allows tenant admins to configure how strictly the platform verifies AI-generated content before it's delivered to users.

```
┌─────────────────────────────────────────────────────────────────┐
│  LIVS-M Policy Settings                    v2.0.0 [UPDATE]     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┬─────────────┬─────────────┐                    │
│  │ Modes       │ Settings    │ Updates  •  │  ← Tab navigation  │
│  └─────────────┴─────────────┴─────────────┘                    │
│                                                                  │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│  │  Brainstorming   │ │    Standard      │ │   Strict Audit   │ │
│  │  ⚡ Creative     │ │  ⚖️ Default      │ │  🛡️ Secure       │ │
│  │                  │ │  [Selected]      │ │                  │ │
│  │  "Yes, and..."   │ │ "Trust but       │ │ "Zero Trust"     │ │
│  │                  │ │  Verify"         │ │                  │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│                                                                  │
│  Current Mode: Standard                                          │
│  • Sycophancy Detection: ON                                     │
│  • Stub Rejection: ON                                           │
│  • Chaos Injection: OFF                                         │
│  • Max Consensus Velocity: 2                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Policy Modes

| Mode | Alias | Description | Best For |
|------|-------|-------------|----------|
| **Brainstorming** | RAPID_PROTO | Accepts partial code, stubs, rough ideas. Focuses on speed and creativity. | Hackathons, MVP planning, early drafting |
| **Standard** | ENGINEERING | Code must run. Stubs rejected if breaking functionality. Tests encouraged. | Daily development, sprint work |
| **Strict Audit** | STRICT_AUDIT | No stubs. No mock data. Mandatory tests. Sycophancy triggers Devil's Advocate. | Production releases, medical/legal, security |

### 8.3 Configuration Options

| Setting | Description | Default |
|---------|-------------|----------|
| **Sycophancy Detection** | Detect when agents agree too quickly without critical analysis | ON |
| **Stub Rejection** | Reject outputs containing TODO, placeholder, or incomplete code | ON |
| **Chaos Injection** | Inject Devil's Advocate agent when sycophancy detected | OFF |
| **Max Consensus Velocity** | Maximum agreement rate before triggering verification | 2 |

### 8.4 Version Management (v7.9.0+)

Tenant admins can check for LIVS-M policy registry updates and upgrade:

| Feature | Description |
|---------|-------------|
| **Version Badge** | Shows current version (e.g., v2.0.0) |
| **Update Indicator** | Animated badge when new version available |
| **Changelog** | List of improvements in new version |
| **Breaking Changes Alert** | Warning if update has breaking changes |
| **Migration Notice** | Notification if database migration required |
| **One-Click Upgrade** | Button to upgrade to latest version |

### 8.5 What LIVS-M Catches

| Issue | Description | Action |
|-------|-------------|--------|
| **Code Stubs** | `// TODO`, `throw new Error('not implemented')`, empty functions | Rejected with retry prompt |
| **Mock Data** | Hardcoded return values, fake data | Rejected in Standard/Strict modes |
| **Sycophancy** | AI agreeing without verification | Triggers Devil's Advocate |
| **Incomplete Tests** | Missing test coverage | Warning in Standard, rejected in Strict |

### 8.6 Tenant-Level Overrides

Tenant admins can override the platform default for their organization:

- **Inherit Platform Default**: Use whatever the platform admin sets
- **Force Brainstorming**: Always use creative mode
- **Force Standard**: Always use balanced verification
- **Force Strict**: Always use maximum verification

### 8.7 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tenant/livs-policy` | Get current policy settings |
| PUT | `/api/v1/tenant/livs-policy` | Update policy settings |
| GET | `/api/v1/tenant/livs-policy/version` | Check for updates |
| POST | `/api/v1/tenant/livs-policy/upgrade` | Upgrade to latest version |

### 8.8 Implementation

**Files**:
- UI: `apps/admin-dashboard/app/thinktank-admin/simulator/page.tsx` (LIVS-M Policy view)
- Types: `packages/shared/src/types/livs.types.ts`
- Service: `packages/infrastructure/lambda/shared/services/livs/livs-version.service.ts`

**Status**: ✅ Implemented

---

## 9. Integrations

**Location**: Tenant Admin → Integrations

Connect Think Tank to your organization's tools.

### 9.1 Available Integrations

| Integration | Type | Description |
|-------------|------|-------------|
| **SSO/SAML** | Authentication | Single sign-on |
| **Slack** | Notification | Activity alerts |
| **Microsoft Teams** | Notification | Activity alerts |
| **Webhook** | Custom | HTTP callbacks |
| **API Keys** | Programmatic | Service integration |

### 9.2 API Key Management

Tenant admins can create API keys for programmatic access:

| Setting | Description |
|---------|-------------|
| **Name** | Descriptive name |
| **Scopes** | read, write, admin |
| **Expiry** | Auto-expiration date |
| **IP Whitelist** | Allowed IP addresses |

---

## 10. Security Settings

**Location**: Tenant Admin → Security

Configure security policies for your organization.

### 10.1 Authentication

| Setting | Description | Default |
|---------|-------------|---------|
| **Require MFA** | Force MFA for all users | false |
| **Session Timeout** | Auto-logout duration | 24h |
| **Password Policy** | Complexity requirements | standard |

### 10.2 Data Retention

| Setting | Description | Default |
|---------|-------------|---------|
| **Conversation Retention** | How long to keep chats | 90 days |
| **Audit Log Retention** | How long to keep audit | 1 year |
| **Export Retention** | How long to keep exports | 30 days |

### 10.3 Compliance Settings

| Setting | Description |
|---------|-------------|
| **HIPAA Mode** | Enable HIPAA safeguards |
| **Data Residency** | Require specific region |
| **Encryption** | Additional encryption options |

---

## 11. Audit Log

**Location**: Tenant Admin → Audit

View all administrative actions within your tenant.

### 11.1 Audited Events

| Event | Description |
|-------|-------------|
| **user.invited** | New user invitation sent |
| **user.role_changed** | User role modified |
| **user.suspended** | User suspended |
| **cartridge.created** | New cartridge created |
| **cartridge.activated** | Cartridge enabled |
| **report.created** | New report created |
| **settings.changed** | Tenant settings modified |
| **integration.added** | New integration configured |

### 11.2 Audit Log Fields

| Field | Description |
|-------|-------------|
| **Timestamp** | When the event occurred |
| **Actor** | Who performed the action |
| **Action** | What was done |
| **Target** | What was affected |
| **Details** | Additional context |
| **IP Address** | Source IP |

### 11.3 Export

Export audit logs for compliance:
- Date range filter
- Event type filter
- CSV or JSON format

---

## 12. API Reference

### Base URL

```
/api/v1/tenant
```

All endpoints automatically scope to the authenticated user's tenant.

### Authentication

Use Bearer token from Think Tank session or API key with `tenant:admin` scope.

### Endpoints Summary

| Resource | Endpoints |
|----------|-----------|
| **Dashboard** | `GET /dashboard` |
| **Users** | `GET/POST/PUT/DELETE /users` |
| **Settings** | `GET/PUT /settings` |
| **Cartridges** | `GET/POST/PUT/DELETE /cartridges` |
| **Reports** | `GET/POST/PUT/DELETE /reports` |
| **Billing** | `GET /billing`, `GET /usage` |
| **AI Config** | `GET/PUT /ai-config` |
| **Integrations** | `GET/POST/DELETE /integrations` |
| **Security** | `GET/PUT /security` |
| **Audit** | `GET /audit`, `GET /audit/export` |

---

## 13. Implementation Files

### Current Implementation

| Component | Path | Status |
|-----------|------|--------|
| **App Directory** | `apps/thinktank-tenant-admin/` | ✅ Created |
| **Cartridge Manager** | `app/(dashboard)/cartridges/page.tsx` | ✅ Implemented |
| **Dashboard** | `app/(dashboard)/page.tsx` | ✅ Implemented |
| **LIVS-M Policy** | `apps/admin-dashboard/app/thinktank-admin/simulator/page.tsx` | ✅ Implemented |
| **Users** | `app/(dashboard)/users/page.tsx` | 🔲 Pending |
| **Settings** | `app/(dashboard)/settings/page.tsx` | 🔲 Pending |
| **Reports** | `app/(dashboard)/reports/page.tsx` | 🔲 Pending |
| **Billing** | `app/(dashboard)/billing/page.tsx` | 🔲 Pending |
| **AI Config** | `app/(dashboard)/ai-config/page.tsx` | 🔲 Pending |
| **Integrations** | `app/(dashboard)/integrations/page.tsx` | 🔲 Pending |
| **Security** | `app/(dashboard)/security/page.tsx` | 🔲 Pending |
| **Audit** | `app/(dashboard)/audit/page.tsx` | 🔲 Pending |

### API Handler

| Component | Path | Status |
|-----------|------|--------|
| **Tenant API** | `lambda/tenant/handler.ts` | 🔲 Pending |
| **Tenant Service** | `lambda/shared/services/tenant-admin.service.ts` | 🔲 Pending |

### Database Tables

| Table | Purpose | Status |
|-------|---------|--------|
| `tenant_settings` | Tenant-level settings | ✅ Exists |
| `tenant_users` | User-tenant mapping | ✅ Exists |
| `tenant_reports` | Saved reports | 🔲 Pending |
| `tenant_report_schedules` | Report scheduling | 🔲 Pending |
| `tenant_integrations` | Integration configs | 🔲 Pending |
| `tenant_api_keys` | Tenant-scoped API keys | ✅ Exists |
| `tenant_audit_log` | Tenant audit events | ✅ Exists |

---

## Memory Retention Settings (v7.13.0)

### Overview

Tenant Admins can customize memory retention for their organization within the bounds set by the Think Tank administrator. This controls session-to-session memory, storage limits, and which memory features are available to your users.

**Dashboard Location**: Tenant Admin → Memory Retention (`/thinktank-tenant-admin/memory-retention`)

### What You Can Control

| Setting | Type | Description |
|---------|------|-------------|
| **Session-to-Session Memory** | Toggle | Enable/disable persistent memory for your users |
| **Conversation History** | Toggle | Store full conversation transcripts |
| **Auto-Extract Facts** | Toggle | Automatically extract facts from conversations |
| **User Can Delete Own Memory** | Toggle | Allow users to manage their own memory |
| **Uploaded Documents in Memory** | Toggle | Include uploaded documents (PDFs, images, code) in user memory across all chats |
| **Downloaded Files in Memory** | Toggle | Include AI-generated/retrieved files in user memory across all chats |
| **Retention Days** | Number | How many days to retain memories (0 = unlimited) |
| **Max Storage Per User** | Number (MB) | Maximum storage per user |
| **Hot Tier Days** | Number | Days in fast-access storage |
| **Warm Tier Days** | Number | Days in warm storage |

### Constraints

Your overrides **CANNOT exceed** limits set by the Think Tank Admin:
- If the Think Tank Admin sets retention to 90 days, you cannot set it to 180
- If the Think Tank Admin disables session memory, you cannot re-enable it
- If the Think Tank Admin sets max storage to 500MB, you cannot set it to 1000MB
- If the Think Tank Admin disables uploaded documents or downloaded files, you cannot re-enable them

The dashboard will display tenant-level constraints when they exist, and the API will reject requests that exceed them.

### Admin API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/memory-retention/tenant-admin/override` | Get current override |
| PUT | `/api/admin/memory-retention/tenant-admin/override` | Set/update override |
| DELETE | `/api/admin/memory-retention/tenant-admin/override` | Remove (restore tenant defaults) |
| GET | `/api/admin/memory-retention/effective` | Get resolved effective policy |
| GET | `/api/admin/memory-retention/dashboard` | Usage dashboard |

---

## Related Documentation

- [RADIANT Admin Guide](./RADIANT-ADMIN-GUIDE.md) - Platform administration
- [Think Tank Admin Guide](./THINKTANK-ADMIN-GUIDE.md) - Think Tank platform config
- [Think Tank User Guide](./THINKTANK-USER-GUIDE.md) - End user guide
- [Cartridge System](./RADIANT-ADMIN-GUIDE.md#section-89-cartridge-pki--federation) - Cartridge PKI

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.2.0 | 2026-02-06 | Added Memory Retention Settings section (v7.13.0) — configurable retention with constraint enforcement |
| 1.1.0 | 2026-02-05 | Added LIVS-M Policy section (v7.9.0) with policy modes, settings, and version management |
| 1.0.0 | 2026-02-03 | Initial documentation |


---

## Part IV: Mac Platform

> **Classification**: RADIANT INTERNAL // ENGINEERING  
> **Version**: 3.0.0 | **Date**: February 8, 2026  
> **Status**: BUILT — v7.45.0 — Full feature parity with web app (minus Polymorphic Interface)  
> **App Location**: `apps/thinktank-mac/`  
> **Mirrors**: Think Tank Web (`apps/thinktank/`)  
> **Requires**: macOS 14.0+ (Sonoma), Swift 5.9+, Xcode 15+
>
> **Detailed Documentation**:
> - **User Guide**: `docs/THINKTANK-MAC-GUIDE.md` (20 sections)
> - **Portability Manifest**: `docs/THINKTANK-MAC-PORTABILITY-MANIFEST.md` (33 features, technology map, gap tracking)
> - **Sync Policy**: `/.windsurf/workflows/thinktank-dual-platform.md` (v2.0 — bidirectional, blocking gate)
>
> **v7.45.0 Gap Closure** (February 8, 2026):
> - CoreTypes.swift: 1,406 lines (80+ new types: Governor, Derivation, FlashFacts, Grimoire, Ideas, Cartridges, Mood, AXIOM, Collaboration, i18n)
> - PlatformServices.swift: 860 lines (7 new services, GovernorService expanded from 2 to 14 endpoints)
> - 3 standalone services: AxiomSessionService (SSE + feedback + caching), AuthService (Keychain), LocalizationService (5 languages)
> - 8 feature views: FlashFacts, Grimoire, Ideas, Derivation, Governor, Cartridge, CatoMood, Login
> - 8 AXIOM sub-views: Workflow, Confidence, Domain, ModelScores, Clarification, CompiledPrompt, Feedback, Preferences
> - Navigation: 10 sections (was 6), Settings: 8 tabs (was 5), Auth gate, i18n environment

---

## 1. What is Think Tank (Mac)?

Think Tank (Mac) is a **native macOS SwiftUI application** that mirrors the Think Tank web app's user-facing chat experience. It connects to the **exact same RADIANT backend APIs** — no new services, no new Lambdas, no new infrastructure. It is a frontend-only native client.

### What It IS

- A native macOS chat client for the Think Tank AI platform
- A SwiftUI app using NavigationSplitView, Sidebar, and Inspector patterns
- A consumer of existing RADIANT APIs (`/api/v2/thinktank/*`, `/api/v2/domain-taxonomy/*`)
- Feature-mirrored with the web app (same capabilities, native UI)

### What It IS NOT

- Not a replacement for the web app (both coexist)
- Not a new backend or service (uses existing Lambdas)
- Not an admin dashboard (no platform admin, no tenant admin)
- Not a Curator, Dojo, or Genesis client (those are separate products)

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│              Think Tank (Mac) — SwiftUI               │
│                                                       │
│  ┌─────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Sidebar  │  │  Chat View   │  │   Inspector    │  │
│  │          │  │              │  │                │  │
│  │ Convos   │  │  Messages    │  │  Brain Plan    │  │
│  │ Search   │  │  Streaming   │  │  Domain Info   │  │
│  │ Folders  │  │  Artifacts   │  │  Model Info    │  │
│  │ Settings │  │  Input Bar   │  │  Ego State     │  │
│  └─────────┘  └──────────────┘  └────────────────┘  │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │              API Client Layer (Swift)            │  │
│  │  URLSession + async/await + Combine              │  │
│  │  SSE streaming for chat responses                │  │
│  │  Cognito auth via AWS Amplify for Swift          │  │
│  └──────────────────────┬──────────────────────────┘  │
└─────────────────────────┼────────────────────────────┘
                          │ HTTPS
                          ▼
┌──────────────────────────────────────────────────────┐
│           RADIANT Backend (Existing, Shared)          │
│                                                       │
│  API Gateway → Lambda Handlers → Aurora PostgreSQL    │
│  /api/v2/thinktank/* (42 route handlers)              │
│  /api/v2/domain-taxonomy/*                            │
│  Cognito User Pool (shared auth)                      │
└──────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|------------|
| **UI Framework** | SwiftUI (macOS 13.0+) |
| **Navigation** | NavigationSplitView (3-column) |
| **Networking** | URLSession async/await |
| **Streaming** | URLSession bytes (SSE parsing) |
| **Authentication** | AWS Amplify for Swift / Cognito |
| **State Management** | @Observable (Swift 5.9 Observation) |
| **Local Storage** | SwiftData or SQLCipher (matching Swift Deployer) |
| **Design System** | Follows Swift Deployer design tokens (RadiantSpacing, RadiantRadius) |

---

## 3. Feature Parity Matrix

The following table maps every Think Tank web feature to its Mac counterpart. This is the **canonical sync reference** — update it whenever either platform changes.

### Tier 1: Core Features (Must Have — Build First)

| # | Web Feature | Web Location | Mac Equivalent | Swift Pattern | Status |
|---|-------------|-------------|----------------|---------------|--------|
| 1 | **Conversations** | `conversations.ts` | `SidebarView.swift` + `ChatView.swift` | NavigationSplitView | ✅ Built |
| 2 | **Chat Streaming** | SSE via fetch | `APIClient.swift` SSE stream | URLSession.bytes + AsyncThrowingStream | ✅ Built |
| 3 | **Brain Plan Viewer** | `brain-plan.ts` + component | `BrainPlanViewer.swift` | Sheet with step progress | ✅ Built |
| 4 | **Domain Detection** | `domain-modes.ts` | `DomainSelectorView.swift` | Menu picker in header | ✅ Built |
| 5 | **Model Selection** | `models.ts`, `model-categories.ts` | `ModelSelectorView.swift` | Menu/Picker with category grouping | ✅ Built |
| 6 | **My Rules** | `my-rules.ts` | `RulesView.swift` | Full CRUD + presets browser | ✅ Built |
| 7 | **User Context/Memory** | `user-context.ts` | `ProfileView.swift` | Analytics + achievements | ✅ Built |
| 8 | **Settings/Preferences** | `settings.ts`, `preferences.ts` | `SettingsView.swift` | Settings scene (5 tabs) | ✅ Built |
| 9 | **Authentication** | Cognito web | `APIClient.swift` token management | URLSession + Keychain | ✅ Built |

### Tier 2: Advanced Features (Build Second)

| # | Web Feature | Web Location | Mac Equivalent | Swift Pattern | Status |
|---|-------------|-------------|----------------|---------------|--------|
| 10 | **Delight System** | Admin config | `SettingsStore.swift` personality mode | Mode selector (partial — no toasts) | ⚠️ Partial |
| 11 | **Time Machine** | `time-travel.ts` | `TimeMachineView.swift` | Timeline + playback + branch/restore | ✅ Built |
| 12 | **Crucible Deliberation** | `CrucibleDeliberationPanel.tsx` | `CrucibleView.swift` | Event timeline with expandable Q&A | ✅ Built |
| 13 | **AXIOM Forge** | `AxiomForge.tsx` | `AxiomForgeView.swift` | 4-step workflow (Classify→Route) | ✅ Built |
| 14 | **Voice Input** | `voice-input.tsx` | `VoiceService.swift` + `VoiceInputView.swift` | AVAudioEngine + Whisper API | ✅ Built |
| 15 | **File Attachments** | `file-attachments.tsx` | `FileAttachmentsView.swift` | NSOpenPanel + onDrop | ✅ Built |
| 16 | **Economic Governor** | `economic-governor.ts` | `BrainPlanViewer.swift` governor card | Integrated in Brain Plan viewer | ✅ Built |
| 17 | **Artifact Engine** | `artifact-engine.ts` | `ArtifactsView.swift` | Split-view browser with detail pane | ✅ Built |
| 18 | **History** | History page | `HistoryView.swift` | Sort/search/filter conversation list | ✅ Built |
| 19 | **Ratings** | `MessageBubble.tsx` | `MessageBubbleView.swift` | Inline thumbs up/down + regenerate | ✅ Built |
| 20 | **File Conversion** | `file-conversion.ts` | `FileAttachmentsView.swift` | Drag-and-drop with type validation | ✅ Built |

### Tier 3: Specialized Features (Build Third)

| # | Web Feature | Web Location | Mac Equivalent | Swift Pattern | Status |
|---|-------------|-------------|----------------|---------------|--------|
| 21 | **Concurrent Execution** | `concurrent-execution.ts` | Parallel model queries | Task groups with progress | 🔲 Planned |
| 22 | **Structure from Chaos** | `structure-from-chaos.ts` | Auto-organize | Sheet with results | 🔲 Planned |
| 23 | **Enhanced Collaboration** | `enhanced-collaboration.ts` | `CollaborationService.swift` (API) | API only — no real-time UI yet | ⚠️ Partial |
| 24 | **Derivation History** | `derivation-history.ts` | Reasoning trace | Expandable tree | 🔲 Planned |
| 25 | **Decision Artifacts** | `decision-artifacts.ts` | Decision records | Table with detail | 🔲 Planned |
| 26 | **Living Parchment** | `living-parchment.ts` | Living documents | Rich text editor | 🔲 Planned |
| 27 | **Shadow Testing** | `shadow-testing.ts` | A/B model comparison | Side-by-side view | 🔲 Planned |
| 28 | **Security Signals** | `security-signals.ts` | Safety indicators | Status bar items | 🔲 Planned |
| 29 | **DIA** | `dia.ts` | Document intelligence | Quick Look preview | 🔲 Planned |
| 30 | **LIVS Workflow** | `livs-workflow.ts` | Quality control modes | Toolbar segment | 🔲 Planned |
| 31 | **Guest Restrictions** | `GuestRestrictionBanner.tsx` | `CollaborationService.swift` (API) | API only — no banner UI yet | ⚠️ Partial |
| 32 | **Policy Framework** | `policy-framework.ts` | Policy display | Inspector section | 🔲 Planned |
| 33 | **UEP Integration** | `uep-integration.ts` | User experience personalization | Automatic (API-driven) | 🔲 Planned |

### Web-Only Features (No Mac Equivalent Needed)

| Feature | Reason |
|---------|--------|
| **Liquid Interface** (`liquid-interface.ts`) | Web-specific CSS morphing; macOS uses native Liquid Glass |
| **Reality Engine** (`reality-engine.ts`) | Web 3D rendering; macOS uses SceneKit/RealityKit natively |
| **Magic Carpet Navigator** | Web-specific animated navigation; macOS uses NavigationSplitView |
| **Spatial Glass Card** | Web glassmorphism CSS; macOS uses `.regularMaterial` natively |
| **Polymorphic View Router** | React router pattern; SwiftUI uses NavigationStack natively |
| **App Factory** | Web-specific generated app renderer; not applicable to native |
| **UI Feedback Panel** | Web-specific feedback collection; macOS uses native feedback |
| **GDPR/Consent** | Uses web-specific cookie/consent UI; macOS uses system privacy |
| **Multipage Apps** | Web-specific multi-page app generation; not applicable |

---

## 4. API Endpoints Used

The Mac app calls these existing RADIANT APIs (no new endpoints needed):

### Core APIs (Tier 1)

```
POST   /api/v2/thinktank/conversations              — Create conversation
GET    /api/v2/thinktank/conversations               — List conversations
GET    /api/v2/thinktank/conversations/{id}          — Get conversation
DELETE /api/v2/thinktank/conversations/{id}          — Delete conversation
POST   /api/v2/thinktank/conversations/{id}/messages — Send message (SSE stream)
POST   /api/v2/thinktank/brain-plan/generate         — Generate brain plan
GET    /api/v2/thinktank/brain-plan/{planId}         — Get plan status
POST   /api/v2/thinktank/brain-plan/{planId}/execute — Execute plan
GET    /api/v2/thinktank/models                      — List available models
GET    /api/v2/thinktank/model-categories            — Get model categories
GET    /api/v2/thinktank/domain-modes                — Get domain modes
POST   /api/v2/domain-taxonomy/detect                — Detect domain from prompt
GET    /api/v2/thinktank/my-rules                    — Get user rules
POST   /api/v2/thinktank/my-rules                    — Create user rule
PUT    /api/v2/thinktank/my-rules/{id}               — Update user rule
DELETE /api/v2/thinktank/my-rules/{id}               — Delete user rule
GET    /api/v2/thinktank/user-context                — Get user memory profile
GET    /api/v2/thinktank/settings                    — Get user settings
PUT    /api/v2/thinktank/settings                    — Update user settings
GET    /api/v2/thinktank/preferences                 — Get user preferences
PUT    /api/v2/thinktank/preferences                 — Update preferences
```

### Advanced APIs (Tier 2-3)

```
GET    /api/v2/thinktank/grimoire                    — Get procedural memories
POST   /api/v2/thinktank/grimoire                    — Create grimoire entry
GET    /api/v2/thinktank/flash-facts                 — Get flash facts
POST   /api/v2/thinktank/flash-facts                 — Create flash fact
GET    /api/v2/thinktank/sentinel-agents             — Get agent status
GET    /api/v2/thinktank/economic-governor            — Get cost data
GET    /api/v2/thinktank/council-of-rivals           — Get deliberation
POST   /api/v2/thinktank/council-of-rivals           — Start deliberation
GET    /api/v2/thinktank/time-travel/{id}            — Get conversation branches
POST   /api/v2/thinktank/time-travel/{id}/fork       — Fork conversation
GET    /api/v2/thinktank/artifacts                   — Get artifacts
POST   /api/v2/thinktank/artifacts                   — Create artifact
GET    /api/v2/thinktank/ideas                       — Get ideas
POST   /api/v2/thinktank/ideas                       — Create idea
POST   /api/v2/thinktank/ratings                     — Rate response
POST   /api/v2/thinktank/file-conversion             — Convert file
GET    /api/v2/thinktank/derivation-history/{id}     — Get reasoning trace
GET    /api/v2/thinktank/analytics                   — Get usage analytics
```

---

## 5. Planned File Structure

```
apps/thinktank-mac/
├── Package.swift                    # SPM package definition
├── Sources/ThinkTankMac/
│   ├── ThinkTankApp.swift           # @main App entry point
│   ├── AppCommands.swift            # Menu bar commands + keyboard shortcuts
│   │
│   ├── Models/                      # Data models (mirrors @radiant/shared types)
│   │   ├── Conversation.swift       # Conversation, Message types
│   │   ├── BrainPlan.swift          # AGI plan steps, modes
│   │   ├── DomainTaxonomy.swift     # Field, Domain, Subspecialty
│   │   ├── AIModel.swift            # Model info, categories
│   │   ├── UserRule.swift           # My Rules types
│   │   ├── UserContext.swift        # Memory profile, preferences
│   │   ├── Artifact.swift           # Code/document artifacts
│   │   ├── Grimoire.swift           # Procedural memory entries
│   │   ├── FlashFact.swift          # Quick knowledge cards
│   │   ├── SentinelAgent.swift      # Background monitor types
│   │   └── EconomicGovernor.swift   # Cost/budget types
│   │
│   ├── Services/                    # API client + networking
│   │   ├── APIClient.swift          # Base HTTP client (URLSession async/await)
│   │   ├── AuthService.swift        # Cognito authentication
│   │   ├── SSEStreamParser.swift    # Server-Sent Events parser for chat streaming
│   │   ├── ConversationService.swift
│   │   ├── BrainPlanService.swift
│   │   ├── DomainService.swift
│   │   ├── ModelService.swift
│   │   ├── RulesService.swift
│   │   ├── SettingsService.swift
│   │   └── WebSocketService.swift   # For real-time collaboration
│   │
│   ├── ViewModels/                  # @Observable view models
│   │   ├── ConversationListViewModel.swift
│   │   ├── ChatViewModel.swift
│   │   ├── BrainPlanViewModel.swift
│   │   ├── RulesViewModel.swift
│   │   └── SettingsViewModel.swift
│   │
│   ├── Views/                       # SwiftUI views
│   │   ├── Sidebar/
│   │   │   ├── SidebarView.swift             # Conversation list
│   │   │   ├── ConversationRow.swift         # List row component
│   │   │   └── SearchField.swift             # Conversation search
│   │   │
│   │   ├── Chat/
│   │   │   ├── ChatView.swift                # Main chat area
│   │   │   ├── MessageBubble.swift           # Individual message
│   │   │   ├── StreamingIndicator.swift      # Typing/thinking animation
│   │   │   ├── MessageInputBar.swift         # Compose area + attachments
│   │   │   ├── ArtifactView.swift            # Code/document rendering
│   │   │   └── ResponseRating.swift          # Thumbs up/down
│   │   │
│   │   ├── Inspector/
│   │   │   ├── InspectorView.swift           # Right panel container
│   │   │   ├── BrainPlanPanel.swift          # AGI plan steps
│   │   │   ├── DomainPanel.swift             # Domain detection info
│   │   │   ├── ModelPanel.swift              # Selected model info
│   │   │   └── UserContextPanel.swift        # Memory/ego state
│   │   │
│   │   ├── Features/
│   │   │   ├── TimeMachineView.swift         # Conversation branching
│   │   │   ├── CouncilOfRivalsView.swift     # Multi-model deliberation
│   │   │   ├── GrimoireView.swift            # Procedural memory
│   │   │   ├── FlashFactsView.swift          # Quick knowledge
│   │   │   ├── SentinelView.swift            # Background agents
│   │   │   ├── EconomicGovernorView.swift    # Cost dashboard
│   │   │   └── IdeasView.swift               # Idea capture
│   │   │
│   │   └── Settings/
│   │       ├── SettingsView.swift            # macOS Settings scene
│   │       ├── GeneralSettings.swift
│   │       ├── AccountSettings.swift
│   │       └── ModelPreferences.swift
│   │
│   └── Components/                  # Reusable UI components
│       ├── MacOSComponents.swift    # Design tokens (shared with Swift Deployer)
│       ├── MarkdownRenderer.swift   # Render AI markdown responses
│       ├── SyntaxHighlighter.swift  # Code block highlighting
│       ├── LoadingStates.swift      # Shimmer, skeleton, typing indicators
│       └── Toolbar.swift            # Toolbar items (domain, model, cost)
│
└── Tests/ThinkTankMacTests/
    ├── APIClientTests.swift
    ├── SSEStreamParserTests.swift
    └── ViewModelTests.swift
```

---

## 6. Known Limitations & Platform Differences

### ⚠️ CRITICAL: Issues to Be Aware Of

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 1 | **No shared component library** | 🔴 High | React and SwiftUI are fundamentally different. Every UI component must be written twice. There is no transpiler or code-sharing mechanism. |
| 2 | **Sync is manual** | 🔴 High | When a feature is added to the web app, the Swift app must be updated separately. The documentation policy will remind the AI agent, but **you must verify**. |
| 3 | **SSE streaming differs** | 🟡 Medium | Web uses `fetch()` with `ReadableStream`. Swift uses `URLSession.bytes`. The parsing logic must be re-implemented. Edge cases (reconnection, partial chunks) may differ. |
| 4 | **Auth flow differs** | 🟡 Medium | Web uses Amplify JS with redirect flow. Swift uses `ASWebAuthenticationSession` or Amplify Swift SDK. Token refresh, session persistence, and error handling will differ. |
| 5 | **No Magic Carpet equivalent** | 🟡 Medium | The web's animated morphing navigation has no direct macOS equivalent. The Mac app uses standard NavigationSplitView instead. This is intentional, not a gap. |
| 6 | **Markdown rendering** | 🟡 Medium | Web uses React markdown libraries. Swift needs a custom markdown → AttributedString renderer. Complex LaTeX, tables, and code blocks may render differently. |
| 7 | **WebSocket support** | 🟡 Medium | Collaboration features use WebSocket. Swift's `URLSessionWebSocketTask` API differs from browser WebSocket. Reconnection logic must be separate. |
| 8 | **File handling** | 🟢 Low | macOS has richer file handling (drag-drop, Finder integration, Quick Look) which is actually superior to the web version. |
| 9 | **Keyboard shortcuts** | 🟢 Low | macOS keyboard shortcuts use ⌘ modifiers natively. The web uses browser shortcuts. The Mac app should follow macOS conventions, not mirror web shortcuts. |
| 10 | **Offline support** | 🟢 Low | The Mac app could add offline conversation viewing via SwiftData. The web app has no offline support. This would be a Mac advantage. |

### Platform-Specific Advantages (Mac)

| Advantage | Description |
|-----------|-------------|
| **Menu bar integration** | Sentinel Agents can show status in the macOS menu bar |
| **Spotlight integration** | Conversations searchable via macOS Spotlight |
| **Notifications** | Native macOS notifications for agent alerts |
| **Drag and drop** | Native file drag-and-drop from Finder |
| **Quick Look** | Preview artifacts via Quick Look |
| **Touch Bar** | Quick actions on MacBook Pro (if applicable) |
| **Liquid Glass** | macOS Sequoia's native glass materials (no CSS hacks) |
| **Performance** | Native compilation — no browser overhead |

---

## 7. Sync Protocol: Keeping Web and Mac in Lockstep

### 7.1 The Dual-Platform Rule

> **Any change to Think Tank web features MUST be evaluated for the Mac app.**  
> **Any change to Think Tank Mac features MUST be evaluated for the web app.**

This is enforced by:
1. The `/.windsurf/workflows/thinktank-dual-platform.md` policy (see below)
2. The DOCUMENTATION-MANIFEST.json trigger matrix
3. The AGENTS.md quick reference table
4. This guide's Feature Parity Matrix (Section 3)

### 7.2 Sync Workflow (For the Human)

When you ask the AI agent to make a Think Tank change:

```
1. BEFORE the change:
   □ Check the Feature Parity Matrix in this document
   □ Identify if the feature exists on both platforms

2. DURING the change:
   □ Tell the agent: "Update both web and Mac"
   □ Or: "Web only" / "Mac only" (if platform-specific)

3. AFTER the change:
   □ Verify the Feature Parity Matrix was updated
   □ Verify CHANGELOG.md mentions both platforms
   □ If only one platform was updated, create a follow-up task
```

### 7.3 Sync Workflow (For the AI Agent)

The AI agent MUST follow this checklist on any Think Tank change:

```
□ Read the Feature Parity Matrix in THINKTANK-MAC-GUIDE.md
□ If feature exists on both platforms → update both
□ If feature is new → add to Feature Parity Matrix with status
□ If feature is web-only → add to "Web-Only Features" table with reason
□ If feature is Mac-only → document the Mac advantage
□ Update CHANGELOG.md with platform annotations: [Web], [Mac], or [Both]
□ Update this guide's Feature Parity Matrix status column
```

### 7.4 Version Sync

| Rule | Details |
|------|---------|
| **Same API version** | Both apps must target the same API version |
| **Independent app versions** | The Mac app has its own version number (does not match web) |
| **Feature flags** | If a backend feature flag changes, both apps must handle it |
| **Breaking API changes** | Both apps must be updated simultaneously |

### 7.5 What Can Go Out of Sync (And What Can't)

| Allowed Divergence | Not Allowed |
|--------------------|-------------|
| UI layout (sidebar vs tabs) | Missing API calls that the web app makes |
| Animation style | Different data models for the same entity |
| Navigation patterns | Skipping safety features (Cato, Helix) |
| Platform-specific features (menu bar, Spotlight) | Ignoring user rules or preferences |
| macOS-native controls (Picker vs Select) | Inconsistent conversation history |

---

## 8. Authentication Architecture

### Web App Flow

```
User → Amplify JS → Cognito Hosted UI → ID Token → API Gateway
```

### Mac App Flow (Planned)

```
User → ASWebAuthenticationSession → Cognito Hosted UI → ID Token → Keychain → API Gateway
```

| Component | Web | Mac |
|-----------|-----|-----|
| **Auth Library** | AWS Amplify JS v6 | AWS Amplify Swift or raw Cognito SDK |
| **Token Storage** | Browser localStorage | macOS Keychain |
| **Token Refresh** | Amplify auto-refresh | Manual refresh via Cognito API |
| **Session Persistence** | Browser cookies/storage | Keychain + UserDefaults |
| **MFA** | Browser-based TOTP | Same TOTP flow via system browser |
| **SSO** | Redirect in browser tab | ASWebAuthenticationSession popup |

---

## 9. Streaming Architecture

Chat responses are streamed via Server-Sent Events (SSE):

### Web Implementation

```javascript
const response = await fetch(url, { method: 'POST', body, headers });
const reader = response.body.getReader();
// Read chunks, parse SSE lines
```

### Mac Implementation (Planned)

```swift
let (bytes, response) = try await URLSession.shared.bytes(for: request)
for try await line in bytes.lines {
    if line.hasPrefix("data: ") {
        let json = String(line.dropFirst(6))
        // Parse SSE event
    }
}
```

### SSE Event Types

| Event | Data | Description |
|-------|------|-------------|
| `message` | `{ content: string }` | Incremental text chunk |
| `brain-plan` | `{ plan: BrainPlan }` | Plan step update |
| `domain` | `{ field, domain, confidence }` | Domain detection result |
| `model` | `{ modelId, reason }` | Model selection |
| `delight` | `{ message, type }` | Personality message |
| `done` | `{ usage, cost }` | Stream complete |
| `error` | `{ code, message }` | Error during generation |

---

## 10. Dependencies

### Swift Package Manager Dependencies (Planned)

| Package | Purpose | License |
|---------|---------|---------|
| **Amplify Swift** | Cognito authentication | Apache 2.0 |
| **swift-markdown** | Markdown → AttributedString | Apache 2.0 |
| **Highlightr** | Syntax highlighting for code blocks | MIT |
| **KeychainAccess** | Secure token storage | MIT |
| **SwiftSoup** | HTML parsing (for artifact rendering) | MIT |

### Shared with Swift Deployer

| Shared Asset | Location | Purpose |
|--------------|----------|---------|
| **Design Tokens** | `MacOSComponents.swift` | RadiantSpacing, RadiantRadius |
| **Keychain Helpers** | `KeychainManager.swift` | Secure storage patterns |
| **Network Layer** | Pattern from Deployer's API client | URLSession best practices |

---

## 11. Build Phases (Recommended Implementation Order)

### Phase 1: Foundation (Session 1)

```
□ Package.swift with SPM dependencies
□ ThinkTankApp.swift entry point
□ APIClient.swift (base HTTP, auth headers, error handling)
□ AuthService.swift (Cognito sign-in, token management, Keychain)
□ SSEStreamParser.swift (Server-Sent Events parsing)
□ Conversation model + ConversationService
□ SidebarView with conversation list
□ ChatView with message display + streaming
□ MessageInputBar with send button
```

### Phase 2: Intelligence (Session 2)

```
□ BrainPlan model + BrainPlanService
□ BrainPlanPanel in Inspector
□ DomainTaxonomy model + DomainService
□ DomainPanel in Inspector + toolbar indicator
□ AIModel + ModelService + toolbar picker
□ My Rules UI (CRUD)
□ Settings window
□ Keyboard shortcuts (⌘N new conversation, ⌘W close, etc.)
```

### Phase 3: Advanced Features (Session 3)

```
□ Time Machine (conversation branching)
□ Council of Rivals (multi-model deliberation)
□ Grimoire (procedural memory)
□ Flash Facts
□ Sentinel Agents (menu bar integration)
□ Economic Governor (cost badge)
□ Artifact viewer (code highlighting)
□ Response ratings
```

### Phase 4: Polish & Parity (Session 4)

```
□ Derivation History
□ Decision Artifacts
□ Shadow Testing (side-by-side)
□ Ideas capture
□ File drag-and-drop + conversion
□ Spotlight integration
□ Native notifications
□ Comprehensive keyboard shortcuts
□ Accessibility (VoiceOver)
□ Unit tests
```

---

## 12. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Feature drift** — web gets features Mac doesn't | High | High | Dual-platform policy, Feature Parity Matrix, agent enforcement |
| **Auth complexity** — Cognito Swift SDK has different API surface | Medium | Medium | Use ASWebAuthenticationSession as fallback; test early |
| **SSE edge cases** — partial chunks, reconnection, timeouts | Medium | Medium | Comprehensive SSEStreamParser with unit tests |
| **Markdown rendering** — complex content renders differently | Medium | Low | Use swift-markdown + custom renderers; accept minor differences |
| **API changes** — backend changes break Mac app | Low | High | Shared type definitions; API versioning; test both clients |
| **macOS version fragmentation** — users on older macOS | Low | Medium | Target macOS 13.0+ (wide adoption); test on 13, 14, 15 |
| **Build times** — large Swift project compiles slowly | Medium | Low | Modular SPM targets; incremental compilation |

---

## 13. Related Documents

- [THINKTANK-USER-GUIDE.md](THINKTANK-USER-GUIDE.md) — Web app user guide (feature source of truth)
- [THINKTANK-ADMIN-GUIDE.md](THINKTANK-ADMIN-GUIDE.md) — Admin features (not in Mac app)
- [SWIFT-DEPLOYER-USER-GUIDE.md](SWIFT-DEPLOYER-USER-GUIDE.md) — Existing Swift app patterns to follow
- [THINKTANK-MOATS.md](THINKTANK-MOATS.md) — Competitive advantages (Mac app adds native platform moat)

---

## 14. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-06 | Initial pre-build documentation: architecture, feature parity matrix, limitations, sync protocol, risk register, build phases |

---

**Document maintained under RADIANT documentation policy. Any changes to Think Tank (web or Mac) MUST update this guide's Feature Parity Matrix.**


---

## Part V: Licensing Model

> **Version**: 1.0.0
> **Platform**: RADIANT v4.18.0 / v7.23.0+
> **Last Updated**: February 6, 2026
> **Companion**: [ADR: User Provisioning & Licensing](./architecture/ADR-USER-PROVISIONING-SEAT-LICENSING-AUTH.md)
> **Support Contact**: support@thinktank.app

---

## 1. Overview

The Think Tank Licensing Model governs what features, capacity, and regulatory capabilities each tenant has access to. Licensing is **flexible and multi-dimensional** — it covers seats, storage, retention, compliance, and any future dimension without requiring code changes.

### Core Principle

```
Every feature that costs us money to operate is a licensable dimension.
If a tenant doesn't have the license, the feature is disabled.
If they want it, they contact support@thinktank.app.
```

### Who This Document Is For

| Audience | What To Read |
|----------|-------------|
| **Engineers** | Sections 2-6 (schema, middleware, API enforcement) |
| **Administrators** | Sections 7-9 (tenant admin UI, managing licenses) |
| **Product/Sales** | Sections 10-11 (pricing tiers, regulatory licenses) |

---

## 2. License Architecture

### 2.1 The `tenant_licenses` Table

A single flexible table handles ALL license types. No code changes needed to add new license dimensions.

```sql
CREATE TABLE IF NOT EXISTS tenant_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- What type of license
    license_type VARCHAR(50) NOT NULL,
    -- CHECK: 'seat', 'storage', 'retention', 'compliance', 'feature', 'api_rate', 'addon'
    
    -- Which app (or 'platform' for cross-app)
    app_id VARCHAR(50) NOT NULL DEFAULT 'platform',
    -- Values: 'think_tank', 'curator', 'dojo', 'cato_trainer', 'genesis', 'platform'
    
    -- For compliance/feature licenses: specific feature code
    feature_code VARCHAR(100),
    -- Examples: 'hipaa', 'gdpr', 'soc2', 'ccpa', 'iso27001', 'data_residency',
    --           'enhanced_audit', 'extended_retention', 'hipaa_retention'
    
    -- Capacity
    quantity INTEGER NOT NULL DEFAULT 0,      -- Total licensed amount
    used INTEGER NOT NULL DEFAULT 0,          -- Currently consumed
    reserved INTEGER NOT NULL DEFAULT 0,      -- Reserved (e.g., pending invitations)
    unit VARCHAR(20) NOT NULL DEFAULT 'unit', -- 'user', 'gb', 'days', 'requests', 'boolean'
    
    -- Billing
    included_in_tier INTEGER NOT NULL DEFAULT 0,   -- Included with subscription tier
    additional_purchased INTEGER NOT NULL DEFAULT 0, -- Purchased beyond tier
    price_per_unit_cents INTEGER,                    -- Price for additional units
    overage_allowed BOOLEAN NOT NULL DEFAULT false,  -- Can exceed quantity?
    overage_price_per_unit_cents INTEGER,             -- Price for overage units
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,                   -- NULL = no expiry
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- One license record per type+app+feature per tenant
    UNIQUE(tenant_id, license_type, app_id, COALESCE(feature_code, ''))
);

CREATE INDEX idx_tenant_licenses_tenant ON tenant_licenses(tenant_id);
CREATE INDEX idx_tenant_licenses_type ON tenant_licenses(license_type, app_id);
CREATE INDEX idx_tenant_licenses_feature ON tenant_licenses(feature_code) WHERE feature_code IS NOT NULL;

ALTER TABLE tenant_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_licenses_isolation ON tenant_licenses
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### 2.2 The `license_catalog` Table

Defines all available license types and their default pricing. Used by the platform admin and billing system.

```sql
CREATE TABLE IF NOT EXISTS license_catalog (
    id VARCHAR(100) PRIMARY KEY,  -- e.g., 'seat:think_tank', 'compliance:hipaa'
    
    license_type VARCHAR(50) NOT NULL,
    app_id VARCHAR(50) NOT NULL DEFAULT 'platform',
    feature_code VARCHAR(100),
    
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    -- CHECK: 'app_access', 'capacity', 'compliance', 'addon'
    
    unit VARCHAR(20) NOT NULL,
    default_price_per_unit_cents INTEGER,
    
    -- Tier inclusion (how many units included per tier)
    included_tier_1 INTEGER NOT NULL DEFAULT 0,  -- SEED
    included_tier_2 INTEGER NOT NULL DEFAULT 0,  -- SPROUT
    included_tier_3 INTEGER NOT NULL DEFAULT 0,  -- GROWTH
    included_tier_4 INTEGER NOT NULL DEFAULT 0,  -- SCALE
    included_tier_5 INTEGER NOT NULL DEFAULT 0,  -- ENTERPRISE
    
    -- Constraints
    min_quantity INTEGER DEFAULT 0,
    max_quantity INTEGER,  -- NULL = unlimited
    requires_license_ids TEXT[],  -- Other licenses required first
    
    is_public BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.3 The `license_audit` Table

All license changes are logged for compliance and billing reconciliation.

```sql
CREATE TABLE IF NOT EXISTS license_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    license_id UUID REFERENCES tenant_licenses(id) ON DELETE SET NULL,
    
    action VARCHAR(50) NOT NULL,
    -- CHECK: 'created', 'activated', 'deactivated', 'quantity_changed',
    --        'used_changed', 'expired', 'renewed', 'overage_triggered'
    
    old_value JSONB,
    new_value JSONB,
    
    performed_by UUID,           -- User who made the change
    performed_by_app VARCHAR(50), -- 'radiant_admin', 'thinktank_tenant_admin', 'system', 'billing'
    reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_license_audit_tenant ON license_audit(tenant_id, created_at DESC);
```

---

## 3. License Types

### 3.1 Seat Licenses (Per-App User Access)

| License ID | App | Unit | Description |
|-----------|-----|------|-------------|
| `seat:think_tank` | think_tank | user | Think Tank access (Web + Mac = 1 seat) |
| `seat:curator` | curator | user | Curator access |
| `seat:dojo` | dojo | user | Aurelius Dojo access |
| `seat:cato_trainer` | cato_trainer | user | Cato Trainer access |
| `seat:genesis` | genesis | user | Genesis access |

**Rules**:
- Active users consume seats
- **Deactivated users FREE seats** (seat returned to pool)
- Invited users RESERVE seats (to prevent over-invitation)
- Think Tank seat granted by default on invite; other apps require explicit activation
- Overage: configurable per tenant (hard-block or auto-charge)

### 3.2 Capacity Licenses

| License ID | App | Unit | Description |
|-----------|-----|------|-------------|
| `storage:think_tank` | think_tank | gb | File storage quota for Think Tank |
| `storage:curator` | curator | gb | Document storage for Curator |
| `storage:cato_trainer` | cato_trainer | gb | Knowledge base storage |
| `storage:platform` | platform | gb | Platform-wide storage quota |
| `api_rate:platform` | platform | requests | API rate limit (requests/minute) |
| `tokens:platform` | platform | token | Monthly token allocation |

### 3.3 Retention Licenses

| License ID | App | Unit | Description | Cost Driver |
|-----------|-----|------|-------------|-------------|
| `retention:default` | platform | days | Default data retention | Included (30 days) |
| `retention:extended` | platform | days | Extended retention (90-365 days) | Warm storage |
| `retention:hipaa` | platform | days | HIPAA 7-year retention (2,555 days) | Glacier storage |
| `retention:sox` | platform | days | SOX record retention | Glacier storage |

### 3.4 Compliance/Regulatory Licenses

**These are the critical licensable regulatory features.** If a tenant does NOT have the license, the feature is DISABLED.

| License ID | Feature Code | Unit | Description | Internal Cost Driver |
|-----------|-------------|------|-------------|---------------------|
| `compliance:hipaa` | `hipaa` | boolean | HIPAA compliance features | Enhanced audit, PHI encryption keys, BAA |
| `compliance:hipaa_retention` | `hipaa_retention` | boolean | HIPAA 7-year retention | S3 Glacier for 7 years |
| `compliance:gdpr` | `gdpr` | boolean | GDPR compliance features | Erasure processing, consent mgmt, DSAR |
| `compliance:soc2` | `soc2` | boolean | SOC 2 Type II features | Comprehensive audit logging, evidence |
| `compliance:ccpa` | `ccpa` | boolean | CCPA compliance | Consumer privacy processing, opt-out |
| `compliance:iso27001` | `iso27001` | boolean | ISO 27001 features | Security management controls |
| `compliance:data_residency` | `data_residency` | boolean | Data residency controls | Multi-region storage infrastructure |
| `compliance:enhanced_audit` | `enhanced_audit` | boolean | Enhanced audit logging | High-volume audit storage |
| `compliance:pci_dss` | `pci_dss` | boolean | PCI-DSS features | Cardholder data controls |
| `compliance:fedramp` | `fedramp` | boolean | FedRAMP compliance | Gov cloud, additional controls |
| `compliance:hitrust` | `hitrust` | boolean | HITRUST CSF | Healthcare security framework |
| `compliance:eu_ai_act` | `eu_ai_act` | boolean | EU AI Act compliance | AI governance, risk assessment |

### 3.5 Add-On Licenses

| License ID | App | Unit | Description |
|-----------|-----|------|-------------|
| `addon:custom_models` | platform | boolean | Self-hosted custom model support |
| `addon:dedicated_support` | platform | boolean | Dedicated support channel |
| `addon:white_label` | platform | boolean | White-label/custom branding |
| `addon:sso_enterprise` | platform | boolean | Enterprise SSO (SAML/OIDC) |
| `addon:advanced_analytics` | platform | boolean | Advanced analytics dashboard |

---

## 4. Tier Defaults

When a tenant is created or upgrades their subscription, licenses are automatically provisioned based on their tier.

| License | SEED (T1) | SPROUT (T2) | GROWTH (T3) | SCALE (T4) | ENTERPRISE (T5) |
|---------|-----------|-------------|-------------|------------|-----------------|
| **Think Tank seats** | 1 | 10 | 50 | 200 | Unlimited |
| **Curator seats** | 0 | 5 | 25 | 100 | Unlimited |
| **Dojo seats** | 0 | 5 | 25 | 100 | Unlimited |
| **Cato seats** | 0 | 0 | 10 | 50 | Unlimited |
| **Genesis seats** | 0 | 0 | 10 | 50 | Unlimited |
| **Storage (platform)** | 1 GB | 10 GB | 100 GB | 1 TB | 10 TB |
| **Retention** | 30 days | 90 days | 365 days | 365 days | Custom |
| **API rate** | 100/min | 500/min | 2000/min | 10000/min | Custom |
| **HIPAA** | No | No | Add-on | Add-on | Included |
| **GDPR** | No | Add-on | Add-on | Included | Included |
| **SOC 2** | No | No | Add-on | Add-on | Included |
| **Enterprise SSO** | No | No | Add-on | Included | Included |

**"Add-on"** = Available for purchase. **"Included"** = Comes with the tier. **"No"** = Not available at this tier.

---

## 5. API Licensing Enforcement (For Engineers)

### 5.1 Middleware Pattern

Every API handler MUST check licensing before processing. This is implemented as middleware that runs before the handler logic.

```typescript
// packages/infrastructure/lambda/shared/middleware/license-check.ts

interface LicenseRequirement {
  app_id: string;           // Which app this endpoint belongs to
  license_type?: string;    // 'seat', 'compliance', etc.
  feature_code?: string;    // 'hipaa', 'gdpr', etc. (for compliance checks)
  check_seat?: boolean;     // Should we verify the user has a seat for this app?
  check_feature?: boolean;  // Should we verify a specific feature license?
}

async function checkLicense(
  tenantId: string,
  userId: string,
  requirement: LicenseRequirement
): Promise<LicenseCheckResult> {
  // 1. Check app seat license (if check_seat)
  if (requirement.check_seat) {
    const seatLicense = await getLicense(tenantId, 'seat', requirement.app_id);
    if (!seatLicense || !seatLicense.is_active) {
      return {
        allowed: false,
        error: 'LICENSE_REQUIRED',
        license_type: 'seat',
        app_id: requirement.app_id,
        message: `Your organization does not have ${requirement.app_id} licenses. Contact Think Tank support at support@thinktank.app to add this to your plan.`
      };
    }
    // Check if user has a seat allocated
    const userHasSeat = await userHasAppAccess(userId, requirement.app_id);
    if (!userHasSeat) {
      return {
        allowed: false,
        error: 'SEAT_NOT_ASSIGNED',
        message: `You do not have access to ${requirement.app_id}. Contact your tenant administrator.`
      };
    }
  }

  // 2. Check feature license (if check_feature)
  if (requirement.check_feature && requirement.feature_code) {
    const featureLicense = await getLicense(
      tenantId, 'compliance', 'platform', requirement.feature_code
    );
    if (!featureLicense || !featureLicense.is_active) {
      return {
        allowed: false,
        error: 'LICENSE_REQUIRED',
        license_type: 'compliance',
        feature_code: requirement.feature_code,
        message: `This feature requires a ${requirement.feature_code.toUpperCase()} compliance license. Contact Think Tank support at support@thinktank.app to add this to your plan.`,
        contact: 'support@thinktank.app'
      };
    }
  }

  return { allowed: true };
}
```

### 5.2 How To Apply Licensing To An Endpoint

```typescript
// Example: Think Tank chat endpoint — requires Think Tank seat
export async function handler(event: APIGatewayProxyEvent) {
  const user = extractAuthContext(event);
  
  // Check seat license
  const license = await checkLicense(user.tenantId, user.userId, {
    app_id: 'think_tank',
    check_seat: true,
  });
  if (!license.allowed) {
    return forbidden(license);
  }
  
  // ... handle request
}

// Example: HIPAA audit endpoint — requires HIPAA license
export async function hipaaAuditHandler(event: APIGatewayProxyEvent) {
  const user = extractAuthContext(event);
  
  // Check both seat AND compliance license
  const license = await checkLicense(user.tenantId, user.userId, {
    app_id: 'think_tank',
    check_seat: true,
    check_feature: true,
    feature_code: 'hipaa',
  });
  if (!license.allowed) {
    return forbidden(license);
  }
  
  // ... handle request
}

// Example: GDPR erasure endpoint — requires GDPR license
export async function gdprErasureHandler(event: APIGatewayProxyEvent) {
  const user = extractAuthContext(event);
  
  const license = await checkLicense(user.tenantId, user.userId, {
    app_id: 'platform',
    check_feature: true,
    feature_code: 'gdpr',
  });
  if (!license.allowed) {
    return forbidden(license);
  }
  
  // ... handle erasure request
}
```

### 5.3 Response Format When Unlicensed

All endpoints return a consistent error format:

```json
{
  "error": "LICENSE_REQUIRED",
  "license_type": "compliance",
  "feature_code": "hipaa",
  "message": "This feature requires a HIPAA compliance license. Contact Think Tank support at support@thinktank.app to add this to your plan.",
  "contact": "support@thinktank.app",
  "upgrade_url": "https://thinktank.app/pricing"
}
```

HTTP status: **403 Forbidden** (authenticated but not authorized by license).

### 5.4 License Cache

To avoid querying the database on every request, licenses are cached:

```typescript
// Cache tenant licenses for 5 minutes
// Invalidated on license change events
const LICENSE_CACHE_TTL_MS = 5 * 60 * 1000;

// Key: `license:${tenantId}` → Map of all active licenses
// Populated on first request, refreshed on TTL expiry or license change SNS event
```

### 5.5 Endpoint-to-License Mapping

Every Lambda handler file MUST declare its license requirements at the top:

```typescript
// At top of every handler file:
const LICENSE_REQUIREMENTS: Record<string, LicenseRequirement> = {
  'GET /chat': { app_id: 'think_tank', check_seat: true },
  'POST /chat': { app_id: 'think_tank', check_seat: true },
  'GET /hipaa/audit': { app_id: 'platform', check_seat: true, check_feature: true, feature_code: 'hipaa' },
  'POST /gdpr/erasure': { app_id: 'platform', check_feature: true, feature_code: 'gdpr' },
};
```

---

## 6. License Enforcement Summary By Regulatory Standard

### 6.1 What Each Standard Enables/Disables

| Standard | License Code | What Gets ENABLED | What Gets DISABLED Without It |
|----------|-------------|-------------------|-------------------------------|
| **HIPAA** | `hipaa` | PHI field management, enhanced audit trail, BAA documentation, access controls for ePHI, workforce training tracking | All PHI-related fields hidden, HIPAA audit tab disabled, HIPAA compliance reports unavailable |
| **HIPAA Retention** | `hipaa_retention` | 7-year record retention, Glacier archival, legal hold support | Records only retained for default period (30 days), no Glacier archival |
| **GDPR** | `gdpr` | Right to erasure (Art. 17), data portability (Art. 20), consent management (Art. 7), DSAR handling, DPA support | Erasure requests rejected, data export unavailable, consent UI hidden |
| **SOC 2** | `soc2` | Self-audit runner, evidence collection, compliance reports, change management tracking, penetration test tracking | Self-audit tab disabled, compliance report generation unavailable |
| **CCPA** | `ccpa` | Consumer privacy rights, opt-out tracking, data sale disclosure, privacy policy management | CCPA-specific opt-out unavailable, privacy rights tab hidden |
| **ISO 27001** | `iso27001` | 93 Annex A control tracking, risk assessment, security policy management, ISMS dashboard | ISO compliance dashboard disabled, control tracking unavailable |
| **Data Residency** | `data_residency` | Region selection for data storage, EU-only mode, cross-border transfer controls | Data stored in default region only, no region selection |
| **Enhanced Audit** | `enhanced_audit` | Per-request audit logging, IP tracking, device fingerprinting, session replay | Basic audit only (admin actions + auth events) |
| **PCI-DSS** | `pci_dss` | Cardholder data environment controls, network segmentation, vulnerability management | PCI controls tab disabled |
| **FedRAMP** | `fedramp` | Gov cloud compliance, FIPS 140-2 encryption, agency authorization tracking | FedRAMP compliance tab disabled |
| **HITRUST** | `hitrust` | CSF control tracking, readiness assessment, certification management | HITRUST tab disabled |
| **EU AI Act** | `eu_ai_act` | AI risk classification, transparency requirements, human oversight documentation | AI governance tab disabled |

### 6.2 Default Behavior (No Compliance Licenses)

Every tenant starts with these defaults (no license required):

| Capability | Default |
|-----------|---------|
| **Encryption at rest** | AES-256 (always on, all tiers) |
| **Encryption in transit** | TLS 1.3 (always on, all tiers) |
| **Tenant isolation** | RLS (always on, all tiers) |
| **Basic audit** | Admin actions + auth events logged, 30-day retention |
| **Data retention** | 30 days |
| **MFA** | Available but not required (tenant can require) |

---

## 7. Think Tank Tenant Admin — License Management UI

### 7.1 License Dashboard

**Location**: Think Tank Tenant Admin → Licenses

```
┌─────────────────────────────────────────────────────────────────┐
│  Licenses & Usage                              Tier: GROWTH (3)  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  APP SEATS                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐│
│  │ Think Tank       │  │ Curator          │  │ Dojo           ││
│  │ ████████░░ 42/50 │  │ ██████░░░░ 15/25 │  │ ██░░░░░░ 5/25  ││
│  │ [+ Buy Seats]    │  │ [+ Buy Seats]    │  │ [+ Buy Seats]  ││
│  └──────────────────┘  └──────────────────┘  └────────────────┘│
│                                                                  │
│  CAPACITY                                                        │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Storage          │  │ API Rate         │                    │
│  │ ██████████░ 67/100 GB │ 1,200/2,000 req/min │              │
│  │ [+ Buy Storage]  │  │ [+ Upgrade]      │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
│  COMPLIANCE LICENSES                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ✓ GDPR           Active    Included with GROWTH tier      │  │
│  │ ⚠ HIPAA          Not Licensed                             │  │
│  │   → Contact support@thinktank.app to add HIPAA            │  │
│  │ ⚠ SOC 2          Not Licensed                             │  │
│  │   → Contact support@thinktank.app to add SOC 2            │  │
│  │ ✓ Enterprise SSO  Active    Add-on purchased               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  DATA RETENTION                                                  │
│  Current: 365 days (included with GROWTH)                        │
│  HIPAA 7-year retention: Not Licensed                            │
│  → Contact support@thinktank.app for extended retention          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Unlicensed Feature UI Pattern

When a tenant admin navigates to a feature that requires a license they don't have:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠ [Feature Name]                                                │
│                                                                  │
│  This feature requires a [LICENSE_NAME] license.                 │
│                                                                  │
│  [LICENSE_NAME] includes:                                        │
│  • [Benefit 1]                                                   │
│  • [Benefit 2]                                                   │
│  • [Benefit 3]                                                   │
│                                                                  │
│  To add this license to your plan, contact Think Tank support:   │
│                                                                  │
│  📧 support@thinktank.app                                       │
│                                                                  │
│  [Contact Support]                                               │
└─────────────────────────────────────────────────────────────────┘
```

This pattern MUST be used consistently across ALL apps, not just Tenant Admin.

---

## 8. Invitation Flow with License Checks

### 8.1 Invite User Flow

```
Tenant Admin clicks "Invite User"
    │
    ▼
Enter email, select role, select app access:
  [✓] Think Tank (42/50 seats available)
  [✓] Curator (15/25 seats available)
  [✗] Dojo — 0 seats available → DISABLED
      "No Dojo seats available. Buy more seats or deactivate a user."
  [✗] Genesis — Not licensed → DISABLED
      "Genesis requires a license. Contact support@thinktank.app"
    │
    ▼
System checks:
  1. Inviter has tenant_admin or tenant_owner role? → YES
  2. Think Tank seat available? → YES (42 < 50)
  3. Curator seat available? → YES (15 < 25)
  4. Email already in this tenant? → NO
    │
    ▼
Create user record:
  - status = 'invited'
  - has_access_think_tank = true
  - has_access_curator = true
  - Think Tank seats_reserved += 1
  - Curator seats_reserved += 1
  - Send invitation email (expires in 7 days or tenant-configured)
    │
    ▼
User accepts invitation:
  - status → 'active'
  - seats_reserved -= 1, seats_used += 1 (for each app)
```

### 8.2 Deactivate User Flow

```
Tenant Admin deactivates a user
    │
    ▼
System:
  - user.status → 'deactivated'
  - For each app the user had access to:
    - seats_used -= 1  (SEAT FREED)
  - User can no longer log in
  - User data RETAINED (for regulatory compliance)
  - Audit log entry created
    │
    ▼
Later, if tenant wants to delete user data:
  - Check tenant retention licenses
  - If retention period not met → BLOCK deletion
    "This user's data must be retained for [X] more days per your [HIPAA/SOC2] license."
  - If retention period met → schedule hard delete
```

---

## 9. Regulatory Compliance & Licensing Interactions

### 9.1 When a Tenant Enables a Compliance License

```
Tenant purchases HIPAA license
    │
    ▼
System provisions:
  1. tenant_licenses: compliance:hipaa → active
  2. tenant_licenses: retention:hipaa → 2555 days (if purchased)
  3. tenant_auth_config: require_mfa → true (HIPAA requires it)
  4. Enable enhanced audit logging for this tenant
  5. Enable PHI field management
  6. Audit log: "HIPAA compliance activated"
    │
    ▼
Tenant Admin UI:
  - HIPAA tab becomes visible and functional
  - MFA becomes mandatory (cannot be disabled while HIPAA is active)
  - Session timeout enforced (15 minutes default for HIPAA)
  - All previously-disabled HIPAA features now available
```

### 9.2 When a Tenant Disables a Compliance License

```
Tenant cancels HIPAA license
    │
    ▼
System checks:
  1. Does tenant have data under HIPAA retention? → If yes, CANNOT disable
     "HIPAA license cannot be removed while data is under HIPAA retention.
      Data must be retained until [DATE]. Contact support for assistance."
  2. If no retained data → proceed
    │
    ▼
System deprovisions:
  1. tenant_licenses: compliance:hipaa → inactive
  2. HIPAA UI features disabled
  3. MFA requirement can now be changed (no longer HIPAA-enforced)
  4. Audit log: "HIPAA compliance deactivated"
```

---

## 10. License Helper Functions

```sql
-- Check if a tenant has a specific license
CREATE OR REPLACE FUNCTION check_tenant_license(
    p_tenant_id UUID,
    p_license_type VARCHAR,
    p_app_id VARCHAR DEFAULT 'platform',
    p_feature_code VARCHAR DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenant_licenses
        WHERE tenant_id = p_tenant_id
          AND license_type = p_license_type
          AND app_id = p_app_id
          AND (p_feature_code IS NULL OR feature_code = p_feature_code)
          AND is_active = true
          AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Get available seats for an app
CREATE OR REPLACE FUNCTION get_available_seats(
    p_tenant_id UUID,
    p_app_id VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    v_license tenant_licenses%ROWTYPE;
BEGIN
    SELECT * INTO v_license FROM tenant_licenses
    WHERE tenant_id = p_tenant_id
      AND license_type = 'seat'
      AND app_id = p_app_id
      AND is_active = true;
    
    IF NOT FOUND THEN RETURN 0; END IF;
    
    RETURN v_license.quantity - v_license.used - v_license.reserved;
END;
$$ LANGUAGE plpgsql STABLE;

-- Consume a seat (on user activation)
CREATE OR REPLACE FUNCTION consume_seat(
    p_tenant_id UUID,
    p_app_id VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_available INTEGER;
BEGIN
    v_available := get_available_seats(p_tenant_id, p_app_id);
    IF v_available <= 0 THEN RETURN false; END IF;
    
    UPDATE tenant_licenses
    SET used = used + 1, updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND license_type = 'seat'
      AND app_id = p_app_id
      AND is_active = true;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Release a seat (on user deactivation)
CREATE OR REPLACE FUNCTION release_seat(
    p_tenant_id UUID,
    p_app_id VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE tenant_licenses
    SET used = GREATEST(used - 1, 0), updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND license_type = 'seat'
      AND app_id = p_app_id
      AND is_active = true;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
```

---

## 11. Adding New License Types (For Engineers)

When a new licensable feature is added to the platform:

1. **Add a row to `license_catalog`** with the new license definition
2. **Add license check to the relevant API endpoint(s)** using the middleware pattern in Section 5
3. **Add UI gating** in the relevant app — show "license required" message if unlicensed
4. **Update tier defaults** if the feature should be included in any tier
5. **Update this document** (Section 3) with the new license type
6. **NO code changes to the licensing system itself** — it reads `license_catalog` dynamically

---

## 12. Adding New Apps (For Engineers)

When a new user-facing app is added to the platform:

1. **Add `seat:<app_id>` to `license_catalog`** with tier defaults
2. **Add `has_access_<app_id>` column to `users` table** (or use the dynamic permission system)
3. **Add the app to the invitation UI** in Think Tank Tenant Admin
4. **Add seat license rows** to `tenant_licenses` for all existing tenants (migration)
5. **All API endpoints in the new app** must use the license middleware with `app_id: '<app_id>'`
6. **Update this document** (Sections 3.1 and 4)

---

## 12A. Tenant-Disableable Regulatory Features & UI Pattern

### Overview

Regulatory compliance features are **optional licensed features**. When a tenant has a compliance license, the corresponding features are enabled. When they don't, the features are disabled with a clear UI message.

However, even when a tenant HAS a compliance license, the `tenant_owner` can choose to **disable specific compliance features** for their tenant (e.g., they have HIPAA but want to temporarily disable certain PHI scanning rules).

### Which Features Can Be Tenant-Disabled

| Feature | Can Tenant Disable? | Impact If Disabled | Notes |
|---------|:---:|---|---|
| **HIPAA** | ✅ | PHI scanning off, audit logging reduced | Warning: "Disabling HIPAA may violate BAA" |
| **HIPAA Retention** | ❌ | Cannot disable — required by law once activated | Locked for 7 years after activation |
| **GDPR** | ✅ | Erasure workflows still available (required by law), but consent UI hidden | "GDPR erasure rights cannot be fully disabled" |
| **SOC 2** | ✅ | Self-audit tools hidden, compliance reports disabled | No regulatory consequence |
| **CCPA** | ✅ | Consumer opt-out tracking hidden | Warning if CA users detected |
| **ISO 27001** | ✅ | ISMS controls hidden | No regulatory consequence |
| **Data Residency** | ❌ | Cannot disable — data cannot be moved once pinned | Locked once activated |
| **Enhanced Audit** | ✅ | Per-request audit logging stops | Warning if other compliance requires it |
| **PCI-DSS** | ✅ | Cardholder data controls hidden | Only relevant if processing cards |
| **FedRAMP** | ❌ | Cannot disable — federal requirement once certified | Locked once activated |
| **HITRUST** | ✅ | Healthcare security controls hidden | Warning if HIPAA also active |
| **EU AI Act** | ✅ | AI transparency/oversight features hidden | Warning for EU-based tenants |

### Disable UI Pattern (Think Tank Tenant Admin → Compliance)

```
┌──────────────────────────────────────────────────────────┐
│ Compliance Features                                       │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ ✅ HIPAA Compliance                              [ON/OFF] │
│    PHI management, enhanced audit, BAA                    │
│    ⚠️ Disabling may violate your Business Associate      │
│       Agreement. Contact legal before disabling.          │
│                                                           │
│ 🔒 HIPAA 7-Year Retention                     [LOCKED]   │
│    Cannot be disabled once activated.                     │
│    Earliest deactivation: 2033-02-06                      │
│                                                           │
│ ✅ GDPR Compliance                              [ON/OFF] │
│    Consent UI, portability, DSAR workflows                │
│    ℹ️ Right to erasure remains active per EU law          │
│                                                           │
│ ✅ SOC 2 Type II                                [ON/OFF] │
│    Self-audit, evidence collection, reports               │
│                                                           │
│ ❌ PCI-DSS                               [NOT LICENSED]  │
│    Contact support@thinktank.app to add this license.     │
│    [Contact Support]                                      │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### States

| State | Visual | Behavior |
|-------|--------|----------|
| **Licensed + Enabled** | Green toggle ON | Feature fully active |
| **Licensed + Disabled by tenant** | Gray toggle OFF | Feature hidden from users, can re-enable |
| **Licensed + Locked** | Lock icon, no toggle | Cannot be disabled (retention, residency, FedRAMP) |
| **Not Licensed** | "NOT LICENSED" badge | Contact support message, no toggle |

### API Enforcement

When a feature is disabled by the tenant (even if licensed):

```typescript
// Check both license AND tenant enablement
const isEnabled = await checkFeatureEnabled(tenantId, 'hipaa');
// Returns false if: no license OR license exists but tenant disabled it

// API response when tenant-disabled:
{
  "error": "FEATURE_DISABLED",
  "feature_code": "hipaa",
  "message": "HIPAA compliance is disabled for this tenant. Contact your tenant administrator to re-enable.",
  "disabled_by": "tenant_admin"
}
```

### Storage

Tenant-level feature enablement is stored in the `tenant_licenses` table via the `is_active` field:
- `is_active = true` → Licensed and enabled
- `is_active = false` → Licensed but tenant-disabled

For locked features, the application logic prevents toggling `is_active` to `false`.

---

## 13. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-06 | Initial licensing model: flexible multi-dimension licensing, regulatory compliance as licensed features, per-app seats, API enforcement middleware, tier defaults |

---

*Think Tank Licensing Model v1.0.0*
*RADIANT Platform — February 2026*
*Contact: support@thinktank.app*


---

## Part VI: Delight UX System

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


---

## Part VII: UI & Experience

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


**Version**: 4.18.3  
**Last Updated**: 2024-12-28

## Overview

The User Rules System allows Think Tank users to set persistent personal preferences that govern how the AI responds to them. Similar to Windsurf policies but for end users, these rules are automatically applied to every AI interaction.

## Key Concepts

### Rule Types

| Type | Description | Example |
|------|-------------|---------|
| **restriction** | Things the AI must NOT do | "Do not discuss religion" |
| **preference** | Things the AI SHOULD do | "Acknowledge uncertainty" |
| **format** | How responses should be structured | "Use bullet points" |
| **source** | Citation requirements | "Always cite sources" |
| **tone** | Communication style | "Be concise" |
| **topic** | Topic-specific rules | "Add health disclaimers" |
| **privacy** | Personal data handling | "Protect my privacy" |
| **accessibility** | Readability preferences | "Use simple language" |

### Rule Sources

- **user_created**: User typed the rule manually
- **preset_added**: Added from the preset library
- **ai_suggested**: AI suggested based on feedback patterns
- **imported**: Imported from another source

---

## Think Tank UI

**Location**: Think Tank → My Rules  
**URL**: `/thinktank/my-rules`

### My Rules Tab

View and manage your personal rules:

- **Toggle**: Enable/disable individual rules
- **Edit**: Modify rule text
- **Delete**: Remove rules
- **Stats**: See how many times each rule was applied

### Add from Presets Tab

Browse and add pre-seeded rules:

**Popular Rules** - Most commonly used rules by Think Tank users

**Categories**:
- Privacy & Safety
- Sources & Citations
- Response Format
- Tone & Style
- Accessibility
- Topic Preferences
- Advanced

---

## Pre-seeded Preset Rules

### Privacy & Safety

| Rule | Description |
|------|-------------|
| Protect my privacy | Prevents personal references or assumptions |
| No religious content | Filters out religious discussions |
| No political content | Keeps responses politically neutral |

### Sources & Citations

| Rule | Description |
|------|-------------|
| Always cite sources | Includes verifiable sources for facts |
| Prefer academic sources | Prioritizes peer-reviewed content |
| Include source dates | Adds publication dates for recency |

### Response Format

| Rule | Description |
|------|-------------|
| Be concise | Produces shorter, focused responses |
| Use lists for clarity | Organizes with bullets/numbers |
| Use headings | Adds section headers to long content |
| Comment code | Documents code examples |

### Tone & Style

| Rule | Description |
|------|-------------|
| Professional tone | Business-appropriate style |
| Casual tone | Relaxed, conversational style |
| Simple explanations | Accessible without oversimplifying |

### Advanced

| Rule | Description |
|------|-------------|
| Acknowledge uncertainty | States limitations honestly |
| Clarify before answering | Confirms question understanding |
| Show multiple viewpoints | Balanced coverage of debates |

---

## How Rules Are Applied

### Application Flow

1. User sends message to Think Tank
2. AGI Brain generates plan with pre-prompt selection
3. `prepromptLearningService.selectPreprompt()` is called
4. Service fetches user rules via `userRulesService.getRulesForPrompt()`
5. Rules are formatted and appended to the system prompt
6. Rule application is logged for tracking

### Prompt Injection Format

Rules are injected into the system prompt in categorized sections:

```
## User Preferences
The user has set the following rules for how you should respond:

**Restrictions (Must Follow):**
- Do not discuss religious topics...

**Source Requirements:**
- Always provide sources and citations...

**Format Preferences:**
- Keep responses concise...
```

### Priority

- Restrictions are always enforced first (highest priority)
- Higher priority numbers (0-100) take precedence
- Conflicting rules resolved by priority

---

## Database Schema

### user_memory_rules

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Multi-tenant isolation |
| `user_id` | UUID | Rule owner |
| `rule_text` | TEXT | Full rule content |
| `rule_summary` | VARCHAR | Short display text |
| `rule_type` | VARCHAR | restriction, preference, etc. |
| `priority` | INTEGER | 0-100, higher = more important |
| `source` | VARCHAR | user_created, preset_added, etc. |
| `is_active` | BOOLEAN | Enable/disable |
| `apply_to_preprompts` | BOOLEAN | Apply to system prompts |
| `apply_to_synthesis` | BOOLEAN | Apply during synthesis |
| `times_applied` | INTEGER | Usage counter |

### preset_user_rules

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `rule_text` | TEXT | Full rule content |
| `rule_summary` | VARCHAR | Short display text |
| `description` | TEXT | User-facing explanation |
| `rule_type` | VARCHAR | Rule category |
| `category` | VARCHAR | UI grouping |
| `icon` | VARCHAR | Lucide icon name |
| `is_popular` | BOOLEAN | Show in popular section |
| `min_tier` | INTEGER | Subscription tier requirement |

---

## API Endpoints

### User Rules

```
GET    /api/thinktank/user-rules           - Get user's rules
POST   /api/thinktank/user-rules           - Create new rule
PATCH  /api/thinktank/user-rules/:id       - Update rule
DELETE /api/thinktank/user-rules/:id       - Delete rule
PATCH  /api/thinktank/user-rules/:id/toggle - Enable/disable rule
```

### Presets

```
GET  /api/thinktank/user-rules/presets     - Get preset categories
POST /api/thinktank/user-rules/add-preset  - Add preset to user rules
```

### Internal (Service Layer)

```
getRulesForPrompt(tenantId, userId, domainId?, mode?)
  → Returns formatted rules for prompt injection
```

---

## Service Integration

### user-rules.service.ts

```typescript
// Get rules formatted for prompt injection
const rules = await userRulesService.getRulesForPrompt(
  tenantId,
  userId,
  domainId,     // Optional: filter by domain
  mode          // Optional: filter by orchestration mode
);

// Returns:
{
  rules: UserMemoryRule[],
  formattedForPrompt: string,
  ruleCount: number,
  hasRestrictions: boolean,
  hasSourceRequirements: boolean
}
```

### preprompt-learning.service.ts Integration

The preprompt service automatically fetches and applies user rules:

```typescript
// In selectPreprompt()
const userRules = await userRulesService.getRulesForPrompt(
  request.tenantId,
  request.userId,
  request.detectedDomainId,
  request.orchestrationMode
);

// Append to rendered preprompt
rendered.full = rendered.full + userRules.formattedForPrompt;
```

---

## Best Practices

### Writing Effective Rules

1. **Be Specific**: "Always cite sources with URLs" vs "cite sources"
2. **Use Positive Framing**: "Use bullet points" vs "Don't write paragraphs"
3. **One Rule Per Preference**: Easier to toggle and track

### Rule Limits

- Maximum 50 rules per user
- Maximum 1000 characters per rule text
- Inactive rules don't count toward limits

### When to Use Presets vs Custom

- **Presets**: Common preferences with proven effectiveness
- **Custom**: Unique personal requirements

---

---

## Memory Categories

Each memory/rule is categorized by **what it IS**, enabling better organization and future expansion.

### Category Hierarchy

| Top-Level | Sub-Categories | Description |
|-----------|----------------|-------------|
| **Instruction** | format, tone, source | Direct instructions for AI behavior |
| **Preference** | style, detail | Preferences that guide (not mandate) behavior |
| **Context** | personal, work, project | Background information about the user |
| **Knowledge** | fact, definition, procedure | Facts and information to remember |
| **Constraint** | topic, privacy, safety | Hard limits that must be followed |
| **Goal** | learning, productivity | User objectives and desired outcomes |

### Category Codes

```
instruction              # Direct instructions
  instruction.format     # How to structure responses
  instruction.tone       # Communication style
  instruction.source     # Citation requirements

preference               # Preferences
  preference.style       # Writing style preferences
  preference.detail      # Detail level preferences

context                  # User context
  context.personal       # Personal information
  context.work           # Professional context
  context.project        # Project-specific info

knowledge                # Knowledge to remember
  knowledge.fact         # Specific facts
  knowledge.definition   # Terms and meanings
  knowledge.procedure    # How to do things

constraint               # Hard limits
  constraint.topic       # Topics to avoid
  constraint.privacy     # Privacy rules
  constraint.safety      # Safety limitations

goal                     # User goals
  goal.learning          # Learning objectives
  goal.productivity      # Efficiency goals
```

### Database Schema: memory_categories

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `code` | VARCHAR | Unique category code (e.g., 'instruction.format') |
| `name` | VARCHAR | Display name |
| `parent_id` | UUID | Parent category for hierarchy |
| `level` | INTEGER | 1=top-level, 2=sub-category |
| `path` | VARCHAR | Materialized path (e.g., 'instruction.format') |
| `icon` | VARCHAR | Lucide icon name |
| `color` | VARCHAR | Tailwind color class |
| `is_system` | BOOLEAN | System categories cannot be deleted |
| `is_expandable` | BOOLEAN | Can users add sub-categories? |

### API Methods

```typescript
// Get category tree
const tree = await userRulesService.getMemoryCategories();
// Returns: { categories, topLevel, byCode }

// Get memories grouped by category
const grouped = await userRulesService.getMemoriesByCategory(
  tenantId,
  userId,
  categoryCode  // Optional: filter to specific category
);
```

### Future Expansion

The category system is designed for expansion:
- **Custom Categories**: Users can create sub-categories under expandable parents
- **Category Inheritance**: Rules can inherit from parent categories
- **Category-Specific Behavior**: Different application logic per category
- **Cross-Category Rules**: Rules that span multiple categories

---

## Related Documentation

- [Pre-Prompt Learning System](./PREPROMPT-LEARNING-SYSTEM.md)
- [Think Tank Documentation](./THINKTANK.md)
- [AGI Brain Plan System](./sections/SECTION-XX-AGI-BRAIN-PLAN.md)


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


---

## Part VIII: Collaboration

> **RADIANT v7.30.0** | Last updated: 2026-02-06

This guide covers everything about guest collaboration in Think Tank: how guests interact, what they can do, who owns the data, how costs are tracked, and how regulatory compliance is enforced.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Guest Permissions & Capabilities](#2-guest-permissions--capabilities)
3. [Can Guests Run AI Prompts?](#3-can-guests-run-ai-prompts)
4. [Ownership Model](#4-ownership-model)
5. [Cost Attribution & Billing](#5-cost-attribution--billing)
6. [Per-User Cost Tracking](#6-per-user-cost-tracking)
7. [Cross-Tenant Cost Splitting](#7-cross-tenant-cost-splitting)
8. [Regulatory Compliance](#8-regulatory-compliance)
9. [Guest Restriction Notifications](#9-guest-restriction-notifications)
10. [Tenant Admin Configuration](#10-tenant-admin-configuration)
11. [Session Limits](#11-session-limits)
12. [Database Schema](#12-database-schema)
13. [API Reference](#13-api-reference)
14. [Architecture & Data Flow](#14-architecture--data-flow)
15. [Enterprise Deployment Examples](#15-enterprise-deployment-examples)
16. [FAQ](#16-faq)

---

## 1. Overview

Think Tank supports real-time collaborative sessions where internal (tenant) users can invite **external guests** to participate. Guests are people outside the tenant — clients, partners, consultants, opposing counsel, external reviewers — who need temporary access to a specific conversation.

**Key principles:**

- Guests are **session-scoped** — they see only the session they're invited to
- The **host tenant owns all data** — every message, file, and annotation belongs to the tenant
- Guest capabilities are **explicitly controlled** — prompt execution, file access, and branching require tenant admin opt-in
- Costs are **tracked per-user** and **aggregated to the tenant** — guest-originated costs are attributed to an internal user
- **Compliance licenses auto-restrict** guest capabilities — HIPAA/GDPR/SOC2 tenants get automatic protections

---

## 2. Guest Permissions & Capabilities

Guests are invited with one of three permission levels. Capabilities are resolved from the permission level combined with tenant settings and compliance licenses.

### Permission → Capability Matrix

| Capability | Viewer | Commenter | Editor |
|---|---|---|---|
| **View messages** | ✅ | ✅ | ✅ |
| **Add comments & annotations** | ❌ | ✅ | ✅ |
| **Add reactions** | ❌ | ✅ | ✅ |
| **Edit messages** | ❌ | ❌ | ✅ |
| **Run AI prompts** | ❌ | ❌ | ✅ * |
| **Upload files** | ❌ | ❌ | ✅ * |
| **Download files** | ✅ † | ✅ † | ✅ † |
| **Create conversation branches** | ❌ | ❌ | ✅ † |
| **Join AI Roundtable** | ❌ | ✅ † | ✅ † |

**\*** Requires explicit tenant admin opt-in (`guestPromptExecutionEnabled` / `guestFileUploadEnabled`). OFF by default.

**†** Disabled automatically when compliance licenses are active and `complianceAutoRestrict` is enabled (default: enabled).

### How Capabilities Are Resolved

```
1. Start with base capabilities from permission level (viewer/commenter/editor)
2. Apply tenant collaboration settings (guest_prompt_execution_enabled, etc.)
3. Check for active compliance licenses (HIPAA, GDPR, SOC2, etc.)
4. If compliance_auto_restrict=true AND compliance licenses exist:
   → Force-disable: prompt execution, file upload, file download, branching, roundtable
5. Store resolved capabilities on the guest record:
   → can_execute_prompts, can_upload_files, can_download_files
```

The resolution runs at **invite acceptance time** (`joinAsGuest`), not at invite creation. This means if a tenant admin changes settings between invite creation and acceptance, the guest gets the capabilities in effect at the time they join.

---

## 3. Can Guests Run AI Prompts?

**Yes, but with strict controls.** Guest prompt execution is **OFF by default** for all guests.

### Requirements (ALL must be true)

| # | Requirement | Default |
|---|---|---|
| 1 | Guest permission level = `editor` | N/A |
| 2 | Tenant admin enables `guestPromptExecutionEnabled` | `false` |
| 3 | No compliance license blocking it | Auto-blocked by HIPAA/GDPR/SOC2 |
| 4 | Guest hasn't exceeded per-session prompt limit | Default: 20 prompts |
| 5 | Guest hasn't exceeded per-session token limit | Default: 50,000 tokens |

### Execution Flow

```
Guest clicks "Send" on a prompt
  │
  ▼
guardGuestPrompt() middleware runs
  │
  ├─ Check can_execute_prompts on guest record → false? → 403 + clear message
  ├─ Check prompt count limit → exceeded? → 403 + "You have reached the maximum..."
  ├─ Check token limit → exceeded? → 403 + "You have reached the maximum..."
  ├─ Resolve cost attribution → who pays?
  │
  ▼
AI model invocation (LiteLLM)
  │
  ▼
recordGuestPromptUsage() runs
  ├─ Log to guest_cost_attribution_log (PostgreSQL)
  ├─ Update guest running totals (prompts_executed, tokens_consumed, cost_incurred)
  ├─ Record usage event in billing metering (DynamoDB)
  │   ├─ Tenant-level daily rollup (TENANT#{tenantId})
  │   └─ User-level daily rollup (TENANT#{tenantId}#USER#{attributedUserId})
  │
  ▼
Response returned to guest
```

### What Guests See When Blocked

If a guest attempts a restricted action, they see a clear message:

> *"AI prompt execution is not available for guest participants in this session. This restriction is set by the organization's collaboration policy."*

If they hit a limit:

> *"You have reached the maximum number of AI prompts (20) for this session. Contact the session host if you need additional access."*

---

## 4. Ownership Model

### Who Owns What?

| Entity | Owner | Details |
|---|---|---|
| **Collaborative session** | Host tenant user | `collaborative_sessions.owner_id` = the user who created the session |
| **All session data** | Host tenant | `collaborative_sessions.tenant_id` = tenant that owns everything |
| **Messages from guests** | Host tenant | Stored in `session_messages`, owned by the tenant |
| **Files uploaded by guests** | Host tenant | Stored in `collaboration_attachments`, S3 bucket owned by tenant |
| **Annotations by guests** | Host tenant | Stored in `async_annotations`, session-scoped |
| **Knowledge graph nodes** | Host tenant | Created by guests but owned by tenant |

### What Guests Can See

- **Only** the specific session they were invited to
- **Zero** access to other conversations, other sessions, other apps, or any tenant data
- **No** persistent account — guest identity is token-based (`guest_token`)
- When the session ends or the guest leaves, they lose all access

### Data Isolation

- Row Level Security (RLS) enforces tenant isolation via `check_session_tenant(session_id)`
- All collaboration tables use `session_id → collaborative_sessions.tenant_id` for isolation
- Guests cannot query any table outside their session scope

---

## 5. Cost Attribution & Billing

When a guest runs an AI prompt, the token cost must be attributed to someone for billing. The tenant admin configures how this works.

### Attribution Modes

| Mode | Who Pays | When to Use |
|---|---|---|
| **`inviting_user`** (default) | The tenant user who created the invite | Most common. The person who invited the guest is responsible for the costs they generate. |
| **`session_owner`** | The user who created the collaborative session | When sessions are "owned" by a project lead who manages the budget. |
| **`tenant_pool`** | Shared organization pool (no individual attribution) | When costs are treated as organizational overhead. |

### How It Works

```
Guest runs a prompt
  │
  ▼
resolveCostAttribution(tenantId, guestId, sessionId)
  │
  ├─ Look up the guest → find inviting user (collaboration_guest_invites.created_by)
  ├─ Check tenant_collaboration_settings.guest_cost_attribution
  │
  ├─ "inviting_user" → attributedToUserId = inviting user
  ├─ "session_owner" → attributedToUserId = collaborative_sessions.owner_id
  ├─ "tenant_pool"   → attributedToUserId = inviting user (for tracking), marked as pool
  │
  ▼
Usage event recorded with:
  - tenantId = host tenant (for tenant-level aggregation)
  - userId = attributedToUserId (for per-user tracking)
  - guestId = guest identifier (for guest-level tracking)
  - guestOriginated = true
```

### Cost Tracking Tables

| Table | Storage | Granularity | Retention |
|---|---|---|---|
| `radiant-usage-events` (DynamoDB) | Individual events | Per-request | 90 days |
| `radiant-usage-rollups` (DynamoDB) | Tenant daily rollup | Per-tenant per-model per-day | Indefinite |
| `radiant-user-usage-rollups` (DynamoDB) | User daily rollup | Per-user per-model per-day | Indefinite |
| `guest_cost_attribution_log` (PostgreSQL) | Guest attribution detail | Per-guest per-request | Per retention policy |

### Example: Cost Flow

A law firm (Tenant A) has user Alice who invites external consultant Bob as a guest editor.

1. Bob sends a prompt → 1,500 input tokens, 800 output tokens
2. Model pricing: $3/M input, $15/M output → provider cost = $0.0165
3. Tenant margin: 20% → billed cost = $0.0198
4. Attribution mode: `inviting_user` → cost attributed to **Alice**

**Result:**
- Alice's per-user rollup: +$0.0198 (with `guestOriginatedCost` = $0.0198)
- Tenant A's daily rollup: +$0.0198
- `guest_cost_attribution_log`: Bob → Alice, $0.0198, model details
- Bob's guest record: `prompts_executed` = 1, `tokens_consumed` = 2300, `cost_incurred` = $0.0198

---

## 6. Per-User Cost Tracking

All costs — whether from the user directly or from guests they invited — are tracked at the user level and aggregated to the tenant.

### DynamoDB Schema: `radiant-user-usage-rollups`

| Key | Format | Example |
|---|---|---|
| **pk** (partition) | `TENANT#{tenantId}#USER#{userId}` | `TENANT#abc-123#USER#alice-456` |
| **sk** (sort) | `DATE#{date}#MODEL#{modelId}` | `DATE#2026-02-06#MODEL#claude-3-5-sonnet` |

| Attribute | Type | Description |
|---|---|---|
| `requestCount` | number | Total requests (direct + guest-originated) |
| `inputTokens` | number | Total input tokens |
| `outputTokens` | number | Total output tokens |
| `totalTokens` | number | Total tokens |
| `providerCost` | number | Raw provider cost |
| `billedCost` | number | Cost after tenant margin |
| `guestOriginatedCount` | number | Requests originated by guests attributed to this user |
| `guestOriginatedCost` | number | Cost of guest-originated requests attributed to this user |

### API Endpoints

**Per-user rollups:**
```
GET /api/billing/metering/user-rollups?userId={userId}&startDate=2026-02-01&endDate=2026-02-06
```

Response:
```json
{
  "period": { "startDate": "2026-02-01", "endDate": "2026-02-06" },
  "userId": "alice-456",
  "totals": {
    "requests": 142,
    "inputTokens": 485000,
    "outputTokens": 192000,
    "billedCost": 12.45,
    "guestOriginatedCount": 18,
    "guestOriginatedCost": 2.34
  },
  "rollups": [...]
}
```

**Guest usage summary (tenant-wide):**
```
GET /api/billing/metering/guest-usage?startDate=2026-02-01&endDate=2026-02-06
```

Response:
```json
{
  "period": { "startDate": "2026-02-01", "endDate": "2026-02-06" },
  "totals": {
    "requests": 47,
    "tokens": 128500,
    "billedCost": 5.67
  },
  "byUser": [
    {
      "attributedToUserId": "alice-456",
      "attributionType": "inviting_user",
      "totalRequests": 18,
      "totalInputTokens": 52000,
      "totalOutputTokens": 31000,
      "totalBilledCost": 2.34,
      "totalProviderCost": 1.95
    }
  ]
}
```

---

## 7. Cross-Tenant Cost Splitting

When a guest is a user from **another Think Tank tenant** (identified by `linked_tenant_id` on the guest record), costs can be split between the two organizations.

### Configuration

| Setting | Default | Description |
|---|---|---|
| `crossTenantGuestEnabled` | `true` | Allow users from other tenants as guests |
| `crossTenantCostSplitEnabled` | `false` | Enable cost splitting |
| `crossTenantCostSplitPercent` | `50` | Percentage the host tenant pays (0-100) |

### Example

Host Tenant A invites a user from Tenant B. Cost split is 60/40 (host pays 60%).

A prompt costs $0.10 billed:
- Tenant A (host) pays: $0.06
- Tenant B (guest's org) pays: $0.04

This is recorded in `guest_cost_attribution_log` with:
```sql
attribution_type = 'cross_tenant_split'
split_percent = 60
host_tenant_cost = 0.06
guest_tenant_cost = 0.04
guest_tenant_id = 'tenant-b-id'
```

---

## 8. Regulatory Compliance

### Compliance Gates

Before any guest invite is created, `CollaborationPolicyService.checkComplianceForGuestInvite()` runs:

```
1. Check if guest access is enabled → disabled? → reject invite
2. Query tenant_licenses for active compliance licenses
3. No compliance licenses? → allow freely
4. Compliance licenses found:
   a. Determine which features to restrict
   b. HIPAA → require explicit acknowledgment
   c. GDPR → prepare data processing notice
   d. Build restriction list
5. Return: { allowed, restrictions, requiresAcknowledgment, notificationMessage }
```

### Compliance License → Guest Restriction Mapping

| License | Prompt Execution | File Upload | File Download | Branching | Roundtable | Acknowledgment |
|---|---|---|---|---|---|---|
| **HIPAA** | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | Required |
| **HIPAA Retention** | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | Required |
| **GDPR** | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | Required |
| **SOC 2** | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | Not required |
| **CCPA** | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | Not required |
| Any other compliance | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | Not required |

> All restrictions apply when `complianceAutoRestrict = true` (default). Tenant admins can override this, but they see a red warning banner and are told compliance officer approval is required.

### Audit Trail

Every restriction event is logged to `guest_compliance_restriction_log`:

| Column | Description |
|---|---|
| `tenant_id` | The tenant |
| `session_id` | The collaborative session |
| `guest_id` | The guest (null for invite-time restrictions) |
| `restricted_feature` | What was blocked (e.g., `prompt_execution`) |
| `restriction_reason` | Human-readable reason |
| `compliance_licenses` | JSON array of active compliance licenses |
| `guest_notified` | Whether the guest was shown a notification |
| `notification_message` | The message shown to the guest |

---

## 9. Guest Restriction Notifications

When a guest joins a session and their capabilities are restricted, the UI shows a **`GuestRestrictionBanner`**:

### Compliance-Restricted (Amber Banner)

> **Compliance Policy Restrictions**
>
> Some features are restricted by your organization's compliance policies.
>
> - 🔇 AI prompt execution is not available in this session.
> - ⬆️ File uploads are not available in this session.
> - ⬇️ File downloads are not available in this session.
> - 🌿 Creating conversation branches is not available.

### General Restriction (Slate Banner)

> **Guest Access Restrictions**
>
> Some features are restricted for guest participants.
>
> - 🔇 AI prompt execution is not available in this session.

### Behavior

- Shown immediately when the guest joins the session
- Dismissible (guest can close it)
- Re-appears if the guest attempts a restricted action
- The message text is configurable by the tenant admin

---

## 10. Tenant Admin Configuration

### Location

**Tenant Admin → Configuration → Collaboration** (`/collaboration`)

### Settings Reference

| Setting | Type | Default | Description |
|---|---|---|---|
| `guestAccessEnabled` | boolean | `true` | Master switch for all guest collaboration |
| `guestPromptExecutionEnabled` | boolean | `false` | Allow editor-level guests to run AI prompts |
| `guestFileUploadEnabled` | boolean | `false` | Allow editor-level guests to upload files |
| `guestFileDownloadEnabled` | boolean | `true` | Allow guests to download files |
| `complianceAutoRestrict` | boolean | `true` | Auto-disable sensitive features when compliance licenses are active |
| `guestCostAttribution` | enum | `inviting_user` | Who pays for guest AI usage |
| `crossTenantGuestEnabled` | boolean | `true` | Allow users from other tenants as guests |
| `crossTenantCostSplitEnabled` | boolean | `false` | Split costs between host and guest tenant |
| `crossTenantCostSplitPercent` | 0-100 | `50` | Host tenant's share of split costs |
| `guestMaxPromptsPerSession` | number | `20` | Max AI prompts per guest per session |
| `guestMaxTokensPerSession` | number | `50000` | Max tokens per guest per session |
| `guestSessionTimeoutMinutes` | number | `120` | Auto-disconnect guests after this duration |
| `notifyGuestOnRestriction` | boolean | `true` | Show restriction banner to guests |
| `restrictionMessage` | text | (default message) | Custom message for restriction banner |

### Compliance-Blocked Controls

When compliance licenses are active and `complianceAutoRestrict` is on:
- Toggles for prompt execution, file upload, file download are **force-disabled**
- Each disabled toggle shows an amber banner explaining:
  - *Which* compliance license is blocking the feature
  - *Why* the feature is restricted
  - *How* to override (disable Compliance Auto-Restrict, requires compliance officer approval)

---

## 11. Session Limits

Per-session caps prevent runaway guest usage.

| Limit | Default | Configurable | Enforcement |
|---|---|---|---|
| **Max prompts per session** | 20 | Yes, per tenant | `guardGuestPrompt()` checks before each AI call |
| **Max tokens per session** | 50,000 | Yes, per tenant | `guardGuestPrompt()` checks before each AI call |
| **Session timeout** | 120 min | Yes, per tenant | Stored for enforcement (scheduled Lambda) |

### Running Totals

Each guest record tracks:

| Column | Type | Description |
|---|---|---|
| `prompts_executed` | integer | Number of AI prompts run in this session |
| `tokens_consumed` | integer | Total tokens used in this session |
| `cost_incurred` | decimal | Total cost generated in this session |

These are updated atomically after each AI call by `recordGuestPromptUsage()`.

---

## 12. Database Schema

### New Tables (Migration 008)

#### `tenant_collaboration_settings`
Per-tenant configuration for all guest collaboration features. One row per tenant.

#### `guest_cost_attribution_log`
Every AI action by a guest, with full cost breakdown.

| Column | Type | Description |
|---|---|---|
| `guest_id` | UUID | The guest who ran the prompt |
| `session_id` | UUID | The collaborative session |
| `tenant_id` | UUID | Host tenant |
| `attributed_to_user_id` | UUID | Internal user who pays |
| `attribution_type` | varchar | `inviting_user`, `session_owner`, `tenant_pool`, `cross_tenant_split` |
| `model_id` | varchar | AI model used |
| `input_tokens` | integer | Input token count |
| `output_tokens` | integer | Output token count |
| `provider_cost` | decimal | Raw provider cost |
| `billed_cost` | decimal | Cost after margin |
| `split_percent` | integer | Host tenant share (for cross-tenant) |
| `host_tenant_cost` | decimal | Host tenant portion |
| `guest_tenant_cost` | decimal | Guest tenant portion |
| `guest_tenant_id` | UUID | Guest's home tenant (for cross-tenant) |

#### `guest_compliance_restriction_log`
Audit trail of every compliance-restricted action.

### Extended Tables

#### `collaboration_guests` (6 new columns)
- `can_execute_prompts` — resolved at join time
- `can_upload_files` — resolved at join time
- `can_download_files` — resolved at join time
- `prompts_executed` — running count
- `tokens_consumed` — running count
- `cost_incurred` — running total

#### `collaboration_guest_invites` (3 new columns)
- `compliance_acknowledged` — for HIPAA/GDPR acknowledgment
- `compliance_restrictions` — JSON array of restrictions at invite time
- `cost_attribution_user_id` — the user costs will be attributed to

---

## 13. API Reference

### Billing Metering

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/billing/metering/record` | Record usage (accepts `guestId`, `attributedToUserId`, `sessionId`) |
| `GET` | `/api/billing/metering/summary` | Tenant-level summary (includes guest costs) |
| `GET` | `/api/billing/metering/rollups` | Tenant-level daily rollups |
| `GET` | `/api/billing/metering/user-rollups?userId=` | Per-user rollups with guest subtotals |
| `GET` | `/api/billing/metering/guest-usage` | Guest cost attribution summary by user |

### Tenant Admin Collaboration Settings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tenant-admin/collaboration` | Get current settings + compliance licenses |
| `PUT` | `/api/tenant-admin/collaboration` | Update collaboration settings |

### Guest Prompt Guard (Internal)

```typescript
import { guardGuestPrompt, recordGuestPromptUsage } from './middleware/guest-prompt-guard';

// Before AI call:
const guard = await guardGuestPrompt(pool, { guestId, sessionId, tenantId });
if (!guard.allowed) {
  return { statusCode: 403, body: JSON.stringify({ error: guard.reason }) };
}

// After AI call:
await recordGuestPromptUsage(pool, guard, {
  modelId: 'claude-3-5-sonnet',
  inputTokens: 1500,
  outputTokens: 800,
  providerCost: 0.0165,
  billedCost: 0.0198,
  requestId: 'req-abc-123',
  latencyMs: 2400,
});
```

---

## 14. Architecture & Data Flow

### Invite → Join → Interact → Billing

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INVITE FLOW                                  │
│                                                                     │
│  Tenant User                                                        │
│    │                                                                │
│    ▼                                                                │
│  createGuestInvite()                                                │
│    │                                                                │
│    ├─ checkComplianceForGuestInvite() ──→ compliance gate           │
│    ├─ Store compliance_restrictions on invite                       │
│    ├─ Store cost_attribution_user_id = inviting user                │
│    └─ Log restrictions to guest_compliance_restriction_log          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                         JOIN FLOW                                   │
│                                                                     │
│  Guest clicks invite link                                           │
│    │                                                                │
│    ▼                                                                │
│  joinAsGuest()                                                      │
│    │                                                                │
│    ├─ resolveCapabilities() ──→ permission + settings + compliance  │
│    ├─ Write can_execute_prompts/can_upload_files/can_download_files │
│    ├─ Build restriction notification                                │
│    └─ Return guest record + capabilities + notification             │
│                                                                     │
│  Guest sees GuestRestrictionBanner (if restrictions exist)          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                      PROMPT EXECUTION FLOW                          │
│                                                                     │
│  Guest sends prompt                                                 │
│    │                                                                │
│    ▼                                                                │
│  guardGuestPrompt()                                                 │
│    ├─ Check can_execute_prompts ──→ false? → 403                   │
│    ├─ Check prompt limit ──→ exceeded? → 403                       │
│    ├─ Check token limit ──→ exceeded? → 403                        │
│    └─ Resolve cost attribution                                      │
│    │                                                                │
│    ▼                                                                │
│  AI Model Invocation (LiteLLM)                                      │
│    │                                                                │
│    ▼                                                                │
│  recordGuestPromptUsage()                                           │
│    ├─ Insert into guest_cost_attribution_log (PostgreSQL)           │
│    └─ Update guest running totals                                   │
│    │                                                                │
│    ▼                                                                │
│  Billing metering (DynamoDB)                                        │
│    ├─ Usage event: guestOriginated=true, attributedToUserId=X      │
│    ├─ Tenant rollup: TENANT#{tenantId} (aggregated)                │
│    └─ User rollup: TENANT#{tenantId}#USER#{attributedUserId}       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 15. Enterprise Deployment Examples

### Law Firm (HIPAA)

```
Settings:
  guestAccessEnabled: true
  guestPromptExecutionEnabled: false  ← blocked by compliance anyway
  complianceAutoRestrict: true
  guestCostAttribution: 'inviting_user'
  notifyGuestOnRestriction: true

Result:
  - Guests can view and comment on conversations
  - NO prompt execution, file upload/download, branching
  - All restrictions logged for compliance audit
  - Costs attributed to the attorney who invited the guest
```

### Research Lab (no compliance)

```
Settings:
  guestAccessEnabled: true
  guestPromptExecutionEnabled: true   ← explicitly enabled
  guestFileUploadEnabled: true
  guestCostAttribution: 'session_owner'
  guestMaxPromptsPerSession: 50
  guestMaxTokensPerSession: 200000
  crossTenantCostSplitEnabled: true
  crossTenantCostSplitPercent: 70     ← lab pays 70%

Result:
  - Guests with editor permission can run prompts and upload files
  - 50 prompts, 200K tokens per session
  - Costs attributed to the session owner (PI / project lead)
  - Cross-tenant guests: 70/30 cost split
```

### Hospital (HIPAA + SOC2)

```
Settings:
  guestAccessEnabled: true
  complianceAutoRestrict: true        ← auto-restricts everything
  guestCostAttribution: 'tenant_pool'
  notifyGuestOnRestriction: true
  restrictionMessage: 'Patient data protection policies restrict some features for external participants.'

Result:
  - Guests can view and comment only
  - All sensitive features force-disabled
  - Costs go to organizational pool
  - Custom compliance message shown to guests
```

### Startup (no compliance, minimal restrictions)

```
Settings:
  guestAccessEnabled: true
  guestPromptExecutionEnabled: true
  guestFileUploadEnabled: true
  guestFileDownloadEnabled: true
  guestCostAttribution: 'inviting_user'
  guestMaxPromptsPerSession: null     ← no limit
  guestMaxTokensPerSession: null      ← no limit

Result:
  - Full guest capabilities (editor = full access)
  - No limits on prompts or tokens
  - Costs attributed to whoever invited the guest
```

---

## 16. FAQ

### Q: If I disable guest access entirely, what happens to existing sessions?

Active guest connections remain until the guest leaves or the session ends. New guest invites will be rejected. Existing invites cannot be redeemed.

### Q: Can a guest be promoted to a full tenant user?

Guests have a `linked_user_id` field. If a guest later receives a tenant invitation and creates an account, the system can link them. This does not retroactively change ownership of their session content — it remains owned by the host tenant.

### Q: Where can I see how much my guests have cost?

**Tenant Admin → Reports** shows overall tenant costs. The new `GET /metering/guest-usage` endpoint provides a breakdown of guest-originated costs by attributed user. The `GET /metering/user-rollups` endpoint shows each user's total with `guestOriginatedCost` subtotals.

### Q: Can I change the cost attribution mode retroactively?

No. Attribution is set at the time of usage. Changing the mode only affects future guest prompts. Historical attribution is immutable in `guest_cost_attribution_log`.

### Q: What happens when a guest from another tenant triggers the cross-tenant split?

The split is recorded in `guest_cost_attribution_log` with `host_tenant_cost` and `guest_tenant_cost`. The actual inter-tenant billing reconciliation is handled through monthly cross-tenant invoicing (future feature).

### Q: Can I override compliance restrictions for a specific session?

Not per-session. The Compliance Auto-Restrict toggle is tenant-wide. If you disable it, ALL sessions lose compliance protections for guests. The UI warns you and recommends compliance officer approval.

---

## Related Documents

| Document | Relevance |
|---|---|
| `docs/THINKTANK-LICENSING-MODEL.md` | Compliance license definitions |
| `docs/POLYMORPHIC-LIQUID-UI-GUIDE.md` | Delight system for guests |
| `docs/DELIGHT-SYSTEM-GUIDE.md` | Guest Delight behavior |
| `docs/RADIANT-PLATFORM-ARCHITECTURE.md` | Platform architecture (Section: Guest Collaboration Policy) |
| `CHANGELOG.md` | v7.30.0 release notes |



---

*Consolidated from 12 source documents (0 not found). 21,932 source lines.*
# Think Tank Real-Time Collaboration - Complete Guide

> **The Only Consumer AI Platform with True Real-Time Multi-User Collaboration**
>
> **Version**: 6.6.0 | **Last Updated**: February 4, 2026  
> **Classification**: Internal + Investor Distribution

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Why This Matters: The Market Gap](#why-this-matters-the-market-gap)
3. [Architecture Overview](#architecture-overview)
4. [Core Features](#core-features)
5. [Technical Implementation](#technical-implementation)
6. [User Experience](#user-experience)
7. [Competitive Analysis](#competitive-analysis)
8. [Marketing & Sales Points](#marketing--sales-points)
9. [Engineering Reference](#engineering-reference)
10. [Deployment & Configuration](#deployment--configuration)
11. [API Reference](#api-reference)
12. [Security & Compliance](#security--compliance)
13. [Roadmap](#roadmap)

---

## Executive Summary

Think Tank's Real-Time Collaboration system represents the **largest feature gap in the consumer AI market**. While ChatGPT, Claude, and Gemini offer text-only, single-user experiences with at best asynchronous sharing, Think Tank delivers:

- **True real-time co-editing** with Yjs CRDT (Conflict-free Replicated Data Types)
- **Live presence indicators** showing who's in the conversation
- **Typing attribution** so you know who's contributing
- **Conversation branching** for parallel exploration of ideas
- **AI Roundtables** with multiple AI models debating in real-time
- **Knowledge Graph visualization** that builds as you collaborate
- **Guest access** without requiring account creation
- **Session recording and playback** for async review

This is not an incremental improvement—it's a category-defining capability that no competitor can match without 12-18 months of development.

---

## Why This Matters: The Market Gap

### The Problem with Current AI Platforms

Every major AI platform today operates on the same fundamental model: **one user, one conversation, one context**. This creates significant friction for teams:

| Scenario | ChatGPT/Claude/Gemini | Impact |
|----------|----------------------|--------|
| Team brainstorming | Share link, lose context | Ideas fragmented |
| Project planning | Copy-paste between chats | Information silos |
| Decision making | Sequential, not parallel | Slower decisions |
| Knowledge capture | Buried in individual chats | Institutional memory lost |

### The Think Tank Solution

Think Tank treats AI conversations as **collaborative workspaces**, not isolated chat threads:

| Capability | How It Works | Business Value |
|------------|--------------|----------------|
| Real-time sync | Yjs CRDT ensures all participants see the same state | No "which version is correct?" confusion |
| Presence awareness | Live indicators of who's active | Know when to jump in vs. wait |
| Conversation branching | Fork a conversation to explore alternatives | Test ideas without derailing the main thread |
| AI Roundtables | Multiple AI models debate a topic | Get diverse perspectives without prompt switching |
| Knowledge Graph | Visual concept map builds automatically | See the shape of your team's thinking |
| Guest access | Share a link, join instantly | Include stakeholders without IT friction |

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    COLLABORATION ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │   Client    │────▶│  WebSocket  │────▶│    Y.js     │        │
│  │  (React)    │     │   Gateway   │     │  Provider   │        │
│  └─────────────┘     └─────────────┘     └─────────────┘        │
│         │                   │                   │                │
│         │                   │                   ▼                │
│         │                   │           ┌─────────────┐          │
│         │                   │           │   Aurora    │          │
│         │                   │           │ PostgreSQL  │          │
│         │                   │           └─────────────┘          │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │  REST API   │────▶│  Lambda     │────▶│    S3       │        │
│  │  (Next.js)  │     │  Handlers   │     │  Storage    │        │
│  └─────────────┘     └─────────────┘     └─────────────┘        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Connection**: Client establishes WebSocket connection with JWT authentication
2. **Sync**: Yjs provider syncs local CRDT state with server
3. **Presence**: Heartbeats broadcast participant status every 30 seconds
4. **Messages**: Each message is a CRDT operation, ensuring conflict-free merge
5. **Persistence**: All state persisted to Aurora PostgreSQL for durability
6. **Media**: Attachments and recordings stored in S3 with signed URLs

### Key Technologies

| Component | Technology | Why This Choice |
|-----------|------------|-----------------|
| CRDT Engine | Yjs | Industry-leading CRDT library, used by Notion, Figma |
| WebSocket | API Gateway WebSocket | Managed, scales to millions |
| Database | Aurora PostgreSQL | ACID transactions, RLS for multi-tenancy |
| Object Storage | S3 | Unlimited scale, lifecycle policies |
| CDN | CloudFront | Global edge caching |
| Authentication | Cognito + Guest Tokens | Secure but friction-free |

---

## Core Features

### 1. Real-Time Presence System

**What It Does**: Shows who's currently in a collaboration session with live status updates.

**Technical Details**:
- WebSocket heartbeat every 30 seconds
- Presence broadcast to all participants
- Automatic "away" detection after 5 minutes of inactivity
- Color-coded avatars with initials for quick identification

**User Experience**:
```
┌─────────────────────────────────────────┐
│ 🟢 Alice (you)    │ Viewing            │
│ 🟢 Bob            │ Typing...          │
│ 🟡 Carol          │ Away (5m)          │
│ 🔴 David          │ Offline            │
└─────────────────────────────────────────┘
```

**Implementation Files**:
- Service: `lambda/shared/services/enhanced-collaboration.service.ts`
- WebSocket: `lambda/websocket/collaboration-handler.ts`
- UI: `components/collaboration/ParticipantsSidebar.tsx`

---

### 2. Typing Indicators with Attribution

**What It Does**: Shows when participants are typing, with their name and avatar visible.

**Technical Details**:
- Debounced typing events (250ms)
- Auto-clear after 3 seconds of no input
- Multiple simultaneous typers supported
- Animated indicator with participant's color

**User Experience**:
```
┌─────────────────────────────────────────┐
│ 💬 Bob and Carol are typing...         │
│ ●●●                                     │
└─────────────────────────────────────────┘
```

---

### 3. Conversation Branching

**What It Does**: Fork a conversation at any point to explore alternative directions without losing the original thread.

**Why It's Revolutionary**: No other AI platform offers this. When you're in a team brainstorm and someone says "what if we tried X instead?", you can literally branch the conversation and explore both paths simultaneously.

**Technical Details**:
- Git-like branching model with parent references
- Messages belong to specific branches
- Merge capability with AI-assisted conflict resolution
- Branch comparison view ("diff" between branches)

**User Experience**:
```
Main Branch
    │
    ├── Message 1: "Let's plan the product launch"
    │
    ├── Message 2: "AI: Here's a timeline..."
    │
    ├── 🔀 Branch: "Aggressive Timeline"
    │   ├── Message 3a: "What if we launch in 2 weeks?"
    │   └── Message 4a: "AI: That's tight but possible..."
    │
    └── Message 3: "Let's stick to the original plan"
        └── Message 4: "AI: Good choice, here's why..."
```

**Merge Flow**:
1. Select source branch
2. AI analyzes both branches for insights
3. Generates synthesis combining best ideas
4. Optional: keep branches as historical record

**Implementation Files**:
- Service: `lambda/shared/services/enhanced-collaboration.service.ts` (createBranch, mergeBranch)
- UI: `components/collaboration/BranchVisualization.tsx`
- API: `lambda/thinktank/enhanced-collaboration.ts`

---

### 4. Guest Access (No Account Required)

**What It Does**: Generate a secure invite link that allows anyone to join a collaboration session without creating an account.

**Why It Matters**: Reduces friction for:
- Client meetings
- Cross-company collaboration
- Quick stakeholder input
- User research sessions

**Technical Details**:
- Cryptographically secure invite tokens (UUID v4 + HMAC)
- Configurable expiration (1 hour to 30 days)
- Usage limits (single-use or unlimited)
- Permission scoping (viewer, contributor, full access)
- Audit trail for all guest actions

**User Experience**:
```
Share this link with your collaborators:
┌─────────────────────────────────────────┐
│ https://thinktank.app/join/abc123xyz   │
│                                         │
│ ⏱️ Expires: In 7 days                   │
│ 👥 Uses: Unlimited                      │
│ 🔒 Access: Contributor                  │
│                                         │
│ [Copy Link]  [Create New]  [Revoke]    │
└─────────────────────────────────────────┘
```

**Implementation Files**:
- Service: `createGuestInvite`, `joinAsGuest`, `getSessionGuests`
- UI: `components/collaboration/dialogs/InviteDialog.tsx`

---

### 5. AI Facilitator

**What It Does**: An AI moderator that helps guide collaborative conversations, suggests discussion topics, identifies when the group is stuck, and synthesizes key decisions.

**Facilitator Behaviors**:

| Behavior | Trigger | Action |
|----------|---------|--------|
| Topic suggestion | Silence > 2 minutes | "Perhaps we should discuss..." |
| Consensus detection | 3+ participants agree | "It sounds like we've agreed on..." |
| Conflict resolution | Opposing viewpoints | "Let me summarize both perspectives..." |
| Time awareness | Meeting halfway point | "We have 15 minutes left. Key open items..." |
| Action extraction | Decision language detected | "I'm capturing this as an action item..." |

**Configuration Options**:
- Intervention frequency (passive, balanced, active)
- Personality style (formal, casual, Socratic)
- Focus areas (decisions, actions, brainstorming)
- Model selection (which AI powers the facilitator)

**Implementation Files**:
- Service: `enableFacilitator`, `getFacilitatorConfig`
- UI: `components/collaboration/dialogs/FacilitatorSettingsDialog.tsx`

---

### 6. AI Roundtables

**What It Does**: Summon multiple AI models to debate a topic, each bringing their unique perspective and capabilities.

**Why It's Powerful**: Instead of asking one AI and accepting its answer, you can:
- Get diverse perspectives (Claude's nuance, GPT's breadth, Gemini's reasoning)
- Identify consensus across models
- Spot disagreements that warrant human judgment
- Avoid single-model bias

**Debate Styles**:

| Style | Description | Best For |
|-------|-------------|----------|
| Collaborative | Models build on each other's ideas | Brainstorming, ideation |
| Adversarial | Models challenge each other | Decision validation, risk assessment |
| Socratic | Question-based exploration | Learning, complex topics |
| Brainstorm | Free-form ideation | Creative projects |
| Devil's Advocate | Counter-arguments for every point | Stress-testing decisions |

**Roundtable Flow**:
1. Define the topic and select participating models
2. Choose debate style and number of rounds
3. AI models take turns contributing
4. Each can reference and respond to previous contributions
5. Final synthesis summarizes consensus and disagreements

**Output Structure**:
```json
{
  "synthesis": "After 3 rounds of debate, the models agreed that...",
  "consensusPoints": [
    "Customer acquisition should prioritize organic channels",
    "MVP scope should include core features only"
  ],
  "disagreementPoints": [
    "Pricing strategy: Claude favors freemium, GPT-4 suggests premium-only"
  ],
  "recommendations": [
    "Test both pricing models with user research before deciding"
  ]
}
```

**Implementation Files**:
- Service: `createRoundtable`, `addRoundtableContribution`, `completeRoundtable`
- UI: `components/collaboration/AIRoundtableView.tsx`

---

### 7. Knowledge Graph Visualization

**What It Does**: Automatically builds a visual concept map as the conversation progresses, showing how ideas connect.

**Node Types**:

| Type | Icon | Description |
|------|------|-------------|
| Concept | 🔵 | Core ideas and topics |
| Question | 🟡 | Open questions to resolve |
| Decision | 🟢 | Decisions that have been made |
| Insight | 🟣 | Key realizations or aha moments |
| Action | 🔴 | Tasks or next steps |
| Person | 🩷 | People mentioned or responsible |

**Edge Types**:

| Type | Visual | Meaning |
|------|--------|---------|
| relates_to | Solid gray | General relationship |
| leads_to | Solid green | Causal or sequential |
| contradicts | Dashed red | Conflicting ideas |
| supports | Solid blue | Supporting evidence |
| defines | Solid purple | Definition or specification |
| questions | Dashed amber | Raises questions about |

**Interactive Features**:
- Zoom, pan, and explore
- Click nodes to see related messages
- Add nodes manually
- Draw connections between concepts
- Filter by node type
- Export as image or JSON

**Auto-Generation**: The system uses NLP to:
- Extract key concepts from messages
- Identify relationships between concepts
- Suggest node types based on context
- Update the graph in real-time

**Implementation Files**:
- Service: `getOrCreateKnowledgeGraph`, `addNode`, `addEdge`
- UI: `components/collaboration/KnowledgeGraphVisualization.tsx`

---

### 8. Session Recording and Playback

**What It Does**: Record collaboration sessions for later review, with full playback including message timing, presence changes, and AI interactions.

**Recording Captures**:
- All messages with exact timestamps
- Participant join/leave events
- Typing indicators (reconstructed)
- Branch creation and merges
- AI model invocations
- Media attachments

**Playback Features**:
- Variable speed (0.5x to 4x)
- Jump to specific timestamp
- Search within recording
- Export transcript
- Share specific moments via timestamp links

**Use Cases**:
- Onboard team members by showing past decisions
- Review complex discussions at your own pace
- Create training materials from real sessions
- Audit trail for compliance

**Implementation Files**:
- Service: `startRecording`, `stopRecording`, `addRecordingEvent`
- UI: `components/collaboration/panels/PlaybackPanel.tsx`

---

### 9. Voice and Media Notes

**What It Does**: Record voice notes, share images, and attach files directly in the collaboration.

**Supported Media**:
- Voice notes (MP3, WAV, up to 10 minutes)
- Images (JPEG, PNG, GIF, WebP, up to 25MB)
- Documents (PDF, DOCX, XLSX, up to 50MB)
- Code snippets (syntax highlighted)

**AI Processing**:
- Voice notes: Transcribed automatically
- Images: Described by vision models
- Documents: Summarized and searchable
- Code: Explained and annotated

**Implementation Files**:
- Service: `uploadMediaNote`, `getMediaNoteUrl`
- UI: Voice recording in `RealTimeChat.tsx`

---

### 10. Annotations and Reactions

**What It Does**: React to messages and add annotations without cluttering the main conversation.

**Reaction Types**:
- Quick emoji reactions (👍 ❤️ 😂 😮 😢)
- Custom reactions
- Threaded replies
- Highlight and annotate

**Annotation Types**:
- Inline comments (like Google Docs)
- Bookmark for later
- Flag for review
- Link to external resources

**Implementation Files**:
- Service: `createAnnotation`
- UI: Reactions in `RealTimeChat.tsx`

---

## Technical Implementation

### Database Schema

The collaboration system uses the following core tables:

```sql
-- Collaboration Sessions
CREATE TABLE collaboration_sessions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    conversation_id UUID REFERENCES conversations(id),
    status session_status DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Participants
CREATE TABLE session_participants (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES collaboration_sessions(id),
    user_id UUID REFERENCES users(id),
    role participant_role DEFAULT 'contributor',
    color VARCHAR(7) NOT NULL,
    is_online BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guest Invites
CREATE TABLE collaboration_guest_invites (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    session_id UUID NOT NULL REFERENCES collaboration_sessions(id),
    token VARCHAR(255) UNIQUE NOT NULL,
    permissions JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    max_uses INT,
    use_count INT DEFAULT 0,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guests (no account required)
CREATE TABLE collaboration_guests (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES collaboration_sessions(id),
    invite_id UUID REFERENCES collaboration_guest_invites(id),
    display_name VARCHAR(100) NOT NULL,
    guest_token VARCHAR(255) UNIQUE NOT NULL,
    color VARCHAR(7) NOT NULL,
    is_online BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation Branches
CREATE TABLE conversation_branches (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    session_id UUID NOT NULL REFERENCES collaboration_sessions(id),
    parent_branch_id UUID REFERENCES conversation_branches(id),
    source_message_id UUID,
    name VARCHAR(255) NOT NULL,
    status branch_status DEFAULT 'active',
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Roundtables
CREATE TABLE ai_roundtables (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    session_id UUID NOT NULL REFERENCES collaboration_sessions(id),
    topic TEXT NOT NULL,
    debate_style VARCHAR(50) NOT NULL,
    participating_models TEXT[] NOT NULL,
    max_rounds INT DEFAULT 3,
    current_round INT DEFAULT 0,
    status roundtable_status DEFAULT 'active',
    synthesis TEXT,
    consensus_points JSONB DEFAULT '[]',
    disagreement_points JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge Graph
CREATE TABLE knowledge_graphs (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES collaboration_sessions(id),
    nodes JSONB DEFAULT '[]',
    edges JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Recordings
CREATE TABLE session_recordings (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES collaboration_sessions(id),
    status recording_status DEFAULT 'recording',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INT,
    s3_key VARCHAR(500)
);
```

### WebSocket Protocol

**Connection**:
```
wss://ws.thinktank.app/collaboration?token=<JWT>&sessionId=<UUID>
```

**Message Types**:

| Type | Direction | Payload |
|------|-----------|---------|
| `join` | Client→Server | `{ sessionId, userId }` |
| `leave` | Client→Server | `{ sessionId }` |
| `presence` | Bidirectional | `{ participants: [...] }` |
| `typing_start` | Client→Server | `{ sessionId }` |
| `typing_stop` | Client→Server | `{ sessionId }` |
| `typing_indicator` | Server→Client | `{ userId, isTyping }` |
| `message` | Bidirectional | `{ id, content, role, ... }` |
| `yjs_sync` | Bidirectional | `{ update: Uint8Array }` |
| `branch_created` | Server→Client | `{ branchId, name, ... }` |
| `roundtable_update` | Server→Client | `{ roundtableId, ... }` |

### CRDT Integration

We use Yjs for conflict-free synchronization:

```typescript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Create a Yjs document for the session
const ydoc = new Y.Doc();

// Connect to the server
const provider = new WebsocketProvider(
  'wss://ws.thinktank.app',
  sessionId,
  ydoc
);

// Shared data structures
const yMessages = ydoc.getArray('messages');
const yPresence = ydoc.getMap('presence');
const yBranches = ydoc.getMap('branches');

// Listen for changes
yMessages.observe((event) => {
  // Handle new messages
  event.changes.added.forEach((item) => {
    const message = item.content.getContent()[0];
    renderMessage(message);
  });
});

// Add a message (automatically synced to all clients)
yMessages.push([{
  id: generateId(),
  content: 'Hello, team!',
  userId: currentUser.id,
  timestamp: Date.now()
}]);
```

---

## Competitive Analysis

### Feature-by-Feature Comparison

| Feature | ChatGPT | Claude | Gemini | Think Tank |
|---------|---------|--------|--------|------------|
| **Real-time sync** | ❌ | ❌ | ❌ | ✅ Yjs CRDT |
| **Presence indicators** | ❌ | ❌ | ❌ | ✅ Live |
| **Typing attribution** | ❌ | ❌ | ❌ | ✅ Animated |
| **Conversation branching** | ❌ | ❌ | ❌ | ✅ Git-like |
| **Guest access** | ❌ | ❌ | ❌ | ✅ No signup |
| **AI Facilitator** | ❌ | ❌ | ❌ | ✅ Configurable |
| **Multi-model roundtables** | ❌ | ❌ | ❌ | ✅ 5 styles |
| **Knowledge graph** | ❌ | ❌ | ❌ | ✅ Auto-build |
| **Session recording** | ❌ | ❌ | ❌ | ✅ Full playback |
| **Voice notes** | ✅ | ❌ | ✅ | ✅ Transcribed |
| **Share conversations** | ✅ Async | ✅ Async | ❌ | ✅ Real-time |

### Competitive Moat Depth

| Moat | Time to Replicate | Why It's Hard |
|------|-------------------|---------------|
| Yjs CRDT integration | 6-9 months | Deep integration with AI systems, edge cases |
| Guest access | 3-6 months | Security, abuse prevention, scaling |
| AI Roundtables | 9-12 months | Multi-model orchestration, synthesis |
| Knowledge Graph | 6-9 months | NLP extraction, visualization |
| Session Recording | 3-6 months | Storage, playback, search |

**Total estimated time for a competitor to reach feature parity: 12-18 months**

---

## Marketing & Sales Points

### Elevator Pitch (30 seconds)

> "Think Tank is the only AI platform where your team can think together. While ChatGPT and Claude are single-player experiences, Think Tank lets your entire team collaborate in real-time—like Google Docs for AI conversations. Branch ideas, have AI models debate, and capture everything in a living knowledge graph. No more copy-pasting between chat windows or wondering 'what did we decide?'"

### Key Differentiators (Bullet Points)

- **Real-time collaboration**: Multiple users in the same AI conversation, simultaneously
- **Conversation branching**: Explore "what if" scenarios without losing the main thread
- **AI Roundtables**: Let Claude, GPT-4, and Gemini debate—you get the synthesis
- **Guest access**: Share a link, they're in—no signup required
- **Knowledge graphs**: See your team's thinking visualized
- **Session recording**: Playback any collaboration, onboard new team members

### Use Case Stories

**1. Product Team Sprint Planning**

> "Before Think Tank, our sprint planning meant one person sharing their screen with ChatGPT while everyone else watched. Now, all 8 engineers are in the same session. When we hit a technical decision, we branch the conversation and have two teams explore different approaches. The AI facilitator keeps us on track and captures action items. We cut planning time by 40%."
> — VP Engineering, Series B SaaS

**2. Investor Due Diligence**

> "We needed to analyze a target company with our legal team, finance team, and external advisors. With Think Tank, everyone joined via guest links—no accounts needed. We had Claude and GPT-4 debate the key risks in a roundtable. The knowledge graph showed us exactly how the issues connected. What used to take 3 weeks of back-and-forth took 4 hours."
> — Managing Partner, PE Fund

**3. Customer Research Synthesis**

> "After 50 user interviews, our team was drowning in notes. We uploaded everything to a Think Tank session and collaborated on synthesis. The AI extracted themes while we debated interpretations. The branching feature let us explore contradictory findings without losing context. Our CPO said it was 'like having a research assistant with perfect memory.'"
> — Head of Research, Consumer App

### Sales Objection Handling

| Objection | Response |
|-----------|----------|
| "We already use ChatGPT Teams" | "ChatGPT Teams is async—you share links, not experiences. Think Tank is real-time. You'll see your colleagues typing, branch conversations, and have AI models debate. It's the difference between email and Google Docs." |
| "It's expensive" | "Consider the cost of miscommunication. A typical enterprise loses 40+ hours/week to 'which version is correct?' and 'what did we decide?' Think Tank eliminates that with real-time sync and knowledge graphs." |
| "Security concerns" | "We're SOC2 Type II certified, HIPAA compliant, and GDPR ready. All data is encrypted at rest and in transit. Guest access uses short-lived tokens with audit trails. Enterprise customers can bring their own encryption keys." |
| "Learning curve" | "If your team can use Slack and Google Docs, they can use Think Tank. The interface is familiar, but with AI superpowers. We offer white-glove onboarding for enterprise." |

---

## Security & Compliance

### Data Protection

| Layer | Protection |
|-------|------------|
| Transport | TLS 1.3 for all connections |
| At Rest | AES-256-GCM encryption |
| Keys | AWS KMS with tenant isolation |
| Access | JWT + fine-grained RBAC |
| Audit | Full audit trail, tamper-evident |

### Compliance Certifications

- **SOC2 Type II**: Annual audit
- **HIPAA**: BAA available for healthcare
- **GDPR**: Right to erasure, data portability
- **ISO 27001**: In progress

### Guest Access Security

- Cryptographically random tokens (UUID v4 + HMAC-SHA256)
- Configurable expiration (1 hour minimum, 30 days maximum)
- IP-based rate limiting
- Action audit trail for all guest activities
- Session owner can revoke access instantly

---

## Roadmap

### Q1 2026 (Current)
- ✅ Real-time sync with Yjs CRDT
- ✅ Presence and typing indicators
- ✅ Conversation branching
- ✅ Guest access
- ✅ AI Facilitator
- ✅ AI Roundtables
- ✅ Knowledge Graph
- ✅ Session recording

### Q2 2026
- 🔄 Video/audio calls within sessions
- 🔄 Whiteboard integration
- 🔄 Mobile apps (iOS/Android)
- 🔄 Slack/Teams integration

### Q3 2026
- 📋 Templates library (meeting types, workflows)
- 📋 Custom AI personas for facilitation
- 📋 Advanced analytics dashboard
- 📋 API for third-party integrations

### Q4 2026
- 📋 Cross-organization collaboration
- 📋 AI-generated session summaries
- 📋 Automated follow-up actions
- 📋 Enterprise SSO (SAML, OIDC)

---

## Appendix: Implementation File Reference

### Backend Services

| File | Purpose |
|------|---------|
| `lambda/shared/services/enhanced-collaboration.service.ts` | Core collaboration logic |
| `lambda/shared/services/workflow/crdt-workflow.service.ts` | CRDT operations |
| `lambda/thinktank/enhanced-collaboration.ts` | API handler |
| `lambda/websocket/collaboration-handler.ts` | WebSocket events |

### Frontend Components

| File | Purpose |
|------|---------|
| `components/collaboration/RealTimeChat.tsx` | Chat with reactions, replies |
| `components/collaboration/ParticipantsSidebar.tsx` | Presence display |
| `components/collaboration/BranchVisualization.tsx` | Branch tree/timeline |
| `components/collaboration/AIRoundtableView.tsx` | Multi-model debates |
| `components/collaboration/KnowledgeGraphVisualization.tsx` | Concept mapping |
| `components/collaboration/dialogs/CreateSessionDialog.tsx` | Session creation |
| `components/collaboration/dialogs/InviteDialog.tsx` | Guest invites |
| `components/collaboration/dialogs/FacilitatorSettingsDialog.tsx` | AI facilitator config |

### Database Migrations

| File | Purpose |
|------|---------|
| `migrations/056_enhanced_collaboration.sql` | Core collaboration tables |
| `migrations/057_collaboration_branches.sql` | Branching support |
| `migrations/058_ai_roundtables.sql` | Roundtable tables |
| `migrations/059_knowledge_graphs.sql` | Graph storage |

---

*This document is maintained by the RADIANT Platform Team. For questions, contact platform@radiant.ai*
---
