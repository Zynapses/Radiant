// RADIANT v4.18.0 - Data Table Components
// Implements: Pattern 7 (Tables for Data), Pattern 8 (Multi-select, Context Menus, Drag & Drop)

import SwiftUI

// MARK: - Data Table

struct DataTable<Item: Identifiable & Hashable, Content: View>: View {
    let items: [Item]
    @Binding var selection: Set<Item.ID>
    let columns: [TableColumn<Item>]
    @ViewBuilder let rowContent: (Item) -> Content
    let onRowAction: ((Item, RowAction) -> Void)?
    
    enum RowAction {
        case view, edit, duplicate, delete
    }
    
    struct TableColumn<T> {
        let title: String
        let width: CGFloat?
        let alignment: Alignment
        
        init(title: String, width: CGFloat? = nil, alignment: Alignment = .leading) {
            self.title = title
            self.width = width
            self.alignment = alignment
        }
    }
    
    init(
        items: [Item],
        selection: Binding<Set<Item.ID>>,
        columns: [TableColumn<Item>],
        onRowAction: ((Item, RowAction) -> Void)? = nil,
        @ViewBuilder rowContent: @escaping (Item) -> Content
    ) {
        self.items = items
        self._selection = selection
        self.columns = columns
        self.onRowAction = onRowAction
        self.rowContent = rowContent
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: 0) {
                ForEach(Array(columns.enumerated()), id: \.offset) { index, column in
                    Text(column.title)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: column.width ?? .infinity, alignment: column.alignment)
                        .padding(.horizontal, RadiantSpacing.sm)
                        .padding(.vertical, RadiantSpacing.xs)
                    
                    if index < columns.count - 1 {
                        Divider()
                    }
                }
            }
            .background(Color(nsColor: .controlBackgroundColor))
            
            Divider()
            
            // Rows
            List(items, id: \.id, selection: $selection) { item in
                rowContent(item)
                    .contextMenu {
                        if let onRowAction = onRowAction {
                            Button {
                                onRowAction(item, .view)
                            } label: {
                                Label("View", systemImage: "eye")
                            }
                            
                            Button {
                                onRowAction(item, .edit)
                            } label: {
                                Label("Edit", systemImage: "pencil")
                            }
                            
                            Button {
                                onRowAction(item, .duplicate)
                            } label: {
                                Label("Duplicate", systemImage: "doc.on.doc")
                            }
                            
                            Divider()
                            
                            Button(role: .destructive) {
                                onRowAction(item, .delete)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
            }
            .listStyle(.plain)
        }
    }
}

// MARK: - Selectable List Row

struct SelectableListRow<Content: View>: View {
    let isSelected: Bool
    @ViewBuilder let content: Content
    
    var body: some View {
        HStack(spacing: RadiantSpacing.sm) {
            content
        }
        .padding(.vertical, RadiantSpacing.xs)
        .padding(.horizontal, RadiantSpacing.sm)
        .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.sm))
    }
}

// MARK: - App Row (Pattern 5 - List Detail)

struct AppRow: View {
    let app: ManagedApp
    let isSelected: Bool
    let environment: DeployEnvironment
    let onSelect: () -> Void
    
    private var envStatus: EnvironmentStatus {
        app.environments[environment]
    }
    
    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: RadiantSpacing.md) {
                // App Icon
                ZStack {
                    RoundedRectangle(cornerRadius: RadiantRadius.md)
                        .fill(appColor.opacity(0.15))
                    
                    Image(systemName: appIcon)
                        .font(.title2)
                        .foregroundStyle(appColor)
                }
                .frame(width: 44, height: 44)
                
                // App Info
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: RadiantSpacing.xs) {
                        Text(app.name)
                            .font(.headline)
                        
                        if envStatus.deployed {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.caption)
                                .foregroundStyle(.green)
                        }
                    }
                    
                    Text(app.domain)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                // Status
                VStack(alignment: .trailing, spacing: 2) {
                    RadiantStatusBadge(
                        status: envStatus.deployed ? "Deployed" : "Not Deployed",
                        color: envStatus.deployed ? .green : .secondary
                    )
                    
                    if envStatus.deployed, let version = envStatus.version {
                        Text("v\(version)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                
                // Quick Action
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(RadiantSpacing.sm)
            .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
        }
        .buttonStyle(.plain)
    }
    
    private var appIcon: String {
        switch app.id {
        case "thinktank": return "brain.head.profile"
        case "launchboard": return "rocket.fill"
        case "alwaysme": return "person.fill"
        case "mechanicalmaker": return "gearshape.2.fill"
        default: return "app.fill"
        }
    }
    
    private var appColor: Color {
        switch app.id {
        case "thinktank": return .purple
        case "launchboard": return .orange
        case "alwaysme": return .blue
        case "mechanicalmaker": return .green
        default: return .gray
        }
    }
}

