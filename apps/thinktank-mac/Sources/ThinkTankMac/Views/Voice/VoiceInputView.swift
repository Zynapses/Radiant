import SwiftUI

struct VoiceInputView: View {
    @ObservedObject var voiceService: VoiceService
    let onTranscription: (String) -> Void

    var body: some View {
        VStack(spacing: 16) {
            Text("Voice Input")
                .font(.system(size: 14, weight: .semibold))

            // Audio level visualization
            HStack(spacing: 3) {
                ForEach(0..<12, id: \.self) { i in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(barColor(for: i))
                        .frame(width: 4, height: barHeight(for: i))
                        .animation(.easeOut(duration: 0.1), value: voiceService.audioLevel)
                }
            }
            .frame(height: 40)

            // Status
            switch voiceService.state {
            case .idle:
                Text("Tap to start recording")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            case .recording:
                HStack(spacing: 6) {
                    Circle()
                        .fill(.red)
                        .frame(width: 8, height: 8)
                    Text(formatDuration(voiceService.recordingDuration))
                        .font(.system(size: 14, design: .monospaced))
                        .foregroundStyle(.red)
                }
            case .processing:
                HStack(spacing: 8) {
                    ProgressView()
                        .controlSize(.small)
                    Text("Transcribing...")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
            case .error(let message):
                Text(message)
                    .font(.system(size: 11))
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }

            // Controls
            HStack(spacing: 16) {
                switch voiceService.state {
                case .idle:
                    Button {
                        voiceService.startRecording()
                    } label: {
                        ZStack {
                            Circle()
                                .fill(Color.red)
                                .frame(width: 48, height: 48)
                            Image(systemName: "mic.fill")
                                .font(.system(size: 20))
                                .foregroundStyle(.white)
                        }
                    }
                    .buttonStyle(.plain)

                case .recording:
                    Button {
                        voiceService.cancelRecording()
                    } label: {
                        Image(systemName: "xmark.circle")
                            .font(.system(size: 24))
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .help("Cancel")

                    Button {
                        Task {
                            if let text = await voiceService.stopRecording() {
                                onTranscription(text)
                            }
                        }
                    } label: {
                        ZStack {
                            Circle()
                                .fill(Color.green)
                                .frame(width: 48, height: 48)
                            Image(systemName: "checkmark")
                                .font(.system(size: 20, weight: .bold))
                                .foregroundStyle(.white)
                        }
                    }
                    .buttonStyle(.plain)
                    .help("Stop and transcribe")

                case .processing:
                    EmptyView()

                case .error:
                    Button {
                        voiceService.cancelRecording()
                    } label: {
                        Text("Dismiss")
                            .font(.system(size: 12))
                    }
                }
            }
        }
        .padding(16)
    }

    private func barHeight(for index: Int) -> CGFloat {
        let base: CGFloat = 4
        let level = CGFloat(voiceService.audioLevel)
        let variation = sin(Double(index) * 0.8) * 0.3 + 0.7
        return base + (level * 36.0 * variation)
    }

    private func barColor(for index: Int) -> Color {
        let level = voiceService.audioLevel
        if level > 0.7 { return .red }
        if level > 0.4 { return .orange }
        return .purple.opacity(0.6)
    }

    private func formatDuration(_ duration: TimeInterval) -> String {
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
