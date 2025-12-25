                    <div className="space-y-4">
                        <Toggle
                            label="Create snapshot before deployment"
                            checked={settings?.createSnapshotByDefault}
                        />
                        <Toggle
                            label="Run health checks after deployment"
                            checked={settings?.runHealthChecksByDefault}
                        />
                        <Toggle
                            label="Enable maintenance mode during deployment"
                            checked={settings?.enableMaintenanceModeByDefault}
                        />
                    </div>
                </CardContent>
            </Card>
            
            <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Settings'}
            </Button>
        </div>
    );
}
```

---

## ADMIN DASHBOARD - OPERATION TIMEOUTS

All operation timeouts are configurable via Admin Dashboard and sync to SSM Parameters.

### Timeout Configuration View (React)

```tsx
// apps/admin-dashboard/src/components/settings/OperationTimeouts.tsx

export function OperationTimeouts() {
    const [timeouts, setTimeouts] = useState<TimeoutConfig | null>(null);
    
    const categories = [
        {
            name: 'Package Operations',
            prefix: 'package',
            items: [
                { key: 'import', label: 'Package import timeout', default: 15 },
                { key: 'extraction', label: 'Archive extraction timeout', default: 30 },
                { key: 'checksum', label: 'Checksum verification timeout', default: 10 }
            ]
        },
        {
            name: 'Validation',
            prefix: 'validation',
            items: [
                { key: 'ast', label: 'AST validation timeout (CI)', default: 90 },
                { key: 'grep', label: 'Grep validation timeout (local)', default: 10 },
                { key: 'discrete', label: 'Discrete separation check', default: 30 }
            ]
        },
        {
            name: 'Snapshot Operations',
            prefix: 'snapshot',
            items: [
                { key: 'aurora', label: 'Aurora snapshot creation', default: 300 },
                { key: 'dynamodb', label: 'DynamoDB backup', default: 180 },
                { key: 's3_manifest', label: 'S3 manifest generation', default: 120 },
                { key: 'verification', label: 'Snapshot verification', default: 60 }
            ]
        },
        {
            name: 'Infrastructure Deployment',
            prefix: 'infrastructure',
            items: [
                { key: 'cdk_synthesis', label: 'CDK synthesis', default: 120 },
                { key: 'cloudformation', label: 'CloudFormation stack', default: 900 },
                { key: 'rollback', label: 'Stack rollback', default: 600 },
                { key: 'stabilization', label: 'Resource stabilization', default: 300 }
            ]
        },
        {
            name: 'Database Migrations',
            prefix: 'migration',
            items: [
                { key: 'step', label: 'Migration step (per step)', default: 300 },
                { key: 'transaction', label: 'Transaction timeout', default: 600 },
                { key: 'lock_acquisition', label: 'Lock acquisition', default: 30 },
                { key: 'verification', label: 'Verification query', default: 60 }
            ]
        },
        {
            name: 'Lambda Deployment',
            prefix: 'lambda',
            items: [
                { key: 'package', label: 'Function package', default: 60 },
                { key: 'update', label: 'Function update', default: 120 },
                { key: 'alias_switch', label: 'Alias switch', default: 30 }
            ]
        },
        {
            name: 'Health Checks',
            prefix: 'health',
            items: [
                { key: 'endpoint', label: 'Individual endpoint', default: 10 },
                { key: 'total', label: 'Total health check', default: 60 },
                { key: 'retry_interval', label: 'Retry interval', default: 5 },
                { key: 'max_retries', label: 'Max retries', default: 3 }
            ]
        },
        {
            name: 'Maintenance Mode',
            prefix: 'maintenance',
            items: [
                { key: 'drain', label: 'Request drain timeout', default: 30 },
                { key: 'verification', label: 'Enable verification', default: 10 }
            ]
        },
        {
            name: 'Deployment Lock',
            prefix: 'lock',
            items: [
                { key: 'ttl', label: 'Lock TTL', default: 300 },
                { key: 'heartbeat', label: 'Heartbeat interval', default: 60 },
                { key: 'stale_threshold', label: 'Stale lock threshold', default: 120 }
            ]
        },
        {
            name: 'AI Operations (Deployer)',
            prefix: 'ai',
            items: [
                { key: 'claude_api', label: 'Claude API timeout', default: 30 },
                { key: 'voice_transcription', label: 'Voice transcription', default: 10 }
            ]
        }
    ];
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2>Operation Timeout Configuration</h2>
                <Button variant="outline" onClick={resetToDefaults}>
                    Reset to Defaults
                </Button>
            </div>
            
            <p className="text-muted">
                Adjust timeouts based on your infrastructure performance.
                Changes sync to Deployer automatically.
            </p>
            
            {categories.map(category => (
                <Card key={category.prefix}>
                    <CardHeader>
                        <CardTitle>{category.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            {category.items.map(item => (
                                <div key={item.key} className="flex items-center gap-4">
                                    <label className="flex-1">{item.label}</label>
                                    <Input
                                        type="number"
                                        className="w-24"
                                        value={timeouts?.[`${category.prefix}.${item.key}`] || item.default}
                                        onChange={(v) => updateTimeout(`${category.prefix}.${item.key}`, v)}
                                    />
                                    <span className="text-muted">s</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ))}
            
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Tip</AlertTitle>
                <AlertDescription>
                    Increase migration timeouts for large databases (&gt;100GB).
                    Decrease health check retries for faster failure detection.
                </AlertDescription>
            </Alert>
            
            <div className="flex gap-4">
                <Button onClick={saveTimeouts}>Save Changes</Button>
                <Button variant="outline" onClick={exportAsJson}>Export as JSON</Button>
            </div>
        </div>
    );
}
```

### Timeout Storage Schema (SSM Parameters)

```
/radiant/{appId}/{env}/config/timeouts/
├── package.import                 = "15"
├── package.extraction             = "30"
├── package.checksum               = "10"
├── validation.ast                 = "90"
├── validation.grep                = "10"
├── snapshot.aurora                = "300"
├── snapshot.dynamodb              = "180"
├── infrastructure.cloudformation  = "900"
├── migration.step                 = "300"
├── migration.transaction          = "600"
├── health.endpoint                = "10"
├── health.total                   = "60"
├── lock.ttl                       = "300"
├── lock.heartbeat                 = "60"
├── ai.claude_api                  = "30"
└── ...
```

### Deployer Timeout Service (Swift)

```swift
// RadiantDeployer/Services/TimeoutService.swift

actor TimeoutService {
    private var timeouts: [String: TimeInterval] = [:]
    private let ssmService: SSMService
    private var pollTask: Task<Void, Never>?
    
    /// Load timeouts from SSM on startup
    func loadTimeouts(instance: DeploymentInstance) async throws {
        let prefix = "/radiant/\(instance.appId)/\(instance.environment)/config/timeouts/"
        let parameters = try await ssmService.getParametersByPath(prefix)
        
        for param in parameters {
            let key = param.name.replacingOccurrences(of: prefix, with: "")
            if let value = Double(param.value) {
                timeouts[key] = value
            }
        }
        
        startPolling(instance: instance)
    }
    
    /// Get timeout with fallback to default
    func timeout(for operation: String) -> TimeInterval {
        timeouts[operation] ?? defaultTimeout(for: operation)
    }
    
    private func defaultTimeout(for operation: String) -> TimeInterval {
        switch operation {
        case "snapshot.aurora": return 300
        case "infrastructure.cloudformation": return 900
        case "migration.step": return 300
        case "health.endpoint": return 10
        case "lock.ttl": return 300
        default: return 60
        }
    }
    
    private func startPolling(instance: DeploymentInstance) {
        pollTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 60_000_000_000)
                try? await loadTimeouts(instance: instance)
            }
        }
    }
}
```

---

## RUNTIME COMPONENTS

### Cost Logging Integration

Add to AI Router Lambda:

```typescript
// functions/router/index.ts

