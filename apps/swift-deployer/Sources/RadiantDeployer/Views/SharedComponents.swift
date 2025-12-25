// RADIANT v4.18.0 - Shared UI Components
// Reusable components across all views

import SwiftUI

// MARK: - DetailItem (used in multiple views)

struct DetailItem: View {
    let label: String
    let value: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - Error Toast System

struct ToastMessage: Identifiable, Equatable {
    let id = UUID()
    let type: ToastType
    let title: String
    let message: String
    let duration: Double
    
    enum ToastType {
        case success, error, warning, info
        
        var color: Color {
            switch self {
            case .success: return .green
            case .error: return .red
            case .warning: return .orange
            case .info: return .blue
            }
        }
        
        var icon: String {
            switch self {
            case .success: return "checkmark.circle.fill"
            case .error: return "xmark.circle.fill"
            case .warning: return "exclamationmark.triangle.fill"
            case .info: return "info.circle.fill"
            }
        }
    }
    
    static func == (lhs: ToastMessage, rhs: ToastMessage) -> Bool {
        lhs.id == rhs.id
    }
}

@MainActor
class ToastManager: ObservableObject {
    static let shared = ToastManager()
    
    @Published var currentToast: ToastMessage?
    private var dismissTask: Task<Void, Never>?
    
    func show(_ toast: ToastMessage) {
        dismissTask?.cancel()
        currentToast = toast
        
        dismissTask = Task {
            try? await Task.sleep(nanoseconds: UInt64(toast.duration * 1_000_000_000))
            if !Task.isCancelled {
                currentToast = nil
            }
        }
    }
    
    func showSuccess(_ title: String, message: String = "") {
        show(ToastMessage(type: .success, title: title, message: message, duration: 3))
    }
    
    func showError(_ title: String, message: String = "") {
        show(ToastMessage(type: .error, title: title, message: message, duration: 5))
    }
    
    func showWarning(_ title: String, message: String = "") {
        show(ToastMessage(type: .warning, title: title, message: message, duration: 4))
    }
    
    func showInfo(_ title: String, message: String = "") {
        show(ToastMessage(type: .info, title: title, message: message, duration: 3))
    }
    
    func dismiss() {
        dismissTask?.cancel()
        currentToast = nil
    }
}

struct ToastView: View {
    let toast: ToastMessage
    let onDismiss: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: toast.type.icon)
                .font(.title2)
                .foregroundStyle(toast.type.color)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(toast.title)
                    .font(.subheadline.weight(.semibold))
                if !toast.message.isEmpty {
                    Text(toast.message)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            
            Spacer()
            
            Button {
                onDismiss()
            } label: {
                Image(systemName: "xmark")
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.1), radius: 10, y: 5)
        .transition(.move(edge: .top).combined(with: .opacity))
    }
}

struct ToastContainer: ViewModifier {
    @ObservedObject var manager = ToastManager.shared
    
    func body(content: Content) -> some View {
        ZStack(alignment: .top) {
            content
            
            if let toast = manager.currentToast {
                ToastView(toast: toast) {
                    manager.dismiss()
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .zIndex(100)
            }
        }
        .animation(.spring(response: 0.3), value: manager.currentToast)
    }
}

extension View {
    func withToasts() -> some View {
        modifier(ToastContainer())
    }
}

// MARK: - Confirmation Dialog

struct ConfirmationDialog: ViewModifier {
    @Binding var isPresented: Bool
    let title: String
    let message: String
    let confirmLabel: String
    let confirmRole: ButtonRole?
    let onConfirm: () -> Void
    
    func body(content: Content) -> some View {
        content
            .alert(title, isPresented: $isPresented) {
                Button(confirmLabel, role: confirmRole) {
                    onConfirm()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text(message)
            }
    }
}

extension View {
    func confirmationDialog(
        _ title: String,
        isPresented: Binding<Bool>,
        message: String,
        confirmLabel: String = "Confirm",
        confirmRole: ButtonRole? = nil,
        onConfirm: @escaping () -> Void
    ) -> some View {
        modifier(ConfirmationDialog(
            isPresented: isPresented,
            title: title,
            message: message,
            confirmLabel: confirmLabel,
            confirmRole: confirmRole,
            onConfirm: onConfirm
        ))
    }
    
