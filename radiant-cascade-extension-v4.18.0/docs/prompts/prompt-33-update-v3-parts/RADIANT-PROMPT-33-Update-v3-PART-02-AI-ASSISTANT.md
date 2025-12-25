            ProgressHeader(
                state: deploymentManager.state,
                package: deploymentManager.currentPackage
            )
            
            Divider()
            
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // AI explanation card
                    if let explanation = aiExplanation {
                        AIExplanationCard(explanation: explanation)
                    }
                    
                    // Phase list
                    DeploymentPhaseList(
                        currentState: deploymentManager.state,
                        completedPhases: deploymentManager.completedPhases
                    )
                    
                    // Error details (if failed)
                    if case .failed(let failure) = deploymentManager.state {
                        FailureDetailsView(
                            failure: failure,
                            aiService: aiService,
                            onRollback: { deploymentManager.rollback() },
                            onRetry: { deploymentManager.retry() }
                        )
                    }
                }
                .padding()
            }
            
            Divider()
            
            // Action buttons
            ActionButtons(
                state: deploymentManager.state,
                onCancel: { showCancelConfirmation = true },
                onRollback: { deploymentManager.rollback() },
                onRetry: { deploymentManager.retry() }
            )
        }
        .confirmationDialog("Cancel Deployment?", isPresented: $showCancelConfirmation) {
            Button("Cancel and Rollback", role: .destructive) {
                deploymentManager.cancel()
            }
        } message: {
            Text("This will rollback to the snapshot created before deployment.")
        }
        .onChange(of: deploymentManager.state) { state in
            Task { aiExplanation = try? await aiService.explain(context: ..., event: ...) }
        }
    }
}
```

---

## DEPLOYER APP - LOCAL STORAGE

All local data encrypted with SQLCipher. Key stored in macOS Keychain.

### Storage Structure

```
~/Library/Application Support/RadiantDeployer/
├── Packages/                           # Downloaded .pkg files
├── deployment-history.encrypted        # All deployments
├── snapshot-manifest.encrypted         # All snapshots with AWS ARNs
├── compatibility-matrix.encrypted      # Version compatibility
├── settings.encrypted                  # User preferences
├── Backups/                           # Last 5 versions of each file
└── .validation-cache/                  # AST validation results
```

### LocalStorageManager (Swift)

```swift
actor LocalStorageManager {
    private let encryptionKey: Data  // From Keychain
    
    // Load with automatic backup restoration
    private func loadEncrypted<T: Codable>(filename: String, type: T.Type, default: T) async throws -> T {
        let fileURL = baseDirectory.appendingPathComponent(filename)
        let backupURL = backupsDirectory.appendingPathComponent(filename + ".bak")
        
        // Try main file
        if FileManager.default.fileExists(atPath: fileURL.path) {
            do {
                let encrypted = try Data(contentsOf: fileURL)
                let decrypted = try decrypt(encrypted)
                let decoded = try JSONDecoder().decode(T.self, from: decrypted)
                
                // Verify integrity
                if let verifiable = decoded as? DataIntegrityVerifiable {
                    guard verifiable.verifyIntegrity() else {
                        throw StorageError.integrityCheckFailed
                    }
                }
                return decoded
            } catch {
                // Main file corrupted, try backup
            }
        }
        
        // Try backup
        if FileManager.default.fileExists(atPath: backupURL.path) {
            // ... restore from backup
        }
        
        return `default`
    }
    
    // Save with backup rotation (keep last 5)
    private func saveEncrypted<T: Codable>(_ value: T, filename: String) async throws {
        // Create backup of existing
        // Encode and encrypt
        // Write atomically
        // Rotate backups
    }
}
```

### deployment-history.json Schema

```json
{
  "schemaVersion": "1.0",
  "lastUpdated": "2024-12-24T15:30:00Z",
  "deployments": [
    {
      "id": "deploy-20241224-153000-abc123",
      "timestamp": "2024-12-24T15:30:00Z",
      "packageVersion": "4.18.0",
      "components": {
        "radiant": { "version": "4.18.0", "installed": true },
        "thinktank": { "version": "3.2.0", "installed": false }
      },
      "targetInstance": {
        "appId": "myapp",
        "environment": "production",
        "region": "us-east-1"
      },
      "type": "upgrade",
      "status": "completed",
      "phases": [...],
      "snapshotId": "snap-xyz789",
      "healthCheckResults": {...},
      "duration": 720
    }
  ]
}
```

### snapshot-manifest.json Schema

```json
{
  "schemaVersion": "1.0",
  "snapshots": [
    {
      "id": "snap-20241224-152900-xyz789",
      "timestamp": "2024-12-24T15:29:00Z",
      "type": "pre-deployment",
      "deploymentId": "deploy-20241224-153000-abc123",
      "targetInstance": {...},
      "beforeVersions": { "radiant": "4.17.0", "thinktank": "3.2.0" },
      "awsResources": {
        "auroraSnapshot": {
          "arn": "arn:aws:rds:...",
          "status": "available",
          "sizeGB": 45.2
        },
        "dynamoDbBackups": [...],
        "s3Manifests": {...},
        "lambdaVersions": {...}
      },
      "checksums": {...},
      "expiresAt": "2025-03-24T15:29:00Z",
      "canRestore": true,
      "estimatedRestoreTime": "15-20 minutes"
    }
  ]
}
```

### Export for Backup

```swift
extension LocalStorageManager {
    func exportHistory(to url: URL) async throws {
        let history = getDeploymentHistory()
        let data = try JSONEncoder().encode(history)
        try data.write(to: url)
    }
    
