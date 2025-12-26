# RADIANT Deployer - macOS Design Guidelines

> **Version:** 4.18.0  
> **Last Updated:** December 2024  
> **Platform:** macOS 13.0+ (Ventura and later)

## Overview

This document defines the 10 macOS UI/UX patterns enforced in the RADIANT Deployer app. All future UI changes **MUST** follow these guidelines.

---

## 1. Mac-first Window Layout: Sidebar + Content + Optional Inspector

**Pattern:** `NavigationSplitView` with left sidebar and primary content pane; optional right Inspector.

```swift
NavigationSplitView(columnVisibility: $appState.columnVisibility) {
    AppSidebar()
} detail: {
    HSplitView {
        ContentView()
        if appState.showInspector {
            AppInspector()
        }
    }
}
```

**Rules:**
- Sidebar contains: top-level sections + saved views
- Content pane: list/table + filters/search + detail
- Inspector: contextual properties (not the main reading surface)
- Glass surfaces: sidebar + inspector can be glass that floats above content

**Components:** `AppWindowShell`, `AppSidebar`, `AppInspector`

---

## 2. Functional Layer Only: Glass on Navigation + Controls, Not Content

**Pattern:** Liquid Glass is for controls and navigation only, floating above content.

**Rules:**
- ✅ Glass belongs to: toolbar, sidebar, inspector chrome, floating controls
- ❌ Content (tables, editors, detail text) stays solid and legible
- ❌ Avoid "glass-on-glass": don't stack multiple glass layers

```swift
// Correct: Glass on toolbar
.background(.bar)
.background(.ultraThinMaterial)

// Incorrect: Glass on content
// Don't use .ultraThinMaterial on tables or text content
```

**Components:** `GlassSurface`, `GlassToolbar`

---

## 3. Toolbar-as-Command-Center (Grouped Actions + Overflow)

**Pattern:** Toolbars on glass surface with automatic grouping.

**Rules:**
- One **primary** action (e.g., Deploy)
- A small cluster of **frequent** actions (2–4)
- Everything else goes into an **overflow Menu**
- Keep the toolbar consistent across screens

```swift
.toolbar {
    ToolbarItemGroup(placement: .primaryAction) {
        Button("Deploy") { ... }
            .buttonStyle(.borderedProminent)
    }
    
    ToolbarItemGroup(placement: .automatic) {
        ControlGroup {
            Button { } label: { Image(systemName: "arrow.clockwise") }
            Button { } label: { Image(systemName: "sidebar.trailing") }
        }
        
        Menu { ... } label: { Image(systemName: "ellipsis.circle") }
    }
}
```

**Components:** `PrimaryToolbarActions`, `SecondaryToolbarActions`, `OverflowMenu`

---

## 4. Scroll Edge Effects for Legibility Under Floating UI

**Pattern:** Lists/tables scroll edge-to-edge behind floating toolbar/sidebar.