import { logPreCall, logPostCall, logFailure } from '../cost-logger';

export async function handler(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    const request = parseRequest(event);
    
    // Calculate estimated cost
    const estimatedCost = calculateEstimatedCost(
        request.model,
        request.inputTokens
    );
    
    // Log pre-call
    const costLogId = await logPreCall({
        tenantId: request.tenantId,
        userId: request.userId,
        product: determineProduct(event),  // 'radiant' or 'thinktank'
        model: request.model,
        provider: getProvider(request.model),
        inputTokens: request.inputTokens,
        estimatedCost
    });
    
    try {
        const startTime = Date.now();
        
        // Call AI provider
        const response = await callProvider(request);
        
        const latencyMs = Date.now() - startTime;
        
        // Log post-call
        await logPostCall({
            id: costLogId,
            outputTokens: response.usage.outputTokens,
            actualCost: calculateActualCost(request.model, response.usage),
            latencyMs
        });
        
        return formatResponse(response);
        
    } catch (error) {
        await logFailure({
            id: costLogId,
            errorMessage: error.message
        });
        throw error;
    }
}
```

### Experiment Integration

Add to feature flag system:

```typescript
// packages/shared/src/features/experiments.ts

export async function getFeatureValue<T>(
    featureKey: string,
    userId: string,
    tenantId: string,
    product: 'radiant' | 'thinktank',
    defaultValue: T
): Promise<T> {
    
    // Check for active experiment
    const experiment = await getActiveExperimentForFeature(featureKey);
    
    if (experiment) {
        const assignment = await getVariantAssignment({
            experimentId: experiment.id,
            userId,
            tenantId,
            product
        });
        
        if (assignment) {
            // Track exposure
            await trackExposure(experiment.id, userId, assignment.variantId);
            
            // Return variant's feature value
            const variant = experiment.variants.find(v => v.id === assignment.variantId);
            return variant?.config[featureKey] ?? defaultValue;
        }
    }
    
    // Fall back to feature flag
    return getFeatureFlag(featureKey, defaultValue);
}
```

### Security Event Logging

Add security hooks to authentication:

```typescript
// functions/auth/index.ts

