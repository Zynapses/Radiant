# RADIANT UI/UX Patterns, Styles, and Behaviors

> **Design System Documentation**
> 
> **Version**: 1.1 | **Date**: January 19, 2026  
> **Last Updated**: January 24, 2026

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

**Source**: shadcn/ui Card component with Glass variant (v5.52.2)

| Part | Class | Purpose |
|------|-------|---------|
| `Card` | `rounded-xl border bg-card shadow-sm` | Container |
| `Card variant="glass"` | `bg-white/[0.04] backdrop-blur-lg border-white/[0.08]` | Glass effect |
| `CardHeader` | `flex flex-col space-y-1.5 p-6` | Title area |
| `CardTitle` | `text-2xl font-semibold` | Main heading |
| `CardDescription` | `text-sm text-muted-foreground` | Subtitle |

### GlassCard Component (v5.52.2)

**Source**: Custom RADIANT glassmorphism component

| Part | Class | Purpose |
|------|-------|---------|
| `GlassCard` | `bg-white/[0.04] backdrop-blur-lg border-white/[0.08] rounded-xl` | Glass container |
| `GlassPanel` | `bg-white/[0.03] backdrop-blur-lg border-white/[0.06] rounded-2xl` | Glass panel |
| `GlassOverlay` | `fixed inset-0 bg-black/40 backdrop-blur-xl z-50` | Modal overlay |

**Variants:**

| Variant | Effect | Use Case |
|---------|--------|----------|
| `default` | Subtle glass | Standard cards |
| `elevated` | Stronger shadow | Floating panels |
| `inset` | Inner shadow | Embedded content |
| `glow` | Ambient color glow | Featured content |

**Intensity:**

| Intensity | Background | Blur |
|-----------|------------|------|
| `light` | `bg-white/[0.02]` | `backdrop-blur-md` |
| `medium` | `bg-white/[0.04]` | `backdrop-blur-lg` |
| `strong` | `bg-white/[0.08]` | `backdrop-blur-xl` |

**Glow Colors:**

| Color | Shadow |
|-------|--------|
| `violet` | `shadow-[0_0_30px_rgba(139,92,246,0.15)]` |
| `fuchsia` | `shadow-[0_0_30px_rgba(217,70,239,0.15)]` |
| `cyan` | `shadow-[0_0_30px_rgba(34,211,238,0.15)]` |
| `emerald` | `shadow-[0_0_30px_rgba(52,211,153,0.15)]` |
| `blue` | `shadow-[0_0_30px_rgba(59,130,246,0.15)]` |

**Files**: 
- `apps/thinktank/components/ui/glass-card.tsx`
- `apps/admin-dashboard/components/ui/glass-card.tsx`
- `apps/thinktank-admin/components/ui/glass-card.tsx`
- `apps/curator/components/ui/glass-card.tsx`

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

**Interactive Report Charts** (v5.42.0):

| Property | Value | Usage |
|----------|-------|-------|
| `CHART_COLORS` | 8-color palette | `['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']` |
| Tooltip formatter | K/M suffixes | Auto-format large numbers |
| ResponsiveContainer | 100% width | Adapts to panel size |
| Cell coloring | Index-based | Each bar/pie slice unique color |

**Files**: `apps/admin-dashboard/app/(dashboard)/reports/page.tsx`

### Smart Insights Panel (v5.42.0)

**Source**: Custom RADIANT component for AI-powered report insights

| Insight Type | Border Color | Icon | Background |
|--------------|--------------|------|------------|
| `trend` | Blue (`border-l-blue-500`) | `TrendingUp` | `bg-blue-50/50` |
| `anomaly` | Amber (`border-l-amber-500`) | `AlertTriangle` | `bg-amber-50/50` |
| `achievement` | Green (`border-l-green-500`) | `Target` | `bg-green-50/50` |
| `recommendation` | Purple (`border-l-purple-500`) | `Zap` | `bg-purple-50/50` |
| `warning` | Red (`border-l-red-500`) | `AlertCircle` | `bg-red-50/50` |

