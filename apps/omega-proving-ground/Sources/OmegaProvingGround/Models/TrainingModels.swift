import Foundation

// MARK: - Dataset

struct TrainingDataset: Identifiable, Codable, Sendable {
    let id: UUID
    var name: String
    var description: String
    var filePath: String?
    var format: DatasetFormat
    var samples: [TrainingSample]
    var createdAt: Date
    var updatedAt: Date

    init(
        id: UUID = UUID(),
        name: String,
        description: String,
        filePath: String? = nil,
        format: DatasetFormat = .jsonl,
        samples: [TrainingSample] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.filePath = filePath
        self.format = format
        self.samples = samples
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    var sampleCount: Int { samples.count }
}

enum DatasetFormat: String, Codable, CaseIterable, Sendable {
    case jsonl = "JSONL"
    case csv = "CSV"
    case parquet = "Parquet"
    case alpaca = "Alpaca"
    case sharegpt = "ShareGPT"
}

// MARK: - Training Sample

struct TrainingSample: Identifiable, Codable, Sendable {
    let id: UUID
    var instruction: String
    var input: String
    var output: String
    var systemPrompt: String?

    init(
        id: UUID = UUID(),
        instruction: String,
        input: String = "",
        output: String,
        systemPrompt: String? = nil
    ) {
        self.id = id
        self.instruction = instruction
        self.input = input
        self.output = output
        self.systemPrompt = systemPrompt
    }
}
