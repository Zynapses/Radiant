                    icon={<Users />}
                />
                <SecurityCard
                    title="API Key Usage"
                    value={securityData?.apiKeyUsage}
                    icon={<Key />}
                />
            </div>
            
            {/* Charts */}
            <div className="grid grid-cols-2 gap-6">
                <FailedLoginsChart data={securityData?.failedLoginsOverTime} />
                <GeographicAccessMap data={securityData?.accessByLocation} />
                <AnomalyTimeline data={securityData?.anomalies} />
                <TopThreatsTable data={securityData?.topThreats} />
            </div>
            
            {/* Detailed Reports */}
            <Tabs>
                <Tab title="Failed Authentications">
                    <FailedAuthTable productFilter={productFilter} />
                </Tab>
                <Tab title="Anomalies">
                    <AnomalyTable productFilter={productFilter} />
                </Tab>
                <Tab title="API Key Activity">
                    <APIKeyActivityTable productFilter={productFilter} />
                </Tab>
                <Tab title="Session Hijacking">
                    <SessionHijackingTable productFilter={productFilter} />
                </Tab>
            </Tabs>
        </div>
    );
}
```

### Security Event Types

| Event Type | Detection Method | Severity | Auto-Response |
|------------|------------------|----------|---------------|
| **Failed login (3+ attempts)** | Count threshold | Medium | Lock account |
| **Geographic anomaly** | IP geolocation mismatch | High | Alert only |
| **Session hijacking** | Multi-IP same session | Critical | Terminate session |
| **API key misuse** | Unusual usage pattern | High | Alert + rate limit |
| **Privilege escalation** | Unauthorized admin action | Critical | Alert + block |
| **Data exfiltration** | Large export detection | High | Alert + audit |
| **Rate limit violation** | Request threshold | Low | Auto-throttle |

### Anomaly Detector Lambda

```typescript
// functions/anomaly-detector/index.ts

export interface SecurityEvent {
    id: string;
    type: SecurityEventType;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: string;
    userId?: string;
    tenantId: string;
    product: 'radiant' | 'thinktank';
    details: Record<string, any>;
    resolved: boolean;
    resolution?: string;
}

export async function detectAnomalies(): Promise<SecurityEvent[]> {
    const events: SecurityEvent[] = [];
    
    // 1. Failed login analysis
    const failedLogins = await analyzeFailedLogins();
    events.push(...failedLogins);
    
    // 2. Geographic anomaly detection
    const geoAnomalies = await detectGeographicAnomalies();
    events.push(...geoAnomalies);
    
    // 3. Session hijacking detection
    const sessionHijacks = await detectSessionHijacking();
    events.push(...sessionHijacks);
    
    // 4. API key usage analysis
    const apiKeyIssues = await analyzeAPIKeyUsage();
    events.push(...apiKeyIssues);
    
    // 5. Data exfiltration detection
    const exfiltration = await detectDataExfiltration();
    events.push(...exfiltration);
    
    // Store events
    await storeSecurityEvents(events);
    
    // Trigger alerts for high/critical
    await triggerAlerts(events.filter(e => e.severity === 'high' || e.severity === 'critical'));
    
    return events;
}

async function detectGeographicAnomalies(): Promise<SecurityEvent[]> {
    const events: SecurityEvent[] = [];
    
    // Get recent logins with geolocation
    const recentLogins = await getRecentLoginsWithGeo();
    
    // Group by user
    const byUser = groupBy(recentLogins, 'userId');
    
    for (const [userId, logins] of Object.entries(byUser)) {
        if (logins.length < 2) continue;
        
        // Check for impossible travel (e.g., NYC to Tokyo in 1 hour)
        for (let i = 1; i < logins.length; i++) {
            const prev = logins[i - 1];
            const curr = logins[i];
            
            const distance = calculateDistance(prev.location, curr.location);
            const timeDiff = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 3600000;
            
            // If distance > 500km in < 1 hour (impossible travel)
            if (distance > 500 && timeDiff < 1) {
                events.push({
                    id: uuidv4(),
                    type: 'geographic_anomaly',
                    severity: 'high',
                    timestamp: curr.timestamp,
                    userId,
                    tenantId: curr.tenantId,
                    product: curr.product,
                    details: {
                        previousLocation: prev.location,
                        currentLocation: curr.location,
                        distanceKm: distance,
                        timeHours: timeDiff,
                        message: `Impossible travel: ${prev.location.city} → ${curr.location.city} (${Math.round(distance)}km in ${timeDiff.toFixed(1)}h)`
                    },
                    resolved: false
                });
            }
        }
    }
    
    return events;
}

async function detectSessionHijacking(): Promise<SecurityEvent[]> {
    const events: SecurityEvent[] = [];
    
    // Find sessions with multiple IPs
    const sessions = await getActiveSessions();
    
    for (const session of sessions) {
        const uniqueIPs = new Set(session.ipAddresses);
        
        if (uniqueIPs.size > 1) {
            events.push({
                id: uuidv4(),
                type: 'session_hijacking',
                severity: 'critical',
                timestamp: new Date().toISOString(),
                userId: session.userId,
                tenantId: session.tenantId,
                product: session.product,
                details: {
                    sessionId: session.id,
                    ipAddresses: Array.from(uniqueIPs),
                    message: `Session accessed from ${uniqueIPs.size} different IPs`
                },
                resolved: false
            });
            
            // Auto-terminate session
            await terminateSession(session.id);
        }
    }
    
    return events;
}
```


---

## ADMIN DASHBOARD - A/B TESTING

### A/B Testing Framework Architecture

```
Experiment Definition (Admin Dashboard)
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ EXPERIMENT CONFIG                                        │
│ • Name, Hypothesis                                       │
│ • Variants (A/B/C...)                                   │
│ • Traffic allocation %                                   │
│ • Target metric (primary + secondary)                   │
│ • Duration, Min sample size                             │
│ • Significance threshold (default 95%)                  │
│ • Segmentation: Radiant | Think Tank | Combined         │
└─────────────────────────────────────────────────────────┘
         │
         ▼