**Severity Badge Colors**:
| Severity | Border | Text |
|----------|--------|------|
| `low` | `border-green-500` | `text-green-600` |
| `medium` | `border-amber-500` | `text-amber-600` |
| `high` | `border-red-500` | `text-red-600` |

**Layout**: Card with `border-l-4`, flex row with insight details left and confidence score right.

**Files**: `apps/admin-dashboard/app/(dashboard)/reports/page.tsx`, `apps/thinktank-admin/app/(dashboard)/reports/page.tsx`

### Brand Kit Panel (v5.42.0)

**Source**: Custom RADIANT component for report branding customization

| Element | Component | Behavior |
|---------|-----------|----------|
| Logo Upload | `<input type="file">` hidden + dashed border dropzone | FileReader → data URL |
| Company Name | `Input` | Bound to `brandKit.companyName` |
| Tagline | `Input` | Bound to `brandKit.tagline` |
| Color Pickers | `<input type="color">` | Native HTML5 color picker |
| Font Selector | `Select` | Header and body font dropdowns |
| Quick Presets | Color circle buttons | One-click theme colors |
| Preview Card | `Card` with inline styles | Live preview of branding |

**Default Brand Kit**:
```typescript
{
  logoUrl: null,
  primaryColor: '#3b82f6',
  secondaryColor: '#64748b',
  accentColor: '#10b981',
  fontFamily: 'Inter, system-ui, sans-serif',
  headerFont: 'Inter, system-ui, sans-serif',
  companyName: 'RADIANT',
  tagline: 'AI-Powered Insights',
}
```

**Files**: `apps/admin-dashboard/app/(dashboard)/reports/page.tsx`, `apps/thinktank-admin/app/(dashboard)/reports/page.tsx`

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

**Files**: 
- `apps/admin-dashboard/components/ui/dropdown-menu.tsx`
- `apps/thinktank/components/ui/dropdown-menu.tsx` (v5.52.16 - glassmorphism variant)

**Think Tank Variant** (v5.52.16):
| Property | Value |
|----------|-------|
| Background | `bg-slate-900/95 backdrop-blur-xl` |
| Border | `border-white/[0.08]` |
| Item hover | `focus:bg-white/[0.08]` |
| Text color | `text-slate-300` (hover: `text-white`) |
| Border radius | `rounded-xl` |
| Shadow | `shadow-xl shadow-black/20` |

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
| 2026-01-23 | Responsive Grids | Enforced | All stats grids must use `md:grid-cols-2 lg:grid-cols-4` pattern | Cascade |
| 2026-01-23 | Toast Notifications | Enforced | All mutation actions must show toast feedback | Cascade |
| 2026-01-23 | useQuery Typing | Enforced | All useQuery hooks must use generic typing `useQuery<T>()` | Cascade |
| 2026-01-23 | Magic Carpet Interactions | Implemented | Bookmark, branch, prediction handlers with toast feedback | Cascade |
| 2026-01-23 | Collaborative Session | Implemented | Invite, permission, remove participant handlers with state | Cascade |
| 2026-01-23 | Reply/Edit Actions | Implemented | Reply populates input with @mention, edit populates content | Cascade |
| 2026-01-23 | Living Parchment | Implemented | War Room advisor analysis, Council session conclusion via API | Cascade |
| 2026-01-23 | Geographic Map | Implemented | Region click handler with toast and selection state | Cascade |
| 2026-01-23 | Report Edit | Implemented | Edit report handler opens dialog with report configuration | Cascade |
| 2026-01-23 | ViewRouter State | Implemented | View/mode state tracking for polymorphic UI transitions | Cascade |
| 2026-01-24 | Activity Heatmap | New component | GitHub-style yearly activity visualization | Cascade |
| 2026-01-24 | Enhanced Activity Heatmap | New component | AI insights, breathing animation, streaks, sound | Cascade |
| 2026-01-24 | Generic Heatmap | New component | 2D grid with 5 color schemes | Cascade |
| 2026-01-24 | Latency Heatmap | New component | Geographic AWS region latency map | Cascade |
| 2026-01-24 | CBF Violations Heatmap | New component | Content boundary rule violation analytics | Cascade |
| 2026-01-27 | Ghost Inference Config | New page | Admin configuration page for vLLM/SageMaker settings | Cascade |

