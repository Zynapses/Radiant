# Swift Deployer v5.52.17 Update Plan

## Executive Summary

The Swift Deployer macOS app requires comprehensive updates to reflect the massive platform changes including:
- New applications (Curator, restructured admin apps)
- Domain URL configuration system with path routing
- Updated deployment parameters
- Removal of deprecated settings
- UI modernization

---

## Phase 1: Models Update

### 1.1 Update `ManagedApp.swift` - Replace Default Apps

**Current State**: Hardcoded defaults for ThinkTank, LaunchBoard, AlwaysMe, MechanicalMaker

**Target State**: Dynamic app registry reflecting actual RADIANT structure

```swift
// NEW: RadiantApplication enum
enum RadiantApplication: String, CaseIterable, Codable, Sendable {
    case radiantAdmin = "radiant-admin"
    case thinktankAdmin = "thinktank-admin"
    case curator = "curator"
    case thinktank = "thinktank"
    case api = "api"
    
    var displayName: String {
        switch self {
        case .radiantAdmin: return "RADIANT Admin"
        case .thinktankAdmin: return "Think Tank Admin"
        case .curator: return "Curator"
        case .thinktank: return "Think Tank"
        case .api: return "External API"
        }
    }
    
    var description: String {
        switch self {
        case .radiantAdmin: return "Platform administration dashboard"
        case .thinktankAdmin: return "Think Tank configuration and management"
        case .curator: return "Knowledge graph curation"
        case .thinktank: return "Consumer AI interface"
        case .api: return "External REST/GraphQL API"
        }
    }
    
    var defaultPath: String {
        switch self {
        case .radiantAdmin: return "/admin"
        case .thinktankAdmin: return "/thinktank-admin"
        case .curator: return "/curator"
        case .thinktank: return "/"  // Root
        case .api: return "/api"
        }
    }
    
    var icon: String {
        switch self {
        case .radiantAdmin: return "gearshape.2"
        case .thinktankAdmin: return "brain.head.profile"
        case .curator: return "book.pages"
        case .thinktank: return "bubble.left.and.bubble.right"
        case .api: return "link"
        }
    }
    
    var isRequired: Bool {
        switch self {
        case .radiantAdmin, .thinktank, .api: return true
        case .thinktankAdmin, .curator: return false
        }
    }
}
```

### 1.2 Create `DomainURLConfiguration.swift` - New Model

```swift
// NEW FILE: DomainURLConfiguration.swift

struct DomainURLConfiguration: Codable, Sendable {
    var baseDomain: String  // e.g., "acme.radiant.ai"
    var useSubdomains: Bool // true = app.domain.com, false = domain.com/app
    var appPaths: [RadiantApplication: AppPathConfig]
    var sslCertificateArn: String?
    var cloudFrontDistributionId: String?
    
    struct AppPathConfig: Codable, Sendable {
        var enabled: Bool
        var customSubdomain: String?  // Override default subdomain
        var customPath: String?       // Override default path
        var cloudFrontBehaviorId: String?
        
        // Computed URL
        func url(baseDomain: String, useSubdomains: Bool, app: RadiantApplication) -> String {
            if useSubdomains {
                let subdomain = customSubdomain ?? app.rawValue
                return "https://\(subdomain).\(baseDomain)"
            } else {
                let path = customPath ?? app.defaultPath
                return "https://\(baseDomain)\(path)"
            }
        }
    }
    
    static func defaults(baseDomain: String) -> DomainURLConfiguration {
        DomainURLConfiguration(
            baseDomain: baseDomain,
            useSubdomains: false,  // Default to path-based for simplicity
            appPaths: [
                .radiantAdmin: .init(enabled: true),
                .thinktankAdmin: .init(enabled: true),
                .curator: .init(enabled: true),
                .thinktank: .init(enabled: true),
                .api: .init(enabled: true)
            ]
        )
    }
}
```

### 1.3 Update `InstallationParameters.swift`

**Add new parameters:**

```swift
// Add to InstallationParameters struct:

// Domain Configuration
var domainConfig: DomainURLConfiguration?

// New Feature Flags (v5.52.17)
var enableCurator: Bool              // Knowledge graph curation app
var enableCortexMemory: Bool         // Three-tier memory system
var enableTimeMachine: Bool          // Conversation forking/checkpoints
var enableCollaboration: Bool        // Real-time co-editing
var enableComplianceExport: Bool     // HIPAA/SOC2/GDPR exports

// Removed/Deprecated (delete these)
// - cognitiveBrainEnabled (replaced by more specific flags)
// - learningEnabled (now part of Cortex)
// - adaptationEnabled (now part of Zero-Cost Ego)
```

