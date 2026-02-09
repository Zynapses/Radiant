# Think Tank — Mac Portability Manifest

> **Version**: 1.0.0
> **Last Updated**: 2026-02-08
> **Policy**: `/.windsurf/workflows/thinktank-dual-platform.md`

This document is the **authoritative record** of every Think Tank web feature, its Mac portability status, and the technology adaptation required. It MUST be updated whenever a feature is added, removed, or changed on either platform.

---

## Feature Parity Matrix

### Legend

| Status | Meaning |
|--------|---------|
| ✅ Ported | Feature exists on Mac with full parity |
| 🔄 Adapted | Feature exists on Mac with platform-appropriate adaptation |
| ❌ Excluded | Feature intentionally excluded from Mac scope |
| 🔲 Planned | Feature exists on web, Mac implementation planned |
| ⚠️ Partial | Feature partially ported, gaps documented below |

---

### Tier 1: Core Features (Must Have)

| # | Feature | Web | Mac | Status | Notes |
|---|---------|-----|-----|--------|-------|
| 1 | Chat Interface | `ModernChatInterface.tsx` | `ChatView.swift` | ✅ Ported | Full parity |
| 2 | Message Bubbles | `MessageBubble.tsx` | `MessageBubbleView.swift` | ✅ Ported | Full parity |
| 3 | Chat Input | `ChatInput.tsx` | `ChatInputView.swift` | ✅ Ported | Full parity |
| 4 | Sidebar / Navigation | `Sidebar.tsx` | `SidebarView.swift` | ✅ Ported | NavigationSplitView |
| 5 | Conversation List | `Sidebar.tsx` | `SidebarView.swift` | ✅ Ported | Grouped by date |
| 6 | Conversation CRUD | `chat.ts` (API) | `ChatService.swift` | ✅ Ported | Full parity |
| 7 | Message Streaming (SSE) | `ReadableStream` | `URLSession.bytes` | 🔄 Adapted | Different API, same result |
| 8 | Model Selection | `ModernChatInterface.tsx` | `ModelSelectorView.swift` | ✅ Ported | Native Menu picker |
| 9 | Domain Selection | `ModernChatInterface.tsx` | `DomainSelectorView.swift` | ✅ Ported | Native Menu picker |
| 10 | Message Copy | `navigator.clipboard` | `NSPasteboard` | 🔄 Adapted | Platform clipboard API |
| 11 | Message Rating | `MessageBubble.tsx` | `MessageBubbleView.swift` | ✅ Ported | Thumbs up/down |
| 12 | Message Regeneration | `chat.ts` | `ChatStore.swift` | ✅ Ported | Full parity |
| 13 | Search Conversations | `Sidebar.tsx` | `SidebarView.swift` | ✅ Ported | Full parity |
| 14 | Keyboard Shortcuts | Web key handlers | SwiftUI `.keyboardShortcut` | 🔄 Adapted | Native macOS shortcuts |
| 15 | Authentication | Cookie/JWT | URLSession + Keychain | 🔄 Adapted | Secure token storage |

### Tier 2: Important Features

| # | Feature | Web | Mac | Status | Notes |
|---|---------|-----|-----|--------|-------|
| 16 | My Rules | Rules page | `RulesView.swift` | ✅ Ported | Full CRUD + presets |
| 17 | Rule Presets | Presets browser | `PresetsSheet` | ✅ Ported | Full parity |
| 18 | Settings | Settings page | `SettingsView.swift` | ✅ Ported | Native macOS Settings window |
| 19 | History | History page | `HistoryView.swift` | ✅ Ported | Sort + filter |
| 20 | Artifacts | Artifacts page | `ArtifactsView.swift` | ✅ Ported | Split view with detail |
| 21 | Profile / Analytics | Profile page | `ProfileView.swift` | ✅ Ported | Stats + achievements |
| 22 | Advanced Mode | Toggle in header | Toggle in header | ✅ Ported | UserDefaults persisted |
| 23 | Focus Mode | Toggle in header | Toggle in header | ✅ Ported | Full parity |
| 24 | Voice Input | `MediaRecorder` | `AVAudioEngine` | 🔄 Adapted | Native audio capture |
| 25 | File Attachments | HTML5 drag-and-drop | `NSOpenPanel` + `.onDrop` | 🔄 Adapted | Native file handling |
| 26 | Brain Plan Viewer | Brain plan modal | `BrainPlanViewer.swift` | ✅ Ported | Sheet presentation |
| 27 | Spend Governor | Governor display | `BrainPlanViewer.swift` | ✅ Ported | Integrated in Brain Plan |

### Tier 3: Advanced Features