---

## Category 14: Infrastructure Configuration Patterns (v5.52.40)

**Source**: Custom RADIANT admin dashboard patterns for infrastructure management

### Ghost Inference Configuration Page

Admin page for configuring vLLM ghost inference parameters.

| Location | `apps/admin-dashboard/app/(dashboard)/system/ghost-inference/page.tsx` |
|----------|-----------------------------------------------------------------------|

**Page Structure:**

| Section | Component | Purpose |
|---------|-----------|---------|
| Header | Title + Description + Actions | Page context and primary actions |
| Status Cards | 4-column grid | Status, Requests, Latency, Cost metrics |
| Tabs | Model, Performance, Infrastructure, Deployments | Configuration categories |
| Deploy Dialog | Dialog with validation | Cost estimation and deployment confirmation |

**Status Badge Pattern:**

| Status | Background | Text Color | Icon |
|--------|------------|------------|------|
| `active` | `bg-emerald-100` | `text-emerald-700` | `CheckCircle2` |
| `warming` | `bg-amber-100` | `text-amber-700` | `Loader2` (spinning) |
| `scaling` | `bg-blue-100` | `text-blue-700` | `Activity` |
| `error` | `bg-red-100` | `text-red-700` | `XCircle` |
| `disabled` | `bg-slate-100` | `text-slate-600` | `Clock` |
| `deploying` | `bg-amber-100` | `text-amber-700` | `Loader2` (spinning) |
| `failed` | `bg-red-100` | `text-red-700` | `XCircle` |

**Tab Icons:**

| Tab | Icon |
|-----|------|
| Model | `Brain` |
| Performance | `Gauge` |
| Infrastructure | `Server` |
| Deployments | `History` |

**Form Patterns Used:**

| Component | Usage |
|-----------|-------|
| `Input` | Text fields (model name, numeric inputs) |
| `Select` | Dropdown selections (dtype, instance type, tensor parallelism) |
| `Slider` | Range inputs (GPU memory, hidden state layer) |
| `Switch` | Boolean toggles (return hidden states, scale to zero, eager mode) |
| `Separator` | Section dividers within tabs |

**Instance Type Display:**

Instance type selector shows GPU details inline:
```tsx
<SelectItem value={instanceType}>
  {instanceType} - {gpuCount}x {gpuType} ({gpuMemoryGb}GB) - ${hourlyCostUsd}/hr
</SelectItem>
```

Selected instance shows expanded details in muted panel below selector.

**Validation Dialog Pattern:**

| Section | Background | Border | Content |
|---------|------------|--------|---------|
| Errors | `bg-red-50` | `border-red-200` | `XCircle` icon + error list |
| Warnings | `bg-amber-50` | `border-amber-200` | `AlertTriangle` icon + warning list |
| Cost Estimate | `bg-muted` | none | Hourly + Monthly cost |

**Deployment History Table:**

| Column | Content |
|--------|---------|
| Endpoint | Monospace font (`font-mono text-sm`) |
| Status | Badge with status icon |
| Started | Localized datetime |
| Startup Time | Minutes + seconds format |
| Invocations | Formatted number with error count if > 0 |
| Cost | USD format |

**Empty State Pattern:**

No configuration state uses centered layout:
- `Brain` icon (h-16 w-16 text-muted-foreground)
- Heading (text-xl font-semibold)
- Description (text-muted-foreground max-w-md text-center)
- CTA Button with Settings icon

**Action Bar Pattern:**

