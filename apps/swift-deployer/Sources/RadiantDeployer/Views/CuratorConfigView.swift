// RADIANT v4.18.0 - Curator Configuration View
// Configure Curator (Knowledge Graph Management) settings

import SwiftUI

struct CuratorConfigView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Curator Configuration")
                            .font(.largeTitle.bold())
                        Text("Knowledge Graph Management Settings")
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }
                
                // Status Card
                GroupBox {
                    HStack {
                        Image(systemName: "brain.head.profile")
                            .font(.title)
                            .foregroundStyle(.purple)
                        
                        VStack(alignment: .leading) {
                            Text("Curator Service")
                                .font(.headline)
                            Text("Manages knowledge extraction and graph relationships")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        
                        Spacer()
                        
                        Label("Enabled", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                    .padding()
                }
                
                // Configuration Options
                GroupBox("Graph Settings") {
                    VStack(alignment: .leading, spacing: 16) {
                        Toggle("Enable Auto-Extraction", isOn: .constant(true))
                        Toggle("Enable Relationship Detection", isOn: .constant(true))
                        Toggle("Enable Conflict Resolution", isOn: .constant(true))
                        Toggle("Enable Source Verification", isOn: .constant(true))
                    }
                    .padding()
                }
                
                GroupBox("Storage Configuration") {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack {
                            Text("Graph Database")
                            Spacer()
                            Text("Aurora PostgreSQL")
                                .foregroundStyle(.secondary)
                        }
                        
                        HStack {
                            Text("Vector Store")
                            Spacer()
                            Text("OpenSearch Serverless")
                                .foregroundStyle(.secondary)
                        }
                        
                        HStack {
                            Text("Document Store")
                            Spacer()
                            Text("S3 + DynamoDB")
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding()
                }
                
                Spacer()
            }
            .padding(24)
        }
        .frame(minWidth: 600)
        .background(Color(nsColor: .windowBackgroundColor))
    }
}