    func deleteConfirmation(
        isPresented: Binding<Bool>,
        itemName: String,
        onDelete: @escaping () -> Void
    ) -> some View {
        confirmationDialog(
            "Delete \(itemName)?",
            isPresented: isPresented,
            message: "This action cannot be undone.",
            confirmLabel: "Delete",
            confirmRole: .destructive,
            onConfirm: onDelete
        )
    }
}

// MARK: - Loading Overlay

struct LoadingOverlay: ViewModifier {
    let isLoading: Bool
    let message: String
    
    func body(content: Content) -> some View {
        ZStack {
            content
                .disabled(isLoading)
                .blur(radius: isLoading ? 2 : 0)
            
            if isLoading {
                VStack(spacing: 16) {
                    ProgressView()
                        .controlSize(.large)
                    if !message.isEmpty {
                        Text(message)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(32)
                .background(.regularMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: isLoading)
    }
}

extension View {
    func loadingOverlay(_ isLoading: Bool, message: String = "") -> some View {
        modifier(LoadingOverlay(isLoading: isLoading, message: message))
    }
}

// MARK: - Empty State View

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    let actionLabel: String?
    let action: (() -> Void)?
    
    init(icon: String, title: String, message: String, actionLabel: String? = nil, action: (() -> Void)? = nil) {
        self.icon = icon
        self.title = title
        self.message = message
        self.actionLabel = actionLabel
        self.action = action
    }
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            
            Text(title)
                .font(.headline)
            
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            
            if let actionLabel = actionLabel, let action = action {
                Button(actionLabel, action: action)
                    .buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}

// MARK: - Status Badge

struct StatusBadge: View {
    let status: String
    let color: Color
    
    var body: some View {
        Text(status.uppercased())
            .font(.caption2.bold())
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color)
            .foregroundStyle(.white)
            .clipShape(Capsule())
    }
}

// MARK: - Info Row

struct InfoRow: View {
    let label: String
    let value: String
    let icon: String?
    
    init(label: String, value: String, icon: String? = nil) {
        self.label = label
        self.value = value
        self.icon = icon
    }
    
    var body: some View {
        HStack {
            if let icon = icon {
                Image(systemName: icon)
                    .foregroundStyle(.secondary)
                    .frame(width: 20)
            }
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
    }
}

// MARK: - Section Card

struct SectionCard<Content: View>: View {
    let title: String
    let icon: String?
    @ViewBuilder let content: Content
    
    init(title: String, icon: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.icon = icon
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                if let icon = icon {
                    Image(systemName: icon)
                        .foregroundStyle(.secondary)
                }
                Text(title)
                    .font(.headline)
            }
            
            content
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Action Button

struct ActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let isLoading: Bool
    let action: () -> Void
    
    init(title: String, icon: String, color: Color = .accentColor, isLoading: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.icon = icon
        self.color = color
        self.isLoading = isLoading
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            HStack {
                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Image(systemName: icon)
                }
                Text(title)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(color)
        .disabled(isLoading)
    }
}

// MARK: - Input Validation

struct ValidationResult {
    let isValid: Bool
    let message: String?
    
    static let valid = ValidationResult(isValid: true, message: nil)
    static func invalid(_ message: String) -> ValidationResult {
        ValidationResult(isValid: false, message: message)
    }
}

struct ValidatedTextField: View {
    let label: String
    @Binding var text: String
    let placeholder: String
    let validation: (String) -> ValidationResult
    
    @State private var validationResult: ValidationResult = .valid
    @State private var hasEdited = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            TextField(label, text: $text, prompt: Text(placeholder))
                .onChange(of: text) { _ in
                    hasEdited = true
                    validationResult = validation(text)
                }
            
            if hasEdited, let message = validationResult.message {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
    }
}

// MARK: - Previews

#Preview("Toast") {
    VStack {
        Button("Show Success") {
            ToastManager.shared.showSuccess("Success!", message: "Operation completed")
        }
        Button("Show Error") {
            ToastManager.shared.showError("Error!", message: "Something went wrong")
        }
    }
    .frame(width: 400, height: 300)
    .withToasts()
}

#Preview("Empty State") {
    EmptyStateView(
        icon: "doc.text",
        title: "No Documents",
        message: "Create a new document to get started",
        actionLabel: "Create Document",
        action: {}
    )
}

#Preview("Detail Item") {
    HStack {
        DetailItem(label: "Version", value: "4.18.0")
        DetailItem(label: "Status", value: "Running")
    }
    .padding()
}
