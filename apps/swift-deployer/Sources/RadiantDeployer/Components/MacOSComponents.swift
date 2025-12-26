// RADIANT v4.18.0 - macOS UI Components
// Unified component library following Apple Human Interface Guidelines
// Implements: Liquid Glass, NavigationSplitView, Toolbar patterns

import SwiftUI

// MARK: - Design Tokens

enum RadiantSpacing {
    static let xxs: CGFloat = 4
    static let xs: CGFloat = 8
    static let sm: CGFloat = 12
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
}

enum RadiantRadius {
    static let sm: CGFloat = 6
    static let md: CGFloat = 10
    static let lg: CGFloat = 14
    static let xl: CGFloat = 20
}

// MARK: - Glass Surface Modifier

struct GlassSurface: ViewModifier {
    let isProminent: Bool
    
    func body(content: Content) -> some View {
        content
            .background(.ultraThinMaterial)
            .background(isProminent ? Color.blue.opacity(0.05) : Color.clear)
    }
}

extension View {
    func glassSurface(prominent: Bool = false) -> some View {
        modifier(GlassSurface(isProminent: prominent))
    }
}

// MARK: - GlassToolbar

struct GlassToolbar<Leading: View, Trailing: View>: View {
    let title: String?
    let subtitle: String?
    @ViewBuilder let leading: Leading
    @ViewBuilder let trailing: Trailing
    
    init(
        title: String? = nil,
        subtitle: String? = nil,
        @ViewBuilder leading: () -> Leading = { EmptyView() },
        @ViewBuilder trailing: () -> Trailing = { EmptyView() }
    ) {
        self.title = title
        self.subtitle = subtitle
        self.leading = leading()
        self.trailing = trailing()
    }
    
    var body: some View {
        HStack(spacing: RadiantSpacing.md) {
            leading
            
            if let title = title {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline)
                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            
            Spacer()
            
            trailing
        }
        .padding(.horizontal, RadiantSpacing.md)
        .padding(.vertical, RadiantSpacing.sm)
        .background(.bar)
    }
}

// MARK: - Toolbar Action Button

struct ToolbarActionButton: View {
    let title: String
    let icon: String
    let isPrimary: Bool
    let action: () -> Void
    
    init(_ title: String, icon: String, isPrimary: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.icon = icon
        self.isPrimary = isPrimary
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            Label(title, systemImage: icon)
        }
        .if(isPrimary) { view in
            view.buttonStyle(.borderedProminent)
        }
        .if(!isPrimary) { view in
            view.buttonStyle(.bordered)
        }
        .controlSize(.regular)
    }
}

// MARK: - Conditional View Modifier

extension View {
    @ViewBuilder
    func `if`<Transform: View>(_ condition: Bool, transform: (Self) -> Transform) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }
}

// MARK: - Toolbar Action Group

struct ToolbarActionGroup: View {
    let actions: [ToolbarAction]
    
    struct ToolbarAction: Identifiable {
        let id = UUID()
        let title: String
        let icon: String
        let action: () -> Void
    }
    
    var body: some View {
        HStack(spacing: RadiantSpacing.xs) {
            ForEach(actions) { action in
                Button(action: action.action) {
                    Image(systemName: action.icon)
                }
                .buttonStyle(.borderless)
                .help(action.title)
            }
        }
        .padding(.horizontal, RadiantSpacing.xs)
        .padding(.vertical, RadiantSpacing.xxs)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.sm))
    }
}

// MARK: - Overflow Menu

struct OverflowMenu: View {
    let items: [MenuItem]
    
    struct MenuItem: Identifiable {
        let id = UUID()
        let title: String
        let icon: String
        let action: () -> Void
        var isDivider: Bool = false
        var isDestructive: Bool = false
    }
    
    var body: some View {
        Menu {
            ForEach(items) { item in
                if item.isDivider {
                    Divider()
                } else {
                    Button(action: item.action) {
                        Label(item.title, systemImage: item.icon)
                    }
                    .foregroundStyle(item.isDestructive ? .red : .primary)
                }
            }
        } label: {
            Image(systemName: "ellipsis.circle")
                .font(.title3)
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
    }
}

// MARK: - Content Header

struct ContentHeader: View {
    let title: String
    let subtitle: String?
    let breadcrumbs: [String]
    let filterChips: [FilterChip]
    let onRemoveFilter: ((String) -> Void)?
    
    struct FilterChip: Identifiable {
        let id: String
        let label: String
        let color: Color
    }
    
