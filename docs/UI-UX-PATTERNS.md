# RADIANT UI/UX Patterns, Styles, and Behaviors

> **Design System Documentation**
> 
> **Version**: 1.0 | **Date**: January 19, 2026  
> **Last Updated**: January 19, 2026

---

## Overview

This document tracks all UI/UX patterns, styles, and behaviors used in RADIANT and Think Tank applications. It is **MANDATORY** to:

1. **Review this document BEFORE making UI changes**
2. **Update this document when patterns are added, modified, or removed**

**Policy**: See `/.windsurf/workflows/ui-ux-patterns-policy.md`

---

## Design System Foundation

### Source References

| Resource | URL | Usage |
|----------|-----|-------|
| **shadcn/ui** | https://ui.shadcn.com | Base component library |
| **Radix UI** | https://www.radix-ui.com | Accessible primitives |
| **Tailwind CSS** | https://tailwindcss.com | Utility-first styling |
| **Material Design 3** | https://m3.material.io | Color theory, spacing |
| **Atlassian Design System** | https://atlassian.design | Enterprise patterns |
| **Shopify Polaris** | https://polaris.shopify.com | Admin dashboard patterns |
| **GitHub Primer** | https://primer.style | Developer-focused UI |
| **Framer Motion** | https://www.framer.com/motion | Animation library |

---

## Category 1: Design Tokens

### Color System

**Source**: shadcn/ui theming system with HSL CSS variables

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--background` | `0 0% 100%` | `222.2 84% 4.9%` | Page background |
| `--foreground` | `222.2 84% 4.9%` | `210 40% 98%` | Primary text |
| `--primary` | `262 83% 58%` | `262 83% 68%` | Brand purple |
| `--secondary` | `210 40% 96.1%` | `217.2 32.6% 17.5%` | Secondary elements |
| `--muted` | `210 40% 96.1%` | `217.2 32.6% 17.5%` | Muted backgrounds |
| `--accent` | `210 40% 96.1%` | `217.2 32.6% 17.5%` | Accent highlights |
| `--destructive` | `0 84.2% 60.2%` | `0 62.8% 30.6%` | Error/danger states |
| `--border` | `214.3 31.8% 91.4%` | `217.2 32.6% 17.5%` | Border color |
| `--ring` | `262 83% 58%` | `262 83% 68%` | Focus ring |

**Files**: 
- `apps/admin-dashboard/app/globals.css`
- `apps/thinktank-admin/app/globals.css`

### Thermal State Colors

**Source**: Custom RADIANT design for infrastructure status

| State | Color | Hex | Usage |
|-------|-------|-----|-------|
| `off` | Gray | `#6b7280` | Disabled/inactive |
| `cold` | Blue | `#3b82f6` | Cold/standby |
| `warm` | Amber | `#f59e0b` | Warming up |
| `hot` | Red | `#ef4444` | Active/hot |
| `automatic` | Purple | `#8b5cf6` | Auto-managed |

**Files**: `apps/admin-dashboard/tailwind.config.ts`

### Service Status Colors

| Status | Color | Hex | Usage |
|--------|-------|-----|-------|
| `running` | Green | `#22c55e` | Service healthy |
| `degraded` | Amber | `#f59e0b` | Partial issues |
| `disabled` | Gray | `#6b7280` | Intentionally off |
| `offline` | Red | `#ef4444` | Unavailable |

**Files**: `apps/admin-dashboard/tailwind.config.ts`

### Typography

| Token | Value | Usage |
|-------|-------|-------|
| `font-sans` | `Inter, system-ui, sans-serif` | Body text |
| `font-mono` | `JetBrains Mono, monospace` | Code, technical |

**Source**: Inter from Google Fonts, JetBrains Mono for code

---

## Category 2: Component Patterns

### Button Variants

**Source**: shadcn/ui Button component with class-variance-authority

| Variant | Style | Usage |
|---------|-------|-------|
| `default` | Purple background, white text | Primary actions |
| `destructive` | Red background | Delete, dangerous actions |
| `outline` | Border only | Secondary actions |
| `secondary` | Gray background | Tertiary actions |
| `ghost` | No background until hover | Subtle actions |
| `link` | Text with underline | Navigation links |

