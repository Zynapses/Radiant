# Think Tank User Guide

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
