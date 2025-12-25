// RADIANT v4.18.0 - SQL Editor View
// Interactive SQL editor for QA database access with AI-powered query generation

import SwiftUI
import Speech
import AVFoundation

// MARK: - SQL Editor View

struct SQLEditorView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel = SQLEditorViewModel()
    
    var body: some View {
        HSplitView {
            // Left Panel - Editor & AI Prompt
            VStack(spacing: 0) {
                // Database Selector
                DatabaseSelectorBar(viewModel: viewModel)
                
                Divider()
                
                // AI Prompt Area
                AIPromptArea(viewModel: viewModel)
                
                Divider()
                
                // SQL Editor
                SQLTextEditor(viewModel: viewModel)
                
                Divider()
                
                // Execution Controls
                ExecutionControlBar(viewModel: viewModel)
            }
            .frame(minWidth: 400)
            
            // Right Panel - Results
            QueryResultsPanel(viewModel: viewModel)
                .frame(minWidth: 350)
        }
    }
}

// MARK: - View Model

@MainActor
class SQLEditorViewModel: ObservableObject {
    // Database Connection
    @Published var selectedDatabase: DatabaseTarget = .primary
    @Published var isConnected = false
    @Published var connectionError: String?
    
    // SQL Editor
    @Published var sqlQuery = ""
    @Published var queryHistory: [QueryHistoryItem] = []
    @Published var selectedHistoryIndex: Int?
    
    // Execution
    @Published var isExecuting = false
    @Published var executionTime: TimeInterval?
    @Published var rowsAffected: Int?
    
    // Results
    @Published var columns: [String] = []
    @Published var rows: [[String]] = []
    @Published var error: String?
    
    // AI Prompt
    @Published var aiPrompt = ""
    @Published var isGeneratingSQL = false
    
    // Pinned Prompts
    @Published var pinnedPrompts: [PinnedPrompt] = []
    @Published var promptSearchQuery = ""
    @Published var showPinnedPrompts = false
    
    // Voice Input
    @Published var isRecording = false
    
    // MARK: - Pinned Prompt Model
    
    struct PinnedPrompt: Identifiable, Codable, Hashable {
        let id: UUID
        var name: String
        var prompt: String
        var database: String
        var category: String
        var createdAt: Date
        var usageCount: Int
        var isFavorite: Bool
        
        init(id: UUID = UUID(), name: String, prompt: String, database: String, category: String = "General", isFavorite: Bool = false) {
            self.id = id
            self.name = name
            self.prompt = prompt
            self.database = database
            self.category = category
            self.createdAt = Date()
            self.usageCount = 0
            self.isFavorite = isFavorite
        }
    }
    
    // MARK: - Pinned Prompts Management
    
    private let pinnedPromptsKey = "SQLEditor.PinnedPrompts"
    
    func loadPinnedPrompts() {
        if let data = UserDefaults.standard.data(forKey: pinnedPromptsKey),
           let prompts = try? JSONDecoder().decode([PinnedPrompt].self, from: data) {
            pinnedPrompts = prompts
        } else {
            // Load default prompts
            pinnedPrompts = getDefaultPinnedPrompts()
        }
    }
    
    func savePinnedPrompts() {
        if let data = try? JSONEncoder().encode(pinnedPrompts) {
            UserDefaults.standard.set(data, forKey: pinnedPromptsKey)
        }
    }
    
    func pinCurrentPrompt(name: String, category: String = "General") {
        guard !aiPrompt.isEmpty else { return }
        let prompt = PinnedPrompt(
            name: name,
            prompt: aiPrompt,
            database: selectedDatabase.rawValue,
            category: category
        )
        pinnedPrompts.insert(prompt, at: 0)
        savePinnedPrompts()
    }
    
    func unpinPrompt(_ prompt: PinnedPrompt) {
        pinnedPrompts.removeAll { $0.id == prompt.id }
        savePinnedPrompts()
    }
    
    func toggleFavorite(_ prompt: PinnedPrompt) {
        if let index = pinnedPrompts.firstIndex(where: { $0.id == prompt.id }) {
            pinnedPrompts[index].isFavorite.toggle()
            savePinnedPrompts()
        }
    }
    
    func usePrompt(_ prompt: PinnedPrompt) {
        aiPrompt = prompt.prompt
        if let index = pinnedPrompts.firstIndex(where: { $0.id == prompt.id }) {
            pinnedPrompts[index].usageCount += 1
            savePinnedPrompts()
        }
        Task { await generateSQLFromPrompt() }
    }
    
    var filteredPinnedPrompts: [PinnedPrompt] {
        let dbFiltered = pinnedPrompts.filter { 
            $0.database == selectedDatabase.rawValue || $0.database == "all"
        }
        
        if promptSearchQuery.isEmpty {
            return dbFiltered.sorted { $0.isFavorite && !$1.isFavorite }
        }
        
        let query = promptSearchQuery.lowercased()
        return dbFiltered.filter {
            $0.name.lowercased().contains(query) ||
            $0.prompt.lowercased().contains(query) ||
            $0.category.lowercased().contains(query)
        }.sorted { $0.isFavorite && !$1.isFavorite }
    }
    
    var promptCategories: [String] {
        Array(Set(pinnedPrompts.map { $0.category })).sorted()
    }
    
    private func getDefaultPinnedPrompts() -> [PinnedPrompt] {
        [
            // PostgreSQL prompts
            PinnedPrompt(name: "Active Tenants", prompt: "List all active tenants with their tier", database: "Aurora Writer", category: "Tenants", isFavorite: true),
            PinnedPrompt(name: "User Activity", prompt: "Show users active in the last 24 hours", database: "Aurora Reader", category: "Users"),
            PinnedPrompt(name: "Model Usage Report", prompt: "Get usage statistics by model for this month", database: "Aurora Reader", category: "Analytics", isFavorite: true),
            PinnedPrompt(name: "Revenue by Tenant", prompt: "Calculate total cost per tenant this month", database: "Aurora Reader", category: "Billing"),
            PinnedPrompt(name: "API Key Audit", prompt: "List API keys expiring in next 30 days", database: "Aurora Writer", category: "Security"),
            
            // DynamoDB prompts
            PinnedPrompt(name: "Today's Usage", prompt: "Get today's total usage across all tenants", database: "DynamoDB Usage", category: "Analytics", isFavorite: true),
            PinnedPrompt(name: "Tenant Tokens", prompt: "Show token usage for a specific tenant", database: "DynamoDB Usage", category: "Usage"),
            PinnedPrompt(name: "Active Sessions", prompt: "List all active user sessions", database: "DynamoDB Sessions", category: "Sessions"),
            PinnedPrompt(name: "Cache Stats", prompt: "Show cache hit rates and stats", database: "DynamoDB Cache", category: "Performance"),
        ]
    }
    @Published var voiceTranscript = ""
    
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    
    enum DatabaseTarget: String, CaseIterable, Identifiable {
        case primary = "Aurora Writer"
        case replica = "Aurora Reader"
        case dynamoUsage = "DynamoDB Usage"
        case dynamoSessions = "DynamoDB Sessions"
        case dynamoCache = "DynamoDB Cache"
        
