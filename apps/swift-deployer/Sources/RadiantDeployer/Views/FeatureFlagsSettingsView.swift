// RADIANT - Feature Flags Settings View
// Manages feature flag configuration for the deployer app

import SwiftUI

struct FeatureFlagsSettingsView: View {
    @AppStorage("enableShadowMode") private var enableShadowMode = false
    @AppStorage("enableBidirectionalSync") private var enableBidirectionalSync = false
    @AppStorage("enableOmegaBrain") private var enableOmegaBrain = false
    @AppStorage("enableIntrusionDetection") private var enableIntrusionDetection = false
    @AppStorage("enableAdvancedMetrics") private var enableAdvancedMetrics = false
    @AppStorage("enableExperimentalUI") private var enableExperimentalUI = false
    
    var body: some View {
        Form {
            Section("Deployment Features") {
                Toggle("Shadow Mode Deployments", isOn: $enableShadowMode)
                Toggle("Bidirectional Sync", isOn: $enableBidirectionalSync)
                Toggle("OMEGA Brain Integration", isOn: $enableOmegaBrain)
            }
            
            Section("Security Features") {
                Toggle("Intrusion Detection System", isOn: $enableIntrusionDetection)
            }
            
            Section("UI & Monitoring") {
                Toggle("Advanced Metrics Dashboard", isOn: $enableAdvancedMetrics)
                Toggle("Experimental UI Components", isOn: $enableExperimentalUI)
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Feature Flags")
    }
}
