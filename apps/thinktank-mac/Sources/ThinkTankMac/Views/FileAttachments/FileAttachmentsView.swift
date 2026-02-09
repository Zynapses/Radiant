import SwiftUI
import UniformTypeIdentifiers

struct FileAttachmentsView: View {
    @Binding var attachedFiles: [AttachedFile]
    @State private var isDragging = false
    @Environment(\.dismiss) var dismiss

    private let maxFileSize: Int64 = 25 * 1024 * 1024 // 25MB
    private let allowedTypes: [UTType] = [
        .pdf, .plainText, .rtf, .html,
        .png, .jpeg, .gif, .svg, .webP,
        .json, .xml,
        .commaSeparatedText,
    ]

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Attach Files")
                    .font(.system(size: 16, weight: .bold))
                Spacer()
                Button("Done") { dismiss() }
            }
            .padding()

            Divider().opacity(0.3)

            // Drop zone
            VStack(spacing: 12) {
                if attachedFiles.isEmpty {
                    dropZone
                } else {
                    fileList
                }
            }
            .padding()

            Spacer()

            // Add more button
            HStack {
                Button {
                    openFilePicker()
                } label: {
                    Label("Browse Files", systemImage: "folder")
                        .font(.system(size: 12))
                }

                Spacer()

                Text("\(attachedFiles.count) file(s)")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
        .onDrop(of: [.fileURL], isTargeted: $isDragging) { providers in
            handleDrop(providers)
            return true
        }
    }

    private var dropZone: some View {
        VStack(spacing: 12) {
            Image(systemName: "arrow.down.doc")
                .font(.system(size: 36))
                .foregroundStyle(isDragging ? Color.purple : Color.gray.opacity(0.4))

            Text(isDragging ? "Drop files here" : "Drag files here or click Browse")
                .font(.system(size: 13))
                .foregroundStyle(isDragging ? .purple : .secondary)

            Text("Max 25MB per file. Supported: PDF, text, images, CSV, JSON, XML")
                .font(.system(size: 11))
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 160)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(
                    isDragging ? Color.purple : Color.white.opacity(0.1),
                    style: StrokeStyle(lineWidth: 2, dash: [8])
                )
        )
        .background(isDragging ? Color.purple.opacity(0.05) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .animation(.easeInOut(duration: 0.2), value: isDragging)
    }

    private var fileList: some View {
        VStack(spacing: 6) {
            ForEach(attachedFiles) { file in
                HStack(spacing: 10) {
                    Image(systemName: file.icon)
                        .font(.system(size: 16))
                        .foregroundStyle(.purple)
                        .frame(width: 24)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(file.name)
                            .font(.system(size: 12, weight: .medium))
                            .lineLimit(1)

                        Text(formatFileSize(file.size))
                            .font(.system(size: 10))
                            .foregroundStyle(.tertiary)
                    }

                    Spacer()

                    Button {
                        attachedFiles.removeAll { $0.id == file.id }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(8)
                .background(Color.white.opacity(0.04))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            // Drop zone for more
            dropZone
                .frame(height: 80)
        }
    }

    private func openFilePicker() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        panel.allowedContentTypes = allowedTypes

        if panel.runModal() == .OK {
            for url in panel.urls {
                addFile(url)
            }
        }
    }

    private func handleDrop(_ providers: [NSItemProvider]) {
        for provider in providers {
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { data, _ in
                guard let data = data as? Data,
                      let url = URL(dataRepresentation: data, relativeTo: nil) else { return }
                DispatchQueue.main.async {
                    addFile(url)
                }
            }
        }
    }

    private func addFile(_ url: URL) {
        guard let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
              let size = attrs[.size] as? Int64 else { return }

        guard size <= maxFileSize else { return }

        let mimeType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"

        let file = AttachedFile(
            name: url.lastPathComponent,
            url: url,
            size: size,
            mimeType: mimeType
        )

        if !attachedFiles.contains(where: { $0.name == file.name }) {
            attachedFiles.append(file)
        }
    }

    private func formatFileSize(_ bytes: Int64) -> String {
        if bytes < 1024 { return "\(bytes) B" }
        if bytes < 1024 * 1024 { return "\(bytes / 1024) KB" }
        return String(format: "%.1f MB", Double(bytes) / 1_048_576)
    }
}
