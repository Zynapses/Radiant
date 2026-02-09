import Foundation
import AVFoundation

@MainActor
final class VoiceService: NSObject, ObservableObject {
    enum RecordingState: Equatable, Sendable {
        case idle
        case recording
        case processing
        case error(String)
    }

    @Published var state: RecordingState = .idle
    @Published var audioLevel: Float = 0
    @Published var recordingDuration: TimeInterval = 0

    private var audioEngine: AVAudioEngine?
    private var inputNode: AVAudioInputNode?
    private var audioFile: AVAudioFile?
    private var recordingTimer: Timer?
    private var tempFileURL: URL?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
        super.init()
    }

    func startRecording() {
        guard case .idle = state else { return }

        do {
            let engine = AVAudioEngine()
            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)

            let tempDir = FileManager.default.temporaryDirectory
            let fileURL = tempDir.appendingPathComponent("thinktank_voice_\(UUID().uuidString).wav")
            tempFileURL = fileURL

            let audioFile = try AVAudioFile(forWriting: fileURL, settings: [
                AVFormatIDKey: kAudioFormatLinearPCM,
                AVSampleRateKey: format.sampleRate,
                AVNumberOfChannelsKey: format.channelCount,
                AVLinearPCMBitDepthKey: 16,
                AVLinearPCMIsFloatKey: false,
            ])
            self.audioFile = audioFile

            input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
                Task { @MainActor [weak self] in
                    self?.processAudioBuffer(buffer)
                }
                do {
                    try audioFile.write(from: buffer)
                } catch {
                    Task { @MainActor [weak self] in
                        self?.state = .error("Failed to write audio: \(error.localizedDescription)")
                    }
                }
            }

            try engine.start()
            self.audioEngine = engine
            self.inputNode = input
            state = .recording
            recordingDuration = 0

            recordingTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
                Task { @MainActor [weak self] in
                    self?.recordingDuration += 0.1
                }
            }
        } catch {
            state = .error("Microphone access denied or unavailable: \(error.localizedDescription)")
        }
    }

    func stopRecording() async -> String? {
        guard case .recording = state else { return nil }

        recordingTimer?.invalidate()
        recordingTimer = nil
        inputNode?.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
        audioFile = nil
        state = .processing

        guard let fileURL = tempFileURL else {
            state = .error("No recording file found")
            return nil
        }

        do {
            let transcription = try await transcribeAudio(fileURL: fileURL)
            try? FileManager.default.removeItem(at: fileURL)
            state = .idle
            audioLevel = 0
            recordingDuration = 0
            return transcription
        } catch {
            try? FileManager.default.removeItem(at: fileURL)
            state = .error("Transcription failed: \(error.localizedDescription)")
            return nil
        }
    }

    func cancelRecording() {
        recordingTimer?.invalidate()
        recordingTimer = nil
        inputNode?.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
        audioFile = nil
        if let url = tempFileURL {
            try? FileManager.default.removeItem(at: url)
        }
        state = .idle
        audioLevel = 0
        recordingDuration = 0
    }

    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer) {
        guard let channelData = buffer.floatChannelData?[0] else { return }
        let frames = Int(buffer.frameLength)
        var sum: Float = 0
        for i in 0..<frames {
            sum += abs(channelData[i])
        }
        let avg = sum / Float(frames)
        let normalized = min(max(avg * 5.0, 0), 1)
        audioLevel = normalized
    }

    private func transcribeAudio(fileURL: URL) async throws -> String {
        let audioData = try Data(contentsOf: fileURL)
        let boundary = UUID().uuidString

        let baseURL = UserDefaults.standard.string(forKey: "apiBaseURL") ?? "https://api.radiant.local"
        var request = URLRequest(url: URL(string: "\(baseURL)/api/thinktank/voice/transcribe")!)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"audio\"; filename=\"recording.wav\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/wav\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        let (data, _) = try await URLSession.shared.data(for: request)
        let result = try JSONDecoder.radiant.decode(TranscriptionResult.self, from: data)
        return result.text
    }
}

private struct TranscriptionResult: Decodable {
    let text: String
}
