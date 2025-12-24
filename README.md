# Radiant

A native macOS application built with SwiftUI.

## Requirements

- macOS 14.0 (Sonoma) or later
- Xcode 15.0+ or Swift 5.9+

## Building

### Using Swift Package Manager

```bash
swift build
```

### Running in Debug Mode

```bash
swift run
```

### Building for Release

```bash
swift build -c release
```

The binary will be located at `.build/release/Radiant`

## Project Structure

```
Radiant/
├── Package.swift              # Swift Package Manager manifest
├── Sources/
│   └── Radiant/
│       ├── RadiantApp.swift   # App entry point (@main)
│       ├── Views/
│       │   ├── ContentView.swift    # Main window content
│       │   ├── SidebarView.swift    # Navigation sidebar
│       │   ├── DetailView.swift     # Detail panel
│       │   └── SettingsView.swift   # Settings window
│       └── Resources/         # App resources (images, etc.)
├── docs/
│   └── ARCHITECTURE.md        # Technical architecture documentation
└── README.md
```

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md) - Technical design and architecture

## License

MIT