| State | Buttons |
|-------|---------|
| No changes | Deploy (primary), Refresh (outline) |
| Has changes | Discard Changes (outline), Save Configuration (primary), Deploy (outline), Refresh (outline) |

**Loading State:**

Full-page centered loader:
```tsx
<div className="flex items-center justify-center h-96">
  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
</div>
```

**Toast Notifications:**

| Action | Variant | Title | Description |
|--------|---------|-------|-------------|
| Config created | default | Configuration Created | Default message |
| Config saved | default | Configuration Saved | Field count updated |
| Validation failed | destructive | Validation Failed | Error list |
| Deploy initiated | default | Deployment Initiated | Endpoint name |
| Deploy failed | destructive | Deployment Failed | Error message |
| Fetch error | destructive | Error | Load failure message |

---

## Category 13: Heatmap Components (v5.52.1)

**Source**: Custom RADIANT visualization components for data density display

### Activity Heatmap

GitHub-style contribution graph for user activity tracking.

| Property | Value |
|----------|-------|
| Location | `apps/thinktank/components/ui/activity-heatmap.tsx` |
| Color Schemes | `violet`, `green`, `blue` |
| Layout | 52 weeks × 7 days grid |
| Animation | Framer Motion staggered fade-in |

**Usage:**
```tsx
<ActivityHeatmap 
  data={[{ date: '2026-01-24', count: 5 }]} 
  year={2026}
  colorScheme="violet"
/>
```

### Enhanced Activity Heatmap

Industry-leading activity visualization with AI features.

| Feature | Description |
|---------|-------------|
| **Breathing Animation** | Cells pulse based on activity intensity (0.5s cycle) |
| **AI Insights** | Pattern detection, anomaly alerts, trend predictions |
| **Streak Tracking** | Current/longest streak badges with 🔥 icons |
| **Sound Feedback** | Web Audio API pitch varies with intensity |
| **Accessibility Mode** | Full narrative summary for screen readers |
| **Predictions** | Future cells with dashed borders |

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `ActivityDay[]` | required | Activity data |
| `year` | `number` | current year | Display year |
| `colorScheme` | `'violet' \| 'green' \| 'blue' \| 'fire' \| 'ocean'` | `'violet'` | Color theme |
| `enableBreathing` | `boolean` | `true` | Enable pulse animation |
| `enableSound` | `boolean` | `false` | Enable audio feedback |
| `enableAIInsights` | `boolean` | `true` | Show AI analysis |
| `showStreaks` | `boolean` | `true` | Highlight streak days |

**Files**: `apps/thinktank/components/ui/enhanced-activity-heatmap.tsx`

### Generic Heatmap

2D grid visualization for correlation matrices and patterns.

| Property | Value |
|----------|-------|
| Location | `apps/admin-dashboard/components/charts/heatmap.tsx` |
| Color Schemes | `blue`, `red`, `green`, `purple`, `diverging` |
| Cell Sizes | `sm` (32px), `md` (48px), `lg` (64px) |
| Animation | Framer Motion staggered scale-in |

**Usage:**
```tsx
<Heatmap
  data={[{ row: 'Model A', col: 'Mon', value: 42 }]}
  rows={['Model A', 'Model B']}
  cols={['Mon', 'Tue', 'Wed']}
  colorScheme="blue"
  showValues={true}
  cellSize="md"
/>
```

**Files**: `apps/admin-dashboard/components/charts/heatmap.tsx`

### Latency Heatmap

Geographic visualization of AWS region latencies.

| Property | Value |
|----------|-------|
| Location | `apps/admin-dashboard/components/geographic/latency-heatmap.tsx` |
| Regions | 17 AWS regions with SVG positioning |
| Thresholds | <50ms (green) → >500ms (red) |
| Animation | Pulse for critical regions |

**Latency Colors:**
| Threshold | Color | Label |
|-----------|-------|-------|
| <50ms | `#22c55e` | Excellent |
| <100ms | `#84cc16` | Good |
| <200ms | `#eab308` | Fair |
| <500ms | `#f97316` | Slow |
| >500ms | `#ef4444` | Critical |