    func exportSnapshots(to url: URL) async throws {
        let manifest = getSnapshotManifest()
        let data = try JSONEncoder().encode(manifest)
        try data.write(to: url)
    }
}
```


---

## BUILD SYSTEM

### Directory Structure

```
radiant/
├── VERSION                    # Package version: "4.18.0"
├── RADIANT_VERSION            # Radiant component: "4.18.0"
├── THINKTANK_VERSION          # Think Tank component: "3.2.0"
├── VERSION_HISTORY.json       # Released versions with hashes
├── CHANGELOG.md               # Auto-generated
├── .last_content_hash         # For change detection
│
├── .husky/
│   ├── pre-commit             # Version bump enforcement
│   └── commit-msg             # Conventional commit validation
│
├── tools/scripts/
│   ├── build-package.sh
│   ├── build-all.sh
│   ├── validate-discrete.sh      # Grep-based (fast, local)
│   ├── validate-discrete-ast.sh  # AST-based (thorough, CI)
│   ├── generate-rollbacks.sh
│   ├── generate-changelog.sh
│   └── bump-version.sh
│
└── .validation-cache/         # Cached AST results
```

### Pre-commit Hook (.husky/pre-commit)

```bash
#!/bin/bash
set -euo pipefail

# Check if code changed but no version bump
CHANGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR | \
    grep -E "^(packages/|functions/|apps/|migrations/)" || true)

if [ -n "$CHANGED_FILES" ]; then
    VERSION_CHANGED=$(git diff --cached --name-only | \
        grep -E "^(VERSION|RADIANT_VERSION|THINKTANK_VERSION)$" || true)
    
    if [ -z "$VERSION_CHANGED" ]; then
        echo "⚠️  Code changes detected but no version bump!"
        echo ""
        echo "Run one of:"
        echo "  npm run version:patch   # Bug fixes (4.18.0 → 4.18.1)"
        echo "  npm run version:minor   # Features (4.18.0 → 4.19.0)"
        echo "  npm run version:major   # Breaking (4.18.0 → 5.0.0)"
        
        if [ "${SKIP_VERSION_CHECK:-}" != "1" ]; then
            exit 1
        fi
    fi
fi

# Run discrete validation
./tools/scripts/validate-discrete.sh
```

### Conventional Commit Validation (.husky/commit-msg)

```bash
#!/bin/bash
COMMIT_MSG=$(cat "$1")
PATTERN="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?(!)?: .+"

if ! echo "$COMMIT_MSG" | grep -qE "$PATTERN"; then
    echo "❌ Invalid commit message!"
    echo ""
    echo "Format: <type>(<scope>)!: <description>"
    echo ""
    echo "Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert"
    echo "Add '!' for breaking changes"
    echo ""
    echo "Examples:"
    echo "  feat: add deployment package system"
    echo "  fix(migrations): correct rollback order"
    echo "  feat!: new package format (breaking)"
    exit 1
fi
```

### Automated Version Bump (tools/scripts/bump-version.sh)

```bash
#!/bin/bash
BUMP_TYPE="${1:-auto}"  # auto, patch, minor, major

# Auto-detect from commits
if [ "$BUMP_TYPE" = "auto" ]; then
    COMMITS=$(git log "$(git describe --tags --abbrev=0 2>/dev/null || echo HEAD~50)..HEAD" --oneline)
    
    if echo "$COMMITS" | grep -qE "^[a-f0-9]+ (feat|fix)!:"; then
        BUMP_TYPE="major"
    elif echo "$COMMITS" | grep -qE "^[a-f0-9]+ feat:"; then
        BUMP_TYPE="minor"
    else
        BUMP_TYPE="patch"
    fi
