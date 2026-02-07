// RADIANT v7.2.0 - Database Export View
// UI for PostgreSQL and DynamoDB export/import operations
// Supports schema, seed data, masked data, and full exports

import SwiftUI

struct DatabaseExportView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedTab: DatabaseTab = .postgresql
    @State private var exportMode: PostgreSQLExportService.ExportMode = .schemaOnly
    @State private var selectedTables: Set<String> = []
    @State private var includeAllTables: Bool = true
    @State private var enableCompression: Bool = true
    @State private var gdprConsent: Bool = false
    @State private var isExporting: Bool = false
    @State private var isImporting: Bool = false
    @State private var progress: Double = 0
    @State private var progressMessage: String = ""
    @State private var showingExportResult: Bool = false
    @State private var exportResult: ExportResult?
    @State private var showingImportPicker: Bool = false
    @State private var showingError: Bool = false
    @State private var errorMessage: String = ""
    @State private var exportHistory: [PostgreSQLExportService.ExportResult] = []
    @State private var dynamoDBTables: [DynamoDBExportService.TableInfo] = []
    @State private var selectedDynamoTables: Set<String> = []
    
    enum DatabaseTab: String, CaseIterable {
        case postgresql = "PostgreSQL"
        case dynamodb = "DynamoDB"
        
        var icon: String {
            switch self {
            case .postgresql: return "cylinder.split.1x2"
            case .dynamodb: return "tablecells"
            }
        }
    }
    
    struct ExportResult {
        let success: Bool
        let message: String
        let filePath: String?
        let fileSize: Int64?
        let duration: TimeInterval
    }
    
    var body: some View {
        NavigationSplitView {
            sidebarContent
        } detail: {
            detailContent
        }
        .navigationTitle("Database Export")
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                if isExporting || isImporting {
                    ProgressView()
                        .scaleEffect(0.7)
                }
                
                Button {
                    Task { await refreshData() }
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .disabled(isExporting || isImporting)
            }
        }
        .task {
            await refreshData()
        }
        .alert("Export Complete", isPresented: $showingExportResult) {
            Button("OK") { }
            if let result = exportResult, let path = result.filePath {
                Button("Show in Finder") {
                    NSWorkspace.shared.selectFile(path, inFileViewerRootedAtPath: "")
                }
            }
        } message: {
            if let result = exportResult {
                Text(result.message)
            }
        }
        .alert("Error", isPresented: $showingError) {
            Button("OK") { }
        } message: {
            Text(errorMessage)
        }
    }
    
    private var sidebarContent: some View {
        List {
            Section("Database Type") {
                ForEach(DatabaseTab.allCases, id: \.self) { tab in
                    Button {
                        selectedTab = tab
                    } label: {
                        Label(tab.rawValue, systemImage: tab.icon)
                    }
                    .buttonStyle(.plain)
                    .padding(.vertical, 4)
                    .background(selectedTab == tab ? Color.accentColor.opacity(0.1) : Color.clear)
                    .cornerRadius(6)
                }
            }
            
            Section("Export History") {
                if exportHistory.isEmpty {
                    Text("No exports yet")
                        .foregroundColor(.secondary)
                        .font(.caption)
                } else {
                    ForEach(exportHistory.prefix(5), id: \.id) { export in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(export.mode.displayName)
                                .font(.caption.weight(.medium))
                            Text(export.exportedAt, style: .relative)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .listStyle(.sidebar)
        .frame(minWidth: 200)
    }
    
    @ViewBuilder
    private var detailContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                switch selectedTab {
                case .postgresql:
                    postgresqlExportSection
                case .dynamodb:
                    dynamoDBExportSection
                }
            }
            .padding()
        }
    }
    
    // MARK: - PostgreSQL Section
    
    private var postgresqlExportSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Header
            HStack {
                Image(systemName: "cylinder.split.1x2")
                    .font(.title)
                    .foregroundColor(.blue)
                VStack(alignment: .leading) {
                    Text("PostgreSQL Export")
                        .font(.title2.weight(.semibold))
                    Text("Export Aurora PostgreSQL database for backup or migration")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
            .padding()
            .background(Color.blue.opacity(0.1))
            .cornerRadius(12)
            
            // Export Mode
            GroupBox("Export Mode") {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(PostgreSQLExportService.ExportMode.allCases, id: \.self) { mode in
                        HStack {
                            Image(systemName: mode == exportMode ? "checkmark.circle.fill" : "circle")
                                .foregroundColor(mode == exportMode ? .accentColor : .secondary)
                            
                            VStack(alignment: .leading) {
                                Text(mode.displayName)
                                    .font(.body.weight(.medium))
                                Text(mode.description)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            
                            Spacer()
                            
                            if mode.requiresGDPRConsent {
                                Label("GDPR", systemImage: "shield.fill")
                                    .font(.caption2)
                                    .foregroundColor(.orange)
                            }
                        }
                        .padding(.vertical, 6)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            exportMode = mode
                        }
                    }
                }
                .padding(.vertical, 8)
            }
            
            // Options
            GroupBox("Options") {
                VStack(alignment: .leading, spacing: 12) {
                    Toggle("Include all tables", isOn: $includeAllTables)
                    Toggle("Enable compression (gzip)", isOn: $enableCompression)
                    
                    if exportMode.requiresGDPRConsent {
                        Divider()
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Label("GDPR Consent Required", systemImage: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                                .font(.caption.weight(.semibold))
                            
                            Text("This export mode includes personal data. By proceeding, you confirm that you have the legal basis to export this data and will handle it in accordance with GDPR requirements.")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            Toggle("I confirm GDPR compliance", isOn: $gdprConsent)
                                .toggleStyle(.checkbox)
                        }
                        .padding()
                        .background(Color.orange.opacity(0.1))
                        .cornerRadius(8)
                    }
                }
                .padding(.vertical, 8)
            }
            
            // Progress
            if isExporting {
                GroupBox("Export Progress") {
                    VStack(alignment: .leading, spacing: 8) {
                        ProgressView(value: progress)
                        Text(progressMessage)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 8)
                }
            }
            
            // Actions
            HStack {
                Button {
                    Task { await performPostgreSQLExport() }
                } label: {
                    Label("Export Database", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.borderedProminent)
                .disabled(isExporting || (exportMode.requiresGDPRConsent && !gdprConsent))
                
                Button {
                    showingImportPicker = true
                } label: {
                    Label("Import Database", systemImage: "square.and.arrow.down")
                }
                .buttonStyle(.bordered)
                .disabled(isExporting || isImporting)
            }
        }
    }
    
    // MARK: - DynamoDB Section
    
    private var dynamoDBExportSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Header
            HStack {
                Image(systemName: "tablecells")
                    .font(.title)
                    .foregroundColor(.orange)
                VStack(alignment: .leading) {
                    Text("DynamoDB Export")
                        .font(.title2.weight(.semibold))
                    Text("Export DynamoDB tables for backup or migration")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
            .padding()
            .background(Color.orange.opacity(0.1))
            .cornerRadius(12)
            
            // Table Selection
            GroupBox("Select Tables") {
                if dynamoDBTables.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "tablecells.badge.ellipsis")
                            .font(.largeTitle)
                            .foregroundColor(.secondary)
                        Text("No tables found")
                            .foregroundColor(.secondary)
                        Text("Connect to an environment to see available tables")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Button("Select All") {
                                selectedDynamoTables = Set(dynamoDBTables.map { $0.tableName })
                            }
                            .buttonStyle(.link)
                            
                            Button("Clear") {
                                selectedDynamoTables.removeAll()
                            }
                            .buttonStyle(.link)
                        }
                        
                        Divider()
                        
                        ForEach(dynamoDBTables, id: \.tableName) { table in
                            HStack {
                                Image(systemName: selectedDynamoTables.contains(table.tableName) ? "checkmark.square.fill" : "square")
                                    .foregroundColor(selectedDynamoTables.contains(table.tableName) ? .accentColor : .secondary)
                                
                                VStack(alignment: .leading) {
                                    Text(table.tableName)
                                        .font(.body.weight(.medium))
                                    HStack {
                                        Text("\(table.itemCount) items")
                                        Text("•")
                                        Text(ByteCountFormatter.string(fromByteCount: table.sizeBytes, countStyle: .file))
                                    }
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                }
                                
                                Spacer()
                            }
                            .padding(.vertical, 4)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                if selectedDynamoTables.contains(table.tableName) {
                                    selectedDynamoTables.remove(table.tableName)
                                } else {
                                    selectedDynamoTables.insert(table.tableName)
                                }
                            }
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
            
            // Options
            GroupBox("Options") {
                VStack(alignment: .leading, spacing: 12) {
                    Toggle("Enable compression", isOn: $enableCompression)
                }
                .padding(.vertical, 8)
            }
            
            // Progress
            if isExporting {
                GroupBox("Export Progress") {
                    VStack(alignment: .leading, spacing: 8) {
                        ProgressView(value: progress)
                        Text(progressMessage)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 8)
                }
            }
            
            // Actions
            HStack {
                Button {
                    Task { await performDynamoDBExport() }
                } label: {
                    Label("Export Tables", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.borderedProminent)
                .disabled(isExporting || selectedDynamoTables.isEmpty)
                
                Button {
                    showingImportPicker = true
                } label: {
                    Label("Import Tables", systemImage: "square.and.arrow.down")
                }
                .buttonStyle(.bordered)
                .disabled(isExporting || isImporting)
            }
        }
    }
    
    // MARK: - Actions
    
    private func refreshData() async {
        exportHistory = await PostgreSQLExportService.shared.getExportHistory()
        // In production, fetch actual table list from connected environment
        dynamoDBTables = [
            DynamoDBExportService.TableInfo(tableName: "radiant-sessions", itemCount: 1250, sizeBytes: 2_500_000, status: "ACTIVE"),
            DynamoDBExportService.TableInfo(tableName: "radiant-config", itemCount: 45, sizeBytes: 150_000, status: "ACTIVE"),
            DynamoDBExportService.TableInfo(tableName: "radiant-cache", itemCount: 5000, sizeBytes: 10_000_000, status: "ACTIVE")
        ]
    }
    
    private func performPostgreSQLExport() async {
        guard let selectedApp = appState.apps.first else {
            errorMessage = "No application selected"
            showingError = true
            return
        }
        
        isExporting = true
        progress = 0
        progressMessage = "Starting export..."
        
        do {
            let result = await PostgreSQLExportService.shared.exportDatabase(
                appId: selectedApp.id,
                region: "us-east-1",
                mode: exportMode,
                tables: includeAllTables ? nil : Array(selectedTables),
                compress: enableCompression,
                gdprConsent: gdprConsent
            ) { prog, msg in
                Task { @MainActor in
                    self.progress = prog
                    self.progressMessage = msg
                }
            }
            
            exportResult = ExportResult(
                success: true,
                message: "Export completed successfully.\nFile: \(result.filePath)\nSize: \(ByteCountFormatter.string(fromByteCount: result.fileSize, countStyle: .file))",
                filePath: result.filePath,
                fileSize: result.fileSize,
                duration: result.duration
            )
            showingExportResult = true
            
            // Refresh history
            exportHistory = await PostgreSQLExportService.shared.getExportHistory()
            
        } catch {
            errorMessage = error.localizedDescription
            showingError = true
        }
        
        isExporting = false
    }
    
    private func performDynamoDBExport() async {
        guard let selectedApp = appState.apps.first else {
            errorMessage = "No application selected"
            showingError = true
            return
        }
        
        isExporting = true
        progress = 0
        progressMessage = "Starting export..."
        
        do {
            let result = await DynamoDBExportService.shared.exportTables(
                appId: selectedApp.id,
                region: "us-east-1",
                tableNames: Array(selectedDynamoTables),
                compress: enableCompression
            ) { prog, msg in
                Task { @MainActor in
                    self.progress = prog
                    self.progressMessage = msg
                }
            }
            
            exportResult = ExportResult(
                success: true,
                message: "Export completed successfully.\n\(result.tables.count) tables exported.",
                filePath: result.outputDirectory,
                fileSize: result.totalSize,
                duration: result.duration
            )
            showingExportResult = true
            
        } catch {
            errorMessage = error.localizedDescription
            showingError = true
        }
        
        isExporting = false
    }
}

#Preview {
    DatabaseExportView()
        .environmentObject(AppState())
        .frame(width: 800, height: 600)
}