        var id: String { rawValue }
        
        var icon: String {
            switch self {
            case .primary: return "pencil.circle.fill"
            case .replica: return "book.circle.fill"
            case .dynamoUsage: return "chart.bar.fill"
            case .dynamoSessions: return "person.2.fill"
            case .dynamoCache: return "memorychip.fill"
            }
        }
        
        var color: Color {
            switch self {
            case .primary: return .orange
            case .replica: return .blue
            case .dynamoUsage: return .purple
            case .dynamoSessions: return .green
            case .dynamoCache: return .cyan
            }
        }
        
        var endpoint: String {
            switch self {
            case .primary: return "writer"
            case .replica: return "reader"
            case .dynamoUsage: return "dynamodb-usage"
            case .dynamoSessions: return "dynamodb-sessions"
            case .dynamoCache: return "dynamodb-cache"
            }
        }
        
        var isDynamoDB: Bool {
            switch self {
            case .primary, .replica: return false
            case .dynamoUsage, .dynamoSessions, .dynamoCache: return true
            }
        }
        
        var isWritable: Bool {
            switch self {
            case .primary, .dynamoUsage, .dynamoSessions, .dynamoCache: return true
            case .replica: return false
            }
        }
        
        var shortName: String {
            switch self {
            case .primary: return "Aurora Writer"
            case .replica: return "Aurora Reader"
            case .dynamoUsage: return "Usage Table"
            case .dynamoSessions: return "Sessions Table"
            case .dynamoCache: return "Cache Table"
            }
        }
        
        var dbType: String {
            isDynamoDB ? "DynamoDB" : "PostgreSQL"
        }
    }
    
    struct QueryHistoryItem: Identifiable {
        let id = UUID()
        let query: String
        let database: DatabaseTarget
        let executedAt: Date
        let duration: TimeInterval
        let rowCount: Int
        let success: Bool
    }
    
    // MARK: - Database Operations
    
    func connect() async {
        isConnected = false
        connectionError = nil
        
        // Simulate connection test
        do {
            try await testConnection()
            isConnected = true
        } catch {
            connectionError = error.localizedDescription
        }
    }
    
    private func testConnection() async throws {
        // In production, this would test the actual database connection
        try await Task.sleep(nanoseconds: 500_000_000)
    }
    
    func executeQuery() async {
        guard !sqlQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        
        isExecuting = true
        error = nil
        columns = []
        rows = []
        
        let startTime = Date()
        
        do {
            let result = try await runQuery(sqlQuery)
            
            executionTime = Date().timeIntervalSince(startTime)
            columns = result.columns
            rows = result.rows
            rowsAffected = result.rows.count
            
            // Add to history
            let historyItem = QueryHistoryItem(
                query: sqlQuery,
                database: selectedDatabase,
                executedAt: Date(),
                duration: executionTime ?? 0,
                rowCount: result.rows.count,
                success: true
            )
            queryHistory.insert(historyItem, at: 0)
            
            // Keep only last 50 queries
            if queryHistory.count > 50 {
                queryHistory = Array(queryHistory.prefix(50))
            }
            
        } catch {
            self.error = error.localizedDescription
            executionTime = Date().timeIntervalSince(startTime)
            
            let historyItem = QueryHistoryItem(
                query: sqlQuery,
                database: selectedDatabase,
                executedAt: Date(),
                duration: executionTime ?? 0,
                rowCount: 0,
                success: false
            )
            queryHistory.insert(historyItem, at: 0)
        }
        
        isExecuting = false
    }
    