| Size | Height | Usage |
|------|--------|-------|
| `default` | `h-10` (40px) | Standard buttons |
| `sm` | `h-9` (36px) | Compact areas |
| `lg` | `h-11` (44px) | Prominent CTAs |
| `icon` | `h-10 w-10` | Icon-only buttons |

**Files**: `apps/admin-dashboard/components/ui/button.tsx`

### Card Component

**Source**: shadcn/ui Card component

| Part | Class | Purpose |
|------|-------|---------|
| `Card` | `rounded-lg border bg-card shadow-sm` | Container |
| `CardHeader` | `flex flex-col space-y-1.5 p-6` | Title area |
| `CardTitle` | `text-2xl font-semibold` | Main heading |
| `CardDescription` | `text-sm text-muted-foreground` | Subtitle |
| `CardContent` | `p-6 pt-0` | Body content |
| `CardFooter` | `flex items-center p-6 pt-0` | Actions area |

**Files**: `apps/admin-dashboard/components/ui/card.tsx`

### Stat Card Component

**Source**: Custom RADIANT component for metrics display

| Variant | Icon Background | Usage |
|---------|-----------------|-------|
| `default` | `bg-slate-100` | Neutral metrics |
| `primary` | `bg-blue-100` | Key metrics |
| `success` | `bg-emerald-100` | Positive metrics |
| `warning` | `bg-amber-100` | Attention needed |
| `danger` | `bg-red-100` | Critical metrics |

**Files**: 
- `apps/admin-dashboard/components/ui/stat-card.tsx`
- `apps/admin-dashboard/lib/design-tokens.ts`

### Dialog/Modal Pattern

**Source**: Radix UI Dialog primitive + shadcn/ui styling

| Part | Purpose |
|------|---------|
| `DialogTrigger` | Button to open |
| `DialogContent` | Modal container with overlay |
| `DialogHeader` | Title and description area |
| `DialogFooter` | Action buttons |
| `DialogClose` | Close button |

**Behavior**:
- Focus trap inside modal
- Escape key closes
- Click outside closes
- Scroll lock on body

**Files**: `apps/admin-dashboard/components/ui/dialog.tsx`

### Toast Notifications

**Source**: Sonner toast library

| Type | Icon | Duration | Usage |
|------|------|----------|-------|
| `success` | ✓ Check | 4s | Successful actions |
| `error` | ✕ X | 6s | Errors |
| `warning` | ⚠ Alert | 5s | Warnings |
| `info` | ℹ Info | 4s | Information |

**Files**: `apps/admin-dashboard/components/ui/toaster.tsx`

---

## Category 3: Layout Patterns

### Grid Layouts

**Source**: Custom RADIANT responsive grid system

| Pattern | Classes | Breakpoints |
|---------|---------|-------------|
| `stats2` | `grid-cols-1 sm:grid-cols-2` | 1 → 2 columns |
| `stats3` | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` | 1 → 2 → 3 |
| `stats4` | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` | 1 → 2 → 4 |
| `stats5` | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` | 2 → 3 → 5 |
| `cards2` | `grid-cols-1 md:grid-cols-2 gap-6` | 1 → 2 |
| `cards3` | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` | 1 → 2 → 3 |

**Files**: `apps/admin-dashboard/lib/design-tokens.ts`

### Sidebar Layout

**Source**: shadcn/ui Sidebar component pattern

| State | Width | Behavior |
|-------|-------|----------|
| Expanded | 256px | Full navigation |
| Collapsed | 64px | Icons only |
| Mobile | Full overlay | Sheet pattern |

**Files**: `apps/admin-dashboard/components/layout/`

### Container Pattern

**Source**: Tailwind CSS container with custom config

```css
container: {
  center: true,
  padding: '2rem',
  screens: { '2xl': '1400px' }
}
```

**Files**: `apps/admin-dashboard/tailwind.config.ts`