    init(
        title: String,
        subtitle: String? = nil,
        breadcrumbs: [String] = [],
        filterChips: [FilterChip] = [],
        onRemoveFilter: ((String) -> Void)? = nil
    ) {
        self.title = title
        self.subtitle = subtitle
        self.breadcrumbs = breadcrumbs
        self.filterChips = filterChips
        self.onRemoveFilter = onRemoveFilter
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
            // Breadcrumbs
            if !breadcrumbs.isEmpty {
                HStack(spacing: RadiantSpacing.xs) {
                    ForEach(Array(breadcrumbs.enumerated()), id: \.offset) { index, crumb in
                        if index > 0 {
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                        Text(crumb)
                            .font(.caption)
                            .foregroundStyle(index == breadcrumbs.count - 1 ? .primary : .secondary)
                    }
                }
            }
            
            // Title
            HStack(alignment: .firstTextBaseline, spacing: RadiantSpacing.sm) {
                Text(title)
                    .font(.title2.bold())
                
                if let subtitle = subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            
            // Filter Chips
            if !filterChips.isEmpty {
                HStack(spacing: RadiantSpacing.xs) {
                    ForEach(filterChips) { chip in
                        HStack(spacing: RadiantSpacing.xxs) {
                            Text(chip.label)
                                .font(.caption)
                            
                            if onRemoveFilter != nil {
                                Button {
                                    onRemoveFilter?(chip.id)
                                } label: {
                                    Image(systemName: "xmark")
                                        .font(.caption2)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, RadiantSpacing.sm)
                        .padding(.vertical, RadiantSpacing.xxs)
                        .background(chip.color.opacity(0.15))
                        .foregroundStyle(chip.color)
                        .clipShape(Capsule())
                    }
                    
                    if filterChips.count > 1 {
                        Button("Clear All") {
                            filterChips.forEach { onRemoveFilter?($0.id) }
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(RadiantSpacing.md)
    }
}

// MARK: - Sidebar Section

struct SidebarSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content
    
    var body: some View {
        Section {
            content
        } header: {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: - Sidebar Row

struct SidebarRow: View {
    let title: String
    let icon: String
    let iconColor: Color
    let badge: Int?
    let isSelected: Bool
    
    init(
        title: String,
        icon: String,
        iconColor: Color = .secondary,
        badge: Int? = nil,
        isSelected: Bool = false
    ) {
        self.title = title
        self.icon = icon
        self.iconColor = iconColor
        self.badge = badge
        self.isSelected = isSelected
    }
    
    var body: some View {
        HStack(spacing: RadiantSpacing.sm) {
            Image(systemName: icon)
                .foregroundStyle(iconColor)
                .frame(width: 20)
            
            Text(title)
                .lineLimit(1)
            
            Spacer()
            
            if let badge = badge, badge > 0 {
                Text("\(badge)")
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.blue)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
            }
        }
        .padding(.vertical, RadiantSpacing.xxs)
    }
}

// MARK: - List Row

struct DataListRow<Accessory: View>: View {
    let title: String
    let subtitle: String?
    let icon: String?
    let iconColor: Color
    let statusIcon: String?
    let statusColor: Color
    @ViewBuilder let accessory: Accessory
    
    init(
        title: String,
        subtitle: String? = nil,
        icon: String? = nil,
        iconColor: Color = .secondary,
        statusIcon: String? = nil,
        statusColor: Color = .green,
        @ViewBuilder accessory: () -> Accessory = { EmptyView() }
    ) {
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.iconColor = iconColor
        self.statusIcon = statusIcon
        self.statusColor = statusColor
        self.accessory = accessory()
    }
    
    var body: some View {
        HStack(spacing: RadiantSpacing.sm) {
            // Icon
            if let icon = icon {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundStyle(iconColor)
                    .frame(width: 32, height: 32)
                    .background(iconColor.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.sm))
            }
            
            // Content
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: RadiantSpacing.xs) {
                    Text(title)
                        .font(.body.weight(.medium))
                    
                    if let statusIcon = statusIcon {
                        Image(systemName: statusIcon)
                            .font(.caption)
                            .foregroundStyle(statusColor)
                    }
                }
                
                if let subtitle = subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            
            Spacer()
            
            accessory
        }
        .padding(.vertical, RadiantSpacing.xs)
        .padding(.horizontal, RadiantSpacing.sm)
        .contentShape(Rectangle())
    }
}

// MARK: - Inspector Panel

struct InspectorPanel<Content: View>: View {
    let title: String
    let isVisible: Bool
    @ViewBuilder let content: Content
    
    var body: some View {
        if isVisible {
            VStack(alignment: .leading, spacing: 0) {
                // Header
                HStack {
                    Text(title)
                        .font(.headline)
                    Spacer()
                }
                .padding(RadiantSpacing.md)
                .background(.bar)
                
                Divider()
                
                // Content
                ScrollView {
                    VStack(alignment: .leading, spacing: RadiantSpacing.md) {
                        content
                    }
                    .padding(RadiantSpacing.md)
                }
            }
            .frame(width: 280)
            .background(Color(nsColor: .windowBackgroundColor))
        }
    }
}

// MARK: - Inspector Section

struct InspectorSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content
    
    var body: some View {
        VStack(alignment: .leading, spacing: RadiantSpacing.sm) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            
            content
        }
    }
}

// MARK: - Inspector Row

struct InspectorRow: View {
    let label: String
    let value: String
    let valueColor: Color
    
    init(label: String, value: String, valueColor: Color = .primary) {
        self.label = label
        self.value = value
        self.valueColor = valueColor
    }
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .foregroundStyle(valueColor)
        }
        .font(.callout)
    }
}

// MARK: - State Views

struct LoadingStateView: View {
    let message: String
    
    init(_ message: String = "Loading...") {
        self.message = message
    }
    
    var body: some View {
        VStack(spacing: RadiantSpacing.md) {
            ProgressView()
                .controlSize(.large)
            Text(message)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct RadiantEmptyState: View {
    let icon: String
    let title: String
    let message: String
    let actionTitle: String?
    let action: (() -> Void)?
    
    init(
        icon: String,
        title: String,
        message: String,
        actionTitle: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.icon = icon
        self.title = title
        self.message = message
        self.actionTitle = actionTitle
        self.action = action
    }
    
    var body: some View {
        VStack(spacing: RadiantSpacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)
            
            VStack(spacing: RadiantSpacing.xs) {
                Text(title)
                    .font(.title3.weight(.semibold))
                
                Text(message)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 300)
            }
            
            if let actionTitle = actionTitle, let action = action {
                Button(actionTitle, action: action)
                    .buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct ErrorStateView: View {
    let title: String
    let description: String
    let retryAction: (() -> Void)?
    let detailsAction: (() -> Void)?
    
    init(
        title: String = "Something went wrong",
        description: String,
        retryAction: (() -> Void)? = nil,
        detailsAction: (() -> Void)? = nil
    ) {
        self.title = title
        self.description = description
        self.retryAction = retryAction
        self.detailsAction = detailsAction
    }
    
    var body: some View {
        VStack(spacing: RadiantSpacing.lg) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
                .foregroundStyle(.orange)
            
            VStack(spacing: RadiantSpacing.xs) {
                Text(title)
                    .font(.title3.weight(.semibold))
                
                Text(description)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 300)
            }
            
            HStack(spacing: RadiantSpacing.sm) {
                if let retryAction = retryAction {
                    Button("Try Again", action: retryAction)
                        .buttonStyle(.borderedProminent)
                }
                
                if let detailsAction = detailsAction {
                    Button("View Details", action: detailsAction)
                        .buttonStyle(.bordered)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Toast Banner

struct ToastBanner: View {
    let message: String
    let type: ToastType
    let action: (() -> Void)?
    let actionTitle: String?
    
    enum ToastType {
        case success, error, warning, info
        
        var icon: String {
            switch self {
            case .success: return "checkmark.circle.fill"
            case .error: return "xmark.circle.fill"
            case .warning: return "exclamationmark.triangle.fill"
            case .info: return "info.circle.fill"
            }
        }
        
        var color: Color {
            switch self {
            case .success: return .green
            case .error: return .red
            case .warning: return .orange
            case .info: return .blue
            }
        }
    }
    
    var body: some View {
        HStack(spacing: RadiantSpacing.sm) {
            Image(systemName: type.icon)
                .foregroundStyle(type.color)
            
            Text(message)
                .font(.callout)
            
            Spacer()
            
            if let actionTitle = actionTitle, let action = action {
                Button(actionTitle, action: action)
                    .buttonStyle(.borderless)
                    .foregroundStyle(Color.blue)
            }
        }
        .padding(RadiantSpacing.md)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
        .shadow(color: .black.opacity(0.1), radius: 8, y: 4)
    }
}

// MARK: - Context Menu Builder

struct StandardContextMenu: View {
    let onView: (() -> Void)?
    let onEdit: (() -> Void)?
    let onDuplicate: (() -> Void)?
    let onShare: (() -> Void)?
    let onDelete: (() -> Void)?
    
    var body: some View {
        Group {
            if let onView = onView {
                Button(action: onView) {
                    Label("View", systemImage: "eye")
                }
            }
            
            if let onEdit = onEdit {
                Button(action: onEdit) {
                    Label("Edit", systemImage: "pencil")
                }
            }
            
            if let onDuplicate = onDuplicate {
                Button(action: onDuplicate) {
                    Label("Duplicate", systemImage: "doc.on.doc")
                }
            }
            
            if onView != nil || onEdit != nil || onDuplicate != nil {
                Divider()
            }
            
            if let onShare = onShare {
                Button(action: onShare) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
            }
            
            if let onDelete = onDelete {
                Divider()
                Button(role: .destructive, action: onDelete) {
                    Label("Delete", systemImage: "trash")
                }
            }
        }
    }
}

// MARK: - Keyboard Shortcut Helper

struct KeyboardShortcutLabel: View {
    let title: String
    let shortcut: String
    
    var body: some View {
        HStack {
            Text(title)
            Spacer()
            Text(shortcut)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