---

## Phase 2: Views Update

### 2.1 Create `DomainURLConfigView.swift` - New View

A comprehensive domain configuration view with:
- Base domain input
- Subdomain vs. path-based routing toggle
- Per-app configuration cards
- URL preview panel
- DNS validation status
- SSL certificate status

```swift
// Structure:
struct DomainURLConfigView: View {
    // Sections:
    // 1. Base Domain Configuration
    // 2. Routing Strategy (Subdomains vs Paths)
    // 3. Application URL Configuration (5 apps)
    // 4. URL Preview
    // 5. DNS & SSL Status
}
```

### 2.2 Update `SettingsView.swift` - Remove Deprecated Tabs

**Remove:**
- `CognitiveBrainSettingsView` (88 lines) - Replaced by Cortex/Ego admin
- `AdvancedCognitionSettingsView` - Consolidated into new structure

**Add:**
- `DomainURLSettingsView` - Quick domain settings
- `FeatureFlagsSettingsView` - Enable/disable new features

### 2.3 Update `DeployView.swift` - Add Domain Configuration Step

Add a deployment step for domain configuration:
1. Infrastructure → 2. **Domain URLs** → 3. Features → 4. Review → 5. Deploy

### 2.4 Update `AppsView.swift` - Show RADIANT Apps

Replace hardcoded app list with dynamic RadiantApplication enum.

### 2.5 Update `MainView_macOS.swift` - Add Curator Navigation

Add Curator to navigation:
```swift
static var configTabs: [NavigationTab] {
    [.domains, .email, .curator]  // Add curator tab
}
```

---

## Phase 3: Services Update

### 3.1 Update `DeploymentService.swift`

Add domain URL configuration deployment logic:
- Generate CloudFront behaviors for path-based routing
- Create Route53 records for subdomain routing
- Configure ALB path rules
- Update CDK context with domain config

### 3.2 Update `CDKService.swift`

Add CDK context parameters for:
- `DOMAIN_CONFIG`: Serialized domain configuration
- `APP_PATHS`: JSON map of app → path
- `CURATOR_ENABLED`: Boolean
- `CORTEX_ENABLED`: Boolean

### 3.3 Create `DomainValidationService.swift` - New Service

```swift
// NEW FILE
class DomainValidationService {
    func validateDNS(domain: String) async -> DNSValidationResult
    func checkSSLCertificate(arn: String) async -> SSLStatus
    func validateCloudFrontDistribution(id: String) async -> CFStatus
    func generateDNSRecords(config: DomainURLConfiguration) -> [DNSRecord]
}
```

---

## Phase 4: Navigation Update

### 4.1 Update `NavigationTab` enum in `AppState.swift`

```swift
enum NavigationTab: String, CaseIterable, Identifiable, Sendable {
    // Main
    case dashboard = "Dashboard"
    case apps = "Apps"
    case deploy = "Deploy"
    
    // Operations
    case instances = "Instances"
    case snapshots = "Snapshots"
    case packages = "Packages"
    case history = "History"
    
    // AI Registry
    case providers = "Providers"
    case models = "Models"
    case selfHosted = "Self-Hosted"
    
    // Configuration (UPDATED)
    case domains = "Domain URLs"      // Renamed from "Domains"
    case email = "Email"
    case curator = "Curator"           // NEW
    
    // Advanced (UPDATED)
    case multiRegion = "Multi-Region"
    case abTesting = "A/B Testing"
    case cortex = "Cortex Memory"      // NEW
    
    // Security & Compliance
    case security = "Security"
    case compliance = "Compliance"
    
    // System
    case costs = "Costs"
    case monitoring = "Monitoring"
    case settings = "Settings"
}
```

---

## Phase 5: Deprecated Settings Removal

### 5.1 Remove from `SettingsView.swift`

| Setting | Reason | Replacement |
|---------|--------|-------------|
| `cognitiveBrainEnabled` | Deprecated concept | Cortex Memory toggle |
| `cognitiveBrainLearningEnabled` | Deprecated | Cortex auto-learning |
| `cognitiveBrainAdaptationEnabled` | Deprecated | Zero-Cost Ego |
| `cognitiveBrainMaxConcurrentRegions` | Unused | N/A |
| `globalLearningRate` | Unused | N/A |
| `enableMetacognition` | Now always on | N/A |
| `enableTheoryOfMind` | Now always on | N/A |
| `enableCreativeSynthesis` | Now always on | N/A |
| `enableSelfCorrection` | Now always on | N/A |