### Resizable Panels

**Source**: react-resizable-panels library

| Pattern | Usage |
|---------|-------|
| `ResizablePanelGroup` | Container for panels |
| `ResizablePanel` | Individual panel |
| `ResizableHandle` | Drag handle between panels |

**Files**: `apps/admin-dashboard/components/ui/resizable.tsx`

---

## Category 4: Animation Patterns

### Framer Motion Animations

**Source**: Framer Motion library

| Animation | Properties | Usage |
|-----------|------------|-------|
| **Fade In** | `opacity: 0 → 1` | Element appearance |
| **Slide In** | `translateX/Y + opacity` | Panel transitions |
| **Scale** | `scale: 0.95 → 1` | Modal appearance |
| **Stagger** | `staggerChildren: 0.05` | List items |

**Files**: 
- `apps/admin-dashboard/components/thinktank/magic-carpet/`
- `apps/admin-dashboard/components/collaboration/panels/`

### CSS Animations (Tailwind)

| Animation | Keyframes | Duration | Usage |
|-----------|-----------|----------|-------|
| `accordion-down` | Height 0 → auto | 0.2s | Accordion expand |
| `accordion-up` | Height auto → 0 | 0.2s | Accordion collapse |
| `fade-in` | Opacity 0 → 1 | 0.2s | Element appearance |
| `slide-in-from-right` | TranslateX 100% → 0 | 0.3s | Sheet/drawer |
| `pulse-slow` | Opacity 1 → 0.5 → 1 | 2s loop | Loading states |
| `shimmer` | Background position | 2s loop | Skeleton loading |

**Files**: `apps/admin-dashboard/tailwind.config.ts`

---

## Category 5: Interaction Behaviors

### Focus Management

**Source**: Radix UI accessibility patterns + WCAG 2.1

| Pattern | Behavior |
|---------|----------|
| **Focus Ring** | `ring-2 ring-ring ring-offset-2` on focus |
| **Focus Trap** | Tab cycles within modals/dialogs |
| **Focus Restore** | Returns focus when modal closes |
| **Skip Links** | Hidden link to main content |

**Files**: `apps/admin-dashboard/app/globals.css` (`.focus-ring` class)

### Keyboard Navigation

**Source**: Radix UI primitives

| Component | Keys |
|-----------|------|
| **Dialog** | Escape to close |
| **Dropdown** | Arrow keys, Enter, Escape |
| **Tabs** | Arrow keys to switch |
| **Accordion** | Space/Enter to toggle |
| **Select** | Arrow keys, Enter, Type to search |

### Loading States

| Pattern | Visual | Usage |
|---------|--------|-------|
| **Skeleton** | Gray animated placeholder | Content loading |
| **Spinner** | Rotating icon | Action in progress |
| **Progress** | Bar with percentage | File upload, long tasks |
| **Shimmer** | Gradient animation | Card/list loading |

**Files**: 
- `apps/admin-dashboard/components/ui/skeleton.tsx`
- `apps/admin-dashboard/components/ui/progress.tsx`

### Empty States

**Source**: Custom RADIANT pattern

| Element | Purpose |
|---------|---------|
| Icon | Visual indicator |
| Title | What's empty |
| Description | Why/what to do |
| Action | CTA button |

**Files**: `apps/admin-dashboard/components/ui/empty-state.tsx`

---

## Category 6: Form Patterns

### Form Layout

**Source**: react-hook-form + shadcn/ui Form component

| Pattern | Usage |
|---------|-------|
| **Stacked** | Label above input, full width |
| **Inline** | Label beside input |
| **Grid** | Multiple fields in columns |

### Validation

**Source**: Zod schema validation + @hookform/resolvers

| State | Visual |
|-------|--------|
| **Default** | Gray border |
| **Focus** | Ring highlight |
| **Error** | Red border + error message |
| **Success** | Green border (optional) |
| **Disabled** | Reduced opacity |

### Input Types