    private func runQuery(_ sql: String) async throws -> (columns: [String], rows: [[String]]) {
        // In production, this would execute against the actual database via AWS RDS Data API
        // For now, simulate with sample data based on query type
        
        try await Task.sleep(nanoseconds: UInt64.random(in: 200_000_000...800_000_000))
        
        let lowerSQL = sql.lowercased()
        
        if lowerSQL.contains("select") {
            if lowerSQL.contains("tenants") {
                return (
                    columns: ["id", "name", "tier", "status", "created_at"],
                    rows: [
                        ["t_001", "Acme Corp", "3", "active", "2024-01-15"],
                        ["t_002", "Tech Startup", "2", "active", "2024-02-20"],
                        ["t_003", "Enterprise Inc", "4", "active", "2024-03-10"],
                    ]
                )
            } else if lowerSQL.contains("users") {
                return (
                    columns: ["id", "email", "tenant_id", "role", "last_login"],
                    rows: [
                        ["u_001", "admin@acme.com", "t_001", "admin", "2024-12-24"],
                        ["u_002", "user@acme.com", "t_001", "user", "2024-12-23"],
                        ["u_003", "dev@tech.com", "t_002", "developer", "2024-12-24"],
                    ]
                )
            } else if lowerSQL.contains("models") {
                return (
                    columns: ["id", "name", "provider", "category", "enabled"],
                    rows: [
                        ["gpt-4o", "GPT-4o", "openai", "chat", "true"],
                        ["claude-3-5-sonnet", "Claude 3.5 Sonnet", "anthropic", "chat", "true"],
                        ["gemini-pro", "Gemini Pro", "google", "chat", "true"],
                    ]
                )
            } else if lowerSQL.contains("count") {
                return (
                    columns: ["count"],
                    rows: [["42"]]
                )
            }
            
            return (
                columns: ["result"],
                rows: [["Query executed successfully"]]
            )
        } else if lowerSQL.contains("insert") || lowerSQL.contains("update") || lowerSQL.contains("delete") {
            if selectedDatabase == .replica {
                throw NSError(domain: "SQL", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot execute write operations on replica database"])
            }
            return (
                columns: ["affected_rows"],
                rows: [["1"]]
            )
        }
        
        return (columns: ["result"], rows: [["OK"]])
    }
    
    // MARK: - AI SQL Generation
    
    func generateSQLFromPrompt() async {
        guard !aiPrompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        
        isGeneratingSQL = true
        
        do {
            let generatedSQL = try await callAIForSQL(prompt: aiPrompt, database: selectedDatabase)
            sqlQuery = generatedSQL
            aiPrompt = ""
        } catch {
            self.error = "Failed to generate SQL: \(error.localizedDescription)"
        }
        
        isGeneratingSQL = false
    }
    
    /// Get database schema context for AI pre-prompt
    private func getDatabaseSchemaContext(for database: DatabaseTarget) -> String {
        switch database {
        case .primary, .replica:
            return """
            You are generating PostgreSQL queries for RADIANT's Aurora PostgreSQL database.
            
            AVAILABLE TABLES:
            - tenants (id, name, tier, status, domain, settings, created_at, updated_at)
            - users (id, email, tenant_id, role, cognito_sub, last_login, created_at)
            - api_keys (id, tenant_id, key_hash, name, permissions, rate_limit, expires_at, created_at)
            - unified_model_registry (id, provider, display_name, category, tier_minimum, enabled, deprecated, pricing, created_at)
            - usage_logs (id, tenant_id, user_id, model_id, input_tokens, output_tokens, cost, created_at)
            - conversations (id, tenant_id, user_id, title, model_id, created_at, updated_at)
            - messages (id, conversation_id, role, content, tokens, created_at)
            - ai_providers (id, name, api_base_url, auth_type, enabled, created_at)
            - deployments (id, tenant_id, environment, version, status, deployed_at)
            - audit_logs (id, tenant_id, user_id, action, resource, details, ip_address, created_at)
            - feature_flags (id, tenant_id, flag_name, enabled, config, created_at)
            - billing_credits (id, tenant_id, amount, reason, expires_at, created_at)
            
            RLS: All tables use Row-Level Security with app.current_tenant_id
            
            Generate standard PostgreSQL syntax. Use appropriate JOINs, aggregations, and date functions.
            """
            
        case .dynamoUsage:
            return """
            You are generating PartiQL queries for RADIANT's DynamoDB Usage table.
            
            TABLE: ${appId}-${environment}-usage
            
            KEY SCHEMA:
            - pk (Partition Key): Format patterns:
              * "tenant#<tenant_id>" - Usage by tenant
              * "model#<model_id>" - Usage by model
              * "day#<YYYY-MM-DD>" - Daily aggregates
            - sk (Sort Key): Format patterns:
              * "usage#<timestamp>" - Individual usage record
              * "total" - Aggregated totals
              * "model#<model_id>" - Model-specific under tenant
            
            ATTRIBUTES:
            - input_tokens, output_tokens, total_tokens (Number)
            - cost (Number, decimal)
            - model_id, tenant_id, user_id (String)
            - timestamp (String, ISO8601)
            - ttl (Number, Unix timestamp for expiry)
            
            Generate PartiQL syntax. Use single quotes for strings. Example:
            SELECT * FROM "table-name" WHERE pk = 'tenant#t_001' AND begins_with(sk, 'usage#')
            """
            
        case .dynamoSessions:
            return """
            You are generating PartiQL queries for RADIANT's DynamoDB Sessions table.
            
            TABLE: ${appId}-${environment}-sessions
            
            KEY SCHEMA:
            - pk (Partition Key): Format patterns:
              * "user#<user_id>" - Sessions by user
              * "session#<session_id>" - Session by ID
            - sk (Sort Key): Format patterns:
              * "session#<session_id>" - Session details
              * "meta" - Session metadata
              * "device#<device_id>" - Device info
            
            GSI1 (gsi1pk, gsi1sk):
            - gsi1pk: "tenant#<tenant_id>" - All sessions for tenant
            - gsi1sk: "<timestamp>" - For time-based queries
            
            ATTRIBUTES:
            - user_id, tenant_id, session_id (String)
            - device_type, ip_address, user_agent (String)
            - created_at, last_activity (String, ISO8601)
            - ttl (Number, Unix timestamp for session expiry)
            
            Generate PartiQL syntax. Use single quotes for strings.
            """
            
        case .dynamoCache:
            return """
            You are generating PartiQL queries for RADIANT's DynamoDB Cache table.
            
            TABLE: ${appId}-${environment}-cache
            
            KEY SCHEMA:
            - pk (Partition Key): Format patterns:
              * "model#<model_id>" - Cached model info
              * "config#<tenant_id>" - Cached tenant config
              * "rate#<api_key_id>" - Rate limit counters
              * "embedding#<hash>" - Cached embeddings
            
            ATTRIBUTES:
            - data (String/Map, cached content)
            - cached_at (String, ISO8601)
            - ttl (Number, Unix timestamp for cache expiry)
            - hit_count (Number)
            
            Generate PartiQL syntax. Cache entries have short TTLs.
            Example: SELECT * FROM "table-name" WHERE pk = 'config#t_001'
            """
        }
    }
    
    private func callAIForSQL(prompt: String, database: DatabaseTarget) async throws -> String {
        // In production, this would call the AI service with the schema context
        // let systemPrompt = getDatabaseSchemaContext(for: database)
        // let response = await aiService.chat(system: systemPrompt, user: prompt)
        
        try await Task.sleep(nanoseconds: 800_000_000)
        
        let lowerPrompt = prompt.lowercased()
        
        // Generate database-appropriate queries
        if database.isDynamoDB {
            return generateDynamoDBQuery(prompt: lowerPrompt, database: database)
        } else {
            return generatePostgreSQLQuery(prompt: lowerPrompt)
        }
    }
    
    private func generatePostgreSQLQuery(prompt: String) -> String {
        if prompt.contains("tenant") {
            if prompt.contains("count") || prompt.contains("how many") {
                return "SELECT COUNT(*) FROM tenants WHERE status = 'active';"
            } else if prompt.contains("list") || prompt.contains("show") || prompt.contains("all") {
                return "SELECT id, name, tier, status, created_at\nFROM tenants\nORDER BY created_at DESC\nLIMIT 100;"
            } else if prompt.contains("tier") {
                return "SELECT tier, COUNT(*) as count\nFROM tenants\nWHERE status = 'active'\nGROUP BY tier\nORDER BY tier;"
            }
        }
        
        if prompt.contains("user") {
            if prompt.contains("count") || prompt.contains("how many") {
                return "SELECT COUNT(*) FROM users;"
            } else if prompt.contains("active") || prompt.contains("recent") {
                return "SELECT id, email, tenant_id, last_login\nFROM users\nWHERE last_login > NOW() - INTERVAL '7 days'\nORDER BY last_login DESC;"
            } else {
                return "SELECT id, email, tenant_id, role, created_at\nFROM users\nORDER BY created_at DESC\nLIMIT 100;"
            }
        }
        
        if prompt.contains("model") {
            if prompt.contains("enabled") || prompt.contains("active") {
                return "SELECT id, display_name, provider, category\nFROM unified_model_registry\nWHERE enabled = true\nORDER BY provider, display_name;"
            } else if prompt.contains("usage") || prompt.contains("popular") {
                return "SELECT m.id, m.display_name, COUNT(u.id) as usage_count\nFROM unified_model_registry m\nLEFT JOIN usage_logs u ON m.id = u.model_id\nGROUP BY m.id, m.display_name\nORDER BY usage_count DESC\nLIMIT 20;"
            }
        }
        
        if prompt.contains("cost") || prompt.contains("spend") || prompt.contains("billing") {
            return "SELECT tenant_id, DATE(created_at) as date,\n       SUM(input_tokens) as total_input,\n       SUM(output_tokens) as total_output,\n       SUM(cost) as total_cost\nFROM usage_logs\nWHERE created_at > NOW() - INTERVAL '30 days'\nGROUP BY tenant_id, DATE(created_at)\nORDER BY date DESC;"
        }
        
        if prompt.contains("audit") || prompt.contains("log") {
            return "SELECT id, user_id, action, resource, created_at\nFROM audit_logs\nORDER BY created_at DESC\nLIMIT 100;"
        }
        
        if prompt.contains("api key") || prompt.contains("apikey") {
            return "SELECT id, tenant_id, name, rate_limit, expires_at, created_at\nFROM api_keys\nWHERE expires_at > NOW() OR expires_at IS NULL\nORDER BY created_at DESC;"
        }
        
        if prompt.contains("conversation") {
            return "SELECT c.id, c.title, c.model_id, u.email, c.created_at\nFROM conversations c\nJOIN users u ON c.user_id = u.id\nORDER BY c.updated_at DESC\nLIMIT 50;"
        }
        
        // Default PostgreSQL query template
        return "-- PostgreSQL Query\nSELECT *\nFROM table_name\nWHERE condition\nORDER BY created_at DESC\nLIMIT 100;"
    }
    
    private func generateDynamoDBQuery(prompt: String, database: DatabaseTarget) -> String {
        let tableName = getTableName(for: database)
        
        switch database {
        case .dynamoUsage:
            if prompt.contains("tenant") {
                if prompt.contains("total") || prompt.contains("sum") {
                    return "SELECT * FROM \"\(tableName)\"\nWHERE pk = 'tenant#TENANT_ID' AND sk = 'total'"
                }
                return "SELECT * FROM \"\(tableName)\"\nWHERE pk = 'tenant#TENANT_ID'\n  AND begins_with(sk, 'usage#')"
            }
            if prompt.contains("model") {
                return "SELECT * FROM \"\(tableName)\"\nWHERE pk = 'model#MODEL_ID'\n  AND begins_with(sk, 'usage#')"
            }
            if prompt.contains("today") || prompt.contains("daily") {
                let today = ISO8601DateFormatter().string(from: Date()).prefix(10)
                return "SELECT * FROM \"\(tableName)\"\nWHERE pk = 'day#\(today)'"
            }
            if prompt.contains("cost") || prompt.contains("token") {
                return "SELECT pk, sk, input_tokens, output_tokens, cost, timestamp\nFROM \"\(tableName)\"\nWHERE pk = 'tenant#TENANT_ID'\nORDER BY sk DESC"
            }
            return "SELECT * FROM \"\(tableName)\"\nWHERE pk = 'tenant#TENANT_ID'"
            
        case .dynamoSessions:
            if prompt.contains("user") {
                return "SELECT * FROM \"\(tableName)\"\nWHERE pk = 'user#USER_ID'\n  AND begins_with(sk, 'session#')"
            }
            if prompt.contains("active") || prompt.contains("recent") {
                return "SELECT * FROM \"\(tableName)\".gsi1\nWHERE gsi1pk = 'tenant#TENANT_ID'\nORDER BY gsi1sk DESC"
            }
            if prompt.contains("device") {
                return "SELECT * FROM \"\(tableName)\"\nWHERE pk = 'user#USER_ID'\n  AND begins_with(sk, 'device#')"
            }
            return "SELECT * FROM \"\(tableName)\"\nWHERE pk = 'session#SESSION_ID'"
            
        case .dynamoCache:
            if prompt.contains("model") {
                return "SELECT * FROM \"\(tableName)\"\nWHERE pk = 'model#MODEL_ID'"
            }
            if prompt.contains("config") {
                return "SELECT * FROM \"\(tableName)\"\nWHERE pk = 'config#TENANT_ID'"
            }
            if prompt.contains("rate") || prompt.contains("limit") {
                return "SELECT * FROM \"\(tableName)\"\nWHERE pk = 'rate#API_KEY_ID'"
            }
            if prompt.contains("embedding") {
                return "SELECT * FROM \"\(tableName)\"\nWHERE begins_with(pk, 'embedding#')"
            }
            return "SELECT pk, cached_at, ttl, hit_count\nFROM \"\(tableName)\"\nWHERE pk = 'KEY'"
            
        default:
            return "SELECT * FROM \"\(tableName)\"\nWHERE pk = 'PARTITION_KEY'"
        }
    }
    
    private func getTableName(for database: DatabaseTarget) -> String {
        // In production, these would come from deployment config
        let appId = "radiant"
        let environment = "prod"
        
        switch database {
        case .dynamoUsage: return "\(appId)-\(environment)-usage"
        case .dynamoSessions: return "\(appId)-\(environment)-sessions"
        case .dynamoCache: return "\(appId)-\(environment)-cache"
        default: return "unknown"
        }
    }
    
    // MARK: - Voice Input
    
    func startVoiceRecording() {
        guard let recognizer = speechRecognizer, recognizer.isAvailable else {
            error = "Speech recognition not available"
            return
        }
        
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                switch status {
                case .authorized:
                    self?.beginRecording()
                case .denied, .restricted, .notDetermined:
                    self?.error = "Speech recognition not authorized"
                @unknown default:
                    break
                }
            }
        }
    }
    
    private func beginRecording() {
        recognitionTask?.cancel()
        recognitionTask = nil
        
        // Note: AVAudioSession is not available on macOS
        // Audio recording on macOS uses different APIs
        
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        
        let inputNode = audioEngine.inputNode
        guard let recognitionRequest = recognitionRequest else { return }
        
        recognitionRequest.shouldReportPartialResults = true
        
        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            DispatchQueue.main.async {
                if let result = result {
                    self?.voiceTranscript = result.bestTranscription.formattedString
                    self?.aiPrompt = result.bestTranscription.formattedString
                }
                
                if error != nil || result?.isFinal == true {
                    self?.stopVoiceRecording()
                }
            }
        }
        
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            recognitionRequest.append(buffer)
        }
        
        audioEngine.prepare()
        
        do {
            try audioEngine.start()
            isRecording = true
            voiceTranscript = ""
        } catch {
            self.error = "Audio engine error: \(error.localizedDescription)"
        }
    }
    
    func stopVoiceRecording() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
        isRecording = false
    }
    
    // MARK: - Utility
    
    func loadFromHistory(_ item: QueryHistoryItem) {
        sqlQuery = item.query
        selectedDatabase = item.database
    }
    
    func clearResults() {
        columns = []
        rows = []
        error = nil
        executionTime = nil
        rowsAffected = nil
    }
    
    func exportResults() -> String {
        guard !columns.isEmpty else { return "" }
        
        var csv = columns.joined(separator: ",") + "\n"
        for row in rows {
            csv += row.map { "\"\($0)\"" }.joined(separator: ",") + "\n"
        }
        return csv
    }
}

