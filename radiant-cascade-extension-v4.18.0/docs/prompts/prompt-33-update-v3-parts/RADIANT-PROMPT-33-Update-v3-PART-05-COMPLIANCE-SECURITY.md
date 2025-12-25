            median: number;
            stdDev: number;
            ci95: [number, number];  // 95% confidence interval
        };
    };
}

export interface MetricAnalysis {
    metricName: string;
    controlValue: number;
    testValue: number;
    absoluteDifference: number;
    relativeDifference: number;  // Percentage
    pValue: number;
    isSignificant: boolean;
    effectSize: number;          // Cohen's d
    power: number;               // Statistical power
}

export async function analyzeExperiment(experimentId: string): Promise<ExperimentResults> {
    const experiment = await getExperiment(experimentId);
    const events = await getExperimentEvents(experimentId);
    
    // Group by variant
    const byVariant = groupBy(events, 'variant');
    
    // Calculate statistics for each variant
    const variantResults: VariantResults[] = [];
    for (const variant of experiment.variants) {
        const variantEvents = byVariant[variant.id] || [];
        variantResults.push(calculateVariantStats(variant, variantEvents, experiment.metrics));
    }
    
    // Statistical significance tests
    const control = variantResults.find(v => v.isControl)!;
    const treatments = variantResults.filter(v => !v.isControl);
    
    const primaryAnalysis = await analyzeMetric(
        experiment.metrics.primary,
        control,
        treatments
    );
    
    const secondaryAnalyses = await Promise.all(
        experiment.metrics.secondary.map(metric =>
            analyzeMetric(metric, control, treatments)
        )
    );
    
    // Generate recommendation
    const recommendation = generateRecommendation(
        experiment,
        primaryAnalysis,
        variantResults
    );
    
    return {
        experimentId,
        analyzedAt: new Date().toISOString(),
        variants: variantResults,
        statistical: {
            primaryMetric: primaryAnalysis,
            secondaryMetrics: secondaryAnalyses
        },
        recommendation
    };
}

function tTest(control: number[], treatment: number[]): { tStatistic: number; pValue: number } {
    const n1 = control.length;
    const n2 = treatment.length;
    const mean1 = control.reduce((a, b) => a + b, 0) / n1;
    const mean2 = treatment.reduce((a, b) => a + b, 0) / n2;
    
    const var1 = control.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (n1 - 1);
    const var2 = treatment.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (n2 - 1);
    
    const pooledSE = Math.sqrt(var1/n1 + var2/n2);
    const tStatistic = (mean1 - mean2) / pooledSE;
    
    // Degrees of freedom (Welch's approximation)
    const df = Math.pow(var1/n1 + var2/n2, 2) / 
        (Math.pow(var1/n1, 2)/(n1-1) + Math.pow(var2/n2, 2)/(n2-1));
    
    // p-value from t-distribution (simplified)
    const pValue = 2 * (1 - tCDF(Math.abs(tStatistic), df));
    
    return { tStatistic, pValue };
}
```

### A/B Testing Dashboard (React)

```tsx
// apps/admin-dashboard/src/components/experiments/ExperimentDashboard.tsx

export function ExperimentDashboard() {
    const [productFilter, setProductFilter] = useState<'radiant' | 'thinktank' | 'combined'>('combined');
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between">
                <h2>A/B Testing</h2>
                <div className="flex gap-4">
                    <ProductFilter value={productFilter} onChange={setProductFilter} />
                    <Button onClick={() => navigate('/experiments/new')}>
                        New Experiment
                    </Button>
                </div>
            </div>
            
            {/* Active Experiments */}
            <Section title="Running Experiments">
                <ExperimentTable
                    status="running"
                    productFilter={productFilter}
                    onView={(id) => navigate(`/experiments/${id}`)}
                />
            </Section>
            
            {/* Completed */}
            <Section title="Completed Experiments">
                <ExperimentTable
                    status="completed"
                    productFilter={productFilter}
                    onView={(id) => navigate(`/experiments/${id}`)}
                />
            </Section>
        </div>
    );
}