**Files**: `apps/admin-dashboard/components/geographic/latency-heatmap.tsx`

### CBF Violations Heatmap

Content Boundary Framework rule violation analytics.

| Property | Value |
|----------|-------|
| Location | `apps/admin-dashboard/components/analytics/cbf-violations-heatmap.tsx` |
| Grouping | By category (content_safety, pii_detection, etc.) |
| Severity | low (blue), medium (yellow), high (orange), critical (red) |
| Trends | Up/down arrows for violation direction |

**Category Icons:**
| Category | Icon |
|----------|------|
| `content_safety` | 🛡️ |
| `data_privacy` | 🔒 |
| `pii_detection` | 👤 |
| `harmful_content` | ⚠️ |
| `jailbreak` | 🔓 |
| `prompt_injection` | 💉 |

**Files**: `apps/admin-dashboard/components/analytics/cbf-violations-heatmap.tsx`

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

## Category 11: Genesis Forge — Glass Foundry Patterns (v7.15.0)

**Source**: Custom RADIANT "Bioluminescent Industrial" design system for the Behavioral ROM Forge

### Glass Foundry Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| **Background** | `#050505` | Glass Foundry base (near-black) |
| **Glass Panel** | `bg-[#050505]/90 backdrop-blur-[20px]` | Frosted glass side panels |
| **Border** | `border-white/[0.06]` | Ultra-subtle white borders |
| **Accent (Safe)** | `hsl(190, 80%, 60%)` / Cyan | Stability > 70% |
| **Accent (Warning)** | `hsl(30, 80%, 60%)` / Orange | Stability 50-70% |
| **Accent (Emergency)** | `hsl(0, 80%, 60%)` / Red | Stability < 50% |
| **Font** | `JetBrains Mono` | Monospaced — "Dangerous" aesthetic |

**Files**: `apps/genesis/tailwind.config.ts`, `apps/genesis/app/globals.css`

### Shard Node Pattern (React Flow Custom Nodes)

| Shard Type | Color | Animation | Component |
|------------|-------|-----------|-----------|
| **Input** | Green (`#22c55e`) | Heartbeat pulse | `InputShard.tsx` |
| **Logic** | Violet (`#a78bfa`) | Spinning gear when processing | `LogicShard.tsx` |
| **Output** | Amber/Red (power-based) | Power glow pulsation | `OutputShard.tsx` |
| **Safety** | Red (`#ef4444`) | Same as Logic with red accent | `LogicShard.tsx` (category=safety) |

**Shape**: Hexagonal glass prism (`clipPath: polygon(8% 0%, 92% 0%, 100% 15%, 100% 85%, 92% 100%, 8% 100%, 0% 85%, 0% 15%)`)

**Files**: `apps/genesis/components/forge/nodes/`

### Catenary Wire Edge Pattern

| Property | Behavior |
|----------|----------|
| **Shape** | Quadratic bezier approximating catenary (`y = a·cosh(x/a)`) |
| **Sag** | `sagDepth = dist * 0.15 * dataWeight + dataWeight * 60` |
| **Thickness** | `1.5 + dataWeight * 3` px |
| **Particles** | Light dots traveling along path (count = `frequency * 5`) |
| **Rejection** | Red color, vibration animation, spark particles, reason label |

**Files**: `apps/genesis/components/forge/edges/CatenaryEdge.tsx`

### Retractable Panel Pattern

| Panel | Position | Width | Trigger |
|-------|----------|-------|---------|
| **The Armory** | Left | 288px (`w-72`) | Chevron toggle + spring animation |
| **The Oracle** | Right | 288px (`w-72`) | Chevron toggle + spring animation |

**Animation**: Framer Motion spring (`damping: 20, stiffness: 200`)

**Files**: `apps/genesis/components/forge/TheArmory.tsx`, `TheOracle.tsx`

