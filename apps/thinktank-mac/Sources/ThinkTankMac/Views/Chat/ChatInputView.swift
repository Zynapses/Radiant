import SwiftUI

struct ChatInputView: View {
    @EnvironmentObject var chatStore: ChatStore
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var settingsStore: SettingsStore
    @StateObject private var voiceService = VoiceService()
    @State private var inputText = ""
    @State private var showFileAttachments = false
    @State private var showVoiceInput = false
    @State private var attachedFiles: [AttachedFile] = []
    @FocusState private var isInputFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // File attachments bar
            if !attachedFiles.isEmpty {
                FileAttachmentsBar(files: $attachedFiles)
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
            }

            // Input area
            HStack(alignment: .bottom, spacing: 8) {
                // Attachment button
                Button {
                    showFileAttachments = true
                } label: {
                    Image(systemName: "paperclip")
                        .font(.system(size: 14))
                        .foregroundStyle(.secondary)
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.plain)
                .help("Attach files")

                // Voice input
                if settingsStore.voiceEnabled {
                    Button {
                        showVoiceInput.toggle()
                    } label: {
                        let isIdle = voiceService.state == VoiceService.RecordingState.idle
                        Image(systemName: isIdle ? "mic" : "mic.fill")
                            .font(.system(size: 14))
                            .foregroundColor(isIdle ? .gray : .red)
                            .frame(width: 28, height: 28)
                    }
                    .buttonStyle(.plain)
                    .help("Voice input")
                }

                // Text input
                ZStack(alignment: .leading) {
                    if inputText.isEmpty {
                        Text("Message Think Tank...")
                            .font(.system(size: 13))
                            .foregroundStyle(.tertiary)
                            .padding(.horizontal, 4)
                    }

                    TextEditor(text: $inputText)
                        .font(.system(size: 13))
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 20, maxHeight: 120)
                        .fixedSize(horizontal: false, vertical: true)
                        .focused($isInputFocused)
                        .onKeyPress(.return, phases: .down) { press in
                            if !press.modifiers.contains(.shift) {
                                sendMessage()
                                return .handled
                            }
                            return .ignored
                        }
                }

                // Send button
                Button(action: sendMessage) {
                    Image(systemName: chatStore.isStreaming ? "stop.fill" : "arrow.up.circle.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(
                            canSend
                                ? LinearGradient(colors: [.purple, .pink], startPoint: .topLeading, endPoint: .bottomTrailing)
                                : LinearGradient(colors: [.gray.opacity(0.3), .gray.opacity(0.3)], startPoint: .leading, endPoint: .trailing)
                        )
                }
                .buttonStyle(.plain)
                .disabled(!canSend && !chatStore.isStreaming)
                .help(chatStore.isStreaming ? "Stop generation" : "Send message (Return)")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial)
            .overlay(alignment: .top) {
                Divider().opacity(0.3)
            }
        }
        .sheet(isPresented: $showFileAttachments) {
            FileAttachmentsView(attachedFiles: $attachedFiles)
                .frame(minWidth: 400, minHeight: 300)
        }
        .popover(isPresented: $showVoiceInput) {
            VoiceInputView(voiceService: voiceService) { transcription in
                inputText += transcription
                showVoiceInput = false
            }
            .frame(width: 280, height: 200)
        }
        .onAppear {
            isInputFocused = true
        }
    }

    private var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !chatStore.isStreaming
    }

    private func sendMessage() {
        let trimmed = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        inputText = ""
        attachedFiles = []
        Task {
            await chatStore.sendMessage(
                content: trimmed,
                modelId: appState.selectedModelId,
                stream: settingsStore.streamingEnabled
            )
        }
    }
}

struct FileAttachmentsBar: View {
    @Binding var files: [AttachedFile]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(files) { file in
                    HStack(spacing: 6) {
                        Image(systemName: file.icon)
                            .font(.system(size: 11))
                        Text(file.name)
                            .font(.system(size: 11))
                            .lineLimit(1)
                        Button {
                            files.removeAll { $0.id == file.id }
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 9, weight: .bold))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.white.opacity(0.06))
                    .clipShape(Capsule())
                }
            }
        }
    }
}

struct AttachedFile: Identifiable {
    let id = UUID()
    let name: String
    let url: URL
    let size: Int64
    let mimeType: String

    var icon: String {
        switch mimeType {
        case let t where t.hasPrefix("image/"): return "photo"
        case let t where t.contains("pdf"): return "doc.text"
        case let t where t.contains("text"): return "doc.plaintext"
        default: return "doc"
        }
    }
}