| Component | Radix Primitive | Usage |
|-----------|-----------------|-------|
| `Input` | Native | Text, email, password |
| `Textarea` | Native | Multi-line text |
| `Select` | `@radix-ui/react-select` | Dropdown selection |
| `Checkbox` | `@radix-ui/react-checkbox` | Boolean toggle |
| `Switch` | `@radix-ui/react-switch` | On/off toggle |
| `Slider` | `@radix-ui/react-slider` | Range selection |

---

## Category 7: Data Display Patterns

### Tables

**Source**: shadcn/ui Table component

| Part | Class | Purpose |
|------|-------|---------|
| `Table` | Full width container | Wrapper |
| `TableHeader` | Sticky header | Column names |
| `TableBody` | Scrollable | Data rows |
| `TableRow` | Hover state | Individual row |
| `TableCell` | Padding, alignment | Cell content |

**Files**: `apps/admin-dashboard/components/ui/table.tsx`

### Charts

**Source**: Recharts library

| Chart Type | Usage |
|------------|-------|
| `LineChart` | Trends over time |
| `BarChart` | Comparisons |
| `AreaChart` | Volume/quantity |
| `PieChart` | Proportions |

**Chart Colors** (CSS variables):
- `--chart-1`: Primary (purple)
- `--chart-2`: Teal
- `--chart-3`: Dark blue
- `--chart-4`: Yellow
- `--chart-5`: Orange

### Badges

**Source**: shadcn/ui Badge + custom variants

| Variant | Colors | Usage |
|---------|--------|-------|
| `default` | Primary colors | Standard |
| `secondary` | Gray | Less emphasis |
| `destructive` | Red | Errors, warnings |
| `outline` | Border only | Subtle |

**Tier Badges** (custom):
| Tier | Colors |
|------|--------|
| `free` | Slate |
| `pro` | Blue |
| `team` | Purple |
| `enterprise` | Amber |

**Status Badges** (custom):
| Status | Colors |
|--------|--------|
| `active` | Emerald |
| `inactive` | Slate |
| `suspended` | Red |
| `archived` | Amber |

**Files**: 
- `apps/admin-dashboard/components/ui/badge.tsx`
- `apps/admin-dashboard/lib/design-tokens.ts`

---

## Category 8: Navigation Patterns

### Tabs

**Source**: Radix UI Tabs primitive

| Pattern | Usage |
|---------|-------|
| **Horizontal** | Page sections |
| **Vertical** | Settings sidebar |
| **Contained** | Card-style tabs |

**Files**: `apps/admin-dashboard/components/ui/tabs.tsx`

### Breadcrumbs

| Pattern | Format |
|---------|--------|
| **Standard** | Home / Section / Page |
| **Truncated** | Home / ... / Page |

### Dropdown Menu

**Source**: Radix UI Dropdown Menu primitive

| Part | Purpose |
|------|---------|
| `DropdownMenuTrigger` | Button to open |
| `DropdownMenuContent` | Menu container |
| `DropdownMenuItem` | Clickable item |
| `DropdownMenuSeparator` | Visual divider |
| `DropdownMenuSub` | Nested submenu |

**Files**: `apps/admin-dashboard/components/ui/dropdown-menu.tsx`

---

## Category 9: Think Tank Consumer Chat Patterns

**Source**: Custom Think Tank design with shadcn/ui and Framer Motion

### Advanced Mode Toggle

Toggle between Auto and Advanced modes with animated transition.

| State | Appearance |
|-------|------------|
| Auto Mode | Sparkles icon, subtle styling |
| Advanced Mode | Zap icon, violet glow background |

**Keyboard Shortcut**: `⌘+Shift+A`

**Files**: `apps/thinktank/components/chat/AdvancedModeToggle.tsx`

### Message Bubble

Enhanced chat message component with metadata support.

| Feature | Auto Mode | Advanced Mode |
|---------|-----------|---------------|
| Avatar | ✅ | ✅ |
| Content | ✅ | ✅ |
| Streaming cursor | ✅ | ✅ |
| Model used | ❌ | ✅ |
| Token count | ❌ | ✅ |
| Latency | ❌ | ✅ |
| Cost estimate | ❌ | ✅ |
| Rating buttons | ✅ | ✅ |