| # | Feature | Web | Mac | Status | Notes |
|---|---------|-----|-----|--------|-------|
| 28 | Time Machine | `time-machine.tsx` | `TimeMachineView.swift` | ✅ Ported | Timeline + playback |
| 29 | AXIOM Forge | `AxiomForge.tsx` | `AxiomForgeView.swift` | ✅ Ported | 4-step workflow |
| 30 | Crucible Deliberation | `CrucibleDeliberationPanel.tsx` | `CrucibleView.swift` | ✅ Ported | Event timeline |
| 31 | Guest Restrictions | `GuestRestrictionBanner.tsx` | (API only) | ⚠️ Partial | API support, no banner UI yet |
| 32 | Compliance Export | Export API | `ComplianceExportService.swift` | ✅ Ported | API + NSSavePanel |
| 33 | Delight System | `DelightSystem.tsx` | Personality mode only | ⚠️ Partial | Mode selection ported; animations/toasts need native adaptation |

### Excluded Features

| # | Feature | Web Component | Reason for Exclusion |
|---|---------|--------------|---------------------|
| E1 | **Polymorphic Interface** | `LiquidMorphPanel.tsx` | **Explicitly excluded by scope** — the morphing UI (Data Grid, Chart, Kanban, Calculator, Code Editor, Document sub-views) is web-specific and not part of Mac app scope |
| E2 | **Admin UI** | Admin dashboard pages | Mac app is consumer-only; admin features remain web-only |
| E3 | **CSS Glassmorphism** | Tailwind `backdrop-blur` | Replaced by native `.ultraThinMaterial` — equivalent effect, not a gap |

---

## Technology Adaptation Map

| Web Technology | Swift/macOS Equivalent | Adaptation Complexity | Notes |
|---------------|----------------------|----------------------|-------|
| React (Next.js 14) | SwiftUI | **Medium** | Different paradigm; declarative in both cases |
| TypeScript interfaces | Swift structs + Codable | **Low** | Direct 1:1 mapping |
| Zustand stores | `@Observable` / `@Published` | **Low** | SwiftUI native state management |
| Framer Motion | SwiftUI `.animation()` / `.spring()` | **Low** | Native animation system is excellent |
| Tailwind CSS | SwiftUI ViewModifiers + custom styles | **Medium** | No utility classes; use modifier chains |
| Radix UI primitives | Native macOS controls | **Low** | macOS controls are more capable |
| `fetch` / `ReadableStream` | `URLSession` / `URLSession.bytes` | **Low** | Excellent async/await support |
| `localStorage` / `persist` | `UserDefaults` | **Low** | Direct equivalent |
| `navigator.clipboard` | `NSPasteboard` | **Low** | Direct equivalent |
| `MediaRecorder` | `AVAudioEngine` / `AVFoundation` | **Medium** | More powerful but different API |
| HTML5 drag-and-drop | SwiftUI `.onDrop` / `NSOpenPanel` | **Low** | Better native support |
| `react-markdown` | `swift-markdown` + `AttributedString` | **Medium** | Rendering pipeline differs |
| `recharts` | Swift Charts | **Low** | Native, beautiful charts |
| `react-syntax-highlighter` | `Highlightr` | **Low** | Direct equivalent |
| Server-Sent Events | `URLSession.bytes` line parsing | **Low** | Custom SSE parser (~40 lines) |
| CSS Grid / Flexbox | SwiftUI `LazyVGrid` / `HStack` / `VStack` | **Low** | Declarative layout |
| Web Push Notifications | `UserNotifications` framework | **Low** | Better native support |
| Service Workers (offline) | Not implemented | **N/A** | Mac app requires network connectivity |
| Browser URL routing | `NavigationSplitView` / state-based | **Low** | SwiftUI navigation |

---

## Known Gaps & Planned Work

| Gap ID | Feature | Current State | Target | Priority | Est. Effort |
|--------|---------|--------------|--------|----------|-------------|
| G1 | Guest Restriction Banner | API service only | Full SwiftUI banner | Medium | 1 day |
| G2 | Delight Animations | Mode selection only | Full toast + haptic system | Low | 3 days |
| G3 | Markdown Rendering | Plain text display | Rich `AttributedString` rendering | High | 2 days |
| G4 | Code Syntax Highlighting | Highlightr integrated (Package.swift) | Wire into message bubbles | High | 1 day |
| G5 | Offline Caching | None | SwiftData local cache for conversations | Low | 3 days |
| G6 | Notification Integration | None | macOS `UserNotifications` for achievements | Low | 1 day |

---

## Maintenance Policy

**This manifest MUST be updated when:**

1. A new feature is added to **either** the web or Mac Think Tank app
2. A feature is removed or deprecated on **either** platform
3. A technology adaptation is discovered to be insufficient
4. A gap is resolved or a new gap is identified
5. A Tier 1/2 feature's status changes

**Update process:**
1. Add/update the row in the appropriate Feature Parity Matrix table
2. If adding a new technology, add a row to the Technology Adaptation Map
3. If discovering a gap, add a row to Known Gaps & Planned Work
4. Update the version number and date at the top
5. Update `docs/01-THINK-TANK.md` Mac section if user-facing

**Policy enforcement**: `/.windsurf/workflows/thinktank-dual-platform.md`
