import SwiftUI

/// Cancel deployment confirmation sheet per PROMPT-33 spec
struct CancelDeploymentSheet: View {
    let currentPhase: String
    let onConfirm: () -> Void
    let onDismiss: () -> Void
    
    @State private var confirmText = ""
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.title2)
                    .foregroundStyle(.orange)
                
                Text("Cancel Deployment?")
                    .font(.headline)
                
                Spacer()
                
                Button {
                    onDismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding()
            
            Divider()
            
            // Content
            VStack(alignment: .leading, spacing: 16) {
                // Warning message
                VStack(alignment: .leading, spacing: 8) {
                    Text("This will cancel the current deployment and initiate an automatic rollback.")
                        .font(.body)
                    
                    Text("Current Phase: \(currentPhase)")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                
                // What will happen
                VStack(alignment: .leading, spacing: 8) {
                    Text("What will happen:")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    VStack(alignment: .leading, spacing: 6) {
                        BulletPoint(text: "Current operation will complete (atomic)")
                        BulletPoint(text: "System will restore from pre-deployment snapshot")
                        BulletPoint(text: "Maintenance mode will be disabled")
                        BulletPoint(text: "This may take several minutes")
                    }
                }
                
                // Warning box
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "info.circle.fill")
                        .foregroundStyle(.blue)
                    
                    Text("If rollback fails, you may need to manually restore from the snapshot or contact support.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding()
                .background(Color.blue.opacity(0.1))
                .cornerRadius(8)
                
                // Confirmation input
                VStack(alignment: .leading, spacing: 8) {
                    Text("Type 'CANCEL' to confirm:")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    TextField("CANCEL", text: $confirmText)
                        .textFieldStyle(.roundedBorder)
                }
            }
            .padding()
            
            Divider()
            
            // Actions
            HStack {
                Button("Keep Deploying") {
                    onDismiss()
                }
                .buttonStyle(.bordered)
                
                Spacer()
                
                Button("Cancel Deployment") {
                    onConfirm()
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)
                .disabled(confirmText != "CANCEL")
            }
            .padding()
        }
        .frame(width: 450)
    }
}

struct BulletPoint: View {
    let text: String
    
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Text("•")
                .foregroundStyle(.secondary)
            Text(text)
                .font(.callout)
        }
    }
}

#Preview {
    CancelDeploymentSheet(
        currentPhase: "Deploying Infrastructure",
        onConfirm: {},
        onDismiss: {}
    )
}