**Files**: `apps/thinktank/components/chat/MessageBubble.tsx`

### Chat Input

Smart auto-resizing textarea with model selector integration.

| Feature | Description |
|---------|-------------|
| Auto-resize | Grows up to 200px |
| Attachment button | File upload |
| Voice button | Voice input |
| Model selector | Shows in Advanced Mode |
| Send button | Gradient styling when active |

**Files**: `apps/thinktank/components/chat/ChatInput.tsx`

### Sidebar with Date Grouping

Conversation list grouped by time period.

| Group | Conversations |
|-------|---------------|
| Today | Conversations from today |
| Yesterday | Previous day |
| Last 7 Days | Past week |
| Older | Everything else |

**Files**: `apps/thinktank/components/chat/Sidebar.tsx`

### Brain Plan Viewer

Collapsible execution plan display for Advanced Mode.

| Element | Purpose |
|---------|---------|
| Mode badge | Shows orchestration mode |
| Domain badge | Detected knowledge domain |
| Progress bar | Step completion percentage |
| Step list | Individual execution steps |
| Model selection | Selected model with reason |

**Files**: `apps/thinktank/components/chat/BrainPlanViewer.tsx`

### Model Selector Dialog

Full-featured model picker with search and categories.

| Feature | Description |
|---------|-------------|
| Search | Filter by name/description |
| Categories | Filter by model category |
| Model cards | Shows capabilities, cost, latency |
| Auto option | "Let Cato decide" option |

**Files**: `apps/thinktank/components/chat/ModelSelector.tsx`

### Language Selector

Component for selecting preferred UI language from API-provided list.

| Variant | Description |
|---------|-------------|
| `dropdown` | Compact dropdown with current language |
| `list` | Full list for settings page |

| Feature | Description |
|---------|-------------|
| Native names | Shows language in its own script |
| RTL support | Respects text direction |
| API-driven | Languages loaded from Radiant API |
| Persisted | Saves to localStorage |

**Files**: `apps/thinktank/components/ui/language-selector.tsx`

---

## Category 10: Localization Patterns

**Source**: Custom Think Tank design

### Translation Hook Pattern

React hook pattern for accessing translations.

```tsx
const { t } = useTranslation();
return <span>{t(T.common.save)}</span>;
```

| Export | Purpose |
|--------|---------|
| `useTranslation` | Get `t` function only |
| `useLanguage` | Get language + setter |
| `useLocalization` | Full context access |
| `T` | Translation key constants |

**Files**: `apps/thinktank/lib/i18n/localization-context.tsx`

### Translation Key Pattern

Centralized key constants for type safety.

| Category | Prefix | Example Key |
|----------|--------|-------------|
| Common | `thinktank.common.` | `T.common.save` |
| Chat | `thinktank.chat.` | `T.chat.send` |
| Errors | `thinktank.errors.` | `T.errors.network` |

**Files**: 
- `apps/thinktank/lib/i18n/translation-keys.ts`
- `apps/thinktank/lib/i18n/default-translations.ts`

### Parameter Interpolation Pattern

Support for dynamic values in translations.

```tsx
// Translation: "Delete {{count}} items"
t(T.history.deleteSelectedConfirm, { count: 5 })
// Output: "Delete 5 items"
```

**Files**: `apps/thinktank/lib/i18n/localization-context.tsx`

---

## Category 11: Magic Carpet Patterns (Think Tank Admin)

**Source**: Custom RADIANT/Think Tank design

### Spatial Glass Card

Glassmorphism effect with backdrop blur.

| Property | Value |
|----------|-------|
| Background | `bg-white/80 dark:bg-slate-900/80` |
| Backdrop | `backdrop-blur-xl` |
| Border | `border border-white/20` |

**Files**: `apps/admin-dashboard/components/thinktank/magic-carpet/spatial-glass-card.tsx`

### AI Presence Indicator

Animated indicator showing AI activity state.

