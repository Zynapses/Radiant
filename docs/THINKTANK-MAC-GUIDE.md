# Think Tank (Mac) — User Guide

> **Version**: 1.0.0
> **App Version**: macOS 14.0+ (Sonoma)
> **Last Updated**: 2026-02-08
> **Platform**: Native macOS (SwiftUI)

---

## Table of Contents

1. [Welcome](#1-welcome)
2. [Getting Started](#2-getting-started)
3. [The Interface](#3-the-interface)
4. [Conversations](#4-conversations)
5. [Chat Features](#5-chat-features)
6. [My Rules](#6-my-rules)
7. [Advanced Mode](#7-advanced-mode)
8. [AXIOM Forge](#8-axiom-forge)
9. [Brain Plans](#9-brain-plans)
10. [Time Machine](#10-time-machine)
11. [Crucible Deliberation](#11-crucible-deliberation)
12. [Voice Input](#12-voice-input)
13. [File Attachments](#13-file-attachments)
14. [Artifacts](#14-artifacts)
15. [History](#15-history)
16. [Profile & Analytics](#16-profile--analytics)
17. [Settings](#17-settings)
18. [Keyboard Shortcuts](#18-keyboard-shortcuts)
19. [Troubleshooting](#19-troubleshooting)
20. [Platform Differences from Web](#20-platform-differences-from-web)

---

## 1. Welcome

Think Tank (Mac) is the native macOS client for RADIANT's Think Tank AI platform. It provides the same powerful AI conversation capabilities as the web app, built with SwiftUI for a fast, native macOS experience.

**Key advantages of the Mac app:**
- **Native performance** — Built with SwiftUI, launches instantly
- **macOS integration** — Keyboard shortcuts, menu bar, native file dialogs, Notification Center
- **Glassmorphism UI** — Translucent materials using macOS vibrancy
- **Offline settings** — Preferences persist locally via UserDefaults
- **Secure auth** — Token storage via macOS Keychain

---

## 2. Getting Started

### System Requirements

- macOS 14.0 (Sonoma) or later
- Apple Silicon or Intel Mac
- Internet connection (for API access)
- Microphone access (optional, for voice input)

### First Launch

1. Open Think Tank from your Applications folder or Launchpad
2. The app opens to the **Welcome screen** with quick actions
3. Configure your API server URL in **Settings** (⌘,) if not using the default
4. Sign in with your RADIANT credentials
5. Start chatting!

### Connecting to Your Server

Go to **Think Tank > Settings > General > API** and enter your RADIANT API base URL (e.g., `https://api.radiant.yourcompany.com`).

---

## 3. The Interface

Think Tank (Mac) uses a **NavigationSplitView** layout:

```
+------------------+------------------------------------------+
|                  |                                          |
|    SIDEBAR       |              DETAIL VIEW                 |
|                  |                                          |
|  [New Chat]      |  [Header Bar]                           |
|  [Search]        |  [Domain] [Model] [Advanced] [Focus]    |
|  [Nav Sections]  |                                          |
|  [Conversations] |  [Messages Area]                         |
|                  |                                          |
|                  |  [Chat Input]                            |
+------------------+------------------------------------------+
```

### Sidebar
- **New Chat** button (⌘N)
- **Search** conversations
- **Navigation sections**: My Rules, History, Artifacts, Settings, Profile
- **Conversations** grouped by date (Today, Yesterday, This Week, etc.)

### Detail View
Changes based on the selected section — Chat, Rules, History, Artifacts, Settings, or Profile.

---

## 4. Conversations

### Creating a Conversation
- Click **New Chat** in the sidebar, or press **⌘N**
- Type your message and press **Return**

### Managing Conversations
- **Rename**: Hover over a conversation, click the pencil icon
- **Delete**: Hover over a conversation, click the trash icon
- **Search**: Use the search bar at the top of the sidebar
- **Favorites**: Starred conversations show a yellow star icon

### Conversation Grouping
Conversations are automatically grouped:
- **Today** — conversations updated today
- **Yesterday** — updated yesterday
- **This Week** — within the last 7 days
- **This Month** — within the last 30 days
- **Older** — everything else

---

## 5. Chat Features

### Sending Messages
- Type in the input area at the bottom
- Press **Return** to send
- Press **Shift+Return** for a new line
- Click the send button (arrow icon)

### Streaming Responses
Responses stream in real-time via Server-Sent Events. You'll see a typing indicator and a blinking cursor as the AI generates its response. Toggle streaming in Settings > General.

### Model Selection
Click the model selector in the header bar to choose which AI model to use. Models are grouped by category and show capability badges.

### Domain Selection
In Advanced Mode, a domain selector appears. Choose **Auto** for automatic domain detection, or manually select a domain (e.g., Medical, Legal, Engineering).

### Message Actions
Hover over an assistant message to reveal:
- **Copy** — copies the message to clipboard
- **Thumbs Up/Down** — rate the response
- **Regenerate** — get a new response
- **Brain Plan** — view the AI's reasoning (Advanced Mode)

### Message Metadata
In Advanced Mode, messages show:
- Model used
- Token count
- Latency (ms)
- Cost estimate ($)

---

## 6. My Rules

Personalize how the AI responds to you with rules.

### Creating Rules
1. Go to **My Rules** in the sidebar
2. Click **Add Rule**
3. Choose a rule type (Restriction, Preference, Format, Source, Tone, Topic, Privacy)
4. Write your rule text
5. Click **Save Rule**

### Rule Presets
Browse curated rule presets by clicking **Presets**. Categories include professional, academic, creative, and more. Click the + button to add a preset to your rules.

### Managing Rules
- **Toggle** — enable/disable rules with the switch
- **Edit** — click the pencil icon to modify
- **Delete** — click the trash icon to remove
- **Priority** — set priority (1-100) to control which rules take precedence

---

## 7. Advanced Mode

Toggle Advanced Mode with the brain icon in the header bar, or press **⇧⌘D**.

Advanced Mode reveals:
- **Message metadata** (model, tokens, latency, cost)
- **Domain selector** in the header
- **Time Machine** button
- **AXIOM Forge** button
- **Brain Plan viewer** on messages

---

## 8. AXIOM Forge

AXIOM Forge is a 4-step prompt optimization workflow.

### Steps
1. **Classify** — AXIOM detects the domain of your prompt
2. **Clarify** — AXIOM asks targeted questions to refine intent
3. **Compile** — Your answers are compiled into an optimized prompt
4. **Route** — The best model is selected based on scoring

### Using AXIOM
1. Click the wand icon in the header (Advanced Mode)
2. Enter your prompt
3. Answer clarification questions
4. Review model scores and the compiled prompt
5. Click **Use This Prompt** to copy it

---

## 9. Brain Plans

Brain Plans show the AI's decision-making process.

### What You See
- **Orchestration mode** (Thinking, Extended Thinking, Coding, Creative, etc.)
- **Domain detection** with confidence score
- **Selected model** and reasoning
- **Execution steps** with timing
- **Spend Governor** status and savings

### Accessing Brain Plans
Click the brain icon on any assistant message (visible in Advanced Mode).

---

## 10. Time Machine

Scrub through conversation state snapshots.

### Features
- **Timeline** — visual track of all snapshots
- **Playback** — auto-play through snapshots
- **Bookmarks** — mark important points
- **Branches** — create a new conversation branch from any snapshot
- **Restore** — revert the conversation to a previous state

### Using Time Machine
1. Click the clock icon in the header (Advanced Mode)
2. Browse snapshots in the list or timeline
3. Click a snapshot to preview
4. Use **Restore** to revert, or **Branch** to fork

---

## 11. Crucible Deliberation

View multi-model verification when the AI cross-checks its answers.

### What You See
- Questions asked between models
- Answers and quality scores
- Circular citation detection warnings
- Configuration (max questions, cost mode)

---

## 12. Voice Input

Speak instead of typing using the built-in voice transcription.

### Requirements
- Microphone access (grant in System Settings > Privacy & Security > Microphone)
- Active internet connection (uses Whisper API)

### Using Voice
1. Click the microphone icon in the input area
2. Click the red record button
3. Speak your message
4. Click the green checkmark to transcribe
5. The transcribed text appears in the input area

### Audio Level Indicator
A visual bar display shows your audio levels in real-time during recording.

---

## 13. File Attachments

Attach files to your messages for context.

### Supported File Types
- **Documents**: PDF, TXT, RTF, HTML
- **Images**: PNG, JPEG, GIF, SVG, WebP
- **Data**: CSV, JSON, XML

### Maximum File Size
25 MB per file

### How to Attach
- Click the **paperclip icon** in the input area
- Click **Browse Files** to use the native file picker
- **Drag and drop** files into the attachment area
- Files appear as chips above the input; click X to remove

---

## 14. Artifacts

View code, documents, charts, and other generated content.

### Browsing Artifacts
1. Go to **Artifacts** in the sidebar
2. Filter by type: All, Code, Document, Image, Chart
3. Click an artifact to preview in the detail pane

### Artifact Actions
- **Copy** — copy content to clipboard
- **Save** — export to a file using the native Save dialog

---

## 15. History

Browse and search all your past conversations.

### Features
- **Search** by title or message content
- **Sort** by newest, oldest, or most messages
- **Domain filter** — filter by conversation domain
- **Quick open** — click to jump to any conversation

---

## 16. Profile & Analytics

### Overview Tab
- Total conversations, messages, tokens, cost
- Achievement count
- Favorite models
- Top domains

### Achievements Tab
- View all achievements with progress
- Rarity levels: Common, Uncommon, Rare, Epic, Legendary
- Points system

### Usage Tab
- Daily activity chart (last 30 days)

---

## 17. Settings

Access via **Think Tank > Settings** (⌘,) or the sidebar.

### General
- **AI Personality** — Auto, Professional, Subtle, Expressive, Playful
- **Streaming** — toggle real-time response streaming
- **Notifications** — enable/disable
- **API Server URL** — configure your RADIANT endpoint

### Display
- **Compact mode** — reduce spacing
- **Show token count** — display in message metadata
- **Show cost estimate** — display in message metadata
- **Sound effects** — toggle

### Voice
- **Enable voice input** — toggle microphone access
- **Open System Settings** — configure microphone permissions

### Shortcuts
- View all keyboard shortcuts
- Enable/disable keyboard shortcuts globally

### Privacy
- Data storage information
- Clear local settings

---

## 18. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **⌘N** | New Conversation |
| **⇧⌘D** | Toggle Advanced Mode |
| **⇧⌘F** | Toggle Focus Mode |
| **⌘\\** | Toggle Sidebar |
| **⌘,** | Settings |
| **Return** | Send Message |
| **⇧Return** | New Line in Input |

---

## 19. Troubleshooting

### Cannot Connect to Server
1. Check your API URL in Settings > General > API
2. Verify your internet connection
3. Ensure the RADIANT server is running
4. Check if your authentication token has expired

### Microphone Not Working
1. Go to System Settings > Privacy & Security > Microphone
2. Ensure Think Tank has microphone access
3. Check that no other app is using the microphone exclusively

### Slow Performance
1. Close unused conversations
2. Disable streaming if experiencing network issues
3. Check Activity Monitor for resource usage

### Messages Not Loading
1. Check your internet connection
2. Try creating a new conversation
3. Restart the app

---

## 20. Platform Differences from Web

Think Tank (Mac) provides the same core functionality as the web app with platform-appropriate adaptations:

| Feature | Web | Mac |
|---------|-----|-----|
| Styling | Tailwind CSS + glassmorphism | SwiftUI `.ultraThinMaterial` |
| Animations | Framer Motion springs | SwiftUI `.spring()` animation |
| State Management | Zustand stores | `@Observable` / `@Published` |
| Clipboard | `navigator.clipboard` | `NSPasteboard` |
| File Picker | `<input type="file">` | `NSOpenPanel` |
| Audio Recording | `MediaRecorder` | `AVAudioEngine` |
| Streaming | `ReadableStream` | `URLSession.bytes` |
| Settings Storage | `localStorage` | `UserDefaults` |
| Navigation | Next.js file routing | `NavigationSplitView` |

### Excluded from Mac App
- **Polymorphic Interface** — The morphing UI (Data Grid, Chart, Kanban, etc.) is excluded from Mac scope
- **Admin features** — Admin dashboard remains web-only

For the complete portability breakdown, see `docs/THINKTANK-MAC-PORTABILITY-MANIFEST.md`.

---

*This guide is maintained under the Think Tank Dual-Platform Sync Policy (`/.windsurf/workflows/thinktank-dual-platform.md`). Any change to the Mac app requires a corresponding update to this document.*
