import SwiftUI
import UniformTypeIdentifiers

struct DatasetListView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedDataset: TrainingDataset?
    @State private var showingImport: Bool = false
    @State private var showingNewSample: Bool = false

    var body: some View {
        HSplitView {
            datasetListPanel
                .frame(minWidth: 260, idealWidth: 300)

            datasetDetailPanel
                .frame(minWidth: 400)
        }
    }

    // MARK: - List Panel

    private var datasetListPanel: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Datasets")
                    .font(.headline)
                Spacer()
                Button(action: { showingImport = true }) {
                    Image(systemName: "plus")
                }
                .help("Create new dataset")
            }
            .padding(12)
            .background(Color(nsColor: .windowBackgroundColor))

            Divider()

            if appState.datasets.isEmpty {
                VStack(spacing: 8) {
                    Spacer()
                    Image(systemName: "tablecells")
                        .font(.system(size: 36))
                        .foregroundColor(.secondary.opacity(0.4))
                    Text("No datasets")
                        .foregroundColor(.secondary)
                    Text("Create a dataset to manage training samples")
                        .font(.caption)
                        .foregroundColor(.secondary.opacity(0.7))
                        .multilineTextAlignment(.center)
                    Spacer()
                }
                .padding()
            } else {
                List(selection: $selectedDataset) {
                    ForEach(appState.datasets) { dataset in
                        DatasetRow(dataset: dataset)
                            .tag(dataset)
                            .contextMenu {
                                Button("Export as JSONL") {
                                    exportDataset(dataset)
                                }
                                Divider()
                                Button("Delete", role: .destructive) {
                                    appState.datasets.removeAll { $0.id == dataset.id }
                                    appState.saveAll()
                                }
                            }
                    }
                }
                .listStyle(.inset)
            }
        }
        .sheet(isPresented: $showingImport) {
            NewDatasetSheet { name, description, format in
                let dataset = TrainingDataset(name: name, description: description, format: format)
                appState.datasets.append(dataset)
                selectedDataset = dataset
                appState.saveAll()
            }
        }
    }

    // MARK: - Detail Panel

    @ViewBuilder
    private var datasetDetailPanel: some View {
        if let dataset = selectedDataset,
           let index = appState.datasets.firstIndex(where: { $0.id == dataset.id }) {
            VStack(spacing: 0) {
                datasetHeader(dataset: appState.datasets[index], index: index)
                Divider()

                if appState.datasets[index].samples.isEmpty {
                    VStack(spacing: 8) {
                        Spacer()
                        Text("No training samples")
                            .foregroundColor(.secondary)
                        Button("Add Sample") { showingNewSample = true }
                            .buttonStyle(.bordered)
                        Spacer()
                    }
                } else {
                    List {
                        ForEach(Array(appState.datasets[index].samples.enumerated()), id: \.element.id) { i, sample in
                            SampleRow(index: i, sample: sample)
                                .contextMenu {
                                    Button("Delete", role: .destructive) {
                                        appState.datasets[index].samples.removeAll { $0.id == sample.id }
                                        appState.saveAll()
                                    }
                                }
                        }
                    }
                    .listStyle(.inset)
                }
            }
            .sheet(isPresented: $showingNewSample) {
                NewSampleSheet { sample in
                    appState.datasets[index].samples.append(sample)
                    appState.saveAll()
                }
            }
        } else {
            VStack(spacing: 12) {
                Spacer()
                Image(systemName: "tablecells")
                    .font(.system(size: 48))
                    .foregroundColor(.secondary.opacity(0.3))
                Text("Select a dataset")
                    .font(.title3)
                    .foregroundColor(.secondary)
                Spacer()
            }
        }
    }

    private func datasetHeader(dataset: TrainingDataset, index: Int) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(dataset.name)
                    .font(.headline)
                Text(dataset.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                HStack(spacing: 8) {
                    Text("\(dataset.sampleCount) samples")
                        .font(.caption2)
                        .foregroundColor(.secondary.opacity(0.7))
                    Text(dataset.format.rawValue)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(Capsule().fill(Color.purple.opacity(0.1)))
                        .foregroundColor(.purple)
                }
            }

            Spacer()

            Button(action: { showingNewSample = true }) {
                Label("Add Sample", systemImage: "plus")
            }
            .buttonStyle(.bordered)
            .controlSize(.small)

            Button(action: { exportDataset(dataset) }) {
                Label("Export", systemImage: "square.and.arrow.up")
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .disabled(dataset.samples.isEmpty)
        }
        .padding(12)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    // MARK: - Export

    private func exportDataset(_ dataset: TrainingDataset) {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [UTType.json]
        panel.nameFieldStringValue = "\(dataset.name).jsonl"

        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }

            let lines = dataset.samples.map { sample -> String in
                let obj: [String: String] = [
                    "instruction": sample.instruction,
                    "input": sample.input,
                    "output": sample.output
                ]
                let data = try? JSONSerialization.data(withJSONObject: obj, options: [])
                return data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            }

            let content = lines.joined(separator: "\n")
            try? content.write(to: url, atomically: true, encoding: .utf8)
        }
    }
}