// MARK: - Database Selector Bar

struct DatabaseSelectorBar: View {
    @ObservedObject var viewModel: SQLEditorViewModel
    
    var body: some View {
        HStack(spacing: 16) {
            // Database selector with grouped menu
            Menu {
                Section("Aurora PostgreSQL") {
                    ForEach([SQLEditorViewModel.DatabaseTarget.primary, .replica], id: \.self) { db in
                        Button {
                            viewModel.selectedDatabase = db
                        } label: {
                            Label {
                                HStack {
                                    Text(db.shortName)
                                    if !db.isWritable {
                                        Text("(Read Only)")
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            } icon: {
                                Image(systemName: db.icon)
                            }
                        }
                    }
                }
                
                Section("DynamoDB Tables") {
                    ForEach([SQLEditorViewModel.DatabaseTarget.dynamoUsage, .dynamoSessions, .dynamoCache], id: \.self) { db in
                        Button {
                            viewModel.selectedDatabase = db
                        } label: {
                            Label(db.shortName, systemImage: db.icon)
                        }
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: viewModel.selectedDatabase.icon)
                        .foregroundStyle(viewModel.selectedDatabase.color)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(viewModel.selectedDatabase.shortName)
                            .font(.subheadline)
                            .fontWeight(.medium)
                        Text(viewModel.selectedDatabase.dbType)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    
                    Image(systemName: "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(viewModel.selectedDatabase.color.opacity(0.1))
                .cornerRadius(8)
            }
            .buttonStyle(.plain)
            
            // Write capability indicator
            if !viewModel.selectedDatabase.isWritable {
                Label("Read Only", systemImage: "lock.fill")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
            
            Spacer()
            
            // Connection status
            HStack(spacing: 6) {
                Circle()
                    .fill(viewModel.isConnected ? .green : .red)
                    .frame(width: 8, height: 8)
                Text(viewModel.isConnected ? "Connected" : "Disconnected")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Button {
                Task { await viewModel.connect() }
            } label: {
                Label("Connect", systemImage: "bolt.circle")
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color(.textBackgroundColor).opacity(0.5))
    }
}

// MARK: - AI Prompt Area

struct AIPromptArea: View {
    @ObservedObject var viewModel: SQLEditorViewModel
    @State private var showPinSheet = false
    @State private var pinName = ""
    @State private var pinCategory = "General"
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "sparkles")
                    .foregroundStyle(.purple)
                Text("AI Query Designer")
                    .font(.caption)
                    .fontWeight(.semibold)
                
                Spacer()
                
                // Pinned prompts button
                Button {
                    viewModel.showPinnedPrompts.toggle()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "pin.fill")
                        Text("Saved")
                        Text("(\(viewModel.filteredPinnedPrompts.count))")
                            .foregroundStyle(.secondary)
                    }
                    .font(.caption)
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
                .tint(viewModel.showPinnedPrompts ? .purple : .secondary)
                
                // Pin current prompt
                Button {
                    showPinSheet = true
                } label: {
                    Image(systemName: "pin.circle")
                        .font(.title3)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.orange)
                .disabled(viewModel.aiPrompt.isEmpty)
                .help("Pin current prompt")
                
                // Voice input button
                Button {
                    if viewModel.isRecording {
                        viewModel.stopVoiceRecording()
                    } else {
                        viewModel.startVoiceRecording()
                    }
                } label: {
                    Image(systemName: viewModel.isRecording ? "stop.circle.fill" : "mic.circle")
                        .font(.title3)
                        .foregroundStyle(viewModel.isRecording ? .red : .blue)
                }
                .buttonStyle(.plain)
                .help(viewModel.isRecording ? "Stop recording" : "Voice input")
            }
            
            // Pinned prompts panel
            if viewModel.showPinnedPrompts {
                PinnedPromptsPanel(viewModel: viewModel)
            }
            
            HStack(spacing: 8) {
                TextField(
                    "Describe what you want to query...",
                    text: $viewModel.aiPrompt,
                    axis: .vertical
                )
                .textFieldStyle(.plain)
                .font(.system(.body, design: .rounded))
                .lineLimit(1...3)
                .padding(10)
                .background(Color(.textBackgroundColor))
                .cornerRadius(8)
                .onSubmit {
                    Task { await viewModel.generateSQLFromPrompt() }
                }
                
                Button {
                    Task { await viewModel.generateSQLFromPrompt() }
                } label: {
                    if viewModel.isGeneratingSQL {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Image(systemName: "arrow.right.circle.fill")
                            .font(.title2)
                    }
                }
                .buttonStyle(.plain)
                .foregroundStyle(.purple)
                .disabled(viewModel.aiPrompt.isEmpty || viewModel.isGeneratingSQL)
            }
            
            // Voice transcript indicator
            if viewModel.isRecording {
                HStack(spacing: 8) {
                    Circle()
                        .fill(.red)
                        .frame(width: 8, height: 8)
                        .opacity(0.8)
                    Text(viewModel.voiceTranscript.isEmpty ? "Listening..." : viewModel.voiceTranscript)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .padding(.horizontal, 4)
            }
            
            // Quick prompts - database-aware
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(quickPromptsForDatabase(viewModel.selectedDatabase), id: \.self) { prompt in
                        QuickPromptChip(text: prompt, viewModel: viewModel)
                    }
                }
            }
        }
        .padding()
        .background(
            LinearGradient(
                colors: [.purple.opacity(0.05), .blue.opacity(0.05)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
    }
    
    private func quickPromptsForDatabase(_ db: SQLEditorViewModel.DatabaseTarget) -> [String] {
        switch db {
        case .primary, .replica:
            return [
                "List all tenants",
                "Active users today",
                "Model usage stats",
                "Cost by tenant",
                "Recent audit logs",
                "API keys expiring soon",
                "Top conversations"
            ]
        case .dynamoUsage:
            return [
                "Usage for tenant",
                "Today's usage totals",
                "Usage by model",
                "Token costs today",
                "High usage tenants"
            ]
        case .dynamoSessions:
            return [
                "User sessions",
                "Active sessions",
                "Sessions by tenant",
                "User devices",
                "Recent logins"
            ]
        case .dynamoCache:
            return [
                "Cached model config",
                "Tenant config cache",
                "Rate limit counters",
                "Cache hit stats",
                "Expired cache entries"
            ]
        }
    }
}

struct QuickPromptChip: View {
    let text: String
    @ObservedObject var viewModel: SQLEditorViewModel
    
    var body: some View {
        Button {
            viewModel.aiPrompt = text
            Task { await viewModel.generateSQLFromPrompt() }
        } label: {
            Text(text)
                .font(.caption)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(viewModel.selectedDatabase.color.opacity(0.1))
                .foregroundStyle(viewModel.selectedDatabase.color)
                .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Pinned Prompts Panel

struct PinnedPromptsPanel: View {
    @ObservedObject var viewModel: SQLEditorViewModel
    @State private var showAddPrompt = false
    @State private var newPromptName = ""
    @State private var newPromptText = ""
    @State private var newPromptCategory = "General"
    
    var body: some View {
        VStack(spacing: 8) {
            // Search bar
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                
                TextField("Search saved prompts...", text: $viewModel.promptSearchQuery)
                    .textFieldStyle(.plain)
                
                if !viewModel.promptSearchQuery.isEmpty {
                    Button {
                        viewModel.promptSearchQuery = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
                
                Button {
                    showAddPrompt = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(.green)
                }
                .buttonStyle(.plain)
                .help("Add new prompt")
            }
            .padding(8)
            .background(Color(.textBackgroundColor))
            .cornerRadius(8)
            
            // Prompts list
            if viewModel.filteredPinnedPrompts.isEmpty {
                HStack {
                    Spacer()
                    VStack(spacing: 4) {
                        Image(systemName: "pin.slash")
                            .font(.title2)
                            .foregroundStyle(.secondary)
                        Text("No saved prompts")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 12)
                    Spacer()
                }
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(viewModel.filteredPinnedPrompts) { prompt in
                            PinnedPromptCard(prompt: prompt, viewModel: viewModel)
                        }
                    }
                }
            }
        }
        .padding(8)
        .background(Color.purple.opacity(0.05))
        .cornerRadius(8)
        .sheet(isPresented: $showAddPrompt) {
            AddPinnedPromptSheet(viewModel: viewModel, isPresented: $showAddPrompt)
        }
        .onAppear {
            viewModel.loadPinnedPrompts()
        }
    }
}

struct PinnedPromptCard: View {
    let prompt: SQLEditorViewModel.PinnedPrompt
    @ObservedObject var viewModel: SQLEditorViewModel
    @State private var isHovered = false
    
    var body: some View {
        Button {
            viewModel.usePrompt(prompt)
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    if prompt.isFavorite {
                        Image(systemName: "star.fill")
                            .font(.caption2)
                            .foregroundStyle(.yellow)
                    }
                    Text(prompt.name)
                        .font(.caption)
                        .fontWeight(.medium)
                        .lineLimit(1)
                    
                    Spacer(minLength: 4)
                    
                    if isHovered {
                        Button {
                            viewModel.toggleFavorite(prompt)
                        } label: {
                            Image(systemName: prompt.isFavorite ? "star.fill" : "star")
                                .font(.caption2)
                        }
                        .buttonStyle(.plain)
                        
                        Button {
                            viewModel.unpinPrompt(prompt)
                        } label: {
                            Image(systemName: "xmark")
                                .font(.caption2)
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(.red)
                    }
                }
                
                Text(prompt.prompt)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                
                HStack {
                    Text(prompt.category)
                        .font(.caption2)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                        .background(Color.purple.opacity(0.2))
                        .cornerRadius(4)
                    
                    Spacer()
                    
                    if prompt.usageCount > 0 {
                        Text("\(prompt.usageCount)x")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(8)
            .frame(width: 160)
            .background(Color(.textBackgroundColor))
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isHovered ? Color.purple.opacity(0.5) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            isHovered = hovering
        }
    }
}

struct AddPinnedPromptSheet: View {
    @ObservedObject var viewModel: SQLEditorViewModel
    @Binding var isPresented: Bool
    
    @State private var name = ""
    @State private var promptText = ""
    @State private var category = "General"
    
    let categories = ["General", "Analytics", "Users", "Tenants", "Billing", "Security", "Sessions", "Performance", "Usage"]
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Save Prompt")
                    .font(.headline)
                Spacer()
                Button {
                    isPresented = false
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            .padding()
            
            Divider()
            
            Form {
                TextField("Name", text: $name, prompt: Text("e.g., Active Users Report"))
                
                Picker("Category", selection: $category) {
                    ForEach(categories, id: \.self) { cat in
                        Text(cat).tag(cat)
                    }
                }
                
                Section("Prompt") {
                    TextEditor(text: $promptText)
                        .font(.system(.body, design: .rounded))
                        .frame(minHeight: 80)
                }
                
                Section {
                    HStack {
                        Text("Database")
                        Spacer()
                        Text(viewModel.selectedDatabase.shortName)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .formStyle(.grouped)
            
            Divider()
            
            HStack {
                Button("Cancel") {
                    isPresented = false
                }
                .keyboardShortcut(.cancelAction)
                
                Spacer()
                
                Button("Save") {
                    let newPrompt = SQLEditorViewModel.PinnedPrompt(
                        name: name,
                        prompt: promptText,
                        database: viewModel.selectedDatabase.rawValue,
                        category: category
                    )
                    viewModel.pinnedPrompts.insert(newPrompt, at: 0)
                    viewModel.savePinnedPrompts()
                    isPresented = false
                }
                .buttonStyle(.borderedProminent)
                .disabled(name.isEmpty || promptText.isEmpty)
                .keyboardShortcut(.defaultAction)
            }
            .padding()
        }
        .frame(width: 400, height: 400)
        .onAppear {
            promptText = viewModel.aiPrompt
        }
    }
}

// MARK: - SQL Text Editor

struct SQLTextEditor: View {
    @ObservedObject var viewModel: SQLEditorViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(viewModel.selectedDatabase.isDynamoDB ? "PartiQL Query" : "SQL Query")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                
                // Database type badge
                Text(viewModel.selectedDatabase.dbType)
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(viewModel.selectedDatabase.color.opacity(0.2))
                    .foregroundStyle(viewModel.selectedDatabase.color)
                    .cornerRadius(4)
                
                Spacer()
                
                Button {
                    viewModel.sqlQuery = ""
                } label: {
                    Text("Clear")
                        .font(.caption)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.blue)
            }
            .padding(.horizontal)
            .padding(.top, 8)
            
            TextEditor(text: $viewModel.sqlQuery)
                .font(.system(.body, design: .monospaced))
                .scrollContentBackground(.hidden)
                .padding(8)
                .background(Color(.textBackgroundColor))
                .cornerRadius(8)
                .padding(.horizontal)
                .padding(.bottom, 8)
                .frame(minHeight: 150)
        }
    }
}

// MARK: - Execution Control Bar

struct ExecutionControlBar: View {
    @ObservedObject var viewModel: SQLEditorViewModel
    
    var body: some View {
        HStack {
            // Database indicator
            HStack(spacing: 4) {
                Image(systemName: viewModel.selectedDatabase.icon)
                    .foregroundStyle(viewModel.selectedDatabase.color)
                Text(viewModel.selectedDatabase == .primary ? "Writer" : "Reader")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Divider()
                .frame(height: 20)
            
            // Execution time
            if let time = viewModel.executionTime {
                Text(String(format: "%.2fs", time))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            // Row count
            if let rows = viewModel.rowsAffected {
                Text("\(rows) rows")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            // Execute button
            Button {
                Task { await viewModel.executeQuery() }
            } label: {
                HStack {
                    if viewModel.isExecuting {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Image(systemName: "play.fill")
                    }
                    Text(viewModel.isExecuting ? "Running..." : "Execute")
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .disabled(viewModel.sqlQuery.isEmpty || viewModel.isExecuting)
            .keyboardShortcut(.return, modifiers: .command)
        }
        .padding()
        .background(Color(.textBackgroundColor).opacity(0.5))
    }
}

// MARK: - Query Results Panel

struct QueryResultsPanel: View {
    @ObservedObject var viewModel: SQLEditorViewModel
    @State private var selectedTab = 0
    
    var body: some View {
        VStack(spacing: 0) {
            // Tab bar
            HStack(spacing: 0) {
                TabButton(title: "Results", index: 0, selectedTab: $selectedTab)
                TabButton(title: "History", index: 1, selectedTab: $selectedTab)
            }
            .background(Color(.textBackgroundColor).opacity(0.5))
            
            Divider()
            
            // Content
            if selectedTab == 0 {
                ResultsTableView(viewModel: viewModel)
            } else {
                QueryHistoryView(viewModel: viewModel)
            }
        }
    }
}

struct TabButton: View {
    let title: String
    let index: Int
    @Binding var selectedTab: Int
    
    var body: some View {
        Button {
            selectedTab = index
        } label: {
            Text(title)
                .font(.caption)
                .fontWeight(selectedTab == index ? .semibold : .regular)
                .foregroundStyle(selectedTab == index ? .primary : .secondary)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(selectedTab == index ? Color.accentColor.opacity(0.1) : Color.clear)
        }
        .buttonStyle(.plain)
    }
}

struct ResultsTableView: View {
    @ObservedObject var viewModel: SQLEditorViewModel
    @State private var showExportMenu = false
    
    var body: some View {
        VStack(spacing: 0) {
            if let error = viewModel.error {
                // Error display
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.largeTitle)
                        .foregroundStyle(.red)
                    Text("Query Error")
                        .font(.headline)
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.columns.isEmpty {
                // Empty state
                VStack(spacing: 12) {
                    Image(systemName: "tablecells")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("No Results")
                        .font(.headline)
                    Text("Execute a query to see results")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                // Results table
                VStack(spacing: 0) {
                    // Results header with export options
                    HStack {
                        // Database indicator
                        HStack(spacing: 4) {
                            Image(systemName: viewModel.selectedDatabase.icon)
                                .foregroundStyle(viewModel.selectedDatabase.color)
                            Text(viewModel.selectedDatabase == .primary ? "Primary DB" : "Replica DB")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(viewModel.selectedDatabase.color.opacity(0.1))
                        .cornerRadius(4)
                        
                        Text("•")
                            .foregroundStyle(.secondary)
                        
                        Text("\(viewModel.rows.count) rows")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        
                        if let time = viewModel.executionTime {
                            Text("•")
                                .foregroundStyle(.secondary)
                            Text(String(format: "%.3fs", time))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        
                        Spacer()
                        
                        // Copy to clipboard
                        Button {
                            copyToClipboard(.csv)
                        } label: {
                            Label("Copy", systemImage: "doc.on.doc")
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                        
                        // Export menu
                        Menu {
                            Section("Export As") {
                                Button {
                                    exportToFile(.csv)
                                } label: {
                                    Label("CSV (.csv)", systemImage: "tablecells")
                                }
                                
                                Button {
                                    exportToFile(.json)
                                } label: {
                                    Label("JSON (.json)", systemImage: "curlybraces")
                                }
                                
                                Button {
                                    exportToFile(.markdown)
                                } label: {
                                    Label("Markdown (.md)", systemImage: "doc.text")
                                }
                                
                                Button {
                                    exportToFile(.html)
                                } label: {
                                    Label("HTML (.html)", systemImage: "globe")
                                }
                                
                                Button {
                                    exportToFile(.pdf)
                                } label: {
                                    Label("PDF (.pdf)", systemImage: "doc.richtext")
                                }
                            }
                            
                            Divider()
                            
                            Section("Copy to Clipboard") {
                                Button {
                                    copyToClipboard(.csv)
                                } label: {
                                    Label("Copy as CSV", systemImage: "tablecells")
                                }
                                
                                Button {
                                    copyToClipboard(.json)
                                } label: {
                                    Label("Copy as JSON", systemImage: "curlybraces")
                                }
                                
                                Button {
                                    copyToClipboard(.markdown)
                                } label: {
                                    Label("Copy as Markdown", systemImage: "doc.text")
                                }
                            }
                        } label: {
                            Label("Export", systemImage: "square.and.arrow.up")
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.small)
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                    
                    Divider()
                    
                    // Table
                    ScrollView([.horizontal, .vertical]) {
                        Grid(alignment: .leading, horizontalSpacing: 1, verticalSpacing: 1) {
                            // Header
                            GridRow {
                                ForEach(viewModel.columns, id: \.self) { column in
                                    Text(column)
                                        .font(.caption.weight(.semibold))
                                        .padding(8)
                                        .frame(minWidth: 100, alignment: .leading)
                                        .background(Color.accentColor.opacity(0.1))
                                }
                            }
                            
                            // Rows
                            ForEach(Array(viewModel.rows.enumerated()), id: \.offset) { rowIndex, row in
                                GridRow {
                                    ForEach(Array(row.enumerated()), id: \.offset) { colIndex, cell in
                                        Text(cell)
                                            .font(.system(.caption, design: .monospaced))
                                            .padding(8)
                                            .frame(minWidth: 100, alignment: .leading)
                                            .background(rowIndex % 2 == 0 ? Color.clear : Color(.textBackgroundColor).opacity(0.5))
                                            .textSelection(.enabled)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Export Formats
    
    enum ExportFormat: String {
        case csv = "csv"
        case json = "json"
        case markdown = "md"
        case html = "html"
        case pdf = "pdf"
        
        var fileExtension: String { rawValue }
        
        var contentType: String {
            switch self {
            case .csv: return "text/csv"
            case .json: return "application/json"
            case .markdown: return "text/markdown"
            case .html: return "text/html"
            case .pdf: return "application/pdf"
            }
        }
    }
    
    // MARK: - Export Methods
    
    private func copyToClipboard(_ format: ExportFormat) {
        let content = generateExport(format: format)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(content, forType: .string)
    }
    
    private func exportToFile(_ format: ExportFormat) {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.init(filenameExtension: format.fileExtension)!]
        
        let timestamp = ISO8601DateFormatter().string(from: Date())
            .replacingOccurrences(of: ":", with: "-")
        panel.nameFieldStringValue = "query-results-\(timestamp).\(format.fileExtension)"
        
        if panel.runModal() == .OK, let url = panel.url {
            if format == .pdf {
                exportToPDF(url: url)
            } else {
                let content = generateExport(format: format)
                try? content.write(to: url, atomically: true, encoding: .utf8)
            }
        }
    }
    
    private func generateExport(format: ExportFormat) -> String {
        switch format {
        case .csv:
            return generateCSV()
        case .json:
            return generateJSON()
        case .markdown:
            return generateMarkdown()
        case .html:
            return generateHTML()
        case .pdf:
            return "" // PDF handled separately
        }
    }
    
    private func generateCSV() -> String {
        var csv = viewModel.columns.map { escapeCSV($0) }.joined(separator: ",") + "\n"
        for row in viewModel.rows {
            csv += row.map { escapeCSV($0) }.joined(separator: ",") + "\n"
        }
        return csv
    }
    
    private func escapeCSV(_ value: String) -> String {
        if value.contains(",") || value.contains("\"") || value.contains("\n") {
            return "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
        }
        return value
    }
    
    private func generateJSON() -> String {
        var records: [[String: String]] = []
        for row in viewModel.rows {
            var record: [String: String] = [:]
            for (index, column) in viewModel.columns.enumerated() {
                record[column] = index < row.count ? row[index] : ""
            }
            records.append(record)
        }
        
        let jsonData = try? JSONSerialization.data(
            withJSONObject: [
                "query": viewModel.sqlQuery,
                "database": viewModel.selectedDatabase.rawValue,
                "executed_at": ISO8601DateFormatter().string(from: Date()),
                "row_count": viewModel.rows.count,
                "columns": viewModel.columns,
                "data": records
            ],
            options: [.prettyPrinted, .sortedKeys]
        )
        
        return jsonData.flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
    }
    
    private func generateMarkdown() -> String {
        var md = "# Query Results\n\n"
        md += "**Database:** \(viewModel.selectedDatabase.rawValue)\n\n"
        md += "**Executed:** \(Date().formatted())\n\n"
        md += "**Rows:** \(viewModel.rows.count)\n\n"
        
        if let time = viewModel.executionTime {
            md += "**Execution Time:** \(String(format: "%.3fs", time))\n\n"
        }
        
        md += "## Query\n\n```sql\n\(viewModel.sqlQuery)\n```\n\n"
        md += "## Results\n\n"
        
        // Table header
        md += "| " + viewModel.columns.joined(separator: " | ") + " |\n"
        md += "| " + viewModel.columns.map { _ in "---" }.joined(separator: " | ") + " |\n"
        
        // Table rows
        for row in viewModel.rows {
            md += "| " + row.map { $0.replacingOccurrences(of: "|", with: "\\|") }.joined(separator: " | ") + " |\n"
        }
        
        return md
    }
    
    private func generateHTML() -> String {
        var html = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Query Results</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
                h1 { color: #333; }
                .meta { color: #666; margin-bottom: 20px; }
                .meta span { margin-right: 20px; }
                .database-primary { color: #f59e0b; }
                .database-replica { color: #3b82f6; }
                pre { background: #f5f5f5; padding: 15px; border-radius: 8px; overflow-x: auto; }
                table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                th { background: #f0f0f0; text-align: left; padding: 10px; border: 1px solid #ddd; font-weight: 600; }
                td { padding: 8px 10px; border: 1px solid #ddd; font-family: monospace; font-size: 13px; }
                tr:nth-child(even) { background: #f9f9f9; }
                tr:hover { background: #f0f7ff; }
            </style>
        </head>
        <body>
            <h1>Query Results</h1>
            <div class="meta">
                <span class="\(viewModel.selectedDatabase == .primary ? "database-primary" : "database-replica")">
                    <strong>Database:</strong> \(viewModel.selectedDatabase.rawValue)
                </span>
                <span><strong>Rows:</strong> \(viewModel.rows.count)</span>
        """
        
        if let time = viewModel.executionTime {
            html += "<span><strong>Time:</strong> \(String(format: "%.3fs", time))</span>"
        }
        
        html += """
                <span><strong>Executed:</strong> \(Date().formatted())</span>
            </div>
            <h2>Query</h2>
            <pre>\(viewModel.sqlQuery.replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;"))</pre>
            <h2>Results</h2>
            <table>
                <thead>
                    <tr>
        """
        
        for column in viewModel.columns {
            html += "<th>\(column)</th>"
        }
        
        html += """
                    </tr>
                </thead>
                <tbody>
        """
        
        for row in viewModel.rows {
            html += "<tr>"
            for cell in row {
                html += "<td>\(cell.replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;"))</td>"
            }
            html += "</tr>"
        }
        
        html += """
                </tbody>
            </table>
        </body>
        </html>
        """
        
        return html
    }
    
    private func exportToPDF(url: URL) {
        let html = generateHTML()
        
        // Create a web view to render HTML and export to PDF
        let printInfo = NSPrintInfo.shared
        printInfo.horizontalPagination = .fit
        printInfo.verticalPagination = .automatic
        printInfo.orientation = .landscape
        printInfo.leftMargin = 36
        printInfo.rightMargin = 36
        printInfo.topMargin = 36
        printInfo.bottomMargin = 36
        
        // For macOS, we use a simpler approach - save HTML and let user print to PDF
        // or use WKWebView for proper PDF rendering
        let htmlURL = url.deletingPathExtension().appendingPathExtension("html")
        try? html.write(to: htmlURL, atomically: true, encoding: .utf8)
        
        // Use wkhtmltopdf if available, otherwise create HTML
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/local/bin/wkhtmltopdf")
        process.arguments = [
            "--page-size", "A4",
            "--orientation", "Landscape",
            "--margin-top", "10mm",
            "--margin-bottom", "10mm",
            "--margin-left", "10mm",
            "--margin-right", "10mm",
            htmlURL.path,
            url.path
        ]
        
        do {
            try process.run()
            process.waitUntilExit()
            
            if process.terminationStatus == 0 {
                try? FileManager.default.removeItem(at: htmlURL)
            } else {
                // wkhtmltopdf not available - keep HTML file and show message
                NSWorkspace.shared.open(htmlURL)
            }
        } catch {
            // wkhtmltopdf not installed - open HTML in browser for user to print
            NSWorkspace.shared.open(htmlURL)
        }
    }
}

struct QueryHistoryView: View {
    @ObservedObject var viewModel: SQLEditorViewModel
    
    var body: some View {
        if viewModel.queryHistory.isEmpty {
            VStack(spacing: 12) {
                Image(systemName: "clock")
                    .font(.largeTitle)
                    .foregroundStyle(.secondary)
                Text("No History")
                    .font(.headline)
                Text("Executed queries will appear here")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            List(viewModel.queryHistory) { item in
                Button {
                    viewModel.loadFromHistory(item)
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Image(systemName: item.success ? "checkmark.circle.fill" : "xmark.circle.fill")
                                .foregroundStyle(item.success ? .green : .red)
                                .font(.caption)
                            
                            Text(item.database.rawValue)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            
                            Spacer()
                            
                            Text(item.executedAt, style: .time)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        
                        Text(item.query)
                            .font(.system(.caption, design: .monospaced))
                            .lineLimit(2)
                            .foregroundStyle(.primary)
                        
                        HStack {
                            Text(String(format: "%.2fs", item.duration))
                            Text("•")
                            Text("\(item.rowCount) rows")
                        }
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Preview

#Preview {
    SQLEditorView()
        .environmentObject(AppState())
        .frame(width: 1000, height: 600)
}
