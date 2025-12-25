    confidence: number;
    status: 'active' | 'dismissed' | 'applied';
}

// Example insight:
// "User 'marketing-team' could save ~$450/month by using Sonnet instead of Opus
//  for summarization tasks (85% of usage). Quality impact: Minimal."
// 
// Actions: [Apply to User] [Dismiss] - NOT auto-applied
```

### Admin Dashboard Cost Analytics (React)

```tsx
// apps/admin-dashboard/src/components/cost/CostAnalytics.tsx

export function CostAnalytics({ tenantId }: { tenantId: string }) {
    const [productFilter, setProductFilter] = useState<'radiant' | 'thinktank' | 'combined'>('combined');
    const [costData, setCostData] = useState<CostData | null>(null);
    const [insights, setInsights] = useState<CostInsight[]>([]);
    
    return (
        <div className="space-y-6">
            {/* Header with filters */}
            <div className="flex justify-between">
                <h2>Cost Analytics</h2>
                <div className="flex gap-4">
                    <Select value={productFilter} onValueChange={setProductFilter}>
                        <SelectItem value="combined">Combined</SelectItem>
                        <SelectItem value="radiant">Radiant</SelectItem>
                        <SelectItem value="thinktank">Think Tank</SelectItem>
                    </Select>
                </div>
            </div>
            
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4">
                <SummaryCard title="Total Spend" value={costData?.totalSpend} />
                <SummaryCard title="Avg Variance" value={costData?.avgVariance} />
                <SummaryCard title="Budget Used" value={costData?.budgetUsed} />
                <SummaryCard title="Projections" value={costData?.projected} />
            </div>
            
            {/* Charts */}
            <div className="grid grid-cols-2 gap-6">
                <CostTrendChart data={costData?.dailyCosts} />
                <CostByModelPie data={costData?.byModel} />
                <EstimatedVsActualChart data={costData?.variance} />
                <CostByTenantTable data={costData?.byTenant} />
            </div>
            
            {/* AI Recommendations (non-auto) */}
            <div>
                <h3>💡 AI Recommendations</h3>
                {insights.map(insight => (
                    <InsightCard
                        key={insight.id}
                        insight={insight}
                        onApply={() => applyInsight(insight.id)}  // Human approval required
                        onDismiss={() => dismissInsight(insight.id)}
                    />
                ))}
            </div>
        </div>
    );
}
```

### Cost Alerts Configuration

```tsx
// Admin Dashboard → Settings → Alerts

export function CostAlertSettings({ tenantId }: { tenantId: string }) {
    return (
        <Form>
            <Section title="Budget Threshold">
                <Input label="Monthly Budget" type="number" prefix="$" />
                <Input label="Alert at % of budget" type="number" suffix="%" defaultValue={80} />
            </Section>
            
            <Section title="Spike Detection">
                <Input label="Alert when daily spend exceeds" suffix="x average" defaultValue={3} />
            </Section>
            
            <Section title="Estimation Variance">
                <Input label="Alert when avg variance exceeds" suffix="%" defaultValue={20} />
            </Section>
            
            <Section title="Notification Channels">
                <Toggle label="Email" />
                <Toggle label="Dashboard notification" />
                <Toggle label="Slack webhook" />
            </Section>
        </Form>
    );
}
```


---

## ADMIN DASHBOARD - COMPLIANCE REPORTS

### Supported Frameworks

| Framework | Purpose | Report Types |
|-----------|---------|--------------|
| **SOC 2 Type II** | Service organization controls | Access Control (CC6.1), System Ops (CC7.1), Change Mgmt (CC8.1), Risk (CC9.1) |
| **HIPAA** | Healthcare data protection | PHI Access, BAA Tracking, Security Incidents, Training |
| **GDPR** | EU data privacy | DSR Log, Consent Records, Data Processing, Cross-border Transfers |
| **ISO 27001** | Information security | Maps to SOC 2 controls + A.9, A.12, A.13 series |

### Report Structure in Admin Dashboard

```
Admin Dashboard → Compliance → Reports
├── SOC 2 Evidence Package
│   ├── Access Control Report (CC6.1)
│   ├── System Operations Report (CC7.1)
│   ├── Change Management Report (CC8.1)
│   ├── Risk Assessment Report (CC9.1)
│   └── Vendor Management Report (CC9.2)
│
├── HIPAA Compliance Report
│   ├── PHI Access Log
│   ├── BAA Tracking
│   ├── Security Incident Log
│   ├── Training Compliance
│   └── Risk Analysis
│
├── GDPR Compliance Report
│   ├── Data Subject Requests (DSR) Log
│   ├── Consent Records
│   ├── Data Processing Activities
│   ├── Cross-border Transfer Log
│   └── Breach Notification History
│
├── Security Reports
│   ├── Intrusion Detection Summary
│   ├── Failed Authentication Report
│   ├── Anomaly Detection Report
│   ├── Vulnerability Assessment
│   └── Penetration Test Results (upload)
│
└── Custom Report Builder
    └── Select metrics → Date range → Export
