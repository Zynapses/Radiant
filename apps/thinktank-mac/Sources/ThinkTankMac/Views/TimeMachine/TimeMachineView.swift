import SwiftUI

struct TimeMachineView: View {
    let conversationId: String
    @State private var snapshots: [Snapshot] = []
    @State private var selectedSnapshot: Snapshot?
    @State private var isLoading = true
    @State private var zoom: Double = 1.0
    @State private var isPlaying = false
    @State private var playbackIndex = 0
    @State private var showBranchDialog = false
    @State private var branchName = ""
    @State private var bookmarkLabel = ""
    @Environment(\.dismiss) var dismiss

    private let timeTravelService = TimeTravelService()

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.system(size: 16))
                    .foregroundStyle(.purple)
                Text("Time Machine")
                    .font(.system(size: 16, weight: .bold))

                Spacer()

                Text("\(snapshots.count) snapshots")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)

                Button("Done") { dismiss() }
            }
            .padding()

            Divider().opacity(0.3)

            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if snapshots.isEmpty {
                EmptyStateView(
                    icon: "clock.arrow.circlepath",
                    title: "No snapshots yet",
                    message: "Snapshots are created automatically as you chat."
                )
            } else {
                HSplitView {
                    // Timeline
                    VStack(spacing: 0) {
                        // Playback Controls
                        HStack(spacing: 12) {
                            Button {
                                playbackIndex = max(0, playbackIndex - 1)
                                selectedSnapshot = snapshots[safe: playbackIndex]
                            } label: {
                                Image(systemName: "backward.frame")
                                    .font(.system(size: 13))
                            }
                            .buttonStyle(.plain)
                            .disabled(playbackIndex <= 0)

                            Button {
                                isPlaying.toggle()
                                if isPlaying { startPlayback() }
                            } label: {
                                Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                                    .font(.system(size: 14))
                                    .foregroundStyle(.purple)
                            }
                            .buttonStyle(.plain)

                            Button {
                                playbackIndex = min(snapshots.count - 1, playbackIndex + 1)
                                selectedSnapshot = snapshots[safe: playbackIndex]
                            } label: {
                                Image(systemName: "forward.frame")
                                    .font(.system(size: 13))
                            }
                            .buttonStyle(.plain)
                            .disabled(playbackIndex >= snapshots.count - 1)

                            Spacer()

                            // Zoom
                            HStack(spacing: 4) {
                                Image(systemName: "minus.magnifyingglass")
                                    .font(.system(size: 11))
                                Slider(value: $zoom, in: 0.5...3.0)
                                    .frame(width: 80)
                                Image(systemName: "plus.magnifyingglass")
                                    .font(.system(size: 11))
                            }
                            .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(.ultraThinMaterial)

                        // Timeline track
                        ScrollView(.horizontal) {
                            HStack(spacing: 4 * zoom) {
                                ForEach(Array(snapshots.enumerated()), id: \.element.id) { index, snapshot in
                                    TimelineMarker(
                                        snapshot: snapshot,
                                        isSelected: selectedSnapshot?.id == snapshot.id,
                                        height: 40 * zoom
                                    ) {
                                        selectedSnapshot = snapshot
                                        playbackIndex = index
                                    }
                                }
                            }
                            .padding()
                        }

                        // Snapshot list
                        ScrollView {
                            LazyVStack(spacing: 4) {
                                ForEach(Array(snapshots.enumerated()), id: \.element.id) { index, snapshot in
                                    SnapshotRow(
                                        snapshot: snapshot,
                                        index: index,
                                        isSelected: selectedSnapshot?.id == snapshot.id
                                    ) {
                                        selectedSnapshot = snapshot
                                        playbackIndex = index
                                    }
                                }
                            }
                            .padding(8)
                        }
                    }
                    .frame(minWidth: 300)

                    // Detail panel
                    if let snapshot = selectedSnapshot {
                        VStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(snapshot.label ?? "Snapshot")
                                    .font(.system(size: 14, weight: .semibold))

                                Text(snapshot.timestamp, style: .date)
                                    .font(.system(size: 12))
                                    .foregroundStyle(.secondary)

                                if let preview = snapshot.preview {
                                    Text(preview)
                                        .font(.system(size: 12))
                                        .foregroundStyle(.secondary)
                                        .lineLimit(5)
                                        .padding(8)
                                        .background(Color.white.opacity(0.04))
                                        .clipShape(RoundedRectangle(cornerRadius: 6))
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)

                            Divider().opacity(0.3)

                            // Actions
                            VStack(spacing: 8) {
                                GradientButton(title: "Restore", icon: "arrow.uturn.backward") {
                                    Task { await restoreSnapshot(snapshot) }
                                }

                                HStack(spacing: 8) {
                                    Button { showBranchDialog = true } label: {
                                        Label("Branch", systemImage: "arrow.triangle.branch")
                                            .font(.system(size: 12))
                                    }

                                    Button { bookmarkSnapshot(snapshot) } label: {
                                        Label(
                                            snapshot.isBookmarked ? "Bookmarked" : "Bookmark",
                                            systemImage: snapshot.isBookmarked ? "bookmark.fill" : "bookmark"
                                        )
                                        .font(.system(size: 12))
                                    }
                                }
                            }

                            Spacer()
                        }
                        .padding()
                        .frame(minWidth: 220)
                    }
                }
            }
        }
        .task {
            isLoading = true
            do {
                snapshots = try await timeTravelService.getSnapshots(conversationId: conversationId)
                selectedSnapshot = snapshots.first
            } catch {
                // Handle gracefully
            }
            isLoading = false
        }
        .alert("Create Branch", isPresented: $showBranchDialog) {
            TextField("Branch name", text: $branchName)
            Button("Cancel", role: .cancel) {}
            Button("Create") {
                guard let snapshot = selectedSnapshot else { return }
                Task {
                    _ = try? await timeTravelService.createBranch(
                        conversationId: conversationId,
                        snapshotId: snapshot.id,
                        name: branchName
                    )
                    branchName = ""
                }
            }
        }
    }

    private func startPlayback() {
        guard isPlaying, playbackIndex < snapshots.count - 1 else {
            isPlaying = false
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            guard isPlaying else { return }
            playbackIndex += 1
            selectedSnapshot = snapshots[safe: playbackIndex]
            startPlayback()
        }
    }

    private func restoreSnapshot(_ snapshot: Snapshot) async {
        _ = try? await timeTravelService.restoreSnapshot(
            conversationId: conversationId,
            snapshotId: snapshot.id
        )
        dismiss()
    }

    private func bookmarkSnapshot(_ snapshot: Snapshot) {
        Task {
            try? await timeTravelService.bookmarkSnapshot(
                conversationId: conversationId,
                snapshotId: snapshot.id,
                label: snapshot.label ?? "Bookmark"
            )
            if let idx = snapshots.firstIndex(where: { $0.id == snapshot.id }) {
                snapshots[idx].isBookmarked.toggle()
            }
        }
    }
}

