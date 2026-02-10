// RADIANT - Package Registry Settings View
// Configures package registry sources and caching behavior

import SwiftUI

struct PackageRegistrySettingsView: View {
    @AppStorage("packageRegistryURL") private var registryURL = "https://packages.radiant.cloud"
    @AppStorage("packageCacheEnabled") private var cacheEnabled = true
    @AppStorage("packageCacheSizeMB") private var cacheSizeMB = 500
    @AppStorage("packageAutoUpdate") private var autoUpdate = true
    @AppStorage("packageVerifyChecksums") private var verifyChecksums = true
    
    var body: some View {
        Form {
            Section("Registry") {
                TextField("Registry URL", text: $registryURL)
                    .textFieldStyle(.roundedBorder)
                Toggle("Auto-check for updates", isOn: $autoUpdate)
                Toggle("Verify package checksums", isOn: $verifyChecksums)
            }
            
            Section("Cache") {
                Toggle("Enable package cache", isOn: $cacheEnabled)
                if cacheEnabled {
                    HStack {
                        Text("Max cache size")
                        Spacer()
                        TextField("MB", value: $cacheSizeMB, format: .number)
                            .frame(width: 80)
                            .textFieldStyle(.roundedBorder)
                        Text("MB")
                            .foregroundColor(.secondary)
                    }
                    
                    Button("Clear Cache") {
                        Task {
                            try? PackageService().clearCache()
                        }
                    }
                }
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Package Registry")
    }
}
