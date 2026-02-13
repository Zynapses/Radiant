import Foundation

final class LocalStorageManager: Sendable {
    private let baseDir: URL
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init() {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        self.baseDir = appSupport.appendingPathComponent("OmegaProvingGround", isDirectory: true)
        self.encoder = JSONEncoder()
        self.encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        self.encoder.dateEncodingStrategy = .iso8601
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601

        try? FileManager.default.createDirectory(at: baseDir, withIntermediateDirectories: true)
    }

    // MARK: - Test Suites

    func saveTestSuites(_ suites: [TestSuite]) {
        save(suites, to: "test-suites.json")
    }

    func loadTestSuites() -> [TestSuite] {
        load(from: "test-suites.json") ?? []
    }

    // MARK: - Test Runs

    func saveTestRuns(_ runs: [TestRun]) {
        save(runs, to: "test-runs.json")
    }

    func loadTestRuns() -> [TestRun] {
        load(from: "test-runs.json") ?? []
    }

    // MARK: - Datasets

    func saveDatasets(_ datasets: [TrainingDataset]) {
        save(datasets, to: "datasets.json")
    }

    func loadDatasets() -> [TrainingDataset] {
        load(from: "datasets.json") ?? []
    }

    // MARK: - Inference Config

    func saveInferenceConfig(_ config: InferenceConfig) {
        save(config, to: "inference-config.json")
    }

    func loadInferenceConfig() -> InferenceConfig? {
        load(from: "inference-config.json")
    }

    // MARK: - JSONL Import

    func loadJSONLDataset(name: String, description: String, from path: String) -> TrainingDataset? {
        guard FileManager.default.fileExists(atPath: path) else { return nil }
        do {
            let content = try String(contentsOfFile: path, encoding: .utf8)
            let lines = content.components(separatedBy: .newlines).filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            var samples: [TrainingSample] = []
            for line in lines {
                guard let data = line.data(using: .utf8),
                      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: String] else { continue }
                let instruction = obj["instruction"] ?? ""
                let input = obj["input"] ?? ""
                let output = obj["output"] ?? ""
                guard !instruction.isEmpty && !output.isEmpty else { continue }
                samples.append(TrainingSample(instruction: instruction, input: input, output: output))
            }
            guard !samples.isEmpty else { return nil }
            return TrainingDataset(name: name, description: description, filePath: path, format: .jsonl, samples: samples)
        } catch {
            print("[LocalStorage] Failed to load JSONL \(path): \(error)")
            return nil
        }
    }

    func findDemoDirectory() -> String? {
        let cwd = FileManager.default.currentDirectoryPath
        let candidates = [
            "\(cwd)/demo/datasets",
            "\(cwd)/../demo/datasets",
        ]

        let execPath = ProcessInfo.processInfo.arguments.first ?? ""
        let execDir = (execPath as NSString).deletingLastPathComponent
        let execCandidates = [
            "\(execDir)/../../../demo/datasets",
            "\(execDir)/../../../../demo/datasets",
        ]

        for path in candidates + execCandidates {
            if FileManager.default.fileExists(atPath: path) {
                return path
            }
        }
        return nil
    }

    // MARK: - Generic Persistence

    private func save<T: Encodable>(_ value: T, to filename: String) {
        let url = baseDir.appendingPathComponent(filename)
        do {
            let data = try encoder.encode(value)
            try data.write(to: url, options: .atomic)
        } catch {
            print("[LocalStorage] Failed to save \(filename): \(error)")
        }
    }

    private func load<T: Decodable>(from filename: String) -> T? {
        let url = baseDir.appendingPathComponent(filename)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        do {
            let data = try Data(contentsOf: url)
            return try decoder.decode(T.self, from: data)
        } catch {
            print("[LocalStorage] Failed to load \(filename): \(error)")
            return nil
        }
    }
}