import { logSecurityEvent } from '../anomaly-detector';

export async function handleLogin(credentials: Credentials): Promise<AuthResult> {
    const result = await authenticate(credentials);
    
    if (!result.success) {
        await logSecurityEvent({
            type: 'failed_login',
            severity: 'medium',
            tenantId: credentials.tenantId,
            product: credentials.product,
            details: {
                userId: credentials.userId,
                reason: result.failureReason,
                ipAddress: credentials.ipAddress,
                userAgent: credentials.userAgent
            }
        });
        
        // Check for lockout threshold
        const failedAttempts = await getFailedAttempts(credentials.userId, 15 * 60 * 1000);
        if (failedAttempts >= 5) {
            await lockAccount(credentials.userId, 30 * 60 * 1000);
            await logSecurityEvent({
                type: 'account_locked',
                severity: 'high',
                tenantId: credentials.tenantId,
                product: credentials.product,
                details: {
                    userId: credentials.userId,
                    lockDuration: '30 minutes',
                    failedAttempts
                }
            });
        }
    } else {
        // Check for geographic anomaly
        await checkGeographicAnomaly(credentials.userId, credentials.ipAddress);
    }
    
    return result;
}
```


---

## DATABASE SCHEMA UPDATES

### New Tables for v4.18.0

```sql
-- =====================================================
-- COST TRACKING
-- =====================================================

CREATE TABLE cost_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    request_id VARCHAR(100),
    product VARCHAR(20) NOT NULL CHECK (product IN ('radiant', 'thinktank')),
    
    -- Model info
    model VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    
    -- Token counts
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER,
    
    -- Costs
    estimated_cost DECIMAL(10, 6) NOT NULL,
    actual_cost DECIMAL(10, 6),
    variance DECIMAL(10, 2),  -- Percentage
    
    -- Performance