// MARK: - Rows

struct DatasetRow: View {
    let dataset: TrainingDataset

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(dataset.name)
                .font(.body)
                .fontWeight(.medium)
            HStack {
                Text("\(dataset.sampleCount) samples")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                Text(dataset.format.rawValue)
                    .font(.caption2)
                    .foregroundColor(.purple)
            }
        }
        .padding(.vertical, 4)
    }
}

struct SampleRow: View {
    let index: Int
    let sample: TrainingSample

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("#\(index + 1)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(width: 30, alignment: .leading)
                Text(sample.instruction)
                    .font(.body)
                    .lineLimit(1)
            }

            if !sample.input.isEmpty {
                Text("Input: \(sample.input)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Text("Output: \(sample.output)")
                .font(.caption)
                .foregroundColor(.blue)
                .lineLimit(2)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - New Dataset Sheet

struct NewDatasetSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var description: String = ""
    @State private var format: DatasetFormat = .jsonl
    let onSave: (String, String, DatasetFormat) -> Void

    var body: some View {
        VStack(spacing: 16) {
            Text("New Dataset")
                .font(.headline)

            TextField("Dataset name", text: $name)
                .textFieldStyle(.roundedBorder)

            TextField("Description", text: $description, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(2...3)

            Picker("Format", selection: $format) {
                ForEach(DatasetFormat.allCases, id: \.self) { fmt in
                    Text(fmt.rawValue).tag(fmt)
                }
            }

            HStack {
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("Create") {
                    onSave(name, description, format)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(20)
        .frame(width: 400)
    }
}

// MARK: - New Sample Sheet

struct NewSampleSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var instruction: String = ""
    @State private var input: String = ""
    @State private var output: String = ""
    let onSave: (TrainingSample) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("New Training Sample")
                .font(.headline)

            Text("Instruction").font(.caption).foregroundColor(.secondary)
            TextEditor(text: $instruction)
                .font(.body)
                .frame(minHeight: 50, maxHeight: 80)
                .border(Color.secondary.opacity(0.2))

            Text("Input (optional)").font(.caption).foregroundColor(.secondary)
            TextField("Context or input data", text: $input)
                .textFieldStyle(.roundedBorder)

            Text("Expected Output").font(.caption).foregroundColor(.secondary)
            TextEditor(text: $output)
                .font(.body)
                .frame(minHeight: 60, maxHeight: 120)
                .border(Color.secondary.opacity(0.2))

            HStack {
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("Add Sample") {
                    let sample = TrainingSample(instruction: instruction, input: input, output: output)
                    onSave(sample)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(instruction.isEmpty || output.isEmpty)
            }
        }
        .padding(20)
        .frame(width: 500, height: 420)
    }
}

// MARK: - Hashable

extension TrainingDataset: Hashable {
    static func == (lhs: TrainingDataset, rhs: TrainingDataset) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