// MARK: - Radiant Status Badge

struct RadiantStatusBadge: View {
    let status: String
    let color: Color
    
    var body: some View {
        Text(status)
            .font(.caption2.weight(.medium))
            .padding(.horizontal, RadiantSpacing.xs)
            .padding(.vertical, 2)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}

// MARK: - Radiant Instance Row

struct RadiantInstanceRow: View {
    let name: String
    let environment: DeployEnvironment
    let status: HealthStatus
    let version: String?
    let lastUpdated: Date?
    let isSelected: Bool
    
    var body: some View {
        HStack(spacing: RadiantSpacing.md) {
            // Status Indicator
            Circle()
                .fill(statusColor)
                .frame(width: 10, height: 10)
            
            // Instance Info
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.body.weight(.medium))
                
                HStack(spacing: RadiantSpacing.xs) {
                    Text(environment.shortName)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(environment.color.opacity(0.15))
                        .foregroundStyle(environment.color)
                        .clipShape(Capsule())
                    
                    if let version = version {
                        Text("v\(version)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            
            Spacer()
            
            // Last Updated
            if let lastUpdated = lastUpdated {
                Text(lastUpdated, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            // Status Badge
            RadiantStatusBadge(status: status.rawValue.capitalized, color: statusColor)
        }
        .padding(RadiantSpacing.sm)
        .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.sm))
    }
    
    private var statusColor: Color {
        switch status {
        case .healthy: return .green
        case .degraded: return .orange
        case .unhealthy: return .red
        case .unknown: return .gray
        }
    }
}

// MARK: - Deployment Row

struct DeploymentRow: View {
    let deployment: DeploymentLog
    let isSelected: Bool
    
    struct DeploymentLog: Identifiable {
        let id: String
        let appName: String
        let environment: DeployEnvironment
        let action: DeploymentAction
        let status: DeploymentStatus
        let startedAt: Date
        let completedAt: Date?
        let triggeredBy: String
        
        enum DeploymentAction: String {
            case install = "Install"
            case update = "Update"
            case rollback = "Rollback"
            case destroy = "Destroy"
        }
        
        enum DeploymentStatus: String {
            case pending, running, completed, failed, cancelled
        }
    }
    
    var body: some View {
        HStack(spacing: RadiantSpacing.md) {
            // Action Icon
            ZStack {
                Circle()
                    .fill(actionColor.opacity(0.15))
                
                Image(systemName: actionIcon)
                    .font(.caption)
                    .foregroundStyle(actionColor)
            }
            .frame(width: 32, height: 32)
            
            // Deployment Info
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: RadiantSpacing.xs) {
                    Text(deployment.appName)
                        .font(.body.weight(.medium))
                    
                    Text("•")
                        .foregroundStyle(.tertiary)
                    
                    Text(deployment.action.rawValue)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                HStack(spacing: RadiantSpacing.xs) {
                    Text(deployment.environment.shortName)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(deployment.environment.color.opacity(0.15))
                        .foregroundStyle(deployment.environment.color)
                        .clipShape(Capsule())
                    
                    Text("by \(deployment.triggeredBy)")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
            
            Spacer()
            
            // Timing
            VStack(alignment: .trailing, spacing: 2) {
                Text(deployment.startedAt, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                
                if let completed = deployment.completedAt {
                    let duration = completed.timeIntervalSince(deployment.startedAt)
                    Text(formatDuration(duration))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
            
            // Status
            RadiantStatusBadge(status: deployment.status.rawValue.capitalized, color: statusColor)
        }
        .padding(RadiantSpacing.sm)
        .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.sm))
    }
    
    private var actionIcon: String {
        switch deployment.action {
        case .install: return "arrow.down.circle"
        case .update: return "arrow.up.circle"
        case .rollback: return "arrow.uturn.backward.circle"
        case .destroy: return "trash.circle"
        }
    }
    
    private var actionColor: Color {
        switch deployment.action {
        case .install: return .green
        case .update: return .blue
        case .rollback: return .orange
        case .destroy: return .red
        }
    }
    
    private var statusColor: Color {
        switch deployment.status {
        case .pending: return .gray
        case .running: return .blue
        case .completed: return .green
        case .failed: return .red
        case .cancelled: return .orange
        }
    }
    
    private func formatDuration(_ interval: TimeInterval) -> String {
        let minutes = Int(interval) / 60
        let seconds = Int(interval) % 60
        return "\(minutes)m \(seconds)s"
    }
}

// MARK: - Bulk Action Bar

struct BulkActionBar: View {
    let selectedCount: Int
    let onClearSelection: () -> Void
    let actions: [BulkAction]
    
    struct BulkAction {
        let title: String
        let icon: String
        let isDestructive: Bool
        let action: () -> Void
        
        init(title: String, icon: String, isDestructive: Bool = false, action: @escaping () -> Void) {
            self.title = title
            self.icon = icon
            self.isDestructive = isDestructive
            self.action = action
        }
    }
    
    var body: some View {
        HStack(spacing: RadiantSpacing.md) {
            // Selection Count
            HStack(spacing: RadiantSpacing.xs) {
                Text("\(selectedCount)")
                    .font(.headline)
                Text("selected")
                    .foregroundStyle(.secondary)
                
                Button {
                    onClearSelection()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            
            Divider()
                .frame(height: 20)
            
            // Actions
            ForEach(Array(actions.enumerated()), id: \.offset) { _, action in
                Button(action: action.action) {
                    Label(action.title, systemImage: action.icon)
                }
                .buttonStyle(.borderless)
                .foregroundStyle(action.isDestructive ? .red : .primary)
            }
            
            Spacer()
        }
        .padding(RadiantSpacing.sm)
        .background(.bar)
        .clipShape(RoundedRectangle(cornerRadius: RadiantRadius.md))
        .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
    }
}

// MARK: - Sort Options

struct SortPicker<T: Hashable>: View {
    let options: [(value: T, label: String)]
    @Binding var selection: T
    @Binding var ascending: Bool
    
    var body: some View {
        Menu {
            ForEach(options, id: \.value) { option in
                Button {
                    if selection == option.value {
                        ascending.toggle()
                    } else {
                        selection = option.value
                        ascending = true
                    }
                } label: {
                    HStack {
                        Text(option.label)
                        if selection == option.value {
                            Image(systemName: ascending ? "chevron.up" : "chevron.down")
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: RadiantSpacing.xxs) {
                Image(systemName: "arrow.up.arrow.down")
                Text("Sort")
            }
            .font(.callout)
        }
        .menuStyle(.borderlessButton)
    }
}

// MARK: - Filter Chip Group

struct FilterChipGroup: View {
    let filters: [ActiveFilter]
    let onRemove: (String) -> Void
    let onClearAll: () -> Void
    
    struct ActiveFilter: Identifiable {
        let id: String
        let label: String
        let color: Color
    }
    
    var body: some View {
        HStack(spacing: RadiantSpacing.xs) {
            ForEach(filters) { filter in
                HStack(spacing: RadiantSpacing.xxs) {
                    Text(filter.label)
                        .font(.caption)
                    
                    Button {
                        onRemove(filter.id)
                    } label: {
                        Image(systemName: "xmark")
                            .font(.caption2)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, RadiantSpacing.sm)
                .padding(.vertical, RadiantSpacing.xxs)
                .background(filter.color.opacity(0.15))
                .foregroundStyle(filter.color)
                .clipShape(Capsule())
            }
            
            if filters.count > 1 {
                Button("Clear All", action: onClearAll)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
