import SwiftUI

// MARK: - Cartridge Indicator View
// Shows active .RADz knowledge bundles for the current session
// Mirrors: apps/thinktank/components/chat/CartridgeIndicator.tsx

struct CartridgeIndicatorView: View {
    @State private var cartridges: [ActiveCartridge] = []
    @State private var isExpanded = false
    @State private var isLoading = false
    var compact: Bool = false

    private let service = CartridgeService()

    var activeCount: Int {
        cartridges.filter(\.isActive).count
    }

    var body: some View {
        if compact {
            compactView
        } else {
            fullView
        }
    }

    private var compactView: some View {
        Button {
            isExpanded.toggle()
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "square.3.layers.3d")
                    .font(.caption2)
                Text("\(activeCount) active")
                    .font(.caption2)
            }
            .foregroundStyle(.secondary)
        }
        .buttonStyle(.plain)
        .popover(isPresented: $isExpanded) {
            cartridgePopover
        }
        .task { await loadCartridges() }
    }

    private var fullView: some View {
        Button {
            isExpanded.toggle()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "shippingbox")
                    .font(.caption)
                Text("\(activeCount) Cartridge\(activeCount == 1 ? "" : "s")")
                    .font(.caption)
                Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                    .font(.caption2)
            }
            .foregroundStyle(activeCount > 0 ? .green : .secondary)
        }
        .buttonStyle(.plain)
        .popover(isPresented: $isExpanded) {
            cartridgePopover
        }
        .task { await loadCartridges() }
    }

    private var cartridgePopover: some View {
        VStack(spacing: 0) {
            HStack {
                Image(systemName: "square.3.layers.3d")
                    .foregroundStyle(.green)
                Text("Active Cartridges")
                    .font(.headline)
                Spacer()
            }
            .padding()

            Divider()

            if cartridges.isEmpty {
                Text("No cartridges loaded")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(24)
            } else {
                ScrollView {
                    VStack(spacing: 4) {
                        ForEach(cartridges) { cartridge in
                            CartridgeRow(cartridge: cartridge)
                        }
                    }
                    .padding(8)
                }
                .frame(maxHeight: 250)
            }

            Divider()

            HStack(spacing: 4) {
                Image(systemName: "info.circle")
                    .font(.caption2)
                Text("Cartridges provide domain-specific knowledge")
                    .font(.caption2)
            }
            .foregroundStyle(.secondary)
            .padding(8)
        }
        .frame(width: 280)
    }

    private func loadCartridges() async {
        isLoading = true
        do {
            cartridges = try await service.getActiveCartridges()
        } catch {
            cartridges = []
        }
        isLoading = false
    }
}

// MARK: - Cartridge Row

struct CartridgeRow: View {
    let cartridge: ActiveCartridge

    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 6)
                    .fill(scopeColor.opacity(0.15))
                    .frame(width: 32, height: 32)
                Image(systemName: "shippingbox")
                    .font(.caption)
                    .foregroundStyle(scopeColor)
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(cartridge.name)
                        .font(.caption.bold())
                        .lineLimit(1)
                    Text("v\(cartridge.version)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 4)
                        .background(Color.secondary.opacity(0.1))
                        .clipShape(Capsule())
                }
                HStack(spacing: 4) {
                    Image(systemName: cartridge.scope.systemImage)
                        .font(.caption2)
                    Text(cartridge.scope.displayName)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    if cartridge.priority > 90 {
                        Image(systemName: "shield.fill")
                            .font(.caption2)
                            .foregroundStyle(.yellow)
                    }
                }
            }

            Spacer()

            Circle()
                .fill(cartridge.isActive ? Color.green : Color.gray)
                .frame(width: 8, height: 8)
        }
        .padding(8)
        .background(cartridge.isActive ? Color.primary.opacity(0.03) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var scopeColor: Color {
        switch cartridge.scope {
        case .system: return .blue
        case .tenant: return .purple
        case .user: return .green
        }
    }
}