### Reactor Core Button Pattern

| State | Visual |
|-------|--------|
| **Idle** | Dark circle with subtle cyan glow |
| **Charging** | White plasma fills from bottom (clip-path inset) |
| **Release (≥80%)** | Shockwave ripple: expanding circle `60px → 3000px`, fading opacity |
| **Forging** | Spinning loader icon + progress bar |
| **Disabled** | 30% opacity when no shards placed |

**Files**: `apps/genesis/components/forge/ReactorCore.tsx`

### Global Stability → UI Hue Shift

The entire Glass Foundry UI shifts color based on `stability_score` from Shadow Omega:

| Score | Hue | Background Gradient |
|-------|-----|-------------------|
| > 0.7 | Cyan (190°) | `hsl(190, 15%, 4%)` → `#050505` |
| 0.5–0.7 | Orange (30°) | `hsl(30, 15%, 4%)` → `#050505` |
| < 0.5 | Red (0°) | `hsl(0, 15%, 4%)` + red overlay at `0.15 * (1 - score)` opacity |

**Files**: `apps/genesis/components/forge/GlassFoundry.tsx`

### Void Mode Pattern — 9-Layer 3D PCB (Full Implementation)

| Property | Effect |
|----------|--------|
| **Background** | `#000000` (pitch black) |
| **Chrome** | All panels (Armory, Oracle, HUD) hidden |
| **Canvas** | **9-layer 3D PCB board** via Three.js replaces React Flow canvas |
| **Exit** | Floating button top-right |
| **Telemetry HUD** | Top-left overlay: components, traces, power, temp, stability, CPU, RAM |

**9 PCB Layers** (bottom to top):

| # | Layer | Material |
|---|-------|----------|
| 1 | Ground Plane | Copper pour (`#8b5e3c`, metalness 0.85) |
| 2 | FR-4 Substrate | Dark green (`#0b3b0b`, 0.12 thick) |
| 3 | Solder Mask | Translucent green (0.7 opacity) |
| 4 | Etch Trace Grid | `BufferGeometry` line grid, 0.6 spacing |
| 5 | Silkscreen | Board border, `OMEGA-PCB-XX REV.A`, ref designators |
| 6 | IC Chips | SOIC-14: `RoundedBox` body, 7 gull-wing pins/side, pin-1 dot |
| 7 | Solder Pads | Exposed copper `planeGeometry` under each pin |
| 8 | Via Holes | `ringGeometry` + `circleGeometry` at trace bends |
| 9 | Mounting Holes | 4 corner holes with copper annular rings |

**Data-Driven (zero mock data)**:

| Visual | Real Data Source |
|--------|-----------------|
| Chip positions | `rfTo3D(node.position.x, node.position.y)` — actual React Flow coords |
| Pin activity | `sin(t * edge.data.frequency * 6 + phase)` — deterministic, per-edge |
| Trace thickness | `0.015 + edge.data.dataWeight * 0.06` |
| Thermal LED | Continuous HSL: `hue = (1 - tempNorm) * 120` from `node.data.temperature` |
| Ambient light | `stabilityScore` → hue 210°/30°/0° |

**Files**: `apps/genesis/components/forge/VoidModePCB.tsx` (800 LOC), `GlassFoundry.tsx`

### Firmware ROM Forge Pattern — Behavioral Directives

Firmware = immutable behavioral software (not hardware). Burned once, never edited.

| Property | Implementation |
|----------|---------------|
| **Draft state** | Green pulsing dot + "New Draft" header, all fields editable |
| **Read-only state** | Amber banner "Viewing burned ROM — Immutable", all fields disabled, 70% opacity sliders |
| **Burn button** | `bg-gradient-to-r from-orange-600 via-red-600 to-orange-600`, disabled at 30% opacity when no directives |
| **Burn confirmation** | Full-screen modal with 3 states: confirm (red icon) → burning (orange pulse) → success (green check) |
| **ROM timeline** | Right sidebar, vertical timeline line (`w-px bg-omega-700/50`), dot per version |
| **Active version** | Green dot with `shadow-lg shadow-green-500/30`, green border on card |
| **Timestamp primary** | Mono font date + time as primary identifier; optional label below |