```

### Compliance Report Component (React)

```tsx
// apps/admin-dashboard/src/components/compliance/ComplianceReports.tsx

export function ComplianceReports() {
    const [framework, setFramework] = useState<'soc2' | 'hipaa' | 'gdpr' | 'iso27001'>('soc2');
    const [productFilter, setProductFilter] = useState<'radiant' | 'thinktank' | 'combined'>('combined');
    const [dateRange, setDateRange] = useState({ start: subMonths(new Date(), 3), end: new Date() });
    
    return (
        <div className="space-y-6">
            {/* Header with framework selector */}
            <div className="flex justify-between items-center">
                <h2>Compliance Reports</h2>
                <div className="flex gap-4">
                    <FrameworkSelector value={framework} onChange={setFramework} />
                    <ProductFilter value={productFilter} onChange={setProductFilter} />
                    <DateRangePicker value={dateRange} onChange={setDateRange} />
                </div>
            </div>
            
            {/* Framework-specific reports */}
            {framework === 'soc2' && (
                <SOC2Reports productFilter={productFilter} dateRange={dateRange} />
            )}
            {framework === 'hipaa' && (
                <HIPAAReports productFilter={productFilter} dateRange={dateRange} />
            )}
            {framework === 'gdpr' && (
                <GDPRReports productFilter={productFilter} dateRange={dateRange} />
            )}
            {framework === 'iso27001' && (
                <ISO27001Reports productFilter={productFilter} dateRange={dateRange} />
            )}
        </div>
    );
}

function SOC2Reports({ productFilter, dateRange }: ReportProps) {
    return (
        <div className="grid grid-cols-2 gap-6">
            <ReportCard
                title="Access Control (CC6.1)"
                description="User access, authentication, and authorization controls"
                onGenerate={() => generateReport('soc2', 'cc6.1', productFilter, dateRange)}
                onDownload={() => downloadReport('soc2', 'cc6.1', productFilter, dateRange)}
            />
            <ReportCard
                title="System Operations (CC7.1)"
                description="System monitoring, incident detection, and response"
                onGenerate={() => generateReport('soc2', 'cc7.1', productFilter, dateRange)}
                onDownload={() => downloadReport('soc2', 'cc7.1', productFilter, dateRange)}
            />
            <ReportCard
                title="Change Management (CC8.1)"
                description="Change authorization, testing, and deployment controls"
                onGenerate={() => generateReport('soc2', 'cc8.1', productFilter, dateRange)}
                onDownload={() => downloadReport('soc2', 'cc8.1', productFilter, dateRange)}
            />
            <ReportCard
                title="Risk Assessment (CC9.1)"
                description="Risk identification, analysis, and mitigation"
                onGenerate={() => generateReport('soc2', 'cc9.1', productFilter, dateRange)}
                onDownload={() => downloadReport('soc2', 'cc9.1', productFilter, dateRange)}
            />
        </div>
    );
}
```

### Custom Report Builder

```tsx
// apps/admin-dashboard/src/components/compliance/CustomReportBuilder.tsx