| State | Animation |
|-------|-----------|
| Idle | Subtle pulse |
| Thinking | Faster pulse |
| Responding | Wave effect |

**Files**: `apps/admin-dashboard/components/thinktank/magic-carpet/ai-presence-indicator.tsx`

### Reality Scrubber Timeline

Time-travel UI for conversation history.

| Element | Purpose |
|---------|---------|
| Timeline | Visual history |
| Scrubber | Drag to point in time |
| Markers | Key moments |
| Preview | Hover state preview |

**Files**: `apps/admin-dashboard/components/thinktank/magic-carpet/reality-scrubber-timeline.tsx`

### Quantum Split View

Parallel conversation comparison view.

| Feature | Purpose |
|---------|---------|
| Split panes | Side-by-side views |
| Sync scroll | Optional linked scrolling |
| Merge | Combine best parts |

**Files**: `apps/admin-dashboard/components/thinktank/magic-carpet/quantum-split-view.tsx`

### Pre-Cognition Suggestions

AI-powered predictive suggestions.

| Animation | Timing |
|-----------|--------|
| Fade in | 0.2s |
| Slide up | 0.3s |
| Stagger | 0.05s between items |

**Files**: `apps/admin-dashboard/components/thinktank/magic-carpet/pre-cognition-suggestions.tsx`

---

## Pattern Modification History

| Date | Pattern | Change | Reason | Modified By |
|------|---------|--------|--------|-------------|
| 2024-01-01 | Initial | Document created | Baseline | System |
| 2026-01-19 | Advanced Mode Toggle | New component | Think Tank Auto/Advanced mode switching | Cascade |
| 2026-01-19 | Message Bubble | Enhanced | Added metadata display, rating actions, streaming cursor | Cascade |
| 2026-01-19 | Chat Input | Enhanced | Added model selector integration, auto-resize | Cascade |
| 2026-01-19 | Sidebar | New component | Conversation list with search, date grouping | Cascade |
| 2026-01-19 | Brain Plan Viewer | New component | Displays AGI execution plan with step progress | Cascade |
| 2026-01-19 | Model Selector Dialog | New component | Full model picker with categories and search | Cascade |
| 2026-01-19 | Language Selector | New component | Dropdown/list language picker with native names | Cascade |
| 2026-01-19 | Localization System | New pattern | useTranslation hook, T keys, API-based i18n | Cascade |
| 2026-01-19 | GlassCard | New component | Glassmorphism card with blur, glow, hover effects | Cascade |
| 2026-01-19 | GlassPanel | New component | Frosted glass container panel | Cascade |
| 2026-01-19 | AuroraBackground | New component | Animated aurora gradient effect for backgrounds | Cascade |
| 2026-01-19 | InteractiveTimeline | New component | Vertical timeline with grouped history navigation | Cascade |
| 2026-01-19 | HorizontalTimeline | New component | Horizontal scrollable timeline preview | Cascade |
| 2026-01-19 | ViewRouter | New component | Polymorphic UI morphing with Sniper/War Room modes | Cascade |
| 2026-01-19 | ModernChatInterface | New component | 2026+ chat UI with glassmorphism, advanced mode | Cascade |
| 2026-01-19 | Design Tokens | New system | Complete design token system for colors, spacing, animation | Cascade |

---

## Category 12: Think Tank Consumer App 2026+ Patterns

**Source**: Custom RADIANT/Think Tank design (2026+ UI/UX trends)

### Glassmorphism Components

Modern glass effect components with depth and blur.

#### GlassCard

| Property | Value |
|----------|-------|
| Background | `bg-white/[0.02-0.08]` based on intensity |
| Backdrop | `backdrop-blur-md/lg/xl` based on intensity |
| Border | `border-white/[0.06-0.12]` |
| Variants | `default`, `elevated`, `inset`, `glow` |
| Glow Colors | `violet`, `fuchsia`, `cyan`, `emerald` |

```tsx
<GlassCard variant="glow" glowColor="violet" hoverEffect>
  Content
</GlassCard>
```

**Files**: `apps/thinktank/components/ui/glass-card.tsx`

#### GlassPanel