**Rules:**
- Use system scroll edge effects (don't fake with custom blurs)
- Content scrolls "behind" the floating UI elements
- Ensure readability at all scroll positions

```swift
ScrollView {
    content
}
.scrollContentBackground(.hidden)
```

---

## 5. Master List/Table → Detail (3-level: List, Detail, Activity/History)

**Pattern:** Mac productivity app navigation.

**Rules:**
- **List** (left/center): supports sort, filter, multi-select, bulk actions
- **Detail view**: Overview + Activity/History + Settings/Properties
- Keep navigation stable; selection drives detail/inspector updates

```swift
// Detail View Structure
DetailViewContainer(title: "App Name", subtitle: "Description") {
    DetailSection(title: "Overview", icon: "info.circle") { ... }
    DetailSection(title: "Activity", icon: "clock") { ... }
    DetailSection(title: "Settings", icon: "gearshape") { ... }
}
```

**Components:** `DetailViewContainer`, `DetailSection`, `KeyValueGrid`, `ActivityTimeline`

---

## 6. Search is a First-Class Mac Pattern (Toolbar trailing)

**Pattern:** Search in toolbar (top-trailing) with filter chips.

**Rules:**
- Put search in the toolbar (top-trailing)
- Show active filters as removable chips near the top of content
- Include "Saved Views" (smart filters) in the sidebar

```swift
// Sidebar with searchable
List(selection: $selection) { ... }
    .searchable(text: $searchText, placement: .sidebar)

// Content area with filter chips
FilterChipGroup(filters: activeFilters, onRemove: { ... })
```

**Components:** `SidebarSearch`, `FilterChipGroup`, `ContentHeader`

---

## 7. Tables for Data, Lists for Lightweight Collections

**Rules:**
- Use **Table** for multi-column data (sorting, resizing columns, dense info)
- Use **List** for simple collections
- Row affordances: status icon/badge, secondary text, right-side quick action

```swift
// Data Table
DataTable(items: apps, selection: $selection, columns: [...]) { item in
    AppRow(app: item, ...)
}

// Simple List
List(items) { item in
    DataListRow(title: item.name, subtitle: item.description, ...)
}
```

**Components:** `DataTable`, `DataListRow`, `AppRow`, `InstanceRow`, `DeploymentRow`

---

## 8. Mac Interaction Model: Multi-select, Context Menus, Drag & Drop

**Rules:**
- Support multi-select + bulk actions (toolbar and/or contextual)
- Right-click context menus mirror toolbar actions
- Drag & drop between sidebar categories, lists, fields

```swift
// Context Menu
.contextMenu {
    Button { } label: { Label("View", systemImage: "eye") }
    Button { } label: { Label("Edit", systemImage: "pencil") }
    Divider()
    Button(role: .destructive) { } label: { Label("Delete", systemImage: "trash") }
}

// Bulk Actions
BulkActionBar(selectedCount: selection.count, actions: [...])
```

**Components:** `StandardContextMenu`, `BulkActionBar`

---

## 9. Menu Bar + Keyboard Shortcuts (Real Mac App Feel)

**Rules:**
- Define app-wide commands in the menu bar (File/Edit/View/Window/Help)
- Every frequent action gets a keyboard shortcut
- Command palette (if added) must reflect menu commands

```swift
// App Commands
struct RadiantCommands: Commands {
    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button("New Deployment...") { ... }
                .keyboardShortcut("n", modifiers: .command)
        }
        
        CommandMenu("Environment") {
            Button("Switch to Development") { ... }
                .keyboardShortcut("d", modifiers: [.command, .shift])
        }
    }
}
```

**Keyboard Shortcuts:**
| Action | Shortcut |
|--------|----------|
| New Deployment | ⌘N |
| Deploy | ⌘D |
| Refresh | ⌘R |
| Toggle Inspector | ⌥⌘I |
| AI Assistant | ⌘. |
| View Dashboard | ⌘1 |
| View Apps | ⌘2 |
| View Deployments | ⌘3 |
| Switch to Dev | ⇧⌘D |
| Switch to Staging | ⇧⌘S |
| Switch to Prod | ⇧⌘P |

**Components:** `RadiantCommands`

---

## 10. macOS Settings Window + Inspectors

**Rules:**
- Use a dedicated **Settings window** with categories in sidebar
- Keep per-item settings in the **Inspector**, not buried in Settings
- Use confirmations sparingly; favor **Undo** for safe reversals

```swift
// Settings Scene
Settings {
    SettingsView()
}

// Inspector for contextual settings
InspectorPanel(title: "Properties", isVisible: showInspector) {
    InspectorSection(title: "Configuration") { ... }
}
```

**Components:** `InspectorPanel`, `InspectorSection`, `InspectorRow`

---

## Component Inventory

### Core Components (in `Components/`)

| Component | File | Description |
|-----------|------|-------------|
| `RadiantSpacing` | MacOSComponents.swift | Design tokens for spacing |
| `RadiantRadius` | MacOSComponents.swift | Design tokens for corner radius |
| `GlassSurface` | MacOSComponents.swift | Glass material modifier |
| `GlassToolbar` | MacOSComponents.swift | Unified toolbar with glass |
| `ToolbarActionButton` | MacOSComponents.swift | Toolbar action button |
| `ToolbarActionGroup` | MacOSComponents.swift | Grouped toolbar actions |
| `OverflowMenu` | MacOSComponents.swift | Overflow menu for actions |
| `ContentHeader` | MacOSComponents.swift | Header with breadcrumbs/filters |
| `SidebarSection` | MacOSComponents.swift | Sidebar section header |
| `SidebarRow` | MacOSComponents.swift | Sidebar navigation row |
| `DataListRow` | MacOSComponents.swift | Generic list row |
| `InspectorPanel` | MacOSComponents.swift | Right inspector panel |
| `InspectorSection` | MacOSComponents.swift | Inspector section |
| `InspectorRow` | MacOSComponents.swift | Inspector key-value row |
| `LoadingStateView` | MacOSComponents.swift | Loading state |
| `RadiantEmptyState` | MacOSComponents.swift | Empty state with CTA |
| `ErrorStateView` | MacOSComponents.swift | Error state with retry |
| `ToastBanner` | MacOSComponents.swift | Toast notification |
| `StandardContextMenu` | MacOSComponents.swift | Standard context menu |

### Data Table Components (in `Components/DataTableComponents.swift`)

| Component | Description |
|-----------|-------------|
| `DataTable` | Multi-column data table with selection |
| `SelectableListRow` | Selectable list row |
| `AppRow` | Application list row |
| `RadiantStatusBadge` | Status badge pill |
| `RadiantInstanceRow` | Instance list row |
| `DeploymentRow` | Deployment history row |
| `BulkActionBar` | Multi-select action bar |
| `SortPicker` | Sort options picker |
| `FilterChipGroup` | Active filter chips |

### Detail View Components (in `Components/DetailViewComponents.swift`)

| Component | Description |
|-----------|-------------|
| `DetailViewContainer` | Detail view wrapper |
| `DetailSection` | Detail section with icon |
| `KeyValueGrid` | Key-value display grid |
| `ActivityTimeline` | Activity history timeline |
| `RelatedItemsSection` | Related items section |
| `AppDetailView` | App detail view |
| `EnvironmentCard` | Environment status card |
| `ActionCard` | Quick action card |
| `TabbedDetailView` | Tabbed detail view |

### App Commands (in `Components/AppCommands.swift`)

| Component | Description |
|-----------|-------------|
| `RadiantCommands` | Menu bar commands |

---

## Usage Examples

### Creating a New View

```swift
struct MyNewView: View {
    @EnvironmentObject var appState: AppState
    @State private var selection = Set<Item.ID>()
    
    var body: some View {
        VStack(spacing: 0) {
            // Content Header
            ContentHeader(
                title: "My View",
                subtitle: "Manage items",
                filterChips: activeFilters
            )
            
            // Content
            if isLoading {
                LoadingStateView("Loading items...")
            } else if items.isEmpty {
                RadiantEmptyState(
                    icon: "tray",
                    title: "No Items",
                    message: "Create your first item to get started.",
                    actionTitle: "Create Item"
                ) { createItem() }
            } else {
                List(items, selection: $selection) { item in
                    DataListRow(
                        title: item.name,
                        subtitle: item.description,
                        icon: "doc"
                    )
                    .contextMenu {
                        StandardContextMenu(
                            onView: { viewItem(item) },
                            onEdit: { editItem(item) },
                            onDelete: { deleteItem(item) }
                        )
                    }
                }
            }
            
            // Bulk Actions
            if !selection.isEmpty {
                BulkActionBar(
                    selectedCount: selection.count,
                    onClearSelection: { selection.removeAll() },
                    actions: [
                        .init(title: "Delete", icon: "trash", isDestructive: true) {
                            deleteSelected()
                        }
                    ]
                )
            }
        }
    }
}
```

---

## Enforcement

All Pull Requests modifying Swift Deployer UI must:

1. ✅ Use components from the inventory (no custom implementations)
2. ✅ Follow the 10 patterns defined above
3. ✅ Include keyboard shortcuts for new actions
4. ✅ Support multi-select where applicable
5. ✅ Provide loading, empty, and error states
6. ✅ Use proper spacing tokens (`RadiantSpacing`)
7. ✅ Use proper corner radius tokens (`RadiantRadius`)

---

## References

- [Apple Human Interface Guidelines - macOS](https://developer.apple.com/design/human-interface-guidelines/macos)
- [WWDC25 - Liquid Glass Design](https://developer.apple.com/wwdc25/)
- [SwiftUI NavigationSplitView](https://developer.apple.com/documentation/swiftui/navigationsplitview)
