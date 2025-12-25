import Foundation
import Speech
import AVFoundation

/// Voice Input Service using macOS native Speech Recognition per PROMPT-33 spec
actor VoiceInputService {
    
    // MARK: - Types
    
    enum VoiceError: Error, LocalizedError {
        case notAuthorized
        case notAvailable
        case recognitionFailed(String)
        case audioSessionFailed
        
        var errorDescription: String? {
            switch self {
            case .notAuthorized:
                return "Speech recognition not authorized. Please enable in System Preferences."
            case .notAvailable:
                return "Speech recognition not available on this device."
            case .recognitionFailed(let message):
                return "Recognition failed: \(message)"
            case .audioSessionFailed:
                return "Failed to configure audio session."
            }
        }
    }
    
    struct VoiceCommand: Sendable {
        let text: String
        let confidence: Float
        let intent: CommandIntent?
        
        enum CommandIntent: String, Sendable {
            case deploy = "deploy"
            case cancel = "cancel"
            case rollback = "rollback"
            case status = "status"
            case help = "help"
            case selectInstance = "select"
            case unknown = "unknown"
        }
    }
    
    // MARK: - Properties
    
    private var recognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var audioEngine: AVAudioEngine?
    
    private var isListening = false
    private var authorizationStatus: SFSpeechRecognizerAuthorizationStatus = .notDetermined
    
    // MARK: - Initialization
    
    init() {
        recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    }
    
    // MARK: - Authorization
    
    func requestAuthorization() async -> Bool {
        return await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                self.authorizationStatus = status
                continuation.resume(returning: status == .authorized)
            }
        }
    }
    
    func checkAuthorization() -> Bool {
        return authorizationStatus == .authorized
    }
    
    // MARK: - Voice Recognition
    
    func startListening(onResult: @escaping (VoiceCommand) -> Void) async throws {
        guard checkAuthorization() else {
            throw VoiceError.notAuthorized
        }
        
        guard let recognizer = recognizer, recognizer.isAvailable else {
            throw VoiceError.notAvailable
        }
        
        // Stop any existing recognition
        await stopListening()
        
        audioEngine = AVAudioEngine()
        guard let audioEngine = audioEngine else {
            throw VoiceError.audioSessionFailed
        }
        
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let recognitionRequest = recognitionRequest else {
            throw VoiceError.recognitionFailed("Failed to create recognition request")
        }
        
        recognitionRequest.shouldReportPartialResults = true
        recognitionRequest.taskHint = .dictation
        
        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            self.recognitionRequest?.append(buffer)
        }
        
        audioEngine.prepare()
        try audioEngine.start()
        
        isListening = true
        
        recognitionTask = recognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self = self else { return }
            
            if let result = result {
                let text = result.bestTranscription.formattedString
                let confidence = result.bestTranscription.segments.last?.confidence ?? 0
                
                let command = VoiceCommand(
                    text: text,
                    confidence: confidence,
                    intent: self.parseIntent(from: text)
                )
                
                if result.isFinal {
                    onResult(command)
                }
            }
            
            if error != nil || result?.isFinal == true {
                Task {
                    await self.stopListening()
                }
            }
        }
    }
    
    func stopListening() async {
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        
        audioEngine = nil
        recognitionRequest = nil
        recognitionTask = nil
        isListening = false
    }
    
    // MARK: - Intent Parsing
    
    private nonisolated func parseIntent(from text: String) -> VoiceCommand.CommandIntent {
        let lowercased = text.lowercased()
        
        // Deploy commands
        if lowercased.contains("deploy") || lowercased.contains("start deployment") {
            return .deploy
        }
        
        // Cancel commands
        if lowercased.contains("cancel") || lowercased.contains("stop") || lowercased.contains("abort") {
            return .cancel
        }
        
        // Rollback commands
        if lowercased.contains("rollback") || lowercased.contains("roll back") || lowercased.contains("revert") {
            return .rollback
        }
        
        // Status commands
        if lowercased.contains("status") || lowercased.contains("progress") || lowercased.contains("how is") {
            return .status
        }
        
        // Help commands
        if lowercased.contains("help") || lowercased.contains("what can") {
            return .help
        }
        
        // Select instance commands
        if lowercased.contains("select") || lowercased.contains("choose") || lowercased.contains("switch to") {
            return .selectInstance
        }
        
        return .unknown
    }
    
    // MARK: - Command Disambiguation
    
    struct DisambiguationResult: Sendable {
        let originalCommand: String
        let possibleMatches: [String]
        let needsClarification: Bool
        let clarificationPrompt: String?
    }
    
    func disambiguateCommand(
        _ command: VoiceCommand,
        availableInstances: [String],
        availablePackages: [String]
    ) -> DisambiguationResult {
        let text = command.text.lowercased()
        
        // Check for ambiguous deploy commands
        if command.intent == .deploy {
            // Check if "production" or "prod" mentioned
            let isProd = text.contains("production") || text.contains("prod")
            
            // Find matching production instances
            let matches = availableInstances.filter { instance in
                let lowerInstance = instance.lowercased()
                if isProd {
                    return lowerInstance.contains("prod") || lowerInstance.contains("production")
                }
                return text.contains(lowerInstance)
            }
            
            if matches.count > 1 {
                return DisambiguationResult(
                    originalCommand: command.text,
                    possibleMatches: matches,
                    needsClarification: true,
                    clarificationPrompt: "Multiple instances match. Please specify: \(matches.joined(separator: ", "))"
                )
            }
            
            if matches.isEmpty && isProd {
                let prodInstances = availableInstances.filter { 
                    $0.lowercased().contains("prod") 
                }
                if prodInstances.count > 1 {
                    return DisambiguationResult(
                        originalCommand: command.text,
                        possibleMatches: prodInstances,
                        needsClarification: true,
                        clarificationPrompt: "Which production instance? \(prodInstances.joined(separator: ", "))"
                    )
                }
            }
        }
        
        // Check for ambiguous package selection
        if text.contains("latest") && availablePackages.count > 1 {
            // Check if there are multiple "latest" packages
            let latestPackages = availablePackages.filter { $0.contains("latest") || $0.contains("newest") }
            if latestPackages.count > 1 {
                return DisambiguationResult(
                    originalCommand: command.text,
                    possibleMatches: latestPackages,
                    needsClarification: true,
                    clarificationPrompt: "Multiple packages found. Please specify which one."
                )
            }
        }
        
        return DisambiguationResult(
            originalCommand: command.text,
            possibleMatches: [],
            needsClarification: false,
            clarificationPrompt: nil
        )
    }
}

// MARK: - Singleton

extension VoiceInputService {
    static let shared = VoiceInputService()
}