export function ExperimentDetail({ experimentId }: { experimentId: string }) {
    const [experiment, setExperiment] = useState<Experiment | null>(null);
    const [results, setResults] = useState<ExperimentResults | null>(null);
    
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between">
                <div>
                    <h2>{experiment?.name}</h2>
                    <p className="text-muted">{experiment?.description}</p>
                </div>
                <StatusBadge status={experiment?.status} />
            </div>
            
            {/* Hypothesis */}
            <Card>
                <CardHeader>Hypothesis</CardHeader>
                <CardContent>{experiment?.hypothesis}</CardContent>
            </Card>
            
            {/* Variants */}
            <Card>
                <CardHeader>Variants</CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Variant</TableHead>
                                <TableHead>Allocation</TableHead>
                                <TableHead>Users</TableHead>
                                <TableHead>Primary Metric</TableHead>
                                <TableHead>Difference</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {results?.variants.map(variant => (
                                <TableRow key={variant.variantId}>
                                    <TableCell>
                                        {variant.variantName}
                                        {variant.isControl && <Badge>Control</Badge>}
                                    </TableCell>
                                    <TableCell>{getVariantAllocation(experiment, variant)}%</TableCell>
                                    <TableCell>{variant.sampleSize.toLocaleString()}</TableCell>
                                    <TableCell>
                                        {formatMetric(variant.metrics[results.statistical.primaryMetric.metricName])}
                                    </TableCell>
                                    <TableCell>
                                        {!variant.isControl && (
                                            <DifferenceDisplay
                                                diff={calculateDiff(results, variant)}
                                                isSignificant={results.statistical.primaryMetric.isSignificant}
                                            />
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            
            {/* Statistical Significance */}
            <Card>
                <CardHeader>Statistical Analysis</CardHeader>
                <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                        <StatCard
                            label="P-Value"
                            value={results?.statistical.primaryMetric.pValue.toFixed(4)}
                            status={results?.statistical.primaryMetric.pValue < 0.05 ? 'success' : 'pending'}
                        />
                        <StatCard
                            label="Confidence"
                            value={`${((1 - (results?.statistical.primaryMetric.pValue || 0)) * 100).toFixed(1)}%`}
                        />
                        <StatCard
                            label="Effect Size"
                            value={results?.statistical.primaryMetric.effectSize.toFixed(2)}
                            description={getEffectSizeLabel(results?.statistical.primaryMetric.effectSize)}
                        />
                        <StatCard
                            label="Sample Size"
                            value={results?.variants.reduce((sum, v) => sum + v.sampleSize, 0).toLocaleString()}
                        />
                    </div>
                    
                    {results?.statistical.primaryMetric.isSignificant ? (
                        <Alert variant="success" className="mt-4">
                            <CheckCircle className="h-4 w-4" />
                            <AlertTitle>Statistically Significant</AlertTitle>
                            <AlertDescription>
                                The difference between variants is statistically significant at the 95% confidence level.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Alert variant="info" className="mt-4">
                            <Info className="h-4 w-4" />
                            <AlertTitle>Not Yet Significant</AlertTitle>
                            <AlertDescription>
                                More data needed to reach statistical significance.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
            
            {/* Actions */}
            <div className="flex gap-4">
                {experiment?.status === 'running' && (
                    <>
                        <Button variant="outline" onClick={() => pauseExperiment(experimentId)}>
                            Pause Experiment
                        </Button>
                        <Button variant="outline" onClick={() => extendExperiment(experimentId)}>
                            Extend Duration
                        </Button>
                        {results?.statistical.primaryMetric.isSignificant && (
                            <Button onClick={() => rolloutWinner(experimentId)}>
                                Roll Out Winner
                            </Button>
                        )}
                    </>
                )}
                <Button variant="outline" onClick={() => exportResults(experimentId)}>
                    Export Results
                </Button>
            </div>
        </div>
    );
}
```


---

## ADMIN DASHBOARD - DEPLOYMENT SETTINGS

### Bidirectional Sync Architecture

```
Admin Dashboard ←→ AWS SSM Parameters ←→ Deployer App
       │                   │                   │
       │    /radiant/{appId}/{env}/           │
       │    └─ config/                        │
       │       ├─ timeouts/                   │
       │       ├─ retention/                  │
       │       ├─ compatibility/              │
       │       └─ alerts/                     │
       │                                      │
       └──────── Reads on startup ────────────┘
                 Polls for changes (60s)
```

### Deployment Settings View (React)

```tsx
// apps/admin-dashboard/src/components/settings/DeploymentSettings.tsx

export function DeploymentSettings() {
    const [settings, setSettings] = useState<DeploymentConfig | null>(null);
    const [saving, setSaving] = useState(false);
    
    const handleSave = async () => {
        setSaving(true);
        await saveDeploymentSettings(settings);
        setSaving(false);
    };
    
    return (
        <div className="space-y-6">
            <h2>Deployment Configuration</h2>
            
            {/* Lock-Step Mode */}
            <Card>
                <CardHeader>
                    <CardTitle>Version Control</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Toggle
                            label="Lock-Step Mode"
                            description="Require all components to be updated together"
                            checked={settings?.lockStepMode}
                            onChange={(v) => setSettings({...settings, lockStepMode: v})}
                        />
                        
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Max Major Version Drift"
                                type="number"
                                value={settings?.maxVersionDrift?.major}
                                onChange={(v) => setSettings({
                                    ...settings,
                                    maxVersionDrift: {...settings?.maxVersionDrift, major: v}
                                })}
                            />
                            <Input
                                label="Max Minor Version Drift"
                                type="number"
                                value={settings?.maxVersionDrift?.minor}
                                onChange={(v) => setSettings({
                                    ...settings,
                                    maxVersionDrift: {...settings?.maxVersionDrift, minor: v}
                                })}
                            />
                        </div>
                        
                        <Toggle
                            label="Warn on Version Drift"
                            checked={settings?.warnOnDrift}
                            onChange={(v) => setSettings({...settings, warnOnDrift: v})}
                        />
                    </div>
                </CardContent>
            </Card>
            
            {/* Retention Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>Snapshot Retention</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            label="Production (days)"
                            type="number"
                            value={settings?.retention?.productionDays}
                            onChange={(v) => setSettings({
                                ...settings,
                                retention: {...settings?.retention, productionDays: v}
                            })}
                        />
                        <Input
                            label="Staging (days)"
                            type="number"
                            value={settings?.retention?.stagingDays}
                            onChange={(v) => setSettings({
                                ...settings,
                                retention: {...settings?.retention, stagingDays: v}
                            })}
                        />
                        <Input
                            label="Development (days)"
                            type="number"
                            value={settings?.retention?.developmentDays}
                            onChange={(v) => setSettings({
                                ...settings,
                                retention: {...settings?.retention, developmentDays: v}
                            })}
                        />
                    </div>
                    
                    <Input
                        label="Max Snapshots per Environment"
                        type="number"
                        className="mt-4"
                        value={settings?.retention?.maxSnapshotsPerEnvironment}
                    />
                </CardContent>
            </Card>
            
            {/* Default Behaviors */}
            <Card>
                <CardHeader>
                    <CardTitle>Deployment Defaults</CardTitle>
                </CardHeader>
                <CardContent>
