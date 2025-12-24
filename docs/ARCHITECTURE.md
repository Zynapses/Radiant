# Radiant Architecture

## Overview

Radiant is a native macOS application built using SwiftUI and Swift Package Manager. The app follows Apple's recommended patterns for modern macOS development.

## Technology Stack

| Component | Technology |
|-----------|------------|
| Language | Swift 5.9 |
| UI Framework | SwiftUI |
| Build System | Swift Package Manager |
| Minimum OS | macOS 14.0 (Sonoma) |

## Application Structure

### Entry Point

The app uses SwiftUI's `@main` attribute on `RadiantApp.swift`:

```swift
@main
struct RadiantApp: App {
    var body: some Scene {
        WindowGroup { ... }
        Settings { ... }
    }
}
```

### Scene Types

| Scene | Purpose |
|-------|---------|
| `WindowGroup` | Main application window |
| `Settings` | Preferences window (Cmd+,) |

### View Hierarchy

```
RadiantApp
├── WindowGroup
│   └── ContentView
│       └── NavigationSplitView
│           ├── SidebarView (sidebar)
│           └── DetailView (detail)
└── Settings
    └── SettingsView
        ├── GeneralSettingsView
        └── AppearanceSettingsView
```

## Design Patterns

### 1. NavigationSplitView

The main window uses `NavigationSplitView` for a two-column layout:
- **Sidebar**: Navigation list with sections
- **Detail**: Content area that changes based on selection

### 2. AppStorage

User preferences are persisted using `@AppStorage`:
- `launchAtLogin` - Boolean for launch behavior
- `accentColorName` - String for theme accent color

## Directory Structure

```
Sources/Radiant/
├── RadiantApp.swift      # App entry point and scene configuration
├── Views/                # All SwiftUI views
│   ├── ContentView.swift
│   ├── SidebarView.swift
│   ├── DetailView.swift
│   └── SettingsView.swift
└── Resources/            # Bundled assets
```

## Build Configuration

### Package.swift

- **Platform**: macOS 14+
- **Target Type**: Executable
- **Resources**: Processed from `Resources/` directory

## Phase 1 Deliverables

- [x] Swift Package Manager project configuration
- [x] macOS 14 platform target
- [x] SwiftUI app entry point with `@main`
- [x] Main window with NavigationSplitView
- [x] Sidebar navigation structure
- [x] Detail view placeholder
- [x] Settings window with tabs
- [x] AppStorage for user preferences
- [x] Project documentation

## Future Phases

### Phase 2: Core UI
- Main window layout refinement
- Navigation state management
- Dashboard view implementation

### Phase 3: Features
- Core application functionality
- Data models and persistence

### Phase 4: Polish
- Custom styling and theming
- Error handling
- Accessibility

### Phase 5: Distribution
- App bundling
- Code signing
- Notarization
- DMG/installer creation
