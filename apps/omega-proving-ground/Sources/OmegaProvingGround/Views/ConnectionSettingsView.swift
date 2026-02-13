import SwiftUI

struct ConnectionSettingsView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header

                GroupBox("Ollama Connection") {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Base URL")
                                .font(.body)
                                .frame(width: 100, alignment: .trailing)
                            TextField("http://localhost:11434", text: $appState.inferenceService.config.baseURL)
                                .textFieldStyle(.roundedBorder)
                                .frame(maxWidth: 350)
                        }

                        HStack {
                            Text("Status")
                                .font(.body)
                                .frame(width: 100, alignment: .trailing)
                            HStack(spacing: 8) {
                                Circle()
                                    .fill(connectionColor)
                                    .frame(width: 10, height: 10)
                                Text(appState.inferenceService.connectionStatus.displayText)
                                    .font(.body)
                            }
                            Spacer()
                            Button("Test Connection") {
                                Task { await appState.inferenceService.checkConnection() }
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                        }

                        if !appState.inferenceService.availableModels.isEmpty {
                            Divider()
                            HStack(alignment: .top) {
                                Text("Models")
                                    .font(.body)
                                    .frame(width: 100, alignment: .trailing)
                                VStack(alignment: .leading, spacing: 4) {
                                    ForEach(appState.inferenceService.availableModels) { model in
                                        HStack {
                                            Text(model.name)
                                                .font(.body)
                                                .fontWeight(model.name == appState.inferenceService.config.selectedModel ? .semibold : .regular)
                                            Text(model.displaySize)
                                                .font(.caption)
                                                .foregroundColor(.secondary)
                                            Spacer()
                                            if model.name == appState.inferenceService.config.selectedModel {
                                                Image(systemName: "checkmark.circle.fill")
                                                    .foregroundColor(.green)
                                            } else {
                                                Button("Select") {
                                                    appState.inferenceService.config.selectedModel = model.name
                                                }
                                                .buttonStyle(.bordered)
                                                .controlSize(.mini)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding(8)
                }

                GroupBox("Inference Parameters") {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Temperature")
                                .frame(width: 100, alignment: .trailing)
                            Slider(value: $appState.inferenceService.config.temperature, in: 0...2, step: 0.1)
                                .frame(maxWidth: 200)
                            Text(String(format: "%.1f", appState.inferenceService.config.temperature))
                                .font(.body.monospacedDigit())
                                .frame(width: 40)
                        }

                        HStack {
                            Text("Top-P")
                                .frame(width: 100, alignment: .trailing)
                            Slider(value: $appState.inferenceService.config.topP, in: 0...1, step: 0.05)
                                .frame(maxWidth: 200)
                            Text(String(format: "%.2f", appState.inferenceService.config.topP))
                                .font(.body.monospacedDigit())
                                .frame(width: 40)
                        }

                        HStack {
                            Text("Max Tokens")
                                .frame(width: 100, alignment: .trailing)
                            TextField("", value: $appState.inferenceService.config.maxTokens, format: .number)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: 100)
                        }
                    }
                    .padding(8)
                }

                GroupBox("System Prompt") {
                    TextEditor(text: $appState.inferenceService.config.systemPrompt)
                        .font(.body)
                        .frame(minHeight: 80, maxHeight: 120)
                        .padding(4)
                }

                GroupBox("Quick Setup Guide") {
                    VStack(alignment: .leading, spacing: 8) {
                        instructionRow("1", "Install Ollama", "Download from https://ollama.com")
                        instructionRow("2", "Pull a model", "Run: ollama pull llama3.2")
                        instructionRow("3", "Verify", "Run: ollama list")
                        instructionRow("4", "Connect", "Click 'Test Connection' above")
                    }
                    .padding(8)
                }
            }
            .padding(20)
        }
        .frame(minWidth: 500)
    }

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: "gearshape")
                .font(.title2)
                .foregroundColor(.gray)
            VStack(alignment: .leading, spacing: 2) {
                Text("Settings")
                    .font(.headline)
                Text("Configure local inference connection and parameters")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
        }
    }

    private var connectionColor: Color {
        switch appState.inferenceService.connectionStatus {
        case .connected: return .green
        case .checking: return .yellow
        case .error: return .red
        case .disconnected: return .gray
        }
    }

    private func instructionRow(_ num: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(num)
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .frame(width: 20, height: 20)
                .background(Circle().fill(Color.blue))

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body)
                    .fontWeight(.medium)
                Text(detail)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .textSelection(.enabled)
            }
        }
    }
}