Container panel with frosted glass effect.

```tsx
<GlassPanel blur="lg" className="p-4">
  Content
</GlassPanel>
```

**Files**: `apps/thinktank/components/ui/glass-card.tsx`

### Aurora Background

Animated gradient background with floating color blobs.

| Property | Options |
|----------|---------|
| Colors | `violet`, `cyan`, `emerald`, `mixed` |
| Intensity | `subtle`, `medium`, `strong` |
| Animate | `true/false` |

**Files**: `apps/thinktank/components/ui/aurora-background.tsx`

### Interactive Timeline

Grouped vertical timeline for history browsing.

| Feature | Description |
|---------|-------------|
| Grouping | Today, Yesterday, This Week, This Month, Older |
| Animation | Item entrance, hover scale, selection glow |
| Indicators | Favorite stars, mode badges, domain hints |

**Files**: `apps/thinktank/components/ui/timeline.tsx`

### Horizontal Timeline

Scrollable horizontal timeline preview.

| Feature | Description |
|---------|-------------|
| Scroll | Drag or button navigation |
| Cards | Compact conversation cards |
| Selection | Glow effect on selected |

**Files**: `apps/thinktank/components/ui/timeline.tsx`

### Polymorphic View Router

UI that morphs based on task and mode.

| Mode | View | Description |
|------|------|-------------|
| Sniper | Fast execution | Single model, quick responses |
| War Room | Deep analysis | Multi-agent, full orchestration |

| View Type | Purpose |
|-----------|---------|
| `chat` | Standard conversation |
| `terminal` | Command center |
| `canvas` | Infinite canvas/mindmap |
| `dashboard` | Analytics view |
| `diff_editor` | Verification split-screen |
| `decision_cards` | Human-in-the-loop |

**Files**: `apps/thinktank/components/polymorphic/view-router.tsx`

### Modern Chat Interface

2026+ chat UI with all advanced features.

| Feature | Visibility |
|---------|------------|
| Mode badge | Always |
| Model selector | Advanced mode |
| Metadata display | Advanced mode |
| Voice input | Advanced mode |
| File attachments | Advanced mode |
| Rating actions | On hover |

**Files**: `apps/thinktank/components/chat/ModernChatInterface.tsx`

### Design Token System

Comprehensive design tokens for consistent styling.

| Category | Examples |
|----------|----------|
| Colors | `glass.light`, `aurora.violet`, `glow.cyan` |
| Spacing | 0.5 to 24 rem scale |
| Radius | `sm` to `full` |
| Shadows | `glass`, `glassHover`, `innerGlow` |
| Animation | `spring.gentle`, `easing.elastic` |
| Blur | `sm` to `glass` (20px) |

**Files**: `apps/thinktank/lib/design-system/tokens.ts`

### Modern Polish Components (2026+)

Super-modern UI polish components for consumer experience.

#### Page Transitions

Smooth fade and slide transitions between pages.

```tsx
import { PageTransition, StaggerContainer, StaggerItem, FloatingElement } from '@/components/ui';

// Wrap page content
<PageTransition>
  <YourPageContent />
</PageTransition>

// Staggered list animation
<StaggerContainer>
  {items.map(item => (
    <StaggerItem key={item.id}>{item}</StaggerItem>
  ))}
</StaggerContainer>

// Floating decoration
<FloatingElement delay={0.5}>
  <Icon />
</FloatingElement>
```

**Files**: `apps/thinktank/components/ui/page-transition.tsx`

#### Skeleton Loaders

Shimmer effect skeleton components for loading states.

| Component | Purpose |
|-----------|---------|
| `Skeleton` | Basic shimmer element |
| `SkeletonText` | Multiple line text placeholder |
| `SkeletonCard` | Card with avatar and text |
| `SkeletonMessage` | Chat message placeholder |
| `SkeletonChatList` | Full chat loading state |
| `SkeletonSidebar` | Sidebar loading state |
| `SkeletonGrid` | Grid of cards |
| `SkeletonStats` | Stats row loading |