fi

# Detect which components changed
RADIANT_CHANGED=$(git diff --name-only HEAD~1 | grep -qE "^(packages/infrastructure|functions/|apps/admin-dashboard)" && echo "yes" || echo "no")
THINKTANK_CHANGED=$(git diff --name-only HEAD~1 | grep -qE "^apps/thinktank" && echo "yes" || echo "no")

# Bump versions
PACKAGE_VERSION=$(cat VERSION)
NEW_VERSION=$(bump "$PACKAGE_VERSION" "$BUMP_TYPE")
echo "$NEW_VERSION" > VERSION

if [ "$RADIANT_CHANGED" = "yes" ]; then
    RADIANT_VERSION=$(cat RADIANT_VERSION)
    echo "$(bump "$RADIANT_VERSION" "$BUMP_TYPE")" > RADIANT_VERSION
fi

if [ "$THINKTANK_CHANGED" = "yes" ]; then
    THINKTANK_VERSION=$(cat THINKTANK_VERSION)
    echo "$(bump "$THINKTANK_VERSION" "$BUMP_TYPE")" > THINKTANK_VERSION
fi

# Update VERSION_HISTORY.json
# Generate CHANGELOG.md
```

### AST Validation (CI Only)

```typescript
// tools/ast-validator/validate-discrete.ts
// NOTE: This validation report should be downloadable from the Deployer UI
// for backup purposes. Implement download functionality later.

import * as ts from 'typescript';

class DiscreteValidator {
    validate(): ValidationResult {
        // Scan Radiant files for Think Tank imports
        // Scan Think Tank files for Radiant imports (except @radiant/shared)
        // Return errors if found
    }
}
```

---

## ADMIN DASHBOARD - COST MANAGEMENT

### Cost Tracking Flow

```
Client Request (with estimated_cost)
         │
         ▼
    AI Router Lambda
         │
    ┌────┴────┐
    │ PRE-CALL │ → INSERT cost_logs (estimated_cost, status='pending')
    └────┬────┘
         │
    ┌────┴────┐
    │ AI Call │ → Provider (OpenAI/Anthropic/etc)
    └────┬────┘
         │
    ┌────┴────┐
    │POST-CALL│ → UPDATE cost_logs (actual_cost, variance, status='completed')
    └────┬────┘
         │
         ▼
    Neural Engine (background)
         │ Analyzes patterns, generates recommendations
         ▼
    Admin Dashboard
         │ Shows cost/tenant, cost/model, est vs actual, AI suggestions
```

### Cost Logger Lambda

```typescript
// functions/cost-logger/index.ts

export async function logPreCall(params: {
    tenantId: string;
    userId: string;
    product: 'radiant' | 'thinktank';
    model: string;
    inputTokens: number;
    estimatedCost: number;
}): Promise<string> {
    const id = uuidv4();
    await dynamodb.put({
        TableName: COST_LOGS_TABLE,
        Item: {
            id,
            ...params,
            status: 'pending',
            createdAt: new Date().toISOString()
        }
    });
    return id;
}

export async function logPostCall(params: {
    id: string;
    outputTokens: number;
    actualCost: number;
    latencyMs: number;
}): Promise<void> {
    const existing = await dynamodb.get({ TableName: COST_LOGS_TABLE, Key: { id: params.id } });
    const estimatedCost = existing.Item?.estimatedCost || 0;
    const variance = ((params.actualCost - estimatedCost) / estimatedCost) * 100;
    
    await dynamodb.update({
        TableName: COST_LOGS_TABLE,
        Key: { id: params.id },
        UpdateExpression: 'SET outputTokens=:o, actualCost=:a, variance=:v, latencyMs=:l, status=:s',
        ExpressionAttributeValues: {
            ':o': params.outputTokens,
            ':a': params.actualCost,
            ':v': variance,
            ':l': params.latencyMs,
            ':s': 'completed'
        }
    });
    
    await checkCostAlerts(params.id);
}
```

### Neural Engine Recommendations (Non-Auto)

```typescript
// functions/neural-engine/cost-analyzer.ts

export interface CostInsight {
    id: string;
    type: 'recommendation' | 'trend' | 'anomaly';
    tenantId: string;
    product: 'radiant' | 'thinktank' | 'combined';
    title: string;
    description: string;
    impact: { estimatedSavings?: number; savingsPercent?: number };