export function CustomReportBuilder() {
    const [config, setConfig] = useState<ReportConfig>({
        name: '',
        dataSources: [],
        metrics: [],
        filters: {},
        groupBy: [],
        schedule: null
    });
    
    return (
        <div className="space-y-6">
            <h2>Custom Report Builder</h2>
            
            {/* Data Sources */}
            <Section title="Data Sources">
                <Checkbox label="Radiant Platform" checked={config.dataSources.includes('radiant')} />
                <Checkbox label="Think Tank" checked={config.dataSources.includes('thinktank')} />
            </Section>
            
            {/* Metric Categories */}
            <Section title="Metrics">
                <CategoryGroup title="Security Events">
                    <Checkbox label="Failed logins" />
                    <Checkbox label="Privilege escalation attempts" />
                    <Checkbox label="API key usage" />
                </CategoryGroup>
                <CategoryGroup title="Access Logs">
                    <Checkbox label="User sessions" />
                    <Checkbox label="Admin actions" />
                    <Checkbox label="Data exports" />
                </CategoryGroup>
                <CategoryGroup title="Cost Data">
                    <Checkbox label="Spend by user" />
                    <Checkbox label="Spend by model" />
                    <Checkbox label="Variance analysis" />
                </CategoryGroup>
                <CategoryGroup title="Performance">
                    <Checkbox label="Response times" />
                    <Checkbox label="Error rates" />
                    <Checkbox label="Throughput" />
                </CategoryGroup>
            </Section>
            
            {/* Filters */}
            <Section title="Filters">
                <DateRangePicker />
                <UserSelector />
                <TenantSelector />
                <SeveritySelector />
            </Section>
            
            {/* Output */}
            <Section title="Output">
                <Select label="Format">
                    <Option value="pdf">PDF (branded)</Option>
                    <Option value="csv">CSV (raw data)</Option>
                    <Option value="json">JSON (API)</Option>
                </Select>
                <Toggle label="Schedule recurring report" />
                {config.schedule && (
                    <ScheduleSelector value={config.schedule} onChange={...} />
                )}
            </Section>
            
            <div className="flex gap-4">
                <Button variant="outline">Preview</Button>
                <Button variant="primary">Generate Report</Button>
            </div>
        </div>
    );
}
```

### Report Generation Lambda

```typescript
// functions/compliance-reporter/index.ts

export async function generateComplianceReport(params: {
    framework: 'soc2' | 'hipaa' | 'gdpr' | 'iso27001';
    reportType: string;
    product: 'radiant' | 'thinktank' | 'combined';
    dateRange: { start: string; end: string };
    format: 'pdf' | 'csv' | 'json';
}): Promise<ReportResult> {
    
    // Gather data based on framework and report type
    const data = await gatherReportData(params);
    
    // Generate report
    switch (params.format) {
        case 'pdf':
            return await generatePDFReport(data, params.framework);
        case 'csv':
            return await generateCSVReport(data);
        case 'json':
            return { data, metadata: { generatedAt: new Date().toISOString() } };
    }
}

async function gatherReportData(params: ReportParams): Promise<ReportData> {
    switch (params.framework) {
        case 'soc2':
            return await gatherSOC2Data(params.reportType, params);
        case 'hipaa':
            return await gatherHIPAAData(params.reportType, params);
        case 'gdpr':
            return await gatherGDPRData(params.reportType, params);
        case 'iso27001':
            return await gatherISO27001Data(params.reportType, params);
    }
}

async function gatherSOC2Data(reportType: string, params: ReportParams): Promise<SOC2Data> {
    switch (reportType) {
        case 'cc6.1': // Access Control
            return {
                userAccounts: await getUserAccountAudit(params),
                authenticationEvents: await getAuthEvents(params),
                authorizationChanges: await getAuthorizationChanges(params),
                accessReviews: await getAccessReviews(params)
            };
        case 'cc7.1': // System Operations
            return {
                systemMonitoring: await getSystemMonitoringData(params),
                incidentDetection: await getIncidentData(params),
                responseActions: await getResponseActions(params)
            };
        // ... other report types
    }
}
```

---

## ADMIN DASHBOARD - SECURITY & INTRUSION DETECTION

### Security Monitoring Dashboard

```tsx
// apps/admin-dashboard/src/components/security/SecurityDashboard.tsx

export function SecurityDashboard() {
    const [productFilter, setProductFilter] = useState<'radiant' | 'thinktank' | 'combined'>('combined');
    const [securityData, setSecurityData] = useState<SecurityData | null>(null);
    const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between">
                <h2>Security Monitoring</h2>
                <ProductFilter value={productFilter} onChange={setProductFilter} />
            </div>
            
            {/* Active Alerts */}
            <AlertsPanel alerts={alerts} />
            
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
                <SecurityCard
                    title="Failed Logins (24h)"
                    value={securityData?.failedLogins24h}
                    trend={securityData?.failedLoginsTrend}
                    icon={<ShieldAlert />}
                />
                <SecurityCard
                    title="Anomalies Detected"
                    value={securityData?.anomaliesDetected}
                    severity={securityData?.maxAnomalySeverity}
                    icon={<AlertTriangle />}
                />
                <SecurityCard
                    title="Active Sessions"
                    value={securityData?.activeSessions}