```tsx
import { Skeleton, SkeletonCard, SkeletonChatList } from '@/components/ui';

<Skeleton className="h-4 w-full" />
<SkeletonCard />
<SkeletonChatList />
```

**Files**: `apps/thinktank/components/ui/skeleton.tsx`

#### Gradient Text & Glow Effects

Animated text effects for modern styling.

| Component | Purpose |
|-----------|---------|
| `GradientText` | Animated gradient text (violet, cyan, rainbow, gold, emerald) |
| `GlowText` | Text with drop shadow glow |
| `AnimatedNumber` | Counter animation for stats |
| `Typewriter` | Typing effect for text |

```tsx
import { GradientText, GlowText, AnimatedNumber, Typewriter } from '@/components/ui';

<GradientText gradient="violet" animate>Think Tank</GradientText>
<GlowText color="cyan">Glowing</GlowText>
<AnimatedNumber value={1234} suffix="+" />
<Typewriter text="Hello, I'm Cato..." />
```

**Files**: `apps/thinktank/components/ui/gradient-text.tsx`

#### Typing Indicators

Animated indicators for AI thinking state.

| Variant | Description |
|---------|-------------|
| `dots` | Bouncing dots (default) |
| `pulse` | Single pulsing dot with text |
| `wave` | Audio waveform style |
| `thinking` | Full "Cato is thinking" panel |

```tsx
import { TypingIndicator, StreamingIndicator } from '@/components/ui';

<TypingIndicator variant="thinking" />
<StreamingIndicator />
```

**Files**: `apps/thinktank/components/ui/typing-indicator.tsx`

#### Empty States

Beautiful empty state illustrations with actions.

| Type | Icon | Description |
|------|------|-------------|
| `chat` | MessageSquare | Start conversation prompt |
| `history` | History | No conversations yet |
| `artifacts` | Layers | No artifacts created |
| `search` | Search | No results found |
| `rules` | Star | No rules configured |

```tsx
import { EmptyState, WelcomeHero } from '@/components/ui';

<EmptyState 
  type="chat" 
  action={{ label: "Start", onClick: handleStart }} 
/>

<WelcomeHero onStart={handleStart} />
```

**Files**: `apps/thinktank/components/ui/empty-state.tsx`

#### Modern Buttons

Enhanced buttons with glow and micro-interactions.

| Component | Variants |
|-----------|----------|
| `ModernButton` | primary, secondary, ghost, glow, outline |
| `IconButton` | default, ghost, glow |
| `PillButton` | Active/inactive pill for filters |

```tsx
import { ModernButton, IconButton, PillButton } from '@/components/ui';

<ModernButton variant="glow" leftIcon={<Zap />}>
  Get Started
</ModernButton>

<IconButton icon={<Star />} label="Favorite" variant="glow" />

<PillButton isActive={selected}>Category</PillButton>
```

**Files**: `apps/thinktank/components/ui/modern-button.tsx`

#### Tailwind Animations

Custom animations added to `tailwind.config.js`:

| Animation | Class | Usage |
|-----------|-------|-------|
| Shimmer | `animate-shimmer` | Skeleton loading |
| Gradient X | `animate-gradient-x` | Animated gradients |
| Pulse Glow | `animate-pulse-glow` | Pulsing glow effect |
| Float | `animate-float` | Floating decoration |
| Spin Slow | `animate-spin-slow` | Slow rotation |

---

## Adding a New Pattern

When adding a new UI/UX pattern:

1. **Document the source** - Where did the pattern come from?
2. **Categorize it** - Which category does it belong to?
3. **Include all details** - Properties, variants, usage
4. **Add file references** - Where is it implemented?
5. **Update this document** - Add to appropriate section

---

## Modifying a Pattern

When modifying an existing pattern:

1. **Review existing documentation** - Understand current pattern
2. **Document the change** - Add to "Pattern Modification History"
3. **Update pattern details** - Modify the relevant section
4. **Test across apps** - Ensure consistency

---

**Policy**: This document is maintained under `/.windsurf/workflows/ui-ux-patterns-policy.md`