### 5.2 Remove from `ManagedApp.swift`

| Item | Reason |
|------|--------|
| `LaunchBoard` app | Not deployed |
| `AlwaysMe` app | Not deployed |
| `MechanicalMaker` app | Not deployed |

---

## Phase 6: CDK Context Update

### 6.1 Update Infrastructure Parameters

The deployer generates CDK context. Update to include:

```json
{
  "radiant:version": "5.52.17",
  "radiant:domainConfig": {
    "baseDomain": "acme.radiant.ai",
    "useSubdomains": false,
    "apps": {
      "radiant-admin": { "enabled": true, "path": "/admin" },
      "thinktank-admin": { "enabled": true, "path": "/thinktank-admin" },
      "curator": { "enabled": true, "path": "/curator" },
      "thinktank": { "enabled": true, "path": "/" },
      "api": { "enabled": true, "path": "/api" }
    }
  },
  "radiant:features": {
    "cortexMemory": true,
    "curator": true,
    "timeMachine": true,
    "collaboration": true,
    "complianceExport": true
  }
}
```

---

## Implementation Order

### Sprint 1: Models (2-3 hours)
1. [ ] Create `RadiantApplication` enum
2. [ ] Create `DomainURLConfiguration.swift`
3. [ ] Update `InstallationParameters.swift`
4. [ ] Update `ManagedApp.swift`

### Sprint 2: Domain URL View (3-4 hours)
1. [ ] Create `DomainURLConfigView.swift`
2. [ ] Add URL preview component
3. [ ] Add DNS validation UI
4. [ ] Integrate into DeployView

### Sprint 3: Settings Cleanup (2 hours)
1. [ ] Remove `CognitiveBrainSettingsView`
2. [ ] Remove `AdvancedCognitionSettingsView`
3. [ ] Create `FeatureFlagsSettingsView`
4. [ ] Update SettingsView tabs

### Sprint 4: Services (2-3 hours)
1. [ ] Create `DomainValidationService.swift`
2. [ ] Update `DeploymentService.swift`
3. [ ] Update `CDKService.swift`

### Sprint 5: Navigation & Polish (1-2 hours)
1. [ ] Update `NavigationTab` enum
2. [ ] Update sidebar sections
3. [ ] Add Curator view placeholder
4. [ ] Update app icons

### Sprint 6: Testing & Documentation (1 hour)
1. [ ] Test fresh install flow
2. [ ] Test upgrade flow
3. [ ] Update DESIGN_GUIDELINES.md
4. [ ] Update deployer README

---

## Files to Create

| File | Purpose |
|------|---------|
| `Models/RadiantApplication.swift` | App enum with metadata |
| `Models/DomainURLConfiguration.swift` | Domain URL config model |
| `Views/DomainURLConfigView.swift` | Domain configuration UI |
| `Views/FeatureFlagsSettingsView.swift` | Feature toggle settings |
| `Views/CuratorView.swift` | Curator app management |
| `Services/DomainValidationService.swift` | DNS/SSL validation |

## Files to Modify

| File | Changes |
|------|---------|
| `Models/ManagedApp.swift` | Replace defaults, remove unused apps |
| `Models/InstallationParameters.swift` | Add domain config, new feature flags |
| `Views/SettingsView.swift` | Remove deprecated tabs, add new tabs |
| `Views/DeployView.swift` | Add domain configuration step |
| `Views/MainView_macOS.swift` | Update navigation |
| `AppState.swift` | Update NavigationTab enum |
| `Services/DeploymentService.swift` | Add domain deployment logic |
| `Services/CDKService.swift` | Add new context parameters |

## Files to Delete

| File | Reason |
|------|--------|
| None | All deprecated code is inline in existing files |

---

## Version Update

Update `Config/Constants.swift`:
```swift
let RADIANT_VERSION = "5.52.17"
```

---

## Risk Mitigation

1. **Backward Compatibility**: Existing deployments should continue working
2. **Migration Path**: Add migration logic for old domain configs
3. **Validation**: Add comprehensive input validation for domain URLs
4. **Rollback**: Ensure snapshot system captures domain configuration

---

## Success Criteria

- [ ] Fresh install configures all 5 apps with domain URLs
- [ ] Upgrade preserves existing domain configuration
- [ ] Domain URL preview shows correct URLs
- [ ] DNS validation shows real status
- [ ] Deprecated settings no longer appear in UI
- [ ] Curator app appears in navigation
- [ ] CDK receives correct context parameters
