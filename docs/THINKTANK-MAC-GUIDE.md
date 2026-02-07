# Think Tank (Mac) — Native macOS Application Guide

> **Classification**: RADIANT INTERNAL // ENGINEERING  
> **Version**: 1.0.0 | **Date**: February 6, 2026  
> **Status**: PRE-BUILD — Architecture & Sync Documentation  
> **App Location**: `apps/thinktank-mac/` (planned)  
> **Mirrors**: Think Tank Web (`apps/admin-dashboard/`)  
> **Requires**: macOS 13.0+ (Ventura), Swift 5.9+, Xcode 15+

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
| 1 | **Conversations** | `conversations.ts` | Sidebar list + Chat view | NavigationSplitView | 🔲 Planned |
| 2 | **Chat Streaming** | SSE via fetch | SSE message stream | URLSession.bytes + AsyncSequence | 🔲 Planned |
| 3 | **Brain Plan Viewer** | `brain-plan.ts` + component | Inspector panel | Detail view with step progress | 🔲 Planned |
| 4 | **Domain Detection** | `domain-modes.ts` | Toolbar indicator | Popover with field/domain/subspecialty | 🔲 Planned |
| 5 | **Model Selection** | `models.ts`, `model-categories.ts` | Toolbar picker | Menu/Picker with category grouping | 🔲 Planned |
| 6 | **My Rules** | `my-rules.ts` | Settings tab or sidebar section | Form with rule editor | 🔲 Planned |
| 7 | **User Context/Memory** | `user-context.ts` | Inspector section | Read-only profile summary | 🔲 Planned |
| 8 | **Settings/Preferences** | `settings.ts`, `preferences.ts` | macOS Settings window | Settings scene (SwiftUI) | 🔲 Planned |
| 9 | **Authentication** | Cognito web | Cognito Swift | ASWebAuthenticationSession or Amplify | 🔲 Planned |

### Tier 2: Advanced Features (Build Second)

| # | Web Feature | Web Location | Mac Equivalent | Swift Pattern | Status |
|---|-------------|-------------|----------------|---------------|--------|
| 10 | **Delight System** | Admin config | Personality in responses | Inline display (no config UI) | 🔲 Planned |
| 11 | **Time Machine** | `time-travel.ts` | Conversation branching | Tree view or timeline | 🔲 Planned |
| 12 | **Council of Rivals** | `council-of-rivals.ts` | Multi-model deliberation | Split view with model columns | 🔲 Planned |
| 13 | **Flash Facts** | `flash-facts.ts` | Quick knowledge cards | Popover or sheet | 🔲 Planned |
| 14 | **Grimoire** | `grimoire.ts` | Procedural memory | List with detail | 🔲 Planned |
| 15 | **Sentinel Agents** | `sentinel-agents.ts` | Background monitors | Menu bar status + notifications | 🔲 Planned |
| 16 | **Economic Governor** | `economic-governor.ts` | Cost awareness | Badge/indicator in toolbar | 🔲 Planned |
| 17 | **Artifact Engine** | `artifact-engine.ts` | Code/document viewer | Syntax-highlighted view (NSTextView) | 🔲 Planned |
| 18 | **Ideas** | `ideas.ts` | Idea capture | Quick note sheet | 🔲 Planned |
| 19 | **Ratings** | `ratings.ts` | Response rating | Inline thumbs up/down | 🔲 Planned |
| 20 | **File Conversion** | `file-conversion.ts` | Drag-and-drop files | NSDocument + UTType | 🔲 Planned |

### Tier 3: Specialized Features (Build Third)

| # | Web Feature | Web Location | Mac Equivalent | Swift Pattern | Status |
|---|-------------|-------------|----------------|---------------|--------|
| 21 | **Concurrent Execution** | `concurrent-execution.ts` | Parallel model queries | Task groups with progress | 🔲 Planned |
| 22 | **Structure from Chaos** | `structure-from-chaos.ts` | Auto-organize | Sheet with results | 🔲 Planned |
| 23 | **Enhanced Collaboration** | `enhanced-collaboration.ts` | Real-time collab | WebSocket + conflict resolution | 🔲 Planned |
| 24 | **Derivation History** | `derivation-history.ts` | Reasoning trace | Expandable tree | 🔲 Planned |
| 25 | **Decision Artifacts** | `decision-artifacts.ts` | Decision records | Table with detail | 🔲 Planned |
| 26 | **Living Parchment** | `living-parchment.ts` | Living documents | Rich text editor | 🔲 Planned |
| 27 | **Shadow Testing** | `shadow-testing.ts` | A/B model comparison | Side-by-side view | 🔲 Planned |
| 28 | **Security Signals** | `security-signals.ts` | Safety indicators | Status bar items | 🔲 Planned |
| 29 | **DIA** | `dia.ts` | Document intelligence | Quick Look preview | 🔲 Planned |
| 30 | **LIVS Workflow** | `livs-workflow.ts` | Quality control modes | Toolbar segment | 🔲 Planned |
| 31 | **Crucible** | `crucible.ts` | Stress testing | Sheet with results | 🔲 Planned |
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
