'use client';

/**
 * RADIANT Admin Dashboard - Deployer Bi-directional Sync Status
 * Shows version information and capabilities of the Swift Deployer's sync system
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  RefreshCw, 
  Database, 
  Cloud, 
  Shield, 
  Bell, 
  Server,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Code,
  Package
} from 'lucide-react';

// Bi-directional Sync Version Info (must match Swift implementation)
const BIDIRECTIONAL_SYNC_VERSION = {
  system: '1.4.0',
  components: {
    stateTracker: '1.2.0',
    cdkGenerator: '1.2.0',
    extractor: '1.0.0',
    diffGenerator: '1.0.0',
    packageGenerator: '1.0.0',
    secretMigrator: '1.0.0',
    safeSchemaMigration: '1.1.0',
    snapshotManager: '1.0.0',
  },
  trackedResourceTypes: [
    'IAM Roles',
    'IAM Policies',
    'Security Groups',
    'Secrets Manager',
    'Parameter Store',
    'EventBridge Rules',
    'SQS Queues',
    'SNS Topics',
    'CloudWatch Alarms',
    'CloudWatch Dashboards',
    'API Gateway',
    'Cognito User Pools',
    'Step Functions',
    'Kinesis Streams',
  ],
  extractedResourceTypes: [
    'Database Schema (Aurora PostgreSQL)',
    'Lambda Functions (code + config)',
    'S3 Bucket Configurations',
    'DynamoDB Table Schemas',
    'CDK Stack Outputs',
  ],
  versionHistory: [
    {
      version: '1.4.0',
      releaseDate: '2026-02-05',
      changes: [
        '✅ NEW: Full RDS Snapshot Manager with tiered storage',
        'On-demand snapshot creation (Aurora + DynamoDB + S3 manifest)',
        'Versioned snapshots with restore history',
        'Tiered storage: Hot → Warm → Cold → Archive lifecycle',
        'Pre-migration full snapshots before destructive schema changes',
        'Configurable retention policy and auto-transition rules',
      ],
    },
    {
      version: '1.3.0',
      releaseDate: '2026-02-05',
      changes: [
        '✅ NEW: Safe Schema Migration with automatic data clearing',
        'Schema change detection compares instance vs package schemas',
        '4 migration policies: Strict, ClearData, Preserve, Manual',
        'Automatic table backup before data clearing',
        'Full audit logging for regulatory compliance (GDPR, HIPAA)',
        'Prevents unknown failure outcomes from orphaned data',
      ],
    },
    {
      version: '1.2.0',
      releaseDate: '2026-02-05',
      changes: [
        '✅ AUTOMATED: Secret values now migrate securely without local storage',
        '✅ AUTOMATED: SecureString parameters now migrate automatically',
        '✅ AUTOMATED: CloudWatch dashboards capture full widget JSON',
        'New SecretMigrator service for cross-account secret/parameter migration',
        'All partial coverage items now have FULL automation',
        'Zero manual work required for any supported resource type',
      ],
    },
    {
      version: '1.1.0',
      releaseDate: '2026-02-05',
      changes: [
        '✅ FIXED: API Gateway authorizers now use dynamic Lambda ARN resolution',
        '✅ FIXED: Cognito Lambda triggers now use dynamic Lambda ARN resolution',
        'API Gateway and Cognito now have FULL bi-directional support',
        'Lambda function names extracted from ARNs for portable CDK code',
        'Generated CDK uses Function.fromFunctionName() for cross-account compatibility',
      ],
    },
    {
      version: '1.0.0',
      releaseDate: '2026-02-05',
      changes: [
        'Initial release of bi-directional sync',
        'AWS State Tracker: 14 resource types',
        'CDK Code Generator: Full TypeScript generation',
        'Instance State Extractor: Schema, Lambda, S3, DynamoDB',
        'Schema Diff Generator: Table, column, enum diffs',
        'Package Generator: Migration and Lambda code bundling',
      ],
    },
  ],
};

// Resource category icons
const resourceIcons: Record<string, React.ReactNode> = {
  'IAM Roles': <Shield className="h-4 w-4" />,
  'IAM Policies': <Shield className="h-4 w-4" />,
  'Security Groups': <Shield className="h-4 w-4" />,
  'Secrets Manager': <Shield className="h-4 w-4" />,
  'Parameter Store': <Database className="h-4 w-4" />,
  'EventBridge Rules': <Bell className="h-4 w-4" />,
  'SQS Queues': <Server className="h-4 w-4" />,
  'SNS Topics': <Bell className="h-4 w-4" />,
  'CloudWatch Alarms': <Bell className="h-4 w-4" />,
  'CloudWatch Dashboards': <Server className="h-4 w-4" />,
  'API Gateway': <Cloud className="h-4 w-4" />,
  'Cognito User Pools': <Shield className="h-4 w-4" />,
  'Step Functions': <Code className="h-4 w-4" />,
  'Kinesis Streams': <Server className="h-4 w-4" />,
  'Database Schema': <Database className="h-4 w-4" />,
  'Lambda Functions': <Code className="h-4 w-4" />,
  'S3 Bucket': <Cloud className="h-4 w-4" />,
  'DynamoDB': <Database className="h-4 w-4" />,
  'CDK Stack': <Package className="h-4 w-4" />,
};

// Coverage status
type CoverageStatus = 'full' | 'partial' | 'none';

interface ResourceCoverage {
  name: string;
  capture: CoverageStatus;
  generateCDK: CoverageStatus;
  redeploy: CoverageStatus;
  notes?: string;
}

const resourceCoverage: ResourceCoverage[] = [
  { name: 'Database Schema', capture: 'full', generateCDK: 'full', redeploy: 'full' },
  { name: 'Lambda Functions', capture: 'full', generateCDK: 'full', redeploy: 'full' },
  { name: 'S3 Bucket Config', capture: 'full', generateCDK: 'full', redeploy: 'full' },
  { name: 'DynamoDB Schema', capture: 'full', generateCDK: 'full', redeploy: 'full' },
  { name: 'IAM Roles', capture: 'full', generateCDK: 'full', redeploy: 'full' },
  { name: 'IAM Policies', capture: 'full', generateCDK: 'full', redeploy: 'full' },
  { name: 'Security Groups', capture: 'full', generateCDK: 'full', redeploy: 'full' },
  { name: 'Secrets Manager', capture: 'full', generateCDK: 'full', redeploy: 'full', notes: 'v1.2.0: Secure cross-account migration' },
  { name: 'Parameter Store', capture: 'full', generateCDK: 'full', redeploy: 'full', notes: 'v1.2.0: SecureString migration' },
  { name: 'EventBridge Rules', capture: 'full', generateCDK: 'full', redeploy: 'full' },
  { name: 'SQS Queues', capture: 'full', generateCDK: 'full', redeploy: 'full' },
  { name: 'SNS Topics', capture: 'full', generateCDK: 'full', redeploy: 'full' },
  { name: 'CloudWatch Alarms', capture: 'full', generateCDK: 'full', redeploy: 'full' },
  { name: 'CloudWatch Dashboards', capture: 'full', generateCDK: 'full', redeploy: 'full', notes: 'v1.2.0: Full widget JSON capture' },
  { name: 'Step Functions', capture: 'full', generateCDK: 'full', redeploy: 'full' },
  { name: 'Kinesis Streams', capture: 'full', generateCDK: 'full', redeploy: 'full' },
  { name: 'API Gateway', capture: 'full', generateCDK: 'full', redeploy: 'full', notes: 'v1.1.0: Dynamic Lambda ARN resolution' },
  { name: 'Cognito User Pools', capture: 'full', generateCDK: 'full', redeploy: 'full', notes: 'v1.1.0: Dynamic Lambda ARN resolution' },
  { name: 'Actual Data (Aurora)', capture: 'none', generateCDK: 'none', redeploy: 'none', notes: 'Cannot sync user data' },
  { name: 'Actual Items (DynamoDB)', capture: 'none', generateCDK: 'none', redeploy: 'none', notes: 'Cannot sync user data' },
  { name: 'Actual Objects (S3)', capture: 'none', generateCDK: 'none', redeploy: 'none', notes: 'Cannot sync user uploads' },
];

function StatusIcon({ status }: { status: CoverageStatus }) {
  switch (status) {
    case 'full':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'partial':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'none':
      return <XCircle className="h-4 w-4 text-red-500" />;
  }
}

export default function DeployerSyncPage() {
  const [activeTab, setActiveTab] = useState('overview');

  const totalResources = 
    BIDIRECTIONAL_SYNC_VERSION.trackedResourceTypes.length + 
    BIDIRECTIONAL_SYNC_VERSION.extractedResourceTypes.length;

  const fullCoverage = resourceCoverage.filter(r => 
    r.capture === 'full' && r.generateCDK === 'full' && r.redeploy === 'full'
  ).length;

  const partialCoverage = resourceCoverage.filter(r => 
    r.capture !== 'none' && (r.generateCDK === 'partial' || r.redeploy === 'partial')
  ).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deployer Bi-directional Sync</h1>
          <p className="text-muted-foreground">
            AWS state extraction and CDK code generation capabilities
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <RefreshCw className="h-4 w-4 mr-2" />
          v{BIDIRECTIONAL_SYNC_VERSION.system}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              System Version
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">v{BIDIRECTIONAL_SYNC_VERSION.system}</div>
            <p className="text-xs text-muted-foreground">
              {BIDIRECTIONAL_SYNC_VERSION.versionHistory[0].releaseDate}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Resource Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResources}</div>
            <p className="text-xs text-muted-foreground">
              {BIDIRECTIONAL_SYNC_VERSION.trackedResourceTypes.length} tracked + {BIDIRECTIONAL_SYNC_VERSION.extractedResourceTypes.length} extracted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Full Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{fullCoverage}</div>
            <p className="text-xs text-muted-foreground">
              resources fully bi-directional
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Partial Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{partialCoverage}</div>
            <p className="text-xs text-muted-foreground">
              resources need manual steps
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="coverage">Coverage Matrix</TabsTrigger>
          <TabsTrigger value="history">Version History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tracked Resources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpDown className="h-5 w-5 text-blue-500" />
                  AWS State Tracker
                </CardTitle>
                <CardDescription>
                  Resources tracked persistently for bi-directional sync
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {BIDIRECTIONAL_SYNC_VERSION.trackedResourceTypes.map((resource) => (
                    <Badge key={resource} variant="secondary" className="flex items-center gap-1">
                      {resourceIcons[resource] || <Cloud className="h-3 w-3" />}
                      {resource}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Extracted Resources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-green-500" />
                  Instance Extractor
                </CardTitle>
                <CardDescription>
                  Resources extracted from running AWS instances
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {BIDIRECTIONAL_SYNC_VERSION.extractedResourceTypes.map((resource) => (
                    <Badge key={resource} variant="outline" className="flex items-center gap-1">
                      {resource.includes('Database') && <Database className="h-3 w-3" />}
                      {resource.includes('Lambda') && <Code className="h-3 w-3" />}
                      {resource.includes('S3') && <Cloud className="h-3 w-3" />}
                      {resource.includes('DynamoDB') && <Database className="h-3 w-3" />}
                      {resource.includes('CDK') && <Package className="h-3 w-3" />}
                      {resource}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* How It Works */}
          <Card>
            <CardHeader>
              <CardTitle>How Bi-directional Sync Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
                <div className="p-4 bg-muted rounded-lg">
                  <Cloud className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <div className="font-medium">1. Extract</div>
                  <p className="text-xs text-muted-foreground">
                    Read AWS instance state
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <Database className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <div className="font-medium">2. Track</div>
                  <p className="text-xs text-muted-foreground">
                    Store state locally
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <ArrowUpDown className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                  <div className="font-medium">3. Diff</div>
                  <p className="text-xs text-muted-foreground">
                    Compare with package
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <Code className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                  <div className="font-medium">4. Generate</div>
                  <p className="text-xs text-muted-foreground">
                    Create CDK code
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <Package className="h-8 w-8 mx-auto mb-2 text-cyan-500" />
                  <div className="font-medium">5. Package</div>
                  <p className="text-xs text-muted-foreground">
                    Bundle for deploy
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="components" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Component Versions</CardTitle>
              <CardDescription>
                Individual component versions of the bi-directional sync system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(BIDIRECTIONAL_SYNC_VERSION.components).map(([name, version]) => (
                  <div key={name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <div className="font-medium capitalize">
                        {name.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {name === 'stateTracker' && 'Tracks 14 AWS resource types persistently'}
                        {name === 'cdkGenerator' && 'Generates TypeScript CDK constructs'}
                        {name === 'extractor' && 'Extracts schema, Lambda, S3, DynamoDB'}
                        {name === 'diffGenerator' && 'Compares instance vs package state'}
                        {name === 'packageGenerator' && 'Creates deployable package bundles'}
                      </div>
                    </div>
                    <Badge variant="outline">v{version}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coverage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Coverage Matrix</CardTitle>
              <CardDescription>
                What can be captured, generated as CDK, and redeployed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Resource</th>
                      <th className="text-center p-2">Capture</th>
                      <th className="text-center p-2">Generate CDK</th>
                      <th className="text-center p-2">Redeploy</th>
                      <th className="text-left p-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resourceCoverage.map((resource) => (
                      <tr key={resource.name} className="border-b">
                        <td className="p-2 font-medium">{resource.name}</td>
                        <td className="p-2 text-center">
                          <StatusIcon status={resource.capture} />
                        </td>
                        <td className="p-2 text-center">
                          <StatusIcon status={resource.generateCDK} />
                        </td>
                        <td className="p-2 text-center">
                          <StatusIcon status={resource.redeploy} />
                        </td>
                        <td className="p-2 text-sm text-muted-foreground">
                          {resource.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> Full support
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" /> Partial support
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-red-500" /> Not supported
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Version History</CardTitle>
              <CardDescription>
                Release history and changelog
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {BIDIRECTIONAL_SYNC_VERSION.versionHistory.map((release) => (
                  <div key={release.version} className="border-l-2 border-blue-500 pl-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge>v{release.version}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {release.releaseDate}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {release.changes.map((change, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <span className="text-green-500 mt-1">•</span>
                          {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