**Directive Kinds** (color-coded):

| Kind | Icon | Color | Background |
|------|------|-------|------------|
| Instinct | `Zap` | `text-amber-400` | `bg-amber-500/10` |
| Fear | `Skull` | `text-red-400` | `bg-red-500/10` |
| Moral | `Scale` | `text-emerald-400` | `bg-emerald-500/10` |
| Ambition | `Target` | `text-omega-400` | `bg-omega-500/10` |
| Boundary | `Ban` | `text-orange-400` | `bg-orange-500/10` |

**Weight bar**: 10 clickable segments, color transitions: omega-500 (1-4) → amber-500 (5-7) → red-500 (8-10)

**Files**: `apps/genesis/components/GenesisForge.tsx` (1054 LOC), `apps/genesis/lib/api.ts`

---

## Category 12: Aurelius Dojo — Thematic Mastery Patterns (v7.16.0)

**Source**: Custom RADIANT "Warm Discipline" design system for the Dojo training platform

### Dojo Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| **Background** | `rgb(15, 12, 8)` | Warm near-black base |
| **Glass Panel** | `bg-[#0a0806]/85 backdrop-blur-md` | Frosted glass panels |
| **Border** | `border-dojo-900/20` | Warm amber borders |
| **Primary** | `dojo-500` (#f59e0b) | Amber — discipline glow |
| **Accent** | `omega-500` (#0ea5e9) | Cyan — platform continuity |
| **Pattern** | `tatami-pattern` | 40px grid at 2% amber opacity |
| **Font** | Inter (display) + JetBrains Mono (mono) | Dual-font system |

**Files**: `apps/dojo/tailwind.config.ts`, `apps/dojo/app/globals.css`

### Theme Card Pattern

| Property | Implementation |
|----------|---------------|
| **Idle** | `bg-white/[0.02] border-white/[0.06]` with hover lift |
| **Selected** | `bg-dojo-500/10 border-dojo-500/40 discipline-glow` |
| **Locked** | 50% opacity, `cursor-not-allowed`, Lock icon |
| **Disabled** | 40% opacity (max 3 selected) |
| **Reveal** | `card-reveal` animation: translateY(12px) → 0, staggered 60ms |

**Files**: `apps/dojo/components/ThemeSelector.tsx`

### Sparring Answer Feedback Pattern

| State | Visual |
|-------|--------|
| **Correct** | Green border flash (`sparring-correct`), CheckCircle2 icon, +XP badge |
| **Incorrect** | Red border flash (`sparring-incorrect`), XCircle icon, correct answer shown |
| **Partial** | Yellow percentage badge alongside result |

**Files**: `apps/dojo/components/TrainingArena.tsx`

### Rank Badge Pattern

| Rank | Color Token | Background |
|------|-------------|------------|
| Novice | `text-slate-400` | `bg-slate-500/10` |
| Initiate | `text-green-400` | `bg-green-500/10` |
| Adept | `text-blue-400` | `bg-blue-500/10` |
| Master | `text-purple-400` | `bg-purple-500/10` |
| Radiant | `text-dojo-400` | `bg-dojo-500/10` |

**XP Bar**: `bg-gradient-to-r from-dojo-600 to-dojo-400` with `progress-shimmer` overlay

**Files**: `apps/dojo/components/ProgressDashboard.tsx`, `apps/dojo/lib/utils.ts`

### Mobot Chat Pattern

| Element | Style |
|---------|-------|
| **Mobot bubble** | `mobot-bubble` — amber-tinted glass, rounded-bl-sm |
| **User bubble** | `user-bubble` — cyan-tinted glass, rounded-br-sm, right-aligned |
| **Citations** | Inline below message, FileText icon + document name + excerpt |
| **Loading** | Loader2 spin + "Mobot is thinking..." |

**Files**: `apps/dojo/components/MobotPanel.tsx`

### Decay Engine Pattern (v7.17.0)

| Element | Style |
|---------|-------|
| **Retention bar** | Color gradient based on retention %: green (≥80%), yellow (50-79%), red (<50%) |
| **At-risk badge** | `text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full` |
| **Summary cards** | 4-column grid with icon, value, label; highlight border on at-risk card |
| **Reinforcement quiz** | Same question UI as sparring, with decay context header showing retention % and half-life |
| **Result feedback** | Green: "memory reinforced, half-life increased"; Red: "decay curve reset, half-life shortened" |

**Files**: `apps/dojo/components/DecayEngine.tsx`

### Scenario Arena Pattern (v7.17.0)

| Element | Style |
|---------|-------|
| **Persona picker** | 3-column grid of glass cards, each with icon + archetype label + description |
| **Conversation** | Chat-style layout; persona messages left-aligned with archetype icon; learner right-aligned |
| **Emotional shift** | Italic text `(emotional_shift)` next to persona name |
| **Branch quality** | Inline badge after response: green (optimal), blue (acceptable), yellow (suboptimal), red (critical) |
| **Debrief scores** | 3-column grid: Emotional Intelligence (pink), Policy Adherence (cyan), Resolution (green) |
| **Response timeline** | Numbered list of learner responses with quality icons (CheckCircle2 or XCircle) |

**Files**: `apps/dojo/components/ScenarioArena.tsx`

### Dialectic Arena Pattern (v7.17.0)

| Element | Style |
|---------|-------|
| **Agent colors** | Thesis: green-400, Antithesis: red-400, Synthesis: purple-400, Moderator: dojo-400 |
| **Turn bubbles** | Background matches agent role bg (e.g., `bg-green-500/10` for thesis) |
| **Reasoning type selector** | Horizontal button row: Claim, Evidence, Rebuttal, Concession, Synthesis |
| **Quality score** | Inline percentage after turn header |
| **Citation** | Same FileText + document name pattern as Mobot |
| **Fallacy badges** | Yellow rounded-full pills with fallacy names |

**Files**: `apps/dojo/components/DialecticArena.tsx`

### Competency Mesh Pattern (v7.17.0)

| Element | Style |
|---------|-------|
| **Role readiness** | 2-column cards with score bar, missing competencies, time-to-ready |
| **Competency row** | Level bar (`L{n}/{max}`), trend icon (TrendingUp/Down/Minus), confidence %, gap-to-target |
| **Priority badges** | Critical (red), High (orange), Medium (yellow), Low (green) |
| **Learning path** | Numbered list with priority badges and estimated session count |

**Files**: `apps/dojo/components/CompetencyMesh.tsx`

### Knowledge Pulse Pattern (v7.17.0)

| Element | Style |
|---------|-------|
| **Health hero** | Large centered score with glow shadow matching health color (green/yellow/red) |
| **Metric cards** | 5-column grid: Active Users, New Certs, Cost Savings, Time-to-Competency, Retention Rate |
| **Decay alerts** | Severity-colored cards (critical=red, warning=yellow, info=blue) with icon + message + affected count |
| **Department bars** | Health % bar with at-risk badge, accuracy, training hours, avg rank |
| **Theme coverage** | 2-column grid with trained count, mastery %, decay risk, compliance badge (Compliant/Non-Compliant) |

**Files**: `apps/dojo/components/KnowledgePulse.tsx`

---

## Modifying a Pattern

When modifying an existing pattern:

1. **Review existing documentation** - Understand current pattern
2. **Document the change** - Add to "Pattern Modification History"
3. **Update pattern details** - Modify the relevant section
4. **Test across apps** - Ensure consistency

---

**Policy**: This document is maintained under `/.windsurf/workflows/ui-ux-patterns-policy.md`