User Request → Experiment Assignment (hash-based, sticky)
         │
         ▼
Metric Collection (experiment_events table)
         │
         ▼
Statistical Analysis (t-test / chi-square)
         │
         ▼
Admin Dashboard (results, significance, rollout controls)
```

### Experiment Configuration

```typescript
// packages/shared/src/types/experiment.ts

export interface Experiment {
    id: string;
    name: string;
    description: string;
    hypothesis: string;
    status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
    product: 'radiant' | 'thinktank' | 'combined';
    
    variants: Variant[];
    
    metrics: {
        primary: MetricDefinition;
        secondary: MetricDefinition[];
    };
    
    targeting: {
        percentage: number;         // % of eligible users
        userSegments?: string[];    // Optional targeting
        excludeUsers?: string[];    // Explicit exclusions
    };
    
    schedule: {
        startDate: string;
        endDate?: string;
        minSampleSize: number;
        maxDuration: number;        // Days
    };
    
    analysis: {
        significanceThreshold: number;  // Default 0.95
        minimumEffect: number;          // Minimum detectable effect
    };
    
    createdAt: string;
    createdBy: string;
    updatedAt: string;
}

export interface Variant {
    id: string;
    name: string;
    description: string;
    allocation: number;     // Percentage (all variants sum to 100)
    isControl: boolean;
    config: Record<string, any>;  // Feature flags / params
}

export interface MetricDefinition {
    name: string;
    type: 'count' | 'rate' | 'duration' | 'revenue';
    event: string;          // Event name to track
    aggregation: 'sum' | 'avg' | 'median' | 'p95';
    direction: 'increase' | 'decrease';  // What's better
}

export interface ExperimentEvent {
    id: string;
    experimentId: string;
    userId: string;
    tenantId: string;
    product: 'radiant' | 'thinktank';
    variant: string;
    eventName: string;
    eventValue: number;
    metadata: Record<string, any>;
    timestamp: string;
}
```

### Experiment Assignment Lambda

```typescript
// functions/experiment-tracker/assignment.ts

export async function getVariantAssignment(params: {
    experimentId: string;
    userId: string;
    tenantId: string;
    product: 'radiant' | 'thinktank';
}): Promise<VariantAssignment | null> {
    
    // 1. Get experiment config
    const experiment = await getExperiment(params.experimentId);
    if (!experiment || experiment.status !== 'running') {
        return null;
    }
    
    // 2. Check if user already assigned (sticky assignment)
    const existingAssignment = await getExistingAssignment(
        params.experimentId, 
        params.userId
    );
    if (existingAssignment) {
        return existingAssignment;
    }
    
    // 3. Check targeting criteria
    if (!isUserEligible(experiment, params)) {
        return null;
    }
    
    // 4. Hash-based deterministic assignment
    const hash = createHash('md5')
        .update(`${params.experimentId}:${params.userId}`)
        .digest('hex');
    const bucket = parseInt(hash.substring(0, 8), 16) % 10000;
    
    // 5. Check if in experiment percentage
    const experimentBucket = experiment.targeting.percentage * 100;
    if (bucket >= experimentBucket) {
        return null; // Not in experiment
    }
    
    // 6. Assign to variant based on allocation
    let cumulativeBucket = 0;
    let assignedVariant: Variant | null = null;
    
    for (const variant of experiment.variants) {
        cumulativeBucket += variant.allocation * 100;
        if (bucket < cumulativeBucket) {
            assignedVariant = variant;
            break;
        }
    }
    
    if (!assignedVariant) {
        assignedVariant = experiment.variants[0]; // Fallback to first
    }
    
    // 7. Record assignment
    const assignment: VariantAssignment = {
        id: uuidv4(),
        experimentId: params.experimentId,
        userId: params.userId,
        tenantId: params.tenantId,
        product: params.product,
        variantId: assignedVariant.id,
        variantName: assignedVariant.name,
        assignedAt: new Date().toISOString()
    };
    
    await recordAssignment(assignment);
    
    return assignment;
}
```

### Statistical Analysis

```typescript
// functions/experiment-tracker/analysis.ts

export interface ExperimentResults {
    experimentId: string;
    analyzedAt: string;
    
    variants: VariantResults[];
    
    statistical: {
        primaryMetric: MetricAnalysis;
        secondaryMetrics: MetricAnalysis[];
    };
    
    recommendation: {
        action: 'continue' | 'stop_winner' | 'stop_no_effect' | 'need_more_data';
        confidence: number;
        winningVariant?: string;
        explanation: string;
    };
}

export interface VariantResults {
    variantId: string;
    variantName: string;
    isControl: boolean;
    sampleSize: number;
    
    metrics: {
        [metricName: string]: {
            mean: number;