struct TimelineMarker: View {
    let snapshot: Snapshot
    let isSelected: Bool
    let height: CGFloat
    let onSelect: () -> Void

    var body: some View {
        VStack(spacing: 2) {
            RoundedRectangle(cornerRadius: 2)
                .fill(markerColor)
                .frame(width: 6, height: height)

            if snapshot.isBookmarked {
                Image(systemName: "bookmark.fill")
                    .font(.system(size: 8))
                    .foregroundStyle(.yellow)
            }
        }
        .opacity(isSelected ? 1.0 : 0.5)
        .scaleEffect(isSelected ? 1.2 : 1.0)
        .animation(.spring(response: 0.2), value: isSelected)
        .onTapGesture(perform: onSelect)
    }

    private var markerColor: Color {
        if snapshot.isBranch { return .green }
        if snapshot.isBookmarked { return .yellow }
        if isSelected { return .purple }
        return .gray
    }
}

struct SnapshotRow: View {
    let snapshot: Snapshot
    let index: Int
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Text("#\(index + 1)")
                .font(.system(size: 10, design: .monospaced))
                .foregroundStyle(.tertiary)
                .frame(width: 30)

            VStack(alignment: .leading, spacing: 2) {
                Text(snapshot.label ?? "Auto-save")
                    .font(.system(size: 12, weight: isSelected ? .semibold : .regular))
                    .lineLimit(1)

                Text(snapshot.timestamp, style: .time)
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
            }

            Spacer()

            HStack(spacing: 4) {
                if snapshot.isBookmarked {
                    Image(systemName: "bookmark.fill")
                        .font(.system(size: 9))
                        .foregroundStyle(.yellow)
                }
                if snapshot.isBranch {
                    Image(systemName: "arrow.triangle.branch")
                        .font(.system(size: 9))
                        .foregroundStyle(.green)
                }
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(isSelected ? Color.purple.opacity(0.12) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .contentShape(Rectangle())
        .onTapGesture(perform: onSelect)
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
